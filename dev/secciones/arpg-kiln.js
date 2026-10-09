/* Visor aislado: Kiln sólo interviene al exportar datos.js. Las copias usan un
   InstancedMesh por módulo y un único material de piedra con color por vértice.
   Los contadores de escena incluyen sombras. CPU es envío, no tiempo de GPU. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search);
  const estado=texto=>{$('estado').textContent=texto;};
  function fallar(texto){$('errorVisor').hidden=false;$('errorVisor').textContent=texto;$('carga').textContent='No disponible';estado(texto);}
  addEventListener('error',e=>fallar('No se pudo preparar el visor: '+(e.message||'error al cargar un recurso.')));
  addEventListener('unhandledrejection',e=>fallar('No se pudo preparar el visor: '+(e.reason?.message||String(e.reason))));
  if(!window.CAOZ_THREE?.THREE||!window.CAOZ_RUINAS_KILN){fallar('Faltan los recursos locales del visor. Comprueba que el servidor sirve visor-three-vendor.js y ruinas-kiln/datos.js.');return;}
  const {THREE:T}=window.CAOZ_THREE,datos=window.CAOZ_RUINAS_KILN;
  if(datos.version!==1||!Array.isArray(datos.modulos)){fallar('El formato de los módulos de Kiln no es compatible.');return;}
  if(q.get('captura')==='1')document.documentElement.dataset.captura='';
  const canvas=$('lienzo'),contenedor=$('escenario');
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:q.get('captura')==='1'});}
  catch(e){fallar('Este visor necesita WebGL 2. No se pudo iniciar el motor gráfico: '+e.message);return;}
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.info.autoReset=false;
  const scene=new T.Scene();scene.background=new T.Color(0x222b30);scene.fog=new T.FogExp2(0x222b30,.008);
  const iso=new T.OrthographicCamera(-10,10,10,-10,.1,700),libre=new T.PerspectiveCamera(34,1,.1,700);
  let camara=iso;
  const configuracion={modulo:'conjunto',cantidad:1,vista:'isometrica',texturas:true,musgo:true,wireframe:false,escala:false};
  const orbita={objetivo:new T.Vector3(),yaw:Math.PI/4,pitch:Math.atan(1/Math.sqrt(2)),distancia:18,alto:10};
  const material=new T.MeshStandardMaterial({color:0xf1eee5,roughness:.93,metalness:0,vertexColors:true,normalScale:new T.Vector2(.66,.66)});
  const texturas={};
  const muros=new T.Group();muros.name='Ruinas de Kiln';scene.add(muros);
  const mapaModulos=new Map(),caja=new T.Box3(),tamano=new T.Vector3(),centro=new T.Vector3();
  const marco={radio:8,alto:3,ancho:12,fondo:4},etiquetas=[];
  let ultimo={cpu:0,llamadas:0,triangulos:0,lineas:0,murosVista:0,murosSombra:0,triangulosMurosPases:0};
  let cuentaMuros={vista:0,sombra:0,triangulos:0},geometriaActiva=0,piezasActivas=0,listo=false,comparando=false,medicion=null;
  let muestrasVivas=[],estabilizar=60,anterior=0,ultimoHUD=0,resultadoComparacion=null;
  const formatear=n=>Math.round(n).toLocaleString('es-ES'),ms=n=>Number.isFinite(n)?n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' ms':'—';
  const percentil=(lista,p)=>{if(!lista.length)return null;const orden=lista.slice().sort((a,b)=>a-b);return orden[Math.max(0,Math.ceil(orden.length*p)-1)];};
  const descripciones={conjunto:'Tres formas de un mismo lugar.',recto:'Piedra tallada, juntas hondas y una coronación gastada.',esquina:'Dos frentes de piedra se encuentran en ángulo recto.',remate:'Un muro interrumpido por el tiempo.'};

  function decodificar(base64,Tipo){
    if(typeof base64!=='string'||!base64.length)throw new Error('Un atributo del módulo está vacío.');
    const bruto=atob(base64),bytes=new Uint8Array(bruto.length);
    for(let i=0;i<bruto.length;i++)bytes[i]=bruto.charCodeAt(i);
    if(bytes.byteLength%Tipo.BYTES_PER_ELEMENT)throw new Error('Longitud de atributo no válida.');
    return new Tipo(bytes.buffer);
  }
  try{
    for(const origen of datos.modulos){
      if(!['recto','esquina','remate'].includes(origen.id)||mapaModulos.has(origen.id))throw new Error('Identificador de módulo no válido.');
      const geo=new T.BufferGeometry(),pos=decodificar(origen.position,Float32Array),norm=decodificar(origen.normal,Float32Array),uv=decodificar(origen.uv,Float32Array),color=decodificar(origen.color,Float32Array),index=decodificar(origen.index,Uint16Array);
      if(pos.length%3||norm.length!==pos.length||color.length!==pos.length||uv.length!==pos.length/3*2||index.length%3)throw new Error('Atributos incompatibles en '+origen.id+'.');
      if(!pos.every(Number.isFinite)||!norm.every(Number.isFinite)||!uv.every(Number.isFinite)||!color.every(Number.isFinite)||index.some(i=>i>=pos.length/3))throw new Error('Geometría no válida en '+origen.id+'.');
      geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('normal',new T.BufferAttribute(norm,3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setAttribute('color',new T.BufferAttribute(color,3));geo.setIndex(new T.BufferAttribute(index,1));
      geo.computeBoundingBox();geo.computeBoundingSphere();
      mapaModulos.set(origen.id,{id:origen.id,nombre:origen.nombre,geo,triangulos:index.length/3,dimensiones:geo.boundingBox.getSize(new T.Vector3()).toArray()});
    }
    if(mapaModulos.size!==3)throw new Error('Se esperan los tres módulos: recto, esquina y remate.');
  }catch(e){fallar('No se pudo leer la geometría de Kiln: '+e.message);renderer.dispose();return;}

  // Estudio sobrio: relleno de luna, luz principal neutra y suelo de piedra.
  scene.add(new T.HemisphereLight(0xc2d6e8,0x555044,1.1));
  const principal=new T.DirectionalLight(0xfff2dc,3.2);principal.position.set(-10,17,12);principal.castShadow=true;
  principal.shadow.mapSize.set(2048,2048);principal.shadow.bias=-.00025;principal.shadow.normalBias=.035;principal.shadow.radius=3;
  scene.add(principal,principal.target);
  const luna=new T.DirectionalLight(0x9bb5d9,1.3);luna.position.set(7,10,-11);scene.add(luna);
  const relleno=new T.DirectionalLight(0xe6edeb,.65);relleno.position.set(12,5,10);scene.add(relleno);
  const sueloMaterial=new T.MeshStandardMaterial({color:0x383f3e,roughness:1,metalness:0,normalScale:new T.Vector2(.10,.10)});
  const suelo=new T.Mesh(new T.PlaneGeometry(600,600),sueloMaterial);suelo.rotation.x=-Math.PI/2;suelo.position.y=-.025;suelo.receiveShadow=true;suelo.name='Suelo del estudio';scene.add(suelo);

  // Referencia humana de 1,8 m, independiente de los lotes de las ruinas.
  const referencia=new T.Group(),referenciaMat=new T.MeshStandardMaterial({color:0xd6cbaa,roughness:.7,metalness:.1});
  const anadirReferencia=(geo,x,y,z=0)=>{const m=new T.Mesh(geo,referenciaMat);m.position.set(x,y,z);m.castShadow=true;referencia.add(m);};
  anadirReferencia(new T.SphereGeometry(.14,12,8),0,1.66);
  anadirReferencia(new T.CapsuleGeometry(.14,.48,4,8),0,1.18);
  for(const x of [-.1,.1])anadirReferencia(new T.CapsuleGeometry(.065,.70,3,6),x,.415);
  for(const x of [-.235,.235])anadirReferencia(new T.CapsuleGeometry(.05,.48,3,6),x,1.15);
  referencia.visible=false;scene.add(referencia);

  function seleccion(){return configuracion.modulo==='conjunto'?[...mapaModulos.values()]:[mapaModulos.get(configuracion.modulo)];}
  function disposicion(cantidad){
    const modulos=seleccion(),margen=1.25,ancho=modulos.reduce((s,m)=>s+m.dimensiones[0],0)+(modulos.length-1)*margen;
    const fondo=Math.max(...modulos.map(m=>m.dimensiones[2])),alto=Math.max(...modulos.map(m=>m.dimensiones[1]));
    let x=-ancho/2;
    const centros=modulos.map(m=>{const cx=x+m.dimensiones[0]/2;x+=m.dimensiones[0]+margen;return cx;});
    const pasoX=ancho+2,pasoZ=Math.max(fondo+2.5,4),columnas=Math.max(1,Math.ceil(Math.sqrt(Math.max(1,cantidad)*pasoZ/pasoX))),filas=Math.max(1,Math.ceil(cantidad/columnas));
    return {modulos,centros,ancho,fondo,alto,pasoX,pasoZ,columnas,filas};
  }
  function limpiarMetricas(){muestrasVivas=[];estabilizar=60;ultimoHUD=0;}
  function reconstruir({encuadrar=true,sombra=true}={}){
    for(const m of [...muros.children]){muros.remove(m);m.dispose();}
    for(const e of etiquetas)e.elemento.remove();etiquetas.length=0;
    const n=configuracion.cantidad,d=disposicion(n),objeto=new T.Object3D();geometriaActiva=0;piezasActivas=0;
    for(let k=0;k<d.modulos.length;k++){
      const modulo=d.modulos[k];
      if(n){
        const m=new T.InstancedMesh(modulo.geo,material,n);m.name=modulo.nombre;m.castShadow=m.receiveShadow=true;
        for(let i=0;i<n;i++){
          const cx=(i%d.columnas-(d.columnas-1)/2)*d.pasoX,cz=(Math.floor(i/d.columnas)-(d.filas-1)/2)*d.pasoZ;
          objeto.position.set(d.centros[k]+cx,0,cz);objeto.rotation.set(0,0,0);objeto.updateMatrix();m.setMatrixAt(i,objeto.matrix);
        }
        m.instanceMatrix.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();
        m.onBeforeRender=()=>{cuentaMuros.vista++;if(!material.wireframe)cuentaMuros.triangulos+=modulo.triangulos*m.count;};
        m.onBeforeShadow=()=>{cuentaMuros.sombra++;cuentaMuros.triangulos+=modulo.triangulos*m.count;};
        muros.add(m);geometriaActiva+=modulo.triangulos*n;piezasActivas+=n;
      }
      if(n===1){
        const elemento=document.createElement('span');elemento.className='klLabel';
        const indice=document.createElement('small');indice.textContent={recto:'01',esquina:'02',remate:'03'}[modulo.id];
        elemento.append(indice,document.createTextNode(modulo.nombre));$('etiquetas').append(elemento);
        etiquetas.push({elemento,posicion:new T.Vector3(d.centros[k],modulo.dimensiones[1]+.36,0)});
      }
    }
    muros.updateMatrixWorld(true);
    if(n)caja.setFromObject(muros);
    else caja.set(new T.Vector3(-d.ancho/2,0,-d.fondo/2),new T.Vector3(d.ancho/2,d.alto,d.fondo/2));
    caja.getSize(tamano);caja.getCenter(centro);
    marco.radio=Math.max(2,tamano.length()*.5);marco.alto=tamano.y;marco.ancho=tamano.x;marco.fondo=tamano.z;
    referencia.position.set(caja.max.x+.95,0,caja.max.z+.4);referencia.visible=configuracion.escala;
    if(configuracion.escala){const e=document.createElement('span');e.className='klLabel';e.textContent='1,8 m';$('etiquetas').append(e);etiquetas.push({elemento:e,posicion:referencia.position.clone().add(new T.Vector3(0,2.02,0))});}
    if(encuadrar)encuadrarEscena();
    if(sombra)ajustarSombra();
    actualizarControles();limpiarMetricas();
  }
  function ajustarSombra(){
    const radio=Math.max(7,marco.radio*1.35);principal.target.position.copy(centro).setY(0);
    principal.position.copy(principal.target.position).add(new T.Vector3(-.7,1.4,1).multiplyScalar(radio*1.5));
    Object.assign(principal.shadow.camera,{left:-radio,right:radio,top:radio,bottom:-radio,near:.1,far:radio*6});principal.shadow.camera.updateProjectionMatrix();
    principal.shadow.normalBias=Math.min(.09,.025+radio*.0005);principal.shadow.needsUpdate=true;
  }
  function encuadrarEscena(){
    const aspecto=Math.max(.3,contenedor.clientWidth/contenedor.clientHeight),radio=marco.radio+(configuracion.escala?.75:0);
    orbita.objetivo.copy(centro);orbita.objetivo.y=Math.max(.4,centro.y-.1);
    orbita.yaw=Math.PI/4;orbita.pitch=Math.atan(1/Math.sqrt(2));
    orbita.alto=Math.max(4.4,radio*2.17/Math.min(aspecto,1.6));
    orbita.distancia=Math.max(7,radio/Math.sin(T.MathUtils.degToRad(libre.fov/2))/Math.min(aspecto,1)*1.12);
    actualizarCamara();
  }
  function actualizarCamara(){
    const aspecto=Math.max(.1,contenedor.clientWidth/contenedor.clientHeight);
    iso.left=-orbita.alto*aspecto/2;iso.right=orbita.alto*aspecto/2;iso.top=orbita.alto/2;iso.bottom=-orbita.alto/2;iso.updateProjectionMatrix();
    libre.aspect=aspecto;libre.updateProjectionMatrix();camara=configuracion.vista==='isometrica'?iso:libre;
    const yaw=configuracion.vista==='isometrica'?Math.PI/4:orbita.yaw,pitch=configuracion.vista==='isometrica'?Math.atan(1/Math.sqrt(2)):orbita.pitch,distancia=configuracion.vista==='isometrica'?Math.max(30,orbita.distancia):orbita.distancia;
    camara.position.set(orbita.objetivo.x+Math.sin(yaw)*Math.cos(pitch)*distancia,orbita.objetivo.y+Math.sin(pitch)*distancia,orbita.objetivo.z+Math.cos(yaw)*Math.cos(pitch)*distancia);camara.lookAt(orbita.objetivo);camara.updateMatrixWorld();
    posicionarEtiquetas();
  }
  function posicionarEtiquetas(){
    const ancho=contenedor.clientWidth,alto=contenedor.clientHeight;
    for(const etiqueta of etiquetas){const p=etiqueta.posicion.clone().project(camara),x=(p.x*.5+.5)*ancho,y=(-p.y*.5+.5)*alto;
      etiqueta.elemento.hidden=p.z>1||p.z< -1||x<35||x>ancho-35||y<100||y>alto-65;
      etiqueta.elemento.style.left=x+'px';etiqueta.elemento.style.top=y+'px';}
  }
  function actualizarControles(){
    for(const b of document.querySelectorAll('[data-modulo]'))b.setAttribute('aria-pressed',String(b.dataset.modulo===configuracion.modulo));
    for(const b of document.querySelectorAll('[data-cantidad]'))b.setAttribute('aria-pressed',String(Number(b.dataset.cantidad)===configuracion.cantidad));
    for(const b of document.querySelectorAll('[data-vista]'))b.setAttribute('aria-pressed',String(b.dataset.vista===configuracion.vista));
    for(const nombre of ['texturas','musgo','wireframe','escala'])$(nombre).checked=configuracion[nombre];
    $('tituloVista').textContent=configuracion.modulo==='conjunto'?'El conjunto':mapaModulos.get(configuracion.modulo).nombre;
    $('descripcionVista').textContent=configuracion.cantidad===0?'El estudio vacío: referencia de coste.':descripciones[configuracion.modulo];
    $('notaRepeticion').textContent=configuracion.modulo==='conjunto'?'Una repetición del conjunto contiene tres piezas.':'Cada repetición añade una pieza del módulo elegido.';
    $('resumenEscena').textContent=`${formatear(piezasActivas)} ${piezasActivas===1?'pieza':'piezas'} · ${formatear(geometriaActiva)} triángulos`;
    $('ayudaCamara').textContent=configuracion.vista==='isometrica'?'Rueda para acercar · Vista libre para girar':'Arrastra para girar · Rueda o pellizco para acercar';
    canvas.setAttribute('aria-label',`${$('tituloVista').textContent}. ${piezasActivas} ${piezasActivas===1?'pieza':'piezas'} en vista ${configuracion.vista}.`);
  }
  function aplicarMaterial(){
    material.map=configuracion.texturas?texturas.color||null:null;material.normalMap=configuracion.texturas?texturas.normal||null:null;
    material.roughnessMap=configuracion.texturas?texturas.superficie||null:null;material.aoMap=configuracion.texturas?texturas.superficie||null:null;material.aoMapIntensity=.55;
    material.vertexColors=configuracion.musgo;material.wireframe=configuracion.wireframe;material.needsUpdate=true;limpiarMetricas();
  }
  function seleccionar(id){if(!['conjunto',...mapaModulos.keys()].includes(id))throw new Error('Módulo desconocido.');configuracion.modulo=id;reconstruir();}
  function repetir(n){if(![0,1,30,100].includes(n))throw new Error('La repetición debe ser 0, 1, 30 o 100.');configuracion.cantidad=n;reconstruir();}
  function vista(nombre){if(!['isometrica','libre'].includes(nombre))throw new Error('Vista desconocida.');configuracion.vista=nombre;actualizarCamara();actualizarControles();limpiarMetricas();}
  function opcion(nombre,valor){if(!['texturas','musgo','wireframe','escala'].includes(nombre))throw new Error('Opción desconocida.');configuracion[nombre]=Boolean(valor);if(nombre==='escala')reconstruir();else aplicarMaterial();actualizarControles();}

  const punteros=new Map();let gesto=null;
  function leerGesto(){const p=[...punteros.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,distancia:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:{...p[0],distancia:0};}
  function zoom(factor){orbita.alto=T.MathUtils.clamp(orbita.alto*factor,1.5,350);orbita.distancia=T.MathUtils.clamp(orbita.distancia*factor,2.5,480);actualizarCamara();limpiarMetricas();}
  canvas.addEventListener('pointerdown',e=>{if(comparando||medicion)return;punteros.set(e.pointerId,{x:e.clientX,y:e.clientY});gesto=leerGesto();canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!punteros.has(e.pointerId)||comparando||medicion)return;punteros.set(e.pointerId,{x:e.clientX,y:e.clientY});const nuevo=leerGesto();
    if(nuevo.distancia&&gesto?.distancia)zoom(gesto.distancia/nuevo.distancia);
    else if(configuracion.vista==='libre'&&gesto){orbita.yaw-=(nuevo.x-gesto.x)*.006;orbita.pitch=T.MathUtils.clamp(orbita.pitch+(nuevo.y-gesto.y)*.004,.08,1.44);actualizarCamara();limpiarMetricas();}
    gesto=nuevo;});
  for(const nombre of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(nombre,e=>{punteros.delete(e.pointerId);gesto=punteros.size?leerGesto():null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(!comparando&&!medicion)zoom(Math.exp(T.MathUtils.clamp(e.deltaY,-100,100)*.0015));},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  for(const b of document.querySelectorAll('[data-modulo]'))b.addEventListener('click',()=>seleccionar(b.dataset.modulo));
  for(const b of document.querySelectorAll('[data-cantidad]'))b.addEventListener('click',()=>repetir(Number(b.dataset.cantidad)));
  for(const b of document.querySelectorAll('[data-vista]'))b.addEventListener('click',()=>vista(b.dataset.vista));
  for(const nombre of ['texturas','musgo','wireframe','escala'])$(nombre).addEventListener('change',e=>opcion(nombre,e.target.checked));
  $('encuadrar').addEventListener('click',()=>{encuadrarEscena();limpiarMetricas();});

  function dibujar(){
    cuentaMuros={vista:0,sombra:0,triangulos:0};renderer.info.reset();
    const inicio=performance.now();renderer.render(scene,camara);const cpu=performance.now()-inicio,info=renderer.info.render;
    ultimo={cpu,llamadas:info.calls,triangulos:info.triangles,lineas:info.lines,murosVista:cuentaMuros.vista,murosSombra:cuentaMuros.sombra,triangulosMurosPases:cuentaMuros.triangulos};
    return {...ultimo};
  }
  function pintarHUD(){
    $('metPiezas').textContent=formatear(piezasActivas);$('metLotes').textContent=`${muros.children.length} ${muros.children.length===1?'lote':'lotes'} · ${piezasActivas?'1 material':'0 materiales'} de muros`;
    $('metTriangulos').textContent=formatear(geometriaActiva);$('metMuros').textContent=formatear(ultimo.murosVista+ultimo.murosSombra);
    $('metPasesMuros').textContent=`${ultimo.murosVista} vista + ${ultimo.murosSombra} sombras`;
    $('metEscena').textContent=`${ultimo.llamadas} envíos`;
    $('metPasesEscena').textContent=`${formatear(ultimo.triangulos)} tri. en todos los pases${ultimo.lineas?' · '+formatear(ultimo.lineas)+' líneas':''}`;
    $('metCPU').textContent=ms(percentil(muestrasVivas.map(m=>m.cpu),.95));$('metRAF').textContent=ms(percentil(muestrasVivas.map(m=>m.raf),.95));
    $('metMuestras').textContent=estabilizar?'Estabilizando la escena':`${muestrasVivas.length} muestras recientes · sin tiempo GPU`;
  }
  function resumen(muestras){
    const cpu=muestras.map(m=>m.cpu),raf=muestras.map(m=>m.raf),media=lista=>lista.reduce((s,n)=>s+n,0)/lista.length;
    return {cantidad:configuracion.cantidad,modulo:configuracion.modulo,piezas:piezasActivas,lotes:muros.children.length,triangulosMuros:geometriaActiva,
      llamadas:ultimo.llamadas,triangulosEscena:ultimo.triangulos,llamadasMuros:ultimo.murosVista+ultimo.murosSombra,llamadasMurosVista:ultimo.murosVista,llamadasMurosSombra:ultimo.murosSombra,
      muestras:muestras.length,cpu:{media:media(cpu),p50:percentil(cpu,.5),p95:percentil(cpu,.95)},raf:{media:media(raf),p50:percentil(raf,.5),p95:percentil(raf,.95)},
      resolucion:[renderer.domElement.width,renderer.domElement.height],dpr:renderer.getPixelRatio(),material:{texturas:configuracion.texturas,musgo:configuracion.musgo,wireframe:configuracion.wireframe},
      nota:'CPU mide renderer.render (envío); rAF mide intervalos entre callbacks. No se mide tiempo de GPU.'};
  }
  function bloquear(valor){for(const el of document.querySelectorAll('button,input'))el.disabled=valor;}
  function medir({calentamiento=90,muestras=180}={}){
    if(medicion)return Promise.reject(new Error('Ya hay una medición en curso.'));
    if(!listo)return Promise.reject(new Error('Los materiales todavía no están preparados.'));
    if(document.hidden)return Promise.reject(new Error('Mantén visible la pestaña durante la medición.'));
    const espera=Math.max(1,Math.min(600,Math.round(calentamiento)||90)),cantidad=Math.max(30,Math.min(1800,Math.round(muestras)||180));
    bloquear(true);
    return new Promise((resolve,reject)=>{medicion={calentamiento:espera,cantidad,muestras:[],resolve,reject};});
  }
  function cancelarMedicion(motivo){if(!medicion)return;const pendiente=medicion;medicion=null;if(!comparando)bloquear(false);pendiente.reject(new Error(motivo));}
  document.addEventListener('visibilitychange',()=>{anterior=0;limpiarMetricas();if(document.hidden)cancelarMedicion('Medición interrumpida: la pestaña dejó de estar visible.');});
  function pintarResultados(lista){
    const tbody=$('resultados');tbody.replaceChildren();
    for(const dato of lista){const tr=document.createElement('tr');if(!dato.cantidad)tr.dataset.baseline='';
      const valores=[dato.cantidad===0?'0 · base':String(dato.cantidad),formatear(dato.piezas),formatear(dato.triangulosMuros),String(dato.llamadas),ms(dato.cpu.p95),ms(dato.raf.p95)];
      for(const valor of valores){const td=document.createElement('td');td.textContent=valor;tr.append(td);}tbody.append(tr);}
  }
  async function comparar(opciones={}){
    if(comparando||medicion)throw new Error('Ya hay una medición en curso.');
    if(!listo)throw new Error('Los materiales todavía no están preparados.');
    comparando=true;bloquear(true);punteros.clear();gesto=null;
    const guardado={configuracion:{...configuracion},orbita:{...orbita,objetivo:orbita.objetivo.clone()}},resultados=[];
    try{
      // Fijar cámara y frustum de sombras con la carga máxima antes de quitar
      // las instancias. La escena vacía conserva exactamente ese mismo estudio.
      configuracion.cantidad=100;configuracion.escala=false;configuracion.vista='isometrica';reconstruir();
      for(const cantidad of [0,1,30,100]){
        configuracion.cantidad=cantidad;reconstruir({encuadrar:false,sombra:false});
        estado(`Midiendo ${cantidad} ${cantidad===1?'repetición':'repeticiones'}: estabilización y muestras de CPU/rAF…`);$('comparar').textContent=`Midiendo ${cantidad}…`;
        resultados.push(await medir(opciones));pintarResultados(resultados);
      }
      const base=resultados[0];for(const resultado of resultados)resultado.deltaCpuP95=resultado.cpu.p95-base.cpu.p95;
      resultadoComparacion={fecha:new Date().toISOString(),resultados,encuadreFijo:true,sombrasFijas:true,referenciaEscala:false};
      $('notaMedicion').textContent=`${resultados[0].muestras} muestras por caso · ${base.resolucion.join(' × ')} px · encuadre y sombras fijos. CPU es envío, no GPU; rAF incluye la espera del navegador.`;
      estado('Comparación terminada. Se ha restaurado la selección anterior.');return resultadoComparacion;
    }finally{
      Object.assign(configuracion,guardado.configuracion);reconstruir();Object.assign(orbita,guardado.orbita);orbita.objetivo=guardado.orbita.objetivo;actualizarCamara();
      comparando=false;bloquear(false);$('comparar').textContent='Comparar 0 / 1 / 30 / 100 →';
    }
  }
  $('comparar').addEventListener('click',()=>comparar().catch(e=>estado(e.message)));
  function cuadro(ahora){
    requestAnimationFrame(cuadro);if(document.hidden)return;
    const raf=anterior?ahora-anterior:0;anterior=ahora;dibujar();
    if(raf>0){
      if(estabilizar>0)estabilizar--;else{muestrasVivas.push({cpu:ultimo.cpu,raf});if(muestrasVivas.length>360)muestrasVivas.shift();}
      if(medicion){
        if(medicion.calentamiento>0)medicion.calentamiento--;
        else{medicion.muestras.push({cpu:ultimo.cpu,raf});if(medicion.muestras.length>=medicion.cantidad){const fin=medicion;medicion=null;if(!comparando)bloquear(false);fin.resolve(resumen(fin.muestras));}}
      }
    }
    if(ahora-ultimoHUD>500){pintarHUD();ultimoHUD=ahora;}
  }
  function redimensionar(){
    const estabaMidiendo=Boolean(medicion)||comparando;
    if(medicion)cancelarMedicion('Medición interrumpida: cambió el tamaño del visor.');
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(Math.max(1,contenedor.clientWidth),Math.max(1,contenedor.clientHeight),false);
    if(estabaMidiendo)actualizarCamara();else encuadrarEscena();
    limpiarMetricas();
  }
  const observador=new ResizeObserver(redimensionar);observador.observe(contenedor);
  for(const modulo of mapaModulos.values()){
    const ficha=document.createElement('article'),titulo=document.createElement('h3'),dimensiones=document.createElement('p'),triangulos=document.createElement('p');
    const descarga=document.createElement('a');descarga.href='./ruinas-kiln/glb/'+modulo.id+'.glb';descarga.download=modulo.id+'.glb';descarga.textContent='Descargar GLB ↗';
    titulo.textContent=modulo.nombre;dimensiones.textContent=modulo.dimensiones.map(n=>n.toLocaleString('es-ES',{maximumFractionDigits:2})).join(' × ')+' m';triangulos.textContent=formatear(modulo.triangulos)+' triángulos';ficha.append(titulo,dimensiones,triangulos,descarga);$('fichas').append(ficha);
  }
  if(['recto','esquina','remate','conjunto'].includes(q.get('modulo')))configuracion.modulo=q.get('modulo');
  if(q.has('cantidad')&&[0,1,30,100].includes(Number(q.get('cantidad'))))configuracion.cantidad=Number(q.get('cantidad'));
  if(q.get('vista')==='libre')configuracion.vista='libre';
  reconstruir();redimensionar();requestAnimationFrame(cuadro);
  const cargador=new T.TextureLoader();
  const materialesListos=Promise.allSettled(['color','normal','superficie'].map(async nombre=>{
    const t=await cargador.loadAsync('./bosque-scenario/roca-'+nombre+'.webp');t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(nombre==='color')t.colorSpace=T.SRGBColorSpace;texturas[nombre]=t;
    if(nombre==='normal'){const piso=t.clone();piso.repeat.set(150,150);piso.needsUpdate=true;sueloMaterial.normalMap=piso;sueloMaterial.needsUpdate=true;}
  })).then(resultados=>{
    aplicarMaterial();listo=true;
    $('carga').replaceChildren();const punto=document.createElement('i');$('carga').append(punto,document.createTextNode(resultados.every(r=>r.status==='fulfilled')?'Recurso local · listo':'Material incompleto'));
    estado(resultados.every(r=>r.status==='fulfilled')?'Módulos y materiales locales preparados. Elige una pieza o explora el conjunto.':'No se pudo cargar alguna textura. La geometría está disponible, con material de respaldo.');
  });
  const proteger=fn=>(...args)=>{if(comparando||medicion)throw new Error('Espera a que termine la medición.');return fn(...args);};
  window.CAOZ_KILN_REVISION=Object.freeze({
    listo:()=>listo,materialesListos,
    estado:()=>({listo,configuracion:{...configuracion},piezas:piezasActivas,lotes:muros.children.length,materialesMuros:piezasActivas?1:0,triangulosMuros:geometriaActiva,
      render:{...ultimo},modulos:[...mapaModulos.values()].map(m=>({id:m.id,nombre:m.nombre,triangulos:m.triangulos,dimensiones:m.dimensiones})),
      resolucion:[canvas.width,canvas.height],versionThree:T.REVISION,midiendo:Boolean(medicion)||comparando,comparacion:resultadoComparacion}),
    seleccionar:proteger(seleccionar),repetir:proteger(repetir),vista:proteger(vista),opcion:proteger(opcion),encuadrar:proteger(encuadrarEscena),dibujar:proteger(dibujar),medir,comparar,
  });
})();

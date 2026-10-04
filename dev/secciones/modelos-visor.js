/* Visor de los modelos del ARPG (arpg-three-modelos.js): un personaje solo en un pedestal, con sus
   animaciones en bucle. Arrastrar gira la cámara alrededor, la rueda (o pellizcar) acerca, y
   «Cara» / «Cuerpo» encuadran. ?tipo=adreida&anim=tajoA elige al abrir. */
'use strict';
(function(){
  const {THREE}=window.CAOZ_THREE,F=CAOZ_ARPG_MODELOS.fabrica(THREE),$=id=>document.getElementById(id),q=new URLSearchParams(location.search);
  // Animaciones: nombre, duración de un ciclo (s) y para quién tiene sentido.
  const ANIMS=[['quieto',2.8],['giro180',.46,'adreida','Giro de 180° · Great Sword'],['andar',1.1],['recogerLlave',1.8,'adreida','Recoger la llave'],['mirarLlave',2,'adreida','Examinar la llave'],['rodar',F.animacion.roll.duracion+.6,'adreida','Roll evasivo · Entrada del Troll',{roll:true,duracion:F.animacion.roll.duracion}],['tajoA',.6,'adreida','Básico 1 · Great Sword Slash'],['revesA',.6,'adreida','Básico 2 · Great Sword Slash'],['estocadaA',.8,'adreida','Básico 3 · Great Sword Slash'],['torbellino',1],['salto',1.3],['parry',.8],
    ['golpe',1.1],['reves',1.1],['estocada',1.3],['aviso',1],['esquiva',.7],['grito',1.2],['lanzar',1.1],['apunta',1.2],['disparar',.5,'mohamed'],['acrobacia',1,'mohamed'],
    ['cargaMazazo',1.5,'troll'],['mazazo',1.4,'troll'],['aturdido',2],['dolor',.5],['muerte',2],
    ...F.animacion.muertes.map(p=>['muerte-adreida-'+(p.variante+1),p.duracion+.7,'adreida','Muerte de Adreida · '+p.nombre,{...p,adreida:true,distancia:0}]),
    ...F.muertesGoblinImportadas.map((p,i)=>['muerte-goblin-'+(i+1),p.duracion+.8,'goblins',p.nombre,F.crearMuerteGoblin('tajo',i)])];
  const lienzo=$('lienzo'),render=new THREE.WebGLRenderer({canvas:lienzo,antialias:true});
  render.setPixelRatio(Math.min(2,devicePixelRatio));render.outputColorSpace=THREE.SRGBColorSpace;render.toneMapping=THREE.AgXToneMapping;render.toneMappingExposure=1.1;
  render.shadowMap.enabled=true;render.shadowMap.type=THREE.PCFShadowMap;
  const escena=new THREE.Scene();escena.background=new THREE.Color(0x1d2230);
  escena.add(new THREE.HemisphereLight(0xdde8ff,0x3a3028,1.4));
  const sol=new THREE.DirectionalLight(0xfff0dd,2.8);sol.position.set(3,6,4);sol.castShadow=true;sol.shadow.mapSize.set(2048,2048);sol.shadow.bias=-.0004;sol.shadow.normalBias=.025;
  Object.assign(sol.shadow.camera,{left:-3,right:3,top:4,bottom:-1,near:.5,far:20});escena.add(sol);
  const contra=new THREE.DirectionalLight(0x9fc0ff,1.2);contra.position.set(-4,3,-5);escena.add(contra);
  const suelo=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.3,.12,48),new THREE.MeshStandardMaterial({color:0x5b5650,roughness:.9}));
  suelo.position.y=-.06;suelo.receiveShadow=true;escena.add(suelo);
  // Referencias fijas del suelo para apreciar el recorrido; el polvo usa el emisor real del combate.
  const cuadricula=new THREE.GridHelper(7,14,0x77716a,0x77716a);cuadricula.position.y=.004;cuadricula.material.transparent=true;cuadricula.material.opacity=.18;escena.add(cuadricula);
  const maxPolvo=64,posPolvo=new Float32Array(maxPolvo*3),tamPolvo=new Float32Array(maxPolvo),alfaPolvo=new Float32Array(maxPolvo),geoPolvo=new THREE.BufferGeometry();
  geoPolvo.setAttribute('position',new THREE.BufferAttribute(posPolvo,3));geoPolvo.setAttribute('tamano',new THREE.BufferAttribute(tamPolvo,1));geoPolvo.setAttribute('alfa',new THREE.BufferAttribute(alfaPolvo,1));
  const nubePolvo=new THREE.Points(geoPolvo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'attribute float tamano;attribute float alfa;varying float opacidad;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=tamano*45./(-p.z);opacidad=alfa;}',
    fragmentShader:'varying float opacidad;void main(){float a=1.-smoothstep(.04,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.6,.52,.39,a*opacidad*.52);}'}));
  nubePolvo.frustumCulled=false;escena.add(nubePolvo);let particulasVista=[];
  function prepararPolvo(muerte){particulasVista=[];cuadricula.visible=!!muerte;if(!muerte||muerte.adreida||muerte.roll)return;
    const eventos=muerte.contactos.map((k,i)=>({k,fuerza:muerte.fuerza*(i ? .45 : 1),roce:false})),r=muerte.rodada;
    if(r)for(let d=muerte.distancia*.2+.4;d<=muerte.distancia;d+=.4){let a=r.inicio,b=r.fin;for(let i=0;i<24;i++){const c=(a+b)/2;if(F.recorridoMuerteGoblin(muerte,c)<d)a=c;else b=c;}eventos.push({k:(a+b)/2,fuerza:muerte.fuerza,roce:true});}
    let semilla=17;const azar=()=>((semilla=semilla*16807%2147483647)-1)/2147483646;
    for(const e of eventos){const p=muerte.importada?F.desplazamientoMuerteGoblin(modelo,muerte,e.k,new THREE.Vector3()):{x:0,z:-F.recorridoMuerteGoblin(muerte,e.k)};F.emitirPolvoMuerte(p,e.fuerza,{x:0,z:-1},(...p)=>particulasVista.push({t:e.k*muerte.duracion,p}),azar,e.roce);}
  }
  function dibujarPolvo(t){let n=0;for(const {t:inicio,p}of particulasVista){const edad=t-inicio;if(edad<0||edad>p[6]||n>=maxPolvo)continue;const fr=(1-Math.exp(-1.6*edad))/1.6;
    posPolvo[n*3]=p[0]+p[3]*fr;posPolvo[n*3+1]=Math.max(.03,p[1]+p[4]*edad-p[11]*edad*edad/2);posPolvo[n*3+2]=p[2]+p[5]*fr;tamPolvo[n]=p[7];alfaPolvo[n]=1-edad/p[6];n++;}
    geoPolvo.setDrawRange(0,n);for(const a of Object.values(geoPolvo.attributes))a.needsUpdate=true;
  }
  const camara=new THREE.PerspectiveCamera(32,1,.05,100);
  // Cámara orbital: ángulo, elevación, distancia y altura del punto mirado.
  const vista={az:.35,el:.12,dist:4.6,alto:1.05,cx:0,cz:0},meta={...vista};
  const encuadres={cara:m=>({dist:1.55,alto:m.alto*.86,el:.06}),cuerpo:m=>({dist:m.alto*2.35,alto:m.alto*.54,el:.12})};
  let verMano=q.get('detalle')==='mano',verPiernas=q.get('detalle')==='piernas';const puntoMano=new THREE.Vector3();
  let modelo=null,modelos=[],t=0,pausa=false,girar=false,comparar=q.get('comparar')==='1';
  let tipoVariantes=null,hachaVista=null,datosPersonaje='',verHacha=q.get('arma')==='hacha';
  for(const k of Object.keys(F.TIPOS)){const o=document.createElement('option');o.value=k;o.textContent=F.TIPOS[k].nombre;$('tipo').append(o);}
  function listaAnims(){const tipo=$('tipo').value,antes=$('anim').value;$('anim').innerHTML='';
    for(const [n,,solo,etiqueta] of ANIMS){if(solo&&(solo==='goblins'?!['goblin','cobrador','kobold'].includes(tipo):solo!==tipo))continue;if(tipo==='adreida'&&['golpe','reves','estocada','muerte'].includes(n)||['goblin','cobrador','kobold'].includes(tipo)&&n==='muerte')continue;const o=document.createElement('option');o.value=n;o.textContent=etiqueta||n;$('anim').append(o);}
    if([...$('anim').options].some(o=>o.value===antes))$('anim').value=antes;}
  function cargar(tipo){
    for(const m of modelos){escena.remove(m.raiz);m.mallas.forEach(mesh=>{if(!mesh.geometry.userData.compartida)mesh.geometry.dispose();mesh.material.dispose();});for(const s of new Set(m.mallas.map(mesh=>mesh.skeleton)))s.dispose();}
    const catálogo=tipo==='kobold'?F.VARIANTES_KOBOLD:F.VARIANTES_GOBLIN;
    if(tipoVariantes!==tipo){$('varianteGoblin').replaceChildren();for(const [id,v]of Object.entries(catálogo)){const o=document.createElement('option');o.value=id;o.textContent=v.nombre;$('varianteGoblin').append(o);}
      if(!tipoVariantes&&catálogo[q.get('variante')])$('varianteGoblin').value=q.get('variante');tipoVariantes=tipo;
    }
    if(tipo!=='adreida'){verHacha=false;verMano=false;verPiernas=false;}
    const esGoblin=['goblin','cobrador','kobold'].includes(tipo);if(!esGoblin)comparar=false;document.body.classList.toggle('mvComparando',comparar);
    $('opcionVariante').hidden=$('compararGoblins').hidden=!esGoblin;
    $('compararGoblins').setAttribute('aria-pressed',comparar);$('compararGoblins').textContent=comparar?'Ver una variante':'Ver las cuatro variantes';
    $('cara').disabled=comparar;
    const variantes=comparar?Object.keys(catálogo):[$('varianteGoblin').value];
    modelos=variantes.map(varianteGoblin=>F.crear(tipo,{varianteGoblin,varianteKobold:varianteGoblin}));modelo=modelos[0];
    for(const m of modelos)escena.add(m.raiz);
    $('hacha').hidden=!modelo.hachaScenario;$('mano').hidden=$('piernas').hidden=tipo!=='adreida';
    if(!modelo.hachaScenario)verHacha=false;
    if(modelo.hachaScenario&&!hachaVista){hachaVista=F.crearHachaAdreida(modelo);hachaVista.setRotationFromMatrix(new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));hachaVista.position.y=.88;escena.add(hachaVista);}
    const tri=modelos.reduce((n,m)=>n+m.mallas.reduce((s,mesh)=>s+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3,0),0);
    $('datos').textContent=(comparar?'Cuatro variantes · tamaño relativo real':modelo.nombre+(esGoblin?' · '+catálogo[modelo.varianteKobold||modelo.varianteGoblin].nombre:'')+' · '+modelo.alto.toFixed(2)+' m')+' · '+(tri/1000).toFixed(1)+' mil triángulos · '+modelos.reduce((n,m)=>n+m.mallas.length,0)+' mallas';
    datosPersonaje=$('datos').textContent;
    $('fichasVariantes').hidden=!comparar;$('fichasVariantes').replaceChildren();
    if(comparar)for(const m of modelos){const v=catálogo[m.varianteKobold||m.varianteGoblin],ficha=document.createElement('div'),nombre=document.createElement('b'),detalle=document.createElement('small');nombre.textContent=v.nombre;detalle.textContent=(v.detalle||v.sombrero)+' · '+m.alto.toFixed(2)+' m';ficha.append(nombre,detalle);$('fichasVariantes').append(ficha);}
    listaAnims();}
  $('tipo').value=F.TIPOS[q.get('tipo')]?q.get('tipo'):'adreida';cargar($('tipo').value);
  const animInicial=q.get('anim')==='muerte-fbx'?'muerte-goblin-1':q.get('anim');
  if([...$('anim').options].some(o=>o.value===animInicial))$('anim').value=animInicial;
  $('tipo').addEventListener('change',()=>{cargar($('tipo').value);t=0;encuadrarAnimacion();});
  $('varianteGoblin').addEventListener('change',()=>{comparar=false;cargar($('tipo').value);t=0;encuadrarAnimacion();});
  $('compararGoblins').addEventListener('click',()=>{comparar=!comparar;cargar($('tipo').value);t=0;encuadrarAnimacion();});
  $('anim').addEventListener('change',()=>{t=0;encuadrarAnimacion();});
  const actual=()=>{const a=ANIMS.find(a=>a[0]===$('anim').value)||ANIMS[0];
    // Mostrar la carrera a la cadencia real del juego: distancia por ciclo / 5,8 m/s.
    if(modelo.tipo==='adreida'){
      if(a[0]==='andar')return [a[0],F.animacion.longitudZancada(1)/5.8];
      const duracion={tajoA:.6,revesA:.6,estocadaA:.8,parry:.35}[a[0]];
      if(duracion)return [a[0],duracion,...a.slice(2)];
    }return a;};
  function encuadrarAnimacion(){
    $('hacha').setAttribute('aria-pressed',verHacha);$('hacha').textContent=verHacha?'Ver a Adreida':'Ver hacha';
    $('anim').disabled=verHacha;$('cara').disabled=verHacha||comparar;
    $('datos').textContent=verHacha?'Hacha de Adreida · 1,63 m · '+(modelo.hachaScenario.geometry.index.count/3).toLocaleString('es')+' triángulos · 1 malla':datosPersonaje;
    if(hachaVista)hachaVista.visible=verHacha;for(const m of modelos)m.raiz.visible=!verHacha;
    if(verHacha){Object.assign(meta,{dist:3.8,alto:.84,el:.05,az:.12,cx:0,cz:0});suelo.position.z=0;suelo.scale.set(1,1,1);prepararPolvo(null);return;}
    const muerte=actual()[4],fin=muerte?.roll?F.animacion.desplazamientoRoll(1,new THREE.Vector3()):muerte?.importada?F.desplazamientoMuerteGoblin(modelo,muerte,1,new THREE.Vector3()):null;meta.cx=comparar?0:(fin?.x||0)*.5;meta.cz=comparar?0:fin?fin.z*.5:-(muerte?.distancia||0)*.5;Object.assign(meta,comparar?{dist:6.4,alto:.7,el:.15,az:0}:muerte?.roll?{dist:7.7,alto:.7,el:.4,az:1.1}:muerte?.importada?{dist:3.7,alto:.45,el:.4,az:.7}:muerte?{dist:4.8,alto:.35,el:.4,az:1.1}:encuadres.cuerpo(modelo));suelo.position.z=muerte?.roll?2.5:0;suelo.scale.set(comparar?1.35:muerte?.roll?2.1:muerte?1.8:1,1,comparar?1:muerte?.roll?2.1:muerte?1.8:1);prepararPolvo(comparar?null:muerte);if(verMano)Object.assign(meta,{dist:.62,el:.1});if(verPiernas)Object.assign(meta,{dist:2.05,alto:.53,el:.02,cx:0,cz:0});}

  encuadrarAnimacion();
  $('repetir').addEventListener('click',()=>{t=0;pausa=false;$('pausa').textContent='Pausa';});
  $('faseAnim').addEventListener('input',()=>{t=+$('faseAnim').value*(actual()[1]-.00001);pausa=true;$('pausa').textContent='Seguir';});
  $('pausa').addEventListener('click',()=>{pausa=!pausa;$('pausa').textContent=pausa?'Seguir':'Pausa';});
  $('girar').addEventListener('click',()=>{girar=!girar;$('girar').setAttribute('aria-pressed',girar);});
  $('cara').addEventListener('click',()=>{verMano=false;verPiernas=false;Object.assign(meta,encuadres.cara(modelo),{az:0,cx:0,cz:0});});
  $('mano').addEventListener('click',()=>{verMano=true;verPiernas=false;verHacha=false;encuadrarAnimacion();});
  $('piernas').addEventListener('click',()=>{verMano=false;verPiernas=true;verHacha=false;encuadrarAnimacion();});
  $('cuerpo').addEventListener('click',()=>{verMano=false;verPiernas=false;verHacha=false;encuadrarAnimacion();});
  $('hacha').addEventListener('click',()=>{verMano=false;verPiernas=false;verHacha=!verHacha;encuadrarAnimacion();});
  // Arrastrar gira; dos dedos pellizcan; la rueda acerca.
  const punteros=new Map();let pellizco=0;
  lienzo.addEventListener('pointerdown',e=>{lienzo.setPointerCapture(e.pointerId);punteros.set(e.pointerId,[e.clientX,e.clientY]);});
  lienzo.addEventListener('pointermove',e=>{if(!punteros.has(e.pointerId))return;const [x0,y0]=punteros.get(e.pointerId);punteros.set(e.pointerId,[e.clientX,e.clientY]);
    if(punteros.size===2){const [a,b]=[...punteros.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pellizco)meta.dist=Math.min(9,Math.max(.5,meta.dist*pellizco/d));pellizco=d;return;}
    meta.az-=(e.clientX-x0)*.008;meta.el=Math.min(1.3,Math.max(-.3,meta.el+(e.clientY-y0)*.006));});
  const soltar=e=>{punteros.delete(e.pointerId);pellizco=0;};lienzo.addEventListener('pointerup',soltar);lienzo.addEventListener('pointercancel',soltar);
  lienzo.addEventListener('wheel',e=>{e.preventDefault();meta.dist=Math.min(9,Math.max(.5,meta.dist*Math.exp(e.deltaY*.0012)));},{passive:false});
  function tamano(){const w=innerWidth,h=innerHeight;render.setSize(w,h,false);camara.aspect=w/h;camara.updateProjectionMatrix();}
  addEventListener('resize',tamano);tamano();
  let antes=performance.now();
  function cuadro(ahora){const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;
    if(!pausa)t+=dt*+$('vel').value;if(girar)meta.az+=dt*.4;
    for(const k in vista)vista[k]+=(meta[k]-vista[k])*Math.min(1,dt*8);
    const [nombre,dur,,,muerte]=actual(),fase=(t%dur)/dur,k=muerte?Math.min(1,(t%dur)/muerte.duracion):fase;
    $('faseAnim').value=fase;
    for(const [i,m]of modelos.entries()){
      m.raiz.rotation.y=nombre==='giro180'?-Math.PI*F.animacion.avanceGiro(k):0;
      m.raiz.position.set(comparar?(i-1.5)*1.15:0,0,muerte&&!muerte.roll&&!muerte.adreida&&!muerte.importada?-F.recorridoMuerteGoblin(muerte,k):0);
      F.posar(m,{anim:muerte?.roll?'rodar':muerte?'muerte':nombre,muerte,t,k,fase:nombre==='andar'?fase*Math.PI*2:t*TAU_PASO,paso:1});
    }
    if(verMano){modelo.raiz.updateMatrixWorld(true);modelo.H.manoD.getWorldPosition(puntoMano);meta.cx=vista.cx=puntoMano.x;meta.alto=vista.alto=puntoMano.y;meta.cz=vista.cz=puntoMano.z;}
    dibujarPolvo(t%dur);const c=Math.cos(vista.el);camara.position.set(vista.cx+Math.sin(vista.az)*c*vista.dist,vista.alto+Math.sin(vista.el)*vista.dist,vista.cz+Math.cos(vista.az)*c*vista.dist);camara.lookAt(vista.cx,vista.alto,vista.cz);
    render.render(escena,camara);requestAnimationFrame(cuadro);}
  const TAU_PASO=Math.PI*2/1.1;
  requestAnimationFrame(cuadro);
})();

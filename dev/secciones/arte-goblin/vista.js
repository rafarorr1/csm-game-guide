/* Localizador UV: la misma pieza y el mismo punto en el modelo y en el lienzo. */
'use strict';
(async()=>{
 const $=id=>document.getElementById(id),THREE=window.CAOZ_THREE.THREE,MOD=window.CAOZ_ARPG_MODELOS.fabrica(THREE),canvas=$('modelo'),detalle=$('detalle');
 try{
  const atlas=await (await fetch('goblin-uv.json')).json(),escena=new THREE.Scene();escena.background=new THREE.Color(0x192428);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const camara=new THREE.OrthographicCamera(-1,1,1,-1,.01,30),V=THREE.Vector3;
  escena.add(new THREE.HemisphereLight(0xe7f4ff,0x716253,2.2));const sol=new THREE.DirectionalLight(0xffe3ba,3);sol.position.set(-2,4,4);escena.add(sol);const relleno=new THREE.DirectionalLight(0xaecbed,1.5);relleno.position.set(3,2,-2);escena.add(relleno);
  const piso=new THREE.Mesh(new THREE.CircleGeometry(2.4,64),new THREE.MeshStandardMaterial({color:0x253337,roughness:1}));piso.rotation.x=-Math.PI/2;piso.position.y=-.065;escena.add(piso);
  const punto=new THREE.Mesh(new THREE.SphereGeometry(.015,12,8),new THREE.MeshBasicMaterial({color:0x66e9ff,depthTest:false,depthWrite:false}));punto.renderOrder=10;punto.visible=false;escena.add(punto);
  const modelos=Array.from({length:3},()=>MOD.crear('goblin'));modelos.forEach(m=>escena.add(m.raiz));let textura=null,cargada=0,t=0,elegida=null,localizacion=null,recorte=null;
  const uPieza={value:new THREE.Vector4()},uElegir={value:1},uAislar={value:0},ray=new THREE.Raycaster(),cursor=new THREE.Vector2(),caja=new THREE.Box3(),centro=new V(),tamano=new V();
  const piezaUV=(u,v)=>atlas.piezas.find(p=>{const [x,y,w,h]=p.celda;return u*atlas.tamano>=x&&u*atlas.tamano<x+w&&(1-v)*atlas.tamano>=y&&(1-v)*atlas.tamano<y+h;});
  function selectorShader(shader){
   Object.assign(shader.uniforms,{uPieza,uElegir,uAislar});
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 uPieza;uniform float uElegir,uAislar;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float seleccionada=step(uPieza.x,vMapUv.x)*step(uPieza.y,vMapUv.y)*step(vMapUv.x,uPieza.z)*step(vMapUv.y,uPieza.w);
if(uElegir>.5){if(uAislar>.5&&seleccionada<.5)discard;float gris=dot(outgoingLight,vec3(.2126,.7152,.0722));outgoingLight=mix(vec3(gris*.3),outgoingLight*.9+vec3(.32,.17,.02),seleccionada);}
#include <opaque_fragment>`);
  }
  for(const m of modelos)for(const mesh of m.mallas){
   const mat=Object.keys(m.M).find(k=>m.M[k]===mesh.material),datos=atlas.mallas.find(d=>d.material===mat),a=mesh.geometry.attributes.position.array;
   if(a.length/3!==datos.vertices)throw Error('Esta plantilla corresponde a otra versión del modelo.');
   const huella=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength))),x=>x.toString(16).padStart(2,'0')).join('');
   if(huella!==datos.huella)throw Error('La geometría cambió: usa el modelo incluido con la plantilla.');
   mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(datos.uv,2));mesh.geometry.attributes.color.array.fill(1);mesh.geometry.attributes.color.needsUpdate=true;
   mesh.userData.triangulos=new Map();const uv=mesh.geometry.attributes.uv;
   for(let i=0;i<uv.count;i+=3){const p=piezaUV((uv.getX(i)+uv.getX(i+1)+uv.getX(i+2))/3,(uv.getY(i)+uv.getY(i+1)+uv.getY(i+2))/3);if(!p)throw Error('Un triángulo no tiene pieza en el atlas.');if(!mesh.userData.triangulos.has(p.id))mesh.userData.triangulos.set(p.id,[]);mesh.userData.triangulos.get(p.id).push(i);}
   const material=mesh.material,original=material.onBeforeCompile;material.color.setHex(0xffffff);
   material.onBeforeCompile=function(shader,render){original.call(this,shader,render);shader.fragmentShader=shader.fragmentShader.replace('outgoingLight+=vColor.rgb*uBrillo;','outgoingLight+=diffuseColor.rgb*uBrillo;');selectorShader(shader);};
   material.customProgramCacheKey=()=> 'goblin-localizador-v2';mesh.userData.iluminado=material;mesh.userData.plano=new THREE.MeshBasicMaterial();mesh.userData.plano.onBeforeCompile=selectorShader;mesh.userData.plano.customProgramCacheKey=()=> 'goblin-localizador-plano-v2';
  }
  const guia=new Image();guia.src='goblin-orientacion.png';await guia.decode();
  function pintarDetalle(){
   if(!elegida||!textura)return;const g=detalle.getContext('2d'),W=detalle.width,H=detalle.height,[x,y,w,h]=elegida.celda;
   // La cabecera del atlas queda fuera: nombre y número se muestran como texto legible al lado.
   const sx=x+16,sy=y+64,sw=w-32,sh=h-80,k=Math.min((W-28)/sw,(H-28)/sh),dw=sw*k,dh=sh*k,dx=(W-dw)/2,dy=(H-dh)/2;
   recorte={sx,sy,sw,sh,k,dx,dy,dw,dh};g.fillStyle='#253039';g.fillRect(0,0,W,H);g.drawImage(textura.image,sx,sy,sw,sh,dx,dy,dw,dh);
   if($('guiaDetalle').checked)g.drawImage(guia,sx,sy,sw,sh,dx,dy,dw,dh);
   if(localizacion){const px=dx+(localizacion.uv.x*atlas.tamano-sx)*k,py=dy+((1-localizacion.uv.y)*atlas.tamano-sy)*k;g.strokeStyle='#66e9ff';g.lineWidth=3;g.beginPath();g.arc(px,py,10,0,Math.PI*2);g.moveTo(px-18,py);g.lineTo(px+18,py);g.moveTo(px,py-18);g.lineTo(px,py+18);g.stroke();}
  }
  function consejo(p){
   const lado=p.nombre.includes('izquierd')?' Es el lado izquierdo del goblin (a tu derecha al verlo de frente).':p.nombre.includes('derech')?' Es el lado derecho del goblin (a tu izquierda al verlo de frente).':'';
   if(p.nombre==='Cabeza')return 'Esta superficie envuelve la cabeza. Ojos, cejas, nariz, mandíbula y orejas se pintan en piezas separadas. Usa el punto azul para encontrar el rostro y la nuca.';
   if(p.nombre.includes('Oreja'))return 'Los triángulos forman la oreja; el pequeño polígono separado cierra su base.'+lado;
   if(p.nombre.includes('Ojo'))return 'Este desplegado envuelve el ojo. En el juego es una pieza pequeña y luminosa.'+lado;
   if(p.nombre.includes('Pañuelo'))return p.nombre.includes('espalda')?'Esta es la tela que cuelga detrás del cuello. Se ha girado el goblin para mostrarla.':'Esta banda rodea el cuello. Los polígonos separados son las tapas superior e inferior.';
   if(p.nombre.includes('Hoja'))return 'La cruz contiene las seis caras del metal del hacha. La vista de perfil deja ver su cara ancha.';
   if(p.nombre.includes('Bota')||p.nombre.includes('Mandíbula')||p.nombre.includes('Bolsa'))return 'La cruz se pliega para formar esta pieza: cada rectángulo es una cara. Activa las líneas para orientarte.'+lado;
   if(p.nombre.includes('Mango')||p.nombre.includes('Brazal')||p.nombre.includes('Cinturón')||p.nombre.includes('Puño'))return 'La banda envuelve la pieza; los polígonos separados cierran los extremos.'+lado;
   return 'El desplegado rodea esta pieza. Pasa el cursor por una zona para localizarla sobre el personaje.'+lado;
  }
  function seleccionar(id,girar=true){
   elegida=atlas.piezas.find(p=>p.id===id);if(!elegida)return;const [x,y,w,h]=elegida.celda,S=atlas.tamano;
   uPieza.value.set(x/S,1-(y+h)/S,(x+w)/S,1-y/S);uElegir.value=1;localizacion=null;punto.visible=false;
   $('pieza').value=id;$('nombrePieza').textContent=elegida.nombre;$('numeroPieza').textContent=id+' / 39';$('piezaModelo').textContent=id+' / '+elegida.nombre.toLocaleUpperCase('es');$('consejo').textContent=consejo(elegida);
   detalle.setAttribute('aria-label','Plantilla ampliada: '+elegida.nombre+'. Mueve el cursor para localizar un punto en 3D.');
   for(const b of $('seleccionMapa').children)b.setAttribute('aria-pressed',String(b.dataset.pieza===id));
   if(girar)$('giro').value=elegida.nombre.includes('espalda')?'180':elegida.nombre.includes('Hoja')?'90':'0';
   $('estado').textContent='Seleccionada · '+elegida.nombre+' · '+($('aislar').checked?'pieza aislada':'resaltada en dorado');pintarDetalle();
  }
  for(const p of atlas.piezas){
   const o=document.createElement('option');o.value=p.id;o.textContent=p.id+' · '+p.nombre;$('pieza').append(o);
   const b=document.createElement('button');b.type='button';b.dataset.pieza=p.id;b.setAttribute('aria-label',p.id+' · '+p.nombre);b.setAttribute('aria-pressed','false');b.title=p.id+' · '+p.nombre;b.onclick=()=>{seleccionar(p.id);document.querySelector('.columna3d').scrollIntoView({behavior:'smooth',block:'start'});};$('seleccionMapa').append(b);
  }
  $('pieza').onchange=()=>seleccionar($('pieza').value);
  for(const [id,paso] of [['anterior',-1],['siguiente',1]])$(id).onclick=()=>seleccionar(atlas.piezas[(atlas.piezas.indexOf(elegida)+paso+atlas.piezas.length)%atlas.piezas.length].id);
  $('guiaDetalle').onchange=pintarDetalle;
  // Coordenadas baricéntricas: no se aproxima al hueso, se localiza el triángulo exacto.
  function localizarUV(uv,mesh,i){
   const a=mesh.geometry.attributes.uv,ax=a.getX(i),ay=a.getY(i),bx=a.getX(i+1),by=a.getY(i+1),cx=a.getX(i+2),cy=a.getY(i+2),d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(d)<1e-12)return null;
   const u=((by-cy)*(uv.x-cx)+(cx-bx)*(uv.y-cy))/d,v=((cy-ay)*(uv.x-cx)+(ax-cx)*(uv.y-cy))/d,w=1-u-v;
   return Math.min(u,v,w)>=-1e-6?{mesh,i,pesos:[u,v,w],uv}:null;
  }
  detalle.addEventListener('pointermove',e=>{
   if(!recorte||!elegida)return;const r=detalle.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*detalle.width,py=(e.clientY-r.top)/r.height*detalle.height,c=recorte;
   const uv=new THREE.Vector2((c.sx+(px-c.dx)/c.k)/atlas.tamano,1-(c.sy+(py-c.dy)/c.k)/atlas.tamano);localizacion=null;
   if(px>=c.dx&&px<=c.dx+c.dw&&py>=c.dy&&py<=c.dy+c.dh)for(const mesh of modelos[0].mallas){for(const i of mesh.userData.triangulos.get(elegida.id)||[]){const p=localizarUV(uv,mesh,i);if(p){localizacion=p;break;}}if(localizacion)break;}
   pintarDetalle();
  });
  detalle.addEventListener('pointerleave',()=>{localizacion=null;punto.visible=false;pintarDetalle();});
  canvas.addEventListener('pointerdown',e=>{
   const r=canvas.getBoundingClientRect();cursor.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(cursor,camara);
   const visibles=modelos.filter(m=>m.raiz.visible).flatMap(m=>m.mallas);for(const mesh of visibles)mesh.computeBoundingSphere();
   const hits=ray.intersectObjects(visibles,false),hit=hits.find(h=>h.uv&&(!$('aislar').checked||piezaUV(h.uv.x,h.uv.y)?.id===elegida?.id));if(!hit)return;
   const p=piezaUV(hit.uv.x,hit.uv.y);if(!p)return;seleccionar(p.id,false);localizacion=localizarUV(hit.uv,hit.object,hit.faceIndex*3);pintarDetalle();
  });
  async function aplicar(url,nombre){
   const turno=++cargada;let nueva=await new THREE.TextureLoader().loadAsync(url);if(turno!==cargada){nueva.dispose();return;}
   let imagen;try{imagen=window.CAOZ_GOBLIN_CUADERNO.extraer(nueva.image,()=>document.createElement('canvas'));}catch(e){nueva.dispose();throw e;}
   if(imagen!==nueva.image){nueva.dispose();nueva=new THREE.CanvasTexture(imagen);}
   nueva.colorSpace=THREE.SRGBColorSpace;nueva.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());const previa=textura;textura=nueva;
   for(const m of modelos)for(const mesh of m.mallas)for(const k of ['iluminado','plano']){mesh.userData[k].map=nueva;mesh.userData[k].needsUpdate=true;}
   previa?.dispose();$('estado').textContent='Textura aplicada · '+nombre+' · referencias separadas de la pintura';pintarDetalle();
  }
  $('archivo').onchange=async()=>{const f=$('archivo').files[0];if(!f)return;const url=URL.createObjectURL(f);try{await aplicar(url,f.name);}catch(e){$('estado').textContent=e.message;}finally{URL.revokeObjectURL(url);}};
  $('restablecer').onclick=()=>{aplicar('goblin-pintar.png','colores originales').catch(e=>$('estado').textContent=e.message);$('archivo').value='';};
  for(const b of document.querySelectorAll('[data-giro]'))b.onclick=()=>{$('giro').value=b.dataset.giro;};
  $('plano').onchange=()=>{for(const m of modelos)for(const mesh of m.mallas)mesh.material=mesh.userData[$('plano').checked?'plano':'iluminado'];};
  $('aislar').onchange=()=>{uAislar.value=$('aislar').checked?1:0;uElegir.value=1;if($('aislar').checked){$('enfocar').checked=true;$('referencias').checked=false;}$('estado').textContent='Seleccionada · '+elegida.nombre+' · '+($('aislar').checked?'pieza aislada':'resaltada en dorado');};
  $('enfocar').onchange=()=>{if($('enfocar').checked)$('referencias').checked=false;};
  $('referencias').onchange=()=>{if($('referencias').checked){$('enfocar').checked=false;$('aislar').checked=false;uAislar.value=0;}};
  $('sinSeleccion').onclick=()=>{uElegir.value=0;uAislar.value=0;$('enfocar').checked=$('aislar').checked=false;localizacion=null;punto.visible=false;$('estado').textContent='Pintura completa · sin resaltado';pintarDetalle();};
  function medir(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);}
  new ResizeObserver(medir).observe(canvas);
  function camaraActual(tres){
   const r=canvas.getBoundingClientRect(),ratio=r.width/r.height;let h=tres?Math.max(1.9,3.75/ratio):Math.max(1.75,1.15/ratio);
   if($('enfocar').checked&&elegida){caja.makeEmpty();for(const mesh of modelos[0].mallas)for(const i of mesh.userData.triangulos.get(elegida.id)||[])for(let k=0;k<3;k++)caja.expandByPoint(mesh.getVertexPosition(i+k,new V()).applyMatrix4(mesh.matrixWorld));
    caja.getCenter(centro);caja.getSize(tamano);h=Math.max(.18,1.7*Math.max(tamano.y,tamano.x/ratio,tamano.z*.3));camara.position.set(centro.x,centro.y+.045,centro.z+4);camara.lookAt(centro);
   }else{camara.position.set(0,1.05,4);camara.lookAt(0,.58,0);}
   camara.left=-h*ratio/2;camara.right=h*ratio/2;camara.top=h/2;camara.bottom=-h/2;camara.updateProjectionMatrix();punto.scale.setScalar(h/1.75);piso.visible=!$('aislar').checked;
  }
  await aplicar('goblin-pintar.png','colores originales');seleccionar('01');let antes=performance.now();
  renderer.setAnimationLoop(ahora=>{const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;t+=dt;const pose=$('pose').value,tres=$('referencias').checked;
   for(const [i,m] of modelos.entries()){m.raiz.visible=i===0||tres;if(!m.raiz.visible)continue;
    if(pose==='neutro'){for(const [n,b] of Object.entries(m.H)){b.rotation.set(0,0,0);if(n==='cuerpo')b.position.set(0,0,0);}}else MOD.posar(m,{anim:pose,k:pose==='aviso'?.55:(t%.85)/.85,t,fase:t*6,paso:pose==='andar'?1:0,dt,mezclar:false});
    m.raiz.position.x=tres?(i-1)*1.15:0;m.raiz.rotation.y=tres?[0,Math.PI/2,Math.PI][i]:Number($('giro').value)*Math.PI/180;m.raiz.updateMatrixWorld(true);
   }
   camaraActual(tres);punto.visible=!!localizacion;if(localizacion){const {mesh,i,pesos}=localizacion;punto.position.set(0,0,0);for(let j=0;j<3;j++)punto.position.addScaledVector(mesh.getVertexPosition(i+j,new V()).applyMatrix4(mesh.matrixWorld),pesos[j]);}
   renderer.render(escena,camara);
  });
 }catch(e){$('estado').textContent='No se pudo abrir el modelo: '+e.message;console.error(e);}
})();

/* Visor de los modelos del ARPG (arpg-three-modelos.js): un personaje solo en un pedestal, con sus
   animaciones en bucle. Arrastrar gira la cámara alrededor, la rueda (o pellizcar) acerca, y
   «Cara» / «Cuerpo» encuadran. ?tipo=adreida&anim=tajoA elige al abrir. */
'use strict';
(function(){
  const {THREE}=window.CAOZ_THREE,F=CAOZ_ARPG_MODELOS.fabrica(THREE),$=id=>document.getElementById(id),q=new URLSearchParams(location.search);
  // Animaciones: nombre, duración de un ciclo (s) y para quién tiene sentido.
  const ANIMS=[['quieto',2.8],['andar',1.1],['tajoA',1.1,'adreida'],['revesA',1.1,'adreida'],['estocadaA',1.4,'adreida'],['torbellino',1],['salto',1.3],['parry',.8],
    ['golpe',1.1],['reves',1.1],['estocada',1.3],['aviso',1],['esquiva',.7],['grito',1.2],['lanzar',1.1],['apunta',1.2],['disparar',.5,'mohamed'],['acrobacia',1,'mohamed'],
    ['cargaMazazo',1.5,'troll'],['mazazo',1.4,'troll'],['aturdido',2],['dolor',.5],['muerte',2]];
  const lienzo=$('lienzo'),render=new THREE.WebGLRenderer({canvas:lienzo,antialias:true});
  render.setPixelRatio(Math.min(2,devicePixelRatio));render.outputColorSpace=THREE.SRGBColorSpace;render.toneMapping=THREE.AgXToneMapping;render.toneMappingExposure=1.1;
  render.shadowMap.enabled=true;render.shadowMap.type=THREE.PCFSoftShadowMap;
  const escena=new THREE.Scene();escena.background=new THREE.Color(0x1d2230);
  escena.add(new THREE.HemisphereLight(0xdde8ff,0x3a3028,1.4));
  const sol=new THREE.DirectionalLight(0xfff0dd,2.8);sol.position.set(3,6,4);sol.castShadow=true;sol.shadow.mapSize.set(2048,2048);sol.shadow.bias=-.0004;sol.shadow.normalBias=.025;
  Object.assign(sol.shadow.camera,{left:-3,right:3,top:4,bottom:-1,near:.5,far:20});escena.add(sol);
  const contra=new THREE.DirectionalLight(0x9fc0ff,1.2);contra.position.set(-4,3,-5);escena.add(contra);
  const suelo=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.3,.12,48),new THREE.MeshStandardMaterial({color:0x5b5650,roughness:.9}));
  suelo.position.y=-.06;suelo.receiveShadow=true;escena.add(suelo);
  const camara=new THREE.PerspectiveCamera(32,1,.05,100);
  // Cámara orbital: ángulo, elevación, distancia y altura del punto mirado.
  const vista={az:.35,el:.12,dist:4.6,alto:1.05},meta={...vista};
  const encuadres={cara:m=>({dist:1.55,alto:m.alto*.86,el:.06}),cuerpo:m=>({dist:m.alto*2.35,alto:m.alto*.54,el:.12})};
  let modelo=null,t=0,pausa=false,girar=false;
  for(const k of Object.keys(F.TIPOS)){const o=document.createElement('option');o.value=k;o.textContent=F.TIPOS[k].nombre;$('tipo').append(o);}
  function listaAnims(){const tipo=$('tipo').value,antes=$('anim').value;$('anim').innerHTML='';
    for(const [n,,solo] of ANIMS){if(solo&&solo!==tipo)continue;if(tipo==='adreida'&&['golpe','reves','estocada'].includes(n))continue;const o=document.createElement('option');o.value=o.textContent=n;$('anim').append(o);}
    if([...$('anim').options].some(o=>o.value===antes))$('anim').value=antes;}
  function cargar(tipo){if(modelo){escena.remove(modelo.raiz);modelo.mallas.forEach(m=>{m.geometry.dispose();m.material.dispose();});}
    modelo=F.crear(tipo);escena.add(modelo.raiz);Object.assign(meta,encuadres.cuerpo(modelo));
    const tri=modelo.mallas.reduce((s,m)=>s+m.geometry.attributes.position.count/3,0);
    $('datos').textContent=modelo.nombre+' · '+modelo.alto.toFixed(2)+' m · '+(tri/1000).toFixed(1)+' mil triángulos · '+modelo.mallas.length+' mallas';
    listaAnims();}
  $('tipo').value=F.TIPOS[q.get('tipo')]?q.get('tipo'):'adreida';cargar($('tipo').value);
  if(q.get('anim'))$('anim').value=q.get('anim');
  $('tipo').addEventListener('change',()=>{cargar($('tipo').value);t=0;});
  $('anim').addEventListener('change',()=>{t=0;});
  $('pausa').addEventListener('click',()=>{pausa=!pausa;$('pausa').textContent=pausa?'Seguir':'Pausa';});
  $('girar').addEventListener('click',()=>{girar=!girar;$('girar').setAttribute('aria-pressed',girar);});
  $('cara').addEventListener('click',()=>Object.assign(meta,encuadres.cara(modelo),{az:0}));
  $('cuerpo').addEventListener('click',()=>Object.assign(meta,encuadres.cuerpo(modelo)));
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
    const [nombre,dur]=ANIMS.find(a=>a[0]===$('anim').value)||ANIMS[0],k=(t%dur)/dur;
    F.posar(modelo,{anim:nombre,t,k,fase:t*TAU_PASO,paso:1});
    const c=Math.cos(vista.el);camara.position.set(Math.sin(vista.az)*c*vista.dist,vista.alto+Math.sin(vista.el)*vista.dist,Math.cos(vista.az)*c*vista.dist);camara.lookAt(0,vista.alto,0);
    render.render(escena,camara);requestAnimationFrame(cuadro);}
  const TAU_PASO=Math.PI*2/1.1;
  requestAnimationFrame(cuadro);
})();

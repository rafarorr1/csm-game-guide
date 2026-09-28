/*
   Mesa Three de fondo para el juego original.

   Este archivo nunca lee una carta, no recibe clics, no hace raycast ni
   sustituye render()/ask()/roll(). El motor y el DOM de index.html son la
   partida; Three sólo pinta madera, tapete y luz debajo de sus zonas reales.
*/
'use strict';
(function(){
  const CONFIG=window.CAOZ_MESA_THREE_FONDO_CONFIG||{};
  let estado=null,inicioPendiente=false;

  const alinear=(camara,objetivo)=>camara.lookAt(objetivo);
  const limitar=(n,min,max)=>Math.max(min,Math.min(max,n));

  function lienzo(w,h){
    const nodo=document.createElement('canvas');nodo.width=w;nodo.height=h;
    return [nodo,nodo.getContext('2d')];
  }
  function semilla(inicial=1217){
    let n=inicial>>>0;
    return ()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  }
  function textura(THREE,renderer,nodo,repetir){
    const t=new THREE.CanvasTexture(nodo);t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(2,renderer.capabilities.getMaxAnisotropy());
    if(repetir){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repetir[0],repetir[1]);}
    return t;
  }
  function madera(THREE,renderer){
    const [c,g]=lienzo(1024,768),azar=semilla(932);const fondo=g.createLinearGradient(0,0,1024,768);
    fondo.addColorStop(0,'#160a07');fondo.addColorStop(.22,'#482215');fondo.addColorStop(.52,'#24100d');fondo.addColorStop(1,'#5d2b17');
    g.fillStyle=fondo;g.fillRect(0,0,1024,768);
    for(let i=0;i<340;i++){
      const y=azar()*768,onda=(azar()-.5)*22,claro=azar()>.48;
      g.beginPath();g.moveTo(-30,y);for(let x=0;x<1080;x+=28)g.lineTo(x,y+Math.sin(x*.014+i*.37)*onda+Math.sin(x*.043+i)*3);
      g.strokeStyle=claro?'rgba(214,132,70,.11)':'rgba(4,1,1,.20)';g.lineWidth=.45+azar()*2.6;g.stroke();
    }
    for(let i=0;i<12;i++){
      const x=azar()*1024,y=azar()*768;g.fillStyle='rgba(6,2,1,.32)';g.beginPath();g.ellipse(x,y,4+azar()*15,1+azar()*3,azar()*Math.PI,0,Math.PI*2);g.fill();
    }
    return textura(THREE,renderer,c,[1.45,1.15]);
  }
  function cuero(THREE,renderer){
    const [c,g]=lienzo(1024,704),azar=semilla(441);const grad=g.createRadialGradient(488,214,60,512,352,760);
    grad.addColorStop(0,'#413159');grad.addColorStop(.48,'#221832');grad.addColorStop(1,'#0d0816');g.fillStyle=grad;g.fillRect(0,0,1024,704);
    for(let i=0;i<5600;i++){
      const x=azar()*1024,y=azar()*704,a=.018+azar()*.052,r=.3+azar()*1.2;
      g.fillStyle=azar()>.5?'rgba(255,235,205,'+a+')':'rgba(0,0,0,'+a+')';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
    }
    const oro=g.createLinearGradient(0,0,0,704);oro.addColorStop(0,'#f6d78b');oro.addColorStop(.42,'#ad722b');oro.addColorStop(1,'#f3c875');
    g.strokeStyle=oro;g.lineWidth=8;g.beginPath();g.roundRect(22,22,980,660,34);g.stroke();
    g.strokeStyle='rgba(255,225,155,.43)';g.lineWidth=1.5;g.beginPath();g.roundRect(35,35,954,634,25);g.stroke();
    // Línea central y glifos: una referencia visual, no una zona interactiva.
    g.strokeStyle='rgba(239,186,93,.63)';g.lineWidth=3;g.beginPath();g.moveTo(98,352);g.lineTo(926,352);g.stroke();
    g.fillStyle='rgba(247,203,121,.72)';g.font='20px Georgia';g.textAlign='center';
    const runas='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖ';for(let i=0;i<runas.length;i++)g.fillText(runas[i],120+i*39,341);
    return textura(THREE,renderer,c);
  }
  function liberar(THREE,raiz){
    raiz.traverse(n=>{
      if(n.geometry)n.geometry.dispose?.();
      const lista=Array.isArray(n.material)?n.material:[n.material];
      for(const m of lista)if(m){for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])m[k]?.dispose?.();m.dispose?.();}
    });
  }
  function renderizar(){
    if(!estado||document.hidden)return;
    const {renderer,escena,camara}=estado;renderer.render(escena,camara);
  }
  function acomodar(){
    if(!estado)return;
    const {mat,renderer,camara}=estado,w=Math.max(1,Math.round(mat.clientWidth)),h=Math.max(1,Math.round(mat.clientHeight));
    renderer.setSize(w,h,false);camara.aspect=w/h;
    // En formatos muy anchos la cámara se aleja sólo lo necesario para mostrar
    // la madera de los laterales; el tapete conserva el mismo encuadre vertical.
    camara.position.set(0,9.7,limitar(11.8+(w/h-1.72)*1.4,10.6,14.8));camara.updateProjectionMatrix();
    alinear(camara,new estado.THREE.Vector3(0,0,0));renderizar();
  }
  function montar(){
    if(estado)return estado;
    const THREE=window.CAOZ_THREE?.THREE,mat=document.getElementById('mat');
    if(!THREE||!mat)return null;
    let renderer;
    try{
      const canvas=document.createElement('canvas');canvas.id='mesaThreeFondo';canvas.setAttribute('aria-hidden','true');
      canvas.style.pointerEvents='none';mat.insertBefore(canvas,mat.firstChild);
      renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.15));renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.04;
      const escena=new THREE.Scene();escena.background=new THREE.Color(0x08050d);escena.fog=new THREE.Fog(0x08050d,18,32);
      const camara=new THREE.PerspectiveCamera(37,1,.1,70);
      const grupo=new THREE.Group();escena.add(grupo);
      const mesa=new THREE.Mesh(new THREE.BoxGeometry(18.4,.58,13.2),new THREE.MeshStandardMaterial({map:madera(THREE,renderer),roughness:.48,metalness:.08}));
      mesa.position.y=-.37;grupo.add(mesa);
      const borde=new THREE.Mesh(new THREE.BoxGeometry(16.15,.15,10.72),new THREE.MeshStandardMaterial({color:0x8e6025,roughness:.34,metalness:.58}));
      borde.position.y=-.01;grupo.add(borde);
      const tapete=new THREE.Mesh(new THREE.BoxGeometry(15.86,.12,10.42),new THREE.MeshPhysicalMaterial({map:cuero(THREE,renderer),roughness:.86,metalness:.04,clearcoat:.12,clearcoatRoughness:.78}));
      tapete.position.y=.08;grupo.add(tapete);
      const halo=new THREE.Mesh(new THREE.CircleGeometry(5.8,64),new THREE.MeshBasicMaterial({color:0x8a5cf0,transparent:true,opacity:.055,depthWrite:false}));
      halo.rotation.x=-Math.PI/2;halo.position.set(0,.145,-.3);grupo.add(halo);
      const ambiente=new THREE.HemisphereLight(0x8ca1d0,0x16090a,1.5);escena.add(ambiente);
      const lampara=new THREE.DirectionalLight(0xffd5a2,2.85);lampara.position.set(-2,10,5);escena.add(lampara);
      const relleno=new THREE.DirectionalLight(0x7e8fca,.72);relleno.position.set(8,4,-8);escena.add(relleno);
      for(const [x,z] of [[-7.35,4.35],[7.35,4.35]]){
        const base=new THREE.Mesh(new THREE.CylinderGeometry(.48,.66,.11,24),new THREE.MeshStandardMaterial({color:0xb57a31,roughness:.34,metalness:.66}));base.position.set(x,.12,z);grupo.add(base);
        const vela=new THREE.Mesh(new THREE.CylinderGeometry(.19,.21,1.18,20),new THREE.MeshStandardMaterial({color:0xf2d8ae,roughness:.72}));vela.position.set(x,.72,z);grupo.add(vela);
        const llama=new THREE.Mesh(new THREE.SphereGeometry(.11,12,8),new THREE.MeshBasicMaterial({color:0xffc369}));llama.scale.y=1.8;llama.position.set(x,1.42,z);grupo.add(llama);
      }
      const observador=new ResizeObserver(acomodar);observador.observe(mat);
      const pantalla=e=>{if(e.detail?.id==='board')requestAnimationFrame(renderizar);};
      const visible=()=>{if(!document.hidden)requestAnimationFrame(renderizar);};
      window.addEventListener('caoz:pantalla',pantalla);document.addEventListener('visibilitychange',visible);
      estado={THREE,mat,canvas,renderer,escena,camara,grupo,observador,pantalla,visible};
      document.body.classList.add('mesa-three-fondo');acomodar();return estado;
    }catch(error){
      renderer?.dispose?.();document.getElementById('mesaThreeFondo')?.remove();
      console.warn('Mesa Three: se conserva la mesa normal porque WebGL no estuvo disponible.',error);return null;
    }
  }
  function destruir(){
    if(!estado)return;
    const actual=estado;estado=null;actual.observador.disconnect();
    window.removeEventListener('caoz:pantalla',actual.pantalla);document.removeEventListener('visibilitychange',actual.visible);
    liberar(actual.THREE,actual.grupo);actual.renderer.renderLists?.dispose?.();actual.renderer.dispose();actual.renderer.forceContextLoss?.();actual.canvas.remove();
    document.body.classList.remove('mesa-three-fondo');
  }
  function iniciarPartida(){
    const empezar=window.startMatch||window.TCG?.startMatch;
    if(inicioPendiente||!CONFIG.inicioAutomatico||typeof empezar!=='function')return;
    inicioPendiente=true;
    empezar(CONFIG.jugador||'talesin',CONFIG.rival||'gero',{volado:false,first:CONFIG.primero??0})
      .catch(error=>console.error('No se pudo iniciar la partida de revisión.',error));
  }
  function preparar(){
    montar();
    // La partida empieza tras la carga real del juego: así final.js terminó de
    // instalar sus capas y nunca se adelanta al d20, la mano o el mulligan.
    const empezar=()=>setTimeout(iniciarPartida,340);
    if(document.readyState==='complete')empezar();else window.addEventListener('load',empezar,{once:true});
  }
  window.CAOZ_MESA_THREE_FONDO=Object.freeze({montar,destruir,inspeccion:()=>estado?{activo:true,canvas:estado.canvas.id}:Object.freeze({activo:false})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',preparar,{once:true});else preparar();
})();

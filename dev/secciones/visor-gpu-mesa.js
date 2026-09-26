/* El Mago del Domo en el visor 3D con WebGPU (visor-3d-gpu.js) junto al de
   WebGL (visor-3d-gl.js): las mismas texturas de carta-pintor.js, la misma
   pose y la misma luz en los dos, para compararlos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),ID='magodomo';
  const CANTO={normal:'#a88f63',foil:'#e3ecf7',dorado:'#ffe7a3'};
  const pose={rx:0,ry:0,objRx:0,objRy:0,vuelta:0,luzX:0,luzY:0,arrastre:null};
  let gpu=null,gl=null,edicion='dorado',t0=performance.now(),motor='comparar';
  // ?presentar=0: WebGPU no se presenta en el lienzo (Chrome sin pantalla pierde el
  // dispositivo al presentar); sólo se usa para revisar con captura().
  const sinPresentar=new URLSearchParams(location.search).get('presentar')==='0';
  const fps={gpu:{n:0,t:performance.now(),v:0},gl:{n:0,t:performance.now(),v:0}};
  const estado=t=>{$('estado').textContent=t;};
  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  async function texturas(ed){
    const a=window.VISOR_GPU_ARTE[ed],img=await imagen('./'+a.url);
    return CAOZ_CARTA_PINTOR.texturas({id:ID,acabado:ed,arte:{img,enc:a.enc},ancho:1024});
  }
  function medir(){
    for(const [v,lienzo]of [[gpu,$('lienzoGpu')],[gl,$('lienzoGl')]]){
      if(!v)continue;const r=lienzo.getBoundingClientRect();if(!r.width)continue;
      v.medir(r.width,r.height,Math.min(devicePixelRatio||1,2),Math.min(r.height*.8,r.width*.8*1.4));
    }
  }
  async function cargar(ed){
    edicion=ed;estado('Pintando '+CARDS[ID].n+' · '+{normal:'Normal',foil:'Foil',dorado:'Foil dorado'}[ed]+'…');
    const tex=await texturas(ed);
    for(const v of [gpu,gl]){try{v?.cargarFrente(tex,ed,CANTO[ed],0);}catch(e){estado('No se pudo cargar la carta en '+(v===gpu?'WebGPU':'WebGL')+': '+e.message);return;}}
    for(const b of document.querySelectorAll('[data-edicion]'))b.setAttribute('aria-pressed',String(b.dataset.edicion===ed));
    estado('Listo. Arrastra para girar la carta.');
  }
  function cuadro(ahora){
    const t=(ahora-t0)/1000,sola=$('girar').checked&&!pose.arrastre;
    if(sola){pose.objRy=Math.sin(t*.45)*.55;pose.objRx=Math.sin(t*.31)*.18;}
    pose.rx+=(pose.objRx-pose.rx)*.12;pose.ry+=(pose.objRy+pose.vuelta-pose.ry)*.1;
    const e={rx:pose.rx,ry:pose.ry,rz:Math.sin(t*.7)*.012,y:Math.sin(t*1.1)*4,s:1,tiempo:t,luzX:pose.luzX,luzY:pose.luzY,pulso:0,pila:0};
    for(const [k,v]of [['gpu',gpu],['gl',gl]]){
      if(!v||(motor!=='comparar'&&motor!==k)||(k==='gpu'&&sinPresentar))continue;
      if(v.dibujar(e)){const f=fps[k];f.n++;if(ahora-f.t>=1000){f.v=Math.round(f.n*1000/(ahora-f.t));f.n=0;f.t=ahora;$(k==='gpu'?'infoGpu':'infoGl').dataset.fps=f.v;pintarInfo();}}
    }
    requestAnimationFrame(cuadro);
  }
  function pintarInfo(){
    $('infoGpu').textContent=gpu?(fps.gpu.v?fps.gpu.v+' fps · ':'')+'MSAA 4× · '+gpu.adaptador:'no disponible en este navegador';
    $('infoGl').textContent=gl?(fps.gl.v?fps.gl.v+' fps · ':'')+'antialias del navegador':'no disponible';
  }
  function elegirMotor(m){motor=m;$('escenario').dataset.motor=m;for(const b of document.querySelectorAll('[data-motor]'))b.setAttribute('aria-pressed',String(b.dataset.motor===m));requestAnimationFrame(medir);}
  const esc=$('escenario');
  esc.addEventListener('pointerdown',e=>{pose.arrastre={x:e.clientX,y:e.clientY,rx:pose.objRx,ry:pose.objRy};esc.setPointerCapture(e.pointerId);});
  esc.addEventListener('pointermove',e=>{
    const panel=e.target.closest('.vgPanel')||$('panelGpu'),r=panel.getBoundingClientRect();
    pose.luzX=((e.clientX-r.left)/r.width-.5)*2;pose.luzY=((e.clientY-r.top)/r.height-.5)*2;
    if(pose.arrastre){pose.objRy=pose.arrastre.ry+(e.clientX-pose.arrastre.x)/180;pose.objRx=Math.max(-.7,Math.min(.7,pose.arrastre.rx+(e.clientY-pose.arrastre.y)/220));}
  });
  const soltar=()=>{pose.arrastre=null;};esc.addEventListener('pointerup',soltar);esc.addEventListener('pointercancel',soltar);
  $('voltear').onclick=()=>{pose.vuelta+=Math.PI;};
  for(const b of document.querySelectorAll('[data-motor]'))b.onclick=()=>elegirMotor(b.dataset.motor);
  for(const b of document.querySelectorAll('[data-edicion]'))b.onclick=()=>cargar(b.dataset.edicion);
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();
    // ?solo=gpu o ?solo=gl crea un único motor (para medirlos por separado).
    const solo=new URLSearchParams(location.search).get('solo');
    gpu=solo==='gl'?null:await window.CAOZ_VISOR3D_GPU.crear($('lienzoGpu'));
    gl=solo==='gpu'?null:window.CAOZ_VISOR3D_GL.crear($('lienzoGl'));
    if(solo==='gpu'&&gpu)elegirMotor('gpu');
    else if(!gpu){elegirMotor('gl');$('panelGpu').dataset.sinSoporte='';}
    const logo=await imagen('./art/logo.webp'),dorso=CAOZ_CARTA_PINTOR.dorso(logo);
    gpu?.cargarDorso(dorso);gl?.cargarDorso(dorso);
    medir();new ResizeObserver(medir).observe(esc);
    await cargar(edicion);pintarInfo();
    if(!gpu&&solo!=='gl')estado('Este navegador no tiene WebGPU: se muestra sólo WebGL. Prueba en Chrome o Edge actualizados, o en Safari 26.');
    requestAnimationFrame(cuadro);
    // captura(motor): dibuja un fotograma y lo lee en la misma tarea (antes de que el lienzo se presente).
    // captura(motor,pose): el mismo fotograma en los dos motores, como PNG. WebGPU se
    // lee de una textura propia; WebGL, del lienzo en la misma tarea en que se dibuja.
    const captura=async(k,p={})=>{
      const e={rx:0,ry:0,rz:0,y:0,s:1,tiempo:1,luzX:0,luzY:0,pulso:0,pila:0,...p};
      if(k==='gpu'){if(!gpu)return null;const img=await gpu.capturar(e);if(!img)return null;const c=document.createElement('canvas');c.width=img.ancho;c.height=img.alto;c.getContext('2d').putImageData(new ImageData(img.datos,img.ancho,img.alto),0,0);return c.toDataURL('image/png');}
      if(!gl)return null;gl.dibujar(e);return $('lienzoGl').toDataURL('image/png');};
    window.CAOZ_VISOR_GPU_REVISION=Object.freeze({captura,hayGpu:()=>!!gpu,hayGl:()=>!!gl,edicion:()=>edicion,motor:()=>motor,fps:()=>({gpu:fps.gpu.v,gl:fps.gl.v}),pose});
  }
  preparar().catch(e=>estado('No se pudo preparar el visor: '+e.message));
})();

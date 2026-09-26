/* El animatic del teaser (20 s, 16:9, sin música): una sola línea de tiempo
   que dirige los módulos reales del juego, sin copiarlos.
     0,0–4,45   El Mago del Domo dorado en medio de la tormenta (visor 3D +
                tormenta-gl.js); los relámpagos lo iluminan y se da la vuelta.
     4,45–6,9   Thal dorado, invocación legendaria en la tormenta (fx-invocar).
     6,9–8,8    El aliento de Thal reduce a ceniza a El Rey (fx-aliento).
     8,8–11,4   Montaje: Rayo de Escarcha, Polimorfia y Ascensión (fx-poderes,
                fx-ascension), un corte por plano.
     11,4–12,0  Silencio: una gota en la oscuridad.
     12,0–16,1  La cortinilla con la colección (cortinilla.js) abre paso al logo.
     14,6–20,0  El logo sobre la tormenta, con el último relámpago; fundido.
   Con ?captura=1 corre con el reloj virtual de teaser-reloj.js (fotograma a
   fotograma); ?desde=s empieza en ese segundo; ?auto=1 arranca solo. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),D=window.TEASER_DATOS,DUR=20,TAU=Math.PI*2,PI=Math.PI;
  const q=new URLSearchParams(location.search),captura=q.get('captura')==='1',desde=Math.max(0,Math.min(DUR-.1,+q.get('desde')||0));
  if(captura)document.documentElement.dataset.captura='';
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),entre=(t,a,b)=>acotar((t-a)/(b-a));
  const suave=t=>{t=acotar(t);return t*t*(3-2*t);},salida=t=>1-Math.pow(1-acotar(t),3),vaiven=t=>{t=acotar(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const escena=$('teaser');
  let T=desde,t0=0,corriendo=false,terminado=false,W=1,H=1,dpr=1;

  /* ---- La tormenta: relámpagos con guion ---------------------------------- */
  const FLASH=[.8,.86,1];
  // t: instante; x: lado (−1 izquierda, 1 derecha); f: fuerza; nube: sin rayo visible.
  const RAYOS=[{t:.3,x:-.7,f:.75,nube:true},{t:1.25,x:-.85,f:1},{t:2.55,x:.75,f:.95},{t:3.65,x:.4,f:1.25},
    {t:5.05,x:-.55,f:.85},{t:5.95,x:.65,f:1.35},{t:16.65,x:-.45,f:1.4},{t:18.25,x:.75,f:.8,nube:true}].map((r,k)=>({...r,sem:7+k*13}));
  function rayoEn(t){
    let r=null;for(const x of RAYOS){if(x.t>t)break;r=x;}
    if(!r)return {I:0,bri:0,x:0,sem:0};
    const s=t-r.t;let I=0;for(const [c,a]of [[0,1],[.09,.75],[.22,.5]])if(s>=c)I+=a*Math.exp(-(s-c)*13);
    if(s>1.2)I=0;I*=r.f;
    return {I,bri:r.nube?0:Math.min(1.5,I*1.25),x:r.x,sem:r.sem};
  }
  function tormenta(t,gotas){
    const q=rayoEn(t),dir=[q.x*1.6,2.2,1.3],n=Math.hypot(...dir);
    return {tormenta:1,flash:FLASH.map(v=>v*q.I*1.3),flashDir:dir.map(v=>v/n),
      cielo:{flash:q.I,flashCol:FLASH,rayoX:q.x,rayoSem:q.sem,rayoBri:q.bri,octavas:6,gotas,viento:.2,par:[Math.sin(t*.3)*.3,0]}};
  }
  let visor=null;
  const ALTO=.6;// alto de la carta del visor, en fracción del escenario
  function dibujarTormenta(){
    if(!visor)return;
    // Plano 1: El Mago del Domo; se acerca y, antes del corte, se da la vuelta.
    if(T<4.45){
      const t=T,giro=vaiven(entre(t,3.45,4.3))*PI;
      visor.dibujar({rx:.1-.06*entre(t,0,4),ry:-.32+.24*suave(entre(t,0,3.4))+giro,rz:Math.sin(t*.7)*.015,y:Math.sin(t*1.1)*5,s:.95+.33*salida(entre(t,0,4.4)),
        tiempo:t,luzX:-.5,luzY:-.6,pulso:0,pila:0,...tormenta(t,40000)});
    }else visor.dibujarVarias({tiempo:T,luzX:0,luzY:0,pulso:0,pila:0,...tormenta(T,T<8?30000:14000)},[]);
  }

  /* ---- Las cartas ---------------------------------------------------------- */
  const imagenes=new Map(),caras=new Map();
  const imagen=url=>{if(imagenes.has(url))return imagenes.get(url);const p=new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src='./'+url;});imagenes.set(url,p);return p;};
  const datoDe=(id,acabado)=>D.cartas.find(c=>c.id===id&&c.acabado===acabado);
  async function cara(id,acabado){
    const k=id+'/'+acabado;if(caras.has(k))return caras.get(k);
    const d=datoDe(id,acabado),img=await imagen(d.url);
    const c=CAOZ_CARTA_PINTOR.hornear({id,acabado,arte:{img,enc:d.enc},ancho:620});caras.set(k,c);return c;
  }
  function poner(nodo,lienzo){const c=document.createElement('canvas');c.width=lienzo.width;c.height=lienzo.height;c.getContext('2d').drawImage(lienzo,0,0);nodo.replaceChildren(c);return c;}

  /* ---- Los planos ---------------------------------------------------------- */
  // capas: lo que se ve mientras dura; arranque: cuándo se lanza su efecto
  // (antes de verse si el plano empieza a mitad del efecto).
  const op=vel=>({velocidad:vel,reducir:false});
  const PLANOS=[
    {id:'mago',nombre:'El Mago en la tormenta',ini:0,fin:4.45,capas:['lienzoTormenta']},
    {id:'invocar',nombre:'Invocación de Thal',ini:4.45,fin:6.9,capas:['lienzoTormenta','hostInvocar'],arranque:4.55,
      empezar:()=>CAOZ_FX_INVOCAR.invocar($('hostInvocar'),{carta:$('ranuraThal'),imagen:caras.get('tal/dorado'),lado:'abajo',acabado:'dorado',legendaria:true,sacudir:$('camara'),...op(.55)})},
    {id:'aliento',nombre:'El aliento de Thal',ini:6.9,fin:8.8,capas:['planoAliento'],arranque:6.9-.45/1.95,
      empezar:()=>CAOZ_FX_ALIENTO.ataque($('planoAliento'),{atacante:$('alientoThal'),objetivo:$('alientoRey'),imagenObjetivo:caras.get('rey/normal'),letal:true,...op(1.95)})},
    {id:'escarcha',nombre:'Rayo de Escarcha',ini:8.8,fin:9.6,capas:['planoEscarcha'],arranque:8.8-.05,
      empezar:()=>CAOZ_FX_PODERES.congelar($('planoEscarcha'),{objetivo:$('escarchaEric'),origen:$('escarchaOrigen'),impacto:[.55,.36],...op(1.8)})},
    {id:'polimorfia',nombre:'Polimorfia',ini:9.6,fin:10.4,capas:['planoPolimorfia'],arranque:9.6-.3/2.1,
      empezar:()=>{const n=$('polimorfiaDiscipulo'),c=n.querySelector('canvas'),nueva=caras.get('tok_dragon/dorado');
        return CAOZ_FX_PODERES.polimorfar($('planoPolimorfia'),{objetivo:n,imagen:c,imagenNueva:nueva,sacudir:$('camara'),alCambiar:()=>{const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.drawImage(nueva,0,0,c.width,c.height);},...op(2.1)});}},
    {id:'ascension',nombre:'Ascensión de Petunia',ini:10.4,fin:11.4,capas:['planoAscension'],arranque:10.4-.9/2,
      empezar:()=>{const n=$('ascensionPetunia'),c=n.querySelector('canvas'),nueva=caras.get('tok_petunia/dorado');
        return CAOZ_FX_ASCENSION.ascender($('planoAscension'),{objetivo:n,imagen:c,imagenNueva:nueva,alRevelar:()=>{const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.drawImage(nueva,0,0,c.width,c.height);},...op(2)});}},
    {id:'gota',nombre:'Silencio',ini:11.4,fin:12.05,capas:['lienzoGota']},
    {id:'cortinilla',nombre:'La colección',ini:12,fin:16.2,capas:['hostCortinilla'],arranque:12,empezar:()=>cortinilla?.reproducir({})},
    {id:'logo',nombre:'Logo',ini:14.6,fin:DUR+1,capas:['lienzoTormenta','lienzoLogo']},
  ];
  for(const p of PLANOS)p.arranque??=p.ini;
  // Capas que no son un plano: el fondo detrás de la rueda de cartas.
  const EXTRAS=[{capa:'fondoCortinilla',ini:11.95,fin:14.95}];
  const CAPAS=[...new Set([...PLANOS.flatMap(p=>p.capas),...EXTRAS.map(e=>e.capa)])];

  /* ---- Lienzos 2D: la gota y el logo --------------------------------------- */
  const gGota=$('lienzoGota').getContext('2d'),gLogo=$('lienzoLogo').getContext('2d');
  let logo=null,brillo=null;
  const sprites=new Map();
  function sprite(rgb){const k=rgb.join();if(sprites.has(k))return sprites.get(k);const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32);
    d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.25,'rgba('+rgb.join(',')+',.9)');d.addColorStop(1,'rgba('+rgb.join(',')+',0)');g.fillStyle=d;g.fillRect(0,0,64,64);sprites.set(k,c);return c;}
  const pintar=(g,s,x,y,r,a)=>{if(a<=0||r<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(s,x-r,y-r,r*2,r*2);};
  function dibujarGota(){
    const g=gGota;g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.fillStyle='#000';g.fillRect(0,0,W,H);
    const t=T-11.4,cae=entre(t,.05,.34),x=W*.5,y=H*(.02+.6*cae*cae);
    g.globalCompositeOperation='lighter';
    if(cae>0&&cae<1){const gr=g.createLinearGradient(x,y-H*.07,x,y);gr.addColorStop(0,'rgba(200,215,255,0)');gr.addColorStop(1,'rgba(230,238,255,.9)');g.strokeStyle=gr;g.lineWidth=H*.004;g.beginPath();g.moveTo(x,y-H*.07);g.lineTo(x,y);g.stroke();pintar(g,sprite([190,210,255]),x,y,H*.01,.9);}
    // El golpe: dos ondas y unas gotas que saltan, con un destello dorado.
    const k=t-.34;if(k>0){const yb=H*.62;
      for(const [d,a]of [[0,1],[.12,.6]]){const p=entre(k,d,d+.55);if(p<=0||p>=1)continue;const r=W*.02+W*.16*salida(p);g.globalAlpha=(1-p)*.8*a;g.strokeStyle='rgba(215,228,255,1)';g.lineWidth=H*.003;g.beginPath();g.ellipse(x,yb,r,r*.16,0,0,TAU);g.stroke();}
      for(let i=0;i<9;i++){const a=-PI/2+(i-4)*.22,v=H*(.35+hash(i)*.25),tt=Math.min(k,.5),px=x+Math.cos(a)*v*tt,py=yb+Math.sin(a)*v*tt+H*1.4*tt*tt;pintar(g,sprite([200,215,255]),px,py,H*.004,(1-k/.5));}
      pintar(g,sprite([255,215,140]),x,yb,H*.12*(1+k),.55*Math.exp(-k*6));}
    g.globalCompositeOperation='source-over';g.globalAlpha=1;
  }
  function dibujarLogo(){
    const g=gLogo;g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
    if(!logo)return;
    const k=T-14.6,rq=rayoEn(T),I=rq.I;
    const s=1.1-.1*salida(entre(k,0,4.8)),lw=W*.56*s,lh=lw*logo.height/logo.width,x=W/2-lw/2,y=H*.47-lh/2;
    // Resplandor de fuego detrás (el del logo) que late, y la luz del relámpago.
    g.globalCompositeOperation='lighter';
    pintar(g,sprite([255,120,30]),W/2+lw*.07,H*.42,lw*.55,.28+.06*Math.sin(T*5)+.08*Math.sin(T*8.3));
    pintar(g,sprite([200,215,255]),W/2,H*.45,lw*.8,.45*I);
    // pintar() deja su opacidad puesta: el logo se dibuja entero.
    g.globalCompositeOperation='source-over';g.globalAlpha=1;
    g.drawImage(logo,x,y,lw,lh);
    // Brillo: una banda de luz cruza el metal (y otra con el relámpago).
    for(const [a,b,f]of [[15.35,16.2,.85],[16.62,17.1,1]]){
      const p=entre(T,a,b);if(p<=0||p>=1)continue;
      const c=brillo,bg=c.getContext('2d');c.width=Math.max(1,Math.round(lw*dpr));c.height=Math.max(1,Math.round(lh*dpr));
      bg.setTransform(dpr,0,0,dpr,0,0);bg.globalCompositeOperation='source-over';bg.drawImage(logo,0,0,lw,lh);bg.globalCompositeOperation='source-in';
      const bx=-lw*.3+p*lw*1.6,gr=bg.createLinearGradient(bx-lw*.09,0,bx+lw*.09,lh*.45);
      gr.addColorStop(0,'rgba(255,240,200,0)');gr.addColorStop(.5,'rgba(255,236,180,.8)');gr.addColorStop(1,'rgba(255,240,200,0)');bg.fillStyle=gr;bg.fillRect(0,0,lw,lh);
      g.globalCompositeOperation='lighter';g.globalAlpha=f*Math.sin(PI*p);g.drawImage(c,x,y,lw,lh);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    }
    if(I>0){g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(.55,I*.4);g.drawImage(logo,x,y,lw,lh);g.globalAlpha=1;g.globalCompositeOperation='source-over';}
    // Brasas que suben de la llama: cada una es función del tiempo (sin estado).
    g.globalCompositeOperation='lighter';const brasa=sprite([255,150,50]),oro=sprite([255,215,130]);
    for(let i=0;i<70;i++){
      const v=.08+hash(i*3.1)*.12,fase=(T*v+hash(i*7.7))%1,px=W*(.5+(hash(i*1.3)-.5)*.5)+Math.sin(T*(.8+hash(i)*1.5)+i)*W*.02,py=H*(.78-fase*.8);
      const a=Math.sin(PI*fase)*entre(k,.2,1.2)*(.4+.6*hash(i*5.1));pintar(g,i%4?brasa:oro,px,py,H*(.003+.005*hash(i*9.3)),a);
    }
    g.globalCompositeOperation='source-over';g.globalAlpha=1;
  }

  /* ---- Velos: cortes a blanco y fundidos a negro ---------------------------- */
  const pico=(t,c,a,sube,baja)=>t<c-sube||t>c+baja?0:t<c?a*suave((t-(c-sube))/sube):a*Math.exp(-(t-c)/baja*3);
  function velos(){
    const b=Math.max(pico(T,4.43,1,.1,.35),pico(T,6.9,.7,.05,.2),pico(T,8.8,.45,.03,.14),pico(T,9.6,.45,.03,.14),pico(T,10.4,.45,.03,.14));
    const n=Math.max(1-entre(T,0,.5),entre(T,19.1,20),T>=11.35&&T<11.42?entre(T,11.35,11.4):0);
    $('veloBlanco').style.opacity=b.toFixed(3);$('veloNegro').style.opacity=n.toFixed(3);
  }
  // Los fondos del montaje se acercan despacio mientras dura su plano.
  function fondos(){for(const p of PLANOS){const f=document.querySelector('#'+({aliento:'planoAliento',escarcha:'planoEscarcha',polimorfia:'planoPolimorfia',ascension:'planoAscension'}[p.id]||'_')+' .tzFondo');if(f)f.style.transform='scale('+(1.02+.08*entre(T,p.ini,p.fin)).toFixed(4)+')';}}

  /* ---- La dirección ---------------------------------------------------------- */
  function medir(){
    const r=escena.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);
    for(const c of [$('lienzoGota'),$('lienzoLogo')]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}
    visor?.medir(W,H,dpr,H*ALTO);
  }
  function visibles(){
    const activas=new Set();for(const p of PLANOS)if(T>=p.ini&&T<p.fin)for(const c of p.capas)activas.add(c);
    for(const e of EXTRAS)if(T>=e.ini&&T<e.fin)activas.add(e.capa);
    for(const c of CAPAS){const n=$(c);if(activas.has(c))n.dataset.visible='';else delete n.dataset.visible;}
    return activas;
  }
  function paso(){
    for(const p of PLANOS)if(!p.lanzado&&T>=p.arranque&&T<p.fin){p.lanzado=true;try{Promise.resolve(p.empezar?.()).catch(e=>console.error(e));}catch(e){console.error(e);}}
    const activas=visibles();
    if(activas.has('lienzoTormenta'))dibujarTormenta();
    if(activas.has('lienzoGota'))dibujarGota();
    if(activas.has('lienzoLogo'))dibujarLogo();
    velos();fondos();
    $('reloj').textContent=T.toFixed(1).replace('.',',')+' / 20,0 s';$('lineaAvance').style.width=(T/DUR*100).toFixed(2)+'%';
  }
  function cuadro(){
    if(!corriendo)return;
    T=Math.min(DUR,desde+(performance.now()-t0)/1000);paso();
    if(T>=DUR){corriendo=false;terminado=true;$('estado').textContent='Fin. «Repetir» lo vuelve a poner.';return;}
    requestAnimationFrame(cuadro);
  }
  function empezar(){if(corriendo||terminado)return;$('portada').hidden=true;corriendo=true;t0=performance.now();$('estado').textContent='Reproduciendo…';requestAnimationFrame(cuadro);}

  let cortinilla=null;
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();
    logo=await imagen('art/logo.webp');brillo=document.createElement('canvas');
    for(const f of D.fondos)document.querySelector('[data-fondo="'+f.id+'"]').style.backgroundImage='url("./'+f.url+'")';
    for(const c of D.cartas)await imagen(c.url);
    const pares=[['ranuraThal','tal','dorado'],['alientoThal','tal','dorado'],['alientoRey','rey','normal'],['escarchaOrigen','escarcha','dorado'],['escarchaEric','eric','normal'],
      ['polimorfiaDiscipulo','discipulo','dorado'],['ascensionPetunia','petunia','dorado']];
    for(const [n,id,a]of pares)poner($(n),await cara(id,a));
    await cara('tok_dragon','dorado');await cara('tok_petunia','dorado');
    // El visor con la tormenta y El Mago del Domo dorado.
    visor=CAOZ_VISOR3D_GL.crear($('lienzoTormenta'),{escena:window.CAOZ_TORMENTA_GL});
    if(visor){const m=datoDe('magodomo','dorado'),img=await imagen(m.url);
      visor.cargarFrente(CAOZ_CARTA_PINTOR.texturas({id:'magodomo',acabado:'dorado',arte:{img,enc:m.enc},ancho:1024}),'dorado','#ffe7a3',0);
      visor.cargarDorso(CAOZ_CARTA_PINTOR.dorso(logo));}
    medir();new ResizeObserver(medir).observe(escena);
    // La cortinilla final: pinta sus doce cartas ahora, no en mitad del teaser.
    const muro=D.muro.map(([id,a])=>{const d=datoDe(id,a);return {...d,url:'./'+d.url,nombre:CARDS[id].n};});
    cortinilla=CAOZ_CORTINILLA.crear($('hostCortinilla'),{cartas:muro,logoUrl:'./art/logo.webp',velocidad:1,reducir:false});
    if(cortinilla)await cortinilla.preparar(k=>{$('estado').textContent='Pintando la colección… '+Math.round(k*100)+'%';});
    T=desde;paso();
    $('reproducir').disabled=false;$('reproducir').textContent='▶ Reproducir';$('estado').textContent=visor&&cortinilla?'Listo.':'Este navegador no tiene WebGL: faltarán planos.';
    return true;
  }

  // Controles: repetir y empezar en un plano recargan la página (los efectos no se rebobinan).
  const ir=s=>{const u=new URL(location.href);u.searchParams.set('auto','1');if(s>0)u.searchParams.set('desde',String(s));else u.searchParams.delete('desde');location.href=u.href;};
  $('desde').replaceChildren(...PLANOS.map(p=>Object.assign(document.createElement('option'),{value:String(p.ini),textContent:p.ini.toFixed(1).replace('.',',')+' s · '+p.nombre,selected:Math.abs(p.ini-desde)<.01})));
  $('desde').onchange=e=>ir(+e.target.value);$('repetir').onclick=()=>ir(0);$('reproducir').onclick=empezar;
  $('completa').onclick=()=>escena.requestFullscreen?.();
  $('linea').append(...PLANOS.map(p=>{const b=document.createElement('b');b.style.left=(p.ini/DUR*100)+'%';return b;}));
  const listo=preparar().then(ok=>{if(q.get('auto')==='1'&&!captura)empezar();return ok;}).catch(e=>{$('estado').textContent='No se pudo preparar el teaser: '+e.message;console.error(e);return false;});
  /* Revisión: con ?captura=1, empezar() y después avanzar el reloj virtual. */
  window.CAOZ_TEASER=Object.freeze({listo,empezar,DUR,planos:()=>PLANOS.map(({id,nombre,ini,fin})=>({id,nombre,ini,fin})),tiempo:()=>T,visibles:()=>[...visibles()],rayos:()=>RAYOS.map(r=>r.t)});
})();

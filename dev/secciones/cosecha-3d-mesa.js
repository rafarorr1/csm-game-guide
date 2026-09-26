/* Revisión de La cosecha en 3D (pitagoras-cosecha-3d.js): el modelo real de la
   prueba, jugado por un bot con semilla fija y dibujado por el pintor que usa
   el juego. «Jugar de verdad» abre la prueba real (PITAGORAS_PRUEBAS.iniciar).
   ?captura=1 deja sólo el escenario; la revisión avanza a pasos fijos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),API=window.PITAGORAS_PRUEBAS,M=API.modelo,q=new URLSearchParams(location.search);
  if(q.get('captura')==='1')document.documentElement.dataset.captura='';
  const lienzo=$('lienzo'),esc=$('escenario');let s=null,raf=0,antes=0,corriendo=false;
  // El bot: huye de fantasmas, marcas y losas, vuelve al centro y dispara siempre (la prueba apunta sola).
  function bot(m){
    const p=m.jugador;let fx=-p.x*.09,fy=-p.y*.09;
    for(const u of m.enemigos){const dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy)+.01;if(d<4.2){fx+=dx/d*2.2/(d*d);fy+=dy/d*2.2/(d*d);}}
    for(const c of m.marcas){if(c.edad>c.aviso+c.activo+c.fuego)continue;const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)+.01;
      if(c.edad<c.aviso+c.activo?d<c.r+1.3:Math.abs(d-c.r)<.7){const s=d<c.r?1:-1;fx+=dx/d*3*s;fy+=dy/d*3*s;}}
    for(const l of m.losas){const dx=p.x-l.x,dy=p.y-l.y;if(Math.max(Math.abs(dx),Math.abs(dy))<1.9){const d=Math.hypot(dx,dy)+.01;fx+=dx/d*3;fy+=dy/d*3;}}
    const n=Math.hypot(fx,fy);return {mx:n>.12?fx/n:0,my:n>.12?fy/n:0,accion:true};
  }
  // El bot de revisión no muere (vidas de sobra en su propia copia del modelo) para ver los 20 s, presión incluida.
  function nuevo(){const semilla=Math.max(1,+$('semilla').value||7);s={modelo:M.crear({tipo:'isometrico',semilla}),tipo:'isometrico',ancho:1,alto:1,reducido:matchMedia('(prefers-reduced-motion:reduce)').matches,andando:0,id:semilla};s.modelo.vidas=99;}
  function medir(){const r=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);lienzo.width=Math.round(r.width*dpr);lienzo.height=Math.round(r.height*dpr);if(s){s.ancho=r.width;s.alto=r.height;}return dpr;}
  function paso(dt){const e=bot(s.modelo);s.andando=Math.hypot(e.mx,e.my);M.paso(s.modelo,e,dt);}
  function pintar(){
    const dpr=medir(),g=lienzo.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,s.ancho,s.alto);
    g.save();if(s.modelo.impacto>0){const f=s.modelo.impacto*4;g.translate(Math.sin(s.modelo.t*79)*f,Math.cos(s.modelo.t*97)*f);}API.pintores.isometrico(s,g);g.restore();
    // La viñeta que pone la prueba encima (roja al recibir daño).
    const v=g.createRadialGradient(s.ancho*.5,s.alto*.45,Math.min(s.ancho,s.alto)*.24,s.ancho*.5,s.alto*.45,Math.max(s.ancho,s.alto)*.72);v.addColorStop(0,'transparent');v.addColorStop(1,s.modelo.impacto>0?'#a71f47a6':'#030408bb');g.fillStyle=v;g.fillRect(0,0,s.ancho,s.alto);
    const m=s.modelo;$('hud').textContent=m.t.toFixed(1)+' / '+m.duracion+' s · golpes recibidos '+(99-m.vidas)+' · '+m.enemigos.length+' fantasmas · '+m.muertes+' derrotados'+(m.terminado?(m.sobrevivio?' · sobrevivió':' · cayó'):'');
  }
  function cuadro(ahora){
    if(!corriendo)return;const dt=Math.min(.05,(ahora-antes)/1000||0)*($('lento').checked?.3:1);antes=ahora;
    if(!s.modelo.terminado)paso(dt);s.ambiente=undefined;pintar();
    raf=requestAnimationFrame(cuadro);
  }
  function verBot(){cancelAnimationFrame(raf);nuevo();corriendo=true;antes=performance.now();raf=requestAnimationFrame(cuadro);$('estado').textContent='El bot juega con la semilla '+s.modelo.semilla+'.';}
  for(const b of document.querySelectorAll('[data-pintor]'))b.onclick=()=>{window.CAOZ_COSECHA_3D_APAGADA=b.dataset.pintor==='clasico';for(const x of document.querySelectorAll('[data-pintor]'))x.setAttribute('aria-pressed',String(x===b));};
  for(const b of document.querySelectorAll('[data-marco]'))b.onclick=()=>{esc.dataset.marco=b.dataset.marco;for(const x of document.querySelectorAll('[data-marco]'))x.setAttribute('aria-pressed',String(x===b));};
  $('bot').onclick=verBot;
  $('jugar').onclick=async()=>{corriendo=false;cancelAnimationFrame(raf);$('estado').textContent='La cosecha está abierta.';
    const r=await API.iniciar({tipo:'isometrico',cartaId:'editorcosecha',personaje:{nombre:'Viajero'}});
    $('estado').textContent=r?.cancelado?'Prueba cerrada.':r?.sobrevivio?'Sobreviviste a La cosecha.':'La cosecha te alcanzó.';};
  /* Revisión: irA(t) juega desde cero hasta t a pasos de 1/fps pintando cada
     fotograma (los efectos que recuerdan, como el humo al morir, salen igual). */
  window.CAOZ_COSECHA3D_REVISION=Object.freeze({
    irA(t,fps=30){corriendo=false;cancelAnimationFrame(raf);nuevo();const n=Math.round(t*fps);for(let i=0;i<n;i++){paso(1/fps);s.ambiente=s.modelo.t+3;pintar();}return this.estado();},
    avanzar(dt=1/30){paso(dt);s.ambiente=s.modelo.t+3;pintar();return this.estado();},
    estado:()=>s&&{t:s.modelo.t,vidas:s.modelo.vidas,enemigos:s.modelo.enemigos.length,marcas:s.modelo.marcas.length,losas:s.modelo.losas.length,muertes:s.modelo.muertes,terminado:s.modelo.terminado,activo3d:!!window.CAOZ_COSECHA_3D?.activo,arte:!!window.CAOZ_COSECHA_3D?.arteListo},
    proyectar:(x,y)=>API.sueloDesdePantalla.isometrico(s,x,y),
  });
  medir();nuevo();pintar();
  $('estado').textContent='Listo. «Ver con el bot» juega La cosecha con la semilla fija.';
  if(q.get('auto')==='1')verBot();
})();

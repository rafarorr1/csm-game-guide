/* Revisión de las pruebas de Pitágoras en 3D (pitagoras-mundo-3d.js y un
   módulo por prueba): el modelo real, jugado por un bot con semilla fija y
   dibujado por el pintor que usa el juego. «Jugar de verdad» abre la prueba
   real (PITAGORAS_PRUEBAS.iniciar). ?prueba=laseres elige la prueba;
   ?captura=1 deja sólo el escenario; la revisión avanza a pasos fijos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),API=window.PITAGORAS_PRUEBAS,M=API.modelo,q=new URLSearchParams(location.search);
  const PRUEBAS={
    isometrico:{carta:'editorcosecha',mundo:()=>window.CAOZ_COSECHA_3D,apagar:'CAOZ_COSECHA_3D_APAGADA',bot:botCosecha},
    laseres:{carta:'editorcorte',mundo:()=>window.CAOZ_CORTE_3D,apagar:'CAOZ_CORTE_3D_APAGADA',bot:(m,mem)=>API.guiasPrueba.laseres(m,mem)},
    fps:{carta:'editorcuadro',mundo:()=>window.CAOZ_CUADRO_3D,apagar:'CAOZ_CUADRO_3D_APAGADA',bot:botCuadro},
  };
  if(q.get('captura')==='1')document.documentElement.dataset.captura='';
  let tipo=PRUEBAS[q.get('prueba')]?q.get('prueba'):'isometrico';
  const lienzo=$('lienzo'),esc=$('escenario');let s=null,raf=0,antes=0,corriendo=false,memBot={};
  // El bot de La cosecha: huye de fantasmas, marcas y losas, vuelve al centro y dispara siempre (la prueba apunta sola).
  function botCosecha(m){
    const p=m.jugador;let fx=-p.x*.09,fy=-p.y*.09;
    for(const u of m.enemigos){const dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy)+.01;if(d<4.2){fx+=dx/d*2.2/(d*d);fy+=dy/d*2.2/(d*d);}}
    for(const c of m.marcas){if(c.edad>c.aviso+c.activo+c.fuego)continue;const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)+.01;
      if(c.edad<c.aviso+c.activo?d<c.r+1.3:Math.abs(d-c.r)<.7){const s=d<c.r?1:-1;fx+=dx/d*3*s;fy+=dy/d*3*s;}}
    for(const l of m.losas){const dx=p.x-l.x,dy=p.y-l.y;if(Math.max(Math.abs(dx),Math.abs(dy))<1.9){const d=Math.hypot(dx,dy)+.01;fx+=dx/d*3;fy+=dy/d*3;}}
    const n=Math.hypot(fx,fy);return {mx:n>.12?fx/n:0,my:n>.12?fy/n:0,accion:true};
  }
  // El bot de Fuera de cuadro: gira hacia el espectro visible más cercano, dispara cuando lo tiene
  // delante y se aparta si se le echa encima; si no hay ninguno, vuelve hacia el centro del archivo.
  function botCuadro(m){
    const p=m.jugador;let blanco=null,d=1e9;
    for(const u of m.enemigos){if(u.aparece>0)continue;const dx=u.x-p.x,dy=u.y-p.y,dd=Math.hypot(dx,dy);if(dd<d&&M.raycast(m,p.x,p.y,dx/dd,dy/dd,dd).d>=dd-.25){d=dd;blanco=u;}}
    const objetivo=blanco?Math.atan2(blanco.y-p.y,blanco.x-p.x):Math.atan2(8-p.y,8-p.x),dif=Math.atan2(Math.sin(objetivo-p.a),Math.cos(objetivo-p.a));
    const lejos=Math.hypot(8-p.x,8-p.y);
    return {mx:blanco&&d<3?Math.sign(Math.sin(m.t*.7))||1:0,my:blanco?(d<2.6?1:0):(lejos>2.5?-1:0),giro:lim(dif*7,-4,4),accion:!!blanco&&Math.abs(dif)<.07};
  }
  const lim=(x,a,b)=>Math.max(a,Math.min(b,x));
  const reducido=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  // El bot de revisión no muere (vidas de sobra en su propia copia del modelo) para ver los 20 s.
  function nuevo(){const semilla=Math.max(1,+$('semilla').value||7);memBot={};s={modelo:M.crear({tipo,semilla}),tipo,ancho:1,alto:1,reducido:reducido(),andando:0,id:semilla};s.modelo.vidas=99;}
  function medir(){const r=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);lienzo.width=Math.round(r.width*dpr);lienzo.height=Math.round(r.height*dpr);if(s){s.ancho=r.width;s.alto=r.height;}return dpr;}
  function paso(dt){const e=PRUEBAS[tipo].bot(s.modelo,memBot);s.andando=Math.hypot(e.mx||0,e.my||0);M.paso(s.modelo,e,dt);}
  function pintar(){
    const dpr=medir(),g=lienzo.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,s.ancho,s.alto);
    g.save();if(s.modelo.impacto>0){const f=s.modelo.impacto*4;g.translate(Math.sin(s.modelo.t*79)*f,Math.cos(s.modelo.t*97)*f);}API.pintores[tipo](s,g);g.restore();
    // La viñeta que pone la prueba encima (roja al recibir daño).
    const v=g.createRadialGradient(s.ancho*.5,s.alto*.45,Math.min(s.ancho,s.alto)*.24,s.ancho*.5,s.alto*.45,Math.max(s.ancho,s.alto)*.72);v.addColorStop(0,'transparent');v.addColorStop(1,s.modelo.impacto>0?'#a71f47a6':'#030408bb');g.fillStyle=v;g.fillRect(0,0,s.ancho,s.alto);
    const m=s.modelo;$('hud').textContent=m.t.toFixed(1)+' / '+m.duracion+' s · golpes recibidos '+(99-m.vidas)+(tipo==='laseres'?' · '+m.rayos.filter(r=>r.edad>=0).length+' rayos':' · '+m.enemigos.length+(tipo==='fps'?' espectros · ':' fantasmas · ')+m.muertes+' derrotados');
  }
  function cuadro(ahora){
    if(!corriendo)return;const dt=Math.min(.05,(ahora-antes)/1000||0)*($('lento').checked?.3:1);antes=ahora;
    if(!s.modelo.terminado)paso(dt);s.ambiente=undefined;pintar();
    raf=requestAnimationFrame(cuadro);
  }
  function marcar(sel,v){for(const b of document.querySelectorAll('['+sel+']'))b.setAttribute('aria-pressed',String(b.getAttribute(sel)===v));}
  function elegir(t){tipo=t;marcar('data-prueba',t);corriendo=false;cancelAnimationFrame(raf);nuevo();medir();pintar();$('estado').textContent='Listo. «Ver con el bot» juega '+API.tipos[t].nombre+' con la semilla fija.';}
  function verBot(){cancelAnimationFrame(raf);nuevo();corriendo=true;antes=performance.now();raf=requestAnimationFrame(cuadro);$('estado').textContent='El bot juega '+API.tipos[tipo].nombre+' con la semilla '+s.modelo.semilla+'.';}
  for(const b of document.querySelectorAll('[data-prueba]'))b.onclick=()=>elegir(b.dataset.prueba);
  for(const b of document.querySelectorAll('[data-pintor]'))b.onclick=()=>{for(const p of Object.values(PRUEBAS))window[p.apagar]=b.dataset.pintor==='clasico';marcar('data-pintor',b.dataset.pintor);};
  for(const b of document.querySelectorAll('[data-marco]'))b.onclick=()=>{esc.dataset.marco=b.dataset.marco;marcar('data-marco',b.dataset.marco);};
  $('bot').onclick=verBot;
  $('jugar').onclick=async()=>{corriendo=false;cancelAnimationFrame(raf);$('estado').textContent=API.tipos[tipo].nombre+' está abierta.';
    const r=await API.iniciar({tipo,cartaId:PRUEBAS[tipo].carta,personaje:{nombre:'Viajero'}});
    $('estado').textContent=r?.cancelado?'Prueba cerrada.':r?.sobrevivio?'Sobreviviste a '+API.tipos[tipo].nombre+'.':API.tipos[tipo].nombre+' te alcanzó.';};
  /* Revisión: irA(t) juega desde cero hasta t a pasos de 1/fps pintando cada
     fotograma (los efectos que recuerdan, como el humo al morir, salen igual). */
  window.CAOZ_PESADILLAS3D_REVISION=Object.freeze({
    elegir,
    irA(t,fps=30){corriendo=false;cancelAnimationFrame(raf);nuevo();const n=Math.round(t*fps);for(let i=0;i<n;i++){paso(1/fps);s.ambiente=s.modelo.t+3;pintar();}return this.estado();},
    avanzar(dt=1/30){paso(dt);s.ambiente=s.modelo.t+3;pintar();return this.estado();},
    estado:()=>s&&{tipo,t:s.modelo.t,vidas:s.modelo.vidas,enemigos:s.modelo.enemigos.length,marcas:s.modelo.marcas.length,losas:s.modelo.losas.length,rayos:s.modelo.rayos.length,muertes:s.modelo.muertes,
      jugador:{x:+s.modelo.jugador.x.toFixed(6),y:+s.modelo.jugador.y.toFixed(6)},terminado:s.modelo.terminado,activo3d:!!PRUEBAS[tipo].mundo()?.activo,arte:!!PRUEBAS[tipo].mundo()?.arteListo},
    proyectar:(x,y)=>API.sueloDesdePantalla[tipo](s,x,y),
    pantalla:(x,y)=>PRUEBAS[tipo].mundo()?.pantallaDesdeSuelo(x,y),
    mundo:()=>{const w=PRUEBAS[tipo].mundo();return w&&{activo:w.activo,ancho:w.anchoPintado};},
    // Primera persona: dónde cae en pantalla un punto del suelo a d unidades delante del jugador.
    delante(d=3){const p=s.modelo.jugador,x=p.x+Math.cos(p.a)*d,y=p.y+Math.sin(p.a)*d,r=esc.getBoundingClientRect();return {punto:PRUEBAS[tipo].mundo()?.pantallaDesdeSuelo(x,y),ancho:r.width,alto:r.height};},
    // Pone al héroe (de esta copia) en un punto, deja que la cámara lo siga y devuelve dónde se ve y el tamaño del escenario.
    mirarHeroe(x,y){nuevo();s.modelo.jugador.x=x;s.modelo.jugador.y=y;for(let i=0;i<120;i++){s.ambiente=3+i/30;pintar();}
      const w=PRUEBAS[tipo].mundo(),r=esc.getBoundingClientRect();return {punto:w?.pantallaDesdeSuelo(x,y),ancho:r.width,alto:r.height};},
  });
  elegir(tipo);
  if(q.get('auto')==='1')verBot();
})();

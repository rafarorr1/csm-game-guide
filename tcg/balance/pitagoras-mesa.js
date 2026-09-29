/* La mesa infectada por el Editor. Todo se mide en píxeles del visor: el zoom
   del escritorio nunca escala dos veces los tentáculos. Esta capa no modifica
   cartas, Alma, turnos ni resultados; su única memoria es el daño que ya vio. */
'use strict';
(function(global){
  if(typeof document==='undefined')return;
  const TAU=Math.PI*2,limitar=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  const suave=n=>{n=limitar(n);return n*n*(3-2*n);};
  const TIEMPOS=Object.freeze({disolucion:2300,mesa:700,reducida:240,mesaReducida:160});
  const terminadas=new WeakSet(),grabados=new Map();
  let escena=null,residuo=null,espectro=null,espectroSolicitado=false;
  const reducir=()=>!!global.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  const ahora=()=>global.performance?.now?.()||Date.now();
  function local(g){return !!(g?.campana?.jefeSecreto&&!g.online&&!g.guest&&!(typeof NET!=='undefined'&&NET.on));}
  function sinEfectos(g){return !!(g.fast||g.silent||g.auto);}
  function rect(n){if(!n)return null;const r=n.getBoundingClientRect();return r.width>0&&r.height>0?{x:r.left,y:r.top,w:r.width,h:r.height}:null;}
  function visible(){const b=document.getElementById('board');return !!(b?.classList.contains('on')&&rect(b));}
  function limpiarRetrato(e){if(!e?.lider)return;e.lider.classList.remove('pmEditorDisolviendo','pmEditorDesvanecido');e.lider.style.removeProperty('--pm-retrato');}
  function limpiar(e,terminada){
    if(!e)return;cancelAnimationFrame(e.raf);e.raf=0;e.timers.forEach(clearTimeout);e.timers.length=0;
    e.observador?.disconnect();e.retiros.forEach(fn=>fn());e.retiros.length=0;e.canvas?.remove();e.fallback?.remove();e.canvas=null;e.fallback=null;e.c=null;if(e.niebla){e.niebla.l.width=e.niebla.l.height=1;e.niebla=null;}if(e.piel){e.piel.width=e.piel.height=1;e.piel=null;e.patronPiel=null;}
    if(!terminada)limpiarRetrato(e);if(escena===e)escena=null;
    const resolver=e.resolver;e.resolver=null;if(resolver)resolver(!!terminada);
  }
  function cancelar(){
    const e=escena;if(e){if(e.fase==='disolviendo'||e.fase==='mesa')terminadas.add(e.g);limpiar(e,false);}
    limpiarRetrato(residuo);residuo=null;
  }
  function geometria(e){
    const campo=rect(document.getElementById('field')),tablero=rect(document.getElementById('mesa')||document.getElementById('board'));
    if(!campo||!tablero)return false;
    e.ancho=Math.max(1,global.innerWidth||document.documentElement.clientWidth);e.alto=Math.max(1,global.innerHeight||document.documentElement.clientHeight);
    e.campo=campo;e.tablero=tablero;e.lider=document.getElementById('leaderFoe');
    const rostro=rect(e.lider?.querySelector('.retratoPitagoras')),lider=rect(e.lider);
    e.rostro=rostro||lider;e.origen={x:(rostro||lider)?.x+((rostro||lider)?.w||0)*.55||campo.x+campo.w*.18,y:rostro?rostro.y+rostro.h*.79:lider?lider.y+lider.h*.78:campo.y};
    e.dpr=Math.min(global.devicePixelRatio||1,1.5);
    if(e.canvas){const w=Math.round(e.ancho*e.dpr),h=Math.round(e.alto*e.dpr);if(e.canvas.width!==w||e.canvas.height!==h){e.canvas.width=w;e.canvas.height=h;}}
    const protegidos='#foeField .card,#myField .card,#foeTraps .card,#myTraps .card,#midRow .placecard,#midRow>button,#midRow>div>span,#leaderMe,#barMe,#barFoe,#pilasMe,#pilasFoe,#myPiles,#foePiles,#myGrave,#foeGrave,#controls,#handzone,#panel,#prompt';
    e.mascaras=[...document.querySelectorAll(protegidos)].map(rect).filter(Boolean);
    // El retrato queda por delante de sus raíces; al morir las esporas sí lo cruzan.
    if(lider&&e.fase==='vivo')e.mascaras.push(lider);
    return true;
  }
  function cargarSilueta(){
    if(espectro||espectroSolicitado)return;espectroSolicitado=true;
    const img=new Image();img.decoding='async';
    img.onload=()=>{
      // Sólo llena una caché de arte. Una descarga tardía jamás monta una
      // escena, altera la partida ni programa un fotograma después de cancelar.
      try{
        const l=document.createElement('canvas'),w=600,h=Math.round(w*img.naturalHeight/img.naturalWidth);l.width=w;l.height=h;const c=l.getContext('2d');if(!c)return;
        c.drawImage(img,0,0,w,h);const d=c.getImageData(0,0,w,h),a=d.data;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4,luz=Math.max(a[i],a[i+1],a[i+2]),distancia=Math.hypot((x/w-.5)/.53,(y/h-.49)/.55);
          // Retira el negro del archivo y funde los extremos, conservando el
          // rostro y los monitores; no queda un rectángulo encima del tapete.
          a[i+3]=Math.round(a[i+3]*suave((luz-3)/35)*(1-suave((distancia-.79)/.22)));
        }
        c.putImageData(d,0,0);espectro=l;
      }catch(_){/* La invasión procedural conserva todo el juego si falta arte. */}
    };
    img.onerror=()=>{};img.src='art/pitagoras-abismo-v216.webp';
  }
  function silueta(e,c,alpha){
    if(!espectro)return;const f=e.campo,q=e.progreso,h=f.h*1.25,w=h*espectro.width/espectro.height,x=f.x+(f.w-w)/2,y=f.y-f.h*(e.ancho<700 ? .07 : .02);
    e.silueta={x,y,w,h};c.save();c.globalAlpha=alpha*(.10+.46*suave(q));c.drawImage(espectro,x,y,w,h);c.restore();
    // Apenas dos rescoldos en ese rostro enorme, distintos de la carta rival.
    c.save();c.globalAlpha=alpha*suave((q-.12)/.88)*(.32+latido(e)*.15);c.fillStyle='#df787c';c.shadowColor='#d01638';c.shadowBlur=6+q*8;
    for(const u of [.486,.514]){c.beginPath();c.ellipse(x+w*u,y+h*.076,Math.max(1,w*.0026),Math.max(.65,w*.0016),0,0,TAU);c.fill();}c.restore();
    for(const [u,v] of [[.5,.08],[.47,.13],[.52,.23],[.28,.24],[.72,.26],[.16,.39],[.80,.42],[.45,.53],[.62,.68],[.27,.77],[.73,.81]])e.puntos.push({x:x+w*u,y:y+h*v,r:4});
  }
  function escuchar(e,nombre,fn){global.addEventListener(nombre,fn);e.retiros.push(()=>global.removeEventListener(nombre,fn));}
  function crear(g){
    const canvas=document.createElement('canvas');canvas.className='pitMesaInvasion';canvas.setAttribute('aria-hidden','true');canvas.setAttribute('role','presentation');
    const e={g,canvas,c:null,raf:0,timers:[],retiros:[],observador:null,fase:'vivo',inicio:ahora(),ultimo:0,tiempo:0,objetivo:0,progreso:0,alma:40,particulas:[],puntos:[],mascaras:[],resolver:null,promesa:null,medir:true,geometriaEn:0};
    try{e.c=canvas.getContext('2d',{alpha:true});}catch(_){e.c=null;}
    document.body.appendChild(canvas);escena=e;
    if(!e.c){e.fallback=document.createElement('div');e.fallback.className='pitMesaInvasion pmMesaAlternativa';e.fallback.setAttribute('aria-hidden','true');document.body.appendChild(e.fallback);}
    const marcar=()=>{e.medir=true;};escuchar(e,'resize',marcar);escuchar(e,'orientationchange',marcar);
    if(global.visualViewport){global.visualViewport.addEventListener('resize',marcar);global.visualViewport.addEventListener('scroll',marcar);e.retiros.push(()=>{global.visualViewport.removeEventListener('resize',marcar);global.visualViewport.removeEventListener('scroll',marcar);});}
    if(global.ResizeObserver){e.observador=new ResizeObserver(marcar);['field','leaderFoe','board'].forEach(id=>{const n=document.getElementById(id);if(n)e.observador.observe(n);});}
    cargarSilueta();geometria(e);e.raf=requestAnimationFrame(t=>fotograma(e,t));return e;
  }
  function vestirCartas(g){
    if(!local(g)||!global.PITAGORAS_CINE?.pintarCarta)return;
    const unidades=new Map((g.pl||[]).flatMap(p=>(p.field||[]).map(u=>[String(u.uid),u.card])));
    document.querySelectorAll('#board .card').forEach(n=>{
      const carta=unidades.get(n.dataset.uid)||(typeof CARDS!=='undefined'?CARDS[n.dataset.card]:null),tipo=carta?.editorJuego;if(!tipo)return;
      // Una ilustración subida por el estudio siempre tiene prioridad sobre el grabado.
      if(n.classList.contains('conarte')||n.querySelector('.marcoDibujo'))return;
      const art=n.querySelector('.art');if(!art||art.querySelector('.pmEditorGrabado'))return;
      let fuente=grabados.get(tipo);
      if(!fuente){
        const c=document.createElement('canvas');c.style.cssText='position:fixed;left:-1000px;top:0;width:220px;height:260px;pointer-events:none;visibility:hidden';document.body.appendChild(c);
        try{if(!c.getContext('2d'))return;global.PITAGORAS_CINE.pintarCarta(c,tipo,0,true);fuente=c.toDataURL();if(fuente!=='data:,')grabados.set(tipo,fuente);}catch(_){fuente=null;}finally{c.remove();}
      }
      if(!fuente)return;
      const img=document.createElement('img');img.className='pmEditorGrabado';img.alt='';img.setAttribute('aria-hidden','true');img.src=fuente;
      art.textContent='';art.appendChild(img);n.dataset.editorMesa=tipo;
    });
  }
  function actualizar(g){
    if(typeof G!=='undefined'&&G!==g)return;
    if(!local(g)){cancelar();return;}
    vestirCartas(g);
    if(residuo&&residuo.g!==g){limpiarRetrato(residuo);residuo=null;}
    if(escena&&escena.g!==g)limpiar(escena,false);
    if(terminadas.has(g)||sinEfectos(g))return;
    let e=escena;if(!e){if(g.over||!visible())return;e=crear(g);}
    if(e.fase!=='vivo')return;
    const inicial=Math.max(1,Number(g.campana.alma)||40);e.alma=Math.max(0,Number(g.pl?.[1]?.alma)||0);
    e.objetivo=Math.max(e.objetivo,limitar((inicial-e.alma)/inicial));e.medir=true;
  }
  function puntoCurva(p0,p1,p2,p3,t){const u=1-t;return{x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y};}
  function trayecto(e,indice,t){
    const f=e.campo,o=e.origen,lado=indice%2?-1:1,capa=Math.floor(indice/2),ancho=f.w,alto=f.h;
    const ext=.16+e.progreso*.84,alcance=suave(limitar((ext-capa*.035)/(1-capa*.035))),s=limitar(t*alcance);
    const borde=f.x+ancho*(lado<0?.035+.063*capa:.965-.063*capa);
    const fin={x:borde+lado*Math.sin(capa*1.4)*ancho*.05,y:f.y+alto*(.77+capa*.06)};
    const p1={x:o.x+lado*ancho*(.23+capa*.035),y:o.y-alto*(.015+capa*.012)};
    const p2={x:borde-lado*ancho*.09,y:f.y+alto*(.25+capa*.125)};
    const p=puntoCurva(o,p1,p2,fin,s),fase=e.reducido?0:e.tiempo;
    const serpiente=Math.sin(s*TAU*(1.35+capa*.20)+indice*1.7-fase*.7)*ancho*(.017+capa*.004)*Math.sin(s*Math.PI);
    p.x+=serpiente;p.y+=Math.sin(s*TAU*1.3+indice+fase*.45)*alto*.012*Math.sin(s*Math.PI);
    // La punta se enrolla sobre sí misma, en vez de terminar como un cable recto.
    const curva=suave((s-.68)/.32),a=(s-.68)*11.5+indice*.9;
    p.x+=Math.cos(a)*ancho*.052*curva;p.y+=Math.sin(a)*alto*.055*curva;
    return p;
  }
  function contorno(c,puntos,escala,desfase=0){
    const izq=[],der=[];
    for(let i=0;i<puntos.length;i++){const p=puntos[i],a=puntos[Math.max(0,i-1)],b=puntos[Math.min(puntos.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;
      izq.push({x:p.x+nx*(p.r*escala+desfase),y:p.y+ny*(p.r*escala+desfase)});der.push({x:p.x-nx*(p.r*escala-desfase),y:p.y-ny*(p.r*escala-desfase)});}
    const todos=izq.concat(der.reverse());c.beginPath();c.moveTo(todos[0].x,todos[0].y);
    for(let i=1;i<todos.length;i++){const p=todos[i],q=todos[(i+1)%todos.length];c.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);}c.closePath();
  }
  // Ruido de valor entero: la niebla es una textura pequeña reutilizada, no
  // cientos de sombras CSS ni una lectura de píxeles a resolución del teléfono.
  function semilla(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
  function ruido(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=suave(x-ix),fy=suave(y-iy),a=semilla(ix,iy),b=semilla(ix+1,iy),c=semilla(ix,iy+1),d=semilla(ix+1,iy+1);return a+(b-a)*fx+(c-a+(a-b-c+d)*fx)*fy;}
  function niebla(e,c,alpha){
    const f=e.campo,q=e.progreso,t=e.reducido?0:e.tiempo;
    if(!e.niebla){const l=document.createElement('canvas');l.width=100;l.height=Math.max(72,Math.min(180,Math.round(100*f.h/f.w)));const ctx=l.getContext('2d');if(ctx)e.niebla={l,ctx,datos:ctx.createImageData(l.width,l.height),en:-1,q:-1};}
    const n=e.niebla;if(!n)return;
    if(n.q<0||Math.abs(n.q-q)>.02||(!e.reducido&&t-n.en>.16)){
      n.en=t;n.q=q;const w=n.l.width,h=n.l.height,a=n.datos.data,origenX=(e.origen.x-f.x)/f.w,origenY=(e.origen.y-f.y)/f.h;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=x/w,v=y/h,r1=ruido(u*5.7+t*.065,v*6.2-t*.055),r2=ruido(u*13.2+r1*.8-t*.035,v*14.7+r1*1.1+t*.022),r3=ruido(u*29.4,v*31.3+t*.12),nube=r1*.58+r2*.32+r3*.10;
        const borde=Math.pow(Math.abs(u-.5)*2,2.4),distancia=Math.hypot((u-origenX)*.68,(v-origenY)*.8),avance=suave((.28+q*.90-distancia+(nube-.5)*.40)/.32),frente=suave((Math.max(0,origenY)+.12+q*1.20-v+(nube-.5)*.36)/.30);
        const tinta=limitar((.20+q*.30)*avance+(.35+q*.22)*borde*frente),aura=suave((nube-.31)/.50),i=(y*w+x)*4;
        a[i]=11+Math.round(nube*35);a[i+1]=8+Math.round(nube*22);a[i+2]=20+Math.round(nube*35);a[i+3]=Math.round(255*tinta*(.58+aura*.42));
      }
      n.ctx.putImageData(n.datos,0,0);
    }
    c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=true;c.drawImage(n.l,f.x,f.y,f.w,f.h);c.restore();
  }
  function latido(e){if(e.reducido)return .2;const t=e.tiempo%2.7;return Math.exp(-Math.pow((t-.18)*13,2))*.70+Math.exp(-Math.pow((t-.48)*15,2))*.35;}
  function oscuridad(e,c,alpha){
    const f=e.campo,o=e.origen,q=e.progreso,pulso=latido(e);
    c.save();c.globalAlpha=alpha;
    const m=c.createRadialGradient(o.x,o.y,0,o.x,o.y,Math.max(f.w,f.h)*(.27+q*.93));m.addColorStop(0,'#010105ef');m.addColorStop(.25,'#030207b3');m.addColorStop(.70,'#08061066');m.addColorStop(1,'#02020900');c.fillStyle=m;c.fillRect(f.x,f.y,f.w,f.h);
    const profundidad=f.w*(.035+q*.18),inicioY=Math.max(f.y,o.y-f.h*(.05+q*.55)),largo=Math.min(f.y+f.h-inicioY,f.h*limitar(.16+q*1.1)),onda=e.reducido?0:e.tiempo*.30;
    for(const lado of [-1,1]){
      const borde=f.x+(lado>0?f.w:0),contornoBorde=[];c.beginPath();c.moveTo(borde,inicioY);c.lineTo(borde,inicioY+largo);
      for(let i=30;i>=0;i--){const t=i/30,y=inicioY+largo*t,a=Math.sin(t*31+lado*2+onda)*.12+Math.sin(t*69-onda*.5)*.045,ancho=profundidad*(.85-t*.25+a)*suave(t/.13)*(1-suave((t-.78)/.22));contornoBorde.push({x:borde-lado*ancho,y});}
      for(let i=0;i<contornoBorde.length-1;i++){const p=contornoBorde[i],sig=contornoBorde[i+1];c.quadraticCurveTo(p.x,p.y,(p.x+sig.x)/2,(p.y+sig.y)/2);}c.closePath();
      const grad=c.createLinearGradient(borde,f.y,borde-lado*profundidad,f.y);grad.addColorStop(0,'#010204');grad.addColorStop(.63,'#03030a');grad.addColorStop(1,'#0d0a13e6');c.fillStyle=grad;c.fill();c.lineWidth=.8;c.strokeStyle='#7662751c';c.stroke();
    }
    // El corazón de la infección es una silueta irregular detrás del retrato.
    const radio=Math.max(24,Math.min(f.w,f.h)*(.095+q*.095))*(1+pulso*.045);
    c.beginPath();for(let i=0;i<=64;i++){const a=i/64*TAU,r=radio*(.83+.12*Math.sin(a*5+.4)+.06*Math.sin(a*11-onda)),x=o.x+Math.cos(a)*r*1.20,y=o.y+Math.sin(a)*r*.78;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();
    const nucleo=c.createRadialGradient(o.x-radio*.17,o.y,0,o.x,o.y,radio);nucleo.addColorStop(0,'#020205');nucleo.addColorStop(.72,'#07070c');nucleo.addColorStop(1,'#17111e');c.fillStyle=nucleo;c.fill();c.strokeStyle='#76545d35';c.lineWidth=1;c.stroke();
    // Poros de la masa, más próximos a tierra/corteza que a una superficie lisa.
    for(let i=0;i<28;i++){const a=i*2.39996,r=radio*Math.sqrt((i+.5)/28),x=o.x+Math.cos(a)*r*1.03,y=o.y+Math.sin(a)*r*.62;c.fillStyle=i%4?'#28202a36':'#8b5d6621';c.beginPath();c.ellipse(x,y,1.1+(i%3)*.8,.8+i%2,a,0,TAU);c.fill();}
    c.restore();niebla(e,c,alpha);
  }
  function derivacion(e,c,p,a,largo,ancho,indice,alpha){
    const t=e.reducido?0:e.tiempo,sentido=indice%2?1:-1,fin={x:p.x+Math.cos(a)*largo,y:p.y+Math.sin(a)*largo},p1={x:p.x+Math.cos(a-.48*sentido)*largo*.55,y:p.y+Math.sin(a-.48*sentido)*largo*.55},p2={x:fin.x+Math.cos(a+1.2*sentido)*largo*.5,y:fin.y+Math.sin(a+1.2*sentido)*largo*.5},ps=[];
    for(let j=0;j<=24;j++){const u=j/24,k=puntoCurva(p,p1,p2,fin,u);k.x+=Math.sin(u*7+t*.35+indice)*u*u*3;k.r=Math.max(.24,ancho*Math.pow(1-u,.8));ps.push(k);}
    c.save();c.globalAlpha=alpha;contorno(c,ps,1.35);c.fillStyle='#030309bd';c.fill();contorno(c,ps,1);c.fillStyle='#15111c';c.fill();c.strokeStyle='#57404e55';c.lineWidth=.65;c.stroke();contorno(c,ps,.26,-ancho*.37);c.fillStyle='#81717e21';c.fill();c.restore();
    e.puntos.push(...ps.filter((_,i)=>i%6===0));
  }
  function tubo(e,c,indice,alpha){
    const pulso=latido(e),n=52,f=e.campo,q=e.progreso,capa=Math.floor(indice/2),grosor=Math.max(10,Math.min(32,f.w*.046))*(1.12-capa*.12)*(1+q*.68),puntos=[];
    for(let j=0;j<=n;j++){const t=j/n,p=trayecto(e,indice,t);p.r=Math.max(.32,grosor*Math.pow(1-t,.82))*(1+Math.sin(t*63+indice)*.055)*(1+pulso*.025);puntos.push(p);}
    e.puntos.push(...puntos.filter((_,i)=>i%4===0));
    // Las raíces finas se abren bajo los brazos mayores, evitando el aspecto
    // de diez cables paralelos pegados a la superficie de la mesa.
    if(indice<8&&q>.10){for(let j=0;j<3;j++){const k=15+j*11,p=puntos[k],ant=puntos[k-1],sig=puntos[k+1],a=Math.atan2(sig.y-ant.y,sig.x-ant.x)+(indice%2?1:-1)*(1+j*.10),crece=suave((q-.08-j*.16)/.45);if(crece>0)derivacion(e,c,p,a,Math.min(f.w,f.h)*(.08+j*.055)*crece,p.r*.27,indice+j,alpha*.88);}}
    c.save();c.globalAlpha=alpha;c.translate(1,grosor*.22);contorno(c,puntos,1.25);c.fillStyle='#000107c9';c.fill();c.restore();
    c.save();c.globalAlpha=alpha;const grad=c.createLinearGradient(f.x,f.y,f.x+f.w,f.y+f.h);grad.addColorStop(0,'#211823');grad.addColorStop(.22,'#090910');grad.addColorStop(.52,'#15101c');grad.addColorStop(.78,'#08090f');grad.addColorStop(1,'#241923');
    contorno(c,puntos,1);c.fillStyle=grad;c.fill();c.strokeStyle='#59434f88';c.lineWidth=.85;c.stroke();
    contorno(c,puntos,.86,-grosor*.05);c.fillStyle='#37253480';c.fill();
    contorno(c,puntos,.63,-grosor*.16);c.fillStyle='#65404c39';c.fill();
    contorno(c,puntos,.30,-grosor*.34);c.fillStyle='#bc8c932b';c.fill();
    contorno(c,puntos,.35,grosor*.35);c.fillStyle='#01030a81';c.fill();
    if(!e.piel){const l=document.createElement('canvas');l.width=l.height=96;const ctx=l.getContext('2d');if(ctx){const d=ctx.createImageData(96,96);for(let k=0;k<96*96;k++){const n=semilla(k%96,k/96|0),i=k*4;d.data[i]=92;d.data[i+1]=68;d.data[i+2]=89;d.data[i+3]=n>.87?Math.round((n-.87)*210):0;}ctx.putImageData(d,0,0);e.piel=l;e.patronPiel=c.createPattern(l,'repeat');}}
    if(e.patronPiel){contorno(c,puntos,.93);c.fillStyle=e.patronPiel;c.fill();}
    // Bordes húmedos asimétricos, tendones y ventosas hundidas en carne oscura.
    for(let j=4;j<n-3;j+=3){const p=puntos[j],a=puntos[j-1],b=puntos[j+1],ang=Math.atan2(b.y-a.y,b.x-a.x);c.save();c.translate(p.x,p.y);c.rotate(ang);
      c.strokeStyle='#78607331';c.lineWidth=.65;c.beginPath();c.ellipse(0,0,p.r*.40,p.r*.95,0,-1.10,1.32);c.stroke();c.translate(0,p.r*.50);
      c.fillStyle='#020409';c.strokeStyle='#69515c99';c.lineWidth=Math.max(.5,p.r*.075);c.beginPath();c.ellipse(0,0,Math.max(.6,p.r*.26),Math.max(.4,p.r*.18),0,0,TAU);c.fill();c.stroke();
      c.strokeStyle='#ac818353';c.lineWidth=.5;c.beginPath();c.ellipse(-.6,-.4,p.r*.21,p.r*.13,0,Math.PI*.92,Math.PI*1.7);c.stroke();c.restore();}
    for(let v=0;v<2;v++){c.beginPath();puntos.forEach((p,j)=>{const a=puntos[Math.max(0,j-1)],b=puntos[Math.min(n,j+1)],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,o=p.r*(v?.33:-.46)+Math.sin(j*.71+indice)*p.r*.09,x=p.x-dy/d*o,y=p.y+dx/d*o;j?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle=v?'#6d263c5c':'#9c697957';c.lineWidth=Math.max(.55,grosor*.030);c.stroke();}
    // Dos pulsos lentos viajan bajo la piel; nunca destellos rápidos de pantalla.
    if(!e.reducido&&q>.12){const avance=(e.tiempo*.11+indice*.17)%1,k=Math.min(n-2,Math.floor(avance*(n-2))),p=puntos[k];c.globalAlpha=alpha*(.20+q*.30);const luz=c.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*1.35);luz.addColorStop(0,'#b7365366');luz.addColorStop(1,'#7e1c3400');c.fillStyle=luz;c.beginPath();c.arc(p.x,p.y,p.r*1.35,0,TAU);c.fill();}
    c.restore();
  }
  function mascaras(e,c){
    c.save();c.globalCompositeOperation='destination-out';c.globalAlpha=1;c.fillStyle='#000';
    for(const r of e.mascaras){c.beginPath();const pad=5;c.roundRect?ronda(c,r.x-pad,r.y-pad,r.w+pad*2,r.h+pad*2,7):c.rect(r.x-pad,r.y-pad,r.w+pad*2,r.h+pad*2);c.fill();}
    c.restore();
  }
  function ronda(c,x,y,w,h,r){c.roundRect(x,y,w,h,r);}
  function crearEsporas(e){
    const fuentes=e.puntos.length?e.puntos:[e.origen],retrato=e.rostro||{x:e.origen.x-20,y:e.origen.y-20,w:40,h:40};e.particulas=[];
    const cantidad=e.reducido?36:(e.ancho<700?280:380);
    for(let i=0;i<cantidad;i++){const k=i*.61803398875%1,p=fuentes[(i*17)%fuentes.length],delRostro=i%3===0,x=delRostro?retrato.x+((i*37)%101)/101*retrato.w:p.x,y=delRostro?retrato.y+((i*59)%103)/103*retrato.h:p.y,a=i*2.399963;
      e.particulas.push({x,y,dx:Math.cos(a)*(25+k*160),dy:-35-k*95,r:.7+k*2.6,demora:delRostro?k*.30:.12+k*.7,giro:i*.79,color:i%9?'#211e29':'#ada48f'});}
  }
  function alternativa(e){
    if(!e.fallback||!e.campo)return;
    const f=e.campo,dis=e.fase==='disolviendo'?limitar((ahora()-e.disolucionInicio)/e.disolucionMs):e.fase==='mesa'?1:0;
    e.fallback.style.opacity=String(1-suave(dis));
    const mascaras=e.mascaras.map(r=>`<rect x="${r.x-3}" y="${r.y-3}" width="${r.w+6}" height="${r.h+6}" rx="7" fill="black"/>`).join('');
    const trazos=[];
    for(let i=0;i<6+Math.floor(e.progreso*4);i++){
      const puntos=[];for(let j=0;j<=40;j++)puntos.push(trayecto(e,i,j/40));
      const d=puntos.map((p,j)=>(j?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' '),grosor=Math.max(6,Math.min(30,f.w*.05))*(1+e.progreso*.4);
      trazos.push(`<path d="${d}" fill="none" stroke="#080810" stroke-width="${grosor+4}"/><path d="${d}" fill="none" stroke="#15101d" stroke-width="${grosor}"/><path d="${d}" fill="none" stroke="#9b65723b" stroke-width="1"/>`);
    }
    e.fallback.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${e.ancho} ${e.alto}"><defs><mask id="pmMesaMascara"><rect width="100%" height="100%" fill="black"/><rect x="${f.x}" y="${Math.min(f.y,e.origen.y)}" width="${f.w}" height="${f.h+Math.max(0,f.y-e.origen.y)}" fill="white"/>${mascaras}</mask></defs><g mask="url(#pmMesaMascara)" stroke-linecap="round" stroke-linejoin="round"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="#03020a" opacity="${.08+e.progreso*.32}"/>${trazos.join('')}</g></svg>`;
  }
  function mirada(e,c,alpha){
    const img=e.lider?.querySelector('.retratoPitagoras'),r=e.rostro;if(!img||!r||!img.naturalWidth)return;
    const ancho=img.naturalWidth,alto=img.naturalHeight||ancho*1.25,escala=Math.max(r.w/ancho,r.h/alto),x=r.x+(r.w-ancho*escala)/2,y=r.y+(r.h-alto*escala)/2,latir=latido(e);
    c.save();c.globalAlpha=alpha*(.2+e.progreso*.65);c.fillStyle='#ee7f79';c.shadowColor='#b70028';c.shadowBlur=3+latir*4+e.progreso*3;
    for(const u of [.486,.514]){c.beginPath();c.ellipse(x+ancho*escala*u,y+alto*escala*.076,Math.max(.4,r.w*.011),Math.max(.3,r.w*.004),-.12,0,TAU);c.fill();}c.restore();
  }
  function pintar(e){
    const c=e.c;if(!e.campo)return;if(!c){alternativa(e);return;}const costeInicio=ahora();
    c.setTransform(e.dpr,0,0,e.dpr,0,0);c.clearRect(0,0,e.ancho,e.alto);
    const f=e.campo,b=e.tablero,dis=e.fase==='disolviendo'?limitar((ahora()-e.disolucionInicio)/e.disolucionMs):e.fase==='mesa'?1:0;
    if(e.fase==='mesa')return;
    const opacidad=1-suave((dis-.06)/.80);e.puntos=[];
    c.save();c.beginPath();c.rect(Math.max(0,b.x),Math.max(0,b.y),Math.min(b.w,e.ancho-b.x),Math.min(b.h,e.alto-b.y));c.clip();
    oscuridad(e,c,opacidad);silueta(e,c,opacidad);
    for(let i=9;i>=0;i--){const crecer=i<4?1:suave((e.progreso-(i-4)*.085)/.30);if(crecer>0)tubo(e,c,i,opacidad*crecer);}
    // Esporas ambientales: pocos puntos, movimiento lento y ninguna llamada al azar del motor.
    if(!e.reducido&&dis===0){c.save();c.globalAlpha=.3+e.progreso*.2;for(let i=0;i<32+e.progreso*40;i++){const x=f.x+((i*.61803398875+Math.sin(e.tiempo*.12+i)*.03)%1)*f.w,y=f.y+((i*.381966+1-e.tiempo*(.012+i%5*.003))%1+1)%1*f.h;c.fillStyle=i%8?'#aaa0ac':'#b5938c';c.beginPath();c.arc(x,y,i%4?.6:1.15,0,TAU);c.fill();}c.restore();}
    c.restore();mascaras(e,c);mirada(e,c,opacidad);
    if(dis>0){
      const tiempo=(ahora()-e.disolucionInicio)/1000;c.save();
      for(const p of e.particulas){const edad=tiempo-p.demora;if(edad<0)continue;const vida=limitar(1-edad/(e.reducido ? .23 : 1.38));if(!vida)continue;
        const x=p.x+p.dx*edad+Math.sin(edad*4+p.giro)*edad*9,y=p.y+p.dy*edad-edad*edad*19;c.globalAlpha=vida*.85;c.fillStyle=p.color;c.beginPath();c.ellipse(x,y,p.r*(.7+vida),p.r*(.35+vida*.4),p.giro+edad,0,TAU);c.fill();}
      c.restore();
    }
    e.costoPintura=(e.costoPintura||0)*.85+Math.max(0,ahora()-costeInicio)*.15;
  }
  function fotograma(e,t){
    if(escena!==e)return;e.raf=0;
    if(!visible()||(typeof G!=='undefined'&&G!==e.g)){cancelar();return;}
    const dt=Math.min(.1,Math.max(0,(t-(e.ultimo||t))/1000));e.ultimo=t;e.reducido=reducir();e.tiempo=Math.max(0,(t-e.inicio)/1000);
    e.progreso=e.reducido?e.objetivo:e.progreso+(e.objetivo-e.progreso)*(1-Math.exp(-dt*2.4));
    if(e.medir||t-e.geometriaEn>250){geometria(e);e.medir=false;e.geometriaEn=t;}
    if(e.fase==='disolviendo'){const q=limitar((t-e.disolucionInicio)/e.disolucionMs);e.lider?.style.setProperty('--pm-retrato',String(1-suave(q/.50)));}
    // El organismo se mueve despacio: 30 pinturas/s bastan, sin cargar el móvil.
    if(!document.hidden&&t-(e.pinturaEn||0)>(e.reducido?100:32)){pintar(e);e.pinturaEn=t;}
    e.raf=requestAnimationFrame(v=>fotograma(e,v));
  }
  function despues(e,ms,fn){
    const t=setTimeout(()=>{
      e.timers=e.timers.filter(x=>x!==t);if(escena!==e)return;
      // Una pestaña oculta puede ejecutar este reloj sin haber pintado otro
      // fotograma. Nunca permitir que la muerte anterior oculte al rival nuevo.
      if((typeof G!=='undefined'&&G!==e.g)||!visible()){cancelar();return;}
      fn();
    },ms);e.timers.push(t);
  }
  function disolver(g){
    if(typeof G!=='undefined'&&G!==g)return Promise.resolve(false);
    if(!local(g))return Promise.resolve(false);
    if(terminadas.has(g))return Promise.resolve(false);
    if(escena?.g===g&&escena.promesa)return escena.promesa;
    if(sinEfectos(g)){terminadas.add(g);if(escena?.g===g)limpiar(escena,true);return Promise.resolve(true);}
    if(escena?.g!==g)cancelar();
    // El botón beta también puede ganar sin haber pintado antes un turno.
    const e=escena||crear(g);e.objetivo=1;e.progreso=Math.max(e.progreso,.65);e.fase='disolviendo';e.reducido=reducir();
    e.disolucionMs=e.reducido?TIEMPOS.reducida:TIEMPOS.disolucion;e.disolucionInicio=ahora();geometria(e);e.medir=true;
    pintar(e);crearEsporas(e);e.lider?.classList.add('pmEditorDisolviendo');
    e.promesa=new Promise(resolve=>{e.resolver=resolve;});
    despues(e,e.disolucionMs,()=>{
      e.fase='mesa';e.lider?.classList.remove('pmEditorDisolviendo');e.lider?.classList.add('pmEditorDesvanecido');e.lider?.style.removeProperty('--pm-retrato');e.particulas=[];pintar(e);
      despues(e,e.reducido?TIEMPOS.mesaReducida:TIEMPOS.mesa,()=>{terminadas.add(g);residuo=e;limpiar(e,true);});
    });
    return e.promesa;
  }
  const css=document.createElement('style');css.id='pitagorasMesaCSS';css.textContent=`
    .pitMesaInvasion{position:fixed;inset:0;width:100%;height:100%;z-index:110;pointer-events:none!important;touch-action:none;contain:strict}
    #leaderFoe.pmEditorDisolviendo>.identidadPitagoras{opacity:var(--pm-retrato,1);filter:saturate(var(--pm-retrato,1))}
    #leaderFoe.pmEditorDesvanecido>*{visibility:hidden!important}
    #board .card[data-editor-mesa] .art{overflow:hidden}
    #board .card .pmEditorGrabado{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;pointer-events:none;filter:saturate(.84) contrast(1.1)}
  `;document.head.appendChild(css);
  global.PITAGORAS_MESA={actualizar,vestirCartas,disolver,cancelar,tiempos:TIEMPOS,get estado(){const e=escena||residuo;return{revision:224,siluetaLista:!!espectro,silueta:e?.silueta?{...e.silueta}:null,pinturaMs:Number((e?.costoPintura||0).toFixed(2)),activo:!!escena,fase:e?.fase||'inactivo',progreso:e?.progreso||0,objetivo:e?.objetivo||0,alma:e?.alma??null,particulas:e?.particulas.length||0,ancho:e?.ancho||0,alto:e?.alto||0,origen:e?.origen?{...e.origen}:null,rafActivo:!!e?.raf};}};
})(typeof window!=='undefined'?window:globalThis);

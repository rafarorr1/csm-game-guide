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
  let escena=null,residuo=null;
  const reducir=()=>!!global.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  const ahora=()=>global.performance?.now?.()||Date.now();
  function local(g){return !!(g?.campana?.jefeSecreto&&!g.online&&!g.guest&&!(typeof NET!=='undefined'&&NET.on));}
  function sinEfectos(g){return !!(g.fast||g.silent||g.auto);}
  function rect(n){if(!n)return null;const r=n.getBoundingClientRect();return r.width>0&&r.height>0?{x:r.left,y:r.top,w:r.width,h:r.height}:null;}
  function visible(){const b=document.getElementById('board');return !!(b?.classList.contains('on')&&rect(b));}
  function limpiarRetrato(e){if(!e?.lider)return;e.lider.classList.remove('pmEditorDisolviendo','pmEditorDesvanecido');e.lider.style.removeProperty('--pm-retrato');}
  function limpiar(e,terminada){
    if(!e)return;cancelAnimationFrame(e.raf);e.raf=0;e.timers.forEach(clearTimeout);e.timers.length=0;
    e.observador?.disconnect();e.retiros.forEach(fn=>fn());e.retiros.length=0;e.canvas?.remove();e.fallback?.remove();e.canvas=null;e.fallback=null;e.c=null;
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
    geometria(e);e.raf=requestAnimationFrame(t=>fotograma(e,t));return e;
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
  function tubo(e,c,indice,alpha){
    const n=52,f=e.campo,grosor=Math.max(8,Math.min(27,f.w*.037))*(1.05-Math.floor(indice/2)*.11)*(1+e.progreso*.45),puntos=[];
    for(let j=0;j<=n;j++){const t=j/n,p=trayecto(e,indice,t);p.r=Math.max(.45,grosor*Math.pow(1-t,.76))*(1+Math.sin(t*72+indice)*.035);puntos.push(p);}
    e.puntos.push(...puntos.filter((_,i)=>i%4===0));
    c.save();c.globalAlpha=alpha;c.translate(1,4);contorno(c,puntos,1.12);c.fillStyle='#020207b0';c.shadowColor='#000a';c.shadowBlur=grosor*.8;c.fill();c.restore();
    c.save();c.globalAlpha=alpha;const grad=c.createLinearGradient(f.x,f.y,f.x+f.w,f.y+f.h);grad.addColorStop(0,'#414146');grad.addColorStop(.3,'#29252f');grad.addColorStop(.7,'#191923');grad.addColorStop(1,'#37343a');
    contorno(c,puntos,1);c.fillStyle=grad;c.fill();c.strokeStyle='#0b0b12';c.lineWidth=1.2;c.stroke();
    contorno(c,puntos,.69,-grosor*.12);c.fillStyle='#625a6430';c.fill();
    // Pliegues de piel, ventosas hundidas y dos venas que laten bajo la corteza.
    for(let j=3;j<n-3;j+=3){const p=puntos[j],a=puntos[j-1],b=puntos[j+1],ang=Math.atan2(b.y-a.y,b.x-a.x);c.save();c.translate(p.x,p.y);c.rotate(ang);c.strokeStyle='#ac879535';c.lineWidth=.7;c.beginPath();c.ellipse(0,0,p.r*.38,p.r*.9,0,-1.35,1.35);c.stroke();
      c.translate(0,p.r*.55);c.fillStyle='#101117';c.strokeStyle='#78647088';c.lineWidth=Math.max(.6,p.r*.12);c.beginPath();c.ellipse(0,0,Math.max(.6,p.r*.29),Math.max(.4,p.r*.21),0,0,TAU);c.fill();c.stroke();c.restore();}
    for(let v=0;v<2;v++){c.beginPath();puntos.forEach((p,j)=>{const a=puntos[Math.max(0,j-1)],b=puntos[Math.min(n,j+1)],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,o=p.r*(v?.30:-.42)+Math.sin(j*.62+indice)*p.r*.1,x=p.x-dy/d*o,y=p.y+dx/d*o;j?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle=v?'#8e485458':'#bb77734a';c.lineWidth=Math.max(.65,grosor*.055);c.stroke();}
    // Un pulso rojizo recorre la carne con cada avance de la infección.
    if(!e.reducido){const p=puntos[Math.floor(((e.tiempo*.17+indice*.13)%1)*(n-2))];c.fillStyle='#b5747645';c.beginPath();c.arc(p.x,p.y,p.r*.42,0,TAU);c.fill();}
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
    const cantidad=e.reducido?36:240;
    for(let i=0;i<cantidad;i++){const k=i*.61803398875%1,p=fuentes[(i*17)%fuentes.length],delRostro=i%3===0,x=delRostro?retrato.x+((i*37)%101)/101*retrato.w:p.x,y=delRostro?retrato.y+((i*59)%103)/103*retrato.h:p.y,a=i*2.399963;
      e.particulas.push({x,y,dx:Math.cos(a)*(25+k*160),dy:-35-k*95,r:.7+k*2.6,demora:delRostro?k*.30:.12+k*.7,giro:i*.79,color:i%7?'#34333e':'#a1a97c'});}
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
      trazos.push(`<path d="${d}" fill="none" stroke="#080810" stroke-width="${grosor+4}"/><path d="${d}" fill="none" stroke="#3a303f" stroke-width="${grosor}"/><path d="${d}" fill="none" stroke="#a86a764a" stroke-width="1"/>`);
    }
    e.fallback.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${e.ancho} ${e.alto}"><defs><mask id="pmMesaMascara"><rect width="100%" height="100%" fill="black"/><rect x="${f.x}" y="${Math.min(f.y,e.origen.y)}" width="${f.w}" height="${f.h+Math.max(0,f.y-e.origen.y)}" fill="white"/>${mascaras}</mask></defs><g mask="url(#pmMesaMascara)" stroke-linecap="round" stroke-linejoin="round">${trazos.join('')}</g></svg>`;
  }
  function pintar(e){
    const c=e.c;if(!e.campo)return;if(!c){alternativa(e);return;}
    c.setTransform(e.dpr,0,0,e.dpr,0,0);c.clearRect(0,0,e.ancho,e.alto);
    const f=e.campo,b=e.tablero,dis=e.fase==='disolviendo'?limitar((ahora()-e.disolucionInicio)/e.disolucionMs):e.fase==='mesa'?1:0;
    if(e.fase==='mesa')return;
    const opacidad=1-suave((dis-.06)/.80);e.puntos=[];
    c.save();c.beginPath();c.rect(Math.max(0,b.x),Math.max(0,b.y),Math.min(b.w,e.ancho-b.x),Math.min(b.h,e.alto-b.y));c.clip();
    const bruma=c.createRadialGradient(e.origen.x,e.origen.y,0,e.origen.x,e.origen.y,Math.max(f.w,f.h)*(.23+e.progreso*.8));bruma.addColorStop(0,'#09071088');bruma.addColorStop(.60,'#170e252a');bruma.addColorStop(1,'#03030b00');c.globalAlpha=opacidad;c.fillStyle=bruma;c.fillRect(f.x,f.y,f.w,f.h);c.globalAlpha=1;
    const cantidad=6+Math.floor(e.progreso*4);for(let i=cantidad-1;i>=0;i--)tubo(e,c,i,opacidad*(.88-(i>5?.2:0)));
    // Esporas ambientales: pocos puntos, movimiento lento y ninguna llamada al azar del motor.
    if(!e.reducido&&dis===0){c.save();c.globalAlpha=.3+e.progreso*.2;for(let i=0;i<32+e.progreso*40;i++){const x=f.x+((i*.61803398875+Math.sin(e.tiempo*.12+i)*.03)%1)*f.w,y=f.y+((i*.381966+1-e.tiempo*(.012+i%5*.003))%1+1)%1*f.h;c.fillStyle=i%8?'#aaa0ac':'#b5938c';c.beginPath();c.arc(x,y,i%4?.6:1.15,0,TAU);c.fill();}c.restore();}
    c.restore();mascaras(e,c);
    if(dis>0){
      const tiempo=(ahora()-e.disolucionInicio)/1000;c.save();
      for(const p of e.particulas){const edad=tiempo-p.demora;if(edad<0)continue;const vida=limitar(1-edad/(e.reducido ? .23 : 1.38));if(!vida)continue;
        const x=p.x+p.dx*edad+Math.sin(edad*4+p.giro)*edad*9,y=p.y+p.dy*edad-edad*edad*19;c.globalAlpha=vida*.85;c.fillStyle=p.color;c.beginPath();c.ellipse(x,y,p.r*(.7+vida),p.r*(.35+vida*.4),p.giro+edad,0,TAU);c.fill();}
      c.restore();
    }
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
  global.PITAGORAS_MESA={actualizar,vestirCartas,disolver,cancelar,tiempos:TIEMPOS,get estado(){const e=escena||residuo;return{activo:!!escena,fase:e?.fase||'inactivo',progreso:e?.progreso||0,objetivo:e?.objetivo||0,alma:e?.alma??null,particulas:e?.particulas.length||0,ancho:e?.ancho||0,alto:e?.alto||0,origen:e?.origen?{...e.origen}:null,rafActivo:!!e?.raf};}};
})(typeof window!=='undefined'?window:globalThis);

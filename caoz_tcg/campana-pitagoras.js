/* Epílogo secreto de la campaña. Escenografía local, sin reglas de combate.
   Cada escena posee sus temporizadores y se desmonta sin dejar animaciones vivas. */
'use strict';
(function(){
  const TIEMPOS=Object.freeze({esporas:2000,implosion:1800,revelacion:4200,lectura:6000,negro:1000});
  window.PITAGORAS_TIEMPOS=TIEMPOS;
  const reducir=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  function escena(host,clase){
    const elemento=document.createElement('section');elemento.className=clase;host.appendChild(elemento);
    const timers=new Set(),limpiezas=[];let viva=true,raf=0,generacion=0;
    const e={elemento,get activa(){return viva;},esperar(ms,fn){const id=setTimeout(()=>{timers.delete(id);if(viva)fn();},ms);timers.add(id);return id;},
      dibujar(fn){let ultimo=-Infinity;const propia=++generacion;function cuadro(t){if(!viva||propia!==generacion)return;if(!document.hidden&&t-ultimo>=32){ultimo=t;fn(t);}if(viva&&propia===generacion)raf=requestAnimationFrame(cuadro);}raf=requestAnimationFrame(cuadro);},
      parar(){generacion++;cancelAnimationFrame(raf);raf=0;},limpiezas,
      destruir(){if(!viva)return;viva=false;e.parar();timers.forEach(clearTimeout);timers.clear();limpiezas.forEach(fn=>fn());elemento.remove();}
    };return e;
  }
  function lienzo(e,clase){
    const c=document.createElement('canvas');c.className=clase;c.setAttribute('aria-hidden','true');e.elemento.appendChild(c);
    const ctx=c.getContext('2d');let w=1,h=1;
    function ajustar(){w=e.elemento.clientWidth||innerWidth;h=e.elemento.clientHeight||innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);}
    const ro=new ResizeObserver(ajustar);ro.observe(e.elemento);e.limpiezas.push(()=>ro.disconnect());ajustar();
    return{c,ctx,get w(){return w;},get h(){return h;}};
  }
  const ARTE='art/pitagoras-abismo-v216.webp',ANCHO_ARTE=1122,ALTO_ARTE=1402;
  let aparicionRevelada=null;
  const REVELACION=Object.freeze({desplazar:1800,ojos:2200,presencia:3600,desvelar:3600,revelado:7600,reducido:1200});
  window.PITAGORAS_REVELACION_TIEMPOS=REVELACION;
  window.retratoPitagoras=()=>ARTE;
  function posicionValida(origen){return{x:Number.isFinite(origen?.x)?Math.max(0,Math.min(1,origen.x)):.5,y:Number.isFinite(origen?.y)?Math.max(0,Math.min(1,origen.y)):.5};}
  function montarAbismo(host,personaje){
    const e=escena(host,'pitEscena pitAbismo');
    e.elemento.innerHTML='<div class="pitPresencia"><div class="pitContorno" aria-hidden="true"></div><img class="pitIlustracion pitCriaturaImagen" alt="Pitágoras, una criatura monstruosa fusionada con su computadora, dos monitores y una maraña de cables" decoding="async"><div class="pitOjos" aria-hidden="true"><i></i><i></i></div></div><div class="pitTestigo"><div class="pitCirculoLuz" aria-hidden="true"></div><div class="pitFiguraTestigo"></div></div><button class="pitBoss" type="button" aria-label="Combatir contra Pitágoras, el editor"><span class="pitBossNombre"><strong>Pitágoras</strong><span>El editor</span><small>Combatir <span aria-hidden="true">↗</span></small></span></button>';
    const imagen=e.elemento.querySelector('.pitCriaturaImagen'),presencia=e.elemento.querySelector('.pitPresencia'),testigo=e.elemento.querySelector('.pitTestigo'),vista=e.elemento.querySelector('.pitFiguraTestigo'),boss=e.elemento.querySelector('.pitBoss');
    const origen={x:.5,y:.5};let proporcion=1,cargada=false,fallo=false,cuandoCargue=null,alCombatir=null,iniciado=false;
    function combatir(){if(iniciado||!e.activa||boss.disabled)return;iniciado=true;boss.disabled=true;e.elemento.dataset.fase='combate';alCombatir?.();}
    boss.addEventListener('click',combatir);e.limpiezas.push(()=>{boss.removeEventListener('click',combatir);alCombatir=null;});
    function ajustar(){
      const w=e.elemento.clientWidth||innerWidth,h=e.elemento.clientHeight||innerHeight,altoHeroe=Math.max(72,Math.min(130,h*.18)),pie=Math.max(altoHeroe+10,h-92),altoImagen=Math.min(h-104,w*.98*ALTO_ARTE/ANCHO_ARTE),anchoImagen=altoImagen*ANCHO_ARTE/ALTO_ARTE;
      presencia.style.width=anchoImagen+'px';presencia.style.height=altoImagen+'px';presencia.style.top=Math.max(8,(pie-altoImagen)*.45)+'px';
      testigo.style.width=altoHeroe*.8+'px';testigo.style.height=altoHeroe+'px';
      const suavizado=proporcion*proporcion*(3-2*proporcion);
      testigo.style.left=(origen.x*w+(w*.5-origen.x*w)*suavizado)+'px';testigo.style.top=(origen.y*h+(pie-origen.y*h)*suavizado)+'px';
      e.elemento.style.setProperty('--pit-pie',pie+'px');e.elemento.style.setProperty('--pit-heroe-alto',altoHeroe+'px');
      boss.style.bottom=Math.max(96,h-pie+altoHeroe+10)+'px';
    }
    function imagenLista(){if(!e.activa)return;cargada=true;e.elemento.dataset.arte=fallo?'alternativa':'listo';cuandoCargue?.();}
    const alCargar=()=>imagenLista(),alFallar=()=>{fallo=true;imagenLista();};
    imagen.addEventListener('load',alCargar);imagen.addEventListener('error',alFallar);imagen.src=ARTE;
    if(imagen.complete&&imagen.naturalWidth)imagenLista();
    e.esperar(12000,()=>{if(!cargada){fallo=true;imagenLista();}});
    e.limpiezas.push(()=>{imagen.removeEventListener('load',alCargar);imagen.removeEventListener('error',alFallar);cuandoCargue=null;});
    const ro=new ResizeObserver(ajustar);ro.observe(e.elemento);e.limpiezas.push(()=>ro.disconnect());ajustar();miniatura(vista,personaje,e);
    return Object.assign(e,{boss,imagen,presencia,testigo,
      posicion(p,nuevoOrigen){proporcion=Math.max(0,Math.min(1,p));if(nuevoOrigen)Object.assign(origen,posicionValida(nuevoOrigen));ajustar();},
      habilitarCombate(fn){if(!e.activa||iniciado)return;e.parar();e.posicion(1);alCombatir=fn;e.elemento.dataset.fase='trono';e.elemento.setAttribute('aria-label','Pitágoras, el editor');boss.disabled=false;boss.removeAttribute('tabindex');boss.removeAttribute('aria-hidden');if(aparicionRevelada===e)aparicionRevelada=null;},
      alCargar(fn){cuandoCargue=fn;if(cargada)fn();}
    });
  }
  window.montarEscenaPitagoras=function(host,{onFight,personaje}={}){
    const e=montarAbismo(host,personaje);
    // Mover el mismo nodo ya decodificado evita un cuadro negro de Safari al
    // sustituir la revelación por su encuentro, incluso con decoding async.
    if(aparicionRevelada?.activa&&aparicionRevelada.imagen.naturalWidth){const foto=aparicionRevelada.imagen;e.imagen.replaceWith(foto);e.imagen=foto;e.elemento.dataset.arte=aparicionRevelada.elemento.dataset.arte;aparicionRevelada=null;}
    e.habilitarCombate(onFight);
    return e;
  };
  window.montarRevelacionPitagoras=function(host,{personaje,origen,onRevelado}={}){
    const e=montarAbismo(host,personaje),reducido=reducir(),inicio=performance.now();let listo=false,presenciaIniciada=false,permisoImagen=false;
    e.elemento.dataset.fase='vacio';e.elemento.setAttribute('aria-label','Algo despierta en la oscuridad');e.boss.disabled=true;e.boss.tabIndex=-1;e.boss.setAttribute('aria-hidden','true');e.posicion(reducido?1:0,origen);
    if(!reducido)e.dibujar(t=>{const p=Math.min(1,(t-inicio)/REVELACION.desplazar);e.posicion(p);if(p===1)e.parar();});
    // Sólo ojos y protagonista antes de que el cuerpo se forme en la oscuridad.
    e.esperar(reducido?200:REVELACION.ojos,()=>{e.posicion(1);e.parar();e.elemento.dataset.fase='ojos';globalThis.CAOZ_AUDIO?.play('spell_shadow');});
    function revelar(){
      if(!e.activa||presenciaIniciada||!permisoImagen)return;presenciaIniciada=true;
      e.elemento.style.setProperty('--pit-revelar',reducido?'900ms':REVELACION.desvelar+'ms');e.elemento.dataset.fase='surgiendo';
      e.esperar(reducido?900:REVELACION.desvelar+400,()=>{listo=true;e.elemento.dataset.fase='revelado';aparicionRevelada=e;onRevelado?.();});
    }
    e.alCargar(revelar);
    e.esperar(reducido?300:REVELACION.presencia,()=>{permisoImagen=true;e.alCargar(revelar);});
    e.limpiezas.push(()=>{if(aparicionRevelada===e)aparicionRevelada=null;});Object.defineProperty(e,'revelado',{get:()=>listo});return e;
  };
  window.montarEsporasPitagoras=function(host,{onCubierto}={}){
    const e=escena(host,'pitEsporas');e.elemento.dataset.fase='esporas';const l=lienzo(e,'pitCapaParticulas'),inicio=performance.now(),duracion=reducir()?200:TIEMPOS.esporas;
    const motas=Array.from({length:180},(_,i)=>({x:(i*.61803398875)%1,y:(i*.754877666)%1,r:5+i%19,a:i*2.3999}));let cubierto=false;
    if(l.ctx&&!reducir())e.dibujar(t=>{
      const p=Math.min(1,(t-inicio)/duracion),{ctx,w,h}=l;ctx.clearRect(0,0,w,h);
      const crecimiento=.3+p*p*5;
      for(const m of motas){const x=m.x*w+Math.sin(t*.001+m.a)*32*p,y=h*(1.2-m.y*p*1.4),r=m.r*crecimiento;
        ctx.beginPath();ctx.ellipse(x,y,r*.75,r,Math.sin(t*.0008+m.a),0,Math.PI*2);ctx.fillStyle='#010204';ctx.fill();ctx.strokeStyle=`rgba(63,85,64,${.24*(1-p)})`;ctx.lineWidth=1;ctx.stroke();
        if(p<.8){ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+13,y-r-15,x+3,y-r-27);ctx.stroke();}
      }
      ctx.fillStyle=`rgba(0,0,0,${Math.max(0,(p-.36)/.64)})`;ctx.fillRect(0,0,w,h);
    });
    // El negro final es DOM: también funciona sin Canvas o con pestaña oculta.
    e.elemento.style.setProperty('--pit-duracion',duracion+'ms');
    e.esperar(duracion,()=>{cubierto=true;e.parar();e.elemento.dataset.fase='cubierto';onCubierto?.();});
    Object.defineProperty(e,'cubierto',{get:()=>cubierto});return e;
  };
  function miniatura(host,personaje,e){
    const c=document.createElement('canvas');c.className='pitMiniatura';c.setAttribute('role','img');c.setAttribute('aria-label','Tu miniatura, en la oscuridad');host.appendChild(c);
    if(typeof campanaGeometriaPersonaje!=='function'||typeof campanaPintarRetrato!=='function'){const img=document.createElement('img');img.alt='Tu protagonista';img.src=typeof campanaRetrato==='function'?campanaRetrato(personaje):'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340"><ellipse cx="120" cy="305" rx="75" ry="14" fill="#171a1a"/><circle cx="120" cy="96" r="35" fill="#73786d"/><path d="M79 135Q120 114 161 135L181 292H59Z" fill="#363d3c"/></svg>');img.className='pitMiniatura';c.replaceWith(img);return;}
    const ctx=c.getContext('2d');if(!ctx)return;
    const caras=campanaGeometriaPersonaje(personaje);function pintar(){if(!e.activa)return;const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(!w||!h)return;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);campanaPintarRetrato(ctx,caras,w,h,-.2);}
    const ro=new ResizeObserver(pintar);ro.observe(host);e.limpiezas.push(()=>ro.disconnect());pintar();
  }
  window.montarFinalPitagoras=function(host,{personaje,nombre,onTerminar}={}){
    const e=escena(host,'pitFinal');e.elemento.dataset.fase='implosion';
    const cuarto=document.createElement('div');cuarto.className='pitCuarto';cuarto.innerHTML='<div class="pitLuzCuarto" aria-hidden="true"></div><div class="pitHeroe"></div><p class="pitReconocimiento" aria-live="polite"></p>';
    e.elemento.appendChild(cuarto);miniatura(cuarto.querySelector('.pitHeroe'),personaje,e);
    const l=lienzo(e,'pitCapaParticulas'),inicio=performance.now(),reducido=reducir();
    const paneles=Array.from({length:28},(_,i)=>({a:i*Math.PI/14,r:.42+(i%5)*.075,v:1+(i%3)*.19}));
    if(l.ctx&&!reducido)e.dibujar(t=>{
      const p=Math.min(1,(t-inicio)/TIEMPOS.implosion),{ctx,w,h}=l,cx=w/2,cy=h*.48,radio=Math.hypot(w,h);ctx.clearRect(0,0,w,h);
      ctx.fillStyle=p<.58?'#080d12':'#020305';ctx.fillRect(0,0,w,h);
      for(const q of paneles){const avance=p<.56?Math.pow(1-p/.56,2):Math.pow((p-.56)/.44,.65)*1.55;const r=radio*q.r*avance,a=q.a+(p<.56?p*p*1.8:p*.22),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r,tam=radio*(p<.56?.13:.045)*(p<.56?1-p:.8);
        ctx.save();ctx.translate(x,y);ctx.rotate(a+p*q.v);ctx.beginPath();ctx.moveTo(-tam,-tam*.6);ctx.lineTo(tam*.85,-tam*.45);ctx.lineTo(tam*.43,tam);ctx.closePath();ctx.fillStyle=p<.56?'#18222b':`rgba(199,223,192,${Math.max(0,(1-p)*1.6)})`;ctx.fill();ctx.strokeStyle=p<.56?'#506252':'#dce3c2';ctx.lineWidth=1;ctx.stroke();ctx.restore();}
      const pulso=Math.max(0,1-Math.abs(p-.59)/.12);
      if(pulso>0){const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(1,radio*pulso*.75));g.addColorStop(0,'#f5ffe8');g.addColorStop(.09,'#d6edbd');g.addColorStop(.35,'#7f9c7770');g.addColorStop(1,'#23322800');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
      if(p>.75){ctx.fillStyle=`rgba(0,0,0,${(p-.75)/.25})`;ctx.fillRect(0,0,w,h);}
    });
    const mensaje=cuarto.querySelector('.pitReconocimiento');
    const identidad=typeof nombre==='string'&&nombre.trim()?nombre.trim().slice(0,24):typeof campanaNormalizarPersonaje==='function'?campanaNormalizarPersonaje(personaje).nombre:'Viajero';
    const frase='Tú, '+identidad+', tú sí eres el verdadero Caoz Con Todo.';
    function leer(){e.elemento.dataset.fase='texto';mensaje.textContent=frase;
      e.esperar(TIEMPOS.lectura,()=>{e.elemento.dataset.fase='negro';e.esperar(TIEMPOS.negro,()=>{if(e.activa)onTerminar?.();});});
    }
    e.esperar(reducido?200:TIEMPOS.implosion,()=>{e.parar();l.c.remove();e.elemento.dataset.fase='cuarto';
      // Un único anuncio accesible evita leer una frase nueva por cada letra.
      if(reducido){leer();return;}mensaje.setAttribute('aria-live','off');
      const letras=Array.from(frase),intervalo=TIEMPOS.revelacion/letras.length;let visibles=0;
      function escribir(){if(!e.activa)return;visibles++;mensaje.textContent=letras.slice(0,visibles).join('');if(visibles<letras.length)e.esperar(intervalo,escribir);else{mensaje.setAttribute('aria-live','polite');leer();}}
      e.esperar(400,escribir);
    });
    return e;
  };
  const css=document.createElement('style');css.textContent=`
    .pitEscena,.pitFinal,.pitEsporas{position:absolute;inset:0;box-sizing:border-box;width:100%;height:100%;overflow:hidden;isolation:isolate}
    .pitAbismo{background:#000;color:#d4ddc8;text-align:center}
    .pitPresencia{position:absolute;left:50%;translate:-50% 0;pointer-events:none;max-width:100%;max-height:100%;}
    .pitCriaturaImagen{display:block;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity var(--pit-revelar,3600ms) cubic-bezier(.33,.05,.5,1);filter:brightness(.88);pointer-events:none}
    .pitContorno{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 12%,#a3b3a822,transparent 10%),radial-gradient(ellipse at 50% 52%,#26332d44,transparent 45%);pointer-events:none}
    .pitAbismo[data-arte="alternativa"] .pitCriaturaImagen{visibility:hidden}.pitAbismo[data-arte="alternativa"][data-fase="surgiendo"] .pitContorno,.pitAbismo[data-arte="alternativa"][data-fase="trono"] .pitContorno,.pitAbismo[data-arte="alternativa"][data-fase="revelado"] .pitContorno{opacity:1}
    .pitOjos{position:absolute;inset:0;opacity:0;transition:opacity 1100ms ease-in;pointer-events:none}.pitOjos i{position:absolute;top:7.5%;width:.65%;height:.24%;min-width:2px;min-height:1.2px;border-radius:50%;background:#d9f2c2;box-shadow:0 0 4px 1px #a4e18fbb,0 0 11px 3px #8dbd7433}.pitOjos i:first-child{left:48.25%}.pitOjos i:last-child{left:51.15%}
    .pitAbismo[data-fase="ojos"] .pitOjos,.pitAbismo[data-fase="surgiendo"] .pitOjos{opacity:1}.pitAbismo[data-fase="revelado"] .pitOjos,.pitAbismo[data-fase="trono"] .pitOjos{opacity:0;transition:opacity .4s}
    .pitAbismo[data-fase="surgiendo"] .pitCriaturaImagen,.pitAbismo[data-fase="revelado"] .pitCriaturaImagen,.pitAbismo[data-fase="trono"] .pitCriaturaImagen,.pitAbismo[data-fase="combate"] .pitCriaturaImagen{opacity:1}
    .pitAbismo[data-fase="trono"] .pitCriaturaImagen,.pitAbismo[data-fase="combate"] .pitCriaturaImagen,.pitAbismo[data-fase="trono"] .pitBossNombre{transition:none}
    .pitTestigo{position:absolute;translate:-50% -100%;pointer-events:none;z-index:3}.pitFiguraTestigo{position:absolute;inset:0;filter:brightness(.91) saturate(.73) drop-shadow(0 0 5px #d4ddab22)}.pitCirculoLuz{position:absolute;left:50%;bottom:5%;translate:-50% 0;width:115%;height:18%;border-radius:50%;background:radial-gradient(ellipse,#c3c9a425,#959e7512 40%,transparent 71%);filter:blur(3px)}
    .pitBoss{position:absolute;top:8%;left:8%;width:84%;max-width:980px;margin:0 auto;right:8%;border:0;padding:0;background:transparent;color:#d3dbc2;cursor:pointer;-webkit-tap-highlight-color:transparent;outline-offset:3px;border-radius:12px;z-index:4}
    .pitBossNombre{position:absolute;bottom:0;left:50%;translate:-50% 0;display:grid;justify-items:center;gap:2px;white-space:nowrap;text-shadow:0 3px 14px #000,0 2px 5px #000;opacity:0;transition:opacity 700ms,scale 200ms;pointer-events:none}.pitBossNombre strong{font:600 clamp(28px,4vw,46px)/1.1 var(--serif,Georgia,serif);letter-spacing:1px}.pitBossNombre>span{font:italic 13px/1.3 var(--serif,Georgia,serif);color:#a2aa96}.pitBossNombre small{margin-top:6px;padding:8px 18px;border:1px solid #a3ae6d77;border-radius:3px;background:#0c130edb;font:500 12px/1.1 var(--sans,sans-serif);letter-spacing:1px;color:#c0cda9}.pitBossNombre small span{padding-left:12px}
    .pitAbismo[data-fase="trono"] .pitBossNombre,.pitAbismo[data-fase="revelado"] .pitBossNombre{opacity:1}.pitBoss:disabled{cursor:default;pointer-events:none}.pitBoss:focus-visible{outline:1px solid #c7d496}.pitBoss:focus-visible .pitBossNombre small{border-color:#d7e4ac;background:#1b281c}
    @media(hover:hover){.pitBoss:not(:disabled):hover .pitBossNombre{scale:1.035}.pitBoss:not(:disabled):hover .pitBossNombre small{border-color:#d7e4ac;background:#172218}}
    @media(max-height:450px){.pitBossNombre{left:24%;bottom:8px}.pitBossNombre strong{font-size:27px}.pitBossNombre>span{font-size:11px}.pitBossNombre small{margin-top:3px;font-size:10px}}
    @media(prefers-reduced-motion:reduce){.pitOjos{transition-duration:250ms}.pitBossNombre{transition:none}.pitCriaturaImagen{transition-timing-function:linear}}
    .pitCapaParticulas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}.pitEsporas{z-index:20;pointer-events:auto;background:transparent}.pitEsporas::after{content:'';position:absolute;inset:0;background:#000;opacity:0;animation:pitCubrir var(--pit-duracion,2000ms) ease-in both}.pitEsporas[data-fase="cubierto"]{background:#000}.pitEsporas[data-fase="cubierto"]::after{animation:none;opacity:1}@keyframes pitCubrir{0%,35%{opacity:0}100%{opacity:1}}
    .pitFinal{z-index:10;background:#000;color:#e8e7d7}.pitCuarto{position:absolute;inset:0;display:grid;grid-template-rows:minmax(0,1fr) auto;align-items:end;justify-items:center;padding:9vh 24px 12vh;box-sizing:border-box;opacity:0;background:#000}.pitFinal[data-fase="cuarto"] .pitCuarto,.pitFinal[data-fase="texto"] .pitCuarto{opacity:1;transition:opacity .65s}.pitLuzCuarto{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 69%,#adb6a30f 0,#0000 39%);pointer-events:none}.pitHeroe{position:relative;width:min(390px,74vw);height:100%;max-height:58vh;min-height:0;filter:brightness(.78) saturate(.6);z-index:1}.pitMiniatura{display:block;width:100%;height:100%;object-fit:contain}.pitReconocimiento{position:relative;z-index:2;align-self:start;min-height:3.6em;max-width:760px;margin:22px 0 0;font:500 clamp(21px,3.4vw,38px)/1.4 var(--serif,Georgia,serif);text-align:center;text-wrap:balance;overflow-wrap:anywhere;text-shadow:0 0 22px #c6d1ac33}.pitFinal[data-fase="negro"] .pitCuarto{opacity:0;transition:opacity 1s ease-in}
    @media(max-width:600px){.pitCuarto{padding:9vh 18px 12vh}.pitHeroe{max-height:52vh}.pitReconocimiento{font-size:23px}}
    @media(max-height:520px){.pitCuarto{grid-template-columns:43% 57%;grid-template-rows:1fr;align-items:center;padding:8vh 6vw}.pitHeroe{max-height:80vh;width:100%}.pitReconocimiento{align-self:center;min-height:0;font-size:24px;margin:0}}
    @media(prefers-reduced-motion:reduce){.pitCuarto{transition:none!important}.pitEsporas::after{animation-duration:200ms}}
  `;document.head.appendChild(css);
})();

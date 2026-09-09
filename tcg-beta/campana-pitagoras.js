/* Epílogo secreto de la campaña. Escenografía local, sin reglas de combate.
   Cada escena posee sus temporizadores y se desmonta sin dejar animaciones vivas. */
'use strict';
(function(){
  const TIEMPOS=Object.freeze({esporas:2000,implosion:1800,revelacion:4200,lectura:6000,negro:1000});
  window.PITAGORAS_TIEMPOS=TIEMPOS;
  const reducir=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  let numero=0,retrato=null;
  function escena(host,clase){
    const elemento=document.createElement('section');elemento.className=clase;host.appendChild(elemento);
    const timers=new Set(),limpiezas=[];let viva=true,raf=0;
    const e={elemento,get activa(){return viva;},esperar(ms,fn){const id=setTimeout(()=>{timers.delete(id);if(viva)fn();},ms);timers.add(id);return id;},
      dibujar(fn){let ultimo=-Infinity;function cuadro(t){if(!viva)return;if(!document.hidden&&t-ultimo>=32){ultimo=t;fn(t);}if(viva)raf=requestAnimationFrame(cuadro);}raf=requestAnimationFrame(cuadro);},
      parar(){cancelAnimationFrame(raf);raf=0;},limpiezas,
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
  function definiciones(id){return `<defs>
    <linearGradient id="${id}metal"><stop stop-color="#151e20"/><stop offset=".18" stop-color="#475051"/><stop offset=".38" stop-color="#0d1516"/><stop offset=".7" stop-color="#171e1f"/><stop offset=".93" stop-color="#455456"/><stop offset="1" stop-color="#070d0d"/></linearGradient>
    <linearGradient id="${id}canto"><stop stop-color="#63736f"/><stop offset=".35" stop-color="#a3aca1"/><stop offset=".6" stop-color="#34453f"/><stop offset="1" stop-color="#758579"/></linearGradient>
    <linearGradient id="${id}tela" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3b4546"/><stop offset=".3" stop-color="#242d31"/><stop offset=".65" stop-color="#151b23"/><stop offset="1" stop-color="#080e14"/></linearGradient>
    <linearGradient id="${id}piel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c7c79b"/><stop offset=".45" stop-color="#a89b7f"/><stop offset="1" stop-color="#6a6559"/></linearGradient>
    <linearGradient id="${id}suelo" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#16201d"/><stop offset="1" stop-color="#080d0d"/></linearGradient>
    <radialGradient id="${id}halo"><stop stop-color="#7bcc5660"/><stop offset=".38" stop-color="#345f3735"/><stop offset="1" stop-color="#101b1100"/></radialGradient>
    <linearGradient id="${id}pantalla" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#346452"/><stop offset=".3" stop-color="#15292b"/><stop offset="1" stop-color="#101d25"/></linearGradient>
    <filter id="${id}brillo" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
    <g id="${id}lata"><rect x="-25" y="-64" width="50" height="119" rx="9" fill="url(#${id}metal)" stroke="#68756a" stroke-width="1.5"/><ellipse cy="-61" rx="24" ry="7" fill="url(#${id}canto)"/><ellipse cy="-62" rx="15" ry="3" fill="#273a33"/><path d="M-2-65h9l3 4-8 2-4-3Z" fill="#b2b9a6"/><path d="M-25 49Q0 60 25 49" fill="none" stroke="#798775" stroke-width="3"/><path d="m-15-42 7 3-1 14 3-9 4 2-5 25-5 5 4-25-5 7Zm13 0 6 5-3 30-6 6 4-30-4 9Zm14 0 5 6-4 28-7 8 5-31-5 8Z" fill="#a2d657"/><text y="23" text-anchor="middle" fill="#d8dfc7" font-family="Georgia,serif" font-size="8" letter-spacing=".45">MONSTER</text><text y="34" text-anchor="middle" fill="#93b674" font-family="sans-serif" font-size="4.7" letter-spacing=".5">ENERGY</text><path d="M-18-51v92" stroke="#bdd2a8" opacity=".12" stroke-width="2"/></g>
    <g id="${id}monitor"><path d="M-101-71 104-59 99 71-104 55Z" fill="#060b11" stroke="#6b7c72" stroke-width="3"/><path d="M-94-64 96-52 92 57-97 44Z" fill="url(#${id}pantalla)"/><path d="M-88-56 88-45M-89-47l67 4M-89-39l46 3" stroke="#9db0a3" opacity=".5" stroke-width="2"/><path d="m-88-28 98 6-3 36-97-6Z" fill="#304b3b"/><path d="m-73-1 17-18 14 15 22-18 12 26Z" fill="#799780"/><path d="m20-19 60 4-2 22-59-4Z" fill="#263139"/><path d="m24-13 47 3m-47 6 35 2" stroke="#7298a1" stroke-width="3"/><path d="m-89 14 174 10m-174-2 174 10m-174-2 174 10" stroke="#496753" stroke-width="2"/><path d="m-83 17 48 3m18 1 38 3m-99 2 36 2m18 1 70 5m-88 2 22 1m21 2 52 3" stroke="#a5c57f" stroke-width="5"/><path d="m-1 65 22 1 4 50-20-1Z" fill="#3e4e4b"/><path d="m-35 118 103 5-22 12-110-6Z" fill="#152126" stroke="#53625a"/><circle cx="83" cy="64" r="2" fill="#b5ed8d"/></g>
    <g id="${id}editor">
      <path d="M-91 109Q-128 176-113 239L-71 270 38 266 113 239Q131 192 87 110Z" fill="#151b23" stroke="#536452" stroke-width="2"/>
      <path d="M-91 224Q-120 242-110 285L-83 385-24 375-32 274 4 256 34 283 45 378 107 384 110 278Q111 244 77 219Z" fill="url(#${id}tela)" stroke="#172127" stroke-width="3"/>
      <path d="m-105 272 66-7m-58 23 40 10m98-25 54-8M-78 349l42-8m85 2 43 7" stroke="#809285" opacity=".16" stroke-width="4" fill="none"/>
      <path d="M-84 366Q-122 377-135 406Q-126 425-65 416L-14 407-24 369Z" fill="#0c1218" stroke="#485650" stroke-width="2"/><path d="m-131 407 57 1 57-8" stroke="#6c7b6c" stroke-width="5"/>
      <path d="M47 370 102 374Q143 399 139 417L86 423 34 408Z" fill="#0c1218" stroke="#485650" stroke-width="2"/><path d="m37 405 53 9 46-4" stroke="#6c7b6c" stroke-width="5"/>
      <path d="M-58 83-91 104Q-112 154-93 221L-52 240 58 239 104 218Q125 167 85 105L47 84Z" fill="url(#${id}tela)" stroke="#516153" stroke-width="2"/>
      <path d="M-50 88Q0 120 49 88L66 111 19 137-14 134-68 111Z" fill="#101a21" stroke="#4a5553" stroke-width="2"/>
      <path d="M-45 104-24 160M44 105 23 160" stroke="#97a395" stroke-width="2"/><path d="M-42 201Q0 189 43 201L45 224-40 223Z" fill="#182129" stroke="#435044"/><path d="M-71 130Q-113 118-122 155L-135 195-117 217-79 193-45 156Z" fill="url(#${id}tela)" stroke="#37483b" stroke-width="3"/>
      <path d="M74 130Q107 126 119 148L132 191 111 213 68 182 46 150Z" fill="url(#${id}tela)" stroke="#526052" stroke-width="3"/>
      <path d="M-126 190Q-152 185-163 201L-159 216-118 218-108 207Z" fill="url(#${id}piel)" stroke="#626b55" stroke-width="2"/>
      <path d="M125 187Q150 184 165 195L169 211 135 216 113 202Z" fill="url(#${id}piel)" stroke="#626b55" stroke-width="2"/>
      <path d="m-155 198 26 3m-26 4 26 3m264-8 23-5m-21 11 25-5" stroke="#665f50" stroke-width="1.5"/>
      <path d="M-22 50-20 98Q0 112 24 97L26 49Z" fill="url(#${id}piel)"/>
      <ellipse cy="17" rx="54" ry="67" fill="url(#${id}piel)" stroke="#6c7260" stroke-width="2"/>
      <ellipse cx="-53" cy="20" rx="9" ry="18" fill="#9d9579"/><ellipse cx="54" cy="20" rx="9" ry="18" fill="#85856d"/>
      <path d="M-54 8Q-65-50-19-57Q31-78 51-43L60-25 50 8 39-12 26-23Q-1-8-36-21Z" fill="#202727" stroke="#545c51" stroke-width="2"/>
      <path d="M-41-30Q-3-53 29-35M-22-44Q12-60 39-35" fill="none" stroke="#75806b" opacity=".28" stroke-width="3"/>
      <path d="M-44 26Q-43 69 0 77Q46 72 47 27L33 49 16 42-17 42-32 49Z" fill="#343b35"/>
      <path d="M-15 52Q0 59 16 51" fill="none" stroke="#d2c3a4" stroke-width="2"/><path d="m-2 17-7 19 13 2" fill="none" stroke="#7e7d64" stroke-width="2"/>
      <path d="M-47 3-7 6-9 26-39 26-47 18Zm54 3 42-3-3 17-9 7H9Z" fill="#354c4290" stroke="#131d23" stroke-width="5"/><path d="M-7 9Q0 3 8 9M-55 3l9 3m94-3 7-3" fill="none" stroke="#142025" stroke-width="4"/>
      <path d="m-38 7 16 1M18 8l16-1" stroke="#c4e8b1" opacity=".6" stroke-width="2"/>
      <path d="M-66 19V-19Q-63-72 0-72Q65-73 67-18V20" fill="none" stroke="#0c141a" stroke-width="16"/><path d="M-65-19Q-61-67 0-67Q60-66 66-19" fill="none" stroke="#677164" stroke-width="3"/>
      <rect x="-76" y="-7" width="23" height="52" rx="10" fill="#202c30" stroke="#8dba6e" stroke-width="2"/><rect x="54" y="-7" width="23" height="52" rx="10" fill="#202c30" stroke="#8dba6e" stroke-width="2"/>
      <path d="M66 37Q65 67 30 68" fill="none" stroke="#82937d" stroke-width="4"/><rect x="17" y="62" width="19" height="10" rx="5" fill="#0d161c"/>
    </g>
  </defs>`;}
  function decorado(id){
    let latas='';
    // El respaldo, las columnas y los brazos se apilan realmente por filas.
    for(let fila=0;fila<4;fila++)for(let col=0;col<5;col++)latas+=`<use href="#${id}lata" transform="translate(${405+col*53} ${280+fila*110})"/>`;
    for(const lado of [-1,1])for(let fila=0;fila<5;fila++)latas+=`<use href="#${id}lata" transform="translate(${510+lado*(183-fila*4)} ${318+fila*99}) rotate(${lado*(7-fila)})"/>`;
    for(let col=0;col<7;col++)latas+=`<use href="#${id}lata" transform="translate(${347+col*54} 856) scale(1 .92)"/>`;
    const teclas=Array.from({length:4},(_,j)=>Array.from({length:11},(_,i)=>`<path d="m${791+i*12-j*5} ${817+j*8} 9 1-1 5-9-1Z" fill="#83ac9b" opacity="${.18+(i%3)*.06}"/>`).join('')).join('');
    const runas=Array.from({length:36},(_,i)=>{const a=i*Math.PI/18,x=510+Math.cos(a)*252,y=896+Math.sin(a)*62;return `<path d="m${x.toFixed(1)} ${y.toFixed(1)} 7-3 3 5-7 2Z" fill="#85955b" opacity=".3"/>`;}).join('');
    return `<svg class="pitIlustracion" viewBox="0 40 1200 1040" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pitágoras, el editor, sentado en un trono de latas Monster Energy. A su lado, una computadora con dos monitores.">
      ${definiciones(id)}
      <ellipse cx="515" cy="540" rx="510" ry="500" fill="url(#${id}halo)"/>
      <g fill="none" stroke="#a2bf77" opacity=".13"><circle cx="510" cy="440" r="314"/><circle cx="510" cy="440" r="299"/><path d="M510 107 799 604H221Z"/><path d="m510 773-289-498h578Z"/></g>
      <path d="M0 753 610 642 1200 775v325H0Z" fill="url(#${id}suelo)"/>
      <g fill="none" stroke="#485549" opacity=".24"><path d="M0 858 603 700 1200 870M0 982 600 749l600 250M197 726 37 1100m306-401-30 401m181-428 78 428m75-420 250 420m-100-382 350 382"/></g>
      <ellipse cx="510" cy="906" rx="284" ry="77" fill="#05090e" stroke="#485741" stroke-width="3"/><ellipse cx="510" cy="896" rx="276" ry="72" fill="#202921" stroke="#708058" stroke-width="2"/>
      <ellipse cx="510" cy="896" rx="248" ry="59" fill="none" stroke="#8f9b66" opacity=".3"/>${runas}
      <ellipse cx="511" cy="881" rx="226" ry="44" fill="#000" opacity=".65"/>
      <path d="M327 365 370 217 510 147 650 217 696 365 661 814H356Z" fill="#0f191a" stroke="#55664c" stroke-width="4"/>
      <path d="m510 150-31 61 31-9 31 9Z" fill="#b1d27b"/><path d="m347 309 26-81 137-58 138 58 28 81" fill="none" stroke="#acc17c" opacity=".5" stroke-width="3"/>
      ${latas}
      <path d="M354 651h312l12 108H342Z" fill="#171f23" stroke="#687657" stroke-width="4"/><path d="M355 651q151-45 311 0" fill="none" stroke="#b2b989" stroke-width="5"/>
      <g transform="translate(510 461)"><use href="#${id}editor"/></g>
      <path d="M329 657q-3-25 29-26l60 8 4 27-94 6Zm272-18 63-8q36 2 30 25l1 16-95-6Z" fill="#28302a" stroke="#849570" stroke-width="3"/>
      <use href="#${id}lata" transform="translate(340 608) scale(.72)"/><use href="#${id}lata" transform="translate(681 607) scale(.72)"/>
      <ellipse cx="938" cy="960" rx="245" ry="37" fill="#000" opacity=".55"/>
      <path d="m762 776 332 42-62 95-335-47Z" fill="#181f25" stroke="#596754" stroke-width="3"/>
      <path d="m697 866 335 47v20l-335-47Z" fill="#080e13"/><path d="m735 884-10 90 13 2 21-88m246 36 11 74 13-3-3-68" fill="#222d2c" stroke="#4b5e4c" stroke-width="2"/>
      <use href="#${id}monitor" transform="translate(828 661) rotate(-6) scale(.92)"/>
      <use href="#${id}monitor" transform="translate(1031 675) rotate(5) scale(.87)"/>
      <path d="m783 807 163 20-25 41-163-23Z" fill="#0b141b" stroke="#4a6157" stroke-width="2"/>${teclas}
      <path d="m1000 845 48 7-19 23-49-7Z" fill="#23322c"/><ellipse cx="1016" cy="855" rx="12" ry="8" fill="#0a131a" stroke="#82a077"/><path d="M938 745Q941 791 1035 825" fill="none" stroke="#040a10" stroke-width="4"/>
      <path d="m1088 814 72-10 9 154-72 20Z" fill="#0d181d" stroke="#566850" stroke-width="2"/><path d="m1097 825 53-9 6 130-53 16Z" fill="#131e24"/><g stroke="#8dc669" fill="#121d20"><ellipse cx="1124" cy="855" rx="18" ry="22"/><ellipse cx="1127" cy="914" rx="18" ry="22"/></g><g fill="none" stroke="#5c8d64" opacity=".5"><path d="m1110 840 28 29m-30-3 27-24m-24 53 30 31m-31-4 28-23"/></g>
      <use href="#${id}lata" transform="translate(210 918) rotate(-71) scale(.75)"/><use href="#${id}lata" transform="translate(764 974) rotate(80) scale(.65)"/><use href="#${id}lata" transform="translate(991 922) scale(.62)"/>
      <path d="M0 1060Q570 958 1200 1060v80H0Z" fill="#030709" opacity=".65"/>
    </svg>`;
  }
  window.retratoPitagoras=function(){
    if(retrato)return retrato;const id='pitRetrato';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600">${definiciones(id)}<rect width="480" height="600" fill="#0a1517"/><ellipse cx="240" cy="260" rx="270" ry="330" fill="url(#${id}halo)"/><circle cx="240" cy="225" r="169" fill="none" stroke="#c2d48b" opacity=".4"/><path d="m240 44 167 291H73Z" fill="none" stroke="#94ba7a" opacity=".2"/>${Array.from({length:5},(_,i)=>`<use href="#${id}lata" transform="translate(${85+i*78} 270) scale(1.2 2.8)"/>`).join('')}<use href="#${id}editor" transform="translate(240 252) scale(1.7)"/></svg>`;
    return retrato='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  };
  window.montarEscenaPitagoras=function(host,{onFight,personaje}={}){
    const e=escena(host,'pitEscena');e.elemento.dataset.fase='trono';
    const id='pitEscena'+(++numero);e.elemento.innerHTML='<header class="pitCabecera"><p>EL ÚLTIMO CORTE</p><h1>Pitágoras</h1><span>El editor</span></header><div class="pitEscenario"><div class="pitEscenografia">'+decorado(id)+'</div></div>';
    const escenario=e.elemento.querySelector('.pitEscenario'),arte=e.elemento.querySelector('.pitEscenografia'),boss=document.createElement('button');boss.type='button';boss.className='pitBoss';boss.setAttribute('aria-label','Combatir contra Pitágoras, el editor');boss.innerHTML='<span class="pitBossNombre">Desafiar al editor <span aria-hidden="true">↗</span></span>';
    let iniciado=false;boss.addEventListener('click',()=>{if(iniciado||!e.activa)return;iniciado=true;boss.disabled=true;e.elemento.dataset.fase='combate';onFight?.();});arte.appendChild(boss);
    function encuadrar(){const w=escenario.clientWidth,h=escenario.clientHeight,ancho=Math.min(w,h*1200/1040);arte.style.width=ancho+'px';arte.style.height=ancho*1040/1200+'px';}
    const ro=new ResizeObserver(encuadrar);ro.observe(escenario);e.limpiezas.push(()=>ro.disconnect());encuadrar();
    const motas=Array.from({length:22},(_,i)=>`<i style="--x:${(i*31+17)%100}%;--y:${(i*47+11)%90}%;--d:${8+i%7}s;--r:${2+i%4}px;animation-delay:-${i%11}s"></i>`).join('');
    const bruma=document.createElement('div');bruma.className='pitMotas';bruma.setAttribute('aria-hidden','true');bruma.innerHTML=motas;e.elemento.prepend(bruma);
    function visibilidad(){e.elemento.classList.toggle('pitPausado',document.hidden);}document.addEventListener('visibilitychange',visibilidad);e.limpiezas.push(()=>document.removeEventListener('visibilitychange',visibilidad));visibilidad();
    return Object.assign(e,{boss});
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
    .pitEscena{display:grid;grid-template-rows:auto minmax(0,1fr);padding:clamp(14px,3vh,32px) 12px max(80px,env(safe-area-inset-bottom));background:radial-gradient(ellipse at 43% 56%,#203c2755,transparent 55%),#04080b;color:#e1e8cb;text-align:center}
    .pitCabecera{position:relative;z-index:2;pointer-events:none}.pitCabecera p{margin:0 0 9px;color:#a9bf88;font:700 10px/1.2 var(--sans,sans-serif);letter-spacing:4px}.pitCabecera h1{margin:0;font:700 clamp(34px,5vw,64px)/1 var(--serif,Georgia,serif);letter-spacing:1px;text-shadow:0 3px 25px #c5ee7933}.pitCabecera>span{display:block;margin-top:7px;font:italic 15px/1.2 var(--serif,Georgia,serif);color:#a4ac9c}
    .pitEscenario{position:relative;min-height:0;width:100%;max-width:1160px;margin:auto;height:100%;}.pitEscenografia{position:absolute;left:50%;top:50%;translate:-50% -50%;width:100%;height:100%}.pitIlustracion{display:block;width:100%;height:100%;overflow:visible}
    .pitBoss{position:absolute;top:17%;left:18%;height:75%;width:48%;border:0;padding:0;border-radius:40% 40% 16% 16%;background:transparent;color:#eff6d3;cursor:pointer;-webkit-tap-highlight-color:transparent;outline-offset:5px}
    .pitBossNombre{position:absolute;bottom:0;left:50%;translate:-50% 0;white-space:nowrap;border:1px solid #93a66888;background:linear-gradient(#2f3e2ce8,#13201de8);box-shadow:0 6px 25px #000b,inset 0 0 0 2px #101916;border-radius:5px;padding:11px 20px;font:600 13px/1.2 var(--serif,Georgia,serif);letter-spacing:.8px;transition:scale .18s,box-shadow .18s,border-color .18s}.pitBossNombre>span{margin-left:10px;color:#bdd991}.pitBoss:focus-visible{outline:2px solid #d7efa4}.pitBoss:focus-visible .pitBossNombre{box-shadow:0 0 30px #aacb6766;border-color:#d6eba7}.pitBoss:disabled{cursor:wait;opacity:.6}
    @media(hover:hover){.pitBoss:hover .pitBossNombre{scale:1.045;border-color:#d6eba7;box-shadow:0 0 25px #aacb6744,0 6px 25px #000b}.pitEscenario:has(.pitBoss:hover) .pitIlustracion{filter:brightness(1.1)}}
    .pitMotas{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}.pitMotas i{position:absolute;left:var(--x);top:var(--y);width:var(--r);height:var(--r);border-radius:50%;background:#91ad6a70;box-shadow:0 0 8px #a2d27833;animation:pitDeriva var(--d) ease-in-out infinite alternate}.pitPausado .pitMotas i{animation-play-state:paused}@keyframes pitDeriva{from{translate:-10px 30px;opacity:.12}to{translate:15px -22px;opacity:.55}}
    .pitCapaParticulas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}.pitEsporas{z-index:20;pointer-events:auto;background:transparent}.pitEsporas::after{content:'';position:absolute;inset:0;background:#000;opacity:0;animation:pitCubrir var(--pit-duracion,2000ms) ease-in both}.pitEsporas[data-fase="cubierto"]{background:#000}.pitEsporas[data-fase="cubierto"]::after{animation:none;opacity:1}@keyframes pitCubrir{0%,35%{opacity:0}100%{opacity:1}}
    .pitFinal{z-index:10;background:#000;color:#e8e7d7}.pitCuarto{position:absolute;inset:0;display:grid;grid-template-rows:minmax(0,1fr) auto;align-items:end;justify-items:center;padding:9vh 24px 12vh;box-sizing:border-box;opacity:0;background:#000}.pitFinal[data-fase="cuarto"] .pitCuarto,.pitFinal[data-fase="texto"] .pitCuarto{opacity:1;transition:opacity .65s}.pitLuzCuarto{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 69%,#adb6a30f 0,#0000 39%);pointer-events:none}.pitHeroe{position:relative;width:min(390px,74vw);height:100%;max-height:58vh;min-height:0;filter:brightness(.78) saturate(.6);z-index:1}.pitMiniatura{display:block;width:100%;height:100%;object-fit:contain}.pitReconocimiento{position:relative;z-index:2;align-self:start;min-height:3.6em;max-width:760px;margin:22px 0 0;font:500 clamp(21px,3.4vw,38px)/1.4 var(--serif,Georgia,serif);text-align:center;text-wrap:balance;overflow-wrap:anywhere;text-shadow:0 0 22px #c6d1ac33}.pitFinal[data-fase="negro"] .pitCuarto{opacity:0;transition:opacity 1s ease-in}
    @media(max-width:600px){.pitEscena{padding-top:24px}.pitCabecera p{font-size:8px;letter-spacing:3px}.pitCabecera h1{font-size:42px}.pitBossNombre{font-size:10px;padding:10px 12px;letter-spacing:.3px}.pitCuarto{padding:9vh 18px 12vh}.pitHeroe{max-height:52vh}.pitReconocimiento{font-size:23px}}
    @media(max-height:520px){.pitEscena{padding:10px 10px 80px}.pitCabecera p{display:none}.pitCabecera h1{font-size:28px}.pitCabecera>span{font-size:12px;margin-top:2px}.pitCuarto{grid-template-columns:43% 57%;grid-template-rows:1fr;align-items:center;padding:8vh 6vw}.pitHeroe{max-height:80vh;width:100%}.pitReconocimiento{align-self:center;min-height:0;font-size:24px;margin:0}.pitBossNombre{padding:8px 12px}}
    @media(prefers-reduced-motion:reduce){.pitMotas i{animation:none;opacity:.25}.pitBossNombre,.pitCuarto{transition:none!important}.pitEsporas::after{animation-duration:200ms}.pitIlustracion{filter:none!important}}
  `;document.head.appendChild(css);
})();

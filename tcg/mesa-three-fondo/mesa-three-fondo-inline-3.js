
/* ==========================================================================
   CAOZ CON TODO — TCG · Simulador
   Motor + 92 cartas + IA + tutorial. Sin dependencias.
   ========================================================================== */
'use strict';

/* ---------- utilidades ---------- */

const $  = s => document.querySelector(s);

const $$ = s => [...document.querySelectorAll(s)];
/* LA VERSIÓN PUBLICADA
   El número es cuántas veces se ha tocado el TCG en el historial, así que no es
   un número inventado: cada build se corresponde con un commit concreto y se
   puede ir a ver qué cambió. publicar.sh avisa si se queda desfasado.
   Para las notas de cada versión está CHANGELOG.md. */

const BUILD = {n:302, fecha:'2026-09-28'};

function encajarAncho(nodo, minFactor){
  if(!nodo) return;
  nodo.style.fontSize = '';                       // partir siempre de su tamaño
  const ancho = nodo.clientWidth;
  if(!ancho) return;                              // aún no está en pantalla
  const sobra = nodo.scrollWidth / ancho;
  if(sobra <= 1.001) return;                      // cabe: no se toca
  const base = parseFloat(getComputedStyle(nodo).fontSize);
  const min = base * (minFactor || 0.72);
  const nuevo = Math.max(min, base / sobra * 0.97);
  nodo.style.fontSize = nuevo.toFixed(2) + 'px';

  /* Si ni encogiendo hasta el mínimo cabe —"HUMANO · PALADÍN · CASA BOSS" no
     entra en 126px a ningún tamaño legible— se le da una segunda línea. Antes
     que dejarlo en "CASA B…", que es perder justo el dato. */
  if(nodo.scrollWidth > nodo.clientWidth + 1){
    nodo.style.whiteSpace = 'normal';
    nodo.style.lineHeight = '1.05';
    nodo.style.textOverflow = 'clip';
  }
}

/* El mismo problema pero en vertical: el texto de reglas se corta a media frase
   —39 de las 84 cartas—, justo donde dice qué hace la carta.

   Aquí no vale sólo encoger: el texto está limitado a 4 líneas con line-clamp, y
   el clamp mide en líneas, así que al bajar la fuente encoge también la caja y
   nunca entra más texto. Lo que se hace es cambiar líneas por tamaño: se mide el
   hueco que ocupaba a su tamaño normal, se busca la fuente con la que el texto
   ENTERO cabe en ese mismo hueco, y se sube el clamp a las líneas que caben.
   La carta no crece; el texto deja de cortarse. */

function encajarAlto(nodo, minFactor){
  if(!nodo) return;
  nodo.style.fontSize = '';
  nodo.style.webkitLineClamp = '';
  const hueco = nodo.clientHeight;                    // lo que ocupa tal cual
  if(!hueco) return;                                  // aún no está en pantalla
  nodo.style.webkitLineClamp = 'unset';               // el texto entero, sin cortar
  if(nodo.scrollHeight <= hueco + 1){                 // cabía de sobra: se deja
    nodo.style.webkitLineClamp = '';
    return;
  }
  const base = parseFloat(getComputedStyle(nodo).fontSize);
  const min = base * (minFactor || 0.70);
  let t = Math.max(min, base * (hueco / nodo.scrollHeight));
  nodo.style.fontSize = t.toFixed(2) + 'px';
  for(let i = 0; i < 6 && nodo.scrollHeight > hueco + 1 && t > min + 0.01; i++){
    t = Math.max(min, t * 0.95);
    nodo.style.fontSize = t.toFixed(2) + 'px';
  }
  // y el clamp, a las líneas que de verdad caben en el hueco
  const linea = parseFloat(getComputedStyle(nodo).lineHeight) || t * 1.16;
  nodo.style.webkitLineClamp = String(Math.max(1, Math.floor(hueco / linea)));
}

/* Se pasa por los textos de las cartas que hay en pantalla. Va tras el render,
   cuando ya están colocadas: antes no se pueden medir. La tribu primero, que al
   partirse en dos líneas le quita sitio al texto de reglas. */

function encajarTextos(raiz){
  const r = raiz || document;
  r.querySelectorAll('.card .tribe').forEach(t => encajarAncho(t, 0.68));
  // En la mano se prioriza leer sobre meter una línea adicional microscópica.
r.querySelectorAll('#hand .card .txt').forEach(t => encajarAlto(t, 0.82));
r.querySelectorAll('.card .txt').forEach(t => {
  if (!t.closest('#hand')) encajarAlto(t, 0.70);
});
}

/* El encuadre de una ilustración: qué punto queda centrado (x,y) y cuánto se
   acerca (z, donde 100 es el mínimo que llena el hueco). Los primeros encuadres
   se guardaron como un solo número —el desplazamiento vertical— y siguen
   valiendo: se leen como el centro horizontal y sin acercar. */

function ponerDibujo(nodo, url, enc){
  enc=window.CAOZ_ARTE?.encuadre(nodo.dataset.arteId,CAOZ_VISTAS.identificar(nodo),nodo)||enc;
  if(nodo.dataset.arteId)url=urlArte(nodo.dataset.arteId,nodo);
  // Reutiliza el marco: una edición remota no debe duplicar ni rehacer cartas.
  const marcos=[...nodo.querySelectorAll(':scope > .marcoDibujo')];
  let caja=marcos.shift();marcos.forEach(n=>n.remove());
  if(!caja){caja=document.createElement('div');caja.className='marcoDibujo';nodo.prepend(caja);}
  let img=caja.querySelector('img');
  if(!img){img=document.createElement('img');img.className='dibujo';img.alt='';caja.appendChild(img);}
  if(img.getAttribute('src')!==url)img.src=url;
  caja.style.setProperty('--url', `url("${url}")`);
  nodo.style.setProperty('--ex', enc.x+'%');nodo.style.setProperty('--ey', enc.y+'%');
  nodo.style.setProperty('--ez', (enc.z/100).toFixed(3));
  return img;
}

/* Los Líderes también se dibujan. Van por su lado porque no son cartas: su
   retrato es .lface, no el fondo entero, y el id que usa el editor lleva
   delante 'lider_' para no chocar con el de una carta. */

function ilustrarLider(d, lid){
  const cara=d.querySelector('.lface');if(!cara)return d;
  cara.dataset.arteId='lider_'+lid;CAOZ_ARTE.acabar(d,'lider_'+lid);
  const enc=CAOZ_ARTE.encuadre('lider_'+lid,CAOZ_VISTAS.identificar(cara),cara);if(!enc)return d;
  cara.classList.add('conarte');ponerDibujo(cara,urlArte('lider_'+lid,cara),enc);
  return d;
}
function ilustrar(d, id){
  d.dataset.arteId=id;CAOZ_ARTE.acabar(d,id);
  const enc=CAOZ_ARTE.encuadre(id,CAOZ_VISTAS.identificar(d),d),hay=enc!=null;
  d.classList.add('acomodo');d.classList.toggle('conarte',hay);d.classList.toggle('sinarte',!hay);
  if(hay)ponerDibujo(d,urlArte(id,d),enc);
  let pie=d.querySelector(':scope > .pieCarta');
  if(!pie){pie=document.createElement('div');pie.className='pieCarta';}
  for(const sel of ['.nm','.tribe','.txt','.stats']){const e=d.querySelector(sel);if(e&&!pie.contains(e))pie.appendChild(e);}
  if(pie.children.length&&!pie.parentNode)d.appendChild(pie);
  // La cara pintada de la Colección, con coste, ataque y vida vivos encima.
  window.CAOZ_CARTA_JUEGO?.vestir(d,id);
  return d;
}

const el = (t,c,h)=>{const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;};

const nap = ms => ((G&&G.fast)||document.hidden) ? Promise.resolve() : sleep(ms);

async function volado(nombreRival){ return voladoDomo(nombreRival); }

/* ---------------------------------------------------------------------------
   REVELAR UNA CARTA DEL MAZO
   Manos Largas de Mohamed saca la carta de arriba del mazo rival y, según lo
   que sea, se la queda o la tira. Antes eso pasaba sin verse: salía y
   desaparecía, y sólo lo contaba una línea del registro. Ahora se enseña la
   carta, se dice a dónde va, y espera a que le des a Continuar.
   Si lo hace el rival no hay botón: se cierra sola, pero se queda más rato.
   ------------------------------------------------------------------------ */

async function revelarCarta(cardId, aMano, side){
  if(!FXON() || G.auto) return;            // partidas automáticas: sin diálogos
  const mio = side===ME;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>👀 ${mio?'Miras':P(side).L.n+' mira'} el mazo rival</h3>
    <div class="revela"><div id="revelaHueco"></div>
      <div class="adonde ${aMano?'mano':'grave'}">
        ${aMano ? '➜ '+(mio?'A TU MANO':'A SU MANO') : '➜ A LAS ALCANTARILLAS'}
        <small>${aMano
          ? 'Es un Objeto: quien mira se lo queda.'
          : 'No es un Objeto: se descarta y se pierde.'}</small>
      </div></div>`;
  const carta=cardEl(cardId,{ladoArte:1-side});
  carta.onmouseenter=null;
  $('#revelaHueco').appendChild(carta);
  openOv();

  if(mio){
    await new Promise(ok=>{
      const box=el('div','opts');
      const b=el('button','btn gold','Continuar');
      b.onclick=ok; box.appendChild(b); p.appendChild(box);
    });
  } else {
    await nap(2600);                        // lo del rival se lee, no se pulsa
  }
  carta.animate([{transform:'scale(1.35)',opacity:1},
    {transform:`translateY(${aMano?'220px':'-40px'}) scale(${aMano?'.7':'.5'}) rotate(${aMano?4:-8}deg)`,
     opacity:0}],{duration:520,easing:'cubic-bezier(.4,0,.7,1)'});
  await nap(540);
  cerrarOv();
}

function endGame(winner, why){
  if(G.over) return;
  G.over=true; G.winner=winner; G.endWhy=why;
  campanaCancelarInterferencia();
  log(`<b>=== FIN: gana ${P(winner).L.n} ===</b>`);
  // En el tutorial la partida puede acabar antes de la lección de estrategia — con
  // Fender pasa casi siempre. Antes de enseñar el cartel de fin, Gero termina de
  // contarte cómo se juega TU mazo: es justo lo que venías a aprender.
  if(TUT.on){
    const k=TUT_STEPS.findIndex(x=>x.strat);
    if(k>=0){
      if(TUT.i<k){ if(TUT.pending){ const r=TUT.pending; TUT.pending=null; r(); }
        TUT.i=k; TUT.bubble=0; TUT.data=null; TUT.block=0; TUT.stepTurn=null; TUT.jugadas=null;
        document.body.classList.remove('tutpause'); }
      TUT.endArgs=[winner,why]; tutRender(); return;
    }
  }
  const g0=G; setTimeout(()=>{ if(G===g0&&G.over) showEnd(winner,why); },450);
}

/* ==========================================================================
   6. JUGAR CARTAS
   ========================================================================== */

function log(txt,cls,priv){
  if(!G) return;
  G.log.push({txt,cls,priv:!!priv});     // priv = no se manda al rival online
  if(G.silent) return;
  const L=$('#log'); if(!L) return;
  const d=el('div',cls||'',txt); L.appendChild(d); L.scrollTop=L.scrollHeight;
  while(L.children.length>140) L.removeChild(L.firstChild);
}

function toast(t){
  const w=$('#toast'); const d=el('div','tst',t); w.appendChild(d);
  setTimeout(()=>{d.style.opacity=0;d.style.transition='.3s';},1200);
  setTimeout(()=>d.remove(),1600);
}
/* El dado se tira ANTES de que pase nada en el tablero: tú lo lanzas, ves el
   número, y sólo al continuar se aplica el efecto. */

function d20FisicoDisponible(){
  return !!window.CAOZ_D20 && FXON() && (!new URLSearchParams(location.search).has('test')||window.CAOZ_D20_PRUEBA===true);
}
function prepararTiradaD20(label, interactive, meta){return window.CAOZ_D20?.preparar(label,interactive,meta)||Promise.resolve({x:0,z:-.6,fuerza:.6});}
async function rollDice(value, label, interactive, meta, fisica){
  if(fisica&&window.CAOZ_D20){if(!FXON())return;return window.CAOZ_D20.mostrar(value,label,interactive,meta,fisica);}
  if(!FXON()) return;
  const ov=$('#dice'), box=$('#diceBox');
  return new Promise(resolve=>{
    // meta describe la tirada: qué hace falta y qué pasa según salga. Sin ella
    // el dado enseñaba un número suelto y el efecto sólo se contaba en el
    // registro lateral, donde se pierde.
    const pide = meta && meta.necesita
      ? `<div class="dpide">Necesitas <b>${meta.necesita}</b></div>` : '';
    box.innerHTML=`<div class="dtop">${label||'Tirada de d20'}</div>
      ${pide}
      <div class="d20" id="d20v">🎲</div>
      <div class="dlabel" id="dlabel">${interactive?'':'&nbsp;'}</div>
      <div class="defecto" id="defecto"></div>
      <button class="btn gold" id="dbtn">${interactive?'🎲 &nbsp;TIRAR EL D20':'Tirando…'}</button>`;
    ov.classList.add('on');
    const v=$('#d20v'), lab=$('#dlabel'), btn=$('#dbtn');
    let cerrado=false;
    const done=()=>{ if(cerrado) return; cerrado=true; ov.classList.remove('on'); resolve(); };
    const girar=async()=>{
      btn.disabled=true; btn.textContent='Tirando…';
      v.classList.add('spin'); window.CAOZ_AUDIO?.play('dice_roll');
      const N=interactive?15:9;
      for(let i=0;i<N;i++){ v.textContent=1+rnd(20); await sleep(42+i*(interactive?7:9)); }
      v.classList.remove('spin'); window.CAOZ_AUDIO?.play('dice_land');
      v.textContent=value;
      v.className='d20'+(value===20?' crit':value===1?' pifia':'');
      v.animate([{transform:'scale(1.55) rotate(-14deg)'},{transform:'scale(1) rotate(0)'}],
        {duration:460,easing:'cubic-bezier(.2,1.5,.4,1)'});
      lab.textContent = value===20?'¡CRÍTICO!' : value===1?'¡CRÍTICO!' : '';
      lab.className = 'dlabel'+(value===1?' pif':'');
      // y lo que de verdad importa: qué efecto tiene ese número
      if(meta && meta.ok){
        const bien = meta.ok(value);
        const ef=$('#defecto');
        ef.className = 'defecto ' + (bien?'bien':'mal');
        ef.innerHTML = (bien?'✔ ':'✘ ') + (bien ? meta.siOk : meta.siMal);
      }
      btn.disabled=false; btn.textContent='Continuar →'; btn.onclick=done;
      if(!interactive) setTimeout(done, meta?2600:1500);   // con efecto, más rato
    };
    if(interactive) btn.onclick=girar; else setTimeout(girar,320);
  });
}

function setPrompt(msg,btns){
  $('#pmsg').innerHTML=msg;
  const b=$('#pbtns'); b.innerHTML='';
  (btns||[]).forEach(x=>{ const e=el('button','btn sm '+(x.cls||''),x.t); e.onclick=x.fn; b.appendChild(e); });
  $('#prompt').classList.add('on');
}

function clearPrompt(){ $('#prompt').classList.remove('on'); }
/* El overlay vale para dos mundos: la galería y las reglas se abren desde los
   menús, y las preguntas y el cartel de fin se abren desde la mesa. Con una
   sola piel, o desentonaba en los menús o desentonaba jugando. Así que al
   abrirlo se mira DESDE DÓNDE: si la pantalla visible es un menú, el panel se
   viste de brasa; si es el tablero, se queda morado como el resto de la mesa. */

function openOv(){
  $('#inspect').classList.remove('on');
  const ov=$('#ov'),primera=!ov.classList.contains('on');
  ov.classList.toggle('calido',!!document.querySelector('.screen.on.portada'));
  ov.classList.add('on');
  if(primera&&ov.classList.contains('calido'))animarTransicionMenu($('#ovPanel'),ov);
}

/* opts.suave: la pregunta se hace sin tapar la mesa. Para cuando lo que se
   pregunta va SOBRE lo que hay en pantalla y hay que poder mirarlo. */

function ask(s,title,options,aiFn,opts={}){
  if(NET.host&&s===FOE) return netAsk({kind:'ask',title,options,fallback:0});
  if(s!==ME||G.auto) return Promise.resolve(aiFn?aiFn(G,s):0);
  return new Promise(res=>{
    const p=$('#ovPanel');
    p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','opts');
    options.forEach((o,i)=>{ const b=el('button','btn',o);
      b.onclick=()=>{ cerrarOv();
        const h=$('#hand'); if(h) h.classList.remove('mirando');
        res(i); }; box.appendChild(b); });
    p.appendChild(box);
    $('#ov').classList.toggle('suave', !!opts.suave);
    const mano = $('#hand');
    if(opts.mirandoMano && mano) mano.classList.add('mirando');
    openOv();
  });
}

function pickCard(s,ids,title,cancellable){
  if(NET.host&&s===FOE) return netAsk({kind:'pick',ids,title,cancellable:!!cancellable,fallback:cancellable?null:ids[0]});
  if(s!==ME||G.auto) return Promise.resolve(cancellable?null:ids[0]);
  return new Promise(res=>{
    const p=$('#ovPanel');
    p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','gallery selectorCartas');
    ids.forEach(id=>{ const c=cardEl(id,{ladoArte:s});
      // El selector ya deja leer la carta en su propia ranura; el inspector
      // flotante encima del overlay hacía que el panel pareciera cambiar de tamaño.
      c.onmouseenter=null; c.onmouseleave=null;
      c.onclick=()=>{ cerrarOv(); res(id); }; box.appendChild(c); });
    p.appendChild(box);
    if(cancellable){ const b=el('button','btn','Pasar'); b.style.marginTop='12px';
      b.onclick=()=>{ cerrarOv(); res(null); }; p.appendChild(b); }
    openOv();
  });
}

function pickFrom(s,list,title){
  if(NET.host&&s===FOE) return netAsk({kind:'from',title,
    list:list.map(o=>({id:o.id,en:o.unit?o.unit.card.n:null})),fallback:0}).then(i=>list[i|0]||list[0]);
  if(s!==ME||G.auto) return Promise.resolve(list[0]);
  return new Promise(res=>{
    const p=$('#ovPanel'); p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','opts');
    list.forEach(o=>{ const b=el('button','btn',CARDS[o.id].art+' '+CARDS[o.id].n+(o.unit?` (en ${o.unit.card.n})`:' (Reliquia)'));
      b.onclick=()=>{ cerrarOv(); res(o); }; box.appendChild(b); });
    p.appendChild(box); openOv();
  });
}

/* ---------- render de cartas ---------- */

function cardEl(id,opt={}){
  const c=CARDS[id];
  const d=el('div','card t-'+c.t);
  window.CAOZ_COLECCION_JUEGO?.marcar(d,opt.ladoArte??opt.side);
  const cost = opt.side!=null&&G ? costOf(id,opt.side) : c.c;
  const disc = cost<c.c;
  d.innerHTML=`
    <div class="top"><div class="cost${disc?' rebajado':''}">${cost}</div>
      <div class="nm">${c.n}</div></div>
    ${c.r===2?'<div class="rar">★</div><i class="foil" aria-hidden="true"></i>':''}
    <div class="art">${c.art}</div>
    <div class="tribe">${tribeLine(c)}</div>
    <div class="txt">${textoCartaFormateado(c.x)}</div>
    ${c.t==='personaje'?`<div class="stats"><span class="atk">${c.a}</span><span class="hp">${c.h}</span></div>`:''}`;
  window.marcarNombreCarta(d.querySelector('.nm'),id,c.n);
  d.dataset.card=id;
  ilustrar(d, id);
  attachInspect(d,id);
  return d;
}

function unitEl(u){
  const d=el('div','card unit t-personaje');
  d.dataset.uid=u.uid;
  unitFill(d,u);
  return d;
}
/* Los nombres de las habilidades salen del propio texto de la carta, que ya las
   escribe en negrita y con dos puntos ("<b>Sacrificio:</b> cuando un aliado…").
   Así no hay una segunda lista que mantener al día: si se reescribe una carta,
   su chapa cambia sola. */

function unitFill(d,u){
  const c=u.card;
  window.CAOZ_COLECCION_JUEGO?.marcar(d,u.side);
  const kw=[];
  u.keys.forEach(k=>{ const m={prisa:['Prisa','good'],provocar:['Provocar','pro'],vuelo:['Vuelo','vue'],
    sigilo:['Sigilo','sig'],arquero:['Arquero','vue'],regeneracion:['Regen','good'],sinhonor:['Sin honor','']}[k];
    if(m) kw.push(`<span class="kw ${m[1]}">${m[0]}</span>`); });
  if(u.stunned>0) kw.push('<span class="kw bad">Aturdido</span>');
  if(u.infected) kw.push('<span class="kw bad">Infectado</span>');
  if(u.possessed) kw.push('<span class="kw bad">Poseído</span>');
  if(u.doomed) kw.push('<span class="kw bad">Condenado</span>');
  const hp=Math.max(0,u.maxHp-u.dmg);
  d.innerHTML=`
    <div class="top"><div class="cost">${c.c}</div><div class="nm">${c.n}</div></div>
    ${c.r===2?'<div class="rar">★</div><i class="foil" aria-hidden="true"></i>':''}
    <div class="art">${c.art}</div>
    <div class="tribe">${u.tribes.join(' · ')}</div>
    <div class="keys">${kw.join('')}${
      nombresDeHabilidad(c.id).map(n=>`<span class="kw hab">${n}</span>`).join('')}</div>
    ${u.objs.length?`<div class="eq">${u.objs.map(o=>`<span title="${CARDS[o]?CARDS[o].n:''}">${CARDS[o]?CARDS[o].art:'✨'}</span>`).join('')}</div>`:''}
    <div class="stats"><span class="atk">${u.atk}</span><span class="hp">${hp}</span></div>
    <div class="cajon">${c.x||'<i>Sin habilidades.</i>'}
      <div class="mods">${modificadoresDe(u)}</div>${
      (u.side===ME && !canAttack(u))
        ? `<div class="porque">✕ ${porQueNoAtaca(u)}</div>` : ''}</div>`;
  window.marcarNombreCarta(d.querySelector('.nm'),c.id,c.n);
  // Sin panel flotante: en el tablero lo cuenta el cajón, y salían los dos a la
  // vez —el cajón junto a la carta y una copia gigante al lado—. El panel sigue
  // vivo en la galería y en las guías, donde no hay cajón.
  ilustrar(d, c.id);
  d.onmouseenter=null; d.onmouseleave=null;
}

function showInspectLeader(d,side){
  const p=P(side), L=p.L, box=$('#inspectCard');
  window.CAOZ_COLECCION_JUEGO?.ficha(box,side,d);
  box.className='big';
  const encL = CAOZ_ARTE.encuadre('lider_'+p.leaderId,'desktop_detalle',box);
  box.innerHTML=`<div class="top"><div class="cost">★</div><div class="nm">${L.n}</div></div>
    <div data-arte-id="lider_${p.leaderId}" class="art${encL?' conarte':''}"${encL ? ` style="--ex:${encL.x}%;--ey:${encL.y}%;--ez:${(encL.z/100).toFixed(3)}"` : ''}>${
      encL ? `<div class="marcoDibujo"><img class="dibujo" alt="" src="${urlArte('lider_'+p.leaderId,box)}"></div>` : ''}${L.art}</div>
    <div class="tribe">${L.ep} · ${L.arch}</div>
    <div class="txt" style="font-style:italic;color:#a99ac6;font-size:11px">${L.lore}</div>
    <div class="bigsep"></div>
    <div class="txt">${L.pasiva}</div>
    <div class="bigsep"></div>
    <div class="txt">${L.hab}</div>
    ${L.hab2?`<div class="txt" style="margin-top:5px">${'<b>'+L.hab2.n+':</b> '+L.hab2.d}</div>`:''}
    <div class="bigsep"></div>
    <div class="bigrow">❤️ Alma <b>${Math.max(0,p.alma)}</b> · 🔷 <b>${p.pd}/${p.pdMax}</b> · 🗝️ <b>${keys(side)}</b></div>`;
  window.marcarNombreCarta(box.querySelector('.nm'),'lider_'+p.leaderId,L.n);
  campanaVestirFicha(box,side);if(side===FOE&&G.campana?.jefeSecreto)campanaVestirPitagoras(box);CAOZ_ARTE.acabar(box,'lider_'+p.leaderId);placeInspect(d);
}

function placeInspect(d){
  const box2=$('#inspect'); box2.classList.add('on');
  const r=d.getBoundingClientRect();
  const w=262, h=box2.firstElementChild.offsetHeight||360;
  let x=r.right+10; if(x+w>innerWidth) x=r.left-w-10; if(x<6) x=6;
  let y=Math.min(Math.max(8,r.top-40), Math.max(8,innerHeight-h-8));
  box2.style.left=x+'px'; box2.style.top=y+'px';
}

function attachInspect(d,id,u){
  d.onmouseenter=e=>{ const box=$('#inspectCard');
    window.CAOZ_COLECCION_JUEGO?.ficha(box,u?.side,d);
    box.className = 'big t-' + (CARDS[id] ? CARDS[id].t : 'personaje');
    box.innerHTML=inspectHTML(id,u);
    window.marcarNombreCarta(box.querySelector('.nm'),id,CARDS[id].n);
    const art=box.querySelector('.art'),enc=CAOZ_ARTE.encuadre(id,'desktop_detalle',box);
    if(art){art.dataset.arteId=id;CAOZ_ARTE.acabar(art,id);if(enc){art.classList.add('conarte');ponerDibujo(art,urlArte(id,art),enc);}}
    window.CAOZ_CARTA_JUEGO?.vestirFicha(box,id);
    const box2=$('#inspect'); box2.classList.add('on');
    placeInspect(d);
  };
  d.onmouseleave=()=>$('#inspect').classList.remove('on');
}

/* ==========================================================================
   9.b EFECTOS VISUALES
   Todo pasa por la Web Animations API: los valores son dinámicos (distancia
   entre atacante y objetivo). La duración se encadena con sleep(), NO con
   Animation.finished: esa promesa puede quedarse sin resolver aunque la
   animación termine, y colgaría el motor. Nada corre con G.fast/G.silent.
   ========================================================================== */

const FXON = ()=> G && !G.fast && !G.silent && !document.hidden;

function fxEl(u){ return u&&u.uid!=null ? $('#myField [data-uid="'+u.uid+'"]')||$('#foeField [data-uid="'+u.uid+'"]') : null; }

/* Thal usa la capa de aliento sin que el motor conozca el DOM. Estas funciones
   sólo traducen unidades a cartas visibles y devuelven falso si el dispositivo
   no puede dibujarlo; entonces el motor conserva el golpe normal. */
async function fxThalEntrada(atacante,afectados){
  const fx=window.CAOZ_FX_ALIENTO,host=$('#fx'),carta=fxEl(atacante);
  if(!fx?.entrada||!FXON()||!host||!carta) return false;
  const lista=(afectados||[]).map(a=>{const u=a?.u||a,nodo=fxEl(u);return nodo?{nodo}:null;}).filter(Boolean);
  if(!lista.length) return false;
  try{await fx.entrada(host,{carta,afectados:lista,velocidad:1,reducir:FX_SUAVE()});return true;}
  catch(e){console.warn('Aliento de Thal sin onda:',e);return false;}
}
async function fxThalAtaque(atacante,objetivo,dano,opt={}){
  const fx=window.CAOZ_FX_ALIENTO,host=$('#fx'),atq=fxEl(atacante),obj=fxEl(objetivo);
  if(!fx?.ataque||!FXON()||!host||!atq||!obj) return false;
  const imagen=obj.querySelector('.cjCara');
  try{await fx.ataque(host,{atacante:atq,objetivo:obj,
    imagenObjetivo:imagen?.complete&&imagen.naturalWidth?imagen:null,
    letal:!!opt.letal,dano,color:'verde',velocidad:1,reducir:FX_SUAVE()});return true;}
  catch(e){console.warn('Aliento de Thal sin fuego:',e);return false;}
}

function fxRect(target){
  // target: unidad | 'face0'/'face1' | elemento
  if(target==='face0'||target==='face1'){ const a=$('#lead'+(target==='face0'?ME:FOE)); return a?a.getBoundingClientRect():null; }
  const e = target instanceof Element ? target : fxEl(target);
  return e? e.getBoundingClientRect() : null;
}

function fxAdd(cls, x, y, extra){
  const d=el('div',cls); d.style.left=x+'px'; d.style.top=y+'px';
  if(extra) Object.assign(d.style, extra);
  $('#fx').appendChild(d); return d;
}

function fxClamp(d){                       // que no se salga por los bordes
  const m=10, r=d.getBoundingClientRect();
  let x=parseFloat(d.style.left), y=parseFloat(d.style.top);
  if(r.left<m) x+=m-r.left;
  if(r.right>innerWidth-m) x-=r.right-(innerWidth-m);
  if(r.top<m) y+=m-r.top;
  if(r.bottom>innerHeight-m) y-=r.bottom-(innerHeight-m);
  d.style.left=x+'px'; d.style.top=y+'px';
}
/* Al acabar una animación, el elemento vuelve a su estado del CSS —visible— y
   se quedaba así los 60 ms que faltaban hasta borrarlo: el efecto se desvanecía
   y REAPARECÍA de golpe justo antes de irse. Se veía en el cartel de «Turno
   de…», que es el que más dura, pero le pasaba a todos.
   Se apaga en cuanto la animación termina. Mientras corre manda ella, que en la
   cascada va por encima de un estilo en línea, así que esto no la interrumpe. */

function fxGone(d,ms){
  const t = ms||900;
  setTimeout(()=>{ d.style.opacity='0'; }, t);
  setTimeout(()=>d.remove(), t+60);
}

/* número flotante (daño, curación, buffs) */

function fxNumber(target, text, kind, big){
  if(!FXON()) return;
  const c=fxCenter(target); if(!c) return;
  // si caen varios seguidos en el mismo sitio, se escalonan para no taparse
  const off=(FXSTACK++ % 4)*48;                 // se apilan en 4 alturas, sin encimarse
  setTimeout(()=>{ FXSTACK=Math.max(0,FXSTACK-1); },1900);
  const d=fxAdd('fxnum '+kind+(big?' xl':''), c.x, c.y-14-off);
  d.textContent=text;
  fxClamp(d);
  d.animate([
    {transform:'translate(-50%,-50%) scale(.45)', opacity:0},
    {transform:'translate(-50%,-50%) scale(1.3)',  opacity:1, offset:.16},
    {transform:'translate(-50%,-50%) scale(1)',    opacity:1, offset:.28},
    {transform:'translate(-50%,-58%) scale(1)',    opacity:1, offset:.80},  // se queda quieto: da tiempo a leerlo
    {transform:'translate(-50%,-105%) scale(.94)', opacity:0}
  ],{duration:1900,easing:'cubic-bezier(.2,.9,.3,1)'});
  fxGone(d,1900);
}
/* golpe recibido: sacudida + destello rojo */
/* opt: {inf, fuego, letal}. Un golpe de 1 y uno de 7 no pueden verse igual, y
   el que mata menos aún: la sacudida escala con el daño, el Fuego va en brasa,
   y el letal lleva un destello blanco encima de la carta. */

async function fxHit(u, amount, opt){
  if(!FXON()) return;
  if(typeof opt!=='object') opt={inf:!!opt};                // compat: antes era un booleano
  const {inf=false, fuego=false, letal=false} = opt||{};
  fxNumber(u, '−'+amount, inf ? 'inf' : 'dmg', letal || amount>=5);
  const e=fxEl(u);
  const c=fxCenter(u);
  if(e){
    const f = Math.min(1.6, .7 + amount/6);
    e.animate([{transform:'translate(0,0)'},{transform:`translate(${-7*f}px,${3*f}px)`},
      {transform:`translate(${6*f}px,${-3*f}px)`},{transform:`translate(${-4*f}px,${2*f}px)`},{transform:'translate(0,0)'}],
      {duration:340,easing:'ease-out'});
    const tinte = fuego ? 'brightness(2.2) sepia(1) hue-rotate(-18deg) saturate(7)'
                        : 'brightness(2.4) sepia(1) hue-rotate(-40deg) saturate(6)';
    e.animate([{filter:'brightness(1)'},{filter:tinte,offset:.15},{filter:'brightness(1)'}],{duration:420});
    if(c){
      const b=fxAdd('fxburst',c.x,c.y,{color: fuego ? FX_COLOR.fuego : '#ff5a4e'});
      b.animate([{transform:'scale(.3)',opacity:.95},{transform:'scale(1.5)',opacity:0}],{duration:380,easing:'ease-out'}); fxGone(b,380);
      fxChispas(c.x, c.y, {n: fuego ? 12 : 7, color: fuego ? FX_COLOR.fuego : FX_COLOR.golpe, fuerza: fuego ? 1.1 : .8});
      if(letal){
        const r=c.r, fl=fxAdd('fxflash', r.left, r.top, {width:r.width+'px', height:r.height+'px'});
        fl.animate([{opacity:.95},{opacity:0}],{duration:360,easing:'ease-out'}); fxGone(fl,360);
        fxAnillo(c.x, c.y, FX_COLOR.letal, 1.4);
      }
    }
  }
  fxSacudida(amount, letal);
  await nap(letal ? 260 : 190);
}

function fxHeal(u, amount){
  if(!FXON()) return;
  fxNumber(u,'+'+amount,'heal');
  const e=fxEl(u);
  if(e) e.animate([{filter:'brightness(1)'},{filter:'brightness(1.8) hue-rotate(60deg)',offset:.3},{filter:'brightness(1)'}],{duration:520});
}
// salto del contador dentro de la carta: marca DÓNDE cambió el número

function fxPop(e, color){
  if(!e||!FXON()) return;
  e.animate([{transform:'scale(1)',filter:'brightness(1)'},
    {transform:'scale(1.75)',filter:'brightness(2.2)',offset:.3},
    {transform:'scale(1)',filter:'brightness(1)'}],{duration:520,easing:'ease-out'});
  e.style.boxShadow='0 0 16px '+color;
  setTimeout(()=>{ e.style.boxShadow=''; },520);
}

function fxBuff(u, text){
  if(!FXON()) return;
  fxNumber(u,text,'buff');
  const e=fxEl(u);
  if(e) e.animate([{transform:'scale(1)'},{transform:'scale(1.12)',offset:.35},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});
}
/* ataque: embestida hacia el objetivo + tajo en el impacto */

async function fxLunge(att, target){
  if(!FXON()) return;
  const e=fxEl(att); const from=fxCenter(att); const to=fxCenter(target==='face'?(att.side===ME?'face1':'face0'):target);
  if(!e||!from||!to){ await nap(120); return; }
  // Si ataca el rival, primero se anuncia: quién va a por quién. Sin esto el
  // golpe llegaba antes de que te diera tiempo a mirar de dónde salía.
  {
    const destino = target==='face'
      ? (att.side===ME ? P(FOE).L.n : P(ME).L.n)
      : target.card.n;
    const et=fxAdd('fxlabel',(from.x+to.x)/2,(from.y+to.y)/2-46,{color:'#ffb36b'});
    et.textContent = att.card.n+' ataca a '+destino;
    et.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.85)'},
      {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.25},
      {opacity:1,offset:.75},{opacity:0}],{duration:1000});
    fxGone(et,1000);
    // sólo se espera cuando ataca el rival: en tu turno ya sabes lo que haces
    if(att.side!==ME){
      e.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)'},
        {filter:'brightness(1)'}],{duration:620,iterations:1});
      await nap(640);
    }
  }
  /* La embestida en tres tiempos: se echa atrás, se lanza, y en el contacto se
     QUEDA CLAVADA 70 ms —el hit-stop— antes de volver. Esa parada es lo que
     hace que el golpe pese: sin ella la carta pasa de largo y el impacto es
     un adorno. Va en dos animaciones y no en una para poder parar en medio;
     la de ida lleva fill:forwards porque, sin él, al acabar la carta saltaría
     a su sitio antes de la vuelta (la regla de siempre). */
  const dx=(to.x-from.x)*.46, dy=(to.y-from.y)*.46;
  e.style.zIndex=60;
  const ida=e.animate([{transform:'translate(0,0)'},
    {transform:`translate(${dx*-0.2}px,${dy*-0.2}px)`,offset:.35},
    {transform:`translate(${dx}px,${dy}px)`}],
    {duration:300,easing:'cubic-bezier(.45,-0.3,.6,1)',fill:'forwards'});
  await nap(300);
  // contacto
  const mx=from.x+(to.x-from.x)*.52, my=from.y+(to.y-from.y)*.52;
  const rad=Math.atan2(to.y-from.y,to.x-from.x), ang=rad*180/Math.PI;
  const sl=fxAdd('fxslash',mx,my,{transform:`rotate(${ang}deg)`});
  sl.animate([{opacity:0,transform:`rotate(${ang}deg) scaleX(.2)`},
    {opacity:1,transform:`rotate(${ang}deg) scaleX(1)`,offset:.4},
    {opacity:0,transform:`rotate(${ang}deg) scaleX(1.3)`}],{duration:320});
  fxGone(sl,320);
  fxChispas(mx, my, {n:12, color:FX_COLOR.golpe, ang:rad, fuerza:1, largas:true});
  fxAnillo(mx, my, FX_COLOR.golpe, .9);
  await nap(70);                                            // hit-stop
  const vuelta=e.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],
    {duration:220,easing:'cubic-bezier(.2,.8,.3,1)'});
  ida.cancel();                                             // libera el fill
  setTimeout(()=>{ e.style.zIndex=''; },260);
}
/* ==========================================================================
   EL IMPACTO
   Lo que pasa en el punto de contacto. Lo llaman la embestida (al tocar) y el
   golpe recibido (al restar vida), así que un ataque cuerpo a cuerpo lo dispara
   dos veces con parámetros distintos y un hechizo sólo una.
   Reglas de la casa: todo detrás de FXON(); los tamaños en --k porque #fx no
   hereda el zoom del lienzo; y las sacudidas van sobre #board, cuya posición
   no vive en transform, así que animarlo no borra nada.
   ========================================================================== */

const FX_SUAVE = ()=> matchMedia('(prefers-reduced-motion: reduce)').matches;

function fxChispas(x, y, {n=10, color=FX_COLOR.golpe, ang=null, fuerza=1, largas=false}={}){
  if(!FXON() || FX_SUAVE()) return;
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k'))||1;
  for(let i=0;i<n;i++){
    const a = ang==null ? Math.random()*Math.PI*2
                        : ang + (Math.random()-.5)*1.4;            // cono de ±40°
    const d = (26 + Math.random()*54) * fuerza * k;
    const dx = Math.cos(a)*d, dy = Math.sin(a)*d + 10*k;           // caen un poco
    const sp = fxAdd('fxspark'+(largas&&Math.random()<.5?' larga':''), x, y, {color});
    const rot = largas ? `rotate(${a*180/Math.PI}deg)` : '';
    sp.animate([
      {transform:`translate(0,0) ${rot} scale(1)`, opacity:1},
      {transform:`translate(${dx*.7}px,${dy*.6}px) ${rot} scale(1.1)`, opacity:1, offset:.45},
      {transform:`translate(${dx}px,${dy+14*k}px) ${rot} scale(.2)`, opacity:0}
    ],{duration:380+Math.random()*260, easing:'cubic-bezier(.15,.7,.3,1)'});
    fxGone(sp, 640);
  }
}

/* Anillo que se expande desde el contacto. */

function fxAnillo(x, y, color, escala=1){
  if(!FXON()) return;
  const r = fxAdd('fxring', x, y, {color});
  r.animate([{transform:`scale(.25)`,opacity:.95},{transform:`scale(${1.9*escala})`,opacity:0}],
    {duration:420,easing:'ease-out'});
  fxGone(r, 420);
}

/* Sacudida de la mesa proporcional al daño: 1 punto casi no se nota, 5 se
   siente, un golpe letal se siente más. Con menos movimiento pedido, nada. */

function fxSacudida(n, letal=false){
  if(!FXON() || FX_SUAVE()) return;
  const b=$('#board'); if(!b) return;
  const f = Math.min(1, n/6) * (letal ? 1.5 : 1);
  if(f < .12) return;
  const px = v => (v*f).toFixed(1)+'px';
  b.animate([
    {transform:'translate(0,0)'},
    {transform:`translate(${px(-7)},${px(3)})`},{transform:`translate(${px(6)},${px(-2)})`},
    {transform:`translate(${px(-4)},${px(2)})`},{transform:`translate(${px(2)},${px(-1)})`},
    {transform:'translate(0,0)'}],
    {duration:260+120*f, easing:'ease-out'});
}

/* Bocanada al morir: ceniza gris, o brasas naranjas si murió por Fuego. */

function fxBocanada(x, y, quemada){
  if(!FXON() || FX_SUAVE()) return;
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k'))||1;
  const color = quemada ? FX_COLOR.brasa : FX_COLOR.ceniza;
  for(let i=0;i<14;i++){
    const a = Math.random()*Math.PI*2, d = (18+Math.random()*46)*k;
    const p = fxAdd('fxpuff', x+(Math.random()-.5)*40*k, y+(Math.random()-.5)*50*k, {color});
    p.animate([
      {transform:'translate(0,0) scale(.6)', opacity:.9},
      {transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d - (quemada?28:10)*k}px) scale(${quemada?1.3:2.2})`, opacity:0}
    ],{duration:620+Math.random()*300, easing:'ease-out'});
    fxGone(p, 920);
  }
  if(quemada) fxChispas(x, y, {n:8, color:FX_COLOR.fuego, fuerza:.9});
}

/* daño al Alma: sacudida del retrato, viñeta roja y número grande */

async function fxFace(side, amount){
  if(!FXON()) return;
  const av0=fxRect(side===ME?'face0':'face1');
  const fld=$('#field').getBoundingClientRect();
  if(av0){ const off=(FXSTACK++%3)*34; setTimeout(()=>{FXSTACK=Math.max(0,FXSTACK-1);},900);
    const d=fxAdd('fxnum dmg xl', fld.left+fld.width/2, side===ME? fld.bottom-70-off : fld.top+70+off);
    d.textContent='−'+amount+' ❤️'; fxClamp(d);
    d.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:0},
      {transform:'translate(-50%,-50%) scale(1.3)',opacity:1,offset:.16},
      {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.3},
      {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.74},
      {transform:'translate(-50%,-90%) scale(.94)',opacity:0}],{duration:1450,easing:'cubic-bezier(.2,.9,.3,1)'});
    fxGone(d,1450); }
  fxStat(side,'.stat.alma');
  const av=$('#lead'+side);
  if(av) av.animate([{transform:'translate(0,0) scale(1)'},{transform:'translate(-6px,0) scale(1.08)'},
    {transform:'translate(6px,0) scale(1.05)'},{transform:'translate(0,0) scale(1)'}],{duration:460});
  const v=el('div','fxvig'); v.style.color='rgba(224,40,40,.55)'; document.body.appendChild(v);
  v.animate([{opacity:0},{opacity:1,offset:.25},{opacity:0}],{duration:520}); fxGone(v,520);
  const b=$('#board');
  if(b) b.animate([{transform:'translate(0,0)'},{transform:'translate(-4px,2px)'},
    {transform:'translate(4px,-2px)'},{transform:'translate(0,0)'}],{duration:260});
  await nap(300);
}
/* una carta sale volando del mazo hacia la mano: da sentido al contador */

function fxDraw(side){
  if(!FXON()) return;
  const pile=$(side===ME?'#myDeckPile':'#foeDeckPile'); if(!pile) return;
  const r=pile.getBoundingClientRect();
  const dst=(side===ME? $('#hand') : ($('#foeHand')||$('#barFoe')));
  if(!dst) return;
  const t=dst.getBoundingClientRect();
  const d=fxAdd('fxfly', r.left+r.width/2, r.top+r.height/2);
  d.animate([
    {transform:'translate(-50%,-50%) scale(.6) rotate(-8deg)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1) rotate(0)',opacity:1,offset:.2},
    {transform:`translate(${t.left+t.width/2-(r.left+r.width/2)-22}px,${t.top+t.height/2-(r.top+r.height/2)-30}px) scale(.75)`,opacity:0}
  ],{duration:620,easing:'cubic-bezier(.3,.7,.3,1)'});
  fxGone(d,620);
  pile.animate([{transform:'translateY(0)'},{transform:'translateY(3px)'},{transform:'translateY(0)'}],{duration:340});
}
/* un Objeto se activa: salta su icono con el nombre, para que se vea qué hizo */

function fxObj(target, objId, text){
  if(!FXON()) return;
  const c=fxCenter(target);
  const art=CARDS[objId]?CARDS[objId].art:'✨';
  const x=c?c.x:innerWidth/2, y=c?c.y-58:innerHeight/2;
  const d=fxAdd('fxlabel', x, y, {color:'var(--c-objeto)'});
  d.innerHTML=art+' '+(text||CARDS[objId].n);
  fxClamp(d);
  d.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.18)',opacity:1,offset:.2},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.34},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.74},
    {transform:'translate(-50%,-120%) scale(.94)',opacity:0}],{duration:1750,easing:'ease-out'});
  fxGone(d,1750);
  const e=target&&target.uid!=null?fxEl(target):null;
  const icon=e&&e.querySelector('.eq span');
  if(icon) icon.animate([{transform:'scale(1)',filter:'brightness(1)'},
    {transform:'scale(2)',filter:'brightness(2.4)',offset:.3},
    {transform:'scale(1)',filter:'brightness(1)'}],{duration:700});
}
/* aviso centrado, para efectos sin dueño en el campo */
/* LOS AVISOS SE APILAN, NO SE PISAN.
   Todos salían en el centro exacto del tapete, así que dos a la vez quedaban uno
   encima del otro y no se leía ninguno. Con Puntos Robados pasaba siempre: gana
   un contador por cada rival que muere, y en un turno mueren varios.

   Ahora cada aviso ocupa su fila y, cuando uno se va, los de abajo suben a
   ocupar su sitio con una transición. Se ven todos, en el orden en que pasaron. */

function fxRecolocaAvisos(){
  FX_AVISOS.forEach((d,i)=>{ d.style.setProperty('--fila', i); });
}

function fxNotice(text, color){
  if(!FXON()) return;
  const b=$('#mat')||$('#field'); if(!b) return;
  const r=b.getBoundingClientRect();
  const d=fxAdd('fxlabel apilado', r.left+r.width/2, r.top+r.height/2,
                {color:color||'var(--gold)'});
  d.innerHTML=text;
  FX_AVISOS.push(d); fxRecolocaAvisos(); fxClamp(d);
  /* La fila se aplica con una variable aparte para que la animación de entrada
     y el reacomodo no se peleen por el mismo transform. */
  d.animate([{opacity:0, scale:'.6'},
    {opacity:1, scale:'1.1', offset:.22},
    {opacity:1, scale:'1', offset:.72},
    {opacity:0, scale:'.95'}],{duration:1750,easing:'ease-out'});
  fxGone(d,1750);
  setTimeout(()=>{
    const i=FX_AVISOS.indexOf(d);
    if(i>=0){ FX_AVISOS.splice(i,1); fxRecolocaAvisos(); }
  },1750);
}

function fxSummon(e){
  if(!FXON()||!e) return;
  e.animate([{transform:'scale(.5) translateY(18px)',opacity:0},
    {transform:'scale(1.06)',opacity:1,offset:.7},{transform:'scale(1)',opacity:1}],
    {duration:380,easing:'cubic-bezier(.2,.9,.3,1.3)'});
}

async function fxDeath(u){
  if(!FXON()) return;
  // Machete no va volando a las Alcantarillas: su carta arde hasta la ceniza
  // (fx-aliento.js). Sin WebGL o sin su cara pintada, la muerte de siempre.
  if(u.card.id==='machete'&&window.CAOZ_FX_ALIENTO){const q=fxEl(u);
    if(q&&await window.CAOZ_FX_ALIENTO.quemar($('#fx'),{objetivo:q,color:'naranja'})){
      $(u.owner===ME?'#myGravePile':'#foeGravePile')?.animate([{transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:450});return;}}
  const e=fxEl(u); const c=fxCenter(u);
  if(c){ const b=fxAdd('fxnum dmg xl plain',c.x,c.y+38); b.textContent='💀';  // debajo, lejos de los números
    b.animate([{transform:'translate(-50%,-50%) scale(.3) rotate(-20deg)',opacity:0},
      {transform:'translate(-50%,-50%) scale(1.45) rotate(6deg)',opacity:1,offset:.22},
      {transform:'translate(-50%,-50%) scale(1.15) rotate(0)',opacity:1,offset:.36},
      {transform:'translate(-50%,-62%) scale(1.15) rotate(0)',opacity:1,offset:.75},
      {transform:'translate(-50%,-105%) scale(.9)',opacity:0}],{duration:1300}); fxGone(b,1300); }
  if(c) fxBocanada(c.x, c.y, !!u.tookFire);   // ceniza, o brasas si la quemaron
  if(e){ e.style.pointerEvents='none';
    // se clona sobre la capa de efectos: la fila del campo recorta lo que sale
    // de ella, y si no la carta se cortaría en el borde en vez de llegar a la pila
    const pile=$(u.owner===ME?'#myGravePile':'#foeGravePile');
    const er=e.getBoundingClientRect();
    const pr=pile?pile.getBoundingClientRect():null;
    const dx=pr? pr.left+pr.width/2-(er.left+er.width/2) : 0;
    const dy=pr? pr.top+pr.height/2-(er.top+er.height/2) : 40;
    const ghost=e.cloneNode(true);
    ghost.classList.remove('ready','tgt','selected','finge-hov');
    ghost.style.cssText=`position:absolute;left:${er.left}px;top:${er.top}px;`
      +`width:${er.width}px;height:${er.height}px;margin:0;pointer-events:none;z-index:5`;
    ghost.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*er.width/e.offsetWidth)+'px';
    $('#fx').appendChild(ghost);
    e.style.visibility='hidden';
    ghost.animate([{transform:'rotate(0) scale(1)',opacity:1,filter:'grayscale(0)'},
      {transform:'rotate(-10deg) scale(.92)',opacity:1,filter:'grayscale(.6)',offset:.3},
      {transform:`translate(${dx}px,${dy}px) rotate(-28deg) scale(.2)`,opacity:0,filter:'grayscale(1)'}],
      {duration:820,easing:'cubic-bezier(.45,.05,.6,1)',fill:'forwards'});
    fxGone(ghost,860);
    await nap(760);
    const p2=$(u.owner===ME?'#myGravePile':'#foeGravePile');
    if(p2) p2.animate([{transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:450});
  } else await nap(160);
}
/* hechizo: la carta sube al centro, brilla con el color de su subtipo y se deshace */
/* ---------------------------------------------------------------------------
   CARTA EN ESCENA
   Cuando algo se activa —un Hechizo, una Trampa, la Habilidad de un Líder— la
   carta sube al centro, se queda quieta un momento y se va. Es la única forma
   de que se entienda qué acaba de pasar: antes las Trampas sólo enseñaban su
   nombre en texto y las Habilidades no enseñaban nada.
   Se queda más rato si lo hace el rival: lo suyo hay que leerlo, no adivinarlo.
   ------------------------------------------------------------------------ */
/* EL ATERRIZAJE
   La carta que baja al campo llegaba de la nada: en un fotograma no estaba y en
   el siguiente sí. Ahora cae desde arriba —algo más grande, girada y brillando—
   y se asienta con un pequeño rebote y un resplandor de su color de clase.
   Dura menos de medio segundo: lo justo para que la vista siga adónde fue.
   El polvo del tapete se levanta un poco a su alrededor con el mismo golpe. */

function fxAterriza(u){
  if(!FXON()) return;
  const e = fxEl(u); if(!e) return;
  const col = getComputedStyle(e).getPropertyValue('--tipo').trim() || '#8a5cf0';
  e.animate([
    {transform:'translateY(-40px) scale(1.20) rotate(-3.5deg)', opacity:0,
     filter:'brightness(1.7)', boxShadow:'0 26px 40px rgba(0,0,0,.7), 0 0 0 0 '+col},
    {transform:'translateY(3px) scale(1.03) rotate(.6deg)', opacity:1,
     filter:'brightness(1.22)', boxShadow:'0 10px 22px rgba(0,0,0,.7), 0 0 26px 3px '+col,
     offset:.60},
    {transform:'translateY(0) scale(1) rotate(0deg)', opacity:1,
     filter:'brightness(1)', boxShadow:'0 3px 6px rgba(0,0,0,.5), 0 0 0 0 transparent'}
  ], {duration:440, easing:'cubic-bezier(.18,.72,.3,1)'});
}

async function fxCartaEnEscena(nodo, side, color, etiqueta, quieta){
  if(!FXON()) return;
  window.CAOZ_COLECCION_JUEGO?.marcar(nodo,side);
  const board=$('#field').getBoundingClientRect();
  const cx=board.left+board.width/2, cy=board.top+board.height/2;
  nodo.classList.add('fxcard');
  nodo.style.left=(cx-56)+'px'; nodo.style.top=(cy-79)+'px';
  nodo.onmouseenter=null; nodo.onpointerdown=null;
  $('#fx').appendChild(nodo);
  const total = quieta + 420;

  if(etiqueta){
    const et=fxAdd('fxlabel', cx, cy-120, {color});
    et.textContent=etiqueta;
    et.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.82)'},
      {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.2},
      {opacity:1,offset:.82},{opacity:0}],{duration:total});
    fxGone(et,total);
  }
  const fromY = side===ME? 220 : -220;
  nodo.animate([
    {transform:`translateY(${fromY}px) scale(.6) rotate(${side===ME?6:-6}deg)`,opacity:0},
    {transform:'translateY(0) scale(1.35) rotate(0)',opacity:1,offset:.2},
    {transform:'translateY(0) scale(1.35) rotate(0)',opacity:1,offset:.82},
    {transform:'translateY(-30px) scale(1.55) rotate(0)',opacity:0}
  ],{duration:total,easing:'cubic-bezier(.2,.8,.3,1)'});
  const ring=fxAdd('fxring',cx,cy,{color});
  ring.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:.9,offset:.35},
    {transform:'scale(3.6)',opacity:0}],{duration:820,easing:'ease-out'});
  fxGone(ring,820); fxGone(nodo,total);
  await nap(quieta + 180);
}
/* cuánto se queda quieta: lo del rival, más tiempo */

function fxMotas(x, y, {n=10, color, dy=-60, dx=30, escala=1, dur=900, sube=true}={}){
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k'))||1;
  for(let i=0;i<n;i++){
    const p = fxAdd('fxpuff', x+(Math.random()-.5)*70*k, y+(Math.random()-.5)*60*k, {color});
    const tx = (Math.random()-.5)*dx*2*k, ty = (sube ? -(20+Math.random()*Math.abs(dy)) : (Math.random()-.5)*dy)*k;
    p.animate([
      {transform:'translate(0,0) scale(.5)', opacity:.95},
      {transform:`translate(${tx*.6}px,${ty*.6}px) scale(${escala})`, opacity:.8, offset:.5},
      {transform:`translate(${tx}px,${ty}px) scale(${escala*1.3})`, opacity:0}
    ],{duration:dur+Math.random()*400, easing:'ease-out'});
    fxGone(p, dur+500);
  }
}

function fxEstallido(x, y, sub){
  if(!FXON()) return;
  const e = FX_ELEMENTO[sub]; if(!e) return;
  const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k'))||1;
  fxAnillo(x, y, e.color, 1.6);
  if(FX_SUAVE()) return;
  switch(sub){
    case 'fuego': {
      const fl=fxAdd('fxburst', x, y, {color:e.color});
      fl.animate([{transform:'scale(.4)',opacity:.9},{transform:'scale(2.6)',opacity:0}],{duration:520,easing:'ease-out'}); fxGone(fl,520);
      fxChispas(x, y, {n:18, color:e.color, fuerza:1.3, largas:true});
      fxMotas(x, y, {n:12, color:e.color, dy:-120, dx:40, escala:1.2, dur:800});
      break; }
    case 'fe': {
      const fl=fxAdd('fxburst', x, y, {color:e.claro});
      fl.animate([{transform:'scale(.5)',opacity:.7},{transform:'scale(2.2)',opacity:0}],{duration:900,easing:'ease-out'}); fxGone(fl,900);
      fxMotas(x, y, {n:16, color:e.claro, dy:-110, dx:60, escala:.8, dur:1300});
      fxChispas(x, y, {n:8, color:e.claro, fuerza:.6});
      break; }
    case 'engano': {
      fxMotas(x, y, {n:16, color:e.color, dy:70, dx:110, escala:3, dur:1100, sube:false});
      const fl=fxAdd('fxburst', x, y, {color:'#5a2a9a'});
      fl.animate([{transform:'scale(.6)',opacity:.6},{transform:'scale(2.8)',opacity:0}],{duration:900,easing:'ease-out'}); fxGone(fl,900);
      break; }
    case 'cancion': {
      [0,140,280].forEach(t=>setTimeout(()=>fxAnillo(x, y, e.color, 2.2), t));
      for(let i=0;i<6;i++){
        const g=fxAdd('fxglifo', x+(Math.random()-.5)*60*k, y, {color:e.claro});
        g.textContent = i%2 ? '♪' : '♫';
        const tx=(Math.random()-.5)*160*k, ty=-(60+Math.random()*90)*k;
        g.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:0},
          {transform:`translate(calc(-50% + ${tx*.4}px), calc(-50% + ${ty*.4}px)) scale(1.1)`,opacity:1,offset:.3},
          {transform:`translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(.9) rotate(${(Math.random()-.5)*40}deg)`,opacity:0}],
          {duration:1100+Math.random()*300, easing:'cubic-bezier(.2,.7,.3,1)'});
        fxGone(g, 1450);
      }
      break; }
    case 'contrato': {
      fxChispas(x, y, {n:10, color:e.color, fuerza:.9, largas:true});
      const fl=fxAdd('fxburst', x, y, {color:e.color});
      fl.animate([{transform:'scale(.3)',opacity:.9},{transform:'scale(1.6)',opacity:0}],{duration:360,easing:'ease-out'}); fxGone(fl,360);
      break; }
    case 'rapido': {
      for(let i=0;i<8;i++){
        const sp=fxAdd('fxspark larga', x, y+(Math.random()-.5)*50*k, {color:e.claro});
        const dir = i%2 ? 1 : -1, d=(60+Math.random()*90)*k;
        sp.animate([{transform:'translate(0,0) scaleX(.4)',opacity:1},{transform:`translate(${dir*d}px,0) scaleX(1.6)`,opacity:0}],
          {duration:300+Math.random()*160, easing:'ease-out'});
        fxGone(sp, 500);
      }
      break; }
  }
}

async function fxSpell(cardId, side){
  const c=CARDS[cardId];
  const color=(c.sub&&SUBCOLOR[c.sub[0]])||'#8a5cf0';
  // la etiqueta sale SIEMPRE, tuya o suya: antes sólo se ponía para el rival y
  // por eso unas jugadas se anunciaban y otras no
  /* El estallido se programa para el instante en que la carta se POSA: el
     presentador la deja quieta al 20 % de su duración total (quieta + 420). Se
     dispara aparte para no tocar el presentador, que comparten las trampas y
     las habilidades. */
  if(FXON() && c.sub && FX_ELEMENTO[c.sub[0]]){
    const board=$('#field').getBoundingClientRect();
    const cx=board.left+board.width/2, cy=board.top+board.height/2;
    setTimeout(()=>fxEstallido(cx, cy, c.sub[0]), (fxQuieta(side)+420)*0.2);
  }
  await fxCartaEnEscena(cardEl(cardId,{ladoArte:side}), side, color,
    P(side).L.n+' lanza '+c.n, fxQuieta(side));
}
/* trampa: ahora se ve la CARTA, no sólo su nombre */

async function fxHabilidad(side){
  if(!FXON()) return;
  const L=P(side).L;
  const original=$('#lead'+(side===ME?0:1));
  const nodo = original ? original.cloneNode(true) : cardEl('discipulo',{ladoArte:side});
  nodo.id=''; nodo.style.width='112px'; nodo.style.height='158px';
  await fxCartaEnEscena(nodo, side, 'var(--gold)',
    '✨ '+L.habName+' — '+L.n, fxQuieta(side));
}
/* cartel de cambio de turno */

async function fxBanner(side){
  if(!FXON()) return;
  const d=el('div','fxbanner');
  d.innerHTML = (side===ME?'TU TURNO':'TURNO DE '+P(side).L.n.toUpperCase())
    +'<small>'+(side===ME?'juega tus cartas':'observa su jugada')+'</small>';
  const m=$('#mat'); if(m){ const r=m.getBoundingClientRect();
    d.style.left=r.left+'px'; d.style.right='auto'; d.style.width=r.width+'px';
    d.style.top=(r.top+r.height*0.42)+'px'; }
  $('#fx').appendChild(d);
  d.animate([{transform:'translateX(-60px)',opacity:0,filter:'blur(6px)'},
    {transform:'translateX(0)',opacity:1,filter:'blur(0)',offset:.25},
    {transform:'translateX(0)',opacity:1,filter:'blur(0)',offset:.68},
    {transform:'translateX(60px)',opacity:0,filter:'blur(6px)'}],{duration:1150}); fxGone(d,1150);
  await nap(680);
}
/* pequeño destello en un contador de la barra (PD, Llaves, Alma) */

function fxStat(side, sel){
  if(!FXON()) return;
  const bar=$(side===ME?'#barMe':'#barFoe'); if(!bar) return;
  const e=bar.querySelector(sel); if(!e) return;
  e.animate([{transform:'scale(1)'},{transform:'scale(1.4)',offset:.35},{transform:'scale(1)'}],
    {duration:420,easing:'ease-out'});
}

/* ---------- barras ---------- */

function renderLeaders(){
  /* El peligro y el remate son estado, no efecto: se deciden aquí y el CSS
     hace el resto. Con la partida acabada se apaga: el final ya tiene su cartel. */
  {
    const mia=P(ME).alma, suya=P(FOE).alma, viva=!G.over;
    const peligro = viva && mia>0 && mia<=5;
    document.body.classList.toggle('peligro', peligro);
    document.documentElement.style.setProperty('--peligro', peligro ? ((6-mia)/6).toFixed(2) : '0');
    document.body.classList.toggle('remate', viva && suya>0 && suya<=5);
  }
  [[FOE,'#leaderFoe'],[ME,'#leaderMe']].forEach(([side,sel])=>{
    const host=$(sel); if(!host) return;
    const p=P(side), L=p.L, mine=side===ME;
    const usable = mine && !TGT && !G.resolving && canUseLeader(side) && tutCan('leader');
    const target = !mine && ((TGT&&isTargetable('face')) || (SEL&&canAttack(SEL)&&legalTargets(SEL).face));
    window.CAOZ_COLECCION_JUEGO?.marcar(host,side);
    const enc = CAOZ_ARTE.encuadre('lider_'+p.leaderId,'desktop_hud',host);
    host.innerHTML=`<div data-lado-arte="${side}" data-arte-id="lider_${p.leaderId}" data-acabado="${acabadoArte('lider_'+p.leaderId,host)}" class="leadercard${usable?' usable':''}${(mine&&p.leaderUsed)?' spent':''}${target?' tgt':''}${enc?' conarte':''}" id="lead${side}"${
      enc ? ` style="--ex:${enc.x}%;--ey:${enc.y}%;--ez:${(enc.z/100).toFixed(3)}"` : ''}>
      ${enc ? `<div class="marcoDibujo"><img class="dibujo" alt="" src="${urlArte('lider_'+p.leaderId,host)}"></div>` : ''}
      <div class="lcName">${L.n}</div>
      <div class="lcArt">${L.art}</div>
      <div class="lcEp">${L.ep}</div>
      <div class="lcAlma">❤️ ${Math.max(0,p.alma)}</div>
      <div class="lcHab">${L.habName}<span>${p.leaderUsed&&mine?'usada':L.habCost+' PD'}</span></div>
    </div>`;
    const e=host.firstElementChild;
    window.marcarNombreCarta(e.querySelector('.lcName'),'lider_'+p.leaderId,L.n);
    if(mine&&G.campana?.personaje)campanaVestirLider(e,G.campana.personaje,p.leaderId);
    if(!mine&&G.campana?.jefeSecreto)campanaVestirPitagoras(e);
    if(e.matches('.liderJugador,.identidadPitagoras'))CAOZ_ARTE.acabar(e,'lider_'+p.leaderId);
    e.onmouseenter=()=>showInspectLeader(e,side);
    e.onmouseleave=()=>$('#inspect').classList.remove('on');
    e.onclick=()=>{
      if(TGT){ pickTarget(mine?null:'face'); return; }
      if(!mine){ if(SEL&&canAttack(SEL)){ if(!tutCan('attack','face')){ tutNope(); return; } tryAttack(SEL,'face'); } return; }
      if(G.resolving) return;
      if(!tutCan('leader')){ tutNope(); return; }
      if(usable){ if(NET.guest){ gIntent('leader'); return; } useLeader(ME); }
      else if(G.active===ME) toast(whyNotLeader(ME));
    };
  });
}
/* El mazo vive en el costado izquierdo y las Alcantarillas en el derecho, cada
   cosa en su lado de la mesa. Antes iban apiladas en la misma columna y ésta se
   quedaba sin alto: la barra de abajo salía cortada. */

function renderPiles(){
  [[FOE,'#foePiles'],[ME,'#myPiles']].forEach(([side,sel])=>{
    const host=$(sel); if(!host) return;
    const p=P(side);
    host.innerHTML=`
      <div class="pile deck${p.deck.length?'':' empty'}" id="${side===ME?'myDeckPile':'foeDeckPile'}"
           title="Mazo — ${p.deck.length} cartas por robar">
        <div class="pilelbl">MAZO</div><div class="pileart">🂠</div><div class="pilen">${p.deck.length}</div></div>`;
  });
  [[FOE,'#foeGrave'],[ME,'#myGrave']].forEach(([side,sel])=>{
    const host=$(sel); if(!host) return;
    host.replaceChildren(crearPilaAlcantarillas(side));
  });
}

function renderField(host, list, mine){
  const seisPesadillas=!!(!mine&&G.campana?.jefeSecreto&&list.length===CARTAS_EDITOR.length&&list.every(u=>u.alive&&u.card.editorJuego));
  host.classList.toggle('seisPesadillas',seisPesadillas);
  host.closest('.fieldwrap')?.classList.toggle('seisPesadillas',seisPesadillas);
  const seen=new Set();
  list.forEach((u,i)=>{
    seen.add(String(u.uid));
    let d=host.querySelector(':scope > [data-uid="'+u.uid+'"]');
    if(!d){ d=unitEl(u); host.appendChild(d); fxSummon(d); }
    else { const pa=d.dataset.a, ph=d.dataset.h; unitFill(d,u);
      if(pa!==undefined && FXON()){          // buffs y debuffs, vengan de donde vengan
        const da=u.atk-(+pa), dh=u.maxHp-(+ph);
        if(da>0||dh>0) fxBuff(u,(da>0?'+'+da+' ATQ':'')+(da>0&&dh>0?' ':'')+(dh>0?'+'+dh+' PV':''));
        else if(da<0) fxNumber(u,da+' ATQ','dmg');
        if(da!==0) fxPop(d.querySelector('.atk'), da>0?'#ffd25c':'#ff6b5f');
      }
      const pv=d.dataset.pv;
      if(pv!==undefined && +pv!==u.maxHp-u.dmg) fxPop(d.querySelector('.hp'), (u.maxHp-u.dmg)>(+pv)?'#5cf5a4':'#ff6b5f');
    }
    d.dataset.pv=u.maxHp-u.dmg;
    d.dataset.a=u.atk; d.dataset.h=u.maxHp;
    const rest=(u.sick&&!u.keys.has('prisa'))||u.stunned>0;
    const tgt=(TGT&&isTargetable(u)) ||
              (!mine&&SEL&&canAttack(SEL)&&legalTargets(SEL).units.includes(u));
    // "gastada": tuya y ya no puede atacar este turno. Sin esto había que
    // acordarse de con cuáles habías atacado ya, mirando una por una.
    const gastada = mine && !canAttack(u) && !u.card.noAttack && u.atk>0;
    /* El acomodo lo pone ilustrar() dentro de unitFill, y aquí se reescribía la
       lista de clases entera: se perdía en cada refresco. No se notaba mientras
       el dibujo iba de fondo en línea; con el dibujo en un <img> la carta se
       desmontaba —el pie se salía por debajo—. Se conserva. */
    const acomodo = d.classList.contains('conarte') ? ' acomodo conarte'
                  : d.classList.contains('sinarte') ? ' acomodo sinarte' : '';
    d.className='card unit t-personaje'+acomodo+(rest?' sick':'')
      +(u.infected?' infectado':'')      // verde mientras esté Infectado
      +((mine&&!rest&&canAttack(u))?' ready':'')+(tgt?' tgt':'')
      +(gastada?' gastada':'')
      +((mine&&SEL===u)?' selected':'');
    // Los estados siguen siendo datos del motor; esta capa sólo los hace
    // visibles sobre la carta que ya existe en la mesa.
    window.fxClaudeEstado?.(u,d);
    d.title='';   // el cajón ya lo cuenta; el aviso del sistema salía descolocado
    d.onclick = mine
      ? ()=>{ if(TGT){ pickTarget(u); return; }   // un objetivo inválido no cambia a selección de ataque
              if(SEL===u){ SEL=null; clearPrompt(); render(); return; }
              if(!tutCan('select')){ tutNope(); return; }
              selectUnit(u); }
      : ()=>{ if(TGT){ pickTarget(u); return; }
              if(SEL&&canAttack(SEL)){ if(!tutCan('attack','unit')){ tutNope(); return; } tryAttack(SEL,u); } };
    if(host.children[i]!==d) host.insertBefore(d, host.children[i]||null);
  });
  [...host.children].forEach(d=>{ if(!seen.has(d.dataset.uid)) d.remove(); });
}

function render(){
  if(!G||G.silent) return;
  campanaPrepararRival();
  if(NET.host) netPushState();
  $('#barFoe').innerHTML=barHTML(FOE);
  $('#barMe').innerHTML=barHTML(ME);
  if(G.campana?.personaje)$('#barMe .who>div').textContent=campanaNormalizarPersonaje(G.campana.personaje).nombre;
  // La mano del rival, boca abajo. No es adorno: saber cuántas cartas le quedan
  // cambia cómo juegas —si va vacío puedes arriesgar, si va lleno hay Trampa—
  // y hasta ahora eso vivía en un número pequeño de la barra.
  const fh=$('#foeHand');
  if(fh){
    const n=P(FOE).hand.length;
    if(fh.children.length!==n){          // sólo se rehace si cambió la cuenta
      fh.innerHTML='';
      for(let i=0;i<n;i++){
        const d=el('div','dorso');
        d.style.setProperty('--i',i);
        fh.appendChild(d);
      }
    }
    fh.style.setProperty('--n', n);
  }
  // trampas rival
  const ft=$('#foeTraps'); ft.innerHTML='';
  P(FOE).traps.forEach(t=>{ const d=el('div','trapback', t.revealed?CARDS[t.id].art:'🪤');
    d.title=t.revealed?CARDS[t.id].n:'Trampa boca abajo'; ft.appendChild(d); });
  // campos
  renderPiles();
  renderLeaders();
  renderField($('#foeField'), P(FOE).field, false);
  renderField($('#myField'),  P(ME).field,  true);
  const mt=$('#myTraps'); mt.innerHTML='';
  /* Tus Trampas, con su ficha al pasar por encima. Antes sólo llevaban el
     tooltip del navegador: tarda un segundo en salir, no se puede dar estilo y
     en la práctica nadie lo espera. Boca abajo lo están para el rival, no para
     ti: tú necesitas acordarte de qué pusiste. */
  P(ME).traps.forEach(t=>{ const c=CARDS[t.id];
    const d=el('div','trapback mine',`${c.art}
      <div class="cajon trampa"><b>${c.n}</b><br>${c.x}</div>`);
    window.marcarNombreCarta(d.querySelector('.cajon b'),c.id,c.n);
    mt.appendChild(d); });
  /* Lo que sigue activo aunque no esté en el campo. La Nube de Dagas dura tres
     turnos y no se veía en ninguna parte: sabías que la jugaste y luego ya no,
     y el rival tampoco tenía forma de saber por qué le pegaban al entrar. */
  renderNubesDagas();
  const mid=$('#midRow'); mid.innerHTML='';
  if(G.place){ const c=CARDS[G.place.id];
    const d=el('div','placecard',`<span class="pi">${c.art}</span><div><div class="pn"><span class="nombreLugar">${c.n}</span> <span style="color:var(--dim);font-weight:400">(${P(G.place.side).L.n})</span></div><div class="pt">${c.x}</div></div>`);
    window.marcarNombreCarta(d.querySelector('.nombreLugar'),c.id,c.n);
    if(TGT&&isTargetable(G.place)) d.classList.add('tgt');
    mid.appendChild(d);
  } else mid.appendChild(el('div','',`<span style="color:#4c4266;font-size:11px;letter-spacing:2px">— SIN LUGAR ACTIVO —</span>`));
  // reliquias propias con acción
  P(ME).relics.forEach(r=>{ const c=CARDS[r.id];
    if(!c.relicAct) return;
    const b=el('button','btn sm',`${c.art} ${c.relicAct.n} (${r.counters||0})`);
    b.disabled=!!TGT||G.resolving||G.active!==ME||G.over||P(ME).pd<c.relicAct.cost;
    b.onclick=()=>{ if(TGT||G.resolving) return; if(NET.guest){ gIntent('relic',{id:r.id}); return; } useRelic(ME,r); };
    mid.appendChild(b); });
  // mano
  const h=$('#hand');
  const mano=P(ME).hand, nMano=mano.length;
  h.style.setProperty('--n', nMano);
  /* CUÁNTO SE JUNTAN. Se mide el hueco y se solapa lo justo para que quepan
     TODAS, contando lo que el giro del abanico empuja los extremos hacia fuera:
     la carta pivota 240 % por debajo de su alto, así que a 10° la del extremo
     se corre unos 70 px. Cada carta lleva margen negativo a los dos lados, de
     ahí el 2n del reparto. Si la mano está oculta mide 0 y se deja el respaldo. */
  {
    const raiz=getComputedStyle(document.documentElement);
    const cw=parseFloat(raiz.getPropertyValue('--cwm'))||150, ch=parseFloat(raiz.getPropertyValue('--chm'))||210;
    const ancho=h.clientWidth-16;                     // menos el padding lateral
    if(ancho>0 && nMano>1){
      const desde=(nMano-1)/2, ang=desde*2.9*Math.PI/180;
      const vuelo=(2.4*ch - ch/2)*Math.sin(ang);        // brazo desde el pivote al centro de la carta
      const necesario=nMano*cw+(nMano-1)*6+2*vuelo;
      const crudo=(necesario-ancho)/(2*nMano);
      const sol=crudo>0 ? crudo+3 : 0;                  // +3 de aire sólo cuando hay que apretar
      h.style.setProperty('--solape-js', sol.toFixed(1)+'px');
    } else h.style.removeProperty('--solape-js');
  }
  /* LA MANO SE RECONCILIA, NO SE REHACE.
     Cada ranura conserva el hitbox aunque la carta que contiene salga del
     abanico para ampliarse. Así, el ratón sigue apuntando a la misma carta
     aunque el dibujo pase por encima de las vecinas. */
  const viejos=[...h.children];
  let j=0;
  mano.forEach((id,iMano)=>{
    let ranura=null,d=null;
    while(j<viejos.length){
      const v=viejos[j];
      if(v.dataset.card===id){ ranura=v; d=v.querySelector('.card'); j++; break; }
      if(!mano.slice(iMano).includes(v.dataset.card)){ v.remove(); j++; continue; }
      break;                                   // está más adelante: aquí va una nueva
    }
    if(!ranura){
      ranura=el('div','handSlot');ranura.dataset.card=id;
      d=cardEl(id,{side:ME});
      // en la mano la carta se amplía sola al pasar por encima: el cuadro aparte
      // sobra y obligaba a mirar a otro sitio
      d.onmouseenter=null; d.onmouseleave=null;
      ranura.appendChild(d);h.insertBefore(ranura, viejos[j]||null);
    } else {
      // el coste puede cambiar con el estado (descuentos, peajes): al día
      const cost=costOf(id,ME), ce=d.querySelector('.cost');
      if(ce){ ce.textContent=cost; ce.classList.toggle('rebajado', cost<CARDS[id].c); }
      d.classList.remove('locked','playable','unplayable','hi','selected');
    }
    // el abanico se dibuja en CSS; aquí sólo se dice qué puesto ocupa cada una
    ranura.style.setProperty('--i', iMano);
    const ok=!G.resolving&&canPlay(ME,id);
    const libre=tutCan('hand',id);
    d.classList.add(!libre?'locked':(ok?'playable':'unplayable'));
    /* ok y libre se vuelven a mirar al pulsar: el nodo puede sobrevivir a
       varios repintados y lo que valía al crearlo puede haber cambiado. */
    const jugar=async()=>{ if(TGT||G.resolving) return;
      if(!tutCan('hand',id)){ tutNope(); return; }
      /* Al Registro también: el aviso flotante se va solo y el motivo con él,
         que es justo lo que uno quiere releer cuando algo no le deja jugar. */
      if(!canPlay(ME,id)){ const w=whyNot(ME,id);
        toast(w); log(`No puedes jugar <b>${CARDS[id].n}</b> — ${w}.`,'sys',true); return; }
      if(!await confirmarNubeDagas(id)||!canPlay(ME,id)||G.resolving||TGT)return;
      SEL=null; clearPrompt();
      if(NET.guest){ gIntent('play',{id}); return; }
      playFromHand(ME,id); };
    ranura.onclick=jugar;
    // Las pruebas y algunos atajos de accesibilidad pulsan la carta interna;
    // físicamente recibe el clic la ranura, pero ambos caminos son equivalentes.
    d.onclick=e=>{e.stopPropagation();jugar();};
  });
  for(; j<viejos.length; j++) viejos[j].remove();   // los que sobran al final
  h.classList.toggle('apretada', nMano>7);
  renderControls();
  encajarTextos();                 // las tribus largas, a la medida de su carta
  window.fxClaudeCampo?.();
  window.PITAGORAS_MESA?.actualizar(G);
  if(G.tutorial) tutHighlight();
}
/* Por qué no puedes jugar ESA carta. El orden es el mismo que el de canPlay,
   para que el motivo que se enseña sea de verdad el que la bloquea. */

function relojPara(){
  if(RELOJ.id){ clearInterval(RELOJ.id); RELOJ.id=null; }
  const e=$('#reloj'); if(e) e.hidden=true;
}

function relojPinta(){
  const e=$('#reloj'); if(!e) return;
  e.hidden=false;
  const m=Math.floor(RELOJ.queda/60), sg=RELOJ.queda%60;
  e.textContent=`⏱️ ${m}:${String(Math.max(0,sg)).padStart(2,'0')}`;
  e.classList.toggle('poco', RELOJ.queda<=15);
}

/* TERMINAR TURNO CON PUNTOS SIN GASTAR
   Los PD no se arrastran de un turno a otro —cada turno se recalculan desde
   cero— salvo los 2 que guarda Machete. Así que terminar con puntos encima es
   tirarlos, y es un error que no avisa de ninguna forma.
   Pero preguntar cada vez que sobre un punto sería un fastidio: con 1 PD y la
   mano llena de cartas de 3 no hay nada que decidir. Sólo se pregunta cuando
   esos puntos alcanzan para algo concreto, y la pregunta dice para qué.
   Va en la barra de aviso y no en el panel grande a propósito: para contestar
   hay que poder mirarse la mano. */

function renderControls(){
  const c=$('#controls'); c.innerHTML='';
  const p=P(ME), L=p.L;
  if(SEL&&SEL.card.act){
    const a=SEL.card.act;
    const b=el('button','btn sm',`✨ ${a.n} (${a.cost} PD)`);
    b.disabled=!!TGT||G.resolving||!canUseAct(SEL);
    b.onclick=()=>{ if(TGT||G.resolving||!canUseAct(SEL)) return; if(NET.guest){ gIntent('act',{uid:SEL.uid}); SEL=null; render(); return; } useAct(SEL); };
    c.appendChild(b);
  }
  const e=el('button','btn gold','Terminar turno ⏭');
  e.disabled=!!TGT||G.active!==ME||G.busy||G.resolving||G.over||!tutCan('end');
  e.onclick=pedirTerminarTurno;
  c.appendChild(e);
  const r=el('button','btn sm','📜 Reglas'); r.onclick=()=>showRules(true); c.appendChild(r);
  // Salida al menú. No lleva tutCan(): el tutorial bloquea el tablero para que
  // no te pierdas, pero irse siempre tiene que poder hacerse.
  const s=el('button','btn sm','← Menú'); s.onclick=pedirSalirAlMenu; c.appendChild(s);
  campanaBotonFinalGero(c);
  window.campanaBotonesEditorBeta?.(c);
}
/* POR QUÉ NO PUEDE ATACAR
   Una sola lista de motivos, en el mismo orden en que canAttack los comprueba.
   Antes esto vivía suelto dentro de selectUnit y se quedó atrás: al añadir el
   Peaje de Brick y Brock a canAttack no se añadió aquí, así que la carta decía
   sólo "no puede atacar" sin decir por qué —y el motivo era que el rival te
   cobraba un PD por atacar y no te quedaba ninguno—.
   Teniéndolo aquí, cualquier condición nueva que se añada a canAttack sin pasar
   por esta lista se delata sola: sale el texto de abajo, que dice justamente
   que falta explicarlo. */

/* El motor la llama al seleccionar una unidad. Es de la pantalla del teléfono
   (movil.html), donde no hay hover; aquí la ficha ya la da el ratón. */
function fichaTactil(u){}

function tutNope(){
  const s=TUT_STEPS[TUT.i];
  toast(s&&s.wait ? 'El tutorial te pide otra cosa' : 'Lee lo que dice Gero');
  const box=$('#tut');
  if(box) box.animate([{transform:'translateY(-50%) translateX(0)'},
    {transform:'translateY(-50%) translateX(-8px)'},{transform:'translateY(-50%) translateX(8px)'},
    {transform:'translateY(-50%) translateX(0)'}],{duration:300});
}

function tutStart(){
  clearInterval(TUT.poll);            // si venías de otro tutorial, mata su sondeo
  if(TUT.pending) TUT.pending();
  document.body.classList.remove('tutpause');
  TUT={i:0,on:true,pending:null,bubble:0,foeTurn:0,data:null,poll:null,block:0,stepTurn:null,jugadas:null,endArgs:null,lider:TUT.lider};
  document.body.classList.add('tut-on');
  TUT.poll=setInterval(tutCheck,500);
  tutRender();
}

function tutRender(){
  if(!TUT.on){ $('#tut').classList.remove('on'); return; }
  const s=TUT_STEPS[TUT.i];
  if(!s){ tutEnd(); return; }
  $('#tut').classList.add('on');
  $('#tutStep').textContent=`${TUT.i+1}/${TUT_STEPS.length}`;
  const kind=$('#tutKind'), body=$('#tutBody'), wait=$('#tutWait'), next=$('#tutNext');
  // Un paso reactivo espera un evento del motor; si la partida ya terminó no va a
  // llegar ninguno, así que se lee como un cartel normal en vez de colgarse.
  const waiting = s.on && !TUT.pending && !(G&&G.over);
  // un beat del rival no puede dispararse si todavía es tu turno: hay que avisar
  const mustEnd = waiting && G && !G.over && G.active===ME;
  TUT.hint = mustEnd;
  $('#tut').classList.toggle('watch', !!s.on);
  $('#tut').classList.toggle('todo', (!!s.wait && !s.on) || mustEnd);
  if(waiting){
    kind.textContent = mustEnd ? '🎯 TE TOCA' : '👁 MIRA AL RIVAL';
    body.innerHTML = (s.wait_t||'<i>Observa. Te aviso en cuanto pase algo que merezca explicación.</i>')
      + (mustEnd ? '<br><br><b>👉 Sigue tu turno y pulsa «Terminar turno» abajo</b> para que Adreida juegue.' : '');
    wait.textContent = mustEnd ? '⏳ Te toca a ti' : '⏳';
    next.style.display='none';
  } else {
    const texts=tutTexts(s);
    kind.textContent = s.on ? '👁 MIRA AL RIVAL' : (s.wait? '🎯 TE TOCA' : '🎲 GERO EXPLICA');
    body.innerHTML=texts[TUT.bubble];
    const more = TUT.bubble < texts.length-1;
    const isTask = !more && s.wait;
    wait.textContent = isTask ? '⏳ Te toca a ti' : '';
    // en un paso de acción no hay botón: se avanza jugando, no leyendo
    next.style.display = isTask ? 'none' : '';
    next.textContent = more ? 'Sigue →' : (s.last?'¡A jugar! →':'Entendido →');
    next.className = 'btn gold sm';
  }
  tutHighlight();
  if(G) render();          // el tablero tiene que reflejar los permisos del paso nuevo
}

const tutShow = tutRender;

function tutHighlight(){
  $$('.hi').forEach(e=>e.classList.remove('hi'));
  if(!TUT.on) return;
  const s=TUT_STEPS[TUT.i];
  if(!s) return;
  if(s.on&&!TUT.pending){                    // beat en espera
    if(TUT.hint){ const c=$('#controls'); if(c) c.classList.add('hi'); }
    return;
  }
  if(!s.hi) return;
  const t=$(s.hi); if(t) t.classList.add('hi');
}
/* avanza una burbuja; al agotarlas cierra el paso y desbloquea el motor */

function tutNext(){
  if(!TUT.on) return;
  const s=TUT_STEPS[TUT.i]; if(!s){ tutEnd(); return; }
  if(!(s.on && !TUT.pending) && TUT.bubble < tutTexts(s).length-1){ TUT.bubble++; tutRender(); return; }
  const resume=TUT.pending;
  TUT.pending=null; TUT.bubble=0; TUT.data=null; TUT.i++; TUT.block=0; TUT.stepTurn=null; TUT.jugadas=null;
  document.body.classList.remove('tutpause');
  if(s.last){ tutEnd(); } else tutRender();
  if(resume) resume();
}
/* pasos de acción: se cumplen solos */
/* ¿el jugador puede cumplir AHORA lo que pide el paso? Sin botón de saltar,
   esto es lo que garantiza que nunca se quede encerrado. */

async function tutBeat(kind,data){
  if(!TUT.on||TUT.pending||G.over) return;
  tutFlush();
  if(!TUT.on) return;
  const fits=c=>c&&c.on===kind&&(!c.when||c.when(G,data));
  let s=TUT_STEPS[TUT.i];
  if(!fits(s)){
    // el motor puede haberse adelantado un paso: buscamos el beat un poco más
    // adelante, pero sin saltarnos ninguna tarea que el jugador aún deba hacer
    let j=-1;
    for(let k=TUT.i+1;k<Math.min(TUT_STEPS.length,TUT.i+4);k++){
      const c=TUT_STEPS[k];
      if(c.wait&&!c.on&&!c.wait(G)) break;
      if(fits(c)){ j=k; break; }
    }
    if(j<0) return;
    TUT.i=j; s=TUT_STEPS[j];
  }
  TUT.data=data; TUT.bubble=0;
  document.body.classList.add('tutpause');
  $('#inspect').classList.remove('on');
  render();
  await new Promise(res=>{ TUT.pending=res; tutRender(); });
}

function tutEnd(){
  const pend=TUT.endArgs; TUT.endArgs=null;
  TUT.on=false; document.body.classList.remove('tut-on'); TUT.pending&&TUT.pending();
  TUT.pending=null; if(TUT.poll) clearInterval(TUT.poll);
  document.body.classList.remove('tutpause');
  $('#tut').classList.remove('on'); $$('.hi').forEach(e=>e.classList.remove('hi'));
  if(pend){ const g0=G; setTimeout(()=>{ if(G===g0&&G.over) showEnd(pend[0],pend[1]); },400); }
}

/* turno guionizado del rival */

function showTutorialPick(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>showTutorialPick()))return;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>🎓 ¿Con qué mazo quieres aprender?</h3>
    <p>El tutorial usa <b>las cartas de ese Protagonista</b> y termina enseñándote su estrategia.
       Si es tu primera partida, Fender es el más directo.</p>`;
  const list=el('div','leaders');
  // de más fácil a más difícil: el que se recomienda arriba tiene que salir primero
  Object.keys(LEADERS).sort((a,b)=>GUIAS[a].dif-GUIAS[b].dif).forEach(id=>{
    const L=LEADERS[id], D=DECKS[id], g=GUIAS[id];
    const d=el('div','lcard',`<div class="lface">${L.art}</div><div class="lname">${L.n}</div>
      <div class="larch">${D.d}</div>
      <div class="ltxt"><b>“${D.n}”</b><br>${'★'.repeat(g.dif)+'☆'.repeat(3-g.dif)} · ${g.lema}</div>`);
    window.marcarNombreCarta(d.querySelector('.lname'),'lider_'+id,L.n);
    ilustrarLider(d, id);
    d.onclick=()=>{ cerrarOv(); $('#log').innerHTML=''; startTutorial(id); };
    list.appendChild(d);
  });
  p.appendChild(list);
  const row=el('div','opts');
  const back=el('button','btn sm','Cancelar'); back.onclick=()=>cerrarOv();
  row.appendChild(back); p.appendChild(row);
  openOv();
}

async function startTutorial(lid){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>startTutorial(lid)))return;
  tutEnd();                           // limpieza por si había uno a medias
  // y por si venías del cartel de victoria de la partida anterior
  cerrarOv(); clearPrompt(); SEL=null; TGT=null;
  lid = lid && TUT_MAZO[lid] ? lid : 'fender';
  TUT.lider=lid; TUT_STEPS=buildTut(lid);
  const M=TUT_MAZO[lid];
  newGame(lid,'adreida',{tutorial:true});
  G.fast=false; G.second=FOE;
  const give=(s,list)=>{ list.forEach(c=>{ const i=P(s).deck.indexOf(c); if(i>=0) P(s).deck.splice(i,1); });
    P(s).hand=[...list]; };
  give(ME,M.mano);
  give(FOE,['bartolomeo','mazo','augusto','horton','eric']);
  const top=(s,list)=>{ list.slice().reverse().forEach(c=>{ const i=P(s).deck.indexOf(c);
    if(i>=0){ P(s).deck.splice(i,1); P(s).deck.unshift(c); } }); };
  top(ME,M.top);
  showScreen('board');
  log('<b>Tutorial del Domo</b> — '+LEADERS[lid].n+' contra Adreida.','sys');
  G.turnNo=0; G.active=FOE;
  tutStart();
  await startTurn(ME);
}

/* ==========================================================================
   12. PANTALLAS
   ========================================================================== */
/* Al cambiar de pantalla el fondo de los menús se enciende o se apaga, pero
   entre menú, selector y guías NO se toca: sigue exactamente donde estaba. */

function showScreen(id){
  if(id==='select'&&!window.CAOZ_CUENTA_JUEGO?.requerir(()=>showScreen(id)))return;
  if(id!=='board'){campanaCancelarInterferencia();window.PITAGORAS_MESA?.cancelar();}
  const antes=$('.screen.on'),pantalla=$('#'+id),esMenu=pantalla.classList.contains('portada');
  if(antes!==pantalla||!esMenu)limpiarTransicionMenu();
  $$('.screen').forEach(s=>s.classList.remove('on'));
  pantalla.classList.add('on');
  window.fxClaudeActivarCampo?.(id==='board');
  $('#fondoMenus').classList.toggle('on',esMenu);
  if(id!=='board'){document.body.classList.remove('peligro','remate');}
  // El tablero entra con su propio VS; las pantallas de menú comparten el oro.
  if(esMenu&&antes!==pantalla)animarTransicionMenu(pantalla);
  window.dispatchEvent(new CustomEvent('caoz:pantalla',{detail:{id}}));
}

/* EL FOIL SIGUE AL CURSOR.
   Una sola escucha en el documento; sólo la carta bajo el cursor recibe
   --mx/--my, y la anterior los pierde al salir. A ritmo de rAF: mover el ratón
   dispara docenas de eventos por fotograma y no hace falta más de una lectura
   por fotograma. */
{
  /* Vale para TODAS las cartas, no sólo las legendarias: el foil sólo lo usan
     ellas, pero la inclinación 3D la usan la carta ampliada de la mano y el
     panel de inspección, que se lleva una copia de las variables. */
  let cartaFoil = null, pendiente = null;
  const panel = () => $('#inspectCard');
  const suelta = () => {
    if(cartaFoil){ cartaFoil.style.removeProperty('--mx'); cartaFoil.style.removeProperty('--my'); cartaFoil = null; }
    const b = panel(); if(b){ b.style.removeProperty('--mx'); b.style.removeProperty('--my'); }
  };
  /* También las cartas de Líder en mesa (.leadercard): son el único sitio donde
     el panel de inspección se abre de verdad —mano, galería y tutorial se
     amplían solas—, y sin ellas el panel nunca recibiría las variables. */
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && (e.target.closest('.card, .leadercard')
      || e.target.closest('#hand > .handSlot')?.querySelector('.card'));
    if(!c){ suelta(); return; }
    if(c !== cartaFoil){ suelta(); cartaFoil = c; }
    if(pendiente) return;
    pendiente = requestAnimationFrame(() => {
      pendiente = null; if(!cartaFoil) return;
      const r = cartaFoil.getBoundingClientRect();
      const mx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)).toFixed(3);
      const my = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)).toFixed(3);
      cartaFoil.style.setProperty('--mx', mx); cartaFoil.style.setProperty('--my', my);
      const b = panel();
      if(b && $('#inspect').classList.contains('on')){ b.style.setProperty('--mx', mx); b.style.setProperty('--my', my); }
    });
  }, {passive:true});
  document.addEventListener('pointerleave', suelta, {passive:true});
}

/* LA RANURA, NO EL DIBUJO, RECIBE EL RATÓN.
   Las cartas de una mano llena se solapan; si la que crece se convierte en el
   nuevo hitbox, el navegador alterna entre dos vecinas. La ranura no escala y
   fija la carta activa hasta que el cursor cambia de ranura o abandona la mano. */
{
  const mano = $('#hand');
  let activa = null;
  const activar = ranura => {
    if(ranura===activa) return;
    if(activa)activa.classList.remove('is-hover');
    activa=ranura;
    if(activa)activa.classList.add('is-hover');
  };
  mano.addEventListener('pointerover', e => {
    const ranura = e.target.closest && e.target.closest('#hand > .handSlot');
    if(ranura)activar(ranura);
  });
  mano.addEventListener('pointerleave', () => activar(null));
}

/* El fogonazo del botón. Va por delegación y en `pointerdown` a propósito: el
   `click` de muchos de estos botones cambia de pantalla, y para entonces el
   botón ya no se ve. Encendiéndolo al apretar, el destello ocurre mientras la
   pantalla se recompone y tapa el corte. */
document.addEventListener('pointerdown', e=>{
  const b = e.target.closest && e.target.closest('.portada .btn');
  if(!b || b.disabled) return;
  b.classList.remove('fogonazo'); void b.offsetWidth;
  b.classList.add('fogonazo');
  setTimeout(()=>b.classList.remove('fogonazo'), 560);
}, true);

function buildSelect(){
  const ids = Object.keys(LEADERS);
  const mio = SEL_PASO === 'yo';
  if(!SELP) SELP = ids[0];
  if(!mio && !SELF) SELF = ids.find(x=>x!==SELP) || ids[0];
  const elegido = mio ? SELP : SELF;             // quién va al frente en este paso
  const centro = Math.max(0, ids.indexOf(elegido));

  $('#selTitle').textContent = mio ? 'ELIGE TU PROTAGONISTA' : 'ELIGE A TU RIVAL';
  $('#selSub').innerHTML = mio
    ? 'Cada Líder trae su mazo preconstruido de 40 cartas.'
    : `Llevas a <b style="color:var(--gold)">${LEADERS[SELP].n}</b>. ¿Contra quién?`;
  $('#selGo').textContent = mio ? 'Elegir →' : 'Entrar al Domo →';
  $('#selBack').textContent = mio ? '← Volver' : '← Cambiar Protagonista';
  const p = $('#selPasos').children;
  p[0].classList.toggle('on', true); p[1].classList.toggle('on', !mio);
  $('#select').classList.toggle('rival', !mio);   // la sala vira a rojo
  $('#fondoMenus').classList.toggle('rival', !mio);

  /* LAS CARTAS SE CREAN UNA SOLA VEZ.
     Antes se rehacía la pista entera en cada giro, y por eso el carrete saltaba
     en vez de deslizarse: los nodos eran nuevos y el navegador no tenía nada
     que animar. Ahora sólo cambian --d y la clase del frente, que es lo que las
     transiciones del CSS saben mover. */
  const pista = $('#leaderList');
  if(pista.children.length !== ids.length){
    pista.innerHTML='';
    ids.forEach(id=>{
      const L=LEADERS[id], D=DECKS[id];
      const d=el('div','lcard',`
        <div class="lface">${L.art}</div>
        <div class="lname">${L.n}</div>
        <div class="larch">${D.d}</div>
        <div class="lhab">${L.habName} · <b>${L.habCost} PD</b></div>`);
      d.dataset.lid = id;
      d.onclick=()=>{ if(SEL_PASO==='yo') SELP=id; else SELF=id; buildSelect(); };
      window.marcarNombreCarta(d.querySelector('.lname'),'lider_'+id,L.n);
      ilustrarLider(d, id);
      pista.appendChild(d);
    });
  }
  [...pista.children].forEach((d,i)=>{
    if(d.dataset.ladoArte!==String(mio?ME:FOE)){
      window.CAOZ_COLECCION_JUEGO?.marcar(d,mio?ME:FOE);ilustrarLider(d,d.dataset.lid);
    }
    /* Distancia al frente, dando la vuelta.
       Con CINCO cartas el abanico salía solo: -2..+2, dos a cada lado.
       Con SEIS ya no: el reparto es -2..+3, tres cartas a un lado y dos al
       otro, y al girar se veían dos saltando de golpe al lado corto.
       La solución no es repartir mejor —con un número par no hay reparto
       simétrico posible— sino guardar una: la carta del extremo opuesto se
       esconde DETRÁS de la elegida (misma posición, sin opacidad) y sale de
       ahí al girar. Así el abanico siempre enseña los mismos dos a cada lado.
       Con impares no esconde ninguna: la cuenta se ajusta sola. */
    const n = ids.length;
    let dd = ((i - centro) % n + n) % n;      // 0..n-1
    if(dd > n/2) dd -= n;                     // y ahora centrado en 0
    const visibles = Math.floor((n - 1) / 2); // cuántas caben a cada lado
    const guardada = Math.abs(dd) > visibles;
    d.classList.toggle('guardada', guardada);
    d.style.setProperty('--d', guardada ? 0 : dd);
    d.classList.toggle('enfrente', i===centro);
  });

  // la ficha: lo que hay que leer de la que está al frente
  const L=LEADERS[elegido], D=DECKS[elegido];
  $('#fichaLider').innerHTML = `
    <div class="cabeza">
      <div class="fn">${L.n} <span style="font-size:13px;color:var(--dim)">— ${L.ep}</span></div>
      <div class="fa">${D.d}</div>
    </div>
    <div class="cuerpo">
      <div class="fl">${L.pasiva}</div>
      <div class="fl">${L.hab}</div>
      <div class="fm">Mazo <b>“${D.n}”</b> · 40 cartas · dificultad ${estrellas(GUIAS[elegido].dif)}</div>
    </div>`;

  $('#selGo').disabled=false;
}

/* ¿Puede rodar ya la pasiva de Gero?
   En el tutorial no, hasta que él la haya explicado. Rodaba desde el turno 1 y
   lo primero que veía el alumno era un d20 cayendo del cielo antes de que
   nadie le hubiera dicho qué es un d20, qué es un PD ni qué es el Alma. Una
   lección se enseña y luego se ve, no al revés.
   Fuera del tutorial rueda siempre. */

function tutPasivaLista(){
  if(!TUT.on) return true;
  const k = TUT_STEPS.findIndex(x => x && x.pasiva);
  return k < 0 || TUT.i >= k;
}

/* La dificultad se pinta con tres estrellas. Con un valor fuera de rango,
   '☆'.repeat(3-4) lanza RangeError, y como esto va dentro de un innerHTML de
   una sola pieza, la excepción se llevaba por delante la ficha ENTERA: el
   carrusel enseñaba a Gero y la caja de abajo se quedaba con el Líder de
   antes. Un dato mal puesto no puede apagar un panel. */

function showGallery(){
  const p=$('#ovPanel');
  const types=['todas','personaje','hechizo','trampa','objeto','lugar'];
  let filter='todas';
  let mazo='todos';                       // 'todos' o el id de un Líder

  /* Las cartas de un mazo, con cuántas copias lleva. Sirve para filtrar y para
     enseñar el ×2 o ×3 al lado de cada una: un mazo no es una lista de cartas
     distintas, es cuántas veces repites cada una. */
  const delMazo = lid => {
    const m = {};
    (DECKS[lid] ? DECKS[lid].list : []).forEach(([id,n]) => m[id] = n);
    return m;
  };

  const draw=()=>{
    const enMazo = (mazo==='todos'||mazo==='cajon') ? null : delMazo(mazo);
    const enElCajon = mazo==='cajon';
    const base = Object.keys(CARDS).filter(k=>!CARDS[k].token && !CARDS[k].set).length;
    const cajon = Object.keys(CARDS).filter(k=>!CARDS[k].token && CARDS[k].set==='cajon').length;
    p.innerHTML = enElCajon
      ? `<h3>🗄️ El Cajón</h3>
         <p>${cajon} cartas nuevas, todavía fuera de los mazos. Están hechas y se pueden
            probar, pero ninguna entra en una partida hasta que la metamos en una lista.</p>`
      : `<h3>🃏 Cartas del set base</h3>
         <p>${base} cartas + ${Object.keys(LEADERS).length} Líderes
            + ${Object.keys(CARDS).filter(k=>CARDS[k].token).length} fichas.
            Pasa el cursor por una carta para verla en grande.</p>`;

    // primera fila: por Líder
    const fm=el('div','filters');
    const bt=el('button','btn sm'+(mazo==='todos'?' on':''),'Todos los mazos');
    bt.onclick=()=>{mazo='todos';draw();}; fm.appendChild(bt);
    Object.keys(LEADERS).forEach(lid=>{
      const b=el('button','btn sm'+(mazo===lid?' on':''), LEADERS[lid].art+' '+LEADERS[lid].n);
      b.onclick=()=>{mazo=lid;draw();}; fm.appendChild(b);
    });
    if(cajon){                              // el apartado aparte, si hay algo dentro
      const bc=el('button','btn sm'+(enElCajon?' on':''),'🗄️ El Cajón');
      bc.onclick=()=>{mazo='cajon';draw();}; fm.appendChild(bc);
    }
    p.appendChild(fm);

    // segunda fila: por tipo
    const f=el('div','filters');
    types.forEach(t=>{ const b=el('button','btn sm'+(filter===t?' on':''),cap(t));
      b.onclick=()=>{filter=t;draw();}; f.appendChild(b); });
    p.appendChild(f);

    /* El Cajón vive aparte: sus cartas no salen en «Todos los mazos» ni en el
       de ningún Líder, porque todavía no son del juego. */
    const lista = Object.keys(CARDS)
      .filter(k=>!CARDS[k].token
                 && (filter==='todas'||CARDS[k].t===filter)
                 && (enElCajon ? CARDS[k].set==='cajon' : !CARDS[k].set)
                 && (!enMazo || enMazo[k]))
      .sort((a,b)=>CARDS[a].c-CARDS[b].c);

    if(enMazo){
      const total = lista.reduce((n,k)=>n+enMazo[k], 0);
      p.appendChild(el('div','notagal',
        `<b>${LEADERS[mazo].n}</b> — ${DECKS[mazo].d} · ${lista.length} cartas distintas`
        + (filter==='todas' ? `, ${total} en total` : '')));
    }

    const g=el('div','gallery');
    lista.forEach(k=>{
      const c=cardEl(k,{});
      // en la galería la carta crece al pasar por encima, como en la mano: el
      // cuadro flotante mostraba el emoji aunque la carta tuviera ilustración
      c.onmouseenter=null; c.onmouseleave=null;
      if(enMazo && enMazo[k]>1) c.appendChild(el('div','copias','×'+enMazo[k]));
      g.appendChild(c);
    });
    p.appendChild(g);
    // el panel todavía no está visible aquí y lo que no se ve mide cero: el
    // ajuste va en el frame siguiente, ya colocado en pantalla
    requestAnimationFrame(() => encajarTextos(g));
    if(!lista.length) p.appendChild(el('div','notagal','No hay cartas con ese filtro.'));

    const c=el('button','btn','Cerrar'); c.style.marginTop='14px';
    c.onclick=()=>cerrarOv(); p.appendChild(c);
  };
  draw(); openOv();
}

function showGrave(){
  const p=$('#ovPanel');
  p.innerHTML='<h3>🕳️ Las Alcantarillas</h3>';
  [ME,FOE].forEach(s=>{
    p.appendChild(el('div','',`<div style="color:var(--gold);margin:10px 0 4px;font-weight:700">${P(s).L.n} — ${P(s).grave.length} cartas</div>`));
    const g=el('div','gallery');
    [...new Set(P(s).grave)].forEach(id=>{ const c=cardEl(id,{ladoArte:s});
      const n=P(s).grave.filter(x=>x===id).length;
      if(n>1) c.appendChild(el('div','rar',`×${n}`));
      g.appendChild(c); });
    if(!P(s).grave.length) g.appendChild(el('div','',`<span style="color:var(--dim)">Vacío.</span>`));
    p.appendChild(g);
  });
  const c=el('button','btn','Cerrar'); c.style.marginTop='14px';
  c.onclick=()=>cerrarOv(); p.appendChild(c);
  openOv();
}

function abrirEditor(){ location.href='estudio.html'; }

function showRecords(){
  const p=$('#ovPanel');
  p.innerHTML='<h3>🏆 Tus récords</h3>'+recordsHTML();
  const box=el('div','opts');
  const c=el('button','btn','Cerrar'); c.onclick=()=>{ cerrarOv(); };
  const b=el('button','btn sm','Borrar récords'); b.onclick=()=>{ if(confirm('¿Borrar todos los récords de este navegador?')){ borrarRecords(); showRecords(); } };
  box.appendChild(c); box.appendChild(b); p.appendChild(box); openOv();
}
function showRules(inGame){
  const p=$('#ovPanel');
  p.innerHTML='<h3>📜 Reglas del Domo</h3>'+RULES_HTML;
  const c=el('button','btn','Cerrar'); c.style.marginTop='14px';
  c.onclick=()=>cerrarOv();
  p.appendChild(c); openOv();
}

/* ---------- salir de una partida ----------
   Faltaba: desde el tablero no había forma de volver al menú. Las guías y la
   selección de Líder sí la tenían, y el cartel de fin también, pero una partida
   empezada era un callejón sin salida salvo recargando la página. */

function salirAlMenu(){
  tutEnd(); clearPrompt(); SEL=null; TGT=null;
  cerrarOv(); $('#inspect').classList.remove('on');
  if(NET.on){ netSend({t:'bye'}); setTimeout(netClose,400); }   // avisar al rival
  showScreen('menu');
}

function pedirSalirAlMenu(){
  if(!G || G.over) return salirAlMenu();          // no hay nada que perder
  const p=$('#ovPanel');
  const online = NET.on;
  p.innerHTML = `<h3>¿Salir al menú?</h3>
    <p style="font-size:14.5px">La partida en curso <b>se pierde</b>.` +
    (online ? ' Y tu rival se queda sin partida.' : '') + `</p>`;
  const box=el('div','opts');
  const si=el('button','btn','Sí, salir');
  si.onclick=salirAlMenu;
  const no=el('button','btn gold','Seguir jugando');
  no.onclick=()=>{ cerrarOv(); render(); };
  box.appendChild(no); box.appendChild(si); p.appendChild(box);
  openOv();
}

function showEnd(winner,why){
  if(G.campana){campanaFinal(winner,why);return;}
  const g0=G;
  RECORD_ULTIMO=null;
  if(!G.tutorial && !G.auto && !G.fast && !G.silent) anotarRecord(winner===ME, P(ME).leaderId, Math.ceil(G.turnNo/2), NET.on?'online':'ia');
  const acciones={
    revancha:()=>{ if(NET.on){ proponerRevancha(); return; }
      startMatch(P(ME).leaderId,P(FOE).leaderId); },
    menu:()=>{ tutEnd(); clearPrompt(); if(NET.on){ netSend({t:'bye'}); setTimeout(netClose,400); } showScreen('menu'); }
  };
  // la cinemática trae dentro Revancha y Menú; sin efectos (rápido, silencio,
  // pestaña escondida) sale el cartel de siempre
  cinematicaFinal(winner,why,acciones).then(hecho=>{ if(!hecho && G===g0) panelFinal(winner,why); });
}
/* el cartel de siempre, con los números */
function panelFinal(winner,why){
  const win = winner===ME;
  const p=$('#ovPanel');
  p.innerHTML=`<h3 style="font-size:26px">${win?'🏆 ¡VICTORIA!':'💀 DERROTA'}</h3>
    <p style="font-size:15px">${why}</p>
    <p>Turnos jugados: ${Math.ceil(G.turnNo/2)} · Tu Alma: ${Math.max(0,P(ME).alma)} · Alma rival: ${Math.max(0,P(FOE).alma)}</p>`;
  const box=el('div','opts');
  const again=el('button','btn gold','↺ Revancha');
  again.onclick=()=>{ cerrarOv();
    if(NET.on){ proponerRevancha(); return; }
    startMatch(P(ME).leaderId,P(FOE).leaderId); };
  const menu=el('button','btn','← Menú principal');
  menu.onclick=()=>{ cerrarOv(); tutEnd(); clearPrompt();
    if(NET.on){ netSend({t:'bye'}); setTimeout(netClose,400); } showScreen('menu'); };
  box.appendChild(again); box.appendChild(menu); p.appendChild(box);
  openOv();
}

/* Cada partida lleva número. startMatch se PARA a esperar el volado, y en ese
   hueco puede arrancar otra partida —el jugador vuelve al menú y entra de
   nuevo, o una prueba encadena varias—. Sin este número, la partida vieja
   seguía su camino al volver del volado y repartía encima de la nueva: te
   cambiaba los PD y la mano a media jugada. Costaba de ver porque sólo pasa si
   el reparto tardío coincide con lo siguiente que hagas. */

function cartaDeLiderVS(lid, lado, ladoArte){
  const L=LEADERS[lid], D=DECKS[lid];
  const d=el('div','vscard '+lado, `
    <div class="lface">${L.art}</div>
    <div class="lname">${L.n}</div>
    <div class="larch">${D.d}</div>`);
  window.CAOZ_COLECCION_JUEGO?.marcar(d,ladoArte);
  window.marcarNombreCarta(d.querySelector('.lname'),'lider_'+lid,L.n);
  ilustrarLider(d, lid);
  return d;
}

async function cortinillaVS(a, b, opts={}){
  /* Guarda propia: FXON() mira G, y aquí todavía no hay partida —la cortinilla
     va justo antes de crearla—. Se salta en todo lo que no sea una persona
     jugando: partidas automáticas, silenciosas, rápidas, y las que se piden sin
     volado, que son las del arnés y el tutorial. Cuatro segundos de adorno no
     pueden colarse en una tanda de 2000 partidas. */
  if(opts.silent || opts.fast || opts.auto || opts.volado===false) return;
  if(opts.sinCortinilla) return;                 // la usa el arnés: prueba otra cosa
  if(document.hidden) return;
  const capa = el('div','vs');
  capa.innerHTML = '<div class="vsfondo"></div><div class="vschispas"></div>';
  const izq = opts.campana?.personaje?campanaCartaJugador(opts.campana.personaje,a,'izq'):cartaDeLiderVS(a,'izq',ME), der = opts.campana?.jefeSecreto?campanaCartaPitagoras('der'):cartaDeLiderVS(b,'der',FOE);
  // En línea, estos son nombres de jugadores, no títulos de Líder. Quitamos
  // el marcador del Estudio antes de escribirlos: si no, el refresco asíncrono
  // del catálogo sustituye "Rafa" por el nombre de la carta unos milisegundos
  // después de abrir la cortinilla.
  if(opts.nombres) [[izq,opts.nombres[0]],[der,opts.nombres[1]]].forEach(([c,nombre])=>{
    const n=c.querySelector('.lname');
    n.removeAttribute('data-nombre-id');n.removeAttribute('data-nombre-base');n.removeAttribute('data-nombre-sufijo');
    n.textContent=String(nombre??'');
  });
  const sello = el('div','vssello','VS');
  capa.appendChild(izq); capa.appendChild(der); capa.appendChild(sello);
  document.body.appendChild(capa);

  await nap(60);
  capa.classList.add('entra');          // las cartas vienen de fuera
  await nap(620);
  capa.classList.add('choque'); window.CAOZ_AUDIO?.play('vs');         // el impacto: destello, fuego y sacudida
  await nap(2500);                      // se leen los dos nombres
  capa.classList.add('sale');           // se apartan y revelan la mesa
  await nap(760);
  capa.remove();
}

async function startMatch(a, b, opts={}){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>startMatch(a,b,opts)))return;
  campanaCancelarInterferencia();
  const mia = ++PARTIDA_N;
  tutEnd(); clearPrompt(); SEL=null; TGT=null;
  $('#log').innerHTML='';
  showScreen('board');
  // El volado necesita a alguien que elija lado. Se salta explícitamente con
  // {volado:false} — lo usan las pruebas, que si no se quedarían esperando un
  // clic que nadie va a dar.
  const conVolado = opts.volado !== false;

  /* Primero la cortinilla y luego el volado: la presentación va antes que la
     primera decisión. Con el volado delante, la cortinilla llegaba después de
     haber pedido cara o cruz y quedaba fuera de sitio. */
  await cortinillaVS(a, b, opts);
  if(mia !== PARTIDA_N) return;      // dura 4 s: puede haber arrancado otra

  // Sin volado se puede fijar quién empieza. Lo usan las pruebas: si se deja al
  // azar, media docena de comprobaciones dependen de una carrera —si la IA
  // termina su turno antes de que la prueba mire— y fallan una vez de cada dos
  // sin que nada esté roto. Una prueba que falla a veces no vale para frenar
  // una publicación, que es justo para lo que están.
  const first = conVolado ? await volado(opts.nombres?.[1]||LEADERS[b].n)
                          : (opts.first != null ? opts.first : null);
  if(mia!==PARTIDA_N)return;       // otra partida reemplazó este volado
  if(conVolado&&first==null){showScreen('menu');return;} // cancelado sin sortear un turno
  await setupMatch(a,b,{...(first==null?{}:{first}),...(opts.campana?{campana:opts.campana}:{})});
}


/* ==========================================================================
   14. PARTIDA ONLINE — sin cuentas, sin servidor propio
   Un jugador crea la sala y recibe un código; el otro lo escribe. El relevo
   es ntfy.sh (pub/sub público, sin registro): el código es el nombre del
   canal. El ANFITRIÓN corre el motor entero y manda el estado; el INVITADO
   sólo dibuja y manda intenciones, así que no hay nada que sincronizar ni
   azar que cuadrar entre las dos máquinas.
   ========================================================================== */
/* ---- Canal MQTT sobre WebSocket ----------------------------------------
   Segunda vía, de naturaleza distinta a la HTTP: los WebSockets no pasan por
   CORS y usan otros dominios y puertos, así que sobreviven a redes donde el
   fetch a los relevos está bloqueado. Cliente MQTT 3.1.1 mínimo escrito a
   mano (CONNECT / SUBSCRIBE / PUBLISH QoS0 / PING): no hace falta librería. */

function netVivos(){ return NET.chs.filter(c=>c.ok); }
/* El botón del diario vive en una barra que se repinta en cada render, así que
   se escucha desde arriba en vez de reengancharlo cada vez. */
addEventListener('click', e=>{
  if(e.target.classList && e.target.classList.contains('diariobtn')){
    NETDIARIO.bajar();
    toast('Diario descargado');
  }
});

function netStatus(t,cls){
  if(t!=null) NET.status=t;
  const e=$('#netStatus'); if(e){ e.textContent=NET.status; e.className='netstatus '+(cls||(netVivos().length?'ok':'')); }
  const d=$('#netDiag');
  if(d){
    const mq=NET.chs.filter(c=>c.tipo==='mqtt'), ht=NET.chs.filter(c=>c.tipo==='http');
    const err=(NET.chs.find(c=>!c.ok&&c.err)||{}).err;
    d.textContent=`vías: MQTT ${mq.filter(c=>c.ok).length}/${mq.length} · HTTP ${ht.filter(c=>c.ok).length}/${ht.length}`
      +` · enviados ${NET.tx} · recibidos ${NET.rx}`+(err?` · último fallo: ${err}`:'');
  }
}

function chatVisible(v){
  const z=$('#chatzona'); if(!z) return;
  z.hidden=!v;
  if(v && !$('#chat').children.length) chatVacio();
}

function chatVacio(){
  const c=$('#chat'); c.innerHTML='';
  const d=el('div','vacio'); d.textContent='Aquí podéis hablar durante la partida.';
  c.appendChild(d);
}

function chatPinta(mio, quien, texto){
  const c=$('#chat'); if(!c) return;
  const hueco=c.querySelector('.vacio'); if(hueco) hueco.remove();
  const d=el('div','msg '+(mio?'mio':'suyo'));
  const n=el('span','de'); n.textContent=quien+': ';   // textContent: nunca HTML
  d.appendChild(n);
  d.appendChild(document.createTextNode(texto));       // ídem con el mensaje
  c.appendChild(d);
  c.scrollTop=c.scrollHeight;
  while(c.children.length>120) c.firstChild.remove();  // no crece sin fin
}

function chatMio(){
  const i=$('#chatinput'); if(!i) return;
  const t=i.value.trim().slice(0,CHAT_MAX);
  i.value='';
  if(!t||!NET.on) return;
  const yo = NET.miNombre || (G ? P(ME).L.n : 'Tú');
  chatPinta(true, yo, t);
  netSend({t:'chat', de:yo, txt:t});
}
/* Llega del rival. Se recorta y se limpia por si el otro extremo mandara algo
   raro: aquí no se confía en que el mensaje venga bien formado. */

function chatRecibe(m){
  const de = String(m.de||NET.suNombre||'Rival').slice(0,24);
  const tx = String(m.txt||'').slice(0,CHAT_MAX);
  if(!tx) return;
  chatVisible(true);
  chatPinta(false, de, tx);
  if($('#panel')) toast('💬 '+de+': '+tx.slice(0,60));
}

const NETDIARIO = {
  filas: [],
  max: 500,
  apunta(dir, tipo, detalle){
    const t = new Date().toISOString().slice(11,23);
    this.filas.push({t, dir, tipo, ...detalle});
    if(this.filas.length > this.max) this.filas.shift();
  },
  texto(){
    const cab = [
      `Diario de partida en línea — Caoz Con Todo TCG build ${BUILD.n}`,
      `Generado: ${new Date().toISOString()}`,
      `Papel: ${NET.host?'anfitrión':'invitado'} · sala: ${NET.sala||'?'} · sid: ${NET.sid||'?'}`,
      `Enviados: ${NET.seq||0} · recibidos: ${NET.rx||0}`,
      G ? `Turno ${G.turnNo} · activo ${G.active===ME?'yo':'rival'} · ${G.over?'terminada':'en curso'}` : 'sin partida',
      '─'.repeat(70), ''
    ].join('\n');
    return cab + this.filas.map(f=>{
      const extra = Object.entries(f).filter(([k])=>!['t','dir','tipo'].includes(k))
        .map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join(' ');
      return `${f.t}  ${f.dir.padEnd(8)} ${String(f.tipo).padEnd(10)} ${extra}`;
    }).join('\n');
  },
  bajar(){
    const b=new Blob([this.texto()],{type:'text/plain'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download=`caoz-online-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }
};

function pickIndex(list,title){
  return new Promise(res=>{
    const p=$('#ovPanel'); p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','opts');
    list.forEach((o,i)=>{ const b=el('button','btn',(CARDS[o.id]?CARDS[o.id].art+' '+CARDS[o.id].n:o.id)+(o.en?' (en '+o.en+')':''));
      b.onclick=()=>{ cerrarOv(); res(i); }; box.appendChild(b); });
    p.appendChild(box); openOv();
  });
}

/* ---------- arranque de la partida en cada lado ---------- */

function netHostStart(a,b){return iniciarOnlineHost(a,b);}
function netGuestStart(m){return iniciarOnlineGuest(m);}
/* el invitado no toca el motor: manda intenciones */
/* Intención del invitado con acuse: si el relevo pierde el mensaje, se reenvía
   sola. El anfitrión ignora las repetidas por su identificador, así que nunca
   se ejecuta dos veces. */

function showOnline(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>showOnline()))return;
  ONL={lider:null,nombre:nombreGuardado(),sala:ONL.sala||null};
  const p=$('#ovPanel');
  p.innerHTML=`<h3>👥 Jugar con un amigo</h3>
    <p>Uno crea la sala y le pasa el código al otro
       (por WhatsApp, en voz alta, como quieras).</p>
    <p style="font-size:11.5px;color:#7a6d96;line-height:1.5">
       Va por un relevo público gratuito, así que el código es la única llave de la sala.
       Y como la partida la lleva la máquina del anfitrión, jugad con alguien de quien
       os fiéis: es una mesa entre amigos, no un torneo.</p>`;
  const box=el('div','opts');
  const b1=el('button','btn gold','🎲 &nbsp;Crear sala — yo invito');
  const b2=el('button','btn','🔑 &nbsp;Unirme con un código');
  const b3=el('button','btn sm','Cancelar');
  b1.onclick=()=>onlPickNombre(true); b2.onclick=()=>onlPickNombre(false);
  b3.onclick=()=>{ cerrarOv(); };
  box.appendChild(b1); box.appendChild(b2); box.appendChild(b3); p.appendChild(box);
  openOv();
}
/* CÓMO TE LLAMAS
   Antes de elegir mazo, tu nombre: en el chat y en los avisos aparece esto y no
   el del Protagonista, que además pueden repetir los dos. Se recuerda para la
   próxima, si el navegador deja guardar (en file:// a veces no, y no pasa nada).
   El nombre del rival llega por la red: es texto ajeno y se trata como tal —se
   recorta al recibirlo y se pinta con textContent, nunca como HTML—. */

function onlPickNombre(asHost){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>onlPickNombre(asHost)))return;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>${asHost?'Crear sala':'Unirse'} — ¿cómo te llamas?</h3>
    <p>Así te verá tu rival en el chat y en los avisos de la partida.</p>`;
  onlineAyudaInstalada(p);
  const inp=el('input','codeinput');
  inp.type='text'; inp.maxLength=18; inp.placeholder='Tu nombre';
  inp.value=nombreGuardado(); inp.autocomplete='off';
  inp.style.textTransform='none'; inp.style.letterSpacing='2px'; inp.style.fontSize='26px';
  p.appendChild(inp);
  const box=el('div','opts');
  const ok=el('button','btn gold','Continuar →');
  const no=el('button','btn sm','← Volver');
  const seguir=()=>{
    const n=(inp.value||'').trim().slice(0,18) || (asHost?'Anfitrión':'Invitado');
    ONL.nombre=n; guardaNombre(n);
    onlPickLeader(asHost);
  };
  ok.onclick=seguir;
  inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); seguir(); } };
  no.onclick=()=>showOnline();
  box.appendChild(ok); box.appendChild(no); p.appendChild(box);
  openOv();
  setTimeout(()=>inp.focus(),50);
}

function onlPickLeader(asHost){
  const p=$('#ovPanel');
  p.innerHTML=`<h3>${asHost?'Crear sala':'Unirse'} — elige tu Protagonista</h3>`;
  const list=el('div','leaders');
  Object.keys(LEADERS).forEach(id=>{
    const L=LEADERS[id], D=DECKS[id];
    const d=el('div','lcard',`<div class="lface">${L.art}</div><div class="lname">${L.n}</div>
      <div class="larch">${D.d}</div><div class="ltxt">${L.pasiva}</div>`);
    window.marcarNombreCarta(d.querySelector('.lname'),'lider_'+id,L.n);
    ilustrarLider(d, id);
    d.onclick=()=>{ ONL.lider=id; [...list.children].forEach(c=>c.classList.remove('sel'));
      d.classList.add('sel'); $('#onlGo').disabled=false; };
    list.appendChild(d);
  });
  p.appendChild(list);
  const row=el('div','opts');
  const go=el('button','btn gold', asHost?'Crear sala →':'Continuar →'); go.id='onlGo'; go.disabled=true;
  go.onclick=()=> asHost? onlHost() : onlJoinCode();
  const back=el('button','btn sm','← Volver'); back.onclick=showOnline;
  row.appendChild(go); row.appendChild(back); p.appendChild(row);
  openOv();
}

async function onlHost(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>onlHost()))return;
  const code=netCode();
  const p=$('#ovPanel');
  p.innerHTML=`<h3>Sala creada</h3>
    <p>Pásale este código a tu amigo. En cuanto lo escriba, empezamos.</p>
    <div class="roomcode" id="roomCode">${code}</div>
    <p class="netstatus" id="netStatus">conectando…</p>
    <p class="netdiag" id="netDiag"></p>
    <p style="font-size:11.5px;color:#7a6d96">El código es la única llave de la sala:
       cualquiera que lo tenga puede entrar y ver la partida. No lo publiques.</p>`;
  const box=el('div','opts');
  /* El código sirve para la app instalada; el enlace queda como ruta explícita
     para navegador, sin mezclar orígenes entre producción y beta. */
  const enlace=enlaceDeSala(code);
  const app=el('button','btn gold','📱 Compartir código — tiene la app');
  app.onclick=()=>compartirCodigoSala(code);
  const sh=el('button','btn','🔗 Compartir enlace — navegador');
  sh.onclick=()=>compartirEnlace(enlace);
  const cp=el('button','btn','📋 Copiar código');
  cp.onclick=()=>{ navigator.clipboard&&navigator.clipboard.writeText(code); toast('Código copiado'); };
  const cancel=el('button','btn sm','Cancelar'); cancel.onclick=()=>{ netSend({t:'bye'}); netClose(); cerrarOv(); };
  box.appendChild(app); box.appendChild(sh); box.appendChild(cp); box.appendChild(cancel); p.appendChild(box);
  openOv();
  await netConnect(code,true);
  netStatus('esperando a tu amigo…','warn');
  NET.onjoin=(suLider)=>{ cerrarOv(); netHostStart(ONL.lider,suLider); };
  if(NET.joinPend){ const l=NET.joinPend; NET.joinPend=null; NET.onjoin(l); }
}

/* La dirección conserva la edición actual: una sala beta nunca manda al
   invitado a producción. El código no lleva URL para poder abrir una PWA. */
function enlaceDeSala(code){
  const crear=window.CAOZ_INVITACIONES?.enlace;
  return typeof crear==='function' ? crear(code,location.href,BUILD.n) : location.origin+location.pathname.replace(/[^/]*$/,'')+'?sala='+encodeURIComponent(code)+'&b='+BUILD.n;
}
function textoCodigoSala(code){
  const crear=window.CAOZ_INVITACIONES?.mensajeCodigo;
  return typeof crear==='function' ? crear(code,location.href) : `Código de sala: ${code}. Abre Con amigos → Unirme con un código.`;
}
async function compartirCodigoSala(code){
  const texto=textoCodigoSala(code);
  if(navigator.share){ try{ await navigator.share({title:'Caoz Con Todo — El Juego de Cartas',text:texto}); return; }catch(e){ if(e&&e.name==='AbortError')return; } }
  if(navigator.clipboard){ try{ await navigator.clipboard.writeText(texto);toast('Código e instrucciones copiados');return; }catch(e){} }
  toast(texto);
}
async function compartirEnlace(enlace){
  if(navigator.share){ try{ await navigator.share({title:'Caoz Con Todo — El Juego de Cartas', text:'Entra a mi sala del Domo:', url:enlace}); return; }catch(e){ if(e && e.name==='AbortError') return; } }
  if(navigator.clipboard){ try{ await navigator.clipboard.writeText(enlace); toast('Enlace copiado'); return; }catch(e){} }
  toast(enlace);
}
function onlJoinCode(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>onlJoinCode()))return;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>Unirse a una sala</h3><p>Pega el código o el enlace que te pasó tu amigo.</p>
    <input id="joinCode" class="codeinput" maxlength="300" placeholder="Código o enlace de invitación" autocomplete="off">
    <p class="netstatus" id="netStatus"></p>
    <p class="netdiag" id="netDiag"></p>`;
  const box=el('div','opts');
  const go=el('button','btn gold','Entrar →');
  go.onclick=async()=>{
    if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>go.click()))return;
    const c=codigoInvitacion($('#joinCode').value);
    if(c.length!==5){ netStatus('El código son 5 caracteres','warn'); return; }
    go.disabled=true; netStatus('conectando…','');
    await netConnect(c,false);
    netStatus('buscando la sala…','warn');
    netSend({t:'join', leader:ONL.lider, nombre:ONL.nombre});
    let intentos=0;
    const reintento=setInterval(()=>{
      if(NET.peer||!NET.on){ clearInterval(reintento); return; }
      intentos++;
      if(intentos>24){ clearInterval(reintento); netStatus('nadie responde. ¿Seguro que el código es ese y tu amigo sigue esperando?','warn'); go.disabled=false; }
      else netStatus('buscando la sala… ('+intentos+')','warn');
      netSend({t:'join', leader:ONL.lider, nombre:ONL.nombre});
    },2500);
  };
  const back=el('button','btn sm','← Volver'); back.onclick=()=>{netClose();showOnline();};
  box.appendChild(go); box.appendChild(back); p.appendChild(box);
  openOv();
  if(ONL.sala){ const i=$('#joinCode'); if(i){ i.value=ONL.sala; } ONL.sala=null; setTimeout(()=>go.click(), 120); }
  setTimeout(()=>{ const i=$('#joinCode'); if(i){ i.focus();
    i.oninput=()=>{ if(!i.value.includes('://'))i.value=i.value.toUpperCase(); }; } },80);
}


/* ==========================================================================
   15. GUÍAS DE ESTRATEGIA — cómo se pilota cada mazo
   Escritas sobre las listas reales de DECKS: las cartas y los números que
   aparecen aquí son los que hay de verdad en cada mazo.
   ========================================================================== */

function showGuides(id){
  const origen=$('.screen.on')?.id;
  if(origen!=='guide')$('#guideBack').dataset.regreso=origen==='extras'?'extras':'menu';
  GUIA_SEL = id || GUIA_SEL;
  showScreen('guide');
  const tabs=$('#guideTabs'); tabs.innerHTML='';
  Object.keys(LEADERS).forEach(k=>{
    const L=LEADERS[k];
    const t=el('button','gtab'+(k===GUIA_SEL?' on':''),`<span>${L.art}</span> ${L.n}`);
    t.onclick=()=>showGuides(k); tabs.appendChild(t);
  });
  const L=LEADERS[GUIA_SEL], D=DECKS[GUIA_SEL], g=GUIAS[GUIA_SEL];
  const c=$('#guideBody');
  const estrellas=n=>'★'.repeat(n)+'☆'.repeat(3-n);
  c.innerHTML=`
    <div class="ghead">
      <div class="gart">${L.art}</div>
      <div>
        <h2>${L.n} — “${D.n}”</h2>
        <div class="gsub">${D.d}</div>
        <div class="glema">“${g.lema}”</div>
        <div class="gmeta"><span>Dificultad <b>${estrellas(g.dif)}</b></span>
          <span>En ${GUIA_PARTIDAS} partidas de prueba ganó el <b>${GUIA_DATOS[GUIA_SEL]}%</b></span></div>
      </div>
    </div>
    <div class="gsec"><h3>🏆 Cómo ganas</h3><p>${g.ganas}</p></div>
    <div class="gsec"><h3>⚙️ Tu motor</h3><p>${g.motorTxt}</p><div class="gcards" id="gcards"></div></div>
    <div class="gsec"><h3>🕐 Plan por turnos</h3><div class="gturnos">
      ${g.turnos.map(([t,d])=>`<div class="gturno"><span class="gt">${t}</span><p>${d}</p></div>`).join('')}
    </div></div>
    <div class="gsec destacado"><h3>💥 La jugada</h3><p>${g.combo}</p></div>
    <div class="gsec"><h3>🃏 Qué guardar en la mano inicial</h3><p>${g.mano}</p></div>
    <div class="gsec"><h3>💀 Cómo pierdes</h3><ul>${g.pierdes.map(x=>`<li>${x}</li>`).join('')}</ul></div>
    <div class="gsec"><h3>⚔️ Enfrentamientos</h3><table class="gvs">
      ${Object.keys(g.vs).map(k=>`<tr><td>${LEADERS[k].art} <b>${LEADERS[k].n}</b></td>
        <td class="gv ${g.vs[k][0]==='Favorable'?'bien':g.vs[k][0]==='Difícil'?'mal':''}">${g.vs[k][0]}</td>
        <td>${g.vs[k][1]}</td></tr>`).join('')}
    </table></div>
    <div class="gsec"><h3>📋 El mazo entero</h3><p class="gplan">${D.plan}</p>
      <div class="gcards" id="gdeck"></div></div>`;
  const strip=$('#gcards');
  g.motor.forEach(id=>strip.appendChild(cardEl(id,{})));
  const deck=$('#gdeck');
  D.list.forEach(([cid,n])=>{ const d=cardEl(cid,{});
    if(n>1){ const b=el('div','gcount','×'+n); d.appendChild(b); }
    deck.appendChild(d); });
  c.scrollTop=0;
}

/* ==========================================================================
   13. ARRANQUE
   ========================================================================== */
$('#mBorrarProgreso').onclick=()=>confirmarBorradoProgreso();
$('#mExtras').onclick=()=>{showScreen('extras');$('#extrasBack').focus({preventScroll:true});};
$('#extrasBack').onclick=()=>{showScreen('menu');$('#mExtras').focus({preventScroll:true});};
$('#mTut').onclick=()=>showTutorialPick();
$('#mOnline').onclick=()=>showOnline();
$('#mCampana').onclick=abrirCampana;
$('#mPlay').onclick=()=>{ if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>$('#mPlay').click()))return; SELP=null; SELF=null; SEL_PASO='yo'; buildSelect(); showScreen('select'); };
$('#mGuides').onclick=()=>showGuides();
/* El chat: Enviar, o Intro. El formulario evita que la página se recargue. */
$('#chatform').onsubmit=e=>{ e.preventDefault(); chatMio(); };
$$('.build').forEach(e=>e.textContent=buildTxt());

/* ==========================================================================
   LA PORTADA — lo poco que no puede hacer el CSS
   Repartir las cartas y las brasas del fondo: cada una necesita su tamaño, su
   deriva, su giro y su retraso propios, y eso son números, no clases. Se
   crean UNA vez al arrancar y a partir de ahí las anima el CSS solo. Si se
   rehicieran, perderían la animación a medias — es la regla de siempre.
   ========================================================================== */

function sembrarPortada(){
  const az = (a,b) => a + Math.random()*(b-a);

  /* Las capas van por CÓDIGO y no en el HTML, y van en UN SOLO sitio: el
     fondo compartido. Con una copia por pantalla, cambiar de sección
     reiniciaba la escena entera —otras cartas, en otro sitio, desde cero— y
     el corte se veía. */
  const fondo = $('#fondoMenus');
  if(fondo && !fondo.children.length){
    ['ambiente','disco','disco dos','barajaFondo','brasas'].forEach(cls => {
      const d = el('div', cls);
      if(cls==='ambiente') d.innerHTML = '<i></i><i></i><i></i>';
      fondo.appendChild(d);
    });
  }

  $$('#fondoMenus > .barajaFondo').forEach(baraja => {
    if(baraja.children.length) return;
    /* Doce y no más: son adorno, y el móvil tiene que ir fino. Las de delante
       —grandes, nítidas, rápidas— y las del fondo —chicas, borrosas, lentas—
       se reparten a propósito para que haya profundidad de verdad. */
    const lids = Object.keys(LEADERS);
    for(let i=0; i<12; i++){
      const lejos = i % 3 !== 0;                    // dos de cada tres van al fondo
      const d = el('div','cartaFondo');
      /* Se recorren los Protagonistas en orden y se repiten: con seis Líderes y
         doce cartas, cada uno sale dos veces. Un mazo también tiene copias. */
      const lid = lids[i % lids.length];
      const naipe = cartaDeLiderVS(lid, '');      // la vertical, la del VS
      naipe.dataset.lid = lid;
      d.appendChild(naipe);
      const w = lejos ? az(70,108) : az(132,190);
      d.style.setProperty('--w', w+'px');
      d.style.setProperty('--k', (w/250).toFixed(3));
      d.style.left = az(-4, 96).toFixed(1)+'%';
      d.style.setProperty('--dx', az(-90,90).toFixed(0)+'px');
      d.style.setProperty('--gir0', az(-16,16).toFixed(1)+'deg');
      d.style.setProperty('--gir1', az(-30,30).toFixed(1)+'deg');
      d.style.setProperty('--op',  (lejos ? az(.14,.26) : az(.30,.46)).toFixed(2));
      d.style.setProperty('--dur', az(lejos?34:22, lejos?52:34).toFixed(1)+'s');
      /* El retraso es NEGATIVO a propósito: con retrasos positivos la portada
         empieza vacía y las cartas van entrando de una en una durante medio
         minuto. En negativo, cada una arranca ya empezada y la escena está
         llena desde el primer fotograma. */
      d.style.setProperty('--esp', (-az(0,46)).toFixed(1)+'s');
      if(lejos) d.style.filter = `blur(${az(1.2,2.8).toFixed(1)}px)`;
      baraja.appendChild(d);
    }
  });

  $$('#fondoMenus > .brasas').forEach(brasas => {
    if(brasas.children.length) return;
    for(let i=0; i<22; i++){
      const b = el('i','');
      b.style.setProperty('--b', az(2,5).toFixed(1)+'px');
      b.style.left = az(0,100).toFixed(1)+'%';
      b.style.setProperty('--dx',   az(-70,70).toFixed(0)+'px');
      b.style.setProperty('--alto', az(480,1000).toFixed(0)+'px');
      b.style.setProperty('--dur',  az(9,18).toFixed(1)+'s');
      b.style.setProperty('--esp',  (-az(0,18)).toFixed(1)+'s');
      brasas.appendChild(b);
    }
  });

  /* EL LOGO
     Se prueban los formatos en orden y se usa el primero que cargue; si no hay
     ninguno, se queda el nombre escrito con la misma identidad. Nunca un hueco
     ni un icono de imagen rota.
     Ojo al guardarlo: tiene que ser con FONDO TRANSPARENTE. El logo original
     viene sobre blanco, y sobre esta portada oscura eso es un rectángulo
     blanco alrededor del escudo. */
  const img = $('#marca'), txt = $('#marcaTexto');
  if(img && txt){
    const formatos = ['art/logo.webp','art/logo.png'];
    let k = 0;
    /* El logo va visible desde el primer pintado y el texto escondido: antes
       era al revés y se veía «Caoz Con Todo» escrito un instante y luego el
       escudo encima. El texto sólo sale si ningún formato carga. El hueco lo
       reserva aspect-ratio, para que nada salte cuando llega la imagen. */
    img.onload  = () => { img.hidden = false; txt.hidden = true; };
    img.onerror = () => {
      if(++k < formatos.length){ img.src = formatos[k]; return; }
      img.hidden = true; txt.hidden = false;
    };
    if(img.complete && !img.naturalWidth) img.onerror();
  }

  /* El pie decía «5 Líderes · 92 cartas · 5 mazos» a mano, y llevaba tres
     versiones mintiendo. Ahora los cuenta. */
  const pie = $('#menuFoot');
  if(pie){
    const nL = Object.keys(LEADERS).length;
    const nC = Object.keys(CARDS).filter(id=>!CARDS[id].token).length;
    pie.insertAdjacentHTML('afterbegin',
      `Colección — ${nL} Líderes · ${nC} cartas · ${nL} mazos preconstruidos<br>`);
  }
}
sembrarPortada();
/* El menú arranca con la clase `on` puesta en el HTML, sin pasar por
   showScreen(), así que el fondo hay que encenderlo a mano la primera vez. */
{ const f=$('#fondoMenus'), p0=$('.screen.on');
  if(f && p0) f.classList.toggle('on', p0.classList.contains('portada')); }
$('#guideBack').onclick=()=>showScreen($('#guideBack').dataset.regreso||'menu');
$('#mCards').onclick=()=>showGallery();
$('#mRules').onclick=()=>showRules(false);
$('#mRecords').onclick=()=>showRecords();
$('#mEstudio').onclick=()=>abrirEditor();
$('#carrAnt').onclick=()=>girarCarrete(-1);
$('#carrSig').onclick=()=>girarCarrete(1);
/* Teclado y gestos compartidos en final-core.js. */
/* Atrás va un paso, no al menú: si estás eligiendo rival, lo que quieres
   deshacer es el Protagonista, no salir de la pantalla. */
$('#selBack').onclick=()=>{
  if(SEL_PASO==='rival'){ SEL_PASO='yo'; buildSelect(); }
  else showScreen('menu');
};
$('#selGo').onclick=()=>selAceptar();
$('#selAzar').onclick=()=>{
  const ids=Object.keys(LEADERS);
  if(SEL_PASO==='yo') SELP=ids[rnd(ids.length)];
  else { const otros=ids.filter(x=>x!==SELP); SELF=otros[rnd(otros.length)]; }
  buildSelect();
  toast((SEL_PASO==='yo'?'Llevas a ':'Rival: ')+LEADERS[SEL_PASO==='yo'?SELP:SELF].n);
};
$('#tutNext').onclick=()=>tutNext();
$('#ov').onclick=e=>{ if(e.target.id==='ov') cerrarOv(); };
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ if(document.querySelector('#campanaPanel[open]'))return; if(TGT) finishTarget(null); else if(SEL){SEL=null;clearPrompt();render();}
    else cerrarOv(); }
  if(e.key===' '&&G&&!G.over&&G.active===ME&&!TGT){ e.preventDefault(); pedirTerminarTurno(); }
});

window.TCG={ get G(){return G;}, CARDS, LEADERS, DECKS, startMatch, startTutorial, autoTurn, setupMatch,
  newGame, buildDeck, P, canPlay, aiScore, playFromHand, aiPickAttack, doAttack, canAttack, endTurn, recalc,
  mkUnit, dmgU, destroy, gainKey, keys, legalTargets, costOf, useLeader, canUseLeader, whyNotLeader, startTurn, killUnit, healU, stun, infect,
  rollDice, roll,
  setIntimidante:v=>{ INTIMIDANTE_MIN=v; },
  getIntimidante:()=>INTIMIDANTE_MIN,
  play:(id)=>playFromHand(ME,id), attack:(i,t)=>doAttack(P(ME).field[i],t==='face'?'face':P(FOE).field[t]),
  end:endTurn, fast:v=>{G.fast=v;}, render };

/* ==========================================================================
   EL LIENZO — un tablero de tamaño fijo que se ajusta a la ventana
   Se dibuja siempre a la misma medida y se escala entero. La consecuencia es
   que las proporciones son idénticas en cualquier pantalla: una carta ocupa la
   misma fracción del tapete en un monitor grande que en un móvil, y lo único
   que cambia es cuánto hay que acercarse.
   Hay dos lienzos porque un móvil de pie no admite el reparto de un monitor
   apaisado; dentro de cada uno, nada depende ya del tamaño de la ventana.
   ========================================================================== */
/* UN SOLO LIENZO.
   El tablero se dibuja siempre con la misma disposición y se escala entero para
   caber. Antes había una segunda maqueta para pantallas altas y estrechas, y al
   estirar la ventana el juego saltaba a ella: el registro se ponía encima de los
   Puntos y las Llaves, y las Alcantarillas se montaban sobre el mazo. Una sola
   maqueta no puede descuadrarse: si la ventana es estrecha, el tablero se hace
   más pequeño y aparecen bandas, pero todo sigue en su sitio.
   La versión de móvil será un diseño aparte, con su propio reparto. */

/* Borde de seguridad: el tablero nunca llega al filo de la pantalla. Sin esto
   los botones de abajo y el registro quedaban pegados al canto. */

const MARGEN = 0.965;

/* Se mide con visualViewport, que es lo que de verdad se ve (en Safari la
   barra de direcciones cuenta en innerHeight pero no en lo visible). */

const altoVisible = () => (window.visualViewport ? visualViewport.height : innerHeight);

const anchoVisible = () => (window.visualViewport ? visualViewport.width  : innerWidth);

/* Un solo lienzo. La versión de teléfono es otra pantalla (movil.html):
   la mesa encogida con `zoom` que vivía aquí (v14) se retiró en la v17. */

function ajustarLienzo(){
  const W = LIENZO.ancho, H = LIENZO.alto;
  // el lienzo entero tiene que caber: manda la dimensión más apretada
  const k = Math.min(anchoVisible() / W, altoVisible() / H) * MARGEN;
  const r = document.documentElement.style;
  r.setProperty('--LW', W + 'px');
  r.setProperty('--LH', H + 'px');
  r.setProperty('--k', k);
}
addEventListener('resize', ajustarLienzo);
addEventListener('orientationchange', ajustarLienzo);
if(window.visualViewport) visualViewport.addEventListener('resize', ajustarLienzo);
ajustarLienzo();

/* Las ilustraciones, si las hay. No se espera a que lleguen para dejar jugar:
   el juego arranca con los emojis y se repinta cuando el índice está listo. */
/* Los retratos del fondo se ponen aquí y no al sembrarlo: el índice de arte se
   carga por fetch y llega DESPUÉS, así que sembrando sin más las cartas se
   quedaban con el emoji para siempre. */

function ilustrarFondo(){
  $$('#fondoMenus .cartaFondo .vscard[data-lid]').forEach(n=>ilustrarLider(n, n.dataset.lid));
}
ilustrarFondo();
cargarArte().then(()=>ilustrarFondo());

/* Las pruebas viven en tests.js y sólo se cargan con ?test=... — así el juego
   normal no paga nada por ellas y sigue siendo un archivo suelto que funciona
   en file:// sin más compañía. */
if(new URLSearchParams(location.search).has('test')){
  const s=document.createElement('script'); s.src='tests.js'; document.head.appendChild(s);
}

/* Con ?biblia=1 el juego suelta todo lo suyo —cartas, Líderes, mazos, guías y el
   texto de reglas— para que biblia.sh arme el PDF. La biblia sale de aquí y no
   de una copia a mano: si mañana cambia una carta, cambia con ella. */
/* Con ?foto=mohamed,adreida arranca una partida sin volado y con unas cuantas
   cartas ya en mesa, para poder mirar el aspecto del tablero en una captura.
   Es sólo un atajo de revisión: el juego normal no pasa por aquí. */
/* ?pantalla=menu|select|guide para retratar las pantallas de fuera de partida */
/* ?sala=CÓDIGO: se llega por el enlace de invitación. Se pide nombre y
   Protagonista y se entra solo en esa sala. El parámetro se quita de la
   dirección para que una recarga no vuelva a intentar entrar. */
{ const q=new URLSearchParams(location.search), sala=(q.get('sala')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
  if(sala.length>=4)cuentaAbrirInvitacion(sala); }
if(new URLSearchParams(location.search).has('pantalla')){
  addEventListener('load',()=>setTimeout(()=>{
    const q=new URLSearchParams(location.search), p=q.get('pantalla');
    if(p==='select'){ SELP='mohamed'; SELF='adreida'; showScreen('select'); buildSelect(); }
    else showScreen(p);
    // Reproduce el caso real: juegas un Objeto y el juego se queda esperando a
    // que elijas a quién equiparlo. Ése es el estado en que falla el clic.
    // Prueba del chat: incluye un mensaje con etiquetas dentro. Debe verse tal
    // cual, como texto, y NO convertirse en HTML.
    if(q.has('galeria')) setTimeout(()=>{ showGallery();
      const m=q.get('galeria');
      if(m && m!=='1'){                       // pulsa el filtro de ese mazo
        const b=[...document.querySelectorAll('#ovPanel .filters .btn')]
          .find(x=>x.textContent.includes(LEADERS[m] ? LEADERS[m].n : '@@'));
        if(b) b.click();
      }
    }, 700);
    if(q.has('estado')) setTimeout(()=>{    // el estado, con tiempo para transicionar
      const donde = q.has('rival') ? '#foeField .card' : '#myField .card';
      const c=$(donde); if(c) c.classList.add(q.get('estado'));
    }, 900);
    if(q.has('gastada')) setTimeout(()=>{   // una tuya que ya atacó, para retratarla
      const u=P(ME).field[0]; if(u){ u.attacked=true; recalc(); render(); }
    }, 650);
    if(q.has('chat')) setTimeout(()=>{ try{
      chatVacio(); chatVisible(true);
      chatPinta(true,'Mohamed','¿Vas a bajar al Trol o no?');
      chatRecibe({de:'Adreida', txt:'Espérate, estoy pensando 🤔'});
      chatRecibe({de:'Adreida', txt:'<img src=x onerror=alert(1)><b>negrita</b>'});
      chatPinta(true,'Mohamed','ok');
      const c=$('#chat');
      document.title='CHAT msgs='+c.querySelectorAll('.msg').length
        +' etiquetas='+c.querySelectorAll('img,b,script,i,svg').length
        +' | ultimo='+JSON.stringify((c.querySelectorAll('.msg')[2]||{}).textContent||'');
      fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({medicion:document.title})}).catch(()=>{});
    }catch(e){ document.title='CHAT ERROR: '+(e&&e.message);
      fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({medicion:document.title})}).catch(()=>{}); } }, 800);
    if(q.has('equipar')) setTimeout(()=>{
      P(ME).pd=9; P(ME).hand.push('sombrero'); render();
      playFromHand(ME,'sombrero');           // sin await: se queda pidiendo objetivo
    }, 700);
    if(q.has('medir')) setTimeout(()=>{
      const m=x=>{const e=$(x); if(!e) return x+':no';
        const r=e.getBoundingClientRect(), c=getComputedStyle(e);
        return x+' h='+Math.round(r.height)+' y='+Math.round(r.top)
             +' disp='+c.display+' jc='+c.justifyContent+' ov='+c.overflowY;};
      const linea='MED '+['#lienzo','#menu','#select','.logo'].map(m).join(' | ');
      document.title=linea;
      fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({medicion:linea})}).catch(()=>{});
    }, 900);
  },300));
}

if(new URLSearchParams(location.search).has('foto')){
  addEventListener('load',()=>setTimeout(async function fotoPreparar(){
    // Se reanuda la preparación entera: startMatch puede esperar al login
    // y todavía no existirían jugadores para colocar la mesa o la mano.
    if(!window.CAOZ_CUENTA_JUEGO?.requerir(fotoPreparar))return;
    const q=new URLSearchParams(location.search);
    const [a,b]=(q.get('foto')||'mohamed,adreida').split(',');
    await startMatch(a,b,{volado:false});
    if(q.has('mesa')){
      // unas cuantas cartas puestas a mano, que un tablero vacío no enseña nada
      const pon=(id,side)=>{const u=mkUnit(id,side); P(side).field.push(u); u.sick=false; return u;};
      for(const id of (q.get('mesa')||'').split(',').filter(Boolean)){
        const [cid,lado]=id.split(':'); pon(cid, lado==='1'?FOE:ME);
      }
      recalc(); render();
    }
    if(q.has('ver')) setTimeout(()=>{       // deja el detalle abierto en la captura
      const id=q.get('ver'); const box=$('#inspectCard');
      box.className='big t-'+(CARDS[id]?CARDS[id].t:'personaje');
      box.innerHTML=inspectHTML(id,null);
      window.marcarNombreCarta(box.querySelector('.nm'),id,CARDS[id].n);
      const b2=$('#inspect'); b2.classList.add('on');
      b2.style.left='1120px'; b2.style.top='120px';
    }, 1400);
    if(q.has('mano')){            // cartas concretas en la mano, para retratarlas
      P(ME).hand.length=0;
      (q.get('mano')||'').split(',').filter(Boolean).forEach(id=>P(ME).hand.push(id));
      render();
    }
    if(q.has('hover')) setTimeout(()=>{
      // La mano conserva la zona activa en `.handSlot`; para las capturas la
      // clase visual sigue perteneciendo a la carta interna, igual que con el
      // cursor real. No se debe escalar la ranura ni reabrir el viejo hitbox.
      const ranura=$('#hand').children[+q.get('hover')||0];
      const c=ranura?.querySelector('.card');
      if(c) c.classList.add('finge-hover');
    }, 1500);
    // Reproduce el caso real: juegas un Objeto y el juego se queda esperando a
    // que elijas a quién equiparlo. Ése es el estado en que falla el clic.
    // Prueba del chat: incluye un mensaje con etiquetas dentro. Debe verse tal
    // cual, como texto, y NO convertirse en HTML.
    if(q.has('galeria')) setTimeout(()=>{ showGallery();
      const m=q.get('galeria');
      if(m && m!=='1'){                       // pulsa el filtro de ese mazo
        const b=[...document.querySelectorAll('#ovPanel .filters .btn')]
          .find(x=>x.textContent.includes(LEADERS[m] ? LEADERS[m].n : '@@'));
        if(b) b.click();
      }
    }, 700);
    if(q.has('estado')) setTimeout(()=>{    // el estado, con tiempo para transicionar
      const donde = q.has('rival') ? '#foeField .card' : '#myField .card';
      const c=$(donde); if(c) c.classList.add(q.get('estado'));
    }, 900);
    if(q.has('gastada')) setTimeout(()=>{   // una tuya que ya atacó, para retratarla
      const u=P(ME).field[0]; if(u){ u.attacked=true; recalc(); render(); }
    }, 650);
    if(q.has('chat')) setTimeout(()=>{ try{
      chatVacio(); chatVisible(true);
      chatPinta(true,'Mohamed','¿Vas a bajar al Trol o no?');
      chatRecibe({de:'Adreida', txt:'Espérate, estoy pensando 🤔'});
      chatRecibe({de:'Adreida', txt:'<img src=x onerror=alert(1)><b>negrita</b>'});
      chatPinta(true,'Mohamed','ok');
      const c=$('#chat');
      document.title='CHAT msgs='+c.querySelectorAll('.msg').length
        +' etiquetas='+c.querySelectorAll('img,b,script,i,svg').length
        +' | ultimo='+JSON.stringify((c.querySelectorAll('.msg')[2]||{}).textContent||'');
      fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({medicion:document.title})}).catch(()=>{});
    }catch(e){ document.title='CHAT ERROR: '+(e&&e.message);
      fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({medicion:document.title})}).catch(()=>{}); } }, 800);
    if(q.has('equipar')) setTimeout(()=>{
      P(ME).pd=9; P(ME).hand.push('sombrero'); render();
      playFromHand(ME,'sombrero');           // sin await: se queda pidiendo objetivo
    }, 700);
    if(q.has('medir')) setTimeout(()=>{
      const m=(sel)=>{const e=$(sel); if(!e) return sel+':no';
        const r=e.getBoundingClientRect();
        return sel+' w='+Math.round(r.width)+' h='+Math.round(r.height);};
      // ¿Quién recibe el clic sobre una carta del campo? Si la parte de abajo
      // no responde, es que algo la tapa; esto dice exactamente qué.
      // Rejilla completa sobre una carta del campo: en cada punto, qué elemento
      // recibiría el clic. Es la única forma de ver DÓNDE deja de responder.
      let zonas='';
      const carta = $('#myField .card');
      let mapa = 'sin carta';
      // se prueba en los tres estados en que uno pulsa una carta del campo
      const estado = new URLSearchParams(location.search).get('estado')||'';
      if(carta){
        const r = carta.getBoundingClientRect();
        const filas = [];
        for(let fy=0.04; fy<=0.97; fy+=0.13){
          let linea = '';
          for(let fx=0.05; fx<=0.96; fx+=0.11){
            const e = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);
            linea += (e && (e===carta || carta.contains(e))) ? 'O' : '.';
          }
          filas.push(linea);
        }
        // y qué hay en los puntos que NO responden
        const fallos = {};
        for(let fy=0.04; fy<=0.97; fy+=0.13)
          for(let fx=0.05; fx<=0.96; fx+=0.11){
            const e = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);
            if(!(e && (e===carta || carta.contains(e)))){
              const k = e ? (e.id||e.className||e.tagName).toString().slice(0,22) : 'nada';
              fallos[k] = (fallos[k]||0)+1;
            }
          }
        mapa = 'estado='+(estado||'reposo')+' '+Math.round(r.width)+'x'+Math.round(r.height)
             +' [' + filas.join('/') + ']'
             + ' fallan: ' + (Object.keys(fallos).length? JSON.stringify(fallos) : 'ninguno');
      }
      // Zonas reales de una carta ilustrada, en % de su alto: para la plantilla
      {
        const ci=$('#foeField .card.conarte') || $('#myField .card.conarte');
        if(ci){
          const R=ci.getBoundingClientRect();
          const pct=e=>{const r=e.getBoundingClientRect();
            return Math.round((r.top-R.top)/R.height*1000)/10+'..'
                 + Math.round((r.bottom-R.top)/R.height*1000)/10;};
          const q=sel=>{const e=ci.querySelector(sel); return e? sel+' '+pct(e) : sel+' -';};
          zonas = 'CARTA '+Math.round(R.width)+'x'+Math.round(R.height)+' | '
                + [q('.cost'),q('.nm'),q('.pieCarta'),q('.tribe'),q('.stats')].join(' | ');
        } else zonas='sin carta ilustrada';
      }
      // ¿quién recorta el cajón? Se recorre hacia arriba buscando overflow
      let cadena='';
      {
        const cf=$('#foeField .card'), k=cf&&cf.querySelector('.cajon');
        if(k){
          const rk=k.getBoundingClientRect();
          cadena='cajonRival y='+Math.round(rk.top)+'..'+Math.round(rk.bottom)+' :: ';
          let e=k.parentElement, n=0;
          while(e && n++<9){
            const cs=getComputedStyle(e), r=e.getBoundingClientRect();
            if(cs.overflow!=='visible'||cs.overflowY!=='visible')
              cadena+=(e.id||e.className||e.tagName).toString().slice(0,14)
                    +'['+cs.overflowY+' y'+Math.round(r.top)+'..'+Math.round(r.bottom)+'] ';
            e=e.parentElement;
          }
        } else cadena='sin carta rival';
      }
      // ¿existe el cajón y por qué no se ve?
      let caj='sin carta';
      if(carta){
        const k=carta.querySelector('.cajon');
        if(!k) caj='NO EXISTE el .cajon en el DOM';
        else{
          const cs=getComputedStyle(k), r=k.getBoundingClientRect();
          caj='cajon '+Math.round(r.width)+'x'+Math.round(r.height)
             +' op='+cs.opacity+' vis='+cs.visibility+' disp='+cs.display
             +' z='+cs.zIndex+' y='+Math.round(r.top)
             +' | clases de la carta: '+carta.className;
        }
      }
      const quien = zonas + ' || ' + cadena;
      // ¿se sale algo del lienzo? Es la pregunta de verdad, y la contesta la
      // página en vez de mirar una captura a ojo
      const L=$('#lienzo').getBoundingClientRect();
      const fuera=[];
      document.querySelectorAll('#lienzo *').forEach(e=>{
        const r=e.getBoundingClientRect();
        if(r.width<2||r.height<2) return;
        const dx=Math.max(0, Math.round(L.left-r.left), Math.round(r.right-L.right));
        const dy=Math.max(0, Math.round(L.top-r.top), Math.round(r.bottom-L.bottom));
        if(dx>2||dy>2) fuera.push((e.id||e.className||e.tagName)+':'+dx+'x'+dy);
      });
      const linea = 'MED '+['#lienzo','#board','#mesa','#panel','#log','#field','#rail','#railder','#mat']
        .map(m).join(' | ')+' || win='+innerWidth+'x'+innerHeight
        +' k='+getComputedStyle(document.documentElement).getPropertyValue('--k')
        +' || QUIEN RECIBE EL CLIC: '+quien
        +' || SE SALEN: '+(fuera.length?fuera.slice(0,6).join(' , '):'nada');
      document.title = linea;
      fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({medicion:linea})}).catch(()=>{});
    }, 3200);
    document.body.classList.add('foto-lista');
  },600));
}

if(new URLSearchParams(location.search).has('biblia')){
  addEventListener('load',()=>setTimeout(()=>{
    const d={
      reglas: RULES_HTML,
      lideres: Object.fromEntries(Object.keys(LEADERS).map(k=>{ const L=LEADERS[k];
        return [k,{n:L.n,ep:L.ep,art:L.art,arch:L.arch,pasiva:L.pasiva,hab:L.hab,
                   habCost:L.habCost,habName:L.habName,hab2:L.hab2||null,lore:L.lore}]; })),
      cartas: Object.fromEntries(Object.keys(CARDS).map(id=>{ const c=CARDS[id];
        return [id,{n:c.n,t:c.t,c:c.c,a:c.a??null,h:c.h??null,tr:c.tr||[],r:c.r||0,
                    sub:c.sub||[],x:c.x||'',keys:c.keys||[],token:!!c.token,
                    fast:!!c.fast,relic:!!c.relic}]; })),
      mazos: Object.fromEntries(Object.keys(DECKS).map(k=>{ const D=DECKS[k];
        return [k,{n:D.n,d:D.d,plan:D.plan,list:D.list}]; })),
      guias: Object.fromEntries(Object.keys(GUIAS).map(k=>{ const g=GUIAS[k];
        return [k,{dif:g.dif,lema:g.lema,ganas:g.ganas,motorTxt:g.motorTxt,
                   combo:g.combo,mano:g.mano,pierdes:g.pierdes,turnos:g.turnos||[]}]; })),
      colores: Object.fromEntries(['personaje','hechizo','trampa','objeto','lugar'].map(t=>
        [t, getComputedStyle(document.documentElement).getPropertyValue('--c-'+t).trim()]))
    };
    fetch('/resultado',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(d)}).catch(()=>{});
  },400));
}

/* LA APP. El service worker (sw.js) guarda el juego para abrir sin red y
   desde la pantalla de inicio. Sólo en https y fuera de las pruebas, que
   necesitan leer siempre lo último del servidor. */
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')
   && !new URLSearchParams(location.search).has('test') && !new URLSearchParams(location.search).has('estudioVista')){
  addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js?b=302&test=arranque').catch(()=>{}); });
}
/* El menú ya existe desde el HTML para que la cuenta, las invitaciones y la
   campaña puedan inicializarse normalmente. Sólo se ocultó su presentación
   hasta que `load` dejó instalado el acabado visual completo. */
(function(){
  const html=document.documentElement;
  if(!html.classList.contains('arrancando'))return;
  const terminar=()=>{
    if(!html.classList.contains('arrancando'))return;
    const portada=document.getElementById('arranqueCaoz'),menu=document.getElementById('menu');
    const reducir=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(reducir){html.classList.remove('arrancando');portada?.remove();return;}
    /* El logo se apaga contra su propio fondo. Sólo entonces se revela la
       portada: así nunca se cruzan dos logos durante el fundido. */
    html.classList.add('arranqueCaozSaliendo');
    setTimeout(()=>{
      menu?.classList.add('entra');portada?.remove();
      html.classList.remove('arrancando','arranqueCaozSaliendo');
      setTimeout(()=>menu?.classList.remove('entra'),700);
    },420);
  };
  window.cerrarArranqueCaoz=terminar;
  addEventListener('load',()=>{
    // La cortinilla nueva decide el momento de revelar el menú. Si no está
    // disponible, el fundido ligero de siempre conserva el arranque seguro.
    if(window.CAOZ_CORTINILLA_JUEGO)return;
    const inicio=Number(window.CAOZ_ARRANQUE_INICIO)||Date.now();
    const espera=Math.max(0,520-(Date.now()-inicio));
    setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(terminar)),espera);
  },{once:true});
})();

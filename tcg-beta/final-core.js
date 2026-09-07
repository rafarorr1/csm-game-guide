/* ==========================================================================
   CAOZ CON TODO — TCG · LA CINEMÁTICA DEL FINAL
   Lo que pasa entre el último punto de daño y el cartel con los números:
   la mesa se apaga, el Líder que pierde se hunde en gris y se agrieta, el
   que gana sube al centro con su luz, y cae el sello —VICTORIA en oro,
   DERROTA en brasa y ceniza— con su fogonazo. Cuatro segundos, o un toque.

   Es una pieza de pantalla, no del motor, pero la comparten las dos
   pantallas (index.html y movil.html): se dibuja con vh/vw y sólo pide de
   fuera lo que las dos tienen con el mismo nombre —el(), nap(), FXON(),
   cartaDeLiderVS()— y del motor G, P, ME y LEADERS. Trae su propio CSS.
   La llama showEnd() antes de abrir el cartel; con G.fast, G.silent, en
   partidas automáticas o con la pestaña escondida no hace nada.
   ========================================================================== */
'use strict';

const FIN_CSS = `
.fin{position:fixed;inset:0;z-index:390;display:grid;place-items:center;overflow:hidden;cursor:pointer;
  background:rgba(6,4,10,0);transition:background .9s}
.fin.va{background:rgba(6,4,10,.9)}
.fin.sale{opacity:0;transition:opacity .5s}
body.fin-on #app{filter:saturate(.35) brightness(.55);transition:filter 1s}
/* los rayos de luz detrás del ganador: giran en \`rotate\`, que nadie más usa */
.fin .finluz{position:absolute;left:50%;top:50%;width:170vmax;height:170vmax;translate:-50% -50%;opacity:0;
  background:repeating-conic-gradient(from 0deg, rgba(255,215,120,.15) 0 5deg, transparent 5deg 13deg);
  -webkit-mask:radial-gradient(circle, #000 0%, transparent 58%);mask:radial-gradient(circle, #000 0%, transparent 58%);
  animation:finGira 28s linear infinite;transition:opacity 1.4s}
.fin.luz .finluz{opacity:1}
.fin.derrota .finluz{background:repeating-conic-gradient(from 0deg, rgba(224,60,50,.11) 0 5deg, transparent 5deg 13deg)}
@keyframes finGira{to{rotate:360deg}}
/* las dos cartas de Líder */
.fin .vscard{position:absolute;left:50%;top:50%;width:min(230px,46vw,34vh);border:2px solid var(--gold2,#8d6f21);border-radius:16px;
  overflow:hidden;background:linear-gradient(178deg,#2c2143,#140e22);box-shadow:0 30px 70px rgba(0,0,0,.85);
  display:flex;flex-direction:column;transition:transform 1.1s cubic-bezier(.16,.84,.3,1.06), filter 1.1s, opacity .8s, box-shadow 1.1s}
.fin .vscard .lface{position:relative;height:auto;aspect-ratio:1/1;display:grid;place-items:center;font-size:min(82px,18vw);line-height:1;overflow:hidden;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,.85));
  background:radial-gradient(ellipse 100% 80% at 50% 26%, rgba(138,92,240,.34), transparent 70%),linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.38))}
.fin .vscard .lface::after{content:"";position:absolute;inset:auto 0 0 0;height:42%;background:linear-gradient(180deg,transparent,#140e22 94%)}
.fin .vscard .lname{position:relative;inset:auto;z-index:2;text-align:center;margin-top:-16px;padding:0 10px 3px;background:none;border:none;
  font:700 min(21px,5vw)/1.1 var(--serif,serif);font-variant:small-caps;color:#fdf6e6;text-shadow:0 2px 8px #000}
.fin .vscard .larch{text-align:center;padding:0 10px 12px;font:700 9px/1.3 var(--sans,sans-serif);letter-spacing:1px;
  text-transform:uppercase;color:var(--purple,#8a5cf0)}
.fin .vscard.gana{transform:translate(-50%,-50%) translateY(38vh) scale(.6);opacity:0;z-index:3}
.fin.entra .vscard.gana{transform:translate(-50%,-50%) translateY(-25vh) scale(1);opacity:1;
  border-color:var(--gold,#e6bb52);box-shadow:0 0 0 2px rgba(230,187,82,.5),0 0 70px rgba(230,187,82,.55),0 40px 80px #000}
.fin.derrota.entra .vscard.gana{border-color:#b83a30;box-shadow:0 0 0 2px rgba(224,82,74,.45),0 0 70px rgba(224,82,74,.5),0 40px 80px #000}
.fin .vscard.pierde{transform:translate(-50%,-50%) translateY(-4vh) scale(.92);opacity:0;z-index:2}
.fin.entra .vscard.pierde{transform:translate(-50%,-50%) translateY(26vh) translateX(34vw) scale(.5) rotate(10deg);opacity:.55;
  filter:grayscale(1) brightness(.45)}
/* la grieta: unas líneas blancas que se encienden cuando la carta ya se ha hundido */
.fin .vscard.pierde::after{content:"";position:absolute;inset:0;z-index:5;opacity:0;transition:opacity .5s .7s;pointer-events:none;
  background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140' preserveAspectRatio='none'><g fill='none' stroke='rgba(255,255,255,.75)' stroke-width='.9'><polyline points='52,0 47,22 55,38 44,58 53,74 41,96 50,118 46,140'/><polyline points='47,22 30,30 18,26'/><polyline points='44,58 62,66 74,60'/><polyline points='41,96 26,104 20,120'/><polyline points='53,74 70,88'/></g></svg>") center/100% 100% no-repeat}
.fin.entra .vscard.pierde::after{opacity:1}
/* el sello */
/* Sólo gira la palabra: el giro del bloque entero arrastraba el motivo y la
   línea de turnos y Alma, y se veían descentrados. */
.fin .sello{position:relative;z-index:6;text-align:center;opacity:0;translate:0 13vh;transform:scale(3);width:100%;padding:0 12px;
  transition:opacity .2s, transform .4s cubic-bezier(.2,1.5,.4,1)}
.fin.sello-on .sello{opacity:1;transform:scale(1)}
.fin .sello b{display:block;font:900 clamp(46px,13vw,104px)/1 var(--serif,serif);letter-spacing:6px;transform:rotate(-3deg);
  background-image:linear-gradient(180deg,#fff3c4 0%,#e6bb52 46%,#8d6f21 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 5px 0 #3a2a08) drop-shadow(0 0 28px rgba(230,187,82,.75))}
.fin.derrota .sello b{background-image:linear-gradient(180deg,#ffd9d6 0%,#e0524a 46%,#4a1010 100%);
  filter:drop-shadow(0 5px 0 #2a0806) drop-shadow(0 0 28px rgba(224,82,74,.7))}
.fin .sello small{display:block;margin:16px auto 0;max-width:min(520px,86vw);opacity:0;transition:opacity .5s .25s;
  font:600 clamp(12.5px,3.4vw,16px)/1.5 var(--sans,sans-serif);letter-spacing:.6px;color:#efe6fb;text-shadow:0 2px 8px #000}
.fin .sello i{display:block;font-style:normal;margin-top:9px;opacity:0;transition:opacity .5s .45s;
  font:700 clamp(11px,2.8vw,13px)/1.4 var(--sans,sans-serif);letter-spacing:2.5px;color:var(--dim,#a294bd)}
.fin.sello-on .sello small,.fin.sello-on .sello i{opacity:1}
.fin .sello i.racha{color:var(--gold,#e6bb52);letter-spacing:1px;font-size:clamp(11.5px,3vw,14px);margin-top:6px}
.fin.derrota .sello i.racha{color:#c9a6ff}
.records .rtot{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:4px 0 12px;font-size:13px;color:var(--dim,#a294bd)}
.records .rtot b{color:var(--gold,#e6bb52);font-size:20px;font-family:var(--serif,serif)}
.records table{width:100%;border-collapse:collapse;font-size:12.5px}
.records th{font:600 9.5px/1 var(--sans,sans-serif);letter-spacing:1.5px;text-transform:uppercase;color:#7a6ba0;padding:4px 6px;text-align:left}
.records td{padding:6px;border-top:1px solid rgba(255,255,255,.07);white-space:nowrap}
.records td b{color:#fdf6e6}
.records td i{font-style:normal;color:var(--green,#4fc07d);font-size:11px}
.records tr.sin td{opacity:.45}
.records .rnota{font-size:11.5px;color:#7a6d96;margin-top:10px;text-align:center}
/* el fogonazo del impacto */
.fin .fogonazo{position:absolute;left:50%;top:50%;width:80vmax;height:80vmax;translate:-50% -50%;border-radius:50%;opacity:0;
  mix-blend-mode:screen;pointer-events:none;
  background:radial-gradient(circle,rgba(255,236,190,.95) 0%,rgba(255,150,60,.5) 24%,transparent 60%)}
.fin.derrota .fogonazo{background:radial-gradient(circle,rgba(255,205,195,.9) 0%,rgba(224,60,50,.5) 24%,transparent 60%)}
.fin.sello-on .fogonazo{animation:finFogonazo 1.4s ease-out forwards}
@keyframes finFogonazo{0%{opacity:0;scale:.2}8%{opacity:1;scale:1}100%{opacity:0;scale:1.7}}
/* brasas que suben con la victoria; ceniza que cae con la derrota */
.fin .brasa{position:absolute;bottom:-10px;left:var(--x);width:var(--s);height:var(--s);border-radius:50%;opacity:0;pointer-events:none;
  background:radial-gradient(circle,#ffd9a0,#ff7a18 55%,transparent 72%);
  animation:finSube var(--dur) linear var(--del) infinite}
.fin.derrota .brasa{bottom:auto;top:-10px;background:radial-gradient(circle,#e8e0d8,#6f6660 55%,transparent 72%);animation-name:finCae}
@keyframes finSube{0%{translate:0 0;opacity:0}10%{opacity:.95}100%{translate:var(--dx) -108vh;opacity:0}}
@keyframes finCae{0%{translate:0 0;opacity:0}10%{opacity:.7}100%{translate:var(--dx) 108vh;opacity:0}}
.fin .toca{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);left:0;right:0;text-align:center;
  font:600 11px/1 var(--sans,sans-serif);letter-spacing:3px;color:#7a6ba0;opacity:0;transition:opacity .6s .4s}
.fin.va .toca{opacity:1}
.fin.botones .toca{opacity:0;transition:none}
/* revancha o menú, aquí mismo: la cinemática no se va hasta que se elige */
.fin .finbtns{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 7vh);z-index:8;
  display:flex;gap:12px;justify-content:center;flex-wrap:wrap;padding:0 16px;
  opacity:0;translate:0 16px;pointer-events:none;transition:opacity .5s, translate .5s}
.fin.botones .finbtns{opacity:1;translate:0 0;pointer-events:auto}
.fin .finbtns .btn{font-size:16px;padding:13px 24px;min-width:150px;text-align:center}
.fin.botones{cursor:default}
@media (prefers-reduced-motion: reduce){ .fin .finluz, .fin .brasa{animation:none} }
`;

/* ==========================================================================
   RÉCORDS LOCALES
   Cuántas partidas se han jugado y ganado con cada Protagonista, la racha, y
   la victoria más rápida. Viven en el navegador (localStorage): sin cuentas,
   sin red. Los anota showEnd() en las dos pantallas, salvo tutorial y
   partidas automáticas o rápidas (las del arnés).
   ========================================================================== */
const RECORDS_CLAVE = 'caoz_records_v1';
let RECORD_ULTIMO = null;          // lo que acaba de pasar, para la cinemática

function leerRecords(){
  try{ const r = JSON.parse(localStorage.getItem(RECORDS_CLAVE)); if(r && r.lideres) return r; }catch(e){}
  return {lideres:{}, total:{jugadas:0, ganadas:0}, online:{jugadas:0, ganadas:0}};
}
function guardarRecords(r){ try{ localStorage.setItem(RECORDS_CLAVE, JSON.stringify(r)); }catch(e){} }
function borrarRecords(){ try{ localStorage.removeItem(RECORDS_CLAVE); }catch(e){} }

function anotarRecord(gane, lid, turnos, modo){
  const r = leerRecords();
  const L = r.lideres[lid] || (r.lideres[lid] = {jugadas:0, ganadas:0, racha:0, mejorRacha:0, rapida:null});
  const rachaAntes = L.racha;
  L.jugadas++; r.total.jugadas++;
  if(modo === 'online'){ r.online.jugadas++; if(gane) r.online.ganadas++; }
  let nuevaRapida = false;
  if(gane){
    L.ganadas++; r.total.ganadas++; L.racha++;
    if(L.racha > L.mejorRacha) L.mejorRacha = L.racha;
    if(L.rapida == null || turnos < L.rapida){ nuevaRapida = L.rapida != null; L.rapida = turnos; }
  } else L.racha = 0;
  L.ultima = new Date().toISOString().slice(0,10);
  guardarRecords(r);
  RECORD_ULTIMO = {gane, lid, racha:L.racha, mejorRacha:L.mejorRacha, rachaAntes, nuevaRapida, turnos};
  return RECORD_ULTIMO;
}

/* la línea que la cinemática pone bajo el marcador */
function fraseDeRecord(){
  const u = RECORD_ULTIMO; if(!u || !LEADERS[u.lid]) return '';
  const n = LEADERS[u.lid].n;
  if(u.gane){
    let t = u.racha >= 2 ? `Racha de ${u.racha} con ${n}` : `Primera de una racha con ${n}`;
    if(u.racha >= 2 && u.racha === u.mejorRacha && u.racha > 1) t += ' · ¡tu mejor racha!';
    if(u.nuevaRapida) t += ` · ¡tu victoria más rápida: ${u.turnos} turnos!`;
    return t;
  }
  return u.rachaAntes >= 2 ? `Se corta una racha de ${u.rachaAntes} con ${n}` : '';
}

/* el cuadro de récords, para el panel de cualquiera de las dos pantallas */
function recordsHTML(){
  const r = leerRecords();
  const ids = Object.keys(LEADERS);
  const pct = (g, j) => j ? Math.round(100*g/j) + ' %' : '—';
  const filas = ids.map(id => { const L = r.lideres[id] || {jugadas:0, ganadas:0, racha:0, mejorRacha:0, rapida:null};
    return `<tr class="${L.jugadas?'':'sin'}"><td>${LEADERS[id].art} <b>${LEADERS[id].n}</b></td>
      <td>${L.jugadas}</td><td>${L.ganadas}</td><td>${pct(L.ganadas, L.jugadas)}</td>
      <td>${L.mejorRacha || '—'}${L.racha >= 2 ? ` <i>(${L.racha} ahora)</i>` : ''}</td><td>${L.rapida != null ? L.rapida + ' t.' : '—'}</td></tr>`; }).join('');
  return `<div class="records">
    <div class="rtot"><span><b>${r.total.jugadas}</b> partidas</span><span><b>${r.total.ganadas}</b> ganadas</span>
      <span><b>${pct(r.total.ganadas, r.total.jugadas)}</b> victorias</span>
      ${r.online.jugadas ? `<span>online <b>${r.online.ganadas}/${r.online.jugadas}</b></span>` : ''}</div>
    <table><thead><tr><th>Protagonista</th><th>Jug.</th><th>Gan.</th><th>%</th><th>Racha</th><th>Más rápida</th></tr></thead>
      <tbody>${filas}</tbody></table>
    <p class="rnota">Se guardan en este navegador (o en la app instalada). No cuentan el tutorial.</p>
  </div>`;
}

if(!document.getElementById('finCss')){
  const st = document.createElement('style');
  st.id = 'finCss'; st.textContent = FIN_CSS;
  document.head.appendChild(st);
}

/* La retira desde fuera (llega una pregunta que tiene que verse encima, como
   la revancha del rival). El vigía de dentro nota que ya no está y suelta. */
function cerrarCinematica(){
  const c = document.querySelector('.fin');
  if(c){ c.remove(); document.body.classList.remove('fin-on'); }
}

/* Devuelve cuando la cinemática ha terminado (o se ha saltado). Quien la
   llama abre el cartel después, comprobando que la partida sigue siendo la
   misma: durante estos cuatro segundos puede empezar otra. */
async function cinematicaFinal(winner, why, acciones){
  if(typeof FXON !== 'function' || !FXON() || G.auto) return false;
  const g0 = G, gano = winner === ME;
  const capa = el('div', 'fin ' + (gano ? 'victoria' : 'derrota'));
  capa.innerHTML = '<div class="finluz"></div><div class="fogonazo"></div>';
  for(let i = 0; i < 26; i++){
    const b = el('div', 'brasa');
    b.style.setProperty('--x', (Math.random() * 100) + '%');
    b.style.setProperty('--dx', (Math.random() * 90 - 45) + 'px');
    b.style.setProperty('--s', (3 + Math.random() * 4) + 'px');
    b.style.setProperty('--dur', (4.5 + Math.random() * 5) + 's');
    b.style.setProperty('--del', (-Math.random() * 9) + 's');
    capa.appendChild(b);
  }
  const pierde = cartaDeLiderVS(P(1 - winner).leaderId, 'pierde');
  const gana   = cartaDeLiderVS(P(winner).leaderId, 'gana');
  capa.appendChild(pierde); capa.appendChild(gana);
  const alma = s => Math.max(0, P(s).alma);
  capa.appendChild(el('div', 'sello',
    `<b>${gano ? 'VICTORIA' : 'DERROTA'}</b><small>${why || ''}</small>` +
    `<i>Turnos: ${Math.ceil(G.turnNo / 2)} &nbsp;·&nbsp; ${P(winner).L.n} ❤️ ${alma(winner)} &nbsp;·&nbsp; ${P(1 - winner).L.n} ❤️ ${alma(1 - winner)}</i>`));
  { const fr = fraseDeRecord(); if(fr) capa.querySelector('.sello').appendChild(el('i', 'racha', fr)); }
  capa.appendChild(el('div', 'toca', 'TOCA PARA SALTAR'));

  /* Los botones viven aquí, no en un cartel aparte: la cinemática se queda
     hasta que se elige. Antes se iba sola y devolvía a la mesa un instante,
     y luego salía el cartel de siempre: dos pantallas para una decisión. */
  let elegido = null, elige;
  const eleccion = new Promise(r => { elige = r; });
  const btns = el('div', 'finbtns');
  const cerrar = async (que) => {
    if(elegido) return; elegido = que;
    capa.classList.add('sale'); document.body.classList.remove('fin-on');
    await nap(380); capa.remove(); elige(que);
  };
  const bRev = el('button', 'btn gold', '↺ Revancha');
  const bMenu = el('button', 'btn', '← Menú principal');
  bRev.onclick = e => { e.stopPropagation(); cerrar('revancha').then(() => acciones && acciones.revancha && acciones.revancha()); };
  bMenu.onclick = e => { e.stopPropagation(); cerrar('menu').then(() => acciones && acciones.menu && acciones.menu()); };
  btns.appendChild(bRev); btns.appendChild(bMenu);
  capa.appendChild(btns);

  // un toque salta la animación y trae los botones ya
  let saltado = false, salta;
  const saltar = new Promise(r => { salta = r; });
  capa.onclick = () => { saltado = true; salta(); };
  document.body.appendChild(capa);
  document.body.classList.add('fin-on');
  const vive = () => G === g0 && document.body.contains(capa);
  // sigue mientras la partida sea ésta y nadie haya tocado
  const espera = async ms => { await Promise.race([nap(ms), saltar]); return !saltado && vive(); };

  await nap(30);
  capa.classList.add('va', 'luz');
  if(await espera(520)) capa.classList.add('entra');
  if(await espera(1050)){
    capa.classList.add('sello-on');
    if(typeof vibra === 'function') vibra(gano ? [30, 50, 30] : [90]);
    const app = document.getElementById('app');
    if(app && !gano) app.animate([{translate:'0 0'},{translate:'-7px 4px'},{translate:'7px -4px'},{translate:'-4px 2px'},{translate:'0 0'}],{duration:340});
    if(app && gano) app.animate([{filter:'saturate(.35) brightness(.55)'},{filter:'saturate(.6) brightness(1.4)',offset:.12},{filter:'saturate(.35) brightness(.55)'}],{duration:900});
  }
  await espera(1500);
  if(!vive()){ capa.remove(); document.body.classList.remove('fin-on'); return true; }   // empezó otra partida: ya no pinta nada
  capa.classList.add('va', 'luz', 'entra', 'sello-on', 'botones');   // por si se saltó a medias
  capa.onclick = null;
  // y se espera a la decisión; si mientras tanto empieza otra partida, se retira
  const vigia = setInterval(() => { if(!vive()){ clearInterval(vigia); capa.remove(); document.body.classList.remove('fin-on'); elige(null); } }, 400);
  await eleccion;
  clearInterval(vigia);
  return true;
}

/* Volado compartido: la elección y el resultado usan exactamente la misma moneda.
   Sólo rnd decide el turno; la animación nunca altera el resultado. */
async function voladoDomo(nombreRival){
  if(!document.getElementById('voladoDomoCss')){
    const estilo=document.createElement('style');estilo.id='voladoDomoCss';
    estilo.textContent=`
#ovPanel:has(.volado-domo){width:min(540px,calc(100vw - 28px));max-width:540px;padding:0;overflow:auto;border:1px solid #9e80504d;border-radius:22px;background:#100d18;box-shadow:0 32px 100px #000c,0 0 70px #9d6b2015}
.volado-domo{position:relative;isolation:isolate;text-align:center;padding:30px 28px 24px;color:#f4e5c5;background:radial-gradient(ellipse at 50% 38%,#48304466,transparent 61%),linear-gradient(150deg,#21192a,#100d18 70%);overflow:hidden}
.volado-domo::before{content:'';position:absolute;inset:9px;border:1px solid #b99b5526;border-radius:15px;pointer-events:none;z-index:-1}
.volado-domo .vd-kicker{font:600 10px/1.4 var(--sans,sans-serif);letter-spacing:.32em;text-transform:uppercase;color:#b79b68}
.volado-domo h3{font:500 clamp(28px,6vw,38px)/1.2 var(--serif,serif);letter-spacing:.025em;margin:9px 0;color:#f6e7c6}
.volado-domo .vd-intro{font:13px/1.5 var(--sans,sans-serif);color:#b9afc4;margin:0;max-width:330px;margin-inline:auto}
.volado-domo .volado{padding:0;gap:0}
.vd-stage{position:relative;display:grid;place-items:center;width:100%;height:238px;margin:4px 0 0;isolation:isolate}
.vd-stage::before{content:'';position:absolute;width:204px;height:204px;border:1px solid #c9a75b24;border-radius:50%;box-shadow:0 0 0 20px #c9a75b08,0 0 0 21px #c9a75b14;z-index:-1}
.vd-stage::after{content:'';position:absolute;bottom:20px;width:100px;height:12px;border-radius:50%;background:#0008;filter:blur(7px);z-index:-1}
.volado-domo #moneda{position:relative;display:grid;place-items:center;width:144px;height:144px;border-radius:50%;font-size:0;color:#51341a;border:3px solid #e7c67a;background:radial-gradient(circle at 35% 22%,#fff0b3 0%,#d4a955 31%,#b68435 58%,#edce83 79%,#a77428 100%);box-shadow:inset 0 0 0 4px #674319,inset 0 0 0 6px #f5d78b,inset 0 0 0 10px #9a6b2e88,0 6px 0 #64401d,0 9px 0 #342215,0 18px 30px #0009;animation:vd-flotar 4s ease-in-out infinite}
.volado-domo #moneda::before{content:'';position:absolute;inset:14px;border:1px dashed #65441d9c;border-radius:50%;pointer-events:none}
.vd-icon{width:64px;height:64px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 0 #fff0b088)}
.vd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.volado-domo #moneda.girando{animation:vd-lanzar 1.5s cubic-bezier(.3,.05,.2,1) both}
.volado-domo .lados{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:360px}
.volado-domo .lados .btn{display:flex;align-items:center;justify-content:center;gap:12px;min-height:67px;padding:12px 18px;border:1px solid #b69a6555;border-radius:12px;background:linear-gradient(#342a3d,#211a2b);color:#e6d4af;box-shadow:inset 0 1px 0 #ffffff09;transition:background .18s,border-color .18s,box-shadow .18s;cursor:pointer}
.volado-domo .lados .vd-icon{width:30px;height:30px;stroke-width:2.3;color:#c9a66b;filter:none}
.volado-domo .vd-choice{text-align:left;font:600 16px/1.2 var(--serif,serif);letter-spacing:.025em}
.volado-domo .vd-choice small{display:block;font:10px/1.5 var(--sans,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:#9d90aa;margin-top:3px}
.volado-domo .lados .btn:hover:not(:disabled),.volado-domo .lados .btn:focus-visible{border-color:#e4c47a;background:#463348;outline:2px solid #e4c47a;outline-offset:3px}
.volado-domo .lados .btn[aria-pressed=true]{border-color:#e4c47a;background:linear-gradient(#514033,#30231f);box-shadow:0 0 22px #c7953520}
.volado-domo .lados .btn:disabled{cursor:default;opacity:.4}
.volado-domo .lados .btn[aria-pressed=true]:disabled{opacity:1}
.volado-domo .dice{min-height:52px;margin-top:18px;font:13px/1.5 var(--sans,sans-serif);color:#b9afc4;max-width:100%}
.volado-domo .dice b{color:#f2d590;font-weight:600}
.volado-domo .vd-result{display:block;margin-top:4px;font:500 23px/1.2 var(--serif,serif);color:#f7e8c7}
.volado-domo .vd-foot{font:9px/1.5 var(--sans,sans-serif);letter-spacing:.22em;text-transform:uppercase;color:#786d87;border-top:1px solid #b69a651c;padding-top:15px;margin:0}
@keyframes vd-flotar{50%{translate:0 -7px}}
@keyframes vd-lanzar{0%{transform:translateY(0) scaleX(1) rotate(-8deg)}18%{transform:translateY(-32px) scaleX(.08) rotate(16deg)}35%{transform:translateY(-46px) scaleX(1) rotate(-12deg)}50%{transform:translateY(-40px) scaleX(.06) rotate(14deg)}65%{transform:translateY(-24px) scaleX(1) rotate(-9deg)}80%{transform:translateY(-10px) scaleX(.08) rotate(7deg)}92%{transform:translateY(3px) scaleX(1) rotate(-3deg)}100%{transform:translateY(0) scaleX(1) rotate(0)}}
@media(max-height:640px){.volado-domo{padding:20px}.vd-stage{height:180px}.vd-stage::before{width:164px;height:164px}.volado-domo #moneda{width:118px;height:118px}.volado-domo .dice{margin-top:12px}.volado-domo .vd-foot{padding-top:10px}}
@media(prefers-reduced-motion:reduce){.volado-domo #moneda,.volado-domo #moneda.girando{animation:none}.volado-domo *{transition:none}}
`;
    document.head.appendChild(estilo);
  }
  const icono=lado=>`<span class="vd-sr">${lado==='cara'?'👑':'⚔️'}</span><svg class="vd-icon" viewBox="0 0 64 64" aria-hidden="true">${lado==='cara'?'<path d="M12 20l10 10 10-17 10 17 10-10-6 27H18z"/><path d="M18 40h28M20 51h24"/><circle cx="12" cy="17" r="2"/><circle cx="32" cy="10" r="2"/><circle cx="52" cy="17" r="2"/>':'<path d="M14 9l9 5 24 28-5 5-28-24zM9 47l11-11M12 44l-5 5 8 8 5-5M50 9l-9 5-24 28 5 5 28-24zM44 36l11 11M44 52l5 5 8-8-5-5"/>'}</svg>`;
  const p=document.getElementById('ovPanel');
  p.innerHTML=`<section class="volado-domo" aria-labelledby="vd-title"><div class="vd-kicker">El ritual de apertura</div><h3 id="vd-title">Cara o cruz</h3><p class="vd-intro">Elige el sello de tu suerte.<br>Quien gane dará el primer paso en el Domo.</p><div class="volado"><div class="vd-stage"><div class="moneda" id="moneda" role="img" aria-label="Moneda: cara">${icono('cara')}</div></div><div class="lados"><button class="btn" id="ladoCara" aria-pressed="false">${icono('cara')}<span class="vd-choice">Cara<small>La corona</small></span></button><button class="btn" id="ladoCruz" aria-pressed="false">${icono('cruz')}<span class="vd-choice">Cruz<small>Las espadas</small></span></button></div><div class="dice" id="voladoTxt" role="status" aria-live="polite">La moneda espera tu elección.</div></div><p class="vd-foot">Dos sellos · Una oportunidad</p></section>`;
  const panel=p.firstElementChild,moneda=p.querySelector('#moneda'),texto=p.querySelector('#voladoTxt');
  openOv();
  const botones=[p.querySelector('#ladoCara'),p.querySelector('#ladoCruz')];
  const eleccion=await new Promise(resolve=>{
    botones.forEach((boton,i)=>boton.onclick=()=>{
      botones.forEach(b=>b.disabled=true);boton.setAttribute('aria-pressed','true');
      resolve(i===0?'cara':'cruz');
    });
    botones[0].focus({preventScroll:true});
  });
  texto.textContent='Elegiste '+eleccion.toUpperCase()+'. La moneda está en el aire…';
  const salio=rnd(2)===0?'cara':'cruz';
  const reducido=matchMedia('(prefers-reduced-motion: reduce)').matches;
  moneda.classList.add('girando');
  let cara=true;
  const alterna=reducido?null:setInterval(()=>{cara=!cara;moneda.innerHTML=icono(cara?'cara':'cruz');},180);
  try{await nap(reducido?350:1500);}finally{if(alterna!==null)clearInterval(alterna);}
  moneda.classList.remove('girando');moneda.style.animation='none';
  moneda.innerHTML=icono(salio);moneda.setAttribute('aria-label','Moneda: '+salio);
  const ganas=salio===eleccion;
  texto.innerHTML=`Salió <b>${salio.toUpperCase()}</b><span class="vd-result"></span>`;
  texto.querySelector('.vd-result').textContent=ganas?'empiezas tú':'empieza '+nombreRival;
  await nap(1500);
  if(p.contains(panel))document.getElementById('ov').classList.remove('on');
  return ganas?ME:FOE;
}

/* Nube de Dagas: indicador del dueño y aviso previo, compartidos por ambas pantallas. */
{
  const estiloDagas=document.createElement('style');
  estiloDagas.textContent=`
    #efectos,#efectosRival{display:flex;gap:6px;align-items:center}
    #efectos[hidden],#efectosRival[hidden]{display:none}
    .efectosLado{display:flex;flex-direction:column;align-items:center;gap:8px}
    .efecto.dagas{padding:0;border-color:#ef5555;background:linear-gradient(#551f2b,#241016);cursor:pointer}
    .efecto.dagas .ei{color:#ff4545;animation:dagasAlerta 1.15s ease-in-out infinite}
    @keyframes dagasAlerta{0%,100%{opacity:1;filter:drop-shadow(0 0 7px #ff2525)}50%{opacity:.5;filter:drop-shadow(0 0 2px #ff2525)}}
    @media(prefers-reduced-motion:reduce){.efecto.dagas .ei{animation:none;filter:drop-shadow(0 0 5px #ff2525)}}`;
  document.head.appendChild(estiloDagas);
}
function renderNubesDagas(){
  for(const lado of [ME,FOE]){
    const zona=document.getElementById(lado===ME?'efectos':'efectosRival');if(!zona)continue;
    const nubes=P(lado).clouds.filter(c=>c.until>=G.turnNo);
    zona.innerHTML='';zona.hidden=!nubes.length;
    nubes.forEach(c=>{
      const turnos=Math.max(1,Math.ceil((c.until-G.turnNo)/2));
      const texto=`Nube de Dagas de ${P(lado).L.n}: 2 daño a cada Personaje ${lado===ME?'rival':'tuyo'} que entre. ${turnos} turno${turnos===1?'':'s'}.`;
      const d=document.createElement('button');d.type='button';d.className='efecto dagas';
      d.setAttribute('aria-label',texto);d.title=texto;
      d.innerHTML=`<span class="ei" aria-hidden="true">🗡&#xfe0e;</span><i>${turnos}</i>`;
      d.onclick=()=>toast(texto);zona.appendChild(d);
    });
  }
}
let avisoDagasPendiente=false;
async function confirmarNubeDagas(id){
  if(avisoDagasPendiente)return false;
  if(CARDS[id].t!=='personaje'||!P(FOE).clouds.some(c=>c.until>=G.turnNo))return true;
  avisoDagasPendiente=true;
  const partida=G,turno=G.turnNo;
  try{
    const respuesta=await ask(ME,`Nube de Dagas está activa: ${CARDS[id].n} recibirá 2 de daño al entrar. ¿Seguro que quieres jugarlo?`,['Cancelar','Sí, jugar'],()=>0);
    return respuesta===1&&G===partida&&G.turnNo===turno;
  }finally{avisoDagasPendiente=false;}
}

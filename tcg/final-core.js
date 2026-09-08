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

/* Una entrada dorada para pantallas y ventanas de menú. Los temporizadores
   se cancelan al navegar: una entrada anterior no puede cortar la siguiente. */
let menuEntradaTimer,menuBarridoTimer,menuEntradaNodo,menuBarridoNodo;
function limpiarTransicionMenu(){
  clearTimeout(menuEntradaTimer);clearTimeout(menuBarridoTimer);
  if(menuEntradaNodo)menuEntradaNodo.classList.remove('entra','menuEntra');
  if(menuBarridoNodo){
    menuBarridoNodo.classList.remove('va');
    if(menuBarridoNodo.classList.contains('barridoModal'))menuBarridoNodo.remove();
  }
  menuEntradaNodo=null;menuBarridoNodo=null;
}
function animarTransicionMenu(pantalla,ventana=null){
  limpiarTransicionMenu();
  if(!pantalla||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const barrido=ventana?document.createElement('div'):document.getElementById('barrido');
  if(ventana){
    barrido.className='barridoModal';barrido.setAttribute('aria-hidden','true');
    // Hermano del panel, para cubrirlo sin desplazarse al recorrer la colección.
    ventana.appendChild(barrido);
  }
  menuEntradaNodo=pantalla;menuBarridoNodo=barrido;
  void pantalla.offsetWidth;
  // Al regresar, el principal ya debe verse debajo del oro. Repetir su entrada
  // escalonada ocultaba logo y botones durante casi todo el barrido.
  if(ventana||pantalla.id!=='menu')pantalla.classList.add(ventana?'menuEntra':'entra');
  if(barrido){void barrido.offsetWidth;barrido.classList.add('va');}
  menuBarridoTimer=setTimeout(()=>{if(barrido){barrido.classList.remove('va');if(ventana)barrido.remove();}},500);
  menuEntradaTimer=setTimeout(limpiarTransicionMenu,700);
}
function cerrarOv(){
  const ov=document.getElementById('ov'),abierto=ov.classList.contains('on');
  ov.classList.remove('on','suave');
  const mano=document.getElementById('hand');if(mano)mano.classList.remove('mirando');
  if(!abierto)return;
  limpiarTransicionMenu();
  const pantalla=document.querySelector('.screen.on.portada');
  if(pantalla)animarTransicionMenu(pantalla);
}
{
  const css=document.createElement('style');css.textContent=`
  #ov .barridoModal{position:fixed;inset:0;z-index:2}
  #ovPanel.menuEntra{animation:entraPantalla .40s cubic-bezier(.2,.75,.3,1) both}
  @media(prefers-reduced-motion:reduce){#ovPanel.menuEntra{animation:none}}`;
  document.head.appendChild(css);
  // Escape sólo cierra ventanas de menú; las decisiones de combate mantienen
  // sus controles y el diálogo de campaña conserva su cancelación nativa.
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!document.querySelector('#campanaPanel[open]')&&document.querySelector('.screen.on.portada')&&document.querySelector('#ov.on')){
      e.preventDefault();e.stopImmediatePropagation();cerrarOv();
    }
  });
}

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
  if(p.contains(panel))cerrarOv();
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

/* Inicio online con acuse: una bienvenida repetida nunca reparte otra vez. */
function netTieneInternet(){return navigator.onLine!==false;}
function codigoInvitacion(valor){
  let texto=String(valor||'').trim();
  if(texto.includes('://')){try{texto=new URL(texto).searchParams.get('sala')||'';}catch(_){return '';}}
  return texto.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
}
function onlineEspera(texto,volver=false){
  const panel=document.getElementById('ovPanel');panel.innerHTML='';
  const titulo=document.createElement('h3');titulo.textContent=texto;panel.appendChild(titulo);
  if(volver){const b=document.createElement('button');b.className='btn';b.textContent='Volver al menú';b.onclick=()=>{netSend({t:'bye'});netClose();cerrarOv();showScreen('menu');};panel.appendChild(b);}
  openOv();
}
function onlinePreparar(a,b){
  tutEnd();clearPrompt();SEL=null;TGT=null;
  cerrarOv();
  newGame(a,b,{});G.fast=false;G.online=true;G.guest=NET.guest;
  showScreen('board');document.getElementById('log').innerHTML='';render();
}
async function onlineEsperarAcuse(id,campo,mensaje){
  for(let i=0;i<300;i++){
    if(!NET.on||NET.partidaId!==id)return false;
    if(NET[campo])return true;
    if(i%20===0)netSend({...mensaje});
    await sleep(100);
  }
  onlineEspera('No llegó la respuesta de tu rival. Volved a entrar con el código de sala.',true);return false;
}
async function iniciarOnlineHost(a,b){
  if(NET.iniciando)return;
  const id=NET.sid+'-'+Date.now();NET.partidaId=id;NET.iniciando=true;
  NET.rivalListo=false;NET.monedaLista=false;
  NET.welcome={t:'welcome',host:a,guest:b,nombre:NET.miNombre||'Anfitrión',partida:id};
  try{
    onlinePreparar(a,b);netSend({...NET.welcome});
    await cortinillaVS(a,b,{nombres:[NET.miNombre||'Anfitrión',NET.suNombre||'Invitado']});
    if(!await onlineEsperarAcuse(id,'rivalListo',NET.welcome))return;
    const eleccion=await ask(ME,'Cara o cruz — elige tu lado',['Cara','Cruz']);
    if(!NET.on||NET.partidaId!==id)return;
    const resultado=rnd(2),first=resultado===eleccion?ME:FOE;
    const moneda={t:'coin',partida:id,resultado,first};
    netSend({...moneda});await onlineMostrarMoneda(resultado,first===ME?NET.miNombre:NET.suNombre);
    if(!await onlineEsperarAcuse(id,'monedaLista',moneda))return;
    cerrarOv();
    await setupMatch(a,b,{online:true,first});
  }finally{if(NET.partidaId===id)NET.iniciando=false;}
}
async function iniciarOnlineGuest(m){
  const id=m.partida||m.sid;
  if(NET.partidaId===id){if(NET.vsListo)netSend({t:'ready',partida:id});return;}
  NET.partidaId=id;NET.vsListo=false;NET.monedaRecibida=null;
  onlinePreparar(m.guest,m.host);
  await cortinillaVS(m.guest,m.host,{nombres:[NET.miNombre||'Invitado',NET.suNombre||'Anfitrión']});
  if(!NET.on||NET.partidaId!==id)return;
  NET.vsListo=true;onlineEspera('Tu rival está eligiendo cara o cruz…');netSend({t:'ready',partida:id});
}
async function onlineMonedaRecibe(m){
  if(m.partida!==NET.partidaId||!NET.vsListo)return;
  if(NET.monedaRecibida===m.partida){if(NET.monedaTerminada)netSend({t:'coinAck',partida:m.partida});return;}
  NET.monedaRecibida=m.partida;NET.monedaTerminada=false;
  await onlineMostrarMoneda(m.resultado,m.first===0?NET.suNombre:NET.miNombre);
  if(!NET.on||NET.partidaId!==m.partida)return;
  NET.monedaTerminada=true;cerrarOv();netSend({t:'coinAck',partida:m.partida});
}
async function onlineMostrarMoneda(resultado,nombre){
  const panel=document.getElementById('ovPanel');panel.innerHTML='<div class="volado"><h3>Cara o cruz</h3><div class="onlineMoneda" aria-label="Moneda girando">✦</div><p class="onlineResultado">La moneda está en el aire…</p></div>';
  openOv();const moneda=panel.querySelector('.onlineMoneda'),texto=panel.querySelector('.onlineResultado');
  await sleep(1400);moneda.classList.add('quieta');moneda.textContent=resultado===0?'☀':'☾';
  moneda.setAttribute('aria-label',resultado===0?'Cara':'Cruz');
  texto.textContent=(resultado===0?'Cara':'Cruz')+' — empieza '+(nombre||'tu rival');await sleep(1800);
}
{
  const css=document.createElement('style');css.textContent=`
  .onlineMoneda{width:110px;height:110px;display:grid;place-items:center;border:6px double #e5c37a;border-radius:50%;background:radial-gradient(circle at 35% 25%,#f9df9b,#bc8132 65%,#744719);color:#402009;font-size:55px;box-shadow:0 8px 28px #0008;animation:monedaOnline .3s linear infinite}
  .onlineMoneda.quieta{animation:none}
  .onlineResultado{text-align:center}
  @keyframes monedaOnline{50%{scale:.15 1;rotate:12deg}}
  @media(prefers-reduced-motion:reduce){.onlineMoneda{animation:none}}
  `;document.head.appendChild(css);
}
function onlineAyudaInstalada(panel){
  if(!ONL.sala||navigator.standalone||matchMedia('(display-mode:standalone)').matches)return;
  const texto=document.createElement('p');texto.textContent='Puedes jugar aquí. Si prefieres tu app instalada, copia el código y abre Con amigos → Unirme desde su icono.';
  const boton=document.createElement('button');boton.className='btn sm';boton.textContent='Copiar código para la app: '+ONL.sala;
  boton.onclick=async()=>{try{await navigator.clipboard.writeText(ONL.sala);toast('Código copiado');}catch(_){toast('Código de sala: '+ONL.sala);}};
  panel.append(texto,boton);
}

/* CAMPAÑA · prototipo de escalera. El guardado contiene progreso, nunca una partida a medias. */
const CAMPANA_RIVALES=[
  {lider:'mohamed',alma:16},{lider:'fender',alma:20},{lider:'talesin',alma:24},
  {lider:'rafaela',alma:28},{lider:'adreida',alma:32},{lider:'gero',alma:40}
];
const CAMPANA_CLAVE='caoz.campana.v1'+(new URLSearchParams(location.search).has('test')?'.prueba':'');
const CAMPANA_CASILLAS=[[22,84],[68,73],[33,60],[73,47],[40,32],[62,17]];
let campanaPasoAnterior=null;
function campanaPosicionFicha(etapa){return etapa>=6?[50,9]:[CAMPANA_CASILLAS[etapa][0]-12,CAMPANA_CASILLAS[etapa][1]+3];}
let campanaNieblaId=0;
function campanaCrearNiebla(etapa,retirada=false){
  if(etapa>=CAMPANA_RIVALES.length-1)return null;
  const [x,y]=CAMPANA_CASILLAS[etapa],limite=y+4,id='niebla'+(++campanaNieblaId);
  const niebla=document.createElementNS('http://www.w3.org/2000/svg','svg');
  niebla.setAttribute('class',retirada?'campanaNieblaRetirada':'campanaNiebla');
  niebla.setAttribute('viewBox','0 0 600 440');niebla.setAttribute('preserveAspectRatio','none');
  niebla.setAttribute('aria-hidden','true');niebla.setAttribute('focusable','false');
  niebla.dataset.etapa=etapa;niebla.style.setProperty('--niebla-limite',limite+'%');
  // La frontera sube con el avance; una abertura deja legible el encuentro actual.
  niebla.innerHTML=`<defs>
    <linearGradient id="${id}frontera" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="440">
      <stop offset="${limite-17}%" stop-color="white"/><stop offset="${limite}%" stop-color="black"/>
    </linearGradient>
    <radialGradient id="${id}claro"><stop offset=".55" stop-color="black"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}nube"><stop stop-color="#f1f0dd" stop-opacity=".55"/><stop offset="1" stop-color="#e4e9db" stop-opacity="0"/></radialGradient>
    <filter id="${id}borde" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".009 .016" numOctaves="2" seed="7" result="viento"/><feDisplacementMap in="SourceGraphic" in2="viento" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter>
    <mask id="${id}mascara" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="440" style="mask-type:luminance">
      <rect x="-30" y="-30" width="660" height="500" fill="url(#${id}frontera)" filter="url(#${id}borde)"/>
      <ellipse cx="${x*6}" cy="${y*4.4-7}" rx="100" ry="66" fill="url(#${id}claro)"/>
    </mask>
  </defs><g mask="url(#${id}mascara)">
    <rect width="600" height="440" fill="#b8c4bf" fill-opacity=".97"/>
    <g class="campanaBruma" fill="url(#${id}nube)"><ellipse cx="115" cy="80" rx="250" ry="110"/><ellipse cx="465" cy="215" rx="260" ry="125"/><ellipse cx="170" cy="345" rx="240" ry="100"/></g>
    <g class="campanaBruma campanaBrumaLejana" fill="url(#${id}nube)"><ellipse cx="400" cy="45" rx="290" ry="90"/><ellipse cx="120" cy="230" rx="270" ry="95"/></g>
  </g>`;
  return niebla;
}
let campanaMemoria=null,campanaLanzando=false;
function campanaLeer(){
  let dato=campanaMemoria;
  try{if(!dato)dato=JSON.parse(localStorage.getItem(CAMPANA_CLAVE));}catch(_){}
  if(!dato||dato.version!==1||typeof dato.id!=='string'||!LEADERS[dato.lider]||!Number.isInteger(dato.etapa)||dato.etapa<0||dato.etapa>CAMPANA_RIVALES.length)return null;
  return dato;
}
function campanaGuardar(dato){
  campanaMemoria=dato;
  try{localStorage.setItem(CAMPANA_CLAVE,JSON.stringify(dato));return true;}
  catch(_){toast('No se pudo guardar en este navegador. Puedes continuar mientras no cierres el juego.');return false;}
}
function campanaDialogo(){
  let d=document.getElementById('campanaPanel');
  if(!d){
    d=document.createElement('dialog');d.id='campanaPanel';d.setAttribute('aria-labelledby','campanaTitulo');document.body.appendChild(d);
    d.addEventListener('close',()=>{if(!d.open){campanaCancelarZoom();campanaLimpiarEntrada();}});
    d.addEventListener('cancel',e=>{e.preventDefault();campanaVolverAlMenu();});
  }
  if(!d.open){d.showModal();cargarArte().then(()=>d.querySelectorAll('[data-campana-lider]').forEach(n=>{if(!n.querySelector('.marcoDibujo'))ilustrarLider(n,n.dataset.campanaLider);}));}return d;
}
function campanaBoton(texto,accion,principal=false){
  const b=document.createElement('button');b.className='btn'+(principal?' gold':'');b.textContent=texto;b.onclick=accion;return b;
}
function campanaAcciones(...botones){const pie=document.createElement('footer');pie.className='campanaAcciones';pie.append(...botones);return pie;}
function campanaAjustarVentana(){
  const v=window.visualViewport,s=document.documentElement.style;
  s.setProperty('--campana-alto',(v?v.height:innerHeight)+'px');
  s.setProperty('--campana-desfase',(v?v.offsetTop:0)+'px');
}
addEventListener('resize',campanaAjustarVentana);
if(window.visualViewport){visualViewport.addEventListener('resize',campanaAjustarVentana);visualViewport.addEventListener('scroll',campanaAjustarVentana);}
campanaAjustarVentana();
let campanaEntradaTimer;
function campanaLimpiarEntrada(){
  clearTimeout(campanaEntradaTimer);
  const d=document.getElementById('campanaPanel');if(!d)return;
  d.classList.remove('campanaEntra');const b=d.querySelector('.campanaBarrido');if(b)b.remove();
}
function campanaAnimarEntrada(){
  limpiarTransicionMenu();
  campanaLimpiarEntrada();
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const d=document.getElementById('campanaPanel');if(!d||!d.open)return;
  // El diálogo está por encima de los menús: el destello debe vivir en esa misma capa.
  const b=document.createElement('div');b.className='campanaBarrido va';b.setAttribute('aria-hidden','true');
  d.appendChild(b);d.classList.add('campanaEntra');
  campanaEntradaTimer=setTimeout(campanaLimpiarEntrada,700);
}
function campanaCerrar(){campanaCancelarZoom();campanaLimpiarEntrada();const d=document.getElementById('campanaPanel');if(d&&d.open)d.close();}
function campanaVolverAlMenu(){
  campanaCerrar();showScreen('menu');
  // La campaña es un diálogo: debajo ya estaba el menú, así que el regreso
  // también debe animarse cuando showScreen no cambia la pantalla activa.
  animarTransicionMenu(document.getElementById('menu'));
}
function campanaCabecera(d,titulo,sub){
  campanaCancelarZoom();
  campanaLimpiarEntrada();
  d.dataset.vista='mensaje';
  d.innerHTML='<header class="campanaCabecera"><div class="campanaSello">CAMPAÑA · PROTOTIPO</div><h2 id="campanaTitulo"></h2><p class="campanaSub"></p></header>';
  d.querySelector('h2').textContent=titulo;d.querySelector('p').textContent=sub;
}
function abrirCampana(){
  const d=document.getElementById('campanaPanel');if(d&&d.open)return;
  const progreso=campanaLeer();
  if(progreso)campanaRuta();else campanaElegir();
  campanaAnimarEntrada();
}
function campanaElegir(){
  const d=campanaDialogo();campanaCabecera(d,'Elige tu Protagonista','Desliza las cartas para elegir quién subirá al Domo.');
  d.dataset.vista='seleccion';
  const ids=Object.keys(LEADERS);let centro=0;
  const pista=document.createElement('div');pista.className='campanaCarrusel';pista.setAttribute('aria-label','Protagonistas');
  const ficha=document.createElement('div');ficha.className='campanaFicha';ficha.setAttribute('aria-live','polite');
  const cartas=ids.map((id,i)=>{
    const L=LEADERS[id],D=DECKS[id],c=campanaBoton('',()=>elegir(i));c.className='campanaCarta';
    c.innerHTML=`<span class="lface">${L.art}</span><b class="lname">${L.n}</b><span class="larch">${D.d}</span><span class="lhab">${L.habName} · ${L.habCost} PD</span>`;
    c.dataset.campanaLider=id;c.setAttribute('aria-label',L.n);ilustrarLider(c,id);pista.appendChild(c);return c;
  });
  function elegir(i){
    centro=(i+ids.length)%ids.length;
    cartas.forEach((c,j)=>{
      let distancia=(j-centro+ids.length)%ids.length;if(distancia>ids.length/2)distancia-=ids.length;
      const oculta=Math.abs(distancia)>Math.floor((ids.length-1)/2);
      c.classList.toggle('guardada',oculta);c.classList.toggle('enfrente',j===centro);
      c.style.setProperty('--d',oculta?0:distancia);c.style.setProperty('--dist',Math.abs(distancia));
      c.setAttribute('aria-pressed',String(j===centro));c.setAttribute('aria-hidden',String(oculta));c.tabIndex=j===centro?0:-1;c.disabled=oculta;
    });
    const L=LEADERS[ids[centro]];ficha.innerHTML=`<b>${L.n} — ${L.ep}</b><p>${L.pasiva}</p><small>Mazo «${DECKS[ids[centro]].n}» · 40 cartas</small>`;
  }
  const controles=document.createElement('div');controles.className='campanaFlechas';
  const anterior=campanaBoton('←',()=>elegir(centro-1)),siguiente=campanaBoton('→',()=>elegir(centro+1));
  anterior.setAttribute('aria-label','Protagonista anterior');siguiente.setAttribute('aria-label','Protagonista siguiente');
  controles.append(anterior,document.createTextNode('Desliza para elegir'),siguiente);
  let x=null;
  pista.addEventListener('pointerdown',e=>{x=e.clientX;});
  pista.addEventListener('pointerup',e=>{if(x!==null&&Math.abs(e.clientX-x)>35){elegir(centro+(e.clientX<x?1:-1));ignorarClic=Date.now()+400;}x=null;});
  pista.addEventListener('pointercancel',()=>{x=null;});
  let ignorarClic=0;pista.addEventListener('click',e=>{if(Date.now()<ignorarClic){e.preventDefault();e.stopPropagation();}},true);
  pista.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();elegir(centro+(e.key==='ArrowLeft'?-1:1));cartas[centro].focus({preventScroll:true});}});
  const confirmar=campanaBoton('Elegir Protagonista',()=>{
    campanaPasoAnterior=null;campanaGuardar({version:1,id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),lider:ids[centro],etapa:0});campanaRuta();
  },true);confirmar.classList.add('campanaConfirmar');
  const seleccion=document.createElement('div');seleccion.className='campanaSeleccion';seleccion.append(pista,controles,ficha);
  d.append(seleccion,campanaAcciones(confirmar,campanaBoton('Menú principal',campanaVolverAlMenu)));elegir(0);
}
function campanaRuta(aviso=''){
  const p=campanaLeer();if(!p){campanaElegir();return;}
  const completa=p.etapa===CAMPANA_RIVALES.length,d=campanaDialogo();
  campanaCabecera(d,completa?'El Domo es tuyo':'La mesa del Domo',aviso||(LEADERS[p.lider].n+' · '+p.etapa+' de 6 rivales vencidos'));
  d.dataset.vista='mapa';
  const mesa=document.createElement('div');mesa.className='campanaMesa';
  const tablero=document.createElement('div');tablero.className='campanaTablero';
  tablero.innerHTML=`<svg class="campanaGeografia" viewBox="0 0 600 440" preserveAspectRatio="none" aria-hidden="true">
    <defs><pattern id="campanaTrama" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 16L16 0" stroke="#714b21" stroke-opacity=".045"/></pattern></defs>
    <rect width="600" height="440" fill="url(#campanaTrama)"/>
    <path d="M60 35Q205 110 95 190T125 420M82 25Q225 110 118 195T146 424" fill="none" stroke="#586d63" stroke-width="6" opacity=".35"/>
    <path d="M438 22L493 112L390 112Z" fill="#776447" opacity=".45"/><path d="M438 22L438 112L390 112Z" fill="#c3ac76"/>
    <path d="M187 208L220 264L150 264Z" fill="#7b674b" opacity=".55"/>
    <path d="M450 278L472 323H428Z M476 295L496 337H457Z M436 318L455 357H417Z" fill="#506047" opacity=".55"/>
    <path d="M84 414L132 370L408 321L198 264L438 207L240 141L372 75L300 30" fill="none" stroke="#5d3a21" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity=".25"/>
    <path d="M84 414L132 370L408 321L198 264L438 207L240 141L372 75L300 30" fill="none" stroke="#eddba1" stroke-width="7" stroke-dasharray="3 12" stroke-linecap="round"/>
    <circle cx="527" cy="382" r="25" fill="none" stroke="#77502e" opacity=".5"/><path d="M527 352L534 382L527 412L520 382Z M497 382L527 375L557 382L527 389Z" fill="#77502e" opacity=".5"/>
  </svg><span class="campanaCima" aria-hidden="true">♛</span>`;
  const lista=document.createElement('ol');lista.className='campanaRuta';lista.setAttribute('aria-label','Camino de encuentros, desde la salida hasta la cima');
  CAMPANA_RIVALES.map((r,i)=>({r,i})).reverse().forEach(({r,i})=>{
    const fila=document.createElement('li');fila.className=(i<p.etapa?'vencido':i===p.etapa?'actual':'pendiente')+(i===5?' jefe':'');
    fila.dataset.etapa=i;fila.style.left=CAMPANA_CASILLAS[i][0]+'%';fila.style.top=CAMPANA_CASILLAS[i][1]+'%';
    if(i>p.etapa){
      fila.innerHTML=`<span class="campanaOculto" aria-hidden="true">?</span><b>Desconocido</b><span class="campanaNumero">${i+1}</span>`;
      fila.setAttribute('aria-label','Encuentro '+(i+1)+': rival desconocido');
    }else{
      const ficha=campanaBoton('',()=>{if(i===p.etapa)campanaCombatir();else toast(LEADERS[r.lider].n+': encuentro superado');});ficha.className='campanaEncuentro';
      ficha.innerHTML=`<span class="lface">${LEADERS[r.lider].art}</span><b>${LEADERS[r.lider].n}</b><span class="campanaNumero">${i<p.etapa?'✓':i+1}</span>`;
      ficha.setAttribute('aria-label',LEADERS[r.lider].n+(i<p.etapa?', vencido':', combatir · '+r.alma+' Alma'));
      fila.dataset.campanaLider=r.lider;fila.appendChild(ficha);ilustrarLider(fila,r.lider);
    }
    lista.appendChild(fila);
  });
  const peon=document.createElement('div');peon.className='campanaPeon';peon.setAttribute('role','img');peon.setAttribute('aria-label','Tu ficha: '+LEADERS[p.lider].n);
  peon.innerHTML=`<span class="campanaPeonCuerpo"><span>${LEADERS[p.lider].art}</span></span><span class="campanaPeonBase"></span>`;
  const destino=campanaPosicionFicha(p.etapa),origen=campanaPasoAnterior===null?destino:campanaPosicionFicha(campanaPasoAnterior);
  peon.style.left=destino[0]+'%';peon.style.top=destino[1]+'%';peon.dataset.etapa=p.etapa;
  tablero.append(lista,peon);
  const niebla=campanaCrearNiebla(p.etapa);if(niebla)tablero.appendChild(niebla);
  const camara=document.createElement('div');camara.className='campanaCamara';camara.appendChild(tablero);
  mesa.appendChild(camara);d.appendChild(mesa);
  if(campanaPasoAnterior!==null&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    const retirada=campanaCrearNiebla(campanaPasoAnterior,true);
    if(retirada){
      tablero.appendChild(retirada);
      retirada.animate([{opacity:1},{opacity:0}],{duration:1100,easing:'ease-in-out',fill:'forwards'});
      setTimeout(()=>retirada.remove(),1200);
    }
    peon.animate([{left:origen[0]+'%',top:origen[1]+'%'},{left:destino[0]+'%',top:destino[1]+'%'}],{duration:1100,easing:'ease-in-out'});
    peon.querySelector('.campanaPeonCuerpo').animate([{translate:'0 0'},{translate:'0 -10px'},{translate:'0 0'}],{duration:275,iterations:4});
  }
  campanaPasoAnterior=null;
  const ayuda=document.createElement('p');ayuda.className='campanaNota';ayuda.textContent=completa?'Venciste a Gero. Campaña completada.':'Mazo completo · 20 de Alma por duelo. Tu avance se guarda.';d.appendChild(ayuda);
  const acciones=campanaAcciones(campanaBoton(completa?'Nueva campaña':'Combatir contra '+LEADERS[CAMPANA_RIVALES[p.etapa].lider].n,completa?campanaElegir:()=>campanaCombatir(),true),campanaBoton('Menú principal',campanaVolverAlMenu));
  if(!completa)acciones.appendChild(campanaBoton('Reiniciar',()=>{
    campanaCabecera(d,'¿Reiniciar la campaña?','Perderás el avance de esta escalera cuando elijas un nuevo Protagonista.');
    d.append(campanaAcciones(campanaBoton('Conservar mi avance',()=>campanaRuta(),true),campanaBoton('Elegir nuevo Protagonista',campanaElegir)));
  }));
  d.appendChild(acciones);
}
let campanaCancelarAcercamiento=null;
function campanaCancelarZoom(){if(campanaCancelarAcercamiento)campanaCancelarAcercamiento();}
function campanaAcercarMapa(etapa){
  const d=document.getElementById('campanaPanel'),camara=d&&d.querySelector('.campanaCamara');
  if(!d||!d.open||!camara||matchMedia('(prefers-reduced-motion:reduce)').matches||document.hidden)return Promise.resolve(true);
  campanaLimpiarEntrada();
  // La cámara envuelve al tablero: su escala no altera la perspectiva ni la posición de las fichas.
  const [x,y]=CAMPANA_CASILLAS[etapa],origen=camara.style.transformOrigin;
  camara.style.transformOrigin=x+'% '+y+'%';
  const animacion=camara.animate([{scale:'1',translate:'0 0'},{scale:'1.7',translate:(50-x)+'% '+(50-y)+'%'}],{duration:500,easing:'cubic-bezier(.4,0,.7,1)',fill:'forwards'});
  const botones=[...d.querySelectorAll('button')].map(b=>({b,disabled:b.disabled}));botones.forEach(({b})=>b.disabled=true);
  d.classList.add('campanaAcercando');
  return new Promise(resolve=>{
    let acabado=false,temporizador;
    const terminar=continuar=>{
      if(acabado)return;acabado=true;clearTimeout(temporizador);
      campanaCancelarAcercamiento=null;animacion.cancel();camara.style.transformOrigin=origen;
      d.classList.remove('campanaAcercando');botones.forEach(({b,disabled})=>b.disabled=disabled);
      resolve(continuar);
    };
    campanaCancelarAcercamiento=()=>terminar(false);
    temporizador=setTimeout(()=>terminar(true),500);
  });
}
async function campanaCombatir(){
  const p=campanaLeer();if(!p||p.etapa>=6||campanaLanzando)return;
  if(NET.on){toast('Sal de la sala online antes de comenzar la campaña.');return;}
  campanaLanzando=true;
  const rival=CAMPANA_RIVALES[p.etapa];
  try{
    if(!await campanaAcercarMapa(p.etapa))return;
    campanaCerrar();cerrarCinematica();
    await startMatch(p.lider,rival.lider,{campana:{id:p.id,etapa:p.etapa,alma:rival.alma}});
  }
  finally{campanaLanzando=false;}
}
function campanaFinal(winner,why){
  relojPara();
  const meta=G.campana,p=campanaLeer();
  if(!meta||!p||meta.id!==p.id)return;
  if(!G.campanaResuelta){
    G.campanaResuelta=true;
    if(winner===ME&&p.etapa===meta.etapa){campanaPasoAnterior=p.etapa;p.etapa++;campanaGuardar(p);}
  }
  const d=campanaDialogo(),completa=p.etapa===6;
  campanaCabecera(d,winner===ME?(completa?'¡Campaña completada!':'¡Rival vencido!'):'El ascenso continúa',
    winner===ME?(completa?'Derrotaste a Gero. El Domo es tuyo.':'Has superado a '+LEADERS[CAMPANA_RIVALES[meta.etapa].lider].n+'. El siguiente combate está desbloqueado.'):'No pierdes tu progreso. Puedes volver a desafiar a este rival.');
  const resultado=document.createElement('p');resultado.className='campanaNota';resultado.textContent=why||'';d.appendChild(resultado);
  const acciones=campanaAcciones();
  if(!completa)acciones.appendChild(campanaBoton(winner===ME?'Avanzar en el mapa':'Reintentar combate',()=>winner===ME?campanaRuta():campanaCombatir(),true));
  acciones.append(campanaBoton(completa?'Ver campaña completada':'Ver el mapa',()=>campanaRuta(),completa),campanaBoton('Menú principal',campanaVolverAlMenu));d.appendChild(acciones);
}
{
  const css=document.createElement('style');css.textContent=`
  #campanaPanel{--alto-util:calc(var(--campana-alto,100dvh) - max(12px,env(safe-area-inset-top)) - max(12px,env(safe-area-inset-bottom)));box-sizing:border-box;position:fixed;inset:calc(var(--campana-desfase,0px) + max(12px,env(safe-area-inset-top))) 0 auto;margin:0 auto;width:min(calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)),650px);max-height:var(--alto-util);overflow:hidden;overscroll-behavior:contain;padding:18px;border:1px solid #a67b44;border-radius:18px;background:radial-gradient(ellipse at top,#592620,#201511 65%);color:#ead8bc;box-shadow:0 25px 100px #000c;text-align:center}
  #campanaPanel[open]{display:flex;flex-direction:column;gap:10px}
  #campanaPanel .campanaBarrido{position:fixed;inset:0;z-index:100}
  #campanaPanel.campanaEntra>:not(.campanaBarrido){animation:entraPantalla .40s cubic-bezier(.2,.75,.3,1) both}
  #campanaPanel.campanaEntra>:not(.campanaBarrido):nth-child(2){animation-delay:.045s}
  #campanaPanel.campanaEntra>:not(.campanaBarrido):nth-child(3){animation-delay:.09s}
  #campanaPanel.campanaEntra>:not(.campanaBarrido):nth-child(4){animation-delay:.13s}
  @media(prefers-reduced-motion:reduce){#campanaPanel.campanaEntra>*{animation:none}}
  #campanaPanel[data-vista="mapa"],#campanaPanel[data-vista="seleccion"]{height:min(850px,var(--alto-util))}
  #campanaPanel[data-vista="mensaje"]{bottom:max(12px,env(safe-area-inset-bottom));height:fit-content;margin:auto}
  .campanaCabecera,.campanaAcciones{flex:none;min-width:0}
  .campanaAcciones{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  #campanaPanel .campanaAcciones .btn{width:100%;min-width:0;min-height:44px;margin:0;padding:8px;white-space:normal}
  .campanaAcciones>.gold,.campanaAcciones>:only-child,.campanaAcciones>:last-child:nth-child(2){grid-column:1/-1}
  .campanaSeleccion{display:flex;flex:1;min-height:0;flex-direction:column;gap:6px}

  .campanaCarrusel{position:relative;flex:1;min-height:140px;max-height:315px;perspective:850px;overflow:hidden;touch-action:pan-y;--paso:118px}
  .campanaCarta{position:absolute;left:50%;top:20px;width:180px;height:calc(100% - 48px);max-height:260px;min-height:0;display:flex;flex-direction:column;padding:0;overflow:hidden;border:1px solid #896038;border-radius:12px;background:linear-gradient(#38261e,#140f0c);color:#ecd8b2;
    transform:translateX(-50%) translateX(calc(var(--d)*var(--paso))) translateZ(calc(var(--dist)*-120px)) rotateY(calc(var(--d)*-26deg)) rotate(calc(var(--d)*2deg)) translateY(calc(var(--dist)*12px));
    z-index:calc(10 - var(--dist));filter:brightness(calc(1 - var(--dist)*.20));transition:transform .42s cubic-bezier(.22,.61,.36,1),filter .42s,box-shadow .3s;cursor:pointer}
  .campanaCarta.enfrente{transform:translateX(-50%) translateZ(60px);filter:none;border-color:#e6bb52;box-shadow:0 0 0 2px #e6bb5270,0 18px 45px #0009}
  .campanaCarta:focus-visible{outline:2px solid #ffe1a0;outline-offset:2px}
  .campanaCarta.guardada{opacity:0;pointer-events:none}
  .campanaCarta .lface{position:relative;display:grid;place-items:center;width:100%;flex:1;min-height:0;font-size:clamp(30px,7vh,65px);overflow:hidden}
  .campanaCarta .lname{display:block;font:800 20px/1.2 var(--serif);padding:6px 4px;background:#100b09}
  .campanaCarta .larch,.campanaCarta .lhab{display:block;padding:7px 8px;font:10px/1.3 var(--sans);color:#cbb89b}
  .campanaFlechas{display:flex;align-items:center;justify-content:center;gap:16px;color:#beaa89;font:12px var(--sans)}
  .campanaFlechas .btn{min-width:48px;min-height:44px}
  .campanaFicha{flex:none;padding:4px;font:12px/1.35 var(--sans);min-height:0}.campanaFicha p{margin:5px 0}.campanaFicha small{color:#c6ab7b}
  .campanaRuta li{position:relative}.campanaRuta li+li::before{content:'';position:absolute;width:1px;height:10px;background:#be905566;left:32px;top:-10px}
  .campanaOculto{width:48px;height:58px;flex:0 0 48px;display:grid;place-items:center;border:1px solid #a0784555;border-radius:8px;font:32px var(--serif);color:#bc9c6a;background:#261c15}
  @media(max-width:500px){.campanaCarrusel{--paso:84px}.campanaCarta{width:156px}}
  @media(prefers-reduced-motion:reduce){.campanaCarta{transition:none}}
  #campanaPanel:focus{outline:none}
  #campanaPanel .btn:focus-visible{outline:2px solid #f2d391;outline-offset:3px}
  #campanaPanel .btn:not(.gold){background:linear-gradient(150deg,#463021,#211812);border-color:#a47b4655}
  #campanaPanel::backdrop{background:#080509c9;backdrop-filter:blur(6px)}
  #campanaPanel h2{font:800 clamp(22px,4.5vw,32px)/1.15 var(--serif);color:#f2d391;margin:5px 0}
  .campanaSello{font:700 10px/1.3 var(--sans);letter-spacing:3px;color:#c99659}
  .campanaSub,.campanaNota{flex:none;font:12px/1.4 var(--sans);color:#c7b499;margin:4px 0}
  #campanaPanel>.btn{display:block;width:100%;min-height:46px;margin-top:10px;white-space:normal}
  .campanaElegir{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:22px 0}
  .campanaElegir .btn{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;padding:14px 8px}
  .campanaElegir small{font-size:11px;line-height:1.3;color:#c8b590}
  .campanaElegir .lface,.campanaRuta .lface{width:48px;height:58px;flex:0 0 48px;position:relative;overflow:hidden;border-radius:8px;font-size:32px;display:grid;place-items:center}
  .campanaElegir .lface .dibujo,.campanaRuta .lface .dibujo{position:absolute;inset:0;background-size:cover;background-position:center}
  .campanaRuta{list-style:none;padding:0;margin:20px 0;display:flex;flex-direction:column;gap:9px;text-align:left}
  .campanaRuta li{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #85623950;border-radius:10px;background:#100d0cb3}
  .campanaRuta li.actual{border-color:#ebc579;box-shadow:0 0 18px #d7a34b20;background:linear-gradient(100deg,#60401e,#281911)}
  .campanaRuta li.pendiente{opacity:.6}.campanaRuta li.vencido{border-color:#79a17f66}
  .campanaRuta li.jefe{border-color:#c4544c}.campanaRuta b{font:700 18px/1.2 var(--serif)}
  .campanaRuta small{display:block;margin-top:5px;font:11px/1.4 var(--sans);color:#c1af92}
  .campanaNumero{width:20px;flex:0 0 20px;font:800 18px var(--serif);color:#d6b56e}
  @media(max-width:400px){#campanaPanel{padding:12px}.campanaRuta li{gap:8px;padding:8px}}

  .campanaMesa{position:relative;flex:1;min-height:0;margin:0;padding:13px 12px 24px;border-radius:16px;perspective:1000px;background:repeating-linear-gradient(3deg,#27150e 0px,#382015 8px,#2b190f 12px,#482c1b 14px);box-shadow:inset 0 2px 12px #000b,0 12px 22px #0007}
  .campanaCamara{height:100%;position:relative;perspective:1000px}
  .campanaAcercando .campanaMesa{overflow:hidden}
  .campanaAcercando .campanaAcciones,.campanaAcercando>.campanaNota{opacity:.2;transition:opacity .25s}
  .campanaTablero{height:100%;box-sizing:border-box;position:relative;border:6px solid #806039;border-radius:9px;background:radial-gradient(ellipse at 40% 35%,#ccb982,#a58a56);transform:rotateX(10deg) rotateZ(-1deg);box-shadow:0 3px 0 #5b3e24,0 7px 0 #402819,0 14px 18px #0007,inset 0 0 35px #54351b88;isolation:isolate}
  .campanaGeografia{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .campanaNiebla,.campanaNieblaRetirada{position:absolute;inset:0;width:100%;height:100%;border-radius:3px;overflow:hidden;z-index:12;pointer-events:none}
  .campanaBruma{animation:campanaBrumaFlota 14s ease-in-out infinite alternate}
  .campanaBrumaLejana{animation-duration:19s;animation-direction:alternate-reverse}
  @keyframes campanaBrumaFlota{from{transform:translate(-22px,-8px)}to{transform:translate(24px,10px)}}
  #campanaPanel:not([open]) .campanaBruma{animation-play-state:paused}
  @media(prefers-reduced-motion:reduce){.campanaBruma{animation:none}}
  .campanaCima{position:absolute;left:50%;top:2%;font:28px var(--serif);color:#643b23;translate:-50% 0}
  #campanaPanel .campanaMesa .campanaRuta{position:absolute;inset:0;display:block;max-height:none;overflow:visible;margin:0;padding:0;list-style:none}
  .campanaMesa .campanaRuta li{position:absolute;width:82px;height:67px;display:block;translate:-50% -50%;padding:0;border:none;background:none;box-shadow:none;text-align:center;opacity:1}
  .campanaMesa .campanaRuta li+li::before{display:none}
  .campanaMesa .campanaRuta .pendiente{visibility:hidden}
  .campanaEncuentro{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;padding:0;background:none;border:0;color:#f1ddb0;cursor:pointer}
  .campanaMesa .campanaRuta .lface,.campanaMesa .campanaOculto{position:relative;display:grid;place-items:center;width:43px;height:43px;flex:none;border-radius:50%;font-size:25px;border:2px solid #705032;background:#30231c;box-shadow:0 4px 0 #4e3421,0 7px 8px #24150788;margin:0 auto;overflow:hidden}
  .campanaMesa .campanaRuta .actual .lface{border-color:#ffe6a4;box-shadow:0 4px 0 #765327,0 0 0 4px #fff0b533,0 6px 18px #fff0b5aa}
  .campanaMesa .campanaRuta .vencido .lface{border-color:#587847;filter:saturate(.45)}
  .campanaMesa .campanaRuta .campanaOculto{background:linear-gradient(#46392b,#29221d);color:#b29e79;border-color:#6f6047}
  .campanaMesa .campanaRuta b{display:block;margin:7px 0 0;padding:3px 5px;border-radius:4px;background:#2d1d13ed;color:#ead6b2;font:700 11px/1.2 var(--serif);white-space:nowrap}
  .campanaMesa .campanaRuta .campanaNumero{position:absolute;right:9px;top:0;width:17px;height:17px;display:grid;place-items:center;border-radius:50%;font:800 10px var(--sans);background:#e0c28a;color:#3c2715}
  .campanaPeon{position:absolute;width:30px;height:58px;translate:-50% -75%;pointer-events:none;z-index:20;filter:drop-shadow(4px 6px 3px #27170aaa)}
  .campanaPeonCuerpo{position:absolute;left:5px;bottom:7px;width:20px;height:41px;border-radius:45% 45% 25% 25%;background:linear-gradient(90deg,#92651e,#ffe3a0 45%,#bd8b38);border:1px solid #80541e;z-index:2}
  .campanaPeonCuerpo>span{position:absolute;top:-14px;left:-6px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffe9ae,#b78227);border:2px solid #d8b568;font-size:17px}
  .campanaPeonBase{position:absolute;bottom:0;left:0;width:30px;height:13px;border-radius:50%;background:linear-gradient(#e3bd64,#88571e);border:1px solid #76501c;box-shadow:0 3px 0 #543514}
  .campanaEncuentro:focus-visible{outline:2px solid #fff3ce;outline-offset:4px;border-radius:8px}
  @media(max-width:400px){.campanaTablero{border-width:4px}.campanaMesa{padding:8px 8px 16px}.campanaMesa .campanaRuta li{width:70px}.campanaMesa .campanaRuta b{font-size:10px}}
  @media(max-height:650px){
    #campanaPanel{padding:10px;gap:6px}.campanaSello{font-size:9px;letter-spacing:2px}
    #campanaPanel h2{font-size:22px}.campanaSub,.campanaNota{font-size:11px;margin:2px 0}
    .campanaFicha{font-size:11px;line-height:1.25}.campanaFicha p{margin:3px 0}
    .campanaCarta .lname{font-size:16px;padding:4px}.campanaCarta .larch,.campanaCarta .lhab{font-size:9px;padding:4px}
    .campanaFlechas{font-size:11px}.campanaFlechas .btn{min-height:40px}
  }
  @media(min-aspect-ratio:6/5) and (max-height:650px){
    #campanaPanel[data-vista="mapa"],#campanaPanel[data-vista="seleccion"]{width:min(calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)),1000px);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(210px,1fr);grid-template-rows:auto minmax(0,1fr) auto;gap:8px 16px}
    .campanaCabecera{grid-column:2;grid-row:1}.campanaMesa{grid-column:1;grid-row:1/4;height:100%}
    .campanaNota{grid-column:2;grid-row:2;align-self:center}.campanaAcciones{grid-column:2;grid-row:3}
    .campanaSeleccion{display:contents}.campanaCarrusel{grid-column:1;grid-row:1/3;height:100%;min-height:0}
    .campanaFlechas{grid-column:1;grid-row:3}.campanaFicha{grid-column:2;grid-row:2;align-self:center}
    .campanaCarta{width:150px}.campanaCarrusel{--paso:88px}
  }
  `;document.head.appendChild(css);
}

addEventListener('load',()=>{if(new URLSearchParams(location.search).get('campana')==='1')abrirCampana();});

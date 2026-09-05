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
.fin.entra .vscard.pierde{transform:translate(-50%,-50%) translateY(23vh) translateX(30vw) scale(.55) rotate(10deg);opacity:.6;
  filter:grayscale(1) brightness(.45)}
/* la grieta: unas líneas blancas que se encienden cuando la carta ya se ha hundido */
.fin .vscard.pierde::after{content:"";position:absolute;inset:0;z-index:5;opacity:0;transition:opacity .5s .7s;pointer-events:none;
  background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140' preserveAspectRatio='none'><g fill='none' stroke='rgba(255,255,255,.75)' stroke-width='.9'><polyline points='52,0 47,22 55,38 44,58 53,74 41,96 50,118 46,140'/><polyline points='47,22 30,30 18,26'/><polyline points='44,58 62,66 74,60'/><polyline points='41,96 26,104 20,120'/><polyline points='53,74 70,88'/></g></svg>") center/100% 100% no-repeat}
.fin.entra .vscard.pierde::after{opacity:1}
/* el sello */
.fin .sello{position:relative;z-index:6;text-align:center;opacity:0;translate:0 13vh;transform:scale(3) rotate(-6deg);
  transition:opacity .2s, transform .4s cubic-bezier(.2,1.5,.4,1)}
.fin.sello-on .sello{opacity:1;transform:scale(1) rotate(-3deg)}
.fin .sello b{display:block;font:900 clamp(46px,13vw,104px)/1 var(--serif,serif);letter-spacing:6px;
  background-image:linear-gradient(180deg,#fff3c4 0%,#e6bb52 46%,#8d6f21 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 5px 0 #3a2a08) drop-shadow(0 0 28px rgba(230,187,82,.75))}
.fin.derrota .sello b{background-image:linear-gradient(180deg,#ffd9d6 0%,#e0524a 46%,#4a1010 100%);
  filter:drop-shadow(0 5px 0 #2a0806) drop-shadow(0 0 28px rgba(224,82,74,.7))}
.fin .sello small{display:block;margin:16px auto 0;max-width:min(520px,86vw);opacity:0;transition:opacity .5s .25s;
  font:600 clamp(12.5px,3.4vw,16px)/1.5 var(--sans,sans-serif);letter-spacing:.6px;color:#efe6fb;text-shadow:0 2px 8px #000}
.fin .sello i{display:block;font-style:normal;margin-top:9px;opacity:0;transition:opacity .5s .45s;
  font:700 clamp(11px,2.8vw,13px)/1.4 var(--sans,sans-serif);letter-spacing:2.5px;color:var(--dim,#a294bd)}
.fin.sello-on .sello small,.fin.sello-on .sello i{opacity:1}
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

if(!document.getElementById('finCss')){
  const st = document.createElement('style');
  st.id = 'finCss'; st.textContent = FIN_CSS;
  document.head.appendChild(st);
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

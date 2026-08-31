/* ============================================================================
   PRUEBAS DEL TCG DEL DOMO
   ----------------------------------------------------------------------------
   Se carga sólo con ?test=1, así que el juego normal no paga ni un byte por
   esto y sigue siendo un archivo suelto que funciona en file://.

   Por qué existe: el motor es un solo archivo de 4.400 líneas donde todo se
   toca con todo — arreglar el tutorial rompía el fin de partida, arreglar la
   IA rompía el ataque. Hasta ahora el arnés lo reescribía a mano en la consola
   del navegador y se perdía al cerrar la pestaña, así que cada regresión se
   descubría jugando. Esto es ese mismo arnés, guardado.

   Cómo se usa:
     index.html?test=1            todas las suites
     index.html?test=motor        una suelta (motor, cartas, cobertura,
                                  tutoriales, regresiones)
     index.html?test=1&rapido=1   salta las suites lentas (los tutoriales)
   Y desde la consola: PRUEBAS.correr()  ·  PRUEBAS.resultado

   Para añadir un caso: PRUEBAS.suite('nombre', async t => { ... }). Dentro,
   t.check(condición, 'qué se esperaba'). Si algo lanza, la suite falla con la
   traza. Cada bug que cueste tiempo debería acabar aquí abajo, en regresiones.
   ========================================================================== */
(function(){
'use strict';

const PRUEBAS = window.PRUEBAS = { suites:[], resultado:null };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const $$ = s => [...document.querySelectorAll(s)];
const $1 = s => document.querySelector(s);

PRUEBAS.suite = (nombre, fn, opts={}) => PRUEBAS.suites.push({nombre, fn, ...opts});

/* Un fallo de prueba tiene su propio tipo para distinguirlo de un error del
   motor: el primero es "el juego hace algo que no debe", el segundo es "el
   juego se rompió". Los dos fallan, pero se leen distinto. */
class FalloDePrueba extends Error {}

function nuevoCtx(){
  const notas=[];
  return {
    notas,
    nota:(txt)=>notas.push(txt),
    check(cond, msg){ if(!cond) throw new FalloDePrueba(msg); },
    igual(a,b,msg){ if(a!==b) throw new FalloDePrueba(`${msg} (esperaba ${b}, llegó ${a})`); },
  };
}

/* ---------------------------------------------------------------------------
   Utilidades compartidas
   ------------------------------------------------------------------------ */
const T = TCG;                        // el motor, tal cual lo expone el juego
const LID = () => Object.keys(T.LEADERS);

/* Una partida automática completa, sin render ni animaciones. */
async function jugarPartida(a, b, tope=300){
  await T.setupMatch(a, b, {fast:true, auto:true, silent:true});
  let g=0;
  while(!T.G.over && g++<tope) await T.autoTurn(T.G.active);
  return T.G;
}

/* Un tablero de pruebas: ambos bandos con cuerpos en mesa y PD de sobra, para
   que una carta con condición (req) tenga con qué cumplirla. Con extras=true
   añade lo que exigen las cuatro cartas más quisquillosas: un Objeto de Equipo
   en cada bando (Arma Mágica, Calentar Metal, Copia de Jabón) y 2 Llaves (el
   Pergamino). Sin eso esas cuatro no se probarían nunca. */
async function escenarioRico(lid='fender', rival='adreida', extras=false){
  await T.setupMatch(lid, rival, {fast:true, auto:true, silent:true});
  for(const s of [0,1]){
    T.P(s).pd = 10;
    for(const id of ['discipulo','bartolomeo']){
      const u = T.mkUnit(id, s); u.sick=false; T.P(s).field.push(u);
    }
    if(extras){
      T.P(s).field[0].objs.push('mazo');
      T.P(s).llaves = 2;
    }
  }
  T.recalc();
  return T.G;
}

/* Juega el tutorial entero a base de clics reales, como una persona: nunca
   llama al motor por dentro. Devuelve el paso más alto alcanzado — que es el
   dato que importa, porque "terminó" y "llegó al final" no son lo mismo: el
   tutorial también se cierra si la partida acaba antes de tiempo. */
async function jugarTutorial(lid, limite=4000){
  const visible = () => $1('#tutNext').style.display !== 'none';
  const esc = () => document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
  // una pestaña en segundo plano congela setTimeout y el arnés parece colgado
  try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}

  await startTutorial(lid);
  await sleep(400);
  TUT.rescates = [];
  // "Atascado" no es "el paso no cambia": ahora un paso puede esperarte
  // legítimamente dos o tres turnos (te pide una carta que aún no puedes
  // pagar). Sólo cuenta como atasco si TAMPOCO avanza la partida.
  let ultimo=-1, ultimoTurno=-1, quieto=0, tope=0;

  for(let k=0;k<limite;k++){
    await sleep(45);
    if(!$1('#tut').classList.contains('on')) return {tope, fin:'cerrado', rescates:TUT.rescates||[]};
    const i = parseInt($1('#tutStep').textContent) - 1;
    if(i+1 > tope) tope = i+1;
    const permiso = (TUT_STEPS[i]||{}).allow || {};
    if(i!==ultimo || T.G.turnNo!==ultimoTurno){ ultimo=i; ultimoTurno=T.G.turnNo; quieto=0; }
    else if(++quieto > 600) return {tope, fin:'atascado en '+(i+1)+': '+
      $1('#tutBody').textContent.replace(/\s+/g,' ').slice(0,60)};

    // Los diálogos van ANTES de mirar G.busy: durante el turno del rival el
    // motor está ocupado y aun así puede pedirte una decisión. Comprobar busy
    // primero deja el arnés esperando a algo que nunca pasa.
    if($1('#dice').classList.contains('on')){
      const b=$1('#dbtn'); if(b && !b.disabled) b.click(); continue; }
    if($1('#ov').classList.contains('on')){
      const b=$1('#ovPanel .opts .btn')||$1('#ovPanel .gallery .card');
      if(b) b.click(); else esc(); continue; }
    // Si el paso pide una carta y la puedes pagar, eso es lo que haría una
    // persona: jugarla. Sin esta prioridad el arnés se quedaba dando vueltas en
    // una selección de ataque a medias (allow suele traer attack:true además de
    // la carta) y no llegaba nunca a bajarla.
    if(permiso.hand){
      const mano = T.P(0).hand;
      const pedida = $$('#hand .card').find((e,j)=>
        permiso.hand.includes(mano[j]) && !e.classList.contains('locked')
        && e.classList.contains('playable'));
      if(pedida){
        if(SEL || $1('#prompt').classList.contains('on')){ esc(); continue; }
        pedida.click(); continue;
      }
    }
    if($1('#prompt').classList.contains('on')){
      if(permiso.attack==='face'){ const l=$1('#lead1'); if(l){ l.click(); continue; } }
      if(permiso.attack){ const t=$1('#foeField .card.tgt')||$1('#lead1'); if(t){ t.click(); continue; } }
      const t2=$1('#foeField .card.tgt')||$1('#myField .card.tgt'); if(t2){ t2.click(); continue; }
      const c=$$('#pbtns .btn').find(b=>/Confirmar|Cancelar/.test(b.textContent));
      if(c){ c.click(); continue; }
      if(quieto>12){ esc(); continue; }
    }
    if(document.body.classList.contains('tutpause')){ $1('#tutNext').click(); continue; }
    if(visible()){ $1('#tutNext').click(); continue; }
    if(T.G.busy || T.G.resolving || !$1('#tutWait').textContent) continue;

    const carta=$1('#hand .card:not(.locked).playable'); if(carta){ carta.click(); continue; }
    const lider=$1('#lead0.usable'); if(lider){ lider.click(); continue; }
    if(permiso.attack){ const mia=$1('#myField .card.ready'); if(mia && !SEL){ mia.click(); continue; } }
    const fin=$$('#controls .btn.gold')[0]; if(fin && !fin.disabled){ fin.click(); continue; }
  }
  return {tope, fin:'sin terminar', rescates:TUT.rescates||[]};
}

/* El propio index.html como texto, para las reglas que se comprueban leyendo
   el código en vez de ejecutándolo. */
let _fuente=null;
async function fuente(){
  if(_fuente===null) _fuente = await (await fetch(location.pathname)).text();
  return _fuente;
}

/* ===========================================================================
   SUITE: motor — 300 partidas automáticas
   ======================================================================== */
PRUEBAS.suite('motor', async t => {
  const L = LID();
  let n=0, turnos=0, sinTerminar=0;
  for(const a of L) for(const b of L) for(let k=0;k<12;k++){
    const g = await jugarPartida(a,b);
    if(!g.over) sinTerminar++;
    turnos += g.turnNo; n++;
  }
  t.nota(`${n} partidas · turno medio ${(turnos/n).toFixed(1)}`);
  t.igual(sinTerminar, 0, 'partidas que no llegaron a terminar');
  t.igual(n, L.length*L.length*12, 'partidas jugadas');
});

/* ===========================================================================
   SUITE: cartas — las 84, una por una
   Cada carta se juega al menos una vez en un tablero con cuerpos en mesa y PD
   de sobra. No comprueba que haga lo correcto (eso es la partida), sino que
   no revienta: la mayoría de crashes históricos han sido una carta resolviendo
   sobre un objetivo que canPlay creía válido y la resolución real no.
   ======================================================================== */
PRUEBAS.suite('cartas', async t => {
  const ids = Object.keys(T.CARDS).filter(id => !T.CARDS[id].token);
  const rotas=[], nojugables=[];
  for(const id of ids){
    // dos intentos: tablero normal y tablero con Objetos y Llaves. Si con el
    // segundo tampoco se puede jugar, es que su condición pide algo más.
    for(const extras of [false, true]){
      try{
        await escenarioRico('fender','adreida',extras);
        T.P(0).hand = [id];
        T.P(0).pd = 10;
        if(!T.canPlay(0,id)){ if(extras) nojugables.push(id); continue; }
        await T.play(id);
        break;
      }catch(e){
        rotas.push(`${id}: ${e && e.message}`);
        break;
      }
    }
  }
  t.nota(`${ids.length} cartas · ${nojugables.length} no jugables en este tablero`);
  if(nojugables.length) t.nota('no jugables: '+nojugables.join(', '));
  t.check(rotas.length===0, 'cartas que lanzaron al resolverse → '+rotas.slice(0,5).join(' ;; '));
});

/* ===========================================================================
   SUITE: cobertura — qué se ejercita de verdad en 100 partidas
   Un test que pasa sin haber tocado media baraja no prueba gran cosa. Esto
   mide qué cartas se juegan y qué Trampas saltan, y avisa de los agujeros.
   ======================================================================== */
PRUEBAS.suite('cobertura', async t => {
  const jugadas = new Set(), trampas = new Set();
  const trampasTotales = Object.keys(T.CARDS).filter(id=>T.CARDS[id].t==='trampa');

  const L = LID();
  // se espía por encima del motor, sin tocarlo: envolver y restaurar. Tiene que
  // ser window.playFromHand — TCG.playFromHand es una copia que el motor no usa.
  const playOrig = window.playFromHand;
  try{
    window.playFromHand = async (s,id,ft)=>{ jugadas.add(id); return playOrig(s,id,ft); };
    for(const a of L) for(const b of L) for(let k=0;k<4;k++){
      await T.setupMatch(a,b,{fast:true,auto:true,silent:true});
      let g=0;
      while(!T.G.over && g++<300){
        await T.autoTurn(T.G.active);
        for(const s of [0,1]) T.P(s).traps.forEach(tr=>{ if(tr.revealed) trampas.add(tr.id); });
      }
    }
  } finally { window.playFromHand = playOrig; }

  const total = Object.keys(T.CARDS).filter(id=>!T.CARDS[id].token).length;
  t.nota(`cartas jugadas ${jugadas.size}/${total} · trampas saltadas ${trampas.size}/${trampasTotales.length}`);
  const sinTrampa = trampasTotales.filter(id=>!trampas.has(id));
  if(sinTrampa.length) t.nota('trampas que nunca saltaron: '+sinTrampa.join(', '));
  t.check(jugadas.size >= total*0.5,
    `sólo se jugaron ${jugadas.size} de ${total} cartas; la muestra no cubre la baraja`);
});

/* ===========================================================================
   SUITE: tutoriales — los 5 mazos, a clics, hasta el final
   La lenta (~2,5 min). Es la que more valor da: recorre motor, interfaz,
   permisos del tablero y guion del rival a la vez, con clics de verdad.
   ======================================================================== */
PRUEBAS.suite('tutoriales', async t => {
  const total = 34, fallos=[];
  for(const lid of Object.keys(TUT_MAZO)){
    const r = await jugarTutorial(lid);
    t.nota(`${lid}: ${r.fin} · paso máximo ${r.tope}/${total} · rescatados los pasos [${(r.rescates||[]).join(', ')||'ninguno'}]`);
    if(r.tope < total) fallos.push(`${lid} se quedó en ${r.tope}/${total} (${r.fin})`);
    // Un rescate es Gero saltándose una lección porque el paso pedía algo que
    // no podías hacer. Los cinco mazos llegan al final con cero, así que
    // cualquiera que aparezca es una regresión de verdad.
    if((r.rescates||[]).length) fallos.push(`${lid}: Gero se saltó los pasos ${r.rescates.join(', ')} en vez de esperarte`);
    await sleep(1200);   // deja morir el cartel de victoria de la partida anterior
  }
  t.check(fallos.length===0, fallos.join(' ;; '));
}, {lenta:true});

/* ===========================================================================
   SUITE: regresiones — un caso por cada fallo que ya costó tiempo
   Esto es lo que impide que una función destruya otra: cada vez que algo se
   rompa y se arregle, el caso se queda escrito aquí.
   ======================================================================== */
PRUEBAS.suite('regresiones', async t => {

  /* La IA no atacaba nunca: G.busy servía a la vez de "IA ocupada" y de
     reentrada de doAttack, así que se bloqueaba a sí misma. */
  {
    let ataques=0;
    // por window, no por TCG: el objeto TCG guarda una copia de la referencia y
    // el motor por dentro llama a la función global
    const orig=window.doAttack;
    window.doAttack = async (u,tg)=>{ ataques++; return orig(u,tg); };
    try{ for(let i=0;i<6;i++) await jugarPartida('adreida','fender'); }
    finally{ window.doAttack=orig; }
    t.check(ataques>0, 'en 6 partidas no hubo un solo ataque: la IA vuelve a bloquearse');
  }

  /* Prisa ganada DESPUÉS de entrar no levantaba la enfermedad de invocación
     (Bob Carly bajando más tarde y dando Prisa a lo que ya estaba). */
  {
    await escenarioRico();
    const u = T.mkUnit('discipulo', 0); u.sick=true; T.P(0).field.push(u); T.recalc();
    t.check(!T.canAttack(u), 'una criatura recién bajada no debería poder atacar');
    u.keysOwn.add('prisa'); T.recalc();
    t.check(T.canAttack(u), 'con Prisa debería poder atacar aunque entrara este turno');
  }

  /* Durante un beat el tablero quedaba bloqueado también en TU turno: el
     cartel te pedía terminar el turno con el botón deshabilitado. Punto muerto. */
  {
    await startTutorial('fender');
    await sleep(300);
    // se coloca a mano en un paso reactivo, con el turno del jugador activo
    const k = TUT_STEPS.findIndex(s=>s.on);
    t.check(k>=0, 'el tutorial debería tener pasos reactivos');
    TUT.i = k; TUT.pending = null; T.G.active = 0; T.G.over = false;
    const permiso = tutAllow();
    t.check(permiso && permiso.free,
      'en tu propio turno, un paso reactivo debe dejarte jugar (si no, no puedes terminar el turno)');
    tutEnd();
  }

  /* La partida podía acabar antes de la lección de estrategia — con Fender,
     casi siempre — y el tutorial se cerraba sin haberla enseñado nunca. */
  {
    await startTutorial('fender');
    await sleep(300);
    const k = TUT_STEPS.findIndex(s=>s.strat);
    t.check(k>=0, 'el tutorial debería marcar sus pasos de estrategia con strat:true');
    TUT.i = 5;                              // muy por delante de la estrategia
    T.P(1).alma = 0;
    endGame(0, 'prueba');
    await sleep(100);
    t.check(TUT.on, 'el tutorial no debe cerrarse al ganar antes de la estrategia');
    t.check(TUT.i >= k, `debería haber saltado al paso de estrategia (${k}), y está en ${TUT.i}`);
    tutEnd();
    await sleep(600);
  }

  /* El cartel de fin de una partida se colaba en la siguiente. */
  {
    await startTutorial('mohamed'); await sleep(200);
    const antes = $1('#ov').classList.contains('on');
    t.check(!antes, 'al entrar al tutorial no puede quedar abierto el cartel de la partida anterior');
    tutEnd(); await sleep(600);
  }

  /* Reiniciar un tutorial dejaba vivo el sondeo del anterior. */
  {
    await startTutorial('fender'); await sleep(200);
    const p1 = TUT.poll;
    await startTutorial('adreida'); await sleep(200);
    t.check(TUT.poll !== p1, 'al reiniciar debe crearse un sondeo nuevo');
    tutEnd(); await sleep(600);
  }

  /* Los pasos del tutorial deben mirar si la carta salió de TU MANO, no cuántas
     criaturas hay en el campo: con lo segundo se colgaban en cuanto el rival
     mataba la recién bajada (con Talesin, casi siempre). */
  {
    const src = await fuente();
    const malos = (src.match(/wait:\s*g\s*=>\s*P\(ME\)\.field\.length\s*>=/g)||[]).length;
    t.igual(malos, 0, 'hay pasos de tutorial esperando criaturas en el campo');
  }

  /* Animation.finished puede no resolverse NUNCA aunque playState sea
     "finished". Colgaba el motor a mitad de un daño. Regla: sleep(), nunca
     .finished. Se comprueba leyendo el código, que es donde vive la regla. */
  {
    const src = await fuente();
    // se busca el USO (await ….finished / .finished.then), no la mención: el
    // comentario que documenta esta misma regla contiene la palabra
    const usos = (src.match(/\.finished\s*\.then|await\s[^;\n]{0,60}\.finished\b/g)||[]).length;
    t.igual(usos, 0, 'alguien volvió a encadenar animaciones con Animation.finished');
  }

  /* Cartas repetidas en la mano: si el mazo del tutorial reparte dos copias de
     la carta que el paso pide (a Rafaela le llega la segunda en el robo del
     primer turno), jugar UNA no debe dejar el paso esperando a la otra.
     Se hace clic en la ÚLTIMA copia a propósito: el arnés de los tutoriales
     siempre pulsa la primera, y por eso este atasco pasó desapercibido. */
  {
    for(const lid of Object.keys(TUT_MAZO)){
      await startTutorial(lid);
      await sleep(400);
      // avanzar los carteles hasta el primer paso que pida una carta concreta
      let guardia=0;
      while(guardia++ < 12){
        const paso = TUT_STEPS[TUT.i];
        if(paso && paso.allow && paso.allow.hand) break;
        $1('#tutNext').click();
        await sleep(250);
      }
      const paso = TUT_STEPS[TUT.i], antes = TUT.i;
      t.check(paso && paso.allow && paso.allow.hand, `${lid}: no encontré el paso que pide una carta`);
      const id = paso.allow.hand[0];
      const copias = T.P(0).hand.filter(c=>c===id).length;
      const idx = T.P(0).hand.lastIndexOf(id);
      t.check(idx >= 0, `${lid}: la carta ${id} que pide el paso no está en la mano`);
      $$('#hand .card')[idx].click();
      await sleep(2500);
      t.check(TUT.i > antes,
        `${lid}: jugué ${id} (${copias} copias en mano) y el paso ${antes+1} no avanzó`);
      tutEnd();
      await sleep(400);
    }
  }

  /* NOTA: aquí hubo una prueba que intentaba comprobar a mano que el paso de
     Titaus espera al turno siguiente. Se quitó porque no detectaba el fallo:
     con el bug puesto a propósito seguía en verde, porque el rescate depende
     de cuánto dure el turno del rival y a veces no llega a saltar.
     Lo que sí lo detecta es el contador de rescates de la suite `tutoriales`:
     con el fallo daba [11, 19] / [11, 27] / [11] en los cinco mazos, y sin él
     da cero. Una prueba que no se pone roja cuando rompes el código a mano no
     vale nada; ese contador sí. */

  /* El paso de atacar, cuando el rival te ha matado la primera criatura y lo
     único que te queda acaba de entrar (le pasó a Rafaela con Titaus): tiene
     que avisarte y esperarte, no pedirte algo imposible. Se monta el estado a
     mano en vez de jugar una partida entera — es la misma comprobación y tarda
     milisegundos. */
  {
    await T.setupMatch('rafaela','adreida',{fast:true,auto:true,silent:true});
    const pasos = buildTut('rafaela');
    const idx = pasos.findIndex(x=>x.allow && x.allow.attack==='face');
    t.check(idx>=0, 'no encontré el paso que pide atacar al Alma');
    const paso = pasos[idx];
    const texto = ()=> String(typeof paso.t==='function' ? paso.t(T.G) : paso.t);

    const u = T.mkUnit('titaus',0); u.sick = true; T.P(0).field.push(u); T.recalc();
    t.check(!T.canAttack(u), 'lo recién bajado no debería poder atacar');
    t.check(/no tienes a nadie/i.test(texto()),
      'el paso debe avisarte de que no hay nadie listo y decirte que termines el turno');
    T.G.active = 0;
    t.check(!paso.wait(T.G),
      'el paso no puede darse por cumplido sin atacar: eso se salta la lección');
    // Y sobre todo: al TERMINAR EL TURNO tampoco. Ahí estaba el fallo — el paso
    // se daba por bueno en cuanto pasabas turno, así que nunca llegabas a pegar.
    T.G.active = 1;
    t.check(!paso.wait(T.G),
      'terminar el turno no puede dar el paso por cumplido: te saltas el ataque');
    T.G.active = 0;

    u.sick = false; T.recalc();
    t.check(!/no tienes a nadie/i.test(texto()),
      'con alguien listo no debe salir el aviso');
    T.P(1).alma = 19;
    t.check(paso.wait(T.G), 'atacando de verdad sí debe cumplirse');
    t.nota(`paso ${idx+1}: avisa cuando no hay nadie listo y espera a que ataques`);
  }

  /* Los mazos son válidos y nadie cita cartas que ya no están.
     Cambiar una lista (como en la v2) rompe en silencio tres sitios que las
     nombran a mano: el guion del rival en el tutorial, los robos guionizados y
     las cartas clave de las guías. Esto lo caza antes de publicar. */
  {
    const L = Object.keys(T.LEADERS);
    const fallos = [];
    for (const l of L){
      const lista = T.DECKS[l].list;
      const n = lista.reduce((a,x)=>a+x[1], 0);
      const mx = Math.max(...lista.map(x=>x[1]));
      if (n !== 40) fallos.push(`${l}: ${n} cartas, deben ser 40`);
      if (mx > 3)   fallos.push(`${l}: ${mx} copias de una carta, el máximo es 3`);
      for (const par of lista) if (!T.CARDS[par[0]]) fallos.push(`${l}: carta inexistente ${par[0]}`);
    }
    for (const lid of Object.keys(TUT_MAZO)){
      const M = TUT_MAZO[lid], mio = new Set(T.DECKS[lid].list.map(x=>x[0]));
      for (const id of [...M.mano, ...M.top, M.c1, M.c2, M.quita, M.trampa])
        if (!mio.has(id)) fallos.push(`el tutorial de ${lid} reparte ${id} y no está en su mazo`);
    }
    const suyo = new Set(T.DECKS.adreida.list.map(x=>x[0]));   // el rival guionizado es Adreida
    for (const paso of TUT_FOE_SCRIPT) for (const id of (paso.play||[]))
      if (!suyo.has(id)) fallos.push(`el guion del rival juega ${id} y Adreida ya no lo lleva`);
    for (const id of ['bartolomeo','mazo','augusto','horton','eric'])
      if (!suyo.has(id)) fallos.push(`la mano guionizada del rival pide ${id}, que salió del mazo`);
    for (const l of L){
      const mio = new Set(T.DECKS[l].list.map(x=>x[0]));
      for (const id of (GUIAS[l].motor||[]))
        if (!mio.has(id)) fallos.push(`la guía de ${l} destaca ${id} y ya no está en su mazo`);
    }
    t.check(fallos.length===0, fallos.join(' ;; '));
    t.nota('los 5 mazos con 40 cartas; el tutorial y las guías sólo citan cartas que siguen dentro');
  }

  /* Desde una partida se puede volver al menú. Faltaba: el tablero era un
     callejón sin salida y había que recargar la página. Se comprueba también
     dentro del tutorial, donde el resto de botones está bloqueado a propósito
     — irse siempre tiene que poder hacerse. */
  {
    const boton = () => $$('#controls .btn').find(b => /Menú/.test(b.textContent));
    await T.startMatch('fender','adreida',{volado:false});
    await sleep(700);
    t.check(!!boton(), 'no hay botón para volver al menú durante una partida');
    boton().click(); await sleep(250);
    t.check($1('#ov').classList.contains('on'),
      'salir debería pedir confirmación, no abandonar de golpe');
    const seguir = $$('#ovPanel .opts .btn').find(b=>/Seguir/.test(b.textContent));
    t.check(!!seguir, 'falta la opción de seguir jugando');
    seguir.click(); await sleep(250);
    t.check($1('#board').classList.contains('on'), 'cancelar debería devolverte a la partida');

    boton().click(); await sleep(250);
    $$('#ovPanel .opts .btn').find(b=>/salir/.test(b.textContent)).click();
    await sleep(400);
    t.check($1('#menu').classList.contains('on'), 'confirmar debería llevarte al menú');

    // y desde el tutorial, con el tablero bloqueado
    await startTutorial('rafaela'); await sleep(700);
    const b2 = boton();
    t.check(b2 && !b2.disabled, 'en el tutorial también debe poderse salir al menú');
    b2.click(); await sleep(250);
    $$('#ovPanel .opts .btn').find(b=>/salir/.test(b.textContent)).click();
    await sleep(500);
    t.check($1('#menu').classList.contains('on'), 'no salí al menú desde el tutorial');
    t.check(!TUT.on && !document.body.classList.contains('tut-on'),
      'salir del tutorial debe dejarlo cerrado del todo');
    t.nota('se puede volver al menú desde una partida y desde el tutorial');
  }

  /* Las cartas se juegan pulsándolas. Se probó a arrastrarlas y se volvió atrás:
     el #hand tiene scroll horizontal y en táctil el navegador se quedaba el
     gesto, así que el arrastre se trababa. */
  {
    await T.startMatch('fender','adreida',{volado:false});
    await sleep(700);
    T.P(0).pd = 9; T.recalc(); T.render(); await sleep(150);

    const antes = T.P(0).hand.length;
    const carta = $1('#hand .card.playable');
    t.check(!!carta, 'no hay ninguna carta jugable con 9 PD');
    carta.click();
    // se espera al hecho, no a un reloj: con las animaciones activas tarda más
    for (let i=0; i<40 && T.P(0).hand.length >= antes; i++) await sleep(100);
    t.check(T.P(0).hand.length < antes, 'pulsar una carta jugable debería jugarla');
    t.nota('las cartas se juegan pulsándolas');
  }

  /* Cada clase de carta con su color, en el borde y en el círculo del coste. */
  {
    const tipos = ['personaje','hechizo','trampa','objeto','lugar'];
    const vistos = {};
    for (const tipo of tipos){
      const id = Object.keys(T.CARDS).find(x => T.CARDS[x].t===tipo && !T.CARDS[x].token);
      const d = cardEl(id);   // tests.js corre dentro del juego: es su propia función
      d.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(d);
      const cs = getComputedStyle(d);
      const borde = cs.borderTopColor;
      const coste = getComputedStyle(d.querySelector('.cost')).backgroundImage;
      vistos[tipo] = borde;
      t.check(!!borde && borde!=='rgba(0, 0, 0, 0)', `${tipo}: sin color de borde`);
      t.check(/gradient/.test(coste), `${tipo}: el círculo del coste no lleva su color`);
      d.remove();
    }
    const distintos = new Set(Object.values(vistos));
    t.check(distintos.size === tipos.length,
      'dos clases de carta comparten color de borde: ' + JSON.stringify(vistos));
    t.nota('los 5 tipos tienen bordes de colores distintos y su coste a juego');
  }

  /* Infectado: la carta en verde y su daño en verde, no en rojo. */
  {
    await T.startMatch('fender','adreida',{volado:false}); await sleep(600);
    const u = T.mkUnit('discipulo', 0); u.sick=false; T.P(0).field.push(u);
    T.recalc(); T.render(); await sleep(200);
    const antes = $1(`#myField .card[data-uid="${u.uid}"]`);
    t.check(antes && !antes.classList.contains('infectado'),
      'una criatura sana no debería salir verde');
    T.infect(u); T.render(); await sleep(200);
    const despues = $1(`#myField .card[data-uid="${u.uid}"]`);
    t.check(despues && despues.classList.contains('infectado'),
      'una criatura Infectada debería ponerse verde');
    // y su daño lleva la clase del verde de infección, no la del rojo
    const src = await fuente();
    t.check(/fxHit\(u, ?n, ?opt\.src==='infeccion'\)/.test(src),
      'el daño por infección debería pintarse distinto del daño normal');
    t.check(/\.fxnum\.inf\{/.test(src), 'falta el estilo verde del número de infección');
    t.nota('las Infectadas se ponen verdes y su daño sale en verde');
  }

  /* El halo verde de "puedes jugarla" es SÓLO del tutorial. Jugando, las cartas
     que puedes usar se ven normales y las que no, apagadas. */
  {
    document.body.classList.remove('tut-on');
    const d = cardEl('eric'); d.classList.add('playable');
    d.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(d);
    await sleep(60);
    const jugando = getComputedStyle(d).boxShadow;
    t.check(!/79, 192, 125/.test(jugando),
      'jugando no debe haber halo verde en las cartas de la mano');

    document.body.classList.add('tut-on');
    await sleep(60);
    t.check(/79, 192, 125/.test(getComputedStyle(d).boxShadow),
      'en el tutorial sí debe verse el halo verde, que es donde se explica');
    document.body.classList.remove('tut-on');

    // y las que no puedes usar se distinguen por estar apagadas.
    // La espera es larga a propósito: las cartas llevan transition:.13s y medir
    // antes pilla la opacidad a mitad de camino (0,61 en vez de 0,4).
    d.className = 'card t-personaje unplayable';
    await sleep(300);
    const apagada = getComputedStyle(d);
    t.check(parseFloat(apagada.opacity) <= 0.5,
      'una carta que no puedes jugar debería verse claramente apagada (opacidad '
      + apagada.opacity + ', clases "' + d.className + '")');
    d.remove();
    t.nota('el halo verde vive sólo en el tutorial; jugando manda el contraste');
  }

  /* El círculo del coste conserva el color de su tipo aunque la carta esté
     rebajada por una pasiva. Antes se pintaba de verde con un estilo en línea y
     se cargaba el color: con Mohamed, Golpe a Sangre Fría (Hechizo) salía verde
     en vez de violeta. Se construyen las cartas directamente en vez de fiarse de
     lo que toque en la mano. */
  {
    await T.setupMatch('mohamed','adreida',{fast:true,auto:true,silent:true});
    T.P(0).pd = 5; T.recalc();
    t.check(T.costOf('sangrefria',0) < T.CARDS.sangrefria.c,
      'con Mohamed, Sangre Fría debería costar 1 PD menos (es Hechizo de Engaño)');
    t.check(T.costOf('mensaje',0) === T.CARDS.mensaje.c,
      'Mensaje no es de Engaño: no debería llevar descuento');

    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;left:-9999px';
    const rebajada = cardEl('sangrefria', {side:0});
    const normal   = cardEl('mensaje',    {side:0});
    caja.appendChild(rebajada); caja.appendChild(normal);
    document.body.appendChild(caja);
    await sleep(250);

    t.check(rebajada.querySelector('.cost').classList.contains('rebajado'),
      'la carta rebajada debería marcarse como tal');
    t.check(!normal.querySelector('.cost').classList.contains('rebajado'),
      'la que no tiene descuento no debería marcarse');
    const cr = getComputedStyle(rebajada.querySelector('.cost')).backgroundImage;
    const cn = getComputedStyle(normal.querySelector('.cost')).backgroundImage;
    t.check(cr === cn,
      `dos Hechizos deben compartir color de coste, esté uno rebajado o no `
      + `— rebajada=${cr.slice(0,44)} / normal=${cn.slice(0,44)}`);
    caja.remove();
    t.nota('el descuento se ve sin robarle el color al tipo de carta');
  }

  /* Cuando algo se activa se ve la CARTA, no un cartel de texto: Hechizos,
     Trampas y Habilidades de Líder. Antes las Trampas sólo enseñaban su nombre
     y las Habilidades no enseñaban nada. */
  {
    try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}
    await T.startMatch('mohamed','adreida',{volado:false}); await sleep(600);

    const enEscena = () => $$('#fx .fxcard').length;
    const carteles = () => $$('.fxlabel').map(e=>e.textContent).join(' | ');

    fxTrap('tasha', 1);                       // una Trampa del rival
    await sleep(320);
    t.check(enEscena() >= 1, 'al saltar una Trampa debería verse su carta');
    t.check(/TRAMPA/.test(carteles()), 'la Trampa debería anunciarse');
    await sleep(1400);

    fxHabilidad(0);                           // la Habilidad de tu Líder
    await sleep(320);
    t.check(enEscena() >= 1, 'usar la Habilidad del Líder debería mostrar su carta');
    t.check(/Manos Largas/.test(carteles()), 'debería decir qué Habilidad es');
    await sleep(1400);

    fxSpell('sangrefria', 1);                 // un Hechizo del rival
    await sleep(320);
    t.check(enEscena() >= 1, 'un Hechizo debería mostrar su carta');
    await sleep(1400);
    t.nota('Hechizos, Trampas y Habilidades suben su carta a escena');
  }

  /* Los ataques del rival se anuncian antes de llegar: quién va a por quién. */
  {
    await T.startMatch('fender','adreida',{volado:false}); await sleep(500);
    const suyo = T.mkUnit('horton', 1); suyo.sick = false; T.P(1).field.push(suyo);
    const mio  = T.mkUnit('discipulo', 0); mio.sick = false; T.P(0).field.push(mio);
    T.recalc(); T.render(); await sleep(200);

    const p = fxLunge(suyo, mio);
    await sleep(300);
    const dicho = $$('.fxlabel').map(e=>e.textContent).join(' | ');
    t.check(/Sir Horton/.test(dicho) && /Discípulo/.test(dicho),
      `un ataque del rival debe decir quién ataca a quién — decía: "${dicho}"`);
    await p;
    t.nota('los ataques del rival se anuncian antes de llegar');
  }

  /* El volado: eliges lado, la moneda decide, y quien gana empieza de verdad.
     Se comprueba que lo que dice el cartel y lo que hace el juego coinciden —
     que es lo único que no puede fallar aquí. */
  {
    try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}
    let empezasteTu = 0;
    for (let i = 0; i < 6; i++){
      startMatch('fender','adreida');            // sin await: espera a que elijas
      for (let k=0; k<40 && !$1('#ladoCara'); k++) await sleep(50);
      t.check(!!$1('#ladoCara'), 'debería preguntarte cara o cruz al empezar');
      (i % 2 ? $1('#ladoCruz') : $1('#ladoCara')).click();
      for (let k=0; k<60 && $1('#ov').classList.contains('on'); k++) await sleep(100);
      const dijo = $1('#voladoTxt') ? $1('#voladoTxt').textContent : '';
      const empiezoYo = T.G.active === 0;
      if (empiezoYo) empezasteTu++;
      t.check(/empiezas tú/.test(dijo) === empiezoYo,
        `el volado dijo "${dijo}" pero empieza ${empiezoYo?'el jugador':'el rival'}`);
      await sleep(150);
    }
    t.nota(`volado: ganaste ${empezasteTu} de 6 (es una moneda, no tiene que salir 3)`);

    // y se puede saltar, que es lo que usan estas pruebas
    await T.startMatch('fender','adreida',{volado:false});
    await sleep(400);
    t.check(!$1('#ov').classList.contains('on'),
      'con {volado:false} no debería preguntar nada');
  }

  /* Las cartas del tablero enseñan el nombre de sus habilidades. */
  {
    await T.startMatch('fender','adreida',{volado:false}); await sleep(500);
    const u = T.mkUnit('brickbrock', 0); u.sick = false; T.P(0).field.push(u);
    T.recalc(); T.render(); await sleep(250);
    const carta = $1(`#myField .card[data-uid="${u.uid}"]`);
    t.check(!!carta, 'no encontré la carta en el tablero');
    const chapas = [...carta.querySelectorAll('.kw.hab')].map(e=>e.textContent);
    t.check(chapas.includes('Peaje') && chapas.includes('Acertijo'),
      `Brick y Brock debería enseñar sus dos habilidades — enseña: ${JSON.stringify(chapas)}`);
    // y los nombres salen del texto de la carta, no de una lista aparte
    t.check(/Peaje/.test(T.CARDS.brickbrock.x),
      'los nombres deberían salir del propio texto de la carta');
    t.nota('las cartas del tablero enseñan el nombre de sus habilidades');
  }

  /* Manos Largas enseña la carta que saca del mazo rival y espera a que le des
     a Continuar. Antes salía y desaparecía sin verse. Se comprueban los dos
     desenlaces y —lo importante— que NADA se mueve hasta que pulsas. */
  {
    try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}
    const seguir = () => $$('#ovPanel .btn').find(b=>/Continuar/.test(b.textContent));

    await T.startMatch('mohamed','adreida',{volado:false}); await sleep(700);

    // caso 1: sale un Objeto → se lo queda
    T.P(0).pd = 8; T.P(0).leaderUsed = false;
    T.P(1).deck.unshift('mazo'); T.recalc(); T.render(); await sleep(150);
    const manoAntes = T.P(0).hand.length;
    T.useLeader(0);
    for (let i=0; i<40 && !seguir(); i++) await sleep(100);
    t.check(!!seguir(), 'debería enseñar la carta con un botón de Continuar');
    t.check(!!$1('#revelaHueco .nm'), 'debería verse la carta revelada');
    t.check(/A TU MANO/.test($1('.revela .adonde').textContent),
      'debería decir que un Objeto va a tu mano');
    t.check(T.P(0).hand.length === manoAntes,
      'la carta no debe moverse hasta que pulses Continuar');
    seguir().click();
    for (let i=0; i<30 && T.P(0).hand.length === manoAntes; i++) await sleep(100);
    t.check(T.P(0).hand.includes('mazo'), 'tras Continuar, el Objeto debería estar en tu mano');
    // esperar a que el diálogo se cierre del todo: si no, el caso siguiente lee
    // el cartel del anterior
    for (let i=0; i<30 && $1('#ov').classList.contains('on'); i++) await sleep(100);

    // caso 2: no es Objeto → a las Alcantarillas del rival
    T.P(0).pd = 8; T.P(0).leaderUsed = false;
    T.P(1).deck.unshift('horton'); T.recalc(); T.render(); await sleep(150);
    const graveAntes = T.P(1).grave.length;
    T.useLeader(0);
    // se espera al CARTEL correcto, no sólo a que haya un botón
    for (let i=0; i<40; i++){
      const et = $1('.revela .adonde');
      if (et && /ALCANTARILLAS/.test(et.textContent)) break;
      await sleep(100);
    }
    const cartel = $1('.revela .adonde');
    t.check(cartel && /ALCANTARILLAS/.test(cartel.textContent),
      `lo que no es Objeto debería ir a las Alcantarillas — decía: "${cartel?cartel.textContent.trim():'nada'}"`);
    t.check(T.P(1).grave.length === graveAntes, 'tampoco aquí debe moverse antes de pulsar');
    seguir().click();
    for (let i=0; i<30 && T.P(1).grave.length === graveAntes; i++) await sleep(100);
    t.check(T.P(1).grave.includes('horton') && !T.P(0).hand.includes('horton'),
      'tras Continuar debería estar en sus Alcantarillas, no en tu mano');
    await sleep(400);
    t.nota('Manos Largas enseña la carta y espera antes de moverla');
  }

  /* TODA carta que se juega se anuncia con texto, sea del tipo que sea y la
     juegue quien la juegue. Antes sólo los Hechizos enseñaban algo, y encima su
     etiqueta salía únicamente si la jugaba el rival: por eso unas veces se veía
     texto y otras no. */
  {
    try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}
    await T.startMatch('mohamed','adreida',{volado:false}); await sleep(700);
    const mudas = [];
    const ejemplos = {personaje:'brickbrock', hechizo:'ilusion', trampa:'peaje', lugar:'puente'};
    for (const [tipo, id] of Object.entries(ejemplos)){
      T.P(0).pd = 9; T.P(0).hand = [id]; T.recalc(); T.render(); await sleep(180);
      const antes = new Set($$('.fxlabel').map(e=>e.textContent));
      T.play(id);
      let dicho = '';
      for (let i=0; i<28 && !dicho; i++){
        await sleep(90);
        for (const e of $$('.fxlabel'))
          if (e.textContent && !antes.has(e.textContent)) { dicho = e.textContent; break; }
      }
      if (!dicho) mudas.push(tipo);
      await sleep(1200);
    }
    // el Objeto necesita a quién equiparse, así que va aparte
    const u = T.mkUnit('bartolomeo', 0); u.sick = false; T.P(0).field.push(u);
    T.P(0).pd = 9; T.P(0).hand = ['sombrero']; T.recalc(); T.render(); await sleep(200);
    const antes = new Set($$('.fxlabel').map(e=>e.textContent));
    playFromHand(0, 'sombrero', [[u]]);
    let dichoObj = '';
    for (let i=0; i<28 && !dichoObj; i++){
      await sleep(90);
      for (const e of $$('.fxlabel'))
        if (e.textContent && !antes.has(e.textContent)) { dichoObj = e.textContent; break; }
    }
    if (!dichoObj) mudas.push('objeto');

    t.check(mudas.length === 0, 'estos tipos se juegan sin decir nada: ' + mudas.join(', '));
    t.nota('las cinco clases de carta se anuncian al jugarse');
  }

  /* La moneda del volado enseña siempre los mismos dos iconos. */
  {
    startMatch('mohamed','adreida');
    for (let i=0; i<40 && !$1('#moneda'); i++) await sleep(50);
    const reposo = $1('#moneda').textContent;
    const botones = $$('.volado .lados .btn').map(b=>b.textContent).join(' ');
    t.check(['👑','⚔️'].includes(reposo),
      `la moneda debería enseñar una de sus dos caras, no otro icono — enseña "${reposo}"`);
    t.check(/👑/.test(botones) && /⚔️/.test(botones),
      'los botones deberían llevar el icono de su cara');
    $1('#ladoCara').click();
    for (let i=0; i<60 && $1('#ov').classList.contains('on'); i++) await sleep(100);
    const final = $1('#moneda') ? $1('#moneda').textContent : reposo;
    t.check(['👑','⚔️'].includes(final),
      `al terminar debería quedarse en una de las dos caras — quedó "${final}"`);
    t.nota('la moneda usa los mismos dos iconos de principio a fin');
  }

  /* El log filtra lo privado: el rival no puede ver qué robas. */
  {
    const src = await fuente();
    t.check(/function log\([^)]*priv/.test(src),
      'log() perdió el parámetro priv y el online volvería a filtrar tus robos');
  }
});

/* ===========================================================================
   Runner y pantalla de resultados
   ======================================================================== */
function pantalla(){
  let box = $1('#pruebas');
  if(box) return box;
  box = document.createElement('div');
  box.id = 'pruebas';
  box.innerHTML = `<style>
    #pruebas{position:fixed;inset:0;z-index:99999;background:#14101f;color:#e8e3f5;
      font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:24px;overflow:auto}
    #pruebas h1{font-size:20px;margin:0 0 4px;color:#f0c674}
    #pruebas .sub{opacity:.65;margin-bottom:18px}
    #pruebas .s{border-left:3px solid #4a4260;padding:8px 14px;margin:10px 0;background:#1c1730}
    #pruebas .s.ok{border-color:#54d18a} #pruebas .s.mal{border-color:#e0575b}
    #pruebas .s.va{border-color:#f0c674}
    #pruebas .n{font-weight:700;font-size:15px}
    #pruebas .t{opacity:.6;float:right;font-size:12px}
    #pruebas .nota{opacity:.75;font-size:13px;margin-top:4px}
    #pruebas .err{color:#ff9a9d;white-space:pre-wrap;margin-top:6px;font-size:13px}
    #pruebas .total{margin-top:20px;padding:14px;border-radius:8px;font-size:16px;font-weight:700}
    #pruebas .total.ok{background:#17402c;color:#8ef0b6} #pruebas .total.mal{background:#4a1c1f;color:#ffb3b5}
  </style>
  <h1>🧪 Pruebas del TCG del Domo</h1>
  <div class="sub">index.html?test=1 · una suelta con ?test=motor · sin las lentas con &rapido=1</div>
  <div id="pruebasLista"></div><div id="pruebasTotal"></div>`;
  document.body.appendChild(box);
  return box;
}

PRUEBAS.correr = async function(filtro){
  const q = new URLSearchParams(location.search);
  filtro = filtro || (q.get('test')!=='1' ? q.get('test') : null);
  const rapido = q.get('rapido')==='1';
  let lista = PRUEBAS.suites;
  if(filtro) lista = lista.filter(s=>s.nombre===filtro);
  else if(rapido) lista = lista.filter(s=>!s.lenta);

  pantalla();
  const cont = $1('#pruebasLista');
  cont.innerHTML='';
  const res = { suites:[], ok:0, mal:0, t0:Date.now() };

  for(const s of lista){
    const fila = document.createElement('div');
    fila.className='s va';
    fila.innerHTML=`<div class="n">${s.nombre} <span class="t">corriendo…</span></div>`;
    cont.appendChild(fila);

    const ctx = nuevoCtx();
    const t0 = Date.now();
    let error=null;
    try{ await s.fn(ctx); }catch(e){ error = e; }
    const seg = ((Date.now()-t0)/1000).toFixed(1);

    const bien = !error;
    if(bien) res.ok++; else res.mal++;
    res.suites.push({nombre:s.nombre, bien, seg, notas:ctx.notas,
      error: error ? (error.message||String(error)) : null});

    fila.className = 's '+(bien?'ok':'mal');
    fila.innerHTML = `<div class="n">${bien?'✅':'❌'} ${s.nombre} <span class="t">${seg}s</span></div>`
      + ctx.notas.map(n=>`<div class="nota">· ${n}</div>`).join('')
      + (error ? `<div class="err">${(error instanceof FalloDePrueba ? '' : (error.name+': '))}${
          (error.message||String(error))}${error.stack&&!(error instanceof FalloDePrueba)
          ? '\n'+error.stack.split('\n').slice(1,4).join('\n') : ''}</div>` : '');
  }

  res.seg = ((Date.now()-res.t0)/1000).toFixed(1);
  const bien = res.mal===0;
  $1('#pruebasTotal').className = 'total '+(bien?'ok':'mal');
  $1('#pruebasTotal').textContent = bien
    ? `TODO EN VERDE — ${res.ok} suites en ${res.seg}s`
    : `${res.mal} SUITE(S) EN ROJO — ${res.ok} bien, ${res.mal} mal, ${res.seg}s`;

  // el título y este nodo son lo que lee publicar.sh para saber si puede publicar
  document.title = (bien?'PRUEBAS OK':'PRUEBAS FALLAN')+` · ${res.ok}/${res.ok+res.mal}`;
  let marca = $1('#pruebasMarca');
  if(!marca){ marca=document.createElement('pre'); marca.id='pruebasMarca';
    marca.style.display='none'; document.body.appendChild(marca); }
  marca.textContent = JSON.stringify(res, null, 1);

  PRUEBAS.resultado = res;
  PRUEBAS.terminado = true;

  // Si esto corre desde publicar.sh, el servidor de pruebas está escuchando en
  // /resultado y es así como el script sabe que hemos terminado. Abriendo la
  // página a mano no hay nadie al otro lado: el fallo se ignora a propósito.
  try{ fetch('/resultado', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(res)}).catch(()=>{}); }catch(e){}

  return res;
};

/* Arranque automático cuando se entra por ?test=... */
if(new URLSearchParams(location.search).has('test')){
  window.addEventListener('load', ()=>setTimeout(()=>PRUEBAS.correr(), 300));
}
})();

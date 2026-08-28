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
  let ultimo=-1, quieto=0, tope=0;

  for(let k=0;k<limite;k++){
    await sleep(45);
    if(!$1('#tut').classList.contains('on')) return {tope, fin:'cerrado', rescates:TUT.rescates||[]};
    const i = parseInt($1('#tutStep').textContent) - 1;
    if(i+1 > tope) tope = i+1;
    const permiso = (TUT_STEPS[i]||{}).allow || {};
    if(i!==ultimo){ ultimo=i; quieto=0; }
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
    // Los rescates se informan pero NO tumban la suite todavía: hay pasos que
    // legítimamente se resuelven terminando el turno. Es el dato que faltaba
    // cuando se coló el atasco del Discípulo repetido de Rafaela, así que
    // conviene mirarlo: un número que sube es señal de que algo se plantó.
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

  /* Un paso que pide una carta más cara que tus PD tiene que ESPERARTE hasta
     el turno siguiente, no saltarse la lección. Es lo que promete su propio
     texto ("si aún no te alcanza, termina el turno y lo bajas al siguiente") y
     lo que fallaba con Rafaela: Titaus cuesta 3 y en ese turno tienes 2. */
  {
    await startTutorial('rafaela');
    await sleep(400);
    TUT.rescates = [];
    // ir hasta el paso que pide la SEGUNDA criatura (el caro)
    let guardia=0;
    while(guardia++ < 40){
      const paso = TUT_STEPS[TUT.i];
      if(paso && paso.allow && paso.allow.hand && paso.allow.hand[0]===TUT_MAZO.rafaela.c2) break;
      if($1('#tutNext').style.display !== 'none'){ $1('#tutNext').click(); }
      else if(document.body.classList.contains('tutpause')){ $1('#tutNext').click(); }
      else {
        // cumplir lo que pida para seguir avanzando
        const carta = $1('#hand .card:not(.locked).playable');
        if(carta) carta.click();
        else { const fin = $$('#controls .btn.gold')[0]; if(fin && !fin.disabled) fin.click(); }
      }
      await sleep(300);
    }
    const paso = TUT_STEPS[TUT.i];
    t.check(paso && paso.allow && paso.allow.hand && paso.allow.hand[0]===TUT_MAZO.rafaela.c2,
      'no llegué al paso que pide la segunda criatura de Rafaela');
    const coste = T.costOf(TUT_MAZO.rafaela.c2, 0);
    t.nota(`rafaela: el paso pide ${TUT_MAZO.rafaela.c2} (${coste} PD) con ${T.P(0).pd} PD`);
    const antes = TUT.i;
    // esperar más que la red de seguridad (7 s) sin hacer nada
    await sleep(11000);
    t.check(TUT.i === antes,
      `el paso que pide ${TUT_MAZO.rafaela.c2} se saltó solo en vez de esperar a que tengas PD`);
    tutEnd();
    await sleep(400);
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

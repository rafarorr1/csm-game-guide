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
  /* El código vive en dos archivos desde la v15 —motor.js y la pantalla— y
     las pruebas que buscan patrones en el código tienen que ver los dos. */
  if(_fuente===null){
    const a = await (await fetch(location.pathname)).text();
    const b = await (await fetch('motor.js')).text().catch(()=>'');
    _fuente = a + '\n' + b;
  }
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
PRUEBAS.suite('integracion', async t => {
  // El cargador y el modo sin conexión necesitan las dos piezas compartidas.
  {
    t.check(!!window.CAOZ_AAA, 'la capa AAA debe instalarse al cargar ambas piezas');
    const sw = await (await fetch('sw.js')).text();
    for(const archivo of ['final-core.js','polish-aaa.js']){
      const respuesta=await fetch(archivo);
      t.check(respuesta.ok && (await respuesta.text()).includes('use strict'), archivo+' debe estar publicado');
      t.check(sw.includes("'"+archivo+"'"), archivo+' debe estar en la caché inicial');
    }
  }


});

PRUEBAS.suite('visual', async t => {
  const carta=cardEl('eric');
  carta.style.cssText='position:fixed;left:40px;top:40px;width:180px;height:252px';
  document.body.appendChild(carta);
  try{
    const r=carta.getBoundingClientRect();
    for(const [selector,derecha,abajo] of [['.cost',false,false],['.atk',false,true],['.hp',true,true]]){
      const n=carta.querySelector(selector).getBoundingClientRect();
      t.check(Math.abs(n.x+n.width/2-(derecha?r.right:r.left))<r.width*.12 &&
        Math.abs(n.y+n.height/2-(abajo?r.bottom:r.top))<r.height*.08,
        selector+' debe quedar en su esquina');
    }
  }finally{carta.remove();}
  await T.startMatch('fender','adreida',{volado:false,first:0});
  const a=T.mkUnit('horton',1),b=T.mkUnit('discipulo',0);
  T.P(1).field.push(a);T.P(0).field.push(b);T.recalc();T.render();
  const nodo=fxEl(a);nodo.classList.add('finge-hov');
  const pelea=fxLunge(a,b);
  await sleep(100);
  t.check(getComputedStyle(nodo.querySelector('.cajon')).visibility==='hidden',
    'el panel de reglas no debe tapar el combate');
  await pelea;
  t.check(!document.querySelector('.fxlabel'),'el aviso debe desaparecer antes del impacto');
  const golpe=fxHit(b,1,{combate:true,atacante:a.uid});await sleep(100);
  t.check(document.querySelectorAll('.aaa-dmg').length===1,'debe verse una sola cifra de daño');
  await golpe;
  t.check(!document.querySelector('.aaa-dmg'),'la cifra debe retirarse antes del siguiente golpe');
  t.check(!document.body.classList.contains('aaa-combat'),'los paneles deben recuperarse al terminar');
});

PRUEBAS.suite('campana', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    f.src=pagina+'?test=campana-interna';const carga=new Promise(r=>f.onload=r);document.body.appendChild(f);await carga;
    let w=f.contentWindow;
    const preparar=()=>{w.cortinillaVS=async()=>{};w.volado=async()=>0;w.ask=async()=>1;w.cinematicaFinal=async()=>false;w.campanaAbrirDeseo=undefined;w.campanaAscenderAlDeseo=undefined;};
    const comprobarNiebla=etapa=>{
      const n=w.document.querySelector('.campanaTablero .campanaNiebla');
      if(etapa>=5){t.check(!n,pagina+': la niebla debe desaparecer al llegar al jefe final.');return 0;}
      t.check(!!n&&n.dataset.etapa===String(etapa),pagina+': la niebla no corresponde al avance de la campaña.');
      const estilo=w.getComputedStyle(n),valor=estilo.getPropertyValue('--niebla-limite').trim(),limite=parseFloat(valor);
      t.check(n.getAttribute('aria-hidden')==='true'&&estilo.pointerEvents==='none',pagina+': la niebla decorativa no debe bloquear controles ni lectores de pantalla.');
      t.check(valor.endsWith('%')&&Number.isFinite(limite)&&limite>0&&limite<=100,pagina+': la niebla necesita una extensión válida sobre el mapa.');
      t.check(n.querySelector('linearGradient stop:last-child').getAttribute('offset')===valor,pagina+': la máscara visible debe seguir el límite de niebla guardado.');
      return limite;
    };
    try{
      preparar();w.localStorage.removeItem('caoz.campana.v1.prueba');
      w.document.querySelector('#mCampana').click();
      t.check(w.document.querySelector('#campanaPanel').open,pagina+': Campaña debe abrirse desde el menú.');
      w.document.querySelector('[data-creador-continuar]').click();
      const cartas=[...w.document.querySelectorAll('.campanaCarta')];
      t.check(cartas.length===6,pagina+': deben existir seis cartas en el carrusel.');
      w.document.querySelector('[aria-label="Protagonista siguiente"]').click();
      t.check(w.document.querySelector('.campanaCarta.enfrente').dataset.campanaLider==='fender',pagina+': el carrusel no gira.');
      t.check(w.document.querySelector('.campanaCarta')===cartas[0],pagina+': el giro recrea las cartas y pierde la animación.');
      w.document.querySelector('[aria-label="Protagonista anterior"]').click();
      w.document.querySelector('.campanaConfirmar').click();
      const ruta=w.document.querySelector('.campanaRuta');
      t.check(ruta.firstElementChild.dataset.etapa==='5'&&ruta.lastElementChild.dataset.etapa==='0',pagina+': la escalera debe ascender desde abajo.');
      t.check(!!w.document.querySelector('.campanaMesa .campanaPeon'),pagina+': falta la ficha en el tablero.');
      t.check(ruta.querySelectorAll('[data-campana-lider]').length===1&&!ruta.textContent.includes('Gero'),pagina+': no deben revelarse los rivales futuros.');
      t.check(w.campanaLeer().etapa===0,pagina+': la campaña debe empezar desde cero.');
      let limiteNiebla=comprobarNiebla(0);
      await w.campanaCombatir();
      t.check(w.eval('G.campana.etapa===0&&P(1).alma===16&&P(0).alma===20'),pagina+': primer encuentro incorrecto.');
      w.endGame(1,'Derrota de prueba');await sleep(600);
      t.check(w.campanaLeer().etapa===0,pagina+': perder no debe avanzar.');
      t.check(w.document.querySelector('#campanaPanel').textContent.includes('Reintentar combate'),pagina+': falta reintentar.');
      for(let etapa=0;etapa<6;etapa++){
        await w.campanaCombatir();
        t.check(w.eval('G.campana.etapa')===etapa,pagina+': se saltó un combate.');
        t.check(w.eval('P(1).alma')===[16,20,24,28,32,40][etapa],pagina+': resistencia rival incorrecta.');
        if(etapa===5)t.check(w.eval("P(1).leaderId==='gero'"),pagina+': Gero debe ser el jefe final.');
        w.endGame(0,'Victoria de prueba');await sleep(600);
        t.check(w.campanaLeer().etapa===etapa+1,pagina+': la victoria no se guardó.');
        w.campanaRuta();await sleep(1300);w.document.querySelector('#campanaPanel .campanaAcciones .gold').click();
        t.check(w.matchMedia('(prefers-reduced-motion:reduce)').matches||(w.document.querySelector('.campanaLienzo3d')?w.document.querySelector('.campanaLienzo3d').dataset.avanzando==='1':w.document.querySelector('.campanaPeon').getAnimations().length>0),pagina+': falta la animación de avance.');
        t.check(w.document.querySelector('.campanaPeon').dataset.etapa===String(etapa+1),pagina+': la ficha no avanzó tras la victoria.');
        t.check(w.document.querySelectorAll('.campanaRuta [data-campana-lider]').length===Math.min(6,etapa+2),pagina+': se revelan rivales antes de tiempo.');
        const nuevoLimite=comprobarNiebla(etapa+1);
        if(etapa<4)t.check(nuevoLimite<limiteNiebla,pagina+': ganar debe despejar otra parte del mapa.');
        limiteNiebla=nuevoLimite;
        w.showEnd(0,'Aviso repetido');t.check(w.campanaLeer().etapa===etapa+1,pagina+': una victoria duplicada avanza dos veces.');
        if(etapa===1){
          const recarga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-interna&recarga=1';await recarga;w=f.contentWindow;preparar();
          t.check(w.campanaLeer().etapa===2,pagina+': se perdió el progreso al recargar.');
          w.document.querySelector('#mCampana').click();
          t.check(comprobarNiebla(2)===limiteNiebla,pagina+': recargar debe conservar la parte del mapa ya despejada.');
        }
      }
      t.check(w.document.querySelector('#campanaPanel').textContent.includes('Campaña completada'),pagina+': falta el cierre de campaña.');
      w.campanaCerrar();await w.setupMatch('fender','adreida',{first:0,fast:true});
      t.check(!w.eval('G.campana')&&w.eval('P(1).alma')===20,pagina+': los modificadores se filtraron a una partida normal.');
      t.check(w.campanaLeer().etapa===6,pagina+': una partida normal alteró el progreso.');
    }finally{w.relojPara();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('azarYCriticos', async t => {
  let total=0;for(let i=0;i<10000;i++)total+=rnd(2);
  t.check(total>4500&&total<5500,'La muestra del volado debe ser compatible con 50/50.');t.nota('10000 volados: '+total+' caras de un lado y '+(10000-total)+' del otro.');
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=azar-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,azar=w.Math.random;
    try{
      w.newGame('fender','mohamed');w.eval('G.fast=true');
      for(const eleccion of [0,1])for(const moneda of [0,1]){
        w.Math.random=()=>moneda?.9:.1;const tirada=w.voladoDomo('Rival');
        d.querySelector(eleccion?'#ladoCruz':'#ladoCara').click();
        t.check(await tirada===(eleccion===moneda?0:1),pagina+': elección, resultado y primer turno deben coincidir.');
        t.check(d.querySelector('#moneda').getAttribute('aria-label')==='Moneda: '+(moneda?'cruz':'cara'),pagina+': la animación debe terminar con el lado sorteado.');
      }
      w.Math.random=azar;w.eval('G.fast=false');Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});
      const dado=w.rollDice(1,'Prueba',true,{ok:n=>n>=8,siOk:'Acierto',siMal:'No alcanza'});d.querySelector('#dbtn').click();await sleep(1700);
      t.check(d.querySelector('#dlabel').textContent==='¡CRÍTICO!',pagina+': un 1 debe decir CRÍTICO.');
      t.check(d.querySelector('#defecto').textContent.includes('No alcanza'),pagina+': el nuevo texto no debe alterar la regla del dado.');d.querySelector('#dbtn').click();await dado;
    }finally{w.Math.random=azar;w.relojPara();f.remove();}
  }
});

PRUEBAS.suite('d20Fisico', async t => {
  const F=window.CAOZ_D20;
  t.check(F&&F.caras.length===20&&new Set(F.caras.map(c=>c.valor)).size===20,'D20 con veinte caras físicas distintas.');
  const frecuencias=Array(20).fill(0);let maximo=0;
  for(let i=0;i<240;i++){
    const impulso=i%3===0?{x:i%2?-1:1,z:i%4<2?-1:1,fuerza:1}:undefined;
    const r=F.simular(i,impulso);frecuencias[r.valor-1]++;maximo=Math.max(maximo,r.duracion);
    t.check(r.asentado&&r.apoyos.length>=3&&r.alineacion>.9997,'La tirada '+i+' debe terminar apoyada sobre una cara.');
    const p=r.frames.at(-1);t.check(F.leer(p.q).valor===r.valor,'El valor debe venir de la orientación final, no de otro sorteo.');
    t.check(F.vertices.every(v=>p.p[1]+F.girar(v,p.q)[1]>-.0015),'El dado no atraviesa la mesa.');
    if(i<12){const otra=F.simular(i,impulso);t.check(JSON.stringify(r.frames)===JSON.stringify(otra.frames),'Misma semilla y gesto: misma trayectoria.');}
    const red=F.desempaquetar(F.empaquetar(r));t.check(red&&F.leer(red.frames.at(-1).q).valor===r.valor,'La trayectoria de red conserva la cara.');
  }
  t.check(frecuencias.every(n=>n>=3&&n<=27),'Las veinte caras deben aparecer sin un sesgo evidente en la muestra fija.');
  t.nota('240 lanzamientos físicos: '+frecuencias.join(', ')+' · duración máxima '+maximo.toFixed(2)+' s.');
  t.check(F.impulsoValido({x:Infinity,z:-99,fuerza:100}).x===0&&F.impulsoValido({z:-99}).z===-1&&F.impulsoValido({fuerza:100}).fuerza===1,'El impulso remoto se limita a valores válidos.');
  const esperar=async(fn,ms=7000)=>{const fin=Date.now()+ms;while(!fn()&&Date.now()<fin)await sleep(15);t.check(fn(),'El d20 no terminó su fase esperada.');};
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=d20-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument;
    try{
      Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});w.CAOZ_D20_PRUEBA=true;
      w.newGame('fender','mohamed');w.showScreen('board');w.render();
      const random=w.crypto.getRandomValues.bind(w.crypto);w.crypto.getRandomValues=a=>{a[0]=1;return a;};
      w.Math.random=()=>.999;const esperado=w.CAOZ_D20.simular(1).valor;
      const tirada=w.resolverD20('Coraje de Drantiago',0,w.metaViva({min:11,necesita:'11+',siOk:'+2 ATQ',siMal:'No alcanza'}));
      t.check(!!d.querySelector('#dice.fisico #dbtn')&&d.querySelector('#dbtn').textContent.includes('Tirar'),pagina+': el jugador puede lanzar desde la mesa.');
      d.querySelector('#dbtn').click();await esperar(()=>!!d.querySelector('#dice').dataset.d20Valor);
      t.check(d.querySelector('#d20v').textContent===String(esperado)&&d.querySelector('#dice').dataset.d20Asentado==='true',pagina+': la cara física se muestra y sigue apoyada.');
      t.check(d.querySelector('#defecto').textContent.includes(esperado>=11?'+2 ATQ':'No alcanza'),pagina+': el umbral usa el resultado físico.');
      d.querySelector('#dbtn').click();t.check(await tirada===esperado,pagina+': el motor recibe la cara física en vez de rnd(20).');
      w.matchMedia=()=>({matches:true});const breve=w.resolverD20('Automático',0,{sola:true});await esperar(()=>!!d.querySelector('#dice').dataset.d20Valor);d.querySelector('#dbtn').click();await breve;
      const pendiente=w.resolverD20('Cancelación',0,null);w.showScreen('menu');await pendiente;t.check(!d.querySelector('#dice').classList.contains('on'),pagina+': salir del tablero no deja una promesa ni un dado flotante.');
      w.crypto.getRandomValues=random;
    }finally{w.CAOZ_D20.cancelar();w.relojPara();f.remove();}
  }
});

PRUEBAS.suite('d20OnlineFisico', async t => {
  const esperar=async(fn,ms=6500)=>{const fin=Date.now()+ms;while(!fn()&&Date.now()<fin)await sleep(12);t.check(fn(),'El d20 online no terminó su fase esperada.');};
  for(const paginas of [['index.html','movil.html'],['movil.html','index.html']]){
    const marcos=[];
    try{
      for(const pagina of paginas){const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=d20-red-interno';document.body.appendChild(f);marcos.push(f);await carga;}
      const clientes=marcos.map(f=>f.contentWindow),[h,j]=clientes,registro=[];
      clientes.forEach((w,i)=>{
        w.newGame(i?'mohamed':'fender',i?'fender':'mohamed');w.eval('G.online=true;G.phase="principal";G.turnNo=3;G.fast=false;G.auto=false;G.silent=false');w.CAOZ_D20_PRUEBA=true;
        Object.defineProperty(w.document,'hidden',{get:()=>false,configurable:true});w.matchMedia=()=>({matches:true});w.netStatus=()=>{};
        Object.assign(w.eval('NET'),{on:true,host:i===0,guest:i===1,peer:true,d20Remoto:1,sid:'d20-'+i,hechas:new Set(),esperaAck:new Map(),chs:[{ok:true,close(){}}]});
        w.netSend=m=>{registro.push({lado:i,t:m.t,kind:m.kind,fisica:m.fisica,fx:m.s?.fx});const copia=JSON.parse(JSON.stringify({...m,sid:'d20-'+i}));queueMicrotask(()=>clientes[1-i].netRecv(copia));};w.showScreen('board');w.render();
      });
      let semillas=0;h.crypto.getRandomValues=a=>{semillas++;a[0]=1;return a;};j.crypto.getRandomValues=()=>{throw Error('El invitado intentó sortear el resultado.');};
      for(const lado of [1,0]){
        semillas=0;const promesa=h.resolverD20('Prueba física online',lado,h.metaViva({min:11,necesita:'11+',siOk:'+2 ATQ',siMal:'No alcanza'})),jugador=clientes[lado];
        await esperar(()=>jugador.document.querySelector('#dbtn')?.textContent.includes('Tirar'));t.check(semillas===0,'La semilla autoritativa debe nacer después del gesto.');jugador.document.querySelector('#dbtn').click();
        await esperar(()=>clientes.every(w=>!!w.document.querySelector('#dice').dataset.d20Valor));
        const esperado=h.CAOZ_D20.simular(1).valor,valores=clientes.map(w=>+w.document.querySelector('#dice').dataset.d20Valor);
        t.check(valores.every(v=>v===esperado),paginas.join('→')+': ambos clientes ven la misma cara calculada por el anfitrión.');
        clientes.forEach(w=>w.document.querySelector('#dbtn').click());t.check(await promesa===esperado&&semillas===1,'Una sola simulación autoritativa devuelve el valor al motor.');await sleep(190);
      }
      // La carta real debe aplicar el beneficio después de confirmar el dado.
      h.eval('G.active=1;P(0).hand=[];P(1).hand=["rantiago"];P(1).pd=10');const aliado=h.mkUnit('bartolomeo',1);h.eval('P(1)').field=[aliado];h.recalc();h.render();await sleep(190);
      const coraje=h.playFromHand(1,'rantiago',[[aliado]]);await esperar(()=>j.document.querySelector('#dbtn')?.textContent.includes('Tirar'));j.document.querySelector('#dbtn').click();await esperar(()=>clientes.every(w=>!!w.document.querySelector('#dice').dataset.d20Valor));clientes.forEach(w=>w.document.querySelector('#dbtn').click());await coraje;
      await esperar(()=>aliado.pA===2&&j.eval('P(0).field[0]?.pA')===2);t.check(aliado.atk===3&&j.eval('P(0).field[0]?.atk')===3,'Rantiago aplica +2 ATQ físico y lo sincroniza en ambos clientes.');
      const antes=registro.length,sola=h.resolverD20('Pasiva',1,h.metaViva({sola:true,min:11}));await esperar(()=>clientes.every(w=>!!w.document.querySelector('#dice').dataset.d20Valor));clientes.forEach(w=>w.document.querySelector('#dbtn').click());await sola;
      t.check(!registro.slice(antes).some(m=>m.kind==='rollLaunch'),'La pasiva del invitado no debe pedir un gesto.');
      let n=0;h.crypto.getRandomValues=a=>{a[0]=[3,7][n++];return a;};h.trapWindow=async(s,ev,o)=>{if(o?.isRoll)o.reroll=true;};h.fastWindow=async(s,o)=>{if(o?.kind==='d20')o.ev.reroll=true;};const desde=registro.length,repeticion=h.roll('Repetir',1,null),valores=[];
      for(let i=0;i<2;i++){await esperar(()=>j.document.querySelector('#dbtn')?.textContent.includes('Tirar'));j.document.querySelector('#dbtn').click();await esperar(()=>clientes.every(w=>!!w.document.querySelector('#dice').dataset.d20Valor));valores.push(+j.document.querySelector('#dice').dataset.d20Valor);clientes.forEach(w=>w.document.querySelector('#dbtn').click());await sleep(190);}
      t.check(await repeticion===Math.min(...valores),'La repetición física conserva el peor de los dos resultados.');const ultimos=registro.slice(desde);
      t.check(ultimos.filter(m=>m.kind==='roll').length===2&&!ultimos.some(m=>m.fx?.some(f=>f.k==='dice')),'Cada tirada del invitado llega una vez, sin duplicado que tape el botón.');
      // Un cliente anterior a este build no entiende rollLaunch. Negociar la
      // capacidad mantiene el diálogo clásico sin esperar su timeout.
      h.eval('NET.d20Remoto=0');h.Math.random=()=>.999;clientes.forEach(w=>w.rollDice=async()=>{});const antiguo=registro.length;
      t.check(await h.resolverD20('Cliente anterior',1,null)===20,'Con un cliente anterior se conserva la tirada clásica.');
      t.check(!registro.slice(antiguo).some(m=>m.kind==='rollLaunch'||m.fisica),'No enviar solicitudes físicas a un cliente sin capacidad negociada.');
      h.eval('NET.peer=false');h.eval('NET.onjoin=()=>{}');h.netRecv({t:'join',sid:'nuevo',d20Fisico:1});t.check(h.eval('NET.d20Remoto')===1,'El anfitrión lee la capacidad anunciada al entrar.');
      j.netGuestStart=()=>{};j.netRecv({t:'welcome',sid:'nuevo',d20Fisico:1});t.check(j.eval('NET.d20Remoto')===1,'El invitado lee la capacidad de bienvenida.');
      j.netRecv({t:'welcome',sid:'viejo'});t.check(j.eval('NET.d20Remoto')===0,'Sin anuncio, el protocolo conserva compatibilidad.');
      t.nota(paginas.join(' → ')+': dos lados, pasiva automática, repetición, mismo resultado y cliente anterior.');
    }finally{marcos.forEach(f=>{const w=f.contentWindow;w.netSend=()=>{};w.netClose();w.CAOZ_D20.cancelar();f.remove();});}
  }
});

PRUEBAS.suite('manoNuevaTurno',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=mano-turno-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow;
    try{
      w.newGame('fender','adreida');w.eval("G.phase='principal';G.turnNo=1;G.active=0;P(0).hand=['tal'];P(0).pd=1;");w.cerrarOv();
      let terminarReparto,preguntas=0;w.repartirALaVista=()=>new Promise(r=>terminarReparto=r);w.ask=async()=>{preguntas++;return 1;};
      const oferta=w.ofrecerManoNueva(0);t.check(!!terminarReparto,pagina+': la oferta espera a mostrar las cartas');
      w.eval('G.active=1;G.turnNo=2');terminarReparto();await oferta;
      t.check(preguntas===0&&!w.eval('P(0).manoRehecha'),pagina+': pasar de turno durante el reparto cancela la pregunta antigua sin gastar el cambio de mano');
      w.eval('G.active=0;G.turnNo=1');const vigente=w.ofrecerManoNueva(0);terminarReparto();await vigente;
      t.check(preguntas===1&&w.eval('P(0).manoRehecha'),pagina+': la oferta del turno vigente sigue funcionando');
    }finally{f.remove();}
  }
});

PRUEBAS.suite('editorCartas',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=cartas-editor-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,poner=w.setTimeout;
    try{
      const originales=w.eval('JSON.stringify(DECKS)');w.startTurn=async s=>w.eval("G.active="+s+";G.phase='principal';G.turnNo=3");
      w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);w.fxFace=async()=>{};w.fxStat=()=>{};let genericas=0;w.fxSpell=async()=>{genericas++;};
      const tipos=[];w.PITAGORAS_PRUEBAS.iniciar=async op=>{tipos.push(op);return{sobrevivio:true,cancelado:false};};
      await w.setupMatch('fender','adreida',{first:0,campana:{id:'mazo-editor',jefeSecreto:true,alma:40}});
      const ids=w.eval('CARTAS_EDITOR.slice()');t.check(w.eval('[...P(1).deck,...P(1).hand].length===40 && [...P(1).deck,...P(1).hand].every(id=>CARDS[id].editorJuego)'),pagina+': mazo propio antes de repartir');
      for(const id of ids){w.eval("G.active=1;P(1).pd=6;P(1).hand=['"+id+"']");const alma=w.eval('P(1).alma');t.check(await w.playFromHand(1,id),pagina+': juega '+id);t.igual(w.eval('P(1).pd'),4,pagina+': paga sus 2 PD');t.igual(w.eval('P(1).alma'),alma-2,pagina+': una sola aplicación del resultado');t.check(w.eval('P(1).grave').includes(id),pagina+': carta real en Alcantarillas');}
      t.check(tipos.map(o=>o.tipo).join(',')==='isometrico,laseres,fps,carrera,orbital,duelo'&&tipos.every(o=>o.cinematica===true)&&genericas===0,pagina+': cada carta llama a su juego sin otra presentación genérica');
      await w.setupMatch('fender','adreida',{first:0});t.check(w.eval('[...P(1).hand,...P(1).deck].every(id=>!CARDS[id].editorJuego)'),pagina+': partida normal conserva Adreida');
      t.igual(w.eval('JSON.stringify(DECKS)'),originales,pagina+': los seis mazos no cambian');
      w.eval("P(0).hand=['editorcosecha'];P(0).pd=10");t.check(!w.canPlay(0,'editorcosecha'),pagina+': carta exclusiva del jefe');
      await w.setupMatch('fender','adreida',{first:0,online:true,campana:{jefeSecreto:true,alma:40}});t.check(w.eval('[...P(1).hand,...P(1).deck].every(id=>!CARDS[id].editorJuego)'),pagina+': no entra al online');
    }finally{w.campanaCancelarInterferencia();f.remove();}
  }
});

PRUEBAS.suite('pitagorasTransiciones',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=transicion-editor-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument;let ahora=10000,id=0;const timers=new Map(),cuadros=new Map(),paso=w.PITAGORAS_PRUEBAS.modelo.paso;
    try{
      w.setTimeout=(fn,ms)=>{const n=++id;timers.set(n,{fn,en:ahora+ms});return n;};w.clearTimeout=n=>timers.delete(n);w.requestAnimationFrame=fn=>{const n=++id;cuadros.set(n,fn);return n;};w.cancelAnimationFrame=n=>cuadros.delete(n);w.performance.now=()=>ahora;w.matchMedia=()=>({matches:false});
      const avanzar=ms=>{const fin=ahora+ms;while(true){const prox=[...timers].filter(([,v])=>v.en<=fin).sort((a,b)=>a[1].en-b[1].en)[0];if(!prox)break;ahora=prox[1].en;timers.delete(prox[0]);prox[1].fn();}ahora=fin;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
      for(const tipo of ['isometrico','laseres','fps','carrera','orbital','duelo'])for(const gana of [false,true]){
        // La supervivencia se valida con los modelos reales en su suite; aquí
        // aislamos ambos resultados para probar toda la secuencia visual.
        w.PITAGORAS_PRUEBAS.modelo.paso=(s,e,dt)=>{s.t=Math.min(s.duracion,s.t+dt);if(s.t>=s.duracion){s.terminado=true;s.sobrevivio=gana;s.vidas=gana?2:0;}return s;};
        let veces=0;const promesa=w.PITAGORAS_PRUEBAS.iniciar({tipo,semilla:6,cinematica:true}).then(r=>{veces++;return r;});
        t.check(!d.querySelector('.ppPanel')&&d.querySelector('.ppCartaJuego h1').textContent===w.PITAGORAS_PRUEBAS.tipos[tipo].nombre,pagina+': carta del juego y ninguna confirmación');
        avanzar(1149);t.check(w.PITAGORAS_PRUEBAS.estado.t===0&&d.querySelector('.ppMesaVisible'),pagina+': la carta sigue sobre la mesa, reloj detenido sólo durante entrada');
        avanzar(901);t.check(w.PITAGORAS_PRUEBAS.estado.fase==='revelando'&&!d.querySelector('.ppMesaVisible')&&!d.querySelector('.ppCartaJuego'),pagina+': cambia de escena bajo la nube');
        const nube=d.querySelector('.ppNube'),ctx=nube.getContext('2d');t.igual(ctx.getImageData(nube.width/2,nube.height/2,1,1).data[3],255,pagina+': cobertura opaca en el intercambio');
        avanzar(1000);t.check(w.PITAGORAS_PRUEBAS.estado.fase==='jugando'&&w.PITAGORAS_PRUEBAS.estado.t===0,pagina+': arranca automáticamente con veinte segundos completos');
        w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Escape',cancelable:true}));avanzar(20000);
        t.check(w.PITAGORAS_PRUEBAS.estado.fase==='resultado'&&!d.querySelector('.ppPanel')&&d.querySelector('.ppDesenlace'),pagina+': resultado breve sin botones');
        avanzar(1750);t.check(w.PITAGORAS_PRUEBAS.estado.fase==='regresando'&&d.querySelector('.ppMesaVisible'),pagina+': la mesa reaparece bajo el humo');
        avanzar(900);const r=await promesa;t.check(r.sobrevivio===gana&&!r.cancelado&&veces===1&&!d.querySelector('.pitPrueba')&&!d.body.classList.contains('pitPruebaAbierta'),pagina+': resultado único y limpieza automática');
      }
      // Salir desde cualquier fase no deja una nube ni un arranque tardío.
      for(const tipo of ['isometrico','laseres','fps','carrera','orbital','duelo'])for(const ms of [0,1300,2200,3100]){const p=w.PITAGORAS_PRUEBAS.iniciar({tipo,cinematica:true});avanzar(ms);w.PITAGORAS_PRUEBAS.cancelar();avanzar(4000);t.check((await p).cancelado&&!d.querySelector('.pitPrueba,.ppNube')&&!w.PITAGORAS_PRUEBAS.activa,pagina+': cancelación limpia de '+tipo+' a '+ms+' ms');}
    }finally{w.PITAGORAS_PRUEBAS.modelo.paso=paso;w.PITAGORAS_PRUEBAS.cancelar();f.remove();}
  }
});

PRUEBAS.suite('pitagorasSinPausa',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=sin-pausa-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,media=w.matchMedia;let ahora=10000,uid=0;const cuadros=new Map();
    try{
      w.requestAnimationFrame=fn=>{const id=++uid;cuadros.set(id,fn);return id;};w.cancelAnimationFrame=id=>cuadros.delete(id);w.performance.now=()=>ahora;w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:media.call(w,q);
      const avanzar=seg=>{ahora+=seg*1000;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
      const alto=d.createElement('div');alto.style.height='3500px';d.body.appendChild(alto);d.body.style.overflow='auto';d.documentElement.style.overflow='auto';
      for(const tipo of ['isometrico','laseres','fps','carrera','orbital','duelo']){
        const promesa=w.PITAGORAS_PRUEBAS.iniciar({tipo,nombre:'Viajera',semilla:6});
        t.check(!d.querySelector('.ppPausa')&&w.getComputedStyle(d.body).position==='fixed'&&w.getComputedStyle(d.documentElement).overflow==='hidden',pagina+': sin botón de pausa y con bloqueo de raíz');
        for(const evento of [new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:200}),new w.Event('touchmove',{bubbles:true,cancelable:true})]){d.querySelector('.ppLienzo').dispatchEvent(evento);t.check(evento.defaultPrevented,pagina+': el gesto no desplaza el documento');}
        w.scrollTo(0,200);t.check(w.scrollY===0,pagina+': la página inferior no tiene desplazamiento');
        d.querySelector('.ppBotones .ppBoton').click();await sleep(20);t.igual(w.PITAGORAS_PRUEBAS.estado.fase,'jugando',pagina+': empieza la prueba');
        w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Escape',cancelable:true}));d.querySelector('.pitPrueba').dispatchEvent(new w.Event('cancel',{cancelable:true}));w.dispatchEvent(new w.Event('blur'));Object.defineProperty(d,'hidden',{configurable:true,get:()=>true});d.dispatchEvent(new w.Event('visibilitychange'));avanzar(.75);
        t.check(w.PITAGORAS_PRUEBAS.estado.fase==='jugando'&&w.PITAGORAS_PRUEBAS.estado.t>=.74,pagina+': Escape, foco, pestaña oculta y fotograma lento no pausan');
        Object.defineProperty(d,'hidden',{configurable:true,get:()=>false});avanzar(20);
        const estado=w.PITAGORAS_PRUEBAS.estado;t.check(estado.fase==='resultado'&&!estado.sobrevivio&&estado.vidas===0,pagina+': el tiempo ausente simula los peligros, no concede una victoria gratuita');
        d.querySelector('.ppBotones .ppBoton').click();const resultado=await promesa;
        t.check(!resultado.sobrevivio&&!resultado.cancelado&&!d.querySelector('.pitPrueba')&&!d.body.classList.contains('pitPruebaAbierta')&&!d.documentElement.classList.contains('pitPruebaAbierta'),pagina+': resultado y desbloqueo del documento');
        t.igual(w.getComputedStyle(d.body).overflow,'auto',pagina+': restaura las reglas de desplazamiento anteriores');
      }
      const cancelada=w.PITAGORAS_PRUEBAS.iniciar({tipo:'fps'});w.PITAGORAS_PRUEBAS.cancelar();t.check((await cancelada).cancelado&&!d.body.classList.contains('pitPruebaAbierta'),pagina+': cancelar también desbloquea');
    }finally{w.PITAGORAS_PRUEBAS.cancelar();f.remove();}
  }
});

PRUEBAS.suite('pitagorasLaboratorio',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=laboratorio-interna&editor=1';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,permitido=w.campanaPruebaDisponible,clave=w.eval('CAMPANA_CLAVE'),previo=w.localStorage.getItem(clave);let ahora=10000,uid=0;const timers=new Map(),cuadros=new Map();
    const guardados=()=>JSON.stringify(Object.keys(w.localStorage).filter(k=>/campana|records/.test(k)).sort().map(k=>[k,w.localStorage.getItem(k)]));
    try{
      t.check(!!d.querySelector('.editorLaboratorio[open]'),pagina+': el enlace de beta abre el selector de pruebas');
      w.campanaGuardar({version:1,id:'no-tocar-laboratorio',lider:'fender',etapa:4,personaje:{nombre:'Nébula'}});w.newGame('fender','adreida');
      const partida=w.eval('G'),antes=JSON.stringify(partida),datos=guardados();
      w.setTimeout=(fn,ms)=>{const id=++uid;timers.set(id,{fn,en:ahora+ms});return id;};w.clearTimeout=id=>timers.delete(id);w.requestAnimationFrame=fn=>{const id=++uid;cuadros.set(id,fn);return id;};w.cancelAnimationFrame=id=>cuadros.delete(id);w.performance.now=()=>ahora;w.matchMedia=()=>({matches:false});
      const avanzar=ms=>{const fin=ahora+ms;while(true){const p=[...timers].filter(([,v])=>v.en<=fin).sort((a,b)=>a[1].en-b[1].en)[0];if(!p)break;ahora=p[1].en;timers.delete(p[0]);p[1].fn();}ahora=fin;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
      const laboratorio=d.querySelector('.editorLaboratorio'),botones=[...laboratorio.querySelectorAll('.elMundo')],salir=laboratorio.querySelector('.elSalir');
      t.igual(botones.map(b=>b.dataset.tipo).join(','),'isometrico,laseres,fps,carrera,orbital,duelo',pagina+': seis mundos accesibles desde el enlace');
      for(const boton of botones){
        boton.click();boton.click();t.check(d.querySelectorAll('.pitPrueba').length===1&&salir.disabled&&laboratorio.querySelector('.elMundos').inert,pagina+': doble clic no superpone dos juegos');
        avanzar(3050);t.igual(w.PITAGORAS_PRUEBAS.estado.tipo,boton.dataset.tipo,pagina+': la carta abre su juego real');t.igual(w.PITAGORAS_PRUEBAS.estado.fase,'jugando',pagina+': entra automáticamente sin preguntas');
        avanzar(20000);t.igual(w.PITAGORAS_PRUEBAS.estado.fase,'resultado',pagina+': la prueba real llega a un resultado');avanzar(2650);await sleep(0);
        t.check(laboratorio.open&&!d.querySelector('.pitPrueba')&&!salir.disabled&&!laboratorio.querySelector('.elMundos').inert&&boton.dataset.probado==='1',pagina+': regresa al mismo selector y permite probar otra carta');
        t.check(w.eval('G')===partida&&JSON.stringify(partida)===antes&&guardados()===datos,pagina+': probar '+boton.dataset.tipo+' no cambia combate, campaña, honores ni récords');
      }
      // Un cierre externo durante el humo cancela el ensayo y su retorno tardío.
      botones[0].click();avanzar(1300);laboratorio.close();await sleep(0);avanzar(30000);await sleep(0);
      t.check(!w.PITAGORAS_PRUEBAS.activa&&!d.querySelector('.editorLaboratorio,.pitPrueba')&&!d.body.classList.contains('pitPruebaAbierta'),pagina+': cerrar limpia el juego, el humo y el bloqueo de scroll');
      w.campanaPruebaDisponible=()=>false;w.abrirLaboratorioEditor();t.check(!d.querySelector('.editorLaboratorio'),pagina+': no se abre fuera de beta');w.campanaPruebaDisponible=permitido;
      for(const caso of ['NET.on','G.online','G.guest']){w.eval(caso+'=true');w.abrirLaboratorioEditor();t.check(!d.querySelector('.editorLaboratorio'),pagina+': no se abre con '+caso);w.eval(caso+'=false');}
      w.abrirLaboratorioEditor();t.check(!!d.querySelector('.editorLaboratorio'),pagina+': puede volver a abrirse tras la cancelación');
    }finally{w.PITAGORAS_PRUEBAS.cancelar();d.querySelector('.editorLaboratorio')?.close();w.campanaPruebaDisponible=permitido;if(previo===null)w.localStorage.removeItem(clave);else w.localStorage.setItem(clave,previo);f.remove();}
  }
});

PRUEBAS.suite('pitagorasTopdown',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=cenital-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,M=w.PITAGORAS_PRUEBAS.modelo,crear=M.crear,poner=w.setTimeout,media=w.matchMedia;let ahora=10000,uid=0,modelo;const cuadros=new Map();
    try{
      w.requestAnimationFrame=fn=>{const id=++uid;cuadros.set(id,fn);return id;};w.cancelAnimationFrame=id=>cuadros.delete(id);w.performance.now=()=>ahora;w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:media.call(w,q);
      M.crear=op=>{modelo=crear(op);modelo.siguiente=Infinity;modelo.proximaMarca=Infinity;return modelo;};
      const avanzar=seg=>{ahora+=seg*1000;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
      const promesa=w.PITAGORAS_PRUEBAS.iniciar({tipo:'isometrico',semilla:1});d.querySelector('.ppBotones .ppBoton').click();await sleep(20);avanzar(0);
      const tecla=(tipo,code)=>w.dispatchEvent(new w.KeyboardEvent(tipo,{code,cancelable:true}));
      for(const [code,x,y] of [['KeyD',1,0],['KeyW',0,-1],['ArrowLeft',-1,0],['ArrowDown',0,1]]){
        Object.assign(modelo.jugador,{x:0,y:0});tecla('keydown',code);avanzar(.1);tecla('keyup',code);
        const p=modelo.jugador;t.check(p.x*x+p.y*y>.4&&Math.abs(p.x*y-p.y*x)<1e-8,pagina+': '+code+' mueve en el eje que ve el jugador, sin diagonal');
      }
      const pads=d.querySelectorAll('.ppPad'),gesto=(el,id,x,y)=>{const r=el.getBoundingClientRect();el.setPointerCapture=()=>{};el.dispatchEvent(new w.PointerEvent('pointerdown',{pointerId:id,pointerType:'touch',clientX:r.left+r.width*(.5+x*.3),clientY:r.top+r.height*(.5+y*.3),button:0,bubbles:true,cancelable:true}));};
      for(const [x,y] of [[1,0],[0,-1],[-1,0],[0,1]]){
        Object.assign(modelo.jugador,{x:0,y:0});gesto(pads[0],71,x,y);avanzar(.1);w.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:71}));
        const p=modelo.jugador;t.check(p.x*x+p.y*y>.3&&Math.abs(p.x*y-p.y*x)<1e-8,pagina+': el control táctil conserva su dirección en pantalla');
        modelo.enfriar=0;modelo.balas=[];gesto(pads[1],72,x,y);avanzar(.8);modelo.enfriar=0;modelo.balas=[];avanzar(.016);w.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:72}));
        const b=modelo.balas[0];t.check(!!b&&b.vx*x+b.vy*y>12&&Math.abs(b.vx*y-b.vy*x)<.01,pagina+': apuntar con el control derecho dispara por ese mismo eje');
      }
      const lienzo=d.querySelector('.ppLienzo');lienzo.setPointerCapture=()=>{};
      for(const [x,y] of [[1,0],[0,-1],[-1,0],[0,1]]){
        Object.assign(modelo.jugador,{x:0,y:0});modelo.enfriar=0;modelo.balas=[];avanzar(0);
        const r=lienzo.getBoundingClientRect(),op={pointerId:73,pointerType:'mouse',clientX:r.left+r.width/2+x*50,clientY:r.top+r.height/2+y*50,button:0,bubbles:true,cancelable:true};
        lienzo.dispatchEvent(new w.PointerEvent('pointermove',op));avanzar(.8);lienzo.dispatchEvent(new w.PointerEvent('pointerdown',op));avanzar(.016);w.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:73}));
        const b=modelo.balas[0];t.check(!!b&&b.vx*x+b.vy*y>12&&Math.abs(b.vx*y-b.vy*x)<.01,pagina+': el ratón apunta al lugar visible del lienzo');
      }
      // El cursor queda quieto mientras camina el personaje: el ángulo debe
      // seguir apuntando al mismo lugar visible, incluso con la cámara móvil.
      Object.assign(modelo.jugador,{x:0,y:0});avanzar(0);const rect=lienzo.getBoundingClientRect(),cursor={x:rect.left+rect.width/2+85,y:rect.top+rect.height/2};
      lienzo.dispatchEvent(new w.PointerEvent('pointermove',{pointerId:74,pointerType:'mouse',clientX:cursor.x,clientY:cursor.y,bubbles:true}));avanzar(.5);tecla('keydown','KeyW');avanzar(.4);tecla('keyup','KeyW');avanzar(.6);
      const esc=Math.min(rect.width/11.5,rect.height/12.5),pj=modelo.jugador,objetivo=Math.atan2(cursor.y-rect.top-rect.height/2-pj.y*esc*.64,cursor.x-rect.left-rect.width/2-pj.x*esc*.64),error=Math.atan2(Math.sin(pj.a-objetivo),Math.cos(pj.a-objetivo));
      t.check(pj.y<-1.5&&Math.abs(error)<.002,pagina+': caminar conserva la puntería hacia el cursor estacionario');
      // Levantar el dedo suelta ambos controles: no queda movimiento o fuego.
      const antes={...modelo.jugador},disparos=modelo.disparos;avanzar(.4);t.check(modelo.jugador.x===antes.x&&modelo.jugador.y===antes.y&&modelo.disparos===disparos,pagina+': soltar los controles detiene las acciones');
      w.PITAGORAS_PRUEBAS.cancelar();t.check((await promesa).cancelado&&!d.querySelector('.pitPrueba'),pagina+': salir limpia la escena cenital');
    }finally{M.crear=crear;w.PITAGORAS_PRUEBAS.cancelar();f.remove();}
  }
});

PRUEBAS.suite('pitagorasControlesFPS',async t=>{
  for(const [pagina,ancho,alto] of [['index.html',1440,900],['movil.html',390,844]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:'+ancho+'px;height:'+alto+'px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=controles-fps-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,M=w.PITAGORAS_PRUEBAS.modelo,crear=M.crear,poner=w.setTimeout,media=w.matchMedia;let ahora=10000,uid=0,modelo;const cuadros=new Map();
    try{
      w.requestAnimationFrame=fn=>{const id=++uid;cuadros.set(id,fn);return id;};w.cancelAnimationFrame=id=>cuadros.delete(id);w.performance.now=()=>ahora;w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:media.call(w,q);
      M.crear=op=>{modelo=crear(op);modelo.siguiente=Infinity;return modelo;};
      const avanzar=seg=>{ahora+=seg*1000;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
      const p=w.PITAGORAS_PRUEBAS.iniciar({tipo:'fps'});d.querySelector('.ppBotones .ppBoton').click();await sleep(20);avanzar(0);
      const pads=d.querySelectorAll('.ppPad'),mover=pads[0],mirar=pads[1],disparar=d.querySelector('.ppDisparo');t.check(!!disparar&&disparar!==mirar&&!mirar.contains(disparar),pagina+': mirar y disparar son controles separados');
      const r=mirar.getBoundingClientRect(),b=disparar.getBoundingClientRect();t.check(b.width>=44&&b.height>=44&&(b.right<=r.left||b.left>=r.right||b.bottom<=r.top||b.top>=r.bottom),pagina+': el botón de disparar tiene 44 px y no se superpone a la palanca');
      const dedo=(el,id,x=0,y=0)=>{const r=el.getBoundingClientRect();el.setPointerCapture=()=>{};el.dispatchEvent(new w.PointerEvent('pointerdown',{pointerId:id,pointerType:'touch',clientX:r.left+r.width*(.5+x*.3),clientY:r.top+r.height*(.5+y*.3),button:0,bubbles:true,cancelable:true}));};
      const soltar=id=>w.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:id,pointerType:'touch',bubbles:true}));
      Object.assign(modelo.jugador,{x:8,y:8,a:0});dedo(mover,81,0,-1);dedo(mirar,82,1,0);avanzar(.2);
      t.check(modelo.jugador.x>8&&modelo.jugador.a>0&&modelo.disparos===0,pagina+': dos palancas simultáneas caminan y giran sin disparar');
      dedo(disparar,83);avanzar(.1);t.check(modelo.disparos>0,pagina+': el tercer dedo dispara mientras ambos mandos siguen pulsados');
      soltar(81);soltar(82);const quieto={...modelo.jugador},tiros=modelo.disparos;avanzar(.5);
      t.check(modelo.jugador.x===quieto.x&&modelo.jugador.y===quieto.y&&modelo.jugador.a===quieto.a&&modelo.disparos>tiros,pagina+': soltar los mandos no suelta el disparo independiente');
      dedo(mirar,84,-1,0);soltar(83);const a=modelo.jugador.a,n=modelo.disparos;avanzar(.4);
      t.check(modelo.jugador.a<a&&modelo.disparos===n,pagina+': soltar el disparo permite seguir mirando sin balas involuntarias');
      w.dispatchEvent(new w.Event('blur'));const trasBlur={...modelo.jugador};avanzar(.4);t.check(modelo.jugador.a===trasBlur.a&&modelo.disparos===n,pagina+': perder foco libera todas las entradas sin pausar el reloj');
      w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Space',cancelable:true}));avanzar(.1);w.dispatchEvent(new w.KeyboardEvent('keyup',{code:'Space',cancelable:true}));t.check(modelo.disparos>n,pagina+': Espacio conserva un disparo independiente para escritorio');
      w.PITAGORAS_PRUEBAS.cancelar();t.check((await p).cancelado&&!d.querySelector('.pitPrueba'),pagina+': cancelar retira los tres controles');
    }finally{M.crear=crear;w.PITAGORAS_PRUEBAS.cancelar();f.remove();}
  }
});

PRUEBAS.suite('pitagorasCarrilesUI',async t=>{
  for(const [pagina,ancho,alto] of [['index.html',1440,900],['movil.html',390,844]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:'+ancho+'px;height:'+alto+'px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=carriles-ui-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,M=w.PITAGORAS_PRUEBAS.modelo,crear=M.crear,poner=w.setTimeout,media=w.matchMedia;let ahora=10000,uid=0,modelo;const cuadros=new Map();
    try{
      w.requestAnimationFrame=fn=>{const id=++uid;cuadros.set(id,fn);return id;};w.cancelAnimationFrame=id=>cuadros.delete(id);w.performance.now=()=>ahora;w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:media.call(w,q);M.crear=op=>{modelo=crear(op);modelo.siguiente=Infinity;return modelo;};
      const avanzar=(n=8)=>{for(let i=0;i<n;i++){ahora+=1000/60;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));}};
      const p=w.PITAGORAS_PRUEBAS.iniciar({tipo:'carrera'});d.querySelector('.ppBotones .ppBoton').click();await sleep(20);avanzar();
      const derecha=d.querySelector('.ppCarrilBoton[data-direccion="1"]'),izquierda=d.querySelector('.ppCarrilBoton[data-direccion="-1"]');for(const b of [derecha,izquierda]){const r=b.getBoundingClientRect();t.check(r.width>=44&&r.height>=44&&r.left>=0&&r.right<=w.innerWidth&&r.bottom<=w.innerHeight,pagina+': las flechas de carril caben y tienen al menos 44 px');}
      derecha.dispatchEvent(new w.PointerEvent('pointerdown',{pointerId:97,pointerType:'touch',button:0,bubbles:true,cancelable:true}));avanzar(25);t.igual(modelo.carril,1,pagina+': mantener una flecha táctil cambia un solo carril');w.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:97,pointerType:'touch'}));
      izquierda.focus();for(let i=0;i<2;i++){izquierda.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Enter',bubbles:true,cancelable:true}));izquierda.dispatchEvent(new w.KeyboardEvent('keyup',{code:'Enter',bubbles:true,cancelable:true}));}avanzar();
      t.check(modelo.carril===-1&&modelo.jugador.x===-1,pagina+': dos pulsaciones rápidas conservan ambos cambios de carril');
      for(let i=0;i<2;i++)derecha.dispatchEvent(new w.PointerEvent('pointerdown',{pointerId:98+i,pointerType:'touch',button:0,bubbles:true,cancelable:true}));avanzar();t.igual(modelo.carril,1,pagina+': dos toques entre fotogramas tampoco se fusionan');
      t.igual(modelo.salto,0,pagina+': usar las flechas no activa el salto de obstáculos');w.PITAGORAS_PRUEBAS.cancelar();t.check((await p).cancelado&&!d.querySelector('.pitPrueba'),pagina+': salir retira la cola de cambios pendientes');
    }finally{M.crear=crear;w.PITAGORAS_PRUEBAS.cancelar();f.remove();}
  }
});

PRUEBAS.suite('pitagorasMemoriaUI',async t=>{
  for(const [pagina,ancho,alto] of [['index.html',1440,900],['movil.html',390,844]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:'+ancho+'px;height:'+alto+'px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=memoria-ui-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,M=w.PITAGORAS_PRUEBAS.modelo,crear=M.crear,poner=w.setTimeout,media=w.matchMedia;let ahora=10000,uid=0,modelo;const cuadros=new Map();
    try{
      w.requestAnimationFrame=fn=>{const id=++uid;cuadros.set(id,fn);return id;};w.cancelAnimationFrame=id=>cuadros.delete(id);w.performance.now=()=>ahora;w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true}:media.call(w,q);M.crear=op=>(modelo=crear(op));
      const avanzar=seg=>{ahora+=seg*1000;const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
      const p=w.PITAGORAS_PRUEBAS.iniciar({tipo:'duelo',semilla:11});d.querySelector('.ppBotones .ppBoton').click();await sleep(20);avanzar(0);
      t.check(w.getComputedStyle(d.querySelector('.ppControles')).display==='none',pagina+': el puzzle retira palancas y presenta cartas como controles');
      for(let ronda=1;ronda<=3;ronda++){
        const cartas=[...d.querySelectorAll('.ppMemoriaCarta:not([hidden])')];t.igual(cartas.length,Math.min(7,4+ronda),pagina+': cantidad de cartas en ronda '+ronda);
        t.check(cartas.every(b=>b.disabled&&b.classList.contains('ppRevelada')),pagina+': las caras están a la vista sólo para memorizar');
        for(const b of cartas){const r=b.getBoundingClientRect();t.check(r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=w.innerWidth+1&&r.bottom<=w.innerHeight+1,pagina+': cada carta cabe y mantiene un blanco táctil de al menos 44 px');}
        const nombres=cartas.map(b=>b.getAttribute('aria-label').replace(/^Carta \d+: /,'')),pareja=cartas.map((_,i)=>i).filter(i=>nombres.indexOf(nombres[i])!==nombres.lastIndexOf(nombres[i]));t.igual(pareja.length,2,pagina+': las ilustraciones y etiquetas muestran exactamente una pareja');
        cartas[pareja[0]].click();avanzar(.05);t.check(!modelo.elegidasMemoria.length,pagina+': tocar mientras están reveladas no adelanta la selección');avanzar(modelo.hastaMemoria-modelo.t+.001);
        t.check(cartas.every(b=>!b.disabled&&!b.classList.contains('ppRevelada')&&b.getAttribute('aria-label').endsWith('oculta')),pagina+': al voltearlas se oculta también la identidad accesible');
        cartas[pareja[0]].click();avanzar(.016);t.check(modelo.elegidasMemoria.length===1&&cartas[pareja[0]].disabled&&cartas.filter(b=>b.classList.contains('ppRevelada')).length===1,pagina+': el primer clic revela sólo la carta escogida');
        w.dispatchEvent(new w.KeyboardEvent('keydown',{code:'Digit'+(pareja[1]+1),cancelable:true}));avanzar(.016);
        t.check(modelo.parejas===ronda&&modelo.faseMemoria==='resultado'&&cartas.every(b=>b.disabled),pagina+': una elección por teclado completa la pareja e impide dobles cobros');
        t.igual(d.querySelectorAll('.ppMemoriaSellos .ppLogrado').length,ronda,pagina+': el progreso refleja las parejas realmente encontradas');avanzar(.62);
      }
      t.check(w.scrollY===0&&w.getComputedStyle(d.documentElement).overflow==='hidden',pagina+': el puzzle permanece sin desplazamiento');w.PITAGORAS_PRUEBAS.cancelar();t.check((await p).cancelado&&!d.querySelector('.ppMemoria,.pitPrueba'),pagina+': salir limpia cartas y escuchas del puzzle');
    }finally{M.crear=crear;w.PITAGORAS_PRUEBAS.cancelar();f.remove();}
  }
});

PRUEBAS.suite('pitagorasImpactos',async t=>{
  const M=window.PITAGORAS_PRUEBAS.modelo,escenario=(hp=2,oculto=false)=>{const s=M.crear({tipo:'fps',semilla:1});s.siguiente=Infinity;Object.assign(s.jugador,{x:3.5,y:oculto?3.5:8.5,a:0});s.enemigos=[{id:1,x:6.5,y:s.jugador.y,r:.34,hp,vel:0,aparece:0,dolor:0,fase:0}];return s;};
  const acierto=escenario();M.paso(acierto,{accion:true},.016);t.check(acierto.enemigos[0].hp===1&&acierto.acierto>0&&!acierto.baja&&!acierto.fallo&&acierto.ultimoDisparo?.acerto&&!acierto.ultimoDisparo.letal,'FPS: un impacto confirmado tiene señal de acierto, distinta de fallo y baja');
  const baja=escenario(1);M.paso(baja,{accion:true},.016);t.check(baja.muertes===1&&baja.enemigos.length===0&&baja.baja>0&&baja.ultimoDisparo?.letal&&baja.caidos.length===1,'FPS: matar elimina al perseguidor y deja su animación de caída');M.paso(baja,{},.7);t.check(baja.caidos.length===0,'FPS: el cadáver animado se retira después de caer');
  const tapado=escenario(1,true);M.paso(tapado,{accion:true},.016);t.check(tapado.enemigos[0].hp===1&&!tapado.acierto&&!tapado.baja&&tapado.fallo>0&&tapado.ultimoDisparo?.acerto===false&&!tapado.caidos.length,'FPS: la columna bloquea daño, confirmación y muerte');
  const contacto=escenario();contacto.enemigos[0].x=contacto.jugador.x+.4;M.paso(contacto,{},.016);t.check(contacto.vidas===2&&!contacto.acierto&&!contacto.baja&&!contacto.caidos.length&&!contacto.eventos.some(e=>e==='acierto'||e==='eliminacion'),'FPS: recibir un contacto no confirma un disparo ni una baja inexistentes');
  const fallado=escenario();fallado.jugador.a=Math.PI/2;M.paso(fallado,{accion:true},.016);t.check(fallado.fallo>0&&!fallado.acierto&&!fallado.baja&&fallado.enemigos[0].hp===2,'FPS: disparar fuera del monstruo no reproduce la señal de acierto');
  const iso=M.crear({tipo:'isometrico'});iso.siguiente=Infinity;iso.proximaMarca=Infinity;Object.assign(iso.jugador,{x:0,y:0,a:Math.PI-.05});M.paso(iso,{apuntar:-Math.PI+.05},.016);
  t.check(iso.jugador.a>Math.PI-.05&&iso.jugador.a<Math.PI+.05&&iso.disparos===0,'Cosecha: cruza 180 grados por el arco corto y gira sin disparar');M.paso(iso,{apuntar:-Math.PI+.05},.8);t.check(Math.abs(Math.atan2(Math.sin(iso.jugador.a+Math.PI-.05),Math.cos(iso.jugador.a+Math.PI-.05)))<.002,'Cosecha: el giro continuo alcanza la orientación solicitada');
  iso.jugador.a=0;M.paso(iso,{mx:.3,my:.7},.016);t.check(iso.jugador.a>0&&iso.jugador.a<Math.atan2(.7,.3)&&iso.disparos===0,'Cosecha: caminar también orienta el cuerpo progresivamente');M.paso(iso,{apuntar:2,accion:true},.016);const b=iso.balas.at(-1);t.check(!!b&&Math.abs(Math.atan2(b.vy,b.vx)-iso.jugador.a)<1e-6,'Cosecha: la bala sale alineada al arma durante el giro');
  const marca=(edad,x)=>{const s=M.crear({tipo:'isometrico'});s.siguiente=Infinity;s.proximaMarca=Infinity;Object.assign(s.jugador,{x,y:0});s.marcas=[{x:0,y:0,edad,aviso:1.1,activo:.26,fuego:1.7,anchoFuego:.18,r:1.05,emitido:edad>=1.1}];return s;};
  const aviso=marca(1,0);M.paso(aviso,{},.09);t.igual(aviso.vidas,3,'Cosecha: el círculo no daña antes de explotar');M.paso(aviso,{},.02);t.igual(aviso.vidas,2,'Cosecha: la explosión daña dentro del disco');
  const centro=marca(1.5,0),aro=marca(1.5,1.05),fuera=marca(1.5,1.8);for(const s of [centro,aro,fuera])M.paso(s,{},.016);t.check(centro.vidas===3&&aro.vidas===2&&fuera.vidas===3,'Cosecha: después de explotar sólo quema el aro, con interior y exterior seguros');
  const ceniza=marca(3.1,1.05);M.paso(ceniza,{},.016);t.check(ceniza.vidas===3,'Cosecha: el aro deja de dañar al consumirse');M.paso(ceniza,{},1);t.check(!ceniza.marcas.length,'Cosecha: se limpia la ceniza del suelo');
  const lenta=M.avisoMarca({...aviso.marcas[0],edad:.1}),rapida=M.avisoMarca({...aviso.marcas[0],edad:1});t.check(rapida.frecuencia>lenta.frecuencia&&rapida.progreso>lenta.progreso,'Cosecha: el aviso acelera su parpadeo conforme se acerca la explosión');
});

PRUEBAS.suite('pitagorasCarrilesMemoria',async t=>{
  const API=window.PITAGORAS_PRUEBAS,M=API.modelo;
  const s=M.crear({tipo:'carrera'});s.siguiente=Infinity;M.paso(s,{mx:-1},.3);t.check(s.carril===-1&&s.jugador.x===-1,'Puente: una dirección termina en el carril izquierdo, nunca entre carriles');M.paso(s,{mx:1},.3);t.check(s.carril===0&&s.jugador.x===0,'Puente: cambiar de dirección avanza exactamente un carril');M.paso(s,{mx:1},1);t.check(s.carril===0,'Puente: mantener el mando no desliza ni cruza un segundo carril');M.paso(s,{mx:0},.02);M.paso(s,{mx:1},.3);t.check(s.carril===1&&s.jugador.x===1,'Puente: soltar y volver a pulsar habilita el siguiente salto de carril');M.paso(s,{},.02);M.paso(s,{mx:1},.3);t.check(s.carril===1,'Puente: el carril derecho es un límite firme');
  const centro=M.crear({tipo:'carrera'});centro.siguiente=Infinity;M.paso(centro,{mx:.3},.5);t.igual(centro.carril,0,'Puente: la zona muerta evita cambios por ruido del mando');
  const temprano=M.crear({tipo:'carrera'}),tarde=M.crear({tipo:'carrera'});temprano.invulnerable=tarde.invulnerable=60;M.paso(temprano,{},1);M.paso(tarde,{},16);t.check(tarde.velocidad>temprano.velocidad+3,'Puente: la velocidad aumenta durante el trayecto');t.check((tarde.siguiente-tarde.t)<1.46&&tarde.oleada>Math.floor(tarde.t/1.45),'Puente: los obstáculos aparecen con mayor frecuencia en la segunda mitad');
  const pareja=s=>s.cartasMemoria.map((v,i)=>i).filter(i=>s.cartasMemoria.indexOf(s.cartasMemoria[i])!==s.cartasMemoria.lastIndexOf(s.cartasMemoria[i]));
  const memoria=M.crear({tipo:'duelo',semilla:17});t.check(memoria.faseMemoria==='mostrar'&&memoria.cartasMemoria.length===5&&pareja(memoria).length===2,'Memoria: presenta cinco cartas con exactamente una pareja');
  const par=pareja(memoria);M.paso(memoria,{elegir:par[0]},.4);t.check(!memoria.elegidasMemoria.length,'Memoria: no acepta elecciones durante la exhibición');M.paso(memoria,{},.59);t.igual(memoria.faseMemoria,'mostrar','Memoria: conserva el primer segundo completo para memorizar');M.paso(memoria,{},.02);t.check(memoria.faseMemoria==='elegir'&&Math.abs(memoria.limiteMemoria-5)<1e-8,'Memoria: al ocultarse ofrece cinco segundos para elegir');
  M.paso(memoria,{elegir:-1},.016);M.paso(memoria,{elegir:999},.016);M.paso(memoria,{elegir:.5},.016);t.check(!memoria.elegidasMemoria.length,'Memoria: ignora índices fuera de la mesa y valores fraccionarios');
  M.paso(memoria,{elegir:par[0]},.2);M.paso(memoria,{elegir:par[0]},.2);M.paso(memoria,{},.02);M.paso(memoria,{elegir:par[0]},.02);t.check(memoria.elegidasMemoria.length===1&&memoria.parejas===0,'Memoria: mantener o repetir la misma carta no fabrica una pareja');
  M.paso(memoria,{},.016);M.paso(memoria,{elegir:par[1]},.016);t.check(memoria.parejas===1&&memoria.vidas===3&&memoria.faseMemoria==='resultado','Memoria: dos cartas iguales resuelven una pareja sin perder vida');const ronda=memoria.rondaMemoria;M.paso(memoria,{},.7);t.check(memoria.rondaMemoria===ronda+1&&memoria.cartasMemoria.length===6&&memoria.limiteMemoria<5,'Memoria: la ronda siguiente añade distractores y reduce el plazo');
  const error=M.crear({tipo:'duelo',semilla:1});M.paso(error,{},1.01);const a=0,b=error.cartasMemoria.findIndex(v=>v!==error.cartasMemoria[0]);M.paso(error,{elegir:a},.016);M.paso(error,{},.016);M.paso(error,{elegir:b},.016);t.check(error.vidas===2&&error.parejas===0&&error.faseMemoria==='resultado','Memoria: una pareja equivocada cuesta exactamente una vida');
  const timeout=M.crear({tipo:'duelo'});M.paso(timeout,{},5.99);t.check(timeout.vidas===3&&timeout.faseMemoria==='elegir','Memoria: el plazo no se cobra antes de los cinco segundos');M.paso(timeout,{},.03);t.check(timeout.vidas===2&&timeout.faseMemoria==='resultado','Memoria: agotar el plazo sin escoger una pareja cuesta una vida');M.paso(timeout,{},20);t.check(timeout.terminado&&!timeout.sobrevivio&&timeout.vidas===0,'Memoria: un fotograma ausente consume todas las rondas, sin victoria por inactividad');
  const insuficiente=M.crear({tipo:'duelo'});insuficiente.invulnerable=60;M.paso(insuficiente,{},20);t.check(insuficiente.terminado&&!insuficiente.sobrevivio,'Memoria: tener vidas al llegar al límite no basta sin tres parejas');
  const completo=M.crear({tipo:'duelo',semilla:8}),guia={};for(let i=0;i<1200&&!completo.terminado;i++)M.paso(completo,API.guiasPrueba.duelo(completo,guia),1/60);t.check(completo.terminado&&completo.sobrevivio&&completo.parejas>=3&&completo.t===20,'Memoria: recordar y escoger parejas permite ganar mediante entradas reales');
});

PRUEBAS.suite('pitagorasMinijuegosModelo', async t => {
  const M=window.PITAGORAS_PRUEBAS?.modelo;t.check(!!M,'Faltan los modelos de las seis pruebas.');
  const guiar=(s,mem)=>{
    if(window.PITAGORAS_PRUEBAS.guiasPrueba?.[s.tipo])return window.PITAGORAS_PRUEBAS.guiasPrueba[s.tipo](s,mem);
    const p=s.jugador;
    if(s.tipo==='isometrico'){const a=s.t*.8,dx=Math.cos(a)*4-p.x,dy=Math.sin(a)*4-p.y,d=Math.hypot(dx,dy)||1;return{mx:dx/d,my:dy/d,accion:true};}
    if(s.tipo==='laseres'){let mx=0,my=0;for(const r of s.rayos){if(r.edad>=r.aviso+r.activo)continue;const d=p.x*r.nx+p.y*r.ny-r.offset;if(Math.abs(d)<r.ancho+p.r+.65){let signo=d<0?-1:1;if(Math.abs(d)<.15)signo=r.nx*p.x+r.ny*p.y>0?-1:1;mx+=r.nx*signo*(1.4-Math.abs(d))*3;my+=r.ny*signo*(1.4-Math.abs(d))*3;}}return{mx,my};}
    const puntos=[[13.6,13.6],[2.4,13.6],[2.4,2.4],[13.6,2.4]];let destino=puntos[mem.i||0],dx=destino[0]-p.x,dy=destino[1]-p.y,d=Math.hypot(dx,dy);if(d<.4){mem.i=((mem.i||0)+1)%4;destino=puntos[mem.i];dx=destino[0]-p.x;dy=destino[1]-p.y;d=Math.hypot(dx,dy);}dx/=d;dy/=d;
    const enemigos=s.enemigos.filter(e=>e.aparece<=0).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)),a=enemigos[0]?Math.atan2(enemigos[0].y-p.y,enemigos[0].x-p.x):Math.atan2(dy,dx),da=Math.atan2(Math.sin(a-p.a),Math.cos(a-p.a));
    return{mx:-dx*Math.sin(p.a)+dy*Math.cos(p.a),my:-dx*Math.cos(p.a)-dy*Math.sin(p.a),giro:da*8,accion:true};
  };
  for(const tipo of ['isometrico','laseres','fps','carrera','orbital','duelo']){
    const quieto=M.crear({tipo,semilla:6});for(let i=0;i<1200&&!quieto.terminado;i++)M.paso(quieto,{},1/60);
    t.check(quieto.terminado&&!quieto.sobrevivio&&quieto.vidas===0&&quieto.t<20,tipo+': los peligros causan una derrota real sin jugar.');
    const s=M.crear({tipo,semilla:1}),repetido=M.crear({tipo,semilla:1}),mem={},otro={};
    for(let i=0;i<1200&&!s.terminado;i++){M.paso(s,guiar(s,mem),1/60);M.paso(repetido,guiar(repetido,otro),1/60);}
    t.check(s.terminado&&s.sobrevivio&&s.vidas>0&&s.t===20,tipo+': se puede sobrevivir veinte segundos con movimiento y combate reales.');
    t.check(JSON.stringify(M.instantanea(s))===JSON.stringify(M.instantanea(repetido)),tipo+': semilla y controles reproducen exactamente la partida.');
    const reloj=M.crear({tipo});reloj.siguiente=Infinity;reloj.proximaMarca=Infinity;reloj.invulnerable=60;const memoriaReloj={};while(reloj.t<19.99-1e-8&&!reloj.terminado)M.paso(reloj,tipo==='duelo'?guiar(reloj,memoriaReloj):{},Math.min(1/60,19.99-reloj.t));t.check(!reloj.terminado,tipo+': no hay victoria antes de veinte segundos.');M.paso(reloj,{},.01);t.check(reloj.terminado&&reloj.sobrevivio&&reloj.t===20,tipo+': el límite exacto de tiempo resuelve la supervivencia.');
    t.nota(tipo+': supervivencia real en 20 s con '+s.vidas+' vidas; inmóvil pierde en '+quieto.t.toFixed(2)+' s.');
  }
  const dano=M.crear({tipo:'fps'});dano.siguiente=Infinity;M.herir(dano);for(let i=0;i<60;i++)M.herir(dano);t.check(dano.vidas===2,'Un contacto múltiple no consume las tres vidas.');M.paso(dano,{},1.11);M.herir(dano);t.check(dano.vidas===1,'La invulnerabilidad expira y permite un segundo golpe.');M.paso(dano,{},1.11);M.herir(dano);t.check(dano.terminado&&!dano.sobrevivio&&dano.vidas===0,'El tercer golpe termina el intento.');
  const laser=M.crear({tipo:'laseres'});laser.siguiente=Infinity;laser.rayos=[{nx:1,ny:0,offset:laser.jugador.x,edad:0,aviso:1.4,activo:.36,ancho:.37}];M.paso(laser,{},1.3);t.check(laser.vidas===3,'El aviso del láser no hace daño.');M.paso(laser,{},.11);t.check(laser.vidas===2,'El láser activo colisiona en la franja anunciada.');
  const iso=M.crear({tipo:'isometrico'});iso.siguiente=Infinity;iso.proximaMarca=Infinity;Object.assign(iso.jugador,{x:0,y:0,a:0});iso.enemigos=[{id:1,x:1,y:0,r:.35,hp:1,vel:0,aparece:0,dolor:0,fase:0}];M.paso(iso,{accion:true,apuntar:0},.03);t.check(iso.muertes===1&&iso.enemigos.length===0,'El disparo cenital elimina al monstruo que toca.');
  const fps=M.crear({tipo:'fps'});fps.siguiente=Infinity;Object.assign(fps.jugador,{x:3.5,y:3.5,a:0});fps.enemigos=[{id:1,x:6.5,y:3.5,r:.34,hp:2,vel:0,aparece:0,dolor:0,fase:0}];M.paso(fps,{accion:true},.03);t.check(fps.enemigos[0].hp===2,'Los disparos FPS no atraviesan las columnas.');M.paso(fps,{my:-1},.5);t.check(fps.jugador.x<3.73,'El jugador FPS colisiona con las paredes.');
  const visible=M.crear({tipo:'fps'});visible.siguiente=Infinity;Object.assign(visible.jugador,{x:3.5,y:8.5,a:0});visible.enemigos=[{id:1,x:6.5,y:8.5,r:.34,hp:2,vel:0,aparece:0,dolor:0,fase:0}];M.paso(visible,{accion:true},.03);t.check(visible.enemigos[0].hp===1,'Apuntar y disparar en FPS daña al perseguidor visible.');
  // Encuentros controlados: cada acción cambia una colisión real; las guías
  // anteriores no bastarían si el juego pudiera ganarse ignorando su mecánica.
  const puente=(tipo,entrada)=>{const s=M.crear({tipo:'carrera'});s.siguiente=Infinity;s.obstaculos=[{id:1,z:2.5,carril:0,tipo,paso:false}];M.paso(s,entrada,.3);return s;};
  t.check(puente('sello',{}).vidas===2&&puente('sello',{accion:true}).vidas===3,'Carrera: saltar libra un sello que daña al cruzarlo por tierra.');
  t.check(puente('columna',{accion:true}).vidas===2&&puente('columna',{mx:1}).vidas===3,'Carrera: una columna exige cambiar de carril; saltar no la atraviesa.');
  const nave=M.crear({tipo:'orbital'});nave.siguiente=Infinity;
  const proyectil=()=>nave.balas.push({x:nave.jugador.x,y:nave.jugador.y,vx:0,vy:0,r:.2,t:1,edad:0});
  proyectil();M.paso(nave,{accion:true},.02);t.check(nave.vidas===3&&nave.muertes===1&&nave.balas.length===0,'Órbita: el escudo absorbe y destruye un proyectil en contacto.');
  M.paso(nave,{},.6);proyectil();M.paso(nave,{accion:true},.02);t.check(nave.vidas===2,'Órbita: el escudo agotado no puede reutilizarse durante su recarga.');
  M.paso(nave,{},2.1);proyectil();M.paso(nave,{accion:true},.02);t.check(nave.vidas===2&&nave.muertes===2,'Órbita: al recargarse vuelve a proteger.');


});


PRUEBAS.suite('pitagorasIntegracion',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=editor-integracion-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,interferencia=w.campanaInterferenciaPitagoras,rapida=w.fastWindow,objetivos=w.resolveTargets,resolverDado=w.resolverD20,finTurno=w.endTurn;let eventos=[],finales=[];
    try{
      Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});w.matchMedia=()=>({matches:true});
      // Sólo abreviamos las pausas cosméticas; ninguna promesa del minijuego
      // se resuelve hasta que la prueba entrega explícitamente un resultado.
      w.setTimeout=(fn,ms,...args)=>poner(fn,Math.min(ms,1),...args);
      for(const nombre of ['fxSpell','fxFace','fxHit','fxTrap'])w[nombre]=async()=>{};
      for(const nombre of ['fxNotice','fxAterriza','fxObj','fxStat','fxNumber'])w[nombre]=()=>{};
      w.ask=async()=>1;w.campanaFinalSecreto=(ganador,motivo)=>{finales.push({ganador,motivo});};
      const hasta=async(pred,mensaje)=>{for(let n=0;n<400&&!pred();n++)await sleep(0);t.check(pred(),pagina+': '+mensaje);};
      const arena=(side=1,jefe=true)=>{
        w.newGame('fender','adreida');w.campanaGuardar({version:1,id:'editor-prueba',lider:'fender',etapa:6,secreto:'combate'});
        w.eval("G.phase='principal';G.active="+side+";G.turnNo=3;P(0).pd=P(1).pd=20;P(0).alma=P(1).alma=20;P(0).hand=[];P(1).hand=[];P(0).leaderUsed=P(1).leaderUsed=true;G.campana="+(jefe?"{id:'editor-prueba',etapa:6,jefeSecreto:true}":'undefined'));
        eventos=[];finales=[];w.showScreen('board');return w.eval('G');
      };
      const inmediato=resultado=>{w.campanaInterferenciaPitagoras=async(side,id,g)=>{eventos.push({side,id,g});return resultado;};};
      const diferir=()=>{const pendientes=[];w.campanaInterferenciaPitagoras=(side,id,g)=>new Promise(resolve=>{eventos.push({side,id,g});pendientes.push(resolve);});return pendientes;};
      // Las seis clases pasan por la misma frontera, después de pagar y
      // resolver la carta. La ficha que crea Ilusión no es otra carta jugada.
      for(const id of ['matildus','nubedagas','peaje','puntosrobados','collar','puente','ilusion']){
        arena();inmediato({sobrevivio:true,cancelado:false});let ts;
        if(id==='collar'){const u=w.mkUnit('minus',1);w.eval('P(1)').field.push(u);w.recalc();ts=[[u]];}
        w.eval('P(1)').hand=[id];t.check(await w.playFromHand(1,id,ts),pagina+': se juega '+id);
        t.check(eventos.length===1&&eventos[0].id===id&&eventos[0].side===1,pagina+': una sola interferencia por '+id);
        t.igual(w.eval('P(1).alma'),18,pagina+': sobrevivir quita exactamente 2 al Editor');t.igual(w.eval('P(0).alma'),20,pagina+': sobrevivir no daña al jugador');
        if(id==='ilusion')t.igual(w.eval('P(1).field.length'),1,pagina+': Ilusión invoca una ficha sin interrupción extra');
      }
      arena();inmediato({sobrevivio:false,cancelado:false});w.eval("P(1).hand=['matildus']");await w.playFromHand(1,'matildus');t.igual(w.eval('P(0).alma'),18,pagina+': fallar quita 2 al jugador');t.igual(w.eval('P(1).alma'),20,pagina+': fallar no daña al Editor');
      arena();inmediato({cancelado:true});w.eval("P(1).hand=['matildus']");await w.playFromHand(1,'matildus');t.igual(w.eval('P(0).alma+P(1).alma'),40,pagina+': cancelar no inflige daño');
      // Una anulación sucede después del pago: la carta sí fue jugada.
      arena();inmediato({sobrevivio:true});w.eval("P(1).hand=['nubedagas'];P(0).traps=[{id:'notario'}]");await w.playFromHand(1,'nubedagas');
      t.check(eventos.length===1&&eventos[0].id==='nubedagas'&&w.eval("P(1).grave.includes('nubedagas')&&P(1).clouds.length===0"),pagina+': el hechizo anulado cuenta una vez sin resolver su efecto.');
      // Coste insuficiente y selección cancelada nunca cruzan la frontera.
      arena();inmediato({sobrevivio:true});w.eval("P(1).hand=['minus'];P(1).pd=0");t.check(!await w.playFromHand(1,'minus')&&!eventos.length,pagina+': sin PD no hay minijuego.');
      arena();inmediato({sobrevivio:true});w.eval("P(1).hand=['collar']");w.eval('P(1)').field.push(w.mkUnit('minus',1));w.recalc();w.resolveTargets=async()=>null;
      t.check(!await w.playFromHand(1,'collar')&&!eventos.length&&w.eval("P(1).hand.includes('collar')&&P(1).pd===20"),pagina+': cancelar objetivos no juega ni interrumpe.');w.resolveTargets=objetivos;
      for(const caso of ['jugador','normal','auto','fast','silent','online','guest','sala']){
        arena(caso==='jugador'?0:1,caso!=='normal');inmediato({sobrevivio:true});
        if(['auto','fast','silent','online','guest'].includes(caso))w.eval('G.'+caso+'=true');if(caso==='sala')w.eval('NET.on=true');
        const side=caso==='jugador'?0:1;w.eval('P('+side+')').hand=['matildus'];await w.playFromHand(side,'matildus');
        t.check(!eventos.length&&w.eval('P(0).alma+P(1).alma')===40,pagina+': no modifica '+caso);w.eval('NET.on=false');
      }
      arena();inmediato({sobrevivio:true});await w.summonToken(1,'tok_ilusion');w.eval("P(1).traps=[{id:'peaje'}]");await w.trapWindow(1,'ataqueAlma',{});t.check(!eventos.length,pagina+': activar una trampa o invocar una ficha no es jugar otra carta.');
      // El rival responde desde la mano durante nuestro turno. No pasa por
      // playFromHand, pero debe abrir exactamente la misma interrupción.
      arena(0);inmediato({sobrevivio:true});w.eval("P(1).hand=['contrahechizo']");const contra={cardId:'espiritus',countered:false};await w.fastWindow(1,{kind:'hechizo',ev:contra});
      t.check(contra.countered&&eventos.length===1&&eventos[0].id==='contrahechizo'&&w.eval('P(1).alma')===18,pagina+': respuesta rápida del Editor contada una vez.');
      // Dos cartas de la IA: mientras no respondamos, la segunda sigue en
      // su mano y el turno no llega al combate ni al relevo del jugador.
      arena();const pendientes=diferir();w.eval("P(1).hand=['matildus','minus']");let termino=false,cedio=false;w.endTurn=async()=>{cedio=true;};
      const turno=w.aiTurn().then(()=>{termino=true;});await hasta(()=>eventos.length>=1,'la primera carta abre la interrupción');await sleep(20);
      t.check(eventos.length===1&&!termino&&!cedio&&w.eval('G.busy&&P(1).hand.length===1&&P(1).field.length===1'),pagina+': la IA espera el minijuego.');
      pendientes[0]({sobrevivio:true});await hasta(()=>eventos.length===2,'la IA sólo juega la segunda carta al resolver la primera');
      t.check(!termino&&!cedio,pagina+': el segundo minijuego también mantiene detenido el turno.');pendientes[1]({sobrevivio:false});await turno;w.endTurn=finTurno;
      t.check(cedio&&w.eval('P(0).alma===18&&P(1).alma===18'),pagina+': un resultado por carta y después continúa la IA.');
      // Cancelar una respuesta rápida al empezar otra partida no deja que el
      // hechizo suspendido modifique las cartas o el Alma de la partida nueva.
      arena(0);const respuesta=diferir();w.eval("P(0).hand=['espiritus'];P(1).hand=['contrahechizo']");const hechizo=w.playFromHand(0,'espiritus');await hasta(()=>respuesta.length===1,'respuesta rápida pendiente');
      w.newGame('fender','adreida');const nueva=w.eval('G');respuesta[0]({sobrevivio:true});await hechizo;
      t.check(w.eval('G')===nueva&&w.eval('P(0).alma===20&&P(1).alma===20&&P(0).spirits===0'),pagina+': no reanuda el hechizo anterior en otra partida.');
      arena(0);const repeticion=diferir();let tiradas=0;w.resolverD20=async()=>{tiradas++;return 17;};w.eval("P(1).hand=['puas']");const dado=w.roll('Prueba del Editor',0);await hasta(()=>repeticion.length===1,'Púas interrumpe la tirada');
      w.newGame('fender','adreida');repeticion[0]({sobrevivio:true});t.igual(await dado,0,pagina+': una tirada cancelada no entrega un valor antiguo');t.igual(tiradas,1,pagina+': no pide otro d20 tras empezar una partida nueva');w.resolverD20=resolverDado;
      // El cero de cancelación no es una tirada baja para Hongos: al volver
      // del minijuego no puede matar un aliado creado en otra partida.
      arena(0);const viajeInterrumpido=diferir();w.resolverD20=async()=>17;w.eval("P(0).hand=['hongos'];P(1).hand=['puas']");
      const hongos=w.playFromHand(0,'hongos');await hasta(()=>viajeInterrumpido.length===1,'Púas del Editor abre una prueba durante Hongos');
      t.check(eventos[0].id==='puas'&&w.eval("!P(0).hand.includes('hongos')&&P(0).pd===19&&P(1).grave.includes('puas')"),pagina+': ambas cartas fueron jugadas antes de cancelar el minijuego');
      w.newGame('fender','adreida');const partidaNueva=w.eval('G'),aliadoNuevo=w.mkUnit('matildus',0);w.eval('P(0)').field.push(aliadoNuevo);w.recalc();
      viajeInterrumpido[0]({sobrevivio:true});await hongos;w.resolverD20=resolverDado;
      t.check(w.eval('G')===partidaNueva&&aliadoNuevo.alive&&w.eval('P(0)').field.includes(aliadoNuevo)&&w.eval('P(0).grave.length===0&&P(0).alma===20&&P(1).alma===20&&!G.over'),pagina+': Hongos cancelado no interpreta cero ni mata al aliado de la partida nueva');
      // La ventana de respuesta de un ataque comparte esa frontera. Su
      // finally tampoco puede desbloquear una resolución de la partida nueva.
      arena(0);let seguirAtaque;w.fastWindow=async()=>new Promise(r=>{seguirAtaque=r;});const atacante=w.mkUnit('matildus',0);atacante.sick=false;w.eval('P(0)').field.push(atacante);w.recalc();
      const ataque=w.doAttack(atacante,'face');await hasta(()=>!!seguirAtaque,'ataque suspendido en su ventana de respuesta');w.newGame('fender','adreida');w.eval('G.resolving=true');seguirAtaque();await ataque;
      t.check(w.eval('P(0).alma===20&&P(1).alma===20&&G.resolving'),pagina+': el ataque cancelado no daña ni desbloquea la partida nueva.');w.fastWindow=rapida;
      // Llegar a cero sigue entrando al final secreto mediante showEnd.
      for(const sobrevivio of [true,false]){
        arena();inmediato({sobrevivio});w.eval('P('+(sobrevivio?1:0)+').alma=2');w.eval("P(1).hand=['matildus']");await w.playFromHand(1,'matildus');
        await hasta(()=>finales.length===1,'el daño letal entra en el final de campaña');t.igual(finales[0].ganador,sobrevivio?0:1,pagina+': ganador correcto del daño letal');t.check(w.eval('G.over'),pagina+': el combate termina al llegar a cero');
      }
      // El controlador real conserva el estado de resolución, alterna las
      // seis pruebas y cancela la promesa al abandonar la mesa o cambiar G.
      w.campanaInterferenciaPitagoras=interferencia;const llamadas=[],respuestas=[];let cancelaciones=0;
      w.PITAGORAS_PRUEBAS={iniciar:op=>{llamadas.push(op);return new Promise(r=>respuestas.push(r));},cancelar:()=>{cancelaciones++;respuestas.at(-1)?.({cancelado:true});}};
      arena();const actual=w.eval('G');w.eval('G.resolving=true');
      for(let i=0;i<7;i++){
        const esperando=w.campanaInterferenciaPitagoras(1,'matildus',actual);await hasta(()=>llamadas.length===i+1,'abre prueba '+i);
        t.check(w.eval('G.editorEnPrueba&&G.resolving'),pagina+': pausa los controles mientras se juega.');t.igual(llamadas[i].duracion,20,pagina+': duración de veinte segundos');respuestas[i]({sobrevivio:true,cancelado:false});await esperando;
        t.check(w.eval('G.resolving')===true&&!w.eval('G.editorEnPrueba'),pagina+': restaura la resolución previa.');
      }
      t.check(llamadas.map(x=>x.tipo).join(',')==='isometrico,laseres,fps,carrera,orbital,duelo,isometrico',pagina+': recorre los seis minijuegos y reinicia el ciclo.');
      for(const salida of ['menu','nuevo','revancha']){
        arena();const antes=llamadas.length;
        w.eval("P(1).hand=['matildus']");const carta=w.playFromHand(1,'matildus');await hasta(()=>llamadas.length>antes,'minijuego para cancelar '+salida);
        const tarde=respuestas.at(-1);
        if(salida==='menu')w.showScreen('menu');else if(salida==='nuevo')w.newGame('fender','adreida');else{w.cortinillaVS=async()=>{};await w.startMatch('fender','adreida',{volado:false,first:0});}
        tarde({sobrevivio:true});await carta;t.check(!w.eval('G.editorEnPrueba'),pagina+': salir cancela la prueba pendiente');t.check(w.eval('P(0).alma===20&&P(1).alma===20'),pagina+': el resultado tardío de '+salida+' no hace daño.');
      }
      t.check(cancelaciones>=3,pagina+': cancela también la escena de minijuego.');
    }finally{w.eval('NET.on=false');w.campanaCancelarInterferencia?.();w.campanaCerrar();w.relojPara();w.setTimeout=poner;w.fastWindow=rapida;w.resolveTargets=objetivos;w.resolverD20=resolverDado;w.endTurn=finTurno;w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});


PRUEBAS.suite('pitagorasContinuidad',async t=>{
  for(const [pagina,ancho,alto] of [['index.html',1440,900],['movil.html',390,844]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:'+ancho+'px;height:'+alto+'px;border:0';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=continuidad-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,quitar=w.clearTimeout,raf=w.requestAnimationFrame,caf=w.cancelAnimationFrame,reloj=w.performance.now;
    const montar=w.montarRevelacionPitagoras,empezar=w.startMatch,clave=w.eval('CAMPANA_CLAVE'),guardado=w.localStorage.getItem(clave);
    const pendientes=new Map(),cuadros=new Map();let ahora=10000,id=990000,revelacion=null,partidas=[];
    const avanzar=ms=>{const hasta=ahora+ms;let limite=0;for(;;){const p=[...pendientes].sort((a,b)=>a[1].cuando-b[1].cuando)[0];if(!p||p[1].cuando>hasta)break;t.check(++limite<200,'Temporizadores finitos');pendientes.delete(p[0]);ahora=p[1].cuando;p[1].fn();}ahora=hasta;};
    const pintar=()=>{const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
    const tienePixeles=c=>{const foto=d.createElement('canvas');foto.width=c.width;foto.height=c.height;const ctx=foto.getContext('2d');ctx.drawImage(c,0,0);return ctx.getImageData(0,0,foto.width,foto.height).data.some((v,i)=>i%4===3&&v>0);};
    try{
      w.setTimeout=(fn,ms=0,...args)=>{const k=++id;pendientes.set(k,{cuando:ahora+Math.max(0,Number(ms)||0),fn:()=>fn(...args)});return k;};w.clearTimeout=k=>{if(!pendientes.delete(k))quitar(k);};
      w.requestAnimationFrame=fn=>{const k=++id;cuadros.set(k,fn);return k;};w.cancelAnimationFrame=k=>{if(!cuadros.delete(k))caf(k);};w.performance.now=()=>ahora;
      Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});
      w.montarRevelacionPitagoras=(host,op)=>{revelacion=montar(host,op);return revelacion;};
      w.startMatch=(a,b,op)=>{partidas.push({a,b,op});return Promise.resolve();};
      w.campanaGuardar({version:1,id:'continuidad-'+pagina,lider:'fender',etapa:6,secreto:'revelacion',prueba:true,personaje:w.campanaNormalizarPersonaje({nombre:'Ariadna',color:'violeta',equipo:'libro'})});
      w.campanaAbrirSecreto();
      t.check(revelacion&&d.querySelector('#campanaSecreto').dataset.fase==='revelacion',pagina+': el controlador monta la revelación real');
      if(!revelacion.imagen.complete||!revelacion.imagen.naturalWidth)await new Promise(r=>revelacion.imagen.addEventListener('load',r,{once:true}));
      const seccion=revelacion.elemento,imagen=revelacion.imagen,mini=seccion.querySelector('.pitFiguraTestigo canvas');
      pintar();t.check(mini&&tienePixeles(mini),pagina+': miniatura dibujada antes del traspaso');
      avanzar(1800);pintar();const antes=mini.getBoundingClientRect();avanzar(5800);pintar();
      const panel=d.querySelector('#campanaSecreto'),despues=d.querySelector('.pitFiguraTestigo canvas'),boss=d.querySelector('.pitBoss');
      t.igual(panel.dataset.fase,'trono',pagina+': el callback real guarda y abre el encuentro');
      t.igual(w.campanaLeer().secreto,'trono',pagina+': el controlador persiste el encuentro');
      t.check(d.querySelector('.pitAbismo')===seccion&&d.querySelector('.pitCriaturaImagen')===imagen&&despues===mini,pagina+': conserva sección, imagen decodificada y canvas, sin reconstrucción');
      t.check(tienePixeles(despues),pagina+': el primer cuadro del encuentro conserva al viajero visible');
      const rect=despues.getBoundingClientRect();t.check(Math.abs(rect.x-antes.x)<1&&Math.abs(rect.y-antes.y)<1,pagina+': la miniatura tampoco salta de posición');
      t.check(d.querySelectorAll('.pitBoss').length===1&&!boss.disabled&&boss.tabIndex===0&&!boss.hasAttribute('aria-hidden'),pagina+': un solo objetivo accesible al terminar la revelación');
      boss.click();boss.click();await Promise.resolve();
      t.igual(partidas.length,1,pagina+': doble clic inicia una sola partida');
      t.check(partidas[0].b==='adreida'&&partidas[0].op.campana.jefeSecreto&&partidas[0].op.nombres[0]==='Ariadna',pagina+': conserva las reglas del jefe y la identidad del viajero');
      t.check(!seccion.isConnected&&!d.querySelector('#campanaSecreto'),pagina+': el combate desmonta la escena al salir');
      avanzar(20000);pintar();t.check(!d.querySelector('#campanaSecreto')&&partidas.length===1,pagina+': temporizadores tardíos no reabren el encuentro');
    }finally{
      w.campanaCancelarSecreto();w.relojPara();w.montarRevelacionPitagoras=montar;w.startMatch=empezar;w.setTimeout=poner;w.clearTimeout=quitar;w.requestAnimationFrame=raf;w.cancelAnimationFrame=caf;w.performance.now=reloj;
      if(guardado===null)w.localStorage.removeItem(clave);else w.localStorage.setItem(clave,guardado);f.remove();
    }
  }
});


PRUEBAS.suite('pitagorasRevelacion',async t=>{
  for(const [pagina,ancho,alto] of [['index.html',1440,900],['movil.html',320,568]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;border:0;width:'+ancho+'px;height:'+alto+'px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=revelacion-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,quitar=w.clearTimeout,raf=w.requestAnimationFrame,caf=w.cancelAnimationFrame,reloj=w.performance.now,media=w.matchMedia,prop=Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype,'src');
    const pendientes=new Map(),cuadros=new Map(),escenas=[];let ahora=10000,id=980000,bloquear=false,reducido=false;
    const host=d.createElement('div');host.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:999999;background:#000';d.body.appendChild(host);
    const avanzar=ms=>{const hasta=ahora+ms;let guardia=0;for(;;){const p=[...pendientes].sort((a,b)=>a[1].cuando-b[1].cuando)[0];if(!p||p[1].cuando>hasta)break;t.check(++guardia<200,pagina+': temporizadores finitos');pendientes.delete(p[0]);ahora=p[1].cuando;p[1].fn();}ahora=hasta;};
    const pintar=()=>{const fs=[...cuadros.values()];cuadros.clear();fs.forEach(fn=>fn(ahora));};
    const crear=op=>{const e=w.montarRevelacionPitagoras(host,{personaje:{nombre:'Ari',color:'azul',equipo:'baston'},origen:{x:.4,y:.42},...op});escenas.push(e);return e;};
    const cargada=e=>new Promise(resolve=>{if(e.elemento.dataset.arte==='listo')resolve();else e.imagen.addEventListener('load',resolve,{once:true});});
    try{
      w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:reducido}:media.call(w,q);
      w.setTimeout=(fn,ms=0,...args)=>{const k=++id;pendientes.set(k,{cuando:ahora+Math.max(0,Number(ms)||0),fn:()=>fn(...args)});return k;};w.clearTimeout=k=>{if(!pendientes.delete(k))quitar(k);};
      w.performance.now=()=>ahora;w.requestAnimationFrame=fn=>{const k=++id;cuadros.set(k,fn);return k;};w.cancelAnimationFrame=k=>{if(!cuadros.delete(k))caf(k);};
      Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});
      Object.defineProperty(w.HTMLImageElement.prototype,'src',{...prop,set(v){if(bloquear&&String(v).includes('pitagoras-abismo'))this.dataset.demora=v;else prop.set.call(this,v);}});
      let reveladas=0;const e=crear({onRevelado:()=>reveladas++});await cargada(e);
      const inicial=e.testigo.getBoundingClientRect(),ojos=e.elemento.querySelector('.pitOjos');
      t.igual(w.getComputedStyle(e.elemento).backgroundColor,'rgb(0, 0, 0)',pagina+': negro total desde el primer cuadro');
      t.check(w.getComputedStyle(e.imagen).opacity==='0'&&w.getComputedStyle(ojos).opacity==='0'&&w.getComputedStyle(e.elemento.querySelector('.pitBossNombre')).opacity==='0',pagina+': al inicio sólo se ve el héroe, sin rival ni textos.');
      t.check(Math.abs(inicial.left+inicial.width/2-ancho*.4)<1&&Math.abs(inicial.bottom-alto*.42)<1,pagina+': parte del punto del ascenso en el visor.');
      const mini=e.testigo.querySelector('canvas');t.check(mini?.width>0&&mini.height>0,pagina+': conserva la miniatura real iluminada.');
      e.boss.click();avanzar(1800);pintar();const abajo=e.testigo.getBoundingClientRect();
      t.check(abajo.bottom>inicial.bottom+alto*.2&&Math.abs(abajo.left+abajo.width/2-ancho/2)<1,pagina+': el héroe desciende hacia el centro inferior.');
      t.check(cuadros.size===0,pagina+': termina el dibujo continuo al completar el desplazamiento.');
      avanzar(400);t.igual(e.elemento.dataset.fase,'ojos',pagina+': aparecen los ojos antes del cuerpo');t.igual(w.getComputedStyle(e.imagen).opacity,'0',pagina+': el cuerpo sigue completamente oculto al aparecer los ojos');
      t.check(w.getComputedStyle(ojos).transitionDuration!=='0s',pagina+': los ojos tienen entrada gradual, sin destellos.');
      avanzar(1400);t.igual(e.elemento.dataset.fase,'surgiendo',pagina+': comienza la aparición lenta');
      t.igual(w.getComputedStyle(e.imagen).transitionDuration,'3.6s',pagina+': el cuerpo se descubre con un fundido largo');
      avanzar(3999);t.check(!e.revelado&&reveladas===0,pagina+': no habilita combate mientras termina la aparición.');avanzar(1);
      t.check(e.revelado&&reveladas===1&&e.elemento.dataset.fase==='revelado',pagina+': revela una sola vez tras el fundido.');
      // La nueva escena recibe el MISMO nodo decodificado: evita un cuadro vacío.
      const imagen=e.imagen,antes=e.presencia.getBoundingClientRect(),trono=w.montarEscenaPitagoras(host,{personaje:{nombre:'Ari',color:'azul',equipo:'baston'}});escenas.push(trono);e.destruir();
      const despues=trono.presencia.getBoundingClientRect(),objetivo=trono.boss.getBoundingClientRect();
      t.check(trono.imagen===imagen&&trono.imagen.naturalWidth>0,pagina+': reutiliza la imagen decodificada al entrar al encuentro.');
      t.check(w.getComputedStyle(trono.imagen).opacity==='1'&&w.getComputedStyle(trono.imagen).transitionDuration==='0s',pagina+': no vuelve a ocultar al monstruo al terminar la revelación.');
      t.check(Math.abs(antes.x-despues.x)<1&&Math.abs(antes.y-despues.y)<1&&Math.abs(antes.width-despues.width)<1&&Math.abs(antes.height-despues.height)<1,pagina+': el monstruo no cambia de tamaño ni posición.');
      t.check(objetivo.width>=44&&objetivo.height>=44&&objetivo.bottom<=alto-80,pagina+': área de combate tocable y separada del menú.');trono.destruir();
      bloquear=true;let lentas=0;const lenta=crear({onRevelado:()=>lentas++});avanzar(8000);t.check(!lenta.revelado&&lentas===0&&lenta.elemento.dataset.fase==='ojos',pagina+': una imagen lenta conserva ojos y negro, no muestra de golpe el cuerpo.');
      prop.set.call(lenta.imagen,lenta.imagen.dataset.demora);await cargada(lenta);t.igual(lenta.elemento.dataset.fase,'surgiendo',pagina+': cuando llega la imagen comienza su fundido completo');
      avanzar(3999);t.igual(lentas,0,pagina+': también espera el fundido con red lenta');avanzar(1);t.igual(lentas,1,pagina+': la carga lenta termina sin bloquear');lenta.destruir();
      let fallidas=0;const fallida=crear({onRevelado:()=>fallidas++});fallida.imagen.dispatchEvent(new w.Event('error'));
      t.check(fallida.elemento.dataset.arte==='alternativa'&&w.getComputedStyle(fallida.elemento.querySelector('.pitContorno')).opacity==='0',pagina+': fallar el arte tampoco muestra contenido en el negro inicial.');
      avanzar(7600);t.check(fallida.revelado&&fallidas===1,pagina+': el error del arte ofrece una salida funcional, sin espera infinita.');fallida.destruir();
      let tardias=0;const cancelada=crear({onRevelado:()=>tardias++});avanzar(2300);cancelada.destruir();cancelada.imagen.dispatchEvent(new w.Event('load'));avanzar(20000);pintar();t.igual(tardias,0,pagina+': cerrar cancela temporizadores, animación y cargas tardías');
      bloquear=false;reducido=true;const breve=crear({onRevelado:()=>tardias++});await cargada(breve);avanzar(1199);t.igual(tardias,0,pagina+': movimiento reducido conserva una transición gradual');avanzar(1);t.check(breve.revelado&&tardias===1,pagina+': movimiento reducido completa en 1.2 segundos sin trasladar al héroe.');breve.destruir();
      t.check(!host.childElementCount&&pendientes.size===0&&cuadros.size===0,pagina+': todas las escenas se limpian completamente.');
    }finally{
      escenas.forEach(e=>e.destruir());host.remove();Object.defineProperty(w.HTMLImageElement.prototype,'src',prop);w.setTimeout=poner;w.clearTimeout=quitar;w.requestAnimationFrame=raf;w.cancelAnimationFrame=caf;w.performance.now=reloj;w.matchMedia=media;w.relojPara();f.remove();
    }
  }
});

PRUEBAS.suite('pitagorasVisual',async t=>{
  for(const [pagina,ancho,alto] of [['index.html',1440,900],['movil.html',320,568]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;border:0;width:'+ancho+'px;height:'+alto+'px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=pitagoras-visual-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,quitar=w.clearTimeout,raf=w.requestAnimationFrame,caf=w.cancelAnimationFrame,reloj=w.performance.now,media=w.matchMedia;
    const pendientes=new Map(),cuadros=new Map(),escenas=[];let ahora=10000,id=990000;
    const host=d.createElement('div');host.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:999999;background:#000';d.body.appendChild(host);
    const avanzar=ms=>{
      const hasta=ahora+ms;let vueltas=0;
      for(;;){const par=[...pendientes].sort((a,b)=>a[1].cuando-b[1].cuando||a[0]-b[0])[0];if(!par||par[1].cuando>hasta)break;
        t.check(++vueltas<400,pagina+': temporizadores finitos.');pendientes.delete(par[0]);ahora=par[1].cuando;par[1].fn();
      }ahora=hasta;
    };
    const pintar=()=>{const lista=[...cuadros.values()];cuadros.clear();lista.forEach(fn=>fn(ahora));};
    const montar=(nombre,op)=>{const e=w[nombre](host,op);escenas.push(e);return e;};
    try{
      w.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:false}:media.call(w,q);
      w.setTimeout=(fn,ms=0,...args)=>{const k=++id;pendientes.set(k,{cuando:ahora+Math.max(0,Number(ms)||0),fn:()=>fn(...args)});return k;};
      w.clearTimeout=k=>{if(!pendientes.delete(k))quitar(k);};w.performance.now=()=>ahora;
      w.requestAnimationFrame=fn=>{const k=++id;cuadros.set(k,fn);return k;};w.cancelAnimationFrame=k=>{if(!cuadros.delete(k))caf(k);};
      Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});
      let luchas=0;const escena=montar('montarEscenaPitagoras',{onFight:()=>luchas++});
      const boton=escena.boss,figura=escena.elemento.querySelector('.pitIlustracion'),r=boton.getBoundingClientRect();
      t.check(figura?.tagName.toLowerCase()==='img'&&boton.tagName==='BUTTON'&&boton.getAttribute('aria-label').includes('Pitágoras'),pagina+': trono real y acceso con teclado.');
      t.check(r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=ancho&&r.bottom<=alto-60,pagina+': figura tocable y separada de los controles inferiores.');
      await figura.decode();t.check(figura.naturalWidth>500&&w.retratoPitagoras().endsWith('pitagoras-abismo-v216.webp'),pagina+': monstruo y retrato comparten la ilustración cargada.');
      boton.click();boton.click();t.igual(luchas,1,pagina+': un doble clic sólo inicia un combate.');escena.destruir();
      const cerrada=montar('montarEscenaPitagoras',{onFight:()=>luchas++}),botonRetirado=cerrada.boss;cerrada.destruir();botonRetirado.click();
      t.igual(luchas,1,pagina+': una referencia a una escena cerrada no puede iniciar combate.');t.check(!host.querySelector('.pitEscena'),pagina+': desmontar retira el trono.');
      let cubiertas=0;const esporas=montar('montarEsporasPitagoras',{onCubierto:()=>cubiertas++});
      avanzar(900);pintar();const c=esporas.elemento.querySelector('canvas'),ctx=c.getContext('2d'),pixeles=ctx.getImageData(0,0,c.width,c.height).data;
      let pintados=0;for(let i=3;i<pixeles.length;i+=997*4)if(pixeles[i])pintados++;
      t.check(c.width>0&&c.height>0&&pintados>0,pagina+': las esporas se dibujan realmente antes de cubrir.');
      avanzar(1099);t.check(!esporas.cubierto&&cubiertas===0,pagina+': no se adelanta la cobertura de dos segundos.');
      avanzar(1);t.check(esporas.cubierto&&cubiertas===1&&esporas.elemento.dataset.fase==='cubierto',pagina+': a los dos segundos queda completamente negro.');
      t.igual(w.getComputedStyle(esporas.elemento).backgroundColor,'rgb(0, 0, 0)',pagina+': cobertura negra independiente de Canvas');avanzar(1000);t.igual(cubiertas,1,pagina+': la notificación de cobertura no se repite');esporas.destruir();
      let finales=0;const nombre='<img src=x onerror=1>',frase='Tú, '+nombre+', tú sí eres el verdadero Caoz Con Todo.';
      const final=montar('montarFinalPitagoras',{personaje:{nombre,color:'azul',equipo:'baston'},nombre,onTerminar:()=>finales++});
      pintar();avanzar(1799);t.igual(final.elemento.dataset.fase,'implosion',pagina+': la implosión precede al cuarto');avanzar(1);
      t.igual(final.elemento.dataset.fase,'cuarto',pagina+': después de la explosión se revela el cuarto oscuro');
      const miniatura=final.elemento.querySelector('.pitMiniatura'),texto=final.elemento.querySelector('.pitReconocimiento');
      t.check(miniatura?.tagName==='CANVAS'&&miniatura.width>0&&miniatura.height>0,pagina+': el cuarto muestra la miniatura real del jugador.');
      avanzar(1000);t.check(texto.textContent.length>0&&texto.textContent.length<frase.length,pagina+': el texto se revela progresivamente.');
      for(let letras=0;final.elemento.dataset.fase!=='texto'&&letras<150;letras++){
        t.check(final.elemento.dataset.fase!=='negro'&&finales===0,pagina+': terminar la frase debe dejar seis segundos para leer, no iniciar el negro.');
        const proximo=[...pendientes.values()].sort((a,b)=>a.cuando-b.cuando)[0];t.check(!!proximo,pagina+': sigue pendiente revelar el mensaje.');avanzar(proximo.cuando-ahora);
      }
      t.igual(texto.textContent,frase,pagina+': frase completa conserva el nombre como texto');
      t.check(!texto.querySelector('*'),pagina+': el nombre no introduce etiquetas HTML.');t.igual(finales,0,pagina+': completar la frase no termina el final');
      avanzar(5999);t.check(final.elemento.dataset.fase==='texto'&&finales===0,pagina+': permite seis segundos completos de lectura DESPUÉS de la última letra.');
      avanzar(1);t.check(final.elemento.dataset.fase==='negro'&&finales===0,pagina+': sólo después de leer comienza el negro.');
      avanzar(999);t.igual(finales,0,pagina+': el fundido negro permanece un segundo');avanzar(1);t.igual(finales,1,pagina+': el menú llega después del negro');final.destruir();
      const pendiente=montar('montarEsporasPitagoras',{onCubierto:()=>cubiertas++});pendiente.destruir();
      const interrumpido=montar('montarFinalPitagoras',{personaje:{nombre:'Viajero'},onTerminar:()=>finales++});interrumpido.destruir();
      avanzar(20000);pintar();t.check(cubiertas===1&&finales===1&&!host.childElementCount,pagina+': desmontar cancela también las acciones tardías.');
      t.check(cuadros.size===0&&pendientes.size===0,pagina+': no quedan dibujos ni temporizadores de las escenas.');
    }finally{
      escenas.forEach(e=>e.destruir());host.remove();w.setTimeout=poner;w.clearTimeout=quitar;w.requestAnimationFrame=raf;w.cancelAnimationFrame=caf;w.performance.now=reloj;w.matchMedia=media;w.relojPara();f.remove();
    }
  }
});

PRUEBAS.suite('betaFinalGero',async t=>{
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=beta-final-gero-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,quitar=w.clearTimeout,crear=w.crearMesaCampana,disponible=w.campanaPruebaDisponible,timers=new Map();let siguiente=97000,finales=0;
    const clave='caoz.campana.v1.prueba',logros='caoz.campana.logros.v1.prueba',simulados=logros+'.simulados',anteriores=[clave,logros,simulados].map(k=>w.localStorage.getItem(k));
    try{
      w.matchMedia=()=>({matches:true});Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});
      const previo={version:1,id:'campana-real-conservada',lider:'talesin',personaje:w.campanaNormalizarPersonaje({nombre:'Mi héroe guardado'}),etapa:3,enEncuentro:true};w.campanaGuardar(previo);
      w.localStorage.setItem(logros,JSON.stringify({version:1,mazos:{talesin:{nombre:'Mi héroe guardado',fecha:1234}},ganador:null}));w.localStorage.removeItem(simulados);
      const avanceReal=w.localStorage.getItem(clave),sellosReales=w.localStorage.getItem(logros);
      const nueva=(foe='gero')=>{w.newGame('fender',foe);w.eval("G.phase='principal';G.active=ME;G.busy=false;G.resolving=false");w.showScreen('board');w.render();};
      nueva();t.check(!!d.querySelector('#betaFinalGero'),pagina+': falta el botón beta contra Gero.');
      // Presencia y acción se validan por separado: un botón viejo puede seguir
      // recibiendo un evento al cambiar de partida o desconectarse una sala.
      const botonViejo=d.querySelector('#betaFinalGero');
      for(const estado of ["NET.on=true","G.online=true","G.guest=true","G.auto=true","G.silent=true"]){
        nueva();w.eval(estado);w.render();const boton=d.querySelector('#betaFinalGero');t.check(estado==='G.silent=true'||!boton||boton.disabled,pagina+': no permite ensayar con '+estado);
        w.campanaProbarFinalGero();t.check(!w.eval('G.over')&&w.campanaLeer().id===previo.id,pagina+': una llamada directa está bloqueada con '+estado);w.eval('NET.on=false');
      }
      nueva('adreida');botonViejo.click();w.campanaProbarFinalGero();t.check(!w.eval('G.over')&&w.campanaLeer().id===previo.id,pagina+': un botón de la partida anterior no vence a otro rival.');
      nueva();w.campanaPruebaDisponible=()=>false;w.render();t.check(!d.querySelector('#betaFinalGero'),pagina+': producción no muestra la herramienta.');w.campanaProbarFinalGero();t.check(!w.eval('G.over'),pagina+': producción bloquea también la función.');w.campanaPruebaDisponible=disponible;
      for(const estado of ['G.busy=true','G.resolving=true','TUT.pending=()=>{}']){nueva();w.eval(estado);w.render();t.check(d.querySelector('#betaFinalGero')?.disabled,pagina+': espera una resolución pendiente.');w.campanaProbarFinalGero();t.check(!w.eval('G.over'),pagina+': no interrumpe '+estado);w.eval('TUT.pending=null');}
      nueva();d.querySelector('#dice').classList.add('on');w.render();t.check(d.querySelector('#betaFinalGero')?.disabled,pagina+': no interrumpe el d20 de la pasiva de Gero.');w.campanaProbarFinalGero();t.check(!w.eval('G.over'),pagina+': la función rechaza el dado pendiente.');d.querySelector('#dice').classList.remove('on');
      w.setTimeout=(fn,ms,...args)=>{if(ms===2400||ms===450){const id=++siguiente;timers.set(id,()=>fn(...args));return id;}return poner(fn,ms,...args);};w.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else quitar(id);};
      w.crearMesaCampana=(host,op)=>{const mesa=crear(host,op);mesa.golpear=()=>Promise.resolve(true);return mesa;};
      w.cinematicaFinal=async(ganador,motivo,acciones)=>{finales++;t.check(ganador===0&&acciones.continuarAutomaticamente,pagina+': conserva Victoria y solicita avanzar automáticamente al ascenso.');acciones.prepararRevancha?.();acciones.revancha();return true;};
      nueva();w.eval('G.tutorial=true');w.render();t.check(!d.querySelector('#betaFinalGero').disabled,pagina+': el tutorial local quieto también permite el ensayo.');const g=w.eval('G');d.querySelector('#betaFinalGero').click();w.campanaProbarFinalGero();await sleep(550);
      t.check(w.eval('G')===g&&w.eval('G.over&&P(FOE).alma===0'),pagina+': termina la partida actual una sola vez.');t.igual(finales,1,pagina+': una sola pantalla de Victoria');t.check(!w.eval('G.tutorial||TUT.on'),pagina+': sale limpiamente del tutorial.');
      const ensayo=w.campanaLeer();t.check(ensayo.id!==previo.id&&ensayo.prueba&&ensayo.etapa===6&&ensayo.secreto==='ascenso',pagina+': un ensayo aislado permite ascenso sin seis mazos ganados.');
      t.check(w.eval('G.campana.pruebaFinalGero')===true,pagina+': la partida queda marcada como prueba de final.');
      t.igual(w.localStorage.getItem(clave),avanceReal,pagina+': conserva byte a byte el avance real');t.igual(w.localStorage.getItem(logros),sellosReales,pagina+': conserva los sellos reales');t.check(w.CAMPANA_LOGROS.total(true)<=1,pagina+': no inventa seis victorias.');
      t.check(d.querySelector('#campanaAscenso')?.open,pagina+': la Victoria llega al rayo sin otro clic.');
      const interrumpir=[...timers.values()][0];t.check(!!interrumpir,pagina+': programa la interrupción del sexto sello simulado.');interrumpir();
      t.igual(d.querySelector('#campanaAscenso')?.dataset.fase,'detenido',pagina+': detiene primero el ascenso.');const quieto=[...timers.values()].at(-1);quieto();t.check(d.querySelector('#campanaSecreto')?.dataset.fase==='revelacion'&&!d.querySelector('#campanaDeseo'),pagina+': revela al Editor desde la oscuridad.');
      w.campanaVolverAlMenu();w.abrirCampana();t.check(w.campanaLeer().id===previo.id&&w.campanaLeer().etapa===3,pagina+': reabrir Campaña devuelve el avance original.');
      t.igual(w.localStorage.getItem(clave),avanceReal,pagina+': tampoco modifica el guardado al abandonar el ensayo');
    }finally{
      w.eval('NET.on=false');w.campanaCerrar();w.relojPara();w.campanaPruebaDisponible=disponible;w.setTimeout=poner;w.clearTimeout=quitar;
      [clave,logros,simulados].forEach((k,i)=>{if(anteriores[i]==null)w.localStorage.removeItem(k);else w.localStorage.setItem(k,anteriores[i]);});f.remove();
    }
  }
});

PRUEBAS.suite('campanaSecreto',async t=>{
  const claves=['caoz.campana.logros.v1.prueba','caoz.campana.logros.v1.prueba.simulados'];
  const previos=claves.map(k=>localStorage.getItem(k));
  try{for(const pagina of ['index.html','movil.html']){
    claves.forEach(k=>localStorage.removeItem(k));
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=secreto-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=f.contentDocument,poner=w.setTimeout,quitar=w.clearTimeout,crear=w.crearMesaCampana,timers=new Map();let timerId=98000,acciones,cubrir,pelear,terminar,partidas=[];
    try{
      w.matchMedia=()=>({matches:true});
      w.setTimeout=(fn,ms,...args)=>{if([2400,450,1000,900].includes(ms)){const id=++timerId;timers.set(id,{ms,fn:()=>fn(...args)});return id;}return poner(fn,ms,...args);};
      w.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else quitar(id);};
      const ejecutar=ms=>{const par=[...timers].find(([id,t])=>t.ms===ms);t.check(!!par,pagina+': falta temporizador de '+ms+' ms.');if(par){timers.delete(par[0]);par[1].fn();}};
      w.crearMesaCampana=(host,op)=>{const mesa=crear(host,op);mesa.golpear=()=>Promise.resolve(true);return mesa;};
      w.cinematicaFinal=async(g,m,a)=>{acciones=a;return true;};
      w.montarRevelacionPitagoras=(host,op)=>{cubrir=op.onRevelado;return {destruir(){}};};
      w.montarEscenaPitagoras=(host,op)=>{pelear=op.onFight;return {destruir(){}};};
      w.montarFinalPitagoras=(host,op)=>{terminar=op.onTerminar;const n=d.createElement('b');n.textContent=op.nombre;host.appendChild(n);return {destruir(){}};};
      w.startMatch=async(a,b,op)=>{partidas.push({a,b,op});w.newGame(a,b);w.eval('G.campana='+JSON.stringify(op.campana));};
      const ids=w.eval('Object.keys(DECKS)'),ganar=(lider,prueba=false)=>{
        const p={version:1,id:'secreto-'+lider+'-'+prueba,lider,personaje:w.campanaNormalizarPersonaje({nombre:'Ari <h1>'}),etapa:5,...(prueba?{prueba:true}:{})};
        w.campanaGuardar(p);w.newGame(lider,'gero');w.eval('G.campana='+JSON.stringify({id:p.id,etapa:5,prueba})+';G.over=true');w.campanaFinal(0,'Victoria');return p;
      };
      for(let i=0;i<ids.length;i++){
        const p=ganar(ids[i]);t.igual(w.CAMPANA_LOGROS.total(),i+1,pagina+': sello de mazo distinto');
        w.campanaFinal(0,'Duplicado');t.igual(w.CAMPANA_LOGROS.total(),i+1,pagina+': una misma victoria no duplica sellos');
        t.check(i===5?p.secreto==='ascenso':!p.secreto,pagina+': sólo los seis mazos abren el secreto.');
      }
      w.eval('campanaMemoria=null');
      acciones.revancha();await sleep(40);t.check(d.querySelector('#campanaAscenso')?.open,pagina+': el sexto triunfo empieza el ascenso normal.');
      ejecutar(2400);t.igual(d.querySelector('#campanaAscenso')?.dataset.fase,'detenido',pagina+': el héroe se detiene antes de oscurecer.');ejecutar(450);t.check(d.querySelector('#campanaSecreto')?.dataset.fase==='revelacion'&&!d.querySelector('#campanaDeseo')&&!d.querySelector('#campanaAscenso'),pagina+': la revelación interrumpe el ascenso antes del deseo.');
      t.check(!d.querySelector('.pitBoss'),pagina+': no se puede atacar antes de revelar al monstruo');
      t.check(!pelear,pagina+': el monstruo espera su revelación.');cubrir();
      t.check(!!pelear,pagina+': al terminar el fundido se permite combatir.');
      pelear();pelear();await sleep(0);t.igual(partidas.length,1,pagina+': un doble toque inicia una sola pelea');
      const partida=partidas[0];t.igual(partida.b,'adreida',pagina+': reglas del mazo de Adreida');
      t.check(partida.op.campana.jefeSecreto&&partida.op.campana.etapa===6&&partida.op.nombres[1]==='Pitágoras',pagina+': identidad del jefe independiente de su mazo.');
      w.eval('G.over=true');w.campanaFinal(1,'Derrota');acciones.revancha();await sleep(0);t.igual(partidas.length,2,pagina+': revancha directa sin regresar al trono');
      w.eval('G.over=true');w.campanaFinal(0,'Victoria');t.check(d.querySelector('#campanaSecreto')?.dataset.fase==='final',pagina+': el Editor inicia su final especial.');
      t.igual(w.CAMPANA_LOGROS.ganador().nombre,'Ari <h1>',pagina+': conserva el nombre como texto');t.check(!d.querySelector('#campanaSecreto h1'),pagina+': el nombre no inyecta HTML.');
      terminar();ejecutar(900);t.check(!d.querySelector('#campanaSecreto')&&w.campanaLeer().secreto==='completado',pagina+': vuelve al menú con el final persistido.');
      w.abrirCampana();t.check(d.querySelector('#campanaPanel')?.dataset.vista==='creador',pagina+': después del final empieza un personaje nuevo.');w.campanaCerrar();
      t.igual(w.CAMPANA_LOGROS.total(),6,pagina+': reiniciar no borra los seis sellos');
      const p=ganar(ids[0],true);t.check(!p.secreto,pagina+': seis sellos reales no completan un ensayo de un solo mazo.');
      t.igual(w.CAMPANA_LOGROS.total(true),1,pagina+': ensayo separado');t.igual(w.CAMPANA_LOGROS.total(),6,pagina+': no contamina los sellos reales');
      // Una recarga reanuda el encuentro pendiente, no repite victorias ni borra logros.
      p.secreto='combate';w.campanaGuardar(p);w.eval('campanaMemoria=null');w.campanaAbrirSecreto();t.igual(d.querySelector('#campanaSecreto').dataset.fase,'trono',pagina+': relectura del combate devuelve al Editor.');
      const pendiente=pelear;w.campanaCerrar();pendiente();await sleep(0);t.igual(partidas.length,2,pagina+': un callback de escena cerrada no inicia otro combate.');
    }finally{w.campanaCerrar();w.campanaCerrarDeseo();w.relojPara();w.setTimeout=poner;w.clearTimeout=quitar;w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }}finally{claves.forEach((k,i)=>{if(previos[i]==null)localStorage.removeItem(k);else localStorage.setItem(k,previos[i]);});}
});

PRUEBAS.suite('campanaPruebaBeta', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=beta-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow;let acciones;
    try{
      w.matchMedia=()=>({matches:true});
      w.cinematicaFinal=async(g,m,a)=>{acciones=a;return true;};
      w.campanaAscenderAlDeseo=undefined;
      w.campanaGuardar({version:1,id:'beta-recorrido',lider:'fender',etapa:0});
      for(let etapa=0;etapa<6;etapa++){
        w.campanaRuta();await w.campanaSeleccionar();
        const boton=w.document.querySelector('[data-prueba-campana]');
        t.check(!!boton,pagina+': falta victoria temporal al llegar al rival.');
        boton.click();boton.click();await sleep(0);
        t.check(w.campanaLeer().etapa===etapa+1&&w.campanaLeer().mesaPendiente===etapa,pagina+': la victoria temporal debe avanzar exactamente un encuentro.');
        acciones.revancha();await sleep(30);
        const seguir=w.document.querySelector('#campanaPanel .campanaAcciones .gold');
        t.check(seguir.textContent===(etapa===5?'Completar campaña':'Continuar'),pagina+': continuar no debe revelar al siguiente rival.');
        seguir.click();
      }
      t.check(w.campanaLeer().etapa===6&&!w.document.querySelector('[data-prueba-campana]'),pagina+': campaña completada sin victoria extra.');
    }finally{w.campanaCerrar();w.relojPara();f.remove();}
  }
});

PRUEBAS.suite('victoriaCentrada', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=final-centrado-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow;
    try{
      const estilo=w.document.createElement('style');estilo.textContent=w.eval('FIN_CSS')+' .fin .sello{animation:none!important}';w.document.head.appendChild(estilo);
      const fin=w.document.createElement('div');fin.className='fin sello-on';fin.innerHTML='<div class="sello"><b>VICTORIA</b><small>Victoria de prueba</small><i>Turnos: 7 · Fender 17 · Mohamed 0</i></div>';w.document.body.appendChild(fin);
      await w.document.fonts.ready;
      for(const [ancho,alto] of [[320,568],[390,844],[1440,900]]){
        f.style.width=ancho+'px';f.style.height=alto+'px';await sleep(30);
        const palabra=fin.querySelector('b'),caja=palabra.getBoundingClientRect(),pantalla=fin.getBoundingClientRect();
        t.check(Math.abs(caja.x+caja.width/2-(pantalla.x+pantalla.width/2))<1,pagina+': palabra centrada horizontalmente a '+ancho);
        t.check(Math.abs(caja.y+caja.height/2-(pantalla.y+pantalla.height/2))<1,pagina+': la palabra misma debe estar en el centro vertical a '+ancho);
        const rango=w.document.createRange();rango.selectNodeContents(palabra);const texto=rango.getBoundingClientRect();
        t.check(texto.left>=pantalla.left+12&&texto.right<=pantalla.right-12,pagina+': el texto se sale del visor a '+ancho);
        t.check(w.getComputedStyle(palabra).transform==='none',pagina+': título sin inclinación.');
      }
      t.check(w.eval("CARDS.pasoatronador.n")==='Thunder step',pagina+': nombre actualizado de Thunder step.');
    }finally{f.remove();}
  }
});

PRUEBAS.suite('campanaContinuidad', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=continuidad-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow;let final,partidas=[];
    try{
      w.campanaGuardar({version:1,id:'continuidad',lider:'fender',etapa:0});
      w.newGame('fender','mohamed');w.eval("G.campana={id:'continuidad',etapa:0,alma:16};G.over=true;");
      w.cinematicaFinal=async(ganador,motivo,acciones)=>{final={ganador,acciones};return true;};
      w.showEnd(0,'Victoria de prueba');await sleep(0);
      t.check(final&&final.ganador===0,pagina+': campaña debe usar la victoria animada normal.');
      t.check(w.campanaLeer().etapa===1&&w.campanaLeer().mesaPendiente===0,pagina+': debe guardar el rival vencido para la escena de mesa.');
      w.showEnd(0,'Duplicado');t.check(w.campanaLeer().etapa===1,pagina+': no avanzar dos veces.');
      final.acciones.revancha();await sleep(50);
      t.check(w.document.querySelector('.campanaLienzo3d').dataset.derribando==='1',pagina+': al volver, la miniatura debe golpear al rival.');
      t.check(w.document.querySelector('#campanaPanel .campanaAcciones .gold').disabled,pagina+': no avanzar durante el golpe.');
      await sleep(1400);
      t.check(w.document.querySelector('.campanaLienzo3d').dataset.derribado==='0',pagina+': el rival debe quedar tumbado.');
      w.document.querySelector('#campanaPanel .campanaAcciones .gold').click();await sleep(50);
      t.check(w.campanaLeer().mesaPendiente==null&&w.document.querySelector('.campanaLienzo3d').dataset.avanzando==='1',pagina+': continuar debe caminar al siguiente rival.');
      const posicion=w.eval('campanaMesaEscena.posicion'),origen=w.campanaPosicionEncuentro(0);t.check(Math.hypot(posicion[0]-origen[0],posicion[1]-origen[1])<6,pagina+': el avance debe partir del rival vencido, nunca del inicio.');
      t.check(Number(w.document.querySelector('.campanaLienzo3d').dataset.despejeRival)<.2,pagina+': el siguiente rival no debe despejarse al empezar a caminar.');
      await sleep(1200);
      t.check(Number(w.document.querySelector('.campanaLienzo3d').dataset.despejeRival)>.95,pagina+': al llegar debe descubrirse completamente el rival.');
      w.campanaCerrar();w.startMatch=async(...args)=>partidas.push(args);
      w.newGame('fender','fender');w.eval("G.campana={id:'continuidad',etapa:1,alma:20};G.over=true;");
      w.showEnd(1,'Derrota de prueba');await sleep(0);final.acciones.revancha();await sleep(30);
      t.check(partidas.length===1&&partidas[0][2].campana.etapa===1&&!w.document.querySelector('#campanaPanel').open,pagina+': revancha debe entrar directamente al mismo duelo.');
    }finally{w.cerrarCinematica();w.campanaCerrar();w.relojPara();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaSinDestello', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-transicion-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document;
    try{
      Object.defineProperty(d,'hidden',{get:()=>false,configurable:true});w.FXON=()=>true;
      w.campanaGuardar({version:1,id:'transicion',lider:'fender',etapa:0});
      w.newGame('fender','mohamed');w.eval("G.campana={id:'transicion',etapa:0,alma:16};G.over=true;G.fast=false;G.auto=false;");
      w.showScreen('menu');w.showEnd(0,'Victoria de prueba');await sleep(40);
      t.check(!d.querySelector('.fin .toca'),pagina+': la victoria no debe mostrar Toca para saltar.');
      d.querySelector('.fin').click();await sleep(50);
      d.querySelector('.finbtns .gold').click();await sleep(20);
      const panel=d.getElementById('campanaPanel');
      t.check(panel?.open&&panel.querySelector('.campanaLienzo3d')?.dataset.lista==='1',pagina+': la mesa debe estar lista antes de que se desvanezca la victoria, sin mostrar el menú debajo.');
      t.check(panel.contains(d.querySelector('.fin.sale')),pagina+': la victoria debe fundirse sobre la mesa en la misma capa del diálogo.');
      t.check(Number(w.getComputedStyle(d.querySelector('.fin.sale')).opacity)>0,pagina+': el cambio de capa debe conservar el fundido, sin un corte instantáneo.');
      await sleep(420);
      t.check(panel.open&&!d.querySelector('.fin'),pagina+': al terminar el fundido debe quedar la mesa abierta.');
      await sleep(1000);
      const seguir=panel.querySelector('.campanaAcciones .gold');t.check(!seguir.disabled,pagina+': continuar disponible después del golpe.');
      seguir.click();
      t.check(panel.open&&panel.dataset.vista==='mapa',pagina+': continuar mantiene abierto el mapa durante el cambio de rival.');
      await sleep(60);
      t.check(panel.open&&panel.querySelector('.campanaLienzo3d').dataset.avanzando==='1',pagina+': la marcha sigue en el mismo diálogo sin exponer el menú.');
    }finally{w.cerrarCinematica();w.campanaCerrar();w.relojPara();f.remove();}
  }
});

PRUEBAS.suite('campanaAscenso', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:664px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=ascenso-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,poner=w.setTimeout,quitar=w.clearTimeout,crear=w.crearMesaCampana;const timers=new Map();let id=90000;
    try{
      w.crearMesaCampana=(c,op)=>{const mesa=crear(c,op);mesa.golpear=()=>Promise.resolve(true);return mesa;};
      w.setTimeout=(fn,ms,...args)=>{if(ms===5000||ms===1000){const k=++id;timers.set(k,{fn:()=>fn(...args),ms});return k;}return poner(fn,ms,...args);};
      w.clearTimeout=k=>{if(timers.has(k))timers.delete(k);else quitar(k);};
      const vencer=()=>{w.campanaGuardar({version:1,id:'ascenso',lider:'fender',etapa:6,mesaPendiente:5});w.campanaRuta();};
      vencer();await sleep(50);
      const luz=d.getElementById('campanaAscenso'),mesa=w.eval('campanaMesaEscena');
      t.check(luz?.open&&luz.dataset.fase==='rayo'&&!d.querySelector('#campanaDeseo'),pagina+': el derribo de Gero inicia automáticamente el rayo antes del deseo.');
      const resplandor=luz.querySelector('.ascensoResplandor'),fundido=resplandor?.getAnimations()[0];
      t.check(!!fundido,pagina+': el blanco debe crecer desde el rayo antes de cubrir la pantalla.');
      fundido.pause();fundido.currentTime=4400;
      const intermedio=w.getComputedStyle(resplandor),brillo=resplandor.getBoundingClientRect(),origenX=parseFloat(luz.style.getPropertyValue('--luz-x')),origenY=parseFloat(luz.style.getPropertyValue('--luz-y'));
      t.check(Number(intermedio.opacity)>0&&Number(intermedio.opacity)<1&&Number(intermedio.scale)>0&&Number(intermedio.scale)<1,pagina+': a mitad del fundido el brillo debe tener un tamaño y opacidad intermedios.');
      t.check(Math.abs(brillo.x+brillo.width/2-origenX)<2&&Math.abs(brillo.y+brillo.height/2-origenY)<2,pagina+': el blanco debe expandirse desde la miniatura sin desplazarse al escalar.');
      const abajo=mesa.focoJugador[1];mesa.elevar(1);t.check(mesa.focoJugador[1]<abajo&&Number(d.querySelector('.campanaLienzo3d').dataset.elevacion)>2,pagina+': se eleva la miniatura real, no sólo su etiqueta.');
      const blanco=[...timers.values()].find(x=>x.ms===5000);t.check(!!blanco,pagina+': el rayo debe durar cinco segundos.');blanco.fn();
      t.check(luz.dataset.fase==='blanco'&&w.getComputedStyle(luz).backgroundColor==='rgb(255, 255, 255)',pagina+': a los cinco segundos la pantalla se vuelve blanca.');
      const r=luz.getBoundingClientRect();t.check(r.left<=0&&r.top<=0&&r.right>=w.innerWidth&&r.bottom>=w.innerHeight,pagina+': el blanco debe cubrir toda la pantalla. '+JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height,vw:w.innerWidth,vh:w.innerHeight}));
      t.check(!d.querySelector('#campanaDeseo'),pagina+': el deseo no aparece antes de terminar el blanco.');
      const revelar=[...timers.values()].find(x=>x.ms===1000);t.check(!!revelar,pagina+': el blanco permanece un segundo.');revelar.fn();
      t.check(!d.querySelector('#campanaAscenso')&&d.querySelector('#campanaDeseo')?.open&&w.campanaLeer().mesaPendiente==null,pagina+': el blanco revela el formulario sin volver al menú.');
      w.campanaCerrarDeseo();timers.clear();vencer();await sleep(0);const cancelado=[...timers.values()].find(x=>x.ms===5000);w.campanaCerrar();cancelado.fn();
      t.check(!d.querySelector('#campanaAscenso')&&!d.querySelector('#campanaDeseo'),pagina+': cerrar cancela el ascenso y sus acciones tardías.');
    }finally{w.campanaCancelarAscenso();w.campanaCerrarDeseo();w.setTimeout=poner;w.clearTimeout=quitar;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaDeseo', async t => {
  for(const [pagina,ancho,alto] of [['index.html',1280,800],['movil.html',390,664]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;border:0;width:'+ancho+'px;height:'+alto+'px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=deseo-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,clave='caoz.deseos.v1.prueba',peticiones=[];
    const ponerTimer=w.setTimeout,quitarTimer=w.clearTimeout,fetchOriginal=w.fetch.bind(w);let ahora=0,id=0,pendientes=new Map();
    const avanzar=async ms=>{
      const hasta=ahora+ms;
      for(let limite=0;limite<100;limite++){
        const siguiente=[...pendientes.values()].filter(p=>p.cuando<=hasta).sort((a,b)=>a.cuando-b.cuando)[0];
        if(!siguiente)break;ahora=siguiente.cuando;pendientes.delete(siguiente.id);siguiente.fn();await sleep(0);
      }
      ahora=hasta;await sleep(0);
    };
    try{
      w.localStorage.removeItem(clave);
      w.fetch=async(url,op)=>{const ruta=new URL(url,w.location.href).pathname;
        // El sonido consulta su catálogo: son lecturas independientes del deseo.
        if((!op?.method||op.method==='GET')&&(ruta.includes('/art/')||ruta.includes('/audio/')||ruta.endsWith('/api/sfx/catalogo')))return fetchOriginal(url,op);
        peticiones.push({url,op});throw new Error('La simulación no debe enviar deseos.');};
      w.campanaGuardar({version:1,id:'deseo-prueba',lider:'fender',etapa:5});w.campanaAbrirDeseo();
      t.check(!d.querySelector('#campanaDeseo'),pagina+': el deseo sólo se ofrece al vencer a todos los rivales.');
      w.campanaGuardar({...w.campanaLeer(),etapa:6,mesaPendiente:5});w.campanaAbrirDeseo();
      t.check(!d.querySelector('#campanaDeseo'),pagina+': debe terminar el derribo de Gero antes del deseo.');
      const progreso={...w.campanaLeer()};delete progreso.mesaPendiente;w.campanaGuardar(progreso);w.campanaRuta();
      const panel=d.getElementById('campanaDeseo'),form=panel?.querySelector('form'),texto=panel?.querySelector('textarea'),boton=panel?.querySelector('button');
      t.check(panel?.open&&panel.dataset.fase==='formulario',pagina+': completar la campaña abre el formulario de deseo.');
      t.check(panel.querySelector('h1').innerText.replace(/\s+/g,' ').trim()==='Venciste a todos los héroes. Pide un deseo'&&boton.textContent==='Pedir deseo',pagina+': mensaje y acción final exactos.');
      const caja=panel.getBoundingClientRect(),campo=texto.getBoundingClientRect(),accion=boton.getBoundingClientRect();
      t.check(Math.abs(caja.width-ancho)<2&&Math.abs(caja.height-alto)<2&&campo.top>=0&&accion.bottom<=alto&&form.scrollHeight<=form.clientHeight+1,pagina+': el formulario debe caber en la pantalla sin desplazamiento.');
      w.setTimeout=(fn,ms=0,...args)=>{const timer=++id;pendientes.set(timer,{id:timer,cuando:ahora+Math.max(0,Number(ms)||0),fn:()=>fn(...args)});return timer;};
      w.clearTimeout=timer=>pendientes.delete(timer);
      texto.value='   ';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep(0);
      t.check(peticiones.length===0&&!boton.disabled&&panel.dataset.fase==='formulario',pagina+': un deseo vacío debe conservar el formulario.');
      const deseo='<img src=x onerror="window.deseoEjecutado=1"> Que todos vuelvan al Domo.';
      texto.value=deseo;texto.dispatchEvent(new w.Event('input',{bubbles:true}));
      t.check(texto.value===deseo&&!panel.querySelector('img')&&!w.deseoEjecutado,pagina+': el deseo se trata como texto, sin ejecutar etiquetas.');
      t.check(w.campanaLeer().borradorDeseo===deseo,pagina+': el borrador se conserva mientras se escribe.');
      t.check(panel.textContent.includes('Prueba beta · envío simulado'),pagina+': el formulario debe indicar que el envío es una simulación.');
      form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep(0);
      t.check(panel.dataset.fase==='envio'&&boton.disabled&&boton.textContent==='Enviando…',pagina+': pedir el deseo muestra el envío simulado sin permitir un segundo envío.');
      t.check(w.campanaLeer().deseo?.deseo===deseo&&w.campanaLeer().deseo.simulado===true,pagina+': el deseo debe conservarse en el progreso local marcado como simulado.');
      await avanzar(899);t.check(panel.dataset.fase==='envio',pagina+': el envío simulado debe mantener su breve transición.');
      await avanzar(1);
      t.check(panel.dataset.fase==='fuego'&&boton.disabled&&panel.querySelectorAll('canvas').length===1,pagina+': pedir el deseo inicia un solo fuego aunque se pulse dos veces.');
      t.check(peticiones.length===0&&!w.localStorage.getItem(clave),pagina+': la simulación no envía deseos ni crea una cola para enviarlos después.');
      const fuego=panel.querySelector('canvas').getBoundingClientRect();
      t.check(fuego.left<=0&&fuego.top<=0&&fuego.right>=ancho&&fuego.bottom>=alto,pagina+': el fuego debe cubrir toda la pantalla.');
      await avanzar(1000);t.check(!panel.querySelector('form')&&panel.querySelector('.deseoConcedido').textContent==='Deseo concedido',pagina+': el fuego revela únicamente Deseo concedido.');
      await avanzar(2000);t.check(panel.dataset.fase==='concedido'&&!panel.querySelector('canvas')&&panel.textContent==='Deseo concedido',pagina+': al disiparse el fuego sólo queda el mensaje.');
      await avanzar(2999);t.check(panel.dataset.fase==='concedido',pagina+': el mensaje permanece tres segundos completos.');
      await avanzar(1);t.check(panel.dataset.fase==='fundido',pagina+': después de tres segundos debe fundirse a negro.');
      await avanzar(1000);t.check(panel.dataset.fase==='menu'&&d.querySelector('#menu.on')&&!panel.querySelector('.deseoConcedido'),pagina+': el menú debe estar montado bajo el negro después de desaparecer el mensaje.');
      const revelado=panel.getAnimations().find(a=>a.animationName==='deseoRevelarMenu');t.check(!!revelado,pagina+': el menú debe revelarse mediante un fundido.');
      revelado.pause();revelado.currentTime=1500;
      const opacidad=Number(w.getComputedStyle(panel).opacity);
      t.check(opacidad>0&&opacidad<1&&w.getComputedStyle(panel,'::backdrop').backgroundColor==='rgba(0, 0, 0, 0)',pagina+': a mitad del revelado debe verse el menú a través del negro, sin un fondo modal opaco. '+JSON.stringify({opacidad,fondo:w.getComputedStyle(panel,'::backdrop').backgroundColor,animacion:revelado.animationName||revelado.transitionProperty}));
      await avanzar(2999);t.check(panel.isConnected&&panel.dataset.fase==='menu',pagina+': se aprovechan los tres segundos para revelar el menú.');
      await avanzar(1);t.check(!d.querySelector('#campanaDeseo')&&d.querySelector('#menu.on'),pagina+': el menú queda disponible al terminar su fundido.');
      w.eval('campanaMemoria=null');w.abrirCampana();t.check(d.querySelector('#campanaPanel')?.dataset.vista==='creador'&&!d.querySelector('#campanaDeseo'),pagina+': después del deseo, Campaña empieza creando un personaje nuevo.');
      d.querySelector('[data-creador-continuar]').click();
      d.querySelector('.campanaConfirmar').click();t.check(w.campanaLeer().etapa===0&&!w.campanaLeer().deseo&&w.campanaLeer().id!=='deseo-prueba',pagina+': elegir Protagonista crea una campaña nueva sin el progreso ni el deseo anteriores.');
      w.campanaCerrar();
      w.dispatchEvent(new w.Event('online'));await sleep(0);
      t.check(peticiones.length===0&&!w.localStorage.getItem(clave),pagina+': volver a tener conexión tampoco debe enviar el deseo simulado.');
      w.campanaGuardar({version:1,id:'otro-deseo',lider:'mohamed',etapa:6});w.campanaAbrirDeseo();
      const segundo=d.getElementById('campanaDeseo');segundo.querySelector('textarea').value='Que el Domo prospere';segundo.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep(0);
      await avanzar(900);
      t.check(segundo.dataset.fase==='fuego'&&peticiones.length===0&&!w.localStorage.getItem(clave),pagina+': otra campaña permite repetir el final simulado sin registros remotos.');
    }finally{w.campanaCerrarDeseo();w.setTimeout=ponerTimer;w.clearTimeout=quitarTimer;w.campanaCerrar();w.relojPara();w.localStorage.removeItem(clave);w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaCombate', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-combate-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,media=w.matchMedia;let llamadas=[];
    w.startMatch=async(a,b,opts)=>llamadas.push({a,b,opts,cuando:Date.now(),abierta:d.querySelector('#campanaPanel').open});
    try{
      for(let etapa=0;etapa<6;etapa++){
        w.campanaGuardar({version:1,id:'zoom',lider:'fender',etapa});w.campanaRuta();llamadas=[];
        const inicio=Date.now(),viaje=w.campanaCombatir();await w.campanaCombatir();
        t.check(llamadas.length===0&&d.querySelector('#campanaPanel').open,pagina+': el VS se abre antes del zoom.');
        const camara=d.querySelector('.campanaCamara');
        t.check(!!camara&&camara.getAnimations().some(a=>a.effect.getTiming().duration===500),pagina+': falta el acercamiento de medio segundo.');
        await viaje;
        t.check(llamadas.length===1&&llamadas[0].cuando-inicio>=450&&!llamadas[0].abierta,pagina+': el zoom debe entregar el control al VS una sola vez.');
        t.check(llamadas[0].a==='fender'&&llamadas[0].b===['mohamed','fender','talesin','rafaela','adreida','gero'][etapa]&&llamadas[0].opts.campana.etapa===etapa,pagina+': cambió el encuentro al acercar el mapa.');
        t.check(!camara.getAnimations().length&&!d.querySelector('.campanaAcercando'),pagina+': el zoom no se limpia.');
      }
      w.campanaGuardar({version:1,id:'zoom',lider:'fender',etapa:0});w.campanaRuta();llamadas=[];
      const cancelado=w.campanaCombatir();w.campanaCerrar();await cancelado;
      t.check(llamadas.length===0,pagina+': cerrar durante el zoom no debe iniciar la partida.');
      w.campanaRuta();w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
      await w.campanaCombatir();
      t.check(llamadas.length===1&&!d.querySelector('.campanaAcercando'),pagina+': movimiento reducido debe permitir combatir sin zoom.');
    }finally{w.matchMedia=media;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('versusMovil', async t => {
  const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
  const carga=new Promise(r=>f.onload=r);f.src='movil.html?test=versus-movil-interno';document.body.appendChild(f);await carga;
  const w=f.contentWindow;let presentacion;
  try{
    presentacion=w.cortinillaVS('fender','mohamed',{nombres:['Jugador de prueba','Rival de prueba']});
    const cartas=[...w.document.querySelectorAll('.vs .vscard')],jugador=cartas.find(c=>c.querySelector('.lname').textContent==='Jugador de prueba'),rival=cartas.find(c=>c.querySelector('.lname').textContent==='Rival de prueba');
    t.check(!!jugador&&!!rival,'El VS debe conservar los nombres de jugador y rival.');
    const yo=jugador.getBoundingClientRect(),otro=rival.getBoundingClientRect();
    t.check(yo.top+yo.height/2>otro.top+otro.height/2,'En móvil, el jugador debe estar debajo del rival.');
  }finally{if(presentacion)await presentacion;f.remove();}
});

PRUEBAS.suite('campanaEntrada', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-entrada-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,media=w.matchMedia;
    try{
      w.localStorage.removeItem('caoz.campana.v1.prueba');d.querySelector('#mCampana').click();
      const panel=d.querySelector('#campanaPanel'),b=panel.querySelector('.campanaBarrido');
      t.check(panel.open&&!!b&&panel.classList.contains('campanaEntra'),pagina+': Campaña debe activar la entrada dorada.');
      t.check(b.parentElement===panel&&b.getAttribute('aria-hidden')==='true'&&w.getComputedStyle(b).pointerEvents==='none',pagina+': el barrido debe estar delante del diálogo sin interceptar toques.');
      t.check(w.getComputedStyle(b).backgroundImage===w.getComputedStyle(d.querySelector('#barrido')).backgroundImage,pagina+': la campaña debe usar el mismo barrido dorado de los menús.');
      const figura=panel.querySelector('.creadorLienzo');d.querySelector('#mCampana').click();
      t.check(!!figura&&panel.querySelector('.creadorLienzo')===figura&&panel.querySelectorAll('.campanaBarrido').length===1,pagina+': un doble toque reinicia la entrada.');
      await sleep(750);
      t.check(!panel.querySelector('.campanaBarrido')&&!panel.classList.contains('campanaEntra'),pagina+': la entrada no se limpia.');
      w.campanaGuardar({version:1,id:'entrada',lider:'fender',etapa:2});w.campanaCerrar();w.abrirCampana();await sleep(0);
      t.check(panel.dataset.vista==='mapa'&&!!panel.querySelector('.campanaBarrido')&&w.campanaLeer().etapa===2,pagina+': retomar la campaña debe animarse y conservar el avance.');
      w.campanaElegir();
      t.check(!panel.querySelector('.campanaBarrido')&&!panel.classList.contains('campanaEntra'),pagina+': cambiar de vista durante la entrada deja efectos pegados.');
      w.campanaCerrar();w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);w.abrirCampana();
      t.check(panel.open&&!panel.querySelector('.campanaBarrido')&&!panel.classList.contains('campanaEntra'),pagina+': movimiento reducido debe abrir directamente.');
    }finally{w.matchMedia=media;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('pwaSinConexion', async t => {
  const codigo=await (await fetch('sw.js?test=pwa-interna')).text();
  for(const ruta of ['/','/tcg-beta/']){
    const scope='https://domo.invalid'+ruta,eventos={},guardados=new Map();
    for(const [archivo,texto] of [['index.html','escritorio'],['movil.html','telefono'],['campana-mesa.js','mesa']])guardados.set(new URL(archivo,scope).href,texto);
    const cache={async match(p,op={}){const u=new URL(p.url||p,scope);if(op.ignoreSearch)u.search='';if(!guardados.has(u.href))return;const r=new Response(guardados.get(u.href),{headers:{'Content-Type':u.pathname.endsWith('.html')?'text/html':'text/javascript'}});if(u.pathname.endsWith('.html'))Object.defineProperty(r,'redirected',{value:true});return r;}};
    const entorno={registration:{scope},location:{origin:'https://domo.invalid'},addEventListener:(nombre,fn)=>eventos[nombre]=fn};
    // Ejecutar el worker real con red caída y una caché que sólo tiene el precaché.
    new Function('self','caches','fetch',codigo)(entorno,{open:async()=>cache},async()=>{throw Error('Sin conexión de prueba');});
    for(const [pagina,texto] of [['movil?b=192&campana=1','telefono'],['index?b=192','escritorio'],['?campana=1','escritorio'],['campana-mesa.js?b=192','mesa']]){
      let respuesta;eventos.fetch({request:new Request(new URL(pagina,scope)),respondWith:p=>respuesta=p});
      const r=await respuesta;t.check(r.status===200&&await r.text()===texto,ruta+pagina+': la ruta de Cloudflare debe encontrar su archivo guardado sin conexión.');
      t.check(!r.redirected,ruta+pagina+': la copia precargada no puede conservar una redirección que el navegador rechaza sin red.');
    }
    let respuesta;eventos.fetch({request:new Request(new URL('desconocido',scope)),respondWith:p=>respuesta=p});
    t.check((await respuesta).status===504,ruta+': una ruta desconocida no debe confundirse con el juego.');
  }
});

PRUEBAS.suite('campanaMesa', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-mesa-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,contexto=w.HTMLCanvasElement.prototype.getContext,media=w.matchMedia;
    try{
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
      w.campanaGuardar({version:1,id:'mesa',lider:'fender',etapa:0});w.campanaRuta();await sleep(50);
      const escena=w.eval('campanaMesaEscena'),lienzo=d.querySelector('.campanaLienzo3d'),rival=d.querySelector('.campanaRuta .actual');
      t.check(lienzo&&lienzo.dataset.lista==='1'&&lienzo.width>100,pagina+': la mesa debe dibujarse, también con movimiento reducido.');
      const imagen=lienzo.toDataURL(),antes=rival.style.left;
      lienzo.dispatchEvent(new w.PointerEvent('pointerdown',{clientX:50,pointerId:1}));lienzo.dispatchEvent(new w.PointerEvent('pointermove',{clientX:200,pointerId:1}));
      t.check(!d.querySelector('.campanaVista')&&lienzo.toDataURL()===imagen&&rival.style.left===antes,pagina+': la cámara debe permanecer fija, sin controles de giro.');
      const nombre=rival.querySelector('b').getBoundingClientRect(),yo=d.querySelector('.campanaTu').getBoundingClientRect();
      t.check(yo.left>=nombre.right||yo.right<=nombre.left||yo.top>=nombre.bottom||yo.bottom<=nombre.top,pagina+': las etiquetas del jugador y su rival se sobreponen.');
      const foco=escena.foco(0);t.check(foco.every(n=>Number.isFinite(n)&&n>0&&n<100),pagina+': el zoom debe apuntar al rival visible.');
      t.check(w.campanaLeer().etapa===0,pagina+': mirar la mesa no puede cambiar el progreso.');
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:false}:media.call(w,q);
      w.campanaGuardar({...w.campanaLeer(),etapa:1});w.eval('campanaPasoAnterior=0');w.campanaRuta();await sleep(100);
      const peon=d.querySelector('.campanaPeon'),mapa=d.querySelector('.campanaTablero').getBoundingClientRect(),ficha=peon.getBoundingClientRect();
      const esperado=mapa.left+parseFloat(peon.style.left)/100*mapa.width;
      t.check(Math.abs(ficha.left+ficha.width/2-esperado)<2,pagina+': durante el avance, TÚ debe seguir la proyección de la miniatura, sin la animación del mapa antiguo.');
      const avanzando=d.querySelector('.campanaLienzo3d');await sleep(1150);
      t.check(avanzando.dataset.avanzando==='0',pagina+': el avance de la miniatura debe terminar.');
      w.campanaElegir();t.check(!escena.activa&&!lienzo.isConnected&&!d.querySelector('.campanaVista'),pagina+': cambiar de menú debe liberar la escena anterior.');
      w.campanaRuta();const segunda=w.eval('campanaMesaEscena');w.campanaCerrar();
      t.check(!segunda.activa,pagina+': cerrar debe detener la mesa.');
      // Si el teléfono no ofrece Canvas 2D, el mapa HTML sigue siendo jugable.
      w.HTMLCanvasElement.prototype.getContext=function(tipo,...args){return tipo==='2d'?null:contexto.call(this,tipo,...args);};
      w.campanaRuta();
      t.check(!d.querySelector('.campanaMesa3d')&&!d.querySelector('.campanaLienzo3d')&&!!d.querySelector('.campanaEncuentro'),pagina+': sin lienzo debe conservarse el mapa y su encuentro.');
      t.check(w.getComputedStyle(d.querySelector('.campanaRuta .actual .lface')).display!=='none',pagina+': el mapa alternativo debe mostrar al rival.');
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);await w.campanaSeleccionar();
      t.check(d.querySelector('#campanaEncuentroPanel')?.open,pagina+': la confirmación también debe abrirse con el mapa alternativo.');
    }finally{w.HTMLCanvasElement.prototype.getContext=contexto;w.matchMedia=media;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaEncuadre', async t => {
  const centroide=vertices=>{let area=0,x=0,y=0;vertices.forEach((p,i)=>{const q=vertices[(i+1)%vertices.length],a=p[0]*q[1]-q[0]*p[1];area+=a;x+=(p[0]+q[0])*a;y+=(p[1]+q[1])*a;});return[x/(3*area),y/(3*area)];};
  for(const [pagina,ancho,alto] of [['index.html',1440,960],['index.html',390,740],['movil.html',390,740],['movil.html',320,568],['movil.html',844,390]]){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:'+ancho+'px;height:'+alto+'px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-encuadre-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,media=w.matchMedia;const encuadres=new Map();
    const contexto=pagina+' '+ancho+'×'+alto;
    try{
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
      for(let etapa=0;etapa<6;etapa++){
        w.campanaGuardar({version:1,id:'encuadre',lider:'fender',etapa,enEncuentro:true});w.campanaRuta();await sleep(35);
        const escena=w.eval('campanaMesaEscena'),centro=centroide(escena.encuadre);
        t.check(centro.every(n=>Math.abs(n-50)<.1),contexto+': la superficie de la mesa debe quedar centrada, también en el encuentro '+etapa+'.');
        const lienzo=d.querySelector('.campanaLienzo3d'),tamano=lienzo.width+'×'+lienzo.height,encuadre=JSON.stringify(escena.encuadre);
        if(encuadres.has(tamano))t.check(encuadre===encuadres.get(tamano),contexto+': la cámara no debe desplazarse al cambiar de rival con el mismo tamaño de mesa.');
        else encuadres.set(tamano,encuadre);
        for(const altura of [.1,etapa===5?2.25:2.6])t.check(escena.foco(etapa,altura).every(n=>n>=0&&n<=100),contexto+': el rival '+etapa+' debe caber entero, de la base a la cabeza.');
        const mesa=d.querySelector('.campanaCamara').getBoundingClientRect();
        for(const selector of ['.campanaRuta .actual b','.campanaTu']){
          const r=d.querySelector(selector).getBoundingClientRect();
          t.check(r.left>=mesa.left-1&&r.right<=mesa.right+1&&r.top>=mesa.top-1&&r.bottom<=mesa.bottom+1,contexto+': la etiqueta '+selector+' del encuentro '+etapa+' queda fuera del mapa.');
        }
      }
      w.matchMedia=media;w.campanaAbrirDeseo=undefined;
      w.campanaGuardar({version:1,id:'encuadre-final',lider:'fender',etapa:6});w.eval('campanaPasoAnterior=5');w.campanaRuta();
      t.check(d.querySelector('.campanaLienzo3d')?.dataset.lista==='1',pagina+': el mapa completo debe dibujarse sin consultar un séptimo rival.');
    }finally{w.matchMedia=media;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaEncuentro', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-encuentro-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,media=w.matchMedia;let llamadas=[];
    w.startMatch=async(a,b,opts)=>llamadas.push({a,b,opts});
    const pulsar=texto=>[...d.querySelectorAll('#campanaEncuentroPanel button')].find(b=>b.textContent===texto).click();
    try{
      w.campanaGuardar({version:1,id:'encuentro',lider:'fender',etapa:0});w.campanaRuta();
      const mesa=d.querySelector('.campanaLienzo3d'),peon=d.querySelector('.campanaPeon'),origen=peon.style.left;
      const viaje=w.campanaSeleccionar();await w.campanaSeleccionar();await sleep(100);
      t.check(!d.querySelector('#campanaEncuentroPanel')&&llamadas.length===0&&mesa.dataset.saltando==='1',pagina+': primero debe saltar la ficha, sin abrir la ventana ni comenzar el combate.');
      await viaje;await sleep(280);
      const detalle=d.querySelector('#campanaEncuentroPanel'),r=detalle.getBoundingClientRect();
      t.check(detalle.open&&d.querySelectorAll('#campanaEncuentroPanel').length===1&&llamadas.length===0,pagina+': llegar debe mostrar una sola confirmación, sin iniciar el combate.');
      t.check(Math.abs(r.left+r.width/2-w.innerWidth/2)<2&&Math.abs(r.top+r.height/2-w.innerHeight/2)<2,pagina+': la ventana del encuentro debe quedar centrada.');
      t.check(detalle.textContent.includes('Contra Mohamed')&&detalle.querySelector('.rival strong').textContent.trim()==='16 ALMA',pagina+': las especificaciones no corresponden a Mohamed.');
      t.check(peon.style.left!==origen,pagina+': la ficha no llegó al encuentro.');
      pulsar('Volver a la mesa');
      t.check(!d.querySelector('#campanaEncuentroPanel')&&d.querySelector('.campanaLienzo3d')===mesa&&peon.style.left===origen&&w.campanaLeer().etapa===0&&llamadas.length===0,pagina+': volver debe conservar la mesa y el progreso, sin empezar el duelo.');
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
      for(let etapa=0;etapa<6;etapa++){
        w.campanaGuardar({...w.campanaLeer(),etapa});w.campanaRuta();await w.campanaSeleccionar();
        t.check(d.querySelector('#campanaEncuentroPanel .rival strong').textContent.trim()===[16,20,24,28,32,40][etapa]+' ALMA',pagina+': el aviso debe mostrar el Alma real de cada rival.');
        pulsar('Volver a la mesa');
      }
      w.campanaGuardar({...w.campanaLeer(),etapa:0});w.campanaRuta();await w.campanaSeleccionar();
      w.matchMedia=media;const entrar=d.querySelector('#campanaEncuentroPanel .gold');entrar.click();entrar.click();
      t.check(llamadas.length===0&&!d.querySelector('#campanaEncuentroPanel'),pagina+': entrar debe cerrar la confirmación antes del acercamiento.');
      await sleep(600);t.check(llamadas.length===1&&llamadas[0].b==='mohamed'&&llamadas[0].opts.campana.alma===16,pagina+': confirmar debe arrancar una sola vez el encuentro mostrado.');
      llamadas=[];w.campanaRuta();const cancelado=w.campanaSeleccionar();w.campanaCerrar();await cancelado;await sleep(1000);
      t.check(!d.querySelector('#campanaEncuentroPanel')&&llamadas.length===0,pagina+': cerrar durante los saltos no debe dejar una ventana tardía ni iniciar una partida.');
      w.campanaRuta();w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);await w.campanaSeleccionar();
      d.querySelector('#campanaEncuentroPanel').dispatchEvent(new w.Event('cancel',{cancelable:true}));
      t.check(!d.querySelector('#campanaEncuentroPanel')&&d.querySelector('#campanaPanel').open,pagina+': Escape debe volver a la mesa.');
    }finally{w.matchMedia=media;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaPantalla', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=campana-pantalla-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,media=w.matchMedia;
    w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
    const comprobar=()=>{
      const d=w.document.querySelector('#campanaDeseo[open]')||w.document.querySelector('#campanaPanel'),r=d.getBoundingClientRect();
      t.check(d.open&&r.width>0&&r.height>0,pagina+': debe medirse el diálogo visible de campaña.');
      t.check(d.scrollHeight<=d.clientHeight+1&&d.scrollWidth<=d.clientWidth+1,pagina+': el panel de campaña exige scroll.');
      t.check(r.top>=0&&r.bottom<=w.innerHeight+1&&r.left>=0&&r.right<=w.innerWidth+1,pagina+': el diálogo sale de la pantalla.');
      d.querySelectorAll('.campanaAcciones .btn,.campanaVista .btn,.campanaFlechas .btn,.campanaFicha,#campanaTitulo,.deseoFormulario>*').forEach(n=>{
        if(w.getComputedStyle(n).display==='none')return;
        const b=n.getBoundingClientRect();t.check(b.top>=r.top&&b.bottom<=r.bottom+1&&b.left>=r.left&&b.right<=r.right+1,pagina+': se recorta '+n.textContent);
      });
    };
    try{
      for(const [ancho,alto] of [[390,844],[320,568],[320,480],[844,390],[568,320]]){
        f.style.width=ancho+'px';f.style.height=alto+'px';await sleep(80);
        w.campanaElegir();await sleep(60);comprobar();
        for(let i=0;i<6;i++){w.document.querySelector('[aria-label="Protagonista siguiente"]').click();comprobar();}
        for(const etapa of [0,5,6]){
          w.campanaGuardar({version:1,id:'pantalla',lider:'fender',etapa});w.campanaRuta();await sleep(60);comprobar();
          if(etapa<6){
            await w.campanaSeleccionar();const aviso=w.document.querySelector('#campanaEncuentroPanel'),r=aviso.getBoundingClientRect();
            t.check(aviso.scrollHeight<=aviso.clientHeight+1&&aviso.scrollWidth<=aviso.clientWidth+1&&r.top>=0&&r.bottom<=w.innerHeight+1&&r.left>=0&&r.right<=w.innerWidth+1,pagina+': la ventana del encuentro exige scroll o sale de la pantalla.');
            aviso.querySelectorAll('button').forEach(b=>{const a=b.getBoundingClientRect();t.check(a.top>=r.top&&a.bottom<=r.bottom+1&&a.left>=r.left&&a.right<=r.right+1,pagina+': un botón del encuentro queda recortado.');});
            w.campanaLimpiarPreparacion(true);
          }else w.campanaCerrarDeseo();
        }
      }
    }finally{w.matchMedia=media;w.campanaCerrarDeseo();w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

/* Los diálogos nativos viven fuera del lienzo: deben centrarse en el visor real. */
PRUEBAS.suite('menusCentrados', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:1920px;height:1080px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=centrado-interno';document.body.appendChild(f);await carga;
    const w=f.contentWindow,media=w.matchMedia;
    w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
    const comprobar=(selector,nombre)=>{
      const d=w.document.querySelector(selector),r=d.getBoundingClientRect();
      t.check(r.width>0&&r.height>0,pagina+': '+nombre+' debe estar visible.');
      t.check(Math.abs(r.left+r.width/2-w.innerWidth/2)<2&&Math.abs(r.top+r.height/2-w.innerHeight/2)<2,pagina+': '+nombre+' no está centrado en '+w.innerWidth+'×'+w.innerHeight+'.');
      t.check(r.left>=0&&r.top>=0&&r.right<=w.innerWidth+1&&r.bottom<=w.innerHeight+1,pagina+': '+nombre+' sale del visor.');
    };
    try{
      for(const [ancho,alto] of [[1920,1080],[1440,900],[1280,720]]){
        f.style.width=ancho+'px';f.style.height=alto+'px';await sleep(80);
        w.campanaElegir();comprobar('#campanaPanel','selección');
        w.campanaGuardar({version:1,id:'centrado',lider:'fender',etapa:0});w.campanaRuta();comprobar('#campanaPanel','mesa');
        await w.campanaSeleccionar();await sleep(280);comprobar('#campanaEncuentroPanel','encuentro');w.campanaLimpiarPreparacion(true);
        w.campanaCabecera(w.campanaDialogo(),'Reiniciar campaña','Confirmación');comprobar('#campanaPanel','mensaje');w.campanaCerrar();
        w.campanaGuardar({version:1,id:'centrado',lider:'fender',etapa:6});w.campanaRuta();comprobar('#campanaDeseo','deseo');w.campanaCerrarDeseo();
        // Las hojas móviles se anclan abajo deliberadamente; los menús desktop se centran.
        if(pagina==='index.html')for(const abrir of ['showGallery','showRules','showRecords','showOnline','showTutorialPick']){
          w[abrir]();comprobar('#ovPanel',abrir);w.cerrarOv();
        }
      }
    }finally{w.matchMedia=media;w.campanaCerrarDeseo();w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaCreador', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;border:0;width:390px;height:664px';
    const cargar=()=>new Promise(r=>{f.onload=r;f.src=pagina+'?test=creador-interno';});const carga=cargar();document.body.appendChild(f);await carga;
    let w=f.contentWindow;
    const reducir=()=>{const media=w.matchMedia;w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);};reducir();
    const tocar=s=>{const b=w.document.querySelector(s);t.check(!!b,pagina+': falta '+s);b.click();};
    const ajustar=async(a,h)=>{f.style.width=a+'px';f.style.height=h+'px';await sleep(60);};
    const cabe=()=>{
      const d=w.document.querySelector('#campanaPanel'),r=d.getBoundingClientRect(),pie=d.querySelector('.campanaAcciones').getBoundingClientRect();
      t.check(d.scrollHeight<=d.clientHeight+1&&d.scrollWidth<=d.clientWidth+1,pagina+': el creador exige scroll en '+w.innerWidth+'×'+w.innerHeight);
      t.check(Math.abs(r.left+r.width/2-w.innerWidth/2)<2&&Math.abs(r.top+r.height/2-w.innerHeight/2)<2,pagina+': creador descentrado');
      d.querySelectorAll('input,button,fieldset,.creadorVista').forEach(n=>{const b=n.getBoundingClientRect();if(!b.width||!b.height)return;t.check(b.top>=r.top&&b.bottom<=r.bottom+1&&b.left>=r.left&&b.right<=r.right+1,pagina+': se recorta '+(n.title||n.textContent||n.id));if(n.closest('.creadorCuerpo')&&b.left<pie.right&&b.right>pie.left)t.check(b.bottom<=pie.top+1,pagina+': los controles se enciman al botón Continuar en '+w.innerWidth+'×'+w.innerHeight);});
    };
    try{
      w.eval('campanaMemoria=null');w.localStorage.removeItem('caoz.campana.v1.prueba');w.campanaLimpiarBorrador();
      for(const [a,h] of [[1920,1080],[390,664],[320,568],[320,480],[844,390],[568,320]]){
        await ajustar(a,h);w.campanaCrear();await sleep(30);for(const k of ['figura','colores','equipo']){tocar('[data-categoria="'+k+'"]');cabe();}
      }
      await ajustar(390,844);w.campanaCrear();
      const input=w.document.querySelector('#creadorNombre');input.value='<Rafa>';input.dispatchEvent(new w.Event('input'));
      input.focus();await ajustar(390,350);w.campanaTecladoCreador();t.check(w.document.querySelector('#campanaPanel').classList.contains('creadorTeclado'),pagina+': falta espacio para escribir con teclado');cabe();input.blur();await ajustar(390,844);w.campanaTecladoCreador();
      tocar('[data-valor="guardian"]');tocar('[data-valor="sombrero"]');tocar('[data-categoria="colores"]');
      const antes=w.document.querySelector('.creadorLienzo').toDataURL();tocar('[data-campo="color"][data-valor="azul"]');t.check(antes!==w.document.querySelector('.creadorLienzo').toDataURL(),pagina+': cambiar la capa no redibuja la miniatura');
      tocar('[data-campo="piel"][data-valor="ebano"]');tocar('[data-categoria="equipo"]');tocar('[data-valor="libro"]');
      const vista=w.document.querySelector('.creadorLienzo');tocar('[data-creador-continuar]');t.check(!vista.isConnected,pagina+': el creador no libera su visor');
      tocar('[aria-label="Protagonista siguiente"]');const esperado=w.campanaLeerBorrador().personaje;
      [...w.document.querySelectorAll('.campanaAcciones button')].find(n=>n.textContent==='Editar miniatura').click();t.check(w.document.querySelector('#creadorNombre').value==='<Rafa>'&&w.campanaLeerBorrador().lider==='fender',pagina+': volver a editar pierde el personaje o mazo');
      tocar('[data-creador-continuar]');t.check(w.document.querySelector('.campanaCarta.enfrente').dataset.campanaLider==='fender',pagina+': el carrusel olvida el mazo');
      tocar('.campanaConfirmar');let p=w.campanaLeer();t.check(p.lider==='fender'&&JSON.stringify(p.personaje)===JSON.stringify(esperado),pagina+': confirmar cambia la apariencia o el mazo');
      t.check(w.document.querySelector('.campanaSub').textContent.includes('<Rafa>')&&!w.document.querySelector('rafa'),pagina+': el nombre debe tratarse como texto');
      w.campanaCerrar();await cargar();w=f.contentWindow;reducir();w.abrirCampana();p=w.campanaLeer();
      t.check(JSON.stringify(p.personaje)===JSON.stringify(esperado)&&w.document.querySelector('#campanaPanel').dataset.vista==='mapa',pagina+': recargar no conserva el personaje');
      const lienzo=w.document.querySelector('.campanaLienzo3d');t.check(JSON.parse(lienzo.dataset.personaje).equipo==='libro',pagina+': la mesa no usa la miniatura propia');
      await w.campanaSeleccionar();t.check(w.document.querySelector('.campanaCombatiente b').textContent==='<Rafa>',pagina+': el encuentro pierde el nombre');w.campanaLimpiarPreparacion(true);
      let inicio;w.startMatch=async(a,b,op)=>{inicio={a,b,op};w.newGame(a,b);w.eval('G.campana='+JSON.stringify(op.campana));};await w.campanaCombatir();
      t.check(inicio.a==='fender'&&inicio.op.nombres[0]==='<Rafa>'&&w.eval('P(0).leaderId')==='fender'&&w.eval('P(0).deck.length')===40,pagina+': la campaña no inicia con el mazo elegido');
      let acciones;w.cinematicaFinal=async(_a,_b,op)=>{acciones=op;return true;};w.campanaFinal(0,'Prueba de avance');t.check(w.campanaLeer().etapa===1&&w.campanaLeer().personaje.color==='azul',pagina+': una victoria pierde la apariencia');
      acciones.revancha();await sleep(20);t.check(JSON.parse(w.document.querySelector('.campanaLienzo3d').dataset.personaje).nombre==='<Rafa>',pagina+': volver a la mesa cambia la miniatura');
      w.campanaCerrar();w.campanaGuardar({version:1,id:'anterior',lider:'adreida',etapa:3});w.abrirCampana();t.check(w.campanaLeer().etapa===3&&!w.campanaLeer().personaje,pagina+': una campaña anterior debe poder continuar');
      const normal=w.campanaNormalizarPersonaje({nombre:'x'.repeat(100),color:'url(evil)',equipo:'inventado'});t.check(normal.nombre.length===24&&normal.color==='vino'&&normal.equipo==='espada',pagina+': los datos guardados requieren valores válidos');
    }finally{w.campanaCerrar();w.campanaLimpiarBorrador();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('campanaMiniatura', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=miniatura-interna';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,media=w.matchMedia,ahora=w.performance.now;
    try{
      // Dos superficies que se cruzan: ordenar por profundidad media no puede
      // dibujar ambas correctamente. Verificar píxeles, también sin WebGL.
      const lienzo=d.createElement('canvas');lienzo.width=64;lienzo.height=64;const ctx=lienzo.getContext('2d');
      const caras=[{v:[[4,4,2],[60,4,8],[32,60,4]],color:'#ff0000'},{v:[[4,4,8],[60,4,2],[32,60,4]],color:'#0000ff'}];
      const pintar=orden=>{ctx.clearRect(0,0,64,64);w.campanaPintarMalla(ctx,orden,v=>({x:v[0],y:v[1],d:v[2]}),64,64);return [[13,12],[50,12]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);};
      for(const cpu of [false,true]){
        if(cpu)w.eval('campanaRaster.gl=null');
        const a=pintar(caras),b=pintar(caras.slice().reverse());
        t.check(a[0][0]>a[0][2]*2&&a[1][2]>a[1][0]*2,pagina+': una superficie lejana tapa la cercana'+(cpu?' sin GPU':''));
        t.check(JSON.stringify(a)===JSON.stringify(b),pagina+': el retrato depende del orden de los polígonos');
      }
      w.eval('campanaRaster=null');
      const retratoCompleto=selector=>{
        const carta=d.querySelector(selector),foto=carta?.querySelector('img');
        t.check(foto&&foto.offsetWidth>=carta.clientWidth-2&&foto.offsetHeight>=carta.clientHeight-2,pagina+': el retrato no llena '+selector);
      };
      const personaje=w.campanaNormalizarPersonaje({nombre:'<Ariadna>',figura:'mago',peinado:'capucha',equipo:'libro',color:'azul'});
      const retrato=w.campanaRetrato(personaje);
      t.check(retrato===w.campanaRetrato({...personaje,nombre:'Otro nombre'}),pagina+': se debe reutilizar la foto mientras no cambie la apariencia');
      t.check(retrato!==w.campanaRetrato({...personaje,equipo:'espada'}),pagina+': cambiar equipo no cambia el retrato');
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
      w.campanaGuardar({version:1,id:'miniatura',lider:'fender',personaje,etapa:1,enEncuentro:true});w.campanaRuta();
      t.check(d.querySelector('.campanaTu').textContent==='<Ariadna>'&&!d.querySelector('ariadna'),pagina+': el nombre de la ficha se interpreta como HTML o sigue diciendo TÚ');
      t.check(d.querySelector('.campanaIdentidad img').src===retrato,pagina+': falta la carta del jugador sobre la mesa');
      retratoCompleto('.campanaIdentidad');
      const escena=w.eval('campanaMesaEscena');await escena.saltarHacia(1).promesa;
      const r=w.eval('CAMPANA_CASILLAS[1]'),p=escena.posicion,giro=escena.orientacion;
      t.check(Math.sin(giro)*(r[0]-p[0])>0&&Math.cos(giro)*(r[1]-p[1])>0,pagina+': la miniatura termina mirando en otra dirección');
      w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:false}:media.call(w,q);
      let tiempo=0;w.performance.now=()=>tiempo;const ataque=escena.golpear();
      const proyeccion=()=>{const q=escena.posicion;return(q[0]-p[0])*(r[0]-p[0])+(q[1]-p[1])*(r[1]-p[1]);};
      tiempo=220;t.check(proyeccion()<0,pagina+': falta la carga hacia atrás antes del golpe');
      tiempo=370;t.check(proyeccion()>20,pagina+': la ficha no llega al golpe después de cargar');
      tiempo=600;t.check(w.campanaPoseGolpe(tiempo).caida===1,pagina+': el enemigo tarda demasiado en caer');
      escena.destruir();t.check(await ataque===false,pagina+': cerrar durante el golpe deja una victoria tardía');w.performance.now=ahora;
      w.campanaCerrar();
      // Mismo mazo en ambos lados: sólo la carta del jugador cambia.
      w.newGame('fender','fender');w.eval('G.campana='+JSON.stringify({personaje})+';G.fast=false;G.auto=false;G.silent=false;G.over=true');w.FXON=()=>true;
      w.render();t.check(d.querySelector('#leaderMe .liderJugador img')?.src===retrato&&!d.querySelector('#leaderFoe .liderJugador'),pagina+': la mesa de combate confunde personaje y mazo');
      if(pagina==='index.html')retratoCompleto('#leaderMe .liderJugador');
      w.cortinillaVS('fender','fender',{campana:{personaje}});await sleep(30);
      t.check(d.querySelector('.vs .izq.cartaJugador img')?.src===retrato&&!d.querySelector('.vs .der.cartaJugador'),pagina+': el VS usa al protagonista en vez de la miniatura');
      retratoCompleto('.vs .izq.cartaJugador');
      d.querySelector('.vs')?.remove();w.cinematicaFinal(0,'Victoria de prueba',{});await sleep(30);
      t.check(d.querySelector('.fin .gana.cartaJugador img')?.src===retrato&&!d.querySelector('.fin .pierde.cartaJugador'),pagina+': la victoria usa otra foto o modifica al rival');
      retratoCompleto('.fin .gana.cartaJugador');
      t.check(d.querySelector('.fin .lname')&&d.querySelector('.fin .sello>i').textContent.includes('<Ariadna>')&&!d.querySelector('ariadna'),pagina+': el final pierde o interpreta el nombre');
      w.cerrarCinematica();w.cinematicaFinal(1,'Derrota de prueba',{});await sleep(30);
      t.check(d.querySelector('.fin .pierde.cartaJugador img')?.src===retrato&&!d.querySelector('.fin .gana.cartaJugador'),pagina+': al perder se intercambian las identidades');
      w.cerrarCinematica();w.newGame('fender','fender');w.render();t.check(!d.querySelector('.liderJugador'),pagina+': una partida normal conserva la apariencia de campaña');
    }finally{w.performance.now=ahora;w.matchMedia=media;w.cerrarCinematica();w.campanaCerrar();w.relojPara();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('onlineInvitacion', async t => {
  const relay=new URLSearchParams(location.search).get('relay');
  if(!relay||!/^http:\/\/(127\.0\.0\.1|localhost):/.test(relay)){t.nota('Prueba de transporte disponible sólo con relay local explícito.');return;}
  const marcos=[];
  const abrir=async url=>{const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';f.src=url;const cargado=new Promise(r=>f.onload=r);document.body.appendChild(f);marcos.push(f);await cargado;return f.contentWindow;};
  try{
    const h=await abrir('index.html?test=online-interno&relay='+encodeURIComponent(relay));
    h.eval("ONL={lider:'fender',nombre:'Rafa Prueba'}");h.ask=async()=>0;await h.onlHost();
    const codigo=h.document.querySelector('#roomCode').textContent;
    const j=await abrir('movil.html?test=online-interno&sala='+codigo+'&relay='+encodeURIComponent(relay));j.ask=async()=>0;
    await sleep(400);const d=j.document;
    d.querySelector('.nombreinput').value='Amigo Prueba';
    [...d.querySelectorAll('#ovPanel button')].find(b=>b.textContent==='Continuar →').click();
    d.querySelector('#ovPanel .ltile').click();d.querySelector('#onlGo').click();
    for(let n=0;n<250;n++){await sleep(100);if(j.eval('G&&G.online&&G.turnNo>0'))break;}
    t.check(j.eval('G&&G.online&&G.turnNo>0'),'La invitación no llegó al tablero mediante el relevo local.');
    t.check(!d.querySelector('#ov').classList.contains('on'),'El formulario de código tapa la partida.');
    t.check(!d.querySelector('#reloj').hidden,'Falta reloj tras entrar por invitación.');
    t.check(h.eval('G.active')===1-j.eval('G.active'),'El turno no coincide entre los dos clientes.');
    j.netSend({t:'bye'});for(let n=0;n<40;n++){await sleep(100);if(h.eval('G.over'))break;}
    t.check(h.eval('G.over&&G.winner===ME'),'Salir no concede la victoria al otro jugador.');
  }finally{marcos.forEach(f=>{f.contentWindow.netClose();f.remove();});}
});

/* Rantiago necesita que la confirmación del dado vuelva al motor antes de
   aplicar el +2. Se usan los mensajes y los dos diálogos reales, sin relevos públicos. */
PRUEBAS.suite('rantiago', async t => {
  const esperar=async(cond,ms=6500)=>{const fin=Date.now()+ms;while(!cond()&&Date.now()<fin)await sleep(25);t.check(cond(),'La jugada de Rantiago no terminó a tiempo.');};
  for(const paginas of [['index.html','movil.html'],['movil.html','index.html']])for(const lado of [1,0]){
    const marcos=[];
    try{
      for(const pagina of paginas){
        const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=rantiago-interno';document.body.appendChild(f);marcos.push(f);await carga;
      }
      const [h,j]=marcos.map(f=>f.contentWindow),clientes=[h,j],dados=[[],[]];
      clientes.forEach((w,i)=>{
        w.newGame(i?'talesin':'mohamed',i?'mohamed':'talesin');
        w.eval('G.online=true;G.phase="principal";G.turnNo=3');
        Object.assign(w.eval('NET'),{on:true,host:i===0,guest:i===1,peer:true,sid:'rantiago-'+i,hechas:new Set(),esperaAck:new Map(),chs:[{ok:true,close(){}}]});
        Object.defineProperty(w.document,'hidden',{get:()=>false,configurable:true});w.netStatus=()=>{};w.Math.random=()=>.5;
        const original=w.rollDice;w.rollDice=(valor,nombre,interactivo,meta)=>{dados[i].push({valor,interactivo});return original(valor,nombre,interactivo,meta);};
        w.netSend=m=>{const copia=JSON.parse(JSON.stringify({...m,sid:'rantiago-'+i}));queueMicrotask(()=>clientes[1-i].netRecv(copia));};
        w.showScreen('board');
      });
      h.eval('G.active='+lado);h.eval('P(0).hand=[];P(1).hand=[]');h.eval('P('+lado+').hand=["rantiago"];P('+lado+').pd=10');
      const objetivo=h.mkUnit('bartolomeo',lado);objetivo.sick=false;h.eval('P('+lado+')').field=[objetivo];h.recalc();h.render();
      await esperar(()=>j.eval('P('+(1-lado)+').field.length')===1);await sleep(200);
      const jugador=clientes[lado],d=jugador.document;
      if(lado===1)j.gIntent('play',{id:'rantiago'});else h.playFromHand(0,'rantiago');
      await esperar(()=>!!jugador.eval('TGT'));d.querySelector('#myField [data-uid="'+objetivo.uid+'"]').click();
      await esperar(()=>dados[lado].length>0);await sleep(350);
      const caso=paginas.join(' → ')+(lado?' · juega invitado':' · juega anfitrión');
      t.check(dados[lado].length===1&&dados[lado][0].interactivo,caso+': el jugador debe recibir una sola tirada interactiva, sin otra animación que la tape.');
      t.check(dados[1-lado].length===1&&!dados[1-lado][0].interactivo,caso+': el rival sólo debe ver una tirada de espectador.');
      d.querySelector('#dbtn').click();await esperar(()=>!d.querySelector('#dbtn').disabled&&d.querySelector('#dbtn').textContent.includes('Continuar'));
      t.check(d.querySelector('#d20v').textContent==='11'&&d.querySelector('#defecto').textContent.includes('+2 ATQ'),caso+': el 11 debe anunciar el aumento de ataque.');
      d.querySelector('#dbtn').click();
      await esperar(()=>h.eval('P('+lado+').field[0].pA')===2&&j.eval('P('+(1-lado)+').field[0]?.pA')===2&&Object.keys(h.eval('NET.pending')).length===0&&!h.eval('NET.busy'));
      for(const [w,s] of [[h,lado],[j,1-lado]]){
        t.check(w.eval('P('+s+').field[0].atk')===3&&w.document.querySelector('[data-uid="'+objetivo.uid+'"] .atk').textContent==='3',caso+': el ataque debe subir de 1 a 3 en ambos clientes.');
      }
      // Otro estado de red no debe borrar el incremento permanente.
      h.netPushState();await sleep(250);t.check(j.eval('P('+(1-lado)+').field[0].pA')===2,caso+': el +2 debe sobrevivir a una nueva sincronización.');
    }finally{marcos.forEach(f=>{f.contentWindow.netSend=()=>{};f.contentWindow.netClose();f.remove();});}
  }
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=rantiago-local-interno';document.body.appendChild(f);await carga;const w=f.contentWindow;
    try{
      for(const modo of ['local','campana','ia'])for(const valor of [10,11,20]){
        w.newGame('talesin','mohamed');w.eval('G.fast=true;G.auto=true;G.silent=true;G.active=0;G.phase="principal"');
        if(modo==='campana')w.eval('G.campana={id:"rantiago",etapa:0,alma:16}');
        const s=modo==='ia'?1:0;w.eval('G.active='+s);w.eval('P(0).hand=[];P(1).hand=[]');w.eval('P('+s+').hand=["rantiago"];P('+s+').pd=10');
        const u=w.mkUnit('bartolomeo',s);u.sick=false;w.eval('P('+s+')').field=[u];w.recalc();w.Math.random=()=>(valor-.5)/20;
        await w.playFromHand(s,'rantiago',[[u]]);
        t.check(u.pA===(valor>=11?2:0)&&u.atk===(valor>=11?3:1)&&(u.stunned>0)===(valor<=10),pagina+' · '+modo+': resultado incorrecto con '+valor+'.');
        if(valor>=11){
          w.eval('G.online=true');await w.endTurn();await w.endTurn();
          t.check(u.pA===2&&u.atk===3,pagina+' · '+modo+': el beneficio debe ser permanente.');
          const alma=w.eval('P('+(1-s)+').alma');await w.doAttack(u,'face');
          t.check(w.eval('P('+(1-s)+').alma')===alma-3,pagina+' · '+modo+': el ataque aumentado debe hacer daño real.');
        }
      }
    }finally{w.relojPara();f.remove();}
  }
});

PRUEBAS.suite('onlineFlujo', async t => {
  newGame('fender','adreida');G.online=true;G.turnNo=3;G.phase='principal';
  RELOJ.queda=42;P(0).clouds=[{until:8}];const foto=netSnap();
  t.check(foto.reloj===42,'El estado online debe incluir el temporizador.');
  t.check(foto.foe.clouds&&foto.foe.clouds.length===1,'La nube debe viajar al invitado.');
  const marcos=[];
  try{
    for(const pagina of ['index.html','movil.html']){
      const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
      f.src=pagina+'?test=online-interno&b='+Date.now();const carga=new Promise(r=>f.onload=r);document.body.appendChild(f);marcos.push(f);await carga;
    }
    const [h,j]=marcos.map(f=>f.contentWindow), nh=h.eval('NET'),nj=j.eval('NET');
    const mensajes=[];
    for(const [w,n,host,nombre,sid] of [[h,nh,true,'Rafa <b>','hostPrueba'],[j,nj,false,'Amigo','guestPrueba']]){
      Object.assign(n,{on:true,host,guest:!host,peer:true,sid,miNombre:nombre,suNombre:host?'Amigo':'Rafa <b>',seq:0,seen:new Set(),chs:[{ok:true,close(){}}],hechas:new Set(),esperaAck:new Map(),ultimoRival:Date.now()});
      w.netStatus=()=>{};w.netTieneInternet=()=>true;
      w.ask=async()=>0;
    }
    h.netSend=m=>{mensajes.push(m.t);queueMicrotask(()=>j.netRecv({...m,sid:nh.sid}));};
    j.netSend=m=>{mensajes.push(m.t);queueMicrotask(()=>h.netRecv({...m,sid:nj.sid}));};
    const inicio=h.netHostStart('fender','adreida');await sleep(100);
    t.check([...h.document.querySelectorAll('.vs .lname')].map(n=>n.textContent).join('|')==='Rafa <b>|Amigo','VS debe usar los nombres de jugadores como texto.');
    await inicio;await sleep(400);
    t.check(mensajes.includes('coin')&&mensajes.includes('coinAck'),'El volado debe verse y confirmarse en los dos lados.');
    t.check(h.eval('G.active')===1-j.eval('G.active'),'El volado debe asignar el mismo turno en ambas perspectivas.');
    const partida=j.eval('G');await j.netRecv({...nh.welcome,sid:nh.sid});
    t.check(j.eval('G')===partida,'Una bienvenida repetida no debe reiniciar la partida.');
    await sleep(1100);
    t.check(!j.document.querySelector('#reloj').hidden,'El invitado debe ver el reloj.');
    t.check(h.eval('RELOJ.queda')===j.eval('RELOJ.queda'),'El reloj debe sincronizarse.');
    h.eval('P(0).clouds=[{until:G.turnNo+6}]');h.netPushState();await sleep(300);
    t.check(j.eval('P(1).clouds.length')===1,'La nube del anfitrión debe verse del lado rival.');
    const d=j.document,reg=d.querySelector('#btnRegistro');
    t.check(!!reg,'Debe existir el botón Registro.');
    {
      reg.dispatchEvent(new j.PointerEvent('pointerdown',{bubbles:true,clientX:100,clientY:100}));
      reg.dispatchEvent(new j.PointerEvent('pointermove',{bubbles:true,clientX:40,clientY:100}));
      reg.dispatchEvent(new j.PointerEvent('pointerup',{bubbles:true,clientX:40,clientY:100}));reg.click();
      t.check(!d.querySelector('#panel').classList.contains('on'),'Arrastrar no debe abrir el registro.');
      await sleep(550);reg.click();t.check(d.querySelector('#panel').classList.contains('on'),'Un toque deliberado debe abrir el registro.');
    }
    nh.ultimoRival=Date.now()-61000;h.netTieneInternet=()=>false;h.netPulso();
    t.check(!h.eval('G.over'),'Perder tu propia red no debe darte victoria.');
    h.netTieneInternet=()=>true;nh.ultimoRival=Date.now()-61000;h.netPulso();
    t.check(h.eval('G.over&&G.winner===ME'),'La ausencia de 60 segundos debe resolver la partida.');
    await sleep(300);
    t.check(j.eval('G.over&&G.winner===FOE'),'La victoria del anfitrión debe sincronizarse.');
    j.newGame('fender','adreida');j.eval('G.online=true;NET.peer=true');await j.netRecv({t:'bye'});
    t.check(j.eval('G.over&&G.winner===ME'),'La salida explícita del anfitrión debe dar la victoria al invitado.');
    for(const w of [h,j]){
      t.check(w.codigoInvitacion('https://juego.caozcontodo.com/?sala=ABCDE&b=180')==='ABCDE','Debe aceptarse el enlace pegado.');
    }
  }finally{marcos.forEach(f=>{f.contentWindow.netClose();f.remove();});}
});

/* El Lugar ocupa su altura real, incluso con texto largo o una Reliquia.
   Regresión de la captura móvil: el flex comprimía #midRow y las cartas
   propias quedaban encima del Puente y de su texto. */
PRUEBAS.suite('comicSecreto', async t => {
  for(const archivo of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;inset:0;width:390px;height:740px;z-index:999999';
    const carga=new Promise(r=>f.onload=r);f.src=archivo+'?test=comic-interna';document.body.appendChild(f);
    try{
      await carga;const w=f.contentWindow,d=f.contentDocument;
      const preparar=()=>{w.eval("SEL_PASO='yo';SELP=null;buildSelect();showScreen('select');");};
      const abierto=()=>!!d.querySelector('#comicSecreto[open]');
      const tecla=(paso,repeat=false)=>d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:paso===1?'ArrowRight':'ArrowLeft',bubbles:true,repeat}));
      const codigo=[1,-1,1,-1,1,1,-1,-1];
      preparar();await sleep(50);
      codigo.slice(0,7).forEach(p=>tecla(p));t.check(!abierto(),archivo+': siete movimientos no abren');
      tecla(-1,true);t.check(!abierto(),archivo+': mantener una tecla no completa el secreto');
      tecla(-1);t.check(abierto(),archivo+': ocho movimientos abren el secreto');
      const dialogo=d.querySelector('#comicSecreto'),elegido=w.eval('SELP');
      tecla(1);t.igual(w.eval('SELP'),elegido,archivo+': el pop up no mueve el selector');
      t.check(!dialogo.querySelector('a[download],a[href]'),archivo+': no hay descarga ficticia');
      dialogo.querySelector('button').click();await sleep(30);t.check(!abierto(),archivo+': volver cierra');
      codigo.slice(0,4).forEach(p=>tecla(p));w.showScreen('menu');await sleep(30);preparar();await sleep(30);
      codigo.slice(4).forEach(p=>tecla(p));t.check(!abierto(),archivo+': salir borra la secuencia');
      w.eval("SEL_PASO='rival';buildSelect();");await sleep(30);codigo.forEach(p=>tecla(p));t.check(!abierto(),archivo+': rival excluido');
      preparar();await sleep(30);
      if(archivo==='index.html')codigo.forEach(p=>d.querySelector(p===1?'#carrSig':'#carrAnt').click());
      else{
        const pista=d.querySelector('#leaderList');
        for(const p of codigo){
          pista.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,isPrimary:true,button:0,pointerId:1,clientX:160,clientY:180}));
          pista.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,isPrimary:true,button:0,pointerId:1,clientX:160+p*70,clientY:184}));
        }
      }
      t.check(abierto(),archivo+': flechas o gestos también desbloquean');
      const r=dialogo.getBoundingClientRect();t.check(Math.abs((r.left+r.right)/2-w.innerWidth/2)<2,archivo+': pop up centrado');
      t.check(r.top>=0&&r.bottom<=w.innerHeight+1,archivo+': pop up cabe en pantalla');
    }finally{f.remove();}
  }
});

PRUEBAS.suite('sonidos', async t => {
  const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:664px';
  const carga=new Promise(r=>f.onload=r);f.src='movil.html?test=sonidos-interna';document.body.appendChild(f);
  try{
    await carga;const w=f.contentWindow,a=w.CAOZ_AUDIO;await a.listo;
    t.igual(a.catalogo.length,37,'El banco debe estar disponible también en móvil');
    t.igual(a.magia({id:'escarcha',n:'Rayo de Escarcha'}),'spell_frost','Escarcha no debe confundirse con electricidad por la palabra Rayo');
    t.igual(a.magia({id:'pasoatronador',n:'Thunder step',sub:['cancion']}),'spell_lightning','Thunder step conserva su descarga');
    t.igual(a.magia({id:'contrahechizo'}),'shield','Contrahechizo utiliza el sello protector');
    let comienzos=0,paradas=0;
    const parametro=()=>({value:0,setTargetAtTime(){}}),nodo=()=>({connect(){},disconnect(){},gain:parametro()});
    w.AudioContext=class{
      constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
      resume(){this.state='running';return Promise.resolve();}
      createGain(){return nodo();}
      createDynamicsCompressor(){return {...nodo(),threshold:parametro(),knee:parametro(),ratio:parametro(),attack:parametro(),release:parametro()};}
      decodeAudioData(){return Promise.resolve({duration:1});}
      createBufferSource(){return {...nodo(),playbackRate:{value:1},start(){comienzos++;},stop(){paradas++;this.onended?.();}};}
    };
    w.newGame('fender','mohamed');w.eval('G.fast=false;G.auto=false;G.silent=false');
    a.configurar({silencio:false,volumen:.7});await a.desbloquear();await Promise.all(a.catalogo.map(s=>a.cargar(s.id)));
    t.check(a.play('attack_hit'),'El contacto debe reproducirse tras desbloquear audio');
    t.igual(comienzos,1,'Un contacto produce una sola voz');
    a.play('attack_hit');t.igual(comienzos,1,'El límite evita golpes duplicados en el mismo instante');
    a.configurar({silencio:true});t.igual(a.estado.voces,0,'Silenciar corta las voces que ya estaban sonando');
    t.check(paradas>0,'Silenciar detiene la fuente de audio');
    t.check(!a.play('heal'),'Silenciar también impide los efectos nuevos');
    a.configurar({silencio:false,volumen:50});t.igual(a.ajustes.volumen,1,'El volumen no puede exceder el máximo');
    for(const modo of ['fast','silent','auto']){w.eval('G.'+modo+'=true');t.check(!a.play('heal'),'No debe sonar en modo '+modo);w.eval('G.'+modo+'=false');}
    for(const s of a.catalogo)a.play(s.id);
    t.check(a.estado.voces<=8,'Una ráfaga de efectos no puede saturar con más de ocho voces');
    a.detener();t.igual(a.estado.voces,0,'Al salir no quedan fuentes sonando');
    t.check(!a.play('sonido_inexistente'),'Un id desconocido es inocuo para el motor');
    t.nota('Banco móvil, categorías, contacto único, silencio, límites y modos rápidos verificados.');
  }finally{f.contentWindow.CAOZ_AUDIO?.detener();f.remove();}
});

PRUEBAS.suite('hoverNatural', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:664px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=hover-natural-interna';document.body.appendChild(f);
    let reloj,azar;
    try{
      await carga;const w=f.contentWindow,d=f.contentDocument,a=w.CAOZ_AUDIO,tomas=[];await a.listo;
      reloj=w.performance.now;azar=w.Math.random;
      const param=()=>({value:0,setTargetAtTime(){}}),nodo=()=>({connect(){},disconnect(){},gain:param()});
      w.AudioContext=class{
        constructor(){this.state='running';this.currentTime=0;this.destination={};}resume(){return Promise.resolve();}
        createGain(){return nodo();}createDynamicsCompressor(){return {...nodo(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
        decodeAudioData(){return Promise.resolve({duration:1});}
        createBufferSource(){return {...nodo(),playbackRate:{value:1},connect(g){this.destino=g;},start(){tomas.push({ritmo:this.playbackRate.value,ganancia:this.destino.gain.value,buffer:this.buffer});},stop(){this.onended?.();}};}
      };
      w.newGame('fender','mohamed');w.eval('G.fast=false;G.auto=false;G.silent=false');a.configurar({silencio:false,volumen:.7});await a.desbloquear();await a.cargar('card_hover');await a.cargar('victory_slam');
      let tiempo=reloj.call(w.performance)+1000,paso=0;w.performance.now=()=>tiempo;
      w.Math.random=()=>[.12,.2,.86,.8,.36,.4,.64,.6][paso++%8];
      const base=a.catalogo.find(s=>s.id==='card_hover').volumen;
      for(let i=0;i<8;i++){tiempo+=200;a.play('card_hover',{intensidad:.5});}
      t.igual(tomas.length,8,pagina+': cada roce debe producir una voz');
      t.check(tomas.every(v=>v.ritmo>=2**(-1/12)&&v.ritmo<=2**(1/12)),pagina+': pitch limitado a un semitono');
      t.check(tomas.every((v,i)=>!i||v.ritmo!==tomas[i-1].ritmo),pagina+': no repetir el mismo pitch consecutivo');
      t.check(tomas.every(v=>v.buffer===tomas[0].buffer),pagina+': usar siempre el mismo archivo decodificado');
      t.check(new Set(tomas.map(v=>v.ganancia)).size>1,pagina+': también debe variar el volumen');
      t.check(tomas.every(v=>v.ganancia>=base*.91*.9-.0001&&v.ganancia<=base*.91*1.1+.0001),pagina+': variación de volumen moderada y relativa al estudio');
      tiempo+=200;a.play('card_hover',{variar:false,intensidad:1});t.igual(tomas.at(-1).ritmo,1,pagina+': reproducción sin variación');t.igual(tomas.at(-1).ganancia,base,pagina+': conserva el volumen original sin variación');
      tiempo+=200;a.play('victory_slam');t.igual(tomas.at(-1).ritmo,1,pagina+': Victoria conserva su identidad sonora');
      w.Math.random=()=>.5;
      const carta=d.createElement('div');carta.className='card';carta.innerHTML='<span>Prueba</span>';d.querySelector('#hand').appendChild(carta);
      const mover=(tipo,x)=>carta.dispatchEvent(new w.PointerEvent(tipo,{bubbles:true,pointerType:'mouse',pointerId:1,clientX:x,clientY:100}));
      const barrido=rapido=>{w.dispatchEvent(new w.Event('blur'));tiempo+=200;mover('pointermove',100);tiempo+=20;mover('pointermove',rapido?140:102);tiempo+=20;mover('pointerover',rapido?180:104);return tomas.at(-1).ganancia;};
      const suave=barrido(false),fuerte=barrido(true);t.check(fuerte>suave*1.1,pagina+': un barrido rápido se siente más marcado');
      tiempo+=200;mover('pointerover',600);t.check(tomas.at(-1).ganancia<fuerte,pagina+': una pausa no conserva la velocidad del barrido anterior');
      const cantidad=tomas.length;tiempo+=200;carta.firstChild.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse',relatedTarget:carta}));t.igual(tomas.length,cantidad,pagina+': no repetir dentro de la misma carta');
      tiempo+=200;carta.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));t.check(tomas.at(-1).ganancia>suave&&tomas.at(-1).ganancia<fuerte,pagina+': el toque usa una intensidad intermedia');
      const antes=tomas.length;a.configurar({silencio:true});tiempo+=200;mover('pointerover',900);t.igual(tomas.length,antes,pagina+': el silencio se respeta también al mover rápido');
    }finally{if(reloj)f.contentWindow.performance.now=reloj;if(azar)f.contentWindow.Math.random=azar;f.contentWindow.CAOZ_AUDIO?.detener();f.remove();}
  }
});

PRUEBAS.suite('sonidosMomentos', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:664px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=sonidos-momentos-interna';document.body.appendChild(f);
    try{
      await carga;const w=f.contentWindow,d=f.contentDocument,a=w.CAOZ_AUDIO,eventos=[];await a.listo;
      const param=()=>({value:0,setTargetAtTime(){}}),nodo=()=>({connect(){},disconnect(){},gain:param()});
      w.AudioContext=class{
        constructor(){this.state='running';this.currentTime=0;this.destination={};}resume(){return Promise.resolve();}
        createGain(){return nodo();}createDynamicsCompressor(){return {...nodo(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
        decodeAudioData(){return Promise.resolve({duration:1});}
        createBufferSource(){return {...nodo(),playbackRate:{value:1},start(){},stop(){this.onended?.();}};}
      };
      w.newGame('fender','mohamed');w.eval('G.fast=false;G.auto=false;G.silent=false');w.render();w.showScreen('board');
      a.configurar({silencio:false,volumen:.7});await a.desbloquear();await Promise.all(a.catalogo.map(s=>a.cargar(s.id)));
      w.addEventListener('caoz:sfx',e=>eventos.push({id:e.detail.id,t:w.performance.now()}));
      const contar=id=>eventos.filter(e=>e.id===id).length;
      const carta=d.createElement('div');carta.className='card';carta.innerHTML='<span>Prueba</span>';d.querySelector('#hand').appendChild(carta);
      carta.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));t.igual(contar('card_hover'),1,pagina+': hover de carta debe sonar');
      await sleep(100);carta.firstChild.dispatchEvent(new w.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse',relatedTarget:carta}));t.igual(contar('card_hover'),1,pagina+': moverse dentro de la carta no duplica hover');
      carta.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));t.igual(contar('card_hover'),2,pagina+': la exploración táctil tiene sonido');carta.remove();
      const u=w.eval("P(0).field.push(mkUnit('discipulo',0));P(0).field.at(-1)");w.render();
      await w.fxLunge(u,'face');t.igual(contar('attack_hit'),0,pagina+': el ataque al protagonista no duplica el golpe genérico');
      await w.fxFace(1,2);t.igual(contar('leader_hit'),1,pagina+': el protagonista debe sonar al recibir el golpe');
      await sleep(100);await w.fxFace(0,1);t.igual(contar('leader_hit'),2,pagina+': ambos protagonistas usan el sonido propio');
      await sleep(100);const antes=contar('leader_hit');a.configurar({silencio:true});await w.fxFace(1,1);t.igual(contar('leader_hit'),antes,pagina+': respeta silencio');a.configurar({silencio:false});
      let aterriza=0;const observar=new w.MutationObserver(()=>{if(!aterriza&&d.querySelector('.fin.sello-on'))aterriza=w.performance.now();});observar.observe(d.body,{subtree:true,attributes:true,attributeFilter:['class']});
      w.cinematicaFinal(0,'Victoria de prueba',{});await sleep(2150);observar.disconnect();
      const golpes=eventos.filter(e=>e.id==='victory_slam');t.igual(golpes.length,1,pagina+': Victoria tiene un único impacto propio');
      t.check(golpes[0].t-aterriza>=150&&golpes[0].t-aterriza<450,pagina+': el sonido debe coincidir con la llegada del sello, no con el comienzo del final');
      w.cerrarCinematica();
      w.cinematicaFinal(0,'Salida anticipada',{});await sleep(50);d.querySelector('.fin').click();await sleep(350);t.igual(contar('victory_slam'),1,pagina+': saltar no dispara un golpe tardío');
    }finally{f.contentWindow.CAOZ_AUDIO?.detener();f.contentWindow.cerrarCinematica();f.remove();}
  }
});

PRUEBAS.suite('terrenoMovil', async t => {
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;left:-10000px;width:390px;height:664px;border:0';
  const carga=new Promise(r=>f.onload=r);f.src='movil.html?test=terreno-interna';document.body.appendChild(f);
  try{
    await carga;const w=f.contentWindow,d=f.contentDocument;
    w.newGame('fender','mohamed');
    w.eval("G.fast=true;G.phase='principal';P(0).pd=10;P(0).hand=['matildus','adolfo','eric','discipulo','puente'];");
    w.showScreen('board');
    const comprobar=etiqueta=>{
      const rect=s=>d.querySelector(s).getBoundingClientRect();
      const campo=rect('#field'),medio=rect('#midRow');
      for(const elemento of d.querySelector('#midRow').children){
        const r=elemento.getBoundingClientRect();
        t.check(r.top>=medio.top&&r.bottom<=medio.bottom,etiqueta+': el terreno y sus acciones deben caber dentro de la franja central.');
      }
      for(const lado of ['foeField','myField'])for(const carta of d.querySelectorAll('#'+lado+' .card')){
        const r=carta.getBoundingClientRect();
        t.check(r.width>=44,etiqueta+': las cartas deben conservar un tamaño tocable.');
        const cajas=[r,...[...carta.querySelectorAll('.cost,.atk,.hp')].map(e=>e.getBoundingClientRect())];
        const listo=w.getComputedStyle(carta,'::after');
        if(listo.content!== 'none'&&listo.display!=='none')cajas.push({top:r.top+parseFloat(listo.top),bottom:r.top+parseFloat(listo.top)+parseFloat(listo.height)});
        for(const caja of cajas){
          t.check(lado==='foeField'?caja.bottom<=medio.top-1:caja.top>=medio.bottom+1,etiqueta+': una carta o su indicador invade el terreno ('+lado+').');
          t.check(caja.top>=campo.top&&caja.bottom<=campo.bottom,etiqueta+': las cartas deben caber en el campo.');
        }
        t.check(r.left>=campo.left&&r.right<=campo.right,etiqueta+': cinco cartas deben caber a lo ancho.');
      }
      t.check(rect('#myTraps').bottom<=campo.bottom+.5,etiqueta+': las trampas no deben invadir la barra del jugador ('+rect('#myTraps').bottom+' > '+campo.bottom+').');
      t.check(rect('#controls').bottom<=rect('#board').bottom+.5,etiqueta+': los controles deben quedar dentro de la pantalla.');
    };
    for(const [ancho,alto,app] of [[390,664,false],[320,568,false],[402,812,true],[430,932,false]]){
      Object.defineProperty(w.navigator,'standalone',{value:app,configurable:true});
      f.style.width=ancho+'px';f.style.height=alto+'px';await sleep(60);w.ajustarLienzo();
      for(const cantidad of [2,5]){
        w.eval(`for(const s of [0,1]){P(s).field=[];for(let i=0;i<${cantidad};i++){const u=mkUnit(s?'conserje':'matildus',s);u.sick=false;P(s).field.push(u);}}recalc();`);
        for(const lugar of [null,'puente','montanas',null]){
          w.eval(`G.place=${lugar?JSON.stringify({id:lugar,side:1}):'null'};P(0).relics=[];`);w.render();await sleep(40);
          comprobar(`${ancho}×${alto}, ${cantidad} cartas, ${lugar||'sin Lugar'}`);
        }
      }
      w.eval("G.place={id:'puente',side:0};P(0).relics=[{id:'puntosrobados',counters:2}];");w.render();await sleep(40);
      comprobar(`${ancho}×${alto}, Puente y Reliquia`);
      d.querySelector('#hand .card').click();await sleep(40);
      comprobar(`${ancho}×${alto}, carta seleccionada en mano`);w.manoTocada(null);
      d.querySelector('.placecard').click();
      t.check(d.querySelector('#inspect.on')?.textContent.includes('El Puente de Brick y Brock'),'El terreno debe seguir abriendo su ficha.');w.cerrarHojas();
    }
  }finally{f.contentWindow.relojPara();f.remove();}
});

PRUEBAS.suite('nubeDagasUI', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    f.src=pagina+'?test=nube-interna&b='+Date.now();
    const carga=new Promise(r=>f.onload=r);document.body.appendChild(f);
    try{
      await carga;const w=f.contentWindow,d=f.contentDocument;const jugador=w.eval('P');
      w.newGame('fender','adreida');jugador(1).clouds=[{until:0}];w.render();
      t.check(!!d.querySelector('#efectosRival .efecto'),pagina+': falta nube activa en el lado rival, incluido su último turno.');
      t.check(!d.querySelector('#efectos .efecto'),pagina+': la nube rival aparece en tu lado.');
      jugador(0).clouds=[{until:6}];w.render();
      t.check(!!d.querySelector('#efectos .efecto'),pagina+': falta la nube propia.');
      const icono=d.querySelector('#efectosRival .ei');
      t.check(w.getComputedStyle(icono).animationName==='dagasAlerta',pagina+': falta el parpadeo rojo.');
      jugador(0).hand=['minus'];jugador(0).pd=10;
      w.eval("G.phase='principal';G.fast=true");w.showScreen('board');w.render();
      t.check(d.querySelector('#efectosRival').getBoundingClientRect().top<d.querySelector('#efectos').getBoundingClientRect().top,pagina+': los indicadores no respetan los lados.');
      d.querySelector('#hand .card').click();
      if(pagina==='movil.html')d.querySelector('#jugarPill button.gold').click();
      t.check(d.querySelector('#ov').classList.contains('on')&&d.querySelector('#ovPanel').textContent.includes('2 de daño'),pagina+': tocar la carta no abre la confirmación.');
      const cancelar=[...d.querySelectorAll('#ovPanel button')].find(b=>b.textContent==='Cancelar');
      t.check(!!cancelar,pagina+': falta Cancelar.');cancelar.click();await sleep(0);
      t.check(jugador(0).pd===10&&jugador(0).hand.includes('minus'),pagina+': el clic cancelado jugó la carta.');
      let preguntas=0;w.ask=async()=>{preguntas++;return 0;};
      t.check(await w.confirmarNubeDagas('minus')===false,pagina+': cancelar debe frenar la jugada.');
      t.check(jugador(0).pd===10&&jugador(0).hand.includes('minus'),pagina+': cancelar consume recursos.');
      w.ask=async()=>{preguntas++;return 1;};
      t.check(await w.confirmarNubeDagas('minus')===true,pagina+': confirmar debe permitir continuar.');
      await w.confirmarNubeDagas('nubedagas');
      t.check(preguntas===2,pagina+': no debe advertir para un hechizo.');
      jugador(1).clouds=[{until:-1}];w.render();
      t.check(!d.querySelector('#efectosRival .efecto'),pagina+': la nube caducada sigue visible.');
      t.check(await w.confirmarNubeDagas('minus')===true&&preguntas===2,pagina+': nube propia o caducada genera aviso.');
    }finally{f.remove();}
  }
});

PRUEBAS.suite('menusDorados', async t => {
  for(const pagina of ['index.html','movil.html']){
    const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
    const carga=new Promise(r=>f.onload=r);f.src=pagina+'?test=menus-internos';document.body.appendChild(f);await carga;
    const w=f.contentWindow,d=w.document,media=w.matchMedia;
    const barridos=()=>[...d.querySelectorAll('#barrido.va,.barridoModal.va,.campanaBarrido.va')];
    const comprobar=(etiqueta)=>{
      const b=barridos();t.check(b.length===1,pagina+': '+etiqueta+' debe tener un solo barrido dorado.');
      t.check(w.getComputedStyle(b[0]).animationName==='cruza'&&w.getComputedStyle(b[0]).pointerEvents==='none',pagina+': '+etiqueta+' debe animar sin bloquear los botones.');
    };
    const regresoVisible=()=>{
      for(const nodo of d.querySelectorAll('#menu>.marcaWrap,#menu>.marca,#menu>.menucol')){
        const css=w.getComputedStyle(nodo);
        t.check(css.opacity==='1'&&!css.animationName.includes('entraPantalla'),pagina+': al regresar, el logo y los botones deben estar visibles inmediatamente debajo del oro.');
      }
    };
    try{
      w.localStorage.removeItem('caoz.campana.v1.prueba');
      for(const [boton,salida] of [['mPlay','#selBack'],['mGuides','#guideBack'],['mCampana',null],['mTut',null],['mOnline',null],['mCards',null],['mRules',null],['mRecords',null]]){
        d.querySelector('#'+boton).click();comprobar('entrar en '+boton);
        const modal=d.querySelector('#ov.on');
        if(modal)t.check(!!modal.querySelector('.barridoModal')&&d.querySelector('#ovPanel').classList.contains('menuEntra'),pagina+': el barrido debe dibujarse delante de la ventana.');
        const panel=boton==='mCampana'?d.querySelector('#campanaPanel'):d.querySelector('#ovPanel');
        const cerrar=salida?d.querySelector(salida):[...panel.querySelectorAll('button')].find(b=>/^(Cerrar|Cancelar|Menú principal)$/.test(b.textContent.trim()));
        t.check(!!cerrar,pagina+': falta regreso de '+boton);cerrar.click();comprobar('volver de '+boton);
        t.check(d.querySelector('#menu.on')&&!d.querySelector('#ov.on')&&!d.querySelector('#campanaPanel[open]'),pagina+': '+boton+' no regresa al menú principal.');
        regresoVisible();await sleep(130);regresoVisible();
      }
      await sleep(750);
      t.check(!barridos().length&&!d.querySelector('.menuEntra,.screen.entra'),pagina+': quedan efectos al terminar.');
      w.showRecords();d.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));comprobar('cerrar récords con Escape');
      regresoVisible();
      t.check(!d.querySelector('#ov.on'),pagina+': Escape deja la ventana abierta.');
      w.showOnline();d.querySelector('#ov').click();comprobar('cerrar al tocar el fondo');
      regresoVisible();
      t.check(!d.querySelector('#ov.on'),pagina+': tocar el fondo no regresa al menú.');
      w.abrirCampana();d.querySelector('#campanaPanel').dispatchEvent(new Event('cancel',{cancelable:true}));comprobar('cerrar Campaña con Escape');
      regresoVisible();
      t.check(!d.querySelector('#campanaPanel[open]'),pagina+': Escape deja abierta Campaña.');
      w.showRecords();await sleep(350);w.cerrarOv();w.showOnline();await sleep(400);
      t.check(d.querySelector('#ovPanel').classList.contains('menuEntra'),pagina+': un temporizador anterior corta la entrada nueva.');
      w.showScreen('board');w.cerrarOv();w.showRules(true);
      t.check(!barridos().length&&!d.querySelector('.menuEntra'),pagina+': los diálogos de combate heredan transiciones de menú.');
      w.cerrarOv();t.check(!barridos().length,pagina+': cerrar reglas en combate activa el barrido.');
      w.showScreen('menu');w.matchMedia=q=>q==='(prefers-reduced-motion:reduce)'?{matches:true}:media.call(w,q);
      w.showOnline();t.check(!barridos().length&&!d.querySelector('.menuEntra,.screen.entra'),pagina+': movimiento reducido debe abrir sin animación.');
      w.cerrarOv();t.check(!barridos().length,pagina+': movimiento reducido debe regresar sin animación.');
    }finally{w.matchMedia=media;w.campanaCerrar();w.localStorage.removeItem('caoz.campana.v1.prueba');f.remove();}
  }
});

PRUEBAS.suite('entradaMovil', async t => {
  const marco=document.createElement('iframe');
  marco.style.cssText='position:fixed;left:-10000px;width:390px;height:844px';
  marco.src='movil.html?test=entrada-interna&b='+Date.now();
  const cargado=new Promise(resolve=>marco.onload=resolve);document.body.appendChild(marco);
  try{
    await cargado;const d=marco.contentDocument;const w=marco.contentWindow;
    d.querySelector('#mPlay').click();
    t.check(d.querySelector('#select').classList.contains('on'),'Jugar debe abrir la selección.');
    t.check(!!d.querySelector('#barrido.va'),'Jugar debe activar la cortinilla móvil.');
    t.check(d.querySelector('#select').classList.contains('entra'),'La selección debe entrar animada.');
    await sleep(750);
    t.check(!d.querySelector('#barrido.va')&&!d.querySelector('.screen.entra'),'La transición debe limpiarse.');
    w.showScreen('menu');w.showScreen('board');
    t.check(!d.querySelector('#barrido.va'),'El tablero no debe heredar una cortinilla de menú.');
  }finally{marco.remove();}
});

PRUEBAS.suite('banco', async t => {
  const marco=document.createElement('iframe');marco.src='balance.html?auto';
  marco.style.cssText='position:fixed;left:-10000px;width:1280px;height:900px';document.body.appendChild(marco);
  try{
    let d;
    for(let i=0;i<200;i++){
      await sleep(100);d=marco.contentDocument;
      if(d&&d.querySelector('#copiar')&&!d.querySelector('#copiar').disabled)break;
    }
    const tabla=d&&d.querySelector('#salida table');
    t.check(!!tabla,'El banco debe terminar y presentar sus resultados.');
    const filas=[...tabla.querySelectorAll('tr')].slice(1);
    const victorias=filas.reduce((n,f)=>n+Number(f.cells[2].textContent),0);
    const participaciones=filas.reduce((n,f)=>n+Number(f.cells[1].textContent),0);
    t.check(victorias===participaciones/2,'El banco pierde victorias: '+victorias+' de '+participaciones/2);
    t.nota(victorias+' partidas, todas con ganador contabilizado.');
  }finally{marco.remove();}
});

PRUEBAS.suite('tipografia', async t => {
  showGallery();await sleep(200);
  try{
    const nombres=[...document.querySelectorAll('#ov .gallery .card .nm')];
    t.check(nombres.length>80,'La galería debe presentar el set base para revisar sus títulos.');
    const cortados=nombres.filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2);
    t.check(!cortados.length,'Nombres recortados: '+cortados.map(e=>e.textContent).join(', '));
    t.check(nombres.every(e=>getComputedStyle(e).textAlign==='center'),'Los nombres deben estar centrados.');
  }finally{document.querySelector('#ov').classList.remove('on');}
});

PRUEBAS.suite('auditoria', async t => {
  const fallos=[];const comprobar=(ok,m)=>{if(!ok)fallos.push(m);};
  await T.startMatch('fender','adreida',{volado:false,first:0});
  const u=T.mkUnit('minus',0);u.sick=false;u.stunned=1;T.P(0).field.push(u);T.P(0).pd=10;
  T.recalc();selectUnit(u);
  const boton=[...document.querySelectorAll('#controls button')].find(b=>b.textContent.includes(u.card.act.n));
  comprobar(boton&&boton.disabled,'La habilidad de una unidad aturdida aparece habilitada.');
  const pdAntes=T.P(0).pd;
  comprobar(await useAct(u)===false&&T.P(0).pd===pdAntes,'Una habilidad aturdida no debe gastar PD.');
  u.stunned=0;renderControls();
  comprobar(canUseAct(u)&&![...document.querySelectorAll('#controls button')].find(b=>b.textContent.includes(u.card.act.n)).disabled,'La habilidad válida debe estar disponible.');
  u.possessed=true;comprobar(!canUseAct(u),'Una unidad poseída no puede usar habilidad.');u.possessed=false;
  clearPrompt();SEL=null;
  G.resolving=true;renderControls();
  const terminar=[...document.querySelectorAll('#controls button')].find(b=>b.textContent.includes('Terminar'));
  comprobar(terminar&&terminar.disabled,'Se puede terminar el turno durante un combate.');
  const turnoAntes=G.active, faseAntes=G.phase;
  await endTurn();pedirTerminarTurno();
  comprobar(G.active===turnoAntes&&G.phase===faseAntes,'Terminar turno debe esperar al combate incluso por llamada directa.');
  G.resolving=false;
  const caraOriginal=window.fxFace;let simultaneas=0,maximas=0;
  try{
    window.fxFace=async()=>{simultaneas++;maximas=Math.max(maximas,simultaneas);await sleep(50);simultaneas--;};
    await Promise.all([netPlayFx([{k:'face',side:0,n:1}]),netPlayFx([{k:'face',side:0,n:1}])]);
    comprobar(maximas===1,'Los efectos de estados online consecutivos se superponen.');
  }finally{window.fxFace=caraOriginal;}
  u.stunned=0;T.render();await sleep(400);
  const muerte=fxDeath(u);await sleep(60);
  const fantasma=document.querySelector('#fx .card');
  comprobar(fantasma&&fantasma.classList.contains('acomodo'),'La animación de muerte pierde el diseño de la carta.');
  await muerte;
  const originalShow=window.showEnd;let fin=null;
  try{
    window.showEnd=(winner,why)=>{fin={winner,why};};
    G.over=true;G.winner=FOE;G.endWhy='Victoria por Deseo';
    const estado=netSnap();
    comprobar(estado.winner===ME && estado.why==='Victoria por Deseo','La red no transmite el ganador y motivo reales.');
    G.over=false;G.overShown=false;netApply(estado);await sleep(750);
    comprobar(fin&&fin.winner===ME&&fin.why==='Victoria por Deseo','El invitado muestra derrota cuando gana por Deseo.');
  }finally{window.showEnd=originalShow;}
  await T.startMatch('fender','adreida',{volado:false,first:0});
  const a=T.mkUnit('horton',1),b=T.mkUnit('discipulo',0);T.P(1).field.push(a);T.P(0).field.push(b);T.recalc();T.render();
  await fxLunge(a,b);
  const dano=fxHit(b,1,{inf:true});await sleep(100);
  comprobar(!!document.querySelector('.fxnum.inf'),'La infección inmediatamente después de un ataque pierde su color verde.');
  await dano;
  const originales=[window.playFromHand,window.useLeader,window.useRelic];let entradas=0;
  try{
    window.playFromHand=window.useLeader=window.useRelic=async()=>{entradas++;return false;};
    G.resolving=true;T.P(0).pd=10;T.P(0).hand=['matildus'];T.P(0).relics=[{id:'puntosrobados',counters:1}];T.render();
    if(typeof jugarDeLaMano==='function')jugarDeLaMano('matildus');
    else document.querySelector('#hand .card').click();
    document.querySelector('#leaderMe').firstElementChild.click();
    [...document.querySelectorAll('#midRow button')].find(b=>b.textContent.includes('Cobrar')).click();
    comprobar(entradas===0,'Mano, líder y reliquia permiten acciones durante el combate.');
  }finally{[window.playFromHand,window.useLeader,window.useRelic]=originales;G.resolving=false;T.render();}
  t.check(!fallos.length,fallos.join('\n'));
  t.nota('Habilidades, muerte de cartas, victoria online e identificación del daño.');
});

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
    /* Lo que importa es que puedas SALIR del punto muerto, no que se abra todo.
       Antes esto comprobaba `permiso.free` —la implementación— y por eso se
       ponía en rojo al cerrar el tutorial a lo imprescindible. Lo que no puede
       pasar es que no te deje terminar el turno. */
    t.check(permiso && tutCan('end'),
      'en tu propio turno, un paso reactivo tiene que dejarte terminar el turno: si no, punto muerto');
    t.check(!permiso.free,
      'un paso reactivo no debe permitir cualquier cosa: sólo lo que hace falta para avanzar');
    tutEnd();
  }

  /* LA CORTINILLA DEL VS: se monta, dura lo suyo y se limpia sola. Lo que no
     puede pasar es que se quede pegada tapando la mesa. */
  {
    const t0 = Date.now();
    const p = cortinillaVS('fender','adreida');
    await sleep(300);
    const capa = $1('.vs');
    t.check(!!capa, 'la cortinilla del VS no llegó a montarse');
    t.check(!!capa && capa.querySelectorAll('.vscard').length===2,
      'la cortinilla debería enseñar las dos cartas');
    await p;
    const dur = Date.now() - t0;
    t.check(!$1('.vs'), 'la cortinilla se quedó pegada en pantalla');
    t.check(dur > 3000 && dur < 6000, `la cortinilla duró ${dur}ms; se esperaban ~4000`);

    // y NO se monta cuando no la quieren: partidas automáticas y del arnés
    await cortinillaVS('fender','adreida',{silent:true});
    t.check(!$1('.vs'), 'no debería montarse en una partida silenciosa');
    await cortinillaVS('fender','adreida',{sinCortinilla:true});
    t.check(!$1('.vs'), 'no debería montarse si se pide sin ella');
    t.nota('la cortinilla del VS aparece, dura ~4 s y se limpia');
  }

  /* El tutorial no deja hacer nada que no necesite para avanzar. Se recorren
     TODOS sus pasos: ninguno puede abrirse del todo. */
  {
    await startTutorial('talesin');
    await sleep(300);
    const guardado = TUT.i;
    const abiertos = [];
    for (let i=0; i<TUT_STEPS.length; i++){
      TUT.i = i; TUT.pending = null; T.G.active = 0; T.G.over = false;
      const a = tutAllow();
      if (a && a.free) abiertos.push(i + (TUT_STEPS[i].on ? ' (on:'+TUT_STEPS[i].on+')' : ''));
    }
    TUT.i = guardado;
    t.check(!abiertos.length,
      `estos pasos del tutorial permiten cualquier acción: ${abiertos.join(', ')}`);
    t.nota('el tutorial sólo deja hacer lo que necesita para avanzar');
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
    t.nota(`los ${L.length} mazos con 40 cartas; el tutorial y las guías sólo citan cartas que siguen dentro`);
  }

  /* Desde una partida se puede volver al menú. Faltaba: el tablero era un
     callejón sin salida y había que recargar la página. Se comprueba también
     dentro del tutorial, donde el resto de botones está bloqueado a propósito
     — irse siempre tiene que poder hacerse. */
  {
    const boton = () => $$('#controls .btn').find(b => /Menú/.test(b.textContent));
    await T.startMatch('fender','adreida',{volado:false,first:0});
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
    await T.startMatch('fender','adreida',{volado:false,first:0});
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
    // Escenario aislado: esta prueba mide colores, no el inicio de partida.
    // startMatch puede seguir ocupado por la prueba anterior y conservar a
    // Eric, cuya pregunta de sacrificio dejaba esta suite esperando un clic.
    relojPara();T.newGame('fender','adreida');showScreen('board');
    const u = T.mkUnit('discipulo', 0); u.sick=false; T.P(0).field=[u];
    T.recalc(); T.render(); await sleep(200);
    const antes = $1(`#myField .card[data-uid="${u.uid}"]`);
    t.check(antes && !antes.classList.contains('infectado'),
      'una criatura sana no debería salir verde');
    T.infect(u); T.render(); await sleep(200);
    const despues = $1(`#myField .card[data-uid="${u.uid}"]`);
    t.check(despues && despues.classList.contains('infectado'),
      'una criatura Infectada debería ponerse verde');
    // y su daño lleva la clase del verde de infección, no la del rojo.
    // Se comprueba el COMPORTAMIENTO —que el número que sale sea verde— y no
    // la forma de la llamada: antes buscaba la cadena literal
    // `fxHit(u, n, opt.src==='infeccion')` y se puso en rojo al cambiar la
    // firma de fxHit sin que el juego hubiera cambiado en nada.
    $$('#fx .fxnum').forEach(e=>e.remove());
    await T.dmgU(u, 1, {src:'infeccion'}); await sleep(80);
    const numInf = $$('#fx .fxnum').find(e=>e.classList.contains('inf'));
    t.check(!!numInf, 'el daño por infección debería salir con el número verde (.fxnum.inf)');
    $$('#fx .fxnum').forEach(e=>e.remove());
    await T.dmgU(u, 1, {src:'combate'}); await sleep(80);
    const numRojo = $$('#fx .fxnum').find(e=>e.classList.contains('dmg') && !e.classList.contains('inf'));
    t.check(!!numRojo, 'el daño normal debería salir con el número rojo (.fxnum.dmg)');
    const src = await fuente();
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
    await T.startMatch('mohamed','adreida',{volado:false,first:0}); await sleep(600);

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
    await T.startMatch('fender','adreida',{volado:false,first:0}); await sleep(500);
    const suyo = T.mkUnit('horton', 1); suyo.sick = false; T.P(1).field.push(suyo);
    const mio  = T.mkUnit('discipulo', 0); mio.sick = false; T.P(0).field.push(mio);
    T.recalc(); T.render(); await sleep(200);

    const p = fxLunge(suyo, mio);
    await sleep(300);
    const dicho = $$('.fxlabel').map(e=>e.textContent).join(' | ');
    t.check(/Sir Horton/.test(dicho) && /Discípulo/.test(dicho),
      `un ataque del rival debe decir quién ataca a quién — decía: "${dicho}"`);
    await p;
    const golpeAAA=fxHit(mio,1,{combate:true,atacante:suyo.uid});
    await sleep(100);
    const numero=$1('#fx .aaa-dmg');
    t.check(numero && numero.style.top && Number.isFinite(parseFloat(numero.style.top)),
      'el número AAA debe tener una coordenada vertical válida');
    await golpeAAA;
    t.nota('los ataques del rival se anuncian antes de llegar');
  }

  /* El volado: eliges lado, la moneda decide, y quien gana empieza de verdad.
     Se comprueba que lo que dice el cartel y lo que hace el juego coinciden —
     que es lo único que no puede fallar aquí. */
  {
    try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}
    let empezasteTu = 0;
    for (let i = 0; i < 6; i++){
      const gViejo = T.G;                        // para saber cuándo nace la nueva
      // sin la cortinilla del VS: aquí se prueba el volado, y son 4 s por vuelta
      startMatch('fender','adreida',{sinCortinilla:true});   // sin await: espera a que elijas
      /* Hay que esperar a un volado NUEVO, no al que quedó del anterior: al
         terminar, sus botones siguen en el panel deshabilitados hasta que otra
         cosa lo reemplaza. Mirando sólo si existe #ladoCara se leía el cartel de
         la vuelta de antes, y decía lo contrario de lo que hacía la partida. */
      for (let k=0; k<80 && !($1('#ladoCara') && !$1('#ladoCara').disabled); k++) await sleep(50);
      t.check(!!$1('#ladoCara') && !$1('#ladoCara').disabled,
        'debería preguntarte cara o cruz al empezar');
      (i % 2 ? $1('#ladoCruz') : $1('#ladoCara')).click();
      /* El cartel se lee MIENTRAS está en pantalla. Antes se esperaba a que el
         overlay se cerrase y se leía después, pero ese overlay lo comparten
         todas las preguntas del juego: si al empezar el turno salía otra —la de
         mano nueva— el cartel ya había sido reemplazado y se leía vacío. */
      let dijo = '';
      for (let k=0; k<90; k++){
        const n = $1('#voladoTxt');
        if (n && /empiez/i.test(n.textContent)){ dijo = n.textContent; break; }
        await sleep(80);
      }
      /* Y hay que mirar a quién le toca en la partida NUEVA. Mirar la fase no
         vale: hasta que newGame corre, G sigue siendo el de la partida
         anterior, que ya estaba en juego — se leía el turno de la de antes. */
      for (let k=0; k<90 && (T.G===gViejo || T.G.turnNo<1); k++) await sleep(80);
      const empiezoYo = T.G.active === 0;
      if (empiezoYo) empezasteTu++;
      t.check(/empiezas tú/.test(dijo) === empiezoYo,
        `el volado dijo "${dijo}" pero empieza ${empiezoYo?'el jugador':'el rival'}`);
      await sleep(150);
    }
    t.nota(`volado: ganaste ${empezasteTu} de 6 (es una moneda, no tiene que salir 3)`);

    // y se puede saltar, que es lo que usan estas pruebas
    await T.startMatch('fender','adreida',{volado:false,first:0});
    await sleep(400);
    t.check(!$1('#ov').classList.contains('on'),
      'con {volado:false,first:0} no debería preguntar nada');
  }

  /* Las cartas del tablero enseñan el nombre de sus habilidades. */
  {
    await T.startMatch('fender','adreida',{volado:false,first:0}); await sleep(500);
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
    /* La Habilidad de Líder sólo se puede usar en TU turno: si no lo es,
       useLeader devuelve false sin hacer nada y esta prueba acaba midiendo el
       turno del rival en vez de Manos Largas. Antes esto se fiaba de un sleep
       fijo y fallaba una vez de cada dos —al hacerse el tablero más pesado,
       casi siempre—. Ahora se espera al turno de verdad, y los PD se ponen
       DESPUÉS de esa espera: al empezar el turno se recalculan y se llevarían
       por delante cualquier valor puesto antes. */
    const miTurno = async () => {
      for (let i=0; i<80 && T.G.active !== 0; i++) await sleep(100);
      return T.G.active === 0;
    };

    await T.startMatch('mohamed','adreida',{volado:false,first:0}); await sleep(700);

    // caso 1: sale un Objeto → se lo queda
    t.check(await miTurno(), 'debería tocarte a ti para poder usar la Habilidad');
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
    t.check(await miTurno(), 'y volver a tocarte para el segundo caso');
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
    await T.startMatch('mohamed','adreida',{volado:false,first:0}); await sleep(700);
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
    // sin cortinilla: aquí se prueba la moneda, y son 4 s de espera por delante
    startMatch('mohamed','adreida',{sinCortinilla:true});
    for (let i=0; i<80 && !$1('#moneda'); i++) await sleep(50);
    t.check(!!$1('#moneda'), 'el volado debería haber montado su moneda');
    const reposo = $1('#moneda') ? $1('#moneda').textContent : '';
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

  /* El d20 dice qué hace falta y qué efecto ha tenido. Antes enseñaba un número
     suelto y la consecuencia sólo se contaba en el registro lateral. */
  {
    try{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); }catch(e){}
    await T.startMatch('mohamed','adreida',{volado:false,first:0}); await sleep(600);
    const meta = {necesita:'8 o más', min:8, ok:v=>v>=8,
                  siOk:'Se convierte a tu causa', siMal:'La campaña no convence a nadie'};

    rollDice(12, 'Campaña de la Fe', false, meta);
    for (let i=0; i<30 && !$1('.defecto')?.textContent; i++) await sleep(100);
    t.check(/8 o más/.test($1('.dpide')?.textContent || ''),
      'el dado debería decir qué hace falta antes de tirar');
    t.check(/Se convierte/.test($1('.defecto').textContent),
      'con 12 sobre 8+ debería anunciar que sale bien');
    t.check($1('.defecto').className.includes('bien'), 'y marcarlo como acierto');
    for (let i=0; i<40 && $1('#dice').classList.contains('on'); i++) await sleep(100);

    rollDice(3, 'Campaña de la Fe', false, meta);
    for (let i=0; i<30 && !/convence/.test($1('.defecto')?.textContent||''); i++) await sleep(100);
    t.check(/no convence/i.test($1('.defecto').textContent),
      'con 3 sobre 8+ debería anunciar que falla');
    t.check($1('.defecto').className.includes('mal'), 'y marcarlo como fallo');
    for (let i=0; i<40 && $1('#dice').classList.contains('on'); i++) await sleep(100);

    // y ninguna tirada del juego se queda sin explicar
    const src = await fuente();
    const tiradas = (src.match(/await roll\(/g) || []).length;
    const explicadas = (src.match(/necesita:/g) || []).length - 1;   // menos la de metaPlana
    t.check(tiradas === explicadas,
      `hay ${tiradas} tiradas de d20 y sólo ${explicadas} explican su efecto`);
    t.nota(`las ${tiradas} tiradas de d20 dicen qué hace falta y qué pasa`);
  }

  /* El log filtra lo privado: el rival no puede ver qué robas. */
  {
    const src = await fuente();
    t.check(/function log\([^)]*priv/.test(src),
      'log() perdió el parámetro priv y el online volvería a filtrar tus robos');
  }

  /* MANO NUEVA — la regla que rehace una mano muerta en el primer turno.
     Lo que no puede pasar nunca: que se pierdan o aparezcan cartas al
     rebarajar, que se ofrezca cuando sí puedes jugar, o que se pueda repetir. */
  {
    await T.setupMatch('mohamed','adreida',{fast:true, auto:true, silent:true, first:0});
    const p = T.P(0);

    // 1) con una mano impagable la ofrece
    const caras = Object.keys(T.CARDS).filter(id => T.CARDS[id].c >= 4 && !T.CARDS[id].token).slice(0,5);
    p.hand = caras.slice();
    p.manoRehecha = false;
    T.G.turnNo = 1; T.G.active = 0; T.G.phase = 'principal';
    t.check(window.puedeRehacerMano(0), 'con una mano que no puede jugar nada debería ofrecerla');

    // 2) rebarajar no pierde ni inventa cartas
    const total = p.hand.length + p.deck.length;
    const vieja = p.hand.slice();
    await window.ofrecerManoNueva(0);
    t.check(p.hand.length === vieja.length,
      `la mano nueva trae ${p.hand.length} cartas y la vieja tenía ${vieja.length}`);
    t.check(p.hand.length + p.deck.length === total,
      `rebarajar cambió el total de cartas: ${p.hand.length + p.deck.length} en vez de ${total}`);

    // 3) una sola vez
    t.check(p.manoRehecha === true, 'debería quedar marcada como usada');
    p.hand = caras.slice();                       // otra mano muerta
    t.check(!window.puedeRehacerMano(0), 'no puede ofrecerse dos veces en la misma partida');

    // 4) no se ofrece si sí puedes jugar algo
    const otro = T.P(1);
    otro.manoRehecha = false;
    const barato = Object.keys(T.CARDS).find(id => T.CARDS[id].c <= 1 && !T.CARDS[id].token
                                                && T.CARDS[id].t === 'personaje');
    otro.hand = [barato];
    T.G.active = 1; otro.pd = 5;
    t.check(!window.puedeRehacerMano(1), 'no debe ofrecerse teniendo una carta jugable');

    t.nota('mano nueva: sólo con la mano muerta, una vez, y sin perder cartas');
  }

  /* EL CARTEL DE TURNO VA ANTES QUE EL DADO DE GERO.
     El dado es lo primero que PASA en el turno, no el anuncio de que el turno
     empieza. Puesto antes del cartel, el d20 aparecía sobre la pantalla del
     turno anterior y parecía que lo tiraba el rival. */
  {
    const src = await fuente();
    const cuerpo = src.slice(src.indexOf('async function startTurn('));
    const cartel = cuerpo.indexOf('await fxBanner(s)');
    const dado   = cuerpo.indexOf("roll('El dado decide'");
    t.check(cartel > 0 && dado > 0 && cartel < dado,
      `el dado de Gero se tira antes del cartel de turno (cartel en ${cartel}, dado en ${dado})`);
    t.nota('el cartel de «Tu turno» sale antes que el dado de Gero');
  }

  /* LA PASIVA DE GERO NO RUEDA ANTES DE QUE ÉL LA EXPLIQUE.
     Su d20 se tira al inicio de CADA turno, así que en el tutorial lo primero
     que veía el alumno era un dado cayendo del cielo antes de que nadie le
     hubiera dicho qué es un d20, qué es un PD ni qué es el Alma. Una lección se
     enseña y luego se ve. */
  {
    T.startTutorial('gero');
    await sleep(300);
    const k = TUT_STEPS.findIndex(x => x && x.pasiva);
    t.check(k > 0, 'ningún paso del tutorial está marcado como el que explica la pasiva');

    const i0 = TUT.i;
    TUT.i = 0;      const alEmpezar = window.tutPasivaLista();
    TUT.i = k - 1;  const justoAntes = window.tutPasivaLista();
    TUT.i = k;      const alExplicarla = window.tutPasivaLista();
    TUT.i = i0;
    t.check(!alEmpezar,  'el dado rodaría en el paso 1, antes de explicar nada');
    t.check(!justoAntes, `el dado rodaría en el paso ${k}, justo antes de la explicación`);
    t.check(alExplicarla, `el dado sigue sin rodar en el paso ${k+1}, ya explicado`);

    const on0 = TUT.on; TUT.on = false;
    const fuera = window.tutPasivaLista(); TUT.on = on0;
    t.check(fuera, 'fuera del tutorial la pasiva tiene que rodar siempre');

    await T.startTutorial && sleep(0);
    t.nota(`la pasiva de Gero espera al paso ${k+1}: primero se explica, luego se ve`);
  }

  /* LA DIFICULTAD NO PUEDE APAGAR LA FICHA DEL CARRUSEL.
     Gero llegó con dificultad 4 y la ficha se pintaba con '☆'.repeat(3-dif):
     con 4 eso es repeat(-1), que lanza RangeError. Y como la ficha se arma de
     una sola pieza con innerHTML, la excepción se llevaba el panel ENTERO: el
     carrusel enseñaba a Gero y debajo seguía la descripción del Líder anterior.
     Se comprueban las dos mitades del fallo: que ningún dato esté fuera de
     rango, y que el pintor aguante aunque lo estuviera. */
  {
    const fallos = [];
    for (const lid of Object.keys(T.LEADERS)){
      const d = GUIAS[lid] && GUIAS[lid].dif;
      if (!(d >= 1 && d <= 3)) fallos.push(`${lid}: dificultad ${d}, fuera de 1-3`);
      if (!DECKS[lid]) fallos.push(`${lid}: no tiene mazo`);
    }
    t.check(fallos.length===0, fallos.join(' ;; '));

    let revienta = null;
    for (const v of [-1, 0, 1, 2, 3, 4, 99, null, undefined, NaN]){
      try { const r = window.estrellas(v);
            if (typeof r !== 'string' || r.length !== 3) revienta = `estrellas(${v}) = "${r}"`; }
      catch(e){ revienta = `estrellas(${v}) lanzó ${e.name}`; }
    }
    t.check(!revienta, revienta || '');
    t.nota('la ficha del carrusel aguanta cualquier dificultad, y ninguna está fuera de rango');
  }

  /* TERMINAR TURNO CON PD SIN GASTAR — la pregunta de confirmación.
     Lo que importa no es que salga un cartel, sino CUÁNDO sale: tiene que
     avisar cuando los puntos alcanzan para algo, y callarse cuando no, o se
     convierte en un clic de más en cada turno. */
  {
    await T.setupMatch('mohamed','adreida',{fast:true, auto:true, silent:true, first:0});
    const G = T.G, p = T.P(0);
    const preguntando = () => document.querySelector('#prompt').classList.contains('on');
    const limpiar = () => { document.querySelector('#prompt').classList.remove('on');
                            G.active = 0; G.phase = 'principal'; G.over = false; G.busy = false; };

    // 1) con puntos y algo que hacer, pregunta
    limpiar();
    const barato = Object.keys(T.CARDS).find(id => T.CARDS[id].c <= 1 && !T.CARDS[id].token
                                                && T.CARDS[id].t === 'personaje');
    p.hand = [barato]; p.pd = 5; p.field.length = 0;
    window.pedirTerminarTurno();
    t.check(preguntando(), 'con PD de sobra y una carta jugable debería preguntar');
    t.check(G.active === 0, 'preguntar no puede terminar el turno por su cuenta');

    // 2) sin puntos, se calla y termina
    limpiar();
    p.hand = [barato]; p.pd = 0;
    window.pedirTerminarTurno();
    t.check(!preguntando(), 'sin PD no hay nada que avisar: no debe preguntar');

    // 3) con puntos que no alcanzan para nada, se calla
    limpiar();
    const caro = Object.keys(T.CARDS).find(id => T.CARDS[id].c >= 7 && !T.CARDS[id].token);
    p.hand = [caro]; p.pd = 1; p.leaderUsed = true; p.field.length = 0;
    window.pedirTerminarTurno();
    t.check(!preguntando(), 'si los PD no alcanzan para nada, preguntar sólo estorba');

    // 4) en el tutorial nunca pregunta: sus pasos guionan el fin de turno
    limpiar();
    p.hand = [barato]; p.pd = 5; p.leaderUsed = false;
    G.tutorial = {paso:0};
    window.pedirTerminarTurno();
    t.check(!preguntando(), 'el tutorial no puede quedarse esperando una pregunta de más');
    G.tutorial = null;
    document.querySelector('#prompt').classList.remove('on');

    t.nota('terminar turno: avisa si los PD alcanzan para algo, y calla si no');
  }

  /* EL CAJÓN — las cartas nuevas, todavía fuera de los mazos.
     Lo que se comprueba: que se pueden jugar sin reventar, que sus trampas
     usan disparadores que el motor conoce, y que NINGUNA se ha colado en un
     mazo sin querer, que es lo único que las haría entrar en una partida. */
  {
    const cajon = Object.keys(T.CARDS).filter(id => T.CARDS[id].set==='cajon');
    t.check(cajon.length > 0, 'no hay ninguna carta en el Cajón');

    const eventos = ['ataque','ataqueAlma','hechizoOHabilidad','letal',
                     'muerteAliada','muerteAliadaCombate'];
    for (const id of cajon){
      const c = T.CARDS[id];
      t.check(!!c.n && !!c.art && !!c.x, `${id}: le falta nombre, arte o texto`);
      if (c.t==='trampa')
        t.check(eventos.includes(c.on), `${id}: dispara con "${c.on}", que el motor no conoce`);
    }

    const coladas = cajon.filter(id =>
      Object.values(T.DECKS).some(d => d.list.some(([c]) => c===id)));
    t.check(!coladas.length,
      `estas cartas del Cajón están en un mazo y no deberían: ${coladas.join(', ')}`);

    // y se juegan de verdad, con un tablero que les dé objetivos válidos
    const rotas = [];
    for (const id of cajon.filter(x => !T.CARDS[x].token)){
      try{
        await T.setupMatch('mohamed','adreida',{first:0,silent:true,fast:true,auto:true});
        const p=T.P(0), f=T.P(1);
        p.field.push(T.mkUnit('machete',0), T.mkUnit('matildus',0));
        f.field.push(T.mkUnit('minus',1), T.mkUnit('discipulo',1), T.mkUnit('bob',1));
        p.field.forEach(u=>u.sick=false); f.field.forEach(u=>u.sick=false);
        p.field[0].objs.push('jabon');
        T.recalc(); p.pd=10; T.G.active=0; T.G.phase='principal'; T.G.turnNo=3;
        p.hand=[id];
        if(!T.canPlay(0,id)){ rotas.push(id+' (no se puede jugar)'); continue; }
        await T.playFromHand(0,id);
      }catch(e){ rotas.push(id+': '+(e&&e.message||e)); }
    }
    t.check(!rotas.length, `cartas del Cajón que fallan al jugarse: ${rotas.join(' · ')}`);
    t.nota(`el Cajón: ${cajon.length} cartas nuevas, jugables y fuera de los mazos`);
  }

  /* «Debe atacar si puede» (Sir Horton, Rambo, El Correcaminos) estaba escrito
     en las cartas y no lo aplicaba nadie: se podía dejarlos quietos. */
  {
    await T.startMatch('adreida','fender',{volado:false,first:0,fast:true}); await sleep(400);
    // la partida puede seguir en el arranque del turno (cartel, dado): se fuerza el estado
    T.G.active = 0; T.G.phase = 'principal'; T.G.busy = false; T.G.over = false;
    const u = T.mkUnit('horton', 0); u.sick=false; T.P(0).field.push(u); T.recalc(); T.render();
    T.P(0).pd = 0;
    window.pedirTerminarTurno(); await sleep(150);
    t.check(T.G.active===0 && $1('#prompt').classList.contains('on') && /debe atacar/i.test($1('#pmsg').textContent),
      'con Sir Horton listo, terminar el turno debe avisar de que debe atacar, y no terminar');
    window.clearPrompt();
    const almaAntes = T.P(1).alma;
    await T.endTurn(); await sleep(200);
    // no se mira u.attacked: en rápido el rival ya jugó y el turno nuevo lo puso a cero
    t.check(T.G.log.some(l => /ataca solo/.test(l.txt)) && T.P(1).alma < almaAntes,
      `si el turno se cierra de todas formas (el reloj), Sir Horton ataca solo (Alma rival ${almaAntes}→${T.P(1).alma})`);
    t.nota('«debe atacar si puede» frena el fin de turno y, si se cierra igual, ataca solo');
  }

  /* Los Hechizos Rápidos se resolvían fuera de playFromHand y se saltaban la
     Inspiración de Fender: Palabra de Curación es Canción y Rápido a la vez. */
  {
    await T.startMatch('fender','adreida',{volado:false,first:0,fast:true}); await sleep(400);
    T.G.busy = false; T.G.over = false;
    const u = T.mkUnit('discipulo', 0); u.sick=false; T.P(0).field.push(u); T.recalc();
    T.P(0).hand = ['palabracuracion']; T.P(0).pd = 3;
    T.G.active = 1;                              // se responde en el turno del rival
    const antes = u.atk, viejo = window.pickCard, viejoT = window.resolveTargets;
    window.pickCard = async () => 'palabracuracion';
    window.resolveTargets = async () => [[u]];        // sin esto se queda esperando un clic
    try{ await window.fastWindow(0, {kind:'ataque', ev:{}}); }
    finally { window.pickCard = viejo; window.resolveTargets = viejoT; }
    T.recalc();
    t.check(u.atk === antes+1, `Palabra de Curación con Fender debe dar Inspiración: ATQ ${antes}→${u.atk}`);
    t.check(T.P(0).grave.includes('palabracuracion') && !T.P(0).hand.includes('palabracuracion'),
      'el Rápido tiene que acabar en las Alcantarillas y fuera de la mano');
    T.G.active = 0;
    t.nota('los Hechizos Rápidos pasan por los mismos efectos que cualquier Hechizo (Inspiración)');
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

/* EL DIÁLOGO DE MANO NUEVA, RESPONDIDO SOLO.
   Las pruebas que juegan como jugador —pulsando cartas de verdad— se quedaban
   colgadas cuando salía una mano muerta: el juego se para a preguntar y aquí no
   hay nadie que conteste. Sólo pasaba a veces, según el barajado, así que se
   veía como una tanda lenta o un fallo raro en otra prueba.
   Este vigilante contesta que sí, que es lo que haría cualquiera. Vive en el
   arnés a propósito: el juego no debe saber que lo están probando. */
function vigilarManoNueva(){
  const t = setInterval(() => {
    const ov = $1('#ov');
    if(!ov || !ov.classList.contains('on')) return;
    const p = $1('#ovPanel');
    if(!p || !/Devolverlas al mazo/.test(p.textContent)) return;
    const si = [...p.querySelectorAll('.opts button, .opts .btn')]
      .find(b => /mano nueva/i.test(b.textContent));
    if(si) si.click();
  }, 60);
  return () => clearInterval(t);
}

PRUEBAS.correr = async function(filtro){
  const dejarDeVigilar = vigilarManoNueva();
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

  dejarDeVigilar();
  PRUEBAS.resultado = res;
  PRUEBAS.terminado = true;

  // Si esto corre desde publicar.sh, el servidor de pruebas está escuchando en
  // /resultado y es así como el script sabe que hemos terminado. Abriendo la
  // página a mano no hay nadie al otro lado: el fallo se ignora a propósito.
  if(window===window.top)try{ fetch('/resultado', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(res)}).catch(()=>{}); }catch(e){}

  return res;
};

/* Arranque automático cuando se entra por ?test=... */
if(new URLSearchParams(location.search).has('test')){
  window.addEventListener('load', ()=>setTimeout(()=>PRUEBAS.correr(), 300));
}
})();

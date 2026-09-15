/*
 * Motor puro de Caoz: El Asedio de Thal.
 * No toca DOM, almacenamiento ni red. La pantalla sólo pinta el estado que
 * devuelve dispatch() y ofrece las acciones que legalActions() declara.
 */
(function(){
'use strict';

const DATA=globalThis.CAOZ_ASEDIO_DATA;
if(!DATA)throw Error('Carga asedio-datos.js antes de asedio-motor.js.');

const copiar=value=>JSON.parse(JSON.stringify(value));
const lista=value=>Array.isArray(value)?value:[];
const OPERACIONES=new Set(['swapRastro','gainCounter','addPreparation','healHero','summon','addThalStatus','addHeroStatus','summonMinion','gainDominion','gainRage','addThalPlace','aliento','nube','possessLastFallen','infectHero','cleanse','damageTarget','damageTargets','reducePendingAttack']);

function error(codigo,mensaje){return {ok:false,codigo,mensaje};}
function ok(estado,eventos=[]){return {ok:true,estado,eventos};}
function perfil(id,override){
  const original=DATA.profiles[id||DATA.tutorial.profile];
  if(!original)throw Error('Perfil de balance desconocido: '+id+'.');
  const base=copiar(original);
  if(!override)return base;
  if(override.heroes)Object.assign(base.heroes,override.heroes);
  if(override.thal)Object.assign(base.thal,override.thal);
  if(override.fases)base.fases=override.fases.map(copiar);
  if(override.heroStats){
    base.heroStats=base.heroStats||{};
    Object.entries(override.heroStats).forEach(([id,stats])=>{base.heroStats[id]={...(base.heroStats[id]||{}),...copiar(stats)};});
  }
  return base;
}
function carta(id){
  const c=DATA.cards[id];
  if(!c)throw Error('Carta de Modo Domo desconocida: '+id);
  return c;
}
function heroe(id){
  const h=DATA.heroes[id];
  if(!h)throw Error('Protagonista desconocido: '+id);
  return h;
}
function log(estado,tipo,detalle){
  const evento={i:estado.eventLog.length+1,tipo,round:estado.round,phase:estado.thal.phase,...detalle};
  estado.eventLog.push(evento);
  return evento;
}
function crearHeroe(id,p){
  const h=heroe(id);
  const ajuste=p.heroStats?.[id]||{},vida=ajuste.vida??p.heroes.vida??h.vida,asalto=ajuste.asalto??h.asalto;
  return {id,n:h.n,vida,maxVida:vida,caido:false,asalto,impulsos:p.heroes.impulsos,acciones:p.heroes.acciones,asaltoUsado:false,contadores:{apertura:0,ritmo:0,ruptura:0,fe:0,gracia:0},mano:[],mazo:[],descarte:[],estados:[],vanguardia:null,apoyo:[],preparaciones:{}};
}
function crearEstado(opciones={}){
  const tutorial=opciones.tutorial||DATA.tutorial;
  const p=perfil(opciones.profile||tutorial.profile,opciones.balance);
  const tutorialOn=opciones.tutorialOn??(p.id===tutorial.profile);
  const seleccion=tutorialOn?tutorial.heroes:(opciones.heroIds||p.heroIds||tutorial.heroes);
  if(!Array.isArray(seleccion)||seleccion.length!==p.playerCount||seleccion.length<3||seleccion.length>5)throw Error('El perfil '+p.id+' requiere exactamente '+p.playerCount+' protagonistas.');
  if(new Set(seleccion).size!==seleccion.length)throw Error('Un protagonista no puede ocupar dos plazas.');
  seleccion.forEach(heroe);
  const heroes={};
  seleccion.forEach(id=>{heroes[id]=crearHeroe(id,p);});
  const estado={
    version:DATA.version,
    scenarioId:tutorial.id,
    profile:p,
    round:1,
    heroes,
    thal:{vida:p.thal.vida,maxVida:p.thal.vida,phase:1,dominio:p.thal.dominio,comandos:p.thal.comandos,reaccionesUsadas:0,ira:0,deseo:0,mano:[],mazo:[],descarte:[],minions:[],lugares:[],estados:[]},
    rastro:copiar(tutorial.rastro[1]),
    escenario:null,
    configuracionEscenario:{rastro:copiar(tutorial.rastro),scenarios:copiar(tutorial.scenarios||{}),phaseSchedule:copiar(tutorial.phaseSchedule||{})},
    roundPhase:'heroes',
    heroesQuePasaron:[],
    fallen:[],
    pending:null,
    over:false,
    winner:null,
    eventLog:[],
    tutorial:{on:tutorialOn,steps:copiar(tutorial.steps||[]),step:0,checkpoints:[],endedEarly:null}
  };
  if(tutorialOn)Object.entries(tutorial.hands).forEach(([id,cartas])=>{
    if(id==='thal')estado.thal.mano=cartas.slice();
    else if(estado.heroes[id])estado.heroes[id].mano=cartas.slice();
  });
  const cartasEnRastro=new Set(Object.values(tutorial.rastro).flat());
  seleccion.forEach(id=>{
    const mazo=DATA.decks[id]||[];
    if(!tutorialOn)estado.heroes[id].mano=mazo.slice();
    estado.heroes[id].mazo=mazo.filter(c=>!estado.heroes[id].mano.includes(c));
  });
  if(!tutorialOn)estado.thal.mano=(DATA.decks.thal||[]).filter(id=>!cartasEnRastro.has(id));
  estado.thal.mazo=(DATA.decks.thal||[]).filter(c=>!estado.thal.mano.includes(c)&&!cartasEnRastro.has(c));
  log(estado,'partida.creada',{profile:p.id,heroes:seleccion.slice(),rastro:estado.rastro.slice()});
  return estado;
}
function pasoActual(estado){return estado.tutorial.steps[estado.tutorial.step]||null;}
function esMismaEspera(espera,accion){
  if(!espera||espera.type!==accion.type)return false;
  for(const clave of ['actor','card','unit','target','mode','holdForResponse']){
    if(Object.hasOwn(espera,clave)&&espera[clave]!==accion[clave])return false;
  }
  if(espera.spend){
    const recibido=accion.spend||{};
    for(const [k,v] of Object.entries(espera.spend))if(recibido[k]!==v)return false;
  }
  return true;
}
function permitidoPorTutorial(estado,accion){
  if(!estado.tutorial.on)return true;
  const paso=pasoActual(estado);
  if(!paso)return accion.type==='RESTART';
  if(paso.kind==='say')return accion.type==='CONTINUE';
  return esMismaEspera(paso.expect,accion);
}
function avanzarTutorial(estado,accion){
  if(!estado.tutorial.on)return;
  const paso=pasoActual(estado);
  if(!paso)return;
  if((paso.kind==='say'&&accion.type==='CONTINUE')||(paso.kind==='task'&&esMismaEspera(paso.expect,accion))){
    if(paso.checkpoint||paso.kind==='say')estado.tutorial.checkpoints.push(paso.id);
    estado.tutorial.step++;
    const siguiente=pasoActual(estado);
    /* Si una prueba de balance mata a Thal (o agota al equipo) antes de que el
     * guion llegue a su conclusión, no dejamos al tutorial esperando una acción
     * imposible. La última explicación de victoria sí puede mostrarse. */
    if(estado.over&&siguiente&&siguiente.kind!=='say'){
      estado.tutorial.endedEarly={winner:estado.winner,after:paso.id};
      estado.tutorial.step=estado.tutorial.steps.length;
      log(estado,'tutorial.termina_temprano',{winner:estado.winner,after:paso.id});
    }
    log(estado,'tutorial.avanza',{paso:paso.id,siguiente:pasoActual(estado)?.id||null});
  }
}
function tieneEstado(coleccion,estado){return coleccion.includes(estado);}
function sumarEstado(coleccion,estado){if(!tieneEstado(coleccion,estado))coleccion.push(estado);}
function quitarEstado(coleccion,estado){const i=coleccion.indexOf(estado);if(i>=0)coleccion.splice(i,1);}
function obtenerUnidad(estado,id){
  for(const h of Object.values(estado.heroes)){
    if(h.vanguardia?.id===id)return {unidad:h.vanguardia,area:'vanguardia',hero:h};
    const apoyo=h.apoyo.find(u=>u.id===id);if(apoyo)return {unidad:apoyo,area:'apoyo',hero:h};
  }
  const minion=estado.thal.minions.find(u=>u.id===id);if(minion)return {unidad:minion,area:'minion',hero:null};
  return null;
}
function retirarUnidad(estado,referencia){
  if(referencia.area==='vanguardia')referencia.hero.vanguardia=null;
  else if(referencia.area==='apoyo')referencia.hero.apoyo=referencia.hero.apoyo.filter(u=>u.id!==referencia.unidad.id);
  else estado.thal.minions=estado.thal.minions.filter(u=>u.id!==referencia.unidad.id);
}
function caerUnidad(estado,referencia,causa){
  const u=referencia.unidad;
  retirarUnidad(estado,referencia);
  if(referencia.area!=='minion'){
    estado.fallen.push({id:u.id,n:u.n,owner:u.owner,cardId:u.cardId||u.id});
    estado.heroes[u.owner].descarte.push(u.cardId||u.id);
    const dueño=estado.heroes[u.owner];
    if(dueño.preparaciones.puntosrobados&&!dueño.preparaciones.puntosrobados.activado){
      dueño.preparaciones.puntosrobados.activado=true;
      dueño.contadores.gracia++;
      log(estado,'contador.gana',{hero:u.owner,counter:'gracia',amount:1,reason:'puntosrobados'});
    }
    if(u.onFall)aplicarOperacion(estado,u.owner,u.onFall,{});
  }else estado.thal.descarte.push(u.cardId||u.id);
  log(estado,'unidad.cae',{unit:u.id,owner:u.owner||'thal',causa});
}
function prevenirDaño(estado,heroId,amount,causa){
  const preparacion=estado.heroes[heroId]?.preparaciones.armadura;
  if(!preparacion?.charges)return amount;
  const prevenido=Math.min(amount,preparacion.charges);
  preparacion.charges-=prevenido;
  if(preparacion.charges===0)delete estado.heroes[heroId].preparaciones.armadura;
  log(estado,'daño.previene',{hero:heroId,amount:prevenido,causa,key:'armadura'});
  return amount-prevenido;
}
function danarUnidad(estado,id,amount,causa){
  const referencia=obtenerUnidad(estado,id);
  if(!referencia)return false;
  if(referencia.hero)amount=prevenirDaño(estado,referencia.hero.id,amount,causa);
  if(amount===0)return true;
  referencia.unidad.damage=(referencia.unidad.damage||0)+amount;
  log(estado,'daño.unidad',{unit:id,amount,causa,remaining:referencia.unidad.hp-referencia.unidad.damage});
  if(referencia.unidad.damage>=referencia.unidad.hp)caerUnidad(estado,referencia,causa);
  return true;
}
function sanarHeroe(estado,id,amount){
  const h=estado.heroes[id];
  if(!h||h.caido)return;
  h.vida=Math.min(h.maxVida,h.vida+amount);
  log(estado,'hero.cura',{hero:id,amount});
}
function danarHeroe(estado,id,amount,causa){
  const h=estado.heroes[id];
  if(!h)return;
  if(h.caido)return;
  amount=prevenirDaño(estado,id,amount,causa);
  if(amount===0)return;
  h.vida=Math.max(0,h.vida-amount);
  log(estado,'daño.hero',{hero:id,amount,causa,remaining:h.vida});
  if(h.vida===0){
    h.caido=true;h.acciones=0;h.asaltoUsado=true;
    log(estado,'hero.cae',{hero:id,causa});
  }
}
function agregarPreparacion(estado,actor,op){
  estado.heroes[actor].preparaciones[op.key]={key:op.key,charges:op.charges||0,activado:false};
  log(estado,'preparación.entra',{hero:actor,key:op.key});
}
function aplicarOperacion(estado,actor,op,ctx){
  switch(op.op){
    case 'swapRastro':{
      const a=estado.rastro[op.a],b=estado.rastro[op.b];estado.rastro[op.a]=b;estado.rastro[op.b]=a;
      log(estado,'rastro.intercambia',{a:op.a,b:op.b});break;
    }
    case 'gainCounter':{
      const h=estado.heroes[actor];h.contadores[op.counter]=(h.contadores[op.counter]||0)+op.amount;
      log(estado,'contador.gana',{hero:actor,counter:op.counter,amount:op.amount});break;
    }
    case 'addPreparation':agregarPreparacion(estado,actor,op);break;
    case 'healHero':sanarHeroe(estado,actor,op.amount);break;
    case 'summon':{
      const h=estado.heroes[actor],u={...copiar(op.unit),cardId:ctx.card?.id||op.unit.id,owner:actor,damage:0,estados:[]};
      if(op.slot==='vanguardia'){
        if(h.vanguardia)throw Error(h.n+' ya tiene una Vanguardia.');
        h.vanguardia=u;
      }else{
        const maxApoyos=estado.profile.heroes.apoyos??3;
        if(h.apoyo.length>=maxApoyos)throw Error(h.n+' ya alcanzó su límite de Apoyos.');
        h.apoyo.push(u);
      }
      log(estado,'aliado.entra',{hero:actor,unit:u.id,slot:op.slot});break;
    }
    case 'addThalStatus':sumarEstado(estado.thal.estados,op.status);log(estado,'thal.estado',{status:op.status});break;
    case 'addHeroStatus':sumarEstado(estado.heroes[actor].estados,op.status);log(estado,'hero.estado',{hero:actor,status:op.status});break;
    case 'summonMinion':{
      if(estado.thal.minions.length>=estado.profile.thal.esbirros)throw Error('Thal ya alcanzó su límite de Esbirros.');
      const u={...copiar(op.unit),cardId:ctx.card?.id||op.unit.id,owner:'thal',damage:0,estados:[]};estado.thal.minions.push(u);
      log(estado,'esbirro.entra',{unit:u.id});break;
    }
    case 'gainDominion':estado.thal.dominio+=op.amount;log(estado,'dominio.gana',{amount:op.amount});break;
    case 'gainRage':estado.thal.ira+=op.amount;log(estado,'ira.gana',{amount:op.amount});break;
    case 'addThalPlace':estado.thal.lugares.push(op.key);log(estado,'lugar.entra',{key:op.key});break;
    case 'aliento':resolverAliento(estado);break;
    case 'nube':resolverNube(estado);break;
    case 'possessLastFallen':poseerUltimoCaido(estado);break;
    case 'infectHero':if(ctx.target){sumarEstado(estado.heroes[ctx.target].estados,'infectado');log(estado,'hero.estado',{hero:ctx.target,status:'infectado'});}break;
    case 'cleanse':limpiarObjetivo(estado,ctx.target);break;
    case 'damageTarget':dañarObjetivo(estado,ctx.target,op.amount,ctx.card?.id||'efecto');break;
    case 'damageTargets':dañarObjetivos(estado,ctx.targets,op.amount,op.split,ctx.card?.id||'efecto');break;
    case 'reducePendingAttack':reducirAsaltoPendiente(estado,op.amount,ctx.card?.id||'efecto');break;
    default:throw Error('Operación de Modo Domo desconocida: '+op.op);
  }
}
function dañarObjetivo(estado,target,amount,causa){
  if(!target)throw Error('El efecto necesita un objetivo.');
  if(estado.heroes[target]){danarHeroe(estado,target,amount,causa);return;}
  if(danarUnidad(estado,target,amount,causa))return;
  throw Error('El objetivo '+target+' ya no está en mesa.');
}
function dañarObjetivos(estado,targets,amount,split,causa){
  const listaObjetivos=lista(targets);
  if(!listaObjetivos.length)throw Error('El efecto necesita al menos un objetivo.');
  if(!split){listaObjetivos.forEach(target=>dañarObjetivo(estado,target,amount,causa));return;}
  const total=listaObjetivos.reduce((s,entry)=>s+(entry.amount||0),0);
  if(total!==amount)throw Error('El reparto debe sumar exactamente '+amount+' daño.');
  listaObjetivos.forEach(entry=>dañarObjetivo(estado,entry.id,entry.amount,causa));
}
function reducirAsaltoPendiente(estado,amount,causa){
  if(estado.pending?.kind!=='reaccion')throw Error('No hay un Asalto esperando una Reacción.');
  const antes=estado.pending.attack.daño;
  estado.pending.attack.daño=Math.max(0,antes-amount);
  log(estado,'asalto.reduce',{amount:Math.min(antes,amount),causa});
}
function resolverAliento(estado){
  Object.values(estado.heroes).forEach(h=>{
    if(h.vanguardia)danarUnidad(estado,h.vanguardia.id,2,'aliento');
    else danarHeroe(estado,h.id,1,'aliento');
  });
}
function resolverNube(estado){
  let cayo=false;
  Object.values(estado.heroes).forEach(h=>{if(h.vanguardia){const antes=h.vanguardia.id;danarUnidad(estado,antes,1,'nube');if(!obtenerUnidad(estado,antes))cayo=true;}});
  if(cayo){estado.thal.ira++;log(estado,'ira.gana',{amount:1,reason:'vanguardia cae'});}
}
function poseerUltimoCaido(estado){
  const caido=estado.fallen.at(-1);
  if(!caido)throw Error('No hay aliado caído para Poseer.');
  if(estado.thal.minions.length>=estado.profile.thal.esbirros)throw Error('No queda espacio de Esbirro para Poseer.');
  const u={id:caido.id+'_poseido',cardId:caido.cardId,n:caido.n+' Poseído',owner:'thal',originalOwner:caido.owner,attack:2,hp:2,damage:0,guard:false,possessed:true,exhausted:true,estados:['poseido']};
  estado.thal.minions.push(u);estado.thal.deseo++;
  log(estado,'unidad.poseida',{unit:u.id,original:caido.id,desire:estado.thal.deseo});
}
function limpiarObjetivo(estado,target){
  const ref=obtenerUnidad(estado,target);
  if(ref?.unidad.possessed){retirarUnidad(estado,ref);estado.thal.descarte.push(ref.unidad.cardId);log(estado,'poseido.disipado',{unit:target});return;}
  if(ref?.unidad.guard){ref.unidad.guard=false;log(estado,'guardia.disipada',{unit:target});return;}
  if(estado.heroes[target]){
    const h=estado.heroes[target];
    if(h.preparaciones.armadura){delete h.preparaciones.armadura;log(estado,'armadura.disipada',{hero:target});return;}
    if(tieneEstado(h.estados,'infectado')){quitarEstado(h.estados,'infectado');log(estado,'infectado.disipado',{hero:target});return;}
  }
  throw Error('El objetivo no tiene un estado que Disipar.');
}
function pagar(estado,actor,coste){
  if(actor==='thal'){
    if((coste.dominio||0)>estado.thal.dominio)throw Error('Thal no tiene Dominio suficiente.');
    if((coste.comando||0)>estado.thal.comandos)throw Error('Thal no tiene Órdenes suficientes.');
    estado.thal.dominio-=coste.dominio||0;estado.thal.comandos-=coste.comando||0;return;
  }
  const h=estado.heroes[actor];
  if((coste.impulso||0)>h.impulsos)throw Error(h.n+' no tiene Impulsos suficientes.');
  if((coste.accion||0)>h.acciones)throw Error(h.n+' no tiene Acciones suficientes.');
  h.impulsos-=coste.impulso||0;h.acciones-=coste.accion||0;
}
function jugarCarta(estado,accion){
  const actor=accion.actor,c=carta(accion.card),esThal=actor==='thal';
  if(!esThal&&estado.heroes[actor]?.caido)throw Error(estado.heroes[actor].n+' está Caído y no puede jugar cartas.');
  if(c.owner!==actor)throw Error('Esa carta no pertenece a '+actor+'.');
  const zona=esThal?estado.thal.mano:estado.heroes[actor].mano;
  if(!zona.includes(c.id))throw Error('La carta no está en la mano de '+actor+'.');
  pagar(estado,actor,c.cost||{});
  zona.splice(zona.indexOf(c.id),1);
  const persistente=['aliado','equipo','preparacion','esbirro','lugar'].includes(c.tipo);
  if(!persistente)(esThal?estado.thal.descarte:estado.heroes[actor].descarte).push(c.id);
  lista(c.effects).forEach(op=>aplicarOperacion(estado,actor,op,{card:c,target:accion.target,targets:accion.targets}));
  log(estado,'carta.jugada',{actor,card:c.id,target:accion.target||null});
}
function gastarContadores(estado,actor,gastos){
  const h=estado.heroes[actor];
  for(const [contador,cantidad] of Object.entries(gastos||{})){
    if(!Number.isSafeInteger(cantidad)||cantidad<0||h.contadores[contador]===undefined||h.contadores[contador]<cantidad)throw Error('No puedes gastar '+cantidad+' de '+contador+'.');
    if((contador==='apertura'||contador==='gracia')&&cantidad>1)throw Error('Sólo puedes gastar 1 de '+contador+' por Asalto.');
  }
  for(const [contador,cantidad] of Object.entries(gastos||{})){h.contadores[contador]-=cantidad;log(estado,'contador.gasta',{hero:actor,counter:contador,amount:cantidad});}
}
function calcularAsalto(estado,accion){
  const actor=accion.actor,h=estado.heroes[actor],base=h.asalto;
  let daño=base,ignoraGuardia=false;
  const gasto=accion.spend||{};
  gastarContadores(estado,actor,gasto);
  if(actor==='mohamed'&&gasto.apertura){daño+=2*gasto.apertura;if(accion.mode==='ignore_guard')ignoraGuardia=true;}
  if(actor==='fender'&&gasto.ritmo)daño+=gasto.ritmo;
  if(actor==='rafaela'&&gasto.fe)daño+=gasto.fe;
  if(actor==='talesyn'&&gasto.gracia)daño+=gasto.gracia;
  if(h.preparaciones.machete?.charges&&accion.perforar){h.preparaciones.machete.charges--;ignoraGuardia=true;log(estado,'equipo.gasta',{hero:actor,key:'machete'});}
  if(tieneEstado(h.estados,'golpe_sangre_fria')){daño+=2;quitarEstado(h.estados,'golpe_sangre_fria');}
  if(tieneEstado(h.estados,'infectado')){daño=Math.max(0,daño-1);quitarEstado(h.estados,'infectado');}
  if(tieneEstado(h.estados,'rulchete')){ignoraGuardia=true;quitarEstado(h.estados,'rulchete');}
  return {daño,ignoraGuardia};
}
function aplicarDañoThal(estado,ataque){
  let daño=ataque.daño;
  if(tieneEstado(estado.thal.estados,'expuesto')){daño++;quitarEstado(estado.thal.estados,'expuesto');log(estado,'thal.estado.retirado',{status:'expuesto'});}
  estado.thal.vida=Math.max(0,estado.thal.vida-daño);
  log(estado,'daño.thal',{actor:ataque.actor,amount:daño,base:ataque.daño,remaining:estado.thal.vida});
  comprobarVictoria(estado);
}
function resolverAsalto(estado,ataque){
  const guardia=estado.thal.minions.find(u=>u.guard);
  if(guardia&&!ataque.ignoraGuardia){estado.pending={kind:'guardia',attack:ataque,choices:estado.thal.minions.filter(u=>u.guard).map(u=>u.id)};log(estado,'ventana.guardia',{actor:ataque.actor,damage:ataque.daño});return;}
  aplicarDañoThal(estado,ataque);
}
function pasarReaccion(estado){
  if(estado.pending?.kind!=='reaccion')throw Error('No hay una ventana de Reacción que pasar.');
  const ataque=estado.pending.attack;estado.pending=null;
  log(estado,'reaccion.pasa',{actor:ataque.actor});resolverAsalto(estado,ataque);
}
function omitirGuardia(estado){
  if(estado.pending?.kind!=='guardia')throw Error('No hay una Guardia que omitir.');
  const ataque=estado.pending.attack;estado.pending=null;
  log(estado,'guardia.omite',{actor:ataque.actor});aplicarDañoThal(estado,ataque);
}
function declararAsalto(estado,accion){
  const h=estado.heroes[accion.actor];
  if(!h)throw Error('Sólo un protagonista puede declarar Asalto.');
  if(h.caido)throw Error(h.n+' está Caído y no puede Asaltar.');
  if(h.acciones<1)throw Error(h.n+' no tiene Acción para Asaltar.');
  if(h.asaltoUsado)throw Error(h.n+' ya Asaltó esta ronda.');
  const calculo=calcularAsalto(estado,accion);
  h.acciones--;h.asaltoUsado=true;
  const ataque={actor:accion.actor,daño:calculo.daño,ignoraGuardia:calculo.ignoraGuardia};
  log(estado,'asalto.declarado',{actor:accion.actor,amount:ataque.daño,ignoreGuard:ataque.ignoraGuardia});
  if(accion.holdForResponse){estado.pending={kind:'reaccion',attack:ataque};log(estado,'ventana.reaccion',{actor:accion.actor});return;}
  resolverAsalto(estado,ataque);
}
function reflejo(estado){
  if(estado.pending?.kind!=='reaccion')throw Error('No hay un Asalto esperando Reflejo.');
  if(estado.thal.reaccionesUsadas>=estado.profile.thal.reacciones)throw Error('Thal ya usó su Reacción de esta ronda.');
  if(estado.thal.dominio<1)throw Error('Thal no tiene Dominio para Reflejo.');
  estado.thal.dominio--;estado.thal.reaccionesUsadas++;
  const ataque=estado.pending.attack;ataque.daño=Math.max(0,ataque.daño-1);estado.pending=null;
  log(estado,'reaccion.reflejo',{actor:ataque.actor,amount:1});resolverAsalto(estado,ataque);
}
function interceptar(estado,accion){
  if(estado.pending?.kind!=='guardia')throw Error('No hay un Asalto esperando Guardia.');
  const ref=obtenerUnidad(estado,accion.unit);
  if(!ref||ref.area!=='minion'||!ref.unidad.guard)throw Error('Ese Esbirro no puede interceptar.');
  const ataque=estado.pending.attack;estado.pending=null;
  danarUnidad(estado,ref.unidad.id,ataque.daño,'guardia');
  log(estado,'guardia.intercepta',{unit:accion.unit,actor:ataque.actor,amount:ataque.daño});
}
function resolverRastro(estado,accion){
  const id=estado.rastro[0];
  if(!id)throw Error('No hay carta en RESUELVE.');
  if(accion.card!==id)throw Error('La carta en RESUELVE es '+id+'.');
  const c=carta(id);
  lista(c.effects).forEach(op=>aplicarOperacion(estado,'thal',op,{card:c,target:accion.target,targets:accion.targets}));
  Object.entries(c.resolveGains||{}).forEach(([recurso,amount])=>{
    if(recurso==='ira'){estado.thal.ira+=amount;log(estado,'ira.gana',{amount,reason:c.id});}
    else if(recurso==='deseo'){estado.thal.deseo+=amount;log(estado,'deseo.gana',{amount,reason:c.id});}
    else if(recurso==='dominio'){estado.thal.dominio+=amount;log(estado,'dominio.gana',{amount,reason:c.id});}
    else throw Error('Recurso de resolución desconocido: '+recurso+'.');
  });
  estado.thal.descarte.push(id);
  estado.rastro.shift();
  log(estado,'rastro.resuelve',{card:id});
  comprobarVictoria(estado);
}
function jugarReaccion(estado,accion){
  const c=carta(accion.card);
  if(c.owner!=='thal'||c.tipo!=='reaccion')throw Error('Esa no es una Reacción de Thal.');
  if(!estado.thal.mano.includes(c.id))throw Error('La Reacción no está en la mano de Thal.');
  if(estado.thal.reaccionesUsadas>=estado.profile.thal.reacciones)throw Error('Thal ya usó su Reacción de esta ronda.');
  if(c.id==='esporas'&&!estado.fallen.length)throw Error('Esporas necesita un aliado caído.');
  pagar(estado,'thal',c.cost||{});estado.thal.reaccionesUsadas++;
  estado.thal.mano.splice(estado.thal.mano.indexOf(c.id),1);estado.thal.descarte.push(c.id);
  lista(c.effects).forEach(op=>aplicarOperacion(estado,'thal',op,{card:c,target:accion.target,targets:accion.targets}));
  log(estado,'reaccion.jugada',{card:c.id,target:accion.target||null});
}
function siguienteFase(estado){
  const actual=estado.thal.phase,limite=estado.profile.fases[actual-1]?.minVida;
  /* El tutorial enseña fases concretas. La partida libre usa exclusivamente
   * los umbrales del perfil; el guion puede conservar su demostración aunque
   * el laboratorio suba la Vida de Thal para medir si deja de ser letal. */
  const guiada=estado.tutorial.on&&estado.configuracionEscenario.phaseSchedule?.[estado.round];
  const siguiente=guiada||((actual<3&&estado.thal.vida<limite)?actual+1:null);
  if(siguiente&&siguiente>actual){
    estado.thal.phase=siguiente;
    estado.rastro=copiar(estado.configuracionEscenario.rastro[estado.thal.phase]||[]);
    estado.escenario=estado.configuracionEscenario.scenarios[estado.thal.phase]||null;
    log(estado,'fase.cambia',{phase:estado.thal.phase,scenario:estado.escenario});
  }
}
function heroesActivos(estado){return Object.values(estado.heroes).filter(h=>!h.caido);}
function todosHeroesPasaron(estado){
  const activos=heroesActivos(estado);
  return activos.length>0&&activos.every(h=>estado.heroesQuePasaron.includes(h.id));
}
function pasarHeroe(estado,accion){
  const h=estado.heroes[accion.actor];
  if(!h||h.caido)throw Error('Sólo un protagonista activo puede pasar.');
  if(estado.roundPhase!=='heroes')throw Error('La ventana de protagonistas ya terminó.');
  if(estado.heroesQuePasaron.includes(h.id))throw Error(h.n+' ya pasó esta ronda.');
  estado.heroesQuePasaron.push(h.id);
  log(estado,'hero.pasa',{hero:h.id});
  if(todosHeroesPasaron(estado)){
    estado.roundPhase='thal';
    log(estado,'fase.ronda',{phase:'thal'});
  }
}
function refrescarRonda(estado){
  estado.round++;
  Object.values(estado.heroes).forEach(h=>{
    if(h.caido)return;
    h.impulsos=estado.profile.heroes.impulsos;h.acciones=estado.profile.heroes.acciones;h.asaltoUsado=false;
    if(h.preparaciones.puntosrobados)h.preparaciones.puntosrobados.activado=false;
  });
  estado.roundPhase='heroes';estado.heroesQuePasaron=[];
  estado.thal.dominio=estado.profile.thal.dominio;estado.thal.comandos=estado.profile.thal.comandos;estado.thal.reaccionesUsadas=0;
  log(estado,'ronda.inicia',{round:estado.round});
}
function cerrarRonda(estado){
  if(estado.pending)throw Error('Resuelve primero la ventana pendiente.');
  if(!estado.tutorial.on&&estado.roundPhase!=='thal')throw Error('Thal sólo puede cerrar cuando todos los protagonistas activos pasaron.');
  siguienteFase(estado);refrescarRonda(estado);comprobarVictoria(estado);log(estado,'ronda.cierra',{round:estado.round-1});
}
function comprobarVictoria(estado){
  if(estado.over)return;
  if(estado.thal.vida<=0){estado.over=true;estado.winner='heroes';log(estado,'partida.termina',{winner:'heroes',why:'thal_0'});}
  else if(!heroesActivos(estado).length){estado.over=true;estado.winner='thal';log(estado,'partida.termina',{winner:'thal',why:'equipo_caido'});}
  else if(estado.thal.ira>=estado.profile.thal.iraMax){estado.over=true;estado.winner='thal';log(estado,'partida.termina',{winner:'thal',why:'ira'});}
  else if(estado.thal.deseo>=estado.profile.thal.deseoMax){estado.over=true;estado.winner='thal';log(estado,'partida.termina',{winner:'thal',why:'deseo'});}
}
function puedePagar(estado,actor,coste={}){
  if(actor==='thal')return (coste.dominio||0)<=estado.thal.dominio&&(coste.comando||0)<=estado.thal.comandos;
  const h=estado.heroes[actor];
  return !!h&&!h.caido&&(coste.impulso||0)<=h.impulsos&&(coste.accion||0)<=h.acciones;
}
function puedeJugarCarta(estado,actor,id){
  const c=carta(id);
  if(!puedePagar(estado,actor,c.cost||{}))return false;
  return !lista(c.effects).some(op=>op.op==='summonMinion'&&estado.thal.minions.length>=estado.profile.thal.esbirros);
}
function legalActions(estado,actor=null){
  const step=pasoActual(estado);
  if(estado.tutorial.on){
    if(!step)return [];
    return [step.kind==='say'?{type:'CONTINUE'}:copiar(step.expect)];
  }
  if(estado.over)return [];
  if(estado.pending?.kind==='reaccion'){
    const acciones=[{type:'PASS_REACTION',actor:'thal'}];
    if(estado.thal.dominio>0&&estado.thal.reaccionesUsadas<estado.profile.thal.reacciones)acciones.unshift({type:'REFLECTION',actor:'thal'});
    estado.thal.mano.filter(id=>carta(id).tipo==='reaccion').forEach(card=>acciones.push({type:'PLAY_REACTION',actor:'thal',card,requiresTarget:lista(carta(card).effects).some(op=>['infectHero','cleanse','damageTarget','damageTargets'].includes(op.op))}));
    return actor&&actor!=='thal'?[]:acciones;
  }
  if(estado.pending?.kind==='guardia'){
    const acciones=[{type:'SKIP_GUARD',actor:'thal'},...estado.pending.choices.map(unit=>({type:'INTERCEPT',actor:'thal',unit}))];
    return actor&&actor!=='thal'?[]:acciones;
  }
  if(actor==='thal'){
    if(estado.roundPhase!=='thal')return [];
    const acciones=[];
    estado.thal.mano.filter(id=>carta(id).tipo!=='reaccion'&&puedeJugarCarta(estado,'thal',id)).forEach(card=>acciones.push({type:'PLAY_CARD',actor:'thal',card,requiresTarget:lista(carta(card).effects).some(op=>['infectHero','cleanse','damageTarget','damageTargets'].includes(op.op))}));
    if(estado.rastro[0])acciones.push({type:'RESOLVE_RASTRO',actor:'thal',card:estado.rastro[0],requiresTarget:lista(carta(estado.rastro[0]).effects).some(op=>['infectHero','cleanse','damageTarget','damageTargets'].includes(op.op))});
    acciones.push({type:'CLOSE_ROUND',actor:'thal'});
    return acciones;
  }
  if(!actor||!estado.heroes[actor])return [];
  const h=estado.heroes[actor];
  if(estado.roundPhase!=='heroes'||h.caido||estado.heroesQuePasaron.includes(actor))return [];
  const acciones=h.mano.filter(card=>puedeJugarCarta(estado,actor,card)).map(card=>({type:'PLAY_CARD',actor,card,requiresTarget:lista(carta(card).effects).some(op=>['cleanse','damageTarget','damageTargets'].includes(op.op))}));
  if(h.acciones>0&&!h.asaltoUsado)acciones.push({type:'DECLARE_ASSAULT',actor});
  acciones.push({type:'PASS_HERO',actor});
  return acciones;
}
function validarVentana(estado,accion){
  if(!estado.pending)return;
  const permitidas=estado.pending.kind==='reaccion'?new Set(['REFLECTION','PLAY_REACTION','PASS_REACTION']):new Set(['INTERCEPT','SKIP_GUARD']);
  if(!permitidas.has(accion.type))throw Error('Hay una ventana de '+estado.pending.kind+' que debe resolverse primero.');
}
function validarActor(estado,accion){
  const esTutorial=estado.tutorial.on;
  const thal=new Set(['REFLECTION','PLAY_REACTION','PASS_REACTION','INTERCEPT','SKIP_GUARD','RESOLVE_RASTRO','CLOSE_ROUND']);
  if(accion.type==='CONTINUE'){
    if(!esTutorial)throw Error('Continuar sólo existe dentro de un tutorial.');
    return;
  }
  if(thal.has(accion.type)){
    if(accion.actor!=='thal')throw Error('Sólo el jugador Thal puede ejecutar '+accion.type+'.');
    if(!esTutorial&&['REFLECTION','PLAY_REACTION','PASS_REACTION','INTERCEPT','SKIP_GUARD'].includes(accion.type)===false&&estado.roundPhase!=='thal')throw Error('Thal sólo puede actuar en su ventana de ronda.');
    return;
  }
  if(accion.type==='PASS_HERO'){
    if(!estado.heroes[accion.actor])throw Error('Sólo un protagonista puede pasar.');
    return;
  }
  if(accion.type==='PLAY_CARD'){
    if(accion.actor==='thal'){
      if(!esTutorial&&estado.roundPhase!=='thal')throw Error('Thal aún no tiene prioridad.');
      return;
    }
    if(!estado.heroes[accion.actor])throw Error('La carta necesita un protagonista válido.');
    if(!esTutorial&&(estado.roundPhase!=='heroes'||estado.heroesQuePasaron.includes(accion.actor)))throw Error('Ese protagonista ya no tiene prioridad.');
    return;
  }
  if(accion.type==='DECLARE_ASSAULT'){
    if(!estado.heroes[accion.actor])throw Error('Sólo un protagonista puede declarar Asalto.');
    if(!esTutorial&&(estado.roundPhase!=='heroes'||estado.heroesQuePasaron.includes(accion.actor)))throw Error('Ese protagonista ya no tiene prioridad.');
  }
}
function dispatch(anterior,accion){
  let estado;
  try{estado=copiar(anterior);}catch(e){return error('estado-invalido','No se pudo copiar el estado.');}
  if(!accion||typeof accion.type!=='string')return error('accion-invalida','La acción necesita un tipo.');
  if(!permitidoPorTutorial(estado,accion)){
    const paso=pasoActual(estado);return error('tutorial-bloqueado',paso?'El tutorial pide: '+paso.title+'.':'El tutorial ya terminó.');
  }
  if(estado.over&&accion.type!=='CONTINUE')return error('partida-terminada','La partida ya terminó.');
  try{
    validarActor(estado,accion);
    validarVentana(estado,accion);
    switch(accion.type){
      case 'CONTINUE':break;
      case 'PLAY_CARD':jugarCarta(estado,accion);break;
      case 'DECLARE_ASSAULT':declararAsalto(estado,accion);break;
      case 'REFLECTION':reflejo(estado);break;
      case 'PASS_REACTION':pasarReaccion(estado);break;
      case 'INTERCEPT':interceptar(estado,accion);break;
      case 'SKIP_GUARD':omitirGuardia(estado);break;
      case 'RESOLVE_RASTRO':resolverRastro(estado,accion);break;
      case 'PLAY_REACTION':jugarReaccion(estado,accion);break;
      case 'CLOSE_ROUND':cerrarRonda(estado);break;
      case 'PASS_HERO':pasarHeroe(estado,accion);break;
      default:return error('accion-desconocida','El motor no reconoce '+accion.type+'.');
    }
    comprobarVictoria(estado);
    avanzarTutorial(estado,accion);
    return ok(estado,estado.eventLog.slice(anterior.eventLog.length));
  }catch(e){return error('regla-invalida',e instanceof Error?e.message:String(e));}
}
function validateContent(){
  const errores=[];
  for(const [id,c] of Object.entries(DATA.cards)){
    if(c.id!==id)errores.push('La clave y el id difieren en '+id+'.');
    if(!c.n||!c.tipo)errores.push('Falta nombre o tipo en '+id+'.');
    for(const [clave,n] of Object.entries(c.cost||{}))if(typeof n!=='number'||n<0)errores.push('Coste inválido '+clave+' en '+id+'.');
    lista(c.effects).forEach(op=>{
      if(!op.op)errores.push('Efecto sin operación en '+id+'.');
      else if(!OPERACIONES.has(op.op))errores.push('Operación desconocida '+op.op+' en '+id+'.');
    });
  }
  Object.entries(DATA.decks||{}).forEach(([owner,mazo])=>lista(mazo).forEach(id=>{
    if(!DATA.cards[id])errores.push('El mazo de '+owner+' contiene '+id+' inexistente.');
    else if(DATA.cards[id].owner!==owner)errores.push(id+' no pertenece al mazo de '+owner+'.');
  }));
  Object.values(DATA.profiles||{}).forEach(p=>{
    if(!Number.isInteger(p.playerCount)||p.playerCount<3||p.playerCount>5)errores.push('El perfil '+p.id+' debe declarar entre 3 y 5 protagonistas.');
    if(!Array.isArray(p.heroIds)||p.heroIds.length!==p.playerCount)errores.push('El perfil '+p.id+' no tiene el equipo inicial correcto.');
    else if(new Set(p.heroIds).size!==p.heroIds.length||p.heroIds.some(id=>!DATA.heroes[id]))errores.push('El perfil '+p.id+' cita protagonistas inválidos o repetidos.');
  });
  const assaults=new Set(DATA.tutorial.steps.filter(s=>s.expect?.type==='DECLARE_ASSAULT').map(s=>s.expect.actor));
  DATA.tutorial.heroes.forEach(id=>{if(!assaults.has(id))errores.push(id+' nunca Asalta en el tutorial.');});
  DATA.tutorial.steps.forEach(s=>{if(s.expect?.card&&!DATA.cards[s.expect.card])errores.push('El paso '+s.id+' cita carta inexistente '+s.expect.card+'.');});
  return {ok:errores.length===0,errores};
}
function replayTutorial(opciones={}){
  let estado=crearEstado(opciones),guard=0;
  while(pasoActual(estado)&&guard++<200){
    const paso=pasoActual(estado),accion=paso.kind==='say'?{type:'CONTINUE'}:copiar(paso.expect);
    const r=dispatch(estado,accion);
    if(!r.ok)return {ok:false,step:paso.id,error:r.mensaje,estado};
    estado=r.estado;
  }
  if(guard>=200)return {ok:false,error:'El guion excedió el límite de pasos.',estado};
  if(estado.tutorial.endedEarly)return {ok:false,error:'La partida terminó antes de completar todas las lecciones del guion.',estado,steps:guard,endedEarly:true};
  return {ok:estado.over&&estado.winner==='heroes',estado,steps:guard};
}
function metrics(estado){
  const directo={};Object.keys(estado.heroes).forEach(id=>directo[id]=0);
  for(const e of estado.eventLog)if(e.tipo==='daño.thal')directo[e.actor]=(directo[e.actor]||0)+e.amount;
  const total=Object.values(directo).reduce((a,b)=>a+b,0);
  return {thal:{vida:estado.thal.vida,ira:estado.thal.ira,deseo:estado.thal.deseo,phase:estado.thal.phase},round:estado.round,winner:estado.winner,directo,total,participacion:Object.fromEntries(Object.entries(directo).map(([id,n])=>[id,total?Math.round(n*100/total):0])),eventos:estado.eventLog.length};
}

globalThis.CAOZ_ASEDIO=Object.freeze({createState:crearEstado,dispatch,legalActions,currentStep:pasoActual,validateContent,replayTutorial,metrics,copy:copiar});
})();

/* Regresiones de El Rey sobre el motor real, sin DOM, red ni progreso guardado.
   node dev/secciones/pruebas_regresion_rey.mjs
   Añadir --sabotaje para exigir que startTurn antiguo sea rechazado.
   Añadir --balance para 144 partidas por versión (288 total), mismas semillas.
   --base=<revisión> permite comparar otra revisión sin modificar el checkout. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fuente=fs.readFileSync(path.join(raiz,'caoz_tcg/motor.js'),'utf8');
const pantalla=fs.readFileSync(path.join(raiz,'caoz_tcg/index.html'),'utf8');
const opciones=new Set(process.argv.slice(2));
const base=[...opciones].find(x=>x.startsWith('--base='))?.slice(7)||'b9ce94305a8a597e996a9fad698be310a7e13daf';
const anterior=()=>execFileSync('git',['show',base+':caoz_tcg/motor.js'],{cwd:raiz,encoding:'utf8'});

function crear(codigo=fuente,semilla=1){
  let azar=semilla>>>0;
  const matematicas=Object.create(Math);
  matematicas.random=()=>{azar=(Math.imul(1664525,azar)+1013904223)>>>0;return azar/4294967296;};
  const contexto={console,URLSearchParams,TextEncoder,TextDecoder,Math:matematicas,
    location:{search:''},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}};
  contexto.window=contexto;
  // Sólo los puertos de presentación. Daño, dados, IA, objetivos y red se ejecutan de verdad.
  for(const nombre of ['render','toast','clearPrompt','setPrompt','relojPinta','relojPara','rollDice',
    'campanaCancelarInterferencia','showEnd','tutShow','revelarCarta',
    ...new Set([...codigo.matchAll(/\b(fx[A-Z]\w*)\s*\(/g)].map(m=>m[1]))])contexto[nombre]=()=>{};
  contexto.FXON=()=>false;contexto.nap=async()=>{};contexto.tutPasivaLista=()=>true;
  vm.createContext(contexto);vm.runInContext(codigo,contexto,{filename:'motor.js'});
  for(const nombre of new Set([...codigo.matchAll(/\b(fx[A-Z]\w*)\s*\(/g)].map(m=>m[1])))contexto[nombre]=()=>{};
  contexto.netAsk=async pregunta=>pregunta.fallback;contexto.netSend=()=>{};
  // Se conservan las decisiones automáticas que emplea la pantalla real.
  vm.runInContext(pantalla.slice(pantalla.indexOf('function ask('),pantalla.indexOf('function cardEl(')),contexto);
  vm.runInContext(pantalla.slice(pantalla.indexOf('async function ofrecerManoNueva('),pantalla.indexOf('function log(')),contexto);
  vm.runInContext(`log=(txt,cls,priv)=>{if(G)G.log.push({txt,cls,priv:!!priv});};`,contexto);
  return {w:contexto,run:codigo=>vm.runInContext(codigo,contexto),json:codigo=>JSON.parse(vm.runInContext('JSON.stringify('+codigo+')',contexto))};
}

function arena(e,lado=0,{fichas=false,modo='local'}={}){
  e.w.newGame(lado?'fender':'gero',lado?'gero':'fender');
  e.run(`G.auto=true;G.fast=true;G.silent=true;G.active=${lado};G.turnNo=10;G.phase='principal';
    P(0).hand=[];P(1).hand=[];P(0).pd=10;P(1).pd=10;P(0).pdMax=10;P(1).pdMax=10;
    P(${lado}).field=${JSON.stringify(fichas?['rey','can','tok_goblincamino','tok_goblincamino']:['rey','bob','minus','juangabriel'])}.map(id=>mkUnit(id,${lado}));
    P(0).field.forEach(u=>u.sick=false);P(1).field.forEach(u=>u.sick=false);recalc();`);
  // Los inicios reales se prueban sin dejar que la IA juegue por su cuenta.
  e.w.aiTurn=async()=>{};
  if(modo==='online')e.run(`G.online=true;NET.on=true;NET.host=true;NET.guest=false;`);
  if(modo==='campana'||modo==='secreto')e.run(`G.campana={id:'prueba-rey',etapa:6,alma:40,jefeSecreto:${modo==='secreto'}};P(1).alma=40;`);
}

async function pasar(e,lado){await e.w.startTurn(1-lado);await e.w.startTurn(lado);}
let aprobadas=0;
async function caso(nombre,fn){await fn();aprobadas++;console.log('✓ '+nombre);}

await caso('Primer inicio mantiene el duelo; segundo inicio propio gana, en ambos bandos y todos los modos',async()=>{
  for(const modo of ['local','online','campana','secreto'])for(const lado of [0,1]){
    const e=crear();arena(e,lado,{modo});
    await e.w.startTurn(lado);
    assert.equal(e.run('G.over'),false,modo+' lado'+lado+': no puede ganar en el primer inicio');
    assert.equal(e.run(`P(${lado}).corte.turnos`),1);
    // Ningún render/recalc ni inicio del contrario suma otro turno propio.
    for(let i=0;i<10;i++)e.w.recalc();
    assert.equal(e.run(`P(${lado}).corte.turnos`),1);
    await e.w.startTurn(1-lado);assert.equal(e.run('G.over'),false);
    await e.w.startTurn(lado);assert.equal(e.run('G.winner'),lado);
    assert.equal(e.run('G.over'),true);
  }
});

await caso('Bajar Rey no concede progreso; las fichas de Can mantienen la identidad de la corte',async()=>{
  const e=crear();arena(e,0,{fichas:true});
  e.run(`P(0).field.shift();P(0).hand=['rey'];recalc();`);
  assert.equal(await e.w.playFromHand(0,'rey'),true);
  assert.equal(e.run('G.over'),false);assert.equal(e.run('P(0).corte.turnos'),0);
  await e.w.startTurn(0);assert.equal(e.run('G.over'),false);
  await pasar(e,0);assert.equal(e.run('G.winner'),0);
});

await caso('Muerte de aliado y repoblación reinician la corte',async()=>{
  const e=crear();arena(e);await e.w.startTurn(0);
  await e.w.destroy(e.run('P(0).field.find(u=>u.card.id==="bob")'));
  assert.equal(e.run('P(0).corte.turnos'),0);
  e.run(`P(0).field.push(mkUnit('bob',0));recalc();`);
  await pasar(e,0);assert.equal(e.run('G.over'),false);assert.equal(e.run('P(0).corte.turnos'),1);
  await pasar(e,0);assert.equal(e.run('G.winner'),0);
});

await caso('Cambiar el Rey, retirarlo temporalmente o poseerlo cancela su progreso',async()=>{
  for(const accion of ['reemplazar','retirar','poseer']){
    const e=crear();arena(e);await e.w.startTurn(0);
    if(accion==='reemplazar')e.run(`P(0).field[0]=mkUnit('rey',0);recalc();`);
    if(accion==='retirar')e.run(`globalThis.retirado=P(0).field.shift();recalc();P(0).field.unshift(retirado);recalc();`);
    if(accion==='poseer')e.run(`P(0).field[0].possessed=true;recalc();P(0).field[0].possessed=false;recalc();`);
    await pasar(e,0);assert.equal(e.run('G.over'),false,accion);assert.equal(e.run('P(0).corte.turnos'),1);
  }
});

await caso('Infección letal al inicio destruye al cuarto miembro antes de resolver la victoria',async()=>{
  const e=crear();arena(e,0,{fichas:true});await e.w.startTurn(0);
  e.run(`P(0).field.find(u=>u.card.id==='tok_goblincamino').infected=true;`);
  await pasar(e,0);
  assert.equal(e.run('G.over'),false);assert.equal(e.run('P(0).field.length'),3);
  assert.equal(e.run('P(0).corte.turnos'),0);
});

await caso('Estado online conserva el conteo, invierte el bando y no incrementa al refrescar',async()=>{
  for(const lado of [0,1]){
    const host=crear();arena(host,lado,{modo:'online'});await host.w.startTurn(lado);
    const invitado=crear();arena(invitado);invitado.run(`NET.on=true;NET.guest=true;G.online=true;`);
    const foto=host.json('netSnap()');
    for(let i=0;i<4;i++)invitado.w.netApply(foto);
    assert.deepEqual(invitado.json(`P(${1-lado}).corte`),host.json(`P(${lado}).corte`));
    assert.equal(invitado.run('G.over'),false);
    await pasar(host,lado);invitado.w.netApply(host.json('netSnap()'));
    assert.equal(invitado.run('G.over'),true);assert.equal(invitado.run('G.winner'),1-lado);
  }
});

await caso('La IA usa ataques legales para romper la corte; el daño letal al Alma conserva prioridad',async()=>{
  const e=crear();const ia=e.w.aiTurn;arena(e);e.w.aiTurn=ia;
  await e.w.startTurn(0);
  e.run(`G.active=1;G.phase='combate';P(1).field=['eric','eric','eric'].map(id=>mkUnit(id,1));
    P(1).field.forEach(u=>u.sick=false);P(1).pd=0;P(1).hand=[];P(1).leaderUsed=true;recalc();`);
  const ataques=[],original=e.w.doAttack;
  e.w.doAttack=async(u,t)=>{ataques.push(t==='face'?'alma':t.card.id);return original(u,t);};
  await e.w.aiTurn();
  assert.ok(ataques.some(t=>t!=='alma'),'La IA sigue pegando sólo al Alma ante una corte a punto de ganar');
  assert.equal(e.run('G.over'),false,'La defensa legal no evitó perder al siguiente turno');
  assert.equal(e.run('P(0).corte.turnos'),0);
  arena(e);await e.w.startTurn(0);e.run(`G.active=1;G.phase='combate';P(0).alma=3;P(1).field=[mkUnit('eric',1)];P(1).field[0].sick=false;recalc();`);
  assert.equal(e.run('aiPickAttack(P(1).field[0])'),'face');
});

await caso('Con dos Reyes la IA destruye al que conserva el conteo, no a la copia poseída',async()=>{
  const e=crear();arena(e);await e.w.startTurn(0);
  e.run(`P(0).field[0].dmg=4;const copia=mkUnit('rey',0);copia.possessed=true;copia.dmg=7;P(0).field.push(copia);
    P(1).field=[mkUnit('machete',1)];P(1).field[0].pA=4;P(1).field[0].sick=false;G.active=1;G.phase='combate';recalc();`);
  assert.equal(e.run('aiPickAttack(P(1).field[0]).uid'),e.run('P(0).corte.rey'));
  await e.w.doAttack(e.run('P(1).field[0]'),e.run('aiPickAttack(P(1).field[0])'));
  await e.w.startTurn(0);assert.equal(e.run('G.over'),false);assert.equal(e.run('P(0).corte.turnos'),0);
});

if(opciones.has('--sabotaje'))await caso('Sabotaje: startTurn anterior falla por victoria anticipada',async()=>{
  const codigo=anterior();
  const inicio=codigo.indexOf('async function startTurn('),fin=codigo.indexOf('async function endTurn(',inicio);
  assert.ok(inicio>=0&&fin>inicio,'No se encontró el startTurn anterior');
  const e=crear();e.run(codigo.slice(inicio,fin));arena(e);
  await e.w.startTurn(0);
  assert.throws(()=>assert.equal(e.run('G.over'),false),/AssertionError/,'El sabotaje no detectó la victoria anticipada');
});

console.log(`${aprobadas} grupos de regresión aprobados.`);

if(opciones.has('--balance')){
  const resumen=[];
  for(const [version,codigo] of [['anterior',anterior()],['propuesta',fuente]]){
    const filas=[];
    for(const rival of ['mohamed','fender','adreida','rafaela','talesin','gero']){
      const fila={rival,partidas:0,ganadas:0,corte:0,sinTerminar:0,turnos:0};
      for(let lado=0;lado<2;lado++)for(let k=1;k<=12;k++){
        const e=crear(codigo,123000+k*31+lado*719);
        await e.w.setupMatch(lado?rival:'gero',lado?'gero':rival,{fast:true,auto:true,silent:true,first:k%2});
        let vueltas=0;while(!e.run('G.over')&&vueltas++<200)await e.w.autoTurn(e.run('G.active'));
        const g=e.json('({over:G.over,winner:G.winner,turnNo:G.turnNo,why:G.endWhy})');
        fila.partidas++;fila.ganadas+=+(g.winner===lado);fila.corte+=+(g.winner===lado&&/corte/i.test(g.why||''));
        fila.sinTerminar+=+!g.over;fila.turnos+=g.turnNo;
      }
      filas.push(fila);
    }
    const total=filas.reduce((a,f)=>{for(const k of ['partidas','ganadas','corte','sinTerminar','turnos'])a[k]=(a[k]||0)+f[k];return a;},{});
    resumen.push({version,base:version==='anterior'?base:'archivo local',sha256:createHash('sha256').update(codigo).digest('hex'),filas,total});
  }
  console.log(JSON.stringify({balance:resumen,limites:'IA contra IA, muestra acotada y pareada; no mide estrategia humana ni campaña ni demuestra equilibrio global.'},null,2));
}

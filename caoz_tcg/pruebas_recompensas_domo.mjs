// Recompensas del Domo con los arranques reales de ambas pantallas, sin navegador,
// red ni datos de jugadores. Uso: node pruebas_recompensas_domo.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const leer=n=>fs.readFileSync(new URL(n,import.meta.url),'utf8');
const motor=leer('motor.js'),modelo=leer('coleccion-modelo.js'),juego=leer('coleccion-juego.js'),final=leer('final-core.js');
function funcion(codigo,nombre){
  const inicio=codigo.search(new RegExp('(?:async )?function '+nombre+'\\('));
  assert.ok(inicio>=0,nombre+' debe existir');
  const fin=codigo.indexOf('\n}',inicio);assert.ok(fin>inicio);
  return codigo.slice(inicio,fin+2);
}
function entorno(pagina,opciones={}){
  const mapa=opciones.mapa||new Map(),fallos={inventario:false,cola:false,lecturaCola:false},escuchas=new Map();
  let semilla=812,temporizadores=[];
  const contexto={Math,Date,URLSearchParams,Uint32Array,TextEncoder,TextDecoder,Set,Map,WeakMap,
    location:{hostname:'beta.caoz-tcg.pages.dev',pathname:'/'+pagina,search:opciones.search||''},
    crypto:{getRandomValues(a){for(let i=0;i<a.length;i++){semilla=(Math.imul(1664525,semilla)+1013904223)>>>0;a[i]=semilla;}return a;}},
    localStorage:{getItem(k){if(fallos.lecturaCola&&k.endsWith('.domo-pendientes'))throw Error('Lectura bloqueada');return mapa.get(k)??null;},setItem(k,v){if(fallos.inventario&&!k.endsWith('.domo-pendientes')||fallos.cola&&k.endsWith('.domo-pendientes'))throw Error('Sin espacio');mapa.set(k,v);},removeItem(k){if(fallos.cola&&k.endsWith('.domo-pendientes'))throw Error('Sin espacio');mapa.delete(k);}},
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},
    addEventListener(t,fn){if(!escuchas.has(t))escuchas.set(t,[]);escuchas.get(t).push(fn);},
    dispatchEvent(e){for(const fn of escuchas.get(e.type)||[])fn(e);},
    document:{readyState:'complete',getElementById:()=>null,querySelector:()=>null},
    setTimeout(fn){temporizadores.push(fn);return temporizadores.length;},clearTimeout(){},
    $:()=>({innerHTML:''}),clearPrompt(){},cerrarHojas(){},campanaCancelarInterferencia(){},
    tutEnd(){vm.runInContext('TUT.on=false',contexto);},showScreen(){},
    cortinillaVS:async()=>{},volado:async()=>0,showEnd(){},panelFinal(){},
  };
  contexto.window=contexto;vm.createContext(contexto);
  vm.runInContext(motor,contexto,{filename:'motor.js'});
  vm.runInContext('TUT.on=false;',contexto);
  vm.runInContext('drawSilent=async()=>{};startTurn=async()=>{};render=()=>{};log=()=>{};',contexto);
  const html=leer(pagina);
  vm.runInContext(funcion(html,'startMatch')+'\n'+funcion(html,'endGame'),contexto,{filename:pagina});
  vm.runInContext(modelo,contexto,{filename:'coleccion-modelo.js'});
  vm.runInContext(juego,contexto,{filename:'coleccion-juego.js'});
  return {c:contexto,m:contexto.CAOZ_COLECCION,mapa,fallos,
    evaluar:codigo=>vm.runInContext(codigo,contexto),
    terminar(winner=0){contexto.endGame(winner,'Victoria');},
    evento(type){contexto.dispatchEvent({type});},
    drenar(){const pendientes=temporizadores;temporizadores=[];pendientes.forEach(fn=>fn());},
  };
}
let total=0;
async function caso(nombre,fn){await fn();total++;console.log('✓ '+nombre);}
for(const pagina of ['index.html','movil.html']){
  await caso(pagina+': victoria real, fin repetido, menú, recarga y revancha',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.terminar();
    assert.equal(e.m.sobres(),1);e.drenar();e.c.showEnd(0,'Otra presentación');e.terminar();
    assert.equal(e.m.sobres(),1);assert.match(e.evaluar('CAOZ_COLECCION_JUEGO.premioFinal(G,0)'),/Ganaste 1 sobre/);
    const otra=entorno(pagina,{mapa:e.mapa});otra.evento('pageshow');assert.equal(otra.m.sobres(),1);
    await e.c.startMatch('fender','mohamed');e.terminar();assert.equal(e.m.sobres(),2);
    assert.equal(new Set(e.m.leer().domosPremiados).size,2,'Cada revancha recibe una identidad diferente');
  });
  await caso(pagina+': derrota, online, tutorial, pruebas y arranques directos sin premio',async()=>{
    for(const opts of [{fast:true},{silent:true},{auto:true},{tutorial:true},{online:true},{campana:{id:'campana',etapa:0,alma:20}},{volado:false},{prueba:true},{sinCortinilla:true}]){
      const e=entorno(pagina);await e.c.startMatch('fender','mohamed',opts);e.terminar();assert.equal(e.m.sobres(),0,JSON.stringify(opts));
    }
    for(const search of ['?test=1','?test=interno','?foto=fender,mohamed','?pantalla=board','?biblia=1','?auto','?rapido=1','?estudioVista=1','?laboratorio=1']){
      const e=entorno(pagina,{search});await e.c.startMatch('fender','mohamed');e.terminar();assert.equal(e.m.sobres(),0,search);
    }
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.terminar(1);assert.equal(e.m.sobres(),0);
    await e.c.setupMatch('fender','mohamed');e.terminar();assert.equal(e.m.sobres(),0,'setupMatch sin menú no fabrica premio');
    e.c.newGame('fender','mohamed');e.terminar();assert.equal(e.m.sobres(),0,'newGame del arnés no fabrica premio');
    await e.c.startMatch('fender','mohamed');e.evaluar('G.auto=true');e.terminar();assert.equal(e.m.sobres(),0,'Auto activado durante la partida');
    await e.c.startMatch('fender','mohamed');e.evaluar('G.online=true');e.terminar();assert.equal(e.m.sobres(),0,'Online activado durante la partida');
  });
  await caso(pagina+': un volado cancelado o reemplazado no autoriza otra partida',async()=>{
    const e=entorno(pagina);e.c.volado=async()=>null;await e.c.startMatch('fender','mohamed');
    await e.c.setupMatch('fender','mohamed');e.terminar();assert.equal(e.m.sobres(),0);
    const resolver=[];e.c.volado=()=>new Promise(r=>resolver.push(r));
    const primera=e.c.startMatch('fender','mohamed');await new Promise(r=>setImmediate(r));
    const segunda=e.c.startMatch('adreida','gero');await new Promise(r=>setImmediate(r));
    resolver[0](0);await primera;resolver[1](0);await segunda;e.terminar();assert.equal(e.m.sobres(),1);
  });
  await caso(pagina+': fallo del inventario conserva la victoria pendiente al recargar',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.fallos.inventario=true;e.terminar();
    assert.equal(e.m.sobres(),0);assert.ok([...e.mapa.keys()].some(k=>k.endsWith('.domo-pendientes')));
    assert.match(e.evaluar('CAOZ_COLECCION_JUEGO.premioFinal(G,0)'),/Pendiente/);
    const otra=entorno(pagina,{mapa:e.mapa});assert.equal(otra.m.sobres(),1);
    otra.evento('focus');otra.evento('pageshow');assert.equal(otra.m.sobres(),1);
    e.fallos.inventario=false;e.evento('focus');assert.equal(e.m.sobres(),1,'La pestaña anterior reconoce el mismo recibo');
  });
  await caso(pagina+': una lectura fallida no sobrescribe premios pendientes anteriores',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.fallos.inventario=true;e.terminar();
    const clave=e.c.CAOZ_COLECCION_JUEGO.clavePremiosDomo(),anterior=e.mapa.get(clave);
    e.fallos.inventario=false;e.fallos.lecturaCola=true;
    await e.c.startMatch('fender','mohamed');e.terminar();assert.equal(e.mapa.get(clave),anterior);assert.equal(e.m.sobres(),0);
    e.fallos.lecturaCola=false;e.evento('focus');assert.equal(e.m.sobres(),2);e.evento('focus');assert.equal(e.m.sobres(),2);
  });
  await caso(pagina+': borrar progreso descarta también premios retenidos en memoria',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.fallos.inventario=true;e.terminar();
    e.fallos.inventario=false;
    e.evaluar("const CAMPANA_CLAVE='caoz.campana.v1';const RECORDS_CLAVE='caoz_records_v1';");
    e.evaluar(funcion(final,'clavesProgresoLocal')+'\n'+funcion(final,'borrarProgresoLocal'));
    assert.equal(e.c.borrarProgresoLocal(),true);e.evento('focus');e.c.showEnd(0,'Fin anterior');
    assert.equal(e.m.sobres(),0);assert.equal(e.mapa.has(e.c.CAOZ_COLECCION_JUEGO.clavePremiosDomo()),false);
    await e.c.startMatch('fender','mohamed');e.terminar();assert.equal(e.m.sobres(),1);
  });
  await caso(pagina+': una campaña automática no recupera premios al volver a guardarla',async()=>{
    for(const bandera of ['fast','silent','auto','online','tutorial']){
      const e=entorno(pagina);
      e.evaluar("const CAMPANA_CLAVE='caoz.campana.v1';const CAMPANA_RIVALES=Array(6).fill({});let campanaMemoria=null,campanaEnsayoGero=null;campanaPruebaDisponible=()=>true;toast=()=>{};");
      e.evaluar(['campanaIdSobreValido','campanaSobresPendientes','campanaPuedeRecibirSobre','campanaEntregarSobre','campanaGuardar'].map(n=>funcion(final,n)).join('\n'));
      e.c.newGame('fender','mohamed');e.evaluar("G.campana={id:'ensayo'};G."+bandera+'=true');
      const progreso={version:1,id:'ensayo',lider:'fender',etapa:6};assert.equal(e.c.campanaGuardar(progreso),true);assert.equal(progreso.sinPremios,true);
      assert.equal(e.m.sobres(),0);e.c.newGame('fender','mohamed');
      const recargado=JSON.parse(e.mapa.get('caoz.campana.v1'));assert.equal(e.c.campanaEntregarSobre(recargado),false);assert.equal(e.m.sobres(),0);
    }
  });
  await caso(pagina+': un ensayo transporta premios anteriores sin apropiarse de uno nuevo',async()=>{
    const e=entorno(pagina);
    e.evaluar("const CAMPANA_CLAVE='caoz.campana.v1';const CAMPANA_RIVALES=Array(6).fill({});let campanaMemoria=null,campanaEnsayoGero=null;campanaPruebaDisponible=()=>true;toast=()=>{};");
    e.evaluar(['campanaIdSobreValido','campanaSobresPendientes','campanaPuedeRecibirSobre','campanaEntregarSobre','campanaGuardar'].map(n=>funcion(final,n)).join('\n'));
    e.c.CAOZ_COLECCION={...e.m,concederSobreCampana:()=>false};
    e.c.campanaGuardar({version:1,id:'real-anterior',lider:'fender',etapa:6});
    e.c.newGame('fender','mohamed');e.evaluar("G.campana={id:'ensayo-intermedio'};G.auto=true");
    const ensayo={version:1,id:'ensayo-intermedio',lider:'fender',etapa:6};e.c.campanaGuardar(ensayo);
    assert.equal(ensayo.sinPremios,true);assert.deepEqual([...ensayo.sobresPendientes],['real-anterior']);
    e.c.newGame('fender','mohamed');const nuevo={version:1,id:'otro-recorrido',lider:'fender',etapa:0};e.c.campanaGuardar(nuevo);
    assert.deepEqual([...nuevo.sobresPendientes],['real-anterior']);e.c.CAOZ_COLECCION=e.m;e.c.campanaGuardar(nuevo);
    assert.equal(e.m.sobres(),3);assert.deepEqual([...e.m.leer().campanasPremiadas],['real-anterior']);
    e.c.campanaGuardar(nuevo);assert.equal(e.m.sobres(),3);
  });
  await caso(pagina+': fallo total se reintenta en memoria; limpiar cola nunca duplica',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.fallos.inventario=true;e.fallos.cola=true;e.terminar();assert.equal(e.m.sobres(),0);
    e.fallos.inventario=false;e.evento('focus');assert.equal(e.m.sobres(),1);
    e.fallos.cola=false;e.evento('pageshow');assert.equal(e.m.sobres(),1);
    await e.c.startMatch('fender','mohamed');e.fallos.inventario=true;e.terminar();
    e.fallos.inventario=false;e.m.reiniciar();e.evento('focus');assert.equal(e.m.sobres(),0,'Reiniciar no restaura una victoria pendiente');
  });
}
console.log(total+' casos de recompensas del Domo correctos.');

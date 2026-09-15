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
    // Estas partidas representan un jugador ya verificado y vinculado.
    // Las entradas sin permiso se prueban en pruebas_cuenta_entradas.mjs.
    CAOZ_CUENTA_JUEGO:{requerir:()=>true,puedeJugar:()=>true},
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
function conectarEleccion(e,progreso=null){
  const botones=[],aperturas=[],avisos=[];let menu=true,dialogo=false;
  const elemento=(tag,clase='')=>({tagName:tag.toUpperCase(),className:clase,dataset:{},disabled:false,isConnected:true,textContent:'',atributos:{},hijos:[],
    setAttribute(k,v){this.atributos[k]=v;},append(...n){this.hijos.push(...n);},appendChild(n){this.hijos.push(n);return n;},
    insertBefore(n){this.hijos.push(n);},querySelector(sel){return this.hijos.find(n=>sel.split('.').slice(1).every(c=>n.className?.split(' ').includes(c)))||null;}});
  const panel=elemento('section');panel.append(elemento('div','opts'));
  e.c.el=(tag,clase)=>{const n=elemento(tag,clase);if(tag==='button')botones.push(n);return n;};
  e.c.toast=t=>avisos.push(t);
  e.c.document.getElementById=id=>id==='ovPanel'?panel:null;
  e.c.document.querySelector=selector=>selector==='#menu.on'?(menu?{}:null):selector==='dialog[open],#ov.on'?(dialogo?{}:null):null;
  e.c.document.querySelectorAll=()=>botones.filter(b=>b.isConnected);
  e.c.abrirRecompensaSobres=opciones=>{aperturas.push(opciones);dialogo=true;return true;};
  e.evaluar("const CAMPANA_RIVALES=Array(6).fill({});let campanaEnsayoGero=null;campanaPruebaDisponible=()=>true;");
  e.c.campanaLeer=()=>progreso;e.c.campanaEntregarSobre=()=>{};
  e.evaluar(['campanaIdSobreValido','campanaPuedeRecibirSobre','recompensaDeVictoria','frasePremioFinal','crearBotonPremioFinal','campanaElegirPremioAlVolver'].map(n=>funcion(final,n)).join('\n'));
  return {botones,panel,aperturas,avisos,
    cerrar(){dialogo=false;aperturas.at(-1)?.onCerrar?.();},
    menu(v){menu=v;},dialogo(v){dialogo=v;},progreso(v){progreso=v;},
    crear(opciones){return e.c.crearBotonPremioFinal(e.evaluar('G'),0,opciones);},
    pulsar(b){return b.onclick({stopPropagation(){}});},
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
  await caso(pagina+': la victoria elige un sobre sin dar cartas ni reemplazar la partida',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.terminar();const g=e.evaluar('G'),ui=conectarEleccion(e);
    assert.equal(e.m.recompensasPendientes().length,1);assert.equal(e.m.inventarioSobres().length,0);
    const antes=JSON.stringify(e.m.leer().cantidades),boton=ui.crear({esperar:true});
    assert.equal(boton.textContent,'Elegir mi sobre');assert.equal(boton.disabled,true);await ui.pulsar(boton);assert.equal(ui.aperturas.length,0);
    boton.habilitarPremio();await ui.pulsar(boton);assert.equal(ui.aperturas.length,1);assert.equal(boton.disabled,true);
    const recompensa=e.m.recompensasPendientes()[0];assert.equal(ui.aperturas[0].origen,'domo');assert.equal(ui.aperturas[0].referencia,recompensa.referencia);
    await ui.pulsar(boton);assert.equal(ui.aperturas.length,1,'Doble clic no abre dos elecciones');assert.equal(e.evaluar('G'),g);
    ui.cerrar();assert.equal(boton.disabled,false);assert.equal(e.m.recompensasPendientes().length,1,'Cancelar conserva la decisión');
    await ui.pulsar(boton);assert.equal(e.m.elegirSobres(recompensa.id,[e.m.grupos()[0].id]),true);ui.cerrar();
    assert.equal(boton.textContent,'Ver mis sobres');assert.equal(e.m.sobres(),1);assert.equal(e.m.recompensasPendientes().length,0);
    assert.equal(e.m.inventarioSobres()[0].cantidad,1);assert.equal(JSON.stringify(e.m.leer().cantidades),antes,'Elegir no revela ni concede cartas');
    e.c.showEnd(0,'Volver a Victoria');assert.equal(e.m.recompensasPendientes().length,0,'Mostrar otra vez no repite premio');
    await ui.pulsar(boton);assert.equal(ui.aperturas.at(-1).referencia,recompensa.referencia);ui.cerrar();
    await e.c.startMatch('fender','mohamed');await ui.pulsar(boton);assert.equal(ui.aperturas.length,3,'El botón antiguo no invade la revancha');
    e.terminar();assert.equal(e.m.recompensasPendientes().length,1,'La revancha nueva sí permite otra elección');
  });
  await caso(pagina+': el panel alternativo incluye el mismo acceso a elección',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.terminar();const ui=conectarEleccion(e);
    e.c.panelFinal(0,'Victoria sin animación');assert.equal(ui.botones.length,1);assert.ok(ui.panel.hijos.includes(ui.botones[0]));
    await ui.pulsar(ui.botones[0]);assert.equal(ui.aperturas.length,1);assert.equal(ui.aperturas[0].origen,'domo');
    e.c.panelFinal(0,'Victoria repetida');assert.equal(ui.botones.length,1,'No apila CTA repetidas');
  });
  await caso(pagina+': guardar fallido permite reintentar antes de elegir',async()=>{
    const e=entorno(pagina);await e.c.startMatch('fender','mohamed');e.fallos.inventario=true;e.terminar();const ui=conectarEleccion(e),boton=ui.crear();
    assert.equal(boton.textContent,'Guardar mi recompensa');await ui.pulsar(boton);assert.equal(ui.aperturas.length,0);assert.equal(ui.avisos.length,1);assert.equal(boton.disabled,false);
    e.fallos.inventario=false;await ui.pulsar(boton);assert.equal(ui.aperturas.length,1);assert.equal(e.m.recompensasPendientes().length,1);ui.cerrar();
    e.c.abrirRecompensaSobres=undefined;await ui.pulsar(boton);assert.equal(boton.disabled,false);assert.equal(e.m.sobres(),1);
  });
  await caso(pagina+': campaña elige tres y el epílogo respeta menú, recorrido y decisión previa',async()=>{
    const e=entorno(pagina),p={version:1,id:'campana-final',lider:'fender',etapa:6,deseo:{simulado:true}};
    e.c.newGame('fender','gero');e.evaluar("G.over=true;G.campana={id:'campana-final',etapa:5};");e.m.concederSobreCampana(p.id);
    const ui=conectarEleccion(e,p),g=e.evaluar('G'),b=ui.crear();assert.equal(b.textContent,'Elegir mis 3 sobres');
    await ui.pulsar(b);assert.equal(ui.aperturas[0].origen,'campana');assert.equal(ui.aperturas[0].referencia,p.id);ui.cerrar();
    ui.menu(false);assert.equal(e.c.campanaElegirPremioAlVolver(p.id,g),false);ui.menu(true);
    ui.dialogo(true);assert.equal(e.c.campanaElegirPremioAlVolver(p.id,g),false);ui.dialogo(false);
    assert.equal(e.c.campanaElegirPremioAlVolver('otro',g),false);assert.equal(e.c.campanaElegirPremioAlVolver(p.id,{}),false);
    p.secreto='final';assert.equal(e.c.campanaElegirPremioAlVolver(p.id,g),false,'El Editor aún muestra el epílogo');
    p.secreto='completado';assert.equal(e.c.campanaElegirPremioAlVolver(p.id,g),true);ui.cerrar();
    const premio=e.m.recompensasPendientes()[0],grupos=e.m.grupos();assert.equal(e.m.elegirSobres(premio.id,[grupos[0].id,grupos[1].id,grupos[1].id]),true);
    assert.equal(e.m.inventarioSobres().reduce((n,s)=>n+s.cantidad,0),3);assert.equal(e.c.campanaElegirPremioAlVolver(p.id,g),false,'Elegido en Victoria no se vuelve a abrir');
    p.pruebaEditor=true;assert.equal(ui.crear(),null);delete p.pruebaEditor;p.etapa=4;assert.equal(ui.crear(),null);
    p.etapa=6;p.secreto='ascenso';assert.equal(ui.crear(),null,'Gero no concede antes del Editor');
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

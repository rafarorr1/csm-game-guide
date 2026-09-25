/* Guardias reales de entrada al juego, extraídas sin cargar la mesa ni el motor.
   Las dependencias de combate fallan al primer efecto: sin cuenta no deben
   alcanzarse. No usa navegador, almacenamiento, correo ni red de jugadores.
   --sabotaje retira guardias sólo en memoria y exige detectar cada regresión. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const carpeta=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../caoz_tcg');
const fuentes=Object.fromEntries(['index.html','movil.html','final-core.js','campana-secreto.js','cuenta-juego.js'].map(n=>[n,fs.readFileSync(path.join(carpeta,n),'utf8')]));
let total=0;
async function prueba(nombre,fn){await fn();total++;console.log('✓ '+nombre);}
function desde(codigo,inicio,nombre){
 assert(inicio>=0,'Existe el inicio de '+nombre);
 for(let fin=inicio;fin<codigo.length;fin++){
  if(!['}', ';'].includes(codigo[fin]))continue;
  const texto=codigo.slice(inicio,fin+1);
  try{new vm.Script(texto);return texto;}catch(e){if(!(e instanceof SyntaxError))throw e;}
 }
 throw Error('No terminó la declaración '+nombre);
}
function funcion(codigo,nombre){
 const encontrados=[...codigo.matchAll(new RegExp('^\\s*(?:async\\s+)?function\\s+'+nombre+'\\s*\\(','gm'))];
 assert.equal(encontrados.length,1,'Declaración única de '+nombre);
 return desde(codigo,encontrados[0].index,nombre);
}
function expresion(codigo,patron,nombre){const encontrados=[...codigo.matchAll(patron)];assert.equal(encontrados.length,1,'Expresión única de '+nombre);return desde(codigo,encontrados[0].index,nombre);}
function retirarGuardia(codigo){
 const cambiado=codigo.replace(/^\s*if\([^\n]*(?:window|global)\.CAOZ_CUENTA_JUEGO\?\.requerir\([^\n]*\)\)return;\s*$/m,'');
 assert.notEqual(cambiado,codigo,'El sabotaje retiró una guardia real');return cambiado;
}
const opciones={volado:false,first:1,campana:{id:'recorrido-acceso'}};
const mensaje={partida:'duelo-prueba',sid:'sala-prueba',guest:'fender',host:'adreida'};
const comunes=[['startMatch',['fender','adreida',opciones]],['startTutorial',['gero']],['showTutorialPick',[]],['showScreen',['select']],['showOnline',[]],['onlPickNombre',[false]],['onlHost',[]],['onlJoinCode',[]]];
const entradas=[...['index.html','movil.html'].flatMap(archivo=>comunes.map(([nombre,args])=>({archivo,nombre,args}))),
 ...[['abrirCampana',[]],['campanaCombatir',[]],['iniciarOnlineHost',['fender','adreida']],['iniciarOnlineGuest',[mensaje]]].map(([nombre,args])=>({archivo:'final-core.js',nombre,args})),
 {archivo:'final-core.js',nombre:'campanaSeleccionar',args:[],reanudar:'abrirCampana',argsReanudar:[]},
 {archivo:'final-core.js',nombre:'campanaVencerPrueba',args:[{id:'escena-descartada'}],reanudar:'abrirCampana',argsReanudar:[]},
 {archivo:'campana-secreto.js',nombre:'combatir',args:[{id:'escena-editor-descartada'}],reanudar:'abrirCampana',argsReanudar:[]}];
function prepararEntrada(entrada,{servicio='denegado',sabotaje=false}={}){
 const {nombre}=entrada;let efectos=0,consultas=0,continuar=null;
 const efecto=Object.assign(Error('Se alcanzó la lógica protegida de '+nombre),{codigo:'EFECTO_PROTEGIDO'});
 const trampa=()=>{efectos++;throw efecto;};
 const cuenta={requerir(fn){consultas++;continuar=fn;return servicio==='permitido';}};
 const contexto=vm.createContext({window:servicio==='ausente'?{}:{CAOZ_CUENTA_JUEGO:cuenta},
  campanaCancelarInterferencia:trampa,campanaLeer:trampa,tutEnd:trampa,$:trampa,nombreGuardado:trampa,netCode:trampa,
  document:{getElementById:trampa},NET:new Proxy({},{get:trampa}),PARTIDA_N:0,SEL:'conservar',TGT:'conservar'});
 contexto.global=contexto.window;
 const codigo=funcion(fuentes[entrada.archivo],nombre);vm.runInContext(sabotaje?retirarGuardia(codigo):codigo,contexto);
 return {contexto,efecto,ver:()=>({efectos,consultas,continuar}),ejecutar:()=>contexto[nombre](...entrada.args)};
}
for(const entrada of entradas){
 await prueba(entrada.archivo+': '+entrada.nombre+' espera acceso y conserva su continuación',async()=>{
  for(const servicio of ['ausente','denegado']){
   const f=prepararEntrada(entrada,{servicio});await f.ejecutar();assert.equal(f.ver().efectos,0,'No toca DOM, red, turno ni campaña');
   assert.equal(f.contexto.PARTIDA_N,0);assert.equal(f.contexto.SEL,'conservar');assert.equal(f.contexto.TGT,'conservar');
   assert.equal(f.ver().consultas,servicio==='ausente'?0:1);
   if(servicio==='denegado'){
    const esperados=entrada.argsReanudar||entrada.args;
    let recibidos=null;f.contexto[entrada.reanudar||entrada.nombre]=(...args)=>{recibidos=args;};await f.ver().continuar();
    assert.deepEqual(recibidos,esperados,'Conserva argumentos al reanudar; una escena cerrada se reconstruye sin referencias viejas');esperados.forEach((arg,i)=>assert.equal(recibidos[i],arg,'Conserva la identidad del mensaje/opciones'));
   }
  }
  const f=prepararEntrada(entrada,{servicio:'permitido'});
  await assert.rejects(async()=>f.ejecutar(),e=>e===f.efecto);assert.equal(f.ver().efectos,1,'La cuenta válida sí alcanza la lógica original');
 });
}
for(const archivo of ['index.html','movil.html']){
 await prueba(archivo+': Jugar contra el Domo no cambia el selector antes del acceso',async()=>{
  const asignacion=expresion(fuentes[archivo],/^\$\('#mPlay'\)\.onclick=/gm,'botón Jugar');let autorizado=false,pendiente=null,selectores=0,pantallas=[];
  const boton={click(){return this.onclick();}};
  const c=vm.createContext({window:{},$:()=>boton,SELP:'fender',SELF:'adreida',SEL_PASO:'rival',buildSelect:()=>selectores++,showScreen:id=>pantallas.push(id)});
  vm.runInContext(asignacion,c);boton.click();assert.equal(selectores,0);assert.equal(c.SELP,'fender');
  c.window.CAOZ_CUENTA_JUEGO={requerir(fn){pendiente=fn;return autorizado;}};boton.click();assert.equal(selectores,0);assert.equal(c.SEL_PASO,'rival');
  autorizado=true;await pendiente();assert.equal(selectores,1);assert.equal(c.SELP,null);assert.equal(c.SELF,null);assert.equal(c.SEL_PASO,'yo');assert.deepEqual(pantallas,['select']);
 });
 await prueba(archivo+': el botón de unirse vuelve a comprobar una sesión caducada',async()=>{
  let autorizado=true,pendiente=null,conexiones=[],mensajes=[],temporizadores=[];const elementos=[];
  const el=(tag,clase,texto)=>{const n={tag,clase,texto,style:{},appendChild(){},focus(){},click(){return this.onclick?.();}};elementos.push(n);return n;};
  const panel=el('div'),campo={value:'ABCDE',focus(){}};
  const c=vm.createContext({window:{CAOZ_CUENTA_JUEGO:{requerir(fn){pendiente=fn;return autorizado;}}},$:id=>id==='#ovPanel'?panel:campo,el,
   ONL:{lider:'fender',nombre:'Ari',sala:null},NET:{on:true,peer:false},openOv(){},codigoInvitacion:v=>v,netStatus(){},netConnect:async(...v)=>conexiones.push(v),netSend:v=>mensajes.push(v),
   setTimeout:fn=>temporizadores.push(fn),setInterval:fn=>temporizadores.push(fn),clearInterval(){}});
  vm.runInContext(funcion(fuentes[archivo],'onlJoinCode'),c);c.onlJoinCode();const go=elementos.find(e=>e.texto==='Entrar →');assert(go);
  autorizado=false;await go.click();assert.equal(conexiones.length,0);assert.equal(go.disabled,undefined);assert.equal(mensajes.length,0);
  autorizado=true;await pendiente();assert.deepEqual(conexiones,[['ABCDE',false]]);assert.equal(mensajes.length,1);assert.equal(mensajes[0].leader,'fender');assert.equal(go.disabled,true);
 });
}
function invitacion({sabotaje=false,ausente=false}={}){
 let autorizado=false,pendiente=null,lecturas=0;const tareas=[],reemplazos=[],aperturas=[];
 const href='https://juego.caozcontodo.com/movil.html?sala=ABCDE&b=258#mesa';
 const ventana={CAOZ_INVITACIONES:{enApp:()=>true}};
 if(!ausente)ventana.CAOZ_CUENTA_JUEGO={requerir(fn){pendiente=fn;return autorizado;}};
 const c=vm.createContext({window:ventana,URL,location:{href},ONL:{nombre:'',sala:null},invitacionAbierta:'',
  setTimeout:fn=>tareas.push(fn),history:{replaceState(_a,_b,url){reemplazos.push(url);}},nombreGuardado:()=>{lecturas++;return 'Ari';},onlPickNombre:v=>aperturas.push(v)});
 const codigo=funcion(fuentes['final-core.js'],'codigoInvitacion');
 const enApp=funcion(fuentes['final-core.js'],'invitacionEnApp');
 const original=funcion(fuentes['final-core.js'],'cuentaAbrirInvitacion');
 vm.runInContext(codigo+'\n'+enApp+'\n'+(sabotaje?retirarGuardia(original):original),c);
 return {c,tareas,reemplazos,aperturas,ver:()=>({pendiente,lecturas}),permitir:()=>{autorizado=true;}};
}
async function comprobarInvitacion(sabotaje=false){
 const f=invitacion({sabotaje});f.c.cuentaAbrirInvitacion('ABCDE');assert.equal(f.c.ONL.sala,'ABCDE');assert.equal(f.reemplazos.length,0);
 await f.tareas.shift()();assert.deepEqual(f.reemplazos,[],'Sin acceso la invitación permanece en la dirección');assert.equal(f.ver().lecturas,0);assert.equal(f.aperturas.length,0);
 f.permitir();await f.ver().pendiente();assert.deepEqual(f.reemplazos,['/movil.html?b=258#mesa']);assert.deepEqual(f.aperturas,[false]);assert.equal(f.c.ONL.nombre,'Ari');assert.equal(f.c.ONL.sala,'ABCDE');
}
await prueba('La invitación espera el correo sin borrar sala, otros parámetros ni fragmento',()=>comprobarInvitacion());
await prueba('Sin módulo de cuentas la invitación tampoco se consume',async()=>{const f=invitacion({ausente:true});f.c.cuentaAbrirInvitacion('ABCDE');await f.tareas.shift()();assert.equal(f.reemplazos.length,0);assert.equal(f.aperturas.length,0);});
async function comprobarFoto(sabotaje=false){
 const fuente=fuentes['index.html'],original=desde(fuente,fuente.indexOf('async function fotoPreparar('),'preparación de foto');
 for(const ausente of [true,false]){
  let autorizado=false,continuar=null,jugadores=null,lecturas=0,creadas=0,calculos=0,pintados=0;
  const partidas=[],temporizadores=[],clases=[];
  const c=vm.createContext({window:ausente?{}:{CAOZ_CUENTA_JUEGO:{requerir(fn){continuar=fn;return autorizado;}}},
   URLSearchParams,location:{search:'?foto=fender,adreida&mesa=matildus,machete:1&mano=sombrero&gastada=1&equipar=1'},ME:0,FOE:1,
   async startMatch(...args){partidas.push(args);if(autorizado)jugadores=[{field:[],hand:['anterior']},{field:[],hand:[]}];},
   P(side){lecturas++;if(!jugadores)throw Error('Partida aún no iniciada');return jugadores[side];},
   mkUnit(id,side){creadas++;return {id,side,sick:true};},recalc(){calculos++;},render(){pintados++;},
   setTimeout(fn,ms){temporizadores.push({fn,ms});},
   document:{body:{classList:{add:n=>clases.push(n)}}}});
  vm.runInContext(sabotaje?retirarGuardia(original):original,c);await c.fotoPreparar();
  assert.equal(partidas.length,0,'La foto no intenta iniciar antes del acceso');
  assert.equal(lecturas,0,'La mesa no consulta jugadores antes del acceso');assert.equal(creadas,0);
  assert.equal(pintados,0);assert.equal(temporizadores.length,0);assert.deepEqual(clases,[]);
  if(ausente)continue;
  assert.equal(typeof continuar,'function');autorizado=true;await continuar();
  assert.deepEqual(JSON.parse(JSON.stringify(partidas)),[['fender','adreida',{volado:false}]],'Conserva la partida solicitada en la foto');
  assert.deepEqual(jugadores.map(p=>p.field.map(u=>[u.id,u.side,u.sick])),[[['matildus',0,false]],[['machete',1,false]]]);
  assert.deepEqual(jugadores[0].hand,['sombrero']);assert.equal(calculos,1);assert.equal(pintados,2);
  assert.deepEqual(temporizadores.map(t=>t.ms),[650,700],'Los ajustes posteriores se programan sólo después de iniciar');
  assert.deepEqual(clases,['foto-lista']);
 }
}
await prueba('La foto de escritorio espera acceso antes de preparar mesa, mano y ajustes',()=>comprobarFoto());
await prueba('La guardia pública existe antes del DOM sin iniciar el servicio ni permitir jugar',async()=>{
 const listeners=[];const c=vm.createContext({URLSearchParams,location:{search:''},document:{readyState:'loading',addEventListener:(...v)=>listeners.push(v)}});c.window=c;
 vm.runInContext(fuentes['cuenta-juego.js'],c);assert(c.CAOZ_CUENTA_JUEGO);assert.equal(c.CAOZ_CUENTA_JUEGO.puedeJugar(),false);assert.equal(c.CAOZ_CUENTA_JUEGO.requerir(()=>assert.fail('No debe continuar')),false);assert.equal(c.CAOZ_CUENTA_JUEGO.cerrar(),false);assert.equal(listeners[0][0],'DOMContentLoaded');
});
async function inicioCuenta(resultado){
 const carga=[],eventos=[],boton={dataset:{},addEventListener(){}},menu={append(){}},estado={sesion:null,guardado:'sesion',ocupado:false};
 let resolver,autorizado=false,montajes=0,modales=0;
 const documento={readyState:'loading',addEventListener(tipo,fn){if(tipo==='DOMContentLoaded')carga.push(fn);},getElementById:id=>id==='mCuenta'?boton:null,
  querySelector:selector=>selector==='#menu .menucol'?menu:null,body:{append(){}},createElement(){return {setAttribute(){},append(){},appendChild(){},addEventListener(){},showModal(){modales++;this.open=true;},close(){this.open=false;},remove(){}};}};
 const acceso={modelo:{actualizarLocal(){},ver:()=>estado},suscribir(fn){fn(estado);return()=>{};},necesitaRestaurar:()=>true,
  iniciar:()=>new Promise(resolve=>{resolver=()=>{autorizado=resultado;estado.sesion=resultado?{id:'ari',nombre:'Ari'}:null;resolve(resultado);};}),
  puedeJugar:()=>autorizado,activarVinculo(){},guardar:async()=>true,estado:()=>estado};
 const c=vm.createContext({URLSearchParams,location:{search:''},document:documento,queueMicrotask:fn=>Promise.resolve().then(fn),setTimeout,clearTimeout,
  CustomEvent:class{constructor(tipo,opciones){this.type=tipo;this.detail=opciones?.detail;}},addEventListener(){},dispatchEvent:e=>eventos.push(e),
  CAOZ_CUENTA_PROGRESO:{crear:()=>({instalarGuardia(){},capturar:()=>null,resumir:()=>null,vinculado:()=>null})},CAOZ_CUENTA_SERVICIO:{crear:()=>({})},CAOZ_CUENTA_ACCESO:{crear:()=>acceso},
  CAOZ_CUENTA_UI:{montar(){montajes++;return{destruir(){}};}}});c.window=c;
 vm.runInContext(fuentes['cuenta-juego.js'],c);carga.shift()();
 for(let i=0;i<3&&!resolver;i++)await Promise.resolve();assert.equal(typeof resolver,'function','La recuperación automática empieza sin esperar al formulario.');
 assert.equal(montajes,0,'Una sesión que todavía se está comprobando no monta el popup de correo.');assert.equal(modales,0);
 resolver();for(let i=0;i<3;i++)await Promise.resolve();
 assert.equal(montajes,resultado?0:1,resultado?'Una sesión válida no destella el popup antes de abrir el menú.':'Sin sesión, el popup sí aparece después de confirmar que hace falta.');
 assert.equal(modales,resultado?0:1);assert.equal(eventos.length,resultado?1:0);
}
await prueba('La restauración de una cuenta válida no destella el popup de login',()=>inicioCuenta(true));
await prueba('Sin sesión, el popup aparece sólo después de la comprobación inicial',()=>inicioCuenta(false));
async function recuperacionExterna(resultado){
 const carga=[],boton={dataset:{},addEventListener(){}},menu={append(){}},estado={sesion:null,guardado:'sesion',ocupado:false};
 let autorizado=false,recuperando=true,actualizarEstado,montajes=0,modales=0;
 const documento={readyState:'loading',addEventListener(tipo,fn){if(tipo==='DOMContentLoaded')carga.push(fn);},getElementById:id=>id==='mCuenta'?boton:null,
  querySelector:selector=>selector==='#menu .menucol'?menu:null,body:{append(){}},createElement(){return {setAttribute(){},append(){},appendChild(){},addEventListener(){},showModal(){modales++;this.open=true;},close(){this.open=false;},remove(){}};}};
 const acceso={modelo:{actualizarLocal(){},ver:()=>estado},suscribir(fn){actualizarEstado=fn;fn(estado);return()=>{};},necesitaRestaurar:()=>!recuperando,
  recuperando:()=>recuperando,iniciar:()=>assert.fail('No duplica una recuperación iniciada por el navegador.'),puedeJugar:()=>autorizado,activarVinculo(){},guardar:async()=>true,estado:()=>estado};
 const c=vm.createContext({URLSearchParams,location:{search:''},document:documento,queueMicrotask:fn=>Promise.resolve().then(fn),setTimeout,clearTimeout,
  CustomEvent:class{constructor(tipo,opciones){this.type=tipo;this.detail=opciones?.detail;}},addEventListener(){},dispatchEvent(){},
  CAOZ_CUENTA_PROGRESO:{crear:()=>({instalarGuardia(){},capturar:()=>null,resumir:()=>null,vinculado:()=>null})},CAOZ_CUENTA_SERVICIO:{crear:()=>({})},CAOZ_CUENTA_ACCESO:{crear:()=>acceso},
  CAOZ_CUENTA_UI:{montar(){montajes++;return{destruir(){}};}}});c.window=c;
 vm.runInContext(fuentes['cuenta-juego.js'],c);carga.shift()();
 for(let i=0;i<3;i++)await Promise.resolve();
 // cuenta-acceso emite este estado antes de que termine la consulta lanzada
 // por online, focus o pageshow; no debe montar un popup transitorio.
 actualizarEstado(estado);assert.equal(montajes,0);assert.equal(modales,0);
 recuperando=false;
 if(resultado){autorizado=true;estado.sesion={id:'ari',nombre:'Ari'};}
 actualizarEstado(estado);
 assert.equal(montajes,resultado?0:1,resultado?'Una sesión externa válida no destella el popup.':'Una recuperación externa sin sesión sí solicita el acceso al terminar.');
 assert.equal(modales,resultado?0:1);
}
await prueba('La recuperación externa de una sesión válida no destella el popup',()=>recuperacionExterna(true));
await prueba('Una recuperación externa sin sesión abre el popup sólo al terminar',()=>recuperacionExterna(false));
await prueba('La continuación pendiente sólo sale una vez y se cancela si se revoca el acceso',async()=>{
 for(const revocar of [false,true]){
  const tareas=[];let ejecuciones=0,segunda=0;
  const c=vm.createContext({queueMicrotask:fn=>tareas.push(fn),permitido:()=>c.autorizado,autorizado:false,menuSeguro:()=>true,abrir(){},iniciado:false,pendiente:null,
   dialogo:{open:true,close(){this.open=false;},remove(){}},vista:{destruir(){}},boton:{focus(){}},acceso:{modelo:{ver:()=>({ocupado:false})}}});
  vm.runInContext(funcion(fuentes['cuenta-juego.js'],'requerir')+'\n'+funcion(fuentes['cuenta-juego.js'],'cerrar'),c);
  assert.equal(c.requerir(()=>ejecuciones++),false);assert.equal(c.requerir(()=>segunda++),false);assert.equal(c.cerrar(),false);assert.equal(tareas.length,0);
  c.autorizado=true;assert.equal(c.cerrar(),true);assert.equal(c.cerrar(),false);assert.equal(tareas.length,1);if(revocar)c.autorizado=false;
  await tareas.shift()();assert.equal(ejecuciones,revocar?0:1);assert.equal(segunda,0);assert.equal(c.pendiente,null);
 }
});
async function mesaAbierta(sabotaje=false){
 for(const secreto of [false,true]){
  const p={id:'campana-conservar',lider:'fender',etapa:2,personaje:{nombre:'Ari'}};const antes=structuredClone(p),acciones=[],partidas=[];
  let mesa=!secreto,cinematica=secreto,board=false,autorizado=false,guardados=0,leidos=0;
  const c=vm.createContext({iniciado:true,pendiente:null,campanaLanzando:false,permitido:()=>autorizado,
   document:{querySelector(selector){if(selector==='#campanaPanel[open],#campanaSecreto[open]')return mesa||cinematica;return board||mesa;}},
   G:{over:false},campanaCerrar(){mesa=false;acciones.push('cerrar mesa');},cerrarCinematica(){cinematica=false;acciones.push('cerrar escena');},showScreen(id){board=false;acciones.push(id);},
   abrir(){acciones.push('login');},campanaLeer(){leidos++;return p;},NET:{on:false},CAMPANA_RIVALES:[null,null,{lider:'adreida',alma:24}],LEADERS:{adreida:{n:'Adreida'}},
   campanaAcercarMapa:async()=>true,campanaNombre:()=>p.personaje.nombre,campanaGuardar(){guardados++;},startMatch:async(...args)=>partidas.push(args)});
  let guardia=funcion(fuentes['cuenta-juego.js'],'requerir');
  if(sabotaje){const alterado=guardia.replace(/\n\s*if\(iniciado&&document\.querySelector\('#campanaPanel\[open\],#campanaSecreto\[open\]'\)\)\{[\s\S]*?\n\s*\}/,'');assert.notEqual(alterado,guardia);guardia=alterado;}
  vm.runInContext(expresion(fuentes['cuenta-juego.js'],/^\s*const menuSeguro=/gm,'menú seguro')+'\n'+guardia+'\n'+funcion(fuentes['final-core.js'],'campanaCombatir'),c);
  c.window={CAOZ_CUENTA_JUEGO:{requerir:c.requerir}};await c.campanaCombatir();
  assert.deepEqual(acciones,['cerrar mesa','cerrar escena','menu','login'],'Desde la mesa o el Editor debe abrir la autenticación sin quedar atrapado');
  assert.deepEqual(p,antes);assert.equal(guardados,0);assert.equal(leidos,0);assert.equal(c.campanaLanzando,false);assert.equal(partidas.length,0);
  autorizado=true;await c.pendiente();assert.equal(partidas.length,1);assert.equal(partidas[0][0],'fender');assert.equal(partidas[0][1],'adreida');
  assert.equal(partidas[0][2].campana.id,antes.id);assert.equal(partidas[0][2].campana.etapa,antes.etapa);assert.equal(p.enEncuentro,true);assert.equal(guardados,1);assert.equal(c.campanaLanzando,false);
 }
}
await prueba('Sesión caducada sobre la mesa o el Editor abre login antes de mutar el combate',()=>mesaAbierta());
function premios(sabotaje=false){
 const listeners=new Map();let entregados=0,leidos=0,permitido=false;
 const c=vm.createContext({window:{CAOZ_CUENTA_JUEGO:{puedeJugar:()=>permitido}},URLSearchParams,location:{search:''},
  addEventListener:(n,fn)=>listeners.set(n,fn),campanaLeer:()=>{leidos++;return {id:'terminada'};},campanaEntregarSobre:()=>entregados++});
 let load=expresion(fuentes['final-core.js'],/^addEventListener\('load',/gm,'recuperación al cargar');
 if(sabotaje){const nuevo=load.replace('if(window.CAOZ_CUENTA_JUEGO?.puedeJugar())','');assert.notEqual(nuevo,load);load=nuevo;}
 vm.runInContext(load+'\n'+expresion(fuentes['final-core.js'],/^addEventListener\('caoz:cuenta-lista',/gm,'cuenta lista'),c);
 listeners.get('load')();assert.equal(entregados,0,'Cargar no concede premios antes de conocer la cuenta');assert.equal(leidos,0,'Tampoco recupera inventario de un propietario desconocido');
 permitido=true;listeners.get('caoz:cuenta-lista')();assert.equal(entregados,1);assert.equal(leidos,1);
}
await prueba('Los premios al cargar esperan la cuenta lista',()=>premios());
await prueba('La cuenta lista se anuncia una sola vez por identidad y después del permiso',()=>{
 const eventos=[];let autorizado=false,id='A';
 const c=vm.createContext({permitido:()=>autorizado,pruebas:()=>false,acceso:{estado:()=>({sesion:{id}})},notificada:'',
  CustomEvent:class{constructor(type,opciones){this.type=type;this.detail=opciones.detail;}},global:{dispatchEvent:e=>eventos.push(e)}});
 vm.runInContext(funcion(fuentes['cuenta-juego.js'],'notificar'),c);c.notificar();assert.equal(eventos.length,0);
 autorizado=true;c.notificar();c.notificar();assert.equal(eventos.length,1);assert.equal(eventos[0].type,'caoz:cuenta-lista');assert.equal(eventos[0].detail.cuentaId,'A');
 id='B';c.notificar();assert.equal(eventos.length,2);assert.equal(eventos[1].detail.cuentaId,'B');
});
if(process.argv.includes('--sabotaje')){
 for(const entrada of entradas)await prueba('Sabotaje detectado: '+entrada.archivo+' '+entrada.nombre,async()=>{
  const f=prepararEntrada(entrada,{sabotaje:true});await assert.rejects(async()=>{await f.ejecutar();assert.equal(f.ver().efectos,0);});assert.equal(f.ver().efectos,1);
 });
 await prueba('Sabotaje detectado: invitación consumida antes del correo',async()=>{await assert.rejects(()=>comprobarInvitacion(true),/invitación permanece/);});
 await prueba('Sabotaje detectado: premio entregado al visitante desconocido',()=>{assert.throws(()=>premios(true),/Cargar no concede premios/);});
 await prueba('Sabotaje detectado: la mesa abierta impide reautenticar',async()=>{await assert.rejects(()=>mesaAbierta(true),/sin quedar atrapado/);});
 await prueba('Sabotaje detectado: la foto consulta jugadores antes del acceso',async()=>{await assert.rejects(()=>comprobarFoto(true),/Partida aún no iniciada/);});
}
console.log(total+' comprobaciones acotadas de entradas reales en verde. Sin iniciar partidas ni servicios.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let fuentes=['cuenta-progreso.js','cuenta-servicio.js'].map(p=>fs.readFileSync(new URL(p,import.meta.url),'utf8')).join('\n');
const mutantes={
  salida:['salidaPendiente=id;','salidaPendiente=null;'],
  reintento:['const enviado=copia(c.pendiente),r=await servicio.guardarRemoto(enviado);','const enviado=copia(c.pendiente);enviado.operacion=global.crypto.randomUUID();const r=await servicio.guardarRemoto(enviado);'],
  propietario:["...(['progreso','salir'].includes(ruta)&&actual?{'X-Caoz-Cuenta':actual.id}:{})",'...{}'],
};
if(process.env.CAOZ_SABOTAJE_SERVICIO){const [antes,despues]=mutantes[process.env.CAOZ_SABOTAJE_SERVICIO];assert.ok(fuentes.includes(antes));fuentes=fuentes.replace(antes,despues);}
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',plano=v=>JSON.parse(JSON.stringify(v));
class Almacen {
  constructor(){this.m=new Map();this.fallar=()=>false;}
  getItem(k){return this.m.get(k)??null;}
  setItem(k,v){if(this.fallar(k,'set'))throw Error('Cuota');this.m.set(k,String(v));}
  removeItem(k){if(this.fallar(k,'remove'))throw Error('Cuota');this.m.delete(k);}
}
function ejemplo(n=1){return {formato:'caoz.progreso',version:1,entorno:'produccion',datos:{campana:{version:1,id:'campana1',lider:'fender',etapa:n},borrador:null,logros:null,coleccion:{version:1,sobres:n,revision:n,pendiente:{id:'sobre1',cartas:[{id:'tal',acabado:'foil'}]},cantidades:{tal:{foil:0,dorado:1}}},premiosDomo:['domo1'],records:null,nombre:'Ari'}};}
function servidor(){
  const s={usuario:{id:A,nombre:'Ari',correo:'ari@ejemplo.com'},progreso:ejemplo(),revision:1,offline:false,perder:false,escrituras:0,llamadas:[],operaciones:new Map(),pausa:null};
  const responder=(status,datos)=>({ok:status>=200&&status<300,status,json:async()=>plano(datos)});
  s.fetch=async(url,op)=>{
    const datos=op.body?JSON.parse(op.body):null,ruta=url.split('?')[0].split('/').at(-1);s.llamadas.push({url,op:{...op,signal:undefined},datos});
    if(s.offline)throw TypeError('Sin red');
    if(ruta==='codigo')return responder(200,{id:webcrypto.randomUUID(),vence:Date.now()+300000,reenvioEn:Date.now()+60000});
    if(ruta==='sesion'||ruta==='verificar')return responder(200,{sesion:s.usuario,progreso:s.usuario?s.progreso:null,revision:s.usuario?s.revision:0});
    if(!s.usuario||op.headers['X-Caoz-Cuenta']!==s.usuario.id)return responder(401,{codigo:'SESION'});
    if(ruta==='salir'){s.usuario=null;return responder(200,{ok:true});}
    if(ruta==='progreso'){
      if(s.pausa){const p=s.pausa;s.pausa=null;await p;}
      const clave=s.usuario.id+':'+datos.operacion,previo=s.operaciones.get(clave);
      if(previo){if(previo.solicitud!==JSON.stringify(datos))return responder(409,{codigo:'OPERACION'});return responder(200,previo.resultado);}
      if(datos.revision!==s.revision)return responder(409,{codigo:'CONFLICTO',progreso:s.progreso,revision:s.revision});
      s.progreso=plano(datos.origen==='nube'?s.progreso:datos.progreso);s.revision++;s.escrituras++;
      const resultado={progreso:s.progreso,revision:s.revision};s.operaciones.set(clave,{solicitud:JSON.stringify(datos),resultado:plano(resultado)});
      if(s.perder){s.perder=false;throw TypeError('Se perdió el acuse después de guardar');}
      return responder(200,resultado);
    }
    return responder(404,{codigo:'RUTA'});
  };return s;
}
function cliente({s=servidor(),storage=new Almacen()}={}){
  const eventos=new EventTarget(),ctx=vm.createContext({crypto:webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,CustomEvent});vm.runInContext(fuentes,ctx);
  const api=ctx.CAOZ_CUENTA_PROGRESO,p=api.crear({storage,entorno:'produccion',ruta:'/',eventos,intervalo:0}),servicio=ctx.CAOZ_CUENTA_SERVICIO.crear({progreso:p,storage,fetch:s.fetch});
  const sync=ctx.CAOZ_CUENTA_SERVICIO.sincronizador({servicio,progreso:p,storage,eventos,retraso:100000000,reintento:0});
  return {s,storage,p,servicio,sync,api,cerrar(){sync.destruir();p.destruir();}};
}
async function vincular(c){const r=await c.servicio.sesion();c.p.aplicar(r.progreso,{cuentaId:r.sesion.id,revision:r.revision});c.sync.vincular(r);return r;}
function cambiar(c,n){const s=ejemplo(n);c.storage.setItem('caoz.campana.v1',JSON.stringify(s.datos.campana));c.storage.setItem('caoz.coleccion.v1.produccion.raiz',JSON.stringify(s.datos.coleccion));}
let total=0;async function prueba(nombre,fn){const c=cliente();try{await fn(c);total++;console.log('✓ '+nombre);}finally{c.cerrar();}}
await prueba('Correo y código viajan sólo por POST de mismo origen, sin caché ni almacenamiento',async c=>{await c.servicio.solicitarCodigo({correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'});await c.servicio.verificarCodigo({solicitud:'desafio',codigo:'123456'});for(const {url,op}of c.s.llamadas){assert.match(url,/^\/api\/cuenta\//);assert.equal(url.includes('ari'),false);assert.equal(op.credentials,'same-origin');assert.equal(op.cache,'no-store');assert.equal(op.method,'POST');}assert.equal([...c.storage.m.values()].some(v=>v.includes('123456')),false);});
await prueba('Consultar sesión no aplica progreso ni toca datos de una cuenta ajena',async c=>{c.p.aplicar(ejemplo(4),{cuentaId:A,revision:7});c.s.usuario={id:B,nombre:'Beto',correo:'b@ejemplo.com'};const antes=[...c.storage.m],r=await c.servicio.sesion();assert.equal(r.requiereAislar,true);assert.equal(r.localDisponible,null);assert.deepEqual([...c.storage.m],antes);});
await prueba('Un progreso sólo se aplica después de la confirmación remota',async c=>{await c.servicio.sesion();c.p.aplicar(ejemplo(),{cuentaId:A,revision:1});const solicitud={origen:'local',operacion:webcrypto.randomUUID(),revision:1,progreso:ejemplo(4),respaldoLocal:ejemplo()};c.s.offline=true;await assert.rejects(c.servicio.vincularProgreso(solicitud),{codigo:'SIN_CONEXION'});assert.equal(c.p.capturar().datos.coleccion.sobres,1);c.s.offline=false;await c.servicio.vincularProgreso(solicitud);assert.equal(c.p.capturar().datos.coleccion.sobres,4);});
await prueba('Fallo local tras acuse reintenta la misma operación sin duplicar la importación',async c=>{await c.servicio.sesion();c.p.aplicar(ejemplo(),{cuentaId:A,revision:1});const solicitud={origen:'local',operacion:webcrypto.randomUUID(),revision:1,progreso:ejemplo(5),respaldoLocal:ejemplo()};let una=true;c.storage.fallar=k=>k.endsWith('.respaldos')&&una&&(una=false,true);await assert.rejects(c.servicio.vincularProgreso(solicitud),{codigo:'ALMACENAMIENTO'});assert.equal(c.p.capturar().datos.coleccion.sobres,1);await c.servicio.vincularProgreso(solicitud);assert.equal(c.s.escrituras,1);assert.equal(c.p.capturar().datos.coleccion.sobres,5);});
await prueba('No se encola ni sube un invitado antes del consentimiento de vinculación',async c=>{await c.servicio.sesion();c.storage.setItem('caoz_nombre','Invitado');assert.equal(c.sync.vincular({sesion:c.s.usuario,revision:1,progreso:c.s.progreso}),false);assert.equal(await c.sync.guardar(),false);assert.equal(c.s.escrituras,0);assert.equal([...c.storage.m.keys()].some(k=>k.includes('.cola.')),false);});
await prueba('El envío normal conserva snapshot exacto y consume una revisión CAS',async c=>{await vincular(c);cambiar(c,2);assert.equal(await c.sync.guardar(),true);assert.equal(c.s.escrituras,1);assert.deepEqual(c.s.progreso,ejemplo(2));assert.equal(c.p.vinculado().revision,2);assert.equal(c.sync.estado().guardado,'guardado');assert.equal(c.s.llamadas.at(-1).op.headers['X-Caoz-Cuenta'],A);});
await prueba('Sin red persiste la operación y reintenta UUID y payload idénticos',async c=>{await vincular(c);cambiar(c,2);c.s.offline=true;assert.equal(await c.sync.guardar(),false);const antes=JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente;assert.equal(c.sync.estado().guardado,'sinConexion');c.s.offline=false;assert.equal(await c.sync.guardar(),true);const despues=c.s.llamadas.filter(x=>x.url.includes('/progreso?')).at(-1).datos;assert.deepEqual(despues,antes);assert.equal(c.s.escrituras,1);});
await prueba('Acuse perdido después del commit no vuelve a entregar cartas ni sobres',async c=>{await vincular(c);cambiar(c,3);c.s.perder=true;assert.equal(await c.sync.guardar(),false);assert.equal(c.s.escrituras,1);const op=JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente.operacion;assert.equal(await c.sync.guardar(),true);assert.equal(c.s.escrituras,1);assert.equal(c.s.llamadas.at(-1).datos.operacion,op);assert.equal(c.p.vinculado().revision,2);});
await prueba('Recargar tras perder el acuse recupera la misma operación en lugar de pedir una importación',async c=>{await vincular(c);cambiar(c,3);c.s.perder=true;await c.sync.guardar();c.sync.desvincular();const otro=cliente({s:c.s,storage:c.storage});try{const r=await otro.servicio.sesion();assert.equal(r.vinculado,true);assert.equal(otro.sync.vincular(r),true);assert.equal(await otro.sync.guardar(),true);assert.equal(c.s.escrituras,1);assert.equal(otro.p.vinculado().revision,2);}finally{otro.cerrar();}});
await prueba('Una escritura de cola fallida impide llamar al servidor',async c=>{await vincular(c);cambiar(c,3);c.storage.fallar=k=>k.includes('.cola.');assert.equal(await c.sync.guardar(),false);assert.equal(c.s.escrituras,0);assert.equal(c.sync.estado().guardado,'pendiente');assert.equal(c.p.capturar().datos.coleccion.sobres,3);});
await prueba('Un fallo persistiendo el acuse conserva el pendiente y reintenta sin duplicar',async c=>{await vincular(c);cambiar(c,3);let cola=0;c.storage.fallar=k=>k.includes('.cola.')&&++cola===2;assert.equal(await c.sync.guardar(),false);assert.equal(c.s.escrituras,1);assert.ok(JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente);assert.equal(await c.sync.guardar(),true);assert.equal(c.s.escrituras,1);});
await prueba('Cambios durante una petición conservan el primero y luego guardan el nuevo completo',async c=>{await vincular(c);cambiar(c,2);let soltar;c.s.pausa=new Promise(r=>soltar=r);const primero=c.sync.guardar();await Promise.resolve();cambiar(c,3);assert.equal(await c.sync.guardar(),false);soltar();assert.equal(await primero,true);assert.equal(c.s.progreso.datos.coleccion.sobres,2);assert.equal(c.p.capturar().datos.coleccion.sobres,3);assert.equal(await c.sync.guardar(),true);assert.equal(c.s.escrituras,2);assert.equal(c.s.progreso.datos.coleccion.sobres,3);});
await prueba('Un conflicto entre dispositivos conserva ambas copias y detiene los reintentos',async c=>{await vincular(c);cambiar(c,2);c.s.progreso=ejemplo(5);c.s.revision=2;assert.equal(await c.sync.guardar(),false);assert.equal(c.sync.estado().guardado,'conflicto');assert.equal(c.sync.estado().conflicto.progreso.datos.coleccion.sobres,5);assert.equal(c.p.capturar().datos.coleccion.sobres,2);const llamadas=c.s.llamadas.length;assert.equal(await c.sync.guardar(),false);assert.equal(c.s.llamadas.length,llamadas);});
await prueba('Volver a la pestaña detecta nube nueva incluso si el usuario no cambió nada',async c=>{await vincular(c);c.s.progreso=ejemplo(5);c.s.revision=2;assert.equal(await c.sync.verificar(),false);assert.equal(c.sync.estado().guardado,'conflicto');assert.equal(c.p.capturar().datos.coleccion.sobres,1);assert.equal(c.s.escrituras,0);});
await prueba('Cerrar sesión sin red conserva cuenta y progreso; confirmado archiva y vacía invitado',async c=>{await vincular(c);cambiar(c,3);c.s.offline=true;await assert.rejects(c.servicio.cerrarSesion(),{codigo:'SIN_CONEXION'});assert.equal(c.p.vinculado().cuentaId,A);assert.equal(c.servicio.identidad().id,A);c.s.offline=false;await c.servicio.cerrarSesion();assert.equal(c.p.capturar(),null);assert.equal(c.servicio.identidad(),null);assert.equal(c.p.archivo(A).snapshot.datos.coleccion.sobres,3);});
await prueba('Al volver a la misma cuenta se ofrece su copia archivada sin importarla automáticamente',async c=>{await vincular(c);cambiar(c,3);await c.servicio.cerrarSesion();c.sync.desvincular();c.s.usuario={id:A,nombre:'Ari',correo:'ari@ejemplo.com'};const r=await c.servicio.sesion();assert.equal(r.localDisponible.datos.coleccion.sobres,3);assert.equal(c.p.capturar(),null);assert.equal(r.vinculado,false);});
await prueba('Una cookie cambiada en otra pestaña nunca guarda la cola de A en la cuenta B',async c=>{await vincular(c);cambiar(c,3);c.s.usuario={id:B,nombre:'Beto',correo:'b@ejemplo.com'};assert.equal(await c.sync.guardar(),false);assert.equal(c.sync.estado().guardado,'sesion');assert.equal(c.s.escrituras,0);assert.equal(c.p.capturar().datos.coleccion.sobres,3);});
await prueba('Un reset explícito envía un snapshot vacío sólo si ya existe vínculo',async c=>{await vincular(c);for(const k of [...c.storage.m.keys()])if(!k.startsWith('caoz.cuenta.'))c.storage.removeItem(k);assert.equal(await c.sync.guardar(),true);assert.deepEqual(c.s.progreso,plano(c.api.vacio('produccion')));assert.equal(c.p.vinculado().revision,2);});
await prueba('Pausar la sincronización no borra vínculo, cola ni progreso',async c=>{await vincular(c);cambiar(c,3);c.s.offline=true;await c.sync.guardar();const antes=[...c.storage.m];c.sync.desvincular();assert.deepEqual([...c.storage.m],antes);assert.equal(c.p.vinculado().cuentaId,A);});
await prueba('Una respuesta tardía después de pausar no cambia el progreso de otra cuenta',async c=>{await vincular(c);cambiar(c,3);let soltar;c.s.pausa=new Promise(r=>soltar=r);const promesa=c.sync.guardar();await Promise.resolve();c.sync.desvincular();c.p.aplicar(ejemplo(4),{cuentaId:B,revision:7});soltar();assert.equal(await promesa,false);assert.equal(c.p.vinculado().cuentaId,B);assert.equal(c.p.vinculado().revision,7);assert.equal(c.p.capturar().datos.coleccion.sobres,4);});
await prueba('Salir reintenta el archivo local tras revocar la cookie sin otra petición autenticada',async c=>{await vincular(c);cambiar(c,3);let una=true;c.storage.fallar=k=>k.includes('.archivo.')&&una&&(una=false,true);await assert.rejects(c.servicio.cerrarSesion(),{codigo:'ALMACENAMIENTO'});assert.equal(c.s.usuario,null);assert.equal(c.p.vinculado().cuentaId,A);await c.servicio.cerrarSesion();assert.equal(c.p.vinculado(),null);assert.equal(c.p.capturar(),null);assert.equal(c.p.archivo(A).snapshot.datos.coleccion.sobres,3);assert.equal(c.s.llamadas.filter(x=>x.url.includes('/salir?')).length,1);});
await prueba('Las URLs evitan también la caché de una PWA254 que aún no actualizó su SW',async c=>{await vincular(c);cambiar(c,2);await c.sync.guardar();assert.ok(c.s.llamadas.every(x=>new URL(x.url,'https://juego.caozcontodo.com').search.includes('test=')));});
await prueba('Ni el deseo ni un respaldo con texto privado llegan siquiera a la red',async c=>{await c.servicio.sesion();const p=ejemplo();p.datos.campana.deseo={texto:'Privado'};const antes=c.s.llamadas.length;await assert.rejects(c.servicio.guardarRemoto({origen:'local',operacion:webcrypto.randomUUID(),revision:1,progreso:ejemplo(),respaldoLocal:p}),{codigo:'PROGRESO_PRIVADO'});assert.equal(c.s.llamadas.length,antes);});
console.log(`${total} pruebas del servicio y la sincronización aprobadas.`);
if(process.argv.includes('--sabotaje')&&!process.env.CAOZ_SABOTAJE_SERVICIO){
  for(const nombre of Object.keys(mutantes)){const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,CAOZ_SABOTAJE_SERVICIO:nombre},encoding:'utf8'});
    assert.notEqual(r.status,0,'El sabotaje '+nombre+' debe romper una regresión');assert.match(r.stderr,/AssertionError|SESION/);console.log('✓ Sabotaje detectado: '+nombre);}
}

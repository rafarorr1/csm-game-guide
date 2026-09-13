import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let fuentes=['cuenta-progreso.js','cuenta-servicio.js'].map(p=>fs.readFileSync(new URL(p,import.meta.url),'utf8')).join('\n');
const mutantes={
  visitante:["if(e.codigo==='SESION'&&!conocida)return","if(false)return"],
  salida:['salidaPendiente=id;','salidaPendiente=null;'],
  reintento:['const enviado=copia(c.pendiente),r=await servicio.guardarRemoto(enviado);','const enviado=copia(c.pendiente);enviado.operacion=global.crypto.randomUUID();const r=await servicio.guardarRemoto(enviado);'],
  revocacion:["if(respuesta.status===401){revocarAcceso(idPeticion);", "if(respuesta.status===401){"],
  recibo:["if(accesoRevocado||salidaPendiente)return null;","if(accesoRevocado||salidaPendiente)return null;return null;"],
  sesionTardia:["const r=await pedir('sesion');if(turno!==generacionAcceso)throw fallo('SESION');", "const r=await pedir('sesion');"],
  archivoDisponible:["actual&&(ajena||!vinculo&&!progreso.capturar())", "actual&&!vinculo&&!progreso.capturar()"],
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
    if(ruta==='sesion'&&!s.usuario)return responder(401,{codigo:'SESION'});
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
function cliente({s=servidor(),storage=new Almacen(),entorno='produccion',ruta='/'}={}){
  const eventos=new EventTarget(),ctx=vm.createContext({crypto:webcrypto,TextEncoder,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,CustomEvent});vm.runInContext(fuentes,ctx);
  const api=ctx.CAOZ_CUENTA_PROGRESO,p=api.crear({storage,entorno,ruta,eventos,intervalo:0}),servicio=ctx.CAOZ_CUENTA_SERVICIO.crear({progreso:p,storage,fetch:s.fetch});
  const sync=ctx.CAOZ_CUENTA_SERVICIO.sincronizador({servicio,progreso:p,storage,eventos,retraso:100000000,reintento:0});
  return {s,storage,p,servicio,sync,api,eventos,cerrar(){sync.destruir();p.destruir();}};
}
const sinRecibos=c=>[...c.storage.m].filter(([k])=>!k.includes('.acceso.'));
const claveAcceso=(c,id=A)=>c.p.claveCola(id).replace('.cola.','.acceso.');
async function vincular(c){const r=await c.servicio.sesion();c.p.aplicar(r.progreso,{cuentaId:r.sesion.id,revision:r.revision});c.sync.vincular(r);return r;}
function cambiar(c,n){const s=ejemplo(n);c.storage.setItem('caoz.campana.v1',JSON.stringify(s.datos.campana));c.storage.setItem('caoz.coleccion.v1.produccion.raiz',JSON.stringify(s.datos.coleccion));}
let total=0;async function prueba(nombre,fn){const c=cliente();try{await fn(c);total++;console.log('✓ '+nombre);}finally{c.cerrar();}}
await prueba('Correo y código viajan por POST sin caché y el código no se almacena',async c=>{await c.servicio.solicitarCodigo({correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'});await c.servicio.verificarCodigo({solicitud:'desafio',codigo:'123456'});for(const {url,op}of c.s.llamadas){assert.match(url,/^\/api\/cuenta\//);assert.equal(url.includes('ari'),false);assert.equal(op.credentials,'same-origin');assert.equal(op.cache,'no-store');assert.equal(op.method,'POST');}assert.equal([...c.storage.m.values()].some(v=>v.includes('123456')),false);});
await prueba('Consultar sesión no aplica progreso ni toca datos de una cuenta ajena',async c=>{c.p.aplicar(ejemplo(4),{cuentaId:A,revision:7});c.s.usuario={id:B,nombre:'Beto',correo:'b@ejemplo.com'};const antes=sinRecibos(c),r=await c.servicio.sesion();assert.equal(r.requiereAislar,true);assert.equal(r.localDisponible,null);assert.deepEqual(sinRecibos(c),antes);});
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
await prueba('Un visitante sin cuenta recibe estado anónimo del401 sin escribir datos',async c=>{c.s.usuario=null;const antes=[...c.storage.m],r=await c.servicio.sesion();assert.equal(r.sesion,null);assert.equal(r.vinculado,false);assert.equal(c.servicio.identidad(),null);assert.deepEqual([...c.storage.m],antes);});
await prueba('El401 del invitado conserva íntegro su progreso sin crear un vínculo',async c=>{c.s.usuario=null;c.storage.setItem('caoz_nombre','Invitado');c.storage.setItem('caoz.campana.v1',JSON.stringify(ejemplo(4).datos.campana));const antes=[...c.storage.m],r=await c.servicio.sesion();assert.equal(r.sesion,null);assert.deepEqual([...c.storage.m],antes);assert.equal(c.p.vinculado(),null);assert.equal(c.p.capturar().datos.campana.etapa,4);});
await prueba('La sesión conocida que caduca sigue rechazando401 sin tocar el avance',async c=>{await c.servicio.sesion();c.storage.setItem('caoz_nombre','Ari');c.s.usuario=null;const antes=sinRecibos(c);await assert.rejects(c.servicio.sesion(),{codigo:'SESION'});assert.deepEqual(sinRecibos(c),antes);});
await prueba('Tras recargar, un vínculo previo conserva el aviso de caducidad y los datos',async c=>{c.p.aplicar(ejemplo(4),{cuentaId:A,revision:3});c.s.usuario=null;const antes=sinRecibos(c);await assert.rejects(c.servicio.sesion(),{codigo:'SESION'});assert.deepEqual(sinRecibos(c),antes);assert.equal(c.p.vinculado().cuentaId,A);});
await prueba('Una caída de red al consultar al invitado sigue siendo un error de conexión',async c=>{c.s.usuario=null;c.s.offline=true;await assert.rejects(c.servicio.sesion(),{codigo:'SIN_CONEXION'});assert.equal(c.p.vinculado(),null);});
await prueba('El recibo offline guarda sólo identidad pública, separado de respuesta, progreso y secretos',async c=>{
  c.s.usuario.token='secreto-no-persistir';await vincular(c);
  const recibo=JSON.parse(c.storage.getItem(claveAcceso(c)));
  assert.deepEqual(recibo,{version:1,entorno:'produccion',cuenta:{id:A,nombre:'Ari',correo:'ari@ejemplo.com'}});
  assert.equal([...c.storage.m.values()].some(v=>v.includes('secreto-no-persistir')),false);
});
await prueba('Recargar sin internet restaura el propietario y la base sin sobrescribir avances locales',async c=>{
  await vincular(c);cambiar(c,3);c.s.offline=true;c.sync.desvincular();
  const otro=cliente({s:c.s,storage:c.storage});try{
    const antes=sinRecibos(c),r=await otro.servicio.sesion();
    assert.equal(r.sinConexion,true);assert.equal(r.guardado,'sinConexion');assert.equal(r.vinculado,true);
    assert.equal(r.sesion.id,A);assert.equal(r.revision,1);assert.deepEqual(plano(r.progreso),ejemplo());
    assert.deepEqual(plano(r.localDisponible),ejemplo(3));assert.deepEqual(sinRecibos(c),antes);
    assert.equal(otro.servicio.sinConexion(),true);assert.equal(otro.sync.vincular(r),true);
    assert.equal(otro.sync.estado().guardado,'sinConexion');await otro.sync.guardar();
    assert.deepEqual(JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente.progreso,ejemplo(3));
  }finally{otro.cerrar();}
});
await prueba('Un vínculo sin acceso verificado no habilita el juego offline',async c=>{
  c.p.aplicar(ejemplo(),{cuentaId:A,revision:1});c.s.offline=true;
  await assert.rejects(c.servicio.sesion(),{codigo:'SIN_CONEXION'});assert.equal(c.servicio.identidad(),null);
});
await prueba('Un recibo de producción o de otro propietario nunca habilita la beta',async c=>{
  await vincular(c);c.s.offline=true;
  const beta=cliente({s:c.s,storage:c.storage,entorno:'beta'});try{
    const p=ejemplo();p.entorno='beta';beta.p.aplicar(p,{cuentaId:A,revision:1});
    await assert.rejects(beta.servicio.sesion(),{codigo:'SIN_CONEXION'});
    const ajeno=JSON.parse(c.storage.getItem(claveAcceso(c)));ajeno.entorno='beta';ajeno.cuenta.id=B;
    c.storage.setItem(claveAcceso(beta),JSON.stringify(ajeno));
    await assert.rejects(beta.servicio.sesion(),{codigo:'SIN_CONEXION'});
  }finally{beta.cerrar();}
});
await prueba('La cola sobrevive dos recargas y conserva el primer payload antes de guardar avances posteriores',async c=>{
  await vincular(c);cambiar(c,2);c.s.offline=true;await c.sync.guardar();
  const primero=JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente;c.sync.desvincular();
  const otro=cliente({s:c.s,storage:c.storage});try{
    otro.sync.vincular(await otro.servicio.sesion());cambiar(otro,4);await otro.sync.guardar();
    assert.deepEqual(JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente,primero);
  }finally{otro.cerrar();}
  const ultimo=cliente({s:c.s,storage:c.storage});try{
    ultimo.sync.vincular(await ultimo.servicio.sesion());c.s.offline=false;
    assert.equal(await ultimo.sync.verificar(),true);assert.deepEqual(c.s.progreso,ejemplo(2));
    assert.deepEqual(c.s.llamadas.filter(x=>x.url.includes('/progreso?')).at(-1).datos,primero);
    assert.deepEqual(plano(ultimo.p.capturar()),ejemplo(4));assert.equal(ultimo.sync.estado().guardado,'pendiente');
    assert.equal(await ultimo.sync.guardar(),true);assert.deepEqual(c.s.progreso,ejemplo(4));
    assert.equal(c.s.escrituras,2);assert.equal(ultimo.sync.estado().guardado,'guardado');assert.equal(ultimo.servicio.sinConexion(),false);
  }finally{ultimo.cerrar();}
});
await prueba('Un acuse perdido seguido de arranque offline se recupera con el mismo UUID y sin duplicar premios',async c=>{
  await vincular(c);cambiar(c,2);c.s.perder=true;await c.sync.guardar();c.sync.desvincular();
  const primero=JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente;c.s.offline=true;
  const otro=cliente({s:c.s,storage:c.storage});try{
    otro.sync.vincular(await otro.servicio.sesion());cambiar(otro,4);await otro.sync.guardar();c.s.offline=false;
    const real=await otro.servicio.sesion();assert.equal(real.vinculado,true);assert.equal(real.guardado,'pendiente');
    assert.equal(await otro.sync.verificar(),true);assert.equal(c.s.escrituras,1);
    assert.deepEqual(c.s.llamadas.filter(x=>x.url.includes('/progreso?')).at(-1).datos,primero);
    assert.equal(await otro.sync.guardar(),true);assert.equal(c.s.escrituras,2);assert.deepEqual(c.s.progreso,ejemplo(4));
  }finally{otro.cerrar();}
});
await prueba('Un401 revoca el acceso offline tras recargar y conserva toda la cola para reautenticarse',async c=>{
  await vincular(c);cambiar(c,3);c.s.offline=true;await c.sync.guardar();const antes=sinRecibos(c);
  c.s.offline=false;c.s.usuario=null;assert.equal(await c.sync.verificar(),false);
  assert.equal(c.sync.estado().guardado,'sesion');assert.equal(c.storage.getItem(claveAcceso(c)),null);
  assert.deepEqual(sinRecibos(c),antes);c.sync.desvincular();c.s.offline=true;
  const otro=cliente({s:c.s,storage:c.storage});try{
    await assert.rejects(otro.servicio.sesion(),{codigo:'SIN_CONEXION'});assert.equal(otro.servicio.identidad(),null);
    c.s.offline=false;c.s.usuario={id:A,nombre:'Ari',correo:'ari@ejemplo.com'};
    const r=await otro.servicio.verificarCodigo({solicitud:'desafio',codigo:'123456'});
    assert.equal(r.vinculado,true);assert.equal(r.guardado,'pendiente');assert.deepEqual(sinRecibos(c),antes);
    otro.sync.vincular(r);assert.equal(await otro.sync.guardar(),true);assert.deepEqual(c.s.progreso,ejemplo(3));
  }finally{otro.cerrar();}
});
await prueba('Un401 sin JSON también revoca el acceso previamente verificado',async c=>{
  await vincular(c);
  const otro=cliente({storage:c.storage,s:{fetch:async()=>({ok:false,status:401,json:async()=>{throw Error('HTML');}})}});
  try{await assert.rejects(otro.servicio.sesion(),{codigo:'SESION'});assert.equal(c.storage.getItem(claveAcceso(c)),null);}
  finally{otro.cerrar();}
});
await prueba('El cambio de cookie a B invalida el acceso offline de A antes de elegir o importar',async c=>{
  await vincular(c);cambiar(c,3);c.s.usuario={id:B,nombre:'Beto',correo:'b@ejemplo.com'};
  const r=await c.servicio.sesion();assert.equal(r.requiereAislar,true);assert.equal(c.storage.getItem(claveAcceso(c)),null);
  assert.equal(c.p.vinculado().cuentaId,A);c.s.offline=true;await assert.rejects(c.servicio.sesion(),{codigo:'SIN_CONEXION'});
  const otro=cliente({s:c.s,storage:c.storage});try{await assert.rejects(otro.servicio.sesion(),{codigo:'SIN_CONEXION'});}finally{otro.cerrar();}
});
await prueba('Cerrar sesión elimina el recibo incluso si el archivo local requiere reintento',async c=>{
  await vincular(c);let una=true;c.storage.fallar=k=>k.includes('.archivo.')&&una&&(una=false,true);
  await assert.rejects(c.servicio.cerrarSesion(),{codigo:'ALMACENAMIENTO'});
  assert.equal(c.storage.getItem(claveAcceso(c)),null);c.s.offline=true;
  const otro=cliente({s:c.s,storage:c.storage});try{await assert.rejects(otro.servicio.sesion(),{codigo:'SIN_CONEXION'});}finally{otro.cerrar();}
  c.s.offline=false;await c.servicio.cerrarSesion();assert.equal(c.p.vinculado(),null);
});
await prueba('Volver online con progreso remoto distinto muestra conflicto y no suma inventarios',async c=>{
  await vincular(c);cambiar(c,3);c.s.offline=true;await c.sync.guardar();c.sync.desvincular();
  const otro=cliente({s:c.s,storage:c.storage});try{
    otro.sync.vincular(await otro.servicio.sesion());c.s.progreso=ejemplo(5);c.s.revision=2;c.s.offline=false;
    assert.equal(await otro.sync.verificar(),false);assert.equal(otro.sync.estado().guardado,'conflicto');
    assert.deepEqual(plano(otro.p.capturar()),ejemplo(3));assert.deepEqual(c.s.progreso,ejemplo(5));assert.equal(c.s.escrituras,0);
    assert.ok(JSON.parse(c.storage.getItem(c.p.claveCola(A))).pendiente);
  }finally{otro.cerrar();}
});
await prueba('Un error HTTP de servicio no se transforma en permiso offline',async c=>{
  await vincular(c);const otro=cliente({storage:c.storage,s:{fetch:async()=>({ok:false,status:503,json:async()=>({codigo:'NO_DISPONIBLE'})})}});
  try{await assert.rejects(otro.servicio.sesion(),{codigo:'NO_DISPONIBLE'});assert.equal(otro.servicio.identidad(),null);}
  finally{otro.cerrar();}
});
await prueba('El evento online reconecta y sincroniza automáticamente la operación pendiente',async c=>{
  await vincular(c);c.s.offline=true;cambiar(c,4);await c.sync.guardar();c.s.offline=false;
  c.eventos.dispatchEvent(new Event('online'));
  for(let i=0;i<30&&c.sync.estado().guardado!=='guardado';i++)await new Promise(r=>setTimeout(r,0));
  assert.equal(c.sync.estado().guardado,'guardado');assert.equal(c.s.escrituras,1);assert.deepEqual(c.s.progreso,ejemplo(4));
});
await prueba('Una consulta de sesión tardía no puede revivir el acceso después de cerrar sesión',async c=>{
  await vincular(c);c.sync.desvincular();let esperar=false,soltar;
  const otro=cliente({storage:c.storage,s:{fetch:async(url,op)=>{
    const r=await c.s.fetch(url,op);if(esperar&&url.includes('/sesion?')){esperar=false;await new Promise(r=>soltar=r);}return r;
  }}});try{
    await otro.servicio.sesion();esperar=true;const consulta=otro.servicio.sesion();
    while(!soltar)await Promise.resolve();await otro.servicio.cerrarSesion();soltar();
    await assert.rejects(consulta,{codigo:'SESION'});assert.equal(otro.servicio.identidad(),null);
    assert.equal(c.storage.getItem(claveAcceso(c)),null);c.s.offline=true;
    await assert.rejects(otro.servicio.sesion(),{codigo:'SIN_CONEXION'});
  }finally{otro.cerrar();}
});
await prueba('El acceso de A ofrece su archivo aunque B esté abierto, sin importar nada automáticamente',async c=>{
  await vincular(c);cambiar(c,4);c.p.aplicar(ejemplo(7),{cuentaId:B,revision:1});
  const antes=sinRecibos(c),r=await c.servicio.sesion();
  assert.equal(r.sesion.id,A);assert.equal(r.requiereAislar,true);assert.equal(r.vinculado,false);
  assert.deepEqual(plano(r.localDisponible),ejemplo(4));assert.deepEqual(sinRecibos(c),antes);
  assert.equal(c.p.capturar().datos.coleccion.sobres,7);
});
console.log(`${total} pruebas del servicio y la sincronización aprobadas.`);
if(process.argv.includes('--sabotaje')&&!process.env.CAOZ_SABOTAJE_SERVICIO){
  for(const nombre of Object.keys(mutantes)){const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,CAOZ_SABOTAJE_SERVICIO:nombre},encoding:'utf8'});
    assert.notEqual(r.status,0,'El sabotaje '+nombre+' debe romper una regresión');assert.match(r.stderr,/AssertionError|SESION|SIN_CONEXION/);console.log('✓ Sabotaje detectado: '+nombre);}
}

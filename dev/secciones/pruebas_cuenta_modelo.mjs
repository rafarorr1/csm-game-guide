/* Regresiones del flujo y contrato temporal; no prueba un backend de autenticación real. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const aqui=path.dirname(fileURLToPath(import.meta.url)),raiz=path.resolve(aqui,'../..');
const contexto=vm.createContext({crypto:webcrypto,Date,setTimeout,clearTimeout});
for(const f of ['caoz_tcg/cuenta-modelo.js','dev/secciones/cuenta-demo.js'])vm.runInContext(fs.readFileSync(path.join(raiz,f),'utf8'),contexto,{filename:f});
const plano=v=>JSON.parse(JSON.stringify(v));
const local={personaje:'Ari',mazo:'Fender',rivales:4,foils:12,doradas:1,sobres:3,snapshot:{pendiente:{id:'cinco',cartas:[1,2,3,4,5]},gastados:['canje-1'],recibos:['victoria-1']}};
const nube={personaje:'Lyra',mazo:'Rafaela',rivales:2,foils:8,doradas:2,sobres:5,snapshot:{pendiente:null,gastados:['canje-2'],recibos:['victoria-2']}};
let total=0;
async function prueba(nombre,fn){await fn();total++;console.log('✓ '+nombre);}
function montar({progresoLocal=local,progresoNube=null,esperar=async()=>{}}={}){
  let ahora=1000000,buzon=null;const reloj=()=>ahora;
  const servicio=contexto.CAOZ_CUENTA_DEMO.crear({reloj,esperar,progresoNube,alCodigo:r=>buzon=r});
  const modelo=contexto.CAOZ_CUENTA_MODELO.crear({reloj,servicio,progresoLocal});
  return {modelo,servicio,codigo:()=>buzon.codigo,avanzar:ms=>ahora+=ms,
    async pedir(){assert(await modelo.solicitar({correo:'viajero@ejemplo.com',nombre:'Ari',intencion:'crear'}));},
    async entrar(){await this.pedir();assert(await modelo.verificar(this.codigo()));}};
}
await prueba('Leer y publicar estados no permite mutar el progreso',async()=>{const f=montar(),s=f.modelo.ver();s.local.foils=999;assert.equal(f.modelo.ver().local.foils,12);assert.equal(local.foils,12);});
await prueba('Valida correo, nombre y código antes de llamar al servicio',async()=>{
 const f=montar();assert.equal(await f.modelo.solicitar({correo:'roto',nombre:'Ari'}),false);assert.equal(await f.modelo.solicitar({correo:'a@ejemplo.com',nombre:'A'}),false);
 await f.pedir();assert.equal(await f.modelo.verificar('12'),false);assert.equal(f.servicio.inspeccionar().cuentas.length,0);
});
await prueba('Crear cuenta exige verificar el código; después propone vincular',async()=>{const f=montar();await f.pedir();assert.equal(f.modelo.ver().pantalla,'codigo');assert.equal(f.servicio.inspeccionar().cuentas.length,0);await f.modelo.verificar(f.codigo());assert.equal(f.modelo.ver().pantalla,'vincular');assert.equal(f.servicio.inspeccionar().cuentas.length,1);});
await prueba('Cinco errores agotan el código y el servicio también aplica el límite',async()=>{
 const f=montar();await f.pedir();for(let i=0;i<5;i++)assert.equal(await f.modelo.verificar('000000'),false);
 assert.match(f.modelo.ver().error,/agotaron/);assert.equal(await f.modelo.verificar(f.codigo()),false);assert.equal(f.servicio.inspeccionar().cuentas.length,0);
});
await prueba('Código vencido rechazado sin crear cuenta',async()=>{const f=montar();await f.pedir();f.avanzar(300000);assert.equal(await f.modelo.verificar(f.codigo()),false);assert.match(f.modelo.ver().error,/caducó/);});
await prueba('Reenvío espera60s, invalida desafío anterior y emite uno nuevo',async()=>{
 const f=montar();await f.pedir();const anterior=f.modelo.ver().desafio.id,codigo=f.codigo();assert.equal(await f.modelo.reenviar(),false);f.avanzar(60000);assert(await f.modelo.reenviar());assert.notEqual(f.modelo.ver().desafio.id,anterior);
 await assert.rejects(f.servicio.verificarCodigo({solicitud:anterior,codigo}),e=>e.codigo==='CADUCADO');assert(await f.modelo.verificar(f.codigo()));
});
await prueba('Código consumido no abre otra sesión al repetirse',async()=>{const f=montar();await f.pedir();const solicitud=f.modelo.ver().desafio.id,codigo=f.codigo();assert(await f.modelo.verificar(codigo));await assert.rejects(f.servicio.verificarCodigo({solicitud,codigo}),e=>e.codigo==='CADUCADO');});
await prueba('Vincular guarda la fotografía íntegra, no sólo el resumen',async()=>{const f=montar();await f.entrar();assert(await f.modelo.resolverProgreso('local'));const datos=f.servicio.inspeccionar();assert.deepEqual(plano(datos.cuentas[0].progreso),local);assert.deepEqual(plano(datos.respaldos[0].local),local);assert.equal(f.modelo.ver().local,null);assert.equal(f.modelo.ver().pantalla,'perfil');});
await prueba('Entrar a una cuenta sin progreso local no vuelve a importarlo',async()=>{const f=montar({progresoLocal:null,progresoNube:nube});await f.entrar();assert.equal(f.modelo.ver().pantalla,'perfil');assert.equal(f.servicio.inspeccionar().operaciones,0);assert.equal(f.modelo.ver().nube.foils,8);});
await prueba('Una cuenta nueva sin partida muestra el perfil vacío',async()=>{const f=montar({progresoLocal:null});await f.entrar();assert.equal(f.modelo.ver().pantalla,'perfil');assert.equal(f.modelo.ver().nube,null);});
await prueba('Divergencias no se mezclan ni sobrescriben automáticamente',async()=>{const f=montar({progresoNube:nube});await f.entrar();assert.equal(f.modelo.ver().pantalla,'conflicto');assert.deepEqual(plano(f.servicio.inspeccionar().cuentas[0].progreso),nube);assert.equal(f.servicio.inspeccionar().respaldos.length,0);});
await prueba('Elegir nube conserva el original local como respaldo, sin sumar sobres',async()=>{const f=montar({progresoNube:nube});await f.entrar();assert(await f.modelo.resolverProgreso('nube'));assert.equal(f.modelo.ver().nube.sobres,5);assert.deepEqual(plano(f.servicio.inspeccionar().respaldos[0].local),local);});
await prueba('Elegir local conserva el original de nube como respaldo',async()=>{const f=montar({progresoNube:nube});await f.entrar();assert(await f.modelo.resolverProgreso('local'));assert.equal(f.modelo.ver().nube.sobres,3);assert.deepEqual(plano(f.servicio.inspeccionar().respaldos[0].nube),nube);});
await prueba('Sin conexión al vincular mantiene el progreso y permite reintentar',async()=>{const f=montar();await f.entrar();f.servicio.conexion(false);assert.equal(await f.modelo.resolverProgreso('local'),false);assert.equal(f.modelo.ver().local.foils,12);assert.equal(f.modelo.ver().pantalla,'vincular');assert.equal(f.servicio.inspeccionar().operaciones,0);f.servicio.conexion(true);assert(await f.modelo.resolverProgreso('local'));});
await prueba('Respuesta perdida después de guardar no duplica operación ni respaldo',async()=>{const f=montar();await f.entrar();f.servicio.perderProximaRespuesta();assert.equal(await f.modelo.resolverProgreso('local'),false);assert(f.modelo.ver().local);assert.equal(f.servicio.inspeccionar().operaciones,1);assert(await f.modelo.resolverProgreso('local'));assert.equal(f.servicio.inspeccionar().operaciones,1);assert.equal(f.servicio.inspeccionar().respaldos.length,1);});
await prueba('Otro dispositivo genera conflicto de revisión sin perder la copia local',async()=>{const f=montar({progresoNube:nube});await f.entrar();f.servicio.cambiarNube({...nube,sobres:7});assert.equal(await f.modelo.resolverProgreso('local'),false);assert.equal(f.modelo.ver().pantalla,'conflicto');assert.equal(f.modelo.ver().nube.sobres,7);assert.equal(f.modelo.ver().local.sobres,3);assert(await f.modelo.resolverProgreso('nube'));assert.equal(f.modelo.ver().nube.sobres,7);});
await prueba('Cerrar sesión fallido no finge desconexión; reintento conserva cuenta',async()=>{const f=montar({progresoLocal:null,progresoNube:nube});await f.entrar();f.servicio.conexion(false);assert.equal(await f.modelo.cerrarSesion(),false);assert(f.modelo.ver().sesion);f.servicio.conexion(true);assert(await f.modelo.cerrarSesion());assert.equal(f.modelo.ver().sesion,null);assert.deepEqual(plano(f.servicio.inspeccionar().cuentas[0].progreso),nube);});
await prueba('Cambiar de cuenta no importa otra vez el progreso ya vinculado',async()=>{const f=montar();await f.entrar();await f.modelo.resolverProgreso('local');await f.modelo.cerrarSesion();await f.modelo.solicitar({correo:'otra@ejemplo.com',nombre:'Otra',intencion:'crear'});await f.modelo.verificar(f.codigo());assert.equal(f.modelo.ver().pantalla,'perfil');assert.equal(f.modelo.ver().nube,null);});
await prueba('Doble envío y navegar mientras se espera no repiten la solicitud',async()=>{let liberar;const f=montar({esperar:()=>new Promise(r=>liberar=r)});const primero=f.modelo.solicitar({correo:'a@ejemplo.com',nombre:'Ari'});assert.equal(await f.modelo.solicitar({correo:'b@ejemplo.com',nombre:'Beto'}),false);assert.equal(f.modelo.cambiarCorreo(),false);liberar();assert(await primero);assert.equal(f.modelo.ver().correo,'a@ejemplo.com');});
await prueba('Destruir la vista ignora respuestas tardías y retira suscripciones',async()=>{let liberar,n=0;const f=montar({esperar:()=>new Promise(r=>liberar=r)});f.modelo.suscribir(()=>n++);const tarea=f.modelo.solicitar({correo:'a@ejemplo.com',nombre:'Ari'});f.modelo.destruir();const anterior=n;liberar();assert.equal(await tarea,false);assert.equal(n,anterior);});
await prueba('Invitado no crea cuentas ni escribe inventario',async()=>{const f=montar();assert(f.modelo.invitado());assert.equal(f.modelo.ver().pantalla,'invitado');assert.equal(f.servicio.inspeccionar().cuentas.length,0);assert.equal(f.servicio.inspeccionar().operaciones,0);});
console.log(total+' pruebas del flujo aislado de cuentas en verde. Sin correo ni guardado reales.');

/* Regresiones de coordinación: identidad, conflictos y escrituras locales. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const plano=v=>v==null?v:JSON.parse(JSON.stringify(v));
const fuentes=['cuenta-progreso.js','cuenta-servicio.js','cuenta-modelo.js','cuenta-acceso.js'];
const mutantes={
  cierreConflicto:["if(s.guardado==='conflicto')throw Object.assign(Error('CONFLICTO'),{codigo:'CONFLICTO',...s.conflicto});",'void s;'],
  cierreCaducado:["if(s.guardado==='sesion')throw Object.assign(Error('SESION'),{codigo:'SESION'});",'void s;'],
  vinculoEscrito:["return !bloqueado&&!destruido&&s.acceso===true&&\n        identidad===s.sesion?.id&&progreso.vinculado()?.cuentaId===identidad&&servicio.identidad()?.id===identidad;", "return !bloqueado&&!destruido&&!!s.sesion&&s.pantalla==='perfil';"]
};
function crear(){
  const contexto=vm.createContext({crypto:webcrypto,TextEncoder,AbortController,Headers,Response,URL,Event,EventTarget,CustomEvent,setTimeout,clearTimeout,setInterval,clearInterval});
  for(const f of fuentes){
    let texto=fs.readFileSync(new URL('../../caoz_tcg/'+f,import.meta.url),'utf8');
    if(f==='cuenta-acceso.js'&&process.env.CAOZ_SABOTAJE_ACCESO){
      const [antes,despues]=mutantes[process.env.CAOZ_SABOTAJE_ACCESO];assert.ok(texto.includes(antes),'El sabotaje debe encontrar el código vigente');texto=texto.replace(antes,despues);
    }
    vm.runInContext(texto,contexto,{filename:f});
  }
  vm.runInContext(fs.readFileSync(new URL('cuenta-demo.js',import.meta.url),'utf8'),contexto);
  let codigo,ahora=Date.now(),rechazar=false,fallar=false,admitir=true;
  const memoria=contexto.CAOZ_CUENTA_DEMO.crearMemoria(),storage={
    getItem:k=>memoria.getItem(k),removeItem:k=>memoria.removeItem(k),setItem(k,v){if(fallar&&k.endsWith('.vinculo'))throw Error('Cuota');memoria.setItem(k,v);}
  };
  const t=contexto.CAOZ_CUENTA_DEMO.crearTransporte({demora:0,reloj:()=>ahora,alCodigo:r=>codigo=r.codigo});
  const eventos=new EventTarget();
  const p=contexto.CAOZ_CUENTA_PROGRESO.crear({storage,entorno:'beta',ruta:'/',eventos,intervalo:0});
  const s=contexto.CAOZ_CUENTA_SERVICIO.crear({storage,progreso:p,fetch:(url,op)=>rechazar?Promise.resolve(new Response(JSON.stringify({codigo:'SESION'}),{status:401})):t.fetch(url,op)});
  const a=contexto.CAOZ_CUENTA_ACCESO.crear({storage,progreso:p,servicio:s,eventos,puedeVincular:()=>admitir});
  return {a,p,s,t,storage,eventos,
    falloVinculo(v){fallar=v;},permisoVinculo(v){admitir=v;},caducar(v){rechazar=v;},
    async entrar(correo='ari@ejemplo.com',nombre='Ari'){
      ahora+=61000;await a.modelo.solicitar({correo,nombre,intencion:'crear'});return a.modelo.verificar(codigo);
    },cambiar(n){storage.setItem('caoz_records_v1',JSON.stringify({ganadas:n}));},
    cerrar(){a.destruir();p.destruir();}
  };
}
let total=0;
async function prueba(nombre,fn){const c=crear();try{await c.a.iniciar();await fn(c);console.log('✓ '+nombre);total++;}finally{c.cerrar();}}
await prueba('Verificar el correo no abre el juego si todavía no se permite escribir el vínculo',async c=>{
  c.permisoVinculo(false);await c.entrar();assert.equal(c.a.puedeJugar(),false);assert.equal(c.p.vinculado(),null);
  c.permisoVinculo(true);c.a.activarVinculo();assert.equal(c.a.puedeJugar(),true);assert.equal(c.p.vinculado().cuentaId,c.a.estado().sesion.id);
});
await prueba('Un fallo de almacenamiento del vínculo no concede acceso y permite reintentarlo',async c=>{
  c.falloVinculo(true);await c.entrar();assert.equal(c.a.puedeJugar(),false);assert.equal(c.p.vinculado(),null);
  c.falloVinculo(false);c.a.activarVinculo();assert.equal(c.a.puedeJugar(),true);assert.ok(c.p.vinculado());
});
await prueba('Intentar cerrar offline conserva identidad, avance y cola pendiente',async c=>{
  await c.entrar();c.cambiar(3);c.t.conexion(false);c.p.revisar();await c.a.guardar();
  const id=c.a.estado().sesion.id,cola=c.storage.getItem(c.p.claveCola(id));
  assert.equal(await c.a.modelo.cerrarSesion(),false);assert.equal(c.a.puedeJugar(),true);
  assert.equal(c.p.capturar().datos.records.ganadas,3);assert.equal(c.storage.getItem(c.p.claveCola(id)),cola);
});
await prueba('El401 bloquea un nuevo juego y reentrar a la misma cuenta preserva lo pendiente',async c=>{
  await c.entrar();c.cambiar(3);c.t.conexion(false);await c.a.guardar();
  const id=c.a.estado().sesion.id,cola=c.storage.getItem(c.p.claveCola(id));c.t.conexion(true);c.caducar(true);
  assert.equal(await c.a.guardar(),false);assert.equal(c.a.puedeJugar(),false);assert.equal(c.a.estado().pantalla,'inicio');
  assert.equal(c.storage.getItem(c.p.claveCola(id)),cola);c.caducar(false);await c.entrar();
  assert.equal(c.a.puedeJugar(),true);assert.equal(c.storage.getItem(c.p.claveCola(id)),cola);
  assert.equal(await c.a.guardar(),true);assert.equal(c.t.inspeccionar().cuentas[0].progreso.datos.records.ganadas,3);
});
await prueba('Un conflicto bloquea acceso hasta elegir explícitamente uno de los avances',async c=>{
  await c.entrar();c.cambiar(3);const nube=c.p.capturar();nube.datos.records.ganadas=8;c.t.cambiarNube(nube);
  await c.a.guardar();assert.equal(c.a.estado().pantalla,'conflicto');assert.equal(c.a.puedeJugar(),false);
  assert.equal(c.p.capturar().datos.records.ganadas,3);assert.equal(c.t.inspeccionar().cuentas[0].progreso.datos.records.ganadas,8);
  assert.equal(await c.a.modelo.resolverProgreso('local'),true);assert.equal(c.a.puedeJugar(),true);
  assert.equal(c.t.inspeccionar().cuentas[0].progreso.datos.records.ganadas,3);
});
await prueba('Cambiar a B tras caducidad conserva un archivo recuperable con el último avance de A',async c=>{
  await c.entrar();const id=c.a.estado().sesion.id;c.cambiar(2);c.t.conexion(false);await c.a.guardar();
  c.t.conexion(true);c.caducar(true);await c.a.guardar();c.cambiar(5);const ultimo=c.p.capturar();
  c.caducar(false);await c.entrar('beto@ejemplo.com','Beto');assert.equal(c.a.puedeJugar(),true);
  assert.notEqual(c.p.vinculado().cuentaId,id);
  assert.deepEqual(plano(c.p.archivo(id)?.snapshot),plano(ultimo),'El progreso anterior debe archivarse antes de importar B');
  assert.equal(JSON.parse(c.storage.getItem(c.p.claveCola(id))).pendiente.progreso.datos.records.ganadas,2,'La cola A conserva su operación original');
  c.cambiar(7);await c.a.guardar();c.caducar(true);await c.a.iniciar();c.caducar(false);
  await c.entrar();assert.equal(c.a.puedeJugar(),false);assert.equal(c.a.estado().pantalla,'vincular');
  assert.equal(c.p.capturar().datos.records.ganadas,7,'Entrar no importa A sobre B automáticamente');
  assert.equal(await c.a.modelo.resolverProgreso('local'),true);assert.equal(c.a.puedeJugar(),true);
  assert.equal(c.p.capturar().datos.records.ganadas,5,'La elección explícita recupera el avance más reciente de A');
  assert.equal(c.t.inspeccionar().cuentas.find(x=>x.correo==='ari@ejemplo.com').progreso.datos.records.ganadas,5);
});
await prueba('Un conflicto detectado al cerrar sesión abre la elección de progreso y no queda atascado',async c=>{
  await c.entrar();c.cambiar(3);const nube=c.p.capturar();nube.datos.records.ganadas=8;c.t.cambiarNube(nube);
  assert.equal(await c.a.modelo.cerrarSesion(),false);assert.equal(c.a.puedeJugar(),false);
  assert.equal(c.a.estado().pantalla,'conflicto');assert.equal(c.p.capturar().datos.records.ganadas,3);
});
await prueba('Una caducidad detectada al cerrar sesión vuelve al acceso por correo',async c=>{
  await c.entrar();c.cambiar(3);c.caducar(true);
  assert.equal(await c.a.modelo.cerrarSesion(),false);assert.equal(c.a.puedeJugar(),false);
  assert.equal(c.a.estado().pantalla,'inicio');assert.equal(c.p.capturar().datos.records.ganadas,3);
});
await prueba('Perder la conexión sin una cola pendiente mantiene acceso y muestra el estado offline',async c=>{
  await c.entrar();assert.equal(c.a.estado().guardado,'guardado');c.t.conexion(false);
  c.eventos.dispatchEvent(new Event('offline'));
  for(let i=0;i<30&&!c.a.estado().sinConexion;i++)await new Promise(r=>setTimeout(r,0));
  assert.equal(c.a.estado().guardado,'sinConexion');assert.equal(c.a.puedeJugar(),true);
});
console.log(`${total} pruebas del coordinador de acceso aprobadas.`);
if(process.argv.includes('--sabotaje')&&!process.env.CAOZ_SABOTAJE_ACCESO){
  for(const nombre of Object.keys(mutantes)){
    const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,CAOZ_SABOTAJE_ACCESO:nombre},encoding:'utf8'});
    assert.notEqual(r.status,0,'El sabotaje '+nombre+' debe romper una regresión');
    assert.match(r.stderr,/AssertionError/);console.log('✓ Sabotaje detectado: '+nombre);
  }
}

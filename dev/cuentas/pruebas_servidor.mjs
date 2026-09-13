import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import * as servidor from '../../caoz_tcg/cuenta-servidor.js';
let {crearManejadorCuenta,manejarCuenta}=servidor;
globalThis.crypto ||= webcrypto;
const migracion=await readFile(new URL('./migracion.sql',import.meta.url),'utf8');
const origen='https://juego.caozcontodo.com';
function base(){
  const sql=new DatabaseSync(':memory:');sql.exec(migracion);
  function prepare(texto){return {bind(...args){
    return {first:async()=>sql.prepare(texto).get(...args)||null,
      run:async()=>({meta:sql.prepare(texto).run(...args)}),
      all:async()=>({results:sql.prepare(texto).all(...args)}),texto,args};
  }};}
  return {sql,prepare,batch:async lote=>{
    sql.exec('BEGIN IMMEDIATE');try{const r=lote.map(s=>{
      const q=sql.prepare(s.texto);return q.columns().length?{results:q.all(...s.args)}:{meta:q.run(...s.args)};
    });sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}
  }};
}
function progreso(n=1,entorno='produccion'){
  return {formato:'caoz.progreso',version:1,entorno,datos:{
    campana:{id:'partida',etapa:n,personaje:{nombre:'Ari'}},borrador:{nombre:'Ari'},logros:{mazos:{fender:{fecha:123}}},
    coleccion:{copias:{eric:{foil:n}},sobresGuardados:{trucos:n},pendiente:{id:'abierto-1',cartas:['eric','thal','rey','machete','armadura']}},
    premiosDomo:[{id:'premio-1'}],records:{ganadas:n},nombre:'Ari'}};
}
function laboratorio(){
  const db=base(),correos=[],identidades=new Map();let ahora=1750000000000,fallarCorreo=false;
  const env={CUENTAS_DB:db,CUENTAS_SECRET:'secreto-solo-de-pruebas-de-mas-de-treinta-y-dos',CUENTAS_ENTORNO:'produccion'};
  const manejar=crearManejadorCuenta({reloj:()=>ahora,enviarCodigo:async datos=>{
    if(fallarCorreo)throw new Error('proveedor secreto');correos.push(datos);
  }});
  async function pedir(ruta,datos,{cookie='',method='POST',ip='192.0.2.1',headers={},entorno}={}){
    const req=new Request(origen+'/api/cuenta/'+ruta,{method,headers:{Origin:origen,'Content-Type':'application/json','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...(['progreso','salir'].includes(ruta)&&identidades.has(cookie)?{'X-Caoz-Cuenta':identidades.get(cookie)}:{}),...headers},...(method==='GET'?{}:{body:JSON.stringify(datos)})});
    const respuesta=await manejar(req,entorno?{...env,CUENTAS_ENTORNO:entorno}:env);
    const resultado={status:respuesta.status,datos:await respuesta.json(),headers:respuesta.headers,cookie:respuesta.headers.get('set-cookie')?.split(';')[0]};
    if(resultado.cookie&&resultado.datos.sesion)identidades.set(resultado.cookie,resultado.datos.sesion.id);
    return resultado;
  }
  async function codigo(correo='ari@ejemplo.com',opciones={}){
    const r=await pedir('codigo',{correo,nombre:'Ari',intencion:'crear'},opciones);
    assert.equal(r.status,200,JSON.stringify(r.datos));return {...r.datos,codigo:correos.at(-1).codigo};
  }
  async function entrar(correo,opciones={}){const d=await codigo(correo,opciones);return pedir('verificar',{solicitud:d.id,codigo:d.codigo},opciones);}
  return {db,env,pedir,codigo,entrar,correos,avanzar:ms=>ahora+=ms,fallarCorreo:v=>fallarCorreo=v};
}
const casos=[];const caso=(nombre,fn)=>casos.push({nombre,fn});
caso('No se crea una cuenta ni se devuelve el código antes de verificar el correo',async()=>{
  const l=laboratorio();const r=await l.pedir('codigo',{correo:' ARI@Ejemplo.com ',nombre:'Ari',intencion:'crear'});
  assert.equal(r.status,200);assert.deepEqual(Object.keys(r.datos).sort(),['id','reenvioEn','vence']);
  assert.equal(l.correos[0].correo,'ari@ejemplo.com');assert.match(l.correos[0].codigo,/^\d{6}$/);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_usuarios').get().n,0);
  const d=l.db.sql.prepare('SELECT * FROM cuenta_desafios').get();
  assert.notEqual(d.codigo_hash,l.correos[0].codigo);assert.ok(!JSON.stringify(d).includes('192.0.2.1'));
});
caso('Cookie privada, sesión persistente y payload público mínimo',async()=>{
  const l=laboratorio(),r=await l.entrar();assert.equal(r.status,200);
  assert.match(r.headers.get('set-cookie'),/^__Host-caoz-jugador=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
  assert.deepEqual(Object.keys(r.datos.sesion).sort(),['correo','id','nombre']);assert.equal(r.datos.progreso,null);
  const s=await l.pedir('sesion',null,{method:'GET',cookie:r.cookie});assert.deepEqual(s.datos,r.datos);
  const hash=l.db.sql.prepare('SELECT hash FROM cuenta_sesiones').get().hash;assert.notEqual(hash,r.cookie.split('=')[1]);
});
caso('Un código sólo abre una sesión incluso con verificaciones concurrentes',async()=>{
  const l=laboratorio(),c=await l.codigo();
  const resultados=await Promise.all(Array.from({length:6},()=>l.pedir('verificar',{solicitud:c.id,codigo:c.codigo})));
  assert.equal(resultados.filter(r=>r.status===200).length,1);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_sesiones').get().n,1);
});
caso('Cinco errores bloquean el código correcto; caducidad a cinco minutos',async()=>{
  const l=laboratorio(),c=await l.codigo(),mal=c.codigo==='000000'?'000001':'000000';
  for(let i=0;i<5;i++)await l.pedir('verificar',{solicitud:c.id,codigo:mal});
  assert.equal((await l.pedir('verificar',{solicitud:c.id,codigo:c.codigo})).datos.codigo,'INTENTOS');
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_usuarios').get().n,0);
  l.avanzar(300001);const d=await l.codigo();l.avanzar(300000);
  assert.equal((await l.pedir('verificar',{solicitud:d.id,codigo:d.codigo})).datos.codigo,'CADUCADO');
});
caso('Reenvío a sesenta segundos invalida el código anterior',async()=>{
  const l=laboratorio(),a=await l.codigo();
  assert.equal((await l.pedir('codigo',{correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'})).status,429);
  l.avanzar(60000);const b=await l.codigo();
  assert.equal((await l.pedir('verificar',{solicitud:a.id,codigo:a.codigo})).datos.codigo,'CODIGO_INVALIDO');
  assert.equal((await l.pedir('verificar',{solicitud:b.id,codigo:b.codigo})).status,200);
});
caso('Límites por correo e IP resisten peticiones simultáneas',async()=>{
  const l=laboratorio();
  const grupo=await Promise.all(Array.from({length:6},()=>l.pedir('codigo',{correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'})));
  assert.equal(grupo.filter(r=>r.status===200).length,1);
  l.avanzar(60000);await l.codigo();l.avanzar(60000);await l.codigo();l.avanzar(60000);
  assert.equal((await l.pedir('codigo',{correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'})).status,429);
  for(let i=0;i<17;i++)await l.codigo('otro'+i+'@ejemplo.com');
  assert.equal((await l.pedir('codigo',{correo:'tope@ejemplo.com',nombre:'Ari',intencion:'crear'})).status,429);
  assert.equal(l.correos.length,20);
});
caso('Un fallo del proveedor no crea acceso y no filtra su error',async()=>{
  const l=laboratorio();l.fallarCorreo(true);
  const r=await l.pedir('codigo',{correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'});
  assert.equal(r.status,503);assert.deepEqual(r.datos,{codigo:'NO_DISPONIBLE'});
  assert.equal(l.db.sql.prepare('SELECT consumido FROM cuenta_desafios').get().consumido,'no-entregado');
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_usuarios').get().n,0);
});
caso('Sin base/secreto/correo real la API nunca cae a demostración',async()=>{
  const l=laboratorio();
  const request=()=>new Request(origen+'/api/cuenta/codigo',{method:'POST',headers:{Origin:origen,'Content-Type':'application/json'},body:JSON.stringify({correo:'ari@ejemplo.com',nombre:'Ari',intencion:'crear'})});
  assert.equal((await manejarCuenta(request(),l.env)).status,503);
  assert.equal((await manejarCuenta(request(),{...l.env,CUENTAS_SECRET:'corta'})).status,503);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_desafios').get().n,0);
});
caso('Reentrar conserva identidad y nombre; salir revoca sólo esa sesión',async()=>{
  const l=laboratorio(),a=await l.entrar();l.avanzar(60000);
  const b=await l.pedir('codigo',{correo:'ari@ejemplo.com',nombre:'Otro',intencion:'crear'});
  const c=await l.pedir('verificar',{solicitud:b.datos.id,codigo:l.correos.at(-1).codigo});
  assert.deepEqual(a.datos.sesion,c.datos.sesion);
  const salida=await l.pedir('salir',{},{cookie:a.cookie});assert.equal(salida.status,200);assert.match(salida.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:a.cookie})).status,401);
  assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:c.cookie})).status,200);
  l.avanzar(30*86400000);assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:c.cookie})).status,401);
});
caso('Origin, cookie duplicada, entorno e identificadores ajenos no autorizan acceso',async()=>{
  const l=laboratorio(),a=await l.entrar();
  assert.equal((await l.pedir('salir',{},{cookie:a.cookie,headers:{Origin:'https://ajeno.test'}})).status,403);
  assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:a.cookie,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:a.cookie+'; '+a.cookie})).status,401);
  assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:a.cookie,entorno:'beta'})).status,401);
  assert.equal((await l.pedir('sesion',null,{method:'GET',cookie:'__Host-caoz-jugador='+a.datos.sesion.id})).status,401);
  assert.equal((await l.pedir('progreso',{usuario:a.datos.sesion.id})).status,401);
});
function guardar(l,cookie,datos={}){return l.pedir('progreso',{operacion:crypto.randomUUID(),revision:0,origen:'local',progreso:progreso(),respaldoLocal:progreso(),...datos},{cookie});}
caso('Snapshot conserva inventario, abierto exacto y recibos; repetición no duplica',async()=>{
  const l=laboratorio(),s=await l.entrar(),operacion=crypto.randomUUID(),p=progreso(5);
  const a=await guardar(l,s.cookie,{operacion,progreso:p,respaldoLocal:p});assert.equal(a.status,200);assert.equal(a.datos.revision,1);assert.deepEqual(a.datos.progreso,p);
  const b=await guardar(l,s.cookie,{operacion,progreso:p,respaldoLocal:p});assert.deepEqual(b.datos,a.datos);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,1);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_operaciones').get().n,1);
  assert.deepEqual((await l.pedir('sesion',null,{method:'GET',cookie:s.cookie})).datos.progreso,p);
});
caso('Concurrencia del mismo guardado produce un solo recibo y respaldo',async()=>{
  const l=laboratorio(),s=await l.entrar(),operacion=crypto.randomUUID();
  const r=await Promise.all(Array.from({length:6},()=>guardar(l,s.cookie,{operacion})));
  assert.ok(r.every(v=>v.status===200&&v.datos.revision===1));
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,1);
});
caso('La misma operación con otro payload se rechaza sin escribir',async()=>{
  const l=laboratorio(),s=await l.entrar(),operacion=crypto.randomUUID();await guardar(l,s.cookie,{operacion});
  const r=await guardar(l,s.cookie,{operacion,progreso:progreso(8)});assert.equal(r.status,409);assert.equal(r.datos.codigo,'OPERACION');
  assert.equal(l.db.sql.prepare('SELECT revision FROM cuenta_progreso').get().revision,1);
});
caso('Dos dispositivos que escriben la misma revisión reciben un conflicto real',async()=>{
  const l=laboratorio(),s=await l.entrar();
  const r=await Promise.all([guardar(l,s.cookie,{progreso:progreso(2)}),guardar(l,s.cookie,{progreso:progreso(7)})]);
  assert.equal(r.filter(v=>v.status===200).length,1);const mal=r.find(v=>v.status===409),bien=r.find(v=>v.status===200);
  assert.equal(mal.datos.codigo,'CONFLICTO');assert.deepEqual(mal.datos.progreso,bien.datos.progreso);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,1);
});
caso('Elegir nube conserva nube completa y respalda ambas copias sin sumarlas',async()=>{
  const l=laboratorio(),s=await l.entrar();await guardar(l,s.cookie,{progreso:progreso(2)});
  const r=await guardar(l,s.cookie,{revision:1,origen:'nube',progreso:progreso(99),respaldoLocal:progreso(9)});
  assert.equal(r.status,200);assert.deepEqual(r.datos.progreso,progreso(2));
  const respaldo=l.db.sql.prepare('SELECT nube,local FROM cuenta_respaldos ORDER BY rowid DESC LIMIT 1').get();
  assert.deepEqual(JSON.parse(respaldo.nube),progreso(2));assert.deepEqual(JSON.parse(respaldo.local),progreso(9));
});
caso('Usuarios distintos no comparten snapshots ni recibos de idempotencia',async()=>{
  const l=laboratorio(),a=await l.entrar(),b=await l.entrar('bea@ejemplo.com'),operacion=crypto.randomUUID();
  await guardar(l,a.cookie,{operacion,progreso:progreso(8)});const r=await guardar(l,b.cookie,{operacion,progreso:progreso(2)});
  assert.equal(r.status,200);assert.deepEqual((await l.pedir('sesion',null,{method:'GET',cookie:a.cookie})).datos.progreso,progreso(8));
  assert.deepEqual((await l.pedir('sesion',null,{method:'GET',cookie:b.cookie})).datos.progreso,progreso(2));
});
caso('Cambiar la cookie en otra pestaña no guarda ni cierra la cuenta equivocada',async()=>{
  const l=laboratorio(),a=await l.entrar(),b=await l.entrar('bea@ejemplo.com');
  const datos={origen:'local',operacion:crypto.randomUUID(),revision:0,progreso:progreso(8),respaldoLocal:progreso(8)};
  for(const ruta of ['progreso','salir']){
    const cuerpo=ruta==='salir'?{}:datos;
    const r=await l.pedir(ruta,cuerpo,{cookie:b.cookie,headers:{'X-Caoz-Cuenta':a.datos.sesion.id}});
    assert.equal(r.status,401);assert.equal(r.datos.codigo,'SESION');
    assert.equal((await l.pedir(ruta,cuerpo,{cookie:b.cookie,headers:{'X-Caoz-Cuenta':''}})).status,401);
  }
  const actual=await l.pedir('sesion',null,{method:'GET',cookie:b.cookie});assert.equal(actual.status,200);assert.equal(actual.datos.progreso,null);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,0);
});
caso('Esquema, tamaño y entorno rechazan datos antes de mutar',async()=>{
  const l=laboratorio(),s=await l.entrar();
  for(const p of [{},progreso(1,'beta'),{...progreso(),datos:{nombre:'Ari'}},JSON.parse('{"formato":"caoz.progreso","version":1,"entorno":"produccion","datos":{"campana":{"__proto__":{}},"borrador":null,"logros":null,"coleccion":null,"premiosDomo":[],"records":null,"nombre":"Ari"}}')]){
    assert.equal((await guardar(l,s.cookie,{progreso:p})).status,400);
  }
  const p=progreso();p.datos.campana.exceso='x'.repeat(262145);assert.equal((await guardar(l,s.cookie,{progreso:p})).status,413);
  assert.equal((await guardar(l,s.cookie,{revision:-1})).status,400);
  assert.equal((await guardar(l,s.cookie,{usuario:'ajeno'})).status,400);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,0);
});
caso('El texto del deseo se rechaza tanto en el progreso como en su respaldo',async()=>{
  const l=laboratorio(),s=await l.entrar();
  for(const campo of ['deseo','borradorDeseo'])for(const copia of ['progreso','respaldoLocal']){
    const p=progreso();p.datos.campana[campo]='un deseo privado';
    assert.equal((await guardar(l,s.cookie,{[copia]:p})).status,400);
  }
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,0);
  assert.equal(l.db.sql.prepare('SELECT revision FROM cuenta_progreso').get().revision,0);
});
caso('La transacción revierte respaldo y avance si falla crear el recibo',async()=>{
  const l=laboratorio(),s=await l.entrar();
  l.db.sql.exec("CREATE TRIGGER romper BEFORE INSERT ON cuenta_operaciones BEGIN SELECT RAISE(ABORT,'rotura'); END");
  const r=await guardar(l,s.cookie);assert.equal(r.status,503);
  assert.equal(l.db.sql.prepare('SELECT revision FROM cuenta_progreso').get().revision,0);
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,0);
});
caso('Respaldos acotados a diez; un reintento antiguo no restaura una versión vieja',async()=>{
  const l=laboratorio(),s=await l.entrar(),primero=crypto.randomUUID();
  for(let i=0;i<12;i++){l.avanzar(10);assert.equal((await guardar(l,s.cookie,{revision:i,operacion:i?crypto.randomUUID():primero,progreso:progreso(i)})).status,200);}
  assert.equal(l.db.sql.prepare('SELECT count(*) n FROM cuenta_respaldos').get().n,10);
  const r=await guardar(l,s.cookie,{operacion:primero,progreso:progreso(0)});assert.equal(r.status,409);assert.equal(r.datos.codigo,'CONFLICTO');assert.equal(r.datos.revision,12);
  assert.equal(l.db.sql.prepare('SELECT revision FROM cuenta_progreso').get().revision,12);
});
caso('256 recibos pequeños acotan almacenamiento; un recibo depurado tampoco duplica',async()=>{
  const l=laboratorio(),s=await l.entrar(),primero=crypto.randomUUID();
  for(let i=0;i<260;i++){l.avanzar(10);assert.equal((await guardar(l,s.cookie,{revision:i,operacion:i?crypto.randomUUID():primero,progreso:progreso(i)})).status,200);}
  const tabla=l.db.sql.prepare('SELECT * FROM cuenta_operaciones').all();assert.equal(tabla.length,256);assert.ok(tabla.every(r=>!Object.hasOwn(r,'progreso')));
  const r=await guardar(l,s.cookie,{operacion:primero,progreso:progreso(0)});assert.equal(r.status,409);assert.equal(r.datos.revision,260);
  assert.equal(l.db.sql.prepare('SELECT revision FROM cuenta_progreso').get().revision,260);
});
caso('Todas las respuestas, incluidos errores, son privadas y no cacheables',async()=>{
  const l=laboratorio(),s=await l.entrar();
  for(const r of [s,await l.pedir('sesion',null,{method:'GET'}),await guardar(l,s.cookie),await l.pedir('salir',{},{cookie:s.cookie})]){
    assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('pragma'),'no-cache');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  }
});
let rojos=0;for(const {nombre,fn} of casos){try{await fn();console.log('✓ '+nombre);}catch(e){rojos++;console.error('✗ '+nombre);console.error(e);}}
console.log(`${casos.length-rojos}/${casos.length} pruebas del servidor`);
if(!rojos&&process.argv.includes('--sabotaje')){
  const fuente=await readFile(new URL('../../caoz_tcg/cuenta-servidor.js',import.meta.url),'utf8');
  const sabotajes=[
    {nombre:'cuenta vinculada a la cookie',caso:'Cambiar la cookie',antes:"if(request.headers.get('x-caoz-cuenta')!==sesion.usuario)throw fallo('SESION',401);",despues:''},
    {nombre:'revisión CAS',caso:'Dos dispositivos',antes:'usuario=? AND entorno=? AND revision=? AND NOT EXISTS',despues:'usuario=? AND entorno=? AND (? IS NOT NULL) AND NOT EXISTS'},
    {nombre:'cinco intentos',caso:'Cinco errores',antes:/intentos<5/g,despues:'intentos<5000'},
    {nombre:'texto de deseo privado',caso:'El texto del deseo',antes:"if(v.datos.campana&&['borradorDeseo','deseo'].some(k=>Object.hasOwn(v.datos.campana,k)))throw fallo('DATOS');",despues:''},
    {nombre:'hash de idempotencia',caso:'La misma operación',antes:"if(recibo&&recibo.solicitud_hash!==solicitudHash)throw fallo('OPERACION',409);",despues:''}
  ];
  for(const s of sabotajes){
    let rota=fuente.replace(s.antes,s.despues);assert.notEqual(rota,fuente,'El sabotaje debe modificar la fuente');
    rota=rota.replace("'./cuenta-correo.js'",JSON.stringify(new URL('../../caoz_tcg/cuenta-correo.js',import.meta.url).href));
    const mod=await import('data:text/javascript;base64,'+Buffer.from(rota).toString('base64'));
    crearManejadorCuenta=mod.crearManejadorCuenta;manejarCuenta=mod.manejarCuenta;
    let detectado=false;try{await casos.find(c=>c.nombre.startsWith(s.caso)).fn();}catch{detectado=true;}
    if(!detectado){rojos++;console.error('✗ Sabotaje no detectado: '+s.nombre);}else console.log('✓ Sabotaje detectado: '+s.nombre);
  }
  ({crearManejadorCuenta,manejarCuenta}=servidor);
}
if(rojos)process.exitCode=1;

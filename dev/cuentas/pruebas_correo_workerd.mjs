/* Runtime real, correo simulado. No instala paquetes ni tiene salida a internet.
 * WORKERD_BIN=/ruta/al/binario/workerd node dev/cuentas/pruebas_correo_workerd.mjs --sabotaje
 * Usar un workerd oficial >= 2026-09-05, instalado fuera del proyecto.
 */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
const binario=process.env.WORKERD_BIN||'workerd';
const version=spawnSync(binario,['--version'],{encoding:'utf8'});
assert.equal(version.status,0,'Configura WORKERD_BIN con un runtime workerd oficial ya instalado.');
const fuente=await readFile(new URL('../../caoz_tcg/cuenta-correo.js',import.meta.url),'utf8');
const temporal=await mkdtemp(join(tmpdir(),'caoz-correo-workerd-'));
const entrada=`import {enviarCodigoCuenta} from './cuenta-correo.js';
const capturada=globalThis.fetch;
const env={CUENTAS_RESEND_KEY:'re_solo_pruebas_sin_valor_real_123456',CUENTAS_REMITENTE:'acceso@ejemplo.invalid'};
const datos={correo:'jugador@ejemplo.invalid',codigo:'012345',vence:1};
export default {async fetch(){
 const casos=[];
 async function caso(nombre,fn){try{await fn();casos.push({nombre,ok:true});}catch(e){casos.push({nombre,ok:false,error:e.message});}}
 await caso('fetch capturado sin bind',async()=>{const r=await capturada('https://fixture.invalid/salud');if(await r.text()!=='ok')throw Error('Fetch falló');});
 await caso('envío 200',async()=>{if(await enviarCodigoCuenta(env,datos)!==true)throw Error('Entrega sin confirmar');});
 for(const status of [301,302,303,307,308])await caso('rechazar '+status,async()=>{
  let error;try{await enviarCodigoCuenta(env,{...datos,correo:'redir'+status+'@ejemplo.invalid'});}catch(e){error=e;}
  if(error?.status!==503||error?.message!=='No se pudo enviar el código de acceso.')throw Error('Redirección aceptada');
 });
 const estado=await (await capturada('https://fixture.invalid/estado')).json();
 await caso('ningún acceso ni credenciales al segundo destino',async()=>{if(estado.destino!==0||estado.credenciales!==0)throw Error('Se siguió Location');});
 await caso('seis envíos llegaron al proveedor local',async()=>{if(estado.proveedor!==6)throw Error('Transporte no ejecutado');});
 return Response.json({casos,estado});
}};`;
const proveedor=`let proveedor=0,destino=0,credenciales=0;
export default {async fetch(request){
 const url=new URL(request.url);
 if(url.pathname==='/salud')return new Response('ok');
 if(url.pathname==='/estado')return Response.json({proveedor,destino,credenciales});
 if(url.hostname==='otro.ejemplo.invalid'){
  destino++;if(request.headers.has('Authorization'))credenciales++;
  return Response.json({id:'destino-que-no-debe-consultarse'});
 }
 if(url.origin!=='https://api.resend.com'||url.pathname!=='/emails')throw Error('Petición inesperada');
 proveedor++;
 const body=await request.json();
 if(request.headers.get('Authorization')!=='Bearer re_solo_pruebas_sin_valor_real_123456'||
    request.headers.get('User-Agent')!=='CaozTCG-Cuentas/1.0 (+https://juego.caozcontodo.com)'||
    body.from!=='Caoz Con Todo <acceso@ejemplo.invalid>')throw Error('Contrato de transporte incorrecto');
 const redir=/^redir(301|302|303|307|308)@/.exec(body.to[0]);
 if(redir)return Response.redirect('https://otro.ejemplo.invalid/captura',Number(redir[1]));
 return Response.json({id:'envio-local-simulado'});
}};`;
const configuracion=`using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name = "principal", worker = (
   compatibilityDate = "2026-09-05",
   modules = [(name = "entrada.js", esModule = embed "entrada.js"),
              (name = "cuenta-correo.js", esModule = embed "cuenta-correo.js")],
   globalOutbound = "proveedor-local"
  )),
  (name = "proveedor-local", worker = (
   compatibilityDate = "2026-09-05",
   modules = [(name = "proveedor.js", esModule = embed "proveedor.js")],
   globalOutbound = "proveedor-local"
  ))
 ],
 sockets = [(name = "http", address = "127.0.0.1:0", http = (), service = "principal")]
);`;

async function ejecutar(codigo){
 await writeFile(join(temporal,'cuenta-correo.js'),codigo);
 const proceso=spawn(binario,['serve','--control-fd=3',join(temporal,'config.capnp')],{stdio:['ignore','ignore','pipe','pipe']});
 let diagnostico='';proceso.stderr.on('data',chunk=>{diagnostico+=chunk.toString();});
 const lineas=createInterface({input:proceso.stdio[3]});
 const terminado=new Promise(resolve=>proceso.once('exit',resolve));
 try{
  const puerto=await new Promise((resolve,reject)=>{
   const plazo=setTimeout(()=>rechazar(Error('Workerd no abrió su socket local.')),10000);
   function rechazar(error){clearTimeout(plazo);reject(error);}
   proceso.once('error',rechazar);
   proceso.once('exit',()=>rechazar(Error('Workerd terminó: '+diagnostico)));
   lineas.on('line',linea=>{try{const dato=JSON.parse(linea);if(dato.event==='listen'&&dato.socket==='http'){clearTimeout(plazo);resolve(dato.port);}}catch{rechazar(Error('Control de workerd inválido.'));}});
  });
  const respuesta=await fetch('http://127.0.0.1:'+puerto,{signal:AbortSignal.timeout(10000)});
  assert.equal(respuesta.status,200,'Falló el arnés de workerd: '+diagnostico);
  return await respuesta.json();
 }finally{
  lineas.close();proceso.kill('SIGTERM');
  const plazo=setTimeout(()=>proceso.kill('SIGKILL'),2000);plazo.unref();
  await terminado;clearTimeout(plazo);
 }
}
try{
 await Promise.all([
  writeFile(join(temporal,'entrada.js'),entrada),
  writeFile(join(temporal,'proveedor.js'),proveedor),
  writeFile(join(temporal,'config.capnp'),configuracion)
 ]);
 const normal=await ejecutar(fuente);
 assert.deepEqual(normal.casos.filter(c=>!c.ok),[],'Falló el envío bajo workerd.');
 console.log(version.stdout.trim()+' · compatibilidad 2026-09-05 · '+normal.casos.length+' casos verdes. Sin red externa ni correo real.');
 if(process.argv.includes('--sabotaje')){
  assert.equal(fuente.split("redirect:'manual'").length,2,'El sabotaje debe modificar exactamente una llamada.');
  const error=await ejecutar(fuente.replace("redirect:'manual'","redirect:'error'"));
  assert.equal(error.casos.find(c=>c.nombre==='envío 200').ok,false,'El sabotaje error debe romper el envío normal.');
  assert.equal(error.estado.proveedor,0,'El runtime debe rechazar error antes del transporte.');
  const follow=await ejecutar(fuente.replace("redirect:'manual'","redirect:'follow'"));
  assert.equal(follow.casos.find(c=>c.nombre==='ningún acceso ni credenciales al segundo destino').ok,false);
  assert.ok(follow.estado.destino>0,'El sabotaje follow debe detectar solicitudes al destino de Location.');
  console.log('Sabotajes detectados: error impide todo envío; follow consulta el destino de Location. Datos exclusivamente sintéticos.');
 }
}finally{await rm(temporal,{recursive:true,force:true});}

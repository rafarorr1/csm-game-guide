/* El Portal del Domo se prueba contra un D1 local: nunca usa la clave real ni Cloudflare. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import worker from './_worker.js';

function base(){
  const db=new DatabaseSync(':memory:');
  class Consulta{
    constructor(sql){this.sql=sql;this.args=[];}
    bind(...args){this.args=args;return this;}
    async first(){return db.prepare(this.sql).get(...this.args)||null;}
    async all(){return {results:db.prepare(this.sql).all(...this.args)};}
    async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}};}
  }
  return {db,binding:{prepare:sql=>new Consulta(sql)}};
}
const sha=v=>createHash('sha256').update(v).digest('hex'),clave=randomBytes(24).toString('hex'),baseD1=base(),rutas=[];
const archivos=new Map([
  ['/portal','<main>Portal del Domo</main>'],['/portal.html','<main>Portal del Domo</main>'],['/portal.css','body{}'],['/portal.js','window.portal=true'],['/art/icono-192.png','icono'],
  ['/','Producción'],['/index.html','Producción'],['/movil.html','Móvil'],['/sw.js','Juego PWA'],['/estudio','Estudio de Cartas'],['/sonidos','Estudio de Sonidos'],['/fisico/index.html','Juego Físico']
]);
const env={
  PORTAL_PASSWORD_HASH:sha(clave),PORTAL_SESSION_KEY:randomBytes(32).toString('hex'),SFX_DB:baseD1.binding,ESTUDIO_UNICO:'1',CF_PAGES_BRANCH:'gh-pages',
  ASSETS:{async fetch(req){const url=new URL(req.url);rutas.push(url.pathname+url.search);return new Response(archivos.get(url.pathname)||'Estático '+url.pathname,{status:archivos.has(url.pathname)?200:404});}}
};
const origen='https://juego.caozcontodo.com';let cookie='';

// Estas regresiones ejecutan el cliente real. Un 200 de la sesión sólo indica
// que el Worker contestó: el Portal tiene que mirar el campo autenticado, borrar
// la PWA de raíz heredada y confirmar la cookie antes de cambiar de ruta.
const pausaPortal=()=>new Promise(resolve=>setTimeout(resolve,0));
function interfazPortal({respuestas=[],search='',registros=[],cachesIniciales=[],controlador=null,origenPortal=origen}={}){
  const eventos={},pedidos=[],borrados=[],destinos=[];
  const nodo=({hidden=false}={})=>({
    hidden,textContent:'',value:'',disabled:false,classList:{toggle(){}},
    addEventListener(tipo,escucha){eventos[tipo]??=[];eventos[tipo].push(escucha);},focus(){}
  });
  const nodos={portalAcceso:nodo({hidden:true}),portalMenu:nodo(),portalFormulario:nodo(),portalClave:nodo(),portalEnviar:nodo(),portalEstado:nodo(),portalSalir:nodo(),portalMenuEstado:nodo()};
  const location={origin:origenPortal,hostname:new URL(origenPortal).hostname,href:origenPortal+'/'+search,pathname:'/',search,hash:'',replace:destino=>destinos.push(destino)};
  runInNewContext(readFileSync(new URL('./portal.js',import.meta.url),'utf8'),{
    window:{},document:{getElementById:id=>nodos[id],addEventListener(){}},
    fetch:async(...args)=>{
      pedidos.push(args);const siguiente=respuestas.shift();
      if(siguiente instanceof Error)throw siguiente;
      return {ok:siguiente?.ok??true,json:async()=>siguiente?.datos??{}};
    },
    navigator:{serviceWorker:{controller:controlador,getRegistrations:async()=>registros}},
    caches:{keys:async()=>cachesIniciales,delete:async nombre=>{borrados.push(nombre);return true;}},
    URL,URLSearchParams,location,history:{replaceState(){}},setTimeout:fn=>{fn();return 0;},console
  });
  return {nodos,pedidos,borrados,destinos,enviar:async()=>{
    const escucha=eventos.submit?.[0];assert.ok(escucha,'El formulario del Portal escucha su envío.');
    return escucha({preventDefault(){}});
  }};
}

let vista=interfazPortal({respuestas:[{ok:true,datos:{autenticado:false}}]});
await pausaPortal();
assert.equal(vista.nodos.portalAcceso.hidden,false,'Un 200 sin sesión mantiene visible la contraseña.');
assert.equal(vista.nodos.portalMenu.hidden,true,'Un 200 {autenticado:false} no muestra las puertas del portal.');
assert.match(vista.nodos.portalEstado.textContent,/contraseña/i);

let pwaRaizRetirada=0;
vista=interfazPortal({
  registros:[{scope:origen+'/',unregister:async()=>{pwaRaizRetirada++;return true;}}],
  cachesIniciales:['caoz-cache-/-283','caoz-arte-publico-/-v1','caoz-cache-/produccion/-283']
});
await pausaPortal();
assert.equal(pwaRaizRetirada,1,'El Portal retira sólo la PWA antigua de la raíz.');
assert.deepEqual(vista.borrados.sort(),['caoz-arte-publico-/-v1','caoz-cache-/-283'],'No borra la caché de la PWA actual bajo /produccion/.');
assert.deepEqual(vista.destinos,['/?portal-pwa-limpia=1'],'El navegador se reinicia una vez sin el controlador heredado.');
assert.equal(vista.pedidos.length,0,'No consulta la sesión mientras el reinicio del Portal está pendiente.');

let pwaBetaRetirada=0;
vista=interfazPortal({
  origenPortal:'https://beta.caoz-tcg.pages.dev',
  registros:[{scope:'https://beta.caoz-tcg.pages.dev/',unregister:async()=>{pwaBetaRetirada++;return true;}}],
  cachesIniciales:['caoz-cache-/-284','caoz-arte-publico-/-v1'],
  respuestas:[{ok:true,datos:{autenticado:false}}]
});
await pausaPortal();
assert.equal(pwaBetaRetirada,0,'Beta conserva su propia PWA de raíz.');
assert.deepEqual(vista.borrados,[],'Beta no borra sus cachés al abrir el Portal.');
assert.deepEqual(vista.destinos,[],'Beta no se reinicia para una migración exclusiva de Producción.');
assert.equal(vista.pedidos.length,1,'Beta consulta la sesión normalmente.');

vista=interfazPortal({search:'?portal-pwa-limpia=1',controlador:{scriptURL:origen+'/sw.js?b=267'}});
await pausaPortal();
assert.deepEqual(vista.destinos,[],'Un controlador raíz persistente no reinicia el Portal una segunda vez.');
assert.match(vista.nodos.portalEstado.textContent,/pestaña o la app/i,'El Portal explica cómo salir de una PWA raíz que no terminó de retirarse.');
assert.equal(vista.pedidos.length,0);

vista=interfazPortal({
  search:'?siguiente=%2Fproduccion%2F',
  respuestas:[{ok:true,datos:{autenticado:false}},{ok:true,datos:{ok:true}},{ok:true,datos:{autenticado:false}}]
});
await pausaPortal();vista.nodos.portalClave.value='clave-de-prueba';await vista.enviar();
assert.deepEqual(vista.destinos,[],'Una respuesta de acceso sin cookie no redirige a Producción en un ciclo.');
assert.equal(vista.nodos.portalAcceso.hidden,false);
assert.match(vista.nodos.portalEstado.textContent,/confirmar la sesión/i);

vista=interfazPortal({
  search:'?siguiente=%2Fproduccion%2F',
  respuestas:[{ok:true,datos:{autenticado:false}},{ok:true,datos:{ok:true}},{ok:true,datos:{autenticado:true}}]
});
await pausaPortal();vista.nodos.portalClave.value='clave-de-prueba';await vista.enviar();
assert.deepEqual(vista.destinos,['/produccion/'],'Una cookie confirmada sí abre el destino solicitado.');

const pedir=(ruta,metodo='GET',cuerpo,headers={},entorno=env)=>worker.fetch(new Request(origen+ruta,{method:metodo,headers:{Origin:origen,Cookie:cookie,...headers},body:cuerpo}),entorno);

assert.deepEqual(JSON.parse(readFileSync(new URL('./_routes.json',import.meta.url),'utf8')).include,['/*'],'El Worker recibe también la raíz y los assets del juego.');
let respuesta=await pedir('/');assert.equal(respuesta.status,200);assert.match(await respuesta.text(),/Portal del Domo/);assert.match(respuesta.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(rutas.at(-1),'/portal','La raíz usa el documento canónico y no el .html que Pages redirige.');
respuesta=await pedir('/portal');assert.equal(respuesta.status,200);assert.match(await respuesta.text(),/Portal del Domo/,'La ruta canónica del Portal no puede volver a la raíz.');
respuesta=await pedir('/portal.html');assert.equal(respuesta.status,200);assert.match(await respuesta.text(),/Portal del Domo/,'La ruta histórica del Portal se normaliza sin una puerta privada.');
assert.equal((await pedir('/portal.css')).status,200);
assert.equal((await pedir('/produccion/')).headers.get('location'),origen+'/?siguiente=%2Fproduccion%2F');
assert.equal((await pedir('/index.html')).headers.get('location'),origen+'/?siguiente=%2Fproduccion%2F');
assert.equal((await pedir('/?sala=AB12')).headers.get('location'),origen+'/?siguiente=%2Fproduccion%2F%3Fsala%3DAB12','Una invitación antigua llega al juego tras el portal.');
assert.equal((await pedir('/api/arte/catalogo')).status,401,'Las API públicas tampoco saltan la puerta.');
respuesta=await pedir('/api/portal/sesion');assert.equal(respuesta.status,200);assert.deepEqual(await respuesta.json(),{autenticado:false});
assert.equal((await pedir('/api/portal/sesion','POST',JSON.stringify({clave}),{Origin:'https://otro.invalid'})).status,403);
assert.equal((await pedir('/api/portal/sesion','POST','[]')).status,400);
assert.equal((await pedir('/api/portal/sesion','POST',JSON.stringify({clave:clave+'x'}))).status,401);
respuesta=await pedir('/api/portal/sesion','POST',JSON.stringify({clave}));assert.equal(respuesta.status,200);assert.deepEqual(await respuesta.json(),{ok:true});
cookie=respuesta.headers.get('set-cookie').split(';')[0];const atributos=respuesta.headers.get('set-cookie');
for(const atributo of ['__Host-caoz-portal=','Secure','HttpOnly','SameSite=Strict','Path=/','Max-Age=28800'])assert.match(atributos,new RegExp(atributo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.deepEqual(await (await pedir('/api/portal/sesion')).json(),{autenticado:true});
assert.deepEqual(await (await pedir('/api/portal/sesion','GET',undefined,{Cookie:cookie+'x'})).json(),{autenticado:false},'Una firma alterada no abre el portal.');
assert.deepEqual(await (await pedir('/api/portal/sesion','GET',undefined,{}, {...env,PORTAL_PASSWORD_HASH:sha(clave+'-nueva')})).json(),{autenticado:false},'Cambiar la contraseña cierra también las sesiones emitidas con la anterior.');

respuesta=await pedir('/produccion/');assert.equal(respuesta.status,200);assert.equal(await respuesta.text(),'Producción');assert.equal(rutas.at(-1),'/','El índice protegido se pide a Assets sin volver a la raíz del Worker.');
respuesta=await pedir('/produccion/index.html');assert.equal(respuesta.status,200);assert.equal(await respuesta.text(),'Producción');assert.equal(rutas.at(-1),'/','El índice explícito no se canoniza fuera de Producción.');
respuesta=await pedir('/produccion/movil.html?escritorio=1');assert.equal(respuesta.status,200);assert.equal(await respuesta.text(),'Móvil');assert.equal(rutas.at(-1),'/movil.html?escritorio=1');
respuesta=await pedir('/produccion/sw.js');assert.equal(await respuesta.text(),'Juego PWA');assert.equal(rutas.at(-1),'/sw.js','El SW del juego se mantiene bajo /produccion/.');
assert.equal((await pedir('/produccion?b=9')).headers.get('location'),origen+'/produccion/?b=9');
assert.equal((await pedir('/index.html?b=9')).headers.get('location'),origen+'/produccion/?b=9');
assert.equal((await pedir('/movil.html?b=9')).headers.get('location'),origen+'/produccion/movil.html?b=9');
assert.equal((await pedir('/produccion/estudio.html?carta=tal')).headers.get('location'),origen+'/estudio?carta=tal');
assert.equal((await pedir('/produccion/sonidos?seleccion=turn')).headers.get('location'),origen+'/sonidos?seleccion=turn');
assert.equal(await (await pedir('/estudio')).text(),'Estudio de Cartas','El estudio sigue disponible tras abrir el portal.');
assert.equal(await (await pedir('/sonidos')).text(),'Estudio de Sonidos','El estudio de sonidos sigue disponible tras abrir el portal.');
assert.equal(await (await pedir('/fisico/')).text(),'Juego Físico');assert.equal(rutas.at(-1),'/fisico/index.html');
respuesta=await pedir('/sw.js');assert.match(await respuesta.text(),/registration\.unregister/);assert.match(respuesta.headers.get('cache-control'),/no-store/);assert.match(respuesta.headers.get('service-worker-allowed'),/^\/$/);

respuesta=await pedir('/api/portal/sesion','DELETE');assert.equal(respuesta.status,200);assert.match(respuesta.headers.get('set-cookie'),/Max-Age=0/);cookie='';
assert.equal((await pedir('/sonidos')).headers.get('location'),origen+'/');
const incompleto={...env,PORTAL_SESSION_KEY:'demasiado-corta'};
assert.equal((await pedir('/api/portal/sesion','GET',undefined,{},incompleto)).status,503,'Una configuración parcial falla cerrada.');
for(let i=0;i<=8;i++)respuesta=await pedir('/api/portal/sesion','POST',JSON.stringify({clave:clave+'z'}),{'CF-Connecting-IP':'203.0.113.50'});
assert.equal(respuesta.status,429,'El noveno intento de la misma ventana se detiene.');
assert.equal(await (await worker.fetch(new Request('https://beta.caoz-tcg.pages.dev/'),env)).text(),'Producción','La beta no hereda el bloqueo del dominio oficial.');
baseD1.db.close();
console.log('Portal: sesión firmada, rutas protegidas, producción virtual, estudios y retiro seguro del SW raíz en verde.');

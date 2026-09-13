/* Contrato del paquete aislado: sólo cuenta, dependencias locales y fuentes intactas. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {exportar,componentesCuenta,entornoCuenta,imagenesCuenta} from './cuenta-exportar.mjs';
import {crearServidor} from './servidor.mjs';
const aqui=path.dirname(fileURLToPath(import.meta.url)),juego=path.resolve(aqui,'../../caoz_tcg');
const hash=b=>createHash('sha256').update(b).digest('hex');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-cuenta-'));
const fuentes=[path.join(aqui,'cuenta.html'),path.join(aqui,'cuenta-fondo.mjs'),...entornoCuenta.map(f=>path.join(aqui,f)),
  ...componentesCuenta.map(f=>path.join(juego,f)),...imagenesCuenta.map(f=>path.join(juego,'art',f)),
  ...['index.html','movil.html','polish-aaa.js','motor.js','final.js','final-core.js','sw.js','coleccion-modelo.js'].map(f=>path.join(juego,f))];
const firmas=()=>Object.fromEntries(fuentes.map(f=>[f,hash(fs.readFileSync(f))]));
const antes=firmas();let servidor;
try{
  const destino=path.join(temporal,'cuenta'),p=exportar(destino),archivo=f=>fs.readFileSync(path.join(destino,f));
  const esperados=['index.html','_headers','procedencia.json','art/logo.webp','cuenta-lab.css','cuenta-lab.js','cuenta-demo.js','cuenta-fondo.css','cuenta-fondo-real.css',
    ...componentesCuenta.map(f=>'juego/'+f)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La cuenta sólo incluye sus componentes declarados; no copia motor, SW ni otras secciones');
  const html=archivo('index.html').toString();
  assert.ok(!/__CSP__|__CUENTA_FONDO__|<iframe|<base\b/i.test(html),'Sin marcadores pendientes ni documentos externos');
  assert.ok(html.includes('<div id="cuentaFondo" aria-hidden="true" inert>'),'El fondo es inerte y queda fuera de la navegación accesible');
  for(const id of ['cuentaFondoCampana','cuentaFondoDomo','cuentaFondoOnline','cuentaFondoExtras'])
    assert.ok(new RegExp('<button[^>]*tabindex="-1"[^>]*id="'+id+'"').test(html),'Botón real sólo presentacional: '+id);
  assert.ok(html.includes('id="cuentaFondoLogo"'),'La marca se toma del menú real');
  const fondoCSS=archivo('cuenta-fondo-real.css').toString();
  assert.ok(!/\.(?:cartaFondo|vscard|lface|lcard|barajaFondo)\b|#(?:field|board|mat|select)\b/.test(fondoCSS),'Sin estilos de cartas, selector o tablero ajenos al fondo');
  for(const nombre of ['gira','respiraLogo','brasa','respira','flota1','flota2','flota3'])
    assert.equal((fondoCSS.match(new RegExp('@keyframes '+nombre+'\\s*\\{','g'))||[]).length,1,'Animación extraída una sola vez: '+nombre);
  function local(valor,desde){
    if(valor.startsWith('#')||valor.startsWith('data:'))return;
    assert.ok(!/^(?:[a-z]+:|\/)/i.test(valor),'Recurso local relativo: '+valor);
    const f=path.resolve(destino,path.dirname(desde),valor.split(/[?#]/)[0]);
    assert.ok(f.startsWith(destino+path.sep)&&fs.existsSync(f),'Dependencia incluida: '+desde+' → '+valor);
  }
  for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))local(m[1],'index.html');
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))assert.equal(m[1].trim(),'','Sin scripts inline');
  for(const f of archivos.filter(f=>f.endsWith('.css'))){
    const css=archivo(f).toString();assert.ok(!/@import/i.test(css),'Sin hojas externas: '+f);
    for(const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))local(m[1].trim(),f);
  }
  for(const f of archivos.filter(f=>f.endsWith('.js'))){
    const js=archivo(f).toString();new vm.Script(js,{filename:f});
    if(!f.startsWith('juego/'))assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\b(?:localStorage|sessionStorage)\s*[.\[]|\bindexedDB\s*\.|\bserviceWorker\s*\.|\bsendBeacon\s*\(|\bdocument\s*\.\s*cookie\b/.test(js),f+' no usa red, cookies ni almacenamiento persistente');
  }
  assert.equal(p.seccion,'cuenta');assert.equal(p.almacenamiento,'memoria temporal');
  for(const clave of ['partida','progresoReal','correoReal'])assert.equal(p[clave],false,clave);
  for(const [f,firma] of Object.entries(p.componentes)){assert.equal(hash(archivo('juego/'+f)),firma);assert.equal(hash(fs.readFileSync(path.join(juego,f))),firma);}
  for(const [f,firma] of Object.entries(p.entorno)){assert.equal(hash(archivo(f)),firma);assert.equal(hash(fs.readFileSync(path.join(aqui,f))),firma);}
  for(const [f,firma] of Object.entries(p.arte)){assert.equal(hash(archivo('art/'+f)),firma);assert.equal(hash(fs.readFileSync(path.join(juego,'art',f))),firma);}
  for(const [f,firma] of Object.entries(p.fuentes))assert.equal(hash(fs.readFileSync(path.join(aqui,f))),firma);
  for(const [f,firma] of Object.entries(p.derivados))assert.equal(hash(archivo(f)),firma);
  for(const [f,firma] of Object.entries(p.fondo.fuentes))assert.equal(hash(fs.readFileSync(path.resolve(aqui,'../..',f))),firma);
  assert.equal(p.fondo.adaptador,hash(fs.readFileSync(path.join(aqui,'cuenta-fondo.mjs'))));
  assert.equal(p.fondo.css,hash(archivo('cuenta-fondo-real.css')));
  for(const clave of ['interacciones','partida','almacenamiento'])assert.equal(p.fondo[clave],false,'Fondo sin '+clave);
  const meta=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i);assert.ok(meta,'CSP en la entrada estática');
  // Se comparan las constantes existentes sin exportar/ejecutar otra sección ni su motor.
  for(const f of ['exportar.mjs','rey-exportar.mjs','sobres-exportar.mjs','servidor.mjs']){
    const fuente=fs.readFileSync(path.join(aqui,f),'utf8'),csp=fuente.match(/const csp="([^"]+)";/);
    assert.ok(csp,'CSP existente: '+f);assert.equal(meta[1],csp[1],f+' conserva la política compartida');
    assert.equal(archivo('_headers').toString(),'/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp[1]+'\n');
  }
  assert.throws(()=>exportar(destino),/vacío/,'No sobrescribir un sitio existente');
  const otro=path.join(temporal,'otro');exportar(otro);
  for(const f of archivos)assert.deepEqual(archivo(f),fs.readFileSync(path.join(otro,f)),'Exportación determinista: '+f);
  const ocupado=path.join(temporal,'ocupado');fs.writeFileSync(ocupado,'conservar');assert.throws(()=>exportar(ocupado),/vacío/);assert.equal(fs.readFileSync(ocupado,'utf8'),'conservar');
  assert.deepEqual(firmas(),antes,'La exportación no cambia sus fuentes ni el juego');
  console.log('✓ Paquete exacto de componentes locales, hashes de procedencia, CSP común, fuentes intactas y salida determinista.');

  // Las dependencias reales conservan sus defaults de producción. Probar la
  // inyección ejecutándolas con getters que rechazan cualquier acceso real.
  const contexto={crypto:webcrypto,TextEncoder,AbortController,Headers,Response,URL,Event,EventTarget,CustomEvent,
    setTimeout,clearTimeout,setInterval,clearInterval};
  for(const nombre of ['localStorage','sessionStorage','indexedDB','fetch','XMLHttpRequest','WebSocket'])
    Object.defineProperty(contexto,nombre,{get(){throw Error('Acceso real prohibido: '+nombre);}});
  vm.createContext(contexto);
  for(const f of ['cuenta-progreso.js','cuenta-servicio.js','cuenta-modelo.js','cuenta-acceso.js'])
    vm.runInContext(archivo('juego/'+f).toString(),contexto,{filename:f});
  vm.runInContext(archivo('cuenta-demo.js').toString(),contexto,{filename:'cuenta-demo.js'});
  const almacenamiento=contexto.CAOZ_CUENTA_DEMO.crearMemoria(),eventos=new EventTarget();let codigo,coordinador,adaptador;
  const transporte=contexto.CAOZ_CUENTA_DEMO.crearTransporte({demora:0,alCodigo:r=>{codigo=r.codigo;}});
  const iniciar=async()=>{
    adaptador=contexto.CAOZ_CUENTA_PROGRESO.crear({storage:almacenamiento,entorno:'beta',ruta:'/',hostname:'beta.caoz-tcg.pages.dev',eventos,intervalo:0});
    const servicio=contexto.CAOZ_CUENTA_SERVICIO.crear({progreso:adaptador,storage:almacenamiento,fetch:transporte.fetch});
    coordinador=contexto.CAOZ_CUENTA_ACCESO.crear({progreso:adaptador,servicio,storage:almacenamiento,eventos});
    await coordinador.iniciar();
  };
  try{
    await iniciar();assert.equal(coordinador.puedeJugar(),false,'El primer acceso no permite entrar sin cuenta');
    assert.equal(coordinador.modelo.invitado(),false,'No hay camino de invitado');
    await coordinador.modelo.solicitar({correo:'viajero@ejemplo.com',nombre:'Ari'});
    await coordinador.modelo.verificar(codigo);assert.equal(coordinador.puedeJugar(),true,'El código vincula la cuenta del entorno temporal');
    transporte.conexion(false);
    await new Promise((resolver,rechazar)=>{
      const limite=setTimeout(()=>rechazar(Error('La cuenta no recibió la desconexión')),1000);let cancelar;
      cancelar=coordinador.suscribir(s=>{if(s.sinConexion&&!s.ocupado){clearTimeout(limite);cancelar?.();resolver();}});
      eventos.dispatchEvent(new Event('offline'));
    });
    assert.equal(coordinador.estado().sinConexion,true,'La desconexión se indica también con la cola vacía');
    almacenamiento.setItem('caoz_records_v1',JSON.stringify({lideres:{},total:{ganadas:2,jugadas:2},online:{ganadas:0,jugadas:0}}));
    adaptador.revisar();await coordinador.guardar();
    assert.equal(coordinador.estado().guardado,'sinConexion');
    const cuenta=coordinador.estado().sesion.id,cola=adaptador.claveCola(cuenta),operacion=JSON.parse(almacenamiento.getItem(cola)).pendiente.operacion;
    coordinador.destruir();adaptador.destruir();await iniciar();
    assert.equal(coordinador.puedeJugar(),true,'La app previamente verificada puede reabrir sin conexión');
    assert.equal(adaptador.capturar().datos.records.total.ganadas,2);
    assert.equal(JSON.parse(almacenamiento.getItem(cola)).pendiente.operacion,operacion,'La recarga no inventa otra operación');
    transporte.conexion(true);await coordinador.guardar();
    assert.equal(transporte.inspeccionar().cuentas[0].progreso.datos.records.total.ganadas,2);
    assert.equal(transporte.inspeccionar().operaciones,1,'La cola se aplica una sola vez');
    assert.equal(coordinador.estado().guardado,'guardado');
    console.log('✓ Componentes reales aislados: código, acceso obligatorio, cola, recarga offline y sincronización sin red ni almacenamiento reales.');
  }finally{coordinador?.destruir();adaptador?.destruir();}

  servidor=crearServidor();await new Promise((resolver,rechazar)=>{servidor.once('error',rechazar);servidor.listen(0,'127.0.0.1',resolver);});
  const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/';
  const entrada=await fetch(base+'cuenta.html');assert.equal(entrada.status,200);assert.equal(await entrada.text(),html);assert.equal(entrada.headers.get('content-security-policy'),meta[1]);
  for(const f of esperados.filter(f=>f.endsWith('.js')||f.endsWith('.css')||f.endsWith('.webp'))){const r=await fetch(base+f);assert.equal(r.status,200,f);assert.deepEqual(Buffer.from(await r.arrayBuffer()),archivo(f),f);}
  for(const f of ['motor.js','juego/motor.js','sw.js','api/cuenta/sesion','api/cuenta/codigo'])assert.equal((await fetch(base+f)).status,404,'Sin rutas de juego o cuenta real: '+f);
  assert.equal((await fetch(base+'cuenta.html',{method:'POST'})).status,405,'Servidor de lectura, sin operaciones de cuenta');
  assert.equal((await fetch(base+'coleccion.html')).status,200,'La entrada anterior sigue disponible');
  assert.deepEqual(await (await fetch(base+'api/arte/catalogo')).json(),{cartas:[]},'El catálogo temporal anterior no cambia');
  console.log('✓ Servidor local sirve los mismos bytes y conserva las otras rutas, sin API real ni escritura.');
}finally{
  if(servidor){servidor.closeAllConnections();await new Promise(r=>servidor.close(r));}
  fs.rmSync(temporal,{recursive:true,force:true});
}

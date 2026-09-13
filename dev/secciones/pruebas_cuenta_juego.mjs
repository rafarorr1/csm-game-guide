/* Cuenta integrada sobre ambas pantallas reales. Sólo la API se reemplaza;
   los correos, la colección y las sesiones de jugadores reales no se consultan. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../caoz_tcg');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const capturas=process.env.CUENTA_CAPTURAS||fs.mkdtempSync(path.join(os.tmpdir(),'cuenta-juego-'));
fs.mkdirSync(capturas,{recursive:true});
const servidor=http.createServer((req,res)=>{
 if(req.url==='/cuenta-otra-pestana'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>Otra pestaña de prueba</title>');return;}
 const u=new URL(req.url,'http://localhost'),archivo=path.resolve(raiz,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!archivo.startsWith(raiz+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(archivo,(error,datos)=>{if(error){res.writeHead(404).end();return;}
  const tipo={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'}[path.extname(archivo)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':tipo,'Cache-Control':'no-store'}).end(datos);
 });
});
await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+servidor.address().port;
let navegador;
try{
 navegador=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 if(process.argv.includes('--borrado-local')){
  const pagina=await navegador.newPage({viewport:{width:1420,height:900},reducedMotion:'reduce'});
  const sabotaje=process.argv.includes('--sabotaje');
  if(sabotaje)await pagina.route('**/final-core.js*',async route=>{
   const codigo=fs.readFileSync(path.join(raiz,'final-core.js'),'utf8').replaceAll('if(window.CAOZ_CUENTA_JUEGO?.vinculada()&&!await','if(window.CAOZ_CUENTA_JUEGO&&!await');
   await route.fulfill({contentType:'text/javascript',body:codigo});
  });
  await pagina.goto(base+'/index.html?test=borrarProgreso&escritorio=1');
  await pagina.waitForFunction(()=>window.PRUEBAS?.terminado,{},{timeout:60000});
  const resultado=await pagina.evaluate(()=>window.PRUEBAS.resultado);
  assert.equal(resultado.mal,sabotaje?1:0,JSON.stringify(resultado));
  if(sabotaje)assert.match(resultado.suites[0].error,/fallo de almacenamiento visible y permite reintentar/);
  console.log(sabotaje?'✓ Sabotaje detectado: esperar sin cuenta rompe el rollback inmediato':'✓ borrarProgreso: ambas pantallas conservan confirmación, rollback, reintento y recarga');
  await pagina.close();
 }else for(const tamano of [{nombre:'desktop',width:1420,height:900,pagina:'index.html?escritorio=1'},{nombre:'movil390',width:390,height:844,pagina:'movil.html'},{nombre:'movil320',width:320,height:568,pagina:'movil.html'}]){
  const contexto=await navegador.newContext({viewport:tamano,reducedMotion:'reduce',serviceWorkers:'block'});
  const pagina=await contexto.newPage();const errores=[];pagina.on('pageerror',e=>errores.push(e.message));
  let sesion=null,nube=null,revision=0,guardados=0,sinConexion=false;
  let identidad={id:'00000000-0000-4000-8000-000000000001',nombre:'Ari',correo:'cuenta@ejemplo.com'};
  await pagina.route('**/api/cuenta/**',async route=>{
   if(sinConexion){await route.abort('internetdisconnected');return;}
   const nombre=new URL(route.request().url()).pathname.split('/').pop(),d=route.request().postDataJSON();let cuerpo;
   if(nombre==='sesion'){if(!sesion){await route.fulfill({status:401,json:{codigo:'SESION'}});return;}cuerpo={sesion,progreso:nube,revision};}
   else if(nombre==='codigo')cuerpo={id:'codigo-prueba',vence:Date.now()+300000,reenvioEn:Date.now()+60000};
   else if(nombre==='verificar'){sesion=identidad;cuerpo={sesion,progreso:nube,revision};}
   else if(nombre==='progreso'){if(d.revision!==revision){await route.fulfill({status:409,json:{codigo:'CONFLICTO',progreso:nube,revision}});return;}nube=d.progreso;revision++;guardados++;cuerpo={progreso:nube,revision};}
   else if(nombre==='salir'){sesion=null;cuerpo={ok:true};}
   else throw Error('Ruta de cuenta inesperada');
   await route.fulfill({json:cuerpo});
  });
  await pagina.addInitScript(()=>{if(!localStorage.getItem('__cuenta_qa_iniciada')){localStorage.setItem('caoz_nombre','Ari');localStorage.setItem('__cuenta_qa_iniciada','1');}});
  await pagina.goto(base+'/'+tamano.pagina);
  await pagina.locator('#mExtras').click();await pagina.locator('#mCuenta').click();
  await pagina.waitForFunction(()=>window.CAOZ_CUENTA_JUEGO?.estado()?.ocupado===false);
  assert.equal(await pagina.evaluate(()=>window.CAOZ_CUENTA_JUEGO.estado().error),'','El primer401 no se presenta como sesión vencida');
  assert.equal(await pagina.locator('[data-foco="tab-crear"]').getAttribute('aria-selected'),'true');
  await pagina.locator('[data-foco="tab-crear"]').click();
  await pagina.locator('[name="nombre"]').fill('Ari');await pagina.locator('[name="correo"]').fill('cuenta@ejemplo.com');
  await pagina.screenshot({path:path.join(capturas,tamano.nombre+'-registro.png')});
  const geometria=await pagina.locator('.cuentaUI').evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,vw:innerWidth,vh:innerHeight};});
  assert(Math.abs(geometria.x+geometria.width/2-geometria.vw/2)<2,'Cuenta centrada horizontalmente');
  assert(geometria.y>=0&&geometria.y+geometria.height<=geometria.vh+1,'Cuenta dentro del visor');
  assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Sin scroll horizontal');
  await pagina.locator('[data-foco="enviar"]').click();await pagina.locator('[name="codigo"]').fill('123456');await pagina.locator('[data-foco="confirmar-codigo"]').click();
  await pagina.locator('[data-foco="vincular"]').click();await pagina.locator('.cuentaUI[data-pantalla="perfil"]').waitFor();
  assert.equal(nube.datos.nombre,'Ari');assert.equal(guardados,1);
  await pagina.evaluate(()=>localStorage.setItem('caoz_nombre','Ari nueva'));
  await pagina.waitForTimeout(1700);
  await pagina.evaluate(()=>window.CAOZ_CUENTA_JUEGO.guardar());
  await pagina.waitForFunction(()=>window.CAOZ_CUENTA_JUEGO.estado().guardado==='guardado');
  assert.equal(nube.datos.nombre,'Ari nueva','Se guarda el cambio del dispositivo');
  sinConexion=true;await pagina.evaluate(()=>localStorage.setItem('caoz_nombre','Ari sin conexión'));
  await pagina.evaluate(()=>window.CAOZ_CUENTA_JUEGO.guardar());
  await pagina.waitForFunction(()=>window.CAOZ_CUENTA_JUEGO.estado().guardado==='sinConexion');
  await pagina.locator('[data-foco="cerrar-sesion"]').click();
  assert.equal(await pagina.locator('.cuentaUI').getAttribute('data-pantalla'),'perfil','No sale ni borra antes de guardar');
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),'Ari sin conexión');
  sinConexion=false;await pagina.evaluate(()=>localStorage.setItem('caoz_nombre','Ari nueva'));
  await pagina.evaluate(()=>window.CAOZ_CUENTA_JUEGO.guardar());
  await pagina.waitForFunction(()=>window.CAOZ_CUENTA_JUEGO.estado().guardado==='guardado');
  await pagina.locator('[data-foco="cerrar-sesion"]').click();await pagina.locator('.cuentaUI[data-pantalla="inicio"]').waitFor();
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),null,'Cerrar sesión no entrega el progreso a otro invitado');
  const guardadaA={identidad,nube,revision};identidad={id:'00000000-0000-4000-8000-000000000002',nombre:'Beto',correo:'b@ejemplo.com'};nube=null;revision=0;
  await pagina.locator('[name="correo"]').fill('b@ejemplo.com');await pagina.locator('[data-foco="enviar"]').click();
  await pagina.locator('[name="codigo"]').fill('123456');await pagina.locator('[data-foco="confirmar-codigo"]').click();
  await pagina.locator('.cuentaUI[data-pantalla="perfil"]').waitFor();
  assert.equal(await pagina.evaluate(()=>window.CAOZ_CUENTA_JUEGO.estado().local),null,'B no recibe el snapshot de A retenido en el modelo');assert.equal(nube,null);
  await pagina.locator('[data-foco="cerrar-sesion"]').click();await pagina.locator('.cuentaUI[data-pantalla="inicio"]').waitFor();
  identidad=guardadaA.identidad;nube=guardadaA.nube;revision=guardadaA.revision;
  await pagina.locator('[name="correo"]').fill('cuenta@ejemplo.com');await pagina.locator('[data-foco="enviar"]').click();
  await pagina.locator('[name="codigo"]').fill('123456');await pagina.locator('[data-foco="confirmar-codigo"]').click();
  await pagina.waitForFunction(()=>['recuperar','conflicto'].includes(window.CAOZ_CUENTA_JUEGO.estado().pantalla));
  if(await pagina.locator('[data-foco="recuperar"]').count())await pagina.locator('[data-foco="recuperar"]').click();
  else{await pagina.locator('[data-foco="elegir-nube"]').check();await pagina.locator('[data-foco="resolver"]').click();}
  await pagina.locator('.cuentaUI[data-pantalla="perfil"]').waitFor();
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),'Ari nueva');
  nube={...nube,datos:{...nube.datos,nombre:'Ari en otro teléfono'}};revision++;
  await pagina.evaluate(()=>localStorage.setItem('caoz_nombre','Ari aquí'));
  await pagina.evaluate(()=>window.CAOZ_CUENTA_JUEGO.guardar());
  await pagina.locator('.cuentaUI[data-pantalla="conflicto"]').waitFor();
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),'Ari aquí','El conflicto no borra el dispositivo');
  await pagina.locator('[data-foco="elegir-nube"]').check();await pagina.locator('[data-foco="resolver"]').click();
  await pagina.locator('.cuentaUI[data-pantalla="perfil"]').waitFor();
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),'Ari en otro teléfono');
  await pagina.screenshot({path:path.join(capturas,tamano.nombre+'-perfil.png')});
  await pagina.locator('[data-foco="volver"]').click();
  assert.equal(await pagina.locator('#cuentaJuego').count(),0);
  await pagina.locator('#mBorrarProgreso').click();
  assert.match(await pagina.locator('#ovPanel').innerText(),/cuenta/);
  await pagina.locator('#borrarProgresoCancelar').click();
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),'Ari en otro teléfono');
  await pagina.reload();await pagina.waitForFunction(()=>window.CAOZ_CUENTA_JUEGO?.estado()?.sesion);
  assert.equal(await pagina.evaluate(()=>localStorage.getItem('caoz_nombre')),'Ari en otro teléfono','Recargar restaura identidad sin importar por sorpresa');
  await pagina.locator('#mExtras').click();await pagina.locator('#mBorrarProgreso').click();
  await Promise.all([pagina.waitForEvent('load'),pagina.locator('#borrarProgresoConfirmar').click()]);
  await pagina.waitForFunction(()=>localStorage.getItem('caoz_nombre')===null);
  assert.equal(nube.datos.nombre,'','Borrado confirmado se guarda también en la cuenta');
  await pagina.waitForFunction(()=>window.CAOZ_CUENTA_JUEGO?.estado()?.sesion);
  const otra=await contexto.newPage();await otra.goto(base+'/cuenta-otra-pestana');
  await otra.evaluate(()=>{
    const llave=Object.keys(localStorage).find(k=>k.startsWith('caoz.cuenta.v1.')&&k.endsWith('.vinculo'));
    const dato=JSON.parse(localStorage.getItem(llave));dato.cuentaId='00000000-0000-4000-8000-000000000003';
    localStorage.setItem(llave,JSON.stringify(dato));localStorage.setItem('caoz_nombre','Otro jugador protegido');
  });
  await pagina.locator('#cuentaCambioExterno[open]').waitFor();
  const escritura=await pagina.evaluate(()=>{try{localStorage.setItem('caoz_nombre','Escritura de la partida antigua');return true;}catch(_){return false;}});
  assert.equal(escritura,false,'Se rechaza la escritura antigua antes de tocar datos de otra cuenta');
  assert.equal(await otra.evaluate(()=>localStorage.getItem('caoz_nombre')),'Otro jugador protegido');
  await pagina.keyboard.press('Escape');assert.equal(await pagina.locator('#cuentaCambioExterno[open]').count(),1,'No permite seguir jugando con el propietario anterior');
  await otra.close();
  assert.deepEqual(errores,[]);await contexto.close();console.log('✓ '+tamano.nombre+': acceso, vínculo, guardado, cierre, recuperación, borrado, aislamiento entre cuentas/pestañas y geometría');
 }
 console.log('Capturas: '+capturas);
}finally{await navegador?.close();await new Promise(r=>servidor.close(r));}

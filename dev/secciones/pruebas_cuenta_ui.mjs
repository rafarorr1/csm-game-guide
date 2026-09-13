/* Cuenta aislada:17 recorridos por pantalla, sin correo ni progreso reales.
   PLAYWRIGHT_MODULE permite usar la instalación del entorno; CHROME_CHANNEL
   elige Chrome. BASE_URL revisa la sección publicada. Sin BASE_URL exporta
   un paquete temporal y lo sirve estático, sin generar ni cargar el juego.
   --capturas <carpeta> conserva evidencias. --sabotaje ejecuta únicamente la
   regresión puntual de foco, primero verde y después roja sin el arreglo. */
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {exportar} from './cuenta-exportar.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-cuenta-ui-'));
const carpeta=path.join(temporal,'paquete');
const i=process.argv.indexOf('--capturas');
if(i>=0&&!process.argv[i+1])throw Error('Indica una carpeta después de --capturas.');
const salida=path.resolve(i>=0?process.argv[i+1]:path.join(temporal,'capturas'));fs.mkdirSync(salida,{recursive:true});
const pantallas=[{nombre:'desktop',width:1420,height:900},{nombre:'movil390',width:390,height:844},{nombre:'movil320',width:320,height:568}];
const resultados=[];let servidor,navegador;
async function comprobarPestanas(p){
 await p.getByRole('tab',{name:'Crear cuenta',exact:true}).focus();
 await p.keyboard.press('ArrowRight');
 assert.equal(await p.getByRole('tab',{name:'Entrar',exact:true}).getAttribute('aria-selected'),'true','Derecha activa Entrar');
 await p.keyboard.press('ArrowLeft');
 assert.equal(await p.getByRole('tab',{name:'Crear cuenta',exact:true}).getAttribute('aria-selected'),'true','Izquierda vuelve a Crear sin reenfocar con ratón');
}
async function recorrer(v,base){
 const contexto=await navegador.newContext({viewport:{width:v.width,height:v.height},isMobile:v.width<600,hasTouch:v.width<600,deviceScaleFactor:1});
 const r={pantalla:v.nombre,ok:true,pasos:[],errores:[],geometria:[],peticiones:[]};resultados.push(r);
 await contexto.addInitScript(()=>{
  const guardar=localStorage,temporal=sessionStorage;guardar.setItem('qa-progreso-sentinela','conservar');temporal.setItem('qa-sesion-sentinela','conservar');
  const ahora=Date.now;window.__qaReloj=0;Date.now=()=>ahora()+window.__qaReloj;
  window.__qaAccesos=[];const impedir=n=>{window.__qaAccesos.push(n);throw Error('La vista aislada intentó usar '+n);};
  for(const n of ['localStorage','sessionStorage','indexedDB'])Object.defineProperty(window,n,{configurable:true,get:()=>impedir(n)});
  for(const n of ['fetch','XMLHttpRequest','WebSocket','EventSource'])window[n]=()=>impedir(n);
  Object.defineProperty(document,'cookie',{configurable:true,get:()=>impedir('cookie'),set:()=>impedir('cookie')});
  window.__qaPersistencia=()=>({local:guardar.getItem('qa-progreso-sentinela'),sesion:temporal.getItem('qa-sesion-sentinela'),localTotal:guardar.length,sesionTotal:temporal.length});
 });
 const p=await contexto.newPage();p.on('pageerror',e=>r.errores.push(e.message));p.on('requestfailed',q=>r.errores.push(q.url()+': '+q.failure()?.errorText));p.on('request',q=>r.peticiones.push(q.url()));
 async function paso(nombre,fn){try{await fn();r.pasos.push({nombre,ok:true});}catch(e){r.ok=false;r.pasos.push({nombre,ok:false,error:e.message});await p.screenshot({path:path.join(salida,v.nombre+'-fallo-'+r.pasos.length+'.png')});}}
 async function fase(nombre){await p.locator('.cuentaUI[data-pantalla="'+nombre+'"]').waitFor();await p.waitForTimeout(380);}
 async function foto(nombre){await p.screenshot({path:path.join(salida,v.nombre+'-'+nombre+'.png')});}
 async function medir(nombre){const g=await p.locator('.cuentaUI').evaluate(el=>{const a=el.getBoundingClientRect(),lab=document.querySelector('.cuentaLaboratorio').getBoundingClientRect();return {x:a.x,y:a.y,w:a.width,h:a.height,bottom:a.bottom,vw:innerWidth,vh:innerHeight,lab:lab.bottom,bodyW:document.body.scrollWidth,bodyH:document.body.scrollHeight};});r.geometria.push({nombre,...g});assert.ok(g.x>=-1&&g.y>=g.lab-1&&g.x+g.w<=g.vw+1&&g.bottom<=g.vh+1,nombre+' debe quedar dentro del visor: '+JSON.stringify(g));assert.ok(Math.abs(g.x+g.w/2-g.vw/2)<=2,nombre+' debe estar centrado horizontalmente');assert.ok(g.bodyW<=g.vw+1&&g.bodyH<=g.vh+1,nombre+' no debe desplazar la página');}
 async function cargar(estado='nuevo'){const url=new URL(base);url.searchParams.set('estado',estado);await p.goto(url.toString());await fase('inicio');}
 async function codigo(){await p.locator('[data-foco=enviar]').click();await fase('codigo');await p.locator('#cuentaLabUsar').click();}
 async function autenticar(){await codigo();await p.locator('[data-foco=confirmar-codigo]').click();}
 async function elegirEscenario(s){await p.locator('#cuentaLabAjustes').click();await p.locator('#cuentaLabEscenario').selectOption(s);await p.locator('#cuentaLabAjustes').click();await fase('inicio');}
 try{
  await cargar();await foto('inicio');await paso('Inicio centrado y envío visible sin desplazar',async()=>{await medir('inicio');const r=await p.locator('[data-foco=enviar]').evaluate(n=>({bottom:n.getBoundingClientRect().bottom,vh:innerHeight}));assert.ok(r.bottom<=r.vh+1,'Enviar código debe verse completo al abrir');});
  await paso('Tabs y edición del correo con teclado',async()=>{await comprobarPestanas(p);await p.locator('input[name=correo]').fill('viajero@ejemplo.com');await p.locator('input[name=nombre]').fill('Ari');});
  await codigo();await foto('codigo');await paso('Código centrado y reenvío protegido',async()=>{await medir('codigo');assert.ok(await p.locator('[data-foco=reenviar]').isDisabled());});
  await paso('Código erróneo mantiene el formulario',async()=>{const correcto=await p.locator('#cuentaLabCodigo').innerText();await p.locator('input[name=codigo]').fill(correcto==='000000'?'000001':'000000');await p.locator('[data-foco=confirmar-codigo]').click();await p.locator('.cuentaError:not([hidden])').waitFor();assert.match(await p.locator('.cuentaError').innerText(),/código|coincide/i);await fase('codigo');});
  await p.locator('#cuentaLabUsar').click();await p.locator('[data-foco=confirmar-codigo]').click();await fase('vincular');await foto('vincular');await paso('Vincular muestra el progreso local',async()=>{await medir('vincular');assert.match(await p.locator('.cuentaResumen').innerText(),/Ari/);assert.match(await p.locator('.cuentaResumen').innerText(),/Fender/);});
  await p.locator('[data-foco=vincular]').click();await fase('perfil');await foto('perfil');await paso('Perfil guardado tras vincular',async()=>{await medir('perfil');assert.match(await p.locator('.cuentaGuardado').innerText(),/Guardado en tu cuenta/);assert.match(await p.locator('.cuentaResumen').innerText(),/Fender/);});
  await paso('Salida y regreso conservan el perfil',async()=>{await p.locator('[data-foco=volver]').click();await p.locator('#cuentaLabSalida:not([hidden])').waitFor();await p.locator('#cuentaLabVolver').click();await fase('perfil');});
  await paso('Cerrar sesión limpia los datos del formulario',async()=>{await p.locator('[data-foco=cerrar-sesion]').click();await fase('inicio');assert.equal(await p.locator('input[name=correo]').inputValue(),'');});
  await elegirEscenario('conflicto');await autenticar();await fase('conflicto');await foto('conflicto');await paso('Conflicto sin selección implícita',async()=>{await medir('conflicto');assert.ok(await p.locator('[data-foco=resolver]').isDisabled());assert.equal(await p.locator('input[type=radio]:checked').count(),0);});
  await paso('Seleccionar local exige confirmación adicional',async()=>{await p.locator('[data-foco=elegir-local]').check();await p.locator('[data-foco=resolver]').click();await p.locator('.cuentaConfirmacion').waitFor();await foto('confirmacion');await p.locator('[data-foco=revisar]').click();await p.locator('[data-foco=elegir-nube]').check();await p.locator('[data-foco=resolver]').click();await fase('perfil');assert.match(await p.locator('.cuentaResumen').innerText(),/Lyra/);assert.match(await p.locator('.cuentaResumen').innerText(),/Rafaela/);});
  await elegirEscenario('conflicto');await autenticar();await fase('conflicto');await paso('Confirmar local conserva el progreso local como activo',async()=>{await p.locator('[data-foco=elegir-local]').check();await p.locator('[data-foco=resolver]').click();await p.locator('[data-foco=confirmar-local]').click();await fase('perfil');assert.match(await p.locator('.cuentaResumen').innerText(),/Fender/);});
  await elegirEscenario('vacio');await autenticar();await fase('perfil');await paso('Jugador nuevo entra sin inventar progreso',async()=>{assert.match(await p.locator('.cuentaResumen').innerText(),/Mazo por elegir/);assert.equal(await p.locator('#cuentaLabLocal').innerText(),'0');assert.equal(await p.locator('#cuentaLabNube').innerText(),'0');await medir('nuevo-sin-progreso');});
  await paso('Menú local y guardado conectado',async()=>{await p.locator('[data-foco=volver]').click();await p.locator('#cuentaLabVictoria').click();await p.waitForFunction(()=>document.getElementById('cuentaLabNube').textContent==='1');assert.equal(await p.locator('#cuentaLabLocal').innerText(),'1');await foto('menu-conectado');});
  await paso('Offline acumula y conserva al recargar la app',async()=>{
    await p.locator('#cuentaLabConexion').check();await p.locator('#cuentaLabVictoria').click();await p.locator('#cuentaLabVictoria').click();
    await p.locator('#cuentaLabEstado[data-guardado=sinConexion]').waitFor();assert.equal(await p.locator('#cuentaLabLocal').innerText(),'3');assert.equal(await p.locator('#cuentaLabNube').innerText(),'1');
    await p.locator('#cuentaLabRecargar').click();await p.locator('#cuentaLabSalida:not([hidden])').waitFor();
    assert.equal(await p.locator('#cuentaLabLocal').innerText(),'3');assert.equal(await p.locator('#cuentaLabNube').innerText(),'1');await foto('menu-offline');
    await p.locator('#cuentaLabVolver').click();await fase('perfil');assert.match(await p.locator('[data-foco=volver]').innerText(),/sin conexión/);await foto('perfil-offline');await p.locator('[data-foco=volver]').click();
  });
  await paso('Reconexión sincroniza una vez el total acumulado',async()=>{
    await p.locator('#cuentaLabConexion').uncheck();await p.waitForFunction(()=>document.getElementById('cuentaLabNube').textContent==='3');
    await p.locator('#cuentaLabEstado[data-guardado=guardado]').waitFor();await p.locator('#cuentaLabRecargar').click();await p.locator('#cuentaLabSalida:not([hidden])').waitFor();
    assert.equal(await p.locator('#cuentaLabNube').innerText(),'3');assert.equal(await p.locator('#cuentaLabLocal').innerText(),'3');
  });
  await elegirEscenario('entrar');await autenticar();await fase('recuperar');await paso('Cuenta existente requiere recuperar antes de entrar',async()=>{assert.equal(await p.locator('[data-foco=volver]').count(),0);await p.locator('[data-foco=recuperar]').click();await fase('perfil');assert.match(await p.locator('.cuentaResumen').innerText(),/Lyra/);});
  await elegirEscenario('nuevo');await paso('Primer acceso bloqueado, sin invitado ni escape',async()=>{assert.equal(await p.locator('[data-foco=invitado]').count(),0);assert.equal(await p.locator('[data-foco=cerrar]').isVisible(),false);await p.keyboard.press('Escape');assert.equal(await p.locator('#cuentaLabSalida').isHidden(),true);await medir('obligatorio');});
  await paso('Primer acceso offline pide internet y permite reintentar',async()=>{await p.locator('#cuentaLabConexion').check();await p.locator('.cuentaError:not([hidden])').waitFor();assert.match(await p.locator('.cuentaError').innerText(),/internet/i);await p.locator('#cuentaLabRecargar').click();await fase('inicio');assert.equal(await p.locator('#cuentaLabSalida').isHidden(),true);await foto('primer-acceso-offline');await p.locator('#cuentaLabConexion').uncheck();await p.waitForFunction(()=>document.querySelector('.cuentaUI').dataset.ocupado==='false');await codigo();});
  await paso('Caducidad y nuevo código',async()=>{await p.evaluate(()=>window.__qaReloj+=301000);await p.waitForTimeout(1100);assert.ok(await p.locator('[data-foco=confirmar-codigo]').isDisabled());await p.locator('[data-foco=reenviar]').click();await p.waitForTimeout(700);assert.ok(await p.locator('[data-foco=reenviar]').isDisabled());await p.locator('#cuentaLabUsar').click();await p.locator('[data-foco=confirmar-codigo]').click();await fase('vincular');});
  await paso('Sin acceso persistente, cookies, API o juego',async()=>{assert.deepEqual(await p.evaluate(()=>window.__qaAccesos),[]);assert.deepEqual(await p.evaluate(()=>window.__qaPersistencia()),{local:'conservar',sesion:'conservar',localTotal:1,sesionTotal:1});assert.equal((await contexto.cookies()).length,0);assert.deepEqual(r.errores,[]);for(const u of r.peticiones){const a=new URL(u);assert.ok(a.origin===new URL(base).origin,'Sin externos: '+u);assert.ok(!/api\/|motor\.js|sw\.js|final\.js/.test(a.pathname),'Sin recursos del juego: '+u);}});
 }catch(e){r.ok=false;r.error=e.stack;await foto('fallo-final');}
 finally{await contexto.close();fs.writeFileSync(path.join(salida,v.nombre+'.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({pantalla:v.nombre,ok:r.ok,pasos:r.pasos.length,fallos:r.pasos.filter(x=>!x.ok),error:r.error},null,2));}
}
/* El modo puntual verifica rojo/verde en390px, sin repetir el resto del recorrido.
   El sabotaje modifica sólo una respuesta de la copia exportada, nunca la fuente. */
async function comprobarSabotaje(base){
 const rutaFuente=new URL('../../caoz_tcg/cuenta-ui.js',import.meta.url),fuenteAntes=fs.readFileSync(rutaFuente);
 for(const sabotaje of [false,true]){
  const contexto=await navegador.newContext({viewport:{width:390,height:844}}),p=await contexto.newPage();let retirado=false;
  try{
   if(sabotaje)await contexto.route('**/juego/cuenta-ui.js',async ruta=>{
    const respuesta=await ruta.fetch(),js=await respuesta.text();
    const arreglo=`const destino=cambioDePestana?contenido.querySelector('[role="tab"][aria-selected="true"]'):titulo;`;
    assert.ok(js.includes(arreglo),'El sabotaje debe encontrar exactamente el arreglo del foco');
    retirado=true;await ruta.fulfill({response:respuesta,body:js.replace(arreglo,'const destino=titulo;')});
   });
   await p.goto(base);await p.locator('.cuentaUI[data-pantalla=inicio]').waitFor();await p.waitForTimeout(400);
   if(sabotaje){await assert.rejects(()=>comprobarPestanas(p),/Izquierda vuelve a Crear/,'La regresión debe fallar sin el arreglo');assert.ok(retirado);}
   else await comprobarPestanas(p);
   await p.screenshot({path:path.join(salida,'foco-'+(sabotaje?'rojo':'verde')+'.png')});
  }finally{await contexto.close();}
 }
 assert.deepEqual(fs.readFileSync(rutaFuente),fuenteAntes,'El sabotaje nunca modifica el checkout');
 resultados.push({pantalla:'movil390',ok:true,modo:'sabotaje',verdeConArreglo:true,rojoSinArreglo:true});
 console.log('✓ Regresión del foco en390px: flechas verdes con arreglo, rojas sin él; fuentes intactas.');
}
(async()=>{
 let base=process.env.BASE_URL;
 if(!base){exportar(carpeta);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.json':'application/json'};servidor=http.createServer((q,s)=>{try{const u=new URL(q.url,'http://localhost'),f=path.resolve(carpeta,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(carpeta+path.sep)||!fs.statSync(f).isFile())throw Error();s.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});s.end(fs.readFileSync(f));}catch{ s.writeHead(404);s.end('No disponible');}});await new Promise(r=>servidor.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+servidor.address().port+'/';}
 navegador=await chromium.launch({channel:process.env.CHROME_CHANNEL||'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
 if(process.argv.includes('--sabotaje'))await comprobarSabotaje(base);
 else await Promise.all(pantallas.map(v=>recorrer(v,base)));fs.writeFileSync(path.join(salida,'resultado.json'),JSON.stringify({base,resultados},null,2));
 if(resultados.some(r=>!r.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await navegador?.close();if(servidor)await new Promise(r=>servidor.close(r));fs.rmSync(temporal,{recursive:true,force:true});});

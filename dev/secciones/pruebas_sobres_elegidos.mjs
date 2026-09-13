/* Recompensa → sobres sellados por colección → carrusel → apertura.
   Sólo componentes reales y almacenamiento efímero del laboratorio. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=process.env.BASE_URL?null:crearServidor();
if(servidor)await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
const base=process.env.BASE_URL||'http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html';
const arg=process.argv.indexOf('--capturas'),carpeta=arg<0?null:path.resolve(process.argv[arg+1]);if(carpeta)fs.mkdirSync(carpeta,{recursive:true});
function url(vista,estado){const u=new URL(base);u.searchParams.set('vista',vista);u.searchParams.set('estado',estado);if(estado==='sobres')u.searchParams.set('pestana','sobres');return u.href;}
const inventario=p=>p.evaluate(()=>CAOZ_COLECCION.inventarioSobres());
const cantidades=p=>p.evaluate(()=>CAOZ_COLECCION.leer().cantidades);
async function sumar(p,grupo,n=1){for(let i=0;i<n;i++)await p.locator('.coleccionRecompensaGrupo[data-grupo="'+grupo+'"] .coleccionRecompensaMas').click();}
async function cabe(p,selector){const d=await p.locator(selector).evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {texto:n.textContent,x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};}));assert.ok(d.length&&d.every(r=>r.x>=-1&&r.y>=-1&&r.x+r.w<=r.vw+1&&r.y+r.h<=r.vh+1),'El control cabe en pantalla: '+JSON.stringify(d));}
async function deslizar(p,movil){
  const r=await p.locator('.coleccionCarruselSobres').boundingBox(),a={x:r.x+r.width*.78,y:r.y+r.height*.45},b={x:r.x+r.width*.14,y:a.y};
  if(movil){const c=await p.context().newCDPSession(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=10;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/10,y:a.y}]});await p.waitForTimeout(16);}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
  else{await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:12});await p.mouse.up();}
}
async function terminarSobre(p){
  await p.locator('.sobresApertura[data-fase="sellado"]').waitFor();await p.locator('.sobresAccion').click();await p.locator('.sobresApertura[data-fase="pila"]').waitFor();
  for(let i=0;i<5;i++){await p.locator('.sobresAccion').click();await p.locator('.sobresApertura[data-fase="'+(i===4?'ultima':'pila')+'"]').waitFor();}
  await p.locator('.sobresAccion').click();await p.locator('.sobresApertura[data-fase="terminado"]').waitFor();assert.equal(await p.locator('.sobresResumen [role=listitem]').count(),5);await p.locator('.sobresAccion').click();await p.locator('.coleccionCarruselSobres').waitFor();
}
// El destino debe sobrevivir al scroll suave: el centro visual todavía pasa
// por otros sobres durante varios fotogramas, pero Abrir ya representa el elegido.
async function probarMovimientoNormal(p,width,height){
  const elegido=()=>p.locator('.coleccionCarruselSobres').getAttribute('data-grupo');
  const centrado=grupo=>p.waitForFunction(id=>{const c=document.querySelector('.coleccionCarruselSobres'),b=c?.querySelector('[data-grupo="'+id+'"]');return b&&Math.abs(b.offsetLeft+b.offsetWidth/2-c.scrollLeft-c.clientWidth/2)<2;},grupo);
  await p.locator('.coleccionCarruselSobres').focus();await p.keyboard.press('Home');await centrado('trucos');
  await p.emulateMedia({reducedMotion:'no-preference'});
  const flecha=await p.evaluate(async()=>{document.querySelector('.coleccionSobreSiguiente').click();await new Promise(r=>setTimeout(r,60));return document.querySelector('.coleccionCarruselSobres').dataset.grupo;});
  assert.equal(flecha,'juramentos','El scroll intermedio no reemplaza la selección de la flecha');
  await centrado('juramentos');
  await p.locator('.coleccionCarruselSobres').focus();await p.keyboard.press('Home');await centrado('trucos');
  const fin=await p.evaluate(async()=>{document.querySelector('.coleccionCarruselSobres').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));await new Promise(r=>setTimeout(r,60));return document.querySelector('.coleccionCarruselSobres').dataset.grupo;});
  assert.equal(fin,'caos','End conserva el destino mientras se anima');
  await p.setViewportSize({width:width+24,height:height+32});await centrado('caos');
  assert.equal(await elegido(),'caos','Redimensionar durante la animación centra el destino solicitado');
  await p.setViewportSize({width,height});await centrado('caos');
  await p.locator('.coleccionCarruselSobres').focus();await p.keyboard.press('Home');await centrado('trucos');
  const antes=await inventario(p);
  const apertura=await p.evaluate(async()=>{
    document.querySelector('.coleccionSobreSiguiente').click();await new Promise(r=>setTimeout(r,60));
    const grupo=document.querySelector('.coleccionCarruselSobres').dataset.grupo,b=document.querySelector('.coleccionAbrirSobre'),habilitado=!b.disabled;
    if(habilitado)b.click();return {grupo,habilitado,abierto:CAOZ_COLECCION.pendiente()?.grupo||null};
  });
  assert.equal(apertura.grupo,'juramentos','Abrir conserva el sobre solicitado aunque todavía se esté moviendo');
  if(apertura.habilitado)assert.equal(apertura.abierto,'juramentos','Un clic rápido nunca consume el tipo anterior');
  else{await p.locator('.coleccionAbrirSobre:enabled').waitFor();await p.locator('.coleccionAbrirSobre').click();assert.equal(await p.evaluate(()=>CAOZ_COLECCION.pendiente()?.grupo),'juramentos');}
  assert.deepEqual(await inventario(p),antes.map(v=>({...v,cantidad:v.cantidad-(v.grupo==='juramentos'?1:0)})).filter(v=>v.cantidad>0),'Sólo se consume una unidad del destino de la animación');
}
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height]of [['desktop',1440,900],['movil',390,844],['movil',320,568]]){
    const contexto=await navegador.newContext({viewport:{width,height},isMobile:vista==='movil',hasTouch:vista==='movil',reducedMotion:'reduce'}),p=await contexto.newPage(),errores=[];
    p.on('pageerror',e=>errores.push(e.message));p.setDefaultTimeout(20000);
    await contexto.addInitScript(()=>localStorage.setItem('centinela-sobres-elegidos','intacto'));
    const memoria=fs.readFileSync(new URL('./memoria.js',import.meta.url),'utf8').replace('setItem:(k,v)=>{','setItem:(k,v)=>{if(window.CAOZ_QA_FALLO_GUARDADO)throw Error("Sin espacio de prueba");');
    await p.route('**/memoria.js',r=>r.fulfill({contentType:'text/javascript',body:memoria}));
    const captura=async nombre=>{if(carpeta)await p.screenshot({path:path.join(carpeta,vista+'-'+width+'-'+nombre+'.png')});};
    try{
      await p.goto(url(vista,'premio-campana'));await p.locator('#coleccionPanel[data-vista="recompensa"]').waitFor();
      assert.equal(await p.evaluate(()=>CAOZ_COLECCION.sobres()),3);assert.deepEqual(await inventario(p),[]);assert.equal(await p.locator('.coleccionRecompensaGrupo').count(),3);
      const cartasAntes=await cantidades(p);assert.ok(await p.locator('.coleccionGuardarSobres').isDisabled());
      await sumar(p,'trucos',2);await sumar(p,'juramentos');await cabe(p,'.coleccionGuardarSobres');await captura('elegir-tres');
      assert.equal(await p.locator('.coleccionRecompensaGrupo .sobresVistaLienzo').count(),3,'Los tres premios usan la impresión real de su envoltura');
      await p.locator('.coleccionRecompensaGrupo[data-grupo="caos"] .coleccionRecompensaContenido').click();
      assert.equal(await p.locator('#coleccionContenidoGrupo>span').count(),48);assert.ok((await p.locator('#coleccionContenidoGrupo').textContent()).includes('Thal'));
      await p.locator('#coleccionContenidoGrupo>span').last().scrollIntoViewIfNeeded();await cabe(p,'#coleccionContenidoGrupo>span:last-child');
      await p.locator('#coleccionContenidoGrupo>span').first().scrollIntoViewIfNeeded();await cabe(p,'#coleccionContenidoGrupo>span:first-child');
      await p.locator('.coleccionVolverSobres').click();assert.equal(await p.locator('.coleccionEleccionCuenta').getAttribute('data-elegidos'),'3','Consultar contenido conserva la elección');
      await p.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=true);await p.locator('.coleccionGuardarSobres').click();
      assert.deepEqual(await inventario(p),[]);assert.equal(await p.evaluate(()=>CAOZ_COLECCION.recompensasPendientes()[0].cantidad),3);assert.ok(await p.locator('.coleccionGuardarSobres').isEnabled());
      await p.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=false);await p.locator('.coleccionGuardarSobres').click();await p.locator('.coleccionCarruselSobres').waitFor();
      assert.deepEqual(await inventario(p),[{grupo:'trucos',cantidad:2},{grupo:'juramentos',cantidad:1}]);assert.deepEqual(await cantidades(p),cartasAntes,'Elegir sobres no concede cartas ni los abre');
      assert.equal(await p.evaluate(()=>CAOZ_COLECCION.pendiente()),null);await cabe(p,'.coleccionAbrirSobre');await captura('guardados');
      await deslizar(p,vista==='movil');await p.waitForFunction(()=>document.querySelector('.coleccionSobreGuardado[data-grupo="juramentos"]')?.getAttribute('aria-pressed')==='true');
      assert.equal(await p.evaluate(()=>CAOZ_COLECCION.pendiente()),null,'El gesto de deslizar nunca abre un sobre');
      await p.locator('.coleccionSobreAnterior').click();await p.waitForFunction(()=>document.querySelector('.coleccionSobreGuardado[data-grupo="trucos"]')?.getAttribute('aria-pressed')==='true');
      await p.locator('.coleccionCarruselSobres').focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.coleccionSobreGuardado[data-grupo="juramentos"]')?.getAttribute('aria-pressed')==='true');
      await p.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=true);await p.locator('.coleccionAbrirSobre').click();
      assert.deepEqual(await inventario(p),[{grupo:'trucos',cantidad:2},{grupo:'juramentos',cantidad:1}]);assert.equal(await p.evaluate(()=>CAOZ_COLECCION.pendiente()),null,'Un fallo al abrir no consume el sobre');
      assert.ok(await p.locator('.coleccionAbrirSobre').isEnabled());await p.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=false);
      await p.locator('.coleccionAbrirSobre').click();await p.locator('.sobresApertura[data-fase="sellado"][data-grupo="juramentos"]').waitFor();
      const pendiente=await p.evaluate(()=>CAOZ_COLECCION.pendiente());assert.equal(pendiente.grupo,'juramentos');assert.deepEqual(await inventario(p),[{grupo:'trucos',cantidad:2}]);
      assert.ok(await p.evaluate(()=>{const m=CAOZ_COLECCION,g=m.grupos().find(g=>g.id==='juramentos');return m.pendiente().cartas.every(c=>g.ids.includes(c.id));}));await captura('sobre-verde');
      await p.locator('.coleccionCerrar').click();await p.getByRole('button',{name:'Abrir colección',exact:true}).click();await p.locator('.sobresApertura[data-fase="sellado"]').waitFor();
      assert.deepEqual(await p.evaluate(()=>CAOZ_COLECCION.pendiente()),pendiente,'Reabrir conserva el resultado y el grupo');await terminarSobre(p);assert.equal(await p.evaluate(()=>CAOZ_COLECCION.sobres()),2);
      await p.goto(url(vista,'premio-domo'));await p.locator('#coleccionPanel[data-vista="recompensa"]').waitFor();await sumar(p,'caos');await p.locator('.coleccionGuardarSobres').click();await p.locator('.coleccionCarruselSobres').waitFor();
      assert.deepEqual(await inventario(p),[{grupo:'caos',cantidad:1}]);await p.locator('.coleccionAbrirSobre').click();await p.locator('.sobresApertura[data-grupo="caos"]').waitFor();await captura('sobre-rojo');
      await p.goto(url(vista,'legado-sobres'));await p.locator('#coleccionPanel[data-vista="recompensa"]').waitFor();await sumar(p,'trucos');await sumar(p,'juramentos');await sumar(p,'caos');await p.locator('.coleccionGuardarSobres').click();await p.locator('.coleccionCarruselSobres').waitFor();
      assert.equal(await p.evaluate(()=>CAOZ_COLECCION.recompensasPendientes()[0].cantidad),2);assert.equal(await p.evaluate(()=>CAOZ_COLECCION.sobres()),5);await p.locator('.coleccionElegirPendientes').click();await sumar(p,'caos',2);await p.locator('.coleccionGuardarSobres').click();await p.locator('.coleccionCarruselSobres').waitFor();
      assert.deepEqual(await inventario(p),[{grupo:'trucos',cantidad:1},{grupo:'juramentos',cantidad:1},{grupo:'caos',cantidad:3}]);assert.equal(await p.evaluate(()=>CAOZ_COLECCION.recompensasPendientes().length),0);await captura('tres-colores');
      await probarMovimientoNormal(p,width,height);
      const almacen=await contexto.storageState();assert.ok(almacen.origins.every(o=>o.localStorage.length===1&&o.localStorage[0].name==='centinela-sobres-elegidos'&&o.localStorage[0].value==='intacto'),'Las pruebas no tocan el progreso persistente');
      assert.deepEqual(errores,[]);console.log('✓ '+vista+' '+width+'×'+height+': recompensas 1/3, repetidos, guardado y reintento, carrusel con gesto/teclado, movimiento normal y resize, colores, apertura propia y legado.');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();if(servidor)await new Promise(resolve=>servidor.close(resolve));}

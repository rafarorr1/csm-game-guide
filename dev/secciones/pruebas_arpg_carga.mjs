/* Arranque real en navegador: pantalla temprana, recursos pendientes y recuperación.
   Cada caso usa un contexto vacío; los fallos se inyectan sólo en sus solicitudes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {crearServidor} from './servidor.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const filtro=process.env.ARPG_CARGA_CASO||'';
assert(!filtro||['vendor','texturas','vigilancia','reintento','excepcion','webgl','editor','inspector'].includes(filtro),'ARPG_CARGA_CASO desconocido: '+filtro);
const incluir=nombre=>!filtro||filtro===nombre;
const servidor=crearServidor();
await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/';
const carpeta=path.resolve(process.env.ARPG_CARGA_SALIDA||fileURLToPath(new URL('../../../../outputs/carga-arpg/',import.meta.url)));
fs.mkdirSync(carpeta,{recursive:true});
const tiempoMaximo=120000;
let navegador,inspector;

async function contextoNuevo({sinWebGL=false}={}){
  const contexto=await navegador.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const pagina=await contexto.newPage(),errores=[];pagina.setDefaultTimeout(tiempoMaximo);
  pagina.on('pageerror',e=>errores.push(e.message));
  pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
  if(sinWebGL)await pagina.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(tipo,...opciones){return tipo==='webgl2'?null:original.call(this,tipo,...opciones);};
  });
  return {contexto,pagina,errores};
}
async function abrir(pagina,url=base+'arpg-three.html?captura=1'){
  await pagina.goto(url,{waitUntil:'domcontentloaded',timeout:tiempoMaximo});
  await pagina.waitForFunction(()=>!!window.CAOZ_ARPG_CARGA);
}
async function lista(pagina){
  await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||(window.CAOZ_ARPG_CARGA?.estado().completa&&window.CAOZ_ARPG_THREE_REVISION?.listo()));
  assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,await pagina.locator('#cargaTexto').textContent());
  assert.equal(await pagina.locator('#cargaInicial').isVisible(),false,'La carga desaparece cuando la partida está preparada');
  const e=await pagina.evaluate(()=>{
    // captura=1 conserva el primer cuadro; leerlo antes de pedir otro dibujo
    // distingue una escena lista de una bandera activada prematuramente.
    const g=document.getElementById('lienzo').getContext('webgl2'),pixel=new Uint8Array(4);let luz=0;
    for(let i=0;i<9;i++){g.readPixels(Math.floor(g.drawingBufferWidth*(.2+.3*(i%3))),Math.floor(g.drawingBufferHeight*(.2+.3*Math.floor(i/3))),1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);luz+=pixel[0]+pixel[1]+pixel[2];}
    return {carga:window.CAOZ_ARPG_CARGA.estado(),inerte:document.querySelector('.apShell').inert,barra:document.getElementById('cargaProgreso').value,luz,dibujo:window.CAOZ_ARPG_THREE_REVISION.dibujar()};
  });
  assert(!e.carga.fallida&&!e.inerte);assert.equal(e.carga.pendientes,0);assert.equal(e.barra,100);assert(e.dibujo.llamadas>0&&e.dibujo.triangulos>1000,'Existe una escena real al retirar la carga');
  assert(e.luz>27,'La carga se retira después de pintar el primer cuadro visible');
  return e;
}
async function retener(pagina,patron){
  let liberar,avisar;const puerta=new Promise(ok=>{liberar=ok;}),solicitud=new Promise(ok=>{avisar=ok;});
  await pagina.route(patron,async ruta=>{avisar();await puerta;await ruta.continue().catch(()=>{});});
  const solicitado=()=>new Promise((ok,mal)=>{const limite=setTimeout(()=>mal(Error('No se solicitó el recurso retenido: '+patron)),tiempoMaximo);solicitud.then(()=>{clearTimeout(limite);ok();});});
  return {liberar,solicitado};
}
async function falloVisible(pagina){
  await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida);
  assert(await pagina.locator('#cargaInicial').isVisible());assert(await pagina.locator('#reintentarCarga').isVisible());
  assert.equal(await pagina.locator('#cargaInicial').getAttribute('aria-busy'),'false');
  assert.equal(await pagina.evaluate(()=>!!window.CAOZ_ARPG_THREE_REVISION?.listo()),false,'Un fallo no declara lista la partida');
}
async function iniciarInspector(){
  const reserva=http.createServer();await new Promise(ok=>reserva.listen(0,'127.0.0.1',ok));const puerto=reserva.address().port;await new Promise(ok=>reserva.close(ok));
  inspector=spawn(process.execPath,[fileURLToPath(new URL('./arpg-inspector-servidor.mjs',import.meta.url)),String(puerto)],{stdio:['ignore','pipe','pipe']});
  await new Promise((ok,mal)=>{
    const limite=setTimeout(()=>mal(Error('El servidor del inspector no arrancó')),10000);
    inspector.once('error',e=>{clearTimeout(limite);mal(e);});inspector.once('exit',codigo=>{clearTimeout(limite);mal(Error('El inspector terminó al arrancar: '+codigo));});
    inspector.stdout.on('data',dato=>{if(String(dato).includes('Inspector:')){clearTimeout(limite);ok();}});
  });
  return 'http://127.0.0.1:'+puerto+'/dev/secciones/arpg-inspector.html?captura=1&inspector=1';
}

try{
  navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});

  // La dependencia de Three queda retenida hasta comprobar el primer estado visible.
  if(incluir('vendor')){
    const {contexto,pagina,errores}=await contextoNuevo(),espera=await retener(pagina,'**/visor-three-vendor.js');
    try{
      await abrir(pagina);await espera.solicitado();
      assert(await pagina.locator('#cargaInicial').isVisible());
      const e=await pagina.evaluate(()=>({carga:window.CAOZ_ARPG_CARGA.estado(),three:!!window.CAOZ_THREE,inerte:document.querySelector('.apShell').inert}));
      assert(!e.three&&!e.carga.completa&&!e.carga.fallida&&e.carga.porcentaje<45&&e.inerte,'El panel se pinta antes de recibir Three y los modelos');
      await pagina.screenshot({path:path.join(carpeta,'carga-inicial.png')});espera.liberar();await lista(pagina);assert.deepEqual(errores,[]);
      console.log('✓ Pantalla inicial visible antes de Three; progreso por scripts, primer render y controles disponibles al terminar.');
    }finally{espera.liberar();await contexto.close();}
  }

  // Una textura del personaje llega después que las casas; ningún onLoad anterior basta.
  if(incluir('texturas')){
    const {contexto,pagina,errores}=await contextoNuevo(),espera=await retener(pagina,'**/adreida-piernas-scenario/color.webp');
    try{
      await abrir(pagina);await espera.solicitado();
      await pagina.waitForFunction(()=>{const e=window.CAOZ_ARPG_CARGA.estado();return e.porcentaje>=86||e.completa||e.fallida;});
      const antes=await pagina.evaluate(()=>({carga:window.CAOZ_ARPG_CARGA.estado(),listo:window.CAOZ_ARPG_THREE_REVISION.listo()}));
      assert(!antes.carga.completa&&!antes.carga.fallida&&!antes.listo&&antes.carga.pendientes>0);assert(await pagina.locator('#cargaInicial').isVisible());
      await pagina.keyboard.press('r');await pagina.keyboard.press('Escape');
      const despues=await pagina.evaluate(()=>({carga:window.CAOZ_ARPG_CARGA.estado(),pausa:document.getElementById('pausa').open,aliados:window.CAOZ_ARPG_THREE_REVISION.aliados().length}));
      assert(!despues.carga.fallida&&!despues.pausa&&despues.aliados===0,'La espera bloquea acciones y pausa incluso desde los listeners de teclado');
      espera.liberar();await lista(pagina);assert.deepEqual(errores,[]);
      console.log('✓ Texturas de personajes pendientes mantienen la carga y bloquean acciones prematuras.');
    }finally{espera.liberar();await contexto.close();}
  }

  // Una promesa de casas sin respuesta bloquea una etapa anterior a texturas().
  // Sólo adelantamos su vigilancia; los plazos de descarga conservan su duración.
  if(incluir('vigilancia')){
    const {contexto,pagina}=await contextoNuevo(),espera=await retener(pagina,'**/texturas-casas/tejas-color.webp');
    try{
      await pagina.addInitScript(()=>{
        const original=window.setTimeout;window.__vigilanciasPreparacion=0;
        window.setTimeout=function(callback,plazo,...argumentos){
          const vigilancia=plazo===90000&&String(callback).includes('La preparación tarda demasiado');
          if(vigilancia)window.__vigilanciasPreparacion++;
          return original.call(this,callback,vigilancia?1000:plazo,...argumentos);
        };
      });
      await abrir(pagina);await espera.solicitado();await falloVisible(pagina);
      const antes=await pagina.evaluate(()=>({carga:window.CAOZ_ARPG_CARGA.estado(),vigilancias:window.__vigilanciasPreparacion,equipo:window.CAOZ_ARPG_THREE_REVISION.equipo().length}));
      assert.equal(antes.vigilancias,1);assert.equal(antes.carga.porcentaje,50);assert.equal(antes.equipo,0);
      assert.match(await pagina.locator('#cargaTexto').textContent(),/preparación tarda demasiado/);
      espera.liberar();await pagina.waitForFunction(()=>window.CAOZ_ARPG_THREE_REVISION.equipo().length>0);
      const despues=await pagina.evaluate(()=>({terminar:window.CAOZ_ARPG_CARGA.terminar(),estado:window.CAOZ_ARPG_CARGA.estado(),listo:window.CAOZ_ARPG_THREE_REVISION.listo()}));
      assert(!despues.terminar&&!despues.listo&&despues.estado.fallida&&!despues.estado.completa);
      assert(await pagina.locator('#cargaInicial').isVisible());
      console.log('✓ Preparación detenida en casas: vigilancia visible y resolución tardía incapaz de borrar el fallo.');
    }finally{espera.liberar();await contexto.close();}
  }

  // Reintentar vuelve a cargar el documento y conserva personaje y parámetros.
  if(incluir('reintento')){
    const {contexto,pagina}=await contextoNuevo();let fallar=true;
    try{
      await pagina.route('**/three-carta.js',ruta=>fallar?ruta.fulfill({status:404,contentType:'text/javascript',body:''}):ruta.continue());
      const url=base+'arpg-three.html?captura=1&heroe=mohamed';await abrir(pagina,url);await falloVisible(pagina);
      fallar=false;await Promise.all([pagina.waitForNavigation({waitUntil:'domcontentloaded'}),pagina.locator('#reintentarCarga').click()]);await lista(pagina);
      const despues=new URL(pagina.url()),original=new URL(url);assert.equal(despues.pathname,original.pathname);
      for(const [clave,valor]of original.searchParams)assert.equal(despues.searchParams.get(clave),valor,'Reintentar conserva '+clave);
      assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.estado().heroe.tipo),'mohamed');
      assert.equal(await pagina.locator('script:not([data-caoz-carga])[src$="arpg-three-mesa.js"]').count(),1,'Reintentar no duplica la inicialización');
      console.log('✓ Recurso 404: error visible y reintento limpio que conserva la URL.');
    }finally{await contexto.close();}
  }

  // Un script puede recibir HTTP 200 y disparar onload aunque su ejecución falle.
  if(incluir('excepcion')){
    const {contexto,pagina}=await contextoNuevo();
    try{
      await pagina.route('**/three-carta.js',ruta=>ruta.fulfill({status:200,contentType:'text/javascript',body:'throw new Error("Fallo deliberado de la prueba de carga");'}));
      await abrir(pagina);await falloVisible(pagina);
      const e=await pagina.evaluate(async()=>{const c=window.CAOZ_ARPG_CARGA;await c.cuadro();c.avance(99,'Fin inválido');return {resultado:c.terminar(),estado:c.estado(),texto:document.getElementById('cargaTexto').textContent,revision:!!window.CAOZ_ARPG_THREE_REVISION};});
      assert.equal(e.resultado,false);assert(e.estado.fallida&&!e.estado.completa&&!e.revision);assert(e.texto.includes('Fallo deliberado'));
      assert(await pagina.locator('#cargaInicial').isVisible(),'Ningún callback posterior borra un fallo fatal');
      console.log('✓ Excepción con HTTP 200: onload no borra el fallo ni permite terminar la carga.');
    }finally{await contexto.close();}
  }

  if(incluir('webgl')){
    const {contexto,pagina}=await contextoNuevo({sinWebGL:true});
    try{
      await abrir(pagina);await falloVisible(pagina);
      assert.match(await pagina.locator('#cargaTexto').textContent(),/WebGL/i);
      console.log('✓ WebGL 2 no disponible: explicación y reintento visibles, sin falso estado listo.');
    }finally{await contexto.close();}
  }

  // La inyección del editor conserva su posición antes de la mesa y la del inspector
  // mantiene su espera propia, aunque el motor ahora se ejecute de forma diferida.
  if(incluir('editor')){
    const {contexto,pagina,errores}=await contextoNuevo();
    try{
      await abrir(pagina,base+'arpg-cine.html?captura=1');await lista(pagina);
      await pagina.waitForFunction(()=>document.querySelectorAll('#cePlanos button').length>0&&!document.getElementById('ceCampos').disabled);
      assert(await pagina.locator('#ceLocal').isVisible());assert.deepEqual(errores,[]);
      console.log('✓ Editor de cine: paneles y línea de tiempo preparados después del arranque diferido.');
    }finally{await contexto.close();}
  }
  if(incluir('inspector')){
    const url=await iniciarInspector(),{contexto,pagina,errores}=await contextoNuevo();
    try{
      await abrir(pagina,url);await lista(pagina);await pagina.waitForFunction(()=>!document.getElementById('labEdicion')?.disabled);
      assert(await pagina.locator('#labHeroe').isVisible());assert.deepEqual(errores,[]);
      console.log('✓ Inspector real: API, controles y escena disponibles después de la carga.');
    }finally{await contexto.close();}
  }
  if(incluir('vendor'))console.log('Captura inicial: '+path.join(carpeta,'carga-inicial.png'));
}finally{
  await navegador?.close();
  if(inspector&&inspector.exitCode===null){inspector.kill();await new Promise(ok=>inspector.once('exit',ok));}
  await new Promise(ok=>servidor.close(ok));
}

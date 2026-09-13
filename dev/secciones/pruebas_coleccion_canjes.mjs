/* Recorrido de mejoras sobre los componentes reales. Sobres: pruebas_sobres_elegidos.mjs.
   El laboratorio mantiene el progreso en memoria y no publica ni juega. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=process.env.BASE_URL?null:crearServidor();
if(servidor)await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
const base=process.env.BASE_URL||'http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html';
const urlPara=parametros=>{const url=new URL(base);for(const [k,v]of Object.entries(parametros))url.searchParams.set(k,v);return url.href;};
const i=process.argv.indexOf('--capturas'),capturas=i<0?null:path.resolve(process.argv[i+1]);if(capturas)fs.mkdirSync(capturas,{recursive:true});
let navegador;
async function dentro(pagina,selector){
  const d=await pagina.locator(selector).evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect(),panel=n.closest('#coleccionPanel').getBoundingClientRect();return {texto:n.textContent,ancho:n.scrollWidth<=n.clientWidth+2,dentro:r.left>=panel.left&&r.right<=panel.right&&r.top>=panel.top&&r.bottom<=panel.bottom};}));
  assert.ok(d.length&&d.every(n=>n.dentro&&n.ancho),'Los controles caben completos: '+JSON.stringify(d));
}
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height]of [['desktop',1440,900],['movil',390,844],['movil',320,568]]){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:'reduce'}),pagina=await contexto.newPage(),errores=[];pagina.on('pageerror',e=>errores.push(e.message));
    const memoria=fs.readFileSync(new URL('./memoria.js',import.meta.url),'utf8').replace('setItem:(k,v)=>{','setItem:(k,v)=>{if(window.CAOZ_QA_FALLO_GUARDADO)throw Error("Sin espacio de prueba");');
    await pagina.route('**/memoria.js',route=>route.fulfill({contentType:'text/javascript',body:memoria}));
    try{
      await pagina.goto(urlPara({vista,estado:'canjes',carta:'tal'}));await pagina.locator('.coleccionVersion[data-edicion="normal"] .coleccionMejorar').waitFor();
      await dentro(pagina,'.coleccionMejorar,.coleccionUsar,.coleccionMejoraProgreso');
      assert.equal(await pagina.locator('[data-edicion="normal"] [data-canjeables]').getAttribute('data-canjeables'),'5');
      assert.equal(await pagina.locator('[data-edicion="normal"] .coleccionCantidadEdicion').textContent(),'6 copias');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-mejora.png')});
      await pagina.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=true);
      await pagina.locator('[data-edicion="normal"] .coleccionMejorar').click();
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.canjeables('tal','normal')),5,'Un fallo al guardar conserva las cinco copias');
      assert.ok((await pagina.locator('.coleccionEstado.error').textContent()).includes('No se pudo guardar el canje'));
      assert.ok(await pagina.locator('[data-edicion="normal"] .coleccionMejorar').isEnabled(),'El fallo permite reintentar');
      await pagina.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=false);
      await pagina.locator('[data-edicion="normal"] .coleccionMejorar').click();
      assert.deepEqual(await pagina.evaluate(()=>['normal','foil','dorado'].map(a=>CAOZ_COLECCION.cantidad('tal',a))),[1,5,0],'Cinco Normales ganadas dan una Foil, conservando la inicial');
      assert.ok(await pagina.locator('[data-edicion="normal"] .coleccionMejorar').isDisabled());
      await pagina.locator('[data-edicion="foil"] .coleccionElegirAcabado').click();
      await pagina.locator('[data-edicion="foil"] .coleccionUsar').click();
      await pagina.locator('[data-edicion="foil"] .coleccionMejorar').click();
      assert.deepEqual(await pagina.evaluate(()=>({n:['normal','foil','dorado'].map(a=>CAOZ_COLECCION.cantidad('tal',a)),tiene:CAOZ_COLECCION.tiene('tal','foil'),elegido:CAOZ_COLECCION.elegido('tal')})),{n:[1,0,1],tiene:true,elegido:'foil'},'Consumir cinco Foils conserva su desbloqueo y elección, sin equipar la Dorada');
      await pagina.locator('[data-edicion="dorado"] .coleccionElegirAcabado').click();await pagina.locator('[data-edicion="dorado"] .coleccionUsar').click();
      await pagina.locator('.coleccionAtras').click();
      const tal=pagina.locator('.coleccionMini[data-carta="tal"]');
      assert.deepEqual(await tal.locator('.coleccionPuntos>i').evaluateAll(ns=>ns.map(n=>n.dataset.edicion)),['normal','foil','dorado']);
      assert.equal(await tal.locator('.coleccionMiniInfo').textContent(),'','La lista conserva sólo los marcadores, sin contadores');
      await pagina.getByRole('button',{name:'Canjear',exact:true}).click();
      await pagina.locator('.coleccionCanjeListo[data-carta="eric"]').click();
      assert.ok(await pagina.locator('.coleccionVersion[data-edicion="foil"]').getAttribute('class').then(c=>c.includes('vista')),'La lista de mejoras dirige al acabado con copias suficientes');
      assert.deepEqual(errores,[]);
      console.log('✓ '+vista+' '+width+'×'+height+': canjes encadenados, fallo de guardado recuperable, desbloqueo permanente y marcadores');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();if(servidor)await new Promise(resolve=>servidor.close(resolve));}

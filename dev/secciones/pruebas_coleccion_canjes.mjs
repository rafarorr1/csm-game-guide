/* Recorrido de sobres temáticos y mejoras sobre los componentes reales.
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
      await pagina.getByRole('button',{name:'Sobres',exact:false}).first().click();
      assert.equal(await pagina.locator('.coleccionGrupo').count(),3);
      if(await pagina.locator('.coleccionGrupoCompacto select').isVisible())await pagina.locator('.coleccionGrupoCompacto select').selectOption('caos');else await pagina.locator('.coleccionGrupo[data-grupo="caos"]').click();
      assert.equal(await pagina.locator('.coleccionGrupo[aria-pressed="true"]').getAttribute('data-grupo'),'caos');
      await pagina.locator('.coleccionVerContenido').click();assert.ok(await pagina.locator('#coleccionContenidoGrupo').isVisible());
      assert.equal(await pagina.locator('#coleccionContenidoGrupo>span').count(),48);
      assert.ok(await pagina.locator('.coleccionElegirGrupo').evaluate(n=>{n.scrollTop=0;const primero=n.firstElementChild.getBoundingClientRect(),r=n.getBoundingClientRect();return primero.top>=r.top;}),'El inicio de los grupos no se recorta al expandir contenido');
      await pagina.locator('#coleccionContenidoGrupo>span').last().scrollIntoViewIfNeeded();
      await dentro(pagina,'#coleccionContenidoGrupo>span:last-child');
      await pagina.locator('#coleccionContenidoGrupo>span').first().scrollIntoViewIfNeeded();
      await dentro(pagina,'#coleccionContenidoGrupo>span:first-child');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-contenido.png')});
      assert.ok((await pagina.locator('#coleccionContenidoGrupo').textContent()).includes('Thal'));
      await pagina.locator('.coleccionVerContenido').click();
      assert.ok((await pagina.locator('.coleccionTasas').textContent()).includes('50% Normal · 50% Foil'));
      assert.ok(await pagina.locator('.coleccionAbrirSobre').isDisabled(),'Sin sobres el botón no gasta nada');
      await pagina.evaluate(()=>CAOZ_COLECCION.concederSobreDomo('qa_domo'));
      assert.equal(await pagina.locator('.coleccionGrupo[aria-pressed="true"]').getAttribute('data-grupo'),'caos','El premio conserva el grupo seleccionado');
      await dentro(pagina,'.coleccionAbrirSobre,.coleccionSobreCuenta');
      await pagina.locator('.coleccionTasas').scrollIntoViewIfNeeded();
      await dentro(pagina,'.coleccionTasas');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-sobres.png')});
      await pagina.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=true);
      await pagina.locator('.coleccionAbrirSobre').click();
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.sobres()),1,'No se gasta el sobre si falla el guardado');
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.pendiente()),null);
      assert.ok(await pagina.locator('.coleccionAbrirSobre').isEnabled());
      await pagina.evaluate(()=>window.CAOZ_QA_FALLO_GUARDADO=false);
      await pagina.locator('.coleccionAbrirSobre').click();await pagina.locator('.sobresApertura[data-fase="sellado"]').waitFor();
      const pendiente=await pagina.evaluate(()=>CAOZ_COLECCION.pendiente());
      assert.equal(pendiente.grupo,'caos');assert.equal(pendiente.cartas.length,5);assert.equal(pendiente.cartas.filter(c=>c.acabado==='dorado').length,0);
      assert.ok([1,2].includes(pendiente.cartas.filter(c=>c.acabado==='foil').length));
      assert.ok(await pagina.evaluate(()=>{const m=CAOZ_COLECCION,g=m.grupos().find(g=>g.id==='caos');return m.pendiente().cartas.every(c=>g.ids.includes(c.id));}));
      await pagina.locator('.coleccionCerrar').click();await pagina.getByRole('button',{name:'Abrir colección',exact:true}).click();
      await pagina.locator('.sobresApertura[data-fase="sellado"]').waitFor();assert.deepEqual(await pagina.evaluate(()=>CAOZ_COLECCION.pendiente()),pendiente,'Cerrar y regresar conserva cartas y grupo');
      await pagina.locator('.sobresAccion').click();await pagina.locator('.sobresApertura[data-fase="pila"]').waitFor();
      for(let j=0;j<5;j++){await pagina.locator('.sobresAccion').click();await pagina.locator('.sobresApertura[data-fase="'+(j===4?'ultima':'pila')+'"]').waitFor();}
      await pagina.locator('.sobresAccion').click();await pagina.locator('.sobresApertura[data-fase="terminado"]').waitFor();
      await pagina.locator('.sobresAccion').click();await pagina.locator('.coleccionGrupo').first().waitFor({state:'attached'});
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.sobres()),0);assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.pendiente()),null);
      await pagina.goto(urlPara({vista,estado:'sobres',pestana:'sobres'}));
      await pagina.locator('#coleccionPanel[data-vista="sobres"]').waitFor();
      assert.equal(await pagina.locator('.coleccionGrupo').count(),3,'El enlace de revisión abre directamente las tres colecciones');
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.sobres()),2,'Los sobres de la revisión sólo existen en memoria');
      await dentro(pagina,'.coleccionAbrirSobre');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-tres-colecciones.png')});
      assert.deepEqual(errores,[]);
      console.log('✓ '+vista+' '+width+'×'+height+': canjes encadenados, desbloqueo permanente, marcadores, grupos, contenido, mezcla y apertura recuperable');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();if(servidor)await new Promise(resolve=>servidor.close(resolve));}

/* Regresión visual y de integración de contadores, sólo en la sección aislada.
   Usa Playwright instalado en el entorno; PLAYWRIGHT_MODULE puede indicar su
   ruta cuando no esté en node_modules. No instala paquetes ni publica. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();
await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html';
const capturas=process.argv.includes('--capturas')?path.resolve(process.argv[process.argv.indexOf('--capturas')+1]):null;
if(capturas)fs.mkdirSync(capturas,{recursive:true});
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height]of [['desktop',1440,900],['movil',390,844],['movil',320,568]]){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:'reduce'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    await contexto.addInitScript(()=>localStorage.setItem('centinela-copias','intacto'));
    const url=base+'?vista='+vista+'&estado=ediciones';
    try{
      await pagina.goto(url);await pagina.locator('#coleccionPanel[open] .coleccionCopias').first().waitFor();
      const inicial=await pagina.evaluate(()=>{
        const m=CAOZ_COLECCION,grid=document.querySelector('.coleccionRejilla'),minis=[...grid.querySelectorAll('.coleccionMini')];
        return {columnas:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          cantidades:Object.fromEntries(['tal','eric','lider_fender','rey'].map(id=>[id,Number(grid.querySelector('[data-carta="'+id+'"] .coleccionCopias').dataset.cantidad)])),
          todas:minis.every(n=>Number(n.querySelector('.coleccionCopias')?.dataset.cantidad)===m.cantidad(n.dataset.carta)),
          debajo:minis.every(n=>n.querySelector('.coleccionCopias').getBoundingClientRect().top>=n.querySelector('.coleccionCarta').getBoundingClientRect().bottom-1),
          desborde:document.documentElement.scrollWidth>innerWidth||grid.scrollWidth>grid.clientWidth+1,
          temporal:CAOZ_DEV.aislado&&G===null&&typeof newGame==='undefined'};
      });
      assert.equal(inicial.columnas,3,'Se conservan tres columnas');
      assert.deepEqual(inicial.cantidades,{tal:7,eric:6,lider_fender:7,rey:1},'Total de copias propias, incluidas las Normales');
      assert.ok(inicial.todas&&inicial.debajo,'Cada contador pertenece a su carta y se muestra debajo');
      assert.ok(!inicial.desborde&&inicial.temporal,'Sin desbordar ni cargar una partida');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-listado.png')});

      await pagina.getByRole('searchbox',{name:'Buscar cartas por nombre'}).fill('Eric');
      await pagina.evaluate(()=>CAOZ_COLECCION.otorgarCopia('eric','foil'));
      assert.equal(await pagina.locator('.coleccionMini[data-carta="eric"] .coleccionCopias').getAttribute('data-cantidad'),'7','Una copia repetida actualiza el total abierto');
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.elegido('eric')),'normal','El premio no cambia la edición equipada');
      await pagina.locator('.coleccionMini[data-carta="eric"]').click();
      for(const [acabado,cantidad]of [['normal',1],['foil',4],['dorado',2]]){
        await pagina.locator('.coleccionVersion[data-edicion="'+acabado+'"] .coleccionElegirAcabado').click();
        const n=pagina.locator('.coleccionVersion[data-edicion="'+acabado+'"] .coleccionCantidadEdicion');
        assert.equal(await n.getAttribute('data-cantidad'),String(cantidad));assert.ok(await n.isVisible(),'El acabado seleccionado muestra sus propias copias');
        const medidas=await n.evaluate(n=>{const panel=n.closest('#coleccionPanel').getBoundingClientRect(),r=n.getBoundingClientRect();return{dentro:r.top>=panel.top&&r.bottom<=panel.bottom&&r.left>=panel.left&&r.right<=panel.right,texto:n.textContent};});
        assert.ok(medidas.dentro,'El contador del detalle cabe completo');assert.equal(medidas.texto,cantidad+' '+(cantidad===1?'copia':'copias'));
      }
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-detalle.png')});
      await pagina.locator('.coleccionVersion[data-edicion="foil"] .coleccionElegirAcabado').click();
      await pagina.locator('.coleccionVersion[data-edicion="foil"] .coleccionUsar').click();
      await pagina.locator('.coleccionAtras').click();
      assert.equal(await pagina.locator('.coleccionMini[data-carta="eric"] .coleccionCopias').getAttribute('data-cantidad'),'7','Equipar no gasta ni duplica cartas');

      const almacen=await contexto.storageState();
      assert.ok(almacen.origins.every(o=>o.localStorage.length===1&&o.localStorage[0].name==='centinela-copias'&&o.localStorage[0].value==='intacto'),'El laboratorio no escribe progreso persistente');
      await pagina.reload();await pagina.locator('#coleccionPanel[open] .coleccionCopias').first().waitFor();
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.cantidad('eric')),6,'Recargar reconstruye sólo el fixture en memoria');
      await pagina.goto(base+'?vista='+vista+'&estado=nuevo&carta=tal');
      await pagina.locator('.coleccionCantidadEdicion').first().waitFor({state:'attached'});
      assert.deepEqual(await pagina.locator('.coleccionCantidadEdicion').evaluateAll(ns=>ns.map(n=>Number(n.dataset.cantidad))),[1,0,0],'El jugador nuevo ve una Normal y cero copias premium');
      assert.deepEqual(errores,[],'No hay errores de JavaScript');
      console.log('✓ '+vista+' '+width+'×'+height+': totales, detalle, repetidas, selección, tres columnas y memoria aislada');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();await new Promise(resolve=>servidor.close(resolve));}

/* Regresión visual de marcadores y cantidades en detalle, sólo en la sección aislada.
   Usa Playwright instalado en el entorno; PLAYWRIGHT_MODULE puede indicar su
   ruta cuando no esté en node_modules. No instala paquetes ni publica. */
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
const capturas=process.argv.includes('--capturas')?path.resolve(process.argv[process.argv.indexOf('--capturas')+1]):null;
if(capturas)fs.mkdirSync(capturas,{recursive:true});
async function comprobarMarcadores(mini,acabados,elegida){
  const d=await mini.evaluate(n=>{
    const pie=n.querySelector('.coleccionMiniPie'),puntos=[...pie.querySelectorAll('.coleccionPuntos>i')],r=n.querySelector('.coleccionCarta').getBoundingClientRect();
    return {ediciones:puntos.map(p=>p.dataset.edicion),elegidas:puntos.filter(p=>p.classList.contains('elegida')).map(p=>p.dataset.edicion),
      visibles:puntos.every(p=>{const b=p.getBoundingClientRect(),s=getComputedStyle(p);return p.classList.contains('propia')&&b.width>0&&b.height>0&&b.top>=r.bottom-1&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0;}),
      soloMarcadores:pie.children.length===1&&pie.firstElementChild.classList.contains('coleccionPuntos')&&!n.querySelector('.coleccionCopias')&&n.querySelector('.coleccionMiniInfo').textContent.trim()===''&&puntos.every(p=>!/[×\d]|copias?/i.test(p.title)),
      resaltada:puntos.filter(p=>p.classList.contains('elegida')).every(p=>getComputedStyle(p).boxShadow!=='none'),aria:n.getAttribute('aria-label')};
  });
  assert.deepEqual(d.ediciones,acabados,'Sólo se renderiza un marcador por edición poseída');
  assert.deepEqual(d.elegidas,[elegida],'Sólo la edición en uso está marcada como elegida');
  assert.ok(d.visibles&&d.soloMarcadores&&d.resaltada,'Marcadores visibles debajo, sin texto ni contador y con selección resaltada');
  const nombres={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  assert.ok(d.aria.includes('Ediciones desbloqueadas: '+acabados.map(a=>nombres[a]).join(', ')+'. En uso: '+nombres[elegida]+'.'),'El botón anuncia las ediciones propias y la elegida');
}
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height]of [['desktop',1440,900],['movil',390,844],['movil',320,568]]){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:'reduce'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    await contexto.addInitScript(()=>localStorage.setItem('centinela-copias','intacto'));
    const url=urlPara({vista,estado:'ediciones'});
    try{
      await pagina.goto(url);await pagina.locator('#coleccionPanel[open] .coleccionPuntos>i').first().waitFor();
      const inicial=await pagina.evaluate(()=>{
        const m=CAOZ_COLECCION,grid=document.querySelector('.coleccionRejilla'),minis=[...grid.querySelectorAll('.coleccionMini')];
        return {columnas:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          cantidades:Object.fromEntries(['tal','eric','lider_fender','rey'].map(id=>[id,m.cantidad(id)])),
          todas:minis.every(n=>{const ps=[...n.querySelectorAll('.coleccionPuntos>i')],propias=['normal','foil','dorado'].filter(a=>m.tiene(n.dataset.carta,a));return ps.map(p=>p.dataset.edicion).join(',')===propias.join(',')&&ps.filter(p=>p.classList.contains('elegida')).map(p=>p.dataset.edicion).join(',')===m.elegido(n.dataset.carta)&&!n.querySelector('.coleccionCopias')&&n.querySelector('.coleccionMiniInfo').textContent.trim()==='';}),
          debajo:minis.every(n=>n.querySelector('.coleccionPuntos').getBoundingClientRect().top>=n.querySelector('.coleccionCarta').getBoundingClientRect().bottom-1),
          desborde:document.documentElement.scrollWidth>innerWidth||grid.scrollWidth>grid.clientWidth+1,
          temporal:CAOZ_DEV.aislado&&G===null&&typeof newGame==='undefined'};
      });
      assert.equal(inicial.columnas,3,'Se conservan tres columnas');
      assert.deepEqual(inicial.cantidades,{tal:7,eric:6,lider_fender:7,rey:1},'Total de copias propias, incluidas las Normales');
      assert.ok(inicial.todas&&inicial.debajo,'Cada carta muestra debajo sólo sus ediciones poseídas y la elegida, sin texto ni contador');
      assert.ok(!inicial.desborde&&inicial.temporal,'Sin desbordar ni cargar una partida');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-listado.png')});

      await pagina.getByRole('searchbox',{name:'Buscar cartas por nombre'}).fill('Rey');
      const rey=pagina.locator('.coleccionMini[data-carta="rey"]');
      await comprobarMarcadores(rey,['normal'],'normal');
      await pagina.evaluate(()=>CAOZ_COLECCION.desbloquear('rey','foil'));
      await rey.locator('.coleccionPuntos>[data-edicion="foil"]').waitFor();
      await comprobarMarcadores(rey,['normal','foil'],'normal');
      await pagina.evaluate(()=>{CAOZ_COLECCION.otorgarCopia('rey','foil');CAOZ_COLECCION.otorgarCopia('rey','foil');});
      await comprobarMarcadores(rey,['normal','foil'],'normal');
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.cantidad('rey','foil')),3,'Las repeticiones suman copias sin duplicar el marcador');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-desbloqueo.png')});

      await pagina.getByRole('searchbox',{name:'Buscar cartas por nombre'}).fill('Eric');
      await pagina.evaluate(()=>CAOZ_COLECCION.otorgarCopia('eric','foil'));
      await comprobarMarcadores(pagina.locator('.coleccionMini[data-carta="eric"]'),['normal','foil','dorado'],'normal');
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.cantidad('eric')),7,'Una copia repetida actualiza el inventario sin añadir otro marcador');
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
      await comprobarMarcadores(pagina.locator('.coleccionMini[data-carta="eric"]'),['normal','foil','dorado'],'foil');
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.cantidad('eric')),7,'Equipar no gasta ni duplica cartas');

      const almacen=await contexto.storageState();
      assert.ok(almacen.origins.every(o=>o.localStorage.length===1&&o.localStorage[0].name==='centinela-copias'&&o.localStorage[0].value==='intacto'),'El laboratorio no escribe progreso persistente');
      await pagina.reload();await pagina.locator('#coleccionPanel[open] .coleccionPuntos>i').first().waitFor();
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.cantidad('eric')),6,'Recargar reconstruye sólo el fixture en memoria');
      await pagina.goto(urlPara({vista,estado:'nuevo',carta:'tal'}));
      await pagina.locator('.coleccionCantidadEdicion').first().waitFor({state:'attached'});
      assert.deepEqual(await pagina.locator('.coleccionCantidadEdicion').evaluateAll(ns=>ns.map(n=>Number(n.dataset.cantidad))),[1,0,0],'El jugador nuevo ve una Normal y cero copias premium');
      assert.deepEqual(errores,[],'No hay errores de JavaScript');
      console.log('✓ '+vista+' '+width+'×'+height+': sólo marcadores propios, desbloqueo, repetidas, selección, cantidades en detalle, tres columnas y memoria aislada');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();if(servidor)await new Promise(resolve=>servidor.close(resolve));}

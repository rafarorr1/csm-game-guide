/* Recorre las tres series en el Archivo de tres columnas, con memoria temporal.
   El Archivo debe vivir sobre el mundo persistente del visor, no sobre una
   segunda caja visual. PLAYWRIGHT_MODULE permite usar la instalación del
   entorno sin dependencias nuevas. --capturas /ruta guarda el Archivo y los
   controles de revisión. */
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
    await contexto.addInitScript(()=>localStorage.setItem('centinela-muestrario','intacto'));
    try{
      for(const acabado of ['normal','foil','dorado']){
        await pagina.goto(base+'?vista='+vista+'&estado=muestrario&acabado='+acabado);
        await pagina.locator('#coleccionPanel[open] .coleccionPuntos>i').first().waitFor();
        await pagina.locator('.coleccionRejilla img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
        const datos=await pagina.evaluate(acabado=>{
          const m=CAOZ_COLECCION,panel=document.querySelector('#coleccionPanel'),mundo=panel.querySelector('.coleccionMundoVisor'),visor=mundo?.querySelector('.visor3dIncrustado.visor3dMundo'),grid=document.querySelector('.coleccionRejilla'),minis=[...grid.querySelectorAll('.coleccionMini')],rMundo=mundo?.getBoundingClientRect(),rGrid=grid.getBoundingClientRect();
          return {cantidad:minis.length,total:m.ids().length,
            inventario:m.ids().every(id=>m.elegido(id)===acabado&&['normal','foil','dorado'].every(a=>m.cantidad(id,a)===1)),
            cartas:minis.every(n=>{const carta=n.querySelector('.coleccionCarta'),img=carta.querySelector('img'),v=CAOZ_ARTE.version(n.dataset.carta,acabado);return carta.dataset.coleccionAcabado===acabado&&(!img||img.getAttribute('src')===v.url);}),
            marcadores:minis.every(n=>{const ps=[...n.querySelectorAll('.coleccionPuntos>i')],r=n.querySelector('.coleccionCarta').getBoundingClientRect();return ps.map(p=>p.dataset.edicion).join(',')===['normal','foil','dorado'].filter(a=>m.tiene(n.dataset.carta,a)).join(',')&&ps.filter(p=>p.classList.contains('elegida')).map(p=>p.dataset.edicion).join(',')===acabado&&ps.every(p=>{const b=p.getBoundingClientRect(),s=getComputedStyle(p);return p.classList.contains('propia')&&b.width>0&&b.height>0&&b.top>=r.bottom-1&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0;})&&!n.querySelector('.coleccionCopias')&&n.querySelector('.coleccionMiniInfo').textContent.trim()==='';}),
            tresColumnas:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length===3,
            archivoVertical:grid.classList.contains('coleccionArchivoRejilla')&&grid.scrollHeight>grid.clientHeight+1&&grid.scrollWidth<=grid.clientWidth+1,
            region:grid.getAttribute('role')==='region'&&!grid.classList.contains('coleccionCarruselCartas'),
            mundo:!!mundo&&panel.dataset.mundo==='archivo'&&visor?.dataset.modo==='ambiente'&&!visor.querySelector('.visor3dCuerpo,.visor3dGL')&&rMundo.width>0&&rMundo.height>0&&rGrid.left>=rMundo.left-2&&rGrid.right<=rMundo.right+2&&rGrid.top>=rMundo.top-2&&rGrid.bottom<=rMundo.bottom+2,
            desborde:document.documentElement.scrollWidth>innerWidth};
        },acabado);
        assert.equal(datos.cantidad,datos.total);assert.ok(datos.inventario&&datos.cartas,'Todas las cartas muestran la serie elegida, con una copia por acabado');
        assert.ok(datos.marcadores,'Sólo las ediciones propias tienen un marcador visible y la serie en uso está elegida, sin nombres ni contadores en el pie');
        assert.ok(datos.tresColumnas&&datos.archivoVertical&&datos.region&&datos.mundo,'El Archivo conserva tres columnas con scroll vertical dentro del mundo del visor, no un carrusel ni una segunda caja');
        const recorrido=await pagina.evaluate(()=>{const grid=document.querySelector('.coleccionRejilla'),maximo=grid.scrollHeight-grid.clientHeight,conducta=grid.style.scrollBehavior;grid.style.scrollBehavior='auto';grid.scrollTop=Math.round(maximo*.52);const desplazamiento=grid.scrollTop;grid.style.scrollBehavior=conducta;return {maximo,desplazamiento};});
        assert.ok(recorrido.maximo>20&&recorrido.desplazamiento>1,'Cada serie se puede recorrer verticalmente');
        assert.equal(datos.desborde,false);
        if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-'+acabado+'.png')});
      }
      await pagina.locator('.coleccionCerrar').click();
      assert.match(await pagina.locator('#devEstado').textContent(),/En memoria: todas las ediciones para revisar ilustraciones/);
      assert.equal(await pagina.locator('select[name="acabado"]').inputValue(),'dorado');
      await pagina.locator('select[name="acabado"]').selectOption('foil');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-controles.png')});
      await pagina.getByRole('button',{name:'Cargar escenario'}).click();
      await pagina.locator('#coleccionPanel[open] .coleccionPuntos>i').first().waitFor();
      assert.equal(new URL(pagina.url()).searchParams.get('acabado'),'foil');
      assert.ok(await pagina.evaluate(()=>CAOZ_COLECCION.ids().every(id=>CAOZ_COLECCION.elegido(id)==='foil'&&CAOZ_COLECCION.cantidad(id)===3)),'Cambiar serie recarga el fixture sin sumar copias');
      const almacen=await contexto.storageState();
      assert.ok(almacen.origins.every(o=>o.localStorage.length===1&&o.localStorage[0].name==='centinela-muestrario'&&o.localStorage[0].value==='intacto'),'El muestrario no escribe progreso persistente');
      assert.deepEqual(errores,[]);console.log('✓ '+vista+' '+width+'×'+height+': tres series completas, archivo vertical de tres columnas, marcadores propios sin texto, selector, enlaces y memoria temporal');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();await new Promise(resolve=>servidor.close(resolve));}

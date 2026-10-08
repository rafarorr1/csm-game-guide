/* Precarga y reentrada reales, con un único contexto GPU y sin tocar la actuación. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {crearServidor} from './servidor.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const salida=path.resolve(process.env.ARPG_PRECARGA_SALIDA||fileURLToPath(new URL('../../../../outputs/precarga-cine/',import.meta.url)));fs.mkdirSync(salida,{recursive:true});
let navegador;
try{
  navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
  const contexto=await navegador.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),pagina=await contexto.newPage(),errores=[],imagenes=[];
  pagina.setDefaultTimeout(120000);pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|GroupMarkerNotSet/.test(m.text()))errores.push(m.text());});
  pagina.on('response',r=>{if(r.status()>=400)errores.push(r.status()+' '+r.url());});pagina.on('request',r=>{if(/casa-goblin-scenario\/.*\.webp|texturas-goblin\/ropa-/.test(r.url()))imagenes.push(r.url());});
  // El puente existe sólo en la respuesta de esta prueba; el runtime no lo exporta.
  await pagina.route('**/arpg-three-mesa.js*',async ruta=>{const respuesta=await ruta.fetch(),fuente=await respuesta.text(),marca='window.CAOZ_ARPG_THREE_REVISION=Object.freeze({';assert(fuente.includes(marca));await ruta.fulfill({response:respuesta,body:fuente.replace(marca,'window.__precargaCine={casaGoblin,finalMago,renderer,escena,camara,jugadores};'+marca)});});
  await pagina.goto(`http://127.0.0.1:${servidor.address().port}/dev/secciones/arpg-three.html?captura=1&entrada=casa&etapa=2`,{waitUntil:'load'});
  await pagina.waitForFunction(()=>window.CAOZ_ARPG_THREE_REVISION?.listo()||window.CAOZ_ARPG_CARGA?.estado().fallida);
  assert(await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.listo()),await pagina.locator('#cargaTexto').textContent());
  const preparacion=await pagina.evaluate(async()=>{
    const {casaGoblin:casa,finalMago:cine,renderer,camara}=window.__precargaCine;
    const antes={fase:casa.estado().fase,cine:cine.estado(),camara:[...camara.position.toArray(),...camara.quaternion.toArray(),camara.fov]};
    const inicio=performance.now();const p=casa.precargar(renderer,{aspecto:camara.aspect});const compartida=p===casa.precargar(renderer);await p;
    await cine.precargar(renderer);const misma=cine.recursos;await cine.precargar(renderer);
    window.__interiorPreparado=casa.escena;window.__recursosCinePreparados=misma;
    return {ms:performance.now()-inicio,compartida,misma:misma===cine.recursos,ocultos:!cine.recursos.grupo.visible&&!cine.recursos.brazosFPS.raiz.visible,antes,despues:{fase:casa.estado().fase,cine:cine.estado(),camara:[...camara.position.toArray(),...camara.quaternion.toArray(),camara.fov]},programas:renderer.info.programs.length};
  });
  assert(preparacion.compartida&&preparacion.misma&&preparacion.ocultos);assert.deepEqual(preparacion.antes,preparacion.despues,'Preparar conserva fase, actuación y cámara');const imagenesPreparadas=imagenes.length;
  const muestras=[];
  for(let vuelta=0;vuelta<2;vuelta++){
    if(vuelta)await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.reiniciar());
    await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(6));await pagina.locator('#abrirCasa').click();await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(8));
    const casa=await pagina.evaluate(()=>{const r=window.CAOZ_ARPG_THREE_REVISION,p=window.__precargaCine;return {estado:r.casaGoblin(),misma:p.casaGoblin.escena===window.__interiorPreparado,dibujo:r.dibujar()};});
    assert(casa.misma&&casa.estado.interior&&casa.estado.vivos===2&&casa.estado.ambiente.tiempo>0);assert(casa.dibujo.triangulos>1000);
    await pagina.screenshot({path:path.join(salida,`interior-${vuelta+1}.png`)});
    await pagina.locator('#casaSalir').click();await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(5));
    const cine=await pagina.evaluate(()=>{const p=window.__precargaCine;return {estado:p.finalMago.estado(),misma:p.finalMago.recursos===window.__recursosCinePreparados,programas:p.renderer.info.programs.length};});assert(cine.estado&&cine.misma);
    await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(6));await pagina.screenshot({path:path.join(salida,`mago-${vuelta+1}.png`)});muestras.push({casa,cine});
  }
  assert.equal(imagenes.length,imagenesPreparadas,'Entrada, cine y reentrada no vuelven a solicitar mapas preparados');
  fs.writeFileSync(path.join(salida,'resultado.json'),JSON.stringify({preparacion,muestras,imagenes,errores},null,2)+'\n');
  assert.deepEqual(errores,[]);
  console.log('✓ GPU: precarga sin actuación, mismo interior y final tras dos entradas, texturas sin nuevas solicitudes, sin errores WebGL. '+salida);
  await contexto.close();
}finally{await navegador?.close();await new Promise(ok=>servidor.close(ok));}

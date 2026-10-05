/* Regresión real del primer botín, tras la carga completa y sin caché de navegador.
   Ejecutar sin otros perfiles GPU. PLAYWRIGHT_MODULE y CHROME_CHANNEL son opcionales.
   La instrumentación observa WebGL; el pequeño puente de prueba sólo expone las
   funciones reales de recogida/retirada y el recuento de luces, sin sustituirlas. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {crearServidor} from './servidor.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();
await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/arpg-three.html';
const carpeta=path.resolve(process.env.ARPG_BOTIN_SALIDA||fileURLToPath(new URL('../../../../outputs/auditoria-primer-drop/regresion/',import.meta.url)));
fs.mkdirSync(carpeta,{recursive:true});
const resultados=[];let navegador;
try{
 navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
 for(const coop of [false,true]){
  const contexto=await navegador.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),pagina=await contexto.newPage(),errores=[];
  pagina.setDefaultTimeout(120000);
  pagina.on('pageerror',e=>errores.push(e.message));
  pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
  try{
   await pagina.addInitScript(()=>{
    window.__gpuBotin={programas:0,shaders:0};
    for(const [nombre,contador]of [['linkProgram','programas'],['compileShader','shaders']]){
     const original=WebGL2RenderingContext.prototype[nombre];
     WebGL2RenderingContext.prototype[nombre]=function(...args){window.__gpuBotin[contador]++;return original.apply(this,args);};
    }
   });
   await pagina.route('**/arpg-three-mesa.js',async ruta=>{
    const respuesta=await ruta.fetch(),original=await respuesta.text(),marca='window.CAOZ_ARPG_THREE_REVISION=Object.freeze({';
    assert.equal(original.split(marca).length,2,'El puente de revisión tiene un único punto de inserción');
    const puente=`window.__pruebaBotin={recoger:i=>recoger(botines[i]),quitar:i=>quitarBotin(botines[i]),colocar:()=>pasoBotin(0),luces:()=>{let n=0;escena.traverse(o=>{if(o.isPointLight)n++;});return n;}};`;
    await ruta.fulfill({response:respuesta,body:original.replace(marca,puente+marca)});
   });
   const inicio=performance.now();await pagina.goto(base+'?piso=scenario&captura=1'+(coop?'&coop=1':''),{waitUntil:'domcontentloaded'});
   await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
   assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,'La partida termina su carga');
   const cargaMs=performance.now()-inicio;
   await pagina.evaluate(()=>{CAOZ_ARPG_THREE_REVISION.oleadas(false);CAOZ_ARPG_THREE_REVISION.piloto(false);});
   const muestra=await pagina.evaluate(async()=>{
    const r=CAOZ_ARPG_THREE_REVISION,p=__pruebaBotin,luces=p.luces(),medidas=[];
    const cronometrar=fn=>{const t=performance.now();fn();return performance.now()-t;};
    async function soltar(ed,ciclo){
     const contadores={...__gpuBotin},t=performance.now();await r.soltar('mazo',ed,0,-3);const texturaMs=performance.now()-t;p.colocar();
     const dibujoMs=cronometrar(()=>r.dibujar()),repetidoMs=cronometrar(()=>r.dibujar());
     medidas.push({ed,ciclo,texturaMs,dibujoMs,repetidoMs,programas:__gpuBotin.programas-contadores.programas,shaders:__gpuBotin.shaders-contadores.shaders,luces:p.luces(),listo:r.estado().botines.at(-1)?.listo});
    }
    for(const ed of ['normal','foil','dorado']){
     await soltar(ed,'primera');p.recoger(0);await r.avanzar(.55,60);
     if(r.estado().botines.length)throw Error('Recoger no retiró la carta '+ed);
     await soltar(ed,'tras-recoger');p.quitar(0);r.dibujar();
     await soltar(ed,'tras-quitar');p.quitar(0);r.dibujar();
    }
    r.reiniciar();r.oleadas(false);r.piloto(false);r.dibujar();await soltar('normal','tras-reiniciar');
    return {luces,medidas,botinRecogido:r.estado().heroe.botin,programasCarga:__gpuBotin.programas};
   });
   for(const m of muestra.medidas){
    assert(m.listo,'La carta '+m.ed+' quedó lista');assert.equal(m.luces,muestra.luces,'El botín no cambia PointLight');
    assert.equal(m.programas,0,`${coop?'Coop':'Solo'} ${m.ed} ${m.ciclo}: no crea programas durante el drop`);
    assert.equal(m.shaders,0,`${coop?'Coop':'Solo'} ${m.ed} ${m.ciclo}: no compila shaders durante el drop`);
   }
   assert.deepEqual(errores,[],'Sin errores JavaScript ni de compilación GLSL');
   const nombre=coop?'coop':'solo',resultado={modo:nombre,cargaMs,...muestra};resultados.push(resultado);
   await pagina.screenshot({path:path.join(carpeta,nombre+'.png')});
   console.log('✓ '+nombre+': normal/foil/dorado, recogida, retirada y reinicio; 0 shaders/programas nuevos en '+muestra.medidas.length+' drops. Máximo primer dibujo '+Math.max(...muestra.medidas.map(m=>m.dibujoMs)).toFixed(1)+' ms.');
  }finally{await contexto.close();}
 }
 fs.writeFileSync(path.join(carpeta,'resultados.json'),JSON.stringify(resultados,null,2)+'\n');
 console.log('Resultados: '+carpeta);
}finally{await navegador?.close();await new Promise(ok=>servidor.close(ok));}

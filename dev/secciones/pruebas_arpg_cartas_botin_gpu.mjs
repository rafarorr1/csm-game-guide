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
 for(const modo of [{nombre:'captura-alta',consulta:'captura=1'},{nombre:'equilibrada',consulta:'calidad=2',transicion:true},{nombre:'rendimiento',consulta:'calidad=1'}])for(const coop of [false,true]){
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
    const puente=`window.__pruebaBotin={recoger:i=>recoger(botines[i]),quitar:i=>quitarBotin(botines[i]),colocar:()=>pasoBotin(0),texturas:async()=>{const caras=await Promise.all(cacheTex.values()),ts=[...caras.map(c=>c.tx.map),dorso.mat.map];return ts.map(t=>({ancho:t.image.width,alto:t.image.height,mipmaps:t.generateMipmaps}));},luces:()=>{let n=0;escena.traverse(o=>{if(o.isPointLight)n++;});return n;}};`;
    await ruta.fulfill({response:respuesta,body:original.replace(marca,puente+marca)});
   });
   const inicio=performance.now();await pagina.goto(base+'?piso=scenario&'+modo.consulta+(coop?'&coop=1':''),{waitUntil:'domcontentloaded'});
   await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
   assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,'La partida termina su carga');
   const cargaMs=performance.now()-inicio;
   await pagina.evaluate(()=>{CAOZ_ARPG_THREE_REVISION.oleadas(false);CAOZ_ARPG_THREE_REVISION.piloto(false);});
   const muestra=await pagina.evaluate(async transicion=>{
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
    let cambioCalidad=null;
    if(transicion){
     p.quitar(0);const antes={...__gpuBotin};r.calidad('1');r.dibujar();
     cambioCalidad={de:2,a:1,programas:__gpuBotin.programas-antes.programas,shaders:__gpuBotin.shaders-antes.shaders};
     for(const ed of ['normal','foil','dorado']){await soltar(ed,'tras-calidad-2-a-1');p.quitar(0);r.dibujar();}
     await soltar('normal','después-del-cambio');
    }
    const reinicios=[];
    if(transicion)for(let i=0;i<3;i++){r.reiniciar();r.oleadas(false);r.piloto(false);r.dibujar();const {geometrias,texturas}=r.rendimiento();reinicios.push({geometrias,texturas});}
    return {luces,medidas,cambioCalidad,reinicios,texturas:await p.texturas(),botinRecogido:r.estado().heroe.botin,programasCarga:__gpuBotin.programas};
   },!!modo.transicion);
   if(muestra.reinicios.length)for(const memoria of muestra.reinicios.slice(1))assert.deepEqual(memoria,muestra.reinicios[0],'Reiniciar no acumula geometrías ni texturas GPU');
   assert(muestra.texturas.length>20,'Se han preparado todas las ediciones del botín');
   for(const t of muestra.texturas){assert(t.ancho<=256&&t.alto<=359,'Ninguna textura de botín rebasa el presupuesto');}
   const bytesCPU=muestra.texturas.reduce((s,t)=>s+t.ancho*t.alto*4,0),bytesGPU=muestra.texturas.reduce((s,t)=>{
    let w=t.ancho,h=t.alto,n=0;do{n+=w*h*4;if(!t.mipmaps||w===1&&h===1)break;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}while(true);return s+n;
   },0);
   muestra.memoriaEstimada={texturas:muestra.texturas.length,bytesCPU,bytesGPU,totalMiB:(bytesCPU+bytesGPU)/1048576};
   assert(muestra.memoriaEstimada.totalMiB<23,'Color y mipmaps de todo el botín permanecen por debajo de 23 MiB');
   for(const m of muestra.medidas){
    assert(m.listo,'La carta '+m.ed+' quedó lista');assert.equal(m.luces,muestra.luces,'El botín no cambia PointLight');
    assert.equal(m.programas,0,`${modo.nombre} ${coop?'Coop':'Solo'} ${m.ed} ${m.ciclo}: no crea programas durante el drop`);
    assert.equal(m.shaders,0,`${modo.nombre} ${coop?'Coop':'Solo'} ${m.ed} ${m.ciclo}: no compila shaders durante el drop`);
   }
   assert.deepEqual(errores,[],'Sin errores JavaScript ni de compilación GLSL');
   const nombre=modo.nombre+'-'+(coop?'coop':'solo'),resultado={modo:nombre,cargaMs,...muestra};resultados.push(resultado);
   await pagina.screenshot({path:path.join(carpeta,nombre+'.png')});
   console.log('✓ '+nombre+': normal/foil/dorado, recogida, retirada y reinicio; 0 shaders/programas nuevos en '+muestra.medidas.length+' drops. Máximo primer dibujo '+Math.max(...muestra.medidas.map(m=>m.dibujoMs)).toFixed(1)+' ms.');
  }finally{await contexto.close();}
 }
 fs.writeFileSync(path.join(carpeta,'resultados.json'),JSON.stringify(resultados,null,2)+'\n');
 console.log('Resultados: '+carpeta);
}finally{await navegador?.close();await new Promise(ok=>servidor.close(ok));}

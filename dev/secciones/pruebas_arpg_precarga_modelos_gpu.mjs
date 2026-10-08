/* Primeras apariciones tras carga y transición real Can→Troll, sin GPU concurrente. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {crearServidor} from './servidor.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise(ok=>servidor.listen(0,'127.0.0.1',ok));
const salida=path.resolve(process.env.ARPG_PRECARGA_MODELOS_SALIDA||'../../outputs/precarga-modelos');fs.mkdirSync(salida,{recursive:true});
let navegador;
try{
  navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
  const contexto=await navegador.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),pagina=await contexto.newPage(),errores=[],peticiones=[];
  pagina.setDefaultTimeout(120000);pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|GroupMarkerNotSet/.test(m.text()))errores.push(m.text());});pagina.on('request',r=>{if(/goblin|kobold/.test(r.url())&&/\.webp/.test(r.url()))peticiones.push(r.url());});
  await pagina.addInitScript(()=>{window.__gpu={programas:0,shaders:0};for(const [nombre,clave]of [['compileShader','shaders'],['linkProgram','programas']]){const anterior=WebGL2RenderingContext.prototype[nombre];WebGL2RenderingContext.prototype[nombre]=function(...args){__gpu[clave]++;return anterior.apply(this,args);};}});
  await pagina.route('**/arpg-three-mesa.js*',async ruta=>{const respuesta=await ruta.fetch(),s=await respuesta.text(),marca='window.CAOZ_ARPG_THREE_REVISION=Object.freeze({';assert(s.includes(marca));
    await ruta.fulfill({response:respuesta,body:s.replace(marca,`window.__preparacion={renderer,MOD,crearEnemigo,quitar:e=>{liberarModeloTroll(e.m);enemigos.splice(enemigos.indexOf(e),1);},transicion:()=>{ol.i=3;rog.nivel=1;rog.mano=rog.cartas.map(c=>({...c,miniatura:''}));if(!rog.mano.length){iniciarDestino(1);rog.mano=rog.cartas.map(c=>({...c,miniatura:''}));}abrirDestino();rog.resuelto=true;pintarDestino();},seguirDestino};`+marca)});
  });
  const inicio=performance.now();await pagina.goto(`http://127.0.0.1:${servidor.address().port}/dev/secciones/arpg-three.html?captura=1&heroe=adreida&piso=scenario`,{waitUntil:'load'});
  await pagina.waitForFunction(()=>window.CAOZ_ARPG_THREE_REVISION?.listo()||window.CAOZ_ARPG_CARGA?.estado().fallida);
  assert(await pagina.evaluate(()=>CAOZ_ARPG_THREE_REVISION.listo()),await pagina.locator('#cargaTexto').textContent());const cargaMs=performance.now()-inicio,solicitudesIniciales=peticiones.length;
  const primeras=await pagina.evaluate(()=>{
    const r=CAOZ_ARPG_THREE_REVISION,p=__preparacion;r.oleadas(false);r.piloto(false);
    const casos=['goblin','cobrador','kobold','saqueador','can','troll'].flatMap(tipo=>['goblin','cobrador'].includes(tipo)?['clasico','dosHachas','cuchillo','antorcha'].map(varianteGoblin=>[tipo,{varianteGoblin}]):tipo==='kobold'?['rojizo','capucha','acorazado','huesos'].map(varianteKobold=>[tipo,{varianteKobold}]):[[tipo,{}]]),muestras=[];
    for(const calidad of ['3','2','1']){r.calidad(calidad);r.dibujar();
      for(const [tipo,opciones]of casos){const antes={...__gpu},t=performance.now(),e=p.crearEnemigo(tipo,0,2,{...opciones,quieto:true}),creado=performance.now();p.MOD.posar(e.m,{anim:'quieto',t:0,dt:0,mezclar:false});r.dibujar();const fin=performance.now();muestras.push({calidad,tipo,...opciones,crearMs:creado-t,dibujarMs:fin-creado,programas:__gpu.programas-antes.programas,shaders:__gpu.shaders-antes.shaders});p.quitar(e);}
    }
    return {muestras,preparacion:r.preparacion(),memoria:r.rendimiento()};
  });
  const solicitudesTrasApariciones=peticiones.length;
  await pagina.evaluate(()=>__preparacion.transicion());await pagina.locator('#destinoSeguir').click();
  const esperando=await pagina.evaluate(()=>({dialogo:document.getElementById('destino').open,preparacion:CAOZ_ARPG_THREE_REVISION.preparacion(),boton:document.getElementById('destinoSeguir').disabled}));
  await pagina.waitForFunction(()=>!CAOZ_ARPG_THREE_REVISION.preparacion().transicion);
  const transicion=await pagina.evaluate(()=>({dialogo:document.getElementById('destino').open,preparacion:CAOZ_ARPG_THREE_REVISION.preparacion(),cine:CAOZ_ARPG_THREE_REVISION.finalMago(),casa:CAOZ_ARPG_THREE_REVISION.casaGoblin(),memoria:CAOZ_ARPG_THREE_REVISION.rendimiento()}));
  await pagina.evaluate(()=>CAOZ_ARPG_THREE_REVISION.dibujar());await pagina.screenshot({path:path.join(salida,'plaza-lista.png')});
  const resultado={cargaMs,primeras,solicitudesIniciales,solicitudesTrasApariciones,esperando,transicion,errores};fs.writeFileSync(path.join(salida,'resultado.json'),JSON.stringify(resultado,null,2)+'\n');
  assert.equal(primeras.preparacion.variantes.length,15);assert.equal(primeras.preparacion.cine,false);
  assert.equal(solicitudesTrasApariciones,solicitudesIniciales,'Los enemigos no descargan mapas al aparecer');
  for(const m of primeras.muestras){assert.equal(m.programas,0,m.tipo+'/'+m.calidad+': ningún programa nuevo');assert.equal(m.shaders,0,m.tipo+'/'+m.calidad+': ningún shader nuevo');}
  assert(esperando.dialogo&&esperando.boton&&esperando.preparacion.transicion,'El siguiente nivel espera bajo el diálogo');assert(transicion.preparacion.cine&&!transicion.dialogo&&!transicion.cine,'Precarga de cine sin iniciar actuación');assert.deepEqual(errores,[]);
  console.log('✓ 45 primeras apariciones en tres calidades: cero shaders/programas ni mapas nuevos; transición Can→Troll espera la preparación sin avanzar cine. '+salida);
  await contexto.close();
}finally{await navegador?.close();await new Promise(ok=>servidor.close(ok));}

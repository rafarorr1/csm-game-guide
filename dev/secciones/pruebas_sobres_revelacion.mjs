/* Apertura de sobres con el bonche en 3D (sobres-revelacion.js), en la sección
   aislada de Colección: con WebGL las cartas salen del sobre como cartas del
   visor y el DOM sólo lleva la cuenta; sin el módulo, la misma apertura sigue
   con sus cartas planas. En ambos casos se descubren las cinco, el resumen
   muestra las caras pintadas y no hay errores. También con movimiento reducido.
   Usa Playwright instalado en el entorno (PLAYWRIGHT_MODULE opcional). */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';
import {juego} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'sobres-revelacion.js'),'utf8');
assert.ok(!/preserve-3d/.test(js)&&!/\.finished\b/.test(js),'Sin preserve-3d ni Animation.finished');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html?estado=sobres&pestana=sobres';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  const casos=[['desktop',1440,900,'3d','no-preference'],['movil',390,844,'3d','no-preference'],['movil',390,844,'plano','no-preference'],['desktop',1440,900,'3d','reduce']];
  for(const [vista,width,height,modo,movimiento]of casos){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:movimiento,hasTouch:vista==='movil'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    pagina.on('console',m=>{if(m.type()==='warning'&&/Sobres/.test(m.text()))errores.push(m.text());});
    if(modo==='plano')await contexto.addInitScript(()=>{Object.defineProperty(window,'CAOZ_SOBRES_REVELACION',{configurable:true,get:()=>undefined,set:()=>{}});});
    const caso=vista+' '+width+'×'+height+' · '+modo+(movimiento==='reduce'?' · movimiento reducido':'');
    const fase=()=>pagina.evaluate(()=>document.querySelector('.sobresApertura')?.dataset.fase);
    const esperarFase=async(...f)=>{await pagina.waitForFunction(f=>f.includes(document.querySelector('.sobresApertura')?.dataset.fase),f,{timeout:60000});};
    try{
      await pagina.goto(base+(vista==='movil'?'&vista=movil':''));
      await pagina.locator('.coleccionAbrirSobre').click({noWaitAfter:true});
      await esperarFase('sellado');
      const escena=await pagina.evaluate(()=>{
        const panel=document.querySelector('#coleccionPanel'),r=panel.getBoundingClientRect(),a=document.querySelector('.sobresApertura');
        return {pantalla:r.width>=innerWidth-1&&r.height>=innerHeight*.9,tres:a.classList.contains('sobres3D'),lienzo:!!a.querySelector('canvas.sobresCartas3D'),motas:!!a.querySelector('canvas.sobresMotas'),sobre:!!a.querySelector('.sobresEscenaLienzo')};
      });
      assert.ok(escena.pantalla,caso+': la apertura ocupa la pantalla');
      assert.ok(escena.sobre,caso+': el sobre se dibuja');
      assert.equal(escena.tres,modo==='3d',caso+': el bonche en 3D sólo con su módulo');
      assert.equal(escena.lienzo&&escena.motas,modo==='3d',caso+': lienzos de cartas y motas');
      await pagina.locator('.sobresAccion').click({noWaitAfter:true});
      await esperarFase('pila');
      if(modo==='3d')assert.equal(await pagina.evaluate(()=>{const c=document.querySelector('.sobresCartas3D');return c?getComputedStyle(c).opacity:'sin lienzo';}),'1',caso+': el bonche aparece al abrir ('+errores.join(' · ')+')');
      for(let i=0;i<5;i++){await pagina.locator('.sobresAccion').click({noWaitAfter:true});await esperarFase('pila','ultima');}
      const descubiertas=await pagina.evaluate(()=>document.querySelector('.sobresEstado').textContent);
      assert.match(descubiertas,/5 de 5/,caso+': se descubren las cinco');
      await pagina.locator('.sobresAccion').click({noWaitAfter:true});await esperarFase('terminado');
      await pagina.waitForFunction(()=>[...document.querySelectorAll('.sobresPremio')].every(p=>{const c=p.querySelector('.cdCarta');return !c||c.classList.contains('cdLista');}),null,{timeout:30000});
      const fin=await pagina.evaluate(()=>({premios:document.querySelectorAll('.sobresPremio').length,visibles:[...document.querySelectorAll('.sobresPremio')].filter(p=>p.getBoundingClientRect().width>40).length,
        bonche:document.querySelector('.sobresCartas3D')?getComputedStyle(document.querySelector('.sobresCartas3D')).opacity:'0'}));
      assert.ok(fin.premios===5&&fin.visibles===5,caso+': el resumen muestra las cinco cartas pintadas');
      assert.equal(fin.bonche,'0',caso+': el bonche 3D se retira en el resumen');
      await pagina.locator('.sobresAccion').click({noWaitAfter:true});
      await pagina.waitForFunction(()=>!document.querySelector('.sobresApertura'),null,{timeout:10000});
      assert.equal(await pagina.evaluate(()=>document.querySelectorAll('canvas.sobresCartas3D,canvas.sobresMotas').length),0,caso+': al volver se liberan los lienzos');
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': pantalla completa, '+(modo==='3d'?'bonche 3D del visor':'cartas planas')+', cinco descubiertas, resumen pintado y lienzos liberados');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

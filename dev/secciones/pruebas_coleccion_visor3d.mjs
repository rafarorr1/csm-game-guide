/* Visor 3D de la Colección, sólo en la sección aislada: tocar una edición
   desbloqueada abre la carta real en 3D, se voltea al dorso, cambia de edición
   y al cerrar devuelve el foco. Las ediciones bloqueadas no se abren.
   Usa Playwright instalado en el entorno (PLAYWRIGHT_MODULE opcional). */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';
import {juego} from './fuentes.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const sabotaje=process.argv.includes('--sabotaje');
const servidor=process.env.BASE_URL?null:crearServidor();
if(servidor)await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
const base=process.env.BASE_URL||'http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html';
const urlPara=parametros=>{const url=new URL(base);for(const [k,v]of Object.entries(parametros))url.searchParams.set(k,v);return url.href;};
const capturas=process.argv.includes('--capturas')?path.resolve(process.argv[process.argv.indexOf('--capturas')+1]):null;
if(capturas)fs.mkdirSync(capturas,{recursive:true});

// El juego prohíbe preserve-3d: las capas del visor llevan su propia perspectiva.
const css=fs.readFileSync(path.join(juego,'visor-3d.css'),'utf8'),js=fs.readFileSync(path.join(juego,'visor-3d.js'),'utf8');
assert.ok(!/preserve-3d/.test(css.replace(/\/\*[\s\S]*?\*\//g,''))&&!/preserve-3d['"]/.test(js),'El visor no usa preserve-3d');
assert.ok(!/\.finished\b/.test(js),'El visor no espera a Animation.finished');

const giro=pagina=>pagina.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.visor3dCuerpo')).getPropertyValue('--ry')));
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height,carta]of [['desktop',1440,900,'tal'],['movil',390,844,'tal'],['movil',320,568,'lider_fender']]){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:vista==='movil'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    if(sabotaje)await contexto.addInitScript(()=>{Object.defineProperty(window,'CAOZ_VISOR3D',{configurable:true,get:()=>undefined,set:()=>{}});});
    try{
      await pagina.goto(urlPara({vista,estado:'ediciones',carta}));
      await pagina.locator('#coleccionPanel[open] .coleccionVersion').first().waitFor();
      const bloqueadas=await pagina.evaluate(()=>[...document.querySelectorAll('#coleccionPanel .coleccionVersion.bloqueada .coleccionCarta')].every(n=>!n.classList.contains('coleccionVer3D')));
      assert.ok(bloqueadas,'Una edición bloqueada no se abre en 3D');
      const ficha=pagina.locator('#coleccionPanel .coleccionVer3D:visible').first();
      await ficha.waitFor({timeout:4000});
      const acabado=await ficha.getAttribute('data-coleccion-acabado');
      assert.match(await ficha.getAttribute('aria-label'),/en 3D$/,'La carta anuncia que abre el visor');
      await ficha.click();
      const visor=pagina.locator('dialog.visor3d[open]');await visor.waitFor();
      const abierto=await pagina.evaluate(()=>{
        const d=document.querySelector('dialog.visor3d'),frente=d.querySelector('.visor3dFrente .visor3dCarta'),r=frente.getBoundingClientRect(),dorso=d.querySelector('.visor3dDorso');
        return {acabado:d.dataset.acabado,cartaReal:frente.classList.contains('coleccionCarta')&&!!frente.querySelector('.marcoDibujo, .lface'),
          dentro:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.width>60,
          logo:dorso.querySelector('img.visor3dLogo')?.getAttribute('src'),caras:getComputedStyle(dorso).backfaceVisibility,
          cantos:d.querySelectorAll('.visor3dCanto').length,desborde:document.documentElement.scrollWidth>innerWidth};
      });
      assert.equal(abierto.acabado,acabado,'Abre la edición que se tocó');
      assert.ok(abierto.cartaReal,'El frente es la ficha real de la Colección');
      assert.ok(abierto.dentro&&!abierto.desborde,'La carta cabe en la pantalla');
      assert.ok(abierto.logo?.endsWith('art/logo.webp')&&abierto.caras==='hidden'&&abierto.cantos>1,'Dorso con el logo y canto');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-visor.png')});

      await visor.getByRole('button',{name:'Voltear'}).click();
      await pagina.waitForFunction(()=>Math.abs(Math.abs(parseFloat(getComputedStyle(document.querySelector('.visor3dCuerpo')).getPropertyValue('--ry')))-Math.PI)<.25,null,{timeout:5000});
      assert.ok(Math.abs(Math.abs(await giro(pagina))-Math.PI)<.25,'Voltear gira media vuelta hasta el dorso');

      const otra=visor.locator('.visor3dEdicion:not([disabled]):not([aria-pressed="true"])').first();
      if(await otra.count()){
        const destino=await otra.getAttribute('data-edicion');await otra.click();
        assert.equal(await pagina.locator('dialog.visor3d').getAttribute('data-acabado'),destino,'Cambia de edición dentro del visor');
      }
      await pagina.keyboard.press('Escape');
      await pagina.waitForFunction(()=>!document.querySelector('dialog.visor3d'));
      const foco=await pagina.evaluate(()=>document.activeElement?.classList.contains('coleccionVer3D')&&document.querySelector('#coleccionPanel').open);
      assert.ok(foco,'Al cerrar vuelve a la Colección con el foco en la carta');
      assert.deepEqual(errores,[],'Sin errores de página');
      console.log('✓ '+vista+' '+width+'×'+height+': abre la carta real, dorso con logo, voltea, cambia de edición y devuelve el foco');
    }finally{await contexto.close();}
  }
}catch(error){
  if(sabotaje){console.log('✓ Sabotaje detectado: sin el visor la carta no se abre en 3D');process.exitCode=0;}
  else throw error;
}finally{await navegador?.close();servidor?.close();}
if(sabotaje&&process.exitCode!==0){console.error('✗ El sabotaje no se detectó');process.exitCode=1;}

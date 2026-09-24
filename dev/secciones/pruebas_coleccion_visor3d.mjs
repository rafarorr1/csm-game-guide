/* Detalle de Colección con la carta en 3D, sólo en la sección aislada: tocar
   una carta de la rejilla abre su escena 3D con la ficha real; las pestañas
   cambian la edición sin rehacer la escena; una edición bloqueada se ve velada
   y sin WebGL; voltear gira media vuelta; pantalla completa abre el diálogo y
   al cerrarlo se vuelve al detalle; regresar a la rejilla libera la escena.
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

// El juego prohíbe preserve-3d y esperar a Animation.finished.
const css=fs.readFileSync(path.join(juego,'visor-3d.css'),'utf8'),js=fs.readFileSync(path.join(juego,'visor-3d.js'),'utf8');
assert.ok(!/preserve-3d/.test(css.replace(/\/\*[\s\S]*?\*\//g,''))&&!/preserve-3d['"]/.test(js),'El visor no usa preserve-3d');
assert.ok(!/\.finished\b/.test(js),'El visor no espera a Animation.finished');

const giro=pagina=>pagina.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.visor3dIncrustado .visor3dCuerpo')).getPropertyValue('--ry')));
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height,carta]of [['desktop',1440,900,'tal'],['movil',390,844,'tal'],['movil',320,568,'lider_fender']]){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:vista==='movil'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    if(sabotaje)await contexto.addInitScript(()=>{Object.defineProperty(window,'CAOZ_VISOR3D',{configurable:true,get:()=>undefined,set:()=>{}});});
    try{
      await pagina.goto(urlPara({vista,estado:'ediciones'}));
      const mini=pagina.locator('#coleccionPanel .coleccionMini[data-carta="'+carta+'"]');await mini.waitFor();await mini.scrollIntoViewIfNeeded();
      // La rejilla muestra la carta pintada (los Protagonistas conservan su retrato).
      const pintada=await mini.evaluate(n=>!!n.querySelector('.cdCarta'));
      if(pintada)await pagina.waitForFunction(n=>n.querySelector('.cdCarta')?.classList.contains('cdLista'),await mini.elementHandle(),{timeout:20000});
      await mini.click();
      const escena=pagina.locator('#coleccionPanel .coleccionEscena3D .visor3dIncrustado');await escena.waitFor({timeout:4000});
      const hayGL=await pagina.evaluate(()=>{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));});
      if(hayGL&&pintada)await pagina.waitForFunction(()=>document.querySelector('.visor3dIncrustado')?.classList.contains('visor3dConGL'),null,{timeout:30000});
      const abierta=await pagina.evaluate(()=>{
        const v=document.querySelector('.visor3dIncrustado'),frente=v.querySelector('.visor3dFrente .visor3dCarta'),r=frente.getBoundingClientRect(),e=v.getBoundingClientRect();
        const fichas=[...document.querySelectorAll('#coleccionPanel .coleccionVersion .coleccionCarta')].filter(n=>n.getClientRects().length);
        return {acabado:v.dataset.acabado,elegido:CAOZ_COLECCION.elegido(frente.dataset.card||frente.closest('[data-carta]')?.dataset.carta||''),cartaReal:frente.classList.contains('coleccionCarta')&&!!frente.querySelector('.marcoDibujo, .lface'),
          dentro:r.left>=e.left-1&&r.right<=e.right+1&&r.top>=e.top-1&&r.bottom<=e.bottom+1&&r.width>60,fichasVisibles:fichas.length,versiones:document.querySelectorAll('#coleccionPanel .coleccionVersion').length,
          desborde:document.documentElement.scrollWidth>innerWidth,logo:v.querySelector('.visor3dDorso img.visor3dLogo')?.getAttribute('src')};
      });
      assert.ok(abierta.cartaReal,'La escena muestra la ficha real de la Colección');
      assert.ok(abierta.dentro&&!abierta.desborde,'La carta cabe en su escena');
      assert.equal(abierta.fichasVisibles,0,'La escena 3D es la única carta visible del detalle');
      assert.equal(abierta.versiones,3,'Los controles de las tres ediciones siguen presentes');
      assert.ok(abierta.logo?.endsWith('art/logo.webp'),'El dorso lleva el logo');
      const inicial=await pagina.evaluate(c=>CAOZ_COLECCION.elegido(c),carta);
      assert.equal(abierta.acabado,inicial,'Abre la edición en uso');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-detalle3d.png')});

      // Las pestañas cambian la edición de la misma escena.
      const raiz=await escena.elementHandle();
      for(const a of ['normal','foil','dorado']){
        await pagina.locator('[data-edicion="'+a+'"] .coleccionElegirAcabado').click();
        await pagina.waitForFunction(a=>document.querySelector('.visor3dIncrustado')?.dataset.acabado===a,a,{timeout:4000});
        const estado=await pagina.evaluate(([r,c,a])=>({misma:document.querySelector('.visor3dIncrustado')===r,bloqueada:r.classList.contains('visor3dBloqueada'),gl:r.classList.contains('visor3dConGL'),lienzoVisible:getComputedStyle(r.querySelector('.visor3dGL')).visibility==='visible',tiene:CAOZ_COLECCION.tiene(c,a)}),[raiz,carta,a]);
        assert.ok(estado.misma,'Cambiar de edición conserva la escena y su WebGL');
        assert.equal(estado.bloqueada,!estado.tiene,'Una edición bloqueada se ve velada');
        if(!estado.tiene)assert.ok(!estado.gl&&!estado.lienzoVisible,'Una edición bloqueada nunca se ve nítida: ni se dibuja en WebGL ni queda a la vista la edición anterior');
      }
      await pagina.locator('[data-edicion="'+inicial+'"] .coleccionElegirAcabado').click();
      await pagina.locator('.visor3dIncrustado .visor3dVoltear').click();
      // El ángulo se acumula (cambiar de edición da una vuelta): se compara normalizado.
      await pagina.waitForFunction(()=>{const r=parseFloat(getComputedStyle(document.querySelector('.visor3dIncrustado .visor3dCuerpo')).getPropertyValue('--ry'));return Math.abs(Math.abs(Math.atan2(Math.sin(r),Math.cos(r)))-Math.PI)<.25;},null,{timeout:8000});
      const r=await giro(pagina);assert.ok(Math.abs(Math.abs(Math.atan2(Math.sin(r),Math.cos(r)))-Math.PI)<.25,'Voltear muestra el dorso');

      // Pantalla completa abre el diálogo; al cerrarlo sigue el detalle.
      await pagina.locator('.visor3dIncrustado .visor3dAmpliar').click();
      await pagina.locator('dialog.visor3d[open]').waitFor();
      await pagina.keyboard.press('Escape');
      await pagina.waitForFunction(()=>!document.querySelector('dialog.visor3d')&&document.querySelector('#coleccionPanel').open&&document.querySelector('.visor3dIncrustado'));
      // Volver a la rejilla libera la escena.
      await pagina.locator('.coleccionAtras').click();
      await pagina.waitForFunction(()=>!document.querySelector('.visor3dIncrustado'));
      assert.deepEqual(errores,[],'Sin errores de página');
      console.log('✓ '+vista+' '+width+'×'+height+': '+(pintada?'carta pintada, '+(hayGL?'escena WebGL':'escena CSS'):'retrato de Protagonista')+', detalle 3D, ediciones en la misma escena, bloqueada velada, voltea, pantalla completa y libera la escena');
    }finally{await contexto.close();}
  }
}catch(error){
  if(sabotaje){console.log('✓ Sabotaje detectado: sin el visor el detalle no muestra la carta en 3D');process.exitCode=0;}
  else throw error;
}finally{await navegador?.close();servidor?.close();}
if(sabotaje&&process.exitCode!==0){console.error('✗ El sabotaje no se detectó');process.exitCode=1;}

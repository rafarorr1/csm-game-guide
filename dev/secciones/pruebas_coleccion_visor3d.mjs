/* Detalle de Colección con la carta en 3D, sólo en la sección aislada: el
   Archivo conserva tres cartas por fila y scroll vertical. Al abrir una, la
   transición observable aparta las demás y entrega la elegida al visor real;
   las pestañas cambian la edición sin rehacer la escena; una edición bloqueada
   se ve velada y sin WebGL; volver restaura foco y desplazamiento de la lista.
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
  for(const [vista,width,height]of [['desktop',1440,900],['desktop',1280,720],['movil',390,844],['movil',320,568]]){
    // Escritorio recorre la transición completa. En móvil se conserva la ruta
    // inmediata de movimiento reducido, que no debe dejar el panel a medias.
    const conMovimiento=vista==='desktop';
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:conMovimiento?'no-preference':'reduce',hasTouch:vista==='movil'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    if(sabotaje)await contexto.addInitScript(()=>{Object.defineProperty(window,'CAOZ_VISOR3D',{configurable:true,get:()=>undefined,set:()=>{}});});
    try{
      await pagina.goto(urlPara({vista,estado:'ediciones'}));
      // El Archivo es una escena completa, no el diálogo morado reducido que
      // tenía antes. Conserva una cuadrícula vertical de tres cartas por fila.
      const biblioteca=await pagina.evaluate(()=>{
        const panel=document.querySelector('#coleccionPanel'),interior=panel.querySelector('.coleccionInterior'),rejilla=panel.querySelector('.coleccionRejilla'),cartas=[...rejilla.querySelectorAll('.coleccionMini')],p=panel.getBoundingClientRect(),i=getComputedStyle(interior),columnas=getComputedStyle(rejilla).gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
        return {cubre:p.left<=1&&p.top<=1&&p.right>=innerWidth-1&&p.bottom>=innerHeight-1,
          sinMarco:parseFloat(getComputedStyle(panel).borderTopWidth)===0&&parseFloat(getComputedStyle(panel).borderRadius)===0,
          escena:/radial-gradient/.test(i.backgroundImage),tresColumnas:columnas.length===3,
          vertical:rejilla.scrollHeight>rejilla.clientHeight+1,sinDesbordeHorizontal:rejilla.scrollWidth<=rejilla.clientWidth+1,
          region:rejilla.getAttribute('role')==='region',sinCarrusel:!rejilla.classList.contains('coleccionCarruselCartas'),
          cartasVisibles:cartas.filter(n=>n.querySelector('.coleccionCarta')?.getBoundingClientRect().width>40).length>=3,
          sinCaja:getComputedStyle(panel.querySelector('.coleccionCabecera')).backgroundImage==='none'};
      });
      assert.ok(biblioteca.cubre&&biblioteca.sinMarco,'La biblioteca ocupa toda la pantalla, sin una caja modal reducida');
      assert.ok(biblioteca.escena&&biblioteca.tresColumnas&&biblioteca.vertical&&biblioteca.sinDesbordeHorizontal&&biblioteca.region&&biblioteca.sinCarrusel&&biblioteca.cartasVisibles&&biblioteca.sinCaja,'La biblioteca usa la escena del visor, mantiene tres columnas con scroll vertical y no deja una caja morada');
      const recorrido=await pagina.evaluate(()=>{
        const rejilla=document.querySelector('.coleccionRejilla'),maximo=rejilla.scrollHeight-rejilla.clientHeight;
        const conducta=rejilla.style.scrollBehavior;rejilla.style.scrollBehavior='auto';
        rejilla.scrollTop=Math.min(maximo,Math.max(80,Math.round(maximo*.46)));
        const desplazamiento=rejilla.scrollTop;rejilla.style.scrollBehavior=conducta;
        return {maximo,desplazamiento};
      });
      assert.ok(recorrido.maximo>20&&recorrido.desplazamiento>1,'El Archivo se puede recorrer de forma vertical');
      // Thal vive al final del archivo por su coste y nos da un scroll real que
      // restaurar, sin cambiar la ficha de detalle que esta prueba conoce.
      const carta='tal';
      const mini=pagina.locator('#coleccionPanel .coleccionMini[data-carta="'+carta+'"]');await mini.waitFor();
      const desplazamientoAntes=await pagina.evaluate(id=>{
        const rejilla=document.querySelector('.coleccionRejilla'),mini=rejilla.querySelector('.coleccionMini[data-carta="'+id+'"]'),maximo=rejilla.scrollHeight-rejilla.clientHeight;
        const conducta=rejilla.style.scrollBehavior;rejilla.style.scrollBehavior='auto';
        rejilla.scrollTop=Math.max(0,Math.min(maximo,mini.offsetTop-(rejilla.clientHeight-mini.offsetHeight)/2));
        const desplazamiento=rejilla.scrollTop;rejilla.style.scrollBehavior=conducta;
        return desplazamiento;
      },carta);
      assert.ok(desplazamientoAntes>1,'La carta abierta parte de una posición desplazada del Archivo');
      // La rejilla muestra la carta pintada (los Protagonistas conservan su retrato).
      const pintada=await mini.evaluate(n=>!!n.querySelector('.cdCarta'));
      if(pintada)await pagina.waitForFunction(n=>n.querySelector('.cdCarta')?.classList.contains('cdLista'),await mini.elementHandle(),{timeout:20000});
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-archivo.png')});
      await mini.click();
      if(conMovimiento){
        await pagina.waitForFunction(id=>{
          const panel=document.querySelector('#coleccionPanel'),rejilla=panel?.querySelector('.coleccionRejilla'),elegida=rejilla?.querySelector('.coleccionMini[data-carta="'+id+'"]'),resto=[...(rejilla?.querySelectorAll('.coleccionMini')||[])].filter(n=>n!==elegida);
          return panel?.dataset.transicion==='abrir-carta'&&panel.dataset.cartaActiva===id&&elegida?.dataset.animacion==='entra'&&resto.length>0&&resto.every(n=>n.dataset.animacion==='sale')&&rejilla.getAttribute('aria-busy')==='true'&&rejilla.hasAttribute('inert')&&!!panel.querySelector('.coleccionVueloCarta');
        },carta,{timeout:2200});
        const transicion=await pagina.evaluate(id=>{
          const panel=document.querySelector('#coleccionPanel'),rejilla=panel.querySelector('.coleccionRejilla'),elegida=rejilla.querySelector('.coleccionMini[data-carta="'+id+'"]'),resto=[...rejilla.querySelectorAll('.coleccionMini')].filter(n=>n!==elegida),vuelo=panel.querySelector('.coleccionVueloCarta');
          return {estado:panel.dataset.transicion,activa:panel.dataset.cartaActiva,elegida:elegida?.dataset.animacion,salen:resto.every(n=>n.dataset.animacion==='sale'&&n.getAttribute('aria-hidden')==='true'),vuelo:!!vuelo&&vuelo.classList.contains('coleccionVueloCartaEntra'),bloqueada:rejilla.hasAttribute('inert')&&rejilla.getAttribute('aria-busy')==='true'};
        },carta);
        assert.deepEqual(transicion,{estado:'abrir-carta',activa:carta,elegida:'entra',salen:true,vuelo:true,bloqueada:true},'Abrir una carta aparta el resto y deja una transición observable antes del visor');
        if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-transicion.png')});
      }
      const escena=pagina.locator('#coleccionPanel .coleccionEscena3D .visor3dIncrustado');await escena.waitFor({timeout:4000});
      const hayGL=await pagina.evaluate(()=>{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));});
      if(hayGL&&pintada)await pagina.waitForFunction(()=>document.querySelector('.visor3dIncrustado')?.classList.contains('visor3dConGL'),null,{timeout:30000});
      await pagina.waitForFunction(()=>{
        const v=document.querySelector('.visor3dIncrustado'),frente=v?.querySelector('.visor3dFrente .visor3dCarta'),r=frente?.getBoundingClientRect(),e=v?.getBoundingClientRect();
        return !!r&&!!e&&r.width>60&&r.left>=e.left-2&&r.right<=e.right+2&&r.top>=e.top-2&&r.bottom<=e.bottom+2;
      },null,{timeout:5000});
      const abierta=await pagina.evaluate(()=>{
        const v=document.querySelector('.visor3dIncrustado'),frente=v.querySelector('.visor3dFrente .visor3dCarta'),r=frente.getBoundingClientRect(),e=v.getBoundingClientRect();
        const fichas=[...document.querySelectorAll('#coleccionPanel .coleccionVersion .coleccionCarta')].filter(n=>n.getClientRects().length);
        return {acabado:v.dataset.acabado,elegido:CAOZ_COLECCION.elegido(frente.dataset.card||frente.closest('[data-carta]')?.dataset.carta||''),cartaReal:frente.classList.contains('coleccionCarta')&&!!frente.querySelector('.marcoDibujo, .lface'),
          dentro:r.left>=e.left-2&&r.right<=e.right+2&&r.top>=e.top-2&&r.bottom<=e.bottom+2&&r.width>60,fichasVisibles:fichas.length,versiones:document.querySelectorAll('#coleccionPanel .coleccionVersion').length,
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
      // Volver al Archivo libera la escena y devuelve foco/desplazamiento a la
      // misma carta, aunque la lista se haya recorrido antes de abrirla.
      await pagina.locator('.coleccionAtras').click();
      await pagina.waitForFunction(id=>{
        const panel=document.querySelector('#coleccionPanel'),rejilla=panel?.querySelector('.coleccionRejilla'),mini=rejilla?.querySelector('.coleccionMini[data-carta="'+id+'"]');
        return panel?.dataset.vista==='cartas'&&!document.querySelector('.visor3dIncrustado')&&!!mini;
      },carta,{timeout:4000});
      await pagina.waitForFunction(id=>{
        const rejilla=document.querySelector('.coleccionRejilla'),mini=rejilla?.querySelector('.coleccionMini[data-carta="'+id+'"]'),r=mini?.getBoundingClientRect(),g=rejilla?.getBoundingClientRect();
        return document.activeElement===mini&&rejilla.scrollTop>1&&r.bottom>g.top+18&&r.top<g.bottom-18;
      },carta,{timeout:4000});
      const regreso=await pagina.evaluate(id=>{const rejilla=document.querySelector('.coleccionRejilla'),mini=rejilla.querySelector('.coleccionMini[data-carta="'+id+'"]'),r=mini.getBoundingClientRect(),g=rejilla.getBoundingClientRect();return {foco:document.activeElement===mini,desplazamiento:rejilla.scrollTop,visible:r.bottom>g.top+18&&r.top<g.bottom-18};},carta);
      assert.ok(regreso.foco,'Volver devuelve el foco a la carta que se estaba viendo');
      assert.ok(regreso.desplazamiento>1&&regreso.visible,'Volver restaura la fila desplazada del Archivo, no el inicio de la biblioteca');
      assert.deepEqual(errores,[],'Sin errores de página');
      console.log('✓ '+vista+' '+width+'×'+height+': '+(pintada?'carta pintada, '+(hayGL?'escena WebGL':'escena CSS'):'retrato de Protagonista')+', archivo de tres columnas, transición al detalle 3D, ediciones, vuelta, pantalla completa y regreso con foco/scroll');
    }finally{await contexto.close();}
  }
}catch(error){
  if(sabotaje){console.log('✓ Sabotaje detectado: sin el visor el detalle no muestra la carta en 3D');process.exitCode=0;}
  else throw error;
}finally{await navegador?.close();servidor?.close();}
if(sabotaje&&process.exitCode!==0){console.error('✗ El sabotaje no se detectó');process.exitCode=1;}

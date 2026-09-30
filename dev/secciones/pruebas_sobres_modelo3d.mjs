/* El carrusel de sobres conserva una sola pieza WebGL: el sobre seleccionado.
   Debe poder girarse como una carta real con puntero o teclado, mientras los
   demás sobres permanecen ligeros y el cambio de selección libera el anterior.
   Usa Playwright instalado en el entorno (PLAYWRIGHT_MODULE opcional). */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';
import {juego} from './fuentes.mjs';

const ui=fs.readFileSync(path.join(juego,'coleccion-ui.js'),'utf8'),escena=fs.readFileSync(path.join(juego,'sobres-escena.js'),'utf8');
assert.match(ui,/CAOZ_SOBRES_ESCENA\?\.crear/,'La biblioteca monta el modelo de sobre real');
assert.ok(!/preserve-3d/.test(escena)&&!/\.finished\b/.test(escena),'El modelo no usa preserve-3d ni Animation.finished');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html?estado=sobres&pestana=sobres';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [nombre,width,height,movimiento] of [['escritorio',1440,900,'no-preference'],['escritorio bajo',1280,720,'no-preference'],['móvil',390,844,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width,height},hasTouch:nombre==='móvil',reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    try{
      await pagina.goto(base+(nombre==='móvil'?'&vista=movil':''));
      const activo=pagina.locator('#coleccionPanel .coleccionSobreGuardado.seleccionado[data-modelo="3d"]');
      await activo.waitFor({timeout:12000});
      await pagina.waitForFunction(()=>document.querySelectorAll('#coleccionPanel .coleccionSobreGuardado[data-modelo="3d"] canvas.sobresEscenaLienzo').length===1,null,{timeout:12000});
      const inicio=await pagina.evaluate(()=>{
        const todos=[...document.querySelectorAll('#coleccionPanel .coleccionSobreGuardado')],activo=todos.find(n=>n.dataset.modelo==='3d'),lienzos=[...document.querySelectorAll('#coleccionPanel canvas.sobresEscenaLienzo')],previas=[...document.querySelectorAll('#coleccionPanel canvas.sobresVistaLienzo')],rect=n=>{const r=n?.getBoundingClientRect();return r&&{top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        return {sobres:todos.length,activos:todos.filter(n=>n.dataset.modelo==='3d').length,lienzos:lienzos.length,previas:previas.length,orientacion:activo?.dataset.orientacion,teclado:activo?.getAttribute('aria-keyshortcuts'),descripcion:activo?.getAttribute('aria-description'),tamano:lienzos[0]?.getBoundingClientRect().width||0,activo:rect(activo),acciones:rect(document.querySelector('.coleccionSobreAcciones')),contenido:rect(document.querySelector('.coleccionContenido')),alto:innerHeight};
      });
      assert.ok(inicio.sobres>=3&&inicio.activos===1&&inicio.lienzos===1&&inicio.previas===inicio.sobres-1&&inicio.tamano>40,'Sólo el sobre elegido conserva un modelo 3D visible; los demás mantienen su portada ligera');
      assert.ok(inicio.activo?.width>100&&inicio.activo?.height>150&&inicio.contenido?.top>=0&&inicio.contenido?.bottom<=inicio.alto+1&&inicio.acciones?.bottom<=inicio.alto+1,'El carrusel conserva espacio físico para el sobre y las acciones no se ocultan bajo el pie');
      assert.equal(inicio.orientacion,'frente','El modelo inicia mirando su frente');
      assert.match(inicio.teclado||'',/ArrowLeft.*Home.*End/,'El modelo anuncia controles de teclado');
      assert.match(inicio.descripcion||'',/Arrastra horizontalmente/,'El modelo explica cómo girarlo');

      // Un gesto largo sobre la pieza gira al reverso y no debe convertirse en
      // un clic que reordene/abra el carrusel.
      const caja=await activo.boundingBox();assert.ok(caja&&caja.width>30,'El sobre activo tiene una zona manipulable');
      const origen=caja.x+caja.width*.5,final=Math.max(2,origen-190);
      await pagina.mouse.move(origen,caja.y+caja.height*.52);
      await pagina.mouse.down();await pagina.mouse.move(final,caja.y+caja.height*.52,{steps:11});await pagina.mouse.up();
      await pagina.waitForFunction(()=>document.querySelector('.coleccionSobreGuardado[data-modelo="3d"]')?.dataset.orientacion==='reverso',null,{timeout:3000});
      assert.equal(await activo.getAttribute('data-orientacion'),'reverso','Arrastrar muestra el reverso físico');

      await activo.focus();await pagina.keyboard.press('Home');
      await pagina.waitForFunction(()=>document.querySelector('.coleccionSobreGuardado[data-modelo="3d"]')?.dataset.orientacion==='frente',null,{timeout:2000});
      await pagina.keyboard.press('End');
      await pagina.waitForFunction(()=>document.querySelector('.coleccionSobreGuardado[data-modelo="3d"]')?.dataset.orientacion==='reverso',null,{timeout:2000});
      assert.equal(await activo.getAttribute('data-orientacion'),'reverso','Inicio y Fin recuperan frente y reverso sin cambiar el carrusel');

      const grupoAnterior=await activo.getAttribute('data-grupo');
      await pagina.locator('#coleccionPanel .coleccionSobreSiguiente').click();
      await pagina.waitForFunction(anterior=>{const a=document.querySelector('.coleccionSobreGuardado[data-modelo="3d"]');return !!a&&a.dataset.grupo!==anterior&&document.querySelectorAll('.coleccionSobreGuardado[data-modelo="3d"]').length===1&&document.querySelectorAll('canvas.sobresEscenaLienzo').length===1;},grupoAnterior,{timeout:5000});
      const cambio=await pagina.evaluate(()=>({grupo:document.querySelector('.coleccionSobreGuardado[data-modelo="3d"]')?.dataset.grupo,lienzos:document.querySelectorAll('canvas.sobresEscenaLienzo').length,activos:document.querySelectorAll('.coleccionSobreGuardado[data-modelo="3d"]').length,previas:document.querySelectorAll('canvas.sobresVistaLienzo').length,sobres:document.querySelectorAll('.coleccionSobreGuardado').length,desborde:document.documentElement.scrollWidth>innerWidth}));
      assert.ok(cambio.grupo!==grupoAnterior&&cambio.lienzos===1&&cambio.activos===1&&cambio.previas===cambio.sobres-1&&!cambio.desborde,'Cambiar de sobre desmonta el modelo anterior, restaura su portada y no desborda la escena');
      assert.deepEqual(errores,[],nombre+': sin errores de página');
      console.log('✓ '+nombre+' '+width+'×'+height+': sobre 3D girable, frente/reverso, teclado y un solo lienzo activo');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

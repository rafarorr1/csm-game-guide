/* Detalle de Colección con la carta en 3D, sólo en la sección aislada: el
   Archivo conserva tres cartas por fila y scroll vertical dentro del mismo
   mundo del visor. Al abrir una, la transición observable aparta las demás y
   entrega la elegida al visor real sin cambiar de escenario; las pestañas
   cambian la edición sin rehacer la escena; una edición bloqueada se ve velada
   y sin WebGL; volver restaura foco y desplazamiento de la lista. Usa
   Playwright instalado en el entorno (PLAYWRIGHT_MODULE opcional). */
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
/* La cadencia real del navegador varía por equipo. Esta métrica deja avanzar
   lo que corresponde a frames perdidos, pero nunca un teletransporte: incluso
   con una pausa breve ningún paso puede recorrer más del 42% del trayecto. */
function continuidad(traza,duracion=760){
  const muestras=traza.length,pasos=traza.slice(1).map((p,i)=>({
    salto:Math.max(Math.abs(p.x-traza[i].x),Math.abs(p.y-traza[i].y),Math.abs(p.w-traza[i].w),Math.abs(p.h-traza[i].h)),
    dt:Math.max(1,p.t-traza[i].t)
  }));
  const inicio=traza[0],fin=traza.at(-1),recorrido=inicio&&fin?Math.max(Math.abs(fin.x-inicio.x),Math.abs(fin.y-inicio.y),Math.abs(fin.w-inicio.w),Math.abs(fin.h-inicio.h)):0;
  const saltoMaximo=pasos.length?Math.max(...pasos.map(p=>p.salto)):0,mayorDt=pasos.length?Math.max(...pasos.map(p=>p.dt)):0;
  const umbral=Math.max(42,Math.min(recorrido*.42,recorrido*Math.min(.16,mayorDt/duracion*3.7)+24));
  return {muestras,recorrido,saltoMaximo,mayorDt,umbral};
}
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
      // tenía antes. Sus cartas y controles flotan sobre el mismo mundo que
      // termina mostrando el visor individual.
      const biblioteca=await pagina.evaluate(()=>{
        const panel=document.querySelector('#coleccionPanel'),interior=panel.querySelector('.coleccionInterior'),mundo=interior.querySelector('.coleccionMundoVisor'),visor=mundo?.querySelector('.visor3dIncrustado.visor3dMundo'),rejilla=panel.querySelector('.coleccionRejilla'),cartas=[...rejilla.querySelectorAll('.coleccionMini')],p=panel.getBoundingClientRect(),columnas=getComputedStyle(rejilla).gridTemplateColumns.trim().split(/\s+/).filter(Boolean),rMundo=mundo?.getBoundingClientRect();
        const cubre=(n,base)=>{const r=n?.getBoundingClientRect();return !!r&&!!base&&r.width>0&&r.height>0&&r.left>=base.left-2&&r.right<=base.right+2&&r.top>=base.top-2&&r.bottom<=base.bottom+2;};
        const muestra=cartas.find(n=>n.querySelector('.coleccionCarta')?.getBoundingClientRect().width>40),rMuestra=muestra?.getBoundingClientRect(),encima=!!rMuestra&&!!document.elementFromPoint(rMuestra.left+rMuestra.width/2,rMuestra.top+rMuestra.height*.38)?.closest('.coleccionMini');
        // La referencia se conserva en la propia página para comprobar que no
        // se cambia el mundo durante el viaje al detalle ni al volver.
        window.__coleccionMundoPrueba=mundo;
        window.__coleccionArchivoPrueba=panel.querySelector('.coleccionArchivoCapa');
        window.__coleccionPedestalPrueba=visor?.querySelector('.visor3dPedestal')||null;
        const pR=window.__coleccionPedestalPrueba?.getBoundingClientRect();
        window.__coleccionPedestalRectPrueba=pR?{left:pR.left,top:pR.top,width:pR.width,height:pR.height}:null;
        return {cubre:p.left<=1&&p.top<=1&&p.right>=innerWidth-1&&p.bottom>=innerHeight-1,
          sinMarco:parseFloat(getComputedStyle(panel).borderTopWidth)===0&&parseFloat(getComputedStyle(panel).borderRadius)===0,
          mundo:!!mundo&&panel.dataset.mundo==='archivo'&&visor?.dataset.modo==='ambiente'&&!visor.querySelector('.visor3dCuerpo,.visor3dGL'),mundoCubreMenu:[panel.querySelector('.coleccionCabecera'),panel.querySelector('.coleccionPestanas'),panel.querySelector('.coleccionFiltrosInmersivos'),rejilla].every(n=>cubre(n,rMundo)),cartasEncimaMundo:encima,
          tresColumnas:columnas.length===3,
          vertical:rejilla.scrollHeight>rejilla.clientHeight+1,sinDesbordeHorizontal:rejilla.scrollWidth<=rejilla.clientWidth+1,
          region:rejilla.getAttribute('role')==='region',sinCarrusel:!rejilla.classList.contains('coleccionCarruselCartas'),
          cartasVisibles:cartas.filter(n=>n.querySelector('.coleccionCarta')?.getBoundingClientRect().width>40).length>=3,
          sinCaja:getComputedStyle(panel.querySelector('.coleccionCabecera')).backgroundImage==='none',
          sinFondosAuxiliares:getComputedStyle(interior,'::before').display==='none'&&getComputedStyle(interior,'::after').display==='none'&&getComputedStyle(panel.querySelector('.coleccionEscenaArchivo'),'::before').display==='none'};
      });
      assert.ok(biblioteca.cubre&&biblioteca.sinMarco,'La biblioteca ocupa toda la pantalla, sin una caja modal reducida');
      assert.ok(biblioteca.mundo&&biblioteca.mundoCubreMenu&&biblioteca.cartasEncimaMundo&&biblioteca.tresColumnas&&biblioteca.vertical&&biblioteca.sinDesbordeHorizontal&&biblioteca.region&&biblioteca.sinCarrusel&&biblioteca.cartasVisibles&&biblioteca.sinCaja&&biblioteca.sinFondosAuxiliares,'La biblioteca vive sobre el mundo del visor: controles y cartas flotan en él, mantiene tres columnas con scroll vertical y no deja fondos auxiliares ni una caja morada');
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
      // La transición no puede fabricar otra ficha: retenemos la identidad de
      // este nodo real antes de abrirlo y la comprobamos tanto en el vuelo como
      // en la cara final del visor. Así también se conserva su arte ya cargado.
      const fichaInicial=await mini.evaluate(n=>{
        const ficha=n.querySelector('.coleccionCarta');
        window.__coleccionFichaPrueba=ficha;
        const r=ficha?.getBoundingClientRect();
        window.__coleccionFichaRectPrueba=r?{left:r.left,top:r.top,width:r.width,height:r.height}:null;
        return !!ficha;
      });
      assert.ok(fichaInicial,'La miniatura aporta una ficha real para el relevo');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-archivo.png')});
      // Un muestreo por frame detecta un salto geométrico aunque la carta siga
      // siendo el mismo nodo. La apertura fusionada debe interpolar desde su
      // celda hasta el visor, nunca cambiar de tamaño en un solo fotograma.
      await pagina.evaluate(()=>{
        const hasta=performance.now()+1150,traza=[];traza.ausencias=0;window.__coleccionTrazaPrueba=traza;
        const tomar=()=>{const nodo=window.__coleccionFichaPrueba,r=nodo?.getBoundingClientRect();if(!nodo?.isConnected||!r||r.width<=8||r.height<=8)traza.ausencias++;else traza.push({t:performance.now(),x:r.left,y:r.top,w:r.width,h:r.height});if(performance.now()<hasta)requestAnimationFrame(tomar);};
        requestAnimationFrame(tomar);
      });
      await mini.click();
      if(conMovimiento){
        await pagina.waitForFunction(id=>{
          const panel=document.querySelector('#coleccionPanel'),rejilla=panel?.querySelector('.coleccionRejilla'),elegida=rejilla?.querySelector('.coleccionMini[data-carta="'+id+'"]'),resto=[...(rejilla?.querySelectorAll('.coleccionMini')||[])].filter(n=>n!==elegida),mundo=panel?.querySelector('.coleccionMundoVisor'),visor=mundo?.querySelector('.visor3dIncrustado.visor3dMundo');
          const frente=visor?.querySelector('.visor3dFrente .visor3dCarta');
          return panel?.dataset.transicion==='abrir-carta'&&panel.dataset.cartaActiva===id&&panel.classList.contains('coleccionFusionando')&&elegida?.dataset.animacion==='entra'&&resto.length>0&&resto.every(n=>n.dataset.animacion==='sale')&&rejilla.getAttribute('aria-busy')==='true'&&rejilla.hasAttribute('inert')&&!panel.querySelector('.coleccionVueloCarta')&&mundo===window.__coleccionMundoPrueba&&visor?.dataset.modo==='carta'&&visor.querySelector('.visor3dPedestal')===window.__coleccionPedestalPrueba&&frente===window.__coleccionFichaPrueba;
        },carta,{timeout:2200});
        const transicion=await pagina.evaluate(id=>{
          const panel=document.querySelector('#coleccionPanel'),rejilla=panel.querySelector('.coleccionRejilla'),elegida=rejilla.querySelector('.coleccionMini[data-carta="'+id+'"]'),resto=[...rejilla.querySelectorAll('.coleccionMini')].filter(n=>n!==elegida),vuelo=panel.querySelector('.coleccionVueloCarta'),mundo=panel.querySelector('.coleccionMundoVisor'),visor=mundo?.querySelector('.visor3dIncrustado.visor3dMundo');
          const frente=visor?.querySelector('.visor3dFrente .visor3dCarta');
          const interior=panel.querySelector('.coleccionInterior'),archivo=panel.querySelector('.coleccionEscenaArchivo');
          return {estado:panel.dataset.transicion,activa:panel.dataset.cartaActiva,fusion:panel.classList.contains('coleccionFusionando'),elegida:elegida?.dataset.animacion,salen:resto.every(n=>n.dataset.animacion==='sale'&&n.getAttribute('aria-hidden')==='true'),sinVuelo:!vuelo,mismaFicha:frente===window.__coleccionFichaPrueba,bloqueada:rejilla.hasAttribute('inert')&&rejilla.getAttribute('aria-busy')==='true',mundo:mundo===window.__coleccionMundoPrueba&&mundo.isConnected&&visor?.dataset.modo==='carta',pedestal:visor?.querySelector('.visor3dPedestal')===window.__coleccionPedestalPrueba,sinFondosAuxiliares:getComputedStyle(interior,'::before').display==='none'&&getComputedStyle(interior,'::after').display==='none'&&getComputedStyle(archivo,'::before').display==='none'};
        },carta);
        assert.deepEqual(transicion,{estado:'abrir-carta',activa:carta,fusion:true,elegida:'entra',salen:true,sinVuelo:true,mismaFicha:true,bloqueada:true,mundo:true,pedestal:true,sinFondosAuxiliares:true},'Abrir una carta usa directamente la ficha y el círculo rúnico originales dentro del mismo mundo, sin una fase de vuelo, otro visor ni fondo auxiliar');
        if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-transicion.png')});
      }
      const escena=pagina.locator('#coleccionPanel .coleccionMundoVisor .visor3dIncrustado');await escena.waitFor({timeout:4000});
      if(conMovimiento)await pagina.waitForFunction(()=>{
        const panel=document.querySelector('#coleccionPanel'),detalle=panel?.querySelector('.coleccionDetalleCapa');
        return panel?.dataset.vista==='detalle'&&!panel.dataset.transicion&&!panel.classList.contains('coleccionFusionando')&&!detalle?.hasAttribute('inert');
      },null,{timeout:4000});
      // El Archivo entrega su ficha DOM al mundo persistente. No se la cambia
      // por una proyección WebGL al terminar la transición: eso reintroduciría
      // una segunda geometría/arte justo después del FLIP.
      await pagina.waitForFunction(()=>{
        const v=document.querySelector('.visor3dIncrustado'),frente=v?.querySelector('.visor3dFrente .visor3dCarta'),r=frente?.getBoundingClientRect(),e=v?.getBoundingClientRect();
        return !!r&&!!e&&r.width>60&&r.left>=e.left-2&&r.right<=e.right+2&&r.top>=e.top-2&&r.bottom<=e.bottom+2;
      },null,{timeout:5000});
      const abierta=await pagina.evaluate(()=>{
        const panel=document.querySelector('#coleccionPanel'),mundo=panel.querySelector('.coleccionMundoVisor'),v=mundo?.querySelector('.visor3dIncrustado'),frente=v.querySelector('.visor3dFrente .visor3dCarta'),r=frente.getBoundingClientRect(),e=v.getBoundingClientRect();
        const fichas=[...document.querySelectorAll('#coleccionPanel .coleccionVersion .coleccionCarta')].filter(n=>n.getClientRects().length),pedestal=v.querySelector('.visor3dPedestal'),rP=pedestal?.getBoundingClientRect(),inicio=window.__coleccionPedestalRectPrueba,estilo=pedestal&&getComputedStyle(pedestal),reposicionado=!!rP&&!!inicio&&(Math.abs(rP.left-inicio.left)>3||Math.abs(rP.top-inicio.top)>3||Math.abs(rP.width-inicio.width)>3||Math.abs(rP.height-inicio.height)>3),reducido=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const traza=window.__coleccionTrazaPrueba||[];
        return {acabado:v.dataset.acabado,elegido:CAOZ_COLECCION.elegido(frente.dataset.card||frente.closest('[data-carta]')?.dataset.carta||''),cartaReal:frente.classList.contains('coleccionCarta')&&!!frente.querySelector('.marcoDibujo, .lface'),
          dentro:r.left>=e.left-2&&r.right<=e.right+2&&r.top>=e.top-2&&r.bottom<=e.bottom+2&&r.width>60,fichasVisibles:fichas.length,versiones:document.querySelectorAll('#coleccionPanel .coleccionVersion').length,
          desborde:document.documentElement.scrollWidth>innerWidth,logo:v.querySelector('.visor3dDorso img.visor3dLogo')?.getAttribute('src'),mismaFicha:frente===window.__coleccionFichaPrueba,mundo:panel.dataset.mundo==='detalle'&&mundo===window.__coleccionMundoPrueba&&mundo.isConnected&&v.dataset.modo==='carta',pedestal:pedestal===window.__coleccionPedestalPrueba&&pedestal.isConnected&&reposicionado&&(reducido||estilo.transitionProperty.includes('top')),sinIntercambioGL:!v.classList.contains('visor3dConGL'),traza,ausencias:traza.ausencias||0,visores:panel.querySelectorAll('.visor3dIncrustado').length};
      });
      assert.ok(abierta.cartaReal,'La escena muestra la ficha real de la Colección');
      assert.ok(abierta.mismaFicha,'El visor adopta la misma ficha del Archivo: no vuelve a cargar ni sustituye el asset');
      assert.ok(abierta.mundo,'El visor individual reutiliza el mismo mundo que sostenía el Archivo');
      assert.ok(abierta.pedestal,'El círculo rúnico es el mismo nodo y se reposiciona en vez de desaparecer al entrar al visor');
      assert.ok(abierta.sinIntercambioGL,'La ficha DOM permanece visible al terminar el FLIP: no se intercambia por otra geometría WebGL');
      if(conMovimiento){const medida=continuidad(abierta.traza);assert.ok(abierta.ausencias===0&&medida.muestras>5&&medida.saltoMaximo<=medida.umbral,'La ficha viaja continuamente al visor: no hay un salto de posición o dimensiones entre Archivo y detalle');}
      assert.equal(abierta.visores,1,'No queda un segundo visor detrás de la carta: Archivo y detalle comparten la única escena');
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
        const estado=await pagina.evaluate(([r,c,a])=>({misma:document.querySelector('.visor3dIncrustado')===r,mismaFicha:document.querySelector('.visor3dFrente .visor3dCarta')===window.__coleccionFichaPrueba,bloqueada:r.classList.contains('visor3dBloqueada'),gl:r.classList.contains('visor3dConGL'),lienzoVisible:getComputedStyle(r.querySelector('.visor3dGL')).visibility==='visible',tiene:CAOZ_COLECCION.tiene(c,a)}),[raiz,carta,a]);
        assert.ok(estado.misma&&estado.mismaFicha,'Cambiar de edición conserva la escena y la misma ficha');
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
      await pagina.waitForFunction(()=>!document.querySelector('dialog.visor3d')&&document.querySelector('#coleccionPanel').open&&document.querySelector('.coleccionMundoVisor .visor3dIncrustado'));
      // Volver al Archivo hace el FLIP inverso de la misma ficha. No se
      // reconstruye la rejilla ni se cambia a otra carta durante el regreso.
      await pagina.evaluate(()=>{
        window.__coleccionFichaRegreso=document.querySelector('.visor3dFrente .visor3dCarta');
        const hasta=performance.now()+1150,traza=[];traza.ausencias=0;window.__coleccionTrazaRegreso=traza;
        const tomar=()=>{const nodo=window.__coleccionFichaRegreso,r=nodo?.getBoundingClientRect(),visor=document.querySelector('.visor3dIncrustado');if(!nodo?.isConnected||!r||r.width<=8||r.height<=8)traza.ausencias++;else traza.push({t:performance.now(),x:r.left,y:r.top,w:r.width,h:r.height,fase:visor?.classList.contains('visor3dDevolviendo')?'viaje':visor?.classList.contains('visor3dPreparandoRegreso')?'preparacion':'vista'});if(performance.now()<hasta)requestAnimationFrame(tomar);};
        requestAnimationFrame(tomar);
      });
      await pagina.locator('.coleccionAtras').click();
      await pagina.waitForFunction(id=>{
        const panel=document.querySelector('#coleccionPanel'),rejilla=panel?.querySelector('.coleccionRejilla'),mini=rejilla?.querySelector('.coleccionMini[data-carta="'+id+'"]'),mundo=panel?.querySelector('.coleccionMundoVisor'),visor=mundo?.querySelector('.visor3dIncrustado.visor3dMundo');
        return panel?.dataset.vista==='cartas'&&!panel.dataset.transicion&&!panel.classList.contains('coleccionRegresandoArchivo')&&document.activeElement===mini&&mini?.querySelector('.coleccionCarta')===window.__coleccionFichaPrueba&&visor?.dataset.modo==='ambiente';
      },carta,{timeout:4000});
      const regreso=await pagina.evaluate(id=>{const panel=document.querySelector('#coleccionPanel'),rejilla=panel.querySelector('.coleccionRejilla'),mini=rejilla.querySelector('.coleccionMini[data-carta="'+id+'"]'),r=mini.getBoundingClientRect(),g=rejilla.getBoundingClientRect(),mundo=panel.querySelector('.coleccionMundoVisor'),visor=mundo?.querySelector('.visor3dIncrustado.visor3dMundo'),traza=window.__coleccionTrazaRegreso||[];return {foco:document.activeElement===mini,desplazamiento:rejilla.scrollTop,visible:r.bottom>g.top+18&&r.top<g.bottom-18,mundo:mundo===window.__coleccionMundoPrueba&&mundo.isConnected&&visor?.dataset.modo==='ambiente'&&!visor.querySelector('.visor3dCuerpo,.visor3dGL'),pedestal:visor?.querySelector('.visor3dPedestal')===window.__coleccionPedestalPrueba,mismaCapa:panel.querySelector('.coleccionArchivoCapa')===window.__coleccionArchivoPrueba,mismaFicha:mini.querySelector('.coleccionCarta')===window.__coleccionFichaPrueba&&window.__coleccionFichaRegreso===window.__coleccionFichaPrueba,traza,ausencias:traza.ausencias||0};},carta);
      assert.ok(regreso.foco,'Volver devuelve el foco a la carta que se estaba viendo');
      assert.ok(regreso.desplazamiento>1&&regreso.visible,'Volver restaura la fila desplazada del Archivo, no el inicio de la biblioteca');
      assert.ok(regreso.mundo,'Volver no destruye ni sustituye el mundo del visor');
      assert.ok(regreso.pedestal,'Volver conserva el mismo círculo rúnico en el Archivo');
      assert.ok(regreso.mismaCapa,'El regreso conserva la capa original del Archivo; no reconstruye la colección');
      assert.ok(regreso.mismaFicha,'El regreso conserva la ficha original; no vuelve a crear la carta');
      if(conMovimiento){const trazaViaje=regreso.traza.filter(p=>p.fase==='viaje'),medida=continuidad(trazaViaje);assert.ok(regreso.ausencias===0&&regreso.traza.some(p=>p.fase==='preparacion')&&medida.muestras>5&&medida.saltoMaximo<=medida.umbral,'La misma ficha vuelve continuamente a su celda, sin un salto de posición o dimensiones');}
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-regreso.png')});
      assert.deepEqual(errores,[],'Sin errores de página');
      console.log('✓ '+vista+' '+width+'×'+height+': '+(pintada?'carta DOM continua':'retrato de Protagonista')+', mundo continuo del visor, archivo de tres columnas, transición al detalle 3D, ediciones, vuelta, pantalla completa y regreso con foco/scroll');
    }finally{await contexto.close();}
  }
}catch(error){
  if(sabotaje){console.log('✓ Sabotaje detectado: sin el visor el detalle no muestra la carta en 3D');process.exitCode=0;}
  else throw error;
}finally{await navegador?.close();servidor?.close();}
if(sabotaje&&process.exitCode!==0){console.error('✗ El sabotaje no se detectó');process.exitCode=1;}

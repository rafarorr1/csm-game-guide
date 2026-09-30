/* Logros en la Colección aislada: el mismo modelo otorga un solo sobre por
   logro y la revisión exportada conserva tanto el componente como la entrada
   directa a la pestaña. No carga una partida ni un perfil real. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {crearServidor} from './servidor.mjs';
import {exportar} from './exportar.mjs';
import {hash,juego} from './fuentes.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-logros-export-'));
const destino=path.join(temp,'vista');
try{
  const resultado=exportar(destino);
  const archivo=path.join(destino,'juego','logros.js');
  assert.ok(fs.statSync(archivo).isFile(),'La revisión exportada incluye el evaluador de logros.');
  assert.equal(hash(fs.readFileSync(archivo)),resultado.componentes['logros.js'],'El evaluador exportado es byte por byte el componente real.');
  for(const nombre of ['escritorio.html','movil.html']){
    const html=fs.readFileSync(path.join(destino,nombre),'utf8'),modelo=html.indexOf('./juego/coleccion-modelo.js'),logros=html.indexOf('./juego/logros.js'),ui=html.indexOf('./juego/coleccion-ui.js');
    assert.ok(modelo>=0&&logros>modelo&&ui>logros,'El modelo de logros carga después de la Colección y antes de su interfaz.');
    assert.ok(html.includes('value="logros"'),'La revisión permite elegir el escenario de logros.');
  }
  let destinoAbrir;
  const abrir=fs.readFileSync(path.join(destino,'abrir.js'),'utf8');
  for(const [busqueda,esperado] of [['?estado=logros','logros'],['?estado=sobres&pestana=logros','sobres']]){
    destinoAbrir='';
    vm.runInNewContext(abrir,{URL,URLSearchParams,matchMedia:()=>({matches:false}),location:{search:busqueda,href:'https://revision.example/',replace:url=>{destinoAbrir=url;}}});
    const url=new URL(destinoAbrir);
    assert.equal(url.pathname,'/escritorio.html');assert.equal(url.searchParams.get('estado'),esperado);
    if(busqueda.includes('pestana='))assert.equal(url.searchParams.get('pestana'),'logros','El enlace público conserva la pestaña de Logros.');
  }
  console.log('✓ La exportación incluye Logros, respeta el orden de carga y conserva su entrada directa.');

  const servidor=crearServidor();await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
  const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html';
  let navegador;
  try{
    navegador=await chromium.launch({channel:'chrome',headless:true});
    for(const [vista,width,height] of [['desktop',1440,900],['desktop',760,844],['movil',390,844],['movil',320,568]]){
      const contexto=await navegador.newContext({viewport:{width,height},hasTouch:vista==='movil',reducedMotion:'reduce'}),pagina=await contexto.newPage(),errores=[];
      pagina.on('pageerror',error=>errores.push(error.message));
      try{
        await pagina.goto(base+'?vista='+vista+'&estado=logros');
        await pagina.locator('#coleccionPanel[open][data-vista="logros"] .coleccionLogro').first().waitFor({timeout:10000});
        const inicio=await pagina.evaluate(()=>{
          const api=window.CAOZ_LOGROS,modelo=window.CAOZ_COLECCION,metas=api.leer();
          return {definiciones:api.definiciones.length,tarjetas:document.querySelectorAll('#coleccionPanel .coleccionLogro').length,
            logrosActiva:[...document.querySelectorAll('#coleccionPanel .coleccionPestana')].find(n=>n.textContent.trim().startsWith('Logros'))?.getAttribute('aria-current'),
            completados:metas.obtenidos.slice().sort(),sobres:modelo.sobres(),pendientes:modelo.recompensasPendientes().filter(p=>p.origen==='logro').length,
            canciones:api.progreso('fender_22_canciones',metas).texto,oponentes:api.progreso('rafaela_you_rul',metas).texto,
            ancho:document.documentElement.scrollWidth,visor:innerWidth};
        });
        assert.equal(inicio.definiciones,23,'Los 23 logros solicitados llegan a la revisión.');
        assert.equal(inicio.tarjetas,23,'La pestaña muestra una tarjeta por logro.');
        assert.equal(inicio.logrosActiva,'page','La URL de Logros deja activa esa pestaña.');
        assert.deepEqual(inicio.completados,['mohamed_ctt','talesin_cero_a_heroe'],'El fixture usa condiciones reales para mostrar logros logrados.');
        assert.equal(inicio.sobres,2);assert.equal(inicio.pendientes,2,'Cada uno de los dos logros de muestra deja exactamente un sobre pendiente.');
        assert.equal(inicio.canciones,'7 / 22');assert.equal(inicio.oponentes,'2 / 4','Los avances acumulativos se ven antes de completarse.');
        assert.ok(inicio.ancho<=inicio.visor+1,'La pestaña de Logros no desborda horizontalmente.');

        const medallasYTexto=await pagina.evaluate(()=>{
          const tarjetas=[...document.querySelectorAll('#coleccionPanel .coleccionLogro')];
          const dentro=(interior,exterior)=>interior.left>=exterior.left-1&&interior.right<=exterior.right+1&&interior.top>=exterior.top-1&&interior.bottom<=exterior.bottom+1;
          const fuera=[];
          for(const tarjeta of tarjetas){
            const limite=tarjeta.getBoundingClientRect();
            for(const selector of ['.coleccionMedalla','.coleccionLogroTitulo','.coleccionLogroDescripcion','.coleccionLogroMeta','.coleccionLogroPremio','.coleccionLogroPrueba']){
              const nodo=tarjeta.querySelector(selector);if(!nodo)continue;
              const rect=nodo.getBoundingClientRect();
              // Chrome redondea algunos line-height fraccionales a dos píxeles
              // distintos entre scrollHeight y clientHeight aun cuando no hay
              // recorte. El rectángulo es la comprobación geométrica decisiva.
              if(!dentro(rect,limite)||nodo.scrollWidth>nodo.clientWidth+2||nodo.scrollHeight>nodo.clientHeight+2)fuera.push({id:tarjeta.dataset.logro,selector,limite:[limite.width,limite.height],nodo:[rect.width,rect.height],scroll:[nodo.scrollWidth,nodo.scrollHeight,nodo.clientWidth,nodo.clientHeight]});
            }
          }
          const medallas=tarjetas.map(t=>{const sello=t.querySelector('.coleccionMedalla');return {id:t.dataset.logro,diseno:sello?.dataset.medalla,protagonista:sello?.dataset.protagonista,estado:sello?.dataset.estado,svg:!!sello?.querySelector('svg')};});
          return {medallas,fuera};
        });
        assert.equal(medallasYTexto.medallas.length,23,'Cada logro tiene su medalla.');
        assert.equal(new Set(medallasYTexto.medallas.map(m=>m.diseno)).size,23,'Cada logro recibe un emblema distinto.');
        assert.ok(medallasYTexto.medallas.every(m=>m.diseno&&m.protagonista&&m.svg),'Todas las medallas conservan su glifo y protagonista.');
        assert.equal(medallasYTexto.medallas.find(m=>m.id==='mohamed_ctt')?.estado,'obtenida','Un logro cumplido recibe su sello iluminado.');
        assert.deepEqual(medallasYTexto.fuera,[],'Los textos, medallas y controles quedan dentro de cada recuadro.');

        // Sobres, Canjear y Logros no sustituyen al Archivo: comparten su
        // huésped real del visor. La referencia al nodo detecta incluso un
        // desmontaje que intente dejar un fondo visualmente parecido.
        const mundoInicial=await pagina.evaluate(()=>{
          const panel=document.querySelector('#coleccionPanel'),host=panel?.querySelector('.coleccionMundoVisor');
          window.__mundoArchivoPrueba=host;
          return {modo:panel?.dataset.mundo,visible:!!host&&!host.hidden,escena:!!host?.querySelector('.visor3dMundo'),ancho:host?.getBoundingClientRect().width||0,alto:host?.getBoundingClientRect().height||0};
        });
        assert.equal(mundoInicial.modo,'archivo','Logros se abre sobre el mundo del Archivo, no sobre una pantalla ajena.');
        assert.ok(mundoInicial.visible&&mundoInicial.escena&&mundoInicial.ancho>0&&mundoInicial.alto>0,'Logros conserva visible la escena real del visor.');
        for(const destino of ['cartas','sobres','canje','logros']){
          await pagina.locator('#coleccionPanel .coleccionPestana[data-vista="'+destino+'"]').click();
          await pagina.locator('#coleccionPanel[data-vista="'+destino+'"]').waitFor({timeout:4000});
          const mundo=await pagina.evaluate(()=>{
            const panel=document.querySelector('#coleccionPanel'),host=panel?.querySelector('.coleccionMundoVisor'),contenido=panel?.querySelector('.coleccionContenido');
            const estilo=host?getComputedStyle(host):null;
            return {mismo:host===window.__mundoArchivoPrueba,modo:panel?.dataset.mundo,visible:!!host&&!host.hidden&&estilo?.display!=='none',escena:!!host?.querySelector('.visor3dMundo'),contenidosSobre:!!contenido&&!!host&&(contenido.compareDocumentPosition(host)&Node.DOCUMENT_POSITION_PRECEDING)!==0};
          });
          assert.ok(mundo.mismo,'La pestaña '+destino+' reutiliza el mismo mundo, sin reemplazarlo.');
          assert.equal(mundo.modo,'archivo','La pestaña '+destino+' conserva el encuadre Archivo.');
          assert.ok(mundo.visible&&mundo.escena,'La escena del visor queda detrás de '+destino+'.');
          assert.ok(mundo.contenidosSobre,'Los controles de '+destino+' flotan por encima de la escena.');
        }

        const objetivo='mohamed_sneaky_tricky';
        await pagina.locator('#coleccionPanel .coleccionLogro[data-logro="'+objetivo+'"] .coleccionLogroPrueba').click();
        await pagina.locator('#coleccionPanel .coleccionLogro[data-logro="'+objetivo+'"].completado').waitFor({timeout:4000});
        const premiado=await pagina.evaluate(id=>{
          const api=window.CAOZ_LOGROS,modelo=window.CAOZ_COLECCION,antes={sobres:modelo.sobres(),pendientes:modelo.recompensasPendientes().filter(p=>p.origen==='logro').length};
          const repetido=api.simularDesbloqueo(id),despues={sobres:modelo.sobres(),pendientes:modelo.recompensasPendientes().filter(p=>p.origen==='logro').length};
          return {recibido:api.leer().obtenidos.includes(id),antes,repetido,despues};
        },objetivo);
        assert.ok(premiado.recibido,'El simulador de la revisión marca el logro.');
        assert.deepEqual(premiado.antes,{sobres:3,pendientes:3},'El logro nuevo añadió un único sobre antes de cualquier reintento.');
        assert.equal(premiado.repetido.nuevos.length,0,'Reintentar el mismo logro no vuelve a premiarlo.');
        assert.deepEqual(premiado.despues,premiado.antes,'El recibo conserva un único sobre aunque se repita el evento.');
        assert.deepEqual(errores,[],'La pestaña de Logros no genera errores de JavaScript.');
        console.log('✓ '+vista+' '+width+'×'+height+': Logros, progreso, premio único y entrada directa correctos.');
      }finally{await contexto.close();}
    }
  }finally{await navegador?.close();await new Promise(resolve=>servidor.close(resolve));}
}finally{fs.rmSync(temp,{recursive:true,force:true});}

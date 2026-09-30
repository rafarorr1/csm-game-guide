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
    for(const [vista,width,height] of [['desktop',1440,900],['movil',390,844]]){
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

/* Cartas de la partida, en la sección aislada: el paquete sólo publica sus
   dependencias y usa el renderer real; en el navegador todas las cartas llevan
   su cara pintada, las cifras caen sobre sus gemas en escritorio y teléfono, un
   golpe cambia las cifras sin repintar la cara, la ficha y el dorso se pintan.
   Usa Playwright instalado en el entorno (PLAYWRIGHT_MODULE opcional). */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,derivarCartas,componentesCartas,imagenesCartas,cartasRevision} from './cartas-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {hash,juego} from './fuentes.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-cartas-'));
try{
  const destino=path.join(temporal,'cartas'),p=exportar(destino),leer=f=>fs.readFileSync(path.join(destino,f));
  const esperados=['index.html','movil.html','_headers','procedencia.json','catalogo-vacio.json','memoria.js','red-estatica.js','cartas.js','cartas.css','art/encuadres.json',
    ...['desktop','movil'].flatMap(v=>['datos.js','renderer.js','base.css'].map(f=>'generado/'+v+'/'+f)),...componentesCartas.map(f=>'juego/'+f),...imagenesCartas.map(f=>'art/'+f)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica sus dependencias declaradas');
  for(const pagina of ['index.html','movil.html']){
    const html=leer(pagina).toString();
    for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),pagina+' enlaza '+m[1]);
    assert.ok(!/__[A-Z]+__|<iframe/.test(html)&&!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),pagina+': sin marcadores, iframes ni recursos remotos');
  }
  for(const v of ['desktop','movil'])assert.equal(leer('generado/'+v+'/renderer.js').toString(),derivarCartas(v).renderJS,v+': renderer derivado del juego actual');
  assert.ok(derivarCartas('desktop').renderJS.includes('CAOZ_CARTA_JUEGO?.vestir(d,id)'),'ilustrar real viste la carta');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(leer('juego/'+f)),firma,f+' conserva fuente exacta');
  for(const f of ['motor.js','final.js','sw.js','_worker.js'])assert.ok(!fs.existsSync(path.join(destino,f)),f+' no acompaña la sección');
  assert.deepEqual(p.cartas,cartasRevision);assert.equal(p.partida,false);
  assert.throws(()=>exportar(destino),/vacío/);
  const css=fs.readFileSync(path.join(juego,'carta-juego.css'),'utf8');
  assert.ok(!/preserve-3d/.test(css)&&!/\.finished\b/.test(fs.readFileSync(path.join(juego,'carta-juego.js'),'utf8')),'Sin preserve-3d ni Animation.finished');
  console.log('✓ Exportación: escritorio y teléfono con renderer real y dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/cartas.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height]of [['desktop',1440,900],['movil',390,844]]){
    const contexto=await navegador.newContext({viewport:{width,height},hasTouch:vista==='movil'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    try{
      await pagina.goto(base+'?vista='+vista);
      await pagina.waitForFunction(()=>{const c=[...document.querySelectorAll('.card')];return c.length>=15&&c.every(n=>n.dataset.piel==='lista')&&document.querySelector('.big')?.dataset.pielFicha==='lista';},null,{timeout:60000});
      const r=await pagina.evaluate(()=>{
        const cartas=[...document.querySelectorAll('.card')];
        const fuera=cartas.filter(c=>{const k=c.querySelector('.cost');return k.offsetParent!==c||Math.abs(k.offsetLeft/c.clientWidth-.87)>.03||Math.abs(k.offsetTop/c.clientHeight-.08)>.03;}).map(c=>c.dataset.card);
        const nombres=cartas.filter(c=>getComputedStyle(c.querySelector('.nm')).color!=='rgba(0, 0, 0, 0)').map(c=>c.dataset.card);
        const numeros=cartas.flatMap(c=>[...c.querySelectorAll('.cost,.atk,.hp')]).filter(n=>{const b=n.getBoundingClientRect();return b.width<16||getComputedStyle(n).color==='rgba(0, 0, 0, 0)';}).length;
        const ficha=document.querySelector('.big'),impreso=[...ficha.querySelectorAll(':scope > .cjImpreso')].filter(n=>n.getClientRects().length).length;
        return {fuera,nombres,numeros,impreso,ficha:ficha.querySelector('.cjFicha').getBoundingClientRect().width,dorso:getComputedStyle(document.documentElement).getPropertyValue('--cj-dorso').includes('blob:'),
          desborde:document.documentElement.scrollWidth>innerWidth,alto:document.documentElement.scrollHeight>innerHeight};
      });
      assert.deepEqual(r.fuera,[],vista+': el coste cae sobre su gema');
      assert.deepEqual(r.nombres,[],vista+': lo impreso queda transparente bajo la cara');
      assert.equal(r.numeros,0,vista+': las cifras se ven y se leen');
      assert.ok(r.impreso===0&&r.ficha>200,vista+': la ficha muestra la carta pintada en lugar de lo impreso');
      assert.ok(r.dorso,vista+': el dorso se pinta con el logo');
      assert.ok(!r.desborde&&r.alto,vista+': la página se desplaza en vertical y no se sale de lado');
      const antes=await pagina.evaluate(()=>{const c=document.querySelector('#mesaPropia .card');return {src:c.querySelector('.cjCara').src,hp:c.querySelector('.hp').textContent};});
      await pagina.click('#combate');
      const despues=await pagina.evaluate(()=>{const c=document.querySelector('#mesaPropia .card');return {src:c.querySelector('.cjCara').src,hp:c.querySelector('.hp').textContent,baja:c.querySelector('.hp').classList.contains('cjBaja'),lista:c.dataset.piel};});
      assert.ok(despues.hp!==antes.hp&&despues.baja,vista+': el golpe cambia la vida y la tiñe');
      assert.ok(despues.src===antes.src&&despues.lista==='lista',vista+': el golpe no repinta la cara');
      assert.deepEqual(errores,[],vista+': sin errores de página');
      console.log('✓ '+vista+' '+width+'×'+height+': cartas pintadas, cifras en sus gemas, golpe sin repintar, ficha y dorso');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

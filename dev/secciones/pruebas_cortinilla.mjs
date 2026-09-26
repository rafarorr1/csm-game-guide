/* Pruebas de la cortinilla del Domo en su sección aislada: el paquete sólo
   lleva sus dependencias; la carga avanza mientras se pintan las cartas; la
   cortinilla cambia la carga por el menú cuando el muro tapa la pantalla y
   termina dejando el menú a la vista; se puede saltar; se repite sin fugas de
   lienzos; y con movimiento reducido la carga se funde en el menú sin 3D.
   En escritorio y en móvil. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesCortinilla,derivarCortinilla} from './cortinilla-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'cortinilla.js'),'utf8');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-cortinilla-'));
try{
  const destino=path.join(temporal,'cortinilla'),p=exportar(destino),{lista}=derivarCortinilla();
  const esperados=['index.html','_headers','procedencia.json','cortinilla-mesa.js','cortinilla-mesa.css','generado/datos.js','art/logo.webp',...componentesCortinilla.map(f=>'juego/'+f),...lista.map(c=>c.url)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La prueba sólo publica sus dependencias');
  assert.ok(new Set(lista.map(c=>c.acabado)).size===3,'La cortinilla mezcla las tres ediciones');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__[A-Z]+__/.test(html)&&!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'Sin marcadores ni recursos remotos');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const url='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/cortinilla.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [ancho,alto,movimiento]of [[1440,900,'no-preference'],[390,844,'no-preference'],[1440,900,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error'||/Cortinilla/.test(m.text()))errores.push(m.text());});
    const caso=ancho+'×'+alto+(movimiento==='reduce'?' · movimiento reducido':'');
    const estado=()=>pagina.evaluate(()=>({...window.CAOZ_CORTINILLA_REVISION.estado(),lienzos:document.querySelectorAll('canvas.cortinillaCartas,canvas.cortinillaLuz').length,
      opacidad:[...document.querySelectorAll('canvas.cortinillaCartas')].map(c=>getComputedStyle(c).opacity).join(),relleno:document.getElementById('cargaRelleno').style.width}));
    const fin=()=>pagina.waitForFunction(()=>window.CAOZ_CORTINILLA_REVISION&&!window.CAOZ_CORTINILLA_REVISION.estado().corriendo,null,{timeout:30000});
    try{
      await pagina.goto(url);
      if(movimiento==='reduce'){
        await fin();const e=await estado();
        assert.ok(e.menu&&!e.carga&&e.lienzos===0,caso+': la carga se funde en el menú, sin cortinilla 3D');
      }else{
        await pagina.waitForFunction(()=>document.getElementById('escenario').dataset.reproduciendo!==undefined,null,{timeout:30000});
        let e=await estado();
        assert.ok(e.relleno==='100%'&&e.carga&&!e.menu&&e.lienzos===2,caso+': la carga llega al 100 % y la cortinilla empieza sobre ella');
        // El menú sólo aparece cuando el muro tapa la pantalla.
        await pagina.waitForFunction(()=>window.CAOZ_CORTINILLA_REVISION.estado().menu,null,{timeout:15000});
        const ya=await pagina.evaluate(()=>performance.now());
        await fin();e=await estado();
        assert.ok(e.menu&&!e.carga&&e.opacidad==='0',caso+': termina con el menú a la vista y la cortinilla retirada');
        // Repetir y saltar: con una tecla, termina mucho antes.
        await pagina.click('#repetir');
        await pagina.waitForFunction(()=>document.getElementById('escenario').dataset.reproduciendo!==undefined,null,{timeout:30000});
        e=await estado();assert.ok(!e.menu&&e.carga&&e.lienzos===2,caso+': «Repetir» vuelve a la carga sin dejar lienzos viejos');
        const t0=await pagina.evaluate(()=>performance.now());await pagina.keyboard.press('Space');
        await fin();const dur=await pagina.evaluate(t=>performance.now()-t,t0);
        e=await estado();assert.ok(e.menu&&!e.carga,caso+': saltar deja el menú');
        assert.ok(dur<3000,caso+': saltar abrevia la cortinilla ('+Math.round(dur)+' ms)');
        assert.ok(ya>0);
      }
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+(movimiento==='reduce'?': fundido de la carga al menú, sin 3D':': carga, cortinilla, menú tras el muro, repetir y saltar'));
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

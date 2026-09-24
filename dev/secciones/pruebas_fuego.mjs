/* Prueba del aliento de fuego, en la sección aislada: el paquete sólo lleva sus
   dependencias; en el navegador Thal ataca, el objetivo arde hasta la ceniza
   (queda oculto y marcado), los lienzos del efecto se liberan, no hay errores
   y «Reiniciar» devuelve la carta. También con movimiento reducido y a la
   velocidad normal. Usa Playwright instalado en el entorno. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesFuego,cartasFuego} from './fuego-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'fx-aliento.js'),'utf8');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-fuego-'));
try{
  const destino=path.join(temporal,'fuego'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','fuego.js','fuego.css','generado/datos.js',...componentesFuego.map(f=>'juego/'+f),...cartasFuego.map(id=>'art/'+id+'.webp')].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La prueba sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__[A-Z]+__/.test(html)&&!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'Sin marcadores ni recursos remotos');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const url='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/fuego.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [ancho,alto,movimiento]of [[1100,900,'no-preference'],[390,844,'no-preference'],[1100,900,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    const caso=ancho+'×'+alto+(movimiento==='reduce'?' · movimiento reducido':'');
    try{
      await pagina.goto(url);
      await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('fuegoEstado').textContent),null,{timeout:30000});
      const cartas=await pagina.evaluate(()=>['atacante','objetivo'].map(id=>document.querySelector('#'+id+' canvas')?.width||0));
      assert.ok(cartas.every(w=>w>300),caso+': las dos cartas están pintadas');
      await pagina.click('#atacar');
      if(movimiento!=='reduce'){
        await pagina.waitForFunction(()=>document.querySelectorAll('#mesaFuego canvas.fxAlientoCapa').length===2,null,{timeout:5000});
        const durante=await pagina.evaluate(()=>getComputedStyle(document.getElementById('atacante')).filter);
        await pagina.waitForFunction(()=>document.getElementById('objetivo').style.visibility==='hidden',null,{timeout:15000});
        assert.match(durante,/drop-shadow/,caso+': Thal se envuelve en su resplandor');
      }
      await pagina.waitForFunction(()=>/ceniza/.test(document.getElementById('fuegoEstado').textContent),null,{timeout:30000});
      const fin=await pagina.evaluate(()=>{const o=document.getElementById('objetivo'),a=document.getElementById('atacante');
        return {oculto:o.style.visibility==='hidden'||getComputedStyle(o).opacity==='0',ceniza:o.dataset.fxCeniza!==undefined,capas:document.querySelectorAll('canvas.fxAlientoCapa').length,atacante:a.style.transform||'',boton:document.getElementById('atacar').disabled};});
      assert.ok(fin.oculto&&fin.ceniza,caso+': el objetivo queda hecho ceniza');
      assert.equal(fin.capas,0,caso+': los lienzos del efecto se liberan');
      assert.equal(fin.atacante,'',caso+': Thal vuelve a su sitio');
      assert.equal(fin.boton,false,caso+': se puede volver a atacar');
      await pagina.click('#reiniciar');
      await pagina.waitForFunction(()=>{const o=document.getElementById('objetivo');return o.style.visibility!=='hidden'&&o.dataset.fxCeniza===undefined;},null,{timeout:10000});
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': Thal ataca, el objetivo arde hasta la ceniza, se liberan los lienzos y se reinicia');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

/* Pruebas de la invocación (fx-invocar.js) en su sección aislada: el paquete
   sólo lleva sus dependencias; cada carta vuela como carta 3D (su casilla se
   oculta mientras tanto) y al caer queda a la vista; la legendaria, la del
   rival y la ficha también; dos a la vez comparten el lienzo; al terminar los
   lienzos se esconden; y con movimiento reducido la carta aparece sin vuelo.
   En escritorio y en móvil. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesInvocar,derivarInvocar} from './invocar-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'fx-invocar.js'),'utf8');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-invocar-'));
try{
  const destino=path.join(temporal,'invocar'),p=exportar(destino),{lista}=derivarInvocar();
  const esperados=['index.html','_headers','procedencia.json','invocar-mesa.js','invocar-mesa.css','generado/datos.js','art/logo.webp',...componentesInvocar.map(f=>'juego/'+f),...lista.map(c=>c.url)].sort();
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
const url='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/invocar.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [ancho,alto,movimiento]of [[1180,900,'no-preference'],[390,844,'no-preference'],[1180,900,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=ancho+'×'+alto+(movimiento==='reduce'?' · movimiento reducido':'');
    const anima=movimiento!=='reduce';
    try{
      await pagina.goto(url);
      await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('estado').textContent),null,{timeout:30000});
      const quieta=()=>pagina.waitForFunction(()=>window.CAOZ_INVOCAR_REVISION.enVuelo()===0,null,{timeout:15000});
      const ocupadas=campo=>pagina.evaluate(c=>[...document.getElementById(c).children].filter(h=>h.firstChild).map(h=>({id:h.dataset.id,visible:getComputedStyle(h).visibility==='visible'})),campo);
      // Una carta de la mano: vuela (su casilla oculta) y queda a la vista al caer.
      await pagina.click('#mano .invCarta:nth-child(1)');
      if(anima){await pagina.waitForFunction(()=>{const h=[...document.getElementById('campoPropio').children].find(h=>h.firstChild);return h&&getComputedStyle(h).visibility==='hidden'&&getComputedStyle(document.querySelector('canvas.fxInvocar3D')).visibility==='visible';},null,{timeout:5000});}
      await quieta();
      let e=await ocupadas('campoPropio');
      assert.deepEqual(e,[{id:'eric',visible:true}],caso+': la carta queda en su casilla, a la vista');
      assert.match(await pagina.textContent('#estado'),anima?/Eric está en la mesa\.$/:/sin animación/,caso+': '+(anima?'con vuelo 3D':'sin vuelo'));
      // La legendaria y otra a la vez: dos vuelos en el mismo lienzo.
      await pagina.click('#mano .invCarta:nth-child(3)');await pagina.click('#mano .invCarta:nth-child(2)');
      if(anima)await pagina.waitForFunction(()=>[...document.getElementById('campoPropio').children].filter(h=>h.firstChild&&getComputedStyle(h).visibility==='hidden').length===2,null,{timeout:5000});
      await quieta();e=await ocupadas('campoPropio');
      assert.ok(e.length===3&&e.every(c=>c.visible)&&e.some(c=>c.id==='rey'),caso+': la legendaria y otra a la vez caen las dos');
      // El rival (desde arriba) y una ficha (del aire).
      await pagina.click('#rival');await quieta();await pagina.click('#ficha');await quieta();
      e=await ocupadas('campoRival');assert.ok(e.length===1&&e[0].visible,caso+': el rival invoca desde arriba');
      e=await ocupadas('campoPropio');assert.ok(e.length===4&&e.some(c=>c.id==='tok_petunia'&&c.visible),caso+': la ficha aparece del aire');
      await pagina.waitForTimeout(1500);
      if(anima)assert.equal(await pagina.evaluate(()=>[...document.querySelectorAll('canvas.fxInvocar3D,canvas.fxInvocarLuz')].map(c=>c.style.visibility).join()),'hidden,hidden',caso+': al terminar los lienzos se esconden');
      else assert.equal(await pagina.evaluate(()=>document.querySelectorAll('canvas.fxInvocar3D').length),0,caso+': sin movimiento no se crea el lienzo 3D');
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': '+(anima?'vuelo 3D y golpe':'sin vuelo')+'; legendaria y otra a la vez, rival y ficha');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

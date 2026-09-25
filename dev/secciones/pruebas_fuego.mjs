/* Pruebas de animación de Thal, en la sección aislada: el paquete sólo lleva
   sus dependencias. La entrada hace brillar a Thal, sin fuego, y marca el daño
   en las tres afectadas sin quemar a nadie; el ataque que no mata deja al
   objetivo en pie; el letal lo deja hecho ceniza. Petunia asciende: al
   acabar es Petunia Sagrada y sigue en la mesa. Cada efecto libera sus
   lienzos y estilos. También con movimiento reducido. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesFuego,cartasFuego} from './fuego-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

for(const f of ['fx-aliento.js','fx-ascension.js']){const js=fs.readFileSync(path.join(juego,f),'utf8');
  assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),f+': sin Animation.finished ni preserve-3d');}
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
      const cartas=await pagina.evaluate(()=>['atacante','aliado-machete','aliado-petunia','rival-rey','rival-bartolomeo','rival-eric'].map(id=>document.querySelector('#'+id+' canvas')?.width||0));
      assert.ok(cartas.every(w=>w>300),caso+': las seis cartas están pintadas');
      const listo=()=>pagina.waitForFunction(()=>!document.getElementById('entrar').disabled&&!/…/.test(document.getElementById('fuegoEstado').textContent),null,{timeout:30000});
      const estado=()=>pagina.evaluate(()=>({capas:document.querySelectorAll('canvas.fxAlientoCapa').length,cifras:document.querySelectorAll('.fxAlientoDano').length,
        visibles:['rival-rey','rival-bartolomeo','rival-eric'].filter(id=>{const n=document.getElementById(id);return n.style.visibility!=='hidden'&&n.dataset.fxCeniza===undefined;}),
        estilos:['atacante','aliado-machete','rival-rey','rival-bartolomeo','rival-eric'].map(id=>document.getElementById(id).style.transform+document.getElementById(id).style.filter).join('')}));
      // Entrada: sin fuego; las tres afectadas reciben su cifra y siguen en la mesa.
      let cifras=0;await pagina.exposeFunction('contarCifra',()=>{cifras++;});
      await pagina.evaluate(()=>new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.classList?.contains('fxAlientoDano'))window.contarCifra();}).observe(document.getElementById('mesaFuego'),{childList:true}));
      await pagina.click('#entrar');
      if(movimiento!=='reduce'){await pagina.waitForFunction(()=>document.querySelectorAll('canvas.fxAlientoCapa').length===1,null,{timeout:5000});
        await pagina.waitForFunction(()=>/drop-shadow/.test(document.getElementById('atacante').style.filter),null,{timeout:5000}).catch(()=>{});
        assert.match(await pagina.evaluate(()=>document.getElementById('atacante').style.filter),/drop-shadow/,caso+': Thal brilla al entrar');
        assert.equal(await pagina.evaluate(()=>document.querySelectorAll('canvas.fxAlientoCapa').length),1,caso+': la entrada no usa el fuego (WebGL)');}
      await listo();let e=await estado();
      assert.equal(cifras,3,caso+': la entrada marca el daño en las tres afectadas');
      assert.deepEqual(e.visibles,['rival-rey','rival-bartolomeo','rival-eric'],caso+': la entrada no quema a nadie');
      assert.ok(e.capas===0&&e.estilos==='',caso+': la entrada deja la mesa como estaba');
      // Ataque que no mata: El Rey encaja el golpe y sigue en pie.
      cifras=0;await pagina.click('#golpear');
      if(movimiento!=='reduce'){await pagina.waitForFunction(()=>document.querySelectorAll('canvas.fxAlientoCapa').length===2,null,{timeout:5000});
        await pagina.waitForFunction(()=>/drop-shadow/.test(document.getElementById('rival-rey').style.filter),null,{timeout:15000});}
      await listo();e=await estado();
      assert.equal(cifras,1,caso+': el golpe marca su daño');
      assert.ok(e.visibles.includes('rival-rey'),caso+': el golpe que no mata no quema al objetivo');
      assert.ok(e.capas===0&&e.estilos==='',caso+': el golpe deja la mesa como estaba');
      // Ataque letal: Bartolomeo arde hasta la ceniza.
      await pagina.click('#matar');
      if(movimiento!=='reduce')await pagina.waitForFunction(()=>document.getElementById('rival-bartolomeo').style.visibility==='hidden',null,{timeout:15000});
      await pagina.waitForFunction(()=>/ceniza/.test(document.getElementById('fuegoEstado').textContent),null,{timeout:30000});
      e=await pagina.evaluate(()=>{const o=document.getElementById('rival-bartolomeo');return {oculto:o.style.visibility==='hidden'||getComputedStyle(o).opacity==='0',ceniza:o.dataset.fxCeniza!==undefined,capas:document.querySelectorAll('canvas.fxAlientoCapa').length,atacante:document.getElementById('atacante').style.transform};});
      assert.ok(e.oculto&&e.ceniza,caso+': el ataque letal deja al objetivo hecho ceniza');
      assert.ok(e.capas===0&&e.atacante==='',caso+': los lienzos se liberan y Thal vuelve a su sitio');
      // Muerte de Machete: la misma llamada que hace la partida.
      await pagina.click('#reiniciar');await listo();
      await pagina.click('#morirMachete');
      if(movimiento!=='reduce')await pagina.waitForFunction(()=>document.querySelectorAll('canvas.fxAlientoCapa').length===2,null,{timeout:5000});
      await pagina.waitForFunction(()=>/Machete ardió/.test(document.getElementById('fuegoEstado').textContent),null,{timeout:30000});
      assert.equal(await pagina.evaluate(()=>document.getElementById('aliado-machete').style.visibility),'hidden',caso+': Machete queda hecho ceniza');
      await pagina.waitForFunction(()=>!document.querySelector('canvas.fxAlientoCapa'),null,{timeout:10000});
      // Ascensión de Petunia: renace como Petunia Sagrada y sigue en la mesa.
      await pagina.click('#reiniciar');await listo();
      const firma=()=>pagina.evaluate(()=>{const c=document.querySelector('#aliado-petunia canvas'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=4099)s=(s*31+d[i])%1000003;return s;});
      const antes=await firma();
      await pagina.click('#ascenderPetunia');
      if(movimiento!=='reduce'){await pagina.waitForFunction(()=>document.querySelectorAll('canvas.fxAscensionCapa').length===3,null,{timeout:5000});
        assert.equal(await pagina.evaluate(()=>document.getElementById('aliado-petunia').style.visibility),'hidden',caso+': el efecto dibuja a Petunia mientras asciende');}
      await pagina.waitForFunction(()=>/Petunia Sagrada/.test(document.getElementById('fuegoEstado').textContent),null,{timeout:30000});
      e=await pagina.evaluate(()=>{const o=document.getElementById('aliado-petunia');return {visible:o.style.visibility!=='hidden',nombre:o.getAttribute('aria-label'),capas:document.querySelectorAll('canvas.fxAscensionCapa').length};});
      assert.ok(e.visible&&e.nombre==='Petunia Sagrada',caso+': Petunia renace como Petunia Sagrada y queda en la mesa');
      assert.notEqual(await firma(),antes,caso+': la carta muestra la cara nueva');
      assert.equal(e.capas,0,caso+': la ascensión libera sus lienzos');
      await pagina.click('#reiniciar');
      await pagina.waitForFunction(()=>document.getElementById('aliado-petunia').getAttribute('aria-label')==='Petunia',null,{timeout:10000});
      await pagina.waitForFunction(()=>{const o=document.getElementById('rival-bartolomeo');return o.style.visibility!=='hidden'&&o.dataset.fxCeniza===undefined;},null,{timeout:10000});
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': entrada, golpe que no mata, ataque letal, muerte de Machete hasta la ceniza, Ascensión de Petunia, y se reinicia');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

/* Pruebas de las animaciones de poderes (fx-poderes.js) en su sección aislada:
   el paquete sólo lleva sus dependencias; cada botón deja el estado que toca
   (Infectado, Dragón, congelado, Poseído, Aturdido, Llave, Gracia, Pergamino),
   los efectos liberan sus capas y «Reiniciar» deja la mesa limpia. En
   escritorio, en móvil y con movimiento reducido. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesPoderes,cartasPoderes} from './poderes-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'fx-poderes.js'),'utf8');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-poderes-'));
try{
  const destino=path.join(temporal,'poderes'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','poderes.js','poderes.css','generado/datos.js',...componentesPoderes.map(f=>'juego/'+f),...cartasPoderes.map(id=>'art/'+id+'.webp')].sort();
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
const url='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/poderes.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [ancho,alto,movimiento]of [[1180,980,'no-preference'],[390,844,'no-preference'],[1180,980,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=ancho+'×'+alto+(movimiento==='reduce'?' · movimiento reducido':'');
    try{
      await pagina.goto(url);
      await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('poderesEstado').textContent),null,{timeout:30000});
      assert.ok((await pagina.evaluate(()=>[...document.querySelectorAll('.cartaPoder:not(.hueco) > canvas')].map(c=>c.width))).every(w=>w>300),caso+': cartas pintadas');
      // Lanza una acción con su botón y espera a que acabe; comprueba que no quedan capas.
      const hacer=async(accion,capas=true)=>{
        await pagina.click('[data-accion="'+accion+'"]');
        if(capas&&movimiento!=='reduce')await pagina.waitForFunction(()=>document.querySelector('.fxPoderesCapa'),null,{timeout:5000});
        await pagina.waitForFunction(()=>!document.querySelector('#controles button').disabled,null,{timeout:30000});
        assert.equal(await pagina.evaluate(()=>document.querySelectorAll('.fxPoderesCapa').length),0,caso+': '+accion+' libera su capa');
        return pagina.evaluate(()=>document.getElementById('poderesEstado').textContent);
      };
      const ev=f=>pagina.evaluate(f);
      await hacer('esporas');
      assert.deepEqual(await ev(()=>['rey','bartolomeo','eric'].map(id=>document.getElementById('c-'+id).dataset.fxInfectada!==undefined)),[true,true,true],caso+': las Esporas infectan al campo rival');
      await hacer('polimorfia');
      assert.equal(await ev(()=>document.getElementById('c-discipulo').getAttribute('aria-label')),'Dragón Celestial Morado',caso+': Rulchete lo vuelve Dragón');
      assert.equal(await ev(()=>document.getElementById('c-discipulo').style.visibility),'',caso+': la carta vuelve a verse');
      await hacer('polimorfia');
      assert.equal(await ev(()=>document.getElementById('c-discipulo').getAttribute('aria-label')),'Discípulo de Rul',caso+': la Polimorfia termina');
      await hacer('escarcha');
      assert.ok(await ev(()=>document.getElementById('c-eric').dataset.fxCongelada!==undefined),caso+': Eric queda congelado');
      await hacer('escarcha',false);
      assert.ok(await ev(()=>document.getElementById('c-eric').dataset.fxCongelada===undefined&&!document.querySelector('#c-eric [data-fx-estado="congelada"]')),caso+': Eric se descongela');
      assert.match(await hacer('collar',movimiento!=='reduce'),/Collar de Agua/,caso+': el Collar apaga el fuego');
      await hacer('gema',false);
      assert.ok(await ev(()=>{const n=document.getElementById('c-rey');return n.dataset.fxPoseida!==undefined&&/grayscale/.test(n.style.filter);}),caso+': El Rey queda Poseído');
      await hacer('poseer',false);
      {const r=await ev(()=>{const n=document.getElementById('c-bartolomeo').getBoundingClientRect(),h=document.getElementById('hueco').getBoundingClientRect();return {dx:Math.abs(n.left-h.left),dy:Math.abs(n.top-h.top),pos:document.getElementById('c-bartolomeo').dataset.fxPoseida!==undefined};});
        assert.ok(r.pos&&r.dx<2&&r.dy<2,caso+': Poseer de Thal lleva a Bartolomeo al hueco ('+JSON.stringify(r)+')');}
      await hacer('talesyn');
      assert.equal(await ev(()=>document.querySelectorAll('#gracia .pip[data-llena]').length),5,caso+': Talesyn llena su quinta Gracia');
      assert.equal(await ev(()=>document.querySelectorAll('.fxGraciaOro').length),0,caso+': el oro de las Celestiales se retira');
      await hacer('aturdir');
      assert.ok(await ev(()=>{const n=document.getElementById('c-eric');return n.dataset.fxAturdida!==undefined&&n.style.rotate==='-3deg';}),caso+': Eric queda Aturdido');
      await hacer('tasha');
      assert.ok(await ev(()=>{const n=document.getElementById('c-rey');return n.dataset.fxAturdida!==undefined&&n.style.translate==='';}),caso+': la Risa de Tasha aturde a El Rey');
      await hacer('llave');
      assert.equal(await ev(()=>document.getElementById('llavesCuenta').textContent),'2',caso+': la Llave llega al contador');
      assert.match(await hacer('pergamino'),/primer turno/,caso+': el Pergamino cuenta su turno');
      assert.match(await hacer('pergamino'),/Deseo concedido/,caso+': y en el segundo, la victoria');
      await pagina.click('[data-accion="reiniciar"]');
      await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('poderesEstado').textContent),null,{timeout:10000});
      const limpio=await ev(()=>({estados:document.querySelectorAll('canvas.fxEstado').length,estilos:[...document.querySelectorAll('.cartaPoder')].map(n=>n.getAttribute('style')||'').join(''),llaves:document.getElementById('llavesCuenta').textContent,gracia:document.querySelectorAll('#gracia .pip[data-llena]').length}));
      assert.deepEqual(limpio,{estados:0,estilos:'',llaves:'1',gracia:4},caso+': «Reiniciar» deja la mesa limpia');
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': esporas, polimorfia ida y vuelta, escarcha y deshielo, collar, poseído, poseer de Thal, Talesyn, aturdido, Tasha, llave, pergamino y reinicio');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

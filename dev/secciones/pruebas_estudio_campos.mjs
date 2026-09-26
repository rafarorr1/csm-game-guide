/* Pruebas del laboratorio «Campos de batalla» del Estudio: el paquete sólo lleva
   sus dependencias; subir una imagen la prepara como WebP y la muestra de fondo
   en la mesa (sin suelo pintado), el encuadre y el zoom la mueven, cada mapa
   elige sus propios efectos e intensidad, «Guardar» lo conserva al cambiar de
   Lugar y «Restaurar original» vuelve a la ilustración y a los efectos de serie. También la vista móvil y el
   movimiento reducido. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesCampos,cartasCampos} from './estudio-campos-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {hash} from './fuentes.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-estudio-campos-'));
try{
  const destino=path.join(temporal,'estudio-campos'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','estudio-campos.js','estudio-campos.css','generado/datos.js',...componentesCampos.map(f=>'juego/'+f),...cartasCampos.map(id=>'art/'+id+'.webp')].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La prueba sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__[A-Z]+__/.test(html)&&!/(?:src|href)=["'](?:https?:)?\/\//i.test(html)&&!/fetch\(/.test(fs.readFileSync(path.join(destino,'estudio-campos.js'),'utf8')),'Sin recursos remotos ni peticiones');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const url='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/estudio-campos.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [ancho,alto,movimiento]of [[1280,1000,'no-preference'],[390,844,'no-preference'],[1280,1000,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    pagina.on('dialog',d=>d.accept());
    const caso=ancho+'×'+alto+(movimiento==='reduce'?' · movimiento reducido':'');
    try{
      await pagina.goto(url);
      await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('ecEstado').textContent),null,{timeout:30000});
      const escena=()=>pagina.evaluate(()=>{const e=document.querySelector('#ecMesa > .clEscena'),i=e?.querySelector('.clFondoImg');
        return {id:e?.dataset.escena,propio:e?.dataset.propio!==undefined,url:i?.style.backgroundImage||'',pos:i?.style.backgroundPosition||'',zoom:i?.style.transform||'',suelo:e?getComputedStyle(e.querySelector('.clSuelo')).display:'',amb:e?getComputedStyle(e.querySelector('.clAmbiente')).display:'',efectos:e?.dataset.efectos};});
      let e=await escena();
      assert.ok(e.id==='domo'&&!e.propio&&/art\/domo\.webp/.test(e.url)&&e.suelo!=='none',caso+': empieza con la ilustración del Domo y su suelo');
      assert.equal(e.efectos,'cupula ascuas',caso+': el Domo empieza con sus efectos de serie');
      // Efectos propios sin cambiar la imagen: el Antro con lluvia y relámpagos.
      await pagina.click('[data-lugar="antro"]');await pagina.waitForFunction(()=>!document.getElementById('ecArchivo').disabled&&document.querySelectorAll('#ecMesa > .clEscena').length===1&&document.querySelector('#ecMesa > .clEscena').dataset.escena==='antro',null,{timeout:8000});
      await pagina.click('[data-efecto="polvo"]');await pagina.click('[data-efecto="lluvia"]');await pagina.click('[data-efecto="relampagos"]');
      e=await escena();assert.equal(e.efectos,'velas relampagos lluvia',caso+': el mapa elige sus efectos');
      await pagina.fill('#ecI','160');await pagina.dispatchEvent('#ecI','input');
      await pagina.click('#ecGuardar');assert.match(await pagina.textContent('[data-lugar="antro"] small'),/Ilustración del Lugar · 🕯️🌧️⚡/,caso+': la lista muestra los efectos guardados');
      await pagina.click('[data-lugar="domo"]');await pagina.waitForFunction(()=>!document.getElementById('ecArchivo').disabled&&document.querySelectorAll('#ecMesa > .clEscena').length===1&&document.querySelector('#ecMesa > .clEscena').dataset.escena==='domo',null,{timeout:8000});
      // Una imagen horizontal de prueba, hecha en el navegador.
      const png=Buffer.from(await pagina.evaluate(()=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,1080);gr.addColorStop(0,'#3a2a7a');gr.addColorStop(1,'#d08a40');g.fillStyle=gr;g.fillRect(0,0,1920,1080);g.fillStyle='#fff';g.fillRect(900,400,120,120);return c.toDataURL('image/png').split(',')[1];}),'base64');
      await pagina.setInputFiles('#ecArchivo',{name:'mi-domo.png',mimeType:'image/png',buffer:png});
      await pagina.waitForFunction(()=>/Vista previa lista/.test(document.getElementById('ecEstado').textContent),null,{timeout:15000});
      e=await escena();
      assert.ok(e.propio&&/^url\("blob:/.test(e.url)&&e.suelo==='none'&&e.amb!=='none',caso+': el diseño propio es el fondo, sin suelo pintado y con efectos');
      assert.match(await pagina.textContent('#ecOrigen'),/1600×900 · \d+ KB WebP/,caso+': se prepara como WebP de 1600 px');
      await pagina.fill('#ecX','20');await pagina.dispatchEvent('#ecX','input');await pagina.fill('#ecZ','180');await pagina.dispatchEvent('#ecZ','input');
      e=await escena();assert.ok(e.pos==='20% 50%'&&e.zoom==='scale(1.8)',caso+': el encuadre y el zoom mueven el fondo ('+e.pos+', '+e.zoom+')');
      await pagina.click('#ecNinguno');e=await escena();assert.ok(e.amb==='none'&&e.efectos==='',caso+': un mapa puede ir sin efectos');
      await pagina.click('#ecSerie');await pagina.click('[data-efecto="nieve"]');e=await escena();assert.equal(e.efectos,'cupula nieve ascuas',caso+': y combinar los de serie con otros');
      await pagina.click('#ecGuardar');
      assert.match(await pagina.textContent('[data-lugar="domo"] small'),/^Fondo propio · ❄️🔴🩸$/,caso+': guardado en la lista');
      await pagina.click('[data-lugar="antro"]');await pagina.waitForFunction(()=>!document.getElementById('ecArchivo').disabled&&document.querySelector('#ecMesa > .clEscena')?.dataset.escena==='antro'&&document.querySelectorAll('#ecMesa > .clEscena').length===1,null,{timeout:8000});
      e=await escena();assert.ok(!e.propio&&/art\/antro\.webp/.test(e.url)&&e.efectos==='velas relampagos lluvia',caso+': el Antro conserva su ilustración y sus efectos guardados');
      await pagina.click('[data-lugar="domo"]');await pagina.waitForFunction(()=>!document.getElementById('ecArchivo').disabled&&document.querySelector('#ecMesa > .clEscena')?.dataset.escena==='domo'&&document.querySelectorAll('#ecMesa > .clEscena').length===1,null,{timeout:8000});
      e=await escena();assert.ok(e.propio&&e.pos==='20% 50%'&&e.zoom==='scale(1.8)'&&e.efectos==='cupula nieve ascuas',caso+': al volver, el Domo conserva su fondo y sus efectos');
      await pagina.click('#ecMovil');await pagina.waitForTimeout(150);
      assert.ok(await pagina.evaluate(()=>{const r=document.getElementById('ecMesa').getBoundingClientRect();return r.height>r.width;}),caso+': la vista móvil es vertical');
      await pagina.click('#ecRestaurar');e=await escena();
      assert.ok(!e.propio&&/art\/domo\.webp/.test(e.url)&&e.suelo!=='none'&&e.efectos==='cupula ascuas',caso+': «Restaurar original» vuelve a la ilustración y a los efectos de serie');
      assert.equal(await pagina.textContent('[data-lugar="domo"] small'),'Ilustración del Lugar · 🔴🩸',caso+': la lista lo refleja');
      await pagina.setInputFiles('#ecArchivo',{name:'no.txt',mimeType:'text/plain',buffer:Buffer.from('hola')});
      await pagina.waitForFunction(()=>document.getElementById('ecEstado').classList.contains('error'),null,{timeout:5000});
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': efectos propios por mapa, subir, encuadrar, guardar, cambiar de Lugar, vista móvil, restaurar y rechazar un archivo no válido');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

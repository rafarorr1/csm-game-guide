/* Pruebas de la prueba del visor en three.js (visor-three.html). La exportación
   sólo publica sus dependencias y respeta la CSP (three.js viene empaquetado y
   sin eval). En el navegador: WebGL 2 con posproceso HDR y MSAA 4×, el
   material de cada edición (iridiscencia y laca), la carta entera en pantalla,
   que se ve (no un lienzo negro), que el dorso aparece al darle la vuelta, que
   la linterna sigue al puntero, que «Invocar» enciende el estallido, que cada
   efecto se apaga de verdad y que con movimiento reducido no gira sola. Usa
   Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportar,componentesVisorThree,cartasVisorThree,csp} from './visor-three-exportar.mjs';
import {crearServidor} from './servidor.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
const vendor=fs.readFileSync(path.join(aqui,'visor-three-vendor.js'),'utf8');
assert.ok(/three\.js 0\.186\.1/.test(vendor.slice(0,200))&&/MIT License/.test(vendor.slice(0,600)),'El paquete de three.js declara su versión y su licencia');
assert.ok(!/\beval\(|new Function\(/.test(vendor),'El paquete no usa eval ni new Function (la CSP no los permite)');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-visor-three-'));
try{
  const destino=path.join(temporal,'visor-three'),p=exportar(destino);
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  const esperados=['index.html','_headers','procedencia.json','generado/datos.js','visor-three-mesa.js','visor-three-mesa.css','visor-three-vendor.js',...componentesVisorThree.map(f=>'juego/'+f),'art/logo.webp'];
  for(const f of esperados)assert.ok(archivos.includes(f),'Se publica '+f);
  assert.ok(archivos.every(f=>esperados.includes(f)||/^art\/magodomo[^/]*\.webp$/.test(f)),'La prueba sólo publica sus dependencias: '+archivos.filter(f=>!esperados.includes(f)).join(', '));
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.ok(html.includes(csp)&&!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'La página lleva la CSP y ningún script en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.equal(p.partida,false);assert.equal(p.three,'0.186.1');assert.equal(p.cartas.length,cartasVisorThree.length);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con three.js empaquetado, sin CDN ni scripts en línea');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/visor-three.html';
// Brillo medio y color medio de una zona del lienzo (fracciones del ancho y el alto).
const zona=(pagina,[x0,y0,x1,y1])=>pagina.evaluate(([x0,y0,x1,y1])=>{const c=document.getElementById('lienzo'),g=document.createElement('canvas');g.width=64;g.height=64;const x=g.getContext('2d');
  x.drawImage(c,x0*c.width,y0*c.height,(x1-x0)*c.width,(y1-y0)*c.height,0,0,64,64);const d=x.getImageData(0,0,64,64).data;let r=0,gg=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];b+=d[i+2];}const n=d.length/4;return {r:r/n,g:gg/n,b:b/n,luz:(r+gg+b)/n/3};},[x0,y0,x1,y1]);
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  for(const [ancho,alto]of [[1280,800],[390,700]]){
    const pagina=await navegador.newPage({viewport:{width:ancho,height:alto}}),errores=[],caso=ancho+'×'+alto;
    pagina.on('pageerror',e=>errores.push(e.message));// Los avisos del controlador gráfico (el WebGL por software de Chrome sin pantalla) no son de la página.
    pagina.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
    await pagina.goto(base+'?captura=1');await pagina.waitForFunction(()=>window.CAOZ_VISOR_THREE_REVISION,null,{timeout:120000});
    const R='CAOZ_VISOR_THREE_REVISION';
    const e=await pagina.evaluate(R=>window[R].estado(),R);
    assert.ok(e.webgl2&&e.version==='186'&&e.muestras===4&&e.tipo==='half',caso+': WebGL 2, three r186, posproceso HDR (media precisión) con MSAA 4×');
    assert.deepEqual(e.pases,['render','enfoque','resplandor','salida'],caso+': render, profundidad de campo, resplandor y salida AgX');
    for(const [ed,irid,laca] of [['normal',.18,.55],['foil',1,.7],['dorado',.85,.75]]){await pagina.evaluate(([R,ed])=>window[R].cargar(ed),[R,ed]);const s=await pagina.evaluate(R=>window[R].estado(),R);
      assert.ok(Math.abs(s.iridiscencia-irid)<1e-6&&Math.abs(s.laca-laca)<1e-6,caso+': '+ed+' con su iridiscencia ('+s.iridiscencia+') y su laca ('+s.laca+')');}
    // La carta entera en pantalla y bien iluminada; el fondo, oscuro.
    await pagina.evaluate(R=>window[R].dibujar(3,{}),R);
    const c=await pagina.evaluate(R=>window[R].carta(),R);
    assert.ok(c.arriba>c.alto*.01&&c.abajo<c.alto*.92,caso+': la carta entera en pantalla ('+(c.arriba/c.alto*100).toFixed(0)+'%–'+(c.abajo/c.alto*100).toFixed(0)+'%)');
    const cara=await zona(pagina,[.46,.3,.54,.45]),fondo=await zona(pagina,[0,.35,.08,.5]);
    assert.ok(cara.luz>40&&cara.luz>fondo.luz*2,caso+': la carta se ve sobre un estudio oscuro (carta '+cara.luz.toFixed(0)+', fondo '+fondo.luz.toFixed(0)+')');
    // El dorso: al darle la vuelta aparece el morado del dorso.
    const bajo=[.44,.62,.56,.7],delante=await zona(pagina,bajo);
    await pagina.evaluate(R=>window[R].dibujar(3,{vuelta:Math.PI}),R);const dorso=await zona(pagina,bajo);
    assert.ok(delante.b<delante.g&&dorso.b>dorso.g*1.05,caso+': al darle la vuelta se ve el morado del dorso ('+[dorso.r,dorso.g,dorso.b].map(v=>v.toFixed(0)).join(',')+' frente a '+[delante.r,delante.g,delante.b].map(v=>v.toFixed(0)).join(',')+')');
    // La linterna: el puntero sobre la carta la enciende; fuera, se apaga.
    await pagina.evaluate(R=>window[R].dibujar(3,{puntero:[0,.1]}),R);const dentro=(await pagina.evaluate(R=>window[R].estado(),R)).linterna;
    await pagina.evaluate(R=>window[R].dibujar(3,{puntero:[.95,-.95]}),R);const fuera=(await pagina.evaluate(R=>window[R].estado(),R)).linterna;
    assert.ok(dentro>1.5&&fuera<dentro*.3,caso+': la linterna sigue al puntero sobre la carta ('+dentro.toFixed(2)+' / '+fuera.toFixed(2)+')');
    // Invocar: el estallido de oro enciende la escena alrededor de la carta.
    await pagina.evaluate(R=>window[R].dibujar(3,{}),R);const quieto=await zona(pagina,[.1,.05,.9,.4]);
    await pagina.evaluate(R=>window[R].dibujar(3,{invocada:1.6}),R);const estallido=await zona(pagina,[.1,.05,.9,.4]);
    assert.ok(estallido.luz>quieto.luz*1.25,caso+': «Invocar» lanza el estallido ('+quieto.luz.toFixed(0)+' → '+estallido.luz.toFixed(0)+')');
    // Cada efecto se apaga de verdad.
    for(const k of ['resplandor','enfoque'])await pagina.evaluate(([R,k])=>window[R].efecto(k,false),[R,k]);
    for(const k of ['iridiscencia','laca'])await pagina.evaluate(([R,k])=>window[R].efecto(k,false),[R,k]);
    const sin=await pagina.evaluate(R=>window[R].estado(),R);
    assert.ok(sin.pases.join()==='render,salida'&&sin.iridiscencia===0&&sin.laca===0,caso+': los efectos se apagan (pases '+sin.pases.join(', ')+')');
    const info=await pagina.evaluate(R=>window[R].dibujar(3,{}),R);assert.ok(info.llamadas>5&&info.triangulos>1000,caso+': la escena se dibuja ('+info.llamadas+' llamadas, '+info.triangulos+' triángulos)');
    assert.deepEqual(errores,[],caso+': sin errores ni avisos de página');
    console.log('✓ '+caso+': material físico por edición, carta y dorso, linterna, invocar y efectos');
    await pagina.close();
  }
  // Uso real: arranca, cuenta fotogramas y, con movimiento reducido, no gira sola ni invoca al entrar.
  for(const reducido of [false,true]){
    const contexto=await navegador.newContext({viewport:{width:1280,height:800},reducedMotion:reducido?'reduce':'no-preference'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.goto(base);await pagina.waitForFunction(()=>window.CAOZ_VISOR_THREE_REVISION,null,{timeout:120000});
    await pagina.waitForFunction(()=>/fps/.test(document.getElementById('info').textContent),null,{timeout:60000});
    const r=await pagina.evaluate(()=>({girar:document.getElementById('girar').checked,info:document.getElementById('info').textContent,estado:document.getElementById('estado').textContent}));
    assert.equal(r.girar,!reducido,reducido?'Con movimiento reducido la carta no gira sola':'La carta gira sola');
    assert.ok(/llamadas de dibujo/.test(r.info)&&/three 186/.test(r.info)&&/MSAA \d×/.test(r.info)&&!/sin posproceso/.test(r.info),'El marcador muestra fps, llamadas, formato, tarjeta y versión ('+r.info+')');
    assert.deepEqual(errores,[],'Sin errores al usarla');await contexto.close();
  }
  console.log('✓ Uso real: marcador de rendimiento y respeto al movimiento reducido');
  // Sin WebGL 2 (three.js lo necesita): la página lo dice en lugar de quedarse en negro.
  {const pagina=await navegador.newPage({viewport:{width:1280,height:800}}),errores=[];pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:g.call(this,t,...a);};});
    await pagina.goto(base);await pagina.waitForFunction(()=>/WebGL 2/.test(document.getElementById('estado').textContent),null,{timeout:30000});
    assert.deepEqual(errores,[],'Sin WebGL 2 no hay errores sueltos: sólo el aviso');await pagina.close();
    console.log('✓ Sin WebGL 2, la página avisa en vez de quedarse en negro');}
}finally{await navegador?.close();servidor.close();}

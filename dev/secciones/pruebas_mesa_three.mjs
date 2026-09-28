/* Pruebas de la mesa de juego en three.js (mesa-three.html). La exportación
   sólo publica sus dependencias y respeta la CSP. En el navegador: WebGL 2 con
   posproceso HDR (oclusión ambiental, profundidad de campo, resplandor), la
   partida montada (campos, manos, pilas, Alma y PD), la mesa y la mano en
   pantalla (en escritorio, la mesa entera), y la maqueta de reglas: jugar una
   carta la lleva a su hueco y gasta PD, sin PD no se juega, atacar hace daño y
   la que muere arde y va al cementerio, y el rival juega su turno. Que cada
   efecto se apaga, sin WebGL 2 avisa y con uso real cuenta fotogramas. Usa
   Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesMesaThree,cartasMesaThree,csp} from './mesa-three-exportar.mjs';
import {crearServidor} from './servidor.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-mesa-three-'));
try{
  const destino=path.join(temporal,'mesa-three'),p=exportar(destino);
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  const esperados=['index.html','_headers','procedencia.json','generado/datos.js','mesa-three-mesa.js','mesa-three-mesa.css','visor-three-vendor.js','three-carta.js',...componentesMesaThree.map(f=>'juego/'+f),'art/logo.webp'];
  for(const f of esperados)assert.ok(archivos.includes(f),'Se publica '+f);
  const ids=new Set(cartasMesaThree.map(([id])=>id));
  assert.ok(archivos.every(f=>esperados.includes(f)||(/^art\/[^/]+\.webp$/.test(f)&&[...ids].some(id=>f.startsWith('art/'+id)))),'La mesa sólo publica sus dependencias: '+archivos.filter(f=>!esperados.includes(f)&&!/^art\//.test(f)).join(', '));
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.ok(html.includes(csp)&&!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'La página lleva la CSP y ningún script en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  const datos=fs.readFileSync(path.join(destino,'generado/datos.js'),'utf8');
  assert.ok(/const LEADERS=/.test(datos)&&/window\.MESA_THREE_ARTE=/.test(datos),'Los datos traen protagonistas y el arte de cada carta y edición');
  assert.equal(p.partida,false);assert.equal(p.three,'0.186.1');assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con three.js empaquetado, la carta compartida y el arte de la partida');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/mesa-three.html';
const zona=(pagina,[x0,y0,x1,y1])=>pagina.evaluate(([x0,y0,x1,y1])=>{const c=document.getElementById('lienzo'),g=document.createElement('canvas');g.width=64;g.height=64;const x=g.getContext('2d');
  x.drawImage(c,x0*c.width,y0*c.height,(x1-x0)*c.width,(y1-y0)*c.height,0,0,64,64);const d=x.getImageData(0,0,64,64).data;let s=0;for(let i=0;i<d.length;i+=4)s+=(d[i]+d[i+1]+d[i+2])/3;return s/(d.length/4);},[x0,y0,x1,y1]);
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  for(const [ancho,alto]of [[1280,800],[390,700]]){
    const pagina=await navegador.newPage({viewport:{width:ancho,height:alto}}),errores=[],caso=ancho+'×'+alto;
    pagina.on('pageerror',e=>errores.push(e.message));
    pagina.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
    await pagina.goto(base+'?captura=1');await pagina.waitForFunction(()=>window.CAOZ_MESA_THREE_REVISION?.listo(),null,{timeout:240000});
    const R='CAOZ_MESA_THREE_REVISION',av=s=>pagina.evaluate(([R,s])=>window[R].avanzar(s),[R,s]);
    let e=await av(.5);
    assert.ok(e.webgl2&&e.hdr&&e.muestras===4,caso+': WebGL 2, HDR y MSAA 4×');
    assert.deepEqual(e.pases,['render','oclusion','enfoque','resplandor','salida'],caso+': oclusión ambiental, profundidad de campo, resplandor y salida AgX');
    assert.deepEqual([e.mano.length,e.campo.length,e.rival.length,e.almaYo,e.almaRival,e.pd,e.manoRival],[5,3,3,17,12,6,5],caso+': la partida está montada (manos, campos, Alma y PD)');
    // Encuadre: los dos campos siempre; en escritorio, también protagonistas, mazos y cementerios; la mano abajo.
    const P=await pagina.evaluate(R=>window[R].posiciones(),R),vis=async([x,y,z])=>{const q=await pagina.evaluate(([R,x,y,z])=>window[R].pantalla(x,y,z),[R,x,y,z]);return q.x>q.ancho*.01&&q.x<q.ancho*.99&&q.y>q.alto*.01&&q.y<q.alto*.99?q:null;};
    for(const p of [...P.campo,...P.rival])assert.ok(await vis(p),caso+': la carta del campo en '+p.map(v=>v.toFixed(1))+' se ve');
    if(ancho>alto)for(const p of [P.liderYo,P.liderRival,P.mazo])assert.ok(await vis(p),caso+': en escritorio se ve toda la mesa ('+p.map(v=>v.toFixed(1))+')');
    // La mano asoma desde abajo (su centro puede quedar justo en el borde, como en las cartas digitales).
    for(const p of P.mano){const q=await pagina.evaluate(([R,x,y,z])=>window[R].pantalla(x,y,z),[R,...p]);assert.ok(q.x>0&&q.x<q.ancho&&q.y>q.alto*.6&&q.y<q.alto*1.1,caso+': la mano, abajo en pantalla ('+(q.y/q.alto*100).toFixed(0)+'%)');}
    // La imagen: la mesa iluminada en el centro, no un lienzo negro.
    assert.ok(await zona(pagina,[.3,.3,.7,.6])>22,caso+': la mesa se ve');
    // Jugar: Aldrick (4 PD) va a su hueco y gasta PD; Lucius ya no cabe en los PD que quedan.
    await pagina.evaluate(R=>window[R].jugar(2),R);e=await av(1.5);
    assert.ok(e.campo.some(c=>c.startsWith('aldrick'))&&e.pd===2&&e.mano.length===4,caso+': jugar una carta la lleva al campo y gasta sus PD ('+e.pd+' PD)');
    await pagina.evaluate(R=>window[R].jugar(0),R);e=await av(1);
    assert.ok(e.mano.length===4&&e.pd===2,caso+': sin PD suficientes la carta no se juega');
    // Atacar: Thal (9) contra el Conserje (0/1): muere, arde y va al cementerio.
    await pagina.evaluate(R=>window[R].atacar('tal','conserje'),R);e=await av(2.4);
    assert.ok(!e.rival.some(c=>c.startsWith('conserje'))&&e.cementerioRival===3&&!e.ocupado,caso+': atacar hace daño y la carta muerta va al cementerio');
    // El turno del rival: roba y juega (o lanza) y ataca.
    const antes=e;await pagina.evaluate(R=>window[R].turnoRival(),R);e=await av(5);
    assert.ok(e.cementerioRival>antes.cementerioRival||e.rival.length>antes.rival.length,caso+': el rival roba y juega su carta');
    assert.ok(e.campo.length<antes.campo.length||e.almaYo<antes.almaYo||e.campo.join()!==antes.campo.join(),caso+': el rival ataca ('+e.campo.join(', ')+' · Alma '+e.almaYo+')');
    for(const k of ['oclusion','enfoque','resplandor'])await pagina.evaluate(([R,k])=>window[R].efecto(k,false),[R,k]);
    e=await av(.2);assert.deepEqual(e.pases,['render','salida'],caso+': los efectos se apagan');
    assert.deepEqual(errores,[],caso+': sin errores ni avisos de página');
    console.log('✓ '+caso+': la partida, el encuadre, jugar, atacar, el turno del rival y los efectos');
    await pagina.close();
  }
  // Uso real: arranca, cuenta fotogramas y enseña la tarjeta gráfica.
  {const pagina=await navegador.newPage({viewport:{width:1280,height:800}}),errores=[];pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.goto(base);await pagina.waitForFunction(()=>/fps/.test(document.getElementById('info').textContent),null,{timeout:240000});
    const info=await pagina.evaluate(()=>document.getElementById('info').textContent);
    assert.ok(/llamadas de dibujo/.test(info)&&/three 186/.test(info)&&/MSAA \d×/.test(info),'El marcador muestra fps, llamadas, formato, tarjeta y versión ('+info+')');
    assert.deepEqual(errores,[],'Sin errores al usarla');await pagina.close();}
  // Sin WebGL 2: la página lo dice en lugar de quedarse en negro.
  {const pagina=await navegador.newPage({viewport:{width:1280,height:800}}),errores=[];pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:g.call(this,t,...a);};});
    await pagina.goto(base);await pagina.waitForFunction(()=>/WebGL 2/.test(document.getElementById('estado').textContent),null,{timeout:30000});
    assert.deepEqual(errores,[],'Sin WebGL 2 sólo hay el aviso');await pagina.close();}
  console.log('✓ Uso real con marcador de rendimiento, y aviso sin WebGL 2');
}finally{await navegador?.close();servidor.close();}

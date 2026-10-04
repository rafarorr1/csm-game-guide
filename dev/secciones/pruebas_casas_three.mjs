/* Pruebas de la muestra de las casas de Tomsage (casas-three.html y el módulo
   casas-three.js). La exportación sólo publica sus dependencias y respeta la
   CSP. En el navegador: cada casa cuesta pocos triángulos y la calle entera,
   pocas llamadas de dibujo; las ventanas encendidas brillan cálidas sobre el
   yeso; su interior cambia con la perspectiva (hay una habitación detrás, no
   una pegatina); al apagar las luces de dentro se apagan; la hora cambia el
   cielo; la semilla de cada ventana no se interpola (sin moteado); uso real con
   movimiento reducido (no gira sola) y sin WebGL 2. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportar,entornoCasasThree,csp} from './casas-three-exportar.mjs';
import {crearServidor} from './servidor.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
const modulo=fs.readFileSync(path.join(aqui,'casas-three.js'),'utf8');
for(const m of modulo.matchAll(/smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g))assert.ok(+m[1]<+m[2],'smoothstep con los bordes al revés ('+m[0]+'): en Metal no está definido');
assert.equal((modulo.match(/flat varying float vS/g)||[]).length,4,'La semilla de cada ventana llega sin interpolar (flat) a sus shaders');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-casas-three-'));
try{
  const destino=path.join(temporal,'casas-three'),p=exportar(destino);
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,['_headers','index.html','procedencia.json',...entornoCasasThree].sort(),'Sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.ok(html.includes(csp)&&!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'La página lleva la CSP y ningún script en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.equal(p.three,'0.186.1');assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación: el módulo de casas y three.js empaquetado, sin CDN ni scripts en línea');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
// Las pruebas del interior mapping corresponden al generador clásico de respaldo.
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/casas-three.html?arquitectura=clasica';
const R='CAOZ_CASAS_THREE_REVISION';
// Color medio de un cuadrado del lienzo alrededor de un punto (píxeles CSS).
const zona=(pagina,x,y,r)=>pagina.evaluate(([x,y,r])=>{const c=document.getElementById('lienzo'),k=c.width/c.clientWidth,g=document.createElement('canvas');g.width=g.height=24;const q=g.getContext('2d');
  q.drawImage(c,(x-r)*k,(y-r)*k,2*r*k,2*r*k,0,0,24,24);const d=q.getImageData(0,0,24,24).data;let s=[0,0,0];for(let i=0;i<d.length;i+=4){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];}const n=d.length/4;
  return {r:s[0]/n,g:s[1]/n,b:s[2]/n,luz:(s[0]+s[1]+s[2])/n/3,px:Array.from(d)};},[x,y,r]);
const diferencia=(a,b)=>{let s=0;for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return s/(a.length/4)/3;};
async function abrir(navegador,{ancho=1280,alto=800,captura=true,reducido=false,sinWebgl=false}={}){
  const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:reducido?'reduce':'no-preference'}),pagina=await contexto.newPage(),errores=[];
  pagina.on('pageerror',e=>errores.push(e.message));
  pagina.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
  if(sinWebgl)await pagina.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:g.call(this,t,...a);};});
  await pagina.goto(base+(captura?'&captura=1':''));
  if(!sinWebgl)await pagina.waitForFunction(R=>window[R]?.listo(),R,{timeout:120000});
  const r=(f,...a)=>pagina.evaluate(([R,f,a])=>{const r=window[R];return (0,eval)('(r,a)=>'+f)(r,a);},[R,f,a]);
  return {contexto,pagina,errores,r};
}
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  for(const [ancho,alto] of [[1280,800],[390,760]]){const caso=ancho+'×'+alto,{contexto,pagina,errores,r}=await abrir(navegador,{ancho,alto});
    let e=await r('r.estado()');
    assert.ok(e.webgl2&&e.version==='186'&&e.hdr&&e.muestras===4,caso+': WebGL 2, three r186, HDR con MSAA 4×');
    assert.deepEqual(e.pases,['render','oclusion','saneado','resplandor','salida'],caso+': oclusión, saneado (sin NaN), resplandor y salida');
    assert.deepEqual([...new Set(e.casas.map(c=>c.tipo))].sort(),['entramada','piedra','taberna'],caso+': los tres tipos de casa');
    assert.ok(e.casas.every(c=>c.triangulos<(c.tipo==='taberna'?8000:3500)&&c.ventanas>=4),caso+': cada casa respeta su presupuesto (3.500; taberna con tres toneles detallados: 8.000) ('+e.casas.map(c=>c.tipo+' '+c.triangulos).join(', ')+')');
    const d=await r('r.dibujar()');assert.ok(e.mallasCalle<=14&&d.llamadas<120,caso+': las seis casas se funden en '+e.mallasCalle+' mallas; la escena, '+d.llamadas+' llamadas y '+(d.triangulos/1000).toFixed(0)+' mil triángulos');
    // Las ventanas encendidas brillan cálidas sobre el yeso de alrededor.
    await r('r.camara("entramada")');await r('r.avanzar(3)');const vs=await r('r.ventanas("entramada")');assert.ok(vs.length>=2,caso+': se ven ventanas encendidas de la casa entramada');
    const v=vs.sort((a,b)=>b.radio-a.radio)[0],dentro=await zona(pagina,v.x,v.y,Math.max(3,v.radio*.5)),fuera=await zona(pagina,v.x,v.y-v.radio*3.2,Math.max(3,v.radio*.5));
    assert.ok(dentro.luz>fuera.luz*1.15&&dentro.r>dentro.b*1.15,caso+': la ventana brilla cálida ('+dentro.luz.toFixed(0)+' frente al muro '+fuera.luz.toFixed(0)+'; rojo '+dentro.r.toFixed(0)+', azul '+dentro.b.toFixed(0)+')');
    // Apagar las luces de dentro: la ventana se apaga.
    await r('r.luces(false)');await r('r.avanzar(1.5)');const apagada=await zona(pagina,v.x,v.y,Math.max(3,v.radio*.5));await r('r.luces(true)');await r('r.avanzar(1.5)');
    assert.ok(apagada.luz<dentro.luz*.6,caso+': con las luces apagadas la ventana se oscurece ('+dentro.luz.toFixed(0)+' → '+apagada.luz.toFixed(0)+')');
    assert.deepEqual(errores,[],caso+': sin errores');await contexto.close();}
  console.log('✓ Pocos triángulos por casa y pocas llamadas por calle; ventanas cálidas que se apagan');

  // Interior mapping: detrás del cristal hay una habitación. Centrado en la ventana, desde dos ángulos se ve distinta
  // (la perspectiva interior); una pegatina plana se vería casi igual.
  {const {contexto,pagina,errores,r}=await abrir(navegador);
    const ver=async yaw=>{await r('r.camara({foco:[-8.5,4.7,-3.6],yaw:a[0],pitch:.05,dist:3.2})',yaw);await r('r.avanzar(.2)');const v=(await r('r.ventanas("entramada")')).sort((a,b)=>b.radio-a.radio)[0];
      return {v,cristal:await zona(pagina,v.x,v.y,v.radio*.6)};};
    const A=await ver(.45),B=await ver(-.45);const dCristal=diferencia(A.cristal.px,B.cristal.px);
    assert.ok(dCristal>11,'La habitación de dentro cambia con el ángulo ('+dCristal.toFixed(1)+')');
    // Al atardecer el cielo se aclara y se calienta.
    await r('r.camara("calle")');await r('r.avanzar(2)');const cieloN=await zona(pagina,40,30,20);await r('r.hora("atardecer")');await r('r.avanzar(.3)');const cieloT=await zona(pagina,40,30,20);
    assert.ok(cieloT.luz>cieloN.luz+10&&cieloT.r>cieloN.r,'Al atardecer cambia el cielo ('+cieloN.luz.toFixed(0)+' → '+cieloT.luz.toFixed(0)+')');
    assert.deepEqual(errores,[],'Sin errores con la perspectiva y la hora');await contexto.close();}
  console.log('✓ Interior mapping: la habitación de dentro cambia con la perspectiva; noche y atardecer');

  for(const reducido of [false,true]){const {contexto,pagina,errores}=await abrir(navegador,{captura:false,reducido});
    await pagina.waitForFunction(()=>/fps/.test(document.getElementById('info').textContent),null,{timeout:60000});
    const info=await pagina.textContent('#info');assert.ok(/llamadas/.test(info)&&/three 186/.test(info)&&!/sin posproceso/.test(info),'El marcador muestra fps, llamadas y versión ('+info+')');
    assert.equal(await pagina.isChecked('#girar'),!reducido,reducido?'Con movimiento reducido no gira sola':'Gira sola');
    assert.ok(/triángulos/.test(await pagina.textContent('#ficha')),'La ficha dice lo que cuesta cada casa');
    assert.deepEqual(errores,[],'Sin errores al usarla');await contexto.close();}
  {const {contexto,pagina,errores}=await abrir(navegador,{captura:false,sinWebgl:true});
    await pagina.waitForFunction(()=>/WebGL 2/.test(document.getElementById('estado').textContent),null,{timeout:30000});
    assert.deepEqual(errores,[],'Sin WebGL 2 no hay errores sueltos: sólo el aviso');await contexto.close();}
  console.log('✓ Uso real: marcador, ficha de costes, movimiento reducido y aviso sin WebGL 2');
}finally{await navegador?.close();servidor.close();}

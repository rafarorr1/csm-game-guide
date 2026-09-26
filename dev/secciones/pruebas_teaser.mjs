/* Pruebas del animatic del teaser en su sección aislada: el paquete sólo
   lleva sus dependencias; con el reloj virtual (?captura=1) recorre los 20 s y
   en cada plano se ve la capa que toca, con imagen (no negro), los efectos
   dejan su huella (Thal invocado, El Rey en ceniza, Eric congelado, el Dragón
   y Petunia Sagrada) y termina en negro; sin ?captura=1 el reloj es el real
   y el botón de reproducir queda listo. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportar,componentesTeaser,derivarTeaser} from './teaser-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {hash} from './fuentes.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
for(const f of ['teaser-mesa.js','teaser-reloj.js']){
  const js=fs.readFileSync(path.join(aqui,f),'utf8');
  assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),f+': sin Animation.finished ni preserve-3d');
}
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-teaser-'));
try{
  const destino=path.join(temporal,'teaser'),p=exportar(destino),{lista,fondos}=derivarTeaser();
  const esperados=[...new Set(['index.html','_headers','procedencia.json','teaser-reloj.js','teaser-mesa.js','teaser-mesa.css','generado/datos.js','art/logo.webp',
    ...componentesTeaser.map(f=>'juego/'+f),...lista.map(c=>c.url),...fondos.map(f=>f.url)])].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'El teaser sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__[A-Z]+__/.test(html)&&!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'Sin marcadores ni recursos remotos');
  assert.ok(html.indexOf('teaser-reloj.js')<html.indexOf('juego/carta-pintor.js'),'El reloj virtual se carga antes que los módulos');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/teaser.html';
// Qué capa se ve en cada instante (s).
const ESPERADO=[[2,'lienzoTormenta'],[5.6,'hostInvocar'],[7.6,'planoAliento'],[9.2,'planoEscarcha'],[10,'planoPolimorfia'],[11,'planoAscension'],[11.7,'lienzoGota'],[13.2,'hostCortinilla'],[17.5,'lienzoLogo']];
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  const pagina=await navegador.newPage({viewport:{width:960,height:540}}),errores=[];
  pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
  const luz=()=>pagina.screenshot().then(b=>pagina.evaluate(async u=>{const i=new Image();await new Promise(r=>{i.onload=r;i.src=u;});const c=document.createElement('canvas');c.width=96;c.height=54;const g=c.getContext('2d');g.drawImage(i,0,0,96,54);
    const d=g.getImageData(0,0,96,54).data;let s=0;for(let k=0;k<d.length;k+=4)s+=(d[k]+d[k+1]+d[k+2])/3;return s/(d.length/4);},'data:image/png;base64,'+b.toString('base64')));

  // Sin ?captura=1: reloj real y el botón listo.
  await pagina.goto(base);
  await pagina.waitForFunction(()=>!document.getElementById('reproducir').disabled,null,{timeout:300000});
  assert.equal(await pagina.evaluate(()=>typeof window.CAOZ_RELOJ_VIRTUAL),'undefined','Sin captura no hay reloj virtual');
  assert.equal(await pagina.evaluate(()=>CAOZ_TEASER.listo),true,'El teaser se prepara');
  const planos=await pagina.evaluate(()=>CAOZ_TEASER.planos());
  assert.equal(planos[0].ini,0);assert.ok(planos.at(-1).fin>=20,'Llega a los 20 s');
  for(let i=1;i<planos.length;i++)assert.ok(planos[i].ini<=planos[i-1].fin+1e-9,'Sin huecos entre '+planos[i-1].id+' y '+planos[i].id);
  console.log('✓ Reloj real, planos seguidos de 0 a 20 s y botón listo');

  // Con ?captura=1: los 20 s a 10 fotogramas por segundo.
  await pagina.goto(base+'?captura=1');
  assert.equal(await pagina.evaluate(()=>CAOZ_TEASER.listo),true);
  await pagina.evaluate(()=>{CAOZ_RELOJ_VIRTUAL.manual();CAOZ_TEASER.empezar();});
  const vistos=[];let paso=0;
  for(const [t,capa]of ESPERADO){
    while(paso<Math.round(t*10)){await pagina.evaluate(()=>CAOZ_RELOJ_VIRTUAL.avanzar(100));paso++;}
    const v=await pagina.evaluate(()=>({t:CAOZ_TEASER.tiempo(),capas:CAOZ_TEASER.visibles()}));
    assert.ok(Math.abs(v.t-t)<.02,'El reloj virtual marca '+t+' s ('+v.t+')');
    assert.ok(v.capas.includes(capa),t+' s: se ve '+capa+' ('+v.capas.join(', ')+')');
    // La gota es un silencio casi negro a propósito.
    if(capa!=='lienzoGota'){const l=await luz();assert.ok(l>8,t+' s: el plano tiene imagen (luz media '+l.toFixed(1)+')');}vistos.push(capa);
    if(t===7.6)assert.equal(await pagina.evaluate(()=>document.getElementById('ranuraThal').style.visibility),'','Thal cayó en su casilla');
    if(t===13.2)assert.ok(await pagina.evaluate(()=>document.getElementById('alientoRey').dataset.fxCeniza!==undefined),'El Rey quedó en ceniza');
    if(t===13.2)assert.ok(await pagina.evaluate(()=>!!document.querySelector('#escarchaEric canvas + canvas, #escarchaEric canvas ~ *')),'Eric quedó congelado');
  }
  while(paso<200){await pagina.evaluate(()=>CAOZ_RELOJ_VIRTUAL.avanzar(100));paso++;}
  assert.ok(await luz()<2,'Termina en negro');
  assert.deepEqual(errores,[],'Sin errores de página');
  console.log('✓ Captura fotograma a fotograma: '+vistos.length+' planos con imagen, efectos completos y fundido final');
}finally{await navegador?.close();servidor.close();}

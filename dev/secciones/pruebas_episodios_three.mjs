/* Pruebas del Episodio 1 de las batallas de la historia (episodios-three.html,
   «Emboscada en la Carreta hacia el Domo»). La exportación sólo publica sus
   dependencias y respeta la CSP. En el navegador:
     · Adreida lleva el hacha con las dos manos (en reposo, en el tajo y en el
       hachazo vertical la izquierda va en el mango, junto a la derecha);
     · la historia entera, jugada por el piloto automático: la rueda se parte,
       la flecha a Talesin, la emboscada, el Rayo de fuego que falla, Fender
       bajo la carreta (Inspiración bárdica), las acrobacias de Mohamed, las
       Manos ardientes de Rafaela contra el líder, el goblin partido en dos, el
       Proyectil mágico, la gata que baila bachata, la caída de Mohamed, las
       piernas de Glip y el fugitivo; al final, la crónica;
     · uso real: la entrada se salta con una tecla y el marcador funciona.
   CAPTURAS=carpeta guarda capturas de cada momento. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,entornoEpisodiosThree,componentesEpisodiosThree,arteEpisodiosThree,csp} from './episodios-three-exportar.mjs';
import {crearServidor} from './servidor.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-episodios-three-'));
try{
  const destino=path.join(temporal,'episodios-three'),p=exportar(destino);
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  const esperados=['index.html','_headers','procedencia.json',...entornoEpisodiosThree,...componentesEpisodiosThree.map(f=>'juego/'+f),...arteEpisodiosThree];
  for(const f of esperados)assert.ok(archivos.includes(f),'Se publica '+f);
  assert.deepEqual(archivos.filter(f=>!esperados.includes(f)),[],'Sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.ok(html.includes(csp)&&!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'La página lleva la CSP y ningún script en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  const src=fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'episodios-three-mesa.js'),'utf8');
  for(const m of src.matchAll(/smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g))assert.ok(+m[1]<+m[2],'smoothstep con los bordes al revés ('+m[0]+'): en Metal no está definido');
  console.log('✓ Exportación: el episodio, los modelos, three.js empaquetado y los retratos del grupo, sin CDN ni scripts en línea');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/episodios-three.html';
const R='CAOZ_EPISODIOS_THREE_REVISION',CAPTURAS=process.env.CAPTURAS;
if(CAPTURAS)fs.mkdirSync(CAPTURAS,{recursive:true});
async function abrir(navegador,{ancho=1280,alto=800,captura=true}={}){
  const contexto=await navegador.newContext({viewport:{width:ancho,height:alto}}),pagina=await contexto.newPage(),errores=[];
  pagina.on('pageerror',e=>errores.push(e.message));
  pagina.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
  await pagina.goto(base+(captura?'?captura=1':''));
  await pagina.waitForFunction(R=>window[R]?.listo(),R,{timeout:120000});
  const r=(f,...a)=>pagina.evaluate(([R,f,a])=>{const r=window[R];return (0,eval)('(r,a)=>'+f)(r,a);},[R,f,a]);
  return {contexto,pagina,errores,r};
}
let navegador;
try{
  navegador=await chromium.launch({headless:true});

  // ---- El hacha a dos manos ------------------------------------------------------------------
  {const {contexto,errores,r}=await abrir(navegador);
    await r('r.saltarEntrada()');await r('r.avanzar(1.2)');
    for(const [anim,k] of [['quieto',0],['tajoA',.5],['revesA',.5],['estocadaA',.3],['estocadaA',.5]]){await r('r.pose(a[0],a[1])',anim,k);const e=await r('r.avanzar(.05)');
      assert.ok(Math.abs(e.heroe.manoI-.26)<.09,`${anim} ${k}: la mano izquierda va en el mango, a ${e.heroe.manoI} m de la derecha`);}
    await r('r.pose(null)');assert.deepEqual(errores,[],'Sin errores');await contexto.close();}
  console.log('✓ Adreida lleva el hacha con las dos manos (reposo, tajo, revés y hachazo vertical)');

  // ---- La historia entera, jugada por el piloto automático ---------------------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador);const foto=async n=>{if(CAPTURAS)await pagina.screenshot({path:path.join(CAPTURAS,n+'.png')});};
    let e=await r('r.estado()');assert.ok(!e.control&&e.cine,'Empieza la entrada: sin control y con franjas de cine');
    e=await r('r.avanzar(1.2)');assert.ok(e.rueda&&e.hecho.includes('rueda')&&/rueda se parte/.test(e.dialogo),'Se parte la rueda y el narrador lo cuenta ('+e.dialogo+')');await foto('01-rueda');
    e=await r('r.avanzar(3.2)');assert.ok(e.hecho.includes('flecha')&&/hombro/.test(e.grupo.join(' ')),'La flecha alcanza a Talesin en el hombro ('+e.grupo.join(' | ')+')');await foto('02-flecha');
    e=await r('r.avanzar(.8)');const ocultos=e.enemigos.filter(x=>x.estado==='oculto').length;assert.ok(e.control&&!e.cine&&ocultos===4&&e.enemigos.length===11,'¡Emboscada! Salen siete goblins (tres más y Glip esperan en la maleza) y Adreida ya se mueve');
    await r('r.piloto(true)');
    const vistos=new Set(),momentos={rayo:'03-rayo',inspiracion:'04-inspiracion',acrobacias:'05-mohamed-arbol',manos:'06-manos-ardientes',partido:'07-partido',misiles:'08-misiles',ilusion:'09-gata',caida:'10-caida',piernas:'11-glip',fugitivo:'12-fugitivo'};
    let inspirada=0,gata=false,glip=null;
    for(let i=0;i<220&&!e.finVisible;i++){e=await r('r.avanzar(.5)');inspirada=Math.max(inspirada,e.heroe.inspiracion);gata=gata||e.gata;const g=e.enemigos.find(x=>x.tipo==='glip');if(g)glip=g.estado;
      for(const h of e.hecho)if(!vistos.has(h)){vistos.add(h);if(momentos[h])await foto(momentos[h]);}
      if(!e.heroe.vivo)break;}
    await foto('13-final');
    assert.ok(e.heroe.vivo,'Adreida sobrevive a la emboscada (piloto automático; alma '+e.heroe.alma+')');
    assert.ok(inspirada>0,'Fender inspira a Adreida (Inspiración bárdica)');assert.ok(gata,'Aparece la gata que baila bachata');assert.equal(glip,'sinPiernas','Glip se queda sin piernas y vivo');
    const orden=['rueda','flecha','emboscada','rayo','inspiracion','acrobacias','manos','misiles','ilusion','caida','fin'];
    assert.deepEqual(e.hecho.filter(h=>orden.includes(h)),orden,'La historia sigue su orden: '+e.hecho.join(' → '));
    for(const h of ['partido','piernas','fugitivo'])assert.ok(e.hecho.includes(h),'Pasa: '+h+' ('+e.hecho.join(', ')+')');
    assert.ok(e.victoria&&e.finVisible&&e.finTitulo==='Episodio 1 completado','Al final, la pantalla del episodio completado');
    assert.ok(e.cronica.length>=11&&e.cronica.filter(c=>c.startsWith('✓')).length>=11,'La crónica cuenta lo que pasó:\n  '+e.cronica.join('\n  '));
    assert.deepEqual(errores,[],'Sin errores');await contexto.close();}
  console.log('✓ La historia entera: rueda, flecha, emboscada, rayo fallido, Inspiración bárdica, acrobacias, Manos ardientes, goblin partido, Proyectil mágico, la gata bailarina, Mohamed desde el árbol, Glip sin piernas y el fugitivo; y la crónica');

  // ---- Uso real: la entrada se salta con una tecla; marcador ---------------------------------------
  {const {contexto,pagina,errores}=await abrir(navegador,{captura:false});
    await pagina.waitForTimeout(1500);await pagina.keyboard.press('Space');
    await pagina.waitForFunction(R=>window[R].estado().control,R,{timeout:30000});
    await pagina.keyboard.down('KeyD');await pagina.waitForTimeout(600);await pagina.keyboard.up('KeyD');
    await pagina.waitForFunction(()=>/llamadas/.test(document.getElementById('info').textContent),null,{timeout:30000});
    const info=await pagina.textContent('#info');assert.ok(/three 186/.test(info),'El marcador muestra fps y llamadas ('+info+')');
    assert.deepEqual(errores,[],'Sin errores');await contexto.close();}
  console.log('✓ Uso real: una tecla se salta la entrada y empieza la emboscada; marcador');
}finally{await navegador?.close();servidor.close();}

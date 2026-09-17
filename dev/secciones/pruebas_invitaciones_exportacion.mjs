/* Procedencia, aislamiento y rutas visibles de la revisión de invitaciones. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {exportar,derivarInvitaciones,componenteInvitaciones,entornoInvitaciones} from './invitaciones-exportar.mjs';
import {juego,hash} from './fuentes.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-invitaciones-'));
try{
  const destino=path.join(temporal,'invitaciones'),procedencia=exportar(destino),archivo=f=>fs.readFileSync(path.join(destino,f));
  const html=archivo('index.html').toString(),css=archivo('invitaciones.css').toString(),js=archivo('invitaciones.js').toString(),datos=archivo('generado/datos.js').toString(),componente=archivo('juego/'+componenteInvitaciones).toString();
  const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const esperados=['index.html','_headers','procedencia.json','invitaciones.css','invitaciones.js','generado/datos.js','juego/'+componenteInvitaciones].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica el puente y su componente compartido');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__CSP__|__GENERADO__|<iframe/i.test(html),'No quedan marcadores ni juego incrustado');
  assert.ok(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'No se cargan recursos remotos');
  assert.ok(html.includes('Content-Security-Policy" content="'+csp+'"'),'La entrada conserva la CSP común');
  assert.equal(archivo('_headers').toString(),'/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n','Las cabeceras no cambian la política compartida');
  assert.ok(html.indexOf('generado/datos.js')<html.indexOf('juego/invitaciones-compartidas.js')&&html.indexOf('juego/invitaciones-compartidas.js')<html.indexOf('invitaciones.js'),'El build y la fuente compartida se cargan antes del laboratorio');
  for(const prohibido of ['motor.js','final.js','final-core.js','movil.html','audio-domo.js','sw.js','manifest.webmanifest','_worker.js'])assert.ok(!fs.existsSync(path.join(destino,prohibido)),prohibido+' no pertenece a la sección');
  assert.equal(componente,fs.readFileSync(path.join(juego,componenteInvitaciones),'utf8'),'El módulo de invitaciones se copia byte a byte desde el juego');
  assert.equal(hash(componente),procedencia.componente.sha256,'La procedencia conserva la firma del módulo real');
  const derivado=derivarInvitaciones();assert.equal(datos,derivado.datosJS,'El build de la muestra se deriva de ambas mesas');assert.equal(procedencia.fixture.build,derivado.build);
  for(const [f,firma] of Object.entries(procedencia.entorno))assert.equal(hash(archivo(f)),firma,f+' conserva el adaptador revisado');
  assert.ok(js.includes('api().enlace')&&js.includes('api().mensajeCodigo'),'El laboratorio pide enlace y texto al mismo módulo del juego');
  assert.ok(!/\b(?:new URL|localStorage|sessionStorage|fetch|WebSocket|navigator\.share)\b/.test(js),'El laboratorio no duplica rutas ni abre red, progreso o el diálogo del sistema');
  assert.ok(css.includes('.invitacionesVelo')&&html.includes('id="invitacionesTengoApp"')&&html.includes('id="invitacionesSeguirNavegador"'),'El puente de navegador conserva ambas decisiones');
  const ventana={};const contexto=vm.createContext({URL,window:ventana});new vm.Script(componente,{filename:'invitaciones-compartidas.js'}).runInContext(contexto);
  const api=ventana.CAOZ_INVITACIONES;
  assert.equal(api.codigo('https://juego.caozcontodo.com/?sala=rul42'), 'RUL42');
  assert.equal(api.codigo('r-u_l 42'), 'RUL42');
  assert.equal(api.enlace('rul42','https://juego.caozcontodo.com/movil.html?antiguo=1#otro',264),'https://juego.caozcontodo.com/?sala=RUL42&b=264');
  assert.equal(api.enlace('rul42','https://beta.caoz-tcg.pages.dev/?b=263',264),'https://beta.caoz-tcg.pages.dev/?sala=RUL42&b=264');
  assert.equal(api.nombreEdicion('https://juego.caozcontodo.com/'),'Caoz TCG');
  assert.equal(api.nombreEdicion('https://beta.caoz-tcg.pages.dev/'),'la beta de Caoz TCG');
  assert.equal(api.nombreEdicion('https://rafarorr1.github.io/csm-game-guide/tcg-beta/'),'la beta de Caoz TCG');
  assert.match(api.mensajeCodigo('rul42','https://beta.caoz-tcg.pages.dev/'),/Código: RUL42/);
  assert.match(api.mensajeCodigo('rul42','https://beta.caoz-tcg.pages.dev/'),/la beta de Caoz TCG instalada/);
  assert.equal(api.enApp({standalone:true},()=>({matches:false})),true,'La detección de app permanece en el módulo común');
  assert.equal(procedencia.partida,false);assert.equal(procedencia.ia,false);assert.equal(procedencia.online,false);assert.equal(procedencia.progresoReal,false);
  new vm.Script(js,{filename:'invitaciones.js'});assert.ok(css.includes('@media(max-width:790px)'),'La vista conserva la adaptación para teléfono');
  assert.throws(()=>exportar(destino),/vacío/);
  const segundo=path.join(temporal,'segundo');exportar(segundo);for(const f of archivos)assert.deepEqual(archivo(f),fs.readFileSync(path.join(segundo,f)),'Exportación determinista: '+f);
  console.log('✓ Invitaciones: componente compartido, dos rutas y puente de navegador aislados y comprobados.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

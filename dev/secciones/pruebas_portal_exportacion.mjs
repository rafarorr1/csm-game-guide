/* El portal aislado conserva la pantalla real, sin credenciales ni destinos reales. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesPortal} from './portal-exportar.mjs';
import {juego,hash} from './fuentes.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-portal-'));
try{
  const destino=path.join(temporal,'portal'),procedencia=exportar(destino),leer=n=>fs.readFileSync(path.join(destino,n),'utf8');
  const html=leer('index.html'),css=leer('portal.css'),js=leer('portal.js'),preview=leer('portal-preview.js');
  const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const esperados=['_headers','index.html','portal.css','portal.js','portal-preview.js','procedencia.json'].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica el portal y su transporte efímero');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__PORTAL_CSP__|__PORTAL_PREVIEW__|<iframe/i.test(html),'La página publicada no conserva marcadores ni incrusta el juego');
  assert.ok(html.includes('Content-Security-Policy" content="'+csp+'"'),'El portal aislado conserva la CSP común');
  assert.equal(leer('_headers'),'/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  assert.ok(html.indexOf('portal-preview.js')<html.indexOf('portal.js'),'El transporte temporal se instala antes del componente real');
  for(const etiqueta of ['Producción','Beta','Estudio de Cartas','Estudio de Sonidos','Juego Físico'])assert.ok(html.includes(etiqueta),etiqueta+' aparece como una puerta del portal');
  assert.ok(html.includes('href="/produccion/"')&&html.includes('href="https://beta.caoz-tcg.pages.dev/"')&&html.includes('href="/estudio"')&&html.includes('href="/sonidos"')&&html.includes('href="/fisico/"'),'Las rutas previstas están declaradas en el componente real');
  assert.doesNotMatch(js,/CLAVE_PRUEBA|CLAVE_REAL/,'El componente real no conserva una clave fija');
  assert.ok(js.includes("'/api/portal/sesion'")&&js.includes("method:'POST'")&&js.includes("method:'DELETE'"),'El componente real sólo usa el contrato de sesión del Worker');
  assert.ok(!/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(js),'La pantalla no guarda una clave ni una sesión en el navegador');
  assert.match(js,/function destinoSeguro\(valor\)/,'Una invitación pendiente se valida antes de reanudarla');
  assert.match(js,/u\.origin!==location\.origin/,'El portal rechaza redirecciones fuera del proyecto');
  assert.doesNotMatch(preview,/CLAVE_PRUEBA|CLAVE_REAL/,'La revisión aislada no publica una clave fija');
  assert.ok(preview.includes('CAOZ_PORTAL_PREVIEW'),'La revisión aislada conserva su transporte temporal');
  assert.match(preview,/datos\.clave\.trim\(\)/,'La revisión aislada admite una clave de demostración sin conservar una real');
  assert.ok(css.includes('@media(max-width:640px)')&&css.includes('prefers-reduced-motion'),'El portal conserva una presentación móvil y movimiento opcional');
  for(const [archivo,dato] of Object.entries(procedencia.componentes))assert.equal(hash(fs.readFileSync(path.join(juego,archivo))),dato.sha256,archivo+' se copia byte a byte desde el componente real');
  assert.equal(procedencia.partida,false);assert.equal(procedencia.ia,false);assert.equal(procedencia.online,false);assert.equal(procedencia.progresoReal,false);
  assert.throws(()=>exportar(destino),/vacío/);
  const segundo=path.join(temporal,'segundo');exportar(segundo);for(const archivo of archivos)assert.deepEqual(fs.readFileSync(path.join(destino,archivo)),fs.readFileSync(path.join(segundo,archivo)),'Exportación determinista: '+archivo);
  console.log('✓ Portal: pantalla real, cinco rutas y acceso aislado en memoria comprobados.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

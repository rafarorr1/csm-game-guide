/* Procedencia y límites del laboratorio aislado de Pitágoras. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {cartasPitagoras,componentesPitagoras,derivarPitagoras,exportar,recursosPitagoras} from './pitagoras-exportar.mjs';
import {datosDesdeMotor,hash,juego,leer} from './fuentes.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-pitagoras-'));
try{
  const destino=path.join(temporal,'pitagoras'),procedencia=exportar(destino),archivo=f=>fs.readFileSync(path.join(destino,f));
  const html=archivo('index.html').toString(),adaptador=archivo('pitagoras.js').toString(),datos=archivo('generado/datos.js').toString();
  const esperados=['_headers','index.html','memoria.js','pitagoras.css','pitagoras.js','procedencia.json','generado/datos.js','generado/manifiesto.json',...componentesPitagoras.map(f=>'juego/'+f),...recursosPitagoras.map(f=>'juego/'+f)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'Pitágoras sólo publica el fixture, el adaptador y sus módulos reales declarados');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__CSP__|__GENERADO__|<iframe/i.test(html),'No quedan marcadores ni se incrusta el juego completo');
  assert.ok(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'La revisión no carga recursos remotos');
  assert.ok(html.indexOf('memoria.js')<html.indexOf('generado/datos.js'),'La memoria temporal se instala antes del fixture');
  for(const prohibido of ['motor.js','final.js','final-core.js','pitagoras-combate.js','pitagoras-laboratorio.js','audio-domo.js','sw.js','manifest.webmanifest','_worker.js'])assert.ok(!fs.existsSync(path.join(destino,prohibido)),prohibido+' no pertenece al laboratorio');
  const contexto=vm.createContext({});new vm.Script(datos).runInContext(contexto);
  assert.equal(vm.runInContext('PITAGORAS_REVISION.puente.tipo',contexto),'carrera','El fixture inicia El último puente');
  assert.equal(vm.runInContext('PITAGORAS_REVISION.puente.duracion',contexto),20,'La duración es la real de la prueba');
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(PITAGORAS_REVISION.cartas)',contexto)),cartasPitagoras,'El ciclo temporal conserva las seis cartas del Editor');
  assert.equal(vm.runInContext('PITAGORAS_REVISION.conducta.ritual.pdInicial',contexto),2,'El Ritual del Editor entrega los 2 PD iniciales derivados');
  assert.equal(vm.runInContext('PITAGORAS_REVISION.conducta.ritual.bloqueaBonoSegundo',contexto),true,'El Ritual conserva exactamente sus 2 PD aunque Pitágoras sea segundo');
  assert.equal(vm.runInContext('PITAGORAS_REVISION.conducta.pesadilla.unaPorTurno',contexto),true,'La revisión expone una sola Pesadilla por turno');
  assert.equal(vm.runInContext('PITAGORAS_REVISION.conducta.pesadilla.marca',contexto),'editorPesadillaTurno','La marca de la Pesadilla procede de su requisito real');
  assert.equal(vm.runInContext('PITAGORAS_REVISION.conducta.pesadilla.marcaAntesDePrueba',contexto),true,'La Pesadilla se bloquea antes de abrir su prueba');
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(PITAGORAS_REVISION.conducta.prioridad.cartas)',contexto)),[
    {id:'editorcosecha',base:45,bonos:[]},
    {id:'editorcorte',base:53,bonos:[{id:'editorcorte',condicion:'foe.field.filter(u=>u.alive).length>=2',valor:5}]},
    {id:'editorcuadro',base:48,bonos:[]},
    {id:'editorcarrera',base:58,bonos:[{id:'editorcarrera',condicion:'p.field.length===0',valor:12}]},
    {id:'editororbita',base:50,bonos:[]},
    {id:'editorduelo',base:42,bonos:[{id:'editorduelo',condicion:'p.field.length>=3',valor:6}]}
  ],'Las prioridades y sus bonos se publican desde aiScore');
  assert.equal(vm.runInContext('typeof G',contexto),'undefined','El fixture no representa una partida');
  assert.equal(vm.runInContext('typeof newGame',contexto),'undefined','El motor no acompaña la revisión');
  const catalogo=datosDesdeMotor(leer('motor.js'));
  for(const id of cartasPitagoras)assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(CARDS['+JSON.stringify(id)+'])',contexto)),catalogo.CARDS[id],id+' procede del catálogo real');
  for(const [f,firma] of Object.entries(procedencia.componentes))assert.equal(hash(archivo('juego/'+f)),firma,f+' conserva el módulo real');
  for(const [f,firma] of Object.entries(procedencia.recursos))assert.equal(hash(archivo('juego/'+f)),firma,f+' conserva el recurso real declarado');
  for(const [f,firma] of Object.entries(procedencia.entorno))assert.equal(hash(archivo(f)),firma,f+' conserva el adaptador de la sección');
  assert.equal(archivo('juego/pitagoras-pruebas.js').toString(),fs.readFileSync(path.join(juego,'pitagoras-pruebas.js'),'utf8'),'La UI de la prueba es la del juego');
  assert.equal(archivo('juego/pitagoras-mundos.js').toString(),fs.readFileSync(path.join(juego,'pitagoras-mundos.js'),'utf8'),'La lógica del puente es la del juego');
  assert.equal(archivo('juego/pitagoras-pixel.js').toString(),fs.readFileSync(path.join(juego,'pitagoras-pixel.js'),'utf8'),'El render del puente es el del juego');
  for(const f of recursosPitagoras)assert.deepEqual(archivo('juego/'+f),fs.readFileSync(path.join(juego,f)),f+' conserva los bytes exactos del arte del juego');
  const rutaArte=new URL('art/esbirro-editor-v219.webp','https://revision.example/pitagoras/juego/pitagoras-pruebas.js').pathname;
  assert.equal(rutaArte,'/pitagoras/juego/art/esbirro-editor-v219.webp','El arte se resuelve junto al módulo que lo solicita');
  assert.ok(fs.existsSync(path.join(destino,rutaArte.replace('/pitagoras/',''))),'La ruta relativa de la prueba tiene su arte exportado');
  const derivado=derivarPitagoras();assert.equal(archivo('generado/datos.js').toString(),derivado.datosJS);assert.deepEqual(procedencia.conducta,derivado.conducta.procedencia,'La procedencia registra las reglas leídas del jefe');assert.equal(procedencia.puente.sha256,derivado.regla.sha256,'La procedencia registra la función real del puente');
  assert.ok(adaptador.includes('PITAGORAS_PRUEBAS')&&adaptador.includes('api.iniciar({...puente,')&&adaptador.includes('dibujarConducta'),'El adaptador abre el minijuego real y presenta la lectura derivada');
  assert.ok(!/\b(?:newGame|aiTurn|aiScore|NET|WebSocket|EventSource|fetch|localStorage|sessionStorage)\b/.test(adaptador),'El adaptador no monta juego, IA, red ni almacenamiento propio');
  const memoria=archivo('memoria.js').toString();assert.ok(memoria.includes('new Map()')&&!/\b(?:fetch|indexedDB|document\.cookie)\b/.test(memoria),'La memoria de la sección es temporal');
  assert.equal(procedencia.partida,false);assert.equal(procedencia.ia,false);assert.equal(procedencia.online,false);assert.equal(procedencia.progresoReal,false);
  assert.throws(()=>exportar(destino),/vacío/);
  const segundo=path.join(temporal,'segundo');exportar(segundo);for(const f of archivos)assert.deepEqual(archivo(f),fs.readFileSync(path.join(segundo,f)),'La exportación es determinista: '+f);
  console.log('✓ Pitágoras: puente, controles y render reales; fixture de cartas y aislamiento comprobados.');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

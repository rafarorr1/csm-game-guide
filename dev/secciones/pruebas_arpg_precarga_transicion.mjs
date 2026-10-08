/* El diálogo de destino protege la transición y conserva el nivel si falla la preparación. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {extraerDeclaracion} from './fuentes.mjs';
const s=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),desde=s.indexOf('  async function prepararSiguienteEscena(){'),hasta=s.indexOf('  function mandoDestino(){',desde);
assert(desde>0&&hasta>desde);
let completar,fallar,preparaciones=0,compilaciones=0,romper=false;
const puerta=()=>new Promise((resolve,reject)=>{completar=resolve;fallar=reject;});
const elementos=new Map(),$=id=>{if(!elementos.has(id))elementos.set(id,{textContent:'',disabled:false,abierto:true,close(){this.abierto=false;}});return elementos.get(id);};
const c=vm.createContext({console:{warn(){}},performance,$,renderer:{},camara:{aspect:1.7},carga:{cuadro:()=>Promise.resolve()},casaGoblin:{precargar:()=>{preparaciones++;return puerta();}},finalMago:{precargar:()=>Promise.resolve()},prepararVariantesEscena:async()=>{compilaciones++;if(romper)throw Error('Fallo de GPU de prueba');}});
vm.runInContext(`let cinePreparado=false,promesaCine=null,preparandoTransicion=false,antes=0;const rog={abierto:true,resuelto:true,tirada:1},ol={i:3},ABIERTO=false,ent={},teclas={clear(){}},jugadores=[],botines=[],OLEADAS=Array(7);function sincronizarTiempo(){};function quitarBotin(){};
${extraerDeclaracion(s,'prepararCine').texto}
${extraerDeclaracion(s,'seguirDestino').texto}
${s.slice(desde,hasta)}
`,c);
const run=texto=>vm.runInContext(texto,c),esperar=()=>new Promise(resolve=>setImmediate(resolve));
const primero=run('prepararSiguienteEscena()');run('seguirDestino();seguirDestino();');await esperar();
assert.equal(preparaciones,1);assert(run('rog.abierto&&preparandoTransicion&&rog.preparando'));assert($('destinoSeguir').disabled);
completar();await primero;assert.equal(compilaciones,1);assert(!run('rog.abierto||preparandoTransicion||rog.preparando'));assert.equal(run('ol.i'),3);assert.equal(run('ol.descanso'),.8);assert.equal($('destino').abierto,false);
// Volver a intentar tras un fallo no omite la preparación ni cierra antes el diálogo.
run('cinePreparado=false;promesaCine=null;rog.abierto=true;rog.resuelto=true;rog.tirada++;');$('destino').abierto=true;
const segundo=run('prepararSiguienteEscena()');await esperar();fallar(Error('Descarga de prueba'));await segundo;
assert(run('rog.abierto&&!cinePreparado&&!preparandoTransicion'));assert(!$('destinoSeguir').disabled);assert.match($('destinoResultado').textContent,/intentarlo/);
romper=true;const tercero=run('prepararSiguienteEscena()');await esperar();completar();await tercero;
assert(run('rog.abierto&&!cinePreparado&&promesaCine===null'),'Un fallo GPU también permite repetir la pasada final');
romper=false;const cuarto=run('prepararSiguienteEscena()');await esperar();completar();await cuarto;
assert(!run('rog.abierto'));assert.equal(preparaciones,4);assert.equal(compilaciones,3);
console.log('✓ Transición única, espera visible, avance sólo al preparar, nivel conservado ante fallo de descarga/GPU y reintento completo.');

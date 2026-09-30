/* Entrada real con lecturas simuladas: no necesita un mando físico. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console});c.window=c;
vm.runInContext(fs.readFileSync(new URL('./visor-three-vendor.js',import.meta.url),'utf8'),c);
const s=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
vm.runInContext(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,escena=new THREE.Scene();const HAB={salto:{coste:25}};function aDistancia(){return heroe.tipo==='mohamed';}function dentroPlaza(){}function rechazo(){}let pads=[],avisos=[];const navigator={getGamepads:()=>pads},document={hidden:false},$=()=>null,ent={piloto:false},ctl={mov:new V3()},heroe={pos:new V3(),tipo:'adreida',vivo:true,estado:'quieto',furia:50,radio:.42,cd:{salto:0}};let ultimoDestino=null;function usar(a,p){avisos.push(a);ultimoDestino=p;if(a==='salto'){heroe.furia-=25;heroe.estado='salto';}return true;} `+s.slice(s.indexOf('  const saltoMando='),s.indexOf("  addEventListener('focus',()=>{mando.foco")),c);
const run=x=>vm.runInContext(x,c);
assert.equal(run('leerMando()'),null);
run(`const g={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};pads=[g];leerMando();`);
assert.equal(run('mando.listo'),true);
run('g.axes=[.05,-.05,0,0]');assert.equal(run('leerMando()'),null);
run('g.axes=[1,1,0,0]');assert.ok(Math.abs(run('leerMando().mov.length()')-1)<1e-9);
run('g.axes=[0,0,1,0];g.buttons[7].pressed=true');assert.equal(run('leerMando().atacar'),true);assert.equal(run('ctl.apunta.x'),7);
run('g.buttons[0].pressed=true;leerMando();leerMando()');assert.equal(run('avisos.length'),1);assert.equal(run('avisos[0]'),'esquiva');
run('g.buttons[0].pressed=false;leerMando();g.buttons[0].pressed=true;leerMando()');assert.equal(run('avisos.length'),2);
run('document.hidden=true');assert.equal(run('leerMando()'),null);
run('document.hidden=false');assert.equal(run('leerMando()'),null);
run('g.axes=[0,0,0,0];g.buttons.forEach(b=>b.pressed=false);leerMando();g.buttons[2].pressed=true');assert.equal(run('leerMando().atacar'),true);
run('pads=[]');assert.equal(run('leerMando()'),null);assert.equal(run('mando.activo'),false);
run("g.mapping='';pads=[g]");assert.equal(run('leerMando()'),null);
console.log('Mando: zona muerta, ejes, apuntado, ataque mantenido, flancos, foco y desconexión correctos.');

// Salto en dos pulsaciones: sin gasto inicial, ajuste de distancia, confirmación y cancelación.
run("g.mapping='standard';g.axes=[0,0,0,0];g.buttons.forEach(b=>b.pressed=false);leerMando();leerMando();avisos=[];g.buttons[1].pressed=true;leerMando()");
assert.equal(run('saltoMando.activo'),true);assert.equal(run('avisos.length'),0);assert.equal(run('heroe.furia'),50);
run('leerMando()');assert.equal(run('avisos.length'),0);
run('g.buttons[1].pressed=false;g.axes=[.59,0,0,0];leerMando()');assert.ok(Math.abs(run('saltoMando.distancia')-4.5)<1e-9);assert.ok(Math.abs(run('saltoMando.destino.x')-4.5)<1e-9);
run('g.axes=[1,0,0,0];leerMando()');assert.equal(run('saltoMando.distancia'),8);
run('g.axes=[0,-.59,0,0];leerMando()');assert.ok(Math.abs(run('saltoMando.destino.z')+4.5)<1e-9);
run('g.axes=[.59,0,0,0];leerMando();g.axes=[0,0,-1,0];g.buttons[12].pressed=true;leerMando()');assert.ok(Math.abs(run('saltoMando.destino.x')-4.5)<1e-9);
run('g.buttons[12].pressed=false;g.buttons[1].pressed=true;leerMando()');assert.equal(run('avisos[0]'),'salto');assert.equal(run('heroe.furia'),25);assert.ok(Math.abs(run('ultimoDestino.x')-4.5)<1e-9);assert.equal(run('saltoMando.activo'),false);
run("heroe.estado='quieto';g.buttons[1].pressed=false;leerMando();g.buttons[1].pressed=true;leerMando();g.buttons[1].pressed=false;g.buttons[0].pressed=true;leerMando()");assert.equal(run('saltoMando.activo'),false);assert.equal(run('avisos.length'),1);
run('g.buttons[0].pressed=false;leerMando();g.buttons[1].pressed=true;leerMando();pads=[];leerMando()');assert.equal(run('saltoMando.activo'),false);
run("heroe.tipo='mohamed';pads=[g];g.buttons.forEach(b=>b.pressed=false);g.axes=[0,0,0,0];leerMando();g.buttons[1].pressed=true;leerMando()");assert.equal(run('avisos.length'),2);assert.equal(run('saltoMando.activo'),false);
console.log('Salto: preparar, mantener, ajustar, confirmar, cancelar, desconectar y backflip inmediato correctos.');

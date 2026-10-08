/* Contratos de combate: ejecuta daño, parry y proyectiles reales sin GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const c=vm.createContext({console,enTutorial:()=>false});c.window=c;
for(const f of ['arpg-three-estilo.js','visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const extraer=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
c.estilo=c.CAOZ_ARPG_ESTILO.crear();
vm.runInContext(`
const FACTOR_COOP=1;const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),TAU=Math.PI*2;
const escena=new THREE.Scene(),enemigos=[],reloj={t:0},heroe={pos:new V3(),radio:.4,invul:0,vivo:true,dir:Math.PI,estado:'quieto',t:0,cd:{},furia:0,parrys:0};
const jugadores=[heroe],conHeroe=(h,f)=>f();const marcas=[];let paron=0,recibido=0,avisos=0;
const rnd=()=>.5,plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a));
const numero=()=>{},chispas=()=>{},temblar=()=>{},polvo=()=>{},banner=()=>{avisos++;},quitarEtiqueta=()=>{};
function marca(){const m=new THREE.Group();m.material={uniforms:{uC:{value:new THREE.Color()},uF:{value:0}}};escena.add(m);const o={m};marcas.push(o);return o;}
function quitarMarca(o){escena.remove(o.m);marcas.splice(marcas.indexOf(o),1);}
function dentroPlaza(p,r){p.x=Math.max(-14+r,Math.min(14-r,p.x));p.z=Math.max(-14+r,Math.min(14-r,p.z));}
const cambiar=(e,estado)=>{e.estado=estado;e.t=0;};
const herir=n=>{recibido+=n;},bloqueado=n=>{recibido+=Math.round(n*.3);};
function crearEnemigo(tipo,x=0,z=0){const m=MOD.crear(tipo),e={tipo,m,pos:new V3(x,0,z),estado:'persigue',d:{aguante:true,jefe:tipo==='troll'},vida:1100,vidaMax:1100,emp:new V3(),provocado:0,dir:0,ataque:null};enemigos.push(e);escena.add(m.raiz);m.raiz.position.copy(e.pos);return e;}
function morir(e){e.estado='muere';limpiarPeligrosTroll(e);}
${['PARRY','peligrosTroll','geoRocaTroll'].map(n=>extraer(n,'const')).join('\n')}
${['danar','activarFaseTroll','vulnerableTroll','blindadoTroll','parar','parryPerfecto','aturdirPorParry','cancelarAtaque','liberarModeloTroll','quitarPeligroTroll','limpiarPeligrosTroll','peligroTroll','lanzarPiedras','puedeLanzarGoblin','sujetarGoblin','arrojarGoblin','pasoPeligrosTroll'].map(n=>extraer(n)).join('\n')}
function limpiar(){limpiarPeligrosTroll();for(const e of enemigos){cancelarAtaque(e);liberarModeloTroll(e.m);}enemigos.length=0;marcas.length=0;reloj.t=0;recibido=0;avisos=0;Object.assign(heroe,{invul:0,vivo:true,estado:'quieto',parrys:0,dir:Math.PI,t:0});heroe.pos.set(0,0,0);}
function avanzar(t){reloj.t+=t;pasoPeligrosTroll(t);}
function bajoPrimeraPiedra(){const p=peligrosTroll[0];heroe.pos.copy(p.hasta);heroe.dir=Math.atan2(p.desde.x-heroe.pos.x,p.desde.z-heroe.pos.z);}
`,c);
const run=s=>vm.runInContext(s,c);
run("limpiar();var jefe=crearEnemigo('troll',0,-3);danar(jefe,9999,{crit:false});");
assert.equal(run('jefe.vida'),550,'Un golpe enorme no omite la segunda fase');
assert.equal(run('avisos'),1);
run("danar(jefe,100,{aturde:8,crit:true});jefe.estado='aturdido';jefe.aturdidoT=4;jefe.expuestoHasta=10;danar(jefe,100);");
assert.equal(run('jefe.vida'),550,'Ni daño crítico, exposición ni otro aturdimiento abren el blindaje');
run('parryPerfecto(jefe,new V3());danar(jefe,50,{crit:false});');
assert.equal(run('jefe.vida'),450,'Parry permite daño y el multiplicador de exposición');
run('reloj.t=2.51;danar(jefe,50,{crit:false});');
assert.equal(run('jefe.vida'),450,'El permiso de parry vence incluso si sigue en otro aturdimiento');
assert.equal(run('avisos'),1,'La transición sucede una vez');
console.log('✓ Fase al 50 %, blindaje, parry y cierre de la ventana');
run("limpiar();jefe=crearEnemigo('troll',0,-3);lanzarPiedras(jefe,jefe.pos);var destinos=peligrosTroll.map(p=>p.hasta.clone());avanzar(.7);");
assert.equal(run('peligrosTroll.length'),5);
assert.ok(run('peligrosTroll.every(p=>Math.abs(plano(p.desde,jefe.pos)-1.2)<1e-6&&plano(p.hasta,jefe.pos)>=3.8&&plano(p.hasta,jefe.pos)<=5.6)'), 'Origen y destinos rodean al troll');
assert.ok(run('peligrosTroll.every((p,i)=>i===0||p.hasta.distanceTo(peligrosTroll[i-1].hasta)>4)'), 'Piedras repartidas alrededor del círculo');
assert.ok(run('peligrosTroll.every(p=>p.m.position.y>3)'), 'Las piedras ascienden físicamente');
run('heroe.pos.set(10,0,10);');
assert.ok(run('peligrosTroll.every((p,i)=>p.hasta.equals(destinos[i]))'),'Destinos fijos para poder esquivarlos');
run('bajoPrimeraPiedra();avanzar(.8);');
assert.equal(run('recibido'),22,'Una piedra en la cabeza causa daño');
run('avanzar(1);');
assert.equal(run('peligrosTroll.length'),0);
assert.equal(run('marcas.length'),5,'Sólo quedan las ondas cosméticas, sin indicadores fijos');
run('limpiar();jefe=crearEnemigo("troll",0,-3);lanzarPiedras(jefe,jefe.pos);bajoPrimeraPiedra();heroe.invul=1;avanzar(2);');
assert.equal(run('recibido'),0,'La esquiva evita las piedras');
console.log('✓ Piedras en arco, marcas fijas, daño e invulnerabilidad de esquiva');
run("limpiar();jefe=crearEnemigo('troll',0,-3);jefe.vida=550;activarFaseTroll(jefe);sujetarGoblin(jefe);arrojarGoblin(jefe,{dir:0});heroe.estado='parry';heroe.t=.05;avanzar(1.15);");
assert.equal(run('recibido'),0);
assert.equal(run('peligrosTroll[0].devuelto'),true);
assert.equal(run('blindadoTroll(jefe)'),true,'Se abre al llegar el goblin, no antes');
run('avanzar(.6);');
assert.equal(run('heroe.parrys'),1,'Una devolución cuenta un solo parry');
assert.equal(run('blindadoTroll(jefe)'),false);
assert.equal(run('jefe.vida'),460);
assert.equal(run('enemigos.length'),1,'El goblin devuelto no se convierte en refuerzo');
run("limpiar();jefe=crearEnemigo('troll',0,-3);sujetarGoblin(jefe);arrojarGoblin(jefe,{dir:0});avanzar(1.2);");
assert.equal(run('recibido'),24);
assert.equal(run('enemigos.length'),2);
assert.ok(run("enemigos[1].estado==='aturdido'&&enemigos[1].sinBotin"));
run("crearEnemigo('cobrador',2,2);crearEnemigo('cobrador',3,3);");
assert.equal(run('puedeLanzarGoblin(jefe)'),false,'No se añaden goblins a una multitud de cuatro');
console.log('✓ Goblin visible, devolución con parry, refuerzo al aterrizar y límite de población');
run('limpiar();jefe=crearEnemigo("troll",0,-3);sujetarGoblin(jefe);cancelarAtaque(jefe);');
assert.equal(run('jefe.goblinSujeto'),null);
run('lanzarPiedras(jefe,jefe.pos);morir(jefe);');
assert.equal(run('peligrosTroll.length'),0);
assert.equal(run('marcas.length'),0);
assert.equal(run('escena.children.filter(o=>o.geometry===geoRocaTroll).length'),0);
console.log('✓ Interrupción y muerte retiran modelos y peligros pendientes');

// Las piedras admiten el mismo parry que un goblin, incluso en la fase blindada.
run("limpiar();jefe=crearEnemigo('troll',0,-3);jefe.vida=550;activarFaseTroll(jefe);lanzarPiedras(jefe,jefe.pos);bajoPrimeraPiedra();heroe.estado='parry';heroe.t=.05;avanzar(1.45);");
assert.equal(run('recibido'),0,'Parry de piedra evita el daño');
assert.equal(run('peligrosTroll[0].devuelto'),true,'La piedra vuelve al ogro');
assert.equal(run('blindadoTroll(jefe)'),true,'El blindaje se abre cuando llega la piedra');
run('avanzar(.6);');
assert.equal(run('blindadoTroll(jefe)'),false);
assert.equal(run('jefe.vida'),460);
assert.equal(run('heroe.parrys'),1);
run("limpiar();jefe=crearEnemigo('troll',0,-3);lanzarPiedras(jefe,jefe.pos);bajoPrimeraPiedra();heroe.estado='parry';heroe.t=.3;avanzar(1.45);");
assert.ok(run('recibido>0&&recibido<22'),'El bloqueo tardío reduce daño');
assert.equal(run('peligrosTroll.some(p=>p.devuelto)'),false,'El bloqueo no devuelve piedras');
console.log('✓ Piedras: parry, devolución, apertura de armadura y bloqueo tardío');

run("limpiar();jefe=crearEnemigo('troll',0,-3);lanzarPiedras(jefe,jefe.pos);avanzar(.5);");
assert.equal(run('peligrosTroll[0].marca.m.material.uniforms.uC.value.getHex()'),0xff6030);
run('avanzar(.5);');
assert.equal(run('peligrosTroll[0].marca.m.material.uniforms.uC.value.getHex()'),0xff8438,'No anticipa el dorado fuera de la ventana de parry');
run('avanzar(.21);');
assert.equal(run('peligrosTroll[0].marca.m.material.uniforms.uC.value.getHex()'),0xffd050,'Dorado durante la ventana de parry');
run('Object.assign(heroe.cd,{salto:4,provocar:8,esquiva:1.05,parry:.4});parryPerfecto(null,new V3());');
assert.ok(run('Object.values(heroe.cd).every(t=>t===0)'), 'Parry perfecto refresca todos los cooldowns');
console.log('✓ Círculos naranja y dorado sólo durante el parry; refresco de habilidades');

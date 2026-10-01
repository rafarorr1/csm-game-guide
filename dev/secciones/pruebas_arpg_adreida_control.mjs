/* Controles reales de Adreida: carga, cancelación y corrección aérea sin GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const s=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
const c=vm.createContext({console});c.window=c;
vm.runInContext(fs.readFileSync(new URL('./visor-three-vendor.js',import.meta.url),'utf8'),c);
const extraer=(n,t='function')=>extraerDeclaracion(s,n,t).texto;
vm.runInContext(`
const V3=CAOZ_THREE.THREE.Vector3,TAU=Math.PI*2,enemigos=[],botines=[],reloj={t:0},rog={abierto:false};
const ent={piloto:false,pendiente:false},ctl={mov:new V3(),atacar:false,apunta:new V3(0,0,6)},mando={activo:false,foco:true},document={hidden:false};
const heroe={};let paron=0,impactos=[];
const aDistancia=()=>heroe.tipo==='mohamed',plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),difAng=(a,b)=>b-a;
const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
const puntoApuntado=()=>ctl.apunta.clone(),amenaza=()=>null,libre=()=>['quieto','andar'].includes(heroe.estado);
const dentroPlaza=()=>{},rechazo=()=>{},marca=()=>{},polvo=()=>{},romperPiso=()=>{},chispas=()=>{},temblar=()=>{};
const golpearEn=(r,a,d,o)=>{impactos.push({d,o});return 0;};
${['VEL','COMBO','HAB','PARRY'].map(n=>extraer(n,'const')).join('\n')}
${['cambiar','usar','iniciarGolpe','iniciarCarga','ajustarSalto','pasoHeroe','separar'].map(n=>extraer(n)).join('\n')}
function reset(){Object.assign(heroe,{tipo:'adreida',pos:new V3(),vivo:true,estado:'quieto',t:0,atq:12,basicos:1,especial:1,furia:100,dir:0,cd:{parry:0,salto:0,esquiva:0},brilloParry:0,escudo:0,invul:0,destello:0,dolor:1,vatq:1,finGolpe:-9,combo:0,carga:0,bloqueoBasico:false,fase:0,paso:0,radio:.4,golpeo:false});impactos=[];paron=0;reloj.t=0;ctl.atacar=false;ctl.mov.set(0,0,0);mando.activo=false;mando.foco=true;document.hidden=false;}
function avanzar(t){const n=Math.round(t*100);for(let i=0;i<n;i++){reloj.t+=.01;pasoHeroe(.01);}}
`,c);
const run=s=>vm.runInContext(s,c);
run('reset();ctl.atacar=true;avanzar(.01);ctl.atacar=false;avanzar(.7)');
assert.equal(run('impactos.length'),1);assert.equal(run('impactos[0].d'),12);
run('ctl.atacar=true;avanzar(.01);ctl.atacar=false;avanzar(.65)');
assert.equal(run('heroe.combo'),1,'Los clics cortos continúan el combo');
run('reset();ctl.atacar=true;avanzar(2)');
assert.equal(run('impactos.length'),0,'Mantener nunca dispara automáticamente');
assert.equal(run('heroe.carga'),1);
run('ctl.atacar=false;avanzar(.7)');
assert.equal(run('impactos.length'),1);assert.equal(run('impactos[0].d'),36);assert.ok(run('impactos[0].o.empuje>=17'),'Empuje contundente a carga completa');
run('reset();ctl.atacar=true;avanzar(.55);ctl.atacar=false;avanzar(.7)');
assert.ok(run('impactos[0].d>12&&impactos[0].d<36'),'Carga parcial proporcional');
for(const estado of ['golpe','carga','torbellino','abanico']){
  run(`reset();heroe.estado='${estado}';heroe.carga=1;paron=.08;ctl.atacar=true;`);
  assert.equal(run("usar('parry')"),true);
  assert.equal(run('paron'),0);assert.equal(run('heroe.carga'),0);
  run('avanzar(.7)');assert.equal(run('impactos.length'),0,'Cancelar elimina impactos pendientes');
  assert.equal(run('heroe.estado'),'quieto','Mantener no reinicia el ataque cancelado');
}
for(const estado of ['salto','esquiva','muerta']){
  run(`reset();heroe.estado='${estado}'`);assert.equal(run("usar('parry')"),false);
}
run('reset();ctl.atacar=true;avanzar(.5);mando.foco=false;ctl.atacar=false;avanzar(.8)');
assert.equal(run('impactos.length'),0,'Perder foco cancela la carga sin atacar');
run('reset();mando.activo=true;ctl.atacar=true;avanzar(.5);mando.activo=false;ctl.atacar=false;avanzar(.8)');
assert.equal(run('impactos.length'),0,'Desconectar mando cancela la carga');
run("reset();usar('parry');ent.pendiente=true;ctl.atacar=true;avanzar(.01)");assert.equal(run('ent.pendiente'),false,'No queda un clic almacenado que bloquee futuras cargas');
run('ctl.atacar=false;avanzar(.5);ctl.atacar=true;avanzar(.01)');assert.equal(run('heroe.estado'),'carga');
run('reset();ctl.mov.set(1,0,0);ctl.atacar=true;avanzar(1.2)');assert.equal(run('heroe.pos.length()'),0,'Inmóvil desde la primera pulsación y durante toda la carga');
run("enemigos.push({pos:new V3(.1,0,0),radio:.4,estado:'quieto',dentro:true});separar()");assert.equal(run('heroe.pos.length()'),0,'Los enemigos no desplazan la carga');run('enemigos.length=0');
console.log('✓ Básico corto, combo, carga parcial/completa, parry prioritario, foco y desconexión');
for(const [pad,mov,esperado] of [[true,-1,4],[true,0,5],[true,1,5],[false,-1,5]]){
  run(`reset();mando.activo=${pad};usar('salto',new V3(0,0,5));ctl.mov.set(0,0,${mov});avanzar(.72)`);
  assert.ok(Math.abs(run('heroe.pos.z')-esperado)<.001);
  assert.equal(run('heroe.estado'),'quieto');assert.equal(run('impactos.length'),1);
  assert.equal(run('heroe.alto'),0);
}
run("reset();mando.activo=true;usar('salto',new V3(0,0,5));ctl.mov.set(0,0,-1);avanzar(.25);ctl.mov.set(0,0,1);avanzar(.47)");
assert.ok(Math.abs(run('heroe.pos.z')-5)<.001,'Adelante recupera la distancia original sin rebasarla');
console.log('✓ Salto de 0,72 s: alcance 4–5 m, freno y recuperación; mouse conserva destino');
// La resolución reacciona a carga sostenida, con límites e histéresis; no altera capturas.
vm.runInContext(`let escalaRender=1,cuadrosLentos=0,cuadrosRapidos=0,redimensionados=0;let CAPTURA=false;function medir(){redimensionados++;}${extraer('ajustarResolucion')}`,c);
run('document.hidden=false;for(let i=0;i<30;i++)ajustarResolucion(25)');assert.ok(Math.abs(run('escalaRender')-.7)<1e-9);
run('for(let i=0;i<60;i++)ajustarResolucion(60)');assert.equal(run('escalaRender'),1);
run('CAPTURA=true;for(let i=0;i<10;i++)ajustarResolucion(20)');assert.equal(run('escalaRender'),1);
console.log('✓ Resolución adaptativa acotada; recupera detalle; capturas sin cambios');
// Una partida cedida o escondida no consume lógica ni dibuja, aunque siga recibiendo RAF.
const pausa=vm.createContext({document:{hidden:false},performance:{now:()=>0}});
vm.runInContext(`let partidaActiva=false,antes=0,fps={n:0,t:0,cpu:0,render:0},cuadrosLentos=0,cuadrosRapidos=0,logica=0,dibujos=0,solicitudes=0;function requestAnimationFrame(){solicitudes++;}function paso(){logica++;}function dibujar(){dibujos++;}${extraer('cuadro')}`,pausa);
vm.runInContext('cuadro(16)',pausa);assert.equal(vm.runInContext('logica+dibujos',pausa),0);
vm.runInContext('partidaActiva=true;document.hidden=true;cuadro(32)',pausa);assert.equal(vm.runInContext('logica+dibujos',pausa),0);
vm.runInContext('document.hidden=false;cuadro(48)',pausa);assert.equal(vm.runInContext('logica+dibujos',pausa),2);
console.log('✓ Las pestañas pausadas no simulan ni renderizan; reanudan correctamente');

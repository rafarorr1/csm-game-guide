/* Objetivos reales de Yuka: roles, persistencia, recambios y coste independiente del render. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console});c.window=c;
for(const f of ['yuka-goals-vendor.js','arpg-three-ia.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const IA=c.CAOZ_ARPG_IA,YUKA=c.CAOZ_YUKA;
const heroe={id:0,pos:{x:0,z:0},dir:0};
function goblin(variante='clasico',z=5){const e={id:1,tipo:'goblin',m:{varianteGoblin:variante},pos:{x:0,z},rodeo:1,cd:0,provocado:0};e.ia=IA.crear(e);return e;}
const decidir=(e,t=0,entra=true,libre=true,H=heroe)=>e.ia.decidir(H,entra,t,()=>libre).accion;
assert.ok(goblin().ia.cerebro instanceof YUKA.Think,'Se usa Think oficial, no un sustituto local');
const cuchillo=goblin('cuchillo');assert.equal(decidir(cuchillo),'flanquear');
const angulo=cuchillo.ia.angulo;heroe.dir=.7;
assert.equal(decidir(cuchillo,.1),'flanquear');assert.equal(cuchillo.ia.angulo,angulo,'Conserva el flanco elegido al girar el jugador');
assert.equal(cuchillo.ia.decisiones,1,'No evalúa por cuadro');
assert.equal(decidir(cuchillo,1.2),'presionar','El flanqueo tiene plazo para no orbitar sin atacar');
assert.equal(decidir(cuchillo,1.5),'presionar','No reanuda el flanqueo inmediatamente');heroe.dir=0;
const bruto=goblin('dosHachas');bruto.cd=2;assert.equal(decidir(bruto),'presionar');
const clasico=goblin();assert.equal(decidir(clasico),'lanzar');
const cubierto=goblin();assert.equal(decidir(cubierto,0,true,false),'flanquear','Busca otro ángulo cuando una cobertura tapa el tiro');
for(const variante of ['clasico','dosHachas','cuchillo','antorcha']){
 const e=goblin(variante);assert.equal(decidir(e,0,false),'cubrir','No entra sin turno');
 assert.notEqual(decidir(e,.01,true),'cubrir','Recibir turno se atiende sin esperar otro intervalo');
 assert.equal(decidir(e,.02,false),'cubrir','Perder turno se atiende inmediatamente');
 e.provocado=1;assert.equal(decidir(e,.03,true),'presionar','Provocar conserva su prioridad');
 const cerca=goblin(variante,1.5);cerca.cd=1;assert.equal(decidir(cerca),'presionar','Descansa en guardia cerca del jugador, sin retroceder');
}
for(const variante of ['cuchillo','antorcha'])assert.notEqual(decidir(goblin(variante)),'lanzar');
for(const tipo of ['can','troll','saqueador','kobold'])assert.equal(IA.crear({...goblin(),tipo}),null,'Primera prueba limitada a goblins y cobradores');
assert.ok(IA.crear({...goblin(),tipo:'cobrador'}));
for(const fps of [20,30,60,144]){
 const e=goblin('cuchillo');e.cd=100;let libre=0;
 for(let i=0;i<fps*10;i++)e.ia.decidir(heroe,true,i/fps,()=>{libre++;return true;});
 assert.ok(e.ia.decisiones>=29&&e.ia.decisiones<=35,`Decisiones espaciadas a ${fps} FPS: ${e.ia.decisiones}`);
 assert.equal(libre,0,'Un cuchillo no necesita trazar la línea de disparo');
 const h=goblin();for(let i=0;i<fps*10;i++)h.ia.decidir(heroe,true,i/fps,()=>{libre++;return true;});
 assert.equal(libre,h.ia.decisiones,'Las comprobaciones de visión también se espacian');
}
const e=goblin('cuchillo');decidir(e);const anterior=e.ia.version;
const segundo={id:1,pos:{x:4,z:2},dir:Math.PI/2};decidir(e,.01,true,true,segundo);
assert.ok(e.ia.version>anterior);assert.equal(e.ia.heroe,segundo,'Nuevo objetivo cooperativo invalida el ángulo anterior');
// El selector real cambia la IA sin cancelar un aviso o reiniciar el combate.
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const ataque={dur:1.05},enemigo={...goblin(),ataque,estado:'aviso',t:.5,vida:17,plan:{},ruta:{puntos:[1,2]}};
Object.assign(c,{enemigos:[enemigo],$(){return {};},URL,location:{href:'http://127.0.0.1/juego?coop=1'},history:{replaceState(){}},document:{querySelectorAll:()=>[]}});
vm.runInContext(extraerDeclaracion(fuente,'configurarIA').texto,c);
c.configurarIA('clasica');assert.equal(enemigo.ia,null);assert.equal(IA.crear(goblin()),null);
c.configurarIA('yuka');assert.ok(enemigo.ia);assert.equal(enemigo.ataque,ataque);assert.equal(enemigo.estado,'aviso');assert.equal(enemigo.t,.5);assert.equal(enemigo.vida,17);assert.equal(enemigo.ruta.puntos.length,2);
assert.throws(()=>IA.configurar('desconocida'));assert.equal(IA.modo(),'yuka');
console.log('✓ Yuka: roles, cobertura, flancos persistentes, turnos, provocación, 20–144 FPS, cambio de objetivo y comparación en vivo sin cancelar ataques');

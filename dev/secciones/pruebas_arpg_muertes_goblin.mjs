/* Coreografías de muerte y golpe letal reales, sin GPU ni motor físico adicional. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const {THREE}=c.CAOZ_THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),v=new THREE.Vector3();
const causas=['tajo','reves','estocada','cargado','torbellino','salto','disparo','abanico','daga','espalda','adreidos','parry'];
assert.deepEqual(Object.keys(F.muertesGoblin),causas);
function suelo(m){m.raiz.updateMatrixWorld(true);let min=Infinity;for(const mesh of m.mallas){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){mesh.applyBoneTransform(i,v.fromBufferAttribute(p,i));min=Math.min(min,v.y);}}return min;}
function foto(m){return Object.entries(m.H).filter(([k])=>k!=='raiz').flatMap(([,h])=>[...h.quaternion.toArray(),...h.position.toArray()]);}
for(const tipo of ['goblin','cobrador']){
 const m=F.crear(tipo),total=m.mallas.reduce((n,x)=>n+x.geometry.attributes.position.count/3,0);
 assert.equal(total,tipo==='goblin'?4652:5004);assert.equal(m.mallas.length,3);
 for(const causa of causas){const variantes=[];
  for(let variante=0;variante<2;variante++){
   const muerte=F.crearMuerteGoblin(causa,variante);assert.ok(muerte.duracion>.8&&muerte.duracion<1.8);let anterior=null;
   for(let i=0;i<=120;i++){
    F.posar(m,{anim:'muerte',k:i/120,muerte,t:i/60});const actual=foto(m);assert.ok(actual.every(Number.isFinite));
    if(anterior)assert.ok(m.H.cuerpo.position.distanceTo(anterior)<.15,`${causa}/${variante}: sin saltos de altura`);anterior=m.H.cuerpo.position.clone();
    if(i%20===0){const min=suelo(m);assert.ok(min>-.035,`${tipo}/${causa}/${variante}/${i}: atraviesa el suelo (${min})`);if(i===120)assert.ok(min<.025,'El cuerpo termina apoyado');}
   }
   const final=foto(m);F.posar(m,{anim:'muerte',k:1,muerte,t:100});assert.deepEqual(foto(m),final,'El cadáver no respira ni cambia al terminar');
   F.posar(m,{anim:'muerte',k:.48,muerte});variantes.push(foto(m));
  }assert.notDeepEqual(variantes[0],variantes[1],causa+': dos coreografías distintas');
 }
 // Entrar desde un golpe mantiene los huesos en dt=0; después completa la caída.
 F.posar(m,{anim:'golpe',estado:'golpe',k:.48,dt:1/60,mezclar:true});const antes=m.H.torso.quaternion.clone();
 F.posar(m,{anim:'muerte',estado:'muere',k:0,muerte:F.crearMuerteGoblin('cargado',0),dt:0,mezclar:true});assert.ok(m.H.torso.quaternion.angleTo(antes)<1e-6);
}
// La primera variante rueda 360° sobre los hombros; la segunda gira 360° sobre su eje acostado.
for(const variante of [0,1]){const p=F.muertesGoblin.cargado[variante],inicio=p.cuadros[2],fin=p.cuadros[3],giro=variante?'giro':'caida';assert.ok(Math.abs(Math.abs(fin[giro]-inicio[giro])-Math.PI*2)<.01);assert.equal(inicio.vuelo,0);assert.equal(fin.vuelo,0);}
console.log('✓ 24 caídas en goblin y cobrador: contacto del suelo, continuidad, pose final inmóvil y una rodada completa; mismas mallas y triángulos');
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto,run=s=>vm.runInContext(s,c);
run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,TAU=Math.PI*2,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),reloj={t:0},rog={bajas:0};
const escena=new THREE.Scene(),enemigos=[],obstaculos=[],PLANOS_MURALLA=[{x:0,z:1},{x:0,z:-1},{x:1,z:0},{x:-1,z:0}],ABIERTO=false,R=26;
let heroe={id:0,pos:new V3(0,0,-3),dir:0},golpesPolvo=0,paron=0;
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const numero=()=>{},brasas=()=>{},cancelarAtaque=e=>e.ataque=null,limpiarPeligrosTroll=()=>{},activarFaseTroll=()=>{},blindadoTroll=()=>false,rnd=()=>.5,polvo=()=>golpesPolvo++;
${['cambiar','danar','morir','avanzarCaidaGoblin','dentroPlaza','pasoEnemigo'].map(n=>get(n)).join('\n')}
function blanco(){const e={tipo:'goblin',pos:new V3(),dir:Math.PI,m:MOD.crear('goblin'),d:{},vida:10,estado:'quieto',emp:new V3(),sinBotin:true,radio:.3,provocado:0,destello:0,cd:0,dentro:true,fase:0,paso:0};enemigos.push(e);escena.add(e.m.raiz);return e;}
`);
for(const causa of causas){run(`var e=blanco();danar(e,100,{exacto:true,causa:'${causa}',direccion:new V3(1,0,0)});`);assert.equal(run('e.muerte.tipo'),causa);assert.equal(run('e.estado'),'muere');assert.equal(run('e.emp.length()'),0);assert.ok(Math.abs(run('e.muerte.angulo'))<Math.PI+1e-8);const m=run('e.muerte');run("danar(e,100,{causa:'disparo'});morir(e)");assert.equal(run('e.muerte'),m,'Otro impacto no reinicia ni cambia la muerte');}
for(const hz of [30,60,120]){
 run("enemigos.length=0;golpesPolvo=0;e=blanco();danar(e,100,{exacto:true,causa:'cargado',direccion:new V3(1,0,0)});e.muerte={...e.muerte,...MOD.crearMuerteGoblin('cargado',0)};");
 for(let i=0;i<hz*2;i++)run(`if(enemigos.includes(e))pasoEnemigo(e,1/${hz})`);
 assert.ok(Math.abs(run('e.pos.x')-2.3)<1e-8,'Recorrido independiente de FPS');assert.equal(run('golpesPolvo'),1);assert.equal(run('enemigos.includes(e)'),true,'No desaparece durante la rodada');
 for(let i=0;i<hz;i++)run(`if(enemigos.includes(e))pasoEnemigo(e,1/${hz})`);assert.equal(run('enemigos.includes(e)'),false,'Limpieza después de caer, descansar y desvanecerse');
}
run("e=blanco();obstaculos.push({x:1.4,z:0,r:.6});danar(e,100,{exacto:true,causa:'cargado',direccion:new V3(1,0,0)});e.t=1;avanzarCaidaGoblin(e)");assert.ok(run('e.pos.x<.3'));assert.equal(run('e.muerte.bloqueada'),true);
run("obstaculos.length=0;e=blanco();e.pos.x=25.4;danar(e,100,{exacto:true,causa:'cargado',direccion:new V3(1,0,0)});e.t=1;avanzarCaidaGoblin(e)");assert.ok(run('e.pos.x<=25.42'));
run("e=blanco();heroe.pos.set(20,0,20);danar(e,100,{exacto:true,causa:'adreidos',origen:new V3(0,0,-2)})");assert.ok(run('e.muerte.direccion.z>.99'),'Adreidos empuja desde su propia posición');
console.log('✓ Golpe letal inmutable, origen del aliado, 30/60/120 FPS, freno ante pozo/muralla, polvo único y limpieza tras la animación');

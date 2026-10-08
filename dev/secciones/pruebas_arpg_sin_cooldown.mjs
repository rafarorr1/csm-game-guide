/* Poderes sin recarga: ejecuta sus estados, costes e invocaciones reales sin GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const get=(n,t='function')=>extraerDeclaracion(n==='libre'?fuente.slice(fuente.indexOf('const libre=()=>')):fuente,n,t).texto;
const c=vm.createContext({console,tutorial:null,casaGoblin:null,cinematicaTroll:null,finalMago:null,enTutorial:()=>false,impactoFX:{agujero(){}}});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c);
run(`
const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,TAU=Math.PI*2,escena=new THREE.Scene(),enemigos=[],botines=[],jugadores=[],reloj={t:0},pausa={activa:false},rog={abierto:false};
let heroe,ent={},ctl={},mando={},disparosPendientes=[],paron=0,creados=0;
const MOD={animacion:CAOZ_ARPG_ADREIDA_ANIMACION.fabrica(THREE),posar(){},crear(){creados++;return {radio:.42,raiz:new THREE.Group(),caja:new THREE.Group(),H:{manoI:new THREE.Group()},M:{u:{uBorde:{value:0},uColorB:{value:new THREE.Color()}}}};}};
const cuerpoDe=()=>MOD.crear(),aDistancia=()=>heroe.tipo==='mohamed';
const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),frente=a=>new V3(Math.sin(a),0,Math.cos(a)),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
const puntoApuntado=()=>heroe.pos.clone().add(new V3(0,0,5)),amenaza=()=>null,rnd=()=>.5;
const respetarMuralla=()=>{},dentroPlaza=()=>{},rechazo=()=>{},marca=()=>{},polvo=()=>{},romperPiso=()=>{},chispas=()=>{},temblar=()=>{},numero=()=>{},particula=()=>{},golpearEn=()=>0;
const etiqueta=(tipo,pos)=>({pos,el:{textContent:''}}),quitarEtiqueta=()=>{},liberarModeloTroll=m=>m.raiz.removeFromParent(),pasoLibreEnemigo=()=>true;
const lanzarBumeran=h=>{h.bumeran={};},document={hidden:false};
${['VEL','COMBO','HAB','PARRY','HEROES','TORBELLINO','libre','aliados','DESTINO'].map(n=>get(n,'const')).join('\n')}
${['crearHeroe','conHeroe','cambiar','usar','ajustarSalto','orientarAdreida','pasoHeroe','pasoTorbellino','lanzarUlti','pasoAliados','limpiarAliados','disparar'].map(n=>get(n)).join('\n')}
function preparar(tipo='adreida'){
 limpiarAliados();jugadores.length=0;reloj.t=0;paron=0;creados=0;
 heroe=crearHeroe(tipo);Object.assign(heroe,{estado:'quieto',t:0,furia:100});ent=heroe.entrada;ctl=heroe.control;mando=heroe.mando;disparosPendientes=heroe.disparosPendientes;mando.foco=true;
 return heroe;
}
function avanzar(s){for(let t=0;t<s-1e-10;){const dt=Math.min(.01,s-t);reloj.t+=dt;pasoHeroe(dt);t+=dt;}}
`);
assert.ok(run('Object.values(HAB).every(h=>h.cd===0)&&PARRY.cd===0&&Object.values(HEROES).every(h=>h.cdUlti===0)'),'Todos los poderes tienen recarga cero');
assert.equal(run('HAB.salto.coste'),25);assert.equal(run('HAB.torbellino.coste'),30);
for(const tipo of ['adreida','mohamed'])for(const [habilidad,duracion] of [['parry',.35],['esquiva',.2],['salto',.72],['torbellino',tipo==='adreida'?1.35:.3],...(tipo==='mohamed'?[['provocar',.7]]:[])]){
 run(`preparar('${tipo}');`);
 assert.equal(run(`usar('${habilidad}')`),true,`${tipo}/${habilidad}: primer uso`);
 run('avanzar(.06);');const tiempo=run('heroe.t'),furia=run('heroe.furia');
 assert.equal(run(`usar('${habilidad}')`),false,'No reinicia la habilidad en curso');
 assert.equal(run('heroe.t'),tiempo);assert.equal(run('heroe.furia'),furia,'El intento durante la animación no cobra otra vez');
 run(`avanzar(${duracion}-.06+.01);`);
 assert.equal(run('heroe.estado'),'quieto',`${tipo}/${habilidad}: conserva su duración`);
 assert.ok(run('Object.values(heroe.cd).every(t=>t===0)'));
 assert.equal(run(`usar('${habilidad}')`),true,`${tipo}/${habilidad}: se repite al terminar`);
 if(['salto','torbellino'].includes(habilidad))assert.equal(run('heroe.furia'),100-2*run(`HAB.${habilidad}.coste`),'Cada uso conserva el coste de Furia');
}
for(const tipo of ['adreida','mohamed'])for(const habilidad of ['salto','torbellino']){
 run(`preparar('${tipo}');heroe.furia=HAB.${habilidad}.coste-1;`);
 assert.equal(run(`usar('${habilidad}')`),false,'Sigue exigiendo Furia suficiente');assert.equal(run('heroe.estado'),'quieto');
}
run("preparar();usar('bumeran');avanzar(.47);");
assert.equal(run("usar('bumeran')"),false,'El hacha debe regresar antes de volver a lanzarla');
run('heroe.bumeran=null;');assert.equal(run("usar('bumeran')"),true,'El hacha recuperada no impone recarga adicional');
for(const factor of [.4,1,1.15]){
 run(`preparar();heroe.dash=${factor};usar('esquiva');avanzar(.21);`);
 assert.equal(run('heroe.cd.esquiva'),0,'Los antiguos modificadores de dash no reintroducen recarga');assert.equal(run("usar('esquiva')"),true);
}
console.log('✓ Poderes repetibles tras su animación, sin reinicios; Furia, regreso del hacha y parry al aire conservados');

run("var dueno=preparar();usar('ulti');var aliado=aliados[0],posicion=aliado.pos.clone(),modelo=aliado.m;aliado.vida=2;aliado.atacando=true;aliado.t=.25;aliado.cd=.6;heroe.pos.set(8,0,8);");
for(let i=0;i<100;i++)assert.equal(run("usar('ulti')"),true);
assert.equal(run('aliados.length'),1);assert.equal(run('aliados[0]===aliado&&aliado.m===modelo'),true);
assert.equal(run('creados'),2,'Cien repeticiones reutilizan el modelo del aliado');
assert.equal(run('aliado.pos.equals(posicion)&&aliado.atacando&&aliado.t===.25&&aliado.cd===.6'),true,'Renovar no teletransporta ni reinicia el ataque');
assert.equal(run('aliado.vida'),15);assert.equal(run('heroe.ultiT'),15);assert.equal(run('heroe.cd.ulti'),0);
run("var segundo=crearHeroe('adreida');Object.assign(segundo,{estado:'quieto',t:0});conHeroe(segundo,()=>{for(let i=0;i<100;i++)usar('ulti');});");
assert.equal(run('aliados.length'),2);assert.equal(run('aliados.filter(a=>a.dueno===dueno).length'),1);assert.equal(run('aliados.filter(a=>a.dueno===segundo).length'),1,'Límite independiente por héroe');
run('pasoAliados(15);');assert.equal(run('aliados.length'),0,'Los aliados siguen venciendo a los 15 segundos');
assert.equal(run("conHeroe(dueno,()=>usar('ulti'))"),true);assert.equal(run('aliados.length'),1,'Puede invocar otro tras expirar');

run("preparar('mohamed');usar('ulti');var daga=heroe.daga;avanzar(3);");
assert.ok(Math.abs(run('heroe.sigilo')-7)<1e-8);
for(let i=0;i<100;i++)assert.equal(run("usar('ulti')"),true);
assert.equal(run('heroe.sigilo'),10);assert.equal(run('heroe.ultiT'),10);assert.equal(run('heroe.cd.ulti'),0);
assert.equal(run('heroe.daga===daga&&heroe.m.H.manoI.children.length===1'),true,'Renovar Velo azul no duplica la daga');
run('avanzar(10.01);');assert.equal(run('heroe.sigilo'),0);assert.equal(run('heroe.ultiT'),0);
console.log('✓ Cien recasts de ulti por héroe: Adreidos único con ataque intacto y Velo azul renovado a 10 s');

run("preparar('mohamed');ctl.atacar=true;avanzar(.01);");assert.equal(run('heroe.balas'),5);run('avanzar(.1);');assert.equal(run('heroe.balas'),5,'Conserva la cadencia de disparo');
run('avanzar(1.3);');assert.equal(run('heroe.balas'),0);assert.equal(run('heroe.disparos'),6);assert.ok(run('heroe.recargaT>0'),'La munición conserva su recarga');
run('ctl.atacar=false;avanzar(1.11);');assert.equal(run('heroe.balas'),6);
run('var semilla=1,ofertas=[];for(let i=0;i<100;i++)ofertas.push(...DESTINO.repartir(n=>(semilla=(Math.imul(semilla,1664525)+1013904223)>>>0)%n));');
assert.ok(run("ofertas.some(c=>c.id==='sombrero')&&ofertas.every(c=>c.stat!=='dash')"),'Las cartas nuevas no ofrecen una reducción de recarga sin efecto');
assert.ok(run("ofertas.filter(c=>c.id==='sombrero').every(c=>c.stat==='rapidez'&&c.bueno>0)"),'Sombrero mejora velocidad de ataque');
assert.equal(run("DESTINO.factores([{stat:'dash',valor:-60}]).dash"),.4,'Conserva compatibilidad con efectos de dash existentes');
console.log('✓ Munición y cadencia de Mohamed intactas; Sombrero útil sin recargas y efectos antiguos compatibles');

/* El dorado corresponde a la ventana jugable: límites reales del parry y de sus avisos. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console});c.window=c;
vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c);
run(`
const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,reloj={t:0},escena=new THREE.Scene();
const heroe={id:0,pos:new V3(0,0,2),dir:Math.PI,estado:'parry',t:0,vivo:true,radio:.4,invul:0};
const jugadores=[heroe],conHeroe=(h,f)=>f();let resultado=null;
const cambiar=(e,s)=>{e.estado=s;e.t=0;},cancelarAtaque=e=>e.ataque=null;
const parryPerfecto=()=>resultado='perfecto',bloqueado=()=>resultado='bloqueo',herir=()=>resultado='daño';
const marca=()=>{},polvo=()=>{},temblar=()=>{};
const frente=a=>new V3(Math.sin(a),0,Math.cos(a));
const geoMarca=new THREE.PlaneGeometry(2,2),geoLinea=new THREE.PlaneGeometry(1,1);
const etiqueta=()=>({pos:new V3(),el:{textContent:'',classList:{toggle(){}},style:{setProperty(){}}}});
${['PARRY','matMarca'].map(n=>get(n,'const')).join('\n')}
${['matZona','empezarAtaque','colocarAtaque','enZona','parar','resolverAtaque'].map(n=>get(n)).join('\n')}
function crear(forma,dur=.55,fase2=false){
 reloj.t=0;const e={tipo:'troll',fase2,pos:new V3(),dir:0,m:{alto:3}};
 empezarAtaque(e,forma,{dur,radio:3,ang:1,largo:6,ancho:1,centro:new V3(),dano:10,
  zonas:forma==='conos'?[0,Math.PI/3].map(dir=>({forma:'cono',centro:new V3(),dir,radio:3,ang:.5})):null});
 return e;
}
function colores(e){return (e.ataque.zonas?e.ataque.m.children:[e.ataque.m]).map(m=>m.material.uniforms.uC.value.getHex());}
`);
assert.ok(Math.abs(run('PARRY.perfecto')-.18*1.05)<1e-12,'Parry cuerpo a cuerpo ampliado exactamente un 5 %');
assert.ok(Math.abs(run('PARRY.perfectoLanza')-.25*1.05)<1e-12,'Parry de proyectiles ampliado exactamente un 5 %');
for(const ventana of ['perfecto','perfectoLanza']){
 for(const [delta,esperado] of [[-1e-6,'perfecto'],[0,'perfecto'],[1e-6,'bloqueo']]){
  run(`heroe.t=PARRY.${ventana}+(${delta});`);
  assert.equal(run(`parar(new V3(),false,PARRY.${ventana})`),esperado,`${ventana}, límite ${delta}`);
  assert.equal(run(`parar(new V3(),true,PARRY.${ventana})`),null,'Un imparable nunca se puede parar');
 }
}
for(const forma of ['cono','conos'])for(const dur of [.55,1.05,1.5])for(const fase2 of [false,true]){
 run(`var e=crear('${forma}',${dur},${fase2});e.ataque.fijado=true;`);
 for(const [delta,dorado] of [[-1e-6,false],[0,true],[1e-6,true]]){
  run(`reloj.t=e.ataque.t0+e.ataque.dur-PARRY.perfecto+(${delta});colocarAtaque(e);`);
  assert.ok(Array.from(run('colores(e)')).every(color=>(color===0xffd050)===dorado),`${forma}, ${dur}, fase2=${fase2}: el dorado depende del tiempo restante`);
 }
}
for(const forma of ['circulo','linea'])for(const fijado of [false,true]){
 run(`e=crear('${forma}');e.ataque.fijado=${fijado};reloj.t=e.ataque.dur-.01;colocarAtaque(e);`);
 assert.notEqual(run('colores(e)[0]'),0xffd050,`${forma}: fijar el ataque no lo vuelve parable`);
 const color=run('e.ataque.m.material.uniforms.uC.value');
 assert.ok(forma==='circulo'?color.b>color.r&&color.r>color.g:color.r>color.g&&color.g>color.b,`${forma} conserva su color ${forma==='circulo'?'morado':'rojo'}`);
}
// El impacto puede caer entre dos cuadros. Se juzga el parry en ese instante,
// aunque el cuadro que lo resuelve ya haya consumido la fracción restante.
for(const hz of [20,30,60,120,144])for(const [desfase,esperado] of [[0,'perfecto'],[1e-6,'bloqueo']]){
 run(`e=crear('cono',1.05);resultado=null;var retraso=.75/${hz};reloj.t=e.ataque.dur+retraso;heroe.t=PARRY.perfecto+retraso+${desfase};resolverAtaque(e);`);
 assert.equal(run('resultado'),esperado,`${hz} FPS: evalúa el parry en el impacto, desfase ${desfase}`);
}
run("e=crear('cono');resultado=null;reloj.t=e.ataque.dur+.025;heroe.t=.01;resolverAtaque(e);");
assert.equal(run('resultado'),'daño','Un parry iniciado después del impacto no lo bloquea retroactivamente');
console.log('✓ Ventanas +5 %, límites de parry y dorado en conos/Can; círculos imparables y líneas sin falso dorado');

/* Caídas FBX reales: ambos tipos, cuatro variantes, suelo y coste de reproducción. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console,atob});c.window=c;c.prepararLlaveDelUltimo=()=>{};
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),v=new T.Vector3();
assert.equal(F.muertesGoblinImportadas.length,4);
const foto=m=>Object.values(m.H).flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]);
let minimo=Infinity,maximo=-Infinity,poses=0;
for(const tipo of ['goblin','cobrador'])for(const variante of [0,1,2,3])for(const varianteGoblin of Object.keys(F.VARIANTES_GOBLIN)){
  const m=F.crear(tipo,{varianteGoblin}),compartido=F.crear(tipo,{varianteGoblin}),original=m.mallas[0].geometry,pesos=original.attributes.skinWeight.array.slice(),tri=original.index.count;
  const muerte=F.crearMuerteGoblin('cargado',variante),posar=(m,k)=>F.posar(m,{anim:'muerte',muerte,k,t:100});
  assert(muerte.importada);assert(!muerte.partido);
  let antes=null,geometria=null;
  for(let i=0;i<=120;i++){
    posar(m,i/120);m.raiz.updateMatrixWorld(true);poses++;
    geometria??=m.mallas[0].geometry;assert.equal(m.mallas[0].geometry,geometria,'Reutiliza la geometría corregida');
    const p=m.H.cuerpo.position.clone();if(antes)assert(p.distanceTo(antes)<.15,'Sin saltos de raíz al caer');antes=p;
    let min=Infinity,max=-Infinity;
    for(const mesh of m.mallas){const g=mesh.geometry,indices=g.index?[...new Set(g.index.array)]:Array.from({length:g.attributes.position.count},(_,j)=>j);
      for(const j of indices){mesh.getVertexPosition(j,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<2.5,'Piel sin vértices disparados');min=Math.min(min,v.y);max=Math.max(max,v.y);}
    }
    minimo=Math.min(minimo,min);maximo=Math.max(maximo,min);
    assert(min>-.015&&min<.035,`${tipo}/${varianteGoblin}/${variante}, fase ${i/120}: contacto ${min}`);
    if(i===120)assert(max<.70,`${tipo}/${varianteGoblin}/${variante}: termina tumbado (${max})`);
  }
  const final=foto(m);posar(m,12);assert.deepEqual(foto(m),final,'Retiene la pose final');
  assert.equal(original.index.count,tri);assert.deepEqual(original.attributes.skinWeight.array,pesos,'No modifica pesos compartidos');assert.equal(compartido.mallas[0].geometry,original);
  for(let i=0;i<geometria.attributes.skinWeight.count;i++){const w=geometria.attributes.skinWeight.array.subarray(i*4,i*4+4);assert(Math.abs(w.reduce((s,v)=>s+v,0)-1)<1e-5,'Pesos normalizados');}
  F.posar(m,{anim:'quieto',t:0});assert.equal(m.mallas[0].geometry,original,'Restaura la malla al salir de la caída');assert(Math.abs(m.H.cuerpo.position.z)<1e-6);
  posar(m,.4);assert.equal(m.mallas[0].geometry,geometria);
  F.posar(m,{anim:'andar',fase:.5,paso:1,t:0});assert.equal(m.mallas[0].geometry,original);
  // El contacto está horneado: reproducir no debe consultar vértices.
  m.mallas.forEach(mesh=>mesh.getVertexPosition=()=>{throw Error('Barrido de malla en partida');});posar(m,.75);
  const local=F.desplazamientoMuerteGoblin(m,muerte,1,new T.Vector3());posar(m,1);assert(Math.abs(local.x-m.H.cuerpo.position.x)<1e-6&&Math.abs(local.z-m.H.cuerpo.position.z)<1e-6);
  muerte.desplazamientoExterno=true;posar(m,1);assert.equal(m.H.cuerpo.position.x,0);assert.equal(m.H.cuerpo.position.z,0);
}
console.log(`✓ Cuatro muertes FBX: ${poses} poses, goblin y cobrador, cuatro variantes, suelo ${minimo.toFixed(4)}…${maximo.toFixed(4)} m; finales inmóviles, geometrías compartidas, sin barridos de vértices.`);

// El golpe letal del combate elige una sola caída y respeta su recorrido y duración.
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),get=n=>extraerDeclaracion(fuente,n).texto,run=s=>vm.runInContext(s,c);
run(`const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,TAU=Math.PI*2,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),reloj={t:0},rog={bajas:0};
const escena=new THREE.Scene(),enemigos=[],obstaculos=[],PLANOS_MURALLA=[{x:0,z:1},{x:0,z:-1},{x:1,z:0},{x:-1,z:0}],ABIERTO=false,R=26;
let heroe={id:0,pos:new V3(0,0,-3),dir:0},particulasPolvo=[],paron=0;
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
let azarPrueba=.5;const numero=()=>{},brasas=()=>{},cancelarAtaque=e=>e.ataque=null,limpiarPeligrosTroll=()=>{},activarFaseTroll=()=>{},blindadoTroll=()=>false,rnd=()=>azarPrueba,particula=(...p)=>particulasPolvo.push(p);
${['cambiar','danar','morir','avanzarCaidaGoblin','dentroPlaza','pasoEnemigo'].map(get).join('\n')}
function blanco(tipo='goblin'){const e={tipo,pos:new V3(),dir:.63,m:MOD.crear(tipo),d:{},vida:10,estado:'quieto',emp:new V3(),sinBotin:true,radio:.3,provocado:0,destello:0,cd:0,dentro:true,fase:0,paso:0};enemigos.push(e);escena.add(e.m.raiz);return e;}
`);
const reparto=[0,0,0,0];
for(let i=0;i<100;i++){
 run(`azarPrueba=${i/100};var e=blanco();danar(e,100,{exacto:true,causa:'cargado',cargaCompleta:true});`);
 const muerte=run('e.muerte');reparto[muerte.variante]++;assert(muerte.importada);assert(!muerte.partido);assert.equal(muerte.tipo,'cargado');
 run("danar(e,100,{causa:'disparo'});morir(e)");assert.equal(run('e.muerte'),muerte,'Impactos posteriores no sortean otra caída');
}assert.deepEqual(reparto,[25,25,25,25]);
for(const tipo of ['goblin','cobrador'])for(const variante of [0,1,2,3])for(const hz of [30,60,120]){
 run(`enemigos.length=0;particulasPolvo=[];azarPrueba=${(variante+.5)/4};e=blanco('${tipo}');danar(e,100,{exacto:true,causa:'disparo'});`);
 const muerte=run('e.muerte'),esperado=run('MOD.desplazamientoMuerteGoblin(e.m,e.muerte,1,new V3()).applyAxisAngle(new V3(0,1,0),e.dir)');
 for(let i=0;i<Math.ceil(muerte.duracion*hz);i++)run(`pasoEnemigo(e,1/${hz})`);
 assert(run('e.pos').distanceTo(esperado)<1e-6,'El avance del FBX coincide a 30/60/120 FPS');assert(run('enemigos.includes(e)'),'Retiene el cadáver al acabar el clip');
 assert.equal(run('e.m.M.u.uDisuelve.value'),0,'No desvanece durante la animación');assert.equal(run('e.muerte.contactosEmitidos'),1);
 const polvo=run('particulasPolvo.length');assert(polvo>=4&&polvo<=8,'Nube breve al tocar el piso');
 for(let i=0;i<hz*1.3;i++)run(`if(enemigos.includes(e))pasoEnemigo(e,1/${hz})`);
 assert.equal(run('enemigos.includes(e)'),false,'Limpieza tras el descanso y desvanecimiento');assert.equal(run('particulasPolvo.length'),polvo,'El polvo no se repite');
}
// El cadáver no atraviesa un obstáculo ni sigue deslizando después de chocar.
run("enemigos.length=0;azarPrueba=.4;e=blanco();morir(e);var fin=MOD.desplazamientoMuerteGoblin(e.m,e.muerte,1,new V3()).applyAxisAngle(new V3(0,1,0),e.dir);obstaculos.push({x:fin.x,z:fin.z,r:.4});");
for(let i=0;i<120;i++)run('e.t=e.muerte.duracion*(1+e.t/e.muerte.duracion)/2;avanzarCaidaGoblin(e)');
assert.equal(run('e.muerte.bloqueada'),true);const parado=run('e.pos.clone()');run('e.t=100;avanzarCaidaGoblin(e)');assert(run('e.pos').equals(parado));
console.log('✓ Sorteo 25/25/25/25, golpe letal inmutable, dos tipos, recorrido y limpieza a 30/60/120 FPS, polvo único y colisiones.');

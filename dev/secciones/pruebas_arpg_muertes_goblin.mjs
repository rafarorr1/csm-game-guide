/* Coreografías de muerte y golpe letal reales, sin GPU ni motor físico adicional. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const {THREE}=c.CAOZ_THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),v=new THREE.Vector3();
const causas=['tajo','reves','estocada','cargado','torbellino','salto','disparo','abanico','daga','espalda','adreidos','parry'];
assert.deepEqual(Object.keys(F.muertesGoblin),causas);
function suelo(m){m.raiz.updateMatrixWorld(true);let min=Infinity;for(const mesh of m.mallas){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){mesh.applyBoneTransform(i,v.fromBufferAttribute(p,i));min=Math.min(min,v.y);}}return min;}
function apoyoDelCuerpo(m){m.raiz.updateMatrixWorld(true);const limites=Object.fromEntries(['cadera','torso','cabeza'].map(n=>[n,{min:Infinity,max:-Infinity}]));
 for(const mesh of m.mallas)for(let i=0;i<mesh.geometry.attributes.position.count;i++){const hueso=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)],nombre=Object.keys(limites).find(n=>m.H[n]===hueso);if(!nombre)continue;
  mesh.applyBoneTransform(i,v.fromBufferAttribute(mesh.geometry.attributes.position,i));limites[nombre].min=Math.min(limites[nombre].min,v.y);limites[nombre].max=Math.max(limites[nombre].max,v.y);}
 for(const [nombre,l]of Object.entries(limites)){assert.ok(l.min<.065,`${m.tipo}/${nombre}: el cuerpo queda en el suelo, no suspendido desde el arma (${l.min})`);assert.ok(l.max<.46,`${nombre}: termina acostado`);}
}
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
   apoyoDelCuerpo(m);const final=foto(m);F.posar(m,{anim:'muerte',k:1,muerte,t:100});assert.deepEqual(foto(m),final,'El cadáver no respira ni cambia al terminar');
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
let heroe={id:0,pos:new V3(0,0,-3),dir:0},particulasPolvo=[],paron=0;
const frente=a=>new V3(Math.sin(a),0,Math.cos(a)),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
let azarPrueba=.5;const numero=()=>{},brasas=()=>{},cancelarAtaque=e=>e.ataque=null,limpiarPeligrosTroll=()=>{},activarFaseTroll=()=>{},blindadoTroll=()=>false,rnd=()=>azarPrueba,particula=(...p)=>particulasPolvo.push(p);
${['cambiar','danar','morir','avanzarCaidaGoblin','dentroPlaza','pasoEnemigo'].map(n=>get(n)).join('\n')}
function blanco(){const e={tipo:'goblin',pos:new V3(),dir:Math.PI,m:MOD.crear('goblin'),d:{},vida:10,estado:'quieto',emp:new V3(),sinBotin:true,radio:.3,provocado:0,destello:0,cd:0,dentro:true,fase:0,paso:0};enemigos.push(e);escena.add(e.m.raiz);return e;}
`);
for(const causa of causas){run(`var e=blanco();danar(e,100,{exacto:true,causa:'${causa}',direccion:new V3(1,0,0)});`);assert.equal(run('e.muerte.tipo'),causa);assert.equal(run('e.estado'),'muere');assert.equal(run('e.emp.length()'),0);assert.ok(Math.abs(run('e.muerte.angulo'))<Math.PI+1e-8);const m=run('e.muerte');run("danar(e,100,{causa:'disparo'});morir(e)");assert.equal(run('e.muerte'),m,'Otro impacto no reinicia ni cambia la muerte');}
for(const hz of [30,60,120]){
 run("enemigos.length=0;particulasPolvo=[];e=blanco();danar(e,100,{exacto:true,causa:'cargado',direccion:new V3(1,0,0)});e.muerte={...e.muerte,...MOD.crearMuerteGoblin('cargado',0)};");
 for(let i=0;i<hz*2;i++)run(`if(enemigos.includes(e))pasoEnemigo(e,1/${hz})`);
 assert.ok(Math.abs(run('e.pos.x')-2.3)<1e-8,'Recorrido independiente de FPS');assert.equal(run('e.muerte.contactosEmitidos'),1);assert.equal(run('particulasPolvo.length'),14,'Seis partículas al caer y ocho de roce, independientes de FPS');assert.equal(run('enemigos.includes(e)'),true,'No desaparece durante la rodada');
 for(let i=0;i<hz;i++)run(`if(enemigos.includes(e))pasoEnemigo(e,1/${hz})`);assert.equal(run('enemigos.includes(e)'),false,'Limpieza después de caer, descansar y desvanecerse');
}
run("e=blanco();obstaculos.push({x:1.4,z:0,r:.6});danar(e,100,{exacto:true,causa:'cargado',direccion:new V3(1,0,0)});e.t=1;avanzarCaidaGoblin(e)");assert.ok(run('e.pos.x<.3'));assert.equal(run('e.muerte.bloqueada'),true);
run("obstaculos.length=0;e=blanco();e.pos.x=25.4;danar(e,100,{exacto:true,causa:'cargado',direccion:new V3(1,0,0)});e.t=1;avanzarCaidaGoblin(e)");assert.ok(run('e.pos.x<=25.42'));
run("e=blanco();heroe.pos.set(20,0,20);danar(e,100,{exacto:true,causa:'adreidos',origen:new V3(0,0,-2)})");assert.ok(run('e.muerte.direccion.z>.99'),'Adreidos empuja desde su propia posición');
console.log('✓ Golpe letal inmutable, origen del aliado, 30/60/120 FPS, freno ante pozo/muralla, polvo de impacto/roce acotado y limpieza tras la animación');

// El centro avanza durante la vuelta y nunca describe el arco de un pivote colocado en los pies.
for(const variante of [0,1]){const m=F.crear('goblin'),muerte=F.crearMuerteGoblin('cargado',variante),r=muerte.rodada;
 assert.ok(F.recorridoMuerteGoblin(muerte,r.inicio)<muerte.distancia*.21);
 assert.ok(F.recorridoMuerteGoblin(muerte,r.fin)-F.recorridoMuerteGoblin(muerte,r.inicio)>muerte.distancia*.79);
 const inicio=F.muertesGoblin.cargado[variante].cuadros[2],fin=F.muertesGoblin.cargado[variante].cuadros[3],giro=variante?'giro':'caida';
 for(let i=0;i<=50;i++){const k=r.inicio+(r.fin-r.inicio)*i/50,w=(i/50)**2*(3-2*i/50),esperado=muerte.distancia*(.2+.8*w);
  assert.ok(Math.abs(F.recorridoMuerteGoblin(muerte,k)-esperado)<1e-8,'Ángulo y desplazamiento usan el mismo progreso');
  F.posar(m,{anim:'muerte',k,muerte});m.raiz.updateMatrixWorld(true);m.H.cadera.getWorldPosition(v);assert.ok(Math.hypot(v.x,v.z)<1e-7,'La cadera no va y viene durante el giro');
 }
 assert.ok(Math.abs(Math.abs(fin[giro]-inicio[giro])-Math.PI*2)<.01);
}
let nube=[];const emitir=(...p)=>nube.push(p);F.emitirPolvoMuerte(new THREE.Vector3(),.3,null,emitir,()=>.5);assert.equal(nube.length,0,'Una caída lenta no levanta polvo');
F.emitirPolvoMuerte(new THREE.Vector3(),3,null,emitir,()=>.5);assert.ok(nube.length>=6&&nube.length<=8);assert.ok(nube.every(p=>p[1]<.1&&p[4]<.6&&p[6]<.7),'Polvo bajo y breve');
run("particulasPolvo=[];e=blanco();danar(e,100,{exacto:true,causa:'daga'});e.t=1.5;avanzarCaidaGoblin(e)");assert.equal(run('particulasPolvo.length'),0);
run("particulasPolvo=[];e=blanco();danar(e,100,{exacto:true,causa:'salto'});e.t=e.muerte.duracion;avanzarCaidaGoblin(e)");const polvoFinal=run('particulasPolvo.length');assert.ok(polvoFinal>=10);run('avanzarCaidaGoblin(e)');assert.equal(run('particulasPolvo.length'),polvoFinal,'Los impactos no repiten polvo al quedar inmóvil');
console.log('✓ Torso, cadera y cabeza apoyados en 48 finales; rodada sincronizada al avance y al pivote; polvo sólo con impulso y al tocar el suelo');

// Sólo el cargado completo puede separar al goblin; el umbral del sorteo es 33 %.
for(const azar of [0,.12,.329,.33,.7,.999])for(const completa of [false,true]){
 run(`azarPrueba=${azar};e=blanco();danar(e,100,{exacto:true,causa:'cargado',cargaCompleta:${completa}})`);
 assert.equal(!!run('e.muerte.partido'),completa&&azar<.33);run('azarPrueba=.5');
}
for(const tipo of ['goblin','cobrador'])for(const variante of [0,1]){
 const m=F.crear(tipo),muerte={...F.crearMuerteGoblin('cargado',variante),partido:true};
 const arriba=new Set();m.H.torso.traverse(b=>arriba.add(b));
 for(let i=0;i<=60;i++){
  F.posar(m,{anim:'muerte',muerte,k:i/60,t:i/60});m.raiz.updateMatrixWorld(true);
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(const mesh of m.mallas)for(let j=0;j<mesh.geometry.attributes.position.count;j++){
   const grupo=arriba.has(mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(j)])?1:0;
   mesh.applyBoneTransform(j,v.fromBufferAttribute(mesh.geometry.attributes.position,j));min[grupo]=Math.min(min[grupo],v.y);max[grupo]=Math.max(max[grupo],v.y);
  }
  assert.ok(min.every(y=>Number.isFinite(y)&&y>-.035),'Las dos mitades no atraviesan el piso');
  if(i===60){assert.ok(min.every(y=>y<.025),'Ambas mitades terminan apoyadas');assert.ok(max.every(y=>y<.65),'Las dos mitades quedan tumbadas');}
 }
 F.posar(m,{anim:'quieto'});assert.equal(m.H.torso.position.x,0);assert.equal(m.H.torso.position.y,m.p.cintura);
}
console.log('✓ Corte al 33 % sólo con carga completa; dos mitades apoyadas y restablecimiento del modelo');

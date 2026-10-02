/* Muerte de Can: huida real, portones, obstáculos y retirada fuera del encuadre. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
vm.runInContext(`
const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,MOD=CAOZ_ARPG_MODELOS.fabrica(THREE),TAU=Math.PI*2,FACTOR_COOP=2;
const enemigos=[],jugadores=[{pos:new V3(),radio:.4,vivo:true,dir:0,entrada:{}}],heroe=jugadores[0],ent=heroe.entrada;
const escena=new THREE.Scene(),reloj={t:0},obstaculos=[{x:-5,z:-3,r:1.3},{x:-2.82,z:-2.51,r:.55}],CALLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6];
const rog={vuelta:1,bajas:0},ol={cola:[['goblin',0],['kobold',1],['cobrador',2]],lote:2},seleccion={m:{visible:true}};
let ABIERTO=false,sigId=1,semilla=11,botines=0,ataques=0;
const rnd=()=>(semilla=semilla*16807%2147483647)/2147483647,frente=a=>new V3(Math.sin(a),0,Math.cos(a)),calle=a=>new V3(Math.cos(a),0,Math.sin(a));
const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),difAng=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const cambiar=(e,s)=>{e.estado=s;e.t=0;},cancelarAtaque=e=>e.ataque=null,activarFaseTroll=()=>{},limpiarPeligrosTroll=()=>{},brasas=()=>{};
const soltar=()=>{botines++;},soltarDestino=soltar,globo=soltar,empezarAtaque=()=>{ataques++;},banner=()=>{};
const cuerpoDe=(tipo,variante)=>{const m=MOD.crear(tipo,{varianteGoblin:variante});m.caja={userData:{}};escena.add(m.raiz);return m;};
const camara=new THREE.PerspectiveCamera(70,16/9,.1,500);camara.position.set(0,100,.01);camara.lookAt(0,0,0);camara.updateMatrixWorld();
${['R','PANELES','DEF','RITMO','presion','refuerzosCan','frustumHuida'].map(n=>get(n,'const')).join('\n')}
${['dentroPlaza','separar','sectorLibre','crearEnemigo','pasoLibreEnemigo','buscarRutaEnemigo','destinoEnemigo','asustarGoblins','retirarHuidosFueraDeCamara','liberarModeloTroll','morir','pasoEnemigo'].map(n=>get(n)).join('\n')}
`,c);
const run=s=>vm.runInContext(s,c);
run(`var can=crearEnemigo('can',0,0);can.sinBotin=true;var goblins=[];
for(let i=0;i<12;i++){const a=i*TAU/12,e=crearEnemigo(i%2?'goblin':'cobrador',Math.sin(a)*8,Math.cos(a)*8);dentroPlaza(e.pos,e.radio);e.estado=i%2?'aviso':'aturdido';e.ataque={dur:1};presion.primeraLinea.add(e.id);goblins.push(e);}
var arquero=crearEnemigo('kobold',2,2);refuerzosCan.push({t:5},{t:6});morir(can);`);
assert.equal(run('goblins.filter(e=>e.estado===\'huye\').length'),12);
assert.equal(run('goblins.some(e=>e.ataque||presion.primeraLinea.has(e.id))'),false);
assert.equal(run('refuerzosCan.length'),0);assert.equal(run('ol.cola.length'),1);assert.equal(run('ol.cola[0][0]'),'kobold');
assert.equal(run('arquero.estado'),'entra','Sólo los goblins huyen');
run('retirarHuidosFueraDeCamara();');assert.equal(run('enemigos.length'),14,'No desaparecen en pantalla ni durante la reacción inicial');
const resultado=run(`{let violaciones=0,penetraciones=0,salidas=0;for(let i=0;i<3000&&goblins.some(e=>e.estado==='huye');i++){
 reloj.t+=1/30;presion.rutas=0;
 for(const e of goblins){if(e.estado!=='huye')continue;if(i===40)cambiar(e,'aturdido');pasoEnemigo(e,1/30);
  if(e.estado==='huye'&&Math.hypot(e.pos.x,e.pos.z)>R+1){salidas++;const ang=Math.atan2(e.pos.z,e.pos.x);if(!CALLES.some(a=>Math.abs(difAng(ang,a))<.105))violaciones++;}
  if(obstaculos.some(o=>Math.hypot(e.pos.x-o.x,e.pos.z-o.z)<o.r+e.radio-.02))penetraciones++;
 }separar();retirarHuidosFueraDeCamara();
 }({violaciones,penetraciones,salidas,restantes:goblins.filter(e=>enemigos.includes(e)).length,ataques,botines});}`);
assert.ok(resultado.salidas>0);assert.equal(resultado.violaciones,0,'Cruzan portones, no paños de la muralla');assert.equal(resultado.penetraciones,0,'Rodean el pozo');
assert.equal(resultado.restantes,0);assert.equal(resultado.ataques,0);assert.equal(resultado.botines,0);
console.log('✓ Can: doce goblins huyen por puertas, rodean el pozo, no vuelven al combate y desaparecen sin botín al salir de cuadro');
// Un cuerpo sobre el borde sigue visible aunque su centro ya esté fuera.
run(`var borde=crearEnemigo('goblin',0,0);cambiar(borde,'huye');borde.t=1;camara.position.set(0,10,.001);camara.lookAt(0,0,0);camara.updateMatrixWorld();borde.pos.set(12.5,0,0);`);
run('retirarHuidosFueraDeCamara();');assert.ok(run('enemigos.includes(borde)'),'El margen conserva cuerpo y arma');
run('borde.pos.x=18;retirarHuidosFueraDeCamara();');assert.equal(run('enemigos.includes(borde)'),false);
for(const variante of ['clasico','dosHachas','cuchillo','antorcha']){
 const MOD=c.CAOZ_ARPG_MODELOS.fabrica(c.CAOZ_THREE.THREE),m=MOD.crear('goblin',{varianteGoblin:variante});
 for(let i=0;i<90;i++){MOD.posar(m,{anim:'huir',estado:'huye',fase:i*.2,paso:1,t:i/30,dt:1/30,mezclar:true});m.raiz.updateMatrixWorld(true);for(const h of Object.values(m.H))assert.ok(h.matrixWorld.elements.every(Number.isFinite));}
}
console.log('✓ Retirada conserva el margen del modelo y las cuatro variantes tienen una pose de huida válida');

// Una desviación por separación puede dejarlo a 2 cm del siguiente punto de ruta.
run(`var cercano=crearEnemigo('goblin',-5,-5);cambiar(cercano,'huye');cercano.huida={entrada:new V3(-5,0,-1),salida:new V3(-5,0,40),direccion:new V3(0,0,1),cruzando:false};
cercano.ruta={destino:cercano.huida.entrada.clone(),hasta:reloj.t+100,puntos:[new V3(-4.98,0,-5),new V3(-4.98,0,-1)]};presion.rutas=0;pasoEnemigo(cercano,1/30);`);
assert.ok(run('cercano.pos.distanceTo(new V3(-5,0,-5))')>.015,'La tolerancia de movimiento coincide con la de llegada al punto de ruta');
console.log('✓ Sigue avanzando si la separación lo deja a centímetros de un punto de ruta');

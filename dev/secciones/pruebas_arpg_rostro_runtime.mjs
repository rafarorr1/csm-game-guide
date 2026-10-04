/* Contrato facial: instancias, búsqueda de cuadros, mirada y conservación del agarre. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,atob});c.window=c;
vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
const fuente=fs.readFileSync(new URL('arpg-three-rostro-adreida.js',import.meta.url),'utf8');vm.runInContext(fuente,c);
const {THREE}=c.CAOZ_THREE,canales=Array.from(c.CAOZ_ARPG_ROSTRO_ADREIDA.canales);
const codificar=(a,T=Float32Array)=>Buffer.from(new T(a).buffer).toString('base64');
const base={posicion:codificar([-.05,.10,.08,.05,.10,.08,0,.20,.08]),normal:codificar([0,0,1,0,0,1,0,0,1]),uv:codificar([0,0,1,0,.5,1]),triangulos:codificar([0,1,2],Uint16Array)};
const morphs=Object.fromEntries(canales.map((n,i)=>[n,{posicion:codificar([0,0,0,0,0,0,0,-.002*(i+1),0]),normal:codificar(Array(9).fill(0))}]));
c.CAOZ_ADREIDA_ROSTRO_DATOS={canales,mallas:[{...base,nombre:'Piel',tipo:'piel',morphs},{...base,nombre:'Ojo izquierdo',tipo:'ojos',ojo:'I',centro:[.04,.15,.09]}]};
const F=c.CAOZ_ARPG_ROSTRO_ADREIDA.fabrica(THREE);
function modelo(){
  const H={cabeza:new THREE.Group()},M={hacer:p=>new THREE.MeshStandardMaterial(p)},cuerpo=new THREE.Mesh(),hacha=new THREE.Mesh();
  cuerpo.morphTargetInfluences=[.75,.40];H.cabeza.rotation.set(.1,.2,-.1);const m={H,mallas:[cuerpo,hacha]};m.rostro=F.montar(H,M,m.mallas);return m;
}
const m=modelo(),otro=modelo(),r=m.rostro;
assert.equal(m.mallas[0].morphTargetInfluences[0],.75,'El cuerpo conserva su índice y su agarre');
assert.equal(m.mallas.length,4);assert.equal(r.mallas[0],m.mallas[2]);assert.equal(r.mallas[0].parent,m.H.cabeza);
assert.equal(r.mallas[0].geometry,otro.rostro.mallas[0].geometry,'Geometría compartida');
assert.notEqual(r.mallas[0].material,otro.rostro.mallas[0].material,'Efectos propios de cada actor');
assert.notEqual(r.mallas[0].morphTargetInfluences,otro.rostro.mallas[0].morphTargetInfluences,'Expresiones independientes');
assert(r.mallas.every(x=>x.userData.rostro&&x.geometry.userData.compartida));
const head=m.H.cabeza.quaternion.clone();
for(const expresion of Object.keys(F.expresiones)){
  F.posar(m,{expresion,t:2.5,parpadeo:false,mirada:[0,0]});
  const pesos=Array.from(r.mallas[0].morphTargetInfluences);
  assert(pesos.every(x=>Number.isFinite(x)&&x>=0&&x<=1),expresion+': pesos válidos');
  if(expresion!=='neutral')assert(pesos.some(x=>x>.1),expresion+': tiene actuación');
}
assert(m.H.cabeza.quaternion.equals(head),'Las expresiones no cambian la actuación corporal');
assert.deepEqual(m.mallas[0].morphTargetInfluences,[.75,.40],'No se alteran los correctivos del agarre');
assert(otro.rostro.mallas[0].morphTargetInfluences.every(x=>x===0),'Adreidos no copia la expresión de Adreida');
// El mismo cuadro debe verse igual tras reproducir o buscar otros cuadros en cualquier orden.
for(const anim of ['quieto','andar','tajoA','parry','dolor','muerte'])for(const t of [0,2.3,3.17,7.79,15.34]){
  const pose={anim,t,k:.43,potencia:.6};F.posar(m,pose);const esperado=F.capturar(m),valores=r.mallas[0].morphTargetInfluences.slice();
  F.posar(m,{anim:'grito',t:t+100,k:.7});F.posar(m,{anim:'dolor',t:0,k:.1});F.posar(m,pose);
  assert.deepEqual(F.capturar(m),esperado,anim+': búsqueda determinista');assert.deepEqual(r.mallas[0].morphTargetInfluences,valores);
}
F.posar(m,{expresion:'neutral',parpadeo:false,mirada:{x:.5,y:-.5}});
assert.equal(r.pesos.eyesLookLeft,.5);assert.equal(r.pesos.eyesLookDown,.5);
assert(Math.abs(r.ojos[0].rotation.y-.175)<1e-9);assert(Math.abs(r.ojos[0].rotation.x-.12)<1e-9);
F.posar(m,{expresion:'neutral',t:3.17,parpadeo:true,rostro:{}});assert.equal(r.pesos.eyeBlinkLeft,1,'El párpado llega a cerrar durante el parpadeo');
F.posar(m,{expresion:'neutral',t:3.17,parpadeo:false,rostro:{}});assert.equal(r.pesos.eyeBlinkLeft,0,'El visor puede congelar el parpadeo');
// Los overrides del plano mantienen la emoción, pero no reabren los ojos a mitad del cierre.
const emocionCine={eyeWideLeft:.25,eyeWideRight:.20,eyeSquintLeft:.15,eyeSquintRight:.18,jawOpen:.24};
F.posar(m,{expresion:'miedo',t:3.17,parpadeo:true,rostro:emocionCine});
for(const lado of ['Left','Right']){
  assert.equal(r.pesos['eyeBlink'+lado],1,'El parpadeo de cine cierra ambos ojos');
  assert.equal(r.pesos['eyeWide'+lado],0,'La apertura manual no compite con el cierre');
  assert.equal(r.pesos['eyeSquint'+lado],0,'La tensión del párpado no se suma al cierre');
}
assert.equal(r.pesos.jawOpen,.24,'Parpadear no elimina la actuación de la boca');
F.posar(m,{expresion:'miedo',t:2.5,parpadeo:true,rostro:emocionCine});
for(const [canal,peso]of Object.entries(emocionCine))assert.equal(r.pesos[canal],peso,'La emoción vuelve completa entre parpadeos');
F.posar(m,{expresion:'miedo',t:3.17,parpadeo:false,rostro:{...emocionCine,eyeBlinkLeft:.5}});
for(const [canal,peso]of Object.entries(emocionCine))assert.equal(r.pesos[canal],peso,'El visor conserva el control manual cuando desactiva el parpadeo automático');
assert.equal(r.pesos.eyeBlinkLeft,.5);
F.posar(m,{expresion:'ira',intensidadExpresion:.5,parpadeo:false,mirada:[0,0]});assert.equal(r.pesos.browDownLeft,F.expresiones.ira.browDownLeft*.5);
F.posar(m,{expresion:'neutral',rostro:{jawOpen:7,eyeBlinkLeft:NaN,eyeBlinkRight:-1,eyesLookUp:Infinity}});
assert.equal(r.pesos.jawOpen,1);assert.equal(r.pesos.eyeBlinkLeft,0);assert.equal(r.pesos.eyeBlinkRight,0);assert.equal(r.pesos.eyesLookUp,0);
const capturada=F.capturar(m);F.posar(m,{expresion:'tristeza',parpadeo:false});F.restaurar(m,capturada);assert.deepEqual(F.capturar(m),capturada,'Restaurar vuelve a los mismos canales');
F.posar(m,{expresion:'neutral',rostro:{jawOpen:0}});const desde=F.capturar(m);F.posar(m,{expresion:'neutral',rostro:{jawOpen:1}});F.mezclar(m,desde,.5);assert.equal(r.pesos.jawOpen,.5);
// El contrato también se cumple al montar el cuerpo y las cinemáticas reales.
for(const f of ['adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-brazos-rigged/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js','arpg-three-final-mago.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c,{filename:f});
const MOD=c.CAOZ_ARPG_MODELOS.fabrica(THREE),real=MOD.crear('adreida'),cineActor=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(THREE,MOD),fps=cineActor.crearFPS();
assert(real.rostro&&real.mallas[0].isSkinnedMesh);assert.equal(real.mallas[0].morphTargetDictionary['Agarre I'],0);
assert.equal(MOD.crear('adreida',{modeloAdreida:'clasico'}).rostro,null,'La alternativa clásica no recibe otra cabeza');
assert(fps.rostro.mallas.every(x=>!x.visible),'La cabeza y los ojos no tapan los brazos FPS');
cineActor.fps(fps,new THREE.PerspectiveCamera(),1,3.17);assert(fps.rostro.mallas.every(x=>!x.visible),'Posar no vuelve a mostrar la cabeza FPS');
MOD.posar(real,{anim:'quieto',expresion:'miedo',parpadeo:false});const pose=cineActor.capturar(real);
MOD.posar(real,{anim:'tajoA',k:.3});cineActor.restaurar(real,pose);assert.deepEqual(MOD.rostro.capturar(real),pose.rostro,'La captura de actuación restaura la cara');
const escena=new THREE.Scene(),camara=new THREE.PerspectiveCamera(32,16/9,.5,1200),casas=new THREE.Group();escena.add(casas);
const casa=new THREE.Mesh(new THREE.BoxGeometry(6,7,5).toNonIndexed(),new THREE.MeshStandardMaterial());casa.position.set(5,3.5,-17);casas.add(casa);
casas.userData.ocultacion={cajas:[new THREE.Box3().setFromObject(casa)],opacidades:new Float32Array([1])};
const actor={tipo:'adreida',vivo:true,m:real,pos:new THREE.Vector3(10,0,10),dir:0,fase:0};escena.add(real.raiz);
MOD.posar(real,{anim:'quieto',expresion:'tristeza',parpadeo:false});const antesCine=MOD.rostro.capturar(real);
const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(THREE,MOD,{escena,camara,casas,impactar(){},interfaz(){},volver(){}});
cine.iniciar([actor],{puerta:actor.pos.clone()});const cuadros=new Map();
for(let i=0;i<1200&&!cine.estado().terminado;i++){
  cine.paso(1/30);const e=cine.estado();
  if(e.t>.1&&!cuadros.has(e.fase))cuadros.set(e.fase,cine.capturarCuadro());
  if(e.pov)assert(cine.recursos.brazosFPS.rostro.mallas.every(x=>!x.visible));
}
assert(cine.estado().terminado,'La actuación facial no detiene la cinemática');
for(const [fase,expresion]of Object.entries({salida:'desconfianza',carrera:'ira',tropezar:'dolor',buscar:'desconfianza',cielo:'miedo',caida:'miedo'})){
  const cuadro=cuadros.get(fase);assert(cuadro,fase+': hay un cuadro verificable');assert.equal(cuadro.rostros[0].expresion,expresion);
  cine.mostrarCuadro(cuadro);assert.deepEqual(MOD.rostro.capturar(real),cuadro.rostros[0],'El editor restaura los canales de '+fase);
  const cara=MOD.rostro.capturar(real);camara.position.set(-17,5,20);camara.lookAt(0,1,0);cine.vistaEditor(true);cine.respirarCamara()?.();
  assert.deepEqual(MOD.rostro.capturar(real),cara,'Mover cámara/keyframes no mueve la cara de '+fase);
}
cine.cancelar();assert.deepEqual(MOD.rostro.capturar(real),antesCine,'Cancelar devuelve la expresión anterior del jugador');
// El runtime puede cargarse en las herramientas clásicas sin requerir la cabeza nueva.
delete c.CAOZ_ADREIDA_ROSTRO_DATOS;assert.equal(c.CAOZ_ARPG_ROSTRO_ADREIDA.fabrica(THREE).montar(m.H,{hacer(){}},[]),null);
assert.equal(c.CAOZ_ARPG_MODELOS.fabrica(THREE).crear('adreida').rostro,null,'Sin datos nuevos se conserva el cuerpo anterior');
console.log('✓ Rostro: nueve expresiones, 30 búsquedas reproducibles, instancias independientes, mirada, parpadeo, restauración y agarre intacto.');
console.log('✓ Integración: cabeza oculta en FPS, actuación del mago, caché facial independiente de cámara y restauración al cancelar.');

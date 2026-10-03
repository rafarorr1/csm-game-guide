/* Clima: coste acotado, colocación, relojes independientes y ciclo de vida del audio. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const contexto=vm.createContext({console,atob});contexto.window=contexto;
for(const f of ['visor-three-vendor.js','arpg-three-impactos.js','arpg-three-clima.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),contexto);
const T=contexto.CAOZ_THREE.THREE;
const obstaculos=[{x:-5,z:-3,r:1.3},{x:0,z:0,r:2}],techos=[new T.Box3(new T.Vector3(3,0,3),new T.Vector3(8,6,8))];
function preparar(opciones={}){const escena=new T.Scene(),impactos=contexto.CAOZ_ARPG_IMPACTOS.fabrica(T,escena);return {escena,clima:contexto.CAOZ_ARPG_CLIMA.fabrica(T,escena,{obstaculos,techos,perforar:impactos.perforar,...opciones})};}
function avanzar(c,s,hz=60){let pico=0;for(let i=0;i<Math.round(s*hz);i++)pico=Math.max(pico,c.paso(1/hz,{x:0,z:0}));return pico;}
for(const hz of [20,30,60,144]){
 const {escena,clima}=preparar();assert.equal(escena.children.length,3);assert.equal(clima.estado().gotas,440);assert.equal(clima.estado().charcos,28);
 const agua=escena.getObjectByName('Charcos de lluvia'),p=agua.geometry.attributes.position;
 for(let i=0;i<p.count;i+=4){let x=0,z=0;for(let j=0;j<4;j++){x+=p.getX(i+j)/4;z+=p.getZ(i+j)/4;assert.equal(p.getY(i+j)>0,true);}
  for(const o of obstaculos)assert.ok(Math.hypot(x-o.x,z-o.z)>o.r);
  assert.ok(!(x>3&&x<8&&z>3&&z<8),'No hay charcos bajo el edificio');}
 const shader={vertexShader:agua.material.vertexShader,fragmentShader:agua.material.fragmentShader,uniforms:{}};agua.material.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('uHuecos'),'Los cráteres también recortan el agua');assert.ok(shader.uniforms.uHuecos);
 const atributos=escena.getObjectByName('Lluvia ligera').geometry.attributes;avanzar(clima,13,hz);assert.equal(clima.estado().truenos,0);
 const t=clima.estado().tiempo;clima.pausar(true);avanzar(clima,20,hz);assert.equal(clima.estado().tiempo,t,'Pausar no adelanta el clima');clima.pausar(false);
 assert.ok(avanzar(clima,4,hz)>.95,'Resplandor gradual');assert.equal(clima.estado().truenos,0,'El trueno llega después del destello');
 avanzar(clima,8,hz);assert.equal(clima.estado().truenos,1);assert.equal(escena.children.length,3);assert.equal(escena.getObjectByName('Lluvia ligera').geometry.attributes,atributos);
 clima.configurar({activo:false});assert.ok(escena.children.every(n=>!n.visible));const antes=clima.estado().tiempo;avanzar(clima,60,hz);assert.equal(clima.estado().tiempo,antes);
 clima.configurar({activo:true});assert.ok(escena.children.every(n=>n.visible));clima.destruir();assert.equal(escena.children.length,0);
}
{const {clima}=preparar({reducido:true,abierto:true});assert.equal(clima.estado().gotas,220);assert.equal(clima.estado().charcos,130);assert.equal(avanzar(clima,70),0,'Movimiento reducido evita los destellos');assert.ok(clima.estado().truenos>=2);clima.destruir();}
// La estela coincide con el desplazamiento de una gota; también con ráfagas y distintos FPS.
{const {escena,clima}=preparar();const lluvia=escena.getObjectByName('Lluvia ligera'),u=lluvia.material.uniforms;
 for(let i=0;i<600;i++){clima.paso(1/60,{x:0,z:0});const t=clima.estado().tiempo,a=contexto.CAOZ_ARPG_CLIMA.derivaViento(t,new T.Vector2()),b=contexto.CAOZ_ARPG_CLIMA.derivaViento(t-.028,new T.Vector2());
  assert.ok(u.uCola.value.distanceTo(a.sub(b))<1e-9,'Cola: recorrido exacto de los últimos 28 ms');
  assert.ok(u.uCola.value.x/.028>5.7&&u.uCola.value.x/.028<10.3,'Viento sostenido en la misma dirección');}
 const referencia=contexto.CAOZ_ARPG_CLIMA.derivaViento(10,new T.Vector2());
 for(const hz of [20,30,144]){const otro=preparar();avanzar(otro.clima,10,hz);assert.ok(otro.escena.getObjectByName('Lluvia ligera').material.uniforms.uDeriva.value.distanceTo(referencia)<1e-8,'El viento no depende de FPS');otro.clima.destruir();}
 assert.equal(escena.getObjectByName('Salpicaduras de lluvia').geometry.attributes.position.count,880,'220 impactos reutilizables en una malla');
 clima.destruir();}
// Audio simulado sólo para verificar recursos y pausas; la compilación visual se revisa en navegador.
let creado=0;const fuentes=[];
const parametro=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
const nodo=()=>({connect(){},disconnect(){},gain:parametro(),frequency:parametro(),pan:parametro(),playbackRate:parametro()});
class AudioPrueba{
 constructor(){creado++;this.state='suspended';this.sampleRate=8000;this.currentTime=0;this.destination={};}
 createGain(){return nodo();}createBiquadFilter(){return nodo();}createStereoPanner(){return nodo();}
 createBuffer(c,n){const canales=Array.from({length:c},()=>new Float32Array(n));return {getChannelData:i=>canales[i]};}
 createBufferSource(){const f={...nodo(),start(){this.iniciado=true;},stop(t){this.final=t;if(t===undefined)this.onended?.();}};fuentes.push(f);return f;}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}
contexto.AudioContext=AudioPrueba;
{const {clima}=preparar();assert.equal(creado,0,'No se crea audio sin gesto');clima.desbloquearAudio();await new Promise(resolve=>setImmediate(resolve));assert.equal(creado,1);assert.equal(clima.estado().audio,'running');
 avanzar(clima,25);assert.equal(clima.estado().voces,1);assert.equal(fuentes.length,2,'Una lluvia continua y un trueno');
 clima.pausar(true);assert.equal(clima.estado().audio,'suspended');const t=clima.estado().tiempo;avanzar(clima,30);assert.equal(clima.estado().tiempo,t);
 clima.pausar(false);await new Promise(resolve=>setImmediate(resolve));assert.equal(clima.estado().audio,'running');
 clima.configurar({sonido:false});assert.equal(clima.estado().audio,'suspended');assert.equal(clima.estado().voces,0,'Silenciar elimina el trueno pendiente');
 clima.configurar({sonido:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(clima.estado().audio,'running');clima.desbloquearAudio();assert.equal(creado,1,'No se duplican contexto ni bucle');
 clima.destruir();assert.equal(clima.estado().audio,'closed');}
console.log('OK: lluvia/charcos a 20/30/60/144 FPS; techos, cráteres, movimiento reducido, pausas, audio y recursos acotados.');

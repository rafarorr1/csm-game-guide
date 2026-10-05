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
// Una partida recién abierta nunca pasa por cinematica(). Vector4() dejaría
// w=1: sólo la cola recibiría la expulsión de 6.4 m y formaría una telaraña.
for(const reducido of [false,true]){const {escena,clima}=preparar({reducido}),lluvia=escena.getObjectByName('Lluvia ligera'),u=lluvia.material.uniforms,a=lluvia.geometry.attributes;
 const normal=()=>{
  assert.equal(clima.estado().portal,null);assert.deepEqual(Array.from(u.uFuerzaPortal.value.toArray()),[0,0,0,0],'Cabeza y cola nacen sin gravedad, antes de abrir cualquier cinemática');
  for(let i=0;i<lluvia.geometry.drawRange.count;i+=2){
   assert.deepEqual([a.aSemilla.getX(i),a.aSemilla.getY(i),a.aSemilla.getZ(i)],[a.aSemilla.getX(i+1),a.aSemilla.getY(i+1),a.aSemilla.getZ(i+1)],'Los extremos pertenecen a la misma gota');
   assert.equal(a.aExtremo.getX(i),0);assert.equal(a.aExtremo.getX(i+1),1);
   const rapidez=12+a.aSemilla.getX(i)*.075,recorrido=new T.Vector3(-u.uCola.value.x,rapidez*.028,-u.uCola.value.y);
   assert(recorrido.y>0&&recorrido.length()<.6,'La cola sin portal es sólo el recorrido corto de los últimos 28 ms');
  }
 };
 normal();for(let i=0;i<120;i++){clima.paso(1/60,{x:i/60,z:4});normal();}
 clima.cinematica(12,{x:2,z:4},{portal:{centro:[2,8,-10],edad:1.45,soltar:1.316}});assert(u.uFuerzaPortal.value.length()>0);
 clima.cinematica(null,{x:2,z:4});normal();clima.paso(1/60,{x:2,z:4});normal();clima.destruir();
}
for(const hz of [20,30,60,144]){
 const {escena,clima}=preparar();assert.equal(escena.children.length,3);assert.equal(clima.estado().gotas,638);assert.equal(clima.estado().charcos,28);
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
{const {clima}=preparar({reducido:true,abierto:true});assert.equal(clima.estado().gotas,319);assert.equal(clima.estado().charcos,130);assert.equal(avanzar(clima,70),0,'Movimiento reducido evita los destellos');assert.ok(clima.estado().truenos>=2);clima.destruir();}
// La estela coincide con el desplazamiento de una gota; también con ráfagas y distintos FPS.
{const {escena,clima}=preparar();const lluvia=escena.getObjectByName('Lluvia ligera'),u=lluvia.material.uniforms;
 for(let i=0;i<600;i++){clima.paso(1/60,{x:0,z:0});const t=clima.estado().tiempo,a=contexto.CAOZ_ARPG_CLIMA.derivaViento(t,new T.Vector2()),b=contexto.CAOZ_ARPG_CLIMA.derivaViento(t-.028,new T.Vector2());
  assert.ok(u.uCola.value.distanceTo(a.sub(b))<1e-9,'Cola: recorrido exacto de los últimos 28 ms');
  assert.ok(u.uCola.value.x/.028>5.7&&u.uCola.value.x/.028<10.3,'Viento sostenido en la misma dirección');}
 const referencia=contexto.CAOZ_ARPG_CLIMA.derivaViento(10,new T.Vector2());
 for(const hz of [20,30,144]){const otro=preparar();avanzar(otro.clima,10,hz);assert.ok(otro.escena.getObjectByName('Lluvia ligera').material.uniforms.uDeriva.value.distanceTo(referencia)<1e-8,'El viento no depende de FPS');otro.clima.destruir();}
 assert.equal(escena.getObjectByName('Salpicaduras de lluvia').geometry.drawRange.count,1914,'La partida dibuja 319 impactos en la misma malla');
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

// Lluvia suspendida por el mago; la búsqueda temporal es absoluta y reversible.
{const {escena,clima}=preparar();const u=escena.getObjectByName('Lluvia ligera').material.uniforms;
 clima.cinematica(0,{x:2,z:3});const congelada=u.uDeriva.value.clone();avanzar(clima,4);assert.equal(u.uT.value,0);assert.equal(clima.estado().tiempo,0);assert(u.uDeriva.value.equals(congelada));assert(u.uCola.value.length()>0,'Las gotas detenidas mantienen la diagonal del viento');
 clima.cinematica(2,{x:2,z:3});assert.equal(u.uT.value,2);assert(!u.uDeriva.value.equals(congelada));const futuro=u.uDeriva.value.clone();
 clima.pausar(true);clima.cinematica(.5,{x:2,z:3});assert.equal(u.uT.value,.5,'El editor puede buscar mientras el audio está pausado');clima.cinematica(2,{x:2,z:3});assert(u.uDeriva.value.equals(futuro));
 clima.cinematica(0,{x:2,z:3});assert(u.uDeriva.value.equals(congelada),'Volver antes de la desaparición congela exactamente las mismas gotas');
 clima.configurar({activo:false});clima.cinematica(3,{x:2,z:3});assert(escena.children.every(n=>!n.visible),'Se respeta la preferencia de desactivar lluvia');
 clima.cinematica(null);assert.equal(clima.estado().tiempoCine,null);clima.configurar({activo:true});clima.pausar(false);avanzar(clima,1);assert(Math.abs(u.uT.value-1)<1e-8);clima.destruir();}
console.log('OK: suspensión, liberación, búsqueda reversible del clima y restauración de la partida.');

// La cinemática intensifica la lluvia sin cambiar los charcos ni asignar geometrías al recorrerla.
for(const reducido of [false,true]){
 const {escena,clima}=preparar({reducido}),base=reducido?319:638,cine=Math.round(base*1.4);
 const lluvia=escena.getObjectByName('Lluvia ligera').geometry,salpicaduras=escena.getObjectByName('Salpicaduras de lluvia').geometry;
 const semillas=lluvia.attributes.aSemilla,agua=escena.getObjectByName('Charcos de lluvia').geometry.attributes.position;
 const charcos=agua.array.slice();
 assert.equal(lluvia.drawRange.count,base*2);
 for(const t of [0,2,6,.5,0,15]){
  clima.cinematica(t,{x:3,z:-2});assert.equal(clima.estado().gotas,cine);
  assert.equal(lluvia.drawRange.count,cine*2);assert.equal(salpicaduras.drawRange.count,Math.ceil(cine/2)*6);
  assert.equal(lluvia.attributes.aSemilla,semillas);assert.deepEqual(agua.array,charcos);assert.equal(escena.children.length,3);
 }
 clima.cinematica(null);assert.equal(clima.estado().gotas,base);assert.equal(lluvia.drawRange.count,base*2);
 assert.equal(salpicaduras.drawRange.count,Math.ceil(base/2)*6);clima.destruir();
}
console.log('OK: 45% más de lluvia general y cinematográfica, recursos reutilizados y densidad de partida al salir.');

// El hechizo aumenta densidad y viento durante tres segundos, sin integrar por pasos.
for(const reducido of [false,true]){
 const creadosAntes=creado,fuentesAntes=fuentes.length,{escena,clima}=preparar({reducido}),base=reducido?319:638,cine=Math.round(base*1.4),maximo=reducido?761:1523;
 const lluvia=escena.getObjectByName('Lluvia ligera'),salpicaduras=escena.getObjectByName('Salpicaduras de lluvia'),u=lluvia.material.uniforms;
 const atributos=lluvia.geometry.attributes,charcos=escena.getObjectByName('Charcos de lluvia').geometry.attributes.position.array.slice();
 assert.equal(atributos.position.count,maximo*2,'La tormenta usa una reserva fija de gotas');
 const foco={x:3,z:-2},foto=()=>JSON.stringify({deriva:u.uDeriva.value.toArray(),cola:u.uCola.value.toArray(),fuerza:u.uTormenta.value,densidad:u.uGotas.value,gotas:lluvia.geometry.drawRange.count,salpicaduras:salpicaduras.geometry.drawRange.count});
 const capturas=new Map();let cantidadAnterior=cine;
 for(const edad of [-1,0,.5,1.5,3,4,9]){
  const t=12+edad;clima.cinematica(t,foco,{edadHechizo:edad});const k=Math.max(0,Math.min(1,edad/3)),fuerza=k*k*(3-2*k),densidad=cine+(maximo-cine)*fuerza;
  assert.equal(clima.estado().intensidadTormenta,fuerza);assert.equal(clima.estado().edadHechizo,edad);assert.equal(u.uGotas.value,densidad);
  assert.equal(clima.estado().gotas,Math.ceil(densidad));assert(clima.estado().gotas>=cantidadAnterior);cantidadAnterior=clima.estado().gotas;
  assert.equal(lluvia.geometry.drawRange.count,Math.ceil(densidad)*2);assert.equal(salpicaduras.geometry.drawRange.count,Math.ceil(Math.ceil(densidad)/2)*6);
  assert.equal(lluvia.geometry.attributes,atributos);assert.equal(escena.children.length,3);assert.deepEqual(escena.getObjectByName('Charcos de lluvia').geometry.attributes.position.array,charcos);
  const actual=contexto.CAOZ_ARPG_CLIMA.derivaViento(t,new T.Vector2(),edad),previa=contexto.CAOZ_ARPG_CLIMA.derivaViento(t-.028,new T.Vector2(),edad-.028);
  assert(u.uDeriva.value.distanceTo(actual)<1e-9);assert(u.uCola.value.distanceTo(actual.sub(previa))<1e-9,'La cola sigue el desplazamiento integral incluso al cambiar la ráfaga');
  capturas.set(edad,foto());
 }
 clima.pausar(true);
 for(const edad of [4,0,9,.5,1.5,-1,3]){clima.cinematica(12+edad,foco,{edadHechizo:edad});assert.equal(foto(),capturas.get(edad),'Scrub inverso y saltos reconstruyen exactamente la misma tormenta');}
 assert.equal(creado,creadosAntes);assert.equal(fuentes.length,fuentesAntes,'Recorrer la tormenta no crea audio ni truenos');assert.equal(clima.estado().truenos,0);
 const normal=contexto.CAOZ_ARPG_CLIMA.derivaViento(15,new T.Vector2()).sub(contexto.CAOZ_ARPG_CLIMA.derivaViento(15-.028,new T.Vector2())).divideScalar(.028);
 const fuerte=u.uCola.value.clone().divideScalar(.028);assert(fuerte.x>normal.x+13.99&&fuerte.y>normal.y+4.99,'El viento sostenido es más intenso y mantiene la diagonal');
 clima.cinematica(null,foco,{edadHechizo:20});assert.equal(clima.estado().gotas,base);assert.equal(clima.estado().intensidadTormenta,0);assert.equal(clima.estado().edadHechizo,-1);
 clima.pausar(false);avanzar(clima,1);assert(u.uDeriva.value.distanceTo(contexto.CAOZ_ARPG_CLIMA.derivaViento(1,new T.Vector2()))<1e-8,'La partida recupera exactamente su viento normal');clima.destruir();
}
// La integral es continua y su velocidad también en ambos extremos de la rampa.
for(const edad of [0,3]){
 const h=1e-5,t=12+edad,antes=contexto.CAOZ_ARPG_CLIMA.derivaViento(t-h,new T.Vector2(),edad-h),centro=contexto.CAOZ_ARPG_CLIMA.derivaViento(t,new T.Vector2(),edad),despues=contexto.CAOZ_ARPG_CLIMA.derivaViento(t+h,new T.Vector2(),edad+h);
 const vAntes=centro.clone().sub(antes).divideScalar(h),vDespues=despues.clone().sub(centro).divideScalar(h);
 assert(centro.distanceTo(antes)<.0003&&centro.distanceTo(despues)<.0003,'La posición no salta al comenzar o terminar el hechizo');assert(vAntes.distanceTo(vDespues)<.001,'El viento entra y sale de la rampa sin cambio brusco de velocidad');
}
console.log('OK: tormenta progresiva de 893→1523 gotas (447→761 reducido), viento integral continuo, tres mallas, scrub exacto y audio intacto.');

// Gravedad del portal: sólo cambian uniformes; cabezas y colas usan relojes
// absolutos separados por la exposición para seguir la curva y la expulsión.
for(const reducido of [false,true]){
 const {escena,clima}=preparar({reducido}),lluvia=escena.getObjectByName('Lluvia ligera'),impactos=escena.getObjectByName('Salpicaduras de lluvia'),u=lluvia.material.uniforms;
 const atributos=lluvia.geometry.attributes,datos=Object.fromEntries(Object.entries(atributos).map(([k,a])=>[k,a.array.slice()])),centro=[2,8,-10],soltar=1.316,foco={x:2,z:-4};
 assert.equal(impactos.material.uniforms.uFuerzaPortal,u.uFuerzaPortal,'La lluvia y sus impactos comparten el mismo estado de gravedad');
 assert(lluvia.material.vertexShader.includes('gravedadDePortal(base,mix(uFuerzaPortal.xy,uFuerzaPortal.zw,aExtremo))'),'Ambos extremos se deforman con sus fuerzas temporales');
 assert(lluvia.material.vertexShader.includes('libreHastaCielo(p,max(.025,y),rapidez)'),'Se conserva la exclusión de gotas cuya caída atraviesa un refugio');
 assert(lluvia.material.fragmentShader.includes('vMundo.y<=texture2D(uTechos'),'Las gotas desplazadas tampoco se dibujan dentro de un tejado');
 assert.equal(u.uTechos.value.image.data[Math.round((5+120)/240*256)*256+Math.round((5+120)/240*256)],6,'El campo de refugios conserva la altura del edificio');
 const foto=()=>JSON.stringify({fuerzas:u.uFuerzaPortal.value.toArray(),centro:u.uCentroPortal.value.toArray(),deriva:u.uDeriva.value.toArray(),cola:u.uCola.value.toArray(),estado:clima.estado().portal});
 const situar=edad=>clima.cinematica(10+edad,foco,{edadHechizo:edad-1.4,portal:{centro,edad,soltar}}),fotos=new Map();
 for(const edad of [0,.15,.5,1,soltar,1.4,1.5,1.65,1.9,2.05,2.1]){situar(edad);fotos.set(edad,foto());}
 situar(.15);assert(u.uFuerzaPortal.value.x>0&&u.uFuerzaPortal.value.x<.02,'La lluvia ofrece resistencia al principio');
 situar(soltar);assert.equal(u.uFuerzaPortal.value.x,1,'La atracción culmina al completarse el mago');assert.equal(u.uFuerzaPortal.value.y,0,'La expulsión no anticipa la aparición');
 const antes=u.uFuerzaPortal.value.clone();situar(soltar+1e-6);assert(u.uFuerzaPortal.value.clone().sub(antes).length()<.0001,'La liberación empieza sin salto de posición');
 situar(soltar+.1);assert(u.uFuerzaPortal.value.y>.45,'El golpe radial domina inmediatamente después de soltar');
 situar(2.1);assert.deepEqual(Array.from(u.uFuerzaPortal.value.toArray()),[0,0,0,0],'Cabeza y cola recuperan lluvia normal después del impulso');
 const comunes=new Map();for(const fps of [30,60,120]){
  let anterior=0,pico=0;for(let i=0;i<=fps*2.2;i++){
   const edad=i/fps;situar(edad);const fuerzas=u.uFuerzaPortal.value.clone();assert(fuerzas.toArray().every(Number.isFinite));
   if(edad<=soltar){assert(fuerzas.x>=anterior,'La lluvia cede progresivamente durante la reunión');assert.equal(fuerzas.y,0);anterior=fuerzas.x;}pico=Math.max(pico,fuerzas.y);
   if(edad>=.028){situar(edad-.028);assert(Math.abs(u.uFuerzaPortal.value.x-fuerzas.z)<1e-12);assert(Math.abs(u.uFuerzaPortal.value.y-fuerzas.w)<1e-12,'La cola coincide con la posición de esa gota 28 ms antes');}
   if(i%(fps/30)===0){const clave=Math.round(edad*30),valor=JSON.stringify(fuerzas.toArray());if(comunes.has(clave))assert.equal(valor,comunes.get(clave),'La gravedad no depende de FPS');else comunes.set(clave,valor);}
  }assert(pico>.45);
 }
 clima.pausar(true);for(const edad of [2.1,.15,1.65,0,soltar,1.4,.5,1.9,2.05,1.5,1]){situar(edad);assert.equal(foto(),fotos.get(edad),'El editor restaura exactamente portal, lluvia y viento al buscar cualquier cuadro');}
 const datosExternos={centro:[2,8,-10],edad:.5,soltar};clima.cinematica(10.5,foco,{portal:datosExternos});datosExternos.centro[0]=999;assert.equal(clima.estado().portal.centro[0],2,'No retiene el array mutable del llamador');const estadoExterno=clima.estado();estadoExterno.portal.centro[0]=999;assert.equal(clima.estado().portal.centro[0],2,'Consultar estado no permite modificar el portal');
 clima.cinematica(0,foco,{portal:{centro,edad:1,soltar}});assert.equal(clima.estado().portal,null);assert.deepEqual(Array.from(u.uFuerzaPortal.value.toArray()),[0,0,0,0],'La lluvia congelada antes del golpe ignora la gravedad');
 situar(.8);clima.cinematica(10.8,foco);assert.equal(clima.estado().portal,null);assert.deepEqual(Array.from(u.uFuerzaPortal.value.toArray()),[0,0,0,0],'Omitir portal restaura la caída normal');
 situar(.8);clima.cinematica(null,foco,{portal:{centro,edad:1,soltar}});assert.equal(clima.estado().portal,null);assert.deepEqual(Array.from(u.uFuerzaPortal.value.toArray()),[0,0,0,0],'Cancelar la cinemática elimina la atracción');assert.deepEqual(Array.from(u.uCentroPortal.value.toArray()),[0,0,0]);
 clima.cinematica(10,foco,{portal:{centro:[NaN,8,0],edad:1}});assert.equal(clima.estado().portal,null,'Datos incompletos no contaminan los shaders');
 assert.equal(escena.children.length,3);assert.equal(lluvia.geometry.attributes,atributos);for(const [nombre,a]of Object.entries(atributos)){assert.deepEqual(a.array,datos[nombre],'No simula ni actualiza posiciones de gotas en CPU');assert.equal(a.version,0);}
 assert(atributos.position.count<=(reducido?1600:3200),'La reserva completa queda acotada en ambos niveles de calidad');clima.destruir();
}
console.log('OK: lluvia del portal resistente, expulsión radial, colas coherentes, refugios conservados, 30/60/120 FPS, búsqueda exacta y restauración; tres mallas sin partículas CPU.');

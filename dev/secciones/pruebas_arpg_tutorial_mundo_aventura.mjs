/* Pruebas del escenario real: el barranco no tiene suelo oculto y las barreras son visibles. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const contexto=vm.createContext({console,atob});contexto.window=contexto;
for(const f of ['visor-three-vendor.js','ruinas-kiln/datos.js','sendero-kiln/datos.js','arpg-three-tutorial-kiln.js','arpg-three-tutorial-mundo.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),contexto,{filename:f});
const T=contexto.CAOZ_THREE.THREE,escena=new T.Scene(),m=contexto.CAOZ_ARPG_TUTORIAL_MUNDO.crear(T,{escena});
let tiempo=0;
const paso=segundos=>{for(let t=0;t<segundos;t+=1/60){tiempo+=1/60;m.actualizar({tiempo,s:53});}escena.updateMatrixWorld(true);};
const resolver=(s,opciones={})=>m.coordenadas(m.limitar(m.punto(s),.45,opciones)).s;
const altura=(s,z=0)=>{escena.updateMatrixWorld(true);const p=m.punto(s,z);p.y=10;const r=new T.Raycaster(p,new T.Vector3(0,-1,0));return r.intersectObjects(m.grupoPaisaje.children,true).filter(h=>h.object.visible&&h.object.parent.visible)[0]?.point.y;};
const aproximar=(v,esperado,mensaje)=>assert(Math.abs(v-esperado)<1e-6,`${mensaje}: ${v} != ${esperado}`);

// El kit real debe estar presente: comprobar sólo el paisaje de respaldo ocultaría una carga fallida.
const kit=m.grupoPaisaje.getObjectByName('Tutorial · vía y ruinas de Kiln'),estadoKit=m.estado().kiln;
assert(kit&&estadoKit.disponible&&estadoKit.instancias>0,'El sendero incluye las geometrías exportadas de Kiln');
assert.equal(estadoKit.modulos,6);assert.equal(estadoKit.materiales,1);
assert.equal(estadoKit.rechazadas,0,'La distribución diseñada cabe completa en las reservas del sendero');
assert(estadoKit.triangulos<=30000,'La decoración completa respeta el presupuesto de 30.000 triángulos');
const geometriaKit=new Set(),materialesKit=new Set(),matrizKit=new T.Matrix4(),cajaKit=new T.Box3();
kit.traverse(o=>{
 if(!o.isInstancedMesh)return;
 geometriaKit.add(o.geometry);materialesKit.add(o.material);
 assert(!o.castShadow,'La decoración no añade pases de sombras');
 for(let i=0;i<o.count;i++){
  o.getMatrixAt(i,matrizKit);cajaKit.copy(o.geometry.boundingBox).applyMatrix4(matrizKit).translate(o.parent.position);
  for(const [a,b,z] of [[33.9,36.8,4.8],[51.5,56,6.8]])assert(!(cajaKit.max.x>a&&cajaKit.min.x<b&&cajaKit.max.z>-z&&cajaKit.min.z<z),'Una pieza invade fuego o grieta');
  if(o.userData.kiln.tipo==='pavimento')assert(cajaKit.max.y<=.04001,'Las losas no elevan el suelo sobre los pies');
  else assert(cajaKit.min.z>=4.299||cajaKit.max.z<=-4.299,'Una pieza sólida invade el corredor');
 }
});
assert.equal(geometriaKit.size,6);assert.equal(materialesKit.size,1);

m.encuentro('mover');paso(.8);assert.equal(m.estado().limiteS,null);
aproximar(resolver(15),15,'El camino inicial permite caminar');
assert(altura(53)>-.2,'El suelo existe antes de abrir el barranco');
for(const [id,s] of Object.entries({basico:19,cargado:29,parry:46,'parry-flecha':49,salto:61,torbellino:70,boomerang:76,ulti:83})){
  m.encuentro(id);paso(.7);assert.equal(m.estado().limiteS,s);
  aproximar(resolver(s+4),s-.67,'El cuerpo choca con la barricada de '+id);
  aproximar(resolver(s+4,{saltando:true}),s-.67,'El salto no permite omitir '+id);
}

m.encuentro('dash');paso(.3);
const fuego=m.estado().fuego,orilla=fuego.desde-fuego.margen,finalFuego=fuego.hasta+fuego.margen;
assert(fuego.activo&&fuego.intensidad===1,'Las llamas son visibles durante el encuentro de dash');
const incendio=m.grupoPaisaje.getObjectByName('Dash · sendero incendiado');assert(incendio.visible);
assert.equal(incendio.children.length,2,'El fuego completo necesita solo dos dibujos sin luces adicionales');
assert(fuego.semiancho>=4,'El incendio cubre todo el ancho transitable');
for(const z of [-3.55,0,3.55]){
  const p=m.limitar(m.punto(35,z),.45,{desde:m.punto(34,z)});
  aproximar(m.coordenadas(p).s,orilla,'No se puede bordear el fuego caminando');
}
aproximar(resolver(37,{desde:m.punto(34)}),orilla,'Un paso muy largo tampoco atraviesa el incendio');
aproximar(resolver(37,{desde:m.punto(34),saltando:true}),orilla,'Saltar no sustituye al dash');
aproximar(resolver(34,{desde:m.punto(37)}),finalFuego,'El mismo suelo impide el regreso a pie');
aproximar(resolver(37,{desde:m.punto(35.8)}),orilla,'Una esquiva interrumpida dentro del fuego no permite salir caminando');
aproximar(resolver(35,{desde:m.punto(34),obstaculos:false}),35,'La colocación guionizada no queda atrapada entre las llamas');
// La integral real del dash (17 m/s, .2 s, frenado lineal al 60%) es 2.72 m.
for(const fps of [20,30,60]){
  let s=34,t=0;
  while(t<.2-1e-8){
    const fin=Math.min(.2,t+1/fps),avance=17*((fin-t)-.2*(fin*fin-t*t)/.2);
    s=resolver(s+avance,{desde:m.punto(s),esquivando:true});t=fin;
  }
  aproximar(s,36.72,'Un dash completo cruza a '+fps+' fps');assert(s>finalFuego);
  aproximar(resolver(s+.05,{desde:m.punto(s)}),s+.05,'Al aterrizar en terreno seguro vuelve a caminar');
}
aproximar(resolver(44,{desde:m.punto(34),esquivando:true}),44,'Después del fuego el camino queda abierto, sin barricada');
m.encuentro('parry');assert(!m.estado().fuego.activo,'La colisión se retira inmediatamente al superar dash');
paso(.5);assert(!incendio.visible&&m.estado().fuego.intensidad===0,'Las llamas terminan de apagarse');
aproximar(resolver(35,{desde:m.punto(34)}),35,'El camino vuelve a estar libre después del incendio');

m.encuentro('salto');paso(.8);assert.equal(m.estado().hoyo.apertura,1);
assert(altura(53)<-7.8,'No queda una cara de suelo flotando sobre el barranco');
assert(altura(51)>-.1&&altura(56)>-.1,'Los dos extremos del camino siguen siendo sólidos');
aproximar(resolver(53,{desde:m.punto(51.4)}),51.55,'Caminar desde la izquierda detiene al jugador en el borde');
aproximar(resolver(53,{desde:m.punto(56.1)}),55.95,'Caminar desde la derecha detiene al jugador en su borde');
aproximar(resolver(53,{saltando:true,desde:m.punto(51.4)}),53,'La trayectoria aérea cruza el hueco');
aproximar(resolver(53,{obstaculos:false}),53,'Las colocaciones guionizadas pueden ignorar el obstáculo');
assert(m.grupoPaisaje.getObjectByName('Salto · paredes profundas de roca'));
assert(m.grupoPaisaje.getObjectByName('Salto · bordes irregulares de la grieta'));
assert.equal(m.escondites.filter(e=>e.id==='torbellino').length,3);
assert.equal(m.escondites.filter(e=>e.id==='dash').length,2);
for(const e of m.escondites)assert(Math.abs(m.coordenadas(e.salida).z)<3.2,'Las salidas de escondites están dentro del camino');

m.encuentro('torbellino');paso(.8);assert.equal(m.estado().hoyo.apertura,0);
assert(altura(53)>-.2,'Se puede volver por el camino una vez superado el salto');
const fragmentos=m.grupoPaisaje.getObjectByName('Salto · fragmentos de sendero');
assert(fragmentos.material.vertexColors,'Los fragmentos conservan el mismo material del camino');
const colores=fragmentos.geometry.getAttribute('color');
assert(colores&&colores.count===fragmentos.geometry.attributes.position.count,'Un material con color de vértice nunca recibe losas sin ese atributo');
assert([...colores.array].every(v=>v>0.99),'Las losas cerradas no se vuelven negras por multiplicar un color ausente');
aproximar(resolver(53),53,'El antiguo barranco ya no bloquea');
m.encuentro('boomerang');paso(.8);assert(m.estado().obstaculoBumeran);
aproximar(resolver(73.55,{desde:m.punto(72)}),72.76,'El tronco bloquea al cuerpo, dejando al tirador del otro lado');
aproximar(resolver(75,{desde:m.punto(75)}),75,'El blanco puede permanecer detrás del tronco');
m.encuentro('ulti');paso(.8);assert(!m.estado().obstaculoBumeran);
aproximar(resolver(73.55),73.55,'El tronco libera el paso tras el búmeran');
m.encuentro(null);paso(.8);assert.equal(m.estado().limiteS,null);aproximar(resolver(80),80,'Salir libera todas las barreras');

const camara=new T.PerspectiveCamera(32,1.5,.1,200),objetivo=m.punto(44);camara.position.copy(objetivo).add(new T.Vector3(0,10,14));camara.lookAt(objetivo);camara.updateMatrixWorld(true);
assert(m.actualizarOclusion(camara,[objetivo])>=0,'Las nuevas decoraciones conservan la oclusión por árbol');
m.actualizarOclusion(null,null);
const arbol=m.arboles[15],caja=arbol.occlusion.caja,centro=caja.getCenter(new T.Vector3());
const haciaFuera=m.grupo.localToWorld(new T.Vector3(caja.max.x+30,centro.y,centro.z));
camara.position.copy(m.grupo.localToWorld(new T.Vector3(caja.max.x+2.7,centro.y,centro.z)));camara.updateMatrixWorld(true);
m.actualizarOclusion(camara,[haciaFuera]);assert(arbol.occlusion.oculto,'Retira una copa junto al objetivo de cámara aunque quede al lado del personaje');
camara.position.copy(m.grupo.localToWorld(new T.Vector3(caja.max.x+8.5,centro.y,centro.z)));camara.updateMatrixWorld(true);
m.actualizarOclusion(camara,[haciaFuera]);assert(arbol.occlusion.oculto,'La histéresis evita parpadeo al alejarse de una copa');
camara.position.copy(m.grupo.localToWorld(new T.Vector3(caja.max.x+10,centro.y,centro.z)));camara.updateMatrixWorld(true);
m.actualizarOclusion(camara,[haciaFuera]);assert(!arbol.occlusion.oculto,'La copa regresa cuando deja de invadir el primer plano');
m.activar(false);assert.equal(m.oclusion.ocultos,0);aproximar(resolver(190),190,'Fuera del tutorial no hay colisión residual');
assert(!kit.parent.visible,'El kit queda oculto junto al paisaje al salir del tutorial');
let geometriasEliminadas=0,materialesEliminados=0;
for(const g of geometriaKit)g.addEventListener('dispose',()=>geometriasEliminadas++);
for(const material of materialesKit)material.addEventListener('dispose',()=>materialesEliminados++);
m.dispose();assert.equal(escena.children.length,0);assert.doesNotThrow(()=>m.dispose());
assert.equal(geometriasEliminadas,6);assert.equal(materialesEliminados,1);
console.log('OK · Aventura del bosque: fuego exclusivo de dash a 20/30/60 fps, parry cuerpo a cuerpo/flecha, barranco, losas, salto, barricadas, escondites, búmeran y limpieza.');

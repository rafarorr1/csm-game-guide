/* Prototipo fuera del juego. Brazos importados: remapeo sin pérdidas, articulación real y contacto de la piel con el hacha. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const archivo=n=>new URL(n,import.meta.url),c=vm.createContext({console,atob});c.window=c;
const cargar=f=>vm.runInContext(fs.readFileSync(archivo(f),'utf8'),c,{filename:f});
const leer=(s,C=Float32Array)=>new C(Uint8Array.from(Buffer.from(s,'base64')).buffer);
cargar('adreida-piernas-scenario/datos.js');const anterior=c.CAOZ_ADREIDA_PIERNAS_DATOS;
assert(fs.existsSync(archivo('adreida-brazos-rigged/datos.js')),'Falta exportar los brazos importados');
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-brazos-rigged/datos.js','adreida-rostro/datos.js','arpg-three-rostro-adreida.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','arpg-three-adreida-cine.js'])cargar(f);
const d=c.CAOZ_ADREIDA_PIERNAS_DATOS,T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),otro=F.crear('adreida'),cuerpo=m.mallas[0],g=cuerpo.geometry,a=g.attributes;
assert.equal(d.brazosRigged,true,'La prueba carga explícitamente el prototipo importado');
assert.equal(cuerpo.isSkinnedMesh,true);assert(m.rostro&&m.hachaScenario,'Rostro y arma conviven con los brazos nuevos');
assert.equal(g,otro.mallas[0].geometry,'Adreidos comparte la geometría y los mapas');
assert.notEqual(cuerpo.skeleton,otro.mallas[0].skeleton);assert.notEqual(cuerpo.material,otro.mallas[0].material);assert.notEqual(cuerpo.morphTargetInfluences,otro.mallas[0].morphTargetInfluences);
assert.equal(m.mallas.length,5,'El reemplazo mantiene cinco mallas: cuerpo, arma, rostro y dos ojos');
assert(a.position.count<=65535,'El cuerpo conserva índices Uint16');
assert(g.index.count/3<65000,'El cuerpo conserva el presupuesto de 65 mil triángulos');
assert.equal(d.apoyoCarrera.length,anterior.apoyoCarrera.length);assert.deepEqual(d.apoyoCarrera,anterior.apoyoCarrera,'La importación no cambia el apoyo horneado de las botas');
assert.deepEqual(Object.keys(cuerpo.morphTargetDictionary),['Agarre I','Agarre D']);
for(const [nombre,atributo]of Object.entries(a))assert(atributo.array.every(Number.isFinite),'Datos finitos: '+nombre);
assert.equal(a.normal.count,a.position.count);assert.equal(a.uv.count,a.position.count);assert.equal(a.skinIndex.count,a.position.count);assert.equal(a.skinWeight.count,a.position.count);
const piezasBrazo=d.partes.filter(p=>/^brazo[ID]$/.test(p.nombre));assert.equal(piezasBrazo.length,2);
for(let i=0;i<a.position.count;i++){
  let suma=0;for(let j=0;j<4;j++){const w=a.skinWeight.array[i*4+j],b=a.skinIndex.array[i*4+j];assert(w>=0&&w<=1);assert(cuerpo.skeleton.bones[b],'Índice de hueso válido');suma+=w;}
  assert(Math.abs(suma-1)<1e-5,'Pesos normalizados en '+i);
  const n=Math.hypot(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));assert(n>1e-6,'Normal no nula en '+i);
  if(piezasBrazo.some(p=>i>=p.inicio&&i<p.inicio+p.vertices))assert(n>.99&&n<1.01,'Normal unitaria del brazo nuevo en '+i);
  assert(a.uv.getX(i)>=0&&a.uv.getX(i)<=1&&a.uv.getY(i)>=0&&a.uv.getY(i)<=1,'UV dentro del atlas en '+i);
}
assert(g.index.count%3===0&&g.index.array.every(i=>i<a.position.count),'Topología exportada válida');
// La compactación sólo elimina los brazos antiguos: el resto conserva superficie, UV y pesos.
const campos={posicion:[Float32Array,3],normal:[Float32Array,3],uv:[Float32Array,2],peso:[Float32Array,4],hueso:[Uint8Array,4]};
const fuentes=Object.fromEntries(Object.entries(campos).map(([k,[C]])=>[k,[leer(anterior[k],C),leer(d[k],C)]]));
const indiceAnterior=leer(anterior.triangulos,Uint16Array),indiceNuevo=leer(d.triangulos,Uint16Array),remapa=new Map();
const triangulosLocales=(indices,parte)=>{const salida=[];for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]];if(ids.every(j=>j>=parte.inicio&&j<parte.inicio+parte.vertices))salida.push(ids.map(j=>j-parte.inicio).join(','));}return salida;};
for(const vieja of anterior.partes.filter(p=>!/^brazo[ID]$/.test(p.nombre))){
  const nueva=d.partes.find(p=>p.nombre===vieja.nombre);assert(nueva,'Pieza preservada: '+vieja.nombre);assert.equal(nueva.vertices,vieja.vertices,vieja.nombre+': sin recortar vértices');
  for(let i=0;i<vieja.vertices;i++){
    remapa.set(vieja.inicio+i,nueva.inicio+i);
    for(const [campo,[C,ancho]]of Object.entries(campos))for(let j=0;j<ancho;j++){
      const [origen,destino]=fuentes[campo],old=origen[(vieja.inicio+i)*ancho+j],now=destino[(nueva.inicio+i)*ancho+j];
      if(campo==='hueso'){
        const peso=fuentes.peso[0][(vieja.inicio+i)*4+j];if(peso>1e-6)assert.equal(d.huesos[now],anterior.huesos[old],vieja.nombre+': huesos preservados');
      }else assert.equal(now,old,vieja.nombre+': '+campo+' preservado en '+i);
    }
  }
  assert.deepEqual(triangulosLocales(indiceNuevo,nueva),triangulosLocales(indiceAnterior,vieja),vieja.nombre+': triángulos preservados tras compactar');
}
const mascaraAnterior=leer(c.CAOZ_ADREIDA_ROSTRO_DATOS.indicesCuerpo,Uint16Array),mascaraNueva=leer(d.indicesConRostro,Uint16Array);
assert.deepEqual(Array.from(g.index.array),Array.from(mascaraNueva),'El runtime aplica la máscara facial remapeada');
const conjunto=a=>{const s=new Set();for(let i=0;i<a.length;i+=3)s.add(a[i]+','+a[i+1]+','+a[i+2]);return s;},mascaraSet=conjunto(mascaraNueva);
for(let i=0;i<mascaraAnterior.length;i+=3){const ids=[mascaraAnterior[i],mascaraAnterior[i+1],mascaraAnterior[i+2]];if(ids.every(j=>remapa.has(j)))assert(mascaraSet.has(ids.map(j=>remapa.get(j)).join(',')),'La máscara conserva las superficies ajenas a los brazos');}
const viejoSet=conjunto(mascaraAnterior);
for(let i=0;i<indiceAnterior.length;i+=3){const ids=[indiceAnterior[i],indiceAnterior[i+1],indiceAnterior[i+2]];if(ids.every(j=>remapa.has(j))&&!viejoSet.has(ids.join(',')))assert(!mascaraSet.has(ids.map(j=>remapa.get(j)).join(',')),'La cara antigua continúa oculta');}
// Cada dedo conserva tres articulaciones, su jerarquía y una superficie que realmente deforma.
assert.equal(d.dedos.length,30);
for(const lado of ['I','D'])for(const nombre of ['Pulgar','Indice','Medio','Anular','Menique']){
  const cadena=d.dedos.filter(x=>x.lado===lado&&x.dedo===nombre).sort((a,b)=>a.articulacion-b.articulacion);assert.deepEqual(Array.from(cadena,x=>x.articulacion),[0,1,2]);
  for(let i=0;i<cadena.length;i++)assert.equal(cadena[i].padre,i?cadena[i-1].nombre:'mano'+lado,'Jerarquía completa: '+cadena[i].nombre);
}
const porFalange=new Map();
for(const f of d.dedos){
  const hueso=m.H[f.nombre],id=cuerpo.skeleton.bones.indexOf(hueso);assert(hueso?.isBone&&id>=0);assert.equal(hueso.parent,m.H[f.padre]);
  assert(f.posicion.length===3&&f.posicion.every(Number.isFinite));
  for(const campo of ['rotacion','abierto','cerrado'])assert(f[campo].length===4&&f[campo].every(Number.isFinite)&&Math.abs(Math.hypot(...f[campo])-1)<1e-5,f.nombre+': cuaternión '+campo);
  const ids=[];for(let i=0;i<a.position.count;i++)for(let j=0;j<4;j++)if(a.skinIndex.array[i*4+j]===id&&a.skinWeight.array[i*4+j]>.1){ids.push(i);break;}
  assert(ids.length>=3,f.nombre+': posee superficie deformable');porFalange.set(f.nombre,ids);
}
const posar=pose=>{F.posar(m,{mezclar:false,...pose});m.raiz.updateMatrixWorld(true);};
const v=new T.Vector3();posar({anim:'quieto'});
const cerrados=new Map(d.dedos.map(f=>[f.nombre,porFalange.get(f.nombre).map(i=>cuerpo.getVertexPosition(i,new T.Vector3()))]));
posar({anim:'quieto',sinHacha:true});
for(const f of d.dedos)assert(porFalange.get(f.nombre).some((id,i)=>cuerpo.getVertexPosition(id,v).distanceTo(cerrados.get(f.nombre)[i])>.006),f.nombre+': la piel abre al soltar el arma');
// Se mide la piel deformada en coordenadas de la mano, no sólo el punto de anclaje.
const superficies={};
for(const lado of ['I','D']){
  const descendientes=new Set();m.H['mano'+lado].traverse(b=>{if(b.isBone)descendientes.add(cuerpo.skeleton.bones.indexOf(b));});
  superficies[lado]=Array.from({length:a.position.count},(_,i)=>i).filter(i=>{let w=0;for(let j=0;j<4;j++)if(descendientes.has(a.skinIndex.array[i*4+j]))w+=a.skinWeight.array[i*4+j];return w>.5;});
  assert(superficies[lado].length>0,'Superficie de mano '+lado);
}
let radioMin=Infinity,contactos=0;
for(const anim of ['quieto','tajoA','revesA','estocadaA','parry','salto','torbellino']){
  posar({anim,k:anim==='salto'?.86:.5});
  for(const lado of ['I','D']){
    const inversa=m.H['mano'+lado].matrixWorld.clone().invert();let cerca=0;
    for(const id of superficies[lado]){
      const p=cuerpo.getVertexPosition(id,new T.Vector3()).applyMatrix4(cuerpo.matrixWorld).applyMatrix4(inversa),radio=Math.hypot(p.x,p.z);radioMin=Math.min(radioMin,radio);
      assert(radio>.021,anim+': piel de '+lado+' dentro del mango ('+radio+' m)');if(radio<.032)cerca++;
    }
    assert(cerca>0,anim+': la palma '+lado+' alcanza el mango');contactos+=cerca;
    for(const dedo of ['Pulgar','Indice','Medio','Anular','Menique']){
      const distal=d.dedos.find(f=>f.lado===lado&&f.dedo===dedo&&f.articulacion===2),puntos=porFalange.get(distal.nombre);let distancia=Infinity;
      for(const id of puntos){const p=cuerpo.getVertexPosition(id,new T.Vector3()).applyMatrix4(cuerpo.matrixWorld).applyMatrix4(inversa);distancia=Math.min(distancia,Math.hypot(p.x,p.z));}
      assert(distancia<.042,anim+': yema '+lado+' '+dedo+' demasiado lejos del mango ('+distancia+' m)');
    }
  }
}
// Dedos y correctivos se conservan en FPS, sin arrastrar el rostro ni otro actor.
const CINE=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F),fps=CINE.crearFPS(),seleccion=new Set(fps.mallas[0].geometry.index.array);
for(const f of d.dedos)assert(porFalange.get(f.nombre).every(i=>seleccion.has(i)),f.nombre+': superficie completa en FPS');
CINE.fps(fps,new T.PerspectiveCamera(),1,0);
for(const f of d.dedos){const q=new T.Quaternion().fromArray(f.lado==='D'?f.cerrado:f.abierto);assert(fps.H[f.nombre].quaternion.angleTo(q)<1e-6,f.nombre+': postura de mano FPS');}
assert(fps.rostro.mallas.every(x=>!x.visible));assert.equal(fps.mallas[0].geometry.morphAttributes,g.morphAttributes);
// La misma medición sobre la malla FPS detecta diferencias de bind, recorte o correctivo.
for(const fase of [0,1.5,3])for(const ataque of [null,.2,.5]){
  CINE.fps(fps,new T.PerspectiveCamera(),fase,0,ataque);fps.raiz.updateMatrixWorld(true);
  const mesh=fps.mallas[0],inversa=fps.H.manoD.matrixWorld.clone().invert();let cerca=0;
  for(const id of superficies.D){const p=mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inversa),radio=Math.hypot(p.x,p.z);assert(radio>.021,'El mango no atraviesa la piel del POV ('+radio+' m)');if(radio<.032)cerca++;}
  assert(cerca>0,'El POV sostiene el mango durante carrera y ataque');
}

posar({anim:'quieto'});const cuadro=CINE.capturar(m),cara=F.rostro.capturar(m),agarre=cuerpo.morphTargetInfluences.slice();
F.rostro.posar(m,{expresion:'ira',parpadeo:false});assert.deepEqual(cuerpo.morphTargetInfluences,agarre,'Los canales de la cara no alteran los dedos');
posar({anim:'andar',fase:2,paso:1});CINE.restaurar(m,cuadro);
for(const f of d.dedos)assert(m.H[f.nombre].quaternion.angleTo(cuadro.rot[f.nombre])<1e-6,'La caché restaura la falange '+f.nombre);
assert.deepEqual(F.rostro.capturar(m),cara);
assert(otro.mallas[0].morphTargetInfluences.every(x=>x===0),'Las pruebas no cambian el agarre de Adreidos');
console.log(`✓ Brazos importados: ${a.position.count} vértices, ${g.index.count/3} triángulos; piezas, UV, máscara facial y apoyo preservados; 30 falanges con piel deformable.`);
console.log(`✓ Contacto real en siete poses (radio mínimo ${(radioMin*100).toFixed(2)} cm), diez yemas, ${contactos} muestras próximas, dedos FPS, rostro y caché independientes.`);

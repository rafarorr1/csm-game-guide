/* Exporta el esqueleto real del juego para ajustar brazos fuera del navegador.
   Uso: node exportar-enlace.mjs [salida.json]
   No modifica archivos del juego ni carga texturas o modelos remotos. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const salida=path.dirname(fileURLToPath(import.meta.url));
const secciones=path.resolve(salida,'..');
const contexto=vm.createContext({console,atob});contexto.window=contexto;
const archivos=[
  'visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js',
  'adreida-scenario/datos.js','adreida-brazos-scenario/datos.js','adreida-piernas-scenario/datos.js',
  'adreida-rostro/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js',
  'arpg-three-hacha-adreida.js','arpg-three-rostro-adreida.js','arpg-three-modelos.js',
];
const fuentes=[];
for(const nombre of archivos){
  const codigo=fs.readFileSync(path.join(secciones,nombre),'utf8');
  vm.runInContext(codigo,contexto,{filename:nombre});
  fuentes.push({nombre,sha256:crypto.createHash('sha256').update(codigo).digest('hex')});
}
const T=contexto.CAOZ_THREE.THREE,modelos=contexto.CAOZ_ARPG_MODELOS.fabrica(T),m=modelos.crear('adreida');
const esqueleto=m.mallas[0].skeleton,nombres=new Map(Object.entries(m.H).map(([n,o])=>[o,n]));
const filas=mat=>Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>mat.elements[c*4+r]));
let errorInversas=0;
function captura(){
  m.raiz.updateMatrixWorld(true);esqueleto.update();
  const huesos={};
  for(const [nombre,b]of Object.entries(m.H)){
    if(!b.isBone&&nombre!=='raiz')continue;
    const inv=b.matrixWorld.clone().invert(),producto=b.matrixWorld.clone().multiply(inv),i=esqueleto.bones.indexOf(b);
    for(let j=0;j<16;j++)errorInversas=Math.max(errorInversas,Math.abs(producto.elements[j]-(j%5===0?1:0)));
    huesos[nombre]={
      parent:nombres.get(b.parent)||null,indiceEsqueleto:i,
      posicionLocal:b.position.toArray(),quaternionLocal:b.quaternion.toArray(),escalaLocal:b.scale.toArray(),
      posicionMundo:b.getWorldPosition(new T.Vector3()).toArray(),
      quaternionMundo:b.getWorldQuaternion(new T.Quaternion()).toArray(),
      matrix:b.matrix.toArray(),matrixWorld:b.matrixWorld.toArray(),inverseWorld:inv.toArray(),
      matrixWorldFilas:filas(b.matrixWorld),inverseWorldFilas:filas(inv),
      boneInverse:i>=0?esqueleto.boneInverses[i].toArray():null,
      skinMatrix:i>=0?b.matrixWorld.clone().multiply(esqueleto.boneInverses[i]).toArray():null,
    };
  }
  return {
    huesos,
    hacha:{
      hueso:'manoD',matrixWorldRigida:m.H.manoD.matrixWorld.toArray(),
      inverseWorldRigida:m.H.manoD.matrixWorld.clone().invert().toArray(),
      origenMango:m.H.manoD.getWorldPosition(new T.Vector3()).toArray(),
      apoyoIzquierdo:m.H.manoD.localToWorld(new T.Vector3(0,-.30,0)).toArray(),
      punta:m.M.punta.getWorldPosition(new T.Vector3()).toArray(),
      ejeHaciaHoja:new T.Vector3(0,-1,0).transformDirection(m.H.manoD.matrixWorld).toArray(),
    },
  };
}
const enlace=captura();
modelos.posar(m,{anim:'quieto',t:0,dt:0,mezclar:false,parpadeo:false,expresion:'neutral'});
const quieto=captura();
const d=contexto.CAOZ_ADREIDA_PIERNAS_DATOS||contexto.CAOZ_ADREIDA_MODULAR_DATOS;
const informe={
  version:1,
  convenciones:{
    unidades:'metros',ejes:'Juego: +X izquierda anatómica, +Y arriba, +Z delante.',
    matrices:'matrix, matrixWorld, inverseWorld y boneInverse son 16 números COLUMN MAJOR, como THREE.Matrix4.elements. Las propiedades terminadas en Filas están en filas para NumPy/Blender.',
    coordenadasBlender:'De juego a Blender: (x,y,z) -> (x,-z,y). Aplicar cambio de base también a las matrices, no sólo a su traslación.',
    hacha:'Su geometría está en espacio local de manoD: mango a lo largo de Y, hoja hacia -Y, radio de mango 0.026 m. matrixWorldRigida transforma esa geometría al mundo; la matriz del SkinnedMesh por sí sola no representa el arma posada.',
    enlace:'Capturado justo después de crear Adreida, antes de ejecutar posar().',
  },
  dimensiones:m.p,
  contratoAgarre:{radioMango:.026,centroDerechoLocal:[0,0,0],centroIzquierdoEnManoDerecha:[0,-.30,0],margenPielSugerido:.002},
  fuentes,
  datosActuales:{huesos:d.huesos,dedos:d.dedos,partes:d.partes,vertices:m.mallas[0].geometry.attributes.position.count},
  poses:{enlace,quieto},
  validacion:{errorMaximoMatrizPorInversa:errorInversas},
};
if(!Number.isFinite(errorInversas)||errorInversas>1e-10)throw new Error('Matriz de enlace no invertible o imprecisa');
const destino=process.argv[2]?path.resolve(process.argv[2]):path.join(salida,'enlace-juego.json');fs.writeFileSync(destino,JSON.stringify(informe,null,2)+'\n');
console.log(JSON.stringify({archivo:destino,huesos:Object.keys(enlace.huesos).length,errorMaximo:errorInversas,manoDerechaEnlace:enlace.huesos.manoD.posicionMundo,manoDerechaQuieto:quieto.huesos.manoD.posicionMundo}));

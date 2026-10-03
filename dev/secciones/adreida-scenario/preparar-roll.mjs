/* Adapta Sprinting Forward Roll a Adreida. Conserva el salto y la rodada del FBX.
   Uso: node preparar-roll.mjs fuente.json */
import fs from 'node:fs';
import vm from 'node:vm';
const fuentes=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
if(fuentes.length!==1)throw Error('Se requiere la fuente de Sprinting Forward Roll.');
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),H=m.H;
const huesos=['cadera','torso','cabeza',...['I','D'].flatMap(l=>['pierna','rodilla','pie','brazo','ante','mano'].map(n=>n+l))];
const originales=Object.values(H).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
// Las piezas del hacha comparten atributos con la antigua geometría: sólo cuentan sus índices visibles.
const apoyos=m.mallas.map(mesh=>({mesh,indices:mesh.geometry.index?[...new Set(mesh.geometry.index.array)]:Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i)}));
const v=a=>new T.Vector3().fromArray(a),q=a=>new T.Quaternion().fromArray(a),pos=(f,n)=>v(f[n].p);
const tmp=new T.Quaternion(),base=new T.Matrix4(),vertice=new T.Vector3();
function orientar(b,mundo){b.parent.getWorldQuaternion(tmp).invert();b.quaternion.copy(tmp).multiply(mundo);b.updateMatrixWorld(true);}
function orientacionMango(eje,arriba){const y=eje.clone().negate(),x=arriba.clone().addScaledVector(y,-arriba.dot(y)).normalize(),z=new T.Vector3().crossVectors(x,y).normalize();return new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z));}
const planosPrevios=new Map();
function cadena(f,origen,codo,extremo,b1,b2,invertir){
  const d1=pos(f,codo).sub(pos(f,origen)).normalize(),d2=pos(f,extremo).sub(pos(f,codo)).normalize();
  const x=new T.Vector3().crossVectors(d1,d2);
  if(x.lengthSq()<1e-8)x.set(1,0,0).addScaledVector(d1,-d1.x);
  x.normalize().multiplyScalar(invertir?-1:1);
  // Al extenderse el codo, el producto cruzado cambia de signo: conserva el plano
  // anterior para que el brazo no dé media vuelta en un único fotograma.
  const anterior=planosPrevios.get(b1);if(anterior&&x.dot(anterior)<0)x.negate();planosPrevios.set(b1,x.clone());
  for(const [b,d] of [[b1,d1],[b2,d2]]){const y=d.clone().negate(),z=new T.Vector3().crossVectors(x,y).normalize();orientar(b,new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));}
}
const clips=fuentes.map((fuente,variante)=>{
  const rest=fuente.reposo,delta=(f,n)=>q(f[n].q).multiply(q(rest[n].q).invert());
  const escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
  const inicio=fuente.poses[0],origen=pos(inicio,'Hips'),filas=[],recorrido=fuente.poses.at(-1).Hips.p[2]-origen.z;
  for(const f of fuente.poses){
    for(const o of originales){o.b.position.copy(o.p);o.b.quaternion.copy(o.q);}
    H.cuerpo.position.set((f.Hips.p[0]-origen.x)*5/recorrido,(f.Hips.p[1]-rest.Hips.p[1])*escala,(f.Hips.p[2]-origen.z)*5/recorrido);
    H.raiz.updateMatrixWorld(true);
    orientar(H.cadera,delta(f,'Hips'));orientar(H.torso,delta(f,'Spine2'));orientar(H.cabeza,delta(f,'Head'));
    for(const [lado,nombre] of [['I','Left'],['D','Right']]){
      cadena(f,nombre+'UpLeg',nombre+'Leg',nombre+'Foot',H['pierna'+lado],H['rodilla'+lado],false);
      orientar(H['pie'+lado],delta(f,nombre+'Foot'));
      cadena(f,nombre+'Arm',nombre+'ForeArm',nombre+'Hand',H['brazo'+lado],H['ante'+lado],lado==='I');
      orientar(H['mano'+lado],delta(f,nombre+'Hand').multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),lado==='I'?Math.PI/2:-Math.PI/2)));
    }
    // La falda se abre con las piernas igual que en la partida antes de calcular el apoyo.
    F.animacion.resolver(m,{anim:'muerte',t:0});
    H.raiz.updateMatrixWorld(true);let apoyoCuerpo=Infinity;
    for(const i of apoyos[0].indices)apoyoCuerpo=Math.min(apoyoCuerpo,apoyos[0].mesh.getVertexPosition(i,vertice).y);
    H.cuerpo.position.y+=.012-apoyoCuerpo;H.raiz.updateMatrixWorld(true);
    // Mantiene el hacha hacia fuera de la rodada, lejos de la cabeza y del suelo.
    // Así no queda clavada bajo el cuerpo ni levanta a Adreida medio metro sobre el suelo.
    const mano=H.manoD.getWorldPosition(new T.Vector3()),lateral=mano.clone().sub(H.cadera.getWorldPosition(new T.Vector3())).setY(0).normalize();
    const elevacion=Math.max(-.7,Math.min(.1,(.065-mano.y)/1.34));lateral.multiplyScalar(Math.sqrt(1-elevacion*elevacion));lateral.y=elevacion;
    orientar(H.manoD,orientacionMango(lateral,new T.Vector3(0,1,0)));
    // Contacto horneado para todo el cuerpo, cabello, hombreras y arma. Sin recorrido de vértices en la partida.
    H.raiz.updateMatrixWorld(true);let minimo=Infinity;
    for(const {mesh,indices} of apoyos)for(const i of indices)minimo=Math.min(minimo,mesh.getVertexPosition(i,vertice).y);
    // El apoyo se calcula fuera del juego. Conserva el vuelo de la fuente entre contactos.
    const sueloFuente=Math.min(...['LeftToeBase','RightToeBase','LeftToe_End','RightToe_End'].map(n=>f[n].p[1]),f.Head.p[1]-.14,f.Hips.p[1]-.13,f.LeftHand.p[1]-.04,f.RightHand.p[1]-.04);
    const aire=Math.max(0,sueloFuente-.04)*escala;
    H.cuerpo.position.y+=.012+aire-minimo;
    const fila=[...H.cuerpo.position.toArray()];for(const nombre of huesos)fila.push(...H[nombre].quaternion.toArray());filas.push(fila);
  }
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  return {nombre:'Roll evasivo',duracion:fuente.duracion,muestras:filas.length,huesos,ancho:filas[0].length,datos:filas.flat().map(x=>+x.toFixed(6))};
});
const archivo=new URL('../arpg-three-adreida-animacion.js',import.meta.url),actual=fs.readFileSync(archivo,'utf8'),inicioBloque='  // INICIO ROLL ADREIDA',finBloque='  // FIN ROLL ADREIDA';
const bloque=inicioBloque+' — generado por adreida-scenario/preparar-roll.mjs.\n  const rollImportado='+JSON.stringify(clips[0])+';\n'+finBloque;
fs.writeFileSync(archivo,actual.includes(inicioBloque)?actual.slice(0,actual.indexOf(inicioBloque))+bloque+actual.slice(actual.indexOf(finBloque)+finBloque.length):actual.replace('  const limites=',bloque+'\n  const limites='));
fs.writeFileSync(new URL('roll-procedencia.json',import.meta.url),JSON.stringify({fuente:fuentes[0].fuente,sha256:fuentes[0].sha256,duracion:fuentes[0].duracion,muestras:fuentes[0].muestras,uso:'Esquiva de Adreida durante la llegada del Troll a la plaza.',adaptacion:'Quince huesos, 5 metros de desplazamiento horizontal, vuelo conservado y contacto del cuerpo y hacha precalculado. Sin malla ni texturas del maniquí.',reproduccion:'Extraer el FBX con extraer-muertes.py en Blender y ejecutar node dev/secciones/adreida-scenario/preparar-roll.mjs fuente.json.'},null,2)+'\n');
console.log(JSON.stringify({duracion:clips[0].duracion,muestras:clips[0].muestras,bytes:JSON.stringify(clips[0]).length}));

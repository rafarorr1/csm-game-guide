/* Prueba de Falling Back Death sobre el goblin real. Sólo modifica los datos del visor.
   Extracción: Blender --background --factory-startup --python-exit-code 1 --python
   dev/secciones/adreida-scenario/extraer-muertes.py -- entrada.fbx fuente.json
   Adaptación: node dev/secciones/goblin-scenario/preparar-caida-prueba.mjs fuente.json
   Requiere FFmpeg para leer el atlas de color durante la preparación. */
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const fuente=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T);
// El color separa la piel de la pieza oscura de la espalda en esta axila estrecha.
const pixeles=execFileSync('ffmpeg',['-v','error','-i',fileURLToPath(new URL('color.webp',import.meta.url)),'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:8*1024*1024});
const ladoMapa=Math.sqrt(pixeles.length/3);if(!Number.isInteger(ladoMapa))throw Error('Se esperaba el atlas cuadrado del goblin.');
const huesos=['cadera','torso','cabeza',...['I','D'].flatMap(l=>['pierna','rodilla','pie','brazo','ante','mano'].map(n=>n+l))];
const v=a=>new T.Vector3().fromArray(a),q=a=>new T.Quaternion().fromArray(a),pos=(f,n)=>v(f[n].p);
const tmp=new T.Quaternion(),base=new T.Matrix4(),vertice=new T.Vector3(),rest=fuente.reposo;
const delta=(f,n)=>q(f[n].q).multiply(q(rest[n].q).invert());
function orientar(b,mundo){b.parent.getWorldQuaternion(tmp).invert();b.quaternion.copy(tmp).multiply(mundo);b.updateMatrixWorld(true);}
function cadena(f,origen,codo,extremo,b1,b2,invertir){
  const d1=pos(f,codo).sub(pos(f,origen)).normalize(),d2=pos(f,extremo).sub(pos(f,codo)).normalize();
  const x=new T.Vector3().crossVectors(d1,d2);
  if(x.lengthSq()<1e-8)x.set(1,0,0).addScaledVector(d1,-d1.x);
  x.normalize().multiplyScalar(invertir?-1:1);
  for(const [b,d] of [[b1,d1],[b2,d2]]){const y=d.clone().negate(),z=new T.Vector3().crossVectors(x,y).normalize();orientar(b,new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));}
}
const variantes={},pesosPrueba=[];
for(const variante of Object.keys(F.VARIANTES_GOBLIN)){
  const m=F.crear('goblin',{varianteGoblin:variante}),H=m.H;
  const mesh=m.mallas[0],g=mesh.geometry.clone(),a=g.attributes,escalaModelo=F.VARIANTES_GOBLIN[variante].escala;
  mesh.geometry=g;
  for(let i=0;i<a.position.count;i++){
    const x=a.position.getX(i)/escalaModelo,y=a.position.getY(i)/escalaModelo,z=a.position.getZ(i)/escalaModelo;
    // El borde interior del codo izquierdo había quedado ligado a la cintura.
    // Corrección local de la prueba; conserva el modelo compartido del combate.
    if(x>.115&&y>.54&&y<.78&&z<-.015){
      const u=Math.max(0,Math.min(1,(y-.6)/.09)),w=u*u*(3-2*u);
      const px=Math.max(0,Math.min(ladoMapa-1,Math.round(a.uv.getX(i)*(ladoMapa-1)))),py=Math.max(0,Math.min(ladoMapa-1,Math.round(a.uv.getY(i)*(ladoMapa-1))));
      const [r,g,b]=pixeles.subarray((py*ladoMapa+px)*3,(py*ladoMapa+px)*3+3),piel=g>r*.77&&g>b*1.4&&r>b*1.4,espalda=b>r*1.06&&b>g*1.02;
      if(!piel&&!espalda)continue;
      const bs=['anteI','brazoI','torso'],ws=piel?[1-w,w,0]:[0,0,1];a.skinIndex.setXYZW(i,...bs.map(n=>mesh.skeleton.bones.indexOf(H[n])),0);a.skinWeight.setXYZW(i,...ws,0);
      if(variante==='clasico')pesosPrueba.push([i,...ws.map(n=>+n.toFixed(6))]);
    }
  }
  H.raiz.updateMatrixWorld(true);
  const reposoMundo=Object.fromEntries(Object.entries(H).map(([n,b])=>[n,b.getWorldQuaternion(new T.Quaternion())]));
  const originales=Object.values(H).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
  const apoyos=m.mallas.map(mesh=>({mesh,indices:mesh.geometry.index?[...new Set(mesh.geometry.index.array)]:Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i)}));
  const minimo=piezas=>{let y=Infinity;H.raiz.updateMatrixWorld(true);for(const {mesh,indices} of piezas)for(const i of indices)y=Math.min(y,mesh.getVertexPosition(i,vertice).y);return y;};
  const escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
  const origen=pos(fuente.poses[0],'Hips'),filas=[];
  for(const [indice,f] of fuente.poses.entries()){
    for(const o of originales){o.b.position.copy(o.p);o.b.quaternion.copy(o.q);}
    H.cuerpo.position.set((f.Hips.p[0]-origen.x)*escala,(f.Hips.p[1]-rest.Hips.p[1])*escala,(f.Hips.p[2]-origen.z)*escala);
    H.raiz.updateMatrixWorld(true);
    orientar(H.cadera,delta(f,'Hips'));orientar(H.torso,delta(f,'Spine2'));
    const cabeza=delta(f,'Head'),k=indice/(fuente.poses.length-1),u=Math.max(0,Math.min(1,(k-.48)/.3));
    if(H.llama)H.llama.scale.setScalar(Math.max(.001,1-Math.min(1,k/.32)));
    // Sus orejas y cráneo son mucho mayores que los del maniquí. Al asentarse,
    // relaja la torsión del cuello para no apoyar todo el cuerpo en una oreja.
    const arriba=new T.Vector3(0,1,0),ejeCabeza=new T.Vector3(0,1,0).applyQuaternion(cabeza).setY(0).normalize();
    const lateralCabeza=new T.Vector3().crossVectors(ejeCabeza,arriba).normalize();
    cabeza.slerp(new T.Quaternion().setFromRotationMatrix(base.makeBasis(lateralCabeza,ejeCabeza,arriba)),u*u*(3-2*u));
    orientar(H.cabeza,cabeza);
    for(const [lado,nombre] of [['I','Left'],['D','Right']]){
      cadena(f,nombre+'UpLeg',nombre+'Leg',nombre+'Foot',H['pierna'+lado],H['rodilla'+lado],false);
      orientar(H['pie'+lado],delta(f,nombre+'Foot'));
      // Conserva la torsión del FBX y corrige sólo la dirección para los brazos cortos del goblin.
      // El plano del codo por sí solo puede dar media vuelta a la piel al levantar el brazo.
      for(const [hueso,desde,hasta] of [['brazo'+lado,nombre+'Arm',nombre+'ForeArm'],['ante'+lado,nombre+'ForeArm',nombre+'Hand']]){
        const giro=delta(f,desde).multiply(reposoMundo[hueso]),actual=new T.Vector3(0,-1,0).applyQuaternion(giro),objetivo=pos(f,hasta).sub(pos(f,desde)).normalize();
        giro.premultiply(new T.Quaternion().setFromUnitVectors(actual,objetivo));orientar(H[hueso],giro);
      }
      orientar(H['mano'+lado],delta(f,nombre+'Hand').multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),lado==='I'?Math.PI/2:-Math.PI/2)));
    }
    // Primero se apoya el cuerpo; las armas descansan de lado, sin sostenerlo en el aire.
    H.cuerpo.position.y+=.012-minimo([apoyos[0]]);H.raiz.updateMatrixWorld(true);
    for(const lado of variante==='dosHachas'?['I','D']:['D']){
      const mano=H['mano'+lado].getWorldPosition(new T.Vector3());
      const z=mano.clone().sub(H.cadera.getWorldPosition(new T.Vector3())).setY(0).normalize();
      const x=new T.Vector3(0,1,0),y=new T.Vector3().crossVectors(z,x).normalize();
      orientar(H['mano'+lado],new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));
    }
    H.cuerpo.position.y+=.012-minimo(apoyos);
    const fila=[...H.cuerpo.position.toArray()];for(const nombre of huesos)fila.push(...H[nombre].quaternion.toArray());filas.push(fila);
  }
  // Mismo hemisferio para poder interpolar sin vueltas completas entre muestras.
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  variantes[variante]=filas.flat().map(x=>+x.toFixed(6));
}
const clip={nombre:'Falling Back Death · Prueba',duracion:fuente.duracion,muestras:fuente.muestras,huesos,ancho:3+huesos.length*4,pesosPrueba,variantes};
const archivo=new URL('../modelos-visor.js',import.meta.url),actual=fs.readFileSync(archivo,'utf8'),inicio='  // INICIO CAIDA GOBLIN FBX',fin='  // FIN CAIDA GOBLIN FBX';
const bloque=inicio+' — generado por goblin-scenario/preparar-caida-prueba.mjs.\n  const caidaGoblinImportada='+JSON.stringify(clip)+';\n'+fin;
fs.writeFileSync(archivo,actual.includes(inicio)?actual.slice(0,actual.indexOf(inicio))+bloque+actual.slice(actual.indexOf(fin)+fin.length):actual.replace('  // Animaciones:',bloque+'\n  // Animaciones:'));
fs.writeFileSync(new URL('caida-prueba-procedencia.json',import.meta.url),JSON.stringify({fuente:fuente.fuente,sha256:fuente.sha256,accion:fuente.accion,duracion:fuente.duracion,muestras:fuente.muestras,origen:'FBX Mixamo aportado por el usuario el 3 de octubre de 2026.',alcance:'Prueba aislada en el visor. No cambia las muertes del combate.',adaptacion:'Quince huesos del rig actual; misma escala. Retroceso relativo al origen, contacto del cuerpo y armas horneado por variante. Relajación del cuello y corrección local de pesos de la axila izquierda en una copia exclusiva del visor. Conserva la pose final.',reproduccion:'Extraer con adreida-scenario/extraer-muertes.py; adaptar con node dev/secciones/goblin-scenario/preparar-caida-prueba.mjs fuente.json (requiere FFmpeg para leer el atlas).'},null,2)+'\n');
console.log(JSON.stringify({duracion:clip.duracion,muestras:clip.muestras,variantes:Object.keys(variantes),bytes:JSON.stringify(clip).length}));

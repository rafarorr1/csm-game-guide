/* Adapta las mismas cuatro muertes FBX de los goblins a cada kobold.
   Extracción: Blender --background --factory-startup --python-exit-code 1 --python
   dev/secciones/adreida-scenario/extraer-muertes.py -- entrada.fbx fuente.json
   Adaptación: node dev/secciones/kobold-scenario/preparar-muertes.mjs atras.json derecha.json zombie.json desplome.json
   Contactos calculados sobre las cuatro mallas locales de kobold. */
import fs from 'node:fs';
import vm from 'node:vm';
const entradas=process.argv.slice(2);
if(entradas.length!==4)throw Error('Se requieren cuatro fuentes JSON: atrás, derecha, zombie y desplome.');
const fuentes=entradas.map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
const clips=[],procedencias=[],nombres=['Caída hacia atrás','Caída sobre el lado derecho','Caída zombi','Desplome de rodillas'];
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','kobold-scenario/datos.js','kobold-scenario/muertes.js','arpg-three-kobold.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T);
const huesos=['cadera','torso','cabeza',...['I','D'].flatMap(l=>['pierna','rodilla','pie','brazo','ante','mano'].map(n=>n+l)),'cola','cola2'];
const v=a=>new T.Vector3().fromArray(a),q=a=>new T.Quaternion().fromArray(a),pos=(f,n)=>v(f[n].p);
const tmp=new T.Quaternion(),base=new T.Matrix4(),vertice=new T.Vector3();
for(const [varianteMuerte,fuente] of fuentes.entries()){
const rest=fuente.reposo;
const delta=(f,n)=>q(f[n].q).multiply(q(rest[n].q).invert());
function orientar(b,mundo){b.parent.getWorldQuaternion(tmp).invert();b.quaternion.copy(tmp).multiply(mundo);b.updateMatrixWorld(true);}
function cadena(f,origen,codo,extremo,b1,b2,invertir){
  const d1=pos(f,codo).sub(pos(f,origen)).normalize(),d2=pos(f,extremo).sub(pos(f,codo)).normalize();
  const x=new T.Vector3().crossVectors(d1,d2);
  if(x.lengthSq()<1e-8)x.set(1,0,0).addScaledVector(d1,-d1.x);
  x.normalize().multiplyScalar(invertir?-1:1);
  for(const [b,d] of [[b1,d1],[b2,d2]]){const y=d.clone().negate(),z=new T.Vector3().crossVectors(x,y).normalize();orientar(b,new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));}
}
const variantes={};let impacto=.5;
for(const variante of Object.keys(F.VARIANTES_KOBOLD)){
  const m=F.crear('kobold',{varianteKobold:variante}),H=m.H;
  H.raiz.updateMatrixWorld(true);
  const reposoMundo=Object.fromEntries(Object.entries(H).map(([n,b])=>[n,b.getWorldQuaternion(new T.Quaternion())]));
  const originales=Object.values(H).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
  const piel=m.mallas[0],g=piel.geometry,centroCola=new T.Vector3(),colaReposo=H.cola2.getWorldPosition(new T.Vector3());let pesoCola=0;
  for(let i=0;i<g.attributes.position.count;i++)for(let j=0;j<4;j++)if(piel.skeleton.bones[g.attributes.skinIndex.array[i*4+j]]===H.cola2){const w=g.attributes.skinWeight.array[i*4+j];centroCola.addScaledVector(new T.Vector3().fromBufferAttribute(g.attributes.position,i),w);pesoCola+=w;}
  const ejeReposo=centroCola.divideScalar(pesoCola).sub(colaReposo).normalize(),colaHorizontal=ejeReposo.clone().setY(0).normalize();
  const aplanarCola=new T.Quaternion().setFromUnitVectors(ejeReposo,colaHorizontal);
  const apoyos=m.mallas.map(mesh=>({mesh,indices:mesh.geometry.index?[...new Set(mesh.geometry.index.array)]:Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i)}));
  const minimo=piezas=>{let y=Infinity;H.raiz.updateMatrixWorld(true);for(const {mesh,indices} of piezas)for(const i of indices)y=Math.min(y,mesh.getVertexPosition(i,vertice).y);return y;};
  const escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
  const origen=pos(fuente.poses[0],'Hips'),filas=[],alturas=[];
  for(const [indice,f] of fuente.poses.entries()){
    for(const o of originales){o.b.position.copy(o.p);o.b.quaternion.copy(o.q);}
    H.cuerpo.position.set((f.Hips.p[0]-origen.x)*escala,(f.Hips.p[1]-rest.Hips.p[1])*escala,(f.Hips.p[2]-origen.z)*escala);
    H.raiz.updateMatrixWorld(true);
    orientar(H.cadera,delta(f,'Hips'));orientar(H.torso,delta(f,'Spine2'));
    const cabeza=delta(f,'Head'),k=indice/(fuente.poses.length-1),u=Math.max(0,Math.min(1,(k-.48)/.3));
    if(H.llama)H.llama.scale.setScalar(Math.max(.001,1-Math.min(1,k/.32)));
    // El cráneo y los cuernos son mayores que los del maniquí. Al asentarse,
    // relaja el cuello para que el cuerpo no quede sostenido por la cabeza.
    const caraFinal=new T.Vector3(0,0,1).applyQuaternion(delta(fuente.poses.at(-1),'Head')).y;
    const arriba=new T.Vector3(0,caraFinal<0?-1:1,0),ejeCabeza=new T.Vector3(0,1,0).applyQuaternion(cabeza).setY(0).normalize();
    const lateralCabeza=new T.Vector3().crossVectors(ejeCabeza,arriba).normalize();
    cabeza.slerp(new T.Quaternion().setFromRotationMatrix(base.makeBasis(lateralCabeza,ejeCabeza,arriba)),u*u*(3-2*u));
    orientar(H.cabeza,cabeza);
    for(const [lado,nombre] of [['I','Left'],['D','Right']]){
      cadena(f,nombre+'UpLeg',nombre+'Leg',nombre+'Foot',H['pierna'+lado],H['rodilla'+lado],false);
      orientar(H['pie'+lado],delta(f,nombre+'Foot'));
      // Conserva la torsión del FBX y corrige la dirección para los brazos cortos del kobold.
      // El plano del codo por sí solo puede dar media vuelta a la piel al levantar el brazo.
      for(const [hueso,desde,hasta] of [['brazo'+lado,nombre+'Arm',nombre+'ForeArm'],['ante'+lado,nombre+'ForeArm',nombre+'Hand']]){
        const giro=delta(f,desde).multiply(reposoMundo[hueso]),actual=new T.Vector3(0,-1,0).applyQuaternion(giro),objetivo=pos(f,hasta).sub(pos(f,desde)).normalize();
        giro.premultiply(new T.Quaternion().setFromUnitVectors(actual,objetivo));orientar(H[hueso],giro);
      }
      orientar(H['mano'+lado],delta(f,nombre+'Hand').multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),lado==='I'?Math.PI/2:-Math.PI/2)));
    }
    const colaMundo=H.cola.getWorldQuaternion(new T.Quaternion()),ejeCola=new T.Vector3(0,0,-1).applyQuaternion(colaMundo).setY(0);
    if(ejeCola.lengthSq()<.01)ejeCola.set(0,0,-1);
    const plana=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.atan2(-ejeCola.x,-ejeCola.z));
    colaMundo.slerp(plana,Math.min(1,k/.55));orientar(H.cola,colaMundo);
    const punta=colaMundo.clone().slerp(plana.clone().multiply(aplanarCola),Math.min(1,k/.55));orientar(H.cola2,punta);
    // Primero se apoya el cuerpo; las armas descansan de lado, sin sostenerlo en el aire.
    H.cuerpo.position.y+=.012-minimo([apoyos[0]]);H.raiz.updateMatrixWorld(true);
    for(const lado of ['D']){
      const mano=H['mano'+lado].getWorldPosition(new T.Vector3());
      const z=mano.clone().sub(H.cadera.getWorldPosition(new T.Vector3())).setY(0).normalize();
      const x=new T.Vector3(0,1,0),y=new T.Vector3().crossVectors(z,x).normalize();
      orientar(H['mano'+lado],new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));
    }
    H.cuerpo.position.y+=.012-minimo(apoyos);H.raiz.updateMatrixWorld(true);alturas.push(H.cadera.getWorldPosition(new T.Vector3()).y);
    const fila=[...H.cuerpo.position.toArray()];for(const nombre of huesos)fila.push(...H[nombre].quaternion.toArray());filas.push(fila);
  }
  // Mismo hemisferio para poder interpolar sin vueltas completas entre muestras.
  for(let i=1;i<filas.length;i++)for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
  if(variante==='rojizo'){const contacto=alturas.findIndex((y,i)=>i>fuente.muestras*.15&&y<alturas.at(-1)+.06);impacto=Math.max(.2,contacto/(fuente.muestras-1));}
  variantes[variante]=Buffer.from(new Float32Array(filas.flat()).buffer).toString('base64');
}
const clip={nombre:nombres[varianteMuerte],duracion:fuente.duracion,muestras:fuente.muestras,huesos,ancho:3+huesos.length*4,variantes,impacto};
clips.push(clip);procedencias.push({fuente:fuente.fuente,sha256:fuente.sha256,accion:fuente.accion,duracion:fuente.duracion,muestras:fuente.muestras,nombre:clip.nombre});
}
fs.writeFileSync(new URL('muertes.js',import.meta.url),'/* Cuatro caídas Mixamo adaptadas a kobolds; contactos horneados por variante. */\nwindow.CAOZ_KOBOLD_MUERTES='+JSON.stringify(clips)+';\n');
fs.writeFileSync(new URL('muertes-procedencia.json',import.meta.url),JSON.stringify({fuentes:procedencias,origen:'Los mismos cuatro FBX Mixamo aportados por el usuario para las muertes de los goblins.',alcance:'Cuatro variantes de kobold; selección uniforme por baja.',adaptacion:'Diecisiete huesos, incluidas dos articulaciones de cola. Contactos de cuerpo y lanza horneados para cada modelo. Misma duración y movimiento de los goblins.',reproduccion:'Extraer los FBX con adreida-scenario/extraer-muertes.py y ejecutar preparar-muertes.mjs atras.json derecha.json zombie.json desplome.json.'},null,2)+'\n');
console.log(JSON.stringify({clips:clips.map(c=>({nombre:c.nombre,duracion:c.duracion,muestras:c.muestras})),bytes:JSON.stringify(clips).length}));

/* Adapta Fast Run al esqueleto de Adreida y hornea un ciclo compacto.
   Uso: node este.mjs /ruta/fuente.json. La partida no carga FBX ni un segundo rig. */
import fs from 'node:fs';
import vm from 'node:vm';
const fuente=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),H=m.H;
const v=a=>new T.Vector3().fromArray(a),q=a=>new T.Quaternion().fromArray(a),pos=(f,n)=>v(f[n].p);
const delta=(f,n)=>q(f[n].q).multiply(q(fuente.reposo[n].q).invert());
const huesos=['cadera','torso','cabeza','piernaI','rodillaI','pieI','piernaD','rodillaD','pieD'];
const huesosBase=Object.values(H).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));
const rest=fuente.reposo,escala=(m.p.muslo+m.p.pierna)/(pos(rest,'LeftUpLeg').distanceTo(pos(rest,'LeftLeg'))+pos(rest,'LeftLeg').distanceTo(pos(rest,'LeftFoot')));
const n=fuente.muestras,poses=fuente.poses.slice(0,n);
// Fase cero: pie izquierdo adelantado. El ciclo por distancia sigue sincronizado con la marcha.
let inicio=0;for(let i=1;i<n;i++)if(poses[i].LeftFoot.p[2]>poses[inicio].LeftFoot.p[2])inicio=i;
const cuerpo=m.mallas[0],vertices=[];for(let i=0;i<cuerpo.geometry.attributes.position.count;i++)if(cuerpo.geometry.attributes.position.getY(i)<.24)vertices.push(i);
const centro=poses.reduce((s,f)=>s.add(pos(f,'Hips')),new T.Vector3()).multiplyScalar(1/n),filas=[];
function orientar(b,world){b.parent.getWorldQuaternion(tmp).invert();b.quaternion.copy(tmp).multiply(world);b.updateMatrixWorld(true);}
const tmp=new T.Quaternion(),base=new T.Matrix4(),tmpv=new T.Vector3();
function cadena(f,origen,codo,extremo,b1,b2,invertir){
 const d1=pos(f,codo).sub(pos(f,origen)).normalize(),d2=pos(f,extremo).sub(pos(f,codo)).normalize();
 const x=new T.Vector3().crossVectors(d1,d2).normalize().multiplyScalar(invertir?-1:1);
 for(const [b,d] of [[b1,d1],[b2,d2]]){const y=d.clone().negate(),z=new T.Vector3().crossVectors(x,y).normalize();orientar(b,new T.Quaternion().setFromRotationMatrix(base.makeBasis(x,y,z)));}
}
for(let i=0;i<n;i++){
 const f=poses[(inicio+i)%n];for(const b of huesosBase){b.b.position.copy(b.p);b.b.quaternion.copy(b.q);}
 H.cuerpo.position.set((f.Hips.p[0]-centro.x)*escala,(f.Hips.p[1]-rest.Hips.p[1])*escala,(f.Hips.p[2]-centro.z)*escala);
 H.raiz.updateMatrixWorld(true);
 orientar(H.cadera,delta(f,'Hips'));orientar(H.torso,delta(f,'Spine2'));orientar(H.cabeza,delta(f,'Head'));
 for(const [lado,nombre] of [['I','Left'],['D','Right']]){
  cadena(f,nombre+'UpLeg',nombre+'Leg',nombre+'Foot',H['pierna'+lado],H['rodilla'+lado],false);
  orientar(H['pie'+lado],delta(f,nombre+'Foot'));
 }
 cadena(f,'LeftArm','LeftForeArm','LeftHand',H.brazoI,H.anteI,true);
 // Ajusta el suelo a las botas de Adreida, preservando el vuelo del ciclo original.
 H.raiz.updateMatrixWorld(true);let minimo=Infinity;
 for(const ix of vertices)minimo=Math.min(minimo,cuerpo.getVertexPosition(ix,tmpv).y);
 const suelo=Math.max(0,Math.min(...['LeftFoot','LeftToeBase','LeftToe_End','RightFoot','RightToeBase','RightToe_End'].map(n=>f[n].p[1])))*escala;
 H.cuerpo.position.y+=suelo+.008-minimo;
 const fila=[...H.cuerpo.position.toArray()];for(const nombre of huesos)fila.push(...H[nombre].quaternion.toArray());
 const brazo=new T.Euler().setFromQuaternion(H.brazoI.quaternion),ante=new T.Euler().setFromQuaternion(H.anteI.quaternion);fila.push(brazo.x,brazo.y,brazo.z,ante.x,ante.y,ante.z);filas.push(fila);
}
// Mantiene el hemisferio de cuaterniones y desenvuelve Euler antes de interpolar periódicamente.
for(let i=1;i<n;i++){
 for(let j=0;j<huesos.length;j++){const o=3+j*4;if(filas[i].slice(o,o+4).reduce((s,x,k)=>s+x*filas[i-1][o+k],0)<0)for(let k=0;k<4;k++)filas[i][o+k]*=-1;}
 for(let j=3+huesos.length*4;j<filas[i].length;j++){while(filas[i][j]-filas[i-1][j]>Math.PI)filas[i][j]-=Math.PI*2;while(filas[i][j]-filas[i-1][j]<-Math.PI)filas[i][j]+=Math.PI*2;}
}
const resultado={nombre:'Fast Run',muestras:n,duracion:fuente.duracion,inicio:inicio/n,huesos,ancho:filas[0].length,datos:filas.flat().map(x=>+x.toFixed(6))};
const archivo=new URL('../arpg-three-adreida-animacion.js',import.meta.url),actual=fs.readFileSync(archivo,'utf8'),inicioBloque='  // INICIO FAST RUN',finBloque='  // FIN FAST RUN';
const bloque=inicioBloque+' — generado por adreida-scenario/preparar-fast-run.mjs.\n  const carreraImportada='+JSON.stringify(resultado)+';\n'+finBloque;
fs.writeFileSync(archivo,actual.includes(inicioBloque)?actual.slice(0,actual.indexOf(inicioBloque))+bloque+actual.slice(actual.indexOf(finBloque)+finBloque.length):actual.replace('  const limites=',bloque+'\n  const limites='));
fs.writeFileSync(new URL('fast-run-procedencia.json',import.meta.url),JSON.stringify({fuente:'Fast Run.fbx, aportado por el usuario',sha256:fuente.sha256,accion:fuente.accion,duracion:fuente.duracion,muestras:n,inicio:inicio/n,escalaPiernas:escala,adaptacion:'Cadera, pecho, cabeza, piernas, pies y brazo izquierdo. Derecha reservada para el hacha. Traslación horizontal eliminada del avance; suelo adaptado a las botas. Sin geometría ni texturas del FBX.',reproduccion:'Blender --background --factory-startup --python-exit-code 1 --python dev/secciones/adreida-scenario/extraer-fast-run.py -- entrada.fbx fuente.json; node dev/secciones/adreida-scenario/preparar-fast-run.mjs fuente.json'},null,2)+'\n');
console.log(JSON.stringify({muestras:n,ancho:resultado.ancho,duracion:resultado.duracion,inicio:inicio/n,bytes:JSON.stringify(resultado).length,rangosCuerpo:[0,1,2].map(j=>[Math.min(...filas.map(f=>f[j])),Math.max(...filas.map(f=>f[j]))])}));

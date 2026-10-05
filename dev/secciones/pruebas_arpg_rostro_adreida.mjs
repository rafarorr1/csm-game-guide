/* Prototipo facial fuera del juego. Cabeza real de Adreida: datos exportados, deformación, agarre y edición de cine. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const archivo=nombre=>new URL(nombre,import.meta.url),c=vm.createContext({console,atob});c.window=c;
assert(fs.existsSync(archivo('adreida-rostro/datos.js')),'Falta exportar la cabeza real: adreida-rostro/datos.js');
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','adreida-rostro/datos.js','arpg-three-rostro-adreida.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','adreida-scenario/cinematica.js','arpg-three-adreida-cine.js','arpg-three-mago-particulas.js','arpg-three-mago-hechizo.js','arpg-three-final-mago.js'])vm.runInContext(fs.readFileSync(archivo(f),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,datos=c.CAOZ_ADREIDA_ROSTRO_DATOS;
const leer=(s,C)=>{const b=Buffer.from(s,'base64');return new C(Uint8Array.from(b).buffer);};
const finitos=(a,mensaje)=>assert(a.every(Number.isFinite),mensaje);
const MOD=c.CAOZ_ARPG_MODELOS.fabrica(T),m=MOD.crear('adreida'),otro=MOD.crear('adreida'),R=MOD.rostro;
assert(m.rostro&&R,'La cabeza nueva está conectada al constructor real');
assert(m.mallas[0].isSkinnedMesh&&!m.mallas[0].userData.rostro,'El cuerpo conserva la posición cero y su esqueleto');
assert(m.rostro.mallas.length>=3,'Piel y dos ojos son piezas separadas');
assert.equal(m.rostro.ojos.length,2,'Cada globo ocular tiene su propio pivote');
const piel=m.rostro.mallas.find(x=>Object.keys(x.morphTargetDictionary||{}).length>=20);
assert(piel,'La piel contiene al menos veinte canales faciales');
const canales=Object.keys(piel.morphTargetDictionary),g=piel.geometry;
for(const n of ['eyeBlinkLeft','eyeBlinkRight','eyeWideLeft','eyeWideRight','browInnerUp','browDownLeft','browDownRight','jawOpen','mouthSmileLeft','mouthSmileRight','mouthFrownLeft','mouthFrownRight'])assert(canales.includes(n),'Falta el canal '+n);
let vertices=0,triangulos=0;
for(const [i,mesh]of m.rostro.mallas.entries()){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  assert(mesh.userData.rostro&&g.userData.compartida);assert.equal(g,otro.rostro.mallas[i].geometry,'El doble reutiliza la geometría');
  let padre=mesh.parent;while(padre&&padre!==m.H.cabeza)padre=padre.parent;assert.equal(padre,m.H.cabeza,'La cara acompaña al hueso de cabeza');
  assert.notEqual(mesh.material,otro.rostro.mallas[i].material,'El material y sus efectos pertenecen al actor');
  if(mesh.morphTargetInfluences)assert.notEqual(mesh.morphTargetInfluences,otro.rostro.mallas[i].morphTargetInfluences,'Los morphs no se comparten entre actores');
  assert(p.count>20&&n.count===p.count&&uv.count===p.count,'La pieza tiene posiciones, normales y UV completas');
  for(const a of [p,n,uv])finitos(a.array,mesh.name+': atributos finitos');
  assert(g.index&&g.index.count%3===0&&g.index.array.every(j=>j<p.count),'Índices de triángulo válidos');
  const caja=new T.Box3().setFromBufferAttribute(p),tam=caja.getSize(new T.Vector3());
  assert(tam.length()<.8&&caja.min.y>-.25&&caja.max.y<.65,'Cabeza en metros y coordenadas locales, sin duplicar el desplazamiento de 1,57 m');
  const shapes=g.morphAttributes.position||[],normales=g.morphAttributes.normal||[];
  assert.equal(shapes.length,normales.length,'Cada expresión tiene sus normales correctivas');
  for(let j=0;j<shapes.length;j++){
    const s=shapes[j],normal=normales[j];assert.equal(s.count,p.count);assert.equal(normal.count,p.count);
    finitos(s.array,s.name+': posiciones finitas');finitos(normal.array,s.name+': normales finitas');
    let desplazamiento=0,correccionNormal=0;for(let k=0;k<s.array.length;k++){desplazamiento=Math.max(desplazamiento,Math.abs(s.array[k]));correccionNormal=Math.max(correccionNormal,Math.abs(normal.array[k]));}
    assert(desplazamiento>1e-6&&desplazamiento<.20,s.name+': target útil y a escala anatómica');
    assert(correccionNormal>1e-7&&correccionNormal<3,s.name+': normales recalculadas al cambiar la superficie');
  }
  vertices+=p.count;triangulos+=g.index.count/3;
}
// La sustitución no elimina triángulos de brazos, manos, hombro, piernas ni botas.
const cuerpo=m.mallas[0],original=c.CAOZ_ADREIDA_PIERNAS_DATOS,indicesOriginales=leer(original.triangulos,Uint16Array),actuales=cuerpo.geometry.index.array;
assert(datos.indicesCuerpo,'El paquete declara la retirada de la cara anterior');
const recorteFacial=original.indicesConRostro||datos.indicesCuerpo;
const indicesEsperados=typeof recorteFacial==='string'?leer(recorteFacial,Uint16Array):Uint16Array.from(recorteFacial);
assert.deepEqual(Array.from(actuales),Array.from(indicesEsperados),'La cara anterior se retira realmente del cuerpo');
assert(actuales.length<indicesOriginales.length,'Se reemplaza la superficie anterior, no se superponen dos caras');
const tris=a=>{const t=new Set();for(let i=0;i<a.length;i+=3)t.add(a[i]+','+a[i+1]+','+a[i+2]);return t;},baseTris=tris(indicesOriginales),cuerpoTris=tris(actuales);
for(const t of cuerpoTris)assert(baseTris.has(t),'La retirada no inventa triángulos en el cuerpo');
const limiteCuerpo=original.partes.find(p=>p.nombre==='cuerpo').vertices;
for(let i=0;i<indicesOriginales.length;i+=3)if([0,1,2].some(j=>indicesOriginales[i+j]>=limiteCuerpo))assert(cuerpoTris.has(indicesOriginales[i]+','+indicesOriginales[i+1]+','+indicesOriginales[i+2]),'Los módulos de extremidades quedan completos');
assert.deepEqual(Array.from(cuerpo.geometry.attributes.position.array),Array.from(leer(original.posicion,Float32Array)),'Los vértices originales y el contacto de las manos no se desplazan');
assert.deepEqual(Object.keys(cuerpo.morphTargetDictionary),['Agarre I','Agarre D'],'La cara no reutiliza los slots de agarre');
MOD.posar(m,{anim:'quieto',mezclar:false,t:0});m.raiz.updateMatrixWorld(true);
const agarre=cuerpo.morphTargetInfluences.slice(),mano=m.H.manoD.getWorldPosition(new T.Vector3()),huellaGiro=m.H.cabeza.quaternion.clone();
for(const expresion of Object.keys(R.expresiones)){
  R.posar(m,{expresion,rostro:{},parpadeo:false});m.raiz.updateMatrixWorld(true);
  assert.deepEqual(cuerpo.morphTargetInfluences,agarre,'La expresión no cambia el cierre de dedos');
  assert(m.H.manoD.getWorldPosition(new T.Vector3()).distanceTo(mano)<1e-10,'La expresión no cambia el agarre del hacha');
  assert(m.H.cabeza.quaternion.equals(huellaGiro),'La expresión no reorienta el cuello');
  for(let i=0;i<g.attributes.position.count;i++){const p=piel.getVertexPosition(i,new T.Vector3());assert(Number.isFinite(p.lengthSq())&&p.length()<.9,expresion+': deformación de cabeza finita y acotada');}
}
assert(otro.rostro.mallas.every(x=>!x.morphTargetInfluences||x.morphTargetInfluences.every(v=>v===0)),'La expresión de Adreida no se filtra a Adreidos');
// Cada parpadeo deforma su propio lado; no se limita a ocultar los globos o cerrar ambos a la vez.
for(const [lado,signo]of [['Left',1],['Right',-1]]){
  const shape=g.morphAttributes.position[piel.morphTargetDictionary['eyeBlink'+lado]],p=g.attributes.position;let propio=0,ajeno=0;
  for(let i=0;i<p.count;i++){const d=Math.hypot(shape.getX(i),shape.getY(i),shape.getZ(i));if(p.getX(i)*signo>=0)propio+=d;else ajeno+=d;}
  assert(propio>.001&&propio>ajeno*4,'El parpadeo '+lado+' actúa sobre su párpado');
  R.posar(m,{rostro:{['eyeBlink'+lado]:1},parpadeo:false});assert.equal(piel.morphTargetInfluences[piel.morphTargetDictionary['eyeBlink'+lado]],1);
  assert(m.rostro.mallas.every(x=>x.visible),'Parpadear deforma párpados sin esconder mallas');
}
// El exportador puede identificar pares de borde para medir el cierre en la geometría final.
const parpados=datos.auditoria?.parpados||datos.landmarks?.parpados;let cierres=0;
if(parpados)for(const [lado,datosLado]of Object.entries(parpados)){
  const pieza=datosLado.malla?m.rostro.mallas.find(x=>x.name==='Adreida · '+datosLado.malla):piel;
  assert(pieza,'Malla de los landmarks del párpado');const superiores=datosLado.superior,inferiores=datosLado.inferior;
  assert(superiores.length>0&&superiores.length===inferiores.length,'Pares de borde del párpado');
  const distancia=()=>superiores.map((v,i)=>{assert(Number.isInteger(v)&&Number.isInteger(inferiores[i])&&v>=0&&v<pieza.geometry.attributes.position.count&&inferiores[i]>=0&&inferiores[i]<pieza.geometry.attributes.position.count);return pieza.getVertexPosition(v,new T.Vector3()).distanceTo(pieza.getVertexPosition(inferiores[i],new T.Vector3()));});
  R.posar(m,{rostro:{},parpadeo:false});const abiertas=distancia();
  R.posar(m,{rostro:{['eyeBlink'+(['I','Left'].includes(lado)?'Left':'Right')]:1},parpadeo:false});const cerradas=distancia();
  assert(abiertas.some(x=>x>.002),'El ojo parte de una abertura visible');
  for(let i=0;i<abiertas.length;i++)assert(cerradas[i]<=Math.max(.0015,abiertas[i]*.5),'Los bordes del párpado se aproximan al cerrar: '+lado+' '+i+' ('+cerradas[i]+' m)');
  cierres++;
}
// Verifica la consecuencia visible del parpadeo: el globo queda tapado por la piel.
// Rasterización geométrica frontal a 0,5 mm/píxel; independiente de texturas y GPU.
const pielDatos=datos.mallas.find(x=>x.tipo==='piel'&&x.morphs?.eyeBlinkLeft);
const posicionPiel=leer(pielDatos.posicion,Float32Array),triangulosPiel=leer(pielDatos.triangulos,Uint16Array);
function superficieFrontal(posiciones,indices,caja,ancho,alto,paso){
  const z=new Float32Array(ancho*alto).fill(-Infinity);
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const ax=posiciones[a],ay=posiciones[a+1],bx=posiciones[b],by=posiciones[b+1],cx=posiciones[c],cy=posiciones[c+1];
    const divisor=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(divisor)<1e-15)continue;
    const x0=Math.max(0,Math.floor((Math.min(ax,bx,cx)-caja[0])/paso)),x1=Math.min(ancho,Math.ceil((Math.max(ax,bx,cx)-caja[0])/paso));
    const y0=Math.max(0,Math.floor((Math.min(ay,by,cy)-caja[1])/paso)),y1=Math.min(alto,Math.ceil((Math.max(ay,by,cy)-caja[1])/paso));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const px=caja[0]+(x+.5)*paso,py=caja[1]+(y+.5)*paso;
      const u=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/divisor,v=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/divisor,w=1-u-v;
      if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6){const profundidad=u*posiciones[a+2]+v*posiciones[b+2]+w*posiciones[c+2];z[y*ancho+x]=Math.max(z[y*ancho+x],profundidad);}
    }
  }
  return z;
}
for(const ojo of datos.mallas.filter(x=>x.tipo==='ojos')){
  const p=leer(ojo.posicion,Float32Array),f=leer(ojo.triangulos,Uint16Array),caja=[Infinity,Infinity,-Infinity,-Infinity],paso=.0005;
  for(let i=0;i<p.length;i+=3){caja[0]=Math.min(caja[0],p[i]);caja[1]=Math.min(caja[1],p[i+1]);caja[2]=Math.max(caja[2],p[i]);caja[3]=Math.max(caja[3],p[i+1]);}
  const ancho=Math.ceil((caja[2]-caja[0])/paso),alto=Math.ceil((caja[3]-caja[1])/paso),canal='eyeBlink'+(ojo.ojo==='I'?'Left':'Right');
  const delta=leer(pielDatos.morphs[canal].posicion,Float32Array),cerrada=posicionPiel.map((v,i)=>v+delta[i]);
  const globo=superficieFrontal(p,f,caja,ancho,alto,paso),abierta=superficieFrontal(posicionPiel,triangulosPiel,caja,ancho,alto,paso),parpado=superficieFrontal(cerrada,triangulosPiel,caja,ancho,alto,paso);
  let visibleAbierto=0,visibleCerrado=0;for(let i=0;i<globo.length;i++)if(Number.isFinite(globo[i])){if(globo[i]>abierta[i]+1e-6)visibleAbierto++;if(globo[i]>parpado[i]+1e-6)visibleCerrado++;}
  assert(visibleAbierto>30,'El globo '+ojo.ojo+' está expuesto cuando el párpado está abierto');
  assert(visibleCerrado<=Math.max(1,visibleAbierto*.01),'El párpado cerrado debe tapar al menos el 99% del globo '+ojo.ojo+' desde frente ('+visibleCerrado+'/'+visibleAbierto+' píxeles visibles)');
}
// Mirar mueve los globos dentro de la cabeza; no altera boca, párpados ni cuerpo.
R.posar(m,{rostro:{},parpadeo:false,mirada:[0,0]});m.raiz.updateMatrixWorld(true);
const ojosAntes=m.rostro.ojos.map(o=>o.quaternion.clone()),pielAntes=piel.morphTargetInfluences.slice(),cuerpoAntes=cuerpo.matrixWorld.clone();
R.posar(m,{rostro:{},parpadeo:false,mirada:{x:.5,y:.35}});m.raiz.updateMatrixWorld(true);
assert(m.rostro.ojos.every((o,i)=>o.quaternion.angleTo(ojosAntes[i])>.01),'Ambos ojos orientan su mirada');
assert.deepEqual(piel.morphTargetInfluences,pielAntes,'La mirada no deforma la cara');assert(cuerpo.matrixWorld.equals(cuerpoAntes));
const ACT=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,MOD),fps=ACT.crearFPS();ACT.fps(fps,new T.PerspectiveCamera(),1,2.1);
assert(fps.rostro.mallas.every(x=>!x.visible),'Ninguna superficie facial aparece en primera persona');
assert.equal(fps.mallas[0].geometry.morphAttributes,cuerpo.geometry.morphAttributes,'Los correctivos del agarre siguen siendo los mismos en FPS');
// Hornear cuadros reales y recorrerlos en orden inverso conserva la actuación sin resimularla.
const escena=new T.Scene(),camara=new T.PerspectiveCamera(32,16/9,.5,1200),casas=new T.Group();escena.add(casas,m.raiz);
const casa=new T.Mesh(new T.BoxGeometry(6,7,5).toNonIndexed(),new T.MeshStandardMaterial());casa.position.set(5,3.5,-17);casas.add(casa);
casas.userData.ocultacion={cajas:[new T.Box3().setFromObject(casa)],opacidades:new Float32Array([1])};
const actor={tipo:'adreida',vivo:true,m,pos:new T.Vector3(10,0,10),dir:0,fase:0};
R.posar(m,{expresion:'alivio',rostro:{},parpadeo:false});const antesCine=R.capturar(m),cuadros=[];let faseAnterior='';
const cine=c.CAOZ_ARPG_FINAL_MAGO.fabrica(T,MOD,{escena,camara,casas,impactar(){},interfaz(){},volver(){}});
cine.iniciar([actor],{puerta:actor.pos.clone()});
for(let i=0;i<1200&&!cine.estado().terminado;i++){
  cine.paso(1/30);const e=cine.estado();if(e.t>.1&&e.fase!==faseAnterior){cuadros.push(cine.capturarCuadro());faseAnterior=e.fase;}
  if(e.pov)assert(cine.recursos.brazosFPS.rostro.mallas.every(x=>!x.visible));
}
assert(cine.estado().terminado&&cuadros.length>=12,'El epílogo termina con todos sus planos');
for(const cuadro of cuadros.reverse()){
  cine.mostrarCuadro(cuadro);assert.deepEqual(R.capturar(m),cuadro.rostros[0],'Se restaura el estado facial real');
  const morfs=m.rostro.mallas.map(x=>x.morphTargetInfluences?.slice()||null),rotaciones=m.rostro.ojos.map(o=>o.quaternion.clone());
  camara.position.set(-14,4,19);camara.lookAt(0,1,0);cine.vistaEditor(true);cine.respirarCamara()?.();
  assert.deepEqual(m.rostro.mallas.map(x=>x.morphTargetInfluences?.slice()||null),morfs,'Los keyframes de cámara no cambian expresiones');
  assert(m.rostro.ojos.every((o,i)=>o.quaternion.equals(rotaciones[i])),'Los ojos no siguen a la cámara del editor');
}
cine.cancelar();assert.deepEqual(R.capturar(m),antesCine,'Cancelar devuelve la expresión del jugador');
console.log(`✓ Cabeza real: ${vertices} vértices, ${triangulos} triángulos, ${canales.length} canales con normales, dos ojos independientes, cuerpo y agarre conservados.`);
console.log(`✓ Parpadeo con oclusión frontal de ambos ojos${cierres?' y '+cierres+' pares palpebrales medidos':''}, mirada aislada, FPS y ${cuadros.length} cuadros de cine reversibles.`);

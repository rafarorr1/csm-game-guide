/* Goblin de Scenario: malla PBR local, pesos suaves y el esqueleto del combate.
   Geometrías y mapas compartidos por variante; ninguna descarga externa en partida. */
'use strict';
(function(){
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL('./goblin-scenario/',document.currentScript.src).href:null;
  function fabrica(THREE){
    const datos=window.CAOZ_GOBLIN_DATOS,geometrias=new Map(),partidas=new Map(),apoyos=new WeakMap();let mapas;
    const leer=(s,T)=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new T(a.buffer);};
    const base={position:leer(datos.posicion,Float32Array),normal:leer(datos.normal,Float32Array),uv:leer(datos.uv,Float32Array),skinIndex:leer(datos.hueso,Uint8Array),skinWeight:leer(datos.peso,Float32Array)},triangulos=leer(datos.triangulos,Uint16Array);
    const suave=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
    function preparar(H){
      H.brazoI.position.y=H.brazoD.position.y=.215;
      for(const [l,s]of [['I',1],['D',-1]]){H['brazo'+l].rotation.set(.12,0,s*.42);H['pierna'+l].rotation.z=s*.06;}
    }
    function geometria(H,variante,escala,orejas){
      if(geometrias.has(variante))return geometrias.get(variante);
      const huesos=[];H.cuerpo.traverse(b=>{if(b.isBone)huesos.push(b);});
      const g=new THREE.BufferGeometry(),P=base.position.slice(),N=base.normal.slice(),SI=new Uint16Array(base.skinIndex.length),color=new Float32Array(P.length).fill(1);
      for(let i=0;i<P.length/3;i++){
        const x=P[i*3],y=P[i*3+1],f=1+(orejas-1)*suave(.93,.98,y);
        if(Math.abs(x)>.115&&y>.93){P[i*3]=Math.sign(x)*(.115+(Math.abs(x)-.115)*f);N[i*3]/=f;}
        // El casquete tejido queda bajo el casco de la variante de dos hachas.
        if(variante==='dosHachas'&&y>1.075&&Math.abs(x)<.14)P[i*3+1]=1.075+(y-1.075)*.3;
        for(let k=0;k<3;k++)P[i*3+k]*=escala;
        for(let k=0;k<4;k++)SI[i*4+k]=huesos.indexOf(H[datos.huesos[base.skinIndex[i*4+k]]]);
      }
      g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.normalizeNormals();
      g.setAttribute('color',new THREE.BufferAttribute(color,3));g.setAttribute('uv',new THREE.BufferAttribute(base.uv,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(base.skinWeight,4));g.setIndex(new THREE.BufferAttribute(triangulos,1));
      g.userData.compartida=true;g.computeBoundingSphere();geometrias.set(variante,g);return g;
    }
    function montar(H,M,mallas,variante,escala,orejas){
      if(!mapas){mapas={};if(ruta)for(const nombre of ['color','superficie','normal']){const t=new THREE.TextureLoader().load(ruta+nombre+'.webp');t.flipY=false;t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapas[nombre]=t;}}
      const material=M.hacer({map:mapas.color||null,normalMap:mapas.normal||null,roughnessMap:mapas.superficie||null,metalnessMap:mapas.superficie||null,roughness:1,metalness:1,normalScale:new THREE.Vector2(.65,.65),side:THREE.FrontSide});
      const mesh=new THREE.SkinnedMesh(geometria(H,variante,escala,orejas),material);mesh.name='Goblin · Scenario';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
      H.raiz.add(mesh);mesh.bind(mallas[0].skeleton,mesh.matrixWorld);M.cuerpo=material;mallas.unshift(mesh);
    }
    // El corte sólo atraviesa el tronco. Brazos, manos y pañuelo siguen a la mitad superior.
    // Se recortan las caras en la cintura y se tapan ambas secciones; nunca se estira una unión.
    function cortar(m){
      const mesh=m.mallas[0],original=mesh.geometry;
      if(original.userData.partida)return;
      const clave=m.varianteGoblin;if(partidas.has(clave)){mesh.geometry=partidas.get(clave);return;}
      const esq=mesh.skeleton,inf=esq.bones.indexOf(m.H.cadera),sup=esq.bones.indexOf(m.H.torso),altura=.59*(m.alto/1.15),A=original.attributes;
      const salida=Object.fromEntries(Object.keys(A).map(k=>[k,[]])),borde=[];
      const vert=i=>Object.fromEntries(Object.entries(A).map(([k,a])=>[k,Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize))]));
      const interpolar=(a,b,t)=>{const v={};for(const k of Object.keys(A))v[k]=a[k].map((n,j)=>n+(b[k][j]-n)*t);
        const w=new Map();for(const [p,f]of [[a,1-t],[b,t]])for(let j=0;j<4;j++)w.set(p.skinIndex[j],(w.get(p.skinIndex[j])||0)+p.skinWeight[j]*f);
        const lista=[...w].sort((a,b)=>b[1]-a[1]).slice(0,4),s=lista.reduce((n,p)=>n+p[1],0);v.skinIndex=[0,0,0,0];v.skinWeight=[0,0,0,0];lista.forEach(([b,w],j)=>{v.skinIndex[j]=b;v.skinWeight[j]=w/s;});return v;};
      const emitir=(v,arriba)=>{v={...v,skinIndex:v.skinIndex.slice(),skinWeight:v.skinWeight.slice()};
        for(let j=0;j<4;j++){if(arriba&&v.skinIndex[j]===inf)v.skinIndex[j]=sup;if(!arriba&&v.skinIndex[j]===sup)v.skinIndex[j]=inf;}
        for(const k of Object.keys(A))salida[k].push(...v[k]);};
      const superiores=new Set();m.H.torso.traverse(b=>superiores.add(esq.bones.indexOf(b)));
      for(let i=0;i<original.index.count;i+=3){const cara=[0,1,2].map(j=>vert(original.index.getX(i+j))),tronco=cara.some(v=>v.skinIndex.some((b,j)=>v.skinWeight[j]>0&&(b===sup||b===inf)));
        if(!tronco){const arriba=superiores.has(cara[0].skinIndex[0]);cara.forEach(v=>emitir(v,arriba));continue;}
        for(const arriba of [false,true]){const poligono=[];for(let j=0;j<3;j++){const a=cara[j],b=cara[(j+1)%3],d=a.position[1]-altura,e=b.position[1]-altura,dentro=arriba?d>=0:d<=0;if(dentro)poligono.push(a);if(d*e<0){const v=interpolar(a,b,d/(d-e));poligono.push(v);if(Math.abs(v.position[0])<.2)borde.push(v.position);}}
          for(let j=1;j<poligono.length-1;j++)for(const v of [poligono[0],poligono[j],poligono[j+1]])emitir(v,arriba);}
      }
      // Tapa opaca de cuero oscuro, usando un texel interior de la ropa.
      const puntos=[...new Map(borde.map(p=>[p.map(n=>n.toFixed(5)).join(','),p])).values()].sort((a,b)=>Math.atan2(a[0],a[2])-Math.atan2(b[0],b[2]));
      for(const arriba of [false,true])for(let i=0;i<puntos.length;i++){
        const ps=[[0,altura,0],puntos[i],puntos[(i+1)%puntos.length]];if(arriba)ps.reverse();
        for(const p of ps)emitir({position:p,normal:[0,arriba?-1:1,0],uv:[.5,.5],color:[.12,.08,.06],skinIndex:[arriba?sup:inf,0,0,0],skinWeight:[1,0,0,0]},arriba);
      }
      const g=new THREE.BufferGeometry();for(const [k,a]of Object.entries(A))g.setAttribute(k,new THREE.BufferAttribute(new (k==='skinIndex'?Uint16Array:Float32Array)(salida[k]),a.itemSize));
      g.userData={compartida:true,partida:true};g.computeBoundingSphere();partidas.set(clave,g);mesh.geometry=g;
    }
    function posar(m,a){if(a.anim==='muerte'&&a.muerte?.partido)cortar(m);else if(m.mallas[0].geometry.userData.partida)m.mallas[0].geometry=geometrias.get(m.varianteGoblin);}
    const v=new THREE.Vector3(),p=new THREE.Vector3(),giro=new THREE.Quaternion();
    function apoyar(m,partido,k){
      const vuelo=m.H.cuerpo.position.y;m.H.cuerpo.position.y=0;m.raiz.updateMatrixWorld(true);
      const superiores=new Set();if(partido)m.H.torso.traverse(b=>superiores.add(b));let inferior=Infinity,superior=Infinity;
      for(const mesh of m.mallas){const geo=mesh.geometry,esq=mesh.skeleton;let muestras=apoyos.get(geo);
        if(!muestras){const dirs=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)dirs.push(new THREE.Vector3(x,y,z));
          const extremos=esq.bones.map(()=>dirs.map(()=>({d:-Infinity,i:-1})));
          for(let i=0;i<geo.attributes.position.count;i++){const b=geo.attributes.skinIndex.getX(i);v.fromBufferAttribute(geo.attributes.position,i).applyMatrix4(esq.boneInverses[b]);for(let j=0;j<dirs.length;j++){const d=v.dot(dirs[j]);if(d>extremos[b][j].d)extremos[b][j]={d,i};}}
          muestras=[...new Set(extremos.flat().filter(e=>e.i>=0).map(e=>e.i))];apoyos.set(geo,muestras);
        }
        for(const i of muestras){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);const b=geo.attributes.skinIndex.getX(i);if(partido&&superiores.has(esq.bones[b]))superior=Math.min(superior,p.y);else inferior=Math.min(inferior,p.y);}
      }
      m.H.cuerpo.position.y=vuelo+.012-inferior+m.raiz.position.y;
      if(partido){const aire=k<.8?Math.sin(Math.PI*k/.8)*.42:0,delta=aire+.012+m.raiz.position.y-superior-m.H.cuerpo.position.y;m.H.torso.parent.getWorldQuaternion(giro).invert();m.H.torso.position.add(v.set(0,delta,0).applyQuaternion(giro));}
    }
    return {p:()=>({muslo:.22,pierna:.205,pie:.095,cintura:.065,torso:.265,hombros:.145,brazo:.175,antebrazo:.155,ancho:.115}),preparar,montar,posar,apoyar};
  }
  window.CAOZ_ARPG_GOBLIN=Object.freeze({fabrica});
})();

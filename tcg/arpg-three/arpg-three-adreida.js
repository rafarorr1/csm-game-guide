/* Adreida de Scenario: cuerpo compartido, materiales locales y esqueleto del combate. */
'use strict';
(function(){
  const modular=window.CAOZ_ADREIDA_MODULAR_DATOS;
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL(modular?'./adreida-brazos-scenario/':'./adreida-scenario/',document.currentScript.src).href:null;
  function fabrica(THREE){
    const datos=modular||window.CAOZ_ADREIDA_DATOS;let geometria,mapas;
    const leer=(s,T)=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new T(a.buffer);};
    function preparar(H){
      // Pose A del archivo aprobado; longitudes, agarres y colisión del juego intactos.
      for(const [l,s]of [['I',1],['D',-1]]){
        H['brazo'+l].rotation.z=s*.31;H['pierna'+l].rotation.z=s*.12;
        // El mango atraviesa el ancho de la palma, perpendicular a los dedos.
        H['mano'+l].rotation.z=s*(Math.PI/2-.31);
      }
      for(const d of datos.dedos||[]){const b=new THREE.Bone();b.name=d.nombre;b.position.fromArray(d.posicion);H[d.padre].add(b);H[d.nombre]=b;}
    }
    // Flexión calibrada para cada longitud de dedo alrededor del mango de 5.2 cm.
    const cierreDedos={Pulgar:[.233,1.039],Indice:[1.65,1.139],Medio:[1.545,.701],Anular:[1.693,.408],Menique:[1.675,.446]};
    function posar(m,a){
      if(m.modeloAdreida!=='scenario'||!datos.dedos)return;
      const libres={};
      // Pose absoluta: el editor puede buscar cualquier cuadro sin arrastrar estados.
      for(const d of datos.dedos){const b=m.H[d.nombre],s=d.lado==='I'?1:-1;
        const libre=(a.sinHacha&&!(d.lado==='D'&&a.agarreDerecha))||a.anim==='grito'||a.anim==='muerte'||(d.lado==='I'&&['andar','recogerLlave','mirarLlave'].includes(a.anim));
        const cierre=libre?.38:1,pulgar=d.dedo==='Pulgar';
        libres[d.lado]=libre;
        b.rotation.set(0,s*cierre*cierreDedos[d.dedo][d.articulacion],pulgar&&!d.articulacion?-s*.582*cierre:0);
      }
      // El correctivo conserva el volumen de la palma al cerrar los dedos sobre el mango.
      const influencias=m.mallas[0].morphTargetInfluences;
      if(influencias)for(const [i,lado]of ['I','D'].entries())influencias[i]=libres[lado]?0:1;
    }
    function montar(H,M,mallas){
      if(!geometria){
        const huesos=mallas[0].skeleton.bones,si=leer(datos.hueso,Uint8Array),indices=new Uint16Array(si.length);
        for(let i=0;i<si.length;i++)indices[i]=huesos.indexOf(H[datos.huesos[si[i]]]);
        const p=leer(datos.posicion,Float32Array);geometria=new THREE.BufferGeometry();
        geometria.setAttribute('position',new THREE.BufferAttribute(p,3));
        geometria.setAttribute('normal',new THREE.BufferAttribute(leer(datos.normal,Float32Array),3));
        geometria.setAttribute('uv',new THREE.BufferAttribute(leer(datos.uv,Float32Array),2));
        geometria.setAttribute('color',new THREE.BufferAttribute(new Float32Array(p.length).fill(1),3));
        geometria.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
        geometria.setAttribute('skinWeight',new THREE.BufferAttribute(leer(datos.peso,Float32Array),4));
        geometria.setIndex(new THREE.BufferAttribute(leer(datos.triangulos,Uint16Array),1));
        if(datos.agarre){
          geometria.morphTargetsRelative=true;
          for(const [atributo,campo]of [['position','posicion'],['normal','normal']])geometria.morphAttributes[atributo]=['I','D'].map(lado=>{
            const d=datos.agarre[lado],ids=leer(d.indices,Uint16Array),valores=leer(d[campo],Float32Array),delta=new Float32Array(p.length);
            for(let i=0;i<ids.length;i++)delta.set(valores.subarray(i*3,i*3+3),ids[i]*3);
            const a=new THREE.BufferAttribute(delta,3);a.name='Agarre '+lado;return a;
          });
        }
        geometria.userData.compartida=true;geometria.computeBoundingSphere();
      }
      if(!mapas){mapas={};if(ruta)for(const nombre of ['color','normal','superficie']){const t=new THREE.TextureLoader().load(ruta+nombre+'.webp');t.flipY=false;t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapas[nombre]=t;}}
      const material=M.hacer({map:mapas.color||null,normalMap:mapas.normal||null,roughnessMap:mapas.superficie||null,metalnessMap:mapas.superficie||null,roughness:1,metalness:1,normalScale:new THREE.Vector2(.65,.65),envMapIntensity:.25,side:THREE.FrontSide});
      const mesh=new THREE.SkinnedMesh(geometria,material);mesh.name='Adreida · Scenario';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
      H.raiz.add(mesh);mesh.bind(mallas[0].skeleton,mesh.matrixWorld);M.cuerpo=material;mallas.unshift(mesh);
    }
    return {preparar,montar,posar};
  }
  window.CAOZ_ARPG_ADREIDA=Object.freeze({fabrica});
})();

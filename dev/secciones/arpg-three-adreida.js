/* Adreida de Scenario: cuerpo compartido, materiales locales y esqueleto del combate. */
'use strict';
(function(){
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL('./adreida-scenario/',document.currentScript.src).href:null;
  function fabrica(THREE){
    const datos=window.CAOZ_ADREIDA_DATOS;let geometria,mapas;
    const leer=(s,T)=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new T(a.buffer);};
    function preparar(H){
      // Pose A del archivo aprobado; longitudes, agarres y colisión del juego intactos.
      for(const [l,s]of [['I',1],['D',-1]]){
        H['brazo'+l].rotation.z=s*.31;H['pierna'+l].rotation.z=s*.12;
        // El mango atraviesa el ancho de la palma, perpendicular a los dedos.
        H['mano'+l].rotation.z=s*(Math.PI/2-.31);
      }
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
        geometria.userData.compartida=true;geometria.computeBoundingSphere();
      }
      if(!mapas){mapas={};if(ruta)for(const nombre of ['color','normal','superficie']){const t=new THREE.TextureLoader().load(ruta+nombre+'.webp');t.flipY=false;t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapas[nombre]=t;}}
      const material=M.hacer({map:mapas.color||null,normalMap:mapas.normal||null,roughnessMap:mapas.superficie||null,metalnessMap:mapas.superficie||null,roughness:1,metalness:1,normalScale:new THREE.Vector2(.65,.65),envMapIntensity:.25,side:THREE.FrontSide});
      const mesh=new THREE.SkinnedMesh(geometria,material);mesh.name='Adreida · Scenario';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
      H.raiz.add(mesh);mesh.bind(mallas[0].skeleton,mesh.matrixWorld);M.cuerpo=material;mallas.unshift(mesh);
    }
    return {preparar,montar};
  }
  window.CAOZ_ARPG_ADREIDA=Object.freeze({fabrica});
})();

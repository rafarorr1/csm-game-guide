/* Hacha de Scenario: un atlas PBR y una malla rígida que sigue la mano.
   El proyectil conserva las mismas UV; los efectos del personaje no lo afectan. */
'use strict';
(function(){
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL('./hacha-adreida-scenario/',document.currentScript.src).href:null;
  function fabrica(THREE){
    const datos=window.CAOZ_HACHA_ADREIDA_DATOS;let local,enlazada,arrojada,mapas,materialArrojado;
    const leer=(s,T)=>new T(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
    function geometria(){
      if(local)return local;local=new THREE.BufferGeometry();
      for(const [nombre,n]of [['position',3],['normal',3],['uv',2]])local.setAttribute(nombre,new THREE.BufferAttribute(leer(datos[nombre],Float32Array),n));
      local.setIndex(new THREE.BufferAttribute(leer(datos.index,Uint16Array),1));
      local.setAttribute('color',new THREE.BufferAttribute(new Float32Array(local.attributes.position.count*3).fill(1),3));
      local.userData.compartida=true;local.computeBoundingSphere();return local;
    }
    function parametros(){
      if(!mapas){mapas={};if(ruta)for(const nombre of ['color','normal','superficie']){const t=new THREE.TextureLoader().load(ruta+nombre+'.webp');t.flipY=false;t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapas[nombre]=t;}}
      return {name:'Hacha de Adreida · Scenario',map:mapas.color||null,normalMap:mapas.normal||null,roughnessMap:mapas.superficie||null,metalnessMap:mapas.superficie||null,roughness:1,metalness:1,normalScale:new THREE.Vector2(.6,.6),envMapIntensity:.18,vertexColors:true};
    }
    function montar(H,M,mallas){
      const esqueleto=mallas[0].skeleton,mano=esqueleto.bones.indexOf(H.manoD);
      if(!enlazada){
        enlazada=geometria().clone().applyMatrix4(esqueleto.boneInverses[mano].clone().invert());
        const n=enlazada.attributes.position.count,indices=new Uint16Array(n*4),pesos=new Float32Array(n*4);
        for(let i=0;i<n;i++){indices[i*4]=mano;pesos[i*4]=1;}
        enlazada.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));enlazada.setAttribute('skinWeight',new THREE.BufferAttribute(pesos,4));
        enlazada.userData.compartida=true;enlazada.computeBoundingSphere();
      }
      // El cuerpo de Scenario ya está enlazado; retiramos las tres mallas del arma antigua.
      for(const mesh of mallas.slice(1)){mesh.removeFromParent();mesh.geometry.dispose();}
      mallas.splice(1);
      for(const mat of [M.piel,M.metal,M.brillo])mat.dispose();
      const mesh=new THREE.SkinnedMesh(enlazada,M.hacer(parametros()));mesh.name='Hacha de Adreida · Scenario';
      mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;H.raiz.add(mesh);mesh.bind(esqueleto,mesh.matrixWorld);mallas.push(mesh);M.hacha=mesh.material;return mesh;
    }
    function crearArrojada(){
      if(!arrojada){arrojada=geometria().clone().translate(0,.55,0).rotateZ(Math.PI/2);arrojada.userData.compartida=true;materialArrojado=new THREE.MeshStandardMaterial(parametros());}
      const g=new THREE.Group(),mesh=new THREE.Mesh(arrojada,materialArrojado);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return g;
    }
    return {montar,crearArrojada};
  }
  window.CAOZ_ARPG_HACHA_ADREIDA=Object.freeze({fabrica});
})();

/* Kobolds de Scenario: cuatro cuerpos, atlas locales y caídas compartidas con los goblins.
   Geometría y mapas se reutilizan entre enemigos de la misma variante. */
'use strict';
(function(){
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL('./kobold-scenario/',document.currentScript.src).href:null;
  const VARIANTES=Object.freeze({
    rojizo:Object.freeze({nombre:'Lancero rojizo',detalle:'Escamas rojas · pañuelo gastado'}),
    capucha:Object.freeze({nombre:'Acechador verde',detalle:'Capucha de bosque · cuero remendado'}),
    acorazado:Object.freeze({nombre:'Lancero acorazado',detalle:'Escamas grises · hierro oxidado'}),
    huesos:Object.freeze({nombre:'Vigía de hueso',detalle:'Escamas ocres · amuletos de hueso'})
  });
  const leer=(s,T)=>new T(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
  function fabrica(THREE){
    const geometrias=new Map(),mapas=new Map(),caidas=new Map(),pCaida=new THREE.Vector3(),qCaida=new THREE.Quaternion();
    const datos=id=>window.CAOZ_KOBOLD_DATOS[id];
    function preparar(H,id){const d=datos(id);for(const [n,p]of Object.entries(d.reposo))H[n].position.fromArray(p);
      H.brazoI.rotation.z=d.anguloBrazos;H.brazoD.rotation.z=-d.anguloBrazos;
    }
    function montar(H,M,mallas,id){
      const d=datos(id);let g=geometrias.get(id);
      if(!g){const esq=mallas[0].skeleton,b=leer(d.hueso,Uint8Array),indices=Uint16Array.from(b,i=>esq.bones.indexOf(H[d.huesos[i]]));
        g=new THREE.BufferGeometry();const p=leer(d.posicion,Float32Array);
        g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(leer(d.normal,Float32Array),3));
        g.setAttribute('uv',new THREE.BufferAttribute(leer(d.uv,Float32Array),2));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(p.length).fill(1),3));
        g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(leer(d.peso,Float32Array),4));
        g.setIndex(new THREE.BufferAttribute(leer(d.triangulos,Uint16Array),1));g.userData.compartida=true;g.computeBoundingSphere();geometrias.set(id,g);
      }
      let mapa=mapas.get(id);if(!mapa){mapa={};if(ruta)for(const n of ['color','normal','superficie']){const t=new THREE.TextureLoader().load(ruta+id+'-'+n+'.webp');t.flipY=false;t.colorSpace=n==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapa[n]=t;}mapas.set(id,mapa);}
      const material=M.hacer({map:mapa.color||null,normalMap:mapa.normal||null,roughnessMap:mapa.superficie||null,metalnessMap:mapa.superficie||null,roughness:1,metalness:.65,normalScale:new THREE.Vector2(.55,.55),envMapIntensity:.2,side:THREE.FrontSide});
      const mesh=new THREE.SkinnedMesh(g,material);mesh.name=VARIANTES[id].nombre+' · Scenario';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
      H.raiz.add(mesh);mesh.bind(mallas[0].skeleton,mesh.matrixWorld);M.cuerpo=material;mallas.unshift(mesh);
    }
    function datosCaida(m,muerte){const clips=window.CAOZ_KOBOLD_MUERTES;if(!clips?.length)return null;const indice=muerte?.variante??0,clip=clips[indice]||clips[0],clave=indice+':'+m.varianteKobold;
      if(!caidas.has(clave))caidas.set(clave,leer(clip.variantes[m.varianteKobold],Float32Array));return {clip,datos:caidas.get(clave)};
    }
    function desplazamientoMuerte(m,muerte,k,salida){const c=datosCaida(m,muerte);if(!c)return salida.set(0,0,0);const {clip,datos}=c,f=THREE.MathUtils.clamp(k,0,1)*(clip.muestras-1),i=Math.floor(f),j=Math.min(clip.muestras-1,i+1),u=f-i,a=i*clip.ancho,b=j*clip.ancho;
      return salida.set(datos[a]+(datos[b]-datos[a])*u,0,datos[a+2]+(datos[b+2]-datos[a+2])*u);
    }
    function posarMuerte(m,a){const c=datosCaida(m,a.muerte);if(!c)return false;const {clip,datos}=c,f=THREE.MathUtils.clamp(a.k||0,0,1)*(clip.muestras-1),i=Math.floor(f),j=Math.min(clip.muestras-1,i+1),u=f-i;
      m.H.cuerpo.position.fromArray(datos,i*clip.ancho).lerp(pCaida.fromArray(datos,j*clip.ancho),u);
      if(a.muerte?.desplazamientoExterno){m.H.cuerpo.position.x=0;m.H.cuerpo.position.z=0;}
      for(let n=0;n<clip.huesos.length;n++)m.H[clip.huesos[n]].quaternion.fromArray(datos,i*clip.ancho+3+n*4).normalize().slerp(qCaida.fromArray(datos,j*clip.ancho+3+n*4).normalize(),u);
      return true;
    }
    return {preparar,montar,posarMuerte,desplazamientoMuerte,p:id=>({...datos(id).proporciones}),alto:id=>datos(id).alto};
  }
  window.CAOZ_ARPG_KOBOLD=Object.freeze({fabrica,VARIANTES});
})();

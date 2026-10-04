/* Relieve visual del adoquinado de Scenario: normales, juntas y parallax acotado.
   No desplaza colisiones ni añade polígonos. Las partículas comparten los mismos mapas. */
'use strict';
(function(){
  function relieve(T,material){
    material.onBeforeCompile=sh=>{
      const capas=[['map_fragment','vMapUv'],['normal_fragment_maps','vNormalMapUv'],['roughnessmap_fragment','vRoughnessMapUv'],['aomap_fragment','vAoMapUv']];
      const uv=`vec2 pisoUv=vMapUv;
        vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);vec2 ux=dFdx(vMapUv),uy=dFdy(vMapUv);
        float signo=sign(ux.x*uy.y-ux.y*uy.x);vec3 tx=normalize((px*uy.y-py*ux.y)*signo),ty=normalize((py*ux.x-px*uy.x)*signo);
        vec3 vista=normalize(vViewPosition),nn=normalize(cross(tx,ty));
        vec2 paso=vec2(dot(vista,tx),dot(vista,ty))*.008/max(.3,abs(dot(vista,nn)));
        paso=clamp(paso,vec2(-.018),vec2(.018));
        for(int i=0;i<3;i++){float altura=texture2D(roughnessMap,pisoUv).b;pisoUv=vMapUv-paso*(1.-altura);}
      `;
      for(const [capa,nombre]of capas)sh.fragmentShader=sh.fragmentShader.replace('#include <'+capa+'>',(capa==='map_fragment'?uv:'')+T.ShaderChunk[capa].replaceAll(nombre,'pisoUv'));
    };
    material.customProgramCacheKey=()=> 'piso-scenario-relieve-v1';return material;
  }
  window.CAOZ_ARPG_PISO=Object.freeze({relieve});
})();

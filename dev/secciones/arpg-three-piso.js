/* Relieve visual del adoquinado de Scenario: normales, juntas y parallax acotado.
   No desplaza colisiones ni añade polígonos. Las partículas comparten los mismos mapas. */
'use strict';
(function(){
  function relieve(T,material){
    material.onBeforeCompile=sh=>{
      sh.fragmentShader=`float semillaMusgo(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float ruidoMusgo(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(semillaMusgo(i),semillaMusgo(i+vec2(1,0)),f.x),mix(semillaMusgo(i+vec2(0,1)),semillaMusgo(i+vec2(1,1)),f.x),f.y);}
        `+sh.fragmentShader;
      const capas=[['map_fragment','vMapUv'],['normal_fragment_maps','vNormalMapUv'],['roughnessmap_fragment','vRoughnessMapUv'],['aomap_fragment','vAoMapUv']];
      const uv=`vec2 pisoUv=vMapUv;
        vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);vec2 ux=dFdx(vMapUv),uy=dFdy(vMapUv);
        float signo=sign(ux.x*uy.y-ux.y*uy.x);vec3 tx=normalize((px*uy.y-py*ux.y)*signo),ty=normalize((py*ux.x-px*uy.x)*signo);
        vec3 vista=normalize(vViewPosition),nn=normalize(cross(tx,ty));
        vec2 paso=vec2(dot(vista,tx),dot(vista,ty))*.008/max(.3,abs(dot(vista,nn)));
        paso=clamp(paso,vec2(-.018),vec2(.018));
        for(int i=0;i<3;i++){float altura=texture2D(roughnessMap,pisoUv).b;pisoUv=vMapUv-paso*(1.-altura);}
      `;
      const musgo=`
        float juntaMusgo=1.-smoothstep(.12,.4,texture2D(roughnessMap,pisoUv).b);
        float mataMusgo=smoothstep(.38,.63,ruidoMusgo(pisoUv*6.7));
        float hojaMusgo=ruidoMusgo(pisoUv*410.);
        float musgo=juntaMusgo*mataMusgo*smoothstep(.18,.6,hojaMusgo);
        vec3 verdeMusgo=mix(vec3(.027,.061,.011),vec3(.11,.19,.035),hojaMusgo);
        diffuseColor.rgb=mix(diffuseColor.rgb,verdeMusgo,musgo*.94);
      `;
      for(const [capa,nombre]of capas)sh.fragmentShader=sh.fragmentShader.replace('#include <'+capa+'>',(capa==='map_fragment'?uv:'')+T.ShaderChunk[capa].replaceAll(nombre,'pisoUv')+(capa==='map_fragment'?musgo:''));
    };
    material.customProgramCacheKey=()=> 'piso-scenario-musgo-v2';return material;
  }
  window.CAOZ_ARPG_PISO=Object.freeze({relieve});
})();

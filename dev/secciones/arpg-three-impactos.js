/* Impactos de la plaza: cráteres temporales y cintas que siguen el filo del hacha.
   Reservas pequeñas; las texturas del piso se comparten y no se crean luces. */
'use strict';
(function(){
  function fabrica(THREE,escena){
    const MAX=8,TAU=Math.PI*2,crateres=[],huecos={value:Array.from({length:MAX},()=>new THREE.Vector4(0,0,0,0))};
    const materiales=new WeakSet(),cintas=new Map(),centro=new THREE.Vector3(),mano=new THREE.Vector3();
    let materialPiso=null;
    // Cobertura complementaria: el piso reaparece donde el cráter pierde opacidad.
    // Conserva la profundidad sin transparencias ordenadas ni otra pasada de render.
    const cobertura='fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))))';
    function desvanecerMaterial(material,opacidad){
      material.onBeforeCompile=sh=>{
        sh.uniforms.uCraterOpacidad=opacidad;
        sh.fragmentShader='uniform float uCraterOpacidad;\n'+sh.fragmentShader;
        sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(${cobertura}>=uCraterOpacidad)discard;`);
      };
      material.customProgramCacheKey=()=> 'crater-desvanecer-v2';
    }
    function perforar(material){
      if(materiales.has(material))return;materiales.add(material);
      const previo=material.onBeforeCompile,clave=material.customProgramCacheKey();
      material.onBeforeCompile=function(sh,r){
        previo.call(this,sh,r);sh.uniforms.uHuecos=huecos;
        sh.vertexShader='varying vec3 vPisoMundo;\n'+sh.vertexShader;
        sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPisoMundo=(modelMatrix*vec4(position,1.)).xyz;');
        sh.fragmentShader='varying vec3 vPisoMundo;uniform vec4 uHuecos[8];\n'+sh.fragmentShader;
        sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
          for(int i=0;i<8;i++){vec2 p=vPisoMundo.xz-uHuecos[i].xy;float a=length(p)>.0001?atan(p.y,p.x):0.;
            float borde=uHuecos[i].z*(1.+.055*sin(a*7.)+.035*cos(a*11.));
            if(uHuecos[i].z>0.&&length(p)<borde&&${cobertura}<uHuecos[i].w)discard;}`);
      };
      material.customProgramCacheKey=()=>clave+'-crater-v2';material.needsUpdate=true;
    }
    const interior=new THREE.MeshStandardMaterial({color:0x282522,roughness:1,side:THREE.DoubleSide,vertexColors:true});
    function geometriaCrater(){
      const P=[],U=[],C=[],indices=[],n=48;
      // Labio roto, pared y fondo cóncavo: el agujero está realmente bajo el piso.
      const anillos=[[1.2,.018],[1,.055],[.72,-.23],[0,-.32]];
      for(let j=0;j<anillos.length;j++)for(let i=0;i<=n;i++){
        const a=i/n*TAU,forma=1+.055*Math.sin(a*7)+.035*Math.cos(a*11),r=anillos[j][0]*forma;
        P.push(Math.cos(a)*r,anillos[j][1],Math.sin(a)*r);U.push(Math.cos(a)*r,Math.sin(a)*r);
        const c=j<2?1:j===2?.72:.35;C.push(c,c,c);
        if(j<3&&i<n){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(indices);g.computeVertexNormals();
      g.clearGroups();g.addGroup(0,n*6,0);g.addGroup(n*6,n*12,1);return g;
    }
    function actualizarMaterial(m){
      materialPiso=m;perforar(m);
      for(const c of crateres){c.labio.map=m.map;c.labio.normalMap=m.normalMap;c.labio.roughnessMap=m.roughnessMap;c.labio.aoMap=m.aoMap;c.labio.normalScale.copy(m.normalScale);c.labio.needsUpdate=true;}
    }
    function agujero(p){
      if(!materialPiso)return;
      if(crateres.length>=MAX)quitar(crateres.shift());
      const radio=1.05,g=geometriaCrater(),uv=g.attributes.uv,diametro=52/Math.cos(Math.PI/24),a=Math.PI/24;
      for(let i=0;i<uv.count;i++){const x=p.x+uv.getX(i)*radio,z=p.z+uv.getY(i)*radio;uv.setXY(i,.5+(x*Math.cos(a)-z*Math.sin(a))/diametro,.5+(-x*Math.sin(a)-z*Math.cos(a))/diametro);}
      const labio=materialPiso.clone();labio.vertexColors=true;labio.side=THREE.DoubleSide;
      const fondo=interior.clone(),opacidad={value:1};
      desvanecerMaterial(labio,opacidad);desvanecerMaterial(fondo,opacidad);
      const mesh=new THREE.Mesh(g,[labio,fondo]);mesh.position.set(p.x,0,p.z);mesh.scale.set(radio,1,radio);mesh.receiveShadow=true;escena.add(mesh);
      crateres.push({mesh,labio,fondo,opacidad,t:0,radio});actualizarHuecos();
    }
    function quitar(c){escena.remove(c.mesh);c.mesh.geometry.dispose();c.labio.dispose();c.fondo.dispose();}
    function actualizarHuecos(){for(let i=0;i<MAX;i++){const c=crateres[i];if(c)huecos.value[i].set(c.mesh.position.x,c.mesh.position.z,c.radio,c.opacidad.value);else huecos.value[i].set(0,0,0,0);}}
    function crearCinta(){
      const n=20,P=new Float32Array(n*6),A=new Float32Array(n*2),U=new Float32Array(n*4),I=[];
      for(let i=0;i<n;i++){U.set([i/(n-1),0,i/(n-1),1],i*4);if(i<n-1){const k=i*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('aVida',new THREE.BufferAttribute(A,1).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setIndex(I);
      const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        vertexShader:'attribute float aVida;varying vec2 vUv;varying float vVida;void main(){vUv=uv;vVida=aVida;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:'varying vec2 vUv;varying float vVida;void main(){float borde=sin(vUv.y*3.14159);float hilo=pow(max(0.,1.-abs(vUv.y-.7)*14.),3.);vec3 c=mix(vec3(.65,.16,.035),vec3(1.,.8,.4),hilo);gl_FragColor=vec4(c,.65*vVida*borde);}'});
      const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=2;mesh.visible=false;escena.add(mesh);
      return {mesh,g,puntos:[],reloj:0};
    }
    function hacha(h,dt){
      if(h.tipo!=='adreida')return;
      let c=cintas.get(h);if(!c){c=crearCinta();cintas.set(h,c);}c.reloj+=dt;
      const activa=h.estado==='golpe'&&h.carga>=.5&&h.t>.2&&h.t<.55;
      if(activa){
        h.m.raiz.updateMatrixWorld(true);h.m.M.punta.getWorldPosition(centro);h.m.H.manoD.getWorldPosition(mano);
        c.puntos.unshift({a:mano.clone().lerp(centro,.62),b:mano.clone().lerp(centro,1.12),t:c.reloj});if(c.puntos.length>20)c.puntos.pop();
      }
      c.puntos=c.puntos.filter(p=>c.reloj-p.t<.19);const n=c.puntos.length;c.mesh.visible=n>1;
      for(let i=0;i<20;i++){const p=c.puntos[Math.min(i,n-1)];if(!p)break;const vida=i<n?Math.pow(1-(c.reloj-p.t)/.19,1.3):0;
        c.g.attributes.position.setXYZ(i*2,...p.a.toArray());c.g.attributes.position.setXYZ(i*2+1,...p.b.toArray());c.g.attributes.aVida.setX(i*2,vida);c.g.attributes.aVida.setX(i*2+1,vida);}
      c.g.attributes.position.needsUpdate=c.g.attributes.aVida.needsUpdate=true;
    }
    function paso(dt){
      for(let i=crateres.length-1;i>=0;i--){const c=crateres[i];c.t+=dt;if(c.t>=5){quitar(c);crateres.splice(i,1);continue;}
        const k=Math.max(0,Math.min(1,(c.t-3.5)/1.5));c.opacidad.value=1-k*k*(3-2*k);}
      actualizarHuecos();
    }
    function limpiar(){for(const c of crateres)quitar(c);crateres.length=0;actualizarHuecos();for(const c of cintas.values()){escena.remove(c.mesh);c.g.dispose();c.mesh.material.dispose();}cintas.clear();}
    return {perforar,actualizarMaterial,agujero,hacha,paso,limpiar,estado:()=>({crateres:crateres.map(c=>({t:c.t,x:c.mesh.position.x,z:c.mesh.position.z,radio:c.radio,opacidad:c.opacidad.value})),cintas:cintas.size})};
  }
  window.CAOZ_ARPG_IMPACTOS={fabrica};
})();

/* La carta física en three.js, compartida por las pruebas del visor
   (visor-three) y de la mesa (mesa-three). Con las texturas de
   carta-pintor.js (color, relieve, metal/rugosidad y máscara holográfica):
     · la cara: MeshPhysicalMaterial con relieve, metal y rugosidad por zona,
       laca (clearcoat), la película holográfica como iridiscencia de capa
       fina y destellos de purpurina inyectados en su shader; y un disolverse
       en brasas (uDisuelve, de 0 a 1) para cuando la carta muere;
     · el dorso con el logo en relieve y el canto de metal cepillado.
   CAOZ_THREE_CARTA.fabrica(THREE,renderer) devuelve lo necesario para
   montar cartas: geometrías compartidas, texturas y materiales. */
'use strict';
(function(){
  const ANCHO=2.5,ALTO=3.5,RADIO=.13,GROSOR=.035;
  // Por edición: iridiscencia, destellos, laca y el metal del canto.
  const EDICION=Object.freeze({normal:{irid:.18,destellos:.25,laca:.55,canto:0xa88f63},foil:{irid:1,destellos:.8,laca:.7,canto:0xe3ecf7},dorado:{irid:.85,destellos:1,laca:.75,canto:0xffd98a}});
  // Dónde están las gemas en la plantilla de 1024×1434 (para poner cifras vivas encima).
  const GEMAS=Object.freeze({coste:[902,108,62],atq:[146,1316,64],vida:[878,1316,64]});
  function fabrica(THREE,renderer){
    const forma=new THREE.Shape(),w=ANCHO/2,h=ALTO/2,r=RADIO;
    forma.moveTo(-w+r,-h);forma.lineTo(w-r,-h);forma.quadraticCurveTo(w,-h,w,-h+r);forma.lineTo(w,h-r);forma.quadraticCurveTo(w,h,w-r,h);
    forma.lineTo(-w+r,h);forma.quadraticCurveTo(-w,h,-w,h-r);forma.lineTo(-w,-h+r);forma.quadraticCurveTo(-w,-h,-w+r,-h);
    const cara=lado=>{const g=new THREE.ShapeGeometry(forma,16),p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/ANCHO+.5,p.getY(i)/ALTO+.5);
      if(lado<0)g.rotateY(Math.PI);g.translate(0,0,lado*GROSOR/2);return g;};
    const canto=new THREE.ExtrudeGeometry(forma,{depth:GROSOR,bevelEnabled:false,curveSegments:16});canto.translate(0,0,-GROSOR/2);
    const geo={cara:cara(1),dorso:cara(-1),canto};
    const aniso=renderer.capabilities.getMaxAnisotropy();
    const tex=(fuente,srgb)=>{const t=new THREE.CanvasTexture(fuente);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=aniso;return t;};
    const lisa=(()=>{const c=document.createElement('canvas');c.width=c.height=4;const g=c.getContext('2d');g.fillStyle='#8080ff';g.fillRect(0,0,4,4);return tex(c);})();
    // El grosor de la película holográfica varía por la carta: bandas de arcoíris que se mueven con el ángulo.
    const pelicula=(()=>{const c=document.createElement('canvas');c.width=256;c.height=358;const g=c.getContext('2d'),d=g.createImageData(256,358);
      for(let y=0;y<358;y++)for(let x=0;x<256;x++){const v=.5+.25*Math.sin(x*.045+y*.03)+.15*Math.sin(x*.11-y*.07+Math.sin(y*.02)*3)+.1*Math.sin((x+y)*.2),i=(y*256+x)*4,n=Math.round(Math.max(0,Math.min(1,v))*255);d.data[i]=d.data[i+1]=d.data[i+2]=n;d.data[i+3]=255;}
      g.putImageData(d,0,0);return tex(c);})();
    const tiempo={value:0};
    // Las cuatro texturas de una carta pintada por carta-pintor.js.
    const texturas=t=>({map:tex(t.color,true),normalMap:tex(t.normal),orm:tex(t.orm),mascara:tex(t.mascara)});
    // La cara: material físico + destellos + disolverse en brasas.
    function materialCara(tx,edicion='normal',efectos={iridiscencia:true,laca:true}){
      const E=EDICION[edicion],u={uDestellos:{value:E.destellos},uMascaraD:{value:tx?.mascara||null},uDisuelve:{value:0}};
      const m=new THREE.MeshPhysicalMaterial({roughness:1,metalness:1,clearcoatRoughness:.06,iridescenceIOR:1.35,iridescenceThicknessRange:[160,640],normalMap:lisa,iridescenceThicknessMap:pelicula});
      m.onBeforeCompile=sh=>{
        Object.assign(sh.uniforms,{uTiempo:tiempo,...u});
        sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTiempo,uDestellos,uDisuelve;uniform sampler2D uMascaraD;\nfloat azarD(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\nfloat ruidoD(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(azarD(i),azarD(i+vec2(1.,0.)),f.x),mix(azarD(i+vec2(0.,1.)),azarD(i+1.),f.x),f.y);}')
          .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfloat quema=ruidoD(vMapUv*vec2(9.,12.))*.6+ruidoD(vMapUv*vec2(31.,40.))*.4;if(uDisuelve>0.&&quema<uDisuelve*1.15-.05)discard;')
          .replace('#include <opaque_fragment>',`{vec4 mk=texture2D(uMascaraD,vMapUv);vec2 g=vMapUv*vec2(64.,90.),id=floor(g),f=fract(g)-.5;float r=azarD(id);vec2 off=vec2(azarD(id+3.1),azarD(id+7.7))-.5;
            float tw=pow(.5+.5*sin(r*90.+normal.x*45.-normal.y*32.+uTiempo*1.3),28.);outgoingLight+=vec3(1.,.96,.88)*(1.-smoothstep(0.,.2,length(f-off*.6)))*step(.78,r)*tw*mk.g*uDestellos*4.;
            if(uDisuelve>0.){float borde=1.-smoothstep(0.,.09,quema-(uDisuelve*1.15-.05));outgoingLight=mix(outgoingLight,vec3(4.,1.5,.35),borde);}}
#include <opaque_fragment>`);
      };
      m.customProgramCacheKey=()=>'cara-destellos-brasas';
      m.userData.u=u;m.userData.edicion=edicion;
      if(tx)Object.assign(m,{map:tx.map,normalMap:tx.normalMap,roughnessMap:tx.orm,metalnessMap:tx.orm,iridescenceMap:tx.mascara});
      ajustar(m,efectos);return m;
    }
    // Iridiscencia y laca según la edición y los efectos encendidos.
    function ajustar(m,efectos={iridiscencia:true,laca:true}){const E=EDICION[m.userData.edicion];m.iridescence=efectos.iridiscencia?E.irid:0;m.clearcoat=efectos.laca?E.laca:0;m.userData.u.uDestellos.value=E.destellos;m.needsUpdate=true;}
    function cambiar(m,tx,edicion){m.userData.edicion=edicion;Object.assign(m,{map:tx.map,normalMap:tx.normalMap,roughnessMap:tx.orm,metalnessMap:tx.orm,iridescenceMap:tx.mascara});m.userData.u.uMascaraD.value=tx.mascara;}
    const materialDorso=d=>new THREE.MeshPhysicalMaterial({roughness:.5,metalness:.15,clearcoat:.6,clearcoatRoughness:.1,...(d?{map:tex(d.color,true),normalMap:tex(d.normal)}:{})});
    const materialCanto=(edicion='dorado')=>new THREE.MeshPhysicalMaterial({color:EDICION[edicion].canto,metalness:1,roughness:.3,anisotropy:.85,anisotropyRotation:Math.PI/2});
    const oculto=new THREE.MeshBasicMaterial({visible:false});
    // Una carta: grupo con la cara, el dorso y el canto (en el plano XY, la cara hacia +Z).
    function carta(cara,dorso,canto){const g=new THREE.Group(),frente=new THREE.Mesh(geo.cara,cara),atras=new THREE.Mesh(geo.dorso,dorso),borde=new THREE.Mesh(geo.canto,[oculto,canto]);
      for(const m of [frente,atras,borde]){m.castShadow=true;m.receiveShadow=true;g.add(m);}g.userData={frente,atras,borde};return g;}
    return {geo,tex,texturas,materialCara,ajustar,cambiar,materialDorso,materialCanto,carta,tiempo};
  }
  window.CAOZ_THREE_CARTA=Object.freeze({ANCHO,ALTO,GROSOR,RADIO,EDICION,GEMAS,fabrica});
})();

/* Modelos 3D sencillos para la prueba de ARPG (arpg-three): Adreida, el Goblin
   de Camino, el Kobold lancero, el Saqueador y Can, el de los Goblins. Son
   low poly, hechos con primitivas de three.js (cápsulas, cajas, conos) y
   colores por vértice sacados de su carta, sin archivos de modelo.
     · Esqueleto de huesos (THREE.Bone): cadera, torso, cabeza, brazos con
       antebrazo y mano, piernas con rodilla (y cola para el kobold). Todas las
       piezas se funden en una sola malla con piel (SkinnedMesh) por material,
       cada una atada a su hueso: tres llamadas de dibujo por personaje.
     · Tres materiales por personaje (piel y tela, metal, brillo de los ojos),
       con un destello al recibir un golpe, un contorno de luz (el aviso de que
       va a atacar) y el disolverse en brasas al morir inyectados en su shader.
     · posar(m,a) pone la pose de cada animación (quieto, andar, golpe, revés,
       estocada, esquiva, aviso, torbellino, salto, grito, lanzar, aturdido, muerte)
       a partir de un reloj: no hay clips, todo es procedural. Adreida lleva el
       hacha con las dos manos (cinemática inversa de los brazos).
   CAOZ_ARPG_MODELOS.fabrica(THREE) → {crear(tipo), posar(m,a), TIPOS}. */
'use strict';
(function(){
  const TAU=Math.PI*2;
  const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
  const tramo=(k,a,b)=>suave((k-a)/(b-a));
  function fabrica(THREE){
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    const matriz=(pos=[0,0,0],rot=[0,0,0],esc=1)=>new THREE.Matrix4().compose(V(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),Array.isArray(esc)?V(...esc):V(esc,esc,esc));
    const G={
      caja:(w,h,d)=>new THREE.BoxGeometry(w,h,d),
      bola:(r,a=8,b=6)=>new THREE.SphereGeometry(r,a,b),
      casco:(r,a=8,b=4,t=Math.PI/2)=>new THREE.SphereGeometry(r,a,b,0,TAU,0,t),
      capsula:(r,l,s=7)=>new THREE.CapsuleGeometry(r,l,2,s),
      cono:(r,h,s=6)=>new THREE.ConeGeometry(r,h,s),
      cil:(r1,r2,h,s=8,abierto=false)=>new THREE.CylinderGeometry(r1,r2,h,s,1,abierto),
      toro:(r,t,s=12)=>new THREE.TorusGeometry(r,t,5,s),
    };
    // Funde las piezas de un hueso (geometría transformada + color) en una sola geometría con color por
    // vértice. Cada cara varía un poco de tono: el aire facetado de los modelos low poly.
    let semilla=1;const azar=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
    // Cada pieza lleva el índice de su hueso (skinIndex) con peso 1: se mueve rígida con él.
    function fundir(piezas){
      let n=0;const gs=piezas.map(p=>{const g=(p.geo.index?p.geo.toNonIndexed():p.geo.clone());g.applyMatrix4(p.m);n+=g.attributes.position.count;return [g,p.color,p.vario,p.hueso];});
      const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3),SI=new Uint16Array(n*4),SW=new Float32Array(n*4),c=new THREE.Color();let o=0;
      for(const [g,color,vario,hueso] of gs){const p=g.attributes.position,q=g.attributes.normal;c.set(color);let f=1;
        for(let i=0;i<p.count;i++){if(i%3===0)f=1+(azar()-.5)*vario;const j=(o+i)*3;P[j]=p.getX(i);P[j+1]=p.getY(i);P[j+2]=p.getZ(i);N[j]=q.getX(i);N[j+1]=q.getY(i);N[j+2]=q.getZ(i);C[j]=c.r*f;C[j+1]=c.g*f;C[j+2]=c.b*f;SI[(o+i)*4]=hueso;SW[(o+i)*4]=1;}
        o+=p.count;g.dispose();}
      for(const p of piezas)p.geo.dispose();
      const r=new THREE.BufferGeometry();r.setAttribute('position',new THREE.BufferAttribute(P,3));r.setAttribute('normal',new THREE.BufferAttribute(N,3));r.setAttribute('color',new THREE.BufferAttribute(C,3));
      r.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));r.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SW,4));r.computeBoundingSphere();return r;}

    // Los materiales de un personaje: comparten los uniformes del destello y del disolverse.
    function materiales(){
      const u={uDisuelve:{value:0},uDestello:{value:0},uColorD:{value:new THREE.Color(1,1,1)},uBorde:{value:0},uColorB:{value:new THREE.Color(1,.2,.05)}};
      const hacer=(p,brillo=0)=>{const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,...p});
        m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u,{uBrillo:{value:brillo}});
          sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPosD;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPosD=position;');
          sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform float uDisuelve,uDestello,uBrillo,uBorde;uniform vec3 uColorD,uColorB;varying vec3 vPosD;
float azarM(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float ruidoM(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(azarM(i),azarM(i+vec3(1,0,0)),f.x),mix(azarM(i+vec3(0,1,0)),azarM(i+vec3(1,1,0)),f.x),f.y),mix(mix(azarM(i+vec3(0,0,1)),azarM(i+vec3(1,0,1)),f.x),mix(azarM(i+vec3(0,1,1)),azarM(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
            .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfloat quemaM=ruidoM(vPosD*14.)*.65+ruidoM(vPosD*37.)*.35;if(uDisuelve>0.&&quemaM<uDisuelve*1.15-.08)discard;')
            .replace('#include <opaque_fragment>',`outgoingLight+=vColor.rgb*uBrillo;
float fresM=pow(clamp(1.-abs(dot(normalize(vViewPosition),normal)),0.,1.),2.);outgoingLight+=uColorB*uBorde*(fresM*4.+.12);
outgoingLight=mix(outgoingLight,uColorD*1.6,uDestello);
if(uDisuelve>0.){float bordeM=1.-smoothstep(0.,.1,quemaM-(uDisuelve*1.15-.08));outgoingLight=mix(outgoingLight,vec3(5.,1.6,.3),bordeM);}
#include <opaque_fragment>`);};
        m.customProgramCacheKey=()=>'arpg-modelo';return m;};
      return {u,piel:hacer({roughness:.82,metalness:0}),metal:hacer({roughness:.32,metalness:.85}),brillo:hacer({roughness:1,metalness:0,color:0x000000},4)};
    }

    // El esqueleto común (de pie en el origen, mirando a +Z; su derecha es -X).
    function esqueleto(p){
      const g=()=>new THREE.Bone(),raiz=new THREE.Group(),cuerpo=g(),cadera=g(),torso=g(),cabeza=g();
      raiz.add(cuerpo);cuerpo.add(cadera);cadera.position.y=p.muslo+p.pierna+(p.pie||.04);cadera.add(torso);torso.position.y=p.cintura;torso.add(cabeza);cabeza.position.y=p.torso;
      const H={raiz,cuerpo,cadera,torso,cabeza};
      for(const [lado,s] of [['I',1],['D',-1]]){
        const brazo=g(),ante=g(),mano=g(),pierna=g(),rodilla=g(),pie=g();
        torso.add(brazo);brazo.position.set(s*p.hombros,p.torso*.86,0);brazo.add(ante);ante.position.y=-p.brazo;ante.add(mano);mano.position.y=-p.antebrazo;
        cadera.add(pierna);pierna.position.set(s*p.ancho,0,0);pierna.add(rodilla);rodilla.position.y=-p.muslo;rodilla.add(pie);pie.position.y=-p.pierna;
        Object.assign(H,{['brazo'+lado]:brazo,['ante'+lado]:ante,['mano'+lado]:mano,['pierna'+lado]:pierna,['rodilla'+lado]:rodilla,['pie'+lado]:pie});}
      if(p.cola){const c1=g(),c2=g();cadera.add(c1);c1.position.set(0,-.05,-.14);c1.add(c2);c2.position.set(0,0,-.3);Object.assign(H,{cola:c1,cola2:c2});}
      return H;
    }
    // Recoge las piezas por material (con su hueso); al final las funde en una malla con piel por material.
    function constructor(H){
      const piezas=new Map(),huesos=[];H.cuerpo.traverse(o=>{if(o.isBone)huesos.push(o);});
      const pon=(hueso,mat,geo,color,pos,rot,esc,vario=.14)=>{if(!piezas.has(mat))piezas.set(mat,[]);piezas.get(mat).push({geo,color,m:matriz(pos,rot,esc),vario,hueso:huesos.indexOf(H[hueso]),nombre:hueso});};
      const montar=M=>{H.raiz.updateMatrixWorld(true);const esq=new THREE.Skeleton(huesos),mallas=[];
        for(const [mat,lista] of piezas){for(const p of lista)p.m.premultiply(H[p.nombre].matrixWorld);
          const malla=new THREE.SkinnedMesh(fundir(lista),M[mat]);malla.castShadow=mat!=='brillo';malla.receiveShadow=true;malla.frustumCulled=false;H.raiz.add(malla);malla.bind(esq,malla.matrixWorld);mallas.push(malla);}
        return mallas;};
      // Miembros: una cápsula que cuelga del hueso.
      const miembro=(hueso,r,l,color,esc=[1,1,1])=>pon(hueso,'piel',G.capsula(r,l),color,[0,-l/2-r*.3,0],[0,0,0],esc);
      return {pon,montar,miembro};
    }

    const TIPOS={
      adreida:{nombre:'Adreida',alto:1.95,radio:.42},
      goblin:{nombre:'Goblin de Camino',alto:1.15,radio:.34},
      kobold:{nombre:'Kobold lancero',alto:1.25,radio:.34},
      saqueador:{nombre:'Saqueador de Tomsage',alto:1.8,radio:.42},
      can:{nombre:'Can, el de los Goblins',alto:2.4,radio:.62},
      mohamed:{nombre:'Mohamed',alto:1.85,radio:.4},
    };

    function adreida(){
      const p={muslo:.47,pierna:.45,pie:.05,cintura:.08,torso:.52,hombros:.25,brazo:.31,antebrazo:.29,ancho:.11},H=esqueleto(p),{pon,montar,miembro}=constructor(H);
      const piel=0x86c49c,pelo=0x1c1f38,cuero=0x3e2b1f,negro=0x1d1a23,brazal=0x6d4529,piel2=0x7ab38e;
      // Cadera: pantalón, cinturón con hebilla y cráneos, falda de piel.
      pon('cadera','piel',G.caja(.34,.2,.21),negro,[0,0,0]);
      pon('cadera','piel',G.cil(.2,.205,.08,10),cuero,[0,.06,0],[0,0,0],[1,1,.68]);
      pon('cadera','metal',G.caja(.07,.065,.02),0xd8d8e0,[0,.06,.145]);
      for(const [x,z] of [[.12,.12],[.19,.06]]){pon('cadera','piel',G.bola(.042,6,5),0xefe6d2,[x,.0,z],[0,0,0],[1,1.15,1]);pon('cadera','piel',G.cono(.02,.05,4),0xefe6d2,[x,-.05,z],[Math.PI,0,0]);}
      pon('cadera','piel',G.cil(.2,.3,.3,9,true),0x6e5238,[0,-.14,0],[0,0,0],[1,1,.78],.35);
      for(const l of ['I','D']){miembro('pierna'+l,.085,.3,negro);miembro('rodilla'+l,.07,.28,negro);
        pon('pie'+l,'piel',G.caja(.13,.2,.18),cuero,[0,.06,.01]);pon('pie'+l,'piel',G.caja(.12,.07,.12),cuero,[0,-.005,.1]);}
      // Torso: abdomen, pecho, top negro, correa, colgante y hombrera de cuero (lado izquierdo).
      pon('torso','piel',G.capsula(.14,.1),piel,[0,.1,0],[0,0,0],[1.18,1,.78]);
      pon('torso','piel',G.capsula(.16,.1),piel,[0,.33,0],[0,0,0],[1.28,1,.82]);
      pon('torso','piel',G.capsula(.168,.06),negro,[0,.35,.004],[0,0,0],[1.3,1,.88]);
      pon('torso','piel',G.cil(.08,.09,.1,8),negro,[0,.5,0]);
      pon('torso','piel',G.caja(.045,.56,.02),cuero,[0,.33,.132],[0,0,.62]);
      pon('torso','metal',G.toro(.028,.009,10),0xd9dbe6,[0,.44,.14]);
      pon('torso','piel',G.bola(.14,7,5),0x2b2632,[.26,.49,0],[0,0,-.3],[1.25,.75,1.1]);
      pon('torso','piel',G.bola(.12,7,5),0x383140,[.3,.42,0],[0,0,-.5],[1.1,.7,1.05]);
      pon('torso','metal',G.bola(.022,5,4),0xc9ccd6,[.36,.53,.07]);
      // Cabeza: mandíbula ancha, colmillos, ojos rojos, orejas en punta y la melena azul noche.
      pon('cabeza','piel',G.cil(.06,.066,.1,7),piel2,[0,.03,0]);
      pon('cabeza','piel',G.bola(.125,8,7),piel,[0,.18,.01],[0,0,0],[.95,1.1,1]);
      pon('cabeza','piel',G.caja(.16,.07,.13),piel2,[0,.1,.03]);
      for(const s of [1,-1]){pon('cabeza','piel',G.cono(.017,.055,5),0xf3ecd8,[s*.05,.13,.1],[.2,0,0]);
        pon('cabeza','brillo',G.caja(.038,.016,.01),0xff2238,[s*.045,.19,.118],[0,0,s*.18]);
        pon('cabeza','piel',G.caja(.05,.012,.012),0x14161f,[s*.045,.212,.12],[0,0,-s*.35]);
        pon('cabeza','piel',G.cono(.03,.13,4),piel,[s*.125,.2,-.01],[0,0,-s*1.2]);}
      pon('cabeza','piel',G.casco(.142,9,4),pelo,[0,.19,-.01],[-.25,0,0],[1.02,1.05,1.08],.3);
      pon('cabeza','piel',G.capsula(.075,.32),pelo,[0,.0,-.1],[.18,0,0],[1.5,1,.8],.3);
      for(const s of [1,-1]){pon('cabeza','piel',G.capsula(.05,.26),pelo,[s*.1,.02,-.06],[.15,0,s*.18],1,.3);pon('cabeza','piel',G.capsula(.035,.2),pelo,[s*.115,.1,.05],[-.05,0,s*.08],1,.3);
        pon('cabeza','piel',G.cono(.045,.12,4),pelo,[s*.05,.27,.1],[.9,0,s*.4]);}
      // Brazos: piel, brazales de cuero con púas y manos.
      for(const l of ['I','D']){const s=l==='I'?1:-1;miembro('brazo'+l,.066,.2,piel,[1.05,1,1]);miembro('ante'+l,.056,.18,piel);
        pon('ante'+l,'piel',G.cil(.072,.078,.2,7),brazal,[0,-.15,0]);
        for(let i=0;i<3;i++)pon('ante'+l,'piel',G.cono(.018,.07,4),0xdcd2bf,[s*.07,-.08-i*.06,-.01],[0,0,-s*1.4]);
        pon('mano'+l,'piel',G.bola(.058,6,5),piel2,[0,-.03,0],[0,0,0],[1,1.1,1.15]);}
      // El hacha de guerra en la mano derecha, como prolongación del brazo (el mango sigue al antebrazo, hacia -Y de la mano).
      // La cabeza es de doble filo (un filo a cada lado, en ±Z): corta igual en el tajo y en el revés, y con la cara
      // plana hacia arriba cuando el brazo está horizontal se lee bien desde la cámara.
      const hierro=0xc9ced8,filo=0xeef1f6,mango=0x3a2616,cuero2=0x5a3a22;
      pon('manoD','piel',G.cil(.026,.03,1.3,6),mango,[0,-.5,0]);
      for(const y of [.03,-.3])pon('manoD','piel',G.cil(.034,.034,.1,6),cuero2,[0,y,0]);
      pon('manoD','metal',G.bola(.045,6,5),hierro,[0,.17,0]);
      pon('manoD','metal',G.cil(.045,.045,.26,6),hierro,[0,-1.02,0]);
      for(const s of [1,-1]){
        // Cada filo: una cuña que se abre desde el mango (barba abajo), con el borde de acero claro.
        pon('manoD','metal',G.caja(.035,.24,.2),hierro,[0,-1.02,s*.14],[s*.12,0,0],1,.08);
        pon('manoD','metal',G.caja(.028,.42,.1),filo,[0,-1.02,s*.28],[s*.05,0,0],1,.06);
        pon('manoD','metal',G.cono(.05,.12,4),filo,[0,-.8,s*.3],[0,0,0],[.35,1,1]);
        pon('manoD','metal',G.cono(.05,.12,4),filo,[0,-1.24,s*.3],[Math.PI,0,0],[.35,1,1]);}
      pon('manoD','metal',G.cono(.035,.14,4),hierro,[0,-1.22,0],[Math.PI,Math.PI/4,0]);
      return {H,montar,p};
    }
    function goblin(){
      const p={muslo:.24,pierna:.22,pie:.05,cintura:.05,torso:.3,hombros:.17,brazo:.2,antebrazo:.19,ancho:.08},H=esqueleto(p),{pon,montar,miembro}=constructor(H);
      const piel=0x8d9b4f,piel2=0x7a8943,chaleco=0x5b4230,panuelo=0x8e3324,tela=0x4f4636,bota=0x3d2c20;
      pon('cadera','piel',G.caja(.24,.13,.16),tela,[0,0,0]);pon('cadera','piel',G.cil(.15,.2,.18,7,true),tela,[0,-.08,0],[0,0,0],[1,1,.8],.35);
      pon('cadera','piel',G.cil(.14,.145,.05,8),0x2e2218,[0,.05,0],[0,0,0],[1,1,.75]);pon('cadera','piel',G.caja(.08,.07,.06),0x6b4c32,[.1,.0,.1]);
      for(const l of ['I','D']){miembro('pierna'+l,.055,.16,piel2);miembro('rodilla'+l,.05,.14,piel2);pon('pie'+l,'piel',G.caja(.1,.13,.15),bota,[0,.04,.02]);pon('pie'+l,'piel',G.cil(.07,.06,.06,6),bota,[0,.1,0]);}
      pon('torso','piel',G.capsula(.12,.12),chaleco,[0,.14,0],[0,0,0],[1.1,1,.85]);pon('torso','piel',G.capsula(.1,.08),piel,[0,.16,.02],[0,0,0],[.9,1,.8]);
      pon('torso','piel',G.caja(.03,.34,.02),0x2e2218,[0,.15,.1],[0,0,.7]);
      pon('torso','piel',G.cil(.1,.13,.08,8),panuelo,[0,.29,0],[0,0,0],1,.3);pon('torso','piel',G.cono(.16,.3,6),panuelo,[0,.12,-.1],[-.25,0,0],[1,1,.4],.3);
      pon('cabeza','piel',G.bola(.14,8,6),piel,[0,.14,.01],[0,0,0],[1.05,.98,1]);pon('cabeza','piel',G.caja(.16,.06,.1),piel2,[0,.06,.06]);
      pon('cabeza','piel',G.cono(.035,.14,5),piel2,[0,.12,.17],[Math.PI/2+.25,0,0]);
      for(const s of [1,-1]){pon('cabeza','piel',G.cono(.055,.3,4),piel,[s*.2,.19,-.02],[0,0,-s*(Math.PI/2-.3)],[1,1,.35]);
        pon('cabeza','brillo',G.bola(.025,6,4),0xffd23a,[s*.052,.16,.12]);pon('cabeza','piel',G.caja(.06,.015,.02),0x2a2a12,[s*.05,.19,.125],[0,0,s*.3]);
        pon('cabeza','piel',G.cono(.01,.03,4),0xefe6d2,[s*.04,.06,.11],[Math.PI,0,0]);}
      pon('cabeza','piel',G.casco(.145,8,3,1.1),0x3a3024,[0,.18,-.02],[-.4,0,0],1,.3);
      for(const l of ['I','D']){miembro('brazo'+l,.045,.13,piel);miembro('ante'+l,.042,.12,piel);pon('ante'+l,'piel',G.cil(.05,.055,.1,6),chaleco,[0,-.1,0]);pon('mano'+l,'piel',G.bola(.045,6,5),piel2,[0,-.02,0]);}
      pon('manoD','piel',G.cil(.018,.02,.46,6),0x6b4a2e,[0,-.02,.1],[Math.PI/2,0,0]);
      pon('manoD','metal',G.caja(.02,.15,.12),0xa6acb4,[0,.05,.3]);
      return {H,montar,p};
    }
    function kobold(){
      const p={muslo:.24,pierna:.25,pie:.05,cintura:.05,torso:.32,hombros:.16,brazo:.21,antebrazo:.2,ancho:.08,cola:true},H=esqueleto(p),{pon,montar,miembro}=constructor(H);
      const esc=0xb4513a,esc2=0x9c4230,vientre=0xd89868,tunica=0x6b6352,cuerno=0xe8dcc0;
      pon('cadera','piel',G.caja(.22,.13,.16),tunica,[0,0,0]);pon('cadera','piel',G.cil(.15,.24,.36,7,true),tunica,[0,-.15,0],[0,0,0],[1,1,.85],.35);
      for(const l of ['I','D']){miembro('pierna'+l,.055,.16,esc);miembro('rodilla'+l,.048,.16,esc2);pon('pie'+l,'piel',G.caja(.1,.05,.18),esc2,[0,.0,.05]);for(const x of [-.03,0,.03])pon('pie'+l,'piel',G.cono(.013,.05,4),cuerno,[x,.0,.15],[Math.PI/2,0,0]);}
      pon('cola','piel',G.cono(.07,.34,6),esc,[0,0,-.15],[-Math.PI/2,0,0]);pon('cola2','piel',G.cono(.045,.3,6),esc2,[0,0,-.12],[-Math.PI/2,0,0]);
      pon('torso','piel',G.capsula(.12,.14),tunica,[0,.15,0],[0,0,0],[1.05,1,.85],.3);pon('torso','piel',G.capsula(.08,.1),vientre,[0,.16,.04],[0,0,0],[.9,1,.7]);
      pon('torso','piel',G.cil(.09,.15,.12,7),0x5a5344,[0,.3,-.01],[0,0,0],1,.35);
      pon('cabeza','piel',G.bola(.11,8,6),esc,[0,.14,-.02]);pon('cabeza','piel',G.caja(.1,.08,.18),esc,[0,.1,.11],[.1,0,0]);pon('cabeza','piel',G.caja(.09,.03,.15),vientre,[0,.055,.1],[.08,0,0]);
      for(const s of [1,-1]){pon('cabeza','piel',G.cono(.028,.18,5),cuerno,[s*.07,.24,-.1],[-2.3,0,s*.3]);
        pon('cabeza','brillo',G.bola(.022,6,4),0xffc93a,[s*.06,.17,.07]);pon('cabeza','piel',G.cono(.045,.12,4),esc2,[s*.1,.16,-.06],[0,0,-s*1.1],[1,1,.4]);}
      for(const l of ['I','D']){miembro('brazo'+l,.045,.14,tunica);miembro('ante'+l,.04,.13,esc);pon('mano'+l,'piel',G.bola(.042,6,5),esc2,[0,-.02,0]);}
      pon('manoD','piel',G.cil(.016,.016,1.3,6),0x6b4a2e,[0,-.02,.25],[Math.PI/2,0,0]);
      pon('manoD','metal',G.cono(.035,.16,4),0xb8bec6,[0,-.02,.98],[Math.PI/2,0,0]);
      pon('manoD','piel',G.caja(.05,.04,.03),0xb5402e,[0,-.02,.86]);
      return {H,montar,p};
    }
    function humano(capitan){
      const p=capitan?{muslo:.5,pierna:.48,pie:.06,cintura:.1,torso:.58,hombros:.3,brazo:.34,antebrazo:.32,ancho:.13}:{muslo:.44,pierna:.42,pie:.05,cintura:.07,torso:.5,hombros:.23,brazo:.3,antebrazo:.28,ancho:.1};
      const H=esqueleto(p),{pon,montar,miembro}=constructor(H),k=capitan?1.2:1;
      const piel=0xc99a78,capa=capitan?0x7d2323:0x34303c,cuero=0x5a4536,cuero2=0x43342a,panta=0x3a3430,bota=0x2a2019,acero=0xa9aeb8;
      pon('cadera','piel',G.caja(.34*k,.2,.21*k),panta,[0,0,0]);pon('cadera','piel',G.cil(.2*k,.205*k,.07,10),cuero2,[0,.06,0],[0,0,0],[1,1,.7]);pon('cadera','metal',G.caja(.06,.05,.02),0xb89a5a,[0,.06,.15*k]);
      pon('cadera','piel',G.cil(.2*k,.27*k,.28,8,true),cuero,[0,-.12,0],[0,0,0],[1,1,.8],.25);
      for(const l of ['I','D']){miembro('pierna'+l,.085*k,.28*k,panta);miembro('rodilla'+l,.072*k,.27*k,panta);pon('pie'+l,'piel',G.caja(.13*k,.2,.19*k),bota,[0,.06,.02]);if(capitan)pon('rodilla'+l,'metal',G.caja(.13,.12,.06),acero,[0,-.04,.07]);}
      pon('torso','piel',G.capsula(.16*k,.18),cuero,[0,.22,0],[0,0,0],[1.25,1,.85],.2);pon('torso','piel',G.caja(.3*k,.05,.24*k),cuero2,[0,.08,0]);
      pon('torso','piel',G.caja(.5*k,.7*k,.03),capa,[0,.2,-.17*k],[.1,0,0],1,.25);
      pon('torso','piel',G.cil(.1*k,.16*k,.1,8),capa,[0,.47,0],[0,0,0],1,.25);
      if(capitan)for(const s of [1,-1]){pon('torso','metal',G.bola(.15,7,5),acero,[s*.33,.52,0],[0,0,-s*.3],[1.2,.75,1.15]);pon('torso','metal',G.cono(.03,.14,4),0xd8d0b8,[s*.4,.62,0],[0,0,-s*.5]);}
      pon('cabeza','piel',G.cil(.055*k,.06*k,.1,7),piel,[0,.03,0]);pon('cabeza','piel',G.bola(.12*k,8,7),piel,[0,.17*k,.01],[0,0,0],[.95,1.08,1]);
      if(capitan){pon('cabeza','metal',G.casco(.14*k,9,4),acero,[0,.19*k,0],[-.1,0,0],[1,1.05,1.08]);pon('cabeza','metal',G.caja(.025,.13,.03),acero,[0,.14*k,.14*k]);
        pon('cabeza','piel',G.caja(.16,.08,.1),0x4a2a1a,[0,.07*k,.08],[0,0,0],1,.3);for(const s of [1,-1])pon('cabeza','metal',G.cono(.035,.2,5),0xe8dcc0,[s*.15,.28*k,0],[0,0,-s*.7]);}
      else{pon('cabeza','piel',G.casco(.148,9,5,1.9),capa,[0,.17,-.012],[-.35,0,0],[1,1.05,1.1],.25);pon('cabeza','piel',G.caja(.17,.08,.08),0x2a2226,[0,.1,.08]);}
      for(const s of [1,-1])pon('cabeza','brillo',G.caja(.03,.012,.01),capitan?0xff6a3a:0xd8c49a,[s*.042,.18*k,.118*k]);
      for(const l of ['I','D']){miembro('brazo'+l,.065*k,.2*k,cuero);miembro('ante'+l,.055*k,.18*k,piel);pon('ante'+l,'piel',G.cil(.068*k,.074*k,.17*k,7),cuero2,[0,-.15*k,0]);pon('mano'+l,'piel',G.bola(.055*k,6,5),piel,[0,-.03,0]);}
      if(capitan){// Un hacha de guerra a dos manos.
        pon('manoD','piel',G.cil(.028,.028,1.5,6),0x4a3322,[0,-.03,.45],[Math.PI/2,0,0]);
        pon('manoD','metal',G.caja(.03,.36,.26),acero,[0,.1,1.05],[0,0,0],1,.08);pon('manoD','metal',G.caja(.03,.2,.2),acero,[0,-.15,1.05],[0,0,0],1,.08);
        pon('manoD','metal',G.cono(.04,.2,4),acero,[0,-.03,1.28],[Math.PI/2,0,0]);}
      else{pon('manoD','piel',G.cil(.02,.02,.2,6),0x2e2018,[0,-.03,0],[Math.PI/2,0,0]);pon('manoD','metal',G.caja(.2,.035,.04),0x8a7a5a,[0,-.03,.11]);
        pon('manoD','metal',G.caja(.06,.014,.78),acero,[0,-.03,.52],[0,0,0],1,.06);pon('manoD','metal',G.cono(.03,.12,4),acero,[0,-.03,.97],[Math.PI/2,0,Math.PI/4],[1,1,.3]);
        // El escudo redondo en el brazo izquierdo.
        pon('anteI','piel',G.cil(.27,.27,.04,12),0x6b4a2e,[.1,-.17,.02],[0,0,Math.PI/2],1,.2);pon('anteI','metal',G.toro(.27,.022,14),acero,[.12,-.17,.02],[0,Math.PI/2,0]);pon('anteI','metal',G.bola(.06,6,4),acero,[.13,-.17,.02],[0,0,-Math.PI/2],[1,.6,1]);}
      return {H,montar,p};
    }
    // Una persona del grupo: piernas, torso, cabeza con cara y brazos; cada uno añade su ropa y su arma.
    function persona(o){
      const p={muslo:.44,pierna:.42,pie:.05,cintura:.07,torso:.5,hombros:.22,brazo:.3,antebrazo:.28,ancho:.1,...o.p},H=esqueleto(p),{pon,montar,miembro}=constructor(H);
      pon('cadera','piel',G.caja(.3,.18,.19),o.pantalon,[0,0,0]);pon('cadera','piel',G.cil(.17,.175,.06,10),o.cinturon,[0,.06,0],[0,0,0],[1,1,.72]);
      for(const l of ['I','D']){miembro('pierna'+l,.075,.28,o.pantalon);miembro('rodilla'+l,.065,.27,o.pantalon);pon('pie'+l,'piel',G.caja(.12,.18,.18),o.botas,[0,.05,.02]);}
      pon('torso','piel',G.capsula(.14,.16),o.camisa,[0,.2,0],[0,0,0],[1.15,1,.8],.18);
      pon('cabeza','piel',G.cil(.05,.055,.1,7),o.piel,[0,.03,0]);pon('cabeza','piel',G.bola(.115,8,7),o.piel,[0,.16,.01],[0,0,0],[.92,1.06,1]);
      for(const s of [1,-1]){pon('cabeza','piel',G.caja(.034,.02,.01),0xf4f0ea,[s*.042,.17,.108]);pon('cabeza','brillo',G.caja(.014,.018,.012),o.ojos||0x2a1a10,[s*.042,.17,.113]);
        pon('cabeza','piel',G.caja(.045,.01,.012),o.pelo,[s*.043,.198,.108],[0,0,-s*.12]);}
      for(const l of ['I','D']){miembro('brazo'+l,.058,.19,o.mangas||o.camisa);miembro('ante'+l,.05,.17,o.antebrazos||o.piel);pon('mano'+l,'piel',G.bola(.05,6,5),o.piel,[0,-.03,0]);}
      o.extra(pon,H);
      return {H,montar,p};
    }
    // Mohamed: túnica larga, capa, barba y el sombrero de ala ancha con la punta caída; una pistola de chispa en la derecha.
    // La pistola sigue al antebrazo (el cañón hacia -Y de la mano): con el brazo al frente, apunta adonde mira.
    function mohamed(){return persona({pantalon:0x2b2028,cinturon:0x6a2a24,botas:0x1e1614,camisa:0x3a2a3e,piel:0xb07a58,pelo:0x1e1612,ojos:0xffc070,
      extra(pon){pon('cadera','piel',G.cil(.19,.34,.72,9,true),0x33243a,[0,-.32,0],[0,0,0],[1,1,.85],.3);pon('torso','piel',G.caja(.46,.66,.03),0x281c2c,[0,.18,-.15],[.08,0,0],1,.25);
        pon('torso','piel',G.cil(.09,.15,.1,8),0x5a2a2a,[0,.47,0]);pon('cabeza','piel',G.cono(.08,.14,6),0x1e1612,[0,.07,.08],[Math.PI+.35,0,0],[1.2,1,.7]);
        pon('cabeza','piel',G.cil(.3,.3,.02,14),0x2c2230,[0,.25,0],[.08,0,0]);pon('cabeza','piel',G.cono(.12,.38,8),0x2c2230,[0,.43,-.03],[-.28,0,0]);pon('cabeza','piel',G.cil(.125,.125,.04,10),0x7a2a2a,[0,.28,-.01]);
        pon('cadera','piel',G.caja(.1,.12,.05),0x5a3a22,[.16,-.02,.1]);for(const x of [-.12,-.05,.02])pon('cadera','metal',G.cil(.014,.014,.06,5),0xc8a050,[x,.07,.15],[Math.PI/2,0,0]);
        pon('manoD','metal',G.cil(.024,.028,.3,8),0x5a5e66,[0,-.2,0],[0,0,0],1,.06);pon('manoD','metal',G.toro(.03,.008,8),0xc8a050,[0,-.34,0],[Math.PI/2,0,0]);
        pon('manoD','piel',G.caja(.045,.07,.14),0x5a3422,[0,-.02,-.06],[-.35,0,0]);pon('manoD','metal',G.caja(.02,.05,.03),0xc8a050,[0,-.08,.035]);}});}
    const constructores={adreida,goblin,kobold,saqueador:()=>humano(false),can:()=>humano(true),mohamed};
    function crear(tipo){
      semilla=[...tipo].reduce((a,c)=>a*31+c.charCodeAt(0),7)%2147483646+1;
      const M=materiales(),{H,montar,p}=constructores[tipo](),mallas=montar(M);
      // El extremo del hacha de Adreida, la cabeza (para colocar el rastro del corte y para las pruebas).
      if(tipo==='adreida'){const punta=new THREE.Object3D();punta.position.set(0,-1.1,0);H.manoD.add(punta);M.punta=punta;}
      // La boca de la pistola de Mohamed (de donde salen las balas).
      if(tipo==='mohamed'){const boca=new THREE.Object3D();boca.position.set(0,-.36,0);H.manoD.add(boca);M.boca=boca;M.punta=boca;}
      return {tipo,H,M,mallas,p,raiz:H.raiz,...TIPOS[tipo]};
    }

    /* ---- El hacha a dos manos de Adreida ------------------------------------------------------
       Cada pose dice dónde está la empuñadura (G, la mano derecha) y hacia dónde apunta el hacha (A),
       en el espacio del torso; los dos brazos llegan con cinemática inversa de dos huesos: la derecha
       a G, junto al pomo, y la izquierda 30 cm hacia la cabeza del hacha. La mano derecha se orienta para
       que el hacha (su -Y) siga A, con la cara plana hacia «arriba» (en los tajos horizontales, al
       cielo: se ve desde la cámara; en el hachazo vertical, de lado: el filo corta de arriba abajo). */
    const _v=Array.from({length:10},()=>new THREE.Vector3()),_q=new THREE.Quaternion(),_m=new THREE.Matrix4(),ABAJO=new THREE.Vector3(0,-1,0);
    function apuntarHueso(b,dir){b.parent.getWorldQuaternion(_q).invert();b.quaternion.setFromUnitVectors(ABAJO,_v[9].copy(dir).normalize().applyQuaternion(_q));b.updateMatrixWorld(true);}
    function ik(brazo,ante,mano,T,polo){const S=brazo.getWorldPosition(_v[0]),a=ante.position.length(),b=mano.position.length(),D=_v[1].copy(T).sub(S);
      const d=Math.min(a+b-1e-3,Math.max(Math.abs(a-b)+1e-3,D.length())),dir=D.normalize(),x=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));
      const p=_v[2].copy(polo).sub(S);p.addScaledVector(dir,-p.dot(dir));if(p.lengthSq()<1e-8)p.set(0,-1,0);p.normalize();
      const E=_v[3].copy(S).addScaledVector(dir,x).addScaledVector(p,h);apuntarHueso(brazo,_v[4].copy(E).sub(S));apuntarHueso(ante,_v[5].copy(S).addScaledVector(dir,d).sub(E));}
    const dirA=(f,e)=>[Math.sin(f)*Math.cos(e),Math.sin(e),Math.cos(f)*Math.cos(e)];
    function empunar(m,{G,A,arriba}){const H=m.H;H.raiz.updateMatrixWorld(true);const T=H.torso.matrixWorld;
      const g=_v[6].fromArray(G).applyMatrix4(T),a=_v[7].fromArray(A).transformDirection(T),up=_v[8].fromArray(arriba||[0,1,0]).transformDirection(T);
      // Los dos agarres deben quedar al alcance sin estirar los brazos ni soltar el mango.
      const separacion=.3,sd=H.brazoD.getWorldPosition(new THREE.Vector3()),si=H.brazoI.getWorldPosition(new THREE.Vector3()).addScaledVector(a,-separacion);
      const alcance=m.p.brazo+m.p.antebrazo-.015;
      for(let i=0;i<8;i++)for(const centro of [sd,si]){const delta=g.clone().sub(centro);if(delta.length()>alcance)g.copy(centro).add(delta.setLength(alcance));}
      ik(H.brazoD,H.anteD,H.manoD,g,new THREE.Vector3(-.7,-.5,-.35).applyMatrix4(T));
      // La mano derecha: -Y por el mango, X (la cara del hacha) lo más cerca posible de «arriba».
      const y=a.clone().negate(),x=up.clone().addScaledVector(y,-up.dot(y));if(x.lengthSq()<1e-6)x.set(1,0,0);x.normalize();const z=new THREE.Vector3().crossVectors(x,y);
      H.manoD.parent.getWorldQuaternion(_q).invert();H.manoD.quaternion.setFromRotationMatrix(_m.makeBasis(x,y,z)).premultiply(_q);H.manoD.updateMatrixWorld(true);
      // La izquierda envuelve el mango entre la derecha y la cabeza, nunca fuera del pomo.
      const apoyo=H.manoD.localToWorld(new THREE.Vector3(0,-separacion,0));
      ik(H.brazoI,H.anteI,H.manoI,apoyo,new THREE.Vector3(.7,-.5,-.35).applyMatrix4(T));
      const orientacion=H.manoD.getWorldQuaternion(new THREE.Quaternion());
      H.manoI.parent.getWorldQuaternion(_q).invert();H.manoI.quaternion.copy(_q).multiply(orientacion);H.manoI.updateMatrixWorld(true);}
    // Dónde lleva el hacha en cada animación (espacio del torso: +Z delante, +X su izquierda, -X su derecha).
    function agarreAdreida(a){const k=a.k||0,t=a.t||0;
      // El mango descansa sobre el hombro derecho; la cabeza queda detrás y las manos delante del pecho.
      const reposo=()=>{const bob=a.anim==='andar'?Math.sin((a.fase||0)*2)*.008*(a.paso??1):Math.sin(t*2.2)*.004;return {G:[-.11,.35+bob,.36],A:dirA(-2.73,.46),arriba:[0,1,0]};};
      const horizontal=(f,e)=>{const r=.42-.08*Math.abs(Math.sin(f));return {G:[Math.sin(f)*r,.28,Math.cos(f)*r],A:dirA(f,e),arriba:[0,1,0]};};
      const mezcla=(p,q,w)=>({G:p.G.map((v,i)=>v+(q.G[i]-v)*w),A:(()=>{const v=p.A.map((x,i)=>x+(q.A[i]-x)*w),l=Math.hypot(...v)||1;return v.map(x=>x/l);})(),arriba:q.arriba||p.arriba});
      const vertical=al=>({G:[-.04,.35+Math.sin(al)*.38,.05+Math.cos(al)*.38],A:[-.08,Math.sin(al),Math.cos(al)],arriba:[1,0,0]});
      switch(a.anim){
        case 'tajoA':case 'revesA':{const r=a.anim==='revesA',s=r?-1:1,car=tramo(k,0,.4),gol=tramo(k,.4,.62),rec=tramo(k,.66,1);
          const f=(-1.3*car+2.4*gol)*s,e=-.25;return mezcla(mezcla(reposo(),horizontal(f,e),Math.max(car,gol)),reposo(),rec);}
        case 'estocadaA':{const car=tramo(k,0,.38),emp=tramo(k,.38,.48),rec=tramo(k,.66,1);return mezcla(mezcla(reposo(),vertical(-.8+2.8*car-2.3*emp),Math.min(1,car*1.5)),reposo(),rec);}
        case 'torbellino':return horizontal(-1.25,-.12);
        // Parry: el hacha en guardia diagonal delante del pecho (la cabeza sobre el hombro derecho), la cara plana hacia el golpe.
        case 'parry':{const e=tramo(k,0,.15)*(1-tramo(k,.8,1));const A=[-.55,.82,.14],l=Math.hypot(...A);return mezcla(reposo(),{G:[.16,.16,.38],A:A.map(x=>x/l),arriba:[0,0,1]},e);}
        case 'salto':{const arr=tramo(k,.12,.3)*(1-tramo(k,.75,.9)),cae=tramo(k,.75,.9);return mezcla(reposo(),vertical(2.1*arr-.7*cae),Math.max(arr,cae));}
        default:return reposo();}}

    // Pone la pose. a={anim,t (segundos en la animación), k (0..1 de la animación), fase (del paso), paso (0..1 cuánto anda)}.
    function posar(m,a){
      const H=m.H,esc=m.tipo==='can'?1.25:1;
      for(const k in H)if(k!=='raiz'){H[k].rotation.set(0,0,0);}
      H.cuerpo.position.set(0,0,0);H.cuerpo.rotation.set(0,0,0);
      const t=a.t||0,k=a.k||0,respira=Math.sin(t*2.2);
      // Brazos en reposo: un poco separados; el arma, lista.
      const reposo=()=>{H.brazoI.rotation.z=.18;H.brazoD.rotation.z=-.18;H.anteI.rotation.x=-.25;H.anteD.rotation.x=-.55;H.brazoD.rotation.x=-.15;
        H.torso.rotation.x=.04+respira*.015;H.cabeza.rotation.x=-.04;if(H.cola){H.cola.rotation.x=-.3+Math.sin(t*2)*.08;H.cola.rotation.y=Math.sin(t*1.3)*.25;H.cola2.rotation.y=Math.sin(t*1.3-1)*.35;}};
      const andar=(fase,amp)=>{const s=Math.sin(fase),c=Math.cos(fase);
        if(m.tipo==='adreida'){
          // Apoyo y balanceo alternos: el talón avanza, la rodilla recoge y el tobillo amortigua.
          for(const [lado,desfase] of [['I',0],['D',Math.PI]]){
            const f=fase+desfase,avance=Math.sin(f),vuelo=Math.max(0,Math.cos(f)),impulso=Math.max(0,-avance);
            const muslo=-avance*.78*amp,rodilla=.12+(vuelo*vuelo*1.05+.1*impulso)*amp;
            H['pierna'+lado].rotation.x=muslo;H['rodilla'+lado].rotation.x=rodilla;
            H['pie'+lado].rotation.x=(-muslo-(rodilla-.12))*.75+.16*impulso*amp;
            H['pierna'+lado].rotation.z=(lado==='I'?-.025:.025)*amp;
          }
          // La cadera carga el peso sobre la pierna de apoyo; el torso compensa el hacha pesada.
          H.cuerpo.position.set(s*.025*amp,-.025+respira*.006+(Math.cos(fase*2)*.022-.008)*amp,0);
          H.cadera.rotation.y=s*.11*amp;H.cadera.rotation.z=-s*.035*amp;
          H.torso.rotation.set(.1+respira*.012+.065*amp,-s*.075*amp,s*.025*amp);
          H.cabeza.rotation.x=-.04-.035*amp;H.cabeza.rotation.y=s*.035*amp;H.cabeza.rotation.z=-s*.02*amp;
          return;
        }
        H.piernaI.rotation.x=-s*.62*amp;H.piernaD.rotation.x=s*.62*amp;H.rodillaI.rotation.x=Math.max(0,c)*.9*amp+.05;H.rodillaD.rotation.x=Math.max(0,-c)*.9*amp+.05;
        H.pieI.rotation.x=s*.25*amp;H.pieD.rotation.x=-s*.25*amp;
        H.brazoI.rotation.x=s*.5*amp;H.brazoD.rotation.x+=-s*.3*amp;H.torso.rotation.y=s*.12*amp;H.torso.rotation.x+=.1*amp;
        H.cuerpo.position.y=Math.abs(c)*.05*amp*esc-.02*amp;if(H.cola)H.cola.rotation.y+=s*.3*amp;};
      reposo();
      // La cinemática inversa coloca después el hacha sobre el hombro de Adreida.
      if(m.tipo==='adreida'){H.brazoD.rotation.x=-.3;H.anteD.rotation.x=-.75;H.brazoD.rotation.z=-.22;}
      switch(a.anim){
        case 'andar':andar(a.fase||0,a.paso??1);break;
        case 'quieto':H.cuerpo.position.y=respira*.006;if(m.tipo==='adreida'){H.torso.rotation.x=.1+respira*.012;H.rodillaI.rotation.x=.12;H.rodillaD.rotation.x=.12;H.cuerpo.position.y-=.025;}else H.brazoI.rotation.z+=respira*.02;break;
        // Tajo horizontal de derecha a izquierda: carga (0–.35), golpe (.35–.55), recoge.
        case 'golpe':case 'aviso':{const kk=a.anim==='aviso'?k*.38:k,car=tramo(kk,0,.35),gol=tramo(kk,.36,.55),rec=tramo(kk,.62,1);
          const giro=-.9*car+1.6*gol-.7*rec;H.torso.rotation.y=giro;H.cadera.rotation.y=giro*.35;
          H.brazoD.rotation.x=-.15-1.35*car+.2*gol+1.3*rec;H.brazoD.rotation.z=-.18-.9*car+.35*gol+.55*rec;H.brazoD.rotation.y=-.6*car+1.3*gol-.7*rec;
          H.anteD.rotation.x=-.55-.5*car+.8*gol-.3*rec;H.manoD.rotation.y=.3*car-.6*gol+.3*rec;
          H.brazoI.rotation.x=-.5*car+.2*gol+.3*rec;H.brazoI.rotation.z=.18+.25*car-.25*rec;
          H.piernaD.rotation.x=.3*car-.1*gol-.2*rec;H.piernaI.rotation.x=-.35*car+.35*rec;H.rodillaI.rotation.x=.4*car-.4*rec;H.rodillaD.rotation.x=.25;H.cuerpo.position.y=-.05*car*esc+.05*rec*esc;
          H.torso.rotation.x=.12*car+.1*gol-.1*rec;
          if(a.anim==='aviso')H.cuerpo.position.x=Math.sin(t*40)*.012;break;}
        // Los hachazos de Adreida: el brazo casi horizontal barre un arco delante (el hacha lo prolonga).
        // brazoD.z lo levanta hacia su derecha y brazoD.y lo barre en horizontal: -.5 detrás a la derecha, 1.57 delante, 2.5 a la izquierda.
        case 'tajoA':case 'revesA':{const r=a.anim==='revesA',car=tramo(k,0,.4),gol=tramo(k,.4,.62),rec=tramo(k,.66,1),de=r?2.4:-.55,a2=r?-.45:2.35;
          const barre=de+(a2-de)*gol,alto=1-rec;
          H.brazoD.rotation.z=-.3-.95*Math.max(car,gol)*alto;H.brazoD.rotation.y=(barre*(car>0?1:0))*alto+(r?.2:-.2)*(1-car)*alto;H.brazoD.rotation.x=-.25*rec-.15*(1-car)*alto;
          H.anteD.rotation.x=-.75*(1-car)*alto-.45*car*(1-gol)*alto-.08*gol*alto-.7*rec;
          const giro=(r?.55:-.55)*car*(1-gol)+(r?-.5:.5)*gol*alto;H.torso.rotation.y=giro;H.cadera.rotation.y=giro*.4;H.torso.rotation.x=.08+.1*gol*alto;
          H.brazoI.rotation.z=.18+.5*gol*alto;H.brazoI.rotation.x=(r?-.5:.4)*gol*alto;
          H.piernaI.rotation.x=-.35*gol*alto;H.rodillaI.rotation.x=.35*gol*alto+.05;H.piernaD.rotation.x=.3*gol*alto;H.rodillaD.rotation.x=.15;H.cuerpo.position.y=-.06*gol*alto;break;}
        case 'estocadaA':{const car=tramo(k,0,.42),emp=tramo(k,.42,.56),rec=tramo(k,.68,1),e2=emp*(1-rec),c2=car*(1-emp);
          const alto=1-rec;H.brazoD.rotation.z=-(.3+1.2*car)*alto-.3*rec;H.brazoD.rotation.y=(.5*car+1.07*emp)*alto;H.brazoD.rotation.x=-.3*rec;
          H.anteD.rotation.x=(-.75*(1-car)-1.5*car*(1-emp)-.02*emp)*alto-.75*rec;H.torso.rotation.y=-.6*c2+.35*e2;H.torso.rotation.x=.05+.3*e2;H.cadera.rotation.y=-.25*c2+.15*e2;
          H.brazoI.rotation.x=.6*e2-.3*c2;H.brazoI.rotation.z=.18+.35*e2;
          H.piernaI.rotation.x=-.95*e2-.15*c2;H.rodillaI.rotation.x=.75*e2+.25*c2;H.piernaD.rotation.x=.75*e2+.15*c2;H.rodillaD.rotation.x=.2+.3*e2;H.cuerpo.position.y=-.14*e2-.04*c2;break;}
        // Revés: el segundo golpe del combo, de izquierda a derecha (empieza donde acabó el tajo).
        case 'reves':{const car=tramo(k,0,.3),gol=tramo(k,.32,.55),rec=tramo(k,.62,1),giro=.75*car-1.55*gol+.8*rec;
          H.torso.rotation.y=giro;H.cadera.rotation.y=giro*.35;
          H.brazoD.rotation.x=-.15-1.25*car+.05*gol+1.35*rec;H.brazoD.rotation.z=-.18+.35*car-.75*gol+.4*rec;H.brazoD.rotation.y=.9*car-1.6*gol+.7*rec;
          H.anteD.rotation.x=-.55-.9*car+.6*gol+.3*rec;H.manoD.rotation.y=-.5*car+.8*gol-.3*rec;
          H.brazoI.rotation.x=-.3*car+.3*rec;H.brazoI.rotation.z=.18+.3*gol-.3*rec;
          H.piernaI.rotation.x=.25*car-.25*rec;H.piernaD.rotation.x=-.3*car+.3*rec;H.rodillaD.rotation.x=.35*car-.35*rec+.1;H.cuerpo.position.y=-.04*car*esc+.04*rec*esc;break;}
        // Estocada: el tercer golpe, se echa atrás y embiste con la hoja por delante.
        case 'estocada':{const car=tramo(k,0,.4),emp=tramo(k,.42,.56),rec=tramo(k,.66,1),e2=emp*(1-rec);
          H.torso.rotation.y=-.7*car*(1-emp)+.35*e2;H.torso.rotation.x=.05-.1*car+.35*e2;
          H.brazoD.rotation.x=-.15+.45*car*(1-emp)-1.45*e2;H.brazoD.rotation.z=-.18-.2*car;H.anteD.rotation.x=-.55-1.1*car*(1-emp)+.45*e2;H.manoD.rotation.x=1.3*e2+.3*car*(1-emp);
          H.brazoI.rotation.x=.6*e2-.4*car*(1-emp);H.brazoI.rotation.z=.18+.4*e2;
          H.piernaI.rotation.x=-.9*e2-.2*car*(1-emp);H.rodillaI.rotation.x=.7*e2+.3*car;H.piernaD.rotation.x=.7*e2+.2*car*(1-emp);H.rodillaD.rotation.x=.2+.3*e2;
          H.cuerpo.position.y=-.14*e2*esc-.05*car*(1-emp)*esc;break;}
        // Esquiva: rueda corta, agachada y hacia delante.
        case 'esquiva':{const e=Math.sin(Math.PI*Math.min(1,k));H.torso.rotation.x=.25+.55*e;H.cabeza.rotation.x=.2*e;H.cuerpo.position.y=-.22*e*esc;
          H.piernaI.rotation.x=-.9*e;H.rodillaI.rotation.x=1.1*e;H.piernaD.rotation.x=.7*e;H.rodillaD.rotation.x=.9*e;
          H.brazoI.rotation.x=.9*e;H.brazoD.rotation.x=.7*e;H.anteD.rotation.x=-.9;H.brazoI.rotation.z=.5*e;H.brazoD.rotation.z=-.5*e;break;}
        // Torbellino: brazos abiertos, la hoja extendida; el giro del cuerpo lo pone el juego.
        case 'torbellino':H.brazoD.rotation.z=-1.35;H.brazoD.rotation.x=-.2;H.anteD.rotation.x=-.15;if(m.tipo!=='adreida'){H.manoD.rotation.y=-1.3;H.manoD.rotation.x=.2;}H.brazoI.rotation.z=1.1;H.anteI.rotation.x=-.2;
          H.torso.rotation.x=.18;H.piernaI.rotation.x=-.35;H.piernaD.rotation.x=.3;H.rodillaI.rotation.x=.5;H.rodillaD.rotation.x=.45;H.cuerpo.position.y=-.1*esc;H.cabeza.rotation.x=.15;break;
        // Salto: se agacha, sube con el arma en alto y cae clavándola.
        case 'salto':{const ag=1-tramo(k,0,.15),arr=tramo(k,.12,.3)*(1-tramo(k,.75,.9)),cae=tramo(k,.75,.9);
          H.cuerpo.position.y=-.2*ag*esc-.25*cae*esc;H.rodillaI.rotation.x=1.1*ag+.6*arr+1.1*cae;H.rodillaD.rotation.x=1.1*ag+.9*arr+.6*cae;H.piernaI.rotation.x=-.9*ag-.4*arr-.9*cae;H.piernaD.rotation.x=-.5*ag+.3*arr-.2*cae;
          H.brazoD.rotation.x=-.3*ag-2.7*arr-1*cae;H.brazoI.rotation.x=-.3*ag-2.5*arr-.9*cae;H.anteD.rotation.x=-.4-.3*arr+.3*cae;H.anteI.rotation.x=-.4-.3*arr;H.brazoD.rotation.z=-.1;H.brazoI.rotation.z=.1;H.manoD.rotation.x=-.3*arr+.9*cae;
          H.torso.rotation.x=.3*ag-.25*arr+.55*cae;break;}
        // Grito de Provocar: brazos abiertos, pecho fuera, cabeza atrás.
        case 'grito':{const e=tramo(k,0,.25)*(1-tramo(k,.8,1));H.brazoI.rotation.z=.18+1.1*e;H.brazoD.rotation.z=-.18-1*e;H.brazoI.rotation.x=-.4*e;H.brazoD.rotation.x=-.15-.3*e;H.anteI.rotation.x=-.25-.8*e;
          H.torso.rotation.x=-.25*e;H.cabeza.rotation.x=-.45*e;H.cuerpo.position.x=Math.sin(t*50)*.008*e;H.piernaI.rotation.z=.12*e;H.piernaD.rotation.z=-.12*e;break;}
        // Lanzar (kobold): echa el brazo atrás y lanza.
        case 'lanzar':case 'apunta':{const kk=a.anim==='apunta'?Math.min(k,1)*.5:.5+k*.5,atr=tramo(kk,0,.45),lan=tramo(kk,.5,.7),rec=tramo(kk,.75,1);
          H.brazoD.rotation.x=-.2-2.4*atr+1.9*lan+.5*rec;H.brazoD.rotation.z=-.18-.4*atr+.3*lan;H.anteD.rotation.x=-.5-.6*atr+.9*lan;H.manoD.rotation.x=.3*atr;
          H.torso.rotation.y=-.6*atr+1*lan-.4*rec;H.brazoI.rotation.x=-.9*atr+.6*lan;H.piernaI.rotation.x=-.4*atr+.2*lan;H.piernaD.rotation.x=.3*atr;H.torso.rotation.x=-.1*atr+.25*lan-.15*rec;break;}
        case 'parry':{const e=tramo(k,0,.15)*(1-tramo(k,.8,1));if(m.tipo!=='adreida'){H.brazoD.rotation.x=-1.25*e;H.brazoD.rotation.z=-.18+.55*e;H.anteD.rotation.x=-.55-.9*e;H.brazoI.rotation.x=-1.1*e;H.brazoI.rotation.z=.18-.45*e;H.anteI.rotation.x=-.25-1.1*e;}
          H.torso.rotation.x=.04+.12*e;H.cuerpo.position.y=-.07*e;H.rodillaI.rotation.x=H.rodillaD.rotation.x=.35*e;H.piernaI.rotation.x=-.25*e;H.piernaD.rotation.x=.12*e;H.cabeza.rotation.x=-.12*e;break;}
        // Disparar (Mohamed): el brazo derecho al frente, a la altura del hombro; el retroceso levanta la pistola al disparar (k: 0 → 1).
        case 'disparar':{const r=Math.max(0,1-k*4);H.brazoD.rotation.x=-1.52-.25*r;H.brazoD.rotation.z=.05;H.anteD.rotation.x=-.05-.2*r;H.brazoI.rotation.x=-.2;H.brazoI.rotation.z=.25;H.torso.rotation.y=-.18;H.cabeza.rotation.y=.12;H.torso.rotation.x=-.03;break;}
        // Backflip de Mohamed (salto mortal), recogido, girando alrededor de la cadera.
        case 'acrobacia':{const g=tramo(k,.15,.85)*Math.PI*2,rec=Math.sin(Math.PI*Math.min(1,k)),hc=(m.p.muslo+m.p.pierna)*.9;
          H.cuerpo.rotation.x=g;H.cuerpo.position.set(0,hc-hc*Math.cos(g),-hc*Math.sin(g));H.piernaI.rotation.x=H.piernaD.rotation.x=-1.6*rec;H.rodillaI.rotation.x=H.rodillaD.rotation.x=2*rec;
          H.torso.rotation.x=.6*rec;H.brazoI.rotation.x=H.brazoD.rotation.x=-.8*rec;H.anteI.rotation.x=H.anteD.rotation.x=-1.2*rec;break;}
        case 'aturdido':andar(t*3,.08);H.cabeza.rotation.z=Math.sin(t*5)*.3;H.torso.rotation.z=Math.sin(t*5+1)*.12;H.brazoI.rotation.z=.4;H.brazoD.rotation.z=-.4;H.anteD.rotation.x=-.2;break;
        case 'dolor':H.torso.rotation.x=-.3*(1-k);H.cabeza.rotation.x=-.3*(1-k);H.brazoI.rotation.z=.4*(1-k)+.18;break;
        // Muerte: se le doblan las rodillas y cae de espaldas.
        case 'muerte':{const r=tramo(k,0,.35),c=tramo(k,.25,.8);H.rodillaI.rotation.x=1.2*r*(1-c*.6);H.rodillaD.rotation.x=.9*r*(1-c*.6);H.piernaI.rotation.x=-.8*r*(1-c);H.piernaD.rotation.x=-.5*r*(1-c);
          H.brazoI.rotation.z=.18+1.2*c;H.brazoD.rotation.z=-.18-1.1*c;H.cabeza.rotation.x=-.4*c;
          H.cuerpo.rotation.x=-Math.PI/2*c*.96;H.cuerpo.position.y=-.3*r*(1-c)*esc+.12*c*esc;H.cuerpo.position.z=-(m.alto*.22)*c;break;}
      }
      // Adreida agarra el hacha con las dos manos (salvo al gritar, con los brazos abiertos, y al caer).
      if(m.tipo==='adreida'&&!['grito','muerte'].includes(a.anim))empunar(m,agarreAdreida(a));
    }
    return {crear,posar,TIPOS};
  }
  window.CAOZ_ARPG_MODELOS=Object.freeze({fabrica});
})();

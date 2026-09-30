/* Modelos 3D sencillos para la prueba de ARPG (arpg-three): Adreida, el Goblin
   de Camino, el Kobold lancero, el Saqueador y Can, el de los Goblins. Son
   low poly, hechos con primitivas de three.js (cápsulas, cajas, conos) y
   colores por vértice sacados de su carta, sin archivos de modelo. Adreida
   es la detallada: sólidos de revolución, mechones y correas en tubo, la
   cabeza esculpida y las hojas del hacha extruidas, con sombreado suave.
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
      toro:(r,t,s=12,l=t<.01?3:5)=>new THREE.TorusGeometry(r,t,l,s),
      // Sólido de revolución (muslos, brazos, torso): perfil [[radio,y],…] alrededor del eje Y.
      torno:(perfil,s=16)=>new THREE.LatheGeometry(perfil.slice().sort((a,b)=>a[1]-b[1]).map(([r,y])=>new THREE.Vector2(Math.max(r,1e-4),y)),s),
      // Un tubo por una curva con el radio variable r(t), t de 0 (inicio) a 1 (final): mechones, colmillos, correas.
      tubo:(pts,r,n=16,lados=6,cerrado=false,forma=null)=>{const curva=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)),cerrado),g=new THREE.TubeGeometry(curva,n,1,lados,cerrado),P=g.attributes.position,c=V(0,0,0),v=V(0,0,0);
        for(let i=0;i<=n;i++){curva.getPointAt(cerrado?(i%n)/n:i/n,c);const k=r(i/n);for(let j=0;j<=lados;j++){const q=i*(lados+1)+j;v.fromBufferAttribute(P,q).sub(c).multiplyScalar(k);if(forma)forma(v,c);v.add(c);P.setXYZ(q,v.x,v.y,v.z);}}return g;},
      // Deforma los vértices de una geometría con f(v) y recalcula las normales (la cabeza esculpida).
      deformar:(g,f)=>{const P=g.attributes.position,v=V(0,0,0);for(let i=0;i<P.count;i++){f(v.fromBufferAttribute(P,i));P.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();return g;},
      // Una forma plana (THREE.Shape) con grosor, centrada en su espesor: las hojas del hacha.
      placa:(forma,grueso,bisel=0)=>{const g=new THREE.ExtrudeGeometry(forma,{depth:grueso,curveSegments:6,bevelEnabled:bisel>0,bevelThickness:bisel,bevelSize:bisel*.8,bevelSegments:1});g.translate(0,0,-grueso/2);return g;},
    };
    // El giro que lleva el eje +Y de una pieza (conos, púas) a la dirección d.
    const apunta=d=>{const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(...d).normalize()));return [e.x,e.y,e.z];};
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
    // lisos: sombreado suave (el modelo detallado de Adreida) y las dos caras de la tela (faldas, melena).
    function materiales(lisos){
      const u={uDisuelve:{value:0},uDestello:{value:0},uColorD:{value:new THREE.Color(1,1,1)},uBorde:{value:0},uColorB:{value:new THREE.Color(1,.2,.05)}};
      const hacer=(p,brillo=0)=>{const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:!lisos,...p});
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
      return {u,piel:hacer({roughness:.82,metalness:0,side:lisos?THREE.DoubleSide:THREE.FrontSide}),metal:hacer({roughness:.32,metalness:.85}),brillo:hacer({roughness:1,metalness:0,color:0x000000},4)};
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
    function constructor(H,varioBase=.14){
      const piezas=new Map(),huesos=[];H.cuerpo.traverse(o=>{if(o.isBone)huesos.push(o);});
      const pon=(hueso,mat,geo,color,pos,rot,esc,vario=varioBase)=>{if(!piezas.has(mat))piezas.set(mat,[]);piezas.get(mat).push({geo,color,m:matriz(pos,rot,esc),vario,hueso:huesos.indexOf(H[hueso]),nombre:hueso});};
      const montar=M=>{H.raiz.updateMatrixWorld(true);const esq=new THREE.Skeleton(huesos),mallas=[];
        for(const [mat,lista] of piezas){for(const p of lista)p.m.premultiply(H[p.nombre].matrixWorld);
          const malla=new THREE.SkinnedMesh(fundir(lista),M[mat]);malla.castShadow=mat!=='brillo';malla.receiveShadow=true;malla.frustumCulled=false;H.raiz.add(malla);malla.bind(esq,malla.matrixWorld);mallas.push(malla);}
        return mallas;};
      // Miembros: una cápsula que cuelga del hueso.
      const miembro=(hueso,r,l,color,esc=[1,1,1])=>pon(hueso,'piel',G.capsula(r,l),color,[0,-l/2-r*.3,0],[0,0,0],esc);
      return {pon,montar,miembro};
    }

    const TIPOS={
      adreida:{nombre:'Adreida',alto:1.95,radio:.42,lisos:true},
      goblin:{nombre:'Goblin de Camino',alto:1.15,radio:.34},
      kobold:{nombre:'Kobold lancero',alto:1.25,radio:.34},
      saqueador:{nombre:'Saqueador de Tomsage',alto:1.8,radio:.42},
      can:{nombre:'Can, el de los Goblins',alto:2.4,radio:.62},
      mohamed:{nombre:'Mohamed',alto:1.85,radio:.4},
    };

    // Adreida, detallada a partir de su carta: piel verde menta con los abdominales marcados, melena azul noche en
    // mechones ondulados con la raya al medio, orejas en punta, ojos rojos y colmillos; top negro con la correa en
    // diagonal y los tres aros de plata, hombrera de cuero en capas (izquierda), brazales con púas de hueso, el
    // cinturón ancho con la hebilla y los cráneos de pájaro, el faldón de piel sobre la falda de tela y las botas
    // altas con correas y púa en la rodilla. Sombreado suave; tres mallas como los demás.
    function adreida(){
      const p={muslo:.47,pierna:.45,pie:.05,cintura:.08,torso:.52,hombros:.25,brazo:.31,antebrazo:.29,ancho:.11},H=esqueleto(p),{pon,montar}=constructor(H,.035);
      const piel=0x86c49c,piel2=0x76b18b,piel3=0x93d0a8,pelo=0x1c1f38,cuero=0x3e2b1f,cuero2=0x5a3a22,brazal=0x6d4529,negro=0x1d1a23,tela=0x2a2530,
        hueso=0xe9e0cc,plata=0xd9dbe6,pielT=0xa48258,pielT2=0x7c5f3e,pielT3=0xbd9c6c,bota=0x241c1d,suela=0x120e0e;
      const PI=Math.PI;
      // ---- Cadera: mallas, cinturón, hebilla, cráneos, bolsa, falda de tela y faldón de piel.
      pon('cadera','piel',G.torno([[.13,.1],[.165,.02],[.17,-.06],[.15,-.13]],18),negro,[0,0,0],[0,0,0],[1,1,.74]);
      pon('cadera','piel',G.cil(.195,.19,.1,24),0x2a1f1a,[0,.05,0],[0,0,0],[1,1,.76]);
      for(const y of [.1,0])pon('cadera','piel',G.toro(.195,.007,28),cuero,[0,y,0],[PI/2,0,0],[1,.76,1]);
      for(let i=0;i<10;i++){const f=-1.6+i*.355;if(Math.abs(f)<.3)continue;pon('cadera','metal',G.bola(.009,6,4),plata,[Math.sin(f)*.197,.05,Math.cos(f)*.197*.76]);}
      pon('cadera','metal',G.caja(.115,.095,.018),plata,[0,.05,.152],[0,0,0],1,.02);
      pon('cadera','piel',G.caja(.075,.055,.02),0x2a1f1a,[0,.05,.154]);
      pon('cadera','metal',G.caja(.012,.07,.026),plata,[0,.05,.155]);
      for(const x of [-.05,.05])for(const y of [.012,.088])pon('cadera','metal',G.bola(.008,6,4),0xf0f2f8,[x,y,.162]);
      // Los cráneos de pájaro colgando de la cadera izquierda, cada uno de su cordón.
      for(const [f,y] of [[.95,-.05],[1.3,-.085],[1.65,-.04]]){const o=[Math.sin(f),0,Math.cos(f)*.76],t=[Math.cos(f),0,-Math.sin(f)],c=[o[0]*.23,y,o[2]*.23+.01*Math.cos(f)];
        pon('cadera','piel',G.cil(.004,.004,.08+y*-.5,4),0x3a2a20,[o[0]*.205,(.05+y)/2+.01,o[2]*.205]);
        pon('cadera','piel',G.bola(.033,8,6),hueso,c,[0,f,0],[1,.92,1.12]);
        pon('cadera','piel',G.cono(.017,.075,8),0xd4c8ae,[c[0]+o[0]*.03,c[1]-.035,c[2]+o[2]*.03],apunta([o[0]*.9,-1,o[2]*.9]));
        for(const s of [1,-1])pon('cadera','piel',G.bola(.009,6,4),0x16110f,[c[0]+o[0]*.026+t[0]*s*.015,c[1]+.004,c[2]+o[2]*.026+t[2]*s*.015]);}
      // La bolsa de cuero en la cadera derecha.
      {const f=-1.25,o=[Math.sin(f),0,Math.cos(f)*.76];pon('cadera','piel',G.caja(.075,.09,.05),cuero2,[o[0]*.23,-.02,o[2]*.23],[0,f,0]);
        pon('cadera','piel',G.caja(.08,.035,.056),cuero,[o[0]*.232,.02,o[2]*.232],[.12,f,0]);pon('cadera','metal',G.bola(.008,6,4),plata,[o[0]*.262,.005,o[2]*.262]);}
      // La falda de tela oscura en paños (se abren al andar) y el faldón de piel por encima con sus mechones.
      for(let i=0;i<7;i++){const a=i/7*TAU+.08,l=.4+(i%2)*.05;pon('cadera','piel',new THREE.CylinderGeometry(.2,.3,l,6,1,true,a,TAU/7-.07),i%2?tela:0x221e28,[0,.02-l/2,0],[0,0,0],[1,1,.8]);}
      pon('cadera','piel',new THREE.CylinderGeometry(.205,.275,.24,26,2,true),pielT,[0,-.1,0],[0,0,0],[1,1,.8],.08);
      for(let i=0;i<34;i++){const a=i/34*TAU,r=.275+(i%3)*.006,cc=[pielT,pielT2,pielT3][i%3];
        pon('cadera','piel',G.cono(.05,.1+(i*7%5)*.014,7),cc,[Math.sin(a)*r,-.25-(i*5%3)*.008,Math.cos(a)*r*.8],apunta([-Math.sin(a)*.3+Math.cos(a)*.15*((i%2)*2-1),1,-Math.cos(a)*.3*.8]),[1.3,1,.4],.1);}
      for(let i=0;i<24;i++){const a=(i+.5)/24*TAU,r=.245;
        pon('cadera','piel',G.cono(.045,.09,7),[pielT3,pielT][i%2],[Math.sin(a)*r,-.15,Math.cos(a)*r*.8],apunta([-Math.sin(a)*.25,1,-Math.cos(a)*.25*.8]),[1.3,1,.4],.1);}
      // ---- Piernas: mallas negras y botas altas con el puño de cuero, correas y la púa en la rodilla.
      for(const l of ['I','D']){const s=l==='I'?1:-1;
        pon('pierna'+l,'piel',G.torno([[.1,.03],[.106,-.06],[.098,-.18],[.086,-.32],[.07,-.44],[.066,-.5]]),negro,[0,0,0],[0,0,0],[1,1,.95]);
        pon('rodilla'+l,'piel',G.torno([[.06,.1],[.074,.06],[.077,-.02],[.074,-.1],[.08,-.18],[.071,-.3],[.059,-.4],[.061,-.47]]),bota);
        pon('rodilla'+l,'piel',G.cil(.09,.082,.06,18),cuero,[0,.07,0]);pon('rodilla'+l,'piel',G.toro(.09,.008,20),cuero2,[0,.1,0],[PI/2,0,0]);
        pon('rodilla'+l,'piel',G.casco(.062,14,6),0x2c2428,[0,.0,.045],[PI/2,0,0],[1,1.25,.55]);
        pon('rodilla'+l,'metal',G.bola(.018,8,6),0x9aa0aa,[0,.0,.08]);
        pon('rodilla'+l,'piel',G.cono(.017,.085,8),hueso,[0,.03,.11],apunta([0,.55,1]));
        for(const [y,r] of [[-.11,.079],[-.2,.081],[-.3,.072]]){pon('rodilla'+l,'piel',G.toro(r,.009,20),cuero2,[0,y,0],[PI/2+.08,0,0]);
          pon('rodilla'+l,'metal',G.caja(.014,.022,.022),plata,[s*r,y,.0],[0,0,0],1,.02);}
        pon('pie'+l,'piel',G.cil(.06,.066,.1,14),bota,[0,.02,0]);
        pon('pie'+l,'piel',G.bola(.068,12,8),bota,[0,-.005,.055],[0,0,0],[.95,.72,1.85]);
        pon('pie'+l,'piel',G.caja(.125,.026,.27),suela,[0,-.037,.048]);
        pon('pie'+l,'piel',G.caja(.095,.045,.07),suela,[0,-.028,-.06]);
        pon('pie'+l,'piel',G.toro(.064,.008,18),cuero2,[0,.035,.01],[PI/2+.3,0,0],[1,1.2,1]);}
      // ---- Torso: abdomen con los abdominales, pecho, top negro, la correa, los tres aros y el paño del cuello.
      pon('torso','piel',G.torno([[.15,-.05],[.14,.04],[.135,.12],[.145,.2],[.168,.28]],22),piel,[0,0,0],[0,0,0],[1,1,.72]);
      pon('torso','piel',G.torno([[.165,.25],[.19,.32],[.205,.39],[.2,.44],[.17,.49],[.11,.53],[.07,.57]],22),piel,[0,0,0],[0,0,0],[1,1,.74]);
      for(const y of [.03,.1,.17])for(const s of [1,-1])pon('torso','piel',G.bola(.04,8,6),piel,[s*.04,y,.088-(y===.03?.004:0)],[0,0,0],[.9,.75,.24]);
      for(const s of [1,-1]){pon('torso','piel',G.bola(.05,10,8),piel,[s*.115,.14,.045],[0,0,s*.15],[.45,1.5,.8]);
        pon('torso','piel',G.bola(.09,14,8),piel,[s*.1,.5,-.02],[0,0,s*.35],[1,.55,.8]);}
      pon('torso','piel',G.caja(.006,.2,.01),piel2,[0,.1,.103]);
      pon('torso','piel',G.torno([[.174,.27],[.199,.32],[.214,.39],[.209,.44],[.186,.48]],22),negro,[0,0,0],[0,0,0],[1,1,.8]);
      for(const s of [1,-1]){pon('torso','piel',G.bola(.08,12,8),negro,[s*.075,.37,.112],[0,0,0],[1,.85,.72]);
        pon('torso','piel',G.tubo([[s*.07,.46,.15],[s*.12,.53,.06],[s*.13,.54,-.04],[s*.08,.46,-.15]],()=>.02,10,6),negro,[0,0,0],[0,0,0],[1,1,1]);}
      pon('torso','piel',G.toro(.174,.009,28),tela,[0,.27,0],[PI/2,0,0],[1,.8,1]);
      // La correa de cuero en diagonal: del hombro izquierdo a la cadera derecha, por delante y por la espalda.
      const radioT=y=>{const pr=y>=.27?[[.27,.174],[.32,.199],[.39,.214],[.44,.209],[.48,.186],[.53,.12],[.57,.075]]:[[-.05,.15],[.04,.14],[.12,.135],[.2,.145],[.28,.168]];
        if(y<=pr[0][0])return pr[0][1];for(let i=1;i<pr.length;i++)if(y<=pr[i][0]){const [y0,r0]=pr[i-1],[y1,r1]=pr[i];return r0+(r1-r0)*(y-y0)/(y1-y0);}return pr[pr.length-1][1];};
      const sobre=(x,y,lado)=>{const R=radioT(y)+.013,zs=y>=.27?.8:.72;return [x,y,lado*(zs*Math.sqrt(Math.max(0,R*R-x*x))+.013)];};
      const correa=[];for(let i=0;i<=6;i++){const t=i/6;correa.push(sobre(.17-.33*t,.52-.42*t,1));}
      correa.push([-.18,.08,0]);for(let i=6;i>=0;i--){const t=i/6;correa.push(sobre(.17-.33*t,.52-.42*t,-1));}correa.push([.2,.5,0]);
      pon('torso','piel',G.tubo(correa,()=>.016,40,5,true),cuero2,[0,0,0],[0,0,0],[1,1,1],.05);
      {const c=sobre(.0,.31,1);pon('torso','metal',G.caja(.045,.035,.012),plata,[c[0],c[1],c[2]+.01],[0,0,.64],1,.02);}
      // Los tres aros de plata arriba, en el centro del top.
      for(const [x,y] of [[-.024,.462],[.024,.462],[0,.43]])pon('torso','metal',G.toro(.017,.0045,16,6),plata,[x,y,.172+(y<.44?.004:0)],[0,0,0],1,.02);
      pon('torso','metal',G.bola(.01,8,6),0xf2f3f8,[0,.45,.176]);
      // El paño negro del cuello, con sus pliegues.
      pon('torso','piel',G.torno([[.105,.49],[.108,.52],[.097,.56],[.086,.6]],18),negro);
      for(const [y,r] of [[.505,.109],[.545,.1],[.585,.09]])pon('torso','piel',G.toro(r,.012,20),tela,[0,y,0],[PI/2+.1,0,0]);
      // ---- Brazos: deltoides, bíceps, hombrera de cuero (izquierda), brazales con púas de hueso, puños cerrados.
      for(const l of ['I','D']){const s=l==='I'?1:-1;
        pon('brazo'+l,'piel',G.bola(.078,12,9),piel,[s*.012,-.035,0],[0,0,0],[1,1.15,1.05]);
        pon('brazo'+l,'piel',G.torno([[.064,-.02],[.07,-.1],[.066,-.17],[.058,-.25],[.052,-.33]]),piel);
        pon('brazo'+l,'piel',G.bola(.045,8,6),piel3,[0,-.14,.03],[0,0,0],[1,1.6,.9]);
        pon('brazo'+l,'piel',G.bola(.045,8,6),piel,[0,-.12,-.03],[0,0,0],[1,1.7,.9]);
        pon('ante'+l,'piel',G.torno([[.052,.0],[.061,-.06],[.056,-.12],[.047,-.2],[.04,-.29]]),piel);
        pon('ante'+l,'piel',G.torno([[.066,-.07],[.065,-.13],[.058,-.2],[.052,-.27]]),brazal);
        pon('ante'+l,'piel',G.toro(.066,.008,18),cuero,[0,-.072,0],[PI/2,0,0]);pon('ante'+l,'piel',G.toro(.053,.008,18),cuero,[0,-.268,0],[PI/2,0,0]);
        for(const y of [-.14,-.2])pon('ante'+l,'piel',G.toro(y<-.15?.06:.066,.006,18),0x2a1f1a,[0,y,0],[PI/2,0,0]);
        for(let i=0;i<4;i++){const y=-.1-i*.047,r=.064-i*.004;pon('ante'+l,'piel',G.bola(.013,6,4),0xd6ccb4,[s*r,y,-.01]);
          pon('ante'+l,'piel',G.cono(.014,.08-i*.008,8),hueso,[s*(r+.03),y+.02,-.018],apunta([s,.6,-.25]));}
        // El puño: los dedos rodean el mango (que pasa por el eje Y de la mano).
        pon('mano'+l,'piel',G.cil(.042,.046,.04,14),piel2,[0,.0,0]);
        for(let i=0;i<4;i++)pon('mano'+l,'piel',G.toro(.036-(i===3?.004:0),.0145,10,6),i%2?piel:piel2,[0,-.03-i*.024,0],[PI/2,0,0],[1,1.12,1]);
        for(let i=0;i<4;i++)pon('mano'+l,'piel',G.bola(.015,6,5),piel3,[s*.02,-.03-i*.024,.043],[0,0,0],[1.2,1,1]);
        pon('mano'+l,'piel',G.capsula(.014,.04,8),piel,[-s*.03,-.02,.03],[.3,0,s*.9]);}
      // La hombrera izquierda: tres placas de cuero negro superpuestas, con remaches y la correa bajo la axila.
      for(const [i,y,rz,c] of [[0,.01,-.2,0x2a2430],[1,-.045,-.5,0x332c3a],[2,-.095,-.75,0x2a2430]]){
        pon('brazoI','piel',G.casco(.1-i*.005,14,6),c,[.012+i*.028,y,0],[0,0,rz],[1.08,.78-i*.1,1.12]);
        for(const z of [-.05,0,.05])pon('brazoI','metal',G.bola(.01,6,5),plata,[.06+i*.03+Math.abs(z)*-.2,y+.03-i*.004,z]);}
      pon('brazoI','piel',G.toro(.074,.01,18),cuero,[0,-.14,0],[PI/2,0,0]);
      pon('brazoD','piel',G.toro(.07,.01,18),cuero,[0,-.2,0],[PI/2,0,0]);
      // ---- Cabeza: cuello, cráneo esculpido (mandíbula ancha, cejas marcadas, pómulos), cara, colmillos, orejas en punta.
      pon('cabeza','piel',G.torno([[.064,-.03],[.058,.06],[.06,.11]],14),piel2);
      const cabeza=G.deformar(new THREE.SphereGeometry(.12,24,16).rotateY(-PI/2),v=>{const n=v.clone().divideScalar(.12),fr=Math.max(0,n.z);
        if(n.y<0){const w=-n.y;v.x*=1+.17*w;v.z+=.02*w*fr;}
        v.z+=.014*Math.exp(-(((n.y-.28)/.1)**2))*fr*fr;
        v.z-=.011*Math.exp(-(((Math.abs(n.x)-.38)/.13)**2+((n.y-.13)/.1)**2))*fr;
        v.x+=Math.sign(n.x)*.008*Math.exp(-(((n.y-.02)/.14)**2))*fr*Math.abs(n.x);
        v.x*=.93;v.y*=1.1;});
      pon('cabeza','piel',cabeza,piel,[0,.18,.01]);
      for(const s of [1,-1]){
        pon('cabeza','brillo',G.bola(.016,12,8),0xff1a2e,[s*.043,.198,.112],[0,0,-s*.18],[1.35,.55,.5]);
        pon('cabeza','piel',G.bola(.006,6,4),0x2a0006,[s*.043,.198,.119]);
        pon('cabeza','piel',G.caja(.056,.014,.02),pelo,[s*.046,.224,.119],[.1,0,s*.32]);
        pon('cabeza','piel',G.tubo([[s*.029,.108,.106],[s*.034,.13,.123],[s*.03,.152,.13]],t=>.011*(1-t*.92),8,6),0xf3ecd8);
        // La oreja: un cono aplastado hacia fuera y atrás; por dentro, más oscura.
        pon('cabeza','piel',G.cono(.034,.16,10),piel,[s*.13,.215,-.03],[0,s*.4,-s*1.25],[1,1,.35]);
        pon('cabeza','piel',G.cono(.022,.12,8),piel2,[s*.128,.213,-.022],[0,s*.4,-s*1.25],[1,1,.2]);}
      pon('cabeza','piel',G.bola(.017,12,8),piel2,[0,.163,.124],[0,0,0],[1.25,.75,.8]);
      pon('cabeza','piel',G.caja(.018,.045,.016),piel,[0,.188,.118],[-.25,0,0]);
      for(const s of [1,-1])pon('cabeza','piel',G.bola(.004,5,4),0x2e4a38,[s*.008,.156,.134]);
      pon('cabeza','piel',G.caja(.056,.008,.012),0x3a2a2e,[0,.12,.117]);
      pon('cabeza','piel',G.bola(.03,10,6),piel2,[0,.111,.113],[0,0,0],[1,.25,.35]);
      // La melena: casquete en dos mitades (la raya al medio), la masa de atrás, el flequillo abierto y ~30 mechones ondulados.
      for(const s of [1,-1])pon('cabeza','piel',new THREE.SphereGeometry(.136,18,12,s>0?PI/2:3*PI/2,PI,0,1.55),pelo,[0,.19,-.006],[-.45,0,-s*.05],[1.02,1.1,1.1],.06);
      pon('cabeza','piel',G.bola(.13,12,9),pelo,[0,.12,-.07],[0,0,0],[1.12,1.25,.82],.06);
      pon('cabeza','piel',G.torno([[.1,.16],[.13,.06],[.15,-.08],[.14,-.22],[.1,-.3]],16),pelo,[0,0,-.07],[0,0,0],[1,1,.55],.06);
      const tonos=[0x1c1f38,0x22284c,0x171a2e,0x272d56];let ni=0;
      // Cada mechón es una cinta: ancho a lo largo de la cabeza y fino hacia fuera (se aplasta en la dirección radial).
      const plano=(v,c)=>{const l=Math.hypot(c.x,c.z)||1,rx=c.x/l,rz=c.z/l,d=v.x*rx+v.z*rz;v.x+=rx*d*-.55;v.z+=rz*d*-.55;v.x*=1.35;v.z*=1.35;};
      const mechon=(pts,r0,r1)=>pon('cabeza','piel',G.tubo(pts,t=>(r0+(r1-r0)*t)*(t<.08?.7+t*3.7:1),12,5,false,plano),tonos[ni++%4],[0,0,0],[0,0,0],1,.05);
      for(const s of [1,-1]){
        mechon([[s*.006,.315,.1],[s*.05,.3,.135],[s*.1,.24,.13],[s*.13,.15,.11],[s*.15,.05,.09],[s*.16,-.06,.08]],.024,.009);
        mechon([[s*.02,.3,.11],[s*.08,.27,.13],[s*.12,.18,.125],[s*.14,.08,.115],[s*.13,-.04,.12],[s*.15,-.16,.1]],.02,.006);}
      for(let i=0;i<34;i++){const u=i/33,f=.85+u*(TAU-1.7),atras=Math.abs(Math.cos(f/2)),lado=Math.sin(f),ph=i*2.3;
        const y1=-.04-.3*(1-atras*atras)+(i%3)*-.035,R0=.13,pts=[];
        for(let j=0;j<=7;j++){const t=j/7,y=.24+(y1-.24)*t,R=R0+.03*Math.sin(Math.min(1,t*1.6)*PI/2)+.035*t*(1-Math.abs(lado)*.4)+.012*Math.sin(t*8+ph)*t,ff=f+.12*Math.sin(t*7+ph)*t;
          pts.push([Math.sin(ff)*R*1.02,y,Math.cos(ff)*R*.92-.02]);}
        mechon(pts,.034,.01);}
      // ---- El hacha de guerra a dos manos (en la derecha, como prolongación del brazo: el mango hacia -Y de la mano).
      // Doble hoja en creciente (un filo a cada lado, en ±Z) con el borde de acero claro; empuñadura de cuero en
      // espiral, pomo con púa, cubo con la runa que brilla, langetas y la púa del extremo.
      const hierro=0xb9bfca,hierro2=0x8a909b,filo=0xeef1f6,mango=0x3a2616;
      pon('manoD','piel',G.cil(.024,.028,1.34,12),mango,[0,-.5,0]);
      for(let i=0;i<14;i++)pon('manoD','piel',G.toro(.029,.0075,10,4),i%2?cuero2:0x4a2f1c,[0,.13-i*.039,0],[PI/2+(i%2?.2:-.2),0,0]);
      pon('manoD','metal',G.cil(.034,.03,.03,12),hierro2,[0,.18,0]);pon('manoD','metal',G.bola(.036,10,6),hierro,[0,.21,0]);
      pon('manoD','metal',G.cono(.018,.07,10),filo,[0,.27,0]);
      for(const y of [-.43,-.8])pon('manoD','metal',G.toro(.03,.007,14),hierro2,[0,y,0],[PI/2,0,0]);
      for(const s of [1,-1])pon('manoD','metal',G.caja(.01,.17,.02),hierro2,[s*.027,-.82,0],[0,0,0],1,.02);
      pon('manoD','metal',G.cil(.048,.048,.3,14),hierro,[0,-1.02,0],[0,0,0],1,.02);
      for(const y of [-.87,-1.17])pon('manoD','metal',G.toro(.05,.009,16),hierro2,[0,y,0],[PI/2,0,0]);
      for(const s of [1,-1]){pon('manoD','brillo',G.cil(.021,.021,.012,14),0x78e6ff,[s*.049,-1.02,0],[0,0,PI/2]);
        pon('manoD','metal',G.toro(.027,.006,16),hierro2,[s*.05,-1.02,0],[0,PI/2,0]);}
      pon('manoD','metal',G.cono(.032,.15,10),filo,[0,-1.245,0],[PI,0,0]);
      const arco=(r,g)=>[.08+r*Math.cos(g*PI/180),r*Math.sin(g*PI/180)];
      const hoja=new THREE.Shape();hoja.moveTo(.03,.11);hoja.quadraticCurveTo(.12,.08,...arco(.262,58));hoja.absarc(.08,0,.262,58*PI/180,-62*PI/180,true);
      hoja.quadraticCurveTo(.12,-.1,.03,-.13);hoja.lineTo(.03,.11);
      const borde=new THREE.Shape();borde.moveTo(...arco(.256,60));borde.lineTo(...arco(.292,71));borde.absarc(.08,0,.3,63*PI/180,-66*PI/180,true);
      borde.lineTo(...arco(.287,-76));borde.lineTo(...arco(.256,-64));borde.absarc(.08,0,.256,-64*PI/180,60*PI/180,false);
      for(const s of [1,-1]){const giro=[0,-s*PI/2,0];
        pon('manoD','metal',G.placa(hoja,.03,.006),hierro,[0,-1.02,0],giro,1,.03);
        pon('manoD','metal',G.placa(borde,.014),filo,[0,-1.02,0],giro,1,.02);
        for(const [u,v] of [[.07,.05],[.07,-.06],[.12,0]])for(const x of [1,-1])pon('manoD','metal',G.bola(.009,6,4),hierro2,[x*.019,-1.02+v,s*u]);}
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
      const M=materiales(TIPOS[tipo].lisos),{H,montar,p}=constructores[tipo](),mallas=montar(M);
      // El extremo del hacha de Adreida, la cabeza (para colocar el rastro del corte y para las pruebas).
      if(tipo==='adreida'){const punta=new THREE.Object3D();punta.position.set(0,-1.1,0);H.manoD.add(punta);M.punta=punta;}
      // La boca de la pistola de Mohamed (de donde salen las balas).
      if(tipo==='mohamed'){const boca=new THREE.Object3D();boca.position.set(0,-.36,0);H.manoD.add(boca);M.boca=boca;M.punta=boca;}
      return {tipo,H,M,mallas,p,raiz:H.raiz,...TIPOS[tipo]};
    }

    /* ---- El hacha a dos manos de Adreida ------------------------------------------------------
       Cada pose dice dónde está la empuñadura (G, la mano derecha) y hacia dónde apunta el hacha (A),
       en el espacio del torso; los dos brazos llegan con cinemática inversa de dos huesos: la derecha
       a G y la izquierda un poco más abajo del mango, hacia el pomo. La mano derecha se orienta para
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
      ik(H.brazoD,H.anteD,H.manoD,g,new THREE.Vector3(-.7,-.5,-.35).applyMatrix4(T));
      // La mano derecha: -Y por el mango, X (la cara del hacha) lo más cerca posible de «arriba».
      const y=a.clone().negate(),x=up.clone().addScaledVector(y,-up.dot(y));if(x.lengthSq()<1e-6)x.set(1,0,0);x.normalize();const z=new THREE.Vector3().crossVectors(x,y);
      H.manoD.parent.getWorldQuaternion(_q).invert();H.manoD.quaternion.setFromRotationMatrix(_m.makeBasis(x,y,z)).premultiply(_q);H.manoD.updateMatrixWorld(true);
      // La izquierda, 26 cm más abajo por el mango (hacia el pomo).
      ik(H.brazoI,H.anteI,H.manoI,g.clone().addScaledVector(a,-.26),new THREE.Vector3(.7,-.5,-.35).applyMatrix4(T));}
    // Dónde lleva el hacha en cada animación (espacio del torso: +Z delante, +X su izquierda, -X su derecha).
    function agarreAdreida(a){const k=a.k||0,t=a.t||0;
      const reposo=()=>{const bob=a.anim==='andar'?Math.sin((a.fase||0)*2)*.02*(a.paso??1):Math.sin(t*2.2)*.008;return {G:[-.12,.08+bob,.3],A:dirA(-.35,-.75)};};
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
        H.piernaI.rotation.x=-s*.62*amp;H.piernaD.rotation.x=s*.62*amp;H.rodillaI.rotation.x=Math.max(0,c)*.9*amp+.05;H.rodillaD.rotation.x=Math.max(0,-c)*.9*amp+.05;
        H.pieI.rotation.x=s*.25*amp;H.pieD.rotation.x=-s*.25*amp;
        H.brazoI.rotation.x=s*.5*amp;H.brazoD.rotation.x+=-s*.3*amp;H.torso.rotation.y=s*.12*amp;H.torso.rotation.x+=.1*amp;
        H.cuerpo.position.y=Math.abs(c)*.05*amp*esc-.02*amp;if(H.cola)H.cola.rotation.y+=s*.3*amp;};
      reposo();
      // Adreida lleva el hacha baja por delante (la cabeza al frente y abajo, cerca del suelo).
      if(m.tipo==='adreida'){H.brazoD.rotation.x=-.3;H.anteD.rotation.x=-.75;H.brazoD.rotation.z=-.22;}
      switch(a.anim){
        case 'andar':andar(a.fase||0,a.paso??1);break;
        case 'quieto':H.cuerpo.position.y=respira*.006;H.brazoI.rotation.z+=respira*.02;break;
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

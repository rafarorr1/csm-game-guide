/* Prueba de ARPG en three.js («Las Grietas del Editor», Hito 1): Adreida, la
   Guerrera Semiorca, defiende la plaza de Tomsage bajo asedio contra cuatro
   oleadas. Vista isométrica, clic para andar y atacar, como en Diablo.
     · Modelos 3D sencillos (arpg-three-modelos.js), animados por código.
     · La plaza: adoquines con relieve, casas con entramado (tres arden), un
       pozo, carros, barriles y braseros; la luna con sombras, la luz que lleva
       Adreida y el fuego de las casas; brasas y ceniza en el aire.
     · Combate: Tajo (clic), Torbellino (1/Q o clic derecho), Salto (2/W) y
       Provocar (3/E). La Furia sube al golpear y al recibir golpes. Los
       enemigos avisan antes de pegar: goblins que rodean, kobolds que lanzan
       lanzas desde lejos (se ve la línea), saqueadores que no se inmutan y Can,
       el de los Goblins, con un golpazo en área que se ve venir.
     · El botín son cartas físicas (three-carta.js) de los Objetos del juego,
       en Normal, Foil o Dorado, con su columna de luz. Al pasar por encima se
       levantan para leerlas; al recogerlas dan su bonificación.
     · En táctil: palanca para andar y botones de habilidad.
   ?captura=1 deja sólo el escenario, sin oleadas automáticas, y la revisión
   (CAOZ_ARPG_THREE_REVISION) avanza el tiempo a pasos fijos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),CAPTURA=q.get('captura')==='1';
  const estado=t=>{$('estado').textContent=t;},aviso=t=>{estado(t);$('info').textContent=t;};
  addEventListener('error',e=>aviso('Error: '+(e.message||e.error)));
  addEventListener('unhandledrejection',e=>aviso('Error: '+(e.reason?.message||e.reason)));
  if(!document.createElement('canvas').getContext('webgl2')){aviso('Este navegador no tiene WebGL 2, que three.js necesita. Prueba con Chrome, Edge, Firefox o Safari actualizados.');return;}
  if(CAPTURA)document.documentElement.dataset.captura='';
  const {THREE,EffectComposer,RenderPass,GTAOPass,UnrealBloomPass,OutputPass}=window.CAOZ_THREE;
  const MOD=window.CAOZ_ARPG_MODELOS.fabrica(THREE),C=window.CAOZ_THREE_CARTA,{ANCHO,ALTO}=C;
  const TAU=Math.PI*2,V3=THREE.Vector3;
  const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const efectos={sombras:true,oclusion:true,resplandor:true};
  let semilla=11;const rnd=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
  const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
  const difAng=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
  const rumbo=(de,a)=>Math.atan2(a.x-de.x,a.z-de.z);
  const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

  /* ---- Motor, escena y posproceso ------------------------------------------------ */
  const lienzo=$('lienzo'),esc=$('escenario');
  const renderer=new THREE.WebGLRenderer({canvas:lienzo,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;
  const gl=renderer.getContext(),hdr=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float'),muestras=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
  const depura=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(depura?gl.getParameter(depura.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)).slice(0,60);
  const escena=new THREE.Scene();escena.background=new THREE.Color(0x0b0810);escena.fog=new THREE.FogExp2(0x0d0a12,.022);
  // Entorno de los reflejos: noche azul arriba y el resplandor naranja del incendio en el horizonte.
  {const e=new THREE.Scene();e.background=new THREE.Color(0x05040a);const caja=(w,h,color,f,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(f),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);e.add(m);};
    caja(8,8,0x6f86c8,.9,[0,9,0]);caja(14,2.5,0xff7a30,1.6,[0,1,-9]);caja(10,2,0xff8a40,1.1,[9,1,3]);caja(10,2,0x2a3050,.8,[-9,1,2]);
    escena.environment=new THREE.PMREMGenerator(renderer).fromScene(e,.03).texture;escena.environmentIntensity=.55;}
  const camara=new THREE.PerspectiveCamera(32,1,.5,200);
  const objetivo=new THREE.WebGLRenderTarget(2,2,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,samples:muestras});
  const composer=new EffectComposer(renderer,objetivo),pasoRender=new RenderPass(escena,camara);
  const oclusion=new GTAOPass(escena,camara,2,2);oclusion.updateGtaoMaterial({radius:.9,distanceExponent:1.5,thickness:1.2,scale:1,samples:12});oclusion.blendIntensity=.85;
  // La oclusión sólo oculta puntos y líneas en su pasada de normales; las llamas, haces y marcas (transparentes) tampoco deben hacer sombra de contacto.
  {const ocultar=oclusion._overrideVisibility.bind(oclusion);oclusion._overrideVisibility=function(){ocultar();escena.traverse(n=>{if(n.visible&&n.material?.transparent){n.visible=false;this._visibilityCache.push(n);}});};}
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.5,.45,1.05),salida=new OutputPass();
  for(const p of [pasoRender,oclusion,resplandor,salida])composer.addPass(p);
  const reloj={t:0},tiempo={value:0};

  /* ---- Texturas pintadas --------------------------------------------------------- */
  const lienzoDe=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];};
  const tex=(c,srgb,rep)=>{const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...rep);}return t;};
  function normales(alto,fuerza){const w=alto.width,h=alto.height,d=alto.getContext('2d').getImageData(0,0,w,h).data,[c,g]=lienzoDe(w,h),im=g.createImageData(w,h),a=(x,y)=>d[(((y+h)%h)*w+((x+w)%w))*4]/255;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(a(x+1,y)-a(x-1,y))*fuerza,dy=(a(x,y+1)-a(x,y-1))*fuerza,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;im.data[i]=(-dx/l*.5+.5)*255;im.data[i+1]=(dy/l*.5+.5)*255;im.data[i+2]=(1/l*.5+.5)*255;im.data[i+3]=255;}
    g.putImageData(im,0,0);return c;}
  // Adoquines: un Voronoi que se repite (celdas con tono propio, juntas oscuras y con tierra).
  function adoquines(){const T=512,N=10,[c,g]=lienzoDe(T,T),[a,ga]=lienzoDe(T,T),col=g.createImageData(T,T),alt=ga.createImageData(T,T),cs=[];
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const tono=rnd();cs.push({x:(i+.2+rnd()*.6)*T/N,y:(j+.2+rnd()*.6)*T/N,c:[70+tono*40+rnd()*12,62+tono*34+rnd()*8,58+tono*30]});}
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){let d1=1e9,d2=1e9,m=null;const ci=Math.floor(x/T*N),cj=Math.floor(y/T*N);
      for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const ii=(ci+di+N)%N,jj=(cj+dj+N)%N,p=cs[jj*N+ii],px=p.x+Math.floor((ci+di)/N)*T*(ci+di<0||ci+di>=N?1:0),py=p.y+Math.floor((cj+dj)/N)*T*(cj+dj<0||cj+dj>=N?1:0),d=Math.hypot(x-px,y-py);if(d<d1){d2=d1;d1=d;m=p;}else if(d<d2)d2=d;}
      const borde=(d2-d1),piedra=Math.min(1,borde/7),o=(y*T+x)*4,ruido=(Math.sin(x*.9+y*.3)*Math.sin(y*.7-x*.2))*6;
      const k=.35+.65*piedra;col.data[o]=m.c[0]*k+ruido+(1-piedra)*8;col.data[o+1]=m.c[1]*k+ruido+(1-piedra)*4;col.data[o+2]=m.c[2]*k+ruido;col.data[o+3]=255;
      const h=Math.min(255,piedra*200+Math.min(1,d1/(T/N))*-30+ruido*2+40);alt.data[o]=alt.data[o+1]=alt.data[o+2]=h;alt.data[o+3]=255;}
    g.putImageData(col,0,0);ga.putImageData(alt,0,0);return {map:tex(c,true,[46,46]),normalMap:tex(normales(a,3.5),false,[46,46])};}
  // Quemaduras y ceniza sobre la plaza (una capa que oscurece).
  function quemaduras(){const T=512,[c,g]=lienzoDe(T,T);for(let i=0;i<46;i++){const x=rnd()*T,y=rnd()*T,r=10+rnd()*48,f=g.createRadialGradient(x,y,0,x,y,r);f.addColorStop(0,`rgba(0,0,0,${.45+rnd()*.35})`);f.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=f;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
    const cc=T/2,f=g.createRadialGradient(cc,cc,T*.28,cc,cc,T*.5);f.addColorStop(0,'rgba(0,0,0,0)');f.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=f;g.fillRect(0,0,T,T);return tex(c,true);}

  /* ---- La plaza de Tomsage -------------------------------------------------------- */
  const R=15.5;// radio de la plaza donde se juega
  const obstaculos=[];// círculos {x,z,r}
  const mundo=new THREE.Group();escena.add(mundo);
  const matSuelo=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,metalness:0,normalScale:new THREE.Vector2(1.2,1.2)});
  const suelo=new THREE.Mesh(new THREE.PlaneGeometry(140,140),matSuelo);suelo.rotation.x=-Math.PI/2;suelo.receiveShadow=true;mundo.add(suelo);
  const capaQuemada=new THREE.Mesh(new THREE.PlaneGeometry(44,44),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,color:0xffffff}));capaQuemada.rotation.x=-Math.PI/2;capaQuemada.position.y=.01;mundo.add(capaQuemada);
  const std=(color,p={})=>new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0,flatShading:true,...p});
  const MAT={yeso:std(0xb5a283),viga:std(0x3a2618),teja:std(0x6e2d22,{roughness:.7}),piedra:std(0x6d6760),madera:std(0x5b3d26),hierro:std(0x4a4a50,{metalness:.8,roughness:.4}),ventana:std(0x1a0d06,{emissive:0xff7a2a,emissiveIntensity:0}),oscuro:std(0x15100c)};
  function poner(geo,mat,x,y,z,ry=0,sombra=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=sombra;m.receiveShadow=true;mundo.add(m);return m;}
  const fuegos=[];// casas que arden: llamas y su luz
  const matLlama=new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`attribute float aSem;attribute vec2 aTam;varying vec2 vUv;varying float vS;void main(){vUv=uv;vS=aSem;vec4 mv=modelViewMatrix*vec4(position,1.);mv.xy+=vec2((uv.x-.5)*aTam.x,uv.y*aTam.y);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uT;varying vec2 vUv;varying float vS;
      float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      void main(){float r=n(vec2(vUv.x*4.+vS*7.,vUv.y*3.-uT*2.6+vS*3.))*.6+n(vec2(vUv.x*9.,vUv.y*7.-uT*4.))*.4;
        float forma=(1.-vUv.y)*smoothstep(.5,.05,abs(vUv.x-.5)*(1.1+vUv.y*1.6));float f=smoothstep(.22,.85,forma*(.55+.9*r));
        vec3 c=mix(vec3(1.,.2,.02),vec3(1.,.62,.22),f*f);gl_FragColor=vec4(c*f*1.15,f);}`});
  // Llamas: cuadros que miran siempre a la cámara (se construyen en el espacio de la vista).
  function llamas(x,y,z,ancho,alto,n){const g=new THREE.BufferGeometry(),P=[],U=[],S=[],T=[],I=[];
    for(let i=0;i<n;i++){const cx=x+(rnd()-.5)*ancho,cz=z+(rnd()-.5)*ancho*.6,w=(.5+rnd()*.5)*Math.max(.5,Math.min(1.8,ancho)),h=alto*(.7+rnd()*.6),s=rnd(),o=P.length/3;
      for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){P.push(cx,y,cz);U.push(u,v);S.push(s);T.push(w,h);}I.push(o,o+1,o+2,o,o+2,o+3);}
    g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('aSem',new THREE.Float32BufferAttribute(S,1));g.setAttribute('aTam',new THREE.Float32BufferAttribute(T,2));g.setIndex(I);
    const m=new THREE.Mesh(g,matLlama);m.frustumCulled=false;m.renderOrder=2;mundo.add(m);return m;}
  function casa(x,z,ry,w,d,h,arde){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;mundo.add(g);
    const pieza=(geo,mat,px,py,pz,rx=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.rotation.set(rx,0,rz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
    pieza(new THREE.BoxGeometry(w,.5,d),MAT.piedra,0,.25,0);pieza(new THREE.BoxGeometry(w-.04,h-.5,d-.04),MAT.yeso,0,.5+(h-.5)/2,0);
    for(const s of [-1,1]){pieza(new THREE.BoxGeometry(.18,h,.18),MAT.viga,s*(w/2-.02),h/2,d/2);pieza(new THREE.BoxGeometry(.18,h,.18),MAT.viga,s*(w/2-.02),h/2,-d/2);}
    pieza(new THREE.BoxGeometry(w+.1,.16,.16),MAT.viga,0,h*.55,d/2+.01);pieza(new THREE.BoxGeometry(w+.1,.16,.16),MAT.viga,0,h-.05,d/2+.01);
    for(const s of [-1,1])pieza(new THREE.BoxGeometry(.13,Math.hypot(w*.35,h*.45),.12),MAT.viga,s*w*.3,h*.77,d/2+.02,0,s*.75);
    pieza(new THREE.BoxGeometry(.9,1.5,.1),MAT.oscuro,-w*.18,1.25,d/2+.03);
    const ventana=pieza(new THREE.BoxGeometry(.7,.6,.1),arde?MAT.ventana:MAT.oscuro,w*.25,h*.35+.3,d/2+.03);
    const tejado=new THREE.Shape();tejado.moveTo(-w/2-.35,0);tejado.lineTo(w/2+.35,0);tejado.lineTo(0,h*.62);tejado.lineTo(-w/2-.35,0);
    const t=pieza(new THREE.ExtrudeGeometry(tejado,{depth:d+.5,bevelEnabled:false}),MAT.teja,0,h,-d/2-.25);
    if(arde){const f=llamas(0,0,0,w*.7,2.6,5);g.remove(f);f.position.set(0,h+.3,0);g.add(f);
      const luz=new THREE.PointLight(0xff7a2a,60,16,1.7);luz.position.set(0,h+1.4,d/2+.8);g.add(luz);fuegos.push({luz,x:x,z:z,alto:h+1});}
    if(Math.hypot(x,z)<R+Math.max(w,d)*.7)obstaculos.push({x,z,r:Math.max(w,d)*.55});
    return {g,ventana,t};}
  // Casas en corro, dejando tres calles por donde entra el asedio.
  const CALLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6];// norte, sureste y suroeste (en el plano XZ)
  const calle=a=>new V3(Math.cos(a),0,Math.sin(a));
  {let n=0;for(let a=0;a<TAU;a+=TAU/15){if(CALLES.some(c=>Math.abs(difAng(a,c))<.3))continue;const r=19.5+rnd()*2.5,x=Math.cos(a)*r,z=Math.sin(a)*r,w=3.6+rnd()*2,d=3.4+rnd()*1.5,h=2.6+rnd()*1.2;
    casa(x,z,-a-Math.PI/2+(rnd()-.5)*.25,w,d,h,[1,4,8].includes(n));n++;}
    for(let a=TAU/30;a<TAU;a+=TAU/11){const r=28+rnd()*4;casa(Math.cos(a)*r,Math.sin(a)*r,-a-Math.PI/2,4+rnd()*2,4,3+rnd()*1.5,false);}}
  // El pozo, un carro volcado, barriles, cajas y dos braseros.
  const braseros=[];
  {const pozo=poner(new THREE.CylinderGeometry(1.1,1.2,.8,12),MAT.piedra,-5,.4,-3);poner(new THREE.CylinderGeometry(.95,.95,.05,12),MAT.oscuro,-5,.81,-3,0,false);
    for(const s of [-1,1])poner(new THREE.BoxGeometry(.14,1.8,.14),MAT.madera,-5+s*.9,1.3,-3);poner(new THREE.BoxGeometry(2.3,.14,.2),MAT.madera,-5,2.15,-3);
    poner(new THREE.ConeGeometry(1.6,.8,4),MAT.teja,-5,2.6,-3,Math.PI/4);obstaculos.push({x:-5,z:-3,r:1.3});pozo.name='pozo';
    const carro=new THREE.Group();carro.position.set(6.5,0,-5.5);carro.rotation.set(0,.6,.35);mundo.add(carro);
    const cm=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;carro.add(m);};
    cm(new THREE.BoxGeometry(2.6,.15,1.4),MAT.madera,0,.8,0);for(const s of [-1,1])cm(new THREE.BoxGeometry(2.6,.5,.1),MAT.madera,0,1.1,s*.7);
    cm(new THREE.CylinderGeometry(.55,.55,.12,10),MAT.madera,-.8,.55,.8,Math.PI/2);cm(new THREE.CylinderGeometry(.55,.55,.12,10),MAT.madera,.9,.4,-.85,Math.PI/2,0,.3);obstaculos.push({x:6.5,z:-5.5,r:1.5});
    const barril=(x,z,tumbado)=>{const m=poner(new THREE.CylinderGeometry(.36,.4,.9,10),MAT.madera,x,tumbado?.38:.45,z);if(tumbado)m.rotation.set(Math.PI/2,0,rnd()*3);for(const y of [-.3,.3]){const a=new THREE.Mesh(new THREE.TorusGeometry(.39,.03,4,12),MAT.hierro);a.rotation.x=Math.PI/2;a.position.y=y;m.add(a);}};
    barril(-8.5,5,false);barril(-7.8,5.6,false);barril(-8.9,5.9,true);obstaculos.push({x:-8.3,z:5.5,r:1.1});
    for(const [x,z,s] of [[8.2,4.4,.9],[8.9,5.2,.7],[8.4,4.6,.6]])poner(new THREE.BoxGeometry(s,s,s),MAT.madera,x,s/2+(s===.6?.9:0),z,rnd());obstaculos.push({x:8.5,z:4.8,r:1});
    for(const [x,z] of [[-3.5,7.5],[4.5,-10]]){poner(new THREE.CylinderGeometry(.08,.08,1.2,6),MAT.hierro,x,.6,z);poner(new THREE.CylinderGeometry(.45,.2,.35,8,1,true),MAT.hierro,x,1.3,z);
      const f=llamas(x,1.3,z,.9,1,3),luz=new THREE.PointLight(0xffa050,26,11,1.8);luz.position.set(x,2.1,z);mundo.add(luz);braseros.push({luz,f,x,z});obstaculos.push({x,z,r:.5});}}
  // Todo lo estático de la plaza se funde por material: unas pocas mallas en vez de cientos.
  function fundirMundo(){mundo.updateMatrixWorld(true);const grupos=new Map(),quitar=[];
    mundo.traverse(o=>{if(!o.isMesh||o===suelo||o===capaQuemada||o.material.isShaderMaterial)return;if(!grupos.has(o.material))grupos.set(o.material,[]);grupos.get(o.material).push(o);quitar.push(o);});
    for(const o of quitar)o.parent.remove(o);
    for(const [mat,lista] of grupos){let n=0;const gs=lista.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);n+=g.attributes.position.count;return g;});
      const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2);let i=0;for(const g of gs){P.set(g.attributes.position.array,i*3);N.set(g.attributes.normal.array,i*3);if(g.attributes.uv)U.set(g.attributes.uv.array,i*2);i+=g.attributes.position.count;g.dispose();}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.setAttribute('uv',new THREE.BufferAttribute(U,2));geo.computeBoundingSphere();
      const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;mundo.add(m);}}
  fundirMundo();
  // Luces: luna azul con sombras (sigue a Adreida), cielo tenue y la luz que ella lleva (el radio de luz de Diablo).
  const hemi=new THREE.HemisphereLight(0x5a6aa0,0x2a1a10,.4);escena.add(hemi);
  const luna=new THREE.DirectionalLight(0xa8b8ff,1.5);luna.castShadow=true;luna.shadow.mapSize.set(2048,2048);luna.shadow.radius=3;luna.shadow.blurSamples=12;luna.shadow.bias=-.0004;luna.shadow.normalBias=.03;
  Object.assign(luna.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:70});escena.add(luna,luna.target);
  const luzHeroe=new THREE.PointLight(0xffd2a0,40,16,1.5);escena.add(luzHeroe);

  /* ---- Partículas, marcas en el suelo y números ------------------------------------ */
  const NP=2400,pPos=new Float32Array(NP*3),pCol=new Float32Array(NP*4),pTam=new Float32Array(NP),pVel=new Float32Array(NP*3),pVida=new Float32Array(NP),pMax=new Float32Array(NP),pGrav=new Float32Array(NP),pBase=new Float32Array(NP*4);
  let pSig=0;const escPuntos={value:1};
  const geoP=new THREE.BufferGeometry();geoP.setAttribute('position',new THREE.BufferAttribute(pPos,3).setUsage(THREE.DynamicDrawUsage));geoP.setAttribute('aColor',new THREE.BufferAttribute(pCol,4).setUsage(THREE.DynamicDrawUsage));geoP.setAttribute('aTam',new THREE.BufferAttribute(pTam,1).setUsage(THREE.DynamicDrawUsage));
  const puntos=new THREE.Points(geoP,new THREE.ShaderMaterial({uniforms:{uEsc:escPuntos},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aTam;attribute vec4 aColor;uniform float uEsc;varying vec4 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aTam*uEsc*60./(-mv.z);vC=aColor;}`,
    fragmentShader:`varying vec4 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d);gl_FragColor=vec4(vC.rgb,vC.a*a);}`}));
  puntos.frustumCulled=false;puntos.renderOrder=3;escena.add(puntos);
  function particula(x,y,z,vx,vy,vz,vida,tam,r,g,b,grav=0){const i=pSig;pSig=(pSig+1)%NP;pPos.set([x,y,z],i*3);pVel.set([vx,vy,vz],i*3);pVida[i]=vida;pMax[i]=vida;pTam[i]=tam;pBase.set([r,g,b,1],i*4);pGrav[i]=grav;}
  function chispas(p,n,color=[1,.7,.3],vel=6,tam=.5){for(let i=0;i<n;i++){const a=rnd()*TAU,e=rnd()*1.2-.1,v=vel*(.4+rnd()*.8);particula(p.x,p.y,p.z,Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v+1,Math.sin(a)*Math.cos(e)*v,.35+rnd()*.4,tam*(.6+rnd()*.8),color[0]*3,color[1]*3,color[2]*3,14);}}
  function polvo(p,n,radio=1){for(let i=0;i<n;i++){const a=rnd()*TAU,v=2+rnd()*4;particula(p.x+Math.cos(a)*radio*.3,.2,p.z+Math.sin(a)*radio*.3,Math.cos(a)*v,.6+rnd()*1.4,Math.sin(a)*v,.6+rnd()*.5,1.4+rnd()*1.2,.35,.28,.22,-1);}}
  function brasas(p,n,alto=1.2){for(let i=0;i<n;i++)particula(p.x+(rnd()-.5)*.8,p.y+rnd()*alto,p.z+(rnd()-.5)*.8,(rnd()-.5)*1.2,1+rnd()*2.4,(rnd()-.5)*1.2,.8+rnd()*1.1,.35+rnd()*.4,3,.9,.2,-.6);}
  function pasoParticulas(dt){for(let i=0;i<NP;i++){if(pVida[i]<=0){pCol[i*4+3]=0;continue;}pVida[i]-=dt;const j=i*3;pVel[j+1]-=pGrav[i]*dt;const fr=Math.exp(-dt*1.6);pVel[j]*=fr;pVel[j+2]*=fr;
    pPos[j]+=pVel[j]*dt;pPos[j+1]+=pVel[j+1]*dt;pPos[j+2]+=pVel[j+2]*dt;if(pPos[j+1]<.03){pPos[j+1]=.03;pVel[j+1]*=-.3;}
    const k=Math.max(0,pVida[i]/pMax[i]);pCol[i*4]=pBase[i*4];pCol[i*4+1]=pBase[i*4+1];pCol[i*4+2]=pBase[i*4+2];pCol[i*4+3]=Math.min(1,k*1.6);}
    geoP.attributes.position.needsUpdate=geoP.attributes.aColor.needsUpdate=geoP.attributes.aTam.needsUpdate=true;}
  // Brasas y ceniza que suben de los incendios todo el rato.
  function ambiente(dt){for(const f of fuegos)if(rnd()<dt*9)particula(f.x+(rnd()-.5)*3,f.alto+rnd(),f.z+(rnd()-.5)*3,(rnd()-.5)*1.5+.6,1.5+rnd()*2,(rnd()-.5)*1.5+.4,2.5+rnd()*2,.35+rnd()*.3,3,1,.25,-.15);
    if(rnd()<dt*14){const h=heroe?heroe.pos:new V3();particula(h.x+(rnd()-.5)*26,6+rnd()*3,h.z+(rnd()-.5)*20,.4,-.5-rnd()*.4,.2,6,.25+rnd()*.25,.35,.33,.34,0);}}
  // Marcas en el suelo: aviso en círculo que se llena, onda, anillo de selección y la línea de puntería.
  const marcas=[];
  const matMarca=(tipo)=>new THREE.ShaderMaterial({uniforms:{uP:{value:0},uA:{value:1},uC:{value:new THREE.Color()}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uP,uA;uniform vec3 uC;varying vec2 vUv;void main(){${tipo==='linea'?
      'float b=1.-abs(vUv.x-.5)*2.;float a=smoothstep(0.,.5,b)*(.3+.7*step(1.-vUv.y,uP))*(.5+.5*b);gl_FragColor=vec4(uC,a*uA);':
      `vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;float a=0.;
      ${tipo==='circulo'?'a=smoothstep(.9,.97,r)*(1.-smoothstep(.98,1.,r))*1.2+step(r,uP)*.28+smoothstep(uP-.04,uP,r)*step(r,uP)*.8;':''}
      ${tipo==='onda'?'a=smoothstep(uP-.2,uP,r)*(1.-smoothstep(uP,uP+.03,r))*1.5;':''}
      ${tipo==='anillo'?'a=smoothstep(.72,.84,r)*(1.-smoothstep(.9,1.,r));':''}
      gl_FragColor=vec4(uC,a*uA);`}}`});
  const geoMarca=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
  function marca(tipo,x,z,radio,color,dur,opc={}){const m=new THREE.Mesh(tipo==='linea'?new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,.5):geoMarca,matMarca(tipo));
    m.position.set(x,.04+marcas.length*.001,z);m.scale.setScalar(radio);m.material.uniforms.uC.value.set(color);m.renderOrder=1;escena.add(m);const o={m,tipo,t0:reloj.t,dur,...opc};marcas.push(o);return o;}
  function quitarMarca(o){const i=marcas.indexOf(o);if(i>=0)marcas.splice(i,1);escena.remove(o.m);o.m.material.dispose();if(o.tipo==='linea')o.m.geometry.dispose();}
  function pasoMarcas(){for(const o of [...marcas]){const k=o.dur?(reloj.t-o.t0)/o.dur:0;const u=o.m.material.uniforms;
    if(o.tipo==='onda'){u.uP.value=Math.min(1,k);u.uA.value=1-k;}else if(o.tipo==='circulo'||o.tipo==='linea'){u.uP.value=Math.min(1,k);u.uA.value=.8+.2*Math.sin(reloj.t*20);}
    if(o.fijo)continue;if(o.dur&&k>=1)quitarMarca(o);}}
  const seleccion=marca('anillo',0,0,.8,0xff4030,0,{fijo:true});seleccion.m.visible=false;
  // Etiquetas HTML (nombres del botín, números de daño) sobre posiciones del mundo.
  const capa=$('capa'),etiquetas=[],numeros=[];
  function colocar(e){const v=e.pos.clone().project(camara),b=esc.getBoundingClientRect();e.el.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*b.width}px,${(.5-v.y*.5)*b.height}px)`;e.el.hidden=v.z>1||e.oculta;}
  function etiqueta(clase,pos){const el=document.createElement('div');el.className=clase;capa.appendChild(el);const e={el,pos};etiquetas.push(e);return e;}
  function quitarEtiqueta(e){e.el.remove();const i=etiquetas.indexOf(e);if(i>=0)etiquetas.splice(i,1);}
  function numero(pos,texto,clase){const e=etiqueta('apNumero '+clase,pos.clone().add(new V3((rnd()-.5)*.5,0,(rnd()-.5)*.3)));e.el.textContent=texto;numeros.push({e,t0:reloj.t,y:e.pos.y});}

  /* ---- Personajes ------------------------------------------------------------------ */
  const DEF={
    goblin:{vida:34,dano:6,vel:3.7,alcance:1.05,aviso:.5,golpe:.18,recupera:.5,cd:1.1,botin:.24,globo:.18},
    kobold:{vida:26,dano:9,vel:3.3,alcance:11,aviso:.8,golpe:.3,recupera:.6,cd:2.3,botin:.3,globo:.2,lanza:true},
    saqueador:{vida:100,dano:13,vel:2.5,alcance:1.5,aviso:.72,golpe:.2,recupera:.7,cd:1.3,aguante:true,botin:.6,globo:.4},
    can:{vida:560,dano:19,vel:2.8,alcance:2.3,aviso:.8,golpe:.22,recupera:.75,cd:1.1,aguante:true,jefe:true,botin:1,globo:1},
  };
  const HAB={torbellino:{coste:30,cd:0},salto:{coste:25,cd:5},provocar:{coste:0,cd:10}};
  const hitboxMat=new THREE.MeshBasicMaterial({visible:false});
  let heroe=null,sigId=1;const enemigos=[],lanzas=[],globos=[];
  function cuerpoDe(tipo){const m=MOD.crear(tipo);const caja=new THREE.Mesh(new THREE.CylinderGeometry(m.radio*1.35,m.radio*1.35,m.alto*1.05,10).translate(0,m.alto*.52,0),hitboxMat);m.raiz.add(caja);m.caja=caja;escena.add(m.raiz);return m;}
  function crearHeroe(){const m=cuerpoDe('adreida');heroe={id:0,m,pos:new V3(0,0,4),dir:Math.PI,giro:0,estado:'quieto',t:0,alma:140,almaMax:140,furia:0,atqBase:12,atq:12,orden:null,cd:{salto:0,provocar:0},escudo:0,fase:0,paso:0,golpeo:false,tick:0,
    destello:0,dolor:1,vivo:true,botin:[],llaves:0,objetivoSalto:null,origenSalto:null,radio:m.radio,muerteT:0};m.caja.userData.heroe=true;}
  function crearEnemigo(tipo,x,z,opc={}){const m=cuerpoDe(tipo),d=DEF[tipo],e={id:sigId++,tipo,m,d,pos:new V3(x,0,z),dir:rumbo(new V3(x,0,z),new V3()),vida:d.vida,vidaMax:d.vida,estado:opc.quieto?'quieto':'entra',t:0,cd:.4+rnd()*.8,emp:new V3(),fase:rnd()*TAU,paso:0,
      destello:0,radio:m.radio,rodeo:(rnd()-.5)*1.6,provocado:0,dentro:Math.hypot(x,z)<R-.5,quieto:!!opc.quieto,ataques:0,gritó:false,marca:null,aturdidoT:0,estrellas:null};
    m.caja.userData.enemigo=e;m.raiz.position.copy(e.pos);enemigos.push(e);return e;}

  /* ---- Cartas de botín (three-carta.js) -------------------------------------------- */
  const F=C.fabrica(THREE,renderer);const SB=.3,MIRA=3.2;
  const imagen=url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});
  const cacheTex=new Map(),dorso={mat:null};
  async function texturasDe(id,ed){const k=id+'/'+ed;if(!cacheTex.has(k))cacheTex.set(k,(async()=>{const a=window.ARPG_THREE_ARTE[k],img=await imagen('./'+a.url);
    const p=CAOZ_CARTA_PINTOR.texturas({id,acabado:ed,arte:{img,enc:a.enc},ancho:512});const [c,g]=lienzoDe(96,134);g.drawImage(p.color,0,0,96,134);return {tx:F.texturas(p),miniatura:c.toDataURL('image/jpeg',.85)};})());return cacheTex.get(k);}
  const EDICIONES={normal:{nombre:'Normal',mult:1,color:0xd8d0c0,haz:.12},foil:{nombre:'Foil',mult:1.5,color:0x7fd8ff,haz:.55},dorado:{nombre:'Dorado',mult:2,color:0xffc850,haz:1.1}};
  const POOL=['mazo','arco','collar','espadaluz','espadaboveda','lentesmachete','sombrero','brazosagua'];
  function bono(id,ed){const c=CARDS[id],k=EDICIONES[ed].mult;if(id==='llavemago')return {llave:1,texto:'Abre una Grieta del Editor'};
    let atq=Math.round((c.mod?.a||0)*1.5*k),alma=Math.round((c.mod?.h||0)*6*k);if(!atq&&!alma){atq=Math.round(1*k);alma=Math.round(6*k);}
    return {atq,alma,texto:[atq?'+'+atq+' ATQ':'',alma?'+'+alma+' Alma':''].filter(Boolean).join(' · ')};}
  const botines=[];
  const matHaz=new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uT;uniform vec3 uC;uniform float uF;varying vec2 vUv;void main(){float a=pow(1.-vUv.y,1.6)*(.75+.25*sin(vUv.x*TAU*3.+uT*3.));gl_FragColor=vec4(uC*uF,a);}`.replace('TAU','6.2832')});
  async function soltar(id,ed,x,z,desde){
    const b={id,ed,listo:false,pos:new V3(x,0,z),vel:new V3(),y:desde?1.2:.1,vy:0,volando:!!desde,t0:reloj.t,mirada:0,recogida:false,bono:bono(id,ed)};botines.push(b);
    if(desde){const a=rnd()*TAU,v=1.5+rnd()*1.8;b.pos.copy(desde);b.vel.set(Math.cos(a)*v,0,Math.sin(a)*v);b.vy=6.5;}
    const {tx,miniatura}=await texturasDe(id,ed);if(!botines.includes(b))return b;b.miniatura=miniatura;
    const g=F.carta(F.materialCara(tx,ed),dorso.mat,F.materialCanto(ed));g.scale.setScalar(SB);escena.add(g);b.g=g;
    b.caja=new THREE.Mesh(new THREE.BoxGeometry(ANCHO*SB*1.5,ALTO*SB*1.3,.8),hitboxMat);b.caja.userData.botin=b;escena.add(b.caja);
    const E=EDICIONES[ed],haz=new THREE.Mesh(new THREE.CylinderGeometry(ed==='normal'?.2:.35,ed==='normal'?.4:.55,ed==='normal'?1.6:7,16,1,true).translate(0,ed==='normal'?.8:3.5,0),matHaz.clone());
    haz.material.uniforms={uT:tiempo,uC:{value:new THREE.Color(E.color)},uF:{value:E.haz}};escena.add(haz);b.haz=haz;
    b.luzBase=ed==='dorado'?16:ed==='foil'?10:6;b.luz=new THREE.PointLight(E.color,b.luzBase,6,2);escena.add(b.luz);
    b.nombre=etiqueta('apNombreBotin '+ed,new V3());b.nombre.el.innerHTML=`<b>${CARDS[id].n}</b><small>${E.nombre} · ${b.bono.texto}</small>`;
    b.listo=true;if(!desde)b.y=ALTO*SB/2+.15;return b;}
  function quitarBotin(b){const i=botines.indexOf(b);if(i>=0)botines.splice(i,1);if(b.g){escena.remove(b.g,b.caja,b.haz,b.luz);quitarEtiqueta(b.nombre);b.haz.material.dispose();}}
  function recoger(b){if(b.recogida||!b.listo)return;b.recogida=true;b.tRec=reloj.t;b.desdeRec=b.g.position.clone();
    const B=b.bono;if(B.llave)heroe.llaves++;heroe.atq+=B.atq||0;heroe.almaMax+=B.alma||0;heroe.alma+=B.alma||0;heroe.botin.push({id:b.id,ed:b.ed});
    const el=document.createElement('figure');el.className='apCarta '+b.ed;el.innerHTML=`<img alt="" src="${b.miniatura}"><figcaption>${CARDS[b.id].n}</figcaption>`;$('botin').appendChild(el);
    tostada(`${CARDS[b.id].n} <em class="${b.ed}">${EDICIONES[b.ed].nombre}</em> · ${B.texto}`);chispas(b.g.position,26,b.ed==='dorado'?[1,.8,.35]:b.ed==='foil'?[.5,.85,1]:[1,.95,.8],4,.45);}
  const arribaCam=new V3();
  function pasoBotin(dt){arribaCam.set(0,1,0).applyQuaternion(camara.quaternion);
    for(const b of [...botines]){if(!b.listo)continue;const g=b.g,alto=ALTO*SB/2+.15;
      if(b.recogida){const k=(reloj.t-b.tRec)/.5,dest=camara.localToWorld(new V3(0,-1.6,-6));g.position.lerpVectors(b.desdeRec,dest,suave(k));g.scale.setScalar(SB*(1-k*.8));g.quaternion.slerp(camara.quaternion,Math.min(1,dt*10));b.haz.visible=false;b.nombre.oculta=true;if(k>=1)quitarBotin(b);continue;}
      if(b.volando){b.pos.addScaledVector(b.vel,dt);b.vy-=20*dt;b.y+=b.vy*dt;g.rotation.x+=dt*11;g.rotation.y+=dt*5;
        if(b.y<=alto&&b.vy<0){b.volando=false;b.y=alto;chispas(new V3(b.pos.x,.2,b.pos.z),b.ed==='dorado'?30:12,b.ed==='dorado'?[1,.8,.35]:[.7,.8,1],3,.4);if(b.ed==='dorado'){temblar(.15);}}
        dentroPlaza(b.pos,.3);}
      else{const mira=b.mirada>.5,q=new THREE.Quaternion();
        if(mira)q.copy(camara.quaternion);else q.setFromEuler(new THREE.Euler(-.15,reloj.t*.9+b.t0*3,0));
        g.quaternion.slerp(q,Math.min(1,dt*(mira?14:5)));b.y+=((mira?alto:alto+Math.sin(reloj.t*2+b.t0)*.06)-b.y)*Math.min(1,dt*(mira?14:6));
        g.scale.setScalar(g.scale.x+((mira?SB*MIRA:SB)-g.scale.x)*Math.min(1,dt*(mira?14:7)));}
      // Mirándola crece hacia arriba en pantalla desde donde está (su borde de abajo queda en su sitio).
      g.position.set(b.pos.x,b.y,b.pos.z).addScaledVector(arribaCam,(g.scale.x-SB)*ALTO/2);b.caja.position.set(b.pos.x,alto,b.pos.z);b.caja.quaternion.copy(camara.quaternion);b.haz.position.set(b.pos.x,0,b.pos.z);b.haz.material.uniforms.uF.value=EDICIONES[b.ed].haz*(1-b.mirada*.9);
      // Mirándola, su luz pasa delante (hacia la cámara) para leerla.
      b.luz.position.set(b.pos.x,1.2,b.pos.z).lerp(g.position.clone().add(camara.position.clone().sub(g.position).normalize().multiplyScalar(2.2)),b.mirada);b.luz.intensity=b.luzBase+b.mirada*22;
      b.nombre.pos.copy(g.position).addScaledVector(arribaCam,ALTO*g.scale.x/2+.28);b.nombre.oculta=b.volando;b.nombre.el.classList.toggle('mirada',b.mirada>.5);}}

  /* ---- Globos de Alma (curan) y lanzas de los kobolds -------------------------------- */
  const geoGlobo=new THREE.IcosahedronGeometry(.22,1),matGlobo=new THREE.MeshStandardMaterial({color:0x400008,emissive:0xff2a3a,emissiveIntensity:2.2,roughness:.3});
  function globo(p){const m=new THREE.Mesh(geoGlobo,matGlobo);m.position.set(p.x,.5,p.z);escena.add(m);const a=rnd()*TAU;globos.push({m,pos:new V3(p.x,0,p.z),vel:new V3(Math.cos(a)*2,0,Math.sin(a)*2),t0:reloj.t});}
  function pasoGlobos(dt){for(const g of [...globos]){g.vel.multiplyScalar(Math.exp(-dt*4));g.pos.addScaledVector(g.vel,dt);const d=plano(g.pos,heroe.pos);
    const herida=heroe.vivo&&heroe.alma<heroe.almaMax;if(herida&&d<3.2){g.pos.lerp(heroe.pos,Math.min(1,dt*(3.2-d)*3));}
    g.m.position.set(g.pos.x,.45+Math.sin(reloj.t*3+g.t0)*.08,g.pos.z);g.m.rotation.y+=dt*2;
    if(herida&&d<1){const c=Math.round(heroe.almaMax*.2);heroe.alma=Math.min(heroe.almaMax,heroe.alma+c);numero(heroe.pos.clone().setY(2.2),'+'+c,'cura');chispas(g.m.position,16,[1,.25,.3],3,.4);escena.remove(g.m);globos.splice(globos.indexOf(g),1);}}}
  const geoLanza=new THREE.CylinderGeometry(.018,.018,1.2,5).rotateX(Math.PI/2),geoPunta=new THREE.ConeGeometry(.04,.16,4).rotateX(Math.PI/2).translate(0,0,.66);
  function lanzar(e,destino){const g=new THREE.Group();g.add(new THREE.Mesh(geoLanza,MAT.madera),new THREE.Mesh(geoPunta,MAT.hierro));const p=e.pos.clone().setY(1.1),dir=destino.clone().setY(1).sub(p).normalize();
    g.position.copy(p);g.lookAt(p.clone().add(dir));g.traverse(o=>{o.castShadow=true;});escena.add(g);lanzas.push({g,dir,vel:15,t0:reloj.t,dano:e.d.dano,clavada:0});}
  function pasoLanzas(dt){for(const l of [...lanzas]){if(l.clavada){if(reloj.t-l.clavada>1.2){escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);}continue;}
    l.g.position.addScaledVector(l.dir,l.vel*dt);const p=l.g.position;
    if(heroe.vivo&&plano(p,heroe.pos)<heroe.radio+.25&&p.y<2.2){herir(l.dano,p);chispas(p,10,[1,.4,.3],4,.4);escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);continue;}
    if(obstaculos.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r)||Math.hypot(p.x,p.z)>R+4||p.y<.1||reloj.t-l.t0>2){l.clavada=reloj.t;chispas(p,5,[.8,.7,.6],2,.3);}}}

  /* ---- Colisiones --------------------------------------------------------------------- */
  function dentroPlaza(p,r){for(const o of obstaculos){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),m=o.r+r;if(d<m&&d>1e-4){p.x=o.x+dx/d*m;p.z=o.z+dz/d*m;}}
    const d=Math.hypot(p.x,p.z);if(d>R-r){p.x*=(R-r)/d;p.z*=(R-r)/d;}}
  function separar(){const todos=[heroe,...enemigos.filter(e=>e.estado!=='muere')];for(let i=0;i<todos.length;i++)for(let j=i+1;j<todos.length;j++){const a=todos[i],b=todos[j];if(a===heroe&&heroe.estado==='salto')continue;
    const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz),m=a.radio+b.radio;if(d<m&&d>1e-4){const k=(m-d)/d,wa=a===heroe?.15:.5,wb=b===heroe?.15:.5;a.pos.x-=dx*k*wa;a.pos.z-=dz*k*wa;b.pos.x+=dx*k*wb;b.pos.z+=dz*k*wb;}}}

  /* ---- Adreida: órdenes, habilidades y golpes ---------------------------------------- */
  const VEL=5.6,ALCANCE=1.95,GOLPE=.48,IMPACTO=.2;
  const libre=()=>heroe.vivo&&['quieto','andar'].includes(heroe.estado)||heroe.estado==='golpe'&&heroe.t>IMPACTO+.04;
  function cambiar(e,s){e.estado=s;e.t=0;}
  function ordenar(o){if(!heroe.vivo)return;heroe.orden=o;}
  function usar(h,punto){if(!heroe.vivo)return false;const H=HAB[h];
    if(!libre())return false;if(heroe.furia<H.coste){rechazo(h,'Te falta Furia');return false;}if((heroe.cd[h]||0)>0){rechazo(h,'Aún no está lista');return false;}
    heroe.furia-=H.coste;if(H.cd)heroe.cd[h]=H.cd;heroe.orden=null;
    if(h==='torbellino'){cambiar(heroe,'torbellino');heroe.tick=0;heroe.dirTor=punto?punto.clone():null;}
    if(h==='salto'){const p=punto?punto.clone():heroe.pos.clone().add(new V3(Math.sin(heroe.dir),0,Math.cos(heroe.dir)).multiplyScalar(6)),d=plano(p,heroe.pos);if(d>8)p.sub(heroe.pos).multiplyScalar(8/d).add(heroe.pos);
      p.y=0;dentroPlaza(p,heroe.radio);heroe.origenSalto=heroe.pos.clone();heroe.objetivoSalto=p;heroe.dir=rumbo(heroe.pos,p);cambiar(heroe,'salto');heroe.golpeo=false;}
    if(h==='provocar'){cambiar(heroe,'grito');heroe.golpeo=false;}
    return true;}
  function rechazo(h,texto){const b=document.querySelector(`[data-hab="${h}"]`);if(b){b.classList.remove('no');void b.offsetWidth;b.classList.add('no');}tostada(texto,true);}
  function danar(e,dano,opc={}){if(e.estado==='muere')return;const crit=opc.crit??rnd()<.12;dano=Math.round(dano*(crit?1.8:1)*(.9+rnd()*.2));e.vida-=dano;e.destello=1;
    numero(e.pos.clone().setY(e.m.alto+.3),String(dano),crit?'critico':'dano');
    const lejos=e.pos.clone().sub(heroe.pos).setY(0).normalize();e.emp.addScaledVector(lejos,(opc.empuje??1.6)*(e.d.aguante?.35:1));
    if(e.vida<=0){morir(e);return;}
    if(!e.d.aguante&&['persigue','aviso','recupera'].includes(e.estado)&&!opc.sinDolor){if(e.marca){quitarMarca(e.marca);e.marca=null;}cambiar(e,'dolor');}
    if(opc.aturde){if(e.marca){quitarMarca(e.marca);e.marca=null;}cambiar(e,'aturdido');e.aturdidoT=opc.aturde*(e.d.jefe?.4:1);}
    e.provocado=Math.max(e.provocado,.1);}
  function golpearEn(radio,arco,dano,opc){let n=0;const f=new V3(Math.sin(heroe.dir),0,Math.cos(heroe.dir));
    for(const e of enemigos){if(e.estado==='muere')continue;const d=plano(e.pos,heroe.pos);if(d>radio+e.radio)continue;
      if(arco<Math.PI){const v=e.pos.clone().sub(heroe.pos).setY(0).normalize();if(v.dot(f)<Math.cos(arco)&&d>e.radio+.3)continue;}
      danar(e,dano,opc);n++;const p=e.pos.clone().lerp(heroe.pos,.35).setY(1.1);chispas(p,opc?.chispas??10,[1,.75,.4],6,.45);}
    return n;}
  let paron=0;// el parón al golpear: congela el mundo un instante (se siente el impacto)
  function herir(dano,desde){if(!heroe.vivo)return;dano=Math.round(dano*(heroe.escudo>0?.5:1));heroe.alma-=dano;heroe.destello=1;heroe.dolor=0;heroe.furia=Math.min(100,heroe.furia+dano*.7);
    numero(heroe.pos.clone().setY(2.3),String(dano),'recibido');temblar(.18);heroe.heridaT=reloj.t;
    if(heroe.alma<=0){heroe.alma=0;heroe.vivo=false;cambiar(heroe,'muerta');heroe.orden=null;}}
  function pasoHeroe(dt){const h=heroe;h.t+=dt;for(const k in h.cd)h.cd[k]=Math.max(0,h.cd[k]-dt);h.escudo=Math.max(0,h.escudo-dt);h.destello=Math.max(0,h.destello-dt*5);h.dolor=Math.min(1,h.dolor+dt*4);
    const hacia=(p,vel)=>{const d=plano(p,h.pos);if(d<.05)return 0;const paso=Math.min(d,vel*dt);const a=rumbo(h.pos,p);h.dir+=difAng(h.dir,a)*Math.min(1,dt*16);h.pos.x+=Math.sin(a)*paso;h.pos.z+=Math.cos(a)*paso;return paso;};
    let movido=0;
    if(h.estado==='muerta'){h.muerteT+=dt;return;}
    if(['quieto','andar'].includes(h.estado)||(h.estado==='golpe'&&h.t>=GOLPE)){
      if(h.estado==='golpe')cambiar(h,'quieto');const o=h.orden;
      if(o?.tipo==='ir'){movido=hacia(o.p,VEL);if(plano(o.p,h.pos)<.12&&!o.seguir)h.orden=null;}
      else if(o?.tipo==='atacar'){const e=o.e;if(!enemigos.includes(e)||e.estado==='muere'){h.orden=null;}
        else if(plano(e.pos,h.pos)<=ALCANCE+e.radio-.1){h.dir=rumbo(h.pos,e.pos);cambiar(h,'golpe');h.golpeo=false;if(!o.seguir)h.orden=o.repetir?o:null;}
        else movido=hacia(e.pos,VEL);}
      else if(o?.tipo==='tajo'){h.dir=rumbo(h.pos,o.p);cambiar(h,'golpe');h.golpeo=false;h.orden=null;}
      else if(o?.tipo==='recoger'){const b=o.b;if(!botines.includes(b)||b.recogida)h.orden=null;else if(plano(b.pos,h.pos)<1.2){recoger(b);h.orden=null;}else movido=hacia(b.pos,VEL);}
      else if(o?.tipo==='mover'){const v=o.v;if(v.lengthSq()>.01){const p=h.pos.clone().addScaledVector(v,3);movido=hacia(p,VEL*Math.min(1,v.length()));}}
      if(['quieto','andar'].includes(h.estado))h.estado=movido>0?'andar':'quieto';}
    else if(h.estado==='golpe'){if(!h.golpeo&&h.t>=IMPACTO){h.golpeo=true;const n=golpearEn(ALCANCE,1.2,h.atq,{});if(n){h.furia=Math.min(100,h.furia+Math.min(14,n*7));paron=.06;temblar(.06);}}}
    else if(h.estado==='torbellino'){const D=1.35;const p=h.dirTor||(h.orden?.tipo==='mover'?h.pos.clone().addScaledVector(h.orden.v,3):null);
      if(p){const d=plano(p,h.pos);if(d>.2){const a=rumbo(h.pos,p),paso=Math.min(d,3.8*dt);h.pos.x+=Math.sin(a)*paso;h.pos.z+=Math.cos(a)*paso;h.dir=a;movido=paso;}}
      h.tick-=dt;if(h.tick<=0){h.tick=.2;const n=golpearEn(2.55,Math.PI,h.atq*.5,{empuje:1.1,sinDolor:false,crit:false,chispas:6});if(n)h.furia=Math.min(100,h.furia+n*1.5);}
      if(rnd()<.8){const a=rnd()*TAU;particula(h.pos.x+Math.cos(a)*2,1+rnd()*.3,h.pos.z+Math.sin(a)*2,-Math.sin(a)*6,.3,Math.cos(a)*6,.25,.5,2.2,1.6,1.2,0);}
      if(h.t>=D){cambiar(h,'quieto');h.dirTor=null;}}
    else if(h.estado==='salto'){const D=.72,k=Math.min(1,h.t/D),m=tramo(k,.12,.86);h.pos.lerpVectors(h.origenSalto,h.objetivoSalto,m);h.alto=Math.sin(Math.PI*m)*2.4;
      if(!h.golpeo&&k>=.86){h.golpeo=true;h.alto=0;golpearEn(3.2,Math.PI,h.atq*1.7,{empuje:4.5,aturde:1.1,chispas:14});marca('onda',h.pos.x,h.pos.z,4.2,0xffb050,.5);polvo(h.pos,40,2);chispas(h.pos.clone().setY(.3),30,[1,.7,.35],8,.5);temblar(.5);paron=.08;}
      if(h.t>=D){cambiar(h,'quieto');h.alto=0;}}
    else if(h.estado==='grito'){if(!h.golpeo&&h.t>=.18){h.golpeo=true;h.escudo=4;h.furia=Math.min(100,h.furia+35);marca('onda',h.pos.x,h.pos.z,10,0xffd070,.7);chispas(h.pos.clone().setY(1.4),40,[1,.85,.4],7,.5);temblar(.2);
        for(const e of enemigos){if(e.estado==='muere')continue;const d=plano(e.pos,h.pos);if(d<10){e.provocado=3.5;e.tirón={p:e.pos.clone().lerp(h.pos,Math.min(.5,1.6/Math.max(d,.1))),hasta:reloj.t+.35};if(e.estado==='entra')e.dentro=true;}}}
      if(h.t>=.7)cambiar(h,'quieto');}
    h.fase+=movido*TAU/1.75;h.paso+=((movido>0?1:0)-h.paso)*Math.min(1,dt*10);dentroPlaza(h.pos,h.radio);}

  /* ---- Enemigos: acercarse, avisar, golpear -------------------------------------------- */
  function pasoEnemigo(e,dt){const d=e.d;e.t+=dt;e.destello=Math.max(0,e.destello-dt*6);e.provocado=Math.max(0,e.provocado-dt);e.cd-=dt;
    e.pos.addScaledVector(e.emp,dt);e.emp.multiplyScalar(Math.exp(-dt*7));
    // El tirón de Provocar dura un instante (si el punto cae en un obstáculo no se queda enganchado).
    if(e.tirón){e.pos.lerp(e.tirón.p,Math.min(1,dt*8));if(reloj.t>e.tirón.hasta||plano(e.pos,e.tirón.p)<.05)e.tirón=null;}
    if(!e.dentro&&Math.hypot(e.pos.x,e.pos.z)<R-1.2)e.dentro=true;
    const H=heroe,dist=plano(e.pos,H.pos),hacia=(p,vel)=>{const dd=plano(p,e.pos);if(dd<.05)return 0;const paso=Math.min(dd,vel*dt),a=rumbo(e.pos,p);e.dir+=difAng(e.dir,a)*Math.min(1,dt*9);e.pos.x+=Math.sin(a)*paso;e.pos.z+=Math.cos(a)*paso;return paso;};
    let movido=0;const vel=d.vel*(e.provocado>0?1.25:1);
    switch(e.estado){
      case 'quieto':break;
      case 'entra':movido=hacia(new V3(e.pos.x*.5,0,e.pos.z*.5),vel);if(Math.hypot(e.pos.x,e.pos.z)<R-1.2){e.dentro=true;cambiar(e,'persigue');}break;
      case 'persigue':{if(!H.vivo){movido=hacia(e.pos.clone().multiplyScalar(1.02),vel*.3);break;}
        if(e.tipo==='can'&&!e.gritó&&e.vida<e.vidaMax*.5){e.gritó=true;cambiar(e,'grito');marca('onda',e.pos.x,e.pos.z,8,0xff5030,.8);banner('¡A mí, goblins!','Can llama a los suyos.');break;}
        if(d.lanza&&!e.provocado){// Kobold: guarda la distancia y lanza.
          const lejos=e.pos.clone().sub(H.pos).setY(0).normalize();if(dist>8.5)movido=hacia(H.pos,vel);else if(dist<5)movido=hacia(e.pos.clone().addScaledVector(lejos,2),vel*.9);
          else{const lado=new V3(-lejos.z,0,lejos.x).multiplyScalar(e.rodeo>0?1:-1);movido=hacia(e.pos.clone().addScaledVector(lado,1.5),vel*.45);}
          if(e.cd<=0&&dist<d.alcance){cambiar(e,'aviso');e.apunta=H.pos.clone();e.marca=marca('linea',e.pos.x,e.pos.z,1,0xff3020,d.aviso);}break;}
        // Cuerpo a cuerpo: rodea (cada uno por su lado) y se acerca.
        const a=rumbo(H.pos,e.pos)+e.rodeo*Math.min(1,Math.max(0,dist-2)/4),radio=Math.max(0,H.radio+e.radio+(d.lanza?.2:d.alcance*.55));
        const obj=dist>2.8?H.pos.clone().add(new V3(Math.sin(a),0,Math.cos(a)).multiplyScalar(Math.min(dist,2.4))):H.pos.clone().add(new V3(Math.sin(rumbo(H.pos,e.pos)),0,Math.cos(rumbo(H.pos,e.pos))).multiplyScalar(radio));
        movido=hacia(obj,vel);if(dist<H.radio+e.radio+d.alcance*(d.lanza?.3:1)&&e.cd<=0){e.dir=rumbo(e.pos,H.pos);
          if(e.tipo==='can'&&e.ataques%3===2){cambiar(e,'avisoArea');const c=e.pos.clone().add(new V3(Math.sin(e.dir),0,Math.cos(e.dir)).multiplyScalar(1.8));e.centro=c;e.marca=marca('circulo',c.x,c.z,2.8,0xff3a20,1.15);}
          else cambiar(e,'aviso');}
        break;}
      case 'aviso':{const gira=d.lanza?4:2.2;if(d.lanza&&!e.apunta)e.apunta=H.pos.clone();// un kobold provocado llega aquí sin apuntare.dir+=difAng(e.dir,rumbo(e.pos,H.pos))*Math.min(1,dt*gira);
        if(d.lanza&&e.marca){e.apunta.lerp(H.pos,Math.min(1,dt*3));const dd=plano(e.apunta,e.pos);e.marca.m.position.set(e.pos.x,.05,e.pos.z);e.marca.m.rotation.y=rumbo(e.pos,e.apunta);e.marca.m.scale.set(.5,1,Math.max(dd,1)+1);}
        if(e.t>=d.aviso){if(e.marca){quitarMarca(e.marca);e.marca=null;}cambiar(e,'golpe');e.ataques++;
          if(d.lanza)lanzar(e,e.apunta);
          else{const f=new V3(Math.sin(e.dir),0,Math.cos(e.dir)),v=H.pos.clone().sub(e.pos).setY(0),dd=v.length();
            if(H.vivo&&dd<H.radio+e.radio+d.alcance+.25&&v.normalize().dot(f)>.35)herir(d.dano,e.pos);}}
        break;}
      case 'avisoArea':if(e.t>=1.15){cambiar(e,'golpe');e.ataques++;if(e.marca){quitarMarca(e.marca);e.marca=null;}const c=e.centro;marca('onda',c.x,c.z,3.4,0xff7040,.45);polvo(c,36,2.8);temblar(.45);
          if(H.vivo&&plano(H.pos,c)<2.8+H.radio*.5)herir(Math.round(d.dano*1.5),c);}break;
      case 'grito':if(e.t>=.9){cambiar(e,'persigue');for(let i=0;i<3;i++){const a=CALLES[i],p=calle(a).multiplyScalar(R+3);crearEnemigo('goblin',p.x,p.z);}}break;
      case 'golpe':if(e.t>=d.golpe){cambiar(e,'recupera');}break;
      case 'recupera':if(e.t>=d.recupera){e.cd=d.cd*(.8+rnd()*.4);cambiar(e,'persigue');}break;
      case 'dolor':if(e.t>=.28){e.cd=Math.max(e.cd,.35);cambiar(e,'persigue');}break;
      case 'aturdido':e.aturdidoT-=dt;if(e.aturdidoT<=0){cambiar(e,'persigue');}break;
      case 'muere':{if(e.t>.55){const k=(e.t-.55)/.9;e.m.M.u.uDisuelve.value=Math.min(1,k);if(k>.02)e.m.mallas.forEach(x=>x.castShadow=false);if(rnd()<.6)brasas(e.pos,1,e.m.alto);
          if(k>=1){escena.remove(e.m.raiz);enemigos.splice(enemigos.indexOf(e),1);}}break;}
    }
    e.fase+=movido*TAU/(e.m.alto*.95);e.paso+=((movido>0?1:0)-e.paso)*Math.min(1,dt*10);
    if(e.estado!=='muere'&&(e.dentro||e.estado==='persigue'))dentroPlaza(e.pos,e.radio);}
  function morir(e){if(e.marca){quitarMarca(e.marca);e.marca=null;}cambiar(e,'muere');e.vida=0;brasas(e.pos,14,e.m.alto);if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}
    if(e.sinBotin)return;
    if(e.tipo==='can'){soltar('llavemago','dorado',e.pos.x,e.pos.z,e.pos.clone().setY(1.5));soltar(POOL[Math.floor(rnd()*POOL.length)],'dorado',e.pos.x,e.pos.z,e.pos.clone().setY(1.5));globo(e.pos);globo(e.pos);return;}
    if(rnd()<e.d.botin){const r=rnd(),ed=r<(e.tipo==='saqueador'?.12:.06)?'dorado':r<.32?'foil':'normal';soltar(POOL[Math.floor(rnd()*POOL.length)],ed,e.pos.x,e.pos.z,e.pos.clone().setY(1.2));}
    if(rnd()<e.d.globo)globo(e.pos);}

  /* ---- Oleadas ------------------------------------------------------------------------- */
  const OLEADAS=[
    {nombre:'Oleada 1 · Los goblins del camino',grupos:[['goblin',6]]},
    {nombre:'Oleada 2 · Lanzas desde las calles',grupos:[['goblin',5],['kobold',3]]},
    {nombre:'Oleada 3 · Los saqueadores',grupos:[['saqueador',3],['goblin',4],['kobold',2]]},
    {nombre:'Can, el de los Goblins',grupos:[['can',1],['goblin',4]],jefe:true},
  ];
  const ol={auto:!CAPTURA,i:-1,cola:[],espera:1.8,fin:false};
  function pasoOleadas(dt){if(!ol.auto||ol.fin||!heroe.vivo)return;
    if(ol.cola.length){ol.espera-=dt;if(ol.espera<=0){const [tipo,k]=ol.cola.shift(),a=CALLES[k%3]+(rnd()-.5)*.25,p=calle(a).multiplyScalar(R+4+rnd()*2);crearEnemigo(tipo,p.x,p.z);ol.espera=.4;}return;}
    if(enemigos.some(e=>e.estado!=='muere'))return;
    ol.espera-=dt;if(ol.espera>0)return;
    if(ol.i+1>=OLEADAS.length){ol.fin=true;banner('Tomsage resiste','Has vencido a Can, el de los Goblins. Recoge el botín: la Llave del Mago abrirá la primera Grieta.');return;}
    ol.i++;const O=OLEADAS[ol.i];let k=0;ol.cola=[];for(const [tipo,n] of O.grupos)for(let i=0;i<n;i++)ol.cola.push([tipo,k++]);
    for(let i=ol.cola.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));if(ol.cola[i][0]!=='can'&&ol.cola[j][0]!=='can')[ol.cola[i],ol.cola[j]]=[ol.cola[j],ol.cola[i]];}
    ol.espera=.6;banner(O.nombre,O.jefe?'El jefe del asedio entra en la plaza.':'Llegan por las calles.');}
  function reiniciar(){for(const e of [...enemigos]){escena.remove(e.m.raiz);}enemigos.length=0;for(const b of [...botines])quitarBotin(b);for(const g of globos)escena.remove(g.m);globos.length=0;for(const l of lanzas)escena.remove(l.g);lanzas.length=0;
    for(const o of [...marcas])if(!o.fijo)quitarMarca(o);escena.remove(heroe.m.raiz);crearHeroe();$('botin').innerHTML='';Object.assign(ol,{i:-1,cola:[],espera:1.8,fin:false});$('fin').hidden=true;finMostrado=false;}

  /* ---- Entrada: ratón, teclado y táctil -------------------------------------------------- */
  const puntero=new THREE.Vector2(),ray=new THREE.Raycaster(),planoSuelo=new THREE.Plane(new V3(0,1,0),0);
  const ent={dentro:false,pulsado:false,sobre:null,suelo:new V3(),tactil:false,palanca:null,piloto:false};
  function apuntar(cx,cy){const b=esc.getBoundingClientRect();puntero.set((cx-b.left)/b.width*2-1,-(cy-b.top)/b.height*2+1);}
  function bajo(){ray.setFromCamera(puntero,camara);const cajas=[...enemigos.filter(e=>e.estado!=='muere').map(e=>e.m.caja),...botines.filter(b=>b.listo&&!b.recogida&&!b.volando).map(b=>b.caja)];
    const hit=ray.intersectObjects(cajas,false)[0];ray.ray.intersectPlane(planoSuelo,ent.suelo);return hit?(hit.object.userData.enemigo||hit.object.userData.botin):null;}
  function pulsar(x,y,boton,shift){apuntar(x,y);camara.updateMatrixWorld();const s=bajo();ent.piloto=false;
    if(boton===2){usar('torbellino',ent.suelo.clone());return;}
    if(s&&s.d){ordenar({tipo:'atacar',e:s,repetir:true});}else if(s&&s.bono){ordenar({tipo:'recoger',b:s});}
    else if(shift)ordenar({tipo:'tajo',p:ent.suelo.clone()});else ordenar({tipo:'ir',p:ent.suelo.clone(),seguir:true});}
  lienzo.addEventListener('contextmenu',e=>e.preventDefault());
  lienzo.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){activarTactil();}lienzo.setPointerCapture?.(e.pointerId);ent.pulsado=e.button===0;ent.boton=e.button;pulsar(e.clientX,e.clientY,e.button,e.shiftKey);});
  lienzo.addEventListener('pointermove',e=>{apuntar(e.clientX,e.clientY);ent.dentro=true;});
  const soltarPuntero=()=>{ent.pulsado=false;if(heroe?.orden?.tipo==='ir')heroe.orden.seguir=false;if(heroe?.orden?.tipo==='atacar')heroe.orden.repetir=false;};
  lienzo.addEventListener('pointerup',soltarPuntero);lienzo.addEventListener('pointercancel',soltarPuntero);lienzo.addEventListener('pointerleave',()=>{ent.dentro=false;});
  // Mantener pulsado: sigue el cursor (como en Diablo). Sobre un enemigo, sigue pegándole.
  function mantener(){if(!ent.pulsado||ent.tactil||!heroe.vivo)return;const o=heroe.orden;if(o?.tipo==='ir'){o.p.copy(ent.suelo);o.seguir=true;}else if(!o&&!ent.sobre?.d)ordenar({tipo:'ir',p:ent.suelo.clone(),seguir:true});}
  addEventListener('keydown',e=>{if(e.target.closest?.('input,button')&&e.key===' ')return;const k=e.key.toLowerCase(),h={1:'torbellino',q:'torbellino',2:'salto',w:'salto',3:'provocar',e:'provocar'}[k];
    if(h){e.preventDefault();ent.piloto=false;usar(h,h==='provocar'?null:ent.suelo.clone());}});
  for(const b of document.querySelectorAll('[data-hab]'))b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();ent.piloto=false;const h=b.dataset.hab;
    if(h==='tajo'){const e2=cercano(7);if(e2)ordenar({tipo:'atacar',e:e2});else ordenar({tipo:'tajo',p:heroe.pos.clone().add(new V3(Math.sin(heroe.dir),0,Math.cos(heroe.dir)))});return;}
    const obj=ent.tactil?(h==='salto'?(cercano(9)?.pos.clone()||null):null):ent.suelo.clone();usar(h,obj);});
  const cercano=r=>enemigos.filter(e=>e.estado!=='muere'&&plano(e.pos,heroe.pos)<r).sort((a,b)=>plano(a.pos,heroe.pos)-plano(b.pos,heroe.pos))[0]||null;
  // Palanca táctil: arrastra para andar (relativo a la cámara, que mira al norte).
  function activarTactil(){if(ent.tactil)return;ent.tactil=true;esc.classList.add('tactil');}
  if(matchMedia('(pointer:coarse)').matches)activarTactil();
  {const pal=$('palanca'),bola=pal.querySelector('i');let id=null,c=null;
    pal.addEventListener('pointerdown',e=>{e.preventDefault();activarTactil();id=e.pointerId;pal.setPointerCapture?.(id);const r=pal.getBoundingClientRect();c={x:r.left+r.width/2,y:r.top+r.height/2,r:r.width/2};mover(e);ent.piloto=false;});
    const mover=e=>{if(e.pointerId!==id)return;let dx=(e.clientX-c.x)/c.r,dy=(e.clientY-c.y)/c.r;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}bola.style.transform=`translate(${dx*c.r*.55}px,${dy*c.r*.55}px)`;
      const v=new V3(dx,0,dy);ent.palanca=v;if(heroe.vivo)heroe.orden=v.length()>.15?{tipo:'mover',v}:null;};
    pal.addEventListener('pointermove',mover);
    const fin=e=>{if(e.pointerId!==id)return;id=null;ent.palanca=null;bola.style.transform='';if(heroe.orden?.tipo==='mover')heroe.orden=null;};pal.addEventListener('pointerup',fin);pal.addEventListener('pointercancel',fin);}

  /* ---- Piloto automático (Demostración) ------------------------------------------------ */
  function piloto(){const h=heroe;if(!h.vivo||!libre())return;const vivos=enemigos.filter(e=>e.estado!=='muere'&&Math.hypot(e.pos.x,e.pos.z)<R+.5);
    if(!vivos.length){const b=botines.filter(b=>b.listo&&!b.recogida&&!b.volando).sort((a,c)=>plano(a.pos,h.pos)-plano(c.pos,h.pos))[0];if(b){if(h.orden?.b!==b)ordenar({tipo:'recoger',b});}
      else{const g=globos[0];if(g&&h.alma<h.almaMax)ordenar({tipo:'ir',p:g.pos.clone()});else if(plano(h.pos,new V3())>3)ordenar({tipo:'ir',p:new V3(0,0,1)});}return;}
    const cerca=r=>vivos.filter(e=>plano(e.pos,h.pos)<r);
    if(h.alma<h.almaMax*.4&&globos.length){ordenar({tipo:'ir',p:globos[0].pos.clone()});return;}
    if(!h.cd.provocar&&cerca(9).length>=3){usar('provocar');return;}
    if(h.furia>=30&&cerca(3).length>=3){usar('torbellino',cerca(3)[0].pos.clone());return;}
    if(!h.cd.salto&&h.furia>=55){let mejor=null,n=1;for(const e of vivos){const d=plano(e.pos,h.pos);if(d<3.5||d>8)continue;const k=vivos.filter(o=>plano(o.pos,e.pos)<3).length+(e.d.lanza?1:0);if(k>n){n=k;mejor=e;}}
      if(mejor){usar('salto',mejor.pos.clone());return;}}
    const lanceros=vivos.filter(e=>e.d.lanza&&plano(e.pos,h.pos)<12),cuerpo=cerca(2.6).filter(e=>!e.d.lanza);
    const obj=(lanceros.length&&!cuerpo.length?lanceros:vivos).sort((a,b)=>plano(a.pos,h.pos)-plano(b.pos,h.pos))[0];
    if(h.orden?.e!==obj)ordenar({tipo:'atacar',e:obj,repetir:true});}

  /* ---- HUD --------------------------------------------------------------------------- */
  let tostadaHasta=0,bannerHasta=0,finMostrado=false;
  function tostada(html,mala=false){const t=$('tostada');t.innerHTML=html;t.classList.toggle('mala',mala);t.classList.add('visto');tostadaHasta=reloj.t+(mala?1.2:2.6);}
  function banner(titulo,texto){const b=$('banner');b.innerHTML=`<b>${titulo}</b><small>${texto}</small>`;b.classList.add('visto');bannerHasta=reloj.t+2.8;}
  function hud(){const h=heroe;$('orbeAlma').style.setProperty('--lleno',(h.alma/h.almaMax*100).toFixed(1)+'%');$('almaTxt').textContent=Math.ceil(h.alma)+' / '+h.almaMax;
    $('orbeFuria').style.setProperty('--lleno',h.furia.toFixed(1)+'%');$('furiaTxt').textContent=Math.floor(h.furia);
    for(const b of document.querySelectorAll('[data-hab]')){const k=b.dataset.hab,H=HAB[k];if(!H)continue;const cd=h.cd[k]||0;b.style.setProperty('--cd',(H.cd?cd/H.cd*100:0).toFixed(1)+'%');b.classList.toggle('sinFuria',h.furia<H.coste);b.classList.toggle('enCurso',{torbellino:'torbellino',salto:'salto',provocar:'grito'}[k]===h.estado);}
    const st=`<span>ATQ <b>${h.atq}</b></span><span>Alma <b>${h.almaMax}</b></span><span>Llaves <b>${h.llaves}</b></span>`+(h.escudo>0?'<span class="escudo">Provocar: −50% daño</span>':'');if(st!==hud.st){hud.st=st;$('stats').innerHTML=st;}
    const vivos=enemigos.filter(e=>e.estado!=='muere').length;$('oleada').textContent=ol.auto?(ol.fin?'Tomsage resiste':ol.i<0?'Preparando el asedio…':OLEADAS[ol.i].nombre+' · '+vivos+' en pie'):'Enemigos en pie: '+vivos;
    const o=ent.sobre?.d?ent.sobre:heroe.orden?.tipo==='atacar'?heroe.orden.e:null;$('objetivo').hidden=!o;if(o){$('objNombre').textContent=o.m.nombre+(o.d.jefe?' · Jefe':'');$('objVida').style.width=(Math.max(0,o.vida)/o.vidaMax*100).toFixed(1)+'%';}
    $('vineta').style.opacity=h.heridaT===undefined?'0':Math.max(0,.9*(1-(reloj.t-h.heridaT)/.45)).toFixed(3);
    if(tostadaHasta&&reloj.t>tostadaHasta){$('tostada').classList.remove('visto');tostadaHasta=0;}if(bannerHasta&&reloj.t>bannerHasta){$('banner').classList.remove('visto');bannerHasta=0;}
    if(!h.vivo&&h.muerteT>1.3&&!finMostrado){finMostrado=true;$('fin').hidden=false;$('finTitulo').textContent='Has caído';$('finTexto').textContent='Los goblins celebran en la plaza. Tomsage aún te necesita.';}
    if(ol.fin&&!finMostrado&&!botines.length){finMostrado=true;$('fin').hidden=false;$('finTitulo').textContent='Tomsage resiste';$('finTexto').textContent='Has recogido '+h.botin.length+' cartas. La Llave del Mago brilla: la primera Grieta del Editor espera (Hito 3).';}}
  $('reintentar').onclick=()=>{reiniciar();};

  /* ---- Cámara ------------------------------------------------------------------------ */
  const vista={dist:1,temblor:0,foco:new V3(0,0,4)};
  function temblar(f){if(!reducido)vista.temblor=Math.max(vista.temblor,f);}
  esc.addEventListener('wheel',e=>{e.preventDefault();vista.dist=Math.max(.65,Math.min(1.45,vista.dist*(e.deltaY>0?1.08:.93)));},{passive:false});
  function pasoCamara(dt){const retrato=camara.aspect<.9;vista.foco.lerp(heroe.pos,Math.min(1,dt*6));vista.temblor=Math.max(0,vista.temblor-dt*1.4);
    const D=21*vista.dist,el=.92,tr=vista.temblor,t=reloj.t;
    camara.position.set(vista.foco.x+Math.sin(t*61)*tr*.3,vista.foco.y+Math.sin(el)*D+Math.cos(t*53)*tr*.25,vista.foco.z+Math.cos(el)*D);camara.lookAt(vista.foco.x,vista.foco.y+.8,vista.foco.z);
    luna.position.set(heroe.pos.x-10,24,heroe.pos.z-8);luna.target.position.copy(heroe.pos);luzHeroe.position.set(heroe.pos.x,5.5+(heroe.alto||0),heroe.pos.z+2.2);}

  /* ---- Cada fotograma ------------------------------------------------------------------ */
  let listo=false,simple=false,revisados=0,cuadros=0;const poses={};
  function paso(dt){
    if(paron>0){paron-=dt;dt*=.08;}
    reloj.t+=dt;tiempo.value=reloj.t;F.tiempo.value=reloj.t;
    if(ent.piloto)piloto();mantener();
    camara.updateMatrixWorld();if(ent.dentro){const s=bajo();ent.sobre=s;for(const b of botines)b.mirada+=(((s===b)?1:0)-b.mirada)*Math.min(1,dt*20);}
    pasoHeroe(dt);for(const e of [...enemigos])pasoEnemigo(e,dt);separar();pasoOleadas(dt);pasoLanzas(dt);pasoGlobos(dt);pasoBotin(dt);pasoMarcas();ambiente(dt);pasoParticulas(dt);
    // Poses y posiciones de los modelos.
    const h=heroe,hm=h.m;hm.raiz.position.set(h.pos.x,h.alto||0,h.pos.z);
    if(h.estado==='torbellino'){h.giro+=dt*17;hm.raiz.rotation.y=h.dir+h.giro;}else{h.giro=0;hm.raiz.rotation.y=h.dir;}
    const ph=poses.heroe||{quieto:['quieto'],andar:['andar'],golpe:['golpe',h.t/GOLPE],torbellino:['torbellino'],salto:['salto',h.t/.72],grito:['grito',h.t/.7],muerta:['muerte',Math.min(1,h.t/1)]}[h.estado];
    MOD.posar(hm,{anim:h.paso>.05&&h.estado==='andar'?'andar':ph[0],k:ph[1],t:reloj.t,fase:h.fase,paso:h.paso});
    if(h.dolor<1&&['quieto','andar'].includes(h.estado)){hm.H.torso.rotation.x-=.25*(1-h.dolor);}
    hm.M.u.uDestello.value=h.destello*.8;hm.M.u.uColorD.value.setRGB(1,.25,.2);
    for(const e of enemigos){const m=e.m;m.raiz.position.set(e.pos.x,0,e.pos.z);m.raiz.rotation.y=e.dir;const d=e.d;
      const pe={quieto:['quieto'],entra:['andar'],persigue:[e.paso>.05?'andar':'quieto'],aviso:[d.lanza?'apunta':'aviso',e.t/d.aviso],avisoArea:['aviso',Math.min(1,e.t/1.15)],golpe:[d.lanza?'lanzar':'golpe',d.lanza?e.t/d.golpe*.6:.38+.24*(e.t/d.golpe)],
        recupera:[d.lanza?'lanzar':'golpe',d.lanza?.6+.4*Math.min(1,e.t/d.recupera):.62+.38*Math.min(1,e.t/d.recupera)],dolor:['dolor',e.t/.28],aturdido:['aturdido'],grito:['grito',e.t/.9],muere:['muerte',Math.min(1,e.t/.6)]}[e.estado];
      MOD.posar(m,{anim:pe[0],k:pe[1],t:reloj.t+e.id,fase:e.fase,paso:e.paso});
      m.M.u.uDestello.value=e.destello*.9;m.M.u.uColorD.value.setRGB(1,1,1);
      if(e.estado==='aturdido'){if(!e.estrellas){e.estrellas=new THREE.Group();for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.OctahedronGeometry(.07),matEstrella);s.position.set(Math.cos(i*TAU/3)*.3,0,Math.sin(i*TAU/3)*.3);e.estrellas.add(s);}escena.add(e.estrellas);}
        e.estrellas.position.set(e.pos.x,m.alto+.25,e.pos.z);e.estrellas.rotation.y=reloj.t*5;}
      else if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}}
    const sel=ent.sobre?.d?ent.sobre:h.orden?.tipo==='atacar'?h.orden.e:null;seleccion.m.visible=!!sel&&sel.estado!=='muere';if(sel){seleccion.m.position.set(sel.pos.x,.045,sel.pos.z);seleccion.m.scale.setScalar(sel.radio*1.8);}
    // Aura de Provocar y la luz del héroe (dorada mientras dura).
    aura.visible=h.escudo>0;aura.position.set(h.pos.x,(h.alto||0)+1,h.pos.z);aura.material.uniforms.uA.value=Math.min(1,h.escudo)*.9;
    estela.visible=h.estado==='torbellino';estela.position.set(h.pos.x,1.05,h.pos.z);estela.rotation.y=-h.giro;
    luzHeroe.color.setHex(h.escudo>0?0xffc870:0xffd2a0);luzHeroe.intensity=h.vivo?40:18;
    for(const f of fuegos)f.luz.intensity=55+Math.sin(reloj.t*11+f.x)*9+Math.sin(reloj.t*23+f.z)*6;for(const b of braseros)b.luz.intensity=24+Math.sin(reloj.t*13+b.x)*5;
    for(const n of [...numeros]){const s=reloj.t-n.t0;n.e.pos.y=n.y+s*1.4;n.e.el.style.opacity=String(Math.max(0,1-Math.max(0,s-.45)/.5));if(s>.95){quitarEtiqueta(n.e);numeros.splice(numeros.indexOf(n),1);}}
    pasoCamara(dt);camara.updateMatrixWorld();for(const e of etiquetas)colocar(e);hud();
    lienzo.style.cursor=ent.sobre?.d?'crosshair':ent.sobre?.bono?'pointer':'default';
  }
  const matEstrella=new THREE.MeshBasicMaterial({color:0xffe070,toneMapped:false});
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.25,24,16),new THREE.ShaderMaterial({uniforms:{uA:{value:0},uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vN,vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uA,uT;varying vec3 vN,vV;varying float vY;void main(){float f=pow(1.-abs(dot(vN,vV)),2.5)*(.7+.3*sin(vY*14.-uT*6.));gl_FragColor=vec4(vec3(1.,.75,.3)*1.6,f*uA);}`}));aura.visible=false;escena.add(aura);
  const estela=new THREE.Mesh(new THREE.RingGeometry(1.1,2.5,48,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP;void main(){float a=atan(vP.z,vP.x)/6.2832+.5,r=length(vP.xz);float s=pow(fract(a*2.),3.)*smoothstep(1.1,1.6,r)*(1.-smoothstep(2.1,2.5,r));gl_FragColor=vec4(vec3(1.,.85,.6)*1.8,s*.8);}`}));estela.visible=false;escena.add(estela);

  function medir(){const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,b.width),H=Math.max(1,b.height);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);camara.aspect=W/H;camara.fov=W/H<.9?44:32;camara.updateProjectionMatrix();escPuntos.value=H*dpr/900;}
  function aplicarEfectos(){renderer.shadowMap.enabled=efectos.sombras;luna.castShadow=efectos.sombras;oclusion.enabled=efectos.oclusion;resplandor.enabled=efectos.resplandor;escena.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true;});}
  for(const c of document.querySelectorAll('[data-efecto]'))c.onchange=()=>{efectos[c.dataset.efecto]=c.checked;aplicarEfectos();};
  $('demo').onclick=()=>{ent.piloto=!ent.piloto;$('demo').setAttribute('aria-pressed',String(ent.piloto));};
  $('reiniciar').onclick=()=>reiniciar();
  function negro(){const px=new Uint8Array(4),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;let s=0;for(let k=0;k<9;k++){gl.readPixels(Math.floor(W*(.2+.3*(k%3))),Math.floor(H*(.2+.3*Math.floor(k/3))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);s+=px[0]+px[1]+px[2];}return s<27;}
  function dibujar(){renderer.info.reset();if(simple)renderer.render(escena,camara);else composer.render();
    if(!CAPTURA&&revisados<3&&++cuadros>=5+revisados*20){revisados++;if(negro()){if(!simple){simple=true;aviso('El posproceso no funciona en esta tarjeta gráfica ('+gpu+'): se muestra sin él.');}else aviso('La escena sale negra en esta tarjeta gráfica ('+gpu+'). Cuéntanos qué navegador y dispositivo usas.');}}}
  let antes=performance.now(),fps={n:0,t:performance.now(),v:0};
  function cuadro(ahora){const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;paso(dt);dibujar();
    fps.n++;if(ahora-fps.t>=1000){fps.v=Math.round(fps.n*1000/(ahora-fps.t));fps.n=0;fps.t=ahora;const i=renderer.info;
      $('info').textContent=`${fps.v} fps · ${i.render.calls} llamadas · ${(i.render.triangles/1000).toFixed(0)} mil triángulos · ${hdr?'HDR':'8 bits'} · MSAA ${muestras}× · ${simple?'sin posproceso · ':''}${gpu} · three ${THREE.REVISION}`;}
    requestAnimationFrame(cuadro);}

  async function preparar(){
    const suelo=adoquines();Object.assign(matSuelo,suelo);matSuelo.needsUpdate=true;capaQuemada.material.map=quemaduras();capaQuemada.material.needsUpdate=true;
    crearHeroe();medir();new ResizeObserver(medir).observe(esc);aplicarEfectos();
    estado('Preparando las cartas del botín…');await CAOZ_CARTA_PINTOR.fuentes();const logo=await imagen('./art/logo.webp');dorso.mat=F.materialDorso(CAOZ_CARTA_PINTOR.dorso(logo));
    estado('Clic para andar y atacar; 1 Torbellino, 2 Salto, 3 Provocar (o Q, W, E). Mantén pulsado para seguir el cursor.');
    listo=true;paso(1/60);if(!CAPTURA)requestAnimationFrame(cuadro);else dibujar();
  }

  // Revisión: avanzar(s) mueve el reloj a pasos de 1/30 s (cede el turno entre pasos) y dibuja.
  const aPantalla=p=>{camara.updateMatrixWorld(true);const v=p.clone().project(camara),b=esc.getBoundingClientRect();return {x:b.left+(v.x*.5+.5)*b.width,y:b.top+(.5-v.y*.5)*b.height,dentro:Math.abs(v.x)<1&&Math.abs(v.y)<1};};
  const resumen=e=>({id:e.id,tipo:e.tipo,x:+e.pos.x.toFixed(2),z:+e.pos.z.toFixed(2),vida:e.vida,vidaMax:e.vidaMax,estado:e.estado,disuelve:+e.m.M.u.uDisuelve.value.toFixed(2)});
  window.CAOZ_ARPG_THREE_REVISION=Object.freeze({
    listo:()=>listo,
    async avanzar(s,fps=30){const n=Math.max(1,Math.round(s*fps));for(let i=0;i<n;i++){paso(1/fps);if(i%3===2)await new Promise(r=>setTimeout(r,0));}dibujar();return this.estado();},
    dibujar(){dibujar();const i=renderer.info.render;return {llamadas:i.calls,triangulos:i.triangles};},
    estado:()=>({listo,webgl2:true,hdr,muestras,simple,version:THREE.REVISION,pases:[['render',pasoRender],['oclusion',oclusion],['resplandor',resplandor],['salida',salida]].filter(([,p])=>p.enabled).map(([n])=>n),
      heroe:{x:+heroe.pos.x.toFixed(2),z:+heroe.pos.z.toFixed(2),alto:+(heroe.alto||0).toFixed(2),alma:heroe.alma,almaMax:heroe.almaMax,furia:+heroe.furia.toFixed(1),atq:heroe.atq,estado:heroe.estado,vivo:heroe.vivo,escudo:+heroe.escudo.toFixed(2),cd:{...heroe.cd},llaves:heroe.llaves,botin:heroe.botin.map(b=>b.id+'/'+b.ed),orden:heroe.orden?.tipo||null,dir:+heroe.dir.toFixed(3)},
      enemigos:enemigos.map(resumen),botines:botines.map(b=>({id:b.id,ed:b.ed,listo:b.listo,volando:b.volando,x:+b.pos.x.toFixed(2),z:+b.pos.z.toFixed(2),mirada:+b.mirada.toFixed(2),escala:b.g?+(b.g.scale.x/SB).toFixed(2):0,nombre:b.nombre?.el.textContent||''})),
      globos:globos.length,lanzas:lanzas.filter(l=>!l.clavada).length,marcas:marcas.filter(o=>!o.fijo).map(o=>o.tipo),oleada:ol.i,fin:ol.fin,finVisible:!$('fin').hidden,finTitulo:$('finTitulo').textContent,
      sobre:ent.sobre?.d?'enemigo:'+ent.sobre.id:ent.sobre?.bono?'botin:'+ent.sobre.id:null,objetivo:$('objetivo').hidden?null:$('objNombre').textContent,tactil:ent.tactil,temblor:vista.temblor,
      mallasHeroe:heroe.m.mallas.length,triangulosHeroe:heroe.m.mallas.reduce((a,m)=>a+m.geometry.attributes.position.count/3,0)}),
    oleadas(v){ol.auto=v;},
    invocar(tipo,x,z,quieto=false){return crearEnemigo(tipo,x,z,{quieto}).id;},
    matar(id){const e=enemigos.find(e=>e.id===id);if(e&&e.estado!=='muere'){e.sinBotin=true;morir(e);}},
    despertar(id){const e=enemigos.find(e=>e.id===id);if(e){e.quieto=false;e.dentro=true;cambiar(e,'persigue');}},
    async soltar(id,ed,x,z){const b=await soltar(id,ed,x,z);return {id:b.id,ed:b.ed};},
    ordenar(tipo,a,b){if(tipo==='ir')ordenar({tipo,p:new V3(a,0,b)});if(tipo==='atacar')ordenar({tipo,e:enemigos.find(e=>e.id===a),repetir:true});if(tipo===null)heroe.orden=null;},
    usar:(h,x,z)=>usar(h,x===undefined?null:new V3(x,0,z)),
    heroe(p){if('x' in p){heroe.pos.set(p.x,0,p.z);heroe.orden=null;}if('alma' in p)heroe.alma=p.alma;if('furia' in p)heroe.furia=p.furia;if('dir' in p)heroe.dir=p.dir;vista.foco.copy(heroe.pos);},
    enemigo(id,p){const e=enemigos.find(e=>e.id===id);if(!e)return;if('x' in p)e.pos.set(p.x,0,p.z);if('dir' in p)e.dir=p.dir;if('vida' in p)e.vida=p.vida;},
    piloto(v){ent.piloto=v;},
    pose(anim,k){poses.heroe=anim?[anim,k]:null;},
    camara(p){Object.assign(vista,p);},
    efecto(k,v){efectos[k]=v;const c=document.querySelector(`[data-efecto="${k}"]`);if(c)c.checked=v;aplicarEfectos();},
    reiniciar,
    pantalla:(x,y,z)=>aPantalla(new V3(x,y,z)),
    heroePantalla:(y=1)=>aPantalla(heroe.pos.clone().setY(y)),
    enemigoPantalla(id,y){const e=enemigos.find(e=>e.id===id);return e?aPantalla(e.pos.clone().setY(y??e.m.alto*.6)):null;},
    botinPantalla(i){const b=botines[i];return b?.listo?aPantalla(b.caja.position.clone()):null;},
    rectBotin(i){const b=botines[i];if(!b?.g)return null;b.g.updateMatrixWorld(true);const xs=[],ys=[],B=esc.getBoundingClientRect();for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const v=new V3(x*ANCHO/2,y*ALTO/2,0).applyMatrix4(b.g.matrixWorld).project(camara);xs.push((v.x*.5+.5)*B.width);ys.push((.5-v.y*.5)*B.height);}
      return {izquierda:Math.min(...xs),derecha:Math.max(...xs),arriba:Math.min(...ys),abajo:Math.max(...ys),ancho:B.width,alto:B.height};},
  });
  preparar().catch(e=>aviso('No se pudo preparar la plaza: '+e.message));
})();

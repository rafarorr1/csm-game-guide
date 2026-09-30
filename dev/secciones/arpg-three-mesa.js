/* Prueba de ARPG en three.js («Las Grietas del Editor», Hito 1): Adreida, la
   Guerrera Semiorca, defiende la plaza de Tomsage bajo asedio contra cuatro
   oleadas. Vista isométrica, clic para andar y atacar, como en Diablo.
     · Modelos 3D sencillos (arpg-three-modelos.js), animados por código.
     · La plaza: adoquines con relieve, las casas de Tomsage (casas-three.js,
       con su interior tras las ventanas; tres arden), un pozo, carros, barriles
       y braseros; la luna con sombras, la luz que lleva
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
  {const ocultar=oclusion._overrideVisibility.bind(oclusion);oclusion._overrideVisibility=function(){ocultar();escena.traverse(n=>{if(n.visible&&(n.material?.transparent||n.material?.userData?.sinOclusion)){n.visible=false;this._visibilityCache.push(n);}});};}
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.5,.45,1.05),salida=new OutputPass();
  // Saneado: un píxel NaN o infinito (en Metal salen de cálculos que otras tarjetas toleran) lo agranda el
  // resplandor en cuadros negros. Esta pasada los cambia por negro antes del resplandor, vengan de donde vengan.
  const saneado={enabled:true,needsSwap:true,clear:false,renderToScreen:false,setSize(){},dispose(){},
    mat:new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
        float limpio(float x){return (x>=0.&&x<=60000.)?x:(x>60000.?60000.:0.);}
        void main(){vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(limpio(c.r),limpio(c.g),limpio(c.b),limpio(c.a));}`}),
    render(r,escribir,leer){this.mat.uniforms.tDiffuse.value=leer.texture;r.setRenderTarget(this.renderToScreen?null:escribir);r.render(this.escenaQ,this.camQ);}};
  saneado.escenaQ=new THREE.Scene();saneado.escenaQ.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),saneado.mat));saneado.camQ=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  for(const p of [pasoRender,oclusion,saneado,resplandor,salida])composer.addPass(p);
  // Para la revisión: un punto que pinta NaN a propósito (comprueba que el saneado evita los cuadros negros).
  const puntoNaN=new THREE.Mesh(new THREE.PlaneGeometry(.3,.3).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uCero:{value:0}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uCero;void main(){float n=uCero/uCero;gl_FragColor=vec4(n,n,n,1.);}'}));puntoNaN.visible=false;escena.add(puntoNaN);
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
  const MAT={teja:std(0x6e2d22,{roughness:.7}),piedra:std(0x6d6760),madera:std(0x5b3d26),hierro:std(0x4a4a50,{metalness:.8,roughness:.4}),oscuro:std(0x15100c)};
  function poner(geo,mat,x,y,z,ry=0,sombra=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=sombra;m.receiveShadow=true;mundo.add(m);return m;}
  const fuegos=[];// casas que arden: llamas y su luz
  const matLlama=new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`attribute float aSem;attribute vec2 aTam;varying vec2 vUv;varying float vS;void main(){vUv=uv;vS=aSem;vec4 mv=modelViewMatrix*vec4(position,1.);mv.xy+=vec2((uv.x-.5)*aTam.x,uv.y*aTam.y);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uT;varying vec2 vUv;varying float vS;
      float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      void main(){float r=n(vec2(vUv.x*4.+vS*7.,vUv.y*3.-uT*2.6+vS*3.))*.6+n(vec2(vUv.x*9.,vUv.y*7.-uT*4.))*.4;
        float forma=(1.-vUv.y)*(1.-smoothstep(.05,.5,abs(vUv.x-.5)*(1.1+vUv.y*1.6)));float f=smoothstep(.22,.85,forma*(.55+.9*r));
        vec3 c=mix(vec3(1.,.2,.02),vec3(1.,.62,.22),f*f);gl_FragColor=vec4(c*f*1.15,f);}`});
  // Llamas: cuadros que miran siempre a la cámara (se construyen en el espacio de la vista).
  function llamas(x,y,z,ancho,alto,n){const g=new THREE.BufferGeometry(),P=[],U=[],S=[],T=[],I=[];
    for(let i=0;i<n;i++){const cx=x+(rnd()-.5)*ancho,cz=z+(rnd()-.5)*ancho*.6,w=(.5+rnd()*.5)*Math.max(.5,Math.min(1.8,ancho)),h=alto*(.7+rnd()*.6),s=rnd(),o=P.length/3;
      for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){P.push(cx,y,cz);U.push(u,v);S.push(s);T.push(w,h);}I.push(o,o+1,o+2,o,o+2,o+3);}
    g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('aSem',new THREE.Float32BufferAttribute(S,1));g.setAttribute('aTam',new THREE.Float32BufferAttribute(T,2));g.setIndex(I);
    const m=new THREE.Mesh(g,matLlama);m.frustumCulled=false;m.renderOrder=2;mundo.add(m);return m;}
  // Las casas de Tomsage (casas-three.js): entramadas, de piedra y la taberna, con su interior tras las ventanas.
  // En corro, dejando tres calles por donde entra el asedio; el frente mira a la plaza. Tres arden.
  const CASAS=window.CAOZ_CASAS.fabrica(THREE,{renderer}),barrio=[];
  function casa(tipo,x,z,ry,opc,arde){const g=CASAS.casa(tipo,opc);g.position.set(x,0,z);g.rotation.y=ry;barrio.push(g);const u=g.userData;
    if(arde){g.updateMatrixWorld(true);const cima=g.localToWorld(new V3(0,u.alto-1,0)),f=llamas(cima.x,cima.y,cima.z,u.huella[0]*.6,3,6),luz=new THREE.PointLight(0xff7a2a,60,16,1.7);
      luz.position.copy(g.localToWorld(new V3(0,u.alto-.5,u.huella[1]/2+1)));mundo.add(luz);fuegos.push({luz,x,z,alto:cima.y});}
    if(Math.hypot(x,z)<R+Math.max(...u.huella)*.7)obstaculos.push({x,z,r:Math.max(...u.huella)*.5});
    return g;}
  const CALLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6];// norte, sureste y suroeste (en el plano XZ)
  const calle=a=>new V3(Math.cos(a),0,Math.sin(a));
  {let n=0;const tipos=['entramada','piedra','entramada','taberna','entramada','piedra'];
    for(let a=0;a<TAU;a+=TAU/15){if(CALLES.some(c=>Math.abs(difAng(a,c))<.3))continue;const r=20.5+rnd()*1.5,t=tipos[n%tipos.length]==='taberna'&&n!==3?'entramada':tipos[n%tipos.length];
      casa(t,Math.cos(a)*r,Math.sin(a)*r,Math.atan2(-Math.cos(a),-Math.sin(a))+(rnd()-.5)*.15,{semilla:n+2,ancho:t==='entramada'?5.4+rnd()*1.2:undefined,tinteYeso:[1,.95+rnd()*.05,.86+rnd()*.14],tinteTeja:[.8+rnd()*.2,.8+rnd()*.15,.8+rnd()*.15]},[1,4,8].includes(n));n++;}
    for(let a=TAU/30;a<TAU;a+=TAU/11){const r=29+rnd()*3;casa(n%2?'piedra':'entramada',Math.cos(a)*r,Math.sin(a)*r,Math.atan2(-Math.cos(a),-Math.sin(a)),{semilla:n+40},false);n++;}}
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
  // Las casas se funden aparte (su módulo conserva el color por vértice y los atributos de las ventanas).
  const casasFundidas=CASAS.fundir(barrio);mundo.add(casasFundidas);
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
    fragmentShader:`varying vec4 vC;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.05,.5,d);gl_FragColor=vec4(vC.rgb,vC.a*a);}`}));
  puntos.frustumCulled=false;puntos.renderOrder=3;escena.add(puntos);
  function particula(x,y,z,vx,vy,vz,vida,tam,r,g,b,grav=0){const i=pSig;pSig=(pSig+1)%NP;pPos.set([x,y,z],i*3);pVel.set([vx,vy,vz],i*3);pVida[i]=vida;pMax[i]=vida;pTam[i]=tam;pBase.set([r,g,b,1],i*4);pGrav[i]=grav;}
  function chispas(p,n,color=[1,.7,.3],vel=6,tam=.5){for(let i=0;i<n;i++){const a=rnd()*TAU,e=rnd()*1.2-.1,v=vel*(.4+rnd()*.8);particula(p.x,p.y,p.z,Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v+1,Math.sin(a)*Math.cos(e)*v,.35+rnd()*.4,tam*(.6+rnd()*.8),color[0]*3,color[1]*3,color[2]*3,14);}}
  function polvo(p,n,radio=1){for(let i=0;i<n;i++){const a=rnd()*TAU,v=2+rnd()*4;particula(p.x+Math.cos(a)*radio*.3,.2,p.z+Math.sin(a)*radio*.3,Math.cos(a)*v,.6+rnd()*1.4,Math.sin(a)*v,.6+rnd()*.5,1.4+rnd()*1.2,.35,.28,.22,-1);}}
  function brasas(p,n,alto=1.2){for(let i=0;i<n;i++)particula(p.x+(rnd()-.5)*.8,p.y+rnd()*alto,p.z+(rnd()-.5)*.8,(rnd()-.5)*1.2,1+rnd()*2.4,(rnd()-.5)*1.2,.8+rnd()*1.1,.35+rnd()*.4,3,.9,.2,-.6);}
  function pasoParticulas(dt){for(let i=0;i<NP;i++){if(pVida[i]<=0){pCol[i*4+3]=0;continue;}pVida[i]-=dt;const j=i*3;pVel[j+1]-=pGrav[i]*dt;const fr=Math.exp(-dt*1.6);pVel[j]*=fr;pVel[j+2]*=fr;
    pPos[j]+=pVel[j]*dt;pPos[j+1]+=pVel[j+1]*dt;pPos[j+2]+=pVel[j+2]*dt;if(pPos[j+1]<.03){pPos[j+1]=.03;pVel[j+1]*=-.3;}
    const k=Math.max(0,pVida[i]/pMax[i]);pCol[i*4]=pBase[i*4];pCol[i*4+1]=pBase[i*4+1];pCol[i*4+2]=pBase[i*4+2];pCol[i*4+3]=Math.min(1,k*1.6);}
    geoP.attributes.position.needsUpdate=geoP.attributes.aColor.needsUpdate=geoP.attributes.aTam.needsUpdate=true;}
  // Adoquines arrancados por el salto: una sola malla y una reserva reutilizable.
  const MAX_ESCOMBROS=72,escombros=[],moldeEscombro=new THREE.Object3D();
  const mallaEscombros=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),std(0x79716a),MAX_ESCOMBROS);
  mallaEscombros.count=0;mallaEscombros.frustumCulled=false;mallaEscombros.castShadow=mallaEscombros.receiveShadow=true;
  mallaEscombros.instanceMatrix.setUsage(THREE.DynamicDrawUsage);escena.add(mallaEscombros);
  function romperPiso(p){for(let i=0;i<24;i++){
    const a=(i+rnd()*.7)*TAU/24,r=.45+rnd()*1.45,v=1.4+rnd()*2.5,s=.18+rnd()*.22;
    if(escombros.length===MAX_ESCOMBROS)escombros.shift();
    escombros.push({pos:new V3(p.x+Math.cos(a)*r,.09,p.z+Math.sin(a)*r),vel:new V3(Math.cos(a)*v,4+rnd()*4,Math.sin(a)*v),
      giro:new V3(rnd(),rnd()*TAU,rnd()),rot:new V3((rnd()-.5)*9,(rnd()-.5)*8,(rnd()-.5)*9),
      escala:new V3(s,.08+rnd()*.1,s*(.7+rnd()*.6)),vida:2.2+rnd()*.7,rebotes:0});}}
  function pasoEscombros(dt){let n=0;
    for(let i=escombros.length-1;i>=0;i--){const e=escombros[i];e.vida-=dt;if(e.vida<=0){escombros.splice(i,1);continue;}
      if(e.rebotes<2){e.vel.y-=18*dt;e.pos.addScaledVector(e.vel,dt);e.giro.addScaledVector(e.rot,dt);
        if(e.pos.y<=e.escala.y&&e.vel.y<0){e.pos.y=e.escala.y;e.rebotes++;e.vel.y*=-.25;e.vel.x*=.55;e.vel.z*=.55;e.rot.multiplyScalar(.45);
          if(e.rebotes===2){e.giro.x=e.giro.z=0;}}}
      const k=Math.min(1,e.vida/.55);moldeEscombro.position.copy(e.pos);moldeEscombro.position.y-=e.escala.y*(1-k);
      moldeEscombro.rotation.set(e.giro.x,e.giro.y,e.giro.z);moldeEscombro.scale.copy(e.escala).multiplyScalar(k);moldeEscombro.updateMatrix();mallaEscombros.setMatrixAt(n++,moldeEscombro.matrix);}
    mallaEscombros.count=n;mallaEscombros.instanceMatrix.needsUpdate=true;}
  // Brasas y ceniza que suben de los incendios todo el rato.
  function ambiente(dt){for(const f of fuegos)if(rnd()<dt*9)particula(f.x+(rnd()-.5)*3,f.alto+rnd(),f.z+(rnd()-.5)*3,(rnd()-.5)*1.5+.6,1.5+rnd()*2,(rnd()-.5)*1.5+.4,2.5+rnd()*2,.35+rnd()*.3,3,1,.25,-.15);
    if(rnd()<dt*14){const h=heroe?heroe.pos:new V3();particula(h.x+(rnd()-.5)*26,6+rnd()*3,h.z+(rnd()-.5)*20,.4,-.5-rnd()*.4,.2,6,.25+rnd()*.25,.35,.33,.34,0);}}
  // Marcas en el suelo: aviso en círculo que se llena, onda, anillo de selección y la línea de puntería.
  const marcas=[];
  // Las zonas de ataque se llenan (uP) hasta el golpe; al fijarse (uF) el borde se enciende.
  const matMarca=(tipo)=>new THREE.ShaderMaterial({uniforms:{uP:{value:0},uA:{value:1},uF:{value:0},uAng:{value:1},uC:{value:new THREE.Color()}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uP,uA,uF,uAng;uniform vec3 uC;varying vec2 vUv;void main(){${tipo==='linea'?
      'float b=1.-abs(vUv.x-.5)*2.,l=1.-vUv.y;float borde=smoothstep(.72,.9,1.-b)*(1.-smoothstep(.9,1.,1.-b));float a=(.14+.4*step(l,uP)+smoothstep(uP-.03,uP,l)*step(l,uP)*.7)*smoothstep(0.,.12,b)+borde*(.8+.9*uF);a*=1.-smoothstep(.85,1.,l);gl_FragColor=vec4(uC,a*uA);':
      `vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;float a=0.;
      ${tipo==='circulo'?'a=smoothstep(.9,.97,r)*(1.-smoothstep(.98,1.,r))*(1.2+uF)+step(r,uP)*.28+smoothstep(uP-.04,uP,r)*step(r,uP)*.8;':''}
      ${tipo==='cono'?'float an=r<.001?0.:abs(atan(p.x,-p.y));if(an>uAng)discard;a=(smoothstep(.9,.98,r)+smoothstep(uAng-.07,uAng,an))*(.8+.9*uF)+step(r,uP)*.26+smoothstep(uP-.05,uP,r)*step(r,uP)*.75;':''}
      ${tipo==='onda'?'a=smoothstep(uP-.2,uP,r)*(1.-smoothstep(uP,uP+.03,r))*1.5;':''}
      ${tipo==='anillo'?'a=smoothstep(.72,.84,r)*(1.-smoothstep(.9,1.,r));':''}
      gl_FragColor=vec4(uC,a*uA);`}}`});
  const geoMarca=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),geoLinea=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,.5);
  function marca(tipo,x,z,radio,color,dur,opc={}){const m=new THREE.Mesh(tipo==='linea'?new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,.5):geoMarca,matMarca(tipo));
    m.position.set(x,.04+marcas.length*.001,z);m.scale.setScalar(radio);m.material.uniforms.uC.value.set(color);m.renderOrder=1;escena.add(m);const o={m,tipo,t0:reloj.t,dur,...opc};marcas.push(o);return o;}
  function quitarMarca(o){const i=marcas.indexOf(o);if(i>=0)marcas.splice(i,1);escena.remove(o.m);o.m.material.dispose();if(o.tipo==='linea')o.m.geometry.dispose();}
  function pasoMarcas(){for(const o of [...marcas]){const k=o.dur?(reloj.t-o.t0)/o.dur:0;const u=o.m.material.uniforms;
    if(o.tipo==='onda'){u.uP.value=Math.min(1,k);u.uA.value=1-k;}else if(o.tipo==='circulo'||o.tipo==='linea'){u.uP.value=Math.min(1,k);u.uA.value=.8+.2*Math.sin(reloj.t*20);}
    if(o.fijo)continue;if(o.dur&&k>=1)quitarMarca(o);}}
  const seleccion=marca('anillo',0,0,.8,0xff4030,0,{fijo:true});seleccion.m.visible=false;
  // Etiquetas HTML (nombres del botín, números de daño) sobre posiciones del mundo.
  const capa=$('capa'),etiquetas=[],numeros=[];
  // Detrás de la cámara la proyección sale en espejo: se oculta (se mira en el espacio de la vista).
  const detras=p=>p.clone().applyMatrix4(camara.matrixWorldInverse).z>-camara.near;
  function colocar(e){const v=e.pos.clone().project(camara),b=esc.getBoundingClientRect();e.el.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*b.width}px,${(.5-v.y*.5)*b.height}px)`;e.el.hidden=detras(e.pos)||e.oculta;}
  function etiqueta(clase,pos){const el=document.createElement('div');el.className=clase;capa.appendChild(el);const e={el,pos};etiquetas.push(e);return e;}
  function quitarEtiqueta(e){e.el.remove();const i=etiquetas.indexOf(e);if(i>=0)etiquetas.splice(i,1);}
  function numero(pos,texto,clase){const e=etiqueta('apNumero '+clase,pos.clone().add(new V3((rnd()-.5)*.5,0,(rnd()-.5)*.3)));e.el.textContent=texto;numeros.push({e,t0:reloj.t,y:e.pos.y});}

  /* ---- Personajes ------------------------------------------------------------------ */
  // Cada enemigo tiene la forma exacta de su ataque: el cono o la línea que se dibuja en el suelo es lo que golpea.
  const DEF={
    cobrador:{vida:46,dano:15,vel:2.7,alcance:1.05,aviso:.95,golpe:.18,recupera:.9,cd:1.5,forma:'cono',radio:2,ang:.85,botin:.35,globo:.25},
    troll:{vida:1100,dano:30,vel:1.85,alcance:2.6,aviso:1.3,golpe:.3,recupera:1.5,cd:1.6,forma:'cono',radio:3.8,ang:1.1,aguante:true,jefe:true,botin:1,globo:1},
    goblin:{vida:34,dano:13,vel:2.85,alcance:1.05,aviso:.85,golpe:.18,recupera:.8,cd:1.35,forma:'cono',radio:2,ang:.85,botin:.24,globo:.18},
    kobold:{vida:26,dano:16,vel:2.65,alcance:11,aviso:1.1,golpe:.3,recupera:.8,cd:2.4,forma:'linea',largo:13,ancho:.8,botin:.3,globo:.2,lanza:true},
    saqueador:{vida:100,dano:24,vel:2.35,alcance:1.5,aviso:1,golpe:.2,recupera:1,cd:1.5,forma:'cono',radio:2.5,ang:1,aguante:true,botin:.6,globo:.4},
    can:{vida:800,dano:32,vel:2.5,alcance:2.3,aviso:1,golpe:.22,recupera:1.05,cd:1.35,forma:'cono',radio:3.3,ang:.9,aguante:true,jefe:true,botin:1,globo:1},
  };
  const HAB={torbellino:{coste:30,cd:0},salto:{coste:25,cd:5},provocar:{coste:0,cd:10},esquiva:{coste:0,cd:.55},parry:{coste:0,cd:.5}};
  // Parry (Espacio): Adreida alza el hacha 0,35 s. Si el golpe llega en las primeras 0,18 s es perfecto: no hace daño,
  // aturde al atacante (2 s; 1 s el jefe) y lo deja expuesto (tus golpes le hacen el doble). Más tarde, bloquea el 70%.
  // Un parry al aire deja medio segundo sin poder repetirlo. Por la espalda no se para, ni el golpazo de Can (se esquiva).
  const PARRY={dur:.35,perfecto:.18,perfectoLanza:.25,cd:.5,bloqueo:.3,aturde:2,aturdeJefe:1,expuesto:2};
  const hitboxMat=new THREE.MeshBasicMaterial({visible:false});
  let heroe=null,sigId=1;const enemigos=[],lanzas=[],globos=[];
  function cuerpoDe(tipo){const m=MOD.crear(tipo);const caja=new THREE.Mesh(new THREE.CylinderGeometry(m.radio*1.35,m.radio*1.35,m.alto*1.05,10).translate(0,m.alto*.52,0),hitboxMat);m.raiz.add(caja);m.caja=caja;escena.add(m.raiz);return m;}
  // Se juega con Adreida (cuerpo a cuerpo, el hacha a dos manos) o con Mohamed (a distancia, una pistola de seis balas).
  const HEROES={adreida:{nombre:'Adreida',alma:120,atq:12,retrato:'lider_adreida'},
    mohamed:{nombre:'Mohamed',alma:100,atq:9,retrato:'lider_mohamed',cargador:6,cadencia:.24,recarga:1.1,alcance:15,vel:30}};
  let tipoHeroe=q.get('heroe')==='mohamed'?'mohamed':'adreida';
  const aDistancia=()=>tipoHeroe==='mohamed';
  function crearHeroe(){const T=HEROES[tipoHeroe],m=cuerpoDe(tipoHeroe);heroe={id:0,tipo:tipoHeroe,m,pos:new V3(0,0,4),dir:Math.PI,giro:0,estado:'quieto',t:0,alma:T.alma,almaMax:T.alma,furia:0,atqBase:T.atq,atq:T.atq,
    balas:T.cargador||0,recargaT:0,cadT:0,disparoT:9,disparos:0,cd:{salto:0,provocar:0,esquiva:0,parry:0},parrys:0,bloqueos:0,parryExito:false,escudo:0,fase:0,paso:0,golpeo:false,tick:0,
    combo:0,finGolpe:-9,invul:0,vatq:1,dirEsq:new V3(),destello:0,brilloParry:0,dolor:1,vivo:true,botin:[],llaves:0,objetivoSalto:null,origenSalto:null,radio:m.radio,muerteT:0,golpeDe:null};m.caja.userData.heroe=true;}
  function crearEnemigo(tipo,x,z,opc={}){const m=cuerpoDe(tipo),d=DEF[tipo],e={id:sigId++,tipo,m,d,pos:new V3(x,0,z),dir:rumbo(new V3(x,0,z),new V3()),vida:d.vida,vidaMax:d.vida,estado:opc.quieto?'quieto':'entra',t:0,cd:.4+rnd()*.8,emp:new V3(),fase:rnd()*TAU,paso:0,
      destello:0,radio:m.radio,sector:sectorLibre(x,z),turnoHasta:0,ultimoTurno:-10,rodeo:(rnd()-.5)*1.6,provocado:0,dentro:Math.hypot(x,z)<R-.5,quieto:!!opc.quieto,ataques:0,gritó:false,ataque:null,alerta:null,aturdidoT:0,estrellas:null,culpableT:-9};
    m.caja.userData.enemigo=e;m.raiz.position.copy(e.pos);enemigos.push(e);return e;}

  /* ---- Cartas de botín (three-carta.js) -------------------------------------------- */
  const F=C.fabrica(THREE,renderer);const SB=.3,MIRA=3.2;
  const imagen=url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});
  const cacheTex=new Map(),dorso={mat:null};
  async function texturasDe(id,ed){const k=id+'/'+ed;if(!cacheTex.has(k))cacheTex.set(k,(async()=>{const a=window.ARPG_THREE_ARTE[k],img=await imagen('./'+a.url);
    const p=CAOZ_CARTA_PINTOR.texturas({id,acabado:ed,arte:{img,enc:a.enc},ancho:512});const [c,g]=lienzoDe(96,134);g.drawImage(p.color,0,0,96,134);return {tx:F.texturas(p),miniatura:c.toDataURL('image/jpeg',.85)};})());return cacheTex.get(k);}
  const EDICIONES={normal:{nombre:'Normal',mult:1,color:0xd8d0c0,haz:.12},foil:{nombre:'Foil',mult:1.5,color:0x7fd8ff,haz:.55},dorado:{nombre:'Dorado',mult:2,color:0xffc850,haz:1.1}};
  const POOL=['mazo','arco','collar','espadaluz','espadaboveda','lentesmachete','sombrero','brazosagua'];
  // Cartas que dan velocidad de ataque (por su tema: el arco, los lentes, el sombrero, la espada ligera), en % por edición.
  const VELOCIDAD={arco:12,lentesmachete:9,sombrero:8,espadaboveda:7};
  function bono(id,ed){const c=CARDS[id],k=EDICIONES[ed].mult;if(id==='llavemago')return {llave:1,texto:'Abre una Grieta del Editor'};
    let atq=Math.round((c.mod?.a||0)*1.5*k),alma=Math.round((c.mod?.h||0)*6*k);const vel=Math.round((VELOCIDAD[id]||0)*k);if(!atq&&!alma&&!vel){atq=Math.round(1*k);alma=Math.round(6*k);}
    return {atq,alma,vel,texto:[atq?'+'+atq+' ATQ':'',alma?'+'+alma+' Alma':'',vel?'+'+vel+'% vel. ataque':''].filter(Boolean).join(' · ')};}
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
    const B=b.bono;if(B.llave)heroe.llaves++;heroe.atq+=B.atq||0;heroe.vatq=Math.min(1.8,heroe.vatq+(B.vel||0)/100);heroe.almaMax+=B.alma||0;heroe.alma+=B.alma||0;heroe.botin.push({id:b.id,ed:b.ed});
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
  const geoLanza=new THREE.CylinderGeometry(.024,.024,1.2,6).rotateX(Math.PI/2),geoPunta=new THREE.ConeGeometry(.17,.38,4).rotateX(Math.PI/2).translate(0,0,.69);
  // Flechas luminosas: punta ancha, asta, plumas y una estela afilada orientadas hacia el avance.
  const matPuntaLanza=new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,1.8,.65),toneMapped:false});
  const geoPluma=new THREE.ConeGeometry(.12,.36,4).rotateX(-Math.PI/2).translate(0,0,-.48);
  const materialesHaloFlecha=[0xffa530,0xfff3c0,0xffd060].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const geoEstelaFlecha=new THREE.PlaneGeometry(.24,2.2).rotateX(Math.PI/2).translate(0,0,-1.55);
  const matEstelaFlecha=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x*=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;void main(){float centro=1.-abs(vUv.x*2.-1.);float a=pow(centro,1.5)*vUv.y*vUv.y;gl_FragColor=vec4(vec3(2.4,1.25,.25),a*.65);}`});
  // Un halo brillante (aditivo, lo agranda el resplandor) alrededor de lo que vuela: se ve de lejos y marca el momento del parry.
  const geoHalo=new THREE.SphereGeometry(1,14,10);
  const halo=(color,r)=>{const m=new THREE.Mesh(geoHalo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.scale.setScalar(r);m.renderOrder=3;return m;};
  function lanzar(e,a){const g=new THREE.Group(),punta=new THREE.Mesh(geoPunta,matPuntaLanza),brillo=new THREE.Mesh(geoPunta,materialesHaloFlecha[0]);brillo.scale.setScalar(1.25);
    const estela=new THREE.Group();for(const giro of [0,Math.PI/2]){const cinta=new THREE.Mesh(geoEstelaFlecha,matEstelaFlecha);cinta.rotation.z=giro;estela.add(cinta);}
    g.add(new THREE.Mesh(geoLanza,matPuntaLanza),new THREE.Mesh(geoPluma,matPuntaLanza),punta,brillo,estela);const dir=frente(a.dir),p=e.pos.clone().setY(1.1);
    g.position.copy(p);g.lookAt(p.clone().add(dir));escena.add(g);lanzas.push({g,brillo,estela,dir,vel:16,t0:reloj.t,dano:a.dano,clavada:0,e,origen:e.pos.clone(),radio:a.ancho/2});}
  function pasoLanzas(dt){for(const l of [...lanzas]){if(l.clavada){l.estela.visible=false;l.brillo.visible=false;if(reloj.t-l.clavada>1.2){escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);}continue;}
    l.g.position.addScaledVector(l.dir,l.vel*dt);const p=l.g.position;
    // La silueta sigue siendo una flecha al iluminarse la ventana del parry.
    if(!l.devuelta){const v=heroe.pos.clone().sub(p).setY(0),d=v.length(),llega=v.dot(l.dir)>d*.7?Math.max(0,d-heroe.radio*.6-l.radio)/l.vel:9,ya=llega<=PARRY.perfectoLanza;
      l.brillo.material=materialesHaloFlecha[ya?1:0];l.brillo.scale.setScalar(ya?1.7:1.25+.06*Math.sin(reloj.t*24));l.ahora=ya;}
    else{l.brillo.material=materialesHaloFlecha[2];l.brillo.scale.setScalar(1.45);}
    if(l.devuelta){const e=enemigos.find(e=>e.estado!=='muere'&&plano(e.pos,p)<e.radio+.25);if(e){danar(e,l.dano*3,{empuje:2.5,crit:true});chispas(p,16,[1,.8,.35],5,.45);escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);continue;}}
    else if(heroe.vivo&&!l.pasada&&plano(p,heroe.pos)<heroe.radio*.6+l.radio&&p.y<2.2){const par=parar(p,false,PARRY.perfectoLanza);
      if(heroe.invul>0){esquivado(l.e);l.pasada=true;}
      else if(par==='perfecto'){parryPerfecto(null,p.clone());l.devuelta=true;l.dir.negate();l.vel=22;l.t0=reloj.t;l.g.lookAt(p.clone().add(l.dir));numero(p.clone().setY(2),'¡Desviada!','parry');continue;}
      else if(par==='bloqueo'){bloqueado(l.dano,l.origen,enemigos.includes(l.e)?l.e:null);escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);continue;}
      else{herir(l.dano,l.origen,enemigos.includes(l.e)?l.e:null);chispas(p,10,[1,.4,.3],4,.4);escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);continue;}}
    if(obstaculos.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r)||Math.hypot(p.x,p.z)>R+4||p.y<.1||reloj.t-l.t0>2){l.clavada=reloj.t;chispas(p,5,[.8,.7,.6],2,.3);}}}

  // Las balas de Mohamed: rápidas, doradas y con estela; no interrumpen (así no se aturde a nadie a tiros), pero dan Furia.
  // Dos propuestas de bala:
  //   · «plomo»: la bola de plomo de una pistola de chispa (esfera metálica gris) con un trazo corto al rojo detrás y chispas;
  //   · «trazadora»: una bala alargada de latón (cuerpo y ojiva) que apunta adonde va, con una estela larga y fina de luz.
  // Las dos llevan su cuerpo sólido (se ve que es una bala) y algo de luz para seguirla con la vista.
  const balas=[];let estiloBala=q.get('balas')==='trazadora'?'trazadora':'plomo';
  const matPlomo=new THREE.MeshStandardMaterial({color:0x7a7e86,metalness:.95,roughness:.28}),matLaton=new THREE.MeshStandardMaterial({color:0xd09a48,metalness:.95,roughness:.25}),matCobre=new THREE.MeshStandardMaterial({color:0xb86a3a,metalness:.9,roughness:.3});
  const matTrazo=new THREE.MeshBasicMaterial({color:0xffc070,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const matEstela=new THREE.MeshBasicMaterial({color:0xff9a40,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  // Más grandes que una bala de verdad (desde la cámara del juego una de verdad no se vería); el brillo va detrás, no encima.
  const geoPlomo=new THREE.SphereGeometry(.095,12,10),geoTrazoCorto=new THREE.ConeGeometry(.06,.75,8,1,true).rotateX(-Math.PI/2).translate(0,0,-.42);
  const geoCuerpo=new THREE.CylinderGeometry(.05,.05,.2,12).rotateX(Math.PI/2),geoOjiva=new THREE.ConeGeometry(.05,.14,12).rotateX(Math.PI/2).translate(0,0,.17),geoCulote=new THREE.CylinderGeometry(.056,.056,.03,12).rotateX(Math.PI/2).translate(0,0,-.1);
  const geoEstelaLarga=new THREE.ConeGeometry(.03,2.4,6,1,true).rotateX(-Math.PI/2).translate(0,0,-1.32);
  function mallaBala(){const g=new THREE.Group();let brillo;
    if(estiloBala==='trazadora'){brillo=halo(0xffa050,.07);brillo.position.z=-.14;g.add(new THREE.Mesh(geoCuerpo,matLaton),new THREE.Mesh(geoOjiva,matCobre),new THREE.Mesh(geoCulote,matLaton),new THREE.Mesh(geoEstelaLarga,matEstela),brillo);}
    else{brillo=halo(0xffc070,.08);brillo.position.z=-.12;g.add(new THREE.Mesh(geoPlomo,matPlomo),new THREE.Mesh(geoTrazoCorto,matTrazo),brillo);}
    g.children[0].castShadow=true;return g;}
  // La línea, la pistola y las balas comparten origen y dirección del fotograma actual.
  // El disparo se solicita al leer los controles y se emite después de actualizar la pose y la cámara.
  const disparosPendientes=[],ejeBala=new V3(0,1,0),ejeCanon=new V3(0,-1,0),planoMira=new THREE.Plane(new V3(0,1,0),-1.15);
  const geoMira=new THREE.BufferGeometry().setFromPoints([new V3(),new V3()]);
  const lineaMira=new THREE.Line(geoMira,new THREE.LineBasicMaterial({color:0xffd080,transparent:true,opacity:.7,toneMapped:false,depthWrite:false}));
  const puntoMira=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({color:0xffe0a0,toneMapped:false}));
  lineaMira.frustumCulled=false;lineaMira.visible=puntoMira.visible=false;escena.add(lineaMira,puntoMira);
  let punteria=null;
  // Primera intersección del segmento: evita saltarse un enemigo o atravesar un obstáculo entre fotogramas.
  function impactoBala(desde,dir,maximo){let distancia=maximo,enemigo=null,bloqueado=false;
    const circulo=(x,z,r)=>{const dx=desde.x-x,dz=desde.z-z,a=dir.x*dir.x+dir.z*dir.z,c=dx*dx+dz*dz-r*r;
      if(c<=0)return 0;if(a<1e-9)return Infinity;const b=dx*dir.x+dz*dir.z,d=b*b-a*c;
      if(d<0)return Infinity;const t=(-b-Math.sqrt(d))/a;return t>=0?t:Infinity;};
    // Los obstáculos ganan los empates: una bala nunca daña a través de una pared.
    for(const o of obstaculos){const t=circulo(o.x,o.z,o.r);if(t<=distancia){distancia=t;bloqueado=true;}}
    if(dir.y<0){const t=(.08-desde.y)/dir.y;if(t>=0&&t<=distancia){distancia=t;bloqueado=true;}}
    for(const e of enemigos){if(e.estado==='muere')continue;const t=circulo(e.pos.x,e.pos.z,e.radio+.18),y=desde.y+dir.y*t;
      if(t<distancia&&y>=0&&y<=e.m.alto+.18){distancia=t;enemigo=e;bloqueado=false;}}
    return {distancia,enemigo,bloqueado};}
  function objetivoDisparo(){
    if(!ent.piloto&&!ent.rev&&!ent.tactil&&(ent.dentro||ent.atacando)){
      const sobre=bajo();if(sobre?.d)return sobre.pos.clone().setY(Math.min(1.15,sobre.m.alto*.7));
      const p=new V3();if(ray.ray.intersectPlane(planoMira,p))return p;}
    const p=puntoApuntado();p.y=1.15;return p;}
  function actualizarPunteria(){const h=heroe,m=h.m;
    const visible=aDistancia()&&h.vivo&&['quieto','andar','abanico'].includes(h.estado)&&!poses.heroe;
    lineaMira.visible=puntoMira.visible=visible;punteria=null;if(!visible){disparosPendientes.length=0;return;}
    const destino=objetivoDisparo();if(plano(destino,h.pos)>.1)h.dir=rumbo(h.pos,destino);m.raiz.rotation.y=h.dir;
    // Apunta incluso sin disparar. El retroceso mueve el brazo, pero el cañón conserva su eje hacia la mira.
    const H=m.H,r=Math.max(0,1-h.disparoT*6);H.brazoD.rotation.set(-1.52-.3*r,0,.05);H.anteD.rotation.set(-.05-.25*r,0,0);
    m.raiz.updateMatrixWorld(true);const mano=H.manoD.getWorldPosition(new V3()),direccion=destino.clone().sub(mano);
    if(direccion.lengthSq()<.16)direccion.copy(frente(h.dir));direccion.normalize();
    const padre=H.manoD.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    H.manoD.quaternion.setFromUnitVectors(ejeCanon,direccion).premultiply(padre);m.raiz.updateMatrixWorld(true);
    const desde=m.M.boca.getWorldPosition(new V3()),impacto=impactoBala(desde,direccion,HEROES.mohamed.alcance),hasta=desde.clone().addScaledVector(direccion,impacto.distancia);
    punteria={desde,direccion,hasta,enemigo:impacto.enemigo?.id??null,bloqueado:impacto.bloqueado};
    const p=geoMira.attributes.position;p.setXYZ(0,desde.x,desde.y,desde.z);p.setXYZ(1,hasta.x,hasta.y,hasta.z);p.needsUpdate=true;
    puntoMira.position.copy(hasta);puntoMira.material.color.setHex(impacto.enemigo?0xff7050:0xffe0a0);
    for(const o of disparosPendientes){const dir=direccion.clone().applyAxisAngle(ejeBala,o.angulo||0),g=mallaBala();g.position.copy(desde);g.lookAt(desde.clone().add(dir));escena.add(g);
      balas.push({g,pos:desde.clone(),origen:desde.clone(),dir,vel:HEROES.mohamed.vel,dist:0,dano:o.dano,estilo:estiloBala});
      chispas(desde,5,[1,.85,.5],3,.35);particula(desde.x,desde.y,desde.z,0,0,0,.08,2.2,3,2.4,1.4,0);}
    disparosPendientes.length=0;}
  function disparar(opc={}){const h=heroe,T=HEROES.mohamed;
    if(!opc.gratis){h.balas--;h.disparos++;h.cadT=T.cadencia;h.disparoT=0;ent.pendiente=false;if(h.balas<=0)h.recargaT=T.recarga;}
    disparosPendientes.push({angulo:opc.angulo||0,dano:opc.dano??h.atq});}
  function pasoBalas(dt){for(const b of [...balas]){const paso=Math.min(b.vel*dt,Math.max(0,HEROES.mohamed.alcance-b.dist)),impacto=impactoBala(b.pos,b.dir,paso);
    b.pos.addScaledVector(b.dir,impacto.distancia);b.dist+=impacto.distancia;b.g.position.copy(b.pos);
    if(b.estilo==='plomo'){if(rnd()<.6)particula(b.pos.x,b.pos.y,b.pos.z,(rnd()-.5)*.6,.2,(rnd()-.5)*.6,.25,.3,2.8,1.6,.6,0);}else if(rnd()<.3)particula(b.pos.x,b.pos.y,b.pos.z,0,0,0,.2,.25,2.4,1.4,.6,0);
    const e=impacto.enemigo,fuera=impacto.bloqueado||b.dist>=HEROES.mohamed.alcance-1e-6;
    if(e){danar(e,b.dano,{empuje:.45,sinDolor:true});heroe.furia=Math.min(100,heroe.furia+3);chispas(b.pos,8,[1,.8,.45],4,.35);}
    if(e||fuera){if(fuera&&!e)chispas(b.pos,4,[.9,.8,.6],2,.3);escena.remove(b.g);balas.splice(balas.indexOf(b),1);}}}

  /* ---- Colisiones --------------------------------------------------------------------- */
  function dentroPlaza(p,r){for(const o of obstaculos){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),m=o.r+r;if(d<m&&d>1e-4){p.x=o.x+dx/d*m;p.z=o.z+dz/d*m;}}
    const d=Math.hypot(p.x,p.z);if(d>R-r){p.x*=(R-r)/d;p.z*=(R-r)/d;}}
  function separar(){const todos=[heroe,...enemigos.filter(e=>e.estado!=='muere')];for(let i=0;i<todos.length;i++)for(let j=i+1;j<todos.length;j++){const a=todos[i],b=todos[j];if(a===heroe&&heroe.estado==='salto')continue;
    const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz),m=a.radio+b.radio+(a===heroe?0:.55);
    if(d<m){const nx=d>1e-4?dx/d:1,nz=d>1e-4?dz/d:0,k=m-d,wa=a===heroe?.15:a.ataque?0:.5,wb=b.ataque?0:.5;
      a.pos.x-=nx*k*wa;a.pos.z-=nz*k*wa;b.pos.x+=nx*k*wb;b.pos.z+=nz*k*wb;}}
    for(const e of todos)if(e===heroe||e.dentro)dentroPlaza(e.pos,e.radio);}

  /* ---- Adreida: control a lo Hades ------------------------------------------------------
     WASD mueve; el clic izquierdo ataca hacia el cursor (combo de tres golpes si lo mantienes);
     Espacio esquiva (invulnerable un instante); clic derecho, Salto al cursor; Q Torbellino; E Provocar. */
  const VEL=5.8,DUR_ESQ=.2,VEL_ESQ=17;
  // El combo empieza lento (se ve venir cada hachazo) y se acelera con la velocidad de ataque de las cartas (heroe.vatq).
  const COMBO=[{dur:.6,imp:.3,alc:2.05,ang:1.1,mult:1,emp:1.4,anim:'tajoA'},{dur:.6,imp:.3,alc:2.05,ang:1.1,mult:1,emp:1.4,anim:'revesA'},{dur:.8,imp:.39,alc:2.7,ang:.5,mult:1.8,emp:3.8,anim:'estocadaA'}];
  const frente=a=>new V3(Math.sin(a),0,Math.cos(a));
  const libre=()=>heroe.vivo&&(['quieto','andar'].includes(heroe.estado)||heroe.estado==='golpe'&&heroe.golpeo);
  function cambiar(e,s){e.estado=s;e.t=0;}
  const cercano=r=>enemigos.filter(e=>e.estado!=='muere'&&plano(e.pos,heroe.pos)<r).sort((a,b)=>plano(a.pos,heroe.pos)-plano(b.pos,heroe.pos))[0]||null;
  // Hacia dónde apunta: el cursor; en táctil (sin cursor), el enemigo más cercano; si no, de frente.
  function puntoApuntado(){if(ctl.apunta)return ctl.apunta.clone();const e=cercano(7);return e?e.pos.clone():heroe.pos.clone().add(frente(heroe.dir).multiplyScalar(3));}
  // Lo que está a punto de golpearla: el ataque cuerpo a cuerpo que antes se resuelve (con ella dentro) o la lanza que llega antes.
  function amenaza(){const H=heroe;let mejor=null,t=1e9;
    for(const e of enemigos){const a=e.ataque;if(!a||a.forma==='linea'||!enZona(a,e,H.pos,H.radio*.6))continue;const r=a.dur-(reloj.t-a.t0);if(r<t){t=r;mejor=e.pos;}}
    for(const l of lanzas){if(l.clavada||l.devuelta)continue;const v=H.pos.clone().sub(l.g.position).setY(0),d=v.length();if(d>9||v.dot(l.dir)<d*.7)continue;const r=d/l.vel;if(r<t){t=r;mejor=l.g.position;}}
    for(const p of peligrosTroll){if(p.tipo!=='goblin'||p.devuelto||plano(H.pos,p.hasta)>p.radio+H.radio*.6)continue;const r=p.dur-p.t;if(r<t){t=r;mejor=p.desde;}}
    return mejor?{p:mejor.clone(),t}:null;}
  function usar(h,punto){if(!heroe.vivo)return false;const H=HAB[h];
    // Parry: se puede incluso a mitad de un golpe; mira sola hacia lo que viene (o hacia el cursor).
    if(h==='parry'){const E=heroe.estado;if(heroe.cd.parry>0||!['quieto','andar','golpe','parry'].includes(E)||E==='parry')return false;
      const am=amenaza(),hacia=am?am.p:punto||ctl.apunta;if(hacia&&plano(hacia,heroe.pos)>.05)heroe.dir=rumbo(heroe.pos,hacia);
      heroe.parryExito=false;cambiar(heroe,'parry');return true;}
    if(h==='esquiva'){if(['salto','grito','esquiva','muerta'].includes(heroe.estado)||heroe.cd.esquiva>0)return false;
      const v=punto?punto.clone().setY(0):ctl.mov.lengthSq()>.01?ctl.mov.clone():frente(heroe.dir);heroe.dirEsq.copy(v.normalize());heroe.dir=rumbo(new V3(),heroe.dirEsq);
      heroe.cd.esquiva=H.cd;heroe.invul=DUR_ESQ+.1;heroe.esqDesde=heroe.pos.clone();cambiar(heroe,'esquiva');return true;}
    if(!libre())return false;if(heroe.furia<H.coste){rechazo(h,'Te falta Furia');return false;}if((heroe.cd[h]||0)>0){rechazo(h,'Aún no está lista');return false;}
    heroe.furia-=H.coste;if(H.cd)heroe.cd[h]=H.cd;
    if(h==='torbellino'&&aDistancia()){const base=rumbo(heroe.pos,puntoApuntado());heroe.dir=base;for(let i=-3;i<=3;i++)disparar({angulo:i*.12,gratis:true,dano:Math.round(heroe.atq*1.2)});cambiar(heroe,'abanico');temblar(.1);}
    else if(h==='torbellino'){cambiar(heroe,'torbellino');heroe.tick=0;}
    if(h==='salto'){const p=punto?punto.clone():puntoApuntado(),d=plano(p,heroe.pos);if(d>8)p.sub(heroe.pos).multiplyScalar(8/d).add(heroe.pos);
      p.y=0;dentroPlaza(p,heroe.radio);heroe.origenSalto=heroe.pos.clone();heroe.objetivoSalto=p;heroe.dir=rumbo(heroe.pos,p);cambiar(heroe,'salto');heroe.golpeo=false;}
    if(h==='provocar'){cambiar(heroe,'grito');heroe.golpeo=false;}
    return true;}
  function rechazo(h,texto){const b=document.querySelector(`[data-hab="${h}"]`);if(b){b.classList.remove('no');void b.offsetWidth;b.classList.add('no');}tostada(texto,true);}
  // Un golpe del combo hacia donde apuntas; encadena si el anterior acaba de terminar.
  function iniciarGolpe(){const h=heroe;ent.pendiente=false;h.combo=h.estado==='golpe'||reloj.t-h.finGolpe<.3?(h.combo+1)%3:0;h.dir=rumbo(h.pos,puntoApuntado());cambiar(h,'golpe');h.golpeo=false;}
  function danar(e,dano,opc={}){if(e.estado==='muere')return;activarFaseTroll(e);heroe.ultimo=e;
    if(blindadoTroll(e)){if((e.avisoBlindaje??-9)<reloj.t){numero(e.pos.clone().setY(e.m.alto+.3),'¡Necesitas un parry!','bloqueo');e.avisoBlindaje=reloj.t+.8;}return;}const crit=opc.crit??rnd()<.12;const expuesto=e.expuestoHasta>reloj.t;dano=Math.round(dano*(crit?1.8:1)*(expuesto?2:1)*(.9+rnd()*.2));if(e.tipo==='troll'&&!e.fase2)dano=Math.min(dano,e.vida-e.vidaMax*.5);e.vida-=dano;e.destello=1;activarFaseTroll(e);
    numero(e.pos.clone().setY(e.m.alto+.3),String(dano),crit||expuesto?'critico':'dano');
    const lejos=e.pos.clone().sub(heroe.pos).setY(0).normalize();e.emp.addScaledVector(lejos,(opc.empuje??1.6)*(e.d.aguante?.35:1));
    if(e.vida<=0){morir(e);return;}
    // Los pequeños se interrumpen al recibir un golpe (se les borra el aviso); los grandes aguantan.
    if(!e.d.aguante&&['persigue','aviso','recupera'].includes(e.estado)&&!opc.sinDolor&&!expuesto){cancelarAtaque(e);cambiar(e,'dolor');}
    if(opc.aturde&&!(e.tipo==='troll'&&e.fase2)){cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=opc.aturde*(e.d.jefe?.4:1);}
    e.provocado=Math.max(e.provocado,.1);}
  function golpearEn(radio,arco,dano,opc){let n=0;const f=frente(heroe.dir);
    for(const e of enemigos){if(e.estado==='muere')continue;const d=plano(e.pos,heroe.pos);if(d>radio+e.radio)continue;
      if(arco<Math.PI){const v=e.pos.clone().sub(heroe.pos).setY(0).normalize();if(v.dot(f)<Math.cos(arco)&&d>e.radio+.3)continue;}
      danar(e,dano,opc);n++;const p=e.pos.clone().lerp(heroe.pos,.35).setY(1.1);chispas(p,opc?.chispas??10,[1,.75,.4],6,.45);}
    return n;}
  let paron=0;// el parón al golpear: congela el mundo un instante (se siente el impacto)
  // Recibir un golpe: se marca quién fue (destella y la pantalla indica de dónde vino).
  function herir(dano,desde,culpable){if(!heroe.vivo)return;dano=Math.round(dano*(heroe.escudo>0?.5:1));heroe.alma-=dano;heroe.destello=1;heroe.dolor=0;heroe.furia=Math.min(100,heroe.furia+dano*.7);
    numero(heroe.pos.clone().setY(2.3),String(dano),'recibido');temblar(.18);heroe.heridaT=reloj.t;heroe.golpeDe={desde:desde.clone(),t:reloj.t,id:culpable?.id??null};if(culpable)culpable.culpableT=reloj.t;
    if(heroe.alma<=0){heroe.alma=0;heroe.vivo=false;cambiar(heroe,'muerta');}}
  function esquivado(e){numero(heroe.pos.clone().setY(2.4),'¡Esquivado!','esquivado');heroe.furia=Math.min(100,heroe.furia+8);heroe.esquivados=(heroe.esquivados||0)+1;if(e)e.culpableT=reloj.t;}
  function pasoHeroe(dt){const h=heroe;h.t+=dt;h.brilloParry=Math.max(0,h.brilloParry-dt);for(const k in h.cd)h.cd[k]=Math.max(0,h.cd[k]-dt);h.escudo=Math.max(0,h.escudo-dt);h.invul=Math.max(0,h.invul-dt);h.destello=Math.max(0,h.destello-dt*5);h.dolor=Math.min(1,h.dolor+dt*4);
    let movido=0;const mov=ctl.mov;
    const andar=(v,vel)=>{if(v.lengthSq()<.01)return 0;const l=Math.min(1,v.length()),paso=vel*l*dt;h.pos.x+=v.x/v.length()*paso;h.pos.z+=v.z/v.length()*paso;return paso;};
    if(h.estado==='muerta'){h.muerteT+=dt;return;}
    if(aDistancia()){const T=HEROES.mohamed;h.cadT-=dt*h.vatq;h.disparoT+=dt;if(h.recargaT>0){h.recargaT-=dt*h.vatq;if(h.recargaT<=0){h.balas=T.cargador;numero(h.pos.clone().setY(2.3),'¡Cargada!','esquivado');}}}
    if(['quieto','andar'].includes(h.estado)&&aDistancia()){const apunta=ctl.atacar,obj=apunta?puntoApuntado():null;movido=andar(mov,VEL*(apunta?.7:1));
      if(obj&&plano(obj,h.pos)>.1)h.dir=rumbo(h.pos,obj);else if(movido)h.dir+=difAng(h.dir,rumbo(new V3(),mov))*Math.min(1,dt*18);
      if(apunta&&h.balas>0&&h.recargaT<=0&&h.cadT<=0)disparar();
      h.estado=movido>0?'andar':'quieto';}
    else if(h.estado==='abanico'){if(h.t>=.3)cambiar(h,'quieto');}
    else if(['quieto','andar'].includes(h.estado)){movido=andar(mov,VEL);if(movido)h.dir+=difAng(h.dir,rumbo(new V3(),mov))*Math.min(1,dt*18);
      if(ctl.atacar)iniciarGolpe();else h.estado=movido>0?'andar':'quieto';}
    else if(h.estado==='golpe'){const C=COMBO[h.combo];h.t+=dt*(h.vatq-1);// más velocidad de ataque: la animación y el impacto llegan antes
      // Un paso adelante al golpear, salvo si ya hay alguien delante.
      if(h.t<.1&&!enemigos.some(e=>e.estado!=='muere'&&plano(e.pos,h.pos)<C.alc*.6)){const f=frente(h.dir);h.pos.addScaledVector(f,(h.combo===2?9:5)*dt);}
      if(!h.golpeo&&h.t>=C.imp){h.golpeo=true;const n=golpearEn(C.alc,C.ang,h.atq*C.mult,{empuje:C.emp});if(n){h.furia=Math.min(100,h.furia+Math.min(14,n*7));paron=h.combo===2?.09:.05;temblar(h.combo===2?.14:.06);}}
      // Andar después del impacto corta el golpe (se puede salir del combo para esquivar un aviso).
      if(h.golpeo&&h.t>C.imp+.08&&mov.lengthSq()>.01&&!ctl.atacar){h.finGolpe=reloj.t;cambiar(h,'andar');}
      else if(h.t>=C.dur){h.finGolpe=reloj.t;if(ctl.atacar)iniciarGolpe();else{cambiar(h,'quieto');}}}
    else if(h.estado==='parry'){const am=amenaza();if(am&&h.t<PARRY.perfecto)h.dir+=difAng(h.dir,rumbo(h.pos,am.p))*Math.min(1,dt*20);
      if(h.t>=PARRY.dur){if(!h.parryExito)h.cd.parry=PARRY.cd;cambiar(h,'quieto');}}
    else if(h.estado==='esquiva'){if(h.t<DUR_ESQ){h.pos.addScaledVector(h.dirEsq,VEL_ESQ*dt*(1-h.t/DUR_ESQ*.4));movido=1;
        if(rnd()<.9)particula(h.pos.x+(rnd()-.5)*.5,.3+rnd()*1.4,h.pos.z+(rnd()-.5)*.5,-h.dirEsq.x*2,.2,-h.dirEsq.z*2,.3,.9,.6,.9,1.3,0);}
      else cambiar(h,'quieto');}
    else if(h.estado==='torbellino'){const D=1.35;movido=andar(mov,4);if(movido)h.dir=rumbo(new V3(),mov);
      h.tick-=dt;if(h.tick<=0){h.tick=.2;const n=golpearEn(2.55,Math.PI,h.atq*.5,{empuje:1.1,crit:false,chispas:6});if(n)h.furia=Math.min(100,h.furia+n*1.5);}
      if(rnd()<.8){const a=rnd()*TAU;particula(h.pos.x+Math.cos(a)*2,1+rnd()*.3,h.pos.z+Math.sin(a)*2,-Math.sin(a)*6,.3,Math.cos(a)*6,.25,.5,2.2,1.6,1.2,0);}
      if(h.t>=D)cambiar(h,'quieto');}
    else if(h.estado==='salto'){const D=.72,k=Math.min(1,h.t/D),m=tramo(k,.12,.86);h.pos.lerpVectors(h.origenSalto,h.objetivoSalto,m);h.alto=Math.sin(Math.PI*m)*2.4;h.invul=Math.max(h.invul,k<.86?.05:0);
      // Mohamed cae del backflip: los que lo han visto (a 6 m y mirando hacia él) se quedan impresionados, aturdidos unos segundos.
      // Adreida, en cambio, clava el hacha.
      if(!h.golpeo&&k>=.86&&aDistancia()){h.golpeo=true;h.alto=0;marca('onda',h.pos.x,h.pos.z,6,0xffd070,.5);polvo(h.pos,16,1);chispas(h.pos.clone().setY(1.6),24,[1,.9,.5],4,.45);temblar(.12);
        for(const e of enemigos){if(e.estado==='muere'||e.tipo==='troll'&&e.fase2)continue;const v=h.pos.clone().sub(e.pos).setY(0),d=v.length();if(d>6)continue;
          if(d>.8&&v.normalize().dot(frente(e.dir))<Math.cos(1.9))continue;
          cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=e.d.jefe?1.2:2.6;e.impresionado=true;numero(e.pos.clone().setY(e.m.alto+.5),'¡Impresionado!','impresionado',1.3);}}
      if(!h.golpeo&&k>=.86){h.golpeo=true;h.alto=0;golpearEn(3.2,Math.PI,h.atq*1.7,{empuje:4.5,aturde:1.1,chispas:14});marca('onda',h.pos.x,h.pos.z,4.2,0xffb050,.5);polvo(h.pos,40,2);romperPiso(h.pos);chispas(h.pos.clone().setY(.3),30,[1,.7,.35],8,.5);temblar(.5);paron=.08;}
      if(h.t>=D){cambiar(h,'quieto');h.alto=0;}}
    else if(h.estado==='grito'){if(!h.golpeo&&h.t>=.18){h.golpeo=true;h.escudo=4;h.furia=Math.min(100,h.furia+35);marca('onda',h.pos.x,h.pos.z,10,0xffd070,.7);chispas(h.pos.clone().setY(1.4),40,[1,.85,.4],7,.5);temblar(.2);
        for(const e of enemigos){if(e.estado==='muere')continue;const d=plano(e.pos,h.pos);if(d<10){e.provocado=3.5;e.tirón={p:e.pos.clone().lerp(h.pos,Math.min(.5,1.6/Math.max(d,.1))),hasta:reloj.t+.35};if(e.estado==='entra')e.dentro=true;}}}
      if(h.t>=.7)cambiar(h,'quieto');}
    // El botín se recoge al pasar por encima.
    for(const b of botines)if(b.listo&&!b.volando&&!b.recogida&&plano(b.pos,h.pos)<1.1)recoger(b);
    h.fase+=movido*TAU/(aDistancia()?1.75:2.1);h.paso+=((movido>0&&h.estado!=='esquiva'?(aDistancia()?1:Math.min(1,mov.length())):0)-h.paso)*(1-Math.exp(-dt*10));dentroPlaza(h.pos,h.radio);}

  /* ---- Ataques enemigos: la zona exacta en el suelo, que se llena hasta el golpe ---------- */
  // Mientras se llena, el atacante gira hacia ti; en el último tramo se fija (la marca se enciende): es el momento de apartarse o esquivar.
  function matZona(forma){const m=matMarca(forma);m.blending=THREE.NormalBlending;return m;}
  function empezarAtaque(e,forma,o){const a={forma,dur:o.dur,t0:reloj.t,dir:e.dir,radio:o.radio,ang:o.ang,largo:o.largo,ancho:o.ancho,centro:o.centro||null,fija:o.fija??.6,dano:o.dano,fijado:false};
    const m=new THREE.Mesh(forma==='linea'?geoLinea:geoMarca,matZona(forma));m.renderOrder=1;m.material.uniforms.uC.value.set(0xff6a20);if(forma==='cono')m.material.uniforms.uAng.value=a.ang;escena.add(m);a.m=m;
    e.mazazo=e.tipo==='troll'&&forma==='circulo';e.ataque=a;if(!e.alerta){e.alerta=etiqueta('apAlerta',new V3());}e.alerta.el.textContent=forma==='circulo'?'¡Imparable!':'!';e.alerta.el.classList.toggle('imparable',forma==='circulo');colocarAtaque(e);return a;}
  function colocarAtaque(e){const a=e.ataque,m=a.m,k=Math.min(1,(reloj.t-a.t0)/a.dur),u=m.material.uniforms;
    if(a.forma==='circulo'){m.position.set(a.centro.x,.05,a.centro.z);m.scale.setScalar(a.radio);}
    else{m.position.set(e.pos.x,.05,e.pos.z);m.rotation.y=a.dir;if(a.forma==='cono')m.scale.setScalar(a.radio);else m.scale.set(a.ancho,1,a.largo);}
    u.uP.value=k;u.uF.value=a.fijado?1:0;if(a.forma==='circulo')u.uC.value.setRGB(a.fijado?.85:.6,.15,a.fijado?1:.85);else u.uC.value.setRGB(a.fijado?1:.95,a.fijado?.06:.22,a.fijado?.03:.05);u.uA.value=(a.fijado?.95:.7)+.05*Math.sin(reloj.t*(a.fijado?38:14));
    e.alerta.pos.set(e.pos.x,e.m.alto+.55,e.pos.z);e.alerta.el.classList.toggle('fijado',a.fijado);e.alerta.el.style.setProperty('--k',k.toFixed(2));}
  function cancelarAtaque(e){if(e.goblinSujeto){liberarModeloTroll(e.goblinSujeto);e.goblinSujeto=null;}if(e.ataque){escena.remove(e.ataque.m);e.ataque.m.material.dispose();e.ataque=null;}if(e.alerta){quitarEtiqueta(e.alerta);e.alerta=null;}}
  // ¿Está p dentro de la zona del ataque? (margen: el cuerpo de Adreida)
  function enZona(a,e,p,margen){const o=a.centro||e.pos,dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);
    if(a.forma==='circulo')return d<a.radio+margen;
    const fx=Math.sin(a.dir),fz=Math.cos(a.dir);
    if(a.forma==='cono'){if(d>a.radio+margen)return false;if(d<e.radio+margen)return true;return Math.acos(Math.max(-1,Math.min(1,(dx*fx+dz*fz)/d)))<a.ang+Math.asin(Math.min(1,margen/d));}
    const largo=dx*fx+dz*fz,lado=Math.abs(-dx*fz+dz*fx);return largo>-margen&&largo<a.largo&&lado<a.ancho/2+margen;}
  // ¿Lo para? Tiene que estar en parry, de cara (±60°) y no ser un imparable.
  function parar(desde,imparable,ventana=PARRY.perfecto){const H=heroe;if(H.estado!=='parry'||imparable)return null;const v=desde.clone().sub(H.pos).setY(0);
    if(v.lengthSq()>1e-6&&v.normalize().dot(frente(H.dir))<Math.cos(1.05))return null;return H.t<=ventana?'perfecto':'bloqueo';}
  function parryPerfecto(e,p){const H=heroe;H.parryExito=true;H.brilloParry=.3;H.parrys++;H.cd.parry=0;H.furia=Math.min(100,H.furia+20);cambiar(H,'quieto');
    numero(H.pos.clone().setY(2.5),'¡Parry!','parry');chispas(p,34,[1,.85,.35],7,.55);marca('onda',H.pos.x,H.pos.z,2.6,0xffd060,.35);paron=.16;temblar(.2);
    aturdirPorParry(e);}
  function aturdirPorParry(e){if(e&&e.estado!=='muere'){cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=e.tipo==='troll'?2.5:e.d.jefe?PARRY.aturdeJefe:PARRY.aturde;if(e.tipo==='troll')e.parryHasta=reloj.t+e.aturdidoT;e.expuestoHasta=reloj.t+e.aturdidoT+.3;e.emp.addScaledVector(e.pos.clone().sub(heroe.pos).setY(0).normalize(),2.2);e.culpableT=-9;}}
  function bloqueado(dano,desde,e){const H=heroe;H.parryExito=true;H.bloqueos++;numero(H.pos.clone().setY(2.4),'Bloqueo','bloqueo');chispas(desde.clone().lerp(H.pos,.7).setY(1.2),12,[.9,.9,1],4,.4);herir(Math.max(1,Math.round(dano*PARRY.bloqueo)),desde,e);}
  function resolverAtaque(e){const a=e.ataque,H=heroe;cambiar(e,'golpe');e.ataques++;
    if(a.forma==='linea'){if(e.tipo==='troll')arrojarGoblin(e,a);else lanzar(e,a);}
    else{const o=a.centro||e.pos;if(a.forma==='circulo'){marca('onda',o.x,o.z,a.radio+.6,0xff7040,.45);polvo(o,36,a.radio);if(e.tipo==='troll'){romperPiso(o);lanzarPiedras(e,o);}temblar(.45);}
      // Esquivar a tiempo (empezando dentro de la zona) cuenta como «¡Esquivado!» aunque la esquiva la saque.
      const dentro=enZona(a,e,H.pos,H.radio*.6),par=dentro?parar(e.pos,a.forma==='circulo'):null;
      if(H.vivo&&H.invul>0&&(dentro||H.esqDesde&&enZona(a,e,H.esqDesde,H.radio*.6)))esquivado(e);
      else if(H.vivo&&par==='perfecto'){parryPerfecto(e,e.pos.clone().lerp(H.pos,.55).setY(1.2));return;}
      else if(H.vivo&&par==='bloqueo')bloqueado(a.dano,e.pos,e);
      else if(H.vivo&&dentro)herir(a.dano,e.pos,e);}
    cancelarAtaque(e);}
  // La armadura sólo se abre durante el aturdimiento causado por un parry perfecto.
  function vulnerableTroll(e){return e.estado==='aturdido'&&e.aturdidoT>0&&e.parryHasta>reloj.t;}
  function blindadoTroll(e){return e.tipo==='troll'&&e.fase2&&!vulnerableTroll(e);}
  function activarFaseTroll(e){if(e.tipo!=='troll'||e.fase2||e.estado==='muere'||e.vida>e.vidaMax*.5)return;
    e.fase2=true;e.parryHasta=0;e.expuestoHasta=0;
    banner('El Recaudador · Segunda fase','Su armadura sólo se abre con un parry perfecto. ¡Devuélvele también sus goblins!');
    marca('onda',e.pos.x,e.pos.z,5,0x916aff,.8);}
  const peligrosTroll=[];
  const geoRocaTroll=new THREE.IcosahedronGeometry(.36,0),matRocaTroll=new THREE.MeshStandardMaterial({color:0x887566,roughness:1});
  function liberarModeloTroll(m){m.raiz.removeFromParent();const geometrías=new Set(),materiales=new Set(),esqueletos=new Set();m.raiz.traverse(o=>{if(o.skeleton)esqueletos.add(o.skeleton);if(o.geometry)geometrías.add(o.geometry);if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])materiales.add(mat);});for(const g of geometrías)g.dispose();for(const mat of materiales)mat.dispose();for(const esq of esqueletos)esq.dispose();}
  function quitarPeligroTroll(p){if(p.marca)quitarMarca(p.marca);if(p.modelo)liberarModeloTroll(p.modelo);else escena.remove(p.m);const i=peligrosTroll.indexOf(p);if(i>=0)peligrosTroll.splice(i,1);}
  function limpiarPeligrosTroll(e){for(const p of [...peligrosTroll])if(!e||p.dueno===e)quitarPeligroTroll(p);}
  function peligroTroll(e,tipo,m,desde,hasta,dur,altura,radio,dano,modelo=null){dentroPlaza(hasta,radio);hasta.y=0;
    const p={dueno:e,tipo,m,modelo,desde:desde.clone(),hasta:hasta.clone(),dur,altura,radio,dano,t:0,devuelto:false,
      marca:marca('circulo',hasta.x,hasta.z,radio,tipo==='roca'?0xff6030:0xffbd40,dur,{fijo:true})};
    m.position.copy(desde);escena.add(m);peligrosTroll.push(p);return p;}
  function lanzarPiedras(e,o){const centro=heroe.pos.clone();for(let i=0;i<5;i++){const a=i*TAU/4+rnd()*.35,r=i===0?0:2.1+rnd()*1.5;
      const destino=centro.clone().add(new V3(Math.sin(a)*r,0,Math.cos(a)*r));
      const m=new THREE.Mesh(geoRocaTroll,matRocaTroll);m.castShadow=true;m.scale.set(1+rnd()*.4,.7+rnd()*.4,1);
      peligroTroll(e,'roca',m,o.clone().setY(.2),destino,1.45+i*.12,4.5+rnd()*1.5,.85,22);}}
  // Nunca más de cuatro enemigos entre los que caminan, los sujetos y los que vuelan.
  function puedeLanzarGoblin(e){return !e.goblinSujeto&&!peligrosTroll.some(p=>p.dueno===e&&p.tipo==='goblin')&&
    enemigos.filter(o=>o.estado!=='muere').length+peligrosTroll.filter(p=>p.tipo==='goblin'&&!p.devuelto).length<4;}
  function sujetarGoblin(e){const m=MOD.crear('cobrador');MOD.posar(m,{anim:'aturdido',t:0});e.m.H.manoI.add(m.raiz);m.raiz.position.set(0,-.45,0);m.raiz.rotation.z=Math.PI;e.goblinSujeto=m;}
  function arrojarGoblin(e,a){const modelo=e.goblinSujeto;if(!modelo)return;e.m.raiz.updateMatrixWorld(true);const desde=modelo.raiz.getWorldPosition(new V3());
    e.goblinSujeto=null;modelo.raiz.removeFromParent();modelo.raiz.rotation.set(0,a.dir,0);
    const distancia=Math.min(12,Math.max(2,plano(e.pos,heroe.pos))),hasta=e.pos.clone().addScaledVector(frente(a.dir),distancia);
    peligroTroll(e,'goblin',modelo.raiz,desde,hasta,1.15,2.5,1,24,modelo);}
  function pasoPeligrosTroll(dt){for(const p of [...peligrosTroll]){if(p.dueno.estado==='muere'||!heroe.vivo){quitarPeligroTroll(p);continue;}
      if(p.devuelto)p.hasta.copy(p.dueno.pos).setY(1.8);
      p.t+=dt;const k=Math.min(1,p.t/p.dur);p.m.position.lerpVectors(p.desde,p.hasta,k);p.m.position.y+=4*p.altura*k*(1-k);
      p.m.rotation.x+=dt*(p.tipo==='roca'?4:7);p.m.rotation.z+=dt*1.5;
      if(k<1)continue;
      if(p.devuelto){aturdirPorParry(p.dueno);danar(p.dueno,45,{crit:false});quitarPeligroTroll(p);continue;}
      const dentro=plano(heroe.pos,p.hasta)<p.radio+heroe.radio*.6;
      if(dentro&&heroe.invul<=0){const par=p.tipo==='goblin'?parar(p.desde,false,PARRY.perfectoLanza):null;
        if(par==='perfecto'){parryPerfecto(null,p.hasta.clone().setY(1.2));quitarMarca(p.marca);p.marca=null;p.devuelto=true;p.desde=p.hasta.clone().setY(1.2);p.hasta=p.dueno.pos.clone().setY(1.8);p.dur=.6;p.t=0;p.altura=1;continue;}
        if(par==='bloqueo')bloqueado(p.dano,p.desde,p.dueno);else herir(p.dano,p.desde,p.dueno);}
      polvo(p.hasta,12,p.radio);marca('onda',p.hasta.x,p.hasta.z,p.radio,0xffb050,.25);
      if(p.tipo==='goblin'){const e=crearEnemigo('cobrador',p.hasta.x,p.hasta.z);e.sinBotin=true;cambiar(e,'aturdido');e.aturdidoT=1.2;}
      quitarPeligroTroll(p);}}

  // Dos plazas de acercamiento, no sólo dos permisos de atacar: los demás guardan espacio.
  // Los turnos caducan si alguien se atasca y rotan después de cada ataque.
  const RITMO={cuerpo:2,entreAtaques:.55,distanciaEspera:3.8};
  const presion={siguiente:0,primeraLinea:new Set()};
  function sectorLibre(x,z){const a=rumbo(heroe.pos,new V3(x,0,z)),ocupados=enemigos.filter(e=>e.estado!=='muere'&&!e.d.lanza).map(e=>e.sector);
    let mejor=a,nota=Infinity;for(let i=0;i<10;i++){const candidato=i*TAU/10,coste=Math.abs(difAng(a,candidato))+ocupados.filter(v=>Math.abs(difAng(v,candidato))<.3).length*10;
      if(coste<nota){nota=coste;mejor=candidato;}}return mejor;}
  function coordinarEnemigos(){const cuerpo=enemigos.filter(e=>!e.d.lanza&&e.estado!=='muere');
    const atacando=cuerpo.filter(e=>['aviso','golpe'].includes(e.estado));presion.primeraLinea=new Set(atacando.map(e=>e.id));
    const candidatos=cuerpo.filter(e=>e.estado==='persigue'&&e.cd<=0&&plano(e.pos,heroe.pos)<9);
    // Conserva al que ya entró; después, quien lleve más tiempo esperando (distancia deshace empates).
    candidatos.sort((a,b)=>(b.turnoHasta>reloj.t)-(a.turnoHasta>reloj.t)||a.ultimoTurno-b.ultimoTurno||plano(a.pos,heroe.pos)-plano(b.pos,heroe.pos));
    for(const e of candidatos){if(presion.primeraLinea.size>=RITMO.cuerpo)break;
      if(e.turnoHasta<=reloj.t){e.turnoHasta=reloj.t+3;e.ultimoTurno=reloj.t;}presion.primeraLinea.add(e.id);}}
  function pasoEnemigo(e,dt){activarFaseTroll(e);const d=e.d;e.t+=dt;e.destello=Math.max(0,e.destello-dt*9);e.provocado=Math.max(0,e.provocado-dt);e.cd-=dt;
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
        if(d.lanza){// Kobold: guarda la distancia (salvo provocado) y apunta con la línea.
          const lejos=e.pos.clone().sub(H.pos).setY(0).normalize();if(dist>8.5||e.provocado)movido=hacia(H.pos,vel);else if(dist<5)movido=hacia(e.pos.clone().addScaledVector(lejos,2),vel*.9);
          else{const lado=new V3(-lejos.z,0,lejos.x).multiplyScalar(e.rodeo>0?1:-1);movido=hacia(e.pos.clone().addScaledVector(lado,1.5),vel*.45);}
          if(e.cd<=0&&dist<d.alcance&&reloj.t>=presion.siguiente&&!enemigos.some(o=>o!==e&&o.d.lanza&&['aviso','golpe'].includes(o.estado))){presion.siguiente=reloj.t+RITMO.entreAtaques;e.dir=rumbo(e.pos,H.pos);cambiar(e,'aviso');empezarAtaque(e,'linea',{dur:d.aviso,largo:d.largo,ancho:d.ancho,fija:.65,dano:d.dano});}break;}
        // Quien no tiene turno se reparte en un anillo exterior; deja libre el cuerpo del jugador.
        const tira=e.tipo==='troll'&&e.ataques%3===2&&puedeLanzarGoblin(e);
        const entra=presion.primeraLinea.has(e.id),radio=entra?H.radio+e.radio+d.alcance*.55:RITMO.distanciaEspera+(e.id%3)*.35;
        const a=entra?rumbo(H.pos,e.pos):e.sector,obj=H.pos.clone().add(frente(a).multiplyScalar(radio));
        dentroPlaza(obj,e.radio);movido=hacia(obj,vel*(entra?1:.8));
        if(entra&&dist<(tira?9:H.radio+e.radio+d.alcance+.2)&&e.cd<=0&&reloj.t>=presion.siguiente){
          presion.siguiente=reloj.t+RITMO.entreAtaques;e.turnoHasta=0;e.ultimoTurno=reloj.t;e.dir=rumbo(e.pos,H.pos);cambiar(e,'aviso');
          e.tiraGoblin=tira;
          if(tira){sujetarGoblin(e);empezarAtaque(e,'linea',{dur:1.4,largo:12,ancho:1.4,fija:.5,dano:24});e.alerta.el.textContent='¡Goblin!';}
          else if(e.tipo==='troll'&&e.ataques%3===1)empezarAtaque(e,'circulo',{dur:1.5,radio:3.5,centro:e.pos.clone().add(frente(e.dir).multiplyScalar(1.5)),fija:0,dano:44});
          else if(e.tipo==='can'&&e.ataques%3===2)empezarAtaque(e,'circulo',{dur:1.15,radio:2.8,centro:e.pos.clone().add(frente(e.dir).multiplyScalar(1.8)),fija:0,dano:Math.round(d.dano*1.5)});
          else empezarAtaque(e,'cono',{dur:d.aviso,radio:d.radio,ang:d.ang,fija:.5,dano:d.dano});}
        break;}
      case 'aviso':{const a=e.ataque;if(!a){cambiar(e,'persigue');break;}const k=(reloj.t-a.t0)/a.dur;
        if(!a.fijado&&k<a.fija){e.dir+=difAng(e.dir,rumbo(e.pos,H.pos))*Math.min(1,dt*(d.lanza?5:3.5));a.dir=e.dir;}else a.fijado=true;
        colocarAtaque(e);if(k>=1)resolverAtaque(e);break;}
      case 'grito':if(e.t>=.9){cambiar(e,'persigue');if(ol.auto){for(let i=0;i<3;i++)ol.cola.push(['goblin',i]);}
        else{const n=Math.min(3,Math.max(0,5-enemigos.filter(o=>o.estado!=='muere').length));for(let i=0;i<n;i++){const p=calle(CALLES[i]).multiplyScalar(R+3);crearEnemigo('goblin',p.x,p.z);}}}break;
      case 'golpe':if(e.t>=d.golpe){cambiar(e,'recupera');if(e.tipo==='troll'&&e.mazazo&&!e.fase2)e.expuestoHasta=reloj.t+d.recupera;}break;
      case 'recupera':if(e.t>=d.recupera){e.cd=d.cd*(.8+rnd()*.4);cambiar(e,'persigue');}break;
      case 'dolor':if(e.t>=.28){e.cd=Math.max(e.cd,.35);cambiar(e,'persigue');}break;
      case 'aturdido':e.aturdidoT-=dt;if(e.aturdidoT<=0){cambiar(e,'persigue');}break;
      case 'muere':{if(e.t>.55){const k=(e.t-.55)/.9;e.m.M.u.uDisuelve.value=Math.min(1,k);if(k>.02)e.m.mallas.forEach(x=>x.castShadow=false);if(rnd()<.6)brasas(e.pos,1,e.m.alto);
          if(k>=1){escena.remove(e.m.raiz);enemigos.splice(enemigos.indexOf(e),1);}}break;}
    }
    e.fase+=movido*TAU/(e.m.alto*.95);e.paso+=((movido>0?1:0)-e.paso)*Math.min(1,dt*10);
    if(e.estado!=='muere'&&(e.dentro||e.estado==='persigue'))dentroPlaza(e.pos,e.radio);}
  function morir(e){cancelarAtaque(e);limpiarPeligrosTroll(e);cambiar(e,'muere');e.vida=0;brasas(e.pos,14,e.m.alto);if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}
    if(e.sinBotin)return;
    if(e.tipo==='troll'){soltar(POOL[Math.floor(rnd()*POOL.length)],'dorado',e.pos.x,e.pos.z,e.pos.clone().setY(2));globo(e.pos);globo(e.pos);globo(e.pos);banner('¡Se acabó el cobro de piso!','El Recaudador ha caído. Acaba con los cobradores que queden.');return;}
    if(e.tipo==='can'){soltar('llavemago','dorado',e.pos.x,e.pos.z,e.pos.clone().setY(1.5));soltar(POOL[Math.floor(rnd()*POOL.length)],'dorado',e.pos.x,e.pos.z,e.pos.clone().setY(1.5));globo(e.pos);globo(e.pos);return;}
    if(rnd()<e.d.botin){const r=rnd(),ed=r<(e.tipo==='saqueador'?.12:.06)?'dorado':r<.32?'foil':'normal';soltar(POOL[Math.floor(rnd()*POOL.length)],ed,e.pos.x,e.pos.z,e.pos.clone().setY(1.2));}
    if(rnd()<e.d.globo)globo(e.pos);}

  /* ---- Oleadas ------------------------------------------------------------------------- */
  const OLEADAS=[
    {nombre:'Oleada 1 · Los goblins del camino',grupos:[['goblin',6]],maxVivos:4},
    {nombre:'Oleada 2 · Lanzas desde las calles',grupos:[['goblin',5],['kobold',3]],maxVivos:5},
    {nombre:'Oleada 3 · Los saqueadores',grupos:[['saqueador',3],['goblin',4],['kobold',3]],maxVivos:6},
    {nombre:'Can, el de los Goblins',grupos:[['can',1],['goblin',2],['kobold',2]],maxVivos:5,jefe:true,jefeNombre:'Can',etapa:1},
    {nombre:'Etapa 2 · Cobro de piso',grupos:[['troll',1],['cobrador',6]],maxVivos:4,jefe:true,jefeNombre:'El Recaudador',etapa:2,texto:'«Esta plaza tiene dueño. ¡Paguen el piso!» Un troll de tres metros y seis goblins vienen a cobrar.'},
  ];
  const ol={auto:!CAPTURA,i:q.get('etapa')==='2'?3:-1,cola:[],espera:1.8,lote:0,descanso:1.8,fin:false};
  function pasoOleadas(dt){if(!ol.auto||ol.fin||!heroe.vivo)return;
    const vivos=enemigos.filter(e=>e.estado!=='muere').length+peligrosTroll.filter(p=>p.tipo==='goblin'&&!p.devuelto).length+enemigos.filter(e=>e.goblinSujeto).length;
    if(ol.cola.length){const max=OLEADAS[ol.i]?.maxVivos??5;ol.descanso=null;ol.espera-=dt;
      if(ol.espera>0||vivos>=max)return;
      // Refuerzos de hasta tres: sólo entran cuando la presión baja, nunca una cola continua de diez.
      if(!ol.lote){if(vivos>Math.max(1,max-3))return;ol.lote=Math.min(3,max-vivos,ol.cola.length);}
      const [tipo,k]=ol.cola.shift(),a=CALLES[k%3]+(rnd()-.5)*.25,p=calle(a).multiplyScalar(R+3+rnd());crearEnemigo(tipo,p.x,p.z);
      ol.lote--;ol.espera=ol.lote?.75:2.4;return;}
    if(vivos){ol.descanso=null;return;}
    if(ol.descanso===null){ol.descanso=ol.i===3?8:ol.i<0?1.8:3;if(ol.i===3)banner('Etapa 1 superada','Can ha caído. Recoge el botín: los cobradores de piso se acercan.');}ol.descanso-=dt;if(ol.descanso>0)return;
    if(ol.i+1>=OLEADAS.length){ol.fin=true;banner('Tomsage es libre','Has derrotado al troll y a todos sus cobradores. Nadie vuelve a cobrar piso en esta plaza.');return;}
    ol.i++;const O=OLEADAS[ol.i];if(O.etapa===2)heroe.alma=Math.min(heroe.almaMax,heroe.alma+40);let k=0;ol.cola=[];for(const [tipo,n] of O.grupos)for(let i=0;i<n;i++)ol.cola.push([tipo,k++]);
    for(let i=ol.cola.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));if(!DEF[ol.cola[i][0]].jefe&&!DEF[ol.cola[j][0]].jefe)[ol.cola[i],ol.cola[j]]=[ol.cola[j],ol.cola[i]];}
    ol.espera=.6;ol.lote=0;ol.descanso=null;banner(O.nombre,O.texto||(O.jefe?'Can entra con su escolta.':'Llegan en grupos. Busca un hueco y contraataca.'));}
  function reiniciar(){limpiarPeligrosTroll();escombros.length=0;mallaEscombros.count=0;presion.siguiente=0;presion.primeraLinea.clear();disparosPendientes.length=0;punteria=null;lineaMira.visible=puntoMira.visible=false;for(const e of [...enemigos]){cancelarAtaque(e);escena.remove(e.m.raiz);}enemigos.length=0;for(const b of [...botines])quitarBotin(b);for(const g of globos)escena.remove(g.m);globos.length=0;for(const l of lanzas)escena.remove(l.g);lanzas.length=0;for(const b of balas)escena.remove(b.g);balas.length=0;
    for(const o of [...marcas])if(!o.fijo)quitarMarca(o);escena.remove(heroe.m.raiz);crearHeroe();$('botin').innerHTML='';Object.assign(ol,{i:q.get('etapa')==='2'?3:-1,cola:[],espera:1.8,lote:0,descanso:1.8,fin:false});$('fin').hidden=true;finMostrado=false;}

  /* ---- Entrada: teclado, ratón y táctil ---------------------------------------------------
     ctl es lo que manda en cada fotograma: movimiento, si ataca y hacia dónde apunta. Lo llenan el
     teclado y el ratón, la palanca táctil, el piloto automático o la revisión. */
  const puntero=new THREE.Vector2(),ray=new THREE.Raycaster(),planoSuelo=new THREE.Plane(new V3(0,1,0),0);
  const ent={dentro:false,atacando:false,sobre:null,suelo:new V3(),tactil:false,palanca:null,piloto:false,rev:null,lectura:null,lecturaHasta:0};
  const ctl={mov:new V3(),atacar:false,apunta:null};
  const teclas=new Set(),DIRS={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
  const ACCION={Space:'parry',ShiftLeft:'esquiva',ShiftRight:'esquiva',KeyQ:'torbellino',Digit1:'torbellino',KeyR:'salto',Digit2:'salto',KeyE:'provocar',Digit3:'provocar'};
  // DualSense y otros mandos que el navegador presenta con distribución estándar.
  const mando={indice:null,botones:[],activo:false,foco:true,listo:false,dir:new V3(0,0,-1)};
  const BOTONES_MANDO={0:'esquiva',1:'salto',3:'provocar',4:'parry',5:'torbellino',6:'parry'};
  function ejeMando(x=0,z=0){const d=Math.hypot(x,z);return d<=.18?new V3():new V3(x,0,z).multiplyScalar(Math.min(1,(d-.18)/.82)/d);}
  function estadoMando(txt){const el=$('estadoMando');if(el&&el.textContent!==txt)el.textContent=txt;}
  function leerMando(){
    let lista=[];try{lista=Array.from(navigator.getGamepads?.()||[]);}catch{estadoMando('Mando no disponible en este navegador. Puedes usar teclado y ratón.');return null;}
    const g=lista.find(g=>g?.connected&&g.mapping==='standard'&&g.index===mando.indice)||lista.find(g=>g?.connected&&g.mapping==='standard');
    if(!g){mando.indice=null;mando.botones=[];mando.activo=false;mando.listo=false;estadoMando(lista.some(g=>g?.connected)?'El navegador no reconoce la distribución de este mando. Prueba otro navegador.':'PS5: conecta el DualSense por USB o Bluetooth y pulsa un botón.');return null;}
    if(mando.indice!==g.index){mando.indice=g.index;mando.botones=[];mando.listo=false;mando.activo=false;}
    estadoMando('Mando conectado · Izquierdo: mover · Derecho: apuntar · R2 / □: atacar · ×: dash · ○: salto · L1 / L2: parry · R1: especial · △: provocar');
    const botones=g.buttons.map(b=>b.pressed||b.value>.5),mov=ejeMando(g.axes[0],g.axes[1]),mira=ejeMando(g.axes[2],g.axes[3]);
    const pulsado=botones.some(Boolean),actividad=pulsado||mov.lengthSq()>0||mira.lengthSq()>0;
    // Al conectar o volver a la ventana, soltar primero evita ataques involuntarios.
    if(document.hidden||!mando.foco||!mando.listo){mando.botones=botones;mando.activo=false;mando.listo=!document.hidden&&mando.foco&&!actividad;return null;}
    const nuevos=botones.map((v,i)=>v&&!mando.botones[i]);mando.botones=botones;
    if(actividad){mando.activo=true;ent.piloto=false;ent.atacando=ent.pendiente=false;}
    if(!mando.activo){return null;}
    if(mira.lengthSq())mando.dir.copy(mira).normalize();else if(mov.lengthSq())mando.dir.copy(mov).normalize();
    const apunta=heroe.pos.clone().addScaledVector(mando.dir,7);
    ctl.mov.copy(mov);ctl.apunta=apunta;
    for(const [i,accion] of Object.entries(BOTONES_MANDO))if(nuevos[i]){
      // Adreida salta cinco metros hacia el stick izquierdo, o hacia su frente si está centrado.
      const destino=accion==='salto'&&!aDistancia()?heroe.pos.clone().addScaledVector(mov.lengthSq()?mov.clone().normalize():frente(heroe.dir),5):apunta.clone();
      usar(accion,accion==='esquiva'?(mov.lengthSq()?mov:mando.dir).clone():destino);
    }
    return {mov,apunta,atacar:!!(botones[2]||botones[7])};
  }
  addEventListener('focus',()=>{mando.foco=true;});
  addEventListener('blur',()=>{mando.foco=false;mando.listo=false;mando.activo=false;});
  addEventListener('keydown',()=>{mando.activo=false;});
  esc.addEventListener('pointerdown',()=>{mando.activo=false;});
  esc.addEventListener('pointermove',()=>{mando.activo=false;});
  function movTeclado(){const v=new V3();for(const k of teclas){const d=DIRS[k];if(d){v.x+=d[0];v.z+=d[1];}}return v.lengthSq()?v.normalize():v;}
  function apuntar(cx,cy){const b=esc.getBoundingClientRect();puntero.set((cx-b.left)/b.width*2-1,-(cy-b.top)/b.height*2+1);}
  function bajo(){ray.setFromCamera(puntero,camara);const cajas=[...enemigos.filter(e=>e.estado!=='muere').map(e=>e.m.caja),...botines.filter(b=>b.listo&&!b.recogida&&!b.volando).map(b=>b.caja)];
    const hit=ray.intersectObjects(cajas,false)[0];ray.ray.intersectPlane(planoSuelo,ent.suelo);return hit?(hit.object.userData.enemigo||hit.object.userData.botin):null;}
  lienzo.addEventListener('contextmenu',e=>e.preventDefault());
  lienzo.addEventListener('pointerdown',e=>{apuntar(e.clientX,e.clientY);camara.updateMatrixWorld();const s=bajo();
    if(e.pointerType==='touch'){activarTactil();if(s?.bono){ent.lectura=s;ent.lecturaHasta=reloj.t+2.5;}return;}// en táctil, tocar una carta la lee; se recoge pasando por encima
    ent.piloto=false;ent.dentro=true;lienzo.setPointerCapture?.(e.pointerId);
    if(e.button===2)usar('salto',ent.suelo.clone());else if(e.button===0)ent.atacando=ent.pendiente=true;});
  lienzo.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;apuntar(e.clientX,e.clientY);ent.dentro=true;});
  const soltarPuntero=e=>{if(e.button===0||e.type==='pointercancel')ent.atacando=false;};
  lienzo.addEventListener('pointerup',soltarPuntero);lienzo.addEventListener('pointercancel',soltarPuntero);lienzo.addEventListener('pointerleave',()=>{ent.dentro=false;});
  addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,select'))return;const k=e.code;
    if(DIRS[k]){e.preventDefault();teclas.add(k);ent.piloto=false;return;}
    const h=ACCION[k];if(h){e.preventDefault();if(e.repeat)return;ent.piloto=false;usar(h,h==='salto'?puntoApuntado():null);}});
  addEventListener('keyup',e=>{teclas.delete(e.code);});addEventListener('blur',()=>{teclas.clear();ent.atacando=false;});
  // Botones del HUD (y de táctil): Atacar se mantiene pulsado; los demás lanzan su habilidad.
  for(const b of document.querySelectorAll('[data-hab]')){const h=b.dataset.hab;
    b.addEventListener('pointerdown',e=>{mando.activo=false;e.preventDefault();e.stopPropagation();ent.piloto=false;if(e.pointerType==='touch')activarTactil();if(h==='tajo'){ent.atacando=ent.pendiente=true;b.setPointerCapture?.(e.pointerId);return;}usar(h,h==='salto'?puntoApuntado():null);});
    if(h==='tajo')for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>{ent.atacando=false;});}
  // Palanca táctil: arrastra para andar (la cámara mira al norte: arriba es el fondo de la plaza).
  function activarTactil(){if(ent.tactil)return;ent.tactil=true;esc.classList.add('tactil');}
  if(matchMedia('(pointer:coarse)').matches)activarTactil();
  {const pal=$('palanca'),bola=pal.querySelector('i');let id=null,c=null;
    pal.addEventListener('pointerdown',e=>{e.preventDefault();activarTactil();id=e.pointerId;pal.setPointerCapture?.(id);const r=pal.getBoundingClientRect();c={x:r.left+r.width/2,y:r.top+r.height/2,r:r.width/2};mover(e);ent.piloto=false;});
    const mover=e=>{if(e.pointerId!==id)return;let dx=(e.clientX-c.x)/c.r,dy=(e.clientY-c.y)/c.r;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}bola.style.transform=`translate(${dx*c.r*.55}px,${dy*c.r*.55}px)`;
      ent.palanca=Math.hypot(dx,dy)>.15?new V3(dx,0,dy):null;};
    pal.addEventListener('pointermove',mover);
    const fin=e=>{if(e.pointerId!==id)return;id=null;ent.palanca=null;bola.style.transform='';};pal.addEventListener('pointerup',fin);pal.addEventListener('pointercancel',fin);}
  // Un toque o un clic corto dan siempre un golpe (ent.pendiente), aunque se suelte antes del fotograma.
  function leerControles(){
    const pad=ent.rev?null:leerMando();
    if(pad){ctl.mov.copy(pad.mov);ctl.atacar=pad.atacar;ctl.apunta=pad.apunta;return;}
    if(ent.piloto){const p=piloto();ctl.mov.copy(p.mov);ctl.atacar=p.atacar;ctl.apunta=p.apunta;return;}
    if(ent.rev){ctl.mov.copy(ent.rev.mov);ctl.atacar=ent.rev.atacar;ctl.apunta=ent.rev.apunta;return;}
    ctl.mov.copy(ent.palanca||movTeclado());ctl.atacar=ent.atacando||ent.pendiente;ctl.apunta=ent.tactil||!(ent.dentro||ent.atacando)?null:ent.sobre?.d?ent.sobre.pos.clone():ent.suelo.clone();}// con el ratón encima de un enemigo se apunta a él

  /* ---- Piloto automático (Demostración): lee los avisos igual que un jugador ----------------- */
  function escape(a,e,p){const o=a.centro||e.pos;if(a.forma==='linea'){const f=frente(a.dir),lado=new V3(-f.z,0,f.x),s=Math.sign(p.clone().sub(o).dot(lado))||1;return lado.multiplyScalar(s);}
    const v=p.clone().sub(o).setY(0);if(a.forma==='cono'){const f=frente(a.dir),l=new V3(-f.z,0,f.x);v.normalize().addScaledVector(l,Math.sign(v.dot(l))||1);}return v.lengthSq()>1e-4?v.normalize():frente(heroe.dir+Math.PI);}
  function piloto(){const h=heroe,c={mov:new V3(),atacar:false,apunta:null};if(!h.vivo)return c;
    const vivos=enemigos.filter(e=>e.estado!=='muere'&&Math.hypot(e.pos.x,e.pos.z)<R+.5);
    // 1. Peligro. Un golpe cuerpo a cuerpo solo: se queda y lo para en el último instante (parry perfecto).
    //    Si vienen varios a la vez, el golpazo imparable de Can o la línea de un kobold: sale de la zona (y hace dash si no da tiempo).
    const peligros=enemigos.filter(e=>e.ataque&&enZona(e.ataque,e,h.pos,h.radio+.45)).map(e=>({e,a:e.ataque,r:e.ataque.dur-(reloj.t-e.ataque.t0)})).sort((x,y)=>x.r-y.r);
    if(peligros.length){const p=peligros[0],juntos=peligros.filter(x=>x.a.forma!=='linea'&&x.r-p.r<.45).length;
      if(p.a.forma==='cono'&&juntos===1&&(h.cd.parry<=0||h.estado==='parry')){if(p.r<=.1&&h.estado!=='parry')usar('parry');return c;}
      const v=escape(p.a,p.e,h.pos);if(p.r<.3&&!h.cd.esquiva)usar('esquiva',v);c.mov.copy(v);return c;}
    // Las piedras no admiten parry: salir de su destino antes del impacto.
    const piedra=peligrosTroll.find(p=>p.tipo==='roca'&&plano(h.pos,p.hasta)<p.radio+h.radio+.4);
    if(piedra){const v=h.pos.clone().sub(piedra.hasta).setY(0);if(v.lengthSq()<.01)v.copy(frente(h.dir+Math.PI/2));v.normalize();if(piedra.dur-piedra.t<.3&&!h.cd.esquiva)usar('esquiva',v);c.mov.copy(v);return c;}
    // Una lanza o un goblin a punto de llegar: parry (lo devuelve).
    {const am=amenaza();if(am&&am.t<=.1&&!h.cd.parry&&h.estado!=='parry'){usar('parry');return c;}}
    if(!libre())return c;
    if(aDistancia()){const vivosD=enemigos.filter(e=>e.estado!=='muere'&&Math.hypot(e.pos.x,e.pos.z)<R+.5);if(!vivosD.length)return pilotoSinEnemigos(c);
      const exp=vivosD.filter(e=>e.expuestoHasta>reloj.t),obj=(exp.length?exp:vivosD).sort((a,b)=>plano(a.pos,h.pos)-plano(b.pos,h.pos))[0],d=plano(obj.pos,h.pos),cerca=vivosD.filter(e=>plano(e.pos,h.pos)<3).length;
      if(!h.cd.provocar&&cerca>=3){usar('provocar');return c;}
      if(h.furia>=25&&!h.cd.salto&&cerca>=2){const fuera=h.pos.clone().sub(obj.pos).setY(0).normalize().multiplyScalar(6).add(h.pos);usar('salto',fuera);return c;}
      if(h.furia>=30&&vivosD.filter(e=>plano(e.pos,h.pos)<8).length>=3){usar('torbellino');return c;}
      const lejos=h.pos.clone().sub(obj.pos).setY(0).normalize(),lado=new V3(-lejos.z,0,lejos.x);
      if(d<4.5)c.mov.copy(lejos).addScaledVector(lado,.6).normalize();else if(d>9)c.mov.copy(lejos).negate();
      if(Math.hypot(h.pos.x,h.pos.z)>R-2.5)c.mov.addScaledVector(h.pos.clone().setY(0).normalize(),-1);
      c.atacar=true;c.apunta=obj.pos.clone();return c;}
    if(!vivos.length)return pilotoSinEnemigos(c);
    function pilotoSinEnemigos(c){const b=botines.filter(b=>b.listo&&!b.recogida&&!b.volando).sort((a,d)=>plano(a.pos,h.pos)-plano(d.pos,h.pos))[0];
      const g=globos[0],meta=b?b.pos:g&&h.alma<h.almaMax?g.pos:plano(h.pos,new V3())>3?new V3(0,0,1):null;if(meta)c.mov.copy(meta).sub(h.pos).setY(0).normalize();return c;}
    const cerca=r=>vivos.filter(e=>plano(e.pos,h.pos)<r);
    if(h.alma<h.almaMax*.4&&globos.length){c.mov.copy(globos[0].pos).sub(h.pos).setY(0).normalize();return c;}
    if(!h.cd.provocar&&cerca(9).length>=3){usar('provocar');return c;}
    if(h.furia>=30&&cerca(3).length>=3){usar('torbellino');return c;}
    if(!h.cd.salto&&h.furia>=55){let mejor=null,n=1;for(const e of vivos){const d=plano(e.pos,h.pos);if(d<3.5||d>8)continue;const k=vivos.filter(o=>plano(o.pos,e.pos)<3).length+(e.d.lanza?1:0);if(k>n){n=k;mejor=e;}}
      if(mejor){usar('salto',mejor.pos.clone());return c;}}
    const lanceros=vivos.filter(e=>e.d.lanza&&plano(e.pos,h.pos)<12),cuerpo=cerca(2.6).filter(e=>!e.d.lanza);
    // Si alguno quedó aturdido por un parry, a por él (recibe el doble).
    const expuestos=vivos.filter(e=>e.expuestoHasta>reloj.t);
    const obj=(expuestos.length?expuestos:lanceros.length&&!cuerpo.length?lanceros:vivos).sort((a,b)=>plano(a.pos,h.pos)-plano(b.pos,h.pos))[0],d=plano(obj.pos,h.pos);
    if(d>1.85+obj.radio)c.mov.copy(obj.pos).sub(h.pos).setY(0).normalize();else{c.atacar=true;c.apunta=obj.pos.clone();}
    return c;}

  /* ---- HUD --------------------------------------------------------------------------- */
  let tostadaHasta=0,bannerHasta=0,finMostrado=false;
  function tostada(html,mala=false){const t=$('tostada');t.innerHTML=html;t.classList.toggle('mala',mala);t.classList.add('visto');tostadaHasta=reloj.t+(mala?1.2:2.6);}
  function banner(titulo,texto){const b=$('banner');b.innerHTML=`<b>${titulo}</b><small>${texto}</small>`;b.classList.add('visto');bannerHasta=reloj.t+2.8;}
  function hud(){const h=heroe;$('orbeAlma').style.setProperty('--lleno',(h.alma/h.almaMax*100).toFixed(1)+'%');$('almaTxt').textContent=Math.ceil(h.alma)+' / '+h.almaMax;
    $('orbeFuria').style.setProperty('--lleno',h.furia.toFixed(1)+'%');$('furiaTxt').textContent=Math.floor(h.furia);
    for(const b of document.querySelectorAll('[data-hab]')){const k=b.dataset.hab,H=HAB[k];if(!H)continue;const cd=h.cd[k]||0;b.style.setProperty('--cd',(H.cd?cd/H.cd*100:0).toFixed(1)+'%');b.classList.toggle('sinFuria',h.furia<H.coste);b.classList.toggle('enCurso',{torbellino:'torbellino',salto:'salto',provocar:'grito',esquiva:'esquiva',parry:'parry'}[k]===h.estado);}
    const st=(aDistancia()?`<span>Balas <b>${h.recargaT>0?'recargando…':h.balas+' / '+HEROES.mohamed.cargador}</b></span>`:'')+`<span>Parrys perfectos <b>${h.parrys}</b></span><span>ATQ <b>${h.atq}</b></span><span>Vel. ataque <b>${Math.round(h.vatq*100)}%</b></span><span>Alma <b>${h.almaMax}</b></span><span>Llaves <b>${h.llaves}</b></span>`+(h.escudo>0?'<span class="escudo">Provocar: −50% daño</span>':'');if(st!==hud.st){hud.st=st;$('stats').innerHTML=st;}
    const vivos=enemigos.filter(e=>e.estado!=='muere').length+peligrosTroll.filter(p=>p.tipo==='goblin'&&!p.devuelto).length+enemigos.filter(e=>e.goblinSujeto).length;$('oleada').textContent=ol.auto?(ol.fin?'Tomsage resiste':ol.i<0?'Preparando el asedio…':ol.i===3&&q.get('etapa')==='2'?'Preparando el cobro de piso…':(OLEADAS[ol.i].etapa===2?'Etapa 2 · Cobro de piso':OLEADAS[ol.i].jefe?'Etapa 1 · Can':'Etapa 1 · Oleada '+(ol.i+1))+' · '+vivos+' en pie'+(ol.cola.length?' · '+ol.cola.length+' por llegar':!vivos&&ol.i<OLEADAS.length-1?' · siguiente oleada en '+Math.ceil(ol.descanso??3)+' s':'')):'Enemigos en pie: '+vivos;
    const o=ent.sobre?.d?ent.sobre:enemigos.includes(h.ultimo)&&h.ultimo.estado!=='muere'?h.ultimo:enemigos.find(e=>e.d.jefe&&e.estado!=='muere')||null;$('objetivo').hidden=!o;if(o){$('objNombre').textContent=o.m.nombre+(o.d.jefe?' · Jefe':'')+(o.fase2?(blindadoTroll(o)?' · Fase 2: haz parry':' · Fase 2: ¡vulnerable!'):'');$('objVida').style.width=(Math.max(0,o.vida)/o.vidaMax*100).toFixed(1)+'%';}
    flechas();golpeDir();
    $('vineta').style.opacity=h.heridaT===undefined?'0':Math.max(0,.9*(1-(reloj.t-h.heridaT)/.45)).toFixed(3);
    if(tostadaHasta&&reloj.t>tostadaHasta){$('tostada').classList.remove('visto');tostadaHasta=0;}if(bannerHasta&&reloj.t>bannerHasta){$('banner').classList.remove('visto');bannerHasta=0;}
    if(!h.vivo&&h.muerteT>1.3&&!finMostrado){finMostrado=true;$('fin').hidden=false;$('finTitulo').textContent='Has caído';$('finTexto').textContent='Los goblins celebran en la plaza. Tomsage aún te necesita.';}
    if(ol.fin&&!finMostrado&&!botines.length){finMostrado=true;$('fin').hidden=false;$('finTitulo').textContent='Tomsage resiste';$('finTexto').textContent='Has liberado Tomsage de Can y de los cobradores de piso. Botín recogido: '+h.botin.length+' cartas.';}}
  // Quien te ataca desde fuera de la pantalla: una flecha en el borde que apunta hacia él (roja al fijarse).
  const flechasEl=[];
  function flechas(){const b=esc.getBoundingClientRect(),W=b.width,H=b.height;let n=0;
    for(const e of enemigos){if(!e.ataque)continue;const p=e.pos.clone().setY(1),atras=detras(p),v=p.project(camara);if(!atras&&Math.abs(v.x)<.94&&Math.abs(v.y)<.94)continue;
      let x=v.x,y=v.y;if(atras){x=-x;y=-y;}const k=1/Math.max(Math.abs(x),Math.abs(y),1e-3);x*=k;y*=k;
      const el=flechasEl[n]||(flechasEl[n]=Object.assign(document.createElement('div'),{className:'apFlecha'}));if(!el.parentNode)$('flechas').appendChild(el);
      const px=(x*.5+.5)*W,py=(.5-y*.5)*H,m=34,abajo=H-(ent.tactil?34:118);el.style.transform=`translate(${Math.min(W-m,Math.max(m,px))}px,${Math.min(abajo,Math.max(m,py))}px) rotate(${Math.atan2(-y,x)}rad)`;el.classList.toggle('fijado',e.ataque.fijado);el.hidden=false;n++;}
    for(let i=n;i<flechasEl.length;i++)flechasEl[i].hidden=true;}
  // De dónde vino el último golpe: un arco rojo en el borde de la pantalla, en esa dirección.
  function golpeDir(){const g=heroe.golpeDe,el=$('golpeDir');if(!g){el.style.opacity='0';return;}const k=(reloj.t-g.t)/.8;if(k>=1){el.style.opacity='0';return;}
    const a=heroe.pos.clone().setY(1).project(camara),b=g.desde.clone().setY(1).project(camara),r=esc.getBoundingClientRect();
    el.style.opacity=(1-k).toFixed(3);el.style.transform=`rotate(${Math.atan2(-(b.y-a.y)*r.height,(b.x-a.x)*r.width)}rad)`;}
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
    reloj.t+=dt;tiempo.value=reloj.t;F.tiempo.value=reloj.t;CASAS.uniformes.uT.value=reloj.t;
    camara.updateMatrixWorld();ent.sobre=ent.dentro&&!ent.tactil?bajo():null;if(ent.lectura&&reloj.t>ent.lecturaHasta)ent.lectura=null;
    for(const b of botines)b.mirada+=(((ent.sobre===b||ent.lectura===b)?1:0)-b.mirada)*Math.min(1,dt*20);
    leerControles();
    pasoHeroe(dt);coordinarEnemigos();for(const e of [...enemigos])pasoEnemigo(e,dt);separar();pasoOleadas(dt);pasoPeligrosTroll(dt);pasoLanzas(dt);pasoBalas(dt);pasoGlobos(dt);pasoBotin(dt);pasoMarcas();ambiente(dt);pasoParticulas(dt);pasoEscombros(dt);
    // Poses y posiciones de los modelos.
    const h=heroe,hm=h.m;hm.raiz.position.set(h.pos.x,h.alto||0,h.pos.z);
    if(h.estado==='torbellino'){h.giro+=dt*17;hm.raiz.rotation.y=h.dir+h.giro;}else{h.giro=0;hm.raiz.rotation.y=h.dir;}
    const ph=poses.heroe||{quieto:['quieto'],andar:['andar'],golpe:[COMBO[h.combo].anim,h.t/COMBO[h.combo].dur],esquiva:['esquiva',h.t/DUR_ESQ],torbellino:['torbellino'],salto:[aDistancia()?'acrobacia':'salto',h.t/.72],abanico:['disparar',h.t/.3],grito:['grito',h.t/.7],parry:['parry',h.t/PARRY.dur],muerta:['muerte',Math.min(1,h.t/1)]}[h.estado];
    MOD.posar(hm,{anim:!poses.heroe&&!aDistancia()&&h.paso>.005&&['quieto','andar'].includes(h.estado)?'andar':ph[0],k:ph[1],t:reloj.t,fase:h.fase,paso:h.paso});
    // Mohamed apuntando o recién disparado: el brazo de la pistola al frente (sobre el paso), con el retroceso.
    if(aDistancia()&&!poses.heroe&&['quieto','andar'].includes(h.estado)&&(ctl.atacar||h.disparoT<.45)){const r=Math.max(0,1-h.disparoT*6),H=hm.H;
      H.brazoD.rotation.set(-1.52-.3*r,0,.05);H.anteD.rotation.set(-.05-.25*r,0,0);H.manoD.rotation.set(0,0,0);H.torso.rotation.y-=.15;}
    if(h.dolor<1&&['quieto','andar'].includes(h.estado)){hm.H.torso.rotation.x-=.25*(1-h.dolor);}
    // Rojo al recibir; azulado y translúcido mientras es invulnerable (esquiva).
    if(h.destello>0){hm.M.u.uDestello.value=h.destello*.8;hm.M.u.uColorD.value.setRGB(1,.25,.2);}else{hm.M.u.uDestello.value=h.invul>0?.4:0;hm.M.u.uColorD.value.setRGB(.55,.8,1.3);}
    // Adreida se ilumina en oro al parar; el parry perfecto deja una estela breve.
    const oroParry=!aDistancia()&&h.vivo?Math.max(h.estado==='parry'?1:0,h.brilloParry/.3*1.5):0;
    hm.M.u.uBorde.value=oroParry*1.15;hm.M.u.uColorB.value.setRGB(1,.58,.08);
    if(oroParry>0&&h.destello<=0){hm.M.u.uDestello.value=Math.min(.6,oroParry*.42);hm.M.u.uColorD.value.setRGB(1,.65,.12);}
    for(const e of enemigos){const m=e.m;m.raiz.position.set(e.pos.x,0,e.pos.z);m.raiz.rotation.y=e.dir;const d=e.d;
      const ka=e.ataque?Math.min(1,(reloj.t-e.ataque.t0)/e.ataque.dur):1;
      const pe={quieto:['quieto'],entra:['andar'],persigue:[e.paso>.05?'andar':'quieto'],aviso:[d.lanza?'apunta':'aviso',ka],golpe:[d.lanza?'lanzar':'golpe',d.lanza?e.t/d.golpe*.6:.38+.24*(e.t/d.golpe)],
        recupera:[d.lanza?'lanzar':'golpe',d.lanza?.6+.4*Math.min(1,e.t/d.recupera):.62+.38*Math.min(1,e.t/d.recupera)],dolor:['dolor',e.t/.28],aturdido:['aturdido'],grito:['grito',e.t/.9],muere:['muerte',Math.min(1,e.t/.6)]}[e.estado];
      if(e.tipo==='troll'&&e.mazazo&&['aviso','golpe','recupera'].includes(e.estado)){pe[0]=e.estado==='aviso'?'cargaMazazo':'mazazo';pe[1]=e.estado==='aviso'?ka:e.estado==='golpe'?.3*e.t/d.golpe:.3+.7*Math.min(1,e.t/d.recupera);}
      if(e.tipo==='troll'&&e.tiraGoblin&&['aviso','golpe','recupera'].includes(e.estado)){pe[0]=e.estado==='aviso'?'preparaGoblin':'arrojaGoblin';pe[1]=e.estado==='aviso'?ka:e.estado==='golpe'?.4*e.t/d.golpe:.4+.6*Math.min(1,e.t/d.recupera);}
      MOD.posar(m,{anim:pe[0],k:pe[1],t:reloj.t+e.id,fase:e.fase,paso:e.paso});
      // Quién va a atacar: se enciende en rojo mientras avisa (más al fijarse); quién te acaba de golpear, un destello rojo.
      m.M.u.uDestello.value=e.destello*.42;m.M.u.uColorD.value.setRGB(1,.92,.8);
      const culpa=Math.max(0,1-(reloj.t-e.culpableT)/.6);
      m.M.u.uBorde.value=e.ataque?(e.ataque.fijado?1.1+.4*Math.sin(reloj.t*40):.25+.45*ka):culpa*1.3;m.M.u.uColorB.value.setRGB(1,e.ataque&&!e.ataque.fijado?.16:.07,.03);
      if(e.fase2&&!e.ataque&&e.estado!=='muere'){const cerrado=blindadoTroll(e);m.M.u.uBorde.value=cerrado?1.2:1.8;m.M.u.uColorB.value.setHex(cerrado?0x916aff:0xffd45a);}
      if(e.estado==='aturdido'){if(!e.estrellas){e.estrellas=new THREE.Group();for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.OctahedronGeometry(.07),matEstrella);s.position.set(Math.cos(i*TAU/3)*.3,0,Math.sin(i*TAU/3)*.3);e.estrellas.add(s);}escena.add(e.estrellas);}
        e.estrellas.position.set(e.pos.x,m.alto+.25,e.pos.z);e.estrellas.rotation.y=reloj.t*5;}
      else if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}}
    const sel=ent.sobre?.d?ent.sobre:null;seleccion.m.visible=!!sel&&sel.estado!=='muere';if(sel){seleccion.m.position.set(sel.pos.x,.045,sel.pos.z);seleccion.m.scale.setScalar(sel.radio*1.8);}
    // Aura de Provocar y la luz del héroe (dorada mientras dura).
    aura.visible=h.escudo>0;aura.position.set(h.pos.x,(h.alto||0)+1,h.pos.z);aura.material.uniforms.uA.value=Math.min(1,h.escudo)*.9;
    rastroCorte(h);
    estela.visible=h.estado==='torbellino';estela.position.set(h.pos.x,1.05,h.pos.z);estela.rotation.y=-h.giro;
    luzHeroe.color.setHex(h.escudo>0?0xffc870:0xffd2a0);luzHeroe.intensity=h.vivo?40:18;
    for(const f of fuegos)f.luz.intensity=55+Math.sin(reloj.t*11+f.x)*9+Math.sin(reloj.t*23+f.z)*6;for(const b of braseros)b.luz.intensity=24+Math.sin(reloj.t*13+b.x)*5;
    for(const n of [...numeros]){const s=reloj.t-n.t0;n.e.pos.y=n.y+s*1.4;n.e.el.style.opacity=String(Math.max(0,1-Math.max(0,s-.45)/.5));if(s>.95){quitarEtiqueta(n.e);numeros.splice(numeros.indexOf(n),1);}}
    pasoCamara(dt);camara.updateMatrixWorld();actualizarPunteria();for(const e of etiquetas)colocar(e);hud();
    lienzo.style.cursor=ent.sobre?.d?'crosshair':ent.sobre?.bono?'pointer':'default';
  }
  const matEstrella=new THREE.MeshBasicMaterial({color:0xffe070,toneMapped:false});
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.25,24,16),new THREE.ShaderMaterial({uniforms:{uA:{value:0},uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vN,vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uA,uT;varying vec3 vN,vV;varying float vY;void main(){float f=pow(clamp(1.-abs(dot(vN,vV)),0.,1.),2.5)*(.7+.3*sin(vY*14.-uT*6.));gl_FragColor=vec4(vec3(1.,.75,.3)*1.6,f*uA);}`}));aura.visible=false;escena.add(aura);
  // El rastro del hachazo: un arco que se dibuja detrás del hacha (del lado donde empieza el tajo) y se desvanece;
  // coincide con la zona que golpea. La estocada deja una estela recta al frente.
  const matRastro=new THREE.ShaderMaterial({uniforms:{uP:{value:0},uA:{value:0},uS:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:'attribute float aK,aR;varying float vK,vR;void main(){vK=aK;vR=aR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uP,uA,uS;varying float vK,vR;void main(){float k=mix(1.-vK,vK,uS);float a=pow(smoothstep(uP-.55,uP,k),2.)*step(k,uP)*smoothstep(.35,.9,vR)*(1.-smoothstep(.93,1.,vR));gl_FragColor=vec4(vec3(1.,.88,.7)*.9,a*uA*.55);}`});
  function geoRastro(forma){const P=[],K=[],Rr=[],I=[],n=28;
    for(let i=0;i<=n;i++){const t=i/n;for(let j=0;j<2;j++){if(forma==='arco'){const f=-1.15+2.3*t,r=j?2.15:1.2;P.push(Math.sin(f)*r,0,Math.cos(f)*r);}else{P.push(j?.09:-.09,0,.6+2.2*t);}K.push(t);Rr.push(forma==='arco'?j:.5+.5*Math.sin(Math.PI*t));}
      if(i<n){const o=i*2;I.push(o,o+1,o+2,o+1,o+3,o+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aK',new THREE.Float32BufferAttribute(K,1));g.setAttribute('aR',new THREE.Float32BufferAttribute(Rr,1));g.setIndex(I);return g;}
  const rastroArco=new THREE.Mesh(geoRastro('arco'),matRastro),rastroRecto=new THREE.Mesh(geoRastro('recto'),matRastro.clone());for(const m of [rastroArco,rastroRecto]){m.visible=false;m.frustumCulled=false;escena.add(m);}
  function rastroCorte(h){rastroArco.visible=rastroRecto.visible=false;if(h.estado!=='golpe')return;const C=COMBO[h.combo],k=h.t/C.dur,m=h.combo===2?rastroRecto:rastroArco;
    const u=m.material.uniforms;u.uP.value=h.combo===2?tramo(k,.42,.56)*1.5:tramo(k,.38,.64)*1.5;u.uA.value=1-tramo(k,h.combo===2?.6:.64,.9);u.uS.value=h.combo===1?0:1;if(u.uP.value<=0||u.uA.value<=0)return;
    m.visible=true;m.position.set(h.pos.x,.75,h.pos.z);m.rotation.y=h.dir;}
  const estela=new THREE.Mesh(new THREE.RingGeometry(1.1,2.5,48,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP;void main(){float a=atan(vP.z,vP.x)/6.2832+.5,r=length(vP.xz);float s=pow(fract(a*2.),3.)*smoothstep(1.1,1.6,r)*(1.-smoothstep(2.1,2.5,r));gl_FragColor=vec4(vec3(1.,.85,.6)*1.8,s*.8);}`}));estela.visible=false;escena.add(estela);

  function medir(){const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,b.width),H=Math.max(1,b.height);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);camara.aspect=W/H;camara.fov=W/H<.9?44:32;camara.updateProjectionMatrix();escPuntos.value=H*dpr/900;}
  function aplicarEfectos(){renderer.shadowMap.enabled=efectos.sombras;luna.castShadow=efectos.sombras;oclusion.enabled=efectos.oclusion;resplandor.enabled=efectos.resplandor;escena.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true;});}
  for(const c of document.querySelectorAll('[data-efecto]'))c.onchange=()=>{efectos[c.dataset.efecto]=c.checked;aplicarEfectos();};
  {const sel=$('estiloBala');sel.value=estiloBala;sel.onchange=()=>{estiloBala=sel.value;};}
  $('demo').onclick=()=>{ent.piloto=!ent.piloto;$('demo').setAttribute('aria-pressed',String(ent.piloto));};
  $('reiniciar').onclick=()=>reiniciar();
  // Elegir personaje: cambia el héroe y los rótulos de la barra (sus habilidades son otras) y vuelve a empezar.
  function rotulos(){const d=aDistancia(),pon=(h,icono,txt)=>{const b=document.querySelector(`[data-hab="${h}"]`);if(!b)return;b.querySelector('span').textContent=icono;b.querySelector('small').textContent=txt;};
    pon('tajo',d?'➶':'⚔',d?'Disparar':'Atacar');pon('torbellino',d?'✺':'↻',d?'Abanico':'Torbellino');pon('salto',d?'⤿':'⤓',d?'Backflip':'Salto');
    const r=document.querySelector('.apRetrato');r.src='./art/'+HEROES[tipoHeroe].retrato+'.webp';r.alt=HEROES[tipoHeroe].nombre;
    for(const b of document.querySelectorAll('[data-heroe]'))b.setAttribute('aria-pressed',String(b.dataset.heroe===tipoHeroe));}
  function elegir(t){if(!HEROES[t]||t===tipoHeroe)return;tipoHeroe=t;rotulos();reiniciar();}
  for(const b of document.querySelectorAll('[data-heroe]'))b.onclick=()=>elegir(b.dataset.heroe);
  rotulos();
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
    estado('WASD para moverte, clic izquierdo para atacar hacia el cursor, Espacio para esquivar, clic derecho para saltar, Q Torbellino, E Provocar.');
    listo=true;paso(1/60);if(!CAPTURA)requestAnimationFrame(cuadro);else dibujar();
  }

  // Revisión: avanzar(s) mueve el reloj a pasos de 1/30 s (cede el turno entre pasos) y dibuja.
  const aPantalla=p=>{camara.updateMatrixWorld(true);const v=p.clone().project(camara),b=esc.getBoundingClientRect();return {x:b.left+(v.x*.5+.5)*b.width,y:b.top+(.5-v.y*.5)*b.height,dentro:Math.abs(v.x)<1&&Math.abs(v.y)<1};};
  const resumen=e=>({borde:+e.m.M.u.uBorde.value.toFixed(2),ataque:e.ataque?{forma:e.ataque.forma,k:+Math.min(1,(reloj.t-e.ataque.t0)/e.ataque.dur).toFixed(2),fijado:e.ataque.fijado}:null,id:e.id,tipo:e.tipo,x:+e.pos.x.toFixed(2),z:+e.pos.z.toFixed(2),vida:e.vida,vidaMax:e.vidaMax,estado:e.estado,fase2:!!e.fase2,blindado:!!blindadoTroll(e),parryHasta:e.parryHasta||0,disuelve:+e.m.M.u.uDisuelve.value.toFixed(2),expuesto:e.expuestoHasta>reloj.t});
  window.CAOZ_ARPG_THREE_REVISION=Object.freeze({
    listo:()=>listo,
    async avanzar(s,fps=30){const n=Math.max(1,Math.round(s*fps));for(let i=0;i<n;i++){paso(1/fps);if(i%3===2)await new Promise(r=>setTimeout(r,0));}dibujar();return this.estado();},
    dibujar(){dibujar();const i=renderer.info.render;return {llamadas:i.calls,triangulos:i.triangles};},
    estado:()=>({peligrosTroll:peligrosTroll.map(p=>({tipo:p.tipo,k:p.t/p.dur,x:p.hasta.x,z:p.hasta.z,alto:p.m.position.y,devuelto:p.devuelto})),listo,webgl2:true,hdr,muestras,simple,version:THREE.REVISION,pases:[['render',pasoRender],['oclusion',oclusion],['saneado',saneado],['resplandor',resplandor],['salida',salida]].filter(([,p])=>p.enabled).map(([n])=>n),
      heroe:{t:+heroe.t.toFixed(3),vatq:+heroe.vatq.toFixed(2),punta:(()=>{const p=heroe.m.M.punta.getWorldPosition(new V3());return [+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)];})(),combo:heroe.combo,invul:+heroe.invul.toFixed(2),parrys:heroe.parrys,tipo:heroe.tipo,balas:heroe.balas,recarga:+heroe.recargaT.toFixed(2),disparos:heroe.disparos,bloqueos:heroe.bloqueos,esquivados:heroe.esquivados||0,golpeDe:heroe.golpeDe?.id??null,x:+heroe.pos.x.toFixed(2),z:+heroe.pos.z.toFixed(2),alto:+(heroe.alto||0).toFixed(2),alma:heroe.alma,almaMax:heroe.almaMax,furia:+heroe.furia.toFixed(1),atq:heroe.atq,estado:heroe.estado,vivo:heroe.vivo,escudo:+heroe.escudo.toFixed(2),cd:{...heroe.cd},llaves:heroe.llaves,botin:heroe.botin.map(b=>b.id+'/'+b.ed),dir:+heroe.dir.toFixed(3)},
      enemigos:enemigos.map(resumen),botines:botines.map(b=>({id:b.id,ed:b.ed,listo:b.listo,volando:b.volando,x:+b.pos.x.toFixed(2),z:+b.pos.z.toFixed(2),mirada:+b.mirada.toFixed(2),escala:b.g?+(b.g.scale.x/SB).toFixed(2):0,nombre:b.nombre?.el.textContent||''})),
      globos:globos.length,alertas:etiquetas.filter(x=>x.el.classList.contains('apAlerta')&&!x.el.hidden).length,flechas:flechasEl.filter(f=>!f.hidden&&f.parentNode).length,golpeDir:+$('golpeDir').style.opacity||0,lanzas:lanzas.filter(l=>!l.clavada).length,lanzaAhora:lanzas.some(l=>l.ahora&&!l.clavada),balas:balas.length,marcas:marcas.filter(o=>!o.fijo).map(o=>o.tipo),oleada:ol.i,fin:ol.fin,finVisible:!$('fin').hidden,finTitulo:$('finTitulo').textContent,
      sobre:ent.sobre?.d?'enemigo:'+ent.sobre.id:ent.sobre?.bono?'botin:'+ent.sobre.id:null,objetivo:$('objetivo').hidden?null:$('objNombre').textContent,tactil:ent.tactil,temblor:vista.temblor,
      mallasHeroe:heroe.m.mallas.length,triangulosHeroe:heroe.m.mallas.reduce((a,m)=>a+m.geometry.attributes.position.count/3,0)}),
    // Geometría de la mira y de cada bala: permite comprobar la alineación también en pantalla.
    punteria:()=>punteria?{desde:punteria.desde.toArray(),direccion:punteria.direccion.toArray(),hasta:punteria.hasta.toArray(),enemigo:punteria.enemigo,bloqueado:punteria.bloqueado}:null,
    proyectiles:()=>balas.map(b=>({origen:b.origen.toArray(),pos:b.pos.toArray(),direccion:b.dir.toArray()})),
    oleadas(v){ol.auto=v;},
    invocar(tipo,x,z,quieto=false){return crearEnemigo(tipo,x,z,{quieto}).id;},
    matar(id){const e=enemigos.find(e=>e.id===id);if(e&&e.estado!=='muere'){e.sinBotin=true;morir(e);}},
    despertar(id){const e=enemigos.find(e=>e.id===id);if(e){e.quieto=false;e.dentro=true;cambiar(e,'persigue');}},
    async soltar(id,ed,x,z){const b=await soltar(id,ed,x,z);return {id:b.id,ed:b.ed};},
    // control({mov:[x,z],atacar,apunta:[x,z]}) manda como el teclado y el ratón; control(null) lo devuelve.
    control(c){ent.rev=c?{mov:new V3(c.mov?.[0]||0,0,c.mov?.[1]||0),atacar:!!c.atacar,apunta:c.apunta?new V3(c.apunta[0],0,c.apunta[1]):null}:null;},
    usar:(h,x,z)=>usar(h,x===undefined?null:new V3(x,0,z)),
    heroe(p){if('x' in p)heroe.pos.set(p.x,0,p.z);if('alma' in p)heroe.alma=p.alma;if('furia' in p)heroe.furia=p.furia;if('dir' in p)heroe.dir=p.dir;vista.foco.copy(heroe.pos);},
    enemigo(id,p){const e=enemigos.find(e=>e.id===id);if(!e)return;if('x' in p)e.pos.set(p.x,0,p.z);if('dir' in p)e.dir=p.dir;if('vida' in p)e.vida=p.vida;},
    piloto(v){ent.piloto=v;},
    pose(anim,k){poses.heroe=anim?[anim,k]:null;},
    camara(p){Object.assign(vista,p);},
    efecto(k,v){efectos[k]=v;const c=document.querySelector(`[data-efecto="${k}"]`);if(c)c.checked=v;aplicarEfectos();},
    reiniciar,
    elegir,
    balas(v){estiloBala=v;$('estiloBala').value=v;},
    nan(v,x=0,z=0){puntoNaN.visible=v;puntoNaN.position.set(x,.3,z);},
    saneado(v){saneado.enabled=v;},
    pantalla:(x,y,z)=>aPantalla(new V3(x,y,z)),
    heroePantalla:(y=1)=>aPantalla(heroe.pos.clone().setY(y)),
    enemigoPantalla(id,y){const e=enemigos.find(e=>e.id===id);return e?aPantalla(e.pos.clone().setY(y??e.m.alto*.6)):null;},
    botinPantalla(i){const b=botines[i];return b?.listo?aPantalla(b.caja.position.clone()):null;},
    rectBotin(i){const b=botines[i];if(!b?.g)return null;b.g.updateMatrixWorld(true);const xs=[],ys=[],B=esc.getBoundingClientRect();for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const v=new V3(x*ANCHO/2,y*ALTO/2,0).applyMatrix4(b.g.matrixWorld).project(camara);xs.push((v.x*.5+.5)*B.width);ys.push((.5-v.y*.5)*B.height);}
      return {izquierda:Math.min(...xs),derecha:Math.max(...xs),arriba:Math.min(...ys),abajo:Math.max(...ys),ancho:B.width,alto:B.height};},
  });
  preparar().catch(e=>aviso('No se pudo preparar la plaza: '+e.message));
})();

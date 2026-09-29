/* Las batallas de la historia, Episodio 1: «Emboscada en la Carreta hacia el
   Domo». Reclutados en Waterdeep, el grupo viaja en carreta hacia el Domo; se
   parte una rueda y los goblins salen de los arbustos. Se juega con Adreida
   (su hacha a dos manos, el control a lo Hades de arpg-three) y el resto del
   grupo hace lo que hizo en la historia, guiado por un director de escena:
     1. Una flecha alcanza a Talesin en el hombro.
     2. Talesin lanza un Rayo de fuego y falla por el dolor.
     3. Fender se mete bajo la carreta y canta (Inspiración bárdica: Adreida
        pega más fuerte y más rápido un rato).
     4. Mohamed salta a los árboles con acrobacias.
     5. Rafaela calcina al líder goblin con Manos ardientes.
     6. Adreida parte a un goblin por la mitad (su primera muerte).
     7. Talesin reparte dardos de luz (Proyectil mágico).
     8. Fender proyecta una gata que baila bachata (Ilusión menor): los goblins
        se quedan embobados; Mohamed cae desde las alturas sobre uno.
     9. Adreida le corta las piernas a Glip (el que será Machete) y Rafaela
        remata con Manos ardientes al último, que huye.
   Los modelos son los de arpg-three-modelos.js (Adreida, el grupo y los goblins).
   ?captura=1 deja el escenario quieto; la revisión (CAOZ_EPISODIOS_THREE_REVISION)
   avanza el tiempo a pasos fijos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),CAPTURA=q.get('captura')==='1';
  const estado=t=>{$('estado').textContent=t;},aviso=t=>{estado(t);$('info').textContent=t;};
  addEventListener('error',e=>aviso('Error: '+(e.message||e.error)));
  addEventListener('unhandledrejection',e=>aviso('Error: '+(e.reason?.message||e.reason)));
  if(!document.createElement('canvas').getContext('webgl2')){aviso('Este navegador no tiene WebGL 2, que three.js necesita. Prueba con Chrome, Edge, Firefox o Safari actualizados.');return;}
  if(CAPTURA)document.documentElement.dataset.captura='';
  const {THREE,EffectComposer,RenderPass,GTAOPass,UnrealBloomPass,OutputPass}=window.CAOZ_THREE;
  const MOD=window.CAOZ_ARPG_MODELOS.fabrica(THREE);
  const TAU=Math.PI*2,V3=THREE.Vector3;
  const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const efectos={sombras:true,oclusion:true,resplandor:true};
  let semilla=17;const rnd=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
  const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
  const difAng=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
  const rumbo=(de,a)=>Math.atan2(a.x-de.x,a.z-de.z);
  const plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const frente=a=>new V3(Math.sin(a),0,Math.cos(a));

  /* ---- Motor, escena y posproceso (como en arpg-three) --------------------------- */
  const lienzo=$('lienzo'),esc=$('escenario');
  const renderer=new THREE.WebGLRenderer({canvas:lienzo,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;renderer.localClippingEnabled=true;
  const gl=renderer.getContext(),hdr=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float'),muestras=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
  const depura=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(depura?gl.getParameter(depura.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)).slice(0,60);
  // Tarde de camino: cielo claro y una bruma cálida en el horizonte.
  const escena=new THREE.Scene();escena.background=new THREE.Color(0x8fa9bd);escena.fog=new THREE.FogExp2(0x9fb2b8,.012);
  {const e=new THREE.Scene();e.background=new THREE.Color(0x7d9ac0);const caja=(w,h,color,f,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(f),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);e.add(m);};
    caja(10,10,0xcfe0ff,1,[0,9,0]);caja(14,3,0xffc890,1.3,[-9,1,2]);caja(10,2,0x5a7a3a,.6,[9,-1,0]);caja(12,2,0x6a8a4a,.6,[0,-2,9]);
    escena.environment=new THREE.PMREMGenerator(renderer).fromScene(e,.03).texture;escena.environmentIntensity=.6;}
  const camara=new THREE.PerspectiveCamera(32,1,.5,200);
  const objetivo=new THREE.WebGLRenderTarget(2,2,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,samples:muestras});
  const composer=new EffectComposer(renderer,objetivo),pasoRender=new RenderPass(escena,camara);
  const oclusion=new GTAOPass(escena,camara,2,2);oclusion.updateGtaoMaterial({radius:.9,distanceExponent:1.5,thickness:1.2,scale:1,samples:12});oclusion.blendIntensity=.8;
  {const ocultar=oclusion._overrideVisibility.bind(oclusion);oclusion._overrideVisibility=function(){ocultar();escena.traverse(n=>{if(n.visible&&(n.material?.transparent||n.material?.userData?.sinOclusion)){n.visible=false;this._visibilityCache.push(n);}});};}
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.4,.45,1.1),salida=new OutputPass();
  // Saneado: los píxeles NaN o infinitos (Metal en Mac) pasan a negro antes del resplandor (si no, cuadros negros).
  const saneado={enabled:true,needsSwap:true,clear:false,renderToScreen:false,setSize(){},dispose(){},
    mat:new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
        float limpio(float x){return (x>=0.&&x<=60000.)?x:(x>60000.?60000.:0.);}
        void main(){vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(limpio(c.r),limpio(c.g),limpio(c.b),limpio(c.a));}`}),
    render(r,escribir,leer){this.mat.uniforms.tDiffuse.value=leer.texture;r.setRenderTarget(this.renderToScreen?null:escribir);r.render(this.escenaQ,this.camQ);}};
  saneado.escenaQ=new THREE.Scene();saneado.escenaQ.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),saneado.mat));saneado.camQ=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  for(const p of [pasoRender,oclusion,saneado,resplandor,salida])composer.addPass(p);
  const reloj={t:0},tiempo={value:0};

  /* ---- El suelo: hierba y el camino de tierra con sus rodadas --------------------------- */
  const lienzoDe=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];};
  const tex=(c,srgb,rep)=>{const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...rep);}return t;};
  const azar2=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
  const ruido=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),f=x-i,g=y-j,u=f*f*(3-2*f),v=g*g*(3-2*g);return (azar2(i,j)*(1-u)+azar2(i+1,j)*u)*(1-v)+(azar2(i,j+1)*(1-u)+azar2(i+1,j+1)*u)*v;};
  const LADO=72;// el suelo pintado mide 72 × 72 m
  const caminoZ=x=>Math.sin(x*.09)*.7;// el centro del camino (va de oeste a este)
  function pintarSuelo(){const T=1024,[c,g]=lienzoDe(T,T),[a,ga]=lienzoDe(T,T),col=g.createImageData(T,T),alt=ga.createImageData(T,T);
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){const wx=(x/T-.5)*LADO,wz=(y/T-.5)*LADO,o=(y*T+x)*4;
      const n1=ruido(wx*.35,wz*.35),n2=ruido(wx*2.1,wz*2.1),n3=ruido(wx*7,wz*7);
      const dz=Math.abs(wz-caminoZ(wx)),borde=2.2+(n1-.5)*.8,camino=1-Math.min(1,Math.max(0,(dz-borde)/.7));
      const rodada=Math.max(0,1-Math.abs(dz-1)/.28)*(1-Math.max(0,1-dz/.3))*.9,centro=Math.max(0,1-dz/.35)*(n2>.5?1:.4);
      // Hierba: verdes y amarillos de tarde con matas; tierra: parda, más oscura en las rodadas, con hierba en el centro.
      let r=62+n1*40+n3*18,gg=86+n1*38+n3*22,b=34+n1*14;if(n2>.72){r+=18;gg+=14;}
      const tr=128+n2*24-rodada*42,tg=102+n2*18-rodada*36,tb=70+n2*12-rodada*26;
      const k=Math.max(0,camino-centro*.55);col.data[o]=r*(1-k)+tr*k;col.data[o+1]=gg*(1-k)+tg*k;col.data[o+2]=b*(1-k)+tb*k;col.data[o+3]=255;
      const h=(n2*.5+n3*.5)*(1-k*.6)*200-rodada*60+40;alt.data[o]=alt.data[o+1]=alt.data[o+2]=Math.max(0,Math.min(255,h));alt.data[o+3]=255;}
    g.putImageData(col,0,0);ga.putImageData(alt,0,0);return {map:tex(c,true),normalMap:tex(normales(a,2.2),false)};}
  function normales(alto,fuerza){const w=alto.width,h=alto.height,d=alto.getContext('2d').getImageData(0,0,w,h).data,[c,g]=lienzoDe(w,h),im=g.createImageData(w,h),a=(x,y)=>d[(((y+h)%h)*w+((x+w)%w))*4]/255;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(a(x+1,y)-a(x-1,y))*fuerza,dy=(a(x,y+1)-a(x,y-1))*fuerza,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;im.data[i]=(-dx/l*.5+.5)*255;im.data[i+1]=(dy/l*.5+.5)*255;im.data[i+2]=(1/l*.5+.5)*255;im.data[i+3]=255;}
    g.putImageData(im,0,0);return c;}

  /* ---- El camino hacia el Domo: bosque, arbustos, la carreta y el caballo --------------------- */
  const ZONA={x:17.5,z:9.2};// donde se pelea (un rectángulo a lo largo del camino)
  const obstaculos=[];// círculos {x,z,r}
  const mundo=new THREE.Group();escena.add(mundo);
  const matSuelo=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:0,normalScale:new THREE.Vector2(1,1)});
  const suelo=new THREE.Mesh(new THREE.PlaneGeometry(LADO,LADO),matSuelo);suelo.rotation.x=-Math.PI/2;suelo.receiveShadow=true;mundo.add(suelo);
  const lejos=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:0x4a5e2c,roughness:1}));lejos.rotation.x=-Math.PI/2;lejos.position.y=-.02;mundo.add(lejos);
  const std=(color,p={})=>new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0,flatShading:true,...p});
  const MAT={madera:std(0x6b4a2e),maderaOsc:std(0x4a3220),corteza:std(0x4f3a28),hierro:std(0x4a4a50,{metalness:.8,roughness:.4}),lona:std(0xe2d6bc,{roughness:.95}),piedra:std(0x7a766e),
    pino:[std(0x2f4a2a),std(0x355430),std(0x2a4226)],hoja:[std(0x4a6a2a),std(0x587a30),std(0x3e5e26)],arbusto:[std(0x3e5a26),std(0x4a6a2c),std(0x365020)],caballo:std(0x6a4630),crin:std(0x2a1c14),casco:std(0x2a2420)};
  function poner(geo,mat,x,y,z,ry=0,sombra=true,padre=mundo){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=sombra;m.receiveShadow=true;padre.add(m);return m;}
  function pino(x,z,s){poner(new THREE.CylinderGeometry(.1*s,.16*s,1.2*s,6),MAT.corteza,x,.6*s,z);const k=Math.floor(rnd()*3);
    for(let i=0;i<3;i++)poner(new THREE.ConeGeometry((1.35-i*.33)*s,(1.7-i*.2)*s,7),MAT.pino[(k+i)%3],x,(1.4+i*.95)*s,z,rnd()*TAU);}
  function roble(x,z,s){poner(new THREE.CylinderGeometry(.18*s,.3*s,2.2*s,7),MAT.corteza,x,1.1*s,z);const k=Math.floor(rnd()*3);
    for(let i=0;i<5;i++){const a=i*1.3+rnd(),r=i?.8*s:0;const m=poner(new THREE.IcosahedronGeometry((1.05+rnd()*.4)*s,0),MAT.hoja[(k+i)%3],x+Math.cos(a)*r,(2.7+rnd()*.6+(i?0:.5))*s,z+Math.sin(a)*r*.8,rnd()*TAU);m.scale.y=.8;}}
  function arbusto(x,z,s,padre=mundo){const g=new THREE.Group();g.position.set(x,0,z);padre.add(g);const k=Math.floor(rnd()*3);
    for(let i=0;i<4;i++){const a=i*1.7+rnd(),r=i?.45*s:0;const m=poner(new THREE.IcosahedronGeometry((.55+rnd()*.25)*s,1),MAT.arbusto[(k+i)%3],Math.cos(a)*r,(.42+rnd()*.15)*s,Math.sin(a)*r,rnd()*TAU,true,g);m.scale.y=.75;}return g;}
  // El bosque: fuera de la zona de pelea y sin pisar el camino.
  for(let i=0;i<150;i++){const x=(rnd()-.5)*68,z=(rnd()-.5)*62;const dentro=Math.abs(x)<ZONA.x+1&&Math.abs(z)<ZONA.z+.8,enCamino=Math.abs(z-caminoZ(x))<4;if(dentro||enCamino)continue;
    (rnd()<.55?pino:roble)(x,z,.9+rnd()*.5);}
  // Unos pocos árboles y rocas dentro, para moverse alrededor.
  for(const [x,z,s,f] of [[-13.5,-7.6,1,roble],[13.8,7.2,.95,pino],[-15.2,5.6,.9,pino],[15.8,-4.8,.9,pino]]){f(x,z,s);obstaculos.push({x,z,r:.55*s});}
  for(const [x,z,s] of [[-8.6,3.8,.6],[11.2,2.9,.5],[-2.8,-5.2,.45],[6.6,5.9,.4]]){const m=poner(new THREE.DodecahedronGeometry(s,0),MAT.piedra,x,s*.55,z,rnd()*3);m.scale.y=.7;obstaculos.push({x,z,r:s*.9});}
  // El roble de Mohamed: una rama gruesa hacia el camino donde se agazapa.
  const RAMA=new V3(8.3,3.15,-6.1);
  {const x=9.6,z=-7.4;poner(new THREE.CylinderGeometry(.26,.4,3.6,8),MAT.corteza,x,1.8,z);const r=poner(new THREE.CylinderGeometry(.11,.18,2.1,6),MAT.corteza,(x+RAMA.x)/2+.1,3.05,(z+RAMA.z)/2);r.rotation.z=1.25;r.rotation.y=-.75;
    for(let i=0;i<6;i++){const a=i*1.1,rr=i?1.1:0;const m=poner(new THREE.IcosahedronGeometry(1.2+rnd()*.4,0),MAT.hoja[i%3],x+Math.cos(a)*rr,4.4+rnd()*.5,z+Math.sin(a)*rr*.8,rnd()*TAU);m.scale.y=.8;}obstaculos.push({x,z,r:.5});}
  // Arbustos de adorno (se funden) y los escondites de la escuadra (aparte: se agitan).
  for(let i=0;i<46;i++){const x=(rnd()-.5)*40,z=(rnd()<.5?-1:1)*(6+rnd()*9);if(Math.abs(z-caminoZ(x))<3.2)continue;arbusto(x,z,.8+rnd()*.5);}
  const ESCONDITES=[
    {id:'arqueroA',tipo:'arquero',x:-6.5,z:-7.5},{id:'arqueroB',tipo:'arquero',x:4.2,z:-7.7},{id:'jefe',tipo:'jefe',x:-10.8,z:-10.2},
    {id:'g1',tipo:'goblin',x:-6.2,z:6.9},{id:'g2',tipo:'goblin',x:-1.4,z:7.5},{id:'g3',tipo:'goblin',x:3.6,z:7.2},{id:'g4',tipo:'goblin',x:-12.2,z:-3.4},{id:'glip',tipo:'glip',x:9.2,z:6.3,tanda:3},
    // La segunda tanda: salen cuando Mohamed ya está en los árboles.
    {id:'r1',tipo:'goblin',x:13.2,z:-3.2,tanda:2},{id:'r2',tipo:'goblin',x:-14.6,z:2.2,tanda:2},{id:'r3',tipo:'goblin',x:1.2,z:-8.3,tanda:2}];
  const escondites=ESCONDITES.map(s=>({...s,g:arbusto(s.x,s.z,1.25,escena),agita:0}));
  // La carreta: caja, lona sobre aros, cuatro ruedas (la trasera derecha se parte) y el caballo delante.
  const CARRETA=new V3(0,0,-1);
  const carreta=new THREE.Group();carreta.position.copy(CARRETA);escena.add(carreta);
  const cp=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;carreta.add(m);return m;};
  cp(new THREE.BoxGeometry(3.2,.16,1.5),MAT.madera,0,.86,0);for(const s of [-1,1])cp(new THREE.BoxGeometry(3.2,.42,.08),MAT.madera,0,1.13,s*.72);cp(new THREE.BoxGeometry(.08,.42,1.5),MAT.madera,-1.56,1.13,0);
  cp(new THREE.BoxGeometry(.5,.1,1.3),MAT.maderaOsc,1.35,1.42,0);cp(new THREE.BoxGeometry(.08,.5,1.3),MAT.maderaOsc,1.58,1.62,0);
  {const lona=cp(new THREE.CylinderGeometry(.82,.82,2.5,14,1,true,-Math.PI/2,Math.PI),MAT.lona,-.3,1.34,0,0,0,Math.PI/2);lona.material=MAT.lona.clone();lona.material.side=THREE.DoubleSide;
    for(const x of [-1.5,-.3,.9])cp(new THREE.TorusGeometry(.83,.03,4,14,Math.PI),MAT.maderaOsc,x,1.34,0,0,Math.PI/2,0);}
  const ruedas=[];for(const [x,z] of [[1.05,.82],[1.05,-.82],[-1.1,.82],[-1.1,-.82]]){const w=cp(new THREE.CylinderGeometry(.55,.55,.1,12),MAT.maderaOsc,x,.55,z,Math.PI/2);w.add(new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.14,8),MAT.hierro));ruedas.push(w);}
  for(const s of [-1,1])cp(new THREE.BoxGeometry(2.2,.08,.08),MAT.madera,2.6,.72,s*.42);
  const rueda={w:ruedas[2],t0:-1,desde:null};// la trasera derecha (hacia el sur, se ve)
  // El caballo, de pie y nervioso (mueve la cabeza y la cola).
  const caballo=new THREE.Group();caballo.position.set(3.9,0,-1);escena.add(caballo);
  const hp=(geo,mat,x,y,z,rx=0,ry=0,rz=0,padre=caballo)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;padre.add(m);return m;};
  hp(new THREE.CapsuleGeometry(.36,1.1,2,8),MAT.caballo,0,1.22,0,0,0,Math.PI/2);for(const [x,z] of [[.52,.2],[.52,-.2],[-.52,.2],[-.52,-.2]]){hp(new THREE.CylinderGeometry(.09,.07,1,6),MAT.caballo,x,.55,z);hp(new THREE.CylinderGeometry(.09,.1,.1,6),MAT.casco,x,.05,z);}
  const cuello=new THREE.Group();cuello.position.set(.72,1.4,0);caballo.add(cuello);hp(new THREE.CapsuleGeometry(.18,.55,2,6),MAT.caballo,.18,.3,0,0,0,-.6,cuello);hp(new THREE.BoxGeometry(.2,.52,.06),MAT.crin,.08,.38,0,0,0,-.6,cuello);
  hp(new THREE.BoxGeometry(.6,.26,.24),MAT.caballo,.55,.62,0,0,0,-.35,cuello);for(const s of [-1,1])hp(new THREE.ConeGeometry(.05,.14,4),MAT.caballo,.32,.8,s*.08,0,0,-.2,cuello);
  const cola=hp(new THREE.CylinderGeometry(.06,.12,.8,6),MAT.crin,-.85,1.0,0,0,0,-.5);
  obstaculos.push({x:-1,z:-1,r:1.05},{x:1,z:-1,r:1.05},{x:2.6,z:-1,r:.45},{x:3.9,z:-1,r:.85});
  // Lo estático se funde por material: pocas llamadas de dibujo.
  function fundirMundo(){mundo.updateMatrixWorld(true);const grupos=new Map(),quitar=[];
    mundo.traverse(o=>{if(!o.isMesh||o===suelo||o===lejos||o.material.isShaderMaterial)return;if(!grupos.has(o.material))grupos.set(o.material,[]);grupos.get(o.material).push(o);quitar.push(o);});
    for(const o of quitar)o.parent.remove(o);
    for(const [mat,lista] of grupos){let n=0;const gs=lista.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);n+=g.attributes.position.count;return g;});
      const P=new Float32Array(n*3),N=new Float32Array(n*3);let i=0;for(const g of gs){P.set(g.attributes.position.array,i*3);N.set(g.attributes.normal.array,i*3);i+=g.attributes.position.count;g.dispose();}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.computeBoundingSphere();
      const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;mundo.add(m);}}
  fundirMundo();
  // Luces: el sol de la tarde (con sombras, sigue a Adreida) y el cielo.
  const hemi=new THREE.HemisphereLight(0xbcd4ff,0x4a5a2a,.9);escena.add(hemi);
  const sol=new THREE.DirectionalLight(0xffe0b4,2.6);sol.castShadow=true;sol.shadow.mapSize.set(2048,2048);sol.shadow.radius=3;sol.shadow.blurSamples=12;sol.shadow.bias=-.0004;sol.shadow.normalBias=.03;
  Object.assign(sol.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:80});escena.add(sol,sol.target);

  /* ---- Partículas, marcas en el suelo y etiquetas (como en arpg-three) ------------------------ */
  const NP=3000,pPos=new Float32Array(NP*3),pCol=new Float32Array(NP*4),pTam=new Float32Array(NP),pVel=new Float32Array(NP*3),pVida=new Float32Array(NP),pMax=new Float32Array(NP),pGrav=new Float32Array(NP),pBase=new Float32Array(NP*4);
  let pSig=0;const escPuntos={value:1};
  const geoP=new THREE.BufferGeometry();geoP.setAttribute('position',new THREE.BufferAttribute(pPos,3).setUsage(THREE.DynamicDrawUsage));geoP.setAttribute('aColor',new THREE.BufferAttribute(pCol,4).setUsage(THREE.DynamicDrawUsage));geoP.setAttribute('aTam',new THREE.BufferAttribute(pTam,1).setUsage(THREE.DynamicDrawUsage));
  const puntos=new THREE.Points(geoP,new THREE.ShaderMaterial({uniforms:{uEsc:escPuntos},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aTam;attribute vec4 aColor;uniform float uEsc;varying vec4 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aTam*uEsc*60./max(-mv.z,.1);vC=aColor;}`,
    fragmentShader:`varying vec4 vC;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.05,.5,d);gl_FragColor=vec4(vC.rgb,vC.a*a);}`}));
  puntos.frustumCulled=false;puntos.renderOrder=3;escena.add(puntos);
  // El humo y el polvo se mezclan normal (oscurecen); el fuego, las chispas y la magia suman luz.
  const NH=900,hPos=new Float32Array(NH*3),hCol=new Float32Array(NH*4),hTam=new Float32Array(NH),hVel=new Float32Array(NH*3),hVida=new Float32Array(NH),hMax=new Float32Array(NH),hBase=new Float32Array(NH*4);let hSig=0;
  const geoH=new THREE.BufferGeometry();geoH.setAttribute('position',new THREE.BufferAttribute(hPos,3).setUsage(THREE.DynamicDrawUsage));geoH.setAttribute('aColor',new THREE.BufferAttribute(hCol,4).setUsage(THREE.DynamicDrawUsage));geoH.setAttribute('aTam',new THREE.BufferAttribute(hTam,1).setUsage(THREE.DynamicDrawUsage));
  const humos=new THREE.Points(geoH,new THREE.ShaderMaterial({uniforms:{uEsc:escPuntos},transparent:true,depthWrite:false,
    vertexShader:`attribute float aTam;attribute vec4 aColor;uniform float uEsc;varying vec4 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aTam*uEsc*60./max(-mv.z,.1);vC=aColor;}`,
    fragmentShader:`varying vec4 vC;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.1,.5,d);gl_FragColor=vec4(vC.rgb,vC.a*a);}`}));
  humos.frustumCulled=false;humos.renderOrder=2;escena.add(humos);
  function particula(x,y,z,vx,vy,vz,vida,tam,r,g,b,grav=0){const i=pSig;pSig=(pSig+1)%NP;pPos.set([x,y,z],i*3);pVel.set([vx,vy,vz],i*3);pVida[i]=vida;pMax[i]=vida;pTam[i]=tam;pBase.set([r,g,b,1],i*4);pGrav[i]=grav;}
  function humo(x,y,z,vx,vy,vz,vida,tam,r,g,b,a=.6){const i=hSig;hSig=(hSig+1)%NH;hPos.set([x,y,z],i*3);hVel.set([vx,vy,vz],i*3);hVida[i]=vida;hMax[i]=vida;hTam[i]=tam;hBase.set([r,g,b,a],i*4);}
  function chispas(p,n,color=[1,.7,.3],vel=6,tam=.5){for(let i=0;i<n;i++){const a=rnd()*TAU,e=rnd()*1.2-.1,v=vel*(.4+rnd()*.8);particula(p.x,p.y,p.z,Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v+1,Math.sin(a)*Math.cos(e)*v,.35+rnd()*.4,tam*(.6+rnd()*.8),color[0]*3,color[1]*3,color[2]*3,14);}}
  function polvo(p,n,radio=1){for(let i=0;i<n;i++){const a=rnd()*TAU,v=1.5+rnd()*3;humo(p.x+Math.cos(a)*radio*.3,.2,p.z+Math.sin(a)*radio*.3,Math.cos(a)*v,.5+rnd()*1.2,Math.sin(a)*v,.7+rnd()*.6,1.6+rnd()*1.4,.62,.54,.42,.5);}}
  function hojas(p,n){for(let i=0;i<n;i++){const a=rnd()*TAU,v=1+rnd()*3.5;humo(p.x,.5+rnd()*.7,p.z,Math.cos(a)*v,1.5+rnd()*2.5,Math.sin(a)*v,.8+rnd()*.6,.5+rnd()*.4,.25+rnd()*.15,.42+rnd()*.15,.12,.95);}}
  function brasas(p,n,alto=1.2){for(let i=0;i<n;i++)particula(p.x+(rnd()-.5)*.8,p.y+rnd()*alto,p.z+(rnd()-.5)*.8,(rnd()-.5)*1.2,1+rnd()*2.4,(rnd()-.5)*1.2,.8+rnd()*1.1,.35+rnd()*.4,3,.9,.2,-.6);}
  function pasoParticulas(dt){for(let i=0;i<NP;i++){if(pVida[i]<=0){pCol[i*4+3]=0;continue;}pVida[i]-=dt;const j=i*3;pVel[j+1]-=pGrav[i]*dt;const fr=Math.exp(-dt*1.6);pVel[j]*=fr;pVel[j+2]*=fr;
      pPos[j]+=pVel[j]*dt;pPos[j+1]+=pVel[j+1]*dt;pPos[j+2]+=pVel[j+2]*dt;if(pPos[j+1]<.03){pPos[j+1]=.03;pVel[j+1]*=-.3;}
      const k=Math.max(0,pVida[i]/pMax[i]);pCol[i*4]=pBase[i*4];pCol[i*4+1]=pBase[i*4+1];pCol[i*4+2]=pBase[i*4+2];pCol[i*4+3]=Math.min(1,k*1.6);}
    for(let i=0;i<NH;i++){if(hVida[i]<=0){hCol[i*4+3]=0;continue;}hVida[i]-=dt;const j=i*3,fr=Math.exp(-dt*2.2);hVel[j]*=fr;hVel[j+2]*=fr;hVel[j+1]=hVel[j+1]*fr+(hBase[i*4+3]>.9?-2.5*dt:.15*dt);
      hPos[j]+=hVel[j]*dt;hPos[j+1]+=hVel[j+1]*dt;hPos[j+2]+=hVel[j+2]*dt;if(hPos[j+1]<.03){hPos[j+1]=.03;hVel[j+1]=0;}const k=Math.max(0,hVida[i]/hMax[i]);
      hCol[i*4]=hBase[i*4];hCol[i*4+1]=hBase[i*4+1];hCol[i*4+2]=hBase[i*4+2];hCol[i*4+3]=hBase[i*4+3]*Math.min(1,k*2)*Math.min(1,(1-k)*6+.2);if(hBase[i*4+3]<.9)hTam[i]+=dt*.8;}
    geoP.attributes.position.needsUpdate=geoP.attributes.aColor.needsUpdate=geoP.attributes.aTam.needsUpdate=true;geoH.attributes.position.needsUpdate=geoH.attributes.aColor.needsUpdate=geoH.attributes.aTam.needsUpdate=true;}
  // Marcas en el suelo (las zonas de ataque que se llenan, ondas y el anillo de selección).
  const marcas=[];
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
  const capa=$('capa'),etiquetas=[],numeros=[];
  const detras=p=>p.clone().applyMatrix4(camara.matrixWorldInverse).z>-camara.near;
  function colocar(e){const v=e.pos.clone().project(camara),b=esc.getBoundingClientRect();e.el.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*b.width}px,${(.5-v.y*.5)*b.height}px)`;e.el.hidden=detras(e.pos)||e.oculta;}
  function etiqueta(clase,pos){const el=document.createElement('div');el.className=clase;capa.appendChild(el);const e={el,pos};etiquetas.push(e);return e;}
  function quitarEtiqueta(e){e.el.remove();const i=etiquetas.indexOf(e);if(i>=0)etiquetas.splice(i,1);}
  function numero(pos,texto,clase,dur=.95){const e=etiqueta('apNumero '+clase,pos.clone().add(new V3((rnd()-.5)*.5,0,(rnd()-.5)*.3)));e.el.textContent=texto;numeros.push({e,t0:reloj.t,y:e.pos.y,dur});}
  // Gritos sobre las cabezas («¡A por ellos!») y notas musicales que vuelan.
  const gritos=[];function gritar(quien,texto,clase='',dur=1.8){const e=etiqueta('epGrito '+clase,new V3());e.el.textContent=texto;gritos.push({e,quien,t0:reloj.t,dur});}
  const notas=[];function nota(desde,hasta,dur,alLlegar){const e=etiqueta('epNota',desde.clone());e.el.textContent=rnd()<.5?'♪':'♫';notas.push({e,desde:desde.clone(),hasta,dur,t0:reloj.t,alLlegar,fase:rnd()*TAU});}

  /* ---- Personajes -------------------------------------------------------------------------- */
  const DEF={
    goblin:{vida:48,dano:7,vel:3.7,alcance:1.05,aviso:.7,golpe:.18,recupera:.5,cd:1.2,forma:'cono',radio:2,ang:.85,globo:.3},
    glip:{vida:64,dano:7,vel:3.5,alcance:1.05,aviso:.75,golpe:.18,recupera:.5,cd:1.3,forma:'cono',radio:2,ang:.85,globo:0},
    arquero:{vida:36,dano:8,vel:3.2,alcance:12,aviso:1,golpe:.3,recupera:.7,cd:2.6,forma:'linea',largo:14,ancho:.7,globo:.3,lanza:true},
    jefe:{vida:60,dano:10,vel:0,alcance:0,aviso:1,golpe:.2,recupera:.5,cd:2,forma:'cono',radio:2,ang:.8,globo:0,jefe:true},
  };
  const HAB={torbellino:{coste:30,cd:0},salto:{coste:25,cd:5},provocar:{coste:0,cd:10},esquiva:{coste:0,cd:.55}};
  const hitboxMat=new THREE.MeshBasicMaterial({visible:false});
  let heroe=null,sigId=1;const enemigos=[],lanzas=[],globos=[],aliados={};
  function cuerpoDe(tipo){const m=MOD.crear(tipo);const e=m.escala||1,caja=new THREE.Mesh(new THREE.CylinderGeometry(m.radio*1.35/e,m.radio*1.35/e,m.alto*1.05/e,10).translate(0,m.alto*.52/e,0),hitboxMat);m.raiz.add(caja);m.caja=caja;escena.add(m.raiz);return m;}
  function crearHeroe(){const m=cuerpoDe('adreida');heroe={id:0,m,pos:new V3(-.6,0,2.4),dir:Math.PI,giro:0,estado:'quieto',t:0,alma:140,almaMax:140,furia:0,atqBase:12,atq:12,cd:{salto:0,provocar:0,esquiva:0},escudo:0,fase:0,paso:0,golpeo:false,tick:0,
    combo:0,finGolpe:-9,invul:0,vatq:1,dirEsq:new V3(),destello:0,dolor:1,vivo:true,objetivoSalto:null,origenSalto:null,radio:m.radio,muerteT:0,golpeDe:null,inspiracion:0,muertes:0};m.caja.userData.heroe=true;}
  function crearEnemigo(tipo,x,z,opc={}){const m=cuerpoDe(tipo),d=DEF[tipo],e={id:sigId++,tipo,m,d,pos:new V3(x,0,z),dir:rumbo(new V3(x,0,z),new V3(0,0,0)),vida:d.vida,vidaMax:d.vida,estado:opc.estado||'persigue',t:0,cd:.6+rnd()*.9,emp:new V3(),fase:rnd()*TAU,paso:0,
      destello:0,radio:m.radio,rodeo:(rnd()-.5)*1.6,provocado:0,ataques:0,ataque:null,alerta:null,aturdidoT:0,estrellas:null,culpableT:-9,escondite:opc.escondite||null,alto:0,embobadoHasta:0,inmune:!!opc.inmune};
    m.caja.userData.enemigo=e;m.raiz.position.copy(e.pos);m.raiz.visible=e.estado!=='oculto';enemigos.push(e);return e;}
  // Se puede pegar a los que están en pie y a la vista (no a los que ya caen, ni a Glip sin piernas, ni al jefe, fuera de alcance).
  const atacable=e=>!['muere','oculto','calcinado','partido','sinPiernas','salta'].includes(e.estado)&&!e.inmune;
  const enPie=e=>!['muere','calcinado','partido','sinPiernas'].includes(e.estado);

  /* ---- Globos de Alma (curan) y flechas de los arqueros --------------------------------------- */
  const geoGlobo=new THREE.IcosahedronGeometry(.22,1),matGlobo=new THREE.MeshStandardMaterial({color:0x400008,emissive:0xff2a3a,emissiveIntensity:2.2,roughness:.3});
  function globo(p){const m=new THREE.Mesh(geoGlobo,matGlobo);m.position.set(p.x,.5,p.z);escena.add(m);const a=rnd()*TAU;globos.push({m,pos:new V3(p.x,0,p.z),vel:new V3(Math.cos(a)*2,0,Math.sin(a)*2),t0:reloj.t});}
  function pasoGlobos(dt){for(const g of [...globos]){g.vel.multiplyScalar(Math.exp(-dt*4));g.pos.addScaledVector(g.vel,dt);const d=plano(g.pos,heroe.pos);
    const herida=heroe.vivo&&heroe.alma<heroe.almaMax;if(herida&&d<3.2){g.pos.lerp(heroe.pos,Math.min(1,dt*(3.2-d)*3));}
    g.m.position.set(g.pos.x,.45+Math.sin(reloj.t*3+g.t0)*.08,g.pos.z);g.m.rotation.y+=dt*2;
    if(herida&&d<1){const c=Math.round(heroe.almaMax*.2);heroe.alma=Math.min(heroe.almaMax,heroe.alma+c);numero(heroe.pos.clone().setY(2.2),'+'+c,'cura');chispas(g.m.position,16,[1,.25,.3],3,.4);escena.remove(g.m);globos.splice(globos.indexOf(g),1);}}}
  // Las flechas: astil, punta y plumas; siguen la línea que se dibujó.
  const geoAstil=new THREE.CylinderGeometry(.012,.012,.8,4).rotateX(Math.PI/2),geoPuntaF=new THREE.ConeGeometry(.03,.1,4).rotateX(Math.PI/2).translate(0,0,.45),geoPluma=new THREE.BoxGeometry(.08,.003,.12).translate(0,0,-.34);
  const matPuntaF=new THREE.MeshBasicMaterial({color:0xff7a40,toneMapped:false}),matPluma=std(0xe8e0d0);
  function flechaMalla(){const g=new THREE.Group();g.add(new THREE.Mesh(geoAstil,MAT.madera),new THREE.Mesh(geoPuntaF,matPuntaF));for(const r of [0,Math.PI/2]){const pl=new THREE.Mesh(geoPluma,matPluma);pl.rotation.z=r;g.add(pl);}g.traverse(o=>{o.castShadow=true;});return g;}
  function lanzar(e,a){const g=flechaMalla(),dir=frente(a.dir),p=e.pos.clone().setY(1);g.position.copy(p);g.lookAt(p.clone().add(dir));escena.add(g);lanzas.push({g,dir,vel:20,t0:reloj.t,dano:a.dano,clavada:0,e,origen:e.pos.clone(),radio:a.ancho/2});}
  function pasoLanzas(dt){for(const l of [...lanzas]){if(l.clavada){if(reloj.t-l.clavada>1.2){escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);}continue;}
    l.g.position.addScaledVector(l.dir,l.vel*dt);const p=l.g.position;
    if(heroe.vivo&&!l.pasada&&plano(p,heroe.pos)<heroe.radio*.6+l.radio&&p.y<2.2){if(heroe.invul>0){esquivado(l.e);l.pasada=true;}else{herir(l.dano,l.origen,enemigos.includes(l.e)?l.e:null);chispas(p,10,[1,.4,.3],4,.4);escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);continue;}}
    if(obstaculos.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r)||Math.abs(p.x)>ZONA.x+5||Math.abs(p.z)>ZONA.z+5||reloj.t-l.t0>2){l.clavada=reloj.t;chispas(p,5,[.8,.7,.6],2,.3);}}}

  /* ---- Colisiones --------------------------------------------------------------------------- */
  function dentroZona(p,r){for(const o of obstaculos){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),m=o.r+r;if(d<m&&d>1e-4){p.x=o.x+dx/d*m;p.z=o.z+dz/d*m;}}
    p.x=Math.max(-ZONA.x+r,Math.min(ZONA.x-r,p.x));p.z=Math.max(-ZONA.z+r,Math.min(ZONA.z-r,p.z));}
  function separar(){const todos=[heroe,...enemigos.filter(e=>enPie(e)&&e.estado!=='oculto'&&e.estado!=='huye'&&!e.inmune),...Object.values(aliados).filter(a=>!a.alto&&a.solido)];
    for(let i=0;i<todos.length;i++)for(let j=i+1;j<todos.length;j++){const a=todos[i],b=todos[j];if(a===heroe&&heroe.estado==='salto')continue;
      const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz),m=a.radio+b.radio;if(d<m&&d>1e-4){const k=(m-d)/d,wa=a===heroe?.15:a.aliado?.05:.5,wb=b===heroe?.15:b.aliado?.05:.5;a.pos.x-=dx*k*wa;a.pos.z-=dz*k*wa;b.pos.x+=dx*k*wb;b.pos.z+=dz*k*wb;}}}

  /* ---- Adreida: control a lo Hades (como en arpg-three) --------------------------------------- */
  const VEL=5.8,DUR_ESQ=.2,VEL_ESQ=17;
  const COMBO=[{dur:.6,imp:.3,alc:2.05,ang:1.1,mult:1,emp:1.4,anim:'tajoA'},{dur:.6,imp:.3,alc:2.05,ang:1.1,mult:1,emp:1.4,anim:'revesA'},{dur:.8,imp:.39,alc:2.7,ang:.5,mult:1.8,emp:3.8,anim:'estocadaA'}];
  const libre=()=>heroe.vivo&&(['quieto','andar'].includes(heroe.estado)||heroe.estado==='golpe'&&heroe.golpeo);
  function cambiar(e,s){e.estado=s;e.t=0;}
  const cercano=r=>enemigos.filter(e=>atacable(e)&&plano(e.pos,heroe.pos)<r).sort((a,b)=>plano(a.pos,heroe.pos)-plano(b.pos,heroe.pos))[0]||null;
  function puntoApuntado(){if(ctl.apunta)return ctl.apunta.clone();const e=cercano(7);return e?e.pos.clone():heroe.pos.clone().add(frente(heroe.dir).multiplyScalar(3));}
  function usar(h,punto){if(!heroe.vivo||!dir.control)return false;const H=HAB[h];
    if(h==='esquiva'){if(['salto','grito','esquiva','muerta'].includes(heroe.estado)||heroe.cd.esquiva>0)return false;
      const v=punto?punto.clone().setY(0):ctl.mov.lengthSq()>.01?ctl.mov.clone():frente(heroe.dir);heroe.dirEsq.copy(v.normalize());heroe.dir=rumbo(new V3(),heroe.dirEsq);
      heroe.cd.esquiva=H.cd;heroe.invul=DUR_ESQ+.1;heroe.esqDesde=heroe.pos.clone();cambiar(heroe,'esquiva');return true;}
    if(!libre())return false;if(heroe.furia<H.coste){rechazo(h,'Te falta Furia');return false;}if((heroe.cd[h]||0)>0){rechazo(h,'Aún no está lista');return false;}
    heroe.furia-=H.coste;if(H.cd)heroe.cd[h]=H.cd;
    if(h==='torbellino'){cambiar(heroe,'torbellino');heroe.tick=0;}
    if(h==='salto'){const p=punto?punto.clone():puntoApuntado(),d=plano(p,heroe.pos);if(d>8)p.sub(heroe.pos).multiplyScalar(8/d).add(heroe.pos);
      p.y=0;dentroZona(p,heroe.radio);heroe.origenSalto=heroe.pos.clone();heroe.objetivoSalto=p;heroe.dir=rumbo(heroe.pos,p);cambiar(heroe,'salto');heroe.golpeo=false;}
    if(h==='provocar'){cambiar(heroe,'grito');heroe.golpeo=false;}
    return true;}
  function rechazo(h,texto){const b=document.querySelector(`[data-hab="${h}"]`);if(b){b.classList.remove('no');void b.offsetWidth;b.classList.add('no');}tostada(texto,true);}
  function iniciarGolpe(){const h=heroe;ent.pendiente=false;h.combo=h.estado==='golpe'||reloj.t-h.finGolpe<.3?(h.combo+1)%3:0;h.dir=rumbo(h.pos,puntoApuntado());cambiar(h,'golpe');h.golpeo=false;}
  // Daño a un goblin. opc.adreida: lo hace ella (su primera muerte parte al goblin por la mitad; a Glip le corta las piernas).
  function danar(e,dano,opc={}){if(!atacable(e)&&e.estado!=='embobado')return;if(e.inmune)return;
    if(opc.adreida)heroe.ultimo=e;const crit=opc.crit??rnd()<.12;dano=Math.round(dano*(crit?1.8:1)*(.9+rnd()*.2)*(opc.adreida&&heroe.inspiracion>0?1.4:1));e.vida-=dano;e.destello=1;
    numero(e.pos.clone().setY(e.m.alto+.3),String(dano),crit?'critico':opc.clase||'dano');
    const lejosDe=(opc.desde||heroe.pos),dirE=e.pos.clone().sub(lejosDe).setY(0).normalize();e.emp.addScaledVector(dirE,(opc.empuje??1.6));
    if(e.tipo==='glip'&&e.vida<=0){if(opc.adreida){cortarPiernas(e);return;}e.vida=1;}
    if(e.vida<=0){if(opc.adreida){heroe.muertes++;if(!dir.hecho.has('partido')){partir(e);return;}}morir(e);return;}
    if(e.estado==='embobado')return;
    if(['persigue','aviso','recupera'].includes(e.estado)&&!opc.sinDolor){cancelarAtaque(e);cambiar(e,'dolor');}
    if(opc.aturde){cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=opc.aturde;}
    e.provocado=Math.max(e.provocado,.1);}
  function golpearEn(radio,arco,dano,opc){let n=0;const f=frente(heroe.dir);
    for(const e of [...enemigos]){if(!atacable(e)&&e.estado!=='embobado')continue;const d=plano(e.pos,heroe.pos);if(d>radio+e.radio)continue;
      if(arco<Math.PI){const v=e.pos.clone().sub(heroe.pos).setY(0).normalize();if(v.dot(f)<Math.cos(arco)&&d>e.radio+.3)continue;}
      danar(e,dano,{...opc,adreida:true});n++;const p=e.pos.clone().lerp(heroe.pos,.35).setY(1.1);chispas(p,opc?.chispas??10,[1,.75,.4],6,.45);}
    return n;}
  let paron=0;
  function herir(dano,desde,culpable){if(!heroe.vivo)return;dano=Math.round(dano*(heroe.escudo>0?.5:1));heroe.alma-=dano;heroe.destello=1;heroe.dolor=0;heroe.furia=Math.min(100,heroe.furia+dano*.7);
    numero(heroe.pos.clone().setY(2.3),String(dano),'recibido');temblar(.18);heroe.heridaT=reloj.t;heroe.golpeDe={desde:desde.clone(),t:reloj.t,id:culpable?.id??null};if(culpable)culpable.culpableT=reloj.t;
    if(heroe.alma<=0){heroe.alma=0;heroe.vivo=false;cambiar(heroe,'muerta');}}
  function esquivado(e){numero(heroe.pos.clone().setY(2.4),'¡Esquivado!','esquivado');heroe.furia=Math.min(100,heroe.furia+8);heroe.esquivados=(heroe.esquivados||0)+1;if(e)e.culpableT=reloj.t;}
  function pasoHeroe(dt){const h=heroe;h.t+=dt;for(const k in h.cd)h.cd[k]=Math.max(0,h.cd[k]-dt);h.escudo=Math.max(0,h.escudo-dt);h.invul=Math.max(0,h.invul-dt);h.destello=Math.max(0,h.destello-dt*5);h.dolor=Math.min(1,h.dolor+dt*4);
    h.inspiracion=Math.max(0,h.inspiracion-dt);h.vatq=1+(h.inspiracion>0?.15:0);
    let movido=0;const mov=ctl.mov;
    const andar=(v,vel)=>{if(v.lengthSq()<.01)return 0;const l=Math.min(1,v.length()),paso=vel*l*dt;h.pos.x+=v.x/v.length()*paso;h.pos.z+=v.z/v.length()*paso;return paso;};
    if(h.estado==='muerta'){h.muerteT+=dt;return;}
    if(['quieto','andar'].includes(h.estado)){movido=andar(mov,VEL);if(movido)h.dir+=difAng(h.dir,rumbo(new V3(),mov))*Math.min(1,dt*18);
      if(ctl.atacar)iniciarGolpe();else h.estado=movido>0?'andar':'quieto';}
    else if(h.estado==='golpe'){const C=COMBO[h.combo];h.t+=dt*(h.vatq-1);
      if(h.t<.1&&!enemigos.some(e=>atacable(e)&&plano(e.pos,h.pos)<C.alc*.6)){const f=frente(h.dir);h.pos.addScaledVector(f,(h.combo===2?9:5)*dt);}
      if(!h.golpeo&&h.t>=C.imp){h.golpeo=true;const n=golpearEn(C.alc,C.ang,h.atq*C.mult,{empuje:C.emp});if(n){h.furia=Math.min(100,h.furia+Math.min(14,n*7));paron=h.combo===2?.09:.05;temblar(h.combo===2?.14:.06);}}
      if(h.golpeo&&h.t>C.imp+.08&&mov.lengthSq()>.01&&!ctl.atacar){h.finGolpe=reloj.t;cambiar(h,'andar');}
      else if(h.t>=C.dur){h.finGolpe=reloj.t;if(ctl.atacar)iniciarGolpe();else{cambiar(h,'quieto');}}}
    else if(h.estado==='esquiva'){if(h.t<DUR_ESQ){h.pos.addScaledVector(h.dirEsq,VEL_ESQ*dt*(1-h.t/DUR_ESQ*.4));movido=1;
        if(rnd()<.9)particula(h.pos.x+(rnd()-.5)*.5,.3+rnd()*1.4,h.pos.z+(rnd()-.5)*.5,-h.dirEsq.x*2,.2,-h.dirEsq.z*2,.3,.9,.6,.9,1.3,0);}
      else cambiar(h,'quieto');}
    else if(h.estado==='torbellino'){const D=1.35;movido=andar(mov,4);if(movido)h.dir=rumbo(new V3(),mov);
      h.tick-=dt;if(h.tick<=0){h.tick=.2;const n=golpearEn(2.55,Math.PI,h.atq*.5,{empuje:1.1,crit:false,chispas:6});if(n)h.furia=Math.min(100,h.furia+n*1.5);}
      if(rnd()<.8){const a=rnd()*TAU;particula(h.pos.x+Math.cos(a)*2,1+rnd()*.3,h.pos.z+Math.sin(a)*2,-Math.sin(a)*6,.3,Math.cos(a)*6,.25,.5,2.2,1.6,1.2,0);}
      if(h.t>=D)cambiar(h,'quieto');}
    else if(h.estado==='salto'){const D=.72,k=Math.min(1,h.t/D),m=tramo(k,.12,.86);h.pos.lerpVectors(h.origenSalto,h.objetivoSalto,m);h.alto=Math.sin(Math.PI*m)*2.4;h.invul=Math.max(h.invul,k<.86?.05:0);
      if(!h.golpeo&&k>=.86){h.golpeo=true;h.alto=0;golpearEn(3.2,Math.PI,h.atq*1.7,{empuje:4.5,aturde:1.1,chispas:14});marca('onda',h.pos.x,h.pos.z,4.2,0xffb050,.5);polvo(h.pos,30,2);chispas(h.pos.clone().setY(.3),30,[1,.7,.35],8,.5);temblar(.5);paron=.08;}
      if(h.t>=D){cambiar(h,'quieto');h.alto=0;}}
    else if(h.estado==='grito'){if(!h.golpeo&&h.t>=.18){h.golpeo=true;h.escudo=4;h.furia=Math.min(100,h.furia+35);marca('onda',h.pos.x,h.pos.z,10,0xffd070,.7);chispas(h.pos.clone().setY(1.4),40,[1,.85,.4],7,.5);temblar(.2);
        for(const e of enemigos){if(!atacable(e))continue;const d=plano(e.pos,h.pos);if(d<10){e.provocado=3.5;e.tirón={p:e.pos.clone().lerp(h.pos,Math.min(.5,1.6/Math.max(d,.1))),hasta:reloj.t+.35};}}}
      if(h.t>=.7)cambiar(h,'quieto');}
    h.fase+=movido*TAU/1.75;h.paso+=((movido>0&&h.estado!=='esquiva'?1:0)-h.paso)*Math.min(1,dt*10);dentroZona(h.pos,h.radio);}

  /* ---- Ataques de los goblins: la zona exacta en el suelo, que se llena hasta el golpe ------------------ */
  function matZona(forma){const m=matMarca(forma);m.blending=THREE.NormalBlending;return m;}
  function empezarAtaque(e,forma,o){const a={forma,dur:o.dur,t0:reloj.t,dir:e.dir,radio:o.radio,ang:o.ang,largo:o.largo,ancho:o.ancho,centro:o.centro||null,fija:o.fija??.6,dano:o.dano,fijado:false};
    const m=new THREE.Mesh(forma==='linea'?geoLinea:geoMarca,matZona(forma));m.renderOrder=1;m.material.uniforms.uC.value.set(0xff6a20);if(forma==='cono')m.material.uniforms.uAng.value=a.ang;escena.add(m);a.m=m;
    e.ataque=a;if(!e.alerta){e.alerta=etiqueta('apAlerta',new V3());e.alerta.el.textContent='!';}colocarAtaque(e);return a;}
  function colocarAtaque(e){const a=e.ataque,m=a.m,k=Math.min(1,(reloj.t-a.t0)/a.dur),u=m.material.uniforms;
    m.position.set(e.pos.x,.05,e.pos.z);m.rotation.y=a.dir;if(a.forma==='cono')m.scale.setScalar(a.radio);else m.scale.set(a.ancho,1,a.largo);
    u.uP.value=k;u.uF.value=a.fijado?1:0;u.uC.value.setRGB(a.fijado?1:.95,a.fijado?.06:.22,a.fijado?.03:.05);u.uA.value=(a.fijado?.95:.7)+.05*Math.sin(reloj.t*(a.fijado?38:14));
    e.alerta.pos.set(e.pos.x,e.m.alto+.55,e.pos.z);e.alerta.el.classList.toggle('fijado',a.fijado);e.alerta.el.style.setProperty('--k',k.toFixed(2));}
  function cancelarAtaque(e){if(e.ataque){escena.remove(e.ataque.m);e.ataque.m.material.dispose();e.ataque=null;}if(e.alerta){quitarEtiqueta(e.alerta);e.alerta=null;}}
  function enZona(a,e,p,margen){const o=e.pos,dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);const fx=Math.sin(a.dir),fz=Math.cos(a.dir);
    if(a.forma==='cono'){if(d>a.radio+margen)return false;if(d<e.radio+margen)return true;return Math.acos(Math.max(-1,Math.min(1,(dx*fx+dz*fz)/d)))<a.ang+Math.asin(Math.min(1,margen/d));}
    const largo=dx*fx+dz*fz,lado=Math.abs(-dx*fz+dz*fx);return largo>-margen&&largo<a.largo&&lado<a.ancho/2+margen;}
  function resolverAtaque(e){const a=e.ataque,H=heroe;cambiar(e,'golpe');e.ataques++;
    if(a.forma==='linea')lanzar(e,a);
    else{const dentro=enZona(a,e,H.pos,H.radio*.6);if(H.vivo&&H.invul>0&&(dentro||H.esqDesde&&enZona(a,e,H.esqDesde,H.radio*.6)))esquivado(e);else if(H.vivo&&dentro)herir(a.dano,e.pos,e);}
    cancelarAtaque(e);}
  function pasoEnemigo(e,dt){const d=e.d;e.t+=dt;e.destello=Math.max(0,e.destello-dt*9);e.provocado=Math.max(0,e.provocado-dt);e.cd-=dt;
    e.pos.addScaledVector(e.emp,dt);e.emp.multiplyScalar(Math.exp(-dt*7));
    if(e.tirón){e.pos.lerp(e.tirón.p,Math.min(1,dt*8));if(reloj.t>e.tirón.hasta||plano(e.pos,e.tirón.p)<.05)e.tirón=null;}
    const H=heroe,dist=plano(e.pos,H.pos),hacia=(p,vel)=>{const dd=plano(p,e.pos);if(dd<.05)return 0;const paso=Math.min(dd,vel*dt),a=rumbo(e.pos,p);e.dir+=difAng(e.dir,a)*Math.min(1,dt*9);e.pos.x+=Math.sin(a)*paso;e.pos.z+=Math.cos(a)*paso;return paso;};
    let movido=0;const vel=d.vel*(e.provocado>0?1.25:1);e.alto=0;
    switch(e.estado){
      case 'oculto':break;
      // Salta fuera del arbusto hacia el camino.
      case 'salta':{const k=Math.min(1,e.t/.5);e.pos.lerpVectors(e.desde,e.hasta,k);e.alto=Math.sin(Math.PI*k)*1.1;e.dir=rumbo(e.desde,e.hasta);movido=.1;if(k>=1){cambiar(e,'persigue');polvo(e.pos,6,.6);}break;}
      // El jefe da órdenes desde los arbustos, fuera de tu alcance.
      case 'ordena':e.dir+=difAng(e.dir,rumbo(e.pos,H.pos))*Math.min(1,dt*3);if(e.t>2.6){e.t=0;gritar(e,['¡A por ellos!','¡Rápido, inútiles!','¡La carreta es nuestra!','¡Quiero ese oro!'][Math.floor(rnd()*4)],'goblin');e.grita=reloj.t;}break;
      case 'embobado':{const g=ilusionEstado.gato;if(g)e.dir+=difAng(e.dir,rumbo(e.pos,g.pos))*Math.min(1,dt*4);if(reloj.t>e.embobadoHasta){cambiar(e,'persigue');e.cd=.8;}break;}
      // Huye hacia el bosque: más rápido que Adreida (Rafaela lo alcanza).
      case 'huye':movido=hacia(e.salida,6.2);break;
      // Sin piernas: se arrastra despacio, lejos de Adreida.
      case 'sinPiernas':if(e.t<5)movido=hacia(e.pos.clone().add(e.pos.clone().sub(H.pos).setY(0).normalize()),.35);break;
      case 'persigue':{if(!H.vivo||!dir.control){movido=hacia(e.pos.clone().multiplyScalar(1.02),vel*.3);break;}
        if(d.lanza){const lejosV=e.pos.clone().sub(H.pos).setY(0).normalize();if(dist>9||e.provocado)movido=hacia(H.pos,vel);else if(dist<5)movido=hacia(e.pos.clone().addScaledVector(lejosV,2),vel*.9);
          else{const lado=new V3(-lejosV.z,0,lejosV.x).multiplyScalar(e.rodeo>0?1:-1);movido=hacia(e.pos.clone().addScaledVector(lado,1.5),vel*.45);}
          if(e.cd<=0&&dist<d.alcance){e.dir=rumbo(e.pos,H.pos);cambiar(e,'aviso');empezarAtaque(e,'linea',{dur:d.aviso,largo:d.largo,ancho:d.ancho,fija:.65,dano:d.dano});}break;}
        const a=rumbo(H.pos,e.pos)+e.rodeo*Math.min(1,Math.max(0,dist-2)/4),radio=H.radio+e.radio+d.alcance*.55;
        const obj=dist>2.8?H.pos.clone().add(frente(a).multiplyScalar(Math.min(dist,2.4))):H.pos.clone().add(frente(rumbo(H.pos,e.pos)).multiplyScalar(radio));
        movido=hacia(obj,vel);const atacan=enemigos.filter(o=>o!==e&&!o.d.lanza&&['aviso','golpe'].includes(o.estado)).length;
        if(dist<H.radio+e.radio+d.alcance+.2&&e.cd<=0&&atacan<2){e.dir=rumbo(e.pos,H.pos);cambiar(e,'aviso');empezarAtaque(e,'cono',{dur:d.aviso,radio:d.radio,ang:d.ang,fija:.5,dano:d.dano});}
        break;}
      case 'aviso':{const a=e.ataque;if(!a){cambiar(e,'persigue');break;}const k=(reloj.t-a.t0)/a.dur;
        if(!a.fijado&&k<a.fija){e.dir+=difAng(e.dir,rumbo(e.pos,H.pos))*Math.min(1,dt*(d.lanza?5:3.5));a.dir=e.dir;}else a.fijado=true;
        colocarAtaque(e);if(k>=1)resolverAtaque(e);break;}
      case 'golpe':if(e.t>=d.golpe){cambiar(e,'recupera');}break;
      case 'recupera':if(e.t>=d.recupera){e.cd=d.cd*(.8+rnd()*.4);cambiar(e,'persigue');}break;
      case 'dolor':if(e.t>=.28){e.cd=Math.max(e.cd,.35);cambiar(e,'persigue');}break;
      case 'aturdido':e.aturdidoT-=dt;if(e.aturdidoT<=0){cambiar(e,'persigue');}break;
      case 'muere':{if(e.t>.55){const k=(e.t-.55)/.9;e.m.M.u.uDisuelve.value=Math.min(1,k);if(k>.02)e.m.mallas.forEach(x=>x.castShadow=false);if(rnd()<.6)brasas(e.pos,1,e.m.alto);
          if(k>=1)quitarEnemigo(e);}break;}
      // Calcinado: negro, humeante; se deshace en ceniza.
      case 'calcinado':{e.m.M.u.uDestello.value=Math.min(1,e.t*3);e.m.M.u.uColorD.value.setRGB(.035,.025,.02);if(rnd()<.7)humo(e.pos.x+(rnd()-.5)*.4,.6+rnd()*e.m.alto*.8,e.pos.z+(rnd()-.5)*.4,(rnd()-.5)*.4,1.2+rnd(),(rnd()-.5)*.4,1.4+rnd(),1+rnd(),.08,.07,.07,.55);
        if(rnd()<.5)brasas(e.pos,1,e.m.alto);if(e.t>1.5){const k=(e.t-1.5)/1;e.m.M.u.uDisuelve.value=Math.min(1,k);e.m.mallas.forEach(x=>x.castShadow=false);if(k>=1)quitarEnemigo(e);}break;}
      // Partido por la mitad: las dos mitades se separan y caen, y se deshacen.
      case 'partido':pasoPartido(e);break;
    }
    e.fase+=movido*TAU/(e.m.alto*.95);e.paso+=((movido>.02?1:0)-e.paso)*Math.min(1,dt*10);
    if(['persigue','aviso','golpe','recupera','dolor','aturdido','embobado'].includes(e.estado)&&!e.inmune)dentroZona(e.pos,e.radio);}
  function quitarEnemigo(e){escena.remove(e.m.raiz);if(e.mitad)escena.remove(e.mitad.raiz);const i=enemigos.indexOf(e);if(i>=0)enemigos.splice(i,1);}
  function morir(e){cancelarAtaque(e);cambiar(e,'muere');e.vida=0;brasas(e.pos,14,e.m.alto);if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}if(rnd()<e.d.globo)globo(e.pos);}
  function calcinar(e,porRafaela){cancelarAtaque(e);e.inmune=false;cambiar(e,'calcinado');e.vida=0;e.m.M.u.uBorde.value=0;brasas(e.pos,24,e.m.alto);chispas(e.pos.clone().setY(1),24,[1,.5,.15],5,.5);numero(e.pos.clone().setY(e.m.alto+.4),'¡Calcinado!','historia',1.4);
    if(e.tipo==='jefe')marcar('manos');if(e.fugitivo&&porRafaela)marcar('fugitivo');}
  // Partir por la mitad: el goblin se abre en dos (planos de recorte); la otra mitad es una copia en la misma pose.
  function partir(e){cancelarAtaque(e);cambiar(e,'partido');e.vida=0;const otra=MOD.crear(e.tipo);escena.add(otra.raiz);e.mitad=otra;
    const pose={anim:'dolor',k:.2,t:reloj.t};MOD.posar(e.m,pose);MOD.posar(otra,pose);e.lado=frente(heroe.dir+Math.PI/2);
    for(const m of [e.m,otra]){m.M.u.uDestello.value=0;m.M.u.uBorde.value=0;}
    const qi=new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),e.dir).invert();e.nLocal=[e.lado.clone().applyQuaternion(qi),e.lado.clone().negate().applyQuaternion(qi)];
    e.planos=[new THREE.Plane(),new THREE.Plane()];[[e.m,0],[otra,1]].forEach(([m,i])=>m.mallas.forEach(x=>{x.material.clippingPlanes=[e.planos[i]];x.material.side=THREE.DoubleSide;x.material.needsUpdate=true;}));
    for(let i=0;i<40;i++)particula(e.pos.x,.7+rnd()*.6,e.pos.z,(rnd()-.5)*5,1+rnd()*3,(rnd()-.5)*5,.5+rnd()*.5,.4+rnd()*.3,1.4,.08,.05,12);
    temblar(.35);paron=.14;numero(e.pos.clone().setY(e.m.alto+.5),'¡Partido en dos!','historia',1.6);marcar('partido');
    decir('Narrador','¡Adreida se lanza con su hacha y <em>parte a un goblin por la mitad</em>!',3.2,true);}
  // Cada mitad se aparta hacia su lado y cae hacia fuera (gira sobre el eje horizontal perpendicular al corte);
  // su plano de recorte va con ella (definido en su espacio) y se queda con su lado del cuerpo.
  function pasoPartido(e){const k=Math.min(1,e.t/.7),s=suave(k),L=e.lado,eje=new V3(L.z,0,-L.x),qY=new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),e.dir);
    [[e.m,1],[e.mitad,-1]].forEach(([m,sg],i)=>{m.raiz.position.set(e.pos.x+L.x*sg*.45*s,0,e.pos.z+L.z*sg*.45*s);m.raiz.quaternion.setFromAxisAngle(eje,sg*1.25*s).multiply(qY);m.raiz.updateMatrixWorld(true);
      e.planos[i].setFromNormalAndCoplanarPoint(e.nLocal[i].clone().applyQuaternion(m.raiz.quaternion),m.raiz.position);});
    if(e.t>1.3){const d=Math.min(1,(e.t-1.3)/.8);e.m.M.u.uDisuelve.value=e.mitad.M.u.uDisuelve.value=d;if(d>=1)quitarEnemigo(e);}}
  // Cortarle las piernas a Glip: las espinillas desaparecen (el hueso de la rodilla se encoge) y caen dos piernas al suelo.
  const piezasSueltas=[];
  function cortarPiernas(e){cancelarAtaque(e);cambiar(e,'sinPiernas');e.vida=1;e.m.H.rodillaI.scale.setScalar(.001);e.m.H.rodillaD.scale.setScalar(.001);
    for(const s of [-1,1]){const g=new THREE.Group(),piel=std(0x7a8943),bota=std(0x3d2c20);const pa=new THREE.Mesh(new THREE.CapsuleGeometry(.05,.16,2,6),piel),bo=new THREE.Mesh(new THREE.BoxGeometry(.1,.12,.15),bota);pa.position.set(0,.12,0);bo.position.set(0,-.04,.02);g.add(pa,bo);
      g.traverse(o=>{o.castShadow=true;});g.position.set(e.pos.x+s*.1,.35,e.pos.z);escena.add(g);const a=e.dir+s*1.2+rnd()*.5;piezasSueltas.push({g,vel:new V3(Math.sin(a)*2.2,3.2,Math.cos(a)*2.2),giro:new V3(rnd()*8,rnd()*8,rnd()*8)});}
    for(let i=0;i<24;i++)particula(e.pos.x,.4,e.pos.z,(rnd()-.5)*4,1+rnd()*2,(rnd()-.5)*4,.5+rnd()*.4,.35,1.3,.1,.05,12);
    temblar(.25);numero(e.pos.clone().setY(1.6),'¡Sin piernas!','historia',1.5);marcar('piernas');
    decir('Glip','¡Mis piernas! ¡Me llamo Glip, no me mates, no me mates!',2.6);
    decir('Narrador','Adreida le corta las piernas a Glip. Sobrevivirá… y algún día lo llamarán <em>Machete</em>.',3.6,true);}
  function pasoPiezas(dt){for(const p of piezasSueltas){if(p.quieta)continue;p.vel.y-=14*dt;p.g.position.addScaledVector(p.vel,dt);p.g.rotation.x+=p.giro.x*dt;p.g.rotation.y+=p.giro.y*dt;p.g.rotation.z+=p.giro.z*dt;
    if(p.g.position.y<.06&&p.vel.y<0){p.g.position.y=.06;p.vel.multiplyScalar(.3);p.vel.y=0;p.g.rotation.x=Math.PI/2;p.g.rotation.z=0;if(p.vel.length()<.2)p.quieta=true;}}}

  /* ---- El grupo: Mohamed, Fender, Talesin y Rafaela, con su guion ----------------------------------
     Cada uno sigue un plan: una cola de pasos {ir}, {arco} (saltos), {anim} (con momentos en los que pasa
     algo) y {bucle} (una pose que se queda). El director les da los planes; Mohamed, tras caer del árbol,
     pelea por su cuenta. */
  const GRUPO={mohamed:{x:2.6,z:1.6,nombre:'Mohamed'},fender:{x:.9,z:1.25,nombre:'Fender'},talesin:{x:-2.4,z:1.3,nombre:'Talesin'},rafaela:{x:-4,z:.4,nombre:'Rafaela'}};
  function crearAliado(tipo){const g=GRUPO[tipo],m=MOD.crear(tipo);escena.add(m.raiz);const a={tipo,m,aliado:true,solido:true,pos:new V3(g.x,0,g.z),dir:Math.PI,plan:[{bucle:'quieto'}],paso:0,fase:rnd()*TAU,t:0,alto:0,radio:m.radio,estado:'De camino al Domo',anim:'quieto',k:0,cd:0};aliados[tipo]=a;return a;}
  function planear(a,pasos){a.plan=pasos;a.t=0;a.paso0=null;}
  const pos2=v=>Array.isArray(v)?new V3(v[0],0,v[1]):v.pos?v.pos.clone().setY(0):v.clone().setY(0);
  function pasoAliado(a,dt){const p=a.plan[0];let movido=0;a.t+=dt;a.cd=Math.max(0,a.cd-dt);
    const hacia=(dest,vel)=>{const d=plano(dest,a.pos);if(d<.05)return 0;const paso=Math.min(d,vel*dt),r=rumbo(a.pos,dest);a.dir+=difAng(a.dir,r)*Math.min(1,dt*10);a.pos.x+=Math.sin(r)*paso;a.pos.z+=Math.cos(r)*paso;return paso;};
    if(!p){if(a.lucha)luchaMohamed(a);else a.plan=[{bucle:'quieto'}];return;}
    const siguiente=()=>{a.plan.shift();a.t=0;a.paso0=null;};
    if(p.mirar){const m=typeof p.mirar==='function'?p.mirar():pos2(p.mirar);if(m)a.dir+=difAng(a.dir,rumbo(a.pos,m))*Math.min(1,dt*8);}
    if(p.ir){a.anim=p.pose||'andar';movido=hacia(pos2(p.ir),p.vel||3.2);if(plano(a.pos,pos2(p.ir))<.06){a.pos.copy(pos2(p.ir));siguiente();}}
    else if(p.sigue){const obj=p.sigue;if(!enPie(obj)||obj.estado==='calcinado'){a.plan=[];return;}a.anim='andar';movido=hacia(obj.pos,p.vel);if(plano(a.pos,obj.pos)<p.dist)siguiente();}
    else if(p.arco){if(!a.paso0){a.paso0={desde:a.pos.clone(),y0:a.alto};}const k=Math.min(1,a.t/p.dur),hasta=typeof p.arco.hasta==='function'?p.arco.hasta():pos2(p.arco.hasta);
      a.pos.lerpVectors(a.paso0.desde,hasta,suave(k)*.6+k*.4);a.alto=a.paso0.y0+((p.arco.y??0)-a.paso0.y0)*k+Math.sin(Math.PI*k)*(p.arco.alto||1);a.dir+=difAng(a.dir,rumbo(a.paso0.desde,hasta))*Math.min(1,dt*10);
      a.anim=p.pose;a.k=k;for(const [t,f] of p.en||[])if(a.t-dt<t*p.dur&&a.t>=t*p.dur)f();if(k>=1)siguiente();}
    else if(p.anim){a.anim=p.anim;a.k=Math.min(1,a.t/p.dur);for(const [t,f] of p.en||[])if(a.t-dt<t*p.dur&&a.t>=t*p.dur)f();if(a.t>=p.dur)siguiente();}
    else if(p.bucle){a.anim=p.bucle;a.k=0;for(const [t,f] of p.en||[])if(a.t-dt<t&&a.t>=t)f();}
    a.fase+=movido*TAU/1.7;a.paso+=((movido>0?1:0)-a.paso)*Math.min(1,dt*10);}
  // Mohamed, ya en el suelo: va a por el goblin más cercano y lo golpea con el bastón (deja a Glip y al fugitivo para Adreida y Rafaela).
  function luchaMohamed(a){const objs=enemigos.filter(e=>atacable(e)&&e.tipo!=='glip'&&!e.fugitivo&&e.estado!=='huye');if(objs.length<2||a.cd>0){a.anim='quieto';return;}
    const e=objs.sort((x,y)=>plano(x.pos,a.pos)-plano(y.pos,a.pos))[0];
    planear(a,[{sigue:e,vel:4.6,dist:1.3},{anim:'golpe',dur:.55,mirar:()=>e.pos,en:[[.5,()=>{if(atacable(e)||e.estado==='embobado'){danar(e,14,{desde:a.pos,clase:'magia'});chispas(e.pos.clone().setY(1),8,[.9,.8,1],4,.4);}a.cd=1.4;}]]}]);}

  /* ---- Magia y trucos del grupo ---------------------------------------------------------------- */
  const efectosVivos=[];// rayos, dardos y la gata: cosas que duran un rato
  const geoRayo=new THREE.CylinderGeometry(1,1,1,10,1,true).rotateX(Math.PI/2).translate(0,0,.5);
  const matRayo=c=>new THREE.ShaderMaterial({uniforms:{uA:{value:1},uC:{value:new THREE.Color(c)},uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uA,uT;uniform vec3 uC;varying vec2 vUv;void main(){float n=.6+.4*sin(vUv.y*60.-uT*50.);gl_FragColor=vec4(uC*2.2*n,uA*.85);}'});
  function rayo(desde,hasta,color,dur,grosor=.09){const m=new THREE.Mesh(geoRayo,matRayo(color));m.position.copy(desde);m.lookAt(hasta);m.scale.set(grosor,grosor,desde.distanceTo(hasta));m.renderOrder=3;escena.add(m);
    efectosVivos.push({m,t0:reloj.t,dur,paso(k){m.material.uniforms.uA.value=1-k;m.scale.x=m.scale.y=grosor*(1+k*1.5);}});}
  const mano=(a,alto=1.25)=>a.pos.clone().add(frente(a.dir).multiplyScalar(.45)).setY(alto+a.alto);
  // Manos ardientes: un abanico de fuego desde las manos hacia el objetivo.
  function manosArdientes(a,objetivo,alFin){const o=mano(a,1.15),dirF=objetivo.pos.clone().sub(a.pos).setY(0).normalize();let hecho=false;
    efectosVivos.push({t0:reloj.t,dur:.9,paso(k){for(let i=0;i<14;i++){const ang=(rnd()-.5)*.8,d=dirF.clone().applyAxisAngle(new V3(0,1,0),ang),v=6+rnd()*5;
        particula(o.x,o.y,o.z,d.x*v,(rnd()-.3)*1.5,d.z*v,.35+rnd()*.25,.6+rnd()*.5,1+rnd()*.3,.35+rnd()*.3,.05,-1.5);}
      if(!hecho&&k>.3){hecho=true;alFin&&alFin();}}});
    marca('onda',o.x+dirF.x*1.5,o.z+dirF.z*1.5,3,0xff8a30,.5);}
  // Proyectil mágico: tres dardos de luz que buscan a sus objetivos en curva.
  const geoDardo=new THREE.IcosahedronGeometry(.11,1),matDardo=new THREE.MeshBasicMaterial({color:0xd8c8ff,toneMapped:false});
  function dardo(desde,e,retraso,dano){const m=new THREE.Mesh(geoDardo,matDardo);m.position.copy(desde);m.visible=false;escena.add(m);const curva=new V3((rnd()-.5)*4,2+rnd()*1.5,(rnd()-.5)*4);
    efectosVivos.push({m,t0:reloj.t+retraso,dur:.75,paso(k){if(k<0)return;m.visible=true;const hasta=e.pos.clone().setY(1),c=desde.clone().lerp(hasta,.5).add(curva),u=1-k;
      m.position.set(u*u*desde.x+2*u*k*c.x+k*k*hasta.x,u*u*desde.y+2*u*k*c.y+k*k*hasta.y,u*u*desde.z+2*u*k*c.z+k*k*hasta.z);particula(m.position.x,m.position.y,m.position.z,0,0,0,.35,.5,1.4,1.1,2.4,0);},
      fin(){escena.remove(m);if(enPie(e)&&e.estado!=='oculto'){danar(e,dano,{desde:desde,clase:'magia',sinDolor:false,crit:false});chispas(e.pos.clone().setY(1),14,[.75,.6,1],5,.45);}}});}
  // Ilusión menor: una gata violeta y translúcida que baila bachata; los goblins se quedan embobados mirándola.
  const ilusionEstado={gato:null};
  function aparecerGata(p){const m=MOD.crear('gato');escena.add(m.raiz);m.raiz.position.copy(p);m.raiz.scale.setScalar(1.35);
    for(const x of m.mallas){x.material.transparent=true;x.material.opacity=.78;x.castShadow=false;}m.M.u.uBorde.value=.9;m.M.u.uColorB.value.setRGB(.7,.35,1);
    const g={m,pos:p.clone(),t0:reloj.t};ilusionEstado.gato=g;chispas(p.clone().setY(.8),40,[.8,.5,1],5,.5);marca('onda',p.x,p.z,3,0xb080ff,.8);
    efectosVivos.push({t0:reloj.t,dur:9,paso(k){const t=reloj.t-g.t0;MOD.posar(m,{anim:'bailar',t});m.raiz.rotation.y=Math.sin(t*.8)*.6;m.M.u.uDisuelve.value=k>.9?Math.min(1,(k-.9)*10):Math.max(0,1-t*2);
        if(rnd()<.12)nota(p.clone().setY(1.6),p.clone().add(new V3((rnd()-.5)*2,2.8,(rnd()-.5)*2)),1.4);if(rnd()<.3)particula(p.x+(rnd()-.5)*1.2,.2+rnd()*1.5,p.z+(rnd()-.5)*1.2,0,.6,0,.6,.4,1.2,.7,2,0);},
      fin(){escena.remove(m.raiz);ilusionEstado.gato=null;}});}
  function pasoEfectos(){for(const f of [...efectosVivos]){const k=(reloj.t-f.t0)/f.dur;f.paso&&f.paso(Math.min(1,k));if(k>=1){if(f.m&&!f.fin)escena.remove(f.m);f.fin&&f.fin();efectosVivos.splice(efectosVivos.indexOf(f),1);}}
    for(const n of [...notas]){const k=Math.min(1,(reloj.t-n.t0)/n.dur),hasta=typeof n.hasta==='function'?n.hasta():n.hasta;n.e.pos.lerpVectors(n.desde,hasta,suave(k));n.e.pos.y+=Math.sin(k*Math.PI)*.8+Math.sin(reloj.t*6+n.fase)*.1;n.e.el.style.opacity=String(Math.min(1,(1-k)*4));
      if(k>=1){quitarEtiqueta(n.e);notas.splice(notas.indexOf(n),1);n.alLlegar&&n.alLlegar();}}
    for(const g of [...gritos]){const s=reloj.t-g.t0,q=g.quien;g.e.pos.set(q.pos.x,(q.m?.alto||1.6)+.9+(q.alto||0)+s*.2,q.pos.z);g.e.el.style.opacity=String(Math.min(1,(g.dur-s)*3));if(s>g.dur){quitarEtiqueta(g.e);gritos.splice(gritos.indexOf(g),1);}}}

  /* ---- La escena: el director sigue la historia paso a paso -------------------------------------- */
  const CRONICA=[['flecha','Una flecha alcanza a Talesin en el hombro.'],['rayo','Talesin lanza un Rayo de fuego… y falla por el dolor.'],['inspiracion','Fender se refugia bajo la carreta y canta sobre goblins vaqueros: Inspiración bárdica.'],
    ['acrobacias','Mohamed salta a los árboles con acrobacias.'],['manos','Rafaela calcina al líder goblin con Manos ardientes.'],['partido','Adreida parte a un goblin por la mitad.'],['misiles','Talesin reparte dardos de luz: Proyectil mágico.'],
    ['ilusion','Fender proyecta una gata que baila bachata (Ilusión menor): los goblins se emboban.'],['caida','Mohamed cae desde las alturas sobre un goblin.'],['piernas','Adreida le corta las piernas a Glip.'],['fugitivo','Rafaela remata al último fugitivo con Manos ardientes.']];
  const dir={t:0,i:0,hecho:new Map(),control:false,cine:true,fin:null};
  function marcar(id){if(!dir.hecho.has(id))dir.hecho.set(id,reloj.t);}
  const desde=id=>dir.hecho.has(id)?reloj.t-dir.hecho.get(id):-1;
  const goblinsEnPie=()=>enemigos.filter(e=>enPie(e)&&e.tipo!=='jefe'&&e.tipo!=='glip');
  const glipResuelto=()=>!enemigos.some(e=>e.tipo==='glip'&&enPie(e));
  const esc_=id=>escondites.find(s=>s.id===id);
  function preparar_(){for(const s of escondites){const e=crearEnemigo(s.tipo,s.x,s.z,{estado:'oculto',escondite:s,inmune:s.tipo==='jefe'});s.e=e;e.dir=rumbo(e.pos,CARRETA);}
    // El grupo recién bajado de la carreta, de cara al camino (hacia la cámara).
    for(const t of Object.keys(GRUPO))crearAliado(t);aliados.talesin.dir=.5;aliados.fender.dir=-.3;aliados.mohamed.dir=-.6;aliados.rafaela.dir=.7;heroe.dir=.2;}
  // Sale la escuadra: cada goblin salta de su arbusto hacia el camino; el jefe se queda gritando órdenes.
  function revelar(tanda=1){for(const s of escondites){if((s.tanda||1)!==tanda)continue;const e=s.e;s.agita=1;hojas(new V3(s.x,0,s.z),26);e.m.raiz.visible=true;
    if(e.tipo==='jefe'){e.pos.set(s.x,0,s.z-.6);cambiar(e,'ordena');gritar(e,'¡Al ataque, escuadra!','goblin',2.2);continue;}
    const hacia=new V3(s.x*.8,0,s.z-Math.sign(s.z)*2.6);dentroZona(hacia,.4);e.desde=e.pos.clone();e.hasta=hacia;cambiar(e,'salta');}
    const quien=escondites.find(s=>(s.tanda||1)===tanda&&s.tipo!=='jefe').e;gritar(quien,['¡Iiiiija!','¡Más goblins, más oro!','¡Glip al ataque!'][tanda-1],'goblin',1.8);}
  function romperRueda(){rueda.t0=reloj.t;rueda.desde=rueda.w.position.clone();const p=rueda.w.getWorldPosition(new V3());polvo(p,26,1.2);chispas(p.clone().setY(.6),16,[.9,.7,.4],3,.4);numero(p.clone().setY(1.6),'¡CRAC!','historia',1.4);temblar(.3);}
  function pasoRueda(){if(rueda.t0<0)return;const k=Math.min(1,(reloj.t-rueda.t0)/.55),s=suave(k);carreta.rotation.set(.09*s,0,.075*s);carreta.position.y=-.07*s;
    rueda.w.position.set(rueda.desde.x-.2*s,.55-.49*s,rueda.desde.z+.55*s);rueda.w.rotation.set(Math.PI/2+1.45*s,0,.5*s);}
  function flechaTalesin(){const A=esc_('arqueroA'),T=aliados.talesin,desde=new V3(A.x,1.1,A.z),hasta=()=>T.pos.clone().setY(1.45),g=flechaMalla();g.position.copy(desde);escena.add(g);hojas(new V3(A.x,0,A.z),8);A.agita=.7;
    efectosVivos.push({m:g,t0:reloj.t,dur:.42,paso(k){const h=hasta();g.position.lerpVectors(desde,h,k);g.lookAt(h);},fin(){
      // Se queda clavada en el hombro de Talesin.
      T.m.H.brazoI.add(g);g.position.set(-.02,-.04,.02);g.rotation.set(-.4,.3,0);g.scale.setScalar(.9);
      chispas(hasta(),10,[1,.3,.3],3,.35);numero(hasta().setY(2.1),'¡Flecha!','recibido');planear(T,[{anim:'dolor',dur:.4},{bucle:'herido'}]);T.estado='Herido en el hombro';T.herido=true;marcar('flecha');
      decir('Talesin','¡Aaah! ¡Una flecha… en el hombro!',2.2);}});}
  // Paso a paso (tiempo desde la rueda, o lo que tenga que pasar antes). Los que tienen «saltar» no bloquean.
  const GUION=[
    {id:'rueda',cuando:()=>dir.t>=.7,hacer(){romperRueda();decir('Narrador','Camino al Domo, reclutados en Waterdeep, el grupo viaja en carreta… hasta que una rueda se parte.',3.4,true);}},
    {id:'flecha',cuando:()=>dir.t>=3.9,hacer(){flechaTalesin();}},
    {id:'emboscada',cuando:()=>dir.t>=4.7,hacer(){revelar();dir.control=true;dir.cine=false;banner('¡Emboscada!','Los goblins salen de los arbustos. Protege al grupo.');}},
    {id:'rayo',cuando:()=>dir.t>=6.8,hacer(){const T=aliados.talesin,J=esc_('jefe').e;planear(T,[{anim:'conjurar',dur:1,mirar:()=>J.pos,en:[[.55,()=>{
        // Apunta al jefe… pero el hombro le tiembla y el rayo se va contra un árbol.
        const desde=mano(T,1.3),fallo=J.pos.clone().add(new V3(-3.4,2.6,1.4));rayo(desde,fallo,0xff7a2a,.5,.1);chispas(fallo,26,[1,.5,.15],5,.5);brasas(fallo,16,1);for(let i=0;i<14;i++)humo(fallo.x,fallo.y,fallo.z,(rnd()-.5),1+rnd(),(rnd()-.5),1.5,1.3,.12,.1,.1,.5);
        numero(fallo.clone().setY(fallo.y+.6),'¡Falla!','historia',1.4);marcar('rayo');}]]},{bucle:'herido'}]);
      decir('Talesin','¡Rayo de fuego…! ¡Argh, el hombro! No puedo apuntar…',2.8);}},
    {id:'inspiracion',cuando:()=>dir.t>=9.4,hacer(){const F=aliados.fender;F.solido=false;F.estado='Bajo la carreta';
      planear(F,[{ir:[.5,.25],vel:3.6},{ir:[.35,-1.05],vel:1.3,pose:'tumbado'},{bucle:'tocar2',en:[[.2,()=>{
        decir('Fender','♪ Goblins vaqueros, sin caballo y sin sombrero… ¡Adreida, dales duro, que yo canto desde aquí! ♪',3.8);
        for(let i=0;i<7;i++)nota(F.pos.clone().setY(.8),()=>heroe.pos.clone().setY(2),1.1+i*.12,i===6?()=>{heroe.inspiracion=25;chispas(heroe.pos.clone().setY(1.5),30,[1,.85,.35],4,.5);
          tostada('<em class="dorado">Inspiración bárdica</em> · +40% daño y +15% vel. ataque durante 25 s');marcar('inspiracion');}:null);}]]}]);}},
    {id:'acrobacias',cuando:()=>dir.t>=12.4,hacer(){const M=aliados.mohamed;M.solido=false;M.estado='En los árboles';
      // Mientras Mohamed trepa, sale la segunda tanda de la escuadra.
      revelar(2);banner('¡Más goblins!','Salen otros tres de la maleza.');
      planear(M,[{arco:{hasta:[5.4,-3],alto:1.3},dur:.75,pose:'acrobacia'},{arco:{hasta:RAMA,alto:1.6,y:RAMA.y},dur:1.05,pose:'acrobacia',en:[[.99,()=>{hojas(RAMA,12);marcar('acrobacias');}]]},{bucle:'agazapado',mirar:()=>heroe.pos}]);
      decir('Mohamed','¡Arriba! Desde los árboles se ve mejor… y se cae mejor.',2.6);}},
    {id:'manos',cuando:()=>dir.t>=15.8,hacer(){const R=aliados.rafaela,J=esc_('jefe').e,cerca=J.pos.clone().add(new V3(2.4,0,2.2));R.solido=false;R.estado='Va a por el líder';
      planear(R,[{ir:cerca,vel:4.4},{anim:'manosArdientes',dur:1.2,mirar:()=>J.pos,en:[[.3,()=>{manosArdientes(R,J,()=>calcinar(J,true));decir('Rafaela','¡Manos ardientes!',1.6);}]]},
        {ir:[-3.8,.2],vel:3.4},{bucle:'quieto',mirar:()=>heroe.pos,en:[[.01,()=>{R.estado='Vigila el camino';R.solido=true;}]]}]);}},
    {id:'misiles',cuando:()=>desde('manos')>2.8||dir.t>30,hacer(){const T=aliados.talesin;
      planear(T,[{anim:'conjurar',dur:1.1,mirar:()=>{const g=goblinsEnPie()[0];return g?g.pos:heroe.pos;},en:[[.45,()=>{const obj=goblinsEnPie().filter(e=>e.estado!=='oculto').sort((a,b)=>plano(a.pos,T.pos)-plano(b.pos,T.pos));
          const desdeM=mano(T,1.4);for(let i=0;i<3;i++){const e=obj[i%Math.max(1,obj.length)];if(e)dardo(desdeM,e,i*.12,14);}marcar('misiles');}]]},{bucle:'herido'}]);
      decir('Talesin','Con el otro brazo… ¡Proyectil mágico! Tres dardos, tres goblins.',2.6);}},
    {id:'ilusion',cuando:()=>desde('misiles')>3&&(goblinsEnPie().length<=3||desde('misiles')>10),hacer(){const F=aliados.fender,vivos=goblinsEnPie();
      const c=vivos.length?vivos.reduce((s,e)=>s.add(e.pos),new V3()).multiplyScalar(1/vivos.length):new V3(0,0,2.5);c.y=0;dentroZona(c,.3);
      // El más alejado de Adreida será el que acabe huyendo (Rafaela lo alcanza).
      if(vivos.length>=2)vivos.slice().sort((a,b)=>plano(b.pos,heroe.pos)-plano(a.pos,heroe.pos))[0].fugitivo=true;
      aparecerGata(c);for(const e of vivos){if(e.estado==='oculto')continue;cancelarAtaque(e);cambiar(e,'embobado');e.embobadoHasta=reloj.t+8;gritar(e,['¡Ooooh!','¿Una gata… bailando?','¡Qué caderas!'][Math.floor(rnd()*3)],'goblin',1.8);}
      F.estado='Ilusión: gata bailarina';marcar('ilusion');decir('Fender','¡Mirad, goblins! ¡Una gata que baila bachata! (Ilusión menor, pero con mucho arte.)',3.2);}},
    {id:'caida',cuando:()=>desde('ilusion')>1.6,hacer(){const M=aliados.mohamed,vivos=goblinsEnPie().filter(e=>e.estado!=='oculto'&&!e.fugitivo);
      // Y Glip, que esperaba su momento, sale de su arbusto.
      revelar(3);
      const e=vivos.sort((a,b)=>(b.tipo==='arquero')-(a.tipo==='arquero')||plano(a.pos,RAMA)-plano(b.pos,RAMA))[0];const hasta=e?()=>e.pos.clone().add(e.pos.clone().sub(RAMA).setY(0).normalize().multiplyScalar(-.6)):()=>new V3(6,0,-3.5);
      planear(M,[{arco:{hasta,alto:1.2,y:0},dur:.75,pose:'caerSobre',en:[[.97,()=>{const p=M.pos.clone();marca('onda',p.x,p.z,3,0xd8c8ff,.5);polvo(p,20,1.5);temblar(.3);
        if(e&&enPie(e)){danar(e,999,{desde:p,clase:'magia',crit:false});}M.alto=0;M.solido=true;M.estado='Pelea con el bastón';M.lucha=true;marcar('caida');}]]}]);
      decir('Mohamed','¡Sorpresa desde arriba!',1.8);}},
    // El fugitivo (marcado al aparecer la gata, o el último que quede) sale corriendo cuando caen los demás o se le pasa el embobamiento.
    {id:'fugitivo',saltar:()=>!goblinsEnPie().some(e=>e.fugitivo)&&goblinsEnPie().length===0,
      cuando:()=>{const v=goblinsEnPie();if(!v.some(e=>e.fugitivo)&&v.length===1)v[0].fugitivo=true;const f=v.find(e=>e.fugitivo);return !!f&&(v.length===1||reloj.t>f.embobadoHasta);},
      hacer(){const e=goblinsEnPie().find(e=>e.fugitivo),R=aliados.rafaela;
      cancelarAtaque(e);e.fugitivo=true;e.salida=new V3(Math.sign(e.pos.x-heroe.pos.x||1)*30,0,e.pos.z*.6);cambiar(e,'huye');gritar(e,'¡Sálvese quien pueda!','goblin',2.4);
      decir('Narrador','El último goblin huye hacia el bosque…',2.4,true);R.solido=false;R.estado='Persigue al fugitivo';
      planear(R,[{sigue:e,vel:7.4,dist:3.6},{anim:'manosArdientes',dur:1.1,mirar:()=>e.pos,en:[[.3,()=>{if(enPie(e)){manosArdientes(R,e,()=>calcinar(e,true));decir('Rafaela','¡De aquí no se escapa nadie! ¡Manos ardientes!',2.2);}}]]},
        {ir:[-3.8,.2],vel:4},{bucle:'quieto',mirar:()=>heroe.pos,en:[[.01,()=>{R.estado='Vigila el camino';R.solido=true;}]]}]);}},
    {id:'fin',cuando:()=>dir.hecho.has('caida')&&goblinsEnPie().length===0&&glipResuelto()&&!enemigos.some(e=>e.estado==='huye'||e.tipo==='jefe'&&enPie(e)),hacer(){dir.fin={t:reloj.t,victoria:true};dir.control=false;for(const a of Object.values(aliados))if(!a.alto)planear(a,[{ir:[a.pos.x*.7,a.pos.z*.7+.4],vel:2.5},{bucle:a.tipo==='fender'?'tocar':'quieto',mirar:()=>heroe.pos}]);
      aliados.fender.solido=true;banner('¡Emboscada superada!','El camino al Domo queda libre.');decir('Narrador','La escuadra goblin ya no existe. Solo queda Glip, arrastrándose… y la rueda por arreglar.',3.6,true);}},
  ];
  // Refuerzos: hasta que Fender saca a la gata, la escuadra no baja de tres goblins a la vista (salen más de la maleza).
  const refuerzos={n:0,ultimo:-9};
  function refuerzo(){const S=escondites.filter(s=>s.tipo==='goblin'||s.tipo==='arquero'),s=S[Math.floor(rnd()*S.length)],e=crearEnemigo('goblin',s.x,s.z,{estado:'oculto'});
    s.agita=1;hojas(new V3(s.x,0,s.z),20);e.m.raiz.visible=true;const hacia=new V3(s.x*.8,0,s.z-Math.sign(s.z)*2.6);dentroZona(hacia,.4);e.desde=e.pos.clone();e.hasta=hacia;cambiar(e,'salta');
    gritar(e,['¡Otro más!','¡Por la carreta!','¡Voy, jefe!'][refuerzos.n%3],'goblin',1.6);refuerzos.n++;refuerzos.ultimo=reloj.t;}
  function pasoDirector(dt){dir.t+=dt;if(dir.fin)return;
    if(dir.control&&!dir.hecho.has('ilusion')&&refuerzos.n<8&&reloj.t-refuerzos.ultimo>2.2&&goblinsEnPie().filter(e=>e.estado!=='oculto').length<3)refuerzo();
    while(dir.i<GUION.length){const b=GUION[dir.i];if(b.saltar&&b.saltar()){dir.i++;continue;}if(!b.cuando())break;b.hacer();if(b.id==='rueda'||b.id==='emboscada'||b.id==='fin')marcar(b.id);dir.i++;}
  }
  // Los diálogos: quién habla (se ilumina su retrato) y qué dice.
  const dialogo={hasta:0,quien:null,cola:[]};
  // Si llega otro mientras uno se lee, el actual se acorta (lo justo para leerlo) para no quedarse atrás de la acción.
  function decir(quien,texto,dur=2.6,narrador=false){dialogo.cola.push({quien,texto,dur,narrador});if(!dialogo.hasta)siguienteDialogo();else dialogo.hasta=Math.min(dialogo.hasta,Math.max(reloj.t+.9,dialogo.desde+1.4));}
  function siguienteDialogo(){const d=dialogo.cola.shift(),el=$('dialogo');if(!d){el.classList.remove('visto');dialogo.hasta=0;dialogo.quien=null;return;}
    el.innerHTML=`<b>${d.quien}</b>${d.texto}`;el.classList.toggle('narrador',d.narrador);el.classList.add('visto');dialogo.desde=reloj.t;dialogo.hasta=reloj.t+(dialogo.cola.length?Math.min(d.dur,1.8):d.dur);dialogo.quien=d.quien.toLowerCase();
    const a=aliados[dialogo.quien];if(a)gritar(a,'💬','',Math.min(1.4,d.dur));}
  function pasoDialogo(){if(dialogo.hasta&&reloj.t>dialogo.hasta)siguienteDialogo();}

  /* ---- Entrada: teclado, ratón y táctil (como en arpg-three) ---------------------------------------- */
  const puntero=new THREE.Vector2(),ray=new THREE.Raycaster(),planoSuelo=new THREE.Plane(new V3(0,1,0),0);
  const ent={dentro:false,atacando:false,sobre:null,suelo:new V3(),tactil:false,palanca:null,piloto:false,rev:null};
  const ctl={mov:new V3(),atacar:false,apunta:null};
  const teclas=new Set(),DIRS={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
  const ACCION={Space:'esquiva',ShiftLeft:'esquiva',ShiftRight:'esquiva',KeyQ:'torbellino',Digit1:'torbellino',KeyR:'salto',Digit2:'salto',KeyE:'provocar',Digit3:'provocar'};
  function movTeclado(){const v=new V3();for(const k of teclas){const d=DIRS[k];if(d){v.x+=d[0];v.z+=d[1];}}return v.lengthSq()?v.normalize():v;}
  function apuntar(cx,cy){const b=esc.getBoundingClientRect();puntero.set((cx-b.left)/b.width*2-1,-(cy-b.top)/b.height*2+1);}
  function bajo(){ray.setFromCamera(puntero,camara);const hit=ray.intersectObjects(enemigos.filter(atacable).map(e=>e.m.caja),false)[0];ray.ray.intersectPlane(planoSuelo,ent.suelo);return hit?hit.object.userData.enemigo:null;}
  // En la entrada, cualquier tecla o clic se salta la escena (llega la emboscada).
  function saltarEntrada(){if(dir.control||dir.t>=3.9)return false;dir.t=3.9;dialogo.cola.length=0;siguienteDialogo();return true;}
  lienzo.addEventListener('contextmenu',e=>e.preventDefault());
  lienzo.addEventListener('pointerdown',e=>{apuntar(e.clientX,e.clientY);camara.updateMatrixWorld();bajo();if(saltarEntrada())return;
    if(e.pointerType==='touch'){activarTactil();return;}
    ent.piloto=false;ent.dentro=true;lienzo.setPointerCapture?.(e.pointerId);
    if(e.button===2)usar('salto',ent.suelo.clone());else if(e.button===0)ent.atacando=ent.pendiente=true;});
  lienzo.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;apuntar(e.clientX,e.clientY);ent.dentro=true;});
  const soltarPuntero=e=>{if(e.button===0||e.type==='pointercancel')ent.atacando=false;};
  lienzo.addEventListener('pointerup',soltarPuntero);lienzo.addEventListener('pointercancel',soltarPuntero);lienzo.addEventListener('pointerleave',()=>{ent.dentro=false;});
  addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,select'))return;const k=e.code;
    if(DIRS[k]){e.preventDefault();teclas.add(k);ent.piloto=false;return;}
    const h=ACCION[k];if(h){e.preventDefault();if(e.repeat)return;if(saltarEntrada())return;ent.piloto=false;usar(h,h==='salto'?puntoApuntado():null);}});
  addEventListener('keyup',e=>{teclas.delete(e.code);});addEventListener('blur',()=>{teclas.clear();ent.atacando=false;});
  for(const b of document.querySelectorAll('[data-hab]')){const h=b.dataset.hab;
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();ent.piloto=false;if(e.pointerType==='touch')activarTactil();if(saltarEntrada())return;if(h==='tajo'){ent.atacando=ent.pendiente=true;b.setPointerCapture?.(e.pointerId);return;}usar(h,h==='salto'?puntoApuntado():null);});
    if(h==='tajo')for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>{ent.atacando=false;});}
  function activarTactil(){if(ent.tactil)return;ent.tactil=true;esc.classList.add('tactil');}
  if(matchMedia('(pointer:coarse)').matches)activarTactil();
  {const pal=$('palanca'),bola=pal.querySelector('i');let id=null,c=null;
    pal.addEventListener('pointerdown',e=>{e.preventDefault();activarTactil();id=e.pointerId;pal.setPointerCapture?.(id);const r=pal.getBoundingClientRect();c={x:r.left+r.width/2,y:r.top+r.height/2,r:r.width/2};mover(e);ent.piloto=false;});
    const mover=e=>{if(e.pointerId!==id)return;let dx=(e.clientX-c.x)/c.r,dy=(e.clientY-c.y)/c.r;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}bola.style.transform=`translate(${dx*c.r*.55}px,${dy*c.r*.55}px)`;
      ent.palanca=Math.hypot(dx,dy)>.15?new V3(dx,0,dy):null;};
    pal.addEventListener('pointermove',mover);
    const fin=e=>{if(e.pointerId!==id)return;id=null;ent.palanca=null;bola.style.transform='';};pal.addEventListener('pointerup',fin);pal.addEventListener('pointercancel',fin);}
  function leerControles(){ctl.mov.set(0,0,0);ctl.atacar=false;ctl.apunta=null;if(!dir.control)return;
    if(ent.piloto){const p=piloto();ctl.mov.copy(p.mov);ctl.atacar=p.atacar;ctl.apunta=p.apunta;return;}
    if(ent.rev){ctl.mov.copy(ent.rev.mov);ctl.atacar=ent.rev.atacar;ctl.apunta=ent.rev.apunta;return;}
    ctl.mov.copy(ent.palanca||movTeclado());ctl.atacar=ent.atacando||ent.pendiente;ctl.apunta=ent.tactil||!(ent.dentro||ent.atacando)?null:ent.sobre?ent.sobre.pos.clone():ent.suelo.clone();}

  /* ---- Piloto automático (Demostración): juega el episodio leyendo los avisos ------------------------ */
  function escape(a,e,p){if(a.forma==='linea'){const f=frente(a.dir),lado=new V3(-f.z,0,f.x),s=Math.sign(p.clone().sub(e.pos).dot(lado))||1;return lado.multiplyScalar(s);}
    const v=p.clone().sub(e.pos).setY(0);const f=frente(a.dir),l=new V3(-f.z,0,f.x);v.normalize().addScaledVector(l,Math.sign(v.dot(l))||1);return v.lengthSq()>1e-4?v.normalize():frente(heroe.dir+Math.PI);}
  function piloto(){const h=heroe,c={mov:new V3(),atacar:false,apunta:null};if(!h.vivo)return c;
    // El fugitivo es cosa de Rafaela: el piloto no lo persigue.
    const vivos=enemigos.filter(e=>(atacable(e)||e.estado==='embobado')&&e.estado!=='huye'&&!e.fugitivo&&Math.abs(e.pos.x)<ZONA.x&&Math.abs(e.pos.z)<ZONA.z);
    for(const e of enemigos){const a=e.ataque;if(!a||!enZona(a,e,h.pos,h.radio+.45))continue;const v=escape(a,e,h.pos),resta=a.dur-(reloj.t-a.t0);
      if(resta<.3&&!h.cd.esquiva)usar('esquiva',v);c.mov.copy(v);return c;}
    if(!libre())return c;
    if(!vivos.length){const g=globos[0];if(g&&h.alma<h.almaMax)c.mov.copy(g.pos).sub(h.pos).setY(0).normalize();return c;}
    const cerca=r=>vivos.filter(e=>plano(e.pos,h.pos)<r);
    if(h.alma<h.almaMax*.4&&globos.length){c.mov.copy(globos[0].pos).sub(h.pos).setY(0).normalize();return c;}
    if(!h.cd.provocar&&cerca(9).length>=3){usar('provocar');return c;}
    if(h.furia>=30&&cerca(3).length>=3){usar('torbellino');return c;}
    const arqueros=vivos.filter(e=>e.d.lanza&&plano(e.pos,h.pos)<12),cuerpo=cerca(2.6).filter(e=>!e.d.lanza);
    const obj=(arqueros.length&&!cuerpo.length?arqueros:vivos).sort((a,b)=>plano(a.pos,h.pos)-plano(b.pos,h.pos))[0],d=plano(obj.pos,h.pos);
    if(d>1.85+obj.radio)c.mov.copy(obj.pos).sub(h.pos).setY(0).normalize();else{c.atacar=true;c.apunta=obj.pos.clone();}
    return c;}

  /* ---- HUD ----------------------------------------------------------------------------------------- */
  let tostadaHasta=0,bannerHasta=0,finMostrado=false;
  function tostada(html,mala=false){const t=$('tostada');t.innerHTML=html;t.classList.toggle('mala',mala);t.classList.add('visto');tostadaHasta=reloj.t+(mala?1.2:3.2);}
  function banner(titulo,texto){const b=$('banner');b.innerHTML=`<b>${titulo}</b><small>${texto}</small>`;b.classList.add('visto');bannerHasta=reloj.t+2.8;}
  const RETRATOS={mohamed:'lider_mohamed',fender:'lider_fender',talesin:'lider_talesin',rafaela:'lider_rafaela'};
  for(const t of Object.keys(RETRATOS)){const d=document.createElement('div');d.className='epMiembro';d.id='grupo-'+t;d.innerHTML=`<img alt="" src="./art/${RETRATOS[t]}.webp"><b>${GRUPO[t].nombre}</b><small></small>`;$('grupo').appendChild(d);}
  function hud(){const h=heroe;$('orbeAlma').style.setProperty('--lleno',(h.alma/h.almaMax*100).toFixed(1)+'%');$('almaTxt').textContent=Math.ceil(h.alma)+' / '+h.almaMax;
    $('orbeFuria').style.setProperty('--lleno',h.furia.toFixed(1)+'%');$('furiaTxt').textContent=Math.floor(h.furia);
    for(const b of document.querySelectorAll('[data-hab]')){const k=b.dataset.hab,H=HAB[k];if(!H)continue;const cd=h.cd[k]||0;b.style.setProperty('--cd',(H.cd?cd/H.cd*100:0).toFixed(1)+'%');b.classList.toggle('sinFuria',h.furia<H.coste);b.classList.toggle('enCurso',{torbellino:'torbellino',salto:'salto',provocar:'grito',esquiva:'esquiva'}[k]===h.estado);}
    const st=`<span>ATQ <b>${h.atq}</b></span><span>Vel. ataque <b>${Math.round(h.vatq*100)}%</b></span>`+(h.inspiracion>0?`<span class="escudo">♪ Inspiración bárdica ${Math.ceil(h.inspiracion)} s</span>`:'')+(h.escudo>0?'<span class="escudo">Provocar: −50% daño</span>':'');if(st!==hud.st){hud.st=st;$('stats').innerHTML=st;}
    for(const t of Object.keys(RETRATOS)){const a=aliados[t],el=$('grupo-'+t);if(!a)continue;el.classList.toggle('habla',dialogo.quien===t);el.classList.toggle('herido',!!a.herido);const s=el.querySelector('small');if(s.textContent!==a.estado)s.textContent=a.estado;}
    const n=goblinsEnPie().filter(e=>e.estado!=='oculto').length,glip=enemigos.find(e=>e.tipo==='glip');
    const mision=!dir.control&&!dir.fin?'Camino al Domo…':dir.fin?'Emboscada superada':`Emboscada · goblins en pie: ${n}`+(glip&&enPie(glip)&&glip.estado!=='oculto'?' · Glip aún lucha':'');
    const html=`${mision}<small>Episodio 1 · Emboscada en la Carreta hacia el Domo</small>`;if(html!==hud.m){hud.m=html;$('oleada').innerHTML=html;}
    const o=ent.sobre?ent.sobre:enemigos.includes(h.ultimo)&&atacable(h.ultimo)?h.ultimo:null;$('objetivo').hidden=!o;if(o){$('objNombre').textContent=o.m.nombre;$('objVida').style.width=(Math.max(0,o.vida)/o.vidaMax*100).toFixed(1)+'%';}
    flechas();golpeDir();$('barras').classList.toggle('cine',dir.cine);
    $('vineta').style.opacity=h.heridaT===undefined?'0':Math.max(0,.9*(1-(reloj.t-h.heridaT)/.45)).toFixed(3);
    if(tostadaHasta&&reloj.t>tostadaHasta){$('tostada').classList.remove('visto');tostadaHasta=0;}if(bannerHasta&&reloj.t>bannerHasta){$('banner').classList.remove('visto');bannerHasta=0;}
    if(!h.vivo&&h.muerteT>1.3&&!finMostrado){finMostrado=true;mostrarFin('Adreida cae','Los goblins se llevan la carreta… Vuelve a intentarlo: el grupo te necesita.');}
    if(dir.fin?.victoria&&reloj.t-dir.fin.t>4&&!finMostrado){finMostrado=true;mostrarFin('Episodio 1 completado','Emboscada en la Carreta hacia el Domo. Así lo cuenta la crónica:');}}
  function mostrarFin(titulo,texto){$('fin').hidden=false;$('finTitulo').textContent=titulo;$('finTexto').textContent=texto;
    $('cronica').innerHTML=dir.fin?.victoria?CRONICA.map(([id,t])=>`<li class="${dir.hecho.has(id)?'hecho':''}">${t}</li>`).join('')+`<li class="hecho">Adreida venció a ${heroe.muertes} goblin${heroe.muertes===1?'':'s'} con su hacha.</li>`:'';}
  const flechasEl=[];
  function flechas(){const b=esc.getBoundingClientRect(),W=b.width,H=b.height;let n=0;
    for(const e of enemigos){if(!e.ataque)continue;const p=e.pos.clone().setY(1),atras=detras(p),v=p.project(camara);if(!atras&&Math.abs(v.x)<.94&&Math.abs(v.y)<.94)continue;
      let x=v.x,y=v.y;if(atras){x=-x;y=-y;}const k=1/Math.max(Math.abs(x),Math.abs(y),1e-3);x*=k;y*=k;
      const el=flechasEl[n]||(flechasEl[n]=Object.assign(document.createElement('div'),{className:'apFlecha'}));if(!el.parentNode)$('flechas').appendChild(el);
      const px=(x*.5+.5)*W,py=(.5-y*.5)*H,m=34,abajo=H-(ent.tactil?34:118);el.style.transform=`translate(${Math.min(W-m,Math.max(m,px))}px,${Math.min(abajo,Math.max(m,py))}px) rotate(${Math.atan2(-y,x)}rad)`;el.classList.toggle('fijado',e.ataque.fijado);el.hidden=false;n++;}
    for(let i=n;i<flechasEl.length;i++)flechasEl[i].hidden=true;}
  function golpeDir(){const g=heroe.golpeDe,el=$('golpeDir');if(!g){el.style.opacity='0';return;}const k=(reloj.t-g.t)/.8;if(k>=1){el.style.opacity='0';return;}
    const a=heroe.pos.clone().setY(1).project(camara),b=g.desde.clone().setY(1).project(camara),r=esc.getBoundingClientRect();
    el.style.opacity=(1-k).toFixed(3);el.style.transform=`rotate(${Math.atan2(-(b.y-a.y)*r.height,(b.x-a.x)*r.width)}rad)`;}
  const repetir=()=>location.reload();$('reintentar').onclick=repetir;$('reiniciar').onclick=repetir;

  /* ---- Cámara: en la entrada mira la carreta; luego sigue a Adreida ---------------------------------- */
  const vista={dist:1,temblor:0,foco:new V3(0,0,1)};
  function temblar(f){if(!reducido)vista.temblor=Math.max(vista.temblor,f);}
  esc.addEventListener('wheel',e=>{e.preventDefault();vista.dist=Math.max(.65,Math.min(1.45,vista.dist*(e.deltaY>0?1.08:.93)));},{passive:false});
  function pasoCamara(dt){const foco=dir.control||dir.fin?heroe.pos:new V3(.3,0,.6);vista.foco.lerp(foco,Math.min(1,dt*(dir.control?6:2)));vista.temblor=Math.max(0,vista.temblor-dt*1.4);
    const D=21*vista.dist*(dir.cine?.78:1),el=dir.cine?.82:.92,tr=vista.temblor,t=reloj.t;
    camara.position.set(vista.foco.x+Math.sin(t*61)*tr*.3,vista.foco.y+Math.sin(el)*D+Math.cos(t*53)*tr*.25,vista.foco.z+Math.cos(el)*D);camara.lookAt(vista.foco.x,vista.foco.y+.8,vista.foco.z);
    sol.position.set(heroe.pos.x-14,22,heroe.pos.z+9);sol.target.position.copy(heroe.pos);}

  /* ---- Cada fotograma ------------------------------------------------------------------------------ */
  let listo=false,simple=false,revisados=0,cuadros=0;const poses={};
  const POSE_ENEMIGO=(e,d)=>{const ka=e.ataque?Math.min(1,(reloj.t-e.ataque.t0)/e.ataque.dur):1;
    return {quieto:['quieto'],oculto:['quieto'],salta:['salto',.2+e.t*1.2],ordena:[e.grita&&reloj.t-e.grita<.9?'grito':'quieto',(reloj.t-(e.grita||0))/.9],persigue:[e.paso>.05?'andar':'quieto'],aviso:[d.lanza?'apunta':'aviso',ka],
      golpe:[d.lanza?'lanzar':'golpe',d.lanza?e.t/d.golpe*.6:.38+.24*(e.t/d.golpe)],recupera:[d.lanza?'lanzar':'golpe',d.lanza?.6+.4*Math.min(1,e.t/d.recupera):.62+.38*Math.min(1,e.t/d.recupera)],dolor:['dolor',e.t/.28],aturdido:['aturdido'],
      muere:['muerte',Math.min(1,e.t/.6)],calcinado:['muerte',Math.min(1,e.t/1.4)],embobado:['embobado'],huye:['huir'],sinPiernas:['arrastrarse']}[e.estado];};
  function paso(dt){
    if(paron>0){paron-=dt;dt*=.08;}
    reloj.t+=dt;tiempo.value=reloj.t;
    camara.updateMatrixWorld();ent.sobre=ent.dentro&&!ent.tactil?bajo():null;
    leerControles();pasoDirector(dt);pasoDialogo();
    pasoHeroe(dt);for(const e of [...enemigos])pasoEnemigo(e,dt);for(const a of Object.values(aliados))pasoAliado(a,dt);separar();pasoLanzas(dt);pasoGlobos(dt);pasoMarcas();pasoEfectos();pasoPiezas(dt);pasoRueda();pasoParticulas(dt);
    // Poses y posiciones de los modelos.
    const h=heroe,hm=h.m;hm.raiz.position.set(h.pos.x,h.alto||0,h.pos.z);
    if(h.estado==='torbellino'){h.giro+=dt*17;hm.raiz.rotation.y=h.dir+h.giro;}else{h.giro=0;hm.raiz.rotation.y=h.dir;}
    const fin=dir.fin?.victoria&&reloj.t-dir.fin.t<1.2?['grito',(reloj.t-dir.fin.t)/1.2]:null;
    const ph=poses.heroe||fin||{quieto:['quieto'],andar:['andar'],golpe:[COMBO[h.combo].anim,h.t/COMBO[h.combo].dur],esquiva:['esquiva',h.t/DUR_ESQ],torbellino:['torbellino'],salto:['salto',h.t/.72],grito:['grito',h.t/.7],muerta:['muerte',Math.min(1,h.t/1)]}[h.estado];
    MOD.posar(hm,{anim:h.paso>.05&&h.estado==='andar'&&!fin?'andar':ph[0],k:ph[1],t:reloj.t,fase:h.fase,paso:h.paso});
    if(h.dolor<1&&['quieto','andar'].includes(h.estado)){hm.H.torso.rotation.x-=.25*(1-h.dolor);}
    if(h.destello>0){hm.M.u.uDestello.value=h.destello*.8;hm.M.u.uColorD.value.setRGB(1,.25,.2);}else{hm.M.u.uDestello.value=h.invul>0?.4:0;hm.M.u.uColorD.value.setRGB(.55,.8,1.3);}
    // Inspirada: un brillo dorado en el contorno.
    hm.M.u.uBorde.value=h.inspiracion>0?.1+.05*Math.sin(reloj.t*6):0;hm.M.u.uColorB.value.setRGB(1,.75,.25);
    if(h.inspiracion>0&&rnd()<.25)particula(h.pos.x+(rnd()-.5)*.8,.4+rnd()*1.6,h.pos.z+(rnd()-.5)*.8,0,.8,0,.6,.35,2.4,1.8,.6,0);
    for(const e of enemigos){const m=e.m;if(e.estado==='partido')continue;m.raiz.position.set(e.pos.x,e.alto,e.pos.z);m.raiz.rotation.y=e.dir;const d=e.d,pe=POSE_ENEMIGO(e,d);
      MOD.posar(m,{anim:pe[0],k:pe[1],t:reloj.t+e.id,fase:e.fase,paso:e.paso});
      if(e.estado==='calcinado')continue;
      m.M.u.uDestello.value=e.destello*.42;m.M.u.uColorD.value.setRGB(1,.92,.8);
      const culpa=Math.max(0,1-(reloj.t-e.culpableT)/.6),ka=e.ataque?Math.min(1,(reloj.t-e.ataque.t0)/e.ataque.dur):1;
      m.M.u.uBorde.value=e.ataque?(e.ataque.fijado?1.1+.4*Math.sin(reloj.t*40):.25+.45*ka):e.estado==='embobado'?.35:culpa*1.3;
      if(e.estado==='embobado')m.M.u.uColorB.value.setRGB(.7,.35,1);else m.M.u.uColorB.value.setRGB(1,e.ataque&&!e.ataque.fijado?.16:.07,.03);
      if(e.estado==='aturdido'){if(!e.estrellas){e.estrellas=new THREE.Group();for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.OctahedronGeometry(.07),matEstrella);s.position.set(Math.cos(i*TAU/3)*.3,0,Math.sin(i*TAU/3)*.3);e.estrellas.add(s);}escena.add(e.estrellas);}
        e.estrellas.position.set(e.pos.x,m.alto+.25,e.pos.z);e.estrellas.rotation.y=reloj.t*5;}
      else if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}}
    for(const a of Object.values(aliados)){const m=a.m;m.raiz.position.set(a.pos.x,a.alto,a.pos.z);m.raiz.rotation.y=a.dir;
      const anim=a.anim==='tocar2'?'tumbado':a.anim==='andar'&&a.paso<.05?'quieto':a.anim;MOD.posar(m,{anim,k:a.k,t:reloj.t+a.pos.x,fase:a.fase,paso:a.paso});}
    // Fender, bajo la carreta, no para de sonar; el caballo se pone nervioso; los arbustos se agitan.
    const F=aliados.fender;if(F&&['tocar','tocar2'].includes(F.anim)&&rnd()<.06)nota(F.pos.clone().setY(.9),F.pos.clone().add(new V3((rnd()-.5)*1.5,2.4,(rnd()-.5)*1.5)),1.3);
    cuello.rotation.z=Math.sin(reloj.t*(dir.control?3.2:1.2))*(dir.control?.18:.06);cola.rotation.x=Math.sin(reloj.t*2.3)*.3;
    for(const s of escondites){s.agita=Math.max(0,s.agita-dt*1.5);const temblor=s.agita+(s.e&&s.e.estado==='oculto'&&dir.t>2?.08:0);s.g.rotation.z=Math.sin(reloj.t*37+s.x)*.08*temblor;s.g.scale.setScalar(1+Math.sin(reloj.t*23)*.03*temblor);}
    const sel=ent.sobre;seleccion.m.visible=!!sel;if(sel){seleccion.m.position.set(sel.pos.x,.045,sel.pos.z);seleccion.m.scale.setScalar(sel.radio*1.8);}
    aura.visible=h.escudo>0;aura.position.set(h.pos.x,(h.alto||0)+1,h.pos.z);aura.material.uniforms.uA.value=Math.min(1,h.escudo)*.9;
    rastroCorte(h);estela.visible=h.estado==='torbellino';estela.position.set(h.pos.x,1.05,h.pos.z);estela.rotation.y=-h.giro;
    for(const n of [...numeros]){const s=reloj.t-n.t0;n.e.pos.y=n.y+s*1.4;n.e.el.style.opacity=String(Math.max(0,1-Math.max(0,s-n.dur*.5)/(n.dur*.5)));if(s>n.dur){quitarEtiqueta(n.e);numeros.splice(numeros.indexOf(n),1);}}
    pasoCamara(dt);camara.updateMatrixWorld();for(const e of etiquetas)colocar(e);hud();
    lienzo.style.cursor=ent.sobre?'crosshair':'default';}
  const matEstrella=new THREE.MeshBasicMaterial({color:0xffe070,toneMapped:false});
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.25,24,16),new THREE.ShaderMaterial({uniforms:{uA:{value:0},uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vN,vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uA,uT;varying vec3 vN,vV;varying float vY;void main(){float f=pow(clamp(1.-abs(dot(vN,vV)),0.,1.),2.5)*(.7+.3*sin(vY*14.-uT*6.));gl_FragColor=vec4(vec3(1.,.75,.3)*1.6,f*uA);}`}));aura.visible=false;escena.add(aura);
  const matRastro=new THREE.ShaderMaterial({uniforms:{uP:{value:0},uA:{value:0},uS:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:'attribute float aK,aR;varying float vK,vR;void main(){vK=aK;vR=aR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uP,uA,uS;varying float vK,vR;void main(){float k=mix(1.-vK,vK,uS);float a=pow(smoothstep(uP-.55,uP,k),2.)*step(k,uP)*smoothstep(.35,.9,vR)*(1.-smoothstep(.93,1.,vR));gl_FragColor=vec4(vec3(1.,.88,.7)*.9,a*uA*.55);}`});
  function geoRastro(forma){const P=[],K=[],Rr=[],I=[],n=28;
    for(let i=0;i<=n;i++){const t=i/n;for(let j=0;j<2;j++){if(forma==='arco'){const f=-1.15+2.3*t,r=j?2.15:1.2;P.push(Math.sin(f)*r,0,Math.cos(f)*r);}else{P.push(j?.09:-.09,0,.6+2.2*t);}K.push(t);Rr.push(forma==='arco'?j:.5+.5*Math.sin(Math.PI*t));}
      if(i<n){const o=i*2;I.push(o,o+1,o+2,o+1,o+3,o+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aK',new THREE.Float32BufferAttribute(K,1));g.setAttribute('aR',new THREE.Float32BufferAttribute(Rr,1));g.setIndex(I);return g;}
  const rastroArco=new THREE.Mesh(geoRastro('arco'),matRastro),rastroRecto=new THREE.Mesh(geoRastro('recto'),matRastro.clone());for(const m of [rastroArco,rastroRecto]){m.visible=false;m.frustumCulled=false;escena.add(m);}
  function rastroCorte(h){rastroArco.visible=rastroRecto.visible=false;if(h.estado!=='golpe')return;const C=COMBO[h.combo],k=h.t/C.dur,m=h.combo===2?rastroRecto:rastroArco;
    const u=m.material.uniforms;u.uP.value=h.combo===2?tramo(k,.38,.5)*1.5:tramo(k,.38,.64)*1.5;u.uA.value=1-tramo(k,h.combo===2?.6:.64,.9);u.uS.value=h.combo===1?0:1;if(u.uP.value<=0||u.uA.value<=0)return;
    m.visible=true;m.position.set(h.pos.x,.75,h.pos.z);m.rotation.y=h.dir;}
  const estela=new THREE.Mesh(new THREE.RingGeometry(1.1,2.5,48,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP;void main(){float a=atan(vP.z,vP.x)/6.2832+.5,r=length(vP.xz);float s=pow(fract(a*2.),3.)*smoothstep(1.1,1.6,r)*(1.-smoothstep(2.1,2.5,r));gl_FragColor=vec4(vec3(1.,.85,.6)*1.8,s*.8);}`}));estela.visible=false;escena.add(estela);

  function medir(){const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,b.width),H=Math.max(1,b.height);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);camara.aspect=W/H;camara.fov=W/H<.9?44:32;camara.updateProjectionMatrix();escPuntos.value=H*dpr/900;}
  function aplicarEfectos(){renderer.shadowMap.enabled=efectos.sombras;sol.castShadow=efectos.sombras;oclusion.enabled=efectos.oclusion;resplandor.enabled=efectos.resplandor;escena.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true;});}
  for(const c of document.querySelectorAll('[data-efecto]'))c.onchange=()=>{efectos[c.dataset.efecto]=c.checked;aplicarEfectos();};
  $('demo').onclick=()=>{ent.piloto=!ent.piloto;$('demo').setAttribute('aria-pressed',String(ent.piloto));};
  function negro(){const px=new Uint8Array(4),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;let s=0;for(let k=0;k<9;k++){gl.readPixels(Math.floor(W*(.2+.3*(k%3))),Math.floor(H*(.2+.3*Math.floor(k/3))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);s+=px[0]+px[1]+px[2];}return s<27;}
  function dibujar(){renderer.info.reset();if(simple)renderer.render(escena,camara);else composer.render();
    if(!CAPTURA&&revisados<3&&++cuadros>=5+revisados*20){revisados++;if(negro()){if(!simple){simple=true;aviso('El posproceso no funciona en esta tarjeta gráfica ('+gpu+'): se muestra sin él.');}else aviso('La escena sale negra en esta tarjeta gráfica ('+gpu+'). Cuéntanos qué navegador y dispositivo usas.');}}}
  let antes=performance.now(),fps={n:0,t:performance.now(),v:0};
  function cuadro(ahora){const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;paso(dt);dibujar();
    fps.n++;if(ahora-fps.t>=1000){fps.v=Math.round(fps.n*1000/(ahora-fps.t));fps.n=0;fps.t=ahora;const i=renderer.info;
      $('info').textContent=`${fps.v} fps · ${i.render.calls} llamadas · ${(i.render.triangles/1000).toFixed(0)} mil triángulos · ${hdr?'HDR':'8 bits'} · MSAA ${muestras}× · ${simple?'sin posproceso · ':''}${gpu} · three ${THREE.REVISION}`;}
    requestAnimationFrame(cuadro);}

  async function preparar(){
    Object.assign(matSuelo,pintarSuelo());matSuelo.needsUpdate=true;
    crearHeroe();preparar_();medir();new ResizeObserver(medir).observe(esc);aplicarEfectos();
    estado('WASD para moverte, clic izquierdo para atacar hacia el cursor, Espacio para esquivar, clic derecho para saltar, Q Torbellino, E Provocar. Una tecla o un clic se saltan la entrada.');
    listo=true;paso(1/60);if(!CAPTURA)requestAnimationFrame(cuadro);else dibujar();
  }

  // Revisión: avanzar(s) mueve el reloj a pasos de 1/30 s y dibuja.
  const aPantalla=p=>{camara.updateMatrixWorld(true);const v=p.clone().project(camara),b=esc.getBoundingClientRect();return {x:b.left+(v.x*.5+.5)*b.width,y:b.top+(.5-v.y*.5)*b.height,dentro:Math.abs(v.x)<1&&Math.abs(v.y)<1};};
  const resumen=e=>({id:e.id,tipo:e.tipo,estado:e.estado,x:+e.pos.x.toFixed(2),z:+e.pos.z.toFixed(2),vida:e.vida,visible:e.m.raiz.visible,fugitivo:!!e.fugitivo,ataque:e.ataque?e.ataque.forma:null});
  window.CAOZ_EPISODIOS_THREE_REVISION=Object.freeze({
    listo:()=>listo,
    async avanzar(s,fps=30){const n=Math.max(1,Math.round(s*fps));for(let i=0;i<n;i++){paso(1/fps);if(i%3===2)await new Promise(r=>setTimeout(r,0));}dibujar();return this.estado();},
    dibujar(){dibujar();const i=renderer.info.render;return {llamadas:i.calls,triangulos:i.triangles};},
    estado:()=>({listo,webgl2:true,version:THREE.REVISION,simple,t:+dir.t.toFixed(2),control:dir.control,cine:dir.cine,paso:GUION[dir.i]?.id||'hecho',hecho:[...dir.hecho.keys()],victoria:!!dir.fin?.victoria,finVisible:!$('fin').hidden,finTitulo:$('finTitulo').textContent,
      cronica:[...$('cronica').querySelectorAll('li')].map(li=>(li.classList.contains('hecho')?'✓ ':'· ')+li.textContent),dialogo:$('dialogo').classList.contains('visto')?$('dialogo').textContent:'',
      heroe:{x:+heroe.pos.x.toFixed(2),z:+heroe.pos.z.toFixed(2),alma:heroe.alma,vivo:heroe.vivo,estado:heroe.estado,inspiracion:+heroe.inspiracion.toFixed(1),vatq:heroe.vatq,muertes:heroe.muertes,dir:+heroe.dir.toFixed(3),
        punta:(()=>{const p=heroe.m.M.punta.getWorldPosition(new V3());return [+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)];})(),
        manoI:(()=>{const p=heroe.m.H.manoI.getWorldPosition(new V3()),q=heroe.m.H.manoD.getWorldPosition(new V3());return +p.distanceTo(q).toFixed(3);})()},
      enemigos:enemigos.map(resumen),aliados:Object.fromEntries(Object.values(aliados).map(a=>[a.tipo,{x:+a.pos.x.toFixed(2),z:+a.pos.z.toFixed(2),alto:+a.alto.toFixed(2),anim:a.anim,estado:a.estado}])),
      rueda:rueda.t0>=0,gata:!!ilusionEstado.gato,grupo:[...document.querySelectorAll('.epMiembro')].map(el=>el.querySelector('b').textContent+': '+el.querySelector('small').textContent)}),
    control(c){ent.rev=c?{mov:new V3(c.mov?.[0]||0,0,c.mov?.[1]||0),atacar:!!c.atacar,apunta:c.apunta?new V3(c.apunta[0],0,c.apunta[1]):null}:null;},
    usar:(h,x,z)=>usar(h,x===undefined?null:new V3(x,0,z)),
    heroe(p){if('x' in p)heroe.pos.set(p.x,0,p.z);if('alma' in p)heroe.alma=p.alma;if('furia' in p)heroe.furia=p.furia;if('dir' in p)heroe.dir=p.dir;vista.foco.copy(heroe.pos);},
    enemigo(id,p){const e=enemigos.find(e=>e.id===id);if(!e)return;if('x' in p)e.pos.set(p.x,0,p.z);if('vida' in p)e.vida=p.vida;},
    golpear(id,dano){const e=enemigos.find(e=>e.id===id);if(e)danar(e,dano,{adreida:true,crit:false});},
    piloto(v){ent.piloto=v;},
    pose(anim,k){poses.heroe=anim?[anim,k]:null;},
    camara(p){Object.assign(vista,p);},
    efecto(k,v){efectos[k]=v;const c=document.querySelector(`[data-efecto="${k}"]`);if(c)c.checked=v;aplicarEfectos();},
    saltarEntrada,
    pantalla:(x,y,z)=>aPantalla(new V3(x,y,z)),
    heroePantalla:(y=1)=>aPantalla(heroe.pos.clone().setY(y)),
    enemigoPantalla(id,y){const e=enemigos.find(e=>e.id===id);return e?aPantalla(e.pos.clone().setY(y??e.m.alto*.6)):null;},
  });
  preparar().catch(e=>aviso('No se pudo preparar el camino: '+e.message));
})();

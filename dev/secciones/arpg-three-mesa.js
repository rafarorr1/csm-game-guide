/* Prueba de ARPG en three.js («Caoz ARPG», Hito 1): Adreida, la
   Guerrera Semiorca, defiende la plaza de Tomsage bajo asedio contra cuatro
   oleadas. Vista isométrica, clic para andar y atacar, como en Diablo.
     · Modelos 3D sencillos (arpg-three-modelos.js), animados por código.
     · La plaza: adoquines con relieve, las casas de Tomsage (casas-three.js,
       con su interior tras las ventanas; tres arden), un pozo, carros, barriles
       y braseros; la luna con sombras, la luz que lleva
       Adreida y el fuego de las casas; brasas y ceniza en el aire.
     · Combate: Tajo (clic), Torbellino (1/Q o clic derecho), Salto (2/W) y
       Hacha búmeran (3/E). La Furia sube al golpear y al recibir golpes. Los
       enemigos avisan antes de pegar: goblins que rodean, kobolds que lanzan
       lanzas desde lejos (se ve la línea), saqueadores que no se inmutan y Can,
       el de los Goblins, con un golpazo en área que se ve venir.
     · El botín son cartas físicas (three-carta.js) de los Objetos del juego,
       en Normal, Foil o Dorado, con su columna de luz. Al pasar por encima se
       levantan para leerlas; al recogerlas se guardan hasta elegir al finalizar el nivel.
     · En táctil: palanca para andar y botones de habilidad.
   ?captura=1 deja sólo el escenario, sin oleadas automáticas, y la revisión
   (CAOZ_ARPG_THREE_REVISION) permite avanzar cuadros de duración explícita. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),CAPTURA=q.get('captura')==='1';
  const COOP=q.get('coop')==='1',DOS_MANDOS=q.get('mandos')==='2',ABIERTO=q.get('mundo')==='abierto';
  const FACTOR_COOP=COOP?2:1;
  window.CAOZ_ARPG_IA.configurar(q.get('ia')==='clasica'?'clasica':'yuka');
  const laboratorio=q.get('inspector')==='1'?{detenido:false,antes:null,despues:null}:null;
  const estado=t=>{$('estado').textContent=t;},aviso=t=>{estado(t);$('info').textContent=t;$('diagnostico').open=true;};
  addEventListener('error',e=>aviso('Error: '+(e.message||e.error)));
  addEventListener('unhandledrejection',e=>aviso('Error: '+(e.reason?.message||e.reason)));
  if(!document.createElement('canvas').getContext('webgl2')){aviso('Este navegador no tiene WebGL 2, que three.js necesita. Prueba con Chrome, Edge, Firefox o Safari actualizados.');return;}
  if(CAPTURA)document.documentElement.dataset.captura='';
  const {THREE,EffectComposer,RenderPass,GTAOPass,UnrealBloomPass,OutputPass}=window.CAOZ_THREE;
  const MOD=window.CAOZ_ARPG_MODELOS.fabrica(THREE),C=window.CAOZ_THREE_CARTA,{ANCHO,ALTO}=C;
  const TAU=Math.PI*2,V3=THREE.Vector3;
  const temporizador=window.CAOZ_ARPG_TIEMPO.crearReloj();
  function sincronizarTiempo(){temporizador.reiniciar();}
  const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const efectos={sombras:true,oclusion:false,resplandor:true};
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
  const gl=renderer.getContext(),hdr=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float'),muestras=Math.min(CAPTURA?4:2,gl.getParameter(gl.MAX_SAMPLES)||0);
  const depura=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(depura?gl.getParameter(depura.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)).slice(0,60);
  // Bruma azul al fondo: el centro de combate queda despejado. No requiere otra pasada.
  const escena=new THREE.Scene();escena.matrixWorldAutoUpdate=false;escena.background=new THREE.Color(0x233442);escena.fog=new THREE.Fog(0x233442,13,56);
  // Entorno de los reflejos: noche azul arriba y el resplandor naranja del incendio en el horizonte.
  {const e=new THREE.Scene();e.background=new THREE.Color(0x05040a);const caja=(w,h,color,f,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(f),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);e.add(m);};
    caja(8,8,0x6f86c8,.9,[0,9,0]);caja(14,2.5,0xff7a30,1.6,[0,1,-9]);caja(10,2,0xff8a40,1.1,[9,1,3]);caja(10,2,0x2a3050,.8,[-9,1,2]);
    escena.environment=new THREE.PMREMGenerator(renderer).fromScene(e,.03).texture;escena.environmentIntensity=.385;}
  const impactoFX=window.CAOZ_ARPG_IMPACTOS.fabrica(THREE,escena);
  const camara=new THREE.PerspectiveCamera(32,1,.5,1200);
  const objetivo=new THREE.WebGLRenderTarget(2,2,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,samples:muestras});
  const composer=new EffectComposer(renderer,objetivo),pasoRender=new RenderPass(escena,camara);
  const oclusion=new GTAOPass(escena,camara,2,2);oclusion.updateGtaoMaterial({radius:.9,distanceExponent:1.5,thickness:1.2,scale:1,samples:8});oclusion.blendIntensity=.425;
  // La oclusión sólo oculta puntos y líneas en su pasada de normales; las llamas, haces y marcas (transparentes) tampoco deben hacer sombra de contacto.
  {const ocultar=oclusion._overrideVisibility.bind(oclusion);oclusion._overrideVisibility=function(){ocultar();escena.traverse(n=>{if(n.visible&&(n.material?.transparent||n.material?.userData?.sinOclusion)){n.visible=false;this._visibilityCache.push(n);}});};}
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.175,.45,1.05),salida=new OutputPass();
  // Oclusión y halo trabajan a media resolución; la escena y el HUD conservan su detalle.
  // El compositor vuelve a llamar setSize al redimensionar: aplicar la escala en cada pasada.
  for(const pasada of [oclusion,resplandor]){const ajustar=pasada.setSize.bind(pasada);pasada.setSize=(w,h)=>ajustar(Math.max(32,Math.round(w*.5)),Math.max(32,Math.round(h*.5)));}
  // Saneado: un píxel NaN o infinito (en Metal salen de cálculos que otras tarjetas toleran) lo agranda el
  // resplandor en cuadros negros. Se descartan valores inválidos y se limita HDR a 16 antes del halo,
  // muy por encima del blanco; así tampoco desbordan sus acumulaciones de media precisión.
  const saneado={enabled:true,needsSwap:true,clear:false,renderToScreen:false,setSize(){},dispose(){},
    mat:new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null}},depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
        float limpio(float x){return (isnan(x)||isinf(x))?0.:clamp(x,0.,16.);}
        void main(){vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(limpio(c.r),limpio(c.g),limpio(c.b),limpio(c.a));}`}),
    render(r,escribir,leer){this.mat.uniforms.tDiffuse.value=leer.texture;r.setRenderTarget(this.renderToScreen?null:escribir);r.render(this.escenaQ,this.camQ);}};
  saneado.escenaQ=new THREE.Scene();saneado.escenaQ.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),saneado.mat));saneado.camQ=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  // Las normales de GTAO reutilizan las sombras calculadas por la escena en este cuadro.
  if(!(laboratorio&&q.get('referencia')==='1')){
    const dibujarOclusion=oclusion.render.bind(oclusion);
    oclusion.render=(r,...args)=>{const actualizar=r.shadowMap.autoUpdate;r.shadowMap.autoUpdate=false;try{return dibujarOclusion(r,...args);}finally{r.shadowMap.autoUpdate=actualizar;}};
  }
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
    g.putImageData(col,0,0);ga.putImageData(alt,0,0);return {map:tex(c,true,[17,17]),normalMap:tex(normales(a,3.5),false,[17,17])};}
  // Quemaduras y ceniza sobre la plaza (una capa que oscurece).
  function quemaduras(){const T=512,[c,g]=lienzoDe(T,T);for(let i=0;i<46;i++){const x=rnd()*T,y=rnd()*T,r=10+rnd()*48,f=g.createRadialGradient(x,y,0,x,y,r);f.addColorStop(0,`rgba(0,0,0,${.45+rnd()*.35})`);f.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=f;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
    const cc=T/2,f=g.createRadialGradient(cc,cc,T*.28,cc,cc,T*.5);f.addColorStop(0,'rgba(0,0,0,0)');f.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=f;g.fillRect(0,0,T,T);return tex(c,true);}

  /* ---- La plaza de Tomsage -------------------------------------------------------- */
  const R=26;// distancia interior de los paños de la muralla
  const PANELES=24,PLANOS_MURALLA=Array.from({length:PANELES},(_,i)=>({x:Math.cos(i*TAU/PANELES),z:Math.sin(i*TAU/PANELES)}));
  const obstaculos=[];// círculos {x,z,r}
  const mundo=new THREE.Group();escena.add(mundo);
  const matSuelo=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,metalness:0,normalScale:new THREE.Vector2(1.2,1.2)});
  const suelo=new THREE.Mesh(new THREE.CircleGeometry(R/Math.cos(Math.PI/PANELES),PANELES).rotateZ(Math.PI/PANELES),matSuelo);suelo.rotation.x=-Math.PI/2;suelo.receiveShadow=true;mundo.add(suelo);
  // La piedra aportada es el piso predeterminado; la comparación conserva la partida.
  async function prepararPruebaPiso(){
    const elegido=q.get('piso')==='actual'?'actual':'vegetacion';
    const panel=$('pruebaPiso'),selector=$('pisoPrueba'),mensaje=$('pisoMensaje');
    panel.hidden=false;selector.disabled=true;mensaje.textContent='Cargando textura…';
    const cargador=new THREE.TextureLoader(),texturas=[];
    try{
      const repeticion=2*R/Math.cos(Math.PI/PANELES)/7.2;
      // Las tres capas comparten UV; sólo el color se interpreta como sRGB.
      const resultados=await Promise.allSettled(['color','normal','superficie'].map(async nombre=>{
        const t=await cargador.loadAsync('./texturas-piso/vegetacion-'+nombre+'.webp');texturas.push(t);
        t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
        t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeticion,repeticion);
        t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;
      }));
      if(resultados.some(r=>r.status==='rejected'))throw Error('No se pudo cargar la textura del piso.');
      const [color,normal,superficie]=resultados.map(r=>r.value);
      const vegetacion=new THREE.MeshStandardMaterial({map:color,normalMap:normal,normalScale:new THREE.Vector2(.7,.7),
        aoMap:superficie,aoMapIntensity:.5,roughnessMap:superficie,roughness:1,metalness:0,envMapIntensity:.35});
      const aplicar=()=>{
        aplicarMaterialPiso(selector.value==='vegetacion'?vegetacion:matSuelo);
        const url=new URL(location.href);url.searchParams.set('piso',selector.value);history.replaceState(null,'',url);
        for(const a of document.querySelectorAll('.apEtapas a')){const destino=new URL(a.href);destino.searchParams.set('piso',selector.value);a.href=destino.href;}
        mensaje.textContent=selector.value==='vegetacion'?'Piedra con vegetación':'Adoquines originales';
        if(listo)dibujarCuadro();
      };
      selector.value=elegido;selector.disabled=false;selector.onchange=aplicar;aplicar();
    }catch(error){
      for(const t of texturas)t.dispose();selector.value='actual';mensaje.textContent='No se pudo cargar la textura; se conserva el piso actual.';
      console.warn(error.message);
    }
  }
  const matPasto=new THREE.MeshStandardMaterial({color:0x4b6337,roughness:1});
  {const [c,g]=lienzoDe(128,128);g.fillStyle='#a5ad91';g.fillRect(0,0,128,128);for(let i=0;i<1800;i++){g.strokeStyle=i%3?'#869377':'#c3c6a4';const x=(i*37.7)%128,y=(i*61.3)%128;g.beginPath();g.moveTo(x,y);g.lineTo(x+(i%3)-1,y-2-i%4);g.stroke();}matPasto.map=tex(c,true,[56,56]);}
  const terreno=new THREE.Mesh(new THREE.CircleGeometry(ABIERTO?112:85,96),matPasto);terreno.rotation.x=-Math.PI/2;terreno.position.y=-.025;terreno.receiveShadow=true;mundo.add(terreno);
  const capaQuemada=new THREE.Mesh(new THREE.PlaneGeometry(44,44),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,color:0xffffff}));capaQuemada.rotation.x=-Math.PI/2;capaQuemada.position.y=.01;mundo.add(capaQuemada);impactoFX.perforar(matPasto);impactoFX.perforar(capaQuemada.material);
  const std=(color,p={})=>new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0,flatShading:true,...p});
  const MAT={teja:std(0x6e2d22,{roughness:.7}),piedra:std(0x6d6760),madera:std(0x5b3d26),hierro:std(0x4a4a50,{metalness:.8,roughness:.4}),oscuro:std(0x15100c)};
  function poner(geo,mat,x,y,z,ry=0,sombra=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=sombra;m.receiveShadow=true;mundo.add(m);return m;}
  const fuegos=[];// casas que arden: llamas y su luz
  const matLlama=new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`attribute float aSem;attribute vec2 aTam;varying vec2 vUv;varying float vS;void main(){vUv=uv;vS=aSem;vec4 mv=modelViewMatrix*vec4(position,1.);mv.x+=(uv.x-.5)*aTam.x;mv+=viewMatrix*vec4(0.,uv.y*aTam.y,0.,0.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uT;varying vec2 vUv;varying float vS;
      float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      void main(){float r=n(vec2(vUv.x*4.+vS*7.,vUv.y*3.-uT*2.6+vS*3.))*.6+n(vec2(vUv.x*9.,vUv.y*7.-uT*4.))*.4;
        float forma=(1.-vUv.y)*(1.-smoothstep(.05,.5,abs(vUv.x-.5)*(1.1+vUv.y*1.6)));float f=smoothstep(.22,.85,forma*(.55+.9*r));
        vec3 c=mix(vec3(1.,.2,.02),vec3(1.,.62,.22),f*f);gl_FragColor=vec4(c*f*1.15,f);}`});
  // Llamas: anchura orientada a cámara, base anclada al soporte y altura vertical en el mundo.
  function llamas(x,y,z,ancho,alto,n,dispersion=1){const g=new THREE.BufferGeometry(),P=[],U=[],S=[],T=[],I=[];
    for(let i=0;i<n;i++){const cx=x+(rnd()-.5)*ancho*dispersion,cz=z+(rnd()-.5)*ancho*.6*dispersion,w=(.5+rnd()*.5)*Math.max(.5,Math.min(1.8,ancho)),h=alto*(.7+rnd()*.6),s=rnd(),o=P.length/3;
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
    for(let a=0;a<TAU;a+=TAU/15){if(CALLES.some(c=>Math.abs(difAng(a,c))<.3))continue;const r=18.8+rnd()*.8,t=tipos[n%tipos.length]==='taberna'&&n!==3?'entramada':tipos[n%tipos.length];
      casa(t,Math.cos(a)*r,Math.sin(a)*r,Math.atan2(-Math.cos(a),-Math.sin(a))+(rnd()-.5)*.15,{semilla:n+2,ancho:t==='entramada'?5.4+rnd()*1.2:undefined,tinteYeso:[1,.95+rnd()*.05,.86+rnd()*.14],tinteTeja:[.8+rnd()*.2,.8+rnd()*.15,.8+rnd()*.15]},[1,4,8].includes(n));n++;}
  }
  // El pozo, un carro volcado, barriles, cajas y dos braseros.
  const braseros=[];
  // El pozo (casas-three.js, con los materiales de las casas): se funde con ellas; el abrevadero queda hacia la plaza.
  {const pozo=CASAS.casa('pozo',{semilla:21});pozo.position.set(-5,0,-3);pozo.rotation.y=.27;barrio.push(pozo);obstaculos.push({x:-5,z:-3,r:1.3},{x:-2.82,z:-2.51,r:.55});
    const carro=new THREE.Group();carro.position.set(6.5,0,-5.5);carro.rotation.set(0,.6,.35);mundo.add(carro);
    const cm=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;carro.add(m);};
    cm(new THREE.BoxGeometry(2.6,.15,1.4),MAT.madera,0,.8,0);for(const s of [-1,1])cm(new THREE.BoxGeometry(2.6,.5,.1),MAT.madera,0,1.1,s*.7);
    cm(new THREE.CylinderGeometry(.55,.55,.12,10),MAT.madera,-.8,.55,.8,Math.PI/2);cm(new THREE.CylinderGeometry(.55,.55,.12,10),MAT.madera,.9,.4,-.85,Math.PI/2,0,.3);obstaculos.push({x:6.5,z:-5.5,r:1.5});
    // La utilería comparte los materiales y el fundido de las casas (incluida su ocultación).
    const barril=(x,z,tumbado)=>{const g=CASAS.utileria('barril',{semilla:Math.round((x+z)*100)+900});g.position.set(x,tumbado?.41:0,z);if(tumbado){g.rotation.set(Math.PI/2,0,.7);g.position.add(new V3(0,-.47,0).applyEuler(g.rotation));}else g.rotation.y=.3;barrio.push(g);};
    barril(-8.5,5,false);barril(-7.8,5.6,false);barril(-8.9,5.9,true);obstaculos.push({x:-8.3,z:5.5,r:1.1});
    for(const [x,z,s] of [[8.2,4.4,.9],[8.9,5.2,.7],[8.4,4.6,.6]]){const g=CASAS.utileria('caja',{tamano:s,semilla:Math.round(x*100)});g.position.set(x,s===.6?.9:0,z);g.rotation.y=rnd();barrio.push(g);}obstaculos.push({x:8.5,z:4.8,r:1});
    // Faroles de forja: zócalo de piedra, fuste acanalado, jaula y remate de cobre.
    const forja=std(0x28313a,{metalness:.55,roughness:.72}),cobre=std(0x967041,{metalness:.5,roughness:.68}),ambar=std(0x6e441b,{emissive:0xffb33e,emissiveIntensity:.28,roughness:1,transparent:true,opacity:.32,depthWrite:false});
    for(const [x,z] of [[-3.5,7.5],[4.5,-10]]){
      poner(new THREE.CylinderGeometry(.32,.4,.18,8),MAT.piedra,x,.09,z);
      poner(new THREE.CylinderGeometry(.16,.25,.22,8),forja,x,.28,z);
      poner(new THREE.CylinderGeometry(.065,.115,1.45,12),forja,x,1.1,z);
      for(const y of [.48,.62,1.68,1.82])poner(new THREE.CylinderGeometry(.13,.13,.06,12),cobre,x,y,z);
      poner(new THREE.CylinderGeometry(.32,.18,.18,8),forja,x,1.98,z);
      poner(new THREE.CylinderGeometry(.29,.29,.07,8),cobre,x,2.09,z);
      for(let i=0;i<8;i++){const a=i*TAU/8;
        poner(new THREE.CylinderGeometry(.022,.028,.68,5),forja,x+Math.cos(a)*.28,2.43,z+Math.sin(a)*.28);
        const cristal=poner(new THREE.PlaneGeometry(.19,.51),ambar,x+Math.cos(a)*.26,2.43,z+Math.sin(a)*.26,a+Math.PI/2,false);cristal.material.side=THREE.DoubleSide;
      }
      poner(new THREE.CylinderGeometry(.31,.31,.07,8),cobre,x,2.78,z);
      poner(new THREE.ConeGeometry(.39,.28,8),forja,x,2.955,z);
      poner(new THREE.SphereGeometry(.07,8,6),cobre,x,3.13,z);
      // La llama nace en la copa, dentro de la jaula; no flota sobre el farol.
      const f=llamas(x,2.12,z,.2,.43,2,0),luz=new THREE.PointLight(0xffbc6b,26,11,1.8);luz.position.set(x,2.45,z);mundo.add(luz);braseros.push({luz,f,x,z});obstaculos.push({x,z,r:.5});}}
  // Todo lo estático de la plaza se funde por material: unas pocas mallas en vez de cientos.
  function fundirMundo(){mundo.updateMatrixWorld(true);const grupos=new Map(),quitar=[];
    mundo.traverse(o=>{if(!o.isMesh||o===suelo||o===terreno||o===capaQuemada||o.material.isShaderMaterial)return;if(!grupos.has(o.material))grupos.set(o.material,[]);grupos.get(o.material).push(o);quitar.push(o);});
    for(const o of quitar)o.parent.remove(o);
    for(const [mat,lista] of grupos){let n=0;const gs=lista.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);n+=g.attributes.position.count;return g;});
      const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2);let i=0;for(const g of gs){P.set(g.attributes.position.array,i*3);N.set(g.attributes.normal.array,i*3);if(g.attributes.uv)U.set(g.attributes.uv.array,i*2);i+=g.attributes.position.count;g.dispose();}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.setAttribute('uv',new THREE.BufferAttribute(U,2));geo.computeBoundingSphere();
      const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=!mat.transparent;mundo.add(m);}}
  // Muralla poligonal: sus caras interiores son exactamente los planos de colisión.
  const selloPuerta=new THREE.MeshBasicMaterial({color:0xffa64c,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  for(let i=0;i<PANELES;i++){
    const a=i*TAU/PANELES,n=calle(a),t=new V3(-n.z,0,n.x),ancho=2*(R+.45)*Math.tan(Math.PI/PANELES),puerta=CALLES.some(c=>Math.abs(difAng(a,c))<.01);
    const pieza=(w,h,d,u,y,r,mat=MAT.piedra)=>poner(new THREE.BoxGeometry(w,h,d),mat,n.x*r+t.x*u,y,n.z*r+t.z*u,Math.PI/2-a);
    if(puerta){
      for(const lado of [-1,1])pieza(.55,4.5,.9,lado*(ancho/2-.275),2.25,R+.45);
      pieza(ancho,.8,.9,0,4.1,R+.45); // Dintel suficientemente alto para el troll.
      // Reja levantada; un sello ámbar visible deja entrar invasores y bloquea al héroe.
      for(let j=-3;j<=3;j++)pieza(.07,.75,.1,j*.45,3.85,R+.05,MAT.hierro);
      if(!ABIERTO)pieza(ancho-.55,3.7,.035,0,1.85,R+.025,selloPuerta);
      for(const lado of [-1,1])pieza(.07,3.7,.07,lado*(ancho/2-.55),1.85,R+.02,MAT.hierro);
      pieza(ancho-.55,.1,.28,0,.05,R+.02,MAT.hierro);
    }else{
      pieza(ancho+.04,3.3,.9,0,1.65,R+.45);
      pieza(ancho+.12,.16,1.05,0,3.3,R+.45);
      for(const u of [-ancho*.35,0,ancho*.35])pieza(.55,.5,.9,u,3.62,R+.45);
      // Juntas y contrafuertes dan escala al lienzo de piedra, sin geometría por ladrillo.
      for(const y of [.65,1.3,1.95,2.6])pieza(ancho,.025,.025,0,y,R-.01,MAT.oscuro);
    }
  }
  // Bosque exterior de pocas mallas, sin luces ni reflejos en cada árbol.
  const follaje=std(0x284632),tronco=std(0x594331),rocaExterior=std(0x55595b);
  for(let i=0;i<(ABIERTO?150:32);i++){
    const a=i*2.399963,r=32+(ABIERTO?(i*19.73)%72:(i*7.1)%35);
    if(CALLES.some(c=>Math.abs(difAng(a,c))<.12))continue;
    const x=Math.cos(a)*r,z=Math.sin(a)*r,h=3+(i%5)*.55;
    poner(new THREE.CylinderGeometry(.18,.32,h,6),tronco,x,h/2,z);
    poner(new THREE.ConeGeometry(1.6,h*.85,7),follaje,x,h*.92,z);
    poner(new THREE.ConeGeometry(1.25,h*.7,7),follaje,x,h*1.2,z);
    if(ABIERTO)obstaculos.push({x,z,r:.4});
  }
  if(ABIERTO){
    for(const a of CALLES){const n=calle(a);const camino=poner(new THREE.BoxGeometry(5,.03,65),std(0x625845),n.x*52,-.008,n.z*52,Math.PI/2-a);camino.castShadow=false;}
    for(const [x,z] of [[0,-55],[52,30],[-65,38]]){poner(new THREE.ConeGeometry(2,2.5,4),std(0x66513b),x+7,1.2,z,Math.PI/4);poner(new THREE.CylinderGeometry(.07,.1,4,6),tronco,x,2,z);poner(new THREE.BoxGeometry(1.1,.7,.04),std(0x8b463d),x+.55,3.5,z);obstaculos.push({x:x+7,z,r:1.8});}
    // Borde del prototipo: un acantilado de roca visible, coincidente con la colisión.
    for(let i=0;i<96;i++){const a=i*TAU/96;poner(new THREE.CylinderGeometry(3.7,4.2,7+(i%3),6),rocaExterior,Math.cos(a)*115,3,Math.sin(a)*115);}
  }
  fundirMundo();
  // Las casas se funden aparte (su módulo conserva el color por vértice y los atributos de las ventanas).
  const casasFundidas=CASAS.fundir(barrio,{ocultables:true});mundo.add(casasFundidas);
  const rayoCasa=new THREE.Ray(),interseccionCasa=new V3(),destinoCasa=new V3();
  function actualizarCasasOcultas(dt){
    const {cajas,opacidades}=casasFundidas.userData.ocultacion;
    for(let i=0;i<cajas.length;i++){
      let tapa=false;
      for(const h of jugadores){if(!h.vivo)continue;
        destinoCasa.copy(h.pos).setY((h.alto||0)+h.m.alto*.6);
        rayoCasa.set(camara.position,destinoCasa.clone().sub(camara.position).normalize());
        if(rayoCasa.intersectBox(cajas[i],interseccionCasa)&&camara.position.distanceTo(interseccionCasa)<camara.position.distanceTo(destinoCasa)-.35){tapa=true;break;}
      }
      opacidades[i]+=((tapa?.18:1)-opacidades[i])*(1-Math.exp(-dt*(tapa?14:7)));
    }
  }
  // Luces: luna azul con sombras (sigue a Adreida), cielo tenue y la luz que ella lleva (el radio de luz de Diablo).
  const hemi=new THREE.HemisphereLight(0x829abd,0x29251f,.5);escena.add(hemi);
  const clima=window.CAOZ_ARPG_CLIMA.fabrica(THREE,escena,{obstaculos,techos:casasFundidas.userData.ocultacion.cajas,abierto:ABIERTO,reducido,perforar:impactoFX.perforar});
  const luna=new THREE.DirectionalLight(0xc1d6ff,2.1);luna.castShadow=true;luna.shadow.mapSize.set(CAPTURA?2048:1024,CAPTURA?2048:1024);luna.shadow.radius=3;luna.shadow.blurSamples=12;luna.shadow.bias=-.0004;luna.shadow.normalBias=.03;
  Object.assign(luna.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:70});escena.add(luna,luna.target);
  const luzHeroe=new THREE.PointLight(0xffd2a0,40,16,1.5);escena.add(luzHeroe);

  /* ---- Partículas, marcas en el suelo y números ------------------------------------ */
  const NP=2400,pPos=new Float32Array(NP*3),pCol=new Float32Array(NP*4),pTam=new Float32Array(NP),pVel=new Float32Array(NP*3),pVida=new Float32Array(NP),pMax=new Float32Array(NP),pGrav=new Float32Array(NP),pBase=new Float32Array(NP*4);
  let pSig=0;const escPuntos={value:1};
  const geoP=new THREE.BufferGeometry();geoP.setAttribute('position',new THREE.BufferAttribute(pPos,3).setUsage(THREE.DynamicDrawUsage));geoP.setAttribute('aColor',new THREE.BufferAttribute(pCol,4).setUsage(THREE.DynamicDrawUsage));geoP.setAttribute('aTam',new THREE.BufferAttribute(pTam,1).setUsage(THREE.DynamicDrawUsage));
  const puntos=new THREE.Points(geoP,new THREE.ShaderMaterial({uniforms:{uEsc:escPuntos},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aTam;attribute vec4 aColor;uniform float uEsc;varying vec4 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aTam*uEsc*60./(-mv.z);vC=aColor;}`,
    fragmentShader:`varying vec4 vC;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.05,.5,d);gl_FragColor=vec4(vC.rgb,vC.a*a*.7);}`}));
  puntos.frustumCulled=false;puntos.renderOrder=3;escena.add(puntos);
  function particula(x,y,z,vx,vy,vz,vida,tam,r,g,b,grav=0){const i=pSig;pSig=(pSig+1)%NP;pPos.set([x,y,z],i*3);pVel.set([vx,vy,vz],i*3);pVida[i]=vida;pMax[i]=vida;pTam[i]=tam;pBase.set([r,g,b,1],i*4);pGrav[i]=grav;}
  function chispas(p,n,color=[1,.7,.3],vel=6,tam=.5){for(let i=0;i<n;i++){const a=rnd()*TAU,e=rnd()*1.2-.1,v=vel*(.4+rnd()*.8);particula(p.x,p.y,p.z,Math.cos(a)*Math.cos(e)*v,Math.sin(e)*v+1,Math.sin(a)*Math.cos(e)*v,.35+rnd()*.4,tam*(.6+rnd()*.8),color[0]*3,color[1]*3,color[2]*3,14);}}
  function polvo(p,n,radio=1){for(let i=0;i<n;i++){const a=rnd()*TAU,v=2+rnd()*4;particula(p.x+Math.cos(a)*radio*.3,.2,p.z+Math.sin(a)*radio*.3,Math.cos(a)*v,.6+rnd()*1.4,Math.sin(a)*v,.6+rnd()*.5,1.4+rnd()*1.2,.35,.28,.22,-1);}}
  function brasas(p,n,alto=1.2){for(let i=0;i<n;i++)particula(p.x+(rnd()-.5)*.8,p.y+rnd()*alto,p.z+(rnd()-.5)*.8,(rnd()-.5)*1.2,1+rnd()*2.4,(rnd()-.5)*1.2,.8+rnd()*1.1,.35+rnd()*.4,3,.9,.2,-.6);}
  function pasoParticulas(dt){for(let i=0;i<NP;i++){if(pVida[i]<=0){pCol[i*4+3]=0;continue;}pVida[i]-=dt;const j=i*3;pVel[j+1]-=pGrav[i]*dt;const fr=Math.exp(-dt*1.6);pVel[j]*=fr;pVel[j+2]*=fr;
    pPos[j]+=pVel[j]*dt;pPos[j+1]+=pVel[j+1]*dt;pPos[j+2]+=pVel[j+2]*dt;if(pPos[j+1]<.03){pPos[j+1]=.03;pVel[j+1]*=-.3;}
    const k=Math.max(0,pVida[i]/pMax[i]);pCol[i*4]=pBase[i*4];pCol[i*4+1]=pBase[i*4+1];pCol[i*4+2]=pBase[i*4+2];pCol[i*4+3]=Math.min(1,k*1.6);}
    geoP.attributes.position.needsUpdate=geoP.attributes.aColor.needsUpdate=geoP.attributes.aTam.needsUpdate=true;}
  // Ropa incendiada: nueve llamas siguen los huesos; el humo usa una reserva de veinte motas.
  // Sólo dos llamadas de dibujo mientras arde, sin luces ni sombras adicionales.
  const fuegosRopa=new Map(),matFuegoRopa=matLlama.clone();
  matFuegoRopa.uniforms.uT=tiempo;
  matFuegoRopa.blending=THREE.NormalBlending;
  matFuegoRopa.fragmentShader=matLlama.fragmentShader.replace('c*f*1.15,f','c*vec3(1.6,.85,.5)*(.8+f*1.25),min(1.,f*1.45)');
  const matHumoRopa=new THREE.ShaderMaterial({uniforms:{uEsc:escPuntos},transparent:true,depthWrite:false,
    vertexShader:`attribute vec2 aHumo;uniform float uEsc;varying float vEdad;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vEdad=aHumo.x;gl_Position=projectionMatrix*mv;gl_PointSize=aHumo.y*uEsc*450.*projectionMatrix[1][1]/max(.1,-mv.z);}`,
    fragmentShader:`varying float vEdad;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float nube=1.-smoothstep(.08,.5,d);nube*=.8+.2*sin(p.x*18.+vEdad*6.)*sin(p.y*15.-vEdad*4.);float a=smoothstep(0.,.12,vEdad)*(1.-smoothstep(.25,1.,vEdad));gl_FragColor=vec4(mix(vec3(.24,.22,.21),vec3(.48,.47,.46),vEdad),nube*a*.38);}`});
  function crearFuegoRopa(h){const anclas=[];
    for(let i=0;i<7;i++){const a=(i+.5)*TAU/7+.08;anclas.push({hueso:h.m.H['falda'+i],local:new V3(Math.sin(a)*.27,-.22,Math.cos(a)*.22)});}
    for(const lado of [-1,1])anclas.push({hueso:h.m.H.torso,local:new V3(lado*.23,.26,-.13)});
    const p=[],uv=[],sem=[],tam=[],indices=[];
    anclas.forEach((a,i)=>{for(const [u,v]of [[0,0],[1,0],[1,1],[0,1]]){p.push(0,0,0);uv.push(u,v);sem.push(i*.173);tam.push(i<7?.6:.48,i<7?1.05:.8);}const o=i*4;indices.push(o,o+1,o+2,o,o+2,o+3);});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('aSem',new THREE.Float32BufferAttribute(sem,1));geo.setAttribute('aTam',new THREE.Float32BufferAttribute(tam,2));geo.setIndex(indices);
    const llama=new THREE.Mesh(geo,matFuegoRopa),humoGeo=new THREE.BufferGeometry();
    humoGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(60),3).setUsage(THREE.DynamicDrawUsage));humoGeo.setAttribute('aHumo',new THREE.BufferAttribute(new Float32Array(40),2).setUsage(THREE.DynamicDrawUsage));
    const humo=new THREE.Points(humoGeo,matHumoRopa);llama.frustumCulled=humo.frustumCulled=false;llama.renderOrder=2;humo.renderOrder=3;escena.add(llama,humo);
    const f={anclas,llama,humo,motas:[],acum:0,siguiente:0,punto:new V3()};fuegosRopa.set(h,f);return f;
  }
  function pasoFuegoRopa(h,dt){let f=fuegosRopa.get(h);const arde=!!h.incendio&&h.vivo;if(!f){if(!arde)return;f=crearFuegoRopa(h);}
    f.llama.visible=arde;
    if(arde){h.m.raiz.updateMatrixWorld(true);const p=f.llama.geometry.attributes.position;
      f.anclas.forEach((a,i)=>{f.punto.copy(a.local).applyMatrix4(a.hueso.matrixWorld);for(let j=0;j<4;j++)p.setXYZ(i*4+j,f.punto.x,f.punto.y,f.punto.z);});p.needsUpdate=true;
      f.acum+=dt;while(f.acum>=.1){f.acum-=.1;const i=f.siguiente++%f.anclas.length,a=f.anclas[i];f.punto.copy(a.local).applyMatrix4(a.hueso.matrixWorld);f.punto.y+=.25;
        if(f.motas.length<20)f.motas.push({pos:f.punto.clone(),edad:0,sem:i});}
    }else f.acum=0;
    const g=f.humo.geometry;let n=0;
    for(let i=f.motas.length-1;i>=0;i--){const m=f.motas[i];m.edad+=dt;if(m.edad>=1.6){f.motas.splice(i,1);continue;}
      m.pos.x+=dt*(.18+Math.sin(m.sem*2+m.edad*3)*.13);m.pos.y+=dt*.85;m.pos.z+=dt*.08;
      g.attributes.position.setXYZ(n,m.pos.x,m.pos.y,m.pos.z);g.attributes.aHumo.setXY(n,m.edad/1.6,.34+m.edad*.5);n++;}
    g.setDrawRange(0,n);g.attributes.position.needsUpdate=g.attributes.aHumo.needsUpdate=true;f.humo.visible=n>0;
  }
  function limpiarFuegoRopa(){for(const f of fuegosRopa.values()){escena.remove(f.llama,f.humo);f.llama.geometry.dispose();f.humo.geometry.dispose();}fuegosRopa.clear();}
  // Adoquines arrancados por el salto: una sola malla y una reserva reutilizable.
  const MAX_ESCOMBROS=72,escombros=[],moldeEscombro=new THREE.Object3D();
  const materialEscombrosInicial=std(0x79716a);
  const mallaEscombros=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),materialEscombrosInicial,MAX_ESCOMBROS);
  const uvEscombros=new THREE.InstancedBufferAttribute(new Float32Array(MAX_ESCOMBROS*4),4).setUsage(THREE.DynamicDrawUsage);
  mallaEscombros.geometry.setAttribute('aPisoEscombro',uvEscombros);
  const materialesEscombros=new Map(),diametroPiso=2*R/Math.cos(Math.PI/PANELES);
  // Cada fragmento conserva una pequeña porción del suelo de donde salió, incluso al girar.
  // Comparte las texturas y su escala; las 72 instancias siguen en una sola llamada.
  function aplicarMaterialPiso(material){
    suelo.material=material;impactoFX.actualizarMaterial(material);
    if(!materialesEscombros.has(material)){
      const m=material.clone();m.flatShading=true;
      m.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aPisoEscombro;');
        const capas=[['USE_MAP','vMapUv','mapTransform'],['USE_NORMALMAP','vNormalMapUv','normalMapTransform'],
          ['USE_AOMAP','vAoMapUv','aoMapTransform'],['USE_ROUGHNESSMAP','vRoughnessMapUv','roughnessMapTransform']];
        const uv='vec2 uvPiedra = aPisoEscombro.xy + (uv - 0.5) * aPisoEscombro.zw;';
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n'+uv+'\n'+
          capas.map(([uso,v,t])=>`#ifdef ${uso}\n${v} = ( ${t} * vec3( uvPiedra, 1.0 ) ).xy;\n#endif`).join('\n'));
      };
      m.customProgramCacheKey=()=> 'piso-escombros-v1';materialesEscombros.set(material,m);
    }
    if(mallaEscombros.material===materialEscombrosInicial)materialEscombrosInicial.dispose();
    mallaEscombros.material=materialesEscombros.get(material);
  }
  mallaEscombros.count=0;mallaEscombros.frustumCulled=false;mallaEscombros.castShadow=mallaEscombros.receiveShadow=true;
  mallaEscombros.instanceMatrix.setUsage(THREE.DynamicDrawUsage);escena.add(mallaEscombros);
  function romperPiso(p){for(let i=0;i<24;i++){
    const a=(i+rnd()*.7)*TAU/24,r=.45+rnd()*1.45,v=1.4+rnd()*2.5,s=.18+rnd()*.22;
    const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,c=Math.cos(Math.PI/PANELES),sen=Math.sin(Math.PI/PANELES);
    // La geometría circular fue girada antes de apoyarla sobre XZ: deshacer ese giro en las UV.
    const uvPiso=new THREE.Vector4(.5+(x*c-z*sen)/diametroPiso,.5+(-x*sen-z*c)/diametroPiso,2*s/diametroPiso,2*s/diametroPiso);
    if(escombros.length===MAX_ESCOMBROS)escombros.shift();
    escombros.push({pos:new V3(x,.09,z),uvPiso,vel:new V3(Math.cos(a)*v,4+rnd()*4,Math.sin(a)*v),
      giro:new V3(rnd(),rnd()*TAU,rnd()),rot:new V3((rnd()-.5)*9,(rnd()-.5)*8,(rnd()-.5)*9),
      escala:new V3(s,.08+rnd()*.1,s*(.7+rnd()*.6)),vida:2.2+rnd()*.7,rebotes:0});}}
  function pasoEscombros(dt){let n=0;
    for(let i=escombros.length-1;i>=0;i--){const e=escombros[i];e.vida-=dt;if(e.vida<=0){escombros.splice(i,1);continue;}
      if(e.rebotes<2){e.vel.y-=18*dt;e.pos.addScaledVector(e.vel,dt);e.giro.addScaledVector(e.rot,dt);
        if(e.pos.y<=e.escala.y&&e.vel.y<0){e.pos.y=e.escala.y;e.rebotes++;e.vel.y*=-.25;e.vel.x*=.55;e.vel.z*=.55;e.rot.multiplyScalar(.45);
          if(e.rebotes===2){e.giro.x=e.giro.z=0;}}}
      const k=Math.min(1,e.vida/.55);moldeEscombro.position.copy(e.pos);moldeEscombro.position.y-=e.escala.y*(1-k);
      moldeEscombro.rotation.set(e.giro.x,e.giro.y,e.giro.z);moldeEscombro.scale.copy(e.escala).multiplyScalar(k);moldeEscombro.updateMatrix();mallaEscombros.setMatrixAt(n,moldeEscombro.matrix);
      uvEscombros.setXYZW(n,e.uvPiso.x,e.uvPiso.y,e.uvPiso.z,e.uvPiso.w);n++;}
    mallaEscombros.count=n;mallaEscombros.instanceMatrix.needsUpdate=uvEscombros.needsUpdate=true;}
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
    cobrador:{vida:46,dano:15,vel:2.7,alcance:1.05,aviso:.95,golpe:.18,recupera:.9,cd:1.5,forma:'cono',radio:2,ang:.85,botin:.35,globo:.125},
    troll:{vida:1100,dano:30,vel:1.85,alcance:2.6,aviso:1.3,golpe:.3,recupera:1.5,cd:1.6,forma:'cono',radio:3.8,ang:1.1,aguante:true,jefe:true,botin:1,globo:1},
    goblin:{vida:34,dano:13,vel:2.85,alcance:1.05,aviso:.85,golpe:.18,recupera:.8,cd:1.35,forma:'cono',radio:2,ang:.85,botin:.24,globo:.09},
    kobold:{vida:26,dano:16,vel:2.65,alcance:11,aviso:1.1,golpe:.3,recupera:.8,cd:2.4,forma:'linea',largo:13,ancho:.8,botin:.3,globo:.1,lanza:true},
    saqueador:{vida:100,dano:24,vel:2.85,alcance:1.5,aviso:.85,golpe:.2,recupera:.8,cd:1.15,forma:'cono',radio:2.5,ang:1,aguante:true,botin:.6,globo:.2},
    can:{vida:800,dano:32,vel:2.5,alcance:2.3,aviso:1,golpe:.22,recupera:1.05,cd:1.35,forma:'cono',radio:3.3,ang:.9,aguante:true,jefe:true,botin:1,globo:1},
  };
  const HAB={ulti:{coste:0,cd:90},torbellino:{coste:30,cd:0},salto:{coste:25,cd:5},provocar:{coste:0,cd:10},bumeran:{coste:0,cd:10},esquiva:{coste:0,cd:1.05},parry:{coste:0,cd:.5}};
  // Parry (Espacio): Adreida alza el hacha 0,35 s. Si el golpe llega en las primeras 0,18 s es perfecto: no hace daño,
  // aturde al atacante (2 s; 1 s el jefe) y lo deja expuesto (tus golpes le hacen el doble). Más tarde, bloquea el 70%.
  // Un parry al aire deja medio segundo sin poder repetirlo. Por la espalda no se para, ni el golpazo de Can (se esquiva).
  const PARRY={dur:.35,perfecto:.18,perfectoLanza:.25,cd:.5,bloqueo:.3,aturde:2,aturdeJefe:1,expuesto:2};
  const hitboxMat=new THREE.MeshBasicMaterial({visible:false});
  let heroe=null,sigId=1;const jugadores=[];const enemigos=[],lanzas=[],globos=[];
  function cuerpoDe(tipo,varianteGoblin){const m=MOD.crear(tipo,{varianteGoblin:tipo==='goblin'||tipo==='cobrador'?(varianteGoblin||MOD.elegirVarianteGoblin(rnd)):'clasico'});const caja=new THREE.Mesh(new THREE.CylinderGeometry(m.radio*1.35,m.radio*1.35,m.alto*1.05,10).translate(0,m.alto*.52,0),hitboxMat);m.raiz.add(caja);m.caja=caja;escena.add(m.raiz);return m;}
  // Se juega con Adreida (cuerpo a cuerpo, el hacha a dos manos) o con Mohamed (a distancia, una pistola de seis balas).
  const HEROES={adreida:{nombre:'Adreida',alma:120,atq:12,retrato:'lider_adreida'},
    mohamed:{nombre:'Mohamed',alma:100,atq:9,retrato:'lider_mohamed',cargador:6,cadencia:.24,recarga:1.1,alcance:15,vel:30}};
  let tipoHeroe=q.get('heroe')==='mohamed'?'mohamed':'adreida';
  const aDistancia=()=>heroe?.tipo==='mohamed';
  function crearHeroe(tipo=tipoHeroe){const T=HEROES[tipo],m=cuerpoDe(tipo);heroe={id:jugadores.length,tipo,m,pos:new V3(0,0,4),dir:Math.PI,giro:0,estado:'quieto',t:0,alma:T.alma,almaMax:T.alma,furia:0,atqBase:T.atq,atq:T.atq,basicos:1,especial:1,dash:1,
    balas:T.cargador||0,recargaT:0,cadT:0,disparoT:9,disparos:0,ultiT:0,sigilo:0,bumeran:null,recogeHacha:0,cd:{salto:0,provocar:0,bumeran:0,esquiva:0,parry:0,ulti:0},parrys:0,bloqueos:0,parryExito:false,escudo:0,fase:0,paso:0,golpeo:false,torbellino:null,
    incendio:null,carga:0,bloqueoBasico:false,saltoMando:false,acortarSalto:0,combo:0,finGolpe:-9,invul:0,vatq:1,dirEsq:new V3(),destello:0,brilloParry:0,dolor:1,vivo:true,botin:[],llaves:0,objetivoSalto:null,origenSalto:null,radio:m.radio,muerteT:0,golpeDe:null};m.caja.userData.heroe=true;
    heroe.entrada={...ent,suelo:new V3(),rev:null,atacando:false,pendiente:false,piloto:false};heroe.control={mov:new V3(),atacar:false,apunta:null};heroe.mando={...mando,indice:null,botones:[],dir:new V3(0,0,-1),activo:false,listo:false};heroe.disparosPendientes=[];
    jugadores.push(heroe);return heroe;}
  function conHeroe(h,fn){const anterior=[heroe,ent,ctl,mando,disparosPendientes];heroe=h;ent=h.entrada;ctl=h.control;mando=h.mando;disparosPendientes=h.disparosPendientes;
    try{return fn();}finally{[heroe,ent,ctl,mando,disparosPendientes]=anterior;}}
  function crearEquipo(){jugadores.length=0;const principal=crearHeroe(COOP?'adreida':tipoHeroe);if(COOP){crearHeroe('mohamed').pos.x=2;}heroe=principal;ent=principal.entrada;ctl=principal.control;mando=principal.mando;disparosPendientes=principal.disparosPendientes;tipoHeroe=principal.tipo;rotulos();}
  function objetivoEnemigo(e){
    const visibles=jugadores.filter(h=>h.vivo&&h.sigilo<=0),actual=visibles.find(h=>h.id===e.objetivo);
    if(actual&&(e.ataque||reloj.t<(e.objetivoHasta||0)))return actual;
    const cercano=visibles.sort((a,b)=>plano(a.pos,e.pos)-plano(b.pos,e.pos))[0];
    const elegido=actual&&cercano&&plano(actual.pos,e.pos)<plano(cercano.pos,e.pos)+2?actual:cercano||jugadores.find(h=>h.vivo)||jugadores[0];
    e.objetivo=elegido.id;e.objetivoHasta=reloj.t+1.2;return elegido;
  }

  function crearEnemigo(tipo,x,z,opc={}){const m=cuerpoDe(tipo,opc.varianteGoblin),d={...DEF[tipo],vida:Math.round(DEF[tipo].vida*(1+.25*(rog.vuelta-1)))*FACTOR_COOP,dano:Math.round(DEF[tipo].dano*(1+.1*(rog.vuelta-1)))},e={id:sigId++,tipo,m,d,pos:new V3(x,0,z),dir:rumbo(new V3(x,0,z),new V3()),vida:d.vida,vidaMax:d.vida,estado:opc.quieto?'quieto':'entra',t:0,cd:.4+rnd()*.8,emp:new V3(),fase:rnd()*TAU,paso:0,
      destello:0,radio:m.radio,sector:sectorLibre(x,z),turnoHasta:0,ultimoTurno:-10,rodeo:(rnd()-.5)*1.6,provocado:0,dentro:Math.hypot(x,z)<R-.5,quieto:!!opc.quieto,ataques:0,gritó:false,ataque:null,alerta:null,aturdidoT:0,estrellas:null,culpableT:-9};
    e.ia=window.CAOZ_ARPG_IA?.crear(e)||null;
    m.caja.userData.enemigo=e;m.raiz.position.copy(e.pos);enemigos.push(e);return e;}

  /* ---- Cartas de botín (three-carta.js) -------------------------------------------- */
  const F=C.fabrica(THREE,renderer);const SB=.3,MIRA=3.2;
  const imagen=url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});
  const cacheTex=new Map(),dorso={mat:null};
  async function texturasDe(id,ed){const k=id+'/'+ed;if(!cacheTex.has(k))cacheTex.set(k,(async()=>{const a=window.ARPG_THREE_ARTE[k],img=await imagen('./'+a.url);
    const p=CAOZ_CARTA_PINTOR.texturas({id,acabado:ed,arte:{img,enc:a.enc},ancho:512});const [c,g]=lienzoDe(96,134);g.drawImage(p.color,0,0,96,134);return {tx:F.texturas(p),miniatura:c.toDataURL('image/jpeg',.85)};})());return cacheTex.get(k);}
  const EDICIONES={normal:{nombre:'Normal',mult:1,color:0xd8d0c0,haz:.12},foil:{nombre:'Foil',mult:1.5,color:0x7fd8ff,haz:.55},dorado:{nombre:'Dorado',mult:2,color:0xffc850,haz:1.1}};
  const POOL=['mazo','arco','collar','espadaluz','espadaboveda','lentesmachete','sombrero','brazosagua'];
  // Azar independiente del combate: enteros uniformes sin sesgo de módulo.
  const DESTINO=(()=>{
    const tipos=[['mazo','basicos'],['arco','rapidez'],['collar','vida'],['espadaluz','especial'],['espadaboveda','basicos'],['lentesmachete','rapidez'],['sombrero','dash'],['brazosagua','vida']];
    const niveles=[{nombre:'Conservadora',min:2,gana:10,pierde:0,dash:8,ed:'normal'},{nombre:'Temeraria',min:17,gana:50,pierde:10,dash:30,ed:'foil'},{nombre:'Descomunal',min:19,gana:200,pierde:15,dash:60,ed:'dorado'}];
    const etiquetas={basicos:'daño de básicos',rapidez:'velocidad de ataque',vida:'vida máxima',especial:'daño de habilidades',dash:'cooldown del dash'};
    function entero(n){const a=new Uint32Array(1),limite=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limite);return a[0]%n;}
    function barajar(a,azar=entero){a=[...a];for(let i=a.length-1;i>0;i--){const j=azar(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
    function repartir(azar=entero){const cartas=barajar(tipos,azar).slice(0,3),riesgos=barajar(niveles,azar);return cartas.map(([id,stat],i)=>{const r=riesgos[i];return {id,stat,...r,bueno:stat==='dash'?-r.dash:r.gana,malo:stat==='dash'?r.pierde:r.pierde*-1};});}
    function texto(c,exito){const v=exito?c.bueno:c.malo;return (v>0?'+':'−')+Math.abs(v)+' % '+etiquetas[c.stat];}
    function resolver(efectos,c,dado){if(!Number.isInteger(dado)||dado<1||dado>20)throw Error('Tirada inválida');if(dado===1)return {efectos:efectos.filter(e=>!e.positivo),tipo:'critico'};
      const positivo=dado>=c.min;return {efectos:[...efectos,{id:c.id,stat:c.stat,valor:positivo?c.bueno:c.malo,positivo}],tipo:positivo?'beneficio':'riesgo'};}
    function factores(efectos){const f={basicos:1,rapidez:1,vida:1,especial:1,dash:1};for(const e of efectos)f[e.stat]*=1+e.valor/100;return f;}
    return {entero,repartir,texto,resolver,factores,etiquetas};
  })();
  const rog={vuelta:1,nivel:0,cartas:[],mano:[],efectos:[],emitidas:0,bajas:0,abierto:false,resuelto:false,elegida:0,terminado:-1,botones:[],direccion:0};
  function iniciarDestino(nivel){rog.nivel=nivel;rog.cartas=DESTINO.repartir();rog.mano=[];rog.emitidas=0;rog.bajas=0;rog.resuelto=false;rog.elegida=0;$('botin').innerHTML='';}
  function soltarDestino(p){if(rog.emitidas>=3||!rog.cartas.length)return;const c=rog.cartas[rog.emitidas++];soltar(c.id,c.ed,p.x,p.z,p.clone().setY(1.2),c);}
  function aplicarDestino(){const f=DESTINO.factores(rog.efectos);for(const h of jugadores){const proporcion=h.alma/h.almaMax;h.basicos=f.basicos;h.especial=f.especial;h.dash=f.dash;h.vatq=f.rapidez;
    h.almaMax=Math.max(1,Math.round(HEROES[h.tipo].alma*f.vida));h.alma=h.vivo?Math.max(1,Math.min(h.almaMax,proporcion*h.almaMax)):0;}}
  function pintarDestino(){const c=rog.mano[rog.elegida];$('destinoTitulo').textContent=(COOP?'Destino compartido · ':'')+'Nivel '+rog.nivel+' completado · Vuelta '+rog.vuelta;
    $('destinoCartas').innerHTML=rog.mano.map((c,i)=>`<button type="button" class="apDestinoCarta" data-destino="${i}" aria-pressed="${i===rog.elegida}" ${rog.resuelto||rog.tirando?'disabled':''}><img src="${c.miniatura}" alt="${CARDS[c.id].n}"><strong>${CARDS[c.id].n}</strong><em>${c.nombre}</em><span class="apDestinoBueno">${c.min}–20 · ${(21-c.min)*5}%<br>${DESTINO.texto(c,true)}</span>${c.min>2?`<span class="apDestinoMalo">2–${c.min-1} · ${(c.min-2)*5}%<br>${DESTINO.texto(c,false)}</span>`:`<span class="apDestinoBueno">Beneficio en todas las tiradas salvo el 1</span>`}<span>1 · 5% · Pierdes todos los buffs positivos</span></button>`).join('');
    $('destinoTirar').disabled=rog.resuelto||rog.tirando;$('destinoTirar').textContent=rog.tirando?'Tirando d20…':rog.resuelto?'Tirada resuelta':'Elegir '+CARDS[c.id].n+' y tirar d20';$('destinoSeguir').hidden=!rog.resuelto;
    $('destinoSeguir').textContent=ABIERTO?'Volver a explorar':ol.i===OLEADAS.length-1?'Siguiente vuelta · Enemigos más fuertes':'Entrar al siguiente nivel';
    $('destinoEfectos').textContent=rog.efectos.length?rog.efectos.map(e=>(e.valor>0?'+':'−')+Math.abs(e.valor)+'% '+DESTINO.etiquetas[e.stat]).join(' · '):'Sin efectos acumulados';}
  function abrirDestino(){if(rog.abierto)return;rog.abierto=true;rog.tirando=false;rog.tirada=(rog.tirada||0)+1;$('dadoNumero').textContent='?';$('dadoDestino').classList.remove('rodando');rog.resuelto=false;rog.elegida=0;rog.botones=[];rog.direccion=0;
    ent.atacando=ent.pendiente=false;teclas.clear();ctl.mov.set(0,0,0);ctl.atacar=false;cambiar(heroe,'quieto');heroe.alto=0;
    limpiarPeligrosTroll();$('destinoResultado').textContent=(COOP?'La misma tirada aplica sus beneficios o penalizaciones a ambos héroes. ':'')+'Elige una carta. Las otras dos se descartan. Los efectos se acumulan multiplicándose; las penalizaciones sobreviven al 1.';
    pintarDestino();$('destino').showModal();$('destinoCartas').querySelector('button').focus();}
  function animarDado(dado){const el=$('dadoDestino'),numero=$('dadoNumero'),token=rog.tirada;el.classList.add('rodando');
    return new Promise(resolve=>{let paso=0;const tick=()=>{if(!rog.abierto||rog.tirada!==token){resolve();return;}numero.textContent=String((paso*7+3)%20+1);
      if(++paso<18){setTimeout(tick,60);return;}el.classList.remove('rodando');numero.textContent=String(dado);resolve();};tick();});}
  function tirarDestino(){if(!rog.abierto||rog.resuelto||rog.tirando)return;rog.tirando=true;const tirada=rog.tirada,c=rog.mano[rog.elegida],dado=DESTINO.entero(20)+1;
    $('destinoResultado').textContent='El d20 está rodando…';pintarDestino();
    return animarDado(dado).then(()=>{if(!rog.abierto||rog.tirada!==tirada)return;rog.tirando=false;rog.resuelto=true;
      const antes=rog.efectos.filter(e=>e.positivo).length,r=DESTINO.resolver(rog.efectos,c,dado);rog.efectos=r.efectos;aplicarDestino();
      $('destinoResultado').textContent='d20: '+dado+' · '+(r.tipo==='critico'?'¡CRÍTICO! Pierdes '+antes+' buffs positivos. Conservas tus penalizaciones.':(r.tipo==='beneficio'?'¡BENEFICIO! ':'RIESGO: ')+DESTINO.texto(c,r.tipo==='beneficio'));
      pintarDestino();$('destinoSeguir').focus();});}
  function seguirDestino(){if(!rog.abierto||!rog.resuelto)return;rog.terminado=ol.i;rog.abierto=false;$('destino').close();
    ent.atacando=ent.pendiente=false;teclas.clear();for(const h of jugadores){h.mando.listo=h.mando.activo=false;h.entrada.atacando=h.entrada.pendiente=false;h.invul=.5;if(!h.vivo){h.vivo=true;h.alma=h.almaMax*.5;cambiar(h,'quieto');h.muerteT=0;h.pos.copy(heroe.pos).add(new V3(2,0,0));}}
    for(const b of [...botines])quitarBotin(b);ol.descanso=.8;
    if(ABIERTO){if(exploracion.activa)exploracion.activa.limpio=true;exploracion.activa=null;return;}
    if(ol.i===OLEADAS.length-1){rog.vuelta++;ol.i=-1;ol.fin=false;rog.terminado=-2;}}
  function mandoDestino(){if(document.hidden||!mando.foco){rog.botones=[];return;}const g=Array.from(navigator.getGamepads?.()||[]).find(g=>g?.connected&&g.mapping==='standard');if(!g)return;
    const b=g.buttons.map(b=>b.pressed||b.value>.5),direccion=g.axes[0]>.55||b[15]?1:g.axes[0]<-.55||b[14]?-1:0;
    if(!rog.botones.length){rog.botones=b;rog.direccion=direccion;return;}
    if(!rog.resuelto&&!rog.tirando&&direccion&&direccion!==rog.direccion){rog.elegida=(rog.elegida+direccion+3)%3;pintarDestino();$('destinoCartas').querySelectorAll('button')[rog.elegida].focus();}
    const confirmar=b[0]&&!rog.botones[0];rog.botones=b;rog.direccion=direccion;if(confirmar){if(rog.resuelto)seguirDestino();else tirarDestino();}}
  $('destinoCartas').onclick=e=>{const b=e.target.closest('[data-destino]');if(!b||rog.resuelto||rog.tirando)return;rog.elegida=Number(b.dataset.destino);pintarDestino();$('destinoCartas').querySelectorAll('button')[rog.elegida].focus();};
  $('destinoTirar').onclick=tirarDestino;$('destinoSeguir').onclick=seguirDestino;$('destino').addEventListener('cancel',e=>e.preventDefault());
  // Cartas que dan velocidad de ataque (por su tema: el arco, los lentes, el sombrero, la espada ligera), en % por edición.
  const VELOCIDAD={arco:12,lentesmachete:9,sombrero:8,espadaboveda:7};
  function bono(id,ed){const c=CARDS[id],k=EDICIONES[ed].mult;if(id==='llavemago')return {llave:1,texto:'Abre una Grieta del Editor'};
    let atq=Math.round((c.mod?.a||0)*1.5*k),alma=Math.round((c.mod?.h||0)*6*k);const vel=Math.round((VELOCIDAD[id]||0)*k);if(!atq&&!alma&&!vel){atq=Math.round(1*k);alma=Math.round(6*k);}
    return {atq,alma,vel,texto:[atq?'+'+atq+' ATQ':'',alma?'+'+alma+' Alma':'',vel?'+'+vel+'% vel. ataque':''].filter(Boolean).join(' · ')};}
  const botines=[];
  const matHaz=new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uT;uniform vec3 uC;uniform float uF;varying vec2 vUv;void main(){float a=pow(max(1.-vUv.y,0.),1.6)*(.75+.25*sin(vUv.x*TAU*3.+uT*3.));gl_FragColor=vec4(uC*uF,a);}`.replace('TAU','6.2832')});
  // Sólo el botín de este ARPG: acabado mate para que las dos luces de los héroes no cieguen la cámara.
  function suavizarCarta(g){g.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m.isMeshStandardMaterial)continue;
    m.roughness=.95;m.roughnessMap=null;m.metalness=0;m.metalnessMap=null;m.envMapIntensity=0;m.anisotropy=0;m.clearcoat=0;m.iridescence=0;m.specularIntensity=0;m.normalScale?.setScalar(.2);
    if(m.userData.u?.uDestellos)m.userData.u.uDestellos.value=0;m.needsUpdate=true;}});}
  async function soltar(id,ed,x,z,desde,contrato=null){
    const b={id,ed,listo:false,pos:new V3(x,0,z),vel:new V3(),y:desde?1.2:.1,vy:0,volando:!!desde,t0:reloj.t,mirada:0,recogida:false,contrato,bono:contrato?{texto:'Guardada para el final del nivel · '+contrato.nombre}:bono(id,ed)};botines.push(b);
    if(desde){const a=rnd()*TAU,v=1.5+rnd()*1.8;b.pos.copy(desde);b.vel.set(Math.cos(a)*v,0,Math.sin(a)*v);b.vy=6.5;}
    const {tx,miniatura}=await texturasDe(id,ed);if(!botines.includes(b))return b;b.miniatura=miniatura;
    const g=F.carta(F.materialCara(tx,ed),dorso.mat,F.materialCanto(ed));if(COOP)suavizarCarta(g);g.scale.setScalar(SB);escena.add(g);b.g=g;
    b.caja=new THREE.Mesh(new THREE.BoxGeometry(ANCHO*SB*1.5,ALTO*SB*1.3,.8),hitboxMat);b.caja.userData.botin=b;escena.add(b.caja);
    const E=EDICIONES[ed],haz=new THREE.Mesh(new THREE.CylinderGeometry(ed==='normal'?.2:.35,ed==='normal'?.4:.55,ed==='normal'?1.6:7,16,1,true).translate(0,ed==='normal'?.8:3.5,0),matHaz.clone());
    haz.material.uniforms={uT:tiempo,uC:{value:new THREE.Color(E.color)},uF:{value:E.haz}};escena.add(haz);b.haz=haz;
    b.luzBase=(ed==='dorado'?16:ed==='foil'?10:6)*(COOP?.25:1);b.luz=new THREE.PointLight(E.color,b.luzBase,6,2);escena.add(b.luz);
    b.nombre=etiqueta('apNombreBotin '+ed,new V3());b.nombre.el.innerHTML=`<b>${CARDS[id].n}</b><small>${E.nombre} · ${b.bono.texto}</small>`;
    b.listo=true;if(!desde)b.y=ALTO*SB/2+.15;return b;}
  function quitarBotin(b){const i=botines.indexOf(b);if(i>=0)botines.splice(i,1);if(b.g){escena.remove(b.g,b.caja,b.haz,b.luz);quitarEtiqueta(b.nombre);b.haz.material.dispose();}}
  function recoger(b){if(b.recogida||!b.listo)return;b.recogida=true;b.tRec=reloj.t;b.desdeRec=b.g.position.clone();
    const B=b.bono;if(B.llave)heroe.llaves++;if(b.contrato)rog.mano.push({...b.contrato,miniatura:b.miniatura});heroe.botin.push({id:b.id,ed:b.ed});
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
      g.position.set(b.pos.x,b.y,b.pos.z).addScaledVector(arribaCam,(g.scale.x-SB)*ALTO/2);b.caja.position.set(b.pos.x,alto,b.pos.z);b.caja.quaternion.copy(camara.quaternion);b.haz.position.set(b.pos.x,0,b.pos.z);b.haz.material.uniforms.uF.value=EDICIONES[b.ed].haz*(COOP?.55:1)*(1-b.mirada*.9);
      // Mirándola, su luz pasa delante (hacia la cámara) para leerla.
      b.luz.position.set(b.pos.x,COOP?2.5:1.2,b.pos.z).lerp(g.position.clone().add(camara.position.clone().sub(g.position).normalize().multiplyScalar(2.2)),b.mirada);b.luz.intensity=b.luzBase+b.mirada*(COOP?3:22);
      b.nombre.pos.copy(g.position).addScaledVector(arribaCam,ALTO*g.scale.x/2+.28);b.nombre.oculta=b.volando;b.nombre.el.classList.toggle('mirada',b.mirada>.5);}}

  /* ---- Globos de Alma (curan) y lanzas de los kobolds -------------------------------- */
  // Pociones compartiendo geometrías y materiales: frasco, líquido, cuello, corcho y etiqueta.
  const pocionGeo={cuerpo:new THREE.CylinderGeometry(.2,.16,.38,8),hombro:new THREE.CylinderGeometry(.085,.2,.13,8),cuello:new THREE.CylinderGeometry(.085,.085,.14,8),corcho:new THREE.CylinderGeometry(.075,.08,.09,8),etiqueta:new THREE.BoxGeometry(.16,.15,.012)};
  const pocionMat={rojo:new THREE.MeshStandardMaterial({color:0x9c1731,roughness:.72,metalness:0}),vidrio:new THREE.MeshStandardMaterial({color:0x91bac0,roughness:.65,metalness:0}),corcho:new THREE.MeshStandardMaterial({color:0x8c6337,roughness:1}),papel:new THREE.MeshStandardMaterial({color:0xf0dbac,roughness:1})};
  function modeloPocion(){const g=new THREE.Group();for(const [geo,mat,y,z] of [[pocionGeo.cuerpo,pocionMat.rojo,.21,0],[pocionGeo.hombro,pocionMat.vidrio,.465,0],[pocionGeo.cuello,pocionMat.vidrio,.6,0],[pocionGeo.corcho,pocionMat.corcho,.7,0],[pocionGeo.etiqueta,pocionMat.papel,.22,.195]]){const m=new THREE.Mesh(geo,mat);m.position.set(0,y,z);m.castShadow=true;g.add(m);}return g;}
  function globo(p){const m=modeloPocion();m.position.set(p.x,.025,p.z);escena.add(m);const a=rnd()*TAU;globos.push({m,pos:new V3(p.x,0,p.z),vel:new V3(Math.cos(a)*2,0,Math.sin(a)*2),t0:reloj.t});}
  function pasoGlobos(dt){for(const g of [...globos])conHeroe(jugadores.filter(h=>h.vivo&&h.alma<h.almaMax).sort((a,b)=>plano(a.pos,g.pos)-plano(b.pos,g.pos))[0]||jugadores[0],()=>{g.vel.multiplyScalar(Math.exp(-dt*4));g.pos.addScaledVector(g.vel,dt);dentroPlaza(g.pos,.22);const d=plano(g.pos,heroe.pos);
    const herida=heroe.vivo&&heroe.alma<heroe.almaMax;if(herida&&d<3.2){g.pos.lerp(heroe.pos,Math.min(1,dt*(3.2-d)*3));}
    g.m.position.set(g.pos.x,.025,g.pos.z);g.m.rotation.y+=dt*.45;
    if(herida&&d<1){const c=Math.round(heroe.almaMax*.2);heroe.alma=Math.min(heroe.almaMax,heroe.alma+c);numero(heroe.pos.clone().setY(2.2),'+'+c,'cura');chispas(g.m.position,16,[1,.25,.3],3,.4);escena.remove(g.m);globos.splice(globos.indexOf(g),1);}});}
  const geoLanza=new THREE.CylinderGeometry(.024,.024,1.2,6).rotateX(Math.PI/2),geoPunta=new THREE.ConeGeometry(.17,.38,4).rotateX(Math.PI/2).translate(0,0,.69);
  // Flechas luminosas: punta ancha, asta, plumas y una estela afilada orientadas hacia el avance.
  const matPuntaLanza=new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,1.8,.65),toneMapped:false});
  const geoPluma=new THREE.ConeGeometry(.12,.36,4).rotateX(-Math.PI/2).translate(0,0,-.48);
  const materialesHaloFlecha=[0xffa530,0xfff3c0,0xffd060].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.224,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const materialesHaloHacha=[new THREE.Color(2.8,1.55,.18),new THREE.Color(3.2,2.8,1.5),new THREE.Color(3.4,2.1,.3)].map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.504,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  const geoEstelaFlecha=new THREE.PlaneGeometry(.24,2.2).rotateX(Math.PI/2).translate(0,0,-1.55);
  const matEstelaFlecha=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x*=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;void main(){float centro=1.-abs(vUv.x*2.-1.);float a=pow(max(centro,0.),1.5)*vUv.y*vUv.y;gl_FragColor=vec4(vec3(2.4,1.25,.25),a*.65*.7);}`});
  const matEstelaHacha=new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:matEstelaFlecha.vertexShader,
    fragmentShader:`uniform float uT;varying vec2 vUv;void main(){float centro=1.-abs(vUv.x*2.-1.);float a=pow(max(centro,0.),1.6)*pow(max(vUv.y,0.),1.35);a*=.85+.15*sin(vUv.y*24.-uT*28.);gl_FragColor=vec4(mix(vec3(2.2,1.05,.08),vec3(3.1,2.2,.55),centro),a*.58*.7);}`});
  // Un halo brillante (aditivo, lo agranda el resplandor) alrededor de lo que vuela: se ve de lejos y marca el momento del parry.
  const geoHalo=new THREE.SphereGeometry(1,14,10);
  const halo=(color,r)=>{const m=new THREE.Mesh(geoHalo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.scale.setScalar(r);m.renderOrder=3;return m;};
  function lanzar(e,a){const g=new THREE.Group(),punta=new THREE.Mesh(geoPunta,matPuntaLanza),brillo=new THREE.Mesh(geoPunta,materialesHaloFlecha[0]);brillo.scale.setScalar(1.25);
    const estela=new THREE.Group();for(const giro of [0,Math.PI/2]){const cinta=new THREE.Mesh(geoEstelaFlecha,matEstelaFlecha);cinta.rotation.z=giro;estela.add(cinta);}
    g.add(new THREE.Mesh(geoLanza,matPuntaLanza),new THREE.Mesh(geoPluma,matPuntaLanza),punta,brillo,estela);const dir=frente(a.dir),p=e.pos.clone().setY(1.1);
    g.position.copy(p);g.lookAt(p.clone().add(dir));escena.add(g);lanzas.push({g,brillo,estela,dir,vel:16,t0:reloj.t,dano:a.dano,clavada:0,e,origen:e.pos.clone(),radio:a.ancho/2});}
  function lanzarHacha(e,a){const g=new THREE.Group(),giro=MOD.crearHachaArrojadiza(),brillo=new THREE.Mesh(giro.children[1].geometry,materialesHaloHacha[0]),estela=new THREE.Group();
    // El aviso luminoso sigue el filo al girar y conserva la silueta del hacha.
    giro.scale.setScalar(1.35);giro.rotation.y=.65;brillo.scale.setScalar(1.1);giro.add(brillo);g.add(giro,estela);
    // La estela acompaña la trayectoria, independiente del giro del filo.
    for(const ang of [0,Math.PI/2]){const cinta=new THREE.Mesh(geoEstelaFlecha,matEstelaHacha);cinta.rotation.z=ang;cinta.scale.set(1.6,1,.8);estela.add(cinta);}
    const dir=frente(a.dir),p=e.pos.clone().setY(.95);g.position.copy(p);g.lookAt(p.clone().add(dir));escena.add(g);
    const distancia=Math.max(3,Math.min(8,plano(e.pos,heroe.pos)));
    lanzas.push({tipo:'hacha',g,giro,brillo,estela,dir,vel:10,t0:reloj.t,dano:a.dano,clavada:0,e,origen:e.pos.clone(),radio:.24,recorrido:0,alcance:10,arco:{base:p.y,final:.95,distancia,alto:1.8}});}
  function alturaHacha(l){const a=l.arco,k=l.recorrido/a.distancia;return a.base+(a.final-a.base)*k+4*a.alto*k*(1-k);}
  function pasoLanzas(dt){for(const l of [...lanzas])conHeroe(l.defensor||jugadores.filter(h=>h.vivo).sort((a,b)=>plano(a.pos,l.g.position)-plano(b.pos,l.g.position))[0]||jugadores[0],()=>{
    const quitar=()=>{escena.remove(l.g);lanzas.splice(lanzas.indexOf(l),1);};
    if(l.clavada){l.estela.visible=false;l.brillo.visible=false;const t=reloj.t-l.clavada;if(l.giro){l.g.position.y=Math.max(.08,l.alturaClavada-6*t*t);if(l.g.position.y===.08)l.giro.rotation.set(0,0,0);}if(t>1.2)quitar();return;}
    if(l.giro)l.giro.rotation.x+=dt*22;
    // Subpasos espaciales: ni hachas ni flechas atraviesan cuerpos o el pozo a FPS bajos.
    const pasos=Math.max(1,Math.ceil(l.vel*dt/.16)),avance=l.vel*dt/pasos;
    for(let i=0;i<pasos;i++){
      const anterior=l.g.position.clone();l.g.position.addScaledVector(l.dir,avance);l.recorrido=(l.recorrido||0)+avance;const p=l.g.position;
      if(l.arco){p.y=alturaHacha(l);const a=l.arco,k=l.recorrido/a.distancia,pendiente=(a.final-a.base+4*a.alto*(1-2*k))/a.distancia;l.g.lookAt(p.clone().add(l.dir).add(new V3(0,pendiente,0)));}
      if(obstaculos.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r)||Math.hypot(p.x,p.z)>R+4||p.y<.1||l.recorrido>=(l.alcance||Infinity)||reloj.t-l.t0>2){l.g.position.copy(anterior);l.clavada=reloj.t||.000001;l.alturaClavada=l.g.position.y;l.estela.visible=l.brillo.visible=false;chispas(p,5,[.8,.7,.6],2,.3);return;}
      if(l.devuelta){const e=enemigos.find(e=>e.estado!=='muere'&&plano(e.pos,p)<e.radio+.25&&(!l.arco||p.y<e.m.alto+.35));if(e){conHeroe(l.defensor||heroe,()=>danar(e,l.dano*3,{empuje:2.5,crit:true,causa:'parry',direccion:l.dir}));chispas(p,16,[1,.8,.35],5,.45);quitar();return;}}
      else if(heroe.vivo&&!l.pasada&&plano(p,heroe.pos)<heroe.radio*.6+l.radio&&p.y<2.2){const par=parar(anterior,false,PARRY.perfectoLanza);
        if(heroe.invul>0){esquivado(l.e);l.pasada=true;}
        else if(par==='perfecto'){parryPerfecto(null,p.clone());l.devuelta=true;l.defensor=heroe;l.dir.negate();l.vel=22;l.t0=reloj.t;l.recorrido=0;if(l.arco)l.arco={base:p.y,final:.75,distancia:Math.max(1,plano(p,l.e.pos)),alto:.7};l.g.lookAt(p.clone().add(l.dir));return;}
        else if(par==='bloqueo'){bloqueado(l.dano,l.origen,enemigos.includes(l.e)?l.e:null);quitar();return;}
        else{herir(l.dano,l.origen,enemigos.includes(l.e)?l.e:null);chispas(p,10,[1,.4,.3],4,.4);quitar();return;}}
    }
    const p=l.g.position,halos=l.tipo==='hacha'?materialesHaloHacha:materialesHaloFlecha;let escala=1.45;
    if(!l.devuelta){const v=heroe.pos.clone().sub(p).setY(0),d=v.length(),llega=v.dot(l.dir)>d*.7?Math.max(0,d-heroe.radio*.6-l.radio)/l.vel:9,ya=llega<=PARRY.perfectoLanza;
      l.brillo.material=halos[ya?1:0];escala=ya?1.7:1.25+.06*Math.sin(reloj.t*24);l.ahora=ya;}
    else l.brillo.material=halos[2];
    l.brillo.scale.setScalar(l.tipo==='hacha'?1.06+(escala-1)*.18:escala);
  });}


  // Búmeran de Adreida: ida recta, regreso con una curva que sigue su orientación actual.
  const BUMERAN={alcance:4,vel:16,regreso:1.05,dano:1.5},bumeranes=[];
  const matEstelaBumeran=matEstelaHacha.clone();matEstelaBumeran.uniforms.uT=tiempo;
  matEstelaBumeran.fragmentShader=matEstelaHacha.fragmentShader.replace('vec3(2.2,1.05,.08)','vec3(.2,1.05,2.2)').replace('vec3(3.1,2.2,.55)','vec3(.8,2.1,2.8)');
  function manoBumeran(h){h.m.raiz.updateMatrixWorld(true);return h.m.H.manoD.localToWorld(new V3(0,-.55,0));}
  function lanzarBumeran(h){if(h.bumeran)return;const g=new THREE.Group(),giro=MOD.crearHachaAdreida(h.m),estela=new THREE.Group();
    g.add(giro,estela);for(const ang of [0,Math.PI/2]){const m=new THREE.Mesh(geoEstelaFlecha,matEstelaBumeran);m.rotation.z=ang;m.scale.set(2,1,.65);estela.add(m);}
    const p=manoBumeran(h),dir=frente(h.dir);g.position.copy(p);escena.add(g);
    const b={h,g,giro,estela,dir,desde:p.clone(),fase:'ida',distancia:0,t:0,golpeados:new Set(),dano:h.atq*BUMERAN.dano*(h.especial??1)};
    h.bumeran=b;bumeranes.push(b);MOD.mostrarHacha(h.m,false);h.carga=0;h.bloqueoBasico=true;h.entrada.pendiente=false;
  }
  function volverBumeran(b){b.fase='vuelta';b.t=0;b.golpeados.clear();b.inicio=b.g.position.clone();
    const lado=new V3(b.dir.z,0,-b.dir.x);b.control1=b.inicio.clone().addScaledVector(b.dir,-.65).addScaledVector(lado,3.3);b.control1.y+=.35;
    b.control2=manoBumeran(b.h).addScaledVector(lado,2.7).addScaledVector(b.dir,1.2);
  }
  function quitarBumeran(b,recogido=false){escena.remove(b.g);const i=bumeranes.indexOf(b);if(i>=0)bumeranes.splice(i,1);b.h.bumeran=null;MOD.mostrarHacha(b.h.m,true);if(recogido)b.h.recogeHacha=.25;}
  function pasoBumeranes(dt){for(const b of [...bumeranes]){const h=b.h;if(!h.vivo){quitarBumeran(b);continue;}
    const pasos=Math.max(1,Math.ceil(dt*120)),ds=dt/pasos,manoActual=manoBumeran(h);
    for(let i=0;i<pasos&&h.bumeran===b;i++){
      const antes=b.g.position.clone();b.t+=ds;
      if(b.fase==='ida'){const d=Math.min(BUMERAN.vel*ds,BUMERAN.alcance-b.distancia);b.g.position.addScaledVector(b.dir,d);b.distancia+=d;
        if(obstaculos.some(o=>Math.hypot(b.g.position.x-o.x,b.g.position.z-o.z)<o.r+.12)||Math.hypot(b.g.position.x,b.g.position.z)>(ABIERTO?110:R+1)){b.g.position.copy(antes);volverBumeran(b);}
        else if(b.distancia>=BUMERAN.alcance-1e-6)volverBumeran(b);
      }else{
        const mano=manoActual,fr=frente(h.dir),lado=new V3(fr.z,0,-fr.x),control=mano.clone().addScaledVector(lado,2.7).addScaledVector(fr,1.2);
        b.control2.lerp(control,1-Math.exp(-ds*10));const k=Math.min(1,b.t/BUMERAN.regreso),u=suave(k),v=1-u;
        const meta=b.inicio.clone().multiplyScalar(v*v*v).addScaledVector(b.control1,3*v*v*u).addScaledVector(b.control2,3*v*u*u).addScaledVector(mano,u*u*u);
        const salto=meta.sub(b.g.position),max=ds*(k>=1?32:26);if(salto.length()>max)salto.setLength(max);b.g.position.add(salto);
        if(k>=.9&&b.g.position.distanceTo(mano)<.2){quitarBumeran(b,true);break;}
      }
      const avance=b.g.position.clone().sub(antes);if(avance.lengthSq()>1e-8){b.g.lookAt(b.g.position.clone().add(avance));b.dirVisual=avance.clone().normalize();}
      b.giro.rotation.y+=ds*24;
      for(const e of enemigos){if(e.estado==='muere'||b.golpeados.has(e.id)||plano(e.pos,b.g.position)>e.radio+.58||b.g.position.y>e.m.alto+.45)continue;
        b.golpeados.add(e.id);conHeroe(h,()=>danar(e,b.dano,{empuje:2.2,causa:'reves',direccion:b.dirVisual||b.dir}));chispas(b.g.position,7,[.5,.85,1],3,.3);h.furia=Math.min(100,h.furia+4);}
    }
  }}

  // Las balas de Mohamed: rápidas, doradas y con estela; no interrumpen (así no se aturde a nadie a tiros), pero dan Furia.
  // Dos propuestas de bala:
  //   · «plomo»: la bola de plomo de una pistola de chispa (esfera metálica gris) con un trazo corto al rojo detrás y chispas;
  //   · «trazadora»: una bala alargada de latón (cuerpo y ojiva) que apunta adonde va, con una estela larga y fina de luz.
  // Las dos llevan su cuerpo sólido (se ve que es una bala) y algo de luz para seguirla con la vista.
  const balas=[];let estiloBala=q.get('balas')==='trazadora'?'trazadora':'plomo';
  const matPlomo=new THREE.MeshStandardMaterial({color:0x7a7e86,metalness:.5,roughness:.7}),matLaton=new THREE.MeshStandardMaterial({color:0xd09a48,metalness:.6,roughness:.65}),matCobre=new THREE.MeshStandardMaterial({color:0xb86a3a,metalness:.5,roughness:.65});
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
  let disparosPendientes=[];const ejeBala=new V3(0,1,0),ejeCanon=new V3(0,-1,0),planoMira=new THREE.Plane(new V3(0,1,0),-1.15);
  const geoMira=new THREE.BufferGeometry().setFromPoints([new V3(),new V3()]);
  const lineaMira=new THREE.Line(geoMira,new THREE.LineBasicMaterial({color:0xffd080,transparent:true,opacity:.7,toneMapped:false,depthWrite:false}));
  const puntoMira=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({color:0xffe0a0,toneMapped:false}));
  lineaMira.frustumCulled=false;lineaMira.visible=puntoMira.visible=false;escena.add(lineaMira,puntoMira);
  let punteria=null;
  // Primera intersección del segmento: evita saltarse un enemigo o atravesar un obstáculo entre fotogramas.
  function impactoBala(desde,dir,maximo,soloPlano=false){let distancia=maximo,enemigo=null,bloqueado=false;
    const circulo=(x,z,r)=>{const dx=desde.x-x,dz=desde.z-z,a=dir.x*dir.x+dir.z*dir.z,c=dx*dx+dz*dz-r*r;
      if(c<=0)return 0;if(a<1e-9)return Infinity;const b=dx*dir.x+dz*dir.z,d=b*b-a*c;
      if(d<0)return Infinity;const t=(-b-Math.sqrt(d))/a;return t>=0?t:Infinity;};
    // Los obstáculos ganan los empates: una bala nunca daña a través de una pared.
    for(const o of obstaculos){const t=circulo(o.x,o.z,o.r);if(t<=distancia){distancia=t;bloqueado=true;}}
    if(!ABIERTO)for(const n of PLANOS_MURALLA){const avance=dir.x*n.x+dir.z*n.z;if(avance>0){const t=(R-desde.x*n.x-desde.z*n.z)/avance;if(t>=0&&t<=distancia){distancia=t;bloqueado=true;}}}
    if(dir.y<0){const t=(.08-desde.y)/dir.y;if(t>=0&&t<=distancia){distancia=t;bloqueado=true;}}
    for(const e of enemigos){if(e.estado==='muere')continue;const t=circulo(e.pos.x,e.pos.z,e.radio+.18),y=desde.y+dir.y*t;
      if(t<distancia&&(soloPlano||(y>=0&&y<=e.m.alto+.18))){distancia=t;enemigo=e;bloqueado=false;}}
    return {distancia,enemigo,bloqueado};}
  function objetivoDisparo(){
    if(heroe.id===0&&!mando.activo&&!ent.piloto&&!ent.rev&&!ent.tactil&&(ent.dentro||ent.atacando)){
      const sobre=bajo();if(sobre?.d)return sobre.pos.clone().setY(Math.min(1.15,sobre.m.alto*.7));
      const p=new V3();if(ray.ray.intersectPlane(planoMira,p))return p;}
    const p=puntoApuntado(),dir=p.clone().sub(heroe.pos).setY(0).normalize();
    // El stick indica dirección, no altura: baja el cañón hacia el primer cuerpo en esa línea.
    // Conserva la cobertura y evita disparar por encima de los goblins cercanos.
    const e=impactoBala(heroe.pos,dir,HEROES.mohamed.alcance,true).enemigo;
    if(e)return e.pos.clone().setY(Math.min(1.15,e.m.alto*.7));
    p.y=1.15;return p;}
  function actualizarPunteria(){const h=heroe,m=h.m;
    const visible=aDistancia()&&h.vivo&&h.sigilo<=0&&['quieto','andar','abanico'].includes(h.estado)&&!poses.heroe;
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
      balas.push({g,pos:desde.clone(),origen:desde.clone(),dir,dueno:h,vel:HEROES.mohamed.vel,dist:0,dano:o.dano,causa:o.causa,estilo:estiloBala});
      particula(desde.x,desde.y,desde.z,0,0,0,.045,.45,1.3,.85,.35,0);}
    disparosPendientes.length=0;}
  function disparar(opc={}){const h=heroe,T=HEROES.mohamed;if(h.sigilo>0){apunalar();return;}
    if(!opc.gratis){h.balas--;h.disparos++;h.cadT=T.cadencia;h.disparoT=0;ent.pendiente=false;if(h.balas<=0)h.recargaT=T.recarga;}
    disparosPendientes.push({angulo:opc.angulo||0,dano:opc.dano??h.atq*(h.basicos??1),causa:opc.causa||'disparo'});}
  function pasoBalas(dt){for(const b of [...balas]){const paso=Math.min(b.vel*dt,Math.max(0,HEROES.mohamed.alcance-b.dist)),impacto=impactoBala(b.pos,b.dir,paso);
    b.pos.addScaledVector(b.dir,impacto.distancia);b.dist+=impacto.distancia;b.g.position.copy(b.pos);
    // La estela continua indica el recorrido; no se emiten destellos aleatorios en vuelo.
    const e=impacto.enemigo,fuera=impacto.bloqueado||b.dist>=HEROES.mohamed.alcance-1e-6;
    if(e){conHeroe(b.dueno,()=>danar(e,b.dano,{empuje:.45,sinDolor:true,causa:b.causa||'disparo',direccion:b.dir}));b.dueno.furia=Math.min(100,b.dueno.furia+3);chispas(b.pos,3,[.6,.45,.2],2,.16);}
    if(e||fuera){if(impacto.bloqueado&&!e)chispas(b.pos,2,[.5,.4,.3],1,.12);escena.remove(b.g);balas.splice(balas.indexOf(b),1);}}}

  /* ---- Colisiones --------------------------------------------------------------------- */
  function dentroPlaza(p,r){for(const o of obstaculos){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),m=o.r+r;if(d<m&&d>1e-4){p.x=o.x+dx/d*m;p.z=o.z+dz/d*m;}}
    if(ABIERTO){
      const distancia=Math.hypot(p.x,p.z),a=Math.atan2(p.z,p.x),porton=CALLES.some(c=>Math.abs(difAng(a,c))<.105);
      const limite=Math.max(...PLANOS_MURALLA.map(n=>p.x*n.x+p.z*n.z));
      if(!porton&&limite>R-r&&limite<R+.9+r){const objetivo=limite<R+.45?R-r:R+.9+r;p.x*=objetivo/limite;p.z*=objetivo/limite;}
      if(distancia>110-r){p.x*=(110-r)/distancia;p.z*=(110-r)/distancia;}return;
    }
    // Restricción contra las mismas caras que dibuja la muralla, incluidos los sellos de los portones.
    let escala=1;for(const n of PLANOS_MURALLA){const d=p.x*n.x+p.z*n.z;if(d>R-r)escala=Math.min(escala,(R-r)/d);}p.x*=escala;p.z*=escala;}
  function respetarMuralla(desde,hasta,r){if(!ABIERTO)return;
    const d=plano(desde,hasta),n=Math.max(1,Math.ceil(d/.2)),p=desde.clone(),paso=hasta.clone().sub(desde).multiplyScalar(1/n);
    for(let i=0;i<n;i++){const candidato=p.clone().add(paso),original=candidato.clone();dentroPlaza(candidato,r);
      if(plano(candidato,original)>.05){hasta.copy(p);return;}p.copy(candidato);}
  }
  function separar(){const todos=[...jugadores.filter(h=>h.vivo),...enemigos.filter(e=>e.estado!=='muere')];for(let i=0;i<todos.length;i++)for(let j=i+1;j<todos.length;j++){const a=todos[i],b=todos[j];if(jugadores.includes(a)&&a.estado==='salto'||jugadores.includes(b)&&b.estado==='salto')continue;
    const dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz),m=a.radio+b.radio+(jugadores.includes(a)?0:.55);
    if(d<m){const nx=d>1e-4?dx/d:1,nz=d>1e-4?dz/d:0,k=m-d,wa=jugadores.includes(a)?(['carga','recuperacion'].includes(a.estado)?0:.15):a.ataque?0:.5,wb=jugadores.includes(b)?(['carga','recuperacion'].includes(b.estado)?0:.15):b.ataque?0:.5;
      a.pos.x-=nx*k*wa;a.pos.z-=nz*k*wa;b.pos.x+=nx*k*wb;b.pos.z+=nz*k*wb;}}
    for(const e of todos)if(jugadores.includes(e)||e.dentro&&!e.huida?.cruzando)dentroPlaza(e.pos,e.radio);}

  /* ---- Adreida: control a lo Hades ------------------------------------------------------
     WASD mueve; clics cortos encadenan el combo y mantener/soltar carga un hachazo;
     Espacio hace parry e interrumpe el ataque; clic derecho, Salto al cursor; Q Torbellino; E Hacha búmeran. */
  const VEL=5.8,DUR_ESQ=.2,VEL_ESQ=17;
  const TORBELLINO={dur:1.35,radio:2.55,intervalo:.2};
  // El combo empieza lento (se ve venir cada hachazo) y se acelera con la velocidad de ataque de las cartas (heroe.vatq).
  const COMBO=[{dur:.6,imp:.3,alc:2.05,ang:1.1,mult:1,emp:1.4,anim:'tajoA'},{dur:.6,imp:.3,alc:2.05,ang:1.1,mult:1,emp:1.4,anim:'revesA'},{dur:.8,imp:.39,alc:2.7,ang:.5,mult:1.8,emp:3.8,anim:'estocadaA'}];
  const frente=a=>new V3(Math.sin(a),0,Math.cos(a));
  const libre=()=>heroe.vivo&&(['quieto','andar'].includes(heroe.estado)||heroe.estado==='golpe'&&heroe.golpeo);
  function cambiar(e,s){e.estado=s;e.t=0;if(e.torbellino&&!['torbellino','esquiva'].includes(s))e.torbellino=null;}
  function girando(h){return h.estado==='torbellino'||h.estado==='esquiva'&&!!h.torbellino;}
  const cercano=r=>enemigos.filter(e=>e.estado!=='muere'&&plano(e.pos,heroe.pos)<r).sort((a,b)=>plano(a.pos,heroe.pos)-plano(b.pos,heroe.pos))[0]||null;
  // Hacia dónde apunta: el cursor; en táctil (sin cursor), el enemigo más cercano; si no, de frente.
  function puntoApuntado(){if(ctl.apunta)return ctl.apunta.clone();const e=cercano(7);return e?e.pos.clone():heroe.pos.clone().add(frente(heroe.dir).multiplyScalar(3));}
  // Lo que está a punto de golpearla: el ataque cuerpo a cuerpo que antes se resuelve (con ella dentro) o la lanza que llega antes.
  function amenaza(){const H=heroe;let mejor=null,t=1e9;
    for(const e of enemigos){const a=e.ataque;if(!a||a.forma==='linea'||!enZona(a,e,H.pos,H.radio*.6))continue;const r=a.dur-(reloj.t-a.t0);if(r<t){t=r;mejor=e.pos;}}
    for(const l of lanzas){if(l.clavada||l.devuelta)continue;const v=H.pos.clone().sub(l.g.position).setY(0),d=v.length();if(d>9||v.dot(l.dir)<d*.7)continue;const r=d/l.vel;if(r<t){t=r;mejor=l.g.position;}}
    for(const p of peligrosTroll){if(p.devuelto||plano(H.pos,p.hasta)>p.radio+H.radio*.6)continue;const r=p.dur-p.t;if(r<t){t=r;mejor=p.desde;}}
    return mejor?{p:mejor.clone(),t}:null;}
  function usar(h,punto){if(h==='provocar'&&!aDistancia())h='bumeran';if(h==='bumeran'&&aDistancia())return false;if(pausa.activa||rog.abierto||!heroe.vivo||heroe.estado==='recuperacion')return false;const H=HAB[h];
    if(h==='ulti')return lanzarUlti();
    if(heroe.bumeran&&['bumeran','torbellino'].includes(h)){rechazo(h,'Espera a recuperar el hacha');return false;}
    // Parry: se puede incluso a mitad de un golpe; mira sola hacia lo que viene (o hacia el cursor).
    if(h==='parry'){const E=heroe.estado;if(heroe.cd.parry>0||!['quieto','andar','golpe','carga','torbellino','abanico','lanzarHacha','parry'].includes(E)||E==='parry')return false;
      const am=amenaza(),hacia=am?am.p:punto||ctl.apunta;if(hacia&&plano(hacia,heroe.pos)>.05)heroe.dir=rumbo(heroe.pos,hacia);
      heroe.parryExito=false;heroe.carga=0;heroe.bloqueoBasico=true;ent.pendiente=false;paron=0;cambiar(heroe,'parry');return true;}
    if(h==='esquiva'){if(['salto','grito','esquiva','muerta'].includes(heroe.estado)||heroe.cd.esquiva>0)return false;
      const v=punto?punto.clone().setY(0):ctl.mov.lengthSq()>.01?ctl.mov.clone():frente(heroe.dir);heroe.dirEsq.copy(v.normalize());const dir=rumbo(new V3(),heroe.dirEsq);
      if(heroe.torbellino)heroe.giro+=heroe.dir-dir;heroe.dir=dir;
      heroe.cd.esquiva=H.cd*(heroe.dash??1);heroe.invul=DUR_ESQ+.1;heroe.esqDesde=heroe.pos.clone();if(heroe.incendio)apagarFuego(heroe,true);cambiar(heroe,'esquiva');return true;}
    if(!libre())return false;if(heroe.furia<H.coste){rechazo(h,'Te falta Furia');return false;}if((heroe.cd[h]||0)>0){rechazo(h,'Aún no está lista');return false;}
    heroe.furia-=H.coste;if(H.cd)heroe.cd[h]=H.cd;
    if(h==='torbellino'&&aDistancia()){const base=rumbo(heroe.pos,puntoApuntado());heroe.dir=base;for(let i=-3;i<=3;i++)disparar({angulo:i*.12,gratis:true,causa:'abanico',dano:Math.round(heroe.atq*1.2*(heroe.especial??1))});cambiar(heroe,'abanico');temblar(.1);}
    else if(h==='torbellino'){cambiar(heroe,'torbellino');heroe.torbellino={t:0,impactos:new Map()};}
    if(h==='salto'){const p=punto?punto.clone():puntoApuntado(),d=plano(p,heroe.pos);if(d>8)p.sub(heroe.pos).multiplyScalar(8/d).add(heroe.pos);
      p.y=0;dentroPlaza(p,heroe.radio);respetarMuralla(heroe.pos,p,heroe.radio);heroe.origenSalto=heroe.pos.clone();heroe.objetivoSalto=p;heroe.saltoMando=!aDistancia()&&mando.activo;heroe.acortarSalto=0;heroe.dirSalto=p.clone().sub(heroe.pos).normalize();heroe.dir=rumbo(heroe.pos,p);cambiar(heroe,'salto');heroe.golpeo=false;}
    if(h==='bumeran'){const p=punto||puntoApuntado();if(plano(p,heroe.pos)>.1)heroe.dir=rumbo(heroe.pos,p);cambiar(heroe,'lanzarHacha');heroe.golpeo=false;heroe.carga=0;ent.pendiente=false;}
    if(h==='provocar'){cambiar(heroe,'grito');heroe.golpeo=false;}
    return true;}
  function rechazo(h,texto){const b=document.querySelector(`[data-hab="${h}"]`);if(b){b.classList.remove('no');void b.offsetWidth;b.classList.add('no');}tostada(texto,true);}
  // Un golpe del combo hacia donde apuntas; encadena si el anterior acaba de terminar.
  function iniciarGolpe(){if(heroe.bumeran)return;const h=heroe,preparado=h.estado==='carga',t=preparado?Math.min(h.t,COMBO[h.combo].dur*.38):0;ent.pendiente=false;
    if(!preparado){h.carga=0;h.combo=h.estado==='golpe'||reloj.t-h.finGolpe<.3?(h.combo+1)%3:0;}
    h.dir=rumbo(h.pos,puntoApuntado());cambiar(h,'golpe');h.t=t;h.golpeo=false;h.avanceCargado=0;}
  // Pulsaciones cortas encadenan el combo; mantener prepara un único golpe que sale al soltar.
  function iniciarCarga(){if(heroe.bumeran)return;const h=heroe;h.cargaMando=mando.activo;ent.pendiente=false;h.combo=reloj.t-h.finGolpe<.3?(h.combo+1)%3:0;h.carga=0;h.dir=rumbo(h.pos,puntoApuntado());cambiar(h,'carga');}
  function ajustarSalto(h,mov,dt,k){
    if(!h.saltoMando||!mando.activo||k>=.86)return;
    // Sólo modifica el alcance: atrás frena hasta un metro; adelante recupera los cinco originales.
    h.acortarSalto=Math.max(0,Math.min(1,plano(h.origenSalto,h.objetivoSalto),h.acortarSalto-mov.dot(h.dirSalto)*3*dt));
  }
  function danar(e,dano,opc={}){if(e.estado==='muere')return;activarFaseTroll(e);heroe.ultimo=e;
    if(blindadoTroll(e)){if((e.avisoBlindaje??-9)<reloj.t){numero(e.pos.clone().setY(e.m.alto+.3),'¡Necesitas un parry!','bloqueo');e.avisoBlindaje=reloj.t+.8;}return;}const crit=opc.crit??rnd()<.12;const expuesto=e.expuestoHasta>reloj.t;dano=Math.round(opc.exacto?dano:dano*(crit?1.8:1)*(expuesto?2:1)*(.9+rnd()*.2));if(e.tipo==='troll'&&!e.fase2)dano=Math.min(dano,e.vida-e.vidaMax*.5);e.vida-=dano;e.destello=1;activarFaseTroll(e);
    numero(e.pos.clone().setY(e.m.alto+.3),String(dano),crit||expuesto?'critico':'dano');
    const lejos=(opc.direccion?opc.direccion.clone():e.pos.clone().sub(opc.origen||heroe.pos)).setY(0).normalize();if(lejos.lengthSq()<.001)lejos.copy(frente(heroe.dir));e.emp.addScaledVector(lejos,(opc.empuje??1.6)*(e.d.aguante?.35:1));
    if(e.vida<=0){morir(e,{causa:opc.causa||'tajo',direccion:lejos,cargaCompleta:opc.cargaCompleta});return;}
    // Los pequeños se interrumpen al recibir un golpe (se les borra el aviso); los grandes aguantan.
    if(!e.d.aguante&&['persigue','aviso','recupera'].includes(e.estado)&&!opc.sinDolor&&!expuesto){cancelarAtaque(e);cambiar(e,'dolor');}
    if(opc.aturde&&!e.huida&&!(e.tipo==='troll'&&e.fase2)){cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=opc.aturde*(e.d.jefe?.4:1);}
    e.golpeVisual={t:0,potencia:opc.cargaCompleta?1:opc.causa==='salto'?.8:.45};e.provocado=Math.max(e.provocado,.1);}
  function golpearEn(radio,arco,dano,opc){let n=0;const f=frente(heroe.dir);
    for(const e of enemigos){if(e.estado==='muere')continue;const d=plano(e.pos,heroe.pos);if(d>radio+e.radio)continue;
      if(arco<Math.PI){const v=e.pos.clone().sub(heroe.pos).setY(0).normalize();if(v.dot(f)<Math.cos(arco)&&d>e.radio+.3)continue;}
      danar(e,dano,opc);n++;const p=e.pos.clone().lerp(heroe.pos,.35).setY(1.1);chispas(p,opc?.chispas??10,[1,.75,.4],6,.45);}
    return n;}
  function pasoTorbellino(dt,desde){const h=heroe,g=h.torbellino;if(!g)return;g.t+=dt;
    // Barre el recorrido real, no sólo la posición final del cuadro. Cada enemigo
    // conserva su intervalo de daño al entrar al dash o volver al giro normal.
    const dx=h.pos.x-desde.x,dz=h.pos.z-desde.z,l2=dx*dx+dz*dz;
    for(const e of enemigos){if(e.estado==='muere'||(g.impactos.get(e.id)??0)>g.t+1e-8)continue;
      const k=l2?Math.max(0,Math.min(1,((e.pos.x-desde.x)*dx+(e.pos.z-desde.z)*dz)/l2)):0;
      const x=desde.x+dx*k,z=desde.z+dz*k;if(Math.hypot(e.pos.x-x,e.pos.z-z)>TORBELLINO.radio+e.radio)continue;const origen=new V3(x,0,z);
      g.impactos.set(e.id,g.t+TORBELLINO.intervalo);
      danar(e,h.atq*.5*(h.especial??1),{empuje:1.1,crit:false,causa:'torbellino',origen});
      chispas(e.pos.clone().lerp(origen,.35).setY(1.1),6,[1,.75,.4],6,.45);h.furia=Math.min(100,h.furia+1.5);}
    if(rnd()<.8){const a=rnd()*TAU;particula(h.pos.x+Math.cos(a)*2,1+rnd()*.3,h.pos.z+Math.sin(a)*2,-Math.sin(a)*6,.3,Math.cos(a)*6,.25,.5,2.2,1.6,1.2,0);}
    // Un dash tardío conserva el giro hasta completar su recorrido; no reinicia
    // los 1,35 s ni cobra Furia de nuevo. Después continúa sólo el tiempo restante.
    if(h.estado==='esquiva'&&h.t<DUR_ESQ-1e-8)return;
    if(g.t>=TORBELLINO.dur-1e-8)cambiar(h,'quieto');else if(h.estado==='esquiva'){cambiar(h,'torbellino');h.t=g.t;}
  }
  let paron=0;// el parón al golpear: congela el mundo un instante (se siente el impacto)
  // Recibir un golpe: se marca quién fue (destella y la pantalla indica de dónde vino).
  function herir(dano,desde,culpable){if(!heroe.vivo)return;dano=Math.round(dano*(heroe.escudo>0?.5:1));heroe.alma-=dano;heroe.destello=1;heroe.dolor=0;heroe.furia=Math.min(100,heroe.furia+dano*.7);
    numero(heroe.pos.clone().setY(2.3),String(dano),'recibido');temblar(.18);heroe.heridaT=reloj.t;heroe.golpeDe={desde:desde.clone(),t:reloj.t,id:culpable?.id??null};if(culpable)culpable.culpableT=reloj.t;
    if(heroe.alma<=0){heroe.alma=0;heroe.vivo=false;heroe.incendio=null;cambiar(heroe,'muerta');}}
  // Quemadura personal: cinco pulsos, sin acumular daño entre antorchas. El dash la extingue.
  function prenderFuego(e){const h=heroe;if(h.tipo!=='adreida'||!h.vivo||h.invul>0)return;
    const antes=h.incendio;h.incendio={restante:5,pulso:antes?.pulso??1,particulas:0,origen:e.pos.clone(),culpable:e};
    if(!antes)numero(h.pos.clone().setY(2.6),'¡En llamas!','fuego');}
  function apagarFuego(h,avisar=false){if(!h.incendio)return;h.incendio=null;if(avisar)numero(h.pos.clone().setY(2.4),'Fuego apagado','esquivado');}
  function pasoFuego(dt){const h=heroe,f=h.incendio;if(!f)return;if(!h.vivo||h.estado==='esquiva'){apagarFuego(h);return;}
    const transcurrido=Math.min(dt,f.restante);f.restante=Math.max(0,f.restante-transcurrido);f.pulso-=transcurrido;
    while(f.pulso<=1e-8&&h.vivo){f.pulso+=1;herir(2,f.origen,enemigos.includes(f.culpable)?f.culpable:null);}
    if(!h.vivo||f.restante<=1e-8){apagarFuego(h);return;}
    f.particulas+=transcurrido;while(f.particulas>=1/18){f.particulas-=1/18;const a=rnd()*TAU;
      particula(h.pos.x+Math.cos(a)*.27,(h.alto||0)+.45+rnd()*.85,h.pos.z+Math.sin(a)*.27,Math.cos(a)*.1,.8+rnd()*.6,Math.sin(a)*.1,.45,.85,1.8,.5,.06,-.4);}
  }
  function esquivado(e){numero(heroe.pos.clone().setY(2.4),'¡Esquivado!','esquivado');heroe.furia=Math.min(100,heroe.furia+8);heroe.esquivados=(heroe.esquivados||0)+1;if(e)e.culpableT=reloj.t;}
  function pasoHeroe(dt){const h=heroe;h.t+=dt;h.sigilo=Math.max(0,h.sigilo-dt);h.ultiT=Math.max(0,h.ultiT-dt);h.brilloParry=Math.max(0,h.brilloParry-dt);for(const k in h.cd)h.cd[k]=Math.max(0,h.cd[k]-dt);h.escudo=Math.max(0,h.escudo-dt);h.invul=Math.max(0,h.invul-dt);h.destello=Math.max(0,h.destello-dt*5);h.dolor=Math.min(1,h.dolor+dt*4);
    h.recogeHacha=Math.max(0,(h.recogeHacha||0)-dt);const dirAnterior=h.dir,desdeGiro=h.torbellino?h.pos.clone():null;let movido=0;const mov=ctl.mov;if(h.bloqueoBasico)ent.pendiente=false;if(!ctl.atacar)h.bloqueoBasico=false;
    const andar=(v,vel)=>{if(v.lengthSq()<.01)return 0;const l=Math.min(1,v.length()),paso=vel*l*dt;h.pos.x+=v.x/v.length()*paso;h.pos.z+=v.z/v.length()*paso;return paso;};
    if(h.incendio)pasoFuego(dt);if(h.estado==='muerta'){h.muerteT+=dt;return;}
    if(h.retroceso){h.pos.addScaledVector(h.retroceso,dt);h.retroceso.multiplyScalar(Math.exp(-dt*9));if(h.retroceso.lengthSq()<.01)h.retroceso=null;}
    if(aDistancia()){const T=HEROES.mohamed;h.cadT-=dt*h.vatq;h.disparoT+=dt;if(h.recargaT>0){h.recargaT-=dt*h.vatq;if(h.recargaT<=0){h.balas=T.cargador;numero(h.pos.clone().setY(2.3),'¡Cargada!','esquivado');}}}
    if(['quieto','andar'].includes(h.estado)&&aDistancia()){const apunta=ctl.atacar,obj=apunta?puntoApuntado():null;movido=andar(mov,VEL*(apunta?.7:1));
      if(obj&&plano(obj,h.pos)>.1)h.dir=rumbo(h.pos,obj);else if(movido)h.dir+=difAng(h.dir,rumbo(new V3(),mov))*Math.min(1,dt*18);
      if(apunta&&(h.sigilo>0||h.balas>0&&h.recargaT<=0)&&h.cadT<=0)disparar();
      h.estado=movido>0?'andar':'quieto';}
    else if(h.estado==='abanico'){if(h.t>=.3)cambiar(h,'quieto');}
    else if(['quieto','andar'].includes(h.estado)){movido=ctl.atacar&&!h.bloqueoBasico&&!h.bumeran?0:andar(mov,VEL);if(h.bumeran&&ctl.apunta&&plano(ctl.apunta,h.pos)>.1)h.dir+=difAng(h.dir,rumbo(h.pos,ctl.apunta))*Math.min(1,dt*18);else if(movido)h.dir+=difAng(h.dir,rumbo(new V3(),mov))*Math.min(1,dt*18);
      if(h.bumeran)ent.pendiente=false;
      if(ctl.atacar&&!h.bloqueoBasico&&!h.bumeran){if(ent.piloto)iniciarGolpe();else iniciarCarga();}else h.estado=movido>0?'andar':'quieto';}
    else if(h.estado==='lanzarHacha'){if(!h.golpeo&&h.t>=.2){h.golpeo=true;lanzarBumeran(h);}if(h.t>=.46)cambiar(h,'quieto');}
    else if(h.estado==='carga'&&(document.hidden||!mando.foco||h.cargaMando&&!mando.activo)){h.carga=0;h.bloqueoBasico=true;cambiar(h,'quieto');}
    else if(h.estado==='carga'){ent.pendiente=false;h.carga=Math.max(0,Math.min(1,(h.t-.18)/.72));h.dir=rumbo(h.pos,puntoApuntado());if(!ctl.atacar)iniciarGolpe();}
    else if(h.estado==='golpe'){const C=COMBO[h.combo];h.t+=dt*(h.vatq-1);// más velocidad de ataque: la animación y el impacto llegan antes
      // Un paso adelante al golpear, salvo si ya hay alguien delante.
      if(h.carga>=.5){const avance=.65*h.carga*tramo(h.t/C.dur,.38,.62);h.pos.addScaledVector(frente(h.dir),avance-(h.avanceCargado||0));h.avanceCargado=avance;}
      else if(h.t<.1&&!enemigos.some(e=>e.estado!=='muere'&&plano(e.pos,h.pos)<C.alc*.6)){const f=frente(h.dir);h.pos.addScaledVector(f,(h.combo===2?9:5)*dt);}
      if(!h.golpeo&&h.t>=C.imp){h.golpeo=true;const n=golpearEn(C.alc+.65*(h.carga||0),C.ang,h.atq*C.mult*(1+2*(h.carga||0))*(h.basicos??1),{empuje:C.emp+16*(h.carga||0),cargaCompleta:h.carga>=1,causa:h.carga>=.5?'cargado':['tajo','reves','estocada'][h.combo]});if(h.carga>=.5){temblar(h.carga>=1?.72:.5);const p=h.pos.clone().addScaledVector(frente(h.dir),1.6);polvo(p,14,1.2);chispas(p.setY(.5),16,[1,.7,.25],7,.35);}
        if(n){h.furia=Math.min(100,h.furia+Math.min(14,n*7));paron=h.carga>=.5?.11:h.combo===2?.09:.05;temblar(h.carga>=1?.72:h.carga>=.5?.5:h.combo===2?.22:.11);}}
      // Andar después del impacto corta el golpe (se puede salir del combo para esquivar un aviso).
      if(h.carga>=1&&h.t>=C.dur*.64){cambiar(h,'recuperacion');}
      else if(h.carga<1&&h.golpeo&&h.t>C.imp+.08&&mov.lengthSq()>.01&&!ctl.atacar){h.finGolpe=reloj.t;cambiar(h,'andar');}
      else if(h.t>=C.dur){h.finGolpe=reloj.t;if(ctl.atacar&&!h.bloqueoBasico){if(ent.piloto)iniciarGolpe();else iniciarCarga();}else{cambiar(h,'quieto');}}}
    else if(h.estado==='recuperacion'){if(h.t>=.3){h.finGolpe=reloj.t;cambiar(h,'quieto');}}
    else if(h.estado==='parry'){const am=amenaza();if(am&&h.t<PARRY.perfecto)h.dir+=difAng(h.dir,rumbo(h.pos,am.p))*Math.min(1,dt*20);
      if(h.t>=PARRY.dur){if(!h.parryExito)h.cd.parry=PARRY.cd;cambiar(h,'quieto');}}
    else if(h.estado==='esquiva'){const inicio=Math.max(0,h.t-dt),fin=Math.min(DUR_ESQ,h.t);
      if(fin>inicio){h.pos.addScaledVector(h.dirEsq,VEL_ESQ*((fin-inicio)-.2*(fin*fin-inicio*inicio)/DUR_ESQ));movido=1;
        if(rnd()<.9)particula(h.pos.x+(rnd()-.5)*.5,.3+rnd()*1.4,h.pos.z+(rnd()-.5)*.5,-h.dirEsq.x*2,.2,-h.dirEsq.z*2,.3,.9,.6,.9,1.3,0);}
      if(h.t>=DUR_ESQ-1e-8&&!h.torbellino)cambiar(h,'quieto');}
    else if(h.estado==='torbellino'){movido=andar(mov,4);if(movido)h.dir=rumbo(new V3(),mov);}
    else if(h.estado==='salto'){const D=.72,k=Math.min(1,h.t/D),m=tramo(k,.12,.86);ajustarSalto(h,mov,dt,k);h.pos.lerpVectors(h.origenSalto,h.objetivoSalto,m);if(h.saltoMando)h.pos.addScaledVector(h.dirSalto,-h.acortarSalto*m);h.alto=Math.sin(Math.PI*m)*2.4;h.invul=Math.max(h.invul,k<.86?.05:0);
      // Mohamed cae del backflip: los que lo han visto (a 6 m y mirando hacia él) se quedan impresionados, aturdidos unos segundos.
      // Adreida, en cambio, clava el hacha.
      if(!h.golpeo&&k>=.86&&aDistancia()){h.golpeo=true;h.alto=0;marca('onda',h.pos.x,h.pos.z,6,0xffd070,.5);polvo(h.pos,16,1);chispas(h.pos.clone().setY(1.6),24,[1,.9,.5],4,.45);temblar(.12);
        for(const e of enemigos){if(e.estado==='muere'||e.huida||e.tipo==='troll'&&e.fase2)continue;const v=h.pos.clone().sub(e.pos).setY(0),d=v.length();if(d>6)continue;
          if(d>.8&&v.normalize().dot(frente(e.dir))<Math.cos(1.9))continue;
          cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=e.d.jefe?1.2:2.6;e.impresionado=true;numero(e.pos.clone().setY(e.m.alto+.5),'¡Impresionado!','impresionado',1.3);}}
      if(!h.golpeo&&k>=.86){h.golpeo=true;h.alto=0;golpearEn(3.2,Math.PI,h.atq*1.7*(h.especial??1),{empuje:4.5,aturde:1.1,chispas:14,causa:'salto'});marca('onda',h.pos.x,h.pos.z,4.2,0xffb050,.5);polvo(h.pos,40,2);romperPiso(h.pos);impactoFX.agujero(h.pos);chispas(h.pos.clone().setY(.3),30,[1,.7,.35],8,.5);temblar(.78);paron=.09;}
      if(h.t>=D){cambiar(h,'quieto');h.alto=0;}}
    else if(h.estado==='grito'){if(!h.golpeo&&h.t>=.18){h.golpeo=true;h.escudo=4;h.furia=Math.min(100,h.furia+35);marca('onda',h.pos.x,h.pos.z,10,0xffd070,.7);chispas(h.pos.clone().setY(1.4),40,[1,.85,.4],7,.5);temblar(.2);
        for(const e of enemigos){if(e.estado==='muere'||e.huida)continue;const d=plano(e.pos,h.pos);if(d<10){e.provocado=3.5;e.tirón={p:e.pos.clone().lerp(h.pos,Math.min(.5,1.6/Math.max(d,.1))),hasta:reloj.t+.35};if(e.estado==='entra')e.dentro=true;}}}
      if(h.t>=.7)cambiar(h,'quieto');}
    // El botín se recoge al pasar por encima.
    for(const b of botines)if(b.listo&&!b.volando&&!b.recogida&&plano(b.pos,h.pos)<1.1)recoger(b);
    h.inclinacion=(h.inclinacion||0)+(Math.max(-.16,Math.min(.16,difAng(dirAnterior,h.dir)/Math.max(.001,dt)*.018))-(h.inclinacion||0))*(1-Math.exp(-dt*8));h.paso+=((movido>0&&h.estado!=='esquiva'?(aDistancia()?1:Math.min(1,mov.length())):0)-h.paso)*(1-Math.exp(-dt*10));h.fase+=movido*TAU/(aDistancia()?1.75:MOD.animacion.longitudZancada(h.paso));dentroPlaza(h.pos,h.radio);
    if(desdeGiro&&h.torbellino){respetarMuralla(desdeGiro,h.pos,h.radio);pasoTorbellino(dt,desdeGiro);}}

  /* ---- Ataques enemigos: la zona exacta en el suelo, que se llena hasta el golpe ---------- */
  // Mientras se llena, el atacante gira hacia ti; en el último tramo se fija (la marca se enciende): es el momento de apartarse o esquivar.
  function matZona(forma){const m=matMarca(forma);m.blending=THREE.NormalBlending;return m;}
  function empezarAtaque(e,forma,o){e.objetivo=heroe.id;const a={forma,dur:o.dur*(e.tipo==='troll'&&e.fase2?.85:1),t0:reloj.t,dir:e.dir,radio:o.radio,ang:o.ang,largo:o.largo,ancho:o.ancho,centro:o.centro||null,fija:o.fija??.6,dano:o.dano,fijado:false,zonas:o.zonas||null};
    if(a.zonas){a.m=new THREE.Group();for(const z of a.zonas){const m=new THREE.Mesh(geoMarca,matZona(z.forma));m.renderOrder=1;a.m.add(m);}escena.add(a.m);}
    const m=a.m||new THREE.Mesh(forma==='linea'?geoLinea:geoMarca,matZona(forma));if(!a.zonas){m.renderOrder=1;m.material.uniforms.uC.value.set(0xff6a20);if(forma==='cono')m.material.uniforms.uAng.value=a.ang;escena.add(m);}a.m=m;
    e.mazazo=e.tipo==='troll'&&forma==='circulo';e.ataque=a;if(!e.alerta){e.alerta=etiqueta('apAlerta',new V3());}e.alerta.el.textContent=forma==='circulo'?'¡Imparable!':'!';e.alerta.el.classList.toggle('imparable',forma==='circulo');colocarAtaque(e);return a;}
  function colocarAtaque(e){const a=e.ataque,m=a.m,k=Math.min(1,(reloj.t-a.t0)/a.dur);
    if(a.zonas){const parry=a.dur-(reloj.t-a.t0)<=PARRY.perfecto;
      for(let i=0;i<a.zonas.length;i++){const z=a.zonas[i],pieza=m.children[i],u=pieza.material.uniforms;pieza.position.set(z.centro.x,.05,z.centro.z);pieza.rotation.y=z.dir;pieza.scale.setScalar(z.radio);u.uAng.value=z.ang;u.uP.value=k;u.uF.value=parry?1:0;u.uA.value=.8;u.uC.value.setHex(parry?0xbfffff:0xff9b32);}
      e.alerta.pos.set(e.pos.x,e.m.alto+.55,e.pos.z);e.alerta.el.classList.toggle('fijado',parry);e.alerta.el.style.setProperty('--k',k.toFixed(2));return;
    }const u=m.material.uniforms;
    if(a.forma==='circulo'){m.position.set(a.centro.x,.05,a.centro.z);m.scale.setScalar(a.radio);}
    else{m.position.set(e.pos.x,.05,e.pos.z);m.rotation.y=a.dir;if(a.forma==='cono')m.scale.setScalar(a.radio);else m.scale.set(a.ancho,1,a.largo);}
    u.uP.value=k;u.uF.value=a.fijado?1:0;if(a.forma==='circulo')u.uC.value.setRGB(a.fijado?.85:.6,.15,a.fijado?1:.85);else u.uC.value.setRGB(a.fijado?1:.95,a.fijado?.06:.22,a.fijado?.03:.05);u.uA.value=(a.fijado?.95:.7)+.05*Math.sin(reloj.t*(a.fijado?38:14));
    e.alerta.pos.set(e.pos.x,e.m.alto+.55,e.pos.z);e.alerta.el.classList.toggle('fijado',a.fijado);e.alerta.el.style.setProperty('--k',k.toFixed(2));}
  function cancelarAtaque(e,conservarCombo=false){if(!conservarCombo)e.comboCan=null;if(e.goblinSujeto){liberarModeloTroll(e.goblinSujeto);e.goblinSujeto=null;}if(e.ataque){escena.remove(e.ataque.m);if(e.ataque.zonas)e.ataque.m.children.forEach(m=>m.material.dispose());else e.ataque.m.material.dispose();e.ataque=null;}if(e.alerta){quitarEtiqueta(e.alerta);e.alerta=null;}}
  // ¿Está p dentro de la zona del ataque? (margen: el cuerpo de Adreida)
  function enZona(a,e,p,margen){if(a.zonas)return a.zonas.some(z=>enZona(z,e,p,margen));const o=a.centro||e.pos,dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);
    if(a.forma==='circulo')return d<a.radio+margen;
    const fx=Math.sin(a.dir),fz=Math.cos(a.dir);
    if(a.forma==='cono'){if(d>a.radio+margen)return false;if(d<e.radio+margen)return true;return Math.acos(Math.max(-1,Math.min(1,(dx*fx+dz*fz)/d)))<a.ang+Math.asin(Math.min(1,margen/d));}
    const largo=dx*fx+dz*fz,lado=Math.abs(-dx*fz+dz*fx);return largo>-margen&&largo<a.largo&&lado<a.ancho/2+margen;}
  // ¿Lo para? Tiene que estar en parry, de cara (±60°) y no ser un imparable.
  function parar(desde,imparable,ventana=PARRY.perfecto){const H=heroe;if(H.estado!=='parry'||imparable)return null;const v=desde.clone().sub(H.pos).setY(0);
    if(v.lengthSq()>1e-6&&v.normalize().dot(frente(H.dir))<Math.cos(1.05))return null;return H.t<=ventana?'perfecto':'bloqueo';}
  function parryPerfecto(e,p){const H=heroe;H.parryExito=true;H.brilloParry=.3;H.parrys++;for(const habilidad of Object.keys(H.cd))H.cd[habilidad]=habilidad==='ulti'?Math.max(0,H.cd.ulti-1):0;H.furia=Math.min(100,H.furia+20);cambiar(H,'quieto');
    numero(H.pos.clone().setY(2.5),'¡Parry!','parry');chispas(p,34,[1,.85,.35],7,.55);marca('onda',H.pos.x,H.pos.z,2.6,0xffd060,.35);paron=.16;temblar(.2);
    aturdirPorParry(e);}
  function aturdirPorParry(e){if(e&&e.estado!=='muere'){cancelarAtaque(e);cambiar(e,'aturdido');e.aturdidoT=e.tipo==='troll'?2.5:e.d.jefe?PARRY.aturdeJefe:PARRY.aturde;if(e.tipo==='troll')e.parryHasta=reloj.t+e.aturdidoT;e.expuestoHasta=reloj.t+e.aturdidoT+.3;e.emp.addScaledVector(e.pos.clone().sub(heroe.pos).setY(0).normalize(),2.2);e.culpableT=-9;}}
  function bloqueado(dano,desde,e){const H=heroe;H.parryExito=true;H.bloqueos++;numero(H.pos.clone().setY(2.4),'Bloqueo','bloqueo');chispas(desde.clone().lerp(H.pos,.7).setY(1.2),12,[.9,.9,1],4,.4);herir(Math.max(1,Math.round(dano*PARRY.bloqueo)),desde,e);}
  function resolverAtaque(e){const a=e.ataque,H=heroe;cambiar(e,'golpe');e.ataques++;
    if(a.forma==='linea'){if(e.tipo==='troll')arrojarGoblin(e,a);else if(e.tiraHacha)lanzarHacha(e,a);else lanzar(e,a);}
    else{const o=a.centro||e.pos;if(a.forma==='circulo'){marca('onda',o.x,o.z,a.radio+.6,0xff7040,.45);polvo(o,36,a.radio);if(e.tipo==='troll'){romperPiso(e.pos);lanzarPiedras(e);}temblar(.45);}
      const blancos=jugadores.filter(j=>j.vivo&&enZona(a,e,j.pos,j.radio*.6));
      const defensor=blancos.find(j=>j.invul<=0&&conHeroe(j,()=>parar(e.pos,a.forma==='circulo'))==='perfecto');
      if(defensor){conHeroe(defensor,()=>parryPerfecto(e,e.pos.clone().lerp(defensor.pos,.55).setY(1.2)));return;}
      for(const j of jugadores)conHeroe(j,()=>{const dentro=blancos.includes(j);if(!j.vivo)return;
        if(j.invul>0&&(dentro||j.esqDesde&&enZona(a,e,j.esqDesde,j.radio*.6)))esquivado(e);
        else if(dentro){if(parar(e.pos,a.forma==='circulo')==='bloqueo')bloqueado(a.dano,e.pos,e);
          else{herir(a.dano,e.pos,e);if(e.m?.varianteGoblin==='antorcha')prenderFuego(e);if(e.escudazo&&j.vivo)j.retroceso=j.pos.clone().sub(e.pos).setY(0).normalize().multiplyScalar(10);}}
      });}
    if(a.zonas){for(const z of a.zonas){const p=z.centro.clone().addScaledVector(frente(z.dir),z.radio*.6);marca('onda',p.x,p.z,.8,0xffbb65,.24);polvo(p,10,.7);}temblar(.13);}
    cancelarAtaque(e,!!e.comboCan);}
  // Los tres sectores salen de Can; sus ángulos se fijan al empezar la cadena.
  function empezarComboCan(e,paso=0){
    if(paso===0)e.comboCan={paso:0,dir:e.dir};
    const c=e.comboCan;if(!c)return;c.paso=paso;e.dir=c.dir;
    const zonas=(paso===0?[0]:[-Math.PI/3,Math.PI/3]).map(angulo=>({forma:'cono',centro:e.pos,dir:c.dir+angulo,radio:4.6,ang:Math.PI/6}));
    cambiar(e,'aviso');empezarAtaque(e,'conos',{dur:paso===0?1.05:.55,zonas,fija:0,dano:paso===0?e.d.dano:Math.round(e.d.dano*.85)});
    e.alerta.el.hidden=true;
    // Las escoltas esperan el segundo aviso; no inician otra cadena encima de ésta.
    presion.siguiente=Math.max(presion.siguiente,reloj.t+e.ataque.dur+e.d.golpe+.3);
  }
  // La armadura sólo se abre durante el aturdimiento causado por un parry perfecto.
  function vulnerableTroll(e){return e.estado==='aturdido'&&e.aturdidoT>0&&e.parryHasta>reloj.t;}
  function blindadoTroll(e){return e.tipo==='troll'&&e.fase2&&!vulnerableTroll(e);}
  function activarFaseTroll(e){if(e.tipo!=='troll'||e.fase2||e.estado==='muere'||e.vida>e.vidaMax*.5)return;
    e.fase2=true;e.parryHasta=0;e.expuestoHasta=0;
    banner('El Recaudador · Segunda fase','Su armadura sólo se abre con un parry perfecto. ¡Devuélvele sus piedras y goblins!');
    marca('onda',e.pos.x,e.pos.z,5,0x916aff,.8);}
  const peligrosTroll=[];
  const geoRocaTroll=new THREE.IcosahedronGeometry(.36,0),matRocaTroll=new THREE.MeshStandardMaterial({color:0x887566,roughness:1});
  function liberarModeloTroll(m){m.raiz.removeFromParent();const geometrías=new Set(),materiales=new Set(),esqueletos=new Set();m.raiz.traverse(o=>{if(o.skeleton)esqueletos.add(o.skeleton);if(o.geometry)geometrías.add(o.geometry);if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])materiales.add(mat);});for(const g of geometrías){if(g.userData.compartida)continue;if(g.userData.sinArma)g.setIndex(g.userData.sinArma);g.dispose();}for(const mat of materiales)mat.dispose();for(const esq of esqueletos)esq.dispose();}
  function quitarPeligroTroll(p){if(p.marca)quitarMarca(p.marca);if(p.modelo)liberarModeloTroll(p.modelo);else escena.remove(p.m);const i=peligrosTroll.indexOf(p);if(i>=0)peligrosTroll.splice(i,1);}
  function limpiarPeligrosTroll(e){for(const p of [...peligrosTroll])if(!e||p.dueno===e)quitarPeligroTroll(p);}
  function peligroTroll(e,tipo,m,desde,hasta,dur,altura,radio,dano,modelo=null){dentroPlaza(hasta,radio);hasta.y=0;
    const p={dueno:e,tipo,m,modelo,desde:desde.clone(),hasta:hasta.clone(),dur,altura,radio,dano,t:0,devuelto:false,
      marca:marca('circulo',hasta.x,hasta.z,radio,tipo==='roca'?0xff6030:0xffbd40,dur,{fijo:true})};
    m.position.copy(desde);escena.add(m);peligrosTroll.push(p);return p;}
  function lanzarPiedras(e){const centro=e.pos.clone(),giro=rnd()*TAU;for(let i=0;i<5;i++){const a=giro+i*TAU/5,r=3.8+rnd()*1.8;
      const radial=new V3(Math.sin(a),0,Math.cos(a)),origen=centro.clone().addScaledVector(radial,1.2).setY(.2),destino=centro.clone().addScaledVector(radial,r);
      const m=new THREE.Mesh(geoRocaTroll,matRocaTroll);m.castShadow=true;m.scale.set(1+rnd()*.4,.7+rnd()*.4,1);
      peligroTroll(e,'roca',m,origen,destino,1.45+i*.12,4.5+rnd()*1.5,.85,22);}}
  // Límite de cuatro en solitario, ocho en cooperativo, entre los que caminan, los sujetos y los que vuelan.
  function puedeLanzarGoblin(e){return !e.goblinSujeto&&!peligrosTroll.some(p=>p.dueno===e&&p.tipo==='goblin')&&
    enemigos.filter(o=>o.estado!=='muere').length+peligrosTroll.filter(p=>p.tipo==='goblin'&&!p.devuelto).length<4*FACTOR_COOP;}
  function sujetarGoblin(e){const m=MOD.crear('cobrador');MOD.posar(m,{anim:'aturdido',t:0});e.m.H.manoI.add(m.raiz);m.raiz.position.set(0,-.45,0);m.raiz.rotation.z=Math.PI;e.goblinSujeto=m;}
  function arrojarGoblin(e,a){const modelo=e.goblinSujeto;if(!modelo)return;e.m.raiz.updateMatrixWorld(true);const desde=modelo.raiz.getWorldPosition(new V3());
    e.goblinSujeto=null;modelo.raiz.removeFromParent();modelo.raiz.rotation.set(0,a.dir,0);
    const distancia=Math.min(12,Math.max(2,plano(e.pos,heroe.pos))),hasta=e.pos.clone().addScaledVector(frente(a.dir),distancia);
    peligroTroll(e,'goblin',modelo.raiz,desde,hasta,1.15,2.5,1,24,modelo);}
  function pasoPeligrosTroll(dt){for(const p of [...peligrosTroll]){if(p.dueno.estado==='muere'||!jugadores.some(h=>h.vivo)){quitarPeligroTroll(p);continue;}
      if(p.devuelto)p.hasta.copy(p.dueno.pos).setY(1.8);
      p.t+=dt;const k=Math.min(1,p.t/p.dur);p.m.position.lerpVectors(p.desde,p.hasta,k);p.m.position.y+=4*p.altura*k*(1-k);
      p.m.rotation.x+=dt*(p.tipo==='roca'?4:7);p.m.rotation.z+=dt*1.5;
      // El blanco azulado marca exactamente la ventana para empezar un parry perfecto.
      if(p.tipo==='roca'&&p.marca){const falta=Math.max(0,p.dur-p.t),u=p.marca.m.material.uniforms;u.uC.value.setHex(falta<=PARRY.perfectoLanza?0xbfffff:falta<=.55?0xffd050:0xff6030);u.uF.value=falta<=PARRY.perfectoLanza?1:0;}
      if(k<1)continue;
      if(p.devuelto){conHeroe(p.defensor||jugadores[0],()=>{aturdirPorParry(p.dueno);danar(p.dueno,45,{crit:false});});quitarPeligroTroll(p);continue;}
      const blancos=jugadores.filter(h=>h.vivo&&h.invul<=0&&plano(h.pos,p.hasta)<p.radio+h.radio*.6);
      const defensor=blancos.find(h=>conHeroe(h,()=>parar(p.desde,false,PARRY.perfectoLanza))==='perfecto');
      if(defensor){conHeroe(defensor,()=>parryPerfecto(null,p.hasta.clone().setY(1.2)));p.defensor=defensor;quitarMarca(p.marca);p.marca=null;p.devuelto=true;p.desde=p.hasta.clone().setY(1.2);p.hasta=p.dueno.pos.clone().setY(1.8);p.dur=.6;p.t=0;p.altura=1;continue;}
      for(const h of blancos)conHeroe(h,()=>{if(parar(p.desde,false,PARRY.perfectoLanza)==='bloqueo')bloqueado(p.dano,p.desde,p.dueno);else herir(p.dano,p.desde,p.dueno);});
      polvo(p.hasta,12,p.radio);marca('onda',p.hasta.x,p.hasta.z,p.radio,0xffb050,.25);
      if(p.tipo==='goblin'){const e=crearEnemigo('cobrador',p.hasta.x,p.hasta.z);e.sinBotin=true;cambiar(e,'aturdido');e.aturdidoT=1.2;}
      quitarPeligroTroll(p);}}

  // Las plazas se conservan entre golpes: descansar no obliga a dar la espalda y huir.
  // Una pareja presiona varios segundos; después releva a quienes esperan en los flancos.
  const RITMO={cuerpo:2*FACTOR_COOP,entreAtaques:.55,distanciaEspera:3.8,turno:7};
  const presion={siguiente:0,primeraLinea:new Set(),rutas:0};
  const refuerzosCan=[];
  function convocarGoblins(e){
    for(let i=0;i<12*FACTOR_COOP;i++)refuerzosCan.push({t:reloj.t+Math.floor(i/3)*.42,calle:i%3,fila:Math.floor(i/3),origen:e.pos.clone()});
  }
  function pasoRefuerzosCan(){
    while(refuerzosCan.length&&refuerzosCan[0].t<=reloj.t&&enemigos.filter(e=>e.estado!=='muere').length<32){
      const r=refuerzosCan.shift(),a=CALLES[r.calle],n=calle(a),lado=new V3(-n.z,0,n.x);
      const p=ABIERTO?r.origen.clone().addScaledVector(n,10):n.multiplyScalar(R+2.5+r.fila*.3);
      p.addScaledVector(lado,(r.fila%3-1)*.65);const g=crearEnemigo('goblin',p.x,p.z);g.cd=.8+r.fila*.12;
      if(ABIERTO){g.dentro=true;cambiar(g,'persigue');}
    }
  }
  // Decisiones a intervalos, destinos persistentes y anticipación corta del movimiento.
  function planEnemigo(e,H,entra){
    const tactica=e.ia,version=tactica?.version||0;
    if(e.plan&&e.plan.iaVersion===version&&e.plan.entra===entra&&e.plan.hasta>reloj.t&&plano(e.plan.heroe,H.pos)<1.2)return e.plan.p;
    const flanquea=tactica?.accion==='flanquear',cubre=tactica?.accion==='cubrir';
    const base=flanquea||cubre?tactica.angulo:rumbo(H.pos,e.pos),radio=flanquea?Math.min(3,plano(e.pos,H.pos)):entra?H.radio+e.radio+e.d.alcance*.5:RITMO.distanciaEspera+(e.id%3)*.4;
    const futuro=H.pos.clone().addScaledVector(H.velocidad||new V3(),entra?.18:.3);
    let mejor=null,coste=Infinity;
    for(const desvio of [0,.35,-.35,.7,-.7,1.05,-1.05]){
      const a=base+desvio+(entra?0:(e.rodeo>=0?1:-1)*.3),p=futuro.clone().addScaledVector(frente(a),radio),antes=p.clone();
      dentroPlaza(p,e.radio+.12);
      let nota=plano(p,e.pos)+Math.abs(desvio)*(flanquea||cubre?3:.3)+plano(p,antes)*5;
      if(!pasoLibreEnemigo(e.pos,p,e.radio+.03))nota+=2;
      for(const o of enemigos)if(o!==e&&o.estado!=='muere'){const d=plano(o.pos,p);if(d<1.6)nota+=(1.6-d)*3;}
      if(e.plan)nota+=plano(p,e.plan.p)*.15;
      if(nota<coste){coste=nota;mejor=p;}
    }
    e.plan={p:mejor,entra,iaVersion:version,heroe:H.pos.clone(),hasta:reloj.t+.24+(e.id%4)*.035};return mejor;
  }
  function sectorLibre(x,z){const a=rumbo(heroe.pos,new V3(x,0,z)),ocupados=enemigos.filter(e=>e.estado!=='muere'&&!e.d.lanza).map(e=>e.sector);
    let mejor=a,nota=Infinity;for(let i=0;i<10;i++){const candidato=i*TAU/10,coste=Math.abs(difAng(a,candidato))+ocupados.filter(v=>Math.abs(difAng(v,candidato))<.3).length*10;
      if(coste<nota){nota=coste;mejor=candidato;}}return mejor;}
  function coordinarEnemigos(){const cuerpo=enemigos.filter(e=>!e.d.lanza&&e.estado!=='muere'),anteriores=presion.primeraLinea;
    const atacando=cuerpo.filter(e=>['aviso','golpe','recupera'].includes(e.estado));presion.primeraLinea=new Set(atacando.map(e=>e.id));
    const candidatos=cuerpo.filter(e=>e.estado==='persigue'&&plano(e.pos,objetivoEnemigo(e).pos)<9);
    candidatos.sort((a,b)=>(b.turnoHasta>reloj.t)-(a.turnoHasta>reloj.t)||a.ultimoTurno-b.ultimoTurno||plano(a.pos,objetivoEnemigo(a).pos)-plano(b.pos,objetivoEnemigo(b).pos));
    for(const e of candidatos){if(presion.primeraLinea.size>=RITMO.cuerpo)break;
      if(e.turnoHasta<=reloj.t){e.turnoHasta=reloj.t+RITMO.turno;e.ultimoTurno=reloj.t;}presion.primeraLinea.add(e.id);}
    for(const e of cuerpo)if(anteriores.has(e.id)&&!presion.primeraLinea.has(e.id)){
      e.turnoHasta=0;e.sector=rumbo(objetivoEnemigo(e).pos,e.pos)+(e.rodeo>=0?1:-1)*.55;
    }
  }
  // Trayectos en una cuadrícula local, sólo cuando un obstáculo tapa el camino directo.
  // Se conserva la ruta mientras se rodea el pozo para no cambiar de lado en cada cuadro.
  function pasoLibreEnemigo(a,b,r){
    const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
    for(const o of obstaculos){const k=l?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/l)):0;
      if(Math.hypot(a.x+k*dx-o.x,a.z+k*dz-o.z)<o.r+r-.001)return false;
    }return true;
  }
  function buscarRutaEnemigo(e,destino){
    if(!pasoLibreEnemigo(destino,destino,e.radio))return [];
    const celda=.65,margen=.06,radio=e.radio+margen,inicio=e.pos,abiertos=[],nodos=new Map(),cerrados=new Set();
    const clave=(x,z)=>x+','+z,h=p=>plano(p,destino);
    // Cola de prioridad: la búsqueda no ordena toda la frontera para cada nodo.
    function poner(n){abiertos.push(n);let i=abiertos.length-1;while(i){const p=(i-1)>>1;if(abiertos[p].f<=n.f)break;abiertos[i]=abiertos[p];i=p;}abiertos[i]=n;}
    function sacar(){const n=abiertos[0],ultimo=abiertos.pop();if(abiertos.length){let i=0;while(i*2+1<abiertos.length){let j=i*2+1;if(j+1<abiertos.length&&abiertos[j+1].f<abiertos[j].f)j++;if(abiertos[j].f>=ultimo.f)break;abiertos[i]=abiertos[j];i=j;}abiertos[i]=ultimo;}return n;}
    const origen={x:inicio.x,z:inicio.z,g:0,f:h(inicio),padre:null};poner(origen);
    const dentro=p=>ABIERTO||!e.dentro||PLANOS_MURALLA.every(n=>p.x*n.x+p.z*n.z<=R-radio);
    let final=null;
    for(let intentos=0;abiertos.length&&intentos<1600;intentos++){
      const n=sacar(),id=clave(n.x,n.z);if(cerrados.has(id))continue;cerrados.add(id);
      if(pasoLibreEnemigo(n,destino,e.radio)){final={...destino,padre:n};break;}
      const ix=Math.round(n.x/celda),iz=Math.round(n.z/celda);
      for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++){
        const p={x:x*celda,z:z*celda},k=clave(p.x,p.z);if(cerrados.has(k)||!dentro(p))continue;
        const g=n.g+plano(n,p),previo=nodos.get(k);if(previo&&previo.g<=g)continue;
        // En el primer segmento se tolera estar ya tocando la colisión, por un empujón.
        if(!pasoLibreEnemigo(n,p,n===origen?e.radio:radio))continue;
        Object.assign(p,{g,f:g+h(p),padre:n});nodos.set(k,p);poner(p);
      }
    }
    const puntos=[];for(let n=final;n&&n.padre;n=n.padre)puntos.push(new V3(n.x,0,n.z));
    return puntos.reverse();
  }
  function destinoEnemigo(e,destino){
    if(pasoLibreEnemigo(e.pos,destino,e.radio)){e.ruta=null;return destino;}
    let ruta=e.ruta;
    if((!ruta||plano(ruta.destino,destino)>1.6||reloj.t>ruta.hasta||ruta.puntos.length&&!pasoLibreEnemigo(e.pos,ruta.puntos[0],e.radio))&&presion.rutas<2){
      presion.rutas++;
      ruta=e.ruta={puntos:buscarRutaEnemigo(e,destino),destino:destino.clone(),hasta:reloj.t+1.2};
    }
    if(!ruta)return e.pos;
    while(ruta.puntos.length&&plano(e.pos,ruta.puntos[0])<.005)ruta.puntos.shift();
    // Acorta esquinas sólo cuando el cuerpo completo cabe por el segmento.
    while(ruta.puntos.length>1&&pasoLibreEnemigo(e.pos,ruta.puntos[1],e.radio+.025))ruta.puntos.shift();
    return ruta.puntos[0]||e.pos;
  }
  // Una tirada espaciada, nunca una probabilidad por cuadro. Comparte los cupos del cuerpo a cuerpo.
  function intentarHachaGoblin(e,dist){
    if(!['goblin','cobrador'].includes(e.tipo)||!['clasico','dosHachas'].includes(e.m.varianteGoblin)||e.provocado>0||e.cd>0||dist<3||dist>8||reloj.t<(e.hachaDesde??0)||reloj.t<presion.siguiente||!presion.primeraLinea.has(e.id))return false;
    if(enemigos.some(o=>o!==e&&(o.d.lanza||o.tiraHacha)&&['aviso','golpe'].includes(o.estado))||lanzas.some(l=>l.tipo==='hacha'&&!l.clavada)||!pasoLibreEnemigo(e.pos,heroe.pos,.2))return false;
    e.hachaDesde=reloj.t+3.5+rnd()*2;if(rnd()>=.3)return false;
    e.dir=rumbo(e.pos,heroe.pos);e.tiraHacha=true;presion.siguiente=reloj.t+RITMO.entreAtaques;cambiar(e,'aviso');
    empezarAtaque(e,'linea',{dur:1.05,largo:10,ancho:.85,fija:.5,dano:Math.round(e.d.dano*.85)});e.alerta.el.textContent='¡Hacha!';return true;
  }
  function pasoEnemigo(e,dt){activarFaseTroll(e);const d=e.d;e.t+=dt;e.destello=Math.max(0,e.destello-dt*9);e.provocado=Math.max(0,e.provocado-dt);e.cd-=dt;
    if(e.estado==='muere'&&e.muerte)avanzarCaidaGoblin(e);else{e.pos.addScaledVector(e.emp,dt);e.emp.multiplyScalar(Math.exp(-dt*7));}
    // El tirón de Provocar dura un instante (si el punto cae en un obstáculo no se queda enganchado).
    if(e.tirón){e.pos.lerp(e.tirón.p,Math.min(1,dt*8));if(reloj.t>e.tirón.hasta||plano(e.pos,e.tirón.p)<.05)e.tirón=null;}
    if(e.huida&&e.estado!=='muere'){e.provocado=0;e.tirón=null;if(e.estado!=='huye'){cancelarAtaque(e);cambiar(e,'huye');}}
    if(!e.huida&&!e.dentro&&Math.hypot(e.pos.x,e.pos.z)<R-1.2)e.dentro=true;
    const H=heroe,dist=plano(e.pos,H.pos),hacia=(p,vel)=>{
      p=destinoEnemigo(e,p);const dd=plano(p,e.pos);if(dd<.005)return 0;
      const direccion=p.clone().sub(e.pos).setY(0).normalize();
      for(const o of enemigos){if(o===e||o.estado==='muere')continue;const dx=e.pos.x-o.pos.x,dz=e.pos.z-o.pos.z,d2=dx*dx+dz*dz;
        const alcance=e.radio+o.radio+.5;if(d2>.001&&d2<alcance*alcance){const d=Math.sqrt(d2),f=(alcance-d)/alcance*.85;direccion.x+=dx/d*f;direccion.z+=dz/d*f;}}
      direccion.normalize();const paso=Math.min(dd,vel*dt),siguiente=e.pos.clone().addScaledVector(direccion,paso);
      // La evasión de vecinos no puede sacar al enemigo de su ruta ni meterlo en el pozo.
      if(!pasoLibreEnemigo(e.pos,siguiente,e.radio))siguiente.copy(e.pos).lerp(p,paso/dd);
      const a=rumbo(e.pos,siguiente);e.dir+=difAng(e.dir,a)*Math.min(1,dt*9);const avance=plano(e.pos,siguiente);e.pos.copy(siguiente);return avance;
    };
    let movido=0;const vel=d.vel*(e.provocado>0?1.25:1)*(e.tipo==='troll'&&e.fase2?1.2:1);
    switch(e.estado){
      case 'quieto':break;
      case 'huye':{const f=e.huida;
        if(!f.cruzando&&plano(e.pos,f.entrada)<1.4){f.cruzando=true;e.dentro=false;e.ruta=null;}
        if(f.cruzando&&plano(e.pos,f.salida)<2)f.salida.addScaledVector(f.direccion,40);
        movido=hacia(f.cruzando?f.salida:f.entrada,Math.max(4.5,vel*1.65));break;}
      case 'entra':movido=hacia(new V3(e.pos.x*.5,0,e.pos.z*.5),vel);if(Math.hypot(e.pos.x,e.pos.z)<R-1.2){e.dentro=true;cambiar(e,'persigue');}break;
      case 'persigue':{e.tiraHacha=false;if(!H.vivo||H.sigilo>0){movido=hacia(e.pos.clone().multiplyScalar(1.02),vel*.3);break;}
        if(e.tipo==='can'&&!e.gritó&&e.vida<e.vidaMax*.5){e.gritó=true;cambiar(e,'grito');marca('onda',e.pos.x,e.pos.z,8,0xff5030,.8);banner('¡A mí, goblins!','Can llama a los suyos.');break;}
        if(d.lanza){// Kobold: guarda la distancia (salvo provocado) y apunta con la línea.
          const lejos=e.pos.clone().sub(H.pos).setY(0).normalize();if(!pasoLibreEnemigo(e.pos,H.pos,.1)){const lateral=e.pos.clone().addScaledVector(new V3(-lejos.z,0,lejos.x),e.rodeo>=0?2:-2);movido=hacia(lateral,vel*.8);}
          else if(dist>8.5||e.provocado)movido=hacia(H.pos,vel);else if(dist<5)movido=hacia(e.pos.clone().addScaledVector(lejos,2),vel*.9);
          else{const lado=new V3(-lejos.z,0,lejos.x).multiplyScalar(e.rodeo>0?1:-1);movido=hacia(e.pos.clone().addScaledVector(lado,1.5),vel*.45);}
          if(e.cd<=0&&dist<d.alcance&&pasoLibreEnemigo(e.pos,H.pos,.1)&&reloj.t>=presion.siguiente&&!enemigos.some(o=>o!==e&&(o.d.lanza||o.tiraHacha)&&['aviso','golpe'].includes(o.estado))){presion.siguiente=reloj.t+RITMO.entreAtaques;e.dir=rumbo(e.pos,H.pos);cambiar(e,'aviso');empezarAtaque(e,'linea',{dur:d.aviso,largo:d.largo,ancho:d.ancho,fija:.65,dano:d.dano});}break;}
        const entra=presion.primeraLinea.has(e.id);
        const tactica=e.ia?.decidir(H,entra,reloj.t,()=>pasoLibreEnemigo(e.pos,H.pos,.2));
        if((!tactica||tactica.accion==='lanzar')&&['clasico','dosHachas'].includes(e.m.varianteGoblin)&&intentarHachaGoblin(e,dist))break;
        // Quien no tiene turno se reparte en un anillo exterior; deja libre el cuerpo del jugador.
        const tira=e.tipo==='troll'&&e.ataques%3===2&&puedeLanzarGoblin(e);
        const obj=planEnemigo(e,H,entra);
        const frontal=frente(H.dir).dot(e.pos.clone().sub(H.pos).normalize())>.55;
        if((e.tipo==='goblin'||e.tipo==='cobrador')&&H.estado==='carga'&&H.carga>.55&&dist<3.5&&frontal&&reloj.t>(e.evadeCd||0)){
          const lado=frente(H.dir+Math.PI/2*(e.rodeo>=0?1:-1));e.evade={p:e.pos.clone().addScaledVector(lado,1.1),hasta:reloj.t+.32};dentroPlaza(e.evade.p,e.radio);e.evadeCd=reloj.t+3.2;
        }
        if(e.evade?.hasta>reloj.t){movido=hacia(e.evade.p,vel*1.2);break;}
        if(plano(e.pos,obj)>.18&&(dist>H.radio+e.radio+d.alcance*.6||!entra))movido=hacia(obj,vel*(entra?1:.7));
        if(dist<5)e.dir+=difAng(e.dir,rumbo(e.pos,H.pos))*Math.min(1,dt*9);
        if(entra&&dist<(tira?9:H.radio+e.radio+d.alcance+.2)&&e.cd<=0&&reloj.t>=presion.siguiente&&pasoLibreEnemigo(e.pos,H.pos,.05)){
          presion.siguiente=reloj.t+RITMO.entreAtaques;e.dir=rumbo(e.pos,H.pos);cambiar(e,'aviso');
          e.tiraGoblin=tira;e.escudazo=e.tipo==='saqueador'&&dist<2.5&&e.ataques%2===0;
          if(e.escudazo){empezarAtaque(e,'cono',{dur:.65,radio:2.3,ang:1.05,fija:.4,dano:14});e.alerta.el.textContent='¡Escudo!';}
          else if(tira){sujetarGoblin(e);empezarAtaque(e,'linea',{dur:1.4,largo:12,ancho:1.4,fija:.5,dano:24});e.alerta.el.textContent='¡Goblin!';}
          else if(e.tipo==='troll'&&e.ataques%3===1)empezarAtaque(e,'circulo',{dur:1.5,radio:3.5,centro:e.pos,fija:0,dano:44});
          else if(e.tipo==='can'&&e.ataques%3===2)empezarAtaque(e,'circulo',{dur:1.15,radio:2.8,centro:e.pos.clone().add(frente(e.dir).multiplyScalar(1.8)),fija:0,dano:Math.round(d.dano*1.5)});
          else if(e.tipo==='can')empezarComboCan(e);
          else empezarAtaque(e,'cono',{dur:d.aviso,radio:d.radio,ang:d.ang,fija:.5,dano:d.dano});}
        break;}
      case 'aviso':{if(H.sigilo>0&&e.ataque&&!e.ataque.fijado){cancelarAtaque(e);cambiar(e,'persigue');break;}const a=e.ataque;if(!a){cambiar(e,'persigue');break;}const k=(reloj.t-a.t0)/a.dur;
        if(!a.fijado&&k<a.fija){e.dir+=difAng(e.dir,rumbo(e.pos,H.pos))*Math.min(1,dt*(d.lanza?5:3.5));a.dir=e.dir;}else a.fijado=true;
        colocarAtaque(e);if(k>=1)resolverAtaque(e);break;}
      case 'grito':if(e.t>=.9){cambiar(e,'persigue');convocarGoblins(e);}break;
      case 'golpe':if(e.t>=d.golpe){if(e.comboCan?.paso===0){empezarComboCan(e,1);break;}cambiar(e,'recupera');if(e.tipo==='troll'&&e.mazazo&&!e.fase2)e.expuestoHasta=reloj.t+d.recupera;}break;
      case 'recupera':if(e.t>=d.recupera){e.comboCan=null;e.cd=d.cd*(.8+rnd()*.4)*(e.tipo==='troll'&&e.fase2?.85:1);cambiar(e,'persigue');}break;
      case 'dolor':if(e.t>=.28){e.cd=Math.max(e.cd,.35);cambiar(e,'persigue');}break;
      case 'aturdido':e.aturdidoT-=dt;if(e.aturdidoT<=0){cambiar(e,'persigue');}break;
      case 'muere':{const espera=e.muerte?e.muerte.duracion+.35:.55;if(e.t>espera){const k=(e.t-espera)/.9;e.m.M.u.uDisuelve.value=Math.min(1,k);if(k>.02)e.m.mallas.forEach(x=>x.castShadow=false);if(rnd()<.6)brasas(e.pos,1,e.m.alto);
          if(k>=1){escena.remove(e.m.raiz);enemigos.splice(enemigos.indexOf(e),1);}}break;}
    }
    e.fase+=movido*TAU/(e.m.alto*.95);e.paso+=((movido>0?1:0)-e.paso)*Math.min(1,dt*10);
    if(e.estado!=='muere'&&!e.huida?.cruzando&&(e.dentro||e.estado==='persigue'))dentroPlaza(e.pos,e.radio);}
  // Sin su jefe cancelan el ataque y buscan una salida; desaparecer no concede botín.
  function asustarGoblins(can){
    refuerzosCan.length=0;ol.cola=ol.cola.filter(([tipo])=>!['goblin','cobrador'].includes(tipo));ol.lote=0;
    for(const e of enemigos){if(!['goblin','cobrador'].includes(e.tipo)||e.estado==='muere'||e.huida)continue;
      cancelarAtaque(e);e.ia=null;e.plan=e.ruta=e.evade=e.tirón=null;e.provocado=0;e.emp.set(0,0,0);e.culpableT=-9;
      presion.primeraLinea.delete(e.id);e.turnoHasta=0;
      let direccion,entrada;
      if(ABIERTO){direccion=e.pos.clone().sub(can.pos).setY(0);if(direccion.lengthSq()<.01)direccion.copy(frente(e.id*2.4));direccion.normalize();entrada=e.pos.clone();}
      else{entrada=CALLES.map(a=>calle(a).multiplyScalar(R-2)).sort((a,b)=>plano(a,e.pos)-plano(b,e.pos))[0];direccion=entrada.clone().normalize();}
      e.huida={entrada,direccion,salida:ABIERTO?e.pos.clone().addScaledVector(direccion,50):direccion.clone().multiplyScalar(R+28),cruzando:ABIERTO};
      cambiar(e,'huye');
    }
  }
  const frustumHuida=new THREE.Frustum(),matrizHuida=new THREE.Matrix4(),esferaHuida=new THREE.Sphere();
  function retirarHuidosFueraDeCamara(){
    if(!enemigos.some(e=>e.estado==='huye'))return;
    frustumHuida.setFromProjectionMatrix(matrizHuida.multiplyMatrices(camara.projectionMatrix,camara.matrixWorldInverse));
    for(const e of [...enemigos]){if(e.estado!=='huye'||e.t<.35)continue;
      // Un margen amplio incluye cabeza, brazos y arma: nunca se borra a mitad de pantalla.
      esferaHuida.center.set(e.pos.x,e.m.alto*.5,e.pos.z);esferaHuida.radius=e.m.alto*1.15;
      if(frustumHuida.intersectsSphere(esferaHuida))continue;
      e.estado='muere';e.vida=0;liberarModeloTroll(e.m);if(e.estrellas)escena.remove(e.estrellas);
      enemigos.splice(enemigos.indexOf(e),1);presion.primeraLinea.delete(e.id);
      for(const h of jugadores){if(h.ultimo===e)h.ultimo=null;if(h.entrada?.sobre===e)h.entrada.sobre=null;}
      if(ent.sobre===e){ent.sobre=null;seleccion.m.visible=false;}
    }
  }
  function morir(e,impacto={}){if(e.estado==='muere')return;
    if(e.tipo==='goblin'||e.tipo==='cobrador'){
      const m=MOD.crearMuerteGoblin(impacto.causa),direccion=(impacto.direccion||frente(e.dir+Math.PI)).clone().setY(0).normalize();
      m.direccion=direccion;m.angulo=difAng(e.dir,Math.atan2(direccion.x,direccion.z)+(m.adelante?0:Math.PI));m.recorrido=0;m.contactosEmitidos=0;m.roce=0;if(impacto.causa==='cargado'&&impacto.cargaCompleta&&rnd()<.33){m.partido=true;m.rodada=null;m.duracion=1.35;m.distancia=1.4;m.contactos=[.55,.8];}e.muerte=m;e.emp.set(0,0,0);e.tirón=null;
    }
    cancelarAtaque(e);limpiarPeligrosTroll(e);cambiar(e,'muere');e.vida=0;brasas(e.pos,14,e.m.alto);if(e.estrellas){escena.remove(e.estrellas);e.estrellas=null;}
    if(e.tipo==='can')asustarGoblins(e);
    if(e.sinBotin)return;
    rog.bajas++;if([1,3,5].includes(rog.bajas))soltarDestino(e.pos);
    if(e.tipo==='troll'){globo(e.pos);globo(e.pos);globo(e.pos);banner('¡Se acabó el cobro de piso!','El Recaudador ha caído. Acaba con los cobradores que queden.');return;}
    if(e.tipo==='can'){soltar('llavemago','dorado',e.pos.x,e.pos.z,e.pos.clone().setY(1.5));globo(e.pos);globo(e.pos);return;}
    if(rnd()<e.d.globo)globo(e.pos);}

  // El recorrido de la caída depende del tiempo absoluto y se detiene ante pozo o muralla.
  // No suma el antiguo empuje: una muerte cargada debe dar una sola rodada, sin deslizarse de más.
  function avanzarCaidaGoblin(e){const m=e.muerte,k=Math.min(1,e.t/m.duracion),viaje=MOD.recorridoMuerteGoblin(m,k),anterior=m.recorrido;let avance=0;
    if(!m.bloqueada){const distancia=viaje-m.recorrido,n=Math.max(1,Math.ceil(distancia/.12));
      for(let i=0;i<n;i++){const siguiente=e.pos.clone().addScaledVector(m.direccion,distancia/n),libre=siguiente.clone();dentroPlaza(libre,Math.max(e.radio,.58));
        if(plano(siguiente,libre)>.015){m.bloqueada=true;break;}e.pos.copy(siguiente);avance+=distancia/n;}
    }m.recorrido=viaje;
    while(m.contactosEmitidos<m.contactos.length&&k>=m.contactos[m.contactosEmitidos]){
      const fuerza=m.fuerza*(m.contactosEmitidos ? .45 : 1);MOD.emitirPolvoMuerte(e.pos,fuerza,m.direccion,particula,rnd);m.contactosEmitidos++;
    }
    if(m.rodada&&avance>0&&!m.bloqueada){m.roce+=Math.min(avance,Math.max(0,Math.min(viaje,MOD.recorridoMuerteGoblin(m,m.rodada.fin))-Math.max(anterior,MOD.recorridoMuerteGoblin(m,m.rodada.inicio))));while(m.roce>=.4){m.roce-=.4;MOD.emitirPolvoMuerte(e.pos,m.fuerza,m.direccion,particula,rnd,true);}}
  }

  /* ---- Oleadas ------------------------------------------------------------------------- */
  const OLEADAS=[
    {nombre:'Oleada 1 · Los goblins del camino',grupos:[['goblin',6]],maxVivos:4},
    {nombre:'Oleada 2 · Lanzas desde las calles',grupos:[['goblin',5],['kobold',3]],maxVivos:5},
    {nombre:'Oleada 3 · Los saqueadores',grupos:[['saqueador',3],['goblin',4],['kobold',3]],maxVivos:6},
    {nombre:'Can, el de los Goblins',grupos:[['can',1],['goblin',2],['kobold',2]],maxVivos:5,jefe:true,jefeNombre:'Can',etapa:1},
    {nombre:'Cobro de piso · Fase 1/3 · Los cobradores',grupos:[['cobrador',6]],maxVivos:4,etapa:2,fase:1,texto:'La primera cuadrilla viene a cobrar. Despeja la plaza.'},
    {nombre:'Cobro de piso · Fase 2/3 · Los refuerzos',grupos:[['cobrador',4],['kobold',2]],maxVivos:4,etapa:2,fase:2,texto:'Llegan cobradores con lanceros. Abre espacio y devuelve sus lanzas.'},
    {nombre:'Cobro de piso · Fase 3/3 · El Recaudador',fase:3,grupos:[['troll',1],['cobrador',6]],maxVivos:4,jefe:true,jefeNombre:'El Recaudador',etapa:2,texto:'«Esta plaza tiene dueño. ¡Paguen el piso!» Un troll de tres metros y seis goblins vienen a cobrar.'},
  ];
  const ol={auto:!CAPTURA,i:q.get('etapa')==='2'?3:-1,cola:[],espera:1.8,lote:0,descanso:1.8,fin:false};
  function pasoOleadas(dt){if(ABIERTO||!ol.auto||ol.fin||!jugadores.some(h=>h.vivo))return;
    if(refuerzosCan.length)return;
    const vivos=enemigos.filter(e=>e.estado!=='muere').length+peligrosTroll.filter(p=>p.tipo==='goblin'&&!p.devuelto).length+enemigos.filter(e=>e.goblinSujeto).length;
    if(ol.cola.length){const max=(OLEADAS[ol.i]?.maxVivos??5)*FACTOR_COOP;ol.descanso=null;ol.espera-=dt;
      if(ol.espera>0||vivos>=max)return;
      // Refuerzos de hasta tres: sólo entran cuando la presión baja, nunca una cola continua de diez.
      if(!ol.lote){if(vivos>Math.max(1,max-3*FACTOR_COOP))return;ol.lote=Math.min(3*FACTOR_COOP,max-vivos,ol.cola.length);}
      const [tipo,k]=ol.cola.shift(),a=CALLES[k%3],p=calle(a).multiplyScalar(R+3+rnd());crearEnemigo(tipo,p.x,p.z);
      ol.lote--;ol.espera=ol.lote?.75:2.4;return;}
    if(vivos){ol.descanso=null;return;}
    // Las fases internas no abren la selección: sólo el final de cada nivel.
    if((ol.i===3||ol.i===OLEADAS.length-1)&&rog.terminado!==ol.i&&rog.cartas.length){
      while(rog.emitidas<3)soltarDestino(heroe.pos);
      if(rog.mano.length<3){if(ol.descanso!==-1){banner('Nivel despejado','Encuentra las tres cartas para elegir tu destino.');ol.descanso=-1;}return;}
      abrirDestino();return;}

    if(ol.descanso===null){ol.descanso=ol.i===3?8:ol.i<0?1.8:3;if(ol.i===3)banner('Etapa 1 superada','Can ha caído. Recoge el botín: los cobradores de piso se acercan.');}ol.descanso-=dt;if(ol.descanso>0)return;
    if(ol.i+1>=OLEADAS.length){ol.fin=true;banner('Tomsage es libre','Has derrotado al troll y a todos sus cobradores. Nadie vuelve a cobrar piso en esta plaza.');return;}
    ol.i++;const O=OLEADAS[ol.i];if(ol.i===0||ol.i===4)iniciarDestino(ol.i===0?1:2);if(O.etapa===2&&O.fase===1)for(const h of jugadores){h.alma=Math.min(h.almaMax,h.alma+40);h.vivo=true;cambiar(h,'quieto');}let k=0;ol.cola=[];for(const [tipo,n] of O.grupos)for(let i=0;i<n*FACTOR_COOP;i++)ol.cola.push([tipo,k++]);
    for(let i=ol.cola.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));if(!DEF[ol.cola[i][0]].jefe&&!DEF[ol.cola[j][0]].jefe)[ol.cola[i],ol.cola[j]]=[ol.cola[j],ol.cola[i]];}
    ol.espera=.6;ol.lote=0;ol.descanso=null;banner(O.nombre,O.texto||(O.jefe?'Can entra con su escolta.':'Llegan en grupos. Busca un hueco y contraataca.'));}
  function reiniciar(){impactoFX.limpiar();temporizador.reiniciar();if(rog.abierto)$('destino').close();Object.assign(rog,{vuelta:1,nivel:0,cartas:[],mano:[],efectos:[],emitidas:0,bajas:0,abierto:false,resuelto:false,terminado:-1});limpiarPeligrosTroll();escombros.length=0;mallaEscombros.count=0;presion.siguiente=0;presion.primeraLinea.clear();refuerzosCan.length=0;disparosPendientes.length=0;punteria=null;lineaMira.visible=puntoMira.visible=false;for(const e of [...enemigos]){cancelarAtaque(e);escena.remove(e.m.raiz);}enemigos.length=0;for(const b of [...botines])quitarBotin(b);for(const g of globos)escena.remove(g.m);globos.length=0;for(const l of lanzas)escena.remove(l.g);lanzas.length=0;for(const b of balas)escena.remove(b.g);balas.length=0;
    for(const b of [...bumeranes])quitarBumeran(b);
    for(const o of [...marcas])if(!o.fijo)quitarMarca(o);limpiarFuegoRopa();for(const h of jugadores)liberarModeloTroll(h.m);limpiarAliados();crearEquipo();reiniciarExploracion();$('botin').innerHTML='';Object.assign(ol,{i:q.get('etapa')==='2'?3:-1,cola:[],espera:1.8,lote:0,descanso:1.8,fin:false});$('fin').hidden=true;finMostrado=false;}

  /* ---- Entrada: teclado, ratón y táctil ---------------------------------------------------
     ctl es lo que manda en cada paso de simulación: movimiento, si ataca y hacia dónde apunta. Lo llenan el
     teclado y el ratón, la palanca táctil, el piloto automático o la revisión. */
  const puntero=new THREE.Vector2(),ray=new THREE.Raycaster(),planoSuelo=new THREE.Plane(new V3(0,1,0),0);
  let ent={dentro:false,atacando:false,sobre:null,suelo:new V3(),tactil:false,palanca:null,piloto:false,rev:null,lectura:null,lecturaHasta:0};
  let ctl={mov:new V3(),atacar:false,apunta:null};
  const teclas=new Set(),DIRS={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
  const ACCION={Space:'parry',ShiftLeft:'esquiva',ShiftRight:'esquiva',KeyQ:'torbellino',Digit1:'torbellino',KeyR:'ulti',Digit2:'salto',KeyE:'provocar',Digit3:'provocar'};
  // DualSense y otros mandos que el navegador presenta con distribución estándar.
  let mando={indice:null,botones:[],activo:false,foco:true,listo:false,dir:new V3(0,0,-1)};
  const pausa={activa:false,boton:false,confirmar:false};
  function ponerPausa(v){if(rog.abierto||v===pausa.activa)return;pausa.activa=v;sincronizarTiempo();clima.pausar(v||document.hidden||!partidaActiva);
    ent.atacando=ent.pendiente=false;ctl.atacar=false;ctl.mov.set(0,0,0);teclas.clear();mando.listo=false;mando.activo=false;
    for(const h of jugadores){h.entrada.atacando=h.entrada.pendiente=false;h.control.atacar=false;h.mando.listo=h.mando.activo=false;if(h.estado==='carga'){h.carga=0;cambiar(h,'quieto');}}
    if(v){$('pausa').showModal();$('continuar').focus();}else{$('pausa').close();lienzo.focus();clima.desbloquearAudio();}}
  function leerPausaMando(){let g;try{g=Array.from(navigator.getGamepads?.()||[]).find(g=>g?.connected&&g.mapping==='standard');}catch{return;}
    const pads=Array.from(navigator.getGamepads?.()||[]).filter(g=>g?.connected&&g.mapping==='standard');const b=pads.some(g=>g.buttons[9]?.pressed),x=pads.some(g=>g.buttons[0]?.pressed);
    const pulsado=b&&!pausa.boton,confirma=x&&!pausa.confirmar;pausa.boton=b;pausa.confirmar=x;
    if(document.hidden||!mando.foco)return;
    if(pulsado)ponerPausa(!pausa.activa);else if(pausa.activa&&confirma)ponerPausa(false);}
  function configurarIA(modo){
    const ia=window.CAOZ_ARPG_IA;if(modo!==ia.modo()){ia.configurar(modo);for(const e of enemigos){e.ia=ia.crear(e);e.plan=null;}}
    $('modoIA').value=ia.modo();
    const u=new URL(location.href);u.searchParams.set('ia',ia.modo());history.replaceState(null,'',u.href);
    for(const a of document.querySelectorAll('.apEtapas a')){const destino=new URL(a.href);destino.searchParams.set('ia',ia.modo());a.href=destino.href;}
    return ia.modo();
  }
  $('modoIA').value=window.CAOZ_ARPG_IA.modo();$('modoIA').onchange=()=>configurarIA($('modoIA').value);
  $('modoEquipo').value=COOP?(DOS_MANDOS?'mandos':'mixto'):'solo';
  $('modoEquipo').onchange=()=>{const u=new URL(location.href),v=$('modoEquipo').value;u.searchParams.set('coop',v==='solo'?'0':'1');u.searchParams.set('mandos',v==='mandos'?'2':'1');location.href=u.href;};
  for(const a of document.querySelectorAll('.apEtapas a')){const u=new URL(a.href);u.searchParams.set('ia',window.CAOZ_ARPG_IA.modo());if(COOP){u.searchParams.set('coop','1');u.searchParams.set('mandos',DOS_MANDOS?'2':'1');}a.href=u.href;}
  if(COOP){for(const b of document.querySelectorAll('[data-heroe]'))b.disabled=true;$('demo').hidden=true;}
  $('continuar').onclick=()=>ponerPausa(false);
  $('abrirPausa').onclick=()=>ponerPausa(true);
  $('cerrarDiagnostico').onclick=()=>{$('diagnostico').open=false;$('diagnostico').querySelector('summary').focus();};
  // Preferencia local: ocultar las cifras auxiliares conserva vida, furia y habilidades.
  const controlesStats=document.querySelectorAll('[data-mostrar-stats]');
  function mostrarStats(v){document.documentElement.classList.toggle('apSinStats',!v);for(const c of controlesStats)c.checked=v;}
  let statsVisibles=true;try{statsVisibles=localStorage.getItem('arpg-mostrar-stats')!=='0';}catch{}
  mostrarStats(statsVisibles);
  for(const c of controlesStats)c.onchange=()=>{mostrarStats(c.checked);try{localStorage.setItem('arpg-mostrar-stats',c.checked?'1':'0');}catch{}};
  const botonesPantalla=document.querySelectorAll('[data-pantalla-completa]');
  function rotularPantalla(){const activa=!!document.fullscreenElement;for(const b of botonesPantalla){b.textContent=activa?'Salir de pantalla completa':'Pantalla completa';b.setAttribute('aria-pressed',String(activa));}}
  for(const b of botonesPantalla)b.onclick=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else throw new Error('Pantalla completa no disponible');
      $('estadoPantalla').textContent='';
    }catch{const texto='Este navegador no permitió la pantalla completa. Puedes ampliarlo desde su menú.';$('estadoPantalla').textContent=texto;estado(texto);}
    rotularPantalla();
  };
  document.addEventListener('fullscreenchange',rotularPantalla);

  $('pausa').addEventListener('cancel',e=>{e.preventDefault();ponerPausa(false);});
  const BOTONES_MANDO={0:'esquiva',1:'salto',3:'provocar',4:'parry',5:'torbellino',6:'parry',10:'ulti'};
  function ejeMando(x=0,z=0){const d=Math.hypot(x,z);return d<=.18?new V3():new V3(x,0,z).multiplyScalar(Math.min(1,(d-.18)/.82)/d);}
  function estadoMando(txt){const el=$('estadoMando');if(el&&el.textContent!==txt)el.textContent=txt;}
  function leerMando(){
    if(COOP&&!DOS_MANDOS&&heroe.id===0)return null;
    let lista=[];try{lista=Array.from(navigator.getGamepads?.()||[]);}catch{estadoMando('Mando no disponible en este navegador. Puedes usar teclado y ratón.');return null;}
    const disponibles=lista.filter(g=>g?.connected&&g.mapping==='standard');const g=COOP?(disponibles.find(g=>g.index===mando.indice)||disponibles.find(g=>!jugadores.some(h=>h!==heroe&&h.mando.indice===g.index))):(disponibles.find(g=>g.index===mando.indice)||disponibles[0]);
    if(!g){mando.indice=null;mando.botones=[];mando.activo=false;mando.listo=false;estadoMando(lista.some(g=>g?.connected)?'El navegador no reconoce la distribución de este mando. Prueba otro navegador.':'PS5: conecta el DualSense por USB o Bluetooth y pulsa un botón.');return null;}
    if(mando.indice!==g.index){mando.indice=g.index;mando.botones=[];mando.listo=false;mando.activo=false;}
    estadoMando('Mando conectado · Izquierdo: mover · Derecho: apuntar · Options: pausa · R2 / □: mantener y soltar para cargar · ×: dash · ○: salto · L1 / L2: parry · R1: especial · △: habilidad E · L3: ulti');
    const botones=g.buttons.map(b=>b.pressed||b.value>.5),mov=ejeMando(g.axes[0],g.axes[1]),mira=ejeMando(g.axes[2],g.axes[3]);
    const pulsado=botones.some(Boolean),actividad=pulsado||mov.lengthSq()>0||mira.lengthSq()>0;
    // Al conectar o volver a la ventana, soltar primero evita ataques involuntarios.
    if(document.hidden||!mando.foco||!mando.listo){mando.botones=botones;mando.activo=false;mando.listo=!document.hidden&&mando.foco&&!actividad;return null;}
    const nuevos=botones.map((v,i)=>v&&!mando.botones[i]);mando.botones=botones;
    if(actividad){clima.desbloquearAudio(true);mando.activo=true;ent.piloto=false;ent.atacando=ent.pendiente=false;}
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
  addEventListener('focus',()=>{for(const h of jugadores)h.mando.foco=true;});
  addEventListener('blur',()=>{for(const h of jugadores){h.mando.foco=false;h.mando.listo=false;h.mando.activo=false;}});
  addEventListener('keydown',()=>{mando.activo=false;});
  esc.addEventListener('pointerdown',()=>{mando.activo=false;});
  esc.addEventListener('pointermove',()=>{mando.activo=false;});
  function movTeclado(){const v=new V3();for(const k of teclas){const d=DIRS[k];if(d){v.x+=d[0];v.z+=d[1];}}return v.lengthSq()?v.normalize():v;}
  function apuntar(cx,cy){const b=esc.getBoundingClientRect();puntero.set((cx-b.left)/b.width*2-1,-(cy-b.top)/b.height*2+1);}
  function bajo(incluirBotin=false){escena.updateMatrixWorld(true);ray.setFromCamera(puntero,camara);const cajas=[...enemigos.filter(e=>e.estado!=='muere').map(e=>e.m.caja),...(incluirBotin?botines.filter(b=>b.listo&&!b.recogida&&!b.volando).map(b=>b.caja):[])];
    const hit=ray.intersectObjects(cajas,false)[0];ray.ray.intersectPlane(planoSuelo,ent.suelo);return hit?(hit.object.userData.enemigo||hit.object.userData.botin):null;}
  lienzo.addEventListener('contextmenu',e=>e.preventDefault());
  lienzo.addEventListener('pointerdown',e=>{apuntar(e.clientX,e.clientY);camara.updateMatrixWorld();const s=bajo(e.pointerType==='touch');
    if(e.pointerType==='touch'){activarTactil();if(s?.bono){ent.lectura=s;ent.lecturaHasta=reloj.t+2.5;}return;}// en táctil, tocar una carta la lee; se recoge pasando por encima
    ent.piloto=false;ent.dentro=true;lienzo.setPointerCapture?.(e.pointerId);
    if(e.button===2)usar('salto',ent.suelo.clone());else if(e.button===0)ent.atacando=ent.pendiente=true;});
  lienzo.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;apuntar(e.clientX,e.clientY);ent.dentro=true;});
  function soltarBasico(cancelar=false){const sostenido=ent.atacando;ent.atacando=false;
    if(heroe.estado==='carga'){ent.pendiente=false;if(cancelar&&sostenido){heroe.carga=0;heroe.bloqueoBasico=true;cambiar(heroe,'quieto');}}
    else if(cancelar)ent.pendiente=false;
  }
  const soltarPuntero=e=>{if(e.button===0||e.type==='pointercancel')soltarBasico(e.type==='pointercancel');};
  lienzo.addEventListener('pointerup',soltarPuntero);lienzo.addEventListener('pointercancel',soltarPuntero);
  lienzo.addEventListener('lostpointercapture',()=>{if(ent.atacando)soltarBasico(true);});
  // La liberación también llega al salir del lienzo; una captura perdida no deja el básico pegado.
  addEventListener('pointerup',soltarPuntero);addEventListener('pointercancel',soltarPuntero);
  addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!(e.buttons&1)&&ent.atacando)soltarBasico();});
  lienzo.addEventListener('pointerleave',()=>{ent.dentro=false;});
  addEventListener('keydown',e=>{const k=e.code;if(k==='KeyM'&&ABIERTO){e.preventDefault();if(!e.repeat){exploracion.grande=!exploracion.grande;$('mapaPanel').classList.toggle('ampliado',exploracion.grande);pintarMapa();}return;}if(k==='Escape'){e.preventDefault();if(!e.repeat)ponerPausa(!pausa.activa);return;}if(pausa.activa||rog.abierto||e.target.closest?.('input,textarea,select,summary,button,a'))return;
    if(DIRS[k]){e.preventDefault();teclas.add(k);ent.piloto=false;return;}
    const h=ACCION[k];if(h){e.preventDefault();if(e.repeat)return;ent.piloto=false;usar(h,h==='salto'?puntoApuntado():null);}});
  addEventListener('keyup',e=>{teclas.delete(e.code);});addEventListener('blur',()=>{teclas.clear();ent.atacando=false;});
  // Botones del HUD (y de táctil): Atacar se mantiene pulsado; los demás lanzan su habilidad.
  for(const b of document.querySelectorAll('[data-hab]')){
    b.addEventListener('pointerdown',e=>{const h=b.dataset.hab;mando.activo=false;e.preventDefault();e.stopPropagation();ent.piloto=false;if(e.pointerType==='touch')activarTactil();if(h==='tajo'){ent.atacando=ent.pendiente=true;b.setPointerCapture?.(e.pointerId);return;}usar(h,h==='salto'?puntoApuntado():null);});
    if(b.dataset.hab==='tajo')for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>{if(t==='lostpointercapture'){if(ent.atacando)soltarBasico(true);}else soltarBasico(t==='pointercancel');});}
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
    if(COOP&&(heroe.id===1||DOS_MANDOS)){ctl.mov.set(0,0,0);ctl.atacar=false;ctl.apunta=heroe.pos.clone().addScaledVector(frente(heroe.dir),7);return;}
    ctl.mov.copy(ent.palanca||movTeclado());ctl.atacar=ent.atacando||(heroe.estado!=='carga'&&ent.pendiente);ctl.apunta=ent.tactil||!(ent.dentro||ent.atacando)?null:ent.sobre?.d?ent.sobre.pos.clone():ent.suelo.clone();}// con el ratón encima de un enemigo se apunta a él

  /* ---- Piloto automático (Demostración): lee los avisos igual que un jugador ----------------- */
  function escape(a,e,p){if(a.zonas){const z=a.zonas.find(z=>enZona(z,e,p,heroe.radio+.45));if(z)return escape(z,e,p);}const o=a.centro||e.pos;if(a.forma==='linea'){const f=frente(a.dir),lado=new V3(-f.z,0,f.x),s=Math.sign(p.clone().sub(o).dot(lado))||1;return lado.multiplyScalar(s);}
    const v=p.clone().sub(o).setY(0);if(a.forma==='cono'){const f=frente(a.dir),l=new V3(-f.z,0,f.x);v.normalize().addScaledVector(l,Math.sign(v.dot(l))||1);}return v.lengthSq()>1e-4?v.normalize():frente(heroe.dir+Math.PI);}
  function piloto(){const h=heroe,c={mov:new V3(),atacar:false,apunta:null};if(!h.vivo)return c;
    const vivos=enemigos.filter(e=>e.estado!=='muere'&&Math.hypot(e.pos.x,e.pos.z)<R+.5);
    // 1. Peligro. Un golpe cuerpo a cuerpo solo: se queda y lo para en el último instante (parry perfecto).
    //    Si vienen varios a la vez, el golpazo imparable de Can o la línea de un kobold: sale de la zona (y hace dash si no da tiempo).
    const peligros=enemigos.filter(e=>e.ataque&&enZona(e.ataque,e,h.pos,h.radio+.45)).map(e=>({e,a:e.ataque,r:e.ataque.dur-(reloj.t-e.ataque.t0)})).sort((x,y)=>x.r-y.r);
    if(peligros.length){const p=peligros[0],juntos=peligros.filter(x=>x.a.forma!=='linea'&&x.r-p.r<.45).length;
      if((p.a.forma==='cono'||p.a.forma==='conos')&&juntos===1&&(h.cd.parry<=0||h.estado==='parry')){if(p.r<=.1&&h.estado!=='parry')usar('parry');return c;}
      const v=escape(p.a,p.e,h.pos);if(p.r<.3&&!h.cd.esquiva)usar('esquiva',v);c.mov.copy(v);return c;}
    // Piedras, goblins y lanzas: parry al llegar. Si no está disponible, apartarse de la caída.
    {const am=amenaza();if(am&&am.t<=.1&&!h.cd.parry&&h.estado!=='parry'){usar('parry');return c;}}
    const piedra=peligrosTroll.find(p=>!p.devuelto&&p.tipo==='roca'&&plano(h.pos,p.hasta)<p.radio+h.radio+.4);
    if(piedra){if(!h.cd.parry||h.estado==='parry')return c;const v=h.pos.clone().sub(piedra.hasta).setY(0);if(v.lengthSq()<.01)v.copy(frente(h.dir+Math.PI/2));v.normalize();if(piedra.dur-piedra.t<.3&&!h.cd.esquiva)usar('esquiva',v);c.mov.copy(v);return c;}
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
    if(!h.bumeran&&!h.cd.bumeran&&cerca(BUMERAN.alcance).length>=2){usar('bumeran',cerca(BUMERAN.alcance)[0].pos);return c;}
    if(!h.bumeran&&h.furia>=30&&cerca(3).length>=3){usar('torbellino');return c;}
    if(!h.cd.salto&&h.furia>=55){let mejor=null,n=1;for(const e of vivos){const d=plano(e.pos,h.pos);if(d<3.5||d>8)continue;const k=vivos.filter(o=>plano(o.pos,e.pos)<3).length+(e.d.lanza?1:0);if(k>n){n=k;mejor=e;}}
      if(mejor){usar('salto',mejor.pos.clone());return c;}}
    const lanceros=vivos.filter(e=>e.d.lanza&&plano(e.pos,h.pos)<12),cuerpo=cerca(2.6).filter(e=>!e.d.lanza);
    // Si alguno quedó aturdido por un parry, a por él (recibe el doble).
    const expuestos=vivos.filter(e=>e.expuestoHasta>reloj.t);
    const obj=(expuestos.length?expuestos:lanceros.length&&!cuerpo.length?lanceros:vivos).sort((a,b)=>plano(a.pos,h.pos)-plano(b.pos,h.pos))[0],d=plano(obj.pos,h.pos);
    if(d>1.85+obj.radio)c.mov.copy(obj.pos).sub(h.pos).setY(0).normalize();else{c.atacar=true;c.apunta=obj.pos.clone();}
    return c;}

  /* ---- HUD --------------------------------------------------------------------------- */
  const liquidosHud=window.CAOZ_ARPG_ORBES.crear($('orbeAlma'),$('orbeFuria'));
  const cristalHabilidades=window.CAOZ_ARPG_ORBES.crearHabilidades(document.querySelector('.apHabilidades'));
  let tostadaHasta=0,bannerHasta=0,finMostrado=false;
  function tostada(html,mala=false){const t=$('tostada');t.innerHTML=html;t.classList.toggle('mala',mala);t.classList.add('visto');tostadaHasta=reloj.t+(mala?1.2:2.6);}
  function banner(titulo,texto){const b=$('banner');b.innerHTML=`<b>${titulo}</b><small>${texto}</small>`;b.classList.add('visto');bannerHasta=reloj.t+2.8;}
  function textoHud(el,valor){if(el.textContent!==valor)el.textContent=valor;}
  function hud(dt=0){hudEquipo();const h=heroe;liquidosHud.paso(dt,{alma:h.alma,almaMax:h.almaMax,furia:h.furia,vx:h.velocidad?.x||0,vz:h.velocidad?.z||0});$('orbeAlma').style.setProperty('--lleno',(h.alma/h.almaMax*100).toFixed(1)+'%');textoHud($('almaTxt'),Math.ceil(h.alma)+' / '+h.almaMax);
    const fuego=$('hudFuego');fuego.hidden=!h.incendio;if(h.incendio){const texto='En llamas · '+Math.ceil(h.incendio.restante)+' s · Dash para apagar';if(fuego.textContent!==texto)fuego.textContent=texto;}
    $('orbeFuria').style.setProperty('--lleno',h.furia.toFixed(1)+'%');textoHud($('furiaTxt'),Math.floor(h.furia)+' / 100');
    for(const b of document.querySelectorAll('[data-hab]')){const k=b.dataset.hab,H=HAB[k];if(!H)continue;const cd=h.cd[k]||0,recarga=cd>0?String(Math.ceil(cd)):'';if(b.dataset.recarga!==recarga)b.dataset.recarga=recarga;b.style.setProperty('--cd',(H.cd?cd/(H.cd*(k==='esquiva'?(h.dash??1):1))*100:0).toFixed(1)+'%');b.classList.toggle('sinFuria',h.furia<H.coste);b.classList.toggle('enCurso',k==='torbellino'?girando(h):{salto:'salto',provocar:'grito',bumeran:'lanzarHacha',esquiva:'esquiva',parry:'parry'}[k]===h.estado);}
    const botonAtaque=document.querySelector('[data-hab="tajo"]');if(botonAtaque){botonAtaque.classList.toggle('cargando',h.estado==='carga');botonAtaque.style.setProperty('--carga',`${Math.round(h.carga*100)}%`);const rotulo=botonAtaque.querySelector('small');if(rotulo){const texto=aDistancia()?'Disparar':h.bumeran?'Sin hacha':h.estado==='carga'?`Cargar ${Math.round(h.carga*100)}%`:'Atacar';if(rotulo.textContent!==texto)rotulo.textContent=texto;}}
    const cartas='Cartas del destino · '+rog.mano.length+' / 3';if($('hudCartas').textContent!==cartas)$('hudCartas').textContent=cartas;
    const municion=$('hudMunicion');municion.hidden=!aDistancia();if(aDistancia()){const texto=h.recargaT>0?'Recargando…':'Balas · '+h.balas+' / '+HEROES.mohamed.cargador;if(municion.textContent!==texto)municion.textContent=texto;}
    if(hud.mando!==mando.activo){const teclasHud=mando.activo?['R2','L1','×','○','R1','L3','△']:['Clic izq.','Espacio','Shift','Clic dcho.','Q','R','E'];document.querySelectorAll('.apHabilidades kbd').forEach((el,i)=>el.textContent=teclasHud[i]);hud.mando=mando.activo;}
    const st=(aDistancia()?`<span>Balas <b>${h.recargaT>0?'recargando…':h.balas+' / '+HEROES.mohamed.cargador}</b></span>`:'')+`<span>Parrys perfectos <b>${h.parrys}</b></span><span>Básicos <b>${Math.round(h.atq*(h.basicos??1))}</b></span><span>Cartas <b>${rog.mano.length}/3</b></span><span>Vuelta <b>${rog.vuelta}</b></span><span>Vel. ataque <b>${Math.round(h.vatq*100)}%</b></span><span>Alma <b>${h.almaMax}</b></span><span>Llaves <b>${h.llaves}</b></span>`+(h.escudo>0?'<span class="escudo">Provocar: −50% daño</span>':'');if(st!==hud.st){hud.st=st;$('stats').innerHTML=st;}
    const vivos=enemigos.filter(e=>e.estado!=='muere').length+peligrosTroll.filter(p=>p.tipo==='goblin'&&!p.devuelto).length+enemigos.filter(e=>e.goblinSujeto).length;$('oleada').textContent=ol.auto?(ol.fin?'Tomsage resiste':ol.i<0?'Preparando el asedio…':ol.i===3&&q.get('etapa')==='2'?'Preparando el cobro de piso…':(OLEADAS[ol.i].etapa===2?'Cobro de piso · Fase '+OLEADAS[ol.i].fase+'/3':OLEADAS[ol.i].jefe?'Etapa 1 · Can':'Etapa 1 · Oleada '+(ol.i+1))+' · '+vivos+' en pie'+(ol.cola.length?' · '+ol.cola.length+' por llegar':!vivos&&ol.i<OLEADAS.length-1?' · siguiente oleada en '+Math.ceil(ol.descanso??3)+' s':'')):'Enemigos en pie: '+vivos;
    const mision=ABIERTO?'EXPLORACIÓN · TOMSAGE':ol.i>=4||q.get('etapa')==='2'?'COBRO DE PISO · TOMSAGE':'EL ASEDIO · TOMSAGE';if(hud.mision!==mision){document.querySelector('.apMision>small').textContent=mision;hud.mision=mision;}
    if(ABIERTO)$('oleada').textContent=exploracion.activa?exploracion.activa.nombre+(vivos?' · '+vivos+' enemigos':' · Recoge las tres cartas'):'Exploración · '+exploracion.campamentos.filter(c=>c.limpio).length+'/3 campamentos liberados';
    const o=ent.sobre?.d?ent.sobre:enemigos.includes(h.ultimo)&&h.ultimo.estado!=='muere'?h.ultimo:enemigos.find(e=>e.d.jefe&&e.estado!=='muere')||null;$('objetivo').hidden=!o;if(o){$('objNombre').textContent=o.m.nombre+(o.d.jefe?' · Jefe':'')+(o.fase2?(blindadoTroll(o)?' · Fase 2: haz parry':' · Fase 2: ¡vulnerable!'):'');$('objVida').style.width=(Math.max(0,o.vida)/o.vidaMax*100).toFixed(1)+'%';}
    flechas();golpeDir();
    $('vineta').style.opacity=h.heridaT===undefined?'0':Math.max(0,.9*(1-(reloj.t-h.heridaT)/.45)).toFixed(3);
    if(tostadaHasta&&reloj.t>tostadaHasta){$('tostada').classList.remove('visto');tostadaHasta=0;}if(bannerHasta&&reloj.t>bannerHasta){$('banner').classList.remove('visto');bannerHasta=0;}
    if(jugadores.every(j=>!j.vivo&&j.muerteT>1.3)&&!finMostrado){finMostrado=true;$('fin').hidden=false;$('finTitulo').textContent='Has caído';$('finTexto').textContent='Los goblins celebran en la plaza. Tomsage aún te necesita.';}
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

  /* ---- Ultis: temporizadores propios y asistencia temporal ------------------------- */
  const luzCompanero=COOP?new THREE.PointLight(0xb3dfff,24,12,1.8):null;if(luzCompanero)escena.add(luzCompanero);
  const aliados=[];
  function limpiarAliados(){for(const a of aliados){liberarModeloTroll(a.m);quitarEtiqueta(a.rotulo);}aliados.length=0;}
  function lanzarUlti(){const h=heroe;if(!libre()||h.cd.ulti>0)return false;h.cd.ulti=90;
    if(h.tipo==='adreida'){
      const m=MOD.crear('adreida'),pos=h.pos.clone().addScaledVector(frente(h.dir+1.2),1.5);dentroPlaza(pos,m.radio);escena.add(m.raiz);
      const rotulo=etiqueta('apAliado',pos.clone().setY(2.8));rotulo.el.textContent='Adreidos · 30 s';
      aliados.push({m,pos,radio:m.radio,dentro:true,ruta:null,dueno:h,vida:30,cd:0,t:0,atacando:false,dir:h.dir,fase:0,rotulo});h.ultiT=30;
      marca('onda',pos.x,pos.z,2,0xd5b56a,.45);
    }else{
      h.sigilo=h.ultiT=10;
      if(!h.daga){const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0x5bafff,toneMapped:false});
        const hoja=new THREE.Mesh(new THREE.ConeGeometry(.075,.5,4),mat);hoja.position.y=-.3;hoja.rotation.z=Math.PI;g.add(hoja);
        const guarda=new THREE.Mesh(new THREE.BoxGeometry(.21,.035,.07),mat);guarda.position.y=-.08;g.add(guarda);h.m.H.manoI.add(g);h.daga=g;}
      numero(h.pos.clone().setY(2.4),'Velo azul · 10 s','parry');
    }return true;
  }
  function apunalar(){const h=heroe;if(h.cadT>0)return;h.cadT=.6;h.disparoT=0;h.punalT=.3;
    const e=enemigos.filter(e=>e.estado!=='muere'&&plano(e.pos,h.pos)<1.6+e.radio&&e.pos.clone().sub(h.pos).normalize().dot(frente(h.dir))>.35).sort((a,b)=>plano(a.pos,h.pos)-plano(b.pos,h.pos))[0];
    if(!e)return;const espalda=h.pos.clone().sub(e.pos).setY(0).normalize().dot(frente(e.dir))<-.5;
    danar(e,h.atq*(h.basicos??1)*(espalda?5:1),{crit:false,exacto:true,empuje:.7,causa:espalda?'espalda':'daga'});h.furia=Math.min(100,h.furia+3);
    numero(e.pos.clone().setY(e.m.alto+.65),espalda?'¡Por la espalda! ×5':'Daga','parry');
  }
  function pasoAliados(dt){for(const a of [...aliados]){
    a.vida-=dt;if(a.vida<=0){liberarModeloTroll(a.m);quitarEtiqueta(a.rotulo);aliados.splice(aliados.indexOf(a),1);continue;}
    const obj=enemigos.filter(e=>e.estado!=='muere'&&!e.huida&&plano(e.pos,a.dueno.pos)<14).sort((b,c)=>plano(b.pos,a.pos)-plano(c.pos,a.pos))[0];
    const destino=obj?.pos||a.dueno.pos,dist=plano(a.pos,destino),directo=pasoLibreEnemigo(a.pos,destino,a.radio);let paso=0;a.cd-=dt;
    if(a.atacando){a.t+=dt;if(a.t>=.3&&!a.golpeo){a.golpeo=true;conHeroe(a.dueno,()=>{for(const e of enemigos)if(e.estado!=='muere'&&plano(e.pos,a.pos)<2.2&&pasoLibreEnemigo(a.pos,e.pos,.05))danar(e,a.dueno.atq*(a.dueno.basicos??1),{empuje:2,causa:'adreidos',origen:a.pos});});}if(a.t>=.6)a.atacando=false;}
    else if(dist>(obj?1.7:2)||!directo){
      // Comparte las rutas persistentes y su presupuesto con los enemigos; también al seguir a Adreida.
      const meta=destino.clone();dentroPlaza(meta,a.radio+.06);const p=destinoEnemigo(a,meta),dd=plano(a.pos,p);
      paso=Math.min(5.8*dt,dd,directo?Math.max(0,dist-1.4):Infinity);
      if(paso>1e-5){const antes=a.pos.clone();a.dir+=difAng(a.dir,rumbo(a.pos,p))*Math.min(1,dt*12);a.pos.lerp(p,paso/dd);dentroPlaza(a.pos,a.radio);paso=plano(antes,a.pos);}
    }
    else if(obj&&a.cd<=0){a.atacando=true;a.t=0;a.golpeo=false;a.cd=1.1;a.dir=rumbo(a.pos,obj.pos);}
    a.fase+=paso*TAU/MOD.animacion.longitudZancada(1);MOD.posar(a.m,{anim:a.atacando?'tajoA':paso?'andar':'quieto',k:a.t/.6,t:reloj.t,fase:a.fase,paso:paso?1:0,dt,mezclar:true});
    a.m.raiz.position.copy(a.pos);a.m.raiz.rotation.y=a.dir;a.m.M.u.uBorde.value=.12;a.m.M.u.uColorB.value.setHex(0x80c9bb);
    a.rotulo.pos.copy(a.pos).setY(2.7);a.rotulo.el.textContent='Adreidos · '+Math.ceil(a.vida)+' s';
  }}

  /* ---- Primera región explorable: niebla de mapa compartida y tres campamentos ------ */
  const exploracion={celdas:new Set(),tiempo:0,activa:null,grande:false,campamentos:[
    {nombre:'Bosque del camino norte',x:0,z:-55,tipo:'goblin',n:6},
    {nombre:'La arboleda del este',x:52,z:30,tipo:'saqueador',n:5},
    {nombre:'Cantera del Recaudador',x:-65,z:38,tipo:'troll',n:4}
  ]};
  function reiniciarExploracion(){exploracion.celdas.clear();exploracion.activa=null;for(const c of exploracion.campamentos){c.iniciado=false;c.limpio=false;}if(ABIERTO)ol.auto=false;}
  function descubrirMapa(p){const tam=4;for(let z=Math.floor((p.z+112-13)/tam);z<=Math.ceil((p.z+112+13)/tam);z++)for(let x=Math.floor((p.x+112-13)/tam);x<=Math.ceil((p.x+112+13)/tam);x++){
    if(x>=0&&z>=0&&x<56&&z<56&&Math.hypot(x*tam-110-p.x,z*tam-110-p.z)<14)exploracion.celdas.add(z*56+x);
  }}
  function pasoExploracion(dt){if(!ABIERTO)return;exploracion.tiempo+=dt;
    if(exploracion.tiempo>.15){exploracion.tiempo=0;for(const h of jugadores)if(h.vivo)descubrirMapa(h.pos);pintarMapa();}
    const actual=exploracion.activa;
    if(actual){if(!enemigos.some(e=>e.estado!=='muere')){
      while(rog.emitidas<3)soltarDestino(new V3(actual.x,0,actual.z));
      if(rog.mano.length>=3&&!rog.abierto)abrirDestino();
    }return;}
    const c=exploracion.campamentos.find(c=>!c.iniciado&&jugadores.some(h=>h.vivo&&plano(h.pos,c)<17));if(!c)return;
    c.iniciado=true;exploracion.activa=c;iniciarDestino(exploracion.campamentos.indexOf(c)+1);banner(c.nombre,'Libera el campamento y encuentra sus tres cartas.');
    for(let i=0;i<c.n*FACTOR_COOP;i++){const base=Math.floor(i/FACTOR_COOP),a=i*TAU/(c.n*FACTOR_COOP),e=crearEnemigo(base===0?c.tipo:base%3===0?'kobold':'goblin',c.x+Math.cos(a)*5,c.z+Math.sin(a)*5);e.dentro=true;cambiar(e,'persigue');}
  }
  function pintarMapa(){const canvas=$('mapaExplorado'),g=canvas.getContext('2d'),W=canvas.width,k=W/224;
    g.fillStyle='#10151d';g.fillRect(0,0,W,W);g.save();g.beginPath();for(const i of exploracion.celdas)g.rect(i%56*4*k,Math.floor(i/56)*4*k,4*k+.5,4*k+.5);g.clip();
    g.fillStyle='#344632';g.fillRect(0,0,W,W);const punto=(x,z)=>[(x+112)*k,(z+112)*k];
    g.strokeStyle='#8b8064';g.lineWidth=4;for(const a of CALLES){g.beginPath();g.moveTo(W/2,W/2);g.lineTo(W/2+Math.cos(a)*90*k,W/2+Math.sin(a)*90*k);g.stroke();}
    g.fillStyle='#676055';g.beginPath();g.arc(W/2,W/2,R*k,0,TAU);g.fill();g.strokeStyle='#ccc1a5';g.lineWidth=2;g.stroke();
    g.font='11px sans-serif';g.textAlign='center';g.fillStyle='#fff';
    for(const c of exploracion.campamentos){const [x,z]=punto(c.x,c.z);g.fillStyle=c.limpio?'#8ed89b':'#e89560';g.fillRect(x-4,z-4,8,8);if(exploracion.grande)g.fillText(c.nombre,x,z-10);}
    g.restore();g.fillStyle='#eee3c8';if(exploracion.celdas.has(28*56+28))g.fillText('Tomsage',W/2,W/2+16);g.textAlign='right';g.fillText('N ↑',W-10,18);for(const h of jugadores){const [x,z]=punto(h.pos.x,h.pos.z);g.fillStyle=h.id?'#62c9ff':'#ffd273';g.beginPath();g.arc(x,z,4,0,TAU);g.fill();}
    $('mapaTexto').textContent='Mapa · '+Math.round(exploracion.celdas.size/(56*56)*100)+' % explorado · M';
  }
  function hudEquipo(){const el=$('equipoEstado');el.hidden=!COOP;el.textContent=jugadores.map(h=>`${h.id+1} · ${HEROES[h.tipo].nombre}: ${Math.ceil(h.alma)}/${h.almaMax} Alma · ${Math.floor(h.furia)} Furia · Ulti ${h.cd.ulti>0?Math.ceil(h.cd.ulti)+' s':'lista'}${h.ultiT>0?' (activa '+Math.ceil(h.ultiT)+' s)':''}${!h.vivo?' · Caído':''}`).join('    |    ');
    const b=document.querySelector('[data-hab="ulti"] small');textoHud(b,heroe.cd.ulti>0?`Ulti ${Math.ceil(heroe.cd.ulti)} s`:heroe.tipo==='adreida'?'Adreidos':'Velo azul');
    if(ABIERTO)$('mapaPanel').hidden=false;
  }

  /* ---- Cámara ------------------------------------------------------------------------ */
  const vista={dist:1,temblor:0,tiempoSacudida:0,foco:new V3(0,0,4)};
  function temblar(f){if(!reducido)vista.temblor=Math.max(vista.temblor,f);}
  esc.addEventListener('wheel',e=>{e.preventDefault();vista.dist=Math.max(.65,Math.min(1.45,vista.dist*(e.deltaY>0?1.08:.93)));},{passive:false});
  function pasoCamara(dt,dtReal=dt){const retrato=camara.aspect<.9;const vivos=jugadores.filter(h=>h.vivo),centro=new V3();for(const h of vivos)centro.add(h.pos);centro.divideScalar(vivos.length||1);vista.foco.lerp(vivos.length?centro:heroe.pos,Math.min(1,dt*6));vista.temblor=Math.max(0,vista.temblor*Math.exp(-dtReal*9));
    const separacion=vivos.length>1?plano(vivos[0].pos,vivos[1].pos):0,D=Math.max(21*vista.dist,14+separacion*2.2/Math.min(1,camara.aspect)),el=.92,tr=vista.temblor,t=(vista.tiempoSacudida+=dtReal);
    escena.fog.near=D*.62;escena.fog.far=D*2.65;
    camara.position.set(vista.foco.x+(Math.sin(t*43)+Math.sin(t*71)*.3)*tr*.48,vista.foco.y+Math.sin(el)*D+(Math.cos(t*49)+Math.cos(t*67)*.25)*tr*.35,vista.foco.z+Math.cos(el)*D);camara.lookAt(vista.foco.x,vista.foco.y+.8,vista.foco.z);camara.rotateZ(Math.sin(t*47)*tr*.008);
    actualizarCasasOcultas(dtReal);
    luna.position.set(heroe.pos.x-14,22,heroe.pos.z-12);luna.target.position.copy(heroe.pos);luzHeroe.position.set(heroe.pos.x,5.5+(heroe.alto||0),heroe.pos.z+2.2);}

  function posarHeroe(dt){
    const h=heroe,hm=h.m;hm.raiz.position.set(h.pos.x,h.alto||0,h.pos.z);
    if(girando(h)){h.giro+=dt*17;hm.raiz.rotation.y=h.dir+h.giro;}else{h.giro=0;hm.raiz.rotation.y=h.dir;}
    const ph=poses.heroe||(!aDistancia()&&h.recogeHacha>0&&['quieto','andar'].includes(h.estado)?['recogerHachaA',1-h.recogeHacha/.25]:null)||{lanzarHacha:['lanzarHachaA',h.t/.46],quieto:['quieto'],andar:['andar'],recuperacion:[COMBO[h.combo].anim,.64],carga:[COMBO[h.combo].anim,Math.min(.38,h.t/COMBO[h.combo].dur)],golpe:[COMBO[h.combo].anim,h.t/COMBO[h.combo].dur],esquiva:girando(h)?['torbellino']:['esquiva',h.t/DUR_ESQ],torbellino:['torbellino'],salto:[aDistancia()?'acrobacia':'salto',h.t/.72],abanico:['disparar',h.t/.3],grito:['grito',h.t/.7],parry:['parry',h.t/PARRY.dur],muerta:['muerte',Math.min(1,h.t/1)]}[h.estado];
    MOD.posar(hm,{sinHacha:!!h.bumeran,anim:!h.recogeHacha&&!poses.heroe&&!aDistancia()&&h.paso>.005&&['quieto','andar'].includes(h.estado)?'andar':ph[0],k:ph[1],potencia:!poses.heroe&&['carga','golpe','recuperacion'].includes(h.estado)?h.carga:0,giroCarrera:h.inclinacion||0,t:reloj.t,fase:poses.heroe?ph[1]*TAU:h.fase,paso:poses.heroe?1:h.paso,dt,estado:girando(h)?'torbellino':h.estado,mezclar:!poses.heroe,armaLista:aDistancia()&&!poses.heroe&&['quieto','andar'].includes(h.estado)&&(ctl.atacar||h.disparoT<.45),retroceso:Math.max(0,1-h.disparoT*6)});
    if(h.dolor<1&&['quieto','andar'].includes(h.estado)){hm.H.torso.rotation.x-=.25*(1-h.dolor);}
    // Rojo al recibir; azulado y translúcido mientras es invulnerable (esquiva).
    if(h.destello>0){hm.M.u.uDestello.value=h.destello*.8;hm.M.u.uColorD.value.setRGB(1,.25,.2);}else{hm.M.u.uDestello.value=h.invul>0?.4:0;hm.M.u.uColorD.value.setRGB(.55,.8,1.3);}
    // Adreida se ilumina en oro al parar; el parry perfecto deja una estela breve.
    const oroParry=!aDistancia()&&h.vivo?Math.max(h.estado==='parry'?1:0,h.brilloParry/.3*1.5):0;
    hm.M.u.uBorde.value=(h.incendio?.16+.05*Math.sin(reloj.t*14):0)+oroParry*1.15+(h.estado==='carga'?h.carga*(1+.15*Math.sin(reloj.t*16)):0);hm.M.u.uColorB.value.setRGB(1,h.incendio&&!oroParry&&h.estado!=='carga'?.18:.58,.08);
    if(oroParry>0&&h.destello<=0){hm.M.u.uDestello.value=Math.min(.6,oroParry*.42);hm.M.u.uColorD.value.setRGB(1,.65,.12);}
    h.punalT=Math.max(0,(h.punalT||0)-dt);if(h.sigilo>0){hm.H.brazoI.rotation.x=-1.2-Math.sin((h.punalT/.3)*Math.PI)*.8;hm.H.anteI.rotation.x=-.3;}hm.M.u.uSigilo.value=h.sigilo>0?.78:0;if(h.daga)h.daga.visible=h.sigilo>0;
    for(const m of hm.mallas)m.castShadow=h.sigilo<=0;
    pasoFuegoRopa(h,dt);
  }
  /* ---- Actualización por cuadro ----------------------------------------------------------- */
  let listo=false,simple=false,revisados=0,cuadros=0;const poses={};
  function paso(dt){
    const dtReal=dt;
    leerPausaMando();if(pausa.activa)return false;
    if(rog.abierto){mandoDestino();return false;}
    escena.updateMatrixWorld(true);
    if(paron>0){paron-=dt;dt*=.08;}
    reloj.t+=dt;tiempo.value=reloj.t;F.tiempo.value=reloj.t;CASAS.uniformes.uT.value=reloj.t;
    camara.updateMatrixWorld();ent.sobre=ent.dentro&&!ent.tactil?bajo():null;if(ent.lectura&&reloj.t>ent.lecturaHasta)ent.lectura=null;
    // Las cartas no reaccionan al cursor ni tapan la selección de enemigos; sólo un toque explícito permite leerlas.
    for(const b of botines)b.mirada+=((ent.lectura===b?1:0)-b.mirada)*Math.min(1,dt*20);
    for(const h of jugadores)conHeroe(h,()=>{leerControles();const antes=h.pos.clone();pasoHeroe(dt);respetarMuralla(antes,h.pos,h.radio);h.velocidad??=new V3();const v=h.pos.clone().sub(antes).multiplyScalar(1/Math.max(dt,.001));if(v.length()>VEL)v.setLength(VEL);h.velocidad.lerp(v,1-Math.exp(-dt*8));});
    if(luzCompanero){const j=jugadores[1];luzCompanero.position.set(j.pos.x,4,j.pos.z);luzCompanero.intensity=j.vivo?24:0;}
    const h=heroe;presion.rutas=0;pasoAliados(dt);pasoExploracion(dt);pasoRefuerzosCan();coordinarEnemigos();for(const e of [...enemigos])conHeroe(objetivoEnemigo(e),()=>pasoEnemigo(e,dt));separar();pasoOleadas(dt);pasoPeligrosTroll(dt);pasoLanzas(dt);pasoBalas(dt);pasoGlobos(dt);pasoBotin(dt);pasoMarcas();ambiente(dt);pasoParticulas(dt);pasoEscombros(dt);impactoFX.paso(dtReal);
    for(const h of jugadores)conHeroe(h,()=>{posarHeroe(dt);impactoFX.hacha(h,dt);});pasoBumeranes(dt);
    for(const e of enemigos){const m=e.m;m.raiz.position.set(e.pos.x,0,e.pos.z);m.raiz.rotation.y=e.dir;const d=e.d;
      const aDistanciaEnemigo=d.lanza||e.tiraHacha;
      const ka=e.ataque?Math.min(1,(reloj.t-e.ataque.t0)/e.ataque.dur):1;
      const pe={quieto:['quieto'],entra:['andar'],huye:['huir'],persigue:[e.paso>.05?'andar':'quieto'],aviso:[aDistanciaEnemigo?'apunta':'aviso',ka],golpe:[aDistanciaEnemigo?'lanzar':'golpe',aDistanciaEnemigo?e.t/d.golpe*.6:.38+.24*(e.t/d.golpe)],
        recupera:[aDistanciaEnemigo?'lanzar':'golpe',aDistanciaEnemigo?.6+.4*Math.min(1,e.t/d.recupera):.62+.38*Math.min(1,e.t/d.recupera)],dolor:['dolor',e.t/.28],aturdido:['aturdido'],grito:['grito',e.t/.9],muere:['muerte',Math.min(1,e.t/(e.muerte?.duracion||.6))]}[e.estado];
      if(e.tipo==='troll'&&e.mazazo&&['aviso','golpe','recupera'].includes(e.estado)){pe[0]=e.estado==='aviso'?'cargaMazazo':'mazazo';pe[1]=e.estado==='aviso'?ka:e.estado==='golpe'?.3*e.t/d.golpe:.3+.7*Math.min(1,e.t/d.recupera);}
      if(e.tipo==='troll'&&e.tiraGoblin&&['aviso','golpe','recupera'].includes(e.estado)){pe[0]=e.estado==='aviso'?'preparaGoblin':'arrojaGoblin';pe[1]=e.estado==='aviso'?ka:e.estado==='golpe'?.4*e.t/d.golpe:.4+.6*Math.min(1,e.t/d.recupera);}
      if(e.comboCan&&['aviso','golpe','recupera'].includes(e.estado)){pe[0]=e.comboCan.paso===0?'canCentro':'canLados';pe[1]=e.estado==='aviso'?ka:e.estado==='golpe'?1+.2*Math.min(1,e.t/d.golpe):1.2+.8*Math.min(1,e.t/d.recupera);}
      MOD.posar(m,{anim:pe[0],k:pe[1],t:reloj.t+e.id,fase:e.fase,paso:e.paso,dt,estado:e.estado,mezclar:true,muerte:e.muerte,escudazo:e.escudazo&&['aviso','golpe','recupera'].includes(e.estado)?(e.estado==='aviso'?.25:1):0});
      if(e.golpeVisual&&e.estado!=='muere'){const g=e.golpeVisual;g.t+=dt;const v=Math.sin(Math.min(1,g.t/.22)*Math.PI)*g.potencia;m.H.torso.rotation.x-=v*.24;m.H.cabeza.rotation.x-=v*.12;if(g.t>=.22)e.golpeVisual=null;}
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
    estela.visible=girando(h);estela.position.set(h.pos.x,1.05,h.pos.z);estela.rotation.y=-h.giro;
    luzHeroe.color.setHex(h.escudo>0?0xffc870:0xffd2a0);luzHeroe.intensity=h.vivo?40:18;
    for(const f of fuegos)f.luz.intensity=55+Math.sin(reloj.t*11+f.x)*9+Math.sin(reloj.t*23+f.z)*6;for(const b of braseros)b.luz.intensity=24+Math.sin(reloj.t*13+b.x)*5;
    for(const n of [...numeros]){const s=reloj.t-n.t0;n.e.pos.y=n.y+s*1.4;n.e.el.style.opacity=String(Math.max(0,1-Math.max(0,s-.45)/.5));if(s>.95){quitarEtiqueta(n.e);numeros.splice(numeros.indexOf(n),1);}}
    pasoCamara(dt,dtReal);hemi.intensity=.5+clima.paso(dtReal,vista.foco)*.18;camara.updateMatrixWorld();retirarHuidosFueraDeCamara();lineaMira.visible=puntoMira.visible=false;for(const j of jugadores)if(j.tipo==='mohamed')conHeroe(j,actualizarPunteria);hud(dtReal);
    lienzo.style.cursor=ent.sobre?.d?'crosshair':'default';
    return true;
  }
  const matEstrella=new THREE.MeshBasicMaterial({color:0xffe070,toneMapped:false});
  const aura=new THREE.Mesh(new THREE.SphereGeometry(1.25,24,16),new THREE.ShaderMaterial({uniforms:{uA:{value:0},uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vN,vV;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uA,uT;varying vec3 vN,vV;varying float vY;void main(){float f=pow(clamp(1.-abs(dot(vN,vV)),0.,1.),2.5)*(.7+.3*sin(vY*14.-uT*6.));gl_FragColor=vec4(vec3(1.,.75,.3)*1.6,f*uA*.7);}`}));aura.visible=false;escena.add(aura);
  // El rastro del hachazo: un arco que se dibuja detrás del hacha (del lado donde empieza el tajo) y se desvanece;
  // coincide con la zona que golpea. La estocada deja una estela recta al frente.
  const matRastro=new THREE.ShaderMaterial({uniforms:{uP:{value:0},uA:{value:0},uS:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:'attribute float aK,aR;varying float vK,vR;void main(){vK=aK;vR=aR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uP,uA,uS;varying float vK,vR;void main(){float k=mix(1.-vK,vK,uS);float a=pow(smoothstep(uP-.55,uP,k),2.)*step(k,uP)*smoothstep(.35,.9,vR)*(1.-smoothstep(.93,1.,vR));gl_FragColor=vec4(vec3(1.,.88,.7)*.9,a*uA*.55*.7);}`});
  function geoRastro(forma){const P=[],K=[],Rr=[],I=[],n=28;
    for(let i=0;i<=n;i++){const t=i/n;for(let j=0;j<2;j++){if(forma==='arco'){const f=-1.15+2.3*t,r=j?2.15:1.2;P.push(Math.sin(f)*r,0,Math.cos(f)*r);}else{P.push(j?.09:-.09,0,.6+2.2*t);}K.push(t);Rr.push(forma==='arco'?j:.5+.5*Math.sin(Math.PI*t));}
      if(i<n){const o=i*2;I.push(o,o+1,o+2,o+1,o+3,o+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aK',new THREE.Float32BufferAttribute(K,1));g.setAttribute('aR',new THREE.Float32BufferAttribute(Rr,1));g.setIndex(I);return g;}
  const rastroArco=new THREE.Mesh(geoRastro('arco'),matRastro),rastroRecto=new THREE.Mesh(geoRastro('recto'),matRastro.clone());for(const m of [rastroArco,rastroRecto]){m.visible=false;m.frustumCulled=false;escena.add(m);}
  function rastroCorte(h){rastroArco.visible=rastroRecto.visible=false;if(h.estado!=='golpe'||h.carga>=.5)return;const C=COMBO[h.combo],k=h.t/C.dur,m=h.combo===2?rastroRecto:rastroArco;
    const u=m.material.uniforms;u.uP.value=h.combo===2?tramo(k,.42,.56)*1.5:tramo(k,.38,.64)*1.5;u.uA.value=1-tramo(k,h.combo===2?.6:.64,.9);u.uS.value=h.combo===1?0:1;if(u.uP.value<=0||u.uA.value<=0)return;
    m.visible=true;m.scale.setScalar(1+.3*(h.carga||0));u.uA.value*=1+1.8*(h.carga||0);m.position.set(h.pos.x,.75,h.pos.z);m.rotation.y=h.dir;}
  const estela=new THREE.Mesh(new THREE.RingGeometry(1.1,2.5,48,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:{uT:tiempo},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP;void main(){float a=atan(vP.z,vP.x)/6.2832+.5,r=length(vP.xz);float s=pow(fract(a*2.),3.)*smoothstep(1.1,1.6,r)*(1.-smoothstep(2.1,2.5,r));gl_FragColor=vec4(vec3(1.,.85,.6)*1.8,s*.8*.7);}`}));estela.visible=false;escena.add(estela);

  // Consultas asíncronas: miden trabajo real de GPU, sin readPixels ni esperar al controlador.
  function crearMedidorGPU(gl){
    const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    let pendiente=[],actual=null,turno=0,ms=null;
    function limpiar(){for(const q of pendiente)gl.deleteQuery(q);pendiente=[];ms=null;}
    return {iniciar(){
      if(!ext)return;
      if(gl.getParameter(ext.GPU_DISJOINT_EXT)){limpiar();return;}
      while(pendiente.length&&gl.getQueryParameter(pendiente[0],gl.QUERY_RESULT_AVAILABLE)){
        const q=pendiente.shift(),valor=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);
        if(Number.isFinite(valor)&&valor>=0)ms=ms===null?valor:ms+(valor-ms)*.2;
      }
      if(++turno%20===0&&pendiente.length<4){actual=gl.createQuery();if(actual)gl.beginQuery(ext.TIME_ELAPSED_EXT,actual);}
    },terminar(){if(actual){gl.endQuery(ext.TIME_ELAPSED_EXT);pendiente.push(actual);actual=null;}},leer:()=>ms,
    reiniciar:limpiar};
  }
  const medidorGPU=!CAPTURA&&!laboratorio?crearMedidorGPU(gl):null;
  // Objetivo de 60 FPS: reservar margen para CPU y composición del HUD.
  // Si el navegador presenta a 30 Hz, no se castiga la resolución con una GPU desocupada.
  let escalaRender=1,cuadrosLentos=0,cuadrosRapidos=0;
  function ajustarResolucion(f){if(CAPTURA||laboratorio||document.hidden||pausa.activa)return;
    const gpuMs=medidorGPU?.leer();
    cuadrosLentos=(gpuMs!==null&&gpuMs!==undefined?gpuMs>13:f<56)?cuadrosLentos+1:0;
    cuadrosRapidos=(gpuMs!==null&&gpuMs!==undefined?gpuMs<9:f>58)?cuadrosRapidos+1:0;
    const anterior=escalaRender;
    if(cuadrosLentos>=2){escalaRender=Math.max(.7,escalaRender-.1);cuadrosLentos=0;}
    else if(cuadrosRapidos>=6){escalaRender=Math.min(1,escalaRender+.05);cuadrosRapidos=0;}
    if(Math.abs(anterior-escalaRender)>.001)medir();
  }
  // Cambiar el tamaño borra el lienzo: se difiere hasta justo antes de dibujar.
  // ResizeObserver y la escala adaptativa nunca dejan un cuadro vacío en pantalla.
  let tamanoPendiente=true,ultimoTamano='';
  function medir(){tamanoPendiente=true;}
  function aplicarTamano(){
    if(!tamanoPendiente)return;tamanoPendiente=false;
    const b=esc.getBoundingClientRect(),fija=laboratorio?.resolucion;
    const W=fija?.ancho||Math.max(1,b.width),H=fija?.alto||Math.max(1,b.height);
    // El presupuesto normal admite 1080p nativos; el inspector puede fijar el búfer aunque su vista sea menor.
    const dpr=fija?1:CAPTURA?Math.min(devicePixelRatio||1,2):Math.min(devicePixelRatio||1,1.25,Math.sqrt((1920*1080)/(W*H)))*escalaRender;
    const clave=[W,H,dpr].join('/');if(clave===ultimoTamano)return;ultimoTamano=clave;medidorGPU?.reiniciar();
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);camara.aspect=W/H;camara.fov=W/H<.9?44:32;camara.updateProjectionMatrix();escPuntos.value=H*dpr/900;
  }
  function aplicarEfectos(){renderer.shadowMap.enabled=efectos.sombras;luna.castShadow=efectos.sombras;oclusion.enabled=efectos.oclusion;resplandor.enabled=efectos.resplandor;escena.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true;});}
  for(const c of document.querySelectorAll('[data-efecto]'))c.onchange=()=>{efectos[c.dataset.efecto]=c.checked;aplicarEfectos();};
  {const sel=$('estiloBala');sel.value=estiloBala;sel.onchange=()=>{estiloBala=sel.value;};}
  // Preferencias locales; el audio sólo se desbloquea con un gesto del jugador.
  for(const [id,clave] of [['climaLluvia','activo'],['climaSonido','sonido']]){const c=$(id);try{c.checked=localStorage.getItem('caoz-arpg-'+id)!=='0';}catch{}
    clima.configurar({[clave]:c.checked});c.onchange=()=>{clima.configurar({[clave]:c.checked});if(clave==='activo'&&!c.checked)hemi.intensity=.5;try{localStorage.setItem('caoz-arpg-'+id,c.checked?'1':'0');}catch{}};}
  const activarAudioClima=()=>clima.desbloquearAudio();
  addEventListener('pointerdown',activarAudioClima,{capture:true});addEventListener('keydown',activarAudioClima,{capture:true});
  addEventListener('pagehide',()=>clima.pausar(true));
  $('demo').onclick=()=>{ent.piloto=!ent.piloto;$('demo').setAttribute('aria-pressed',String(ent.piloto));ponerPausa(false);};
  $('reiniciar').onclick=()=>{reiniciar();ponerPausa(false);};
  // Elegir personaje: cambia el héroe y los rótulos de la barra (sus habilidades son otras) y vuelve a empezar.
  // Iconos vectoriales locales: misma silueta en cualquier sistema y sin imágenes adicionales.
  const ICONOS_HUD={
    hacha:'M7 26 23 5M14 8l8 8 5-3-1-8-8-1zM5 24l3 3',
    pistola:'M5 11h22v5H15l-3 10H7l3-11M22 11V8h5v3M16 16v4h4l2-4',
    parry:'M16 3 27 8v8c0 6-6 10-11 13C11 26 5 22 5 16V8zM16 8v16M10 15l6 4 7-8',
    esquiva:'m16 6 10 10-10 10M5 10h9M3 16h12M5 22h9',
    salto:'M16 24V5m-6 6 6-6 6 6M5 24l-2 4h26l-2-4M10 20l-3 3m15-3 3 3',
    backflip:'M6 15a10 10 0 1 1 5 13M6 7v8h8M15 11l6 8-6 3',
    torbellino:'M26 10a12 12 0 1 0 2 10M26 4v6h-6M22 17a6 6 0 1 0-7 6M13 15l4-1 2 3',
    abanico:'M16 28 3 13l6-5 7 20 7-20 6 5zM12 5h8l-4 23z',
    ulti:'M16 2 27 16 16 30 5 16zM16 9l5 7-5 7-5-7zM1 16h4m22 0h4',
    bumeran:'M7 26 23 5M14 8l8 8 5-3-1-8-8-1zM5 18a11 11 0 0 0 20 7m-5-1 5 1 1-5',
    provocar:'m16 3 3 9 9-2-6 7 5 8-10-3-7 7 1-10-8-5 10-2z'
  };
  function rotulos(){const d=aDistancia(),pon=(h,icono,txt)=>{const b=document.querySelector(`[data-hab="${h}"]`);if(!b)return;b.querySelector('span').innerHTML=`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${ICONOS_HUD[icono]}"/></svg>`;b.querySelector('small').textContent=txt;};
    pon('tajo',d?'pistola':'hacha',d?'Disparar':'Atacar');pon('torbellino',d?'abanico':'torbellino',d?'Abanico':'Torbellino');pon('salto',d?'backflip':'salto',d?'Backflip':'Salto');
    pon('parry','parry','Parry');pon('esquiva','esquiva','Dash');pon('ulti','ulti',d?'Sigilo':'Adreidos');const habilidad=document.querySelector('[data-hab="provocar"],[data-hab="bumeran"]');habilidad.dataset.hab=d?'provocar':'bumeran';habilidad.title=d?'Provocar':`Hacha búmeran · ${BUMERAN.alcance} m · Gira para cambiar su regreso`;pon(habilidad.dataset.hab,d?'provocar':'bumeran',d?'Provocar':'Búmeran');
    const r=document.querySelector('.apRetrato');r.src='./art/'+HEROES[tipoHeroe].retrato+'.webp';r.alt=HEROES[tipoHeroe].nombre;
    $('hudNombre').textContent=HEROES[tipoHeroe].nombre;$('hudClase').textContent=d?'Pistolero de las sombras':'Guerrera semiorca';
    for(const b of document.querySelectorAll('[data-heroe]'))b.setAttribute('aria-pressed',String(b.dataset.heroe===tipoHeroe));}
  function elegir(t){if(COOP)return;if(!HEROES[t]||t===tipoHeroe)return;tipoHeroe=t;reiniciar();rotulos();}
  for(const b of document.querySelectorAll('[data-heroe]'))b.onclick=()=>elegir(b.dataset.heroe);
  rotulos();
  function negro(){const px=new Uint8Array(4),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;let s=0;for(let k=0;k<9;k++){gl.readPixels(Math.floor(W*(.2+.3*(k%3))),Math.floor(H*(.2+.3*Math.floor(k/3))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);s+=px[0]+px[1]+px[2];}return s<27;}
  function dibujar(){renderer.info.reset();medidorGPU?.iniciar();
    try{if(simple)renderer.render(escena,camara);else composer.render();}finally{medidorGPU?.terminar();}
    if(!CAPTURA&&revisados<3&&++cuadros>=5+revisados*20){revisados++;if(negro()){if(!simple){simple=true;aviso('El posproceso no funciona en esta tarjeta gráfica ('+gpu+'): se muestra sin él.');}else aviso('La escena sale negra en esta tarjeta gráfica ('+gpu+'). Cuéntanos qué navegador y dispositivo usas.');}}}
  // Algunos navegadores integrados mantienen visibles varias pestañas: sólo la última activada renderiza.
  let partidaActiva=true;
  const canalPartida=!CAPTURA&&typeof BroadcastChannel==='function'?new BroadcastChannel('caoz-arpg-partida'):null;
  function activarPartida(){sincronizarTiempo();partidaActiva=true;$('pausaOtra').hidden=true;canalPartida?.postMessage('activar');}
  if(canalPartida){canalPartida.onmessage=e=>{if(e.data!=='activar')return;sincronizarTiempo();partidaActiva=false;clima.pausar(true);$('pausaOtra').hidden=false;
      ent.atacando=ent.pendiente=false;teclas.clear();mando.listo=false;
      if(heroe?.estado==='carga'){heroe.carga=0;cambiar(heroe,'quieto');}};
    addEventListener('focus',activarPartida);
    addEventListener('pointerdown',()=>{if(!partidaActiva)activarPartida();});
    addEventListener('keydown',()=>{if(!partidaActiva)activarPartida();});
    activarPartida();}
  $('reanudarPartida').onclick=activarPartida;
  document.addEventListener('visibilitychange',()=>{sincronizarTiempo();clima.pausar(document.hidden||!partidaActiva||pausa.activa||rog.abierto);});
  function simularPaso(dt){
    laboratorio?.antes?.(dt);
    if(paso(dt)===false)return false;
    laboratorio?.despuesPaso?.(dt);return true;
  }
  function dibujarCuadro(){
    aplicarTamano();
    // Poses, raíces y cámara pertenecen al mismo cuadro; no se sustituyen al dibujar.
    escena.updateMatrixWorld(true);camara.updateMatrixWorld(true);
    for(const e of etiquetas)colocar(e);dibujar();
  }
  let antes=performance.now(),siguienteDibujo=0,fps={n:0,t:performance.now(),v:0,cpu:0,render:0};
  function cuadro(ahora){
    clima.pausar(document.hidden||!partidaActiva||pausa.activa||rog.abierto||!!laboratorio?.detenido);
    if(document.hidden||!partidaActiva){sincronizarTiempo();antes=ahora;siguienteDibujo=0;fps.n=0;fps.t=ahora;requestAnimationFrame(cuadro);return;}
    leerPausaMando();
    if(pausa.activa){sincronizarTiempo();antes=ahora;fps.n=0;fps.t=ahora;requestAnimationFrame(cuadro);return;}
    const limite=laboratorio?.limite||0;
    if(limite&&ahora+.1<siguienteDibujo){requestAnimationFrame(cuadro);return;}
    siguienteDibujo=limite?Math.max(siguienteDibujo+1000/limite,ahora):0;
    const intervalo=ahora-antes;antes=ahora;
    if(intervalo>250){fps.n=0;fps.t=ahora;cuadrosLentos=cuadrosRapidos=0;}
    const inicio=performance.now();let avance={pasos:0,avance:0,descartado:0};
    if(rog.abierto){sincronizarTiempo();mandoDestino();}
    else if(laboratorio?.detenido)sincronizarTiempo();
    else avance=laboratorio?.fijo?temporizador.avanzar(1/60,simularPaso):temporizador.avanzar(intervalo/1000,simularPaso);
    const preparado=performance.now();
    laboratorio?.preDibujo?.();dibujarCuadro();const finDibujo=performance.now();laboratorio?.postDibujo?.();
    laboratorio?.despues?.({intervalo,simulacion:preparado-inicio,envio:finDibujo-preparado,llamadas:renderer.info.render.calls,triangulos:renderer.info.render.triangles,pasos:avance.pasos,avance:avance.avance,descartado:avance.descartado});
    fps.cpu+=(preparado-inicio-fps.cpu)*.1;fps.render+=(performance.now()-preparado-fps.render)*.1;
    fps.n++;if(ahora-fps.t>=1000){fps.v=Math.round(fps.n*1000/(ahora-fps.t));fps.n=0;fps.t=ahora;ajustarResolucion(fps.v);const i=renderer.info;
      $('info').textContent=`${fps.v} fps · Actualización por cuadro · CPU ${fps.cpu.toFixed(1)} ms / render ${fps.render.toFixed(1)} ms · GPU ${medidorGPU?.leer()?.toFixed(1)??'N/D'} ms · ${gl.drawingBufferWidth} × ${gl.drawingBufferHeight} px internos · ${renderer.getPixelRatio().toFixed(2)}× resolución · ${i.render.calls} llamadas · ${(i.render.triangles/1000).toFixed(0)} mil triángulos · ${hdr?'HDR':'8 bits'} · MSAA ${muestras}× · ${simple?'sin posproceso · ':''}${gpu} · three ${THREE.REVISION}`;}
    requestAnimationFrame(cuadro);
  }

  async function preparar(){
    const suelo=adoquines();Object.assign(matSuelo,suelo);matSuelo.needsUpdate=true;capaQuemada.material.map=quemaduras();capaQuemada.material.needsUpdate=true;
    aplicarMaterialPiso(matSuelo);
    await prepararPruebaPiso();
    crearEquipo();reiniciarExploracion();medir();new ResizeObserver(medir).observe(esc);aplicarEfectos();
    estado('Preparando las cartas del botín…');await CAOZ_CARTA_PINTOR.fuentes();const logo=await imagen('./art/logo.webp');dorso.mat=F.materialDorso(CAOZ_CARTA_PINTOR.dorso(logo));
    estado(ABIERTO?'Mundo abierto · Explora los caminos, descubre el mapa y libera los tres campamentos. R: ulti · M: ampliar mapa.':COOP?'Cooperativo: J1 Adreida, J2 Mohamed. Una carta y un d20 para ambos. Ulti: R / L3.':'Los portones sellados dejan entrar invasores; sus sellos ámbar bloquean tu salida. WASD para moverte, clic izquierdo para atacar hacia el cursor, Espacio para parry, clic derecho para saltar. Q: Torbellino / Abanico. E: Búmeran / Provocar.');
    listo=true;simularPaso(1/60);sincronizarTiempo();if(!CAPTURA)requestAnimationFrame(cuadro);else dibujarCuadro();
  }

  // Revisión: fps define la duración de cada actualización, igual que los cuadros de la partida.
  const aPantalla=p=>{camara.updateMatrixWorld(true);const v=p.clone().project(camara),b=esc.getBoundingClientRect();return {x:b.left+(v.x*.5+.5)*b.width,y:b.top+(.5-v.y*.5)*b.height,dentro:Math.abs(v.x)<1&&Math.abs(v.y)<1};};
  const resumen=e=>({ia:e.ia?{accion:e.ia.accion,decisiones:e.ia.decisiones}:null,borde:+e.m.M.u.uBorde.value.toFixed(2),ataque:e.ataque?{forma:e.ataque.forma,k:+Math.min(1,(reloj.t-e.ataque.t0)/e.ataque.dur).toFixed(2),fijado:e.ataque.fijado}:null,id:e.id,tipo:e.tipo,x:+e.pos.x.toFixed(2),z:+e.pos.z.toFixed(2),vida:e.vida,vidaMax:e.vidaMax,estado:e.estado,muerte:e.muerte?{causa:e.muerte.tipo,variante:e.muerte.variante,duracion:e.muerte.duracion}:null,fase2:!!e.fase2,blindado:!!blindadoTroll(e),parryHasta:e.parryHasta||0,disuelve:+e.m.M.u.uDisuelve.value.toFixed(2),expuesto:e.expuestoHasta>reloj.t});
  window.CAOZ_ARPG_THREE_REVISION=Object.freeze({
    ia(modo){if(modo!==undefined)configurarIA(modo);return {modo:window.CAOZ_ARPG_IA.modo(),goblins:enemigos.filter(e=>e.ia&&e.estado!=='muere').map(e=>({id:e.id,variante:e.m.varianteGoblin,accion:e.ia.accion,decisiones:e.ia.decisiones}))};},
    impactos:()=>impactoFX.estado(),
    clima:()=>clima.estado(),
    orbes:()=>liquidosHud.estado(),
    cristalHabilidades:()=>cristalHabilidades.estado(),
    cristal:v=>window.CAOZ_ARPG_ORBES.configurarRefraccion(v),
    bumeranes:()=>bumeranes.map(b=>({dueno:b.h.id,fase:b.fase,x:b.g.position.x,y:b.g.position.y,z:b.g.position.z,distancia:b.distancia})),
    equipo:()=>jugadores.map(h=>({id:h.id,tipo:h.tipo,x:h.pos.x,z:h.pos.z,alma:h.alma,estado:h.estado,cd:{...h.cd},sigilo:h.sigilo,fuego:h.incendio?.restante||0,ultiT:h.ultiT,basicos:h.basicos,disparos:h.disparos})),
    aliados:()=>aliados.map(a=>({vida:a.vida,x:a.pos.x,z:a.pos.z})),
    exploracion:()=>({descubiertas:exploracion.celdas.size,activa:exploracion.activa?.nombre,campamentos:exploracion.campamentos.map(c=>({...c}))}),
    jugador(i,accion,p){const h=jugadores[i];if(!h)return;return conHeroe(h,()=>{if(accion==='control'){ent.rev=p?{mov:new V3(p.mov?.[0]||0,0,p.mov?.[1]||0),atacar:!!p.atacar,apunta:p.apunta?new V3(p.apunta[0],0,p.apunta[1]):null}:null;return;}if(accion==='posicion'){h.pos.set(p.x,0,p.z);if(p.dir!==undefined)h.dir=p.dir;return;}if(accion==='parryPrueba')return parryPerfecto(null,h.pos.clone());return usar(accion);});},
    listo:()=>listo,
    async avanzar(s,fps=30){if(!Number.isFinite(s)||s<0||!Number.isFinite(fps)||fps<10||fps>240)throw Error('Duración o frecuencia inválida');const n=Math.ceil(s*fps);for(let i=0;i<n;i++){temporizador.avanzar(Math.min(1/fps,s-i/fps),simularPaso);if(i%3===2)await new Promise(r=>setTimeout(r,0));}dibujarCuadro();return this.estado();},
    dibujar(){dibujarCuadro();const i=renderer.info.render;return {llamadas:i.calls,triangulos:i.triangles};},
    estado:()=>({tiempo:temporizador.estado(),pausa:pausa.activa,destino:{vuelta:rog.vuelta,nivel:rog.nivel,cartas:rog.mano.length,emitidas:rog.emitidas,abierto:rog.abierto,resuelto:rog.resuelto,efectos:rog.efectos.map(e=>({...e}))},peligrosTroll:peligrosTroll.map(p=>({tipo:p.tipo,k:p.t/p.dur,x:p.hasta.x,z:p.hasta.z,alto:p.m.position.y,devuelto:p.devuelto})),listo,webgl2:true,hdr,muestras,simple,version:THREE.REVISION,pases:[['render',pasoRender],['oclusion',oclusion],['saneado',saneado],['resplandor',resplandor],['salida',salida]].filter(([,p])=>p.enabled).map(([n])=>n),
      heroe:{fuego:heroe.incendio?.restante||0,carga:heroe.carga,acortarSalto:heroe.acortarSalto,t:+heroe.t.toFixed(3),vatq:+heroe.vatq.toFixed(2),punta:(()=>{const p=heroe.m.M.punta.getWorldPosition(new V3());return [+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)];})(),combo:heroe.combo,invul:+heroe.invul.toFixed(2),parrys:heroe.parrys,tipo:heroe.tipo,balas:heroe.balas,recarga:+heroe.recargaT.toFixed(2),disparos:heroe.disparos,bloqueos:heroe.bloqueos,esquivados:heroe.esquivados||0,golpeDe:heroe.golpeDe?.id??null,x:+heroe.pos.x.toFixed(2),z:+heroe.pos.z.toFixed(2),alto:+(heroe.alto||0).toFixed(2),alma:heroe.alma,almaMax:heroe.almaMax,furia:+heroe.furia.toFixed(1),atq:heroe.atq,estado:heroe.estado,vivo:heroe.vivo,escudo:+heroe.escudo.toFixed(2),cd:{...heroe.cd},llaves:heroe.llaves,botin:heroe.botin.map(b=>b.id+'/'+b.ed),dir:+heroe.dir.toFixed(3)},
      enemigos:enemigos.map(resumen),botines:botines.map(b=>({id:b.id,ed:b.ed,listo:b.listo,volando:b.volando,x:+b.pos.x.toFixed(2),z:+b.pos.z.toFixed(2),mirada:+b.mirada.toFixed(2),escala:b.g?+(b.g.scale.x/SB).toFixed(2):0,nombre:b.nombre?.el.textContent||''})),
      globos:globos.length,alertas:etiquetas.filter(x=>x.el.classList.contains('apAlerta')&&!x.el.hidden).length,flechas:flechasEl.filter(f=>!f.hidden&&f.parentNode).length,golpeDir:+$('golpeDir').style.opacity||0,hachas:lanzas.filter(l=>l.tipo==='hacha'&&!l.clavada).length,lanzas:lanzas.filter(l=>!l.clavada).length,lanzaAhora:lanzas.some(l=>l.ahora&&!l.clavada),balas:balas.length,marcas:marcas.filter(o=>!o.fijo).map(o=>o.tipo),oleada:ol.i,fin:ol.fin,finVisible:!$('fin').hidden,finTitulo:$('finTitulo').textContent,
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
  // Puente exclusivo del inspector. No carga paneles ni recoge muestras en una partida normal.
  if(laboratorio){
    ol.auto=false;
    const originales={heroes:structuredClone(HEROES),enemigos:structuredClone(DEF)};
    window.CAOZ_ARPG_LAB={
      listo:()=>listo,
      revision:window.CAOZ_ARPG_THREE_REVISION,
      detener(v){laboratorio.detenido=!!v;sincronizarTiempo();},
      paso(){if(listo&&laboratorio.detenido&&!pausa.activa){temporizador.avanzar(1/60,simularPaso);dibujarCuadro();}},
      observar(fn){laboratorio.despues=fn;},
      temporizador(antes,despues){laboratorio.preDibujo=antes;laboratorio.postDibujo=despues;return gl;},
      pasoFijo(v){laboratorio.fijo=!!v;sincronizarTiempo();},
      frecuencia(v){if(![0,30,60,120].includes(v))throw Error('Frecuencia de render inválida');laboratorio.limite=v;sincronizarTiempo();siguienteDibujo=0;antes=performance.now();},
      despuesPaso(fn){laboratorio.despuesPaso=fn;},
      resolucion(fija){laboratorio.resolucion=fija?{ancho:1920,alto:1080}:null;medir();},
      antes(fn){laboratorio.antes=fn;},
      limpiar(tipo='adreida',semillaEscena=11){ponerPausa(false);poses.heroe=null;semilla=semillaEscena;reloj.t=0;paron=0;sigId=1;tipoHeroe=tipo;reiniciar();for(const n of numeros)quitarEtiqueta(n.e);numeros.length=0;pVida.fill(0);pCol.fill(0);rotulos();ol.auto=false;ent.rev={mov:new V3(),atacar:false,apunta:new V3(0,0,0)};heroe.furia=100;for(const h of jugadores)h.entrada.rev={mov:new V3(),atacar:false,apunta:new V3(0,0,0)};vista.temblor=0;vista.foco.copy(heroe.pos);pasoCamara(1);camara.updateMatrixWorld();},
      configurar(p){
        for(const [k,min,max] of [['dano',1,100],['velAtaque',.25,3]])if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error('Parámetro fuera de rango: '+k);
        heroe.atq=heroe.atqBase=p.dano;heroe.vatq=p.velAtaque;
      },
      invocar(tipo,n,p){if(!Object.hasOwn(DEF,tipo)||!Number.isInteger(n)||n<1||n>24)throw Error('Grupo inválido');
        for(const [k,min,max] of [['vida',1,3000],['vel',0,8],['dano',0,100]])if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error('Parámetro fuera de rango: '+k);
        for(let i=0;i<n;i++){const a=i*TAU/n,radio=p.quieto?Math.max(1.7,Math.sqrt(n)*.9):7,e=crearEnemigo(tipo,heroe.pos.x+Math.sin(a)*radio,heroe.pos.z-Math.cos(a)*radio,{quieto:p.quieto,varianteGoblin:p.varianteGoblin});Object.assign(e.d,{vida:p.vida,vel:p.vel,dano:p.dano});e.vida=e.vidaMax=p.vida;e.dentro=true;if(!p.quieto)cambiar(e,'persigue');}
      },
      derrotarCan(){const can=enemigos.find(e=>e.tipo==='can'&&e.estado!=='muere');if(!can)return false;can.sinBotin=true;morir(can);return true;},
      prepararAccion(){poses.heroe=null;for(const k of Object.keys(heroe.cd))heroe.cd[k]=0;heroe.furia=100;heroe.carga=0;heroe.bloqueoBasico=false;cambiar(heroe,'quieto');ent.pendiente=false;},
      proteger(){for(const h of jugadores){h.alma=h.almaMax;h.invul=1;h.mando.foco=h.mando.activo=h.mando.listo=false;}},
      restaurarEntrada(){for(const h of jugadores){h.mando.foco=document.hasFocus();h.mando.listo=false;}},
      entorno(){const b=esc.getBoundingClientRect();return {ancho:Math.round(b.width),alto:Math.round(b.height),anchoRender:gl.drawingBufferWidth,altoRender:gl.drawingBufferHeight,resolucionFija:!!laboratorio.resolucion,dpr:renderer.getPixelRatio(),gpu,three:THREE.REVISION,efectos:{...efectos},refraccionHud:window.CAOZ_ARPG_ORBES.configurarRefraccion(),hdr,muestras,coop:COOP,ia:window.CAOZ_ARPG_IA.modo(),animacion:MOD.animacion.configuracion(),simulacionHz:null,reloj:laboratorio.fijo?'referencia-por-cuadro':'tiempo-real',limiteRender:laboratorio.limite||0,optimizacion:q.get('referencia')==='1'?'referencia':'actual'};},
      animacion:{leer:MOD.animacion.configuracion,aplicar:MOD.animacion.configurar,restablecer:MOD.animacion.restablecer},
      valores:()=>structuredClone(originales)
    };
  }
  preparar().catch(e=>aviso('No se pudo preparar la plaza: '+e.message));
})();

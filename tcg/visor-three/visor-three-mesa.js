/* El Mago del Domo en three.js (visor-three-vendor.js, three 0.186.1): la carta
   del visor con lo mejor que ofrece el motor, para compararlo con nuestro visor
   propio en WebGL. Las texturas son las de siempre (carta-pintor.js: color,
   relieve, metal/rugosidad y máscara holográfica); aquí las usa el material
   físico de three.js:
     · MeshPhysicalMaterial: relieve (normal map), metal y rugosidad por zona,
       laca (clearcoat) y la película holográfica como iridiscencia de capa
       fina (iridescenceMap = la máscara); destellos inyectados en su shader;
     · canto de oro cepillado (anisotropía) y dorso con el logo en relieve;
     · reflejos de un estudio con cajas de luz (PMREM), sombras suaves de dos
       focos, haces de luz con polvo, suelo espejo (Reflector) y un pedestal de
       terciopelo (sheen); una luz que sigue al puntero (raycasting);
     · posproceso HDR con MSAA 4×: profundidad de campo, resplandor y AgX.
   «Invocar» lanza un estallido de partículas de oro en la GPU. Cada efecto se
   puede apagar para ver qué aporta y cuánto cuesta. ?captura=1 deja sólo el
   escenario y la revisión dibuja fotogramas a tiempos fijos. */
'use strict';
(function(){
  const {THREE,EffectComposer,RenderPass,UnrealBloomPass,BokehPass,OutputPass,Reflector}=window.CAOZ_THREE;
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),CAPTURA=q.get('captura')==='1',ID='magodomo';
  if(CAPTURA)document.documentElement.dataset.captura='';
  const {ALTO,EDICION}=CAOZ_THREE_CARTA,CENTRO=2.45;
  const efectos={iridiscencia:true,laca:true,sombras:true,espejo:true,haces:true,resplandor:true,enfoque:true};
  const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const estado=t=>{$('estado').textContent=t;};
  // Cualquier fallo se ve en la página (no un lienzo negro sin explicación).
  const aviso=t=>{estado(t);$('info').textContent=t;};
  addEventListener('error',e=>aviso('Error: '+(e.message||e.error)));
  addEventListener('unhandledrejection',e=>aviso('Error: '+(e.reason?.message||e.reason)));
  if(!document.createElement('canvas').getContext('webgl2')){aviso('Este navegador no tiene WebGL 2, que three.js necesita. Prueba con Chrome, Edge, Firefox o Safari actualizados.');return;}

  /* ---- Motor, escena y cámara ------------------------------------------------ */
  const lienzo=$('lienzo'),esc=$('escenario');
  const renderer=new THREE.WebGLRenderer({canvas:lienzo,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  // Las cifras de rendimiento suman todos los pases de un fotograma (se ponen a cero en cada uno).
  renderer.info.autoReset=false;
  const escena=new THREE.Scene();escena.background=new THREE.Color(0x06050a);escena.fog=new THREE.FogExp2(0x06050a,.045);
  // El entorno de los reflejos: un estudio oscuro con cajas de luz (una cálida arriba, una tira fría a
  // un lado y un punto delante), preconvolucionado (PMREM) para los reflejos del metal, la laca y el suelo.
  function estudio(){const e=new THREE.Scene();e.background=new THREE.Color(0x050407);
    const caja=(w,h,color,fuerza,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(fuerza),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);e.add(m);};
    caja(6,3,0xffe0b0,6,[-4,6,4]);caja(1.2,8,0xa8c0ff,4,[7,1,-2]);caja(3,2.4,0xfff4e0,5,[1.5,1.5,8]);caja(10,.6,0xffc890,1.2,[0,-3,-8]);
    return e;}
  const pmrem=new THREE.PMREMGenerator(renderer);escena.environment=pmrem.fromScene(estudio(),.03).texture;escena.environmentIntensity=.9;
  const camara=new THREE.PerspectiveCamera(30,1,.1,80);camara.position.set(0,2.6,9.5);const mira=new THREE.Vector3(0,2.15,0);camara.lookAt(mira);

  /* ---- La carta (three-carta.js): cara física, dorso y canto ----------------- */
  const F=CAOZ_THREE_CARTA.fabrica(THREE,renderer),tiempo=F.tiempo,tex=F.tex;
  const matCara=F.materialCara(null,'dorado'),matDorso=F.materialDorso(),matCanto=F.materialCanto('dorado');
  const carta=new THREE.Group(),giro=F.carta(matCara,matDorso,matCanto);carta.add(giro);carta.position.set(0,CENTRO,0);escena.add(carta);
  const frente=giro.userData.frente;

  /* ---- La sala: suelo espejo de mármol negro, pedestal de terciopelo -------- */
  function marmol(){const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');g.fillStyle='#0c0b10';g.fillRect(0,0,1024,1024);
    let s=11;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
    for(let i=0;i<46;i++){g.strokeStyle=`rgba(${190+rnd()*40},${170+rnd()*40},${140+rnd()*30},${.04+rnd()*.1})`;g.lineWidth=.6+rnd()*2.4;g.beginPath();let x=rnd()*1024,y=rnd()*1024;g.moveTo(x,y);
      for(let k=0;k<22;k++){x+=(rnd()-.45)*70;y+=(rnd()-.5)*70;g.lineTo(x,y);}g.stroke();}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;}
  const espejo=new Reflector(new THREE.PlaneGeometry(40,40),{textureWidth:1024,textureHeight:1024,color:0x80808a,clipBias:.003});espejo.rotation.x=-Math.PI/2;escena.add(espejo);
  const suelo=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({map:marmol(),roughness:.22,metalness:0,transparent:true,opacity:.6}));suelo.rotation.x=-Math.PI/2;suelo.position.y=.002;suelo.receiveShadow=true;escena.add(suelo);
  const terciopelo=new THREE.MeshPhysicalMaterial({color:0x24060e,roughness:.9,envMapIntensity:.25,sheen:.8,sheenColor:new THREE.Color(0xb8475e),sheenRoughness:.5});
  const oro=new THREE.MeshPhysicalMaterial({color:0xffcf73,metalness:1,roughness:.22,clearcoat:.4});
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.3,.5,96),terciopelo);pedestal.position.y=.25;pedestal.castShadow=pedestal.receiveShadow=true;escena.add(pedestal);
  for(const [y,rr] of [[.5,1.15],[.02,1.3]]){const a=new THREE.Mesh(new THREE.TorusGeometry(rr,.035,16,128),oro);a.rotation.x=Math.PI/2;a.position.y=y;a.castShadow=true;escena.add(a);}

  /* ---- Luces: foco cálido, contraluz frío, cielo y la linterna del puntero -- */
  escena.add(new THREE.HemisphereLight(0x8c9ac8,0x1a1008,.18));
  const foco=(color,intensidad,pos,sombra)=>{const l=new THREE.SpotLight(color,intensidad,0,.25,.55,2);l.position.set(...pos);l.target.position.set(0,CENTRO-.4,0);escena.add(l,l.target);
    if(sombra){l.castShadow=true;l.shadow.mapSize.set(2048,2048);l.shadow.bias=-.0004;l.shadow.normalBias=.02;l.shadow.radius=5;l.shadow.blurSamples=16;l.shadow.camera.near=2;l.shadow.camera.far=20;}return l;};
  const clave=foco(0xffe1b3,420,[-3.4,7.2,3.6],true),contra=foco(0x9db6ff,200,[3.8,6.4,-3.4],true);
  const linterna=new THREE.PointLight(0xfff0d8,0,4,2);escena.add(linterna);
  // Haces de luz visibles (conos aditivos que se desvanecen por el eje y en los bordes) y el polvo que flota dentro.
  const HAZ_V=`varying vec3 vN;varying vec3 vV;varying float vH;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);vH=uv.y;gl_Position=projectionMatrix*p;}`;
  const HAZ_F=`uniform vec3 uColor;uniform float uFuerza;varying vec3 vN;varying vec3 vV;varying float vH;void main(){float borde=pow(abs(dot(vN,vV)),1.6);gl_FragColor=vec4(uColor*borde*pow(vH,1.3)*uFuerza,1.);}`;
  const haces=new THREE.Group();escena.add(haces);
  for(const l of [clave,contra]){
    const largo=l.position.distanceTo(l.target.position)*1.35,radio=Math.tan(l.angle)*largo;
    const cono=new THREE.Mesh(new THREE.CylinderGeometry(.04,radio,largo,64,1,true),new THREE.ShaderMaterial({vertexShader:HAZ_V,fragmentShader:HAZ_F,uniforms:{uColor:{value:l.color.clone()},uFuerza:{value:.075}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    cono.position.copy(l.position);cono.lookAt(l.target.position);cono.rotateX(-Math.PI/2);cono.translateY(-largo/2);haces.add(cono);
  }
  const POLVO=2600,pp=new Float32Array(POLVO*3),ps=new Float32Array(POLVO);let semilla=3;const rnd=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
  for(let i=0;i<POLVO;i++){const l=i%2?contra:clave,k=Math.pow(rnd(),.7),a=rnd()*Math.PI*2,rr=Math.sqrt(rnd())*Math.tan(l.angle)*k*l.position.distanceTo(l.target.position)*1.2,
      eje=l.target.position.clone().sub(l.position).normalize(),u=new THREE.Vector3(0,1,0).cross(eje).normalize(),v=eje.clone().cross(u),
      p=l.position.clone().addScaledVector(eje,k*l.position.distanceTo(l.target.position)*1.3).addScaledVector(u,Math.cos(a)*rr).addScaledVector(v,Math.sin(a)*rr);pp.set([p.x,p.y,p.z],i*3);ps[i]=rnd();}
  const geoPolvo=new THREE.BufferGeometry();geoPolvo.setAttribute('position',new THREE.BufferAttribute(pp,3));geoPolvo.setAttribute('aSem',new THREE.BufferAttribute(ps,1));
  const polvo=new THREE.Points(geoPolvo,new THREE.ShaderMaterial({uniforms:{uT:tiempo,uEsc:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aSem;uniform float uT,uEsc;varying float vA;void main(){vec3 p=position+vec3(sin(uT*.3+aSem*40.)*.12,sin(uT*.21+aSem*17.)*.18,cos(uT*.25+aSem*29.)*.12);
      vec4 m=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*m;gl_PointSize=(1.5+aSem*2.5)*uEsc/(-m.z)*6.;vA=.35+.65*pow(.5+.5*sin(uT*1.7+aSem*60.),3.);}`,
    fragmentShader:`varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);gl_FragColor=vec4(vec3(1.,.9,.72)*smoothstep(.5,0.,d)*vA*.55,1.);}`}));
  haces.add(polvo);

  /* ---- Invocar: estallido de oro en la GPU y la carta que sube girando ------- */
  const CHISPAS=5000,dir=new Float32Array(CHISPAS*3),vel=new Float32Array(CHISPAS);
  for(let i=0;i<CHISPAS;i++){const a=rnd()*Math.PI*2,z=rnd()*2-1,s=Math.sqrt(1-z*z);dir.set([Math.cos(a)*s,z*.8+.35,Math.sin(a)*s],i*3);vel[i]=1.2+rnd()*3.4;}
  const geoChispas=new THREE.BufferGeometry();geoChispas.setAttribute('position',new THREE.BufferAttribute(new Float32Array(CHISPAS*3),3));geoChispas.setAttribute('aDir',new THREE.BufferAttribute(dir,3));geoChispas.setAttribute('aVel',new THREE.BufferAttribute(vel,1));
  const uEstallido={value:99};
  const chispas=new THREE.Points(geoChispas,new THREE.ShaderMaterial({uniforms:{uE:uEstallido,uEsc:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 aDir;attribute float aVel;uniform float uE,uEsc;varying float vA;varying float vC;void main(){float t=uE;vec3 p=vec3(0.,${CENTRO.toFixed(2)},0.)+aDir*aVel*(1.-exp(-t*2.2))*1.6+vec3(0.,-.9*t*t,0.);
      vec4 m=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*m;vA=clamp(1.-t/2.4,0.,1.)*step(0.,t);vC=aVel/4.6;gl_PointSize=(2.+aVel)*uEsc*vA/(-m.z)*7.;}`,
    fragmentShader:`varying float vA;varying float vC;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(mix(vec3(1.,.62,.2),vec3(1.,.95,.8),vC)*smoothstep(.5,0.,d)*vA*2.4,1.);}`}));
  chispas.frustumCulled=false;escena.add(chispas);
  const anillo=new THREE.Mesh(new THREE.RingGeometry(.9,1,96),new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));anillo.rotation.x=-Math.PI/2;anillo.position.y=.52;escena.add(anillo);

  /* ---- Posproceso HDR: MSAA 4×, profundidad de campo, resplandor y AgX -------- */
  // HDR y MSAA si la tarjeta los admite; si no, el formato de 8 bits y menos (o ninguna) muestra.
  const gl=renderer.getContext(),hdr=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float'),muestras=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
  const depura=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(depura?gl.getParameter(depura.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)).slice(0,60);
  const objetivo=new THREE.WebGLRenderTarget(2,2,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,samples:muestras});
  const composer=new EffectComposer(renderer,objetivo),pasoRender=new RenderPass(escena,camara);
  const enfoque=new BokehPass(escena,camara,{focus:8.5,aperture:.00035,maxblur:.0045});
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.45,.5,.96);
  const salida=new OutputPass();composer.addPass(pasoRender);composer.addPass(enfoque);composer.addPass(resplandor);composer.addPass(salida);

  /* ---- Texturas de la carta ---------------------------------------------------- */
  const imagen=url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});
  let edicion='dorado';const cache={};
  async function cargar(ed){
    edicion=ed;estado('Pintando '+CARDS[ID].n+' · '+{normal:'Normal',foil:'Foil',dorado:'Foil dorado'}[ed]+'…');
    if(!cache[ed]){const a=window.VISOR_THREE_ARTE[ed],img=await imagen('./'+a.url),t=CAOZ_CARTA_PINTOR.texturas({id:ID,acabado:ed,arte:{img,enc:a.enc},ancho:1024});
      cache[ed]=F.texturas(t);}
    F.cambiar(matCara,cache[ed],ed);matCanto.color.setHex(EDICION[ed].canto);aplicarEfectos();
    for(const b of document.querySelectorAll('[data-edicion]'))b.setAttribute('aria-pressed',String(b.dataset.edicion===ed));
    estado('Listo. Arrastra para girar la carta; «Invocar» la hace aparecer.');
  }
  function aplicarEfectos(){
    F.ajustar(matCara,efectos);matDorso.clearcoat=efectos.laca?.6:0;
    renderer.shadowMap.enabled=efectos.sombras;clave.castShadow=contra.castShadow=efectos.sombras;for(const m of [matCara,matDorso,matCanto,suelo.material,terciopelo,oro])m.needsUpdate=true;
    espejo.visible=efectos.espejo;suelo.material.opacity=efectos.espejo?.6:1;haces.visible=efectos.haces;resplandor.enabled=efectos.resplandor;enfoque.enabled=efectos.enfoque;
  }

  /* ---- Pose, arrastre con inercia y la linterna del puntero ------------------- */
  const pose={rx:0,ry:0,vx:0,vy:0,vuelta:0,arrastre:null,invocada:-99};
  const rayo=new THREE.Raycaster(),puntero=new THREE.Vector2(9,9);
  esc.addEventListener('pointerdown',e=>{pose.arrastre={x:e.clientX,y:e.clientY,t:performance.now()};esc.setPointerCapture(e.pointerId);});
  esc.addEventListener('pointermove',e=>{const b=esc.getBoundingClientRect();puntero.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);
    if(pose.arrastre){const dx=e.clientX-pose.arrastre.x,dy=e.clientY-pose.arrastre.y;pose.ry+=dx/170;pose.rx=Math.max(-.7,Math.min(.7,pose.rx+dy/220));pose.vy=dx/170;pose.vx=dy/220;pose.arrastre.x=e.clientX;pose.arrastre.y=e.clientY;}});
  const soltar=()=>{pose.arrastre=null;};esc.addEventListener('pointerup',soltar);esc.addEventListener('pointercancel',soltar);esc.addEventListener('pointerleave',()=>puntero.set(9,9));
  $('voltear').onclick=()=>{pose.vuelta+=Math.PI;};
  $('invocar').onclick=()=>{pose.invocada=reloj;};
  for(const b of document.querySelectorAll('[data-edicion]'))b.onclick=()=>cargar(b.dataset.edicion);
  for(const c of document.querySelectorAll('[data-efecto]'))c.onchange=()=>{efectos[c.dataset.efecto]=c.checked;aplicarEfectos();};
  if(reducido)$('girar').checked=false;

  /* ---- Cada fotograma --------------------------------------------------------- */
  let reloj=0,antes=performance.now(),fps={n:0,t:performance.now(),v:0},vuelta=0;
  function medir(){
    const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,b.width),H=Math.max(1,b.height);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);
    camara.aspect=W/H;camara.fov=W/H<.8?40:30;camara.position.z=W/H<.8?8.9:9.5;camara.lookAt(mira);camara.updateProjectionMatrix();
    const esc2=H*dpr/900;polvo.material.uniforms.uEsc.value=esc2;chispas.material.uniforms.uEsc.value=esc2;
  }
  function paso(t,dt){
    tiempo.value=t;const sola=$('girar').checked&&!pose.arrastre&&!CAPTURA;
    if(!pose.arrastre){pose.ry+=pose.vy;pose.rx+=pose.vx;pose.vy*=.92;pose.vx*=.9;if(sola){pose.ry+=(Math.sin(t*.45)*.55-pose.ry)*.02;pose.rx+=(Math.sin(t*.31)*.15-pose.rx)*.02;}}
    vuelta+=(pose.vuelta-vuelta)*Math.min(1,dt*6);
    // Invocar: la carta sube desde el pedestal girando dos vueltas y estalla en oro.
    const s=t-pose.invocada,k=Math.min(1,Math.max(0,s/1.4)),sube=1-Math.pow(1-k,3);uEstallido.value=s-1.1;
    carta.position.y=CENTRO-(1-sube)*1.7+Math.sin(t*1.1)*.05;const extra=(1-sube)*Math.PI*4;
    giro.rotation.set(pose.rx,pose.ry+vuelta+extra,Math.sin(t*.7)*.012);carta.scale.setScalar(.35+.65*sube);
    anillo.material.opacity=s>1&&s<2.4?(1-(s-1)/1.4)*.9:0;anillo.scale.setScalar(1+Math.max(0,s-1)*2.2);
    resplandor.strength=.45+(s>1&&s<2?(1-(s-1))*1.2:0);
    // La linterna: donde el puntero toca la carta, un poco delante de ella.
    carta.updateMatrixWorld(true);camara.updateMatrixWorld();rayo.setFromCamera(puntero,camara);const toque=rayo.intersectObject(frente,false)[0];
    if(toque){linterna.position.copy(toque.point).addScaledVector(toque.face.normal.clone().transformDirection(frente.matrixWorld),1.1);linterna.intensity+=(2.4-linterna.intensity)*.2;}else linterna.intensity*=.85;
    enfoque.uniforms.focus.value=camara.position.distanceTo(carta.position);
  }
  // Si los primeros fotogramas salen negros (el posproceso falla en esa tarjeta), se dibuja sin él.
  let simple=false,revisados=0,cuadros=0;
  function negro(){const px=new Uint8Array(4),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;let suma=0;
    for(let k=0;k<9;k++){gl.readPixels(Math.floor(W*(.2+.3*(k%3))),Math.floor(H*(.2+.3*Math.floor(k/3))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);suma+=px[0]+px[1]+px[2];}return suma<27;}
  function dibujar(){renderer.info.reset();if(simple)renderer.render(escena,camara);else composer.render();
    if(!CAPTURA&&revisados<3&&++cuadros>=5+revisados*20){revisados++;if(negro()){if(!simple){simple=true;aviso('El posproceso no funciona en esta tarjeta gráfica ('+gpu+'): se muestra sin él.');}else aviso('La escena sale negra en esta tarjeta gráfica ('+gpu+'). Cuéntanos qué navegador y dispositivo usas.');}}}
  function cuadro(ahora){
    const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;reloj+=dt;paso(reloj,dt);dibujar();
    fps.n++;if(ahora-fps.t>=1000){fps.v=Math.round(fps.n*1000/(ahora-fps.t));fps.n=0;fps.t=ahora;const i=renderer.info;
      $('info').textContent=`${fps.v} fps · ${i.render.calls} llamadas de dibujo · ${(i.render.triangles/1000).toFixed(0)} mil triángulos · ${i.memory.textures} texturas · WebGL 2 · ${hdr?'HDR':'8 bits'} · MSAA ${muestras}× · ${simple?'sin posproceso · ':''}${gpu} · three ${THREE.REVISION}`;}
    requestAnimationFrame(cuadro);
  }
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();
    const logo=await imagen('./art/logo.webp'),d=CAOZ_CARTA_PINTOR.dorso(logo);Object.assign(matDorso,{map:tex(d.color,true),normalMap:tex(d.normal)});matDorso.needsUpdate=true;
    medir();new ResizeObserver(medir).observe(esc);
    await cargar(edicion);if(!CAPTURA&&!reducido)pose.invocada=.2;
    if(!CAPTURA)requestAnimationFrame(cuadro);
    // Revisión: dibujar(t,{rx,ry,vuelta,invocada,puntero:[x,y]}) pinta un fotograma a un tiempo fijo.
    window.CAOZ_VISOR_THREE_REVISION=Object.freeze({
      dibujar(t,p={}){Object.assign(pose,{rx:0,ry:0,vx:0,vy:0,vuelta:0,invocada:-99,...p});vuelta=pose.vuelta;if(p.puntero)puntero.set(...p.puntero);else puntero.set(9,9);for(let i=0;i<12;i++)paso(t,1/60);dibujar();
        const i=renderer.info;return {llamadas:i.render.calls,triangulos:i.render.triangles,texturas:i.memory.textures};},
      // Para depurar desde la consola o las pruebas: los objetos de la escena.
      objetos:()=>({THREE,escena,suelo,espejo,renderer,carta,matCara}),
      cargar,edicion:()=>edicion,efecto(k,v){efectos[k]=v;const c=document.querySelector(`[data-efecto="${k}"]`);if(c)c.checked=v;aplicarEfectos();},
      estado:()=>({webgl2:renderer.capabilities.isWebGL2,gpu,simple,version:THREE.REVISION,muestras:objetivo.samples,tipo:objetivo.texture.type===THREE.HalfFloatType?'half':'otro',
        iridiscencia:matCara.iridescence,laca:matCara.clearcoat,pases:[['render',pasoRender],['enfoque',enfoque],['resplandor',resplandor],['salida',salida]].filter(([,p])=>p.enabled).map(([n])=>n),linterna:linterna.intensity}),
      pantalla(x,y,z){const v=new THREE.Vector3(x,y,z).project(camara),b=esc.getBoundingClientRect();return {x:(v.x*.5+.5)*b.width,y:(.5-v.y*.5)*b.height,ancho:b.width,alto:b.height};},
      carta:()=>{const v=carta.position.clone(),b=esc.getBoundingClientRect(),arriba=v.clone().add(new THREE.Vector3(0,ALTO/2*carta.scale.y,0)).project(camara),abajo=v.clone().add(new THREE.Vector3(0,-ALTO/2*carta.scale.y,0)).project(camara);
        return {arriba:(.5-arriba.y*.5)*b.height,abajo:(.5-abajo.y*.5)*b.height,alto:b.height};},
    });
  }
  preparar().catch(e=>aviso('No se pudo preparar el visor: '+e.message));
})();

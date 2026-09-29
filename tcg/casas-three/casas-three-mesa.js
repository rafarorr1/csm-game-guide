/* Muestra de las casas de Tomsage (casas-three.js) en una calle de noche:
   la entramada, la taberna y la cabaña de piedra, con su interior tras las
   ventanas, farolas, humo en las chimeneas y la luna. Cámara orbital (arrastra
   para girar, rueda para acercar) y botones para ir a cada casa, apagar las
   luces de dentro y cambiar la hora. El marcador cuenta triángulos y llamadas.
   ?captura=1 deja sólo el escenario y la revisión avanza a pasos fijos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),CAPTURA=q.get('captura')==='1';
  const estado=t=>{$('estado').textContent=t;},aviso=t=>{estado(t);$('info').textContent=t;};
  addEventListener('error',e=>aviso('Error: '+(e.message||e.error)));
  addEventListener('unhandledrejection',e=>aviso('Error: '+(e.reason?.message||e.reason)));
  if(!document.createElement('canvas').getContext('webgl2')){aviso('Este navegador no tiene WebGL 2, que three.js necesita. Prueba con Chrome, Edge, Firefox o Safari actualizados.');return;}
  if(CAPTURA)document.documentElement.dataset.captura='';
  const {THREE,EffectComposer,RenderPass,GTAOPass,UnrealBloomPass,OutputPass}=window.CAOZ_THREE,V3=THREE.Vector3,TAU=Math.PI*2;
  const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;

  const lienzo=$('lienzo'),esc=$('escenario');
  const renderer=new THREE.WebGLRenderer({canvas:lienzo,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;
  const gl=renderer.getContext(),hdr=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float'),muestras=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
  const depura=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(depura?gl.getParameter(depura.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)).slice(0,60);
  const escena=new THREE.Scene();
  const camara=new THREE.PerspectiveCamera(36,1,.3,300);
  const CASAS=window.CAOZ_CASAS.fabrica(THREE,{renderer});

  // Dos horas: noche (luna azul, las ventanas mandan) y atardecer (sol bajo y cálido, cielo naranja).
  const HORAS={noche:{fondo:0x080a14,niebla:0x0a0c16,hemiA:0x4a5a90,hemiB:0x1a120c,hemi:.45,sol:0x9fb4ff,solI:1.3,solPos:[-18,26,12],env:[[0x5a6aa8,.8],[0x1a1c2a,.5]],expo:1.1},
    atardecer:{fondo:0x3a2a3a,niebla:0x5a4048,hemiA:0xffc8a0,hemiB:0x3a2a20,hemi:.7,sol:0xffb070,solI:2.6,solPos:[-30,9,-10],env:[[0xffa860,1.4],[0x6a5a8a,.9]],expo:1}};
  const hemi=new THREE.HemisphereLight(0xffffff,0x000000,.5),sol=new THREE.DirectionalLight(0xffffff,1);
  sol.castShadow=true;sol.shadow.mapSize.set(2048,2048);sol.shadow.radius=3;sol.shadow.blurSamples=12;sol.shadow.bias=-.0004;sol.shadow.normalBias=.03;Object.assign(sol.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:90});
  escena.add(hemi,sol,sol.target);
  let hora='noche';
  function ponerHora(h){hora=h;const H=HORAS[h];escena.background=new THREE.Color(H.fondo);escena.fog=new THREE.FogExp2(H.niebla,.018);hemi.color.set(H.hemiA);hemi.groundColor.set(H.hemiB);hemi.intensity=H.hemi;
    sol.color.set(H.sol);sol.intensity=H.solI;sol.position.set(...H.solPos);renderer.toneMappingExposure=H.expo;
    const e=new THREE.Scene();e.background=new THREE.Color(H.fondo);const caja=(w,h,c,f,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(f),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);e.add(m);};
    caja(8,8,H.env[0][0],H.env[0][1],[0,9,0]);caja(16,3,H.env[1][0],H.env[1][1],[0,1,-9]);caja(16,3,H.env[1][0],H.env[1][1]*.6,[0,1,9]);
    escena.environment?.dispose?.();escena.environment=new THREE.PMREMGenerator(renderer).fromScene(e,.03).texture;escena.environmentIntensity=.6;
    for(const b of document.querySelectorAll('[data-hora]'))b.setAttribute('aria-pressed',String(b.dataset.hora===h));}

  /* ---- La calle ------------------------------------------------------------------------ */
  // Adoquines con la textura de sillares de las casas, a menor escala; una acera de losas delante de las casas.
  const matSuelo=CASAS.materiales.piedra.clone();matSuelo.vertexColors=false;matSuelo.map=CASAS.materiales.piedra.map.clone();matSuelo.map.repeat.set(26,26);matSuelo.normalMap=CASAS.materiales.piedra.normalMap.clone();matSuelo.normalMap.repeat.set(26,26);matSuelo.color.set(0x8a8580);
  for(const t of [matSuelo.map,matSuelo.normalMap])t.needsUpdate=true;
  const suelo=new THREE.Mesh(new THREE.PlaneGeometry(90,90),matSuelo);suelo.rotation.x=-Math.PI/2;suelo.receiveShadow=true;escena.add(suelo);
  // Las casas, a un lado y al otro de la calle, con variaciones de color.
  const PLAN=[['entramada',-8.5,-6.5,0,{semilla:3,ancho:6,fondo:5}],['taberna',0,-7,0,{semilla:7}],['piedra',8.5,-6.2,0,{semilla:11}],
    ['piedra',-9,7.5,Math.PI,{semilla:5,tinteTeja:[.8,.85,.95]}],['entramada',0,7.5,Math.PI,{semilla:9,ancho:6.6,tinteYeso:[1,.93,.82],tinteTeja:[.85,.8,.8]}],['entramada',9,7,Math.PI,{semilla:13,ancho:5.4,tinteYeso:[.92,.95,1]}]];
  const casas=PLAN.map(([tipo,x,z,r,o])=>{const c=CASAS.casa(tipo,o);c.position.set(x,0,z);c.rotation.y=r;return c;});
  const calle=CASAS.fundir(casas);escena.add(calle);
  // Farolas: poste de hierro, farol que brilla y una luz de verdad cada una (sin sombra: una luz puntual con sombra dibuja la escena seis veces).
  const farolas=[];
  for(const [x,z] of [[-4.3,-2.4],[4.3,2.6]]){const g=new THREE.Group();g.position.set(x,0,z);escena.add(g);
    const hierro=CASAS.materiales.hierro,m=(geo,mat,y)=>{const o=new THREE.Mesh(geo,mat);o.position.y=y;o.castShadow=true;g.add(o);return o;};
    m(new THREE.CylinderGeometry(.08,.12,3.6,8),hierro,1.8);m(new THREE.CylinderGeometry(.2,.28,.3,8),hierro,.15);m(new THREE.CylinderGeometry(.25,.12,.18,6),hierro,3.9);m(new THREE.BoxGeometry(.3,.4,.3),CASAS.materiales.farol,3.65);m(new THREE.ConeGeometry(.3,.3,6),hierro,4.05);
    const luz=new THREE.PointLight(0xffb070,38,16,1.7);luz.position.y=3.6;g.add(luz);farolas.push(luz);}
  // Humo de las chimeneas: bocanadas grises que suben, crecen y se deshacen con el viento.
  const humos=casas.map(c=>c.userData.humo?c.localToWorld(c.userData.humo.clone()):null).filter(Boolean);
  const NH=humos.length*40,hPos=new Float32Array(NH*3),hEdad=new Float32Array(NH),geoH=new THREE.BufferGeometry();geoH.setAttribute('position',new THREE.BufferAttribute(hPos,3));geoH.setAttribute('aEdad',new THREE.BufferAttribute(hEdad,1));
  const escHumo={value:1};
  const humo=new THREE.Points(geoH,new THREE.ShaderMaterial({uniforms:{uEsc:escHumo},transparent:true,depthWrite:false,
    vertexShader:'attribute float aEdad;uniform float uEsc;varying float vE;void main(){vE=aEdad;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.+aEdad*5.)*uEsc*90./(-mv.z);}',
    fragmentShader:'varying float vE;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.1,.5,d))*(1.-smoothstep(.3,1.,vE))*smoothstep(0.,.08,vE)*.28;gl_FragColor=vec4(vec3(.45,.45,.5),a);}'}));
  humo.frustumCulled=false;humo.renderOrder=3;escena.add(humo);
  for(let i=0;i<NH;i++)hEdad[i]=(i%40)/40;
  function pasoHumo(dt){for(let i=0;i<NH;i++){const f=humos[Math.floor(i/40)];hEdad[i]+=dt/6;if(hEdad[i]>=1)hEdad[i]-=1;const e=hEdad[i],s=i*1.37;
      hPos[i*3]=f.x+e*2.2+Math.sin(s+e*6)*.25*e;hPos[i*3+1]=f.y+e*5;hPos[i*3+2]=f.z+Math.cos(s*1.7+e*5)*.3*e;}
    geoH.attributes.position.needsUpdate=geoH.attributes.aEdad.needsUpdate=true;}

  /* ---- Posproceso: oclusión, saneado (sin NaN), resplandor y salida AgX ---------------------- */
  const objetivo=new THREE.WebGLRenderTarget(2,2,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,samples:muestras});
  const composer=new EffectComposer(renderer,objetivo),pasoRender=new RenderPass(escena,camara);
  const oclusion=new GTAOPass(escena,camara,2,2);oclusion.updateGtaoMaterial({radius:.8,distanceExponent:1.5,thickness:1.2,scale:1,samples:12});oclusion.blendIntensity=.9;
  {const ocultar=oclusion._overrideVisibility.bind(oclusion);oclusion._overrideVisibility=function(){ocultar();escena.traverse(n=>{if(n.visible&&(n.material?.transparent||n.material?.userData?.sinOclusion)){n.visible=false;this._visibilityCache.push(n);}});};}
  const saneado={enabled:true,needsSwap:true,clear:false,renderToScreen:false,setSize(){},dispose(){},
    mat:new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null}},depthTest:false,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;float limpio(float x){return (x>=0.&&x<=60000.)?x:(x>60000.?60000.:0.);}void main(){vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(limpio(c.r),limpio(c.g),limpio(c.b),limpio(c.a));}'}),
    render(r,escribir,leer){this.mat.uniforms.tDiffuse.value=leer.texture;r.setRenderTarget(this.renderToScreen?null:escribir);r.render(this.escenaQ,this.camQ);}};
  saneado.escenaQ=new THREE.Scene();saneado.escenaQ.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),saneado.mat));saneado.camQ=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.55,.5,1),salida=new OutputPass();
  for(const p of [pasoRender,oclusion,saneado,resplandor,salida])composer.addPass(p);

  /* ---- Cámara orbital -------------------------------------------------------------------- */
  // Las vistas de cerca se quedan dentro de la calle (la acera de enfrente está a unos 8 m).
  const VISTAS={calle:{foco:[0,1.6,0],yaw:.35,pitch:.32,dist:26},entramada:{foco:[-8.5,3.4,-5],yaw:.25,pitch:.2,dist:9.5},taberna:{foco:[0,3.4,-5.5],yaw:-.15,pitch:.18,dist:10},piedra:{foco:[8.5,3,-5.5],yaw:-.25,pitch:.12,dist:10}};
  const vista={foco:new V3(0,1.6,0),yaw:.35,pitch:.32,dist:26,obj:null,girar:!reducido&&!CAPTURA};
  function irA(k){const v=VISTAS[k];vista.obj={foco:new V3(...v.foco),yaw:v.yaw,pitch:v.pitch,dist:v.dist};for(const b of document.querySelectorAll('[data-vista]'))b.setAttribute('aria-pressed',String(b.dataset.vista===k));}
  let arrastre=null;
  lienzo.addEventListener('pointerdown',e=>{arrastre={x:e.clientX,y:e.clientY};lienzo.setPointerCapture?.(e.pointerId);vista.obj=null;vista.girar=false;$('girar').checked=false;});
  lienzo.addEventListener('pointermove',e=>{if(!arrastre)return;vista.yaw-=(e.clientX-arrastre.x)*.006;vista.pitch=Math.max(.04,Math.min(1.2,vista.pitch+(e.clientY-arrastre.y)*.004));arrastre={x:e.clientX,y:e.clientY};});
  for(const t of ['pointerup','pointercancel'])lienzo.addEventListener(t,()=>{arrastre=null;});
  esc.addEventListener('wheel',e=>{e.preventDefault();vista.obj=null;vista.dist=Math.max(5,Math.min(45,vista.dist*(e.deltaY>0?1.08:.93)));},{passive:false});
  function pasoCamara(dt){if(vista.obj){const k=Math.min(1,dt*3.5),o=vista.obj;vista.foco.lerp(o.foco,k);vista.yaw+=(o.yaw-vista.yaw)*k;vista.pitch+=(o.pitch-vista.pitch)*k;vista.dist+=(o.dist-vista.dist)*k;}
    if(vista.girar)vista.yaw+=dt*.06;
    const c=Math.cos(vista.pitch);camara.position.set(vista.foco.x+Math.sin(vista.yaw)*c*vista.dist,vista.foco.y+Math.sin(vista.pitch)*vista.dist,vista.foco.z+Math.cos(vista.yaw)*c*vista.dist);camara.lookAt(vista.foco);}

  /* ---- Botones y marcador ------------------------------------------------------------------ */
  let luces=true;
  function ponerLuces(v){luces=v;$('luces').setAttribute('aria-pressed',String(v));$('luces').textContent=v?'Luces de dentro: encendidas':'Luces de dentro: apagadas';}
  $('luces').onclick=()=>ponerLuces(!luces);
  for(const b of document.querySelectorAll('[data-hora]'))b.onclick=()=>ponerHora(b.dataset.hora);
  for(const b of document.querySelectorAll('[data-vista]'))b.onclick=()=>irA(b.dataset.vista);
  $('girar').onchange=e=>{vista.girar=e.target.checked;};
  const tri=casas.map(c=>c.userData.triangulos);
  $('ficha').innerHTML=['entramada','taberna','piedra'].map(t=>{const c=casas.find(c=>c.userData.tipo===t);return `<li><b>${{entramada:'Casa entramada',taberna:'La Jarra Rota (taberna)',piedra:'Cabaña de piedra'}[t]}</b><span>${c.userData.triangulos.toLocaleString('es')} triángulos · ${c.userData.ventanas.length} ventanas</span></li>`;}).join('');

  /* ---- Fotogramas ------------------------------------------------------------------------ */
  let reloj=0,listo=false,simple=false,revisados=0,cuadros=0;
  function paso(dt){reloj+=dt;CASAS.uniformes.uT.value=reloj;const u=CASAS.uniformes.uLuz;u.value+=((luces?1:0)-u.value)*Math.min(1,dt*6);
    for(const f of farolas)f.intensity=38*(.94+.06*Math.sin(reloj*9+f.position.x));pasoHumo(dt);pasoCamara(dt);
    sol.target.position.copy(vista.foco).setY(0);sol.position.copy(sol.target.position).add(new V3(...HORAS[hora].solPos));}
  function medir(){const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,b.width),H=Math.max(1,b.height);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);camara.aspect=W/H;camara.fov=W/H<.9?52:36;camara.updateProjectionMatrix();escHumo.value=H*dpr/900;}
  function negro(){const px=new Uint8Array(4),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;let s=0;for(let k=0;k<9;k++){gl.readPixels(Math.floor(W*(.2+.3*(k%3))),Math.floor(H*(.2+.3*Math.floor(k/3))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);s+=px[0]+px[1]+px[2];}return s<27;}
  function dibujar(){renderer.info.reset();if(simple)renderer.render(escena,camara);else composer.render();
    if(!CAPTURA&&revisados<3&&++cuadros>=5+revisados*20){revisados++;if(negro()){if(!simple){simple=true;aviso('El posproceso no funciona en esta tarjeta gráfica ('+gpu+'): se muestra sin él.');}}}}
  let antes=performance.now(),fps={n:0,t:performance.now()};
  function cuadro(ahora){const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;paso(dt);dibujar();fps.n++;
    if(ahora-fps.t>=1000){const i=renderer.info.render;$('info').textContent=`${Math.round(fps.n*1000/(ahora-fps.t))} fps · ${i.calls} llamadas · ${(i.triangles/1000).toFixed(0)} mil triángulos · ${hdr?'HDR':'8 bits'} · MSAA ${muestras}× · ${simple?'sin posproceso · ':''}${gpu} · three ${THREE.REVISION}`;fps.n=0;fps.t=ahora;}
    requestAnimationFrame(cuadro);}
  ponerHora('noche');ponerLuces(true);irA('calle');Object.assign(vista,{foco:new V3(...VISTAS.calle.foco),...VISTAS.calle,foco:new V3(...VISTAS.calle.foco)});vista.girar=!reducido&&!CAPTURA;$('girar').checked=vista.girar;
  medir();new ResizeObserver(medir).observe(esc);listo=true;paso(1/60);
  estado('Arrastra para girar, rueda para acercar. Las ventanas son un solo cuadro cada una: la habitación de dentro la pinta su shader.');
  if(!CAPTURA)requestAnimationFrame(cuadro);else dibujar();

  // Revisión: avanzar(s) a pasos de 1/30 s y dibuja; ventanaPantalla(i) da el centro en pantalla de una ventana del frente.
  const ventanas=casas.flatMap(c=>c.userData.ventanas.map(v=>({casa:c.userData.tipo,pos:c.localToWorld(v.pos.clone()),normal:v.normal.clone().transformDirection(c.matrixWorld),sem:v.sem,ancho:v.ancho,alto:v.alto})));
  // La misma cuenta que el shader de las ventanas (h1(sem*9.7)>=.16: encendida).
  const encendida=sem=>{const x=Math.sin(sem*9.7*127.1+.7)*43758.5453;return x-Math.floor(x)>=.16;};
  window.CAOZ_CASAS_THREE_REVISION=Object.freeze({
    listo:()=>listo,
    async avanzar(s,fps=30){const n=Math.max(1,Math.round(s*fps));for(let i=0;i<n;i++){paso(1/fps);if(i%5===4)await new Promise(r=>setTimeout(r,0));}dibujar();return this.estado();},
    dibujar(){dibujar();const i=renderer.info.render;return {llamadas:i.calls,triangulos:i.triangles};},
    estado:()=>({listo,webgl2:true,hdr,muestras,version:THREE.REVISION,hora,luces,luz:+CASAS.uniformes.uLuz.value.toFixed(2),
      casas:casas.map(c=>({tipo:c.userData.tipo,triangulos:c.userData.triangulos,ventanas:c.userData.ventanas.length})),mallasCalle:calle.children.length,
      pases:[['render',pasoRender],['oclusion',oclusion],['saneado',saneado],['resplandor',resplandor],['salida',salida]].filter(([,p])=>p.enabled).map(([n])=>n)}),
    camara(v){if(typeof v==='string')irA(v);else{vista.obj=null;Object.assign(vista,v);if(v.foco)vista.foco=new V3(...v.foco);}vista.girar=false;},
    luces:v=>ponerLuces(v),hora:h=>ponerHora(h),
    efecto(k,v){({oclusion,resplandor,saneado})[k].enabled=v;},
    // Las ventanas encendidas de una casa que miran a la cámara: su centro en pantalla y su tamaño.
    ventanas(tipo){camara.updateMatrixWorld(true);const b=esc.getBoundingClientRect();return ventanas.filter(v=>v.casa===tipo&&v.normal.dot(camara.position.clone().sub(v.pos))>0&&encendida(v.sem)).map(v=>{const p=v.pos.clone().project(camara),a=v.pos.clone().add(new V3(0,v.alto/2,0)).project(camara);
      return {x:(p.x*.5+.5)*b.width,y:(.5-p.y*.5)*b.height,radio:Math.abs(a.y-p.y)*.5*b.height,z:p.z};}).filter(v=>v.z<1&&v.x>0&&v.x<b.width&&v.y>0&&v.y<b.height);},
  });
})();

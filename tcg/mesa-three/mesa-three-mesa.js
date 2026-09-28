/* La mesa de juego en three.js (visor-three-vendor.js, three 0.186.1): una
   partida a medias vista desde la silla del jugador, con las cartas físicas de
   three-carta.js y las texturas de siempre (carta-pintor.js, sin cifras: el
   ataque y la vida van encima, vivos).
     · La mesa: madera tallada y un tapete de cuero repujado en oro con sus zonas
       (cinco huecos por campo, trampas, protagonista, mazo y cementerio) y runas
       que laten; velas con llama y sombras, polvo en la luz.
     · El Alma, un cristal que refracta (transmisión) junto a cada protagonista;
       los PD, gemas que se encienden; las Llaves, fichas de oro.
     · Posproceso HDR con MSAA: oclusión ambiental (GTAO), profundidad de campo,
       resplandor y AgX.
   Jugar: pasa por encima de tu mano y pulsa una carta para jugarla (vuela a su
   hueco y cae con una onda y chispas); pulsa una de tus cartas y después una
   enemiga (o su protagonista) para atacar; las que mueren arden y van al
   cementerio. «Turno del rival» roba, juega y ataca. ?captura=1 deja sólo el
   escenario y la revisión avanza el tiempo a pasos fijos. Sin partida real:
   las reglas son una maqueta para ver cómo se sentiría la mesa. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),CAPTURA=q.get('captura')==='1';
  const estado=t=>{$('estado').textContent=t;},aviso=t=>{estado(t);$('info').textContent=t;};
  addEventListener('error',e=>aviso('Error: '+(e.message||e.error)));
  addEventListener('unhandledrejection',e=>aviso('Error: '+(e.reason?.message||e.reason)));
  if(!document.createElement('canvas').getContext('webgl2')){aviso('Este navegador no tiene WebGL 2, que three.js necesita. Prueba con Chrome, Edge, Firefox o Safari actualizados.');return;}
  if(CAPTURA)document.documentElement.dataset.captura='';
  const {THREE,EffectComposer,RenderPass,GTAOPass,UnrealBloomPass,BokehPass,OutputPass}=window.CAOZ_THREE;
  const C=window.CAOZ_THREE_CARTA,{ANCHO,ALTO,GROSOR,GEMAS}=C,S=.62,TAU=Math.PI*2;
  const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const efectos={sombras:true,oclusion:true,enfoque:true,resplandor:true,velas:true};
  // La mano tiene luz propia. Esta intensidad sólo gobierna el ambiente de la mesa.
  let intensidadVisual=58,escalaPolvo=.18+.82*(intensidadVisual/100);
  const limitar=(n,min,max)=>Math.max(min,Math.min(max,n));
  const calidadVisual=()=>intensidadVisual/100;

  /* ---- Motor, escena, cámara y entorno --------------------------------------- */
  const lienzo=$('lienzo'),esc=$('escenario');
  const renderer=new THREE.WebGLRenderer({canvas:lienzo,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;
  const gl=renderer.getContext(),hdr=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float'),muestras=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)||0);
  const depura=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(depura?gl.getParameter(depura.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)).slice(0,60);
  const escena=new THREE.Scene();escena.background=new THREE.Color(0x07050a);escena.fog=new THREE.FogExp2(0x07050a,.028);
  // Entorno de los reflejos: una sala en penumbra con la lámpara cálida arriba y una ventana fría detrás.
  {const e=new THREE.Scene();e.background=new THREE.Color(0x060407);const caja=(w,h,color,f,pos)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(f),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,0,0);e.add(m);};
    caja(5,5,0xffd29a,5,[0,9,1]);caja(4,3,0x9fb8ff,2.5,[-2,3,-9]);caja(8,2,0xff9a50,1.2,[0,1,9]);caja(2,6,0xffc080,1.4,[9,2,0]);
    escena.environment=new THREE.PMREMGenerator(renderer).fromScene(e,.03).texture;escena.environmentIntensity=.8;}
  const camara=new THREE.PerspectiveCamera(38,1,.1,120);const mira=new THREE.Vector3(0,0,.4);
  const vista={yaw:0,pitch:0,dist:1,objYaw:0,objPitch:0,objDist:1,temblor:0};

  /* ---- La mesa y el tapete ------------------------------------------------------ */
  const lienzoDe=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];};
  let semilla=7;const rnd=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
  const tex=(c,srgb,rep)=>{const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...rep);}return t;};
  // Relieve a partir de una altura en gris (Sobel): el repujado del tapete y las vetas de la madera.
  function normales(alto,fuerza){const w=alto.width,h=alto.height,d=alto.getContext('2d').getImageData(0,0,w,h).data,[c,g]=lienzoDe(w,h),im=g.createImageData(w,h),a=(x,y)=>d[(((y+h)%h)*w+((x+w)%w))*4]/255;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(a(x+1,y)-a(x-1,y))*fuerza,dy=(a(x,y+1)-a(x,y-1))*fuerza,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;im.data[i]=(-dx/l*.5+.5)*255;im.data[i+1]=(dy/l*.5+.5)*255;im.data[i+2]=(1/l*.5+.5)*255;im.data[i+3]=255;}
    g.putImageData(im,0,0);return c;}
  function madera(){const [c,g]=lienzoDe(1024,1024),[a,ga]=lienzoDe(1024,1024);g.fillStyle='#3a2014';g.fillRect(0,0,1024,1024);ga.fillStyle='#808080';ga.fillRect(0,0,1024,1024);
    for(let i=0;i<260;i++){const y=rnd()*1024,o=(rnd()-.5)*40,col=rnd();g.strokeStyle=`rgba(${col<.5?20:90},${col<.5?10:50},${col<.5?5:28},${.15+rnd()*.35})`;g.lineWidth=1+rnd()*5;ga.strokeStyle=`rgba(${col<.5?60:170},0,0,.5)`;ga.lineWidth=g.lineWidth;
      for(const k of [g,ga]){k.beginPath();k.moveTo(0,y);for(let x=0;x<=1024;x+=32)k.lineTo(x,y+Math.sin(x*.006+i)*o+Math.sin(x*.02+i*3)*3);k.stroke();}}
    return {map:tex(c,true,[2,1.4]),normalMap:tex(normales(a,2),false,[2,1.4])};}
  const MAT=[18,12.6];// el tapete, en unidades de mundo
  const zonas=[];// dónde está cada zona (para pintarla y para poner las cartas)
  const hueco=(i,lado)=>[(i-2)*1.9,lado*1.55];
  function tapete(logo){
    const W=2048,H=Math.round(W*MAT[1]/MAT[0]),[c,g]=lienzoDe(W,H),[a,ga]=lienzoDe(W,H),[e,ge]=lienzoDe(W,H),k=W/MAT[0];
    const P=(x,z)=>[W/2+x*k,H/2+z*k];
    // Cuero teñido de índigo con manchas y poros.
    const f=g.createRadialGradient(W/2,H/2,H*.1,W/2,H/2,W*.62);f.addColorStop(0,'#2c1a52');f.addColorStop(1,'#110826');g.fillStyle=f;g.fillRect(0,0,W,H);
    ga.fillStyle='#606060';ga.fillRect(0,0,W,H);ge.fillStyle='#000';ge.fillRect(0,0,W,H);
    for(let i=0;i<9000;i++){const x=rnd()*W,y=rnd()*H,r=rnd()*2.4;g.fillStyle=`rgba(0,0,0,${rnd()*.25})`;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();ga.fillStyle=`rgba(40,40,40,${rnd()*.5})`;ga.beginPath();ga.arc(x,y,r,0,TAU);ga.fill();}
    // Repujado de oro: dos bordes con esquinas, los marcos de cada zona y las runas de la línea central.
    const oro=(k2,ancho,brillo=1)=>{g.strokeStyle=`rgba(${Math.round(220*brillo)},${Math.round(170*brillo)},${Math.round(80*brillo)},.95)`;g.lineWidth=ancho;ga.strokeStyle='#e0e0e0';ga.lineWidth=ancho*1.6;};
    const rect=(x,z,w,h,r)=>{const [x0,y0]=P(x-w/2,z-h/2);for(const k2 of [g,ga]){k2.beginPath();k2.roundRect(x0,y0,w*k,h*k,r*k);k2.stroke();}};
    oro(g,6);rect(0,0,MAT[0]-.5,MAT[1]-.5,.5);oro(g,2.5,.8);rect(0,0,MAT[0]-.8,MAT[1]-.8,.4);
    const marco=(x,z,w,h,runa)=>{oro(g,3,.85);rect(x,z,w,h,.12);zonas.push({x,z,w,h});
      if(runa){const [cx,cy]=P(x,z);ge.strokeStyle='#ffb04a';ge.lineWidth=3;ge.beginPath();ge.arc(cx,cy,Math.min(w,h)*k*.28,0,TAU);ge.stroke();for(let i=0;i<6;i++){const an=i*TAU/6;ge.beginPath();ge.moveTo(cx+Math.cos(an)*Math.min(w,h)*k*.18,cy+Math.sin(an)*Math.min(w,h)*k*.18);ge.lineTo(cx+Math.cos(an)*Math.min(w,h)*k*.34,cy+Math.sin(an)*Math.min(w,h)*k*.34);ge.stroke();}}};
    const cw=ANCHO*S+.16,ch=ALTO*S+.16;
    for(const lado of [1,-1]){for(let i=0;i<5;i++){const [x,z]=hueco(i,lado);marco(x,z,cw,ch,true);}
      for(let i=0;i<3;i++)marco((i-1)*1.9,lado*3.95,cw*.8,ch*.62,false);
      marco(-6.9,lado*2.5,cw*1.15,ch*1.15,true);marco(6.9,lado*2.9,cw,ch,false);marco(6.9,lado*.75,cw,ch,false);}
    // La línea central con el emblema y runas que laten (su brillo va en el mapa emisivo).
    ge.strokeStyle='#ffb04a';ge.lineWidth=4;ge.beginPath();ge.moveTo(P(-7.6,0)[0],H/2);ge.lineTo(P(7.6,0)[0],H/2);ge.stroke();
    ge.font=`${Math.round(k*.3)}px Georgia`;ge.fillStyle='#ffb04a';ge.textAlign='center';const runas='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for(let i=0;i<36;i++){const x=-7.2+i*.41;if(Math.abs(x)<1.3)continue;ge.fillText(runas[i%runas.length],P(x,0)[0],H/2-k*.12);}
    if(logo){const lw=k*3,lh=lw*logo.naturalHeight/logo.naturalWidth;g.globalAlpha=.22;g.drawImage(logo,W/2-lw/2,H/2-lh/2,lw,lh);g.globalAlpha=1;ga.globalAlpha=.5;ga.filter='grayscale(1)';ga.drawImage(logo,W/2-lw/2,H/2-lh/2,lw,lh);ga.filter='none';ga.globalAlpha=1;}
    g.drawImage(e,0,0);// las runas también se ven de oro apagado
    const oroOrm=(()=>{const [o,go]=lienzoDe(W,H);go.fillStyle='rgb(255,200,0)';go.fillRect(0,0,W,H);go.globalCompositeOperation='source-over';go.drawImage(a,0,0);const d=go.getImageData(0,0,W,H);
      for(let i=0;i<d.data.length;i+=4){const v=d.data[i]/255,met=Math.max(0,(v-.7)/.3);d.data[i]=255;d.data[i+1]=Math.round((.75-.45*met)*255);d.data[i+2]=Math.round(met*255);}go.putImageData(d,0,0);return o;})();
    return {map:tex(c,true),normalMap:tex(normales(a,3)),roughnessMap:tex(oroOrm),metalnessMap:tex(oroOrm),emissiveMap:tex(e,true)};
  }
  const mesa=new THREE.Group();escena.add(mesa);
  const matMadera=new THREE.MeshPhysicalMaterial({roughness:.42,clearcoat:.5,clearcoatRoughness:.25});
  const tablero=new THREE.Mesh(new THREE.BoxGeometry(24,.6,17),matMadera);tablero.position.y=-.3;tablero.receiveShadow=true;mesa.add(tablero);
  const matTapete=new THREE.MeshPhysicalMaterial({roughness:1,metalness:1,emissive:new THREE.Color(0xffa040),emissiveIntensity:.6,sheen:.4,sheenColor:new THREE.Color(0x8a6ab0),sheenRoughness:.6});
  const cuero=new THREE.Mesh(new THREE.PlaneGeometry(...MAT),matTapete);cuero.rotation.x=-Math.PI/2;cuero.position.y=.003;cuero.receiveShadow=true;mesa.add(cuero);

  /* ---- Luces: la lámpara, la ventana, dos velas y el polvo ------------------ */
  const ambiente=new THREE.HemisphereLight(0x9aa8d0,0x1a0e08,.2);escena.add(ambiente);
  const lampara=new THREE.SpotLight(0xffd6a0,640,0,.62,.6,2);lampara.position.set(0,13,3.5);lampara.target.position.set(0,0,.3);lampara.castShadow=true;
  lampara.shadow.mapSize.set(2048,2048);lampara.shadow.bias=-.0003;lampara.shadow.normalBias=.02;lampara.shadow.radius=4;lampara.shadow.blurSamples=16;escena.add(lampara,lampara.target);
  const ventana=new THREE.DirectionalLight(0x8fa8ff,.7);ventana.position.set(-6,7,-10);escena.add(ventana);
  const FLAMA_V=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const FLAMA_F=`uniform float uT,uSem;varying vec2 vUv;void main(){vec2 p=vUv-vec2(.5,.18);float t=uT*7.+uSem;p.x+=sin(p.y*9.+t)*.04*p.y*3.;
    float forma=1.-smoothstep(.0,.2,length(p*vec2(2.8,1.)-vec2(0.,.2))-.12*(1.-p.y*1.6));float n=forma*smoothstep(.95,.1,vUv.y);
    vec3 c=mix(vec3(1.,.35,.05),vec3(1.,.95,.7),n*n);gl_FragColor=vec4(c*n*2.2,1.);}`;
  const tiempo={value:0};const velas=[];
  for(const [x,z] of [[-10.4,-6.8],[10.4,-6.8]]){
    const g=new THREE.Group();g.position.set(x,0,z);mesa.add(g);
    const laton=new THREE.MeshPhysicalMaterial({color:0xd9a94f,metalness:1,roughness:.28});
    const plato=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,.12,48),laton);plato.position.y=.06;plato.castShadow=plato.receiveShadow=true;g.add(plato);
    const cera=new THREE.Mesh(new THREE.CylinderGeometry(.34,.36,2.6,40),new THREE.MeshPhysicalMaterial({color:0xf3e6c8,roughness:.55,transmission:.35,thickness:.6,sheen:.5,sheenColor:new THREE.Color(0xffd9a0)}));cera.position.y=1.42;cera.castShadow=true;g.add(cera);
    const llama=new THREE.Mesh(new THREE.PlaneGeometry(.55,1.1),new THREE.ShaderMaterial({vertexShader:FLAMA_V,fragmentShader:FLAMA_F,uniforms:{uT:tiempo,uSem:{value:x}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    llama.position.y=3.05;g.add(llama);
    const luz=new THREE.PointLight(0xff9a45,26,18,2);luz.position.y=3.1;luz.castShadow=true;luz.shadow.mapSize.set(512,512);luz.shadow.bias=-.002;luz.shadow.radius=6;g.add(luz);
    velas.push({g,llama,luz,x});
  }
  // Polvo en la luz de la lámpara.
  const POLVO=1800,pp=new Float32Array(POLVO*3),ps=new Float32Array(POLVO);
  for(let i=0;i<POLVO;i++){const a=rnd()*TAU,r=Math.sqrt(rnd())*5.5,y=.3+rnd()*10;pp.set([Math.cos(a)*r*(.4+y/13),y,.3+Math.sin(a)*r*(.4+y/13)],i*3);ps[i]=rnd();}
  const geoPolvo=new THREE.BufferGeometry();geoPolvo.setAttribute('position',new THREE.BufferAttribute(pp,3));geoPolvo.setAttribute('aSem',new THREE.BufferAttribute(ps,1));
  const escPuntos={value:1};
  const polvo=new THREE.Points(geoPolvo,new THREE.ShaderMaterial({uniforms:{uT:tiempo,uEsc:escPuntos},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aSem;uniform float uT,uEsc;varying float vA;void main(){vec3 p=position+vec3(sin(uT*.2+aSem*40.)*.3,sin(uT*.13+aSem*17.)*.4,cos(uT*.17+aSem*29.)*.3);
      vec4 m=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*m;gl_PointSize=(1.2+aSem*2.)*uEsc/(-m.z)*9.;vA=(.3+.7*pow(.5+.5*sin(uT*1.3+aSem*60.),3.))*smoothstep(0.,1.,p.y);}`,
    fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(1.,.86,.62)*smoothstep(.5,0.,d)*vA*.45,1.);}`}));
  polvo.frustumCulled=false;escena.add(polvo);

  /* ---- Cartas físicas, cifras vivas, pilas y cristales ------------------------ */
  const F=C.fabrica(THREE,renderer);F.tiempo.value=0;
  const dorsoPintado={mat:null};const cache=new Map();
  const imagen=url=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});
  async function texturasDe(id,ed){const k=id+'/'+ed;if(cache.has(k))return cache.get(k);const a=window.MESA_THREE_ARTE[k],img=await imagen('./'+a.url);
    const t=F.texturas(CAOZ_CARTA_PINTOR.texturas({id,acabado:ed,arte:{img,enc:a.enc},ancho:640,cifras:false}));cache.set(k,t);return t;}
  // Cifras vivas: un disco con el número encima de cada gema (se repinta al cambiar).
  function cifra(valor,color){const [c,g]=lienzoDe(128,128);const t=tex(c,true);const m=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false,depthWrite:false}));
    m.userData.pintar=(v,col=color)=>{g.clearRect(0,0,128,128);g.font="900 78px 'Cinzel Domo',Georgia,serif";g.textAlign='center';g.textBaseline='middle';g.lineWidth=12;g.strokeStyle='#1a0f0a';g.strokeText(String(v),64,70);g.fillStyle=col;g.fillText(String(v),64,70);t.needsUpdate=true;};
    m.userData.pintar(valor);return m;}
  const enGema=(m,[cx,cy,r])=>{m.position.set((cx/1024-.5)*ANCHO,(.5-cy/1434)*ALTO,GROSOR/2+.004);m.scale.setScalar(r/1024*ANCHO*.78);return m;};
  async function nuevaCarta(id,ed){
    const tx=await texturasDe(id,ed),c=CARDS[id]||null,g=F.carta(F.materialCara(tx,ed),dorsoPintado.mat,F.materialCanto(ed));g.scale.setScalar(S);
    const u={id,ed,g,atq:c?.a??0,vida:c?.h??0,vidaMax:c?.h??0,coste:c?.c??0,tipo:c?.t||'personaje',cifras:{}};
    if(c?.t==='personaje'){u.cifras.atq=enGema(cifra(u.atq,'#fff1d8'),GEMAS.atq);u.cifras.vida=enGema(cifra(u.vida,'#fff1d8'),GEMAS.vida);g.add(u.cifras.atq,u.cifras.vida);}
    if(c)u.cifras.coste=enGema(cifra(u.coste,'#f4ecff'),GEMAS.coste),g.add(u.cifras.coste);
    g.userData.unidad=u;return u;
  }
  const tumbada=new THREE.Euler(-Math.PI/2,0,0);
  // En la mano la carta deja de ser un espejo oscuro: mantiene el relieve, pero toma una luz de lectura
  // cálida y su propio mapa emisivo. Al volver a la mesa recupera exactamente su acabado original.
  function enMano(u,si){const m=u.g.userData.frente.material,p=m.userData.lecturaMano??={envMap:m.envMap,envMapIntensity:m.envMapIntensity,clearcoat:m.clearcoat,emissiveMap:m.emissiveMap,emissive:m.emissive.clone(),emissiveIntensity:m.emissiveIntensity};m.userData.lecturaMano=p;
    if(si){m.envMap=escena.environment;m.envMapIntensity=.48;m.clearcoat=Math.min(.21,p.clearcoat*.34);m.emissiveMap=m.map;m.emissive.setHex(0x3c3428);m.emissiveIntensity=.19;}
    else{m.envMap=p.envMap;m.envMapIntensity=p.envMapIntensity;m.clearcoat=p.clearcoat;m.emissiveMap=p.emissiveMap;m.emissive.copy(p.emissive);m.emissiveIntensity=p.emissiveIntensity;}
    m.needsUpdate=true;}
  // Pilas de cartas (mazo y cementerio): cantos apilados con un poco de desorden.
  function pila(n,x,z,dorso=true){const g=new THREE.Group();g.position.set(x,0,z);mesa.add(g);g.userData.n=0;g.userData.poner=k=>{while(g.children.length<k){const i=g.children.length,m=F.carta(dorso?dorsoPintado.mat:dorsoPintado.mat,dorsoPintado.mat,F.materialCanto('normal'));m.scale.setScalar(S);m.rotation.set(-Math.PI/2+(dorso?Math.PI:0),0,(rnd()-.5)*.06);m.position.set((rnd()-.5)*.04,.02+i*GROSOR*S*1.05,(rnd()-.5)*.04);g.add(m);}while(g.children.length>k)g.remove(g.children.at(-1));g.userData.n=k;};g.userData.poner(n);return g;}
  // Cristales: el Alma (grande, rojo) y los PD (gemas moradas); con transmisión real.
  const vidrio=(color,att)=>new THREE.MeshPhysicalMaterial({color,transmission:1,thickness:.8,ior:1.6,roughness:.04,attenuationColor:new THREE.Color(att),attenuationDistance:2.2,dispersion:.6,specularIntensity:1,emissive:new THREE.Color(att),emissiveIntensity:.35,flatShading:true});
  function cristalAlma(x,z,valor){const g=new THREE.Group();g.position.set(x,0,z);mesa.add(g);
    const pie=new THREE.Mesh(new THREE.CylinderGeometry(.55,.7,.18,48),new THREE.MeshPhysicalMaterial({color:0xd9a94f,metalness:1,roughness:.3}));pie.position.y=.09;pie.castShadow=pie.receiveShadow=true;g.add(pie);
    const gema=new THREE.Mesh(new THREE.OctahedronGeometry(.62,0),vidrio(0xffd0d8,0xd01840));gema.scale.set(.8,1.25,.8);gema.position.y=1.05;gema.castShadow=true;g.add(gema);
    const brillo=new THREE.PointLight(0xff3050,5,3.5,2);brillo.position.y=1.05;g.add(brillo);const nucleo=new THREE.Mesh(new THREE.SphereGeometry(.16,24,16),new THREE.MeshBasicMaterial({color:new THREE.Color(0xff5070).multiplyScalar(3),toneMapped:false}));nucleo.position.y=1.05;g.add(nucleo);
    const et=etiqueta('mtAlma',new THREE.Vector3(x,2.1,z));
    g.userData={gema,brillo,valor,pintar(v){g.userData.valor=v;et.el.innerHTML='<b>'+v+'</b><small>Alma</small>';}};g.userData.pintar(valor);return g;}
  function gemasPD(x0,z,max){const g=new THREE.Group();mesa.add(g);const lista=[];for(let i=0;i<max;i++){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.19,0),vidrio(0xe8d8ff,0x7a3fe0));m.position.set(x0+i*.5,.25,z);m.castShadow=true;g.add(m);lista.push(m);}
    g.userData={lista,poner(pd){lista.forEach((m,i)=>{const on=i<pd;m.material.emissiveIntensity=on?1.4:.02;m.material.transmission=on?.4:1;m.userData.on=on;});}};return g;}
  function llaves(x,z,n){const g=new THREE.Group();g.position.set(x,.05,z);mesa.add(g);const oro=new THREE.MeshPhysicalMaterial({color:0xffcf73,metalness:1,roughness:.22,clearcoat:.4});
    for(let i=0;i<n;i++){const k=new THREE.Group();const aro=new THREE.Mesh(new THREE.TorusGeometry(.2,.06,16,40),oro);aro.rotation.x=Math.PI/2;const cana=new THREE.Mesh(new THREE.BoxGeometry(.08,.06,.6),oro);cana.position.z=.45;const diente=new THREE.Mesh(new THREE.BoxGeometry(.2,.06,.08),oro);diente.position.set(.1,0,.66);
      for(const m of [aro,cana,diente]){m.castShadow=true;k.add(m);}k.position.x=i*.55;k.rotation.y=.4+i*.2;g.add(k);}return g;}

  /* ---- Efectos: onda, chispas, números y el pilar de luz ------------------------ */
  const CHISPAS=2400,dirs=new Float32Array(CHISPAS*3),vel=new Float32Array(CHISPAS);for(let i=0;i<CHISPAS;i++){const a=rnd()*TAU,zz=rnd();dirs.set([Math.cos(a)*Math.sqrt(1-zz*zz),zz,Math.sin(a)*Math.sqrt(1-zz*zz)],i*3);vel[i]=.6+rnd()*2.4;}
  const geoChispas=new THREE.BufferGeometry();geoChispas.setAttribute('position',new THREE.BufferAttribute(new Float32Array(CHISPAS*3),3));geoChispas.setAttribute('aDir',new THREE.BufferAttribute(dirs,3));geoChispas.setAttribute('aVel',new THREE.BufferAttribute(vel,1));
  const estallidos=[];
  function estallido(pos,color=0xffc860,fuerza=1){
    const u={uE:{value:0},uO:{value:pos.clone()},uC:{value:new THREE.Color(color)},uF:{value:fuerza},uEsc:escPuntos};
    const p=new THREE.Points(geoChispas,new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`attribute vec3 aDir;attribute float aVel;uniform float uE,uF,uEsc;uniform vec3 uO;varying float vA;void main(){vec3 p=uO+aDir*aVel*uF*(1.-exp(-uE*3.))*1.1+vec3(0.,-1.4*uE*uE,0.);
        vec4 m=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*m;vA=clamp(1.-uE/1.3,0.,1.);gl_PointSize=(1.5+aVel)*uEsc*vA/(-m.z)*9.;}`,
      fragmentShader:`uniform vec3 uC;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(mix(uC,vec3(1.,.97,.85),.4)*smoothstep(.5,0.,d)*vA*2.,1.);}`}));
    p.frustumCulled=false;escena.add(p);
    const onda=new THREE.Mesh(new THREE.RingGeometry(.85,1,96),new THREE.MeshBasicMaterial({color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));onda.rotation.x=-Math.PI/2;onda.position.set(pos.x,.02,pos.z);escena.add(onda);
    estallidos.push({t0:reloj,p,u,onda,fuerza});
  }
  const numeros=[];
  // Etiquetas HTML sobre puntos del mundo (el Alma, los números de daño), recolocadas en cada fotograma.
  const capa=document.createElement('div');capa.className='mtEtiquetas';esc.appendChild(capa);const etiquetas=[];
  function colocar(e){const v=e.pos.clone().project(camara),b=esc.getBoundingClientRect();e.el.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*b.width}px,${(.5-v.y*.5)*b.height}px)`;e.el.hidden=v.z>1;}
  function etiqueta(clase,pos){const el=document.createElement('div');el.className=clase;capa.appendChild(el);const e={el,pos};etiquetas.push(e);camara.updateMatrixWorld();colocar(e);return e;}
  function numero(pos,texto,color){const e=etiqueta('mtNumero',pos.clone().add(new THREE.Vector3(0,1,0)));e.el.textContent=texto;e.el.style.color=color;numeros.push({e,t0:reloj,y:e.pos.y});}
  const pilar=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.25,9,48,1,true),new THREE.ShaderMaterial({uniforms:{uA:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying float vH;void main(){vH=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uA;varying float vH;void main(){gl_FragColor=vec4(vec3(1.,.82,.45)*uA*pow(1.-vH,1.5),1.);}`}));
  pilar.position.y=4.5;pilar.visible=false;escena.add(pilar);

  /* ---- Posproceso HDR ------------------------------------------------------------- */
  const objetivo=new THREE.WebGLRenderTarget(2,2,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,samples:muestras});
  const composer=new EffectComposer(renderer,objetivo),pasoRender=new RenderPass(escena,camara);
  const oclusion=new GTAOPass(escena,camara,2,2);oclusion.updateGtaoMaterial({radius:.6,distanceExponent:1.4,thickness:1,scale:1.1,samples:12});oclusion.blendIntensity=.9;
  const enfoque=new BokehPass(escena,camara,{focus:14,aperture:.00022,maxblur:.004});
  const resplandor=new UnrealBloomPass(new THREE.Vector2(2,2),.5,.55,.96),salida=new OutputPass();
  for(const p of [pasoRender,oclusion,enfoque,resplandor,salida])composer.addPass(p);

  /* ---- La partida (maqueta) ------------------------------------------------------ */
  const PARTIDA={
    yo:{lider:['lider_gero','dorado'],campo:[['tal','dorado'],['petunia','foil'],['discipulo','normal']],mano:[['magodomo','dorado'],['destello','foil'],['aldrick','normal'],['lucius','normal'],['machete','foil']],mazo:21,cementerio:['eric'],alma:17,pd:6,pdMax:8,llaves:1,trampas:1},
    rival:{lider:['lider_talesin','foil'],campo:[['bartolomeo','foil'],['tok_dragon','dorado'],['conserje','normal']],mano:5,mazo:18,cementerio:['bob','rantiago'],alma:12,pdMax:7,trampas:2,roba:[['esporas','normal'],['matildus','foil']]},
  };
  const J={yo:null,rival:null},seleccion={u:null};
  const campoPos=(lado,i)=>{const [x,z]=hueco(i,lado==='yo'?1:-1);return new THREE.Vector3(x,.02,z);};
  const libres=lado=>[0,1,2,3,4].filter(h=>!J[lado].campo.some(u=>u.hueco===h));
  // Por qué no se puede jugar una carta ahora (o null si se puede).
  const porQueNo=u=>u.coste>J.yo.pd?'Te faltan '+(u.coste-J.yo.pd)+' PD para '+CARDS[u.id].n+' ('+u.coste+' PD).':u.tipo==='personaje'&&!libres('yo').length?'Tu campo está lleno.':null;
  function ponerTumbada(u,pos){u.g.position.copy(pos);u.g.rotation.copy(tumbada);u.g.userData.base=pos.clone();}
  // Mano: abanico delante de la cámara, un poco levantado hacia el jugador.
  // La mano va pegada a la cámara: un abanico abajo en pantalla, como en las cartas digitales.
  const manoCam=new THREE.Group();camara.add(manoCam);escena.add(camara);
  // Luz de lectura: viaja con la cámara y sólo alcanza la mano. No responde al slider: aun con la
  // atmósfera al mínimo, las cartas permanecen claras y sus textos se pueden leer.
  const lectura=new THREE.PointLight(0xfff0dc,55,12,2);lectura.position.set(-4.5,3.5,-3.3);camara.add(lectura);
  const rellenoMano=new THREE.PointLight(0xc6d5ff,12,11,2);rellenoMano.position.set(3.8,1,-3.7);camara.add(rellenoMano);
  // Cada carta tiene su ranura: un rectángulo invisible en su sitio del abanico que no crece. Es la
  // zona estable del puntero (como .handSlot en la mesa de siempre): la carta ampliada puede taparle
  // a la vecina, pero no le roba el puntero ni hace parpadear el resaltado en los solapes.
  const matRanura=new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});
  function colocarMano(anim=true){const lista=J.yo.mano.filter(u=>!u.arrastrando),n=lista.length,retrato=camara.aspect<.9,sep=retrato?.5:.95,lejos=retrato?-9.2:-7.2;
    lista.forEach((u,i)=>{const k=i-(n-1)/2,obj={pos:new THREE.Vector3(k*sep,(retrato?-3.35:-2.55)-Math.abs(k)*.07,lejos+i*.012),rot:new THREE.Euler(-.12,0,-k*.08),i};u.mano=obj;
      if(!u.ranura){u.ranura=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO,ALTO),matRanura);u.ranura.userData.unidad=u;manoCam.add(u.ranura);}
      u.ranura.position.copy(obj.pos);u.ranura.rotation.copy(obj.rot);u.ranura.scale.setScalar(S);u.ranura.visible=true;
      if(!anim){u.g.position.copy(obj.pos);u.g.rotation.copy(obj.rot);}});
    for(const u of J.yo.mano)if(u.arrastrando&&u.ranura)u.ranura.visible=false;}
  function colocarManoRival(){const n=J.rival.manoG.length;J.rival.manoG.forEach((g,i)=>{const k=i-(n-1)/2;g.position.set(k*.95,.7,-6.75);g.rotation.set(-1.1,Math.PI,k*.07);});}
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();estado('Pintando las cartas…');
    const logo=await imagen('./art/logo.webp'),d=CAOZ_CARTA_PINTOR.dorso(logo);dorsoPintado.mat=F.materialDorso(d);
    Object.assign(matTapete,tapete(logo));matTapete.needsUpdate=true;Object.assign(matMadera,madera());matMadera.needsUpdate=true;
    for(const lado of ['yo','rival']){const P=PARTIDA[lado],s=lado==='yo'?1:-1,j={campo:[],mano:[],cementerio:[...P.cementerio],alma:P.alma,pd:P.pd??P.pdMax,pdMax:P.pdMax,roba:P.roba?[...P.roba]:[]};J[lado]=j;
      j.lider=await nuevaCarta(...P.lider);j.lider.g.scale.setScalar(S*1.12);j.lider.g.position.set(-6.9,.05,s*2.5);j.lider.g.rotation.copy(tumbada);mesa.add(j.lider.g);
      for(const [i,[id,ed]] of P.campo.entries()){const u=await nuevaCarta(id,ed);u.hueco=i;ponerTumbada(u,campoPos(lado,i));u.lado=lado;mesa.add(u.g);j.campo.push(u);}
      j.trampas=[];for(let i=0;i<P.trampas;i++){const t=F.carta(dorsoPintado.mat,dorsoPintado.mat,F.materialCanto('normal'));t.scale.setScalar(S*.8);t.rotation.set(-Math.PI/2+Math.PI,0,Math.PI/2+(rnd()-.5)*.05);t.position.set((i-1)*1.9,.02,s*3.95);mesa.add(t);j.trampas.push(t);}
      j.mazo=pila(P.mazo,6.9,s*2.9,true);j.cem=pila(0,6.9,s*.75,false);
      if(j.cementerio.length){const top=await nuevaCarta(j.cementerio.at(-1),'normal');ponerTumbada(top,new THREE.Vector3(6.9,.02+j.cementerio.length*.012,s*.75));top.g.rotation.z=(rnd()-.5)*.2;mesa.add(top.g);j.cemTop=top;}
      j.cristal=cristalAlma(-4.7,s*2.5,j.alma);
    }
    J.yo.pdG=gemasPD(-7.6,5.35,PARTIDA.yo.pdMax);J.yo.pdG.userData.poner(J.yo.pd);J.rival.pdG=gemasPD(-7.6,-5.35,PARTIDA.rival.pdMax);J.rival.pdG.userData.poner(J.rival.pd);
    llaves(-5.2,4.45,PARTIDA.yo.llaves);
    for(const [id,ed] of PARTIDA.yo.mano){const u=await nuevaCarta(id,ed);u.lado='yo';enMano(u,true);manoCam.add(u.g);J.yo.mano.push(u);}
    J.rival.manoG=[];for(let i=0;i<PARTIDA.rival.mano;i++){const g=F.carta(dorsoPintado.mat,dorsoPintado.mat,F.materialCanto('normal'));g.scale.setScalar(S*.9);escena.add(g);J.rival.manoG.push(g);}
    colocarMano(false);colocarManoRival();
    medir();new ResizeObserver(medir).observe(esc);aplicarEfectos();
    estado('Tu turno. Pulsa una carta de tu mano para jugarla, o una de tus cartas y después una enemiga para atacar.');
    listo=true;if(!CAPTURA)requestAnimationFrame(cuadro);
  }

  /* ---- Animaciones sobre un reloj propio (la revisión lo avanza a pasos fijos) --- */
  let reloj=0,listo=false,ocupado=false;const tareas=[];
  const suave=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  const animar=(dur,fn)=>new Promise(ok=>tareas.push({t0:reloj,dur,fn,ok}));
  const espera=dur=>animar(dur,()=>{});
  // Un arco de vuelo: de la pose actual a la de destino, subiendo en medio.
  async function volar(g,pos,rot,dur=.7,alto=2.2){const p0=g.position.clone(),q0=g.quaternion.clone(),q1=new THREE.Quaternion().setFromEuler(rot);
    await animar(dur,k=>{const e=suave(k);g.position.lerpVectors(p0,pos,e);g.position.y+=Math.sin(Math.PI*e)*alto;g.quaternion.slerpQuaternions(q0,q1,e);});}
  function temblar(f){vista.temblor=Math.max(vista.temblor,f);}
  function refrescar(u){if(u.cifras.atq){u.cifras.atq.userData.pintar(u.atq,u.atq>(CARDS[u.id]?.a??0)?'#9dff9d':'#fff1d8');u.cifras.vida.userData.pintar(u.vida,u.vida<u.vidaMax?'#ff8a7a':'#fff1d8');}}

  // Jugar una carta de la mano: vuela a su hueco y cae con onda y chispas; los Hechizos estallan y van al cementerio.
  async function jugar(i,h=null,arrastrada=false){
    const j=J.yo,u=j.mano[i];if(!u||ocupado)return false;
    const no=porQueNo(u);if(no){rechazar(u,no);return false;}
    if(u.tipo==='personaje'&&h!==null&&!libres('yo').includes(h))h=null;
    ocupado=true;j.mano.splice(i,1);if(u.ranura){manoCam.remove(u.ranura);u.ranura=null;}j.pd-=u.coste;j.pdG.userData.poner(j.pd);colocarMano();escena.attach(u.g);
    if(u.tipo==='personaje'){
      u.hueco=h??libres('yo')[0];const pos=campoPos('yo',u.hueco);j.campo.push(u);mesa.attach(u.g);enMano(u,false);
      // Arrastrada, ya está encima de su hueco: sólo cae. Pulsada, vuela desde la mano.
      if(arrastrada)await animar(.12,k=>{u.g.position.lerp(pos.clone().add(new THREE.Vector3(0,1.4,0)),k);u.g.quaternion.slerp(new THREE.Quaternion().setFromEuler(tumbada),k);});
      else await volar(u.g,pos.clone().add(new THREE.Vector3(0,1.4,0)),tumbada,.55,1.6);u.g.scale.setScalar(S);
      if(u.ed==='dorado'){pilar.position.x=pos.x;pilar.position.z=pos.z;pilar.visible=true;animar(1.1,k=>{pilar.material.uniforms.uA.value=Math.sin(Math.PI*k)*.9;}).then(()=>{pilar.visible=false;});}
      await animar(.16,k=>{u.g.position.lerpVectors(pos.clone().add(new THREE.Vector3(0,1.4,0)),pos,k*k);});ponerTumbada(u,pos);
      estallido(pos.clone().add(new THREE.Vector3(0,.1,0)),u.ed==='dorado'?0xffc860:u.ed==='foil'?0xbfe0ff:0xffb070,u.ed==='dorado'?1.3:.9);temblar(u.ed==='dorado'?.25:.14);
      estado(CARDS[u.id].n+' entra en juego.');
    }else{
      u.g.scale.setScalar(S);enMano(u,false);await volar(u.g,new THREE.Vector3(0,3.2,1.2),new THREE.Euler(-.7,0,0),.6,1);
      await animar(.5,k=>{u.g.rotation.y=k*TAU;u.g.position.y=3.2+Math.sin(k*Math.PI)*.4;});
      estallido(u.g.position.clone(),0xb89bff,1.4);temblar(.12);estado(CARDS[u.id].n+': el hechizo se lanza.');
      await aCementerio(u,'yo');
    }
    ocupado=false;return true;
  }
  // Al cementerio: arde (disolverse) y su carta queda encima de la pila.
  async function aCementerio(u,lado,arder=true){
    const j=J[lado],s=lado==='yo'?1:-1;const m=u.g.userData.frente.material;
    if(arder){estallido(u.g.getWorldPosition(new THREE.Vector3()),0xff6a2a,.7);await animar(1,k=>{m.userData.u.uDisuelve.value=k;});}
    u.g.parent?.remove(u.g);m.userData.u.uDisuelve.value=0;
    j.cementerio.push(u.id);j.cem.userData.poner(j.cementerio.length-1);
    if(j.cemTop)j.cemTop.g.parent?.remove(j.cemTop.g);j.cemTop=u;ponerTumbada(u,new THREE.Vector3(6.9,.02+j.cementerio.length*.012,s*.75));u.g.scale.setScalar(S);mesa.add(u.g);
    for(const c of Object.values(u.cifras))c.visible=false;
  }
  // Atacar: la carta se levanta, embiste, golpea (chispas, números, temblor) y vuelve.
  async function atacar(a,b){
    if(ocupado||!a||!b)return false;ocupado=true;seleccionar(null);
    const pa=a.g.position.clone(),pb=b.g?b.g.position.clone():b.pos.clone(),dir=pb.clone().sub(pa),arriba=pa.clone().add(new THREE.Vector3(0,1.3,0));
    await animar(.25,k=>{a.g.position.lerpVectors(pa,arriba,suave(k));a.g.rotation.x=-Math.PI/2+.3*suave(k);});
    const golpe=pb.clone().sub(dir.clone().normalize().multiplyScalar(1.1)).add(new THREE.Vector3(0,.5,0));
    await animar(.14,k=>{a.g.position.lerpVectors(arriba,golpe,k*k);});
    estallido(pb.clone().add(new THREE.Vector3(0,.3,0)),0xffa050,1.1);temblar(.3);
    const danoB=a.atq;numero(pb,'-'+danoB,'#ff9a8a');
    if(b.cristal){b.alma=Math.max(0,b.alma-danoB);b.cristal.userData.pintar(b.alma);animar(.5,k=>{b.cristal.userData.gema.scale.set(.8,1.25,.8).multiplyScalar(1+Math.sin(k*Math.PI)*.25);b.cristal.userData.brillo.intensity=3+Math.sin(k*Math.PI)*25;});}
    else{b.vida-=danoB;refrescar(b);animar(.3,k=>{b.g.position.x=pb.x+Math.sin(k*TAU*4)*.1*(1-k);});if(b.atq>0){a.vida-=b.atq;refrescar(a);numero(pa,'-'+b.atq,'#ff9a8a');}}
    await animar(.35,k=>{a.g.position.lerpVectors(golpe,pa,suave(k));a.g.rotation.x=-Math.PI/2+.3*(1-suave(k));});ponerTumbada(a,pa);
    const muertos=[];for(const u of [a,b])if(!u.cristal&&u.vida<=0)muertos.push(u);
    for(const u of muertos){const lado=u.lado,j=J[lado];j.campo.splice(j.campo.indexOf(u),1);}
    await Promise.all(muertos.map(u=>aCementerio(u,u.lado)));
    ocupado=false;return true;
  }
  function seleccionar(u){if(seleccion.u)seleccion.u.g.userData.frente.material.emissive?.setHex(0);seleccion.u=u;if(u){u.g.userData.frente.material.emissive=new THREE.Color(0x3a2a08);}}
  // El turno del rival: roba, juega lo que robó y ataca a lo más débil (o a tu protagonista).
  async function turnoRival(){
    if(ocupado)return false;const r=J.rival;if(!r.roba.length){estado('El rival ya no tiene más jugadas preparadas.');return false;}
    estado('Turno del rival…');ocupado=true;
    const [id,ed]=r.roba.shift(),u=await nuevaCarta(id,ed);u.lado='rival';r.mazo.userData.poner(r.mazo.userData.n-1);
    u.g.position.set(6.9,.5,-2.9);u.g.rotation.set(-Math.PI/2+Math.PI,0,0);escena.add(u.g);
    await volar(u.g,new THREE.Vector3(0,2.2,-2.6),new THREE.Euler(-.25,0,0),.7,1.2);await espera(.35);
    if(u.tipo==='personaje'&&libres('rival').length){u.hueco=libres('rival')[0];const pos=campoPos('rival',u.hueco);r.campo.push(u);escena.remove(u.g);mesa.add(u.g);await volar(u.g,pos,tumbada,.4,.6);ponerTumbada(u,pos);estallido(pos,0xd070ff,1);temblar(.15);}
    else{estallido(u.g.position.clone(),0xd070ff,1.2);await aCementerio(u,'rival');}
    await espera(.3);ocupado=false;
    const atacante=r.campo.filter(x=>x.atq>0).sort((x,y)=>y.atq-x.atq)[0];
    if(atacante){const presa=J.yo.campo.slice().sort((x,y)=>x.vida-y.vida)[0];await atacar(atacante,presa||{cristal:J.yo.cristal,pos:J.yo.cristal.position.clone(),get alma(){return J.yo.alma;},set alma(v){J.yo.alma=v;}});}
    estado('Tu turno.');return true;
  }

  /* ---- Puntero: ver la mano, bajar cartas (pulsar o arrastrar), elegir y atacar ---- */
  const rayo=new THREE.Raycaster(),puntero=new THREE.Vector2(9,9);
  const cartasDe=lista=>lista.map(u=>u.g);
  // Lo que hay bajo el puntero en la mesa (tus cartas, las del rival y su cristal).
  function tocar(){rayo.setFromCamera(puntero,camara);const objetos=[...cartasDe(J.yo.campo),...cartasDe(J.rival.campo),J.rival.cristal];const hit=rayo.intersectObjects(objetos,true)[0];if(!hit)return null;
    let o=hit.object;while(o&&!o.userData.unidad&&o!==J.rival.cristal)o=o.parent;return o;}
  // La ranura de la mano bajo el puntero: la de encima (cada carta monta sobre la de su izquierda,
  // como una mano de verdad). Sólo cuentan las ranuras, nunca la carta ampliada.
  const mano={activa:null,uv:new THREE.Vector2(.5,.5)};
  function ranuraBajo(){if(!J.yo)return null;rayo.setFromCamera(puntero,camara);const hits=rayo.intersectObjects(J.yo.mano.filter(u=>u.ranura?.visible).map(u=>u.ranura),false);if(!hits.length)return null;
    return {u:hits[0].object.userData.unidad,uv:hits[0].uv};}
  // Avisos breves sobre la mesa (por qué no se puede jugar una carta).
  const avisoMesa=document.createElement('p');avisoMesa.className='mtAviso';avisoMesa.setAttribute('role','status');esc.appendChild(avisoMesa);let avisoHasta=0;
  function rechazar(u,texto){estado(texto);avisoMesa.textContent=texto;avisoMesa.classList.add('visto');avisoHasta=reloj+2.2;u.sacudida=reloj;}
  // Las marcas de los huecos libres (se encienden al arrastrar) y la silueta de la carta en el elegido.
  function marcoBrillo(){const [c,g]=lienzoDe(256,340);g.strokeStyle='#ffd27a';g.lineWidth=10;g.shadowColor='#ffb040';g.shadowBlur=24;g.beginPath();g.roundRect(18,18,220,304,18);g.stroke();return tex(c,true);}
  const texMarco=marcoBrillo(),marcas=[0,1,2,3,4].map(h=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO*S+.5,ALTO*S+.62),new THREE.MeshBasicMaterial({map:texMarco,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    m.rotation.x=-Math.PI/2;m.position.copy(campoPos('yo',h)).setY(.016);mesa.add(m);return m;});
  const silueta=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO*S,ALTO*S),new THREE.MeshBasicMaterial({transparent:true,opacity:.42,depthWrite:false}));silueta.rotation.x=-Math.PI/2;silueta.visible=false;mesa.add(silueta);
  const zonaHechizo=new THREE.Mesh(new THREE.CircleGeometry(2.6,64),new THREE.MeshBasicMaterial({color:0xb89bff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));zonaHechizo.rotation.x=-Math.PI/2;zonaHechizo.position.set(0,.017,0);mesa.add(zonaHechizo);
  // El arrastre: la carta sigue al puntero sobre la mesa, inclinada por su velocidad.
  const planoArrastre=new THREE.Plane(new THREE.Vector3(0,1,0),-1.1),arr={u:null,punto:new THREE.Vector3(),antes:new THREE.Vector3(),h:null,zona:false,inc:new THREE.Vector2()};
  function puntoMesa(){rayo.setFromCamera(puntero,camara);return rayo.ray.intersectPlane(planoArrastre,new THREE.Vector3());}
  function iniciarArrastre(u){const no=porQueNo(u);if(no){rechazar(u,no);return false;}
    arr.u=u;u.arrastrando=true;mano.activa=null;escena.attach(u.g);colocarMano();const p=puntoMesa();if(p){arr.punto.copy(p);arr.antes.copy(p);}
    silueta.material.map=u.g.userData.frente.material.map;silueta.material.needsUpdate=true;estado(u.tipo==='personaje'?'Suéltala sobre un hueco libre de tu campo.':'Suéltalo sobre la mesa para lanzarlo.');return true;}
  function acabarArrastre(){const u=arr.u;if(!u)return;arr.u=null;u.arrastrando=false;silueta.visible=false;zonaHechizo.material.opacity=0;for(const m of marcas)m.material.opacity=0;
    const i=J.yo.mano.indexOf(u);
    if(u.tipo==='personaje'&&arr.h!==null)return jugar(i,arr.h,true);
    if(u.tipo!=='personaje'&&arr.zona)return jugar(i,null,true);
    manoCam.attach(u.g);colocarMano();estado('La carta vuelve a tu mano.');}
  // Mirar una carta en grande (en táctil, donde no hay «pasar por encima»).
  const panelVer=document.createElement('div');panelVer.className='mtVer';panelVer.hidden=true;panelVer.innerHTML='<button type="button" data-ver="jugar">Jugar</button><button type="button" data-ver="cerrar">Cerrar</button>';esc.appendChild(panelVer);
  let viendo=null;
  function ver(u){viendo=u;panelVer.hidden=!u;if(u){const no=porQueNo(u);panelVer.querySelector('[data-ver="jugar"]').disabled=!!no;panelVer.querySelector('[data-ver="jugar"]').title=no||'';estado(no||'Pulsa «Jugar» para bajarla, o arrástrala a la mesa.');}}
  panelVer.addEventListener('pointerdown',e=>e.stopPropagation());
  panelVer.querySelector('[data-ver="cerrar"]').onclick=()=>ver(null);
  panelVer.querySelector('[data-ver="jugar"]').onclick=()=>{const u=viendo;ver(null);if(u)jugar(J.yo.mano.indexOf(u));};
  // Los gestos: pulsar (jugar, elegir, atacar), arrastrar desde la mano (bajar) o desde la mesa (mirar alrededor).
  let gesto=null;
  esc.addEventListener('pointerdown',e=>{if(!listo)return;const b=esc.getBoundingClientRect();puntero.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);revisionPuntero=true;
    const r=ranuraBajo();gesto={u:viendo&&!r?null:r?.u||null,x:e.clientX,y:e.clientY,movido:0,tactil:e.pointerType==='touch'};esc.setPointerCapture(e.pointerId);});
  esc.addEventListener('pointermove',e=>{const b=esc.getBoundingClientRect();puntero.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);revisionPuntero=true;
    if(!gesto)return;const dx=e.clientX-gesto.x,dy=e.clientY-gesto.y;gesto.movido+=Math.abs(dx)+Math.abs(dy);gesto.x=e.clientX;gesto.y=e.clientY;
    if(gesto.u&&!arr.u&&!gesto.falla&&gesto.movido>10&&!ocupado){if(viendo)ver(null);if(!iniciarArrastre(gesto.u))gesto.falla=true;}
    else if(!gesto.u&&gesto.movido>6){vista.objYaw=Math.max(-.5,Math.min(.5,vista.objYaw-dx/400));vista.objPitch=Math.max(-.25,Math.min(.35,vista.objPitch+dy/500));}});
  esc.addEventListener('pointerup',async e=>{const g=gesto;gesto=null;if(!g||!listo)return;
    if(arr.u)return acabarArrastre();
    if(g.u&&g.movido<=10){if(g.tactil)return ver(viendo===g.u?null:g.u);return jugar(J.yo.mano.indexOf(g.u));}
    if(g.u||g.movido>6)return;if(viendo)return ver(null);
    const o=tocar();if(!o)return seleccionar(null);
    if(o===J.rival.cristal){if(seleccion.u)await atacar(seleccion.u,{cristal:J.rival.cristal,pos:J.rival.cristal.position.clone(),get alma(){return J.rival.alma;},set alma(v){J.rival.alma=v;}});return;}
    const u=o.userData.unidad;
    if(J.yo.campo.includes(u))return seleccionar(seleccion.u===u?null:u);
    if(J.rival.campo.includes(u)&&seleccion.u)return atacar(seleccion.u,u);});
  esc.addEventListener('pointercancel',()=>{gesto=null;if(arr.u){arr.h=null;arr.zona=false;acabarArrastre();}});
  esc.addEventListener('pointerleave',()=>{if(!gesto)puntero.set(9,9);});
  esc.addEventListener('wheel',e=>{e.preventDefault();vista.objDist=Math.max(.75,Math.min(1.25,vista.objDist+e.deltaY*.0008));},{passive:false});
  $('turnoRival').onclick=()=>turnoRival();
  $('demo').onclick=()=>demostracion();
  for(const c of document.querySelectorAll('[data-efecto]'))c.onchange=()=>{efectos[c.dataset.efecto]=c.checked;aplicarEfectos();};
  const rangoIntensidad=$('intensidadEfectos'),textoIntensidad=$('intensidadTexto');
  function nombreIntensidad(){return intensidadVisual<33?'Prioriza lectura':intensidadVisual<77?'Equilibrado':'Cinemático';}
  function actualizarPolvo(){const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);escPuntos.value=Math.max(1,b.height)*dpr/900*escalaPolvo;}
  function fijarIntensidad(valor){intensidadVisual=Math.round(limitar(Number(valor)||0,0,100));escalaPolvo=.18+.82*calidadVisual();
    if(rangoIntensidad)rangoIntensidad.value=String(intensidadVisual);
    if(textoIntensidad)textoIntensidad.textContent=nombreIntensidad()+' · '+intensidadVisual+'%';
    aplicarEfectos();}
  rangoIntensidad?.addEventListener('input',()=>fijarIntensidad(rangoIntensidad.value));
  function aplicarEfectos(){const k=calidadVisual(),sombras=efectos.sombras&&k>.06;
    // A menor atmósfera, el tablero gana relleno y pierde niebla: se siguen viendo las zonas y cartas.
    ambiente.intensity=.22+(1-k)*.14;ventana.intensity=.88-k*.22;lampara.intensity=500+150*k;escena.fog.density=.007+.021*k;
    renderer.shadowMap.enabled=sombras;lampara.castShadow=sombras;
    for(const v of velas){v.luz.castShadow=sombras&&efectos.velas&&k>.18;v.luz.visible=efectos.velas&&k>.04;v.llama.visible=efectos.velas&&k>.04;}
    oclusion.enabled=efectos.oclusion&&k>.13;oclusion.blendIntensity=.18+.72*k;oclusion.updateGtaoMaterial({radius:.4+.24*k,distanceExponent:1.02+.38*k,thickness:.7+.3*k,scale:.58+.52*k,samples:Math.max(4,Math.round(4+8*k))});
    enfoque.enabled=efectos.enfoque&&k>.18;enfoque.uniforms.aperture.value=.00002+.00020*k;enfoque.uniforms.maxblur.value=.0005+.0035*k;
    resplandor.enabled=efectos.resplandor&&k>.05;resplandor.threshold=.95-.25*k;resplandor.radius=.18+.48*k;
    actualizarPolvo();escena.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true;});}
  // Una jugada completa para verlo todo: juega, ataca y deja jugar al rival.
  async function demostracion(){if(ocupado)return;const yo=J.yo;
    await jugar(yo.mano.findIndex(u=>u.id==='aldrick'));await espera(.3);
    await atacar(yo.campo.find(u=>u.id==='tal'),J.rival.campo.find(u=>u.id==='conserje'));await espera(.3);
    await turnoRival();}

  /* ---- Cada fotograma ---------------------------------------------------------- */
  function medir(){const b=esc.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,b.width),H=Math.max(1,b.height);
    renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);composer.setPixelRatio(dpr);composer.setSize(W,H);camara.aspect=W/H;camara.fov=W/H<.9?46:38;camara.updateProjectionMatrix();escPuntos.value=H*dpr/900*escalaPolvo;if(J.yo)colocarMano(false);}
  function paso(dt){
    reloj+=dt;tiempo.value=reloj;F.tiempo.value=reloj;
    for(let i=tareas.length-1;i>=0;i--){const t=tareas[i],k=Math.min(1,(reloj-t.t0)/t.dur);t.fn(k);if(k>=1){tareas.splice(i,1);t.ok();}}
    // Cámara: la silla del jugador; se puede mirar alrededor un poco y acercar.
    for(const k of ['yaw','pitch','dist'])vista[k]+=(vista['obj'+k[0].toUpperCase()+k.slice(1)]-vista[k])*Math.min(1,dt*6);
    const retrato=camara.aspect<.9,d=(retrato?Math.min(40,13.5/camara.aspect):17.6)*vista.dist,alt=(retrato?1.2:.9)+vista.pitch;vista.temblor=Math.max(0,vista.temblor-dt*1.2);const tr=vista.temblor;
    camara.position.set(Math.sin(vista.yaw)*d*Math.cos(alt)+Math.sin(reloj*61)*tr*.25,Math.sin(alt)*d+Math.sin(reloj*.4)*.08+Math.cos(reloj*53)*tr*.2,Math.cos(vista.yaw)*d*Math.cos(alt));camara.lookAt(mira.x,mira.y,mira.z+(retrato?.9:.7));
    // El enfoque: la mesa; si miras una carta de la mano, el foco pasa a ella (y la mesa se desenfoca detrás).
    {const u=listo&&(viendo||mano.activa),f=u?camara.position.distanceTo(u.g.getWorldPosition(new THREE.Vector3())):camara.position.distanceTo(new THREE.Vector3(0,0,1));
      enfoque.uniforms.focus.value+=(f-enfoque.uniforms.focus.value)*Math.min(1,dt*(u?14:5));}
    // Velas que tiemblan, runas que laten, la mano que se levanta al pasar por encima.
    const calidad=calidadVisual();
    for(const v of velas){const f=.85+.1*Math.sin(reloj*13+v.x)+.06*Math.sin(reloj*29+v.x*3);v.luz.intensity=(8+18*calidad)*f;v.llama.scale.set(1,f,1);v.llama.lookAt(camara.position.x,v.llama.getWorldPosition(new THREE.Vector3()).y,camara.position.z);}
    matTapete.emissiveIntensity=(.24+.18*calidad)+(.06+.17*calidad)*Math.sin(reloj*1.6);
    for(const g of J.rival?.trampas||[])g.position.y=.02;
    if(listo){manoYArrastre(dt);
      for(const u of J.yo.campo)u.g.position.y=(u===seleccion.u?.35+Math.sin(reloj*4)*.05:.02)+(u.g.userData.base?0:0);
      for(const u of J.rival.campo)if(!tareas.length)u.g.position.y=.02;
      J.yo.cristal.userData.gema.rotation.y=reloj*.6;J.rival.cristal.userData.gema.rotation.y=-reloj*.5;
      for(const lado of ['yo','rival'])J[lado].pdG.userData.lista.forEach((m,i)=>{m.rotation.y=reloj*.8+i;m.position.y=.25+(m.userData.on?Math.sin(reloj*2+i)*.05:0);});}
    for(let i=estallidos.length-1;i>=0;i--){const e=estallidos[i],s=reloj-e.t0;e.u.uE.value=s;e.onda.scale.setScalar(.3+s*3.2*e.fuerza);e.onda.material.opacity=Math.max(0,1-s/.8);if(s>1.4){escena.remove(e.p,e.onda);e.p.material.dispose();e.onda.material.dispose();estallidos.splice(i,1);}}
    for(let i=numeros.length-1;i>=0;i--){const n=numeros[i],s=reloj-n.t0;n.e.pos.y=n.y+s*1.2;n.e.el.style.opacity=String(Math.max(0,1-Math.max(0,s-.5)/.6));if(s>1.1){n.e.el.remove();etiquetas.splice(etiquetas.indexOf(n.e),1);numeros.splice(i,1);}}
    camara.updateMatrixWorld();for(const e of etiquetas)colocar(e);
    const pulso=estallidos.reduce((a,e)=>a+Math.max(0,1-(reloj-e.t0)*2),0);
    resplandor.strength=.1+.4*calidad+Math.min(.1+.55*calidad,pulso*(.16+.55*calidad));
  }
  let simple=false,revisados=0,cuadros=0,revisionPuntero=false;
  // La mano, como en la mesa de siempre: la carta bajo el puntero se endereza, sube desde su base y
  // crece hasta leerse (sin salirse de la pantalla), se inclina con el puntero y aparta a sus vecinas;
  // entra rápido y se va despacio. Las que puedes pagar brillan en el canto; las demás se apagan.
  function rectDe(u){camara.updateMatrixWorld(true);u.g.updateMatrixWorld(true);const b=esc.getBoundingClientRect(),xs=[],ys=[];
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const v=new THREE.Vector3(x*ANCHO/2,y*ALTO/2,0).applyMatrix4(u.g.matrixWorld).project(camara);xs.push((v.x*.5+.5)*b.width);ys.push((.5-v.y*.5)*b.height);}
    return {izquierda:Math.min(...xs),derecha:Math.max(...xs),arriba:Math.min(...ys),abajo:Math.max(...ys),ancho:b.width,alto:b.height};}
  const falta=document.createElement('p');falta.className='mtFalta';esc.appendChild(falta);
  function manoYArrastre(dt){
    const r=CAPTURA&&!revisionPuntero?null:(arr.u||gesto?.u&&gesto.movido>10?null:ranuraBajo());
    if(!ocupado&&!viendo){mano.activa=r?.u||null;if(r)mano.uv.copy(r.uv);}else if(ocupado)mano.activa=null;
    const lista=J.yo.mano.filter(u=>!u.arrastrando),ia=lista.indexOf(mano.activa),fov=camara.fov*Math.PI/360;
    for(const u of lista){const obj=u.mano;if(!obj)continue;const i=lista.indexOf(u),activa=u===mano.activa,mira=u===viendo;
      const pos=obj.pos.clone(),q=new THREE.Quaternion();let esc=S;
      if(mira){// En grande, en el centro (para leerla en táctil).
        const zc=5.4,hv=Math.tan(fov)*zc,G=Math.min(2.4,hv*1.5/(ALTO*S));pos.set(0,hv*.08,-zc);esc=S*G;}
      else if(activa){
        const zc=-(obj.pos.z+.9),hv=Math.tan(fov)*zc,hw=hv*camara.aspect,base=Math.max(obj.pos.y-ALTO*S/2,-hv*.97);
        // El margen deja sitio a la inclinación con el puntero (la carta girada ocupa algo más).
        const G=Math.max(1.15,Math.min(1.7,(hv*.95-base-.1)/(ALTO*S),(hw*1.84)/(ANCHO*S)));
        pos.y=base+.1+ALTO*S*G/2;pos.z=obj.pos.z+.9;pos.x=Math.max(-hw*.93+ANCHO*S*G/2,Math.min(hw*.93-ANCHO*S*G/2,pos.x));esc=S*G;
        q.setFromEuler(new THREE.Euler(-(mano.uv.y-.5)*.3,(mano.uv.x-.5)*.4,0));}
      else{q.setFromEuler(obj.rot);if(ia>=0){const d=i-ia;pos.x+=Math.sign(d)*.42/Math.sqrt(Math.abs(d));}}
      if(u.sacudida!==undefined&&reloj-u.sacudida<.4)pos.x+=Math.sin((reloj-u.sacudida)*TAU*7)*.1*(1-(reloj-u.sacudida)/.4);
      const k=Math.min(1,dt*(activa||mira?18:7));u.g.position.lerp(pos,k);u.g.quaternion.slerp(q,k);u.g.scale.setScalar(u.g.scale.x+(esc-u.g.scale.x)*k);
      // Se puede pagar: canto encendido. No: la cara apagada (salvo mientras la miras).
      const no=porQueNo(u),m=u.g.userData.frente.material,canto=u.g.userData.borde.material[1];
      m.color.setScalar(no&&!activa&&!mira?.5:1);canto.emissive=canto.emissive||new THREE.Color();canto.emissive.setHex(no?0:0xffb040);canto.emissiveIntensity=no?0:.35+.25*Math.sin(reloj*3+i);}
    // La carta arrastrada sigue al puntero sobre la mesa, inclinada por su velocidad.
    if(arr.u){const u=arr.u,p=puntoMesa();if(p)arr.punto.copy(p);const v=arr.punto.clone().sub(arr.antes).divideScalar(Math.max(dt,1/120));arr.antes.lerp(arr.punto,Math.min(1,dt*20));
      arr.inc.lerp(new THREE.Vector2(Math.max(-.35,Math.min(.35,v.x*.02)),Math.max(-.35,Math.min(.35,v.z*.02))),Math.min(1,dt*10));
      u.g.position.lerp(arr.punto,Math.min(1,dt*20));u.g.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+arr.inc.y,arr.inc.x,0)),Math.min(1,dt*14));u.g.scale.setScalar(u.g.scale.x+(S*1.08-u.g.scale.x)*Math.min(1,dt*12));
      const libre=libres('yo');arr.h=null;arr.zona=false;
      if(u.tipo==='personaje'){let mejor=1.7;for(const h of libre){const d=Math.hypot(arr.punto.x-campoPos('yo',h).x,arr.punto.z-campoPos('yo',h).z);if(d<mejor){mejor=d;arr.h=h;}}}
      else arr.zona=Math.abs(arr.punto.x)<7.5&&arr.punto.z>-5.5&&arr.punto.z<3.2;
      marcas.forEach((m,h)=>{m.material.opacity=u.tipo!=='personaje'||!libre.includes(h)?0:h===arr.h?.95:.28+.12*Math.sin(reloj*5+h);});
      silueta.visible=arr.h!==null;if(arr.h!==null)silueta.position.copy(campoPos('yo',arr.h)).setY(.03);zonaHechizo.material.opacity=u.tipo==='personaje'?0:arr.zona?.45:.15;}
    if(avisoHasta&&reloj>avisoHasta){avisoMesa.classList.remove('visto');avisoHasta=0;}
    const vista=viendo||mano.activa,rc=vista&&vista.g.scale.x>S*1.2?rectDe(vista):null,no=vista&&porQueNo(vista);
    for(const e of etiquetas){const v=e.pos.clone().project(camara),x=(v.x*.5+.5)*(rc?.ancho||1),y=(.5-v.y*.5)*(rc?.alto||1);e.el.classList.toggle('tapada',!!rc&&x>rc.izquierda-20&&x<rc.derecha+20&&y>rc.arriba-20&&y<rc.abajo+20);}
    falta.classList.toggle('visto',!!(rc&&no));if(rc&&no){falta.textContent=no;falta.style.transform=`translate(-50%,-100%) translate(${(rc.izquierda+rc.derecha)/2}px,${Math.max(34,rc.arriba-6)}px)`;}
  }
  function negro(){const px=new Uint8Array(4),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;let s=0;for(let k=0;k<9;k++){gl.readPixels(Math.floor(W*(.2+.3*(k%3))),Math.floor(H*(.2+.3*Math.floor(k/3))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);s+=px[0]+px[1]+px[2];}return s<27;}
  function dibujar(){renderer.info.reset();if(simple)renderer.render(escena,camara);else composer.render();
    if(!CAPTURA&&revisados<3&&++cuadros>=5+revisados*20){revisados++;if(negro()){if(!simple){simple=true;aviso('El posproceso no funciona en esta tarjeta gráfica ('+gpu+'): se muestra sin él.');}else aviso('La escena sale negra en esta tarjeta gráfica ('+gpu+'). Cuéntanos qué navegador y dispositivo usas.');}}}
  let antes=performance.now(),fps={n:0,t:performance.now(),v:0};
  function cuadro(ahora){const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;paso(reducido?Math.min(dt,.05):dt);dibujar();
    fps.n++;if(ahora-fps.t>=1000){fps.v=Math.round(fps.n*1000/(ahora-fps.t));fps.n=0;fps.t=ahora;const i=renderer.info;
      $('info').textContent=`${fps.v} fps · ${i.render.calls} llamadas de dibujo · ${(i.render.triangles/1000).toFixed(0)} mil triángulos · ${i.memory.textures} texturas · WebGL 2 · ${hdr?'HDR':'8 bits'} · MSAA ${muestras}× · ${simple?'sin posproceso · ':''}${gpu} · three ${THREE.REVISION}`;}
    requestAnimationFrame(cuadro);}
  // Revisión: avanzar(s) mueve el reloj a pasos de 1/30 s y dibuja; las acciones devuelven promesas que se cumplen al avanzar.
  window.CAOZ_MESA_THREE_REVISION=Object.freeze({
    listo:()=>listo,
    // Entre paso y paso cede el turno para que las animaciones encadenadas (await) sigan como en tiempo real.
    async avanzar(s,fps=30){const n=Math.max(1,Math.round(s*fps));for(let i=0;i<n;i++){paso(1/fps);await new Promise(r=>setTimeout(r,0));}dibujar();return this.estado();},
    puntero(x,y){revisionPuntero=true;puntero.set(x,y);},
    // Un punto de la parte de la carta que asoma: arriba y a la izquierda (la de su derecha la monta).
    manoPantalla(i){const u=J.yo.mano[i];if(!u?.ranura)return null;camara.updateMatrixWorld(true);u.ranura.updateMatrixWorld(true);const v=new THREE.Vector3(-ANCHO*.3,ALTO*.28,0).applyMatrix4(u.ranura.matrixWorld).project(camara),b=esc.getBoundingClientRect();return {x:b.left+(v.x*.5+.5)*b.width,y:b.top+(.5-v.y*.5)*b.height};},
    huecoPantalla(h){const v=campoPos('yo',h).project(camara),b=esc.getBoundingClientRect();return {x:b.left+(v.x*.5+.5)*b.width,y:b.top+(.5-v.y*.5)*b.height};},
    // La carta que se mira: su índice, cuánto ha crecido y su rectángulo en pantalla (para ver que cabe entera).
    mirada(){const u=viendo||mano.activa;if(!u)return {indice:-1,viendo:false};
      return {indice:J.yo.mano.indexOf(u),id:u.id,viendo:!!viendo,escala:u.g.scale.x/S,...rectDe(u),apagada:u.g.userData.frente.material.color.r<.9,falta:falta.classList.contains('visto')?falta.textContent:'',etiquetasTapadas:etiquetas.filter(e=>e.el.classList.contains('tapada')).length};},
    arrastrando:()=>arr.u?{id:arr.u.id,hueco:arr.h,zona:arr.zona}:null,
    jugar:i=>{jugar(i);},atacar:(a,b)=>{const A=J.yo.campo.find(u=>u.id===a),B=J.rival.campo.find(u=>u.id===b);atacar(A,B);},turnoRival:()=>{turnoRival();},demostracion:()=>{demostracion();},
    efecto(k,v){efectos[k]=v;const c=document.querySelector(`[data-efecto="${k}"]`);if(c)c.checked=v;aplicarEfectos();},
    intensidad(v){if(v!==undefined)fijarIntensidad(v);return intensidadVisual;},
    vista(p){Object.assign(vista,p);},
    estado:()=>({ocupado,apagadas:J.yo?.mano.filter(u=>u.g.userData.frente.material.color.r<.9).map(u=>u.id),huecos:J.yo&&[0,1,2,3,4].map(h=>J.yo.campo.find(u=>u.hueco===h)?.id||null),aviso:avisoMesa.classList.contains('visto')?avisoMesa.textContent:'',mano:J.yo?.mano.map(u=>u.id),campo:J.yo?.campo.map(u=>u.id+':'+u.atq+'/'+u.vida),rival:J.rival?.campo.map(u=>u.id+':'+u.atq+'/'+u.vida),almaYo:J.yo?.alma,almaRival:J.rival?.alma,pd:J.yo?.pd,
      cementerio:J.yo?.cementerio.length,cementerioRival:J.rival?.cementerio.length,manoRival:J.rival?.manoG.length,webgl2:true,hdr,muestras,simple,intensidad:intensidadVisual,
      iluminacionMano:J.yo?.mano.map(u=>{const m=u.g.userData.frente.material;return {id:u.id,entorno:m.envMapIntensity,laca:m.clearcoat,emision:m.emissiveIntensity};}),
      pases:[['render',pasoRender],['oclusion',oclusion],['enfoque',enfoque],['resplandor',resplandor],['salida',salida]].filter(([,p])=>p.enabled).map(([n])=>n)}),
    pantalla(x,y,z){const v=new THREE.Vector3(x,y,z).project(camara),b=esc.getBoundingClientRect();return {x:(v.x*.5+.5)*b.width,y:(.5-v.y*.5)*b.height,ancho:b.width,alto:b.height};},
    posiciones:()=>({mano:J.yo.mano.map(u=>u.g.getWorldPosition(new THREE.Vector3()).toArray()),campo:J.yo.campo.map(u=>u.g.position.toArray()),rival:J.rival.campo.map(u=>u.g.position.toArray()),liderYo:J.yo.lider.g.position.toArray(),liderRival:J.rival.lider.g.position.toArray(),mazo:J.yo.mazo.position.toArray()}),
  });
  preparar().catch(e=>aviso('No se pudo preparar la mesa: '+e.message));
})();

/*
  Mesa Three jugable. Esta capa no contiene reglas de cartas: motor.js es la
  autoridad. Su único trabajo es representar G/P y traducir clics, decisiones
  y efectos a los ganchos públicos del motor.
*/
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const qs=new URLSearchParams(location.search),CAPTURA=qs.get('captura')==='1';
  const stage=$('ctStage'),canvas=$('ctCanvas'),message=$('ctMessage'),prompt=$('ctPrompt'),labels=$('ctLabels');
  const modal=$('ctModal'),modalKicker=$('ctModalKicker'),modalTitle=$('ctModalTitle'),modalBody=$('ctModalBody'),modalActions=$('ctModalActions');
  const logEl=$('ctLog'),logToggle=$('ctLogToggle'),meHud=$('ctMeHud'),enemyHud=$('ctEnemyHud'),turnEl=$('ctTurn'),leaderBtn=$('ctLeader'),abilityBtn=$('ctAbility'),endBtn=$('ctEnd');
  if(CAPTURA)document.documentElement.dataset.captura='';
  if(!document.createElement('canvas').getContext('webgl2')){message.textContent='Este navegador necesita WebGL 2 para abrir la mesa.';return;}
  const {THREE}=window.CAOZ_THREE;
  const Carta=window.CAOZ_THREE_CARTA,{ANCHO,ALTO,GROSOR,GEMAS}=Carta;
  // La escala y la altura son las de la mesa Three aprobada. No se ajustan
  // por esta pantalla: el motor sólo aporta el estado de la partida.
  const ESC=.62,HAND_SCALE=ESC*.76,ALTURA=.003+GROSOR*ESC/2+.012,TAU=Math.PI*2;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let modo=qs.get('modo')==='duelo'?'duelo':'final',reloj=0,ready=false,ocupadoFx=0,selected=null,logCount=0,logOpen=false,logUnread=0,visualEpoch=0;
  const tweens=[],visuals=new Map(),pending=new Set(),floating=[],animationHistory=[],activeAnimations=new Map(),impacts=[],impactPool=[];
  // Fuente única de posiciones: los mismos carriles del demo Three. En
  // particular, las trampas viven detrás del campo (z 3.95), no entre las
  // unidades y los líderes.
  const layout=Object.freeze({
    leader:{x:-6.9,z:2.5},place:{x:-6.9,z:0}, deck:{x:6.9,z:4.15},grave:{x:6.9,z:1.35},
    trapZ:3.95,relicX:-2.45,enemyHandZ:-6.45,enemyHandY:.92
  });
  const sideZ=s=>s===ME?1:-1;
  const sideName=s=>s===ME?'Talesyn':'Gero';
  const sideColor=s=>s===ME?0x8ad6ff:0xffa174;
  const has=typeof G!=='undefined';
  if(!has){message.textContent='No se pudo cargar el motor del juego.';return;}

  /* --------------------------- Escena y tapete --------------------------- */
  // Es la misma configuración de dibujo del demo aprobado: render directo,
  // una sola sombra y DPR limitado.  La fidelidad visual no debe costar FPS.
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.2;
  // Las sombras de la escena son estáticas casi todo el tiempo. Actualizarlas
  // a 60 Hz para cartas planas era el gasto más caro de la mesa, así que sólo
  // se regeneran al cambiar la atmósfera o mientras el d20 está en movimiento.
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=true;
  let shadowDirty=true;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x07050a);scene.fog=new THREE.FogExp2(0x07050a,.028);
  const camera=new THREE.PerspectiveCamera(38,1,.1,120);camera.position.set(0,13.6,20.3);camera.lookAt(0,0,.4);scene.add(camera);
  const cameraTarget=new THREE.Vector3(0,0,.4),view={zoom:1,target:1,shake:0};
  const table=new THREE.Group();scene.add(table);
  const hemi=new THREE.HemisphereLight(0x9aa8d0,0x1a0e08,.20);scene.add(hemi);
  const lamp=new THREE.SpotLight(0xffd6a0,640,0,.62,.6,2);lamp.position.set(0,13,3.5);lamp.target.position.set(0,0,.3);lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.near=1;lamp.shadow.camera.far=32;lamp.shadow.bias=-.0003;lamp.shadow.normalBias=.02;lamp.shadow.radius=1;lamp.shadow.blurSamples=1;scene.add(lamp,lamp.target);
  const rim=new THREE.DirectionalLight(0x8fa8ff,.7);rim.position.set(-6,7,-10);scene.add(rim);
  // Luz de lectura idéntica a la del demo: clara, pero no lavada.
  const handLight=new THREE.PointLight(0xfff0dc,82,12,2);handLight.position.set(-4.5,3.8,-3.3);camera.add(handLight);
  const handFill=new THREE.PointLight(0xc6d5ff,24,11,2);handFill.position.set(3.8,1.8,-3.7);camera.add(handFill);
  const envScene=new THREE.Scene();envScene.background=new THREE.Color(0x060407);
  const envPanel=(w,h,color,intensity,pos)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));p.position.set(...pos);p.lookAt(0,0,0);envScene.add(p);};
  envPanel(5,5,0xffd29a,5,[0,9,1]);envPanel(4,3,0x9fb8ff,2.5,[-2,3,-9]);envPanel(8,2,0xff9a50,1.2,[0,1,9]);envPanel(2,6,0xffc080,1.4,[9,2,0]);
  scene.environment=new THREE.PMREMGenerator(renderer).fromScene(envScene,.03).texture;scene.environmentIntensity=.8;
  function canvasTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}

  // Bloque de mesa del demo Three, compartido literalmente en material, relieve,
  // posiciones y luces. La capa de combate sólo conecta sus zonas al motor real.
  const canvasPair=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];};
  let visualSeed=7;const visualRandom=()=>(visualSeed=(visualSeed*16807)%2147483647)/2147483647;
  const tableTexture=(c,srgb,repeat)=>{const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);}return t;};
  function normalFromHeight(height,strength){const w=height.width,h=height.height,data=height.getContext('2d').getImageData(0,0,w,h).data,[c,g]=canvasPair(w,h),out=g.createImageData(w,h),at=(x,y)=>data[(((y+h)%h)*w+((x+w)%w))*4]/255;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(at(x+1,y)-at(x-1,y))*strength,dy=(at(x,y+1)-at(x,y-1))*strength,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;out.data[i]=(-dx/l*.5+.5)*255;out.data[i+1]=(dy/l*.5+.5)*255;out.data[i+2]=(1/l*.5+.5)*255;out.data[i+3]=255;}
    g.putImageData(out,0,0);return c;
  }
  function demoWood(){const [c,g]=canvasPair(1024,1024),[height,gh]=canvasPair(1024,1024);g.fillStyle='#3a2014';g.fillRect(0,0,1024,1024);gh.fillStyle='#808080';gh.fillRect(0,0,1024,1024);
    for(let i=0;i<260;i++){const y=visualRandom()*1024,offset=(visualRandom()-.5)*40,col=visualRandom();g.strokeStyle=`rgba(${col<.5?20:90},${col<.5?10:50},${col<.5?5:28},${.15+visualRandom()*.35})`;g.lineWidth=1+visualRandom()*5;gh.strokeStyle=`rgba(${col<.5?60:170},0,0,.5)`;gh.lineWidth=g.lineWidth;
      for(const ctx of [g,gh]){ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=1024;x+=32)ctx.lineTo(x,y+Math.sin(x*.006+i)*offset+Math.sin(x*.02+i*3)*3);ctx.stroke();}}
    return {map:tableTexture(c,true,[2,1.4]),normalMap:tableTexture(normalFromHeight(height,2),false,[2,1.4])};
  }
  const TABLE_SIZE=[18,12.6];
  function demoMat(logo){
    const W=2048,H=Math.round(W*TABLE_SIZE[1]/TABLE_SIZE[0]),[c,g]=canvasPair(W,H),[height,gh]=canvasPair(W,H),[emissive,ge]=canvasPair(W,H),k=W/TABLE_SIZE[0],point=(x,z)=>[W/2+x*k,H/2+z*k];
    const gradient=g.createRadialGradient(W/2,H/2,H*.1,W/2,H/2,W*.62);gradient.addColorStop(0,'#2c1a52');gradient.addColorStop(1,'#110826');g.fillStyle=gradient;g.fillRect(0,0,W,H);gh.fillStyle='#606060';gh.fillRect(0,0,W,H);ge.fillStyle='#000';ge.fillRect(0,0,W,H);
    for(let i=0;i<9000;i++){const x=visualRandom()*W,y=visualRandom()*H,r=visualRandom()*2.4;g.fillStyle=`rgba(0,0,0,${visualRandom()*.25})`;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();gh.fillStyle=`rgba(40,40,40,${visualRandom()*.5})`;gh.beginPath();gh.arc(x,y,r,0,TAU);gh.fill();}
    const gold=(width,shine=1)=>{g.strokeStyle=`rgba(${Math.round(220*shine)},${Math.round(170*shine)},${Math.round(80*shine)},.95)`;g.lineWidth=width;gh.strokeStyle='#e0e0e0';gh.lineWidth=width*1.6;};
    const rect=(x,z,w,h,r)=>{const [x0,y0]=point(x-w/2,z-h/2);for(const ctx of [g,gh]){ctx.beginPath();ctx.roundRect(x0,y0,w*k,h*k,r*k);ctx.stroke();}};
    gold(6);rect(0,0,TABLE_SIZE[0]-.5,TABLE_SIZE[1]-.5,.5);gold(2.5,.8);rect(0,0,TABLE_SIZE[0]-.8,TABLE_SIZE[1]-.8,.4);
    const frame=(x,z,w,h,rune)=>{gold(3,.85);rect(x,z,w,h,.12);if(rune){const [cx,cy]=point(x,z);ge.strokeStyle='#ffb04a';ge.lineWidth=3;ge.beginPath();ge.arc(cx,cy,Math.min(w,h)*k*.28,0,TAU);ge.stroke();for(let i=0;i<6;i++){const a=i*TAU/6;ge.beginPath();ge.moveTo(cx+Math.cos(a)*Math.min(w,h)*k*.18,cy+Math.sin(a)*Math.min(w,h)*k*.18);ge.lineTo(cx+Math.cos(a)*Math.min(w,h)*k*.34,cy+Math.sin(a)*Math.min(w,h)*k*.34);ge.stroke();}}};
    const cw=ANCHO*ESC+.16,ch=ALTO*ESC+.16,tw=ALTO*ESC*.8+.16,th=ANCHO*ESC*.8+.16;
    for(const s of [ME,FOE]){const side=sideZ(s);for(let i=0;i<5;i++)frame((i-2)*2,side*1.55,cw,ch,true);for(let i=0;i<3;i++)frame((i-1)*2.15,side*layout.trapZ,tw,th,false);frame(layout.leader.x,side*layout.leader.z,cw*1.15,ch*1.15,true);frame(layout.deck.x,side*layout.deck.z,cw,ch,false);frame(layout.grave.x,side*layout.grave.z,cw,ch,false);frame(layout.relicX,side*5.48,1.08,.72,false);}frame(layout.place.x,layout.place.z,ANCHO*ESC*.82+.16,ALTO*ESC*.82+.16,true);
    ge.strokeStyle='#ffb04a';ge.lineWidth=4;ge.beginPath();ge.moveTo(point(-7.6,0)[0],H/2);ge.lineTo(point(7.6,0)[0],H/2);ge.stroke();ge.font=`${Math.round(k*.3)}px Georgia`;ge.fillStyle='#ffb04a';ge.textAlign='center';const runes='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';for(let i=0;i<36;i++){const x=-7.2+i*.41;if(Math.abs(x)<1.3)continue;ge.fillText(runes[i%runes.length],point(x,0)[0],H/2-k*.12);}
    if(logo?.naturalWidth){const lw=k*3,lh=lw*logo.naturalHeight/logo.naturalWidth;g.globalAlpha=.22;g.drawImage(logo,W/2-lw/2,H/2-lh/2,lw,lh);g.globalAlpha=1;gh.globalAlpha=.5;gh.filter='grayscale(1)';gh.drawImage(logo,W/2-lw/2,H/2-lh/2,lw,lh);gh.filter='none';gh.globalAlpha=1;}
    g.drawImage(emissive,0,0);const [orm,go]=canvasPair(W,H);go.fillStyle='rgb(255,200,0)';go.fillRect(0,0,W,H);go.drawImage(height,0,0);const data=go.getImageData(0,0,W,H);for(let i=0;i<data.data.length;i+=4){const v=data.data[i]/255,metal=Math.max(0,(v-.7)/.3);data.data[i]=255;data.data[i+1]=Math.round((.75-.45*metal)*255);data.data[i+2]=Math.round(metal*255);}go.putImageData(data,0,0);
    return {map:tableTexture(c,true),normalMap:tableTexture(normalFromHeight(height,3)),roughnessMap:tableTexture(orm),metalnessMap:tableTexture(orm),emissiveMap:tableTexture(emissive,true)};
  }
  const matWood=new THREE.MeshPhysicalMaterial({roughness:.42,clearcoat:.5,clearcoatRoughness:.25});
  const slab=new THREE.Mesh(new THREE.BoxGeometry(24,.6,17),matWood);slab.position.y=-.3;slab.receiveShadow=true;table.add(slab);
  const matFelt=new THREE.MeshPhysicalMaterial({roughness:1,metalness:1,emissive:new THREE.Color(0xffa040),emissiveIntensity:.6,sheen:.4,sheenColor:new THREE.Color(0x8a6ab0),sheenRoughness:.6});
  const felt=new THREE.Mesh(new THREE.PlaneGeometry(...TABLE_SIZE),matFelt);felt.rotation.x=-Math.PI/2;felt.position.y=.003;felt.receiveShadow=true;table.add(felt);
  async function skinLikeDemo(){
    const logo=await image('./art/logo.webp');
    // El reverso canónico conserva el logo, el relieve y las capas de metal
    // de la prueba Three; la partida no debe sustituirlo por una textura plana.
    back=factory.materialDorso(CAOZ_CARTA_PINTOR.dorso(logo));
    Object.assign(matFelt,demoMat(logo));matFelt.needsUpdate=true;
    Object.assign(matWood,demoWood());matWood.needsUpdate=true;
  }

  const FLAME_V='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const FLAME_F='uniform float uT,uSeed;varying vec2 vUv;void main(){vec2 p=vUv-vec2(.5,.18);float t=uT*7.+uSeed;p.x+=sin(p.y*9.+t)*.04*p.y*3.;float shape=1.-smoothstep(.0,.2,length(p*vec2(2.8,1.)-vec2(0.,.2))-.12*(1.-p.y*1.6));float n=shape*smoothstep(.95,.1,vUv.y);vec3 c=mix(vec3(1.,.35,.05),vec3(1.,.95,.7),n*n);gl_FragColor=vec4(c*n*2.2,1.);}';
  const flameClock={value:0},candles=[];
  for(const [x,z] of [[-9.4,-5.9],[9.4,-5.9]]){const g=new THREE.Group();g.position.set(x,0,z);table.add(g);const brass=new THREE.MeshPhysicalMaterial({color:0xd9a94f,metalness:1,roughness:.28});const holder=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,.12,48),brass);holder.position.y=.06;holder.castShadow=holder.receiveShadow=true;g.add(holder);const wax=new THREE.Mesh(new THREE.CylinderGeometry(.34,.36,2.6,40),new THREE.MeshPhysicalMaterial({color:0xf3e6c8,roughness:.55,transmission:.35,thickness:.6,sheen:.5,sheenColor:new THREE.Color(0xffd9a0)}));wax.position.y=1.42;wax.castShadow=true;g.add(wax);const flame=new THREE.Mesh(new THREE.PlaneGeometry(.55,1.1),new THREE.ShaderMaterial({vertexShader:FLAME_V,fragmentShader:FLAME_F,uniforms:{uT:flameClock,uSeed:{value:x}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));flame.position.y=3.05;g.add(flame);const light=new THREE.PointLight(0xff9a45,26,18,2);light.position.y=3.1;light.castShadow=false;g.add(light);candles.push({g,flame,light,x});}

  /* ------------------------ Cartas físicas y recursos --------------------- */
  const factory=Carta.fabrica(THREE,renderer),textures=new Map();
  // Se prepara junto con el tapete, una vez que fuentes y logo están listos.
  // boot() no sincroniza ninguna carta antes de ese punto.
  let back=null;
  /*
    Identidad visual y puestos físicos
    ---------------------------------
    El motor sólo guarda un arreglo de unidades.  Nunca le añadimos estado de
    presentación: esta capa les asigna un puesto estable por uid.  Así una
    baja no corre todas las cartas, y los cinco diales grabados del tapete
    siguen siendo la referencia visual de ambos jugadores.
  */
  const FIELD_ORDER=Object.freeze([2,1,3,0,4]);
  const fieldSlots=[new Map(),new Map()],handTokens=[[],[]],dropHints=[[],[]];
  const handHitRoot=new THREE.Group();camera.add(handHitRoot);
  const tableHitRoot=new THREE.Group();table.add(tableHitRoot);
  const handHits=new Map(),tableHits=new Map(),visualWaiters=new Map(),desiredByKey=new Map(),pendingEntries=new Map();
  const spentVisuals=[[],[]],graveGhosts=[null,null];
  let nextHandToken=1,hoverHand=null,hoverTable=null,hoverPreview=null,hoverUV=new THREE.Vector2(.5,.5),gesture=null,drag=null,tablePreview=null,tablePreviewKey=null,tablePreviewEpoch=0;
  const handWorkPos=new THREE.Vector3(),handWorkRot=new THREE.Euler(),handWorkQuat=new THREE.Quaternion(),candleLookAt=new THREE.Vector3();
  const hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
  const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  function reconcileFieldSlots(){
    if(!G)return;
    for(const s of [ME,FOE]){
      const slots=fieldSlots[s],units=P(s).field,ids=new Set(units.map(u=>u.uid));
      for(const uid of [...slots.keys()])if(!ids.has(uid))slots.delete(uid);
      for(const u of units)if(!slots.has(u.uid)){
        const hintAt=dropHints[s].findIndex(h=>h.id===u.card.id),hint=hintAt<0?null:dropHints[s].splice(hintAt,1)[0]?.slot;
        const used=new Set(slots.values()),slot=hint!=null&&!used.has(hint)?hint:FIELD_ORDER.find(n=>!used.has(n));
        slots.set(u.uid,slot==null?FIELD_ORDER[0]:slot);
      }
    }
  }
  function fieldSlot(s,u){return fieldSlots[s].get(u?.uid)??2;}
  const cardPos=(s,u)=>new THREE.Vector3((fieldSlot(s,u)-2)*2,ALTURA,sideZ(s)*1.55);
  function reconcileHandTokens(s,ids){
    const pools=new Map();for(const token of handTokens[s]){const list=pools.get(token.id)||[];list.push(token);pools.set(token.id,list);}
    handTokens[s]=ids.map(id=>{const old=pools.get(id)?.shift();return old||{id,serial:nextHandToken++};});
    return handTokens[s];
  }
  function fieldCenter(s,u){return cardPos(s,u);}
  // Señales de arrastre: se superponen a las dianas ya grabadas, sólo mientras
  // una carta busca un puesto libre. Nunca sustituyen el tapete ni su runería.
  const dragMarks=FIELD_ORDER.map(slot=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO*ESC+.1,ALTO*ESC+.12),new THREE.MeshBasicMaterial({color:0xffd06a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set((slot-2)*2,.026,sideZ(ME)*1.55);m.visible=false;table.add(m);return {slot,m};});
  const trapPos=(s,i)=>new THREE.Vector3((i-1)*2.15,ALTURA,sideZ(s)*layout.trapZ);
  const deckPos=s=>new THREE.Vector3(layout.deck.x,ALTURA,sideZ(s)*layout.deck.z);
  const gravePos=s=>new THREE.Vector3(layout.grave.x,ALTURA,sideZ(s)*layout.grave.z);
  const leaderPos=s=>new THREE.Vector3(layout.leader.x,ALTURA+.012,sideZ(s)*layout.leader.z);
  const placePos=()=>new THREE.Vector3(layout.place.x,ALTURA,layout.place.z);
  function editionFor(id){
    if(id==='tal'||id==='lider_talesin'||id==='lider_gero')return 'dorado';
    // El TCG ya representa r:2 como foil. Respetarlo aquí recupera la laca e
    // iridiscencia de la prueba sin inventar una rareza ni tocar una regla.
    return CARDS[id]?.r===2?'foil':'normal';
  }
  function image(url){return new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url;});}
  async function textureFor(id,edition='normal'){
    const key=id+'/'+edition;if(textures.has(key))return textures.get(key);
    const entry=(typeof ARTE!=='undefined'&&ARTE[id])||{};const variation=edition!=='normal'?entry.variantes?.[edition]:null;const url=variation?.url||entry.url||'art/'+id+'.webp';const img=await image('./'+url);
    // La prueba aprobada pinta a 640 px. A 560 px se perdía definición justo
    // en nombres, texto y detalles de la ilustración.
    const tx=factory.texturas(CAOZ_CARTA_PINTOR.texturas({id,acabado:edition,arte:{img,enc:{x:variation?.x??entry.x??50,y:variation?.y??entry.y??50,z:variation?.z??100}},ancho:640,cifras:false}));textures.set(key,tx);return tx;
  }
  function digit(n,color,label=''){const tex=canvasTexture(128,128,(g,w,h)=>paintDigitCanvas(g,w,h,n,color,label)),m=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthWrite:false}));m.userData.tex=tex;m.raycast=()=>{};return m;}
  function paintDigitCanvas(g,w,h,n,color,label=''){g.clearRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';if(label){g.font="900 23px 'Cinzel Domo',Georgia,serif";g.lineWidth=5;g.strokeStyle='#180d0a';g.strokeText(label,w/2,23);g.fillStyle='#ffe5a0';g.fillText(label,w/2,23);g.font="900 70px 'Cinzel Domo',Georgia,serif";g.lineWidth=11;g.strokeStyle='#1a0f0a';g.strokeText(String(n),w/2,76);g.fillStyle=color;g.fillText(String(n),w/2,76);return;}g.font="900 78px 'Cinzel Domo',Georgia,serif";g.lineWidth=12;g.strokeStyle='#1a0f0a';g.strokeText(String(n),w/2,h/2+6);g.fillStyle=color;g.fillText(String(n),w/2,h/2+6);}
  function putGem(mesh,[x,y,r]){mesh.position.set((x/1024-.5)*ANCHO,(.5-y/1434)*ALTO,GROSOR/2+.004);mesh.scale.setScalar(r/1024*ANCHO*.78);mesh.userData.baseScale=mesh.scale.x;return mesh;}
  function paintDigit(mesh,n,color,label=''){const c=mesh.userData.tex.image,g=c.getContext('2d');paintDigitCanvas(g,c.width,c.height,n,color,label);mesh.userData.tex.needsUpdate=true;}
  function setFieldStats(card,on){for(const [key,label] of [['a','ATQ'],['h','VIDA']]){const mesh=card?.userData?.[key];if(!mesh)continue;const base=mesh.userData.baseScale||mesh.scale.x;mesh.scale.setScalar(base*(on?1.72:1));mesh.userData.fieldLabel=on?label:'';}}
  function soulBadge(side){
    const tex=canvasTexture(256,256,(g,w,h)=>paintSoulBadgeCanvas(g,w,h,0,side)),material=new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthWrite:false}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(.52,.52),material);
    // Usa la esquina de VIDA de la plantilla: es un hueco visual ya previsto
    // por la carta y no tapa arte, reglas ni el pie del protagonista.
    mesh.position.set((GEMAS.vida[0]/1024-.5)*ANCHO,(.5-GEMAS.vida[1]/1434)*ALTO,GROSOR/2+.016);mesh.renderOrder=4;mesh.userData.tex=tex;mesh.userData.side=side;mesh.raycast=()=>{};return mesh;
  }
  function paintSoulBadgeCanvas(g,w,h,alma,side){
    g.clearRect(0,0,w,h);const accent=side===ME?'#66cfff':'#ff967c',edge=side===ME?'#c8eeff':'#ffd0bd',bg=g.createRadialGradient(w*.34,h*.24,3,w*.5,h*.5,w*.52);bg.addColorStop(0,side===ME?'rgba(28,92,138,.98)':'rgba(131,42,53,.98)');bg.addColorStop(1,'rgba(12,8,18,.98)');g.fillStyle=bg;g.beginPath();g.arc(w/2,h/2,w*.47,0,TAU);g.fill();g.lineWidth=10;g.strokeStyle=accent;g.stroke();g.font="800 31px 'Cinzel Domo',Georgia,serif";g.textAlign='center';g.textBaseline='middle';g.fillStyle=edge;g.fillText('ALMA',w/2,61);g.font="900 112px 'Cinzel Domo',Georgia,serif";g.lineWidth=11;g.strokeStyle='#09050a';g.strokeText(String(Math.max(0,alma)),w/2,156);g.fillStyle='#fff1d5';g.fillText(String(Math.max(0,alma)),w/2,156);
  }
  function paintSoulBadge(mesh,alma){if(!mesh)return;const c=mesh.userData.tex.image,g=c.getContext('2d');paintSoulBadgeCanvas(g,c.width,c.height,alma,mesh.userData.side);mesh.userData.tex.needsUpdate=true;}
  async function makeCard(key,id,opt={}){
    const epoch=opt.epoch??visualEpoch,ed=opt.edition||editionFor(id),tx=opt.back?null:await textureFor(id,ed);if(epoch!==visualEpoch||!wantedKeys.has(key))return null;
    const face=opt.back?back:factory.materialCara(tx,ed),card=factory.carta(face,back,factory.materialCanto(ed));card.scale.setScalar(opt.scale||ESC);card.userData.key=key;card.userData.id=id;card.userData.kind=opt.kind;card.userData.side=opt.side;card.userData.unit=opt.unit||null;card.userData.base=new THREE.Vector3();card.userData.edition=ed;
    if(!opt.back&&CARDS[id]?.t==='personaje'){
      const a=putGem(digit(opt.unit?.atk??CARDS[id].a??0,'#fff1d8'),GEMAS.atq),h=putGem(digit(Math.max(0,(opt.unit?.maxHp??CARDS[id].h??0)-(opt.unit?.dmg??0)),'#fff1d8'),GEMAS.vida);card.add(a,h);card.userData.a=a;card.userData.h=h;
      setFieldStats(card,opt.kind==='field');
    }
    if(!opt.back&&CARDS[id]){const c=putGem(digit(opt.cost??CARDS[id].c,'#f6edff'),GEMAS.coste);card.add(c);card.userData.c=c;}
    if(!opt.back&&opt.kind==='leader'){const badge=soulBadge(opt.side);card.add(badge);card.userData.soulBadge=badge;}
    // El tapete conserva la sombra de lámpara; las cartas, muy delgadas, no
    // necesitan volver a dibujar su propia sombra en cada frame. Esto evita
    // la mayor parte del coste GPU sin cambiar su lectura ni sus materiales.
    card.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    table.add(card);visuals.set(key,card);return card;
  }
  const wantedKeys=new Set();
  function wakeVisual(key,v){const waiters=visualWaiters.get(key);if(waiters){visualWaiters.delete(key);waiters.forEach(resolve=>resolve(v));}}
  function waitVisual(key,timeout=1800){
    const here=visuals.get(key);if(here)return Promise.resolve(here);
    sync();return new Promise(resolve=>{const timer=setTimeout(()=>resolve(visuals.get(key)||null),timeout),list=visualWaiters.get(key)||[];list.push(v=>{clearTimeout(timer);resolve(v);});visualWaiters.set(key,list);});
  }
  function motion(v,name,run){
    if(!v)return Promise.resolve();const token=(v.userData.motionToken||0)+1,started=performance.now();v.userData.motionToken=token;v.userData.motion=name;activeAnimations.set(v.uuid,{tipo:name,etapa:'activa',key:v.userData.key,started});
    animationHistory.push({tipo:name,etapa:'entrada',key:v.userData.key,orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();
    const promise=Promise.resolve(run());v.userData.motionPromise=promise;
    return promise.finally(()=>{activeAnimations.delete(v.uuid);if(v.userData.motionToken===token){v.userData.motion=null;v.userData.motionPromise=null;}animationHistory.push({tipo:name,etapa:'fin',key:v.userData.key,duracionMs:Math.round(performance.now()-started),orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();});
  }
  function waitMotion(v){return v?.userData.motionPromise||Promise.resolve();}
  function poseWorld(v){v.updateMatrixWorld(true);return {pos:v.getWorldPosition(new THREE.Vector3()),q:v.getWorldQuaternion(new THREE.Quaternion()),scale:v.getWorldScale(new THREE.Vector3()).x};}
  function placeWorld(v,p){if(v.parent!==table)table.attach(v);v.position.copy(p.pos);v.quaternion.copy(p.q);v.scale.setScalar(p.scale);}
  function flyCard(v,to,rot,seconds=.52,arc=1.25,scale=ESC,name='vuelo'){
    const from=v.position.clone(),q0=v.quaternion.clone(),q1=new THREE.Quaternion().setFromEuler(rot),s0=v.scale.x;
    return motion(v,name,()=>tween(seconds,k=>{const e=ease(k);v.position.lerpVectors(from,to,e);v.position.y+=Math.sin(Math.PI*e)*arc;v.quaternion.slerpQuaternions(q0,q1,e);v.scale.setScalar(THREE.MathUtils.lerp(s0,scale,e));}));
  }
  function setDissolve(v,n){const u=v?.userData?.frente?.material?.userData?.u;if(u?.uDisuelve)u.uDisuelve.value=Math.max(0,Math.min(1,n));}
  function setCardPose(card,pos,rot,scale=ESC){card.position.copy(pos);card.rotation.copy(rot);card.scale.setScalar(scale);card.userData.base.copy(pos);}
  function rotateCard(card,kind){if(kind==='hand')return new THREE.Euler(0,0,0);return new THREE.Euler(-Math.PI/2,0,0);}
  // Material de lectura de la mano, copiado del demo. El material original se
  // conserva y se restaura cuando una carta abandona la mano; de otro modo una
  // carta invocada terminaba sobreexpuesta también sobre el tapete.
  function setHandRead(card,on){
    const m=card?.userData?.frente?.material;if(!m)return;
    let saved=m.userData.lecturaMano;
    if(!saved){saved={envMap:m.envMap,envMapIntensity:m.envMapIntensity,clearcoat:m.clearcoat,emissiveMap:m.emissiveMap,emissive:m.emissive?.clone?.()||new THREE.Color(),emissiveIntensity:m.emissiveIntensity};m.userData.lecturaMano=saved;}
    if(on){m.envMap=scene.environment;m.envMapIntensity=.68;m.clearcoat=Math.min(.16,(saved.clearcoat||0)*.25);m.emissiveMap=m.map;m.emissive=(m.emissive||new THREE.Color());m.emissive.setHex(0x584832);m.emissiveIntensity=.30;}
    else {m.envMap=saved.envMap;m.envMapIntensity=saved.envMapIntensity;m.clearcoat=saved.clearcoat;m.emissiveMap=saved.emissiveMap;m.emissive=(m.emissive||new THREE.Color());m.emissive.copy(saved.emissive);m.emissiveIntensity=saved.emissiveIntensity;}
    for(const part of [card.userData.frente,card.userData.atras,card.userData.borde])if(part){part.castShadow=false;part.receiveShadow=false;}
    m.needsUpdate=true;
  }
  function liveCard(card,u){if(!card||!u)return;card.userData.unit=u;setFieldStats(card,true);if(card.userData.a)paintDigit(card.userData.a,u.atk,u.atk>(u.card.a||0)?'#9effb1':'#fff1d8',card.userData.a.userData.fieldLabel||'');if(card.userData.h)paintDigit(card.userData.h,Math.max(0,u.maxHp-u.dmg),u.dmg?'#ff9e90':'#fff1d8',card.userData.h.userData.fieldLabel||'');const material=card.userData.frente.material;material.emissive=material.emissive||new THREE.Color();let glow=0;if(TGT&&isTargetable(u))glow=0x356040;else if(selected===u)glow=0x5a4210;material.emissive.setHex(glow);material.emissiveIntensity=glow?.55:0;}
  function genericBack(key,side,index,zone='deck'){return {key,id:'conserje',back:true,side,index,kind:zone,scale:zone==='enemyHand'?.67:ESC};}

  /* --------------------------- Sincronizar motor --------------------------- */
  function desired(){
    if(!G)return [];reconcileFieldSlots();const out=[];
    for(const s of [ME,FOE]){
      const p=P(s),sign=sideZ(s);out.push({key:'leader:'+s,id:'lider_'+p.leaderId,side:s,kind:'leader',scale:ESC*1.1,pos:leaderPos(s),rot:new THREE.Euler(-Math.PI/2,0,0)});
      p.field.forEach(u=>out.push({key:'unit:'+u.uid,id:u.card.id,side:s,unit:u,kind:'field',slot:fieldSlot(s,u),pos:cardPos(s,u),rot:new THREE.Euler(-Math.PI/2,0,0)}));
      p.traps.forEach((t,i)=>out.push({key:'trap:'+s+':'+i,id:t.id,side:s,kind:'trap',back:s===FOE,pos:trapPos(s,i),rot:new THREE.Euler(-Math.PI/2+(s===FOE?Math.PI:0),0,Math.PI/2),scale:ESC*.78}));
      p.relics.forEach((r,i)=>out.push({key:'relic:'+s+':'+i,id:r.id,side:s,kind:'relic',pos:new THREE.Vector3(layout.relicX+i*1.48,ALTURA,sign*4.9),rot:new THREE.Euler(-Math.PI/2,0,0),scale:ESC*.66}));
      // Talesyn ve el dorso de su mazo; Gero lo ve desde el lado opuesto. La
      // orientación anterior invertía ambos dorsos y hacía que nuestro mazo
      // pareciera una carta boca arriba colocada al revés.
      if(p.deck.length)out.push({key:'deck:'+s,id:'conserje',side:s,kind:'deck',back:true,pos:deckPos(s),rot:new THREE.Euler(-Math.PI/2+(s===FOE?Math.PI:0),0,s===ME?-.035:.035),scale:ESC});
      if(p.grave.length){const id=p.grave.at(-1);out.push({key:'grave:'+s,id,side:s,kind:'grave',pos:gravePos(s),rot:new THREE.Euler(-Math.PI/2,0,-.05),scale:ESC*.94});}
    }
    if(G.place)out.push({key:'place',id:G.place.id,side:G.place.side,kind:'place',pos:placePos(),rot:new THREE.Euler(-Math.PI/2,0,0),scale:ESC*.82});
    const own=reconcileHandTokens(ME,P(ME).hand);own.forEach((token,i)=>out.push({key:'hand:'+token.serial,id:token.id,side:ME,kind:'hand',handIndex:i,token}));
    const enemy=reconcileHandTokens(FOE,P(FOE).hand);enemy.forEach((token,i)=>out.push({key:'enemy-hand:'+token.serial,id:token.id,side:FOE,kind:'enemyHand',back:true,handIndex:i,token,scale:.76}));
    return out;
  }
  // Mismo abanico, profundidad y orden de solape de la mesa Three aprobada.
  // Las ranuras son siempre del tamaño completo de la carta: no cambian cuando
  // una carta se amplía y no dejan franjas muertas entre los naipes.
  function handPose(i,n){
    const k=i-(n-1)/2,portrait=camera.aspect<.9,z=portrait?-9.35:-7.55,y=portrait?-3.45:-2.15;
    // La esquina de coste vive muy a la derecha de cada carta. 1.12 unidades
    // deja la cifra libre en escritorio; sólo compactamos cuando la mano ya
    // no cabe en la cámara. El orden de profundidad se invierte para que una
    // carta de la derecha nunca tape el coste de la que queda a su izquierda.
    const hh=Math.tan(camera.fov*Math.PI/360)*-z,ww=hh*camera.aspect,wanted=portrait?.72:1.12,min=portrait?.48:.78,available=ww*1.78;
    const sep=n>1?Math.max(min,Math.min(wanted,(available-ANCHO*HAND_SCALE)/(n-1))):wanted;
    return {pos:new THREE.Vector3(k*sep,y-Math.abs(k)*.055,z-i*.012),rot:new THREE.Euler(-.12,0,-k*.08),scale:HAND_SCALE};
  }
  function enemyHandPose(i,n){const k=i-(n-1)/2,portrait=camera.aspect<.9,scale=.76*(portrait?.72:1),step=ANCHO*scale+.1;return {pos:new THREE.Vector3(1+k*step,layout.enemyHandY+i*.025,layout.enemyHandZ+i*.04),rot:new THREE.Euler(-1.1,Math.PI,k*.035),scale};}
  function makeHitSlot(d,p){
    let slot=handHits.get(d.key);if(!slot){slot=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO,ALTO),hitMaterial);slot.userData.key=d.key;handHitRoot.add(slot);handHits.set(d.key,slot);}
    slot.visible=true;slot.userData.id=d.id;slot.userData.index=d.handIndex;slot.position.copy(p.pos);slot.rotation.copy(p.rot);slot.scale.setScalar(p.scale);return slot;
  }
  function updateHandHitSlots(list){
    const active=new Set();for(const d of list)if(d.kind==='hand'){active.add(d.key);makeHitSlot(d,handPose(d.handIndex,P(ME).hand.length));}
    for(const [key,slot] of handHits)if(!active.has(key)){slot.visible=false;handHits.delete(key);slot.removeFromParent();}
  }
  // Los proxies de mesa se quedan donde está la carta aunque aparezca su
  // ampliación. Es la misma solución que elimina las zonas muertas de la mano.
  function canInspectOnTable(d){return ['field','leader','place','relic','grave'].includes(d.kind)||(d.kind==='trap'&&d.side===ME&&!d.back);}
  function makeTableHit(d){
    let slot=tableHits.get(d.key);if(!slot){slot=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO,ALTO),hitMaterial);slot.userData.key=d.key;tableHitRoot.add(slot);tableHits.set(d.key,slot);}
    slot.visible=true;slot.userData.id=d.id;slot.userData.kind=d.kind;slot.userData.side=d.side;slot.position.copy(d.pos).add(new THREE.Vector3(0,.018,0));slot.rotation.copy(d.rot);slot.scale.setScalar(d.scale||ESC);return slot;
  }
  function updateTableHitSlots(list){
    const active=new Set();for(const d of list)if(canInspectOnTable(d)){active.add(d.key);makeTableHit(d);}
    for(const [key,slot] of tableHits)if(!active.has(key)){slot.visible=false;tableHits.delete(key);slot.removeFromParent();}
  }
  function takeOutgoing(side,id,kind){
    const candidates=[...visuals.entries()].filter(([key,v])=>v.userData.side===side&&v.userData.kind===kind&&!wantedKeys.has(key)&&v.userData.id===id);
    const pair=candidates[0];if(pair){const [key,v]=pair;return {key,v,pose:poseWorld(v),kind,stored:false};}
    // El motor actualiza primero la mano y después el campo. Conservamos la
    // última carta retirada para que no nazca mágicamente desde el mazo un
    // frame después: ésta es la misma continuidad visual que usaba el demo.
    const pile=spentVisuals[side],i=pile.map(x=>x.id===id&&x.kind===kind).lastIndexOf(true);
    if(i<0)return null;const spent=pile.splice(i,1)[0];return {...spent,stored:true};
  }
  function adoptVisual(from,d,entry){
    visuals.delete(from.key);from.v.userData.key=d.key;from.v.userData.id=d.id;from.v.userData.kind=d.kind;from.v.userData.side=d.side;from.v.userData.unit=d.unit||null;visuals.set(d.key,from.v);pendingEntries.set(d.key,{...entry,source:entry.source||from.pose});
  }
  function prepareTransitions(list){
    for(const d of list)if(d.kind==='field'&&!visuals.has(d.key)&&!pendingEntries.has(d.key)){
      let from=takeOutgoing(d.side,d.id,'hand');
      if(from){adoptVisual(from,d,{type:'entrada',source:from.pose});continue;}
      if(d.side===FOE){from=takeOutgoing(FOE,d.id,'enemyHand');if(from){
        // Un dorso rival no puede convertirse en el frente de una carta por
        // arte de magia. Retenemos su pose como origen y dejamos que la nueva
        // cara se revele mientras gira hacia su diana.
        from.v.removeFromParent();visuals.delete(from.key);pendingEntries.set(d.key,{type:'entrada-rival',source:from.pose});continue;
      }}
      pendingEntries.set(d.key,{type:'invocacion',source:{pos:deckPos(d.side).add(new THREE.Vector3(0,.35,0)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+Math.PI,0,0)),scale:ESC*.72}});
    }
    for(const d of list)if(d.kind==='place'&&!visuals.has(d.key)&&!pendingEntries.has(d.key)){
      const from=takeOutgoing(d.side,d.id,'hand');
      if(from){adoptVisual(from,d,{type:'entrada',source:from.pose});continue;}
      pendingEntries.set(d.key,{type:'invocacion',source:{pos:deckPos(d.side).add(new THREE.Vector3(0,.35,0)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+Math.PI,0,0)),scale:ESC*.72}});
    }
    for(const d of list)if(d.kind==='grave'&&!visuals.has(d.key)){
      const ghost=graveGhosts[d.side];if(ghost&&ghost.id===d.id){graveGhosts[d.side]=null;ghost.v.userData.key=d.key;ghost.v.userData.kind='grave';ghost.v.userData.side=d.side;visuals.set(d.key,ghost.v);pendingEntries.set(d.key,{type:'cementerio',source:ghost.pose});}
    }
  }
  function spendDepartures(){
    for(const [key,v] of [...visuals])if(!wantedKeys.has(key)&&!v.userData.dying&&!v.userData.motion){
      if(v.userData.kind==='hand'||v.userData.kind==='enemyHand')spentVisuals[v.userData.side].push({id:v.userData.id,kind:v.userData.kind,back:v.userData.kind==='enemyHand',v,pose:poseWorld(v)});
      v.removeFromParent();visuals.delete(key);
    }
  }
  function beginEntry(v,d,entry){
    if(!entry||v.userData.motion)return;placeWorld(v,entry.source);v.userData.base.copy(d.pos);
    if(entry.type==='cementerio'){
      setDissolve(v,1);v.visible=true;motion(v,'materializar-cementerio',()=>tween(.42,k=>{const e=ease(k);v.position.lerpVectors(entry.source.pos,d.pos,e);v.quaternion.slerpQuaternions(entry.source.q,new THREE.Quaternion().setFromEuler(d.rot),e);v.scale.setScalar(THREE.MathUtils.lerp(entry.source.scale,d.scale||ESC*.94,e));setDissolve(v,1-e);}));
      return;
    }
    flyCard(v,d.pos.clone().add(new THREE.Vector3(0,.26,0)),d.rot,entry.type==='entrada-rival'?.62:.48,entry.type==='invocacion'?1.75:1.22,d.scale||ESC,entry.type).then(()=>{if(d.kind==='field')impact(v,d);});
  }
  function sync(){
    if(!ready||!G)return;const list=desired();wantedKeys.clear();desiredByKey.clear();list.forEach(x=>{wantedKeys.add(x.key);desiredByKey.set(x.key,x);});
    updateHandHitSlots(list);updateTableHitSlots(list);prepareTransitions(list);spendDepartures();
    for(const d of list){let v=visuals.get(d.key);if(!v&&!pending.has(d.key)){pending.add(d.key);makeCard(d.key,d.id,{...d,epoch:visualEpoch}).then(x=>{pending.delete(d.key);const fresh=desiredByKey.get(d.key);if(x&&fresh){applyVisual(x,fresh);const entry=pendingEntries.get(d.key);if(entry){pendingEntries.delete(d.key);beginEntry(x,fresh,entry);} // Avisar al motor sólo cuando la entrada ya existe.
          wakeVisual(d.key,x);
        }}).catch(e=>{pending.delete(d.key);toast('No se pudo pintar una carta: '+e.message);});}
      if(v){applyVisual(v,d);const entry=pendingEntries.get(d.key);if(entry){pendingEntries.delete(d.key);beginEntry(v,d,entry);}}
    }
    drawResources();updateHUD();
  }
  function applyVisual(v,d){
    if(!wantedKeys.has(d.key))return;
    v.userData.kind=d.kind;v.userData.side=d.side;v.userData.unit=d.unit||null;v.userData.id=d.id;
    if(d.kind==='hand'){const n=P(ME).hand.length,p=handPose(d.handIndex,n);v.userData.handPose=p;if(v.parent!==camera)camera.add(v);if(!v.userData.motion&&!v.userData.dragging)setCardPose(v,p.pos,p.rot,p.scale);setFieldStats(v,false);setHandRead(v,true);}
    else {setHandRead(v,false);setFieldStats(v,d.kind==='field');if(v.parent!==table)table.attach(v);let pos=d.pos,rot=d.rot,sc=d.scale||ESC;if(d.kind==='enemyHand'){const p=enemyHandPose(d.handIndex,P(FOE).hand.length);pos=p.pos;rot=p.rot;sc=p.scale;}if(!v.userData.motion&&!v.userData.dragging)setCardPose(v,pos,rot,sc);if(d.kind==='field')liveCard(v,d.unit);}
    if(d.kind==='deck'){const p=P(d.side);for(const ch of v.children)ch.visible=true;v.position.y=ALTURA+Math.min(15,p.deck.length)*GROSOR*ESC*.055;}
    if(d.kind==='grave')v.position.y=ALTURA+Math.min(10,P(d.side).grave.length)*GROSOR*ESC*.09;
  }

  // Una carta del tapete nunca se mueve para inspeccionarla: su lectura vive
  // abajo a la izquierda. Así la carta real conserva puesto y raycast, sin
  // invadir el campo ni el abanico de la mano.
  function disposeInspectionCard(card){
    if(!card)return;card.userData.frente?.material?.dispose?.();card.userData.atras?.material?.dispose?.();const edge=card.userData.borde?.material;if(Array.isArray(edge))edge[1]?.dispose?.();else edge?.dispose?.();for(const gem of [card.userData.a,card.userData.h,card.userData.c,card.userData.soulBadge])if(gem){gem.material?.dispose?.();gem.geometry?.dispose?.();gem.userData.tex?.dispose?.();}card.removeFromParent();
  }
  function clearTablePreview(){tablePreviewEpoch++;if(tablePreview)disposeInspectionCard(tablePreview);tablePreview=null;tablePreviewKey=null;}
  async function makeInspectionCard(source){
    const id=source.userData.id,ed=source.userData.edition||editionFor(id),tx=await textureFor(id,ed),face=factory.materialCara(tx,ed),card=factory.carta(face,back.clone(),factory.materialCanto(ed));
    card.userData.key='preview:'+source.userData.key;card.userData.id=id;card.userData.kind='preview';card.userData.side=source.userData.side;card.userData.unit=source.userData.unit||null;card.userData.base=new THREE.Vector3();card.userData.edition=ed;
    const unit=source.userData.unit;
    if(CARDS[id]?.t==='personaje'){
      const a=putGem(digit(unit?.atk??CARDS[id].a??0,'#fff1d8'),GEMAS.atq),h=putGem(digit(Math.max(0,(unit?.maxHp??CARDS[id].h??0)-(unit?.dmg??0)),'#fff1d8'),GEMAS.vida);card.add(a,h);card.userData.a=a;card.userData.h=h;
    }
    if(CARDS[id]){const c=putGem(digit(CARDS[id].c,'#f6edff'),GEMAS.coste);card.add(c);card.userData.c=c;}
    if(source.userData.kind==='leader'){const badge=soulBadge(source.userData.side);card.add(badge);card.userData.soulBadge=badge;paintSoulBadge(badge,P(source.userData.side).alma);}
    card.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.raycast=()=>{};}});setHandRead(card,true);return card;
  }
  function inspectionPose(){
    const z=camera.aspect<.9?7.15:6.85,hh=Math.tan(camera.fov*Math.PI/360)*z,ww=hh*camera.aspect,scale=Math.min(ESC*1.15,(hh*1.22)/ALTO,(ww*.80)/ANCHO),halfH=ALTO*scale*.5;
    // La lectura de la mesa queda baja y a la izquierda; esa esquina está
    // libre del tablero y deja visibles los objetivos y la mano.
    return {pos:new THREE.Vector3(-ww+ANCHO*scale*.5+.18,-hh+halfH+.18,-z),rot:new THREE.Euler(-.045,.035,.015),scale};
  }
  function setTableHover(key){
    if(hoverTable===key)return;
    hoverTable=key;
    // El hover del tapete sirve para leer. Durante una orden táctica (ataque,
    // hechizo o habilidad) se apaga para que ningún preview intercepte la
    // decisión ni distraiga de los objetivos resaltados.
    const lectura=key&&!drag&&!TGT&&!SEL&&!selected?key:null;
    void setHoverPreview(lectura);
  }
  function canPreview(source){if(!source)return false;const d=source.userData;return canInspectOnTable({kind:d.kind,side:d.side,back:d.kind==='enemyHand'});}
  async function setHoverPreview(key){
    if(key===hoverPreview)return;hoverPreview=key;clearTablePreview();if(!key)return;
    const source=visuals.get(key);if(!canPreview(source))return;
    const token=++tablePreviewEpoch,card=await makeInspectionCard(source);if(token!==tablePreviewEpoch||hoverPreview!==key||visuals.get(key)!==source){disposeInspectionCard(card);return;}
    const p=inspectionPose();camera.add(card);card.position.set(p.pos.x,p.pos.y-3.2,p.pos.z);card.rotation.copy(p.rot);card.scale.setScalar(p.scale*.86);tablePreview=card;tablePreviewKey=key;
  }
  async function toggleTablePreview(v){
    if(!canPreview(v))return false;
    if(tablePreviewKey===v.userData.key&&tablePreview){hoverPreview=null;clearTablePreview();return true;}
    await setHoverPreview(v.userData.key);return true;
  }
  function animateTablePreview(dt){
    if(!tablePreview)return;if(hoverPreview!==tablePreviewKey){clearTablePreview();return;}
    const p=inspectionPose(),mix=1-Math.exp(-dt*18),q=new THREE.Quaternion().setFromEuler(p.rot);tablePreview.position.lerp(p.pos,mix);tablePreview.quaternion.slerp(q,mix);tablePreview.scale.setScalar(THREE.MathUtils.lerp(tablePreview.scale.x,p.scale,mix));
  }

  /* ----------------------------- Alma / PD -------------------------------- */
  // No hay cristales ni polígonos de PD flotando sobre el tapete. El estado
  // sigue viniendo íntegro del motor, pero Alma se lee donde pertenece: dentro
  // de cada carta de protagonista. Los PD continúan en el HUD de cada jugador.
  function leaderVisual(s){return visuals.get('leader:'+s)||null;}
  function drawResources(){
    if(!G)return;
    for(const s of [ME,FOE]){
      const leader=leaderVisual(s);
      if(leader?.userData?.soulBadge)paintSoulBadge(leader.userData.soulBadge,P(s).alma);
    }
  }

  /* ------------------------------ UI model -------------------------------- */
  function strip(html){const div=document.createElement('div');div.innerHTML=String(html||'');return div.textContent||'';}
  function pill(name,value,kind=''){return `<span class="ctPill ${kind}">${name} <b>${value}</b></span>`;}
  function playerHUD(s){const p=P(s),extra=[];if(p.leaderId==='talesin')extra.push(p.ascended?'<span class="ctPill gracia">😇 Ascendido</span>':pill('✨',p.gracia+'/5','gracia'));if(p.corte?.turnos)extra.push(pill('👑',p.corte.turnos+'/2','corte'));if(p.relics.length)extra.push(`<span class="ctPill">✦ ${p.relics.map(r=>CARDS[r.id].n).join(', ')}</span>`);return `<b>${p.L.n}</b>${pill('♥',Math.max(0,p.alma),'alma')}${pill('◆',p.pd+'/'+p.pdMax,'pd')}${pill('🗝',keys(s))}${extra.join('')}`;}
  function updateHUD(){if(!G)return;meHud.innerHTML=playerHUD(ME);enemyHud.innerHTML=playerHUD(FOE);turnEl.textContent=G.over?'Partida terminada':`${G.active===ME?'Tu turno':'Turno de Gero'} · ${G.phase||'preparando'} · ronda ${Math.max(1,Math.ceil(G.turnNo/2))}`;leaderBtn.textContent=`${P(ME).L.art} ${P(ME).L.habName} (${P(ME).L.habCost} PD)`;leaderBtn.disabled=G.active!==ME||G.busy||G.over||!canUseLeader(ME);abilityBtn.disabled=!selected||G.active!==ME||G.busy||G.over||!canUseAct(selected);abilityBtn.textContent=selected?.card.act?`${selected.card.act.n} (${selected.card.act.cost} PD)`:'Habilidad de carta';endBtn.disabled=G.active!==ME||G.busy||G.resolving||G.over||!!TGT;}
  function messageFor(t,cls=''){message.textContent=strip(t);message.className='ctMessage '+cls;}
  const rivalCue=document.createElement('div');rivalCue.className='ctRivalCue';rivalCue.hidden=true;stage.append(rivalCue);let rivalCueEpoch=0;
  function rivalCueText(cue){
    if(cue?.kind==='card'){const c=CARDS[cue.id];return `GERO PREPARA · ${c?.art||'🃏'} ${c?.n||cue.id}`;}
    if(cue?.kind==='act')return `GERO ACTIVA · ${cue.u?.card?.n||'Personaje'} · ${cue.u?.card?.act?.n||'Habilidad'}`;
    if(cue?.kind==='leader')return `GERO USA · ${cue.leader?.habName||'Habilidad de líder'}`;
    if(cue?.kind==='attack'){const target=cue.target==='face'?'tu Alma':cue.target?.card?.n||'su objetivo';return `GERO DECLARA · ${cue.u?.card?.n||'Personaje'} → ${target}`;}
    return 'GERO PREPARA SU JUGADA';
  }
  function paintLogToggle(){
    if(!logToggle)return;logToggle.setAttribute('aria-expanded',String(logOpen));logToggle.textContent=logOpen?'Ocultar registro':'Registro';logToggle.append(' ');const badge=document.createElement('span');badge.id='ctLogBadge';badge.hidden=!logUnread;badge.textContent=String(Math.min(99,logUnread));logToggle.append(badge);
  }
  function setLogOpen(open){logOpen=!!open;logEl.classList.toggle('is-open',logOpen);logEl.setAttribute('aria-hidden',String(!logOpen));if(logOpen)logUnread=0;paintLogToggle();}
  logToggle?.addEventListener('click',e=>{e.stopPropagation();setLogOpen(!logOpen);});
  logToggle?.addEventListener('pointerdown',e=>e.stopPropagation());
  logEl.addEventListener('pointerenter',()=>{if(!drag){hoverHand=null;setTableHover(null);}});
  function showPrompt(text,options=[]){prompt.hidden=false;prompt.innerHTML=`<p>${text}</p><div class="ctPromptActions">${options.map((o,i)=>`<button type="button" data-ct-opt="${i}" class="${o.cls||''}">${o.t}</button>`).join('')}</div>`;prompt.querySelectorAll('[data-ct-opt]').forEach(b=>b.onclick=()=>options[Number(b.dataset.ctOpt)]?.fn?.());}
  function clearUI(){prompt.hidden=true;prompt.replaceChildren();}
  function modalShow({kicker='EL DOMO ESPERA',title,body='',actions=[]}){modalKicker.textContent=kicker;modalTitle.textContent=title;modalBody.innerHTML=body;modalActions.innerHTML='';actions.forEach(a=>{const b=document.createElement('button');b.type='button';b.textContent=a.t;b.className=a.cls||'';b.onclick=a.fn;modalActions.append(b);});modal.hidden=false;}
  function modalHide(){modal.hidden=true;}
  function floatAt(pos,text,kind='note'){const el=document.createElement('div');el.className='ctFloat '+kind;el.textContent=text;labels.append(el);floating.push({el,pos:pos.clone(),until:performance.now()+900});}
  const screenWork=new THREE.Vector3();
  function worldToScreen(pos){const v=screenWork.copy(pos).project(camera);return {x:(v.x*.5+.5)*stageSize.w,y:(.5-v.y*.5)*stageSize.h,hide:v.z>1};}
  function unitPos(u){const v=visuals.get('unit:'+u?.uid);return v?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();}
  function soulPos(s){const leader=leaderVisual(s);return leader?leader.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.42,0)):leaderPos(s).add(new THREE.Vector3(0,.42,0));}

  /* --------------------- Contrato del motor: UI / FX ---------------------- */
  // La IA ya decide a través del motor; este adaptador no debe comprimir sus
  // pausas a 420 ms. Conservamos el modo rápido sólo para las pruebas.
  // Misma semántica que la mesa original: los tiempos escritos por el motor
  // son tiempos reales, sin la compresión silenciosa que hacía que Gero
  // encadenara acciones imposibles de seguir.
  globalThis.nap=ms=>((G&&G.fast)||document.hidden)?Promise.resolve():sleep(Math.max(0,Math.round(ms)));
  globalThis.fxRivalCue=async(cue,ms=820)=>{
    if(G?.fast||document.hidden)return globalThis.nap(ms);
    const epoch=++rivalCueEpoch;rivalCue.textContent=rivalCueText(cue);rivalCue.hidden=false;rivalCue.classList.remove('is-in');void rivalCue.offsetWidth;rivalCue.classList.add('is-in');
    await globalThis.nap(ms);
    if(epoch===rivalCueEpoch){rivalCue.classList.remove('is-in');rivalCue.hidden=true;}
  };
  // El motor pregunta esto para no disparar pasivas durante un paso didáctico.
  // Esta pantalla no carga el tutorial HTML, así que la pasiva siempre procede.
  globalThis.tutPasivaLista=()=>true;
  globalThis.render=()=>{sync();};
  globalThis.log=(text,cls='sys')=>{if(!G)return;G.log.push({txt:text,cls:cls||''});const p=document.createElement('p');p.className=cls||'';p.textContent=strip(text);logEl.prepend(p);while(logEl.children.length>18)logEl.lastElementChild.remove();logCount++;if(!logOpen){logUnread=Math.min(99,logUnread+1);paintLogToggle();}};
  globalThis.toast=(text)=>messageFor(text,'notice');
  globalThis.setPrompt=(text,opts)=>showPrompt(text,opts||[]);
  globalThis.clearPrompt=()=>clearUI();
  globalThis.fichaTactil=()=>{};
  globalThis.revelarCarta=(id,mano,side)=>new Promise(resolve=>modalShow({kicker:'CARTA REVELADA',title:CARDS[id]?.n||id,body:`<p>${mano?'La carta viaja a una mano.':'La carta va a las Alcantarillas.'}</p><p>${strip(CARDS[id]?.x||'')}</p>`,actions:[{t:'Continuar',cls:'gold',fn:()=>{modalHide();resolve();}}]}));
  globalThis.ask=(side,text,options,ai)=>{if(side!==ME||G?.auto)return Promise.resolve(typeof ai==='function'?ai(G,side):0);return new Promise(resolve=>modalShow({kicker:'DECISIÓN',title:'Elige una opción',body:`<p>${text}</p>`,actions:options.map((t,i)=>({t,cls:i===0?'gold':'',fn:()=>{modalHide();resolve(i);}}))}));};
  globalThis.pickCard=(side,cards,title,optional=false)=>pickList(side,cards,title,optional,x=>x);
  globalThis.pickFrom=(side,items,title)=>pickList(side,items,title,true,x=>x);
  function pickList(side,items,title,optional,map){if(side!==ME||G?.auto)return Promise.resolve(optional?null:(items[0]??null));return new Promise(resolve=>{const entries=items.map((v,i)=>{const id=typeof v==='string'?v:v?.id;return {v,id,i,name:CARDS[id]?.n||id||'Opción'};});const body=`<p>Selecciona una carta.</p><div class="ctChoiceGrid">${entries.map(e=>`<button type="button" class="ctChoiceCard" data-choice="${e.i}"><b>${e.name}</b>${strip(CARDS[e.id]?.x||'')}</button>`).join('')}</div>`;modalShow({kicker:'DECISIÓN',title,body,actions:optional?[{t:'Cancelar',fn:()=>{modalHide();resolve(null);}}]:[]});modalBody.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const e=entries[Number(b.dataset.choice)];modalHide();resolve(map(e.v));});});}
  /* D20: motor auténtico, cuerpo y trayectoria en la mesa Three.  El motor
     genera la simulación firmada; esta capa sólo interpola sus fotogramas.

     La malla no usa IcosahedronGeometry ni sprites: se construye desde las
     caras canónicas que usa dado-fisico.js. Así su quaternion, su radio y el
     número pintado sobre cada cara son exactamente los de la simulación. */
  const D20=globalThis.CAOZ_D20,D20_FACES=Array.isArray(D20?.caras)?D20.caras:[],D20_VERTICES=Array.isArray(D20?.vertices)?D20.vertices:[];
  // El d20 entra desde detrás de la mano de Gero y cruza la mesa hasta el
  // lado de Talesyn. La traslación es cinematográfica; su rotación y su cara
  // final siguen viniendo intactas de la simulación física canónica.
  const DICE_SCALE=1.28,DICE_LAUNCH=new THREE.Vector3(1,0,-7.05),DICE_TRAVEL_Z=10.15,DICE_IMPULSE=Object.freeze({x:.16,z:-.64,fuerza:.68});
  const diceRoot=new THREE.Group(),diceState={visible:false,estado:'oculto',valor:null,frames:0,decalCount:D20_FACES.length,spriteCount:0,caraSuperior:null,caraIndice:null};diceRoot.scale.setScalar(DICE_SCALE);table.add(diceRoot);diceRoot.visible=false;
  const diceLight=new THREE.PointLight(0xffd49a,0,9,2);diceLight.visible=false;scene.add(diceLight);
  const d20Vector=v=>new THREE.Vector3(v[0],v[1],v[2]);
  function d20BodyGeometry(){
    const positions=[],normals=[];
    for(const face of D20_FACES)for(const i of face.ids){positions.push(...D20_VERTICES[i]);normals.push(...face.n);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingSphere();return geometry;
  }
  const D20_ATLAS_COLS=5,D20_ATLAS_ROWS=4,D20_ATLAS_CELL=192,D20_LABEL_SIZE=.31,D20_LABEL_LIFT=.009,D20_SURFACE_Y=.008;
  const diceNumberAtlas=canvasTexture(D20_ATLAS_COLS*D20_ATLAS_CELL,D20_ATLAS_ROWS*D20_ATLAS_CELL,(g,w,h)=>{
    g.clearRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';
    D20_FACES.forEach((face,i)=>{const col=i%D20_ATLAS_COLS,row=Math.floor(i/D20_ATLAS_COLS),x=(col+.5)*D20_ATLAS_CELL,y=(row+.5)*D20_ATLAS_CELL;
      g.font='900 142px Cinzel Domo, Georgia';g.lineWidth=12;g.strokeStyle='#1c0a15';g.shadowColor='#000';g.shadowBlur=8;g.strokeText(String(face.valor),x,y+7);g.shadowBlur=0;g.fillStyle='#fff0bd';g.fillText(String(face.valor),x,y+7);
      if(face.valor===6||face.valor===9){g.fillStyle='#fff0bd';g.fillRect(x-5,y+70,10,9);}
    });
  });
  function d20LabelGeometry(){
    const positions=[],uvs=[],cameraUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    D20_FACES.forEach((face,i)=>{
      const [a,b,c]=face.ids.map(id=>d20Vector(D20_VERTICES[id])),center=a.clone().add(b).add(c).multiplyScalar(1/3),normal=d20Vector(face.n),up=cameraUp.clone().addScaledVector(normal,-cameraUp.dot(normal));
      if(up.lengthSq()<.0001)up.set(0,0,-1).addScaledVector(normal,normal.z);up.normalize();
      const right=new THREE.Vector3().crossVectors(up,normal).normalize(),half=D20_LABEL_SIZE/2,corners=[center.clone().addScaledVector(right,-half).addScaledVector(up,-half),center.clone().addScaledVector(right,half).addScaledVector(up,-half),center.clone().addScaledVector(right,half).addScaledVector(up,half),center.clone().addScaledVector(right,-half).addScaledVector(up,half)];
      for(const point of corners)point.addScaledVector(normal,D20_LABEL_LIFT);
      const col=i%D20_ATLAS_COLS,row=Math.floor(i/D20_ATLAS_COLS),pad=.07,u0=(col+pad)/D20_ATLAS_COLS,u1=(col+1-pad)/D20_ATLAS_COLS,v0=1-(row+1-pad)/D20_ATLAS_ROWS,v1=1-(row+pad)/D20_ATLAS_ROWS;
      for(const point of [corners[0],corners[1],corners[2],corners[0],corners[2],corners[3]])positions.push(point.x,point.y,point.z);
      uvs.push(u0,v0,u1,v0,u1,v1,u0,v0,u1,v1,u0,v1);
    });
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();return geometry;
  }
  const diceGeometry=d20BodyGeometry(),diceMesh=new THREE.Mesh(diceGeometry,new THREE.MeshPhysicalMaterial({color:0x271126,metalness:.28,roughness:.20,clearcoat:.82,clearcoatRoughness:.11,emissive:0x160817,emissiveIntensity:.18,flatShading:true}));diceMesh.castShadow=true;diceMesh.receiveShadow=true;
  const diceLabels=new THREE.Mesh(d20LabelGeometry(),new THREE.MeshBasicMaterial({map:diceNumberAtlas,transparent:true,alphaTest:.14,side:THREE.DoubleSide,depthWrite:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));diceLabels.renderOrder=1;
  const diceEdges=new THREE.LineSegments(new THREE.EdgesGeometry(diceGeometry),new THREE.LineBasicMaterial({color:0xf4ca73,transparent:true,opacity:.96,toneMapped:false}));diceRoot.add(diceMesh,diceLabels,diceEdges);
  const diceReadout=document.createElement('div');diceReadout.className='ctDiceReadout';diceReadout.hidden=true;stage.append(diceReadout);
  function unitQuat(q){const out=new THREE.Quaternion(q[0],q[1],q[2],q[3]);return out.normalize();}
  function readDiceFace(q){if(!D20?.leer)return null;const face=D20.leer([q.x,q.y,q.z,q.w]);return face?{valor:face.valor,indice:face.indice}:null;}
  function diceAt(tirada,t){const frames=tirada.frames||[],last=frames.at(-1);if(!last)return;let i=0;while(i<frames.length-2&&frames[i+1].t<t)i++;const a=frames[i],b=frames[Math.min(i+1,frames.length-1)],k=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t||1))),sign=a.q[0]*b.q[0]+a.q[1]*b.q[1]+a.q[2]*b.q[2]+a.q[3]*b.q[3]<0?-1:1;
    const first=frames[0]?.p||[0,0,.9],px=a.p[0]+(b.p[0]-a.p[0])*k,py=a.p[1]+(b.p[1]-a.p[1])*k,progress=Math.max(0,Math.min(1,t/(last.t||1)));
    diceRoot.position.set(DICE_LAUNCH.x+(px-first[0])*.58,D20_SURFACE_Y+py*DICE_SCALE,DICE_LAUNCH.z+DICE_TRAVEL_Z*progress);diceLight.position.copy(diceRoot.position).add(new THREE.Vector3(0,2,.35));const q=unitQuat(a.q).slerp(unitQuat([b.q[0]*sign,b.q[1]*sign,b.q[2]*sign,b.q[3]*sign]),k);diceRoot.quaternion.copy(q);const top=readDiceFace(q);diceState.caraSuperior=top?.valor??null;diceState.caraIndice=top?.indice??null;
  }
  // Evita hasta 419 simulaciones síncronas cuando se pide una cara conocida.
  // Cada semilla se obtuvo con el mismo impulso canónico y se valida al usarla,
  // así la física sigue siendo auténtica y el hilo de UI no se congela.
  const D20_SEEDS=Object.freeze({1:32,2:1,3:23,4:21,5:31,6:15,7:61,8:36,9:11,10:14,11:12,12:2,13:3,14:54,15:4,16:17,17:19,18:8,19:5,20:27}),d20ReplayCache=new Map();
  function physicalFor(value){if(!globalThis.CAOZ_D20)return null;const seed=D20_SEEDS[value];if(!seed)return null;if(d20ReplayCache.has(value))return d20ReplayCache.get(value);const roll=globalThis.CAOZ_D20.simular(seed,DICE_IMPULSE);if(roll.asentado&&roll.valor===value){d20ReplayCache.set(value,roll);return roll;}return null;}
  async function showD20(value,label,interactive,meta,fisica){
    const esperado=Number(value);let tirada=fisica&&(fisica.frames?fisica:globalThis.CAOZ_D20?.desempaquetar?.(fisica));
    const caraFinal=r=>{const q=r?.frames?.at(-1)?.q;return q?readDiceFace(unitQuat(q))?.valor:null;};
    // Jamás mostramos una animación cuya cara superior contradiga el resultado
    // que el motor acaba de resolver. Una ruta remota incompleta se sustituye
    // por su replay canónico, nunca por una semilla arbitraria.
    if(!tirada||Number(tirada.valor)!==esperado||caraFinal(tirada)!==esperado)tirada=physicalFor(esperado);
    if(!tirada){messageFor(`🎲 ${label}: ${esperado}`);return esperado;}
    diceRoot.visible=true;diceLight.visible=true;diceLight.intensity=13;diceState.visible=true;diceState.estado='rodando';diceState.valor=null;diceState.caraSuperior=null;diceState.caraIndice=null;diceState.frames=tirada.frames.length;diceReadout.hidden=false;diceReadout.innerHTML=`<small>${strip(label)}</small><b>◇</b><span>Rodando el d20…</span>`;shadowDirty=true;
    animationHistory.push({tipo:'dado',etapa:'entrada',frames:tirada.frames.length,orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();
    const duration=G?.fast?.10:Math.min(2.4,Math.max(.82,tirada.duracion||2.2));
    await tween(duration,k=>diceAt(tirada,(tirada.frames.at(-1)?.t||0)*ease(k)));
    diceAt(tirada,tirada.frames.at(-1)?.t||0);diceState.estado='resultado';diceState.valor=esperado;const good=meta?.min!=null&&esperado>=meta.min,bad=meta?.max!=null&&esperado<=meta.max;
    diceReadout.innerHTML=`<small>${strip(label)}</small><b>${esperado}</b><span>${good?'Éxito':bad?'Falla':esperado===20||esperado===1?'Crítico':'Resultado'}</span>`;
    animationHistory.push({tipo:'dado',etapa:'fin',frames:tirada.frames.length,orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();
    if(interactive&&G?.active===ME)return new Promise(resolve=>modalShow({kicker:'D20',title:label,body:`<p class="ctDiceResult"><b>${esperado}</b></p><p>${meta?.necesita||''}</p><p>${good?(meta?.siOk||''):(bad?(meta?.siMal||''):'')}</p>`,actions:[{t:'Continuar',cls:'gold',fn:()=>{modalHide();diceRoot.visible=false;diceLight.visible=false;diceReadout.hidden=true;diceState.visible=false;shadowDirty=true;resolve(esperado);}}]}));
    await fxDelay(meta?2600:1500);diceRoot.visible=false;diceLight.visible=false;diceReadout.hidden=true;diceState.visible=false;shadowDirty=true;return esperado;
  }
  globalThis.d20FisicoDisponible=()=>!!globalThis.CAOZ_D20;
  globalThis.prepararTiradaD20=(label,interactive,meta)=>{
    if(!interactive||document.hidden)return Promise.resolve(globalThis.CAOZ_D20?.impulsoValido({x:.12,z:-.62,fuerza:.66})||{x:.12,z:-.62,fuerza:.66});
    return new Promise(resolve=>modalShow({kicker:'D20 FÍSICO',title:label,body:`<p>${meta?.necesita||'El dado decidirá el resultado.'}</p><p>El resultado se rueda sobre la mesa.</p>`,actions:[{t:'Tirar el d20',cls:'gold',fn:()=>{modalHide();resolve(globalThis.CAOZ_D20.impulsoValido({x:.12,z:-.62,fuerza:.66}));}},{t:'Cancelar',fn:()=>{modalHide();resolve({cancelada:true});}}]}));
  };
  globalThis.rollDice=(value,label,interactive,meta,fisica)=>showD20(value,label,interactive,meta,fisica);
  globalThis.elegirMulliganInicial=(side,{cartas,limite})=>{if(side!==ME)return Promise.resolve([]);return new Promise(resolve=>{let picks=[];const refresh=()=>{modalShow({kicker:'MANO INICIAL',title:`Puedes cambiar hasta ${limite} carta${limite===1?'':'s'}`,body:`<p>Las cartas seleccionadas se cambian antes de volver al mazo.</p><div class="ctChoiceGrid">${cartas.map((id,i)=>`<button type="button" class="ctChoiceCard ${picks.includes(i)?'selected':''}" data-mull="${i}"><b>${CARDS[id]?.n||id}</b>${strip(CARDS[id]?.x||'')}</button>`).join('')}</div>`,actions:[{t:'Conservar / confirmar',cls:'gold',fn:()=>{modalHide();resolve(picks.slice());}}]});modalBody.querySelectorAll('[data-mull]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.mull);picks=picks.includes(i)?picks.filter(x=>x!==i):(picks.length<limite?[...picks,i]:picks);refresh();});};refresh();});};
  globalThis.endGame=(winner,reason)=>{if(!G||G.over)return;G.over=true;clearUI();render();modalShow({kicker:winner===ME?'VICTORIA':'DERROTA',title:winner===ME?'Talesyn prevalece':'Gero cierra la mesa',body:`<p>${reason}</p><p>${winner===ME?'La Ascensión sobrevivió al Domo.':'Puedes empezar de nuevo con las mismas reglas.'}</p>`,actions:[{t:'Revancha',cls:'gold',fn:()=>{modalHide();startGame(modo);}},{t:'Elegir modo',fn:()=>chooseMode()}]});};
  function fxDelay(ms=180){return new Promise(r=>setTimeout(r,G?.fast?1:ms));}
  // Impactos se reutilizan: los efectos de Gero podían crear una geometría y
  // una luz nuevas por cada daño, provocando pausas de GC en turnos largos.
  const impactGeometry=new THREE.RingGeometry(.22,.3,32);
  function makeImpact(){const ring=new THREE.Mesh(impactGeometry,new THREE.MeshBasicMaterial({color:0xffc15d,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})),light=new THREE.PointLight(0xffc15d,0,5,2);ring.rotation.x=-Math.PI/2;return {ring,light,at:0,power:1};}
  function releaseImpact(fx){fx.ring.removeFromParent();fx.light.removeFromParent();impactPool.push(fx);}
  function impactAt(pos,color=0xffc15d,power=1){const fx=impactPool.pop()||makeImpact();fx.ring.material.color.setHex(color);fx.ring.material.opacity=.8;fx.ring.scale.setScalar(1);fx.ring.position.copy(pos).setY(Math.max(.028,pos.y+.015));fx.light.color.setHex(color);fx.light.position.copy(pos).add(new THREE.Vector3(0,.7,0));fx.light.intensity=0;fx.at=reloj;fx.power=power;table.add(fx.ring);scene.add(fx.light);impacts.push(fx);animationHistory.push({tipo:'impacto',etapa:'entrada',orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();}
  function impact(v,d){const p=d?.pos||v.position;impactAt(p,d?.edition==='dorado'?0xffd174:sideColor(d?.side??v.userData.side),1);view.shake=Math.max(view.shake,.11);}
  function takeSpent(side,id){const list=spentVisuals[side],i=list.map(x=>x.id).lastIndexOf(id);return i<0?null:list.splice(i,1)[0];}
  async function spellFlight(id,s,kind='hechizo',color=0xb493ff){const spent=takeSpent(s,id);if(!spent){flash(color);return fxDelay(220);}const v=spent.v;placeWorld(v,spent.pose);v.visible=true;const center=new THREE.Vector3(0,2.45,sideZ(s)*.35);await flyCard(v,center,new THREE.Euler(-.48,0,0),.45,1.05,ESC,kind);impactAt(center,color,1.3);await motion(v,kind+'-brasas',()=>tween(.3,k=>{setDissolve(v,ease(k));v.rotation.y+=.13;}));setDissolve(v,1);v.position.copy(gravePos(s)).add(new THREE.Vector3(0,.21,0));v.rotation.set(-Math.PI/2,0,0);graveGhosts[s]={id,v,pose:poseWorld(v)};visuals.delete(v.userData.key);}
  globalThis.fxHit=async(u,n)=>{const v=await waitVisual('unit:'+u.uid);if(v){await waitMotion(v);floatAt(unitPos(u),'-'+n,'damage');impactAt(v.position,0xff8a70,1);await motion(v,'golpe',()=>tween(.24,k=>{v.rotation.z=Math.sin(k*TAU*3)*(1-k)*.12;}));v.rotation.z=0;}else await fxDelay();};
  globalThis.fxHeal=async(u,n)=>{const v=await waitVisual('unit:'+u.uid);floatAt(unitPos(u),'+'+n,'heal');if(v){await motion(v,'cura',()=>tween(.22,k=>{const q=1+Math.sin(Math.PI*k)*.1;v.scale.setScalar(ESC*q);}));}return fxDelay(80);};
  globalThis.fxFace=async(s,n)=>{const leader=leaderVisual(s),badge=leader?.userData?.soulBadge;floatAt(soulPos(s),'-'+n,'damage');impactAt(soulPos(s),0xff746d,1.2);if(!badge)return fxDelay(180);await tween(.28,k=>{const pulse=1+Math.sin(k*Math.PI)*.18;badge.scale.set(pulse,pulse,1);});badge.scale.set(1,1,1);};
  globalThis.fxDraw=async s=>{const tokens=handTokens[s],token=tokens.at(-1),key=token?(s===ME?'hand:':'enemy-hand:')+token.serial:null,v=key&&await waitVisual(key);if(!v)return fxDelay(120);const target=poseWorld(v),from={pos:deckPos(s).add(new THREE.Vector3(0,.48,0)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+Math.PI,0,0)),scale:ESC*.72};v.visible=true;placeWorld(v,from);impactAt(from.pos,sideColor(s),.42);await motion(v,'robo',()=>tween(s===ME?.72:.58,k=>{const e=ease(k);v.position.lerpVectors(from.pos,target.pos,e);v.position.y+=Math.sin(Math.PI*e)*.52;v.quaternion.slerpQuaternions(from.q,target.q,e);v.scale.setScalar(THREE.MathUtils.lerp(from.scale,target.scale,e));}));if(s===ME)camera.attach(v);else table.attach(v);};
  globalThis.fxObj=(u,id,text)=>{floatAt(unitPos(u),text||CARDS[id]?.n||'Objeto','note');impactAt(unitPos(u),0x78caff,.72);return fxDelay(220);};
  globalThis.fxNotice=(text)=>{messageFor(text);return fxDelay(250);};
  globalThis.fxNumber=(anchor,text,kind)=>{floatAt(anchor==='face0'?soulPos(ME):soulPos(FOE),text,kind==='buff'?'heal':'note');};
  globalThis.fxDeath=async u=>{const key='unit:'+u.uid,v=await waitVisual(key);if(!v)return fxDelay(160);await waitMotion(v);v.userData.dying=true;const from=v.position.clone(),to=gravePos(u.owner??u.side).add(new THREE.Vector3(0,.24,0));impactAt(from,0xff6745,1.1);await motion(v,'muerte',()=>tween(.46,k=>{const e=ease(k);v.position.lerpVectors(from,to,e);v.position.y+=Math.sin(k*Math.PI)*.9;v.scale.setScalar(ESC*(1-e*.16));setDissolve(v,e);}));setDissolve(v,1);visuals.delete(key);v.userData.dying=false;graveGhosts[u.owner??u.side]={id:u.card.id,v,pose:poseWorld(v)};};
  globalThis.fxAterriza=async u=>{const v=await waitVisual('unit:'+u.uid);if(!v)return fxDelay(120);await waitMotion(v);const p=v.position.clone();await motion(v,'aterrizaje',()=>tween(.2,k=>{v.position.y=p.y+Math.sin(k*Math.PI)*.34;}));v.position.copy(p);impact(v,{pos:p,side:u.side,edition:v.userData.edition});};
  globalThis.fxSpell=async(id,s)=>{floatAt(new THREE.Vector3(0,1.2,0),CARDS[id]?.n||'Hechizo','note');await spellFlight(id,s,'hechizo',0xb493ff);flash(0xb493ff);if(s===FOE)await fxDelay(430);};
  globalThis.fxHabilidad=async s=>{floatAt(leaderPos(s).add(new THREE.Vector3(0,1,0)),P(s).L.habName,'note');impactAt(leaderPos(s),sideColor(s),1);flash(sideColor(s));return fxDelay(s===FOE?1180:260);};
  // La cortinilla de turno conserva los 680 ms de la mesa original antes de
  // que el d20 o cualquier efecto de inicio compita por la atención.
  globalThis.fxBanner=s=>{messageFor(`— Turno de ${sideName(s)} —`);return fxDelay(680);};
  globalThis.fxStat=()=>fxDelay(1);
  globalThis.fxLunge=async(u,target)=>{const v=await waitVisual('unit:'+u.uid);if(!v)return fxDelay(180);await waitMotion(v);const start=v.position.clone(),targetPos=target==='face'?soulPos(1-u.side):unitPos(target),end=targetPos.clone().sub(start).normalize().multiplyScalar(.8).sub(targetPos).multiplyScalar(-1).add(targetPos);await motion(v,'embestida',async()=>{await tween(.30,k=>{v.position.lerpVectors(start,end,k);v.position.y+=Math.sin(k*Math.PI)*.6;});impactAt(targetPos,0xffa261,1.1);view.shake=.28;await fxDelay(70);await tween(.22,k=>{v.position.lerpVectors(end,start,k);});});v.position.copy(start);};
  // Estas tres funciones ya existen en motor.js; se reasignan para evitar que
  // su interfaz HTML antigua toque nodos ausentes en esta mesa.
  fxTrap=async(id,s)=>{floatAt(trapPos(s,1).add(new THREE.Vector3(0,1,0)),'🪤 '+(CARDS[id]?.n||'Trampa'),'note');impactAt(trapPos(s,1),0xff7b73,.9);flash(0xff7b73);await fxDelay(s===FOE?1180:260);};
  relojArranca=()=>{};globalThis.relojPara=()=>{};globalThis.relojPinta=()=>{};

  const flashLight=new THREE.PointLight(0xffffff,0,8,2);flashLight.position.set(0,3,0);flashLight.visible=false;scene.add(flashLight);let flashEpoch=0;
  function flash(color){const epoch=++flashEpoch;flashLight.color.setHex(color);flashLight.visible=true;tween(.35,k=>flashLight.intensity=Math.sin(k*Math.PI)*18).then(()=>{if(epoch===flashEpoch){flashLight.intensity=0;flashLight.visible=false;}});}
  function tween(sec,fn){return new Promise(resolve=>tweens.push({at:reloj,d:Math.max(.001,sec),fn,resolve}));}

  /* ------------------------- Clics y acciones reales ----------------------- */
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(9,9);
  function setPointer(e){const b=stage.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);}
  function rootFrom(o){while(o&&(!o.userData||!o.userData.key))o=o.parent;return o||null;}
  function handSlotUnderPointer(){ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...handHits.values()].filter(x=>x.visible),false)[0];if(!hit)return null;return {key:hit.object.userData.key,uv:hit.uv||new THREE.Vector2(.5,.5)};}
  function tableSlotUnderPointer(){ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...tableHits.values()].filter(x=>x.visible),false)[0];return hit?{key:hit.object.userData.key}:null;}
  function hitCard(){ray.setFromCamera(pointer,camera);const roots=[...visuals.values()].filter(v=>!['hand','enemyHand','deck','grave'].includes(v.userData.kind));const objects=[];roots.forEach(v=>v.traverse(x=>x.isMesh&&objects.push(x)));const hit=ray.intersectObjects(objects,false)[0];return hit?rootFrom(hit.object):null;}
  function freeSlots(side){const used=new Set(P(side).field.map(u=>fieldSlot(side,u)));return FIELD_ORDER.filter(slot=>!used.has(slot));}
  function tablePoint(){ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.72),new THREE.Vector3());}
  // La copia de lectura no participa en raycast. Aun así, al pulsarla no
  // dejamos que el clic atraviese accidentalmente hacia una carta de mesa.
  function previewContainsClientPoint(e){if(!tablePreview)return false;const r=cardRect(tablePreview);return e.clientX>=r.x&&e.clientX<=r.x+r.width&&e.clientY>=r.y&&e.clientY<=r.y+r.height;}
  // El pequeño crecimiento de la mano conserva su propia carta aunque el
  // puntero caiga sobre el borde recién ampliado.
  function handPreviewContainsClientPoint(e){const v=hoverHand&&visuals.get(hoverHand);if(!v||v.userData.kind!=='hand')return false;const r=cardRect(v);return e.clientX>=r.x&&e.clientX<=r.x+r.width&&e.clientY>=r.y&&e.clientY<=r.y+r.height;}
  function updateDropMarks(){const slots=freeSlots(ME);for(const {slot,m} of dragMarks){const active=!!drag&&slots.includes(slot);m.visible=active;m.material.opacity=active?(drag.slot===slot ? .68 : .23+.08*Math.sin(reloj*7+slot)):0;}}
  function nearestDrop(pos){let best=null,dist=1.48;for(const slot of freeSlots(ME)){const p=new THREE.Vector3((slot-2)*2,.72,sideZ(ME)*1.55),d=Math.hypot(pos.x-p.x,pos.z-p.z);if(d<dist){best=slot;dist=d;}}return best;}
  function beginDrag(key){const v=visuals.get(key);if(!v||v.userData.kind!=='hand'||!G||G.active!==ME||G.busy||!canPlay(ME,v.userData.id)){if(v)toast(whyNot(ME,v.userData.id));return false;}const point=tablePoint();if(!point)return false;setHoverPreview(null);table.attach(v);v.userData.dragging=true;drag={key,v,id:v.userData.id,point,slot:null,spell:CARDS[v.userData.id]?.t!=='personaje',started:reloj};const hit=handHits.get(key);if(hit)hit.visible=false;hoverHand=null;messageFor(drag.spell?'Suelta la carta sobre la mesa para lanzarla.':'Suelta la carta sobre una diana libre.');updateDropMarks();return true;}
  async function finishDrag(){const current=drag;if(!current)return;drag=null;for(const {m} of dragMarks){m.visible=false;m.material.opacity=0;}const v=current.v,slot=current.slot,canDrop=current.spell||slot!=null;
    if(canDrop){if(slot!=null)dropHints[ME].push({id:current.id,slot});v.userData.dragging=false;await playFromHand(ME,current.id);return;}
    camera.attach(v);v.userData.dragging=false;const hit=handHits.get(current.key);if(hit)hit.visible=true;messageFor('La carta vuelve a tu mano.');}
  function animateHand(dt){
    for(const [key,v] of visuals){if(v.userData.kind!=='hand'||v.userData.dragging||v.userData.motion)continue;const base=v.userData.handPose;if(!base)continue;const active=hoverHand===key&&!G?.busy&&G?.active===ME,pos=handWorkPos.copy(base.pos),rot=handWorkRot.copy(base.rot);let scale=base.scale;
      // El hover aprobado de la mano nunca abandona su sitio: sólo se acerca
      // lo justo para confirmar la carta bajo el mouse, sin desplazar vecinos.
      if(active){scale=base.scale*1.045;pos.y+=.10;pos.z+=.08;rot.set(-.10+(hoverUV.y-.5)*.05,(hoverUV.x-.5)*.07,0);}
      const q=handWorkQuat.setFromEuler(rot),mix=1-Math.exp(-dt*(active?18:8));v.position.lerp(pos,mix);v.quaternion.slerp(q,mix);v.scale.setScalar(THREE.MathUtils.lerp(v.scale.x,scale,mix));const m=v.userData.frente.material,legal=G?.active===ME&&!G?.busy&&canPlay(ME,v.userData.id);
      // Una carta no jugable conserva lectura: la disponibilidad se comunica
      // por la acción bloqueada y el borde, no convirtiendo su texto y arte en
      // una mancha oscura frente a la mano luminosa de la mesa de referencia.
      m.color.setScalar(active?1.08:legal?1:.84);
    }
  }
  function updateDrag(dt){if(!drag)return;const point=tablePoint();if(point)drag.point.copy(point);drag.slot=drag.spell?null:nearestDrop(drag.point);const target=drag.point.clone();target.y=.82;drag.v.position.lerp(target,1-Math.exp(-dt*19));const lean=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+.08,0,0));drag.v.quaternion.slerp(lean,1-Math.exp(-dt*14));drag.v.scale.setScalar(THREE.MathUtils.lerp(drag.v.scale.x,ESC*1.08,1-Math.exp(-dt*14)));updateDropMarks();}
  function selectVisual(u){setHoverPreview(null);selected=u;render();}
  async function activateCard(v){if(!v||!G||G.over)return;const kind=v.userData.kind,side=v.userData.side,u=v.userData.unit;
    if(TGT){if(kind==='leader'&&side===FOE)pickTarget('face');else if(u)pickTarget(u);return;}
    if(kind==='hand'&&side===ME){
      if(G.active!==ME||G.busy){toast('Espera a que termine la jugada actual.');return;}
      const id=v.userData.id;
      // whyNot() siempre devuelve una explicación textual, incluso como
      // reserva final cuando la carta sí es legal. La autoridad binaria es
      // canPlay(); consultar sólo whyNot() convertía todas las cartas de la
      // mano en "no jugables" aunque el motor las aceptara.
      if(!canPlay(ME,id)){toast(whyNot(ME,id));return;}
      setHoverPreview(null);
      await playFromHand(ME,id);return;
    }
    if(kind==='field'&&side===ME&&u){selectVisual(u);selectUnit(u);return;}
    if(kind==='field'&&side===FOE&&u){if(SEL)await tryAttack(SEL,u);else toast('Elige primero uno de tus Personajes para atacar.');return;}
    if(kind==='leader'&&side===FOE){if(TGT){pickTarget('face');return;}if(SEL)await tryAttack(SEL,'face');else toast('Elige un Personaje para atacar al Alma de Gero.');return;}
    if(kind==='leader'&&side===ME){await useLeader(ME);}
  }
  async function activateBoardCard(v){
    if(!v)return;
    const {kind,side}=v.userData;
    // Las transiciones de entrada pueden conservar el mesh un fotograma antes
    // de que `userData.unit` se refresque. La clave de la carta es estable,
    // así que recuperamos la unidad del motor en vez de degradar ese clic a
    // una inspección accidental.
    const u=v.userData.unit||(kind==='field'?P(side).field.find(x=>'unit:'+x.uid===v.userData.key):null);
    if(u)v.userData.unit=u;
    // Los objetivos, ataques y habilidades siempre ganan. El visor sólo se
    // abre cuando el clic no representa una orden táctica para el motor.
    if(TGT){setHoverPreview(null);await activateCard(v);return;}
    if(kind==='field'&&side===ME&&u){
      // Requerimos ambos estados de selección: evita que una referencia vieja
      // del motor convierta el primer clic de una unidad en inspección.
      if(SEL?.uid===u.uid&&selected?.uid===u.uid){await toggleTablePreview(v);return;}
      setHoverPreview(null);await activateCard(v);return;
    }
    if(kind==='field'&&side===FOE&&u){
      if(SEL){setHoverPreview(null);await activateCard(v);return;}
      await toggleTablePreview(v);return;
    }
    if(kind==='leader'&&side===FOE){
      if(SEL){setHoverPreview(null);await activateCard(v);return;}
      await toggleTablePreview(v);return;
    }
    // La habilidad del propio líder mantiene su comportamiento normal.
    if(kind==='leader'&&side===ME){setHoverPreview(null);await activateCard(v);return;}
    if(await toggleTablePreview(v))return;
    await activateCard(v);
  }
  // Sólo el lienzo recibe gestos de mesa. Sin esta frontera, un botón de la
  // confirmación interna queda capturado por el canvas antes de recibir click.
  const isBoardPointer=e=>e.target===canvas||!!gesture||!!drag;
  stage.addEventListener('pointerdown',e=>{if(e.button!==0||!isBoardPointer(e))return;if(previewContainsClientPoint(e)){gesture={preview:true,x:e.clientX,y:e.clientY,moved:0};stage.setPointerCapture?.(e.pointerId);return;}if(handPreviewContainsClientPoint(e)){gesture={key:hoverHand,hand:true,x:e.clientX,y:e.clientY,moved:0};stage.setPointerCapture?.(e.pointerId);return;}setPointer(e);const hand=handSlotUnderPointer(),tableSlot=hand?null:tableSlotUnderPointer();gesture={key:hand?.key||tableSlot?.key||null,hand:!!hand,x:e.clientX,y:e.clientY,moved:0};stage.setPointerCapture?.(e.pointerId);});
  stage.addEventListener('pointerup',async e=>{if(!isBoardPointer(e))return;const g=gesture;gesture=null;if(g?.preview)return;setPointer(e);if(drag){await finishDrag();return;}if(g?.key&&g.moved<=10){const v=visuals.get(g.key);if(v){if(g.hand)await activateCard(v);else await activateBoardCard(v);}return;}const hit=tableSlotUnderPointer(),v=hit?visuals.get(hit.key):hitCard();if(v)await activateBoardCard(v);else if(TGT)toast('Elige una carta resaltada o cancela.');else setHoverPreview(null);});
  stage.addEventListener('pointermove',e=>{if(!isBoardPointer(e)){if(!drag){hoverHand=null;setTableHover(null);stage.style.cursor='default';}return;}if(!drag&&previewContainsClientPoint(e)){// El visor no se evapora al llevar el cursor hacia él para leerlo.
      hoverHand=null;stage.style.cursor='default';return;
    }const onHandPreview=!drag&&handPreviewContainsClientPoint(e);setPointer(e);const h=onHandPreview?null:handSlotUnderPointer(),tableSlot=(h||onHandPreview)?null:tableSlotUnderPointer();if(!drag){hoverHand=h?.key||(onHandPreview?hoverHand:null);if(h)hoverUV.copy(h.uv);setTableHover(tableSlot?.key||null);stage.style.cursor=h||tableSlot||onHandPreview?'pointer':'default';}if(gesture){gesture.moved+=Math.abs(e.movementX||e.clientX-gesture.x)+Math.abs(e.movementY||e.clientY-gesture.y);gesture.x=e.clientX;gesture.y=e.clientY;if(gesture.hand&&gesture.moved>10&&!drag)beginDrag(gesture.key);}});
  stage.addEventListener('pointerleave',()=>{if(!gesture&&!drag){hoverHand=null;setTableHover(null);stage.style.cursor='default';}});
  stage.addEventListener('wheel',e=>{e.preventDefault();view.target=Math.max(.78,Math.min(1.25,view.target+e.deltaY*.0008));},{passive:false});
  prompt.addEventListener('pointerdown',e=>e.stopPropagation());
  prompt.addEventListener('pointerup',e=>e.stopPropagation());
  leaderBtn.onclick=()=>useLeader(ME);
  abilityBtn.onclick=()=>selected&&useAct(selected);
  async function finishTurnFromTable(){
    if(!G||G.over||G.active!==ME||G.busy||G.resolving||TGT)return;
    // En el demo la acción de turno era una orden inequívoca. Conservamos las
    // reglas obligatorias (Provocar), pero no escondemos una segunda acción de
    // confirmación detrás de la mano.
    if(atacantesObligados(ME).length){pedirTerminarTurno();return;}
    selected=null;SEL=null;clearPrompt();await endTurn();
  }
  endBtn.onclick=()=>{finishTurnFromTable();};
  $('ctEfectos').onclick=()=>{const on=$('ctEfectos').getAttribute('aria-pressed')!=='true';$('ctEfectos').setAttribute('aria-pressed',String(on));$('ctEfectos').textContent=on?'Efectos 35%':'Efectos 10%';setAtmosphere(on?.35:.10);};
  $('ctReiniciar').onclick=()=>chooseMode();

  /* --------------------------- Inicio y modos ------------------------------ */
  function resetPresentation(){
    visualEpoch++;for(const v of visuals.values())v.removeFromParent();visuals.clear();pending.clear();wantedKeys.clear();desiredByKey.clear();pendingEntries.clear();spentVisuals[ME].length=0;spentVisuals[FOE].length=0;graveGhosts[ME]=graveGhosts[FOE]=null;fieldSlots[ME].clear();fieldSlots[FOE].clear();handTokens[ME]=[];handTokens[FOE]=[];dropHints[ME].length=0;dropHints[FOE].length=0;hoverHand=null;hoverTable=null;hoverPreview=null;clearTablePreview();gesture=null;drag=null;
    for(const hit of handHits.values())hit.removeFromParent();handHits.clear();for(const hit of tableHits.values())hit.removeFromParent();tableHits.clear();for(const {m} of dragMarks){m.visible=false;m.material.opacity=0;}for(const impact of impacts.splice(0))releaseImpact(impact);diceRoot.visible=false;diceLight.visible=false;diceReadout.hidden=true;diceState.visible=false;diceState.estado='oculto';diceState.valor=null;diceState.caraSuperior=null;diceState.caraIndice=null;shadowDirty=true;
  }
  async function startGame(nextMode){
    modo=nextMode;ready=false;selected=null;resetPresentation();clearUI();modalHide();messageFor('Barajando los mazos de Talesyn y Gero…');
    // setupMatch conserva el lanzamiento de moneda, el segundo robo y el
    // mulligan reales. Sólo la variante final modifica el Alma inicial de Gero.
    const opts=modo==='final'?{campana:{id:'mesa-three-gero',etapa:5,alma:40,prueba:true}}:{};
    // setupMatch reproduce el mulligan y el primer turno real. La mesa debe
    // estar viva durante ese flujo: de otro modo el primer robo y, si Gero
    // empieza, su dado y sus acciones ocurren antes de que exista un visual.
    try{ready=true;await setupMatch('talesin','gero',opts);render();messageFor('La partida está en marcha.');}
    catch(e){console.error(e);messageFor('No se pudo iniciar la partida: '+e.message);modalShow({kicker:'ERROR',title:'La mesa no pudo abrirse',body:`<p>${e.message}</p>`,actions:[{t:'Reintentar',cls:'gold',fn:()=>startGame(modo)}]});}
  }
  function chooseMode(){
    modalShow({kicker:'TALESYN VS GERO',title:'Elige la partida',body:`<div class="ctMode"><button type="button" data-mode="final"><b>Final de campaña</b>Talesyn comienza con 20 Alma. Gero, jefe final, con 40 Alma.</button><button type="button" data-mode="duelo"><b>Duelo estándar</b>Los dos líderes comienzan con 20 Alma.</button></div><p>Ambas versiones usan exactamente los mazos, cartas y reglas originales.</p>`,actions:[]});
    modalBody.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>startGame(b.dataset.mode));
  }

  /* ------------------------------- Fotogramas ------------------------------ */
  let last=performance.now(),effectLevel=.10,renderBaseDpr=1,renderScale=1,frameAverage=16.7,lastQualityTune=0;
  const stageSize={w:1,h:1};
  function setAtmosphere(k){
    effectLevel=k;
    // Perfil de 10 % del demo: el tapete y las cartas siguen legibles, con
    // una única sombra económica y velas sin mapas de sombra propios.
    hemi.intensity=.22+(1-k)*.14;rim.intensity=.88-k*.22;lamp.intensity=500+150*k;scene.fog.density=.007+.021*k;
    const shadows=k>.06;renderer.shadowMap.enabled=shadows;lamp.castShadow=shadows;lamp.shadow.intensity=shadows?k:0;shadowDirty=true;
    for(const candle of candles){const on=k>.04;candle.light.visible=on;candle.flame.visible=on;candle.flame.material.opacity=on?k:0;}
  }
  setAtmosphere(.10);
  function applyRenderSize(){renderer.setPixelRatio(Math.max(.78,renderBaseDpr*renderScale));renderer.setSize(stageSize.w,stageSize.h,false);}
  function measure(){const b=stage.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height);stageSize.w=w;stageSize.h=h;renderBaseDpr=Math.min(devicePixelRatio||1,1.15);applyRenderSize();camera.aspect=w/h;camera.fov=w/h<.9?62:38;camera.updateProjectionMatrix();shadowDirty=true;}
  function tuneRenderScale(dt){
    frameAverage=frameAverage*.90+dt*1000*.10;
    if(reloj-lastQualityTune<1.4)return;
    let next=renderScale;
    if(frameAverage>20.5&&renderScale>.82)next=Math.max(.82,renderScale-.09);
    else if(frameAverage<15.2&&renderScale<1)next=Math.min(1,renderScale+.05);
    if(next!==renderScale){renderScale=next;applyRenderSize();}
    lastQualityTune=reloj;
  }
  new ResizeObserver(measure).observe(stage);measure();
  function animate(now){const dt=Math.min(.05,(now-last)/1000);last=now;reloj+=dt;tuneRenderScale(dt);factory.tiempo.value=reloj;flameClock.value=reloj;view.zoom+=(view.target-view.zoom)*Math.min(1,dt*7);view.shake=Math.max(0,view.shake-dt*1.5);const portrait=camera.aspect<.9,d=(portrait?Math.min(40,13.5/camera.aspect):20.3)*view.zoom,alt=portrait?1.2:.9;camera.position.set(Math.sin(reloj*61)*view.shake*.25,Math.sin(alt)*d+Math.cos(reloj*53)*view.shake*.2,Math.cos(alt)*d);camera.lookAt(cameraTarget.x,cameraTarget.y-(portrait?1.2:0),cameraTarget.z+(portrait?.9:.7));
    for(let i=tweens.length-1;i>=0;i--){const t=tweens[i],k=Math.min(1,(reloj-t.at)/t.d);t.fn(k);if(k>=1){tweens.splice(i,1);t.resolve();}}
    const quality=effectLevel;matFelt.emissiveIntensity=(.24+.18*quality)+(.06+.17*quality)*Math.sin(reloj*1.6);
    candles.forEach(c=>{const f=.85+.1*Math.sin(reloj*13+c.x)+.06*Math.sin(reloj*29+c.x*3);c.light.intensity=26*quality*f;c.flame.scale.set(1,f,1);candleLookAt.set(camera.position.x,c.g.position.y+c.flame.position.y,camera.position.z);c.flame.lookAt(candleLookAt);});
    animateHand(dt);animateTablePreview(dt);updateDrag(dt);
    for(const [key,v] of visuals){if(v.userData.kind==='field'&&!v.userData.dying&&!v.userData.motion){const u=v.userData.unit;if(u){const raised=(selected===u||TGT&&isTargetable(u))?.15:0;v.position.y+=(v.userData.base.y+raised-v.position.y)*Math.min(1,dt*12);}}}
    for(let i=impacts.length-1;i>=0;i--){const fx=impacts[i],age=reloj-fx.at,k=Math.min(1,age/.54);fx.ring.scale.setScalar(1+k*4*fx.power);fx.ring.material.opacity=Math.max(0,.86*(1-k));fx.light.intensity=Math.max(0,18*effectLevel*(1-k));if(k>=1){impacts.splice(i,1);releaseImpact(fx);}}
    for(let i=floating.length-1;i>=0;i--){const f=floating[i],p=worldToScreen(f.pos);f.el.style.transform=`translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;f.el.hidden=p.hide;if(now>f.until){f.el.remove();floating.splice(i,1);}}
    if(shadowDirty||diceState.visible){renderer.shadowMap.needsUpdate=true;shadowDirty=false;}
    renderer.render(scene,camera);requestAnimationFrame(animate);
  }

  /* ------------------------------ Pruebas / boot --------------------------- */
  function plain(v){return {x:Number(v.x.toFixed(4)),y:Number(v.y.toFixed(4)),z:Number(v.z.toFixed(4))};}
  function cardRect(card){
    card.updateMatrixWorld(true);camera.updateMatrixWorld(true);const box=stage.getBoundingClientRect(),xs=[],ys=[];
    for(const [x,y] of [[-ANCHO/2,-ALTO/2],[ANCHO/2,-ALTO/2],[ANCHO/2,ALTO/2],[-ANCHO/2,ALTO/2]]){const p=new THREE.Vector3(x,y,0).applyMatrix4(card.matrixWorld).project(camera);xs.push(box.left+(p.x*.5+.5)*box.width);ys.push(box.top+(.5-p.y*.5)*box.height);}const left=Math.min(...xs),top=Math.min(...ys);return {x:left,y:top,width:Math.max(1,Math.max(...xs)-left),height:Math.max(1,Math.max(...ys)-top)};
  }
  function slotRect(slot){
    slot.updateMatrixWorld(true);camera.updateMatrixWorld(true);const box=stage.getBoundingClientRect(),xs=[],ys=[],w=slot.geometry.parameters.width,h=slot.geometry.parameters.height;
    for(const [x,y] of [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]){const p=new THREE.Vector3(x,y,0).applyMatrix4(slot.matrixWorld).project(camera);xs.push(box.left+(p.x*.5+.5)*box.width);ys.push(box.top+(.5-p.y*.5)*box.height);}const left=Math.min(...xs),top=Math.min(...ys);return {x:left,y:top,width:Math.max(1,Math.max(...xs)-left),height:Math.max(1,Math.max(...ys)-top)};
  }
  function inspect(){
    const field=s=>P(s).field.map(u=>{const v=visuals.get('unit:'+u.uid),p=v?v.getWorldPosition(new THREE.Vector3()):cardPos(s,u),stat=m=>m?{escala:Number(m.scale.x.toFixed(4)),etiqueta:m.userData.fieldLabel||''}:null;return {uid:u.uid,id:u.card.id,slot:fieldSlot(s,u),centro:plain(p),ataque:stat(v?.userData?.a),vida:stat(v?.userData?.h)};});
    const hand=[...handHits.entries()].map(([key,slot])=>{const v=visuals.get(key);return {key,indice:slot.userData.index,id:slot.userData.id,rect:slotRect(slot),centro:v?plain(v.position):null,hover:hoverHand===key,escala:Number((v?.scale.x||0).toFixed(4)),anchoMundo:Number((slot.geometry.parameters.width*slot.scale.x).toFixed(4)),visible:slot.visible};}).sort((a,b)=>a.indice-b.indice);
    const focus=hoverHand&&visuals.get(hoverHand);const handFocus=focus?{key:hoverHand,rect:cardRect(focus),escala:Number(focus.scale.x.toFixed(4))}:null;
    const tableSlots=[...tableHits.entries()].map(([key,slot])=>({key,id:slot.userData.id,kind:slot.userData.kind,side:slot.userData.side,rect:slotRect(slot),hover:hoverTable===key,visible:slot.visible,centro:plain(slot.getWorldPosition(new THREE.Vector3()))}));
    const enemyHand=[...visuals.values()].filter(v=>v.userData.kind==='enemyHand').sort((a,b)=>(a.userData.handIndex||0)-(b.userData.handIndex||0)).map(v=>({centro:plain(v.getWorldPosition(new THREE.Vector3()))}));
    const leaders=[ME,FOE].map(side=>{const v=leaderVisual(side),badge=v?.userData?.soulBadge;return {side,alma:P(side).alma,badge:!!badge,badgeEscala:Number((badge?.scale.x||0).toFixed(4)),badgePos:badge?plain(badge.position):null};});
    const decks=[ME,FOE].map(side=>{const v=visuals.get('deck:'+side);return {side,visible:!!v,rotacion:v?plain(v.rotation):null};});
    return {mano:{ranuras:hand,objetivo:hoverHand,foco:handFocus},mesa:{ranuras:tableSlots,preview:{key:tablePreviewKey,visible:!!tablePreview,escala:Number((tablePreview?.scale.x||0).toFixed(4)),localX:Number((tablePreview?.position.x||0).toFixed(4)),rect:tablePreview?cardRect(tablePreview):null},seleccionado:selected?.uid||null},campo:[field(ME),field(FOE)],enemigo:{mano:enemyHand,campo:field(FOE)},lideres:leaders,mazos:decks,dado:{...diceState,centro:plain(diceRoot.position),origen:plain(DICE_LAUNCH)},rendimiento:{dpr:Number(renderer.getPixelRatio().toFixed(3)),escala:Number(renderScale.toFixed(3)),frameMs:Number(frameAverage.toFixed(2)),sombrasAutomaticas:renderer.shadowMap.autoUpdate,impactosActivos:impacts.length},animaciones:{activas:[...activeAnimations.values()].map(x=>({...x})),historial:animationHistory.map(x=>({...x}))},cementerio:[P(ME).grave.map(id=>({id})),P(FOE).grave.map(id=>({id}))]};
  }
  async function testScenario(name){
    if(!G)throw Error('La partida todavía no está lista.');G.fast=false;G.over=false;G.busy=false;G.resolving=false;G.active=ME;G.phase='principal';P(ME).pd=10;P(ME).pdMax=10;P(FOE).pd=10;P(FOE).pdMax=10;P(ME).leaderUsed=false;P(FOE).leaderUsed=false;selected=null;SEL=null;TGT=null;
    if(name==='interaccion'){
      P(ME).hand=['conserje'];P(ME).field=[];P(FOE).field=[];P(FOE).hand=['machete','conserje'];P(ME).grave=[];P(FOE).grave=[];recalc();render();await waitVisual('hand:'+handTokens[ME][0]?.serial);return inspect();
    }
    if(name==='posiciones'){
      const a=mkUnit('conserje',ME),b=mkUnit('matildus',ME),c=mkUnit('brickbrock',FOE),d=mkUnit('minus',FOE);[a,b,c,d].forEach(u=>{u.sick=false;u.attacked=false;});P(ME).hand=[];P(ME).field=[a,b];P(FOE).field=[c,d];P(FOE).hand=['machete','conserje','minus'];P(ME).grave=[];P(FOE).grave=[];recalc();render();await Promise.all([waitVisual('unit:'+a.uid),waitVisual('unit:'+b.uid),waitVisual('unit:'+c.uid),waitVisual('unit:'+d.uid)]);await sleep(760);return inspect();
    }
    if(name==='combateLetal'){
      animationHistory.length=0;activeAnimations.clear();const attacker=mkUnit('tal',ME),defender=mkUnit('conserje',FOE);attacker.sick=false;attacker.attacked=false;defender.sick=false;defender.dmg=Math.max(0,defender.maxHp-1);P(ME).hand=[];P(ME).field=[attacker];P(FOE).field=[defender];P(ME).grave=[];P(FOE).grave=[];P(FOE).hand=['machete'];G.phase='combate';recalc();render();await Promise.all([waitVisual('unit:'+attacker.uid),waitVisual('unit:'+defender.uid)]);return {atacante:attacker.uid,defensor:defender.uid,objetivoId:defender.card.id};
    }
    throw Error('Escenario visual desconocido: '+name);
  }
  window.CAOZ_MESA_THREE_COMBATE=Object.freeze({
    listo:()=>ready&&!!G,
    estado:()=>!G?null:{modo,activo:G.active,fase:G.phase,over:G.over,alma:[P(ME).alma,P(FOE).alma],pd:[P(ME).pd,P(FOE).pd],deck:[P(ME).deck.length,P(FOE).deck.length],hand:[P(ME).hand.slice(),P(FOE).hand.length],field:[P(ME).field.map(u=>({id:u.card.id,uid:u.uid})),P(FOE).field.map(u=>({id:u.card.id,uid:u.uid}))],gracia:P(ME).gracia,ascended:P(ME).ascended,corte:P(FOE).corte},
    empezar:m=>startGame(m||modo),
    acabarTurno:()=>pedirTerminarTurno(),
    jugar:id=>playFromHand(ME,id),
    atacar:async(uid,target)=>{const u=P(ME).field.find(x=>x.uid===uid);if(!u)return false;await tryAttack(u,target==='face'?'face':P(FOE).field.find(x=>x.uid===target));await sleep(650);return true;},
    avanzar:async s=>{await sleep(s*1000);return this.estado?.();},
    seguridad:()=>({cartas:[...visuals.values()].filter(v=>v.parent===table).map(v=>({key:v.userData.key,y:v.position.y,kind:v.userData.kind})),zoom:view.zoom}),
    inspeccion:inspect,
    pruebas:Object.freeze({escenario:testScenario,tirarDado:async({valor=13}={})=>{const old=G?.fast;if(G)G.fast=false;try{return await showD20(valor,'Prueba de d20',false,{min:10,siOk:'La tirada queda registrada.'},physicalFor(valor));}finally{if(G)G.fast=old;}}})
  });
  async function boot(){try{await CAOZ_CARTA_PINTOR.fuentes();if(typeof cargarArte==='function')await cargarArte();await skinLikeDemo();setLogOpen(false);ready=true;sync();requestAnimationFrame(animate);if(CAPTURA){await startGame(qs.get('modo')||'duelo');}else chooseMode();}catch(e){console.error(e);messageFor('No se pudo preparar la mesa: '+e.message);}}
  boot();
})();

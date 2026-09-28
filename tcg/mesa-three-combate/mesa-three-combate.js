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
  const logEl=$('ctLog'),meHud=$('ctMeHud'),enemyHud=$('ctEnemyHud'),turnEl=$('ctTurn'),leaderBtn=$('ctLeader'),abilityBtn=$('ctAbility'),endBtn=$('ctEnd');
  if(CAPTURA)document.documentElement.dataset.captura='';
  if(!document.createElement('canvas').getContext('webgl2')){message.textContent='Este navegador necesita WebGL 2 para abrir la mesa.';return;}
  const {THREE}=window.CAOZ_THREE;
  const Carta=window.CAOZ_THREE_CARTA,{ANCHO,ALTO,GROSOR,GEMAS}=Carta;
  const ESC=.60,ALTURA=.035+GROSOR*ESC/2,TAU=Math.PI*2;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let modo=qs.get('modo')==='duelo'?'duelo':'final',reloj=0,ready=false,ocupadoFx=0,selected=null,logCount=0,visualEpoch=0;
  const tweens=[],visuals=new Map(),pending=new Set(),floating=[],animationHistory=[],activeAnimations=new Map(),impacts=[];
  const layout=Object.freeze({
    leader:{x:-7.15,z:3.65}, deck:{x:7.25,z:4.25},grave:{x:7.25,z:1.75},soul:{x:-4.55,z:5.1},pd:{x:-7.35,z:5.08},
    trapZ:3.12,relicX:-2.45,enemyHandZ:-6.5
  });
  const sideZ=s=>s===ME?1:-1;
  const sideName=s=>s===ME?'Talesyn':'Gero';
  const sideColor=s=>s===ME?0x8ad6ff:0xffa174;
  const has=typeof G!=='undefined';
  if(!has){message.textContent='No se pudo cargar el motor del juego.';return;}

  /* --------------------------- Escena y tapete --------------------------- */
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURA});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x07050b);scene.fog=new THREE.FogExp2(0x080610,.028);
  const camera=new THREE.PerspectiveCamera(39,1,.1,90);camera.position.set(0,13.6,20.3);camera.lookAt(0,0,.3);scene.add(camera);
  const cameraTarget=new THREE.Vector3(0,0,.35),view={zoom:1,target:1,shake:0};
  const table=new THREE.Group();scene.add(table);
  const hemi=new THREE.HemisphereLight(0xb1b8e8,0x170b08,.40);scene.add(hemi);
  const lamp=new THREE.SpotLight(0xffd8a2,520,0,.67,.58,1.6);lamp.position.set(0,14,3);lamp.target.position.set(0,0,0);lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.near=1;lamp.shadow.camera.far=32;lamp.shadow.normalBias=.02;lamp.shadow.radius=1;scene.add(lamp,lamp.target);
  const rim=new THREE.DirectionalLight(0x93a8ff,.8);rim.position.set(-8,7,-11);scene.add(rim);
  const handLight=new THREE.PointLight(0xffecd3,68,12,2);handLight.position.set(-3.6,2.7,-3.6);camera.add(handLight);
  const handFill=new THREE.PointLight(0xc3d7ff,22,11,2);handFill.position.set(3,1,-3.5);camera.add(handFill);
  const envScene=new THREE.Scene();envScene.background=new THREE.Color(0x090610);
  for(const [x,y,z,c,i] of [[0,8,2,0xffca8a,5],[-5,4,-8,0x708fe8,2],[7,2,7,0xff794d,2]]){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(5,4),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i),side:THREE.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);envScene.add(p);
  }
  scene.environment=new THREE.PMREMGenerator(renderer).fromScene(envScene,.04).texture;scene.environmentIntensity=.72;
  function canvasTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
  const wood=canvasTexture(768,768,(g,w,h)=>{g.fillStyle='#442516';g.fillRect(0,0,w,h);for(let i=0;i<140;i++){const y=Math.random()*h;g.strokeStyle=`rgba(${45+Math.random()*75},${18+Math.random()*42},${4+Math.random()*25},.32)`;g.lineWidth=1+Math.random()*4;g.beginPath();g.moveTo(0,y);for(let x=0;x<w;x+=45)g.lineTo(x,y+Math.sin(x*.025+i)*8);g.stroke();}});
  const slab=new THREE.Mesh(new THREE.BoxGeometry(24,.72,17),new THREE.MeshPhysicalMaterial({map:wood,roughness:.43,clearcoat:.35,clearcoatRoughness:.25}));slab.position.y=-.37;slab.castShadow=slab.receiveShadow=true;table.add(slab);
  const feltTex=canvasTexture(1500,1050,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,20,w/2,h/2,w*.65);r.addColorStop(0,'#36215d');r.addColorStop(1,'#120923');g.fillStyle=r;g.fillRect(0,0,w,h);g.strokeStyle='#d5a64d';g.lineWidth=11;g.strokeRect(30,30,w-60,h-60);g.lineWidth=2;g.strokeRect(52,52,w-104,h-104);for(let i=0;i<3300;i++){g.fillStyle=`rgba(255,255,255,${Math.random()*.035})`;g.fillRect(Math.random()*w,Math.random()*h,2,2);}});
  const felt=new THREE.Mesh(new THREE.PlaneGeometry(18,12.6),new THREE.MeshPhysicalMaterial({map:feltTex,roughness:.88,metalness:.18,clearcoat:.12}));felt.rotation.x=-Math.PI/2;felt.position.y=.002;felt.receiveShadow=true;table.add(felt);
  // La maqueta original tenía un tapete grabado: cada puesto libre era una
  // diana rúnica y el centro llevaba la escritura del Domo. Se conserva en
  // una capa transparente bajo las cartas para que siga viéndose como una
  // mesa física, no como una cuadrícula utilitaria.
  const matMarks=canvasTexture(1500,1050,(g,w,h)=>{
    const worldW=18,worldH=12.6,toPx=(x,z)=>[w*.5+x/worldW*w,h*.5+z/worldH*h],scale=w/worldW;
    const rounded=(x,z,pw,ph)=>{const [cx,cy]=toPx(x,z),rw=pw*scale,rh=ph*scale,r=Math.min(rw,rh)*.095;g.beginPath();g.roundRect(cx-rw*.5,cy-rh*.5,rw,rh,r);g.stroke();};
    const dial=(x,z,r=.46)=>{const [cx,cy]=toPx(x,z),radius=r*scale;g.save();g.shadowColor='rgba(255,191,84,.72)';g.shadowBlur=10;g.strokeStyle='rgba(255,198,90,.82)';g.lineWidth=3.2;g.beginPath();g.arc(cx,cy,radius,0,TAU);g.stroke();g.shadowBlur=0;for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2,inner=radius*.64,outer=radius*1.22;g.beginPath();g.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);g.lineTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer);g.stroke();}g.restore();};
    const panel=(x,z,pw,ph,mark=false)=>{g.save();g.strokeStyle='rgba(5,2,16,.72)';g.lineWidth=7;rounded(x,z,pw,ph);g.strokeStyle='rgba(133,102,187,.34)';g.lineWidth=1.8;rounded(x,z,pw-.12,ph-.12);g.restore();if(mark)dial(x,z);};
    const fieldW=ANCHO*ESC+.18,fieldH=ALTO*ESC+.18,trapW=ALTO*ESC*.78,trapH=ANCHO*ESC*.78;
    for(const s of [ME,FOE]){const sign=sideZ(s);for(let i=0;i<5;i++)panel((i-2)*2,sign*1.58,fieldW,fieldH,true);for(let i=0;i<3;i++)panel((i-1)*2.05,sign*layout.trapZ,trapW,trapH);panel(layout.leader.x,sign*layout.leader.z,fieldW*1.12,fieldH*1.12,true);panel(layout.deck.x,sign*layout.deck.z,fieldW,fieldH);panel(layout.grave.x,sign*layout.grave.z,fieldW,fieldH);}
    const [x0,y0]=toPx(-7.65,0),[x1,y1]=toPx(7.65,0);g.save();g.strokeStyle='rgba(255,196,86,.68)';g.shadowColor='rgba(255,183,61,.42)';g.shadowBlur=8;g.lineWidth=2.1;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();g.shadowBlur=0;g.font=`${Math.round(scale*.29)}px Georgia`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='rgba(255,214,130,.78)';const glyphs='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';for(let i=0;i<36;i++){const x=-7.25+i*.414;if(Math.abs(x)<1.35)continue;const [px,py]=toPx(x,0);g.fillText(glyphs[i%glyphs.length],px,py-scale*.17);}g.restore();
  });
  const marks=new THREE.Mesh(new THREE.PlaneGeometry(18,12.6),new THREE.MeshBasicMaterial({map:matMarks,transparent:true,opacity:.94,depthWrite:false,toneMapped:false}));marks.rotation.x=-Math.PI/2;marks.position.y=.008;table.add(marks);
  const lineMat=new THREE.LineBasicMaterial({color:0xdcae50,transparent:true,opacity:.43});
  function zone(x,z,w,h){const pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([a,b])=>new THREE.Vector3(x+a,.012,z+b));table.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));}
  for(const s of [ME,FOE]){const sign=sideZ(s);for(let i=0;i<5;i++)zone((i-2)*2,sign*1.58,ANCHO*ESC+.18,ALTO*ESC+.18);for(let i=0;i<3;i++)zone((i-1)*2.05,sign*layout.trapZ,ALTO*ESC*.78,ANCHO*ESC*.78);zone(layout.leader.x,sign*layout.leader.z,ANCHO*ESC*1.12,ALTO*ESC*1.12);zone(layout.deck.x,sign*layout.deck.z,ANCHO*ESC,ALTO*ESC);zone(layout.grave.x,sign*layout.grave.z,ANCHO*ESC,ALTO*ESC);}
  const rune=new THREE.Mesh(new THREE.TorusGeometry(.7,.024,10,60),new THREE.MeshBasicMaterial({color:0xffc25d,transparent:true,opacity:.65}));rune.rotation.x=-Math.PI/2;rune.position.y=.018;table.add(rune);
  const candles=[];for(const [x,z] of [[-9.2,-5.65],[9.2,-5.65]]){const g=new THREE.Group();g.position.set(x,0,z);table.add(g);const holder=new THREE.Mesh(new THREE.CylinderGeometry(.65,.78,.15,32),new THREE.MeshPhysicalMaterial({color:0xdfaf56,metalness:1,roughness:.25}));holder.position.y=.08;g.add(holder);const wax=new THREE.Mesh(new THREE.CylinderGeometry(.27,.3,2.25,24),new THREE.MeshPhysicalMaterial({color:0xf4e7cf,roughness:.5}));wax.position.y=1.2;g.add(wax);const flame=new THREE.Mesh(new THREE.SphereGeometry(.23,16,12),new THREE.MeshBasicMaterial({color:0xffd47a,toneMapped:false}));flame.scale.y=2.3;flame.position.y=2.58;g.add(flame);const light=new THREE.PointLight(0xff9a43,2.6,12,2);light.position.y=2.6;g.add(light);candles.push({g,flame,light});}

  /* ------------------------ Cartas físicas y recursos --------------------- */
  const factory=Carta.fabrica(THREE,renderer),textures=new Map();
  const back=(()=>{const c=document.createElement('canvas');c.width=640;c.height=900;const g=c.getContext('2d');const r=g.createRadialGradient(320,360,20,320,430,550);r.addColorStop(0,'#5a377c');r.addColorStop(1,'#10091a');g.fillStyle=r;g.fillRect(0,0,640,900);g.strokeStyle='#dfb75c';g.lineWidth=22;g.strokeRect(30,30,580,840);g.lineWidth=5;g.strokeRect(52,52,536,796);g.fillStyle='#ecd28d';g.font='700 60px Georgia';g.textAlign='center';g.fillText('CAOZ',320,420);g.font='28px Georgia';g.fillText('CON TODO',320,466);return factory.materialDorso({color:c,normal:c});})();
  back.map.colorSpace=THREE.SRGBColorSpace;
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
  const handHits=new Map(),visualWaiters=new Map(),desiredByKey=new Map(),pendingEntries=new Map();
  const spentVisuals=[[],[]],graveGhosts=[null,null];
  let nextHandToken=1,hoverHand=null,hoverUV=new THREE.Vector2(.5,.5),gesture=null,drag=null;
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
  const cardPos=(s,u)=>new THREE.Vector3((fieldSlot(s,u)-2)*2,ALTURA,sideZ(s)*1.58);
  function reconcileHandTokens(s,ids){
    const pools=new Map();for(const token of handTokens[s]){const list=pools.get(token.id)||[];list.push(token);pools.set(token.id,list);}
    handTokens[s]=ids.map(id=>{const old=pools.get(id)?.shift();return old||{id,serial:nextHandToken++};});
    return handTokens[s];
  }
  function fieldCenter(s,u){return cardPos(s,u);}
  // Señales de arrastre: se superponen a las dianas ya grabadas, sólo mientras
  // una carta busca un puesto libre. Nunca sustituyen el tapete ni su runería.
  const dragMarks=FIELD_ORDER.map(slot=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(ANCHO*ESC+.1,ALTO*ESC+.12),new THREE.MeshBasicMaterial({color:0xffd06a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set((slot-2)*2,.026,sideZ(ME)*1.58);m.visible=false;table.add(m);return {slot,m};});
  const trapPos=(s,i)=>new THREE.Vector3((i-1)*2.05,ALTURA,sideZ(s)*layout.trapZ);
  const deckPos=s=>new THREE.Vector3(layout.deck.x,ALTURA,sideZ(s)*layout.deck.z);
  const gravePos=s=>new THREE.Vector3(layout.grave.x,ALTURA,sideZ(s)*layout.grave.z);
  const leaderPos=s=>new THREE.Vector3(layout.leader.x,ALTURA+.012,sideZ(s)*layout.leader.z);
  function editionFor(id){return id==='tal'||id==='lider_talesin'||id==='lider_gero'?'dorado':'normal';}
  function image(url){return new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url;});}
  async function textureFor(id,edition='normal'){
    const key=id+'/'+edition;if(textures.has(key))return textures.get(key);
    const entry=(typeof ARTE!=='undefined'&&ARTE[id])||{};const variation=edition!=='normal'?entry.variantes?.[edition]:null;const url=variation?.url||entry.url||'art/'+id+'.webp';const img=await image('./'+url);
    const tx=factory.texturas(CAOZ_CARTA_PINTOR.texturas({id,acabado:edition,arte:{img,enc:{x:variation?.x??entry.x??50,y:variation?.y??entry.y??50,z:variation?.z??entry.z??100}},ancho:560,cifras:false}));textures.set(key,tx);return tx;
  }
  function digit(n,color){const tex=canvasTexture(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.font="900 76px Georgia";g.textAlign='center';g.textBaseline='middle';g.lineWidth=10;g.strokeStyle='#160d0d';g.strokeText(String(n),w/2,h/2+5);g.fillStyle=color;g.fillText(String(n),w/2,h/2+5);});const m=new THREE.Mesh(new THREE.CircleGeometry(1,28),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthWrite:false}));m.userData.tex=tex;return m;}
  function putGem(mesh,[x,y,r]){mesh.position.set((x/1024-.5)*ANCHO,(.5-y/1434)*ALTO,GROSOR/2+.006);mesh.scale.setScalar(r/1024*ANCHO*.78);return mesh;}
  function paintDigit(mesh,n,color){const c=mesh.userData.tex.image,g=c.getContext('2d'),w=c.width,h=c.height;g.clearRect(0,0,w,h);g.font="900 76px Georgia";g.textAlign='center';g.textBaseline='middle';g.lineWidth=10;g.strokeStyle='#160d0d';g.strokeText(String(n),w/2,h/2+5);g.fillStyle=color;g.fillText(String(n),w/2,h/2+5);mesh.userData.tex.needsUpdate=true;}
  async function makeCard(key,id,opt={}){
    const epoch=opt.epoch??visualEpoch,ed=opt.edition||editionFor(id),tx=opt.back?null:await textureFor(id,ed);if(epoch!==visualEpoch||!wantedKeys.has(key))return null;
    const face=opt.back?back:factory.materialCara(tx,ed),card=factory.carta(face,back,factory.materialCanto(ed));card.scale.setScalar(opt.scale||ESC);card.userData.key=key;card.userData.id=id;card.userData.kind=opt.kind;card.userData.side=opt.side;card.userData.unit=opt.unit||null;card.userData.base=new THREE.Vector3();card.userData.edition=ed;
    if(!opt.back&&CARDS[id]?.t==='personaje'){
      const a=putGem(digit(opt.unit?.atk??CARDS[id].a??0,'#fff1d8'),GEMAS.atq),h=putGem(digit(Math.max(0,(opt.unit?.maxHp??CARDS[id].h??0)-(opt.unit?.dmg??0)),'#fff1d8'),GEMAS.vida);card.add(a,h);card.userData.a=a;card.userData.h=h;
    }
    if(!opt.back&&CARDS[id]){const c=putGem(digit(opt.cost??CARDS[id].c,'#f6edff'),GEMAS.coste);card.add(c);card.userData.c=c;}
    card.traverse(o=>{if(o.isMesh){o.castShadow=opt.kind!=='hand';o.receiveShadow=true;}});
    table.add(card);visuals.set(key,card);wakeVisual(key,card);return card;
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
  function liveCard(card,u){if(!card||!u)return;card.userData.unit=u;if(card.userData.a)paintDigit(card.userData.a,u.atk,u.atk>(u.card.a||0)?'#9effb1':'#fff1d8');if(card.userData.h)paintDigit(card.userData.h,Math.max(0,u.maxHp-u.dmg),u.dmg?'#ff9e90':'#fff1d8');const material=card.userData.frente.material;material.emissive=material.emissive||new THREE.Color();let glow=0;if(TGT&&isTargetable(u))glow=0x356040;else if(selected===u)glow=0x5a4210;material.emissive.setHex(glow);material.emissiveIntensity=glow?.55:0;}
  function genericBack(key,side,index,zone='deck'){return {key,id:'conserje',back:true,side,index,kind:zone,scale:zone==='enemyHand'?.67:ESC};}

  /* --------------------------- Sincronizar motor --------------------------- */
  function desired(){
    if(!G)return [];reconcileFieldSlots();const out=[];
    for(const s of [ME,FOE]){
      const p=P(s),sign=sideZ(s);out.push({key:'leader:'+s,id:'lider_'+p.leaderId,side:s,kind:'leader',scale:ESC*1.1,pos:leaderPos(s),rot:new THREE.Euler(-Math.PI/2,0,0)});
      p.field.forEach(u=>out.push({key:'unit:'+u.uid,id:u.card.id,side:s,unit:u,kind:'field',slot:fieldSlot(s,u),pos:cardPos(s,u),rot:new THREE.Euler(-Math.PI/2,0,0)}));
      p.traps.forEach((t,i)=>out.push({key:'trap:'+s+':'+i,id:t.id,side:s,kind:'trap',back:s===FOE,pos:trapPos(s,i),rot:new THREE.Euler(-Math.PI/2+(s===FOE?Math.PI:0),0,Math.PI/2),scale:ESC*.78}));
      p.relics.forEach((r,i)=>out.push({key:'relic:'+s+':'+i,id:r.id,side:s,kind:'relic',pos:new THREE.Vector3(layout.relicX+i*1.48,ALTURA,sign*4.9),rot:new THREE.Euler(-Math.PI/2,0,0),scale:ESC*.66}));
      if(p.deck.length)out.push({key:'deck:'+s,id:'conserje',side:s,kind:'deck',back:true,pos:deckPos(s),rot:new THREE.Euler(-Math.PI/2+Math.PI,0,.035),scale:ESC});
      if(p.grave.length){const id=p.grave.at(-1);out.push({key:'grave:'+s,id,side:s,kind:'grave',pos:gravePos(s),rot:new THREE.Euler(-Math.PI/2,0,-.05),scale:ESC*.94});}
    }
    if(G.place)out.push({key:'place',id:G.place.id,side:G.place.side,kind:'place',pos:new THREE.Vector3(0,ALTURA,0),rot:new THREE.Euler(-Math.PI/2,0,0),scale:ESC*.82});
    const own=reconcileHandTokens(ME,P(ME).hand);own.forEach((token,i)=>out.push({key:'hand:'+token.serial,id:token.id,side:ME,kind:'hand',handIndex:i,token}));
    const enemy=reconcileHandTokens(FOE,P(FOE).hand);enemy.forEach((token,i)=>out.push({key:'enemy-hand:'+token.serial,id:'conserje',side:FOE,kind:'enemyHand',back:true,handIndex:i,token,scale:.67}));
    return out;
  }
  function handPose(i,n){const k=i-(n-1)/2,portrait=camera.aspect<.86,sep=portrait?.52:.92,z=portrait?-8.4:-7.1;return {pos:new THREE.Vector3(k*sep,(portrait?-3.25:-2.43)-Math.abs(k)*.07,z+i*.013),rot:new THREE.Euler(-.11,0,-k*.075),scale:ESC};}
  function enemyHandPose(i,n){const k=i-(n-1)/2,scale=.66,step=ANCHO*scale+.1;return {pos:new THREE.Vector3(k*step,1.12+i*.02,layout.enemyHandZ+i*.025),rot:new THREE.Euler(-1.09,Math.PI,k*.035),scale};}
  function makeHitSlot(d,p){
    let slot=handHits.get(d.key);if(!slot){slot=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.46,Math.min(ANCHO*.58,(camera.aspect<.86?.52:.92)*.96)),ALTO*.96),hitMaterial);slot.userData.key=d.key;handHitRoot.add(slot);handHits.set(d.key,slot);}
    slot.visible=true;slot.userData.id=d.id;slot.userData.index=d.handIndex;slot.position.copy(p.pos);slot.rotation.copy(p.rot);slot.scale.setScalar(p.scale);return slot;
  }
  function updateHandHitSlots(list){
    const active=new Set();for(const d of list)if(d.kind==='hand'){active.add(d.key);makeHitSlot(d,handPose(d.handIndex,P(ME).hand.length));}
    for(const [key,slot] of handHits)if(!active.has(key)){slot.visible=false;handHits.delete(key);slot.removeFromParent();}
  }
  function takeOutgoing(side,id,kind){
    const candidates=[...visuals.entries()].filter(([key,v])=>v.userData.side===side&&v.userData.kind===kind&&!wantedKeys.has(key)&&(kind!=='hand'||v.userData.id===id));
    const pair=candidates[0];if(!pair)return null;const [key,v]=pair;return {key,v,pose:poseWorld(v)};
  }
  function adoptVisual(from,d,entry){
    visuals.delete(from.key);from.v.userData.key=d.key;from.v.userData.id=d.id;from.v.userData.kind=d.kind;from.v.userData.side=d.side;from.v.userData.unit=d.unit||null;visuals.set(d.key,from.v);pendingEntries.set(d.key,{...entry,source:entry.source||from.pose});
  }
  function prepareTransitions(list){
    for(const d of list)if(d.kind==='field'&&!visuals.has(d.key)&&!pendingEntries.has(d.key)){
      let from=takeOutgoing(d.side,d.id,'hand');
      if(from){adoptVisual(from,d,{type:'entrada',source:from.pose});continue;}
      if(d.side===FOE){from=takeOutgoing(FOE,d.id,'enemyHand');if(from){from.v.removeFromParent();visuals.delete(from.key);pendingEntries.set(d.key,{type:'entrada-rival',source:from.pose});continue;}}
      pendingEntries.set(d.key,{type:'invocacion',source:{pos:deckPos(d.side).add(new THREE.Vector3(0,.35,0)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+Math.PI,0,0)),scale:ESC*.72}});
    }
    for(const d of list)if(d.kind==='grave'&&!visuals.has(d.key)){
      const ghost=graveGhosts[d.side];if(ghost&&ghost.id===d.id){graveGhosts[d.side]=null;ghost.v.userData.key=d.key;ghost.v.userData.kind='grave';ghost.v.userData.side=d.side;visuals.set(d.key,ghost.v);pendingEntries.set(d.key,{type:'cementerio',source:ghost.pose});}
    }
  }
  function spendDepartures(){
    for(const [key,v] of [...visuals])if(!wantedKeys.has(key)&&!v.userData.dying&&!v.userData.motion){
      if(v.userData.kind==='hand'||v.userData.kind==='enemyHand')spentVisuals[v.userData.side].push({id:v.userData.id,back:v.userData.kind==='enemyHand',v,pose:poseWorld(v)});
      v.removeFromParent();visuals.delete(key);
    }
  }
  function beginEntry(v,d,entry){
    if(!entry||v.userData.motion)return;placeWorld(v,entry.source);v.userData.base.copy(d.pos);
    if(entry.type==='cementerio'){
      setDissolve(v,1);v.visible=true;motion(v,'materializar-cementerio',()=>tween(.42,k=>{const e=ease(k);v.position.lerpVectors(entry.source.pos,d.pos,e);v.quaternion.slerpQuaternions(entry.source.q,new THREE.Quaternion().setFromEuler(d.rot),e);v.scale.setScalar(THREE.MathUtils.lerp(entry.source.scale,d.scale||ESC*.94,e));setDissolve(v,1-e);}));
      return;
    }
    flyCard(v,d.pos.clone().add(new THREE.Vector3(0,.26,0)),d.rot,entry.type==='entrada-rival'?.56:.48,entry.type==='invocacion'?1.75:1.22,d.scale||ESC,entry.type).then(()=>{if(d.kind==='field')impact(v,d);});
  }
  function sync(){
    if(!ready||!G)return;const list=desired();wantedKeys.clear();desiredByKey.clear();list.forEach(x=>{wantedKeys.add(x.key);desiredByKey.set(x.key,x);});
    updateHandHitSlots(list);prepareTransitions(list);spendDepartures();
    for(const d of list){let v=visuals.get(d.key);if(!v&&!pending.has(d.key)){pending.add(d.key);makeCard(d.key,d.id,{...d,epoch:visualEpoch}).then(x=>{pending.delete(d.key);const fresh=desiredByKey.get(d.key);if(x&&fresh){applyVisual(x,fresh);const entry=pendingEntries.get(d.key);if(entry){pendingEntries.delete(d.key);beginEntry(x,fresh,entry);}}}).catch(e=>{pending.delete(d.key);toast('No se pudo pintar una carta: '+e.message);});}
      if(v){applyVisual(v,d);const entry=pendingEntries.get(d.key);if(entry){pendingEntries.delete(d.key);beginEntry(v,d,entry);}}
    }
    drawResources();updateHUD();
  }
  function applyVisual(v,d){
    if(!wantedKeys.has(d.key))return;
    v.userData.kind=d.kind;v.userData.side=d.side;v.userData.unit=d.unit||null;v.userData.id=d.id;
    if(d.kind==='hand'){const n=P(ME).hand.length,p=handPose(d.handIndex,n);v.userData.handPose=p;if(v.parent!==camera)camera.add(v);if(!v.userData.motion&&!v.userData.dragging)setCardPose(v,p.pos,p.rot,p.scale);const m=v.userData.frente.material;m.envMap=scene.environment;m.envMapIntensity=.82;m.clearcoat=.12;m.emissive=new THREE.Color(0x70583b);m.emissiveIntensity=.46;}
    else {if(v.parent!==table)table.attach(v);let pos=d.pos,rot=d.rot,sc=d.scale||ESC;if(d.kind==='enemyHand'){const p=enemyHandPose(d.handIndex,P(FOE).hand.length);pos=p.pos;rot=p.rot;sc=p.scale;}if(!v.userData.motion&&!v.userData.dragging)setCardPose(v,pos,rot,sc);if(d.kind==='field')liveCard(v,d.unit);}
    if(d.kind==='deck'){const p=P(d.side);for(const ch of v.children)ch.visible=true;v.position.y=ALTURA+Math.min(15,p.deck.length)*GROSOR*ESC*.055;}
    if(d.kind==='grave')v.position.y=ALTURA+Math.min(10,P(d.side).grave.length)*GROSOR*ESC*.09;
  }

  /* ----------------------------- Alma / PD -------------------------------- */
  const resourceRoot=new THREE.Group();table.add(resourceRoot);const gems={},souls={};
  function soulMesh(s){const group=new THREE.Group(),base=new THREE.Mesh(new THREE.CylinderGeometry(.5,.67,.14,32),new THREE.MeshPhysicalMaterial({color:0xdcae50,metalness:1,roughness:.28})),crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.62,0),new THREE.MeshPhysicalMaterial({color:s===ME?0xa3d7ff:0xffa6ac,transmission:.65,thickness:.7,roughness:.06,emissive:new THREE.Color(s===ME?0x165784:0x851c33),emissiveIntensity:.55}));base.position.y=.07;crystal.position.y=.76;crystal.scale.y=1.34;group.add(base,crystal);group.position.set(layout.soul.x,0,sideZ(s)*layout.soul.z);resourceRoot.add(group);return {group,crystal};}
  function pdMesh(s){const root=new THREE.Group();resourceRoot.add(root);const list=[];for(let i=0;i<10;i++){const g=new THREE.Mesh(new THREE.OctahedronGeometry(.17,0),new THREE.MeshPhysicalMaterial({color:0xd1c3ff,transmission:.3,roughness:.08,emissive:0x452180,emissiveIntensity:.08}));g.position.set(layout.pd.x+(i%5)*.46,.23,sideZ(s)*(layout.pd.z-Math.floor(i/5)*.38));root.add(g);list.push(g);}return list;}
  for(const s of [ME,FOE]){souls[s]=soulMesh(s);gems[s]=pdMesh(s);}
  function drawResources(){if(!G)return;for(const s of [ME,FOE]){const p=P(s);souls[s].crystal.rotation.y=reloj*(s===ME?.45:-.45);souls[s].crystal.scale.set(.8,1.25,.8);gems[s].forEach((g,i)=>{const on=i<p.pd;g.material.emissiveIntensity=on?1.25:.045;g.material.color.setHex(on?0xe4d6ff:0x382c48);g.position.y=.23+(on?Math.sin(reloj*2+i)*.035:0);});}}

  /* ------------------------------ UI model -------------------------------- */
  function strip(html){const div=document.createElement('div');div.innerHTML=String(html||'');return div.textContent||'';}
  function pill(name,value,kind=''){return `<span class="ctPill ${kind}">${name} <b>${value}</b></span>`;}
  function playerHUD(s){const p=P(s),extra=[];if(p.leaderId==='talesin')extra.push(p.ascended?'<span class="ctPill gracia">😇 Ascendido</span>':pill('✨',p.gracia+'/5','gracia'));if(p.corte?.turnos)extra.push(pill('👑',p.corte.turnos+'/2','corte'));if(p.relics.length)extra.push(`<span class="ctPill">✦ ${p.relics.map(r=>CARDS[r.id].n).join(', ')}</span>`);return `<b>${p.L.n}</b>${pill('♥',Math.max(0,p.alma),'alma')}${pill('◆',p.pd+'/'+p.pdMax,'pd')}${pill('🗝',keys(s))}${extra.join('')}`;}
  function updateHUD(){if(!G)return;meHud.innerHTML=playerHUD(ME);enemyHud.innerHTML=playerHUD(FOE);turnEl.textContent=G.over?'Partida terminada':`${G.active===ME?'Tu turno':'Turno de Gero'} · ${G.phase||'preparando'} · ronda ${Math.max(1,Math.ceil(G.turnNo/2))}`;leaderBtn.textContent=`${P(ME).L.art} ${P(ME).L.habName} (${P(ME).L.habCost} PD)`;leaderBtn.disabled=G.active!==ME||G.busy||G.over||!canUseLeader(ME);abilityBtn.disabled=!selected||G.active!==ME||G.busy||G.over||!canUseAct(selected);abilityBtn.textContent=selected?.card.act?`${selected.card.act.n} (${selected.card.act.cost} PD)`:'Habilidad de carta';}
  function messageFor(t,cls=''){message.textContent=strip(t);message.className='ctMessage '+cls;}
  function showPrompt(text,options=[]){prompt.hidden=false;prompt.innerHTML=`<p>${text}</p><div class="ctPromptActions">${options.map((o,i)=>`<button type="button" data-ct-opt="${i}" class="${o.cls||''}">${o.t}</button>`).join('')}</div>`;prompt.querySelectorAll('[data-ct-opt]').forEach(b=>b.onclick=()=>options[Number(b.dataset.ctOpt)]?.fn?.());}
  function clearUI(){prompt.hidden=true;prompt.replaceChildren();}
  function modalShow({kicker='EL DOMO ESPERA',title,body='',actions=[]}){modalKicker.textContent=kicker;modalTitle.textContent=title;modalBody.innerHTML=body;modalActions.innerHTML='';actions.forEach(a=>{const b=document.createElement('button');b.type='button';b.textContent=a.t;b.className=a.cls||'';b.onclick=a.fn;modalActions.append(b);});modal.hidden=false;}
  function modalHide(){modal.hidden=true;}
  function floatAt(pos,text,kind='note'){const el=document.createElement('div');el.className='ctFloat '+kind;el.textContent=text;labels.append(el);floating.push({el,pos:pos.clone(),until:performance.now()+900});}
  function worldToScreen(pos){const v=pos.clone().project(camera),b=stage.getBoundingClientRect();return {x:(v.x*.5+.5)*b.width,y:(.5-v.y*.5)*b.height,hide:v.z>1};}
  function unitPos(u){const v=visuals.get('unit:'+u?.uid);return v?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();}
  function soulPos(s){return souls[s].group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.2,0));}

  /* --------------------- Contrato del motor: UI / FX ---------------------- */
  globalThis.nap=ms=>sleep(Math.min(ms,G?.fast?1:Math.max(80,Math.min(420,ms))));
  // El motor pregunta esto para no disparar pasivas durante un paso didáctico.
  // Esta pantalla no carga el tutorial HTML, así que la pasiva siempre procede.
  globalThis.tutPasivaLista=()=>true;
  globalThis.render=()=>{sync();};
  globalThis.log=(text,cls='sys')=>{if(!G)return;G.log.push({txt:text,cls:cls||''});const p=document.createElement('p');p.className=cls||'';p.textContent=strip(text);logEl.prepend(p);while(logEl.children.length>18)logEl.lastElementChild.remove();logCount++;};
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
     genera la simulación firmada; esta capa sólo interpola sus fotogramas. */
  const diceRoot=new THREE.Group(),diceState={visible:false,estado:'oculto',valor:null,frames:0};table.add(diceRoot);diceRoot.visible=false;
  const diceMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),new THREE.MeshPhysicalMaterial({color:0x6d1834,metalness:.72,roughness:.23,clearcoat:.75,emissive:0x210410,emissiveIntensity:.32,flatShading:true}));diceMesh.castShadow=true;diceMesh.receiveShadow=true;diceRoot.add(diceMesh);
  const diceReadout=document.createElement('div');diceReadout.className='ctDiceReadout';diceReadout.hidden=true;stage.append(diceReadout);
  if(globalThis.CAOZ_D20?.caras){for(const face of globalThis.CAOZ_D20.caras){const tx=canvasTexture(96,96,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#fff0ba';g.font='900 46px Georgia';g.textAlign='center';g.textBaseline='middle';g.shadowColor='#24030d';g.shadowBlur=5;g.fillText(String(face.valor),w/2,h/2+2);});const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false}));sprite.position.set(face.n[0]*.565,face.n[1]*.565,face.n[2]*.565);sprite.scale.set(.22,.22,.22);diceRoot.add(sprite);}}
  function unitQuat(q){const out=new THREE.Quaternion(q[0],q[1],q[2],q[3]);return out.normalize();}
  function diceAt(tirada,t){const frames=tirada.frames||[],last=frames.at(-1);if(!last)return;let i=0;while(i<frames.length-2&&frames[i+1].t<t)i++;const a=frames[i],b=frames[Math.min(i+1,frames.length-1)],k=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t||1))),sign=a.q[0]*b.q[0]+a.q[1]*b.q[1]+a.q[2]*b.q[2]+a.q[3]*b.q[3]<0?-1:1;
    diceRoot.position.set(a.p[0]+(b.p[0]-a.p[0])*k,.06+a.p[1]+(b.p[1]-a.p[1])*k,a.p[2]+(b.p[2]-a.p[2])*k);diceRoot.quaternion.copy(unitQuat(a.q)).slerp(unitQuat([b.q[0]*sign,b.q[1]*sign,b.q[2]*sign,b.q[3]*sign]),k);
  }
  function physicalFor(value){if(!globalThis.CAOZ_D20)return null;for(let seed=1;seed<420;seed++){const roll=globalThis.CAOZ_D20.simular(seed,{x:.16,z:-.64,fuerza:.68});if(roll.asentado&&roll.valor===value)return roll;}return null;}
  async function showD20(value,label,interactive,meta,fisica){
    let tirada=fisica&&(fisica.frames?fisica:globalThis.CAOZ_D20?.desempaquetar?.(fisica));if(!tirada)tirada=physicalFor(value)||globalThis.CAOZ_D20?.simular?.(17,{x:.12,z:-.58,fuerza:.65});
    if(!tirada){messageFor(`🎲 ${label}: ${value}`);return value;}
    diceRoot.visible=true;diceState.visible=true;diceState.estado='rodando';diceState.valor=null;diceState.frames=tirada.frames.length;diceReadout.hidden=false;diceReadout.innerHTML=`<small>${strip(label)}</small><b>🎲</b><span>Rodando…</span>`;
    animationHistory.push({tipo:'dado',etapa:'entrada',frames:tirada.frames.length,orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();
    const duration=G?.fast?.10:Math.min(1.75,Math.max(.56,(tirada.duracion||2.2)*.34));
    await tween(duration,k=>diceAt(tirada,(tirada.frames.at(-1)?.t||0)*ease(k)));
    diceAt(tirada,tirada.frames.at(-1)?.t||0);diceState.estado='resultado';diceState.valor=value;const good=meta?.min!=null&&value>=meta.min,bad=meta?.max!=null&&value<=meta.max;
    diceReadout.innerHTML=`<small>${strip(label)}</small><b>${value}</b><span>${good?'Éxito':bad?'Falla':value===20||value===1?'Crítico':'Resultado'}</span>`;floatAt(new THREE.Vector3(diceRoot.position.x,diceRoot.position.y+.7,diceRoot.position.z),'🎲 '+value,good?'heal':bad?'damage':'note');
    animationHistory.push({tipo:'dado',etapa:'fin',frames:tirada.frames.length,orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();
    if(interactive&&G?.active===ME)return new Promise(resolve=>modalShow({kicker:'D20',title:label,body:`<p class="ctDiceResult"><b>${value}</b></p><p>${meta?.necesita||''}</p><p>${good?meta?.siOk||'':bad?meta?.siMal||'':''}</p>`,actions:[{t:'Continuar',cls:'gold',fn:()=>{modalHide();diceRoot.visible=false;diceReadout.hidden=true;diceState.visible=false;resolve(value);}}]}));
    await fxDelay(520);diceRoot.visible=false;diceReadout.hidden=true;diceState.visible=false;return value;
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
  function impactAt(pos,color=0xffc15d,power=1){const ring=new THREE.Mesh(new THREE.RingGeometry(.22,.3,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.copy(pos).setY(Math.max(.028,pos.y+.015));table.add(ring);const light=new THREE.PointLight(color,0,5,2);light.position.copy(pos).add(new THREE.Vector3(0,.7,0));scene.add(light);impacts.push({ring,light,at:reloj,power});animationHistory.push({tipo:'impacto',etapa:'entrada',orden:animationHistory.length+1});if(animationHistory.length>48)animationHistory.shift();}
  function impact(v,d){const p=d?.pos||v.position;impactAt(p,d?.edition==='dorado'?0xffd174:sideColor(d?.side??v.userData.side),1);view.shake=Math.max(view.shake,.11);}
  function takeSpent(side,id){const list=spentVisuals[side],i=list.map(x=>x.id).lastIndexOf(id);return i<0?null:list.splice(i,1)[0];}
  async function spellFlight(id,s,kind='hechizo',color=0xb493ff){const spent=takeSpent(s,id);if(!spent){flash(color);return fxDelay(220);}const v=spent.v;placeWorld(v,spent.pose);v.visible=true;const center=new THREE.Vector3(0,2.45,sideZ(s)*.35);await flyCard(v,center,new THREE.Euler(-.48,0,0),.45,1.05,ESC,kind);impactAt(center,color,1.3);await motion(v,kind+'-brasas',()=>tween(.3,k=>{setDissolve(v,ease(k));v.rotation.y+=.13;}));setDissolve(v,1);v.position.copy(gravePos(s)).add(new THREE.Vector3(0,.21,0));v.rotation.set(-Math.PI/2,0,0);graveGhosts[s]={id,v,pose:poseWorld(v)};visuals.delete(v.userData.key);}
  globalThis.fxHit=async(u,n)=>{const v=await waitVisual('unit:'+u.uid);if(v){await waitMotion(v);floatAt(unitPos(u),'-'+n,'damage');impactAt(v.position,0xff8a70,1);await motion(v,'golpe',()=>tween(.24,k=>{v.rotation.z=Math.sin(k*TAU*3)*(1-k)*.12;}));v.rotation.z=0;}else await fxDelay();};
  globalThis.fxHeal=async(u,n)=>{const v=await waitVisual('unit:'+u.uid);floatAt(unitPos(u),'+'+n,'heal');if(v){await motion(v,'cura',()=>tween(.22,k=>{const q=1+Math.sin(Math.PI*k)*.1;v.scale.setScalar(ESC*q);}));}return fxDelay(80);};
  globalThis.fxFace=async(s,n)=>{floatAt(soulPos(s),'-'+n,'damage');impactAt(souls[s].group.position.clone().add(new THREE.Vector3(0,.08,0)),0xff746d,1.2);const c=souls[s].crystal;await tween(.28,k=>c.scale.set(.8+Math.sin(k*Math.PI)*.28,1.25+Math.sin(k*Math.PI)*.36,.8+Math.sin(k*Math.PI)*.28));};
  globalThis.fxDraw=async s=>{const tokens=handTokens[s],token=tokens.at(-1),key=token?(s===ME?'hand:':'enemy-hand:')+token.serial:null,v=key&&await waitVisual(key);floatAt(deckPos(s).add(new THREE.Vector3(0,1,0)),'+ carta','note');if(!v)return fxDelay(120);const target=poseWorld(v),from={pos:deckPos(s).add(new THREE.Vector3(0,.3,0)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+Math.PI,0,0)),scale:ESC*.7};placeWorld(v,from);await motion(v,'robo',()=>tween(.36,k=>{const e=ease(k);v.position.lerpVectors(from.pos,target.pos,e);v.quaternion.slerpQuaternions(from.q,target.q,e);v.scale.setScalar(THREE.MathUtils.lerp(from.scale,target.scale,e));}));if(s===ME)camera.attach(v);else table.attach(v);};
  globalThis.fxObj=(u,id,text)=>{floatAt(unitPos(u),text||CARDS[id]?.n||'Objeto','note');impactAt(unitPos(u),0x78caff,.72);return fxDelay(220);};
  globalThis.fxNotice=(text)=>{messageFor(text);return fxDelay(250);};
  globalThis.fxNumber=(anchor,text,kind)=>{floatAt(anchor==='face0'?soulPos(ME):soulPos(FOE),text,kind==='buff'?'heal':'note');};
  globalThis.fxDeath=async u=>{const key='unit:'+u.uid,v=await waitVisual(key);if(!v)return fxDelay(160);await waitMotion(v);v.userData.dying=true;const from=v.position.clone(),to=gravePos(u.owner??u.side).add(new THREE.Vector3(0,.24,0));impactAt(from,0xff6745,1.1);await motion(v,'muerte',()=>tween(.46,k=>{const e=ease(k);v.position.lerpVectors(from,to,e);v.position.y+=Math.sin(k*Math.PI)*.9;v.scale.setScalar(ESC*(1-e*.16));setDissolve(v,e);}));setDissolve(v,1);visuals.delete(key);v.userData.dying=false;graveGhosts[u.owner??u.side]={id:u.card.id,v,pose:poseWorld(v)};};
  globalThis.fxAterriza=async u=>{const v=await waitVisual('unit:'+u.uid);if(!v)return fxDelay(120);await waitMotion(v);const p=v.position.clone();await motion(v,'aterrizaje',()=>tween(.2,k=>{v.position.y=p.y+Math.sin(k*Math.PI)*.34;}));v.position.copy(p);impact(v,{pos:p,side:u.side,edition:v.userData.edition});};
  globalThis.fxSpell=async(id,s)=>{floatAt(new THREE.Vector3(0,1.2,0),CARDS[id]?.n||'Hechizo','note');await spellFlight(id,s,'hechizo',0xb493ff);flash(0xb493ff);};
  globalThis.fxHabilidad=s=>{floatAt(leaderPos(s).add(new THREE.Vector3(0,1,0)),P(s).L.habName,'note');impactAt(leaderPos(s),sideColor(s),1);flash(sideColor(s));return fxDelay(260);};
  globalThis.fxBanner=s=>{messageFor(`— Turno de ${sideName(s)} —`);return fxDelay(250);};
  globalThis.fxStat=()=>fxDelay(1);
  globalThis.fxLunge=async(u,target)=>{const v=await waitVisual('unit:'+u.uid);if(!v)return fxDelay(180);await waitMotion(v);const start=v.position.clone(),targetPos=target==='face'?soulPos(1-u.side):unitPos(target),end=targetPos.clone().sub(start).normalize().multiplyScalar(.8).sub(targetPos).multiplyScalar(-1).add(targetPos);await motion(v,'embestida',async()=>{await tween(.14,k=>{v.position.lerpVectors(start,end,k);v.position.y+=Math.sin(k*Math.PI)*.6;});impactAt(targetPos,0xffa261,1.1);view.shake=.28;await tween(.24,k=>{v.position.lerpVectors(end,start,k);});});v.position.copy(start);};
  // Estas tres funciones ya existen en motor.js; se reasignan para evitar que
  // su interfaz HTML antigua toque nodos ausentes en esta mesa.
  fxTrap=async(id,s)=>{floatAt(trapPos(s,1).add(new THREE.Vector3(0,1,0)),'🪤 '+(CARDS[id]?.n||'Trampa'),'note');impactAt(trapPos(s,1),0xff7b73,.9);flash(0xff7b73);await fxDelay(260);};
  relojArranca=()=>{};globalThis.relojPara=()=>{};globalThis.relojPinta=()=>{};

  function flash(color){const l=new THREE.PointLight(color,0,8,2);l.position.set(0,3,0);scene.add(l);tween(.35,k=>l.intensity=Math.sin(k*Math.PI)*18).then(()=>scene.remove(l));}
  function tween(sec,fn){return new Promise(resolve=>tweens.push({at:reloj,d:Math.max(.001,sec),fn,resolve}));}

  /* ------------------------- Clics y acciones reales ----------------------- */
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(9,9);
  function setPointer(e){const b=stage.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);}
  function rootFrom(o){while(o&&(!o.userData||!o.userData.key))o=o.parent;return o||null;}
  function handSlotUnderPointer(){ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...handHits.values()].filter(x=>x.visible),false)[0];if(!hit)return null;return {key:hit.object.userData.key,uv:hit.uv||new THREE.Vector2(.5,.5)};}
  function hitCard(){ray.setFromCamera(pointer,camera);const roots=[...visuals.values()].filter(v=>!['hand','enemyHand','deck','grave'].includes(v.userData.kind));const objects=[];roots.forEach(v=>v.traverse(x=>x.isMesh&&objects.push(x)));const hit=ray.intersectObjects(objects,false)[0];return hit?rootFrom(hit.object):null;}
  function freeSlots(side){const used=new Set(P(side).field.map(u=>fieldSlot(side,u)));return FIELD_ORDER.filter(slot=>!used.has(slot));}
  function tablePoint(){ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.72),new THREE.Vector3());}
  function updateDropMarks(){const slots=freeSlots(ME);for(const {slot,m} of dragMarks){const active=!!drag&&slots.includes(slot);m.visible=active;m.material.opacity=active?(drag.slot===slot ? .68 : .23+.08*Math.sin(reloj*7+slot)):0;}}
  function nearestDrop(pos){let best=null,dist=1.48;for(const slot of freeSlots(ME)){const p=new THREE.Vector3((slot-2)*2,.72,sideZ(ME)*1.58),d=Math.hypot(pos.x-p.x,pos.z-p.z);if(d<dist){best=slot;dist=d;}}return best;}
  function beginDrag(key){const v=visuals.get(key);if(!v||v.userData.kind!=='hand'||!G||G.active!==ME||G.busy||!canPlay(ME,v.userData.id)){if(v)toast(whyNot(ME,v.userData.id));return false;}const point=tablePoint();if(!point)return false;table.attach(v);v.userData.dragging=true;drag={key,v,id:v.userData.id,point,slot:null,spell:CARDS[v.userData.id]?.t!=='personaje',started:reloj};const hit=handHits.get(key);if(hit)hit.visible=false;hoverHand=null;messageFor(drag.spell?'Suelta la carta sobre la mesa para lanzarla.':'Suelta la carta sobre una diana libre.');updateDropMarks();return true;}
  async function finishDrag(){const current=drag;if(!current)return;drag=null;for(const {m} of dragMarks){m.visible=false;m.material.opacity=0;}const v=current.v,slot=current.slot,canDrop=current.spell||slot!=null;
    if(canDrop){if(slot!=null)dropHints[ME].push({id:current.id,slot});v.userData.dragging=false;await playFromHand(ME,current.id);return;}
    camera.attach(v);v.userData.dragging=false;const hit=handHits.get(current.key);if(hit)hit.visible=true;messageFor('La carta vuelve a tu mano.');}
  function animateHand(dt){
    for(const [key,v] of visuals){if(v.userData.kind!=='hand'||v.userData.dragging||v.userData.motion)continue;const base=v.userData.handPose;if(!base)continue;const active=hoverHand===key&&!G?.busy&&G?.active===ME,pos=base.pos.clone(),rot=base.rot.clone();let scale=base.scale;
      if(active){const z=Math.max(4.5,-base.pos.z-.85),hh=Math.tan(camera.fov*Math.PI/360)*z,ww=hh*camera.aspect;scale=Math.min(ESC*1.58,(hh*1.72)/(ALTO),(ww*1.72)/(ANCHO));pos.y=Math.max(-hh*.82+ALTO*scale*.5,base.pos.y+1.0);pos.z=base.pos.z+.9;pos.x=Math.max(-ww*.89+ANCHO*scale*.5,Math.min(ww*.89-ANCHO*scale*.5,pos.x));rot.set(-.08+(hoverUV.y-.5)*.18,(hoverUV.x-.5)*.24,0);}
      else if(hoverHand){const other=visuals.get(hoverHand);const dx=(base.pos.x-(other?.userData.handPose?.pos.x||0));pos.x+=Math.sign(dx||1)*.26/Math.sqrt(Math.max(1,Math.abs(dx)));}
      const q=new THREE.Quaternion().setFromEuler(rot),mix=1-Math.exp(-dt*(active?18:8));v.position.lerp(pos,mix);v.quaternion.slerp(q,mix);v.scale.setScalar(THREE.MathUtils.lerp(v.scale.x,scale,mix));const m=v.userData.frente.material,legal=G?.active===ME&&!G?.busy&&canPlay(ME,v.userData.id);m.color.setScalar(active?1.08:legal?1:.63);
    }
  }
  function updateDrag(dt){if(!drag)return;const point=tablePoint();if(point)drag.point.copy(point);drag.slot=drag.spell?null:nearestDrop(drag.point);const target=drag.point.clone();target.y=.82;drag.v.position.lerp(target,1-Math.exp(-dt*19));const lean=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+.08,0,0));drag.v.quaternion.slerp(lean,1-Math.exp(-dt*14));drag.v.scale.setScalar(THREE.MathUtils.lerp(drag.v.scale.x,ESC*1.08,1-Math.exp(-dt*14)));updateDropMarks();}
  function selectVisual(u){selected=u;render();}
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
      await playFromHand(ME,id);return;
    }
    if(kind==='field'&&side===ME&&u){selectVisual(u);selectUnit(u);return;}
    if(kind==='field'&&side===FOE&&u){if(SEL)await tryAttack(SEL,u);else toast('Elige primero uno de tus Personajes para atacar.');return;}
    if(kind==='leader'&&side===FOE){if(TGT){pickTarget('face');return;}if(SEL)await tryAttack(SEL,'face');else toast('Elige un Personaje para atacar al Alma de Gero.');return;}
    if(kind==='leader'&&side===ME){await useLeader(ME);}
  }
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;setPointer(e);const hand=handSlotUnderPointer();gesture={key:hand?.key||null,x:e.clientX,y:e.clientY,moved:0};stage.setPointerCapture?.(e.pointerId);});
  stage.addEventListener('pointerup',async e=>{setPointer(e);const g=gesture;gesture=null;if(drag){await finishDrag();return;}if(g?.key&&g.moved<=10){const v=visuals.get(g.key);if(v)await activateCard(v);return;}const v=hitCard();if(v)await activateCard(v);else if(TGT)toast('Elige una carta resaltada o cancela.');});
  stage.addEventListener('pointermove',e=>{setPointer(e);const h=handSlotUnderPointer();if(!drag){hoverHand=h?.key||null;if(h)hoverUV.copy(h.uv);stage.style.cursor=h?'pointer':'default';}if(gesture){gesture.moved+=Math.abs(e.movementX||e.clientX-gesture.x)+Math.abs(e.movementY||e.clientY-gesture.y);gesture.x=e.clientX;gesture.y=e.clientY;if(gesture.key&&gesture.moved>10&&!drag)beginDrag(gesture.key);}});
  stage.addEventListener('pointerleave',()=>{if(!gesture&&!drag){hoverHand=null;stage.style.cursor='default';}});
  stage.addEventListener('wheel',e=>{e.preventDefault();view.target=Math.max(.78,Math.min(1.25,view.target+e.deltaY*.0008));},{passive:false});
  leaderBtn.onclick=()=>useLeader(ME);
  abilityBtn.onclick=()=>selected&&useAct(selected);
  endBtn.onclick=()=>pedirTerminarTurno();
  $('ctEfectos').onclick=()=>{const on=$('ctEfectos').getAttribute('aria-pressed')!=='true';$('ctEfectos').setAttribute('aria-pressed',String(on));$('ctEfectos').textContent=on?'Efectos 35%':'Efectos 10%';setAtmosphere(on?.35:.10);};
  $('ctReiniciar').onclick=()=>chooseMode();

  /* --------------------------- Inicio y modos ------------------------------ */
  function resetPresentation(){
    visualEpoch++;for(const v of visuals.values())v.removeFromParent();visuals.clear();pending.clear();wantedKeys.clear();desiredByKey.clear();pendingEntries.clear();spentVisuals[ME].length=0;spentVisuals[FOE].length=0;graveGhosts[ME]=graveGhosts[FOE]=null;fieldSlots[ME].clear();fieldSlots[FOE].clear();handTokens[ME]=[];handTokens[FOE]=[];dropHints[ME].length=0;dropHints[FOE].length=0;hoverHand=null;gesture=null;drag=null;
    for(const hit of handHits.values())hit.removeFromParent();handHits.clear();for(const {m} of dragMarks){m.visible=false;m.material.opacity=0;}for(const impact of impacts.splice(0)){impact.ring.removeFromParent();impact.light.removeFromParent();}diceRoot.visible=false;diceReadout.hidden=true;diceState.visible=false;diceState.estado='oculto';diceState.valor=null;
  }
  async function startGame(nextMode){
    modo=nextMode;ready=false;selected=null;resetPresentation();clearUI();modalHide();messageFor('Barajando los mazos de Talesyn y Gero…');
    // setupMatch conserva el lanzamiento de moneda, el segundo robo y el
    // mulligan reales. Sólo la variante final modifica el Alma inicial de Gero.
    const opts=modo==='final'?{campana:{id:'mesa-three-gero',etapa:5,alma:40,prueba:true}}:{};
    try{await setupMatch('talesin','gero',opts);ready=true;render();messageFor('La partida está en marcha.');}
    catch(e){console.error(e);messageFor('No se pudo iniciar la partida: '+e.message);modalShow({kicker:'ERROR',title:'La mesa no pudo abrirse',body:`<p>${e.message}</p>`,actions:[{t:'Reintentar',cls:'gold',fn:()=>startGame(modo)}]});}
  }
  function chooseMode(){
    modalShow({kicker:'TALESYN VS GERO',title:'Elige la partida',body:`<div class="ctMode"><button type="button" data-mode="final"><b>Final de campaña</b>Talesyn comienza con 20 Alma. Gero, jefe final, con 40 Alma.</button><button type="button" data-mode="duelo"><b>Duelo estándar</b>Los dos líderes comienzan con 20 Alma.</button></div><p>Ambas versiones usan exactamente los mazos, cartas y reglas originales.</p>`,actions:[]});
    modalBody.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>startGame(b.dataset.mode));
  }

  /* ------------------------------- Fotogramas ------------------------------ */
  let last=performance.now(),effectLevel=.10;
  function setAtmosphere(k){effectLevel=k;lamp.shadow.intensity=k;lamp.intensity=450+220*k;scene.fog.density=.008+.018*k;}
  setAtmosphere(.10);
  function measure(){const b=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.25),w=Math.max(1,b.width),h=Math.max(1,b.height);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<.88?59:39;camera.updateProjectionMatrix();}
  new ResizeObserver(measure).observe(stage);measure();
  function animate(now){const dt=Math.min(.05,(now-last)/1000);last=now;reloj+=dt;factory.tiempo.value=reloj;view.zoom+=(view.target-view.zoom)*Math.min(1,dt*7);view.shake=Math.max(0,view.shake-dt*1.5);const portrait=camera.aspect<.88,d=(portrait?Math.min(38,13.2/camera.aspect):20.3)*view.zoom;camera.position.set(Math.sin(reloj*47)*view.shake*.2,Math.sin(portrait?1.15:.86)*d,Math.cos(portrait?1.15:.86)*d);camera.lookAt(cameraTarget.x,cameraTarget.y-(portrait?1.1:0),cameraTarget.z+(portrait?.7:.65));
    for(let i=tweens.length-1;i>=0;i--){const t=tweens[i],k=Math.min(1,(reloj-t.at)/t.d);t.fn(k);if(k>=1){tweens.splice(i,1);t.resolve();}}
    rune.rotation.z=reloj*.32;rune.material.opacity=.36+.24*Math.sin(reloj*1.4);
    candles.forEach((c,i)=>{const f=.84+.12*Math.sin(reloj*12+i*3)+.04*Math.sin(reloj*28+i);c.flame.scale.set(1,f,1);c.light.intensity=26*effectLevel*f;});
    animateHand(dt);updateDrag(dt);
    for(const [key,v] of visuals){if(v.userData.kind==='field'&&!v.userData.dying&&!v.userData.motion){const u=v.userData.unit;if(u){const raised=(selected===u||TGT&&isTargetable(u))?.15:0;v.position.y+=(v.userData.base.y+raised-v.position.y)*Math.min(1,dt*12);}}}
    for(let i=impacts.length-1;i>=0;i--){const fx=impacts[i],age=reloj-fx.at,k=Math.min(1,age/.54);fx.ring.scale.setScalar(1+k*4*fx.power);fx.ring.material.opacity=Math.max(0,.86*(1-k));fx.light.intensity=Math.max(0,18*effectLevel*(1-k));if(k>=1){fx.ring.removeFromParent();fx.light.removeFromParent();impacts.splice(i,1);}}
    for(let i=floating.length-1;i>=0;i--){const f=floating[i],p=worldToScreen(f.pos);f.el.style.transform=`translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;f.el.hidden=p.hide;if(now>f.until){f.el.remove();floating.splice(i,1);}}
    renderer.render(scene,camera);requestAnimationFrame(animate);
  }

  /* ------------------------------ Pruebas / boot --------------------------- */
  function plain(v){return {x:Number(v.x.toFixed(4)),y:Number(v.y.toFixed(4)),z:Number(v.z.toFixed(4))};}
  function slotRect(slot){
    slot.updateMatrixWorld(true);camera.updateMatrixWorld(true);const box=stage.getBoundingClientRect(),xs=[],ys=[];
    for(const [x,y] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){const p=new THREE.Vector3(x*slot.geometry.parameters.width,y*slot.geometry.parameters.height,0).applyMatrix4(slot.matrixWorld).project(camera);xs.push(box.left+(p.x*.5+.5)*box.width);ys.push(box.top+(.5-p.y*.5)*box.height);}const left=Math.min(...xs),top=Math.min(...ys);return {x:left,y:top,width:Math.max(1,Math.max(...xs)-left),height:Math.max(1,Math.max(...ys)-top)};
  }
  function inspect(){
    const field=s=>P(s).field.map(u=>{const v=visuals.get('unit:'+u.uid),p=v?v.getWorldPosition(new THREE.Vector3()):cardPos(s,u);return {uid:u.uid,id:u.card.id,slot:fieldSlot(s,u),centro:plain(p)};});
    const hand=[...handHits.entries()].map(([key,slot])=>{const v=visuals.get(key);return {indice:slot.userData.index,id:slot.userData.id,rect:slotRect(slot),hover:hoverHand===key,escala:Number((v?.scale.x||0).toFixed(4)),visible:slot.visible};}).sort((a,b)=>a.indice-b.indice);
    const enemyHand=[...visuals.values()].filter(v=>v.userData.kind==='enemyHand').sort((a,b)=>(a.userData.handIndex||0)-(b.userData.handIndex||0)).map(v=>({centro:plain(v.getWorldPosition(new THREE.Vector3()))}));
    return {mano:{ranuras:hand,objetivo:hoverHand},campo:[field(ME),field(FOE)],enemigo:{mano:enemyHand,campo:field(FOE)},dado:{...diceState},animaciones:{activas:[...activeAnimations.values()].map(x=>({...x})),historial:animationHistory.map(x=>({...x}))},cementerio:[P(ME).grave.map(id=>({id})),P(FOE).grave.map(id=>({id}))]};
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
  async function boot(){try{await CAOZ_CARTA_PINTOR.fuentes();if(typeof cargarArte==='function')await cargarArte();ready=true;sync();requestAnimationFrame(animate);if(CAPTURA){await startGame(qs.get('modo')||'duelo');}else chooseMode();}catch(e){console.error(e);messageFor('No se pudo preparar la mesa: '+e.message);}}
  boot();
})();

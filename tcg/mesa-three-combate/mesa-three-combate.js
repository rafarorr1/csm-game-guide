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
  let modo=qs.get('modo')==='duelo'?'duelo':'final',reloj=0,ready=false,ocupadoFx=0,selected=null,logCount=0;
  const tweens=[],visuals=new Map(),pending=new Set(),floating=[];
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
  const lineMat=new THREE.LineBasicMaterial({color:0xdcae50,transparent:true,opacity:.72});
  function zone(x,z,w,h){const pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([a,b])=>new THREE.Vector3(x+a,.012,z+b));table.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));}
  for(const s of [ME,FOE]){const sign=sideZ(s);for(let i=0;i<5;i++)zone((i-2)*2,sign*1.58,ANCHO*ESC+.18,ALTO*ESC+.18);for(let i=0;i<3;i++)zone((i-1)*2.05,sign*layout.trapZ,ALTO*ESC*.78,ANCHO*ESC*.78);zone(layout.leader.x,sign*layout.leader.z,ANCHO*ESC*1.12,ALTO*ESC*1.12);zone(layout.deck.x,sign*layout.deck.z,ANCHO*ESC,ALTO*ESC);zone(layout.grave.x,sign*layout.grave.z,ANCHO*ESC,ALTO*ESC);}
  const rune=new THREE.Mesh(new THREE.TorusGeometry(.7,.024,10,60),new THREE.MeshBasicMaterial({color:0xffc25d,transparent:true,opacity:.65}));rune.rotation.x=-Math.PI/2;rune.position.y=.018;table.add(rune);
  const candles=[];for(const [x,z] of [[-9.2,-5.65],[9.2,-5.65]]){const g=new THREE.Group();g.position.set(x,0,z);table.add(g);const holder=new THREE.Mesh(new THREE.CylinderGeometry(.65,.78,.15,32),new THREE.MeshPhysicalMaterial({color:0xdfaf56,metalness:1,roughness:.25}));holder.position.y=.08;g.add(holder);const wax=new THREE.Mesh(new THREE.CylinderGeometry(.27,.3,2.25,24),new THREE.MeshPhysicalMaterial({color:0xf4e7cf,roughness:.5}));wax.position.y=1.2;g.add(wax);const flame=new THREE.Mesh(new THREE.SphereGeometry(.23,16,12),new THREE.MeshBasicMaterial({color:0xffd47a,toneMapped:false}));flame.scale.y=2.3;flame.position.y=2.58;g.add(flame);const light=new THREE.PointLight(0xff9a43,2.6,12,2);light.position.y=2.6;g.add(light);candles.push({g,flame,light});}

  /* ------------------------ Cartas físicas y recursos --------------------- */
  const factory=Carta.fabrica(THREE,renderer),textures=new Map();
  const back=(()=>{const c=document.createElement('canvas');c.width=640;c.height=900;const g=c.getContext('2d');const r=g.createRadialGradient(320,360,20,320,430,550);r.addColorStop(0,'#5a377c');r.addColorStop(1,'#10091a');g.fillStyle=r;g.fillRect(0,0,640,900);g.strokeStyle='#dfb75c';g.lineWidth=22;g.strokeRect(30,30,580,840);g.lineWidth=5;g.strokeRect(52,52,536,796);g.fillStyle='#ecd28d';g.font='700 60px Georgia';g.textAlign='center';g.fillText('CAOZ',320,420);g.font='28px Georgia';g.fillText('CON TODO',320,466);return factory.materialDorso({color:c,normal:c});})();
  back.map.colorSpace=THREE.SRGBColorSpace;
  const cardPos=(s,i)=>new THREE.Vector3((i-(Math.min(5,P(s).field.length)-1)/2)*2,ALTURA,sideZ(s)*1.58);
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
    const ed=opt.edition||editionFor(id),tx=opt.back?null:await textureFor(id,ed);if(!wantedKeys.has(key))return null;
    const face=opt.back?back:factory.materialCara(tx,ed),card=factory.carta(face,back,factory.materialCanto(ed));card.scale.setScalar(opt.scale||ESC);card.userData.key=key;card.userData.id=id;card.userData.kind=opt.kind;card.userData.side=opt.side;card.userData.unit=opt.unit||null;card.userData.base=new THREE.Vector3();card.userData.edition=ed;
    if(!opt.back&&CARDS[id]?.t==='personaje'){
      const a=putGem(digit(opt.unit?.atk??CARDS[id].a??0,'#fff1d8'),GEMAS.atq),h=putGem(digit(Math.max(0,(opt.unit?.maxHp??CARDS[id].h??0)-(opt.unit?.dmg??0)),'#fff1d8'),GEMAS.vida);card.add(a,h);card.userData.a=a;card.userData.h=h;
    }
    if(!opt.back&&CARDS[id]){const c=putGem(digit(opt.cost??CARDS[id].c,'#f6edff'),GEMAS.coste);card.add(c);card.userData.c=c;}
    card.traverse(o=>{if(o.isMesh){o.castShadow=opt.kind!=='hand';o.receiveShadow=true;}});
    table.add(card);visuals.set(key,card);return card;
  }
  const wantedKeys=new Set();
  function setCardPose(card,pos,rot,scale=ESC){card.position.copy(pos);card.rotation.copy(rot);card.scale.setScalar(scale);card.userData.base.copy(pos);}
  function rotateCard(card,kind){if(kind==='hand')return new THREE.Euler(0,0,0);return new THREE.Euler(-Math.PI/2,0,0);}
  function liveCard(card,u){if(!card||!u)return;card.userData.unit=u;if(card.userData.a)paintDigit(card.userData.a,u.atk,u.atk>(u.card.a||0)?'#9effb1':'#fff1d8');if(card.userData.h)paintDigit(card.userData.h,Math.max(0,u.maxHp-u.dmg),u.dmg?'#ff9e90':'#fff1d8');const material=card.userData.frente.material;material.emissive=material.emissive||new THREE.Color();let glow=0;if(TGT&&isTargetable(u))glow=0x356040;else if(selected===u)glow=0x5a4210;material.emissive.setHex(glow);material.emissiveIntensity=glow?.55:0;}
  function genericBack(key,side,index,zone='deck'){return {key,id:'conserje',back:true,side,index,kind:zone,scale:zone==='enemyHand'?.67:ESC};}

  /* --------------------------- Sincronizar motor --------------------------- */
  function desired(){
    if(!G)return [];const out=[];
    for(const s of [ME,FOE]){
      const p=P(s),sign=sideZ(s);out.push({key:'leader:'+s,id:'lider_'+p.leaderId,side:s,kind:'leader',scale:ESC*1.1,pos:leaderPos(s),rot:new THREE.Euler(-Math.PI/2,0,0)});
      p.field.forEach((u,i)=>out.push({key:'unit:'+u.uid,id:u.card.id,side:s,unit:u,kind:'field',pos:cardPos(s,i),rot:new THREE.Euler(-Math.PI/2,0,0)}));
      p.traps.forEach((t,i)=>out.push({key:'trap:'+s+':'+i,id:t.id,side:s,kind:'trap',back:s===FOE,pos:trapPos(s,i),rot:new THREE.Euler(-Math.PI/2+(s===FOE?Math.PI:0),0,Math.PI/2),scale:ESC*.78}));
      p.relics.forEach((r,i)=>out.push({key:'relic:'+s+':'+i,id:r.id,side:s,kind:'relic',pos:new THREE.Vector3(layout.relicX+i*1.48,ALTURA,sign*4.9),rot:new THREE.Euler(-Math.PI/2,0,0),scale:ESC*.66}));
      if(p.deck.length)out.push({key:'deck:'+s,id:'conserje',side:s,kind:'deck',back:true,pos:deckPos(s),rot:new THREE.Euler(-Math.PI/2+Math.PI,0,.035),scale:ESC});
      if(p.grave.length){const id=p.grave.at(-1);out.push({key:'grave:'+s,id,side:s,kind:'grave',pos:gravePos(s),rot:new THREE.Euler(-Math.PI/2,0,-.05),scale:ESC*.94});}
    }
    if(G.place)out.push({key:'place',id:G.place.id,side:G.place.side,kind:'place',pos:new THREE.Vector3(0,ALTURA,0),rot:new THREE.Euler(-Math.PI/2,0,0),scale:ESC*.82});
    const own=P(ME).hand;own.forEach((id,i)=>out.push({key:'hand:'+i+':'+id,id,side:ME,kind:'hand',handIndex:i}));
    const enemy=P(FOE).hand;enemy.forEach((_,i)=>out.push({key:'enemy-hand:'+i,id:'conserje',side:FOE,kind:'enemyHand',back:true,handIndex:i,scale:.67}));
    return out;
  }
  function handPose(i,n){const k=i-(n-1)/2,portrait=camera.aspect<.86,sep=portrait?.52:.92,z=portrait?-8.4:-7.1;return {pos:new THREE.Vector3(k*sep,(portrait?-3.25:-2.43)-Math.abs(k)*.07,z+i*.013),rot:new THREE.Euler(-.11,0,-k*.075),scale:ESC};}
  function enemyHandPose(i,n){const k=i-(n-1)/2,scale=.66,step=ANCHO*scale+.1;return {pos:new THREE.Vector3(k*step,1.12+i*.02,layout.enemyHandZ+i*.025),rot:new THREE.Euler(-1.09,Math.PI,k*.035),scale};}
  async function sync(){
    if(!ready||!G)return;const list=desired();wantedKeys.clear();list.forEach(x=>wantedKeys.add(x.key));
    for(const [key,v] of [...visuals])if(!wantedKeys.has(key)&&!v.userData.dying){v.removeFromParent();visuals.delete(key);}
    for(const d of list){let v=visuals.get(d.key);if(!v&&!pending.has(d.key)){pending.add(d.key);makeCard(d.key,d.id,d).then(x=>{pending.delete(d.key);if(x){applyVisual(x,d);}}).catch(e=>{pending.delete(d.key);toast('No se pudo pintar una carta: '+e.message);});}
      if(v)applyVisual(v,d);
    }
    drawResources();updateHUD();
  }
  function applyVisual(v,d){
    if(!wantedKeys.has(d.key))return;
    v.userData.kind=d.kind;v.userData.side=d.side;v.userData.unit=d.unit||null;v.userData.id=d.id;
    if(d.kind==='hand'){const n=P(ME).hand.length,p=handPose(d.handIndex,n);if(v.parent!==camera)camera.add(v);setCardPose(v,p.pos,p.rot,p.scale);const m=v.userData.frente.material;m.envMap=scene.environment;m.envMapIntensity=.7;m.clearcoat=.15;m.emissive=new THREE.Color(0x4d402d);m.emissiveIntensity=.3;}
    else {if(v.parent!==table)table.attach(v);let pos=d.pos,rot=d.rot,sc=d.scale||ESC;if(d.kind==='enemyHand'){const p=enemyHandPose(d.handIndex,P(FOE).hand.length);pos=p.pos;rot=p.rot;sc=p.scale;}setCardPose(v,pos,rot,sc);if(d.kind==='field')liveCard(v,d.unit);}
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
  globalThis.rollDice=(value,label,interactive,meta)=>{
    // Las tiradas de sistema (como la pasiva de Gero) nunca deben detener el
    // turno rival. Se ven en la mesa y en el Registro; sólo una tirada que el
    // jugador lanzó a propósito abre el diálogo confirmable.
    if(!(interactive&&G?.active===ME)){
      const good=meta?.min!=null&&value>=meta.min, bad=meta?.max!=null&&value<=meta.max;
      messageFor(`🎲 ${label}: ${value}${good?' · éxito':bad?' · falla':''}`);
      floatAt(new THREE.Vector3(0,1.2,0),'🎲 '+value,good?'heal':bad?'damage':'note');
      return Promise.resolve(value);
    }
    return new Promise(resolve=>{const result=`<p><b style="font-size:48px;color:#f4d48b">${value}</b></p><p>${meta?.necesita||''}</p><p>${meta?.siOk||''}${meta?.siMal?`<br>${meta.siMal}`:''}</p>`;let done=false;const finish=()=>{if(done)return;done=true;modalHide();resolve(value);};modalShow({kicker:'D20',title:label,body:result,actions:[{t:'Continuar',cls:'gold',fn:finish}]});});
  };
  globalThis.elegirMulliganInicial=(side,{cartas,limite})=>{if(side!==ME)return Promise.resolve([]);return new Promise(resolve=>{let picks=[];const refresh=()=>{modalShow({kicker:'MANO INICIAL',title:`Puedes cambiar hasta ${limite} carta${limite===1?'':'s'}`,body:`<p>Las cartas seleccionadas se cambian antes de volver al mazo.</p><div class="ctChoiceGrid">${cartas.map((id,i)=>`<button type="button" class="ctChoiceCard ${picks.includes(i)?'selected':''}" data-mull="${i}"><b>${CARDS[id]?.n||id}</b>${strip(CARDS[id]?.x||'')}</button>`).join('')}</div>`,actions:[{t:'Conservar / confirmar',cls:'gold',fn:()=>{modalHide();resolve(picks.slice());}}]});modalBody.querySelectorAll('[data-mull]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.mull);picks=picks.includes(i)?picks.filter(x=>x!==i):(picks.length<limite?[...picks,i]:picks);refresh();});};refresh();});};
  globalThis.endGame=(winner,reason)=>{if(!G||G.over)return;G.over=true;clearUI();render();modalShow({kicker:winner===ME?'VICTORIA':'DERROTA',title:winner===ME?'Talesyn prevalece':'Gero cierra la mesa',body:`<p>${reason}</p><p>${winner===ME?'La Ascensión sobrevivió al Domo.':'Puedes empezar de nuevo con las mismas reglas.'}</p>`,actions:[{t:'Revancha',cls:'gold',fn:()=>{modalHide();startGame(modo);}},{t:'Elegir modo',fn:()=>chooseMode()}]});};
  function fxDelay(ms=180){return new Promise(r=>setTimeout(r,G?.fast?1:ms));}
  globalThis.fxHit=async(u,n)=>{const v=visuals.get('unit:'+u.uid);if(v){floatAt(unitPos(u),'-'+n,'damage');await tween(.24,k=>{v.rotation.z=Math.sin(k*TAU*3)*(1-k)*.12;});v.rotation.z=0;}else await fxDelay();};
  globalThis.fxHeal=(u,n)=>{floatAt(unitPos(u),'+'+n,'heal');return fxDelay(160);};
  globalThis.fxFace=async(s,n)=>{floatAt(soulPos(s),'-'+n,'damage');const c=souls[s].crystal;await tween(.28,k=>c.scale.set(.8+Math.sin(k*Math.PI)*.28,1.25+Math.sin(k*Math.PI)*.36,.8+Math.sin(k*Math.PI)*.28));};
  globalThis.fxDraw=s=>{floatAt(deckPos(s).add(new THREE.Vector3(0,1,0)),'+ carta','note');return fxDelay(170);};
  globalThis.fxObj=(u,id,text)=>{floatAt(unitPos(u),text||CARDS[id]?.n||'Objeto','note');return fxDelay(220);};
  globalThis.fxNotice=(text)=>{messageFor(text);return fxDelay(250);};
  globalThis.fxNumber=(anchor,text,kind)=>{floatAt(anchor==='face0'?soulPos(ME):soulPos(FOE),text,kind==='buff'?'heal':'note');};
  globalThis.fxDeath=async u=>{const v=visuals.get('unit:'+u.uid);if(!v)return fxDelay(160);v.userData.dying=true;const from=v.position.clone(),to=gravePos(u.owner??u.side).add(new THREE.Vector3(0,.25,0));await tween(.48,k=>{const e=k*k;v.position.lerpVectors(from,to,e);v.position.y+=Math.sin(k*Math.PI)*.9;v.scale.setScalar(ESC*(1-k*.18));v.userData.frente.material.userData.u.uDisuelve.value=k*.9;});v.removeFromParent();visuals.delete('unit:'+u.uid);};
  globalThis.fxAterriza=u=>{const v=visuals.get('unit:'+u.uid);if(!v)return fxDelay(120);const p=v.position.clone();return tween(.25,k=>{v.position.y=p.y+Math.sin(k*Math.PI)*.45;});};
  globalThis.fxSpell=(id,s)=>{floatAt(new THREE.Vector3(0,1.2,0),CARDS[id]?.n||'Hechizo','note');flash(0xb493ff);return fxDelay(280);};
  globalThis.fxHabilidad=s=>{floatAt(leaderPos(s).add(new THREE.Vector3(0,1,0)),P(s).L.habName,'note');flash(sideColor(s));return fxDelay(260);};
  globalThis.fxBanner=s=>{messageFor(`— Turno de ${sideName(s)} —`);return fxDelay(250);};
  globalThis.fxStat=()=>fxDelay(1);
  globalThis.fxLunge=async(u,target)=>{const v=visuals.get('unit:'+u.uid);if(!v)return fxDelay(180);const start=v.position.clone(),targetPos=target==='face'?soulPos(1-u.side):unitPos(target),end=targetPos.clone().sub(start).normalize().multiplyScalar(.8).sub(targetPos).multiplyScalar(-1).add(targetPos);await tween(.14,k=>{v.position.lerpVectors(start,end,k);v.position.y+=Math.sin(k*Math.PI)*.6;});view.shake=.28;await tween(.24,k=>{v.position.lerpVectors(end,start,k);});};
  // Estas tres funciones ya existen en motor.js; se reasignan para evitar que
  // su interfaz HTML antigua toque nodos ausentes en esta mesa.
  fxTrap=async(id,s)=>{floatAt(trapPos(s,1).add(new THREE.Vector3(0,1,0)),'🪤 '+(CARDS[id]?.n||'Trampa'),'note');flash(0xff7b73);await fxDelay(260);};
  relojArranca=()=>{};globalThis.relojPara=()=>{};globalThis.relojPinta=()=>{};

  function flash(color){const l=new THREE.PointLight(color,0,8,2);l.position.set(0,3,0);scene.add(l);tween(.35,k=>l.intensity=Math.sin(k*Math.PI)*18).then(()=>scene.remove(l));}
  function tween(sec,fn){return new Promise(resolve=>tweens.push({at:reloj,d:Math.max(.001,sec),fn,resolve}));}

  /* ------------------------- Clics y acciones reales ----------------------- */
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(9,9);
  function setPointer(e){const b=stage.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);}
  function rootFrom(o){while(o&&(!o.userData||!o.userData.key))o=o.parent;return o||null;}
  function hitCard(){ray.setFromCamera(pointer,camera);const roots=[...visuals.values()];const objects=[];roots.forEach(v=>v.traverse(x=>x.isMesh&&objects.push(x)));const hit=ray.intersectObjects(objects,false)[0];return hit?rootFrom(hit.object):null;}
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
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;setPointer(e);stage.setPointerCapture?.(e.pointerId);});
  stage.addEventListener('pointerup',async e=>{setPointer(e);const v=hitCard();if(v)await activateCard(v);else if(TGT)toast('Elige una carta resaltada o cancela.');});
  stage.addEventListener('pointermove',e=>{setPointer(e);});
  stage.addEventListener('wheel',e=>{e.preventDefault();view.target=Math.max(.78,Math.min(1.25,view.target+e.deltaY*.0008));},{passive:false});
  leaderBtn.onclick=()=>useLeader(ME);
  abilityBtn.onclick=()=>selected&&useAct(selected);
  endBtn.onclick=()=>pedirTerminarTurno();
  $('ctEfectos').onclick=()=>{const on=$('ctEfectos').getAttribute('aria-pressed')!=='true';$('ctEfectos').setAttribute('aria-pressed',String(on));$('ctEfectos').textContent=on?'Efectos 35%':'Efectos 10%';setAtmosphere(on?.35:.10);};
  $('ctReiniciar').onclick=()=>chooseMode();

  /* --------------------------- Inicio y modos ------------------------------ */
  async function startGame(nextMode){
    modo=nextMode;ready=false;selected=null;clearUI();modalHide();messageFor('Barajando los mazos de Talesyn y Gero…');
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
    for(const [key,v] of visuals){if(v.userData.kind==='field'&&!v.userData.dying){const u=v.userData.unit;if(u){const raised=(selected===u||TGT&&isTargetable(u))?.15:0;v.position.y+=(v.userData.base.y+raised-v.position.y)*Math.min(1,dt*12);}}}
    for(let i=floating.length-1;i>=0;i--){const f=floating[i],p=worldToScreen(f.pos);f.el.style.transform=`translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;f.el.hidden=p.hide;if(now>f.until){f.el.remove();floating.splice(i,1);}}
    renderer.render(scene,camera);requestAnimationFrame(animate);
  }

  /* ------------------------------ Pruebas / boot --------------------------- */
  window.CAOZ_MESA_THREE_COMBATE=Object.freeze({
    listo:()=>ready&&!!G,
    estado:()=>!G?null:{modo,activo:G.active,fase:G.phase,over:G.over,alma:[P(ME).alma,P(FOE).alma],pd:[P(ME).pd,P(FOE).pd],deck:[P(ME).deck.length,P(FOE).deck.length],hand:[P(ME).hand.slice(),P(FOE).hand.length],field:[P(ME).field.map(u=>({id:u.card.id,uid:u.uid})),P(FOE).field.map(u=>({id:u.card.id,uid:u.uid}))],gracia:P(ME).gracia,ascended:P(ME).ascended,corte:P(FOE).corte},
    empezar:m=>startGame(m||modo),
    acabarTurno:()=>pedirTerminarTurno(),
    jugar:id=>playFromHand(ME,id),
    atacar:(uid,target)=>{const u=P(ME).field.find(x=>x.uid===uid);return u?tryAttack(u,target==='face'?'face':P(FOE).field.find(x=>x.uid===target)):false;},
    avanzar:async s=>{await sleep(s*1000);return this.estado?.();},
    seguridad:()=>({cartas:[...visuals.values()].filter(v=>v.parent===table).map(v=>({key:v.userData.key,y:v.position.y,kind:v.userData.kind})),zoom:view.zoom})
  });
  async function boot(){try{await CAOZ_CARTA_PINTOR.fuentes();if(typeof cargarArte==='function')await cargarArte();ready=true;sync();requestAnimationFrame(animate);if(CAPTURA){await startGame(qs.get('modo')||'duelo');}else chooseMode();}catch(e){console.error(e);messageFor('No se pudo preparar la mesa: '+e.message);}}
  boot();
})();

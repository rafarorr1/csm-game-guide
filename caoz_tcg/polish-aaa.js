/* ==========================================================================
   CAOZ CON TODO — POLISH AAA · combate + cartas + audio
   --------------------------------------------------------------------------
   Pieza de PANTALLA compartida por escritorio y móvil. No decide reglas, daño,
   objetivos ni muertes: el motor sigue siendo la autoridad. Esta capa sólo
   coreografía los hooks fx* que el motor ya llama.

   Se carga antes del script específico de cada pantalla y se instala en load,
   cuando fxEl/fxCenter/fxLunge/fxHit ya existen. Así funciona sobre las dos
   pantallas sin duplicar lógica.
   ========================================================================== */
'use strict';

(function CAOZ_AAA(){
  const AAA_CSS = `
/* ===== Tarjeta full-bleed: acero oscuro + acento por tipo ===== */
body.aaa-polish .card.acomodo{
  border:1.5px solid color-mix(in srgb,var(--tipo-cl,var(--gold)) 58%,#15131a 42%);
  border-radius:12px;
  background:linear-gradient(178deg,#26242b 0%,#15151a 54%,#0b0c10 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.16),
    inset 0 0 0 1px rgba(0,0,0,.5),
    inset 0 -18px 34px rgba(0,0,0,.36),
    0 7px 16px rgba(0,0,0,.48);
}
body.aaa-polish .card.acomodo::after{
  content:"";position:absolute;inset:3px;border-radius:9px;z-index:6;pointer-events:none;
  border:1px solid rgba(255,255,255,.11);
  box-shadow:inset 0 0 18px rgba(0,0,0,.42);
}
body.aaa-polish .card.acomodo .marcoDibujo{border-radius:10px}
body.aaa-polish .card.acomodo .dibujo{
  filter:saturate(1.06) contrast(1.04) brightness(.94);
  transition:filter .2s ease;
}
body.aaa-polish .card.acomodo .pieCarta{
  margin:auto -5px -5px;
  padding:1.45em .58em .62em;
  background:
    linear-gradient(180deg,transparent 0%,rgba(8,9,13,.40) 20%,rgba(8,9,13,.88) 47%,rgba(5,6,9,.98) 100%);
}
body.aaa-polish .card.acomodo .pieCarta::before{
  content:"";position:absolute;left:.45em;right:.45em;top:1.02em;height:1px;pointer-events:none;
  background:linear-gradient(90deg,transparent,var(--tipo-cl,var(--gold)),transparent);
  opacity:.7;box-shadow:0 0 8px var(--tipo,var(--gold));
}
body.aaa-polish .card.acomodo .pieCarta .nm{
  font-size:1.16em;font-weight:800;letter-spacing:.035em;font-variant:small-caps;
  color:#fffaf0;text-shadow:0 2px 4px #000,0 0 12px #000;
}
body.aaa-polish .card.acomodo .pieCarta .tribe{
  font-size:.64em;letter-spacing:.075em;text-transform:uppercase;color:#b8b0c4;
}
body.aaa-polish .card.acomodo .pieCarta .txt{
  color:#ded9e5;font-size:.80em;line-height:1.18;text-shadow:0 1px 2px #000;
}
body.aaa-polish .card.acomodo .cost{
  width:2.12em;height:2.12em;border-radius:50%;border:1px solid rgba(255,255,255,.42);
  background:
    radial-gradient(circle at 34% 26%,rgba(255,255,255,.65),transparent 25%),
    radial-gradient(circle at 42% 38%,var(--tipo-cl,var(--gold)),var(--tipo,var(--gold)) 55%,var(--tipo-os,#33234f) 100%);
  color:#fff;font-weight:950;text-shadow:0 1px 2px rgba(0,0,0,.85);
  box-shadow:0 2px 7px rgba(0,0,0,.72),inset 0 0 0 1px rgba(0,0,0,.36),0 0 9px color-mix(in srgb,var(--tipo,var(--gold)) 45%,transparent);
}
body.aaa-polish .card.acomodo .pieCarta .stats{
  position:relative;margin-top:.30em;min-height:2.25em;align-items:flex-end;
}
body.aaa-polish .card.acomodo .pieCarta .atk,
body.aaa-polish .card.acomodo .pieCarta .hp{
  display:grid;place-items:center;min-width:2.14em;width:2.14em;height:2.14em;padding:0;border-radius:50%;
  border:1px solid rgba(255,255,255,.30);font-weight:950;color:#fff;
  text-shadow:0 1px 2px #000;box-shadow:0 3px 7px rgba(0,0,0,.68),inset 0 0 0 1px rgba(0,0,0,.45);
}
body.aaa-polish .card.acomodo .pieCarta .atk{
  background:radial-gradient(circle at 38% 28%,#f5cf9b,#a86126 52%,#4b2914 100%);
}
body.aaa-polish .card.acomodo .pieCarta .hp{
  background:radial-gradient(circle at 38% 28%,#ffb1ad,#ad3d3b 52%,#51191b 100%);
}
body.aaa-polish .card.unit.selected{
  filter:brightness(1.08);
  box-shadow:0 12px 26px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.22),0 0 18px color-mix(in srgb,var(--tipo-cl,var(--gold)) 70%,transparent);
}
body.aaa-polish .card.unit.tgt{
  box-shadow:0 12px 26px rgba(0,0,0,.58),0 0 0 2px rgba(224,82,74,.62),0 0 20px rgba(224,82,74,.34);
}

/* ===== Combate ===== */
.aaa-contact{position:fixed;z-index:355;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;pointer-events:none;
  background:#fff;mix-blend-mode:screen;box-shadow:0 0 12px 5px rgba(255,255,255,.9),0 0 42px 20px rgba(255,133,70,.54)}
.aaa-contact::before{content:"";position:absolute;left:50%;top:50%;width:92px;height:2px;translate:-50% -50%;rotate:var(--ang,0deg);
  background:linear-gradient(90deg,transparent,#fff 42%,#ffd29a 52%,transparent);box-shadow:0 0 12px #ff9a54}
.aaa-wave{position:fixed;z-index:354;width:28px;height:28px;margin:-14px 0 0 -14px;border:2px solid rgba(255,219,177,.9);border-radius:50%;pointer-events:none;opacity:0}
.aaa-shard{position:fixed;z-index:356;width:var(--w,15px);height:2px;left:0;top:0;transform-origin:0 50%;pointer-events:none;border-radius:2px;
  background:linear-gradient(90deg,#fff,var(--c,#ffc27d),transparent);box-shadow:0 0 6px var(--c,#ffc27d)}
.aaa-dmg{position:fixed;z-index:360;pointer-events:none;translate:-50% -50%;font:950 clamp(24px,4.2vw,44px)/1 var(--serif,serif);letter-spacing:-.03em;
  color:#fff2ec;text-shadow:0 3px 0 #651e19,0 7px 18px rgba(0,0,0,.88),0 0 14px rgba(255,87,66,.54)}
.aaa-dmg.lethal{font-size:clamp(29px,5vw,52px);color:#fff;filter:drop-shadow(0 0 10px rgba(255,255,255,.7))}
.aaa-hit-vignette{position:fixed;inset:0;z-index:351;pointer-events:none;opacity:0;
  background:radial-gradient(ellipse at center,transparent 46%,rgba(116,19,15,.35) 100%)}
.aaa-counter-tag{position:fixed;z-index:359;translate:-50% -50%;pointer-events:none;color:#d7c6ee;
  font:800 9px/1 var(--sans,sans-serif);letter-spacing:.24em;text-transform:uppercase;text-shadow:0 2px 6px #000}
@media (prefers-reduced-motion:reduce){
  .aaa-contact,.aaa-wave,.aaa-shard,.aaa-hit-vignette,.aaa-counter-tag{display:none!important}
}
`;

  const STATE = {last:null, audio:null, gain:null, unlocked:false};

  function aaaFX(){
    try{return typeof FXON==='function' ? FXON() : true;}catch(e){return true;}
  }
  function aaaNap(ms){
    try{return typeof nap==='function' ? nap(ms) : new Promise(r=>setTimeout(r,ms));}
    catch(e){return new Promise(r=>setTimeout(r,ms));}
  }
  function aaaLayer(){ return document.getElementById('fx') || document.body; }
  function aaaAdd(cls,x,y){
    const d=document.createElement('div'); d.className=cls; d.style.left=x+'px'; d.style.top=y+'px'; aaaLayer().appendChild(d); return d;
  }
  function aaaGone(el,ms){ setTimeout(()=>{ try{el.remove();}catch(e){} },ms); }
  function aaaCenterOfEl(e){ if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; }
  function aaaCenter(u){
    try{ if(typeof fxCenter==='function') return fxCenter(u); }catch(e){}
    try{ return aaaCenterOfEl(typeof fxEl==='function'?fxEl(u):null); }catch(e){return null;}
  }
  function aaaUnitEl(u){ try{return typeof fxEl==='function'?fxEl(u):null;}catch(e){return null;} }
  function aaaFace(side){
    const id = side===ME ? 'face0' : 'face1';
    return document.getElementById(id) || document.getElementById(side===ME?'leaderMe':'leaderFoe');
  }
  function aaaTargetCenter(att,target){
    if(target!=='face') return aaaCenter(target);
    const e=aaaFace(1-att.side); return aaaCenterOfEl(e);
  }
  function aaaMotionOK(){ return !matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---- Audio procedural: sin archivos externos ---- */
  function aaaUnlock(){
    if(STATE.unlocked) return;
    STATE.unlocked=true;
    try{
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
      STATE.audio=new AC(); STATE.gain=STATE.audio.createGain(); STATE.gain.gain.value=.19; STATE.gain.connect(STATE.audio.destination);
      if(STATE.audio.state==='suspended') STATE.audio.resume();
    }catch(e){}
  }
  document.addEventListener('pointerdown',aaaUnlock,{once:true,capture:true});
  function aaaTone(freq,dur,opt={}){
    const a=STATE.audio,g=STATE.gain;if(!a||!g)return;
    try{
      const o=a.createOscillator(),v=a.createGain(),now=a.currentTime;
      o.type=opt.type||'sine'; o.frequency.setValueAtTime(freq,now);
      if(opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20,opt.to),now+dur);
      v.gain.setValueAtTime(.0001,now);v.gain.exponentialRampToValueAtTime(opt.vol||.18,now+.008);v.gain.exponentialRampToValueAtTime(.0001,now+dur);
      o.connect(v);v.connect(g);o.start(now);o.stop(now+dur+.02);
    }catch(e){}
  }
  function aaaNoise(dur=.08,vol=.12){
    const a=STATE.audio,g=STATE.gain;if(!a||!g)return;
    try{
      const n=Math.max(1,Math.floor(a.sampleRate*dur)),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
      const s=a.createBufferSource(),v=a.createGain();s.buffer=b;v.gain.value=vol;s.connect(v);v.connect(g);s.start();
    }catch(e){}
  }
  function aaaSound(k,p=1){
    if(k==='wind'){aaaTone(190,.11,{type:'sawtooth',to:72,vol:.06*p});aaaNoise(.07,.035*p);}
    else if(k==='hit'){aaaTone(72,.13,{type:'sine',to:42,vol:.24*p});aaaTone(330,.045,{type:'square',to:120,vol:.055*p});aaaNoise(.07,.11*p);}
    else if(k==='counter'){aaaTone(250,.08,{type:'sawtooth',to:95,vol:.055*p});aaaNoise(.045,.045*p);}
    else if(k==='lethal'){aaaTone(49,.28,{type:'sine',to:32,vol:.28*p});aaaNoise(.12,.08*p);}
  }

  function aaaImpact(x,y,dx,dy,power=1){
    const ang=Math.atan2(dy,dx)*180/Math.PI;
    const c=aaaAdd('aaa-contact',x,y); c.style.setProperty('--ang',ang+'deg');
    c.animate([{opacity:0,scale:'.35'},{opacity:1,scale:'1.15',offset:.18},{opacity:0,scale:'3.6'}],{duration:230,easing:'ease-out'}); aaaGone(c,250);
    const w=aaaAdd('aaa-wave',x,y);
    w.animate([{opacity:.95,scale:'.35'},{opacity:0,scale:power>1.2?'5.2':'4'}],{duration:330,easing:'cubic-bezier(.1,.7,.2,1)'});aaaGone(w,350);
    for(let i=0;i<8+Math.round(power*3);i++){
      const a=Math.atan2(dy,dx)+(Math.random()-.5)*1.55;
      const len=20+Math.random()*46*power;
      const s=aaaAdd('aaa-shard',x,y);s.style.setProperty('--w',(9+Math.random()*17)+'px');s.style.rotate=(a*180/Math.PI)+'deg';
      s.animate([{translate:'0 0',opacity:1,scale:'1'},{translate:(Math.cos(a)*len)+'px '+(Math.sin(a)*len)+'px',opacity:0,scale:'.45'}],{duration:220+Math.random()*170,easing:'cubic-bezier(.12,.7,.2,1)'});aaaGone(s,430);
    }
    const v=document.createElement('div');v.className='aaa-hit-vignette';document.body.appendChild(v);
    v.animate([{opacity:0},{opacity:Math.min(.62,.23*power),offset:.12},{opacity:0}],{duration:260});aaaGone(v,280);
    const board=document.getElementById('board')||document.getElementById('field')||document.getElementById('app');
    if(board&&aaaMotionOK()){
      const sx=Math.max(-10,Math.min(10,dx*.018))*power, sy=Math.max(-7,Math.min(7,dy*.014))*power;
      board.animate([{translate:'0 0'},{translate:(sx*-1)+'px '+(sy*-1)+'px',offset:.16},{translate:(sx*.55)+'px '+(sy*.55)+'px',offset:.43},{translate:(sx*-.2)+'px '+(sy*-.2)+'px',offset:.7},{translate:'0 0'}],{duration:210,easing:'ease-out'});
    }
  }

  function aaaDamageNumber(u,n,opt={}){
    const c=aaaCenter(u);if(!c)return;
    const d=aaaAdd('aaa-dmg'+(opt.letal?' lethal':''),c.x,c.y-Math.max(8,c.h*.05)); d.textContent='−'+n;
    d.animate([
      {opacity:0,translate:'-50% -34%',scale:'.68'},
      {opacity:1,translate:'-50% -66%',scale:'1.22',offset:.22},
      {opacity:1,translate:'-50% -78%',scale:'1',offset:.55},
      {opacity:0,translate:'-50% -128%',scale:'.92'}
    ],{duration:650,easing:'cubic-bezier(.16,.75,.26,1)'});aaaGone(d,680);
  }

  async function aaaCounter(counterEl,hitEl,amount,letal){
    if(!counterEl||!hitEl){aaaDamageNumber(STATE.last&&STATE.last.att,amount,{letal});return;}
    const a=aaaCenterOfEl(counterEl),b=aaaCenterOfEl(hitEl);if(!a||!b)return;
    const dx=(b.x-a.x)*.30,dy=(b.y-a.y)*.30;
    const tag=aaaAdd('aaa-counter-tag',(a.x+b.x)/2,(a.y+b.y)/2-22);tag.textContent='contraataque';
    tag.animate([{opacity:0,translate:'-50% -35%'},{opacity:1,translate:'-50% -50%',offset:.24},{opacity:0,translate:'-50% -80%'}],{duration:520});aaaGone(tag,550);
    counterEl.style.zIndex='78';
    aaaSound('counter',1);
    const ida=counterEl.animate([
      {translate:'0 0',scale:'1',rotate:'0deg'},
      {translate:(-dx*.08)+'px '+(-dy*.08)+'px',scale:'.98',offset:.38},
      {translate:dx+'px '+dy+'px',scale:'1.055',rotate:(dx>0?'1.2deg':'-1.2deg')}
    ],{duration:155,easing:'cubic-bezier(.18,.8,.26,1)',fill:'forwards'});
    await aaaNap(145);
    aaaImpact(b.x,b.y,b.x-a.x,b.y-a.y,Math.min(1.45,.85+amount*.08));aaaSound('hit',Math.min(1.4,.75+amount*.08));
    if(typeof vibra==='function') try{vibra([18]);}catch(e){}
    await aaaNap(55); // hit-stop
    ida.cancel();
    counterEl.animate([{translate:dx+'px '+dy+'px',scale:'1.055'},{translate:(dx*.1)+'px '+(dy*.1)+'px',scale:'1.01',offset:.48},{translate:'0 0',scale:'1'}],{duration:205,easing:'cubic-bezier(.16,.7,.2,1)'});
    hitEl.animate([{translate:'0 0',rotate:'0deg'},{translate:(dx*.12)+'px '+(dy*.12)+'px',rotate:(dx>0?'1.2deg':'-1.2deg'),offset:.18},{translate:(-dx*.035)+'px '+(-dy*.035)+'px',rotate:'0deg',offset:.55},{translate:'0 0'}],{duration:250,easing:'ease-out'});
    await aaaNap(80);aaaDamageNumber(STATE.last.att,amount,{letal});
    if(letal)aaaSound('lethal',1);
    await aaaNap(150);counterEl.style.zIndex='';
  }

  function install(){
    if(document.getElementById('aaaPolishCss'))return;
    const st=document.createElement('style');st.id='aaaPolishCss';st.textContent=AAA_CSS;document.head.appendChild(st);
    document.body.classList.add('aaa-polish');

    const oldLunge=typeof fxLunge==='function'?fxLunge:null;
    const oldHit=typeof fxHit==='function'?fxHit:null;

    /* Anticipación → aceleración muy corta → contacto → hit-stop → recuperación.
       No hace daño: doAttack() continúa y llama después a dmgU(). */
    window.fxLunge=async function aaaFxLunge(att,target){
      if(!aaaFX()||!aaaMotionOK()){ if(oldLunge)return oldLunge(att,target); return; }
      const e=aaaUnitEl(att),from=aaaCenter(att),to=aaaTargetCenter(att,target);
      if(!e||!from||!to){ if(oldLunge)return oldLunge(att,target); await aaaNap(90);return; }
      const dx=(to.x-from.x)*.43,dy=(to.y-from.y)*.43;
      const targetObj=target==='face'?null:target;
      const targetEl=targetObj?aaaUnitEl(targetObj):aaaFace(1-att.side);
      STATE.last={att,target:targetObj,attEl:e,targetEl,from,to,t:Date.now(),hits:0};
      e.style.zIndex='82';

      // anticipación: apenas se mueve, pero comprime la carta y corta el ritmo
      const pre=e.animate([
        {translate:'0 0',scale:'1',rotate:'0deg',filter:'brightness(1)'},
        {translate:(-dx*.055)+'px '+(-dy*.055)+'px',scale:'.965',rotate:(dx>0?'-1deg':'1deg'),filter:'brightness(.93)'}
      ],{duration:155,easing:'cubic-bezier(.35,0,.65,1)',fill:'forwards'});
      await aaaNap(145);pre.cancel();aaaSound('wind',1);

      // salida casi instantánea: la aceleración es lo que da violencia
      const rush=e.animate([
        {translate:(-dx*.055)+'px '+(-dy*.055)+'px',scale:'.965',rotate:(dx>0?'-1deg':'1deg')},
        {translate:dx+'px '+dy+'px',scale:'1.075',rotate:(dx>0?'1.6deg':'-1.6deg')}
      ],{duration:118,easing:'cubic-bezier(.1,.82,.2,1)',fill:'forwards'});
      await aaaNap(108);
      aaaImpact((from.x+to.x)/2,(from.y+to.y)/2,to.x-from.x,to.y-from.y,1);aaaSound('hit',1);
      if(typeof vibra==='function') try{vibra([20]);}catch(e){}
      if(targetEl&&targetObj){
        targetEl.animate([{translate:'0 0',rotate:'0deg'},{translate:(dx*.10)+'px '+(dy*.10)+'px',rotate:(dx>0?'1.4deg':'-1.4deg'),offset:.22},{translate:'0 0',rotate:'0deg'}],{duration:255,easing:'ease-out'});
      }
      await aaaNap(58); // hit-stop real: la ida conserva fill:forwards
      rush.cancel();
      e.animate([
        {translate:dx+'px '+dy+'px',scale:'1.075'},
        {translate:(dx*.08)+'px '+(dy*.08)+'px',scale:'1.012',offset:.48},
        {translate:'0 0',scale:'1'}
      ],{duration:215,easing:'cubic-bezier(.16,.72,.22,1)'});
      await aaaNap(170);e.style.zIndex='';
    };

    /* El primer fxHit del combate sólo muestra la consecuencia del golpe que ya
       vimos. El segundo, si cae sobre el atacante inmediatamente después, es el
       contraataque: se anima físicamente desde la carta defensora. */
    window.fxHit=async function aaaFxHit(u,amount,opt){
      if(!aaaFX()||!aaaMotionOK()){ if(oldHit)return oldHit(u,amount,opt); return; }
      if(typeof opt!=='object')opt={inf:!!opt}; opt=opt||{};
      const S=STATE.last,now=Date.now();
      if(S&&now-S.t<1500&&S.target&&u===S.target&&S.hits===0){
        S.hits=1;
        await aaaNap(55);aaaDamageNumber(u,amount,{letal:!!opt.letal});
        if(opt.letal)aaaSound('lethal',.75);
        return;
      }
      if(S&&now-S.t<1800&&u===S.att&&S.hits===1&&S.targetEl){
        S.hits=2;
        await aaaCounter(S.targetEl,S.attEl,amount,!!opt.letal);
        return;
      }
      // daño que no viene de esta pelea (hechizo, trampa, inicio de turno...)
      const e=aaaUnitEl(u),c=aaaCenter(u);
      if(e&&c){
        aaaImpact(c.x,c.y,0,1,Math.min(1.35,.75+amount*.08));aaaSound('hit',Math.min(1.2,.7+amount*.07));
        e.animate([{translate:'0 0'},{translate:(Math.random()>.5?5:-5)+'px 1px',offset:.22},{translate:(Math.random()>.5?2:-2)+'px -1px',offset:.48},{translate:'0 0'}],{duration:230});
      }
      await aaaNap(45);aaaDamageNumber(u,amount,{letal:!!opt.letal});
      if(opt.letal)aaaSound('lethal',.8);
    };

    /* API mínima para pruebas manuales desde consola. */
    window.CAOZ_AAA={version:1,sound:aaaSound,impact:aaaImpact,state:STATE};
  }

  if(document.readyState==='complete') install();
  else window.addEventListener('load',install,{once:true});
})();

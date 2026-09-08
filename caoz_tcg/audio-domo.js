/* Sonidos de pantalla. Ninguna descarga ni reproducción bloquea al motor. */
'use strict';
(function(){
  const base=new URL('.',document.currentScript.src),clave='caoz.sonido.v1';
  const catalogo=new Map(),buffers=new Map(),cargando=new Map(),ultimos=new Map(),voces=new Set();
  let contexto,maestro,ajustes={volumen:.7,silencio:false},generacion=0,revision=0,ultimaConsulta=0;
  const limitar=(n,d=.7)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):d;
  try{const v=JSON.parse(localStorage.getItem(clave));if(v)ajustes={volumen:limitar(v.volumen),silencio:v.silencio===true};}catch(e){}
  const permitido=()=>!document.hidden&&!ajustes.silencio&&ajustes.volumen>0&&!(typeof G!=='undefined'&&G&&(G.fast||G.silent||G.auto));
  async function json(ruta){const r=await fetch(new URL(ruta,base),{cache:'no-store',signal:AbortSignal.timeout(3500)});if(!r.ok)throw Error('Sin catálogo');return r.json();}
  const listo=json('audio/catalogo.json').then(c=>{for(const s of c.sonidos)catalogo.set(s.id,{...s,original:s.archivo,volumenOriginal:s.volumen,versionOriginal:s.version});}).catch(()=>{});
  async function actualizar(){
    await listo;if(document.hidden||Date.now()-ultimaConsulta<15000)return;ultimaConsulta=Date.now();
    try{
      const datos=await json('api/sfx/catalogo');
      if(!Array.isArray(datos.sonidos))return;
      for(const s of catalogo.values()){
        const v=datos.sonidos.find(x=>x.id===s.id),anterior=s.version;
        s.volumen=v?limitar(v.volumen,s.volumenOriginal):s.volumenOriginal;
        // El servidor sólo puede elegir audio del mismo origen, nunca scripts ni URLs externas.
        s.archivo=v&&/^[a-f0-9]{64}$/.test(v.hash||'')?'api/sfx/audio/'+v.hash:s.original;
        s.version=v?.hash||s.versionOriginal;
        if(anterior!==s.version){buffers.delete(s.id);cargando.delete(s.id);}
      }
      revision++;if(contexto?.state==='running')precargar();
    }catch(e){/* Sin red conserva el banco original o el último válido. */}
  }
  async function desbloquear(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
      if(!contexto){
        contexto=new AC();maestro=contexto.createGain();maestro.gain.value=ajustes.silencio?0:ajustes.volumen;
        const comp=contexto.createDynamicsCompressor();comp.threshold.value=-10;comp.knee.value=14;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.18;
        maestro.connect(comp);comp.connect(contexto.destination);
      }
      if(contexto.state!=='running')await contexto.resume();
      await listo;precargar();return contexto.state==='running';
    }catch(e){return false;}
  }
  function cargar(id){
    const s=catalogo.get(id);if(!s||!contexto)return Promise.resolve(null);
    const guardado=buffers.get(id);if(guardado?.version===s.version)return Promise.resolve(guardado.buffer);
    if(cargando.has(id))return cargando.get(id);
    const version=s.version;
    const p=(async()=>{
      try{
        let r=await fetch(new URL(s.archivo+'?v='+version,base),{signal:AbortSignal.timeout(6500)});
        if(!r.ok)throw Error('Audio no disponible');
        const b=await contexto.decodeAudioData(await r.arrayBuffer());
        if(b.duration>15||b.duration<=0)throw Error('Duración no admitida');
        if(catalogo.get(id)?.version===version)buffers.set(id,{version,buffer:b});
        return b;
      }catch(e){
        // Un reemplazo caído no elimina el efecto original.
        if(s.archivo!==s.original)try{
          const r=await fetch(new URL(s.original,base),{signal:AbortSignal.timeout(3500)});if(!r.ok)return null;
          const b=await contexto.decodeAudioData(await r.arrayBuffer());if(catalogo.get(id)?.version===version)buffers.set(id,{version,buffer:b});return b;
        }catch(e){}
        return null;
      }finally{if(cargando.get(id)===p)cargando.delete(id);}
    })();cargando.set(id,p);return p;
  }
  let precargando=false;
  async function precargar(){
    if(precargando||!permitido())return;precargando=true;
    try{const ids=[...catalogo.keys()];for(let i=0;i<ids.length;i+=5){if(!permitido())break;await Promise.all(ids.slice(i,i+5).map(cargar));}}
    finally{precargando=false;}
  }
  function detener(){generacion++;for(const v of voces){try{v.s.stop();}catch(e){}v.s.disconnect();v.g.disconnect();}voces.clear();}
  function play(id,op={}){
    const s=catalogo.get(id),ahora=performance.now();
    if(!s||!permitido()||contexto?.state!=='running'||s.volumen===0||ahora-(ultimos.get(id)??-Infinity)<s.intervalo)return false;
    ultimos.set(id,ahora);const turno=generacion,version=s.version;
    const iniciar=b=>{
      if(!b||turno!==generacion||s.version!==version||!permitido()||contexto.state!=='running'||performance.now()-ahora>180)return;
      // Dos voces de interfaz y ocho en total: los clics no tapan el duelo.
      const iguales=[...voces].filter(v=>v.grupo===s.grupo);
      if(s.grupo==='Interfaz'&&iguales.length>=2){try{iguales[0].s.stop();}catch(e){}}
      while(voces.size>=8){const v=voces.values().next().value;try{v.s.stop();}catch(e){}voces.delete(v);}
      const fuente=contexto.createBufferSource(),g=contexto.createGain();fuente.buffer=b;
      fuente.playbackRate.value=op.variar===false||s.grupo==='Finales'?1:1+(Math.random()-.5)*.055;
      g.gain.value=s.volumen*limitar(op.volumen,1);fuente.connect(g);g.connect(maestro);
      const voz={s:fuente,g,grupo:s.grupo,id};voces.add(voz);
      fuente.onended=()=>{voces.delete(voz);fuente.disconnect();g.disconnect();};fuente.start();
      window.dispatchEvent(new CustomEvent('caoz:sfx',{detail:{id,version:s.version}}));
    };
    const b=buffers.get(id);if(b?.version===s.version)iniciar(b.buffer);else cargar(id).then(iniciar).catch(()=>{});
    return true;
  }
  function configurar(v){
    if('volumen'in v)ajustes.volumen=limitar(v.volumen);
    if('silencio'in v)ajustes.silencio=v.silencio===true;
    if(maestro)maestro.gain.setTargetAtTime(ajustes.silencio?0:ajustes.volumen,contexto.currentTime,.025);
    if(ajustes.silencio||!ajustes.volumen)detener();
    try{localStorage.setItem(clave,JSON.stringify(ajustes));}catch(e){}
    window.dispatchEvent(new CustomEvent('caoz:audioajustes',{detail:{...ajustes}}));
  }
  function magia(c){
    if(!c)return 'spell_arcane';
    if(c.id==='escarcha')return 'spell_frost';
    if(c.id==='contrahechizo')return 'shield';
    if(c.id==='pasoatronador'||/rayo|relampago|trueno|thunder/i.test(c.n)&&!c.sub?.includes('fuego'))return 'spell_lightning';
    const mapa={fuego:'spell_fire',hielo:'spell_frost',rayo:'spell_lightning',cancion:'spell_bard',fe:'spell_holy',engano:'spell_shadow',sombra:'spell_shadow'};
    return mapa[c.sub?.[0]]||'spell_arcane';
  }
  function instalar(){
    const envolver=(nombre,antes)=>{const f=window[nombre];if(typeof f!=='function')return;window[nombre]=function(...args){if(permitido())antes(...args);return f.apply(this,args);};};
    for(const [hook,id] of Object.entries({fxDraw:'card_draw',fxSummon:'card_play',fxObj:'card_play',fxHeal:'heal',fxBuff:'buff',fxHabilidad:'spell_arcane',fxBanner:'turn'}))envolver(hook,()=>play(id));
    envolver('fxSpell',id=>play(magia({...CARDS[id],id})));
    envolver('fxFace',side=>{const s=window.CAOZ_AAA?.state.last;if(s&&s.g===G&&!s.target&&s.att.side!==side&&!s.almaSonada&&Date.now()-s.t<3000){s.almaSonada=true;return;}play('attack_hit');});
    envolver('fxHit',(u,n,opt)=>{if(!opt?.combate||matchMedia('(prefers-reduced-motion:reduce)').matches)play(opt?.letal?'lethal':'attack_hit');});
    // Los hooks conservan argumentos, resultado y promesa tanto en anfitrión como invitado.
    document.addEventListener('pointerover',e=>{const b=e.target.closest('button');if(e.pointerType==='mouse'&&b&&!b.disabled&&!b.contains(e.relatedTarget))play('ui_hover');});
    document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled&&!b.closest('.audioControles'))play(/volver|regresar|menú|cancelar/i.test(b.textContent)?'ui_back':'ui_confirm');},true);
    for(const padre of [document.getElementById('buildMenu')?.parentElement,document.getElementById('buildPanel')?.parentElement]){
      if(!padre)continue;
      const box=document.createElement('span');box.className='audioControles';
      const b=document.createElement('button');b.type='button';b.title='Activar o silenciar los efectos de sonido';
      const rango=document.createElement('input');rango.type='range';rango.min='0';rango.max='100';rango.setAttribute('aria-label','Volumen de efectos de sonido');
      const pintar=()=>{b.textContent=ajustes.silencio||ajustes.volumen===0?'♪ Silenciado':'♪ Sonido';b.setAttribute('aria-pressed',String(!ajustes.silencio&&ajustes.volumen>0));rango.value=Math.round(ajustes.volumen*100);};
      b.onclick=()=>{desbloquear();configurar({silencio:!ajustes.silencio,volumen:ajustes.volumen||.7});};
      rango.oninput=()=>configurar({volumen:Number(rango.value)/100,silencio:false});pintar();window.addEventListener('caoz:audioajustes',pintar);box.append(b,rango);padre.appendChild(box);
    }
    const css=document.createElement('style');css.textContent='.audioControles{display:inline-flex;align-items:center;gap:5px;margin-left:8px;vertical-align:middle}.audioControles button{font:inherit;font-size:11px;color:#ddca9b;background:#18121c;border:1px solid #655237;border-radius:6px;padding:5px 7px;cursor:pointer;min-height:28px}.audioControles input{width:55px;height:24px;accent-color:#d5b56c}.audioControles button:focus-visible{outline:2px solid #f5ce7d}@media(max-width:420px){.audioControles input{width:42px}.audioControles{margin-left:3px}.audioControles button{font-size:10px;padding:4px}}';document.head.appendChild(css);
    actualizar();
  }
  document.addEventListener('pointerdown',desbloquear,{capture:true});
  document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')desbloquear();},{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)detener();else actualizar();});
  window.addEventListener('pagehide',detener);window.addEventListener('focus',actualizar);
  setInterval(()=>{if(!document.hidden)actualizar();},60000);
  window.CAOZ_AUDIO={play,detener,desbloquear,configurar,actualizar,cargar,listo,magia,get ajustes(){return {...ajustes};},get catalogo(){return [...catalogo.values()].map(s=>({...s}));},get estado(){return {contexto:contexto?.state||'cerrado',voces:voces.size,cargados:buffers.size,revision};}};
  if(document.readyState==='complete')instalar();else window.addEventListener('load',instalar,{once:true});
})();

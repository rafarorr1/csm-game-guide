/* Los seis sellos y el Editor. Los logros no pertenecen al avance que se reinicia. */
'use strict';
(function(){
  const clave='caoz.campana.logros.v1'+(new URLSearchParams(location.search).has('test')?'.prueba':''),memoria=new Map();
  const ids=Object.keys(DECKS).filter(id=>LEADERS[id]),vacio=()=>({version:1,mazos:{},ganador:null});
  function normalizar(dato){
    const limpio=vacio();if(dato?.version!==1)return limpio;
    for(const id of ids){const m=dato.mazos?.[id];if(m&&typeof m.nombre==='string'&&Number.isFinite(m.fecha))limpio.mazos[id]={nombre:m.nombre.slice(0,24),fecha:m.fecha};}
    const g=dato.ganador;if(g&&typeof g.nombre==='string'&&g.nombre.trim()&&ids.includes(g.lider)&&Number.isFinite(g.fecha))limpio.ganador={nombre:g.nombre.slice(0,24),lider:g.lider,fecha:g.fecha};
    return limpio;
  }
  function leer(prueba=false){const k=clave+(prueba?'.simulados':'');let d=memoria.get(k);try{if(!d)d=JSON.parse(localStorage.getItem(k));}catch(_){}return normalizar(d);}
  function guardar(d,prueba=false){const k=clave+(prueba?'.simulados':'');try{localStorage.setItem(k,JSON.stringify(d));memoria.delete(k);}catch(_){memoria.set(k,normalizar(d));toast('El sello queda disponible mientras mantengas abierto el juego; este navegador no permitió guardarlo.');}window.dispatchEvent(new CustomEvent('caoz:campana-logros',{detail:{prueba}}));}
  window.CAMPANA_LOGROS=Object.freeze({leer,tiene:(id,prueba=false)=>!!leer(prueba).mazos[id],total:(prueba=false)=>Object.keys(leer(prueba).mazos).length,ganador:(prueba=false)=>leer(prueba).ganador});
  addEventListener('storage',e=>{if(e.key===clave||e.key===clave+'.simulados'){memoria.delete(e.key);window.dispatchEvent(new CustomEvent('caoz:campana-logros',{detail:{prueba:e.key.endsWith('.simulados')}}));}});
  window.campanaMarcarGero=function(p){
    if(!p||p.etapa!==6||!ids.includes(p.lider))return;
    const prueba=p.prueba===true,d=leer(prueba);
    if(!d.mazos[p.lider]){d.mazos[p.lider]={nombre:campanaNombre(p),fecha:Date.now()};guardar(d,prueba);}
    if(ids.every(id=>d.mazos[id])&&!p.secreto)p.secreto='ascenso';
  };
  function puedeEnsayarGero(){
    return campanaPruebaDisponible()&&G&&!G.over&&!G.auto&&!G.silent&&!G.online&&!G.guest&&!NET.on&&P(FOE).leaderId==='gero';
  }
  function accionPendiente(){
    return G.busy||G.resolving||G.active!==ME||G.phase!=='principal'||!!TGT||!!TUT.pending||!!document.querySelector('#dice.on,#ov.on,.vs');
  }
  window.campanaBotonFinalGero=function(controles){
    controles.querySelector('#betaFinalGero')?.remove();
    if(!puedeEnsayarGero())return;
    const b=campanaBoton('Beta · Vencer a Gero y ver el final',campanaProbarFinalGero);
    b.id='betaFinalGero';b.classList.add('betaFinalGero');b.disabled=accionPendiente();
    b.title=b.disabled?'Disponible en tu turno, al terminar la acción actual.':'Victoria, ascenso y Pitágoras. Tu campaña guardada se conserva.';
    controles.appendChild(b);
  };
  window.campanaProbarFinalGero=function(){
    if(!puedeEnsayarGero()||accionPendiente())return false;
    const lider=P(ME).leaderId;
    const personaje=campanaNormalizarPersonaje(G.campana?.personaje||{nombre:P(ME).L.n});
    // Ensayo en memoria: no fabrica seis sellos ni sobrescribe otra campaña.
    campanaEnsayoGero={version:1,id:'ensayo-gero-'+Date.now(),lider,personaje,etapa:5,prueba:true,enEncuentro:true};
    G.over=true;G.winner=ME;G.endWhy='Victoria de prueba · Beta';P(FOE).alma=0;
    G.campana={id:campanaEnsayoGero.id,etapa:5,alma:40,personaje,prueba:true,pruebaFinalGero:true};
    G.campanaResuelta=false;G.tutorial=false;SEL=null;
    tutEnd();clearPrompt();relojPara();cerrarOv();
    if(typeof cerrarHojas==='function')cerrarHojas();
    render();campanaFinal(ME,G.endWhy);return true;
  };
  let escena=null;
  function vigente(e){const p=campanaLeer();return escena===e&&!e.cancelado&&p?.id===e.id;}
  function limpiar(){const e=escena;if(!e)return;escena=null;e.cancelado=true;e.timers.forEach(clearTimeout);e.visual?.destruir();if(e.d.open)e.d.close();e.d.remove();}
  window.campanaCancelarSecreto=limpiar;
  function esperar(e,ms,fn){e.timers.push(setTimeout(()=>{if(vigente(e))fn();},ms));}
  function fase(e,nombre){e.d.dataset.fase=nombre;e.visual?.destruir();e.visual=null;e.d.replaceChildren();}
  function guardarFase(e,nombre){const p=campanaLeer();if(!vigente(e))return null;p.secreto=nombre;delete p.mesaPendiente;campanaGuardar(p);return p;}
  function mensajePrueba(e,p){if(!p.prueba)return;const m=document.createElement('small');m.className='secretoPrueba';m.textContent='Prueba beta · sellos de ensayo';e.d.appendChild(m);}
  function prepararTrono(e){
    const p=guardarFase(e,'trono');if(!p)return;
    if(e.visual?.revelado&&typeof e.visual.habilitarCombate==='function'){
      // La revelación se vuelve interactiva sin volver a dibujar al héroe ni
      // desmontar la imagen que Safari ya tiene decodificada en pantalla.
      e.d.dataset.fase='trono';e.visual.habilitarCombate(()=>combatir(e));
    }else{
      fase(e,'trono');const host=document.createElement('div');host.className='secretoEscena';e.d.appendChild(host);
      if(window.montarEscenaPitagoras)e.visual=montarEscenaPitagoras(host,{personaje:p.personaje,onFight:()=>combatir(e)});
      else{const b=campanaBoton('Pitágoras · El Editor — Combatir',()=>combatir(e),true);host.appendChild(b);}
    }
    const volver=campanaBoton('Menú principal',campanaVolverAlMenu);volver.classList.add('secretoMenu');e.d.appendChild(volver);mensajePrueba(e,p);
    if(campanaPruebaDisponible()){
      const prueba=campanaBoton('Vencer al Editor · Prueba beta',()=>vencerPrueba(e));prueba.classList.add('secretoVencer');prueba.dataset.pruebaCampana='pitagoras';e.d.appendChild(prueba);
    }
  }
  function revelar(e,origen){
    const p=guardarFase(e,'revelacion');if(!p)return;fase(e,'revelacion');
    const terminar=()=>{if(vigente(e)&&e.d.dataset.fase==='revelacion')prepararTrono(e);};
    if(window.montarRevelacionPitagoras)e.visual=montarRevelacionPitagoras(e.d,{personaje:p.personaje,origen,onRevelado:terminar});
    else esperar(e,1200,terminar);
  }
  function terminar(e){
    const p=guardarFase(e,'completado');if(!p)return;
    showScreen('menu');limpiarTransicionMenu();
    // El nombre ganador ya está pintado bajo una cobertura negra que se retira.
    fase(e,'menu');esperar(e,900,limpiar);
  }
  function final(e){
    const p=guardarFase(e,'final');if(!p)return;fase(e,'final');
    const d=leer(!!p.prueba);d.ganador={nombre:campanaNombre(p),lider:p.lider,fecha:Date.now()};guardar(d,!!p.prueba);
    if(window.montarFinalPitagoras)e.visual=montarFinalPitagoras(e.d,{personaje:p.personaje,nombre:campanaNombre(p),onTerminar:()=>terminar(e)});
    else{
      const h=document.createElement('h1');h.textContent='Tú, '+campanaNombre(p)+', tú sí eres el verdadero Caoz Con Todo.';e.d.appendChild(h);esperar(e,6000,()=>terminar(e));
    }
  }
  window.campanaAbrirSecreto=function(opciones={}){
    const p=campanaLeer();if(!p||p.etapa!==6||!p.secreto)return;
    if(escena?.id===p.id&&escena.d.open)return;
    if(p.secreto==='completado'){campanaCrear();return;}
    campanaCerrar();cerrarCinematica();
    const d=document.createElement('dialog');d.id='campanaSecreto';d.setAttribute('aria-label','El secreto del Domo');
    // La primera pintura del final conserva la mesa debajo del fundido.
    // Establecerlo después de showModal provocaba un corte negro de un cuadro.
    if(p.secreto==='final')d.dataset.fase='final';
    const e={d,id:p.id,timers:[],cancelado:false,visual:null,lanzando:false};escena=e;
    d.addEventListener('cancel',ev=>{ev.preventDefault();if(['revelacion','trono'].includes(d.dataset.fase))campanaVolverAlMenu();});
    d.addEventListener('close',()=>{if(!d.open&&escena===e)limpiar();});document.body.appendChild(d);d.showModal();
    if(p.secreto==='final')final(e);else if(['trono','combate'].includes(p.secreto))prepararTrono(e);else revelar(e,opciones.origen);
  };
  function opciones(p){return {nombres:[campanaNombre(p),'Pitágoras'],campana:{id:p.id,etapa:6,alma:40,personaje:p.personaje,jefeSecreto:true,prueba:!!p.prueba,pruebaEditor:!!p.pruebaEditor}};}
  async function combatir(e){
    const p=campanaLeer();if(!p||p.etapa!==6||!['trono','combate'].includes(p.secreto)||campanaLanzando||e&&!vigente(e))return;
    if(NET.on){toast('Sal de la sala online antes de comenzar la campaña.');return;}
    campanaLanzando=true;p.secreto='combate';campanaGuardar(p);campanaCerrar();cerrarCinematica();
    try{await startMatch(p.lider,'adreida',opciones(p));}
    finally{campanaLanzando=false;}
  }
  function vencerPrueba(e){
    const p=campanaLeer();if(!campanaPruebaDisponible()||!vigente(e)||e.d.dataset.fase!=='trono'||NET.on)return;
    p.prueba=true;p.secreto='combate';campanaGuardar(p);campanaCerrar();cerrarCinematica();
    newGame(p.lider,'adreida');G.campana=opciones(p).campana;G.over=true;P(FOE).alma=0;
    if(window.campanaPrepararRival)campanaPrepararRival();showScreen('board');render();campanaFinal(ME,'Victoria de prueba · Beta');
  }
  window.campanaEnsayarPitagoras=async function(){
    if(!campanaPruebaDisponible()||NET.on||G?.online||G?.guest||campanaLanzando||PITAGORAS_PRUEBAS?.activa)return false;
    const anterior=campanaLeer(),ensayoAnterior=campanaEnsayoGero;
    const lider=anterior?.lider||'fender',personaje=campanaNormalizarPersonaje(anterior?.personaje||{nombre:'Viajero'});
    // El ensayo usa el mismo recorrido que la campaña y guarda únicamente en
    // memoria; nunca sustituye el avance ni concede sellos reales.
    const ensayo={version:1,id:'ensayo-editor-'+Date.now(),lider,personaje,etapa:6,secreto:'combate',prueba:true,pruebaEditor:true};
    campanaEnsayoGero=ensayo;
    try{await combatir();return campanaEnsayoGero===ensayo&&G?.campana?.id===ensayo.id&&!!G.campana.pruebaEditor;}
    catch(error){if(campanaEnsayoGero===ensayo)campanaEnsayoGero=ensayoAnterior;throw error;}
  };
  window.campanaBotonesEditorBeta=function(host){
    host.querySelector('#betaEditorDano')?.remove();
    const g=G;
    const vigente=()=>G===g&&campanaPruebaDisponible()&&g?.campana?.pruebaEditor&&g.campana.jefeSecreto&&campanaEnsayoGero?.id===g.campana.id&&!g.over&&!g.online&&!g.guest&&!NET.on;
    if(!vigente())return;
    const b=campanaBoton('Beta · Pitágoras −10 Alma',async()=>{
      if(!vigente()||accionPendiente())return;
      g.resolving=true;P(FOE).alma=Math.max(0,P(FOE).alma-10);render();
      try{await fxFace(FOE,10);if(G!==g||g.over)return;if(P(FOE).alma<=0)endGame(ME,'El Editor se disuelve.');}
      finally{g.resolving=false;if(G===g)render();}
    });
    b.id='betaEditorDano';b.classList.add('betaFinalGero');b.disabled=accionPendiente();host.appendChild(b);
  };
  window.campanaFinalSecreto=async function(winner,why){
    const g=G,p=campanaLeer();if(!p||p.etapa!==6||!g.campana?.jefeSecreto||p.id!==g.campana.id||g.campanaResuelta)return;
    g.campanaResuelta=true;RECORD_ULTIMO=null;relojPara();
    if(winner===ME){
      p.secreto='final';campanaGuardar(p);
      // La mesa debe respirar otra vez antes de abrir el epílogo. Guardamos el
      // final antes de la animación para poder retomarlo si se cierra la app.
      const limpio=window.PITAGORAS_MESA?await PITAGORAS_MESA.disolver(g):true;
      if(limpio&&G===g&&campanaLeer()?.id===p.id&&campanaLeer()?.secreto==='final')campanaAbrirSecreto();
      return;
    }
    p.secreto='combate';campanaGuardar(p);
    const acciones={textoPrincipal:'↺ Revancha contra Pitágoras',revancha:()=>{if(G===g)combatir();},menu:()=>{if(G===g)campanaVolverAlMenu();}};
    cinematicaFinal(winner,why,acciones).then(hecho=>{
      if(hecho||G!==g)return;const d=campanaDialogo();campanaCabecera(d,'Pitágoras sigue al acecho','Tu revancha empieza directamente en el combate.');
      d.append(campanaAcciones(campanaBoton('Revancha contra Pitágoras',acciones.revancha,true),campanaBoton('Menú principal',acciones.menu)));
    });
  };
  const css=document.createElement('style');css.textContent=`
  #controls .betaFinalGero{min-height:44px;padding:7px 12px;font:600 12px/1.2 var(--sans,sans-serif);color:#ddc4f6;border:1px dashed #9671bd;background:#271b38;white-space:normal}
  #controls .betaFinalGero:disabled{opacity:.45}
  @media(max-width:700px){#controls .betaFinalGero{flex:1 0 100%;order:-1}}
  #campanaSecreto{position:fixed;inset:0;top:var(--campana-desfase,0px);margin:0;padding:0;border:0;width:100vw;height:var(--campana-alto,100dvh);max-width:none;max-height:none;overflow:hidden;box-sizing:border-box;color:#f4ebdb;background:#030305;text-align:center}
  #campanaSecreto[open]{display:grid;place-items:center}#campanaSecreto::backdrop{background:#000}
  #campanaSecreto[data-fase="final"],#campanaSecreto[data-fase="final"]::backdrop{background:transparent}
  .secretoReto{position:relative;z-index:2;display:grid;justify-items:center;gap:28px;padding:24px;max-width:780px}
  .secretoReto h1{font:600 clamp(30px,6.5vw,64px)/1.18 var(--serif,serif);text-wrap:balance;margin:0;color:#eee8d8;text-shadow:0 0 38px #ecddaa44;animation:secretoPregunta .8s ease-out both}
  .secretoReto .btn{font-size:28px;min-width:120px;min-height:52px;letter-spacing:.12em}
  .secretoLuz{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%,#d5c18922,transparent 48%);animation:secretoLuz 1s ease-out both;pointer-events:none}
  .secretoEscena{position:absolute;inset:0;display:grid;place-items:center}
  #campanaSecreto .secretoMenu{position:absolute;bottom:max(14px,env(safe-area-inset-bottom));left:50%;translate:-50% 0;z-index:5;min-height:44px;font-size:13px;background:#0c0e12d9;border:1px solid #82858344}
  #campanaSecreto:has(.secretoVencer) .secretoMenu{left:12px;translate:none;width:calc(50% - 18px);max-width:260px;font-size:11px;padding:7px}
  #campanaSecreto .secretoVencer{position:absolute;right:12px;bottom:max(14px,env(safe-area-inset-bottom));top:auto;width:calc(50% - 18px);max-width:260px;z-index:5;min-height:44px;padding:7px;font-size:11px;background:#16131ccb;border:1px solid #726a7b66;white-space:normal}
  .secretoPrueba{position:absolute;left:12px;top:max(12px,env(safe-area-inset-top));z-index:5;max-width:40%;font:10px var(--sans,sans-serif);color:#b8b0bd;text-align:left;pointer-events:none}
  #campanaSecreto[data-fase="menu"]{animation:secretoMenu .9s ease-out both}#campanaSecreto[data-fase="menu"]::backdrop{background:transparent}
  @keyframes secretoMenu{from{opacity:1}to{opacity:0}}@keyframes secretoPregunta{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}@keyframes secretoLuz{from{opacity:1}to{opacity:.3}}
  @media(prefers-reduced-motion:reduce){.secretoReto h1,.secretoLuz{animation:none}}
  `;document.head.appendChild(css);
})();

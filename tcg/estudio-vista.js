/* Visor aislado del estudio: usa los constructores, reglas y CSS del juego.
   No inicia partidas ni escribe en la biblioteca. Sólo acepta a su estudio padre. */
'use strict';
(function(){
  if(parent===window||!new URLSearchParams(location.search).has('estudioVista'))return;
  let escenario;
  const movil=()=>!!document.getElementById('panelCerrar');
  function ajustar(){
    if(!escenario?.firstElementChild)return;
    escenario.style.transform='none';const r=escenario.getBoundingClientRect();
    const escala=Math.min(1.65,(innerWidth-38)/Math.max(1,r.width),(innerHeight-38)/Math.max(1,r.height));
    escenario.style.transform='translate(-50%,-50%) scale('+escala+')';
    parent.postMessage({tipo:'caoz:vista-medida',texto:'Vista real · '+Math.round(r.width)+' × '+Math.round(r.height)+' px · '+Math.round(escala*100)+'% de visualización'},location.origin);
  }
  function pintar(d){
    const tipo=d.vista.replace(/^(desktop|movil)_/,''),lid=d.id.startsWith('lider_')?d.id.slice(6):null;
    if(!(lid?LEADERS[lid]:CARDS[d.id])||!CAOZ_VISTAS.claves.has(d.vista)||!CAOZ_VISTAS.valido(d.encuadre)||!['normal','foil','dorado'].includes(d.acabado))return;
    if(d.url){try{const u=new URL(d.url,location.href);if(u.origin!==location.origin||!['http:','https:','blob:'].includes(u.protocol))return;}catch(e){return;}}
    if(!G)newGame('fender','adreida');
    CAOZ_ARTE.previsualizar(d);escenario.replaceChildren();escenario.className='';escenario.dataset.vistaArte=d.vista;
    let carta;
    if(tipo==='detalle'){
      if(lid){G=newGame(lid,'adreida',{fast:true,silent:true});if(movil())fichaLider(ME);else showInspectLeader(document.getElementById('leaderMe'),ME);carta=document.getElementById('inspectCard').cloneNode(true);}
      else{carta=document.createElement('div');carta.className='big t-'+CARDS[d.id].t;carta.innerHTML=inspectHTML(d.id);const art=carta.querySelector('.art');art.dataset.arteId=d.id;if(d.url){art.classList.add('conarte');ponerDibujo(art,d.url,d.encuadre);}CAOZ_ARTE.acabar(art,d.id);}
      carta.removeAttribute('id');carta.style.width=movil()?'300px':'262px';escenario.append(carta);
    }else if(lid){
      if(tipo==='seleccion'){if(!movil())escenario.className='pista';SELP=lid;SEL_PASO='yo';buildSelect();carta=document.querySelector('#leaderList [data-lid="'+lid+'"]')?.cloneNode(true);}
      if(tipo==='hud'){G=newGame(lid,'adreida',{fast:true,silent:true});renderLeaders();carta=document.getElementById('leaderMe').cloneNode(true);carta.removeAttribute('id');}
      if(!carta)carta=cartaDeLiderVS(lid,'');
      if(tipo==='victoria'){escenario.className='fin entra';carta.classList.add('gana');}
      if(tipo==='vs')escenario.className='vs entra';
      if(tipo==='campana'){carta.className='campanaCarta';const hab=document.createElement('span');hab.className='lhab';hab.textContent=LEADERS[lid].habName+' · '+LEADERS[lid].habCost+' PD';carta.append(hab);}
      if(tipo==='ruta'){escenario.className='campanaMesa';const ruta=document.createElement('div');ruta.className='campanaRuta';ruta.append(carta.querySelector('.lface'));carta=ruta;}
      if(tipo==='honor'){
        carta=document.createElement('span');carta.className='campanaRetrato completado';carta.style.cssText='width:44px;height:44px;border-radius:50%;overflow:hidden;display:block;position:relative;border:1px solid #c5a465';
        if(d.url){const img=new Image();img.src=d.url;img.style.cssText='position:absolute;left:50%;top:50%;height:auto;width:'+d.encuadre.z+'%;transform:translate(-'+d.encuadre.x+'%,-'+d.encuadre.y+'%)';carta.append(img);}else carta.textContent=LEADERS[lid].art;
      }else if(!['hud','ruta'].includes(tipo)){carta.style.cssText+=';position:relative;left:auto;top:auto;right:auto;bottom:auto;transform:none;translate:none;rotate:none;opacity:1;margin:0;max-height:none';if(!carta.classList.contains('ltile'))carta.style.width=tipo==='campana'?'180px':'230px';if(tipo==='campana')carta.style.height='260px';}
      escenario.append(carta);
    }else if(tipo==='memoria'&&window.PITAGORAS_PRUEBAS?.vistaMemoria){
      carta=PITAGORAS_PRUEBAS.vistaMemoria(d.id);escenario.className='pitPrueba';escenario.append(carta);
    }else{
      carta=tipo==='campo'?unitEl(mkUnit(d.id,ME)):cardEl(d.id,{});
      const contexto=document.createElement('div');contexto.dataset.vistaArte=d.vista;
      if(tipo==='mano'){contexto.id='hand';contexto.style.cssText='position:relative;width:auto;height:auto;min-height:0;padding:10px;overflow:visible;display:flex;';}
      if(tipo==='campo'){contexto.className='row';contexto.style.cssText='width:auto;min-height:0;padding:10px';}
      if(tipo==='revelada')contexto.className='revela';
      if(tipo==='coleccion'){contexto.className='gallery';contexto.style.cssText='width:340px;display:flex;justify-content:center';}
      if(tipo==='descarte'){if(movil())escenario.className='pilas';contexto.className='alcantarillaPila';contexto.innerHTML='<span class="alcantarillaCartas"></span>';contexto.firstChild.append(carta);}else contexto.append(carta);
      escenario.append(contexto);
    }
    escenario.querySelectorAll('[data-arte-id]').forEach(n=>{n.dataset.vistaArte=d.vista;CAOZ_ARTE.acabar(n,d.id);if(d.url){n.style.setProperty('--ex',d.encuadre.x+'%');n.style.setProperty('--ey',d.encuadre.y+'%');n.style.setProperty('--ez',d.encuadre.z/100);}});
    if(typeof encajarTextos==='function')encajarTextos(escenario);
    requestAnimationFrame(ajustar);escenario.querySelectorAll('img').forEach(img=>img.addEventListener('load',ajustar,{once:true}));
  }
  addEventListener('load',()=>{
    const estilo=document.createElement('style');estilo.textContent=`html,body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#121018!important}body>*:not(#muestraEstudio){display:none!important}#muestraEstudio{position:absolute!important;left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;inset-inline-end:auto!important;display:block!important;width:max-content!important;height:max-content!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;transform-origin:center;zoom:1!important;background:none!important;pointer-events:none!important;visibility:visible!important;opacity:1!important;padding:12px!important}#muestraEstudio::before,#muestraEstudio::after{display:none!important}#muestraEstudio *{animation:none!important;transition:none!important}#muestraEstudio .big{max-width:none!important}#muestraEstudio .ltile{width:340px}#muestraEstudio .card{translate:none!important;rotate:none!important}#muestraEstudio .vscard{max-width:none!important}#muestraEstudio #hand .card{transform:none!important}`;
    document.head.append(estilo);escenario=document.createElement('div');escenario.id='muestraEstudio';document.body.append(escenario);
    parent.postMessage({tipo:'caoz:vista-lista'},location.origin);
  });
  addEventListener('resize',()=>requestAnimationFrame(ajustar));
  addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.tipo!=='caoz:estudio-vista'||!escenario)return;pintar(e.data);});
})();

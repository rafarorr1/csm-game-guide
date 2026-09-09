/* Acceso de revisión sólo en beta. No guarda campaña, honores ni récords. */
'use strict';
(function(){
  let actual=null;
  window.abrirLaboratorioEditor=function(){
    if(!campanaPruebaDisponible()||actual||(typeof NET!=='undefined'&&NET.on)||(typeof G!=='undefined'&&(G?.online||G?.guest))||window.PITAGORAS_PRUEBAS?.activa)return;
    const d=document.createElement('dialog');d.className='editorLaboratorio';d.setAttribute('aria-labelledby','laboratorioTitulo');
    const e={d,cerrado:false};actual=e;
    const nodo=(tag,clase,txt,par=d)=>{const n=document.createElement(tag);n.className=clase;if(txt)n.textContent=txt;par.appendChild(n);return n;};
    const cab=nodo('header','elCab','');nodo('small','','LAS REALIDADES DEL EDITOR · BETA',cab);nodo('h1','','Cruza el umbral',cab).id='laboratorioTitulo';nodo('p','','Elige una carta para probar su mundo.',cab);
    const lista=nodo('div','elMundos','');
    for(const [tipo,etiqueta] of [['isometrico','CENITAL'],['laseres','ESQUIVA'],['fps','FPS · RETRO'],['carrera','TRES CARRILES'],['orbital','NUEVO · SUPERVIVENCIA ESPACIAL'],['duelo','NUEVO · MEMORIA']]){
      const info=PITAGORAS_PRUEBAS.tipos[tipo];if(!info)continue;
      const b=nodo('button','elMundo','',lista);b.type='button';b.dataset.tipo=tipo;b.setAttribute('aria-label',info.nombre);
      const arte=nodo('canvas','elArte','',b);arte.setAttribute('aria-hidden','true');arte.width=420;arte.height=220;window.PITAGORAS_CINE?.pintarCarta(arte,tipo,0,true);
      const texto=nodo('div','elTexto','',b);nodo('small','',etiqueta,texto);nodo('strong','',info.nombre,texto);nodo('span','',info.sub,texto);
      b.onclick=async()=>{
        if(e.ocupado||e.cerrado)return;e.ocupado=true;lista.inert=true;salir.disabled=true;batalla.disabled=true;
        const p=typeof campanaLeer==='function'?campanaLeer():null,personaje=p?.personaje||campanaNormalizarPersonaje({nombre:'Viajero'});
        try{const r=await PITAGORAS_PRUEBAS.iniciar({tipo,personaje,nombre:personaje.nombre,cinematica:true,duracion:20});if(!e.cerrado&&!r.cancelado){estado.textContent=info.nombre+' · '+(r.sobrevivio?'Sobreviviste':'Inténtalo de nuevo');b.dataset.probado='1';}}
        finally{e.ocupado=false;if(!e.cerrado){lista.inert=false;salir.disabled=false;batalla.disabled=false;b.focus({preventScroll:true});}}
      };
    }
    const pie=nodo('footer','elPie',''),estado=nodo('span','','20 segundos · 3 vidas',pie);estado.setAttribute('aria-live','polite');
    const acciones=nodo('div','elAcciones','',pie),batalla=nodo('button','elSalir elBatalla','Batalla contra Pitágoras',acciones);batalla.type='button';
    batalla.onclick=async()=>{if(e.ocupado||e.cerrado)return;d.close();await window.campanaEnsayarPitagoras?.();};
    const salir=nodo('button','elSalir','Menú principal',acciones);salir.type='button';salir.onclick=()=>d.close();
    const ajustar=()=>d.style.setProperty('--editor-vh',(visualViewport?.height||innerHeight)+'px');ajustar();window.addEventListener('resize',ajustar);visualViewport?.addEventListener('resize',ajustar);
    d.addEventListener('cancel',ev=>{if(e.ocupado)ev.preventDefault();});d.addEventListener('close',()=>{e.cerrado=true;if(e.ocupado)PITAGORAS_PRUEBAS.cancelar();window.removeEventListener('resize',ajustar);visualViewport?.removeEventListener('resize',ajustar);d.remove();if(actual===e)actual=null;});
    document.body.appendChild(d);d.showModal();lista.querySelector('button')?.focus({preventScroll:true});
  };
  const css=document.createElement('style');css.textContent=`
  .editorLaboratorio{position:fixed!important;inset:0!important;margin:auto!important;box-sizing:border-box;width:min(1080px,calc(100vw - 28px))!important;height:min(820px,calc(var(--editor-vh,100dvh) - 28px))!important;max-width:none!important;max-height:none!important;border:1px solid #827253!important;border-radius:14px!important;padding:clamp(14px,3vw,28px)!important;background:radial-gradient(ellipse at 50% 0,#23313a,#0a1019 62%)!important;color:#eadfc8!important;box-shadow:0 24px 100px #000c;overflow:hidden!important;font-family:system-ui,sans-serif;zoom:1!important}
  .editorLaboratorio[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:18px}.editorLaboratorio::backdrop{background:#02050ced;backdrop-filter:blur(8px)}.elCab{text-align:center}.elCab small{font-size:9px;letter-spacing:3px;color:#bea879}.elCab h1{font:small-caps 700 clamp(24px,4vw,42px)/1.1 Georgia;margin:10px 0;color:#f2deae}.elCab p{font-size:12px;margin:0;color:#8f9fae}.elMundos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:14px;min-height:0}.elMundo{position:relative;appearance:none;border:1px solid #66685d;border-radius:8px;min-width:0;min-height:0;padding:0;overflow:hidden;background:#0b101a;color:#e7d4af;cursor:pointer;text-align:left;transition:scale .2s,border-color .2s,box-shadow .2s}.elMundo:hover,.elMundo:focus-visible{scale:1.025;outline:none;border-color:#d8bd82;box-shadow:0 0 28px #c6a36822}.elArte{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:.85}.elTexto{position:absolute;inset:auto 0 0;padding:22px 14px 14px;background:linear-gradient(transparent,#050b14 45%)}.elTexto small{font-size:8px;letter-spacing:1.3px;color:#96c2cf}.elTexto strong{display:block;font:small-caps 700 clamp(17px,2vw,24px) Georgia;margin:5px 0}.elTexto span{font-size:10px;color:#b1a99e}.elMundo[data-probado]:after{content:'✦';position:absolute;right:10px;top:8px;color:#e4c588}.elPie{display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:11px;color:#8796a6}.elSalir{appearance:none;min-height:44px;padding:9px 18px;border:1px solid #776b55;border-radius:5px;background:#111b29;color:#e0d0b2;font:600 12px system-ui;cursor:pointer}.elSalir:focus-visible{outline:2px solid #dcc693}.elAcciones{display:flex;gap:8px}.elBatalla{background:#29222e;border-color:#ab8c62;color:#f2d0a1}.elPie>span{min-width:0}@media(max-width:640px){.elPie>span{display:none}.elAcciones{width:100%}.elAcciones .elSalir{flex:1;padding:8px;font-size:11px}}
  @media(max-width:640px){.editorLaboratorio[open]{gap:12px}.elMundos{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:10px}.elTexto{padding:16px 9px 9px}.elTexto span{display:none}.elTexto small{font-size:7px;letter-spacing:.7px}.elTexto strong{font-size:18px}.elCab h1{margin:6px 0}.elCab small{letter-spacing:1.7px}.elPie{font-size:9px}}
  @media(max-height:480px){.editorLaboratorio[open]{gap:8px;padding:12px!important}.elCab p{display:none}.elCab h1{font-size:25px;margin:3px 0}.elMundos{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px}.elTexto{padding:8px}.elTexto span{display:none}.elTexto strong{font-size:16px;margin:3px 0}.elPie{font-size:9px}.elSalir{min-height:44px}}
  @media(prefers-reduced-motion:reduce){.elMundo{transition:none}}
  `;document.head.appendChild(css);
  addEventListener('load',()=>{const modo=new URLSearchParams(location.search).get('editor');if(modo==='1')abrirLaboratorioEditor();else if(modo==='batalla')window.campanaEnsayarPitagoras?.();},{once:true});
})();

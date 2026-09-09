/* Dirección del duelo del Editor. La supervivencia vive en su propio lienzo;
   el motor conserva las cartas y aplica el resultado al regresar. */
'use strict';
(function(){
  const tipos=['isometrico','laseres','fps','carrera','orbital','duelo'];
  let activa=null;
  function vigente(e){return activa===e&&!e.cancelada&&G===e.g&&!e.g.over;}
  window.campanaCancelarInterferencia=function(){
    const e=activa;if(!e)return;
    e.cancelada=true;e.g.over=true;
    e.cancelarEspera?.();window.PITAGORAS_PRUEBAS?.cancelar();
    e.mirada?.remove();document.body.classList.remove('editorInterfiere');
  };
  window.campanaInterferenciaPitagoras=async function(side,id,g){
    if(G!==g||!g||g.over||!g.campana?.jefeSecreto||side!==FOE||NET.on||g.online||g.guest||g.fast||g.silent||g.auto||!window.PITAGORAS_PRUEBAS)return {cancelado:true};
    // Una segunda llamada no inicia dos juegos encima ni cobra dos resultados.
    if(activa)return {cancelado:true};
    const numero=Number.isInteger(g.editorPruebas)?g.editorPruebas:0;
    const e={g,cancelada:false,resolviendo:g.resolving,mirada:null,cancelarEspera:null};activa=e;
    g.editorPruebas=numero+1;g.editorEnPrueba=true;g.resolving=true;render();
    try{
      const lider=document.getElementById('leaderFoe');
      if(lider){
        const ojos=document.createElement('span');ojos.className='editorMirada';ojos.setAttribute('aria-hidden','true');ojos.innerHTML='<i></i><i></i>';lider.appendChild(ojos);e.mirada=ojos;
        const imagen=lider.querySelector('.retratoPitagoras'),marco=lider.getBoundingClientRect(),r=imagen?.getBoundingClientRect();
        if(r&&marco.width&&marco.height){
          const ancho=imagen.naturalWidth||1122,alto=imagen.naturalHeight||1402,escala=Math.max(r.width/ancho,r.height/alto);
          [...ojos.children].forEach((ojo,i)=>{
            ojo.style.left=((r.left+(r.width-ancho*escala)/2+ancho*escala*(i ? .514 : .486)-marco.left)/marco.width*100)+'%';
            ojo.style.top=((r.top+(r.height-alto*escala)/2+alto*escala*.076-marco.top)/marco.height*100)+'%';
          });
        }
      }
      document.body.classList.add('editorInterfiere');window.CAOZ_AUDIO?.play('spell_shadow');
      await new Promise(r=>{const t=setTimeout(r,matchMedia('(prefers-reduced-motion:reduce)').matches?120:750);e.cancelarEspera=()=>{clearTimeout(t);r();};});
      if(!vigente(e))return {cancelado:true};
      const personaje=g.campana.personaje||campanaNormalizarPersonaje({nombre:P(ME).L.n});
      const resultado=await PITAGORAS_PRUEBAS.iniciar({tipo:CARDS[id]?.editorJuego||tipos[numero%tipos.length],personaje,nombre:campanaNormalizarPersonaje(personaje).nombre,duracion:20,cinematica:true});
      if(resultado?.abandonado&&vigente(e)){campanaCancelarInterferencia();campanaVolverAlMenu();return {cancelado:true};}
      if(!vigente(e))return {cancelado:true};
      return resultado;
    }finally{
      e.cancelarEspera?.();e.mirada?.remove();document.body.classList.remove('editorInterfiere');
      delete g.editorEnPrueba;g.resolving=e.resolviendo;
      if(activa===e)activa=null;
      if(G===g)render();
    }
  };
  const css=document.createElement('style');css.textContent=`
  .editorMirada{position:absolute;inset:0;z-index:30;pointer-events:none;box-sizing:border-box;animation:editorAmenaza .75s ease-out both}
  .editorMirada i{position:absolute;left:49%;top:8%;width:2px;height:2px;translate:-50% -50%;border-radius:50%;background:#fff2e9;box-shadow:0 0 4px 2px #f33,0 0 14px 5px #e00000}
  @keyframes editorAmenaza{from{opacity:0}to{opacity:1}}
  @media(prefers-reduced-motion:reduce){.editorMirada{animation:none}}
  `;document.head.appendChild(css);
})();

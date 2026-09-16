/* ==========================================================================
   MULLIGAN INICIAL — selector de pantalla

   No aplica la regla ni toca P(), deck o hand. Recibe una COPIA de la mano y
   devuelve índices de esa copia. Así el motor conserva la autoridad sobre
   robo, barajado, IA y online; esta capa sólo deja escoger hasta dos cartas.

   API del juego:
     elegirMulliganInicial(side,{cartas:P(side).hand.slice(),limite:2})
       -> Promise<number[]>; [] significa conservar / cerrar.

   API de la revisión aislada:
     CAOZ_MULLIGAN_UI.mostrar({cartas,limite,renderCarta,overlay,panel,abrir,cerrar})
   `renderCarta(id,indice,side)` puede devolver una carta real del adaptador.
   Siempre se clona antes de montarla para eliminar hover, inspector y pulsación
   larga que pertenezcan al sitio donde nació esa carta.
   ========================================================================== */
'use strict';

(function(){
  const LIMITE_MAXIMO=2;

  function limiteSeguro(valor){
    const n=Number.isFinite(Number(valor))?Math.floor(Number(valor)):LIMITE_MAXIMO;
    return Math.max(0,Math.min(LIMITE_MAXIMO,n));
  }

  function cartaInerte(id,indice,side,renderCarta){
    let origen=null;
    if(typeof renderCarta==='function') origen=renderCarta(id,indice,side);
    else if(typeof cardEl==='function') origen=cardEl(id,{side});
    if(origen&&typeof origen.cloneNode==='function'){
      const copia=origen.cloneNode(true);
      copia.onmouseenter=null;copia.onmouseleave=null;copia.onclick=null;
      copia.setAttribute('aria-hidden','true');copia.tabIndex=-1;
      return copia;
    }
    const datos=typeof CARDS!=='undefined'&&CARDS?CARDS:{};
    const carta=datos[id]||{};
    const respaldo=document.createElement('div');
    respaldo.className='card';respaldo.setAttribute('aria-hidden','true');
    respaldo.textContent=carta.n||String(id||'Carta');
    return respaldo;
  }

  function mostrarMulligan(opciones={}){
    const cartas=Array.isArray(opciones.cartas)?opciones.cartas.slice():[];
    const limite=limiteSeguro(opciones.limite);
    const side=opciones.side??opciones.s??0;
    const ov=opciones.overlay||document.getElementById('ov');
    const panel=opciones.panel||document.getElementById('ovPanel');
    if(!cartas.length||!limite||!ov||!panel)return Promise.resolve([]);
    const viva=typeof opciones.viva==='function' ? opciones.viva : ()=>true;
    try{if(!viva())return Promise.resolve([]);}catch(e){return Promise.resolve([]);}

    const abrir=typeof opciones.abrir==='function' ? opciones.abrir
      : (typeof openOv==='function' ? openOv : ()=>ov.classList.add('on'));
    const cerrar=typeof opciones.cerrar==='function' ? opciones.cerrar
      : (typeof cerrarOv==='function' ? cerrarOv : ()=>ov.classList.remove('on'));
    const clasePanel=panel.className;
    const clickAnterior=ov.onclick;
    const focoAnterior=document.activeElement;

    return new Promise(resolve=>{
      const seleccion=new Set();
      let terminado=false;
      let vigilia=0;
      panel.className=(clasePanel+' mulliganPanel').trim();
      panel.innerHTML=`<section class="mulliganContenido" role="dialog" aria-modal="true" aria-labelledby="mulliganTitulo" aria-describedby="mulliganDescripcion">
        <header class="mulliganCabecera">
          <div class="mulliganAntetitulo">MANO INICIAL</div>
          <h3 id="mulliganTitulo">Ajusta tu mano inicial</h3>
          <p id="mulliganDescripcion">Elige hasta ${limite} cartas para cambiarlas. Robarás exactamente la misma cantidad.</p>
        </header>
        <div class="mulliganContador" id="mulliganContador" aria-live="polite"><b>0</b> de ${limite} cartas para cambiar</div>
        <div class="mulliganCartas" id="mulliganCartas" role="group" aria-label="Cartas de tu mano inicial"></div>
        <div class="mulliganAcciones">
          <button type="button" class="btn" data-mulligan="conservar">Conservar mano</button>
          <button type="button" class="btn gold" data-mulligan="confirmar" disabled>Elige cartas para cambiar</button>
        </div>
        <p class="mulliganAyuda">Las cartas elegidas vuelven al mazo después de robar, así no puedes recuperar la misma copia.</p>
      </section>`;
      const lista=panel.querySelector('#mulliganCartas');
      const contador=panel.querySelector('#mulliganContador');
      const conservar=panel.querySelector('[data-mulligan="conservar"]');
      const confirmar=panel.querySelector('[data-mulligan="confirmar"]');

      const indices=()=>[...seleccion].sort((a,b)=>a-b);
      const terminar=respuesta=>{
        if(terminado)return;
        terminado=true;
        if(vigilia)clearInterval(vigilia);
        document.removeEventListener('keydown',tecla,true);
        if(ov.onclick===velo)ov.onclick=clickAnterior;
        ov.classList.remove('mulliganOverlay');
        panel.className=clasePanel;
        cerrar();
        if(focoAnterior&&focoAnterior.isConnected&&typeof focoAnterior.focus==='function'){
          focoAnterior.focus({preventScroll:true});
        }
        resolve(respuesta);
      };
      const tecla=e=>{
        if(e.key==='Escape'){
          e.preventDefault();e.stopImmediatePropagation();terminar([]);return;
        }
        /* En escritorio la barra espaciadora termina el turno desde un
           listener global. Dentro de este diálogo aún debe activar el botón
           enfocado, pero no filtrarse hasta el atajo de la mesa. */
        if(e.key===' '||e.key==='Spacebar')e.stopImmediatePropagation();
      };
      const velo=e=>{
        if(e.target!==ov)return;
        e.preventDefault();e.stopImmediatePropagation();terminar([]);
      };
      const actualizar=()=>{
        const n=seleccion.size;
        contador.innerHTML=`<b>${n}</b> de ${limite} carta${limite===1?'':'s'} para cambiar`;
        confirmar.disabled=n===0;
        confirmar.textContent=n===0?'Elige cartas para cambiar':`Cambiar ${n} carta${n===1?'':'s'}`;
        lista.querySelectorAll('.mulliganCarta').forEach(b=>{
          const activa=seleccion.has(Number(b.dataset.indice));
          b.classList.toggle('seleccionada',activa);b.setAttribute('aria-pressed',String(activa));
        });
      };

      cartas.forEach((id,indice)=>{
        const boton=document.createElement('button');
        const datos=typeof CARDS!=='undefined'&&CARDS?CARDS:{};
        const nombre=datos[id]?.n||`carta ${indice+1}`;
        boton.type='button';boton.className='mulliganCarta';boton.dataset.indice=String(indice);
        boton.setAttribute('aria-pressed','false');
        boton.setAttribute('aria-label',`Cambiar ${nombre}, carta ${indice+1} de la mano`);
        boton.appendChild(cartaInerte(id,indice,side,opciones.renderCarta));
        boton.onclick=()=>{
          if(seleccion.has(indice))seleccion.delete(indice);
          else if(seleccion.size<limite)seleccion.add(indice);
          actualizar();
        };
        lista.appendChild(boton);
      });
      conservar.onclick=()=>terminar([]);
      confirmar.onclick=()=>{if(seleccion.size)terminar(indices());};
      document.addEventListener('keydown',tecla,true);
      ov.onclick=velo;
      ov.classList.add('mulliganOverlay');
      abrir();
      actualizar();
      requestAnimationFrame(()=>conservar.focus({preventScroll:true}));
      /* Una partida puede sustituirse desde el menú mientras este await sigue
         vivo. En vez de dejar su promesa colgada sobre la siguiente mesa, se
         cancela con la mano conservada y libera sus listeners. */
      vigilia=setInterval(()=>{
        try{if(!viva())terminar([]);}catch(e){terminar([]);}
      },120);
    });
  }

  function elegirMulliganInicial(side,opciones={}){
    /* El motor gestiona al rival online y la IA. La pantalla sólo pregunta al
       jugador local; devolver [] aquí evita dejar un diálogo invisible. */
    if(typeof ME!=='undefined'&&side!==ME)return Promise.resolve([]);
    if(typeof G!=='undefined'&&G&&(G.auto||G.silent))return Promise.resolve([]);
    /* El arnés abre muchas partidas humanas para probar menús y tutoriales.
       No debe detenerlas con un diálogo visual; las suites de mulligan
       sustituyen explícitamente esta función y siguen cubriendo el motor. */
    if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('test')&&!opciones.probarUI)return Promise.resolve([]);
    const partida=typeof G!=='undefined'?G:null;
    const numeroPartida=typeof PARTIDA_N!=='undefined'?PARTIDA_N:null;
    const viva=()=>{
      if(partida&&((typeof G!=='undefined'&&G!==partida)||partida.over))return false;
      if(numeroPartida!=null&&typeof PARTIDA_N!=='undefined'&&PARTIDA_N!==numeroPartida)return false;
      return true;
    };
    return mostrarMulligan({...opciones,side,viva});
  }

  window.elegirMulliganInicial=elegirMulliganInicial;
  window.CAOZ_MULLIGAN_UI={mostrar:mostrarMulligan,limiteSeguro,cartaInerte};
})();

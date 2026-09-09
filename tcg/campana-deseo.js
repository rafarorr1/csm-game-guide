/* Final de campaña. En esta beta el envío del deseo es una simulación local. */
'use strict';
(function(){
  let escena=null;
  function limpiar(){if(!escena)return;escena.cancelado=true;cancelAnimationFrame(escena.raf);escena.timers.forEach(clearTimeout);escena.d.close();escena.d.remove();escena=null;}
  window.campanaCerrarDeseo=limpiar;
  function esperar(e,ms,fn){const id=setTimeout(()=>{if(!e.cancelado)fn();},ms);e.timers.push(id);}
  let ascenso=null;
  window.campanaCancelarAscenso=function(){
    if(!ascenso)return;const e=ascenso;ascenso=null;e.cancelado=true;cancelAnimationFrame(e.raf);e.timers.forEach(clearTimeout);
    if(e.mesa?.activa)e.mesa.elevar(0);if(e.animacion)e.animacion.cancel();e.d.close();e.d.remove();
  };
  window.campanaAscenderAlDeseo=function(){
    const p=campanaLeer(),panel=document.getElementById('campanaPanel');
    if(ascenso||!panel?.open||!p||p.etapa!==6||p.mesaPendiente!==5)return;
    const d=document.createElement('dialog');d.id='campanaAscenso';d.dataset.fase='rayo';d.setAttribute('aria-label','La luz del Domo eleva a tu Protagonista');
    d.innerHTML='<div class="ascensoRayo"><div class="ascensoCono"></div><div class="ascensoNucleo"></div><div class="ascensoHalo"></div></div><div class="ascensoResplandor"></div>';
    const e={d,mesa:campanaMesaEscena,timers:[],raf:0,cancelado:false},rayo=d.firstElementChild;ascenso=e;
    const reducido=matchMedia('(prefers-reduced-motion:reduce)').matches,peon=panel.querySelector('.campanaPeon');
    const inicio=performance.now();let anterior=-Infinity;
    function cuadro(t){
      if(e.cancelado)return;
      if(!panel.open){campanaCancelarAscenso();return;}
      if(t-anterior>30){
        anterior=t;const transcurrido=Math.max(0,t-inicio),avance=Math.min(1,Math.max(0,(transcurrido-650)/4350));
        if(e.mesa)e.mesa.elevar(reducido?0:avance*avance);
        const limite=d.getBoundingClientRect();let x,y;
        if(e.mesa){const c=panel.querySelector('.campanaCamara').getBoundingClientRect(),f=e.mesa.focoJugador;x=c.left+c.width*f[0]/100;y=c.top+c.height*f[1]/100;}
        else{const r=peon.getBoundingClientRect();x=r.left+r.width/2;y=r.bottom;}
        x-=limite.left;y-=limite.top;
        rayo.style.left=x+'px';rayo.style.height=Math.max(0,y*(reducido?1:Math.min(1,transcurrido/650)))+'px';
        // El resplandor nace junto a la ficha y crece hasta cubrir incluso
        // la esquina más lejana con el centro blanco de su degradado.
        d.style.setProperty('--luz-x',x+'px');d.style.setProperty('--luz-y',y+'px');
        d.style.setProperty('--luz-diametro',4*Math.hypot(Math.max(x,limite.width-x),Math.max(y,limite.height-y))+'px');
      }
      e.raf=requestAnimationFrame(cuadro);
    }
    d.addEventListener('cancel',ev=>ev.preventDefault());document.body.appendChild(d);d.showModal();
    if(!e.mesa&&!reducido)e.animacion=peon.animate([{translate:'0 0'},{translate:'0 -55px'}],{delay:650,duration:4350,easing:'ease-in',fill:'forwards'});
    window.CAOZ_AUDIO?.play('ascension');cuadro(inicio);
    if(p.secreto==='ascenso'&&typeof campanaAbrirSecreto==='function'){
      // El sexto sello corta el ascenso cuando ya se ve elevarse la ficha,
      // antes de que el resplandor blanco revele el deseo habitual.
      esperar(e,2400,()=>{
        if(campanaLeer()!==p){campanaCancelarAscenso();return;}
        cancelAnimationFrame(e.raf);e.animacion?.pause();d.dataset.fase='detenido';
        const marco=d.getBoundingClientRect();
        const origen={x:Math.max(0,Math.min(1,parseFloat(rayo.style.left)/marco.width)),y:Math.max(0,Math.min(1,parseFloat(rayo.style.height)/marco.height))};
        window.CAOZ_AUDIO?.detener();
        // La ficha queda inmóvil antes del corte a oscuridad. El nuevo plano
        // conserva su posición y después la lleva al borde inferior.
        esperar(e,450,()=>{
          if(campanaLeer()!==p){campanaCancelarAscenso();return;}
          p.secreto='revelacion';delete p.mesaPendiente;campanaGuardar(p);campanaAbrirSecreto({origen});
        });
      });
      return;
    }
    esperar(e,5000,()=>{cancelAnimationFrame(e.raf);d.dataset.fase='blanco';
      esperar(e,1000,()=>{
        const actual=campanaLeer();if(actual!==p){campanaCancelarAscenso();return;}
        delete p.mesaPendiente;p.enEncuentro=false;campanaGuardar(p);
        // El nuevo diálogo se monta antes de quitar la cobertura blanca.
        ascenso=null;e.cancelado=true;campanaAbrirDeseo();d.close();d.remove();
      });
    });
  };
  function fuego(e){
    const d=e.d,c=document.createElement('canvas');c.className='deseoFuego';c.setAttribute('aria-hidden','true');d.appendChild(c);
    const ctx=c.getContext('2d'),reducido=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const inicio=performance.now();d.dataset.fase='fuego';window.CAOZ_AUDIO?.play('wish_fire');
    const duracion=reducido?500:3000;
    function dibujar(t){
      if(e.cancelado)return;const p=Math.min(1,(t-inicio)/duracion),w=d.clientWidth,h=d.clientHeight;
      c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));
      if(ctx){ctx.clearRect(0,0,w,h);const entrada=Math.min(1,p/.33),salida=p>.65?(1-p)/.35:1;
        ctx.globalAlpha=salida;const techo=h-(h+160)*entrada;
        const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#c32900');g.addColorStop(.5,'#ff8500');g.addColorStop(1,'#fff1a0');ctx.fillStyle=g;
        ctx.fillRect(0,techo+75,w,h+160);
        for(let i=0;i<30;i++){const x=i*w/28,y=techo+Math.sin(t*.004+i*2.4)*45,ancho=w/16+10;
          ctx.beginPath();ctx.moveTo(x-ancho,h);ctx.quadraticCurveTo(x-ancho*1.5,y+100,x+Math.sin(t*.006+i)*20,y-70);ctx.quadraticCurveTo(x+ancho,y+80,x+ancho,h);ctx.fill();}
        // Lenguas interiores y brasas: el fuego conserva movimiento incluso
        // cuando ya ha cubierto por completo la pantalla.
        ctx.save();ctx.beginPath();ctx.rect(0,Math.max(0,techo+75),w,h);ctx.clip();
        ctx.globalCompositeOperation='screen';
        for(let i=0;i<24;i++){
          const x=(i*137.5)%w+Math.sin(t*.003+i)*24,y=h+140-((t*.19+i*79)%(h+300)),a=22+(i%5)*13;
          const luz=ctx.createRadialGradient(x,y,2,x,y,a*2);luz.addColorStop(0,'#fff5b080');luz.addColorStop(.4,'#ffc02b40');luz.addColorStop(1,'#ff4a0000');ctx.fillStyle=luz;
          ctx.beginPath();ctx.moveTo(x-a,y+a);ctx.bezierCurveTo(x-a*1.4,y-25,x+30,y-65,x+Math.sin(t*.005+i)*20,y-a*2.8);ctx.bezierCurveTo(x+a*.2,y-a,x+a*1.2,y,x+a,y+a);ctx.fill();
        }
        ctx.fillStyle='#fff6c5';for(let i=0;i<48;i++){const x=(i*97+t*.013)%w,y=h-((t*.25+i*53)%(h+30));ctx.globalAlpha=salida*.65;ctx.fillRect(x,y,2,5);}
        ctx.restore();
      }
      if(p<1)e.raf=requestAnimationFrame(dibujar);
    }
    if(!reducido&&ctx)e.raf=requestAnimationFrame(dibujar);else c.style.background='#ff9a22';
    esperar(e,reducido?250:1000,()=>{e.form.remove();e.mensaje=document.createElement('h1');e.mensaje.className='deseoConcedido';e.mensaje.textContent='Deseo concedido';d.appendChild(e.mensaje);});
    esperar(e,duracion,()=>{
      cancelAnimationFrame(e.raf);c.remove();d.dataset.fase='concedido';window.CAOZ_AUDIO?.play('wish_granted');
      // El menú se prepara bajo el negro; esos tres segundos se aprovechan
      // para revelarlo sin un corte al retirar el diálogo.
      esperar(e,3000,()=>{d.dataset.fase='fundido';esperar(e,1000,()=>{
        showScreen('menu');limpiarTransicionMenu();e.mensaje.remove();
        d.dataset.fase='menu';esperar(e,3000,limpiar);
      });});
    });
  }
  window.campanaAbrirDeseo=function(){
    const p=campanaLeer();if(!p||p.etapa!==6||p.mesaPendiente!=null)return;
    if(escena)return;
    const d=document.createElement('dialog');d.id='campanaDeseo';d.setAttribute('aria-labelledby','deseoTitulo');d.dataset.fase='formulario';
    d.innerHTML='<form class="deseoFormulario"><div class="deseoSello">EL DOMO TE ESCUCHA</div><h1 id="deseoTitulo">Venciste a todos los héroes.<br>Pide un deseo</h1><label for="deseoTexto">Tu deseo</label><textarea id="deseoTexto" maxlength="500" required placeholder="Escribe lo que deseas…"></textarea><p class="deseoPrivacidad">Prueba beta · envío simulado</p><p class="deseoEstado" role="status"></p><button class="btn gold" type="submit">Pedir deseo</button></form>';
    const e={d,form:d.querySelector('form'),timers:[],raf:0,cancelado:false};escena=e;
    const texto=d.querySelector('textarea'),boton=d.querySelector('button'),estado=d.querySelector('.deseoEstado');
    texto.value=p.deseo?.deseo||p.borradorDeseo||'';texto.readOnly=!!p.deseo;
    texto.addEventListener('input',()=>{p.borradorDeseo=texto.value;campanaGuardar(p);});
    e.form.addEventListener('submit',ev=>{
      ev.preventDefault();if(boton.disabled)return;const deseo=texto.value.trim();if(!deseo){texto.setCustomValidity('Escribe tu deseo.');texto.reportValidity();texto.setCustomValidity('');return;}
      boton.disabled=true;boton.textContent='Enviando…';texto.disabled=true;texto.blur();d.dataset.fase='envio';
      p.deseo={deseo,simulado:true};delete p.borradorDeseo;campanaGuardar(p);
      esperar(e,900,()=>fuego(e));
    });
    d.addEventListener('cancel',ev=>ev.preventDefault());document.body.appendChild(d);d.showModal();campanaCerrar();cerrarCinematica();
  };
  const css=document.createElement('style');css.textContent=`
  #campanaAscenso{position:fixed;inset:0;margin:0;padding:0;border:0;width:100vw;height:100dvh;max-width:none;max-height:none;background:transparent;overflow:hidden;pointer-events:auto}
  #campanaAscenso::backdrop{background:#08050b22}
  #campanaAscenso[data-fase="detenido"] *{animation-play-state:paused!important}
  .ascensoRayo{position:absolute;top:0;width:clamp(210px,28vw,360px);transform:translateX(-50%);filter:drop-shadow(0 0 18px #ffe9b480);pointer-events:none}
  .ascensoCono{position:absolute;inset:0;clip-path:polygon(43% 0,57% 0,100% 100%,0 100%);background:linear-gradient(180deg,#fffdeccc,#fff9d54a 32%,#fff4bb12),linear-gradient(90deg,#ffe6a80a,#fff9d943 36%,#ffffee66 50%,#fff9d943 64%,#ffe6a80a);animation:abrirHazAscenso .85s ease-in-out .65s both}
  .ascensoNucleo{position:absolute;inset:0;clip-path:polygon(48% 0,52% 0,67% 100%,33% 100%);background:linear-gradient(#fffef4a0,#fff9cb18);animation:abrirNucleoAscenso .85s ease-in-out .65s both}
  .ascensoHalo{position:absolute;bottom:-14px;left:0;width:100%;height:28px;border-radius:50%;background:radial-gradient(ellipse,#fffce855,#fff4bd22 50%,#fff4bd00 72%);box-shadow:0 0 24px 3px #fff7bd30;animation:abrirHaloAscenso .85s ease-in-out .65s both}
  /* Primero llega el haz recto (650 ms); sólo al tocar la ficha abre el cono. */
  @keyframes abrirHazAscenso{from{clip-path:polygon(46% 0,54% 0,54% 100%,46% 100%)}to{clip-path:polygon(43% 0,57% 0,100% 100%,0 100%)}}
  @keyframes abrirNucleoAscenso{from{clip-path:polygon(49.3% 0,50.7% 0,50.7% 100%,49.3% 100%)}to{clip-path:polygon(48% 0,52% 0,67% 100%,33% 100%)}}
  @keyframes abrirHaloAscenso{from{scale:.08 1;opacity:0}to{scale:1 1;opacity:1}}
  .ascensoResplandor{position:absolute;left:var(--luz-x,50%);top:var(--luz-y,60%);width:var(--luz-diametro,400vmax);height:var(--luz-diametro,400vmax);translate:-50% -50%;border-radius:50%;background:radial-gradient(circle,#fff 0 52%,#fffcedb3 66%,#ffe8a14d 80%,#ffe8a100 100%);animation:resplandorAscenso 1.2s cubic-bezier(.4,0,.6,1) 3.8s both;pointer-events:none}
  @keyframes resplandorAscenso{0%{scale:.015;opacity:0}25%{opacity:.65}100%{scale:1;opacity:1}}
  #campanaAscenso[data-fase="blanco"]{background:#fff}#campanaAscenso[data-fase="blanco"]>div{display:none}#campanaAscenso[data-fase="blanco"]::backdrop{background:#fff}
  #campanaDeseo{position:fixed;inset:0;top:var(--campana-desfase,0px);margin:0;border:0;padding:24px;width:100vw;max-width:none;height:var(--campana-alto,100dvh);max-height:none;box-sizing:border-box;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#402213,#120a0a 60%,#050304);color:#ffedbc;z-index:500;}
  #campanaDeseo[open]{display:grid;place-items:center}#campanaDeseo::backdrop{background:#050304}
  .deseoFormulario{width:min(540px,100%);max-height:100%;display:flex;flex-direction:column;gap:14px;text-align:center;min-height:0}
  .deseoSello{font:700 10px/1.2 var(--sans,sans-serif);letter-spacing:4px;color:#d2ab62}
  #campanaDeseo h1{margin:0;font:700 clamp(24px,5vw,42px)/1.2 var(--serif,serif);text-align:center;text-wrap:balance}
  .deseoFormulario label{text-align:left;font:600 14px var(--sans,sans-serif)}
  #deseoTexto{box-sizing:border-box;width:100%;height:140px;min-height:48px;resize:none;flex:1 1 140px;background:#160e0b;border:1px solid #ae8748;border-radius:12px;padding:14px;color:#fff3da;font:16px/1.5 var(--sans,sans-serif)}
  #deseoTexto:focus{outline:2px solid #efca76;outline-offset:3px}
  .deseoPrivacidad,.deseoEstado{margin:0;font:12px/1.4 var(--sans,sans-serif);color:#cdbba1}.deseoEstado:empty{display:none}
  .deseoFormulario .btn{min-height:48px;padding:12px;font-size:18px;flex:none}
  .deseoFuego{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}
  .deseoConcedido{position:relative;z-index:1;text-shadow:0 0 30px #d17b27;transition:opacity 1s}
  #campanaDeseo[data-fase="concedido"]{background:#0b0503}
  #campanaDeseo[data-fase="fundido"]{background:#000;transition:background 1s}#campanaDeseo[data-fase="fundido"] .deseoConcedido{opacity:0}
  #campanaDeseo[data-fase="menu"]{background:#000;transition:none;animation:deseoRevelarMenu 3s cubic-bezier(.4,0,.2,1) both}#campanaDeseo[data-fase="menu"]::backdrop{background:transparent}
  @keyframes deseoRevelarMenu{from{opacity:1}to{opacity:0}}
  @media(prefers-reduced-motion:reduce){.ascensoCono,.ascensoNucleo,.ascensoHalo{animation:none}.ascensoResplandor{animation-name:resplandorAscensoSuave}@keyframes resplandorAscensoSuave{from{scale:1;opacity:0}to{scale:1;opacity:1}}}
  @media(max-height:480px){#campanaDeseo{padding:12px 24px}.deseoFormulario{gap:7px}#campanaDeseo h1{font-size:23px}.deseoSello{display:none}.deseoPrivacidad,.deseoEstado{font-size:10px}.deseoFormulario label{font-size:12px}#deseoTexto{padding:8px}.deseoFormulario .btn{min-height:40px;padding:8px;font-size:16px}}
  `;document.head.appendChild(css);
})();

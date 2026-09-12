'use strict';
(function(){
  const $=id=>document.getElementById(id),escenarios={goblins:['rey','can','tok_goblincamino','tok_goblincamino'],aliados:['rey','can','eric','matildus']};
  let campo=[],composicion='goblins',progreso=null,turno=0,serie=0,resize,frame=0;
  function unidad(id){return {uid:'prueba_rey_'+(++serie),alive:true,card:CARDS[id]};}
  function medir(){
    document.documentElement.style.setProperty('--rey-alto',(visualViewport?.height||innerHeight)+'px');
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      document.querySelectorAll('.reyPuesto').forEach(p=>{const carta=p.querySelector('.reyCarta,.reyVacio'),marco=p.querySelector('.reyCartaMarco'),boton=p.querySelector('button');if(!carta)return;const disponible=p.clientHeight-boton.getBoundingClientRect().height-parseFloat(getComputedStyle(p).gap);const ancho=p.clientWidth-10;const escala=Math.max(.2,Math.min(1.18,ancho/200,disponible/280));carta.style.zoom=escala;marco.style.height=(280*escala)+'px';});
    });
  }
  function evaluar(inicio=null){progreso=avanceCorte(campo,progreso,inicio);dibujar();}
  function restaurar(indice){campo[indice]=unidad(escenarios[composicion][indice]);evaluar();}
  function retirar(indice){campo[indice].alive=false;evaluar();}
  function dibujar(){
    const mesa=$('reyMesa');mesa.replaceChildren();
    campo.forEach((u,i)=>{
      const puesto=document.createElement('div');puesto.className='reyPuesto';puesto.dataset.uid=u.uid;puesto.dataset.carta=u.card.id;
      const marco=document.createElement('div');marco.className='reyCartaMarco';
      if(u.alive){const c=cardEl(u.card.id,{}).cloneNode(true);c.classList.add('reyCarta');c.dataset.vistaArte='movil_coleccion';c.setAttribute('aria-label',u.card.n+(u.card.token?', ficha':''));marco.append(c);}
      else{const vacio=document.createElement('div');vacio.className='reyVacio';const mas=document.createElement('b');mas.textContent='+';const nombre=document.createElement('span');nombre.textContent=u.card.n;vacio.append(mas,nombre);marco.append(vacio);}
      const b=document.createElement('button');b.type='button';b.className='reyRetirar';b.textContent=u.alive?'Retirar':'Reponer';b.setAttribute('aria-label',(u.alive?'Retirar ':'Reponer ')+u.card.n);b.onclick=()=>u.alive?retirar(i):restaurar(i);puesto.append(marco,b);mesa.append(puesto);
    });
    const gano=progreso.turnos===2,primero=progreso.turnos===1,vivos=campo.filter(u=>u.alive).length;
    $('reyResultado').textContent=gano?'Victoria de El Rey':primero?'La corte está en pie':'Prepara tu corte';
    $('reyTurno').textContent=turno?'Inicio propio '+(turno/2):'Sin iniciar turno';
    document.querySelector('.reyEstado').classList.toggle('victoria',gano);
    document.querySelectorAll('[data-paso]').forEach(n=>n.classList.toggle('completo',Number(n.dataset.paso)<=progreso.turnos));
    $('reyExplicacion').textContent=gano?'La corte sobrevivió a dos inicios de turno propios consecutivos.':primero?'1 de 2. El rival todavía puede retirar a El Rey o romper su corte.':!campo[0].alive?'Sin El Rey, el avance se pierde. Repónlo para empezar otra vez.':vivos<4?'La corte se rompió: el avance vuelve a cero. Repón al aliado.':composicion==='goblins'?'Los Goblins sí cuentan. Esta corte ya no gana al primer inicio.':'La corte está completa. Necesita sostenerse durante dos inicios propios.';
    $('reyIniciar').disabled=gano;document.querySelectorAll('[data-escenario]').forEach(n=>n.setAttribute('aria-pressed',n.dataset.escenario===composicion?'true':'false'));
    medir();
  }
  function reiniciar(modo=composicion){composicion=modo;campo=escenarios[modo].map(unidad);turno=0;progreso=null;evaluar();}
  function iniciar(){if(progreso?.turnos===2)return;turno+=2;evaluar(turno);const estado=document.querySelector('.reyEstado');estado.classList.remove('reyPulso');void estado.offsetWidth;estado.classList.add('reyPulso');}
  async function preparar(){
    if(!window.CAOZ_DEV?.aislado||typeof avanceCorte!=='function')throw Error('La prueba aislada no encontró la regla real de El Rey.');
    const marca=document.createElement('span');marca.id='panelCerrar';marca.hidden=true;document.body.append(marca);
    $('reyIniciar').onclick=iniciar;$('reyReiniciar').onclick=()=>reiniciar();document.querySelectorAll('[data-escenario]').forEach(n=>n.onclick=()=>reiniciar(n.dataset.escenario));
    $('reyReglaTexto').innerHTML=CARDS.rey.x;$('reyVerRegla').onclick=()=>$('reyDetalle').showModal();$('reyCerrarDetalle').onclick=()=>$('reyDetalle').close();
    await cargarArte();reiniciar();resize=new ResizeObserver(medir);resize.observe($('reyMesa'));addEventListener('resize',medir);visualViewport?.addEventListener('resize',medir);
    window.CAOZ_REY_VISTA=Object.freeze({estado:()=>({campo:campo.map(u=>({uid:u.uid,alive:u.alive,id:u.card.id})),progreso:{...progreso},turno}),reiniciar,iniciar});
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',preparar,{once:true});else preparar();
})();

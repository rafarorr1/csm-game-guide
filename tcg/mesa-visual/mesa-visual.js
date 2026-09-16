/* Prototipo visual aislado: no usa motor, IA, red ni almacenamiento. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const accionNombres={ataque:'Ataque',defensa:'Defensa',habilidad:'Habilidad'};
  const estadoInicial=Object.freeze({heroe:18,rival:26,pd:3,segundos:48});
  let estado={...estadoInicial};
  let pausado=false;
  let temporizador=0;
  let ultimoMensaje=0;

  function pintarReloj(){
    const minutos=Math.floor(estado.segundos/60);
    const segundos=String(estado.segundos%60).padStart(2,'0');
    $('relojTexto').textContent=String(minutos).padStart(2,'0')+':'+segundos;
  }

  function mensaje(texto){
    const salida=$('lecturaEstado');
    salida.textContent=texto;
    salida.classList.add('visible');
    clearTimeout(ultimoMensaje);
    ultimoMensaje=setTimeout(()=>salida.classList.remove('visible'),3600);
  }

  function marcarAccion(boton){
    const lado=boton.dataset.side;
    const accion=boton.dataset.action;
    document.querySelectorAll('.accion[data-side="'+lado+'"]').forEach(actual=>{
      actual.setAttribute('aria-pressed',String(actual===boton));
    });
    const actor=lado==='heroe'?'Rafaela':'Thal';
    mensaje(actor+' prepara '+accionNombres[accion].toLowerCase()+'. Esta respuesta sólo previsualiza la prioridad de la acción.');
  }

  function seleccionarCarta(boton){
    const nombre=boton.querySelector('strong')?.textContent||'la carta';
    document.querySelectorAll('.carta[aria-pressed="true"]').forEach(carta=>carta.setAttribute('aria-pressed','false'));
    boton.setAttribute('aria-pressed','true');
    mensaje(nombre.charAt(0)+nombre.slice(1).toLowerCase()+' queda enfocada en la mano.');
  }

  function alternarReloj(){
    pausado=!pausado;
    const boton=$('relojDemo');
    boton.setAttribute('aria-pressed',String(pausado));
    boton.setAttribute('aria-label',pausado?'Reanudar el temporizador de demostración':'Pausar el temporizador de demostración');
    mensaje(pausado?'Temporizador de demostración en pausa.':'Temporizador de demostración reanudado.');
  }

  function restaurar(){
    estado={...estadoInicial};
    pausado=false;
    pintarReloj();
    $('relojDemo').setAttribute('aria-pressed','false');
    $('relojDemo').setAttribute('aria-label','Pausar el temporizador de demostración');
    $('almaHeroe').textContent=estado.heroe;
    $('almaRival').textContent=estado.rival;
    $('pdTexto').textContent=estado.pd;
    document.querySelectorAll('.accion[aria-pressed="true"],.carta[aria-pressed="true"]').forEach(nodo=>nodo.setAttribute('aria-pressed','false'));
    mensaje('Muestra restaurada. Explora las acciones con clic, Tab o las teclas A, D y H.');
  }

  function usarAtajo(evento){
    if(evento.altKey||evento.ctrlKey||evento.metaKey)return;
    const accionPorTecla={a:'ataque',d:'defensa',h:'habilidad'};
    const accion=accionPorTecla[evento.key.toLowerCase()];
    if(!accion)return;
    evento.preventDefault();
    const boton=document.querySelector('.accion[data-side="heroe"][data-action="'+accion+'"]');
    if(!boton)return;
    marcarAccion(boton);
    boton.focus({preventScroll:true});
  }

  function preparar(){
    document.querySelectorAll('.accion').forEach(boton=>boton.addEventListener('click',()=>marcarAccion(boton)));
    document.querySelectorAll('.carta').forEach(boton=>boton.addEventListener('click',()=>seleccionarCarta(boton)));
    $('relojDemo').addEventListener('click',alternarReloj);
    $('restaurarDemo').addEventListener('click',restaurar);
    document.addEventListener('keydown',usarAtajo);
    temporizador=setInterval(()=>{
      if(!pausado&&estado.segundos<3599){
        estado.segundos+=1;
        pintarReloj();
      }
    },1000);
    window.CAOZ_MESA_VISUAL=Object.freeze({
      restaurar,
      pausar:alternarReloj,
      estado:()=>Object.freeze({...estado,pausado})
    });
  }

  if(document.readyState==='loading')addEventListener('DOMContentLoaded',preparar,{once:true});
  else preparar();
})();

/* Contratos mínimos para montar el creador real sin una campaña ni progreso. */
'use strict';
(function(){
  const host=document.getElementById('heroeHost'),estado=document.getElementById('heroeEstado');
  window.CAMPANA_CLAVE=window.CAOZ_HEROE_CLAVE||'caoz.seccion.heroe';
  window.LEADERS=Object.freeze(window.CAOZ_HEROE_LIDERES||{});
  window.campanaDialogo=()=>{
    let d=document.getElementById('campanaPanel');
    if(!d){d=document.createElement('section');d.id='campanaPanel';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');host.appendChild(d);}
    d.replaceChildren();d.open=true;return d;
  };
  window.campanaCabecera=(d,titulo,subtitulo)=>{
    const cabecera=document.createElement('header');cabecera.className='campanaCabecera';
    const sello=document.createElement('p');sello.className='campanaSello';
    const h=document.createElement('h2');h.textContent=titulo;
    const sub=document.createElement('p');sub.className='campanaSub';sub.textContent=subtitulo;
    cabecera.append(sello,h,sub);d.appendChild(cabecera);
  };
  window.campanaBoton=(texto,accion,principal=false)=>{const b=document.createElement('button');b.type='button';b.className='btn'+(principal?' principal':'');b.textContent=texto;b.addEventListener('click',accion);return b;};
  window.campanaAcciones=(...botones)=>{const acciones=document.createElement('footer');acciones.className='campanaAcciones';acciones.append(...botones);return acciones;};
  window.campanaElegir=()=>{if(estado)estado.textContent='Aspecto guardado en memoria temporal. En el juego, este paso abre la elección de mazo.';};
  window.campanaAnimarEntrada=()=>{};
  window.campanaVolverAlMenu=()=>{window.campanaLimpiarCreador?.();window.campanaLimpiarBorrador?.();if(estado)estado.textContent='Muestra reiniciada. Ningún dato salió de esta página.';window.campanaCrear?.();};
})();

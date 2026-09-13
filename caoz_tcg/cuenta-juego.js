/* Cuenta real: montaje fuera del lienzo escalado y sincronización del progreso.
   Leer una sesión jamás descarga un inventario sobre una partida en curso. */
(function(global){
  'use strict';
  let progreso,servicio,sincronizador,modelo,dialogo,vista,boton,cancelarEstado,cancelarGuardado;
  let iniciado=false,restaurando=false,identidadSync='',montando=false,actualizando=false,bloqueado=false;
  const pruebas=()=>new URLSearchParams(location.search).has('test');
  const menuSeguro=()=>!!document.querySelector('#extras.on,#menu.on')&&!document.querySelector('#board.on,#campanaPanel[open]');
  function refrescarJuego(){
    if(!menuSeguro())return;
    if(typeof cuentaRecargarProgreso==='function')cuentaRecargarProgreso();
  }
  function actualizarBoton(estado){
    if(!boton)return;
    boton.textContent=estado.sesion?'Mi cuenta · '+estado.sesion.nombre:'Mi cuenta';
    boton.dataset.guardado=estado.guardado;
    boton.title=estado.sesion?(estado.guardado==='guardado'?'Progreso guardado en tu cuenta':'Progreso pendiente de guardar'):'Guarda tu progreso con correo y código de acceso';
  }
  function detenerSync(){if(identidadSync){identidadSync='';sincronizador.desvincular();}}
  function recibirEstado(estado){
    if(bloqueado)return;actualizarBoton(estado);
    if(actualizando||estado.ocupado)return;
    if(!estado.sesion||estado.pantalla!=='perfil'){detenerSync();return;}
    const previo=sincronizador?.estado();
    if(identidadSync&&['conflicto','sesion'].includes(previo?.guardado)){
      actualizando=true;try{modelo.actualizarLocal(progreso.capturar());modelo.actualizarGuardado(previo);}finally{actualizando=false;}
      detenerSync();return;
    }
    const datos=modelo.datosSesion();let vinculo=progreso.vinculado();
    if(!vinculo||vinculo.cuentaId!==estado.sesion.id){
      // La cuenta vacía sólo sustituye al invitado/otra cuenta dentro del menú
      // de acceso, después de verificarla. Restaurar en segundo plano no escribe.
      if(!dialogo?.open||!menuSeguro()||datos.progreso||progreso.capturar()&&!datos.requiereAislar)return;
      try{
        actualizando=true;
        if(datos.requiereAislar)progreso.iniciarVacioParaCuenta({cuentaId:estado.sesion.id,revision:datos.revision});
        else progreso.vincularVacio({cuentaId:estado.sesion.id,revision:datos.revision});
        refrescarJuego();vinculo=progreso.vinculado();modelo.confirmarVinculoLocal();
      }catch(_){modelo.actualizarGuardado({guardado:'pendiente',error:{codigo:'ALMACENAMIENTO'}});return;}
      finally{actualizando=false;}
    }
    if(vinculo?.cuentaId!==estado.sesion.id)return;
    if(identidadSync!==estado.sesion.id){
      identidadSync=estado.sesion.id;
      sincronizador.vincular(datos);
    }
  }
  async function guardar(){
    if(!sincronizador)return false;
    const r=await sincronizador.guardar();
    return r!==false&&sincronizador.estado().guardado==='guardado';
  }
  async function restaurar(){
    if(restaurando||!modelo||pruebas())return;
    restaurando=true;
    try{await modelo.restaurar();}finally{restaurando=false;}
  }
  function cerrar(){
    if(!dialogo?.open||modelo.ver().ocupado)return;
    if(modelo.datosSesion().requiereAislar&&progreso.vinculado()?.cuentaId!==modelo.ver().sesion?.id){
      modelo.actualizarGuardado({guardado:'pendiente',error:{codigo:'CAMBIO_CUENTA'}});return;
    }
    vista?.destruir();vista=null;dialogo.close();dialogo.remove();dialogo=null;
    const extras=document.getElementById('extras');
    if(extras?.classList.contains('on')&&typeof animarTransicionMenu==='function')animarTransicionMenu(extras);
    boton?.focus({preventScroll:true});
  }
  function abrir(){
    if(bloqueado||!iniciado||!menuSeguro()||dialogo?.open||montando)return false;
    montando=true;
    try{
      modelo.actualizarLocal(progreso.capturar());
      dialogo=document.createElement('dialog');dialogo.id='cuentaJuego';dialogo.className='cuentaJuego';dialogo.setAttribute('aria-label','Cuenta del jugador');
      const raiz=document.createElement('div');raiz.className='cuentaJuegoRaiz';dialogo.appendChild(raiz);document.body.appendChild(dialogo);dialogo.showModal();
      dialogo.addEventListener('cancel',e=>{e.preventDefault();cerrar();});
      vista=global.CAOZ_CUENTA_UI.montar({raiz,modelo,onSalir:cerrar,onGuardar:guardar});
      if(typeof animarTransicionMenu==='function')animarTransicionMenu(raiz.querySelector('.cuentaUI'),dialogo);
      recibirEstado(modelo.ver());
      if(['inicio','perfil','invitado'].includes(modelo.ver().pantalla))void restaurar();
      return true;
    }finally{montando=false;}
  }
  function bloquearOtraPestana(){
    if(bloqueado)return;bloqueado=true;detenerSync();
    // La escritura ya fue rechazada de forma síncrona por el adaptador. Parar
    // el turno evita seguir resolviendo una partida cuya cuenta dejó de estar activa.
    if(typeof G!=='undefined'&&G){G.over=true;G.busy=true;G.winner=null;}
    if(typeof relojPara==='function')relojPara();
    const aviso=document.createElement('dialog');aviso.id='cuentaCambioExterno';aviso.className='cuentaJuego';
    aviso.setAttribute('aria-labelledby','cuentaCambioTitulo');
    const raiz=document.createElement('div');raiz.className='cuentaJuegoRaiz cuentaAnfitrion';
    const panel=document.createElement('section');panel.className='cuentaUI cuentaBloqueada';
    const h=document.createElement('h1');h.className='cuentaTitulo';h.id='cuentaCambioTitulo';h.textContent='La cuenta cambió en otra pestaña';
    const p=document.createElement('p');p.className='cuentaDescripcion';p.textContent='Recarga para continuar con la cuenta activa. Esta partida ya no puede modificar el progreso de ese jugador.';
    const b=document.createElement('button');b.className='cuentaBoton';b.textContent='Recargar el juego';b.onclick=()=>location.reload();
    panel.append(h,p,b);raiz.appendChild(panel);aviso.appendChild(raiz);document.body.appendChild(aviso);
    aviso.addEventListener('cancel',e=>e.preventDefault());aviso.showModal();b.focus();
  }
  function iniciar(){
    if(pruebas()||iniciado||!global.CAOZ_CUENTA_PROGRESO||!global.CAOZ_CUENTA_SERVICIO||!global.CAOZ_CUENTA_MODELO||!global.CAOZ_CUENTA_UI)return;
    boton=document.getElementById('mCuenta');if(!boton)return;
    progreso=global.CAOZ_CUENTA_PROGRESO.crear();
    global.addEventListener('caoz:cuenta-cambio-externo',bloquearOtraPestana);progreso.instalarGuardia?.();
    const remoto=global.CAOZ_CUENTA_SERVICIO.crear({progreso});
    servicio=Object.freeze({...remoto,async cerrarSesion(){
      if(progreso.vinculado()&&!await guardar())throw Object.assign(Error('PENDIENTE'),{codigo:'PENDIENTE'});
      await remoto.cerrarSesion();
    }});
    sincronizador=global.CAOZ_CUENTA_SERVICIO.sincronizador({servicio,progreso});
    modelo=global.CAOZ_CUENTA_MODELO.crear({servicio,progresoLocal:progreso.capturar(),resumir:s=>{const r=progreso.resumir(s);if(r&&typeof LEADERS!=='undefined'&&LEADERS[r.mazo])r.mazo=LEADERS[r.mazo].n;return r;},
      confirmarRecuperacion:true,sesionVinculada:r=>r.vinculado===true});
    cancelarEstado=modelo.suscribir(recibirEstado);
    cancelarGuardado=sincronizador.suscribir(estado=>{
      if(!identidadSync||actualizando||modelo.ver().ocupado)return;
      actualizando=true;
      try{modelo.actualizarLocal(progreso.capturar());modelo.actualizarGuardado(estado);}
      finally{actualizando=false;}
      if(estado.guardado==='conflicto'||estado.guardado==='sesion')detenerSync();
    });
    boton.addEventListener('click',abrir);iniciado=true;
    global.addEventListener('caoz:pantalla',e=>{if(['menu','extras'].includes(e.detail?.id)&&identidadSync)void guardar();});
    global.addEventListener('online',()=>{if(identidadSync)void guardar();else if(menuSeguro())void restaurar();});
    global.addEventListener('caoz:cuenta-importada',refrescarJuego);
    if(!pruebas())void restaurar();
  }
  global.CAOZ_CUENTA_JUEGO=Object.freeze({abrir,cerrar,guardar,
    estado:()=>modelo?.ver()||null,
    vinculada:()=>!!progreso?.vinculado(),
    reiniciarLocal(){if(!iniciado||pruebas())return null;try{progreso.reiniciar();return true;}catch(_){return false;}},
    async antesDeBorrar(){if(!progreso?.vinculado())return true;if(!modelo?.ver().sesion)return false;return guardar();},
    async despuesDeBorrar(){return !progreso?.vinculado()||await guardar();}
  });
  function intentarIniciar(){
    try{iniciar();}catch(error){
      if(error?.codigo==='PROGRESO_OCUPADO'){setTimeout(()=>{if(!iniciado&&!bloqueado)intentarIniciar();},5100);}
      const b=document.getElementById('mCuenta');if(b)b.onclick=()=>{
        try{iniciar();if(iniciado){b.onclick=null;abrir();return;}}catch(_){}
        if(typeof toast==='function')toast('No podemos leer el progreso de este dispositivo. Revisa el almacenamiento del navegador antes de vincular una cuenta.');
      };
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',intentarIniciar,{once:true});else intentarIniciar();
})(window);

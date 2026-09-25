/* Acceso obligatorio al Domo. La guardia existe antes del script de cada
   pantalla; el diálogo se monta fuera del lienzo escalado al estar listo el DOM. */
(function(global){
  'use strict';
  let progreso,servicio,acceso,dialogo,vista,boton,estadoGuardado;
  let iniciado=false,montando=false,restaurando=false,bloqueado=false,pendiente=null,notificada='';
  const pruebas=()=>new URLSearchParams(location.search).has('test');
  const menuSeguro=()=>!document.querySelector('#board.on,#campanaPanel[open]')||typeof G!=='undefined'&&G?.over;
  function permitido(){return pruebas()||!!acceso?.puedeJugar();}
  function refrescarJuego(){if(menuSeguro()&&typeof cuentaRecargarProgreso==='function')cuentaRecargarProgreso();}
  function requerir(continuar){
    if(permitido())return true;
    if(!pendiente&&typeof continuar==='function')pendiente=continuar;
    // Reautenticar entre encuentros desde un menú seguro, antes de que la
    // campaña cambie de etapa o empiece el siguiente combate.
    if(iniciado&&document.querySelector('#campanaPanel[open],#campanaSecreto[open]')){
      if(typeof campanaCerrar==='function')campanaCerrar();
      if(typeof cerrarCinematica==='function')cerrarCinematica();
      if(typeof showScreen==='function')showScreen('menu');
    }
    if(iniciado&&menuSeguro())abrir();
    return false;
  }
  function notificar(){
    if(!permitido()||pruebas())return;
    const id=acceso.estado().sesion?.id;if(id&&notificada!==id){notificada=id;global.dispatchEvent(new CustomEvent('caoz:cuenta-lista',{detail:{cuentaId:id}}));}
  }
  function actualizar(s){
    estadoGuardado=s;
    if(boton){boton.textContent=s.sesion?'Mi cuenta · '+s.sesion.nombre:'Mi cuenta';boton.dataset.guardado=s.guardado;}
    const estado=document.getElementById('cuentaEstadoMenu');
    if(estado){
      estado.hidden=!s.sesion;
      estado.textContent=s.guardado==='guardado'?'Progreso sincronizado':s.guardado==='sinConexion'?'Sin conexión · guardado en este dispositivo':s.guardado==='pendiente'?'Guardado aquí · pendiente de sincronizar':s.guardado==='sesion'?'Vuelve a entrar para sincronizar':'Revisa tu cuenta';
      estado.dataset.guardado=s.guardado;
    }
    if(!permitido())notificada='';else notificar();
    // Una sesión que caduca durante un duelo no interrumpe su resolución.
    // Se conserva el progreso local y se exige acceso antes de otro combate.
    if(!restaurando&&!acceso?.recuperando?.()&&!s.ocupado&&!permitido()&&menuSeguro()&&!montando)abrir();
  }
  function cerrar(){
    if(!dialogo?.open||acceso.modelo.ver().ocupado||!permitido())return false;
    vista?.destruir();vista=null;dialogo.close();dialogo.remove();dialogo=null;
    const continuar=pendiente;pendiente=null;
    if(continuar)queueMicrotask(()=>{if(permitido())continuar();});else boton?.focus({preventScroll:true});
    return true;
  }
  function abrir(){
    if(bloqueado||!iniciado||!menuSeguro()||dialogo?.open||montando)return false;
    montando=true;
    try{
      acceso.modelo.actualizarLocal(progreso.capturar());
      dialogo=document.createElement('dialog');dialogo.id='cuentaJuego';dialogo.className='cuentaJuego';dialogo.setAttribute('aria-label','Acceso al Domo');
      const raiz=document.createElement('div');raiz.className='cuentaJuegoRaiz';dialogo.append(raiz);document.body.append(dialogo);dialogo.showModal();
      dialogo.addEventListener('cancel',e=>{e.preventDefault();cerrar();});
      vista=global.CAOZ_CUENTA_UI.montar({raiz,modelo:acceso.modelo,onSalir:cerrar,onGuardar:()=>acceso.guardar()});
      acceso.activarVinculo();
      return true;
    }finally{montando=false;}
  }
  async function restaurar(){
    if(restaurando||pruebas()||bloqueado)return false;
    // Al arrancar puede existir una cuenta válida. Primero se consulta su
    // sesión y sólo se pinta el diálogo si esa recuperación no permite jugar:
    // así el formulario de correo no destella antes de cerrar solo.
    if(!acceso?.necesitaRestaurar?.()){
      // Otro listener (online, focus o pageshow) puede haber iniciado ya la
      // misma recuperación. Se espera su resultado, en vez de mostrar un
      // diálogo que se cerraría enseguida si la sesión resulta válida.
      if(!permitido()&&!acceso?.recuperando?.())abrir();
      return false;
    }
    restaurando=true;
    try{const ok=await acceso.iniciar({automatico:true});if(ok){cerrar();notificar();}else abrir();return ok;}
    catch(_){abrir();return false;}
    finally{restaurando=false;}
  }
  function bloquearOtraPestana(){
    if(bloqueado)return;bloqueado=true;acceso?.bloquear();
    if(typeof G!=='undefined'&&G){G.over=true;G.busy=true;G.winner=null;}
    if(typeof relojPara==='function')relojPara();
    const aviso=document.createElement('dialog');aviso.id='cuentaCambioExterno';aviso.className='cuentaJuego';aviso.setAttribute('aria-labelledby','cuentaCambioTitulo');
    const raiz=document.createElement('div');raiz.className='cuentaJuegoRaiz cuentaAnfitrion';
    const panel=document.createElement('section');panel.className='cuentaUI cuentaBloqueada';
    const h=document.createElement('h1');h.className='cuentaTitulo';h.id='cuentaCambioTitulo';h.textContent='La cuenta cambió en otra pestaña';
    const p=document.createElement('p');p.className='cuentaDescripcion';p.textContent='Recarga para continuar con la cuenta activa. Conservamos el progreso de cada jugador por separado.';
    const b=document.createElement('button');b.className='cuentaBoton';b.textContent='Recargar el juego';b.onclick=()=>location.reload();
    panel.append(h,p,b);raiz.append(panel);aviso.append(raiz);document.body.append(aviso);aviso.addEventListener('cancel',e=>e.preventDefault());aviso.showModal();b.focus();
  }
  function iniciar(){
    if(pruebas()||iniciado)return;
    boton=document.getElementById('mCuenta');if(!boton)return;
    progreso=global.CAOZ_CUENTA_PROGRESO.crear();progreso.instalarGuardia?.();
    global.addEventListener('caoz:cuenta-cambio-externo',bloquearOtraPestana);
    servicio=global.CAOZ_CUENTA_SERVICIO.crear({progreso});
    acceso=global.CAOZ_CUENTA_ACCESO.crear({progreso,servicio,puedeVincular:()=>dialogo?.open&&menuSeguro(),onImportar:refrescarJuego,
      resumir:s=>{const r=progreso.resumir(s);if(r&&typeof LEADERS!=='undefined'&&LEADERS[r.mazo])r.mazo=LEADERS[r.mazo].n;return r;}});
    const marca=document.createElement('p');marca.id='cuentaEstadoMenu';marca.className='cuentaEstadoMenu';marca.setAttribute('aria-live','polite');marca.hidden=true;
    document.querySelector('#menu .menucol')?.append(marca);
    iniciado=true;restaurando=true;acceso.suscribir(actualizar);restaurando=false;
    boton.addEventListener('click',()=>{abrir();if(!permitido())void restaurar();});
    global.addEventListener('caoz:pantalla',e=>{if(['menu','extras'].includes(e.detail?.id)){if(permitido())void acceso.guardar();else if(!restaurando)void restaurar();}});
    global.addEventListener('online',()=>{if(!permitido()&&menuSeguro())void restaurar();});
    global.addEventListener('caoz:cuenta-importada',refrescarJuego);
    void restaurar();
  }
  // Disponible de forma síncrona: también protege enlaces de invitación y
  // arranques que ocurren antes de DOMContentLoaded o de comprobar la cookie.
  global.CAOZ_CUENTA_JUEGO=Object.freeze({abrir,cerrar,requerir,puedeJugar:permitido,guardar:()=>acceso?.guardar()||Promise.resolve(false),
    estado:()=>estadoGuardado||null,vinculada:()=>!!progreso?.vinculado(),
    reiniciarLocal(){if(!iniciado||pruebas())return null;try{progreso.reiniciar();return true;}catch(_){return false;}},
    async antesDeBorrar(){if(!progreso?.vinculado())return true;if(!permitido())return false;return acceso.guardar();},
    async despuesDeBorrar(){return !progreso?.vinculado()||await acceso.guardar();}
  });
  function intentarIniciar(){
    try{iniciar();}catch(error){
      if(error?.codigo==='PROGRESO_OCUPADO'){setTimeout(()=>{if(!iniciado&&!bloqueado)intentarIniciar();},5100);return;}
      if(pruebas()||document.getElementById('cuentaFalloInicio'))return;
      const aviso=document.createElement('dialog');aviso.id='cuentaFalloInicio';aviso.className='cuentaJuego';
      const panel=document.createElement('div');panel.className='cuentaJuegoRaiz cuentaAnfitrion';
      const tarjeta=document.createElement('section');tarjeta.className='cuentaUI cuentaBloqueada';
      const h=document.createElement('h1');h.className='cuentaTitulo';h.textContent='No pudimos abrir tu cuenta';
      const p=document.createElement('p');p.className='cuentaDescripcion';p.textContent='Revisa la conexión y el espacio de este dispositivo. Tu progreso no se ha eliminado.';
      const b=document.createElement('button');b.className='cuentaBoton';b.textContent='Volver a intentar';b.onclick=()=>location.reload();
      tarjeta.append(h,p,b);panel.append(tarjeta);aviso.append(panel);document.body.append(aviso);aviso.addEventListener('cancel',e=>e.preventDefault());aviso.showModal();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',intentarIniciar,{once:true});else intentarIniciar();
})(window);

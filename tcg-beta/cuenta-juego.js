/* Acceso obligatorio al Domo. La guardia existe antes del script de cada
   pantalla; el diálogo se monta fuera del lienzo escalado al estar listo el DOM. */
(function(global){
  'use strict';
  let progreso,servicio,acceso,dialogo,vista,boton,estadoGuardado;
  let iniciado=false,montando=false,restaurando=false,bloqueado=false,pendiente=null,notificada='';
  const pruebas=()=>new URLSearchParams(location.search).has('test');
  // La candidata de balance es una sala de playtest de dos personas. No usa
  // correo ni el Worker: alterna dos copias locales completas del progreso y
  // devuelve la copia normal de Beta al abandonar este enlace.
  const balanceCandidata=()=>!pruebas()&&new URLSearchParams(location.search).get('balance')==='candidata';
  const BALANCE_PREFIJO='caoz.balance.candidata.v1.';
  const BALANCE_PERFILES=Object.freeze({
    pato:Object.freeze({id:'pato',nombre:'Pato',inicial:'P'}),
    rafa:Object.freeze({id:'rafa',nombre:'Rafa',inicial:'R'})
  });
  const BALANCE_NORMAL=BALANCE_PREFIJO+'normal',BALANCE_ESTADO=BALANCE_PREFIJO+'estado',BALANCE_CAMBIO=BALANCE_PREFIJO+'cambio';
  const clavePerfilBalance=id=>BALANCE_PREFIJO+'perfil.'+id;
  const mapaIgual=(a,b)=>{
    const ka=Object.keys(a),kb=Object.keys(b);if(ka.length!==kb.length)return false;
    return ka.every(k=>Object.hasOwn(b,k)&&a[k]===b[k]);
  };
  const claveProgresoBalance=clave=>typeof clave==='string'&&(clave==='caoz_records_v1'||clave==='caoz_nombre'||
    /^caoz\.campana\.v1(?:\.|$)/.test(clave)||/^caoz\.coleccion\.v1\.(?:beta|produccion)\./.test(clave));
  function validarMapaBalance(mapa){
    if(!mapa||typeof mapa!=='object'||Array.isArray(mapa))return null;
    const limpio={},entradas=Object.entries(mapa);let peso=0;
    for(const [clave,valor] of entradas){
      if(!claveProgresoBalance(clave)||typeof valor!=='string')return null;
      peso+=clave.length+valor.length;if(peso>2*1024*1024)return null;
      limpio[clave]=valor;
    }
    return limpio;
  }
  function capturarMapaBalance(){
    const mapa={};
    try{for(let i=0;i<localStorage.length;i++){
      const clave=localStorage.key(i);if(!claveProgresoBalance(clave))continue;
      const valor=localStorage.getItem(clave);if(valor!==null)mapa[clave]=valor;
    }}catch(_){return null;}
    return mapa;
  }
  function leerMapaBalance(clave){
    try{
      const dato=JSON.parse(localStorage.getItem(clave)||'null');
      return dato?.version===1?validarMapaBalance(dato.datos):null;
    }catch(_){return null;}
  }
  function guardarMapaBalance(clave,mapa){
    const datos=validarMapaBalance(mapa);if(!datos)return false;
    try{
      const texto=JSON.stringify({version:1,datos});localStorage.setItem(clave,texto);
      return localStorage.getItem(clave)===texto;
    }catch(_){return false;}
  }
  function leerEstadoBalance(){
    try{
      const dato=JSON.parse(localStorage.getItem(BALANCE_ESTADO)||'null');
      if(dato?.version!==1||typeof dato.activo!=='boolean'||dato.perfil!==null&&!BALANCE_PERFILES[dato.perfil]||
        dato.cambiando!==undefined&&typeof dato.cambiando!=='boolean')throw Error();
      return {activo:dato.activo,perfil:dato.perfil,cambiando:dato.cambiando===true};
    }catch(_){return {activo:false,perfil:null,cambiando:false};}
  }
  function guardarEstadoBalance(estado){
    if(!estado||typeof estado.activo!=='boolean'||estado.perfil!==null&&!BALANCE_PERFILES[estado.perfil])return false;
    try{
      const texto=JSON.stringify({version:1,activo:estado.activo,perfil:estado.perfil,cambiando:estado.cambiando===true});
      localStorage.setItem(BALANCE_ESTADO,texto);return localStorage.getItem(BALANCE_ESTADO)===texto;
    }catch(_){return false;}
  }
  function escribirMapaBalance(mapa){
    const destino=validarMapaBalance(mapa),antes=capturarMapaBalance();if(!destino||!antes)return false;
    if(mapaIgual(antes,destino))return true;
    try{
      for(const clave of Object.keys(antes))localStorage.removeItem(clave);
      for(const [clave,valor] of Object.entries(destino))localStorage.setItem(clave,valor);
      const despues=capturarMapaBalance();if(!despues||!mapaIgual(despues,destino))throw Error();
      return true;
    }catch(_){
      try{for(const clave of Object.keys(capturarMapaBalance()||{}))localStorage.removeItem(clave);
        for(const [clave,valor] of Object.entries(antes))localStorage.setItem(clave,valor);}catch(__){}
      return false;
    }
  }
  function recuperarCambioBalance(){
    let cambio;
    try{cambio=JSON.parse(localStorage.getItem(BALANCE_CAMBIO)||'null');}catch(_){return false;}
    if(!cambio)return true;
    const antes=validarMapaBalance(cambio.antes),estado=cambio.estado;
    if(!antes||!estado||typeof estado.activo!=='boolean'||estado.perfil!==null&&!BALANCE_PERFILES[estado.perfil])return false;
    if(!escribirMapaBalance(antes)||!guardarEstadoBalance(estado))return false;
    try{localStorage.removeItem(BALANCE_CAMBIO);return localStorage.getItem(BALANCE_CAMBIO)===null;}catch(_){return false;}
  }
  function transicionarMapaBalance(destino,antesEstado,despuesEstado){
    const antes=capturarMapaBalance(),limpio=validarMapaBalance(destino);
    if(!antes||!limpio)return false;
    if(mapaIgual(antes,limpio))return guardarEstadoBalance(despuesEstado);
    try{
      const texto=JSON.stringify({version:1,antes,estado:antesEstado});localStorage.setItem(BALANCE_CAMBIO,texto);
      if(localStorage.getItem(BALANCE_CAMBIO)!==texto||!guardarEstadoBalance({...antesEstado,cambiando:true})||!escribirMapaBalance(limpio)||
        !guardarEstadoBalance(despuesEstado))return false;
      localStorage.removeItem(BALANCE_CAMBIO);return localStorage.getItem(BALANCE_CAMBIO)===null;
    }catch(_){return false;}
  }
  function activarPerfilBalance(id){
    if(!BALANCE_PERFILES[id]||!recuperarCambioBalance())return false;
    const actual=leerEstadoBalance();
    if(actual.activo&&actual.perfil===id)return true;
    const mapaActual=capturarMapaBalance();if(!mapaActual)return false;
    if(actual.activo){if(!guardarMapaBalance(clavePerfilBalance(actual.perfil),mapaActual))return false;}
    else if(!guardarMapaBalance(BALANCE_NORMAL,mapaActual))return false;
    const destino=leerMapaBalance(clavePerfilBalance(id))||{};
    return transicionarMapaBalance(destino,{activo:actual.activo,perfil:actual.perfil,cambiando:false},{activo:true,perfil:id,cambiando:false});
  }
  // Se llama antes de crear la cuenta normal. Así una visita ordinaria a Beta
  // jamás interpreta el progreso de Pato/Rafa como si fuera el de un correo.
  function restaurarBetaNormal(){
    if(balanceCandidata()||pruebas()||!recuperarCambioBalance())return false;
    const actual=leerEstadoBalance();if(!actual.activo||!BALANCE_PERFILES[actual.perfil])return false;
    const normal=leerMapaBalance(BALANCE_NORMAL),mapaActual=capturarMapaBalance();
    if(!normal||!mapaActual||!guardarMapaBalance(clavePerfilBalance(actual.perfil),mapaActual))return false;
    return transicionarMapaBalance(normal,{activo:true,perfil:actual.perfil,cambiando:false},{activo:false,perfil:null,cambiando:false});
  }
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
  function crearCuentaBalance(){
    let iniciada=false,dialogoLocal=null,botonLocal=null,perfilLocal=null,pendienteLocal=null,marcaLocal=null;
    const perfilGuardado=()=>{const estado=leerEstadoBalance();return estado.activo?BALANCE_PERFILES[estado.perfil]||null:null;};
    const puedeJugar=()=>!!perfilLocal;
    function actualizarLocal(error=''){
      const perfil=perfilLocal;
      if(botonLocal){botonLocal.textContent=perfil?'Jugador · '+perfil.nombre:'Elegir jugador';botonLocal.dataset.guardado=perfil?'guardado':'';}
      if(marcaLocal){
        marcaLocal.hidden=!perfil;marcaLocal.dataset.guardado='guardado';
        marcaLocal.textContent=perfil?'Beta candidata · progreso de '+perfil.nombre+' guardado en este dispositivo.':'';
      }
      const aviso=dialogoLocal?.querySelector('.cuentaCandidataError');
      if(aviso){aviso.hidden=!error;aviso.textContent=error;}
    }
    function cerrarLocal(){
      if(!dialogoLocal?.open||!puedeJugar())return false;
      dialogoLocal.close();dialogoLocal.remove();dialogoLocal=null;
      const continuar=pendienteLocal;pendienteLocal=null;
      if(continuar)queueMicrotask(()=>{if(puedeJugar())continuar();});else botonLocal?.focus({preventScroll:true});
      return true;
    }
    function elegirPerfil(id){
      const perfil=BALANCE_PERFILES[id];if(!perfil)return false;
      const botones=[...(dialogoLocal?.querySelectorAll('.cuentaPerfil')||[])];botones.forEach(b=>b.disabled=true);
      if(!activarPerfilBalance(id)){
        botones.forEach(b=>b.disabled=false);actualizarLocal('No pudimos preparar este perfil. Tu progreso anterior sigue protegido; vuelve a intentarlo.');return false;
      }
      perfilLocal=perfil;refrescarJuego();actualizarLocal();
      global.dispatchEvent(new CustomEvent('caoz:cuenta-lista',{detail:{cuentaId:'balance-'+perfil.id,nombre:perfil.nombre,modo:'balance-candidata'}}));
      cerrarLocal();return true;
    }
    function abrirLocal(){
      if(!iniciada||!menuSeguro()||dialogoLocal?.open)return false;
      dialogoLocal=document.createElement('dialog');dialogoLocal.id='cuentaJuego';dialogoLocal.className='cuentaJuego';dialogoLocal.setAttribute('aria-labelledby','cuentaCandidataTitulo');
      const raiz=document.createElement('div');raiz.className='cuentaJuegoRaiz cuentaCandidataRaiz';
      const panel=document.createElement('section');panel.className='cuentaUI cuentaCandidata';
      const ceja=document.createElement('p');ceja.className='cuentaAntetitulo';ceja.textContent='BETA · BALANCE CANDIDATO';
      const titulo=document.createElement('h1');titulo.className='cuentaTitulo';titulo.id='cuentaCandidataTitulo';titulo.textContent='¿Quién juega?';
      const texto=document.createElement('p');texto.className='cuentaDescripcion';texto.textContent='Elige Pato o Rafa. Cada perfil conserva por separado su campaña, colección y récords en este navegador.';
      const perfiles=document.createElement('div');perfiles.className='cuentaPerfiles';
      const actual=perfilGuardado();
      for(const perfil of Object.values(BALANCE_PERFILES)){
        const opcion=document.createElement('button');opcion.type='button';opcion.className='cuentaPerfil';opcion.dataset.perfil=perfil.id;
        const sello=document.createElement('span');sello.className='cuentaPerfilSello';sello.textContent=perfil.inicial;
        const nombre=document.createElement('strong');nombre.textContent=perfil.nombre;
        const nota=document.createElement('small');nota.textContent=actual?.id===perfil.id?'Continuar con este perfil':'Usar este perfil';
        opcion.append(sello,nombre,nota);opcion.addEventListener('click',()=>elegirPerfil(perfil.id));perfiles.append(opcion);
      }
      const error=document.createElement('p');error.className='cuentaCandidataError';error.hidden=true;error.setAttribute('role','alert');
      panel.append(ceja,titulo,texto,perfiles,error);
      if(puedeJugar()){
        const cancelar=document.createElement('button');cancelar.type='button';cancelar.className='cuentaCandidataCancelar';cancelar.textContent='Cancelar';cancelar.onclick=cerrarLocal;panel.append(cancelar);
      }
      raiz.append(panel);dialogoLocal.append(raiz);document.body.append(dialogoLocal);
      dialogoLocal.addEventListener('cancel',e=>{e.preventDefault();cerrarLocal();});dialogoLocal.showModal();
      requestAnimationFrame(()=>dialogoLocal?.querySelector('.cuentaPerfil')?.focus({preventScroll:true}));return true;
    }
    function requerirLocal(continuar){
      if(puedeJugar())return true;
      if(!pendienteLocal&&typeof continuar==='function')pendienteLocal=continuar;
      if(iniciada&&menuSeguro())abrirLocal();return false;
    }
    function guardarLocal(){
      const perfil=perfilLocal||perfilGuardado();
      return Promise.resolve(!!perfil&&guardarMapaBalance(clavePerfilBalance(perfil.id),capturarMapaBalance()||{}));
    }
    function reiniciarLocal(){
      const estado=leerEstadoBalance(),perfil=perfilLocal||perfilGuardado();
      if(!iniciada||!perfil||!estado.activo||estado.perfil!==perfil.id)return null;
      const ok=transicionarMapaBalance({},estado,estado)&&guardarMapaBalance(clavePerfilBalance(perfil.id),capturarMapaBalance()||{});
      return ok;
    }
    function iniciarLocal(){
      if(iniciada)return;botonLocal=document.getElementById('mCuenta');if(!botonLocal)return;
      if(!recuperarCambioBalance())throw Error('No se pudo recuperar el cambio de perfil.');
      marcaLocal=document.createElement('p');marcaLocal.id='cuentaEstadoMenu';marcaLocal.className='cuentaEstadoMenu';marcaLocal.setAttribute('aria-live','polite');marcaLocal.hidden=true;
      document.querySelector('#menu .menucol')?.append(marcaLocal);
      iniciada=true;actualizarLocal();
      botonLocal.addEventListener('click',abrirLocal);
      global.addEventListener('caoz:pantalla',e=>{if(['menu','extras'].includes(e.detail?.id))void guardarLocal();});
      global.addEventListener('pagehide',()=>{void guardarLocal();});
      abrirLocal();
    }
    return Object.freeze({abrir:abrirLocal,cerrar:cerrarLocal,requerir:requerirLocal,puedeJugar,guardar:guardarLocal,
      estado:()=>perfilLocal?{sesion:{id:'balance-'+perfilLocal.id,nombre:perfilLocal.nombre},guardado:'guardado',modo:'balance-candidata'}:null,
      vinculada:()=>false,reiniciarLocal,antesDeBorrar:async()=>true,despuesDeBorrar:async()=>true,iniciar:iniciarLocal});
  }
  function iniciar(){
    if(balanceCandidata()){global.CAOZ_CUENTA_JUEGO?.iniciar?.();return;}
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
  // Antes de que la cuenta ordinaria lea el almacenamiento, devolvemos el
  // avance que estaba activo antes de entrar al enlace de balance.
  if(!balanceCandidata()&&!pruebas())restaurarBetaNormal();
  // Disponible de forma síncrona: también protege enlaces de invitación y
  // arranques que ocurren antes de DOMContentLoaded o de comprobar la cookie.
  global.CAOZ_CUENTA_JUEGO=balanceCandidata()?crearCuentaBalance():Object.freeze({abrir,cerrar,requerir,puedeJugar:permitido,guardar:()=>acceso?.guardar()||Promise.resolve(false),
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

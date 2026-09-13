/* Cuenta del jugador. Interfaz reutilizable: el modelo decide persistencia y
   transporte. No conoce secretos, no envía correo ni modifica el juego. */
(function(){
  'use strict';
  let montajes=0;
  const texto=v=>typeof v==='string'?v:'';
  const numero=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
  function nodo(tag,clase,contenido){const n=document.createElement(tag);if(clase)n.className=clase;if(contenido!==undefined)n.textContent=contenido;return n;}
  function emblema(){
    const n=nodo('div','cuentaEmblema');n.setAttribute('aria-hidden','true');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 48');
    for(const d of ['M9 12c6-2 10-1 15 3 5-4 9-5 15-3v23c-6-2-10-1-15 3-5-4-9-5-15-3Z','M24 15v23M14 19l5 2M14 25l5 2M29 21l5-2M29 27l5-2','M24 3v5M21.5 5.5h5']){const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.appendChild(p);}
    n.appendChild(svg);return n;
  }
  function montar({raiz,modelo,onSalir,onGuardar}={}){
    if(!raiz||typeof raiz.appendChild!=='function'||!modelo||typeof modelo.ver!=='function'||typeof modelo.suscribir!=='function')throw Error('La cuenta necesita un contenedor y un modelo.');
    const prefijo='cuenta-'+(++montajes)+'-',anterior=document.activeElement,teniaClase=raiz.classList.contains('cuentaAnfitrion');
    const altoAnterior=raiz.style.getPropertyValue('--cuenta-alto-disponible');raiz.classList.add('cuentaAnfitrion');
    let vivo=true,estado=modelo.ver(),pantallaAnterior='',claveAnterior='',soltando=false,errorLocal='',eleccion='',confirmarLocal=false;
    let borrador={correo:texto(estado.correo),nombre:texto(estado.nombre),codigo:''};
    let ultimoCodigo='',cancelarSuscripcion=()=>{},enfoquePendiente=null,seleccionPendiente=null;
    const panel=nodo('section','cuentaUI');panel.setAttribute('aria-labelledby',prefijo+'titulo');
    const puedeSalir=()=>estado.puedeSalir!==false&&!estado.ocupado;
    const cabecera=nodo('header','cuentaCabecera'),simbolo=emblema(),antetitulo=nodo('p','cuentaAntetitulo','TU HISTORIA EN EL DOMO');
    const titulo=nodo('h1','cuentaTitulo');titulo.id=prefijo+'titulo';titulo.tabIndex=-1;
    const descripcion=nodo('p','cuentaDescripcion');descripcion.id=prefijo+'descripcion';
    const contenido=nodo('div','cuentaContenido'),mensajes=nodo('div','cuentaMensajes');
    const error=nodo('p','cuentaError');error.id=prefijo+'error';error.setAttribute('role','alert');
    const aviso=nodo('p','cuentaAviso');aviso.setAttribute('role','status');
    mensajes.append(error,aviso);cabecera.append(simbolo,antetitulo,titulo,descripcion);panel.append(cabecera,contenido,mensajes);
    if(typeof onSalir==='function'){
      const cerrar=nodo('button','cuentaCerrar','×');cerrar.type='button';cerrar.setAttribute('aria-label','Volver al juego');cerrar.dataset.foco='cerrar';cerrar.onclick=()=>{if(puedeSalir())onSalir();};panel.appendChild(cerrar);
    }
    raiz.appendChild(panel);
    function boton(etiqueta,fn,clase='',foco){
      const b=nodo('button','cuentaBoton'+(clase?' '+clase:''),etiqueta);b.type='button';b.disabled=!!estado.ocupado;
      if(foco)b.dataset.foco=foco;b.onclick=()=>accion(fn);return b;
    }
    async function accion(fn){
      if(!vivo||estado.ocupado||soltando)return;
      errorLocal='';soltando=true;
      try{await fn();}catch(_){if(vivo){errorLocal='No pudimos completar la acción. Inténtalo de nuevo.';pintarMensajes();}}
      finally{soltando=false;}
    }
    function pintarMensajes(){
      error.textContent=errorLocal||texto(estado.error);error.hidden=!error.textContent;
      aviso.textContent=texto(estado.aviso);aviso.hidden=!aviso.textContent;
      mensajes.hidden=error.hidden&&aviso.hidden;
    }
    function campo({etiqueta,nombre,tipo='text',autocomplete,maximo,requerido=true,minimo}){
      const l=nodo('label','cuentaCampo'),t=nodo('span','cuentaEtiqueta',etiqueta),i=nodo('input','cuentaEntrada');
      i.id=prefijo+nombre;i.name=nombre;i.type=tipo;i.value=borrador[nombre]||'';i.required=requerido;i.readOnly=!!estado.ocupado;
      i.autocomplete=autocomplete||'off';i.maxLength=maximo;i.dataset.foco=nombre;i.spellcheck=false;
      i.setAttribute('aria-describedby',prefijo+'error');if(minimo)i.minLength=minimo;
      i.addEventListener('input',()=>{borrador[nombre]=i.value;});l.append(t,i);return {l,i};
    }
    function fecha(valor){
      const f=new Date(valor);return valor&&Number.isFinite(f.getTime())?f.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})+' · '+f.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'Aún sin guardar';
    }
    function resumen(datos,etiqueta){
      const r=nodo('article','cuentaResumen');r.appendChild(nodo('p','cuentaResumenEtiqueta',etiqueta));
      r.appendChild(nodo('h2','cuentaPersonaje',texto(datos?.personaje)||'Tu aventura'));
      r.appendChild(nodo('p','cuentaMazo',datos?.mazo&&datos.mazo!=='Sin elegir'?'Mazo de '+texto(datos.mazo):'Mazo por elegir'));
      const dl=nodo('dl','cuentaCifras');
      for(const [nombre,valor]of [['Rivales',numero(datos?.rivales)+' / '+(numero(datos?.etapas)||6)],['Foil',numero(datos?.foils)],['Doradas',numero(datos?.doradas)],['Sobres',numero(datos?.sobres)]]){
        const c=nodo('div');c.append(nodo('dt','',nombre),nodo('dd','',String(valor)));dl.appendChild(c);
      }
      r.appendChild(dl);if(datos?.fecha)r.appendChild(nodo('p','cuentaFecha',fecha(datos.fecha)));return r;
    }
    function acciones(...botones){const d=nodo('div','cuentaAcciones');d.append(...botones.filter(Boolean));return d;}
    function regresar(){
      if(typeof onSalir!=='function'||estado.puedeSalir===false)return null;
      const etiqueta=estado.obligatoria?(estado.sinConexion?'Continuar sin conexión':'Entrar al Domo'):'Volver al juego';
      return boton(etiqueta,()=>{if(puedeSalir())onSalir();},estado.obligatoria?'':'cuentaBotonSecundario','volver');
    }
    function pantallaInicio(){
      titulo.textContent=estado.obligatoria?'Entra al Domo':'Que tu historia permanezca';descripcion.textContent=estado.obligatoria?'Tu aventura empieza con tu correo.':'Guarda tu campaña y tu colección para continuar en otro dispositivo.';
      const tabs=nodo('div','cuentaPestanas');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Acceso a tu cuenta');
      const activa=estado.intencion==='crear'?'crear':'entrar';
      for(const [id,etiqueta]of [['crear','Crear cuenta'],['entrar','Entrar']]){
        const b=boton(etiqueta,()=>modelo.preparar(id),'cuentaPestana','tab-'+id);b.id=prefijo+'tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(activa===id));b.setAttribute('aria-controls',prefijo+'formulario');b.tabIndex=activa===id?0:-1;
        b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const siguiente=e.key==='Home'?'crear':e.key==='End'?'entrar':id==='crear'?'entrar':'crear';modelo.preparar(siguiente);}};
        tabs.appendChild(b);
      }
      const f=nodo('form','cuentaFormulario');f.id=prefijo+'formulario';f.setAttribute('role','tabpanel');f.setAttribute('aria-labelledby',prefijo+'tab-'+activa);
      if(activa==='crear')f.appendChild(campo({etiqueta:'Nombre del jugador',nombre:'nombre',autocomplete:'nickname',maximo:40,minimo:2}).l);
      const correo=campo({etiqueta:'Correo electrónico',nombre:'correo',tipo:'email',autocomplete:'email',maximo:254});correo.i.inputMode='email';correo.i.autocapitalize='none';correo.i.placeholder='tu@correo.com';f.appendChild(correo.l);
      f.appendChild(nodo('p','cuentaAyuda',estado.obligatoria?'Te enviaremos un código. Sin contraseña.':'Te enviaremos un código de acceso. No necesitas contraseña.'));
      f.appendChild(nodo('p','cuentaAyuda cuentaDatos',estado.obligatoria?'Guardamos tu correo, nombre y progreso: campaña, cartas, sobres y récords.':'Tu cuenta guarda tu correo, tu nombre de jugador y tu progreso: campaña, colección, sobres y récords.'));
      const enviar=boton(estado.ocupado?'Preparando tu código…':'Enviar código',()=>{},'','enviar');enviar.type='submit';enviar.onclick=null;
      f.onsubmit=e=>{e.preventDefault();if(f.reportValidity())void accion(()=>modelo.solicitar({correo:borrador.correo.trim(),nombre:activa==='crear'?borrador.nombre.trim():'',intencion:activa}));};
      if(estado.obligatoria)f.appendChild(nodo('p','cuentaAyuda cuentaAccesoOffline','Primer acceso con internet; después, juega sin conexión en la app. Tu avance se sincroniza al reconectar.'));
      f.appendChild(acciones(enviar,estado.obligatoria?null:boton('Seguir sin cuenta',()=>modelo.invitado(),'cuentaBotonSecundario','invitado')));contenido.append(tabs,f);
    }
    function pantallaCodigo(){
      titulo.textContent='Abre las puertas del Domo';descripcion.textContent='Escribe el código que enviamos a';
      const destino=nodo('strong','cuentaCorreoDestino',texto(estado.correo));descripcion.append(' ',destino);
      const f=nodo('form','cuentaFormulario'),codigo=campo({etiqueta:'Código de acceso',nombre:'codigo',autocomplete:'one-time-code',maximo:6,minimo:6});
      codigo.i.inputMode='numeric';codigo.i.pattern='[0-9]{6}';codigo.i.autocapitalize='none';codigo.i.placeholder='000000';codigo.i.classList.add('cuentaCodigo');
      codigo.i.addEventListener('input',()=>{codigo.i.value=codigo.i.value.replace(/[^0-9]/g,'').slice(0,6);borrador.codigo=codigo.i.value;});
      const tiempo=nodo('p','cuentaAyuda cuentaVencimiento');tiempo.setAttribute('aria-live','off');
      const confirmar=boton(estado.ocupado?'Comprobando…':'Confirmar código',()=>{},'','confirmar-codigo');confirmar.type='submit';confirmar.onclick=null;confirmar.dataset.codigoConfirmar='';
      f.onsubmit=e=>{e.preventDefault();if(f.reportValidity()&&!confirmar.disabled)void accion(()=>modelo.verificar(borrador.codigo));};
      const reenviar=boton('Reenviar código',()=>{borrador.codigo='';return modelo.reenviar();},'cuentaBotonSecundario','reenviar');reenviar.dataset.reenviar='';
      f.append(codigo.l,tiempo,acciones(confirmar,reenviar,boton('Cambiar correo',()=>modelo.cambiarCorreo(),'cuentaEnlace','cambiar-correo')));contenido.appendChild(f);actualizarReloj();
    }
    function pantallaVincular(){
      titulo.textContent='Tu historia, a salvo';descripcion.textContent='Encontramos progreso en este dispositivo. Guárdalo en tu cuenta para llevarlo contigo.';
      contenido.append(resumen(estado.local,'EN ESTE DISPOSITIVO'),nodo('p','cuentaAyuda','Tus cartas, sobres y avance de campaña se conservarán juntos.'),acciones(boton(estado.ocupado?'Guardando tu aventura…':'Guardar mi progreso',()=>modelo.resolverProgreso('local'),'','vincular'),regresar()));
    }
    function pantallaRecuperar(){
      titulo.textContent='Tu aventura te espera';descripcion.textContent='Encontramos tu progreso en la cuenta. Recupéralo para continuar en este dispositivo.';
      contenido.append(resumen(estado.nube,'EN TU CUENTA'),acciones(boton(estado.ocupado?'Recuperando…':'Recuperar mi progreso',()=>modelo.resolverProgreso('nube'),'','recuperar'),regresar()));
    }
    function pantallaConflicto(){
      titulo.textContent='Elige la historia que continúa';descripcion.textContent='Hay un progreso diferente en cada lugar. Elige cuál quieres usar; conservaremos una copia del otro.';
      const opciones=nodo('fieldset','cuentaOpciones');opciones.appendChild(nodo('legend','cuentaSoloLectores','Progreso que quieres conservar como activo'));
      for(const [id,etiqueta,datos]of [['local','Este dispositivo',estado.local],['nube','Tu cuenta',estado.nube]]){
        const l=nodo('label','cuentaOpcion'),radio=nodo('input','cuentaRadio');radio.type='radio';radio.name=prefijo+'progreso';radio.value=id;radio.checked=eleccion===id;radio.disabled=!!estado.ocupado;radio.dataset.foco='elegir-'+id;
        const cab=nodo('span','cuentaOpcionCabecera');cab.append(radio,nodo('span','',etiqueta));
        l.dataset.elegida=String(eleccion===id);l.append(cab,resumen(datos,id==='local'?'GUARDADO AQUÍ':'GUARDADO EN LA NUBE'));
        radio.onchange=()=>{eleccion=id;confirmarLocal=false;pintar(estado);};opciones.appendChild(l);
      }
      contenido.appendChild(opciones);
      if(confirmarLocal){
        const confirmar=nodo('div','cuentaConfirmacion');confirmar.setAttribute('role','group');confirmar.setAttribute('aria-labelledby',prefijo+'confirmacion');
        const h=nodo('h2','','¿Usar el progreso de este dispositivo?');h.id=prefijo+'confirmacion';
        confirmar.append(h,nodo('p','','Este será el progreso activo de tu cuenta. El anterior quedará guardado como respaldo.'),acciones(boton(estado.ocupado?'Guardando…':'Confirmar y guardar',()=>modelo.resolverProgreso('local'),'','confirmar-local'),boton('Revisar elección',()=>{confirmarLocal=false;pintar(estado);},'cuentaBotonSecundario','revisar')));contenido.appendChild(confirmar);
      }else{
        const usar=boton(estado.ocupado?'Recuperando tu aventura…':'Continuar con este progreso',()=>{
          if(eleccion==='local'){confirmarLocal=true;pintar(estado);contenido.querySelector('[data-foco="confirmar-local"]')?.focus();}
          else if(eleccion==='nube')return modelo.resolverProgreso('nube');
        },'','resolver');usar.disabled=!!estado.ocupado||!eleccion;contenido.appendChild(acciones(usar));
      }
    }
    function pantallaPerfil(){
      titulo.textContent=texto(estado.sesion?.nombre)||texto(estado.nombre)||'Tu cuenta';descripcion.textContent=texto(estado.sesion?.correo)||texto(estado.correo);descripcion.classList.add('cuentaCorreoDestino');
      const tipo=estado.sinConexion||estado.guardado==='sinConexion'?'sinConexion':estado.guardado==='pendiente'?'pendiente':'guardado';
      const estadoGuardado=nodo('div','cuentaGuardado');estadoGuardado.dataset.estado=tipo;estadoGuardado.setAttribute('role','status');
      estadoGuardado.append(nodo('span','cuentaLuz'),nodo('span','',tipo==='sinConexion'?'Guardado en este dispositivo':tipo==='pendiente'?'Pendiente de sincronizar':estado.nube?'Guardado en tu cuenta':'Conectado'));contenido.appendChild(estadoGuardado);
      contenido.appendChild(resumen(estado.local||estado.nube,'TU PROGRESO'));
      if(tipo!=='guardado')contenido.appendChild(nodo('p','cuentaAyuda',tipo==='sinConexion'?'Sin conexión. Puedes seguir jugando con tu avance local. La sincronización se reintentará al volver internet.':'Puedes seguir jugando. Tu avance permanece en este dispositivo hasta que la cuenta confirme el guardado.'));
      contenido.appendChild(acciones(regresar(),tipo==='pendiente'&&typeof onGuardar==='function'?boton('Sincronizar ahora',onGuardar,'cuentaBotonSecundario','guardar'):null,boton('Cerrar sesión',()=>modelo.cerrarSesion(),'cuentaEnlace','cerrar-sesion')));
    }
    function pantallaInvitado(){
      titulo.textContent='La aventura sigue';descripcion.textContent='Puedes jugar sin cuenta. Tu progreso se guarda en este dispositivo.';
      contenido.append(resumen(estado.local,'EN ESTE DISPOSITIVO'),acciones(boton('Proteger mi progreso',()=>modelo.preparar('crear'),'','proteger'),regresar()));
    }
    function actualizarReloj(){
      if(!vivo||estado.pantalla!=='codigo')return;
      const ahora=Date.now(),reenvio=Math.max(0,Math.ceil((Number(estado.desafio?.reenvioEn)-ahora)/1000)||0),vence=Math.max(0,Math.ceil((Number(estado.desafio?.vence)-ahora)/1000)||0);
      const reloj=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
      const reenviar=contenido.querySelector('[data-reenviar]');if(reenviar){reenviar.textContent=reenvio?'Reenviar en '+reloj(reenvio):'Reenviar código';reenviar.disabled=!!estado.ocupado||reenvio>0;}
      const tiempo=contenido.querySelector('.cuentaVencimiento');if(tiempo)tiempo.textContent=vence?'Tu código vence en '+reloj(vence)+'.':'El código venció. Pide uno nuevo para continuar.';
      const confirmar=contenido.querySelector('[data-codigo-confirmar]');if(confirmar)confirmar.disabled=!!estado.ocupado||vence===0;
    }
    function pintar(nuevo){
      if(!vivo)return;
      const foco=document.activeElement,claveFoco=panel.contains(foco)?foco.dataset?.foco:null;let seleccion=null;
      try{if(claveFoco&&Number.isInteger(foco.selectionStart))seleccion=[foco.selectionStart,foco.selectionEnd];}catch(_){}
      if(claveFoco){enfoquePendiente=claveFoco;seleccionPendiente=seleccion;}
      const teniaSesion=!!estado.sesion;estado=nuevo||modelo.ver();
      if(teniaSesion&&!estado.sesion){borrador={correo:'',nombre:'',codigo:''};enfoquePendiente=null;seleccionPendiente=null;}
      const pantalla=estado.pantalla||'inicio',clave=pantalla+':'+(estado.intencion||'entrar'),cambio=clave!==claveAnterior;
      if(cambio){errorLocal='';if(pantalla==='inicio'){borrador.correo=texto(estado.correo)||borrador.correo;borrador.nombre=texto(estado.nombre)||borrador.nombre;}if(pantalla!==pantallaAnterior){eleccion='';confirmarLocal=false;}}
      const idCodigo=texto(estado.correo)+':'+String(estado.desafio?.vence||'');if(pantalla==='codigo'&&idCodigo!==ultimoCodigo){borrador.codigo='';ultimoCodigo=idCodigo;}
      panel.dataset.pantalla=pantalla;panel.dataset.obligatoria=String(!!estado.obligatoria);panel.dataset.ocupado=String(!!estado.ocupado);panel.setAttribute('aria-busy',String(!!estado.ocupado));descripcion.classList.remove('cuentaCorreoDestino');
      const desplazamiento=contenido.scrollTop;contenido.replaceChildren();
      const vistas={inicio:pantallaInicio,codigo:pantallaCodigo,vincular:pantallaVincular,recuperar:pantallaRecuperar,conflicto:pantallaConflicto,perfil:pantallaPerfil,invitado:pantallaInvitado};
      (vistas[pantalla]||pantallaInicio)();pintarMensajes();const cerrar=panel.querySelector('.cuentaCerrar');if(cerrar){cerrar.hidden=estado.puedeSalir===false;cerrar.disabled=!puedeSalir();}
      if(!cambio&&enfoquePendiente){const destino=panel.querySelector('[data-foco="'+enfoquePendiente+'"]');if(destino&&!destino.disabled){destino.focus({preventScroll:true});if(seleccionPendiente&&destino.setSelectionRange)try{destino.setSelectionRange(...seleccionPendiente);}catch(_){}}contenido.scrollTop=desplazamiento;}
      else if(cambio){
        enfoquePendiente=null;seleccionPendiente=null;contenido.scrollTop=0;
        const cambioDePestana=pantalla==='inicio'&&pantallaAnterior==='inicio';
        queueMicrotask(()=>{if(vivo){const destino=cambioDePestana?contenido.querySelector('[role="tab"][aria-selected="true"]'):titulo;destino?.focus({preventScroll:true});}});
      }
      claveAnterior=clave;pantallaAnterior=pantalla;
    }
    function ajustar(){
      if(!vivo)return;const visor=window.visualViewport,alto=visor?.height||window.innerHeight,top=raiz.getBoundingClientRect().top-(visor?.offsetTop||0);
      panel.style.setProperty('--cuenta-viewport-alto',alto+'px');raiz.style.setProperty('--cuenta-alto-disponible',Math.max(120,alto-Math.max(0,top))+'px');
    }
    function tecla(e){if(e.key==='Escape'){if(estado.puedeSalir===false)e.preventDefault();if(estado.ocupado)return;if(confirmarLocal){e.preventDefault();confirmarLocal=false;pintar(estado);}else if(typeof onSalir==='function'&&puedeSalir()){e.preventDefault();onSalir();}}}
    panel.addEventListener('keydown',tecla);window.addEventListener('resize',ajustar);window.visualViewport?.addEventListener('resize',ajustar);window.visualViewport?.addEventListener('scroll',ajustar);ajustar();
    const medidas=typeof ResizeObserver==='function'?new ResizeObserver(ajustar):null;medidas?.observe(raiz);
    cancelarSuscripcion=modelo.suscribir(pintar)||(()=>{});const reloj=setInterval(actualizarReloj,1000);
    return Object.freeze({destruir(){
      if(!vivo)return;vivo=false;cancelarSuscripcion();clearInterval(reloj);medidas?.disconnect();window.removeEventListener('resize',ajustar);window.visualViewport?.removeEventListener('resize',ajustar);window.visualViewport?.removeEventListener('scroll',ajustar);panel.removeEventListener('keydown',tecla);panel.remove();
      if(!teniaClase)raiz.classList.remove('cuentaAnfitrion');if(altoAnterior)raiz.style.setProperty('--cuenta-alto-disponible',altoAnterior);else raiz.style.removeProperty('--cuenta-alto-disponible');
      if(anterior?.isConnected&&typeof anterior.focus==='function')anterior.focus({preventScroll:true});
    }});
  }
  window.CAOZ_CUENTA_UI=Object.freeze({montar});
})();

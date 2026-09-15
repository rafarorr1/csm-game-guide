/* Flujo de cuentas compartido por el juego y su laboratorio. El transporte se inyecta. */
(function(global){
  'use strict';
  const copia=v=>v==null?v:JSON.parse(JSON.stringify(v));
  function resumen(v){
    if(!v||typeof v!=='object')return null;
    const numero=k=>Math.max(0,Math.min(100000,Math.trunc(Number(v[k])||0)));
    return {personaje:String(v.personaje||'Viajero').slice(0,40),mazo:String(v.mazo||'Sin elegir').slice(0,40),
      rivales:Math.min(6,numero('rivales')),etapas:6,foils:numero('foils'),doradas:numero('doradas'),sobres:numero('sobres'),fecha:String(v.fecha||'').slice(0,60)};
  }
  const mensajes={CAMBIO_CUENTA:'Elige el progreso de esta cuenta antes de continuar. El avance de la cuenta anterior se conservará por separado.',PENDIENTE:'Tu último progreso todavía no está guardado en la cuenta. Espera o revisa la conexión antes de cerrar sesión.',SIN_CONEXION:'No hay conexión. Conservamos tu progreso aquí; vuelve a intentarlo cuando tengas internet.',
    CADUCADO:'Este código caducó. Pide uno nuevo.',CODIGO_INVALIDO:'Ese código no coincide. Revísalo e inténtalo otra vez.',
    INTENTOS:'Se agotaron los intentos de este código. Pide uno nuevo.',ESPERA:'Espera un minuto desde el último envío antes de pedir otro código.',
    ALMACENAMIENTO:'No pudimos guardar en este dispositivo. Conservamos la copia en tu cuenta; libera espacio e inténtalo de nuevo.',NO_DISPONIBLE:'El acceso por correo no está disponible en este momento. Puedes seguir jugando sin cuenta.',SESION:'Tu sesión terminó. Vuelve a entrar para guardar tu progreso.',CONFLICTO:'Tu cuenta tiene un progreso más reciente. Revisa cuál quieres continuar.'};
  function crear({servicio,progresoLocal=null,reloj=Date.now,resumir=resumen,sesionVinculada=()=>false,confirmarRecuperacion=false,obligatoria=false}={}){
    if(!servicio)throw Error('Falta el servicio de cuentas.');
    let estado={pantalla:'inicio',intencion:'crear',ocupado:false,error:'',aviso:'',correo:'',nombre:'',desafio:null,
      sesion:null,local:resumir(progresoLocal),nube:null,guardado:'guardado',sinConexion:false};
    let revision=0,destruido=false,generacion=0,subida=null,copiaLocal=copia(progresoLocal),copiaNube=null,requiereAislar=false,vinculoConfirmado=false;
    const suscriptores=new Set();
    const ver=()=>{const acceso=!!estado.sesion&&estado.pantalla==='perfil'&&!requiereAislar&&(!obligatoria||vinculoConfirmado);return copia({...estado,obligatoria:!!obligatoria,acceso,puedeSalir:!obligatoria||acceso});};
    function mensajeError(codigo){
      if(obligatoria&&codigo==='NO_DISPONIBLE')return 'El acceso por correo no está disponible en este momento. Inténtalo de nuevo en unos minutos.';
      if(obligatoria&&codigo==='ALMACENAMIENTO')return 'No pudimos guardar en este dispositivo. Libera espacio y vuelve a intentarlo antes de cerrar el juego.';
      if(obligatoria&&codigo==='SIN_CONEXION'&&!estado.sesion)return 'Conéctate a internet para entrar con tu correo por primera vez en este dispositivo. Después podrás jugar sin conexión en la app instalada.';
      return mensajes[codigo]||'No se pudo completar. Tu progreso no se ha eliminado; inténtalo de nuevo.';
    }
    const avisar=()=>{if(!destruido)for(const fn of suscriptores)fn(ver());};
    const poner=campos=>{Object.assign(estado,campos);avisar();};
    const libre=()=>!destruido&&!estado.ocupado;
    async function ejecutar(fn){
      if(!libre())return false;const turno=++generacion;poner({ocupado:true,error:'',aviso:''});
      try{await fn(()=>!destruido&&turno===generacion);return !destruido&&turno===generacion;}
      catch(e){if(!destruido&&turno===generacion){
        if(e.codigo==='CONFLICTO'){revision=e.revision;copiaNube=copia(e.progreso);estado.nube=resumir(e.progreso);estado.pantalla='conflicto';subida=null;}
        if(e.codigo==='SESION'){estado.sesion=null;estado.desafio=null;estado.pantalla='inicio';estado.intencion='entrar';subida=null;vinculoConfirmado=false;}
        if(e.codigo==='SIN_CONEXION'){estado.guardado='sinConexion';estado.sinConexion=true;}
        poner({error:mensajeError(e.codigo)});
      }return false;}
      finally{if(!destruido&&turno===generacion)poner({ocupado:false});}
    }
    function recibirSesion(r){
      revision=Number(r.revision)||0;subida=null;copiaNube=copia(r.progreso);requiereAislar=!!r.requiereAislar;
      if(Object.prototype.hasOwnProperty.call(r,'localDisponible')){copiaLocal=copia(r.localDisponible);estado.local=resumir(copiaLocal);}
      const nube=resumir(r.progreso),vinculada=!!sesionVinculada(r);
      vinculoConfirmado=vinculada&&!requiereAislar;
      // Sin red sólo sirve una identidad que ya se vinculó en este dispositivo.
      // Un nombre o un perfil vacío nunca sustituyen la verificación por correo.
      if(obligatoria&&r.sinConexion&&!vinculoConfirmado){
        poner({sesion:null,desafio:null,pantalla:'inicio',intencion:'entrar'});
        throw Object.assign(Error('SIN_CONEXION'),{codigo:'SIN_CONEXION'});
      }
      const pantalla=vinculada?'perfil':estado.local?(nube?'conflicto':'vincular'):
        nube&&confirmarRecuperacion?'recuperar':'perfil';
      poner({sesion:copia(r.sesion),desafio:null,nube,pantalla,sinConexion:!!r.sinConexion,guardado:r.sinConexion?'sinConexion':r.guardado==='pendiente'?'pendiente':'guardado'});
    }
    function restaurar(){
      if(!libre()||typeof servicio.sesion!=='function'||!['inicio','perfil','invitado'].includes(estado.pantalla))return Promise.resolve(false);
      return ejecutar(async vigente=>{
        const r=await servicio.sesion();if(!vigente())return;
        if(r?.sesion)recibirSesion(r);
        else{revision=0;copiaNube=null;subida=null;vinculoConfirmado=false;poner({sesion:null,nube:null,pantalla:estado.pantalla==='invitado'?'invitado':'inicio',guardado:'guardado',sinConexion:false});}
      });
    }
    function confirmarVinculoLocal(){if(!estado.sesion||destruido)return false;if(vinculoConfirmado&&!requiereAislar)return true;requiereAislar=false;vinculoConfirmado=true;avisar();return true;}
    function actualizarLocal(progreso){
      if(!libre()||subida||requiereAislar&&estado.sesion)return false;copiaLocal=copia(progreso);poner({local:resumir(progreso)});return true;
    }
    function actualizarGuardado(valor={}){
      if(destruido||estado.ocupado||!estado.sesion)return false;
      if(valor.guardado==='conflicto'&&valor.conflicto){
        revision=Number(valor.conflicto.revision)||0;copiaNube=copia(valor.conflicto.progreso);subida=null;
        poner({pantalla:'conflicto',nube:resumir(copiaNube),guardado:'pendiente',error:mensajes.CONFLICTO});return true;
      }
      if(valor.guardado==='sesion'){
        vinculoConfirmado=false;
        poner({sesion:null,nube:null,desafio:null,pantalla:'inicio',intencion:'entrar',error:mensajes.SESION});return true;
      }
      if(['guardado','pendiente','sinConexion'].includes(valor.guardado)){
        if(valor.progreso!==undefined)copiaNube=copia(valor.progreso);
        if(Number.isInteger(valor.revision))revision=valor.revision;
        poner({guardado:valor.guardado,sinConexion:valor.guardado==='sinConexion'||valor.guardado==='pendiente'&&estado.sinConexion,nube:resumir(copiaNube),error:valor.error?mensajeError(valor.error.codigo):''});return true;
      }
      return false;
    }
    function preparar(intencion){
      if(!libre()||estado.sesion||!['crear','entrar'].includes(intencion))return false;
      poner({pantalla:'inicio',intencion,desafio:null,error:'',aviso:''});return true;
    }
    function solicitar({correo,nombre='',intencion=estado.intencion}={}){
      if(!libre()||estado.sesion||estado.pantalla!=='inicio')return Promise.resolve(false);
      correo=String(correo||'').trim().toLowerCase();nombre=String(nombre||'').trim();
      if(!['entrar','crear'].includes(intencion))return Promise.resolve(false);
      if(correo.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(correo)){poner({error:'Escribe un correo válido.'});return Promise.resolve(false);}
      if(intencion==='crear'&&(nombre.length<2||nombre.length>40)){poner({error:'Tu nombre debe tener entre 2 y 40 caracteres.'});return Promise.resolve(false);}
      estado.correo=correo;estado.nombre=nombre;estado.intencion=intencion;
      return ejecutar(async vigente=>{const r=await servicio.solicitarCodigo({correo,nombre,intencion});if(vigente())poner({pantalla:'codigo',desafio:copia(r),guardado:'guardado'});});
    }
    function verificar(codigo){
      if(!libre()||estado.pantalla!=='codigo'||!estado.desafio)return Promise.resolve(false);
      codigo=String(codigo||'').replace(/\s/g,'');
      if(!/^\d{6}$/.test(codigo)){poner({error:'Escribe los seis números del código.'});return Promise.resolve(false);}
      if(reloj()>=estado.desafio.vence){poner({error:mensajes.CADUCADO});return Promise.resolve(false);}
      return ejecutar(async vigente=>{
        const r=await servicio.verificarCodigo({solicitud:estado.desafio.id,codigo});if(!vigente())return;
        recibirSesion(r);
      });
    }
    function reenviar(){
      if(!libre()||estado.pantalla!=='codigo'||!estado.desafio)return Promise.resolve(false);
      if(reloj()<estado.desafio.reenvioEn){poner({error:mensajes.ESPERA});return Promise.resolve(false);}
      return ejecutar(async vigente=>{const r=await servicio.solicitarCodigo({correo:estado.correo,nombre:estado.nombre,intencion:estado.intencion});if(vigente())poner({desafio:copia(r),aviso:'Tu nuevo código está listo. El anterior ya no funciona.'});});
    }
    function cambiarCorreo(){if(!libre()||estado.sesion)return false;poner({pantalla:'inicio',desafio:null,error:'',aviso:''});return true;}
    function resolverProgreso(origen){
      if(!libre()||!estado.sesion||!['vincular','conflicto','recuperar'].includes(estado.pantalla)||!['local','nube'].includes(origen))return Promise.resolve(false);
      const elegido=origen==='local'?copiaLocal:copiaNube;if(!elegido)return Promise.resolve(false);
      // La misma operación se conserva al reintentar una respuesta perdida.
      // El servidor real deberá guardar respaldos y resolver la revisión atómicamente.
      if(!subida||subida.origen!==origen)subida={origen,operacion:global.crypto.randomUUID(),revision,
        progreso:copia(elegido),respaldoLocal:copia(copiaLocal)};
      const solicitud=copia(subida);
      return ejecutar(async vigente=>{
        const r=await servicio.vincularProgreso(solicitud);if(!vigente())return;
        revision=r.revision;subida=null;copiaNube=copia(r.progreso);copiaLocal=null;requiereAislar=false;vinculoConfirmado=true;
        poner({nube:resumir(r.progreso),local:null,pantalla:'perfil',guardado:'guardado',sinConexion:false,aviso:'Tu progreso está guardado en tu cuenta.'});
      });
    }
    function cerrarSesion(){
      if(!libre()||!estado.sesion)return Promise.resolve(false);
      return ejecutar(async vigente=>{await servicio.cerrarSesion();if(vigente()){revision=0;subida=null;copiaNube=null;copiaLocal=null;requiereAislar=false;poner({sesion:null,nube:null,local:null,pantalla:'inicio',intencion:'entrar',correo:'',nombre:'',desafio:null,guardado:'guardado',sinConexion:false,aviso:'Sesión cerrada. Tu progreso sigue en tu cuenta.'});vinculoConfirmado=false;}});
    }
    function invitado(){if(obligatoria||!libre()||estado.sesion)return false;poner({pantalla:'invitado',desafio:null,error:'',aviso:''});return true;}
    return Object.freeze({ver,preparar,solicitar,verificar,reenviar,cambiarCorreo,resolverProgreso,cerrarSesion,invitado,restaurar,actualizarLocal,actualizarGuardado,confirmarVinculoLocal,
      datosSesion(){return copia({sesion:estado.sesion,progreso:copiaNube,revision,requiereAislar,vinculado:vinculoConfirmado,sinConexion:estado.sinConexion});},
      suscribir(fn){if(typeof fn!=='function'||destruido)return()=>{};suscriptores.add(fn);fn(ver());return()=>suscriptores.delete(fn);},
      destruir(){destruido=true;generacion++;suscriptores.clear();}});
  }
  global.CAOZ_CUENTA_MODELO=Object.freeze({crear,resumen});
})(globalThis);

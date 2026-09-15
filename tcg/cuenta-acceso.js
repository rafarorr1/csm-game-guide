/* Coordina acceso y progreso. El juego y la revisión aislada usan este mismo
   flujo; almacenamiento y transporte se inyectan, sin simular cuentas aquí. */
(function(global){
  'use strict';
  function crear({progreso,servicio,storage=global.localStorage,eventos=global,onImportar=()=>{},puedeVincular=()=>true,resumir}={}){
    if(!progreso||!servicio)throw Error('Faltan las cuentas para entrar al Domo.');
    let identidad='',actualizando=false,bloqueado=false,destruido=false,iniciando=false;
    const oyentes=new Set();
    const sincronizador=global.CAOZ_CUENTA_SERVICIO.sincronizador({servicio,progreso,storage,eventos});
    async function guardar(){
      if(!identidad||bloqueado||destruido)return false;
      const ok=await sincronizador.guardar();return ok!==false&&sincronizador.estado().guardado==='guardado';
    }
    const protegido=Object.freeze({...servicio,async cerrarSesion(){
      if(progreso.vinculado()&&!await guardar()){
        const s=sincronizador.estado();
        if(s.guardado==='sesion')throw Object.assign(Error('SESION'),{codigo:'SESION'});
        if(s.guardado==='conflicto')throw Object.assign(Error('CONFLICTO'),{codigo:'CONFLICTO',...s.conflicto});
        throw Object.assign(Error('PENDIENTE'),{codigo:'PENDIENTE'});
      }
      await servicio.cerrarSesion();
    }});
    const modelo=global.CAOZ_CUENTA_MODELO.crear({servicio:protegido,obligatoria:true,
      progresoLocal:progreso.capturar(),resumir:resumir||progreso.resumir,
      confirmarRecuperacion:true,sesionVinculada:r=>r.vinculado===true});
    function puedeJugar(){
      const s=modelo.ver();return !bloqueado&&!destruido&&s.acceso===true&&
        identidad===s.sesion?.id&&progreso.vinculado()?.cuentaId===identidad&&servicio.identidad()?.id===identidad;
    }
    function estado(){return {...modelo.ver(),acceso:puedeJugar()};}
    function avisar(){if(!destruido)for(const fn of oyentes)fn(estado());}
    function detener(){if(identidad){identidad='';sincronizador.desvincular();}}
    function recibir(s){
      if(destruido||actualizando)return;
      if(bloqueado||s.ocupado){avisar();return;}
      if(!s.sesion||s.pantalla!=='perfil'){detener();avisar();return;}
      let vinculo;
      try{
        actualizando=true;
        const datos=modelo.datosSesion();vinculo=progreso.vinculado();
        if(!vinculo||vinculo.cuentaId!==s.sesion.id){
          if(!puedeVincular()||datos.progreso||progreso.capturar()&&!datos.requiereAislar)return;
          if(datos.requiereAislar)progreso.iniciarVacioParaCuenta({cuentaId:s.sesion.id,revision:datos.revision});
          else progreso.vincularVacio({cuentaId:s.sesion.id,revision:datos.revision});
          vinculo=progreso.vinculado();onImportar();
        }
        if(vinculo?.cuentaId!==s.sesion.id)return;
        // El perfil vacío aún no puede salir si Safari rechazó escribir el
        // vínculo. Sólo se abre el juego después de esta comprobación real.
        modelo.confirmarVinculoLocal();
        if(identidad!==s.sesion.id){
          identidad=s.sesion.id;
          if(!sincronizador.vincular(modelo.datosSesion()))identidad='';
        }
      }catch(e){modelo.actualizarGuardado({guardado:'pendiente',error:{codigo:e.codigo||'ALMACENAMIENTO'}});}
      finally{actualizando=false;avisar();}
    }
    const soltarModelo=modelo.suscribir(recibir);
    const soltarGuardado=sincronizador.suscribir(s=>{
      if(!identidad||actualizando||modelo.ver().ocupado||destruido)return;
      actualizando=true;
      try{modelo.actualizarLocal(progreso.capturar());modelo.actualizarGuardado(s);}
      finally{actualizando=false;}
      if(['conflicto','sesion'].includes(s.guardado))detener();
      avisar();
    });
    async function iniciar(){
      if(iniciando||destruido||bloqueado)return false;iniciando=true;
      try{modelo.actualizarLocal(progreso.capturar());await modelo.restaurar();recibir(modelo.ver());return puedeJugar();}
      finally{iniciando=false;}
    }
    const volver=()=>{if(!identidad)void iniciar();};
    const sinRed=()=>{if(!modelo.ver().ocupado)void iniciar();};
    for(const e of ['online','focus','pageshow'])eventos.addEventListener?.(e,volver);
    eventos.addEventListener?.('offline',sinRed);
    return Object.freeze({modelo,estado,puedeJugar,iniciar,guardar,
      activarVinculo(){recibir(modelo.ver());},
      bloquear(){bloqueado=true;detener();avisar();},
      suscribir(fn){if(typeof fn!=='function'||destruido)return()=>{};oyentes.add(fn);fn(estado());return()=>oyentes.delete(fn);},
      destruir(){destruido=true;soltarModelo();soltarGuardado();sincronizador.destruir();modelo.destruir();oyentes.clear();
        for(const e of ['online','focus','pageshow'])eventos.removeEventListener?.(e,volver);
        eventos.removeEventListener?.('offline',sinRed);}
    });
  }
  global.CAOZ_CUENTA_ACCESO=Object.freeze({crear});
})(globalThis);

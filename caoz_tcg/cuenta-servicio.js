/* Correo y progreso por la API del mismo origen. La cookie de sesión sólo la
   administra el servidor; ni códigos ni credenciales se guardan en el navegador. */
(function(global){
  'use strict';
  const copia=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const fallo=(codigo,datos={})=>Object.assign(Error(codigo),datos,{codigo});
  const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
  const numero=v=>Number.isSafeInteger(v)&&v>=0;
  function crear({progreso,fetch:peticion=global.fetch?.bind(global),storage=global.localStorage,tiempoLimite=15000}={}){
    if(!progreso||!peticion)throw Error('Falta el adaptador de progreso.');
    let actual=null,revision=0,salidaPendiente=null;
    async function pedir(ruta,datos){
      const abortar=new global.AbortController(),limite=global.setTimeout(()=>abortar.abort(),tiempoLimite);let respuesta;
      // SW254 ya excluía las URLs con test=. Conservamos ese bypass al
      // actualizar una PWA antigua, antes de que tome control el nuevo SW.
      try{respuesta=await peticion('/api/cuenta/'+ruta+'?test=cuenta',{method:datos===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
        headers:{Accept:'application/json',...(datos===undefined?{}:{'Content-Type':'application/json'}),
          ...(['progreso','salir'].includes(ruta)&&actual?{'X-Caoz-Cuenta':actual.id}:{})},
        ...(datos===undefined?{}:{body:JSON.stringify(datos)}),signal:abortar.signal});}
      catch(_){throw fallo('SIN_CONEXION');}finally{global.clearTimeout(limite);}
      let r;try{r=await respuesta.json();}catch(_){throw fallo('SERVIDOR');}
      if(!respuesta.ok){const extras={};if(r?.codigo==='CONFLICTO'&&numero(r.revision))Object.assign(extras,{revision:r.revision,progreso:copia(r.progreso)});
        throw fallo(typeof r?.codigo==='string'?r.codigo:respuesta.status===401?'SESION':'SERVIDOR',extras);}
      return r;
    }
    function comprobarSesion(r){
      if(!r||!numero(r.revision)||r.sesion!==null&&(!uuid(r.sesion?.id)||typeof r.sesion?.nombre!=='string'||typeof r.sesion?.correo!=='string'))throw fallo('SERVIDOR');
      if(r.progreso!==null)global.CAOZ_CUENTA_PROGRESO.validar(r.progreso,progreso.entorno);
      actual=copia(r.sesion);revision=r.revision;const vinculo=progreso.vinculado();
      const base=r.progreso||global.CAOZ_CUENTA_PROGRESO.vacio(progreso.entorno);
      let vinculado=!!actual&&vinculo?.cuentaId===actual.id&&vinculo.revision===revision&&vinculo.huella===global.CAOZ_CUENTA_PROGRESO.huella(base);
      if(!vinculado&&actual&&vinculo?.cuentaId===actual.id){
        let cola;try{cola=JSON.parse(storage.getItem(progreso.claveCola(actual.id))||'null');}catch(_){throw fallo('ALMACENAMIENTO');}
        const p=cola?.cuentaId===actual.id?cola.pendiente:null;
        // Recupera un acuse perdido aun cuando el servidor ya avanzó una
        // revisión. El sincronizador repetirá el mismo ID, sin otra concesión.
        if(p&&uuid(p.operacion)&&p.revision===vinculo.revision&&revision===p.revision+1&&
          global.CAOZ_CUENTA_PROGRESO.huella(base)===global.CAOZ_CUENTA_PROGRESO.huella(p.progreso))vinculado=true;
      }
      const ajena=!!vinculo&&vinculo.cuentaId!==actual?.id;
      const archivado=actual&&!vinculo&&!progreso.capturar()?progreso.archivo(actual.id):null;
      return {...copia(r),vinculado,...(ajena?{requiereAislar:true,localDisponible:null}:
        {localDisponible:archivado?.snapshot||progreso.capturar()})};
    }
    async function sesion(){return comprobarSesion(await pedir('sesion'));}
    async function verificarCodigo(datos){return comprobarSesion(await pedir('verificar',datos));}
    async function guardarRemoto(datos){
      if(!actual)throw fallo('SESION');const id=actual.id;
      if(!datos||!uuid(datos.operacion)||!numero(datos.revision)||!['local','nube'].includes(datos.origen))throw fallo('PROGRESO_INVALIDO');
      if(datos.progreso!==null)global.CAOZ_CUENTA_PROGRESO.validar(datos.progreso,progreso.entorno);
      if(datos.respaldoLocal!=null)global.CAOZ_CUENTA_PROGRESO.validar(datos.respaldoLocal,progreso.entorno);
      const r=await pedir('progreso',datos);if(actual?.id!==id)throw fallo('SESION');
      if(!numero(r?.revision)||r.revision<datos.revision)throw fallo('SERVIDOR');
      if(r.progreso===null)r.progreso=global.CAOZ_CUENTA_PROGRESO.vacio(progreso.entorno);
      global.CAOZ_CUENTA_PROGRESO.validar(r.progreso,progreso.entorno);revision=r.revision;return copia(r);
    }
    async function vincularProgreso(datos){
      if(!actual)throw fallo('SESION');const id=actual.id;
      const r=await guardarRemoto(datos);if(actual?.id!==id)throw fallo('SESION');
      // Si Safari no puede escribir, se informa el error y se conserva el ID
      // de operación en el modelo. Reintentar recibe el mismo acuse del servidor.
      progreso.aplicar(r.progreso,{cuentaId:id,revision:r.revision,permitirVacio:true});
      try{storage.removeItem(progreso.claveCola(id));}catch(_){throw fallo('ALMACENAMIENTO');}
      return r;
    }
    async function cerrarSesion(){
      if(!salidaPendiente){if(!actual)throw fallo('SESION');const id=actual.id;await pedir('salir',{});salidaPendiente=id;}
      // El servidor puede haber revocado la cookie aunque Safari no permita
      // archivar todavía. Reintentar sólo completa la parte local ya autorizada.
      if(progreso.vinculado()?.cuentaId===salidaPendiente)progreso.desvincular();
      if(actual?.id===salidaPendiente){actual=null;revision=0;}salidaPendiente=null;
    }
    return Object.freeze({sesion,obtenerSesion:sesion,solicitarCodigo:datos=>pedir('codigo',datos),verificarCodigo,vincularProgreso,cerrarSesion,
      guardarRemoto,identidad:()=>copia(actual),revision:()=>revision});
  }
  function sincronizador({servicio,progreso,storage=global.localStorage,eventos=global,retraso=750,reintento=15000}={}){
    if(!servicio||!progreso)throw Error('Faltan las cuentas para sincronizar.');
    let cuenta=null,estado={guardado:'guardado',sesion:null,progreso:null,revision:0},ocupado=false,detenido=false,
      conflicto=false,generacion=0,desobservar=null,temporizador=null,repetir=null;
    const oyentes=new Set(),huella=global.CAOZ_CUENTA_PROGRESO.huella;
    function avisar(campos){Object.assign(estado,campos);for(const fn of oyentes)fn(copia(estado));}
    function leerCola(){
      if(!cuenta)return null;let texto;try{texto=storage.getItem(progreso.claveCola(cuenta.id));}catch(_){throw fallo('ALMACENAMIENTO');}
      if(texto===null)return null;let c;try{c=JSON.parse(texto);}catch(_){throw fallo('PROGRESO_DANADO');}
      if(c.version!==1||c.cuentaId!==cuenta.id||c.pendiente&&(!uuid(c.pendiente.operacion)||!numero(c.pendiente.revision)))throw fallo('PROGRESO_DANADO');
      if(c.pendiente)global.CAOZ_CUENTA_PROGRESO.validar(c.pendiente.progreso,progreso.entorno);
      if(c.siguiente)global.CAOZ_CUENTA_PROGRESO.validar(c.siguiente,progreso.entorno);
      return c;
    }
    function escribirCola(c){try{const clave=progreso.claveCola(cuenta.id),texto=JSON.stringify(c);storage.setItem(clave,texto);if(storage.getItem(clave)!==texto)throw Error();}catch(_){throw fallo('ALMACENAMIENTO');}}
    const actual=()=>progreso.capturar()||global.CAOZ_CUENTA_PROGRESO.vacio(progreso.entorno);
    function comprobarVinculo(){const v=progreso.vinculado();if(!cuenta||v?.cuentaId!==cuenta.id||servicio.identidad()?.id!==cuenta.id)throw fallo('SESION');return v;}
    function encolar(){
      const vinculo=comprobarVinculo(),snapshot=actual(),c=leerCola()||{version:1,cuentaId:cuenta.id,pendiente:null,siguiente:null};
      if(c.pendiente){
        c.siguiente=huella(snapshot)===huella(c.pendiente.progreso)?null:snapshot;
      }else if(huella(snapshot)!==vinculo.huella){c.pendiente={origen:'local',operacion:global.crypto.randomUUID(),revision:vinculo.revision,progreso:snapshot,respaldoLocal:null};c.siguiente=null;}
      escribirCola(c);return c;
    }
    function programar(){if(detenido||!cuenta)return;global.clearTimeout(temporizador);temporizador=global.setTimeout(()=>guardar(),retraso);}
    function alCambio(snapshot,error){if(error){avisar({guardado:'pendiente',error});return;}try{encolar();avisar({guardado:'pendiente',error:null});programar();}catch(e){tratar(e);}}
    function tratar(e){
      const error={codigo:e.codigo||'SERVIDOR'};
      if(e.codigo==='CONFLICTO'){conflicto=true;avisar({guardado:'conflicto',conflicto:{progreso:copia(e.progreso),revision:e.revision},error});}
      else if(e.codigo==='SESION'){avisar({guardado:'sesion',error});}
      else {avisar({guardado:e.codigo==='SIN_CONEXION'?'sinConexion':'pendiente',error});
        if(!detenido&&cuenta&&reintento>0){global.clearTimeout(repetir);repetir=global.setTimeout(()=>guardar(),reintento);}}
    }
    async function guardar(){
      if(detenido||!cuenta||conflicto)return false;
      let c;try{c=encolar();}catch(e){tratar(e);return false;}
      if(ocupado)return false;
      if(!c.pendiente){avisar({guardado:'guardado',error:null});return true;}
      ocupado=true;const turno=generacion,id=cuenta.id;avisar({guardado:'pendiente',error:null});
      try{
        // La solicitud se escribió antes de tocar la red. Tras cerrar Safari
        // o perder el acuse, el UUID y payload son exactamente los anteriores.
        const enviado=copia(c.pendiente),r=await servicio.guardarRemoto(enviado);
        if(detenido||turno!==generacion||cuenta?.id!==id)return false;
        comprobarVinculo();
        // Una segunda pestaña pudo resolver un conflicto mientras viajaba la
        // respuesta. Nunca borrar su operación ni rebajar su revisión.
        const vigente=leerCola();if(vigente?.pendiente?.operacion!==enviado.operacion)throw fallo('CONFLICTO',{progreso:r.progreso,revision:r.revision});
        progreso.confirmar(r.progreso,{cuentaId:id,revision:r.revision});
        const cambiado=actual();escribirCola({version:1,cuentaId:id,pendiente:null,siguiente:null});
        if(huella(cambiado)!==huella(r.progreso)){encolar();programar();avisar({guardado:'pendiente',progreso:r.progreso,revision:r.revision,error:null});}
        else avisar({guardado:'guardado',progreso:r.progreso,revision:r.revision,error:null});
        return true;
      }catch(e){if(!detenido&&turno===generacion)tratar(e);return false;}
      finally{if(turno===generacion)ocupado=false;}
    }
    async function verificar(){
      if(detenido||!cuenta)return false;const id=cuenta.id,turno=generacion;
      try{const r=await servicio.sesion();if(turno!==generacion||cuenta?.id!==id)return false;
        if(r.sesion?.id!==id)throw fallo('SESION');const v=comprobarVinculo();
        // Un acuse perdido se resuelve repitiendo la operación, no confundiendo
        // nuestra propia revisión ya guardada con la de otro dispositivo.
        if(leerCola()?.pendiente)return guardar();
        if(r.revision!==v.revision||!r.vinculado)throw fallo('CONFLICTO',{progreso:r.progreso,revision:r.revision});
        return guardar();
      }catch(e){if(turno===generacion)tratar(e);return false;}
    }
    const alVolver=()=>verificar();
    function desvincular(){generacion++;cuenta=null;ocupado=false;conflicto=false;desobservar?.();desobservar=null;
      global.clearTimeout(temporizador);global.clearTimeout(repetir);
      for(const e of ['online','focus','pageshow'])eventos.removeEventListener?.(e,alVolver);
      avisar({guardado:'guardado',sesion:null,progreso:null,revision:0,conflicto:null,error:null});}
    function vincular(r){
      desvincular();if(detenido||!r?.sesion)return false;
      const v=progreso.vinculado();if(v?.cuentaId!==r.sesion.id||servicio.identidad()?.id!==r.sesion.id)return false;
      cuenta=copia(r.sesion);avisar({sesion:cuenta,revision:v.revision,progreso:copia(v.base),conflicto:null,error:null});
      desobservar=progreso.observar(alCambio);
      for(const e of ['online','focus','pageshow'])eventos.addEventListener?.(e,alVolver);
      // Capturar y dejar pendiente no equivale a autorizar un primer vínculo:
      // sólo se llega aquí con la marca de propiedad escrita tras la elección.
      programar();return true;
    }
    return Object.freeze({vincular,desvincular,guardar,verificar,estado:()=>copia(estado),
      suscribir(fn){if(typeof fn!=='function'||detenido)return()=>{};oyentes.add(fn);fn(copia(estado));return()=>oyentes.delete(fn);},
      destruir(){desvincular();detenido=true;oyentes.clear();}});
  }
  global.CAOZ_CUENTA_SERVICIO=Object.freeze({crear,sincronizador});
})(globalThis);

/* Adaptador del progreso real. Nunca combina inventarios: conserva el JSON
   completo, recibos y aperturas ya sorteadas. No lee claves de los estudios. */
(function(global){
  'use strict';
  const campos=['campana','borrador','logros','coleccion','premiosDomo','records','nombre'];
  const copia=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const objeto=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const fallo=(codigo,mensaje)=>Object.assign(Error(mensaje||codigo),{codigo});
  const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
  function ordenar(v){if(Array.isArray(v))return v.map(ordenar);if(objeto(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordenar(v[k])]));return v;}
  // Es una comparación exacta, no una prueba criptográfica ni un token.
  const huella=v=>JSON.stringify(ordenar(v));
  function validar(s,entorno){
    if(!objeto(s)||s.formato!=='caoz.progreso'||s.version!==1||!['produccion','beta'].includes(s.entorno)||entorno&&s.entorno!==entorno||!objeto(s.datos))throw fallo('PROGRESO_INVALIDO');
    if(Object.keys(s).some(k=>!['formato','version','entorno','datos'].includes(k))||Object.keys(s.datos).some(k=>!campos.includes(k))||campos.some(k=>!Object.hasOwn(s.datos,k)))throw fallo('PROGRESO_INVALIDO');
    for(const k of campos){const v=s.datos[k];if(k==='nombre'){if(typeof v!=='string'||v.length>40)throw fallo('PROGRESO_INVALIDO');}
      else if(k==='premiosDomo'){if(v!==null&&!Array.isArray(v))throw fallo('PROGRESO_INVALIDO');}
      else if(v!==null&&!objeto(v))throw fallo('PROGRESO_INVALIDO');}
    if(s.datos.campana&&['borradorDeseo','deseo'].some(k=>Object.hasOwn(s.datos.campana,k)))throw fallo('PROGRESO_PRIVADO');
    const texto=JSON.stringify(s);if(new global.TextEncoder().encode(texto).length>512*1024||/(?:"__proto__"|"prototype"|"constructor")\s*:/.test(texto))throw fallo('PROGRESO_INVALIDO');
    return copia(s);
  }
  const vacio=entorno=>({formato:'caoz.progreso',version:1,entorno,datos:Object.fromEntries(campos.map(k=>[k,k==='nombre'?'':null]))});
  function resumir(s){
    if(!s)return null;validar(s);const d=s.datos,c=d.campana||{},b=d.borrador||{},i=d.coleccion||{};
    const n=v=>Number.isSafeInteger(v)&&v>=0?v:0;let foils=0,doradas=0;
    for(const [id,lista] of Object.entries(i.desbloqueos||{})){if(!Array.isArray(lista))continue;
      if(lista.includes('foil'))foils+=Object.hasOwn(i.cantidades?.[id]||{},'foil')?n(i.cantidades[id].foil):1;
      if(lista.includes('dorado'))doradas+=Object.hasOwn(i.cantidades?.[id]||{},'dorado')?n(i.cantidades[id].dorado):1;}
    return {personaje:String(c.personaje?.nombre||b.personaje?.nombre||d.nombre||'Viajero').slice(0,40),
      mazo:String(c.lider||b.lider||'Sin elegir').slice(0,40),rivales:Math.min(6,n(c.etapa)),etapas:6,foils,doradas,sobres:n(i.sobres),fecha:''};
  }
  function crear({storage=global.localStorage,entorno,ruta=global.location?.pathname||'/',hostname=global.location?.hostname||'',eventos=global,intervalo=1500,reloj=Date.now}={}){
    entorno=entorno||(/(^|\.)beta\.|^(localhost|127\.0\.0\.1)$/.test(hostname)||/(^|\/)tcg-beta(?:\/|$)/.test(ruta)?'beta':'produccion');
    if(!['produccion','beta'].includes(entorno)||!storage)throw fallo('ALMACENAMIENTO');
    const partes=String(ruta).split('/').filter(Boolean),indice=partes.findIndex(x=>['tcg','tcg-beta'].includes(x));
    if(indice>=0)partes.length=indice+1;
    else if(partes.length&&(/\.[a-z0-9]+$/i.test(partes.at(-1))||['estudio','sonidos'].includes(partes.at(-1))))partes.pop();
    const raiz=indice>=0?partes.join('/'):'raiz',sufijo=encodeURIComponent(partes.join('/')||'raiz');
    const prefColeccion='caoz.coleccion.v1.'+entorno+'.',actual=prefColeccion+sufijo;
    const aliases=[...new Set([actual,prefColeccion+encodeURIComponent(raiz),...(indice<0?[prefColeccion+'movil']:[])])];
    const pref='caoz.cuenta.v1.'+entorno+'.'+encodeURIComponent(raiz)+'.';
    const claves={campana:'caoz.campana.v1',borrador:'caoz.campana.v1.creador',logros:'caoz.campana.logros.v1',coleccion:actual,premiosDomo:actual+'.domo-pendientes',records:'caoz_records_v1',nombre:'caoz_nombre'};
    const claveVinculo=pref+'vinculo',claveDiario=pref+'transaccion',claveRespaldos=pref+'respaldos';
    const todas=[...new Set([...Object.values(claves),...aliases.flatMap(k=>[k,k+'.domo-pendientes']),claveVinculo])];
    const autor=global.crypto.randomUUID();
    let detenido=false,aplicando=false,temporizador=null,ultima='',errorLectura=false,restaurarGuardia=null,
      esperado=null,cambioExterno=false;const escuchas=new Set();
    const leer=k=>{try{return storage.getItem(k);}catch(_){throw fallo('ALMACENAMIENTO');}};
    function json(k){const texto=leer(k);if(texto===null)return null;try{return JSON.parse(texto);}catch(_){throw fallo('PROGRESO_DANADO');}}
    function escribir(k,v){try{if(v===null)storage.removeItem(k);else storage.setItem(k,v);if(leer(k)!==v)throw Error();}catch(_){throw fallo('ALMACENAMIENTO');}}
    function mapaActual(){return Object.fromEntries(todas.map(k=>[k,leer(k)]));}
    function recuperar(){
      const diario=json(claveDiario);if(!diario)return;
      if(diario.version!==1||!objeto(diario.antes)||Object.keys(diario.antes).some(k=>!todas.includes(k)))throw fallo('PROGRESO_DANADO');
      if(diario.autor&&diario.autor!==autor&&Number.isFinite(diario.iniciada)&&reloj()-diario.iniciada<5000)throw fallo('PROGRESO_OCUPADO');
      // Un cierre de Safari en mitad de varias escrituras recupera el conjunto
      // anterior. Nunca se admite una mezcla de campaña nueva e inventario viejo.
      const antes=aplicando;aplicando=true;
      try{for(const [k,v] of Object.entries(diario.antes))escribir(k,v);escribir(claveDiario,null);}
      finally{aplicando=antes;}
    }
    function capturar(){
      recuperar();const datos={};let tiene=false;
      // El alias activo gana. Si nunca existió, recuperamos el conocido del
      // mismo origen. Los otros originales quedan en el respaldo al vincular.
      const vinculo=json(claveVinculo),canonica=prefColeccion+encodeURIComponent(raiz);
      const origen=vinculo?.cuentaId?canonica:aliases.find(k=>leer(k)!==null)||actual;
      for(const k of campos){const llave=k==='coleccion'?origen:k==='premiosDomo'?origen+'.domo-pendientes':claves[k];
        const texto=leer(llave);if(texto!==null)tiene=true;
        if(k==='nombre')datos[k]=texto||'';
        else {try{datos[k]=texto===null?null:JSON.parse(texto);}catch(_){throw fallo('PROGRESO_DANADO');}}}
      if(!tiene)return null;
      // El deseo pertenece a la ficción local. Nunca se envía a la cuenta,
      // tampoco dentro de un respaldo remoto. El original local queda intacto.
      if(datos.campana){delete datos.campana.borradorDeseo;delete datos.campana.deseo;}
      return validar({formato:'caoz.progreso',version:1,entorno,datos},entorno);
    }
    function vinculado(){recuperar();const d=json(claveVinculo);if(d===null)return null;
      if(!objeto(d)||!uuid(d.cuentaId)||!Number.isSafeInteger(d.revision)||d.revision<0||typeof d.huella!=='string')throw fallo('PROGRESO_DANADO');return copia(d);}
    function respaldar(mapa,motivo){
      const anteriores=json(claveRespaldos)||[];if(!Array.isArray(anteriores))throw fallo('PROGRESO_DANADO');
      escribir(claveRespaldos,JSON.stringify([...anteriores.slice(-2),{id:global.crypto.randomUUID(),fecha:reloj(),motivo,datos:mapa}]));
    }
    function transaccion(despues,motivo){
      if(restaurarGuardia)comprobarGuardia();
      recuperar();const antes=mapaActual();respaldar(antes,motivo);
      escribir(claveDiario,JSON.stringify({version:1,antes,autor,iniciada:reloj()}));aplicando=true;let terminada=false;
      try{for(const [k,v] of Object.entries(despues))escribir(k,v);escribir(claveDiario,null);terminada=true;}
      catch(e){try{for(const [k,v] of Object.entries(antes))escribir(k,v);escribir(claveDiario,null);}catch(_){}
        throw e;
      }finally{aplicando=false;if(terminada)esperado=marca();}
      ultima=huella(capturar());
      if(typeof eventos.dispatchEvent==='function'&&typeof global.CustomEvent==='function')eventos.dispatchEvent(new global.CustomEvent('caoz:cuenta-importada',{detail:{motivo}}));
    }
    function aplicar(snapshot,{cuentaId,revision,permitirVacio=false}={}){
      if(!uuid(cuentaId)||!Number.isSafeInteger(revision)||revision<0)throw fallo('SESION');
      const s=validar(snapshot,entorno),tiene=Object.entries(s.datos).some(([k,v])=>k==='nombre'?v!=='':v!==null);
      if(!tiene&&!permitirVacio)throw fallo('PROGRESO_VACIO');
      const localCampana=json(claves.campana),vinculo=vinculado();
      const local=copia(s);
      if(vinculo?.cuentaId===cuentaId&&local.datos.campana?.id&&local.datos.campana.id===localCampana?.id){
        for(const k of ['borradorDeseo','deseo'])if(Object.hasOwn(localCampana,k))local.datos.campana[k]=copia(localCampana[k]);}
      const despues={};for(const k of campos){const v=local.datos[k],valor=k==='nombre'?(v||null):v===null?null:JSON.stringify(v);
        const destinos=k==='coleccion'?aliases:k==='premiosDomo'?aliases.map(a=>a+'.domo-pendientes'):[claves[k]];
        for(const llave of destinos)despues[llave]=valor;}
      despues[claveVinculo]=JSON.stringify({cuentaId,revision,huella:huella(s),base:s,instancia:global.crypto.randomUUID()});
      transaccion(despues,'vincular');global.CAOZ_COLECCION?.usarClaveDeCuenta?.();return copia(s);
    }
    function vincularVacio({cuentaId,revision}={}){if(capturar()!==null)throw fallo('PROGRESO_EXISTENTE');return aplicar(vacio(entorno),{cuentaId,revision,permitirVacio:true});}
    function iniciarVacioParaCuenta({cuentaId,revision}={}){return aplicar(vacio(entorno),{cuentaId,revision,permitirVacio:true});}
    function confirmar(snapshot,{cuentaId,revision}={}){
      const previo=vinculado();if(!previo||previo.cuentaId!==cuentaId)throw fallo('SESION');
      const s=validar(snapshot,entorno);if(!Number.isSafeInteger(revision)||revision<previo.revision)throw fallo('CONFLICTO');
      escribir(claveVinculo,JSON.stringify({cuentaId,revision,huella:huella(s),base:s,instancia:previo.instancia||'legado'}));
    }
    function desvincular(){
      const v=vinculado();if(!v)return false;
      // La copia archivada pertenece a esa cuenta; el invitado comienza vacío.
      // El progreso que se importó no vuelve a regalarse a otra cuenta al salir.
      const s=capturar();escribir(pref+'archivo.'+v.cuentaId,JSON.stringify({snapshot:s,vinculo:v,fecha:reloj()}));
      transaccion(Object.fromEntries(todas.map(k=>[k,null])),'cerrar-sesion');global.CAOZ_COLECCION?.usarClaveDeCuenta?.();return true;
    }
    function archivo(cuentaId){if(!uuid(cuentaId))throw fallo('SESION');const d=json(pref+'archivo.'+cuentaId);if(!d)return null;
      if(d.vinculo?.cuentaId!==cuentaId)throw fallo('PROGRESO_DANADO');return copia(d);}
    function reiniciar(){transaccion(Object.fromEntries(todas.filter(k=>k!==claveVinculo).map(k=>[k,null])),'reiniciar');}
    function marca(){const v=json(claveVinculo);return v?String(v.cuentaId)+':'+String(v.instancia||'legado'):null;}
    function comprobarGuardia(){
      if(aplicando)return;
      const diario=json(claveDiario),ajeno=diario?.autor&&diario.autor!==autor;
      if(cambioExterno||marca()!==esperado||ajeno){
        if(!cambioExterno){cambioExterno=true;
          if(typeof global.CustomEvent==='function')eventos.dispatchEvent?.(new global.CustomEvent('caoz:cuenta-cambio-externo'));}
        throw fallo('CUENTA_CAMBIADA');
      }
    }
    function instalarGuardia(){
      if(restaurarGuardia)return true;
      const proto=global.Storage?.prototype;if(!proto)return false;
      const original={setItem:proto.setItem,removeItem:proto.removeItem,clear:proto.clear},envoltorios={};
      for(const nombre of ['setItem','removeItem','clear']){
        envoltorios[nombre]=function(...args){
          if(this===storage&&(nombre==='clear'||todas.includes(String(args[0]))))comprobarGuardia();
          return original[nombre].apply(this,args);
        };proto[nombre]=envoltorios[nombre];
      }
      const cambio=e=>{if(e.key===claveVinculo||e.key===claveDiario||e.key===null){try{comprobarGuardia();}catch(_){}}};
      eventos.addEventListener?.('storage',cambio);
      restaurarGuardia=()=>{for(const nombre of Object.keys(original))if(proto[nombre]===envoltorios[nombre])proto[nombre]=original[nombre];eventos.removeEventListener?.('storage',cambio);restaurarGuardia=null;};
      return true;
    }
    function revisar(){if(detenido||aplicando)return;try{const snapshot=capturar(),nueva=huella(snapshot);
      if(nueva!==ultima||errorLectura){ultima=nueva;errorLectura=false;for(const fn of escuchas)fn(copia(snapshot));}}
      catch(e){if(!errorLectura){errorLectura=true;for(const fn of escuchas)fn(null,{codigo:e.codigo||'ALMACENAMIENTO'});}}}
    const alEvento=e=>{if(e.type==='storage'&&e.key&&!todas.includes(e.key)&&e.key!==claveDiario)return;revisar();};
    function observar(fn){if(typeof fn!=='function'||detenido)return()=>{};
      if(!escuchas.size){ultima=huella(capturar());if(intervalo>0)temporizador=global.setInterval(revisar,intervalo);
        for(const e of ['storage','focus','pageshow','caoz:coleccion','caoz:campana-logros'])eventos.addEventListener?.(e,alEvento);}
      escuchas.add(fn);return()=>{escuchas.delete(fn);if(!escuchas.size)pararObservacion();};}
    function pararObservacion(){if(temporizador!==null)global.clearInterval(temporizador);temporizador=null;
      for(const e of ['storage','focus','pageshow','caoz:coleccion','caoz:campana-logros'])eventos.removeEventListener?.(e,alEvento);}
    recuperar();esperado=marca();
    return Object.freeze({entorno,claveCola:cuentaId=>{if(!uuid(cuentaId))throw fallo('SESION');return pref+'cola.'+cuentaId;},
      capturar,aplicar,resumir,vinculado,vincularVacio,iniciarVacioParaCuenta,confirmar,desvincular,reiniciar,instalarGuardia,observar,revisar,
      archivo,respaldos:()=>copia(json(claveRespaldos)||[]),destruir(){detenido=true;pararObservacion();restaurarGuardia?.();escuchas.clear();}});
  }
  global.CAOZ_CUENTA_PROGRESO=Object.freeze({crear,resumir,huella,validar,vacio});
})(globalThis);

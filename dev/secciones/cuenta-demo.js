/* Servicio de demostración: sólo memoria, sin correos, cookies o progreso reales. */
(function(global){
  'use strict';
  const copia=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const fallo=codigo=>Object.assign(Error(codigo),{codigo});
  function crear({reloj=Date.now,esperar=ms=>new Promise(r=>setTimeout(r,ms)),demora=300,
    alCodigo=()=>{},progresoNube=null,correoExistente='viajero@ejemplo.com',nombreExistente='Ari'}={}){
    let conectado=true,perderRespuesta=false,sesion=null,activo=null;
    const cuentas=new Map(),desafios=new Map(),operaciones=new Map(),respaldos=[];
    if(progresoNube)cuentas.set(correoExistente,{nombre:nombreExistente,correo:correoExistente,progreso:copia(progresoNube),revision:1});
    const red=async()=>{await esperar(demora);if(!conectado)throw fallo('SIN_CONEXION');};
    const cuenta=()=>{if(!sesion)throw fallo('SESION');return cuentas.get(sesion.correo);};
    const sesionPublica=()=>sesion&&{nombre:sesion.nombre,correo:sesion.correo};
    async function solicitarCodigo({correo,nombre,intencion}){
      await red();const previo=activo&&desafios.get(activo);
      if(previo&&previo.correo===correo&&reloj()<previo.reenvioEn)throw fallo('ESPERA');
      if(previo)previo.usado=true;
      const codigo=String(100000+global.crypto.getRandomValues(new Uint32Array(1))[0]%900000);
      const d={id:global.crypto.randomUUID(),correo,nombre,intencion,codigo,vence:reloj()+300000,reenvioEn:reloj()+60000,intentos:0,usado:false};
      desafios.set(d.id,d);activo=d.id;alCodigo({codigo,correo,vence:d.vence});
      return {id:d.id,vence:d.vence,reenvioEn:d.reenvioEn};
    }
    async function verificarCodigo({solicitud,codigo}){
      await red();const d=desafios.get(solicitud);
      if(!d||d.usado||reloj()>=d.vence)throw fallo('CADUCADO');
      if(d.intentos>=5)throw fallo('INTENTOS');
      if(codigo!==d.codigo){d.intentos++;throw fallo(d.intentos>=5?'INTENTOS':'CODIGO_INVALIDO');}
      d.usado=true;
      if(!cuentas.has(d.correo))cuentas.set(d.correo,{nombre:d.nombre||'Viajero',correo:d.correo,progreso:null,revision:0});
      const c=cuentas.get(d.correo);sesion={nombre:c.nombre,correo:c.correo};
      return {sesion:sesionPublica(),progreso:copia(c.progreso),revision:c.revision};
    }
    async function vincularProgreso(solicitud){
      await red();const c=cuenta(),clave=c.correo+':'+solicitud.operacion,anterior=operaciones.get(clave);
      if(anterior)return copia(anterior);
      if(c.revision!==solicitud.revision)throw Object.assign(fallo('CONFLICTO'),{revision:c.revision,progreso:copia(c.progreso)});
      // Mantener los dos originales como respaldos. Elegir una versión no suma inventarios.
      respaldos.push({correo:c.correo,nube:copia(c.progreso),local:copia(solicitud.respaldoLocal)});
      if(solicitud.origen==='local')c.progreso=copia(solicitud.progreso);
      c.revision++;
      const r={revision:c.revision,progreso:copia(c.progreso)};operaciones.set(clave,copia(r));
      if(perderRespuesta){perderRespuesta=false;throw fallo('SIN_CONEXION');}
      return r;
    }
    async function cerrarSesion(){await red();sesion=null;}
    // Estas opciones sólo existen en el laboratorio, nunca en un servidor de jugadores.
    return Object.freeze({solicitarCodigo,verificarCodigo,vincularProgreso,cerrarSesion,
      conexion(v){conectado=Boolean(v);},perderProximaRespuesta(){perderRespuesta=true;},
      cambiarNube(progreso){const c=cuenta();c.progreso=copia(progreso);c.revision++;},
      inspeccionar(){return {cuentas:copia([...cuentas.values()]),respaldos:copia(respaldos),operaciones:operaciones.size,sesion:sesionPublica()};}});
  }
  global.CAOZ_CUENTA_DEMO=Object.freeze({crear});
})(globalThis);

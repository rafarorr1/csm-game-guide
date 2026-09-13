/* Correo transaccional del servidor. Las credenciales nunca llegan al navegador. */
const endpoint='https://api.resend.com/emails';
const correoValido=v=>typeof v==='string'&&v.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v);
const fallo=()=>Object.assign(new Error('No se pudo enviar el código de acceso.'),{codigo:'CORREO',status:503});
export function correoConfigurado(env){
  return typeof env?.CUENTAS_RESEND_KEY==='string'&&/^re_[A-Za-z0-9_-]{16,200}$/.test(env.CUENTAS_RESEND_KEY)&&correoValido(env.CUENTAS_REMITENTE);
}
export function crearEnviadorCuenta({fetch:pedir=globalThis.fetch,plazo=8000}={}){
  return async function enviarCodigoCuenta(env,datos){
    if(!correoConfigurado(env)||!correoValido(datos?.correo)||!/^\d{6}$/.test(datos?.codigo||'')||!Number.isFinite(datos?.vence))throw fallo();
    const control=new AbortController(),temporizador=setTimeout(()=>control.abort(),plazo);
    // No enviamos progreso, imágenes, deseos ni datos del dispositivo al proveedor.
    const cuerpo={from:'Caoz Con Todo <'+env.CUENTAS_REMITENTE+'>',to:[datos.correo],
      subject:'Tu código de acceso al Domo',
      text:'Tu código de acceso a Caoz Con Todo es:\n\n'+datos.codigo+'\n\nCaduca en 5 minutos y sólo puede utilizarse una vez.\n\nSi no solicitaste este código, puedes ignorar este correo. No lo compartas con nadie.'};
    try{
      const r=await pedir(endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+env.CUENTAS_RESEND_KEY,'Content-Type':'application/json'},body:JSON.stringify(cuerpo),signal:control.signal});
      if(!r.ok)throw fallo();
      const respuesta=await r.json();if(typeof respuesta.id!=='string'||!respuesta.id)throw fallo();
      // La API del jugador recibe sólo confirmación; ni el código ni el ID del proveedor.
      return true;
    }catch(_){throw fallo();}finally{clearTimeout(temporizador);}
  };
}
export const enviarCodigoCuenta=crearEnviadorCuenta();

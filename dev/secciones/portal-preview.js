/*
 * La revisión aislada sólo demuestra el flujo: cualquier texto no vacío abre
 * el menú. La contraseña real nunca se publica ni se versiona; el portal
 * integrado la valida en el Worker.
 */
(function(){
  'use strict';
  let abierta=false;
  window.CAOZ_PORTAL_PREVIEW=true;
  window.CAOZ_PORTAL_API='/api/portal/sesion';
  window.fetch=async(input,opciones={})=>{
    const url=typeof input==='string'?input:input.url||'';
    if(!String(url).endsWith('/api/portal/sesion'))throw Error('La revisión no abre servicios reales.');
    const metodo=(opciones.method||'GET').toUpperCase();
    if(metodo==='GET')return new Response(JSON.stringify({autenticado:abierta}),{status:abierta?200:401,headers:{'Content-Type':'application/json'}});
    if(metodo==='DELETE'){abierta=false;return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});}
    if(metodo==='POST'){
      let datos={};try{datos=JSON.parse(opciones.body||'{}');}catch(_){}
      if(typeof datos.clave==='string'&&datos.clave.trim()){
        abierta=true;
        return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});
      }
      return new Response(JSON.stringify({error:'Escribe una clave para probar la revisión.'}),{status:401,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({error:'Método no permitido.'}),{status:405,headers:{'Content-Type':'application/json'}});
  };
})();

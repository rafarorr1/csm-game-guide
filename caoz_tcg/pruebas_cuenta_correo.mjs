/* Resend simulado: esta prueba nunca manda correos. */
import assert from 'node:assert/strict';
import {correoConfigurado,crearEnviadorCuenta} from './cuenta-correo.js';
const env={CUENTAS_RESEND_KEY:'re_'+ 'a'.repeat(32),CUENTAS_REMITENTE:'acceso@cuentas.ejemplo.invalid'};
const datos={correo:'jugador@ejemplo.invalid',codigo:'012345',vence:Date.now()+300000,nombre:'<script>secreto</script>',progreso:{deseo:'privado'}};
assert.equal(correoConfigurado({}),false);assert.equal(correoConfigurado(env),true);
let llamadas=0;
const enviar=crearEnviadorCuenta({fetch:async(url,opciones)=>{
 llamadas++;assert.equal(url,'https://api.resend.com/emails');assert.equal(opciones.redirect,'manual');assert.equal(opciones.headers.Authorization,'Bearer '+env.CUENTAS_RESEND_KEY);
 assert.equal(opciones.headers['User-Agent'],'CaozTCG-Cuentas/1.0 (+https://juego.caozcontodo.com)');
 const j=JSON.parse(opciones.body);assert.equal(j.from,'Caoz Con Todo <'+env.CUENTAS_REMITENTE+'>');assert.deepEqual(j.to,[datos.correo]);assert.match(j.text,/012345/);assert.equal(j.html,undefined);
 assert.ok(!JSON.stringify(j).includes('privado')&&!JSON.stringify(j).includes('script'));
 return Response.json({id:'envio-prueba'});
}});
await assert.rejects(()=>enviar({},datos),/No se pudo enviar/);assert.equal(llamadas,0);
await assert.rejects(()=>enviar(env,{...datos,correo:'jugador@ejemplo.invalid\r\nBcc:otro@ejemplo.invalid'}),/No se pudo enviar/);
await assert.rejects(()=>enviar(env,{...datos,codigo:'123'}),/No se pudo enviar/);assert.equal(llamadas,0);
assert.equal(await enviar(env,datos),true);assert.equal(llamadas,1);
// Normalizar sólo el exterior tanto al validar como en Authorization/from.
// El stub comprueba el token completo y el remitente exacto que recibiría Resend.
const pegado=Object.freeze({CUENTAS_RESEND_KEY:' \t'+env.CUENTAS_RESEND_KEY+'\r\n',CUENTAS_REMITENTE:'\n '+env.CUENTAS_REMITENTE+' \t'});
assert.equal(correoConfigurado(pegado),true);
assert.equal(await enviar(pegado,datos),true);assert.equal(llamadas,2);
assert.equal(pegado.CUENTAS_RESEND_KEY,' \t'+env.CUENTAS_RESEND_KEY+'\r\n');
assert.equal(pegado.CUENTAS_REMITENTE,'\n '+env.CUENTAS_REMITENTE+' \t');
for(const clave of ['',' \r\n','re_corta','Bearer '+env.CUENTAS_RESEND_KEY,
 'https://api.resend.com/'+env.CUENTAS_RESEND_KEY,'"'+env.CUENTAS_RESEND_KEY+'"',
 're_'+ 'a'.repeat(16)+'\n'+ 'a'.repeat(16),'re_'+ 'a'.repeat(16)+' '+ 'a'.repeat(16),
 env.CUENTAS_RESEND_KEY+'…',null,123]){
 const invalido={...env,CUENTAS_RESEND_KEY:clave};
 assert.equal(correoConfigurado(invalido),false);
 await assert.rejects(()=>enviar(invalido,datos),/No se pudo enviar/);
}
for(const remitente of ['', ' \n', 'Caoz <'+env.CUENTAS_REMITENTE+'>',
 'acceso\n@cuentas.ejemplo.invalid','acceso @cuentas.ejemplo.invalid',null]){
 const invalido={...env,CUENTAS_REMITENTE:remitente};
 assert.equal(correoConfigurado(invalido),false);
 await assert.rejects(()=>enviar(invalido,datos),/No se pudo enviar/);
}
assert.equal(llamadas,2); // Las configuraciones inválidas no llegan al proveedor.
// Un cuerpo con id no convierte una redirección en una entrega válida.
for(const status of [301,302,303,307,308]){
 let intentos=0;
 await assert.rejects(()=>crearEnviadorCuenta({fetch:async(url,opciones)=>{
  intentos++;assert.equal(url,'https://api.resend.com/emails');assert.equal(opciones.redirect,'manual');
  return Response.json({id:'no-es-una-entrega'},{status,headers:{Location:'https://otro.ejemplo.invalid/captura'}});
 }})(env,datos),e=>e.status===503&&e.message==='No se pudo enviar el código de acceso.');
 assert.equal(intentos,1); // No reintentar ni consultar el destino de Location.
}
for(const responder of [()=>new Response('clave secreta del proveedor',{status:429}),()=>Response.json({}),()=>{throw Error('fallo con token privado');}]){
 await assert.rejects(()=>crearEnviadorCuenta({fetch:async()=>responder()})(env,datos),e=>e.status===503&&e.message==='No se pudo enviar el código de acceso.');
}
await assert.rejects(()=>crearEnviadorCuenta({plazo:5,fetch:(_u,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('Tiempo agotado'))))})(env,datos),/No se pudo enviar/);
console.log('Correo de cuentas: configuración con espacios exteriores, token/remitente y User-Agent exactos, redirecciones 3xx rechazadas sin seguirlas, claves inválidas, contenido mínimo, errores opacos y timeout en verde. Sin correos reales.');

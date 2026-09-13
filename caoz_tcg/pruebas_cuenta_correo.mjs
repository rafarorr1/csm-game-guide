/* Resend simulado: esta prueba nunca manda correos. */
import assert from 'node:assert/strict';
import {correoConfigurado,crearEnviadorCuenta} from './cuenta-correo.js';
const env={CUENTAS_RESEND_KEY:'re_'+ 'a'.repeat(32),CUENTAS_REMITENTE:'acceso@cuentas.ejemplo.invalid'};
const datos={correo:'jugador@ejemplo.invalid',codigo:'012345',vence:Date.now()+300000,nombre:'<script>secreto</script>',progreso:{deseo:'privado'}};
assert.equal(correoConfigurado({}),false);assert.equal(correoConfigurado(env),true);
let llamadas=0;
const enviar=crearEnviadorCuenta({fetch:async(url,opciones)=>{
 llamadas++;assert.equal(url,'https://api.resend.com/emails');assert.equal(opciones.redirect,'error');assert.equal(opciones.headers.Authorization,'Bearer '+env.CUENTAS_RESEND_KEY);
 const j=JSON.parse(opciones.body);assert.deepEqual(j.to,[datos.correo]);assert.match(j.text,/012345/);assert.equal(j.html,undefined);
 assert.ok(!JSON.stringify(j).includes('privado')&&!JSON.stringify(j).includes('script'));
 return Response.json({id:'envio-prueba'});
}});
await assert.rejects(()=>enviar({},datos),/No se pudo enviar/);assert.equal(llamadas,0);
await assert.rejects(()=>enviar(env,{...datos,correo:'jugador@ejemplo.invalid\r\nBcc:otro@ejemplo.invalid'}),/No se pudo enviar/);
await assert.rejects(()=>enviar(env,{...datos,codigo:'123'}),/No se pudo enviar/);assert.equal(llamadas,0);
assert.equal(await enviar(env,datos),true);assert.equal(llamadas,1);
for(const responder of [()=>new Response('clave secreta del proveedor',{status:429}),()=>Response.json({}),()=>{throw Error('fallo con token privado');}]){
 await assert.rejects(()=>crearEnviadorCuenta({fetch:async()=>responder()})(env,datos),e=>e.status===503&&e.message==='No se pudo enviar el código de acceso.');
}
await assert.rejects(()=>crearEnviadorCuenta({plazo:5,fetch:(_u,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('Tiempo agotado'))))})(env,datos),/No se pudo enviar/);
console.log('Correo de cuentas: configuración, destinatario, contenido mínimo, envío confirmado, errores opacos y timeout en verde. Sin correos reales.');

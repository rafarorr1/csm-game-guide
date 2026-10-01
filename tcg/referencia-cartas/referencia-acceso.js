/* Puerta local del Archivo visual. La clave no se guarda en texto claro y la
   autorización sólo dura la pestaña actual; esta sección no usa cuentas ni
   servicios del juego. */
'use strict';
(function(){
  const llave='caoz:referencia-cartas:acceso:v1';
  const huella='66034d1beb4b261f66eaa32c78759595cf1b682bd2c4f7886fb01ae555ea3901';
  let autorizado=false;
  const texto=valor=>new TextEncoder().encode(String(valor));
  const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const sesion={
    leer(){try{return sessionStorage.getItem(llave)==='1';}catch(_){return false;}},
    guardar(){try{sessionStorage.setItem(llave,'1');}catch(_){/* La sesión en memoria sigue siendo suficiente. */}}
  };
  async function coincide(valor){
    if(!crypto?.subtle)return false;
    return hex(await crypto.subtle.digest('SHA-256',texto(valor)))===huella;
  }
  function abrir(){
    autorizado=true;sesion.guardar();
    const puerta=document.getElementById('referenciaAcceso');puerta?.setAttribute('hidden','');
    document.body.classList.add('referenciaAutorizada');
    window.dispatchEvent(new Event('caoz:referencia-acceso'));
  }
  function estado(mensaje){
    const nodo=document.getElementById('referenciaAccesoEstado');if(!nodo)return;
    nodo.hidden=!mensaje;nodo.textContent=mensaje||'';
  }
  function montar(){
    const formulario=document.getElementById('referenciaAccesoFormulario'),clave=document.getElementById('referenciaClave'),boton=formulario?.querySelector('button');
    if(!formulario||!clave||!boton)return;
    if(sesion.leer()){abrir();return;}
    clave.focus({preventScroll:true});
    formulario.addEventListener('submit',async evento=>{
      evento.preventDefault();estado('');boton.disabled=true;boton.textContent='Comprobando…';
      try{
        if(await coincide(clave.value)){clave.value='';abrir();return;}
        estado('La clave no es correcta.');clave.select();
      }catch(_){estado('No se pudo comprobar la clave. Intenta otra vez.');}
      finally{if(!autorizado){boton.disabled=false;boton.textContent='Entrar';}}
    });
  }
  window.CAOZ_REFERENCIA_ACCESO=Object.freeze({permitido:()=>autorizado});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar,{once:true});else montar();
})();

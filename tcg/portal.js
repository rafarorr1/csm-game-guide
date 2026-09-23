/* El portal no conoce ni conserva la contraseña: el Worker decide la sesión. */
(function(){
  'use strict';
  const API=window.CAOZ_PORTAL_API||'/api/portal/sesion';
  const $=id=>document.getElementById(id);
  const acceso=$('portalAcceso'),menu=$('portalMenu'),formulario=$('portalFormulario'),clave=$('portalClave'),enviar=$('portalEnviar'),estado=$('portalEstado'),salir=$('portalSalir'),estadoMenu=$('portalMenuEstado');
  if(!acceso||!menu||!formulario||!clave||!enviar||!estado||!salir||!estadoMenu)return;

  // Una invitación y los atajos antiguos seguían llegando a la raíz. Al pedir
  // acceso se conserva el destino, pero nunca se acepta una redirección ajena.
  function destinoSeguro(valor){
    if(typeof valor!=='string'||!valor||valor.length>4096)return '';
    try{
      const u=new URL(valor,location.origin),rutas=['/estudio','/estudio.html','/sonidos','/sonidos.html'];
      if(u.origin!==location.origin)return '';
      if(u.pathname==='/produccion')return '/produccion/'+u.search+u.hash;
      if(u.pathname.startsWith('/produccion/')||u.pathname.startsWith('/fisico/')||rutas.includes(u.pathname))return u.pathname+u.search+u.hash;
    }catch(_){}
    return '';
  }
  const parametros=new URLSearchParams(location.search),siguiente=destinoSeguro(parametros.get('siguiente'))||(()=>{
    parametros.delete('siguiente');const resto=parametros.toString();
    return resto?'/produccion/?'+resto+location.hash:'';
  })();

  const texto=(n,error=false)=>{estado.textContent=n;estado.classList.toggle('portalError',!!error);};
  const mostrarAcceso=(mensaje='',error=false)=>{menu.hidden=true;acceso.hidden=false;texto(mensaje,error);if(!mensaje)setTimeout(()=>clave.focus(),0);};
  const mostrarMenu=()=>{
    if(siguiente){location.replace(siguiente);return;}
    acceso.hidden=true;menu.hidden=false;estadoMenu.textContent='Elige una puerta del Domo.';
  };
  async function respuesta(r){try{return await r.json();}catch(_){return {};}}
  async function consultar(){
    try{
      const r=await fetch(API,{credentials:'same-origin',headers:{Accept:'application/json'}});
      const datos=await respuesta(r);
      if(r.ok&&datos.autenticado===true){mostrarMenu();return;}
      mostrarAcceso(datos.error||'Escribe la contraseña para entrar.',!r.ok);
    }catch(_){mostrarAcceso('No se pudo comprobar el acceso. Intenta de nuevo.',true);}
  }
  formulario.addEventListener('submit',async e=>{
    e.preventDefault();const valor=clave.value;
    if(!valor){texto('Escribe la contraseña.',true);clave.focus();return;}
    enviar.disabled=true;texto('Abriendo el portal…');
    try{
      const r=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({clave:valor})});
      const datos=await respuesta(r);clave.value='';
      if(r.ok){mostrarMenu();return;}
      texto(datos.error||'La contraseña no es correcta.',true);clave.focus();
    }catch(_){texto('No se pudo abrir el portal. Intenta de nuevo.',true);}
    finally{enviar.disabled=false;}
  });
  salir.addEventListener('click',async()=>{
    salir.disabled=true;estadoMenu.textContent='Cerrando portal…';
    try{await fetch(API,{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json'}});}catch(_){}
    finally{salir.disabled=false;mostrarAcceso('Sesión cerrada.');}
  });
  document.addEventListener('click',e=>{
    const enlace=e.target.closest('[data-destino]');
    if(!enlace||!window.CAOZ_PORTAL_PREVIEW)return;
    e.preventDefault();estadoMenu.textContent='En producción, esta puerta abrirá: '+enlace.dataset.destino+'.';
  });
  consultar();
})();

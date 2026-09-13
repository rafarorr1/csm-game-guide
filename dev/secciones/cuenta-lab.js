/* Montaje aislado: las cuentas, el buzón y las partidas de ejemplo viven sólo en memoria. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),fecha=new Date().toISOString();
  const local={personaje:'Ari',mazo:'Fender',rivales:4,etapas:6,foils:12,doradas:1,sobres:3,fecha,
    snapshot:{campana:{id:'demo-local',etapa:4},coleccion:{pendiente:{id:'demo-abierto',cartas:['eric','tal','rey','armadura','zancada']},sobresGuardados:{trucos:1,juramentos:2},recibos:['demo-victoria-1']}}};
  const nube={personaje:'Lyra',mazo:'Rafaela',rivales:2,etapas:6,foils:8,doradas:2,sobres:5,fecha:new Date(Date.now()-86400000).toISOString(),
    snapshot:{campana:{id:'demo-nube',etapa:2},coleccion:{pendiente:null,sobresGuardados:{caos:5},recibos:['demo-victoria-2']}}};
  let servicio,modelo,ui,numero=0,codigo='',soltar=()=>{};
  function medir(){
    const alto=document.querySelector('.cuentaLaboratorio').getBoundingClientRect().height;
    document.body.style.setProperty('--alto-laboratorio',alto+'px');
    $('cuentaRaiz').style.setProperty('--cuenta-alto-disponible','calc(100dvh - '+alto+'px)');
  }
  $('cuentaRaiz').classList.add('cuentaAnfitrion');
  const parametros=new URLSearchParams(location.search),opciones=['nuevo','vacio','entrar','conflicto'];
  $('cuentaLabEscenario').value=opciones.includes(parametros.get('estado'))?parametros.get('estado'):'nuevo';
  function montar(){
    const instancia=++numero;ui?.destruir();modelo?.destruir();soltar();
    const estado=$('cuentaLabEscenario').value,existe=['entrar','conflicto'].includes(estado);
    $('cuentaLabSalida').hidden=true;$('cuentaRaiz').hidden=false;$('cuentaLabBuzon').hidden=true;codigo='';
    servicio=CAOZ_CUENTA_DEMO.crear({progresoNube:existe?nube:null,alCodigo:r=>{
      if(instancia!==numero)return;codigo=r.codigo;$('cuentaLabCodigo').textContent=codigo;$('cuentaLabBuzon').hidden=false;medir();
    }});
    servicio.conexion(!$('cuentaLabConexion').checked);
    modelo=CAOZ_CUENTA_MODELO.crear({servicio,progresoLocal:['nuevo','conflicto'].includes(estado)?local:null});
    if(existe)modelo.preparar('entrar');
    ui=CAOZ_CUENTA_UI.montar({raiz:$('cuentaRaiz'),modelo,onSalir(){
      $('cuentaRaiz').hidden=true;$('cuentaLabSalida').hidden=false;$('cuentaLabBuzon').hidden=true;medir();$('cuentaLabVolver').focus();
    }});
    soltar=modelo.suscribir(s=>{if(s.pantalla!=='codigo'){$('cuentaLabBuzon').hidden=true;medir();}});
    // Valores de ejemplo visibles, editables; nunca se consultan datos del jugador.
    const correo=$('cuentaRaiz').querySelector('input[type=email]');if(correo){correo.value='viajero@ejemplo.com';correo.dispatchEvent(new Event('input',{bubbles:true}));}
    const nombre=$('cuentaRaiz').querySelector('input[name=nombre]');if(nombre){nombre.value='Ari';nombre.dispatchEvent(new Event('input',{bubbles:true}));}
    medir();
  }
  $('cuentaLabUsar').addEventListener('click',()=>{const input=$('cuentaRaiz').querySelector('input[autocomplete=one-time-code]');if(input&&codigo){input.value=codigo;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}});
  $('cuentaLabAjustes').addEventListener('click',()=>{const mostrar=$('cuentaLabOpciones').hidden;$('cuentaLabOpciones').hidden=!mostrar;$('cuentaLabAjustes').setAttribute('aria-expanded',String(mostrar));medir();});
  $('cuentaLabEscenario').addEventListener('change',montar);$('cuentaLabReiniciar').addEventListener('click',montar);
  $('cuentaLabConexion').addEventListener('change',()=>servicio.conexion(!$('cuentaLabConexion').checked));
  $('cuentaLabVolver').addEventListener('click',()=>{$('cuentaLabSalida').hidden=true;$('cuentaRaiz').hidden=false;medir();$('cuentaRaiz').querySelector('button,input')?.focus();});
  const medidas=new ResizeObserver(medir);medidas.observe(document.querySelector('.cuentaLaboratorio'));
  addEventListener('pagehide',()=>{soltar();ui?.destruir();modelo?.destruir();medidas.disconnect();});
  // Safari puede restaurar el documento sin volver a ejecutar los scripts.
  addEventListener('pageshow',evento=>{if(evento.persisted){medidas.observe(document.querySelector('.cuentaLaboratorio'));montar();}});
  montar();
})();

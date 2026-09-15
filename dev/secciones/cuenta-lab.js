/* El flujo real de acceso y sincronización, con dispositivo y servidor sólo en
   memoria. «Recargar app» reconstruye sus componentes, conservando esta memoria. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),parametros=new URLSearchParams(location.search);
  let memoria,transporte,eventos,progreso,acceso,ui,numero=0,numeroServidor=0,codigo='',soltar=()=>{},enMenu=false;
  const claves={campana:'caoz.campana.v1',borrador:'caoz.campana.v1.creador',logros:'caoz.campana.logros.v1',
    coleccion:'caoz.coleccion.v1.beta.raiz',premiosDomo:'caoz.coleccion.v1.beta.raiz.domo-pendientes',records:'caoz_records_v1',nombre:'caoz_nombre'};
  function ejemplo(nombre,lider,ganadas){
    const s=CAOZ_CUENTA_PROGRESO.vacio('beta');
    s.datos.nombre=nombre;s.datos.campana={id:'demo-'+nombre,etapa:ganadas,lider,personaje:{nombre}};
    s.datos.records={lideres:{},total:{jugadas:ganadas,ganadas},online:{jugadas:0,ganadas:0}};
    return s;
  }
  function sembrar(s){for(const [k,v]of Object.entries(s.datos))if(v!==null&&v!=='')memoria.setItem(claves[k],k==='nombre'?v:JSON.stringify(v));}
  function medir(){
    const alto=document.querySelector('.cuentaLaboratorio').getBoundingClientRect().height;
    document.body.style.setProperty('--alto-laboratorio',alto+'px');
    $('cuentaRaiz').style.setProperty('--cuenta-alto-disponible','calc(100dvh - '+alto+'px)');
  }
  $('cuentaRaiz').classList.add('cuentaAnfitrion');
  const opciones=['nuevo','vacio','entrar','conflicto'];
  $('cuentaLabEscenario').value=opciones.includes(parametros.get('estado'))?parametros.get('estado'):'vacio';
  function actualizar(){
    if(!acceso)return;
    const s=acceso.estado();
    if(!acceso.puedeJugar())enMenu=false;
    $('cuentaLabSalida').hidden=!enMenu;$('cuentaRaiz').hidden=enMenu;
    if(s.pantalla!=='codigo')$('cuentaLabBuzon').hidden=true;
    const local=progreso.capturar(),servidor=transporte.inspeccionar();
    const remota=servidor.cuentas.find(c=>c.correo===s.sesion?.correo)?.progreso;
    $('cuentaLabLocal').textContent=String(local?.datos.records?.total?.ganadas||0);
    $('cuentaLabNube').textContent=String(remota?.datos.records?.total?.ganadas||0);
    $('cuentaLabJugador').textContent=s.sesion?'Bienvenido, '+s.sesion.nombre:'';
    const estado=$('cuentaLabEstado');estado.dataset.guardado=s.guardado;
    estado.textContent=s.guardado==='sinConexion'?'Sin conexión · avance guardado en esta app':s.guardado==='pendiente'?'Sincronizando tu avance…':'Tu avance está sincronizado';
    $('cuentaLabVictoria').disabled=!acceso.puedeJugar();medir();
  }
  function salir(){if(!acceso?.puedeJugar())return;enMenu=true;actualizar();$('cuentaLabVictoria').focus();}
  function desmontar(){soltar();ui?.destruir();acceso?.destruir();progreso?.destruir();ui=null;acceso=null;}
  async function arrancar(recargar=false){
    const instancia=++numero;desmontar();enMenu=false;codigo='';$('cuentaLabBuzon').hidden=true;
    eventos=new EventTarget();
    progreso=CAOZ_CUENTA_PROGRESO.crear({storage:memoria,entorno:'beta',ruta:'/',hostname:'beta.caoz-tcg.pages.dev',eventos,intervalo:0});
    const servicio=CAOZ_CUENTA_SERVICIO.crear({progreso,storage:memoria,fetch:transporte.fetch});
    acceso=CAOZ_CUENTA_ACCESO.crear({progreso,servicio,storage:memoria,eventos,puedeVincular:()=>true,onImportar:actualizar,
      resumir:s=>{const r=progreso.resumir(s);if(r)r.mazo=({fender:'Fender',rafaela:'Rafaela'})[r.mazo]||r.mazo;return r;}});
    const modelo=acceso.modelo;
    if(['entrar','conflicto'].includes($('cuentaLabEscenario').value))modelo.preparar('entrar');
    ui=CAOZ_CUENTA_UI.montar({raiz:$('cuentaRaiz'),modelo,onSalir:salir,onGuardar:()=>acceso.guardar()});
    soltar=acceso.suscribir(actualizar);
    await acceso.iniciar();if(instancia!==numero)return;
    // En una recarga reconocida no se vuelve a pedir el código. La pantalla
    // de perfil sigue accesible desde «Mi cuenta» en el menú de prueba.
    if(recargar&&acceso.puedeJugar()){salir();return;}
    const correo=$('cuentaRaiz').querySelector('input[type=email]');if(correo&&!correo.value){correo.value='viajero@ejemplo.com';correo.dispatchEvent(new Event('input',{bubbles:true}));}
    const nombre=$('cuentaRaiz').querySelector('input[name=nombre]');if(nombre&&!nombre.value){nombre.value='Ari';nombre.dispatchEvent(new Event('input',{bubbles:true}));}
    actualizar();
  }
  function montar(){
    desmontar();memoria=CAOZ_CUENTA_DEMO.crearMemoria();const servidorActual=++numeroServidor;
    const estado=$('cuentaLabEscenario').value;
    if(['nuevo','conflicto'].includes(estado))sembrar(ejemplo('Ari','fender',4));
    transporte=CAOZ_CUENTA_DEMO.crearTransporte({progresoNube:['entrar','conflicto'].includes(estado)?ejemplo('Lyra','rafaela',2):null,
      alCodigo:r=>{if(servidorActual!==numeroServidor)return;codigo=r.codigo;$('cuentaLabCodigo').textContent=codigo;$('cuentaLabBuzon').hidden=false;medir();}});
    transporte.conexion(!$('cuentaLabConexion').checked);void arrancar();
  }
  $('cuentaLabVictoria').addEventListener('click',()=>{
    if(!acceso.puedeJugar())return;
    const anterior=progreso.capturar(),r=anterior?.datos.records||{lideres:{},total:{jugadas:0,ganadas:0},online:{jugadas:0,ganadas:0}};
    r.total.jugadas++;r.total.ganadas++;memoria.setItem(claves.records,JSON.stringify(r));
    // El adaptador y su cola usan exactamente la misma captura que el juego.
    progreso.revisar();actualizar();
  });
  $('cuentaLabUsar').addEventListener('click',()=>{const input=$('cuentaRaiz').querySelector('input[autocomplete=one-time-code]');if(input&&codigo){input.value=codigo;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}});
  $('cuentaLabAjustes').addEventListener('click',()=>{const mostrar=$('cuentaLabOpciones').hidden;$('cuentaLabOpciones').hidden=!mostrar;$('cuentaLabAjustes').setAttribute('aria-expanded',String(mostrar));medir();});
  $('cuentaLabEscenario').addEventListener('change',montar);$('cuentaLabReiniciar').addEventListener('click',montar);
  $('cuentaLabRecargar').addEventListener('click',()=>void arrancar(true));
  $('cuentaLabConexion').addEventListener('change',()=>{
    const conectado=!$('cuentaLabConexion').checked;transporte.conexion(conectado);
    eventos.dispatchEvent(new Event(conectado?'online':'offline'));
    actualizar();
  });
  $('cuentaLabVolver').addEventListener('click',()=>{enMenu=false;actualizar();$('cuentaRaiz').querySelector('button,input')?.focus();});
  const medidas=new ResizeObserver(medir);medidas.observe(document.querySelector('.cuentaLaboratorio'));
  addEventListener('pagehide',()=>{desmontar();medidas.disconnect();});
  addEventListener('pageshow',evento=>{if(evento.persisted){medidas.observe(document.querySelector('.cuentaLaboratorio'));void arrancar(true);}});
  montar();
})();

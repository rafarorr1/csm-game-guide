/* Estudio de interpretación facial: usa el mismo personaje y poses que el juego. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),parametros=new URLSearchParams(location.search);
  const expresiones={
    neutral:{nombre:'Neutral',lectura:'Presente. Escucha antes de actuar.'},
    determinacion:{nombre:'Determinación',lectura:'Ya decidió. No va a retroceder.'},
    ira:{nombre:'Ira',lectura:'Contiene la furia un instante más.'},
    miedo:{nombre:'Miedo',lectura:'Algo la supera. Busca una salida.'},
    dolor:{nombre:'Dolor',lectura:'Recibe el golpe e intenta resistir.'},
    tristeza:{nombre:'Tristeza',lectura:'La pérdida pesa más que el hacha.'},
    desconfianza:{nombre:'Desconfianza',lectura:'Algo no encaja. Observa con cuidado.'},
    alivio:{nombre:'Alivio',lectura:'El peligro pasó. Puede respirar.'},
    sorpresa:{nombre:'Sorpresa',lectura:'No esperaba encontrar eso delante de ella.'}
  };
  const orden=Object.keys(expresiones),secuencia=['neutral','desconfianza','miedo','determinacion','alivio'];
  const estado={expresion:orden.includes(parametros.get('expresion'))?parametros.get('expresion'):'neutral',intensidad:.8,mirada:{x:0,y:0},automatico:true,secuencia:false,aislado:parametros.get('aislado')!=='0'};
  const vista={az:0,el:.01,dist:.88,cuerpo:0},objetivo={...vista},visibilidades=new Map();
  let render,escena,camara,modelo,F,THREE,t=0,ultimo=performance.now(),transcurridoSecuencia=0,inicioParpadeo=-1,proximoParpadeo=3.3,puntero=null;
  const estadoAviso=$('rostroEstado');
  function avisar(mensaje,error=false){estadoAviso.hidden=false;estadoAviso.textContent=mensaje;estadoAviso.classList.toggle('error',error);}
  function mostrarExpresion(nombre,actualizarDireccion=true){
    estado.expresion=nombre;const e=expresiones[nombre];
    $('rostroIndice').textContent=String(orden.indexOf(nombre)+1).padStart(2,'0')+' / 09';
    $('rostroNombre').textContent=e.nombre;$('rostroLectura').textContent=e.lectura;
    for(const b of document.querySelectorAll('[data-expresion]'))b.setAttribute('aria-pressed',b.dataset.expresion===nombre?'true':'false');
    if(actualizarDireccion){const url=new URL(location.href);url.searchParams.set('expresion',nombre);history.replaceState(null,'',url);}
  }
  function mostrarSecuencia(){
    $('secuenciaEmocional').setAttribute('aria-pressed',estado.secuencia?'true':'false');
    $('secuenciaTexto').textContent=estado.secuencia?'Detener secuencia':'Reproducir secuencia';
    $('secuenciaEmocional').querySelector('.simboloReproducir').textContent=estado.secuencia?'Ⅱ':'▶';
  }
  function encuadrar(nombre){
    if(nombre==='cuerpo')aislar(false);
    Object.assign(objetivo,nombre==='cuerpo'?{az:.18,el:.08,dist:4.6,cuerpo:1}:{az:nombre==='tresCuartos'?.55:0,el:.01,dist:.88,cuerpo:0});
    for(const b of document.querySelectorAll('[data-encuadre]'))b.setAttribute('aria-pressed',b.dataset.encuadre===nombre?'true':'false');
  }
  function aislar(aislado,actualizarDireccion=true){
    // Sólo visibilidad: la pose, el agarre y los vínculos de la cabeza permanecen intactos.
    estado.aislado=!!aislado&&!!modelo?.rostro;
    for(const malla of modelo?.mallas||[])malla.visible=!!visibilidades.get(malla)&&(!estado.aislado||malla.userData.rostro===true);
    for(const b of document.querySelectorAll('[data-aislado]')){b.setAttribute('aria-pressed',String(b.dataset.aislado===String(estado.aislado)));b.disabled=!modelo?.rostro;}
    if(estado.aislado&&objetivo.cuerpo)encuadrar('frente');
    if(actualizarDireccion){const url=new URL(location.href);url.searchParams.set('aislado',estado.aislado?'1':'0');history.replaceState(null,'',url);}
  }
  function leerControles(){
    estado.intensidad=+$('rostroIntensidad').value;estado.mirada.x=+$('miradaHorizontal').value;estado.mirada.y=+$('miradaVertical').value;estado.automatico=$('parpadeoAutomatico').checked;
    $('intensidadValor').value=Math.round(estado.intensidad*100)+' %';
    $('horizontalValor').value=Math.abs(estado.mirada.x)<.015?'Centro':(estado.mirada.x<0?'Izquierda ':'Derecha ')+Math.round(Math.abs(estado.mirada.x)*100)+' %';
    $('verticalValor').value=Math.abs(estado.mirada.y)<.015?'Centro':(estado.mirada.y<0?'Abajo ':'Arriba ')+Math.round(Math.abs(estado.mirada.y)*100)+' %';
  }
  document.querySelectorAll('[data-expresion]').forEach(b=>b.addEventListener('click',()=>{estado.secuencia=false;mostrarSecuencia();mostrarExpresion(b.dataset.expresion);}));
  document.querySelectorAll('[data-encuadre]').forEach(b=>b.addEventListener('click',()=>encuadrar(b.dataset.encuadre)));
  document.querySelectorAll('[data-aislado]').forEach(b=>b.addEventListener('click',()=>aislar(b.dataset.aislado==='true')));
  for(const id of ['rostroIntensidad','miradaHorizontal','miradaVertical','parpadeoAutomatico'])$(id).addEventListener('input',leerControles);
  $('parpadear').addEventListener('click',()=>{inicioParpadeo=t;proximoParpadeo=t+3.6;});
  $('secuenciaEmocional').addEventListener('click',()=>{estado.secuencia=!estado.secuencia;transcurridoSecuencia=0;if(estado.secuencia)mostrarExpresion(secuencia[0]);mostrarSecuencia();});
  $('restablecerRostro').addEventListener('click',()=>{estado.secuencia=false;$('rostroIntensidad').value=.8;$('miradaHorizontal').value=0;$('miradaVertical').value=0;$('parpadeoAutomatico').checked=true;leerControles();mostrarSecuencia();mostrarExpresion('neutral');encuadrar('frente');aislar(true);});
  mostrarExpresion(estado.expresion,false);leerControles();
  try{
    if(!window.CAOZ_THREE?.THREE||!window.CAOZ_ARPG_MODELOS)throw Error('Faltan los archivos del personaje. Abre este visor desde el servidor local del juego.');
    THREE=window.CAOZ_THREE.THREE;F=window.CAOZ_ARPG_MODELOS.fabrica(THREE);
    render=new THREE.WebGLRenderer({canvas:$('rostroLienzo'),antialias:true,alpha:false});
    render.setPixelRatio(Math.min(devicePixelRatio||1,1.75));render.outputColorSpace=THREE.SRGBColorSpace;render.toneMapping=THREE.AgXToneMapping;render.toneMappingExposure=1.08;
    escena=new THREE.Scene();escena.background=new THREE.Color(0x18201b);
    escena.add(new THREE.HemisphereLight(0xdde8e2,0x36342b,1.4));
    const principal=new THREE.DirectionalLight(0xffe4be,2.4);principal.position.set(-2.5,3.6,4);escena.add(principal);
    const relleno=new THREE.DirectionalLight(0xa4bec5,.95);relleno.position.set(3,2.5,2);escena.add(relleno);
    const borde=new THREE.DirectionalLight(0xd3c197,1.6);borde.position.set(1.8,3,-3);escena.add(borde);
    camara=new THREE.PerspectiveCamera(29,1,.015,40);
    modelo=F.crear('adreida');escena.add(modelo.raiz);
    for(const malla of modelo.mallas)visibilidades.set(malla,malla.visible);
    aislar(estado.aislado,false);
    if(!modelo.rostro)avisar('El cuerpo está listo. Falta cargar el módulo facial para ver las expresiones.',true);
    else estadoAviso.hidden=true;
  }catch(error){avisar(error.message||'No se pudo abrir el estudio facial.',true);return;}
  const lienzo=$('rostroLienzo'),centro=new THREE.Vector3(),centroCara=new THREE.Vector3(),centroCuerpo=new THREE.Vector3(0,modelo.alto*.51,0),frenteCabeza=new THREE.Vector3(),miradaSuave={x:0,y:0};
  const catalogo=window.CAOZ_ARPG_ROSTRO_ADREIDA?.EXPRESIONES||{},canales=window.CAOZ_ARPG_ROSTRO_ADREIDA?.canales||[];
  const pesosSuaves=Object.fromEntries(canales.filter(n=>!n.startsWith('eyesLook')).map(n=>[n,0])),rostro={...pesosSuaves};
  function redimensionar(){const caja=lienzo.getBoundingClientRect();if(!caja.width||!caja.height)return;render.setSize(caja.width,caja.height,false);camara.aspect=caja.width/caja.height;camara.updateProjectionMatrix();}
  new ResizeObserver(redimensionar).observe(lienzo);redimensionar();
  lienzo.addEventListener('pointerdown',e=>{if(puntero)return;lienzo.setPointerCapture(e.pointerId);puntero={id:e.pointerId,x:e.clientX,y:e.clientY};});
  lienzo.addEventListener('pointermove',e=>{if(!puntero||puntero.id!==e.pointerId)return;objetivo.az-=(e.clientX-puntero.x)*.006;objetivo.el=THREE.MathUtils.clamp(objetivo.el+(e.clientY-puntero.y)*.004,-.35,.55);puntero.x=e.clientX;puntero.y=e.clientY;});
  const soltar=e=>{if(puntero?.id===e.pointerId)puntero=null;};lienzo.addEventListener('pointerup',soltar);lienzo.addEventListener('pointercancel',soltar);lienzo.addEventListener('lostpointercapture',soltar);
  lienzo.addEventListener('wheel',e=>{e.preventDefault();objetivo.dist=THREE.MathUtils.clamp(objetivo.dist*Math.exp(e.deltaY*.001),.4,7);},{passive:false});
  lienzo.addEventListener('keydown',e=>{let usada=true;switch(e.key){case'ArrowLeft':objetivo.az-=.12;break;case'ArrowRight':objetivo.az+=.12;break;case'ArrowUp':objetivo.el=Math.min(.55,objetivo.el+.05);break;case'ArrowDown':objetivo.el=Math.max(-.35,objetivo.el-.05);break;case'+':case'=':objetivo.dist=Math.max(.4,objetivo.dist*.9);break;case'-':objetivo.dist=Math.min(7,objetivo.dist*1.1);break;default:usada=false;}if(usada)e.preventDefault();});
  lienzo.addEventListener('webglcontextlost',e=>{e.preventDefault();avisar('Se perdió la conexión con la tarjeta gráfica. Recarga el visor para continuar.',true);});
  document.addEventListener('visibilitychange',()=>{ultimo=performance.now();});
  function cuadro(ahora){
    const dt=Math.min(.05,Math.max(0,(ahora-ultimo)/1000));ultimo=ahora;t+=dt;
    if(estado.secuencia){transcurridoSecuencia+=dt;const elegida=secuencia[Math.floor(transcurridoSecuencia/4.4)%secuencia.length];if(elegida!==estado.expresion)mostrarExpresion(elegida,false);}
    // Mezclar los mismos canales del juego mantiene la intención continua al cambiar de emoción.
    const expresion=catalogo[estado.expresion]||{};
    for(const canal of Object.keys(pesosSuaves)){pesosSuaves[canal]+=((expresion[canal]||0)*estado.intensidad-pesosSuaves[canal])*(1-Math.exp(-dt*4));rostro[canal]=pesosSuaves[canal];}
    for(const eje of ['x','y'])miradaSuave[eje]+=(estado.mirada[eje]-miradaSuave[eje])*(1-Math.exp(-dt*9));
    if(estado.automatico&&t>=proximoParpadeo){inicioParpadeo=t;proximoParpadeo=t+3.4+Math.sin(t*.7)*.7;}
    const edad=t-inicioParpadeo,suave=x=>x*x*(3-2*x),blink=edad>=0&&edad<.205?(edad<.058?suave(edad/.058):edad<.078?1:1-suave((edad-.078)/.127)):0;
    rostro.eyeBlinkLeft=rostro.eyeBlinkRight=blink;
    for(const lado of ['Left','Right']){rostro['eyeWide'+lado]=(pesosSuaves['eyeWide'+lado]||0)*(1-blink);rostro['eyeSquint'+lado]=(pesosSuaves['eyeSquint'+lado]||0)*(1-blink);}
    F.posar(modelo,{anim:'quieto',t,k:0,fase:t*Math.PI*2/2.8,paso:0,expresion:estado.expresion,intensidadExpresion:estado.intensidad,mirada:miradaSuave,parpadeo:false,rostro});
    modelo.raiz.updateMatrixWorld(true);
    // El encuadre sigue el centro facial; no cambia huesos, manos ni animaciones.
    centroCara.set(0,.145,.035);modelo.H.cabeza.localToWorld(centroCara);
    for(const campo of Object.keys(vista))vista[campo]+=(objetivo[campo]-vista[campo])*(1-Math.exp(-dt*8));
    centro.copy(centroCara).lerp(centroCuerpo,vista.cuerpo);
    frenteCabeza.set(0,0,1).transformDirection(modelo.H.cabeza.matrixWorld);
    const az= vista.az+Math.atan2(frenteCabeza.x,frenteCabeza.z)*(1-vista.cuerpo),c=Math.cos(vista.el);
    camara.position.set(centro.x+Math.sin(az)*c*vista.dist,centro.y+Math.sin(vista.el)*vista.dist,centro.z+Math.cos(az)*c*vista.dist);camara.lookAt(centro);
    render.render(escena,camara);requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
})();

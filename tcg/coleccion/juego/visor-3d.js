/* Visor 3D de una carta de la Colección: la carta real del juego con canto,
   reflejo que sigue al dedo, película foil que cambia con el ángulo, destellos
   y dorso con el logo. Este módulo sólo dibuja: la carta, sus ediciones y las
   copias las entrega quien lo abre (coleccion-ui.js).
   Sin WebGL ni dependencias. Cada capa lleva su propia perspectiva en el
   transform, así que no hace falta preserve-3d: el canto se forma con láminas
   a distinta profundidad y cada cara se oculta sola con backface-visibility. */
'use strict';
(function(){
  const PI=Math.PI;
  const acotar=(v,a,b)=>Math.max(a,Math.min(b,v));
  const acercar=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
  const reducir=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOMBRES={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  // Color del canto, del halo y de las motas por edición; el de la carta lo
  // sigue poniendo acabados.css con data-acabado.
  const TONOS={
    normal:{canto:'#5d4c35',cantoLuz:'#a88f63',halo:'#5a3490',mota:'#f1c27a',anillo:'#e39a4c',holo:0,destellos:.22},
    foil:{canto:'#7f8ca0',cantoLuz:'#e3ecf7',halo:'#2a4f9c',mota:'#9fd0ff',anillo:'#7fb6ff',holo:.34,destellos:.5},
    dorado:{canto:'#9a6f22',cantoLuz:'#ffe7a3',halo:'#8a5a16',mota:'#ffd27a',anillo:'#ffbf4a',holo:.26,destellos:.55},
  };
  const LAMINAS=7,GROSOR=7,MAX_PILA=4;
  const textoCopias=n=>n+' '+(n===1?'copia':'copias');
  let actual=null,destellos='',anillo='';
  const sprites=new Map();

  function nodo(tag,clase,texto){const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;}
  // Una sola textura de destellos por sesión, generada en un canvas: puntos de
  // luz dispersos que la mezcla color-dodge sólo enciende al inclinar.
  function texturaDestellos(){
    if(destellos)return destellos;
    const c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');
    for(let i=0;i<150;i++){
      const x=Math.random()*192,y=Math.random()*192,r=Math.random()<.12?1.6:.7+Math.random()*.6,a=.35+Math.random()*.65;
      const d=g.createRadialGradient(x,y,0,x,y,r*2.2);d.addColorStop(0,'rgba(255,255,255,'+a+')');d.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=d;g.fillRect(x-r*3,y-r*3,r*6,r*6);
    }
    try{destellos='url("'+c.toDataURL('image/png')+'")';}catch(_){destellos='none';}
    return destellos;
  }

  // Anillo rúnico del pedestal: círculos, marcas y runas en blanco. Se usa como
  // máscara, así el color lo pone cada edición sin rehacer la textura.
  function texturaAnillo(){
    if(anillo)return anillo;
    const t=512,c=document.createElement('canvas');c.width=c.height=t;const g=c.getContext('2d'),m=t/2;
    g.strokeStyle='#fff';g.lineCap='round';
    [[.47,5,.95],[.44,2,.6],[.31,2.4,.55],[.28,1.2,.35]].forEach(([r,lw,a])=>{g.globalAlpha=a;g.lineWidth=lw;g.beginPath();g.arc(m,m,t*r,0,PI*2);g.stroke();});
    g.globalAlpha=.8;g.lineWidth=2.4;
    for(let i=0;i<48;i++){
      const a=i/48*PI*2;g.save();g.translate(m+Math.cos(a)*t*.375,m+Math.sin(a)*t*.375);g.rotate(a+PI/2);g.beginPath();
      for(let k=0;k<3;k++){const x=(Math.random()-.5)*14,y=(Math.random()-.5)*14;g.moveTo(x,y);g.lineTo(x+(Math.random()-.5)*16,y+(Math.random()-.5)*16);}
      g.stroke();g.restore();
    }
    g.globalAlpha=.55;g.lineWidth=1.6;g.beginPath();
    for(let i=0;i<=8;i++){const a=(i*3%8)/8*PI*2-PI/2,x=m+Math.cos(a)*t*.28,y=m+Math.sin(a)*t*.28;i?g.lineTo(x,y):g.moveTo(x,y);}
    g.stroke();
    const h=g.createRadialGradient(m,m,t*.2,m,m,t*.5);h.addColorStop(0,'rgba(255,255,255,0)');h.addColorStop(.86,'rgba(255,255,255,.28)');h.addColorStop(1,'rgba(255,255,255,0)');
    g.globalAlpha=1;g.fillStyle=h;g.fillRect(0,0,t,t);
    try{anillo='url("'+c.toDataURL('image/png')+'")';}catch(_){anillo='none';}
    return anillo;
  }
  // Partícula de luz: núcleo blanco y halo del color de la edición.
  function sprite(color){
    if(sprites.has(color))return sprites.get(color);
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32);
    d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.18,color);d.addColorStop(.45,color+'55');d.addColorStop(1,color+'00');
    g.fillStyle=d;g.fillRect(0,0,64,64);sprites.set(color,c);return c;
  }

  // Diálogo a pantalla completa, con cabecera, ediciones y botón de voltear.
  function abrir(o){
    if(actual)actual.cerrar();
    return construir(o,null);
  }
  // Escena incrustada en otra interfaz (el detalle de Colección): sin cabecera
  // ni pie; quien la monta decide la edición con actualizar().
  function montar(contenedor,o){return construir(o,contenedor);}

  /* Mundo persistente para una interfaz que vive dentro del visor. A diferencia
     de montar(), al nacer no crea cuerpo de carta ni contexto WebGL: sólo deja
     respirar el halo, las motas y el pedestal. mostrarCarta() reutiliza este
     mismo nodo, canvas de motas y ciclo de animación para revelar una carta. */
  function montarMundo(contenedor,opciones={}){
    if(!contenedor)return null;
    const dlg=nodo('div','visor3d visor3dIncrustado visor3dMundo');
    dlg.dataset.modo='ambiente';dlg.setAttribute('aria-hidden','true');
    dlg.innerHTML='<canvas class="visor3dMotas" aria-hidden="true"></canvas><div class="visor3dHalo" aria-hidden="true"></div><div class="visor3dEscena"><div class="visor3dPedestal" aria-hidden="true"><i class="visor3dAnillo"></i><i class="visor3dAnillo visor3dAnilloInterior"></i></div><div class="visor3dSuelo" aria-hidden="true"></div></div><canvas class="visor3dChispas" aria-hidden="true"></canvas><div class="visor3dControles"><button type="button" class="visor3dVoltear" aria-label="Voltear la carta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg></button><button type="button" class="visor3dAmpliar" aria-label="Ver a pantalla completa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div><span class="visor3dCandadoEscena">Edición bloqueada</span>';
    const $=s=>dlg.querySelector(s),escena=$('.visor3dEscena'),motas=$('.visor3dMotas'),chispas=$('.visor3dChispas'),botonVoltear=$('.visor3dVoltear'),botonAmpliar=$('.visor3dAmpliar');
    dlg.style.setProperty('--anillo-mascara',texturaAnillo());
    let configuracion=null,ediciones=[],edicion=tonoValido(opciones.edicion||opciones.tono||opciones.inicial),cuerpo=null,lienzoGL=null,gl3d=null,carta=null,frente=null,pila=[],logoGL=null;
    let turnoGL=0,copias=0,ancho=0,alto=0,raf=0,antes=0,reloj=0,vivo=true,observador=null;
    const e={giro:reducir()?0:-PI*2,vel:0,encaje:0,forzado:!reducir(),arrastrando:false,x:0,y:0,t:0,inclX:0,inclY:0,objX:0,objY:0,arrastreX:0,pulso:0,escala:reducir()?1:.86,entradaX:0,entradaY:0,entradaX0:0,entradaY0:0,escala0:1,entradaInicio:0,entradaDuracion:760,esperaEntrada:false,glPendiente:false,entrando:false};
    const puntos=Array.from({length:120},()=>({x:Math.random(),y:Math.random(),z:.35+Math.random()*.65,v:.02+Math.random()*.035,f:Math.random()*PI*2}));
    const vivas=[];

    function tonoValido(valor){return TONOS[valor]?valor:'normal';}
    function aplicarTono(valor){
      edicion=tonoValido(valor);const t=TONOS[edicion];
      dlg.dataset.acabado=edicion;
      dlg.style.setProperty('--canto',t.canto);dlg.style.setProperty('--canto-luz',t.cantoLuz);dlg.style.setProperty('--halo',t.halo);
      dlg.style.setProperty('--holo',t.holo);dlg.style.setProperty('--destellos',t.destellos);dlg.style.setProperty('--anillo',t.anillo);
    }
    function normalizarEdiciones(lista,preferida){
      const salida=(lista||[]).filter(x=>NOMBRES[x.id]).map(x=>({...x,tiene:x.tiene!==false,cantidad:Math.max(0,Number(x.cantidad)||0)}));
      return salida.length?salida:[{id:tonoValido(preferida),tiene:true,cantidad:0}];
    }
    function elegirEdicion(valor){
      const candidata=tonoValido(valor||edicion);
      return ediciones.some(x=>x.id===candidata)?candidata:(ediciones.find(x=>x.tiene)||ediciones[0]||{id:'normal'}).id;
    }
    function asegurarSuperficie(){
      if(cuerpo)return;
      cuerpo=nodo('div','visor3dCuerpo');escena.append(cuerpo);
      pila=[];
      for(let i=0;i<MAX_PILA;i++){
        const p=nodo('div','visor3dCapa visor3dPila');p.style.setProperty('--z',(-GROSOR/2-6-i*9)+'px');p.style.setProperty('--dx',(i+1)*5+'px');p.style.setProperty('--dy',(i+1)*4+'px');p.style.setProperty('--giro-pila',((i%2?1:-1)*(1+i))*.6+'deg');cuerpo.append(p);pila.push(p);
      }
      for(let i=0;i<LAMINAS;i++){const l=nodo('div','visor3dCapa visor3dCanto');l.style.setProperty('--z',(-GROSOR/2+GROSOR*i/(LAMINAS-1))+'px');cuerpo.append(l);}
      const dorso=nodo('div','visor3dCapa visor3dCara visor3dDorso');dorso.style.setProperty('--z',GROSOR/2+.5+'px');
      const logo=nodo('img','visor3dLogo');logo.alt='';logo.draggable=false;logo.decoding='async';logo.src=configuracion?.logoUrl||'art/logo.webp';
      dorso.append(nodo('span','visor3dSello'),logo);cuerpo.append(dorso);
      frente=nodo('div','visor3dCapa visor3dCara visor3dFrente');frente.style.setProperty('--z',GROSOR/2+.5+'px');cuerpo.append(frente);
      lienzoGL=nodo('canvas','visor3dGL');lienzoGL.setAttribute('aria-hidden','true');escena.append(lienzoGL);
    }
    function soltarSuperficie(){
      turnoGL++;gl3d?.destruir();gl3d=null;lienzoGL?.remove();lienzoGL=null;cuerpo?.remove();cuerpo=null;frente=null;pila=[];carta=null;copias=0;logoGL=null;
      e.entradaX=0;e.entradaY=0;e.entradaX0=0;e.entradaY0=0;e.escala0=1;e.entradaInicio=0;e.esperaEntrada=false;e.glPendiente=false;e.entrando=false;
      dlg.classList.remove('visor3dConGL','visor3dBloqueada','visor3dEntraDesdeArchivo');
    }
    function asegurarGL(){
      if(gl3d||!lienzoGL)return;
      try{gl3d=window.CAOZ_VISOR3D_GL?.crear(lienzoGL)||null;}catch(_){gl3d=null;}
    }
    function asegurarLogo(){
      const origen=configuracion?.logoUrl||'art/logo.webp';
      if(logoGL?.src&&logoGL.src.endsWith(origen))return logoGL;
      logoGL=new Image();logoGL.decoding='async';logoGL.src=origen;return logoGL;
    }
    async function prepararGL(){
      const pintor=window.CAOZ_CARTA_PINTOR,diseno=window.CAOZ_CARTA_DISENO,config=configuracion;
      if(!config||!carta||!config.id||typeof CARDS==='undefined'||!CARDS[config.id])return;
      const estado=ediciones.find(x=>x.id===edicion);
      if(estado?.tiene===false){turnoGL++;dlg.classList.remove('visor3dConGL');return;}
      asegurarGL();if(!gl3d||!pintor||!diseno)return;
      const turno=++turnoGL,ed=edicion,fuente=carta,logo=asegurarLogo();
      try{
        await pintor.fuentes();const arte=diseno.arteDe(fuente);await diseno.cargada(arte.img);
        if(!logo.complete)await diseno.cargada(logo);
        if(turno!==turnoGL||!vivo||config!==configuracion||!carta)return;
        const tex=pintor.texturas({id:config.id,acabado:ed,nombre:fuente.querySelector('.cdNombre')?.textContent,arte:{...arte,img:arte.img&&arte.img.naturalWidth?arte.img:null}});
        if(turno!==turnoGL||!vivo||config!==configuracion||!carta)return;
        gl3d.cargarFrente(tex,ed,(TONOS[ed]||TONOS.normal).cantoLuz);
        if(!gl3d.dorsoListo){gl3d.cargarDorso(pintor.dorso(logo.naturalWidth?logo:null));gl3d.dorsoListo=true;}
        dlg.classList.add('visor3dConGL');medir();
      }catch(error){console.warn('Visor 3D: se usan las capas CSS.',error);dlg.classList.remove('visor3dConGL');}
    }
    // La Colección puede entregar la propia ficha que estaba en la miniatura.
    // Conservamos ese nodo (incluidos su <img> decodificada y .cdLienzo) y sólo
    // quitamos las reglas efímeras del vuelo antes de colocarlo en la cara 3D.
    // Si llega algo ajeno o de otra edición, devolver null mantiene el camino
    // tradicional de crearCarta() como respaldo.
    function tomarCartaLista(){
      const lista=configuracion?.cartaLista;
      if(!(lista instanceof HTMLElement))return null;
      const idLista=lista.dataset.card,acabadoLista=lista.dataset.coleccionAcabado||lista.dataset.acabado;
      if((configuracion.id&&idLista&&idLista!==configuracion.id)||(acabadoLista&&acabadoLista!==edicion))return null;
      configuracion.cartaLista=null;
      lista.classList.remove('coleccionVueloCarta','coleccionVueloCartaEntra','coleccionVueloCartaEntregada');
      for(const propiedad of ['left','top','width','height','font-size','zoom','--cw','--ch','--coleccion-vuelo-x','--coleccion-vuelo-y','--coleccion-vuelo-escala'])lista.style.removeProperty(propiedad);
      return lista;
    }
    // Archivo y visor no calculan su carta por separado. Este único encuadre
    // es la fuente de verdad para ambos: la ficha llega exactamente al tamaño
    // y al centro que tendrá dentro del visor, antes de cambiar de capa.
    function medidasCarta(anchoEscena,altoEscena,conCarta=true){
      const altoCarta=Math.max(120,Math.min(conCarta?altoEscena-Math.max(56,altoEscena*.2):altoEscena*.56,(anchoEscena-120)*1.4,conCarta?760:520));
      return {ancho:altoCarta/1.4,alto:altoCarta};
    }
    function encuadreColeccion(opciones={}){
      const r=dlg.getBoundingClientRect(),reserva=Math.max(0,Number(opciones.reserva)||0),controles=Math.max(0,Number(opciones.controles)||0);
      const anchoEscena=Math.max(120,r.width-reserva),altoEscena=Math.max(120,r.height-controles),medidas=medidasCarta(anchoEscena,altoEscena,true);
      return {modo:'coleccion',reserva,controles,centroX:r.left+anchoEscena/2,centroY:r.top+altoEscena/2,...medidas};
    }
    function entrarDesdeArchivo(continuidad){
      if(reducir()||!continuidad||!ancho||!alto)return;
      const r=escena.getBoundingClientRect(),centroX=continuidad.izquierda+continuidad.ancho/2,centroY=continuidad.arriba+continuidad.alto/2;
      e.giro=0;e.encaje=0;e.forzado=false;e.vel=0;e.pulso=0;
      e.escala=acotar(continuidad.alto/alto,.18,1.8);
      e.entradaX=centroX-(r.left+r.width/2);
      e.entradaY=centroY-(r.top+r.height/2);
      // Si Archivo ya llegó al encuadre de esta misma escena no forzamos una
      // segunda animación ni escondemos la ficha un fotograma: adopta el nodo
      // en la misma coordenada, tamaño y escala con que terminó el vuelo.
      if(Math.abs(e.entradaX)<.75&&Math.abs(e.entradaY)<.75&&Math.abs(e.escala-1)<.01){e.entradaX=0;e.entradaY=0;e.escala=1;return;}
      e.entradaX0=e.entradaX;e.entradaY0=e.entradaY;e.escala0=e.escala;e.entradaInicio=continuidad.esperar?0:performance.now();e.esperaEntrada=!!continuidad.esperar;
      // La adopción del nodo y el siguiente RAF pueden caer en fotogramas
      // distintos. Escribimos la pose inicial ahora para no mostrar un cuadro
      // con la carta ya teletransportada al centro.
      const estilo=cuerpo?.style;
      estilo?.setProperty('--entrada-x',e.entradaX+'px');estilo?.setProperty('--entrada-y',e.entradaY+'px');estilo?.setProperty('--s',String(e.escala));estilo?.setProperty('--y','0px');
      e.entrando=true;dlg.classList.add('visor3dEntraDesdeArchivo');
    }
    function iniciarEntrada(){
      if(!e.entrando||!e.esperaEntrada)return;
      e.esperaEntrada=false;e.entradaInicio=performance.now();
    }
    function ponerCarta(){
      if(!configuracion||!cuerpo||typeof configuracion.crearCarta!=='function')return false;
      let siguiente=tomarCartaLista(),adoptada=!!siguiente;
      if(!siguiente)try{siguiente=configuracion.crearCarta(edicion);}catch(error){console.warn('Visor 3D: no se pudo crear la carta.',error);return false;}
      if(!siguiente)return false;
      carta?.remove();carta=siguiente;carta.classList.add('visor3dCarta');carta.setAttribute('aria-hidden','true');
      const capasLuz=['visor3dFoil','visor3dDestellos','visor3dBrillo'].map(clase=>nodo('i',clase));capasLuz[1].style.backgroundImage=texturaDestellos();
      frente.replaceChildren(carta,...capasLuz);aplicarTono(edicion);
      const estado=ediciones.find(x=>x.id===edicion)||{cantidad:0,tiene:true};copias=estado.cantidad||0;
      pila.forEach((p,i)=>{p.hidden=i>=Math.min(MAX_PILA,Math.max(0,copias-1));});dlg.classList.remove('visor3dConGL');dlg.classList.toggle('visor3dBloqueada',estado.tiene===false);botonAmpliar.hidden=estado.tiene===false;
      medir();
      if(adoptada)entrarDesdeArchivo(configuracion.continuidad);
      else{e.entradaX=0;e.entradaY=0;e.entrando=false;dlg.classList.remove('visor3dEntraDesdeArchivo');}
      // Pintar la textura WebGL puede decodificar arte y bloquear un cuadro.
      // Durante el FLIP usamos la ficha CSS ya cargada; WebGL entra sólo al
      // terminar el recorrido para no convertir una animación continua en un
      // salto por trabajo de GPU/CPU en medio de ella.
      if(adoptada&&e.entrando)e.glPendiente=true;else prepararGL();return true;
    }
    function medir(){
      const R=dlg.getBoundingClientRect(),W=R.width,H=R.height,E=escena.getBoundingClientRect(),anchoEscena=E.width||W,altoEscena=E.height||H;if(!W||!H||!anchoEscena||!altoEscena)return;
      const conCarta=!!carta;
      // El mundo puede reservar abajo el lugar para sus controles. La carta
      // mide la escena realmente visible; las motas y chispas siguen cubriendo
      // todo el host para que no haya un corte entre ambas capas.
      const encuadre=configuracion?.encuadre?.modo==='coleccion'?encuadreColeccion(configuracion.encuadre):null;
      if(encuadre){alto=encuadre.alto;ancho=encuadre.ancho;}
      else{const medidas=medidasCarta(anchoEscena,altoEscena,conCarta);alto=medidas.alto;ancho=medidas.ancho;}
      dlg.style.setProperty('--w',ancho+'px');dlg.style.setProperty('--h',alto+'px');dlg.style.setProperty('--p',Math.max(900,alto*2.6)+'px');
      if(carta){
        carta.style.width=ancho+'px';carta.style.height=alto+'px';carta.style.setProperty('--cw',ancho+'px');carta.style.setProperty('--ch',alto+'px');carta.style.fontSize=(ancho*.081)+'px';
        const texto=carta.querySelector('.pieCarta .txt');if(texto){texto.style.fontSize='';const max=alto*.47;let tam=parseFloat(getComputedStyle(texto).fontSize);for(let i=0;i<8&&texto.scrollHeight>max&&tam>10;i++){tam=Math.max(10,tam*.93);texto.style.fontSize=tam+'px';}}
        if(gl3d){const r=escena.getBoundingClientRect();gl3d.medir(r.width,r.height,Math.min(devicePixelRatio||1,2),alto);}
        const radio=getComputedStyle(carta).borderRadius;dlg.style.setProperty('--radio',radio&&radio!=='0px'?radio:(ancho*.05)+'px');
      }
      for(const lienzo of [motas,chispas]){lienzo.width=Math.round(W*Math.min(devicePixelRatio||1,2));lienzo.height=Math.round(H*Math.min(devicePixelRatio||1,2));}
    }
    function impulso(delta){if(!carta)return;e.encaje=(e.forzado?e.encaje:Math.round(e.giro/PI)*PI)+delta;e.forzado=true;e.vel=0;e.pulso=1;}
    function voltear(){if(!carta)return;impulso(PI);rafaga(26,.6);configuracion?.sonar?.('ui_confirm');}
    let ultimoToque=0,movido=0;
    escena.addEventListener('pointerdown',ev=>{
      if(!carta)return;e.arrastrando=true;e.forzado=false;e.vel=0;e.x=ev.clientX;e.y=ev.clientY;e.t=performance.now();movido=0;escena.setPointerCapture(ev.pointerId);escena.classList.add('arrastrando');
    });
    escena.addEventListener('pointermove',ev=>{
      if(ev.pointerType==='mouse'&&!e.arrastrando&&carta){const r=escena.getBoundingClientRect();e.objX=acotar((ev.clientX-r.left)/r.width*2-1,-1,1);e.objY=acotar((ev.clientY-r.top)/r.height*2-1,-1,1);}
      if(!e.arrastrando)return;const ahora=performance.now(),dt=Math.max((ahora-e.t)/1000,1/240),dx=ev.clientX-e.x,dy=ev.clientY-e.y;
      movido+=Math.abs(dx)+Math.abs(dy);e.giro+=dx*.011;e.vel=e.vel*.5+dx*.011/dt*.5;e.arrastreX=acotar(e.arrastreX+dy*.006,-.6,.6);e.x=ev.clientX;e.y=ev.clientY;e.t=ahora;
    });
    const soltar=ev=>{if(!e.arrastrando)return;e.arrastrando=false;escena.classList.remove('arrastrando');if(ev.pointerType!=='mouse'&&movido<10){const ahora=performance.now();if(ahora-ultimoToque<320){voltear();ultimoToque=0;}else ultimoToque=ahora;}};
    escena.addEventListener('pointerup',soltar);escena.addEventListener('pointercancel',soltar);escena.addEventListener('pointerleave',ev=>{if(ev.pointerType==='mouse'){e.objX=0;e.objY=0;}});escena.addEventListener('dblclick',voltear);
    botonVoltear.addEventListener('click',voltear);botonAmpliar.addEventListener('click',()=>{if(configuracion)abrir({...configuracion,inicial:edicion,ediciones});});
    function rafaga(n,fuerza){
      if(reducir())return;const r=escena.getBoundingClientRect(),R=dlg.getBoundingClientRect(),k=chispas.width/(R.width||innerWidth),cx=(r.left-R.left+r.width/2)*k,cy=(r.top-R.top+r.height/2)*k;
      for(let i=0;i<n;i++){const a=Math.random()*PI*2,v=(120+Math.random()*260)*fuerza*k;vivas.push({x:cx+(Math.random()-.5)*ancho*k*.8,y:cy+(Math.random()-.5)*alto*k*.8,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.8-60*k,vida:.7+Math.random()*.6,t:0,r:(2+Math.random()*3.5)*k});}
      if(vivas.length>260)vivas.splice(0,vivas.length-260);
    }
    function dibujarMotas(t,dt){
      const R=dlg.getBoundingClientRect(),g=motas.getContext('2d'),W=motas.width,H=motas.height,k=W/(R.width||innerWidth);g.clearRect(0,0,W,H);const q=chispas.getContext('2d');q.clearRect(0,0,chispas.width,chispas.height);if(reducir())return;
      const luz=sprite((TONOS[edicion]||TONOS.normal).mota),cantidad=Math.round(acotar((R.width||innerWidth)*(R.height||innerHeight)/9000,30,puntos.length));g.globalCompositeOperation='lighter';
      for(let i=0;i<cantidad;i++){const p=puntos[i],y=((p.y-t*p.v*p.z)%1+1)%1,x=p.x+Math.sin(t*.4+p.f)*.02*p.z,a=(.35+.65*Math.pow(.5+.5*Math.sin(t*(1+p.z*2)+p.f*9),2))*Math.min(1,y*5,(1-y)*5)*p.z,tam=(3+p.z*9)*k;g.globalAlpha=a;g.drawImage(luz,x*W-tam,y*H-tam,tam*2,tam*2);}
      g.globalAlpha=1;g.globalCompositeOperation='source-over';q.globalCompositeOperation='lighter';
      for(let i=vivas.length-1;i>=0;i--){const c=vivas[i];c.t+=dt;if(c.t>=c.vida){vivas.splice(i,1);continue;}c.x+=c.vx*dt;c.y+=c.vy*dt;c.vx*=Math.exp(-2.2*dt);c.vy=c.vy*Math.exp(-2.2*dt)-40*k*dt;const a=1-c.t/c.vida,tam=c.r*(1+a*1.5);q.globalAlpha=a;q.drawImage(luz,c.x-tam*2,c.y-tam*2,tam*4,tam*4);}
      q.globalAlpha=1;q.globalCompositeOperation='source-over';
    }
    function cuadro(ahora){
      raf=0;if(!vivo)return;const dt=Math.min(.05,antes?(ahora-antes)/1000:0);antes=ahora;reloj+=dt;
      if(carta){
        if(!e.arrastrando){if(!e.forzado&&Math.abs(e.vel)>3){e.giro+=e.vel*dt;e.vel*=Math.exp(-1.6*dt);}else{if(!e.forzado)e.encaje=Math.round(e.giro/PI)*PI;const k=70,c=2*Math.sqrt(k)*.85;e.vel+=((e.encaje-e.giro)*k-e.vel*c)*dt;e.giro+=e.vel*dt;if(e.forzado&&Math.abs(e.encaje-e.giro)<.002&&Math.abs(e.vel)<.02)e.forzado=false;}e.arrastreX=acercar(e.arrastreX,0,4,dt);}
        const reposo=reducir()?0:1;e.inclX=acercar(e.inclX,e.arrastrando?0:e.objX,6,dt);e.inclY=acercar(e.inclY,e.arrastrando?0:e.objY,6,dt);e.pulso=acercar(e.pulso,0,3,dt);
        if(e.entrando){
          if(!e.esperaEntrada){
            const progreso=acotar((ahora-e.entradaInicio)/e.entradaDuracion,0,1),suave=progreso*progreso*(3-2*progreso);
            e.entradaX=e.entradaX0*(1-suave);e.entradaY=e.entradaY0*(1-suave);e.escala=1+(e.escala0-1)*(1-suave);
            if(progreso>=1){e.entradaX=0;e.entradaY=0;e.escala=1;e.entrando=false;dlg.classList.remove('visor3dEntraDesdeArchivo');if(e.glPendiente){e.glPendiente=false;prepararGL();}}
          }
        }else e.escala=acercar(e.escala,1,5,dt);
        const ry=e.giro+e.inclX*.42+Math.sin(reloj*.6)*.05*reposo,rx=-e.inclY*.32+e.arrastreX+Math.sin(reloj*.8)*.03*reposo,flota=Math.sin(reloj*1.1)*6*reposo,frenteY=Math.atan2(Math.sin(ry),Math.cos(ry)),inclina=acotar(Math.hypot(frenteY,rx)*2.2,0,1),s=cuerpo.style;
        s.setProperty('--rx',rx+'rad');s.setProperty('--ry',ry+'rad');s.setProperty('--rz',(Math.sin(reloj*.7)*.012*reposo)+'rad');s.setProperty('--y',flota+'px');s.setProperty('--s',e.escala*(1+e.pulso*.03));s.setProperty('--entrada-x',e.entradaX+'px');s.setProperty('--entrada-y',e.entradaY+'px');s.setProperty('--gx',acotar(72-frenteY*120,-30,130)+'%');s.setProperty('--gy',acotar(26+rx*120,-30,130)+'%');s.setProperty('--fx',(50+frenteY*160)+'%');s.setProperty('--fy',(50+rx*160)+'%');s.setProperty('--inclina',inclina.toFixed(3));s.setProperty('--pila',Math.cos(frenteY)>0?1:0);
        if(gl3d?.listo()&&dlg.classList.contains('visor3dConGL'))gl3d.dibujar({rx,ry,rz:Math.sin(reloj*.7)*.012*reposo,y:flota,s:e.escala*(1+e.pulso*.03),tiempo:reloj,luzX:e.inclX,luzY:e.inclY,pulso:e.pulso,pila:Math.min(MAX_PILA,Math.max(0,copias-1))});
      }
      const reposo=reducir()?0:1;dlg.style.setProperty('--anillo-giro',(reloj*.12*reposo)+'rad');dlg.style.setProperty('--anillo-brillo',(.5+Math.sin(reloj*2)*.07*reposo+e.pulso*.45).toFixed(3));dibujarMotas(reloj,dt);if(!document.hidden)raf=requestAnimationFrame(cuadro);
    }
    function reanudar(){if(vivo&&!raf&&!document.hidden){antes=0;raf=requestAnimationFrame(cuadro);}}
    function mostrarCarta(nuevo={}){
      if(!nuevo||typeof nuevo.crearCarta!=='function')return false;
      configuracion={...nuevo};ediciones=normalizarEdiciones(configuracion.ediciones,configuracion.inicial||configuracion.edicion||edicion);edicion=elegirEdicion(configuracion.inicial||configuracion.edicion||edicion);asegurarSuperficie();dlg.dataset.modo='carta';dlg.dataset.carta=configuracion.id||'';dlg.removeAttribute('aria-hidden');
      if(!ponerCarta()){ocultarCarta();return false;}rafaga(70,1);return true;
    }
    function ocultarCarta(){
      if(!cuerpo){dlg.dataset.modo='ambiente';return;}
      soltarSuperficie();configuracion=null;dlg.dataset.modo='ambiente';dlg.setAttribute('aria-hidden','true');delete dlg.dataset.carta;medir();
    }
    function actualizar(nuevo={}){
      const tono=nuevo.edicion||nuevo.tono||nuevo.inicial;
      if(!carta){if(tono)aplicarTono(tono);medir();return;}
      if(typeof nuevo.crearCarta==='function'&&nuevo.id&&nuevo.id!==configuracion?.id){mostrarCarta({...configuracion,...nuevo});return;}
      if(nuevo.ediciones)ediciones=normalizarEdiciones(nuevo.ediciones,tono||edicion);
      const destino=elegirEdicion(tono||edicion),estadoAntes=ediciones.find(x=>x.id===edicion),cantidadAntes=copias,bloqueadaAntes=!!dlg.classList.contains('visor3dBloqueada');
      if(destino!==edicion){edicion=destino;ponerCarta();impulso(reducir()?0:PI*2);rafaga(70,1);return;}
      const estado=estadoAntes||{};if((estado.cantidad||0)!==cantidadAntes||bloqueadaAntes!==(estado.tiene===false))ponerCarta();else aplicarTono(edicion);
    }
    function destruir(){
      if(!vivo)return;vivo=false;turnoGL++;cancelAnimationFrame(raf);soltarSuperficie();document.removeEventListener('visibilitychange',reanudar);removeEventListener('resize',medir);window.visualViewport?.removeEventListener('resize',medir);observador?.disconnect();dlg.remove();
    }
    aplicarTono(edicion);contenedor.append(dlg);if(typeof ResizeObserver==='function'){observador=new ResizeObserver(medir);observador.observe(dlg);}document.addEventListener('visibilitychange',reanudar);addEventListener('resize',medir);window.visualViewport?.addEventListener('resize',medir);medir();reanudar();
    return {raiz:dlg,get id(){return configuracion?.id||null;},mostrarCarta,ocultarCarta,actualizar,voltear,destruir,medir,encuadreColeccion,iniciarEntrada};
  }

  function construir(o,contenedor){
    const incrustado=!!contenedor;
    let ediciones=(o.ediciones||[]).filter(e=>NOMBRES[e.id]);
    // Incrustado muestra la edición que pide quien lo monta, aunque esté bloqueada.
    let edicion=ediciones.some(e=>e.id===o.inicial&&(e.tiene||contenedor))?o.inicial:(ediciones.find(e=>e.tiene)||{id:'normal'}).id;
    const dlg=nodo(incrustado?'div':'dialog','visor3d'+(incrustado?' visor3dIncrustado':''));dlg.setAttribute(incrustado?'data-titulo':'aria-label',(o.titulo||'Carta')+' en 3D');
    const controles='<div class="visor3dControles"><button type="button" class="visor3dVoltear" aria-label="Voltear la carta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg></button><button type="button" class="visor3dAmpliar" aria-label="Ver a pantalla completa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div><span class="visor3dCandadoEscena">Edición bloqueada</span>';
    dlg.innerHTML='<canvas class="visor3dMotas" aria-hidden="true"></canvas><div class="visor3dHalo" aria-hidden="true"></div>'+(incrustado?
      '<div class="visor3dEscena"><div class="visor3dPedestal" aria-hidden="true"><i class="visor3dAnillo"></i><i class="visor3dAnillo visor3dAnilloInterior"></i></div><div class="visor3dSuelo" aria-hidden="true"></div><div class="visor3dCuerpo"></div><canvas class="visor3dGL" aria-hidden="true"></canvas></div><canvas class="visor3dChispas" aria-hidden="true"></canvas>'+controles:
      '<header class="visor3dCabecera"><div class="visor3dTitulos"><span class="visor3dAntetitulo"></span><h2 class="visor3dTitulo"></h2></div><button type="button" class="visor3dCerrar" aria-label="Cerrar el visor 3D"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>'+
      '<div class="visor3dEscena"><div class="visor3dPedestal" aria-hidden="true"><i class="visor3dAnillo"></i><i class="visor3dAnillo visor3dAnilloInterior"></i></div><div class="visor3dSuelo" aria-hidden="true"></div><div class="visor3dCuerpo"></div><canvas class="visor3dGL" aria-hidden="true"></canvas></div><canvas class="visor3dChispas" aria-hidden="true"></canvas>'+
      '<footer class="visor3dPie"><div class="visor3dEdiciones" role="group" aria-label="Edición"></div><p class="visor3dCopias" role="status"></p><div class="visor3dAcciones"><button type="button" class="visor3dVoltear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>Voltear</button></div><p class="visor3dAyuda">Arrastra para girar · doble toque para voltear</p></footer>');
    const $=s=>dlg.querySelector(s);
    const escena=$('.visor3dEscena'),cuerpo=$('.visor3dCuerpo'),motas=$('.visor3dMotas'),chispas=$('.visor3dChispas');
    dlg.style.setProperty('--anillo-mascara',texturaAnillo());
    // La carta con luz real (visor-3d-gl.js) cuando hay WebGL; si no, las capas CSS.
    const lienzoGL=$('.visor3dGL');let gl3d=null;
    try{gl3d=window.CAOZ_VISOR3D_GL?.crear(lienzoGL)||null;}catch(_){gl3d=null;}
    let turnoGL=0,copias=0;
    const logoGL=new Image();logoGL.decoding='async';logoGL.src=o.logoUrl||'art/logo.webp';
    async function prepararGL(){
      const pintor=window.CAOZ_CARTA_PINTOR,diseno=window.CAOZ_CARTA_DISENO;
      // Sólo las cartas del motor se pintan; los Protagonistas siguen en CSS.
      if(!gl3d||!pintor||!diseno||!o.id||!carta||typeof CARDS==='undefined'||!CARDS[o.id])return;
      // Una edición bloqueada se ve velada en CSS, nunca nítida en WebGL.
      if(!(ediciones.find(x=>x.id===edicion)?.tiene)){turnoGL++;dlg.classList.remove('visor3dConGL');return;}
      const turno=++turnoGL,ed=edicion,fuente=carta;
      try{
        await pintor.fuentes();const arte=diseno.arteDe(fuente);await diseno.cargada(arte.img);
        if(!logoGL.complete)await diseno.cargada(logoGL);
        if(turno!==turnoGL||!vivo)return;
        const tex=pintor.texturas({id:o.id,acabado:ed,nombre:fuente.querySelector('.cdNombre')?.textContent,arte:{...arte,img:arte.img&&arte.img.naturalWidth?arte.img:null}});
        if(turno!==turnoGL||!vivo)return;
        gl3d.cargarFrente(tex,ed,(TONOS[ed]||TONOS.normal).cantoLuz);
        if(!gl3d.dorsoListo){gl3d.cargarDorso(pintor.dorso(logoGL.naturalWidth?logoGL:null));gl3d.dorsoListo=true;}
        dlg.classList.add('visor3dConGL');
      }catch(error){console.warn('Visor 3D: se usan las capas CSS.',error);dlg.classList.remove('visor3dConGL');}
    }
    if(!incrustado)$('.visor3dTitulo').textContent=o.titulo||'';
    escena.setAttribute('role','img');escena.setAttribute('aria-label',(o.titulo||'Carta')+'. Arrastra para girarla.');

    // Capas: pila de copias (detrás), láminas del canto, dorso y frente.
    const pila=[];for(let i=0;i<MAX_PILA;i++){const p=nodo('div','visor3dCapa visor3dPila');p.style.setProperty('--z',(-GROSOR/2-6-i*9)+'px');p.style.setProperty('--dx',(i+1)*5+'px');p.style.setProperty('--dy',(i+1)*4+'px');p.style.setProperty('--giro-pila',((i%2?1:-1)*(1+i))*.6+'deg');cuerpo.append(p);pila.push(p);}
    for(let i=0;i<LAMINAS;i++){const l=nodo('div','visor3dCapa visor3dCanto');l.style.setProperty('--z',(-GROSOR/2+GROSOR*i/(LAMINAS-1))+'px');cuerpo.append(l);}
    const dorso=nodo('div','visor3dCapa visor3dCara visor3dDorso');dorso.style.setProperty('--z',GROSOR/2+.5+'px');
    const logo=nodo('img','visor3dLogo');logo.alt='';logo.draggable=false;logo.decoding='async';logo.src=o.logoUrl||'art/logo.webp';
    dorso.append(nodo('span','visor3dSello'),logo);cuerpo.append(dorso);
    const frente=nodo('div','visor3dCapa visor3dCara visor3dFrente');frente.style.setProperty('--z',GROSOR/2+.5+'px');cuerpo.append(frente);
    const capasLuz=['visor3dFoil','visor3dDestellos','visor3dBrillo'].map(c=>nodo('i',c));capasLuz[1].style.backgroundImage=texturaDestellos();

    let carta=null;
    function ponerCarta(){
      carta?.remove();
      carta=o.crearCarta(edicion);carta.classList.add('visor3dCarta');carta.setAttribute('aria-hidden','true');
      frente.replaceChildren(carta,...capasLuz);dlg.dataset.acabado=edicion;
      const t=TONOS[edicion]||TONOS.normal;
      dlg.style.setProperty('--canto',t.canto);dlg.style.setProperty('--canto-luz',t.cantoLuz);dlg.style.setProperty('--halo',t.halo);
      dlg.style.setProperty('--holo',t.holo);dlg.style.setProperty('--destellos',t.destellos);dlg.style.setProperty('--anillo',t.anillo);
      const e=ediciones.find(e=>e.id===edicion)||{cantidad:0};
      dlg.classList.toggle('visor3dBloqueada',!e.tiene);
      const ampliar=$('.visor3dAmpliar');if(ampliar)ampliar.hidden=!e.tiene;
      if(!incrustado){$('.visor3dAntetitulo').textContent='Edición '+NOMBRES[edicion];
        $('.visor3dCopias').textContent=e.cantidad>0?textoCopias(e.cantidad)+' en tu colección':'Desbloqueada';}
      copias=e.cantidad||0;pila.forEach((p,i)=>{p.hidden=i>=Math.min(MAX_PILA,Math.max(0,copias-1));});
      prepararGL();
      botones.forEach(b=>{const activo=b.dataset.edicion===edicion;b.setAttribute('aria-pressed',String(activo));});
      medir();
    }
    const botones=incrustado?[]:ediciones.map(e=>{
      const b=nodo('button','visor3dEdicion',NOMBRES[e.id]);b.type='button';b.dataset.edicion=e.id;b.disabled=!e.tiene;
      b.setAttribute('aria-label',NOMBRES[e.id]+(e.tiene?'. '+textoCopias(e.cantidad||0)+'.':'. Bloqueada.'));
      if(!e.tiene)b.append(nodo('span','visor3dCandado','Bloqueada'));
      b.addEventListener('click',()=>{if(edicion===e.id)return;edicion=e.id;ponerCarta();impulso(reducir()?0:PI*2);rafaga(70,1);o.sonar?.('ui_confirm');});
      $('.visor3dEdiciones').append(b);return b;
    });

    // Tamaño: la carta llena el espacio entre cabecera y pie, sin salirse.
    let ancho=0,alto=0;
    function medir(){
      const v=window.visualViewport,R=(incrustado?escena:dlg).getBoundingClientRect(),W=incrustado?R.width:v?v.width:innerWidth,H=incrustado?R.height:v?v.height:innerHeight;
      if(!W||!H)return;
      const arriba=incrustado?0:$('.visor3dCabecera').getBoundingClientRect().height,abajo=incrustado?0:$('.visor3dPie').getBoundingClientRect().height;
      // Incrustado deja a los lados sitio para los botones flotantes.
      alto=Math.max(120,Math.min(H-arriba-abajo-(incrustado?Math.max(56,H*.2):48),(W-(incrustado?120:76))*1.4,incrustado?760:640));ancho=alto/1.4;
      dlg.style.setProperty('--w',ancho+'px');dlg.style.setProperty('--h',alto+'px');
      dlg.style.setProperty('--p',Math.max(900,alto*2.6)+'px');
      if(!carta)return;
      // La misma medida que usa la Colección: marco, orbes y composición del juego.
      carta.style.width=ancho+'px';carta.style.height=alto+'px';carta.style.setProperty('--cw',ancho+'px');carta.style.setProperty('--ch',alto+'px');carta.style.fontSize=(ancho*.081)+'px';
      const texto=carta.querySelector('.pieCarta .txt');
      if(texto){texto.style.fontSize='';const max=alto*.47;let tam=parseFloat(getComputedStyle(texto).fontSize);for(let i=0;i<8&&texto.scrollHeight>max&&tam>10;i++){tam=Math.max(10,tam*.93);texto.style.fontSize=tam+'px';}}
      if(gl3d){const r=escena.getBoundingClientRect();gl3d.medir(r.width,r.height,Math.min(devicePixelRatio||1,2),alto);}
      const radio=getComputedStyle(carta).borderRadius;dlg.style.setProperty('--radio',radio&&radio!=='0px'?radio:(ancho*.05)+'px');
      const T=dlg.getBoundingClientRect();for(const c of [motas,chispas]){c.width=Math.round((incrustado?T.width:W)*Math.min(devicePixelRatio||1,2));c.height=Math.round((incrustado?T.height:H)*Math.min(devicePixelRatio||1,2));}
    }

    // Giro: inercia al soltar y encaje en la cara o el dorso más cercanos.
    const e={giro:reducir()?0:-PI*2,vel:0,encaje:0,forzado:!reducir(),arrastrando:false,x:0,y:0,t:0,inclX:0,inclY:0,objX:0,objY:0,arrastreX:0,pulso:0,escala:reducir()?1:.86};
    // Un impulso durante otro giro se suma a su destino, no al ángulo a medio camino:
    // voltear mientras la carta aún gira por un cambio de edición sí llega al dorso.
    function impulso(delta){e.encaje=(e.forzado?e.encaje:Math.round(e.giro/PI)*PI)+delta;e.forzado=true;e.vel=0;e.pulso=1;}
    function voltear(){impulso(PI);rafaga(26,.6);o.sonar?.('ui_confirm');}
    let ultimoToque=0,movido=0;
    escena.addEventListener('pointerdown',ev=>{
      e.arrastrando=true;e.forzado=false;e.vel=0;e.x=ev.clientX;e.y=ev.clientY;e.t=performance.now();movido=0;
      escena.setPointerCapture(ev.pointerId);escena.classList.add('arrastrando');
    });
    escena.addEventListener('pointermove',ev=>{
      if(ev.pointerType==='mouse'&&!e.arrastrando){const r=escena.getBoundingClientRect();e.objX=acotar((ev.clientX-r.left)/r.width*2-1,-1,1);e.objY=acotar((ev.clientY-r.top)/r.height*2-1,-1,1);}
      if(!e.arrastrando)return;
      const ahora=performance.now(),dt=Math.max((ahora-e.t)/1000,1/240),dx=ev.clientX-e.x,dy=ev.clientY-e.y;
      movido+=Math.abs(dx)+Math.abs(dy);
      e.giro+=dx*.011;e.vel=e.vel*.5+dx*.011/dt*.5;e.arrastreX=acotar(e.arrastreX+dy*.006,-.6,.6);
      e.x=ev.clientX;e.y=ev.clientY;e.t=ahora;
    });
    const soltar=ev=>{
      if(!e.arrastrando)return;e.arrastrando=false;escena.classList.remove('arrastrando');
      if(ev.pointerType!=='mouse'&&movido<10){const ahora=performance.now();if(ahora-ultimoToque<320){voltear();ultimoToque=0;}else ultimoToque=ahora;}
    };
    escena.addEventListener('pointerup',soltar);escena.addEventListener('pointercancel',soltar);
    escena.addEventListener('pointerleave',ev=>{if(ev.pointerType==='mouse'){e.objX=0;e.objY=0;}});
    escena.addEventListener('dblclick',voltear);
    $('.visor3dVoltear').addEventListener('click',voltear);
    $('.visor3dAmpliar')?.addEventListener('click',()=>abrir({...o,inicial:edicion,ediciones}));
    $('.visor3dCerrar')?.addEventListener('click',()=>dlg.close());
    dlg.addEventListener('keydown',ev=>{if((ev.key==='f'||ev.key==='F')&&!ev.target.closest('button')){ev.preventDefault();voltear();}});

    // Partículas de luz que suben y titilan detrás de la carta, con profundidad
    // (tamaño y velocidad), y chispas delante al abrir, voltear o cambiar de
    // edición. Canvas 2D con mezcla aditiva; sin nada con movimiento reducido.
    const puntos=Array.from({length:120},()=>({x:Math.random(),y:Math.random(),z:.35+Math.random()*.65,v:.02+Math.random()*.035,f:Math.random()*PI*2}));
    const vivas=[];
    function rafaga(n,fuerza){
      if(reducir())return;
      const r=escena.getBoundingClientRect(),R=dlg.getBoundingClientRect(),k=chispas.width/(R.width||innerWidth),cx=(r.left-R.left+r.width/2)*k,cy=(r.top-R.top+r.height/2)*k;
      for(let i=0;i<n;i++){
        const a=Math.random()*PI*2,v=(120+Math.random()*260)*fuerza*k;
        vivas.push({x:cx+(Math.random()-.5)*ancho*k*.8,y:cy+(Math.random()-.5)*alto*k*.8,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.8-60*k,vida:.7+Math.random()*.6,t:0,r:(2+Math.random()*3.5)*k});
      }
      if(vivas.length>260)vivas.splice(0,vivas.length-260);
    }
    function dibujarMotas(t,dt){
      const R=dlg.getBoundingClientRect(),g=motas.getContext('2d'),W=motas.width,H=motas.height,k=W/(R.width||innerWidth);g.clearRect(0,0,W,H);
      const q=chispas.getContext('2d');q.clearRect(0,0,chispas.width,chispas.height);
      if(reducir())return;
      const luz=sprite((TONOS[edicion]||TONOS.normal).mota),cantidad=Math.round(acotar((R.width||innerWidth)*(R.height||innerHeight)/9000,incrustado?30:50,puntos.length));
      g.globalCompositeOperation='lighter';
      for(let i=0;i<cantidad;i++){
        const p=puntos[i],y=((p.y-t*p.v*p.z)%1+1)%1,x=p.x+Math.sin(t*.4+p.f)*.02*p.z;
        const a=(.35+.65*Math.pow(.5+.5*Math.sin(t*(1+p.z*2)+p.f*9),2))*Math.min(1,y*5,(1-y)*5)*p.z,tam=(3+p.z*9)*k;
        g.globalAlpha=a;g.drawImage(luz,x*W-tam,y*H-tam,tam*2,tam*2);
      }
      g.globalAlpha=1;g.globalCompositeOperation='source-over';
      q.globalCompositeOperation='lighter';
      for(let i=vivas.length-1;i>=0;i--){
        const c=vivas[i];c.t+=dt;if(c.t>=c.vida){vivas.splice(i,1);continue;}
        c.x+=c.vx*dt;c.y+=c.vy*dt;c.vx*=Math.exp(-2.2*dt);c.vy=c.vy*Math.exp(-2.2*dt)-40*k*dt;
        const a=1-c.t/c.vida,tam=c.r*(1+a*1.5);q.globalAlpha=a;q.drawImage(luz,c.x-tam*2,c.y-tam*2,tam*4,tam*4);
      }
      q.globalAlpha=1;q.globalCompositeOperation='source-over';
    }

    let raf=0,antes=0,reloj=0,vivo=true;
    function cuadro(ahora){
      raf=0;if(!vivo)return;
      const dt=Math.min(.05,antes?(ahora-antes)/1000:0);antes=ahora;reloj+=dt;
      if(!e.arrastrando){
        if(!e.forzado&&Math.abs(e.vel)>3){e.giro+=e.vel*dt;e.vel*=Math.exp(-1.6*dt);}
        else{
          if(!e.forzado)e.encaje=Math.round(e.giro/PI)*PI;
          const k=70,c=2*Math.sqrt(k)*.85;e.vel+=((e.encaje-e.giro)*k-e.vel*c)*dt;e.giro+=e.vel*dt;
          if(e.forzado&&Math.abs(e.encaje-e.giro)<.002&&Math.abs(e.vel)<.02)e.forzado=false;
        }
        e.arrastreX=acercar(e.arrastreX,0,4,dt);
      }
      const reposo=reducir()?0:1;
      e.inclX=acercar(e.inclX,e.arrastrando?0:e.objX,6,dt);e.inclY=acercar(e.inclY,e.arrastrando?0:e.objY,6,dt);
      e.pulso=acercar(e.pulso,0,3,dt);e.escala=acercar(e.escala,1,5,dt);
      const ry=e.giro+e.inclX*.42+Math.sin(reloj*.6)*.05*reposo,rx=-e.inclY*.32+e.arrastreX+Math.sin(reloj*.8)*.03*reposo;
      const flota=Math.sin(reloj*1.1)*6*reposo;
      // Ángulo visto de frente (−π..π) para ubicar el reflejo y el foil.
      const frenteY=Math.atan2(Math.sin(ry),Math.cos(ry)),inclina=acotar(Math.hypot(frenteY,rx)*2.2,0,1);
      const s=cuerpo.style;
      s.setProperty('--rx',rx+'rad');s.setProperty('--ry',ry+'rad');s.setProperty('--rz',(Math.sin(reloj*.7)*.012*reposo)+'rad');
      s.setProperty('--y',flota+'px');s.setProperty('--s',e.escala*(1+e.pulso*.03));
      // El reflejo descansa a un costado (arriba a la derecha) y cruza al inclinar.
      s.setProperty('--gx',acotar(72-frenteY*120,-30,130)+'%');s.setProperty('--gy',acotar(26+rx*120,-30,130)+'%');
      s.setProperty('--fx',(50+frenteY*160)+'%');s.setProperty('--fy',(50+rx*160)+'%');
      s.setProperty('--inclina',inclina.toFixed(3));
      s.setProperty('--pila',Math.cos(frenteY)>0?1:0);
      if(gl3d?.listo()&&dlg.classList.contains('visor3dConGL'))gl3d.dibujar({rx,ry,rz:Math.sin(reloj*.7)*.012*reposo,y:flota,s:e.escala*(1+e.pulso*.03),tiempo:reloj,luzX:e.inclX,luzY:e.inclY,pulso:e.pulso,pila:Math.min(MAX_PILA,Math.max(0,copias-1))});
      // El anillo del pedestal gira despacio y se enciende con cada impulso.
      dlg.style.setProperty('--anillo-giro',(reloj*.12*reposo)+'rad');
      dlg.style.setProperty('--anillo-brillo',(.5+Math.sin(reloj*2)*.07*reposo+e.pulso*.45).toFixed(3));
      dibujarMotas(reloj,dt);
      if(!document.hidden)raf=requestAnimationFrame(cuadro);
    }
    const reanudar=()=>{if(vivo&&!raf&&!document.hidden){antes=0;raf=requestAnimationFrame(cuadro);}};
    document.addEventListener('visibilitychange',reanudar);
    const alMedir=()=>medir();addEventListener('resize',alMedir);window.visualViewport?.addEventListener('resize',alMedir);

    let observador=null;
    function liberar(){
      if(!vivo)return;vivo=false;cancelAnimationFrame(raf);gl3d?.destruir();document.removeEventListener('visibilitychange',reanudar);
      removeEventListener('resize',alMedir);window.visualViewport?.removeEventListener('resize',alMedir);observador?.disconnect();
      dlg.remove();
    }
    if(incrustado){
      contenedor.append(dlg);ponerCarta();
      if(typeof ResizeObserver==='function'){observador=new ResizeObserver(()=>medir());observador.observe(dlg);}
      medir();reanudar();rafaga(70,1);
      // Cambiar de edición o de copias sin rehacer la escena ni el WebGL.
      function actualizar(nuevo={}){
        if(nuevo.ediciones)ediciones=nuevo.ediciones.filter(e=>NOMBRES[e.id]);
        const antes=copias,destino=nuevo.edicion&&NOMBRES[nuevo.edicion]?nuevo.edicion:edicion;
        if(destino!==edicion){edicion=destino;ponerCarta();impulso(reducir()?0:PI*2);rafaga(70,1);return;}
        const e=ediciones.find(x=>x.id===edicion)||{};
        if((e.cantidad||0)!==antes||dlg.classList.contains('visor3dBloqueada')===!!e.tiene){ponerCarta();if((e.cantidad||0)>antes)rafaga(50,.9);}
      }
      return {raiz:dlg,id:o.id,actualizar,voltear,destruir:liberar,medir};
    }
    function cerrar(){if(dlg.open)dlg.close();}
    dlg.addEventListener('close',()=>{liberar();if(actual?.dlg===dlg)actual=null;o.alCerrar?.();});
    document.body.append(dlg);
    ponerCarta();
    dlg.showModal();
    medir();reanudar();rafaga(90,1.2);
    $('.visor3dVoltear').focus({preventScroll:true});
    actual={dlg,cerrar};
    return actual;
  }

  window.CAOZ_VISOR3D=Object.freeze({abrir,montar,montarMundo,cerrar:()=>actual?.cerrar()});
})();

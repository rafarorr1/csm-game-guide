/* Camino a Tomsage: enseña acciones reales; sólo la entrada final toma el control. */
'use strict';
(function(){
  // Controles de ACCION, BOTONES_MANDO y leerMando en arpg-three-mesa.js.
  const LECCIONES=Object.freeze([
    {id:'mover',s:7,evento:'mover',titulo:'Sigue el sendero',texto:'Avanza por el bosque hacia Tomsage.',teclado:'W A S D / Flechas',mando:'Stick izquierdo',ayuda:'Sólo en este bosque tu vida está protegida y la Furia se regenera. Practica a tu ritmo.'},
    {id:'basico',s:14,evento:'impacto-basico',titulo:'Tu primer golpe',texto:'Alcanza al enemigo con un ataque básico.',teclado:'Clic izquierdo · pulsar y soltar',mando:'R2 / □ · pulsar y soltar',ayuda:'Pulsa varias veces para encadenar tres golpes. Cada impacto genera Furia.'},
    {id:'cargado',s:24,evento:'impacto-cargado',titulo:'Toda tu fuerza',texto:'Carga el golpe por completo y acierta.',teclado:'Mantén clic izquierdo y suelta',mando:'Mantén R2 / □ y suelta',ayuda:'Espera a completar la carga antes de soltar.'},
    {id:'dash',s:34,evento:'dash',titulo:'Un paso por delante',texto:'Haz un dash hacia donde quieras avanzar.',teclado:'Shift',mando:'×',ayuda:'Combina la dirección de movimiento con el dash.'},
    {id:'parry',s:44,evento:'parry',titulo:'El instante preciso',texto:'Devuelve un ataque con un parry perfecto.',teclado:'Espacio',mando:'L1 / L2',ayuda:'Pulsa al ver la señal dorada, justo antes del impacto. Un parry perfecto recarga tus habilidades.'},
    {id:'salto',s:54,evento:'impacto-salto',titulo:'Caída demoledora',texto:'Aterriza sobre el enemigo · 25 Furia.',teclado:'Clic derecho',mando:'○',ayuda:'Apunta al suelo con el ratón y haz clic derecho. Con mando, saltas 5 m hacia el stick izquierdo.'},
    {id:'torbellino',s:64,evento:'impacto-torbellino',titulo:'Haz sitio',texto:'Alcanza al enemigo con un torbellino · 30 Furia.',teclado:'Q',mando:'R1',ayuda:'Acércate y gira con el hacha. Puedes hacer un dash sin interrumpir el giro.'},
    {id:'boomerang',s:72,evento:'impacto-boomerang',titulo:'Un hacha que vuelve',texto:'Lanza el hacha búmeran y alcanza al enemigo.',teclado:'E',mando:'△',ayuda:'Alcanza 4 m. Gira mientras regresa para curvar su trayectoria.'},
    {id:'ulti',s:78,evento:'ulti',titulo:'Nunca luchas sola',texto:'Invoca a un Adreidos con tu ulti.',teclado:'R',mando:'L3 · pulsar stick izquierdo',ayuda:'Lucha a tu lado durante 15 s; recarga en 100 s. Cada parry perfecto resta 1 s a la recarga.'},
    {id:'puerta',s:85,evento:null,titulo:'Tomsage te espera',texto:'Cruza la puerta de la muralla.',teclado:'W A S D / Flechas',mando:'Stick izquierdo',ayuda:'Ya conoces tus armas. Es hora de entrar.'}
  ].map((leccion,indice)=>Object.freeze({...leccion,indice})));
  const TOTAL=9;

  function crear({alLeccion=()=>{},alSalir=()=>{},alEntrar=()=>{},alSaltar=()=>{}}={}){
    let activo=false,pausado=false,fase='inactivo',indice=0,disponible=false;
    let avance=0,avanceMax=0,tiempo=0,vivo=true,mando=false,ultimoEvento=null;
    const completadas=[];
    let ui=null;

    function objetivo(){
      if(!activo)return null;
      const l=LECCIONES[indice];
      return l?{...l,disponible}:null;
    }
    function estado(){
      return {activo,bloquea:activo&&fase==='entrada',pausado,fase,indice,total:TOTAL,
        completadas:[...completadas],avance,avanceMax,tiempo,vivo,mando,
        leccion:objetivo(),ultimoEvento:ultimoEvento?{...ultimoEvento}:null};
    }

    function crearInterfaz(){
      if(ui||typeof document==='undefined')return;
      const anfitrion=document.getElementById('escenario')||document.body;
      if(!anfitrion)return;
      const nodo=(tipo,clase,texto)=>{const e=document.createElement(tipo);e.className=clase;if(texto)e.textContent=texto;return e;};
      const raiz=nodo('section','apTutorial');
      raiz.setAttribute('aria-label','Tutorial: Camino a Tomsage');
      const panel=nodo('div','apTutorialPanel'),cabecera=nodo('div','apTutorialCabecera');
      const lugar=nodo('p','apTutorialLugar','Camino a Tomsage'),paso=nodo('span','apTutorialPaso');
      cabecera.append(lugar,paso);
      const progreso=nodo('ol','apTutorialProgreso');
      progreso.setAttribute('aria-label','Progreso del tutorial');
      const muescas=LECCIONES.slice(0,TOTAL).map(l=>{
        const e=nodo('li','apTutorialMuesca');
        e.setAttribute('aria-label',l.titulo);progreso.append(e);return e;
      });
      const anuncio=nodo('div','apTutorialAnuncio');
      anuncio.setAttribute('role','status');anuncio.setAttribute('aria-live','polite');anuncio.setAttribute('aria-atomic','true');
      const titulo=nodo('h2','apTutorialTitulo'),texto=nodo('p','apTutorialObjetivo');
      anuncio.append(titulo,texto);
      const control=nodo('p','apTutorialControl'),tecla=nodo('kbd','apTutorialTecla'),ayuda=nodo('p','apTutorialAyuda');
      control.append(tecla);panel.append(cabecera,progreso,anuncio,control,ayuda);
      const salida=nodo('div','apTutorialSalida'),boton=nodo('button','apTutorialSaltar','Saltar tutorial');
      boton.type='button';boton.addEventListener('click',saltar);
      const atajo=nodo('span','apTutorialAtajo','Panel táctil / Select');atajo.hidden=true;
      salida.append(boton,atajo);raiz.append(panel,salida);anfitrion.append(raiz);
      ui={raiz,anfitrion,paso,muescas,titulo,texto,control,tecla,ayuda,atajo};
    }
    function pintar(){
      if(!ui)return;
      const {raiz,anfitrion}=ui;
      raiz.hidden=!activo;anfitrion.classList.toggle('enTutorial',activo);
      raiz.dataset.fase=fase;raiz.dataset.pausado=String(pausado);raiz.dataset.mando=String(mando);
      if(!activo)return;
      const l=LECCIONES[indice],enCamino=fase==='camino',entrando=fase==='entrada';
      ui.paso.textContent=indice<TOTAL?`Paso ${indice+1} / ${TOTAL}`:`${TOTAL} / ${TOTAL} completados`;
      for(let i=0;i<ui.muescas.length;i++){
        const e=ui.muescas[i],hecha=i<completadas.length;
        e.classList.toggle('completada',hecha);e.classList.toggle('actual',i===indice);
        e.setAttribute('aria-label',`${LECCIONES[i].titulo}: ${hecha?'completado':i===indice?'paso actual':'pendiente'}`);
        if(i===indice)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');
      }
      ui.titulo.textContent=entrando?'Al otro lado de la muralla':enCamino?'Continúa por el sendero':l.titulo;
      ui.texto.textContent=entrando?'Entrando a Tomsage…':enCamino?`Más adelante: ${l.titulo.toLocaleLowerCase('es')}.`:l.texto;
      ui.tecla.textContent=(enCamino?LECCIONES[0]:l)[mando?'mando':'teclado'];
      ui.ayuda.textContent=enCamino?'Sigue el camino hasta el siguiente encuentro.':l.ayuda;
      ui.control.hidden=entrando;ui.ayuda.hidden=entrando;ui.atajo.hidden=!mando;
    }
    function activarLeccion(){
      if(!activo||disponible||pausado||!vivo)return false;
      const l=LECCIONES[indice];
      // La puerta se anuncia y abre tras la ulti, antes de alcanzar el umbral de entrada.
      if(indice!==0&&l.id!=='puerta'&&avance<l.s)return false;
      disponible=true;fase=l.id==='puerta'?'puerta':'leccion';pintar();
      alLeccion({...l,disponible:true});
      return true;
    }
    function comprobarPuerta(){
      if(!activo||pausado||!vivo||fase!=='puerta'||avance<LECCIONES[TOTAL].s)return false;
      fase='entrada';pintar();alEntrar(estado());return true;
    }
    function iniciar(){
      if(activo)return false;
      activo=true;pausado=false;fase='camino';indice=0;disponible=false;
      avance=avanceMax=tiempo=0;vivo=true;mando=false;ultimoEvento=null;completadas.length=0;
      crearInterfaz();activarLeccion();pintar();return true;
    }
    function completar(nombre){
      const l=LECCIONES[indice];
      completadas.push(l.id);ultimoEvento={nombre,leccion:l.id,avance,tiempo};
      indice++;disponible=false;fase='camino';
      activarLeccion();pintar();comprobarPuerta();
    }
    function evento(nombre,datos={}){
      if(!activo||pausado||!vivo||!disponible||fase!=='leccion')return false;
      const l=LECCIONES[indice];
      if(nombre!==l.evento||l.id==='mover'&&avance<l.s)return false;
      // Los eventos del combate ya acreditan impactos válidos. Si incluyen el grado,
      // nunca confundir una carga parcial o un bloqueo con el reto completo.
      if(l.id==='cargado'&&(datos?.cargaCompleta===false||Number.isFinite(datos?.carga)&&datos.carga<1))return false;
      if(l.id==='parry'&&datos?.perfecto===false)return false;
      completar(nombre);return true;
    }
    function paso(dt,{avance:s,vivo:v,mando:m}={}){
      if(!activo)return false;
      let cambio=false;
      if(m!==undefined){const nuevo=typeof m==='object'&&m!==null?!!m.activo:!!m;cambio=mando!==nuevo;mando=nuevo;}
      if(v!==undefined)vivo=!!v;
      if(pausado||!vivo){if(cambio)pintar();return false;}
      if(Number.isFinite(s)){avance=Math.max(0,s);avanceMax=Math.max(avanceMax,avance);}
      if(Number.isFinite(dt)&&dt>0)tiempo+=dt;
      const activada=activarLeccion();
      if(indice===0&&avance>=LECCIONES[0].s)evento('mover');
      comprobarPuerta();if(cambio)pintar();return activada;
    }
    function pausar(valor){pausado=!!valor;pintar();return pausado;}
    function saltar(){
      if(!activo)return false;
      activo=false;pausado=false;disponible=false;fase='saltado';pintar();alSaltar(estado());return true;
    }
    function finalizar(){
      if(!activo||fase!=='entrada')return false;
      activo=false;pausado=false;disponible=false;fase='terminado';pintar();alSalir(estado());return true;
    }
    function cancelar(){
      if(!activo)return false;
      activo=false;pausado=false;disponible=false;fase='inactivo';pintar();return true;
    }
    return {iniciar,paso,evento,saltar,pausar,finalizar,cancelar,estado,
      get activo(){return activo;},get bloquea(){return activo&&fase==='entrada';},get objetivo(){return objetivo();}};
  }
  window.CAOZ_ARPG_TUTORIAL=Object.freeze({crear,LECCIONES,TOTAL});
})();

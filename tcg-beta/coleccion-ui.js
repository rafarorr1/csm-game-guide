/* La colección del jugador: ediciones equipables y sobres. Las reglas de las
   cartas permanecen en el motor; las ilustraciones siguen el estudio público. */
'use strict';
(function(){
  const ACABADOS=['normal','foil','dorado'];
  const NOMBRES={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  const vistasSobres=new Set();
  const COLORES_SOBRES={trucos:'#3b82c4',juramentos:'#298a69',caos:'#b34152'};
  const $=s=>document.querySelector(s);
  const crear=(tag,clase,texto)=>{const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;};
  const modelo=()=>window.CAOZ_COLECCION;
  const textoCopias=n=>n+' '+(n===1?'copia':'copias');
  const limpiarTexto=t=>{const d=document.createElement('div');d.innerHTML=t||'';return d.textContent.replace(/\s+/g,' ').trim();};
  const normalizar=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const nombreVisible=(id,base)=>window.CAOZ_ARTE?.nombre?.(id,base)||base;
  let panel,contenido,barra,estado,volverFoco,origen,observador,frame=0,guardando=false,restaurarLista=false,focoLista=null,aperturaSobre=null,carruselSobres=null,conservarFondo=false,alCerrarRecompensa=null,finalCampana=null;
  const s={vista:'cartas',busqueda:'',mazo:'todos',tipo:'todos',desplazamiento:0,carta:null,acabadoVista:'normal',regla:0,grupoSobre:'',verContenidoSobre:false,recompensaId:null,eleccion:[],mostrarPendiente:false,volverContenido:'sobres'};
  function dato(id){
    if(id.startsWith('lider_')){const l=LEADERS[id.slice(6)];return {id,n:nombreVisible(id,l.n),t:'protagonista',art:l.art,c:'✦',x:[l.pasiva,typeof l.hab==='object'?'<b>'+l.hab.n+':</b> '+l.hab.d:l.hab,l.hab2?'<b>'+l.hab2.n+':</b> '+l.hab2.d:''].filter(Boolean).join(' '),sub:l.ep};}
    const c=CARDS[id];return {...c,id,n:nombreVisible(id,c.n),sub:typeof tribeLine==='function'?tribeLine(c):c.t};
  }
  function icono(tipo){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const trazos={libro:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15 M6 8h3 M6 11h3 M15 8h3 M15 11h3',cerrar:'m6 6 12 12 M18 6 6 18',buscar:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',candado:'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3',sobre:'M5 3h14l2 18H3z M6 7h12 M6 17h12 M12 9l3 3-3 3-3-3z',check:'m5 12 5 5L20 6',flecha:'m14 5-7 7 7 7'};
    const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',trazos[tipo]||trazos.libro);svg.append(p);return svg;
  }
  function boton(texto,accion,clase=''){
    const b=crear('button','coleccionBoton '+clase,texto);b.type='button';b.addEventListener('click',accion);return b;
  }
  function sonido(id){window.CAOZ_AUDIO?.play(id);}
  function mensaje(texto,error=false){if(!estado)return;estado.textContent=texto;estado.classList.toggle('error',error);carruselSobres?.medir();if(s.vista==='recompensa')medirRecompensa();}
  function limpiarTiempos(){guardando=false;cancelAnimationFrame(frame);}
  function esFinalCampana(){return !!finalCampana?.activa;}
  function aplicarModoFinalCampana(activo){
    if(!panel)return;
    panel.classList.toggle('coleccionFinalCampana',activo);
    panel.classList.remove('coleccionFinalCampanaFundiendo');
    if(activo){panel.dataset.epilogoSobres='campana';panel.dataset.epilogoFase='elegir';panel.setAttribute('aria-labelledby','coleccionFinalCampanaTitulo');}
    else{delete panel.dataset.epilogoSobres;delete panel.dataset.epilogoFase;panel.setAttribute('aria-labelledby','coleccionTitulo');}
    // Aunque el CSS los oculta, sacamos las salidas del orden de foco mientras
    // la recompensa final está abierta. No hay una ruta de "elegir después".
    for(const selector of ['.coleccionCerrar','.coleccionVolver']){
      const control=panel.querySelector(selector);if(!control)continue;
      if(activo){control.tabIndex=-1;control.setAttribute('aria-hidden','true');}
      else{control.removeAttribute('tabindex');control.removeAttribute('aria-hidden');}
    }
  }
  function limpiarFinalCampana(){
    const final=finalCampana;if(!final)return;
    if(final.frame)cancelAnimationFrame(final.frame);
    if(final.foco)cancelAnimationFrame(final.foco);
    if(final.temporizador)clearTimeout(final.temporizador);
    finalCampana=null;aplicarModoFinalCampana(false);
  }
  function destruirApertura(){
    const anterior=aperturaSobre;aperturaSobre=null;
    if(anterior){anterior.cancelada=true;anterior.componente?.destruir();}
    panel?.classList.remove('coleccionAbriendoSobre');
  }
  function medida(){
    if(!panel?.open)return;
    const v=window.visualViewport,alto=v?v.height:innerHeight;
    panel.style.setProperty('--coleccion-alto',alto+'px');panel.style.setProperty('--coleccion-top',(v?v.offsetTop:0)+'px');
    panel.classList.toggle('coleccionBaja',alto<650);panel.classList.toggle('coleccionTeclado',alto<430);
    if(s.vista==='detalle')paginacionReglas();
    encajarCartas();carruselSobres?.medir();if(s.vista==='recompensa')medirRecompensa();
  }
  function encajarCartas(){
    if(!panel?.open)return;
    const movil=panel.clientWidth<550;
    panel.querySelectorAll('.coleccionCarta').forEach(n=>{
      if(n.closest('.sobresApertura,.visor3d'))return;
      if(!n.getClientRects().length)return;
      const p=n.parentElement,clase=p.classList;let alto=p.clientHeight,ancho=p.clientWidth;
      // Las filas de la lista crecen con el ancho de sus tres columnas. No
      // dependemos de la altura visible: el resto se recorre con scroll.
      const mini=clase.contains('coleccionMini');
      if(mini){alto=280;ancho=206;n.style.zoom=Math.max(.1,(p.clientWidth-8)/200);}
      else if(clase.contains('coleccionVersion')&&movil){const caja=p.parentElement;const filas=getComputedStyle(caja).gridTemplateRows.split(' ').map(Number.parseFloat);alto=filas[1]||caja.clientHeight-214;ancho=caja.clientWidth-30;}
      else{
        const estilos=getComputedStyle(p),gap=parseFloat(estilos.rowGap)||0;
        alto-=parseFloat(estilos.paddingTop)||0;alto-=parseFloat(estilos.paddingBottom)||0;
        const otros=[...p.children].filter(h=>h!==n);otros.forEach(h=>alto-=h.getBoundingClientRect().height);alto-=otros.length*gap;
      }
      alto=Math.min(alto,movil?470:480);ancho-=6;
      const h=Math.max(28,Math.min(alto,ancho*1.4)),w=h/1.4;
      n.style.height=h+'px';n.style.width=w+'px';n.style.flex='0 0 auto';n.style.setProperty('--cw',w+'px');n.style.setProperty('--ch',h+'px');n.style.fontSize=(w*.081)+'px';
      // Sólo ajustamos texto al espacio; marco, orbes y composición son los del juego.
      const texto=n.querySelector('.pieCarta .txt');if(texto){texto.style.fontSize='';const max=h*.47;let tam=parseFloat(getComputedStyle(texto).fontSize);for(let i=0;i<8&&texto.scrollHeight>max&&tam>10;i++){tam=Math.max(10,tam*.93);texto.style.fontSize=tam+'px';}}
    });
    if(restaurarLista&&s.vista==='cartas'){
      const grid=contenido.querySelector('.coleccionRejilla');
      if(grid){grid.scrollTop=s.desplazamiento;const tarjeta=[...grid.children].find(n=>n.dataset.carta===focoLista);tarjeta?.focus({preventScroll:true});}
      restaurarLista=false;focoLista=null;
    }
  }
  function programarAjuste(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{encajarCartas();if(s.vista==='detalle')paginacionReglas();});}
  function crearPanel(){
    if(panel)return;
    panel=crear('dialog');panel.id='coleccionPanel';panel.setAttribute('aria-labelledby','coleccionTitulo');
    panel.innerHTML='<div class="coleccionInterior"><header class="coleccionCabecera"><div class="coleccionEmblema" aria-hidden="true"></div><div class="coleccionTitulos"><span class="coleccionAntetitulo">EL ARCHIVO DEL DOMO</span><h2 id="coleccionTitulo">Colección de cartas</h2></div><button type="button" class="coleccionCerrar" aria-label="Cerrar colección"></button></header><nav class="coleccionPestanas" aria-label="Secciones de la colección"></nav><main class="coleccionContenido"></main><div class="coleccionEstado" role="status" aria-live="polite"></div><footer class="coleccionPie"><span class="coleccionTotales"></span><button type="button" class="coleccionVolver">Volver a Extras</button></footer></div>';
    panel.querySelector('.coleccionEmblema').append(icono('libro'));panel.querySelector('.coleccionCerrar').append(icono('cerrar'));
    contenido=panel.querySelector('.coleccionContenido');barra=panel.querySelector('.coleccionPestanas');estado=panel.querySelector('.coleccionEstado');
    panel.querySelector('.coleccionCerrar').onclick=cerrar;panel.querySelector('.coleccionVolver').onclick=cerrar;
    panel.addEventListener('cancel',e=>{e.preventDefault();if(esFinalCampana())return;if(s.vista==='detalle')ir('cartas');else cerrar();});
    panel.addEventListener('close',limpiar);
    // Un clic sobre el velo de un diálogo nativo no debe encontrar una salida
    // implícita durante el epílogo, incluso si cambia esa conducta del navegador.
    panel.addEventListener('click',e=>{if(esFinalCampana()&&e.target===panel){e.preventDefault();e.stopPropagation();}});
    // El diálogo nativo atrapa el foco y deja inerte el juego que queda debajo.
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(esFinalCampana())e.preventDefault();}});
    document.body.append(panel);
  }
  function abrir(opciones={}){
    if(!modelo())return;
    crearPanel();if(panel.open)return;
    aplicarModoFinalCampana(!!opciones.finalCampana);
    volverFoco=document.activeElement;origen=document.querySelector('.screen.on');
    conservarFondo=!!opciones.conservarFondo;alCerrarRecompensa=typeof opciones.onCerrar==='function'?opciones.onCerrar:null;
    s.mostrarPendiente=!!modelo().pendiente();s.vista=s.mostrarPendiente?'sobres':'cartas';s.carta=null;
    if(!conservarFondo&&typeof cerrarOv==='function'&&$('#ov.on'))cerrarOv();
    panel.showModal();
    panel.querySelector('.coleccionVolver').textContent=origen?.id==='extras'?'Volver a Extras':'Volver';
    window.addEventListener('resize',medida);window.visualViewport?.addEventListener('resize',medida);window.visualViewport?.addEventListener('scroll',medida);
    window.addEventListener('caoz:coleccion',cambio);window.addEventListener('caoz:arte',arteActualizado);window.addEventListener('caoz:nombres',nombresActualizados);window.addEventListener('caoz:coleccion-error',falloGuardado);
    medida();dibujar();
    observador=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(medida);});observador.observe(panel);observador.observe(contenido);
    if(typeof animarTransicionMenu==='function')animarTransicionMenu(panel.querySelector('.coleccionInterior'),panel);
    if(!opciones.finalCampana)panel.querySelector('.coleccionCerrar')?.focus({preventScroll:true});
  }
  function limpiar(evento){
    // close se encola: no desmontar una Colección que ya se volvió a abrir.
    if(evento?.type==='close'&&panel?.open)return;
    soltarEscena3D();
    if(evento?.type==='close'){const aviso=alCerrarRecompensa;alCerrarRecompensa=null;aviso?.();}
    destruirApertura();destruirCarrusel();destruirVistasSobres();limpiarTiempos();limpiarFinalCampana();observador?.disconnect();observador=null;
    window.removeEventListener('resize',medida);window.visualViewport?.removeEventListener('resize',medida);window.visualViewport?.removeEventListener('scroll',medida);
    window.removeEventListener('caoz:coleccion',cambio);window.removeEventListener('caoz:arte',arteActualizado);window.removeEventListener('caoz:nombres',nombresActualizados);window.removeEventListener('caoz:coleccion-error',falloGuardado);
    // El evento close llega después de comenzar el regreso. Limpiar sólo una
    // transición de este diálogo, nunca el nuevo barrido del menú de destino.
    if(panel?.querySelector('.barridoModal,.coleccionInterior.menuEntra')&&typeof limpiarTransicionMenu==='function')limpiarTransicionMenu();
  }
  function cerrar({restaurarFoco=true}={}){
    if(!panel?.open||(esFinalCampana()&&!finalCampana.terminando))return false;
    guardarPosicionLista();limpiar();panel.close();
    if(!conservarFondo&&origen?.isConnected&&typeof animarTransicionMenu==='function')animarTransicionMenu(origen);
    if(restaurarFoco&&volverFoco?.isConnected)volverFoco.focus({preventScroll:true});
    const aviso=alCerrarRecompensa;alCerrarRecompensa=null;aviso?.();
    return true;
  }
  function falloGuardado(){mensaje('No se pudo guardar. Libera espacio en el navegador e inténtalo otra vez.',true);}
  function cambio(){if(!panel?.open||guardando||finalCampana?.confirmando)return;actualizarCabecera();if(s.vista==='detalle')dibujarDetalle();else if(s.vista==='cartas')dibujarLista();else if(s.vista==='canje')dibujarCanje();else if(s.vista==='recompensa')(esFinalCampana()?dibujarRecompensaFinalCampana:dibujarRecompensa)();else if(s.vista==='contenidoSobre')dibujarContenidoSobre();else dibujarSobres();}
  function arteActualizado(){if(!panel?.open)return;panel.querySelectorAll('.coleccionCarta').forEach(actualizarCarta);}
  function nombresActualizados(){
    if(!panel?.open)return;
    if(s.vista==='detalle')dibujarDetalle();
    else if(s.vista==='cartas')dibujarLista();
    else if(s.vista==='contenidoSobre')dibujarContenidoSobre();
  }
  function actualizarCabecera(){
    const m=modelo(),ids=m.ids(),premium=ids.reduce((n,id)=>n+(m.tiene(id,'foil')?1:0)+(m.tiene(id,'dorado')?1:0),0);
    panel.querySelector('.coleccionTotales').textContent=ids.length+' normales · '+premium+' ediciones especiales';
    barra.replaceChildren();const cartas=boton('Mis cartas',()=>ir('cartas'),'coleccionPestana'),sobres=boton('Sobres',()=>ir('sobres'),'coleccionPestana'),canje=boton('Canjear',()=>ir('canje'),'coleccionPestana');
    cartas.prepend(icono('libro'));sobres.prepend(icono('sobre'));sobres.append(crear('span','coleccionNumero',m.sobres()));
    cartas.setAttribute('aria-current',s.vista==='cartas'||s.vista==='detalle'?'page':'false');sobres.setAttribute('aria-current',['sobres','recompensa','contenidoSobre'].includes(s.vista)?'page':'false');canje.prepend(icono('candado'));canje.setAttribute('aria-current',s.vista==='canje'?'page':'false');barra.append(cartas,sobres,canje);
  }
  function guardarPosicionLista(){if(s.vista==='cartas'&&!restaurarLista)s.desplazamiento=contenido.querySelector('.coleccionRejilla')?.scrollTop||0;}
  function ir(vista){if(esFinalCampana()&&vista!=='recompensa')return;if(vista!=='detalle')soltarEscena3D();guardarPosicionLista();if(s.vista==='detalle'&&vista==='cartas')focoLista=s.carta;limpiarTiempos();s.vista=vista;mensaje('');dibujar();}
  function dibujar(){actualizarCabecera();panel.dataset.vista=s.vista;if(s.vista==='sobres'){dibujarSobres();return;}destruirApertura();destruirCarrusel();vaciarContenido();if(s.vista==='cartas')dibujarGaleria();else if(s.vista==='detalle')dibujarDetalle();else if(s.vista==='recompensa')(esFinalCampana()?dibujarRecompensaFinalCampana:dibujarRecompensa)();else if(s.vista==='contenidoSobre')dibujarContenidoSobre();else dibujarCanje();}
  function idsFiltrados(){
    const q=normalizar(s.busqueda).trim(),enMazo=s.mazo!=='todos'&&s.mazo!=='cajon'?new Set((DECKS[s.mazo]?.list||[]).map(x=>x[0]).concat('lider_'+s.mazo)):null;
    const relevancia=id=>{const nombre=normalizar(dato(id).n);return !q?0:nombre===q?0:nombre.startsWith(q)?1:nombre.includes(q)?2:3;};
    return modelo().ids().filter(id=>{const c=dato(id);return (!q||normalizar(c.n+' '+c.sub).includes(q))&&(s.tipo==='todos'||c.t===s.tipo)&&(!enMazo||enMazo.has(id))&&(s.mazo!=='cajon'||c.set==='cajon');}).sort((a,b)=>{const x=dato(a),y=dato(b);return relevancia(a)-relevancia(b)||Number(y.t==='protagonista')-Number(x.t==='protagonista')||(Number(x.c)||0)-(Number(y.c)||0)||x.n.localeCompare(y.n,'es');});
  }
  function dibujarGaleria(){
    const filtros=crear('div','coleccionFiltros'),buscar=crear('label','coleccionBuscar');buscar.append(icono('buscar'));
    const input=crear('input');input.type='search';input.placeholder='Buscar una carta…';input.setAttribute('aria-label','Buscar cartas por nombre');input.value=s.busqueda;input.autocomplete='off';
    input.oninput=()=>{s.busqueda=input.value;s.desplazamiento=0;dibujarLista();};buscar.append(input);filtros.append(buscar);
    const selector=(nombre,opciones,valor,cambiar)=>{const label=crear('label','coleccionFiltro');label.append(crear('span','coleccionSr',nombre));const select=crear('select');select.setAttribute('aria-label',nombre);opciones.forEach(([v,n])=>{const op=crear('option','',n);op.value=v;select.append(op);});select.value=valor;select.onchange=()=>{cambiar(select.value);s.desplazamiento=0;dibujarLista();};label.append(select);return label;};
    filtros.append(selector('Filtrar por mazo',[['todos','Todos los mazos'],...Object.keys(LEADERS).map(id=>[id,LEADERS[id].n]),['cajon','El Cajón']],s.mazo,v=>s.mazo=v));
    filtros.append(selector('Filtrar por tipo',[['todos','Todos los tipos'],['protagonista','Protagonistas'],['personaje','Personajes'],['hechizo','Hechizos'],['trampa','Trampas'],['objeto','Objetos'],['lugar','Lugares']],s.tipo,v=>s.tipo=v));
    const grid=crear('div','coleccionRejilla');grid.setAttribute('role','region');grid.setAttribute('aria-label','Cartas de tu colección');grid.tabIndex=0;
    grid.addEventListener('scroll',()=>{if(grid.isConnected&&!restaurarLista)s.desplazamiento=grid.scrollTop;},{passive:true});
    const resumen=crear('div','coleccionResumen');resumen.setAttribute('role','status');
    contenido.append(filtros,resumen,grid);dibujarLista();
  }
  function dibujarLista(){
    const grid=contenido.querySelector('.coleccionRejilla');if(!grid)return;
    const ids=idsFiltrados();restaurarLista=true;
    if(grid.contains(document.activeElement))focoLista=document.activeElement.dataset.carta||null;
    contenido.querySelector('.coleccionResumen').textContent=ids.length+' cartas'+(s.busqueda?' encontradas':' en tu colección')+' · Elige una para cambiar su edición';
    grid.replaceChildren();
    ids.forEach(id=>{
      const c=dato(id),a=modelo().elegido(id),propias=ACABADOS.filter(v=>modelo().tiene(id,v)),b=boton('',()=>verCarta(id),'coleccionMini');b.dataset.carta=id;b.setAttribute('aria-label',c.n+'. Ediciones desbloqueadas: '+propias.map(v=>NOMBRES[v]).join(', ')+'. En uso: '+NOMBRES[a]+'. Ver tres versiones.');
      const ficha=carta(id,a),info=crear('span','coleccionMiniInfo');
      const pie=crear('span','coleccionMiniPie'),puntos=crear('span','coleccionPuntos');
      propias.forEach(v=>{const p=crear('i','propia');p.dataset.edicion=v;p.classList.toggle('elegida',v===a);p.title=NOMBRES[v]+' desbloqueada'+(v===a?' · En uso':'');p.setAttribute('aria-hidden','true');puntos.append(p);});
      pie.append(puntos);info.append(pie);b.append(ficha,info);grid.append(b);
    });
    if(!ids.length){const vacio=crear('div','coleccionVacio');vacio.append(icono('buscar'),crear('h3','','No hay cartas con esos filtros.'),boton('Limpiar filtros',()=>{s.busqueda='';s.mazo='todos';s.tipo='todos';s.desplazamiento=0;dibujar();}));grid.append(vacio);}
    programarAjuste();
  }
  function actualizarCarta(nodo){
    const soporte=nodo.matches('[data-arte-id]')?nodo:nodo.querySelector('[data-arte-id]');if(!soporte)return;
    const id=soporte.dataset.arteId,a=nodo.dataset.coleccionAcabado,vista=nodo.dataset.vistaArte;
    const v=window.CAOZ_ARTE?.version?.(id,a,vista),enc=v?v.encuadre:encuadreDe(ARTE[id]),url=v?.url||(typeof urlArte==='function'?urlArte(id):'art/'+id+'.webp');
    nodo.dataset.acabado=a;
    if(enc&&url){soporte.classList.add('conarte');soporte.classList.remove('sinarte');ponerDibujo(soporte,url,enc);}
    else{soporte.classList.remove('conarte');if(soporte.classList.contains('card'))soporte.classList.add('sinarte');soporte.querySelectorAll(':scope > .marcoDibujo').forEach(n=>n.remove());}
  }
  function carta(id,acabado){
    // Las cartas usan el diseño de Colección (carta-diseno.js) con los datos y
    // las ilustraciones del juego; sin ese módulo, la carta del tablero clonada
    // (clonar evita activar acciones de combate). Los Protagonistas conservan
    // su retrato.
    const diseno=!id.startsWith('lider_')&&window.CAOZ_CARTA_DISENO;
    const n=diseno?diseno.crear(id,acabado):(id.startsWith('lider_')?cartaDeLiderVS(id.slice(6),''):cardEl(id,{})).cloneNode(true);
    n.classList.add('coleccionCarta');n.dataset.coleccionAcabado=acabado;n.dataset.acabado=acabado;
    n.dataset.vistaArte=(document.getElementById('panelCerrar')?'movil_':'desktop_')+'coleccion';
    n.removeAttribute('tabindex');n.setAttribute('aria-hidden','true');actualizarCarta(n);return n;
  }
  function cartaSobre(item){
    const n=carta(item.id,item.acabado);
    // El componente mide sus cinco frentes. La rejilla y el detalle no deben
    // redimensionarlos ni rehacerlos cuando cambian datos de la colección.
    n.classList.remove('coleccionCarta');n.classList.add('coleccionCartaSobre');
    // Congelar el arte resuelto: los refrescos globales no sustituyen imágenes
    // después de su decodificación. El próximo sobre recoge el catálogo nuevo.
    n.removeAttribute('data-arte-id');n.querySelectorAll('[data-arte-id]').forEach(soporte=>soporte.removeAttribute('data-arte-id'));
    return n;
  }
  function verCarta(id){s.carta=id;s.acabadoVista=modelo().elegido(id);s.regla=0;ir('detalle');sonido('ui_confirm');}
  // El detalle es la carta en 3D (visor-3d.js incrustado): una escena por carta
  // que sólo cambia de edición o de copias al redibujar, sin rehacer su WebGL.
  let escena3D=null;
  const edicionesDe=id=>ACABADOS.map(a=>({id:a,tiene:modelo().tiene(id,a),cantidad:modelo().cantidad(id,a)}));
  function soltarEscena3D(){escena3D?.destruir();escena3D=null;}
  function dibujarDetalle(){
    if(!s.carta){ir('cartas');return;}vaciarContenido();panel.dataset.vista='detalle';
    const c=dato(s.carta),cab=crear('div','coleccionDetalleCabecera'),atras=boton('Mis cartas',()=>ir('cartas'),'coleccionAtras');atras.prepend(icono('flecha'));
    cab.append(atras,crear('h3','',c.n),crear('p','',limpiarTexto(c.sub)));contenido.append(cab);
    const versiones=crear('div','coleccionVersiones');
    ACABADOS.forEach(a=>{
      const tiene=modelo().tiene(s.carta,a),cantidad=modelo().cantidad(s.carta,a),elegida=modelo().elegido(s.carta)===a,slot=crear('section','coleccionVersion');slot.dataset.edicion=a;slot.classList.toggle('elegida',elegida);slot.classList.toggle('bloqueada',!tiene);slot.classList.toggle('vista',s.acabadoVista===a);
      const etiqueta=boton(NOMBRES[a],()=>{s.acabadoVista=a;dibujarDetalle();},'coleccionElegirAcabado');etiqueta.setAttribute('aria-pressed',s.acabadoVista===a?'true':'false');etiqueta.setAttribute('aria-label',NOMBRES[a]+'. '+textoCopias(cantidad)+'.');slot.append(etiqueta,carta(s.carta,a));
      const estadoEd=crear('span','coleccionEstadoEdicion'),copias=crear('span','coleccionCantidadEdicion',textoCopias(cantidad));copias.dataset.cantidad=cantidad;
      const separador=crear('span','coleccionCantidadSeparador','·');separador.setAttribute('aria-hidden','true');
      estadoEd.append(copias,separador,icono(elegida?'check':tiene?'libro':'candado'),crear('span','',elegida?'En uso':tiene?'Desbloqueada':a==='dorado'?'Por canje':'En sobres o canje'));slot.append(estadoEd);
      const b=boton(elegida?'En uso':tiene?'Usar':a==='dorado'?'Ver cómo mejorar':'Ver sobres',()=>{
        if(!tiene){ir(a==='dorado'?'canje':'sobres');return;}
        guardando=true;let ok=false;try{ok=modelo().seleccionar(s.carta,a);}finally{guardando=false;}
        if(ok){dibujarDetalle();actualizarCabecera();mensaje(c.n+' · '+NOMBRES[a]+' equipada.');sonido('ui_confirm');const activo=contenido.querySelector('[data-edicion="'+a+'"] button');activo?.focus({preventScroll:true});}
        else mensaje('No se pudo guardar la selección. Inténtalo de nuevo.',true);
      },'coleccionUsar');b.disabled=elegida;b.setAttribute('aria-label',elegida?NOMBRES[a]+' en uso':tiene?'Usar edición '+NOMBRES[a]:a==='dorado'?'Ver cómo conseguir una Dorada':'Desbloquear Foil en sobres o por canje');slot.append(b,mejoraDeCarta(s.carta,a));versiones.append(slot);
    });
    const zona=crear('div','coleccionDetalle3D');
    if(window.CAOZ_VISOR3D?.montar){
      zona.classList.add('con3D');const escenario=crear('div','coleccionEscena3D');
      if(escena3D&&escena3D.id!==s.carta)soltarEscena3D();
      if(escena3D)escenario.append(escena3D.raiz);
      zona.append(escenario,versiones);contenido.append(zona);
      if(escena3D)escena3D.actualizar({ediciones:edicionesDe(s.carta),edicion:s.acabadoVista});
      else escena3D=window.CAOZ_VISOR3D.montar(escenario,{id:s.carta,titulo:c.n,inicial:s.acabadoVista,logoUrl:'art/logo.webp',sonar:sonido,crearCarta:a=>carta(s.carta,a),ediciones:edicionesDe(s.carta)});
      // En el teléfono la escena ocupa lo que dejan libre los controles de abajo.
      const medirControles=()=>{zona.style.setProperty('--controles-alto',Math.ceil(versiones.getBoundingClientRect().height+20)+'px');escena3D?.medir();};
      medirControles();requestAnimationFrame(medirControles);
    }else{zona.append(versiones);contenido.append(zona);}
    const reglas=crear('section','coleccionReglas');reglas.setAttribute('aria-label','Información de la carta');
    const linea=crear('div','coleccionReglasTitulo');linea.append(crear('strong','','Habilidades'));
    const stats=c.t==='personaje'?'Coste '+c.c+' · Ataque '+c.a+' · Vida '+c.h:c.t==='protagonista'?'Protagonista':'Coste '+c.c;linea.append(crear('span','',stats));
    reglas.append(linea,crear('p','coleccionReglaTexto'),crear('div','coleccionReglaPaginas'));contenido.append(reglas);
    contenido.append(crear('p','coleccionAviso','Las tres ediciones tienen las mismas habilidades. Tu elección se usa en todas tus partidas.'));
    // Medir en este mismo render evita un fotograma con el retrato del tamaño
    // anterior encima del contador al alternar ediciones en teléfonos bajos.
    encajarCartas();programarAjuste();
  }
  function mejoraDeCarta(id,acabado){
    const caja=crear('div','coleccionMejora');caja.dataset.origen=acabado;
    if(acabado==='dorado'){
      caja.append(crear('p','','La edición más alta. Conservas su diseño para siempre.'),boton('Códigos de cartas físicas',()=>ir('canje'),'coleccionCodigoEnlace'));
      return caja;
    }
    const siguiente=acabado==='normal'?'foil':'dorado',copias=modelo().canjeables(id,acabado),n=NOMBRES[siguiente];
    const progreso=crear('div','coleccionMejoraProgreso'),cuenta=crear('strong','',copias+' / 5');cuenta.dataset.canjeables=copias;
    progreso.append(crear('span','',NOMBRES[acabado]+' → '+n),cuenta);
    const barra=crear('progress');barra.max=5;barra.value=Math.min(5,copias);barra.setAttribute('aria-label',copias+' de 5 copias '+NOMBRES[acabado]+' para mejorar '+dato(id).n);
    const accion=boton('Canjear 5 por 1 '+n,()=>{
      if(guardando)return;guardando=true;accion.disabled=true;let ok=false;
      try{ok=modelo().canjear(id,acabado);}catch(_){}finally{guardando=false;}
      dibujarDetalle();actualizarCabecera();
      if(ok){mensaje(dato(id).n+' · '+n+' conseguida. Conservas todas las ediciones desbloqueadas.');sonido('ui_confirm');contenido.querySelector('[data-edicion="'+siguiente+'"]')?.classList.add('coleccionRecienMejorada');}
      else mensaje(modelo().canjeables(id,acabado)<5?'Necesitas 5 copias ganadas de esta misma carta.':'No se pudo guardar el canje. Tus copias no se han gastado; inténtalo de nuevo.',true);
      contenido.querySelector('[data-edicion="'+acabado+'"] .coleccionElegirAcabado')?.focus({preventScroll:true});
    },'coleccionMejorar');accion.disabled=copias<5;accion.setAttribute('aria-label','Canjear 5 copias '+NOMBRES[acabado]+' de '+dato(id).n+' por 1 '+n);
    caja.append(progreso,barra,accion,crear('p','',acabado==='normal'?'Copias ganadas. Tu Normal inicial se conserva.':'Gastas las copias; el diseño sigue desbloqueado.'));
    return caja;
  }
  function paginacionReglas(){
    if(s.vista!=='detalle')return;const texto=contenido.querySelector('.coleccionReglaTexto'),nav=contenido.querySelector('.coleccionReglaPaginas');if(!texto||!s.carta||!texto.getClientRects().length)return;
    const palabras=(limpiarTexto(dato(s.carta).x)||'Esta carta no tiene habilidades adicionales.').split(' '),paginas=[];
    let desde=0;texto.textContent='';
    // Páginas medidas en el espacio real: las reglas no necesitan una hoja que
    // crezca fuera del teléfono ni una tipografía ilegible para encogerlas.
    while(desde<palabras.length){let bajo=1,alto=palabras.length-desde,mejor=1;
      while(bajo<=alto){const mitad=Math.floor((bajo+alto)/2);texto.textContent=palabras.slice(desde,desde+mitad).join(' ');if(texto.scrollHeight<=texto.clientHeight+1){mejor=mitad;bajo=mitad+1;}else alto=mitad-1;}
      paginas.push(palabras.slice(desde,desde+mejor).join(' '));desde+=mejor;
    }
    s.regla=Math.min(s.regla,paginas.length-1);texto.textContent=paginas[s.regla];nav.replaceChildren();
    if(paginas.length>1){const anterior=boton('‹',()=>{s.regla--;paginacionReglas();}),siguiente=boton('›',()=>{s.regla++;paginacionReglas();});anterior.disabled=s.regla===0;siguiente.disabled=s.regla===paginas.length-1;anterior.setAttribute('aria-label','Página anterior de habilidades');siguiente.setAttribute('aria-label','Página siguiente de habilidades');nav.append(anterior,crear('span','',(s.regla+1)+' / '+paginas.length),siguiente);}
  }
  function destruirVistasSobres(){for(const vista of vistasSobres)vista.destruir();vistasSobres.clear();}
  function vaciarContenido(){destruirVistasSobres();contenido.replaceChildren();}
  function destruirCarrusel(){carruselSobres?.destruir();carruselSobres=null;}
  function colorSobre(nodo,grupo){nodo.dataset.grupo=grupo;nodo.style.setProperty('--sobre-color',COLORES_SOBRES[grupo]||'#947640');}
  function envoltura(grupo){
    const sobre=crear('div','coleccionSobre coleccionSobreColor');colorSobre(sobre,grupo.id);sobre.setAttribute('aria-hidden','true');
    sobre.append(crear('span','coleccionSobreMarca','CAOZ'),crear('span','coleccionSobreLinea','CON TODO'),icono('libro'),crear('span','coleccionSobreSello','✦'),crear('span','coleccionSobreColeccion',grupo.nombre),crear('span','coleccionSobreLeyenda','5 CARTAS'));
    // La misma textura de la apertura, sin montar una escena 3D por cada sobre.
    // El papel CSS queda como respaldo si el módulo aún no está disponible.
    if(window.CAOZ_SOBRES_ESCENA?.previsualizar){
      const host=crear('div','coleccionSobreReal');sobre.append(host);
      try{const vista=window.CAOZ_SOBRES_ESCENA.previsualizar(host,{grupo:grupo.id,logoUrl:'art/logo.webp'});if(vista?.destruir){vistasSobres.add(vista);sobre.classList.add('conSobreReal');}else host.remove();}
      catch(_){host.remove();}
    }
    return sobre;
  }
  function abrirRecompensaSobres(opciones={}){
    if(!modelo())return false;
    const {origen:tipo,referencia,onCerrar,onConfirmar}=opciones,solicitaFinal=opciones.finalCampana===true;
    if(solicitaFinal&&tipo!=='campana')return false;
    const premio=modelo().recompensasPendientes().find(p=>(!tipo||p.origen===tipo)&&(!referencia||p.referencia===referencia));
    if(solicitaFinal){
      // El final sólo representa el recibo de tres sobres de esta campaña.
      // No abrimos una pantalla imposible si otro dispositivo ya lo resolvió.
      if(!premio||premio.cantidad!==3)return false;
      if(esFinalCampana())return finalCampana.premioId===premio.id;
      finalCampana={activa:true,premioId:premio.id,referencia:premio.referencia,indice:0,confirmando:false,terminando:false,notificado:false,frame:0,foco:0,temporizador:0,onConfirmar:typeof onConfirmar==='function'?onConfirmar:null};
      alCerrarRecompensa=null;conservarFondo=true;s.eleccion=[];s.recompensaId=premio.id;
      if(!panel?.open)abrir({conservarFondo:true,finalCampana:true});else aplicarModoFinalCampana(true);
      ir('recompensa');return true;
    }
    // Ninguna acción secundaria puede reemplazar la decisión obligatoria del
    // epílogo mientras el jugador elige los tres sobres.
    if(esFinalCampana())return false;
    if(!panel?.open)abrir({conservarFondo:true,onCerrar});else{conservarFondo=true;if(typeof onCerrar==='function')alCerrarRecompensa=onCerrar;}
    if(premio){if(s.recompensaId!==premio.id)s.eleccion=[];s.recompensaId=premio.id;ir('recompensa');}
    else{s.mostrarPendiente=false;ir('sobres');}
    return true;
  }
  function elegirPendiente(premio){
    if(!premio)return;if(s.recompensaId!==premio.id)s.eleccion=[];s.recompensaId=premio.id;ir('recompensa');
  }
  function verContenidoSobre(id,volver){s.grupoSobre=id;s.volverContenido=volver;ir('contenidoSobre');}
  function tasasSobre(){
    const tasas=crear('div','coleccionTasas');tasas.append(crear('strong','','3 Normales + 1 Foil garantizadas'),crear('p','','Quinta carta: 50% Normal · 50% Foil.'),crear('p','','Todas las cartas del grupo tienen la misma probabilidad. Sin cartas iguales en un sobre. Doradas: por canje, no salen en sobres.'));return tasas;
  }
  function dibujarContenidoSobre(){
    destruirCarrusel();destruirApertura();vaciarContenido();panel.dataset.vista='contenidoSobre';
    const grupo=modelo().grupos().find(g=>g.id===s.grupoSobre);if(!grupo){ir('sobres');return;}
    const cab=crear('div','coleccionSobreTitulo');cab.append(crear('h3','',grupo.nombre),crear('p','',grupo.ids.length+' cartas posibles'));contenido.append(cab);
    const lista=crear('div','coleccionContenidoGrupo coleccionContenidoCompleto');lista.id='coleccionContenidoGrupo';lista.setAttribute('role','region');lista.setAttribute('aria-label','Contenido de '+grupo.nombre);lista.tabIndex=0;
    grupo.ids.forEach(id=>lista.append(crear('span','',dato(id).n)));contenido.append(lista,tasasSobre(),boton('Volver a los sobres',()=>ir(s.volverContenido),'coleccionVolverSobres'));
  }
  function medirRecompensa(){
    const opciones=contenido?.querySelector('.coleccionRecompensaOpciones');if(!opciones)return;
    const movil=panel.clientWidth<580,bajo=panel.classList.contains('coleccionBaja'),reserva=movil?(bajo?120:145):177;
    const ancho=Math.max(35,Math.min(170,(opciones.clientWidth-(movil?24:90))/3-18,(opciones.clientHeight-reserva)*.68));
    opciones.style.setProperty('--premio-ancho',ancho+'px');
  }
  /* El final de campaña no reutiliza las tres columnas de la recompensa
     ordinaria: la elección se vive como un último paso de la historia. Los tres
     grupos siguen siendo los componentes reales de Sobre, no ilustraciones de
     reemplazo, y sólo se escriben juntos al confirmar la terna completa. */
  function dibujarRecompensaFinalCampana(){
    const final=finalCampana;
    if(!final?.activa){dibujarRecompensa();return;}
    destruirCarrusel();destruirApertura();vaciarContenido();panel.dataset.vista='recompensa';aplicarModoFinalCampana(true);
    const premio=modelo().recompensasPendientes().find(p=>p.id===final.premioId),grupos=modelo().grupos();
    if(!premio||premio.cantidad!==3){
      panel.dataset.epilogoFase='indisponible';
      const error=crear('section','coleccionFinalCampanaError'),volver=boton('Volver al menú',()=>abandonarFinalCampana(final),'coleccionFinalSalir'),titulo=crear('h3','','La recompensa ya no está disponible');titulo.id='coleccionFinalCampanaTitulo';
      error.append(titulo,crear('p','','No se guardó ningún sobre en esta pantalla. Puedes volver al menú sin quedar atrapado aquí.'),volver);contenido.append(error);
      final.foco=requestAnimationFrame(()=>{final.foco=0;if(finalCampana===final&&panel?.open)volver.focus({preventScroll:true});});return;
    }
    s.eleccion=s.eleccion.filter(id=>grupos.some(g=>g.id===id)).slice(0,3);
    const escena=crear('section','coleccionFinalCampanaEscena');escena.setAttribute('aria-label','Elección final de sobres');
    const cabecera=crear('header','coleccionFinalCampanaCabecera'),titulo=crear('h3','','Elige tus tres sobres');titulo.id='coleccionFinalCampanaTitulo';cabecera.append(crear('span','coleccionAntetitulo','DESEO CONCEDIDO'),titulo,crear('p','','Desliza cada sobre hasta el centro y confirma tu elección. Cada elección queda fijada; puedes repetir colección.'));
    const progreso=crear('div','coleccionFinalCampanaProgreso');progreso.setAttribute('role','status');progreso.setAttribute('aria-live','polite');
    const textoProgreso=crear('strong','coleccionFinalCampanaProgresoTexto'),barraProgreso=crear('progress','coleccionFinalCampanaBarra');barraProgreso.max=3;barraProgreso.value=s.eleccion.length;progreso.append(textoProgreso,barraProgreso);
    const ventana=crear('div','coleccionFinalCarruselVentana'),carrete=crear('div','coleccionFinalCarrusel');carrete.dataset.epilogoCarrusel='';carrete.tabIndex=0;carrete.setAttribute('role','listbox');carrete.setAttribute('aria-label','Colecciones de sobres. Usa flechas o desliza para elegir.');
    const tarjetas=grupos.map((grupo,i)=>{
      const tarjeta=boton('',()=>{if(i===final.indice)elegirActual();else centrar(i);},'coleccionFinalSobre');tarjeta.id='coleccionFinalSobre_'+grupo.id;tarjeta.dataset.epilogoSobre=grupo.id;tarjeta.setAttribute('role','option');tarjeta.setAttribute('aria-label','Sobre '+grupo.nombre);colorSobre(tarjeta,grupo.id);tarjeta.append(envoltura(grupo),crear('strong','coleccionFinalSobreNombre',grupo.nombre));carrete.append(tarjeta);return tarjeta;
    });
    ventana.append(carrete);
    const navegacion=crear('div','coleccionFinalNavegacion'),anterior=boton('‹',()=>mover(-1),'coleccionFinalAnterior'),actual=crear('div','coleccionFinalActual'),siguiente=boton('›',()=>mover(1),'coleccionFinalSiguiente');anterior.setAttribute('aria-label','Colección anterior');siguiente.setAttribute('aria-label','Colección siguiente');navegacion.append(anterior,actual,siguiente);
    const marcas=crear('div','coleccionFinalMarcas');marcas.setAttribute('aria-label','Sobres elegidos');
    const acciones=crear('div','coleccionFinalAcciones'),elegir=boton('',elegirActual,'coleccionFinalElegir'),guardar=boton('Guardar mis 3 sobres',guardarEleccion,'coleccionFinalGuardar');elegir.dataset.epilogoElegir='';guardar.dataset.epilogoConfirmar='';guardar.disabled=true;acciones.append(elegir,guardar);
    const aviso=crear('p','coleccionFinalAviso');aviso.setAttribute('role','alert');
    const fundido=crear('div','coleccionFinalFundido');fundido.setAttribute('aria-hidden','true');
    escena.append(cabecera,progreso,ventana,navegacion,marcas,acciones,aviso,fundido);contenido.append(escena);
    let indice=Math.max(0,Math.min(grupos.length-1,Number.isInteger(final.indice)?final.indice:0)),arrastre=null,omitirClick=false,raf=0,anchoAnterior=0,altoAnterior=0,destino=null,finDesplazamiento=0;
    function etiquetaActual(){return grupos[indice];}
    function seleccionar(i){
      indice=Math.max(0,Math.min(grupos.length-1,i));final.indice=indice;
      const grupo=etiquetaActual();actual.textContent=grupo.nombre;actual.style.setProperty('--sobre-color',COLORES_SOBRES[grupo.id]||'#947640');
      tarjetas.forEach((tarjeta,n)=>{const activa=n===indice;tarjeta.classList.toggle('seleccionado',activa);tarjeta.setAttribute('aria-selected',String(activa));});
      carrete.setAttribute('aria-activedescendant',tarjetas[indice].id);actualizar();
    }
    function objetivo(i){const tarjeta=tarjetas[i];return tarjeta.offsetLeft-carrete.clientWidth/2+tarjeta.offsetWidth/2;}
    function centrar(i,suave=true){
      const siguiente=Math.max(0,Math.min(grupos.length-1,i));if(!carrete.clientWidth){seleccionar(siguiente);return;}
      const left=objetivo(siguiente),animar=suave&&!matchMedia('(prefers-reduced-motion:reduce)').matches&&Math.abs(carrete.scrollLeft-left)>1.5;
      clearTimeout(finDesplazamiento);seleccionar(siguiente);destino=siguiente;carrete.dataset.desplazando=String(animar);carrete.setAttribute('aria-busy',String(animar));actualizar();
      // Igual que el carrusel de Sobres ordinario, el destino explícito sigue
      // siendo la colección activa durante un scroll suave: los puntos medios
      // no pueden cambiar qué sobre va a elegirse.
      carrete.scrollTo({left,behavior:animar?'smooth':'auto'});
      if(!animar){terminarDesplazamiento();return;}
      finDesplazamiento=setTimeout(()=>{
        if(destino===null||!carrete.isConnected)return;
        const ultimo=destino;carrete.scrollTo({left:objetivo(ultimo),behavior:'auto'});seleccionar(ultimo);terminarDesplazamiento();
      },800);
    }
    function cercano(){
      const centro=carrete.scrollLeft+carrete.clientWidth/2;let mejor=0;
      tarjetas.forEach((tarjeta,i)=>{if(Math.abs(tarjeta.offsetLeft+tarjeta.offsetWidth/2-centro)<Math.abs(tarjetas[mejor].offsetLeft+tarjetas[mejor].offsetWidth/2-centro))mejor=i;});return mejor;
    }
    function mover(delta){centrar(indice+delta);}
    function actualizar(){
      const elegidos=s.eleccion.length,grupo=etiquetaActual();barraProgreso.value=elegidos;
      if(!final.confirmando)panel.dataset.epilogoFase=elegidos===3?'confirmar':'elegir';
      textoProgreso.textContent=elegidos===3?'3 de 3 sobres elegidos':'Sobre '+(elegidos+1)+' de 3';
      marcas.replaceChildren();for(let i=0;i<3;i++){const id=s.eleccion[i],marca=crear('i','coleccionFinalMarca');marca.setAttribute('aria-label',id?(grupos.find(g=>g.id===id)?.nombre||'Sobre elegido'):'Sobre pendiente');if(id)colorSobre(marca,id);marcas.append(marca);}
      const bloqueada=final.confirmando,desplazando=carrete.dataset.desplazando==='true';elegir.hidden=elegidos===3;elegir.disabled=bloqueada||elegidos===3||desplazando;elegir.textContent='Elegir '+grupo.nombre;guardar.hidden=elegidos!==3;guardar.disabled=bloqueada||elegidos!==3||desplazando;
      anterior.disabled=indice===0||bloqueada||desplazando;siguiente.disabled=indice===grupos.length-1||bloqueada||desplazando;
      tarjetas.forEach(tarjeta=>tarjeta.disabled=bloqueada||desplazando);
    }
    function elegirActual(){
      if(final.confirmando||carrete.dataset.desplazando==='true'||s.eleccion.length>=3)return;
      s.eleccion.push(etiquetaActual().id);aviso.textContent='';actualizar();sonido('ui_confirm');
    }
    function guardarEleccion(){
      if(final.confirmando||guardando||s.eleccion.length!==3)return;
      final.confirmando=true;panel.dataset.epilogoFase='guardando';guardando=true;guardar.disabled=true;let ok=false;
      // elegirSobres valida la terna y persiste una sola transición del modelo:
      // no se concede nada hasta que los tres tipos están presentes.
      try{ok=modelo().elegirSobres(premio.id,s.eleccion.slice());}catch(_){}finally{guardando=false;}
      if(!ok){final.confirmando=false;actualizar();aviso.textContent='No se pudo guardar tu elección. Los tres sobres siguen pendientes; inténtalo de nuevo.';return;}
      final.sobres=s.eleccion.slice();sonido('ui_confirm');fundirFinalCampana(final,premio);
    }
    function terminarDesplazamiento(){clearTimeout(finDesplazamiento);finDesplazamiento=0;destino=null;carrete.dataset.desplazando='false';carrete.setAttribute('aria-busy','false');actualizar();}
    function seguirDesplazamiento(){
      raf=0;if(!carrete.isConnected||final.confirmando)return;
      if(destino!==null){
        seleccionar(destino);const left=objetivo(destino);
        if(Math.abs(carrete.scrollLeft-left)<=1.5)terminarDesplazamiento();
        else if(carrete.dataset.desplazando!=='true')carrete.scrollTo({left,behavior:'auto'});
      }else seleccionar(cercano());
    }
    function medir(){
      if(!ventana.isConnected)return;const ancho=ventana.clientWidth,alto=ventana.clientHeight;if(ancho===anchoAnterior&&alto===altoAnterior)return;
      anchoAnterior=ancho;altoAnterior=alto;ventana.style.setProperty('--final-sobre-ancho',Math.max(150,Math.min(390,ancho*.62,(alto-20)*.68))+'px');centrar(indice,false);
    }
    function soltar(e){
      if(!arrastre||arrastre.id!==e.pointerId)return;const movido=arrastre.movido;arrastre=null;carrete.classList.remove('arrastrando');
      if(carrete.hasPointerCapture(e.pointerId))carrete.releasePointerCapture(e.pointerId);
      if(movido){omitirClick=true;centrar(cercano());}
    }
    carrete.addEventListener('scroll',()=>{if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(seguirDesplazamiento);},{passive:true});
    carrete.addEventListener('scrollend',seguirDesplazamiento);
    function interrumpirDesplazamiento(){
      if(destino===null)return;
      destino=null;terminarDesplazamiento();carrete.scrollTo({left:carrete.scrollLeft,behavior:'auto'});seleccionar(cercano());
    }
    carrete.addEventListener('wheel',interrumpirDesplazamiento,{passive:true});
    carrete.addEventListener('keydown',e=>{
      if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(carrete.dataset.desplazando==='true')return;if(e.key==='Home')centrar(0);else if(e.key==='End')centrar(grupos.length-1);else mover(e.key==='ArrowRight'?1:-1);}
      else if((e.key==='Enter'||e.key===' ')&&!final.confirmando){e.preventDefault();elegirActual();}
    });
    carrete.addEventListener('focusin',e=>{const i=tarjetas.indexOf(e.target);if(i>=0&&!arrastre)centrar(i);});
    // En táctil el navegador aporta el gesto horizontal nativo y su snap; para
    // ratón y lápiz añadimos el arrastre sin convertir un clic en dos elecciones.
    carrete.addEventListener('pointerdown',e=>{
      if(final.confirmando)return;interrumpirDesplazamiento();if(e.pointerType==='touch'||(e.pointerType==='mouse'&&e.button!==0))return;
      omitirClick=false;arrastre={id:e.pointerId,x:e.clientX,inicio:carrete.scrollLeft,movido:false};
    });
    carrete.addEventListener('pointermove',e=>{
      if(!arrastre||arrastre.id!==e.pointerId)return;const dx=e.clientX-arrastre.x;
      if(!arrastre.movido&&Math.abs(dx)>7){arrastre.movido=true;carrete.setPointerCapture(e.pointerId);carrete.classList.add('arrastrando');}
      if(arrastre.movido){e.preventDefault();carrete.scrollLeft=arrastre.inicio-dx;}
    });
    carrete.addEventListener('pointerup',soltar);carrete.addEventListener('pointercancel',soltar);carrete.addEventListener('lostpointercapture',soltar);
    carrete.addEventListener('click',e=>{if(omitirClick){e.preventDefault();e.stopImmediatePropagation();omitirClick=false;}},true);
    carruselSobres={medir,destruir:()=>{if(raf)cancelAnimationFrame(raf);clearTimeout(finDesplazamiento);destino=null;arrastre=null;}};
    seleccionar(indice);medir();
    // abrir() todavía mostraba la colección previa cuando quiso enfocar. Este
    // frame ocurre ya con el carrete real montado y habilita flechas de inmediato.
    final.foco=requestAnimationFrame(()=>{final.foco=0;if(finalCampana===final&&panel?.open&&!final.confirmando)carrete.focus({preventScroll:true});});
  }
  function fundirFinalCampana(final,premio){
    if(finalCampana!==final||final.notificado||!panel?.open)return;
    // El negro cubre incluso el diálogo: la campaña recibe el control sólo
    // después de que el jugador ya no pueda ver ni modificar la selección.
    panel.dataset.epilogoFase='fundido';panel.classList.add('coleccionFinalCampanaFundiendo');
    final.frame=requestAnimationFrame(()=>{
      final.frame=0;if(finalCampana!==final||final.notificado)return;
      const espera=matchMedia('(prefers-reduced-motion:reduce)').matches?0:460;
      final.temporizador=setTimeout(()=>concluirFinalCampana(final,premio),espera);
    });
  }
  function concluirFinalCampana(final,premio){
    if(finalCampana!==final||final.notificado)return;
    final.temporizador=0;final.notificado=true;final.terminando=true;
    const sobres=Object.freeze((final.sobres||[]).slice()),datos=Object.freeze({premioId:premio.id,origen:'campana',referencia:premio.referencia,sobres,grupos:sobres}),continuar=final.onConfirmar;
    // El callback corre todavía bajo el negro. Si la campaña devuelve una
    // promesa, conserva esa cobertura hasta que el menú ya esté preparado.
    const cerrarAlTerminar=()=>cerrar({restaurarFoco:false});
    try{
      const resultado=continuar?.(datos);
      if(resultado&&typeof resultado.then==='function')Promise.resolve(resultado).catch(error=>console.error('No se pudo continuar tras elegir los sobres de campaña.',error)).finally(cerrarAlTerminar);
      else cerrarAlTerminar();
    }catch(error){console.error('No se pudo continuar tras elegir los sobres de campaña.',error);cerrarAlTerminar();}
  }
  function abandonarFinalCampana(final){
    if(finalCampana!==final||final.notificado)return;
    // Un cambio externo de inventario no debe convertir el selector obligatorio
    // en una prisión. La campaña decide el regreso bajo la misma cobertura que
    // usa al confirmar; esta salida sólo existe para la recuperación de error.
    final.notificado=true;final.terminando=true;
    const vacio=Object.freeze([]),datos=Object.freeze({premioId:final.premioId,origen:'campana',referencia:final.referencia,sobres:vacio,grupos:vacio,interrumpida:true}),continuar=final.onConfirmar;
    const cerrarAlTerminar=()=>cerrar({restaurarFoco:false});
    try{
      const resultado=continuar?.(datos);
      if(resultado&&typeof resultado.then==='function')Promise.resolve(resultado).catch(error=>console.error('No se pudo salir del selector final.',error)).finally(cerrarAlTerminar);
      else cerrarAlTerminar();
    }catch(error){console.error('No se pudo salir del selector final.',error);cerrarAlTerminar();}
  }
  function dibujarRecompensa(){
    destruirCarrusel();destruirApertura();vaciarContenido();panel.dataset.vista='recompensa';
    const premio=modelo().recompensasPendientes().find(p=>p.id===s.recompensaId);if(!premio){s.eleccion=[];ir('sobres');return;}
    const cantidad=Math.min(3,premio.cantidad),grupos=modelo().grupos();s.eleccion=s.eleccion.filter(id=>grupos.some(g=>g.id===id)).slice(0,cantidad);
    const cab=crear('div','coleccionSobreTitulo');cab.append(crear('span','coleccionAntetitulo',premio.origen==='campana'?'CAMPAÑA COMPLETADA':premio.origen==='domo'?'VICTORIA EN EL DOMO':'RECOMPENSA PENDIENTE'),crear('h3','',cantidad===1?'Elige tu sobre':'Elige tus '+cantidad+' sobres'),crear('p','',premio.cantidad>3?'Elige esta tanda de 3. Quedan '+premio.cantidad+' sobres por asignar.':'Puedes repetir colección. Guárdalos y ábrelos cuando quieras.'));contenido.append(cab);
    const opciones=crear('div','coleccionRecompensaOpciones');opciones.setAttribute('role','group');opciones.setAttribute('aria-label','Tipos de sobre para tu recompensa');
    const acciones=[],actualizar=()=>{
      const total=s.eleccion.length;cuenta.textContent=total+' de '+cantidad+' elegidos';cuenta.dataset.elegidos=total;
      confirmar.disabled=total!==cantidad;seleccion.replaceChildren();
      for(let i=0;i<cantidad;i++){const id=s.eleccion[i],g=grupos.find(g=>g.id===id),marca=crear('i','coleccionEleccionMarca');marca.setAttribute('aria-label',g?g.nombre:'Sin elegir');if(id)colorSobre(marca,id);seleccion.append(marca);}
      for(const a of acciones){const n=s.eleccion.filter(id=>id===a.id).length;a.n.textContent=n;a.n.dataset.cantidad=n;a.menos.disabled=n===0;a.mas.disabled=total>=cantidad;a.elegir.disabled=total>=cantidad;a.caja.classList.toggle('seleccionada',n>0);}
    };
    const ajustar=(id,delta)=>{if(guardando)return;const indice=s.eleccion.lastIndexOf(id);if(delta<0&&indice>=0)s.eleccion.splice(indice,1);else if(delta>0&&s.eleccion.length<cantidad)s.eleccion.push(id);actualizar();};
    grupos.forEach(g=>{
      const caja=crear('section','coleccionRecompensaGrupo');colorSobre(caja,g.id);
      const elegir=boton('',()=>ajustar(g.id,1),'coleccionRecompensaElegir');elegir.setAttribute('aria-label','Elegir sobre '+g.nombre);elegir.append(envoltura(g));
      const titulo=crear('h4','',g.nombre),control=crear('div','coleccionRecompensaCantidad'),menos=boton('−',()=>ajustar(g.id,-1),'coleccionRecompensaMenos'),mas=boton('+',()=>ajustar(g.id,1),'coleccionRecompensaMas'),n=crear('output','','0');
      menos.setAttribute('aria-label','Quitar sobre '+g.nombre);mas.setAttribute('aria-label','Añadir sobre '+g.nombre);n.setAttribute('aria-label','Sobres elegidos de '+g.nombre);control.append(menos,n,mas);
      const ver=boton(g.ids.length+' cartas',()=>verContenidoSobre(g.id,'recompensa'),'coleccionRecompensaContenido');ver.setAttribute('aria-label','Ver contenido de '+g.nombre);
      caja.append(elegir,titulo,control,ver);opciones.append(caja);acciones.push({id:g.id,caja,elegir,menos,mas,n});
    });
    const pie=crear('div','coleccionRecompensaPie'),seleccion=crear('div','coleccionEleccionMarcas'),cuenta=crear('p','coleccionEleccionCuenta');cuenta.setAttribute('role','status');cuenta.setAttribute('aria-live','polite');
    const confirmar=boton(cantidad===1?'Guardar sobre':'Guardar sobres',()=>{
      if(guardando||s.eleccion.length!==cantidad)return;guardando=true;confirmar.disabled=true;let ok=false;
      try{ok=modelo().elegirSobres(premio.id,s.eleccion.slice());}catch(_){}finally{guardando=false;}
      if(!ok){if(!modelo().recompensasPendientes().some(p=>p.id===premio.id)){s.eleccion=[];ir('sobres');mensaje('Esta recompensa ya se guardó.');return;}actualizar();mensaje('No se pudo guardar tu elección. La recompensa sigue disponible; inténtalo de nuevo.',true);return;}
      s.grupoSobre=s.eleccion[0];s.eleccion=[];s.mostrarPendiente=false;ir('sobres');mensaje(cantidad===1?'Sobre guardado.':'Sobres guardados.');sonido('ui_confirm');
    },'coleccionGuardarSobres');
    pie.append(seleccion,cuenta,confirmar,boton('Elegir después',()=>ir('sobres'),'coleccionElegirDespues'));contenido.append(opciones,pie);actualizar();medirRecompensa();
  }
  function dibujarSobres(){
    panel.dataset.vista='sobres';const pack=modelo().pendiente(),firma=pack?JSON.stringify([pack.id,pack.grupo,pack.cartas]):null;
    if(pack&&s.mostrarPendiente&&aperturaSobre?.firma===firma&&aperturaSobre.host.parentElement===contenido)return;
    destruirCarrusel();destruirApertura();vaciarContenido();
    if(pack&&s.mostrarPendiente){dibujarRevelacion(pack,firma);return;}
    const grupos=modelo().grupos(),inventario=modelo().inventarioSobres().filter(p=>p.cantidad>0&&grupos.some(g=>g.id===p.grupo)),recompensas=modelo().recompensasPendientes();
    const cab=crear('div','coleccionSobreTitulo');cab.append(crear('span','coleccionAntetitulo','TU TESORO DEL DOMO'),crear('h3','','Mis sobres'),crear('p','','Desliza para elegir cuál abrir.'));contenido.append(cab);
    if(recompensas.length){const numero=recompensas.reduce((n,p)=>n+p.cantidad,0),aviso=crear('div','coleccionSobresPorElegir');aviso.append(crear('span','',numero===1?'Tienes 1 sobre por elegir':'Tienes '+numero+' sobres por elegir'),boton('Elegir',()=>elegirPendiente(recompensas[0]),'coleccionElegirPendientes'));contenido.append(aviso);}
    if(pack){const reanudar=boton('Continuar el sobre abierto',()=>{s.mostrarPendiente=true;dibujarSobres();},'coleccionReanudarSobre');contenido.append(reanudar);}
    if(!inventario.some(p=>p.grupo===s.grupoSobre))s.grupoSobre=inventario[0]?.grupo||'';
    const acciones=crear('div','coleccionSobreAcciones'),abrir=boton('Abrir sobre',()=>{
      if(guardando)return;if(!window.CAOZ_SOBRES?.crear){mensaje('La apertura no está disponible. Recarga la página para intentarlo otra vez.',true);return;}
      if(modelo().pendiente()){s.mostrarPendiente=true;dibujarSobres();return;}
      guardando=true;abrir.disabled=true;let p;try{p=modelo().abrirSobre(s.grupoSobre);}catch(_){}finally{guardando=false;}
      if(!p){dibujarSobres();mensaje('No se pudo abrir. El sobre sigue guardado; inténtalo de nuevo.',true);return;}
      s.mostrarPendiente=true;mensaje('');sonido('ui_confirm');dibujarSobres();actualizarCabecera();
    },'coleccionAbrirSobre');abrir.disabled=!inventario.length;acciones.append(abrir);
    if(inventario.length){
      const escena=crear('div','coleccionBibliotecaSobres'),ventana=crear('div','coleccionCarreteVentana'),carrete=crear('div','coleccionCarruselSobres');carrete.setAttribute('role','region');carrete.setAttribute('aria-label','Tus sobres guardados');carrete.tabIndex=0;
      const botones=inventario.map(item=>{const g=grupos.find(g=>g.id===item.grupo),b=boton('',()=>centrar(item.grupo),'coleccionSobreGuardado');colorSobre(b,item.grupo);b.setAttribute('aria-label',g.nombre+'. '+item.cantidad+(item.cantidad===1?' sobre guardado':' sobres guardados'));b.append(envoltura(g),crear('span','coleccionSobreExistencias','×'+item.cantidad));carrete.append(b);return b;});
      ventana.append(carrete);const navegacion=crear('div','coleccionCarreteNavegacion'),anterior=boton('‹',()=>mover(-1),'coleccionSobreAnterior'),siguiente=boton('›',()=>mover(1),'coleccionSobreSiguiente'),rotulo=crear('div','coleccionSobreSeleccion'),nombre=crear('h4'),cantidad=crear('p');anterior.setAttribute('aria-label','Sobre anterior');siguiente.setAttribute('aria-label','Sobre siguiente');rotulo.setAttribute('aria-live','polite');rotulo.append(nombre,cantidad);navegacion.append(anterior,rotulo,siguiente);escena.append(ventana,navegacion,crear('p','coleccionDeslizarPista','Desliza · Arrastra · Usa las flechas'));contenido.append(escena);
      const ver=boton('Ver contenido',()=>verContenidoSobre(s.grupoSobre,'sobres'),'coleccionVerContenido');acciones.prepend(ver);
      let arrastre=null,omitirClick=false,raf=0,anchoAnterior=0,altoAnterior=0,destino=null,finDesplazamiento=0;
      const indice=()=>Math.max(0,inventario.findIndex(p=>p.grupo===s.grupoSobre));
      function seleccionar(i){const item=inventario[i],g=grupos.find(g=>g.id===item.grupo);s.grupoSobre=item.grupo;botones.forEach((b,j)=>{b.setAttribute('aria-pressed',String(j===i));b.classList.toggle('seleccionado',j===i);});carrete.dataset.grupo=item.grupo;nombre.textContent=g.nombre;cantidad.textContent=item.cantidad+(item.cantidad===1?' sobre guardado':' sobres guardados');anterior.disabled=i===0;siguiente.disabled=i===inventario.length-1;}
      function objetivo(i){return botones[i].offsetLeft-carrete.clientWidth/2+botones[i].offsetWidth/2;}
      function cercano(){const centro=carrete.scrollLeft+carrete.clientWidth/2;let mejor=0;botones.forEach((b,i)=>{if(Math.abs(b.offsetLeft+b.offsetWidth/2-centro)<Math.abs(botones[mejor].offsetLeft+botones[mejor].offsetWidth/2-centro))mejor=i;});return mejor;}
      function terminarDesplazamiento(){clearTimeout(finDesplazamiento);finDesplazamiento=0;carrete.dataset.desplazando='false';carrete.setAttribute('aria-busy','false');abrir.disabled=false;}
      function centrar(id,suave=true){
        const i=Math.max(0,inventario.findIndex(p=>p.grupo===id)),left=objetivo(i),animar=suave&&!matchMedia('(prefers-reduced-motion:reduce)').matches&&Math.abs(carrete.scrollLeft-left)>1.5;
        clearTimeout(finDesplazamiento);seleccionar(i);destino=i;carrete.dataset.desplazando=String(animar);carrete.setAttribute('aria-busy',String(animar));abrir.disabled=animar;
        // La elección es el destino explícito. Los puntos intermedios de un
        // scroll suave no pueden cambiar el tipo del sobre que se va a abrir.
        carrete.scrollTo({left,behavior:animar?'smooth':'instant'});
        if(!animar){terminarDesplazamiento();return;}
        // Si el navegador interrumpe la animación sin llegar ni emitir scrollend,
        // completar el mismo destino evita dejar Abrir bloqueado indefinidamente.
        finDesplazamiento=setTimeout(()=>{if(destino===null||!carrete.isConnected)return;const ultimo=destino;carrete.scrollTo({left:objetivo(ultimo),behavior:'instant'});seleccionar(ultimo);terminarDesplazamiento();},800);
      }
      function mover(delta){centrar(inventario[Math.max(0,Math.min(inventario.length-1,indice()+delta))].grupo);}
      function medir(){if(!carrete.isConnected)return;const ancho=ventana.clientWidth,alto=ventana.clientHeight;if(ancho===anchoAnterior&&alto===altoAnterior)return;anchoAnterior=ancho;altoAnterior=alto;ventana.style.setProperty('--sobre-ancho',Math.max(40,Math.min(250,ancho*.62,(alto-24)*.68))+'px');centrar(s.grupoSobre,false);}
      function seguirDesplazamiento(){
        if(!carrete.isConnected)return;
        if(destino!==null){
          seleccionar(destino);const left=objetivo(destino);
          if(Math.abs(carrete.scrollLeft-left)<=1.5)terminarDesplazamiento();
          // Un compositor que se reactiva tarde puede entregar otro scroll
          // después del fallback. Conservar la elección explícita impide que
          // ese evento elija o consuma otro tipo sin una acción del jugador.
          else if(carrete.dataset.desplazando!=='true')carrete.scrollTo({left,behavior:'instant'});
        }
        else seleccionar(cercano());
      }
      function interrumpirDesplazamiento(){
        if(destino===null)return;destino=null;terminarDesplazamiento();carrete.scrollTo({left:carrete.scrollLeft,behavior:'instant'});seleccionar(cercano());
      }
      carrete.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(seguirDesplazamiento);},{passive:true});
      carrete.addEventListener('scrollend',seguirDesplazamiento);
      carrete.addEventListener('wheel',interrumpirDesplazamiento,{passive:true});
      carrete.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(e.key==='Home')centrar(inventario[0].grupo);else if(e.key==='End')centrar(inventario.at(-1).grupo);else mover(e.key==='ArrowRight'?1:-1);});
      carrete.addEventListener('focusin',e=>{const i=botones.indexOf(e.target);if(i>=0&&!arrastre)centrar(inventario[i].grupo);});
      carrete.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;interrumpirDesplazamiento();if(e.pointerType!=='mouse')return;omitirClick=false;arrastre={id:e.pointerId,x:e.clientX,inicio:carrete.scrollLeft,movido:false};});
      carrete.addEventListener('pointermove',e=>{if(!arrastre||arrastre.id!==e.pointerId)return;const dx=e.clientX-arrastre.x;if(!arrastre.movido&&Math.abs(dx)>7){arrastre.movido=true;carrete.setPointerCapture(e.pointerId);carrete.classList.add('arrastrando');}if(arrastre.movido){e.preventDefault();carrete.scrollLeft=arrastre.inicio-dx;}});
      const soltar=e=>{if(!arrastre||arrastre.id!==e.pointerId)return;const movido=arrastre.movido;arrastre=null;carrete.classList.remove('arrastrando');if(carrete.hasPointerCapture(e.pointerId))carrete.releasePointerCapture(e.pointerId);if(movido){omitirClick=true;centrar(inventario[cercano()].grupo);}};
      carrete.addEventListener('pointerup',soltar);carrete.addEventListener('pointercancel',soltar);carrete.addEventListener('lostpointercapture',e=>{if(arrastre?.id===e.pointerId)soltar(e);});
      carrete.addEventListener('click',e=>{if(omitirClick){e.preventDefault();e.stopImmediatePropagation();omitirClick=false;}},true);
      carruselSobres={medir,destruir:()=>{cancelAnimationFrame(raf);clearTimeout(finDesplazamiento);destino=null;arrastre=null;}};
      seleccionar(indice());contenido.append(acciones);medir();
    }else{
      const vacio=crear('div','coleccionSobresVacios'),sello=crear('div','coleccionSobresVaciosSello');sello.append(icono('sobre'));vacio.append(sello,crear('h4','','Tu tesoro empieza aquí'),crear('p','',recompensas.length?'Elige las colecciones de tus recompensas para guardar tus primeros sobres.':'Gana una partida contra el Domo para conseguir 1 sobre, o completa la campaña para ganar 3.'));contenido.append(vacio,acciones);
    }
    if(modelo().betaDisponible()){const beta=boton('Sobre de prueba · Beta',()=>{if(guardando)return;guardando=true;let ok;try{ok=modelo().darSobreBeta();}finally{guardando=false;}if(ok){dibujarSobres();actualizarCabecera();mensaje('Recompensa de prueba añadida. Elige su colección.');}else mensaje('No se pudo añadir el sobre. Inténtalo de nuevo.',true);},'coleccionBeta');acciones.append(beta);}
    carruselSobres?.medir();
  }
  function dibujarCanje(){
    vaciarContenido();panel.dataset.vista='canje';
    const caja=crear('section','coleccionTaller');caja.append(crear('h3','','Mejora tus cartas'),crear('p','coleccionTallerRegla','5 Normales → 1 Foil · 5 Foils → 1 Dorada'),crear('p','coleccionTallerNota','Siempre de la misma carta. Los diseños desbloqueados se conservan; tu Normal inicial no se gasta.'));
    const listas=crear('div','coleccionCanjesListos');listas.setAttribute('role','region');listas.setAttribute('aria-label','Cartas con copias listas para mejorar');listas.tabIndex=0;
    for(const id of modelo().ids())for(const acabado of ['normal','foil']){
      const n=modelo().canjeables(id,acabado);if(n<5)continue;
      const b=boton('',()=>{verCarta(id);s.acabadoVista=acabado;dibujarDetalle();},'coleccionCanjeListo');b.dataset.carta=id;b.dataset.origen=acabado;b.append(crear('strong','',dato(id).n),crear('span','',NOMBRES[acabado]+' → '+NOMBRES[acabado==='normal'?'foil':'dorado']+' · '+n+' copias'));listas.append(b);
    }
    if(!listas.children.length)listas.append(crear('p','','Aún no reúnes 5 copias iguales. Abre sobres o revisa tu progreso en cada carta.'));
    caja.append(listas,boton('Elegir una carta',()=>ir('cartas'),'coleccionElegirParaCanje'));
    const fisicas=crear('details','coleccionCanjeFisico');fisicas.append(crear('summary','','Códigos de cartas físicas'));
    const label=crear('label','coleccionCanjeCodigo','Código de tu carta física'),input=crear('input');input.type='text';input.placeholder='Próximamente';input.disabled=true;label.append(input);fisicas.append(label,crear('p','','Próximamente. Ningún código se envía ni se guarda.'));caja.append(fisicas);contenido.append(caja);
  }
  function cerrarPendiente(registro){
    if(aperturaSobre!==registro||registro.cancelada||!panel.open||guardando)return false;
    const pendiente=modelo().pendiente();
    // Un cambio de otra pestaña no permite que una escena vieja cierre el
    // siguiente sobre. Se muestra el pendiente vigente sin consumir ninguno.
    if(pendiente&&pendiente.id!==registro.id){dibujarSobres();actualizarCabecera();return true;}
    guardando=true;let ok=false;
    try{ok=modelo().cerrarSobre();}catch(_){}finally{guardando=false;}
    if(!ok){registro.errorCierre=true;mensaje('No se pudo guardar el cierre. Tus cartas siguen guardadas. Pulsa Reintentar.',true);return false;}
    destruirApertura();ir('sobres');mensaje('Tus cartas ya están en la colección.');return true;
  }
  function dibujarRevelacion(pack,firma){
    const host=crear('div','coleccionAperturaSobre');host.dataset.packId=pack.id;host.dataset.total=pack.cartas.length;
    host.setAttribute('aria-label','Apertura de '+pack.cartas.length+' cartas');contenido.append(host);panel.classList.add('coleccionAbriendoSobre');
    const registro={id:pack.id,firma,host,componente:null,cancelada:false,errorCierre:false};aperturaSobre=registro;
    const vigente=()=>aperturaSobre===registro&&!registro.cancelada&&panel.open&&s.vista==='sobres';
    function montar(){
      host.replaceChildren(crear('p','coleccionAperturaCargando','Preparando el sobre…'));
      // Primero llegan los encuadres y el catálogo disponible. Después el
      // componente crea los frentes reales y espera sus imágenes y decode().
      Promise.resolve().then(()=>typeof cargarArte==='function'?cargarArte():null).then(()=>{
        if(!vigente())return;
        if(!window.CAOZ_SOBRES?.crear)throw Error('La apertura aún no está disponible.');
        registro.componente=window.CAOZ_SOBRES.crear(host,{variante:'reliquia',logoUrl:'art/logo.webp',grupo:pack.grupo,
          cartas:pack.cartas.map(item=>({...item,nombre:dato(item.id).n})),crearCarta:cartaSobre,
          onVolver:()=>cerrarPendiente(registro),onCambio:actual=>{
            if(!vigente())return;host.dataset.fase=actual.fase;
            if(actual.fase==='terminado'&&registro.errorCierre){const b=host.querySelector('.sobresAccion');if(b){b.textContent='Reintentar';b.classList.add('coleccionReintentarCierre');}}
          }});
      }).catch(()=>{
        if(!vigente())return;
        registro.componente?.destruir();registro.componente=null;
        const error=crear('div','coleccionAperturaError');error.append(crear('p','','No se pudo preparar la apertura. El contenido del sobre sigue guardado.'),boton('Reintentar',montar,'coleccionReintentarApertura'));host.replaceChildren(error);
      });
    }
    montar();
  }
  // La función es global porque los dos menús la invocan al pulsar Colección.
  window.abrirColeccion=abrir;
  window.abrirRecompensaSobres=abrirRecompensaSobres;
  const instalar=()=>{window.showGallery=abrir;if(new URLSearchParams(location.search).get('coleccion')==='1')abrir();};
  if(document.readyState==='complete')instalar();else addEventListener('load',instalar,{once:true});
})();

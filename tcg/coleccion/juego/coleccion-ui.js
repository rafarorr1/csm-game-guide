/* La colección del jugador: ediciones equipables y sobres. Las reglas de las
   cartas permanecen en el motor; las ilustraciones siguen el estudio público. */
'use strict';
(function(){
  const ACABADOS=['normal','foil','dorado'];
  const NOMBRES={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  const $=s=>document.querySelector(s);
  const crear=(tag,clase,texto)=>{const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;};
  const modelo=()=>window.CAOZ_COLECCION;
  const textoCopias=n=>n+' '+(n===1?'copia':'copias');
  const limpiarTexto=t=>{const d=document.createElement('div');d.innerHTML=t||'';return d.textContent.replace(/\s+/g,' ').trim();};
  const normalizar=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let panel,contenido,barra,estado,volverFoco,origen,observador,frame=0,guardando=false,restaurarLista=false,focoLista=null,aperturaSobre=null;
  const s={vista:'cartas',busqueda:'',mazo:'todos',tipo:'todos',desplazamiento:0,carta:null,acabadoVista:'normal',regla:0};
  function dato(id){
    if(id.startsWith('lider_')){const l=LEADERS[id.slice(6)];return {id,n:l.n,t:'protagonista',art:l.art,c:'✦',x:[l.pasiva,typeof l.hab==='object'?'<b>'+l.hab.n+':</b> '+l.hab.d:l.hab,l.hab2?'<b>'+l.hab2.n+':</b> '+l.hab2.d:''].filter(Boolean).join(' '),sub:l.ep};}
    const c=CARDS[id];return {...c,id,sub:typeof tribeLine==='function'?tribeLine(c):c.t};
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
  function mensaje(texto,error=false){if(!estado)return;estado.textContent=texto;estado.classList.toggle('error',error);}
  function limpiarTiempos(){guardando=false;cancelAnimationFrame(frame);}
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
    encajarCartas();
  }
  function encajarCartas(){
    if(!panel?.open)return;
    const movil=panel.clientWidth<550;
    panel.querySelectorAll('.coleccionCarta').forEach(n=>{
      if(n.closest('.sobresApertura'))return;
      if(!n.getClientRects().length)return;
      const p=n.parentElement,clase=p.classList;let alto=p.clientHeight,ancho=p.clientWidth;
      // Las filas de la lista crecen con el ancho de sus tres columnas. No
      // dependemos de la altura visible: el resto se recorre con scroll.
      const mini=clase.contains('coleccionMini');
      if(mini){alto=280;ancho=206;n.style.zoom=Math.max(.1,(p.clientWidth-8)/200);}
      else if(clase.contains('coleccionVersion')&&movil){const caja=p.parentElement;alto=caja.clientHeight-118;ancho=caja.clientWidth-30;}
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
    panel.addEventListener('cancel',e=>{e.preventDefault();if(s.vista==='detalle')ir('cartas');else cerrar();});
    panel.addEventListener('close',limpiar);
    // El diálogo nativo atrapa el foco y deja inerte el juego que queda debajo.
    panel.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
    document.body.append(panel);
  }
  function abrir(){
    if(!modelo())return;
    crearPanel();if(panel.open)return;
    volverFoco=document.activeElement;origen=document.querySelector('.screen.on');
    s.vista=modelo().pendiente()?'sobres':'cartas';s.carta=null;
    if(typeof cerrarOv==='function'&&$('#ov.on'))cerrarOv();
    panel.showModal();
    panel.querySelector('.coleccionVolver').textContent=origen?.id==='extras'?'Volver a Extras':'Volver';
    window.addEventListener('resize',medida);window.visualViewport?.addEventListener('resize',medida);window.visualViewport?.addEventListener('scroll',medida);
    window.addEventListener('caoz:coleccion',cambio);window.addEventListener('caoz:arte',arteActualizado);window.addEventListener('caoz:coleccion-error',falloGuardado);
    medida();dibujar();
    observador=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(medida);});observador.observe(panel);
    if(typeof animarTransicionMenu==='function')animarTransicionMenu(panel.querySelector('.coleccionInterior'),panel);
    panel.querySelector('.coleccionCerrar').focus({preventScroll:true});
  }
  function limpiar(evento){
    // close se encola: no desmontar una Colección que ya se volvió a abrir.
    if(evento?.type==='close'&&panel?.open)return;
    destruirApertura();limpiarTiempos();observador?.disconnect();observador=null;
    window.removeEventListener('resize',medida);window.visualViewport?.removeEventListener('resize',medida);window.visualViewport?.removeEventListener('scroll',medida);
    window.removeEventListener('caoz:coleccion',cambio);window.removeEventListener('caoz:arte',arteActualizado);window.removeEventListener('caoz:coleccion-error',falloGuardado);
    // El evento close llega después de comenzar el regreso. Limpiar sólo una
    // transición de este diálogo, nunca el nuevo barrido del menú de destino.
    if(panel?.querySelector('.barridoModal,.coleccionInterior.menuEntra')&&typeof limpiarTransicionMenu==='function')limpiarTransicionMenu();
  }
  function cerrar(){
    if(!panel?.open)return;guardarPosicionLista();limpiar();panel.close();
    if(origen?.isConnected&&typeof animarTransicionMenu==='function')animarTransicionMenu(origen);
    if(volverFoco?.isConnected)volverFoco.focus({preventScroll:true});
  }
  function falloGuardado(){mensaje('No se pudo guardar. Libera espacio en el navegador e inténtalo otra vez.',true);}
  function cambio(){if(!panel?.open||guardando)return;actualizarCabecera();if(s.vista==='detalle')dibujarDetalle();else if(s.vista==='cartas')dibujarLista();else if(s.vista==='canje')dibujarCanje();else dibujarSobres();}
  function arteActualizado(){if(!panel?.open)return;panel.querySelectorAll('.coleccionCarta').forEach(actualizarCarta);}
  function actualizarCabecera(){
    const m=modelo(),ids=m.ids(),premium=ids.reduce((n,id)=>n+(m.tiene(id,'foil')?1:0)+(m.tiene(id,'dorado')?1:0),0);
    panel.querySelector('.coleccionTotales').textContent=ids.length+' normales · '+premium+' ediciones especiales';
    barra.replaceChildren();const cartas=boton('Mis cartas',()=>ir('cartas'),'coleccionPestana'),sobres=boton('Sobres',()=>ir('sobres'),'coleccionPestana'),canje=boton('Canjear',()=>ir('canje'),'coleccionPestana');
    cartas.prepend(icono('libro'));sobres.prepend(icono('sobre'));sobres.append(crear('span','coleccionNumero',m.sobres()));
    cartas.setAttribute('aria-current',s.vista==='cartas'||s.vista==='detalle'?'page':'false');sobres.setAttribute('aria-current',s.vista==='sobres'?'page':'false');canje.prepend(icono('candado'));canje.setAttribute('aria-current',s.vista==='canje'?'page':'false');barra.append(cartas,sobres,canje);
  }
  function guardarPosicionLista(){if(s.vista==='cartas'&&!restaurarLista)s.desplazamiento=contenido.querySelector('.coleccionRejilla')?.scrollTop||0;}
  function ir(vista){guardarPosicionLista();if(s.vista==='detalle'&&vista==='cartas')focoLista=s.carta;limpiarTiempos();s.vista=vista;mensaje('');dibujar();}
  function dibujar(){actualizarCabecera();panel.dataset.vista=s.vista;if(s.vista==='sobres'){dibujarSobres();return;}destruirApertura();contenido.replaceChildren();if(s.vista==='cartas')dibujarGaleria();else if(s.vista==='detalle')dibujarDetalle();else dibujarCanje();}
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
      const c=dato(id),a=modelo().elegido(id),cantidad=modelo().cantidad(id),b=boton('',()=>verCarta(id),'coleccionMini');b.dataset.carta=id;b.setAttribute('aria-label',c.n+'. '+textoCopias(cantidad)+' en tu colección. Edición '+NOMBRES[a]+'. Ver tres versiones.');
      const ficha=carta(id,a),info=crear('span','coleccionMiniInfo');
      const pie=crear('span','coleccionMiniPie');pie.append(crear('span','',NOMBRES[a]));const puntos=crear('span','coleccionPuntos');
      ACABADOS.forEach(v=>{const p=crear('i');p.dataset.edicion=v;p.classList.toggle('propia',modelo().tiene(id,v));p.classList.toggle('elegida',v===a);p.title=NOMBRES[v]+': '+textoCopias(modelo().cantidad(id,v));puntos.append(p);});
      const copias=crear('span','coleccionCopias','×'+cantidad);copias.dataset.cantidad=cantidad;copias.title=textoCopias(cantidad)+' en tu colección';copias.setAttribute('aria-hidden','true');
      pie.append(puntos,copias);info.append(pie);b.append(ficha,info);grid.append(b);
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
    // Se usa la misma carta del tablero, conservando sus ilustraciones, reglas,
    // marco y medallones. Clonar evita activar acciones de combate al explorar.
    const original=id.startsWith('lider_')?cartaDeLiderVS(id.slice(6),''):cardEl(id,{}),n=original.cloneNode(true);
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
  function dibujarDetalle(){
    if(!s.carta){ir('cartas');return;}contenido.replaceChildren();panel.dataset.vista='detalle';
    const c=dato(s.carta),cab=crear('div','coleccionDetalleCabecera'),atras=boton('Mis cartas',()=>ir('cartas'),'coleccionAtras');atras.prepend(icono('flecha'));
    cab.append(atras,crear('h3','',c.n),crear('p','',limpiarTexto(c.sub)));contenido.append(cab);
    const versiones=crear('div','coleccionVersiones');
    ACABADOS.forEach(a=>{
      const tiene=modelo().tiene(s.carta,a),cantidad=modelo().cantidad(s.carta,a),elegida=modelo().elegido(s.carta)===a,slot=crear('section','coleccionVersion');slot.dataset.edicion=a;slot.classList.toggle('elegida',elegida);slot.classList.toggle('bloqueada',!tiene);slot.classList.toggle('vista',s.acabadoVista===a);
      const etiqueta=boton(NOMBRES[a],()=>{s.acabadoVista=a;dibujarDetalle();},'coleccionElegirAcabado');etiqueta.setAttribute('aria-pressed',s.acabadoVista===a?'true':'false');etiqueta.setAttribute('aria-label',NOMBRES[a]+'. '+textoCopias(cantidad)+'.');slot.append(etiqueta,carta(s.carta,a));
      const estadoEd=crear('span','coleccionEstadoEdicion'),copias=crear('span','coleccionCantidadEdicion',textoCopias(cantidad));copias.dataset.cantidad=cantidad;
      const separador=crear('span','coleccionCantidadSeparador','·');separador.setAttribute('aria-hidden','true');
      estadoEd.append(copias,separador,icono(elegida?'check':tiene?'libro':'candado'),crear('span','',elegida?'En uso':tiene?'Desbloqueada':a==='dorado'?'Carta física':'En sobres'));slot.append(estadoEd);
      const b=boton(elegida?'En uso':tiene?'Usar':a==='dorado'?'Canjear código':'Ver sobres',()=>{
        if(!tiene){ir(a==='dorado'?'canje':'sobres');return;}
        guardando=true;let ok=false;try{ok=modelo().seleccionar(s.carta,a);}finally{guardando=false;}
        if(ok){dibujarDetalle();actualizarCabecera();mensaje(c.n+' · '+NOMBRES[a]+' equipada.');sonido('ui_confirm');const activo=contenido.querySelector('[data-edicion="'+a+'"] button');activo?.focus({preventScroll:true});}
        else mensaje('No se pudo guardar la selección. Inténtalo de nuevo.',true);
      },'coleccionUsar');b.disabled=elegida;b.setAttribute('aria-label',elegida?NOMBRES[a]+' en uso':tiene?'Usar edición '+NOMBRES[a]:a==='dorado'?'Canjear el código de una carta física':'Desbloquear Foil en sobres');slot.append(b);versiones.append(slot);
    });
    contenido.append(versiones);
    const reglas=crear('section','coleccionReglas');reglas.setAttribute('aria-label','Información de la carta');
    const linea=crear('div','coleccionReglasTitulo');linea.append(crear('strong','','Habilidades'));
    const stats=c.t==='personaje'?'Coste '+c.c+' · Ataque '+c.a+' · Vida '+c.h:c.t==='protagonista'?'Protagonista':'Coste '+c.c;linea.append(crear('span','',stats));
    reglas.append(linea,crear('p','coleccionReglaTexto'),crear('div','coleccionReglaPaginas'));contenido.append(reglas);
    contenido.append(crear('p','coleccionAviso','Las tres ediciones tienen las mismas habilidades. Tu elección se usa en todas tus partidas.'));
    programarAjuste();
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
  function dibujarSobres(){
    panel.dataset.vista='sobres';const pack=modelo().pendiente(),firma=pack?JSON.stringify([pack.id,pack.cartas]):null;
    // El modelo entrega copias del pendiente en cada evento. Su contenido, no
    // la identidad del objeto, decide si hay que cambiar la escena montada.
    if(pack&&aperturaSobre?.firma===firma&&aperturaSobre.host.parentElement===contenido)return;
    destruirApertura();contenido.replaceChildren();if(pack){dibujarRevelacion(pack,firma);return;}
    const cab=crear('div','coleccionSobreTitulo');cab.append(crear('span','coleccionAntetitulo','TESOROS POR DESCUBRIR'),crear('h3','','Ediciones del Domo'),crear('p','','Termina una campaña y recibe un sobre con 5 cartas Foil aleatorias.'));contenido.append(cab);
    const escena=crear('div','coleccionSobreEscena'),sobre=crear('div','coleccionSobre');sobre.setAttribute('aria-hidden','true');
    sobre.append(crear('span','coleccionSobreMarca','CAOZ'),crear('span','coleccionSobreLinea','CON TODO'),icono('libro'),crear('span','coleccionSobreSello','✦'),crear('span','coleccionSobreLeyenda','5 CARTAS FOIL'));
    escena.append(crear('div','coleccionSobreAura'),sobre);contenido.append(escena);
    const acciones=crear('div','coleccionSobreAcciones'),n=modelo().sobres(),abrir=boton(n?'Abrir sobre':'Completa una campaña',()=>{
      if(guardando)return;
      if(!window.CAOZ_SOBRES?.crear){mensaje('La apertura no está disponible. Recarga la página para intentarlo otra vez.',true);return;}
      guardando=true;abrir.disabled=true;let p;
      try{p=modelo().abrirSobre();}finally{guardando=false;}
      if(!p){abrir.disabled=false;mensaje('No se pudo abrir. Comprueba tus sobres o el espacio disponible para guardar.',true);return;}
      mensaje('');sonido('ui_confirm');dibujarSobres();actualizarCabecera();
    },'coleccionAbrirSobre');abrir.disabled=!n;acciones.append(crear('p','coleccionSobreCuenta',n===1?'Tienes un sobre por abrir':'Tienes '+n+' sobres por abrir'),abrir);
    if(modelo().betaDisponible()){const beta=boton('Sobre de prueba · Beta',()=>{if(guardando)return;guardando=true;let ok;try{ok=modelo().darSobreBeta();}finally{guardando=false;}if(ok){dibujarSobres();actualizarCabecera();mensaje('Sobre de prueba añadido.');}else mensaje('No se pudo añadir el sobre. Inténtalo de nuevo.',true);},'coleccionBeta');acciones.append(beta);}
    contenido.append(acciones,crear('p','coleccionAviso','Las Doradas se obtienen con los códigos de las cartas físicas.'));
  }
  function dibujarCanje(){
    contenido.replaceChildren();panel.dataset.vista='canje';
    const caja=crear('section','coleccionCanje'),sello=crear('div','coleccionCanjeSello');sello.append(icono('candado'));
    caja.append(sello,crear('span','coleccionAntetitulo','DE TU CARTA A TU COLECCIÓN'),crear('h3','','Cartas doradas'),crear('p','','Los códigos de las cartas físicas se podrán canjear aquí.'));
    const label=crear('label','coleccionCanjeCodigo','Código de tu carta física'),input=crear('input');input.type='text';input.placeholder='Próximamente';input.disabled=true;label.append(input);caja.append(label);
    const pronto=boton('Próximamente',()=>{},'coleccionAbrirSobre');pronto.disabled=true;caja.append(pronto,crear('p','coleccionCanjeNota','El canje todavía no está disponible. Ningún código se envía ni se guarda.'));
    contenido.append(caja,boton('Volver a mis cartas',()=>ir('cartas'),'coleccionCanjeVolver'));
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
        registro.componente=window.CAOZ_SOBRES.crear(host,{variante:'reliquia',logoUrl:'art/logo.webp',
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
  const instalar=()=>{window.showGallery=abrir;if(new URLSearchParams(location.search).get('coleccion')==='1')abrir();};
  if(document.readyState==='complete')instalar();else addEventListener('load',instalar,{once:true});
})();

/* La colección del jugador: ediciones equipables y sobres. Las reglas de las
   cartas permanecen en el motor; las ilustraciones siguen el estudio público. */
'use strict';
(function(){
  const ACABADOS=['normal','foil','dorado'];
  const NOMBRES={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  const $=s=>document.querySelector(s);
  const crear=(tag,clase,texto)=>{const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;};
  const modelo=()=>window.CAOZ_COLECCION;
  const limpiarTexto=t=>{const d=document.createElement('div');d.innerHTML=t||'';return d.textContent.replace(/\s+/g,' ').trim();};
  const normalizar=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let panel,contenido,barra,estado,volverFoco,origen,temporizadores=[],observador,frame=0,guardando=false;
  const s={vista:'cartas',busqueda:'',mazo:'todos',tipo:'todos',pagina:0,tamano:8,carta:null,regla:0,reveladas:0,packId:null};
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
  function despues(fn,ms){const t=setTimeout(fn,ms);temporizadores.push(t);return t;}
  function limpiarTiempos(){guardando=false;temporizadores.forEach(clearTimeout);temporizadores=[];cancelAnimationFrame(frame);}
  function medida(){
    if(!panel?.open)return;
    const v=window.visualViewport,alto=v?v.height:innerHeight;
    panel.style.setProperty('--coleccion-alto',alto+'px');panel.style.setProperty('--coleccion-top',(v?v.offsetTop:0)+'px');
    panel.classList.toggle('coleccionBaja',alto<650);panel.classList.toggle('coleccionTeclado',alto<430);
    const ancho=panel.clientWidth;
    const nuevo=ancho<550?(alto<530||ancho<365?4:6):(ancho<820?8:10);
    if(nuevo!==s.tamano){const indice=s.pagina*s.tamano;s.tamano=nuevo;s.pagina=Math.floor(indice/nuevo);if(s.vista==='cartas')dibujarLista();}
    if(s.vista==='detalle')paginacionReglas();
    encajarCartas();
  }
  function encajarCartas(){
    if(!panel?.open)return;
    panel.querySelectorAll('.coleccionCarta,.coleccionReverso').forEach(n=>{
      const p=n.parentElement,clase=p.classList;let alto=p.clientHeight,ancho=p.clientWidth;
      const estilos=getComputedStyle(p),gap=parseFloat(estilos.rowGap)||0;
      alto-=parseFloat(estilos.paddingTop)||0;alto-=parseFloat(estilos.paddingBottom)||0;
      const otros=[...p.children].filter(h=>h!==n);
      otros.forEach(h=>alto-=h.getBoundingClientRect().height);alto-=otros.length*gap;
      if(clase.contains('coleccionVersion')||clase.contains('coleccionHallazgo'))alto=Math.min(alto,300);
      const h=Math.max(24,Math.min(alto,ancho*1.5));n.style.height=h+'px';n.style.width=(h/1.5)+'px';n.style.flex='0 0 auto';
    });
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
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();return;}if(e.target.matches('input,select,textarea'))return;if(s.vista==='cartas'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();cambiarPagina(e.key==='ArrowLeft'?-1:1);}});
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
  function limpiar(){
    limpiarTiempos();observador?.disconnect();observador=null;
    window.removeEventListener('resize',medida);window.visualViewport?.removeEventListener('resize',medida);window.visualViewport?.removeEventListener('scroll',medida);
    window.removeEventListener('caoz:coleccion',cambio);window.removeEventListener('caoz:arte',arteActualizado);window.removeEventListener('caoz:coleccion-error',falloGuardado);
    // El evento close llega después de comenzar el regreso. Limpiar sólo una
    // transición de este diálogo, nunca el nuevo barrido del menú de destino.
    if(panel?.querySelector('.barridoModal,.coleccionInterior.menuEntra')&&typeof limpiarTransicionMenu==='function')limpiarTransicionMenu();
  }
  function cerrar(){
    if(!panel?.open)return;panel.close();
    if(origen?.isConnected&&typeof animarTransicionMenu==='function')animarTransicionMenu(origen);
    if(volverFoco?.isConnected)volverFoco.focus({preventScroll:true});
  }
  function falloGuardado(){mensaje('No se pudo guardar. Libera espacio en el navegador e inténtalo otra vez.',true);}
  function cambio(){if(!panel?.open||guardando)return;actualizarCabecera();if(s.vista==='detalle')dibujarDetalle();else if(s.vista==='cartas')dibujarLista();else dibujarSobres();}
  function arteActualizado(){if(!panel?.open)return;panel.querySelectorAll('.coleccionCarta').forEach(actualizarCarta);}
  function actualizarCabecera(){
    const m=modelo(),ids=m.ids(),premium=ids.reduce((n,id)=>n+(m.tiene(id,'foil')?1:0)+(m.tiene(id,'dorado')?1:0),0);
    panel.querySelector('.coleccionTotales').textContent=ids.length+' normales · '+premium+' ediciones especiales';
    barra.replaceChildren();const cartas=boton('Mis cartas',()=>ir('cartas'),'coleccionPestana'),sobres=boton('Sobres',()=>ir('sobres'),'coleccionPestana');
    cartas.prepend(icono('libro'));sobres.prepend(icono('sobre'));sobres.append(crear('span','coleccionNumero',m.sobres()));
    cartas.setAttribute('aria-current',s.vista==='cartas'||s.vista==='detalle'?'page':'false');sobres.setAttribute('aria-current',s.vista==='sobres'?'page':'false');barra.append(cartas,sobres);
  }
  function ir(vista){limpiarTiempos();s.vista=vista;mensaje('');dibujar();}
  function dibujar(){actualizarCabecera();panel.dataset.vista=s.vista;contenido.replaceChildren();if(s.vista==='cartas')dibujarGaleria();else if(s.vista==='detalle')dibujarDetalle();else dibujarSobres();}
  function idsFiltrados(){
    const q=normalizar(s.busqueda),enMazo=s.mazo!=='todos'&&s.mazo!=='cajon'?new Set((DECKS[s.mazo]?.list||[]).map(x=>x[0]).concat('lider_'+s.mazo)):null;
    return modelo().ids().filter(id=>{const c=dato(id);return (!q||normalizar(c.n+' '+c.sub).includes(q))&&(s.tipo==='todos'||c.t===s.tipo)&&(!enMazo||enMazo.has(id))&&(s.mazo!=='cajon'||c.set==='cajon');}).sort((a,b)=>{const x=dato(a),y=dato(b);return Number(y.t==='protagonista')-Number(x.t==='protagonista')||(Number(x.c)||0)-(Number(y.c)||0)||x.n.localeCompare(y.n,'es');});
  }
  function dibujarGaleria(){
    const filtros=crear('div','coleccionFiltros'),buscar=crear('label','coleccionBuscar');buscar.append(icono('buscar'));
    const input=crear('input');input.type='search';input.placeholder='Buscar una carta…';input.setAttribute('aria-label','Buscar cartas por nombre');input.value=s.busqueda;input.autocomplete='off';
    input.oninput=()=>{s.busqueda=input.value;s.pagina=0;dibujarLista();};buscar.append(input);filtros.append(buscar);
    const selector=(nombre,opciones,valor,cambiar)=>{const label=crear('label','coleccionFiltro');label.append(crear('span','coleccionSr',nombre));const select=crear('select');select.setAttribute('aria-label',nombre);opciones.forEach(([v,n])=>{const op=crear('option','',n);op.value=v;select.append(op);});select.value=valor;select.onchange=()=>{cambiar(select.value);s.pagina=0;dibujarLista();};label.append(select);return label;};
    filtros.append(selector('Filtrar por mazo',[['todos','Todos los mazos'],...Object.keys(LEADERS).map(id=>[id,LEADERS[id].n]),['cajon','El Cajón']],s.mazo,v=>s.mazo=v));
    filtros.append(selector('Filtrar por tipo',[['todos','Todos los tipos'],['protagonista','Protagonistas'],['personaje','Personajes'],['hechizo','Hechizos'],['trampa','Trampas'],['objeto','Objetos'],['lugar','Lugares']],s.tipo,v=>s.tipo=v));
    contenido.append(filtros,crear('div','coleccionResumen'),crear('div','coleccionRejilla'),crear('nav','coleccionPaginas'));
    contenido.querySelector('.coleccionPaginas').setAttribute('aria-label','Páginas de cartas');dibujarLista();
  }
  function cambiarPagina(paso){const n=Math.ceil(idsFiltrados().length/s.tamano);const pagina=Math.max(0,Math.min(n-1,s.pagina+paso));if(pagina===s.pagina)return;s.pagina=pagina;dibujarLista();sonido('ui_hover');}
  function dibujarLista(){
    const grid=contenido.querySelector('.coleccionRejilla');if(!grid)return;
    const ids=idsFiltrados(),paginas=Math.max(1,Math.ceil(ids.length/s.tamano));s.pagina=Math.min(s.pagina,paginas-1);
    contenido.querySelector('.coleccionResumen').textContent=ids.length+' cartas'+(s.busqueda?' encontradas':' en tu colección')+' · Elige una para cambiar su edición';
    grid.replaceChildren();grid.dataset.cantidad=s.tamano;
    ids.slice(s.pagina*s.tamano,(s.pagina+1)*s.tamano).forEach(id=>{
      const c=dato(id),a=modelo().elegido(id),b=boton('',()=>verCarta(id),'coleccionMini');b.dataset.carta=id;b.setAttribute('aria-label',c.n+'. Edición '+NOMBRES[a]+'. Ver tres versiones.');
      const ficha=carta(id,a),info=crear('span','coleccionMiniInfo');info.append(crear('strong','',c.n));
      const pie=crear('span','coleccionMiniPie');pie.append(crear('span','',NOMBRES[a]));const puntos=crear('span','coleccionPuntos');
      ACABADOS.forEach(v=>{const p=crear('i');p.dataset.edicion=v;p.classList.toggle('propia',modelo().tiene(id,v));p.classList.toggle('elegida',v===a);p.title=NOMBRES[v]+(modelo().tiene(id,v)?' desbloqueada':' bloqueada');puntos.append(p);});pie.append(puntos);info.append(pie);b.append(ficha,info);grid.append(b);
    });
    if(!ids.length){const vacio=crear('div','coleccionVacio');vacio.append(icono('buscar'),crear('h3','','No hay cartas con esos filtros.'),boton('Limpiar filtros',()=>{s.busqueda='';s.mazo='todos';s.tipo='todos';s.pagina=0;dibujar();}));grid.append(vacio);}
    const nav=contenido.querySelector('.coleccionPaginas');nav.replaceChildren();const ant=boton('Anterior',()=>cambiarPagina(-1)),sig=boton('Siguiente',()=>cambiarPagina(1));ant.disabled=s.pagina===0;sig.disabled=s.pagina>=paginas-1;nav.append(ant,crear('span','',String(s.pagina+1).padStart(2,'0')+' / '+String(paginas).padStart(2,'0')),sig);programarAjuste();
  }
  function actualizarCarta(nodo){
    const id=nodo.dataset.arteId,a=nodo.dataset.coleccionAcabado,vista=nodo.dataset.vistaArte;
    const v=window.CAOZ_ARTE?.version?.(id,a,vista),enc=v?.encuadre||encuadreDe(ARTE[id]),url=v?.url||(typeof urlArte==='function'?urlArte(id):'art/'+id+'.webp');
    nodo.dataset.acabado=a;
    let marco=nodo.querySelector('.marcoDibujo');if(!marco){marco=crear('div','marcoDibujo');nodo.prepend(marco);}let img=marco.querySelector('img');if(!img){img=crear('img','dibujo');img.alt='';marco.append(img);}
    if(enc&&url){nodo.classList.add('conarte');nodo.style.setProperty('--ex',enc.x+'%');nodo.style.setProperty('--ey',enc.y+'%');nodo.style.setProperty('--ez',String(enc.z/100));if(img.getAttribute('src')!==url)img.src=url;}
    else{nodo.classList.remove('conarte');img.removeAttribute('src');}
  }
  function carta(id,acabado){
    const c=dato(id),n=crear('article','cartaVista coleccionCarta');n.dataset.arteId=id;n.dataset.coleccionAcabado=acabado;n.dataset.acabado=acabado;
    n.dataset.vistaArte=(document.getElementById('panelCerrar')?'movil_':'desktop_')+'coleccion';n.setAttribute('aria-hidden','true');
    const marco=crear('div','marcoDibujo'),img=crear('img','dibujo');img.alt='';img.decoding='async';marco.append(img);
    const fallback=crear('div','coleccionSinArte',c.art||'✦');const nombre=crear('div','nombreCarta',c.n),tipo=crear('div','coleccionTipoCarta',limpiarTexto(c.sub));
    n.append(marco,fallback,crear('span','coleccionCoste',c.c),nombre,tipo);
    if(c.t==='personaje'){n.append(crear('span','coleccionAtaque',c.a),crear('span','coleccionVida',c.h));}
    actualizarCarta(n);return n;
  }
  function verCarta(id){s.carta=id;s.regla=0;ir('detalle');sonido('ui_confirm');}
  function dibujarDetalle(){
    if(!s.carta){ir('cartas');return;}contenido.replaceChildren();panel.dataset.vista='detalle';
    const c=dato(s.carta),cab=crear('div','coleccionDetalleCabecera'),atras=boton('Mis cartas',()=>ir('cartas'),'coleccionAtras');atras.prepend(icono('flecha'));
    cab.append(atras,crear('h3','',c.n),crear('p','',limpiarTexto(c.sub)));contenido.append(cab);
    const versiones=crear('div','coleccionVersiones');
    ACABADOS.forEach(a=>{
      const tiene=modelo().tiene(s.carta,a),elegida=modelo().elegido(s.carta)===a,slot=crear('section','coleccionVersion');slot.dataset.edicion=a;slot.classList.toggle('elegida',elegida);slot.classList.toggle('bloqueada',!tiene);
      const etiqueta=crear('h4','',NOMBRES[a]);slot.append(etiqueta,carta(s.carta,a));
      const estadoEd=crear('span','coleccionEstadoEdicion',elegida?'En uso':tiene?'Desbloqueada':'En sobres');estadoEd.prepend(icono(elegida?'check':tiene?'libro':'candado'));slot.append(estadoEd);
      const b=boton(elegida?'En uso':tiene?'Usar':'Ver sobres',()=>{
        if(!tiene){ir('sobres');return;}
        guardando=true;let ok=false;try{ok=modelo().seleccionar(s.carta,a);}finally{guardando=false;}
        if(ok){dibujarDetalle();actualizarCabecera();mensaje(c.n+' · '+NOMBRES[a]+' equipada.');sonido('ui_confirm');const activo=contenido.querySelector('[data-edicion="'+a+'"] button');activo?.focus({preventScroll:true});}
        else mensaje('No se pudo guardar la selección. Inténtalo de nuevo.',true);
      },'coleccionUsar');b.disabled=elegida;b.setAttribute('aria-label',elegida?NOMBRES[a]+' en uso':tiene?'Usar edición '+NOMBRES[a]:'Desbloquear '+NOMBRES[a]+' en sobres');slot.append(b);versiones.append(slot);
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
    if(s.vista!=='detalle')return;const texto=contenido.querySelector('.coleccionReglaTexto'),nav=contenido.querySelector('.coleccionReglaPaginas');if(!texto||!s.carta)return;
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
    contenido.replaceChildren();panel.dataset.vista='sobres';const pack=modelo().pendiente();if(pack){dibujarRevelacion(pack);return;}
    s.packId=null;s.reveladas=0;
    const cab=crear('div','coleccionSobreTitulo');cab.append(crear('span','coleccionAntetitulo','TESOROS POR DESCUBRIR'),crear('h3','','Ediciones del Domo'),crear('p','','Cada sobre guarda tres cartas Foil o Doradas.'));contenido.append(cab);
    const escena=crear('div','coleccionSobreEscena'),sobre=crear('div','coleccionSobre');sobre.setAttribute('aria-hidden','true');
    sobre.append(crear('span','coleccionSobreMarca','CAOZ'),crear('span','coleccionSobreLinea','CON TODO'),icono('libro'),crear('span','coleccionSobreSello','✦'),crear('span','coleccionSobreLeyenda','EDICIONES DEL DOMO'));
    escena.append(crear('div','coleccionSobreAura'),sobre);contenido.append(escena);
    const completa=modelo().ids().every(id=>modelo().tiene(id,'foil')&&modelo().tiene(id,'dorado'));
    const acciones=crear('div','coleccionSobreAcciones'),n=modelo().sobres(),abrir=boton(completa?'Colección completa':n?'Abrir sobre':'No tienes sobres',()=>{
      if(guardando)return;guardando=true;abrir.disabled=true;let p;
      try{p=modelo().abrirSobre();}finally{guardando=false;}
      if(!p){abrir.disabled=false;mensaje('No se pudo abrir. Comprueba tus sobres o el espacio disponible para guardar.',true);return;}
      s.packId=p.id;s.reveladas=0;mensaje('');sonido('ui_confirm');dibujarSobres();actualizarCabecera();
    },'coleccionAbrirSobre');abrir.disabled=!n||completa;acciones.append(crear('p','coleccionSobreCuenta',n===1?'Tienes un sobre por abrir':'Tienes '+n+' sobres por abrir'),abrir);
    if(modelo().betaDisponible()){const beta=boton('Sobre de prueba · Beta',()=>{if(guardando)return;guardando=true;let ok;try{ok=modelo().darSobreBeta();}finally{guardando=false;}if(ok){dibujarSobres();actualizarCabecera();mensaje('Sobre de prueba añadido.');}else mensaje('No se pudo añadir el sobre. Inténtalo de nuevo.',true);},'coleccionBeta');acciones.append(beta);}
    contenido.append(acciones,crear('p','coleccionAviso','Las ediciones son cosméticas: no cambian el poder de tus cartas.'));
  }
  function dibujarRevelacion(pack){
    if(s.packId!==pack.id){s.packId=pack.id;s.reveladas=0;}
    const total=pack.cartas.length,termino=s.reveladas>=total;
    const cab=crear('div','coleccionSobreTitulo');cab.append(crear('span','coleccionAntetitulo','EL DOMO HA ELEGIDO'),crear('h3','',termino?'Tus nuevas ediciones':'Descubre tu sobre'),crear('p','',termino?'Ya están guardadas en tu colección.':'Toca cada carta para revelar lo que esconde.'));contenido.append(cab);
    const fila=crear('div','coleccionRevelacion');fila.dataset.reveladas=s.reveladas;
    pack.cartas.forEach((item,i)=>{
      const revelada=i<s.reveladas,b=boton('',()=>revelar(i,pack),'coleccionHallazgo');b.dataset.indice=i;b.classList.toggle('revelada',revelada);b.disabled=i!==s.reveladas||termino;
      if(revelada){b.append(carta(item.id,item.acabado));b.append(crear('strong','coleccionHallazgoNombre',dato(item.id).n),crear('span','coleccionHallazgoEdicion',NOMBRES[item.acabado]+' · '+(item.nueva?'Nueva':'Ya la tenías')));b.setAttribute('aria-label',dato(item.id).n+', '+NOMBRES[item.acabado]+', '+(item.nueva?'nueva':'ya la tenías'));}
      else{const reverso=crear('span','coleccionReverso');reverso.append(icono('libro'),crear('span','','✦'),crear('b','','CAOZ'));b.append(reverso,crear('strong','coleccionHallazgoNombre',i===s.reveladas?'Revelar carta':'Por descubrir'),crear('span','coleccionHallazgoEdicion',(i+1)+' de '+total));b.setAttribute('aria-label','Revelar carta '+(i+1)+' de '+total);}
      fila.append(b);
    });contenido.append(fila);
    const pie=crear('div','coleccionSobreAcciones');
    if(termino){pie.append(boton('Ir a mis cartas',()=>{
      guardando=true;let ok;try{ok=modelo().cerrarSobre();}finally{guardando=false;}
      if(ok){s.packId=null;s.reveladas=0;ir('cartas');mensaje('Elige una carta para equipar su nueva edición.');}else mensaje('No se pudo cerrar el sobre. Tus cartas siguen guardadas.',true);
    },'coleccionAbrirSobre'));}
    else pie.append(boton('Revelar carta '+(s.reveladas+1),()=>revelar(s.reveladas,pack),'coleccionAbrirSobre'));
    contenido.append(pie,crear('p','coleccionAviso',termino?'Puedes escoger el diseño de cada carta desde Mis cartas.':'El contenido del sobre ya está guardado, aunque cierres la colección.'));programarAjuste();
  }
  function revelar(indice,pack){
    if(guardando||indice!==s.reveladas)return;
    guardando=true;s.reveladas++;sonido('ui_confirm');dibujarSobres();const n=contenido.querySelector('[data-indice="'+indice+'"]');n?.classList.add('coleccionRevela');
    despues(()=>{guardando=false;if(!panel.open)return;contenido.querySelector('.coleccionSobreAcciones button')?.focus({preventScroll:true});},matchMedia('(prefers-reduced-motion:reduce)').matches?0:420);
  }
  // La función es global porque los dos menús la invocan al pulsar Colección.
  window.abrirColeccion=abrir;
  const instalar=()=>{window.showGallery=abrir;if(new URLSearchParams(location.search).get('coleccion')==='1')abrir();};
  if(document.readyState==='complete')instalar();else addEventListener('load',instalar,{once:true});
})();

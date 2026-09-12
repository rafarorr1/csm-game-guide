'use strict';
(function(){
  const parametros=new URLSearchParams(location.search),estado=parametros.get('estado')||'sobres';
  const estados=['nuevo','sobres','ediciones','muestrario','legacy'];
  const acabado=['normal','foil','dorado'].includes(parametros.get('acabado'))?parametros.get('acabado'):'normal';
  function preparar(){
    const m=window.CAOZ_COLECCION;
    if(!window.CAOZ_DEV?.aislado||!m||typeof abrirColeccion!=='function')throw Error('No se pudo montar la sección aislada.');
    if(document.body.dataset.vista==='movil'){
      // Marcador de la pantalla elegida: la API de vistas original lo utiliza
      // para distinguir móvil. No se añade el resto de la interfaz del juego.
      const marcador=document.createElement('span');marcador.id='panelCerrar';marcador.hidden=true;document.body.append(marcador);
    }
    if(estado==='sobres'){
      // Fixtures en memoria: funcionan también en una URL de revisión remota.
      // No se habilita la concesión beta del juego en nuevos dominios.
      m.concederSobreCampana('aislado_sobre_1');m.concederSobreCampana('aislado_sobre_2');
    }
    if(estado==='ediciones'){
      // El mismo modelo suma las copias de esta muestra. Son cantidades
      // conocidas, visibles en total y por edición, que se pierden al recargar.
      const copias={eric:{foil:3,dorado:2},tal:{foil:5,dorado:1},lider_fender:{foil:2,dorado:4}};
      for(const [id,ediciones]of Object.entries(copias))if(m.ids().includes(id)){
        for(const [acabado,cantidad]of Object.entries(ediciones))for(let i=0;i<cantidad;i++)m.otorgarCopia(id,acabado);
      }
      if(m.ids().includes('tal'))m.seleccionar('tal','dorado');
    }
    if(estado==='muestrario'){
      // Una copia por edición permite recorrer la serie completa en la grilla.
      // El almacén temporal se reconstruye al recargar, sin canjes ni premios.
      for(const id of m.ids()){
        m.otorgarCopia(id,'foil');m.otorgarCopia(id,'dorado');m.seleccionar(id,acabado);
      }
    }
    if(estado==='legacy'){
      const preferidos=['eric','tal','lider_fender'].filter(id=>m.ids().includes(id)),ids=[...new Set(preferidos.concat(m.ids()))].slice(0,3);
      const cartas=ids.map((id,i)=>({id,acabado:i===1?'dorado':'foil',nueva:true}));cartas.forEach(c=>m.desbloquear(c.id,c.acabado));
      const progreso=m.leer();progreso.pendiente={id:'sobre_dev_anterior',creado:1,cartas};
      localStorage.setItem(m.clave,JSON.stringify(progreso));
    }
    const form=document.getElementById('devEscenarios');form.elements.vista.value=document.body.dataset.vista;form.elements.estado.value=estados.includes(estado)?estado:'nuevo';
    form.elements.acabado.value=acabado;
    const actualizarSerie=()=>{form.elements.acabado.disabled=form.elements.estado.value!=='muestrario';};
    form.elements.estado.addEventListener('change',actualizarSerie);actualizarSerie();
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const parametros=new URLSearchParams({vista:form.elements.vista.value,estado:form.elements.estado.value});
      if(form.elements.estado.value==='muestrario')parametros.set('acabado',form.elements.acabado.value);
      if(document.body.dataset.exportada==='1'){
        const url=new URL(form.elements.vista.value==='movil'?'movil.html':'escritorio.html',location.href);url.search=parametros.toString();location.href=url.href;
      }else location.search=parametros.toString();
    });
    document.getElementById('devAbrir').onclick=()=>abrirColeccion();
    document.getElementById('devEstado').textContent=m.ids().length+' cartas disponibles · '+(estado==='muestrario'?'En memoria: todas las ediciones para revisar ilustraciones.':'Almacenamiento temporal · sin partida activa.');
    // El proveedor real carga exclusivamente los archivos locales; el servidor
    // responde un catálogo remoto vacío, sin contactar los estudios publicados.
    cargarArte().catch(()=>{}).finally(()=>{
      abrirColeccion();
      const carta=parametros.get('carta');
      if(carta&&m.ids().includes(carta))document.querySelector('#coleccionPanel .coleccionMini[data-carta="'+carta+'"]')?.click();
    });
  }
  if(document.readyState==='complete')preparar();else addEventListener('load',preparar,{once:true});
})();

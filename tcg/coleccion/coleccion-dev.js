'use strict';
(function(){
  const parametros=new URLSearchParams(location.search),estado=parametros.get('estado')||'sobres';
  const estados=['nuevo','sobres','ediciones','legacy'];
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
      for(const id of ['eric','tal','lider_fender'].filter(id=>m.ids().includes(id))){m.desbloquear(id,'foil');m.desbloquear(id,'dorado');}
      if(m.ids().includes('tal'))m.seleccionar('tal','dorado');
    }
    if(estado==='legacy'){
      const preferidos=['eric','tal','lider_fender'].filter(id=>m.ids().includes(id)),ids=[...new Set(preferidos.concat(m.ids()))].slice(0,3);
      const cartas=ids.map((id,i)=>({id,acabado:i===1?'dorado':'foil',nueva:true}));cartas.forEach(c=>m.desbloquear(c.id,c.acabado));
      const progreso=m.leer();progreso.pendiente={id:'sobre_dev_anterior',creado:1,cartas};
      localStorage.setItem(m.clave,JSON.stringify(progreso));
    }
    const form=document.getElementById('devEscenarios');form.elements.vista.value=document.body.dataset.vista;form.elements.estado.value=estados.includes(estado)?estado:'nuevo';
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const parametros=new URLSearchParams({vista:form.elements.vista.value,estado:form.elements.estado.value});
      if(document.body.dataset.exportada==='1'){
        const url=new URL(form.elements.vista.value==='movil'?'movil.html':'escritorio.html',location.href);url.search=parametros.toString();location.href=url.href;
      }else location.search=parametros.toString();
    });
    document.getElementById('devAbrir').onclick=()=>abrirColeccion();
    document.getElementById('devEstado').textContent=m.ids().length+' cartas disponibles · almacenamiento temporal · sin partida activa';
    // El proveedor real carga exclusivamente los archivos locales; el servidor
    // responde un catálogo remoto vacío, sin contactar los estudios publicados.
    cargarArte().catch(()=>{}).finally(()=>abrirColeccion());
  }
  if(document.readyState==='complete')preparar();else addEventListener('load',preparar,{once:true});
})();

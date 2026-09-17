/* Laboratorio efímero: los títulos se validan con el mismo componente compartido. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const datos=window.CAOZ_ESTUDIO_NOMBRES_DATOS;
  const cartas=Array.isArray(datos?.cartas)?datos.cartas:[];
  const porId=new Map(cartas.map(c=>[c.id,c]));
  const borradores=new Map();
  let seleccionada=cartas[0]?.id||null;

  function api(){
    const componente=window.CAOZ_NOMBRES_CARTAS;
    if(!componente||typeof componente.validar!=='function')throw Error('No se cargó el validador compartido de nombres.');
    return componente;
  }
  function maximo(){
    const n=Number(api().MAXIMO);
    return Number.isSafeInteger(n)&&n>0?n:70;
  }
  function carta(){return porId.get(seleccionada)||null;}
  function tituloActual(c=carta()){return c?(borradores.get(c.id)??c.n):'';}
  function textoError(error){return error instanceof Error&&error.message?error.message:'El nombre no es válido.';}
  function validar(valor){
    try{return {ok:true,valor:api().validar(valor,{permitirNulo:true})};}
    catch(error){return {ok:false,error:textoError(error)};}
  }
  function meta(c){
    const partes=['ID '+c.id,'Coste '+c.c];
    if(c.a!==null&&c.a!==undefined)partes.push('ATQ '+c.a);
    if(c.h!==null&&c.h!==undefined)partes.push('PV '+c.h);
    return partes.join(' · ');
  }
  function crear(tag,clase,texto){
    const n=document.createElement(tag);if(clase)n.className=clase;if(texto!==undefined)n.textContent=texto;return n;
  }
  function pintarLista(){
    const cont=$('estudioNombresCartas');cont.replaceChildren();
    for(const c of cartas){
      const boton=crear('button','estudioNombresCarta'+(c.id===seleccionada?' activa':''));
      boton.type='button';boton.dataset.id=c.id;
      boton.setAttribute('aria-pressed',String(c.id===seleccionada));
      const icono=crear('span','estudioNombresIcono',c.art||'✦');icono.setAttribute('aria-hidden','true');
      const cuerpo=crear('span','estudioNombresCartaCuerpo');
      cuerpo.append(crear('strong','',tituloActual(c)),crear('small','',c.t+' · '+c.id));
      const estado=crear('span','estudioNombresCartaEstado',borradores.has(c.id)?'Borrador':'Original');
      boton.append(icono,cuerpo,estado);
      const item=crear('div','estudioNombresCartaItem');item.setAttribute('role','listitem');item.append(boton);cont.append(item);
    }
  }
  function pintarFicha(){
    const c=carta(),ficha=$('estudioNombresFicha');ficha.replaceChildren();if(!c)return;
    const etiqueta=crear('p','estudioNombresEtiqueta',String(c.t).toUpperCase());
    const nombre=crear('h2','',tituloActual(c));
    const original=crear('p','estudioNombresOriginal');
    original.append('Original del catálogo: ',crear('strong','',c.n));
    const datosCarta=crear('p','estudioNombresMeta',meta(c));
    ficha.append(crear('span','estudioNombresFichaIcono',c.art||'✦'),etiqueta,nombre,original,datosCarta);
  }
  function estadoEntrada(){
    const c=carta(),campo=$('estudioNombresTituloInput'),resultado=validar(campo.value);
    const aviso=$('estudioNombresValidacion'),guardar=$('estudioNombresGuardar');
    aviso.className='estudioNombresValidacion';
    if(!resultado.ok){
      aviso.classList.add('error');aviso.textContent=resultado.error;guardar.disabled=true;return resultado;
    }
    const nombre=resultado.valor;
    if(nombre===null||nombre===c.n){
      aviso.textContent='El nombre coincide con el original; no hay cambio que guardar.';guardar.disabled=true;return resultado;
    }
    if(borradores.get(c.id)===nombre){
      aviso.textContent='Este borrador ya está guardado sólo en esta página.';guardar.disabled=true;return resultado;
    }
    aviso.classList.add('correcto');aviso.textContent='Nombre válido. Al guardar quedará pendiente de revisión para beta.';guardar.disabled=false;return resultado;
  }
  function pintarEditor({enfocar=false}={}){
    const c=carta();if(!c)return;
    // El validador cuenta puntos de código; maxlength cuenta UTF-16. Se deja
    // margen para que no bloquee un título válido con caracteres suplementarios.
    const campo=$('estudioNombresTituloInput');campo.maxLength=maximo()*2;campo.value=tituloActual(c);
    $('estudioNombresRegla').textContent='Hasta '+maximo()+' caracteres';
    $('estudioNombresRestaurar').disabled=!borradores.has(c.id);
    estadoEntrada();if(enfocar)campo.focus();
  }
  function plural(n){return n===1?'cambio':'cambios';}
  function pintarPendientes(){
    const n=borradores.size;$('estudioNombresCantidad').textContent=n+' '+(n===1?'borrador':'borradores');
    $('estudioNombresLocalEstado').textContent=n?(n===1?'Hay 1 cambio guardado únicamente en la memoria de esta página.':'Hay '+n+' cambios guardados únicamente en la memoria de esta página.'):'No hay cambios guardados.';
    $('estudioNombresBetaEstado').textContent=n?'Pendiente: revisar '+n+' '+plural(n)+' y decidir si se envían a beta.':'Sin cambios pendientes de revisión.';
    $('estudioNombresProduccionEstado').textContent=n?'Sin cambios: producción conserva los títulos originales hasta una aprobación posterior.':'Conserva todos los nombres originales.';
  }
  function pintar({enfocar=false}={}){pintarLista();pintarFicha();pintarEditor({enfocar});pintarPendientes();}
  function seleccionar(id){
    if(!porId.has(id))return false;seleccionada=id;$('estudioNombresMensaje').textContent='';pintar({enfocar:false});return true;
  }
  function guardar(){
    const c=carta(),resultado=estadoEntrada();if(!resultado.ok||resultado.valor===null||resultado.valor===c.n)return false;
    borradores.set(c.id,resultado.valor);
    $('estudioNombresMensaje').textContent='Borrador guardado para '+resultado.valor+'. Sólo existe mientras esta página permanezca abierta.';
    pintar();return true;
  }
  function restaurar(){
    const c=carta();if(!borradores.has(c.id))return false;
    // El contrato compartido acepta null para eliminar una sustitución, igual que la integración final.
    if(validar(null).valor!==null)return false;
    borradores.delete(c.id);$('estudioNombresMensaje').textContent='Restauraste el título original: '+c.n+'.';pintar();return true;
  }
  function estado(){return {seleccionada,borradores:Object.fromEntries(borradores)};}
  function preparar(){
    if(!cartas.length)throw Error('La muestra de nombres no contiene cartas del catálogo.');
    api();pintar();
    $('estudioNombresCartas').addEventListener('click',evento=>{const boton=evento.target.closest('button[data-id]');if(boton)seleccionar(boton.dataset.id);});
    $('estudioNombresTituloInput').addEventListener('input',estadoEntrada);
    $('estudioNombresGuardar').addEventListener('click',guardar);
    $('estudioNombresRestaurar').addEventListener('click',restaurar);
    window.CAOZ_ESTUDIO_NOMBRES_LAB=Object.freeze({seleccionar,guardar,restaurar,estado,validar:valor=>validar(valor)});
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',preparar);else preparar();
})();

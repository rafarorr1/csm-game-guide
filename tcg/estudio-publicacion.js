/* Publicación de la biblioteca privada: un único estudio, dos destinos explícitos. */
'use strict';
(function(){
  const oficial='https://juego.caozcontodo.com';
  if((location.hostname.endsWith('.pages.dev')||location.hostname.endsWith('.github.io'))&&location.origin!==oficial){location.replace(oficial+(location.pathname.includes('sonidos')?'/sonidos':'/estudio'));return;}
  let opciones,datos=null,ocupado=false;
  const $=id=>document.getElementById(id);
  function ruta(r){return r.replace(/api\/(arte|sfx)\/(?!sesion(?:$|\?))/,'api/estudio/$1/');}
  async function pedir(r,op={}){
    const u=new URL('api/estudio/'+opciones.tipo+'/'+r,location.href);u.searchParams.set('test','sin-cache-admin');
    const resp=await fetch(u,{...op,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000)});
    const j=await resp.json();if(!resp.ok)throw Object.assign(Error(j.error||'No se pudo publicar.'),{status:resp.status});return j;
  }
  function botones(){for(const d of ['beta','produccion'])$('publicar'+d).disabled=ocupado||!datos?.[d]?.pendientes||!!datos?.[d]?.error;}
  async function actualizar(){
    if(!opciones)return;
    try{datos=await pedir('estado');for(const d of ['beta','produccion']){const n=datos[d]?.pendientes;$('pendientes'+d).textContent=datos[d]?.error||(!n?'Al día':n+' '+(opciones.tipo==='arte'?'carta'+(n===1?'':'s'):'sonido'+(n===1?'':'s'))+' pendiente'+(n===1?'':'s'));}}
    catch(e){datos=null;for(const d of ['beta','produccion'])$('pendientes'+d).textContent='Actualiza el estudio para revisar este destino.';}
    botones();
  }
  async function revisar(destino){
    if(ocupado)return;
    if(opciones.pendiente()){opciones.estado('Guarda o descarta la vista previa antes de publicar.',true);return;}
    ocupado=true;botones();await actualizar();ocupado=false;botones();
    const plan=datos?.[destino];if(!plan?.pendientes||plan.error)return;
    const nombre=destino==='beta'?'beta':'producción',d=$('publicacionDialogo');
    $('publicacionTitulo').textContent='Publicar en '+nombre;
    $('publicacionTexto').textContent='Estos cambios guardados pasarán a '+nombre+'. El otro destino conservará su versión.';
    $('publicacionLista').replaceChildren(...plan.ids.map(id=>{const li=document.createElement('li');li.textContent=opciones.nombre(id);return li;}));
    $('publicacionAceptar').textContent='Publicar en '+nombre;d.returnValue='';d.showModal();$('publicacionCancelar').focus();
    const aceptar=await new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='publicar'),{once:true}));if(!aceptar)return;
    ocupado=true;opciones.bloquear(true);botones();
    try{
      let r;
      do{opciones.estado('Publicando los cambios en '+nombre+'…');r=await pedir('publicar/'+destino,{method:'POST',headers:{'If-Match':plan.huella}});}while(r.preparando);
      await actualizar();opciones.estado('Publicado en '+nombre+'. El juego recibirá los cambios al volver a abrirlo o durante el próximo minuto.');
    }catch(e){if(e.status===409&&opciones.recargar)await opciones.recargar().catch(()=>{});await actualizar();opciones.estado(e.message,true);}
    finally{ocupado=false;opciones.bloquear(false);botones();}
  }
  function conectar(config){
    opciones=config;for(const d of ['beta','produccion'])$('publicar'+d).onclick=()=>revisar(d);return actualizar();
  }
  window.CAOZ_ESTUDIO=Object.freeze({ruta,conectar,actualizar});
})();

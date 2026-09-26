/* Laboratorio del espacio «Campos de batalla» del Estudio: subir un fondo
   propio por Lugar, encuadrarlo y verlo en la mesa con campo-lugar.js, en
   escritorio y móvil. La imagen se prepara igual que en el Estudio (WebP de
   hasta 1600 px y 1,5 MB). «Guardar» sólo la conserva en memoria: no hay
   acceso, peticiones ni publicación. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const LUGARES=['tomsage','antro','puente','montanas','domo'],MUESTRA=[['rey','bartolomeo','eric'],['horton','discipulo','tok_petunia']];
  const guardados=new Map();let elegido='domo',pendiente=null,campo=null,ocupado=false;
  const estado=(t,error=false)=>{$('ecEstado').textContent=t;$('ecEstado').classList.toggle('error',error);};
  const actual=()=>pendiente?.id===elegido?pendiente:guardados.get(elegido)||null;
  // Lo que ve la mesa: el borrador en edición, el guardado o la ilustración del Lugar.
  const fondo=id=>{const f=id===elegido?actual():guardados.get(id);return f?{url:f.url,x:f.x,y:f.y,z:f.z,efectos:f.efectos!==false}:null;};

  function imagen(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
  async function montarCartas(){
    for(const [fila,ids]of [['ecRival',MUESTRA[0]],['ecPropia',MUESTRA[1]]]){
      const nodos=[];for(const id of ids){const img=await imagen('./art/'+id+'.webp');const c=CAOZ_CARTA_PINTOR.hornear({id,acabado:'normal',arte:{img,enc:{x:50,y:30,z:100}},ancho:260});c.setAttribute('aria-label',CARDS[id].n);nodos.push(c);}
      $(fila).replaceChildren(...nodos);}
  }
  // Igual que el Estudio: WebP, lado mayor ≤1600 px, ≤1,5 MB.
  async function convertir(archivo){
    if(!(archivo instanceof Blob)||archivo.size<16||archivo.size>20000000||!['image/jpeg','image/png','image/webp'].includes(archivo.type))throw Error('Selecciona una imagen JPEG, PNG o WebP de hasta 20 MB.');
    const u=URL.createObjectURL(archivo),img=new Image();
    try{
      await new Promise((ok,mal)=>{img.onload=ok;img.onerror=()=>mal(Error('El archivo no contiene una imagen válida.'));img.src=u;});
      if(Math.min(img.naturalWidth,img.naturalHeight)<16)throw Error('La imagen es demasiado pequeña.');
      const escala=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
      c.width=Math.max(16,Math.round(img.naturalWidth*escala));c.height=Math.max(16,Math.round(img.naturalHeight*escala));c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      let blob;for(const q of [.92,.84,.74,.62]){blob=await new Promise(r=>c.toBlob(r,'image/webp',q));if(!blob)throw Error('Este navegador no puede preparar WebP.');if(blob.size<=1500000)break;}
      if(blob.size>1500000)throw Error('La imagen sigue siendo demasiado pesada. Prueba una versión más pequeña.');
      return {blob,ancho:c.width,alto:c.height,vertical:img.naturalHeight>img.naturalWidth};
    }finally{URL.revokeObjectURL(u);}
  }
  function lista(){
    $('ecLista').replaceChildren(...LUGARES.map(id=>{
      const b=document.createElement('button');b.type='button';b.className='ecFilaLugar';b.dataset.lugar=id;b.setAttribute('aria-pressed',String(id===elegido));
      const f=(id===elegido?actual():null)||guardados.get(id),img=document.createElement('img');img.alt='';img.src=f?f.url:'./art/'+id+'.webp';
      const t=document.createElement('span'),n=document.createElement('strong'),m=document.createElement('small');n.textContent=CARDS[id].n;
      const sinGuardar=pendiente?.id===id;m.textContent=sinGuardar?'Diseño propio · sin guardar':guardados.has(id)?'Diseño propio':'Ilustración del Lugar';if(sinGuardar||guardados.has(id))m.dataset.propio='';
      t.append(n,m);b.append(img,t);b.onclick=()=>elegir(id);return b;}));
  }
  function controles(){
    const f=actual();
    for(const [k,v]of [['X',f?.x??50],['Y',f?.y??50],['Z',f?.z??100]]){$('ec'+k).value=v;$('ecV'+k).textContent=Math.round(v)+'%';}
    $('ecEfectos').checked=f?f.efectos!==false:true;
    $('ecEncuadre').disabled=ocupado||!f;$('ecGuardar').disabled=ocupado||!pendiente;$('ecDescartar').disabled=ocupado||!pendiente;
    $('ecRestaurar').disabled=ocupado||(!guardados.has(elegido)&&!pendiente);$('ecArchivo').disabled=ocupado;$('ecPortal').disabled=ocupado;
    $('ecNombre').textContent=CARDS[elegido].n;
    $('ecOrigen').textContent=pendiente?.id===elegido?'Vista previa sin guardar · '+pendiente.nombre+' · '+pendiente.ancho+'×'+pendiente.alto+' · '+Math.round(pendiente.blob.size/1024)+' KB WebP':
      guardados.has(elegido)?'Diseño propio guardado'+(guardados.get(elegido).efectos===false?', sin efectos del Lugar.':', con los efectos del Lugar encima.'):'Ilustración del Lugar (sin diseño propio): el campo añade el suelo pintado.';
  }
  function refrescar(){campo.fondoCambiado();controles();lista();}
  async function elegir(id){
    if(ocupado||id===elegido)return;
    if(pendiente&&!confirm('Tienes un fondo sin guardar. ¿Descartarlo?'))return;
    descartar(false);elegido=id;ocupado=true;controles();lista();
    try{await campo.poner(id,{lado:'abajo'});}finally{ocupado=false;controles();estado('Editando '+CARDS[id].n+'.');}
  }
  function descartar(avisar=true){
    if(pendiente&&!guardados.has(pendiente.id)||pendiente&&guardados.get(pendiente.id).url!==pendiente.url)URL.revokeObjectURL(pendiente.url);
    pendiente=null;if(avisar){refrescar();estado('Cambios descartados.');}
  }
  $('ecArchivo').onchange=async()=>{
    const a=$('ecArchivo').files[0];$('ecArchivo').value='';if(!a||ocupado)return;ocupado=true;controles();estado('Preparando la imagen…');
    try{const p=await convertir(a);descartar(false);pendiente={id:elegido,...p,url:URL.createObjectURL(p.blob),nombre:String(a.name).slice(0,80),x:50,y:50,z:100,efectos:true};
      estado(p.vertical?'Imagen vertical: en escritorio se recortará mucho. Mejor un diseño horizontal.':'Vista previa lista. Ajusta el encuadre y guarda.',p.vertical);}
    catch(e){estado(e.message,true);}finally{ocupado=false;refrescar();}
  };
  for(const k of ['X','Y','Z'])$('ec'+k).oninput=()=>{
    if(!actual())return;
    if(!pendiente){const g=guardados.get(elegido);pendiente={...g};}
    pendiente[k.toLowerCase()]=Number($('ec'+k).value);$('ecV'+k).textContent=$('ec'+k).value+'%';campo.fondoCambiado();controles();lista();
  };
  $('ecEfectos').onchange=()=>{if(!actual())return;if(!pendiente)pendiente={...guardados.get(elegido)};pendiente.efectos=$('ecEfectos').checked;refrescar();};
  $('ecCentrar').onclick=()=>{if(!actual())return;if(!pendiente)pendiente={...guardados.get(elegido)};Object.assign(pendiente,{x:50,y:50,z:100});refrescar();};
  $('ecGuardar').onclick=()=>{if(!pendiente)return;const viejo=guardados.get(elegido);if(viejo&&viejo.url!==pendiente.url)URL.revokeObjectURL(viejo.url);guardados.set(elegido,pendiente);pendiente=null;refrescar();estado('Fondo de '+CARDS[elegido].n+' guardado en esta prueba. En el Estudio real quedaría como borrador para publicar en beta y producción.');};
  $('ecDescartar').onclick=()=>descartar();
  $('ecRestaurar').onclick=()=>{descartar(false);const g=guardados.get(elegido);if(g){URL.revokeObjectURL(g.url);guardados.delete(elegido);}refrescar();estado('Se restauró la ilustración original de '+CARDS[elegido].n+'.');};
  $('ecPortal').onclick=async()=>{if(ocupado)return;ocupado=true;controles();try{await campo.quitar({reducir:true});await campo.poner(elegido,{lado:'abajo'});}finally{ocupado=false;controles();}};
  for(const [id,movil]of [['ecEscritorio',false],['ecMovil',true]])$(id).onclick=()=>{$('ecMarco').toggleAttribute('data-movil',movil);$('ecEscritorio').setAttribute('aria-pressed',String(!movil));$('ecMovil').setAttribute('aria-pressed',String(movil));};
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();await montarCartas();
    campo=CAOZ_CAMPO_LUGAR.crear($('ecMesa'),{arte:id=>'./art/'+id+'.webp',fondo,linea:$('ecLinea')});
    await campo.poner(elegido,{lado:'abajo',reducir:true});controles();lista();estado('Listo. Elige un Lugar y sube tu diseño.');
  }
  preparar().catch(e=>estado('No se pudo preparar la prueba: '+e.message,true));
})();

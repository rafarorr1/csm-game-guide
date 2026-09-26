/* Laboratorio del espacio «Campos de batalla» del Estudio: cada mapa (Lugar)
   puede llevar un fondo propio, encuadrado, y sus propios efectos encima con
   su intensidad; se ve en la mesa con campo-lugar.js, en escritorio y móvil.
   La imagen se prepara igual que en el Estudio (WebP de hasta 1600 px y
   1,5 MB). «Guardar» sólo lo conserva en memoria: no hay acceso, peticiones
   ni publicación. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const LUGARES=['tomsage','antro','puente','montanas','domo'],MUESTRA=[['rey','bartolomeo','eric'],['horton','discipulo','tok_petunia']];
  const guardados=new Map();let elegido='domo',pendiente=null,campo=null,ocupado=false;
  const estado=(t,error=false)=>{$('ecEstado').textContent=t;$('ecEstado').classList.toggle('error',error);};
  const serie=id=>[...CAOZ_CAMPO_LUGAR.DE_SERIE[id]];
  // Un mapa: fondo propio opcional (url, encuadre) y sus efectos con intensidad.
  const base=id=>({id,url:null,x:50,y:50,z:100,efectos:serie(id),intensidad:1});
  const actual=()=>pendiente?.id===elegido?pendiente:guardados.get(elegido)||base(elegido);
  const editar=()=>pendiente?.id===elegido?pendiente:(pendiente={...actual(),efectos:[...actual().efectos]});
  const fondo=id=>{const f=id===elegido?actual():guardados.get(id);return f?{url:f.url,x:f.x,y:f.y,z:f.z,efectos:f.efectos,intensidad:f.intensidad}:null;};
  const igualSerie=f=>!f.url&&f.intensidad===1&&[...f.efectos].sort().join()===serie(f.id).sort().join();
  const describir=f=>(f.url?'Fondo propio':'Ilustración del Lugar')+' · '+(f.efectos.length?Object.keys(CAOZ_CAMPO_LUGAR.EFECTOS).filter(k=>f.efectos.includes(k)).map(k=>CAOZ_CAMPO_LUGAR.EFECTOS[k].icono).join(''):'sin efectos');

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
      const f=(id===elegido?actual():null)||guardados.get(id)||base(id),img=document.createElement('img');img.alt='';img.src=f.url||'./art/'+id+'.webp';
      const t=document.createElement('span'),n=document.createElement('strong'),m=document.createElement('small');n.textContent=CARDS[id].n;
      const sinGuardar=pendiente?.id===id;m.textContent=describir(f)+(sinGuardar?' · sin guardar':'');if(sinGuardar||guardados.has(id))m.dataset.propio='';
      t.append(n,m);b.append(img,t);b.onclick=()=>elegir(id);return b;}));
  }
  function chips(){
    const f=actual(),de=serie(elegido);
    $('ecEfectos').replaceChildren(...Object.entries(CAOZ_CAMPO_LUGAR.EFECTOS).map(([k,v])=>{
      const b=document.createElement('button');b.type='button';b.dataset.efecto=k;b.setAttribute('aria-pressed',String(f.efectos.includes(k)));b.disabled=ocupado;
      b.textContent=v.icono+' '+v.nombre;if(de.includes(k)){const s=document.createElement('span');s.className='serie';s.textContent='de serie';b.append(s);}
      b.onclick=()=>{const p=editar();p.efectos=p.efectos.includes(k)?p.efectos.filter(x=>x!==k):[...p.efectos,k];refrescar();};return b;}));
  }
  function controles(){
    const f=actual();
    for(const [k,v]of [['X',f.x],['Y',f.y],['Z',f.z],['I',Math.round(f.intensidad*100)]]){$('ec'+k).value=v;$('ecV'+k).textContent=Math.round(v)+'%';}
    $('ecEncuadre').disabled=ocupado||!f.url;$('ecEfectosCaja').disabled=ocupado;chips();
    $('ecGuardar').disabled=ocupado||!pendiente;$('ecDescartar').disabled=ocupado||!pendiente;
    $('ecRestaurar').disabled=ocupado||(!guardados.has(elegido)&&!pendiente);$('ecArchivo').disabled=ocupado;$('ecPortal').disabled=ocupado;
    $('ecNombre').textContent=CARDS[elegido].n;
    $('ecOrigen').textContent=(pendiente?.id===elegido?'Sin guardar · ':'')+(f.url?(f.nombre?f.nombre+' · '+f.ancho+'×'+f.alto+' · '+Math.round(f.blob.size/1024)+' KB WebP':'Fondo propio'):'Ilustración del Lugar, con su suelo pintado')+' · '+(f.efectos.length?f.efectos.length+' efecto'+(f.efectos.length>1?'s':'')+' al '+Math.round(f.intensidad*100)+'%':'sin efectos');
  }
  function refrescar(){campo.fondoCambiado();controles();lista();}
  async function elegir(id){
    if(ocupado||id===elegido)return;
    if(pendiente&&!confirm('Tienes cambios sin guardar en este mapa. ¿Descartarlos?'))return;
    descartar(false);elegido=id;ocupado=true;controles();lista();
    try{await campo.poner(id,{lado:'abajo'});}finally{ocupado=false;controles();estado('Editando '+CARDS[id].n+'.');}
  }
  const soltar=u=>{if(u&&![...guardados.values()].some(g=>g.url===u))URL.revokeObjectURL(u);};
  function descartar(avisar=true){if(pendiente)soltar(pendiente.url);pendiente=null;if(avisar){refrescar();estado('Cambios descartados.');}}
  $('ecArchivo').onchange=async()=>{
    const a=$('ecArchivo').files[0];$('ecArchivo').value='';if(!a||ocupado)return;ocupado=true;controles();estado('Preparando la imagen…');
    try{const p=await convertir(a),e=editar();if(e.url!==guardados.get(elegido)?.url)soltar(e.url);Object.assign(e,{...p,url:URL.createObjectURL(p.blob),nombre:String(a.name).slice(0,80),x:50,y:50,z:100});
      estado(p.vertical?'Imagen vertical: en escritorio se recortará mucho. Mejor un diseño horizontal.':'Vista previa lista. Ajusta el encuadre y los efectos, y guarda.',p.vertical);}
    catch(e){estado(e.message,true);}finally{ocupado=false;refrescar();}
  };
  for(const k of ['X','Y','Z'])$('ec'+k).oninput=()=>{if(!actual().url)return;editar()[k.toLowerCase()]=Number($('ec'+k).value);refrescar();};
  $('ecI').oninput=()=>{editar().intensidad=Number($('ecI').value)/100;refrescar();};
  $('ecSerie').onclick=()=>{const p=editar();p.efectos=serie(elegido);p.intensidad=1;refrescar();};
  $('ecNinguno').onclick=()=>{editar().efectos=[];refrescar();};
  $('ecCentrar').onclick=()=>{if(!actual().url)return;Object.assign(editar(),{x:50,y:50,z:100});refrescar();};
  $('ecGuardar').onclick=()=>{
    if(!pendiente)return;const viejo=guardados.get(elegido);if(viejo&&viejo.url!==pendiente.url){const u=viejo.url;guardados.delete(elegido);soltar(u);}
    if(igualSerie(pendiente))guardados.delete(elegido);else guardados.set(elegido,pendiente);pendiente=null;refrescar();
    estado('Mapa de '+CARDS[elegido].n+' guardado en esta prueba. En el Estudio real quedaría como borrador para publicar en beta y producción.');};
  $('ecDescartar').onclick=()=>descartar();
  $('ecRestaurar').onclick=()=>{descartar(false);const g=guardados.get(elegido);guardados.delete(elegido);if(g)soltar(g.url);refrescar();estado('Se restauró '+CARDS[elegido].n+': su ilustración y sus efectos de serie.');};
  $('ecPortal').onclick=async()=>{if(ocupado)return;ocupado=true;controles();try{await campo.quitar({reducir:true});await campo.poner(elegido,{lado:'abajo'});}finally{ocupado=false;controles();}};
  for(const [id,movil]of [['ecEscritorio',false],['ecMovil',true]])$(id).onclick=()=>{$('ecMarco').toggleAttribute('data-movil',movil);$('ecEscritorio').setAttribute('aria-pressed',String(!movil));$('ecMovil').setAttribute('aria-pressed',String(movil));};
  async function preparar(){
    await CAOZ_CARTA_PINTOR.fuentes();await montarCartas();
    campo=CAOZ_CAMPO_LUGAR.crear($('ecMesa'),{arte:id=>'./art/'+id+'.webp',fondo,linea:$('ecLinea')});
    await campo.poner(elegido,{lado:'abajo',reducir:true});controles();lista();estado('Listo. Elige un mapa, sube tu diseño y elige sus efectos.');
  }
  preparar().catch(e=>estado('No se pudo preparar la prueba: '+e.message,true));
})();

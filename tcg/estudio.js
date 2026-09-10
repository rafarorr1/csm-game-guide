/* Estudio privado de ilustraciones. No modifica las reglas ni los borradores antiguos. */
'use strict';
(function(){
  const $=id=>document.getElementById(id),base=new URL('.',location.href);
  const tipos={lider:'Protagonistas',lugar:'Terrenos',personaje:'Personajes',hechizo:'Hechizos',objeto:'Objetos',terreno:'Terrenos',trampa:'Trampas',rapido:'Hechizos rápidos'};
  const acabados={normal:'Normal',foil:'Foil',dorado:'Foil dorado'};
  let cartas=[],privados=new Map(),seleccion='',acabado='normal',tipo='',entorno='',pendiente=null,conflicto=false,ocupado=false,autenticado=false;
  const actual=()=>cartas.find(c=>c.id===seleccion);
  const textoTipo=t=>tipos[t]||String(t||'Carta').replace(/^./,s=>s.toUpperCase());
  const limitar=(valor,min,max,defecto)=>Number.isFinite(Number(valor))?Math.round(Math.max(min,Math.min(max,Number(valor)))):defecto;
  const normalizar=e=>({x:limitar(e?.x??50,0,100,50),y:limitar(typeof e==='number'?e:e?.y??50,0,100,50),z:limitar(e?.z??100,100,300,100)});
  // Las filas antiguas representan Normal; cada versión nueva tiene su propia revisión.
  const registro=(c,a=acabado)=>{const fila=privados.get(c.id);return fila?.variantes?fila.variantes[a]||null:a==='normal'?fila||null:null;};
  const creada=(c,a=acabado)=>a==='normal'||!!(registro(c,a)&&registro(c,a).activo!==false&&(registro(c,a).activo===true||registro(c,a).hash||registro(c,a).x!=null));
  const ganadora=c=>['dorado','foil','normal'].find(a=>creada(c,a));
  const encuadre=(c,a=acabado)=>{const p=registro(c,a);return normalizar(p?.x!=null?{x:p.x,y:p.y,z:p.z}:a!=='normal'?encuadre(c,'normal'):c.original?.encuadre);};
  const revision=(c,a=acabado)=>Number(registro(c,a)?.revision||0);
  const nombreEntorno=()=>entorno==='produccion'?'producción':'beta';
  const estadoArte=c=>{const a=ganadora(c),p=registro(c,a);return p?.hash?'reemplazada':c.original?'original':'sin';};
  const etiquetas={reemplazada:'Reemplazada',original:'Original',sin:'Sin imagen'};
  const estado=(mensaje,error=false)=>{$('estado').textContent=mensaje;$('estado').classList.toggle('error',error);};
  function urlSegura(ruta){if(!ruta)return null;try{const u=new URL(ruta,base);return u.origin===location.origin&&/^https?:$/.test(u.protocol)?u.href:null;}catch(e){return null;}}
  const urlVersion=(c,a=acabado)=>{const p=registro(c,a);return p?.hash?urlSegura('api/arte/imagen/'+encodeURIComponent(p.hash)):a!=='normal'?urlVersion(c,'normal'):urlSegura(c.original?.url);};
  const urlActual=c=>urlVersion(c,ganadora(c));
  async function pedir(ruta,op={}){
    // También evita las cachés de las versiones antiguas de la app instalada.
    const u=new URL(ruta,base);u.searchParams.set('test','sin-cache-admin');
    const controlador=new AbortController(),temporizador=setTimeout(()=>controlador.abort(),20000);
    try{
      const r=await fetch(u,{...op,credentials:'same-origin',cache:'no-store',signal:controlador.signal});
      let j;try{j=await r.json();}catch(e){throw Error('El estudio privado no está disponible en esta dirección. Abre el enlace de Cloudflare del juego.');}
      if(!r.ok){const e=Error(j.error||'No se pudo completar la operación.');e.status=r.status;throw e;}return j;
    }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');throw e;}
    finally{clearTimeout(temporizador);}
  }
  function confirmar(titulo,mensaje,accion='Descartar y continuar'){
    const d=$('confirmacion');if(d.open)return Promise.resolve(false);
    $('confirmacionTitulo').textContent=titulo;$('confirmacionTexto').textContent=mensaje;$('confirmacionAceptar').textContent=accion;d.returnValue='';
    return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='aceptar'),{once:true});d.showModal();$('confirmacionCancelar').focus();});
  }
  async function puedeDescartar(){return !pendiente||await confirmar('Tienes una prueba sin guardar','Si continúas, se descartarán la imagen o el encuadre de esta vista previa. La ilustración publicada y los archivos del editor anterior se conservan.');}
  function descartar(limpiarConflicto=true){if(pendiente?.url)URL.revokeObjectURL(pendiente.url);pendiente=null;if(limpiarConflicto)conflicto=false;$('archivo').value='';}
  function botones(){
    $('entrar').disabled=ocupado;
    const c=actual(),hayImagen=!!(pendiente?.url||(c&&urlVersion(c))),p=c&&registro(c);
    for(const id of ['archivo','recargar','salir','recuperar','descartar','restaurar','actualizarRevision','versionNormal','versionFoil','versionDorado'])$(id).disabled=ocupado;
    for(const id of ['encX','encY','encZ','centrar'])$(id).disabled=ocupado||!hayImagen||conflicto;
    $('archivo').disabled=ocupado||conflicto;$('recuperar').disabled=ocupado||conflicto;
    $('usarIlustracion').disabled=ocupado||conflicto||!c||acabado==='normal'||creada(c);
    $('guardar').disabled=ocupado||!pendiente||conflicto||!autenticado;
    $('restaurar').disabled=ocupado||conflicto||!p||(acabado==='normal'?!p.hash&&p.x==null:!creada(c));
    $('conflicto').hidden=!conflicto;$('estudio').setAttribute('aria-busy',String(ocupado));
  }
  function bloquear(valor){ocupado=valor;botones();}
  function aplicarEncuadre(e){
    for(const k of ['x','y','z']){const suf=k.toUpperCase();$('enc'+suf).value=e[k];$('val'+suf).textContent=e[k]+'%';}
    $('vista').style.setProperty('--ex',e.x+'%');$('vista').style.setProperty('--ey',e.y+'%');$('vista').style.setProperty('--ez',String(e.z/100));
  }
  function versiones(){
    const c=actual();if(!c)return;
    const enJuego=ganadora(c);
    for(const [a,suf] of [['normal','Normal'],['foil','Foil'],['dorado','Dorado']]){
      const boton=$('version'+suf);boton.setAttribute('aria-pressed',String(a===acabado));boton.classList.toggle('enJuego',a===enJuego);
      $('estado'+suf).textContent=a===enJuego?'En juego':creada(c,a)?'Disponible':'No creada';
      boton.setAttribute('aria-label',acabados[a]+': '+$('estado'+suf).textContent);
    }
    $('versionEnJuego').textContent='En juego: '+acabados[enJuego]+'. Prioridad automática: Foil dorado → Foil → Normal.';
    const nueva=acabado!=='normal'&&!creada(c),imagenNormal=!!urlVersion(c,'normal');
    $('crearAcabado').hidden=!nueva;
    $('crearAcabadoTexto').textContent='Previsualiza '+acabados[acabado]+' con '+(imagenNormal?'la ilustración Normal':'el símbolo de la carta')+', o sube un diseño propio.';
    $('usarIlustracion').textContent=imagenNormal?'Usar esta ilustración':'Usar este símbolo';
    $('crearAcabadoNota').textContent='El acabado todavía no está creado. Guardar confirma su creación; cada versión conserva su propio encuadre.';
  }
  function vista(){
    const c=actual();if(!c)return;
    const p=registro(c),ruta=pendiente?.url||urlVersion(c),e=pendiente?.encuadre||encuadre(c),nueva=acabado!=='normal'&&!creada(c);
    $('vista').dataset.acabado=acabado;$('vista').classList.toggle('lider',!!c.esLider);$('vista').setAttribute('aria-label','Vista previa de '+c.nombre+' · '+acabados[acabado]+(pendiente?', con cambios sin guardar':nueva?', versión sin crear':''));
    $('nombreCarta').textContent=c.nombre;$('tribuCarta').textContent=c.tribu||(c.esLider?'Protagonista':textoTipo(c.tipo));
    $('textoCarta').textContent=c.texto||'';$('textoCarta').hidden=!c.texto;$('simbolo').textContent=c.simbolo||'✦';$('simbolo').hidden=!!ruta;
    $('imagen').hidden=!ruta;if(ruta){if($('imagen').src!==ruta)$('imagen').src=ruta;}else $('imagen').removeAttribute('src');
    for(const [id,valor] of [['coste',c.coste],['ataque',c.ataque],['vida',c.vida]]){$(id).hidden=c.esLider||valor==null;$(id).textContent=valor??'';}
    aplicarEncuadre(e);
    const heredada=acabado!=='normal'&&(nueva||p?.heredada);
    $('origen').textContent=pendiente?(pendiente.blob?'Vista previa del diseño '+acabados[acabado]+' · Sin guardar.':pendiente.crear?'Vista previa de '+acabados[acabado]+' · Se creará al guardar.':'Vista previa del encuadre '+acabados[acabado]+' · Sin guardar.'):(nueva?'Versión '+acabados[acabado]+' no creada.':heredada?'Encuadre independiente.':p?.hash?'Diseño '+acabados[acabado]+': '+(p.nombre||c.nombre):c.original?'Ilustración original'+(p?.x!=null?' · Encuadre ajustado':''):'Esta carta todavía usa su símbolo. Añade una ilustración para darle vida.');
    if(heredada&&!pendiente?.blob)$('origen').textContent+=' Usa ilustración Normal: si cambia su imagen, se actualizará también aquí.';
    $('borrador').hidden=!pendiente;
    if(pendiente){$('archivoNombre').textContent=pendiente.blob?pendiente.nombre+' · '+Math.round(pendiente.blob.size/1024)+' KB · WebP':pendiente.crear?'Crear '+acabados[acabado]+' de '+c.nombre:'Nuevo encuadre '+acabados[acabado]+' de '+c.nombre;
      const esGanadora=acabado==='dorado'||acabado==='foil'&&!creada(c,'dorado')||acabado==='normal'&&ganadora(c)==='normal';
      $('alcance').textContent='Se guardará sólo la versión '+acabados[acabado]+' en '+nombreEntorno()+'. '+(esGanadora?'Será la versión que verán los jugadores.':'El juego seguirá mostrando '+acabados[ganadora(c)]+', que tiene prioridad.')+' Las demás versiones se conservan.';}
    versiones();botones();
  }
  function detalle(){
    const c=actual();if(!c)return;
    $('grupo').textContent=textoTipo(c.tipo).toLocaleUpperCase('es')+' / '+c.id;$('nombre').textContent=c.nombre;
    $('mazos').textContent=c.mazos?.length?'Mazos: '+c.mazos.join(' · '):'Fuera de los seis mazos principales';
    $('reglasCompletas').textContent=c.texto||'Esta carta no tiene texto de reglas.';
    const p=registro(c),u=urlVersion(c),original=urlSegura(c.original?.url);
    $('enlace').textContent=acabado!=='normal'&&!creada(c)?'Abrir imagen de base ↗':'Abrir imagen '+acabados[acabado]+' ↗';
    $('enlace').hidden=!u;if(u)$('enlace').href=u;else $('enlace').removeAttribute('href');
    $('original').hidden=!original;if(original)$('original').href=original;else $('original').removeAttribute('href');
    $('revision').textContent=acabados[acabado]+' · Revisión '+revision(c);
    const fecha=p?.actualizado&&new Date(p.actualizado);
    $('modificado').textContent=fecha&&!Number.isNaN(fecha.getTime())?(acabado!=='normal'&&!creada(c)?'Versión eliminada el ':'Guardado el ')+fecha.toLocaleString('es-MX'):'Los cambios se guardan en el estudio y están disponibles desde cualquier dispositivo.';
    $('guardar').textContent='Guardar '+acabados[acabado]+' en '+nombreEntorno();
    $('restaurar').textContent=acabado==='normal'?'Restaurar Normal original':'Eliminar '+acabados[acabado];vista();
  }
  function lista(){
    const q=$('buscar').value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,''),f=$('filtroArte').value;
    const filtradas=cartas.filter(c=>(!tipo||c.tipo===tipo)&&(!f||estadoArte(c)===f)&&[c.nombre,c.id,c.tipo,c.tribu,...c.mazos||[]].join(' ').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));
    $('lista').replaceChildren();$('cantidad').textContent=filtradas.length+(filtradas.length===1?' carta':' cartas');
    for(const c of filtradas){
      const b=document.createElement('button');b.className='cartaFila'+(c.id===seleccion?' elegida':'');b.dataset.id=c.id;b.setAttribute('aria-pressed',String(c.id===seleccion));
      const mini=document.createElement('span');mini.className='miniatura';mini.dataset.acabado=ganadora(c);mini.setAttribute('aria-hidden','true');const u=urlActual(c);
      if(u){const img=document.createElement('img');img.src=u;img.loading='lazy';img.alt='';const e=encuadre(c,ganadora(c));img.style.objectPosition=e.x+'% '+e.y+'%';img.style.transform='scale('+e.z/100+')';img.style.transformOrigin=e.x+'% '+e.y+'%';img.onerror=()=>{mini.replaceChildren(document.createTextNode(c.simbolo||'✦'));};mini.append(img);}else mini.textContent=c.simbolo||'✦';
      const textos=document.createElement('span'),n=document.createElement('strong'),m=document.createElement('small'),flecha=document.createElement('span');n.textContent=c.nombre;m.textContent=acabados[ganadora(c)]+' · '+etiquetas[estadoArte(c)];textos.append(n,m);flecha.className='flecha';flecha.textContent='›';flecha.setAttribute('aria-hidden','true');b.append(mini,textos,flecha);
      b.onclick=async()=>{if(ocupado||seleccion===c.id)return;if(!await puedeDescartar())return;descartar();seleccion=c.id;acabado=ganadora(c);lista();detalle();if(innerWidth<=600){document.querySelector('.detalle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});$('nombre').focus({preventScroll:true});}};
      $('lista').append(b);
    }
    if(!filtradas.length){const p=document.createElement('p');p.className='nota';p.textContent='No hay cartas con estos filtros. Prueba con otro nombre o tipo.';$('lista').append(p);}
  }
  function grupos(){
    $('grupos').replaceChildren();for(const t of ['',...new Set(cartas.map(c=>c.tipo))]){const b=document.createElement('button'),n=document.createElement('span'),cuenta=document.createElement('span');n.textContent=t?textoTipo(t):'Todas las cartas';cuenta.textContent=cartas.filter(c=>!t||c.tipo===t).length;b.append(n,cuenta);b.className=t===tipo?'activo':'';b.setAttribute('aria-pressed',String(t===tipo));b.onclick=()=>{tipo=t;grupos();lista();};$('grupos').append(b);}
  }
  async function cargar(){
    const [catalogo,datos]=await Promise.all([pedir('art/catalogo.json'),pedir('api/arte/privado')]);
    if(!Array.isArray(catalogo.cartas)||!catalogo.cartas.length||!Array.isArray(datos.cartas)||!['beta','produccion'].includes(datos.entorno))throw Error('El estudio recibió una biblioteca incompleta. Vuelve a actualizar.');
    cartas=catalogo.cartas;privados=new Map(datos.cartas.map(c=>[c.id,c]));entorno=datos.entorno;autenticado=true;
    if(!actual()){seleccion=cartas.find(c=>c.id==='lider_fender')?.id||cartas.find(c=>c.original)?.id||cartas[0].id;acabado=ganadora(actual());}
    if(pendiente&&pendiente.revision!==revision(actual(),pendiente.acabado))conflicto=true;
    $('acceso').hidden=true;$('estudio').hidden=false;$('salir').hidden=false;$('entorno').textContent=entorno==='produccion'?'PRODUCCIÓN':'BETA';
    $('cuenta').textContent=cartas.length+' cartas · Guardado en la nube';grupos();lista();detalle();
    estado(conflicto?'Hay una versión nueva de esta carta. Actualiza la revisión antes de volver a editar.':pendiente?'Sesión recuperada. Tu vista previa sigue sin publicar.':'Estudio conectado. Elige una carta para revisar o reemplazar su ilustración.');
  }
  function fallo(e){
    if(e.status===401){autenticado=false;$('estudio').hidden=true;$('acceso').hidden=false;$('salir').hidden=true;if($('locales').open)$('locales').close();estado(pendiente?'La sesión venció. Entra de nuevo: tu vista previa sigue aquí, sin publicar.':'Introduce la clave del estudio de sonidos para continuar.');$('clave').focus();}
    else{if(e.status===409){conflicto=true;$('conflicto').querySelector('strong').textContent='La carta cambió en otra sesión.';$('conflicto').querySelector('p').textContent='Actualiza la revisión para ver la versión guardada. Tu borrador no se publicará encima del cambio nuevo.';botones();}estado(e.status===409?'La carta cambió en otra sesión. Actualiza la revisión para continuar sin sobrescribir ese cambio.':e.message,true);}
  }
  async function refrescar(){if(ocupado||!await puedeDescartar())return;descartar();bloquear(true);estado('Actualizando la biblioteca…');try{await cargar();}catch(e){fallo(e);}finally{bloquear(false);}}
  $('login').onsubmit=async e=>{e.preventDefault();if(ocupado)return;bloquear(true);try{await pedir('api/sfx/sesion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clave:$('clave').value})});$('clave').value='';await cargar();}catch(e){fallo(e);}finally{bloquear(false);}};
  $('salir').onclick=async()=>{if(ocupado||!await puedeDescartar())return;bloquear(true);try{await pedir('api/sfx/sesion',{method:'DELETE'});descartar();privados.clear();fallo(Object.assign(Error('Sesión cerrada.'),{status:401}));estado('Sesión cerrada. Los cambios guardados siguen en el estudio.');}catch(e){fallo(e);}finally{bloquear(false);}};
  $('recargar').onclick=refrescar;$('actualizarRevision').onclick=refrescar;$('buscar').oninput=lista;$('filtroArte').onchange=lista;
  $('verBiblioteca').onclick=()=>document.querySelector('.banco').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  function editarEncuadre(){
    if(ocupado||conflicto||!actual())return;
    const e=normalizar({x:$('encX').value,y:$('encY').value,z:$('encZ').value});
    pendiente||={id:seleccion,acabado,crear:acabado!=='normal'&&!creada(actual()),revision:revision(actual()),encuadre:e};pendiente.encuadre=e;
    if(!pendiente.blob&&!pendiente.crear&&JSON.stringify(e)===JSON.stringify(encuadre(actual())))descartar();
    vista();
  }
  for(const id of ['encX','encY','encZ'])$(id).oninput=editarEncuadre;
  $('centrar').onclick=()=>{aplicarEncuadre({x:50,y:50,z:100});editarEncuadre();};
  $('descartar').onclick=async()=>{if(ocupado||!await puedeDescartar())return;descartar(false);detalle();estado(conflicto?'Vista previa descartada. Actualiza la revisión para continuar.':'Vista previa descartada. La ilustración publicada sigue igual.');};
  $('imagen').onerror=()=>{if($('imagen').hidden)return;$('imagen').hidden=true;$('simbolo').hidden=false;estado('No se pudo cargar esta imagen. Actualiza o revisa tu conexión antes de guardar.',true);};
  async function convertir(archivo){
    if(!(archivo instanceof Blob)||archivo.size<16||archivo.size>20000000||!['image/jpeg','image/png','image/webp'].includes(archivo.type))throw Error('Selecciona una imagen JPEG, PNG o WebP de hasta 20 MB.');
    const u=URL.createObjectURL(archivo),img=new Image();
    try{
      await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('No se pudo abrir la imagen. Prueba con otro archivo.')),15000);img.onload=()=>{clearTimeout(t);resolve();};img.onerror=()=>{clearTimeout(t);reject(Error('El archivo no contiene una imagen válida.'));};img.src=u;});
      if(Math.min(img.naturalWidth,img.naturalHeight)<16||img.naturalWidth*img.naturalHeight>60000000)throw Error('La imagen debe medir al menos 16 píxeles por lado y hasta 60 megapíxeles.');
      const escala=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(16,Math.round(img.naturalWidth*escala));canvas.height=Math.max(16,Math.round(img.naturalHeight*escala));const ctx=canvas.getContext('2d');if(!ctx)throw Error('El navegador no pudo preparar la imagen.');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);let blob;
      for(const calidad of [.92,.84,.74,.62]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',calidad));if(!blob||blob.type!=='image/webp')throw Error('Este navegador no puede preparar WebP. Abre el estudio en Safari o Chrome actualizado.');if(blob.size<=1500000)break;}
      if(blob.size>1500000)throw Error('La imagen sigue siendo demasiado pesada. Prueba una versión más pequeña.');
      return {blob,ancho:canvas.width,alto:canvas.height};
    }finally{img.onload=img.onerror=null;img.removeAttribute('src');URL.revokeObjectURL(u);}
  }
  async function preparar(archivo,nombre,enc=null){
    if(ocupado||conflicto)return;if(!await puedeDescartar()){$('archivo').value='';return;}
    bloquear(true);estado('Preparando la ilustración para la vista previa…');
    try{const preparada=await convertir(archivo);descartar();pendiente={id:seleccion,acabado,crear:acabado!=='normal'&&!creada(actual()),revision:revision(actual()),...preparada,url:URL.createObjectURL(preparada.blob),nombre:Array.from(String(nombre||'Ilustración')).slice(0,150).join(''),encuadre:normalizar(enc)};vista();estado('La vista previa está lista. Ajusta el encuadre y guarda cuando te guste.');}
    catch(e){fallo(e);}finally{$('archivo').value='';bloquear(false);}
  }
  $('archivo').onchange=()=>{const archivo=$('archivo').files[0];if(archivo)preparar(archivo,archivo.name);};
  async function guardar(method){
    if(ocupado||conflicto||!autenticado)return;const c=actual(),version=acabado;if(!c||method!=='DELETE'&&(!pendiente||pendiente.id!==c.id||pendiente.acabado!==version))return;
    const r=method==='DELETE'?revision(c,version):pendiente.revision;let body,headers={'If-Match':String(r)};
    if(method==='PUT'){body=pendiente.blob;headers={...headers,'Content-Type':'image/webp','X-Arte-Nombre':encodeURIComponent(pendiente.nombre),'X-Arte-Encuadre':JSON.stringify(pendiente.encuadre)};}
    if(method==='PATCH'){body=JSON.stringify(pendiente.encuadre);headers['Content-Type']='application/json';}
    bloquear(true);estado('Guardando '+acabados[version]+' en '+nombreEntorno()+'…');
    try{
      const resultado=await pedir('api/arte/carta/'+encodeURIComponent(c.id)+'/'+version,{method,headers,body});
      const fila=resultado.carta,modificada=fila?.variantes?.[version]||resultado.variante||resultado;
      if(modificada.id!==c.id||!Number.isInteger(Number(modificada.revision)))throw Error('No se pudo confirmar la revisión guardada. Actualiza la biblioteca antes de continuar.');
      if(fila?.variantes)privados.set(c.id,fila);else{const anterior=privados.get(c.id)||{id:c.id};privados.set(c.id,{...anterior,variantes:{normal:registro(c,'normal'),foil:registro(c,'foil'),dorado:registro(c,'dorado'),[version]:modificada}});}
      descartar();lista();detalle();estado((method==='DELETE'?(version==='normal'?'Normal original restaurada':'Versión '+acabados[version]+' eliminada'):acabados[version]+' guardado')+' en '+nombreEntorno()+'. En juego: '+acabados[ganadora(c)]+'.');
    }catch(e){if(!e.status){conflicto=true;$('conflicto').querySelector('strong').textContent='No pudimos confirmar el guardado.';$('conflicto').querySelector('p').textContent='Actualiza la revisión para comprobar qué llegó al estudio antes de hacer otro cambio.';botones();}fallo(e);}finally{bloquear(false);}
  }
  $('guardar').onclick=()=>guardar(pendiente?.blob?'PUT':'PATCH');
  $('restaurar').onclick=async()=>{
    if(ocupado||conflicto)return;const c=actual();if(!c)return;
    const esNormal=acabado==='normal',enJuego=esNormal?ganadora(c):['dorado','foil','normal'].find(a=>a!==acabado&&creada(c,a));
    const titulo=esNormal?'Restaurar Normal de '+c.nombre:'Eliminar '+acabados[acabado]+' de '+c.nombre;
    const destinoNormal=c.original?'su imagen y encuadre originales':'el símbolo de esta carta';
    const mensaje=(esNormal?'Se restaurará sólo la versión Normal a '+destinoNormal+'.':'Se eliminará sólo la versión '+acabados[acabado]+'.')+' En juego: '+acabados[enJuego]+'. Las demás versiones se conservan.'+(pendiente?' También se descartará tu vista previa.':'');
    if(await confirmar(titulo,mensaje,esNormal?'Restaurar Normal':'Eliminar esta versión'))await guardar('DELETE');
  };
  for(const [a,suf] of [['normal','Normal'],['foil','Foil'],['dorado','Dorado']])$('version'+suf).onclick=async()=>{
    if(ocupado||acabado===a||!await puedeDescartar())return;descartar();acabado=a;detalle();
  };
  $('usarIlustracion').onclick=async()=>{
    const c=actual();if(ocupado||conflicto||!c||acabado==='normal'||creada(c)||!await puedeDescartar())return;
    descartar();pendiente={id:c.id,acabado,crear:true,revision:revision(c),encuadre:encuadre(c,'normal')};vista();estado('Vista previa '+acabados[acabado]+' lista. Guarda para crear esta versión.');
  };
  async function leerLocales(){
    if(!window.indexedDB)throw Error('Este navegador no permite recuperar los borradores locales.');
    if(typeof indexedDB.databases==='function'){const bases=await indexedDB.databases();if(!bases.some(b=>b.name==='caoz-tcg-arte'))return [];}
    // Sólo lectura. Si no existe la base, abortar su creación sin escribir nada.
    return new Promise((resolve,reject)=>{let nueva=false;const req=indexedDB.open('caoz-tcg-arte');req.onupgradeneeded=()=>{nueva=true;req.transaction.abort();};req.onerror=()=>nueva?resolve([]):reject(Error('No se pudo leer el editor anterior. Prueba en el navegador donde trabajaste.'));req.onblocked=()=>reject(Error('Cierra las otras pestañas del editor anterior e inténtalo de nuevo.'));req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('arte')){db.close();resolve([]);return;}const tx=db.transaction('arte','readonly'),r=tx.objectStore('arte').getAll();r.onsuccess=()=>resolve(r.result.filter(x=>x.blob instanceof Blob));r.onerror=()=>reject(Error('No se pudieron leer las ilustraciones locales.'));tx.oncomplete=tx.onabort=()=>db.close();};});
  }
  $('recuperar').onclick=async()=>{
    if(ocupado)return;bloquear(true);estado('Buscando los borradores del editor anterior en este navegador…');
    try{const locales=await leerLocales();$('listaLocales').replaceChildren();for(const reg of locales){const c=cartas.find(c=>c.id===reg.id),fila=document.createElement('div'),n=document.createElement('span'),b=document.createElement('button');fila.className='localFila';n.textContent=(c?.nombre||reg.id)+' · '+Math.round(reg.blob.size/1024)+' KB';b.textContent=c?'Previsualizar':'Carta no disponible';b.disabled=!c;b.onclick=async()=>{$('locales').close();if(!await puedeDescartar())return;descartar();seleccion=c.id;acabado='normal';lista();detalle();await preparar(reg.blob,c.nombre+' · borrador local',reg.encuadre);document.querySelector('.detalle').scrollIntoView({behavior:'instant'});};fila.append(n,b);$('listaLocales').append(fila);}
      if(!locales.length){const p=document.createElement('p');p.className='nota';p.textContent='No encontramos borradores aquí. Los del editor anterior sólo están disponibles en el mismo navegador y dirección donde los guardaste.';$('listaLocales').append(p);}
      $('locales').showModal();estado(locales.length?'Elige un borrador para previsualizarlo. Los archivos locales se conservan.':'No hay borradores del editor anterior en este navegador.');
    }catch(e){fallo(e);}finally{bloquear(false);}
  };
  $('cerrarLocales').onclick=()=>$('locales').close();
  document.querySelectorAll('header a').forEach(a=>a.addEventListener('click',async e=>{if(!pendiente||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();if(await puedeDescartar()){descartar();location.href=a.href;}}));
  window.addEventListener('beforeunload',e=>{if(pendiente){e.preventDefault();e.returnValue='';}});
  bloquear(true);cargar().catch(fallo).finally(()=>bloquear(false));
})();

'use strict';
(function(){
  if(!window.CAOZ_ESTUDIO)return;
  const $=id=>document.getElementById(id),base=new URL('.',location.href),api=new URL('api/estudio/sfx/',base);
  let banco=[],privados=new Map(),seleccion='attack_hit',grupo='Todos',pendiente=null,ocupado=false,tokenDemo=0,decodificador,ondaPeticion=0;
  const player=new Audio();player.preload='auto';
  const estado=(txt,error=false)=>{$('estado').textContent=txt;$('estado').classList.toggle('error',error);};
  const actual=()=>banco.find(s=>s.id===seleccion);
  const mezcla=s=>({...s,...privados.get(s.id),nombre:s.nombre,nombreArchivo:privados.get(s.id)?.nombre});
  const url=s=>new URL(s.hash?'api/estudio/sfx/audio/'+s.hash:s.archivo,base).href;
  async function pedir(ruta,op={}){
    // Las PWA anteriores a 208 ya omiten peticiones con «test=» de su caché.
    // Usar esa salida mientras se actualizan evita que almacenen datos privados.
    const destino=ruta==='sesion'?new URL('api/sfx/sesion',base):new URL(ruta,api);destino.searchParams.set('test','sin-cache-admin');
    const r=await fetch(destino,{...op,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    let j;try{j=await r.json();}catch(e){throw Error('El servidor privado todavía no está disponible en esta dirección.');}
    if(!r.ok){const e=Error(j.error||'No se pudo completar la operación.');e.status=r.status;throw e;}return j;
  }
  function botones(bloquear){
    ocupado=bloquear;for(const id of ['guardar','guardarVolumen','restaurar','archivo','recargar','salir','cancelar'])$(id).disabled=bloquear;
  }
  function detener(){tokenDemo++;player.pause();player.removeAttribute('src');player.load();$('reproducir').textContent='▶ Reproducir';}
  async function escuchar(s,ruta=null){
    try{player.pause();player.src=ruta||url(s);player.volume=Math.min(1,s.volumen*.7);await player.play();estado('Escuchando: '+s.nombre);}
    catch(e){estado('No se pudo reproducir. Vuelve a pulsar Reproducir.',true);}
  }
  async function dibujarOnda(ruta){
    const turno=++ondaPeticion,c=$('onda'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
    try{
      const r=await fetch(ruta);if(!r.ok)return;
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      decodificador||=new AC();const b=await decodificador.decodeAudioData(await r.arrayBuffer());if(turno!==ondaPeticion)return;
      const d=b.getChannelData(0),n=150,paso=Math.max(1,Math.floor(d.length/n));ctx.fillStyle='#cdb276';
      for(let i=0;i<n;i++){let pico=0;for(let j=i*paso;j<Math.min(d.length,(i+1)*paso);j++)pico=Math.max(pico,Math.abs(d[j]));const h=Math.max(2,pico*145);ctx.fillRect(i*c.width/n,(c.height-h)/2,3,h);}
    }catch(e){/* El transporte sigue funcionando si la forma de onda no puede decodificarse. */}
  }
  function descartar(){if(pendiente)URL.revokeObjectURL(pendiente.url);pendiente=null;$('borrador').hidden=true;$('archivo').value='';}
  function detalle(){
    const original=actual();if(!original)return;const s=mezcla(original);
    $('grupo').textContent=s.grupo.toUpperCase()+' / '+s.id;$('nombre').textContent=original.nombre;$('descripcion').textContent=s.detalle;
    $('tiempo').textContent=(s.duracion||original.duracion).toFixed(2)+' s';$('volumen').value=Math.round(s.volumen*100);$('valor').textContent=$('volumen').value+'%';
    $('origen').textContent=s.hash?'Reemplazo: '+s.nombreArchivo:'Banco original · Propuesta 01';
    $('enlace').href=url(s);$('original').href=new URL(original.archivo,base).href;
    $('modificado').textContent=s.actualizado?'Guardado el '+new Date(s.actualizado).toLocaleString('es-MX'):'El original se conserva siempre para poder restaurarlo.';
    dibujarOnda(url(s));
  }
  function lista(){
    const q=$('buscar').value.toLocaleLowerCase('es'),filtrados=banco.filter(s=>(grupo==='Todos'||s.grupo===grupo)&&[s.nombre,s.detalle,s.id].join(' ').toLocaleLowerCase('es').includes(q));
    $('lista').replaceChildren();$('cantidad').textContent=filtrados.length+' sonido'+(filtrados.length===1?'':'s');
    for(const original of filtrados){
      const s=mezcla(original),fila=document.createElement('div');fila.className='sonido'+(s.id===seleccion?' elegido':'');
      const p=document.createElement('button');p.className='play';p.textContent='▶';p.setAttribute('aria-label','Reproducir '+original.nombre);
      p.onclick=()=>{detener();escuchar(s);};
      const e=document.createElement('button');e.className='elegir';e.setAttribute('aria-pressed',String(s.id===seleccion));const n=document.createElement('strong'),m=document.createElement('small');n.textContent=original.nombre;m.textContent=s.grupo+' · '+(s.duracion||original.duracion).toFixed(2)+' s'+(s.hash?' · Reemplazado':'');e.append(n,m);
      e.onclick=()=>{if(ocupado)return;detener();descartar();seleccion=s.id;lista();detalle();if(innerWidth<=580)document.querySelector('.detalle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});};
      const a=document.createElement('a');a.textContent='↗';a.href=url(s);a.target='_blank';a.rel='noopener';a.setAttribute('aria-label','Abrir audio de '+original.nombre);
      fila.append(p,e,a);$('lista').appendChild(fila);
    }
    if(!filtrados.length){const p=document.createElement('p');p.className='nota';p.textContent='No hay sonidos con esa búsqueda.';$('lista').appendChild(p);}
  }
  function grupos(){
    const todos=['Todos',...new Set(banco.map(s=>s.grupo))];$('grupos').replaceChildren();
    for(const g of todos){const b=document.createElement('button');b.className=g===grupo?'activo':'';b.setAttribute('aria-pressed',String(g===grupo));const n=document.createElement('span'),c=document.createElement('span');n.textContent=g;c.textContent=banco.filter(s=>g==='Todos'||s.grupo===g).length;b.append(n,c);b.onclick=()=>{grupo=g;grupos();lista();};$('grupos').appendChild(b);}
  }
  async function cargar(){
    const [c,p]=await Promise.all([fetch(new URL('audio/catalogo.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo cargar la biblioteca.');return r.json();}),pedir('privado')]);
    banco=c.sonidos;privados=new Map(p.sonidos.map(s=>[s.id,s]));
    $('acceso').hidden=true;$('estudio').hidden=false;$('salir').hidden=false;$('entorno').textContent='ESTUDIO ÚNICO';
    const sitio='el estudio';
    $('guardar').textContent='Guardar reemplazo en '+sitio;$('guardarVolumen').textContent='Guardar volumen en '+sitio;
    $('cuenta').textContent=banco.length+' sonidos · Guardado en la nube';grupos();lista();detalle();await CAOZ_ESTUDIO.conectar({tipo:'sfx',estado,bloquear:botones,recargar:cargar,pendiente:()=>ocupado||!!pendiente||Number($('volumen').value)!==Math.round(mezcla(actual()).volumen*100),nombre:id=>banco.find(s=>s.id===id)?.nombre||id});estado('Estudio conectado. Los originales están protegidos y siempre se pueden restaurar.');
  }
  function fallo(e){
    if(e.status===401){detener();descartar();$('estudio').hidden=true;$('acceso').hidden=false;$('salir').hidden=true;}
    estado(e.message,true);
  }
  $('login').onsubmit=async e=>{
    e.preventDefault();$('entrar').disabled=true;const clave=$('clave').value;
    try{await pedir('sesion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clave})});$('clave').value='';await cargar();}
    catch(e){fallo(e);}finally{$('entrar').disabled=false;}
  };
  $('salir').onclick=async()=>{if(ocupado)return;try{await pedir('sesion',{method:'DELETE'});fallo(Object.assign(Error('Sesión cerrada.'),{status:401}));}catch(e){fallo(e);}};
  $('recargar').onclick=async()=>{if(ocupado)return;detener();descartar();try{await cargar();}catch(e){fallo(e);}};
  $('buscar').oninput=lista;$('parar').onclick=detener;
  $('reproducir').onclick=()=>{detener();escuchar({...mezcla(actual()),volumen:Number($('volumen').value)/100});};
  $('volumen').oninput=()=>{$('valor').textContent=$('volumen').value+'%';player.volume=Number($('volumen').value)/100*.7;};
  async function guardar(method,body,extra={}){
    if(ocupado)return;const s=actual(),p=privados.get(s.id);botones(true);detener();estado('Guardando en el estudio privado…');
    try{
      const r=await pedir('sonido/'+s.id,{method,body,headers:{'If-Match':String(p?.revision||0),'X-SFX-Original-Volume':String(s.volumen),...extra}});
      privados.set(s.id,r);descartar();lista();detalle();estado('Guardado en el estudio. Publica los cambios cuando quieras llevarlos al juego.');await CAOZ_ESTUDIO.actualizar();
    }catch(e){fallo(e);}finally{botones(false);}
  }
  $('guardarVolumen').onclick=()=>guardar('PATCH',JSON.stringify({volumen:Number($('volumen').value)/100}),{'Content-Type':'application/json'});
  $('restaurar').onclick=()=>guardar('DELETE');
  function metadatos(ruta){return new Promise((resolve,reject)=>{const a=new Audio(),t=setTimeout(()=>fin(Error('No se pudo leer este formato. Prueba con WAV o MP3.')),8000);function fin(e){clearTimeout(t);a.onloadedmetadata=a.onerror=null;a.removeAttribute('src');a.load();e?reject(e):resolve();}a.preload='metadata';a.onloadedmetadata=()=>fin(!Number.isFinite(a.duration)||a.duration<.03||a.duration>12?Error('El efecto debe durar entre 0.03 y 12 segundos.'):null);a.onerror=()=>fin(Error('El navegador no puede abrir este audio. Prueba con WAV o MP3.'));a.src=ruta;});}
  async function convertir(archivo){
    if(archivo.size>8000000||archivo.size<44)throw Error('Selecciona un audio válido de hasta 8 MB.');
    const muestra=URL.createObjectURL(archivo);try{await metadatos(muestra);}finally{URL.revokeObjectURL(muestra);}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Este navegador no permite convertir el audio.');decodificador||=new AC();
    const b=await decodificador.decodeAudioData(await archivo.arrayBuffer());if(b.duration>12||b.duration<.03)throw Error('El sonido debe durar hasta 12 segundos.');
    const hz=32000,n=Math.round(b.duration*hz),pcm=new Float32Array(n),canales=Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i));let pico=0;
    // Conversión a mono con interpolación; mantiene el archivo pequeño en móvil.
    for(let i=0;i<n;i++){const t=i*b.sampleRate/hz,a=Math.floor(t),f=t-a;let v=0;for(const c of canales)v+=(c[a]||0)*(1-f)+(c[Math.min(a+1,c.length-1)]||0)*f;v/=canales.length;pcm[i]=v;pico=Math.max(pico,Math.abs(v));}
    if(pico<.0003)throw Error('No se detecta sonido. Revisa el archivo o su fase estéreo.');
    const bytes=new ArrayBuffer(44+n*2),v=new DataView(bytes),texto=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};
    texto(0,'RIFF');v.setUint32(4,36+n*2,true);texto(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,hz,true);v.setUint32(28,hz*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);texto(36,'data');v.setUint32(40,n*2,true);
    const ganancia=pico>.85?.85/pico:1;for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-32767,Math.min(32767,pcm[i]*ganancia*Math.min(1,i/160,(n-1-i)/160)*32767)),true);
    return new Blob([bytes],{type:'audio/wav'});
  }
  $('archivo').onchange=async()=>{
    const archivo=$('archivo').files[0];if(!archivo||ocupado)return;descartar();botones(true);estado('Preparando la vista previa…');
    try{const blob=await convertir(archivo);pendiente={blob,nombre:archivo.name,url:URL.createObjectURL(blob)};$('borrador').hidden=false;$('archivoNombre').textContent=archivo.name+' · '+Math.round(blob.size/1024)+' KB';estado('Escucha la prueba antes de guardar. El sonido publicado sigue igual.');}
    catch(e){fallo(e);}finally{botones(false);}
  };
  $('escucharBorrador').onclick=()=>{if(pendiente){detener();escuchar({...actual(),volumen:Number($('volumen').value)/100},pendiente.url);}};
  $('cancelar').onclick=()=>{detener();descartar();estado('Prueba descartada.');};
  $('guardar').onclick=()=>{if(pendiente)guardar('PUT',pendiente.blob,{'Content-Type':'audio/wav','X-SFX-Name':encodeURIComponent(pendiente.nombre)});};
  $('demo').onclick=async()=>{
    detener();const turno=tokenDemo;
    for(const id of ['menu_gold','card_draw','card_play','attack_wind','attack_hit','spell_fire','spell_bard','dice_roll','dice_land','victory']){
      if(turno!==tokenDemo||document.hidden)break;const s=mezcla(banco.find(x=>x.id===id));await escuchar(s);
      await new Promise(r=>{const t=setTimeout(r,((s.duracion||1)+.22)*1000);player.onended=()=>{clearTimeout(t);r();};});
    }
    if(turno===tokenDemo)estado('Propuesta terminada. Puedes escuchar y ajustar cada efecto por separado.');
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)detener();});window.addEventListener('pagehide',()=>{detener();descartar();});
  cargar().catch(e=>{if(e.status===401)estado('Introduce la clave para abrir el estudio.');else fallo(e);});
})();

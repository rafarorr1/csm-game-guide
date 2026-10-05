/* Mesa de montaje local: reproduce el guion real y guarda únicamente cámaras. */
'use strict';
window.CAOZ_ARPG_CINE_EDITOR={crear(T,camara,lienzo,api){
  const M=window.CAOZ_ARPG_CINE_CAMARA,C=M.crear(T),V=T.Vector3,$=id=>document.getElementById(id),clonar=v=>JSON.parse(JSON.stringify(v));
  const nombres={salida:'Sale de la casa',descubrir:'Descubre al mago',pies:'Pies · arranque de carrera',vertigo:'Dolly zoom',carrera:'Carrera y deslizamiento',ataquePOV:'Inicia el hachazo',desaparece:'El mago desaparece',tropezar:'Incorporación, golpe y búsqueda',buscar:'Busca al mago',levantarse:'Se incorpora',voltear:'Mira hacia atrás',techo:'POV · estela, reaparición y hechizo',hechizo:'Conjura el meteorito',cielo:'Revela el meteorito',caida:'Se prepara al impacto',impacto:'Impacto y caída',negro:'Fundido a negro'};
  let toma=M.nueva(),deshacer=[],rehacer=[],guion=[],frames=[],cuadro=0,acumulado=0,ocupado=true,reproduce=false,grabando=false,libre=null,nativa=null,seleccion=null,token=0,ultimoUI=0,arrastre=null,destino=null,arrastreTiempo=null;
  const teclas=new Set(),vistasPrevias=new Map();
  document.body.classList.add('cineEditor');document.title='Cine · Caoz ARPG';
  const cab=document.createElement('header');cab.className='ceCab';cab.innerHTML=`<div><span class="ceMarca">C</span><div><b>CINE <em>/ CAOZ ARPG</em></b><small>El mago y el meteorito · Mesa de montaje</small></div></div><div class="ceAcciones"><span id="ceGuardado" role="status">Preparando…</span><button id="ceImportar">Importar</button><button id="ceExportar">Exportar toma</button><a id="ceProbar" href="./arpg-three.html?etapa=2&heroe=adreida&entrada=mago&toma=local" target="_blank" rel="noopener">Probar en juego ↗</a></div>`;
  const biblioteca=document.createElement('aside');biblioteca.className='ceBiblioteca';biblioteca.innerHTML='<div class="ceSeccion"><small>PROYECTO</small><h2>Cinemáticas</h2></div><nav id="ceEscenas" aria-label="Cinemáticas del juego"></nav><p class="ceBibliotecaNota">Las secuencias con ↗ se revisan en el juego. El epílogo permite editar sus cámaras aquí.</p>';
  for(const escena of M.escenas){
    const enlace=document.createElement('a'),actual=escena.id==='mago',url=new URL(actual?'./arpg-cine.html':'./arpg-three.html',location.href);
    for(const clave of ['piso','resolucion']){const valor=new URLSearchParams(location.search).get(clave);if(valor)url.searchParams.set(clave,valor);}
    if(!actual){url.searchParams.set('etapa','2');url.searchParams.set('heroe','adreida');url.searchParams.set('entrada',escena.entrada);enlace.target='_blank';enlace.rel='noopener';}
    enlace.href=url.href;enlace.className='ceEscena';if(actual)enlace.setAttribute('aria-current','page');
    const nombre=document.createElement('b'),detalle=document.createElement('small'),modo=document.createElement('span');nombre.textContent=escena.nombre;detalle.textContent=escena.detalle;modo.textContent=actual?'Editando cámaras':escena.modo==='interactiva'?'Entrar en la escena ↗':'Reproducir secuencia ↗';
    enlace.append(nombre,detalle,modo);if(actual)enlace.onclick=e=>{e.preventDefault();$('cePlanos').querySelector('button')?.focus();};biblioteca.querySelector('nav').append(enlace);
  }
  const izq=document.createElement('aside');izq.className='ceGuion';izq.innerHTML=`<div class="ceSeccion"><small>01 / ACCIÓN PROGRAMADA</small><h1>Guion</h1><p>Elige un plano. La actuación está bloqueada. Aquí sólo editas la cámara.</p></div><nav id="cePlanos" aria-label="Planos de la cinemática"></nav><div class="ceAyuda"><b>Tu cámara, la misma acción.</b><p>Los cambios se guardan en este navegador. Exporta la toma para compartirla o integrarla al proyecto.</p></div>`;
  const centro=document.createElement('section');centro.className='ceCentro';centro.innerHTML=`<div class="ceVistaTitulo"><span id="cePlanoTitulo">Preparando la escena…</span><span id="ceModo">CÁMARA ORIGINAL</span></div><div id="ceVista" class="ceVista"></div><div class="ceTransporte"><button id="ceInicio" title="Volver al inicio">↤</button><button id="ceAtras" title="Un cuadro atrás">−1f</button><button id="cePlay" class="cePrimario">▶ Reproducir</button><button id="ceAdelante" title="Un cuadro adelante">+1f</button><output id="ceReloj">00:00:00</output><select id="ceVelocidad" aria-label="Velocidad de reproducción"><option value=".25">¼ velocidad</option><option value=".5">½ velocidad</option><option value="1" selected>1× velocidad</option></select><output id="ceFrames" class="ceFrames" aria-label="Cuadros de la cinemática" title="Índices desde 0; línea de tiempo a 60 cuadros por segundo">Plano F000 · Global F0000</output><label><input id="ceRepetir" type="checkbox"> Repetir plano</label></div><section class="ceMontaje"><div class="ceFila"><small>02 / LÍNEA DE TIEMPO</small><span id="ceDuracion"></span></div><input id="ceTiempo" type="range" min="0" max="1" value="0" step="1" aria-label="Tiempo de la cinemática"><div id="ceTiras" class="ceTiras"></div><div class="ceFila cePlanoLocal"><b id="ceLocalTitulo">Tiempo del plano</b><output id="ceLocalReloj">0,00 s</output></div><input id="ceLocal" type="range" min="0" max="1" step="1" value="0" aria-label="Tiempo dentro del plano"><div id="ceMarcas" class="ceMarcas" aria-label="Keyframes del plano"></div></section><p id="ceMensaje" role="status" aria-live="polite">Registrando los tiempos de la acción programada…</p><div class="ceAtajos"><span>Arrastrar: orbitar</span><span>Shift + arrastrar: desplazar</span><span>Rueda: acercar</span><span>WASD + Q/E: mover</span><span>K: keyframe</span><span>Espacio: reproducir</span></div>`;
  const der=document.createElement('aside');der.className='ceCamara';der.innerHTML=`<div class="ceSeccion"><small>03 / DIRECCIÓN DE CÁMARA</small><h2>Encuadre</h2></div><fieldset id="ceCampos" disabled><label>Nombre de la toma<input id="ceNombre" maxlength="100"></label><div class="ceFila"><button id="ceOriginal">Cámara original</button><button id="ceLibre">Mover cámara</button></div><div class="ceFila"><button id="ceAdreida">Mirar a Adreida</button><button id="ceMago">Mirar al mago</button></div><h3>Posición <small>metros</small></h3><div class="ceXYZ">${['x','y','z'].map(a=>`<label>${a.toUpperCase()}<input id="cePos${a}" type="number" step=".1" min="-500" max="500"></label>`).join('')}</div><h3>Punto de mira <small>metros</small></h3><div class="ceXYZ">${['x','y','z'].map(a=>`<label>${a.toUpperCase()}<input id="ceMira${a}" type="number" step=".1" min="-500" max="500"></label>`).join('')}</div><label class="ceFila">Lente / campo de visión <output id="ceFovTexto">42°</output></label><input id="ceFov" type="range" min="8" max="110" step=".1" aria-label="Campo de visión"><label>Movimiento hacia el siguiente keyframe<select id="ceCurva"><option value="suave">Suave · entrada y salida gradual</option><option value="lineal">Lineal · velocidad constante</option><option value="corte">Corte · mantener y cambiar</option></select></label><label id="cePOVControl" class="ceCheck"><input type="checkbox" id="cePOV"> Mostrar brazos de la actuación POV</label><button id="ceKey" class="cePrimario ceAncho">◆ Guardar keyframe · K</button><button id="ceGrabar" class="ceGrabar ceAncho">● Grabar recorrido de cámara</button><p class="ceNota">Graba mientras la acción avanza hasta el final del plano. Puedes seguir moviendo la cámara.</p><div class="ceFila"><button id="ceUndo" disabled>↶ Deshacer</button><button id="ceRedo" disabled>↷ Rehacer</button></div><h3>Keyframes <span id="ceCuenta">0</span></h3><div id="ceLista" class="ceLista"></div><div class="ceFila"><label>Tiempo (s)<input type="number" id="ceKeyTiempo" step=".017" min="0"></label><button id="ceMoverKey" disabled>Mover</button><button id="ceEliminar" disabled>Eliminar</button></div><button id="ceBase" class="ceAncho">Crear keyframes de cámara original</button><button id="ceRestaurar" class="ceAncho">Restaurar cámara de este plano</button></fieldset><input id="ceArchivo" type="file" accept="application/json,.json" hidden></aside>`;
  document.body.prepend(cab,biblioteca,izq,centro,der);$('ceVista').append(document.querySelector('.apShell'));const velo=document.createElement('div');velo.className='ceOcupado';velo.textContent='Preparando la acción…';$('ceVista').append(velo);lienzo.tabIndex=0;lienzo.setAttribute('aria-label','Vista previa de la cinemática. Arrastra para mover la cámara.');
  try{const guardada=localStorage.getItem(M.CLAVE);if(guardada)toma=M.validar(JSON.parse(guardada));}catch(e){mensaje(e.message+' Se abrió la cámara original.');}
  $('ceNombre').value=toma.nombre;
  function mensaje(t){$('ceMensaje').textContent=t;}
  function guardar(){try{localStorage.setItem(M.CLAVE,JSON.stringify(toma));$('ceGuardado').textContent='● Guardado en este navegador';}catch{$('ceGuardado').textContent='Sin espacio para guardar';mensaje('Exporta la toma para conservarla; no se pudo guardar en el navegador.');}}
  function respaldar(anterior){if(anterior.version>=M.VERSION)return;const datos=JSON.stringify(anterior),base=M.CLAVE+'.respaldo-v'+anterior.version;let clave=base,i=1;while(localStorage.getItem(clave)!==null&&localStorage.getItem(clave)!==datos)clave=base+'.'+i++;if(localStorage.getItem(clave)===null)localStorage.setItem(clave,datos);}
  function recordar(){deshacer.push(clonar(toma));if(deshacer.length>40)deshacer.shift();rehacer=[];}
  const planoEn=f=>guion.find(p=>f>=p.inicio&&f<p.fin)||guion.at(-1);
  const plano=()=>planoEn(cuadro);
  const fase=()=>M.planoDeFase(api.estado()?.fase);
  const tiempoLocal=()=>(cuadro-(plano()?.inicio||0))/60;
  const claves=()=>toma.planos[fase()]?.claves||[];
  // Guardar o seleccionar una cámara nunca cambia la representación del actor.
  // Una pista todavía vacía conserva la actuación original, incluso si antes
  // contenía un keyframe borrado con el antiguo valor por defecto «externa».
  function vistaDeAccion(){const f=fase(),p=toma.planos[f];return p?.claves.length?(p.vistas?.[api.estado().fase]||p.vista):(vistasPrevias.get(f)||'original');}
  const reloj=f=>`${String(Math.floor(f/3600)).padStart(2,'0')}:${String(Math.floor(f/60)%60).padStart(2,'0')}:${String(f%60).padStart(2,'0')}`;
  function ocupadoEn(v,t='Preparando la acción…'){ocupado=v;velo.hidden=!v||!!guion.at(-1)?.fin;velo.textContent=t;$('ceCampos').disabled=v;centro.classList.toggle('ceBloqueado',v);$('ceTiempo').disabled=$('ceLocal').disabled=!guion.at(-1)?.fin;}
  const ceder=()=>new Promise(r=>setTimeout(r,0));
  function capturarNativa(){nativa=C.capturar(camara,Math.max(1,camara.position.distanceTo(new V().fromArray(api.estado().actor).add(new V(0,1,0)))));}
  async function preparar(){
    try{
      api.reiniciar();frames=[{fase:fase(),accion:api.estado().fase,tAccion:0,t:0,estado:api.estado(),camara:C.capturar(camara),cuadro:api.capturar()}];guion=[{fase:fase(),inicio:0,fin:0}];
      for(let i=1;i<3600;i++){
        api.paso(1/60);const e=api.estado(),id=M.planoDeFase(e.fase);
        if(id!==guion.at(-1).fase){guion.at(-1).fin=i;guion.push({fase:id,inicio:i,fin:0});}
        frames.push({fase:id,accion:e.fase,tAccion:e.t,t:(i-guion.at(-1).inicio)/60,estado:e,camara:C.capturar(camara),cuadro:api.capturar()});
        if(e.terminado)break;if(i%90===0)await ceder();
      }
      if(!api.estado().terminado)throw Error('La acción excede un minuto; revisa el guion antes de editarlo.');
      guion.at(-1).fin=frames.length;respaldar(toma);toma=C.agrupar(toma,frames);mostrar(0);dibujarGuion();ocupadoEn(false);actualizar(true);guardar();mensaje('Elige un plano, mueve la cámara y pulsa K para registrar el encuadre.');
    }catch(e){ocupadoEn(true,'No se pudo preparar la escena');mensaje(e.message);}
  }
  async function buscar(f){
    if(!guion.at(-1)?.fin||!Number.isFinite(f))return false;
    const solicitud=++token;reproduce=false;if(grabando)terminarGrabacion();libre=null;seleccion=null;acumulado=0;f=Math.max(0,Math.min(frames.length-1,Math.round(f)));destino=f;ocupadoEn(true);actualizar();
    try{
      // Una sola restauración por cuadro de pantalla, sin volver a simular.
      await new Promise(requestAnimationFrame);if(solicitud!==token)return false;
      const anterior=fase();mostrar(f);destino=null;ocupadoEn(false);actualizar(anterior!==fase());return true;
    }catch(e){if(solicitud!==token)return false;destino=null;ocupadoEn(false);actualizar();mensaje('No se pudo buscar ese cuadro: '+e.message);return false;}
  }
  function mostrar(f){cuadro=f;api.mostrar(frames[f].cuadro);C.aplicar(camara,frames[f].camara);capturarNativa();}
  function dibujarGuion(){
    $('cePlanos').replaceChildren();$('ceTiras').replaceChildren();
    guion.forEach((p,i)=>{
      const b=document.createElement('button');b.className='cePlano';b.dataset.fase=p.fase;b.innerHTML=`<small>${String(i+1).padStart(2,'0')}</small><span>${nombres[p.fase]}<small>${((p.fin-p.inicio)/60).toFixed(2)} s</small></span><i></i>`;b.onclick=()=>buscar(p.inicio);$('cePlanos').append(b);
      const tira=document.createElement('button');tira.title=nombres[p.fase];tira.textContent=String(i+1).padStart(2,'0');tira.style.flexGrow=p.fin-p.inicio;tira.onclick=()=>buscar(p.inicio);tira.dataset.fase=p.fase;$('ceTiras').append(tira);
    });$('ceTiempo').max=frames.length-1;$('ceDuracion').textContent=`${guion.length} planos · ${((frames.length-1)/60).toFixed(2)} s`;
  }
  function vistaActual(){return libre||C.tomaEn(toma,{...api.estado(),tPlano:tiempoLocal()}).camara||nativa;}
  function camposCamara(){const k=vistaActual();if(!k)return;const objetivo=new V(0,0,-1).applyQuaternion(new T.Quaternion().fromArray(k.rot)).multiplyScalar(k.distancia).add(new V().fromArray(k.pos));
    ['x','y','z'].forEach((a,i)=>{if(document.activeElement!==$('cePos'+a))$('cePos'+a).value=k.pos[i].toFixed(2);if(document.activeElement!==$('ceMira'+a))$('ceMira'+a).value=objetivo[a].toFixed(2);});$('ceFov').value=k.fov;$('ceFovTexto').textContent=k.fov.toFixed(1)+'°';
  }
  function lista(){
    $('ceLista').replaceChildren();$('ceMarcas').replaceChildren();const p=plano();if(!p)return;
    claves().forEach((k,i)=>{
      const b=document.createElement('button');b.className='ceKeyItem';b.setAttribute('aria-pressed',String(seleccion===i));b.textContent=`◆ ${k.t.toFixed(2)} s  ·  ${k.fov.toFixed(0)}°  ·  ${k.curva}`;
      const ir=async()=>{const f=frames.findIndex((v,j)=>j>=p.inicio&&j<p.fin&&v.t>=k.t-1/120);if(!await buscar(f<0?p.fin-1:f))return;seleccion=i;libre=clonar(k);$('ceCurva').value=k.curva;$('ceKeyTiempo').value=k.t.toFixed(3);actualizar(true);};b.onclick=ir;$('ceLista').append(b);
      const m=document.createElement('button');m.textContent='◆';m.title=`Keyframe ${i+1} · ${k.t.toFixed(2)} segundos`;m.setAttribute('aria-label',m.title);m.style.left=`${Math.min(99,k.t/((p.fin-p.inicio)/60)*100)}%`;m.onclick=ir;$('ceMarcas').append(m);
    });$('ceCuenta').textContent=claves().length;$('ceEliminar').disabled=$('ceMoverKey').disabled=seleccion===null;
    if(!claves().length){const v=document.createElement('p');v.className='ceNota';v.textContent='Sin keyframes: se usa la cámara original.';$('ceLista').append(v);}
    $('ceKeyTiempo').max=Math.max(0,(p.fin-p.inicio-1)/60).toFixed(3);
  }
  function actualizar(completo=false){
    if(!guion.at(-1)?.fin)return;
    // El reloj de render no debe devolver el pulgar al último cuadro confirmado.
    const visible=destino??cuadro,p=arrastreTiempo?.id==='ceLocal'?arrastreTiempo.plano:planoEn(visible),f=frames[visible].fase;
    $('ceFrames').textContent=`Plano F${String(visible-p.inicio).padStart(3,'0')} · Global F${String(visible).padStart(4,'0')}`;$('ceFrames').setAttribute('aria-label',`Cuadro ${visible-p.inicio} del plano ${guion.indexOf(p)+1}, cuadro global ${visible}. Base 60 cuadros por segundo, índices desde cero.`);
    $('ceReloj').textContent=reloj(visible);$('ceTiempo').value=visible;$('ceTiempo').setAttribute('aria-valuetext',reloj(visible));
    $('ceLocal').max=p.fin-p.inicio-1;$('ceLocal').value=visible-p.inicio;$('ceLocalReloj').textContent=frames[visible].t.toFixed(2)+' s';$('ceLocal').setAttribute('aria-valuetext',$('ceLocalReloj').textContent);
    $('ceLocalTitulo').textContent='Tiempo del plano · '+nombres[p.fase];$('cePlanoTitulo').textContent=`${String(guion.indexOf(p)+1).padStart(2,'0')} / ${nombres[f]}`;
    const sinBrazos=f==='techo';$('cePOVControl').hidden=sinBrazos;$('cePOVControl').style.setProperty('display',sinBrazos?'none':'','important');$('cePOV').disabled=sinBrazos;$('cePOV').checked=!sinBrazos&&vistaDeAccion()==='original';
    $('cePlay').textContent=reproduce?'Ⅱ Pausar':'▶ Reproducir';if(ocupado)return;
    $('ceModo').textContent=grabando?'● GRABANDO':libre?'CÁMARA LIBRE · PULSA K':claves().length?'TU TOMA':'CÁMARA ORIGINAL';$('ceModo').dataset.libre=String(!!libre);$('ceGrabar').textContent=grabando?'■ Detener grabación':'● Grabar recorrido de cámara';$('ceGrabar').classList.toggle('grabando',grabando);$('ceUndo').disabled=!deshacer.length;$('ceRedo').disabled=!rehacer.length;
    if(completo){for(const b of document.querySelectorAll('[data-fase]')){b.setAttribute('aria-current',b.dataset.fase===f?'step':'false');if(b.querySelector('i'))b.querySelector('i').textContent=toma.planos[b.dataset.fase]?.claves.length?'◆':'';}lista();}
    camposCamara();
  }
  function hacerLibre(){if(ocupado)return;libre??=clonar(vistaActual());if(!grabando)reproduce=false;camposCamara();actualizar();}
  function ponerClave(registrarHistoria=true){if(ocupado)return;if(registrarHistoria)recordar();const f=fase(),vista=vistaDeAccion(),p=toma.planos[f]??={vista,claves:[]},t=Math.round(tiempoLocal()*60)/60,k={...clonar(libre||vistaActual()),t,curva:grabando?'lineal':$('ceCurva').value};
    if(p.nativas){p.nativas=p.nativas.filter(a=>a!==api.estado().fase);if(!p.nativas.length)delete p.nativas;}
    if(p.nativasHasta&&api.estado().t+1e-8<p.nativasHasta[api.estado().fase]){delete p.nativasHasta[api.estado().fase];if(!Object.keys(p.nativasHasta).length)delete p.nativasHasta;}
    if(!p.claves.length){p.vista=vista;delete p.vistas;}vistasPrevias.delete(f);p.claves=p.claves.filter(c=>Math.abs(c.t-t)>1/120);p.claves.push(k);p.claves.sort((a,b)=>a.t-b.t);seleccion=p.claves.indexOf(k);$('ceKeyTiempo').value=t.toFixed(3);if(!grabando)libre=null;guardar();actualizar(true);if(!grabando)mensaje(`Keyframe guardado en ${nombres[f]}, ${t.toFixed(2)} s.`);
  }
  function terminarGrabacion(){if(!grabando)return;ponerClave(false);grabando=false;reproduce=false;libre=null;guardar();actualizar(true);mensaje('Recorrido guardado. Reproduce el plano para revisarlo.');}
  function reproducir(){if(ocupado)return;if(grabando){terminarGrabacion();return;}libre=null;seleccion=null;if(cuadro>=frames.length-1){buscar(0).then(ok=>{if(ok)reproduce=true;});}else reproduce=!reproduce;actualizar(true);}
  $('cePlay').onclick=reproducir;$('ceInicio').onclick=()=>buscar(0);$('ceAtras').onclick=()=>buscar(cuadro-1);$('ceAdelante').onclick=()=>buscar(cuadro+1);
  for(const id of ['ceTiempo','ceLocal']){
    const control=$(id);control.disabled=true;
    control.onpointerdown=e=>{if(!guion.at(-1)?.fin)return;reproduce=false;if(grabando)terminarGrabacion();arrastreTiempo={id,plano:planoEn(destino??cuadro)};};
    const solicitar=()=>{if(!guion.at(-1)?.fin)return;reproduce=false;const p=arrastreTiempo?.id===id?arrastreTiempo.plano:planoEn(destino??cuadro),f=Number(control.value)+(id==='ceLocal'?p.inicio:0);if(f!==(destino??cuadro))void buscar(f);};
    control.oninput=solicitar;control.onchange=solicitar;
    // El inicio del plano queda fijo durante todo el gesto, incluso al buscar hacia atrás.
    const soltar=()=>{if(arrastreTiempo?.id===id){arrastreTiempo=null;actualizar(true);}};
    for(const evento of ['pointerup','pointercancel','lostpointercapture','blur'])control.addEventListener(evento,soltar);
  }
  $('ceLibre').onclick=()=>{hacerLibre();lienzo.focus();};$('ceOriginal').onclick=()=>{if(ocupado)return;reproduce=false;libre=clonar(nativa);actualizar();mensaje('Encuadre original recuperado en la vista previa. Pulsa K para guardarlo o reproduce para volver a tu toma.');};
  function mirarA(p){hacerLibre();if(!libre)return;const desde=new V().fromArray(libre.pos),hacia=new V().fromArray(p);camara.position.copy(desde);camara.lookAt(hacia);libre.rot=camara.quaternion.toArray();libre.distancia=Math.max(.2,Math.min(300,desde.distanceTo(hacia)));actualizar();}
  $('ceAdreida').onclick=()=>{const p=[...api.estado().actor];p[1]+=1;mirarA(p);};$('ceMago').onclick=()=>{const p=[...api.estado().mago];p[1]+=1.3;mirarA(p);};
  for(const pref of ['cePos','ceMira'])for(const a of ['x','y','z'])$(pref+a).oninput=()=>{const pos=['x','y','z'].map(a=>Number($('cePos'+a).value)),obj=['x','y','z'].map(a=>Number($('ceMira'+a).value));if([...pos,...obj].some(n=>!Number.isFinite(n)||Math.abs(n)>500)||new V().fromArray(pos).distanceTo(new V().fromArray(obj))<.2){mensaje('Usa coordenadas entre −500 y 500 y separa el punto de mira de la cámara.');camposCamara();return;}hacerLibre();libre.pos=pos;mirarA(obj);};
  $('ceFov').oninput=()=>{const fov=Number($('ceFov').value);hacerLibre();libre.fov=fov;actualizar();};
  $('ceKey').onclick=()=>ponerClave();$('ceGrabar').onclick=()=>{if(ocupado)return;if(grabando){terminarGrabacion();return;}hacerLibre();recordar();grabando=true;reproduce=true;ponerClave(false);lienzo.focus();mensaje('Grabando a 10 keyframes por segundo. La grabación se detiene al terminar este plano.');};
  $('cePOV').onchange=()=>{if(fase()==='techo'){$('cePOV').checked=false;return;}const f=fase(),vista=$('cePOV').checked?'original':'externa';if(claves().length){recordar();toma.planos[f].vista=vista;delete toma.planos[f].vistas;guardar();}else vistasPrevias.set(f,vista);};
  $('ceCurva').onchange=()=>{if(seleccion!==null&&claves()[seleccion]){recordar();claves()[seleccion].curva=$('ceCurva').value;guardar();lista();}};
  $('ceEliminar').onclick=()=>{if(seleccion===null)return;recordar();vistasPrevias.set(fase(),vistaDeAccion());claves().splice(seleccion,1);seleccion=null;libre=null;guardar();actualizar(true);};
  $('ceMoverKey').onclick=()=>{const p=plano(),t=Math.round(Number($('ceKeyTiempo').value)*60)/60;if(!Number.isFinite(t)||t<0||t>(p.fin-p.inicio-1)/60||claves().some((k,i)=>i!==seleccion&&Math.abs(k.t-t)<1/120)){mensaje('Elige un momento libre dentro del plano.');return;}recordar();claves()[seleccion].t=t;claves().sort((a,b)=>a.t-b.t);seleccion=null;libre=null;guardar();actualizar(true);};
  $('ceBase').onclick=()=>{recordar();const p=plano(),vista=vistaDeAccion(),vistas=toma.planos[p.fase]?.vistas,ks=[];for(let f=p.inicio;f<p.fin;f++){if((f-p.inicio)%6===0||f===p.fin-1)ks.push({...clonar(frames[f].camara),t:Math.round(frames[f].t*60)/60,curva:'lineal'});}toma.planos[p.fase]={vista,claves:ks,...(vistas?{vistas:clonar(vistas)}:{})};vistasPrevias.delete(p.fase);libre=null;seleccion=null;guardar();actualizar(true);mensaje('La cámara programada ya tiene keyframes editables. Selecciona uno para afinarlo.');};
  $('ceRestaurar').onclick=()=>{recordar();vistasPrevias.set(fase(),vistaDeAccion());delete toma.planos[fase()];seleccion=null;libre=null;guardar();actualizar(true);mensaje('Plano restaurado. Puedes recuperarlo con Deshacer.');};
  function historial(origen,destino){if(!origen.length)return;if(grabando)terminarGrabacion();destino.push(clonar(toma));toma=origen.pop();vistasPrevias.clear();libre=null;seleccion=null;$('ceNombre').value=toma.nombre;guardar();actualizar(true);}
  $('ceUndo').onclick=()=>historial(deshacer,rehacer);$('ceRedo').onclick=()=>historial(rehacer,deshacer);$('ceNombre').onchange=()=>{recordar();toma.nombre=$('ceNombre').value||'Mi toma';guardar();};
  $('ceExportar').onclick=()=>{if(grabando)terminarGrabacion();const b=new Blob([JSON.stringify(toma,null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='caoz-cinematica-mago.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);mensaje('Toma exportada. Este archivo contiene tus cámaras y puede volver a importarse.');};
  $('ceImportar').onclick=()=>$('ceArchivo').click();$('ceArchivo').onchange=async()=>{try{const f=$('ceArchivo').files[0];if(!f)return;if(f.size>1024*1024)throw Error('El archivo excede 1 MB.');if(ocupado)throw Error('Espera a que termine de preparar la escena antes de importar.');const anterior=M.validar(JSON.parse(await f.text()));respaldar(anterior);const nueva=C.agrupar(anterior,frames);recordar();toma=nueva;vistasPrevias.clear();libre=null;seleccion=null;$('ceNombre').value=toma.nombre;guardar();actualizar(true);mensaje('Toma importada. Puedes deshacer para recuperar la anterior.');}catch(e){mensaje('No se importó el archivo: '+e.message);}finally{$('ceArchivo').value='';}};
  function mover(dx,dy,modo){hacerLibre();if(!libre)return;const pos=new V().fromArray(libre.pos),rot=new T.Quaternion().fromArray(libre.rot),frente=new V(0,0,-1).applyQuaternion(rot),pivote=pos.clone().addScaledVector(frente,libre.distancia);
    if(modo==='desplazar'){const escala=libre.distancia*.002,mov=new V(-dx*escala,dy*escala,0).applyQuaternion(rot);pos.add(mov);pivote.add(mov);}
    else if(modo==='mirar'){const e=new T.Euler().setFromQuaternion(rot,'YXZ');e.y-=dx*.004;e.x=Math.max(-1.5,Math.min(1.5,e.x-dy*.004));libre.rot=new T.Quaternion().setFromEuler(e).toArray();actualizar();return;}
    else{const sph=new T.Spherical().setFromVector3(pos.clone().sub(pivote));sph.theta-=dx*.006;sph.phi=Math.max(.03,Math.min(Math.PI-.03,sph.phi-dy*.006));pos.copy(pivote).add(new V().setFromSpherical(sph));}
    libre.pos=pos.toArray();camara.position.copy(pos);camara.lookAt(pivote);libre.rot=camara.quaternion.toArray();actualizar();
  }
  lienzo.addEventListener('pointerdown',e=>{if(ocupado)return;e.preventDefault();lienzo.focus();arrastre={x:e.clientX,y:e.clientY,modo:e.button===2?'mirar':e.shiftKey||e.button===1?'desplazar':'orbitar'};lienzo.setPointerCapture(e.pointerId);hacerLibre();});
  lienzo.addEventListener('pointermove',e=>{if(!arrastre)return;mover(e.clientX-arrastre.x,e.clientY-arrastre.y,arrastre.modo);arrastre.x=e.clientX;arrastre.y=e.clientY;});
  for(const n of ['pointerup','pointercancel','lostpointercapture'])lienzo.addEventListener(n,()=>arrastre=null);
  lienzo.addEventListener('wheel',e=>{e.preventDefault();hacerLibre();if(!libre)return;const antes=libre.distancia;libre.distancia=Math.max(.2,Math.min(300,antes*Math.exp(e.deltaY*.001)));const v=new V(0,0,-1).applyQuaternion(new T.Quaternion().fromArray(libre.rot)).multiplyScalar(antes-libre.distancia);libre.pos=new V().fromArray(libre.pos).add(v).toArray();actualizar();},{passive:false});
  addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea')||ocupado)return;if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();historial(e.shiftKey?rehacer:deshacer,e.shiftKey?deshacer:rehacer);return;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)reproducir();}else if(e.code==='KeyK'){e.preventDefault();if(!e.repeat)ponerClave();}else if(['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();buscar(cuadro+(e.code==='ArrowLeft'?-1:1));}else if(document.activeElement===lienzo&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();hacerLibre();teclas.add(e.code);}});
  addEventListener('keyup',e=>teclas.delete(e.code));addEventListener('blur',()=>{teclas.clear();arrastre=null;reproduce=false;if(grabando)terminarGrabacion();});document.addEventListener('visibilitychange',()=>{if(document.hidden){teclas.clear();reproduce=false;if(grabando)terminarGrabacion();}});
  function paso(dt){if(ocupado)return;
    if(libre&&teclas.size){const x=Number(teclas.has('KeyD'))-Number(teclas.has('KeyA')),z=Number(teclas.has('KeyS'))-Number(teclas.has('KeyW')),y=Number(teclas.has('KeyE'))-Number(teclas.has('KeyQ')),v=new V(x,0,z).applyQuaternion(new T.Quaternion().fromArray(libre.rot));v.y+=y;if(v.lengthSq())libre.pos=new V().fromArray(libre.pos).add(v.normalize().multiplyScalar(dt*(teclas.has('ShiftLeft')||teclas.has('ShiftRight')?12:4))).toArray();}
    if(reproduce){acumulado+=dt*Number($('ceVelocidad').value);const p=plano();while(acumulado>=1/60){acumulado-=1/60;if(cuadro>=frames.length-1){reproduce=false;break;}if(cuadro+1>=p.fin&&(grabando||$('ceRepetir').checked)){if(grabando)terminarGrabacion();else buscar(p.inicio).then(ok=>{if(ok)reproduce=true;});break;}const anterior=fase();mostrar(cuadro+1);if(grabando&&cuadro%6===0)ponerClave(false);if(fase()!==anterior){seleccion=null;actualizar(true);}}}
    ultimoUI+=dt;if(ultimoUI>.07){ultimoUI=0;actualizar();}
  }
  function antesDibujo(){if(ocupado)return;C.aplicar(camara,vistaActual());api.vista(vistaDeAccion()==='externa');}
  setTimeout(preparar,0);return {paso,antesDibujo};
}};

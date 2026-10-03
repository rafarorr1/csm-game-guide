import {resumir} from './arpg-inspector-metricas.mjs';
const $=id=>document.getElementById(id);
if(!new URLSearchParams(location.search).has('inspector')){const u=new URL(location.href);u.searchParams.set('inspector','1');location.replace(u);}
else iniciar();
async function iniciar(){
  document.body.classList.add('apLaboratorio');
  const panel=document.createElement('aside');panel.className='labPanel';panel.innerHTML=`
    <header><small>CAOZ ARPG · HERRAMIENTAS</small><h1>Inspector</h1><p>Combate, animación y rendimiento · v5</p></header>
    <p id="labEstado" role="status">Preparando el juego…</p>
    <fieldset id="labEdicion" disabled>
      <legend>Escena de trabajo</legend>
      <label>Personaje<select id="labHeroe"><option value="adreida">Adreida</option><option value="mohamed">Mohamed</option></select></label>
      <div class="labFila"><button id="labLimpiar">Reiniciar escena</button><button id="labPausa">Congelar</button><button id="labPaso">+1 cuadro</button></div>
      <label>Daño básico<input id="labDano" type="number" min="1" max="100" value="12"></label>
      <label>Velocidad de ataque<input id="labVel" type="number" min="0.25" max="3" step="0.05" value="1"></label>
      <button id="labAplicar">Aplicar al personaje</button>
      <h2>Animación aislada</h2>
      <label>Movimiento<select id="labAnim"><option value="quieto">Reposo</option><option value="andar">Caminar</option><option value="tajoA">Tajo de Adreida</option><option value="revesA">Revés de Adreida</option><option value="estocadaA">Remate de Adreida</option><option value="salto">Salto de Adreida</option><option value="parry">Parry</option><option value="esquiva">Dash</option><option value="disparar">Disparo de Mohamed</option><option value="acrobacia">Acrobacia de Mohamed</option></select></label>
      <label>Fase <output id="labFaseTxt">0%</output><input id="labFase" type="range" min="0" max="1" step="0.01" value="0"></label>
      <div class="labFila"><button id="labReproducir">Repetir animación</button><button id="labVolver">Volver al combate</button></div>
      <p class="labNota">Vista de poses. Para comprobar desplazamiento, piedras e impactos, usa los ataques reales.</p>
      <h2>Transiciones de Adreida</h2>
      <p class="labNota">Ajusta la entrada y salida de las poses. El impacto, el daño y los 0,3 s de cansancio conservan sus tiempos de combate.</p>
      <div class="labDos">
        <label>Entrada al caminar (s)<input id="labEntradaCaminar" type="number" min="0" max="0.3" step="0.01"></label>
        <label>Entrada a la carga (s)<input id="labEntradaCarga" type="number" min="0" max="0.18" step="0.01"></label>
        <label>Vuelta al reposo (s)<input id="labRegreso" type="number" min="0" max="0.4" step="0.01"></label>
        <label>Amplitud de zancada<input id="labZancada" type="number" min="0.75" max="1.15" step="0.05"></label>
      </div>
      <div class="labFila"><button id="labAplicarAnimacion">Aplicar transiciones</button><button id="labSecuencia">Probar secuencia completa</button></div>
      <ol id="labSecuenciaPasos" class="labSecuencia" aria-label="Secuencia de Adreida"><li data-fase="andar">Caminar</li><li data-fase="carga">Cargar</li><li data-fase="golpe">Golpear</li><li data-fase="recuperacion">Recuperar</li><li data-fase="quieto">Reposo</li></ol>
      <p id="labSecuenciaEstado" class="labNota" role="status">La secuencia reinicia la escena con Adreida. También puedes congelar o avanzar cuadro a cuadro.</p>
      <div class="labFila"><button id="labGuardarAnimacion">Guardar variante</button><button id="labCargarAnimacion">Cargar guardada</button><button id="labResetAnimacion">Restablecer</button></div>
      <details><summary>Compartir o importar animación</summary>
        <p class="labNota">JSON de las transiciones. Guardar conserva una variante en este navegador; cargar o importar sólo afecta al inspector.</p>
        <textarea id="labAnimacionJSON" aria-label="Ajustes de animación JSON" spellcheck="false"></textarea>
        <div class="labFila"><button id="labExportarAnimacion">Descargar animación</button><button id="labImportarAnimacion">Importar JSON</button></div>
      </details>
      <h2>Ataques reales</h2>
      <div class="labFila"><button data-accion="basico">Básico</button><button data-accion="cargado">Cargado</button><button data-accion="salto">Salto</button><button data-accion="parry">Parry</button><button data-accion="bumeran">Búmeran</button></div>
      <button id="labMorir">Probar muerte del personaje</button>
      <label>Dirección del regreso del búmeran<input id="labRumboBumeran" type="range" min="-180" max="180" step="5" value="180"></label>
      <h2>Enemigos de prueba</h2>
      <label>IA de goblins<select id="labIA"><option value="yuka">Yuka · Tácticas por variante</option><option value="clasica">IA anterior · Comparar</option></select></label>
      <p id="labTacticas" class="labNota" role="status"></p>
      <label>Tipo<select id="labEnemigo"><option value="goblin">Goblin</option><option value="kobold">Arquero</option><option value="saqueador">Saqueador con escudo</option><option value="can">Can · Centro y lados</option><option value="troll">Troll</option></select></label>
      <label>Variante goblin<select id="labVarianteGoblin"><option value="">Aleatoria</option><option value="clasico">Clásico · Hacha</option><option value="dosHachas">Bruto · Dos hachas</option><option value="cuchillo">Pícaro · Cuchillo</option><option value="antorcha">Vigía · Antorcha</option></select></label>
      <div class="labDos"><label>Cantidad<input id="labCantidad" type="number" min="1" max="24" value="1"></label><label>Vida<input id="labVida" type="number" min="1" max="3000" value="34"></label><label>Velocidad<input id="labVelEnemigo" type="number" min="0" max="8" step="0.05" value="2.85"></label><label>Daño<input id="labDanoEnemigo" type="number" min="0" max="100" value="13"></label></div>
      <label class="labCheck"><input id="labQuieto" type="checkbox" checked> Quietos para probar impactos</label><button id="labInvocar">Añadir enemigos</button>
      <button id="labDerrotarCan">Derrotar a Can · Probar huida</button>
      <h2>Imagen</h2>
      <label>Distancia de cámara<input id="labCamara" type="range" min="0.45" max="1.4" step="0.05" value="1"></label>
      <div class="labFila"><label><input type="checkbox" data-lab-efecto="sombras" checked> Sombras</label><label><input type="checkbox" data-lab-efecto="oclusion"> Oclusión</label><label><input type="checkbox" data-lab-efecto="resplandor" checked> Halo</label></div>
      <label><input type="checkbox" id="labCristal" checked> Refracción del HUD</label><label><input type="checkbox" id="labNan"> Probar protección contra píxeles inválidos</label><button id="labExportar">Exportar ajustes JSON</button>
    </fieldset>
    <section><h2>Rendimiento</h2><p id="labMetricas">Esperando muestras…</p><p id="labPersonaje"></p><p class="labNota">Envío = trabajo de CPU para dibujar; no mide GPU. Resolución adaptativa desactivada en el inspector.</p>
    <label>Límite de render<select id="labHz"><option value="0">Sin límite</option><option value="30">30 FPS</option><option value="60">60 FPS</option><option value="120">120 FPS</option></select></label><p id="labReloj" class="labNota">Actualización por cuadro · dibujo directo</p>
    <label>Resolución interna<select id="labResolucion"><option value="1080p">1920 × 1080 · fija</option><option value="ventana">Adaptada a la ventana</option></select></label><p id="labPixeles" class="labNota"></p>
    <label>Escena de referencia<select id="labEscena"><option value="0">Adreida sola</option><option value="12" selected>Combate · 12 enemigos</option><option value="24">Cooperativo · 24 enemigos</option></select></label>
    <button id="labComparar" disabled>Comparar efectos · 2 rondas</button><button id="labMedir" disabled>Medir escena fija · 600 cuadros</button><button id="labCancelar" hidden>Cancelar medición</button><button id="labInforme" disabled>Descargar informe JSON</button><p id="labResultado" role="status"></p><div id="labTabla"></div><details><summary>Datos del informe</summary><textarea id="labDatos" readonly aria-label="Informe de rendimiento JSON"></textarea></details>
    <p class="labNota">Semilla 11, un paso de 1/60 s por imagen para repetir la carga, resolución y cámara fijas. Comparativa: 90 cuadros de calentamiento + 300 medidos por caso, dos rondas en orden inverso. Repite en el mismo equipo y tamaño de ventana.</p></section>`;
  document.body.append(panel);
  while(!window.CAOZ_ARPG_LAB?.listo())await new Promise(r=>setTimeout(r,100));
  const api=window.CAOZ_ARPG_LAB,r=api.revision,valores=api.valores();let detenido=false,clip=false,tiempoClip=0,secuencia=null,cadena=null,muestras=[],medicion=null,informe=null,ultimaUI=0,lote=null;
  const decir=t=>$('labEstado').textContent=t;
  const numero=id=>Number($(id).value);
  const descargar=(nombre,datos)=>{const u=URL.createObjectURL(new Blob([JSON.stringify(datos,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=nombre;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  function congelar(v){detenido=v;api.detener(v);$('labPausa').textContent=v?'Continuar':'Congelar';}
  function cancelarCadena(){cadena=null;for(const li of panel.querySelectorAll('[data-fase]'))li.removeAttribute('aria-current');}
  function limpiar(){clip=false;secuencia=null;cancelarCadena();congelar(false);api.limpiar($('labHeroe').value);$('labDano').value=valores.heroes[$('labHeroe').value].atq;$('labVel').value=1;muestras=[];decir('Escena lista. Los ajustes sólo afectan esta sesión.');}
  function volver(){clip=false;secuencia=null;cancelarCadena();r.pose(null);r.control(null);congelar(false);}
  function pose(){clip=false;secuencia=null;cancelarCadena();r.control({mov:[0,0],atacar:false});congelar(true);r.pose($('labAnim').value,numero('labFase'));$('labFaseTxt').textContent=Math.round(numero('labFase')*100)+'%';api.paso();}
  function ajustesEnemigo(){return {vida:numero('labVida'),vel:numero('labVelEnemigo'),dano:numero('labDanoEnemigo'),quieto:$('labQuieto').checked,varianteGoblin:$('labVarianteGoblin').value};}
  const ejecutar=fn=>()=>{try{fn();}catch(e){decir(e.message);}};
  $('labLimpiar').onclick=limpiar;$('labHeroe').onchange=limpiar;$('labPausa').onclick=()=>congelar(!detenido);$('labPaso').onclick=()=>{congelar(true);api.paso();};
  $('labAplicar').onclick=ejecutar(()=>{api.configurar({dano:numero('labDano'),velAtaque:numero('labVel')});decir('Daño y velocidad aplicados.');});
  $('labFase').oninput=pose;$('labAnim').onchange=pose;$('labVolver').onclick=volver;
  $('labReproducir').onclick=()=>{congelar(false);secuencia=null;cancelarCadena();clip=true;tiempoClip=0;r.control({mov:[0,0],atacar:false});};
  $('labEnemigo').onchange=()=>{const d=valores.enemigos[$('labEnemigo').value];$('labVida').value=d.vida;$('labVelEnemigo').value=d.vel;$('labDanoEnemigo').value=d.dano;};
  $('labIA').value=r.ia().modo;$('labIA').onchange=()=>{r.ia($('labIA').value);decir('IA aplicada. Se conservan los ataques que ya estaban avisados.');};
  $('labInvocar').onclick=ejecutar(()=>{api.invocar($('labEnemigo').value,numero('labCantidad'),ajustesEnemigo());decir('Enemigos añadidos alrededor del personaje.');});
  $('labDerrotarCan').onclick=()=>{volver();decir(api.derrotarCan()?'Can ha caído: los goblins huyen hasta salir de cuadro.':'Añade primero a Can y a sus goblins.');};
  $('labMorir').onclick=()=>{volver();const m=api.morirHeroe();decir(m?`${m.nombre} · ${m.duracion} segundos. La pantalla de derrota espera al final del clip.`:'Muerte de Mohamed.');};
  $('labNan').onchange=()=>r.nan($('labNan').checked,2,-1);
  $('labCristal').onchange=()=>r.cristal($('labCristal').checked);
  $('labCamara').oninput=()=>{r.camara({dist:numero('labCamara')});if(detenido)api.paso();};
  for(const c of panel.querySelectorAll('[data-lab-efecto]'))c.onchange=()=>r.efecto(c.dataset.labEfecto,c.checked);
  for(const b of panel.querySelectorAll('[data-accion]'))b.onclick=()=>{volver();api.prepararAccion();const h=r.equipo()[0];if(b.dataset.accion==='basico'||b.dataset.accion==='cargado'){r.control({atacar:true,apunta:[h.x,h.z-5]});secuencia={t:0,duracion:b.dataset.accion==='cargado'?1:.06,x:h.x,z:h.z-5};}else r.usar(b.dataset.accion,h.x,h.z-5);};
  $('labRumboBumeran').oninput=()=>{const h=r.equipo()[0],a=numero('labRumboBumeran')*Math.PI/180;r.control({mov:[0,0],atacar:false,apunta:[h.x+Math.sin(a)*6,h.z+Math.cos(a)*6]});if(detenido)api.paso();};
  $('labExportar').onclick=()=>descargar('ajustes-arpg.json',{version:1,animacion:api.animacion.leer(),heroe:$('labHeroe').value,dano:numero('labDano'),velAtaque:numero('labVel'),enemigo:{tipo:$('labEnemigo').value,cantidad:numero('labCantidad'),...ajustesEnemigo()},entorno:api.entorno()});
  const camposAnimacion={caminar:'labEntradaCaminar',carga:'labEntradaCarga',regreso:'labRegreso',zancada:'labZancada'},claveAnimacion='caoz.arpg.adreida.animacion.v1';
  function mostrarAnimacion(p){for(const [k,id] of Object.entries(camposAnimacion))$(id).value=p.ajustes[k];$('labAnimacionJSON').value=JSON.stringify(p,null,2);}
  function leerAnimacionJSON(texto){try{return JSON.parse(texto);}catch{throw Error('El JSON no es válido. Revisa su formato antes de importarlo.');}}
  function aplicarAnimacion(){for(const id of Object.values(camposAnimacion))if(!$(id).value.trim())throw Error('Completa todos los ajustes de animación.');const p=api.animacion.aplicar({version:1,personaje:'adreida',ajustes:Object.fromEntries(Object.entries(camposAnimacion).map(([k,id])=>[k,numero(id)]))});mostrarAnimacion(p);if(detenido)api.paso();return p;}
  $('labAplicarAnimacion').onclick=ejecutar(()=>{aplicarAnimacion();decir('Transiciones aplicadas a Adreida y Adreidos en esta sesión.');});
  $('labGuardarAnimacion').onclick=ejecutar(()=>{const p=aplicarAnimacion();try{localStorage.setItem(claveAnimacion,JSON.stringify(p));}catch{throw Error('El navegador no permite guardar. Descarga la animación como JSON.');}decir('Variante guardada en este navegador. Usa Cargar guardada para recuperarla.');});
  $('labCargarAnimacion').onclick=ejecutar(()=>{const texto=localStorage.getItem(claveAnimacion);if(!texto)throw Error('Aún no hay una variante guardada.');mostrarAnimacion(api.animacion.aplicar(leerAnimacionJSON(texto)));decir('Variante guardada aplicada.');});
  $('labResetAnimacion').onclick=()=>{mostrarAnimacion(api.animacion.restablecer());decir('Transiciones originales restauradas. La variante guardada sigue disponible.');};
  $('labExportarAnimacion').onclick=ejecutar(()=>{descargar('adreida-animacion.json',aplicarAnimacion());});
  $('labImportarAnimacion').onclick=ejecutar(()=>{const p=api.animacion.aplicar(leerAnimacionJSON($('labAnimacionJSON').value));mostrarAnimacion(p);decir('Animación importada y aplicada.');});
  mostrarAnimacion(api.animacion.leer());
  function indicarCadena(estado){for(const li of panel.querySelectorAll('[data-fase]')){if(li.dataset.fase===estado)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');}}
  $('labSecuencia').onclick=ejecutar(()=>{
    aplicarAnimacion();$('labHeroe').value='adreida';limpiar();api.prepararAccion();
    cadena={fase:'andar',t:0};r.control({mov:[0,-.65],atacar:false});indicarCadena('andar');
    $('labSecuenciaEstado').textContent='Caminar → cargar → golpear → recuperar → reposo';decir('Secuencia real en curso.');
  });
  function avanzarCadena(dt){
    if(!cadena)return;const h=r.equipo()[0];cadena.t+=dt;indicarCadena(h.estado);
    if(cadena.fase==='andar'&&cadena.t>=.75){cadena.fase='carga';cadena.t=0;cadena.x=h.x;cadena.z=h.z-5;r.control({mov:[0,0],atacar:true,apunta:[cadena.x,cadena.z]});}
    else if(cadena.fase==='carga'&&cadena.t>=1.05){cadena.fase='golpe';cadena.t=0;r.control({mov:[0,0],atacar:false,apunta:[cadena.x,cadena.z]});}
    else if(cadena.fase==='golpe'&&h.estado==='recuperacion')cadena.fase='recuperacion';
    else if(cadena.fase==='recuperacion'&&h.estado==='quieto'){cadena.fase='quieto';cadena.t=0;}
    else if(cadena.fase==='quieto'&&cadena.t>=.5){cadena=null;r.control({mov:[0,0],atacar:false});$('labSecuenciaEstado').textContent='Secuencia completa. Ajusta las transiciones y vuelve a probar.';decir('Secuencia terminada.');}
    else if(cadena.t>5){cancelarCadena();r.control({mov:[0,0],atacar:false});$('labSecuenciaEstado').textContent='Secuencia interrumpida. Reinicia para volver a probar.';}
  }
  $('labHz').onchange=()=>{api.frecuencia(numero('labHz'));muestras=[];decir('Límite de imagen aplicado. Movimiento y animación se actualizan con cada cuadro.');};
  const perfiles=[['Base',{sombras:true,oclusion:false,resplandor:true}],['Sin sombras',{sombras:false,oclusion:false,resplandor:true}],['Sin halo',{sombras:true,oclusion:false,resplandor:false}],['Con oclusión',{sombras:true,oclusion:true,resplandor:true}]];
  function aplicarResolucion(){const fija=$('labResolucion').value==='1080p';document.body.dataset.resolucion=fija?'1080p':'ventana';api.resolucion(fija);const u=new URL(location.href);u.searchParams.set('resolucion',$('labResolucion').value);history.replaceState(null,'',u);}
  $('labResolucion').value=new URLSearchParams(location.search).get('resolucion')==='ventana'?'ventana':'1080p';
  $('labResolucion').onchange=aplicarResolucion;aplicarResolucion();
  $('labEscena').value=api.entorno().coop?'24':'12';
  $('labEscena').onchange=()=>{const coop=numero('labEscena')===24;if(coop!==api.entorno().coop){const u=new URL(location.href);u.searchParams.set('coop',coop?'1':'0');u.searchParams.set('mandos','1');location.href=u.href;}};
  function guardarInforme(){
    $('labDatos').value=JSON.stringify(informe,null,2);
    const lista=informe?.resultados||[informe];
    $('labTabla').innerHTML='<table><thead><tr><th>Caso</th><th>FPS</th><th>p95 ms</th><th>GPU ms</th></tr></thead><tbody>'+lista.filter(Boolean).map(x=>`<tr><td>${x.perfil}</td><td>${x.resumen.fps.toFixed(1)}</td><td>${x.resumen.p95.toFixed(1)}</td><td>${x.resumen.gpu?.toFixed(2)??'N/D'}</td></tr>`).join('')+'</tbody></table>';
  }
  function finalizar(cancelada=false){
    if(!medicion)return;
    const resultado={version:3,escena:`plaza-${medicion.cantidad}-v3`,perfil:medicion.nombre,semilla:11,paso:1/60,fecha:new Date().toISOString(),entorno:medicion.entorno,resumen:resumir(medicion.muestras),muestras:medicion.muestras};
    medicion=null;api.pasoFijo(false);api.restaurarEntrada();
    if(lote&&!cancelada){lote.resultados.push(resultado);if(lote.cola.length){const siguiente=lote.cola.shift();iniciarMedicion(siguiente,300);return;}informe={version:3,resultados:lote.resultados};}
    else informe=cancelada?null:resultado;
    lote=null;$('labEdicion').disabled=false;$('labMedir').disabled=false;$('labComparar').disabled=false;$('labEscena').disabled=false;$('labResolucion').disabled=false;$('labHz').disabled=false;$('labCancelar').hidden=true;$('labInforme').disabled=!informe;congelar(true);
    decir(cancelada?'Medición interrumpida.':'Medición terminada. Informe listo.');$('labResultado').textContent=cancelada?'Medición cancelada.':`Completada: ${resultado.resumen.fps.toFixed(1)} FPS · p95 ${resultado.resumen.p95.toFixed(1)} ms.`;
    if(informe)guardarInforme();
  }
  function iniciarMedicion(perfil=perfiles[0],total=600){
    limpiar();api.limpiar('adreida');$('labHz').value='0';api.frecuencia(0);api.pasoFijo(true);limpiarConsultas();$('labHeroe').value='adreida';$('labDano').value=12;$('labCamara').value=1;r.camara({dist:1});
    for(const [k,v] of Object.entries(perfil[1])){r.efecto(k,v);panel.querySelector(`[data-lab-efecto="${k}"]`).checked=v;}
    const cantidad=numero('labEscena'),factor=cantidad===24?2:1;
    if(cantidad)for(const [tipo,n] of [['goblin',8],['kobold',2],['saqueador',2]])api.invocar(tipo,n*factor,{...valores.enemigos[tipo],vida:valores.enemigos[tipo].vida*factor,quieto:false});
    medicion={cantidad,nombre:perfil[0],total,calentamiento:90,muestras:[],entorno:api.entorno()};muestras=[];
    $('labEdicion').disabled=true;$('labMedir').disabled=true;$('labComparar').disabled=true;$('labEscena').disabled=true;$('labResolucion').disabled=true;$('labHz').disabled=true;$('labCancelar').hidden=false;$('labInforme').disabled=true;
    decir(`Midiendo ${perfil[0]}. Mantén la pestaña visible y el tamaño fijo.`);
  }
  $('labMedir').onclick=()=>iniciarMedicion();
  $('labComparar').onclick=()=>{lote={cola:[...perfiles,...perfiles.slice().reverse()],resultados:[]};iniciarMedicion(lote.cola.shift(),300);};
  $('labCancelar').onclick=()=>finalizar(true);$('labInforme').onclick=()=>informe&&descargar('rendimiento-arpg.json',informe);
  document.addEventListener('keydown',e=>{if(medicion){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape')finalizar(true);}},true);
  document.addEventListener('pointerdown',e=>{if(medicion&&e.target.closest('#escenario')){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finalizar(true);});
  // Consultas asíncronas: nunca esperamos a la GPU ni usamos gl.finish().
  let pendientes=[],consulta=null,turno=0,gpuMs=null;
  const gl=api.temporizador(()=>{
    gpuMs=null;if(!ext)return;
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){limpiarConsultas();return;}
    if(pendientes.length&&gl.getQueryParameter(pendientes[0],gl.QUERY_RESULT_AVAILABLE)){const q=pendientes.shift();gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}
    if(medicion&&++turno%10===0&&pendientes.length<8){consulta=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,consulta);}
  },()=>{if(consulta){gl.endQuery(ext.TIME_ELAPSED_EXT);pendientes.push(consulta);consulta=null;}}),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  function limpiarConsultas(){for(const q of pendientes)gl.deleteQuery(q);pendientes=[];gpuMs=null;turno=0;}
  api.antes(()=>{if(medicion)api.proteger();if(clip)r.pose($('labAnim').value,tiempoClip%1);});
  api.despuesPaso(dt=>{
    tiempoClip+=dt;avanzarCadena(dt);
    if(secuencia){secuencia.t+=dt;if(secuencia.t>=secuencia.duracion){r.control({atacar:false,apunta:[secuencia.x,secuencia.z]});secuencia=null;}}
  });
  api.observar(m=>{
    m.gpu=gpuMs;if(!detenido){muestras.push(m);if(muestras.length>120)muestras.shift();}
    if(medicion){const e=api.entorno();if(e.ia!==medicion.entorno.ia||e.ancho!==medicion.entorno.ancho||e.alto!==medicion.entorno.alto||e.anchoRender!==medicion.entorno.anchoRender||e.altoRender!==medicion.entorno.altoRender){finalizar(true);decir('Cambió la IA, el tamaño o la resolución interna. Repite la medición.');}else if(medicion.calentamiento-->0){}else{medicion.muestras.push(m);if(medicion.muestras.length===medicion.total)finalizar();}}
    if(performance.now()-ultimaUI<250)return;ultimaUI=performance.now();
    const ia=r.ia(),tacticas={cubrir:0,presionar:0,flanquear:0,lanzar:0};for(const g of ia.goblins)if(g.accion)tacticas[g.accion]++;
    $('labIA').value=ia.modo;$('labTacticas').textContent=ia.modo==='clasica'?'IA anterior activa.':`Yuka · ${tacticas.presionar} presionan · ${tacticas.flanquear} flanquean · ${tacticas.cubrir} cubren · ${tacticas.lanzar} buscan lanzar`;
    const s=resumir(muestras),h=r.equipo()[0],e=api.entorno();$('labPixeles').textContent=`GPU: ${e.anchoRender} × ${e.altoRender} px · Vista: ${e.ancho} × ${e.alto} px · Resolución adaptativa desactivada`; $('labReloj').textContent=medicion?'Referencia: un paso de 1/60 s por imagen, sin límite de render':`Actualización por cuadro · ${(m.avance*1000).toFixed(1)} ms · dibujo directo`; $('labPersonaje').textContent=`${h.tipo} · ${h.estado} · Alma ${Math.round(h.alma)}`;
    if(s)$('labMetricas').textContent=`${s.fps.toFixed(1)} FPS · p95 ${s.p95.toFixed(1)} ms\nSimulación ${s.simulacion.toFixed(2)} ms · envío ${s.envio.toFixed(2)} ms\n${Math.round(s.llamadas)} llamadas · ${Math.round(s.triangulos/1000)} mil triángulos`;
    if(medicion)$('labResultado').textContent=medicion.calentamiento>0?'Calentando…':`${medicion.nombre}: ${medicion.muestras.length} / ${medicion.total} cuadros`;
  });
  $('labEdicion').disabled=false;$('labMedir').disabled=false;$('labComparar').disabled=false;limpiar();
}

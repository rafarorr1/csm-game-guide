import {resumir} from './arpg-inspector-metricas.mjs';
const $=id=>document.getElementById(id);
if(!new URLSearchParams(location.search).has('inspector')){const u=new URL(location.href);u.searchParams.set('inspector','1');location.replace(u);}
else iniciar();
async function iniciar(){
  document.body.classList.add('apLaboratorio');
  const panel=document.createElement('aside');panel.className='labPanel';panel.innerHTML=`
    <header><small>LAS GRIETAS DEL EDITOR · HERRAMIENTAS</small><h1>Inspector</h1><p>Combate, animación y rendimiento · v2</p></header>
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
      <h2>Ataques reales</h2>
      <div class="labFila"><button data-accion="basico">Básico</button><button data-accion="cargado">Cargado</button><button data-accion="salto">Salto</button><button data-accion="parry">Parry</button></div>
      <h2>Enemigos de prueba</h2>
      <label>Tipo<select id="labEnemigo"><option value="goblin">Goblin</option><option value="kobold">Arquero</option><option value="saqueador">Saqueador con escudo</option><option value="troll">Troll</option></select></label>
      <div class="labDos"><label>Cantidad<input id="labCantidad" type="number" min="1" max="24" value="1"></label><label>Vida<input id="labVida" type="number" min="1" max="3000" value="34"></label><label>Velocidad<input id="labVelEnemigo" type="number" min="0" max="8" step="0.05" value="2.85"></label><label>Daño<input id="labDanoEnemigo" type="number" min="0" max="100" value="13"></label></div>
      <label class="labCheck"><input id="labQuieto" type="checkbox" checked> Quietos para probar impactos</label><button id="labInvocar">Añadir enemigos</button>
      <h2>Imagen</h2>
      <label>Distancia de cámara<input id="labCamara" type="range" min="0.45" max="1.4" step="0.05" value="1"></label>
      <div class="labFila"><label><input type="checkbox" data-lab-efecto="sombras" checked> Sombras</label><label><input type="checkbox" data-lab-efecto="oclusion"> Oclusión</label><label><input type="checkbox" data-lab-efecto="resplandor" checked> Halo</label></div>
      <button id="labExportar">Exportar ajustes JSON</button>
    </fieldset>
    <section><h2>Rendimiento</h2><p id="labMetricas">Esperando muestras…</p><p id="labPersonaje"></p><p class="labNota">Envío = trabajo de CPU para dibujar; no mide GPU. Resolución adaptativa desactivada en el inspector.</p>
    <label>Escena de referencia<select id="labEscena"><option value="0">Adreida sola</option><option value="12" selected>Combate · 12 enemigos</option><option value="24">Cooperativo · 24 enemigos</option></select></label>
    <button id="labComparar" disabled>Comparar efectos · 2 rondas</button><button id="labMedir" disabled>Medir escena fija · 600 cuadros</button><button id="labCancelar" hidden>Cancelar medición</button><button id="labInforme" disabled>Descargar informe JSON</button><p id="labResultado" role="status"></p><div id="labTabla"></div><details><summary>Datos del informe</summary><textarea id="labDatos" readonly aria-label="Informe de rendimiento JSON"></textarea></details>
    <p class="labNota">Semilla 11, paso fijo de 1/60 s, resolución y cámara fijas. Comparativa: 90 cuadros de calentamiento + 300 medidos por caso, dos rondas en orden inverso. Repite en el mismo equipo y tamaño de ventana.</p></section>`;
  document.body.append(panel);
  while(!window.CAOZ_ARPG_LAB?.listo())await new Promise(r=>setTimeout(r,100));
  const api=window.CAOZ_ARPG_LAB,r=api.revision,valores=api.valores();let detenido=false,clip=false,tiempoClip=0,secuencia=null,muestras=[],medicion=null,informe=null,ultimaUI=0,lote=null;
  const decir=t=>$('labEstado').textContent=t;
  const numero=id=>Number($(id).value);
  const descargar=(nombre,datos)=>{const u=URL.createObjectURL(new Blob([JSON.stringify(datos,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=nombre;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  function congelar(v){detenido=v;api.detener(v);$('labPausa').textContent=v?'Continuar':'Congelar';}
  function limpiar(){clip=false;secuencia=null;congelar(false);api.limpiar($('labHeroe').value);$('labDano').value=valores.heroes[$('labHeroe').value].atq;$('labVel').value=1;muestras=[];decir('Escena lista. Los ajustes sólo afectan esta sesión.');}
  function volver(){clip=false;secuencia=null;r.pose(null);r.control(null);congelar(false);}
  function pose(){clip=false;congelar(true);r.pose($('labAnim').value,numero('labFase'));$('labFaseTxt').textContent=Math.round(numero('labFase')*100)+'%';api.paso();}
  function ajustesEnemigo(){return {vida:numero('labVida'),vel:numero('labVelEnemigo'),dano:numero('labDanoEnemigo'),quieto:$('labQuieto').checked};}
  const ejecutar=fn=>()=>{try{fn();}catch(e){decir(e.message);}};
  $('labLimpiar').onclick=limpiar;$('labHeroe').onchange=limpiar;$('labPausa').onclick=()=>congelar(!detenido);$('labPaso').onclick=()=>{congelar(true);api.paso();};
  $('labAplicar').onclick=ejecutar(()=>{api.configurar({dano:numero('labDano'),velAtaque:numero('labVel')});decir('Daño y velocidad aplicados.');});
  $('labFase').oninput=pose;$('labAnim').onchange=pose;$('labVolver').onclick=volver;
  $('labReproducir').onclick=()=>{congelar(false);secuencia=null;clip=true;tiempoClip=0;r.control({mov:[0,0],atacar:false});};
  $('labEnemigo').onchange=()=>{const d=valores.enemigos[$('labEnemigo').value];$('labVida').value=d.vida;$('labVelEnemigo').value=d.vel;$('labDanoEnemigo').value=d.dano;};
  $('labInvocar').onclick=ejecutar(()=>{api.invocar($('labEnemigo').value,numero('labCantidad'),ajustesEnemigo());decir('Enemigos añadidos alrededor del personaje.');});
  $('labCamara').oninput=()=>{r.camara({dist:numero('labCamara')});if(detenido)api.paso();};
  for(const c of panel.querySelectorAll('[data-lab-efecto]'))c.onchange=()=>r.efecto(c.dataset.labEfecto,c.checked);
  for(const b of panel.querySelectorAll('[data-accion]'))b.onclick=()=>{volver();api.prepararAccion();const h=r.equipo()[0];if(b.dataset.accion==='basico'||b.dataset.accion==='cargado'){r.control({atacar:true,apunta:[h.x,h.z-5]});secuencia={t:0,duracion:b.dataset.accion==='cargado'?1:.06,x:h.x,z:h.z-5};}else r.usar(b.dataset.accion,h.x,h.z-5);};
  $('labExportar').onclick=()=>descargar('ajustes-arpg.json',{version:1,heroe:$('labHeroe').value,dano:numero('labDano'),velAtaque:numero('labVel'),enemigo:{tipo:$('labEnemigo').value,cantidad:numero('labCantidad'),...ajustesEnemigo()},entorno:api.entorno()});
  const perfiles=[['Base',{sombras:true,oclusion:false,resplandor:true}],['Sin sombras',{sombras:false,oclusion:false,resplandor:true}],['Sin halo',{sombras:true,oclusion:false,resplandor:false}],['Con oclusión',{sombras:true,oclusion:true,resplandor:true}]];
  $('labEscena').value=api.entorno().coop?'24':'12';
  $('labEscena').onchange=()=>{const coop=numero('labEscena')===24;if(coop!==api.entorno().coop){const u=new URL(location.href);u.searchParams.set('coop',coop?'1':'0');u.searchParams.set('mandos','1');location.href=u.href;}};
  function guardarInforme(){
    $('labDatos').value=JSON.stringify(informe,null,2);
    const lista=informe?.resultados||[informe];
    $('labTabla').innerHTML='<table><thead><tr><th>Caso</th><th>FPS</th><th>p95 ms</th><th>GPU ms</th></tr></thead><tbody>'+lista.filter(Boolean).map(x=>`<tr><td>${x.perfil}</td><td>${x.resumen.fps.toFixed(1)}</td><td>${x.resumen.p95.toFixed(1)}</td><td>${x.resumen.gpu?.toFixed(2)??'N/D'}</td></tr>`).join('')+'</tbody></table>';
  }
  function finalizar(cancelada=false){
    if(!medicion)return;
    const resultado={version:2,escena:`plaza-${medicion.cantidad}-v2`,perfil:medicion.nombre,semilla:11,paso:1/60,fecha:new Date().toISOString(),entorno:medicion.entorno,resumen:resumir(medicion.muestras),muestras:medicion.muestras};
    medicion=null;api.pasoFijo(false);api.restaurarEntrada();
    if(lote&&!cancelada){lote.resultados.push(resultado);if(lote.cola.length){const siguiente=lote.cola.shift();iniciarMedicion(siguiente,300);return;}informe={version:2,resultados:lote.resultados};}
    else informe=cancelada?null:resultado;
    lote=null;$('labEdicion').disabled=false;$('labMedir').disabled=false;$('labComparar').disabled=false;$('labEscena').disabled=false;$('labCancelar').hidden=true;$('labInforme').disabled=!informe;congelar(true);
    decir(cancelada?'Medición interrumpida.':'Medición terminada. Informe listo.');$('labResultado').textContent=cancelada?'Medición cancelada.':`Completada: ${resultado.resumen.fps.toFixed(1)} FPS · p95 ${resultado.resumen.p95.toFixed(1)} ms.`;
    if(informe)guardarInforme();
  }
  function iniciarMedicion(perfil=perfiles[0],total=600){
    limpiar();api.limpiar('adreida');api.pasoFijo(true);limpiarConsultas();$('labHeroe').value='adreida';$('labDano').value=12;$('labCamara').value=1;r.camara({dist:1});
    for(const [k,v] of Object.entries(perfil[1])){r.efecto(k,v);panel.querySelector(`[data-lab-efecto="${k}"]`).checked=v;}
    const cantidad=numero('labEscena'),factor=cantidad===24?2:1;
    if(cantidad)for(const [tipo,n] of [['goblin',8],['kobold',2],['saqueador',2]])api.invocar(tipo,n*factor,{...valores.enemigos[tipo],vida:valores.enemigos[tipo].vida*factor,quieto:false});
    medicion={cantidad,nombre:perfil[0],total,calentamiento:90,muestras:[],entorno:api.entorno()};muestras=[];
    $('labEdicion').disabled=true;$('labMedir').disabled=true;$('labComparar').disabled=true;$('labEscena').disabled=true;$('labCancelar').hidden=false;$('labInforme').disabled=true;
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
  api.observar(m=>{
    m.gpu=gpuMs;const dt=medicion?1/60:Math.min(.05,m.intervalo/1000);if(!detenido){tiempoClip+=dt;if(secuencia){secuencia.t+=dt;if(secuencia.t>=secuencia.duracion){r.control({atacar:false,apunta:[secuencia.x,secuencia.z]});secuencia=null;}}muestras.push(m);if(muestras.length>120)muestras.shift();}
    if(medicion){const e=api.entorno();if(e.ancho!==medicion.entorno.ancho||e.alto!==medicion.entorno.alto){finalizar(true);decir('Cambió el tamaño de la escena. Repite la medición.');}else if(medicion.calentamiento-->0){}else{medicion.muestras.push(m);if(medicion.muestras.length===medicion.total)finalizar();}}
    if(performance.now()-ultimaUI<250)return;ultimaUI=performance.now();const s=resumir(muestras),h=r.equipo()[0];$('labPersonaje').textContent=`${h.tipo} · ${h.estado} · Alma ${Math.round(h.alma)}`;
    if(s)$('labMetricas').textContent=`${s.fps.toFixed(1)} FPS · p95 ${s.p95.toFixed(1)} ms\nSimulación ${s.simulacion.toFixed(2)} ms · envío ${s.envio.toFixed(2)} ms\n${Math.round(s.llamadas)} llamadas · ${Math.round(s.triangulos/1000)} mil triángulos`;
    if(medicion)$('labResultado').textContent=medicion.calentamiento>0?'Calentando…':`${medicion.nombre}: ${medicion.muestras.length} / ${medicion.total} cuadros`;
  });
  $('labEdicion').disabled=false;$('labMedir').disabled=false;$('labComparar').disabled=false;limpiar();
}

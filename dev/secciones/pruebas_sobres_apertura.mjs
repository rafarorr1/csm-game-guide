/* Regresiones de ciclo de vida y gestos sobre el componente real. El DOM mínimo
   registra efectos observables; no sustituye la revisión visual del navegador. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ruta=new URL('../../caoz_tcg/sobres-apertura.js',import.meta.url);
const fuente=fs.readFileSync(ruta,'utf8');
const microtareas=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

function entorno(codigo,{cantidad=5,reducido=true,imagenes=null,rechazarVuelta=false}={}){
  const nodos=[],ilustraciones=[],medidas={cartas:0,vueltas:0,orientaciones:0,retirados:0,movidos:0,cambios:0,aperturas:0,decodes:0};
  let ahora=0,siguienteTarea=0;
  const tareas=new Map(),programar=(fn,ms=0,raf=false)=>{const id=++siguienteTarea;tareas.set(id,{fn,cuando:ahora+ms,raf});return id;};
  class Nodo{
    constructor(tag){
      this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.listeners=new Map();this.capturas=new Set();this.clientHeight=500;this.clientWidth=390;this.hidden=false;
      this.style={setProperty(k,v){this[k]=v;}};
      this.className='';
      const clases=()=>new Set(this.className.split(/\s+/).filter(Boolean)),modificar=(poner,c)=>{const s=clases();c.forEach(x=>poner?s.add(x):s.delete(x));this.className=[...s].join(' ');};
      this.classList={add:(...c)=>modificar(true,c),remove:(...c)=>modificar(false,c),contains:c=>clases().has(c),toggle:(c,poner)=>{poner=poner??!clases().has(c);modificar(poner,[c]);return poner;}};
      nodos.push(this);
    }
    append(...hijos){for(const n of hijos){if(n.parentElement){n.parentElement.children=n.parentElement.children.filter(h=>h!==n);medidas.movidos++;}n.parentElement=this;this.children.push(n);}}
    replaceChildren(...hijos){this.children.forEach(n=>n.parentElement=null);this.children=[];this.append(...hijos);}
    remove(){medidas.retirados++;if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
    setAttribute(k,v){this.attrs[k]=String(v);if(this.tagName==='IMG'&&k==='src'){this.complete=false;this.naturalWidth=0;this.asignacionesSrc=(this.asignacionesSrc||0)+1;}}
    getAttribute(k){return this.attrs[k]??null;}
    removeAttribute(k){delete this.attrs[k];}
    querySelectorAll(selector){assert.equal(selector,'img','El DOM mínimo sólo debe consultar imágenes');return this.children.flatMap(n=>[...(n.tagName==='IMG'?[n]:[]),...n.querySelectorAll(selector)]);}
    addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}
    removeEventListener(t,f){this.listeners.get(t)?.delete(f);}
    emitir(t,e={}){for(const f of [...(this.listeners.get(t)||[])])f(e);}
    setPointerCapture(id){this.capturas.add(id);}
    hasPointerCapture(id){return this.capturas.has(id);}
    releasePointerCapture(id){this.capturas.delete(id);}
    getBoundingClientRect(){return {x:0,y:0,width:200,height:280};}
    focus(){documento.activeElement=this;}
    get isConnected(){return this===documento||!!this.parentElement?.isConnected;}
  }
  const documento=new Nodo('document');documento.createElement=tag=>new Nodo(tag);documento.hidden=false;
  documento.body=new Nodo('body');documento.append(documento.body);documento.activeElement=documento.body;
  const ventana={CAOZ_SOBRES_ESCENA:{crear:()=>({abrir:()=>{medidas.aperturas++;return Promise.resolve();},destruir(){},redimensionar(){},
    rectangulo:()=>({x:0,y:0,width:200,height:300}),orientar(){medidas.orientaciones++;}})}};
  // El reloj controlado comprueba que la quinta no avanza por tiempo transcurrido;
  // reducido reproduce también promesas resueltas antes de destruir la vista.
  new vm.Script(codigo,{filename:'sobres-apertura.js'}).runInNewContext({window:ventana,document:documento,
    ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:reducido}),performance:{now:()=>ahora},
    requestAnimationFrame:fn=>programar(fn,16,true),cancelAnimationFrame:id=>tareas.delete(id),setTimeout:programar,clearTimeout:id=>tareas.delete(id)});
  const host=new Nodo('main');documento.body.append(host);
  const componente=ventana.CAOZ_SOBRES.crear(host,{reducirMovimiento:reducido,
    cartas:Array.from({length:cantidad},(_,i)=>({id:'carta_'+i,nombre:'Carta '+i})),
    crearCarta:c=>{
      medidas.cartas++;const carta=new Nodo('article');
      if(imagenes){
        const img=new Nodo('img');img.setAttribute('src','art/'+c.id+'.webp');img.complete=imagenes==='decode';img.naturalWidth=img.complete?400:0;
        const pendientes=[];
        img.decode=()=>{medidas.decodes++;return new Promise((resolve,reject)=>pendientes.push({resolve,reject}));};
        const resolver=(fallo=false)=>{for(const p of pendientes.splice(0))fallo?p.reject(new Error('No se pudo decodificar')):p.resolve();};
        ilustraciones.push({img,cargar(){img.complete=true;img.naturalWidth=400;img.emitir('load');},fallar(){img.complete=true;img.naturalWidth=0;img.emitir('error');},decodificar:()=>resolver(),rechazarDecode:()=>resolver(true)});
        carta.append(img);
      }
      return carta;
    },
    onCambio:()=>medidas.cambios++,onVolver:()=>{medidas.vueltas++;return rechazarVuelta&&medidas.vueltas===1?false:undefined;}});
  const gesto=nodos.find(n=>n.className==='sobresGesto');
  const puntero=(id,x=0)=>({pointerType:'touch',pointerId:id,clientX:x,clientY:0});
  const tocar=(id=1)=>{gesto.emitir('pointerdown',puntero(id));gesto.emitir('pointerup',puntero(id));gesto.emitir('click',{detail:1});};
  const presentes=clase=>nodos.filter(n=>n.isConnected&&n.classList.contains(clase));
  async function avanzar(ms){
    await microtareas();
    const limite=ahora+ms;let pasos=0;
    for(;;){
      const pendiente=[...tareas.entries()].filter(([,t])=>t.cuando<=limite).sort((a,b)=>a[1].cuando-b[1].cuando)[0];
      if(!pendiente)break;
      assert.ok(++pasos<10000,'La animación no debe generar un bucle de tareas');
      const [id,t]=pendiente;tareas.delete(id);ahora=t.cuando;t.fn(t.raf?ahora:undefined);await microtareas();
    }
    ahora=limite;await microtareas();
  }
  async function hasta(fase){
    await microtareas();
    for(let i=0;componente.estado().fase!==fase&&i<1000;i++){
      const proxima=Math.min(...[...tareas.values()].map(t=>t.cuando));
      assert.ok(Number.isFinite(proxima),'No quedan tareas para llegar a '+fase+' desde '+componente.estado().fase);
      await avanzar(proxima-ahora);
    }
    assert.equal(componente.estado().fase,fase);
  }
  return {componente,gesto,puntero,tocar,medidas,presentes,avanzar,hasta,tareas,ilustraciones,
    visibilidad(oculta){documento.hidden=oculta;documento.emitir('visibilitychange');},
    async abrir(){tocar();await hasta('pila');}};
}

async function destruidoNoVuelve(codigo){
  const e=entorno(codigo,{cantidad:1});
  try{
    await e.abrir();e.tocar();await e.hasta('ultima');e.tocar();await e.hasta('terminado');
    e.componente.destruir();const antes={...e.medidas};e.componente.activar();await e.avanzar(2000);
    assert.deepEqual(e.medidas,antes,'Una referencia destruida no puede cambiar de fase ni pedir volver');
  }finally{e.componente.destruir();}
}

async function destruirEntreContinuaciones(codigo){
  // Se destruye justo antes de continuar cada tramo: dorso, frente y retirada
  // de la carta anterior. Después no puede renderizar, retirar ni emitir cambios.
  for(const tramo of ['dorso','frente','traslado']){
    const e=entorno(codigo);
    try{
      await e.abrir();
      if(tramo==='traslado'){e.tocar();await microtareas();assert.equal(e.componente.estado().reveladas,1);}
      e.tocar();
      if(tramo==='frente')await Promise.resolve();
      e.componente.destruir();const antes={...e.medidas};await microtareas();
      assert.deepEqual(e.medidas,antes,'No quedan efectos posteriores a destruir durante '+tramo);
    }finally{e.componente.destruir();}
  }
}

async function segundoDedoNoCancela(codigo){
  for(const evento of ['lostpointercapture','pointercancel']){
    const e=entorno(codigo);
    try{
      e.gesto.emitir('pointerdown',e.puntero(1));e.gesto.emitir('pointerdown',e.puntero(2));
      if(evento==='lostpointercapture')e.gesto.emitir('pointerup',e.puntero(2));
      e.gesto.emitir(evento,e.puntero(2));e.gesto.emitir('pointermove',e.puntero(1,50));
      assert.equal(e.medidas.orientaciones,1,evento+' del segundo dedo debe conservar el arrastre principal');
      e.gesto.emitir('pointerup',e.puntero(1,50));await microtareas();
      assert.equal(e.componente.estado().fase,'sellado','Terminar un arrastre no abre el sobre');
    }finally{e.componente.destruir();}
  }
}

async function rafagaSinCola(codigo){
  const e=entorno(codigo);
  try{
    for(let i=0;i<12;i++)e.tocar();await microtareas();
    assert.equal(e.componente.estado().fase,'pila');assert.equal(e.componente.estado().reveladas,0);
    for(let i=0;i<12;i++)e.tocar();await microtareas();
    assert.equal(e.componente.estado().fase,'pila');assert.equal(e.componente.estado().reveladas,1,'La ráfaga durante el volteo descubre una sola carta');
    await microtareas();assert.equal(e.componente.estado().reveladas,1,'Los toques bloqueados no quedan en cola');
    e.tocar();await microtareas();assert.equal(e.componente.estado().reveladas,2,'Otro toque posterior revela exactamente la siguiente');
  }finally{e.componente.destruir();}
}

async function primerasCuatro(e){
  await e.abrir();
  for(let i=0;i<4;i++){e.tocar();await e.hasta('pila');assert.equal(e.componente.estado().reveladas,i+1);}
}

async function ultima(e){await primerasCuatro(e);e.tocar();await e.hasta('ultima');}

async function resumenSoloOtroToque(codigo){
  for(const {reducido,ocultaQuinta,entrada} of [{reducido:false,entrada:'toque'},{reducido:true,entrada:'boton'},{reducido:false,ocultaQuinta:true,entrada:'teclado'}]){
    const e=entorno(codigo,{reducido});
    try{
      const originales=e.presentes('sobresFrente'),reserva=e.presentes('sobresReserva')[0];
      assert.equal(e.medidas.cartas,5,'Los cinco frentes se preparan al crear la apertura');assert.equal(originales.length,5);
      assert.ok(reserva.hidden);assert.equal(reserva.getAttribute('aria-hidden'),'true');
      assert.ok(originales.every(n=>n.parentElement===reserva),'Los frentes preparados quedan en la reserva oculta');
      await e.abrir();assert.equal(e.presentes('sobresBandeja').length,0,'Ya no existe una bandeja acumulada');
      const resumen=e.presentes('sobresResumen')[0];assert.ok(resumen,'La vista dispone del resumen final');
      for(let i=1;i<=4;i++){
        e.tocar();await e.hasta('pila');
        assert.equal(e.componente.estado().reveladas,i);assert.equal(e.medidas.cartas,5,'Cada descubrimiento reutiliza un frente ya preparado');
        assert.equal(resumen.hidden,true,'El resumen no se muestra antes de la quinta');
        assert.equal(e.presentes('sobresPremio').length,0,'No se acumulan cartas del resumen mientras se descubren');
      }
      e.tocar();if(ocultaQuinta)e.visibilidad(true);await e.hasta('ultima');assert.equal(e.componente.estado().reveladas,5);
      assert.equal(e.medidas.cartas,5);assert.equal(resumen.hidden,true);assert.equal(e.tareas.size,0,'La quinta no programa un avance automático');
      const antes={...e.medidas};
      await e.avanzar(60000);e.visibilidad(true);await e.avanzar(60000);e.visibilidad(false);await e.avanzar(60000);
      assert.equal(e.componente.estado().fase,'ultima','Esperar u ocultar la página no debe saltar la quinta carta, tampoco con movimiento reducido');
      assert.equal(resumen.hidden,true);assert.equal(e.presentes('sobresPremio').length,0);assert.deepEqual(e.medidas,antes);
      const activar=entrada==='toque'?()=>e.tocar():entrada==='boton'?()=>e.presentes('sobresAccion')[0].emitir('click',{detail:1}):()=>e.gesto.emitir('click',{detail:0});
      for(let i=0;i<12;i++)activar();
      await e.hasta('terminado');const premios=e.presentes('sobresPremio');
      assert.equal(resumen.hidden,false);assert.equal(premios.length,5,'El siguiente toque presenta las cinco cartas juntas una sola vez');
      assert.deepEqual(premios.map(p=>p.children[0].dataset.carta),Array.from({length:5},(_,i)=>'carta_'+i),'El resumen conserva las cinco cartas y su orden');
      premios.forEach((p,i)=>assert.equal(p.children[0],originales[i],'El resumen conserva el mismo nodo decodificado de la carta '+i));
      assert.equal(e.medidas.cartas,5,'El resumen no crea más frentes ni ilustraciones');
      await e.avanzar(2000);assert.equal(e.medidas.cartas,5,'Los toques bloqueados no duplican el resumen');
      assert.equal(e.presentes('sobresPila')[0].hidden,true,'El bonche individual deja paso al resumen');
      assert.equal(e.presentes('sobresAccion')[0].textContent,'Volver');assert.equal(e.medidas.vueltas,0,'Entrar al resumen no lo cierra');
    }finally{e.componente.destruir();}
  }
}

async function reintentarCierre(codigo){
  const e=entorno(codigo,{cantidad:1,rechazarVuelta:true});
  try{
    await e.abrir();e.tocar();await e.hasta('ultima');e.tocar();await e.hasta('terminado');
    const frentes=e.presentes('sobresFrente');
    e.componente.activar();await microtareas();
    assert.equal(e.medidas.vueltas,1);assert.equal(e.componente.estado().fase,'terminado','Rechazar el guardado debe dejar reintentar el cierre');
    assert.equal(e.presentes('sobresApertura')[0].style.opacity,'','El resumen vuelve a ser visible');
    assert.deepEqual(e.presentes('sobresFrente'),frentes,'Reintentar no vuelve a crear los premios');
    e.componente.activar();await microtareas();
    assert.equal(e.medidas.vueltas,2);assert.equal(e.componente.estado().fase,'cerrando');
    e.componente.activar();await microtareas();assert.equal(e.medidas.vueltas,2);
  }finally{e.componente.destruir();}
}

async function volverUnaVez(codigo){
  const e=entorno(codigo,{reducido:false});
  try{
    await ultima(e);e.tocar();await e.hasta('terminado');
    const accion=e.presentes('sobresAccion')[0];
    for(let i=0;i<12;i++)accion.emitir('click',{detail:1});
    assert.equal(e.componente.estado().fase,'cerrando');assert.equal(e.medidas.vueltas,0,'Volver espera al cierre');
    await e.avanzar(2000);assert.equal(e.medidas.vueltas,1,'El cierre llama onVolver una sola vez');
    for(let i=0;i<12;i++){accion.emitir('click',{detail:1});e.componente.activar();}
    await e.avanzar(2000);assert.equal(e.medidas.vueltas,1,'Las pulsaciones posteriores no vuelven a cerrar');
  }finally{e.componente.destruir();}
}

async function cancelarDuranteResumen(codigo){
  for(const tramo of ['ultima','presentacion','presentacion-resuelta','cierre-resuelto']){
    const e=entorno(codigo,{reducido:tramo!=='presentacion'});
    try{
      await ultima(e);
      if(tramo!=='ultima'){
        e.tocar();
        if(tramo==='cierre-resuelto'){await e.hasta('terminado');e.componente.activar();}
        else assert.equal(e.componente.estado().fase,'reuniendo','La prueba debe detenerse dentro de '+tramo);
      }
      e.componente.destruir();const antes={...e.medidas};await e.avanzar(5000);
      e.componente.activar();await e.avanzar(2000);
      assert.deepEqual(e.medidas,antes,'Destruir durante '+tramo+' impide efectos tardíos del resumen');
      assert.equal(e.medidas.vueltas,0);assert.equal(e.tareas.size,0,'El resumen destruido no deja tareas pendientes');
    }finally{e.componente.destruir();}
  }
}

async function esperarCargaYDecode(codigo){
  for(const modo of ['carga','decode']){
    const e=entorno(codigo,{imagenes:modo});
    try{
      assert.equal(e.medidas.cartas,5);assert.equal(e.ilustraciones.length,5);
      assert.ok(e.presentes('sobresReserva')[0].hidden,'Las imágenes se preparan sin mostrar los premios');
      assert.ok(e.ilustraciones.every(({img})=>img.loading==='eager'));
      e.tocar();await microtareas();assert.equal(e.componente.estado().fase,'preparando');
      assert.equal(e.medidas.aperturas,0,'El envoltorio no se abre mientras falte arte');
      for(const imagen of e.ilustraciones.slice(0,4)){if(modo==='carga')imagen.cargar();imagen.decodificar();}
      await e.avanzar(1000);
      assert.equal(e.componente.estado().fase,'preparando','Cuatro imágenes preparadas no bastan');
      if(modo==='carga')e.ilustraciones[4].cargar();
      await e.avanzar(1000);
      assert.equal(e.medidas.decodes,5,'También se pide decode a las imágenes que ya están completas');
      for(let i=0;i<12;i++){e.tocar();e.componente.activar();}
      await microtareas();
      assert.equal(e.componente.estado().fase,'preparando','Los bytes descargados siguen esperando el decode pendiente');
      assert.equal(e.componente.estado().reveladas,0);assert.equal(e.medidas.aperturas,0);
      assert.ok(e.presentes('sobresFrente').every(n=>n.parentElement===e.presentes('sobresReserva')[0]));
      e.ilustraciones[4].decodificar();await e.hasta('pila');
      assert.equal(e.medidas.aperturas,1,'Las cinco imágenes decodificadas permiten una única apertura');
      assert.equal(e.componente.estado().reveladas,0,'Los toques durante la carga no quedan en cola');assert.equal(e.tareas.size,0);
      e.tocar();await e.hasta('pila');assert.equal(e.componente.estado().reveladas,1);
      assert.equal(e.medidas.cartas,5);assert.equal(e.medidas.decodes,5,'Voltear no crea ni vuelve a decodificar imágenes');
    }finally{e.componente.destruir();}
  }
}

async function errorArteYReintento(codigo){
  for(const fallo of ['carga','decode','timeout']){
    const e=entorno(codigo,{imagenes:'carga'});
    try{
      const originales=e.presentes('sobresFrente');e.tocar();
      // Se conserva una descarga pendiente para comprobar que un reintento
      // cancela sus listeners viejos antes de preparar de nuevo las imágenes.
      for(const imagen of e.ilustraciones.slice(0,3)){imagen.cargar();imagen.decodificar();}
      const ultimaImagen=e.ilustraciones[4];
      if(fallo==='carga')ultimaImagen.fallar();
      else if(fallo==='decode'){ultimaImagen.cargar();ultimaImagen.rechazarDecode();}
      else await e.avanzar(20001);
      await microtareas();assert.equal(e.componente.estado().fase,'errorarte','El fallo de '+fallo+' debe permitir reintentar');
      assert.equal(e.presentes('sobresAccion')[0].textContent,'Reintentar');assert.equal(e.medidas.aperturas,0);assert.equal(e.componente.estado().reveladas,0);
      e.presentes('sobresAccion')[0].emitir('click',{detail:1});await microtareas();
      assert.equal(e.componente.estado().fase,'preparando');
      for(const {img} of e.ilustraciones){assert.equal(img.listeners.get('load')?.size,1);assert.equal(img.listeners.get('error')?.size,1);}
      assert.equal(ultimaImagen.img.asignacionesSrc,fallo==='carga'?2:1,'Sólo una descarga fallida y completa necesita reasignar su src');
      for(const imagen of e.ilustraciones){imagen.cargar();imagen.decodificar();}
      await e.hasta('pila');assert.equal(e.medidas.aperturas,1);assert.equal(e.medidas.cartas,5);assert.equal(e.tareas.size,0);
      originales.forEach((n,i)=>assert.equal(e.presentes('sobresFrente')[i],n,'Reintentar conserva el frente original'));
      e.tocar();await e.hasta('pila');assert.equal(e.componente.estado().reveladas,1);
    }finally{e.componente.destruir();}
  }
}

async function destruirPreparacion(codigo){
  const rechazos=[],registrar=e=>rechazos.push(e);process.on('unhandledRejection',registrar);
  try{
    for(const tramo of ['carga','decode','resuelta']){
      const e=entorno(codigo,{imagenes:tramo==='carga'?'carga':'decode'});
      try{
        e.tocar();await microtareas();assert.equal(e.componente.estado().fase,'preparando');
        if(tramo==='resuelta')e.ilustraciones.forEach(i=>i.decodificar());
        e.componente.destruir();const antes={...e.medidas};
        assert.equal(e.tareas.size,0,'Destruir cancela los límites de carga y decode pendientes');
        for(const {img} of e.ilustraciones){assert.equal(img.listeners.get('load')?.size,0);assert.equal(img.listeners.get('error')?.size,0);}
        for(const imagen of e.ilustraciones){imagen.cargar();imagen.decodificar();}
        await e.avanzar(30000);e.componente.activar();await microtareas();
        assert.deepEqual(e.medidas,antes,'Una carga o decode tardío no toca la apertura destruida durante '+tramo);
        assert.equal(e.medidas.aperturas,0);assert.equal(e.medidas.vueltas,0);
      }finally{e.componente.destruir();}
    }
    await new Promise(resolve=>setImmediate(resolve));assert.equal(rechazos.length,0,'Cancelar imágenes no deja promesas rechazadas sin atender');
  }finally{process.removeListener('unhandledRejection',registrar);}
}

for(const prueba of [destruidoNoVuelve,destruirEntreContinuaciones,segundoDedoNoCancela,rafagaSinCola,resumenSoloOtroToque,volverUnaVez,cancelarDuranteResumen,esperarCargaYDecode,errorArteYReintento,destruirPreparacion])await prueba(fuente);
console.log('✓ Precarga de cinco frentes; espera a load y decode, reintenta fallos y cancela sin callbacks tardíos.');
console.log('✓ La quinta espera otro toque; tiempo, visibilidad y movimiento reducido no adelantan el resumen.');
console.log('✓ El resumen contiene cinco cartas una sola vez y Volver se ejecuta una sola vez.');
console.log('✓ Destrucción sin callbacks tardíos, segundo dedo independiente y toques sin cola.');

await reintentarCierre(fuente);
console.log('✓ Un guardado rechazado restaura el resumen y permite reintentar sin recrear las cartas.');

if(process.argv.includes('--sabotaje')){
  function reemplazar(texto,buscar,cambio,cantidad=1){assert.equal(texto.split(buscar).length-1,cantidad,'El sabotaje debe encontrar la corrección exacta');return texto.replaceAll(buscar,cambio);}
  function enFuncion(texto,inicio,fin,mutacion){const a=texto.indexOf(inicio),b=texto.indexOf(fin,a);assert.ok(a>=0&&b>a,'El sabotaje debe delimitar la función correcta');return texto.slice(0,a)+mutacion(texto.slice(a,b))+texto.slice(b);}
  const casos=[
    ['ocultar el resumen al fallar el guardado',reintentarCierre,reemplazar(fuente,"if(opciones.onVolver?.()===false&&!muerto){raiz.style.opacity='';cambiar('terminado');}",'opciones.onVolver?.();')],
    ['activar después de destruir',destruidoNoVuelve,reemplazar(reemplazar(fuente,'function activar(){if(muerto)return;','function activar(){'),"if(fase!=='terminado'||muerto)return;","if(fase!=='terminado')return;")],
    ['continuar un volteo destruido',destruirEntreContinuaciones,enFuncion(fuente,'async function voltear(){','function activar(){',s=>reemplazar(s,'})||muerto)return;','}))return;',3))],
    ['cancelación de otro dedo',segundoDedoNoCancela,reemplazar(fuente,"if(e&&typeof e.pointerId==='number'&&puntero&&e.pointerId!==puntero.id)return;",'')],
    ['resumen antes de la quinta',resumenSoloOtroToque,reemplazar(fuente,"cambiar(reveladas===cartas.length?'ultima':'pila');","cambiar(reveladas===cartas.length-1?'ultima':'pila');")],
    ['avance automático tras la quinta',resumenSoloOtroToque,reemplazar(fuente,"cambiar(reveladas===cartas.length?'ultima':'pila');","cambiar(reveladas===cartas.length?'ultima':'pila');if(fase==='ultima')setTimeout(()=>reunir(),900);")],
    ['doble callback al volver',volverUnaVez,reemplazar(fuente,'if(opciones.onVolver?.()===false','opciones.onVolver?.();if(opciones.onVolver?.()===false')],
    ['continuar un resumen destruido',cancelarDuranteResumen,enFuncion(fuente,'async function reunir(){','async function volver(){',s=>reemplazar(s,'})||muerto)return;','}))return;'))],
    ['abrir sin esperar el arte',esperarCargaYDecode,reemplazar(fuente,'const lista=await prepararArte(reintentar);','const lista=true;')],
    ['omitir decode de imágenes completas',esperarCargaYDecode,reemplazar(fuente,"if(typeof img.decode==='function')await img.decode();",'')],
    ['ignorar un fallo de ilustración',errorArteYReintento,reemplazar(fuente,"if(!lista){cambiar('errorarte');return;}",'')],
    ['dejar cargas pendientes al destruir',destruirPreparacion,reemplazar(fuente,'muerto=true;for(const cancelar of [...cargas])cancelar();','muerto=true;')],
    ['crear otra carta al voltear',resumenSoloOtroToque,reemplazar(fuente,'function frente(i){return frentes[i];}','function frente(i){opciones.crearCarta(cartas[i]);return frentes[i];}')],
  ];
  for(const [nombre,prueba,codigo] of casos){new vm.Script(codigo);await assert.rejects(()=>prueba(codigo),{code:'ERR_ASSERTION'},'La regresión debe detectar: '+nombre);console.log('✓ Sabotaje detectado en memoria: '+nombre+'.');}
  assert.equal(fs.readFileSync(ruta,'utf8'),fuente,'El sabotaje nunca modifica el componente');
}

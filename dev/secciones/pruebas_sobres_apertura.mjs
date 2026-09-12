/* Regresiones de ciclo de vida y gestos sobre el componente real. El DOM mínimo
   registra efectos observables; no sustituye la revisión visual del navegador. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ruta=new URL('../../caoz_tcg/sobres-apertura.js',import.meta.url);
const fuente=fs.readFileSync(ruta,'utf8');
const microtareas=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

function entorno(codigo,cantidad=5){
  const nodos=[],medidas={cartas:0,repetidas:0,orientaciones:0,retirados:0,cambios:0};
  class Nodo{
    constructor(tag){
      this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.listeners=new Map();this.capturas=new Set();this.clientHeight=500;
      this.style={setProperty(k,v){this[k]=v;}};
      const clases=new Set();this.classList={add:(...c)=>c.forEach(x=>clases.add(x)),remove:(...c)=>c.forEach(x=>clases.delete(x))};
      nodos.push(this);
    }
    append(...hijos){for(const n of hijos){n.parentElement=this;this.children.push(n);}}
    replaceChildren(...hijos){this.children.forEach(n=>n.parentElement=null);this.children=[];this.append(...hijos);}
    remove(){medidas.retirados++;if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
    setAttribute(k,v){this.attrs[k]=String(v);}
    addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}
    removeEventListener(t,f){this.listeners.get(t)?.delete(f);}
    emitir(t,e={}){for(const f of [...(this.listeners.get(t)||[])])f(e);}
    setPointerCapture(id){this.capturas.add(id);}
    hasPointerCapture(id){return this.capturas.has(id);}
    releasePointerCapture(id){this.capturas.delete(id);}
    getBoundingClientRect(){return {x:0,y:0,width:200,height:280};}
  }
  const documento=new Nodo('document');documento.createElement=tag=>new Nodo(tag);documento.hidden=false;
  const ventana={CAOZ_SOBRES_ESCENA:{crear:()=>({abrir:()=>Promise.resolve(),destruir(){},redimensionar(){},
    rectangulo:()=>({x:0,y:0,width:200,height:300}),orientar(){medidas.orientaciones++;}})}};
  // El movimiento reducido permite reproducir la ventana entre una promesa ya
  // resuelta y su continuación sin depender de esperas ni del reloj del equipo.
  new vm.Script(codigo,{filename:'sobres-apertura.js'}).runInNewContext({window:ventana,document:documento,
    ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:true}),performance,
    requestAnimationFrame(){throw Error('Esta prueba usa movimiento reducido');},cancelAnimationFrame(){},setTimeout,clearTimeout});
  const componente=ventana.CAOZ_SOBRES.crear(new Nodo('main'),{reducirMovimiento:true,
    cartas:Array.from({length:cantidad},(_,i)=>({id:'carta_'+i,nombre:'Carta '+i})),
    crearCarta:()=>{medidas.cartas++;return new Nodo('article');},
    onCambio:()=>medidas.cambios++,onRepetir:()=>medidas.repetidas++});
  const gesto=nodos.find(n=>n.className==='sobresGesto');
  const puntero=(id,x=0)=>({pointerType:'touch',pointerId:id,clientX:x,clientY:0});
  const tocar=(id=1)=>{gesto.emitir('pointerdown',puntero(id));gesto.emitir('pointerup',puntero(id));gesto.emitir('click',{detail:1});};
  return {componente,gesto,puntero,tocar,medidas,async abrir(){tocar();await microtareas();assert.equal(componente.estado().fase,'pila');}};
}

async function destruidoNoRepite(codigo){
  const e=entorno(codigo,1);
  try{
    await e.abrir();e.tocar();await microtareas();assert.equal(e.componente.estado().fase,'terminado');
    e.componente.destruir();e.componente.activar();await microtareas();
    assert.equal(e.medidas.repetidas,0,'Una referencia destruida no puede solicitar otra apertura');
  }finally{e.componente.destruir();}
}

async function destruirEntreContinuaciones(codigo){
  // Se destruye justo antes de continuar cada tramo: dorso, frente y traslado
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

for(const prueba of [destruidoNoRepite,destruirEntreContinuaciones,segundoDedoNoCancela,rafagaSinCola])await prueba(fuente);
console.log('✓ Destruir cancela los callbacks, segundo dedo independiente y una carta por toque sin cola.');

if(process.argv.includes('--sabotaje')){
  function reemplazar(texto,buscar,cambio,cantidad=1){assert.equal(texto.split(buscar).length-1,cantidad,'El sabotaje debe encontrar la corrección exacta');return texto.replaceAll(buscar,cambio);}
  const casos=[
    ['activar después de destruir',destruidoNoRepite,reemplazar(fuente,'function activar(){if(muerto)return;','function activar(){')],
    ['continuar un volteo destruido',destruirEntreContinuaciones,reemplazar(fuente,'})||muerto)return;','}))return;',3)],
    ['cancelación de otro dedo',segundoDedoNoCancela,reemplazar(fuente,"if(e&&typeof e.pointerId==='number'&&puntero&&e.pointerId!==puntero.id)return;",'')],
  ];
  for(const [nombre,prueba,codigo] of casos){new vm.Script(codigo);await assert.rejects(()=>prueba(codigo),{code:'ERR_ASSERTION'},'La regresión debe detectar: '+nombre);console.log('✓ Sabotaje detectado en memoria: '+nombre+'.');}
  assert.equal(fs.readFileSync(ruta,'utf8'),fuente,'El sabotaje nunca modifica el componente');
}

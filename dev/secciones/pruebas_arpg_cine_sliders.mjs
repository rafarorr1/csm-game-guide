/* Regresión del transporte del editor: eventos de rango y reconstrucciones concurrentes.
   Dobles de DOM y reloj en memoria; no abre ni controla un navegador. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elementos=new Map(),creados=[],pendientes=[];
class Elemento{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.eventos={};this.atributos={};const clases=new Set();this.classList={add:c=>clases.add(c),toggle:(c,v)=>v?clases.add(c):clases.delete(c)};creados.push(this);}
  set innerHTML(html){this.html=html;for(const m of html.matchAll(/<([\w]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new Elemento(m[1]);e.id=m[3];elementos.set(e.id,e);for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))e.setAttribute(a[1],a[2]);e.disabled=/\bdisabled\b/.test(m[2]);this.children.push(e);}}
  get innerHTML(){return this.html;}
  setAttribute(k,v){this.atributos[k]=String(v);if(['value','max','min'].includes(k))this[k]=String(v);}
  append(...hijos){this.children.push(...hijos);}
  prepend(...hijos){this.children.unshift(...hijos);}
  replaceChildren(...hijos){this.children=hijos;}
  querySelector(){return null;}
  addEventListener(n,f){(this.eventos[n]??=[]).push(f);}
  setPointerCapture(){}
  focus(){documento.activeElement=this;}
  emitir(tipo){const e={target:this,pointerId:1};this['on'+tipo]?.(e);for(const f of this.eventos[tipo]||[])f(e);}
}
const documento={body:new Elemento(),activeElement:null,hidden:false,createElement:t=>new Elemento(t),getElementById:id=>elementos.get(id),querySelector:()=>new Elemento(),querySelectorAll:()=>creados.filter(e=>e.dataset.fase),addEventListener(){}};
let ms=0;
const c=vm.createContext({console,atob,document:documento,localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>ms++},setTimeout:f=>pendientes.push(f),addEventListener(){}});c.window=c;
for(const archivo of ['visor-three-vendor.js','arpg-cine-camara.js','arpg-cine-editor.js'])vm.runInContext(fs.readFileSync(new URL(archivo,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,camara=new T.PerspectiveCamera(),fases=['salida','descubrir','vertigo'];let simulado=0,reinicios=0;
const api={reiniciar(){simulado=0;reinicios++;camara.position.set(0,2,10);},paso(){simulado++;camara.position.x=simulado;},estado:()=>({fase:fases[Math.min(fases.length-1,Math.floor(simulado/120))],t:(simulado%120)/60,actor:[0,0,0],mago:[1,0,0],terminado:simulado>=fases.length*120-1}),vista(){}};
const editor=c.CAOZ_ARPG_CINE_EDITOR.crear(T,camara,new Elemento('canvas'),api),$=id=>elementos.get(id);
async function ceder(){assert(pendientes.length,'Debe haber un tramo de simulación pendiente');pendientes.shift()();await Promise.resolve();await Promise.resolve();}
async function completar(){let n=0;while(pendientes.length){assert(++n<1000,'Una búsqueda debe terminar');await ceder();}}
function entrada(id,valor){$(id).value=String(valor);$(id).emitir('input');}
function comprobar(global,local){assert.equal(Number($('ceTiempo').value),global);assert.equal(Number($('ceLocal').value),local);}
await completar();assert.equal(simulado,0);assert.equal($('ceTiempo').disabled,false);assert.equal(Number($('ceTiempo').max),359);

// El render ya no devuelve los sliders al cuadro confirmado mientras se arrastran.
$('ceTiempo').emitir('pointerdown');entrada('ceTiempo',160);editor.paso(.1);comprobar(160,40);assert.equal($('ceCampos').disabled,true);assert.equal($('ceTiempo').disabled,false);assert.equal($('ceLocal').disabled,false);
await completar();comprobar(160,40);assert.equal(simulado,160);assert.equal($('ceReloj').textContent,'00:02:40');
entrada('ceTiempo',25);editor.paso(.1);comprobar(25,25);await completar();editor.paso(.1);comprobar(25,25);$('ceTiempo').emitir('pointerup');

// Varias entradas antes de reconstruir sólo ejecutan la última solicitud.
const antes=reinicios;entrada('ceTiempo',310);entrada('ceTiempo',40);entrada('ceTiempo',270);await completar();assert.equal(reinicios,antes+1);assert.equal(simulado,270);comprobar(270,30);

// Cancelar una búsqueda en marcha no deja que ésta confirme sobre la más reciente.
entrada('ceTiempo',350);await ceder();assert(simulado<350);entrada('ceTiempo',150);await completar();assert.equal(simulado,150);comprobar(150,30);assert.equal($('ceCampos').disabled,false);

// El slider local conserva el mismo plano desde el primer hasta el último cuadro.
$('ceLocal').emitir('pointerdown');entrada('ceLocal',119);editor.paso(.1);comprobar(239,119);await ceder();entrada('ceLocal',0);await completar();comprobar(120,0);assert.equal(simulado,120);
entrada('ceLocal',75);await completar();editor.paso(.1);comprobar(195,75);$('ceLocal').emitir('change');$('ceLocal').emitir('pointerup');assert.equal(pendientes.length,0,'Soltar no repite la búsqueda ya confirmada');

// Teclado (input + change sin pointerdown), extremos y cambio del rango al cruzar planos.
entrada('ceLocal',76);$('ceLocal').emitir('change');await completar();comprobar(196,76);
entrada('ceLocal',0);await completar();comprobar(120,0);entrada('ceLocal',119);await completar();comprobar(239,119);
entrada('ceTiempo',359);await completar();comprobar(359,119);assert.equal($('ceLocalTitulo').textContent,'Tiempo del plano · Dolly zoom');
entrada('ceTiempo',0);await completar();comprobar(0,0);assert.equal(simulado,0);

// Iniciar un arrastre pausa la reproducción incluso antes del primer input.
$('ceVelocidad').value='1';$('cePlay').onclick();editor.paso(.1);assert(simulado>0);$('ceLocal').emitir('pointerdown');const detenido=simulado;editor.paso(.1);assert.equal(simulado,detenido);entrada('ceLocal',50);await completar();$('ceLocal').emitir('pointercancel');editor.paso(.1);comprobar(50,50);
assert.equal($('cePlay').textContent,'▶ Reproducir');
const css=fs.readFileSync(new URL('arpg-cine-editor.css',import.meta.url),'utf8');assert(!/\.ceBloqueado \.ceMontaje\s*\{/.test(css),'Buscar no debe desactivar los rangos durante el gesto');
console.log('✓ Sliders: arrastre con render activo, búsqueda durante el gesto, reversa, último destino, cancelación concurrente, plano local estable, extremos, teclado y pausa.');

// El plano 04 reúne las antiguas acciones 04–06 y el 05 reúne 07–10.
fases.push('carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','voltear','techo','cielo','caida','impacto','negro');
const agrupado=c.CAOZ_ARPG_CINE_EDITOR.crear(T,camara,new Elemento('canvas'),api);await completar();
assert.equal($('cePlanos').children.length,10);assert.equal($('ceTiras').children.length,10);
entrada('ceTiempo',370);await completar();assert.equal(Number($('ceLocal').max),359);
$('ceLocal').emitir('pointerdown');entrada('ceLocal',250);await completar();comprobar(610,250);assert.equal(api.estado().fase,'desaparece');
assert.equal($('cePlanoTitulo').textContent,'04 / Carrera, ataque y desaparición');$('ceLocal').emitir('pointerup');
$('ceCurva').value='suave';$('ceKey').onclick();assert.equal($('ceCuenta').textContent,1);assert.equal($('ceKeyTiempo').value,'4.167');
entrada('ceLocal',100);await completar();assert.equal($('ceCuenta').textContent,1,'La misma pista está disponible en todas las acciones del plano');
entrada('ceTiempo',730);await completar();assert.equal(Number($('ceLocal').max),479);entrada('ceLocal',479);await completar();comprobar(1199,479);
assert.equal($('cePlanoTitulo').textContent,'05 / Caída, búsqueda y recuperación');assert.equal(api.estado().fase,'voltear');
entrada('ceTiempo',710);await completar();$('ceVelocidad').value='1';$('ceGrabar').onclick();for(let i=0;i<5;i++)agrupado.paso(.1);assert.equal(simulado,719,'La grabación acaba al final del grupo completo');
entrada('ceTiempo',470);await completar();$('ceGrabar').onclick();for(let i=0;i<5;i++)agrupado.paso(.1);assert(simulado>480,'Cambiar de acción no detiene la grabación');assert.equal($('ceGrabar').textContent,'■ Detener grabación');$('ceGrabar').onclick();
console.log('✓ Grupos del editor: diez planos, sliders completos, keyframes compartidos y grabación continua entre acciones.');

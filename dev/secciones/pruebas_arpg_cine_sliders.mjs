/* Regresión del transporte del editor: eventos de rango y reconstrucciones concurrentes.
   Dobles de DOM y reloj en memoria; no abre ni controla un navegador. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elementos=new Map(),creados=[],pendientes=[],almacenamiento=new Map();
class Elemento{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={setProperty(n,v){this[n]=v;}};this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.eventos={};this.atributos={};const clases=new Set();this.classList={add:c=>clases.add(c),toggle:(c,v)=>v?clases.add(c):clases.delete(c)};creados.push(this);}
  set innerHTML(html){this.html=html;for(const m of html.matchAll(/<([\w]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new Elemento(m[1]);e.id=m[3];elementos.set(e.id,e);for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))e.setAttribute(a[1],a[2]);e.disabled=/\bdisabled\b/.test(m[2]);this.children.push(e);}}
  get innerHTML(){return this.html;}
  setAttribute(k,v){this.atributos[k]=String(v);if(['value','max','min'].includes(k))this[k]=String(v);}
  append(...hijos){this.children.push(...hijos);}
  prepend(...hijos){this.children.unshift(...hijos);}
  replaceChildren(...hijos){this.children=hijos;}
  querySelector(selector){return selector==='nav'?this.children.find(e=>e.tag==='nav'):null;}
  addEventListener(n,f){(this.eventos[n]??=[]).push(f);}
  setPointerCapture(){}
  focus(){documento.activeElement=this;}
  emitir(tipo){const e={target:this,pointerId:1};this['on'+tipo]?.(e);for(const f of this.eventos[tipo]||[])f(e);}
}
const documento={body:new Elemento(),activeElement:null,hidden:false,createElement:t=>new Elemento(t),getElementById:id=>elementos.get(id),querySelector:()=>new Elemento(),querySelectorAll:()=>creados.filter(e=>e.dataset.fase),addEventListener(){}};
let ms=0;
const c=vm.createContext({console,atob,URL,URLSearchParams,location:{href:'http://127.0.0.1:8900/dev/secciones/arpg-cine.html?piso=scenario',search:'?piso=scenario'},document:documento,localStorage:{getItem:k=>almacenamiento.get(k)??null,setItem:(k,v)=>almacenamiento.set(k,v)},performance:{now:()=>ms++},setTimeout:f=>pendientes.push(f),requestAnimationFrame:f=>pendientes.push(f),addEventListener(){}});c.window=c;
for(const archivo of ['visor-three-vendor.js','arpg-cine-camara.js','arpg-cine-editor.js'])vm.runInContext(fs.readFileSync(new URL(archivo,import.meta.url),'utf8'),c);
const T=c.CAOZ_THREE.THREE,camara=new T.PerspectiveCamera(),fases=['salida','descubrir','vertigo'];let simulado=0,reinicios=0,pasos=0,restauraciones=0,vistaExterna=null;
const api={reiniciar(){simulado=0;reinicios++;camara.position.set(0,2,10);},paso(){pasos++;simulado++;camara.position.x=simulado;},estado:()=>({fase:fases[Math.min(fases.length-1,Math.floor(simulado/120))],t:(simulado%120)/60,actor:[0,0,0],mago:[1,0,0],terminado:simulado>=fases.length*120-1}),vista(v){vistaExterna=v;},capturar(){return {simulado,x:camara.position.x};},mostrar(c){restauraciones++;simulado=c.simulado;camara.position.x=c.x;}};
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
const antes=reinicios;entrada('ceTiempo',310);entrada('ceTiempo',40);entrada('ceTiempo',270);await completar();assert.equal(reinicios,antes);assert.equal(simulado,270);comprobar(270,30);assert.equal(creados.find(e=>e.className==='ceOcupado').hidden,true,'La búsqueda no tapa la vista');

// Cada búsqueda termina antes de pintar; una reversa posterior se evalúa completa.
entrada('ceTiempo',350);await ceder();assert.equal(simulado,350);entrada('ceTiempo',150);await completar();assert.equal(simulado,150);comprobar(150,30);assert.equal($('ceCampos').disabled,false);

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

// El corte a tercera persona pertenece al plano 06, desde desaparece.
fases.splice(3,0,'pies');fases.push('carrera','ataquePOV','desaparece','levantarse','tropezar','buscar','voltear','techo','hechizo','cielo','caida','impacto','negro');
const agrupado=c.CAOZ_ARPG_CINE_EDITOR.crear(T,camara,new Elemento('canvas'),api);await completar();
assert.equal($('cePlanos').children.length,10);assert.equal($('ceTiras').children.length,10);
entrada('ceTiempo',490);await completar();assert.equal(Number($('ceLocal').max),239);
$('ceLocal').emitir('pointerdown');entrada('ceLocal',200);await completar();comprobar(680,200);assert.equal(api.estado().fase,'ataquePOV');
assert.equal($('cePlanoTitulo').textContent,'05 / Carrera y deslizamiento');$('ceLocal').emitir('pointerup');
$('ceCurva').value='suave';$('ceKey').onclick();assert.equal($('ceCuenta').textContent,1);assert.equal($('ceKeyTiempo').value,'3.333');
entrada('ceLocal',100);await completar();assert.equal($('ceCuenta').textContent,1);
entrada('ceTiempo',720);await completar();comprobar(720,0);assert.equal(api.estado().fase,'desaparece');assert.equal(Number($('ceLocal').max),479);
entrada('ceLocal',479);await completar();comprobar(1199,479);assert.equal(api.estado().fase,'buscar');assert.equal($('cePlanoTitulo').textContent,'06 / Incorporación, golpe y búsqueda');
entrada('ceTiempo',710);await completar();$('ceVelocidad').value='1';$('ceGrabar').onclick();for(let i=0;i<5;i++)agrupado.paso(.1);assert.equal(simulado,719,'La grabación acaba antes de desaparecer');
entrada('ceTiempo',830);await completar();$('ceGrabar').onclick();for(let i=0;i<5;i++)agrupado.paso(.1);assert(simulado>840,'Cambiar de acción no detiene el plano 06');assert.equal($('ceGrabar').textContent,'■ Detener grabación');$('ceGrabar').onclick();
console.log('✓ Grupos del editor: diez planos, sliders completos, keyframes compartidos y grabación continua entre acciones.');

entrada('ceTiempo',1210);await completar();assert.equal(api.estado().fase,'voltear');assert.equal(Number($('ceLocal').max),479);entrada('ceLocal',479);await completar();comprobar(1679,479);assert.equal(api.estado().fase,'cielo');assert.equal($('cePlanoTitulo').textContent,'07 / POV · estela, reaparición y hechizo');
// Una cámara libre no contamina la cámara programada al continuar hacia adelante.
const antesAvance=reinicios;entrada('ceTiempo',1570);await completar();assert.equal(reinicios,antesAvance,'Avanzar restaura el cuadro preparado');
entrada('ceTiempo',1520);await completar();assert.equal(reinicios,antesAvance,'Retroceder restaura un cuadro ya preparado');assert.equal(simulado,1520);
console.log('✓ Búsqueda por cuadro sin velo ni resimulación y slider único de techo/meteorito.');

const pasosAntes=pasos,reiniciosAntes=reinicios;for(const f of [0,1820,20,1620,100,1520,50]){entrada('ceTiempo',f);await completar();assert.equal(simulado,f);}assert.equal(pasos,pasosAntes,'El scrub no ejecuta simulación en ninguna dirección');assert.equal(reinicios,reiniciosAntes);assert(restauraciones>10);
console.log('✓ Búsquedas instantáneas por caché, sin simulación ni reinicios; actuación independiente del encuadre.');

// La opción de brazos sigue disponible en el POV de carrera y ataque.
entrada('ceTiempo',490);await completar();agrupado.antesDibujo();assert.equal($('cePOV').disabled,false);assert.equal($('cePOVControl').hidden,false);
$('cePOV').checked=false;$('cePOV').emitir('change');agrupado.antesDibujo();assert.equal(vistaExterna,true);
$('cePOV').checked=true;$('cePOV').emitir('change');agrupado.antesDibujo();assert.equal(vistaExterna,false);

// El plano 07 oculta y bloquea brazos sin cambiar la cámara ni pedir cuerpo externo.
entrada('ceTiempo',1210);await completar();agrupado.antesDibujo();assert.equal(vistaExterna,false);assert.equal($('cePOV').checked,false);assert.equal($('cePOV').disabled,true);assert.equal($('cePOVControl').hidden,true);assert.equal($('cePOVControl').style.display,'none');
assert.equal($('ceFrames').textContent,'Plano F010 · Global F1210');
$('ceKey').onclick();agrupado.antesDibujo();assert.equal(vistaExterna,false,'El primer keyframe conserva la vista original sin pedir brazos');
const seleccionar=$('ceLista').children[0].onclick();await completar();await seleccionar;agrupado.antesDibujo();assert.equal(vistaExterna,false,'Seleccionar un keyframe no cambia el actor');
const antesVistaBloqueada=almacenamiento.get(c.CAOZ_ARPG_CINE_CAMARA.CLAVE);$('cePOV').checked=true;$('cePOV').emitir('change');agrupado.antesDibujo();assert.equal($('cePOV').checked,false);assert.equal(vistaExterna,false,'Un evento del control oculto no activa brazos ni cuerpo en POV7');assert.equal(almacenamiento.get(c.CAOZ_ARPG_CINE_CAMARA.CLAVE),antesVistaBloqueada,'El control bloqueado no altera la toma');
$('ceKey').onclick();agrupado.antesDibujo();assert.equal(vistaExterna,false);
$('ceEliminar').onclick();agrupado.antesDibujo();assert.equal(vistaExterna,false,'Borrar el último keyframe tampoco cambia la representación');
$('ceBase').onclick();agrupado.antesDibujo();assert.equal(vistaExterna,false,'Convertir la cámara original conserva la representación');
entrada('ceTiempo',1440);await completar();assert.equal($('ceFrames').textContent,'Plano F240 · Global F1440');
$('ceVelocidad').value='.25';agrupado.paso(.1);assert.equal($('ceFrames').textContent,'Plano F240 · Global F1440','La referencia de cuadros no depende de la velocidad');
entrada('ceTiempo',1680);await completar();assert.equal($('ceFrames').textContent,'Plano F000 · Global F1680','El contador local se reinicia al cambiar de plano');
assert.equal($('cePOV').disabled,false);assert.equal($('cePOVControl').hidden,false,'La restricción sólo pertenece al plano 07');
for(const f of [1210,1330,1450,1570]){entrada('ceTiempo',f);await completar();assert.equal($('cePOV').disabled,true);assert.equal($('cePOV').checked,false);assert.equal($('cePOVControl').hidden,true);assert.equal($('cePOVControl').style.display,'none');}
console.log('✓ Keyframes conservan la representación del actor; contador de cuadros local/global con base 60 e índices desde cero.');

// Migrar/importar respalda cada versión sin sobrescribir otra toma manual.
const M=c.CAOZ_ARPG_CINE_CAMARA,clave=M.CLAVE,backup=clave+'.respaldo-v7',anterior={...M.nueva(),version:7,nombre:'Cámara manual',planos:{techo:{vista:'original',claves:[{t:0,pos:[42,2,10],rot:[0,0,0,1],fov:42,distancia:10,curva:'lineal'}]}}};
almacenamiento.set(backup,'otro respaldo manual');
async function importar(toma){const texto=JSON.stringify(toma);$('ceArchivo').files=[{size:texto.length,text:async()=>texto}];await $('ceArchivo').onchange();}
await importar(anterior);assert.equal(almacenamiento.get(backup),'otro respaldo manual');assert.equal(almacenamiento.get(backup+'.1'),JSON.stringify(anterior));assert.equal(JSON.parse(almacenamiento.get(clave)).version,10);
await importar(anterior);assert(!almacenamiento.has(backup+'.2'),'Reimportar la misma toma reutiliza su copia exacta');
entrada('ceTiempo',1210);await completar();agrupado.antesDibujo();assert.equal(camara.position.x,1210,'El nuevo hold conserva su cámara nativa al importar');assert.equal(JSON.parse(almacenamiento.get(clave)).planos.techo.nativasHasta.voltear,2);
entrada('ceTiempo',1330);await completar();agrupado.antesDibujo();assert.equal(camara.position.x,42,'La cámara manual v7 se conserva tras el hold');
entrada('ceTiempo',1450);await completar();assert.equal(api.estado().fase,'hechizo');agrupado.antesDibujo();assert.equal(camara.position.x,1450,'La nueva acción hechizo queda programada hasta editarla');
$('ceKey').onclick();assert(!JSON.parse(almacenamiento.get(clave)).planos.techo.nativas?.includes('hechizo'),'Una clave explícita permite editar el hechizo');
entrada('ceTiempo',1210);await completar();$('ceKey').onclick();assert(!JSON.parse(almacenamiento.get(clave)).planos.techo.nativasHasta,'También se puede editar explícitamente la cámara del hold');
const heredada={...anterior,version:6,nombre:'Techo anterior'};await importar(heredada);
entrada('ceTiempo',1210);await completar();agrupado.antesDibujo();assert.equal(camara.position.x,1210,'El giro nativo heredado sigue la nueva escena en vivo');assert(JSON.parse(almacenamiento.get(clave)).planos.techo.nativas.includes('voltear'));
$('ceKey').onclick();assert(!JSON.parse(almacenamiento.get(clave)).planos.techo.nativas?.includes('voltear'),'Guardar una cámara explícita permite editar la acción antes nativa');
console.log('✓ Formato 10 en editor: respaldos sin sobrescritura, importación manual, hold y hechizo nativos, edición explícita de ambas acciones.');

const manual9={...M.nueva(),version:9,nombre:'Paneo conservado',planos:{descubrir:{vista:'externa',claves:[{t:0,pos:[12,2,10],rot:[0,0,0,1],fov:42,distancia:10,curva:'suave'},{t:2.4,pos:[24,2,10],rot:[0,0,0,1],fov:55,distancia:10,curva:'corte'}]},techo:{vista:'original',claves:[{t:0,pos:[85,2,10],rot:[0,0,0,1],fov:44,distancia:10,curva:'lineal'}]}}};
await importar(manual9);const guardada10=JSON.parse(almacenamiento.get(clave));assert.equal(guardada10.version,10);assert.equal(almacenamiento.get(clave+'.respaldo-v9'),JSON.stringify(manual9));assert(Math.abs(guardada10.planos.descubrir.claves[1].t-3.4)<1e-10);assert.equal(JSON.stringify(guardada10.planos.techo),JSON.stringify(manual9.planos.techo));
for(const f of [1210,1330,1450,1570]){entrada('ceTiempo',f);await completar();agrupado.antesDibujo();assert.equal(camara.position.x,85,'La cámara guardada de v9 continúa en todas las acciones del plano 07');assert.equal($('cePOV').checked,false);assert.equal($('cePOV').disabled,true);assert.equal($('cePOVControl').hidden,true);assert.equal($('cePOVControl').style.display,'none');assert.equal(vistaExterna,false);}
console.log('✓ Importar v9 respalda la toma, estira sólo el paneo y conserva las cámaras de POV7 con su opción de brazos bloqueada.');

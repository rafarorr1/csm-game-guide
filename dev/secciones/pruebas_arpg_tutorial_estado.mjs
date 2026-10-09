/* El recorrido acredita acciones reales, conserva pendientes y libera el control al salir. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Elemento{
  constructor(tipo){this.tipo=tipo;this.children=[];this.attributes={};this.dataset={};this.listeners={};this.hidden=false;this.textContent='';const clases=new Set();this.classList={toggle(nombre,valor){if(valor)clases.add(nombre);else clases.delete(nombre);},contains:nombre=>clases.has(nombre)};}
  append(...hijos){this.children.push(...hijos);}
  setAttribute(nombre,valor){assert(!/^on|^style$/.test(nombre),'La interfaz respeta CSP');this.attributes[nombre]=valor;}
  removeAttribute(nombre){delete this.attributes[nombre];}
  addEventListener(nombre,funcion){this.listeners[nombre]=funcion;}
}
const escenario=new Elemento('section'),document={getElementById:id=>id==='escenario'?escenario:null,createElement:tipo=>new Elemento(tipo)};
const contexto=vm.createContext({console,document});contexto.window=contexto;
vm.runInContext(fs.readFileSync(new URL('arpg-three-tutorial.js',import.meta.url),'utf8'),contexto);
const T=contexto.CAOZ_ARPG_TUTORIAL,lecciones=[],entradas=[],salidas=[],saltos=[];
const tutorial=T.crear({alLeccion:l=>lecciones.push(l),alEntrar:e=>entradas.push(e),alSalir:e=>salidas.push(e),alSaltar:e=>saltos.push(e)});
const plano=valor=>JSON.parse(JSON.stringify(valor));
const hijos=(elemento,clase)=>{if(elemento.className===clase)return elemento;for(const hijo of elemento.children){const encontrado=hijos(hijo,clase);if(encontrado)return encontrado;}return null;};

assert(!tutorial.activo);assert.equal(tutorial.estado().fase,'inactivo');assert.equal(tutorial.objetivo,null);
assert(tutorial.iniciar());assert(!tutorial.iniciar(),'Iniciar dos veces no duplica encuentros');
assert.equal(escenario.children.length,1);assert(escenario.classList.contains('enTutorial'));
assert.equal(lecciones[0].id,'mover');assert.equal(tutorial.objetivo.s,7);assert(!tutorial.bloquea);
assert(!tutorial.evento('impacto-basico'));assert(!tutorial.evento('mover'));
tutorial.paso(.1,{avance:6.99});assert.equal(tutorial.objetivo.id,'mover');
tutorial.paso(.1,{avance:7});assert.equal(tutorial.objetivo.id,'basico');assert.equal(tutorial.estado().fase,'camino');
assert(!tutorial.evento('impacto-basico'),'No acredita acciones anteriores al encuentro');
assert.equal(lecciones.length,1);tutorial.paso(.1,{avance:13.99});assert.equal(lecciones.length,1);
tutorial.paso(.1,{avance:14,mando:{activo:true}});assert.equal(lecciones.length,2);assert.equal(tutorial.estado().fase,'leccion');
assert.equal(hijos(escenario,'apTutorialTecla').textContent,'R2 / □ · pulsar y soltar');
assert(!hijos(escenario,'apTutorialAtajo').hidden);
assert.equal(hijos(escenario,'apTutorialPaso').textContent,'Paso 2 / 9');
assert(!tutorial.evento('impacto-cargado'),'Cada encuentro sólo acredita su acción');
assert(tutorial.evento('impacto-basico'));assert(!tutorial.evento('impacto-basico'),'Un evento repetido no salta una lección');
tutorial.paso(.1,{avance:24,mando:false});assert.equal(tutorial.objetivo.id,'cargado');
assert(!tutorial.evento('impacto-cargado',{cargaCompleta:false}));assert(!tutorial.evento('impacto-cargado',{carga:.8}));

tutorial.pausar(true);const congelado=plano(tutorial.estado());tutorial.paso(10,{avance:70});
assert.deepEqual(plano(tutorial.estado()),congelado,'La pausa congela la progresión y su reloj');
assert(!tutorial.evento('impacto-cargado'));tutorial.pausar(false);
tutorial.paso(.1,{avance:70,vivo:false});assert.equal(tutorial.estado().avance,24);
assert(!tutorial.evento('impacto-cargado'),'Un personaje caído no completa acciones');
tutorial.paso(.1,{avance:24,vivo:true});assert(tutorial.evento('impacto-cargado',{cargaCompleta:true}));

// La máquina conserva el reto pendiente incluso si recibe un avance fuera del encuentro.
tutorial.paso(.1,{avance:83});assert.equal(tutorial.estado().avance,83);assert.equal(tutorial.objetivo.id,'dash');assert(!tutorial.bloquea);
assert(tutorial.evento('dash'));assert.equal(tutorial.objetivo.id,'parry');assert(tutorial.objetivo.disponible);
assert(!tutorial.evento('parry',{perfecto:false}));assert(tutorial.evento('parry',{perfecto:true}));
for(const evento of ['impacto-salto','impacto-torbellino','impacto-boomerang'])assert(tutorial.evento(evento));
assert.equal(tutorial.objetivo.id,'ulti');assert(!tutorial.finalizar(),'No puede terminar antes de entrar');
assert(!tutorial.evento('ulti'),'Invocar no sustituye un golpe real del aliado');assert(tutorial.evento('impacto-aliado'));assert.equal(tutorial.objetivo.id,'puerta');
assert.equal(lecciones.at(-1).id,'puerta','Abre la puerta en cuanto se aprende la ulti');assert.equal(entradas.length,0);
assert.equal(tutorial.estado().fase,'puerta');assert(!tutorial.bloquea);
assert.equal(hijos(escenario,'apTutorialPaso').textContent,'9 / 9 completados');
assert.equal(hijos(escenario,'apTutorialProgreso').children.filter(e=>e.classList.contains('completada')).length,9);
tutorial.paso(.1,{avance:84.99});assert.equal(entradas.length,0);
tutorial.paso(.1,{avance:85});assert.equal(entradas.length,1);assert(tutorial.bloquea);
for(let i=0;i<3;i++)tutorial.paso(.1,{avance:90});assert.equal(entradas.length,1);
assert.equal(tutorial.estado().fase,'entrada');assert.equal(salidas.length,0);
assert(tutorial.finalizar());assert(!tutorial.finalizar());assert(!tutorial.activo);assert(!tutorial.bloquea);
assert.equal(salidas.length,1);assert.equal(salidas[0].fase,'terminado');assert.equal(saltos.length,0);
assert(hijos(escenario,'apTutorial').hidden);assert(!escenario.classList.contains('enTutorial'));
assert.deepEqual(lecciones.map(l=>l.id),['mover','basico','cargado','dash','parry','salto','torbellino','boomerang','ulti','puerta']);

assert(tutorial.iniciar());assert.equal(escenario.children.length,1,'Reiniciar reutiliza la interfaz');
assert.equal(tutorial.estado().completadas.length,0);assert.equal(tutorial.estado().avance,0);
const copia=tutorial.objetivo;copia.id='cambiada';assert.equal(tutorial.objetivo.id,'mover','La consulta no muta el objetivo');
hijos(escenario,'apTutorialSaltar').listeners.click();assert.equal(saltos.length,1);
assert.equal(saltos[0].fase,'saltado');assert(!tutorial.saltar());assert(!tutorial.evento('mover'));
assert.equal(salidas.length,1,'Saltar y finalizar notifican salidas distintas');
assert(tutorial.iniciar());tutorial.pausar(true);assert(tutorial.cancelar());assert(!tutorial.cancelar());
assert.equal(tutorial.estado().fase,'inactivo');assert(!tutorial.estado().pausado);assert(!tutorial.activo);
assert(hijos(escenario,'apTutorial').hidden);assert.equal(saltos.length,1);assert.equal(salidas.length,1,'Cancelar no llama callbacks de salida');

// La máquina también se puede probar o simular sin navegador.
const sinDOM=vm.createContext({console});sinDOM.window=sinDOM;
vm.runInContext(fs.readFileSync(new URL('arpg-three-tutorial.js',import.meta.url),'utf8'),sinDOM);
const simulada=sinDOM.CAOZ_ARPG_TUTORIAL.crear();assert(simulada.iniciar());simulada.paso(.1,{avance:7});assert.equal(simulada.objetivo.id,'basico');
assert.doesNotThrow(()=>JSON.stringify(simulada.estado()));
console.log('OK · Tutorial: nueve acciones, umbrales, pausa, puerta, controles y salto idempotente.');

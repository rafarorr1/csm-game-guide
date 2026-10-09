/* El recorrido acredita acciones reales, conserva pendientes y libera el control al salir. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';

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
assert.equal(hijos(escenario,'apTutorialPaso').textContent,'Paso 2 / '+T.TOTAL);
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
assert.equal(tutorial.objetivo.id,'parry-flecha','La defensa a distancia tiene su propio encuentro');
assert(!tutorial.evento('parry'),'Un golpe cuerpo a cuerpo no completa la devolución de una flecha');
assert(!tutorial.evento('parry-flecha',{perfecto:false}));assert(tutorial.evento('parry-flecha',{perfecto:true}));
for(const evento of ['impacto-salto','impacto-torbellino','impacto-boomerang'])assert(tutorial.evento(evento));
assert.equal(tutorial.objetivo.id,'ulti');assert(!tutorial.finalizar(),'No puede terminar antes de entrar');
assert(!tutorial.evento('ulti'),'Invocar no sustituye un golpe real del aliado');assert(tutorial.evento('impacto-aliado'));assert.equal(tutorial.objetivo.id,'puerta');
assert.equal(lecciones.at(-1).id,'puerta','Abre la puerta en cuanto se aprende la ulti');assert.equal(entradas.length,0);
assert.equal(tutorial.estado().fase,'puerta');assert(!tutorial.bloquea);
assert.equal(hijos(escenario,'apTutorialPaso').textContent,T.TOTAL+' / '+T.TOTAL+' completados');
assert.equal(hijos(escenario,'apTutorialProgreso').children.filter(e=>e.classList.contains('completada')).length,T.TOTAL);
tutorial.paso(.1,{avance:84.99});assert.equal(entradas.length,0);
tutorial.paso(.1,{avance:85});assert.equal(entradas.length,1);assert(tutorial.bloquea);
for(let i=0;i<3;i++)tutorial.paso(.1,{avance:90});assert.equal(entradas.length,1);
assert.equal(tutorial.estado().fase,'entrada');assert.equal(salidas.length,0);
assert(tutorial.finalizar());assert(!tutorial.finalizar());assert(!tutorial.activo);assert(!tutorial.bloquea);
assert.equal(salidas.length,1);assert.equal(salidas[0].fase,'terminado');assert.equal(saltos.length,0);
assert(hijos(escenario,'apTutorial').hidden);assert(!escenario.classList.contains('enTutorial'));
assert.deepEqual(lecciones.map(l=>l.id),['mover','basico','cargado','dash','parry','parry-flecha','salto','torbellino','boomerang','ulti','puerta']);

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
console.log('OK · Tutorial: diez acciones, dos tipos de parry, umbrales, pausa, puerta y controles.');

// Verifica el reloj y el reintento con las funciones reales, sin cargar otra GPU.
const mesa=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const relojGuiado={t:0},aventura={},entGuiada={},movimiento={set(){}},avisos=[],pausas=[];
const guiado=vm.createContext({enTutorial:()=>true,aventuraTutorial:aventura,reloj:relojGuiado,heroe:{estado:'quieto',pos:{},radio:.4},
 tutorial:{objetivo:{id:'parry'},indicarParry:valor=>avisos.push(valor)},enemigos:[],lanzas:[],enZona:()=>true,
 llegadaFlechaTutorial:flecha=>flecha.restante,ent:entGuiada,ctl:{mov:movimiento},clima:{pausar:valor=>pausas.push(valor)}});
for(const [nombre,tipo] of [['PARRY','const'],['prepararCongelacionParry','function'],['congelarParryTutorial','function']])vm.runInContext(extraerDeclaracion(mesa,nombre,tipo).texto,guiado);
for(const id of ['parry','parry-flecha'])for(const cancelacion of ['esquiva','salto']){
 const ventana=vm.runInContext(id==='parry'?'PARRY.perfecto':'PARRY.perfectoLanza',guiado),instante=ventana*.9;
 guiado.tutorial.objetivo.id=id;guiado.heroe.estado='quieto';guiado.heroe.parryExito=false;
 Object.assign(aventura,{guiado:false,congelado:false,congelar:null});relojGuiado.t=0;guiado.enemigos.length=guiado.lanzas.length=0;
 const enemigo={tutorial:id,ataque:{dur:instante+.021,t0:0}},flecha={e:{tutorial:id},restante:instante+.021};
 if(id==='parry')guiado.enemigos.push(enemigo);else guiado.lanzas.push(flecha);
 const dt=guiado.prepararCongelacionParry(.05);
 assert(Math.abs(dt-.021)<1e-9,'Recorta el cuadro de 20 FPS al instante dorado de '+id);
 relojGuiado.t+=dt;flecha.restante-=dt;guiado.congelarParryTutorial();assert(aventura.congelado);
 assert(instante>0&&instante<ventana,'El instante detenido queda dentro de la ventana perfecta');
 // Pulsar parry libera el reloj; cancelarlo no debe consumir para siempre la ayuda.
 Object.assign(aventura,{congelado:false,guiado:true});guiado.heroe.estado='parry';
 assert.equal(guiado.prepararCongelacionParry(.05),.05);assert(aventura.guiado);assert.equal(aventura.congelar,null);
 guiado.heroe.estado=cancelacion;assert.equal(guiado.prepararCongelacionParry(.05),.05);
 assert(!aventura.guiado,'Cancelar con '+cancelacion+' permite repetir '+id);assert.equal(aventura.congelar,null,'No congela en una acción que no permite parry');
 guiado.heroe.estado='quieto';enemigo.ataque.t0=relojGuiado.t;enemigo.ataque.dur=instante+.019;flecha.restante=instante+.019;
 const segundo=guiado.prepararCongelacionParry(.05);assert(Math.abs(segundo-.019)<1e-9);
 relojGuiado.t+=segundo;flecha.restante-=segundo;guiado.congelarParryTutorial();assert(aventura.congelado,'El próximo intento vuelve a detenerse');
 Object.assign(aventura,{congelado:false,guiado:true});guiado.heroe.parryExito=true;
 guiado.prepararCongelacionParry(.05);assert(aventura.guiado,'Un parry acertado no vuelve a ofrecer la ayuda');
}
assert.equal(avisos.length,8);assert(avisos.every(Boolean));assert(pausas.every(Boolean));
console.log('OK · Parry guiado a 20 FPS: golpe y flecha se detienen dentro de su ventana y vuelven a ofrecerse tras cancelar con dash o salto.');

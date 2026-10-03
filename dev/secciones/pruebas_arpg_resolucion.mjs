/* Verificar los tamaños enviados al renderizador y al posproceso, sin depender de una GPU. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
function comprobar({ancho=1920,alto=1080,densidad=1,escala=1,captura=false,fija=false},esperado){
  const crearDestino=()=>({setPixelRatio(v){this.dpr=v;},setSize(w,h){this.cambios=(this.cambios||0)+1;this.ancho=Math.floor(w*this.dpr);this.alto=Math.floor(h*this.dpr);}});
  const renderer=crearDestino(),composer=crearDestino(),camara={updateProjectionMatrix(){}};
  const c={esc:{getBoundingClientRect:()=>({width:ancho,height:alto})},laboratorio:fija?{resolucion:{ancho:1920,alto:1080}}:null,devicePixelRatio:densidad,escalaRender:escala,CAPTURA:captura,renderer,composer,camara,medidorGPU:null,escPuntos:{}};
  vm.runInNewContext('let tamanoPendiente=false,ultimoTamano=\'\';'+extraerDeclaracion(fuente,'medir').texto+extraerDeclaracion(fuente,'aplicarTamano').texto+';medir();',c);
  assert.equal(renderer.ancho,undefined,'Solicitar resolución no borra el cuadro presentado');
  vm.runInNewContext('aplicarTamano();',c);
  for(const destino of [renderer,composer])assert.deepEqual([destino.ancho,destino.alto],esperado);
  assert.equal(camara.aspect,fija?16/9:ancho/alto,'La cámara conserva el encuadre del búfer');
  const cambios=renderer.cambios;vm.runInNewContext('medir();aplicarTamano();',c);
  assert.equal(renderer.cambios,cambios,'Un ResizeObserver sin cambios no limpia ni realoca');
}
for(const densidad of [1,2,3])comprobar({densidad},[1920,1080]);
comprobar({ancho:3840,alto:2160},[1920,1080]);
comprobar({ancho:390,alto:780,densidad:3},[487,975]);
comprobar({escala:.7},[1344,756]);
comprobar({densidad:2,captura:true},[3840,2160]);
comprobar({ancho:892,alto:502,densidad:2,escala:.7,fija:true},[1920,1080]);
comprobar({ancho:390,alto:780,densidad:3,fija:true},[1920,1080]);
console.log('✓ 1080p nativo, límite en 4K/Retina, móvil, adaptación, captura e inspector fijo');

// Un límite de presentación no implica saturación de GPU. Ajustar sólo donde ayuda.
function adaptacion(gpu,fps,repeticiones,opciones={}){
  const c={CAPTURA:false,laboratorio:null,document:{hidden:false},pausa:{activa:false},medidorGPU:{leer:()=>gpu},medir(){},...opciones};
  vm.runInNewContext('let escalaRender=1,cuadrosLentos=0,cuadrosRapidos=0;'+extraerDeclaracion(fuente,'ajustarResolucion').texto,c);
  for(let i=0;i<repeticiones;i++)vm.runInNewContext(`ajustarResolucion(${fps});`,c);
  return vm.runInNewContext('escalaRender',c);
}
assert.equal(adaptacion(7,30,10),1,'Navegador a 30 Hz con GPU libre conserva detalle');
assert.equal(adaptacion(15,60,2),.9,'GPU sin margen reduce carga antes de perder fluidez');
assert.equal(adaptacion(null,50,2),.9,'Sin consultas de GPU también se busca llegar a 60 FPS');
assert.equal(adaptacion(30,20,10,{laboratorio:{}}),1,'El inspector conserva la referencia fija');
assert.equal(adaptacion(30,20,10,{pausa:{activa:true}}),1,'Pausa no degrada calidad');
const f=extraerDeclaracion(fuente,'crearMedidorGPU').texto;
const fabricar=vm.runInNewContext(f+';crearMedidorGPU');
assert.equal(fabricar({getExtension:()=>null}).leer(),null,'Sin extensión no se inventa una medida');
let disponible=false,disjunto=false,creadas=0,borradas=0,iniciadas=0,terminadas=0;
const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,getExtension:()=>({GPU_DISJOINT_EXT:3,TIME_ELAPSED_EXT:4}),getParameter:()=>disjunto,
 getQueryParameter:(q,k)=>k===1?disponible:8000000,createQuery:()=>++creadas,deleteQuery:()=>borradas++,beginQuery:()=>iniciadas++,endQuery:()=>terminadas++};
const medidor=fabricar(gl);
for(let i=0;i<140;i++){medidor.iniciar();medidor.terminar();}
assert.equal(creadas,4,'Cola acotada si la GPU tarda en responder');assert.equal(medidor.leer(),null);
disponible=true;medidor.iniciar();medidor.terminar();assert.equal(medidor.leer(),8);assert.equal(borradas,4);
assert.equal(iniciadas,terminadas,'Cada consulta se cierra en su cuadro');
disjunto=true;medidor.iniciar();assert.equal(medidor.leer(),null,'Se descarta una medida inválida');
console.log('✓ Tamaño diferido y sin realocaciones redundantes; adaptación a GPU, cola asíncrona acotada y referencia fija');

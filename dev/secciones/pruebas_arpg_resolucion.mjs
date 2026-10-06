/* Verificar los tamaños enviados al renderizador y al posproceso, sin depender de una GPU. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
function comprobar({ancho=1920,alto=1080,densidad=1,escala=1,captura=false,fija=false},esperado){
  const crearDestino=()=>({setPixelRatio(v){this.dpr=v;},setSize(w,h){this.cambios=(this.cambios||0)+1;this.ancho=Math.floor(w*this.dpr);this.alto=Math.floor(h*this.dpr);}});
  const renderer=crearDestino(),composer=crearDestino(),camara={updateProjectionMatrix(){}};
  const c={esc:{getBoundingClientRect:()=>({width:ancho,height:alto})},laboratorio:fija?{resolucion:{ancho:1920,alto:1080}}:null,devicePixelRatio:densidad,escalaRender:escala,CAPTURA:captura,renderer,composer,camara,medidorGPU:null,escPuntos:{},finalMago:null,calidad:{estado:()=>({pixeles:1920*1080})},efectos:{oclusion:false,resplandor:true}};
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

// El controlador incluye presentación/CPU, respeta modos manuales y tiene histéresis.
const crearCalidad=vm.runInNewContext(extraerDeclaracion(fuente,'crearCalidad').texto+';crearCalidad');
function muestras(c,n,datos){for(let i=0;i<n;i++)c.medir(datos);return c.estado();}
assert.equal(muestras(crearCalidad(),20,{gpu:7,fps:30,cpu:3}).nivel,2,'Un límite de presentación a30Hz con GPU/CPU libres conserva detalle');
assert.equal(muestras(crearCalidad(),2,{gpu:20,fps:60,cpu:3}).nivel,1,'Reduce costeGPU antes de perder cuadros');
assert.equal(muestras(crearCalidad(),2,{gpu:5,fps:35,cpu:24}).nivel,1,'También detecta límiteCPU');
assert.equal(muestras(crearCalidad(),10,{gpu:5,fps:10,cpu:3}).nivel,0,'Compositor lento no queda oculto tras una GPUlibre');
assert.equal(muestras(crearCalidad(),10,{gpu:null,fps:10,cpu:3}).nivel,0,'Sin queryGPU también llega al perfilmínimo');
assert.equal(muestras(crearCalidad('3'),30,{gpu:60,fps:10,cpu:30}).nivel,3,'Una calidadmanual no cambia a escondidas');
const recuperacion=crearCalidad();muestras(recuperacion,1,{gpu:70,fps:10,cpu:10});
assert.equal(muestras(recuperacion,22,{gpu:5,fps:60,cpu:3}).nivel,1,'No oscila inmediatamente después de bajar');
assert.equal(muestras(recuperacion,1,{gpu:5,fps:60,cpu:3}).nivel,2,'Recupera tras20muestrasestables');
assert.equal(crearCalidad().estado().pixeles,1600*900);
assert.equal(crearCalidad('0').estado().pixeles,960*540);
assert.equal(crearCalidad('3').estado().pixeles,1920*1080);
const cambios=[];const c={CAPTURA:false,laboratorio:null,EDITOR_CINE:false,document:{hidden:false},pausa:{activa:false},fps:{cpu:2,render:2},medidorGPU:{leer:()=>40},calidad:crearCalidad(),aplicarCalidad:()=>cambios.push(1)};
vm.runInNewContext(extraerDeclaracion(fuente,'ajustarResolucion').texto,c);
for(const bloqueo of ['CAPTURA','laboratorio','EDITOR_CINE']){c[bloqueo]=true;vm.runInNewContext('ajustarResolucion(10)',c);c[bloqueo]=false;}
c.pausa.activa=true;vm.runInNewContext('ajustarResolucion(10)',c);assert.equal(cambios.length,0,'Captura/inspector/editor/pausa no se adaptan');
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

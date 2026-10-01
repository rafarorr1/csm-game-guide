/* Verificar los tamaños enviados al renderizador y al posproceso, sin depender de una GPU. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
function comprobar({ancho=1920,alto=1080,densidad=1,escala=1,captura=false,fija=false},esperado){
  const crearDestino=()=>({setPixelRatio(v){this.dpr=v;},setSize(w,h){this.ancho=Math.floor(w*this.dpr);this.alto=Math.floor(h*this.dpr);}});
  const renderer=crearDestino(),composer=crearDestino(),camara={updateProjectionMatrix(){}};
  const c={esc:{getBoundingClientRect:()=>({width:ancho,height:alto})},laboratorio:fija?{resolucion:{ancho:1920,alto:1080}}:null,devicePixelRatio:densidad,escalaRender:escala,CAPTURA:captura,renderer,composer,camara,escPuntos:{}};
  vm.runInNewContext(extraerDeclaracion(fuente,'medir').texto+';medir();',c);
  for(const destino of [renderer,composer])assert.deepEqual([destino.ancho,destino.alto],esperado);
  assert.equal(camara.aspect,fija?16/9:ancho/alto,'La cámara conserva el encuadre del búfer');
}
for(const densidad of [1,2,3])comprobar({densidad},[1920,1080]);
comprobar({ancho:3840,alto:2160},[1920,1080]);
comprobar({ancho:390,alto:780,densidad:3},[487,975]);
comprobar({escala:.7},[1344,756]);
comprobar({densidad:2,captura:true},[3840,2160]);
comprobar({ancho:892,alto:502,densidad:2,escala:.7,fija:true},[1920,1080]);
comprobar({ancho:390,alto:780,densidad:3,fija:true},[1920,1080]);
console.log('✓ 1080p nativo, límite en 4K/Retina, móvil, adaptación, captura e inspector fijo');

/* Comprueba que ambas manos permanecen sobre el mango durante las poses reales. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const contexto=vm.createContext({console,atob});contexto.window=contexto;
for(const archivo of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','arpg-three-adreida.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(archivo,import.meta.url),'utf8'),contexto);
const {THREE}=contexto.CAOZ_THREE,modelos=contexto.CAOZ_ARPG_MODELOS.fabrica(THREE),m=modelos.crear('adreida');
let maxError=0;
for(const anim of ['quieto','andar','tajoA','revesA','estocadaA','parry','salto','torbellino']){
  for(let i=0;i<=100;i++){
    modelos.posar(m,{anim,k:i/100,t:i/20,fase:i/10,paso:1});m.raiz.updateMatrixWorld(true);
    const apoyo=m.H.manoD.localToWorld(new THREE.Vector3(0,-.3,0)),izquierda=m.H.manoI.getWorldPosition(new THREE.Vector3());
    const error=apoyo.distanceTo(izquierda);maxError=Math.max(maxError,error);
    assert.ok(error<.005,`${anim}, ${i}%: la izquierda se separa ${(error*100).toFixed(2)} cm del mango`);
    for(const lado of ['I','D']){
      const hombro=m.H['brazo'+lado].getWorldPosition(new THREE.Vector3()),mano=m.H['mano'+lado].getWorldPosition(new THREE.Vector3());
      assert.ok(hombro.distanceTo(mano)<m.p.brazo+m.p.antebrazo,`${anim}: brazo ${lado} sobreextendido`);
    }
  }
}
console.log(`808 poses: agarre continuo; separación máxima ${(maxError*1000).toFixed(3)} mm.`);

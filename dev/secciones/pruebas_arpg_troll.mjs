/* Modelo del jefe: altura real y poses válidas sin necesitar una GPU. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console});c.window=c;
for(const archivo of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(archivo,import.meta.url),'utf8'),c);
const THREE=c.CAOZ_THREE.THREE,modelos=c.CAOZ_ARPG_MODELOS.fabrica(THREE);
for(const tipo of ['troll','cobrador']){
  const m=modelos.crear(tipo),caja=new THREE.Box3().setFromObject(m.raiz);
  if(tipo==='troll'){assert.equal(m.alto,3);assert.ok(Math.abs(caja.max.y-3)<.01,'La coronilla queda a tres metros del suelo');assert.ok(caja.max.x-caja.min.x>1,'El troll tiene una silueta ancha');}
  for(const anim of ['andar','aviso','golpe','cargaMazazo','mazazo','preparaGoblin','arrojaGoblin','muerte'])for(let i=0;i<=50;i++){
    modelos.posar(m,{anim,k:i/50,t:i/10,fase:i/5,paso:1});m.raiz.updateMatrixWorld(true);
    for(const hueso of Object.values(m.H))assert.ok(hueso.matrixWorld.elements.every(Number.isFinite),`${tipo}: pose ${anim} válida`);
  }
}
console.log('Troll de tres metros y cobradores: geometría y poses correctas.');

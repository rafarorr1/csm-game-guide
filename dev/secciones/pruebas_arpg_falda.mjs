/* La falda acompaña al esqueleto sin añadir mallas ni huesos inválidos. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const run=s=>vm.runInContext(s,c);
run("const M=CAOZ_ARPG_MODELOS.fabrica(CAOZ_THREE.THREE),h=M.crear('adreida');");
assert.equal(run("Object.keys(h.H).filter(k=>k.startsWith('falda')).length"),7);
assert.equal(run('h.mallas.length'),3);
assert.ok(run('h.mallas.every(m=>Array.from(m.geometry.attributes.skinIndex.array).every(i=>i<m.skeleton.bones.length))'));
for(const anim of ['andar','tajoA','revesA','estocadaA','salto','esquiva']){
  for(let i=0;i<=20;i++){
    run(`M.posar(h,{anim:'${anim}',t:${i/60},k:${i/20},fase:${i/20*Math.PI*2},paso:1,potencia:1});h.raiz.updateMatrixWorld(true);`);
    assert.ok(run('Object.values(h.H).every(b=>b.matrixWorld.elements.every(Number.isFinite))'),anim);
    assert.ok(run('h.tela.aperturas.every(x=>x>=0&&x<=1.2)'),anim);
  }
}
run("M.posar(h,{anim:'andar',t:2,fase:Math.PI/2,paso:1});const aperturaMax=Math.max(...h.tela.aperturas);M.posar(h,{anim:'quieto',t:2.016,paso:0});");
assert.ok(run('aperturaMax>.15'),'Los paños se abren ante las piernas');
assert.ok(run('Math.max(...h.tela.aperturas)>.04'),'La tela tarda en volver al reposo');
for(let i=1;i<=90;i++)run(`M.posar(h,{anim:'quieto',t:${2.016+i/60},paso:0})`);
assert.ok(run('Math.max(...h.tela.aperturas)<.05'),'El movimiento se amortigua');
console.log('✓ Siete paños, tres mallas, skinning válido, apertura y retorno amortiguado en las poses de Adreida');

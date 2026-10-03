/* Prueba focalizada del FBX en el visor; las animaciones de combate no se reemplazan. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const c=vm.createContext({console,atob});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const visor=fs.readFileSync(new URL('modelos-visor.js',import.meta.url),'utf8');
vm.runInContext(extraerDeclaracion(visor,'caidaGoblinImportada','const').texto+';'+extraerDeclaracion(visor,'crearReproductorCaidaGoblin').texto+';this.clip=caidaGoblinImportada;',c);
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),posar=c.crearReproductorCaidaGoblin(T,F,c.clip),v=new T.Vector3();
assert.equal(c.clip.duracion,2.2);assert.equal(c.clip.muestras,67);
const foto=m=>Object.values(m.H).flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]);
let minimo=Infinity,maximo=-Infinity,poses=0;
for(const varianteGoblin of Object.keys(F.VARIANTES_GOBLIN)){
  const m=F.crear('goblin',{varianteGoblin}),compartido=F.crear('goblin',{varianteGoblin}),original=m.mallas[0].geometry,pesos=original.attributes.skinWeight.array.slice(),tri=original.index.count;
  let antes=null,geometria=null;
  for(let i=0;i<=180;i++){
    posar(m,i/180);m.raiz.updateMatrixWorld(true);poses++;
    geometria??=m.mallas[0].geometry;assert.equal(m.mallas[0].geometry,geometria,'Reutiliza la geometría corregida');
    const p=m.H.cuerpo.position.clone();if(antes)assert(p.distanceTo(antes)<.085,'Sin saltos de raíz al caer');antes=p;
    let min=Infinity,max=-Infinity;
    for(const mesh of m.mallas){const g=mesh.geometry,indices=g.index?[...new Set(g.index.array)]:Array.from({length:g.attributes.position.count},(_,j)=>j);
      for(const j of indices){mesh.getVertexPosition(j,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<2.5,'Piel sin vértices disparados');min=Math.min(min,v.y);max=Math.max(max,v.y);}
    }
    minimo=Math.min(minimo,min);maximo=Math.max(maximo,min);
    assert(min>-.015&&min<.035,`${varianteGoblin}, fase ${i/180}: contacto ${min}`);
    if(i===180)assert(max<.65,'Termina tumbado');
  }
  const final=foto(m);posar(m,12);assert.deepEqual(foto(m),final,'Retiene la pose final');
  assert.equal(original.index.count,tri);assert.deepEqual(original.attributes.skinWeight.array,pesos,'No modifica pesos compartidos');assert.equal(compartido.mallas[0].geometry,original);
  for(let i=0;i<geometria.attributes.skinWeight.count;i++){const w=geometria.attributes.skinWeight.array.subarray(i*4,i*4+4);assert(Math.abs(w.reduce((s,v)=>s+v,0)-1)<1e-5,'Pesos normalizados');}
  posar.restablecer(m);assert.equal(m.mallas[0].geometry,original,'Restaura la malla al salir de la prueba');F.posar(m,{anim:'quieto',t:0});assert(Math.abs(m.H.cuerpo.position.z)<1e-6);
  // Puede entrar después de una muerte partida y después volver a las animaciones actuales.
  F.posar(m,{anim:'muerte',k:1,muerte:{...F.crearMuerteGoblin('cargado',0),partido:true}});
  posar(m,.4);assert.equal(m.mallas[0].geometry,geometria);
  posar.restablecer(m);F.posar(m,{anim:'andar',fase:.5,paso:1,t:0});assert.equal(m.mallas[0].geometry,original);
}
for(const f of ['arpg-three-mesa.js','arpg-three.html','arpg-three-exportar.mjs'])assert(!fs.readFileSync(new URL(f,import.meta.url),'utf8').includes('caidaGoblinImportada'),'La prueba no se carga durante el juego');
console.log(`✓ Falling Back Death: ${poses} poses, cuatro variantes, suelo ${minimo.toFixed(4)}…${maximo.toFixed(4)} m, final inmóvil, mallas compartidas intactas y restauración tras cortes.`);

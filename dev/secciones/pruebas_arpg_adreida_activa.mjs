/* La partida usa la Adreida aprobada; los prototipos facial y de brazos quedan fuera. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {recursosAdreida,entornoArpgThree} from './arpg-three-exportar.mjs';
const archivo=n=>new URL(n,import.meta.url),c=vm.createContext({console,atob});c.window=c;
const prototipo=/adreida-brazos-rigged\/|adreida-rostro\/|arpg-three-rostro-adreida\.js/;
for(const nombre of ['arpg-three.html','modelos-visor.html']){
  const html=fs.readFileSync(archivo(nombre),'utf8'),scripts=Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g),m=>m[1]);
  assert(scripts.some(s=>s.includes('adreida-piernas-scenario/datos.js')),nombre+': carga el cuerpo aprobado con piernas');
  assert(!scripts.some(s=>prototipo.test(s)),nombre+': no activa los prototipos descartados');
}
assert(recursosAdreida.includes('adreida-piernas-scenario/datos.js'));
assert(!entornoArpgThree.some(s=>prototipo.test(s)),'La publicación no transporta los prototipos inactivos');
for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js','adreida-piernas-scenario/datos.js','arpg-three-adreida.js','hacha-adreida-scenario/datos.js','arpg-three-hacha-adreida.js','arpg-three-modelos.js','arpg-three-adreida-cine.js'])vm.runInContext(fs.readFileSync(archivo(f),'utf8'),c,{filename:f});
const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),d=c.CAOZ_ADREIDA_PIERNAS_DATOS;
assert.equal(m.rostro,null,'El rostro anterior permanece dentro del cuerpo de Scenario');
assert(!d.brazosRigged,'Se usan los brazos modulares aprobados');
assert.equal(d.dedos.length,20,'Se restaura el rig aprobado de manos');
assert.equal(m.mallas.length,2,'Cuerpo completo y hacha, sin mallas faciales adicionales');
assert.equal(m.mallas[0].geometry.attributes.position.count,42327);
assert.equal(m.mallas[0].geometry.index.count/3,61204,'El cuerpo conserva la cara original sin recortar sus triángulos');
assert.equal(m.mallas.reduce((s,x)=>s+x.geometry.index.count/3,0),65494);
const indices=Uint16Array.from(new Uint16Array(Uint8Array.from(Buffer.from(d.triangulos,'base64')).buffer));
assert.deepEqual(Array.from(m.mallas[0].geometry.index.array),Array.from(indices),'La geometría activa usa todos los triángulos aprobados');
const antes=m.mallas[0].geometry.attributes.position.array.slice(),pose={anim:'quieto',mezclar:false};F.posar(m,pose);
for(const canal of ['quieto','andar','tajoA','parry']){F.posar(m,{...pose,anim:canal,k:.5,paso:1,fase:1});assert.equal(m.rostro,null);}
assert.deepEqual(m.mallas[0].geometry.attributes.position.array,antes,'Posar no modifica la geometría compartida');
const fps=c.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,F).crearFPS();assert.equal(fps.rostro,null);assert(fps.mallas[0].geometry.index.count>0,'El POV conserva brazos con el rig anterior');
// Los originales de investigación siguen disponibles para reproducir sus pruebas explícitas.
for(const f of ['adreida-brazos-rigged/datos.js','adreida-rostro/datos.js','pruebas_arpg_brazos_importados.mjs','pruebas_arpg_rostro_adreida.mjs'])assert(fs.existsSync(archivo(f)),'Se conserva el prototipo: '+f);
console.log('✓ Adreida activa: cabeza original, brazos Scenario, piernas aprobadas, 20 falanges, 65.494 triángulos y dos mallas; prototipos conservados fuera de juego/publicación.');

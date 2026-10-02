/* La textura sólo cubre piel biológica; se comparte entre enemigos y conserva las UV del cuaderno. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {exportar,texturasGoblin} from './arpg-three-exportar.mjs';
const c=vm.createContext({URL,document:{currentScript:{src:'http://127.0.0.1:8887/dev/secciones/arpg-three-modelos.js'}}});c.window=c;
vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
const THREE={...c.CAOZ_THREE.THREE},solicitudes=[];THREE.TextureLoader=class{load(url){solicitudes.push(url);return new THREE.Texture();}};
for(const f of ['arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),a=F.crear('goblin'),b=F.crear('goblin'),cobrador=F.crear('cobrador');
assert.equal(solicitudes.length,3,'Toda la horda comparte tres cargas de imagen');
for(const campo of ['map','normalMap','roughnessMap']){assert.equal(a.M.piel[campo],b.M.piel[campo]);assert.equal(a.M.piel[campo],cobrador.M.piel[campo]);}
assert.equal(a.M.piel.map.colorSpace,THREE.SRGBColorSpace);assert.equal(a.M.piel.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(a.M.piel.roughnessMap.colorSpace,THREE.NoColorSpace);
const atlas=JSON.parse(fs.readFileSync(new URL('arte-goblin/goblin-uv-v2.json',import.meta.url))),ids=new Set(['01','02','03','04','05','12','21','22','24','26','27','29','31','32','36','37']);
const malla=a.mallas.find(m=>m.material===a.M.piel),mapa=atlas.mallas.find(m=>m.material==='piel'),g=malla.geometry.attributes;
assert.equal(crypto.createHash('sha256').update(Buffer.from(g.position.array.buffer)).digest('hex'),mapa.huella,'No cambia el modelo ni el orden de vértices del cuaderno');
for(let i=0;i<g.position.count;i+=3){const u=(mapa.uv[i*2]+mapa.uv[(i+1)*2]+mapa.uv[(i+2)*2])/3,v=(mapa.uv[i*2+1]+mapa.uv[(i+1)*2+1]+mapa.uv[(i+2)*2+1])/3;
 const pieza=atlas.piezas.find(p=>{const [x,y,w,h]=p.celda;return u*4096>=x&&u*4096<x+w&&(1-v)*4096>=y&&(1-v)*4096<y+h;});assert.ok(pieza);
 for(let j=0;j<3;j++)assert.equal(g.pielReal.getX(i+j),ids.has(pieza.id)?1:0,pieza.nombre+': máscara incorrecta');
}
for(const m of [a,b,cobrador]){assert.equal(m.mallas.length,3);assert.equal(m.M.metal.map,null);assert.equal(m.M.brillo.map,null);assert.equal(m.M.piel.displacementMap,null);assert.ok(m.mallas[0].geometry.attributes.uv.array.every(Number.isFinite));}
for(const tipo of ['adreida','mohamed','can','kobold','troll','saqueador']){const m=F.crear(tipo);assert.equal(m.M.piel.map,null);assert.ok(m.mallas.every(mesh=>!mesh.geometry.attributes.pielReal));}
const pintar=c.CAOZ_ARPG_MODELOS.fabrica(THREE,{pielGoblin:false}).crear('goblin');assert.equal(pintar.M.piel.map,null);assert.equal(solicitudes.length,3,'El cuaderno no carga ni sustituye la ilustración con otra piel');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arpg-piel-'));try{const datos=exportar(dir);for(const f of texturasGoblin){assert.ok(fs.readFileSync(path.join(dir,f)).equals(fs.readFileSync(new URL(f,import.meta.url))));assert.ok(datos.entorno[f]);}}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('✓ Piel: 16 piezas exactas, ropa y armas intactas, tres texturas compartidas, geometría/UV v2 intactas y recursos incluidos en la exportación');

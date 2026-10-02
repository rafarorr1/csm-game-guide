/* Piel, ropa, hoja y mango tienen máscaras separadas y mapas compartidos; conservan el cuaderno. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {exportar,texturasGoblin} from './arpg-three-exportar.mjs';
const c=vm.createContext({URL,document:{currentScript:{src:'http://127.0.0.1:8887/dev/secciones/arpg-three-modelos.js'}}});c.window=c;
vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
const THREE={...c.CAOZ_THREE.THREE},solicitudes=[];THREE.TextureLoader=class{load(url){solicitudes.push(url);return new THREE.Texture();}};
for(const f of ['arpg-three-adreida-animacion.js','arpg-three-modelos.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
const F=c.CAOZ_ARPG_MODELOS.fabrica(THREE),a=F.crear('goblin'),b=F.crear('goblin'),cobrador=F.crear('cobrador');
assert.equal(solicitudes.length,12,'Toda la horda comparte los tres mapas de piel, ropa, hoja y mango');
const tela=new Set(['06','11','14','15','16','17','23','28']),tenida=new Set(['14','15']);
const shaders=[a,b,cobrador].map(m=>{const sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.M.piel.onBeforeCompile(sh);return sh;});
for(const nombre of ['telaColor','telaNormal','telaSuperficie','maderaColor','maderaNormal','maderaSuperficie']){const mapa=shaders[0].uniforms[nombre].value;for(const sh of shaders)assert.equal(sh.uniforms[nombre].value,mapa,'Material compartido entre goblin y cobrador');assert.equal(mapa.colorSpace,nombre.endsWith('Color')?THREE.SRGBColorSpace:THREE.NoColorSpace);}
for(const campo of ['map','normalMap','roughnessMap']){assert.equal(a.M.piel[campo],b.M.piel[campo]);assert.equal(a.M.piel[campo],cobrador.M.piel[campo]);}
assert.equal(a.M.piel.map.colorSpace,THREE.SRGBColorSpace);assert.equal(a.M.piel.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(a.M.piel.roughnessMap.colorSpace,THREE.NoColorSpace);
const atlas=JSON.parse(fs.readFileSync(new URL('arte-goblin/goblin-uv-v2.json',import.meta.url))),ids=new Set(['01','02','03','04','05','12','21','22','24','26','27','29','31','32','36','37']);
const malla=a.mallas.find(m=>m.material===a.M.piel),mapa=atlas.mallas.find(m=>m.material==='piel'),g=malla.geometry.attributes;
assert.equal(crypto.createHash('sha256').update(Buffer.from(g.position.array.buffer)).digest('hex'),mapa.huella,'No cambia el modelo ni el orden de vértices del cuaderno');
for(let i=0;i<g.position.count;i+=3){const u=(mapa.uv[i*2]+mapa.uv[(i+1)*2]+mapa.uv[(i+2)*2])/3,v=(mapa.uv[i*2+1]+mapa.uv[(i+1)*2+1]+mapa.uv[(i+2)*2+1])/3;
 const pieza=atlas.piezas.find(p=>{const [x,y,w,h]=p.celda;return u*4096>=x&&u*4096<x+w&&(1-v)*4096>=y&&(1-v)*4096<y+h;});assert.ok(pieza);
 for(let j=0;j<3;j++){assert.equal(g.pielReal.getX(i+j),ids.has(pieza.id)?1:0,pieza.nombre+': máscara de piel incorrecta');assert.equal(g.telaReal.getX(i+j),tela.has(pieza.id)?(tenida.has(pieza.id)?2:1):0,pieza.nombre+': máscara de ropa incorrecta');assert.equal(g.maderaReal.getX(i+j),pieza.id==='20'?1:0,pieza.nombre+': máscara de madera incorrecta');}
}
for(const m of [a,b,cobrador]){assert.equal(m.mallas.length,3);assert.equal(m.M.metal.map,a.M.metal.map);assert.equal(m.M.brillo.map,null);assert.equal(m.M.piel.displacementMap,null);assert.ok(m.mallas[0].geometry.attributes.uv.array.every(Number.isFinite));}
for(const tipo of ['adreida','mohamed','can','kobold','troll','saqueador']){const m=F.crear(tipo);assert.equal(m.M.piel.map,null);assert.ok(m.mallas.every(mesh=>!mesh.geometry.attributes.pielReal));}
// La pintura oxidada sólo cubre los 36 vértices de la hoja, nunca la moneda del cobrador.
for(const m of [a,b,cobrador]){
 const metal=m.mallas.find(mesh=>mesh.material===m.M.metal),geo=metal.geometry.attributes;
 for(const campo of ['map','normalMap','roughnessMap','metalnessMap'])assert.equal(m.M.metal[campo],a.M.metal[campo]);
 assert.equal(m.M.metal.map.colorSpace,THREE.SRGBColorSpace);assert.equal(m.M.metal.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(m.M.metal.roughnessMap.colorSpace,THREE.NoColorSpace);
 assert.equal(m.M.metal.roughnessMap,m.M.metal.metalnessMap,'Oclusión, rugosidad y metalicidad comparten imagen');
 assert.equal(Array.from(geo.hachaReal.array).filter(x=>x===1).length,36,'Sólo la caja de la hoja recibe óxido');
 const mano=metal.skeleton.bones.indexOf(m.H.manoD);
 for(let i=0;i<geo.position.count;i++)assert.equal(geo.hachaReal.getX(i),geo.skinIndex.getX(i)===mano?1:0);
 for(const anim of ['quieto','andar','golpe']){
  F.posar(m,{anim,t:0,k:.55,fase:0,paso:1,mezclar:false});m.raiz.updateMatrixWorld(true);
  const filo=new THREE.Vector3(0,1,0).transformDirection(m.H.manoD.matrixWorld);
  assert.ok(filo.z>.4,anim+': el filo mira al frente en reposo, al caminar y al conectar el golpe');
 }
}
// El cobrador comparte el mango, pero su bolsa, ropa y piel no reciben madera.
const cuerpoCobrador=cobrador.mallas.find(m=>m.material===cobrador.M.piel).geometry.attributes;
assert.equal(Array.from(cuerpoCobrador.maderaReal.array).filter(x=>x===1).length,120);
assert.equal(Array.from(g.maderaReal.array).filter(x=>x===1).length,120);
assert.equal(a.M.piel.metalness,0,'La madera no hereda la metalicidad de la hoja');
const pintar=c.CAOZ_ARPG_MODELOS.fabrica(THREE,{pielGoblin:false}).crear('goblin');assert.equal(pintar.M.piel.map,null);assert.equal(pintar.M.metal.map,null);assert.equal(solicitudes.length,12,'El cuaderno no carga ni sustituye la ilustración con otra piel');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arpg-piel-'));try{const datos=exportar(dir);for(const f of texturasGoblin){assert.ok(fs.readFileSync(path.join(dir,f)).equals(fs.readFileSync(new URL(f,import.meta.url))));assert.ok(datos.entorno[f]);}}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('✓ Goblins: 16 piezas de piel y 8 de ropa, tinte del pañuelo, doce mapas compartidos, mango de madera, hoja oxidada hacia delante y moneda intacta, geometría/UV v2 conservadas y exportación completa');

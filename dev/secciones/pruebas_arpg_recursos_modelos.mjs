/* Repetir bajas no debe retener las reservas de cada actor ni romper los atlas compartidos. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';

const contexto=vm.createContext({console,atob});contexto.window=contexto;
for(const archivo of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','goblin-scenario/datos.js','arpg-three-goblin.js','kobold-scenario/datos.js','arpg-three-kobold.js','arpg-three-modelos.js']){
  vm.runInContext(fs.readFileSync(new URL(archivo,import.meta.url),'utf8'),contexto);
}
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
vm.runInContext(extraerDeclaracion(fuente,'liberarModeloTroll','function').texto,contexto);
const {THREE}=contexto.CAOZ_THREE,modelos=contexto.CAOZ_ARPG_MODELOS.fabrica(THREE),escena=new THREE.Scene();
const hitbox=new THREE.MeshBasicMaterial({visible:false});hitbox.userData.compartida=true;
const atlas=new THREE.Texture();let descartesCompartidos=0,descartesAtlas=0,liberados=0;
hitbox.addEventListener('dispose',()=>descartesCompartidos++);atlas.addEventListener('dispose',()=>descartesAtlas++);
const compartidas=new Set();
const casos=[['goblin',{varianteGoblin:'clasico'}],['goblin',{varianteGoblin:'dosHachas'}],['goblin',{varianteGoblin:'cuchillo'}],['goblin',{varianteGoblin:'antorcha'}],['cobrador',{}],['kobold',{varianteKobold:'rojizo'}],['kobold',{varianteKobold:'capucha'}],['kobold',{varianteKobold:'acorazado'}],['kobold',{varianteKobold:'huesos'}],['troll',{}]];
for(let vuelta=0;vuelta<5;vuelta++)for(const [tipo,opciones]of casos){
  const modelo=modelos.crear(tipo,opciones);escena.add(modelo.raiz);
  modelo.raiz.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),hitbox));
  const propios=new Set(),esqueletos=new Set();
  modelo.raiz.traverse(n=>{
    if(n.skeleton)esqueletos.add(n.skeleton);
    if(n.geometry){if(n.geometry.userData.compartida){
      if(!compartidas.has(n.geometry)){compartidas.add(n.geometry);n.geometry.addEventListener('dispose',()=>descartesCompartidos++);}
    }else propios.add(n.geometry);}
    for(const material of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){
      if(material!==hitbox){material.map=atlas;propios.add(material);}
    }
  });
  // La textura de huesos se reserva en el primer dibujo; también debe liberarse.
  for(const esqueleto of esqueletos){esqueleto.computeBoneTexture();propios.add(esqueleto.boneTexture);}
  const descartes=new Map([...propios].map(recurso=>[recurso,0]));
  for(const recurso of propios)recurso.addEventListener('dispose',()=>descartes.set(recurso,descartes.get(recurso)+1));
  contexto.liberarModeloTroll(modelo);contexto.liberarModeloTroll(modelo);
  assert.equal(modelo.raiz.parent,null,'La baja sale de la escena');
  assert.ok([...descartes.values()].every(n=>n===1),tipo+': cada reserva propia se libera una sola vez');
  assert.ok([...esqueletos].every(e=>e.boneTexture===null),'La paleta de huesos deja de ocupar una textura');
  assert.equal(descartesCompartidos,0,'La siguiente oleada conserva las geometrías y el material de colisión compartidos');
  assert.equal(descartesAtlas,0,'Destruir un actor no destruye sus atlas compartidos');
  liberados++;
}
assert.equal(escena.children.length,0);
assert.ok(compartidas.size>=5,'La regresión usa mallas reales de Scenario, no sólo modelos de prueba');
console.log(`✓ ${liberados} actores: reservas propias liberadas, eliminación idempotente y atlas/geometrías compartidos intactos`);

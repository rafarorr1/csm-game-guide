import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {extraerDeclaracion} from './fuentes.mjs';
const s=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8'),c=vm.createContext({console});c.window=c;
vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
vm.runInContext(`const V3=CAOZ_THREE.THREE.Vector3,heroe={pos:new V3(0,0,1),radio:.4,vivo:true,invul:0};const jugadores=[heroe],conHeroe=(h,fn)=>fn();let defensa=null,dano=0,parrys=0;
const cambiar=(e,s)=>e.estado=s,enZona=()=>true,parar=()=>defensa,herir=d=>dano+=d,bloqueado=d=>dano+=d*.3,temblar=()=>{},cancelarAtaque=()=>{},esquivado=()=>{};
const parryPerfecto=()=>parrys++;
${extraerDeclaracion(s,'resolverAtaque','function').texto}
function ataque(){return {pos:new V3(),tipo:'saqueador',escudazo:true,ataques:0,ataque:{forma:'cono',dano:14}};}`,c);
const run=s=>vm.runInContext(s,c);
run('resolverAtaque(ataque())');assert.equal(run('dano'),14);assert.equal(run('heroe.retroceso.z'),10);
run("heroe.retroceso=null;dano=0;defensa='perfecto';resolverAtaque(ataque())");assert.equal(run('dano'),0);assert.equal(run('parrys'),1);assert.equal(run('heroe.retroceso'),null);
run("defensa=null;heroe.invul=1;resolverAtaque(ataque())");assert.equal(run('dano'),0);assert.equal(run('heroe.retroceso'),null);
console.log('✓ Escudazo causa empuje frontal; parry perfecto y dash evitan daño y desplazamiento');

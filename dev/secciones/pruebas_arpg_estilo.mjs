/* Combo, tiempo y puntuación: incluye la función real que resuelve el daño. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const leer=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8'),c=vm.createContext({console});c.window=c;
for(const f of ['arpg-three-estilo.js','visor-three-vendor.js'])vm.runInContext(leer(f),c);
const {crear,RANGOS,PUNTOS}=c.CAOZ_ARPG_ESTILO;
for(const hz of [20,30,60,120,144]){
  const s=crear();assert.equal(s.estado().multiplicador,0);
  s.impacto(10,{tipo:'goblin',baja:true});assert.equal(s.estado().puntos,100);
  for(let i=0;i<3*hz-1;i++)s.paso(1/hz);assert.equal(s.estado().multiplicador,1);
  s.paso(1/hz);assert.equal(s.estado().multiplicador,0,'Caduca exactamente a los tres segundos');assert.equal(s.estado().puntos,100);
  s.impacto(10);s.paso(2.9);s.impacto(10);s.paso(.2);assert.equal(s.estado().golpes,2,'Cada impacto real renueva la ventana');
  s.paso(0);s.paso(NaN);s.paso(-1);assert.equal(s.estado().golpes,2);
}
const s=crear();for(let n=1;n<=40;n++){s.impacto(1);for(const r of RANGOS)if(n===r.golpes){assert.equal(s.estado().rango,r.rango);assert.equal(s.estado().multiplicador,r.multiplicador);}}
assert.equal(s.estado().multiplicador,8);s.impacto(10,{tipo:'troll',baja:true});assert.equal(s.estado().puntos,PUNTOS.troll*8);
s.paso(3);s.impacto(10,{tipo:'goblin',baja:true,directo:false});assert.equal(s.estado().puntos,PUNTOS.troll*8+100);assert.equal(s.estado().multiplicador,0,'Adreidos no mantiene la cadena solo');
s.reiniciar();assert.equal(s.estado().puntos,0);assert.equal(s.estado().mejor,0);
const T=c.CAOZ_THREE.THREE;c.estilo=crear();c.heroe={pos:new T.Vector3(),dir:0};c.reloj={t:0};c.rnd=()=>.5;
c.activarFaseTroll=()=>{};c.blindadoTroll=e=>e.blindado;c.numero=()=>{};c.frente=()=>new T.Vector3(0,0,1);c.morir=e=>{e.estado='muere';};
vm.runInContext(extraerDeclaracion(leer('arpg-three-mesa.js'),'danar').texto,c);
const blanco=()=>({estado:'persigue',tipo:'goblin',vida:30,pos:new T.Vector3(0,0,2),m:{alto:1},emp:new T.Vector3(),d:{aguante:true},provocado:0});
const e=blanco();e.blindado=true;c.danar(e,5,{exacto:true});assert.equal(c.estilo.estado().golpes,0);
e.blindado=false;c.danar(e,0,{exacto:true});assert.equal(c.estilo.estado().golpes,0);
c.danar(e,5,{exacto:true});c.danar(e,5,{exacto:true});assert.equal(c.estilo.estado().puntos,0,'Golpear alimenta la cadena; sólo las bajas dan puntos');
c.danar(e,99,{exacto:true});assert.equal(c.estilo.estado().puntos,150,'La baja usa el rango alcanzado por su propio golpe');
c.danar(e,99,{exacto:true});assert.equal(c.estilo.estado().puntos,150,'No puntúa un cadáver');
c.estilo.paso(3);c.danar(blanco(),99,{exacto:true,causa:'adreidos'});assert.equal(c.estilo.estado().puntos,250);assert.equal(c.estilo.estado().multiplicador,0);
c.estilo.reiniciar();c.heroe.id=0;c.danar(blanco(),99,{exacto:true});c.heroe.id=1;c.danar(blanco(),99,{exacto:true});assert.equal(c.estilo.estado().golpes,2,'Ambos jugadores alimentan la misma cadena');assert.equal(c.estilo.estado().puntos,200);
c.pausa={activa:true};c.rog={abierto:false};c.leerPausaMando=()=>{};c.mandoDestino=()=>{};
vm.runInContext(extraerDeclaracion(leer('arpg-three-mesa.js'),'paso').texto,c);
c.estilo.impacto(1);const tiempo=c.estilo.estado().restante;c.paso(2);assert.equal(c.estilo.estado().restante,tiempo,'La pausa real congela el contador');
c.pausa.activa=false;c.rog.abierto=true;c.paso(2);assert.equal(c.estilo.estado().restante,tiempo,'El diálogo de cartas congela el contador');
console.log('✓ Estilo: rangos D–SSS, puntos por baja, ventana exacta de 3 s a 20–144 FPS, pausa, reinicio, inmunidad, cadáveres y Adreidos.');

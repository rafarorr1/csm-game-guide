/* Azar, riesgos y transición real del nivel, sin GPU ni red. */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const get=(n,t='function')=>extraerDeclaracion(fuente,n,t).texto;
const c=vm.createContext({console,crypto:webcrypto});c.window=c;
vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
vm.runInContext(get('DESTINO','const')+'\n'+get('rog','const'),c);const run=s=>vm.runInContext(s,c);
for(let i=0;i<200;i++){const deck=run('DESTINO.repartir()');assert.equal(deck.length,3);assert.equal(new Set(deck.map(c=>c.id)).size,3);assert.deepEqual(deck.map(c=>c.min).sort((a,b)=>a-b).join(','),'11,17,19');}
run("var carta={id:'mazo',stat:'basicos',min:17,bueno:50,malo:-10};var efectos=[];");
for(let d=1;d<=20;d++){const r=run(`DESTINO.resolver([],carta,${d})`);assert.equal(r.tipo,d===1?'critico':d>=17?'beneficio':'riesgo');}
run('efectos=DESTINO.resolver([],carta,17).efectos;efectos=DESTINO.resolver(efectos,carta,2).efectos;');
assert.equal(run('DESTINO.factores(efectos).basicos'),1.35);
run('efectos=DESTINO.resolver(efectos,carta,1).efectos;');assert.equal(run('DESTINO.factores(efectos).basicos'),.9);
assert.throws(()=>run('DESTINO.resolver([],carta,21)'));
console.log('✓ Tres cartas únicas, riesgos distintos, 20 resultados exactos, acumulación y pérdida de todos los positivos');
vm.runInContext(`
const V3=CAOZ_THREE.THREE.Vector3,heroe={vivo:true,pos:new V3(),alma:60,almaMax:120,atq:12,vatq:1,botin:[],llaves:0},tipoHeroe='adreida',HEROES={adreida:{alma:120}};
const elementos=new Map(),$=id=>{if(!elementos.has(id))elementos.set(id,{innerHTML:'',appendChild(){},focus(){},close(){}});return elementos.get(id);};
const document={createElement:()=>({})},reloj={t:1},CARDS={mazo:{n:'Mazo'}},EDICIONES={normal:{nombre:'Normal'}};
const tostada=()=>{},chispas=()=>{},banner=()=>{},rnd=()=>.5,CALLES=[0,1,2],R=15.5,calle=a=>new V3(a,0,1),CAPTURA=false,q={get:()=>null};
const enemigos=[],peligrosTroll=[],soltadas=[],botines=[];const DEF={goblin:{},troll:{jefe:true},cobrador:{},kobold:{},can:{jefe:true}};
function crearEnemigo(tipo,x,z){enemigos.push({tipo,estado:'persigue'});}
function soltar(id,ed,x,z,desde,contrato){soltadas.push(contrato);}
function abrirDestino(){rog.abierto=true;}
${get('OLEADAS','const')}
${get('ol','const')}
${['iniciarDestino','soltarDestino','aplicarDestino','recoger','pasoOleadas'].map(n=>get(n)).join('\n')}
`,c);
run('iniciarDestino(1);soltarDestino(heroe.pos);soltarDestino(heroe.pos);soltarDestino(heroe.pos);soltarDestino(heroe.pos);');assert.equal(run('soltadas.length'),3);
run("var b={id:'mazo',ed:'normal',listo:true,recogida:false,g:{position:new V3()},bono:{atq:90,alma:30,vel:50,texto:'Pendiente'},contrato:{...carta},miniatura:'carta'};recoger(b);recoger(b);");
assert.equal(run('rog.mano.length'),1);assert.equal(run('heroe.atq'),12);assert.equal(run('heroe.almaMax'),120);assert.equal(run('heroe.vatq'),1);
run('ol.i=3;ol.auto=true;ol.cola=[];ol.descanso=null;pasoOleadas(20);');assert.equal(run('ol.i'),3);assert.equal(run('rog.abierto'),false);
run('rog.mano=[carta,carta,carta];pasoOleadas(20);');assert.equal(run('rog.abierto'),true);assert.equal(run('ol.i'),3);
run('rog.abierto=false;rog.terminado=3;ol.descanso=.01;pasoOleadas(.02);');assert.equal(run('ol.i'),4);assert.equal(run('rog.mano.length'),0);assert.equal(run('rog.nivel'),2);
run('ol.i=4;ol.cola=[];ol.descanso=.01;enemigos.length=0;pasoOleadas(.02);');assert.equal(run('ol.i'),5);assert.equal(run('rog.abierto'),false);
run("rog.efectos=[{stat:'vida',valor:25,positivo:true},{stat:'basicos',valor:50,positivo:true},{stat:'dash',valor:-30,positivo:true}];heroe.alma=60;heroe.almaMax=120;aplicarDestino();");assert.equal(run('heroe.almaMax'),150);assert.equal(run('heroe.alma'),75);assert.equal(run('heroe.basicos'),1.5);assert.equal(run('heroe.dash'),.7);
console.log('✓ Tres drops, recoger no mejora estadísticas, elección sólo entre niveles y efectos aplicados sin curación gratuita');

// Un doble clic no vuelve a tirar. Continuar tras el ogro conserva efectos y abre otra vuelta.
vm.runInContext(`
function pintarDestino(){};const ent={},teclas={clear(){}},mando={};function quitarBotin(){};
${get('tirarDestino')}
${get('seguirDestino')}
`,c);
run('rog.abierto=true;rog.resuelto=false;rog.mano=[carta];rog.elegida=0;tirarDestino();var trasTirada=JSON.stringify(rog.efectos);tirarDestino();');
assert.equal(run('JSON.stringify(rog.efectos)'),run('trasTirada'));
run('ol.i=OLEADAS.length-1;seguirDestino();');
assert.equal(run('rog.vuelta'),2);assert.equal(run('ol.i'),-1);assert.equal(run('rog.abierto'),false);assert.equal(run('JSON.stringify(rog.efectos)'),run('trasTirada'));
console.log('✓ Una tirada por elección y nueva vuelta con efectos conservados');

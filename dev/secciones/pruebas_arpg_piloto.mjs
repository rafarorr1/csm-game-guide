/* Piloto con locomoción, esquiva, colisiones, navegación y resolución reales.
   Los dobles sustituyen sólo efectos, modelos y la contabilidad del daño. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('./arpg-three-mesa.js',import.meta.url),'utf8');
const extraer=(nombre,tipo='function')=>extraerDeclaracion(nombre==='libre'?fuente.slice(fuente.indexOf('const libre=()=>')):fuente,nombre,tipo).texto;
const c=vm.createContext({console,tutorial:null,enTutorial:()=>false});c.window=c;
for(const f of ['visor-three-vendor.js','arpg-three-adreida-animacion.js'])vm.runInContext(fs.readFileSync(new URL(f,import.meta.url),'utf8'),c);
c.MOD={animacion:c.CAOZ_ARPG_ADREIDA_ANIMACION.fabrica(c.CAOZ_THREE.THREE)};
vm.runInContext(`
const V3=CAOZ_THREE.THREE.Vector3,TAU=Math.PI*2,enemigos=[],botines=[],globos=[],lanzas=[],peligrosTroll=[],obstaculos=[];
const reloj={t:0},rog={abierto:false},pausa={activa:false},cinematicaTroll=null,finalMago=null,casaGoblin=null;
const ent={piloto:true,pendiente:false},ctl={mov:new V3(),atacar:false,apunta:null},mando={activo:false,foco:true},document={hidden:false};
const heroe={},jugadores=[heroe],ABIERTO=false;let paron=0,danos=0,impactos=0,busquedas=0,acciones=[];
const aDistancia=()=>false,plano=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const difAng=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a)),rnd=()=>1;
const rechazo=()=>{},marca=()=>{},polvo=()=>{},chispas=()=>{},temblar=()=>{},particula=()=>{},numero=()=>{};
const golpearEn=()=>{impactos++;return 0;},recoger=b=>{b.recogida=true;},conHeroe=(h,f)=>f(),herir=()=>{danos++;};
const cancelarAtaque=e=>{e.ataque=null;},esquivado=()=>{},parryPerfecto=()=>{},bloqueado=()=>{danos++;};
${['R','PANELES','VEL','COMBO','HAB','PARRY','HEROES','BUMERAN','frente','libre'].map(n=>extraer(n,'const')).join('\n')}
${['cambiar','recargaHabilidad','iniciarGolpe','iniciarCarga','ajustarSalto','orientarAdreida','pasoHeroe','puntoApuntado','amenaza','enZona','parar','resolverAtaque','dentroPlaza','respetarMuralla','separar','pasoLibreEnemigo','escape','caminoPiloto','pasoLibrePiloto','retiradaPiloto','esquivaPiloto','piloto'].map(n=>extraer(n)).join('\n')}
${extraer('usar').replace('function usar(', 'function usarReal(')}
${extraer('buscarRutaEnemigo').replace('function buscarRutaEnemigo(', 'function buscarRutaReal(')}
function buscarRutaEnemigo(e,p){busquedas++;return buscarRutaReal(e,p);}
function usar(h,p){const ok=usarReal(h,p);acciones.push({h,t:reloj.t,ok});return ok;}
function reset(x=0,z=2){for(const k of Object.keys(heroe))delete heroe[k];
 Object.assign(heroe,{entrada:ent,control:ctl,mando,ultiT:0,sigilo:0,tipo:'adreida',pos:new V3(x,0,z),vivo:true,estado:'quieto',t:0,atq:12,basicos:1,especial:1,furia:0,dir:0,
 cd:{parry:0,salto:0,esquiva:0,bumeran:100},brilloParry:0,escudo:0,invul:0,destello:0,dolor:1,vatq:1,finGolpe:-9,combo:0,carga:0,bloqueoBasico:false,fase:0,paso:0,radio:.4,golpeo:false,dirEsq:new V3(),alma:120,almaMax:120});
 for(const a of [enemigos,botines,globos,peligrosTroll,obstaculos,lanzas])a.length=0;
 paron=0;reloj.t=0;danos=0;impactos=0;busquedas=0;acciones=[];ctl.atacar=false;ctl.mov.set(0,0,0);ctl.apunta=null;
}
function rival(x,z){const e={tipo:'can',pos:new V3(x,0,z),radio:.62,dir:0,estado:'persigue',dentro:true,d:{lanza:false},ataques:2};enemigos.push(e);return e;}
function avisoCan(e){e.estado='aviso';e.ataque={forma:'circulo',dur:1.15,t0:reloj.t,dir:e.dir,radio:2.8,centro:e.pos.clone().addScaledVector(frente(e.dir),1.8),dano:48};return e.ataque;}
function paso(dt){reloj.t+=dt;const salida=piloto(),antes=heroe.pos.clone();ctl.mov.copy(salida.mov);ctl.atacar=salida.atacar;ctl.apunta=salida.apunta;pasoHeroe(dt);respetarMuralla(antes,heroe.pos,heroe.radio);separar();return salida;}
`,c);
const run=s=>vm.runInContext(s,c);
// Desde un golpe propio, Can no se puede parar. El dash sale antes de que termine
// el windup, queda fuera por posición (sin depender de invulnerabilidad) y no reentra.
for(const fps of [30,60,120])for(const caso of ['libre','casa','muralla','sinDash']){
 const r=run(`{reset(0,${caso==='muralla'?24.2:2});const e=rival(0,${caso==='muralla'?22.2:0}),a=avisoCan(e);
 if('${caso}'==='casa')obstaculos.push({x:0,z:5,r:1.4});
 heroe.estado='golpe';heroe.t=.02;heroe.combo=2;if('${caso}'==='sinDash')heroe.cd.esquiva=3;
 let salio=false,reentro=false,ataco=false,penetracion=0;
 for(let i=0;i<Math.ceil(a.dur*${fps});i++){
  const ctl=paso(1/${fps});ataco ||= ctl.atacar;
  const dentro=enZona(a,e,heroe.pos,heroe.radio*.6);if(salio&&dentro)reentro=true;if(!dentro)salio=true;
  for(const o of obstaculos)penetracion=Math.max(penetracion,o.r+heroe.radio-Math.hypot(heroe.pos.x-o.x,heroe.pos.z-o.z));
 }
 const fuera=!enZona(a,e,heroe.pos,heroe.radio*.6),invul=heroe.invul;resolverAtaque(e);
 ({fuera,invul,danos,ataco,reentro,penetracion,acciones:acciones.map(a=>({...a})),pos:heroe.pos.toArray(),busquedas});}`);
 assert.ok(r.fuera,`Can, ${fps} Hz, ${caso}: ${JSON.stringify(r)}`);
 assert.equal(r.invul,0,'Segura por posición al impacto, no sólo por invulnerabilidad');
 assert.equal(r.danos,0);assert.equal(r.ataco,false);assert.equal(r.reentro,false);assert.ok(r.penetracion<.002);
 assert.ok(!r.acciones.some(a=>a.h==='parry'),'Nunca intenta parar el imparable');
 if(caso==='libre')assert.ok(r.acciones.some(a=>a.h==='esquiva'&&a.ok&&a.t<.1),'Interrumpe el windup inmediatamente');
 if(caso==='sinDash')assert.ok(!r.acciones.some(a=>a.h==='esquiva'),'No reintenta la habilidad aún en recarga');
}
console.log('✓ Can: posición segura al impacto, dash anticipado, sin parry/reentrada, casa y muralla a 30/60/120 Hz');
// La ruta real atraviesa los mismos pasos que el cuerpo. Se mide la propuesta antes
// de la corrección de colisiones: empujar contra un muro no cuenta como navegar.
for(const fps of [30,60,120])for(const tipo of ['enemigo','botin','alma'])for(const lugar of ['casa','pozo','bordeCasa']){
 const r=run(`{reset(${lugar==='pozo'?-9:lugar==='bordeCasa'?3.4:-7},${lugar==='pozo'?-3:0});
 const meta=new V3(${lugar==='pozo'?-1:lugar==='bordeCasa'?-7:7},0,${lugar==='pozo'?-3:0});
 if('${lugar}'==='pozo')obstaculos.push({x:-5,z:-3,r:1.3},{x:-2.82,z:-2.51,r:.55});else obstaculos.push({x:0,z:0,r:3});
 if('${tipo}'==='enemigo')rival(meta.x,meta.z);
 if('${tipo}'==='botin')botines.push({pos:meta,listo:true,recogida:false,volando:false});
 if('${tipo}'==='alma'){heroe.alma=20;globos.push({pos:meta});}
 let llego=false,minimo=99,choques=0,distancia=0;const inicio=heroe.pos.clone();
 for(let i=0;i<12*${fps};i++){
   reloj.t+=1/${fps};const p=piloto(),antes=heroe.pos.clone();
   if(p.mov.lengthSq()>.01&&!pasoLibreEnemigo(antes,antes.clone().addScaledVector(p.mov,VEL/${fps}),heroe.radio))choques++;
   ctl.mov.copy(p.mov);ctl.atacar=p.atacar;ctl.apunta=p.apunta;pasoHeroe(1/${fps});separar();distancia+=plano(antes,heroe.pos);
   minimo=Math.min(minimo,...obstaculos.map(o=>Math.hypot(heroe.pos.x-o.x,heroe.pos.z-o.z)-o.r-heroe.radio));
   if('${tipo}'==='enemigo'?p.atacar:'${tipo}'==='botin'?botines[0].recogida:plano(heroe.pos,meta)<1.1){llego=true;break;}
 }
 ({llego,minimo,choques,distancia,busquedas,restante:plano(heroe.pos,meta),pos:heroe.pos.toArray(),ruta:heroe.rutaPiloto});}`);
 assert.ok(r.llego,`${fps} Hz, ${tipo}, ${lugar}: ${JSON.stringify(r)}`);
 assert.ok(r.minimo>=-.002);assert.equal(r.choques,0,'Nunca elige caminar a través de la colisión');
 assert.ok(r.busquedas>0&&r.busquedas<10,'Reutiliza la ruta sin una búsqueda A* por cuadro');
}
console.log('✓ Enemigos, botín y alma: rodea casa, pozo y abrevadero desde ambos lados y tocando pared a 30/60/120 Hz');
// Un cono solitario conserva el parry, y termina la espera tras retirarse el aviso.
run(`reset();const cono=rival(0,0);cono.estado='aviso';cono.ataque={forma:'cono',dur:.09,t0:0,dir:0,radio:3,ang:1.2};paso(1/60);`);
assert.equal(run('heroe.estado'),'parry');
run(`reset();const can=rival(0,0);avisoCan(can);paso(1/60);can.ataque=null;heroe.estado='quieto';paso(1/60);`);
assert.equal(run('heroe.retiradaPiloto'),null);
console.log('✓ Parry de cono intacto y retirada liberada cuando termina/cancela el aviso');

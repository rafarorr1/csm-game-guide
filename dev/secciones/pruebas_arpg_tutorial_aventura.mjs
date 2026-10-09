/* Revisión del tutorial como aventura: utiliza entradas reales del juego para
   completar los encuentros y prueba las salidas del instante de parry detenido. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {crearServidor} from './servidor.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const C=Math.cos(Math.PI/6),S=.5;
const punto=(s,z=0)=>({x:C*(s-111)+S*z,z:-S*(s-111)+C*z});
const coord=p=>({s:C*p.x-S*p.z+111,z:S*p.x+C*p.z});
let servidor,navegador,base=process.env.ARPG_TUTORIAL_URL;
if(!base){servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});base=`http://127.0.0.1:${servidor.address().port}/dev/secciones/arpg-three.html`;}
let pagina,errores=[];
const capturas=process.env.ARPG_TUTORIAL_CAPTURAS;
const r=async(metodo,...args)=>pagina.evaluate(([m,a])=>window.CAOZ_ARPG_THREE_REVISION[m](...a),[metodo,args]);
const t=()=>r('tutorial'),avanzar=(segundos=.1,fps=60)=>r('avanzar',segundos,fps);
const congelado=e=>!!(e.congelado??e.congeladoParry);
async function comprobarMateriales(){
 const tutorial=await t(),escenario=tutorial.mundo?.escenario;
 assert(escenario?.lista,'Los materiales del bosque terminaron de prepararse antes de jugar');
 assert(escenario.cargados>=12,'Están cargados los mapas PBR, el atlas de follaje y los del roble: '+JSON.stringify(escenario));
 assert.deepEqual(escenario.errores,[],'No se aceptan fallos de textura silenciados por Promise.allSettled');
 assert(escenario.triangulosFollaje>0,'El atlas sustituyó los conos y copas provisionales');
 assert(escenario.arbolesScenario>=6,'Los seis robles de Scenario están integrados');
 return tutorial;
}
async function capturar(nombre){
 if(!capturas)return;const tutorial=await comprobarMateriales();await mkdir(capturas,{recursive:true});await r('dibujar');
 await pagina.screenshot({path:resolve(capturas,nombre+'.png')});
 await writeFile(resolve(capturas,nombre+'.json'),JSON.stringify({fecha:new Date().toISOString(),tutorial,rendimiento:await r('rendimiento')},null,2)+'\n');
}
async function cargar(){
 const url=new URL(base);url.search='heroe=adreida&tutorial=1&calidad=0';
 await pagina.goto(url.href,{waitUntil:'domcontentloaded'});
 await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
 assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,'La aventura termina de cargar');
 assert.equal((await t()).leccion.id,'mover');
 await comprobarMateriales();
}
async function soltar(){await r('control',{});}
async function caminar(destino,distancia=.3,hastaLeccion=false){
 for(let i=0;i<150;i++){
  const tutorial=await t();if(tutorial.fase==='entrada'||congelado(tutorial)||hastaLeccion&&tutorial.leccion.disponible){await soltar();return;}
  const h=(await r('estado')).heroe,dx=destino.x-h.x,dz=destino.z-h.z,d=Math.hypot(dx,dz);
  if(d<=distancia){await soltar();return;}
  await r('control',{mov:[dx/d,dz/d],apunta:[destino.x,destino.z]});await avanzar(Math.min(.22,Math.max(.035,(d-distancia)/5.3)));
 }
 assert.fail('El recorrido no alcanza '+JSON.stringify({destino,tutorial:await t()}));
}
async function preparar(){
 for(let i=0;i<12;i++){
  const tutorial=await t();assert(tutorial.activo,'El recorrido permanece activo');
  if(tutorial.leccion.disponible)return tutorial;
  await caminar(punto(tutorial.leccion.s+.5),.3,true);await avanzar(.02);
 }
 assert.fail('No aparece el siguiente encuentro: '+JSON.stringify(await t()));
}
async function acercarse(id,distancia=1.3){
 for(let i=0;i<100;i++){
  const blanco=(await t()).blancos.find(e=>e.id===id&&e.estado!=='muere');assert(blanco,'El rival sigue vivo antes del impacto');
  const h=(await r('estado')).heroe,dx=blanco.x-h.x,dz=blanco.z-h.z,d=Math.hypot(dx,dz);
  if(d<=distancia){await soltar();return blanco;}
  await r('control',{mov:[dx/d,dz/d],apunta:[blanco.x,blanco.z]});await avanzar(.1);
 }
 assert.fail('No puede alcanzar al rival '+id);
}
async function atacar(blanco,duracion){
 await r('control',{atacar:true,apunta:[blanco.x,blanco.z]});await avanzar(duracion);
 await r('control',{apunta:[blanco.x,blanco.z]});await avanzar(1.1);
}
async function esperarParry(){
 for(let i=0;i<150;i++){const e=await t();if(congelado(e))return e;await avanzar(.1);}
 assert.fail('El maestro de parry no detiene el ataque: '+JSON.stringify(await t()));
}
async function completar(){
 const inicio=await preparar(),id=inicio.leccion.id;
 if(id==='mover'){await caminar(punto(7.3));return;}
 if(id==='puerta')return;
 let blanco=inicio.blancos.find(e=>e.estado!=='muere');
 if(id==='basico'||id==='cargado'){
  if(id==='basico'){
   await avanzar(.16);const andando=(await t()).blancos.find(e=>e.id===blanco.id);
   assert(Math.hypot(andando.x-blanco.x,andando.z-blanco.z)>.05,'El goblin avanza desde su escondite');
   assert(andando.paso>0&&andando.fase>blanco.fase&&andando.anim==='andar','Al avanzar usa la pose y el ciclo de marcha, no se desliza inmóvil');
  }
  await acercarse(blanco.id);await soltar();await avanzar(.15);
  blanco=(await t()).blancos.find(e=>e.estado!=='muere');await atacar(blanco,id==='cargado'?1.1:.06);
 }else if(id==='dash'){
  const fuego=inicio.mundo?.fuego;assert(fuego&&fuego.hasta>fuego.desde,'La prueba tiene una franja de fuego visible');
  await r('control',{mov:[C,-S]});await avanzar(.65);
  assert(coord((await r('estado')).heroe).s<fuego.desde,'Caminar se detiene antes del fuego');
  await capturar('08-fuego-dash');
  await pagina.keyboard.press('Shift');await avanzar(.45);await soltar();
  assert(coord((await r('estado')).heroe).s>fuego.hasta,'Shift atraviesa toda la franja con el dash');
 }else if(id==='parry'||id==='parry-flecha'){
  const detenido=await esperarParry(),esFlecha=id==='parry-flecha';
  const proyectil=esFlecha?detenido.flechas.find(l=>!l.devuelta&&!l.clavada):null;
  if(esFlecha){assert(proyectil,'Se conserva la flecha en vuelo');assert(proyectil.ahora&&proyectil.llega>0&&proyectil.llega<=.2625,'La flecha se detiene dorada dentro de la ventana perfecta');}
  else assert(detenido.blancos.some(e=>e.ataque),'Se conserva el ataque visible en la ventana correcta');
  await capturar(esFlecha?'07-parry-flecha-detenida':'02-parry-detenido');
  await pagina.keyboard.press('Escape');assert((await r('estado')).pausa,'Escape sigue disponible durante el instante detenido');
  await avanzar(.5);await pagina.keyboard.press('Escape');assert(!(await r('estado')).pausa);assert(congelado(await t()),'Cerrar la pausa conserva la lección detenida');
  const antes=(await r('estado')).heroe,enemigos=detenido.blancos.map(e=>({id:e.id,x:e.x,z:e.z,ataque:e.ataque,estado:e.estado}));
  await r('control',{mov:[C,-S],atacar:true});
  for(const accion of ['esquiva','salto','torbellino','bumeran','ulti'])assert.equal(await r('usar',accion),false,`Durante la explicación ${accion} no descongela el mundo`);
  await avanzar(2,20);const despues=(await r('estado')).heroe;
  assert.deepEqual([despues.x,despues.z,despues.alma],[antes.x,antes.z,antes.alma],'Mientras espera no mueve ni hiere a Adreida');
  assert.deepEqual((await t()).blancos.map(e=>({id:e.id,x:e.x,z:e.z,ataque:e.ataque,estado:e.estado})),enemigos,'Los goblins y el arco se quedan detenidos');
  if(esFlecha)assert.deepEqual((await t()).flechas,detenido.flechas,'La flecha no avanza mientras se espera la entrada');
  await r('control',null);await pagina.keyboard.press('Space');await avanzar(.5,20);
  assert((await r('estado')).heroe.parrys>antes.parrys,'Espacio produce un parry perfecto aunque el siguiente cuadro tarde 50 ms');
  assert(!congelado(await t()),'La entrada de parry reanuda el juego');
 }else if(id==='salto'){
  const h0=(await r('estado')).heroe,s0=coord(h0).s;
  await r('control',{mov:[C,-S]});await avanzar(.9);await soltar();
  const borde=(await r('estado')).heroe;assert(coord(borde).s-s0<4,'La brecha no se cruza caminando');
  await capturar('05-brecha-salto');
  blanco=(await t()).blancos.find(e=>e.estado!=='muere');
  assert(await r('usar','salto',blanco.x,blanco.z),'El salto admite aterrizar al otro lado');await avanzar(1.1);
  assert(coord((await r('estado')).heroe).s>coord(borde).s+2,'El salto realmente cruza la brecha');
 }else if(id==='torbellino'){
  assert(inicio.blancos.length>=4,'La emboscada tiene varios goblins');
  await avanzar(1.5);await capturar('03-emboscada-torbellino');assert(await r('usar','torbellino'),'El giro se puede usar en la emboscada');await avanzar(2.2);
 }else if(id==='boomerang'){
  assert(blanco,'Hay un enemigo tras la barrera');
  await capturar('04-tronco-bumeran');
  await r('control',{apunta:[blanco.x,blanco.z]});assert(await r('usar','bumeran',blanco.x,blanco.z));await avanzar(2.5);
 }else if(id==='ulti'){
  assert(inicio.blancos.length>=2,'El último encuentro necesita ayuda contra refuerzos');
  assert(await r('usar','ulti'));await avanzar(.05);assert.equal((await t()).leccion.id,'ulti','La ulti se aprende al asistir, no sólo al pulsar');
  for(let i=0;i<120&&(await t()).leccion.id==='ulti';i++)await avanzar(.15);
 }
 const fin=await t();assert.notEqual(fin.leccion.id,id,`Se completa ${id} mediante su acción: ${JSON.stringify(fin)}`);
 assert.equal((await r('estado')).oleada,-1,'No aparecen oleadas de la arena durante los encuentros');
 if(id==='basico'&&capturas){await caminar(punto(18));await capturar('01-sendero-despues-basico');}
 console.log('✓ Encuentro real: '+id);
}
async function llegar(id){for(let i=0;i<12;i++){const e=await preparar();if(e.leccion.id===id)return e;await completar();}assert.fail('No llega a '+id);}
async function comprobarSalida(){
 const e=await t(),juego=await r('estado');assert(!e.activo&&!congelado(e)&&!e.bloquea,'La salida libera el tiempo y el control');
 assert.equal(e.blancos.length,0,'Retira a los actores del tutorial');assert.equal(juego.botines.length,0,'No deja premios prestados');assert.deepEqual(await r('aliados'),[]);
 assert.equal(juego.heroe.alma,juego.heroe.almaMax);assert.equal(juego.heroe.furia,0);
 await avanzar(2.2);assert.equal((await r('estado')).oleada,0,'Comienza la arena tras la salida');
}
try{
 navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
 const contexto=await navegador.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});pagina=await contexto.newPage();pagina.setDefaultTimeout(120000);
 pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text()+' '+m.location().url);});
 await pagina.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>f.name==='cuadro'?0:raf(f);window.__padAventura=null;Object.defineProperty(navigator,'getGamepads',{value:()=>window.__padAventura?[window.__padAventura]:[]});});
 await cargar();await llegar('puerta');
 if(capturas){await caminar(punto(84.7),.15);await capturar('06-porton');}
 await caminar(punto(85.5));assert.equal((await t()).fase,'entrada');
 await avanzar(4.1);await comprobarSalida();console.log('✓ Aventura completa: fuego, dos parrys detenidos, brecha, emboscada y asistencia.');
 if(!process.env.ARPG_TUTORIAL_SOLO_RECORRIDO){
 // Regresa con una visita nueva: el reinicio dentro del bosque mantiene la
 // lección inicial; el realizado después de terminar lleva directo a la arena.
 await cargar();await llegar('parry');await esperarParry();await r('reiniciar');await avanzar(.05);
 assert.equal((await t()).leccion.id,'mover');assert(!congelado(await t()));assert.equal((await t()).blancos.length,0);console.log('✓ Reiniciar durante el parry no conserva el bloqueo.');
 await llegar('parry');await esperarParry();await pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).click();await comprobarSalida();console.log('✓ Saltar durante el parry devuelve la arena en movimiento.');
 await cargar();await llegar('parry');await esperarParry();await r('control',null);
 await pagina.evaluate(()=>{window.__padAventura={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};});await avanzar(.05);
 const antes=(await r('estado')).heroe.parrys;await pagina.evaluate(()=>{__padAventura.buttons[4]={pressed:true,value:1};});await avanzar(.5,30);
 assert((await r('estado')).heroe.parrys>antes,'L1 registra el parry mientras el tiempo está detenido');assert(!congelado(await t()));
 await pagina.evaluate(()=>{__padAventura.buttons[4]={pressed:false,value:0};});console.log('✓ Mando: L1 reanuda y acierta el parry.');
 await completar();
 await preparar();assert.equal((await t()).leccion.id,'salto');await r('control',null);
 await pagina.evaluate(()=>{__padAventura.axes[0]=1;});await avanzar(.8);
 const orilla=coord((await r('estado')).heroe).s;assert(orilla<52,'El stick se detiene en la orilla visible');
 await pagina.evaluate(()=>{__padAventura.buttons[1]={pressed:true,value:1};});await avanzar(.85);
 assert(coord((await r('estado')).heroe).s>55.5,'El salto de cinco metros del mando cruza al otro lado');
 assert.notEqual((await t()).leccion.id,'salto','El aterrizaje del mando acredita el impacto');
 await pagina.evaluate(()=>{__padAventura=null;});console.log('✓ Mando: stick + ○ atraviesa la brecha y alcanza al goblin.');
 }
 assert.deepEqual(errores,[],'La aventura no produce errores de JavaScript ni de materiales');
}finally{await navegador?.close();if(servidor)await new Promise(ok=>servidor.close(ok));}

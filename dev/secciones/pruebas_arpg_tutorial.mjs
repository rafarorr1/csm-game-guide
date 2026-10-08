/* Recorrido real del Camino a Tomsage. No inyecta eventos del tutorial ni mueve
   personajes por teletransporte: utiliza controles, habilidades y colisiones.
   PLAYWRIGHT_MODULE y CHROME_CHANNEL permiten reutilizar el Chrome instalado.
   ARPG_TUTORIAL_URL puede apuntar al servidor ya abierto; sin él crea uno local. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {crearServidor} from './servidor.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
let servidor,navegador;
let base=process.env.ARPG_TUTORIAL_URL;
if(!base){servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});base=`http://127.0.0.1:${servidor.address().port}/dev/secciones/arpg-three.html`;}
const C=Math.cos(Math.PI/6),S=.5,lecciones=['mover','basico','cargado','dash','parry','salto','torbellino','boomerang','ulti','puerta'];
const punto=(s,z=0)=>({x:-C*111+C*s+S*z,z:55.5-S*s+C*z});

async function abrir(consulta='',ruta='arpg-three.html'){
 const contexto=await navegador.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),pagina=await contexto.newPage(),errores=[];
 pagina.setDefaultTimeout(120000);
 pagina.on('pageerror',e=>errores.push(e.message));
 pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
 // Conserva todos los RAF de carga. Sólo el ciclo del juego queda a cargo de
 // revision.avanzar: cada entrada se resuelve con sus actualizaciones reales.
 await pagina.addInitScript(()=>{
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=f=>f.name==='cuadro'?0:raf(f);
  window.__padTutorial=null;
  Object.defineProperty(navigator,'getGamepads',{value:()=>window.__padTutorial?[window.__padTutorial]:[]});
 });
 const url=new URL(base);url.pathname=url.pathname.replace(/[^/]+$/,ruta);url.search='calidad=0&'+consulta;
 await pagina.goto(url.href,{waitUntil:'domcontentloaded'});
 await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
 assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,`Carga completa: ${url.href}`);
 const r=async(metodo,...args)=>pagina.evaluate(([m,a])=>window.CAOZ_ARPG_THREE_REVISION[m](...a),[metodo,args]);
 const t=()=>r('tutorial');
 return {contexto,pagina,errores,r,t};
}
async function avanzar(v,s=.1){return v.r('avanzar',s,60);}
async function recargar(v){
 await v.pagina.reload({waitUntil:'domcontentloaded'});
 await v.pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
 assert.equal(await v.pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,'Recarga completa');
 assert.equal((await v.t()).leccion?.id,'mover','Una visita nueva repite el tutorial');
}
async function soltar(v){await v.r('control',{});await v.pagina.evaluate(()=>{if(__padTutorial){__padTutorial.axes.fill(0);__padTutorial.buttons.forEach(b=>{b.pressed=false;b.value=0;});}});}
async function caminar(v,destino,distancia=.28){
 let anterior=null,quietos=0;
 for(let i=0;i<180;i++){
  if((await v.t()).fase==='entrada'){await soltar(v);return;}
  const {heroe:h}=await v.r('estado'),dx=destino.x-h.x,dz=destino.z-h.z,d=Math.hypot(dx,dz);
  if(d<=distancia){await soltar(v);return;}
  if(anterior&&Math.hypot(h.x-anterior.x,h.z-anterior.z)<.005)quietos++;else quietos=0;
  assert(quietos<12,`El recorrido queda bloqueado: ${JSON.stringify({h,destino,t:await v.t()})}`);
  anterior=h;await v.r('control',{mov:[dx/d,dz/d],apunta:[destino.x,destino.z]});await avanzar(v,Math.min(.35,Math.max(.04,(d-distancia)/5.3)));
 }
 assert.fail('No alcanza '+JSON.stringify(destino));
}
async function prepararLeccion(v){
 for(let i=0;i<15;i++){
  const t=await v.t();assert(t.activo,'El tutorial sigue activo durante el recorrido');
  if(t.leccion.disponible)return t;
  await caminar(v,punto(t.leccion.s+.5));await avanzar(v,.05);
 }
 assert.fail('No se activa la lección '+JSON.stringify(await v.t()));
}
async function apuntarRaton(v,blanco){
 await v.r('control',null);const p=await v.r('enemigoPantalla',blanco.id);
 assert(p?.dentro,'El blanco se ve para apuntar con el ratón');
 await v.pagina.mouse.move(p.x,p.y);await avanzar(v,.05);
}
async function golpear(v,blanco,segundos,raton=false){
 if(raton){await apuntarRaton(v,blanco);await v.pagina.mouse.down();await avanzar(v,segundos);await v.pagina.mouse.up();}
 else{await v.r('control',{atacar:true,apunta:[blanco.x,blanco.z]});await avanzar(v,segundos);await v.r('control',{apunta:[blanco.x,blanco.z]});}
 await avanzar(v,1.05);
}
async function hacerLeccion(v,{raton=false,parcial=false}={}){
 const t=await prepararLeccion(v),id=t.leccion.id;
 if(id==='mover'){await caminar(v,punto(7.3));return;}
 if(id==='puerta')return;
 let blanco=t.blancos.find(e=>e.estado!=='muere');
 if(blanco){await caminar(v,blanco,['salto','boomerang'].includes(id)?5.2:1.35);blanco=(await v.t()).blancos.find(e=>e.estado!=='muere');}
 await soltar(v);await avanzar(v,.2);
 if(id==='basico'||id==='cargado'){
  if(parcial&&id==='cargado'){
   await golpear(v,blanco,.35,raton);assert.equal((await v.t()).leccion.id,id,'Una carga parcial no supera el reto');
   blanco=(await v.t()).blancos.find(e=>e.estado!=='muere');await caminar(v,blanco,1.35);
  }
  await golpear(v,blanco,id==='cargado'?1.1:.05,raton);
 }else if(id==='parry'){
  let exito=false;
  for(let i=0;i<900;i++){
   const q=await v.t(),e=q.blancos.find(e=>e.estado!=='muere');
   if(q.leccion.id!==id){exito=true;break;}
   if(e?.ataque&&e.ataque.k>=.9&&e.ataque.k<1)await v.r('usar','parry',e.x,e.z);
   await avanzar(v,1/60);
  }
  assert(exito,'El parry perfecto real acredita la lección');
 }else{
  const accion={dash:'esquiva',salto:'salto',torbellino:'torbellino',boomerang:'bumeran',ulti:'ulti'}[id];
  const x=id==='dash'?C:blanco?.x,z=id==='dash'?-S:blanco?.z;
  assert(await v.r('usar',accion,x,z),`Se ejecuta ${accion}`);await avanzar(v,id==='boomerang'?2.4:1.3);
 }
 const siguiente=await v.t();assert.notEqual(siguiente.leccion.id,id,`La acción real completa ${id}: ${JSON.stringify(siguiente)}`);
 assert.equal((await v.r('estado')).oleada,-1,'No empieza ninguna oleada en el bosque');
}
async function hastaLeccion(v,meta,opciones={}){
 for(let i=0;i<lecciones.length;i++){
  const t=await prepararLeccion(v);
  if(t.leccion.id===meta)return t;
  await hacerLeccion(v,opciones);
 }
 assert.fail('No se alcanza '+meta);
}
async function botonAbajo(v){
 const b=await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).boundingBox(),esc=await v.pagina.locator('#escenario').boundingBox();
 assert(b&&esc,'Saltar tutorial sigue visible');
 assert(b.x>esc.x+esc.width*.65&&b.y>esc.y+esc.height*.75,'El botón está en la esquina inferior derecha');
 assert(b.x+b.width<=esc.x+esc.width&&b.y+b.height<=esc.y+esc.height,'El botón cabe completo');
}
async function salidaLimpia(v){
 const t=await v.t(),e=await v.r('estado'),estilo=await v.r('estilo');
 assert(!t.activo&&!t.bloquea,'Devuelve el control de la plaza');assert.equal(t.blancos.length,0,'Retira todos los enemigos del tutorial');
 assert.equal(e.heroe.alma,e.heroe.almaMax,'Entra con toda su Alma');assert.equal(e.heroe.furia,0,'No conserva la Furia prestada');
 assert.deepEqual(e.heroe.botin,[]);assert.equal(e.botines.length,0);assert.equal(e.destino.emitidas,0,'Los blancos no dan cartas');
 assert.equal(estilo.puntos,0);assert.equal(estilo.golpes,0,'No traslada la cadena de entrenamiento');
 assert.deepEqual(await v.r('aliados'),[],'No conserva aliados de la lección');
 assert(Object.values(e.heroe.cd).every(n=>n===0),'Las habilidades vuelven listas');
 assert.equal(await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).isVisible(),false);
 if(t.puerta!==undefined)assert.equal(t.puerta,1,'La puerta queda completamente cerrada');
 await avanzar(v,2.2);assert.equal((await v.r('estado')).oleada,0,'Comienza exactamente la primera oleada');
 await avanzar(v,.3);assert.equal((await v.r('estado')).oleada,0,'No duplica el inicio de oleada');
}

try{
 navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
 const v=await abrir();
 try{
  let t=await v.t();assert(t.activo);assert.equal(t.leccion.id,'mover');assert.equal((await v.r('estado')).oleada,-1);
  await botonAbajo(v);
  const antes=(await v.r('estado')).heroe;await v.r('control',null);await v.pagina.keyboard.down('KeyD');await avanzar(v,.2);await v.pagina.keyboard.up('KeyD');
  assert((await v.r('estado')).heroe.x>antes.x+.5,'D mueve a Adreida en el bosque');
  await hastaLeccion(v,'basico');await v.r('reiniciar');await avanzar(v,.05);
  assert.equal((await v.t()).leccion.id,'mover','Reiniciar a mitad vuelve al primer reto');assert.equal((await v.t()).blancos.length,0);
  assert.equal(await v.pagina.locator('.apTutorial').count(),1,'Reiniciar no duplica la interfaz');
  await hastaLeccion(v,'puerta',{raton:true,parcial:true});t=await v.t();assert.deepEqual(t.completadas,lecciones.slice(0,-1));
  await botonAbajo(v);await caminar(v,punto(85.5));
  assert.equal((await v.t()).fase,'entrada','Cruzar la puerta inicia la entrada');await botonAbajo(v);
  for(let i=0;i<50&&(await v.t()).activo;i++)await avanzar(v,.1);
  await salidaLimpia(v);
  console.log('✓ Recorrido completo: teclado y ratón, nueve acciones reales, carga parcial rechazada, parry perfecto y entrada a Tomsage.');
  await v.r('reiniciar');assert.equal((await v.t()).activo,false,'Reiniciar tras completar conserva el acceso directo a la arena');

  // Cada salto empieza desde una nueva visita y llega por el sendero. No
  // cambia índices, posiciones ni señales de acreditación para preparar el caso.
  for(const id of lecciones){
   await recargar(v);await avanzar(v,.05);await hastaLeccion(v,id);await botonAbajo(v);
   await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).click();await salidaLimpia(v);
   console.log(`✓ Saltar desde ${id}: sin botín, Furia, estilo ni cooldowns prestados; primera oleada única.`);
  }
  await recargar(v);await avanzar(v,.05);await hastaLeccion(v,'puerta');await caminar(v,punto(85.5));
  assert.equal((await v.t()).fase,'entrada');await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).click();await salidaLimpia(v);
  console.log('✓ Saltar durante la entrada y reiniciar restauran bosque, UI y puerta sin enemigos residuales.');

  await recargar(v);await v.r('control',null);
  await v.pagina.evaluate(()=>{window.__padTutorial={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};});
  await avanzar(v,.05);const posicionPad=(await v.r('estado')).heroe;
  await v.pagina.evaluate(([x,z])=>{__padTutorial.axes[0]=x;__padTutorial.axes[1]=z;},[C,-S]);await avanzar(v,.3);
  const despuesPad=(await v.r('estado')).heroe;assert(Math.hypot(despuesPad.x-posicionPad.x,despuesPad.z-posicionPad.z)>.5,'El stick mueve a Adreida');
  assert.equal((await v.t()).mando,true);assert.match(await v.pagina.locator('.apTutorialTecla').textContent(),/Stick izquierdo/);
  await v.pagina.evaluate(()=>{__padTutorial.axes.fill(0);__padTutorial.buttons[8].pressed=true;__padTutorial.buttons[8].value=1;});await avanzar(v,.05);await salidaLimpia(v);
  console.log('✓ Mando: stick mueve, las indicaciones cambian y Select salta el tutorial.');
  assert.deepEqual(v.errores,[],'El recorrido no produce errores de JavaScript ni GLSL');
 }finally{await v.contexto.close();}

 for(const [consulta,ruta] of [['tutorial=0'],['captura=1'],['coop=1'],['etapa=2'],['heroe=mohamed'],['mundo=abierto'],['inspector=1'],['','arpg-cine.html']]){
  const v=await abrir(consulta,ruta);
  try{
   assert.equal((await v.t()).activo,false,`${consulta||ruta}: excluido del tutorial`);
   assert.equal(await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).isVisible(),false);
   assert.deepEqual(v.errores,[],`${consulta||ruta}: sin errores de carga`);
   console.log(`✓ Exclusión conservada: ${consulta||ruta}.`);
  }finally{await v.contexto.close();}
 }
}finally{await navegador?.close();if(servidor)await new Promise(ok=>servidor.close(ok));}

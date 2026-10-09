/* Acceso, salida y rutas excluidas del Camino a Tomsage.
   El recorrido de combate, los encuentros y el parry detenido se comprueban
   en pruebas_arpg_tutorial_aventura.mjs; aquí no se repite aquella batería. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {crearServidor} from './servidor.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
let servidor,navegador;
let base=process.env.ARPG_TUTORIAL_URL;
if(!base){servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/arpg-three.html';}

async function abrir(consulta='',ruta='arpg-three.html'){
 const contexto=await navegador.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),pagina=await contexto.newPage(),errores=[];
 pagina.setDefaultTimeout(120000);
 pagina.on('pageerror',e=>errores.push(e.message));
 pagina.on('console',m=>{if(m.type()==='error'&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
 // Los RAF de carga permanecen activos. revision.avanzar dirige únicamente el
 // ciclo del juego y conserva las entradas, colisiones y habilidades reales.
 await pagina.addInitScript(()=>{
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=f=>f.name==='cuadro'?0:raf(f);
  window.__padTutorial=null;
  Object.defineProperty(navigator,'getGamepads',{value:()=>window.__padTutorial?[window.__padTutorial]:[]});
 });
 const url=new URL(base);url.pathname=url.pathname.replace(/[^/]+$/,ruta);url.search='calidad=0&'+consulta;
 await pagina.goto(url.href,{waitUntil:'domcontentloaded'});
 await pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
 assert.equal(await pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,'Carga completa: '+url.href);
 const r=async(metodo,...args)=>pagina.evaluate(([m,a])=>window.CAOZ_ARPG_THREE_REVISION[m](...a),[metodo,args]);
 return {contexto,pagina,errores,r,t:()=>r('tutorial')};
}
async function avanzar(v,s=.1){return v.r('avanzar',s,60);}
async function recargar(v){
 await v.pagina.reload({waitUntil:'domcontentloaded'});
 await v.pagina.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().fallida||window.CAOZ_ARPG_THREE_REVISION?.listo());
 assert.equal(await v.pagina.evaluate(()=>window.CAOZ_ARPG_CARGA.estado().fallida),false,'Recarga completa');
 assert.equal((await v.t()).leccion?.id,'mover','Una visita nueva repite el tutorial');
}
async function botonAbajo(v){
 const b=await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).boundingBox(),esc=await v.pagina.locator('#escenario').boundingBox();
 assert(b&&esc,'Saltar tutorial sigue visible');
 assert(b.x>esc.x+esc.width*.5&&b.y>esc.y+esc.height*.75,'El botón está en la esquina inferior derecha');
 assert(b.x+b.width<=esc.x+esc.width+1&&b.y+b.height<=esc.y+esc.height+1,'El botón cabe completo');
}
async function salidaLimpia(v){
 const t=await v.t(),e=await v.r('estado'),estilo=await v.r('estilo');
 assert(!t.activo&&!t.bloquea&&!t.congeladoParry,'Devuelve el control de la plaza');assert.equal(t.blancos.length,0,'Retira todos los enemigos del tutorial');
 assert.equal(e.heroe.alma,e.heroe.almaMax,'Entra con toda su Alma');assert.equal(e.heroe.furia,0,'No conserva la Furia prestada');
 assert.deepEqual(e.heroe.botin,[]);assert.equal(e.botines.length,0);assert.equal(e.destino.emitidas,0,'Los blancos no dan cartas');
 assert.equal(estilo.puntos,0);assert.equal(estilo.golpes,0,'No traslada la cadena de entrenamiento');
 assert.deepEqual(await v.r('aliados'),[],'No conserva aliados de la lección');
 assert(Object.values(e.heroe.cd).every(n=>n===0),'Las habilidades vuelven listas');
 assert.equal(await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).isVisible(),false);
 assert.equal(t.puerta,1,'La puerta queda completamente cerrada');
 await avanzar(v,2.2);assert.equal((await v.r('estado')).oleada,0,'Comienza exactamente la primera oleada');
 await avanzar(v,.3);assert.equal((await v.r('estado')).oleada,0,'No duplica el inicio de oleada');
}

try{
 navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
 const v=await abrir();
 try{
  assert((await v.t()).activo);assert.equal((await v.t()).leccion.id,'mover');assert.equal((await v.r('estado')).oleada,-1);await botonAbajo(v);
  const antes=(await v.r('estado')).heroe;await v.pagina.keyboard.down('KeyD');await avanzar(v,2.4);await v.pagina.keyboard.up('KeyD');
  assert((await v.r('estado')).heroe.x>antes.x+5,'D hace avanzar por el sendero');
  assert.equal((await v.t()).leccion.id,'basico');assert((await v.t()).blancos.length>0,'El primer goblin sale al encuentro');
  await v.r('reiniciar');await avanzar(v,.05);assert.equal((await v.t()).leccion.id,'mover');assert.equal((await v.t()).blancos.length,0);
  assert.equal(await v.pagina.locator('.apTutorial').count(),1,'Reiniciar no duplica la interfaz');
  await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).click();await salidaLimpia(v);
  await v.r('reiniciar');assert.equal((await v.t()).activo,false,'Reiniciar tras saltar conserva el acceso directo a la arena');
  console.log('✓ Acceso por defecto, teclado, primer encuentro, reinicio y salida limpia.');

  await recargar(v);await v.pagina.setViewportSize({width:390,height:844});await avanzar(v,.02);await botonAbajo(v);
  await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).click();await salidaLimpia(v);
  console.log('✓ Móvil: el botón de salto permanece completo y accesible abajo a la derecha.');

  await v.pagina.setViewportSize({width:1280,height:800});await recargar(v);
  await v.pagina.evaluate(()=>{window.__padTutorial={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};});
  await avanzar(v,.05);const inicioPad=(await v.r('estado')).heroe;
  await v.pagina.evaluate(()=>{__padTutorial.axes[0]=1;});await avanzar(v,.3);
  const despuesPad=(await v.r('estado')).heroe;assert(Math.hypot(despuesPad.x-inicioPad.x,despuesPad.z-inicioPad.z)>.5,'El stick mueve a Adreida');
  assert.equal((await v.t()).mando,true);assert.match(await v.pagina.locator('.apTutorialTecla').textContent(),/Stick izquierdo/);
  await v.pagina.evaluate(()=>{__padTutorial.axes.fill(0);__padTutorial.buttons[8]={pressed:true,value:1};});await avanzar(v,.05);await salidaLimpia(v);
  console.log('✓ Mando: movimiento, indicaciones y Select para saltar el tutorial.');
  assert.deepEqual(v.errores,[],'No hay errores de JavaScript ni de materiales');
 }finally{await v.contexto.close();}

 for(const [consulta,ruta] of [['tutorial=0'],['captura=1'],['coop=1'],['etapa=2'],['heroe=mohamed'],['mundo=abierto'],['inspector=1'],['','arpg-cine.html']]){
  const v=await abrir(consulta,ruta);
  try{
   assert.equal((await v.t()).activo,false,(consulta||ruta)+': excluido del tutorial');
   assert.equal(await v.pagina.getByRole('button',{name:'Saltar tutorial',exact:true}).isVisible(),false);
   assert.deepEqual(v.errores,[],(consulta||ruta)+': sin errores de carga');
   console.log('✓ Exclusión conservada: '+(consulta||ruta)+'.');
  }finally{await v.contexto.close();}
 }
}finally{await navegador?.close();if(servidor)await new Promise(ok=>servidor.close(ok));}

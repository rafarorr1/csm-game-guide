/* Revisión acotada de Mohamed: línea de visión, cañón y trayectoria compartida.
   No ejecuta la batería completa del ARPG ni publica la sección. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {crearServidor} from './servidor.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
let navegador;
const cerca=(a,b,mensaje)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-6,mensaje);
try{
  navegador=await chromium.launch({headless:true});
  for(const tactil of [false,true]){
    const contexto=await navegador.newContext({viewport:tactil?{width:390,height:780}:{width:1280,height:800},hasTouch:tactil,isMobile:tactil});
    const pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    pagina.on('response',r=>{if(r.status()>=400)errores.push(r.status()+' '+r.url());});
    pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    await pagina.goto(`http://127.0.0.1:${servidor.address().port}/dev/secciones/arpg-three.html?captura=1&heroe=mohamed`);
    await pagina.waitForFunction(()=>window.CAOZ_ARPG_THREE_REVISION?.listo(),null,{timeout:120000});
    const estado=()=>pagina.evaluate(()=>({e:CAOZ_ARPG_THREE_REVISION.estado(),m:CAOZ_ARPG_THREE_REVISION.punteria(),b:CAOZ_ARPG_THREE_REVISION.proyectiles()}));
    if(!tactil){
      await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.heroe({x:0,z:0});return r.avanzar(.1);});
      const p=await pagina.evaluate(()=>CAOZ_ARPG_THREE_REVISION.pantalla(3,1.15,-5));await pagina.mouse.move(p.x,p.y);await pagina.keyboard.down('KeyA');
      await pagina.mouse.down();
      for(let i=0;i<8;i++){
        await pagina.evaluate(()=>CAOZ_ARPG_THREE_REVISION.avanzar(1/30));
        const error=await pagina.evaluate(({x,y})=>{const r=CAOZ_ARPG_THREE_REVISION,m=r.punteria(),a=r.pantalla(...m.desde),b=r.pantalla(...m.hasta);
          return Math.abs((b.x-a.x)*(a.y-y)-(a.x-x)*(b.y-a.y))/Math.hypot(b.x-a.x,b.y-a.y);},p);
        assert.ok(error<.6,'Al caminar, la línea sigue bajo el cursor (error '+error+' px)');
      }
      await pagina.mouse.up();await pagina.keyboard.up('KeyA');
    }
    // Cambios bruscos de dirección: ambos acabados salen de la boca actual, sobre la línea actual.
    for(const estilo of ['plomo','trazadora'])for(const apunta of [[7,0],[-7,0],[0,-7],[0,7]]){
      await pagina.evaluate(({estilo,apunta})=>{const r=CAOZ_ARPG_THREE_REVISION;r.reiniciar();r.heroe({x:0,z:0});r.balas(estilo);r.control({mov:[.4,0],atacar:true,apunta});return r.avanzar(1/30);},{estilo,apunta});
      const s=await estado();assert.equal(s.b.length,1);cerca(s.b[0].origen,s.m.desde,'La bala nace en la boca de este fotograma');cerca(s.b[0].direccion,s.m.direccion,'La bala sigue el eje visible');
      const original=s.b[0];await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.control({apunta:[-3,5]});return r.avanzar(1/30);});
      const volando=(await estado()).b[0];assert.ok(volando,'La bala sigue en vuelo');cerca(volando.direccion,original.direccion,'Mover la mira no curva una bala disparada');
      cerca(volando.pos,original.origen.map((v,i)=>v+original.direccion[i]),'La trayectoria es recta también en altura');
    }
    // Un enemigo tras el pozo no recibe daño y la mira se detiene en la cobertura.
    await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.reiniciar();r.heroe({x:-5,z:2});r.invocar('goblin',-5,-6,true);r.control({atacar:true,apunta:[-5,-6]});return r.avanzar(1/30);});
    let s=await estado();assert.ok(s.m.bloqueado&&s.m.enemigo===null,'El pozo corta la línea de visión');
    await pagina.evaluate(()=>CAOZ_ARPG_THREE_REVISION.avanzar(.8));s=await estado();assert.equal(s.e.enemigos[0].vida,34,'Los disparos no atraviesan el pozo');
    // El segmento recorre el blanco incluso con pasos de 0,1 s (3 m por fotograma).
    await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.reiniciar();r.heroe({x:0,z:0});r.invocar('goblin',0,-2,true);r.control({atacar:true,apunta:[0,-2]});return r.avanzar(1/30);});
    s=await estado();assert.equal(s.m.enemigo,s.e.enemigos[0].id,'La mira identifica al primer blanco');
    await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.control({apunta:[0,-2]});return r.avanzar(.1,10);});s=await estado();assert.ok(s.e.enemigos[0].vida<34,'No salta por encima del goblin entre fotogramas');
    // Abanico conserva siete proyectiles, con el central exactamente sobre la mira.
    await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.reiniciar();r.heroe({x:0,z:0,furia:100});r.control({apunta:[0,-6]});return r.avanzar(1/30);});
    await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.usar('torbellino');return r.avanzar(1/30);});s=await estado();assert.equal(s.b.length,7);cerca(s.b[3].direccion,s.m.direccion,'El Abanico se centra en la misma mira');assert.ok((s.b[0].direccion[0]<s.b[3].direccion[0])!==(s.b[6].direccion[0]<s.b[3].direccion[0]),'Se abre hacia ambos lados');
    await pagina.evaluate(()=>{const r=CAOZ_ARPG_THREE_REVISION;r.elegir('adreida');return r.avanzar(1/30);});assert.equal((await estado()).m,null,'Adreida no muestra la mira de pistola');
    assert.deepEqual(errores,[], 'Carga y combate sin errores');await contexto.close();
    console.log('✓ Puntería, trayectorias, cobertura y Abanico: '+(tactil?'táctil':'escritorio'));
  }
}finally{await navegador?.close();servidor.close();}

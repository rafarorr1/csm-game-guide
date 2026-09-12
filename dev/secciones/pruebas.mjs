// Pruebas de aislamiento y procedencia. No carga una partida ni usa la red pública.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {generar,extraerDeclaracion,leer,hash} from './fuentes.mjs';
import {crearServidor} from './servidor.mjs';
let n=0;
function comprobar(nombre,fn){fn();n++;console.log('✓ '+nombre);}
comprobar('Extraer funciones respeta cadenas, regex y plantillas anidadas',()=>{
  const fuente='function ejemplo(){const texto=`${(()=>"}")()}`;return /[{};]/.test(texto);}\nfunction otra(){}';
  const r=extraerDeclaracion(fuente,'ejemplo');assert.equal(r.texto,fuente.split('\n')[0]);assert.equal(new vm.Script(r.texto+';ejemplo();').runInNewContext(),true);
});
comprobar('Una fuente ambigua o truncada falla sin inventar un renderer',()=>{
  assert.throws(()=>extraerDeclaracion('function x(){}\nfunction x(){}','x'),/única/);
  assert.throws(()=>extraerDeclaracion('function x(){return "incompleto','x'),/no termina/);
});
for(const vista of ['desktop','movil']){
  const r=generar(vista);
  comprobar(vista+': catálogo real serializable sin motor en el navegador',()=>{
    assert.equal(r.metadatos.protagonistas,6);assert.ok(r.metadatos.cartas>100);
    const c=vm.createContext({});new vm.Script(r.datosJS).runInContext(c);
    assert.equal(new vm.Script('G===null&&typeof newGame==="undefined"&&typeof NET==="undefined"').runInContext(c),true);
    assert.equal(new vm.Script('CARDS.tal.n').runInContext(c),'Thal');
  });
  comprobar(vista+': funciones generadas coinciden con los archivos actuales',()=>{
    const html=leer(vista==='desktop'?'index.html':'movil.html');
    for(const nombre of ['cardEl','ponerDibujo','ilustrar','ilustrarLider','cartaDeLiderVS'])assert.ok(r.renderJS.includes(extraerDeclaracion(html,nombre).texto));
    assert.equal(r.metadatos.fuentes[0].sha256,hash(html));
    assert.ok(!r.renderJS.includes('function newGame'));assert.ok(!r.renderJS.includes('function aiTurn'));
  });
}
comprobar('El almacén de prueba nunca toca el almacén original del navegador',()=>{
  const real={lecturas:0,escrituras:0},win={};Object.defineProperty(win,'localStorage',{configurable:true,get(){real.lecturas++;throw Error('Acceso al progreso real');}});Object.defineProperty(win,'sessionStorage',{configurable:true,get(){real.lecturas++;throw Error('Acceso al progreso real');}});
  new vm.Script(fs.readFileSync(new URL('./memoria.js',import.meta.url),'utf8')).runInNewContext({window:win,Map,Object,String});
  win.localStorage.setItem('prueba','uno');assert.equal(win.localStorage.getItem('prueba'),'uno');assert.equal(real.lecturas,0);assert.equal(real.escrituras,0);win.CAOZ_DEV.reset();assert.equal(win.localStorage.length,0);
});
const servidor=crearServidor();await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/';
try{
  const html=await(await fetch(base+'coleccion.html?vista=movil')).text();
  comprobar('Entrada aislada sin iframe, motor, instalador ni scripts del juego entero',()=>{
    assert.ok(html.includes('data-vista="movil"'));assert.ok(html.includes('juego/coleccion-ui.js'));
    assert.doesNotMatch(html,/<iframe|src="[^\"]*(?:motor\.js|final\.js|sw\.js)|rel="manifest"/i);
  });
  const real=await fetch(base+'juego/coleccion-ui.js'),texto=await real.text();
  comprobar('El componente servido es byte por byte el código real',()=>assert.equal(texto,leer('coleccion-ui.js')));
  const respuestas=await Promise.all(['juego/motor.js','juego/index.html','../../AGENTS.md','art/../AGENTS.md'].map(p=>fetch(base+p)));
  comprobar('El servidor sólo expone los componentes y assets de esta sección',()=>respuestas.forEach(r=>assert.equal(r.status,404)));
  const post=await fetch(base+'coleccion.html',{method:'POST',body:'no escribir'});
  comprobar('No permite escrituras ni publicación por HTTP',()=>assert.equal(post.status,405));
  const catalogo=await(await fetch(base+'api/arte/catalogo')).json();
  comprobar('El proveedor remoto está aislado del estudio publicado',()=>assert.deepEqual(catalogo,{cartas:[]}));
  comprobar('CSP bloquea workers, marcos y conexiones externas',()=>{const p=real.headers.get('content-security-policy');assert.ok(p.includes("connect-src 'self'"));assert.ok(p.includes("worker-src 'none'"));assert.ok(p.includes("frame-src 'none'"));});
}finally{await new Promise(resolve=>servidor.close(resolve));}
console.log(n+' comprobaciones correctas.');

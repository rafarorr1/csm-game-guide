/* Comprueba el paquete alojable y el flujo de revisión fuera de localhost. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {exportar} from './exportar.mjs';
import {generar,leer,hash} from './fuentes.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-seccion-export-'));
try{
  const destino=path.join(temp,'vista');const r=exportar(destino);
  for(const f of ['index.html','movil.html','escritorio.html','art/tal.webp','api/arte/catalogo'])assert.ok(fs.statSync(path.join(destino,f)).isFile(),f);
  for(const f of ['motor.js','final.js','sw.js','_worker.js','estudio.html','audio'])assert.ok(!fs.existsSync(path.join(destino,f)),f);
  for(const [f,h] of Object.entries(r.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),h);
  assert.throws(()=>exportar(destino),/vacío/);
  for(const vista of ['desktop','movil']){
    const html=fs.readFileSync(path.join(destino,vista==='movil'?'movil.html':'escritorio.html'),'utf8');
    assert.ok(html.includes('data-vista="'+vista+'"'));assert.ok(html.includes('data-exportada="1"'));
    assert.ok(html.includes('value="muestrario"')&&html.includes('name="acabado"'),'El laboratorio exportado permite elegir una serie');
    for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:[^\"]*)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  }
  console.log('✓ Paquete real, ambas vistas, rutas completas y sin archivos del juego entero.');
  const peticiones=[];
  const red={location:{href:'https://revision.example/movil.html'},URL,fetch:(url,opciones)=>{peticiones.push({url,opciones});return Promise.resolve();}};red.window=red;
  vm.runInNewContext(fs.readFileSync(new URL('./red-estatica.js',import.meta.url),'utf8'),red);
  await red.fetch('https://revision.example/api/arte/catalogo',{credentials:'omit'});
  await red.fetch('https://revision.example/art/encuadres.json',{credentials:'omit'});
  await red.fetch('https://otro.example/art/encuadres.json',{credentials:'omit'});
  assert.equal(peticiones[0].url,'https://revision.example/catalogo-vacio.json');
  assert.equal(peticiones[0].opciones.credentials,'omit');assert.equal(peticiones[1].opciones.credentials,'omit');
  assert.equal(peticiones[2].opciones.credentials,'omit');
  console.log('✓ La sección estática sólo redirige su catálogo vacío, sin añadir credenciales.');
  let reemplazo;
  for(const [movil,vista,archivo] of [[true,'','movil.html'],[false,'','escritorio.html'],[true,'desktop','escritorio.html']]){
    vm.runInNewContext(fs.readFileSync(path.join(destino,'abrir.js'),'utf8'),{URL,URLSearchParams,matchMedia:()=>({matches:movil}),location:{search:'?vista='+vista+'&estado=muestrario&acabado=dorado&carta=tal',href:'https://revision.example/',replace:u=>{reemplazo=u;}}});
    assert.equal(new URL(reemplazo).pathname,'/'+archivo);
    assert.equal(new URL(reemplazo).searchParams.get('estado'),'muestrario');assert.equal(new URL(reemplazo).searchParams.get('acabado'),'dorado');
    assert.equal(new URL(reemplazo).searchParams.get('carta'),'tal','La entrada pública conserva la carta cuyo detalle se quiere revisar');
  }
  console.log('✓ El enlace elige móvil/escritorio y conserva la serie y el detalle de la carta.');
  async function entorno(search){
    let listo,submit,cambiar,aperturas=0;
    const form={elements:{vista:{value:''},estado:{value:'',addEventListener:(_,f)=>{cambiar=f;}},acabado:{value:'',disabled:false}},addEventListener:(_,f)=>{submit=f;}};
    const estado={},abrir={};
    const contexto=vm.createContext({console,URL,URLSearchParams,TextEncoder,TextDecoder,Map,Math,Date,CustomEvent:class{},dispatchEvent(){},addEventListener:(_,f)=>{listo=f;},location:{hostname:'revision.example',pathname:'/movil.html',href:'https://revision.example/movil.html',search},document:{readyState:'loading',body:{dataset:{vista:'movil',exportada:'1'},append(){}},createElement:()=>({}),getElementById:id=>id==='devEscenarios'?form:id==='devAbrir'?abrir:estado},abrirColeccion:()=>{aperturas++;},cargarArte:()=>Promise.resolve()});
    vm.runInContext('window=globalThis',contexto);
    vm.runInContext(fs.readFileSync(new URL('./memoria.js',import.meta.url),'utf8'),contexto);
    vm.runInContext(generar('movil').datosJS,contexto);
    vm.runInContext(leer('coleccion-modelo.js'),contexto);
    vm.runInContext(fs.readFileSync(new URL('./coleccion-dev.js',import.meta.url),'utf8'),contexto);
    listo();await new Promise(resolve=>setImmediate(resolve));
    return {contexto,form,estado,aperturas,submit:()=>submit({preventDefault(){}}),cambiar:()=>cambiar()};
  }
  const t=await entorno('?estado=sobres'),{contexto,form}=t;
  assert.equal(contexto.CAOZ_COLECCION.betaDisponible(),false);
  assert.equal(contexto.CAOZ_COLECCION.sobres(),2);assert.equal(t.aperturas,1);assert.equal(form.elements.acabado.disabled,true);
  const sobre=contexto.CAOZ_COLECCION.abrirSobre();assert.equal(sobre.cartas.length,5);assert.ok(sobre.cartas.every(c=>c.acabado==='foil'));
  form.elements.vista.value='desktop';t.submit();
  assert.equal(new URL(contexto.location.href).pathname,'/escritorio.html');
  console.log('✓ En un dominio remoto hay dos sobres, cinco Foil y cambio de presentación, con memoria temporal.');
  for(const acabado of ['normal','foil','dorado']){
    const t=await entorno('?estado=muestrario&acabado='+acabado),m=t.contexto.CAOZ_COLECCION;
    assert.ok(m.ids().every(id=>m.elegido(id)===acabado&&['normal','foil','dorado'].every(a=>m.cantidad(id,a)===1)),'Una copia de cada edición y la serie seleccionada para todo el muestrario');
    assert.equal(t.aperturas,1);assert.equal(t.form.elements.acabado.value,acabado);assert.equal(t.form.elements.acabado.disabled,false);
    assert.ok(t.estado.textContent.includes('En memoria: todas las ediciones para revisar ilustraciones.'));
    t.form.elements.vista.value='desktop';t.submit();
    assert.equal(new URL(t.contexto.location.href).pathname,'/escritorio.html');assert.equal(new URL(t.contexto.location.href).searchParams.get('acabado'),acabado);
    t.form.elements.estado.value='nuevo';t.cambiar();assert.equal(t.form.elements.acabado.disabled,true);t.submit();
    assert.equal(new URL(t.contexto.location.href).searchParams.has('acabado'),false,'La serie sólo afecta al muestrario');
  }
  const nuevo=await entorno('?estado=nuevo'),m=nuevo.contexto.CAOZ_COLECCION;
  assert.ok(m.ids().every(id=>m.cantidad(id)===1&&m.elegido(id)==='normal'),'Una página nueva no hereda las copias del muestrario');
  const invalido=await entorno('?estado=muestrario&acabado=inventado');
  assert.ok(invalido.contexto.CAOZ_COLECCION.ids().every(id=>invalido.contexto.CAOZ_COLECCION.elegido(id)==='normal'));
  console.log('✓ Las tres series del muestrario se comparten por URL y sólo existen en memoria, sin alterar el jugador nuevo.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

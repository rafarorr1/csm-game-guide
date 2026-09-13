/* Originales locales por acabado: catálogo y estudio reales con disco temporal
   y respuestas simuladas. No se consulta ni escribe ninguna base del estudio. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const copiar=v=>JSON.parse(JSON.stringify(v));
const codigoEstudio=readFileSync(new URL('./estudio.js',import.meta.url),'utf8');
const codigoVistas=readFileSync(new URL('./arte-vistas.js',import.meta.url),'utf8');
const generador=readFileSync(new URL('./generar_catalogo_arte.mjs',import.meta.url),'utf8');
const bytes=readFileSync(new URL('./art/tal.webp',import.meta.url));
const normal={url:'art/tal.webp',encuadre:{x:50,y:61,z:100}};
const foil={url:'art/tal-foil-v1.webp',encuadre:{x:41,y:29,z:105},placeholder:true,estilo:'grabado'};
const vistasDorado={desktop_coleccion:{x:45,y:100,z:135},desktop_detalle:{x:45,y:41,z:118},desktop_mano:{x:45,y:100,z:118},desktop_memoria:{x:45,y:58,z:118},desktop_revelada:{x:45,y:100,z:136}};
const dorado={url:'art/tal-dorado-final-v1.webp',encuadre:{x:45,y:91,z:118},vistas:vistasDorado,estilo:'final'};
const carta={id:'tal',nombre:'Thal',tipo:'personaje',simbolo:'✦',mazos:[],original:normal,originales:{normal,foil,dorado}};
let comprobaciones=0;
async function caso(nombre,fn){await fn();comprobaciones++;console.log('✓ '+nombre);}

await caso('El catálogo conserva Normal y deriva originales independientes, sin fabricar versiones ausentes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'caoz-originales-'));
  try{
    mkdirSync(join(dir,'art'));
    writeFileSync(join(dir,'generar_catalogo_arte.mjs'),generador);
    writeFileSync(join(dir,'arte-vistas.js'),codigoVistas);
    writeFileSync(join(dir,'motor.js'),"const CARDS={tal:{n:'Thal',t:'personaje'},rey:{n:'El Rey',t:'personaje'}};const LEADERS={};const DECKS={};");
    for(const ruta of ['tal.webp','rey.webp','tal-foil-v1.webp','tal-dorado-final-v1.webp'])writeFileSync(join(dir,'art',ruta),bytes);
    const encuadres={tal:{x:50,y:61,z:100,variantes:{foil:{...foil.encuadre,url:foil.url,placeholder:true,estilo:foil.estilo},dorado:{...dorado.encuadre,url:dorado.url,estilo:dorado.estilo,vistas:{...vistasDorado,inventada:{x:10,y:10,z:100},movil_mano:{x:10,y:10,z:900}}}}},rey:45};
    const escribir=()=>writeFileSync(join(dir,'art/encuadres.json'),JSON.stringify(encuadres));
    const ejecutar=(...args)=>execFileSync(process.execPath,[join(dir,'generar_catalogo_arte.mjs'),...args],{encoding:'utf8',stdio:'pipe'});
    escribir();ejecutar();ejecutar('--comprobar');
    const salida=JSON.parse(readFileSync(join(dir,'art/catalogo.json'))),[tal,rey]=salida.cartas;
    assert.deepEqual(tal.original,normal);assert.deepEqual(tal.originales,{normal,foil,dorado});
    assert.deepEqual(tal.originales.dorado.vistas,vistasDorado,'Se conservan las cinco vistas publicadas de Thal y se descartan entradas inválidas');
    assert.equal(Object.hasOwn(rey,'originales'),false);assert.deepEqual(rey.original.encuadre,{x:50,y:45,z:100});
    for(const ruta of ['https://otro.invalid/tal.webp','art/../tal-foil-v1.webp','art/rey-foil-v1.webp']){
      encuadres.tal.variantes.foil.url=ruta;escribir();assert.throws(ejecutar,/Ruta original inválida/);
    }
    encuadres.tal.variantes.foil.url=foil.url;encuadres.tal.variantes.foil.z=900;escribir();assert.throws(ejecutar,/Encuadre original inválido/);
    encuadres.tal.variantes.foil.z=100;escribir();rmSync(join(dir,foil.url));assert.throws(ejecutar,/Falta la ilustración original/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

class Nodo{
  constructor(){this.dataset={};this.value='';this.children=[];this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.atributos={};this.eventos={};this.clases=new Set();this.classList={add:x=>this.clases.add(x),remove:x=>this.clases.delete(x),toggle:(x,valor)=>{if(valor??!this.clases.has(x))this.clases.add(x);else this.clases.delete(x);}};this.style={setProperty(){}};this.contentWindow={postMessage(){}};}
  setAttribute(k,v){this.atributos[k]=String(v);}
  removeAttribute(k){delete this.atributos[k];if(k==='src')this.src='';}
  append(...h){this.children.push(...h);}
  replaceChildren(...h){this.children=[...h];}
  querySelector(){return new Nodo();}
  addEventListener(k,fn){this.eventos[k]=fn;}
  focus(){}
  showModal(){this.open=true;}
  close(){this.open=false;this.eventos.close?.();}
}
function entorno(c=carta,registros={},version='foil'){
  const nodos=new Map(),peticiones=[],respuestas=[],fallos={imagen:false};
  const nodo=id=>{if(!nodos.has(id))nodos.set(id,new Nodo());return nodos.get(id);};
  const context={console,URL,URLSearchParams,Blob,Response,AbortController,setTimeout,clearTimeout,innerWidth:1000,location:new URL('https://juego.caozcontodo.com/estudio.html'),
    document:{getElementById:nodo,createElement:()=>new Nodo(),querySelector:()=>new Nodo(),querySelectorAll:()=>[]},addEventListener(){},matchMedia:()=>({matches:true}),
    CAOZ_ESTUDIO:{ruta:r=>r.replace(/api\/(arte|sfx)\//,'api/estudio/$1/'),actualizar:async()=>{}},
    fetch:async(url,op={})=>{
      peticiones.push({url:String(url),...op});
      if(new URL(url).pathname.startsWith('/art/'))return new Response(bytes,{status:fallos.imagen?503:200,headers:{'Content-Type':'image/webp'}});
      const siguiente=respuestas.shift();assert.ok(siguiente,'Toda escritura simulada debe tener respuesta preparada');
      return new Response(JSON.stringify(siguiente.body),{status:siguiente.status||200,headers:{'Content-Type':'application/json'}});
    }};
  context.window=context;vm.createContext(context);vm.runInContext(codigoVistas,context);
  const inicio='  bloquear(true);cargar().catch(fallo).finally(()=>bloquear(false));';
  assert.ok(codigoEstudio.includes(inicio));
  const puente=`window.prueba={configurar(c,registros,a){cartas=[c];privados=new Map([[c.id,{id:c.id,variantes:registros}]]);seleccion=c.id;acabado=a;autenticado=true;descartar();detalle();},estado(){const c=actual();return {url:urlVersion(c),encuadre:encuadre(c),creada:creada(c),arte:estadoArte(c),vistas:encuadres(c),conflicto,pendiente:!!pendiente};},guardar,subir(blob){descartar();pendiente={id:seleccion,acabado,revision:revision(actual()),blob,nombre:'Nuevo diseño.webp',encuadre:encuadre(actual()),vistas:encuadres(actual())};vista();},seleccionar(a){descartar();acabado=a;detalle();}};`;
  vm.runInContext(codigoEstudio.replace(inicio,puente),context,{filename:'estudio.js'});
  const api=context.prueba;api.configurar(copiar(c),copiar(registros),version);
  const editar=()=>{nodo('encX').value=20;nodo('encY').value=30;nodo('encZ').value=120;nodo('encX').oninput();};
  const respuesta=(a,revision=1,extra={})=>respuestas.push({body:{id:c.id,acabado:a,activo:true,heredada:false,revision,hash:'snapshot',x:41,y:29,z:105,vistas:{desktop_mano:{x:20,y:30,z:120}},...extra}});
  return {api,nodo,peticiones,respuestas,fallos,editar,respuesta};
}

await caso('Los premium locales están creados y conservan arte y encuadres aunque exista Normal remoto',()=>{
  const e=entorno(carta,{normal:{hash:'normal_remoto',x:8,y:9,z:140,revision:2}});
  assert.equal(e.api.estado().creada,true);assert.equal(e.api.estado().url,'https://juego.caozcontodo.com/'+foil.url);assert.deepEqual(copiar(e.api.estado().encuadre),foil.encuadre);
  assert.equal(e.nodo('crearAcabado').hidden,true);assert.equal(e.nodo('restaurar').disabled,true);assert.equal(e.nodo('original').href,'https://juego.caozcontodo.com/'+foil.url);
  e.api.seleccionar('dorado');assert.equal(e.api.estado().url,'https://juego.caozcontodo.com/'+dorado.url);assert.deepEqual(copiar(e.api.estado().encuadre),dorado.encuadre);
  e.api.seleccionar('normal');assert.match(e.api.estado().url,/api\/estudio\/arte\/imagen\/normal_remoto$/);assert.deepEqual(copiar(e.api.estado().encuadre),{x:8,y:9,z:140});
  const provisional=entorno({...carta,originales:{normal,foil}});assert.equal(provisional.api.estado().arte,'provisional');
});

await caso('Sólo un remoto exacto activo propio o heredado prevalece sobre el original premium',()=>{
  const normales={hash:'normal_remoto',x:8,y:9,z:140,revision:2};
  for(const p of [{activo:true,hash:'premium_propio',heredada:false,x:11,y:12,z:130},{activo:true,hash:'normal_heredado',heredada:true,x:11,y:12,z:130}]){
    const e=entorno(carta,{normal:normales,foil:p});assert.ok(e.api.estado().url.endsWith('/'+(p.heredada?normales.hash:p.hash)),'La herencia resuelve Normal vigente antes del hash heredado de una respuesta anterior');assert.deepEqual(copiar(e.api.estado().encuadre),{x:11,y:12,z:130});assert.equal(e.nodo('restaurar').disabled,false);
  }
  const heredada=entorno(carta,{normal:normales,foil:{activo:true,heredada:true,hash:null,x:0,y:10,z:110}});
  assert.match(heredada.api.estado().url,/normal_remoto$/);assert.deepEqual(copiar(heredada.api.estado().encuadre),{x:0,y:10,z:110});assert.match(heredada.nodo('origen').textContent,/Usa ilustración Normal/);
  const borrada=entorno(carta,{normal:normales,foil:{activo:false,hash:'antiguo',x:0,y:0,z:200,revision:3}});
  assert.equal(borrada.api.estado().url,'https://juego.caozcontodo.com/'+foil.url);assert.deepEqual(copiar(borrada.api.estado().encuadre),foil.encuadre);assert.equal(borrada.nodo('restaurar').disabled,true);
});

await caso('El primer encuadre local se guarda con los mismos bytes y los siguientes conservan su imagen propia',async()=>{
  const e=entorno();e.editar();e.respuesta('foil');await e.nodo('guardar').onclick();
  assert.equal(e.peticiones.length,2);const [leer,guardar]=e.peticiones;
  assert.equal(leer.url,'https://juego.caozcontodo.com/'+foil.url);assert.equal(guardar.method,'PUT');assert.match(guardar.url,/api\/estudio\/arte\/carta\/tal\/foil/);
  assert.deepEqual(Buffer.from(await guardar.body.arrayBuffer()),bytes);assert.equal(guardar.headers['If-Match'],'0');assert.match(decodeURIComponent(guardar.headers['X-Arte-Nombre']),/Foil original local/);
  assert.deepEqual(JSON.parse(guardar.headers['X-Arte-Encuadre']),{...foil.encuadre,vistas:{desktop_mano:{x:20,y:30,z:120}}});
  assert.equal(e.api.estado().pendiente,false);assert.match(e.api.estado().url,/imagen\/snapshot$/);
  e.nodo('encX').value=24;e.nodo('encX').oninput();e.respuesta('foil',2);await e.nodo('guardar').onclick();
  assert.equal(e.peticiones.length,3);assert.equal(e.peticiones[2].method,'PATCH');assert.equal(e.peticiones[2].headers['If-Match'],'1');
});

await caso('Thal Dorado conserva sus cinco vistas y editar una no borra las otras cuatro en el primer PUT',async()=>{
  const e=entorno(carta,{},'dorado');assert.deepEqual(copiar(e.api.estado().vistas),vistasDorado);assert.equal(e.nodo('encY').value,100);
  e.editar();const ajustadas={...vistasDorado,desktop_mano:{x:20,y:30,z:120}};
  e.respuesta('dorado',1,{...dorado.encuadre,vistas:ajustadas});await e.nodo('guardar').onclick();
  const [leer,guardar]=e.peticiones;assert.equal(leer.url,'https://juego.caozcontodo.com/'+dorado.url);assert.equal(guardar.method,'PUT');
  assert.deepEqual(JSON.parse(guardar.headers['X-Arte-Encuadre']),{...dorado.encuadre,vistas:ajustadas});assert.equal(Object.keys(ajustadas).length,5);
  assert.deepEqual(copiar(e.api.estado().vistas),ajustadas);assert.deepEqual(vistasDorado.desktop_mano,{x:45,y:100,z:118});
  const remoto=entorno(carta,{dorado:{activo:true,hash:'propio',x:60,y:70,z:100,vistas:{}}},'dorado');
  assert.deepEqual(copiar(remoto.api.estado().vistas),{},'Un registro remoto con vistas vacías elige su base y no resucita ajustes locales');assert.equal(remoto.nodo('encY').value,70);
  const restaurado=entorno(carta,{dorado:{activo:false,hash:null,x:null,y:null,z:null,vistas:{},revision:4}},'dorado');assert.deepEqual(copiar(restaurado.api.estado().vistas),vistasDorado);
});

await caso('La herencia explícita conserva PATCH y los reemplazos subidos conservan PUT',async()=>{
  const e=entorno(carta,{foil:{activo:true,heredada:true,hash:'normal_remoto',x:1,y:2,z:100,revision:4}});
  e.editar();e.respuesta('foil',5,{heredada:true,hash:'normal_remoto'});await e.nodo('guardar').onclick();
  assert.equal(e.peticiones.length,1);assert.equal(e.peticiones[0].method,'PATCH');assert.equal(e.peticiones[0].headers['If-Match'],'4');
  const propia=entorno(),archivo=new Blob([bytes],{type:'image/webp'});propia.api.subir(archivo);propia.respuesta('foil');await propia.nodo('guardar').onclick();
  assert.equal(propia.peticiones.length,1);assert.equal(propia.peticiones[0].method,'PUT');assert.equal(propia.peticiones[0].body,archivo);assert.equal(decodeURIComponent(propia.peticiones[0].headers['X-Arte-Nombre']),'Nuevo diseño.webp');
});

await caso('Restaurar un premium vuelve a su original y encuadre local sin afectar Normal',async()=>{
  const e=entorno(carta,{normal:{hash:'normal_remoto',x:8,y:9,z:140,revision:2},foil:{activo:true,hash:'foil_remoto',revision:3,x:5,y:6,z:140}});
  const restaurando=e.nodo('restaurar').onclick();assert.match(e.nodo('confirmacionTitulo').textContent,/Restaurar Foil/);assert.match(e.nodo('confirmacionTexto').textContent,/imagen y encuadre originales/);
  e.respuesta('foil',4,{activo:false,hash:null,x:null,y:null,z:null,vistas:{}});e.nodo('confirmacion').returnValue='aceptar';e.nodo('confirmacion').close();await restaurando;
  assert.equal(e.peticiones[0].method,'DELETE');assert.equal(e.peticiones[0].headers['If-Match'],'3');assert.equal(e.api.estado().url,'https://juego.caozcontodo.com/'+foil.url);assert.deepEqual(copiar(e.api.estado().encuadre),foil.encuadre);assert.equal(e.api.estado().creada,true);assert.equal(e.nodo('restaurar').disabled,true);
  e.api.seleccionar('normal');assert.match(e.api.estado().url,/normal_remoto$/);
});

await caso('Un original fallido o una ruta inválida no envía escrituras y conserva el ajuste para reintentar',async()=>{
  const e=entorno();e.editar();e.fallos.imagen=true;await e.nodo('guardar').onclick();assert.equal(e.peticiones.length,1);assert.equal(e.api.estado().pendiente,true);assert.equal(e.api.estado().conflicto,false);
  e.fallos.imagen=false;e.respuesta('foil');await e.nodo('guardar').onclick();assert.equal(e.peticiones.at(-1).method,'PUT');assert.equal(e.api.estado().pendiente,false);
  for(const url of ['https://otro.invalid/tal.webp','art/../tal-foil-v1.webp','art/rey-foil-v1.webp']){
    const mal=entorno({...carta,originales:{normal,foil:{...foil,url}}});mal.editar();await mal.nodo('guardar').onclick();assert.equal(mal.peticiones.length,0);assert.equal(mal.api.estado().pendiente,true);
  }
});

await caso('Una revisión en conflicto conserva el borrador sin sobreescribir la respuesta privada',async()=>{
  const e=entorno();e.editar();e.respuestas.push({status:409,body:{error:'Revisión nueva'}});await e.nodo('guardar').onclick();assert.equal(e.api.estado().pendiente,true);assert.equal(e.api.estado().conflicto,true);assert.equal(e.nodo('guardar').disabled,true);assert.equal(e.api.estado().url,'https://juego.caozcontodo.com/'+foil.url);
});

console.log('\nOriginales por acabado: '+comprobaciones+' pruebas aprobadas.');

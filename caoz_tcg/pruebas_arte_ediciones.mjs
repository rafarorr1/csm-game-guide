// Consumidor real, con originales sintéticos: no necesita imágenes ni servicios.
// Ejecutar: node caoz_tcg/pruebas_arte_ediciones.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const fuente=readFileSync(new URL('./arte-remoto.js',import.meta.url),'utf8');
const vistas=readFileSync(new URL('./arte-vistas.js',import.meta.url),'utf8');
const copiar=v=>JSON.parse(JSON.stringify(v));
const enc=(x,y,z)=>({x,y,z});
const CLAVE='caoz_arte_publico_v1:/juego/';
const originales={
  tal:{...enc(45,91,118),variantes:{
    foil:{url:'art/tal-foil-v1.webp',...enc(32,41,125),placeholder:true,estilo:'Luz prismática',vistas:{movil_detalle:enc(23,34,90),desktop_mano:enc(62,49,130)}},
    dorado:{url:'art/tal-dorado-final-v1.webp',...enc(71,55,105),placeholder:false,estilo:'Grabado',vistas:{desktop_detalle:enc(66,21,95),movil_detalle:enc(67,22,96)}},
  }},
  eric:64,
  lider_fender:{...enc(50,52,100),variantes:{foil:{url:'art/lider_fender-foil-v1.webp',...enc(44,33,115)}}},
};
const reg=(acabado,letra,x=61,otros={})=>({id:'tal',acabado,revision:2,activo:true,heredada:false,hash:letra?.repeat(64)??null,mime:letra?'image/webp':null,...enc(x,30,110),vistas:{},...otros});
const catalogo=variantes=>({cartas:[{id:'tal',variantes}]});
const forzar=acabado=>({closest:()=>({dataset:{coleccionAcabado:acabado}})});

function cliente(codigo=fuente,opciones={}){
  const estado={originales:copiar(originales),catalogo:{cartas:[]},falloLocal:null,falloCatalogo:null,elegido:'normal',...opciones};
  const almacen=new Map(opciones.almacen||[]),temporizadores=new Map(),eventos=new Map(),pedidos=[];let numero=0;
  const c={URL,URLSearchParams,AbortController,Event,
    location:{href:'https://juego.example/juego/index.html',search:'',protocol:'https:'},
    document:{hidden:false,documentElement:{},querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){}},
    MutationObserver:class{observe(){}},
    setTimeout(fn,ms){const id=++numero;temporizadores.set(id,{fn,ms});return id;},
    clearTimeout(id){temporizadores.delete(id);},setInterval(){},
    addEventListener(nombre,fn){eventos.set(nombre,fn);},dispatchEvent(){},
    localStorage:{getItem:k=>almacen.get(k)||null,setItem:(k,v)=>almacen.set(k,v)},
    CARDS:{tal:{},eric:{}},LEADERS:{fender:{}},ARTE:{},cargarArte(){},
    CAOZ_COLECCION:{elegido:()=>estado.elegido},
    encuadreDe:e=>typeof e==='number'?enc(50,e,100):e?enc(e.x,e.y,e.z):null,
    fetch:async(url,opciones)=>{
      const local=String(url).endsWith('art/encuadres.json'),fallo=local?estado.falloLocal:estado.falloCatalogo;
      pedidos.push({url:String(url),opciones});
      if(fallo==='red')throw new Error('Sin conexión');
      return {ok:fallo!=='http',json:async()=>{if(fallo==='json')throw new SyntaxError('JSON incompleto');return copiar(local?estado.originales:estado.catalogo);}};
    },
  };
  c.window=c;c.parent=c;vm.createContext(c);
  vm.runInContext(vistas,c,{filename:'arte-vistas.js'});vm.runInContext(codigo,c,{filename:'arte-remoto.js'});
  return {c,estado,almacen,temporizadores,pedidos,
    version:(acabado='normal',vista,id='tal')=>copiar(c.CAOZ_ARTE.version(id,acabado,vista)),
    async cargar(){await c.cargarArte();await c.CAOZ_ARTE.refrescar();},
    async publicar(datos){estado.catalogo=datos;estado.falloCatalogo=null;return c.CAOZ_ARTE.refrescar();},
    seleccionar(acabado){estado.elegido=acabado;eventos.get('caoz:coleccion')();},
    async reintentar(){
      const pendiente=[...temporizadores].find(([,t])=>t.ms===1500||t.ms===3000);
      assert.ok(pendiente,'Queda un reintento breve programado');
      temporizadores.delete(pendiente[0]);pendiente[1].fn();await c.CAOZ_ARTE.refrescar();
    },
  };
}

const pruebas=[];
const prueba=(nombre,fn)=>pruebas.push({nombre,fn});

prueba('original Normal, ediciones locales y compatibilidad numérica',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  assert.deepEqual(t.version(),{acabado:'normal',url:'art/tal.webp',encuadre:enc(45,91,118),disenoPropio:false});
  for(const a of ['foil','dorado']){
    const v=t.version(a);assert.equal(v.url,originales.tal.variantes[a].url);assert.equal(v.disenoPropio,true);
    assert.deepEqual(v.encuadre,enc(...['x','y','z'].map(k=>originales.tal.variantes[a][k])));
  }
  assert.deepEqual(t.version('normal',undefined,'eric').encuadre,enc(50,64,100));
  assert.equal(t.version('foil',undefined,'lider_fender').url,'art/lider_fender-foil-v1.webp');
  assert.deepEqual(t.estado.originales,originales,'Resolver no modifica el original ni sus variantes');
  assert.equal(t.c.CAOZ_ARTE.version('retirada','foil'),null);
  assert.deepEqual(t.version('inventado'),t.version('normal'));
});

prueba('vistas y metadatos independientes de cada edición local',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  assert.equal(t.version('foil').placeholder,true);assert.equal(t.version('foil').estilo,'Luz prismática');
  assert.equal(t.version('dorado').placeholder,false);
  assert.deepEqual(t.version('foil','movil_detalle').encuadre,enc(23,34,90));
  assert.deepEqual(t.version('foil','desktop_detalle').encuadre,enc(23,34,90),'Una vista ausente hereda su pareja de pantalla');
  assert.deepEqual(t.version('foil','movil_mano').encuadre,enc(62,49,130));
  assert.deepEqual(t.version('foil','movil_campo').encuadre,enc(32,41,125),'Una superficie sin ajuste utiliza la base de esa edición');
  assert.deepEqual(t.version('dorado','desktop_detalle').encuadre,enc(66,21,95));
  assert.deepEqual(t.version('dorado','movil_detalle').encuadre,enc(67,22,96));
  assert.deepEqual(t.version('normal','movil_detalle').encuadre,enc(45,91,118),'Normal no recibe el recorte premium');
});

prueba('el original premium precede al remoto Normal',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  await t.publicar(catalogo({normal:reg('normal','a',60,{vistas:{movil_detalle:enc(10,20,80)}})}));
  assert.equal(t.version().url,'api/arte/imagen/'+'a'.repeat(64));
  assert.deepEqual(t.version('normal','desktop_detalle').encuadre,enc(10,20,80));
  for(const a of ['foil','dorado'])assert.equal(t.version(a).url,originales.tal.variantes[a].url,'El remoto Normal no tapa la edición local '+a);
  assert.deepEqual(t.version('foil','movil_detalle').encuadre,enc(23,34,90));
  assert.equal(t.c.acabadoArte('tal'),'normal','Recuperar arte no equipa una edición');
});

prueba('cada remoto exacto sustituye sólo su edición',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  await t.publicar(catalogo({normal:reg('normal','a'),foil:reg('foil','b',31,{vistas:{desktop_detalle:enc(11,24,150)}})}));
  assert.equal(t.version('foil').url,'api/arte/imagen/'+'b'.repeat(64));assert.equal(t.version('foil').disenoPropio,true);
  assert.deepEqual(t.version('foil','movil_detalle').encuadre,enc(11,24,150));
  assert.equal(t.version('dorado').url,originales.tal.variantes.dorado.url);
  await t.publicar(catalogo({normal:reg('normal','a'),foil:reg('foil','b'),dorado:reg('dorado','c',73)}));
  assert.equal(t.version('dorado').url,'api/arte/imagen/'+'c'.repeat(64));
  assert.deepEqual(t.version('dorado').encuadre,enc(73,30,110));
  assert.equal(t.version().url,'api/arte/imagen/'+'a'.repeat(64),'Publicar Dorado conserva Normal');
});

prueba('herencia remota explícita conserva prioridad y encuadre premium',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  for(const otros of [{heredada:true},{hash:null,mime:null}]){
    await t.publicar(catalogo({normal:reg('normal','a'),foil:reg('foil','b',19,{...otros,vistas:{movil_detalle:enc(12,18,140)}})}));
    assert.equal(t.version('foil').url,'api/arte/imagen/'+'a'.repeat(64));
    assert.equal(t.version('foil').disenoPropio,false);
    assert.deepEqual(t.version('foil').encuadre,enc(19,30,110));
    assert.deepEqual(t.version('foil','desktop_detalle').encuadre,enc(12,18,140));
  }
  await t.publicar(catalogo({normal:reg('normal','a',61,{activo:false}),foil:reg('foil',null,19)}));
  assert.equal(t.version('foil').url,'art/tal.webp','La herencia explícita sin Normal activo vuelve al original Normal');
  assert.deepEqual(t.version('foil').encuadre,enc(19,30,110));
  assert.equal(t.version('dorado').url,originales.tal.variantes.dorado.url);
});

prueba('restaurar un remoto devuelve su original local',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  const normal=reg('normal','a'),foil=reg('foil','b'),dorado=reg('dorado','c');
  await t.publicar(catalogo({normal,foil,dorado}));
  await t.publicar(catalogo({normal,foil:{...foil,revision:3,activo:false},dorado}));
  assert.equal(t.version('foil').url,originales.tal.variantes.foil.url);
  assert.deepEqual(t.version('foil','desktop_detalle').encuadre,enc(23,34,90));
  assert.equal(t.version('dorado').url,'api/arte/imagen/'+'c'.repeat(64));
  await t.publicar(catalogo({normal,foil:{...foil,revision:4,activo:false,hash:null,mime:null,x:null,y:null,z:null},dorado:{...dorado,activo:false}}));
  for(const a of ['foil','dorado'])assert.equal(t.version(a).url,originales.tal.variantes[a].url);
  await t.publicar(catalogo({normal,foil:{...foil,revision:5},dorado}));
  assert.equal(t.version('foil').url,'api/arte/imagen/'+'b'.repeat(64),'Una edición restaurada puede publicarse de nuevo');
  await t.publicar({cartas:[]});assert.equal(t.version().url,'art/tal.webp');
  for(const a of ['foil','dorado'])assert.equal(t.version(a).url,originales.tal.variantes[a].url);
  assert.equal(await t.publicar({cartas:[]}),false,'El catálogo idéntico no provoca otra actualización');
});

prueba('una carta sin original premium conserva la herencia histórica',async codigo=>{
  const t=cliente(codigo);await t.cargar();
  assert.equal(t.version('foil',undefined,'eric').url,'art/eric.webp');
  const normal={...reg('normal','d',27),id:'eric'};
  await t.publicar({cartas:[normal]});
  for(const a of ['normal','foil','dorado']){
    const v=t.version(a,undefined,'eric');assert.equal(v.url,'api/arte/imagen/'+'d'.repeat(64));
    assert.deepEqual(v.encuadre,enc(27,30,110));assert.equal(v.disenoPropio,a==='normal');
  }
});

prueba('rutas de originales limitadas a la carta y edición propias',async codigo=>{
  for(const url of ['https://ajena.example/tal.webp','//ajena.example/tal.webp','data:image/webp;base64,AA','blob:https://juego.example/id','../art/tal-foil-v1.webp','art/eric-foil-v1.webp','art/tal-dorado-v1.webp','art/tal-foil-v1.webp?otra=1','art/tal-foil-v1.webp/../otro','art/tal-foil-v2.webp']){
    const datos=copiar(originales);datos.tal.variantes.foil.url=url;
    const t=cliente(codigo,{originales:datos});await t.cargar();
    assert.equal(t.version('foil').url,'art/tal.webp','Se descarta una ruta ajena o no autorizada: '+url);
    assert.equal(JSON.parse(t.almacen.get(CLAVE)).originales.tal.variantes.foil,undefined,'La caché no conserva la URL inválida');
  }
  const datos=copiar(originales);datos.tal.variantes.foil.url='art/tal-foil-final-v1.webp';
  datos.tal.variantes.normal={url:'https://ajena.example/normal.webp',...enc(1,2,90)};
  datos.retirada={...enc(50,50,100),variantes:datos.tal.variantes};
  const t=cliente(codigo,{originales:datos});await t.cargar();
  assert.equal(t.version('foil').url,'art/tal-foil-final-v1.webp');assert.equal(t.version().url,'art/tal.webp');
  assert.equal(t.c.CAOZ_ARTE.version('retirada','foil'),null);
});

prueba('datos inválidos no sustituyen originales ni vistas válidas',async codigo=>{
  for(const cambio of [{x:-1},{y:101},{z:49},{z:301},{x:'50'},{x:null}]){
    const datos=copiar(originales);Object.assign(datos.tal.variantes.foil,cambio);
    const t=cliente(codigo,{originales:datos});await t.cargar();assert.equal(t.version('foil').url,'art/tal.webp');
  }
  const datos=copiar(originales);Object.assign(datos.tal.variantes.foil,{placeholder:'sí',estilo:'x'.repeat(120),vistas:{movil_detalle:enc(-1,50,100),desktop_detalle:enc(20,30,90),inventada:enc(30,40,120),movil_mano:[]}});
  const t=cliente(codigo,{originales:datos});await t.cargar();
  assert.equal(t.version('foil').placeholder,false);assert.equal(t.version('foil').estilo.length,80);
  assert.deepEqual(t.version('foil','movil_detalle').encuadre,enc(20,30,90));
  assert.deepEqual(t.version('foil','movil_mano').encuadre,enc(32,41,125));
  for(const cambio of [{x:-1},{hash:'https://ajena.example/imagen'},{id:'eric'},{revision:-1},{mime:'text/html'}]){
    await t.publicar(catalogo({normal:reg('normal','a'),foil:reg('foil','b',40,cambio)}));
    assert.equal(t.version('foil').url,'art/tal-foil-v1.webp','Un remoto mal formado no oculta el original premium');
  }
  await t.publicar(catalogo({foil:reg('foil','b',40,{url:'https://ajena.example/imagen'})}));
  assert.equal(t.version('foil').url,'api/arte/imagen/'+'b'.repeat(64),'El catálogo sólo resuelve imágenes por hash validado');
});

prueba('fallos del catálogo conservan ediciones locales y reintentos acotados',async codigo=>{
  for(const fallo of ['http','red','json']){
    const t=cliente(codigo,{falloCatalogo:fallo});await t.cargar();
    for(const a of ['foil','dorado'])assert.equal(t.version(a).url,originales.tal.variantes[a].url);
    await t.reintentar();await t.reintentar();
    assert.equal(t.pedidos.filter(p=>p.url.endsWith('api/arte/catalogo')).length,3);
    assert.equal(t.temporizadores.size,0,'Un catálogo caído no crea un bucle rápido');
    for(const p of t.pedidos){assert.equal(p.opciones.credentials,'omit');assert.equal(p.opciones.cache,'no-store');assert.ok(p.opciones.signal instanceof AbortSignal);}
    await t.publicar(catalogo({foil:reg('foil','b')}));assert.equal(t.version('foil').url,'api/arte/imagen/'+'b'.repeat(64));
  }
  const t=cliente(codigo);await t.cargar();await t.publicar(catalogo({foil:reg('foil','b')}));
  for(const roto of [null,{},[],{cartas:[null]},{cartas:[{id:'tal'},{id:'tal'}]}]){
    t.estado.catalogo=roto;assert.equal(await t.c.CAOZ_ARTE.refrescar(),false);
    assert.equal(t.version('foil').url,'api/arte/imagen/'+'b'.repeat(64),'Un catálogo inválido conserva la última publicación válida');
    assert.equal(t.version('dorado').url,originales.tal.variantes.dorado.url);
  }
});

prueba('la caché pública conserva originales al arrancar sin conexión',async codigo=>{
  const previo=cliente(codigo);await previo.cargar();
  for(const fallo of ['http','red','json']){
    const t=cliente(codigo,{almacen:previo.almacen,falloLocal:fallo,falloCatalogo:fallo});
    for(const a of ['foil','dorado'])assert.equal(t.version(a).url,originales.tal.variantes[a].url,'La edición está lista antes de la red');
    await t.cargar();assert.deepEqual(t.version('foil','desktop_detalle').encuadre,enc(23,34,90));
    assert.deepEqual([...t.almacen.keys()],[CLAVE],'El consumidor sólo escribe su caché pública');
    assert.equal(t.c.acabadoArte('tal'),'normal');
  }
  const cache=JSON.parse(previo.almacen.get(CLAVE));cache.originales.tal.variantes.foil.url='https://ajena.example/imagen';
  const t=cliente(codigo,{almacen:[[CLAVE,JSON.stringify(cache)]],falloLocal:'red',falloCatalogo:'red'});
  assert.equal(t.version('foil').url,'art/tal.webp','El arranque también valida URLs persistidas');
  assert.equal(t.version('dorado').url,originales.tal.variantes.dorado.url);
});

prueba('selección y previews resuelven la misma edición sin alterar inventario',async codigo=>{
  const t=cliente(codigo);await t.cargar();t.seleccionar('foil');
  assert.equal(t.c.urlArte('tal'),'art/tal-foil-v1.webp');assert.equal(t.c.acabadoArte('tal'),'foil');
  assert.deepEqual(copiar(t.c.ARTE.tal),enc(32,41,125));
  assert.equal(t.c.urlArte('tal',forzar('dorado')),'art/tal-dorado-final-v1.webp');
  assert.deepEqual(copiar(t.c.CAOZ_ARTE.encuadre('tal','desktop_detalle',forzar('dorado'))),enc(66,21,95));
  assert.equal(t.c.CAOZ_COLECCION.elegido('tal'),'foil','Mirar Dorado no lo equipa');
  await t.publicar(catalogo({normal:reg('normal','a')}));
  assert.deepEqual(copiar(t.c.ARTE.tal),enc(32,41,125),'Refrescar Normal conserva el encuadre seleccionado local');
  t.seleccionar('normal');assert.deepEqual(copiar(t.c.ARTE.tal),enc(61,30,110));
  assert.equal(t.c.urlArte('tal'),'api/arte/imagen/'+'a'.repeat(64));
  assert.deepEqual([...t.almacen.keys()],[CLAVE]);
});

for(const {nombre,fn}of pruebas){await fn(fuente);console.log('OK · '+nombre);}

// Se alteran sólo copias en memoria del consumidor; nunca los archivos del juego.
const sabotajes=[
  ['omitir original premium',2,'if(local&&!(propio?.activo&&encValido(propio)))','if(false)'],
  ['anteponer local a publicación exacta',3,'if(local&&!(propio?.activo&&encValido(propio)))','if(local)'],
  ['permitir URL ajena',7,'["art/"+id+\'-\'+a+\'-v1.webp\',"art/"+id+\'-\'+a+\'-final-v1.webp\'].includes(v.url)','typeof v.url===\'string\''],
  ['ignorar vistas locales',1,'CAOZ_VISTAS.resolver(local.vistas,vista,base)','base'],
];
for(const [nombre,indice,antes,despues]of sabotajes){
  assert.ok(fuente.includes(antes),'El punto de sabotaje sigue existiendo: '+nombre);
  await assert.rejects(()=>pruebas[indice].fn(fuente.replace(antes,despues)),{name:'AssertionError'},'La prueba detecta: '+nombre);
  console.log('DETECTADO · '+nombre);
}
console.log(pruebas.length+' pruebas de ediciones y '+sabotajes.length+' sabotajes en verde.');

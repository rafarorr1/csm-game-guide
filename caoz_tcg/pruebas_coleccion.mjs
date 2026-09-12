// Pruebas del inventario puro, sin navegador ni escrituras del jugador.
// Uso: node pruebas_coleccion.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const codigo=fs.readFileSync(new URL('./coleccion-modelo.js',import.meta.url),'utf8');
const limpiar=v=>JSON.parse(JSON.stringify(v));
let comprobaciones=0;
function caso(nombre,fn){fn();comprobaciones++;console.log('✓ '+nombre);}
function entorno(opciones={}){
  const mapa=opciones.mapa||new Map();
  const fallos={lectura:false,escritura:false};
  const eventos=[];
  const escuchas={};
  let escrituras=0,semilla=opciones.semilla??247;
  const url=new URL(opciones.url||'https://beta.caoz-tcg.pages.dev/');
  const context={
    location:{hostname:url.hostname,pathname:url.pathname,search:url.search},
    URLSearchParams,Uint32Array,Math,Date,Set,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    crypto:{getRandomValues(a){semilla=(Math.imul(1664525,semilla)+1013904223)>>>0;a[0]=semilla;return a;}},
    localStorage:{
      getItem(k){if(fallos.lectura)throw Error('Almacenamiento denegado');return mapa.get(k)??null;},
      setItem(k,v){if(fallos.escritura)throw Error('QuotaExceededError');mapa.set(k,String(v));escrituras++;},
    },
    dispatchEvent(event){eventos.push(limpiar({type:event.type,detail:event.detail}));},
    addEventListener(tipo,fn){escuchas[tipo]=fn;},
  };
  context.window=context;
  vm.createContext(context);
  const cartas=opciones.cartas??{eric:{},tal:{},token_zombie:{t:'ficha'}};
  const lideres=opciones.lideres??{fender:{},adreida:{}};
  vm.runInContext('const CARDS='+JSON.stringify(cartas)+'; const LEADERS='+JSON.stringify(lideres)+';',context);
  vm.runInContext(codigo,context,{filename:'coleccion-modelo.js'});
  return {api:context.CAOZ_COLECCION,mapa,fallos,eventos,escuchas,context,escrituras:()=>escrituras};
}

caso('Cada carta, ficha y protagonista empieza con Normal; premium cerrado',()=>{
  const {api,mapa}=entorno();
  assert.deepEqual(limpiar(api.acabados),['normal','foil','dorado']);
  assert.deepEqual(limpiar(api.ids()),['eric','tal','token_zombie','lider_fender','lider_adreida']);
  for(const id of api.ids()){
    assert.equal(api.tiene(id,'normal'),true);
    assert.equal(api.tiene(id,'foil'),false);
    assert.equal(api.tiene(id,'dorado'),false);
    assert.equal(api.elegido(id),'normal');
  }
  assert.equal(api.sobres(),0);assert.equal(api.pendiente(),null);
  assert.equal(api.abrirSobre(),null);
  assert.equal(mapa.size,0,'Leer no debe escribir ni regalar contenido');
});

caso('Desbloquear no equipa: selección explícita, reversible y persistente',()=>{
  const e=entorno(),{api}=e;
  assert.equal(api.seleccionar('tal','dorado'),false);
  assert.equal(api.desbloquear('tal','foil'),true);
  assert.equal(api.elegido('tal'),'normal');
  assert.equal(api.seleccionar('tal','foil'),true);
  assert.equal(api.desbloquear('tal','dorado'),true);
  assert.equal(api.elegido('tal'),'foil','Dorado no debe sustituir la elección');
  const recarga=entorno({mapa:e.mapa}).api;
  assert.equal(recarga.elegido('tal'),'foil');assert.equal(recarga.tiene('tal','dorado'),true);
  assert.equal(recarga.seleccionar('tal','dorado'),true);
  assert.equal(api.elegido('tal'),'dorado','Leer refleja otra pestaña sin estado obsoleto');
  assert.equal(recarga.seleccionar('tal','normal'),true);
  assert.equal(api.elegido('tal'),'normal');
  assert.equal(api.tiene('tal','dorado'),true);
  assert.equal(api.desbloquear('lider_adreida','dorado'),true);
  assert.equal(api.seleccionar('lider_adreida','dorado'),true);
});

caso('Llamadas inválidas, duplicados y copias no modifican el inventario',()=>{
  const {api,eventos,escrituras}=entorno();
  for(const id of ['__proto__','constructor','prototype','inexistente','<script>',null,0,{},'a'.repeat(200)]){
    assert.equal(api.desbloquear(id,'foil'),false);
    assert.equal(api.seleccionar(id,'foil'),false);
    assert.equal(api.tiene(id,'normal'),false);
    assert.equal(api.elegido(id),'normal');
  }
  for(const acabado of ['oro','FOIL',null,{},false]){
    assert.equal(api.desbloquear('tal',acabado),false);
    assert.equal(api.seleccionar('tal',acabado),false);
  }
  assert.equal(escrituras(),0);assert.equal(eventos.length,0);
  api.desbloquear('tal','foil');api.seleccionar('tal','foil');
  const cantidad=escrituras(),emitidos=eventos.length;
  assert.equal(api.desbloquear('tal','foil'),true);assert.equal(api.seleccionar('tal','foil'),true);
  assert.equal(escrituras(),cantidad);assert.equal(eventos.length,emitidos);
  const copia=api.leer();copia.desbloqueos.tal.push('dorado');copia.selecciones.tal='dorado';copia.sobres=999;
  const lista=api.ids();lista.pop();
  assert.equal(api.elegido('tal'),'foil');assert.equal(api.tiene('tal','dorado'),false);assert.equal(api.sobres(),0);
  assert.equal(api.ids().length,5);
});

caso('Sobre atómico: cinco Foil, doble clic y recarga conservan el mismo resultado',()=>{
  const e=entorno(),{api}=e;
  api.darSobreBeta();api.darSobreBeta();
  const antes=e.escrituras(),sobre=api.abrirSobre();
  assert.ok(sobre&&sobre.id);assert.equal(sobre.cartas.length,5);
  assert.equal(e.escrituras(),antes+1,'Apertura completa guardada en una única operación');
  assert.equal(api.sobres(),1);
  assert.equal(new Set(sobre.cartas.map(c=>c.id)).size,5);
  for(const c of sobre.cartas){assert.equal(c.acabado,'foil');assert.equal(c.nueva,true);assert.equal(api.tiene(c.id,c.acabado),true);assert.equal(api.elegido(c.id),'normal');assert.equal(api.tiene(c.id,'dorado'),false);}
  assert.deepEqual(limpiar(api.abrirSobre()),limpiar(sobre));
  assert.equal(e.escrituras(),antes+1);assert.equal(api.sobres(),1);
  assert.deepEqual(limpiar(entorno({mapa:e.mapa}).api.pendiente()),limpiar(sobre));
  const copia=api.pendiente();copia.cartas[0].acabado='normal';
  assert.notEqual(api.pendiente().cartas[0].acabado,'normal');
  assert.equal(api.cerrarSobre(),true);assert.equal(api.pendiente(),null);
  const segundo=api.abrirSobre();assert.ok(segundo);assert.notEqual(segundo.id,sobre.id);assert.equal(api.sobres(),0);
  assert.equal(segundo.cartas.every(c=>c.acabado==='foil'&&!c.nueva),true,'Los cinco IDs pueden repetirse respecto al sobre anterior');
});

caso('La colección Foil completa permite abrir sobres con repetidas y nunca concede Doradas',()=>{
  const {api}=entorno({cartas:{eric:{}},lideres:{}});
  api.darSobreBeta();const sobre=api.abrirSobre();
  assert.equal(sobre.cartas.length,5);assert.equal(sobre.cartas.filter(c=>c.nueva).length,1);
  assert.equal(api.tiene('eric','foil'),true);assert.equal(api.tiene('eric','dorado'),false);
  api.cerrarSobre();api.darSobreBeta();
  const segundo=api.abrirSobre();assert.ok(segundo);assert.equal(segundo.cartas.length,5);
  assert.equal(segundo.cartas.every(c=>c.id==='eric'&&c.acabado==='foil'&&!c.nueva),true);
  assert.equal(api.sobres(),0);
});

caso('El sorteo es independiente del inventario y no repite IDs dentro de un sobre',()=>{
  const cartas=Object.fromEntries(Array.from({length:17},(_,i)=>['carta_'+i,{}]));
  for(let semilla=1;semilla<=30;semilla++){
    const nueva=entorno({cartas,lideres:{},semilla}),completa=entorno({cartas,lideres:{},semilla});
    for(const id of completa.api.ids())completa.api.desbloquear(id,'foil');
    nueva.api.darSobreBeta();completa.api.darSobreBeta();
    const a=nueva.api.abrirSobre(),b=completa.api.abrirSobre();
    assert.deepEqual(limpiar(a.cartas.map(c=>c.id)),limpiar(b.cartas.map(c=>c.id)),'No se sustituyen repetidas por novedades');
    assert.equal(new Set(a.cartas.map(c=>c.id)).size,5);
    assert.equal(a.cartas.every(c=>c.acabado==='foil'&&c.nueva),true);
    assert.equal(b.cartas.every(c=>c.acabado==='foil'&&!c.nueva),true);
    assert.equal(nueva.api.ids().some(id=>nueva.api.tiene(id,'dorado')),false);
  }
});

caso('Cada campaña concede un sobre una sola vez, también después de recargar',()=>{
  const e=entorno({url:'https://juego.caozcontodo.com/'}),{api}=e,run='mr90c20h-x83w52f';
  assert.equal(api.betaDisponible(),false);assert.equal(api.darSobreBeta(),false);
  const antes=e.escrituras();assert.equal(api.concederSobreCampana(run),true);
  assert.equal(e.escrituras(),antes+1,'ID de campaña y sobre se guardan en una sola escritura');
  assert.equal(api.sobres(),1);assert.deepEqual(limpiar(api.leer().campanasPremiadas),[run]);
  assert.equal(api.concederSobreCampana(run),true);assert.equal(e.escrituras(),antes+1);assert.equal(api.sobres(),1);
  const recarga=entorno({url:'https://juego.caozcontodo.com/movil.html',mapa:e.mapa}).api;
  assert.equal(recarga.concederSobreCampana(run),true);assert.equal(recarga.sobres(),1);
  const pack=recarga.abrirSobre();assert.equal(pack.cartas.length,5);assert.equal(pack.cartas.every(c=>c.acabado==='foil'),true);
  assert.equal(recarga.concederSobreCampana(run),true);assert.equal(recarga.sobres(),0,'Volver a la victoria no regala el sobre ya abierto');
  assert.equal(recarga.concederSobreCampana('mr90c20i-otro-run'),true);assert.equal(recarga.sobres(),1);
  assert.deepEqual(limpiar(recarga.pendiente()),limpiar(pack),'Un nuevo premio no reemplaza el sobre que se está revelando');
  assert.equal(recarga.ids().every(id=>recarga.elegido(id)==='normal'),true,'Las recompensas no equipan diseños');
  assert.equal(e.eventos[0].detail.tipo,'sobre-campana');assert.equal(e.eventos[0].detail.runId,run);
});

caso('El premio de campaña resiste fallos de almacenamiento, IDs inválidos y el límite de sobres',()=>{
  const e=entorno(),{api}=e;
  for(const id of ['',null,42,{},'__proto__','constructor','<script>','a'.repeat(101)])assert.equal(api.concederSobreCampana(id),false);
  assert.equal(e.escrituras(),0);
  e.fallos.escritura=true;assert.equal(api.concederSobreCampana('run-valido'),false);
  assert.equal(api.sobres(),0);assert.deepEqual(limpiar(api.leer().campanasPremiadas),[]);assert.equal(e.eventos.length,0);
  e.fallos.escritura=false;assert.equal(api.concederSobreCampana('run-valido'),true);assert.equal(api.sobres(),1);
  e.fallos.lectura=true;assert.equal(api.concederSobreCampana('run-nuevo'),false);
  e.fallos.lectura=false;assert.equal(api.sobres(),1);assert.deepEqual(limpiar(api.leer().campanasPremiadas),['run-valido']);
  const lleno=api.leer();lleno.sobres=100000;e.mapa.set(api.clave,JSON.stringify(lleno));
  assert.equal(api.concederSobreCampana('run-sin-cupo'),false);assert.equal(api.leer().campanasPremiadas.includes('run-sin-cupo'),false);
  assert.equal(api.concederSobreCampana('run-valido'),true,'Una campaña ya premiada sigue reconocida con el contador lleno');
  assert.ok(api.abrirSobre());assert.equal(api.concederSobreCampana('run-sin-cupo'),true);assert.equal(api.sobres(),100000);
  assert.equal(api.reiniciar(),true);assert.deepEqual(limpiar(api.leer().campanasPremiadas),[]);assert.equal(api.sobres(),0);
});

caso('Una colección anterior conserva inventario, selección y su sobre pendiente de tres cartas',()=>{
  const e=entorno(),{api}=e;
  const anterior={version:1,revision:12,desbloqueos:{eric:['foil'],tal:['dorado'],lider_fender:['foil']},selecciones:{tal:'dorado'},sobres:2,
    pendiente:{id:'sobre_anterior',creado:1750000000000,cartas:[{id:'tal',acabado:'dorado',nueva:true},{id:'eric',acabado:'foil',nueva:false},{id:'lider_fender',acabado:'foil',nueva:true}]}};
  e.mapa.set(api.clave,JSON.stringify(anterior));
  const recarga=entorno({mapa:e.mapa});
  assert.deepEqual(limpiar(recarga.api.pendiente()),anterior.pendiente);assert.equal(recarga.api.elegido('tal'),'dorado');
  assert.deepEqual(limpiar(recarga.api.abrirSobre()),anterior.pendiente);assert.equal(recarga.escrituras(),0);assert.equal(recarga.api.sobres(),2);
  assert.equal(recarga.api.concederSobreCampana('run-tras-migracion'),true);
  assert.deepEqual(limpiar(recarga.api.pendiente()),anterior.pendiente);assert.equal(recarga.api.elegido('tal'),'dorado');
  assert.equal(recarga.api.cerrarSobre(),true);const nuevo=recarga.api.abrirSobre();
  assert.equal(nuevo.cartas.length,5);assert.equal(nuevo.cartas.every(c=>c.acabado==='foil'),true);
  assert.equal(recarga.api.elegido('tal'),'dorado');assert.equal(recarga.api.tiene('tal','dorado'),true);
});

caso('El registro de campañas se sanea sin olvidar recompensas válidas antiguas',()=>{
  const e=entorno(),{api}=e,estado=api.leer();
  const antiguas=Array.from({length:10005},(_,i)=>'run-'+i);
  estado.campanasPremiadas=[...antiguas,'run-0',null,{},'__proto__','constructor',''];
  e.mapa.set(api.clave,JSON.stringify(estado));
  assert.deepEqual(limpiar(api.leer().campanasPremiadas),antiguas);
  assert.equal(api.concederSobreCampana('run-0'),true);assert.equal(api.sobres(),0);
  assert.equal(api.concederSobreCampana('run-10004'),true);assert.equal(api.sobres(),0);
  assert.equal(api.concederSobreCampana('run-nuevo'),true);assert.equal(api.leer().campanasPremiadas.length,antiguas.length+1);
});

caso('Fallos de cuota no conceden diseños, consumen sobres ni cierran revelaciones',()=>{
  const e=entorno(),{api}=e;
  api.darSobreBeta();
  const antes=limpiar(api.leer()),eventos=e.eventos.length;
  e.fallos.escritura=true;
  assert.equal(api.desbloquear('tal','foil'),false);assert.equal(api.darSobreBeta(),false);assert.equal(api.abrirSobre(),null);assert.equal(api.reiniciar(),false);
  assert.deepEqual(limpiar(api.leer()),antes);assert.equal(e.eventos.length,eventos);
  e.fallos.escritura=false;api.desbloquear('tal','foil');
  e.fallos.escritura=true;assert.equal(api.seleccionar('tal','foil'),false);assert.equal(api.elegido('tal'),'normal');
  e.fallos.escritura=false;const sobre=api.abrirSobre();
  e.fallos.escritura=true;assert.equal(api.cerrarSobre(),false);assert.deepEqual(limpiar(api.pendiente()),limpiar(sobre));
});

caso('Fallos de lectura no sobreescriben progreso que no pudo consultarse',()=>{
  const e=entorno();e.api.desbloquear('eric','foil');
  const original=e.mapa.get(e.api.clave),escritas=e.escrituras();e.fallos.lectura=true;
  assert.equal(e.api.desbloquear('tal','dorado'),false);assert.equal(e.api.seleccionar('eric','normal'),false);
  assert.equal(e.api.darSobreBeta(),false);assert.equal(e.api.abrirSobre(),null);assert.equal(e.api.cerrarSobre(),false);assert.equal(e.api.reiniciar(),false);
  assert.equal(e.escrituras(),escritas);assert.equal(e.mapa.get(e.api.clave),original);
  e.fallos.lectura=false;assert.equal(e.api.tiene('eric','foil'),true);
});

caso('Datos corruptos se sanean sin adoptar selecciones bloqueadas ni contaminar prototipos',()=>{
  const e=entorno(),{api}=e;
  const corrupto=JSON.parse('{"version":1,"revision":-9,"sobres":1e100,"desbloqueos":{"tal":["foil","foil","oro"],"desconocido":["dorado"],"__proto__":["dorado"]},"selecciones":{"tal":"dorado","eric":"foil","__proto__":"dorado"},"pendiente":{"id":"<script>","creado":0,"cartas":[]}}');
  e.mapa.set(api.clave,JSON.stringify(corrupto));
  const estado=limpiar(api.leer());
  assert.deepEqual(estado.desbloqueos,{tal:['foil']});assert.deepEqual(estado.selecciones,{});
  assert.equal(estado.sobres,0);assert.equal(estado.revision,0);assert.equal(estado.pendiente,null);
  assert.equal(Object.prototype.dorado,undefined);assert.equal(api.elegido('tal'),'normal');
  assert.equal(api.seleccionar('tal','foil'),true);
  e.mapa.set(api.clave,'{ JSON roto');assert.equal(api.elegido('tal'),'normal');assert.equal(api.darSobreBeta(),true);assert.equal(api.sobres(),1);
  e.mapa.set(api.clave,JSON.stringify({version:99,sobres:999,desbloqueos:{tal:['dorado']}}));assert.equal(api.sobres(),0);assert.equal(api.tiene('tal','dorado'),false);
});

caso('Se rechazan sobres pendientes corruptos sin conceder su contenido',()=>{
  const e=entorno(),{api}=e;api.darSobreBeta();const pack=api.abrirSobre();
  api.desbloquear(pack.cartas[0].id,'dorado');const original=limpiar(api.leer());
  const guardarCon=cambio=>{const estado=limpiar(original);estado.pendiente=limpiar(pack);cambio(estado);e.mapa.set(api.clave,JSON.stringify(estado));};
  guardarCon(e=>{e.pendiente.cartas[0].acabado='normal';});assert.equal(api.pendiente(),null);
  guardarCon(e=>{e.pendiente.cartas[0].acabado='dorado';});assert.equal(api.pendiente(),null,'Un sobre nuevo de cinco cartas no puede introducir Doradas, aunque se posean');
  guardarCon(e=>{e.pendiente.cartas.pop();});assert.equal(api.pendiente(),null,'Sólo se aceptan los formatos de tres y cinco cartas');
  guardarCon(e=>{e.pendiente.cartas[1].id='__proto__';});assert.equal(api.pendiente(),null);
  guardarCon(e=>{delete e.desbloqueos[e.pendiente.cartas[0].id];});assert.equal(api.pendiente(),null);
});

caso('Regalos beta separados de producción, rutas y pruebas en un mismo origen',()=>{
  const mapa=new Map();
  const beta=entorno({mapa,url:'https://rafarorr1.github.io/csm-game-guide/tcg-beta/movil.html'}).api;
  const escritorio=entorno({mapa,url:'https://rafarorr1.github.io/csm-game-guide/tcg-beta/'}).api;
  const prod=entorno({mapa,url:'https://rafarorr1.github.io/csm-game-guide/tcg/index.html'}).api;
  assert.equal(beta.betaDisponible(),true);assert.equal(prod.betaDisponible(),false);
  assert.equal(beta.clave,escritorio.clave);assert.notEqual(beta.clave,prod.clave);
  beta.darSobreBeta();beta.desbloquear('tal','dorado');
  assert.equal(escritorio.sobres(),1);assert.equal(prod.sobres(),0);assert.equal(prod.tiene('tal','dorado'),false);assert.equal(prod.darSobreBeta(),false);
  assert.notEqual(entorno({url:'http://localhost:8755/?test=1'}).api.clave,entorno({url:'http://localhost:8755/'}).api.clave);
  for(const url of ['http://localhost:8755/','http://127.0.0.1:8755/','https://beta.caoz-tcg.pages.dev/'])assert.equal(entorno({url}).api.betaDisponible(),true);
  for(const url of ['https://juego.caozcontodo.com/','https://caoz-tcg.pages.dev/','https://beta.caoz-tcg.pages.dev.ejemplo.org/','https://ejemplo.org/tcg-beta/','https://rafarorr1.github.io/tcg/'])assert.equal(entorno({url}).api.betaDisponible(),false);
});

caso('Reinicio completo y eventos sólo después de una escritura exitosa',()=>{
  const e=entorno(),{api}=e;
  api.desbloquear('tal','foil');api.seleccionar('tal','foil');api.darSobreBeta();api.abrirSobre();
  assert.equal(api.reiniciar(),true);assert.equal(api.elegido('tal'),'normal');assert.equal(api.tiene('tal','foil'),false);assert.equal(api.sobres(),0);assert.equal(api.pendiente(),null);
  assert.deepEqual(e.eventos.map(e=>e.detail.tipo),['desbloqueo','seleccion','sobre-beta','abrir-sobre','reinicio']);
  assert.deepEqual(e.eventos.map(e=>e.detail.revision),[1,2,3,4,5]);
  assert.equal(e.eventos.every(e=>e.type==='caoz:coleccion'),true);
  const numero=e.eventos.length;e.escuchas.storage({key:'otra.clave'});assert.equal(e.eventos.length,numero);
  e.escuchas.storage({key:api.clave});assert.equal(e.eventos.at(-1).detail.tipo,'externo');
  e.escuchas.storage({key:null});assert.equal(e.eventos.at(-1).detail.tipo,'externo');
});

// La cola vive en el progreso de campaña, pero entrega a través del modelo real.
// Se ejecutan las funciones de producción aisladas de pantallas y animaciones.
const codigoCampana=fs.readFileSync(new URL('./final-core.js',import.meta.url),'utf8');
const inicioCampana=codigoCampana.indexOf('let campanaMemoria=null,campanaLanzando=false,campanaEnsayoGero=null;');
const finCampana=codigoCampana.indexOf('function campanaDialogo(){',inicioCampana);
assert.ok(inicioCampana>=0&&finCampana>inicioCampana);
function entornoCampana(opciones={}){
  const e=entorno(opciones),c=e.context,fallos={inventario:false};
  const poner=c.localStorage.setItem;
  c.localStorage.setItem=(clave,valor)=>{if(fallos.inventario&&clave===e.api.clave)throw Error('Inventario sin espacio');poner(clave,valor);};
  Object.assign(c,{campanaPruebaDisponible:()=>e.api.betaDisponible(),campanaNormalizarPersonaje:p=>p,toast(){}});
  vm.runInContext("const CAMPANA_CLAVE='caoz.campana.v1.prueba';const CAMPANA_RIVALES=Array(6).fill(null);"+codigoCampana.slice(inicioCampana,finCampana),c,{filename:'campana-premios-real.js'});
  return {...e,fallosCampana:fallos,claveCampana:'caoz.campana.v1.prueba',guardar:c.campanaGuardar,leerCampana:c.campanaLeer,entregar:c.campanaEntregarSobre};
}

caso('Una campaña nueva conserva un premio fallido del recorrido anterior hasta recargar',()=>{
  const e=entornoCampana(),{api}=e;
  e.fallosCampana.inventario=true;
  assert.equal(e.guardar({version:1,id:'primera-terminada',lider:'fender',etapa:6,deseo:{simulado:true}}),true);
  assert.equal(api.sobres(),0);assert.deepEqual(limpiar(e.leerCampana().sobresPendientes),['primera-terminada']);
  assert.equal(e.guardar({version:1,id:'segunda-en-curso',lider:'fender',etapa:0}),true);
  const guardada=JSON.parse(e.mapa.get(e.claveCampana));
  assert.equal(guardada.id,'segunda-en-curso');assert.deepEqual(guardada.sobresPendientes,['primera-terminada']);
  assert.equal(api.sobres(),0);
  const recarga=entornoCampana({mapa:e.mapa}),p=recarga.leerCampana();
  assert.equal(p.etapa,0);assert.equal(recarga.entregar(p),true);assert.equal(recarga.api.sobres(),1);
  assert.equal(p.sobresPendientes,undefined,'El recibo resuelto se limpia en memoria para el siguiente guardado');
  assert.equal(recarga.entregar(recarga.leerCampana()),false);assert.equal(recarga.api.sobres(),1);
  const otraRecarga=entornoCampana({mapa:e.mapa});
  assert.equal(otraRecarga.entregar(otraRecarga.leerCampana()),true,'La cola durable anterior puede reintentarse con el recibo idempotente');
  assert.equal(otraRecarga.api.sobres(),1);
  assert.equal(otraRecarga.guardar(otraRecarga.leerCampana()),true);
  assert.equal(JSON.parse(e.mapa.get(e.claveCampana)).sobresPendientes,undefined);
});

caso('Varias victorias sin espacio conservan todos sus recibos al empezar otra campaña',()=>{
  const e=entornoCampana();e.fallosCampana.inventario=true;
  e.guardar({version:1,id:'primera',lider:'fender',etapa:6});
  e.guardar({version:1,id:'segunda',lider:'fender',etapa:6,secreto:'final'});
  e.guardar({version:1,id:'tercera',lider:'fender',etapa:0,sobresPendientes:['primera','__proto__',{},'',null]});
  assert.deepEqual(JSON.parse(e.mapa.get(e.claveCampana)).sobresPendientes,['primera','segunda']);
  e.fallosCampana.inventario=false;assert.equal(e.entregar(e.leerCampana()),true);
  assert.equal(e.api.sobres(),2);assert.deepEqual(limpiar(e.api.leer().campanasPremiadas),['primera','segunda']);
  e.guardar({...limpiar(e.leerCampana()),etapa:6,secreto:'ascenso'});assert.equal(e.api.sobres(),2,'El Editor pendiente todavía no concede su propio sobre');
  e.guardar({...limpiar(e.leerCampana()),secreto:'final'});assert.equal(e.api.sobres(),3);
  e.guardar({...limpiar(e.leerCampana()),secreto:'completado'});assert.equal(e.api.sobres(),3);
});

caso('Ensayos y laboratorio no crean premios y tampoco borran una cola real guardada',()=>{
  const e=entornoCampana();e.fallosCampana.inventario=true;
  e.guardar({version:1,id:'recorrido-real',lider:'fender',etapa:6});
  const real=e.mapa.get(e.claveCampana);
  vm.runInContext("campanaEnsayoGero={version:1,id:'ensayo-en-memoria',lider:'fender',etapa:6,prueba:true};",e.context);
  assert.equal(e.guardar(e.leerCampana()),true);assert.equal(e.entregar(e.leerCampana()),false);assert.equal(e.mapa.get(e.claveCampana),real);
  assert.equal(e.entregar({version:1,id:'ensayo-laboratorio',lider:'fender',etapa:6,secreto:'final',pruebaEditor:true}),false);
  e.guardar({version:1,id:'otro-recorrido-real',lider:'fender',etapa:0});
  assert.deepEqual(JSON.parse(e.mapa.get(e.claveCampana)).sobresPendientes,['recorrido-real'],'Salir del ensayo preserva el premio del avance que estaba debajo');
  e.fallosCampana.inventario=false;e.entregar(e.leerCampana());
  assert.deepEqual(limpiar(e.api.leer().campanasPremiadas),['recorrido-real']);
  const prod=entornoCampana({url:'https://juego.caozcontodo.com/'});
  assert.equal(prod.entregar({version:1,id:'ensayo-beta',lider:'fender',etapa:6,prueba:true,sobresPendientes:['cola-beta']}),false);
  assert.equal(prod.api.sobres(),0);
});

// Cosméticos online: ejecuta los despachadores reales sin abrir ningún relevo.
const codigoJuego=fs.readFileSync(new URL('./coleccion-juego.js',import.meta.url),'utf8');
const codigoMotor=fs.readFileSync(new URL('./motor.js',import.meta.url),'utf8');
function trozo(inicio,fin){
  const a=codigoMotor.indexOf(inicio),b=codigoMotor.indexOf(fin,a+inicio.length);
  assert.ok(a>=0&&b>a,'Existe el despachador real: '+inicio);
  return codigoMotor.slice(a,b);
}
class NodoArte{
  constructor(padre=null){this.padre=padre;this.dataset={};}
  closest(selector){
    const atributo=selector==='[data-lado-arte]'?'ladoArte':'coleccionAcabado';
    return this.dataset[atributo]!==undefined?this:this.padre?.closest(selector)||null;
  }
  removeAttribute(nombre){delete this.dataset[nombre.replace(/^data-/,'').replace(/-([a-z])/g,(_,letra)=>letra.toUpperCase())];}
}
function entornoJuego(opciones={}){
  const e=entorno(opciones),c=e.context,enviados=[],arranques=[],rival=new NodoArte(),yo=new NodoArte();
  const red={on:false,host:false,guest:false,sid:null,peerSid:null,peer:false,seq:0,rx:0,q:[],seen:new Set()};
  Object.assign(c,{document:{readyState:'loading'},NETDIARIO:{apunta(){}},netStatus(){},log(){},
    netPump(){while(red.q.length)enviados.push(limpiar(red.q.shift()));},
    netClose(){red.on=false;red.peer=false;},
    netGuestStart(){arranques.push(c.CAOZ_COLECCION_JUEGO.acabado('tal',rival));},
    netRivalAusente(){},netApply(){},netPlayFx(){},
  });
  c.redPrueba=red;vm.runInContext('const NET=redPrueba;',c);
  vm.runInContext(trozo('function netRecvRaw(txt){','function netSend(msg){')+
    trozo('function netSend(msg){','async function netPump(){')+
    trozo('async function netRecv(m){','/* REVANCHA EN LA MISMA SALA'),c);
  vm.runInContext(codigoJuego,c,{filename:'coleccion-juego.js'});e.escuchas.load();
  const juego=c.CAOZ_COLECCION_JUEGO;juego.marcar(yo,0);juego.marcar(rival,1);
  function sala(sid,host){
    Object.assign(red,{on:true,sid,host,guest:!host,peer:false,peerSid:null,seq:0,q:[],seen:new Set(),welcome:null});
    red.onjoin=()=>arranques.push(juego.acabado('tal',rival));
  }
  let secuencia=0;
  const recibir=m=>c.netRecvRaw(JSON.stringify({from:red.host?'guest':'host',seq:++secuencia,...m}));
  return {...e,juego,red,enviados,arranques,yo,rival,sala,recibir};
}

caso('Cada lado conserva su diseño; join comparte antes del arranque sin conceder inventario',()=>{
  const e=entornoJuego(),{api,juego}=e;
  api.desbloquear('tal','foil');api.seleccionar('tal','foil');
  assert.equal(juego.acabado('tal',e.yo),'foil');assert.equal(juego.acabado('tal',e.rival),'normal');
  assert.equal(juego.acabado('tal',new NodoArte()),null,'Sin propietario decide el contexto de la vista');
  const inventario=limpiar(api.leer()),escritas=e.escrituras();
  e.sala('sesion_local',true);
  e.recibir({t:'join',sid:'sesion_rival',leader:'fender',coleccion:{version:1,foil:[],dorado:['tal']}});
  assert.deepEqual(e.arranques,['dorado']);
  assert.equal(juego.acabado('tal',e.yo),'foil');assert.equal(juego.acabado('tal',e.rival),'dorado');
  assert.equal(api.tiene('tal','dorado'),false);assert.deepEqual(limpiar(api.leer()),inventario);assert.equal(e.escrituras(),escritas);
  e.recibir({t:'join',sid:'otra_persona',coleccion:{version:1,foil:['tal'],dorado:[]}});
  assert.equal(juego.acabado('tal',e.rival),'dorado','El transporte descarta un sid ajeno al rival emparejado');
  assert.equal(e.red.peerSid,'sesion_rival');
});

caso('Welcome, reintentos y clientes antiguos conservan el mapa de la partida correcta',()=>{
  const e=entornoJuego();e.sala('guest_local',false);
  e.recibir({t:'welcome',sid:'host_remoto',partida:'partida_1',coleccion:{version:1,foil:[],dorado:['tal']}});
  assert.deepEqual(e.arranques,['dorado']);assert.equal(e.juego.acabado('tal',e.rival),'dorado');
  e.recibir({t:'welcome',sid:'host_remoto',partida:'partida_1',coleccion:{version:1,foil:['tal'],dorado:[]}});
  assert.equal(e.juego.acabado('tal',e.rival),'dorado','Una retransmisión no equipa otros diseños a mitad del saludo');
  e.recibir({t:'welcome',sid:'host_remoto',partida:'partida_2'});
  assert.equal(e.juego.acabado('tal',e.rival),'normal','Un cliente antiguo no arrastra metadatos previos');
});

caso('Metadatos cosméticos inválidos se ignoran y no bloquean la partida',()=>{
  const casos=[null,{},[],{version:99,foil:['tal'],dorado:[]},
    {version:1,foil:'tal',dorado:[]},{version:1,foil:['tal'],dorado:['tal']},
    {version:1,foil:['inexistente'],dorado:[]},{version:1,foil:['__proto__'],dorado:[]},
    {version:1,foil:Array(257).fill('tal'),dorado:[]},
    {version:1,foil:['tal'],dorado:[],relleno:'x'.repeat(3300)}];
  for(const coleccion of casos){
    const e=entornoJuego();e.sala('guest_local',false);
    e.recibir({t:'welcome',sid:'host_remoto',partida:'partida_1',coleccion});
    assert.deepEqual(e.arranques,['normal']);assert.equal(e.juego.acabado('tal',e.rival),'normal');
    assert.equal(e.api.tiene('tal','foil'),false);assert.equal(e.api.tiene('tal','dorado'),false);assert.equal(e.escrituras(),0);
  }
});

caso('Cambiar o cerrar sala elimina los diseños del rival anterior',()=>{
  const e=entornoJuego();
  const conectar=()=>{e.sala('local_1',false);e.recibir({t:'welcome',sid:'rival_1',coleccion:{version:1,foil:['tal'],dorado:[]}});};
  conectar();e.red.sid='local_2';assert.equal(e.juego.acabado('tal',e.rival),'normal');
  conectar();e.red.peerSid='rival_2';assert.equal(e.juego.acabado('tal',e.rival),'normal');
  conectar();e.context.netClose();assert.equal(e.juego.acabado('tal',e.rival),'normal');
  conectar();e.recibir({t:'bye',sid:'rival_1'});assert.equal(e.juego.acabado('tal',e.rival),'normal');
  conectar();e.sala('local_2',true);e.recibir({t:'join',sid:'rival_2'});assert.equal(e.juego.acabado('tal',e.rival),'normal');
});

caso('Sólo join y welcome envían selección actual; nunca estados ni inventario',()=>{
  const e=entornoJuego();e.api.desbloquear('tal','foil');e.api.seleccionar('tal','foil');e.api.desbloquear('eric','dorado');
  e.sala('local_1',false);e.context.netSend({t:'join',leader:'fender'});
  assert.deepEqual(e.enviados.at(-1).coleccion,{version:1,foil:['tal'],dorado:[]},'Un diseño desbloqueado sin equipar no se comparte');
  e.api.desbloquear('tal','dorado');e.api.seleccionar('tal','dorado');
  e.context.netSend({t:'welcome',host:'fender',guest:'adreida'});
  assert.deepEqual(e.enviados.at(-1).coleccion,{version:1,foil:[],dorado:['tal']});
  const estado={t:'state',s:{turn:1,field:[]}};e.context.netSend(estado);
  assert.equal(Object.hasOwn(e.enviados.at(-1),'coleccion'),false);assert.deepEqual(e.enviados.at(-1).s,estado.s);
  e.context.netSend({t:'coin',resultado:0});assert.equal(Object.hasOwn(e.enviados.at(-1),'coleccion'),false);
});

caso('La metadata saliente queda acotada por cantidad y bytes para el relevo HTTP',()=>{
  for(const longitud of [0,80]){
    const cartas=Object.fromEntries(Array.from({length:700},(_,i)=>['carta_'+String(i).padStart(3,'0')+'x'.repeat(longitud),{}]));
    const e=entornoJuego({cartas,lideres:{}}),ids=e.api.ids();
    e.mapa.set(e.api.clave,JSON.stringify({version:1,revision:1,sobres:0,pendiente:null,
      desbloqueos:Object.fromEntries(ids.map(id=>[id,['dorado']])),selecciones:Object.fromEntries(ids.map(id=>[id,'dorado']))}));
    e.sala('local_1',false);e.context.netSend({t:'join',leader:'fender',nombre:'Nombre del jugador'});
    const m=e.enviados.at(-1),n=m.coleccion.foil.length+m.coleccion.dorado.length;
    assert.ok(n>0&&n<=256);assert.ok(JSON.stringify(m.coleccion).length<=3200);assert.ok(Buffer.byteLength(JSON.stringify(m))<4096);
    if(!longitud)assert.equal(n,256,'El límite de cantidad también se aplica a IDs breves');
    assert.equal(e.api.ids().length,700,'El recorte del mensaje no modifica el catálogo');
    assert.equal(Object.keys(e.api.leer().selecciones).length,700,'Tampoco modifica las elecciones guardadas');
  }
});

caso('La ficha reutilizada copia contexto y borra el acabado forzado de la carta anterior',()=>{
  const e=entornoJuego(),ficha=new NodoArte(),grupo=new NodoArte();
  e.juego.marcar(grupo,1);grupo.dataset.coleccionAcabado='dorado';
  e.juego.ficha(ficha,undefined,new NodoArte(grupo));
  assert.equal(e.juego.lado(ficha),1);assert.equal(ficha.dataset.coleccionAcabado,'dorado');
  e.juego.ficha(ficha,0);assert.equal(e.juego.lado(ficha),0);assert.equal(ficha.dataset.coleccionAcabado,undefined);
  e.juego.ficha(ficha);assert.equal(e.juego.lado(ficha),null);assert.equal(ficha.dataset.coleccionAcabado,undefined);
  e.juego.marcar(grupo,0);assert.equal(e.juego.lado(new NodoArte(grupo)),0,'La carta movida usa el contexto del nuevo lado');
});

console.log('\nColección: '+comprobaciones+' pruebas aprobadas.');

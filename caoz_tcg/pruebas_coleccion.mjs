// Pruebas del inventario puro, sin navegador ni escrituras del jugador.
// Uso: node pruebas_coleccion.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const codigoFuente=fs.readFileSync(new URL('./coleccion-modelo.js',import.meta.url),'utf8');
const sabotajes=[
  ['consumo',"estado.cantidades[id][acabado]=cantidadEn(estado,id,acabado)-5;","estado.cantidades[id][acabado]=cantidadEn(estado,id,acabado);"],
  ['normal-inicial',"-(acabado==='normal'?1:0)","-0"],
  ['cero-premium',"const minimo=acabado==='normal'?1:0;","const minimo=1;"],
  ['premio-campana',"'campanasPremiadas',3,'sobre-campana'","'campanasPremiadas',1,'sobre-campana'"],
  ['mezcla',"azar()<.5?'normal':'foil'","azar()<.8?'normal':'foil'"],
  ['cuarta-coleccion',"menor.ids.push(id);","lista.push({id:'archivo_'+id,nombre:'Archivo',ids:[id]});"],
  ['pendiente-grupo-antiguo',"p.grupo===null||idSeguro(p.grupo)","p.grupo===null||grupos().some(g=>g.id===p.grupo)"],
  ['sobre-sin-elegir',"if(!grupo||!(estado.sobresGuardados[grupo.id]>0))return null;","if(!grupo)return null;"],
  ['eleccion-no-consumida',"recompensa.cantidad-=n;","recompensa.cantidad-=0;"],
  ['tipo-no-consumido',"estado.sobresGuardados[grupo.id]--;",""],
  ['legado-perdido',"if(totalAnterior>asignados){","if(false){"],
  ['eleccion-dispersa',"Array.from(elecciones).every","elecciones.every"],
];
if(process.argv.includes('--sabotaje')){
  for(const [nombre,antes] of sabotajes){
    assert.ok(codigoFuente.includes(antes),'Existe el punto de sabotaje '+nombre);
    const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{encoding:'utf8',timeout:15000,env:{...process.env,CAOZ_PRUEBA_COLECCION_SABOTAJE:nombre}});
    assert.equal(r.status,1,'La regresión detecta '+nombre);assert.match(r.stderr,/AssertionError/);
    console.log('✓ Sabotaje detectado: '+nombre);
  }
  process.exit(0);
}
const sabotaje=sabotajes.find(([nombre])=>nombre===process.env.CAOZ_PRUEBA_COLECCION_SABOTAJE);
const codigo=sabotaje?codigoFuente.replace(sabotaje[1],sabotaje[2]):codigoFuente;
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

// Preparación explícita para los casos cuyo objeto es abrir/revelar. Los casos
// de concesión y elección de abajo ejercitan cada paso por separado.
function elegirPendientes(api,grupo){
  grupo=grupo||api.grupos()[0]?.id;
  for(let r=api.recompensasPendientes()[0];r;r=api.recompensasPendientes()[0]){
    const n=r.origen==='legado'?Math.min(3,r.cantidad):r.cantidad,antes=api.recompensasPendientes().reduce((n,r)=>n+r.cantidad,0);
    assert.equal(api.elegirSobres(r.id,Array(n).fill(grupo)),true);
    assert.equal(api.recompensasPendientes().reduce((n,r)=>n+r.cantidad,0),antes-n,'La selección reduce el saldo por elegir sin recrearlo');
  }
}

caso('Cada carta, ficha y protagonista empieza con Normal; premium cerrado',()=>{
  const {api,mapa}=entorno();
  assert.deepEqual(limpiar(api.acabados),['normal','foil','dorado']);
  assert.deepEqual(limpiar(api.ids()),['eric','tal','token_zombie','lider_fender','lider_adreida']);
  for(const id of api.ids()){
    assert.equal(api.tiene(id,'normal'),true);
    assert.equal(api.tiene(id,'foil'),false);
    assert.equal(api.tiene(id,'dorado'),false);
    assert.equal(api.cantidad(id,'normal'),1);assert.equal(api.cantidad(id,'foil'),0);assert.equal(api.cantidad(id,'dorado'),0);assert.equal(api.cantidad(id),1);
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
    assert.equal(api.cantidad(id),0);assert.equal(api.cantidad(id,'normal'),0);assert.equal(api.otorgarCopia(id,'foil'),false);
  }
  for(const acabado of ['oro','FOIL',null,{},false]){
    assert.equal(api.desbloquear('tal',acabado),false);
    assert.equal(api.seleccionar('tal',acabado),false);
    assert.equal(api.cantidad('tal',acabado),0);assert.equal(api.otorgarCopia('tal',acabado),false);
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

caso('Sólo otorgar una copia o recibir una carta aumenta cantidades; equipar y desbloquear son idempotentes',()=>{
  const e=entorno(),{api}=e;
  assert.equal(api.desbloquear('tal','normal'),true);assert.equal(api.cantidad('tal','normal'),1);
  assert.equal(api.desbloquear('tal','foil'),true);assert.equal(api.cantidad('tal','foil'),1);
  const escritas=e.escrituras();
  assert.equal(api.desbloquear('tal','foil'),true);assert.equal(e.escrituras(),escritas);
  assert.equal(api.otorgarCopia('tal','foil'),true);assert.equal(api.cantidad('tal','foil'),2);
  assert.equal(api.otorgarCopia('tal','normal'),true);assert.equal(api.cantidad('tal','normal'),2);
  assert.equal(api.otorgarCopia('tal','dorado'),true);assert.equal(api.cantidad('tal','dorado'),1);
  assert.equal(api.cantidad('tal'),5);assert.equal(api.elegido('tal'),'normal');
  for(const acabado of ['foil','dorado','normal','foil']){
    assert.equal(api.seleccionar('tal',acabado),true);assert.equal(api.desbloquear('tal',acabado),true);
    assert.equal(api.cantidad('tal'),5);
  }
  assert.equal(api.otorgarCopia('lider_fender','dorado'),true);assert.equal(api.cantidad('lider_fender'),2);
  const recarga=entorno({mapa:e.mapa}).api;
  assert.equal(recarga.cantidad('tal'),5);assert.equal(recarga.cantidad('tal','foil'),2);assert.equal(recarga.elegido('tal'),'foil');
  const copia=api.leer();copia.cantidades.tal.foil=999;assert.equal(api.cantidad('tal','foil'),2);
  const guardado=JSON.parse(e.mapa.get(api.clave));assert.equal(guardado.version,1);assert.deepEqual(guardado.desbloqueos.tal,['foil','dorado']);
});

function verificarSobre(sobre){
  assert.ok(sobre&&sobre.id);assert.equal(sobre.formato,2);assert.equal(sobre.cartas.length,5);
  assert.deepEqual(limpiar(sobre.cartas.slice(0,3).map(c=>c.acabado)),['normal','normal','normal']);
  assert.equal(sobre.cartas[3].acabado,'foil');assert.ok(['normal','foil'].includes(sobre.cartas[4].acabado));
  assert.equal(sobre.cartas.some(c=>c.acabado==='dorado'),false);
}
function cuentas(sobre,id,acabado){return sobre.cartas.filter(c=>c.id===id&&c.acabado===acabado).length;}

caso('Domo y campaña crean elecciones 1/3; elegir tipos repetidos guarda sobres sin conceder cartas',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e,cartas=limpiar(api.leer().cantidades);
  assert.equal(api.concederSobreDomo('partida-elegir'),true);assert.equal(api.concederSobreCampana('campana-elegir'),true);
  const pendientes=api.recompensasPendientes();assert.equal(pendientes.length,2);
  assert.deepEqual(limpiar(pendientes.map(({origen,referencia,cantidad})=>({origen,referencia,cantidad}))),[
    {origen:'domo',referencia:'partida-elegir',cantidad:1},{origen:'campana',referencia:'campana-elegir',cantidad:3},
  ]);
  assert.equal(new Set(pendientes.map(r=>r.id)).size,2);assert.equal(api.sobres(),4);assert.deepEqual(limpiar(api.inventarioSobres()),[]);
  for(const grupo of ['trucos','juramentos','caos',undefined])assert.equal(api.abrirSobre(grupo),null,'No se abre ni asigna una recompensa sin elegir');
  assert.deepEqual(limpiar(api.leer().cantidades),cartas);assert.equal(api.pendiente(),null);
  const antes=e.escrituras();assert.equal(api.elegirSobres(pendientes[1].id,['caos','trucos','caos']),true);assert.equal(e.escrituras(),antes+1);
  assert.equal(api.sobres(),4);assert.deepEqual(limpiar(api.inventarioSobres()),[{grupo:'trucos',cantidad:1},{grupo:'caos',cantidad:2}]);
  assert.equal(api.recompensasPendientes().length,1);assert.deepEqual(limpiar(api.leer().cantidades),cartas);
  assert.equal(api.ids().every(id=>api.elegido(id)==='normal'),true);assert.equal(api.pendiente(),null,'Guardar no inicia la apertura');
  assert.equal(api.elegirSobres(pendientes[0].id,['juramentos']),true);assert.equal(api.recompensasPendientes().length,0);
  assert.deepEqual(limpiar(api.inventarioSobres()),[{grupo:'trucos',cantidad:1},{grupo:'juramentos',cantidad:1},{grupo:'caos',cantidad:2}]);
  const bytes=e.mapa.get(api.clave),escritas=e.escrituras();
  assert.equal(api.elegirSobres(pendientes[1].id,['caos','trucos','caos']),false,'Una confirmación repetida no vuelve a asignar');
  assert.equal(api.concederSobreDomo('partida-elegir'),true);assert.equal(api.concederSobreCampana('campana-elegir'),true);
  assert.equal(e.mapa.get(api.clave),bytes);assert.equal(e.escrituras(),escritas);
  const recarga=entorno({...catalogoDelMotor(),mapa:e.mapa}).api;
  assert.deepEqual(limpiar(recarga.inventarioSobres()),limpiar(api.inventarioSobres()));assert.deepEqual(limpiar(recarga.recompensasPendientes()),[]);
  assert.equal(recarga.sobres(),4);assert.equal(recarga.concederSobreCampana('campana-elegir'),true);assert.equal(recarga.sobres(),4);
});

caso('Abrir consume sólo un sobre elegido de ese tipo y conserva pendientes por asignar y otros tipos',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e;
  api.concederSobreCampana('campana');const r=api.recompensasPendientes()[0];api.elegirSobres(r.id,['caos','caos','trucos']);
  api.concederSobreDomo('partida');const pendiente=limpiar(api.recompensasPendientes()),bytes=e.mapa.get(api.clave);
  assert.equal(api.abrirSobre('juramentos'),null);assert.equal(e.mapa.get(api.clave),bytes,'No se reconvierte otro tipo poseído');
  const p=api.abrirSobre('caos');verificarSobre(p);assert.equal(p.grupo,'caos');assert.equal(api.sobres(),3);
  assert.deepEqual(limpiar(api.inventarioSobres()),[{grupo:'trucos',cantidad:1},{grupo:'caos',cantidad:1}]);assert.deepEqual(limpiar(api.recompensasPendientes()),pendiente);
  assert.deepEqual(limpiar(api.abrirSobre('trucos')),limpiar(p));assert.equal(api.sobres(),3);
  api.cerrarSobre();const primero=api.abrirSobre();assert.equal(primero.grupo,'trucos','La llamada sin argumento toma el primer tipo propio');api.cerrarSobre();
  const ultimo=api.abrirSobre('caos');assert.equal(ultimo.grupo,'caos');api.cerrarSobre();
  assert.equal(api.sobres(),1);assert.deepEqual(limpiar(api.inventarioSobres()),[]);assert.equal(api.abrirSobre(),null);
  assert.deepEqual(limpiar(api.recompensasPendientes()),pendiente,'El premio Domo todavía debe elegirse');
});

caso('Elegir valida recompensa, cantidad exacta y grupos, incluidos arrays dispersos, sin escribir',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e;api.concederSobreCampana('c');api.concederSobreDomo('d');
  const [campana,domo]=api.recompensasPendientes(),bytes=e.mapa.get(api.clave),eventos=e.eventos.length,escritas=e.escrituras();
  for(const id of [undefined,null,{},42,'__proto__','constructor','no-existe'])assert.equal(api.elegirSobres(id,['trucos']),false);
  for(const opciones of [null,{},'trucos',[],['trucos'],['trucos','caos'],['trucos','caos','trucos','caos'],['trucos','caos',null],['mohamed','caos','trucos'],['archivo_1','trucos','caos'],Array(3)])assert.equal(api.elegirSobres(campana.id,opciones),false);
  for(const opciones of [[],['trucos','caos'],[{}],['__proto__'],Array(1)])assert.equal(api.elegirSobres(domo.id,opciones),false);
  assert.equal(e.mapa.get(api.clave),bytes);assert.equal(e.eventos.length,eventos);assert.equal(e.escrituras(),escritas);
  const copia=api.recompensasPendientes();copia[0].cantidad=99;copia[1].referencia='mutado';
  assert.equal(api.recompensasPendientes()[0].cantidad,3);assert.equal(api.recompensasPendientes()[1].referencia,'d');
  assert.equal(api.elegirSobres(campana.id,['juramentos','juramentos','juramentos']),true);
  const inventario=api.inventarioSobres();inventario[0].cantidad=999;assert.equal(api.inventarioSobres()[0].cantidad,3);
});

caso('El fallo de guardado o lectura al elegir conserva el premio, las cartas y sus tipos',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e;api.concederSobreCampana('eleccion-fallida');
  const r=api.recompensasPendientes()[0],bytes=e.mapa.get(api.clave),eventos=e.eventos.length;
  e.fallos.escritura=true;assert.equal(api.elegirSobres(r.id,['trucos','caos','juramentos']),false);
  assert.equal(e.mapa.get(api.clave),bytes);assert.equal(e.eventos.length,eventos);assert.equal(api.recompensasPendientes()[0].cantidad,3);assert.equal(api.inventarioSobres().length,0);
  e.fallos.escritura=false;e.fallos.lectura=true;assert.equal(api.elegirSobres(r.id,['trucos','caos','juramentos']),false);
  assert.equal(e.mapa.get(api.clave),bytes);assert.equal(api.recompensasPendientes().length,0);assert.equal(api.inventarioSobres().length,0);
  e.fallos.lectura=false;const antes=e.escrituras();assert.equal(api.elegirSobres(r.id,['trucos','caos','juramentos']),true);assert.equal(e.escrituras(),antes+1);
  assert.equal(api.sobres(),3);assert.equal(api.recompensasPendientes().length,0);assert.equal(api.inventarioSobres().length,3);assert.deepEqual(limpiar(api.leer().cantidades),{});
  e.fallos.escritura=true;const guardado=e.mapa.get(api.clave);assert.equal(api.abrirSobre('caos'),null);assert.equal(e.mapa.get(api.clave),guardado);assert.equal(api.sobres(),3);
});

caso('Ocho sobres sin tipo migran una vez a legado y se eligen por tandas 3/3/2 sin perder saldo',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e;
  const viejo={version:1,revision:20,sobres:8,desbloqueos:{tal:['foil']},cantidades:{tal:{normal:7,foil:2}},selecciones:{tal:'foil'},campanasPremiadas:['ya-pagada']};
  e.mapa.set(api.clave,JSON.stringify(viejo));const bytes=e.mapa.get(api.clave),premio=api.recompensasPendientes()[0];
  assert.ok(premio,'El saldo antiguo se conserva como recompensa de legado');
  assert.equal(premio.origen,'legado');assert.equal(premio.cantidad,8);assert.equal(api.recompensasPendientes().length,1);assert.equal(api.sobres(),8);
  assert.equal(api.abrirSobre('trucos'),null);assert.equal(api.abrirSobre(),null);assert.equal(api.inventarioSobres().length,0);assert.equal(e.mapa.get(api.clave),bytes);
  const recarga=entorno({...catalogoDelMotor(),mapa:e.mapa}).api;assert.deepEqual(limpiar(recarga.recompensasPendientes()),[limpiar(premio)]);
  const cartas=limpiar(api.leer().cantidades);assert.equal(api.elegirSobres(premio.id,['caos']),false);
  assert.equal(api.elegirSobres(premio.id,['caos','caos','trucos']),true);assert.deepEqual(limpiar(api.recompensasPendientes()),[{...limpiar(premio),cantidad:5}]);
  assert.equal(recarga.sobres(),8);assert.deepEqual(limpiar(recarga.inventarioSobres()),[{grupo:'trucos',cantidad:1},{grupo:'caos',cantidad:2}]);
  assert.equal(recarga.elegirSobres(premio.id,['juramentos','juramentos','juramentos']),true);assert.equal(api.recompensasPendientes()[0].cantidad,2);
  assert.equal(api.elegirSobres(premio.id,['caos','trucos','trucos']),false);assert.equal(api.elegirSobres(premio.id,['caos','trucos']),true);
  assert.equal(api.recompensasPendientes().length,0);assert.equal(api.sobres(),8);
  assert.deepEqual(limpiar(api.inventarioSobres()),[{grupo:'trucos',cantidad:2},{grupo:'juramentos',cantidad:3},{grupo:'caos',cantidad:3}]);
  assert.deepEqual(limpiar(api.leer().cantidades),cartas);assert.equal(api.elegido('tal'),'foil');
  const escritas=e.escrituras();assert.equal(api.concederSobreCampana('ya-pagada'),true);assert.equal(e.escrituras(),escritas);assert.equal(api.sobres(),8);
  const final=entorno({...catalogoDelMotor(),mapa:e.mapa}).api;assert.equal(final.recompensasPendientes().length,0);assert.equal(final.sobres(),8);
});

caso('La migración de sobres no cambia ni vuelve a conceder el pendiente antiguo que ya está abierto',()=>{
  const e=entorno(),{api}=e;
  const pendiente={id:'sobre_ya_abierto',creado:1,cartas:[{id:'tal',acabado:'dorado',nueva:true},{id:'eric',acabado:'foil',nueva:false},{id:'lider_fender',acabado:'foil',nueva:true}]};
  const viejo={version:1,revision:9,sobres:2,pendiente,desbloqueos:{tal:['dorado'],eric:['foil'],lider_fender:['foil']}};
  e.mapa.set(api.clave,JSON.stringify(viejo));const antes=limpiar(api.leer().cantidades),premio=api.recompensasPendientes()[0];
  assert.deepEqual(limpiar(api.abrirSobre('caos')),pendiente);assert.equal(api.sobres(),2);
  assert.equal(api.elegirSobres(premio.id,['caos','trucos']),true);assert.deepEqual(limpiar(api.pendiente()),pendiente);assert.deepEqual(limpiar(api.leer().cantidades),antes);
  assert.equal(api.sobres(),2);api.cerrarSobre();assert.deepEqual(limpiar(api.leer().cantidades),antes);assert.equal(api.abrirSobre('caos').grupo,'caos');assert.equal(api.sobres(),1);
});

caso('Regalos beta generan elecciones independientes y reiniciar elimina todos los estados de sobres',()=>{
  const e=entorno(),{api}=e;api.darSobreBeta();api.darSobreBeta();const r=api.recompensasPendientes();
  assert.equal(r.length,2);assert.equal(new Set(r.map(p=>p.id)).size,2);assert.equal(r.every(p=>p.origen==='beta'&&p.cantidad===1),true);
  const recarga=entorno({mapa:e.mapa}).api;assert.deepEqual(limpiar(recarga.recompensasPendientes()),limpiar(r));
  api.elegirSobres(r[0].id,['trucos']);api.abrirSobre('trucos');assert.equal(api.recompensasPendientes().length,1);assert.ok(api.pendiente());
  assert.equal(api.reiniciar(),true);assert.equal(api.sobres(),0);assert.equal(api.recompensasPendientes().length,0);assert.equal(api.inventarioSobres().length,0);assert.equal(api.pendiente(),null);
});

caso('Se sanean tipos y recibos corruptos sin duplicar premios ni escribir durante la lectura',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e;
  const base={version:1,sobresVersion:2,sobres:0,domosPremiados:['partida'],campanasPremiadas:['campana'],sobresGuardados:{}};
  const invalidas=[
    {id:'__proto__',origen:'domo',referencia:'partida',cantidad:1},
    {id:'sin-recibo',origen:'domo',referencia:'otra-partida',cantidad:1},
    {id:'campana-incompleta',origen:'campana',referencia:'campana',cantidad:2},
    {id:'domo-triple',origen:'domo',referencia:'partida',cantidad:3},
    {id:'desconocida',origen:'regalo',referencia:'foo',cantidad:1},
    {id:'referencia-invalida',origen:'beta',referencia:{id:'foo'},cantidad:1},
    {id:'cantidad-invalida',origen:'legado',referencia:'foo',cantidad:-1},
  ];
  e.mapa.set(api.clave,JSON.stringify({...base,sobresGuardados:{mohamed:7,archivo_1:3,trucos:-1,caos:1.5,juramentos:'3'},recompensasPorElegir:invalidas}));
  assert.equal(api.recompensasPendientes().length,0);assert.equal(api.inventarioSobres().length,0);assert.equal(api.sobres(),0);assert.equal(e.escrituras(),0);
  const valida={id:'r1',origen:'domo',referencia:'partida',cantidad:1};
  e.mapa.set(api.clave,JSON.stringify({...base,sobres:1,recompensasPorElegir:[valida,valida,{...valida,id:'r2'}]}));
  assert.deepEqual(limpiar(api.recompensasPendientes()),[valida]);assert.equal(api.sobres(),1);assert.equal(e.escrituras(),0);
  e.mapa.set(api.clave,JSON.stringify({...base,sobres:5,sobresGuardados:{caos:2},recompensasPorElegir:[valida]}));
  const saneado=api.leer();assert.equal(saneado.sobres,5);assert.equal(saneado.recompensasPorElegir.length,2);
  assert.equal(saneado.recompensasPorElegir.find(r=>r.origen==='legado').cantidad,2,'Un saldo anterior sin representar se conserva sin volver a contarlo');
  assert.equal(api.sobres(),5);assert.equal(e.escrituras(),0);
  elegirPendientes(api,'trucos');const recarga=entorno({...catalogoDelMotor(),mapa:e.mapa}).api;
  assert.equal(recarga.sobres(),5);assert.deepEqual(limpiar(recarga.inventarioSobres()),[{grupo:'trucos',cantidad:3},{grupo:'caos',cantidad:2}]);assert.equal(recarga.recompensasPendientes().length,0);
});

caso('Dos vistas leen el último inventario y una confirmación vieja no duplica sobres',()=>{
  const e=entorno(catalogoDelMotor()),{api}=e;api.concederSobreCampana('partida-dos-vistas');
  const r=api.recompensasPendientes()[0],otra=entorno({...catalogoDelMotor(),mapa:e.mapa}).api;
  assert.equal(otra.elegirSobres(r.id,['trucos','juramentos','caos']),true);
  const bytes=e.mapa.get(api.clave);assert.equal(api.elegirSobres(r.id,['caos','caos','caos']),false);assert.equal(e.mapa.get(api.clave),bytes);
  assert.equal(api.sobres(),3);assert.equal(api.inventarioSobres().length,3);assert.equal(api.recompensasPendientes().length,0);
  const pack=api.abrirSobre('trucos');assert.deepEqual(limpiar(otra.abrirSobre('caos')),limpiar(pack));assert.equal(otra.sobres(),2);
});

caso('Sobre mixto atómico: doble clic y recarga conservan cartas, grupo y copias',()=>{
  const e=entorno({cartas:{eric:{},cantaberna:{},burla:{},balada:{},petunia:{}},lideres:{}}),{api}=e;
  api.darSobreBeta();elegirPendientes(api);api.darSobreBeta();elegirPendientes(api);
  const antes=e.escrituras(),sobre=api.abrirSobre();verificarSobre(sobre);
  assert.equal(e.escrituras(),antes+1);assert.equal(api.sobres(),1);
  assert.equal(new Set(sobre.cartas.map(c=>c.id)).size,5);
  for(const c of sobre.cartas){
    assert.equal(c.nueva,c.acabado==='foil');assert.equal(api.tiene(c.id,c.acabado),true);
    assert.equal(api.elegido(c.id),'normal');assert.equal(api.tiene(c.id,'dorado'),false);
    assert.equal(api.cantidad(c.id,c.acabado),c.acabado==='normal'?2:1);assert.equal(api.cantidad(c.id),2);
  }
  const inventario=limpiar(api.leer());
  assert.deepEqual(limpiar(api.abrirSobre()),limpiar(sobre));
  assert.deepEqual(limpiar(api.abrirSobre('grupo-invalido')),limpiar(sobre),'Un pendiente no se sustituye al cambiar la selección');
  assert.equal(e.escrituras(),antes+1);assert.deepEqual(limpiar(api.leer()),inventario);
  const recarga=entorno({mapa:e.mapa,cartas:{eric:{},cantaberna:{},burla:{},balada:{},petunia:{}},lideres:{}}).api;
  assert.deepEqual(limpiar(recarga.pendiente()),limpiar(sobre));assert.deepEqual(limpiar(recarga.leer()),inventario);
  const copia=api.pendiente();copia.cartas[0].acabado='dorado';assert.equal(api.pendiente().cartas[0].acabado,'normal');
  assert.equal(api.cerrarSobre(),true);assert.equal(api.pendiente(),null);
  const segundo=api.abrirSobre();verificarSobre(segundo);assert.notEqual(segundo.id,sobre.id);assert.equal(api.sobres(),0);
  for(const id of api.ids()){
    assert.equal(api.cantidad(id),3);
    for(const acabado of ['normal','foil'])assert.equal(api.cantidad(id,acabado),(acabado==='normal'?1:0)+cuentas(sobre,id,acabado)+cuentas(segundo,id,acabado));
  }
});

caso('Catálogo pequeño: cada posición suma su copia y premium completa permite repetidas',()=>{
  const {api}=entorno({cartas:{eric:{}},lideres:{}});
  api.darSobreBeta();elegirPendientes(api);const sobre=api.abrirSobre();verificarSobre(sobre);
  assert.equal(sobre.cartas.filter(c=>c.nueva).length,1);assert.equal(api.tiene('eric','dorado'),false);
  assert.equal(api.cantidad('eric','foil'),cuentas(sobre,'eric','foil'));assert.equal(api.cantidad('eric'),6);
  api.cerrarSobre();api.darSobreBeta();elegirPendientes(api);const segundo=api.abrirSobre();verificarSobre(segundo);
  assert.equal(segundo.cartas.every(c=>c.id==='eric'&&!c.nueva),true);assert.equal(api.sobres(),0);
  assert.equal(api.cantidad('eric','foil'),cuentas(sobre,'eric','foil')+cuentas(segundo,'eric','foil'));assert.equal(api.cantidad('eric'),11);
});

caso('El sorteo es independiente del inventario y no repite IDs dentro de un sobre',()=>{
  const cartas=Object.fromEntries(Array.from({length:17},(_,i)=>['carta_'+i,{}]));
  for(let semilla=1;semilla<=30;semilla++){
    const nueva=entorno({cartas,lideres:{},semilla}),completa=entorno({cartas,lideres:{},semilla});
    for(const id of completa.api.ids())completa.api.desbloquear(id,'foil');
    nueva.api.darSobreBeta();elegirPendientes(nueva.api);completa.api.darSobreBeta();elegirPendientes(completa.api);const a=nueva.api.abrirSobre(),b=completa.api.abrirSobre();
    verificarSobre(a);verificarSobre(b);
    assert.deepEqual(limpiar(a.cartas.map(c=>[c.id,c.acabado])),limpiar(b.cartas.map(c=>[c.id,c.acabado])));
    assert.equal(new Set(a.cartas.map(c=>c.id)).size,5);
    assert.equal(a.cartas.every(c=>c.nueva===(c.acabado==='foil')),true);
    assert.equal(b.cartas.every(c=>!c.nueva),true);
  }
});

caso('Una campaña concede tres sobres una sola vez; Domo concede uno con recibos independientes',()=>{
  const e=entorno({url:'https://juego.caozcontodo.com/'}),{api}=e,run='mr90c20h-x83w52f';
  assert.equal(api.betaDisponible(),false);assert.equal(api.darSobreBeta(),false);
  const antes=e.escrituras();assert.equal(api.concederSobreCampana(run),true);assert.equal(e.escrituras(),antes+1);
  assert.equal(api.sobres(),3);assert.deepEqual(limpiar(api.leer().campanasPremiadas),[run]);
  assert.equal(api.concederSobreCampana(run),true);assert.equal(e.escrituras(),antes+1);
  const recargada=entorno({url:'https://juego.caozcontodo.com/movil.html',mapa:e.mapa}),recarga=recargada.api;
  assert.equal(recarga.concederSobreCampana(run),true);assert.equal(recarga.sobres(),3);
  elegirPendientes(recarga);const pack=recarga.abrirSobre();verificarSobre(pack);const cantidades=limpiar(recarga.leer().cantidades);
  assert.equal(recarga.concederSobreCampana(run),true);assert.equal(recarga.sobres(),2);
  assert.equal(recarga.concederSobreCampana('otro-run'),true);assert.equal(recarga.sobres(),5);
  assert.equal(recarga.concederSobreDomo(run),true);assert.equal(recarga.sobres(),6,'Los orígenes tienen recibos separados');
  const escritas=recargada.escrituras();assert.equal(recarga.concederSobreDomo(run),true);assert.equal(recargada.escrituras(),escritas);
  assert.equal(api.concederSobreDomo(run),true);assert.equal(api.sobres(),6);
  assert.deepEqual(limpiar(recarga.leer().domosPremiados),[run]);
  assert.deepEqual(limpiar(recarga.pendiente()),limpiar(pack));assert.deepEqual(limpiar(recarga.leer().cantidades),cantidades);
  assert.equal(recarga.ids().every(id=>recarga.elegido(id)==='normal'),true);
  assert.equal(e.eventos[0].detail.tipo,'sobre-campana');assert.equal(e.eventos[0].detail.sobres,3);
  const evento=recargada.eventos.find(e=>e.detail.tipo==='sobre-domo');assert.equal(evento.detail.partidaId,run);assert.equal(evento.detail.sobres,1);
});

caso('Ambos premios resisten fallos, IDs inválidos y capacidad sin conceder lotes parciales',()=>{
  for(const [metodo,registro,n] of [['concederSobreCampana','campanasPremiadas',3],['concederSobreDomo','domosPremiados',1]]){
    const e=entorno(),{api}=e;
    for(const id of ['',null,42,{},'__proto__','constructor','<script>','a'.repeat(101)])assert.equal(api[metodo](id),false);
    assert.equal(e.escrituras(),0);e.fallos.escritura=true;assert.equal(api[metodo]('run-valido'),false);
    assert.equal(api.sobres(),0);assert.deepEqual(limpiar(api.leer()[registro]),[]);assert.equal(e.eventos.length,0);
    e.fallos.escritura=false;assert.equal(api[metodo]('run-valido'),true);assert.equal(api.sobres(),n);
    e.fallos.lectura=true;assert.equal(api[metodo]('run-nuevo'),false);e.fallos.lectura=false;
    assert.equal(api.sobres(),n);assert.deepEqual(limpiar(api.leer()[registro]),['run-valido']);
    const lleno=api.leer();lleno.sobres=100000-n+1;e.mapa.set(api.clave,JSON.stringify(lleno));
    assert.equal(api[metodo]('run-sin-cupo'),false);assert.equal(api.leer()[registro].includes('run-sin-cupo'),false);
    assert.equal(api[metodo]('run-valido'),true);
    lleno.sobres=100000-n;e.mapa.set(api.clave,JSON.stringify(lleno));
    assert.equal(api[metodo]('run-sin-cupo'),true);assert.equal(api.sobres(),100000);
    assert.equal(api.reiniciar(),true);assert.deepEqual(limpiar(api.leer()[registro]),[]);assert.equal(api.sobres(),0);
  }
});

caso('Colección antigua conserva inventario, selección y pendientes de tres y cinco Foil sin reroll',()=>{
  for(const numero of [3,5]){
    const e=entorno(),{api}=e;
    const anteriores=numero===3?[{id:'tal',acabado:'dorado',nueva:true},{id:'eric',acabado:'foil',nueva:false},{id:'lider_fender',acabado:'foil',nueva:true}]:limpiar(api.ids()).map(id=>({id,acabado:'foil',nueva:true}));
    const anterior={version:1,revision:12,desbloqueos:Object.fromEntries(anteriores.map(c=>[c.id,[c.acabado]])),selecciones:{[anteriores[0].id]:anteriores[0].acabado},sobres:2,
      pendiente:{id:'sobre_anterior',creado:1750000000000,cartas:anteriores}};
    e.mapa.set(api.clave,JSON.stringify(anterior));const recarga=entorno({mapa:e.mapa});
    assert.deepEqual(limpiar(recarga.api.abrirSobre('talesin')),anterior.pendiente);assert.equal(recarga.escrituras(),0);assert.equal(recarga.api.sobres(),2);
    for(const c of anteriores){assert.equal(recarga.api.cantidad(c.id,c.acabado),1);assert.equal(recarga.api.cantidad(c.id),2);}
    assert.equal(recarga.api.concederSobreCampana('run-tras-migracion'),true);assert.equal(recarga.api.sobres(),5);
    assert.deepEqual(limpiar(recarga.api.pendiente()),anterior.pendiente);
    assert.equal(recarga.api.elegido(anteriores[0].id),anteriores[0].acabado);
    assert.equal(recarga.api.cerrarSobre(),true);elegirPendientes(recarga.api);const nuevo=recarga.api.abrirSobre();verificarSobre(nuevo);
    assert.equal(recarga.api.elegido(anteriores[0].id),anteriores[0].acabado);
    for(const c of anteriores)assert.equal(recarga.api.cantidad(c.id,c.acabado),1+cuentas(nuevo,c.id,c.acabado));
  }
});

caso('Pendiente antiguo con repetidas migra a una copia conocida sin inventar duplicados',()=>{
  const e=entorno({cartas:{eric:{}},lideres:{}}),{api}=e;
  const antiguo={version:1,desbloqueos:{eric:['foil']},sobres:1,
    pendiente:{id:'repetidas_antiguas',creado:1,cartas:Array.from({length:5},(_,i)=>({id:'eric',acabado:'foil',nueva:i===0}))}};
  e.mapa.set(api.clave,JSON.stringify(antiguo));
  for(let i=0;i<3;i++){assert.deepEqual(limpiar(api.abrirSobre()),antiguo.pendiente);assert.equal(api.cantidad('eric','foil'),1);}
  assert.equal(e.escrituras(),0);assert.equal(e.mapa.get(api.clave),JSON.stringify(antiguo));
  api.cerrarSobre();assert.equal(api.cantidad('eric','foil'),1);elegirPendientes(api);const nuevo=api.abrirSobre();
  const copias=1+cuentas(nuevo,'eric','foil');assert.equal(api.cantidad('eric','foil'),copias);
  const recarga=entorno({mapa:e.mapa,cartas:{eric:{}},lideres:{}});
  assert.deepEqual(limpiar(recarga.api.abrirSobre()),limpiar(api.pendiente()));assert.equal(recarga.api.cantidad('eric','foil'),copias);assert.equal(recarga.escrituras(),0);
});

caso('Una escritura fallida conserva todas las copias; reintentar concede exactamente una apertura',()=>{
  const e=entorno({cartas:{eric:{}},lideres:{}}),{api}=e;
  api.otorgarCopia('eric','foil');api.darSobreBeta();elegirPendientes(api);const original=e.mapa.get(api.clave),eventos=e.eventos.length;
  e.fallos.escritura=true;
  assert.equal(api.otorgarCopia('eric','foil'),false);assert.equal(api.otorgarCopia('eric','dorado'),false);assert.equal(api.abrirSobre(),null);
  assert.equal(e.mapa.get(api.clave),original);assert.equal(e.eventos.length,eventos);assert.equal(api.cantidad('eric','foil'),1);assert.equal(api.cantidad('eric','dorado'),0);assert.equal(api.sobres(),1);
  e.fallos.escritura=false;const escritas=e.escrituras(),pack=api.abrirSobre(),copias=1+cuentas(pack,'eric','foil');
  assert.equal(e.escrituras(),escritas+1);assert.equal(api.cantidad('eric','foil'),copias);assert.equal(api.sobres(),0);
  e.fallos.escritura=true;assert.equal(api.cerrarSobre(),false);assert.deepEqual(limpiar(api.abrirSobre()),limpiar(pack));assert.equal(api.cantidad('eric','foil'),copias);
  e.fallos.lectura=true;assert.equal(api.otorgarCopia('eric','foil'),false);assert.equal(e.escrituras(),escritas+1);
  e.fallos.lectura=false;e.fallos.escritura=false;assert.equal(api.cerrarSobre(),true);assert.equal(api.cantidad('eric','foil'),copias);
  assert.equal(api.reiniciar(),true);assert.equal(api.cantidad('eric'),1);assert.equal(api.cantidad('eric','foil'),0);
});

caso('Contadores corruptos no conceden ediciones y el límite impide aperturas parciales',()=>{
  const e=entorno({cartas:{eric:{}},lideres:{}}),{api}=e;
  for(const numero of [-1,1.5,'9',null,Number.MAX_SAFE_INTEGER]){
    e.mapa.set(api.clave,JSON.stringify({version:1,desbloqueos:{eric:['foil']},cantidades:{eric:{normal:numero,foil:numero,dorado:50},inexistente:{foil:20}}}));
    assert.equal(api.cantidad('eric'),2);assert.equal(api.cantidad('eric','foil'),1);assert.equal(api.cantidad('eric','dorado'),0);assert.equal(api.tiene('eric','dorado'),false);assert.equal(api.cantidad('inexistente'),0);
  }
  const maximo=Math.floor(Number.MAX_SAFE_INTEGER/3);
  e.mapa.set(api.clave,JSON.stringify({version:1,sobresVersion:2,sobres:1,sobresGuardados:{trucos:1},desbloqueos:{eric:['foil']},cantidades:{eric:{normal:maximo-2,foil:maximo-1}}}));
  const original=e.mapa.get(api.clave);assert.equal(api.abrirSobre(),null);assert.equal(e.mapa.get(api.clave),original);assert.equal(e.escrituras(),0);
  assert.equal(api.otorgarCopia('eric','foil'),true);assert.equal(api.otorgarCopia('eric','foil'),false);assert.equal(api.cantidad('eric','foil'),maximo);
});

caso('Canjear cinco iguales conserva Normal inicial, desbloqueos y selección sin equipar automáticamente',()=>{
  const e=entorno(),{api}=e;
  assert.equal(api.canjeables('tal','normal'),0);assert.equal(api.canjear('tal','normal'),false);
  for(let i=0;i<4;i++)api.otorgarCopia('tal','normal');
  assert.equal(api.cantidad('tal','normal'),5);assert.equal(api.canjeables('tal','normal'),4);assert.equal(api.canjear('tal','normal'),false,'La copia inicial no participa');
  api.otorgarCopia('eric','normal');assert.equal(api.canjear('tal','normal'),false,'No mezcla IDs');
  api.otorgarCopia('tal','normal');const antes=e.escrituras();assert.equal(api.canjear('tal','normal'),true);
  assert.equal(e.escrituras(),antes+1);assert.equal(api.cantidad('tal','normal'),1);assert.equal(api.cantidad('tal','foil'),1);
  assert.equal(api.cantidad('eric','normal'),2);assert.equal(api.elegido('tal'),'normal');assert.equal(api.canjear('tal','normal'),false);
  api.seleccionar('tal','foil');for(let i=0;i<4;i++)api.otorgarCopia('tal','foil');
  assert.equal(api.canjeables('tal','foil'),5);assert.equal(api.canjear('tal','foil'),true);
  assert.equal(api.cantidad('tal','foil'),0);assert.equal(api.cantidad('tal','dorado'),1);
  assert.equal(api.tiene('tal','foil'),true);assert.equal(api.tiene('tal','dorado'),true);assert.equal(api.elegido('tal'),'foil');
  assert.equal(api.canjear('tal','foil'),false,'Doble clic no vuelve a gastar cinco');
  const recarga=entorno({mapa:e.mapa}).api;
  assert.equal(recarga.cantidad('tal','foil'),0);assert.equal(recarga.canjeables('tal','foil'),0);assert.equal(recarga.elegido('tal'),'foil');
  assert.equal(recarga.desbloquear('tal','foil'),true);assert.equal(recarga.cantidad('tal','foil'),0,'Desbloquear no remigra el cero');
  assert.equal(recarga.seleccionar('tal','dorado'),true);assert.equal(recarga.seleccionar('tal','foil'),true);
  recarga.otorgarCopia('tal','foil');assert.equal(api.cantidad('tal','foil'),1,'Nueva copia después del canje suma desde cero');
  assert.equal(api.canjeables('tal','dorado'),0);assert.equal(api.canjear('tal','dorado'),false);
});

caso('Veinticinco Normales obtenidas llegan a una Dorada y cuatro Foil más cinco Normales también',()=>{
  for(const mixto of [false,true]){
    const {api}=entorno();
    for(let i=0;i<(mixto?5:25);i++)api.otorgarCopia('tal','normal');
    if(mixto)for(let i=0;i<4;i++)api.otorgarCopia('tal','foil');
    for(let i=0;i<(mixto?1:5);i++)assert.equal(api.canjear('tal','normal'),true);
    assert.equal(api.cantidad('tal','normal'),1);assert.equal(api.cantidad('tal','foil'),5);
    assert.equal(api.canjear('tal','foil'),true);assert.equal(api.cantidad('tal','foil'),0);assert.equal(api.cantidad('tal','dorado'),1);
    assert.equal(api.elegido('tal'),'normal');assert.equal(api.tiene('tal','foil'),true);
  }
});

caso('Canje valida carta, origen, saldo y almacenamiento sin consumir parcialmente ni avisar éxito',()=>{
  const e=entorno(),{api}=e;
  for(const id of ['',null,{},'__proto__','constructor','no-existe']){
    assert.equal(api.canjear(id,'normal'),false);assert.equal(api.canjeables(id,'normal'),0);
  }
  for(const a of [undefined,null,{},'Normal','oro','dorado']){assert.equal(api.canjear('tal',a),false);assert.equal(api.canjeables('tal',a),0);}
  assert.equal(e.escrituras(),0);
  for(let i=0;i<5;i++)api.otorgarCopia('tal','normal');const original=e.mapa.get(api.clave),eventos=e.eventos.length;
  e.fallos.escritura=true;assert.equal(api.canjear('tal','normal'),false);assert.equal(e.mapa.get(api.clave),original);assert.equal(e.eventos.length,eventos);
  e.fallos.escritura=false;e.fallos.lectura=true;assert.equal(api.canjear('tal','normal'),false);assert.equal(e.mapa.get(api.clave),original);
  e.fallos.lectura=false;assert.equal(api.canjear('tal','normal'),true);assert.equal(e.eventos.at(-1).detail.tipo,'canje');
  const lleno=api.leer();lleno.desbloqueos.tal=['foil','dorado'];lleno.cantidades.tal={foil:5,dorado:Math.floor(Number.MAX_SAFE_INTEGER/3)};
  e.mapa.set(api.clave,JSON.stringify(lleno));const bytes=e.mapa.get(api.clave);
  assert.equal(api.canjear('tal','foil'),false);assert.equal(e.mapa.get(api.clave),bytes);
});

caso('Los ceros premium explícitos sobreviven migración; los contadores antiguos reales se conservan',()=>{
  const e=entorno(),{api}=e;
  e.mapa.set(api.clave,JSON.stringify({version:1,desbloqueos:{tal:['foil','dorado'],eric:['foil']},selecciones:{tal:'foil'},
    cantidades:{tal:{normal:14,foil:0,dorado:3},eric:{foil:8}}}));
  assert.equal(api.cantidad('tal','normal'),14);assert.equal(api.canjeables('tal','normal'),13);
  assert.equal(api.cantidad('tal','foil'),0);assert.equal(api.tiene('tal','foil'),true);assert.equal(api.elegido('tal'),'foil');
  assert.equal(api.cantidad('tal','dorado'),3);assert.equal(api.cantidad('eric','foil'),8);
  api.darSobreBeta();elegirPendientes(api);const recarga=entorno({mapa:e.mapa}).api;
  assert.equal(recarga.cantidad('tal','foil'),0);assert.equal(recarga.cantidad('eric','foil'),8);assert.equal(recarga.canjeables('tal','normal'),13);
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
  api.darSobreBeta();elegirPendientes(api);
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
  const e=entorno(),{api}=e;api.darSobreBeta();elegirPendientes(api);const pack=api.abrirSobre();
  api.desbloquear(pack.cartas[0].id,'dorado');const original=limpiar(api.leer());
  const guardarCon=cambio=>{const estado=limpiar(original);estado.pendiente=limpiar(pack);cambio(estado);e.mapa.set(api.clave,JSON.stringify(estado));};
  guardarCon(e=>{e.pendiente.cartas[3].acabado='normal';});assert.equal(api.pendiente(),null);
  guardarCon(e=>{e.pendiente.cartas[0].acabado='dorado';});assert.equal(api.pendiente(),null,'Un sobre nuevo de cinco cartas no puede introducir Doradas, aunque se posean');
  guardarCon(e=>{e.pendiente.cartas.pop();});assert.equal(api.pendiente(),null,'Sólo se aceptan los formatos de tres y cinco cartas');
  guardarCon(e=>{e.pendiente.cartas[1].id='__proto__';});assert.equal(api.pendiente(),null);
  guardarCon(e=>{delete e.desbloqueos[e.pendiente.cartas[3].id];});assert.equal(api.pendiente(),null);
});

function catalogoDelMotor(){
  const c=vm.createContext({Math,Date,TextEncoder,TextDecoder,setTimeout,clearTimeout,URLSearchParams,location:{protocol:'http:',search:''}});
  vm.runInContext(fs.readFileSync(new URL('./motor.js',import.meta.url),'utf8'),c);
  return JSON.parse(vm.runInContext('JSON.stringify({cartas:CARDS,lideres:LEADERS})',c));
}
caso('Tres colecciones cubren las 134 cartas reales: 48 Trucos, 46 Juramentos y 48 Caos',()=>{
  const datos=catalogoDelMotor(),e=entorno(datos),{api}=e,lista=api.grupos(),catalogo=api.ids();
  assert.equal(catalogo.length,134);assert.equal(lista.length,3);assert.equal(new Set(lista.map(g=>g.id)).size,3);
  assert.deepEqual(limpiar(lista.map(g=>[g.id,g.nombre,g.ids.length])),[
    ['trucos','Trucos del Domo',48],['juramentos','Juramentos del Domo',46],['caos','Caos y Dragones',48],
  ]);
  const afinidades={trucos:['lider_mohamed','lider_fender','cantaberna','ilusion'],juramentos:['lider_adreida','lider_rafaela','augusto','rulchete'],caos:['lider_gero','lider_talesin','rey','tal']};
  for(const grupo of lista){
    assert.equal(new Set(grupo.ids).size,grupo.ids.length);assert.ok(afinidades[grupo.id].every(id=>grupo.ids.includes(id)));
    assert.equal(grupo.ids.every(id=>catalogo.includes(id)),true);
    api.darSobreBeta();elegirPendientes(api,grupo.id);const pack=api.abrirSobre(grupo.id);verificarSobre(pack);assert.equal(pack.grupo,grupo.id);
    assert.equal(pack.cartas.every(c=>grupo.ids.includes(c.id)),true);assert.equal(new Set(pack.cartas.map(c=>c.id)).size,5);
    assert.deepEqual(limpiar(api.abrirSobre(lista.find(g=>g.id!==grupo.id).id)),limpiar(pack),'Cambiar grupo no altera un pendiente');api.cerrarSobre();
  }
  for(const id of ['saeta','collar'])assert.equal(lista.find(g=>g.id==='juramentos').ids.filter(c=>c===id).length,1,'Las coincidencias del par tienen una sola probabilidad');
  const cubiertos=[...new Set(lista.flatMap(g=>g.ids))].sort();assert.deepEqual(cubiertos,limpiar(catalogo).sort());
  assert.equal(lista.reduce((n,g)=>n+g.ids.length,0)-cubiertos.length,8,'Se conservan ocho apariciones compartidas entre grupos');
  const guardado=limpiar(lista);lista[0].ids.length=0;lista[1].nombre='Mutado';assert.deepEqual(limpiar(api.grupos()),guardado);
  api.darSobreBeta();elegirPendientes(api);const antes=e.mapa.get(api.clave),escritas=e.escrituras();
  for(const id of ['',null,{},'__proto__','constructor','grupo-ausente','mohamed','fender','adreida','rafaela','gero','talesin','archivo_1'])assert.equal(api.abrirSobre(id),null);
  assert.equal(e.mapa.get(api.clave),antes);assert.equal(e.escrituras(),escritas);assert.equal(api.sobres(),1);
});

caso('Cartas futuras se asignan al grupo menor determinísticamente sin crear una cuarta colección',()=>{
  const datos=catalogoDelMotor(),nuevas=Array.from({length:11},(_,i)=>'futura_'+String(i).padStart(2,'0'));
  const originales=entorno(datos).api.grupos();
  const ampliada=entorno({cartas:{...datos.cartas,...Object.fromEntries(nuevas.map(id=>[id,{}]))},lideres:datos.lideres}).api;
  const invertida=entorno({cartas:Object.fromEntries(Object.entries({...datos.cartas,...Object.fromEntries(nuevas.map(id=>[id,{}]))}).reverse()),lideres:datos.lideres}).api;
  const grupos=ampliada.grupos();assert.equal(grupos.length,3);assert.deepEqual(limpiar(grupos),limpiar(invertida.grupos()));
  assert.deepEqual(limpiar(grupos.map(g=>g.ids.length)),[51,51,51]);
  const esperado=['juramentos','juramentos','trucos','juramentos','caos','trucos','juramentos','caos','trucos','juramentos','caos'];
  nuevas.forEach((id,i)=>{const incluidos=grupos.filter(g=>g.ids.includes(id));assert.equal(incluidos.length,1);assert.equal(incluidos[0].id,esperado[i]);});
  originales.forEach(g=>assert.deepEqual(limpiar(grupos.find(n=>n.id===g.id).ids.filter(id=>!nuevas.includes(id))),limpiar(g.ids),'Los nuevos IDs no cambian afinidades existentes'));
  const soloFuturas=entorno({cartas:Object.fromEntries(nuevas.map(id=>[id,{}])),lideres:{}}).api.grupos();
  assert.equal(soloFuturas.length,3);assert.equal(soloFuturas.reduce((n,g)=>n+g.ids.length,0),11);
  assert.equal(soloFuturas.some(g=>g.id.startsWith('archivo')),false);
});

caso('Sobres mixtos pendientes de los seis grupos anteriores conservan resultado e inventario al recargar',()=>{
  const datos=catalogoDelMotor();
  const anteriores={
    mohamed:['lider_mohamed','conserje','machete','brickbrock','trol'],
    fender:['lider_fender','petunia','bartolomeo','eric','cantaberna'],
    adreida:['lider_adreida','augusto','lucius','ninolanza','talia'],
    rafaela:['lider_rafaela','julia','adolfo','titaus','matildus'],
    gero:['lider_gero','rey','aidman','juangabriel','brujula'],
    talesin:['lider_talesin','edbor','tal','tok_poseido','tok_dragon'],
  };
  for(const [grupo,ids] of Object.entries(anteriores)){
    const e=entorno(datos),{api}=e;api.darSobreBeta();elegirPendientes(api,'caos');
    const cartas=ids.map((id,i)=>({id,acabado:i===3?'foil':'normal',nueva:i===3}));
    cartas.forEach(c=>api.otorgarCopia(c.id,c.acabado));
    const pack={id:'pendiente_'+grupo,creado:1789260000000,formato:2,grupo,cartas};
    const guardado=limpiar(api.leer());guardado.pendiente=pack;e.mapa.set(api.clave,JSON.stringify(guardado));
    const bytes=e.mapa.get(api.clave),inventario=limpiar(api.leer().cantidades),escritas=e.escrituras();
    assert.deepEqual(limpiar(api.abrirSobre(grupo)),pack);assert.deepEqual(limpiar(api.abrirSobre('trucos')),pack);
    assert.equal(e.escrituras(),escritas);assert.equal(e.mapa.get(api.clave),bytes);assert.equal(api.sobres(),1);
    const recarga=entorno({...datos,mapa:e.mapa});
    assert.deepEqual(limpiar(recarga.api.pendiente()),pack);assert.deepEqual(limpiar(recarga.api.abrirSobre('caos')),pack);
    assert.equal(recarga.escrituras(),0);assert.deepEqual(limpiar(recarga.api.leer().cantidades),inventario);
    recarga.api.cerrarSobre();assert.deepEqual(limpiar(recarga.api.leer().cantidades),inventario);
    const nuevo=recarga.api.abrirSobre('caos');verificarSobre(nuevo);assert.equal(nuevo.grupo,'caos');assert.equal(recarga.api.sobres(),0);
  }
});

caso('La quinta carta se reparte al 50 % y el conjunto converge a 70 % Normal y 30 % Foil',()=>{
  const cartas=Object.fromEntries(Array.from({length:24},(_,i)=>['carta_'+i,{}]));
  const e=entorno({cartas,lideres:{},semilla:253134}),{api}=e;
  e.mapa.set(api.clave,JSON.stringify({...limpiar(api.leer()),sobres:5000,sobresGuardados:{trucos:5000}}));
  let normales=0,foils=0,quintaFoil=0;
  for(let i=0;i<5000;i++){
    const pack=api.abrirSobre('trucos');verificarSobre(pack);
    assert.equal(new Set(pack.cartas.map(c=>c.id)).size,5);
    normales+=pack.cartas.filter(c=>c.acabado==='normal').length;
    foils+=pack.cartas.filter(c=>c.acabado==='foil').length;
    if(pack.cartas[4].acabado==='foil')quintaFoil++;
    api.cerrarSobre();
  }
  assert.ok(quintaFoil>2350&&quintaFoil<2650,'La quinta permanece entre47 % y53 % en5000 sobres sembrados');
  assert.ok(normales/25000>.694&&normales/25000<.706);assert.ok(foils/25000>.294&&foils/25000<.306);
  assert.equal(api.sobres(),0);assert.equal(api.ids().some(id=>api.tiene(id,'dorado')),false);
  assert.equal(api.ids().reduce((n,id)=>n+api.cantidad(id,'normal')-1,0),normales);
  assert.equal(api.ids().reduce((n,id)=>n+api.cantidad(id,'foil'),0),foils);
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
  api.desbloquear('tal','foil');api.seleccionar('tal','foil');api.darSobreBeta();elegirPendientes(api);api.abrirSobre();
  assert.equal(api.reiniciar(),true);assert.equal(api.elegido('tal'),'normal');assert.equal(api.tiene('tal','foil'),false);assert.equal(api.sobres(),0);assert.equal(api.pendiente(),null);
  assert.deepEqual(e.eventos.map(e=>e.detail.tipo),['desbloqueo','seleccion','sobre-beta','elegir-sobres','abrir-sobre','reinicio']);
  assert.deepEqual(e.eventos.map(e=>e.detail.revision),[1,2,3,4,5,6]);
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
  assert.equal(p.etapa,0);assert.equal(recarga.entregar(p),true);assert.equal(recarga.api.sobres(),3);
  assert.equal(p.sobresPendientes,undefined,'El recibo resuelto se limpia en memoria para el siguiente guardado');
  assert.equal(recarga.entregar(recarga.leerCampana()),false);assert.equal(recarga.api.sobres(),3);
  const otraRecarga=entornoCampana({mapa:e.mapa});
  assert.equal(otraRecarga.entregar(otraRecarga.leerCampana()),true,'La cola durable anterior puede reintentarse con el recibo idempotente');
  assert.equal(otraRecarga.api.sobres(),3);
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
  assert.equal(e.api.sobres(),6);assert.deepEqual(limpiar(e.api.leer().campanasPremiadas),['primera','segunda']);
  e.guardar({...limpiar(e.leerCampana()),etapa:6,secreto:'ascenso'});assert.equal(e.api.sobres(),6,'El Editor pendiente todavía no concede su propio sobre');
  e.guardar({...limpiar(e.leerCampana()),secreto:'final'});assert.equal(e.api.sobres(),9);
  e.guardar({...limpiar(e.leerCampana()),secreto:'completado'});assert.equal(e.api.sobres(),9);
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

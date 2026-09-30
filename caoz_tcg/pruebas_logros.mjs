// Regresiones del registro de Logros: corre sin DOM ni una partida real.
// Uso: node pruebas_logros.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const modelo=fs.readFileSync(new URL('./coleccion-modelo.js',import.meta.url),'utf8');
const logros=fs.readFileSync(new URL('./logros.js',import.meta.url),'utf8');
const clonar=valor=>JSON.parse(JSON.stringify(valor));
let comprobaciones=0;
function caso(nombre,fn){fn();comprobaciones++;console.log('✓ '+nombre);}
function entorno(){
  const mapa=new Map(),eventos=[];
  const context={
    location:{hostname:'aislados.caoz-tcg.pages.dev',pathname:'/coleccion/',search:''},
    URLSearchParams,Set,Math,Date,JSON,Number,String,Array,Object,RegExp,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    localStorage:{getItem:clave=>mapa.get(clave)??null,setItem:(clave,valor)=>mapa.set(clave,String(valor))},
    dispatchEvent:evento=>eventos.push(clonar({tipo:evento.type,detalle:evento.detail})),
    addEventListener:()=>{},
  };
  context.window=context;context.globalThis=context;
  vm.createContext(context);
  vm.runInContext("const CARDS={machete:{},tal:{},petunia:{},tok_petunia:{},tok_dragon:{},pergamino:{}};const LEADERS={mohamed:{},fender:{},talesin:{},rafaela:{},adreida:{}};",context);
  vm.runInContext(modelo,context,{filename:'coleccion-modelo.js'});
  vm.runInContext(logros,context,{filename:'logros.js'});
  return {api:context.CAOZ_LOGROS,coleccion:context.CAOZ_COLECCION,mapa,eventos};
}

caso('Cada logro concede un solo sobre pendiente, incluso tras repetirlo o recargar',()=>{
  const e=entorno(),{api,coleccion}=e;
  const primero=api.simularDesbloqueo('mohamed_sneaky_tricky');
  assert.equal(primero.ok,true);assert.deepEqual(clonar(primero.nuevos),['mohamed_sneaky_tricky']);
  assert.equal(coleccion.sobres(),1);assert.equal(coleccion.recompensasPendientes().length,1);
  assert.equal(coleccion.recompensasPendientes()[0].origen,'logro');
  assert.equal(coleccion.recompensasPendientes()[0].referencia,'mohamed_sneaky_tricky');
  const repetido=api.simularDesbloqueo('mohamed_sneaky_tricky');
  assert.equal(repetido.ok,true);assert.deepEqual(clonar(repetido.nuevos),[]);assert.equal(coleccion.sobres(),1);
  const datos=clonar(coleccion.leer());
  const clave=coleccion.clave;
  e.mapa.set(clave,JSON.stringify(datos));
  const repetidoTrasLectura=api.registrar({tipo:'partida-finalizada',eventoId:'partida-unica',protagonista:'mohamed',ganada:true,causa:'deseo',almaFinal:1,danoAlmaRecibido:0,ronda:4});
  assert.equal(repetidoTrasLectura.ok,true);assert.equal(coleccion.sobres(),4,'Los tres logros restantes de esa victoria entregan tres sobres.');
  const mismoEvento=api.registrar({tipo:'partida-finalizada',eventoId:'partida-unica',protagonista:'mohamed',ganada:true,causa:'deseo',almaFinal:1,danoAlmaRecibido:0,ronda:4});
  assert.deepEqual(clonar(mismoEvento.nuevos),[]);assert.equal(coleccion.sobres(),4,'Un doble final de partida no duplica ni el progreso ni los sobres.');
});

caso('La victoria de Mohamed evalúa deseo, daño acumulado y límite estricto de rondas',()=>{
  const {api,coleccion}=entorno();
  const r=api.registrar({tipo:'partida-finalizada',eventoId:'mohamed-uno',protagonista:'mohamed',ganada:true,causa:'deseo',almaFinal:1,danoAlmaRecibido:0,ronda:4});
  assert.deepEqual(clonar(r.nuevos).sort(),['mohamed_ahora_me_ves','mohamed_ctt','mohamed_ladron_templos','mohamed_sneaky_tricky']);
  assert.equal(coleccion.sobres(),4);
  const limite=api.registrar({tipo:'partida-finalizada',eventoId:'mohamed-limite',protagonista:'mohamed',ganada:true,causa:'deseo',almaFinal:1,danoAlmaRecibido:0,ronda:5});
  assert.deepEqual(clonar(limite.nuevos),[],'La ronda 5 no cuenta como menos de 5.');
  const curado=api.registrar({tipo:'partida-finalizada',eventoId:'mohamed-curado',protagonista:'mohamed',ganada:true,almaFinal:20,danoAlmaRecibido:1,ronda:9});
  assert.equal(api.logrado(curado.estado,'mohamed_ctt'),true,'El primer logro queda permanente.');
  assert.equal(api.aplicarEvento(api.vacio(),{tipo:'partida-finalizada',protagonista:'mohamed',ganada:true,almaFinal:20,danoAlmaRecibido:1,ronda:9}).nuevos.includes('mohamed_ctt'),false,'Curarse no puede aprobar CTT.');
});

caso('Contadores, rachas y resultados de partida no se inflan al repetir un evento',()=>{
  const {api,coleccion}=entorno();
  for(let n=1;n<=5;n++)api.registrar({tipo:'volado',eventoId:'cara-'+n,protagonista:'mohamed',cara:true});
  assert.equal(api.progreso('mohamed_cinco_caras').texto,'5 / 5');assert.equal(coleccion.sobres(),1);
  api.registrar({tipo:'volado',eventoId:'cara-5',protagonista:'mohamed',cara:true});
  assert.equal(api.progreso('mohamed_cinco_caras').texto,'5 / 5');
  api.registrar({tipo:'volado',eventoId:'cruz',protagonista:'mohamed',cara:false});
  assert.equal(api.progreso('mohamed_cinco_caras').texto,'0 / 5');
  for(let n=1;n<=3;n++)api.registrar({tipo:'partida-finalizada',eventoId:'fender-'+n,protagonista:'fender',ganada:true,cancionesJugadas:7,duracionMs:300000});
  assert.equal(api.progreso('fender_22_canciones').texto,'21 / 22');
  api.registrar({tipo:'partida-finalizada',eventoId:'fender-3',protagonista:'fender',ganada:true,cancionesJugadas:7,duracionMs:300000});
  assert.equal(api.progreso('fender_22_canciones').texto,'21 / 22');
  const ultima=api.registrar({tipo:'partida-finalizada',eventoId:'fender-4',protagonista:'fender',ganada:true,cancionesJugadas:1,duracionMs:299999});
  assert.ok(ultima.nuevos.includes('fender_22_canciones'));assert.ok(ultima.nuevos.includes('fender_rapidin'));
  assert.equal(api.aplicarEvento(api.vacio(),{tipo:'partida-finalizada',protagonista:'fender',ganada:true,cancionesJugadas:1}).nuevos.includes('fender_rapidin'),false,'Una duración ausente nunca gana Rapidín.');
});

caso('Los hitos de campo y conjuntos respetan los protagonistas y la condición exacta',()=>{
  const {api}=entorno();
  assert.ok(api.registrar({tipo:'hito-campo',eventoId:'cero-diez',protagonista:'talesin',atkBase:0,atk:10}).nuevos.includes('talesin_cero_a_heroe'));
  assert.ok(api.registrar({tipo:'hito-campo',eventoId:'apostoles',protagonista:'rafaela',apostoles:5}).nuevos.includes('rafaela_charles_menson'));
  assert.equal(api.registrar({tipo:'hito-campo',eventoId:'oculto-cinco',protagonista:'rafaela',apostolSigiloso:true,atk:5}).nuevos.includes('rafaela_oculto'),false);
  assert.ok(api.registrar({tipo:'hito-campo',eventoId:'oculto-seis',protagonista:'rafaela',apostolSigiloso:true,atk:6}).nuevos.includes('rafaela_oculto'));
  for(const rival of ['mohamed','fender','talesin','adreida'])api.registrar({tipo:'partida-finalizada',eventoId:'rul-'+rival,protagonista:'rafaela',rival,ganada:true,almaFinal:21});
  assert.equal(api.logrado(api.leer(),'rafaela_you_rul'),true);
  for(const rival of ['mohamed','fender','talesin','rafaela'])api.registrar({tipo:'partida-finalizada',eventoId:'orejas-'+rival,protagonista:'adreida',rival,ganada:true,danoAlmaRecibido:0});
  assert.equal(api.logrado(api.leer(),'adreida_dos_orejas'),true);
});

caso('El estado inválido se sanea y las veintitrés definiciones se pueden registrar una sola vez',()=>{
  const {api,coleccion,mapa}=entorno();
  const clave=coleccion.clave;
  mapa.set(clave,JSON.stringify({version:1,metas:{version:1,obtenidos:['mohamed_ctt','<script>'],contadores:{fender_22_canciones:22,constructor:8},eventos:['evento-bueno','<script>']},logrosPremiados:['<script>'],sobresVersion:2,sobres:0,recompensasPorElegir:[]}));
  const limpio=api.leer();assert.deepEqual(clonar(limpio.obtenidos),['mohamed_ctt']);assert.equal(limpio.contadores.fender_22_canciones,22);assert.deepEqual(clonar(limpio.eventos),['evento-bueno']);
  for(const def of api.definiciones)api.simularDesbloqueo(def.id);
  assert.equal(api.resumen().obtenidos,23);assert.equal(new Set(coleccion.leer().logrosPremiados).size,23);assert.equal(coleccion.recompensasPendientes().filter(r=>r.origen==='logro').length,23);
});

console.log('\n'+comprobaciones+' regresiones de Logros aprobadas.');

/* La biblioteca única se valida con bases SQLite aisladas, nunca con jugadores reales. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import worker from './_worker.js';
function base(){
 const db=new DatabaseSync(':memory:');let cola=Promise.resolve(),fallar=false;
 class Q{constructor(sql){this.sql=sql;this.args=[];}bind(...a){this.args=a.map(x=>x instanceof ArrayBuffer?new Uint8Array(x):x);return this;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async first(){return db.prepare(this.sql).get(...this.args)||null;}async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}};}}
 return {db,romperLote(){fallar=true;},binding:{prepare:s=>new Q(s),batch(cmds){const r=cola.then(async()=>{db.exec('BEGIN');try{const resultados=[];for(const c of cmds){resultados.push(await c.run());if(fallar&&c.sql.startsWith('INSERT INTO sonidos (')){fallar=false;throw Error('Fallo simulado a mitad del lote');}}db.exec('COMMIT');return resultados;}catch(e){db.exec('ROLLBACK');throw e;}});cola=r.catch(()=>{});return r;}}};
}
const prod=base(),beta=base(),sha=x=>createHash('sha256').update(x).digest('hex'),clave=randomBytes(24).toString('hex');
const env={SFX_DB:prod.binding,SFX_BETA_DB:beta.binding,SFX_ADMIN_HASH:sha(clave),SFX_SESSION_KEY:randomBytes(32).toString('hex'),CF_PAGES_BRANCH:'gh-pages',ASSETS:{fetch:req=>new Response(readFileSync(new URL(new URL(req.url).pathname.slice(1)==='art/catalogo.json'?'./art/catalogo.json':'./sonidos.html',import.meta.url)))}};
const eb={...env,SFX_DB:beta.binding,SFX_BETA_DB:undefined,SFX_SESSION_KEY:randomBytes(32).toString('hex'),CF_PAGES_BRANCH:'beta'};
const origen='https://juego.caozcontodo.com';let cookie='';
const req=(ruta,metodo='GET',body,headers={},e=env)=>worker.fetch(new Request(origen+ruta,{method:metodo,headers:{Origin:origen,Cookie:cookie,...headers},body}),e);
async function dato(...args){const r=await req(...args);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json();}
let r=await req('/api/sfx/sesion','POST',JSON.stringify({clave}));cookie=r.headers.get('set-cookie').split(';')[0];
const wav=readFileSync(new URL('./audio/dice_roll.wav',import.meta.url)),arte=readFileSync(new URL('./art/lider_adreida.webp',import.meta.url));
const put={"If-Match":'0','Content-Type':'image/webp','X-Arte-Encuadre':'{"x":45,"y":91,"z":118}'};
await dato('/api/sfx/sonido/attack_hit','PUT',wav,{'If-Match':'0'});await dato('/api/arte/carta/tal/normal','PUT',arte,put);
const anterior=JSON.stringify(await dato('/api/sfx/catalogo')),arteAnterior=JSON.stringify(await dato('/api/arte/catalogo'));
env.ESTUDIO_UNICO='1';eb.ESTUDIO_UNICO='1';
assert.equal((await req('/api/estudio/arte/privado','GET',undefined,{Cookie:''})).status,401);
assert.equal((await req('/api/estudio/sfx/audio/'+sha(wav),'GET',undefined,{Cookie:''})).status,401);
assert.equal((await req('/api/estudio/sfx/privado','GET',undefined,{},eb)).status,409);
assert.equal((await req('/api/arte/carta/tal/normal','DELETE',undefined,{'If-Match':'1'})).status,409);
assert.equal((await worker.fetch(new Request('https://beta.caoz-tcg.pages.dev/estudio'),eb)).headers.get('location'),origen+'/estudio');
assert.equal((await worker.fetch(new Request('https://beta.caoz-tcg.pages.dev/sonidos.html'),eb)).headers.get('location'),origen+'/sonidos');
const borrador=await dato('/api/estudio/arte/privado');assert.equal(borrador.cartas[0].hash,sha(arte));
assert.equal((await req('/api/estudio/arte/imagen/'+sha(arte))).headers.get('cache-control'),'no-store');
assert.equal((await req('/api/estudio/arte/privado')).headers.get('cache-control'),'no-store');
assert.equal((await req('/api/estudio/arte/carta/tal/dorado','PATCH','{"x":20,"y":30,"z":120}',{'If-Match':'0',Origin:'https://mal.invalid'})).status,403);
await dato('/api/estudio/arte/carta/tal/dorado','PATCH','{"x":20,"y":30,"z":120}',{'If-Match':'0'});
assert.equal(JSON.stringify(await dato('/api/arte/catalogo')),arteAnterior,'Guardar un acabado no altera producción');
assert.equal((await dato('/api/arte/catalogo','GET',undefined,{},eb)).cartas.length,0,'Guardar no altera beta');
const estado=await dato('/api/estudio/arte/estado');assert.equal(estado.beta.pendientes,1);assert.equal(estado.produccion.pendientes,1);
assert.equal((await req('/api/estudio/arte/publicar/beta','POST',undefined,{'If-Match':estado.beta.huella,Origin:'null'})).status,403);
await dato('/api/estudio/arte/publicar/beta','POST',undefined,{'If-Match':estado.beta.huella});
const enBeta=await dato('/api/arte/catalogo','GET',undefined,{},eb);assert.equal(enBeta.cartas[0].acabado,'dorado');assert.equal(enBeta.cartas[0].hash,sha(arte));assert.equal(enBeta.cartas[0].x,20);assert.equal(enBeta.cartas[0].variantes.dorado.heredada,true);
assert.equal(JSON.stringify(await dato('/api/arte/catalogo')),arteAnterior);
let ep=await dato('/api/estudio/arte/estado');assert.equal(ep.beta.pendientes,0);assert.equal(ep.produccion.pendientes,1);
await dato('/api/estudio/arte/publicar/produccion','POST',undefined,{'If-Match':ep.produccion.huella});
assert.equal((await dato('/api/arte/catalogo')).cartas[0].acabado,'dorado');
// Guardado concurrente, revisión desactualizada y contenido propio del foil.
const mismo=await Promise.all([60,70].map(x=>req('/api/estudio/arte/carta/tal/dorado','PATCH',JSON.stringify({x,y:30,z:120}),{'If-Match':'1'})));assert.deepEqual(mismo.map(r=>r.status).sort(),[200,409]);
ep=await dato('/api/estudio/arte/estado');await dato('/api/estudio/arte/carta/tal/dorado','DELETE',undefined,{'If-Match':'2'});
assert.equal((await req('/api/estudio/arte/publicar/produccion','POST',undefined,{'If-Match':ep.produccion.huella})).status,409);
ep=await dato('/api/estudio/arte/estado');await dato('/api/estudio/arte/publicar/produccion','POST',undefined,{'If-Match':ep.produccion.huella});assert.equal((await dato('/api/arte/catalogo')).cartas[0].acabado,'normal');
assert.equal((await dato('/api/arte/catalogo','GET',undefined,{},eb)).cartas[0].acabado,'dorado');
await dato('/api/estudio/arte/carta/tal/normal','PATCH','{"x":0,"y":10,"z":130}',{'If-Match':'1'});
const segunda=await dato('/api/estudio/arte/privado');assert.equal(segunda.cartas[0].x,0,'Recargar no vuelve a importar producción sobre el borrador');
// Sonidos: el archivo y el volumen comparten la publicación, sin tocar cartas.
await dato('/api/estudio/sfx/sonido/attack_hit','PATCH','{"volumen":0.21}',{'If-Match':'1'});assert.equal(JSON.stringify(await dato('/api/sfx/catalogo')),anterior);
let es=await dato('/api/estudio/sfx/estado');await dato('/api/estudio/sfx/publicar/beta','POST',undefined,{'If-Match':es.beta.huella});assert.equal((await dato('/api/sfx/catalogo','GET',undefined,{},eb)).sonidos[0].volumen,.21);assert.equal(JSON.stringify(await dato('/api/sfx/catalogo')),anterior);
const fotoArte=JSON.stringify(await dato('/api/arte/catalogo'));
es=await dato('/api/estudio/sfx/estado');prod.romperLote();assert.equal((await req('/api/estudio/sfx/publicar/produccion','POST',undefined,{'If-Match':es.produccion.huella})).status,503);assert.equal(JSON.stringify(await dato('/api/sfx/catalogo')),anterior,'El fallo revierte todo el catálogo');
await dato('/api/estudio/sfx/publicar/produccion','POST',undefined,{'If-Match':es.produccion.huella});assert.equal((await dato('/api/sfx/catalogo')).sonidos[0].volumen,.21);assert.equal(JSON.stringify(await dato('/api/arte/catalogo')),fotoArte);
// Siete archivos nuevos requieren dos peticiones: ninguno entra al juego a medias.
const nuevos=['ui_hover','ui_confirm','ui_back','card_draw','card_play','vs','turn'];
for(const [i,id]of nuevos.entries()){const w=Buffer.from(wav);w.writeInt16LE(1500+i,100);await dato('/api/estudio/sfx/sonido/'+id,'PUT',w,{'If-Match':'0'});}
es=await dato('/api/estudio/sfx/estado');const preparacion=await dato('/api/estudio/sfx/publicar/beta','POST',undefined,{'If-Match':es.beta.huella});assert.equal(preparacion.preparando,true);assert.equal((await dato('/api/sfx/catalogo','GET',undefined,{},eb)).sonidos.length,1);
await dato('/api/estudio/sfx/publicar/beta','POST',undefined,{'If-Match':es.beta.huella});assert.equal((await dato('/api/sfx/catalogo','GET',undefined,{},eb)).sonidos.length,8);assert.equal((await dato('/api/sfx/catalogo')).sonidos.length,1);
// Dos publicaciones del mismo borrador no pueden pisarse en el destino.
await dato('/api/estudio/sfx/sonido/attack_hit','PATCH','{"volumen":0.22}',{'If-Match':'2'});
es=await dato('/api/estudio/sfx/estado');
const carreras=await Promise.all([1,2].map(()=>req('/api/estudio/sfx/publicar/beta','POST',undefined,{'If-Match':es.beta.huella})));
assert.deepEqual(carreras.map(r=>r.status).sort(),[200,409]);
// Ninguna respuesta pública filtra borradores; no se transfieren credenciales/accesos.
assert.equal((await req('/api/estudio/sfx/audio/'+sha(wav),'GET',undefined,{Cookie:''})).status,401);
assert.equal(beta.db.prepare('SELECT count(*) AS n FROM accesos').get().n,0);
assert.equal((await req('/api/estudio/sfx/estado','GET',undefined,{Cookie:cookie+'x'})).status,401);
// Las vistas viajan con el acabado y conservan la separación entre destinos.
const perfiles={movil_detalle:{x:14,y:22,z:90},desktop_mano:{x:60,y:45,z:50}};
await dato('/api/estudio/arte/carta/tal/normal','PATCH',JSON.stringify({x:50,y:50,z:90,vistas:perfiles}),{'If-Match':'2'});
const antesVistas=JSON.stringify(await dato('/api/arte/catalogo'));
ep=await dato('/api/estudio/arte/estado');await dato('/api/estudio/arte/publicar/beta','POST',undefined,{'If-Match':ep.beta.huella});
assert.deepEqual((await dato('/api/arte/catalogo','GET',undefined,{},eb)).cartas[0].vistas,perfiles);
assert.equal(JSON.stringify(await dato('/api/arte/catalogo')),antesVistas);
ep=await dato('/api/estudio/arte/estado');await dato('/api/estudio/arte/publicar/produccion','POST',undefined,{'If-Match':ep.produccion.huella});
assert.deepEqual((await dato('/api/arte/catalogo')).cartas[0].vistas,perfiles);
prod.db.close();beta.db.close();console.log('Estudio único: migración, borradores privados, dos destinos, acabados, CAS, volúmenes, publicación atómica y reintentos en verde.');

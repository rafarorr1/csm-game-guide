/* Contratos del backend real, ejecutados con SQLite local y sin servicios públicos. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import worker from './_worker.js';
const db=new DatabaseSync(':memory:');
class Consulta{
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;}
  async first(){return db.prepare(this.sql).get(...this.args)||null;}
  async all(){return {results:db.prepare(this.sql).all(...this.args)};}
  async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}};}
}
const clave=randomBytes(24).toString('hex'),hash=v=>createHash('sha256').update(v).digest('hex');
const env={SFX_DB:{prepare:s=>new Consulta(s),async batch(cmds){db.exec('BEGIN');try{const r=[];for(const c of cmds)r.push(await c.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},SFX_ADMIN_HASH:hash(clave),SFX_SESSION_KEY:randomBytes(32).toString('hex'),ASSETS:{fetch:()=>new Response('Juego estático')},CF_PAGES_BRANCH:'beta'};
const origen='https://beta.example.invalid';let cookie='';
async function llamar(ruta,method='GET',body,headers={}){return worker.fetch(new Request(origen+'/api/sfx/'+ruta,{method,headers:{Origin:origen,Cookie:cookie,...headers},body}),env);}
assert.equal((await worker.fetch(new Request(origen+'/api/sfx/privado'),{ASSETS:env.ASSETS})).status,503);
assert.equal((await llamar('privado')).status,401);
assert.equal((await llamar('sonido/attack_hit','PUT','malo',{'If-Match':'0'})).status,401);
assert.equal((await llamar('sesion','POST',JSON.stringify({clave}),{Origin:'https://otro.invalid'})).status,403);
for(let i=0;i<8;i++)assert.equal((await llamar('sesion','POST',JSON.stringify({clave:'incorrecta'}))).status,401);
assert.equal((await llamar('sesion','POST',JSON.stringify({clave}))).status,429);
db.exec('DELETE FROM accesos');
const sesion=await llamar('sesion','POST',JSON.stringify({clave}));assert.equal(sesion.status,200);const cab=sesion.headers.get('set-cookie');assert(cab.includes('HttpOnly')&&cab.includes('Secure')&&cab.includes('SameSite=Strict'));cookie=cab.split(';')[0];
assert.equal((await llamar('privado','GET',undefined,{Cookie:cookie+'x'})).status,401);
assert.equal((await llamar('privado')).status,200);
const vacio=await (await llamar('catalogo')).json();assert.equal(vacio.sonidos.length,0);
const wav=readFileSync(new URL('./audio/dice_roll.wav',import.meta.url));
assert.equal((await llamar('sonido/attack_hit','PUT','malo',{'If-Match':'0'})).status,400);
assert.equal((await llamar('sonido/desconocido','PUT',wav,{'If-Match':'0'})).status,404);
assert.equal((await llamar('sonido/attack_hit','PUT',wav)).status,428);
assert.equal((await llamar('sonido/attack_hit','PUT',Buffer.alloc(1600045),{'If-Match':'0'})).status,413);
let r=await llamar('sonido/attack_hit','PUT',wav,{'If-Match':'0','X-SFX-Name':encodeURIComponent('<prueba>.wav')});assert.equal(r.status,200);let s=await r.json();assert.equal(s.hash,hash(wav));assert.equal(s.nombre,'prueba.wav');
const publico=await llamar('audio/'+s.hash,'GET',undefined,{Cookie:''});assert.equal(publico.status,200);assert.equal(hash(Buffer.from(await publico.arrayBuffer())),s.hash);
const parcial=await llamar('audio/'+s.hash,'GET',undefined,{Range:'bytes=5-24',Cookie:''});assert.equal(parcial.status,206);assert.deepEqual(Buffer.from(await parcial.arrayBuffer()),wav.subarray(5,25));
assert.equal((await llamar('audio/'+s.hash,'GET',undefined,{Range:'bytes=9999999-',Cookie:''})).status,416);
assert.equal((await llamar('sonido/attack_hit','PATCH','{"volumen":0.4}',{'If-Match':'0'})).status,409);
const concurrentes=await Promise.all([.4,.6].map(volumen=>llamar('sonido/attack_hit','PATCH',JSON.stringify({volumen}),{'If-Match':'1'})));assert.deepEqual(concurrentes.map(r=>r.status).sort(),[200,409]);
assert.equal((await llamar('sonido/attack_hit','PATCH','{"volumen":null}',{'If-Match':'2'})).status,400);
r=await llamar('sonido/attack_hit','DELETE',undefined,{'If-Match':'2','X-SFX-Original-Volume':'.84'});assert.equal(r.status,200);s=await r.json();assert.equal(s.hash,null);assert.equal(s.volumen,.84);assert.equal(s.anterior,hash(wav));
assert.equal((await llamar('sonido/attack_hit','PATCH','{"volumen":1}',{'If-Match':'3',Origin:'null'})).status,403);
assert.equal((await llamar('sesion','DELETE')).status,200);
db.close();console.log('Backend de sonidos: acceso privado, CSRF, límite de intentos, WAV, rangos, reemplazo, concurrencia y restauración en verde.');

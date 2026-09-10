/* API real de ilustraciones contra SQLite local: no usa cuentas ni servicios públicos. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import worker from './_worker.js';

function baseLocal(){
  const sqlite=new DatabaseSync(':memory:');
  let barreraLecturas=null;
  class Consulta{
    constructor(sql){this.sql=sql;this.args=[];}
    bind(...args){this.args=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;}
    async first(){const fila=sqlite.prepare(this.sql).get(...this.args)||null;if(barreraLecturas&&this.sql==='SELECT * FROM ilustraciones WHERE id=?')await barreraLecturas();return fila;}
    async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
    async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}};}
  }
  return {sqlite,coincidirLecturas(){
    let cantidad=0,resolver;const ambas=new Promise(r=>resolver=r);
    barreraLecturas=async()=>{if(++cantidad===2){barreraLecturas=null;resolver();}await ambas;};
  },binding:{prepare:s=>new Consulta(s),async batch(cmds){sqlite.exec('BEGIN');try{const r=[];for(const c of cmds)r.push(await c.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
}
const {sqlite:db,binding,coincidirLecturas}=baseLocal(),clave=randomBytes(24).toString('hex'),hash=v=>createHash('sha256').update(v).digest('hex');
const catalogo=readFileSync(new URL('./art/catalogo.json',import.meta.url)),rutas=[];
const env={SFX_DB:binding,SFX_ADMIN_HASH:hash(clave),SFX_SESSION_KEY:randomBytes(32).toString('hex'),CF_PAGES_BRANCH:'beta',ASSETS:{async fetch(req){rutas.push(new URL(req.url).pathname);return new Response(new URL(req.url).pathname==='/art/catalogo.json'?catalogo:'Juego estático');}}};
const origen='https://beta.example.invalid';let cookie='';
async function llamar(ruta,method='GET',body,headers={},entorno=env){return worker.fetch(new Request(origen+(!ruta.startsWith('/')?'/api/arte/':'')+ruta,{method,headers:{Origin:origen,Cookie:cookie,...headers},body}),entorno);}
const put=(revision,mime='image/webp',encuadre={x:50,y:50,z:100})=>({'If-Match':String(revision),'Content-Type':mime,'X-Arte-Encuadre':JSON.stringify(encuadre),'X-Arte-Nombre':encodeURIComponent('<Ilustración> de prueba.webp')});
const webp=readFileSync(new URL('./art/lider_adreida.webp',import.meta.url)),png=readFileSync(new URL('./art/icono-192.png',import.meta.url));
// JPEG RGB 32×32 real, sin depender de un conversor ni de librerías de imágenes.
const jpg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAgACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDyuiiiuA9UKKKKACiiigAooooA/9k=','base64');

assert.equal((await llamar('privado','GET',undefined,{}, {ASSETS:env.ASSETS})).status,503);
assert.equal((await llamar('privado')).status,401);
assert.equal((await llamar('carta/augusto','PUT',webp,put(0))).status,401);
assert.deepEqual((await (await llamar('catalogo')).json()).cartas,[]);
const sesion=await llamar('/api/sfx/sesion','POST',JSON.stringify({clave}));assert.equal(sesion.status,200);
cookie=sesion.headers.get('set-cookie').split(';')[0];
assert.equal((await llamar('privado','GET',undefined,{Cookie:cookie+'x'})).status,401);
assert.equal((await (await llamar('privado')).json()).entorno,'beta');
assert.equal((await llamar('privado')).headers.get('cache-control'),'no-store');
assert.equal((await llamar('carta/augusto','PUT',webp,{...put(0),Origin:'https://otro.invalid'})).status,403);
assert.equal((await llamar('carta/augusto','DELETE',undefined,{'If-Match':'0',Origin:'null'})).status,403);
assert.equal((await llamar('carta/desconocida','PUT',webp,put(0))).status,404);
assert.equal((await llamar('carta/augusto','POST',webp,put(0))).status,405);
assert.equal((await llamar('carta/augusto','PUT',webp,{'Content-Type':'image/webp'})).status,428);
assert.equal((await llamar('carta/augusto','PUT',webp,put(-1))).status,428);
assert.equal((await llamar('carta/augusto','PUT',Buffer.alloc(1500001),put(0))).status,413);
assert.equal((await llamar('carta/augusto','PUT',webp,{...put(0),'Content-Length':'1500001'})).status,413);
assert.equal((await llamar('carta/augusto','PUT','<svg onload="alert(1)"></svg>',put(0,'image/svg+xml'))).status,415);
assert.equal((await llamar('carta/augusto','PUT','<html>malo</html>',put(0,'image/png'))).status,400);
assert.equal((await llamar('carta/augusto','PUT',webp,put(0,'image/png'))).status,400);
assert.equal((await llamar('carta/augusto','PUT',webp.subarray(0,50),put(0))).status,400);
assert.equal((await llamar('carta/augusto','PUT',png.subarray(0,png.length-5),put(0,'image/png'))).status,400);
assert.equal((await llamar('carta/augusto','PUT',jpg.subarray(0,jpg.length-2),put(0,'image/jpeg'))).status,400);
const enorme=Buffer.from(png);enorme.writeUInt32BE(5000,16);
assert.equal((await llamar('carta/augusto','PUT',enorme,put(0,'image/png'))).status,400);
for(const encuadre of [{x:-1,y:50,z:100},{x:50,y:101,z:100},{x:50,y:50,z:99},{x:50,y:50,z:301},{x:'50',y:50,z:100},{x:50,y:50},{x:50,y:50,z:100,hash:'inventado'},null]){
  assert.equal((await llamar('carta/augusto','PUT',webp,put(0,'image/webp',encuadre))).status,400);
}
let r=await llamar('carta/augusto','PUT',webp,put(0,'image/webp',{x:31.5,y:62,z:145}));assert.equal(r.status,200);let carta=await r.json();
assert.equal(carta.revision,1);assert.equal(carta.hash,hash(webp));assert.equal(carta.mime,'image/webp');assert.equal(carta.nombre,'Ilustración de prueba.webp');assert.equal(carta.x,31.5);assert(carta.ancho>=16&&carta.alto>=16);
const publico=await llamar('imagen/'+carta.hash,'GET',undefined,{Cookie:''});assert.equal(publico.status,200);assert.equal(publico.headers.get('content-type'),'image/webp');assert(publico.headers.get('cache-control').includes('immutable'));assert.equal(publico.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await publico.arrayBuffer()),webp);
const cabeza=await llamar('imagen/'+carta.hash,'HEAD',undefined,{Cookie:''});assert.equal(cabeza.status,200);assert.equal(cabeza.headers.get('content-length'),String(webp.length));assert.equal((await cabeza.arrayBuffer()).byteLength,0);
assert.equal((await llamar('imagen/'+carta.hash,'GET',undefined,{Cookie:'','If-None-Match':cabeza.headers.get('etag')})).status,304);
assert.equal((await llamar('imagen/'+'0'.repeat(64),'GET',undefined,{Cookie:''})).status,404);
const visible=(await (await llamar('catalogo','GET',undefined,{Cookie:''})).json()).cartas.find(c=>c.id==='augusto');assert.equal(visible.hash,carta.hash);assert.equal(visible.x,31.5);assert(!('anterior' in visible)&&!('nombre' in visible));
assert.equal((await llamar('carta/augusto','PATCH','{"x":20,"y":30,"z":110}',{'If-Match':'0'})).status,409);
// Ambas sesiones leen la misma revisión antes de permitir cualquiera de los UPDATE.
coincidirLecturas();
const concurrentes=await Promise.all([20,80].map(x=>llamar('carta/augusto','PATCH',JSON.stringify({x,y:30,z:110}),{'If-Match':'1'})));assert.deepEqual(concurrentes.map(r=>r.status).sort(),[200,409]);
assert.equal(db.prepare('SELECT revision FROM ilustraciones WHERE id=?').get('augusto').revision,2);
// Un recorte del original también se sincroniza, sin fabricar una imagen remota.
r=await llamar('carta/lucius','PATCH','{"x":0,"y":100,"z":300}',{'If-Match':'0'});assert.equal(r.status,200);carta=await r.json();assert.equal(carta.hash,null);assert.equal(carta.x,0);assert.equal(carta.y,100);assert.equal(carta.z,300);
r=await llamar('carta/augusto','PUT',png,put(2,'image/png'));assert.equal(r.status,200);carta=await r.json();assert.equal(carta.mime,'image/png');assert.equal(carta.ancho,192);assert.equal(carta.alto,192);assert.equal(carta.anterior,hash(webp));
r=await llamar('carta/augusto','PUT',jpg,put(3,'image/jpeg'));assert.equal(r.status,200);carta=await r.json();assert.equal(carta.mime,'image/jpeg');assert.equal(carta.ancho,32);assert.equal(carta.alto,32);assert.equal(carta.anterior,hash(png));
assert.equal((await llamar('imagen/'+carta.hash,'HEAD')).headers.get('content-type'),'image/jpeg');
// Compartir la base no mezcla los catálogos ni borra los SFX al limpiar imágenes.
const wav=readFileSync(new URL('./audio/dice_roll.wav',import.meta.url));
assert.equal((await llamar('/api/sfx/sonido/attack_hit','PUT',wav,{'If-Match':'0','X-SFX-Name':'Golpe.wav'})).status,200);
const sonidosAntes=JSON.stringify(db.prepare('SELECT * FROM sonidos').all());
db.prepare('UPDATE imagenes SET creado=?').run(Date.now()-172800000);
db.prepare('INSERT INTO imagenes(hash,contenido,mime,creado) VALUES(?,?,?,?)').run('f'.repeat(64),png,'image/png',Date.now());
r=await llamar('carta/augusto','DELETE',undefined,{'If-Match':'4'});assert.equal(r.status,200);carta=await r.json();assert.equal(carta.revision,5);assert.equal(carta.anterior,hash(jpg));
for(const k of ['hash','nombre','mime','ancho','alto','x','y','z'])assert.equal(carta[k],null,k+' se restaura');
assert.equal((await llamar('imagen/'+hash(jpg),'GET',undefined,{Cookie:''})).status,200);
assert.equal((await llamar('imagen/'+hash(webp),'GET',undefined,{Cookie:''})).status,404);
assert.equal((await llamar('imagen/'+'f'.repeat(64),'GET',undefined,{Cookie:''})).status,200);
assert.equal(JSON.stringify(db.prepare('SELECT * FROM sonidos').all()),sonidosAntes);
assert.deepEqual(Buffer.from(await (await llamar('/api/sfx/audio/'+hash(wav),'GET',undefined,{Cookie:''})).arrayBuffer()),wav);
assert.equal((await (await llamar('/api/sfx/catalogo')).json()).sonidos.length,1);
assert.equal((await llamar('carta/augusto','PUT',webp,put(0))).status,409);
assert.equal((await llamar('carta/augusto','PATCH','{"x":50,"y":50,"z":100}',{'If-Match':'5',Origin:'https://otro.invalid'})).status,403);
assert.equal((await llamar('carta/augusto','PATCH','{"x":null,"y":50,"z":100}',{'If-Match':'5'})).status,400);
assert.equal((await llamar('carta/lucius','DELETE',undefined,{'If-Match':'1'})).status,200);
assert.equal(db.prepare('SELECT x FROM ilustraciones WHERE id=?').get('lucius').x,null);
assert.equal(rutas.filter(r=>r==='/art/catalogo.json').length,1,'el catálogo se valida una vez por binding de assets');
assert.equal(await (await llamar('/estudio')).text(),'Juego estático');
// La caché de preparación no puede saltarse tablas ni filtrar filas a otro entorno.
const otra=baseLocal(),produccion={...env,SFX_DB:otra.binding,SFX_SESSION_KEY:randomBytes(32).toString('hex'),CF_PAGES_BRANCH:'gh-pages'};
assert.deepEqual((await (await llamar('catalogo','GET',undefined,{},produccion)).json()).cartas,[]);
assert.equal((await llamar('privado','GET',undefined,{},produccion)).status,401);
assert.equal((await llamar('privado','GET',undefined,{}, {...env,CF_PAGES_BRANCH:'gh-pages'})).status,200);
assert.equal((await (await llamar('privado','GET',undefined,{}, {...env,CF_PAGES_BRANCH:'gh-pages'})).json()).entorno,'produccion');
assert.equal((await llamar('/api/sfx/sesion','DELETE')).status,200);
cookie='';assert.equal((await llamar('privado')).status,401);
assert.equal((await llamar('catalogo')).status,200);
assert.deepEqual(readFileSync(new URL('./art/lider_adreida.webp',import.meta.url)),webp,'el original permanece intacto');
otra.sqlite.close();db.close();
console.log('Backend de ilustraciones: sesión compartida, CSRF, catálogo real, formatos, dimensiones, recorte, CAS, restauración, caché pública y aislamiento SFX/entornos en verde.');

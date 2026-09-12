/* API real de ilustraciones contra SQLite local: no usa cuentas ni servicios públicos. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import vm from 'node:vm';
import worker from './_worker.js';

function baseLocal(){
  const sqlite=new DatabaseSync(':memory:');
  let barreraLecturas=null,colaBatch=Promise.resolve();
  class Consulta{
    constructor(sql){this.sql=sql;this.args=[];}
    bind(...args){this.args=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;}
    async first(){const fila=sqlite.prepare(this.sql).get(...this.args)||null;if(barreraLecturas&&/^SELECT \* FROM ilustraciones(?:_acabados)? WHERE id=\?/.test(this.sql))await barreraLecturas();return fila;}
    async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
    async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes}};}
  }
  return {sqlite,coincidirLecturas(){
    let cantidad=0,resolver;const ambas=new Promise(r=>resolver=r);
    barreraLecturas=async()=>{if(++cantidad===2){barreraLecturas=null;resolver();}await ambas;};
  },binding:{prepare:s=>new Consulta(s),batch(cmds){
    // D1 ejecuta cada batch como una transacción indivisible; SQLite local mantiene esa cola.
    const siguiente=colaBatch.then(async()=>{sqlite.exec('BEGIN');try{const r=[];for(const c of cmds)r.push(await c.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}});
    colaBatch=siguiente.catch(()=>{});return siguiente;
  }}};
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
for(const encuadre of [{x:-1,y:50,z:100},{x:50,y:101,z:100},{x:50,y:50,z:49},{x:50,y:50,z:301},{x:'50',y:50,z:100},{x:50,y:50},{x:50,y:50,z:100,hash:'inventado'},null]){
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

// Acabados: una vista previa/solicitud inválida no crea foil o dorado disponibles.
const recorte={x:18,y:22,z:120},rutaAcabado=a=>'carta/machete/'+a;
async function editarAcabado(a,metodo,rev,cuerpo=recorte,mime='image/webp'){
  const respuesta=await llamar(rutaAcabado(a),metodo,metodo==='PATCH'?JSON.stringify(cuerpo):metodo==='DELETE'?undefined:cuerpo,metodo==='PUT'?put(rev,mime,recorte):{'If-Match':String(rev)});
  const datos=await respuesta.json();return {status:respuesta.status,...datos};
}
const filaPublica=async id=>(await (await llamar('catalogo','GET',undefined,{Cookie:''})).json()).cartas.find(c=>c.id===id);
const filaPrivada=async id=>(await (await llamar('privado')).json()).cartas.find(c=>c.id===id);
assert.equal((await llamar(rutaAcabado('bronce'),'PATCH',JSON.stringify(recorte),{'If-Match':'0'})).status,404);
assert.equal((await llamar(rutaAcabado('foil/extra'),'DELETE',undefined,{'If-Match':'0'})).status,404);
assert.equal((await llamar(rutaAcabado('foil'),'PATCH',JSON.stringify(recorte),{'If-Match':'0',Cookie:''})).status,401);
assert.equal((await llamar(rutaAcabado('foil'),'PATCH',JSON.stringify(recorte),{'If-Match':'0',Origin:'https://otro.invalid'})).status,403);
assert.equal((await llamar(rutaAcabado('foil'),'PATCH',JSON.stringify(recorte))).status,428);
assert.equal((await editarAcabado('foil','PUT',0,'<svg/>','image/svg+xml')).status,415);
assert.equal((await editarAcabado('dorado','PATCH',0,{x:1,y:1,z:900})).status,400);
assert.equal(await filaPublica('machete'),undefined);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ilustraciones_acabados').get().n,0);
let variante=await editarAcabado('foil','PATCH',0);assert.equal(variante.status,200);assert.equal(variante.revision,1);assert.equal(variante.activo,true);assert.equal(variante.heredada,true);assert.equal(variante.hash,null);
assert.deepEqual(variante.variante,variante.carta.variantes.foil);assert.equal(variante.carta.variantes.normal,null);assert.equal(variante.carta.variantes.dorado,null);
assert.equal(variante.carta.acabado,'foil');assert.equal(variante.carta.revision,0,'El plano privado sigue mostrando la revisión normal');
assert.equal((await filaPublica('machete')).acabado,'foil');
variante=await editarAcabado('dorado','PATCH',0,{x:25,y:35,z:145});assert.equal(variante.status,200);assert.equal(variante.carta.acabado,'dorado');
assert.equal(variante.carta.variantes.foil.revision,1);assert.equal((await filaPublica('machete')).z,145);
// Guardar normal cambia las imágenes heredadas, nunca los encuadres propios del acabado.
variante=await editarAcabado('normal','PUT',0,png,'image/png');assert.equal(variante.status,200);assert.equal(variante.carta.variantes.foil.hash,hash(png));assert.equal(variante.carta.variantes.dorado.hash,hash(png));
assert.equal(variante.carta.variantes.foil.z,120);assert.equal(variante.carta.variantes.dorado.z,145);
assert.equal((await filaPublica('machete')).hash,hash(png));
variante=await editarAcabado('foil','PUT',1,webp);assert.equal(variante.status,200);assert.equal(variante.heredada,false);assert.equal(variante.hash,hash(webp));assert.equal(variante.carta.acabado,'dorado');
variante=await editarAcabado('foil','PATCH',2,{x:33,y:44,z:160});assert.equal(variante.status,200);assert.equal(variante.hash,hash(webp),'PATCH no sustituye la imagen propia por normal');
variante=await editarAcabado('normal','PUT',1,jpg,'image/jpeg');assert.equal(variante.status,200);assert.equal(variante.carta.hash,hash(jpg));
assert.equal(variante.carta.variantes.foil.hash,hash(webp));assert.equal(variante.carta.variantes.dorado.hash,hash(jpg));
assert.equal((await filaPublica('machete')).mime,'image/jpeg');
variante=await editarAcabado('dorado','DELETE',1);assert.equal(variante.status,200);assert.equal(variante.revision,2);assert.equal(variante.activo,false);assert.equal(variante.heredada,false);
for(const k of ['hash','mime','ancho','alto','x','y','z'])assert.equal(variante[k],null);
let seleccionada=await filaPublica('machete');assert.equal(seleccionada.acabado,'foil');assert.equal(seleccionada.hash,hash(webp));assert.equal(seleccionada.z,160);
assert.equal((await filaPrivada('machete')).hash,hash(jpg),'El cliente233 no confunde el ganador con el original normal');
assert.equal((await editarAcabado('dorado','PATCH',0)).status,409,'Un tombstone nunca reinicia la revisión');
variante=await editarAcabado('dorado','PATCH',2);assert.equal(variante.status,200);assert.equal(variante.activo,true);assert.equal(variante.revision,3);assert.equal(variante.hash,hash(jpg));
assert.equal((await editarAcabado('dorado','DELETE',3)).status,200);
variante=await editarAcabado('foil','DELETE',3);assert.equal(variante.status,200);assert.equal(variante.anterior,hash(webp));assert.equal(variante.carta.acabado,'normal');
seleccionada=await filaPublica('machete');assert.equal(seleccionada.hash,hash(jpg));assert.equal(seleccionada.variantes.foil.activo,false);assert.equal(seleccionada.variantes.dorado.activo,false);
variante=await editarAcabado('normal','DELETE',2);assert.equal(variante.status,200);assert.equal(variante.activo,true);assert.equal(variante.revision,3);assert.equal((await filaPublica('machete')).hash,null);
// Dos escrituras al mismo acabado compiten; acabados distintos pueden guardarse a la vez.
coincidirLecturas();const mismas=await Promise.all([42,58].map(x=>editarAcabado('foil','PATCH',4,{...recorte,x})));assert.deepEqual(mismas.map(r=>r.status).sort(),[200,409]);
coincidirLecturas();const separadas=await Promise.all([editarAcabado('foil','PATCH',5),editarAcabado('dorado','PATCH',4)]);assert.deepEqual(separadas.map(r=>r.status),[200,200]);
seleccionada=await filaPublica('machete');assert.equal(seleccionada.acabado,'dorado');assert.equal(seleccionada.variantes.foil.revision,6);assert.equal(seleccionada.variantes.dorado.revision,5);assert.equal(seleccionada.variantes.normal.revision,3);
for(const v of Object.values(seleccionada.variantes)){assert(!('anterior' in v)&&!('nombre' in v),'Los metadatos privados tampoco se filtran dentro de variantes');}
// La limpieza respeta archivos compartidos y anteriores de cualquier acabado.
assert.equal((await editarAcabado('foil','PUT',6,webp)).status,200);
assert.equal((await editarAcabado('dorado','PUT',5,webp)).status,200);
db.prepare('UPDATE imagenes SET creado=?').run(Date.now()-172800000);
assert.equal((await editarAcabado('foil','PUT',7,png,'image/png')).status,200);
assert.equal((await editarAcabado('foil','PUT',8,jpg,'image/jpeg')).status,200);
assert.equal((await llamar('imagen/'+hash(webp),'HEAD',undefined,{Cookie:''})).status,200,'Dorado mantiene la imagen que foil dejó de referenciar');
assert.equal((await editarAcabado('dorado','DELETE',6)).status,200);
assert.equal((await llamar('imagen/'+hash(webp),'HEAD',undefined,{Cookie:''})).status,200,'La imagen anterior de dorado se conserva');
assert.equal((await editarAcabado('dorado','PUT',7,png,'image/png')).status,200);
assert.equal((await editarAcabado('dorado','PUT',8,jpg,'image/jpeg')).status,200);
assert.equal((await llamar('imagen/'+hash(webp),'HEAD',undefined,{Cookie:''})).status,404,'Un archivo viejo ya sin referencias sí se retira');
assert.equal((await llamar('imagen/'+hash(png),'HEAD',undefined,{Cookie:''})).status,200);
// Restaurar normal no borra un acabado activo; una herencia sin imagen vuelve al símbolo.
assert.equal((await llamar('carta/matildus/normal','PUT',png,put(0,'image/png'))).status,200);
assert.equal((await llamar('carta/matildus/foil','PATCH',JSON.stringify(recorte),{'If-Match':'0'})).status,200);
assert.equal((await llamar('carta/matildus/normal','DELETE',undefined,{'If-Match':'1'})).status,200);
const sinBase=await filaPublica('matildus');assert.equal(sinBase.acabado,'foil');assert.equal(sinBase.hash,null);assert.equal(sinBase.heredada,true);assert.equal(sinBase.x,18);assert.equal(sinBase.variantes.foil.revision,1);
assert.equal(JSON.stringify(db.prepare('SELECT * FROM sonidos').all()),sonidosAntes,'Los acabados no modifican SFX');

// Una base existente233 se interpreta como normal sin reescribir un solo valor.
const antigua=baseLocal();antigua.sqlite.exec('CREATE TABLE ilustraciones (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, hash TEXT, anterior TEXT, nombre TEXT, mime TEXT, ancho INTEGER, alto INTEGER, x REAL, y REAL, z REAL, actualizado TEXT); CREATE TABLE imagenes (hash TEXT PRIMARY KEY, contenido BLOB NOT NULL, mime TEXT NOT NULL, creado INTEGER NOT NULL)');
antigua.sqlite.prepare('INSERT INTO ilustraciones VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('augusto',17,hash(png),hash(jpg),'Archivo histórico','image/png',192,192,24.5,70,166,'2026-09-09T10:00:00.000Z');
antigua.sqlite.prepare('INSERT INTO imagenes VALUES(?,?,?,?)').run(hash(png),png,'image/png',1);
const historico=JSON.stringify(antigua.sqlite.prepare('SELECT * FROM ilustraciones').all()),envAntiguo={...env,SFX_DB:antigua.binding};
const migrado=(await (await llamar('privado','GET',undefined,{},envAntiguo)).json()).cartas[0];
assert.equal(migrado.acabado,'normal');assert.equal(migrado.revision,17);assert.equal(migrado.hash,hash(png));assert.equal(migrado.nombre,'Archivo histórico');assert.equal(migrado.variantes.normal.anterior,hash(jpg));assert.equal(migrado.variantes.foil,null);assert.equal(migrado.variantes.dorado,null);
assert.equal(JSON.stringify(antigua.sqlite.prepare('SELECT * FROM ilustraciones').all().map(({vistas,...fila})=>fila)),historico);
assert.equal((await llamar('imagen/'+hash(png),'GET',undefined,{Cookie:''},envAntiguo)).status,200);
assert.equal((await llamar('carta/augusto','PATCH',JSON.stringify(recorte),{'If-Match':'17'},envAntiguo)).status,200,'La ruta histórica conserva revisión y edición normal');
assert.equal((await llamar('carta/augusto/normal','PATCH',JSON.stringify(recorte),{'If-Match':'17'},envAntiguo)).status,409,'Las dos rutas comparten CAS normal');
assert.equal((await llamar('carta/augusto/normal','PATCH',JSON.stringify(recorte),{'If-Match':'18'},envAntiguo)).status,200);
antigua.sqlite.close();
// La caché de preparación no puede saltarse tablas ni filtrar filas a otro entorno.
const otra=baseLocal(),produccion={...env,SFX_DB:otra.binding,SFX_SESSION_KEY:randomBytes(32).toString('hex'),CF_PAGES_BRANCH:'gh-pages'};
assert.deepEqual((await (await llamar('catalogo','GET',undefined,{},produccion)).json()).cartas,[]);
assert.equal((await llamar('privado','GET',undefined,{},produccion)).status,401);
assert.equal((await llamar('privado','GET',undefined,{}, {...env,CF_PAGES_BRANCH:'gh-pages'})).status,200);
assert.equal((await (await llamar('privado','GET',undefined,{}, {...env,CF_PAGES_BRANCH:'gh-pages'})).json()).entorno,'produccion');
// Un encuadre horizontal no puede sobreescribir el retrato completo ni otro acabado.
let previa=(await (await llamar('privado')).json()).cartas.find(c=>c.id==='augusto');
let rev=previa.variantes.normal.revision;
const vistas={movil_detalle:{x:23,y:17,z:90},desktop_mano:{x:65,y:42,z:50}};
r=await llamar('carta/augusto','PATCH',JSON.stringify({x:50,y:50,z:90,vistas}),{'If-Match':String(rev),'Content-Type':'application/json'});
assert.equal(r.status,200);let ajustada=await r.json();assert.deepEqual(ajustada.vistas,vistas);assert.equal(ajustada.z,90);
assert.equal((await llamar('carta/augusto','PATCH',JSON.stringify({x:50,y:50,z:100,vistas}),{'If-Match':String(rev),'Content-Type':'application/json'})).status,409);
r=await llamar('carta/augusto','PATCH',JSON.stringify({x:52,y:50,z:80}),{'If-Match':String(++rev),'Content-Type':'application/json'});
assert.equal(r.status,200);assert.deepEqual((await r.json()).vistas,vistas,'Un cliente anterior conserva las vistas');
for(const incorrectas of [{desconocida:{x:50,y:50,z:90}},{movil_detalle:{x:50,y:50,z:49}},{movil_detalle:{x:50,y:50,z:90,vistas:{}}}]){
 assert.equal((await llamar('carta/augusto','PATCH',JSON.stringify({x:50,y:50,z:90,vistas:incorrectas}),{'If-Match':String(rev+1),'Content-Type':'application/json'})).status,400);
}
r=await llamar('carta/augusto','PATCH',JSON.stringify({x:50,y:50,z:90,vistas:{}}),{'If-Match':String(++rev),'Content-Type':'application/json'});assert.equal(r.status,200);assert.deepEqual((await r.json()).vistas,{});
console.log('Encuadres por vista, zoom 50–300, compatibilidad y conflicto: OK');

assert.equal((await llamar('/api/sfx/sesion','DELETE')).status,200);
cookie='';assert.equal((await llamar('privado')).status,401);
assert.equal((await llamar('catalogo')).status,200);
assert.deepEqual(readFileSync(new URL('./art/lider_adreida.webp',import.meta.url)),webp,'el original permanece intacto');
otra.sqlite.close();db.close();
console.log('Backend de ilustraciones: acceso, imágenes, migración normal, prioridad dorado/foil, herencia, CAS por acabado, restauración, limpieza compartida y aislamiento SFX/entornos en verde.');

// Thal sólo estaba en el servicio público: un 503 inicial lo dejaba sin dibujo.
// La copia estática es exactamente la edición Normal publicada, sin acabados.
const hashThal='67522d3d9e6baabccad94bdfa1184ba6b471e83dd54c6e61a1e40a518d04a20d';
const encThal={x:45,y:91,z:118},arteLocal=JSON.parse(readFileSync(new URL('./art/encuadres.json',import.meta.url)));
assert.equal(hash(readFileSync(new URL('./art/tal.webp',import.meta.url))),hashThal);
assert.deepEqual(arteLocal.tal,encThal);
const talCatalogo=JSON.parse(catalogo).cartas.find(c=>c.id==='tal');
assert.deepEqual(talCatalogo.original,{url:'art/tal.webp',encuadre:encThal});
const fuenteCliente=readFileSync(new URL('./arte-remoto.js',import.meta.url),'utf8');
const fuenteVistas=readFileSync(new URL('./arte-vistas.js',import.meta.url),'utf8');
function clienteArte(estudio=false){
  const temporizadores=new Map(),almacen=new Map(),estado={falla:true,pedidos:0,catalogo:{cartas:[]}};let numero=0;
  const c={URL,URLSearchParams,AbortController,Event,
    location:{href:'https://juego.example/index.html'+(estudio?'?estudioVista=1':''),search:estudio?'?estudioVista=1':'',protocol:'https:'},
    document:{hidden:false,documentElement:{},querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){}},
    MutationObserver:class{observe(){}},
    setTimeout(fn,ms){const id=++numero;temporizadores.set(id,{fn,ms});return id;},clearTimeout(id){temporizadores.delete(id);},
    setInterval(){},addEventListener(){},dispatchEvent(){},
    localStorage:{getItem:k=>almacen.get(k)||null,setItem:(k,v)=>almacen.set(k,v)},
    CARDS:{tal:{}},LEADERS:{},ARTE:{},cargarArte(){},CAOZ_COLECCION:{elegido:()=> 'normal'},
    encuadreDe:e=>typeof e==='number'?{x:50,y:e,z:100}:e?{x:e.x,y:e.y,z:e.z}:null,
    fetch:async url=>{
      if(String(url).endsWith('art/encuadres.json'))return {ok:true,json:async()=>({tal:arteLocal.tal})};
      estado.pedidos++;return estado.falla?{ok:false}:{ok:true,json:async()=>estado.catalogo};
    },
  };
  c.window=c;c.parent=estudio?{}:c;vm.createContext(c);
  vm.runInContext(fuenteVistas,c);vm.runInContext(fuenteCliente,c);
  return {c,estado,temporizadores,almacen,async reintentar(){
    const pendiente=[...temporizadores].find(([,t])=>t.ms===1500||t.ms===3000);assert.ok(pendiente,'Queda un reintento breve programado');
    temporizadores.delete(pendiente[0]);pendiente[1].fn();await c.CAOZ_ARTE.refrescar();
  }};
}
const cliente=clienteArte();await cliente.c.cargarArte();await cliente.c.CAOZ_ARTE.refrescar();
for(const acabado of ['normal','foil','dorado']){
  const v=cliente.c.CAOZ_ARTE.version('tal',acabado,'movil_coleccion');
  assert.equal(v.acabado,acabado);assert.equal(v.url,'art/tal.webp');assert.deepEqual(JSON.parse(JSON.stringify(v.encuadre)),encThal);
}
assert.equal(cliente.c.CAOZ_COLECCION.elegido('tal'),'normal');
assert.deepEqual(Object.keys(cliente.c.ARTE),['tal'],'La instalación conserva el encuadre aunque el servicio falle');
await cliente.reintentar();await cliente.reintentar();
assert.equal(cliente.estado.pedidos,3,'Una caída sólo añade dos reintentos al pedido inicial');
assert.equal(cliente.temporizadores.size,0,'Una caída sostenida no crea un bucle de peticiones');
const reg=(acabado,h,x,vistas={})=>({id:'tal',acabado,revision:2,activo:true,heredada:false,hash:h,mime:'image/webp',x,y:30,z:110,vistas});
const normalNuevo=reg('normal','a'.repeat(64),60,{movil_detalle:{x:11,y:22,z:90}}),foilNuevo=reg('foil','b'.repeat(64),31),oroNuevo=reg('dorado','c'.repeat(64),73);
cliente.estado.catalogo={cartas:[{id:'tal',variantes:{normal:normalNuevo,foil:foilNuevo,dorado:oroNuevo}}]};cliente.estado.falla=false;
await cliente.c.CAOZ_ARTE.refrescar();
assert.equal(cliente.c.urlArte('tal'),'api/arte/imagen/'+normalNuevo.hash,'La publicación nueva tiene prioridad sobre la copia estática');
assert.deepEqual(JSON.parse(JSON.stringify(cliente.c.CAOZ_ARTE.encuadre('tal','movil_detalle'))),{x:11,y:22,z:90},'Se respetan las vistas publicadas');
for(const [acabado,registro]of [['foil',foilNuevo],['dorado',oroNuevo]]){
  const forzada={closest:()=>({dataset:{coleccionAcabado:acabado}})};
  assert.equal(cliente.c.urlArte('tal',forzada),'api/arte/imagen/'+registro.hash,'Cada preview conserva su imagen propia');
  assert.equal(cliente.c.CAOZ_ARTE.encuadre('tal','desktop_coleccion',forzada).x,registro.x);
}
assert.equal(cliente.c.acabadoArte('tal'),'normal','Recuperar el catálogo no equipa un diseño premium');
assert.equal(cliente.almacen.size,1,'Sólo se guarda el catálogo público, no el inventario');
const recuperacion=clienteArte();await recuperacion.c.cargarArte();await recuperacion.c.CAOZ_ARTE.refrescar();
recuperacion.estado.falla=false;recuperacion.estado.catalogo=cliente.estado.catalogo;await recuperacion.reintentar();
assert.equal(recuperacion.c.urlArte('tal'),'api/arte/imagen/'+normalNuevo.hash,'El reintento automático recupera el arte publicado');
assert.equal(recuperacion.temporizadores.size,0,'El éxito cancela los reintentos pendientes');
const visor=clienteArte(true);await visor.c.cargarArte();
visor.c.CAOZ_ARTE.previsualizar({id:'tal',acabado:'dorado',url:'blob:https://juego.example/borrador',encuadre:{x:14,y:16,z:180}});
assert.equal(visor.c.urlArte('tal'),'blob:https://juego.example/borrador','El borrador aislado del estudio conserva su archivo');
assert.equal(visor.c.acabadoArte('tal'),'dorado');assert.equal(visor.c.CAOZ_ARTE.encuadre('tal','desktop_detalle').z,180);
assert.equal(visor.estado.pedidos,0,'El visor del estudio no consulta el catálogo público');
console.log('Thal: copia Normal idéntica, fallback ante503, dos reintentos acotados, recuperación, prioridad de publicación, vistas y previews del estudio: OK');

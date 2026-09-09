/* API privada de SFX para Cloudflare Pages. El juego y el arte siguen estáticos.
   SFX_DB es una base D1 propia del entorno; las claves sólo viven en secretos.
   Nunca se autoriza una escritura con una contraseña incluida en JavaScript. */
const enc=new TextEncoder(),MAXIMO=1600044,COOKIE='__Host-caoz-sfx';
const volumenBase={"ui_hover":0.17,"ui_confirm":0.42,"ui_back":0.34,"menu_gold":0.52,"card_draw":0.4,"card_play":0.68,"attack_wind":0.65,"attack_hit":0.84,"counter":0.55,"lethal":0.86,"shield":0.59,"heal":0.56,"buff":0.54,"spell_fire":0.73,"spell_frost":0.57,"spell_lightning":0.73,"spell_arcane":0.61,"spell_shadow":0.59,"spell_bard":0.61,"spell_holy":0.62,"dice_roll":0.62,"dice_land":0.6,"coin_flip":0.62,"coin_land":0.62,"vs":0.77,"turn":0.43,"table_hop":0.55,"table_hit":0.72,"fog_reveal":0.36,"victory":0.68,"defeat":0.64,"ascension":0.63,"wish_fire":0.76,"wish_granted":0.61,"leader_hit":0.82,"card_hover":0.22,"victory_slam":0.8};
const ids=new Set(Object.keys(volumenBase));
const json=(v,status=200,cab={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...cab}});
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const sha=async v=>hex(await crypto.subtle.digest('SHA-256',typeof v==='string'?enc.encode(v):v));
async function hmac(clave,texto){const k=await crypto.subtle.importKey('raw',enc.encode(clave),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(texto)));}
function igual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
async function autenticado(req,env){
  const v=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  const [vence,azar,firma]=v.split('.');if(!/^\d{13}$/.test(vence||'')||!/^[a-f0-9]{32}$/.test(azar||'')||Number(vence)<Date.now()||Number(vence)>Date.now()+28801000)return false;
  return igual(firma,await hmac(env.SFX_SESSION_KEY,vence+'.'+azar));
}
async function cuerpo(req,max){
  if(Number(req.headers.get('content-length'))>max)throw Object.assign(Error('El archivo es demasiado grande.'),{status:413});
  const lector=req.body?.getReader();if(!lector)return new Uint8Array();let partes=[],total=0;
  while(true){const {done,value}=await lector.read();if(done)break;total+=value.byteLength;if(total>max){await lector.cancel();throw Object.assign(Error('El archivo es demasiado grande.'),{status:413});}partes.push(value);}
  const out=new Uint8Array(total);let i=0;for(const p of partes){out.set(p,i);i+=p.length;}return out;
}
function validarWav(b){
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),texto=(i,n)=>String.fromCharCode(...b.slice(i,i+n));
  if(b.length<46||texto(0,4)!=='RIFF'||texto(8,4)!=='WAVE'||texto(12,4)!=='fmt '||texto(36,4)!=='data'||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(34,true)!==16||v.getUint32(4,true)!==b.length-8||v.getUint32(40,true)!==b.length-44)throw Error('Se requiere WAV PCM de 16 bits, convertido por el estudio.');
  const canales=v.getUint16(22,true),hz=v.getUint32(24,true),bloque=canales*2;
  if(![1,2].includes(canales)||![32000,44100,48000].includes(hz)||v.getUint16(32,true)!==bloque||v.getUint32(28,true)!==hz*bloque||(b.length-44)%bloque)throw Error('Formato de audio no admitido.');
  const duracion=(b.length-44)/(hz*bloque);if(duracion<.03||duracion>12)throw Error('El sonido debe durar entre 0.03 y 12 segundos.');
  let pico=0;for(let i=44;i<b.length;i+=2)pico=Math.max(pico,Math.abs(v.getInt16(i,true)));
  if(pico<10)throw Error('El archivo está vacío o no tiene sonido audible.');return duracion;
}
let iniciada;
async function preparar(db){
  if(!iniciada)iniciada=db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS sonidos (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, hash TEXT, anterior TEXT, nombre TEXT, duracion REAL, volumen REAL NOT NULL DEFAULT 1, actualizado TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS audios (hash TEXT PRIMARY KEY, contenido BLOB NOT NULL, creado INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS accesos (ip TEXT PRIMARY KEY, n INTEGER NOT NULL, vence INTEGER NOT NULL)')
  ]).catch(e=>{iniciada=null;throw e;});return iniciada;
}
async function api(req,env){
  const u=new URL(req.url),ruta=u.pathname.replace(/^\/api\/sfx\/?/,'');
  if(!env.SFX_DB||!env.SFX_ADMIN_HASH||!env.SFX_SESSION_KEY)return json({error:'El estudio privado está pendiente de conectar con Cloudflare.'},503);
  const db=env.SFX_DB;await preparar(db);
  if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==u.origin)return json({error:'Origen no autorizado.'},403);
  if(req.method==='GET'&&ruta==='catalogo'){
    const {results}=await db.prepare('SELECT id, hash, volumen, revision FROM sonidos').all();return json({sonidos:results});
  }
  if(['GET','HEAD'].includes(req.method)&&/^audio\/[a-f0-9]{64}$/.test(ruta)){
    const fila=await db.prepare('SELECT contenido FROM audios WHERE hash=?').bind(ruta.slice(6)).first();
    if(!fila)return json({error:'Sonido no encontrado.'},404);
    const b=new Uint8Array(fila.contenido),headers={'Content-Type':'audio/wav','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable','Accept-Ranges':'bytes','Content-Length':String(b.length)};
    const rango=req.headers.get('range');if(rango){
      const m=/^bytes=(\d+)-(\d*)$/.exec(rango),a=Number(m?.[1]),z=m?.[2]?Math.min(b.length-1,Number(m[2])):b.length-1;
      if(!m||!Number.isSafeInteger(a)||!Number.isSafeInteger(z)||a>=b.length||a>z)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+b.length,'Content-Length':'0'}});
      return new Response(req.method==='HEAD'?null:b.slice(a,z+1),{status:206,headers:{...headers,'Content-Range':`bytes ${a}-${z}/${b.length}`,'Content-Length':String(z-a+1)}});
    }
    return new Response(req.method==='HEAD'?null:b,{headers});
  }
  if(req.method==='POST'&&ruta==='sesion'){
    const ip=await sha((req.headers.get('cf-connecting-ip')||'local')+env.SFX_SESSION_KEY),ahora=Date.now();
    const fila=await db.prepare('INSERT INTO accesos(ip,n,vence) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET n=CASE WHEN vence<? THEN 1 ELSE n+1 END, vence=CASE WHEN vence<? THEN excluded.vence ELSE vence END RETURNING n').bind(ip,ahora+900000,ahora,ahora).first();
    if(fila.n>8)return json({error:'Demasiados intentos. Espera 15 minutos.'},429,{'Retry-After':'900'});
    const datos=JSON.parse(new TextDecoder().decode(await cuerpo(req,1000)));
    if(typeof datos.clave!=='string'||!igual(await sha(datos.clave),env.SFX_ADMIN_HASH))return json({error:'La clave no es correcta.'},401);
    const texto=String(ahora+28800000)+'.'+hex(crypto.getRandomValues(new Uint8Array(16))),cookie=texto+'.'+await hmac(env.SFX_SESSION_KEY,texto);
    await db.prepare('DELETE FROM accesos WHERE ip=? OR vence<?').bind(ip,ahora).run();
    return json({ok:true},200,{'Set-Cookie':COOKIE+'='+cookie+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'});
  }
  if(req.method==='DELETE'&&ruta==='sesion')return json({ok:true},200,{'Set-Cookie':COOKIE+'=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  if(!await autenticado(req,env))return json({error:'Inicia sesión para administrar los sonidos.'},401);
  if(req.method==='GET'&&ruta==='privado'){
    const {results}=await db.prepare('SELECT id, revision, hash, anterior, nombre, duracion, volumen, actualizado FROM sonidos').all();return json({sonidos:results,entorno:env.CF_PAGES_BRANCH==='gh-pages'?'produccion':'beta'});
  }
  if(ruta.startsWith('sonido/')){
    const id=ruta.slice(7);if(!ids.has(id))return json({error:'Sonido desconocido.'},404);
    if(!['PUT','PATCH','DELETE'].includes(req.method))return json({error:'Método no permitido.'},405);
    const rev=req.headers.get('if-match');if(!/^\d{1,9}$/.test(rev||''))return json({error:'Recarga el catálogo antes de guardar.'},428);
    await db.prepare('INSERT OR IGNORE INTO sonidos(id,volumen) VALUES (?,?)').bind(id,volumenBase[id]).run();
    const actual=await db.prepare('SELECT * FROM sonidos WHERE id=?').bind(id).first();
    if(actual.revision!==Number(rev))return json({error:'Este sonido cambió en otra ventana. Recarga y revisa la nueva versión.'},409);
    let hash=actual.hash,nombre=actual.nombre,duracion=actual.duracion,volumen=actual.volumen,anterior=actual.anterior;
    if(req.method==='PUT'){
      const b=await cuerpo(req,MAXIMO);duracion=validarWav(b);hash=await sha(b);anterior=actual.hash;
      nombre=decodeURIComponent(req.headers.get('x-sfx-name')||'Reemplazo.wav').replace(/[\u0000-\u001f<>]/g,'').slice(0,100);
      await db.prepare('INSERT OR IGNORE INTO audios(hash,contenido,creado) VALUES (?,?,?)').bind(hash,b.buffer,Date.now()).run();
    }else if(req.method==='PATCH'){
      const datos=JSON.parse(new TextDecoder().decode(await cuerpo(req,1000)));
      if(typeof datos.volumen!=='number'||!Number.isFinite(datos.volumen)||datos.volumen<0||datos.volumen>1)throw Error('Volumen no válido.');volumen=datos.volumen;
    }else{hash=null;anterior=actual.hash||actual.anterior;nombre=null;duracion=null;
      volumen=volumenBase[id];
    }
    const actualizado=new Date().toISOString();
    const cambio=await db.prepare('UPDATE sonidos SET hash=?,anterior=?,nombre=?,duracion=?,volumen=?,revision=revision+1,actualizado=? WHERE id=? AND revision=?').bind(hash,anterior,nombre,duracion,volumen,actualizado,id,Number(rev)).run();
    if(cambio.meta.changes!==1)return json({error:'Otra sesión guardó primero. Recarga el estudio.'},409);
    // Se conserva el reemplazo anterior. Lo demás se retira después de 24 h,
    // dando margen a las partidas abiertas para terminar con su banco cargado.
    await db.prepare('DELETE FROM audios WHERE creado<? AND hash NOT IN (SELECT hash FROM sonidos WHERE hash IS NOT NULL UNION SELECT anterior FROM sonidos WHERE anterior IS NOT NULL)').bind(Date.now()-86400000).run();
    return json({ok:true,id,revision:Number(rev)+1,hash,anterior,nombre,duracion,volumen,actualizado});
  }
  return json({error:'Ruta no encontrada.'},404);
}
export default {
  async fetch(req,env){
    if(!new URL(req.url).pathname.startsWith('/api/sfx/'))return env.ASSETS.fetch(req);
    try{return await api(req,env);}catch(e){return json({error:e.status?e.message:e instanceof SyntaxError?'Solicitud no válida.':e.message?.startsWith('D1_')?'No se pudo guardar. Intenta de nuevo.':e.message||'No se pudo completar la solicitud.'},e.status||400);}
  }
};

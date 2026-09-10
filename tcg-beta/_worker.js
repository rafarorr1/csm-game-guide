/* Estudios privados de SFX e ilustraciones para Cloudflare Pages.
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
const preparacionesSfx=new WeakMap();
async function preparar(db){
  if(!preparacionesSfx.has(db))preparacionesSfx.set(db,db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS sonidos (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, hash TEXT, anterior TEXT, nombre TEXT, duracion REAL, volumen REAL NOT NULL DEFAULT 1, actualizado TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS audios (hash TEXT PRIMARY KEY, contenido BLOB NOT NULL, creado INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS accesos (ip TEXT PRIMARY KEY, n INTEGER NOT NULL, vence INTEGER NOT NULL)')
  ]).catch(e=>{preparacionesSfx.delete(db);throw e;}));return preparacionesSfx.get(db);
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
// Las ilustraciones comparten el acceso del estudio, pero no sus tablas ni archivos.
// D1 limita cada BLOB/fila a 2 MB; 1.5 MB deja margen para metadatos.
const MAXIMO_ARTE=1500000,ACABADOS_ARTE=['normal','foil','dorado'],preparacionesArte=new WeakMap(),catalogosArte=new WeakMap();
const falloArte=(mensaje,status=400)=>{throw Object.assign(Error(mensaje),{status});};
const VISTAS_ARTE=new Set(['revelada','ruta','mano','campo','detalle','coleccion','descarte','memoria','seleccion','vs','victoria','hud','campana','honor'].flatMap(v=>['desktop_'+v,'movil_'+v]));
function encuadreArte(datos,esVista=false){
  if(!datos||Array.isArray(datos)||Object.keys(datos).some(k=>!(esVista?['x','y','z']:['x','y','z','vistas']).includes(k))||
    !['x','y','z'].every(k=>typeof datos[k]==='number'&&Number.isFinite(datos[k]))||
    datos.x<0||datos.x>100||datos.y<0||datos.y>100||datos.z<50||datos.z>300)
    falloArte('El encuadre requiere x e y de 0 a 100 y zoom de 50 a 300.');
  const salida={x:datos.x,y:datos.y,z:datos.z};
  if(!esVista&&Object.hasOwn(datos,'vistas')){
    if(!datos.vistas||Array.isArray(datos.vistas)||typeof datos.vistas!=='object'||Object.keys(datos.vistas).some(k=>!VISTAS_ARTE.has(k)))falloArte('Vista de carta desconocida.');
    salida.vistas=Object.fromEntries(Object.keys(datos.vistas).sort().map(k=>[k,encuadreArte(datos.vistas[k],true)]));
  }
  return salida;
}
function dimensionesArte(ancho,alto){
  if(!Number.isInteger(ancho)||!Number.isInteger(alto)||ancho<16||alto<16||ancho>4096||alto>4096||ancho*alto>16000000)
    falloArte('La ilustración debe medir de 16 a 4096 píxeles por lado y hasta 16 megapíxeles.');
  return {ancho,alto};
}
// Se comprueban la firma y la estructura del contenedor; nunca se acepta SVG/HTML
// ni se confía en la extensión del archivo o en las dimensiones enviadas por el cliente.
function validarImagenArte(b,mime){
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),texto=(i,n)=>String.fromCharCode(...b.subarray(i,i+n));
  const mal=()=>falloArte('La imagen está dañada o no coincide con su formato.');
  if(mime==='image/png'){
    if(b.length<57||!b.subarray(0,8).every((n,i)=>n===[137,80,78,71,13,10,26,10][i]))mal();
    let p=8,dim=null,datos=false,fin=false;
    while(p+12<=b.length){
      const n=v.getUint32(p),tipo=texto(p+4,4);if(p+12+n>b.length)mal();
      if(!dim&&tipo!=='IHDR')mal();
      if(tipo==='IHDR'){
        if(dim||n!==13)mal();
        dim=dimensionesArte(v.getUint32(p+8),v.getUint32(p+12));
        const profundidad=b[p+16],color=b[p+17];
        if(!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]})[color]?.includes(profundidad)||b[p+18]!==0||b[p+19]!==0||b[p+20]>1)mal();
      }else if(tipo==='IDAT'){if(n)datos=true;}
      else if(tipo==='acTL')falloArte('Utiliza una ilustración estática, sin animación.');
      else if(tipo==='IEND'){if(n!==0||p+12!==b.length)mal();fin=true;break;}
      p+=12+n;
    }
    if(!dim||!datos||!fin)mal();return dim;
  }
  if(mime==='image/jpeg'){
    if(b.length<30||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)mal();
    let p=2,dim=null;
    while(p+4<=b.length){
      if(b[p++]!==255)mal();while(b[p]===255)p++;
      const marca=b[p++];if(marca===217||marca===0)mal();
      if(marca===1||(marca>=208&&marca<=215))continue;
      const n=v.getUint16(p);if(n<2||p+n>b.length)mal();
      if([192,193,194].includes(marca)){
        if(dim||n<11||b[p+2]!==8||![1,3,4].includes(b[p+7])||n!==8+3*b[p+7])mal();
        dim=dimensionesArte(v.getUint16(p+5),v.getUint16(p+3));
      }
      if(marca===218){if(!dim||n<6||p+n>=b.length-2)mal();return dim;}
      p+=n;
    }
    mal();
  }
  if(mime==='image/webp'){
    if(b.length<26||texto(0,4)!=='RIFF'||texto(8,4)!=='WEBP'||v.getUint32(4,true)!==b.length-8)mal();
    let p=12,dim=null,lienzo=null;
    const u24=i=>b[i]|b[i+1]<<8|b[i+2]<<16;
    while(p+8<=b.length){
      const tipo=texto(p,4),n=v.getUint32(p+4,true),q=p+8,fin=q+n+(n%2);if(fin>b.length)mal();
      if(tipo==='VP8X'){
        if(n!==10||lienzo||dim||(b[q]&2))mal();
        lienzo=dimensionesArte(u24(q+4)+1,u24(q+7)+1);
      }else if(tipo==='VP8 '){
        if(dim||n<11||(b[q]&1)||texto(q+3,3)!=='\x9d\x01\x2a')mal();
        dim=dimensionesArte(v.getUint16(q+6,true)&16383,v.getUint16(q+8,true)&16383);
      }else if(tipo==='VP8L'){
        if(dim||n<6||b[q]!==47||(b[q+4]&224))mal();
        const bits=v.getUint32(q+1,true);dim=dimensionesArte((bits&16383)+1,((bits>>>14)&16383)+1);
      }else if(tipo==='ANIM'||tipo==='ANMF')falloArte('Utiliza una ilustración estática, sin animación.');
      p=fin;
    }
    if(p!==b.length||!dim||(lienzo&&(lienzo.ancho!==dim.ancho||lienzo.alto!==dim.alto)))mal();return dim;
  }
  falloArte('Utiliza una imagen WebP, PNG o JPEG.',415);
}
async function prepararArte(db){
  if(!preparacionesArte.has(db))preparacionesArte.set(db,db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS ilustraciones (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, hash TEXT, anterior TEXT, nombre TEXT, mime TEXT, ancho INTEGER, alto INTEGER, x REAL, y REAL, z REAL, actualizado TEXT)'),
    // Normal conserva la tabla y las revisiones existentes, sin copiar ni sobrescribir datos.
    db.prepare("CREATE TABLE IF NOT EXISTS ilustraciones_acabados (id TEXT NOT NULL, acabado TEXT NOT NULL CHECK(acabado IN ('foil','dorado')), activo INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, hash TEXT, anterior TEXT, nombre TEXT, mime TEXT, ancho INTEGER, alto INTEGER, x REAL, y REAL, z REAL, actualizado TEXT, PRIMARY KEY(id,acabado))"),
    db.prepare('CREATE TABLE IF NOT EXISTS imagenes (hash TEXT PRIMARY KEY, contenido BLOB NOT NULL, mime TEXT NOT NULL, creado INTEGER NOT NULL)')
  ]).then(async()=>{
    // Migración aditiva: conserva ilustraciones, revisiones y acabados existentes.
    for(const tabla of ['ilustraciones','ilustraciones_acabados']){
      const columnas=(await db.prepare('PRAGMA table_info('+tabla+')').all()).results;
      if(!columnas.some(c=>c.name==='vistas'))try{await db.prepare('ALTER TABLE '+tabla+' ADD COLUMN vistas TEXT').run();}catch(e){if(!/duplicate column/i.test(String(e.message)))throw e;}
    }
  }).catch(e=>{preparacionesArte.delete(db);throw e;}));
  return preparacionesArte.get(db);
}
async function idsArte(req,env){
  if(!catalogosArte.has(env.ASSETS))catalogosArte.set(env.ASSETS,(async()=>{
    const respuesta=await env.ASSETS.fetch(new Request(new URL('/art/catalogo.json',req.url)));
    if(!respuesta.ok)falloArte('No se pudo cargar el catálogo de cartas. Intenta de nuevo.',503);
    const datos=await respuesta.json();
    if(datos?.version!==1||!Array.isArray(datos.cartas)||!datos.cartas.length||datos.cartas.some(c=>typeof c?.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(c.id)))
      falloArte('El catálogo de cartas no es válido.',503);
    return new Set(datos.cartas.map(c=>c.id));
  })().catch(e=>{catalogosArte.delete(env.ASSETS);throw e;}));
  return catalogosArte.get(env.ASSETS);
}
function arteVacio(id,acabado='normal'){
  return {id,acabado,activo:acabado==='normal'?1:0,revision:0,hash:null,anterior:null,nombre:null,mime:null,ancho:null,alto:null,x:null,y:null,z:null,vistas:null,actualizado:null};
}
function registroArte(registro,normal,privado){
  const activo=registro.acabado==='normal'||!!registro.activo;
  const heredada=activo&&registro.acabado!=='normal'&&!registro.hash;
  const imagen=heredada?(normal||arteVacio(registro.id)):registro;
  const salida={id:registro.id,acabado:registro.acabado,activo,heredada,revision:registro.revision,hash:imagen.hash,mime:imagen.mime,ancho:imagen.ancho,alto:imagen.alto,x:registro.x,y:registro.y,z:registro.z,vistas:registro.vistas?JSON.parse(registro.vistas):{},actualizado:registro.actualizado};
  if(privado){salida.anterior=registro.anterior;salida.nombre=imagen.nombre;}
  return salida;
}
async function filasArte(db,privado,id=null){
  // Una sola lectura produce una vista consistente de normal y sus acabados.
  const campos='revision,hash,anterior,nombre,mime,ancho,alto,x,y,z,vistas,actualizado',filtro=id?' WHERE id=?':'';
  let consulta=db.prepare("SELECT id,'normal' AS acabado,1 AS activo,"+campos+' FROM ilustraciones'+filtro+' UNION ALL SELECT id,acabado,activo,'+campos+' FROM ilustraciones_acabados'+filtro);
  if(id)consulta=consulta.bind(id,id);
  const {results}=await consulta.all(),porCarta=new Map();
  for(const r of results){if(!porCarta.has(r.id))porCarta.set(r.id,{normal:null,foil:null,dorado:null});porCarta.get(r.id)[r.acabado]=r;}
  return [...porCarta].map(([id,registros])=>{
    const variantes=Object.fromEntries(ACABADOS_ARTE.map(a=>[a,registros[a]?registroArte(registros[a],registros.normal,privado):null]));
    const acabado=['dorado','foil'].find(a=>variantes[a]?.activo)||'normal';
    const normal=variantes.normal||registroArte(arteVacio(id),null,privado);
    // El panel anterior sólo edita normal: no darle la revisión de otro acabado.
    const plana=privado?normal:(variantes[acabado]||normal);
    return {...plana,acabado,variantes};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
async function apiArte(req,env){
  const u=new URL(req.url),ruta=u.pathname.slice('/api/arte/'.length),db=env.SFX_DB;
  if(!db||!env.SFX_ADMIN_HASH||!env.SFX_SESSION_KEY)return json({error:'El estudio privado está pendiente de conectar con Cloudflare.'},503);
  if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==u.origin)return json({error:'Origen no autorizado.'},403);
  await prepararArte(db);
  if(req.method==='GET'&&ruta==='catalogo'){
    return json({cartas:await filasArte(db,false)});
  }
  if(['GET','HEAD'].includes(req.method)&&/^imagen\/[a-f0-9]{64}$/.test(ruta)){
    const hash=ruta.slice(7),fila=await db.prepare('SELECT contenido,mime FROM imagenes WHERE hash=?').bind(hash).first();
    if(!fila)return json({error:'Ilustración no encontrada.'},404);
    const b=new Uint8Array(fila.contenido),headers={'Content-Type':fila.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable','Content-Length':String(b.length),ETag:'"'+hash+'"','Content-Security-Policy':"default-src 'none'; sandbox"};
    if(req.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
    return new Response(req.method==='HEAD'?null:b,{headers});
  }
  if(!await autenticado(req,env))return json({error:'Inicia sesión para administrar las ilustraciones.'},401);
  if(req.method==='GET'&&ruta==='privado'){
    return json({cartas:await filasArte(db,true),entorno:env.CF_PAGES_BRANCH==='gh-pages'?'produccion':'beta'});
  }
  if(ruta.startsWith('carta/')){
    const partes=ruta.slice(6).split('/'),id=partes[0],acabado=partes[1]||'normal';
    if(partes.length>2||!ACABADOS_ARTE.includes(acabado))return json({error:'Acabado desconocido.'},404);
    if(!(await idsArte(req,env)).has(id))return json({error:'Carta desconocida.'},404);
    if(!['PUT','PATCH','DELETE'].includes(req.method))return json({error:'Método no permitido.'},405);
    const rev=req.headers.get('if-match');if(!/^\d{1,9}$/.test(rev||''))return json({error:'Recarga el catálogo antes de guardar.'},428);
    let actual;
    if(acabado==='normal'){
      await db.prepare('INSERT OR IGNORE INTO ilustraciones(id) VALUES (?)').bind(id).run();
      actual=await db.prepare('SELECT * FROM ilustraciones WHERE id=?').bind(id).first();
    }else actual=await db.prepare('SELECT * FROM ilustraciones_acabados WHERE id=? AND acabado=?').bind(id,acabado).first()||arteVacio(id,acabado);
    if(actual.revision!==Number(rev))return json({error:'Esta carta cambió en otra ventana. Recarga y revisa la nueva versión.'},409);
    let {hash,anterior,nombre,mime,ancho,alto,x,y,z,vistas}=actual;
    const recibir=datos=>{const e=encuadreArte(datos);({x,y,z}=e);if(e.vistas)vistas=JSON.stringify(e.vistas);};
    if(req.method==='PUT'){
      mime=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!['image/webp','image/png','image/jpeg'].includes(mime))falloArte('Utiliza una imagen WebP, PNG o JPEG.',415);
      recibir(JSON.parse(req.headers.get('x-arte-encuadre')||'null'));
      const b=await cuerpo(req,MAXIMO_ARTE);({ancho,alto}=validarImagenArte(b,mime));hash=await sha(b);anterior=actual.hash||actual.anterior;
      nombre=decodeURIComponent(req.headers.get('x-arte-nombre')||'Ilustración').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,100)||'Ilustración';
      await db.prepare('INSERT OR IGNORE INTO imagenes(hash,contenido,mime,creado) VALUES (?,?,?,?)').bind(hash,b.buffer,mime,Date.now()).run();
    }else if(req.method==='PATCH'){
      recibir(JSON.parse(new TextDecoder().decode(await cuerpo(req,6000))));
    }else{
      anterior=actual.hash||actual.anterior;hash=null;nombre=null;mime=null;ancho=null;alto=null;x=null;y=null;z=null;vistas=null;
    }
    const actualizado=new Date().toISOString();
    let cambio;
    if(acabado==='normal')cambio=await db.prepare('UPDATE ilustraciones SET hash=?,anterior=?,nombre=?,mime=?,ancho=?,alto=?,x=?,y=?,z=?,vistas=?,revision=revision+1,actualizado=? WHERE id=? AND revision=?').bind(hash,anterior,nombre,mime,ancho,alto,x,y,z,vistas,actualizado,id,Number(rev)).run();
    else{
      // La variante sólo aparece tras una escritura válida. INSERT y CAS son atómicos.
      const cambios=await db.batch([
        db.prepare('INSERT OR IGNORE INTO ilustraciones_acabados(id,acabado) VALUES (?,?)').bind(id,acabado),
        db.prepare('UPDATE ilustraciones_acabados SET hash=?,anterior=?,nombre=?,mime=?,ancho=?,alto=?,x=?,y=?,z=?,vistas=?,activo=?,revision=revision+1,actualizado=? WHERE id=? AND acabado=? AND revision=?').bind(hash,anterior,nombre,mime,ancho,alto,x,y,z,vistas,req.method==='DELETE'?0:1,actualizado,id,acabado,Number(rev))
      ]);cambio=cambios[1];
    }
    if(cambio.meta.changes!==1)return json({error:'Otra sesión guardó primero. Recarga el estudio.'},409);
    // Guarda la imagen anterior y respeta las partidas abiertas durante 24 horas.
    await db.prepare('DELETE FROM imagenes WHERE creado<? AND hash NOT IN (SELECT hash FROM ilustraciones WHERE hash IS NOT NULL UNION SELECT anterior FROM ilustraciones WHERE anterior IS NOT NULL UNION SELECT hash FROM ilustraciones_acabados WHERE hash IS NOT NULL UNION SELECT anterior FROM ilustraciones_acabados WHERE anterior IS NOT NULL)').bind(Date.now()-86400000).run();
    const [carta]=await filasArte(db,true,id),variante=carta.variantes[acabado];
    return json({ok:true,...variante,variante,carta});
  }
  return json({error:'Ruta no encontrada.'},404);
}
// Biblioteca única privada. Los borradores viven en tablas propias de producción;
// publicar copia una instantánea a un destino, sin compartir claves ni catálogos vivos.
const tablasEstudio=['sonidos','audios','accesos','ilustraciones','ilustraciones_acabados','imagenes'];
const basesEstudio=new WeakMap(),iniciosEstudio=new WeakMap(),controlesEstudio=new WeakMap();
const URL_ESTUDIO='https://juego.caozcontodo.com';
function baseEstudio(db){
  if(!basesEstudio.has(db))basesEstudio.set(db,{prepare(sql){return db.prepare(sql.replace(/\b(sonidos|audios|accesos|ilustraciones_acabados|ilustraciones|imagenes)\b/g,t=>t+'_estudio'));},batch:cmds=>db.batch(cmds)});
  return basesEstudio.get(db);
}
async function iniciarEstudio(db){
  if(!iniciosEstudio.has(db))iniciosEstudio.set(db,(async()=>{
    const borrador=baseEstudio(db);await preparar(db);await prepararArte(db);await preparar(borrador);await prepararArte(borrador);
    await db.prepare('CREATE TABLE IF NOT EXISTS estudio_inicio (id TEXT PRIMARY KEY)').run();
    // La marca forma parte de la misma transacción: dos primeros accesos no
    // vuelven a importar originales encima de una edición recién guardada.
    await db.batch([...tablasEstudio.filter(t=>t!=='accesos').map(t=>db.prepare("INSERT OR IGNORE INTO "+t+"_estudio SELECT * FROM "+t+" WHERE NOT EXISTS (SELECT 1 FROM estudio_inicio WHERE id='235')")),db.prepare("INSERT OR IGNORE INTO estudio_inicio(id) VALUES ('235')")]);
  })().catch(e=>{iniciosEstudio.delete(db);throw e;}));return iniciosEstudio.get(db);
}
async function controlEstudio(db){
  if(!controlesEstudio.has(db))controlesEstudio.set(db,db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS estudio_lotes (tipo TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, huella TEXT, actualizado TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS estudio_guardia (valor INTEGER NOT NULL CHECK(valor=1))')
  ]).catch(e=>{controlesEstudio.delete(db);throw e;}));return controlesEstudio.get(db);
}
const camposSonido=['id','hash','nombre','duracion','volumen'];
const camposImagen=['id','acabado','activo','hash','nombre','mime','ancho','alto','x','y','z','vistas'];
async function leerEstudio(db,tipo){
  if(tipo==='sfx'){await preparar(db);return (await db.prepare('SELECT * FROM sonidos ORDER BY id').all()).results;}
  await prepararArte(db);
  return (await db.prepare("SELECT id,'normal' AS acabado,1 AS activo,revision,hash,anterior,nombre,mime,ancho,alto,x,y,z,vistas,actualizado FROM ilustraciones UNION ALL SELECT id,acabado,activo,revision,hash,anterior,nombre,mime,ancho,alto,x,y,z,vistas,actualizado FROM ilustraciones_acabados ORDER BY id,acabado").all()).results;
}
const claveFila=r=>r.id+'/'+(r.acabado||'');
function contenidoEstudio(r,tipo){
  const vacio=tipo==='sfx'?{id:r.id,hash:null,nombre:null,duracion:null,volumen:volumenBase[r.id]}:{...arteVacio(r.id,r.acabado),activo:r.acabado==='normal'?1:0};
  return Object.fromEntries((tipo==='sfx'?camposSonido:camposImagen).filter(k=>k!=='nombre').map(k=>[k,r[k]??vacio[k]??null]));
}
async function planEstudio(env,tipo,destino){
  const db=destino==='beta'?env.SFX_BETA_DB:env.SFX_DB;
  if(!db)falloArte('No se pudo conectar con '+(destino==='beta'?'beta':'producción')+'. Los cambios siguen guardados.',503);
  const fuente=await leerEstudio(baseEstudio(env.SFX_DB),tipo),publicado=await leerEstudio(db,tipo);await controlEstudio(db);
  const revision=(await db.prepare('SELECT revision FROM estudio_lotes WHERE tipo=?').bind(tipo).first())?.revision||0;
  const actuales=new Map(publicado.map(r=>[claveFila(r),r])),idsFuente=new Set(fuente.map(r=>r.id));
  const candidatas=[...fuente];
  // Retirar un acabado del borrador también lo retira al publicar esa carta.
  for(const r of publicado)if(idsFuente.has(r.id)&&!fuente.some(f=>claveFila(f)===claveFila(r)))candidatas.push({...arteVacio(r.id,r.acabado)});
  const cambios=candidatas.filter(r=>JSON.stringify(contenidoEstudio(r,tipo))!==JSON.stringify(contenidoEstudio(actuales.get(claveFila(r))||{id:r.id,acabado:r.acabado},tipo)));
  const huella=await sha(JSON.stringify({tipo,destino,revision,fuente,publicado}));
  return {db,fuente,publicado,cambios,huella,revision,ids:[...new Set(cambios.map(r=>r.id))]};
}
async function estadoEstudio(env,tipo){
  const salida={};for(const destino of ['beta','produccion']){
    try{const p=await planEstudio(env,tipo,destino);salida[destino]={pendientes:p.ids.length,ids:p.ids,huella:p.huella};}
    catch(e){salida[destino]={error:'Destino no disponible. Actualiza para volver a intentar.'};}
  }return salida;
}
function upsertEstudio(db,tabla,filas,campos){
  const valores=campos.map(k=>"json_extract(value,'$."+k+"')").join(','),identidad=tabla==='ilustraciones_acabados'?'id,acabado':'id';
  const editables=campos.filter(k=>!['id','acabado','revision'].includes(k));
  return db.prepare('INSERT INTO '+tabla+' ('+campos.join(',')+') SELECT '+valores+' FROM json_each(?) WHERE 1 ON CONFLICT('+identidad+') DO UPDATE SET '+editables.map(k=>k+'=excluded.'+k).join(',')+',revision='+tabla+'.revision+1').bind(JSON.stringify(filas));
}
async function publicarEstudio(req,env,tipo,destino){
  const p=await planEstudio(env,tipo,destino),recibida=req.headers.get('if-match');
  if(!/^[a-f0-9]{64}$/.test(recibida||''))return json({error:'Actualiza los cambios antes de publicar.'},428);
  if(recibida!==p.huella)return json({error:'La biblioteca o el destino cambió en otra sesión. Revisa los cambios de nuevo.'},409);
  if(!p.cambios.length)return json({ok:true,pendientes:0,publicados:0});
  const tabla=tipo==='sfx'?'audios':'imagenes',fuente=baseEstudio(env.SFX_DB),hashes=[...new Set(p.cambios.map(r=>r.hash).filter(Boolean))];
  const disponibles=new Set((await p.db.prepare('SELECT hash FROM '+tabla).all()).results.map(r=>r.hash));
  const faltan=hashes.filter(h=>!disponibles.has(h));
  // Hasta seis archivos por petición mantiene acotadas memoria y consultas.
  // Estos archivos aún no se referencian desde el catálogo del juego.
  for(const hash of faltan.slice(0,6)){
    const archivo=await fuente.prepare('SELECT * FROM '+tabla+' WHERE hash=?').bind(hash).first();if(!archivo)falloArte('Falta un archivo del borrador. Revisa la biblioteca antes de publicar.',409);
    const b=new Uint8Array(archivo.contenido);if(await sha(b)!==hash)falloArte('No se pudo verificar un archivo del borrador.',409);
    const sql=tipo==='sfx'?'INSERT OR IGNORE INTO audios(hash,contenido,creado) VALUES (?,?,?)':'INSERT OR IGNORE INTO imagenes(hash,contenido,creado,mime) VALUES (?,?,?,?)';
    const args=[hash,b.buffer,Date.now()];if(tipo==='arte')args.push(archivo.mime);await p.db.prepare(sql).bind(...args).run();
  }
  if(faltan.length>6)return json({ok:true,preparando:true,faltan:faltan.length-6});
  const fecha=new Date().toISOString(),actuales=new Map(p.publicado.map(r=>[claveFila(r),r]));
  const filas=p.cambios.map(r=>({...r,anterior:actuales.get(claveFila(r))?.hash||actuales.get(claveFila(r))?.anterior||null,revision:1,actualizado:fecha}));
  const comandos=[p.db.prepare('INSERT INTO estudio_guardia(valor) VALUES (CASE WHEN COALESCE((SELECT revision FROM estudio_lotes WHERE tipo=?),0)=? THEN 1 ELSE 0 END)').bind(tipo,p.revision)];
  if(tipo==='sfx')comandos.push(upsertEstudio(p.db,'sonidos',filas,[...camposSonido,'anterior','revision','actualizado']));
  else{
    const campos=['id','hash','anterior','nombre','mime','ancho','alto','x','y','z','vistas','revision','actualizado'];
    comandos.push(upsertEstudio(p.db,'ilustraciones',filas.filter(r=>r.acabado==='normal'),campos));
    comandos.push(upsertEstudio(p.db,'ilustraciones_acabados',filas.filter(r=>r.acabado!=='normal'),[...campos,'acabado','activo']));
  }
  comandos.push(p.db.prepare('INSERT INTO estudio_lotes(tipo,revision,huella,actualizado) VALUES (?,1,?,?) ON CONFLICT(tipo) DO UPDATE SET revision=revision+1,huella=excluded.huella,actualizado=excluded.actualizado').bind(tipo,p.huella,fecha),p.db.prepare('DELETE FROM estudio_guardia'));
  try{await p.db.batch(comandos);}catch(e){if(String(e.message).includes('CHECK constraint'))return json({error:'Otra sesión publicó primero. Actualiza para revisar el resultado.'},409);throw e;}
  return json({ok:true,publicados:p.ids.length,destino,fecha});
}
async function apiEstudio(req,env){
  const u=new URL(req.url),m=/^\/api\/estudio\/(arte|sfx)\/(.+)$/.exec(u.pathname);
  if(!m)return json({error:'Ruta no encontrada.'},404);
  if(env.CF_PAGES_BRANCH!=='gh-pages')return json({error:'Abre el estudio único para editar y publicar.',estudio:URL_ESTUDIO},409);
  if(!env.SFX_DB||!env.SFX_ADMIN_HASH||!env.SFX_SESSION_KEY)return json({error:'El estudio no está conectado.'},503);
  if(req.headers.get('origin')&&req.headers.get('origin')!==u.origin||!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==u.origin)return json({error:'Origen no autorizado.'},403);
  if(!await autenticado(req,env))return json({error:'Inicia sesión en el estudio.'},401);
  await iniciarEstudio(env.SFX_DB);const [,tipo,ruta]=m;
  if(ruta==='estado'&&req.method==='GET')return json(await estadoEstudio(env,tipo));
  if(/^publicar\/(beta|produccion)$/.test(ruta)&&req.method==='POST')return publicarEstudio(req,env,tipo,ruta.split('/')[1]);
  if(!/^(privado|imagen\/[a-f0-9]{64}|audio\/[a-f0-9]{64}|carta\/[a-zA-Z0-9_-]+\/(normal|foil|dorado)|sonido\/[a-z_]+)$/.test(ruta))return json({error:'Ruta no encontrada.'},404);
  const url=new URL(req.url);url.pathname='/api/'+tipo+'/'+ruta;
  const respuesta=await (tipo==='arte'?apiArte:api)(new Request(url,req),{...env,SFX_DB:baseEstudio(env.SFX_DB)});
  const segura=new Response(respuesta.body,respuesta);segura.headers.set('Cache-Control','no-store');return segura;
}

export default {
  async fetch(req,env){
    const url=new URL(req.url),ruta=url.pathname,esArte=ruta.startsWith('/api/arte/');
    if(env.ESTUDIO_UNICO==='1'){
      if(/^\/(estudio|sonidos)(\.html)?\/?$/.test(ruta)&&url.origin!==URL_ESTUDIO)return Response.redirect(URL_ESTUDIO+'/'+(ruta.includes('sonidos')?'sonidos':'estudio'),302);
      if((esArte||ruta.startsWith('/api/sfx/'))&&!['GET','HEAD'].includes(req.method)&&ruta!=='/api/sfx/sesion')return json({error:'Guarda y publica desde el estudio único.',estudio:URL_ESTUDIO},409);
    }
    if(ruta.startsWith('/api/estudio/')){try{return await apiEstudio(req,env);}catch(e){return json({error:e.status?e.message:'No se pudo completar la operación. Los cambios guardados se conservan.'},e.status||503);}}
    if(!esArte&&!ruta.startsWith('/api/sfx/'))return env.ASSETS.fetch(req);
    try{return await (esArte?apiArte(req,env):api(req,env));}catch(e){return json({error:e.status?e.message:e instanceof SyntaxError?'Solicitud no válida.':e.message?.startsWith('D1_')?'No se pudo guardar. Intenta de nuevo.':e.message||'No se pudo completar la solicitud.'},e.status||400);}
  }
};

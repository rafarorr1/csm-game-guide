/* Copia local exclusiva de Caoz ARPG. Cada pestaña conserva su propia versión.
   Los archivos se identifican por contenido; no se guardan partidas ni cuentas. */
'use strict';
const base=new URL('./',self.location.href),prefijo='caoz-arpg-'+encodeURIComponent(base.pathname),datosNombre=prefijo+'-archivos-v1',metaNombre=prefijo+'-sesiones-v1';
const sesiones=new Map(),descargas=new Map();let colaPreparacion=Promise.resolve();
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
const sha=async b=>hex(await crypto.subtle.digest('SHA-256',b));
const clave=r=>new URL(r.url+'?v='+r.sha256,base).href;
const sesionURL=id=>new URL('__cache_cliente__/'+encodeURIComponent(id),base).href;
const manifestURL=v=>new URL('__cache_version__/'+v,base).href;
const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
const error=(codigo,mensaje)=>Object.assign(new Error(mensaje),{codigo});
function local(url){return url.origin===base.origin&&url.pathname.startsWith(base.pathname);}
async function validar(m){
  if(!m||!Array.isArray(m.recursos)||m.recursos.length>2000||! /^[a-f0-9]{64}$/.test(m.version))throw error('version','La lista de recursos no es válida.');
  const vistos=new Set();
  for(const r of m.recursos){
    if(typeof r.url!=='string'||! /^[a-zA-Z0-9_./-]+$/.test(r.url)||r.url.startsWith('/')||r.url.split('/').some(x=>x==='..'||x==='.')||vistos.has(r.url)||! /^[a-f0-9]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<0)throw error('version','La lista de recursos no es válida.');
    if(!local(new URL(r.url,base)))throw error('version','Recurso fuera del juego.');vistos.add(r.url);
  }
  if(await sha(new TextEncoder().encode(JSON.stringify(m.recursos)))!==m.version)throw error('version','La lista de recursos cambió durante la descarga. Vuelve a intentar.');
  return m;
}
async function sesion(id){
  if(sesiones.has(id))return sesiones.get(id);
  try{const meta=await caches.open(metaNombre),v=await meta.match(sesionURL(id));
    if(v){const r=await meta.match(manifestURL((await v.json()).version));if(r){const m=await r.json();sesiones.set(id,m);return m;}}
  }catch{}
  const cliente=await self.clients.get(id);if(!cliente)return null;
  const canal=new MessageChannel(),m=await new Promise(ok=>{
    const t=setTimeout(()=>{canal.port1.close();ok(null);},3000);
    canal.port1.onmessage=e=>{clearTimeout(t);canal.port1.close();ok(e.data?.manifiesto||null);};
    cliente.postMessage({tipo:'consultar-version'},[canal.port2]);
  });
  if(m){await validar(m);sesiones.set(id,m);return m;}return null;
}
async function obtener(r){
  let cache,guardado;const url=clave(r);
  try{cache=await caches.open(datosNombre);guardado=await cache.match(url);}catch{cache=null;}
  if(guardado)return {respuesta:guardado,local:true};
  if(descargas.has(url)){const v=await descargas.get(url);return {...v,respuesta:v.respuesta.clone(),local:false};}
  const trabajo=(async()=>{
    const control=new AbortController(),limite=setTimeout(()=>control.abort(),90000);
    try{
      const res=await fetch(url,{cache:'no-store',signal:control.signal});
      if(!res.ok||res.type==='opaque'||!local(new URL(res.url)))throw error('red','No se pudo descargar '+r.url+'. Vuelve a intentar.');
      const contenido=await res.arrayBuffer();
      if((r.bytes!==undefined&&contenido.byteLength!==r.bytes)||await sha(contenido)!==r.sha256)throw error('version','El juego se está actualizando o un archivo llegó incompleto. Vuelve a intentar.');
      const headers=new Headers(res.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');headers.set('Cache-Control','no-store');
      const respuesta=new Response(contenido,{status:200,headers});
      let guardada=false;try{if(cache){await cache.put(url,respuesta.clone());guardada=true;}}catch{}
      return {respuesta,guardada};
    }finally{clearTimeout(limite);}
  })();descargas.set(url,trabajo);
  try{const v=await trabajo;return {...v,respuesta:v.respuesta.clone(),local:false};}finally{descargas.delete(url);}
}
async function limpiar(){
  // Nunca borrar la versión de una pestaña abierta, aunque sea anterior a la actual.
  const meta=await caches.open(metaNombre),vivas=new Set(),necesarias=new Set();
  for(const req of await meta.keys())if(new URL(req.url).pathname.includes('/__cache_cliente__/')){
    const id=decodeURIComponent(new URL(req.url).pathname.split('/').pop());
    if(await self.clients.get(id)){const v=(await (await meta.match(req)).json()).version;vivas.add(v);}else{await meta.delete(req);sesiones.delete(id);}
  }
  for(const v of vivas){const res=await meta.match(manifestURL(v));if(res)for(const r of (await res.json()).recursos)necesarias.add(clave(r));}
  const archivos=await caches.open(datosNombre);
  for(const req of await archivos.keys())if(!necesarias.has(req.url)&&!descargas.has(req.url))await archivos.delete(req);
  for(const req of await meta.keys())if(new URL(req.url).pathname.includes('/__cache_version__/')&&!vivas.has(new URL(req.url).pathname.split('/').pop()))await meta.delete(req);
}
async function preparar(evento){
  const puerto=evento.ports[0],cliente=evento.source;if(!puerto||!cliente?.id||!local(new URL(cliente.url)))return;
  const enviar=v=>puerto.postMessage(v);
  try{
    const m=await validar(evento.data.manifiesto),meta=await caches.open(metaNombre);
    try{await meta.put(manifestURL(m.version),json(m));await meta.put(sesionURL(cliente.id),json({version:m.version}));}
    catch{throw error('almacenamiento','No se puede guardar una copia local en este navegador.');}
    sesiones.set(cliente.id,m);
    let siguiente=0,hechos=0,bytes=0,reutilizados=0,descargados=0,fallo=null,persistente=true;
    const total=m.recursos.reduce((n,r)=>n+r.bytes,0);
    enviar({tipo:'progreso',hechos,total:m.recursos.length,bytes,totalBytes:total,reutilizados,descargados});
    async function lote(){while(siguiente<m.recursos.length&&!fallo){const r=m.recursos[siguiente++];try{
      const v=await obtener(r);if(!v.local&&!v.guardada)persistente=false;hechos++;bytes+=r.bytes;if(v.local)reutilizados++;else descargados++;
      enviar({tipo:'progreso',hechos,total:m.recursos.length,bytes,totalBytes:total,reutilizados,descargados});
    }catch(e){fallo=e;}}}
    // Tres descargas evitan retener todo el paquete decodificado en RAM.
    await Promise.all([lote(),lote(),lote()]);if(fallo)throw fallo;
    enviar({tipo:'lista',persistente,version:m.version,bytes,totalBytes:total,reutilizados,descargados,total:m.recursos.length});
    await limpiar().catch(()=>{});
  }catch(e){enviar({tipo:'error',codigo:e.codigo||(/Quota|Security|InvalidState/.test(e.name)?'almacenamiento':'red'),mensaje:e.message});}
}
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{if(e.data?.tipo==='preparar'){
  // La limpieza y la vinculación de otra pestaña nunca se pisan entre sí.
  const avisar=()=>e.ports[0]?.postMessage({tipo:'espera'}),espera=setInterval(avisar,10000);avisar();
  colaPreparacion=colaPreparacion.catch(()=>{}).then(()=>{clearInterval(espera);return preparar(e);});e.waitUntil(colaPreparacion);
}});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  // HTML, manifiesto y trabajador siempre llegan de red para descubrir actualizaciones.
  if(req.method!=='GET'||req.mode==='navigate'||!local(url)||['arpg-three-cache-sw.js','arpg-recursos.json'].includes(url.pathname.split('/').pop()))return;
  e.respondWith((async()=>{
    const ruta=url.pathname.slice(base.pathname.length),v=url.searchParams.get('v');
    const m=/^[a-f0-9]{64}$/.test(v||'')?null:await sesion(e.clientId);
    const r=/^[a-f0-9]{64}$/.test(v||'')?{url:ruta,sha256:v}:m?.recursos.find(x=>x.url===ruta);
    if(!r)return fetch(req);
    try{return (await obtener(r)).respuesta;}catch{
      // Una cuota agotada omite la escritura, nunca la validación. No sustituir
      // silenciosamente un archivo antiguo por los bytes de una nueva publicación.
      return new Response('No se pudo recuperar un recurso de esta versión.',{status:503,headers:{'Content-Type':'text/plain'}});
    }
  })());
});

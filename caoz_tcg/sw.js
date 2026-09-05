/* ==========================================================================
   CAOZ CON TODO — TCG · EL SERVICE WORKER
   Guarda el juego en el teléfono para que abra sin red y sin depender de
   que GitHub o Cloudflare contesten: las dos pantallas, el motor, la
   cinemática, el manifiesto y todas las ilustraciones que lista
   art/encuadres.json.

   Reglas:
   - Lo propio (HTML, JS, manifiesto) se pide primero a la red y, si no
     contesta, sale de la caché: así una versión nueva llega en cuanto hay
     conexión, y sin conexión sigue jugándose la última que se vio.
   - Las ilustraciones salen primero de la caché (no cambian) y se piden a
     la red sólo si faltan.
   - Nada de otros dominios pasa por aquí (los relevos del online, por
     ejemplo, van directos).
   - La caché lleva el número de build: al instalarse una versión nueva se
     borran las anteriores. publicar.sh exige que VERSION coincida con BUILD.
   ========================================================================== */
'use strict';

const VERSION = 158;
const CACHE = 'caoz-tcg-' + VERSION;
const NUCLEO = ['./', 'index.html', 'movil.html', 'motor.js', 'final.js', 'manifest.webmanifest',
                'art/encuadres.json', 'art/logo.webp',
                'art/icono-192.png', 'art/icono-512.png', 'art/icono-512-maskable.png', 'art/icono-180.png'];

/* las ilustraciones: las que lista el índice, más los seis Líderes por si acaso */
async function listaDeArte(){
  const out = ['lider_mohamed', 'lider_fender', 'lider_adreida', 'lider_rafaela', 'lider_talesin', 'lider_gero']
    .map(id => 'art/' + id + '.webp');
  try{
    const r = await fetch('art/encuadres.json', {cache: 'no-cache'});
    if(r.ok){ const enc = await r.json(); Object.keys(enc).forEach(id => out.push('art/' + id + '.webp')); }
  }catch(e){}
  return [...new Set(out)];
}

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(NUCLEO);
    // las ilustraciones que fallen (un id sin dibujo aún) no impiden instalar
    const arte = await listaDeArte();
    await Promise.all(arte.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k.startsWith('caoz-tcg-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const esArte = url => /\/art\/.+\.(webp|png|jpg)$/.test(url.pathname);

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;           // relevos y demás: directos
  if(url.search.includes('test=')) return;                    // el arnés no pasa por la caché

  if(esArte(url)){
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req, {ignoreSearch: true});
      if(hit) return hit;
      try{ const r = await fetch(req); if(r.ok) c.put(req, r.clone()); return r; }
      catch(e){ return new Response('', {status: 504}); }
    })());
    return;
  }

  // HTML, JS, manifiesto: red primero, caché de respaldo. La versión (?b=N)
  // va en la petición pero no en la clave: la caché guarda un solo motor.js.
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    try{
      const r = await fetch(req);
      // se guarda sin la parte de la interrogación: un solo motor.js, no uno
      // por cada ?b= o ?cb= con el que se haya pedido
      if(r.ok) c.put(url.origin + url.pathname, r.clone());
      return r;
    }catch(e){
      const hit = await c.match(req, {ignoreSearch: true});
      if(hit) return hit;
      // la raíz sin red: la pantalla de escritorio, que decide sola si ir al teléfono
      if(url.pathname.endsWith('/')) { const idx = await c.match('index.html'); if(idx) return idx; }
      return new Response('Sin conexión y sin copia guardada.', {status: 504, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
  })());
});

/* Inspector local: usa la página y el servidor reales sin incluir herramientas en la exportación. */
import http from 'node:http';
import fs from 'node:fs';
import {crearServidor} from './servidor.mjs';
import {pagina,csp} from './arpg-three-exportar.mjs';
const base=crearServidor();
const servidor=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  const nombre=u.pathname.split('/').pop();
  if(u.pathname==='/dev/secciones/arpg-inspector.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp,'Cache-Control':'no-store'});
    return res.end(pagina('./generado/arpg-three').replace('</head>','<link rel="stylesheet" href="./arpg-inspector.css"><script type="module" src="./arpg-inspector.js"></script></head>'));
  }
  if(['/dev/secciones/arpg-inspector.js','/dev/secciones/arpg-inspector.css','/dev/secciones/arpg-inspector-metricas.mjs'].includes(u.pathname)){
    res.writeHead(200,{'Content-Type':!nombre.endsWith('.css')?'text/javascript':'text/css','Cache-Control':'no-store','Content-Security-Policy':csp});return res.end(fs.readFileSync(new URL(nombre,import.meta.url)));
  }
  base.emit('request',req,res);
});
const puerto=Number(process.argv[2]||8883);
servidor.listen(puerto,'127.0.0.1',()=>console.log(`Inspector: http://127.0.0.1:${puerto}/dev/secciones/arpg-inspector.html?inspector=1`));

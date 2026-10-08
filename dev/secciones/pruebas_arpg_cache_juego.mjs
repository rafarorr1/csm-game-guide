/* Arranque completo frío/caliente del paquete real, con la caché publicada. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {exportar,csp} from './arpg-three-exportar.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const salida=path.resolve(process.env.ARPG_CACHE_SALIDA||fileURLToPath(new URL('../../../../outputs/precarga-cache/',import.meta.url)));fs.mkdirSync(salida,{recursive:true});
let temporal,servidor,navegador,base=process.env.ARPG_CACHE_URL;
const solicitudes=[];
try{
  if(!base){
    temporal=fs.mkdtempSync(path.join(os.tmpdir(),'arpg-cache-juego-'));const destino=path.join(temporal,'arpg-three');exportar(destino);
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
    servidor=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),f=path.resolve(temporal,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));solicitudes.push(u.pathname);
      if(!f.startsWith(destino+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache','Content-Security-Policy':csp});fs.createReadStream(f).pipe(res);
    });await new Promise(ok=>servidor.listen(0,'127.0.0.1',ok));base='http://127.0.0.1:'+servidor.address().port+'/arpg-three/';
  }
  navegador=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
  const ctx=await navegador.newContext({viewport:{width:1280,height:720}}),p=await ctx.newPage(),errores=[];p.setDefaultTimeout(120000);
  p.on('pageerror',e=>errores.push(e.message));p.on('console',m=>{if(m.type()==='error')errores.push(m.text());});p.on('response',r=>{if(r.status()>=400)errores.push(r.status()+' '+r.url());});
  const medidas=[];
  for(const vuelta of ['primera','segunda']){
    solicitudes.length=0;const inicio=Date.now();await p.goto(base+'?captura=1&heroe=adreida&piso=scenario&calidad=1',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.CAOZ_ARPG_CARGA?.estado().completa||window.CAOZ_ARPG_CARGA?.estado().fallida);
    const estado=await p.evaluate(()=>({copia:window.CAOZ_ARPG_CACHE.estado(),carga:window.CAOZ_ARPG_CARGA.estado(),lista:window.CAOZ_ARPG_THREE_REVISION?.listo(),preparacion:window.CAOZ_ARPG_THREE_REVISION?.preparacion()}));
    assert(estado.lista&&!estado.carga.fallida,await p.locator('#cargaTexto').textContent());assert.equal(estado.copia.modo,'lista');
    assert.equal(estado.copia.bytes,estado.copia.totalBytes);assert.equal(estado.preparacion.variantes.length,15);
    if(vuelta==='primera')assert(estado.copia.descargados>100);else{assert.equal(estado.copia.descargados,0);assert.equal(estado.copia.reutilizados,estado.copia.total);
      if(servidor){const recursos=new Set(JSON.parse(fs.readFileSync(path.join(temporal,'arpg-three/arpg-recursos.json'))).recursos.map(r=>'/arpg-three/'+r.url));recursos.delete('/arpg-three/arpg-three-cache-sw.js');assert.deepEqual(solicitudes.filter(x=>recursos.has(x)),[],'La visita caliente no descarga assets, sólo comprueba HTML, manifiesto y SW');}
    }
    medidas.push({visita:vuelta,ms:Date.now()-inicio,...estado});await p.screenshot({path:path.join(salida,vuelta+'.png')});
  }
  await ctx.setOffline(true);
  const textura=await p.evaluate(async()=>{const r=await fetch('./goblin-scenario/color.webp');return {ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};});assert(textura.ok&&textura.bytes>1000);
  await ctx.setOffline(false);assert.deepEqual(errores,[]);
  fs.writeFileSync(path.join(salida,'resultado.json'),JSON.stringify({base,medidas,texturaSinRed:textura,errores},null,2));console.log(JSON.stringify({base,medidas:medidas.map(m=>({visita:m.visita,ms:m.ms,...m.copia})),errores},null,2));
  await ctx.close();
}finally{await navegador?.close();if(servidor)await new Promise(ok=>servidor.close(ok));if(temporal)fs.rmSync(temporal,{recursive:true,force:true});}

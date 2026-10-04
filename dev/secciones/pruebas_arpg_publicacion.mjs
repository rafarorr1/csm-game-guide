/* Verifica la Alpha exportada: recursos completos, CSP y rutas jugables reales.
   Las reglas de combate se cubren con las pruebas focalizadas del publicador. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {exportar,entornoArpgThree,componentesArpgThree,csp,versionArpgThree} from './arpg-three-exportar.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-alpha-'));
const destino=path.join(temporal,'arpg-three');let navegador,servidor;
try{
  const p=exportar(destino),html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.equal(p.version,versionArpgThree);
  assert(html.includes('<title>Caoz ARPG · '+versionArpgThree+'</title>'));
  assert(html.includes(csp)&&!/__CSP__|__GENERADO__|__VERSION_ARPG__/.test(html));
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'Sin scripts en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert(fs.existsSync(path.join(destino,m[1])),'Recurso de página: '+m[1]);
  const hashes={...p.entorno,...p.derivados,...Object.fromEntries(Object.entries(p.componentes).map(([k,v])=>['juego/'+k,v])),...Object.fromEntries(Object.entries(p.arte).map(([k,v])=>['art/'+k,v]))};
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile());
  assert.deepEqual(archivos.sort(),[...Object.keys(hashes),'procedencia.json','_headers'].sort(),'El paquete sólo contiene recursos de juego');
  for(const [f,h]of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(destino,f))).digest('hex'),h,f+': integridad');
  for(const f of [...entornoArpgThree,...componentesArpgThree.map(f=>'juego/'+f)])assert(hashes[f],f+': incluido');
  assert.throws(()=>exportar(destino),/vacío/);
  console.log(`✓ ${versionArpgThree}: ${archivos.length} archivos íntegros, modelos, texturas, fuentes, cinemáticas y CSP local.`);

  const tipos={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
  servidor=http.createServer((req,res)=>{
    const ruta=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const archivo=path.resolve(temporal,'.'+ruta+(ruta.endsWith('/')?'index.html':''));
    if(!archivo.startsWith(destino+path.sep)||!fs.existsSync(archivo)||!fs.statSync(archivo).isFile()){res.writeHead(404);res.end('No encontrado');return;}
    res.writeHead(200,{'Content-Type':tipos[path.extname(archivo)]||'application/octet-stream','Content-Security-Policy':csp,'Cache-Control':'no-store'});fs.createReadStream(archivo).pipe(res);
  });
  await new Promise(ok=>servidor.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+servidor.address().port+'/arpg-three/';
  const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
  navegador=await chromium.launch({headless:true});
  const casos=[
    {nombre:'Etapa 1 · Adreida',query:'heroe=adreida',tipo:'adreida',nivel:1},
    {nombre:'Etapa 2 · cooperativo',query:'etapa=2&coop=1&mandos=1',tipo:'adreida',nivel:2,equipo:2},
    {nombre:'Entrada del Troll',query:'etapa=2&entrada=troll',tipo:'adreida',entrada:true},
    {nombre:'Casa goblin',query:'etapa=2&entrada=casa',tipo:'adreida',casa:true},
    {nombre:'Final del mago',query:'etapa=2&entrada=mago',tipo:'adreida',mago:true},
    {nombre:'Mundo abierto · Mohamed',query:'mundo=abierto&heroe=mohamed',tipo:'mohamed',mundo:true},
    {nombre:'Táctil · Adreida',query:'heroe=adreida',tipo:'adreida',movil:true},
  ];
  for(const caso of casos){
    const contexto=await navegador.newContext({viewport:caso.movil?{width:390,height:780}:{width:960,height:540},deviceScaleFactor:1,...(caso.movil?{hasTouch:true,isMobile:true}:{})});
    const pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    pagina.on('response',r=>{if(r.status()>=400)errores.push(r.status()+' '+r.url());});
    pagina.on('requestfailed',r=>errores.push(r.url()+': '+r.failure()?.errorText));
    pagina.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(new URL(base).origin+'/'))errores.push('Dependencia externa: '+r.url());});
    await pagina.goto(base+'?captura=1&'+caso.query,{waitUntil:'load',timeout:120000});
    await pagina.waitForFunction(()=>window.CAOZ_ARPG_THREE_REVISION?.listo(),null,{timeout:120000});
    await pagina.evaluate(()=>document.fonts.ready);
    const e=await pagina.evaluate(async nivel=>{
      const r=window.CAOZ_ARPG_THREE_REVISION;if(nivel)r.oleadas(true);await r.avanzar(nivel?2.1:.15);
      return {estado:r.estado(),equipo:r.equipo(),entrada:r.entradaTroll(),casa:r.casaGoblin(),mago:r.finalMago(),mapa:r.exploracion(),dibujo:r.dibujar()};
    },caso.nivel);
    assert.equal(await pagina.title(),'Caoz ARPG · '+versionArpgThree);
    assert(e.estado.listo&&e.estado.webgl2&&e.estado.heroe.vivo,caso.nombre+': partida lista');
    assert.equal(e.estado.heroe.tipo,caso.tipo);
    assert.equal(e.equipo.length,caso.equipo||1);
    if(caso.nivel)assert.equal(e.estado.destino.nivel,caso.nivel);
    if(caso.tipo==='adreida')assert.equal(e.estado.mallasHeroe,2,'Cuerpo modular y hacha de Scenario');
    if(caso.entrada)assert(e.entrada,'La entrada del Troll está preparada');
    if(caso.casa)assert(e.casa&&e.estado.heroe.llaves>0,'Llave y casa disponibles tras vencer al Troll');
    if(caso.mago)assert.equal(e.mago?.fase,'salida','El epílogo comienza saliendo de la casa');
    if(caso.mundo)assert(e.mapa.descubiertas>0&&e.mapa.campamentos.length===3,'Mundo y mapa explorables');
    if(caso.movil)assert(await pagina.locator('#palanca').isVisible(),'Palanca táctil visible');
    assert(e.dibujo.llamadas>0&&e.dibujo.triangulos>1000,'La escena se dibuja');
    if(caso.casa){
      await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(6));
      await pagina.locator('#abrirCasa').click();
      await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(8));
      const interior=await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.casaGoblin());
      assert(interior.interior&&interior.vivos===2&&interior.decorado.retratos===2,'Interior, familia y retratos completos');
    }
    if(caso.nombre==='Etapa 1 · Adreida'){
      await pagina.locator('#abrirPausa').click();assert(await pagina.locator('#pausa').isVisible());
      assert((await pagina.locator('.apSelloMenu').textContent()).includes(versionArpgThree));
      await pagina.locator('#continuar').click();assert(!(await pagina.locator('#pausa').isVisible()));
      await pagina.evaluate(()=>{const r=window.CAOZ_ARPG_THREE_REVISION;r.oleadas(false);r.heroe({x:0,z:6});});
      await pagina.keyboard.down('KeyD');const movido=await pagina.evaluate(()=>window.CAOZ_ARPG_THREE_REVISION.avanzar(.5));await pagina.keyboard.up('KeyD');
      assert(movido.heroe.x>1,'WASD mueve al personaje en el paquete público');
    }
    assert.deepEqual(errores,[],caso.nombre+': sin errores ni recursos ausentes');
    await contexto.close();console.log('✓ Paquete en navegador: '+caso.nombre);
  }
}finally{
  await navegador?.close();if(servidor)await new Promise(ok=>servidor.close(ok));fs.rmSync(temporal,{recursive:true,force:true});
}

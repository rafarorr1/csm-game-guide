/* Pruebas de La cosecha en 3D (pitagoras-cosecha-3d.js) en su sección aislada:
   el paquete sólo lleva sus dependencias; el pintor 3D se activa con WebGL,
   carga el arte dorado y dibuja la arena (no un lienzo negro); no toca el
   modelo (la misma semilla da el mismo estado con el pintor 3D y el clásico);
   el puntero se traduce al suelo en el sitio correcto; con movimiento
   reducido o sin el pintor 3D sigue el anterior; y la prueba real se abre con
   él. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesCosecha3d,recursosCosecha3d} from './cosecha-3d-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=['pitagoras-mundo-3d.js','pitagoras-cosecha-3d.js'].map(f=>fs.readFileSync(path.join(juego,f),'utf8')).join('\n');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
assert.ok(!/\b(?:modelo|m)\.[a-zA-Z]+\s*=[^=]/.test(js),'El pintor no escribe en el modelo');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-cosecha3d-'));
try{
  const destino=path.join(temporal,'cosecha-3d'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','cosecha-3d-mesa.js','cosecha-3d-mesa.css','generado/datos.js',...componentesCosecha3d.map(f=>'juego/'+f),...recursosCosecha3d.map(r=>'juego/'+r)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(html.indexOf('pitagoras-pixel.js')<html.indexOf('pitagoras-mundo-3d.js')&&html.indexOf('pitagoras-mundo-3d.js')<html.indexOf('pitagoras-cosecha-3d.js'),'El motor 3D se carga después del pintor clásico y antes de La cosecha');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/cosecha-3d.html';
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  for(const [ancho,alto]of [[1280,800],[390,700]]){
    const pagina=await navegador.newPage({viewport:{width:ancho,height:alto}}),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=ancho+'×'+alto;
    await pagina.goto(base+'?captura=1');await pagina.waitForFunction(()=>window.CAOZ_COSECHA3D_REVISION,null,{timeout:60000});
    await pagina.evaluate(()=>CAOZ_COSECHA3D_REVISION.irA(.1));
    await pagina.waitForFunction(()=>CAOZ_COSECHA3D_REVISION.estado().arte,null,{timeout:30000});
    const e3=await pagina.evaluate(()=>CAOZ_COSECHA3D_REVISION.irA(12,20));
    assert.equal(e3.activo3d,true,caso+': el pintor 3D está activo');
    // La imagen: la arena tiene luz y color (no negro) y el telón dorado asoma arriba.
    const px=await pagina.evaluate(()=>{const c=document.getElementById('lienzo'),g=document.createElement('canvas');g.width=64;g.height=40;const x=g.getContext('2d');x.drawImage(c,0,0,64,40);const d=x.getImageData(0,0,64,40).data;
      let luz=0,verde=0;for(let i=0;i<d.length;i+=4){luz+=(d[i]+d[i+1]+d[i+2])/3;if(d[i+1]>d[i]&&d[i+1]>d[i+2]*.95)verde++;}return {luz:luz/(d.length/4),verde:verde/(d.length/4)};});
    assert.ok(px.luz>35,caso+': la arena se ve (luz media '+px.luz.toFixed(1)+')');
    assert.ok(px.verde>.2,caso+': las losas verdes del arte dorado ('+(px.verde*100).toFixed(0)+'%)');
    // El puntero: del suelo a la pantalla y de vuelta al mismo punto.
    const ida=await pagina.evaluate(()=>{const out=[];for(const [x,y] of [[0,0],[3,-2],[-4.5,4],[5,5]]){const s=CAOZ_COSECHA_3D.pantallaDesdeSuelo(x,y),g=CAOZ_COSECHA3D_REVISION.proyectar(s.x,s.y);out.push([x,y,g.x,g.y]);}return out;});
    for(const [x,y,gx,gy]of ida)assert.ok(Math.hypot(gx-x,gy-y)<.01,caso+': el puntero cae en el suelo donde apunta ('+x+','+y+' → '+gx.toFixed(3)+','+gy.toFixed(3)+')');
    // El pintor no toca el modelo: la misma semilla con el pintor clásico da el mismo estado.
    const clasico=await pagina.evaluate(()=>{window.CAOZ_COSECHA_3D_APAGADA=true;const e=CAOZ_COSECHA3D_REVISION.irA(12,20);window.CAOZ_COSECHA_3D_APAGADA=false;return e;});
    assert.deepEqual({...clasico,activo3d:true,arte:true},e3,caso+': el modelo evoluciona igual con los dos pintores');
    assert.deepEqual(errores,[],caso+': sin errores de página');
    console.log('✓ '+caso+': arena 3D con el arte dorado, puntero preciso y el modelo intacto');
    await pagina.close();
  }
  // La prueba real se abre con el pintor 3D; con movimiento reducido, el clásico.
  for(const reducido of [false,true]){
    const contexto=await navegador.newContext({viewport:{width:1280,height:800},reducedMotion:reducido?'reduce':'no-preference'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.goto(base);await pagina.waitForFunction(()=>window.CAOZ_COSECHA3D_REVISION,null,{timeout:60000});
    await pagina.click('#jugar');await pagina.waitForSelector('.pitPrueba .ppPanel .ppBoton',{timeout:20000});await pagina.click('.pitPrueba .ppPanel .ppBoton');
    await pagina.waitForFunction(()=>PITAGORAS_PRUEBAS.estado?.fase==='jugando',null,{timeout:20000});await pagina.waitForTimeout(600);
    const activo=await pagina.evaluate(()=>CAOZ_COSECHA_3D.activo);
    assert.equal(activo,!reducido,reducido?'Con movimiento reducido sigue el pintor clásico':'La prueba real usa el pintor 3D');
    if(!reducido){
      // A resolución completa: ni el filtro de pixel art ni el lienzo «pixelated».
      const r=await pagina.evaluate(()=>{const c=document.querySelector('.pitPrueba canvas.ppLienzo')||document.querySelector('.pitPrueba canvas');return {ancho:CAOZ_COSECHA_3D.anchoPintado,lienzo:c.width,css:c.getBoundingClientRect().width,render:getComputedStyle(c).imageRendering};});
      assert.ok(r.ancho>=r.css*.95,'La prueba real pinta La cosecha a resolución completa ('+r.ancho+' px para '+Math.round(r.css)+' px de lienzo)');
      assert.notEqual(r.render,'pixelated','El lienzo de La cosecha 3D no se amplía como pixel art');
    }
    await pagina.evaluate(()=>PITAGORAS_PRUEBAS.cancelar());
    assert.deepEqual(errores,[],'Sin errores al jugar');
    await contexto.close();
  }
  console.log('✓ La prueba real se abre con el pintor 3D; con movimiento reducido, el clásico');
}finally{await navegador?.close();servidor.close();}

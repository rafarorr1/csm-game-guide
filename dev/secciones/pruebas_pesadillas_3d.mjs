/* Pruebas de las pruebas de Pitágoras en 3D (pitagoras-mundo-3d.js y un módulo
   por prueba) en su sección aislada. Para cada prueba: el pintor 3D se activa
   con WebGL, carga el arte dorado y dibuja su mundo (no un lienzo negro, con su
   color); no toca el modelo (la misma semilla da el mismo estado con el pintor
   3D y el clásico); el puntero se traduce al suelo en el sitio correcto; la
   cámara nunca deja al héroe fuera de la pantalla, ni en las esquinas; la
   prueba real se abre con él, a resolución completa; y con movimiento
   reducido sigue el pintor anterior. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesPesadillas3d,recursosPesadillas3d,pruebasPesadillas3d} from './pesadillas-3d-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const modulos=componentesPesadillas3d.filter(f=>/-3d\.js$/.test(f));
const js=modulos.map(f=>fs.readFileSync(path.join(juego,f),'utf8')).join('\n');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
assert.ok(!/\b(?:modelo|m)\.[a-zA-Z]+\s*=[^=]/.test(js),'Los pintores no escriben en el modelo');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-pesadillas3d-'));
try{
  const destino=path.join(temporal,'pesadillas-3d'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','pesadillas-3d-mesa.js','pesadillas-3d-mesa.css','generado/datos.js',...componentesPesadillas3d.map(f=>'juego/'+f),...recursosPesadillas3d.map(r=>'juego/'+r)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  const orden=['pitagoras-pixel.js','pitagoras-mundo-3d.js',...modulos.filter(f=>f!=='pitagoras-mundo-3d.js')].map(f=>html.indexOf(f));
  assert.ok(orden.every((x,i)=>x>0&&(i===0||x>orden[i-1])),'El motor 3D se carga después del pintor clásico y antes de cada prueba');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

// El color que distingue cada mundo: losas verdes en La cosecha, lapislázuli en El corte final.
const COLOR={isometrico:['losas verdes',d=>d[1]>d[0]&&d[1]>d[2]*.95,.12],laseres:['lapislázuli',d=>d[2]>d[0]*1.25&&d[2]>d[1]*1.15,.2],fps:['lapislázuli y verde del archivo',d=>d[2]>d[0]*1.2||(d[1]>d[0]*1.1&&d[1]>=d[2]),.2],carrera:['cielo de lapislázuli y carriles de color',d=>d[2]>d[0]*1.2||d[0]>d[2]*1.6,.2]};
// Puntos del suelo para el puntero, delante de la cámara de cada prueba.
const PUNTOS={carrera:[[0,0],[1,-5],[-1,-12],[.5,-3]]};
// En primera persona la cámara es el jugador: no hay encuadre del héroe ni puntero sobre el suelo.
const PRIMERA_PERSONA=new Set(['fps']);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/pesadillas-3d.html';
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  for(const tipo of Object.keys(pruebasPesadillas3d))for(const [ancho,alto]of [[1280,800],[390,700],[844,390]]){
    const pagina=await navegador.newPage({viewport:{width:ancho,height:alto}}),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=tipo+' '+ancho+'×'+alto;
    await pagina.goto(base+'?captura=1&prueba='+tipo);await pagina.waitForFunction(()=>window.CAOZ_PESADILLAS3D_REVISION,null,{timeout:60000});
    await pagina.evaluate(()=>CAOZ_PESADILLAS3D_REVISION.irA(.1));
    await pagina.waitForFunction(()=>CAOZ_PESADILLAS3D_REVISION.estado().arte,null,{timeout:30000});
    const e3=await pagina.evaluate(()=>CAOZ_PESADILLAS3D_REVISION.irA(9,20));
    assert.equal(e3.activo3d,true,caso+': el pintor 3D está activo');
    // La imagen: el mundo tiene luz y el color de su carta (no negro).
    const [nombre,esColor,minimo]=COLOR[tipo];
    const px=await pagina.evaluate(fn=>{const c=document.getElementById('lienzo'),g=document.createElement('canvas');g.width=64;g.height=40;const x=g.getContext('2d');x.drawImage(c,0,0,64,40);const d=x.getImageData(0,0,64,40).data,f=new Function('return '+fn)();
      let luz=0,color=0;for(let i=0;i<d.length;i+=4){luz+=(d[i]+d[i+1]+d[i+2])/3;if(f([d[i],d[i+1],d[i+2]]))color++;}return {luz:luz/(d.length/4),color:color/(d.length/4)};},esColor.toString());
    assert.ok(px.luz>25,caso+': el mundo se ve (luz media '+px.luz.toFixed(1)+')');
    assert.ok(px.color>minimo,caso+': '+nombre+' de la carta dorada ('+(px.color*100).toFixed(0)+'%)');
    if(!PRIMERA_PERSONA.has(tipo)){
    // El puntero: del suelo a la pantalla y de vuelta al mismo punto.
    const ida=await pagina.evaluate(P=>{const R=CAOZ_PESADILLAS3D_REVISION,out=[];for(const [x,y] of P){const s=R.pantalla(x,y),g=R.proyectar(s.x,s.y);out.push([x,y,g.x,g.y]);}return out;},PUNTOS[tipo]||[[0,0],[3,-2],[-4.5,4],[5,5]]);
    for(const [x,y,gx,gy]of ida)assert.ok(Math.hypot(gx-x,gy-y)<.01,caso+': el puntero cae en el suelo donde apunta ('+x+','+y+' → '+gx.toFixed(3)+','+gy.toFixed(3)+')');
    }else{
      // Lo que está justo delante del jugador (a donde dispara) se ve en el centro de la retícula.
      for(const d of [2,4,7]){const r=await pagina.evaluate(d=>CAOZ_PESADILLAS3D_REVISION.delante(d),d);
        assert.ok(Math.abs(r.punto.x-r.ancho/2)<1.5,caso+': a '+d+' unidades delante, el disparo cae en el centro ('+r.punto.x.toFixed(1)+' de '+r.ancho+' px)');}
    }
    // El pintor no toca el modelo: la misma semilla con el pintor clásico da el mismo estado.
    const clasico=await pagina.evaluate(()=>{document.querySelector('[data-pintor="clasico"]').click();const e=CAOZ_PESADILLAS3D_REVISION.irA(9,20);document.querySelector('[data-pintor="3d"]').click();return e;});
    assert.deepEqual({...clasico,activo3d:true,arte:true},e3,caso+': el modelo evoluciona igual con los dos pintores');
    // El encuadre: en las cuatro esquinas de la arena el héroe queda dentro de la pantalla.
    if(tipo==='carrera')for(const c of [-1,0,1]){const r=await pagina.evaluate(c=>CAOZ_PESADILLAS3D_REVISION.carrilHeroe(c),c),fx=r.heroe.x/r.ancho,fy=r.heroe.y/r.alto,ly=r.lejos.y/r.alto;
      assert.ok(fx>.05&&fx<.95&&fy>.3&&fy<.92,caso+': el héroe en el carril '+c+' se ve ('+(fx*100).toFixed(0)+'%, '+(fy*100).toFixed(0)+'%)');
      assert.ok(ly>.08&&ly<fy-.15,caso+': lo que viene a 20 unidades se ve por delante del héroe ('+(ly*100).toFixed(0)+'%)');}
    else if(!PRIMERA_PERSONA.has(tipo))for(const [x,y] of [[-6.55,-6.55],[6.55,-6.55],[-6.55,6.55],[6.55,6.55]]){
      const r=await pagina.evaluate(([x,y])=>CAOZ_PESADILLAS3D_REVISION.mirarHeroe(x,y),[x,y]),fx=r.punto.x/r.ancho,fy=r.punto.y/r.alto;
      assert.ok(fx>.05&&fx<.95&&fy>.08&&fy<.92,caso+': el héroe en ('+x+','+y+') se ve ('+(fx*100).toFixed(0)+'%, '+(fy*100).toFixed(0)+'%)');}
    assert.deepEqual(errores,[],caso+': sin errores de página');
    console.log('✓ '+caso+': mundo 3D con el arte dorado, '+(PRIMERA_PERSONA.has(tipo)?'mira centrada':'puntero preciso, encuadre')+' y el modelo intacto');
    await pagina.close();
  }
  // La prueba real se abre con el pintor 3D a resolución completa; con movimiento reducido, el clásico.
  for(const tipo of Object.keys(pruebasPesadillas3d))for(const reducido of [false,true]){
    const contexto=await navegador.newContext({viewport:{width:1280,height:800},reducedMotion:reducido?'reduce':'no-preference'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.goto(base+'?prueba='+tipo);await pagina.waitForFunction(()=>window.CAOZ_PESADILLAS3D_REVISION,null,{timeout:60000});
    await pagina.click('#jugar');await pagina.waitForSelector('.pitPrueba .ppPanel .ppBoton',{timeout:20000});await pagina.click('.pitPrueba .ppPanel .ppBoton');
    await pagina.waitForFunction(()=>PITAGORAS_PRUEBAS.estado?.fase==='jugando',null,{timeout:20000});await pagina.waitForTimeout(600);
    const r=await pagina.evaluate(()=>{const w=CAOZ_PESADILLAS3D_REVISION.mundo(),c=document.querySelector('.pitPrueba canvas.ppLienzo');return {activo:w.activo,ancho:w.ancho,css:c.getBoundingClientRect().width,render:getComputedStyle(c).imageRendering};});
    assert.equal(r.activo,!reducido,tipo+(reducido?': con movimiento reducido sigue el pintor clásico':': la prueba real usa el pintor 3D'));
    if(!reducido){assert.ok(r.ancho>=r.css*.95,tipo+': la prueba real se pinta a resolución completa ('+r.ancho+' px para '+Math.round(r.css)+' px de lienzo)');assert.notEqual(r.render,'pixelated',tipo+': el lienzo no se amplía como pixel art');}
    await pagina.evaluate(()=>PITAGORAS_PRUEBAS.cancelar());
    assert.deepEqual(errores,[],tipo+': sin errores al jugar');
    await contexto.close();
  }
  console.log('✓ Las pruebas reales se abren con el pintor 3D a resolución completa; con movimiento reducido, el clásico');
}finally{await navegador?.close();servidor.close();}

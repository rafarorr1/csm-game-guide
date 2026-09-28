/* Pruebas de la prueba de ARPG en three.js (arpg-three.html, «Las Grietas del
   Editor»). La exportación sólo publica sus dependencias y respeta la CSP. En
   el navegador, con ratón y dedos de verdad:
     · modelos 3D con esqueleto (tres mallas con piel por personaje) que se
       animan, y pocas llamadas de dibujo aunque haya diez enemigos;
     · clic para andar, clic para atacar (mantener pulsado sigue pegando);
     · los enemigos avisan antes de golpear (y apartarse lo esquiva); los
       kobolds apuntan con una línea y lanzan;
     · Torbellino, Salto y Provocar hacen lo que dicen, y sin Furia no salen;
     · el botín: la carta se levanta al pasar por encima, se lee entera y al
       recogerla da su bonificación;
     · la partida entera (el piloto automático gana las cuatro oleadas y a Can,
       que suelta la Llave del Mago), la derrota y volver a empezar;
     · táctil (palanca y botones), movimiento reducido y sin WebGL 2.
   Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesArpgThree,cartasArpgThree,entornoArpgThree,csp} from './arpg-three-exportar.mjs';
import {crearServidor} from './servidor.mjs';

const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-arpg-three-'));
try{
  const destino=path.join(temporal,'arpg-three'),p=exportar(destino);
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  const arte=['art/logo.webp','art/lider_adreida.webp',...p.cartas.map(c=>{const [id,ed]=c.split('/');return ed==='normal'?'art/'+id+'.webp':'art/'+id+'-'+ed+'-v1.webp';})];
  const esperados=['index.html','_headers','procedencia.json','generado/datos.js',...entornoArpgThree,...componentesArpgThree.map(f=>'juego/'+f),...arte];
  for(const f of esperados)assert.ok(archivos.includes(f),'Se publica '+f);
  assert.deepEqual(archivos.filter(f=>!esperados.includes(f)),[],'Sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.ok(html.includes(csp)&&!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'La página lleva la CSP y ningún script en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.equal(p.partida,false);assert.equal(p.three,'0.186.1');assert.equal(p.cartas.length,cartasArpgThree.length);assert.throws(()=>exportar(destino),/vacío/);
  const datos=fs.readFileSync(path.join(destino,'generado/datos.js'),'utf8');assert.ok(/"llavemago"/.test(datos)&&/"mazo"/.test(datos),'El botín son Objetos del juego');
  console.log('✓ Exportación: modelos, three.js empaquetado y las cartas del botín, sin CDN ni scripts en línea');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/arpg-three.html';
const R='CAOZ_ARPG_THREE_REVISION';
// Brillo medio de una zona del lienzo alrededor de un punto de pantalla (píxeles CSS).
const zona=(pagina,x,y,r)=>pagina.evaluate(([x,y,r])=>{const c=document.getElementById('lienzo'),k=c.width/c.clientWidth,g=document.createElement('canvas');g.width=g.height=32;const q=g.getContext('2d');
  q.drawImage(c,(x-r)*k,(y-r)*k,2*r*k,2*r*k,0,0,32,32);return Array.from(q.getImageData(0,0,32,32).data);},[x,y,r]);
const diferencia=(a,b)=>{let s=0;for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return s/(a.length/4)/3;};
async function abrir(navegador,{ancho=1280,alto=800,captura=true,tactil=false,reducido=false,sinWebgl=false}={}){
  const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},...(tactil?{hasTouch:true,isMobile:true}:{}),reducedMotion:reducido?'reduce':'no-preference'}),pagina=await contexto.newPage(),errores=[];
  pagina.on('pageerror',e=>errores.push(e.message));// Los avisos del controlador gráfico (WebGL por software sin pantalla) no son de la página.
  pagina.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/GL Driver Message|swiftshader|GroupMarkerNotSet/i.test(m.text()))errores.push(m.text());});
  if(sinWebgl)await pagina.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:g.call(this,t,...a);};});
  await pagina.goto(base+(captura?'?captura=1':''));
  if(!sinWebgl)await pagina.waitForFunction(R=>window[R]?.listo(),R,{timeout:120000});
  const r=(f,...a)=>pagina.evaluate(([R,f,a])=>{const r=window[R];return (0,eval)('(r,a)=>'+f)(r,a);},[R,f,a]);
  return {contexto,pagina,errores,r};
}
let navegador;
try{
  navegador=await chromium.launch({headless:true});

  // ---- Modelos, animación y llamadas de dibujo -----------------------------------------
  for(const [ancho,alto] of [[1280,800],[390,780]]){const caso=ancho+'×'+alto,{contexto,pagina,errores,r}=await abrir(navegador,{ancho,alto});
    const e=await r('r.estado()');
    assert.ok(e.webgl2&&e.version==='186'&&e.muestras===4&&e.hdr,caso+': WebGL 2, three r186, HDR con MSAA 4×');
    assert.deepEqual(e.pases,['render','oclusion','resplandor','salida'],caso+': render, oclusión ambiental, resplandor y salida');
    assert.ok(e.mallasHeroe===3&&e.triangulosHeroe>1500,caso+': Adreida es un modelo 3D con esqueleto: 3 mallas con piel, '+e.triangulosHeroe+' triángulos');
    await r('r.oleadas(false)');await r('r.heroe({dir:0})');await r('r.avanzar(.3)');
    const h=await r('r.heroePantalla(1)');assert.ok(h.dentro&&Math.abs(h.x-ancho/2)<ancho*.1,caso+': la cámara sigue a Adreida en el centro');
    const quieta=await zona(pagina,h.x,h.y,40);await r('r.pose("torbellino",0)');await r('r.avanzar(.1)');const girando=await zona(pagina,h.x,h.y,40);await r('r.pose(null)');
    assert.ok(diferencia(quieta,girando)>4,caso+': el modelo se ve y se anima (cambia la pose: '+diferencia(quieta,girando).toFixed(1)+')');
    for(let i=0;i<10;i++)await r('r.invocar(a[0],Math.cos(a[1])*4,Math.sin(a[1])*4+4,true)',['goblin','kobold','saqueador'][i%3],i*.63);
    await r('r.avanzar(.2)');const d=await r('r.dibujar()');
    assert.ok(d.llamadas<220,caso+': con diez enemigos siguen siendo pocas llamadas de dibujo ('+d.llamadas+', '+(d.triangulos/1000).toFixed(0)+' mil triángulos)');
    assert.deepEqual(errores,[],caso+': sin errores');await contexto.close();}
  console.log('✓ Modelos 3D con esqueleto que se animan; plaza y personajes fundidos en pocas llamadas de dibujo');

  // ---- Andar, atacar y los avisos de los enemigos ---------------------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');
    let s=await r('r.pantalla(4,0,0)');await pagina.mouse.click(s.x,s.y);await r('r.avanzar(1.5)');let e=await r('r.estado()');
    assert.ok(Math.hypot(e.heroe.x-4,e.heroe.z)<.3,'Clic en el suelo: Adreida anda hasta allí ('+e.heroe.x+', '+e.heroe.z+')');
    const g=await r('r.invocar("goblin",4,-1.8,true)');await r('r.avanzar(.1)');s=await r('r.enemigoPantalla(a[0])',g);
    await pagina.mouse.move(s.x,s.y);await r('r.avanzar(.1)');e=await r('r.estado()');assert.ok(e.sobre==='enemigo:'+g&&/Goblin de Camino/.test(e.objetivo),'Al pasar por encima se marca el enemigo y su vida arriba ('+e.objetivo+')');
    await pagina.mouse.click(s.x,s.y);await r('r.avanzar(.8)');e=await r('r.estado()');const G=e.enemigos.find(x=>x.id===g);
    assert.ok(G.vida<G.vidaMax&&e.heroe.furia>0,'Clic en un enemigo: un tajo que le quita vida ('+G.vida+'/'+G.vidaMax+') y da Furia ('+e.heroe.furia+')');
    await pagina.mouse.down();await r('r.avanzar(3)');await pagina.mouse.up();e=await r('r.estado()');
    assert.ok(!e.enemigos.some(x=>x.id===g),'Manteniendo pulsado sigue pegando hasta matarlo; muere, se deshace en brasas y desaparece');
    // El goblin avisa (levanta el hacha) antes de pegar; el golpe llega después del aviso.
    await r('r.heroe({x:0,z:0,alma:140})');const a=await r('r.invocar("goblin",0,-1.3,false)');await r('r.despertar(a[0])',a);
    const alma0=(await r('r.estado()')).heroe.alma;let avisoT=null,golpeT=null;for(let t=0;t<3&&golpeT===null;t+=1/30){e=await r('r.avanzar(1/30)');const x=e.enemigos.find(x=>x.id===a);if(x?.estado==='aviso'&&avisoT===null)avisoT=t;if(e.heroe.alma<alma0)golpeT=t;}
    assert.ok(avisoT!==null&&golpeT!==null&&golpeT-avisoT>=.45,'El goblin avisa antes de pegar ('+(golpeT-avisoT).toFixed(2)+' s de aviso)');
    // Apartarse durante el aviso esquiva el golpe.
    await r('r.avanzar(1)');for(let t=0;t<3;t+=1/30){e=await r('r.avanzar(1/30)');if(e.enemigos.find(x=>x.id===a)?.estado==='aviso')break;}
    await r('r.heroe({alma:140})');
    await r('r.ordenar("ir",6,4)');await r('r.avanzar(.8)');e=await r('r.estado()');assert.equal(e.heroe.alma,140,'Apartarse durante el aviso esquiva el golpe');
    // El kobold se queda lejos, apunta (se ve la línea) y lanza.
    await r('r.matar(a[0])',a);await r('r.avanzar(2)');await r('r.heroe({x:0,z:4,alma:140})');const k=await r('r.invocar("kobold",0,-4,false)');await r('r.despertar(a[0])',k);
    let linea=false,lanza=false,herida=false;for(let t=0;t<6&&!herida;t+=1/30){e=await r('r.avanzar(1/30)');linea||=e.marcas.includes('linea');lanza||=e.lanzas>0;herida=e.heroe.alma<140;}
    assert.ok(linea&&lanza&&herida,'El kobold apunta con una línea en el suelo, lanza y la lanza hiere');
    assert.deepEqual(errores,[],'Sin errores al andar y combatir');await contexto.close();}
  console.log('✓ Clic para andar y atacar (mantener sigue pegando); avisos antes de cada golpe, esquivar y lanzas');

  // ---- Habilidades --------------------------------------------------------------------
  {const {contexto,errores,pagina,r}=await abrir(navegador);await r('r.oleadas(false)');
    await r('r.heroe({x:0,z:0,furia:0})');assert.equal(await r('r.usar("torbellino")'),false,'Sin Furia no hay Torbellino');
    assert.ok(/Furia/.test(await pagina.textContent('#tostada')),'…y lo dice');
    const ids=[];for(let i=0;i<3;i++)ids.push(await r('r.invocar("goblin",Math.cos(a[0])*1.8,Math.sin(a[0])*1.8,true)',i*2.1));
    await r('r.heroe({furia:100})');assert.equal(await r('r.usar("torbellino",0,0)'),true);let e=await r('r.avanzar(1.5)');
    assert.ok(ids.every(id=>{const x=e.enemigos.find(x=>x.id===id);return !x||x.vida<x.vidaMax;}),'Torbellino hiere a todos los que la rodean');
    for(const id of ids)await r('r.matar(a[0])',id);await r('r.avanzar(2)');
    const lejos=[];for(let i=0;i<3;i++)lejos.push(await r('r.invocar("goblin",6+a[0]*.8,-.5+a[0]*.6,true)',i));
    await r('r.heroe({x:0,z:0,furia:100})');assert.equal(await r('r.usar("salto",6.5,0)'),true);e=await r('r.avanzar(.35)');const enAire=e.heroe.alto;e=await r('r.avanzar(.5)');
    assert.ok(enAire>1&&Math.hypot(e.heroe.x-6.5,e.heroe.z)<1.2,'Salto: vuela ('+enAire+' m) y cae donde apuntas');
    assert.ok(lejos.every(id=>{const x=e.enemigos.find(x=>x.id===id);return !x||x.vida<x.vidaMax&&['aturdido','muere'].includes(x.estado);}),'…y aturde y hiere al caer ('+e.enemigos.map(x=>x.estado).join(', ')+')');
    assert.ok(e.heroe.cd.salto>3,'…y queda en recarga');
    for(const id of lejos)await r('r.matar(a[0])',id);await r('r.avanzar(2)');
    const rodean=[];for(let i=0;i<3;i++)rodean.push(await r('r.invocar("goblin",Math.cos(a[0])*7,Math.sin(a[0])*7,true)',i*2.1));
    await r('r.heroe({x:0,z:0,furia:0})');assert.equal(await r('r.usar("provocar")'),true);e=await r('r.avanzar(.8)');
    const dist=rodean.map(id=>{const x=e.enemigos.find(x=>x.id===id);return Math.hypot(x.x,x.z);});
    assert.ok(e.heroe.escudo>2&&e.heroe.furia>=30&&dist.every(d=>d<6.5),'Provocar: atrae a los enemigos ('+dist.map(d=>d.toFixed(1)).join(', ')+'), da Furia y reduce el daño');
    assert.deepEqual(errores,[],'Sin errores con las habilidades');await contexto.close();}
  console.log('✓ Torbellino, Salto y Provocar; sin Furia no salen');

  // ---- Botín: cartas físicas que se leen al pasar por encima ------------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');await r('r.heroe({x:0,z:3,dir:0})');
    await r('r.soltar("mazo","dorado",1.5,6)');await r('r.avanzar(.5)');let s=await r('r.botinPantalla(0)');const atq=(await r('r.estado()')).heroe.atq;
    await pagina.mouse.move(s.x,s.y);await r('r.avanzar(.6)');let e=await r('r.estado()');const c=await r('r.rectBotin(0)');
    assert.ok(e.botines[0].mirada>.95&&e.botines[0].escala>3,'Al pasar por encima la carta se levanta y crece ('+e.botines[0].escala+'×)');
    assert.ok(c.izquierda>=0&&c.derecha<=c.ancho&&c.arriba>=0&&c.abajo<=c.alto&&c.abajo-c.arriba>c.alto*.28,'…entera en pantalla y grande para leerla ('+Math.round(c.abajo-c.arriba)+' px de alto)');
    assert.ok(/Mazo de Brock/.test(e.botines[0].nombre)&&/Dorado/.test(e.botines[0].nombre)&&/ATQ/.test(e.botines[0].nombre),'…con su nombre, edición y bonificación ('+e.botines[0].nombre+')');
    await pagina.mouse.click(s.x,s.y);await r('r.avanzar(1.5)');e=await r('r.estado()');
    assert.ok(e.heroe.botin.includes('mazo/dorado')&&e.heroe.atq>atq&&!e.botines.length,'Clic: Adreida va a por ella, la recoge y gana ATQ ('+atq+' → '+e.heroe.atq+')');
    assert.equal(await pagina.locator('#botin figure').count(),1,'La carta recogida aparece en la lista del botín');
    assert.deepEqual(errores,[],'Sin errores con el botín');await contexto.close();}
  console.log('✓ Botín en cartas físicas: se levanta, se lee entera y al recogerla da su bonificación');

  // ---- La partida entera con el piloto automático; la derrota --------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(true)');await r('r.piloto(true)');let e;
    for(let i=0;i<40;i++){e=await r('r.avanzar(5)');if(e.finVisible||!e.heroe.vivo)break;}
    assert.ok(e.heroe.vivo&&e.fin&&e.finVisible&&/Tomsage resiste/.test(e.finTitulo),'El piloto gana las cuatro oleadas y a Can ('+e.heroe.alma+'/'+e.heroe.almaMax+' de Alma)');
    assert.ok(e.heroe.botin.includes('llavemago/dorado')&&e.heroe.llaves===1,'Can suelta la Llave del Mago dorada y se recoge ('+e.heroe.botin.length+' cartas)');
    // Derrota: con poca Alma y un saqueador encima cae; «Volver a empezar» la levanta.
    await r('r.reiniciar()');await r('r.oleadas(false)');await r('r.piloto(false)');await r('r.heroe({x:0,z:0,alma:8})');const x=await r('r.invocar("saqueador",0,-1.6,false)');await r('r.despertar(a[0])',x);
    for(let i=0;i<8;i++){e=await r('r.avanzar(.5)');if(e.finVisible)break;}
    assert.ok(!e.heroe.vivo&&e.finVisible&&/Has caído/.test(e.finTitulo),'Sin Alma, Adreida cae y se ofrece volver a empezar');
    await pagina.click('#reintentar');e=await r('r.avanzar(.2)');
    assert.ok(e.heroe.vivo&&e.heroe.alma===e.heroe.almaMax&&!e.enemigos.length&&!e.finVisible,'«Volver a empezar» deja la plaza como al principio');
    assert.deepEqual(errores,[],'Sin errores en la partida');await contexto.close();}
  console.log('✓ La partida entera: cuatro oleadas, Can y la Llave del Mago; la derrota y volver a empezar');

  // ---- Táctil: palanca, botones y tocar el botín ---------------------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador,{ancho:390,alto:780,tactil:true});await r('r.oleadas(false)');
    let e=await r('r.estado()');assert.ok(e.tactil&&await pagina.isVisible('#palanca'),'En táctil aparece la palanca');
    const p=await pagina.locator('#palanca').boundingBox(),cx=p.x+p.width/2,cy=p.y+p.height/2;
    await pagina.mouse.move(cx,cy);await pagina.mouse.down();await pagina.mouse.move(cx,cy-p.height*.45,{steps:4});await r('r.avanzar(1)');await pagina.mouse.up();e=await r('r.estado()');
    assert.ok(e.heroe.z<2.5&&Math.abs(e.heroe.x)<.6,'La palanca hacia arriba la lleva hacia el fondo de la pantalla ('+e.heroe.x+', '+e.heroe.z+')');
    const g=await r('r.invocar("goblin",a[0],a[1]-1.8,true)',e.heroe.x,e.heroe.z);await pagina.tap('[data-hab="tajo"]');await r('r.avanzar(.8)');e=await r('r.estado()');
    assert.ok(e.enemigos.find(x=>x.id===g).vida<34,'El botón de Tajo ataca al enemigo más cercano');
    await r('r.matar(a[0])',g);await r('r.avanzar(2)');await r('r.soltar("arco","foil",a[0]+1.5,a[1]+1)',e.heroe.x,e.heroe.z);await r('r.avanzar(.5)');const s=await r('r.botinPantalla(0)');
    await pagina.touchscreen.tap(s.x,s.y);await r('r.avanzar(1.5)');e=await r('r.estado()');assert.ok(e.heroe.botin.includes('arco/foil'),'Tocar una carta del suelo la recoge');
    await r('r.heroe({furia:100})');await pagina.tap('[data-hab="torbellino"]');e=await r('r.avanzar(.2)');assert.equal(e.heroe.estado,'torbellino','Los botones lanzan las habilidades');
    assert.deepEqual(errores,[],'Sin errores en táctil');await contexto.close();}
  console.log('✓ Táctil: palanca, botones de habilidad y tocar el botín');

  // ---- Uso real: arranca solo, marcador y movimiento reducido; sin WebGL 2 ---------------
  for(const reducido of [false,true]){const {contexto,pagina,errores}=await abrir(navegador,{captura:false,reducido});
    await pagina.waitForFunction(()=>/fps/.test(document.getElementById('info').textContent),null,{timeout:60000});
    await pagina.waitForFunction(()=>/Oleada 1/.test(document.getElementById('oleada').textContent),null,{timeout:60000});
    const info=await pagina.textContent('#info');assert.ok(/llamadas/.test(info)&&/three 186/.test(info)&&!/sin posproceso/.test(info),'El marcador muestra fps, llamadas y versión ('+info+')');
    if(reducido){const t=await pagina.evaluate(R=>{window[R].heroe({furia:100});window[R].usar('salto',3,0);return new Promise(ok=>setTimeout(()=>ok(window[R].estado().temblor),1200));},R);assert.equal(t,0,'Con movimiento reducido la cámara no tiembla');}
    assert.deepEqual(errores,[],'Sin errores al usarla');await contexto.close();}
  {const {contexto,pagina,errores}=await abrir(navegador,{captura:false,sinWebgl:true});
    await pagina.waitForFunction(()=>/WebGL 2/.test(document.getElementById('estado').textContent),null,{timeout:30000});
    assert.deepEqual(errores,[],'Sin WebGL 2 no hay errores sueltos: sólo el aviso');await contexto.close();}
  console.log('✓ Uso real: arranca la primera oleada, marcador, movimiento reducido y aviso sin WebGL 2');
}finally{await navegador?.close();servidor.close();}

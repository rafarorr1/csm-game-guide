/* Pruebas de la prueba de ARPG en three.js (arpg-three.html, «Las Grietas del
   Editor»). La exportación sólo publica sus dependencias y respeta la CSP. En
   el navegador, con ratón y dedos de verdad:
     · modelos 3D con esqueleto (tres mallas con piel por personaje) que se
       animan, y pocas llamadas de dibujo aunque haya diez enemigos;
     · control a lo Hades: WASD mueve, el clic ataca hacia el cursor y
       mantenerlo encadena el combo de tres golpes;
     · quién ataca y cuándo: cada ataque dibuja su zona exacta en el suelo,
       el atacante lleva un «!» y un contorno rojo, se fija antes del golpe
       (salir de la zona o esquivar lo evita), el golpe recibido marca de dónde
       vino y los atacantes de fuera de la pantalla tienen su flecha; como
       mucho dos atacan cuerpo a cuerpo a la vez;
     · Q Torbellino y clic derecho Salto requieren Furia; E lanza el hacha búmeran;
     · el botín: la carta se levanta con el ratón encima (o al tocarla), se lee
       entera y se recoge pisándola;
     · la partida entera (el piloto automático gana las cuatro oleadas y a Can,
       que suelta la Llave del Mago), la derrota y volver a empezar;
     · táctil (palanca, Atacar con puntería automática y Esquiva), movimiento
       reducido y sin WebGL 2.
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
  const arte=['art/logo.webp','art/lider_adreida.webp','art/lider_mohamed.webp',...p.cartas.map(c=>{const [id,ed]=c.split('/');return ed==='normal'?'art/'+id+'.webp':'art/'+id+'-'+ed+'-v1.webp';})];
  const esperados=['index.html','_headers','procedencia.json','generado/datos.js',...entornoArpgThree,...componentesArpgThree.map(f=>'juego/'+f),...arte];
  for(const f of esperados)assert.ok(archivos.includes(f),'Se publica '+f);
  assert.deepEqual(archivos.filter(f=>!esperados.includes(f)),[],'Sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  assert.ok(html.includes(csp)&&!/<script(?![^>]*\bsrc=)[^>]*>/.test(html),'La página lleva la CSP y ningún script en línea');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.equal(p.partida,false);assert.equal(p.three,'0.186.1');assert.equal(p.cartas.length,cartasArpgThree.length);assert.throws(()=>exportar(destino),/vacío/);
  const datos=fs.readFileSync(path.join(destino,'generado/datos.js'),'utf8');assert.ok(/"llavemago"/.test(datos)&&/"mazo"/.test(datos),'El botín son Objetos del juego');
  // En Metal (Mac), smoothstep con los bordes al revés o atan(0,0) pueden dar NaN, y el resplandor los agranda en cuadros negros.
  for(const f of ['arpg-three-tiempo.js','arpg-three-mesa.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js','three-carta.js']){const src=fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),f),'utf8');
    for(const m of src.matchAll(/smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g))assert.ok(+m[1]<+m[2],f+': smoothstep con los bordes al revés ('+m[0]+'): en Metal no está definido');
    assert.ok(!/abs\(atan\(p\.x,-p\.y\)\)/.test(src.replace(/r<\.001\?0\.:abs\(atan\(p\.x,-p\.y\)\)/g,'')),f+': atan(0,0) sin proteger en el centro del cono');}
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
    assert.deepEqual(e.pases,['render','oclusion','saneado','resplandor','salida'],caso+': render, oclusión ambiental, saneado (sin NaN), resplandor y salida');
    assert.ok(e.mallasHeroe===3&&e.triangulosHeroe>1500,caso+': Adreida es un modelo 3D con esqueleto: 3 mallas con piel, '+e.triangulosHeroe+' triángulos');
    await r('r.oleadas(false)');await r('r.heroe({dir:0})');await r('r.avanzar(.3)');
    const h=await r('r.heroePantalla(1)');assert.ok(h.dentro&&Math.abs(h.x-ancho/2)<ancho*.1,caso+': la cámara sigue a Adreida en el centro');
    const quieta=await zona(pagina,h.x,h.y,40);await r('r.pose("torbellino",0)');await r('r.avanzar(.1)');const girando=await zona(pagina,h.x,h.y,40);await r('r.pose(null)');
    assert.ok(diferencia(quieta,girando)>4,caso+': el modelo se ve y se anima (cambia la pose: '+diferencia(quieta,girando).toFixed(1)+')');
    // Un píxel NaN (como los que da Metal en Mac) no ennegrece la pantalla gracias al saneado; sin él, el resplandor la tapa entera.
    await r('r.nan(true,2,-1)');await r('r.avanzar(.1)');const conSaneado=await zona(pagina,ancho*.25,alto*.3,30);await r('r.saneado(false)');await r('r.avanzar(.1)');const sinSaneado=await zona(pagina,ancho*.25,alto*.3,30);await r('r.saneado(true)');await r('r.nan(false)');
    const luz=px=>{let t=0;for(let i=0;i<px.length;i+=4)t+=px[i]+px[i+1]+px[i+2];return t/(px.length/4)/3;};
    assert.ok(luz(conSaneado)>8&&luz(sinSaneado)<luz(conSaneado)*.3,caso+': con un píxel NaN la escena se sigue viendo ('+luz(conSaneado).toFixed(0)+'; sin saneado '+luz(sinSaneado).toFixed(0)+')');
    for(let i=0;i<10;i++)await r('r.invocar(a[0],Math.cos(a[1])*4,Math.sin(a[1])*4+4,true)',['goblin','kobold','saqueador'][i%3],i*.63);
    await r('r.avanzar(.2)');const d=await r('r.dibujar()');
    assert.ok(d.llamadas<220,caso+': con diez enemigos siguen siendo pocas llamadas de dibujo ('+d.llamadas+', '+(d.triangulos/1000).toFixed(0)+' mil triángulos)');
    assert.deepEqual(errores,[],caso+': sin errores');await contexto.close();}
  console.log('✓ Modelos 3D con esqueleto que se animan; plaza y personajes fundidos en pocas llamadas de dibujo');

  // ---- Control a lo Hades: WASD, atacar hacia el cursor, combo ----------------------------
  // Espera paso a paso hasta que se cumpla una condición sobre el estado (máximo s segundos).
  const hasta=async(r,cond,s=4)=>{let e;for(let t=0;t<s;t+=1/30){e=await r('r.avanzar(1/30)');if(cond(e))return e;}return e;};
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');await r('r.heroe({x:0,z:0})');
    const s0=await r('r.heroePantalla(1)');await pagina.mouse.move(s0.x,s0.y);
    await pagina.keyboard.down('KeyD');let e=await r('r.avanzar(1)');await pagina.keyboard.up('KeyD');
    assert.ok(e.heroe.x>4.5&&Math.abs(e.heroe.z)<.3,'D la lleva a la derecha ('+e.heroe.x+', '+e.heroe.z+')');
    await pagina.keyboard.down('KeyW');await pagina.keyboard.down('KeyA');e=await r('r.avanzar(.6)');await pagina.keyboard.up('KeyW');await pagina.keyboard.up('KeyA');
    assert.ok(e.heroe.z<-2&&e.heroe.x<4,'W+A: arriba a la izquierda, en diagonal ('+e.heroe.x+', '+e.heroe.z+')');
    // Mira al oeste y el goblin está al este: el clic ataca hacia el cursor, no hacia donde mira.
    await r('r.heroe({x:0,z:0,dir:-Math.PI/2})');const g=await r('r.invocar("goblin",1.7,0,true)');await r('r.avanzar(.1)');let s=await r('r.enemigoPantalla(a[0])',g);
    await pagina.mouse.move(s.x,s.y);await r('r.avanzar(.1)');e=await r('r.estado()');assert.ok(e.sobre==='enemigo:'+g&&/Goblin de Camino/.test(e.objetivo),'Al pasar el ratón por encima se ve su nombre y su vida arriba');
    await pagina.mouse.down();await r('r.avanzar(.1)');await pagina.mouse.up();e=await r('r.avanzar(.4)');
    assert.ok(e.enemigos.find(x=>x.id===g).vida<34&&Math.abs(e.heroe.dir-Math.PI/2)<.3,'Clic: el tajo sale hacia el cursor (se gira al este) y le quita vida');
    // Mantener pulsado: combo de tres golpes (tajo, revés y estocada).
    await r('r.matar(a[0])',g);await r('r.avanzar(1.5)');await r('r.heroe({x:0,z:0})');const q=await r('r.invocar("saqueador",1.9,0,true)');await r('r.avanzar(.1)');s=await r('r.enemigoPantalla(a[0])',q);
    // Son hachazos, no puñetazos: en el tajo y el revés la cabeza del hacha barre un arco amplio a la altura del torso;
    // en la estocada acaba al frente y extendida. (Ángulo de la cabeza respecto a donde mira, en grados.)
    const IMP=[.3,.3,.39],combos=new Set(),traza={0:[],1:[],2:[]},impacto={};let duracion0=0;
    await pagina.mouse.move(s.x,s.y);await pagina.mouse.down();for(let i=0;i<80;i++){e=await r('r.avanzar(1/30)');const h=e.heroe;if(h.estado!=='golpe')continue;combos.add(h.combo);if(h.combo===0)duracion0++;
      const dx=h.punta[0]-h.x,dz=h.punta[2]-h.z,ang=Math.atan2(dx*Math.cos(h.dir)-dz*Math.sin(h.dir),dx*Math.sin(h.dir)+dz*Math.cos(h.dir))*180/Math.PI,p={ang,d:Math.hypot(dx,dz),y:h.punta[1]};
      if(h.t<=IMP[h.combo]*2.2)traza[h.combo].push(p);if(h.t>=IMP[h.combo]&&!impacto[h.combo])impacto[h.combo]=p;}
    await pagina.mouse.up();
    assert.deepEqual([...combos].sort(),[0,1,2],'Manteniendo el clic encadena el combo de tres golpes');
    for(const c of [0,1]){const angs=traza[c].map(p=>p.ang),barrido=Math.max(...angs)-Math.min(...angs),I=impacto[c];
      assert.ok(barrido>120&&I.d>1.05&&I.y>.3&&I.y<1.4,(c?'Revés':'Tajo')+': el hacha barre '+barrido.toFixed(0)+'° y en el impacto está a '+I.d.toFixed(2)+' m y '+I.y.toFixed(2)+' m de altura');}
    assert.ok(Math.abs(impacto[2].ang)<35&&impacto[2].d>1.3&&impacto[2].y>.2&&impacto[2].y<1.4,'Estocada: el hacha acaba al frente y extendida ('+impacto[2].ang.toFixed(0)+'°, '+impacto[2].d.toFixed(2)+' m, '+impacto[2].y.toFixed(2)+' m de altura)');
    assert.ok(e.enemigos.find(x=>x.id===q).vida<70,'…y el combo hace daño de verdad ('+e.enemigos.find(x=>x.id===q).vida+'/100)');
    await r('r.matar(a[0])',q);await r('r.avanzar(1.5)');
    // La velocidad de ataque: al empezar es lenta; una carta que la da (el Arco Dorado de Juan) acorta el combo.
    e=await r('r.estado()');assert.equal(e.heroe.vatq,1,'Empieza con la velocidad de ataque base');
    await r('r.soltar("arco","dorado",a[0],a[1]+.5)',e.heroe.x,e.heroe.z);await r('r.avanzar(.5)');await r('r.control({mov:[0,.3]})');await r('r.avanzar(.4)');await r('r.control(null)');e=await r('r.avanzar(.6)');
    assert.ok(e.heroe.botin.includes('arco/dorado')&&e.heroe.vatq>1.2&&/Vel\. ataque 124%/.test(await pagina.textContent('#stats')),'El Arco Dorado de Juan (dorado) da +24% de velocidad de ataque ('+e.heroe.vatq+')');
    await r('r.control({atacar:true,apunta:[a[0],a[1]+2]})',e.heroe.x,e.heroe.z);let rapido=0;for(let i=0;i<40;i++){e=await r('r.avanzar(1/30)');if(e.heroe.estado==='golpe'&&e.heroe.combo===0)rapido++;}await r('r.control(null)');
    assert.ok(rapido<duracion0*.88,'…y el hachazo es más rápido ('+duracion0+' → '+rapido+' fotogramas)');
    assert.deepEqual(errores,[],'Sin errores con el control');await contexto.close();}
  console.log('✓ WASD, ataque hacia el cursor, combo de tres hachazos (el hacha extendida en cada impacto) y velocidad de ataque de las cartas');

  // ---- Quién ataca y cuándo: la zona en el suelo, el «!», el contorno rojo y esquivar --------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');await r('r.heroe({x:0,z:0,alma:140})');
    const g=await r('r.invocar("goblin",0,-1.4,false)');await r('r.despertar(a[0])',g);
    let e=await hasta(r,e=>e.enemigos[0].ataque),t0=0;const G=(x=e)=>x.enemigos.find(y=>y.id===g);
    assert.ok(G().ataque?.forma==='cono'&&e.alertas===1&&G().borde>.2,'Al empezar a atacar dibuja su cono en el suelo, lleva un «!» y se le enciende el contorno');
    let fijadoT=null,golpeT=null;for(let t=0;t<2&&golpeT===null;t+=1/30){e=await r('r.avanzar(1/30)');if(G()?.ataque?.fijado&&fijadoT===null)fijadoT=t;if(e.heroe.alma<140)golpeT=t;}
    assert.ok(fijadoT!==null&&golpeT!==null&&golpeT-fijadoT>.18&&golpeT>.5,'Se fija antes del golpe (margen para reaccionar: '+(golpeT-fijadoT).toFixed(2)+' s; aviso total '+golpeT.toFixed(2)+' s)');
    assert.ok(e.heroe.golpeDe===g&&e.golpeDir>.5,'Al recibir el golpe se marca quién fue y de qué lado vino');
    // Salir del cono cuando se fija: no golpea.
    await r('r.heroe({alma:140})');e=await hasta(r,x=>G(x)?.ataque?.fijado);await pagina.keyboard.down('KeyS');e=await r('r.avanzar(.5)');await pagina.keyboard.up('KeyS');
    assert.equal(e.heroe.alma,140,'Salir de la zona cuando se fija esquiva el golpe');
    // Esquivar a través: invulnerable un instante, aunque la esquiva la deje dentro.
    await r('r.heroe({x:0,z:0,alma:140})');await r('r.enemigo(a[0],{x:0,z:-1.4})',g);e=await hasta(r,x=>G(x)?.ataque&&G(x).ataque.k>.85);await pagina.keyboard.press('Shift');e=await r('r.avanzar(.4)');
    assert.ok(e.heroe.alma===140&&e.heroe.esquivados>=1,'El dash (Shift) justo antes del golpe lo atraviesa («¡Esquivado!»)');
    // Nunca más de dos atacando cuerpo a cuerpo a la vez.
    await r('r.matar(a[0])',g);await r('r.avanzar(1.5)');await r('r.heroe({x:0,z:0,alma:5000})');const ids=[];for(let i=0;i<5;i++)ids.push(await r('r.invocar("goblin",Math.cos(a[0])*1.6,Math.sin(a[0])*1.6,false)',i*1.25));
    for(const id of ids)await r('r.despertar(a[0])',id);let max=0;for(let i=0;i<120;i++){e=await r('r.avanzar(1/30)');max=Math.max(max,e.enemigos.filter(x=>x.ataque).length);}
    assert.ok(max>=1&&max<=2,'Rodeada por cinco goblins, como mucho dos avisan a la vez ('+max+')');
    for(const id of ids)await r('r.matar(a[0])',id);await r('r.avanzar(1.5)');
    // El kobold desde fuera de la pantalla (detrás de la cámara): flecha en el borde y su línea; la lanza sigue la línea.
    await r('r.heroe({x:0,z:-6,alma:140})');const k=await r('r.invocar("kobold",0,5,false)');await r('r.despertar(a[0])',k);
    e=await hasta(r,e=>e.enemigos.find(x=>x.id===k)?.ataque,6);assert.ok(e.enemigos.find(x=>x.id===k).ataque.forma==='linea'&&e.flechas===1,'El kobold de fuera de la pantalla apunta con su línea y una flecha en el borde lo señala');
    e=await hasta(r,e=>e.heroe.alma<140,3);assert.ok(e.heroe.alma<140&&e.heroe.golpeDe===k,'Quedarse en la línea: la lanza la alcanza');
    await r('r.heroe({alma:140})');e=await hasta(r,e=>e.enemigos.find(x=>x.id===k)?.ataque?.fijado,6);await pagina.keyboard.down('KeyA');e=await r('r.avanzar(1)');await pagina.keyboard.up('KeyA');
    assert.equal(e.heroe.alma,140,'Apartarse de la línea cuando se fija: la lanza pasa de largo');
    assert.deepEqual(errores,[],'Sin errores con los avisos');await contexto.close();}
  console.log('✓ Quién ataca y cuándo: zona en el suelo, «!», contorno, dirección del golpe, flechas en el borde; apartarse o hacer dash lo evita');

  // ---- Parry (Espacio): perfecto aturde y expone; tardío bloquea parte; al aire, medio segundo sin parry ----------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');await r('r.heroe({x:0,z:0,alma:120,dir:0})');
    const nuevo=async()=>{const g=await r('r.invocar("goblin",0,-1.4,false)');await r('r.despertar(a[0])',g);return g;};
    let g=await nuevo();const G=(x,id=g)=>x.enemigos.find(y=>y.id===id);
    // Perfecto: Espacio cuando al golpe le queda un instante (aunque mire hacia otro lado: se gira sola hacia el golpe).
    let e=await hasta(r,x=>G(x)?.ataque&&G(x).ataque.k>.87);await pagina.keyboard.press('Space');e=await r('r.avanzar(.3)');
    assert.ok(e.heroe.alma===120&&e.heroe.parrys===1&&G(e)?.estado==='aturdido'&&G(e).expuesto,'Parry perfecto: sin daño, el goblin queda aturdido y expuesto ('+JSON.stringify(G(e))+')');
    // Expuesto: el contraataque le hace el doble.
    const v0=G(e).vida;await r('r.control({atacar:true,apunta:[0,-1.4]})');e=await r('r.avanzar(.45)');await r('r.control(null)');
    assert.ok(!G(e)||G(e).estado==='muere'||v0-G(e).vida>=20,'El goblin expuesto recibe el doble ('+v0+' → '+(G(e)?.vida??'muerto')+')');
    await r('r.matar(a[0])',g);await r('r.avanzar(1.5)');
    // Tardío: Espacio demasiado pronto; cuando llega el golpe ya no es perfecto: bloquea el 70%.
    await r('r.heroe({x:0,z:0,alma:120,dir:Math.PI})');g=await nuevo();e=await hasta(r,x=>G(x)?.ataque&&G(x).ataque.k>.6);await pagina.keyboard.press('Space');e=await r('r.avanzar(.35)');
    assert.ok(e.heroe.bloqueos===1&&e.heroe.alma<120&&e.heroe.alma>=114&&G(e)?.estado!=='aturdido','Parry tardío: bloquea, recibe solo el 30% ('+(120-e.heroe.alma)+' de daño) y no aturde');
    await r('r.matar(a[0])',g);await r('r.avanzar(1.5)');
    // Al aire: sin golpe que parar, medio segundo sin poder repetirlo.
    await pagina.keyboard.press('Space');e=await r('r.avanzar(.4)');assert.ok(e.heroe.cd.parry>0&&e.heroe.estado!=='parry','Un parry al aire deja un momento sin parry');
    assert.deepEqual(errores,[],'Sin errores con el parry');await contexto.close();}
  console.log('✓ Parry: perfecto aturde y deja expuesto (el doble de daño), tardío bloquea el 70%, al aire se paga');

  // ---- Mohamed, a distancia: pistola de seis balas, recarga, Abanico, Backflip que impresiona; y las lanzas que brillan para el parry ----
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');await r('r.elegir("mohamed")');
    let e=await r('r.avanzar(.2)');assert.ok(e.heroe.tipo==='mohamed'&&e.heroe.alma===100&&e.heroe.balas===6&&e.mallasHeroe===3,'Se puede jugar con Mohamed: 100 de Alma y seis balas');
    await r('r.heroe({x:0,z:2})');const g=await r('r.invocar("goblin",0,-4,true)');await r('r.control({atacar:true,apunta:[0,-4]})');
    for(let i=0;i<16&&e.enemigos.find(x=>x.id===g&&x.estado!=='muere');i++)e=await r('r.avanzar(.2)');
    assert.ok(!e.enemigos.find(x=>x.id===g&&x.estado!=='muere'),'Disparando hacia el cursor, las balas matan al goblin a distancia');
    for(let i=0;i<20&&!(e.heroe.recarga>0);i++)e=await r('r.avanzar(.1)');await r('r.control(null)');assert.ok(e.heroe.recarga>0&&e.heroe.balas===0,'Al vaciar el cargador recarga sola');
    e=await r('r.avanzar(1.3)');assert.equal(e.heroe.balas,6,'…y vuelve a tener seis balas');
    const ids=[];for(let i=0;i<4;i++)ids.push(await r('r.invocar("goblin",a[0],-5,true)',i*1.5-2.2));await r('r.heroe({x:0,z:2,furia:100})');await r('r.control({apunta:[0,-5]})');await r('r.avanzar(.1)');
    assert.ok(await r('r.usar("torbellino")'),'Q con Furia: Abanico');e=await r('r.avanzar(.8)');await r('r.control(null)');
    assert.ok(e.enemigos.filter(x=>ids.includes(x.id)&&x.vida<34).length>=3,'El Abanico (siete balas) alcanza a varios a la vez');
    await r('r.heroe({furia:100})');assert.ok(await r('r.usar("salto",0,-2.2)'),'Clic derecho con Furia: Backflip');e=await r('r.avanzar(.8)');
    assert.ok(Math.abs(e.heroe.z+2.2)<.5,'El Backflip la lleva al cursor');
    assert.ok(e.enemigos.filter(x=>ids.includes(x.id)&&x.estado==='aturdido').length>=2,'Los goblins que lo ven se quedan impresionados (aturdidos): '+e.enemigos.map(x=>x.estado).join(', '));
    // Las dos propuestas de bala se pueden elegir y disparar.
    for(const v of ['trazadora','plomo']){await r('r.balas(a[0])',v);const d0=(await r('r.estado()')).heroe.disparos;await r('r.control({atacar:true,apunta:[3,-8]})');let vistas=0;
      for(let i=0;i<45;i++){e=await r('r.avanzar(1/30)');vistas=Math.max(vistas,e.balas);}await r('r.control(null)');assert.ok(e.heroe.disparos>d0&&vistas>0,'Se dispara con la bala «'+v+'»');await r('r.avanzar(1.5)');}
    for(const id of ids)await r('r.matar(a[0])',id);await r('r.avanzar(1.5)');
    // La lanza del kobold brilla y, justo en la ventana del parry perfecto, el brillo se vuelve blanco y grande; un parry ahí la devuelve.
    await r('r.heroe({x:0,z:-6,alma:100})');const k=await r('r.invocar("kobold",0,3,false)');await r('r.despertar(a[0])',k);let ahora=false;
    for(let i=0;i<150&&!ahora;i++){e=await r('r.avanzar(1/30)');ahora=e.lanzaAhora;}
    assert.ok(ahora,'La lanza avisa (brillo blanco) en la ventana del parry perfecto');
    // (el Alma de antes del parry: algún orbe de curación de los goblins de antes puede haberla subido por el camino)
    const alma0=e.heroe.alma;await pagina.keyboard.press('Space');e=await r('r.avanzar(.5)');assert.ok(e.heroe.alma>=alma0&&e.heroe.parrys===1,'Un parry con ese aviso la desvía sin daño ('+alma0+' → '+e.heroe.alma+')');
    assert.deepEqual(errores,[],'Sin errores con Mohamed');await contexto.close();}
  console.log('✓ Mohamed a distancia: pistola (dos propuestas de bala), recarga, Abanico y Backflip que impresiona; las lanzas brillan en la ventana del parry');

  // ---- Habilidades --------------------------------------------------------------------
  {const {contexto,errores,pagina,r}=await abrir(navegador);await r('r.oleadas(false)');
    await r('r.heroe({x:0,z:0,furia:0})');await pagina.keyboard.press('KeyQ');let e=await r('r.avanzar(.1)');assert.notEqual(e.heroe.estado,'torbellino','Sin Furia no hay Torbellino');
    assert.ok(/Furia/.test(await pagina.textContent('#tostada')),'…y lo dice');
    const ids=[];for(let i=0;i<3;i++)ids.push(await r('r.invocar("goblin",Math.cos(a[0])*1.8,Math.sin(a[0])*1.8,true)',i*2.1));
    await r('r.heroe({furia:100})');await pagina.keyboard.press('KeyQ');e=await r('r.avanzar(1.5)');
    assert.ok(ids.every(id=>{const x=e.enemigos.find(x=>x.id===id);return !x||x.vida<x.vidaMax;}),'Q: el Torbellino hiere a todos los que la rodean');
    for(const id of ids)await r('r.matar(a[0])',id);await r('r.avanzar(2)');
    const lejos=[];for(let i=0;i<3;i++)lejos.push(await r('r.invocar("goblin",6+a[0]*.8,-.5+a[0]*.6,true)',i));
    await r('r.heroe({x:0,z:0,furia:100})');await r('r.avanzar(.1)');const s=await r('r.pantalla(6.5,0,0)');await pagina.mouse.move(s.x,s.y);await pagina.mouse.down({button:'right'});await pagina.mouse.up({button:'right'});
    e=await r('r.avanzar(.35)');const enAire=e.heroe.alto;e=await r('r.avanzar(.5)');
    assert.ok(enAire>1&&Math.hypot(e.heroe.x-6.5,e.heroe.z)<1.2,'Clic derecho: Salto al cursor ('+enAire+' m de alto)');
    assert.ok(lejos.every(id=>{const x=e.enemigos.find(x=>x.id===id);return !x||x.vida<x.vidaMax&&['aturdido','muere'].includes(x.estado);}),'…que aturde y hiere al caer');
    for(const id of lejos)await r('r.matar(a[0])',id);await r('r.avanzar(2)');
    const rodean=[];for(let i=0;i<3;i++)rodean.push(await r('r.invocar("goblin",Math.cos(a[0])*3,Math.sin(a[0])*3,true)',i*2.1));
    await r('r.heroe({x:0,z:0,furia:0})');const destino=await r('r.pantalla(3,0,0)');await pagina.mouse.move(destino.x,destino.y);
    await pagina.keyboard.press('KeyE');await r('r.avanzar(.35)');assert.equal((await r('r.bumeranes()')).length,1,'E lanza el hacha sin coste de Furia');
    e=await r('r.avanzar(2.5)');assert.equal((await r('r.bumeranes()')).length,0,'El hacha vuelve a la mano');
    const blanco=e.enemigos.find(x=>x.id===rodean[0]);
    assert.ok(!blanco||blanco.vida<blanco.vidaMax,'El búmeran hiere en su trayectoria');
    assert.ok(e.heroe.escudo===0&&e.heroe.cd.bumeran>5,'Usa su enfriamiento sin activar Provocar');
    assert.deepEqual(errores,[],'Sin errores con las habilidades');await contexto.close();}
  console.log('✓ Q Torbellino y clic derecho Salto al cursor con Furia; E Búmeran sin coste, con ida y regreso');

  // ---- Botín: se lee con el ratón encima y se recoge pisándolo -------------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(false)');await r('r.heroe({x:0,z:3,dir:0})');
    await r('r.soltar("mazo","dorado",1.5,6)');await r('r.avanzar(.5)');const s=await r('r.botinPantalla(0)');const atq=(await r('r.estado()')).heroe.atq;
    await pagina.mouse.move(s.x,s.y);await r('r.avanzar(.6)');let e=await r('r.estado()');const c=await r('r.rectBotin(0)');
    assert.ok(e.botines[0].mirada>.95&&e.botines[0].escala>3,'Con el ratón encima la carta se levanta y crece ('+e.botines[0].escala+'×)');
    assert.ok(c.izquierda>=0&&c.derecha<=c.ancho&&c.arriba>=0&&c.abajo<=c.alto&&c.abajo-c.arriba>c.alto*.28,'…entera en pantalla y grande para leerla ('+Math.round(c.abajo-c.arriba)+' px)');
    assert.ok(/Mazo de Brock/.test(e.botines[0].nombre)&&/Dorado/.test(e.botines[0].nombre)&&/ATQ/.test(e.botines[0].nombre),'…con su nombre, edición y bonificación');
    await pagina.mouse.move(5,5);await r('r.control({mov:[.45,.9]})');e=await r('r.avanzar(1.2)');await r('r.control(null)');e=await r('r.avanzar(.6)');
    assert.ok(e.heroe.botin.includes('mazo/dorado')&&e.heroe.atq>atq&&!e.botines.length,'Pisarla la recoge y da ATQ ('+atq+' → '+e.heroe.atq+')');
    assert.equal(await pagina.locator('#botin figure').count(),1,'La carta recogida aparece en la lista del botín');
    assert.deepEqual(errores,[],'Sin errores con el botín');await contexto.close();}
  console.log('✓ Botín en cartas físicas: se lee con el ratón encima y se recoge pisándolo');

  // ---- La partida entera con el piloto automático; la derrota --------------------------
  {const {contexto,pagina,errores,r}=await abrir(navegador);await r('r.oleadas(true)');await r('r.piloto(true)');let e;
    for(let i=0;i<40;i++){e=await r('r.avanzar(5)');if(e.finVisible||!e.heroe.vivo)break;}
    assert.ok(e.heroe.vivo&&e.fin&&e.finVisible&&/Tomsage resiste/.test(e.finTitulo),'El piloto (que sólo lee los avisos) gana las cuatro oleadas y a Can ('+e.heroe.alma+'/'+e.heroe.almaMax+' de Alma)');
    assert.ok(e.heroe.botin.includes('llavemago/dorado')&&e.heroe.llaves===1,'Can suelta la Llave del Mago dorada y se recoge ('+e.heroe.botin.length+' cartas)');
    await r('r.reiniciar()');await r('r.oleadas(false)');await r('r.piloto(false)');await r('r.heroe({x:0,z:0,alma:8})');const x=await r('r.invocar("saqueador",0,-1.6,false)');await r('r.despertar(a[0])',x);
    for(let i=0;i<8;i++){e=await r('r.avanzar(.5)');if(e.finVisible)break;}
    assert.ok(!e.heroe.vivo&&e.finVisible&&/Has caído/.test(e.finTitulo),'Sin Alma, Adreida cae y se ofrece volver a empezar');
    await pagina.click('#reintentar');e=await r('r.avanzar(.2)');
    assert.ok(e.heroe.vivo&&e.heroe.alma===e.heroe.almaMax&&!e.enemigos.length&&!e.finVisible,'«Volver a empezar» deja la plaza como al principio');
    assert.deepEqual(errores,[],'Sin errores en la partida');await contexto.close();}
  console.log('✓ La partida entera: cuatro oleadas, Can y la Llave del Mago; la derrota y volver a empezar');

  // ---- Táctil: palanca, Atacar (apunta solo), Esquiva y leer una carta tocándola ---------------
  {const {contexto,pagina,errores,r}=await abrir(navegador,{ancho:390,alto:780,tactil:true});await r('r.oleadas(false)');
    let e=await r('r.estado()');assert.ok(e.tactil&&await pagina.isVisible('#palanca'),'En táctil aparece la palanca');
    const p=await pagina.locator('#palanca').boundingBox(),cx=p.x+p.width/2,cy=p.y+p.height/2;
    await pagina.mouse.move(cx,cy);await pagina.mouse.down();await pagina.mouse.move(cx,cy-p.height*.45,{steps:4});await r('r.avanzar(1)');await pagina.mouse.up();e=await r('r.estado()');
    assert.ok(e.heroe.z<0&&Math.abs(e.heroe.x)<.6,'La palanca hacia arriba la lleva al fondo de la plaza ('+e.heroe.x+', '+e.heroe.z+')');
    const g=await r('r.invocar("goblin",a[0]+1.7,a[1],true)',e.heroe.x,e.heroe.z);await r('r.avanzar(.1)');await pagina.tap('[data-hab="tajo"]');await r('r.avanzar(.6)');e=await r('r.estado()');
    assert.ok(e.enemigos.find(x=>x.id===g).vida<34,'Atacar apunta solo al enemigo más cercano');
    await r('r.matar(a[0])',g);await r('r.avanzar(2)');const x0=e.heroe.x;await pagina.tap('[data-hab="esquiva"]');e=await r('r.avanzar(.3)');
    assert.ok(e.heroe.cd.esquiva>0&&e.heroe.x!==x0,'El botón de Esquiva esquiva');
    await r('r.soltar("arco","foil",a[0],a[1]+2.5)',e.heroe.x,e.heroe.z);await r('r.avanzar(.5)');const s=await r('r.botinPantalla(0)');
    await pagina.touchscreen.tap(s.x,s.y);e=await r('r.avanzar(.6)');assert.ok(e.botines[0].mirada>.9,'Tocar una carta del suelo la levanta para leerla');
    await r('r.control({mov:[0,1]})');await r('r.avanzar(.8)');await r('r.control(null)');e=await r('r.avanzar(.6)');assert.ok(e.heroe.botin.includes('arco/foil'),'…y pisándola se recoge');
    assert.deepEqual(errores,[],'Sin errores en táctil');await contexto.close();}
  console.log('✓ Táctil: palanca, Atacar con puntería automática, Esquiva y leer el botín tocándolo');

  // ---- Uso real: arranca solo, marcador y movimiento reducido; sin WebGL 2 ---------------
  for(const reducido of [false,true]){const {contexto,pagina,errores}=await abrir(navegador,{captura:false,reducido});
    await pagina.waitForFunction(()=>/fps/.test(document.getElementById('info').textContent),null,{timeout:60000});
    // En WebGL por software la plaza va a 0–1 fps: la cuenta atrás de 1,8 s de juego puede tardar más de un minuto real.
    await pagina.waitForFunction(()=>/Oleada 1/.test(document.getElementById('oleada').textContent),null,{timeout:120000});
    const info=await pagina.textContent('#info');assert.ok(/llamadas/.test(info)&&/three 186/.test(info)&&!/sin posproceso/.test(info),'El marcador muestra fps, llamadas y versión ('+info+')');
    if(reducido){const t=await pagina.evaluate(R=>{window[R].heroe({furia:100});window[R].usar('salto',3,0);return new Promise(ok=>setTimeout(()=>ok(window[R].estado().temblor),1200));},R);assert.equal(t,0,'Con movimiento reducido la cámara no tiembla');}
    assert.deepEqual(errores,[],'Sin errores al usarla');await contexto.close();}
  {const {contexto,pagina,errores}=await abrir(navegador,{captura:false,sinWebgl:true});
    await pagina.waitForFunction(()=>/WebGL 2/.test(document.getElementById('estado').textContent),null,{timeout:30000});
    assert.deepEqual(errores,[],'Sin WebGL 2 no hay errores sueltos: sólo el aviso');await contexto.close();}
  console.log('✓ Uso real: arranca la primera oleada, marcador, movimiento reducido y aviso sin WebGL 2');
}finally{await navegador?.close();servidor.close();}

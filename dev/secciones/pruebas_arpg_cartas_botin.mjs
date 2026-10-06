/* Primer drop: precarga real del bloque de botín, caché, luces estables y fallos de arte. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extraerDeclaracion} from './fuentes.mjs';
const fuente=fs.readFileSync(new URL('arpg-three-mesa.js',import.meta.url),'utf8');
const extraer=(n,t='function')=>{
 const async=t==='function'&&new RegExp('^\\s*async function '+n+'\\b','m').exec(fuente);
 if(!async)return extraerDeclaracion(fuente,n,t).texto;
 for(let fin=async.index;fin<fuente.length;fin++)if(fuente[fin]==='}'||fuente[fin]===';'){
  const texto=fuente.slice(async.index,fin+1);
  try{new vm.Script(texto);return texto;}catch{}
 }
 throw Error('No se pudo extraer '+n);
};
function entorno({coop=false,fallaPintor=false,sinAsync=false}={}){
 const c=vm.createContext({console:{warn(){}},setTimeout,clearTimeout,queueMicrotask,atob});c.window=c;
 vm.runInContext(fs.readFileSync(new URL('visor-three-vendor.js',import.meta.url),'utf8'),c);
 const ejecutar=s=>vm.runInContext(s,c);
 ejecutar(`
 const THREE=CAOZ_THREE.THREE,V3=THREE.Vector3,COOP=${coop},SB=.3,MIRA=3.2,ANCHO=2.5,ALTO=3.5,TAU=Math.PI*2;
 const escena=new THREE.Scene(),camara=new THREE.PerspectiveCamera(),tiempo={value:0},reloj={t:1},hitboxMat=new THREE.MeshBasicMaterial({visible:false});
 escena.add(new THREE.PointLight(0xffffff,20));camara.position.set(0,4,5);
 const cuenta={pintadas:0,imagenes:0,subidas:0,compilaciones:0,dibujos:0,artesAusentes:0,grupos:[],progreso:[]};
 let destino={original:true},fallaRender=false;const luna={castShadow:true};let viewport=new THREE.Vector4(0,0,1280,720);
 const renderer={shadowMap:{enabled:true,autoUpdate:true},getViewport:v=>v.copy(viewport),setViewport:(x,y,w,h)=>viewport=x.isVector4?x.clone():new THREE.Vector4(x,y,w,h),initTexture(){cuenta.subidas++;},compile(g,cam,s){if(cam!==camara||s!==escena)throw Error('Escena incorrecta');cuenta.compilaciones++;cuenta.grupos.push(g);},async compileAsync(...a){this.compile(...a);},getRenderTarget:()=>destino,setRenderTarget:v=>destino=v,render(s,cam){cuenta.dibujos++;if(fallaRender)throw Error('GPU indisponible');}};
 if(${sinAsync})renderer.compileAsync=null;
 const lienzoDe=(w,h)=>{const g={fillRect(){},strokeRect(){},fillText(){},drawImage(){}},c={width:w,height:h,getContext:()=>g,toDataURL:()=> 'data:image/jpeg;base64,mini'};return[c,g];};
 class Image{set src(v){cuenta.imagenes++;queueMicrotask(()=>{if(v.includes('ausente'))this.onerror?.();else this.onload?.();});}}
 const CARDS={mazo:{n:'Mazo'},arco:{n:'Arco'}};window.ARPG_THREE_ARTE={};for(const id of Object.keys(CARDS))for(const ed of ['normal','foil','dorado'])window.ARPG_THREE_ARTE[id+'/'+ed]={url:id==='arco'?'ausente.webp':id+'-'+ed+'.webp'};
 const CAOZ_CARTA_PINTOR={texturas({id,arte,ancho}){if(ancho!==256)throw Error('El botín debe usar 256 píxeles de ancho');cuenta.pintadas++;if(!arte.img)cuenta.artesAusentes++;if(${fallaPintor}&&id==='arco')throw Error('No pudo pintarse');return {color:lienzoDe(ancho,359)[0],normal:lienzoDe(4,4)[0],orm:lienzoDe(4,4)[0],mascara:lienzoDe(4,4)[0]};}};
 const geometria=new THREE.PlaneGeometry(ANCHO,ALTO),F={
 texturas:p=>Object.fromEntries([['map','color'],['normalMap','normal'],['orm','orm'],['mascara','mascara']].map(([k,v])=>[k,new THREE.CanvasTexture(p[v])])),
 materialCara:(tx,ed)=>new THREE.MeshPhysicalMaterial({map:tx.map}),materialCanto:ed=>new THREE.MeshPhysicalMaterial(),
 carta(cara,dorso,canto){const g=new THREE.Group();for(const m of [cara,dorso,canto]){const n=new THREE.Mesh(geometria,m);n.castShadow=true;g.add(n);}return g;}
 };
 const rnd=()=>.5,bono=()=>({texto:'Bono'}),suave=k=>Math.max(0,Math.min(1,k)),dentroPlaza=()=>{},chispas=()=>{},temblar=()=>{};
 const heroe={botin:[],llaves:0},rog={mano:[]},document={createElement:()=>({})},$=()=>({appendChild(){}}),tostada=()=>{};
 const etiqueta=()=>({pos:new V3(),el:{innerHTML:'',classList:{toggle(){}}}}),quitarEtiqueta=()=>{};
 ${extraer('imagen','const')}
 ${extraer('cacheTex','const')}
 let precargaBotin=null;
 ${extraer('EDICIONES','const')}
 ${extraer('botines','const')}
 ${extraer('matHaz','const')}
 ${extraer('arribaCam','const')}
 ${['texturaCartaReserva','texturasDe','texturaColorBotin','suavizarCarta','materialCartaBotin','materialDorsoBotin','cantoBotin','crearHazBotin','prepararCartasBotin','soltar','quitarBotin','recoger','pasoBotin'].map(n=>extraer(n)).join('\n')}
 dorso.mat=materialDorsoBotin(null);
 `);
 return {ejecutar,c};
}
for(const coop of [false,true]){
 const {ejecutar:r}=entorno({coop}),luces=()=>r('escena.children.filter(o=>o.isPointLight).length');
 const antes=r('escena.children.length');
 await r('Promise.all([prepararCartasBotin(p=>cuenta.progreso.push(p)),prepararCartasBotin()])');
 assert.equal(r('cuenta.pintadas'),6);assert.equal(r('cuenta.compilaciones'),4,'La precarga concurrente comparte las cuatro variantes GPU');
 assert.equal(r('cuenta.dibujos'),4);assert.equal(r('cuenta.subidas'),7,'Una textura por carta y un dorso compartido se suben antes del primer drop');
 assert.equal(r('dorso.mat.map.image.width'),256);assert.equal(r('dorso.mat.isMeshPhysicalMaterial'),undefined,'El dorso no usa el material físico de la colección');
 assert.equal(r('cacheMaterialBotin.get("mazo/normal").isMeshPhysicalMaterial'),undefined,'El frente no usa laca, refracción ni iridiscencia');
 assert.equal(r('cacheMaterialBotin.get("mazo/normal").normalMap'),null);
 for(const tx of await r('Promise.all(cacheTex.values()).then(a=>a.map(v=>v.tx))'))assert.deepEqual(Object.keys(tx),['map'],'Sólo el color permanece en caché');
 assert.equal(r('cuenta.progreso.filter(p=>p.fase==="texturas").length'),6);assert.equal(r('cuenta.progreso.at(-1).fase'),'gpu');
 assert.equal(r('escena.children.length'),antes,'El grupo de precarga no queda en la partida');assert.equal(r('destino.original'),true,'Las pasadas pequeñas restauran el render target');assert.equal(r('viewport.z'),1280);assert.equal(r('renderer.shadowMap.enabled&&renderer.shadowMap.autoUpdate&&luna.castShadow'),true,'El precalentado no cambia la calidad activa');
 assert.equal(r('cuenta.artesAusentes'),3,'La falta de ilustración sigue creando cartas legibles');
 const pintadas=r('cuenta.pintadas'),imagenes=r('cuenta.imagenes');
 for(const ed of ['normal','foil','dorado']){
  await r(`soltar('mazo','${ed}',0,0)`);assert.equal(luces(),1,'Soltar cada edición mantiene constante el número de PointLight');
  assert.equal(r('botines.at(-1).listo'),true);r('pasoBotin(.016)');
 }
 assert.equal(r('cuenta.pintadas'),pintadas);assert.equal(r('cuenta.imagenes'),imagenes,'El primer drop reutiliza el arte preparado');
 r('botines[0].mirada=1;pasoBotin(.016)');assert.equal(r('botines[0].cara.emissiveIntensity'),.5,'La lectura ilumina sólo la carta');assert.equal(luces(),1);
 r('var liberados=0;var primero=botines[0];for(const a of [primero.cara,primero.caja.geometry,primero.haz.geometry,primero.haz.material])a.addEventListener("dispose",()=>liberados++);recoger(primero);recoger(primero);reloj.t+=.6;pasoBotin(.016);quitarBotin(primero)');
 assert.equal(r('heroe.botin.length'),1,'Recoger es idempotente y registra la carta una vez');assert.equal(r('botines.includes(primero)'),false,'La animación de recogida elimina la carta');
 assert.equal(r('liberados'),4,'Retirar libera sólo los recursos propios y permite una llamada repetida');assert.equal(luces(),1);
 await r('soltar("mazo","normal",2,2)');assert.equal(r('botines.at(-1).listo'),true,'La misma carta puede reaparecer tras recogerla');
 assert.equal(r('cuenta.pintadas'),pintadas);assert.equal(r('cuenta.imagenes'),imagenes);assert.equal(luces(),1,'Reaparecer conserva caché y luces estables');
 r('var pendiente=soltar("arco","normal",1,1);var cancelado=botines.at(-1);quitarBotin(cancelado)');await r('pendiente');assert.equal(r('cancelado.g'),undefined,'Cancelar mientras espera texturas no resucita el drop');
 r('for(const b of [...botines])quitarBotin(b)');assert.equal(r('escena.children.length'),antes);
}
{const {ejecutar:r}=entorno({fallaPintor:true,sinAsync:true});await r('prepararCartasBotin()');assert.equal(r('cuenta.compilaciones'),4,'Sin compileAsync se precalientan las cuatro variantes durante la carga igualmente');await r('soltar("arco","foil",0,0)');assert.equal(r('botines[0].listo'),true,'Un pintor fallido usa la carta de reserva en vez de dejar una promesa rechazada');assert.equal(r('botines[0].cara.map.image.width'),256);}
{const {ejecutar:r}=entorno();r('fallaRender=true');await assert.rejects(r('prepararCartasBotin()'),/GPU indisponible/);assert.equal(r('escena.children.length'),1);assert.equal(r('destino.original'),true,'También restaura escena y destino si falla la GPU');assert.equal(r('viewport.z'),1280);assert.equal(r('renderer.shadowMap.enabled&&renderer.shadowMap.autoUpdate&&luna.castShadow'),true,'Restaura sombras tras un error GPU');}
console.log('✓ Botín: 256 px, una textura por carta, material mate y precarga idempotente, seis acabados en caché, PointLight estable, lectura emisiva, arte de reserva, cancelación y recursos propios liberados; normal/coop.');

/* Catálogo del estudio derivado de las cartas reales, sin duplicar reglas. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import vm from 'node:vm';
const raiz=dirname(fileURLToPath(import.meta.url));
const contexto=vm.createContext({Math,Date,TextEncoder,TextDecoder,setTimeout,clearTimeout,URLSearchParams,location:{protocol:'http:',search:''}});
vm.runInContext(readFileSync(join(raiz,'motor.js'),'utf8'),contexto,{timeout:5000});
const {cartas,lideres,mazos}=JSON.parse(vm.runInContext('JSON.stringify({cartas:CARDS,lideres:LEADERS,mazos:DECKS})',contexto));
const encuadres=JSON.parse(readFileSync(join(raiz,'art/encuadres.json'),'utf8'));
contexto.window={};
vm.runInContext(readFileSync(join(raiz,'arte-vistas.js'),'utf8'),contexto,{timeout:5000});
const limpiarVistas=contexto.window.CAOZ_VISTAS.limpiar;
const texto=s=>String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
function original(id){
  if(!Object.hasOwn(encuadres,id))return null;
  if(!existsSync(join(raiz,'art',id+'.webp')))throw Error('Falta la ilustración original de '+id);
  const v=encuadres[id],e=typeof v==='number'?{x:50,y:v,z:100}:{x:v.x??50,y:v.y??50,z:v.z??100};
  return {url:'art/'+id+'.webp',encuadre:e,...(v?.placeholder===true?{placeholder:true}:{})};
}
function originales(carta){
  const variantes=encuadres[carta.id]?.variantes,salida={normal:carta.original};
  for(const acabado of ['foil','dorado']){
    if(!variantes||!Object.hasOwn(variantes,acabado))continue;
    const v=variantes[acabado],ruta='art/'+carta.id+'-'+acabado+'-v1.webp';
    if(!v||typeof v!=='object'||Array.isArray(v)||(v.url!==ruta&&!(carta.id==='tal'&&acabado==='dorado'&&v.url==='art/tal-dorado-final-v1.webp')))
      throw Error('Ruta original inválida de '+carta.id+' '+acabado);
    if(!existsSync(join(raiz,v.url)))throw Error('Falta la ilustración original de '+carta.id+' '+acabado);
    const encuadre={x:v.x??50,y:v.y??50,z:v.z??100};
    if(!Object.values(encuadre).every(Number.isFinite)||encuadre.x<0||encuadre.x>100||encuadre.y<0||encuadre.y>100||encuadre.z<50||encuadre.z>300)
      throw Error('Encuadre original inválido de '+carta.id+' '+acabado);
    const vistas=limpiarVistas(v.vistas);
    salida[acabado]={url:v.url,encuadre,...(Object.keys(vistas).length?{vistas}:{}),...(v.placeholder===true?{placeholder:true}:{}),...(typeof v.estilo==='string'&&v.estilo?{estilo:v.estilo}:{})};
  }
  if(Object.keys(salida).length>1)carta.originales=salida;
}
const fichas=Object.entries(cartas).map(([id,c])=>({id,nombre:c.n,tipo:c.t,coste:c.c??null,ataque:c.a??null,vida:c.h??null,texto:texto(c.x),tribu:(c.tr||[]).join(' · '),simbolo:c.art||'✦',esLider:false,ficha:!!c.token,mazos:Object.entries(mazos).filter(([,d])=>d.list.some(([carta])=>carta===id)).map(([lid])=>lideres[lid].n),original:original(id)}));
for(const [id,l] of Object.entries(lideres))fichas.push({id:'lider_'+id,nombre:l.n,tipo:'lider',coste:null,ataque:null,vida:null,texto:texto(l.pasiva)+'\n'+texto(l.hab),tribu:l.arch,simbolo:l.art||'✦',esLider:true,ficha:false,mazos:[l.n],original:original('lider_'+id)});
fichas.forEach(originales);
const salida=JSON.stringify({version:1,cartas:fichas},null,2)+'\n',destino=join(raiz,'art/catalogo.json');
if(process.argv.includes('--comprobar')){
  if(!existsSync(destino)||readFileSync(destino,'utf8')!==salida)throw Error('El catálogo de ilustraciones está desactualizado. Ejecuta node generar_catalogo_arte.mjs.');
}else writeFileSync(destino,salida);
console.log(fichas.length+' cartas y protagonistas en el catálogo; '+fichas.filter(c=>c.original).length+' originales ilustrados.');

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
const texto=s=>String(s||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
function original(id){
  if(!Object.hasOwn(encuadres,id))return null;
  if(!existsSync(join(raiz,'art',id+'.webp')))throw Error('Falta la ilustración original de '+id);
  const v=encuadres[id],e=typeof v==='number'?{x:50,y:v,z:100}:{x:v.x??50,y:v.y??50,z:v.z??100};
  return {url:'art/'+id+'.webp',encuadre:e};
}
const fichas=Object.entries(cartas).map(([id,c])=>({id,nombre:c.n,tipo:c.t,coste:c.c??null,ataque:c.a??null,vida:c.h??null,texto:texto(c.x),tribu:(c.tr||[]).join(' · '),simbolo:c.art||'✦',esLider:false,ficha:!!c.token,mazos:Object.entries(mazos).filter(([,d])=>d.list.some(([carta])=>carta===id)).map(([lid])=>lideres[lid].n),original:original(id)}));
for(const [id,l] of Object.entries(lideres))fichas.push({id:'lider_'+id,nombre:l.n,tipo:'lider',coste:null,ataque:null,vida:null,texto:texto(l.pasiva)+'\n'+texto(l.hab),tribu:l.arch,simbolo:l.art||'✦',esLider:true,ficha:false,mazos:[l.n],original:original('lider_'+id)});
const salida=JSON.stringify({version:1,cartas:fichas},null,2)+'\n',destino=join(raiz,'art/catalogo.json');
if(process.argv.includes('--comprobar')){
  if(!existsSync(destino)||readFileSync(destino,'utf8')!==salida)throw Error('El catálogo de ilustraciones está desactualizado. Ejecuta node generar_catalogo_arte.mjs.');
}else writeFileSync(destino,salida);
console.log(fichas.length+' cartas y protagonistas en el catálogo; '+fichas.filter(c=>c.original).length+' originales ilustrados.');

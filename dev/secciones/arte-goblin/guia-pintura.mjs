/* Láminas para pintar sin depender del visor: proyección del modelo real, orientación mundial y UV v2 intactas. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import cuaderno from './cuaderno.js';

export const DIRECCIONES=[
 {id:'F',nombre:'FRENTE',color:'#df5c4e',eje:2,signo:1},
 {id:'E',nombre:'ESPALDA',color:'#437fd0',eje:2,signo:-1},
 {id:'I',nombre:'IZQUIERDA',color:'#229b77',eje:0,signo:1},
 {id:'D',nombre:'DERECHA',color:'#9b62bc',eje:0,signo:-1},
 {id:'A',nombre:'ARRIBA',color:'#d49a19',eje:1,signo:1},
 {id:'B',nombre:'ABAJO',color:'#687888',eje:1,signo:-1},
];
export function direccion(n){const a=[Math.abs(n[0]),Math.abs(n[1]),Math.abs(n[2])],eje=a.indexOf(Math.max(...a));return DIRECCIONES.find(d=>d.eje===eje&&d.signo===(n[eje]<0?-1:1));}
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const n=v=>Number(v.toFixed(2));
const texto=(x,y,s,t=20,c='#26383b',peso=400)=>`<text x="${n(x)}" y="${n(y)}" font-family="Arial,sans-serif" font-size="${t}" font-weight="${peso}" fill="${c}">${xml(s)}</text>`;
const rect=(x,y,w,h,fill,radio=0,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radio}" fill="${fill}" stroke="${stroke}"/>`;
const svg=(c,w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${c}</svg>`;
const puntoClave=p=>p.map(v=>v.toFixed(3)).join(',');
const bordeClave=(a,b)=>[puntoClave(a),puntoClave(b)].sort().join('|');
const promedio=(a,i)=>a.reduce((s,v)=>s+v[i],0)/a.length;

// Color y bordes obedecen las normales transformadas del modelo, nunca los ejes locales de una primitiva girada.
export function analizarPieza(p,THREE){
 const g=p.g.clone().applyMatrix4(p.m),P=g.attributes.position,N=g.attributes.normal,ts=[];
 for(let i=0;i<P.count;i+=3){
  const pos=[0,1,2].map(j=>[P.getX(i+j),P.getY(i+j),P.getZ(i+j)]),norm=[0,1,2].map(j=>[N.getX(i+j),N.getY(i+j),N.getZ(i+j)]);
  const normal=[0,1,2].map(k=>promedio(norm,k)),uv=[0,1,2].map(j=>[p.uv[i+j][0]*4096,(1-p.uv[i+j][1])*4096]);
  const area=Math.abs((uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1])-(uv[1][1]-uv[0][1])*(uv[2][0]-uv[0][0]))/2;
  ts.push({pos,normal,uv,area,dir:direccion(normal),pieza:p.id});
 }
 g.dispose();return ts;
}

function regiones(ts){
 const indices=new Map(),vecinos=ts.map(()=>new Set());
 for(const [i,t] of ts.entries())if(t.area>.001)for(let k=0;k<3;k++){const clave=bordeClave(t.uv[k],t.uv[(k+1)%3]);if(!indices.has(clave))indices.set(clave,[]);indices.get(clave).push(i);}
 for(const lista of indices.values())for(const a of lista)for(const b of lista)if(a!==b&&ts[a].dir===ts[b].dir)vecinos[a].add(b);
 const vistos=new Set(),grupos=[];
 for(let i=0;i<ts.length;i++){if(vistos.has(i)||ts[i].area<=.001)continue;const cola=[i],grupo=[];vistos.add(i);
  while(cola.length){const j=cola.pop();grupo.push(ts[j]);for(const k of vecinos[j])if(!vistos.has(k)){vistos.add(k);cola.push(k);}}
  grupos.push(grupo);
 }
 return grupos;
}

function orientacionUV(ts,dx=0,dy=0){
 const grupos=regiones(ts);let salida='';
 for(const grupo of grupos){
  const dir=grupo[0].dir,bordes=new Map();
  for(const t of grupo){salida+=`<polygon points="${t.uv.map(([x,y])=>`${n(x+dx)},${n(y+dy)}`).join(' ')}" fill="${dir.color}" fill-opacity=".1"/>`;
   for(let k=0;k<3;k++){const a=t.uv[k],b=t.uv[(k+1)%3],key=bordeClave(a,b);const viejo=bordes.get(key);bordes.set(key,{a,b,n:(viejo?.n||0)+1});}
  }
  const paths=[...bordes.values()].filter(e=>e.n===1).map(e=>`M${n(e.a[0]+dx)},${n(e.a[1]+dy)}L${n(e.b[0]+dx)},${n(e.b[1]+dy)}`).join('');
  salida+=`<path d="${paths}" fill="none" stroke="#111c23" stroke-width="5.5" stroke-linejoin="round"/><path d="${paths}" fill="none" stroke="${dir.color}" stroke-width="3.4" stroke-linejoin="round"/>`;
  const area=grupo.reduce((s,t)=>s+t.area,0);if(area<1000)continue;
  const cx=grupo.reduce((s,t)=>s+promedio(t.uv,0)*t.area,0)/area,cy=grupo.reduce((s,t)=>s+promedio(t.uv,1)*t.area,0)/area;
  // El centro puede caer en otra isla. Elegimos el triángulo real más cercano, con espacio para su letra.
  const t=grupo.filter(t=>t.area>20).sort((a,b)=>Math.hypot(promedio(a.uv,0)-cx,promedio(a.uv,1)-cy)-Math.hypot(promedio(b.uv,0)-cx,promedio(b.uv,1)-cy))[0];if(!t)continue;
  const x=promedio(t.uv,0)+dx,y=promedio(t.uv,1)+dy;
  salida+=`<circle cx="${n(x)}" cy="${n(y)}" r="11" fill="${dir.color}" stroke="#fff" stroke-width="1.5"/>`+texto(x-6,y+6,dir.id,17,'#fff',700);
 }
 return salida;
}

// Proyección ortográfica de los mismos triángulos del juego. No depende de capturas ni de un navegador abierto.
function proyeccion(todos,elegida,x,y,w,h,giro=0,detalle=false){
 const c=Math.cos(giro),s=Math.sin(giro),pitch=.12,cp=Math.cos(pitch),sp=Math.sin(pitch);
 const proyectar=([a,b,z])=>{const X=a*c+z*s,Z=-a*s+z*c;return [X,b*cp-Z*sp,b*sp+Z*cp];};
 const ts=(detalle?todos.filter(t=>t.pieza===elegida):todos).map(t=>({...t,v:t.pos.map(proyectar)}));
 const valores=ts.flatMap(t=>t.v),xmin=Math.min(...valores.map(v=>v[0])),xmax=Math.max(...valores.map(v=>v[0])),ymin=Math.min(...valores.map(v=>v[1])),ymax=Math.max(...valores.map(v=>v[1]));
 const k=Math.min((w-22)/(xmax-xmin),(h-22)/(ymax-ymin)),px=v=>x+w/2+(v[0]-(xmin+xmax)/2)*k,py=v=>y+h/2-(v[1]-(ymin+ymax)/2)*k;
 ts.sort((a,b)=>promedio(a.v,2)-promedio(b.v,2));
 const pol=(t,color)=>`<polygon points="${t.v.map(v=>`${n(px(v))},${n(py(v))}`).join(' ')}" fill="${color}" stroke="${color}" stroke-width=".3"/>`;
 let salida='';
 for(const t of ts){
  const normal=proyectar(t.normal);if(normal[2]<-.03)continue;
  const luz=.7+.3*Math.max(0,normal[0]*-.35+normal[1]*.5+normal[2]*.7),color=detalle?t.dir.color:'#abb5b0';
  const rgb=[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*luz)));
  salida+=pol(t,`rgb(${rgb.join(',')})`);
 }
 if(!detalle){
  // Resaltado de ubicación sobre ropa translúcida: también identifica pecho, cadera y piezas parcialmente ocultas.
  const propia=ts.filter(t=>t.pieza===elegida);for(const t of propia)if(proyectar(t.normal)[2]>=-.03)salida+=pol(t,'#cf9e39');
  const puntos=propia.flatMap(t=>t.v),tx=px([promedio(puntos,0),0,0]),ty=py([0,promedio(puntos,1),0]);
  const fin=x+w-4,alto=Math.max(y+20,Math.min(y+h-16,ty-20));
  salida+=`<path d="M${n(tx)},${n(ty)}L${n(fin-25)},${n(alto)}H${n(fin)}" fill="none" stroke="#8a641e" stroke-width="2"/><circle cx="${n(tx)}" cy="${n(ty)}" r="5" fill="#fff" stroke="#8a641e" stroke-width="2"/>`;
 }
 return salida;
}

function leyenda(x,y){return DIRECCIONES.map((d,i)=>{const a=x+(i%3)*267,b=y+Math.floor(i/3)*35;return rect(a,b-18,20,20,d.color,4)+texto(a+5,b-2,d.id,14,'#fff',700)+texto(a+30,b-2,d.nombre,17,'#364848',700);}).join('');}

export async function crearCuaderno({piezas,THREE,sharp,JSZip,destino}){
 const {ANCHO,ALTO,casillas}=cuaderno,slots=casillas(),todos=piezas.flatMap(p=>analizarPieza(p,THREE));
 const guardar=(nombre,contenido)=>fs.writeFileSync(path.join(destino,nombre),contenido),archivos=[];
 const baseAtlas=fs.readFileSync(path.join(destino,'goblin-pintar.png')),baldosas=[],capasGuia=[];
 let orientacionAtlas='';const metadatos=[];
 for(const [i,slot] of slots.entries()){
  const p=piezas.find(p=>p.id===slot.id),propios=todos.filter(t=>t.pieza===p.id),[ax,ay,aw,ah]=slot.atlas,[cx,cy]=slot.cuaderno;
  const ox=i%5*1200,oy=Math.floor(i/5)*900,izq=p.nombre.includes('izquierd'),der=p.nombre.includes('derech');
  const giro=p.nombre.includes('espalda')?Math.PI:p.nombre.includes('Hoja')?-Math.PI/2:izq?-.18:der?.18:0;
  const vista=p.nombre.includes('espalda')?'DESDE ATRÁS':p.nombre.includes('Hoja')?'DESDE EL LADO IZQUIERDO':'DESDE EL FRENTE';
  const vertices=propios.flatMap(t=>t.pos),extension=e=>Math.max(...vertices.map(v=>v[e]))-Math.min(...vertices.map(v=>v[e]));
  const perfil=extension(2)>extension(0)*1.7,giroDetalle=perfil?-Math.PI/2:0;
  let ref=rect(0,0,1200,900,'#e8ebe5')+rect(12,12,1176,876,'#fbfaf5',18,'#d3dad2');
  ref+=rect(30,32,62,54,'#344b45',10)+texto(43,70,p.id,29,'#fff',700)+texto(111,72,p.nombre,32,'#213b35',700);
  ref+=texto(32,111,izq?'Lado izquierdo del goblin: a tu derecha al mirarlo de frente.':der?'Lado derecho del goblin: a tu izquierda al mirarlo de frente.':'Orientación respecto al goblin de pie, mirando al frente.',19,'#586b66');
  ref+=texto(32,155,'01 / UBICACIÓN',15,'#607970',700)+texto(340,155,'03 / SUPERFICIE PARA PINTAR',15,'#607970',700);
  ref+=proyeccion(todos,p.id,32,175,280,337,giro)+texto(32,530,vista,16,'#364f47',700);
  ref+=texto(32,555,'Dorado: esta pieza.',17)+texto(32,579,'Gris: resto del personaje.',17);
  ref+=texto(32,616,'02 / ORIENTACIÓN EN 3D',15,'#607970',700);
  ref+=proyeccion(todos,p.id,28,635,139,150,giroDetalle,true)+proyeccion(todos,p.id,174,635,139,150,giroDetalle+Math.PI,true);
  ref+=texto(39,807,perfil?'IZQUIERDA':'FRENTE',15,'#364f47',700)+texto(184,807,perfil?'DERECHA':'ESPALDA',15,'#364f47',700);
  ref+=texto(340,189,'Los colores del detalle 3D coinciden con los bordes del plano.',19);
  ref+=rect(337,217,aw+6,ah+6,'#243139',6)+leyenda(350,785);
  ref+=texto(350,855,'Oculta «Orientación y bordes» al exportar. Conserva las demás capas.',17,'#586b66');
  const fondo=await sharp(Buffer.from(svg(ref,1200,900))).png().toBuffer();
  baldosas.push({input:fondo,left:ox,top:oy});
  const guia=orientacionUV(propios,cx-ax,cy-ay);orientacionAtlas+=orientacionUV(propios);
  capasGuia.push(guia);const base=await sharp(baseAtlas).extract({left:ax,top:ay,width:aw,height:ah}).png().toBuffer();
  archivos.push({input:base,left:cx,top:cy});
  metadatos.push({id:p.id,nombre:p.nombre,atlas:slot.atlas,cuaderno:slot.cuaderno,direcciones:[...new Set(propios.map(t=>t.dir.id))]});
  console.log('Guía autónoma · '+p.id+' · '+p.nombre);
 }
 const x=4800,y=6300;
 let instrucciones=rect(12,12,1176,876,'#263e36',18)+texto(48,95,'GOBLIN / CUADERNO DE PINTURA',32,'#fff',700);
 for(const [i,linea] of ['39 piezas del modelo suavizado · UV v2','1. Pinta en la capa «Mi ilustración».','2. Mira el modelo dorado para ubicar la pieza.','3. Compara sus dos vistas con los bordes de colores.','4. Oculta «Orientación y bordes» antes de exportar.','5. Exporta todo el cuaderno como PNG, sin recortar.','6. Devuelve el PNG de 6000 × 7200 píxeles.','El visor separa la pintura de estas referencias.','Las letras indican hacia dónde mira la superficie.','Izquierda y derecha siempre son las del personaje.','Los colores no indican costuras que deban pegarse.'].entries())instrucciones+=texto(48,160+i*52,linea,23,i===0?'#d7c18b':'#dce6dc',i===0?700:400);
 instrucciones+=texto(48,820,'También puedes pintar el atlas clásico de 4096 × 4096.',22,'#d7c18b');
 baldosas.push({input:await sharp(Buffer.from(svg(instrucciones,1200,900))).png().toBuffer(),left:x,top:y});
 const referencias=await sharp({create:{width:ANCHO,height:ALTO,channels:4,background:'#e8ebe5'}}).composite(baldosas).png().toBuffer();
 const base=await sharp({create:{width:ANCHO,height:ALTO,channels:4,background:'#00000000'}}).composite(archivos).png().toBuffer();
 const guia=await sharp(Buffer.from(svg(capasGuia.join(''),ANCHO,ALTO))).png().toBuffer();
 guardar('goblin-cuaderno-base.png',await sharp(referencias).composite([{input:base}]).png().toBuffer());
 const junto=await sharp(referencias).composite([{input:base},{input:guia}]).png().toBuffer();guardar('goblin-cuaderno-explicado.png',junto);
 guardar('goblin-cuaderno-bordes.png',guia);guardar('goblin-orientacion.png',await sharp(Buffer.from(svg(orientacionAtlas,4096,4096))).png().toBuffer());
 guardar('goblin-cuaderno.json',JSON.stringify({version:1,uv:2,ancho:ANCHO,alto:ALTO,direcciones:DIRECCIONES,piezas:metadatos}));
 const ora=new JSZip();ora.file('mimetype','image/openraster',{compression:'STORE'});
 const nombres=[['Orientación y bordes — ocultar al exportar','bordes'],['Mi ilustración','pintura'],['Colores base','base'],['Referencias y nombres — conservar','referencias']];
 ora.file('stack.xml',`<?xml version="1.0" encoding="UTF-8"?><image version="0.0.3" w="${ANCHO}" h="${ALTO}" name="Goblin · Cuaderno de pintura"><stack>${nombres.map(([nombre,f])=>`<layer name="${nombre}" src="data/${f}.png" opacity="1.0" visibility="visible" composite-op="svg:src-over"/>`).join('')}</stack></image>`);
 ora.file('data/bordes.png',guia);ora.file('data/base.png',base);ora.file('data/referencias.png',referencias);ora.file('data/pintura.png',await sharp({create:{width:ANCHO,height:ALTO,channels:4,background:'#00000000'}}).png().toBuffer());
 ora.file('mergedimage.png',junto);ora.file('Thumbnails/thumbnail.png',await sharp(junto).resize(213,256).png().toBuffer());
 guardar('goblin-cuaderno.ora',await ora.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
 // Una tarjeta completa, legible a tamaño normal, para mostrar qué contiene el archivo.
 guardar('goblin-cuaderno-ejemplo.png',await sharp(junto).extract({left:0,top:0,width:1200,height:900}).png().toBuffer());
 // Comprobación real de ida y vuelta: el cuaderno no desplaza, recorta ni reescala ningún píxel del atlas.
 const {data:pixeles,info}=await sharp(path.join(destino,'goblin-cuaderno-base.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),recortes=[];
 for(const p of slots)recortes.push({input:await sharp(pixeles,{raw:{width:info.width,height:info.height,channels:4}}).extract({left:p.cuaderno[0],top:p.cuaderno[1],width:p.cuaderno[2],height:p.cuaderno[3]}).png().toBuffer(),left:p.atlas[0],top:p.atlas[1]});
 const reconstruida=await sharp({create:{width:4096,height:4096,channels:4,background:'#253039'}}).composite(recortes).raw().toBuffer();
 assert.ok(reconstruida.equals(await sharp(baseAtlas).ensureAlpha().raw().toBuffer()),'El cuaderno debe reconstruir el PNG original sin modificar un píxel');
}

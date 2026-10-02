/* Despliega las piezas reales del Goblin de Camino sin modificar el modelo del juego.
   Uso: SHARP_MODULE=ruta/a/sharp node dev/secciones/arte-goblin/exportar.mjs destino */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const aqui=path.dirname(fileURLToPath(import.meta.url)),fuentes=path.dirname(aqui);
const destino=path.resolve(process.argv[2]||'goblin-para-pintar');
if(fs.existsSync(destino)&&fs.readdirSync(destino).length)throw Error('Elige una carpeta vacía para no sobrescribir tu ilustración.');
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp'),JSZip=require(process.env.JSZIP_MODULE||'jszip');
const TAM=4096,COLUMNAS=5,FILAS=8,ancho=TAM/COLUMNAS,alto=TAM/FILAS;
const nombres=['Pantalón · cadera','Faldón','Cinturón','Bolsa del cinturón','Muslo izquierdo','Pantorrilla izquierda','Bota izquierda','Puño bota izquierda','Muslo derecho','Pantorrilla derecha','Bota derecha','Puño bota derecha','Chaleco','Pecho','Correa diagonal','Pañuelo · cuello','Pañuelo · espalda','Cabeza','Mandíbula','Nariz','Oreja izquierda','Ceja izquierda','Colmillo izquierdo','Oreja derecha','Ceja derecha','Colmillo derecho','Gorro','Brazo izquierdo','Antebrazo izquierdo','Brazal izquierdo','Mano izquierda','Brazo derecho','Antebrazo derecho','Brazal derecho','Mano derecha','Mango del hacha'];
const piezas=[],c=vm.createContext({console});c.window=c;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Captura antes de fundir y desechar las primitivas: conserva el orden exacto de los vértices.
const gancho='const malla=new THREE.SkinnedMesh(fundir(lista),M[mat]);';
c.__capturarPiezas=(mat,lista)=>{for(const [i,p] of lista.entries()){
 const g=p.geo.index?p.geo.toNonIndexed():p.geo.clone();
 piezas.push({mat,i,nombre:mat==='piel'?nombres[i]:mat==='metal'?'Hoja del hacha':i?'Ojo derecho':'Ojo izquierdo',hueso:p.nombre,color:'#'+p.color.toString(16).padStart(6,'0'),g,tipo:p.geo.type,param:p.geo.parameters,m:p.m.clone()});
}};
for(const archivo of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js']){
 let codigo=fs.readFileSync(path.join(fuentes,archivo),'utf8');
 if(archivo==='arpg-three-modelos.js'){assert.equal(codigo.split(gancho).length,2,'Revisar el exportador si cambia el montaje del modelo');codigo=codigo.replace(gancho,'window.__capturarPiezas(mat,lista);'+gancho);}
 vm.runInContext(codigo,c,{filename:archivo});
}
const THREE=c.CAOZ_THREE.THREE,modelo=c.CAOZ_ARPG_MODELOS.fabrica(THREE).crear('goblin');
assert.equal(piezas.length,39,'Revisar los nombres si cambia la geometría del goblin');
// Orden de lectura por zonas; cada pieza conserva un espacio independiente, también izquierda/derecha.
const orden=[17,18,19,20,23,26,21,24,22,25,12,13,14,15,16,0,1,2,3,35,27,28,29,30,36,31,32,33,34,37,4,5,6,7,38,8,9,10,11];
assert.equal(new Set(orden).size,piezas.length);
const rects=[],triangulos=[],base=[],guia=[],uvPorMat={},posPorMat={};
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const num=v=>Number(v.toFixed(4));
const svg=(contenido,fondo='')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${TAM}" height="${TAM}" viewBox="0 0 ${TAM} ${TAM}">${fondo}${contenido}</svg>`;
function desplegar(p){
 const g=p.g,uv=g.attributes.uv,q=p.param,grupo=i=>g.groups.find(x=>i>=x.start&&i<x.start+x.count)?.materialIndex||0;
 const coord=[],regiones=[];let w=1,h=1;
 if(p.tipo==='BoxGeometry'){
  const a=q.width,b=q.height,d=q.depth;w=2*(a+d);h=b+2*d;
  const caras=[[d+a,d,d,b,'Lado +X'],[0,d,d,b,'Lado −X'],[d,0,a,d,'Arriba'],[d,d+b,a,d,'Abajo'],[d,d,a,b,'Frente'],[a+2*d,d,a,b,'Espalda']];
  for(let i=0;i<uv.count;i++){const [x,y,dx,dy]=caras[grupo(i)];coord.push([x+uv.getX(i)*dx,y+(1-uv.getY(i))*dy]);}
  for(const [x,y,dx,dy,t] of caras)regiones.push({x:x+dx/2,y:y+dy/2,t,w:dx,h:dy});
 }else if(['CylinderGeometry','ConeGeometry'].includes(p.tipo)){
  const r=Math.max(q.radiusTop??0,q.radiusBottom??q.radius??0),gap=r*.14;w=Math.max(2*Math.PI*r,4*r+gap);h=q.height+(q.openEnded?0:2*r+gap);
  for(let i=0;i<uv.count;i++){const k=grupo(i),u=uv.getX(i),v=uv.getY(i);coord.push(k===0?[u*w,(1-v)*q.height]:[(k===1?0:2*r+gap)+u*2*r,q.height+gap+(1-v)*2*r]);}
  regiones.push({x:w/2,y:q.height/2,t:'Contorno',w,h:q.height});
  if(!q.openEnded){if((q.radiusTop??0)>0)regiones.push({x:r,y:q.height+gap+r,t:'Tapa superior',w:2*r,h:2*r});regiones.push({x:3*r+gap,y:q.height+gap+r,t:'Tapa inferior',w:2*r,h:2*r});}
 }else{
  const r=q.radius||1;w=2*Math.PI*r;h=p.tipo==='CapsuleGeometry'?(q.height??q.length??0)+Math.PI*r:Math.PI*r;
  let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  for(let i=0;i<uv.count;i++){minU=Math.min(minU,uv.getX(i));maxU=Math.max(maxU,uv.getX(i));minV=Math.min(minV,uv.getY(i));maxV=Math.max(maxV,uv.getY(i));}
  for(let i=0;i<uv.count;i++)coord.push([(uv.getX(i)-minU)/(maxU-minU)*w,(1-(uv.getY(i)-minV)/(maxV-minV))*h]);
  regiones.push({x:w*.25,y:h/2,t:'Frente (+Z)',w:w/2,h},{x:w*.75,y:h/2,t:'Espalda (−Z)',w:w/2,h});
 }
 return {coord,w,h,regiones};
}
for(const [celda,indice] of orden.entries()){
 const p=piezas[indice],d=desplegar(p),x=celda%COLUMNAS*ancho,y=Math.floor(celda/COLUMNAS)*alto;
 const escala=Math.min((ancho-64)/d.w,(alto-110)/d.h),ox=x+(ancho-d.w*escala)/2,oy=y+75+(alto-100-d.h*escala)/2;
 const puntos=d.coord.map(([a,b])=>[num(ox+a*escala),num(oy+b*escala)]);p.uv=puntos.map(([a,b])=>[a/TAM,1-b/TAM]);
 p.id=String(celda+1).padStart(2,'0');
 rects.push({id:p.id,nombre:p.nombre,material:p.mat,hueso:p.hueso,color:p.color,celda:[num(x),num(y),num(ancho),num(alto)]});
 const aristas=new Set();let relleno='';
 for(let i=0;i<puntos.length;i+=3){
  const t=puntos.slice(i,i+3),area=Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]));if(area<.001)continue;
  const pol=t.map(v=>v.join(',')).join(' ');relleno+=`<polygon points="${pol}"/>`;triangulos.push({pieza:p.id,puntos:t});
  for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=[a.join(','),b.join(',')].sort().join(' ');aristas.add(key);}
 }
 // Ocho píxeles de sangrado evitan costuras al filtrar la textura.
 base.push(`<g fill="${p.color}" stroke="${p.color}" stroke-width="16" stroke-linejoin="round">${relleno}</g>`);
 guia.push(`<rect x="${x+8}" y="${y+8}" width="${ancho-16}" height="${alto-16}" rx="12" fill="none" stroke="#9eb4bb" stroke-width="2" stroke-dasharray="7 7"/><text x="${x+25}" y="${y+41}" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#111c23" stroke="#ffffff" stroke-width="5" paint-order="stroke">${p.id} · ${xml(p.nombre)}</text>`);
 guia.push(`<g fill="none" stroke="#f4fcff" stroke-opacity=".9" stroke-width="1.3">${[...aristas].map(a=>`<polyline points="${a}"/>`).join('')}</g>`);
 for(const r of d.regiones)if(r.w*escala>r.t.length*9&&r.h*escala>26)guia.push(`<text x="${ox+r.x*escala}" y="${oy+r.y*escala}" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#14232a" stroke="white" stroke-width="3" paint-order="stroke">${xml(r.t)}</text>`);
}
let obj='# Goblin de Camino suavizado · UV v2 · metros · +Y arriba · +Z frente\nmtllib goblin.mtl\n',offset=1;
for(const p of piezas){
 uvPorMat[p.mat]??=[];posPorMat[p.mat]??=[];uvPorMat[p.mat].push(...p.uv.flat());
 const g=p.g.clone().applyMatrix4(p.m),P=g.attributes.position,N=g.attributes.normal;
 obj+=`o pieza_${p.id}\nusemtl goblin\n`;
 for(let i=0;i<P.count;i++){const v=[P.getX(i),P.getY(i),P.getZ(i)];posPorMat[p.mat].push(...v);obj+=`v ${v.map(num).join(' ')}\n`;}
 for(const [u,v] of p.uv)obj+=`vt ${u.toFixed(8)} ${v.toFixed(8)}\n`;
 for(let i=0;i<N.count;i++)obj+=`vn ${[N.getX(i),N.getY(i),N.getZ(i)].map(num).join(' ')}\n`;
 for(let i=0;i<P.count;i+=3)obj+='f '+[0,1,2].map(j=>{const k=offset+i+j;return `${k}/${k}/${k}`;}).join(' ')+'\n';
 offset+=P.count;
}
const mallas=modelo.mallas.map(m=>{
 const material=Object.keys(modelo.M).find(k=>modelo.M[k]===m.material),pos=m.geometry.attributes.position.array;
 assert.deepEqual(Array.from(pos),posPorMat[material],'El orden exportado debe coincidir con el modelo animado');
 assert.equal(uvPorMat[material].length,pos.length/3*2);assert.ok(uvPorMat[material].every(v=>v>=0&&v<=1));
 return {material,vertices:pos.length/3,huella:hash(Buffer.from(pos.buffer,pos.byteOffset,pos.byteLength)),uv:uvPorMat[material]};
});
const atlas={version:2,personaje:'goblin',tamano:TAM,modeloSHA256:hash(fs.readFileSync(path.join(fuentes,'arpg-three-modelos.js'))),piezas:rects,mallas};
fs.mkdirSync(destino,{recursive:true});const guardar=(n,v)=>fs.writeFileSync(path.join(destino,n),v);
guardar('goblin-uv.json',JSON.stringify(atlas));guardar('goblin.obj',obj);guardar('goblin.mtl','newmtl goblin\nKd 1 1 1\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\nmap_Kd goblin-pintar.png\n');
const gris='<rect width="4096" height="4096" fill="#253039"/>';
await sharp(Buffer.from(svg(base.join(''),gris))).png().toFile(path.join(destino,'goblin-pintar.png'));
await sharp(Buffer.from(svg(guia.join('')))).png().toFile(path.join(destino,'goblin-guia.png'));
guardar('goblin-guia.svg',svg(guia.join('')));
// OpenRaster conserva la guía, la pintura y los colores en capas independientes.
const ora=new JSZip();ora.file('mimetype','image/openraster',{compression:'STORE'});
ora.file('stack.xml','<?xml version="1.0" encoding="UTF-8"?><image version="0.0.3" w="4096" h="4096" name="Goblin de Camino"><stack><layer name="Guía — ocultar al exportar" src="data/guia.png" opacity="1.0" visibility="visible" composite-op="svg:src-over"/><layer name="Mi ilustración" src="data/pintura.png" opacity="1.0" visibility="visible" composite-op="svg:src-over"/><layer name="Colores base" src="data/base.png" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack></image>');
ora.file('data/guia.png',fs.readFileSync(path.join(destino,'goblin-guia.png')));ora.file('data/base.png',fs.readFileSync(path.join(destino,'goblin-pintar.png')));
ora.file('data/pintura.png',await sharp({create:{width:TAM,height:TAM,channels:4,background:'#00000000'}}).png().toBuffer());
ora.file('mergedimage.png',await sharp(path.join(destino,'goblin-pintar.png')).composite([{input:path.join(destino,'goblin-guia.png')}]).png().toBuffer());
ora.file('Thumbnails/thumbnail.png',await sharp(path.join(destino,'goblin-pintar.png')).resize(256,256).png().toBuffer());
guardar('goblin-capas.ora',await ora.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
await sharp(path.join(destino,'goblin-pintar.png')).composite([{input:path.join(destino,'goblin-guia.png')}]).png().toFile(path.join(destino,'goblin-mapa-explicado.png'));
for(const [desde,hasta] of [['vista.html','index.html'],['vista.css','vista.css'],['vista.js','vista.js'],['servidor.mjs','servidor.mjs'],['LEEME.txt','LEEME.txt']])fs.copyFileSync(path.join(aqui,desde),path.join(destino,hasta));
for(const archivo of ['visor-three-vendor.js','arpg-three-adreida-animacion.js','arpg-three-modelos.js'])fs.copyFileSync(path.join(fuentes,archivo),path.join(destino,archivo));
console.log(`✓ ${piezas.length} piezas, UV sin superposiciones entre piezas/caras de caja/tapas, ${mallas.length} mallas y ${offset-1} vértices conservados.\nKit: ${destino}`);

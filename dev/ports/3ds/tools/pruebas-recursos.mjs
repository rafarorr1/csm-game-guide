/* Comprueba el contrato binario que consume ARM11; no necesita WebGL ni SDK. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../romfs');
const resumen=JSON.parse(fs.readFileSync(path.join(dir,'modelos.json'),'utf8'));
assert.equal(resumen.version,2);assert.equal(resumen.modelos.length,22);assert.equal(resumen.clips.length,16);
let memoria=0,vertices=0,indices=0,poses=0;
for(const modelo of resumen.modelos){
 const b=fs.readFileSync(path.join(dir,modelo.tipo+'.bin')),h=Array.from({length:8},(_,i)=>b.readUInt32LE(i*4));
 assert.equal(h[0],0x34475241);assert.equal(h[7],56);assert(h[1]>0&&h[1]<65536);assert(h[3]>0&&h[3]<=24);assert(h[4]>0&&h[4]<=16);assert(h[5]>0&&h[5]<=48);assert(h[6]>0&&h[6]<=16);assert.equal(h[2]%3,0);
 let at=32;const v=new Float32Array(h[1]*14);for(let i=0;i<v.length;i++){v[i]=b.readFloatLE(at+i*4);assert(Number.isFinite(v[i]),modelo.tipo+' vértice inválido');}
 for(let i=0;i<h[1];i++){const base=i*14;assert(v[base+9]>=0&&v[base+9]/3<h[3]);assert(v[base+10]>=0&&v[base+10]/3<h[3]);assert(v[base+11]>=0&&v[base+11]<=1);}
 at+=h[1]*56;for(let i=0;i<h[2];i++)assert(b.readUInt16LE(at+i*2)<h[1]);at+=Math.ceil(h[2]*2/4)*4;
 let contados=0;for(let i=0;i<h[6];i++){const inicio=b.readUInt32LE(at+i*12),cantidad=b.readUInt32LE(at+i*12+4),tex=b.readInt32LE(at+i*12+8);assert.equal(inicio,contados);assert(cantidad>0&&cantidad%3===0);assert(tex>=-1&&tex<resumen.texturas.length);contados+=cantidad;}assert.equal(contados,h[2]);at+=h[6]*12;
 const largo=h[3]*h[4]*h[5]*12;for(let i=0;i<largo;i++)assert(Number.isFinite(b.readFloatLE(at+i*4)),modelo.tipo+' pose inválida');assert.equal(at+largo*4,b.length);
 if(modelo.tipo==='adreida')assert(h[2]/3<3500);if(modelo.tipo.startsWith('goblin'))assert(h[2]/3<1750);
 if(['adreida','goblin','kobold','piedra','pozo','interior'].includes(modelo.tipo))assert.equal(modelo.origen.toLowerCase(),'scenario');
 vertices+=h[1]*56;indices+=Math.ceil(h[2]*2/4)*4;poses+=largo*4;memoria+=b.length;
}
let memoriaTexturas=0;
for(const t of resumen.texturas){const b=fs.readFileSync(path.join(dir,t.archivo)),size=b.readUInt32LE(4);assert.equal(b.readUInt32LE(0),0x33584554);assert.equal(b.readUInt32LE(8),size);assert.equal(size,t.tamano);let bytes=12;for(let lado=size;lado>=8;lado>>=1)bytes+=lado*lado*2;assert.equal(bytes,b.length,'Cadena de mipmaps incompleta: '+t.archivo);memoria+=b.length;memoriaTexturas+=b.length-12;}
assert.equal(memoria,resumen.memoriaRecursosBytes);assert(memoria<24*1048576);
assert(resumen.texturas.some(t=>t.origen.includes('foto-familia')));assert(resumen.texturas.some(t=>t.origen.includes('foto-comida')));
console.log(JSON.stringify({modelos:resumen.modelos.length,texturas:resumen.texturas.length,clips:resumen.clips.length,recursosMiB:memoria/1048576,verticesMiB:vertices/1048576,indicesMiB:indices/1048576,posesMiB:poses/1048576,texturasConMipmapsMiB:memoriaTexturas/1048576},null,2));

/* Pruebas del visor en WebGPU (visor-3d-gpu.js) en su sección aislada: el
   paquete sólo lleva sus dependencias; con WebGPU, la carta que dibuja es la
   misma que la de WebGL (misma pose y luz; diferencia media mínima), cambia
   con la edición y tiene los bordes con antialiasing; sin WebGPU, la sección
   avisa y enseña sólo WebGL. Chrome sin pantalla pierde el dispositivo al
   presentar el lienzo de WebGPU, así que aquí se lee con ?presentar=0 y
   captura(). Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesVisorGpu,derivarVisorGpu} from './visor-gpu-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'visor-3d-gpu.js'),'utf8');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-visor-gpu-'));
try{
  const destino=path.join(temporal,'visor-gpu'),p=exportar(destino),{lista}=derivarVisorGpu();
  const esperados=['index.html','_headers','procedencia.json','visor-gpu-mesa.js','visor-gpu-mesa.css','generado/datos.js','art/logo.webp',...componentesVisorGpu.map(f=>'juego/'+f),...lista.map(c=>c.url)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La prueba sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  assert.ok(!/__[A-Z]+__/.test(html)&&!/(?:src|href)=["'](?:https?:)?\/\//i.test(html),'Sin marcadores ni recursos remotos');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/visor-gpu.html';
const POSE={ry:.45,rx:.12,luzX:.6,luzY:-.3};
// Carga una captura en la página y devuelve sus píxeles resumidos.
const medir=(pagina,a,b)=>pagina.evaluate(async([a,b])=>{
  const leer=async u=>{const i=new Image();await new Promise(r=>{i.onload=r;i.src=u;});const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);return g.getImageData(0,0,c.width,c.height).data;};
  const A=await leer(a),B=b?await leer(b):null;let carta=0,suma=0,n=A.length/4,escalones=0;
  for(let i=0;i<A.length;i+=4){if(A[i+3]>0)carta++;if(B)suma+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);if(A[i+3]>0&&A[i+3]<255)escalones++;}
  return {cobertura:carta/n,diferencia:B?suma/(n*3):null,bordeSuave:escalones};
},[a,b]);
let navegador;
try{
  for(const [flags,ancho,alto,conGpu]of [[['--enable-unsafe-webgpu'],1240,900,true],[['--enable-unsafe-webgpu'],390,844,true],[[],1240,900,false]]){
    navegador=await chromium.launch({channel:'chrome',headless:true,args:flags});
    const pagina=await navegador.newPage({viewport:{width:ancho,height:alto}}),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=ancho+'×'+alto+(conGpu?' · con WebGPU':' · sin WebGPU');
    try{
      if(conGpu){
        const cap=async(solo,ed='dorado')=>{
          await pagina.goto(base+'?presentar=0&solo='+solo);
          await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('estado').textContent),null,{timeout:200000});
          if(ed!=='dorado'){await pagina.click('[data-edicion="'+ed+'"]');await pagina.waitForFunction(e=>window.CAOZ_VISOR_GPU_REVISION.edicion()===e&&/Listo/.test(document.getElementById('estado').textContent),ed,{timeout:200000});}
          return pagina.evaluate(p=>CAOZ_VISOR_GPU_REVISION.captura(p==='gpu'?'gpu':'gl',{ry:.45,rx:.12,luzX:.6,luzY:-.3}).then(u=>u),solo);
        };
        const gpu=await cap('gpu');assert.ok(gpu,caso+': WebGPU dibuja la carta');
        assert.ok(await pagina.evaluate(()=>CAOZ_VISOR_GPU_REVISION.hayGpu()),caso+': hay WebGPU');
        const gl=await cap('gl');
        const m=await medir(pagina,gpu,gl);
        assert.ok(m.cobertura>.15,caso+': la carta ocupa el visor ('+m.cobertura.toFixed(2)+')');
        assert.ok(m.diferencia<3,caso+': WebGPU y WebGL dibujan la misma carta (diferencia media '+m.diferencia.toFixed(2)+')');
        assert.ok(m.bordeSuave>200,caso+': bordes con antialiasing ('+m.bordeSuave+' píxeles de borde)');
        const foil=await cap('gpu','foil');const mf=await medir(pagina,foil,gpu);
        assert.ok(mf.diferencia>2,caso+': cambiar de edición cambia la carta ('+mf.diferencia.toFixed(2)+')');
        void POSE;
      }else{
        await pagina.goto(base);
        await pagina.waitForFunction(()=>/no tiene WebGPU/.test(document.getElementById('estado').textContent),null,{timeout:200000});
        const e=await pagina.evaluate(()=>({gpu:CAOZ_VISOR_GPU_REVISION.hayGpu(),gl:CAOZ_VISOR_GPU_REVISION.hayGl(),motor:CAOZ_VISOR_GPU_REVISION.motor(),visible:getComputedStyle(document.getElementById('panelGl')).display!=='none'&&getComputedStyle(document.getElementById('panelGpu')).display==='none'}));
        assert.deepEqual(e,{gpu:false,gl:true,motor:'gl',visible:true},caso+': sin WebGPU avisa y enseña sólo WebGL');
      }
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+(conGpu?': misma carta que WebGL, bordes suaves y cambio de edición':': aviso y respaldo en WebGL'));
    }finally{await navegador.close();navegador=null;}
  }
}finally{await navegador?.close();servidor.close();}

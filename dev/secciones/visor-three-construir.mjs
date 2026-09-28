/* Construye visor-three-vendor.js: three.js 0.186.1 y sus complementos en un
   solo script (IIFE, window.CAOZ_THREE), minificado y con su licencia MIT.
   three y esbuild no son dependencias del proyecto: se instalan aparte.
     npm i --prefix /tmp/three three@0.186.1 esbuild@0.25.10
     node dev/secciones/visor-three-construir.mjs /tmp/three */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const aqui=path.dirname(fileURLToPath(import.meta.url)),prefijo=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Indica la carpeta donde instalaste three y esbuild.');
const req=createRequire(path.join(prefijo,'package.json')),esbuild=req('esbuild'),version=JSON.parse(fs.readFileSync(path.join(prefijo,'node_modules/three/package.json'),'utf8')).version;
if(version!=='0.186.1')throw Error('Se esperaba three 0.186.1 y hay '+version);
const licencia=fs.readFileSync(path.join(prefijo,'node_modules/three/LICENSE'),'utf8').trim();
await esbuild.build({entryPoints:[path.join(aqui,'visor-three-entrada.mjs')],bundle:true,minify:true,format:'iife',globalName:'CAOZ_THREE',target:'es2020',
  nodePaths:[path.join(prefijo,'node_modules')],legalComments:'none',outfile:path.join(aqui,'visor-three-vendor.js'),
  banner:{js:'/* three.js '+version+' (https://threejs.org) y complementos, empaquetados por visor-three-construir.mjs.\n'+licencia.split('\n').map(l=>'   '+l).join('\n')+' */'}});
console.log('visor-three-vendor.js: three '+version+', '+(fs.statSync(path.join(aqui,'visor-three-vendor.js')).size/1024).toFixed(0)+' KB');

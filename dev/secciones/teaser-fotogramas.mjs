/* Renderiza el teaser fotograma a fotograma (PNG) con el reloj virtual:
     node dev/secciones/teaser-fotogramas.mjs <carpeta nueva> [--fps 30] [--ancho 1920] [--alto 1080] [--desde 0] [--hasta 20]
   y después, con ffmpeg:
     ffmpeg -framerate 30 -i <carpeta>/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 16 teaser.mp4
   Usa Playwright (PLAYWRIGHT_MODULE si no está instalado localmente). */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {crearServidor} from './servidor.mjs';

const args=process.argv.slice(2),salida=args[0];
if(!salida||salida.startsWith('--'))throw Error('Indica una carpeta de salida nueva.');
const opcion=(n,d)=>{const i=args.indexOf('--'+n);return i>0?+args[i+1]:d;};
const fps=opcion('fps',30),ancho=opcion('ancho',1920),alto=opcion('alto',1080),desde=opcion('desde',0),hasta=opcion('hasta',20);
if(fs.existsSync(salida)&&fs.readdirSync(salida).length)throw Error('La carpeta de salida debe estar vacía.');
fs.mkdirSync(salida,{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const navegador=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
  const pagina=await navegador.newPage({viewport:{width:ancho,height:alto},deviceScaleFactor:1});
  const errores=[];pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
  await pagina.goto('http://127.0.0.1:'+servidor.address().port+'/dev/secciones/teaser.html?captura=1'+(desde?'&desde='+desde:''));
  const ok=await pagina.evaluate(()=>window.CAOZ_TEASER.listo);
  if(!ok)throw Error('El teaser no se pudo preparar: '+errores.join(' · '));
  await pagina.evaluate(()=>{CAOZ_RELOJ_VIRTUAL.manual();CAOZ_TEASER.empezar();});
  const total=Math.round((hasta-desde)*fps),inicio=Date.now();
  for(let i=0;i<total;i++){
    await pagina.evaluate(ms=>CAOZ_RELOJ_VIRTUAL.avanzar(ms),1000/fps);
    await pagina.screenshot({path:path.join(salida,'f'+String(i+1).padStart(5,'0')+'.png')});
    if((i+1)%fps===0)process.stdout.write(`\r${i+1}/${total} fotogramas · ${((Date.now()-inicio)/1000/(i+1)).toFixed(2)} s por fotograma`);
  }
  process.stdout.write('\n');
  if(errores.length)console.log('Errores de la página:\n'+errores.join('\n'));
  console.log(`Listo: ${total} fotogramas en ${salida}\nffmpeg -framerate ${fps} -i ${path.join(salida,'f%05d.png')} -c:v libx264 -pix_fmt yuv420p -crf 16 teaser.mp4`);
}finally{await navegador.close();servidor.close();}

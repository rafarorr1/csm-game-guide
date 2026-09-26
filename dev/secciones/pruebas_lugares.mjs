/* Pruebas de los escenarios de los Lugares (campo-lugar.js) en su sección
   aislada: el paquete sólo lleva sus dependencias; cada Lugar pone su escena
   (fondo con su ilustración, suelo y ambiente pintados, borde del lado que lo
   controla) y sustituye a la anterior; cada regla visible cambia lo que toca;
   «Sin Lugar» lo retira. En escritorio, en móvil y con movimiento reducido. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesLugares,cartasLugares} from './lugares-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const js=fs.readFileSync(path.join(juego,'campo-lugar.js'),'utf8');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-lugares-'));
try{
  const destino=path.join(temporal,'lugares'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','lugares.js','lugares.css','generado/datos.js',...componentesLugares.map(f=>'juego/'+f),...cartasLugares.map(id=>'art/'+id+'.webp')].sort();
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
const url='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/lugares.html';
let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [ancho,alto,movimiento]of [[1180,900,'no-preference'],[390,844,'no-preference'],[1180,900,'reduce']]){
    const contexto=await navegador.newContext({viewport:{width:ancho,height:alto},reducedMotion:movimiento}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=ancho+'×'+alto+(movimiento==='reduce'?' · movimiento reducido':'');
    try{
      await pagina.goto(url);
      await pagina.waitForFunction(()=>/Listo/.test(document.getElementById('lugaresEstado').textContent),null,{timeout:30000});
      const libre=()=>pagina.waitForFunction(()=>!document.querySelector('button[data-lugar]').disabled,null,{timeout:20000});
      const escena=()=>pagina.evaluate(()=>{const e=[...document.querySelectorAll('#mesaLugar > .clEscena')],u=e.at(-1);if(!u)return {n:0};
        const c=u.querySelector('.clAmbiente'),s=u.querySelector('.clSuelo'),pix=k=>{const d=k.getContext('2d').getImageData(0,0,k.width,k.height).data;let n=0;for(let i=3;i<d.length;i+=97)if(d[i])n++;return n;};
        const lado=u.querySelector('.clLado'),r=lado.getBoundingClientRect(),m=document.getElementById('mesaLugar').getBoundingClientRect();
        return {n:e.length,id:u.dataset.escena,host:document.getElementById('mesaLugar').dataset.campoLugar,fondo:getComputedStyle(u.querySelector('.clFondo')).backgroundImage,ambiente:pix(c),suelo:pix(s),clip:u.style.clipPath,
          lado:getComputedStyle(lado).display!=='none'?(r.top-m.top<2?'arriba':'abajo'):'ninguno'};});
      let anterior=null;
      for(const id of ['tomsage','antro','puente','montanas','domo']){
        await pagina.click('[data-lugar="'+id+'"]');
        if(anterior&&movimiento!=='reduce'){await pagina.waitForFunction(()=>document.querySelectorAll('#mesaLugar > .clEscena').length===2,null,{timeout:3000});}
        await libre();await pagina.waitForTimeout(250);
        const e=await escena();
        assert.equal(e.n,1,caso+': '+id+' sustituye a la escena anterior');
        assert.ok(e.id===id&&e.host===id,caso+': '+id+' en la mesa');
        assert.match(e.fondo,new RegExp('art/'+id+'\\.webp'),caso+': '+id+' usa su ilustración de fondo');
        assert.ok(e.suelo>50&&e.ambiente>0,caso+': '+id+' pinta suelo y ambiente ('+e.suelo+', '+e.ambiente+')');
        assert.ok(e.clip===''&&e.lado==='abajo',caso+': '+id+' abierto del todo, con el borde de tu lado');
        anterior=id;
      }
      assert.ok(await pagina.evaluate(()=>new Promise(r=>{const i=new Image();i.onload=()=>r(i.naturalWidth>0);i.onerror=()=>r(false);i.src='./art/domo.webp';})),caso+': la ilustración carga');
      await pagina.check('#delRival');await pagina.waitForTimeout(150);
      assert.equal((await escena()).lado,'arriba',caso+': el borde pasa al lado del rival');
      await pagina.uncheck('#delRival');
      const marc=()=>pagina.evaluate(()=>({almaR:+document.querySelector('#almaRival b').textContent,pd:document.querySelectorAll('#pdPropio i:not([data-apagado])').length,mano:+document.querySelector('#mano b').textContent,aidman:!!document.querySelector('#c-aidman canvas')}));
      const regla=async(lugar,r)=>{await pagina.click('[data-lugar="'+lugar+'"]');await libre();await pagina.click('[data-regla="'+r+'"]');await libre();
        assert.equal(await pagina.evaluate(()=>{const c=document.querySelector('.clEfectos'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=61)if(d[i])return 1;return 0;}),0,caso+': '+r+' limpia la capa de efectos');
        return marc();};
      let m=await regla('tomsage','pd');assert.equal(m.pd,5,caso+': Tomsage apaga 1 PD máximo');
      m=await regla('antro','robar');assert.ok(m.pd===3&&m.mano===5,caso+': en el Antro pagas 2 PD y robas');
      m=await regla('puente','nopasa');assert.equal(m.almaR,20,caso+': con 5 el ataque no pasa el Puente');
      m=await regla('puente','pasa');assert.equal(m.almaR,16,caso+': con 14 el ataque pasa');
      m=await regla('montanas','nadie');assert.equal(m.aidman,false,caso+': con 12 no aparece nadie');
      m=await regla('montanas','aidman');assert.equal(m.aidman,true,caso+': con 2 aparece Aidman');
      m=await regla('domo','muerte');assert.ok(m.almaR===15&&m.pd===4,caso+': en el Domo la muerte quita 1 Alma y da 1 PD');
      await pagina.click('[data-lugar=""]');await libre();
      assert.equal((await escena()).n,0,caso+': «Sin Lugar» retira la escena');
      assert.deepEqual(errores,[],caso+': sin errores de página');
      console.log('✓ '+caso+': cinco escenarios que se sustituyen, borde de cada lado, siete reglas visibles y sin Lugar');
    }finally{await contexto.close();}
  }
}finally{await navegador?.close();servidor.close();}

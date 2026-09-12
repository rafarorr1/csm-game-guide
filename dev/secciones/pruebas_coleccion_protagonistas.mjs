/* Retratos de Colección: geometría real, tres ediciones, aislamiento de VS
   y apertura de cinco Protagonistas. No carga una partida ni publica. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {crearServidor} from './servidor.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();
await new Promise((resolve,reject)=>{servidor.once('error',reject);servidor.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/coleccion.html';
const capturas=process.argv.includes('--capturas')?path.resolve(process.argv[process.argv.indexOf('--capturas')+1]):null;
if(capturas)fs.mkdirSync(capturas,{recursive:true});

async function comprobarCarta(carta){
  const g=await carta.evaluate(n=>{
    const r=n.getBoundingClientRect(),cara=n.querySelector('.lface').getBoundingClientRect(),marco=n.querySelector('.marcoDibujo').getBoundingClientRect(),img=n.querySelector('img'),imagen=img.getBoundingClientRect(),nombre=n.querySelector('.lname'),arquetipo=n.querySelector('.larch');
    const pie=n.parentElement.querySelector('.coleccionCopias,.coleccionCantidadEdicion'),p=pie.getBoundingClientRect();
    const igual=b=>['top','left','right','bottom'].every(k=>Math.abs(r[k]-b[k])<2);
    const visible=e=>{const b=e.getBoundingClientRect(),css=getComputedStyle(e);return b.width>0&&b.height>0&&b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1&&css.display!=='none'&&css.visibility==='visible'&&css.opacity==='1'&&e.textContent.trim().length>0&&e.scrollWidth<=e.clientWidth+1;};
    return {llena:igual(cara)&&igual(marco),cubre:imagen.left<=r.left+2&&imagen.top<=r.top+2&&imagen.right>=r.right-2&&imagen.bottom>=r.bottom-2,
      nombre:visible(nombre),arquetipo:visible(arquetipo),alPie:nombre.getBoundingClientRect().top>r.top+r.height*.6,
      cantidad:pie.textContent,contador:p.width>0&&p.height>0&&p.top>=r.bottom-1&&p.bottom<=innerHeight&&p.left>=0&&p.right<=innerWidth,cargada:img.complete&&img.naturalWidth>0};
  });
  assert.ok(g.llena&&g.cubre&&g.cargada,'El retrato y su marco llenan los límites de la carta');
  assert.ok(g.nombre&&g.arquetipo&&g.alPie,'Nombre y arquetipo se leen completos sobre la banda al pie');
  assert.ok(g.contador&&/3|1 copia/.test(g.cantidad),'La cantidad sigue visible debajo de la carta');
}

let navegador;
try{
  navegador=await chromium.launch({channel:'chrome',headless:true});
  for(const [vista,width,height]of [['desktop',1440,900],['movil',390,844],['movil',320,568]]){
    const contexto=await navegador.newContext({viewport:{width,height},reducedMotion:'reduce'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    try{
      for(const acabado of ['normal','foil','dorado']){
        await pagina.goto(base+'?vista='+vista+'&estado=muestrario&acabado='+acabado);
        const lideres=pagina.locator('.coleccionMini[data-carta^="lider_"]');await lideres.first().waitFor();
        await lideres.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
        assert.equal(await lideres.count(),6);
        for(const n of await lideres.all()){await n.scrollIntoViewIfNeeded();await comprobarCarta(n.locator('.coleccionCarta'));}
        await lideres.first().scrollIntoViewIfNeeded();
        if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-'+acabado+'-lista.png')});
        await pagina.locator('.coleccionMini[data-carta="lider_fender"]').click();
        for(const a of ['normal','foil','dorado']){
          await pagina.locator('[data-edicion="'+a+'"] .coleccionElegirAcabado').click();
          const carta=pagina.locator('[data-edicion="'+a+'"] .coleccionCarta');await carta.locator('img').evaluate(img=>img.decode());
          await comprobarCarta(carta);
        }
        if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-'+acabado+'-detalle.png')});
      }
      const vs=await pagina.evaluate(()=>{
        const capa=document.createElement('div');capa.className='vs';capa.style.cssText='display:block;position:fixed;inset:0;visibility:hidden';
        const carta=cartaDeLiderVS('fender','izq');capa.append(carta);document.body.append(capa);
        const css=document.querySelector('link[href*="coleccion.css"]');
        const medir=()=>{const c=getComputedStyle(carta),f=getComputedStyle(carta.querySelector('.lface')),n=getComputedStyle(carta.querySelector('.lname')),a=getComputedStyle(carta.querySelector('.larch'));return [c.position,c.display,c.width,c.height,f.position,f.height,n.position,n.top,a.position,a.padding];};
        const con=medir();css.disabled=true;const sin=medir();css.disabled=false;capa.remove();return {con,sin};
      });
      assert.deepEqual(vs.con,vs.sin,'La hoja de Colección no modifica la tarjeta de VS fuera del panel');

      // El pendiente real atraviesa la integración de Colección y reutiliza sus
      // cinco frentes. Las reglas del sobre deben seguir prevaleciendo.
      await pagina.locator('.coleccionCerrar').click();
      await pagina.evaluate(()=>{
        const m=CAOZ_COLECCION,s=m.leer();s.pendiente={id:'qa_cinco_protagonistas',creado:1,cartas:['fender','adreida','gero','rafaela','mohamed'].map(id=>({id:'lider_'+id,acabado:'foil',nueva:false}))};
        localStorage.setItem(m.clave,JSON.stringify(s));abrirColeccion();
      });
      await pagina.locator('.sobresApertura[data-fase="sellado"]').waitFor();
      await pagina.locator('.sobresAccion').click();await pagina.locator('.sobresApertura[data-fase="pila"]').waitFor();
      const medirSobre=()=>pagina.locator('.sobresPila .coleccionCartaSobre').evaluate(n=>{
        const r=n.getBoundingClientRect(),l=n.querySelector('.lname'),b=l.getBoundingClientRect(),img=n.querySelector('img');
        return {clase:n.classList.contains('coleccionCarta'),fit:getComputedStyle(img).objectFit,transform:getComputedStyle(img).transform,arquetipo:getComputedStyle(n.querySelector('.larch')).display,nombre:l.textContent,dentro:b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom,proporcion:r.width/r.height};
      });
      for(let i=0;i<5;i++){
        await pagina.locator('.sobresAccion').click();await pagina.locator('.sobresApertura[data-fase="'+(i===4?'ultima':'pila')+'"]').waitFor();
        const g=await medirSobre();assert.ok(!g.clase&&g.dentro&&g.nombre);assert.equal(g.fit,'contain');assert.equal(g.transform,'none');assert.equal(g.arquetipo,'none');assert.ok(Math.abs(g.proporcion-5/7)<.01);
      }
      assert.equal(await pagina.locator('.sobresResumen').isVisible(),false,'La quinta espera un toque adicional');
      if(capturas)await pagina.screenshot({path:path.join(capturas,vista+'-'+width+'-sobre.png')});
      await pagina.locator('.sobresAccion').click();await pagina.locator('.sobresApertura[data-fase="terminado"]').waitFor();
      assert.equal(await pagina.locator('.sobresResumen .coleccionCartaSobre.vscard').count(),5);
      assert.ok(await pagina.locator('.sobresResumen .lname').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().width>0)));
      await pagina.locator('.sobresAccion').click();await pagina.locator('.coleccionAbrirSobre').waitFor();
      assert.equal(await pagina.evaluate(()=>CAOZ_COLECCION.pendiente()),null);
      assert.deepEqual(errores,[]);console.log('✓ '+vista+' '+width+'×'+height+': retratos completos, nombres, cantidades, tres ediciones, VS intacto y sobre de Protagonistas');
    }finally{await contexto.close();}
  }
  // Quitar sólo la corrección del retrato debe reproducir el vacío de escritorio.
  const contexto=await navegador.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),pagina=await contexto.newPage();
  try{
    await pagina.route('**/juego/coleccion.css',async ruta=>{const respuesta=await ruta.fetch(),css=await respuesta.text();assert.match(css,/#coleccionPanel \.coleccionCarta\.vscard \.lface\{/);await ruta.fulfill({response:respuesta,body:css.replace(/#coleccionPanel \.coleccionCarta\.vscard \.lface\{[^}]+\}/,'')});});
    await pagina.goto(base+'?vista=desktop&estado=muestrario&acabado=foil');
    const carta=pagina.locator('.coleccionMini[data-carta="lider_fender"] .coleccionCarta');await carta.waitFor();await carta.locator('img').evaluate(img=>img.decode());
    await assert.rejects(()=>comprobarCarta(carta),/El retrato y su marco llenan/);console.log('✓ Sabotaje detectado: retirar la corrección vuelve a dejar media tarjeta vacía');
  }finally{await contexto.close();}
}finally{await navegador?.close();await new Promise(resolve=>servidor.close(resolve));}

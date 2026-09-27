/* Pruebas de las pruebas de Pitágoras en 3D (pitagoras-mundo-3d.js y un módulo
   por prueba) en su sección aislada. Para cada prueba: el pintor 3D se activa
   con WebGL, carga el arte dorado y dibuja su mundo (no un lienzo negro, con su
   color); no toca el modelo (la misma semilla da el mismo estado con el pintor
   3D y el clásico); el puntero se traduce al suelo en el sitio correcto; la
   cámara nunca deja al héroe fuera de la pantalla, ni en las esquinas; la
   prueba real se abre con él, a resolución completa; y con movimiento
   reducido sigue el pintor anterior. Usa Playwright. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportar,componentesPesadillas3d,recursosPesadillas3d,pruebasPesadillas3d} from './pesadillas-3d-exportar.mjs';
import {crearServidor} from './servidor.mjs';
import {juego,hash} from './fuentes.mjs';

const modulos=componentesPesadillas3d.filter(f=>/-3d\.js$/.test(f));
const js=modulos.map(f=>fs.readFileSync(path.join(juego,f),'utf8')).join('\n');
assert.ok(!/\.finished\b/.test(js)&&!/preserve-3d/.test(js),'Sin Animation.finished ni preserve-3d');
assert.ok(!/\b(?:modelo|m)\.[a-zA-Z]+\s*=[^=]/.test(js),'Los pintores no escriben en el modelo');
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'caoz-pesadillas3d-'));
try{
  const destino=path.join(temporal,'pesadillas-3d'),p=exportar(destino);
  const esperados=['index.html','_headers','procedencia.json','pesadillas-3d-mesa.js','pesadillas-3d-mesa.css','generado/datos.js',...componentesPesadillas3d.map(f=>'juego/'+f),...recursosPesadillas3d.map(r=>'juego/'+r)].sort();
  const archivos=fs.readdirSync(destino,{recursive:true}).filter(f=>fs.statSync(path.join(destino,f)).isFile()).sort();
  assert.deepEqual(archivos,esperados,'La revisión sólo publica sus dependencias');
  const html=fs.readFileSync(path.join(destino,'index.html'),'utf8');
  for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(fs.existsSync(path.join(destino,m[1])),m[1]);
  const orden=['pitagoras-pixel.js','pitagoras-mundo-3d.js',...modulos.filter(f=>f!=='pitagoras-mundo-3d.js')].map(f=>html.indexOf(f));
  assert.ok(orden.every((x,i)=>x>0&&(i===0||x>orden[i-1])),'El motor 3D se carga después del pintor clásico y antes de cada prueba');
  for(const [f,firma]of Object.entries(p.componentes))assert.equal(hash(fs.readFileSync(path.join(destino,'juego',f))),firma,f+' conserva su fuente');
  assert.equal(p.partida,false);assert.throws(()=>exportar(destino),/vacío/);
  console.log('✓ Exportación con sus dependencias declaradas');
}finally{fs.rmSync(temporal,{recursive:true,force:true});}

// El color que distingue cada mundo: losas verdes en La cosecha, lapislázuli en El corte final.
const COLOR={isometrico:['losas verdes',d=>d[1]>d[0]&&d[1]>d[2]*.95,.12],laseres:['lapislázuli',d=>d[2]>d[0]*1.25&&d[2]>d[1]*1.15,.2],fps:['lapislázuli y verde del archivo',d=>d[2]>d[0]*1.2||(d[1]>d[0]*1.1&&d[1]>=d[2]),.2],carrera:['cielo de lapislázuli y carriles de color',d=>d[2]>d[0]*1.2||d[0]>d[2]*1.6,.2],orbital:['lapislázuli del cielo y morado del dragón',d=>d[2]>d[0]*1.15&&d[2]>d[1]*1.1,.25]};
// Puntos del suelo para el puntero, delante de la cámara de cada prueba.
const PUNTOS={carrera:[[0,0],[1,-5],[-1,-12],[.5,-3]],orbital:[[0,-14],[6,-12],[-8,-20],[3,-30]]};
// En primera persona la cámara es el jugador: no hay encuadre del héroe ni puntero sobre el suelo.
const PRIMERA_PERSONA=new Set(['fps']);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const servidor=crearServidor();await new Promise((ok,mal)=>{servidor.once('error',mal);servidor.listen(0,'127.0.0.1',ok);});
const base='http://127.0.0.1:'+servidor.address().port+'/dev/secciones/pesadillas-3d.html';
let navegador;
try{
  navegador=await chromium.launch({headless:true});
  for(const tipo of Object.keys(pruebasPesadillas3d))for(const [ancho,alto]of [[1280,800],[390,700],[844,390]]){
    const pagina=await navegador.newPage({viewport:{width:ancho,height:alto}}),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));pagina.on('console',m=>{if(m.type()==='error')errores.push(m.text());});
    const caso=tipo+' '+ancho+'×'+alto;
    await pagina.goto(base+'?captura=1&prueba='+tipo);await pagina.waitForFunction(()=>window.CAOZ_PESADILLAS3D_REVISION,null,{timeout:60000});
    await pagina.evaluate(()=>CAOZ_PESADILLAS3D_REVISION.irA(.1));
    await pagina.waitForFunction(()=>CAOZ_PESADILLAS3D_REVISION.estado().arte,null,{timeout:30000});
    const e3=await pagina.evaluate(()=>CAOZ_PESADILLAS3D_REVISION.irA(9,20));
    assert.equal(e3.activo3d,true,caso+': el pintor 3D está activo');
    // La imagen: el mundo tiene luz y el color de su carta (no negro).
    const [nombre,esColor,minimo]=COLOR[tipo];
    const px=await pagina.evaluate(fn=>{const c=document.getElementById('lienzo'),g=document.createElement('canvas');g.width=64;g.height=40;const x=g.getContext('2d');x.drawImage(c,0,0,64,40);const d=x.getImageData(0,0,64,40).data,f=new Function('return '+fn)();
      let luz=0,color=0;for(let i=0;i<d.length;i+=4){luz+=(d[i]+d[i+1]+d[i+2])/3;if(f([d[i],d[i+1],d[i+2]]))color++;}return {luz:luz/(d.length/4),color:color/(d.length/4)};},esColor.toString());
    assert.ok(px.luz>25,caso+': el mundo se ve (luz media '+px.luz.toFixed(1)+')');
    assert.ok(px.color>minimo,caso+': '+nombre+' de la carta dorada ('+(px.color*100).toFixed(0)+'%)');
    if(!PRIMERA_PERSONA.has(tipo)){
    // El puntero: del suelo a la pantalla y de vuelta al mismo punto.
    const ida=await pagina.evaluate(P=>{const R=CAOZ_PESADILLAS3D_REVISION,out=[];for(const [x,y] of P){const s=R.pantalla(x,y),g=R.proyectar(s.x,s.y);out.push([x,y,g.x,g.y]);}return out;},PUNTOS[tipo]||[[0,0],[3,-2],[-4.5,4],[5,5]]);
    for(const [x,y,gx,gy]of ida)assert.ok(Math.hypot(gx-x,gy-y)<.01,caso+': el puntero cae en el suelo donde apunta ('+x+','+y+' → '+gx.toFixed(3)+','+gy.toFixed(3)+')');
    }else{
      // Lo que está justo delante del jugador (a donde dispara) se ve en el centro de la retícula.
      for(const d of [2,4,7]){const r=await pagina.evaluate(d=>CAOZ_PESADILLAS3D_REVISION.delante(d),d);
        assert.ok(Math.abs(r.punto.x-r.ancho/2)<1.5,caso+': a '+d+' unidades delante, el disparo cae en el centro ('+r.punto.x.toFixed(1)+' de '+r.ancho+' px)');}
    }
    // El pintor no toca el modelo: la misma semilla con el pintor clásico da el mismo estado.
    const clasico=await pagina.evaluate(()=>{document.querySelector('[data-pintor="clasico"]').click();const e=CAOZ_PESADILLAS3D_REVISION.irA(9,20);document.querySelector('[data-pintor="3d"]').click();return e;});
    assert.deepEqual({...clasico,activo3d:true,arte:true},e3,caso+': el modelo evoluciona igual con los dos pintores');
    // El encuadre: en las cuatro esquinas de la arena el héroe queda dentro de la pantalla.
    if(tipo==='carrera')for(const c of [-1,0,1]){const r=await pagina.evaluate(c=>CAOZ_PESADILLAS3D_REVISION.carrilHeroe(c),c),fx=r.heroe.x/r.ancho,fy=r.heroe.y/r.alto,ly=r.lejos.y/r.alto;
      assert.ok(fx>.05&&fx<.95&&fy>.3&&fy<.92,caso+': el héroe en el carril '+c+' se ve ('+(fx*100).toFixed(0)+'%, '+(fy*100).toFixed(0)+'%)');
      assert.ok(ly>.08&&ly<fy-.15,caso+': lo que viene a 20 unidades se ve por delante del héroe ('+(ly*100).toFixed(0)+'%)');}
    else if(tipo==='orbital'){
      // El último asalto: el halo del dragón arriba, el guerrero de espaldas abajo y centrado; en apaisado, las alas enteras.
      const r=await pagina.evaluate(()=>CAOZ_PESADILLAS3D_REVISION.asalto()),X=p=>p.x/r.ancho,Y=p=>p.y/r.alto;
      assert.ok(Y(r.halo)>.02&&Y(r.halo)<.35&&Math.abs(X(r.halo)-.5)<.02,caso+': el halo del dragón arriba y centrado ('+(Y(r.halo)*100).toFixed(0)+'%)');
      assert.ok(Y(r.guerrero)>.5&&Y(r.guerrero)<.8&&Math.abs(X(r.guerrero)-.5)<.02,caso+': el guerrero, de espaldas abajo y en el centro ('+(Y(r.guerrero)*100).toFixed(0)+'%)');
      assert.ok(Y(r.pies)>Y(r.guerrero),caso+': el dragón se alza por encima del guerrero');
      if(ancho>alto)for(const k of ['alaIzq','alaDer'])assert.ok(X(r[k])>.02&&X(r[k])<.98&&Y(r[k])>.02,caso+': en apaisado se ve el ala entera ('+k+' '+(X(r[k])*100).toFixed(0)+'%)');
      if(ancho===1280){
        // Las reglas: cada ataque se evita con su esquiva, el golpe sólo sirve con el dragón aturdido, la contra y el derribo.
        const reglas=await pagina.evaluate(()=>{const API=PITAGORAS_PRUEBAS,M=API.modelo,out={};
          const duelo=(ataque,entrada)=>{const s=M.crear({tipo:'orbital',semilla:4});s.siguiente=Infinity;Object.assign(s.dragon,{estado:'aviso',ataque,desde:0,dur:.8,fase:0});
            M.paso(s,{},.55);M.paso(s,entrada,.4);M.paso(s,{},.3);return [s.vidas,s.dragon.estado];};
          for(const [a,e] of [['garra_izq','der'],['garra_izq','izq'],['garra_izq','agacha'],['garra_der','izq'],['fuego','agacha'],['fuego','der'],['mordisco','izq'],['mordisco','agacha'],['aplastar','der'],['aplastar','agacha']])
            out[a+'/'+e]=duelo(a,{mx:e==='izq'?-1:e==='der'?1:0,my:e==='agacha'?1:0});
          out['garra_izq/nada']=duelo('garra_izq',{});
          const golpe=estado=>{const s=M.crear({tipo:'orbital',semilla:4});s.siguiente=Infinity;Object.assign(s.dragon,{estado,ataque:'garra_izq',desde:0,dur:5});M.paso(s,{accion:true},.1);return [s.dragon.hp,s.juicioTexto,s.siguiente];};
          out.aturdido=golpe('aturdido');out.guardia=golpe('guardia');
          const contra=M.crear({tipo:'orbital',semilla:4});contra.siguiente=Infinity;Object.assign(contra.dragon,{estado:'aviso',ataque:'fuego',desde:0,dur:1});M.paso(contra,{},.2);M.paso(contra,{accion:true},.1);out.contra=[contra.dragon.hp,contra.dragon.estado,contra.juicioTexto];
          const tarde=M.crear({tipo:'orbital',semilla:4});tarde.siguiente=Infinity;Object.assign(tarde.dragon,{estado:'aviso',ataque:'fuego',desde:0,dur:1});M.paso(tarde,{},.8);M.paso(tarde,{accion:true},.1);out.tarde=[tarde.dragon.hp,tarde.dragon.estado];
          const ko=M.crear({tipo:'orbital',semilla:4});ko.siguiente=Infinity;Object.assign(ko.dragon,{estado:'aturdido',ataque:'garra_izq',desde:0,dur:5,hp:1});M.paso(ko,{accion:true},.1);const caido=ko.dragon.estado;M.paso(ko,{},3);out.ko=[caido,ko.dragon.estado,ko.dragon.hp,ko.derribos,ko.dragon.ritmo<1];
          const quieto=M.crear({tipo:'orbital',semilla:6});for(let i=0;i<1300&&!quieto.terminado;i++)M.paso(quieto,{},1/60);out.quieto=[quieto.terminado,quieto.sobrevivio,quieto.t];
          const machaca=M.crear({tipo:'orbital',semilla:6});for(let i=0;i<1300&&!machaca.terminado;i++)M.paso(machaca,{accion:i%6<3},1/60);out.machaca=[machaca.sobrevivio,machaca.t];
          const guia=M.crear({tipo:'orbital',semilla:1}),mem={};for(let i=0;i<1300&&!guia.terminado;i++)M.paso(guia,API.guiasPrueba.orbital(guia,mem),1/60);out.guia=[guia.sobrevivio,guia.vidas,guia.golpes,guia.derribos];
          return out;});
        for(const [k,ok] of Object.entries({'garra_izq/der':1,'garra_izq/izq':0,'garra_izq/agacha':0,'garra_der/izq':1,'fuego/agacha':1,'fuego/der':0,'mordisco/izq':1,'mordisco/agacha':0,'aplastar/der':1,'aplastar/agacha':0,'garra_izq/nada':0}))
          assert.deepEqual(reglas[k],ok?[3,'aturdido']:[2,'recupera'],'Asalto: '+k.replace('/',' con ')+(ok?' se esquiva y deja al dragón aturdido':' no se esquiva: cuesta una vida'));
        assert.deepEqual(reglas.aturdido.slice(0,2),[9,'¡TOMA!'],'Asalto: golpear al dragón aturdido le quita vida');
        assert.ok(reglas.guardia[0]===10&&reglas.guardia[1]==='BLOQUEA'&&reglas.guardia[2]<1,'Asalto: golpear su guardia no hace daño y adelanta su ataque');
        assert.deepEqual(reglas.contra,[8,'aturdido','¡CONTRA!'],'Asalto: golpear mientras carga el fuego lo interrumpe con doble daño');
        assert.deepEqual(reglas.tarde,[10,'aviso'],'Asalto: tarde, el fuego ya no se interrumpe');
        assert.deepEqual(reglas.ko,['derribado','guardia',10,1,true],'Asalto: a 0 de vida cae, se levanta entero y pelea más rápido');
        assert.ok(reglas.quieto[0]&&!reglas.quieto[1]&&reglas.quieto[2]<20,'Asalto: sin jugar se pierde antes de 20 s');
        assert.ok(!reglas.machaca[0],'Asalto: machacar el golpe no gana');
        assert.ok(reglas.guia[0]&&reglas.guia[1]===3&&reglas.guia[2]>=10&&reglas.guia[3]>=1,'Asalto: la guía gana leyendo al dragón ('+reglas.guia.join(', ')+')');
      }
    }
    else if(!PRIMERA_PERSONA.has(tipo))for(const [x,y] of [[-6.55,-6.55],[6.55,-6.55],[-6.55,6.55],[6.55,6.55]]){
      const r=await pagina.evaluate(([x,y])=>CAOZ_PESADILLAS3D_REVISION.mirarHeroe(x,y),[x,y]),fx=r.punto.x/r.ancho,fy=r.punto.y/r.alto;
      assert.ok(fx>.05&&fx<.95&&fy>.08&&fy<.92,caso+': el héroe en ('+x+','+y+') se ve ('+(fx*100).toFixed(0)+'%, '+(fy*100).toFixed(0)+'%)');}
    assert.deepEqual(errores,[],caso+': sin errores de página');
    console.log('✓ '+caso+': mundo 3D con el arte dorado, '+(PRIMERA_PERSONA.has(tipo)?'mira centrada':'puntero preciso, encuadre')+' y el modelo intacto');
    await pagina.close();
  }
  // La prueba real se abre con el pintor 3D a resolución completa; con movimiento reducido, el clásico.
  for(const tipo of Object.keys(pruebasPesadillas3d))for(const reducido of [false,true]){
    const contexto=await navegador.newContext({viewport:{width:1280,height:800},reducedMotion:reducido?'reduce':'no-preference'}),pagina=await contexto.newPage(),errores=[];
    pagina.on('pageerror',e=>errores.push(e.message));
    await pagina.goto(base+'?prueba='+tipo);await pagina.waitForFunction(()=>window.CAOZ_PESADILLAS3D_REVISION,null,{timeout:60000});
    await pagina.click('#jugar');await pagina.waitForSelector('.pitPrueba .ppPanel .ppBoton',{timeout:20000});await pagina.click('.pitPrueba .ppPanel .ppBoton');
    await pagina.waitForFunction(()=>PITAGORAS_PRUEBAS.estado?.fase==='jugando',null,{timeout:20000});await pagina.waitForTimeout(600);
    const r=await pagina.evaluate(()=>{const w=CAOZ_PESADILLAS3D_REVISION.mundo(),c=document.querySelector('.pitPrueba canvas.ppLienzo');return {activo:w.activo,ancho:w.ancho,css:c.getBoundingClientRect().width,render:getComputedStyle(c).imageRendering};});
    assert.equal(r.activo,!reducido,tipo+(reducido?': con movimiento reducido sigue el pintor clásico':': la prueba real usa el pintor 3D'));
    if(!reducido){assert.ok(r.ancho>=r.css*.95,tipo+': la prueba real se pinta a resolución completa ('+r.ancho+' px para '+Math.round(r.css)+' px de lienzo)');assert.notEqual(r.render,'pixelated',tipo+': el lienzo no se amplía como pixel art');}
    await pagina.evaluate(()=>PITAGORAS_PRUEBAS.cancelar());
    assert.deepEqual(errores,[],tipo+': sin errores al jugar');
    await contexto.close();
  }
  console.log('✓ Las pruebas reales se abren con el pintor 3D a resolución completa; con movimiento reducido, el clásico');
}finally{await navegador?.close();servidor.close();}

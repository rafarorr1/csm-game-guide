/* Mesa de campaña: geometría 3D proyectada en un lienzo, sin dependencias.
   El mapa y sus controles siguen siendo HTML accesible; este módulo sólo dibuja
   los materiales, la iluminación y las miniaturas. */
'use strict';
(function(){
  const css=document.createElement('style');css.textContent=`
    .campanaMesa.campanaMesa3d{padding:0;overflow:hidden;background:#171714;border:1px solid #aa875a55;box-shadow:inset 0 0 25px #0007,0 10px 30px #0005}
    .campanaLienzo3d{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    .campanaMesa3d .campanaTablero{position:absolute;inset:0;border:0;border-radius:0;background:none;box-shadow:none;transform:none;pointer-events:none}
    .campanaMesa3d .campanaGeografia,.campanaMesa3d .campanaCima,.campanaMesa3d .campanaNiebla,.campanaMesa3d .campanaNieblaRetirada{visibility:hidden}
    .campanaMesa3d .campanaPeon{width:30px;height:12px;translate:-50% 24px;filter:none}
    .campanaMesa3d .campanaPeonCuerpo,.campanaMesa3d .campanaPeonBase{visibility:hidden}
    .campanaTu{display:none}.campanaMesa3d .campanaTu{display:block;font:800 9px/1.2 var(--sans);letter-spacing:1px;color:#fff0b9;text-shadow:0 1px 3px #000,0 1px 6px #000;background:#29251bd4;border-radius:3px;padding:2px 4px}
    .campanaMesa3d .campanaRuta li{width:88px;height:54px;translate:-50% -65%}
    .campanaMesa3d .campanaRuta .lface{display:none}
    .campanaMesa3d .campanaEncuentro{height:100%;justify-content:flex-end;pointer-events:auto}
    .campanaMesa3d .campanaRuta b{margin:0;position:relative;top:10px;padding:4px 9px 4px 20px;border:1px solid #a4906788;border-radius:4px;background:linear-gradient(#3e3428f5,#241f19f5);box-shadow:0 3px 6px #0006;font:700 10px/1.2 var(--serif);color:#ecdbb7}
    .campanaMesa3d .campanaRuta .actual b{border-color:#e7c783;color:#ffe5a4;box-shadow:0 0 14px #dba95f3a,0 3px 6px #0006}
    .campanaMesa3d .campanaRuta .vencido b{color:#b9c1a6;border-color:#73816d}
    .campanaMesa3d .campanaRuta .campanaNumero{top:auto;bottom:-3px;left:9px;right:auto;width:13px;height:13px;font-size:8px;background:#af8e54;color:#181611;pointer-events:none}
    @media(min-width:900px) and (min-height:651px){#campanaPanel[data-vista="mapa"]{width:min(1000px,calc(100vw - 48px))}.campanaMesa3d .campanaRuta b{font-size:12px}}
  `;document.head.appendChild(css);
  const TAU=Math.PI*2;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normal=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const luz=normal([-3,7,5]);
  const tonos={mohamed:'#345c78',fender:'#923c34',talesin:'#b9b4a2',rafaela:'#667548',adreida:'#526878',gero:'#6e4167'};
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const tinta=(h,n)=>'rgb('+rgb(h).map(v=>Math.min(255,Math.max(0,Math.round(v*n)))).join(',')+')';
  function material(ancho,alto,papel){
    const c=document.createElement('canvas');c.width=ancho;c.height=alto;const g=c.getContext('2d');
    let semilla=47;const azar=()=>{semilla=(semilla*16807)%2147483647;return semilla/2147483647;};
    const fondo=g.createLinearGradient(0,0,ancho,alto);fondo.addColorStop(0,papel?'#b6c88b':'#6b4228');fondo.addColorStop(1,papel?'#72864c':'#302016');g.fillStyle=fondo;g.fillRect(0,0,ancho,alto);
    if(papel){
      for(let i=0;i<9000;i++){g.fillStyle=azar()>.5?'#47372109':'#fff7d20c';g.fillRect(azar()*ancho,azar()*alto,1+azar()*3,1+azar()*2);}
      g.strokeStyle='#635c4240';g.lineWidth=.7;
      for(let x=24;x<ancho;x+=42){g.beginPath();g.moveTo(x,0);g.lineTo(x,alto);g.stroke();}
      for(let y=24;y<alto;y+=42){g.beginPath();g.moveTo(0,y);g.lineTo(ancho,y);g.stroke();}
      // Cartografía dibujada a tinta: río, montañas, bosque y rosa de los vientos.
      g.strokeStyle='#496c6b75';g.lineWidth=4;g.beginPath();g.moveTo(80,0);g.bezierCurveTo(300,240,20,430,130,700);g.bezierCurveTo(240,880,40,1000,80,alto);g.stroke();
      for(let i=0;i<32;i++){const x=490+azar()*210,y=70+azar()*350;g.strokeStyle='#5b563a70';g.lineWidth=2;g.beginPath();g.moveTo(x-15,y+24);g.lineTo(x,y-15);g.lineTo(x+19,y+24);g.moveTo(x,y-15);g.lineTo(x+3,y+17);g.stroke();}
      for(let i=0;i<60;i++){const x=60+azar()*140,y=300+azar()*570;g.strokeStyle='#4e654e80';g.lineWidth=2;g.beginPath();g.moveTo(x,y+10);g.lineTo(x,y-12);g.moveTo(x-7,y+2);g.lineTo(x,y-9);g.lineTo(x+7,y+2);g.stroke();}
      g.strokeStyle='#6250368a';g.lineWidth=3;g.strokeRect(18,18,ancho-36,alto-36);g.lineWidth=1;g.strokeRect(24,24,ancho-48,alto-48);
      g.save();g.translate(ancho-85,alto-110);g.beginPath();g.arc(0,0,32,0,TAU);g.stroke();g.beginPath();g.moveTo(0,-44);g.lineTo(10,0);g.lineTo(0,44);g.lineTo(-10,0);g.closePath();g.fillStyle='#65533399';g.fill();g.font='20px Georgia';g.textAlign='center';g.fillText('N',0,-52);g.restore();
      g.fillStyle='#57482a90';g.textAlign='center';g.font='bold 36px Georgia';g.fillText('EL DOMO',ancho/2,92);g.font='italic 16px Georgia';g.fillText('Una historia por conquistar',ancho/2,122);
      const borde=g.createRadialGradient(ancho*.5,alto*.45,ancho*.2,ancho*.5,alto*.45,alto*.65);borde.addColorStop(0,'#3d210000');borde.addColorStop(1,'#3d210060');g.fillStyle=borde;g.fillRect(0,0,ancho,alto);
    }else{
      for(let y=0;y<alto;y+=3){g.beginPath();g.moveTo(0,y);g.bezierCurveTo(ancho*.3,y+azar()*15,ancho*.7,y-azar()*18,ancho,y+azar()*8);g.strokeStyle=azar()>.5?'#f4b57518':'#1e100d55';g.lineWidth=1+azar()*2;g.stroke();}
      for(let y=0;y<alto;y+=alto/5){g.fillStyle='#120d0ad0';g.fillRect(0,y,ancho,3);g.fillStyle='#b68b4c35';g.fillRect(0,y+3,ancho,1);}
    }
    return c;
  }
  let materiales=null;
  window.crearMesaCampana=function(contenedor,op){
    const canvas=document.createElement('canvas');canvas.className='campanaLienzo3d';canvas.setAttribute('aria-hidden','true');
    let ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;
    const bruma=document.createElement('canvas'),brumaCtx=bruma.getContext('2d');if(!brumaCtx)return null;
    const pantalla=ctx,fondo=document.createElement('canvas'),fondoCtx=fondo.getContext('2d',{alpha:false});if(!fondoCtx)return null;
    let baseSucia=true;
    const camara=contenedor.querySelector('.campanaCamara'),tablero=contenedor.querySelector('.campanaTablero');
    camara.prepend(canvas);contenedor.classList.add('campanaMesa3d');
    if(!materiales)materiales={papel:material(768,1152,true),madera:material(1024,768,false)};
    const {papel,madera}=materiales;
    let ancho=1,alto=1,largo=18,escala=1,cx=0,cy=0,raf=0,ultimo=0,vivo=true;
    let salto=null,posicionFija=null,derribo=null,derribado=false;
    let caras=[],sombras=[],llamas=[],dados=[];
    let avance=op.etapaAnterior===null||op.etapaAnterior===undefined?1:0;
    const inicio=performance.now();
    const yaw=.18,elev=.82,ce=Math.cos(elev),se=Math.sin(elev),distancia=32;
    const reducir=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
    function vista(v){const x=v[0]*Math.cos(yaw)-v[2]*Math.sin(yaw),z=v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw),d=distancia-v[1]*se-z*ce;return{x:x/d,y:(z*se-v[1]*ce)/d,d};}
    function proyectar(v){const p=vista(v);return{x:cx+p.x*escala,y:cy+p.y*escala,d:p.d};}
    function punto(p,y=0){return[(p[0]-50)*.087,y,(p[1]-50)*largo*.0079];}
    function cara(v,color,grupo=2){caras.push({v,color,grupo,n:normal(cruz(sub(v[1],v[0]),sub(v[2],v[0])))});}
    function caja(x,y,z,w,h,d,color,giro=0,grupo=2){
      const v=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(a=>{const xx=a[0]*w/2,zz=a[2]*d/2;return[x+xx*Math.cos(giro)-zz*Math.sin(giro),y+a[1]*h,z+xx*Math.sin(giro)+zz*Math.cos(giro)];});
      [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].forEach(f=>cara(f.map(i=>v[i]),color,grupo));
    }
    function cilindro(x,y,z,r,h,color,r2=r,n=14,grupo=2){
      const a=[],b=[];for(let i=0;i<n;i++){const t=i*TAU/n;a.push([x+Math.cos(t)*r,y,z+Math.sin(t)*r]);b.push([x+Math.cos(t)*r2,y+h,z+Math.sin(t)*r2]);}
      cara(b.slice().reverse(),color,grupo);
      for(let i=0;i<n;i++){const j=(i+1)%n;cara([a[i],b[i],b[j],a[j]],color,grupo);}
    }
    function esfera(x,y,z,r,color,sy=1){
      const n=10,m=6;for(let j=0;j<m;j++)for(let i=0;i<n;i++){
        const f=[];for(const [ii,jj] of [[i,j],[i+1,j],[i+1,j+1],[i,j+1]]){const a=ii*TAU/n,b=-Math.PI/2+jj*Math.PI/m;f.push([x+r*Math.cos(b)*Math.cos(a),y+r*Math.sin(b)*sy,z+r*Math.cos(b)*Math.sin(a)]);}cara(f,color);
      }
    }
    function miniatura(p,lider,jugador=false,vencido=false,caida=0){
      const comienzo=caras.length,[x,y,z]=p,c=vencido?'#62685d':tonos[lider]||'#596477';sombras.push([x+.16,z+.16,.65]);
      cilindro(x,y+.02,z,.43,.14,'#272927');cilindro(x,y+.16,z,.37,.09,jugador?'#b39756':vencido?'#67735c':'#776955');
      caja(x-.13,y+.25,z,.15,.17,.23,'#3b3530');caja(x+.13,y+.25,z,.15,.17,.23,'#3b3530');
      cilindro(x,y+.35,z,.29,.72,c,.14,10);cilindro(x,y+.93,z,.2,.2,c,.12,10);
      esfera(x,y+1.27,z,.24,vencido?'#89917e':'#c3ac8d',1.15);
      cilindro(x,y+.72,z,.295,.06,'#bda06a',.26,12);
      if(lider==='mohamed'||lider==='gero'){
        cilindro(x,y+1.43,z,.3,.04,c);cilindro(x,y+1.47,z,.24,.49,c,.015,10);
        cilindro(x+.4,y+.15,z,.035,1.65,'#766148',.028,8);esfera(x+.4,y+1.8,z,.12,'#9bc1bc');
      }else if(lider==='talesin'){
        for(const s of [-1,1])cara([[x+s*.1,y+.75,z-.08],[x+s*.66,y+1.5,z-.2],[x+s*.48,y+.7,z-.15]],'#c7c4ac');
        cilindro(x,y+1.49,z,.2,.025,'#c7aa55',.2,16);
      }else if(lider==='fender'){
        esfera(x+.21,y+.8,z+.24,.22,'#b49159',1.25);caja(x+.22,y+.95,z+.26,.065,.53,.07,'#65452e',-.2);
        esfera(x,y+1.43,z-.03,.19,'#48382d',.7);
      }else{
        caja(x+.35,y+.55,z,.05,.94,.09,'#bec1b2');caja(x+.35,y+.8,z,.28,.055,.1,'#ac9257');
        cara([[x-.41,y+.45,z+.08],[x-.66,y+.72,z+.12],[x-.61,y+1.12,z+.06],[x-.22,y+1.12,z+.06],[x-.2,y+.72,z+.12]],c);
        cilindro(x,y+1.35,z,.2,.21,'#a9b4b2',.12,10);
      }
      for(let i=comienzo;i<caras.length;i++){
        caras[i].v=caras[i].v.map(v=>{const dx=(v[0]-x)*1.08,dy=(v[1]-y)*1.22,a=caida*1.48*(x<0?-1:1);return[x+dx*Math.cos(a)+dy*Math.sin(a),y+.03-dx*Math.sin(a)+dy*Math.cos(a),z+(v[2]-z)*1.08];});
        const v=caras[i].v;caras[i].n=normal(cruz(sub(v[1],v[0]),sub(v[2],v[0])));
      }
    }
    function dado(x,y,z,r,color){
      const t=(1+Math.sqrt(5))/2;
      const v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(a=>{const q=normal(a);return[x+q[0]*r,y+r+q[1]*r,z+q[2]*r];});
      const f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
      f.forEach((a,i)=>{const q=a.map(k=>v[k]);cara(q,color);dados.push({v:q,n:normal(cruz(sub(q[1],q[0]),sub(q[2],q[0]))),texto:String(i===0?20:i)});});sombras.push([x+.2,z+.2,r*1.2]);
    }
    function vela(x,z,h){cilindro(x,.06,z,.46,.09,'#9d7b43');cilindro(x,.15,z,.3,h,'#d6c7a1');cilindro(x,h+.15,z,.22,.025,'#aa926e');caja(x,h+.17,z,.03,.15,.03,'#28201a');llamas.push([x,h+.43,z]);sombras.push([x+.2,z+.2,.6]);}
    function posicionJugador(){
      if(salto){const t=progresoSalto();return salto.desde.map((v,i)=>v+(salto.hasta[i]-v)*t);}
      if(derribo){const t=Math.min(1,(performance.now()-derribo.inicio)/1250),p=op.posicion,r=op.casillas[op.etapa],f=t<.28?t/.28:t<.52?1-(t-.28)/.24:0;return p.map((v,i)=>v+(r[i]-v)*f*.65);}
      if(posicionFija)return posicionFija;
      const ficha=etapa=>etapa>=6?[50,9]:op.esperas[etapa];
      const fin=op.posicion||ficha(op.etapa),r=op.etapaAnterior==null?null:op.casillas[op.etapaAnterior],desde=r?[r[0]+(r[0]<50?12:-12),r[1]+5]:fin;return fin.map((v,i)=>desde[i]+(v-desde[i])*avance);
    }
    function progresoSalto(){return salto?Math.min(1,Math.max(0,(performance.now()-salto.inicio)/900)):1;}
    function saltarHacia(etapa){
      if(salto)salto.terminar(false);
      const desde=posicionJugador(),rival=op.casillas[etapa],hasta=[rival[0]+(rival[0]<50?12:-12),rival[1]+5];
      let resolver,terminado=false,temporizador;
      const promesa=new Promise(r=>resolver=r);
      const terminar=ok=>{if(terminado)return;terminado=true;clearTimeout(temporizador);posicionFija=ok?hasta:desde;salto=null;baseSucia=true;escena();posiciones();dibujar(performance.now());resolver(ok);};
      salto={desde,hasta,inicio:performance.now(),terminar};
      if(reducir()||document.hidden)terminar(true);else{baseSucia=true;dibujar(performance.now());temporizador=setTimeout(()=>terminar(true),900);}
      return{promesa,cancelar:()=>terminar(false)};
    }
    function golpear(){
      if(derribo)return derribo.promesa;
      let resolver,timer,acabado=false;const promesa=new Promise(r=>resolver=r);
      const terminar=ok=>{if(acabado)return;acabado=true;clearTimeout(timer);derribo=null;derribado=ok;canvas.dataset.derribado=ok?String(op.etapa):'';baseSucia=true;if(vivo){escena();dibujar(performance.now());}resolver(ok);};
      derribo={inicio:performance.now(),promesa,terminar};
      if(reducir()||document.hidden)terminar(true);else{dibujar(performance.now());timer=setTimeout(()=>terminar(true),1250);}
      return promesa;
    }
    function reposar(){if(salto)salto.terminar(false);posicionFija=null;avance=1;baseSucia=true;escena();posiciones();dibujar(performance.now());}
    function escena(){
      caras=[];sombras=[];llamas=[];dados=[];
      caja(0,-.73,0,12.4,.55,largo+2,'#3f2b20',0,0);caja(0,-.18,0,12.65,.19,largo+2.1,'#725031',0,0);
      // El reborde y los herrajes hacen visible el espesor de la mesa.
      for(const x of [-6.1,6.1])caja(x,-.08,0,.1,.12,largo+1.8,'#a1834d',0,0);
      for(const z of [-largo/2-.85,largo/2+.85])caja(0,-.08,z,12.2,.12,.1,'#a1834d',0,0);
      caja(0,.018,0,9.1,.06,largo*.83,'#806744',-.012,0);
      // Diario con hojas, tapas gruesas y un broche metálico.
      const bz=largo*.31;
      caja(4.94,.06,bz,1.6,.12,2.35,'#362b27',-.18);caja(4.94,.18,bz,1.42,.19,2.15,'#b4a17a',-.18);caja(4.94,.37,bz,1.6,.12,2.35,'#533b31',-.18);caja(4.94,.5,bz,.24,.02,1.8,'#a4894e',-.18);sombras.push([5.1,bz+.2,1.1]);
      dado(-5.1,.04,largo*.31,.62,'#793e38');dado(-4.95,.04,largo*.42,.34,'#496967');
      dado(5.13,.04,-largo*.13,.44,'#a58746');
      vela(-5.12,-largo*.29,.9);vela(-4.84,-largo*.4,.54);vela(5.2,-largo*.38,1.13);
      // Piezas de terreno que parecen colocadas sobre el pergamino.
      for(let i=0;i<5;i++){const x=-3.4+(i%2)*.45,z=-largo*.22+i*.62;cilindro(x,.11,z,.36,.09,'#666149');cilindro(x,.2,z,.035,.52,'#63523a',.03,7);esfera(x,.96,z,.55,'#66884a',1.15);esfera(x-.18,1.12,z-.09,.4,'#82a85b');}
      for(let i=0;i<3;i++){const x=3.15+(i%2)*.5,z=-largo*.28+i*.75;cilindro(x,.08,z,.38,.08,'#8b8064');cilindro(x,.16,z,.45,.9+i*.1,'#8e9388',.045,5);}
      // Sólo se construyen miniaturas de rivales ya descubiertos.
      op.casillas.forEach((p,i)=>{if(i<=op.etapa)miniatura(punto(p,.09),['mohamed','fender','talesin','rafaela','adreida','gero'][i],false,i<op.etapa,i<op.etapa||derribado&&i===op.etapa?1:derribo&&i===op.etapa?Math.min(1,Math.max(0,((performance.now()-derribo.inicio)/1250-.25)/.5)):0);});
      const altura=salto?Math.abs(Math.sin(progresoSalto()*Math.PI*3))*.8:avance<1?Math.abs(Math.sin(avance*Math.PI*4))*.25:0;
      miniatura(punto(posicionJugador(),.09+altura),op.lider,true);
      canvas.dataset.miniaturas=String(Math.min(6,op.etapa+1)+1);
    }
    function poligono(v){ctx.beginPath();v.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();}
    function textura(img,x0,x1,z0,z1,y,nx=3,nz=8){
      function triangulo(a,b,c,aa,bb,cc){
        ctx.save();poligono([a,b,c]);ctx.clip();const u1=bb[0]-aa[0],v1=bb[1]-aa[1],u2=cc[0]-aa[0],v2=cc[1]-aa[1],det=u1*v2-u2*v1;
        const A=((b.x-a.x)*v2-(c.x-a.x)*v1)/det,B=((b.y-a.y)*v2-(c.y-a.y)*v1)/det,C=((c.x-a.x)*u1-(b.x-a.x)*u2)/det,D=((c.y-a.y)*u1-(b.y-a.y)*u2)/det;
        ctx.transform(A,B,C,D,a.x-A*aa[0]-C*aa[1],a.y-B*aa[0]-D*aa[1]);ctx.drawImage(img,0,0);ctx.restore();
      }
      for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
        const uv=[[i/nx,j/nz],[(i+1)/nx,j/nz],[(i+1)/nx,(j+1)/nz],[i/nx,(j+1)/nz]],q=uv.map(p=>proyectar([x0+(x1-x0)*p[0],y,z0+(z1-z0)*p[1]])),t=uv.map(p=>[p[0]*img.width,p[1]*img.height]);
        triangulo(q[0],q[1],q[2],t[0],t[1],t[2]);triangulo(q[0],q[2],q[3],t[0],t[2],t[3]);
      }
    }
    function disco(x,z,r,color,y=.105){
      const a=proyectar([x,y,z]),b=proyectar([x+r,y,z]),c=proyectar([x,y,z+r]);ctx.save();ctx.transform(b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y);
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.restore();
    }
    function pintarCaras(grupo){
      const lista=caras.filter(c=>c.grupo===grupo).map(c=>({...c,p:c.v.map(proyectar)})).sort((a,b)=>b.p.reduce((s,p)=>s+p.d,0)/b.p.length-a.p.reduce((s,p)=>s+p.d,0)/a.p.length);
      for(const c of lista){const l=.62+.42*Math.abs(c.n.reduce((s,v,i)=>s+v*luz[i],0));ctx.fillStyle=tinta(c.color,l);poligono(c.p);ctx.fill();ctx.strokeStyle='#19130d24';ctx.lineWidth=.35;ctx.stroke();}
    }
    function niebla(t){
      if(op.etapa>=5&&avance>=1)return;
      const fin=op.etapa>=5?0:op.casillas[op.etapa][1]-5,antes=op.etapaAnterior==null?fin:op.casillas[Math.min(5,op.etapaAnterior)][1]-5;
      const limite=antes+(fin-antes)*avance;
      const destino=ctx;ctx=brumaCtx;ctx.clearRect(0,0,ancho,alto);
      // Una bruma baja sobre el terreno, sin cubrir los objetos del borde de la mesa.
      for(let j=0;j<12;j++)for(let i=0;i<6;i++){
        const yy=3+j*7;if(yy>limite)continue;
        const p=punto([8+i*16,yy],.2),q=proyectar(p),r=proyectar([p[0]+1.3,p[1],p[2]]),radio=Math.max(1,Math.abs(r.x-q.x));
        const fl=reducir()?0:Math.sin(t*.00018+j+i)*4;const g=ctx.createRadialGradient(q.x+fl,q.y,0,q.x+fl,q.y,radio*1.6);g.addColorStop(0,'#b9c0b991');g.addColorStop(1,'#aab4aa00');ctx.fillStyle=g;ctx.fillRect(q.x-radio*1.7+fl,q.y-radio*1.7,radio*3.4,radio*3.4);
      }
      // Abertura suave que despeja cuerpo, cabeza y ficha del jugador.
      ctx.globalCompositeOperation='destination-out';
      const claros=[...op.casillas.filter((_,i)=>i<=op.etapa),posicionJugador()];
      claros.forEach(p=>{const a=proyectar(punto(p,.05)),b=proyectar(punto(p,2.6)),r=Math.abs(escala/a.d)*1.5;ctx.save();ctx.translate(a.x,(a.y+b.y)/2);ctx.scale(r,Math.abs(a.y-b.y)/2+r*.7);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#000');g.addColorStop(.72,'#000');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();});
      ctx.globalCompositeOperation='source-over';ctx=destino;ctx.drawImage(bruma,0,0,ancho,alto);
    }
    function posiciones(){
      op.casillas.forEach((p,i)=>{const n=tablero.querySelector('[data-etapa="'+i+'"]');if(!n)return;const q=proyectar(punto(p,.12));n.style.left=q.x/ancho*100+'%';n.style.top=q.y/alto*100+'%';});
      const peon=tablero.querySelector('.campanaPeon'),q=proyectar(punto(posicionJugador(),.1));if(peon){peon.style.left=q.x/ancho*100+'%';peon.style.top=q.y/alto*100+'%';}
    }
    function dibujar(t=0){
      if(!vivo)return;
      const estabaAvanzando=avance<1;
      if(avance<1){baseSucia=true;avance=reducir()?1:Math.min(1,Math.max(0,(performance.now()-inicio)/1100));escena();}
      if(salto||derribo){baseSucia=true;escena();}
      canvas.dataset.avanzando=avance<1?'1':'0';
      canvas.dataset.saltando=salto?'1':'0';canvas.dataset.derribando=derribo?'1':'0';
      if(baseSucia||avance<1){
      ctx=fondoCtx;
      const g=ctx.createRadialGradient(ancho*.25,alto*.2,2,ancho*.5,alto*.5,Math.max(ancho,alto)*.75);g.addColorStop(0,'#594330');g.addColorStop(1,'#0e1110');ctx.fillStyle=g;ctx.fillRect(0,0,ancho,alto);
      ctx.save();ctx.shadowColor='#000b';ctx.shadowBlur=25;ctx.shadowOffsetY=17;poligono([[-6.3,0,-largo/2-1],[6.3,0,-largo/2-1],[6.3,0,largo/2+1],[-6.3,0,largo/2+1]].map(proyectar));ctx.fillStyle='#291c13';ctx.fill();ctx.restore();
      pintarCaras(0);textura(madera,-6.2,6.2,-largo/2-1,largo/2+1,.013,3,8);textura(papel,-4.5,4.5,-largo*.41,largo*.41,.09,4,12);
      const camino=op.casillas.map(p=>proyectar(punto(p,.11)));ctx.beginPath();camino.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#6f513b90';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
      sombras.forEach(([x,z,r])=>{disco(x,z,r*1.3,'#201c1010');disco(x,z,r,'#1c190d30');disco(x-.08,z-.08,r*.6,'#1714093a');});
      if(op.etapa<6){const p=punto(op.casillas[op.etapa]);disco(p[0],p[2],.75,'#d7b2663c');disco(p[0],p[2],.51,'#f6d48255');}
      pintarCaras(2);
      dados.forEach(d=>{const centro=d.v[0].map((v,i)=>(v+d.v[1][i]+d.v[2][i])/3);if(d.n[1]*se+d.n[2]*ce<.2)return;const q=proyectar(centro),a=proyectar(d.v[0]),b=proyectar(d.v[1]);const tam=Math.max(4,Math.min(15,Math.hypot(b.x-a.x,b.y-a.y)*.38));ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='#eee4c9';ctx.font='bold '+tam+'px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.texto,0,0);ctx.restore();});
      ctx=pantalla;baseSucia=false;
      }
      ctx.drawImage(fondo,0,0,ancho,alto);
      niebla(t);
      llamas.forEach((p,i)=>{const q=proyectar(p),h=Math.max(7,escala/q.d*.34),f=reducir()?1:1+Math.sin(t*.007+i)*.08;const luz=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,h*4);luz.addColorStop(0,'#ffd98250');luz.addColorStop(1,'#ff9b2500');ctx.fillStyle=luz;ctx.fillRect(q.x-h*4,q.y-h*4,h*8,h*8);ctx.fillStyle='#eaa348';ctx.beginPath();ctx.ellipse(q.x,q.y,h*.27,h*f,0,0,TAU);ctx.fill();ctx.fillStyle='#fff0be';ctx.beginPath();ctx.ellipse(q.x,q.y+h*.25,h*.15,h*.55,0,0,TAU);ctx.fill();});
      const sombra=ctx.createRadialGradient(ancho*.5,alto*.5,ancho*.25,ancho*.5,alto*.5,Math.max(ancho,alto)*.7);sombra.addColorStop(0,'#080a0800');sombra.addColorStop(1,'#080a085f');ctx.fillStyle=sombra;ctx.fillRect(0,0,ancho,alto);
      if(estabaAvanzando||salto||derribo)posiciones();canvas.dataset.lista='1';
    }
    function encuadrar(){
      const vertices=[[-6.4,0,-largo/2-1.2],[6.4,0,-largo/2-1.2],[6.4,-.7,largo/2+1.2],[-6.4,-.7,largo/2+1.2]].map(vista);
      const xs=vertices.map(p=>p.x),ys=vertices.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys)-.035,y1=Math.max(...ys);
      const disponible=alto;escala=Math.min(ancho*.96/(x1-x0),disponible*.97/(y1-y0))*1.18;cx=ancho/2-(x0+x1)*escala/2;cy=disponible/2-(y0+y1)*escala/2;
      // Mantener las dos piezas del encuentro dentro del encuadre al acercar.
      const puntos=[posicionJugador(),op.casillas[Math.min(5,op.etapa)]].flatMap(p=>[proyectar(punto(p,.1)),proyectar(punto(p,2.6))]);
      const minY=Math.min(...puntos.map(p=>p.y)),maxY=Math.max(...puntos.map(p=>p.y));cy+=Math.max(0,alto*.09-minY)-Math.max(0,maxY-alto*.89);
      posiciones();
    }
    function ajustar(){ancho=Math.max(1,camara.clientWidth);alto=Math.max(1,camara.clientHeight);const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(ancho*dpr);canvas.height=Math.round(alto*dpr);pantalla.setTransform(dpr,0,0,dpr,0,0);bruma.width=canvas.width;bruma.height=canvas.height;brumaCtx.setTransform(dpr,0,0,dpr,0,0);fondo.width=canvas.width;fondo.height=canvas.height;fondoCtx.setTransform(dpr,0,0,dpr,0,0);baseSucia=true;largo=Math.max(12,Math.min(24,15*alto/ancho));escena();encuadrar();dibujar();}
    const observador=new ResizeObserver(ajustar);observador.observe(camara);ajustar();
    function cuadro(t){if(!vivo||!canvas.isConnected)return;if(!document.hidden&&!reducir()&&t-ultimo>(salto||derribo||avance<1?28:65)){ultimo=t;dibujar(t);}raf=requestAnimationFrame(cuadro);}
    raf=requestAnimationFrame(cuadro);
    return{foco(i){const q=proyectar(punto(op.casillas[i],.5));return[q.x/ancho*100,q.y/alto*100];},saltarHacia,reposar,golpear,destruir(){vivo=false;if(derribo)derribo.terminar(false);if(salto)salto.terminar(false);cancelAnimationFrame(raf);observador.disconnect();canvas.remove();contenedor.classList.remove('campanaMesa3d');},get posicion(){return posicionJugador().slice();},get activa(){return vivo;}};
  };
})();

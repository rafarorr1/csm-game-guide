/* Animaciones de poderes y estados (prueba aislada, dev/secciones/poderes):
   Esporas e Infectado, la Polimorfia de Rulchete, Rayo de Escarcha y Collar de
   Agua, Poseído, la Ascensión de Talesyn, Aturdido y la Risa de Tasha, y las
   Llaves del Domo y el Pergamino de Deseo.
   Cada efecto recibe nodos del DOM y sólo dibuja: una capa Canvas 2D sobre la
   mesa (host) mientras dura, y los estados que duran (moho, escarcha, humo con
   ojos, pajaritos) en un lienzo dentro de la propia carta, que late con un
   reloj compartido. Los efectos devuelven una promesa: true si se animó,
   false si no (movimiento reducido, pestaña oculta); los estados se ponen
   igual, quietos. Sin dependencias; reloj propio (requestAnimationFrame). */
'use strict';
(function(){
  const TAU=Math.PI*2;
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const suave=t=>{t=acotar(t);return t*t*(3-2*t);};
  const salida=t=>1-Math.pow(1-acotar(t),3);
  const entre=(t,a,b)=>acotar((t-a)/(b-a));
  const campana=(t,a,b)=>Math.sin(Math.PI*entre(t,a,b));
  function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
  function ruido(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
  function fbm(x,y){let v=0,a=.5;for(let i=0;i<4;i++){v+=a*ruido(x,y);x=x*2.03+1.7;y=y*2.03+9.2;a*=.5;}return v;}
  const azar=semilla=>{let s=(semilla*2654435761)>>>0||1;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
  const TITULO="'Cinzel Domo','Cinzel',Georgia,serif";

  const dprDe=()=>Math.min(devicePixelRatio||1,2);
  function quieto(o={}){const q=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;return !!(o.reducir??q?.matches)||document.hidden;}
  function caja(nodo,host){const a=nodo.getBoundingClientRect(),b=host.getBoundingClientRect(),r={x:a.left-b.left,y:a.top-b.top,w:a.width,h:a.height};r.cx=r.x+r.w/2;r.cy=r.y+r.h/2;return r;}
  function redondo(g,x,y,w,h,r){g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h);}
  // Capa temporal sobre toda la mesa.
  function capa(host,z){
    const c=document.createElement('canvas');c.className='fxPoderesCapa';c.setAttribute('aria-hidden','true');
    c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;host.append(c);
    const r=host.getBoundingClientRect(),dpr=dprDe();c.width=Math.max(1,Math.round(r.width*dpr));c.height=Math.max(1,Math.round(r.height*dpr));
    const g=c.getContext('2d');
    return {c,g,W:r.width,H:r.height,limpiar(){g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,r.width,r.height);},quitar(){c.remove();}};
  }
  // Bucle de un efecto: tt en segundos del efecto (o el reloj de revisión);
  // termina cuando cuadro devuelve false, o por seguridad pasado el límite.
  function correr(o,cuadro,limite){
    const vel=o.velocidad||1;
    return new Promise(res=>{
      let t0=0,ant=-1,raf=0,fin=false;
      const acabar=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);clearTimeout(seguro);res(true);};
      const seguro=setTimeout(acabar,(limite+3)*1000/vel);
      function paso(ahora){
        raf=0;if(fin)return;if(!t0)t0=ahora;
        const tt=typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*vel,dt=ant<0?0:Math.min(.1,Math.max(0,tt-ant));ant=tt;
        let seguir=false;try{seguir=cuadro(tt,dt);}catch(e){console.error(e);}
        if(seguir===false||tt>limite+2){acabar();return;}
        raf=requestAnimationFrame(paso);
      }
      raf=requestAnimationFrame(paso);
    });
  }
  const sprites=new Map();
  // Mancha suave de un color (humo, nubes) o destello con centro blanco.
  function mancha(rgb,a,centro){
    const k=rgb+'|'+a+'|'+centro;if(sprites.has(k))return sprites.get(k);
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32),col=x=>'rgba('+rgb.join(',')+','+x+')';
    if(centro){d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.28,col(a));}else{d.addColorStop(0,col(a));d.addColorStop(.5,col(a*.55));}
    d.addColorStop(1,col(0));g.fillStyle=d;g.fillRect(0,0,64,64);sprites.set(k,c);return c;
  }
  const pintarSprite=(g,s,x,y,r,a=1)=>{if(a<=0||r<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(s,x-r,y-r,r*2,r*2);};

  /* ESTADOS QUE DURAN: un lienzo dentro de la carta (con margen para lo que
     sale por fuera), repintado por un reloj compartido mientras exista. */
  const estados=new Set();let rafEstados=0;
  const claveDe=t=>'fx'+t[0].toUpperCase()+t.slice(1);
  function ponerEstado(nodo,tipo,dibujar,margen=0,extra={}){
    quitarYa(nodo,tipo);
    const r=nodo.getBoundingClientRect(),w=r.width||nodo.offsetWidth,h=r.height||nodo.offsetHeight,m=w*margen,dpr=dprDe();
    const c=document.createElement('canvas');c.className='fxEstado';c.dataset.fxEstado=tipo;c.setAttribute('aria-hidden','true');
    c.style.cssText='position:absolute;left:'+(-m)+'px;top:'+(-m)+'px;width:'+(w+2*m)+'px;height:'+(h+2*m)+'px;max-width:none;pointer-events:none;z-index:4;box-shadow:none;border-radius:0';
    c.width=Math.max(1,Math.round((w+2*m)*dpr));c.height=Math.max(1,Math.round((h+2*m)*dpr));nodo.append(c);nodo.dataset[claveDe(tipo)]='';
    const e=Object.assign({nodo,tipo,c,g:c.getContext('2d'),w,h,m,dpr,dibujar,t0:performance.now(),fijo:quieto(),semilla:Math.floor(Math.random()*997)},extra);
    estados.add(e);pintarEstado(e,e.fijo?1.3:0);if(!e.fijo)arrancar();return e;
  }
  function pintarEstado(e,t){const g=e.g;g.setTransform(e.dpr,0,0,e.dpr,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,e.w+2*e.m,e.h+2*e.m);g.translate(e.m,e.m);e.dibujar(g,t,e);}
  const refrescar=e=>{if(e&&e.fijo)pintarEstado(e,1.3);};
  function arrancar(){
    if(rafEstados)return;
    const paso=ahora=>{rafEstados=0;let vivos=false;
      for(const e of estados){if(!e.c.isConnected){estados.delete(e);continue;}if(!e.fijo&&!document.hidden){pintarEstado(e,(ahora-e.t0)/1000);vivos=true;}else if(!e.fijo)vivos=true;}
      if(vivos)rafEstados=requestAnimationFrame(paso);};
    rafEstados=requestAnimationFrame(paso);
  }
  function estadoDe(nodo,tipo){for(const e of estados)if(e.nodo===nodo&&e.tipo===tipo&&e.c.isConnected)return e;return null;}
  function quitarYa(nodo,tipo){
    const e=estadoDe(nodo,tipo);if(e){estados.delete(e);e.alQuitar?.();}
    nodo.querySelectorAll(':scope > canvas.fxEstado[data-fx-estado="'+tipo+'"]').forEach(c=>c.remove());delete nodo.dataset[claveDe(tipo)];
  }
  // Retira un estado con su salida (sal(tt,e) durante dur segundos) o fundido.
  async function retirar(nodo,tipo,o={},dur=.45,sal){
    const e=estadoDe(nodo,tipo);if(!e){quitarYa(nodo,tipo);return false;}
    if(quieto(o)){quitarYa(nodo,tipo);return false;}
    await correr(o,tt=>{if(sal)sal(tt,e);else e.c.style.opacity=String(1-entre(tt,0,dur));refrescar(e);return tt<dur;},dur);
    quitarYa(nodo,tipo);return true;
  }

  /* 2 · ESPORAS E INFECTADO ------------------------------------------------ */
  const MW=64,MH=90,NIVEL_MOHO=.42;
  function campo(semilla,f){const n=MW*MH,a=new Float32Array(n),b=new Float32Array(n),c=new Float32Array(n),s=semilla*1.37;
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const u=(x+.5)/MW,v=(y+.5)/MH,i=y*MW+x;a[i]=f(u,v,s);b[i]=ruido(u*16+s,v*22+s);c[i]=ruido(u*34+s*2,v*46);}
    return {f:a,n:b,m:c};}
  function lienzoBajo(){const c=document.createElement('canvas');c.width=MW;c.height=MH;return c;}
  // El moho crece desde los bordes: verde oscuro moteado, líquenes y un borde vivo.
  function pintarMoho(e){
    const L=e.nivel,cu=e.cuerpo.getContext('2d'),bo=e.borde.getContext('2d'),ic=cu.createImageData(MW,MH),ib=bo.createImageData(MW,MH),C=e.campo;
    for(let i=0;i<MW*MH;i++){const d=L-C.f[i],n=C.n[i],p=i*4;
      if(d>0){const liquen=C.m[i]>.8;ic.data[p]=liquen?118:18+34*n;ic.data[p+1]=liquen?168:34+52*n;ic.data[p+2]=liquen?62:12+18*n;ic.data[p+3]=255*Math.min(1,d*12)*(.72+.26*n);}
      const q=1-Math.abs(d)/.035;if(q>0){ib.data[p]=120;ib.data[p+1]=255;ib.data[p+2]=70;ib.data[p+3]=255*q*.7;}}
    cu.putImageData(ic,0,0);bo.putImageData(ib,0,0);
  }
  function dibujarMoho(g,t,e){
    if(e.hecho!==e.nivel){pintarMoho(e);e.hecho=e.nivel;}
    const p=.5+.5*Math.sin(t*2.6),esc=e.w/180,mota=mancha([170,255,110],.85,true);
    g.save();redondo(g,0,0,e.w,e.h,e.w*.048);g.clip();g.imageSmoothingEnabled=true;
    g.globalAlpha=.86+.14*p;g.drawImage(e.cuerpo,0,0,e.w,e.h);
    g.globalCompositeOperation='lighter';g.globalAlpha=.12+.38*p;g.drawImage(e.borde,0,0,e.w,e.h);g.restore();
    // Esporas que se sueltan de los bordes y suben.
    g.globalCompositeOperation='lighter';const vivo=e.nivel/NIVEL_MOHO;
    for(let i=0;i<10;i++){const f=(t*.23+hash(i,e.semilla))%1,lado=hash(i,2.1+e.semilla),x=(lado<.5?lado*.3:1-(lado-.5)*.3)*e.w,y=e.h*(.08+.88*hash(i,5.3+e.semilla))-f*e.h*.18;
      pintarSprite(g,mota,x+Math.sin(t*1.7+i)*4*esc,y,(3+2*hash(i,8))*esc,Math.sin(Math.PI*f)*.8*vivo);}
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
  }
  function infectar(nodo,o={}){
    const ya=estadoDe(nodo,'infectada');if(ya){ya.nivel=o.nivel??NIVEL_MOHO;refrescar(ya);return ya;}
    const s=Math.random()*50;
    return ponerEstado(nodo,'infectada',dibujarMoho,.12,{nivel:o.nivel??NIVEL_MOHO,hecho:-1,cuerpo:lienzoBajo(),borde:lienzoBajo(),
      campo:campo(s,(u,v,s)=>Math.min(u,1-u,Math.min(v,1-v)*1.4)*3.2+fbm(u*5+s,v*7+s)*.6-.3)});
  }
  const curar=(nodo,o)=>retirar(nodo,'infectada',o||{},.6,(tt,e)=>{e.nivel=NIVEL_MOHO*(1-suave(entre(tt,0,.6)));});

  // esporas(host,{origen,objetivos}): del muerto salen nubes de esporas que
  // viajan a cada objetivo; al llegar, la carta destella y le crece el moho.
  async function esporas(host,o){
    const objetivos=(o.objetivos||[]).filter(Boolean);
    if(quieto(o)||!o.origen){objetivos.forEach(n=>infectar(n));return false;}
    const L=capa(host,22),O=caja(o.origen,host),esc=O.w/180,vel=o.velocidad||1;
    const verde=mancha([110,200,70],.7),oscuro=mancha([40,80,30],.75),mota=mancha([170,255,110],.8,true);
    const nubes=objetivos.map((n,i)=>({n,r:caja(n,host),ini:.3+i*.16,dur:.85,estado:null,llego:-1,
      puffs:Array.from({length:20},()=>({a:Math.random()*TAU,r:Math.random(),s:.55+Math.random()*.7,o:Math.random()<.35,g:Math.random()<.5?1:-1}))}));
    const motas=[];
    await correr(o,(tt,dt)=>{
      L.limpiar();const g=L.g;
      const b=entre(tt,0,.7);
      if(b<1)for(let k=0;k<20;k++){const a=k/20*TAU+hash(k,1)*.7,rr=O.w*(.15+salida(b)*.6)*(.6+hash(k,2)*.6);pintarSprite(g,k%3?verde:oscuro,O.cx+Math.cos(a)*rr,O.cy+Math.sin(a)*rr*1.25,O.w*(.14+b*.2),(1-b)*.85);}
      for(const n of nubes){
        const p=entre(tt,n.ini,n.ini+n.dur),R=n.r;if(p<=0)continue;
        if(p<1){const e=suave(p),mx=(O.cx+R.cx)/2,my=Math.min(O.cy,R.cy)-O.h*.55,x=(1-e)*(1-e)*O.cx+2*(1-e)*e*mx+e*e*R.cx,y=(1-e)*(1-e)*O.cy+2*(1-e)*e*my+e*e*R.cy,rad=O.w*.3*(.75+.35*Math.sin(Math.PI*p));
          for(const q of n.puffs){const a=q.a+tt*1.6*q.g;pintarSprite(g,q.o?oscuro:verde,x+Math.cos(a)*rad*q.r,y+Math.sin(a)*rad*q.r*.8,O.w*.22*q.s,.9);}
          if(Math.random()<.8)motas.push({x,y,vx:(Math.random()-.5)*30,vy:(Math.random()-.5)*30-10,t:0,vida:.5+Math.random()*.6,r:(2+Math.random()*2.5)*esc});}
        else if(n.llego<0){n.llego=tt;n.estado=infectar(n.n,{nivel:0});
          n.n.animate?.([{filter:'brightness(1)'},{filter:'brightness(1.35) drop-shadow(0 0 16px #7dff5a)'},{filter:'brightness(1)'}],{duration:650/vel,easing:'ease-out'});}
        if(n.llego>=0){n.estado.nivel=NIVEL_MOHO*salida(entre(tt,n.llego,n.llego+1));refrescar(n.estado);
          const d=entre(tt,n.llego,n.llego+.8);if(d<1)for(const q of n.puffs){const a=q.a;pintarSprite(g,q.o?oscuro:verde,R.cx+Math.cos(a)*R.w*(.2+d*.45)*q.r*1.6,R.cy+Math.sin(a)*R.h*(.2+d*.4)*q.r*1.4,R.w*.16*q.s*(1+d),(1-d)*.7);}}
      }
      g.globalCompositeOperation='lighter';
      for(let i=motas.length-1;i>=0;i--){const m=motas[i];m.t+=dt;if(m.t>=m.vida){motas.splice(i,1);continue;}m.x+=m.vx*dt;m.y+=m.vy*dt;pintarSprite(g,mota,m.x,m.y,m.r,1-m.t/m.vida);}
      g.globalCompositeOperation='source-over';g.globalAlpha=1;
      return !(nubes.every(n=>n.llego>=0&&tt>n.llego+1.05)&&!motas.length);
    },6);
    L.quitar();for(const n of nubes){if(!n.estado)infectar(n.n);else{n.estado.nivel=NIVEL_MOHO;refrescar(n.estado);}}
    return true;
  }

  /* 3 · POLIMORFIA DE RULCHETE --------------------------------------------- */
  // polimorfar(host,{objetivo,imagen,imagenNueva,alCambiar,sacudir}): la carta
  // se retuerce, estalla en humo morado y la nueva cae desde arriba con un
  // golpe que sacude la mesa. La inversa es la misma llamada con las caras al revés.
  async function polimorfar(host,o){
    const obj=o.objetivo,cara=o.imagen||obj?.querySelector?.(':scope > .cjCara, :scope > canvas'),nueva=o.imagenNueva;
    if(!obj||!nueva||!cara||quieto(o)){try{o.alCambiar?.();}catch(_){}return false;}
    const L=capa(host,22),R=caja(obj,host),esc=R.w/180,vel=o.velocidad||1,sacudir=o.sacudir||host;
    const morado=mancha([150,70,225],.6),oscuro=mancha([34,16,52],.7),chispa=mancha([220,160,255],.9,true),polvo=mancha([120,100,140],.45);
    const humo=[],chispas=[];let caida=false,cambiado=false,sol=0;
    const tira=document.createElement('canvas');tira.width=Math.round(R.w*dprDe());tira.height=Math.round(R.h*dprDe());const gt=tira.getContext('2d');
    obj.style.visibility='hidden';
    await correr(o,(tt,dt)=>{
      L.limpiar();const g=L.g;
      // Se retuerce (0–0,8 s): tiras horizontales que ondulan y se tiñe de morado.
      if(tt<.85){const tw=entre(tt,0,.8),amp=R.w*.1*Math.pow(tw,1.4),alfa=1-entre(tt,.68,.85);
        gt.setTransform(1,0,0,1,0,0);gt.clearRect(0,0,tira.width,tira.height);gt.drawImage(cara,0,0,tira.width,tira.height);
        gt.globalCompositeOperation='source-atop';gt.fillStyle='rgba(140,60,220,'+tw*.6+')';gt.fillRect(0,0,tira.width,tira.height);gt.globalCompositeOperation='source-over';
        const halo=R.w*(.8+tw*.3);pintarSprite(g,morado,R.cx,R.cy,halo,.5*tw*alfa);
        g.globalAlpha=alfa;const n=36,hs=tira.height/n,sx=1-.12*tw*Math.abs(Math.sin(tt*9));
        for(let i=0;i<n;i++){const off=Math.sin(i*.45+tt*16)*amp+Math.sin(i*.13-tt*7)*amp*.5;g.drawImage(tira,0,i*hs,tira.width,hs+1,R.cx-R.w/2*sx+off,R.y+i*R.h/n,R.w*sx,R.h/n+.6);}
        g.globalAlpha=1;}
      // Estalla (0,7 s): humo morado y oscuro, chispas.
      if(tt>=.7&&!sol){sol=1;for(let i=0;i<70;i++){const a=Math.random()*TAU,v=40+Math.random()*160;humo.push({x:R.cx+(Math.random()-.5)*R.w*.8,y:R.cy+(Math.random()-.5)*R.h*.8,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.7-20,t:0,vida:.65+Math.random()*.55,r:R.w*(.14+Math.random()*.2),o:Math.random()<.4});}
        for(let i=0;i<40;i++){const a=Math.random()*TAU,v=120+Math.random()*260;chispas.push({x:R.cx,y:R.cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,vida:.4+Math.random()*.5,r:(2+Math.random()*3)*esc});}}
      const flash=Math.exp(-Math.pow((tt-.74)*10,2));if(flash>.02)pintarSprite(g,chispa,R.cx,R.cy,R.w*1.1,flash*.9);
      // Cae la nueva (1,05–1,4 s) y golpea.
      const c=entre(tt,1.05,1.4);
      if(c>0&&!cambiado){const e=c*c*c,s=1.45-.45*e,y=R.cy-(1-e)*R.h*1.6;g.globalAlpha=Math.min(1,c*3);g.drawImage(nueva,R.cx-R.w*s/2,y-R.h*s/2,R.w*s,R.h*s);g.globalAlpha=1;}
      if(c>=1&&!caida){caida=true;cambiado=true;try{o.alCambiar?.();}catch(_){}obj.style.visibility='';
        sacudir.animate?.([{translate:'0 0'},{translate:'0 '+7*esc+'px'},{translate:-5*esc+'px -3px'},{translate:4*esc+'px 2px'},{translate:'-2px 0'},{translate:'0 0'}],{duration:380/vel});
        for(let i=0;i<26;i++){const lado=i%2?1:-1;humo.push({x:R.cx+lado*R.w*(.3+Math.random()*.25),y:R.y+R.h*.95,vx:lado*(60+Math.random()*140),vy:-Math.random()*50,t:0,vida:.8+Math.random()*.6,r:R.w*(.1+Math.random()*.12),p:true});}}
      const anillo=caida?entre(tt,1.4,1.95):0;
      if(anillo>0&&anillo<1){const rr=R.w*(.5+anillo*.9);g.strokeStyle='rgba(200,150,255,'+(1-anillo)*.7+')';g.lineWidth=(1-anillo)*8*esc+1;g.beginPath();g.ellipse(R.cx,R.y+R.h*.97,rr,rr*.22,0,0,TAU);g.stroke();}
      for(let i=humo.length-1;i>=0;i--){const h=humo[i];h.t+=dt;if(h.t>=h.vida){humo.splice(i,1);continue;}h.vx*=1-1.8*dt;h.vy=h.vy*(1-1.8*dt)-8*dt;h.x+=h.vx*dt;h.y+=h.vy*dt;
        pintarSprite(g,h.p?polvo:h.o?oscuro:morado,h.x,h.y,h.r*(1+h.t*.8),Math.pow(1-h.t/h.vida,1.6)*.85);}
      g.globalCompositeOperation='lighter';
      for(let i=chispas.length-1;i>=0;i--){const s=chispas[i];s.t+=dt;if(s.t>=s.vida){chispas.splice(i,1);continue;}s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=1-2*dt;s.vy*=1-2*dt;pintarSprite(g,chispa,s.x,s.y,s.r,1-s.t/s.vida);}
      g.globalCompositeOperation='source-over';g.globalAlpha=1;
      return !(caida&&tt>1.95&&!humo.length&&!chispas.length);
    },5);
    if(!cambiado){try{o.alCambiar?.();}catch(_){}}
    obj.style.visibility='';L.quitar();return true;
  }

  /* 4 · RAYO DE ESCARCHA Y COLLAR DE AGUA ---------------------------------- */
  const NIVEL_HIELO=1.7;
  function ramasHielo(iu,iv,s){
    const r=azar(s),seg=[],f=(u,v)=>Math.hypot(u-iu,(v-iv)*1.35)*.9+fbm(u*5+s,v*7)*.35;
    const crecer=(x,y,a,paso,n,prof)=>{for(let i=0;i<n;i++){a+=(r()-.5)*.7;const x1=x+Math.cos(a)*paso,y1=y+Math.sin(a)*paso*1.35;
      if(x1<0||x1>1||y1<0||y1>1)return;seg.push([x,y,x1,y1,f(x,y),prof]);
      if(prof<2&&r()<.32)crecer(x1,y1,a+(r()<.5?-1:1)*(.7+r()*.5),paso*.7,Math.floor(n*.5),prof+1);x=x1;y=y1;}};
    for(let k=0;k<8;k++)crecer(iu,iv,k/8*TAU+r()*.5,.05,11,0);
    return seg;
  }
  function pintarHielo(e){
    const L=e.nivel,D=e.derrite||0,cu=e.cuerpo.getContext('2d'),ic=cu.createImageData(MW,MH),C=e.campo;
    for(let i=0;i<MW*MH;i++){const d=L-C.f[i],p=i*4;if(d<=-.04)continue;
      const v=(Math.floor(i/MW)+.5)/MH,funde=acotar(((v+C.n[i]*.25)-D*1.3)*7),veta=Math.pow(1-Math.abs(2*C.m[i]-1),5),borde=Math.max(0,1-Math.abs(d)/.04);
      ic.data[p]=195+60*veta;ic.data[p+1]=228+27*veta;ic.data[p+2]=255;ic.data[p+3]=255*funde*Math.min(1,Math.min(1,Math.max(0,d)*6)*(.2+.5*veta+.12*C.n[i])+borde*.85);}
    cu.putImageData(ic,0,0);
  }
  function dibujarHielo(g,t,e){
    const clave=e.nivel+'|'+(e.derrite||0);if(e.hecho!==clave){pintarHielo(e);e.hecho=clave;}
    const esc=e.w/180,D=e.derrite||0,vaho=mancha([235,245,255],.22);
    g.save();redondo(g,0,0,e.w,e.h,e.w*.048);g.clip();g.imageSmoothingEnabled=true;g.drawImage(e.cuerpo,0,0,e.w,e.h);
    // Cristales: las ramas aparecen con el frente y se funden de arriba abajo.
    g.strokeStyle='rgba(245,252,255,.8)';g.lineCap='round';
    for(const [x0,y0,x1,y1,f,prof]of e.ramas){if(f>e.nivel||(y0+.1)<D*1.3)continue;g.lineWidth=(1.5-prof*.4)*esc;g.beginPath();g.moveTo(x0*e.w,y0*e.h);g.lineTo(x1*e.w,y1*e.h);g.stroke();}
    // Carámbanos en el borde de abajo cuando ya está entera.
    const car=entre(e.nivel,1.2,NIVEL_HIELO)*(1-entre(D,.6,.9));
    if(car>0){g.fillStyle='rgba(225,245,255,'+.85*car+')';for(let i=0;i<9;i++){const x=e.w*(.08+i*.105),l=e.h*.06*(.5+hash(i,e.semilla))*car;g.beginPath();g.moveTo(x-4*esc,e.h);g.lineTo(x+4*esc,e.h);g.lineTo(x+hash(i,3)*2,e.h-l);g.fill();}}
    g.restore();
    // Vaho: soplos blancos que suben de la carta.
    if(e.nivel>.8&&D<.3)for(let i=0;i<5;i++){const f=(t*.18+i/5)%1;pintarSprite(g,vaho,e.w*(.2+.6*hash(i,e.semilla+1))+Math.sin(t+i)*6*esc,e.h*.25-f*e.h*.45,e.w*(.12+f*.14),Math.sin(Math.PI*f)*.7*(1-D*3));}
    g.globalAlpha=1;
  }
  function helar(nodo,o={}){
    const ya=estadoDe(nodo,'congelada');if(ya){ya.nivel=o.nivel??NIVEL_HIELO;ya.derrite=0;refrescar(ya);return ya;}
    const s=Math.random()*50,iu=o.impacto?.[0]??.5,iv=o.impacto?.[1]??.45;
    return ponerEstado(nodo,'congelada',dibujarHielo,.15,{nivel:o.nivel??NIVEL_HIELO,derrite:0,hecho:'',cuerpo:lienzoBajo(),ramas:ramasHielo(iu,iv,s),
      campo:campo(s,(u,v,s)=>Math.hypot(u-iu,(v-iv)*1.35)*.9+fbm(u*5+s,v*7)*.35)});
  }
  // congelar(host,{objetivo,origen,impacto}): un rayo helado y la escarcha crece
  // desde el impacto por toda la carta; queda con vaho y carámbanos.
  async function congelar(host,o){
    const obj=o.objetivo;if(!obj)return false;
    if(quieto(o)){helar(obj,o);return false;}
    const L=capa(host,22),R=caja(obj,host),esc=R.w/180,iu=o.impacto?.[0]??.5,iv=o.impacto?.[1]??.45,I=[R.x+iu*R.w,R.y+iv*R.h],vel=o.velocidad||1;
    const O=o.origen?caja(o.origen,host):null,blanco=mancha([150,215,255],.9,true),frio=mancha([120,190,255],.5),esquirlas=[];
    const t0=O?.35:0;let estado=null;
    await correr(o,(tt,dt)=>{
      L.limpiar();const g=L.g;g.globalCompositeOperation='lighter';
      if(O&&tt<t0+.1){const p=salida(entre(tt,0,t0)),x=O.cx+(I[0]-O.cx)*p,y=O.cy+(I[1]-O.cy)*p,cola=Math.max(0,p-.35);
        const x0=O.cx+(I[0]-O.cx)*cola,y0=O.cy+(I[1]-O.cy)*cola,al=1-entre(tt,t0,t0+.1);
        for(const [w,a]of [[14,.25],[6,.6],[2.2,1]]){g.strokeStyle='rgba(190,235,255,'+a*al+')';g.lineWidth=w*esc;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x,y);g.stroke();}
        pintarSprite(g,blanco,x,y,22*esc,al);}
      if(tt>=t0&&!estado){estado=helar(obj,{nivel:0,impacto:[iu,iv]});
        obj.animate?.([{filter:'brightness(1)'},{filter:'brightness(1.4) drop-shadow(0 0 14px #9fdcff)'},{filter:'brightness(1)'}],{duration:600/vel,easing:'ease-out'});
        for(let i=0;i<24;i++){const a=Math.random()*TAU,v=80+Math.random()*200;esquirlas.push({x:I[0],y:I[1],vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,vida:.35+Math.random()*.4,r:(1.5+Math.random()*2.5)*esc,rot:Math.random()*TAU});}}
      if(estado){estado.nivel=NIVEL_HIELO*salida(entre(tt,t0,t0+1));refrescar(estado);
        const fl=Math.exp(-Math.pow((tt-t0)*7,2));pintarSprite(g,blanco,I[0],I[1],R.w*.7,fl);pintarSprite(g,frio,R.cx,R.cy,R.w*1.05,.35*campana(tt,t0,t0+1.2));}
      g.fillStyle='rgba(225,245,255,.95)';
      for(let i=esquirlas.length-1;i>=0;i--){const s=esquirlas[i];s.t+=dt;if(s.t>=s.vida){esquirlas.splice(i,1);continue;}s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=200*dt;s.rot+=8*dt;
        g.globalAlpha=1-s.t/s.vida;g.save();g.translate(s.x,s.y);g.rotate(s.rot);g.fillRect(-s.r,-s.r*.3,s.r*2,s.r*.6);g.restore();}
      g.globalAlpha=1;g.globalCompositeOperation='source-over';
      return !(estado&&tt>t0+1.2&&!esquirlas.length);
    },4);
    L.quitar();if(estado){estado.nivel=NIVEL_HIELO;refrescar(estado);}else helar(obj,o);return true;
  }
  // descongelar(host,{objetivo}): la escarcha se funde de arriba abajo y gotea.
  async function descongelar(host,o){
    const obj=o.objetivo,e=obj&&estadoDe(obj,'congelada');if(!e){if(obj)quitarYa(obj,'congelada');return false;}
    if(quieto(o)){quitarYa(obj,'congelada');return false;}
    const L=capa(host,22),R=caja(obj,host),esc=R.w/180,gotas=[];
    await correr(o,(tt,dt)=>{
      e.derrite=suave(entre(tt,0,1.3));refrescar(e);L.limpiar();const g=L.g;
      if(tt<1.4&&Math.random()<.55)gotas.push({x:R.x+R.w*(.06+Math.random()*.88),y:R.y+R.h*(.55+.43*e.derrite),vy:0,t:0,cuelga:.15+Math.random()*.35,l:(4+Math.random()*4)*esc});
      for(let i=gotas.length-1;i>=0;i--){const d=gotas[i];d.t+=dt;if(d.t>d.cuelga){d.vy+=900*dt;d.y+=d.vy*dt;}if(d.y>R.y+R.h+R.h*.35){gotas.splice(i,1);continue;}
        const a=d.t<d.cuelga?d.t/d.cuelga:1-entre(d.y,R.y+R.h,R.y+R.h*1.35),l=d.l*(1+Math.min(2,d.vy/400));
        g.fillStyle='rgba(170,220,255,'+.85*a+')';g.beginPath();g.ellipse(d.x,d.y,d.l*.28,l*.5,0,0,TAU);g.fill();
        g.fillStyle='rgba(255,255,255,'+.8*a+')';g.beginPath();g.arc(d.x-d.l*.08,d.y-l*.15,d.l*.08,0,TAU);g.fill();}
      return tt<1.35||gotas.length>0;
    },4);
    L.quitar();quitarYa(obj,'congelada');return true;
  }
  // apagar(host,{objetivo,origen}): el Collar de Agua. Una burbuja rodea la
  // carta, el fuego que llega se apaga contra ella entre vapor y la burbuja estalla.
  async function apagar(host,o){
    const obj=o.objetivo;if(!obj||quieto(o))return false;
    const L=capa(host,22),R=caja(obj,host),esc=R.w/180,O=o.origen?caja(o.origen,host):{cx:R.cx-R.w*1.6,cy:R.y-R.h*.9};
    const fuego=mancha([255,130,30],.75,true),brasa=mancha([255,90,20],.5),vapor=mancha([230,236,245],.45),rx=R.w*.78,ry=R.h*.64;
    const llamas=[],humo=[],gotas=[];let explota=false;
    await correr(o,(tt,dt)=>{
      L.limpiar();const g=L.g;
      const forma=salida(entre(tt,0,.35))*(1+.08*Math.sin(Math.PI*entre(tt,.2,.5))),pop=entre(tt,1.55,1.7),vis=forma*(1-pop);
      if(tt>.3&&tt<1.15)for(let k=0;k<5;k++){const j=(Math.random()-.5)*R.w*.3;llamas.push({x:O.cx+j,y:O.cy+j*.4,t:0,r:(18+Math.random()*18)*esc,v:.9+Math.random()*.4,ox:(Math.random()-.5)*R.w*.6,oy:(Math.random()-.5)*R.h*.5});}
      // La burbuja: relleno azul, borde brillante que ondula y un reflejo.
      if(vis>.01){g.save();g.translate(R.cx,R.cy);g.scale(forma,forma);
        const gr=g.createRadialGradient(0,0,rx*.2,0,0,rx*1.05);gr.addColorStop(0,'rgba(90,170,255,.04)');gr.addColorStop(.75,'rgba(90,170,255,.16)');gr.addColorStop(1,'rgba(150,215,255,.38)');
        g.globalAlpha=1-pop;g.fillStyle=gr;g.beginPath();
        for(let i=0;i<=64;i++){const a=i/64*TAU,w=1+.025*Math.sin(a*5+tt*5)+.02*Math.sin(a*3-tt*7);i?g.lineTo(Math.cos(a)*rx*w,Math.sin(a)*ry*w):g.moveTo(Math.cos(a)*rx*w,Math.sin(a)*ry*w);}
        g.closePath();g.fill();g.strokeStyle='rgba(210,240,255,.85)';g.lineWidth=2.2*esc;g.stroke();
        g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=5*esc;g.lineCap='round';g.beginPath();g.ellipse(0,0,rx*.8,ry*.8,0,3.6,4.3);g.stroke();g.restore();g.globalAlpha=1;}
      // El fuego vuela hacia la carta y se apaga al tocar la burbuja.
      g.globalCompositeOperation='lighter';
      for(let i=llamas.length-1;i>=0;i--){const f=llamas[i];f.t+=dt*f.v;const p=salida(f.t/.55),x=O.cx+(R.cx+f.ox-O.cx)*p,y=O.cy+(R.cy+f.oy-O.cy)*p,dx=(x-R.cx)/rx,dy=(y-R.cy)/ry;
        if(dx*dx+dy*dy<=1&&forma>.8){llamas.splice(i,1);for(let k=0;k<2;k++)humo.push({x,y,vx:dx*40+(Math.random()-.5)*40,vy:-30-Math.random()*50,t:0,vida:.8+Math.random()*.6,r:(14+Math.random()*12)*esc});continue;}
        if(f.t>1){llamas.splice(i,1);continue;}pintarSprite(g,fuego,x,y,f.r*(.6+.5*p)*(1+Math.sin(f.t*30)*.1),.9);pintarSprite(g,brasa,x,y,f.r*1.8,.25);}
      g.globalCompositeOperation='source-over';
      if(pop>0&&!explota){explota=true;for(let i=0;i<46;i++){const a=i/46*TAU+Math.random()*.1,v=90+Math.random()*120;gotas.push({x:R.cx+Math.cos(a)*rx,y:R.cy+Math.sin(a)*ry,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,t:0,vida:.6+Math.random()*.4,r:(2+Math.random()*2.5)*esc});}}
      if(pop>0&&pop<1){g.strokeStyle='rgba(210,240,255,'+(1-pop)+')';g.lineWidth=3*esc*(1-pop)+.5;g.beginPath();g.ellipse(R.cx,R.cy,rx*(1+pop*.25),ry*(1+pop*.25),0,0,TAU);g.stroke();}
      for(let i=humo.length-1;i>=0;i--){const h=humo[i];h.t+=dt;if(h.t>=h.vida){humo.splice(i,1);continue;}h.x+=h.vx*dt;h.y+=h.vy*dt;h.vx*=1-dt;pintarSprite(g,vapor,h.x,h.y,h.r*(1+h.t*1.2),(1-h.t/h.vida)*.8);}
      g.fillStyle='rgba(185,225,255,.9)';
      for(let i=gotas.length-1;i>=0;i--){const d=gotas[i];d.t+=dt;if(d.t>=d.vida){gotas.splice(i,1);continue;}d.vy+=500*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;g.globalAlpha=1-d.t/d.vida;g.beginPath();g.arc(d.x,d.y,d.r,0,TAU);g.fill();}
      g.globalAlpha=1;
      return !(explota&&pop>=1&&!humo.length&&!gotas.length&&!llamas.length);
    },5);
    L.quitar();return true;
  }

  /* 5 · POSEÍDO ------------------------------------------------------------ */
  const FILTRO_POSEIDO='grayscale(.85) brightness(.78) contrast(1.12)';
  function ojo(g,x,y,w,abierto,a){
    if(abierto<=.02||a<=0)return;const h=w*.42*abierto;g.globalAlpha=a;
    pintarSprite(g,mancha([255,30,20],.7,false),x,y,w*1.3,a*.8);g.globalAlpha=a;
    g.fillStyle='#ff3b2a';g.beginPath();g.moveTo(x-w/2,y);g.quadraticCurveTo(x,y-h,x+w/2,y);g.quadraticCurveTo(x,y+h,x-w/2,y);g.fill();
    g.fillStyle='#ffe3a8';g.beginPath();g.ellipse(x,y,w*.1,h*.55,0,0,TAU);g.fill();
  }
  function dibujarPoseido(g,t,e){
    const cx=e.w/2,cy=e.h/2,esc=e.w/180,humo=mancha([40,18,56],.8),negro=mancha([6,3,10],.75),brillo=mancha([110,30,120],.45),ent=e.entrada??1;
    g.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const a=i/6*TAU+t*.2;pintarSprite(g,brillo,cx+Math.cos(a)*e.w*.5,cy+Math.sin(a)*e.h*.42,e.w*.45,.35*ent);}g.globalCompositeOperation='source-over';
    for(let i=0;i<18;i++){const dir=i%2?1:-1,a=hash(i,e.semilla)*TAU+t*(.25+hash(i,2)*.2)*dir,rr=(.52+.2*hash(i,3))*(1.9-.9*ent);
      const x=cx+Math.cos(a)*e.w*rr,y=cy+Math.sin(a)*e.h*rr*.72;pintarSprite(g,i%3?humo:negro,x,y,e.w*(.24+.08*Math.sin(t*1.3+i)),.9*ent);}
    g.globalCompositeOperation='lighter';
    for(let i=0;i<3;i++){const a=hash(i,e.semilla+9)*TAU+t*.12,x=cx+Math.cos(a)*e.w*.6,y=cy+Math.sin(a)*e.h*.5*.8,fase=(t*.3+i*.37)%1,abierto=(1-campana(fase,.9,1))*entre(ent,.75,1);
      const w=e.w*.12;ojo(g,x-w*.7,y,w,abierto,.95);ojo(g,x+w*.7,y,w,abierto,.95);}
    g.globalCompositeOperation='source-over';g.globalAlpha=1;
  }
  function marcarPoseido(nodo,entrada=1){
    const e=ponerEstado(nodo,'poseida',dibujarPoseido,.35,{entrada,alQuitar(){nodo.style.filter='';}});nodo.style.filter=FILTRO_POSEIDO;return e;
  }
  // poseer(host,{objetivo,destino}): humo negro con ojos rodea la carta y la
  // apaga; con destino (Poseer de Thal) la carta flota entre el humo hasta allí.
  async function poseer(host,o){
    const obj=o.objetivo;if(!obj)return false;
    const dest=o.destino?caja(o.destino,host):null,R=caja(obj,host);
    const mover=p=>{if(dest)obj.style.translate=(dest.cx-R.cx)*p+'px '+((dest.cy-R.cy)*p-Math.sin(Math.PI*p)*R.h*.35)+'px';};
    if(quieto(o)){marcarPoseido(obj);mover(1);return false;}
    const e=estadoDe(obj,'poseida')||marcarPoseido(obj,0);obj.style.filter='';
    await correr(o,tt=>{
      e.entrada=salida(entre(tt,0,.9));const d=entre(tt,.3,1);
      obj.style.filter='grayscale('+.85*d+') brightness('+(1-.22*d)+') contrast('+(1+.12*d)+')';
      if(dest){const p=suave(entre(tt,1.1,2.3));mover(p);obj.style.rotate=Math.sin(Math.PI*p)*-6+'deg';}
      return tt<(dest?2.4:1.1);
    },dest?3:2);
    e.entrada=1;obj.style.filter=FILTRO_POSEIDO;if(dest){mover(1);obj.style.rotate='';}return true;
  }
  const liberar=(nodo,o)=>retirar(nodo,'poseida',o||{},.6,(tt,e)=>{const p=entre(tt,0,.6);e.entrada=1+p*1.2;e.c.style.opacity=String(1-p);nodo.style.filter='grayscale('+.85*(1-p)+') brightness('+(1-.22*(1-p))+')';});

  /* 6 · ASCENDER DE TALESYN ------------------------------------------------ */
  // gracia(host,{pip,celestiales,alLlenar}): la quinta Ficha de Gracia se llena
  // y la mesa se baña de luz celestial; las cartas Celestiales se vuelven de
  // oro un instante, con el brillo de la edición Dorada.
  async function gracia(host,o){
    if(quieto(o)){try{o.alLlenar?.();}catch(_){}return false;}
    const L=capa(host,22),W=L.W,H=L.H,dorado=mancha([255,210,110],.85,true),P=o.pip?caja(o.pip,host):null,vel=o.velocidad||1;
    const cartas=(o.celestiales||[]).filter(Boolean).map(n=>{
      const tinte=document.createElement('div'),banda=document.createElement('div');
      tinte.style.cssText='position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;opacity:0;mix-blend-mode:color;background:linear-gradient(135deg,#fff3c4,#e8b84a 40%,#9a6a18 72%,#ffe9a8)';
      banda.style.cssText='position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:6;opacity:0;mix-blend-mode:screen;background:linear-gradient(105deg,transparent 38%,rgba(255,248,215,.95) 50%,transparent 62%);background-size:260% 100%';
      tinte.setAttribute('aria-hidden','true');banda.setAttribute('aria-hidden','true');tinte.className=banda.className='fxGraciaOro';n.append(tinte,banda);return {n,tinte,banda};});
    const motas=[];let lleno=false;
    await correr(o,(tt,dt)=>{
      L.limpiar();const g=L.g;g.globalCompositeOperation='lighter';
      if(P){const f=Math.exp(-Math.pow((tt-.35)*7,2));pintarSprite(g,dorado,P.cx,P.cy,P.w*3,f);if(tt>=.35&&!lleno){lleno=true;try{o.alLlenar?.();}catch(_){}o.pip.animate?.([{transform:'scale(1)'},{transform:'scale(1.6)'},{transform:'scale(1)'}],{duration:500/vel});}}
      else if(tt>=.35&&!lleno){lleno=true;try{o.alLlenar?.();}catch(_){}}
      const luz=campana(tt,.4,2.6);g.globalAlpha=1;
      if(luz>0){const wash=g.createRadialGradient(W/2,-H*.1,0,W/2,-H*.1,H*1.2);wash.addColorStop(0,'rgba(255,236,170,'+.5*luz+')');wash.addColorStop(.6,'rgba(255,215,130,'+.18*luz+')');wash.addColorStop(1,'rgba(255,210,120,0)');g.fillStyle=wash;g.fillRect(0,0,W,H);
        for(let i=0;i<16;i++){const a=Math.PI/2+(i/15-.5)*2.1+Math.sin(tt*.6+i)*.05,an=.05+.05*hash(i,4),l=H*1.4,x0=W/2,y0=-H*.12;
          const gr=g.createLinearGradient(x0,y0,x0+Math.cos(a)*l,y0+Math.sin(a)*l);gr.addColorStop(0,'rgba(255,240,190,'+.55*luz*(.5+.5*hash(i,7))+')');gr.addColorStop(1,'rgba(255,220,140,0)');
          g.fillStyle=gr;g.beginPath();g.moveTo(x0,y0);g.lineTo(x0+Math.cos(a-an)*l,y0+Math.sin(a-an)*l);g.lineTo(x0+Math.cos(a+an)*l,y0+Math.sin(a+an)*l);g.fill();}
        if(Math.random()<luz*1.5)motas.push({x:Math.random()*W,y:H*(.4+Math.random()*.6),vy:-30-Math.random()*50,t:0,vida:1+Math.random(),r:2+Math.random()*3});}
      for(let i=motas.length-1;i>=0;i--){const m=motas[i];m.t+=dt;if(m.t>=m.vida){motas.splice(i,1);continue;}m.y+=m.vy*dt;pintarSprite(g,dorado,m.x+Math.sin(m.t*3+i)*6,m.y,m.r*2,Math.sin(Math.PI*m.t/m.vida)*.8);}
      g.globalCompositeOperation='source-over';g.globalAlpha=1;
      const oro=campana(tt,.8,2.3),barre=entre(tt,1,2);
      for(const c of cartas){c.tinte.style.opacity=String(.85*oro);c.banda.style.opacity=String(campana(tt,1,2));c.banda.style.backgroundPosition=(100-barre*100)+'% 0';}
      return tt<2.7||motas.length>0;
    },4);
    for(const c of cartas){c.tinte.remove();c.banda.remove();}
    if(!lleno){try{o.alLlenar?.();}catch(_){}}
    L.quitar();return true;
  }

  /* 7 · ATURDIDO Y RISA DE TASHA ------------------------------------------- */
  function estrella(g,x,y,r,rot){g.beginPath();for(let i=0;i<10;i++){const a=rot+i*Math.PI/5,q=i%2?r*.45:r;i?g.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q):g.moveTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}g.closePath();
    g.fillStyle='#ffd84a';g.fill();g.strokeStyle='#8a5a10';g.lineWidth=r*.14;g.stroke();}
  function pajaro(g,x,y,r,t,lado){g.save();g.translate(x,y);g.scale(lado,1);
    g.fillStyle='#fff4c2';g.strokeStyle='#6d4a12';g.lineWidth=r*.12;g.beginPath();g.ellipse(0,0,r,r*.72,0,0,TAU);g.fill();g.stroke();
    const ala=Math.sin(t*18)*.7;g.fillStyle='#ffe07a';g.beginPath();g.moveTo(-r*.2,-r*.1);g.quadraticCurveTo(-r*.5,-r*(1.1+ala),-r*1.05,-r*(.35+ala*.8));g.quadraticCurveTo(-r*.6,r*.1,-r*.2,-r*.1);g.fill();g.stroke();
    g.fillStyle='#ff9a2a';g.beginPath();g.moveTo(r*.85,-r*.1);g.lineTo(r*1.4,r*.05);g.lineTo(r*.85,r*.22);g.fill();
    g.fillStyle='#2a1a08';g.beginPath();g.arc(r*.45,-r*.2,r*.13,0,TAU);g.fill();g.restore();}
  function dibujarAturdido(g,t,e){
    const cx=e.w/2,cy=e.h*.02,rx=e.w*.5,ry=e.h*.08,r=e.w*.1,cosas=[];
    for(let i=0;i<5;i++){const a=t*2.3+i*TAU/5;cosas.push({a,z:Math.sin(a),i});}
    cosas.sort((p,q)=>p.z-q.z);
    for(const c of cosas){const s=.75+.25*c.z,x=cx+Math.cos(c.a)*rx,y=cy+Math.sin(c.a)*ry;g.globalAlpha=(.55+.45*(c.z+1)/2)*(e.aparece??1);
      if(c.i%5<3)estrella(g,x,y,r*s,t*3+c.i);else pajaro(g,x,y,r*.9*s,t+c.i,-Math.sign(Math.cos(c.a+Math.PI/2))||1);}
    g.globalAlpha=1;
  }
  function marcarAturdido(nodo,aparece=1){nodo.style.rotate='-3deg';return ponerEstado(nodo,'aturdida',dibujarAturdido,.35,{aparece,alQuitar(){nodo.style.rotate='';}});}
  // aturdir(host,{objetivo}): la carta se tambalea y le giran encima estrellas y pajaritos.
  async function aturdir(host,o){
    const obj=o.objetivo;if(!obj)return false;
    if(quieto(o)){marcarAturdido(obj);return false;}
    const L=capa(host,22),R=caja(obj,host),e=marcarAturdido(obj,0),chispa=mancha([255,220,120],.9,true),esc=R.w/180;
    await correr(o,tt=>{
      const p=entre(tt,0,1.1);obj.style.rotate=(-3+Math.sin(tt*15)*10*(1-p)*(1-p))+'deg';e.aparece=suave(entre(tt,.15,.6));
      L.limpiar();const g=L.g;g.globalCompositeOperation='lighter';
      const b=entre(tt,0,.45);if(b<1)for(let i=0;i<8;i++){const a=i/8*TAU;pintarSprite(g,chispa,R.cx+Math.cos(a)*R.w*(.15+b*.5),R.y+R.h*.1+Math.sin(a)*R.w*(.1+b*.3),9*esc,1-b);}
      return tt<1.15;
    },2);
    obj.style.rotate='-3deg';e.aparece=1;L.quitar();return true;
  }
  const despertar=(nodo,o)=>retirar(nodo,'aturdida',o||{},.45,(tt,e)=>{const p=entre(tt,0,.45);e.c.style.opacity=String(1-p);nodo.style.rotate=(-3*(1-p))+'deg';});
  // risa(host,{objetivo}): la Risa de Tasha. La carta tiembla de risa, salen
  // carcajadas en letras y acaba Aturdida.
  async function risa(host,o){
    const obj=o.objetivo;if(!obj)return false;
    if(quieto(o)){marcarAturdido(obj);return false;}
    const L=capa(host,23),R=caja(obj,host),esc=R.w/180,letras=[],textos=['JA','¡JA!','JAJA','JA JA','¡JAJA!'];let sig=0;
    await correr(o,(tt,dt)=>{
      const env=campana(tt,0,1.3);obj.style.translate=Math.sin(tt*31)*2*esc*env+'px '+(-Math.abs(Math.sin(tt*24))*6*esc*env)+'px';obj.style.rotate=Math.sin(tt*19)*3*env+'deg';
      if(tt<1.15&&tt>=sig){sig=tt+.13;letras.push({txt:textos[Math.floor(Math.random()*textos.length)],x:R.cx+(Math.random()-.5)*R.w*1.1,y:R.y+R.h*(.05+Math.random()*.35),vx:(Math.random()-.5)*50,vy:-55-Math.random()*40,rot:(Math.random()-.5)*.6,t:0,vida:.95,s:R.w*.17*(.8+Math.random()*.5)});}
      L.limpiar();const g=L.g;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
      for(let i=letras.length-1;i>=0;i--){const l=letras[i];l.t+=dt;if(l.t>=l.vida){letras.splice(i,1);continue;}l.x+=l.vx*dt;l.y+=l.vy*dt;
        const pop=l.t<.12?.4+l.t/.12*.75:1.15-.15*entre(l.t,.12,.3);g.save();g.translate(l.x,l.y);g.rotate(l.rot+Math.sin(l.t*14)*.12);g.scale(pop,pop);g.globalAlpha=1-entre(l.t,.6,l.vida);
        g.font='900 '+Math.round(l.s)+'px '+TITULO;g.lineWidth=l.s*.16;g.strokeStyle='#2a1204';g.strokeText(l.txt,0,0);g.fillStyle='#ffe07a';g.fillText(l.txt,0,0);g.restore();}
      return tt<1.3||letras.length>0;
    },3);
    obj.style.translate='';obj.style.rotate='';L.quitar();
    return aturdir(host,o);
  }

  /* 8 · LLAVES DEL DOMO Y PERGAMINO DE DESEO ------------------------------- */
  let dibujosLlave=null;
  function llaveDibujo(){
    if(dibujosLlave)return dibujosLlave;
    const hacer=oscura=>{const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');
      const oro=g.createLinearGradient(0,20,0,108);oro.addColorStop(0,oscura?'#b88a30':'#fff1b8');oro.addColorStop(.45,oscura?'#8a5f18':'#f0c14e');oro.addColorStop(1,oscura?'#4a300a':'#9a6414');
      g.fillStyle=oro;g.strokeStyle='#3a2406';g.lineWidth=4;g.beginPath();g.arc(58,64,40,0,TAU);g.arc(58,64,17,0,TAU,true);g.fill('evenodd');g.stroke();
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;g.beginPath();g.arc(58+Math.cos(a)*42,64+Math.sin(a)*42,9,0,TAU);g.fill();g.stroke();}
      g.beginPath();g.rect(96,56,138,16);g.fill();g.stroke();
      for(const [x,h]of [[196,26],[218,36]]){g.beginPath();g.rect(x,70,14,h);g.fill();g.stroke();}
      g.beginPath();g.rect(100,50,10,28);g.fill();g.stroke();return c;};
    dibujosLlave={cara:hacer(false),dorso:hacer(true)};return dibujosLlave;
  }
  // llave(host,{desde,hasta,alLlegar}): la Llave aparece sobre la carta y vuela
  // girando en 3D hasta el contador de Llaves.
  async function llave(host,o){
    if(!o.desde||!o.hasta||quieto(o)){try{o.alLlegar?.();}catch(_){}return false;}
    const L=capa(host,23),D=caja(o.desde,host),A=caja(o.hasta,host),esc=D.w/180,{cara,dorso}=llaveDibujo(),dorado=mancha([255,210,110],.85,true),vel=o.velocidad||1;
    const estela=[];let llego=false;
    await correr(o,(tt,dt)=>{
      L.limpiar();const g=L.g;
      const nace=entre(tt,0,.35),vuelo=entre(tt,.4,1.3),e=suave(vuelo);
      const mx=(D.cx+A.cx)/2,my=Math.min(D.cy,A.cy)-D.h*.8,x=(1-e)*(1-e)*D.cx+2*(1-e)*e*mx+e*e*A.cx,y=(1-e)*(1-e)*(D.cy-D.h*.1)+2*(1-e)*e*my+e*e*A.cy;
      const tam=D.w*.95*(nace<1?salida(nace)*1.15:1)*(1-.45*e),giro=tt*TAU*(vuelo>0&&vuelo<1?1.9:.6),cs=Math.cos(giro);
      g.globalCompositeOperation='lighter';
      if(!llego){pintarSprite(g,dorado,x,y,tam*.9,.55+.3*Math.sin(tt*9));if(nace<1)pintarSprite(g,dorado,D.cx,D.cy-D.h*.1,D.w*(.4+nace),(1-nace)*.9);}
      if(vuelo>0&&vuelo<1&&Math.random()<.9)estela.push({x,y,t:0,vida:.5,r:(4+Math.random()*4)*esc});
      for(let i=estela.length-1;i>=0;i--){const s=estela[i];s.t+=dt;if(s.t>=s.vida){estela.splice(i,1);continue;}s.y+=12*dt;pintarSprite(g,dorado,s.x,s.y,s.r*(1-s.t/s.vida*.5),1-s.t/s.vida);}
      g.globalCompositeOperation='source-over';
      g.globalAlpha=1;if(!llego){g.save();g.translate(x,y);g.rotate(-.35+.35*e);g.scale(cs,1);g.drawImage(cs>=0?cara:dorso,-tam/2,-tam/4,tam,tam/2);g.restore();}
      if(vuelo>=1&&!llego){llego=true;try{o.alLlegar?.();}catch(_){}o.hasta.animate?.([{transform:'scale(1)'},{transform:'scale(1.35)'},{transform:'scale(1)'}],{duration:520/vel,easing:'ease-out'});}
      const aro=llego?entre(tt,1.3,1.8):0;
      if(aro>0&&aro<1){g.strokeStyle='rgba(255,225,140,'+(1-aro)+')';g.lineWidth=5*esc*(1-aro)+1;g.beginPath();g.arc(A.cx,A.cy,Math.max(A.w,A.h)*(.5+aro*1.2),0,TAU);g.stroke();}
      return !(llego&&aro>=1&&!estela.length);
    },3);
    if(!llego){try{o.alLlegar?.();}catch(_){}}
    L.quitar();return true;
  }
  // Runas del Pergamino: trazos con semilla, siempre las mismas.
  function runa(i){const r=azar(i*7+3),t=[[.5,.04,.5,.96]];
    for(let k=0;k<2+Math.floor(r()*2);k++){const y=.15+r()*.6,lado=r()<.5?-1:1,tipo=r();
      if(tipo<.4)t.push([.5,y,.5+lado*.34,y+(r()-.5)*.5]);else if(tipo<.7){t.push([.5,y,.5+lado*.3,y+.14]);t.push([.5+lado*.3,y+.14,.5,y+.28]);}else t.push([.2,y,.8,y+(r()-.5)*.2]);}
    return t;}
  let texturaPergamino=null;
  function papel(){
    if(texturaPergamino)return texturaPergamino;const c=document.createElement('canvas');c.width=512;c.height=160;const g=c.getContext('2d'),r=azar(11);
    const f=g.createLinearGradient(0,0,0,160);f.addColorStop(0,'#cfb27a');f.addColorStop(.12,'#ecdcae');f.addColorStop(.88,'#e6d19f');f.addColorStop(1,'#c3a266');g.fillStyle=f;g.fillRect(0,0,512,160);
    for(let i=0;i<260;i++){g.fillStyle='rgba(120,80,30,'+(.02+r()*.05)+')';g.beginPath();g.ellipse(r()*512,r()*160,4+r()*22,2+r()*10,r()*3,0,TAU);g.fill();}
    g.strokeStyle='rgba(110,70,25,.55)';g.lineWidth=2;g.strokeRect(14,12,484,136);g.strokeStyle='rgba(110,70,25,.3)';g.strokeRect(20,18,472,124);
    texturaPergamino=c;return c;
  }
  function rodillo(g,x,y,h,w){const gr=g.createLinearGradient(x-w/2,0,x+w/2,0);gr.addColorStop(0,'#3a1f0a');gr.addColorStop(.45,'#9a6a36');gr.addColorStop(1,'#2a1406');
    g.fillStyle=gr;g.fillRect(x-w/2,y-h/2,w,h);g.fillStyle='#e8bb5a';g.strokeStyle='#5a3a0c';g.lineWidth=1;
    for(const s of [-1,1]){g.beginPath();g.ellipse(x,y+s*h/2,w*.75,w*.3,0,0,TAU);g.fill();g.stroke();}}
  // pergamino(host,{objetivo,turno,total}): el Pergamino se abre en 3D sobre su
  // carta; sus runas se encienden, las de este turno una a una; en el último
  // turno todas estallan en luz: victoria.
  async function pergamino(host,o){
    const obj=o.objetivo;if(!obj||quieto(o))return false;
    const L=capa(host,23),R=caja(obj,host),total=Math.max(1,o.total||2),turno=acotar(o.turno||1,1,total),n=total*3;
    const antes=Math.round(n*(turno-1)/total),ahora=Math.round(n*turno/total),victoria=turno>=total,esc=R.w/180;
    const PW=Math.min(L.W-16,R.w*1.8),PH=PW*.3,cx=Math.min(L.W-8-PW/2,Math.max(8+PW/2,R.cx)),cy=R.y+R.h*.3,dorado=mancha([255,215,110],.9,true),halo=mancha([255,170,40],.55),papelTex=papel();
    const enciende=j=>.75+(j-antes)*.22,finRunas=enciende(ahora),cierra=finRunas+(victoria?1.4:.8);
    await correr(o,tt=>{
      L.limpiar();const g=L.g;
      if(victoria){const v=campana(tt,finRunas+.1,finRunas+1.3);if(v>0){g.globalCompositeOperation='lighter';pintarSprite(g,dorado,cx,cy,PW*.75*(.6+v*.5),v*.7);
        for(let i=0;i<12;i++){const a=i/12*TAU+tt*.4,l=PW*(.5+v*.4);g.strokeStyle='rgba(255,230,160,'+.35*v+')';g.lineWidth=6*esc;g.beginPath();g.moveTo(cx+Math.cos(a)*PW*.2,cy+Math.sin(a)*PW*.2);g.lineTo(cx+Math.cos(a)*l,cy+Math.sin(a)*l);g.stroke();}
        g.globalCompositeOperation='source-over';}}
      g.globalAlpha=1;
      const abre=suave(entre(tt,.1,.65))*(1-suave(entre(tt,cierra,cierra+.45))),sube=salida(entre(tt,0,.35)),fade=1-entre(tt,cierra+.3,cierra+.55);
      g.save();g.globalAlpha=fade;g.translate(cx,cy-(1-sube)*R.h*.1);g.scale(1,.35+.65*sube);
      const half=PW/2*Math.max(.05,abre);
      g.fillStyle='rgba(0,0,0,.45)';g.fillRect(-half,-PH/2+6*esc,half*2,PH);
      g.drawImage(papelTex,(1-abre)*256,0,512*abre||1,160,-half,-PH/2,half*2,PH);
      // Runas.
      const rs=PH*.42,paso=(PW-PH*.5)/n;
      g.save();g.beginPath();g.rect(-half,-PH/2,half*2,PH);g.clip();g.lineCap='round';g.lineJoin='round';
      for(let j=0;j<n;j++){const x=-PW/2+PH*.25+paso*(j+.5),y=0,t=runa(j);
        let luz=j<antes?1:j<ahora?entre(tt,enciende(j),enciende(j)+.18):0;
        const final=victoria?campana(tt,finRunas+.1,finRunas+1.2):0;
        const traza=(col,w)=>{g.strokeStyle=col;g.lineWidth=w;g.beginPath();for(const [a,b,c,d]of t){g.moveTo(x+(a-.5)*rs,y+(b-.5)*rs);g.lineTo(x+(c-.5)*rs,y+(d-.5)*rs);}g.stroke();};
        traza('rgba(70,40,12,.6)',2.4*esc);
        if(luz>0){pintarSprite(g,halo,x,y,rs*(.75+final*.3),(.55+final*.3)*luz*fade);g.globalAlpha=fade*luz;traza('#8a4a06',4*esc);traza('#ffb829',2.4*esc);traza('#fff2b0',1*esc);g.globalAlpha=fade;
          const fl=j>=antes?Math.exp(-Math.pow((tt-enciende(j)-.06)*14,2)):0;if(fl>.02){g.globalCompositeOperation='lighter';pintarSprite(g,dorado,x,y,rs*1.1,fl*.8);g.globalCompositeOperation='source-over';g.globalAlpha=fade;}}
      }
      g.restore();
      const rod=PH*.16;rodillo(g,-half,0,PH*1.12,rod);rodillo(g,half,0,PH*1.12,rod);
      g.restore();
      g.globalAlpha=1;
      return tt<cierra+.6;
    },8);
    L.quitar();return true;
  }

  window.CAOZ_FX_PODERES=Object.freeze({esporas,infectar,curar,polimorfar,congelar,helar,descongelar,apagar,poseer,liberar,gracia,aturdir,despertar,risa,llave,pergamino,
    estados:nodo=>[...nodo.querySelectorAll(':scope > canvas.fxEstado')].map(c=>c.dataset.fxEstado)});
})();

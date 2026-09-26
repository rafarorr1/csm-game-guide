/* El campo de batalla según el Lugar en juego (prueba aislada, dev/secciones/lugares).
   Cada Lugar convierte la mesa en su escenario, en capas detrás de las cartas:
   fondo (su ilustración, oscurecida y con deriva lenta), velo para que se lean
   las cartas, suelo (material pintado una vez: piedra agrietada, tablones,
   adoquines, roca nevada, obsidiana) y ambiente (partículas y luz, Canvas 2D).
   El lado que lo controla lleva un borde de luz de su color. Al cambiar de
   Lugar, el nuevo se abre como un portal sobre el anterior.
   Encima de las cartas, una capa de efectos muestra sus reglas: el PD que se
   agrieta en Tomsage, el brindis del Antro, el d20 del Puente, la tirada de
   Aidman en las Montañas y la chispa del Domo.
   No toca el motor: recibe el id del Lugar y nodos del DOM. Sin dependencias. */
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
  const quieto=o=>{const q=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;return !!(o?.reducir??q?.matches);};
  const dprDe=()=>Math.min(devicePixelRatio||1,1.5);

  /* Cada Lugar: color de su lado, velo y tinte, y la receta de suelo y ambiente. */
  const LUGARES={
    tomsage:{nombre:'Tomsage bajo asedio',color:'#ff7a2a',tinte:'rgba(90,30,10,.22)',brillo:.38},
    antro:{nombre:'Antro Juan',color:'#ffc05a',tinte:'rgba(90,50,15,.18)',brillo:.4},
    puente:{nombre:'El Puente de Brick y Brock',color:'#9fc7ff',tinte:'rgba(30,40,80,.2)',brillo:.36},
    montanas:{nombre:'Las Montañas de Thal',color:'#bfe6ff',tinte:'rgba(40,60,90,.18)',brillo:.34},
    domo:{nombre:'El Domo',color:'#ff3d5a',tinte:'rgba(90,10,30,.22)',brillo:.42},
  };

  let estiloPuesto=false;
  function ponerEstilo(){
    if(estiloPuesto)return;estiloPuesto=true;const st=document.createElement('style');
    st.textContent=
      '.clEscena{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:inherit}'
      +'.clEscena>*{position:absolute;pointer-events:none}'
      +'.clFondo{inset:-6%;filter:blur(1.5px) brightness(.62) saturate(1.15);animation:clDeriva 38s ease-in-out infinite alternate}'
      +'.clFondoImg{position:absolute;inset:0;background:center/cover no-repeat}'
      +'.clEscena[data-propio] .clFondo{filter:brightness(.8) saturate(1.05)}.clEscena[data-propio] .clSuelo{display:none}'
      +'@keyframes clDeriva{from{transform:scale(1.02) translate(-1.2%,-.8%)}to{transform:scale(1.08) translate(1.2%,.8%)}}'
      +'.clVelo{inset:0}'
      +'.clSuelo,.clAmbiente{inset:0;width:100%;height:100%}'
      +'.clSuelo{-webkit-mask-image:radial-gradient(ellipse 58% 50% at 50% 52%,#000 30%,transparent 100%);mask-image:radial-gradient(ellipse 58% 50% at 50% 52%,#000 30%,transparent 100%)}'
      +'.clLado{left:0;right:0;transition:opacity .4s}'
      +'.clEfectos{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:40}'
      +'@media (prefers-reduced-motion:reduce){.clFondo{animation:none}}';
    document.head.append(st);
  }

  /* SUELOS: se pintan una vez por tamaño. */
  function pintarSuelo(id,g,W,H,semilla){
    const r=azar(semilla);g.clearRect(0,0,W,H);
    if(id==='tomsage'){
      // Losas agrietadas con brasas en las grietas.
      g.fillStyle='#2a2320';g.fillRect(0,0,W,H);
      const t=Math.max(70,W/9);
      for(let y=-t;y<H+t;y+=t*.8)for(let x=-t;x<W+t;x+=t){const ox=x+(r()-.5)*t*.3+(Math.round(y/t)%2)*t*.5,oy=y+(r()-.5)*t*.2,l=38+r()*22;
        g.fillStyle='rgb('+(l+6)+','+(l-2)+','+(l-8)+')';g.beginPath();g.moveTo(ox+4,oy+4);g.lineTo(ox+t-4+(r()-.5)*8,oy+3);g.lineTo(ox+t-3,oy+t*.8-4+(r()-.5)*8);g.lineTo(ox+3+(r()-.5)*8,oy+t*.8-3);g.fill();}
      for(let k=0;k<14;k++){let x=r()*W,y=r()*H,a=r()*TAU;const pts=[[x,y]];for(let i=0;i<9;i++){a+=(r()-.5)*1.2;x+=Math.cos(a)*t*.35;y+=Math.sin(a)*t*.35;pts.push([x,y]);}
        for(const [w,c]of [[5,'rgba(255,90,20,.18)'],[2,'rgba(255,140,40,.55)'],[1,'rgba(255,220,140,.7)']]){g.strokeStyle=c;g.lineWidth=w;g.beginPath();pts.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.stroke();}}
    }else if(id==='antro'){
      // Tablones de madera cálida con veta y manchas de cerveza.
      const alto=Math.max(46,H/9);
      for(let y=0,f=0;y<H;y+=alto,f++){let x=-r()*W*.3;while(x<W){const largo=W*(.25+r()*.35),l=r();
        const gr=g.createLinearGradient(0,y,0,y+alto);gr.addColorStop(0,'rgb('+(92+l*30)+','+(58+l*18)+','+(30+l*10)+')');gr.addColorStop(1,'rgb('+(70+l*24)+','+(42+l*14)+','+(22+l*8)+')');
        g.fillStyle=gr;g.fillRect(x,y,largo-3,alto-3);g.strokeStyle='rgba(40,22,10,.35)';g.lineWidth=1;
        for(let v=0;v<5;v++){const yy=y+alto*(.15+v*.17);g.beginPath();for(let xx=x;xx<x+largo-3;xx+=8)g.lineTo(xx,yy+Math.sin(xx*.02+v+f)*2.2);g.stroke();}
        g.fillStyle='rgba(15,8,3,.9)';g.fillRect(x+largo-3,y,3,alto);x+=largo;}
        g.fillStyle='rgba(15,8,3,.9)';g.fillRect(0,y+alto-3,W,3);}
      for(let k=0;k<7;k++){const x=r()*W,y=r()*H,rr=14+r()*22;g.strokeStyle='rgba(60,30,8,.35)';g.lineWidth=3;g.beginPath();g.arc(x,y,rr,0,TAU);g.stroke();g.fillStyle='rgba(200,140,40,.08)';g.fill();}
    }else if(id==='puente'){
      // Adoquines azulados con musgo; el puente cruza por el centro.
      g.fillStyle='#1e2230';g.fillRect(0,0,W,H);
      const t=Math.max(30,W/28);
      for(let y=0,f=0;y<H+t;y+=t*.72,f++)for(let x=(f%2)*t*.5;x<W+t;x+=t){const l=46+r()*26;
        g.fillStyle='rgb('+(l-4)+','+l+','+(l+14)+')';g.beginPath();g.ellipse(x+(r()-.5)*4,y+(r()-.5)*3,t*.44,t*.31,0,0,TAU);g.fill();
        if(r()<.2){g.fillStyle='rgba(90,130,60,.35)';g.beginPath();g.arc(x+t*.3,y+t*.2,t*.12,0,TAU);g.fill();}}
    }else if(id==='montanas'){
      // Roca gris azulada con nieve donde el ruido sube.
      const img=g.createImageData(Math.ceil(W/3),Math.ceil(H/3)),w=img.width,h=img.height;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=fbm(x/38+semilla,y/38),p=(y*w+x)*4,nieve=suave((n-.52)*6),roca=40+n*50;
        img.data[p]=roca+(230-roca)*nieve;img.data[p+1]=roca+6+(238-roca)*nieve;img.data[p+2]=roca+18+(250-roca)*nieve;img.data[p+3]=255;}
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(img,0,0);g.imageSmoothingEnabled=true;g.drawImage(c,0,0,W,H);
    }else if(id==='domo'){
      // Obsidiana con reflejos y un círculo de runas.
      const gr=g.createLinearGradient(0,0,W,H);gr.addColorStop(0,'#12060c');gr.addColorStop(.5,'#1e0812');gr.addColorStop(1,'#0c0409');g.fillStyle=gr;g.fillRect(0,0,W,H);
      for(let k=0;k<30;k++){const x=r()*W,y=r()*H;g.strokeStyle='rgba(160,40,90,'+(.05+r()*.08)+')';g.lineWidth=1+r()*2;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*W*.3,y+(r()-.5)*H*.3);g.stroke();}
      const R=Math.min(W,H)*.42;g.strokeStyle='rgba(255,60,90,.22)';g.lineWidth=2;for(const f of [1,.9])g.beginPath(),g.ellipse(W/2,H/2,R*f*1.4,R*f*.62,0,0,TAU),g.stroke();
      g.fillStyle='rgba(255,70,100,.3)';g.font='700 '+Math.round(R*.09)+'px '+TITULO;g.textAlign='center';g.textBaseline='middle';
      for(let i=0;i<24;i++){const a=i/24*TAU;g.save();g.translate(W/2+Math.cos(a)*R*1.33,H/2+Math.sin(a)*R*.59);g.rotate(a+Math.PI/2);g.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'[i],0,0);g.restore();}
    }
  }

  function mancha(rgb,a,centro){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32),col=x=>'rgba('+rgb.join(',')+','+x+')';
    if(centro){d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.28,col(a));}else{d.addColorStop(0,col(a));d.addColorStop(.5,col(a*.55));}d.addColorStop(1,col(0));g.fillStyle=d;g.fillRect(0,0,64,64);return c;}
  const S={};const sp=(k,...a)=>S[k]||(S[k]=mancha(...a));
  const pintar=(g,s,x,y,r,a)=>{if(a<=0||r<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(s,x-r,y-r,r*2,r*2);};

  // Silueta de dragón en vuelo (sombra de las Montañas).
  function dragon(g,x,y,s,aleteo){g.save();g.translate(x,y);g.scale(s,s);g.beginPath();
    g.moveTo(-60,0);g.quadraticCurveTo(-20,-6,10,-4);g.lineTo(55,-10);g.lineTo(62,-4);g.lineTo(40,2);g.quadraticCurveTo(10,8,-20,6);g.lineTo(-70,14);g.closePath();g.fill();
    const a=aleteo*28;for(const l of [-1,1]){g.beginPath();g.moveTo(-5,0);g.quadraticCurveTo(-10,l*(20+a),-50,l*(55+a));g.lineTo(-25,l*(30+a*.6));g.lineTo(-40,l*(42+a*.8));g.lineTo(-10,l*(18+a*.3));g.lineTo(20,l*4);g.closePath();g.fill();}
    g.restore();}

  /* EFECTOS DE AMBIENTE: piezas sueltas que cada mapa combina a su gusto.
     cuadro(g,t,dt,W,H,e,k): e es el estado de la escena (cada efecto guarda lo
     suyo en su propia clave) y k la intensidad (0,25–2; 1 es la de serie). */
  const EFECTOS={
    brasas:{nombre:'Brasas',icono:'🔥',cuadro(g,t,dt,W,H,e,k){
      const L=e.brasas||=[],brasa=sp('brasa',[255,120,30],.9,true),ceniza=sp('ceniza',[150,140,130],.6);
      if(Math.random()<dt*W/35*k)L.push({x:Math.random()*W,y:H+10,vx:(Math.random()-.5)*20,vy:-30-Math.random()*50,t:0,vida:3+Math.random()*3,r:1.5+Math.random()*2,c:Math.random()<.3});
      g.globalCompositeOperation='lighter';
      for(let i=L.length-1;i>=0;i--){const b=L[i];b.t+=dt;if(b.t>b.vida){L.splice(i,1);continue;}b.x+=(b.vx+Math.sin(b.t*2+i)*12)*dt;b.y+=b.vy*dt;pintar(g,b.c?ceniza:brasa,b.x,b.y,b.r*3,Math.sin(Math.PI*b.t/b.vida)*.9);}
    }},
    humo:{nombre:'Humo',icono:'🌫️',cuadro(g,t,dt,W,H,e,k){
      const L=e.humo||=[],humo=sp('humoT',[40,32,30],.35);
      if(Math.random()<dt*1.2*k)L.push({x:-80,y:H*(.2+Math.random()*.7),vx:25+Math.random()*25,t:0,r:70+Math.random()*80});
      for(let i=L.length-1;i>=0;i--){const h=L[i];h.t+=dt;h.x+=h.vx*dt;if(h.x>W+120){L.splice(i,1);continue;}pintar(g,humo,h.x,h.y+Math.sin(h.t*.5)*10,h.r,.55*Math.min(1,k));}
    }},
    proyectiles:{nombre:'Proyectiles ardientes',icono:'☄️',cuadro(g,t,dt,W,H,e,k){
      const L=e.bolas||=[],brasa=sp('brasa',[255,120,30],.9,true);e.sigBola??=2+Math.random()*3;
      e.sigBola-=dt*k;if(e.sigBola<=0){e.sigBola=3+Math.random()*5;L.push({x0:W*(Math.random()<.5?.1:.9),x1:W*(.3+Math.random()*.4),t:0});}
      g.globalCompositeOperation='lighter';
      for(let i=L.length-1;i>=0;i--){const b=L[i];b.t+=dt;const p=b.t/1.3;if(p>1.4){L.splice(i,1);continue;}
        const py=q=>H*.05+Math.sin(Math.PI*q)*-H*.04+q*H*.12;
        if(p<1){for(let n=0;n<6;n++){const q=Math.max(0,p-n*.03);pintar(g,brasa,b.x0+(b.x1-b.x0)*q,py(q),10-n*1.4,.9-n*.14);}}
        else{const f=1-entre(p,1,1.4);pintar(g,brasa,b.x1,H*.17,60*(1.4-f),f*.8);e.golpe=f;}}
    }},
    velas:{nombre:'Luz de velas',icono:'🕯️',cuadro(g,t,dt,W,H,e,k){
      const vela=sp('vela',[255,170,70],.4);g.globalCompositeOperation='lighter';
      [[.12,.18],[.88,.22],[.5,.08]].forEach(([u,v],i)=>{const p=.75+.15*Math.sin(t*9+i*3)+.1*Math.sin(t*23+i);pintar(g,vela,u*W,v*H,H*.55,.45*p*k);});
    }},
    polvo:{nombre:'Polvo dorado',icono:'✨',cuadro(g,t,dt,W,H,e,k){
      const n=Math.round(W*H/9000*k),L=e.polvo||=[],mota=sp('mota',[255,215,140],.8,true);
      while(L.length<n)L.push({x:Math.random()*W,y:Math.random()*H,f:Math.random()*TAU,r:1+Math.random()*2});L.length=Math.min(L.length,n);
      g.globalCompositeOperation='lighter';
      for(const m of L){m.f+=dt*.4;m.x+=Math.sin(m.f)*6*dt;m.y-=4*dt;if(m.y<-5)m.y=H+5;pintar(g,mota,m.x,m.y,m.r*2.2,.35+.3*Math.sin(m.f*3));}
    }},
    niebla:{nombre:'Niebla',icono:'🌁',cuadro(g,t,dt,W,H,e,k){
      const L=e.niebla||=Array.from({length:9},()=>({x:Math.random()*W,y:H*(.35+Math.random()*.6),v:8+Math.random()*14,r:H*(.18+Math.random()*.16)})),niebla=sp('niebla',[170,180,210],.2);
      for(const n of L){n.x+=n.v*dt;if(n.x-n.r>W)n.x=-n.r;pintar(g,niebla,n.x,n.y+Math.sin(t*.3+n.v)*8,n.r,.7*k);}
    }},
    guardianes:{nombre:'Guardianes de piedra',icono:'🗿',cuadro(g,t,dt,W,H,e,k){
      const farol=sp('farol',[255,200,110],.7,true),alto=Math.min(H*.3,140),y=(e.linea??H/2)+alto*.08;
      for(const lado of [-1,1]){const x=lado<0?W*.06:W*.94;g.save();g.translate(x,y);g.scale(-lado,1);guardian(g,alto,e.martillos??0,t);g.restore();
        g.globalCompositeOperation='lighter';pintar(g,farol,x-lado*alto*.35,y-alto*.55,alto*.25,(.6+.2*Math.sin(t*7+lado))*Math.min(1.5,k));g.globalCompositeOperation='source-over';}
    }},
    nieve:{nombre:'Nieve',icono:'❄️',cuadro(g,t,dt,W,H,e,k){
      const n=Math.round(W*H/5000*k),L=e.nieve||=[];while(L.length<n)L.push({x:Math.random()*W,y:Math.random()*H,z:.4+Math.random()*.9});L.length=Math.min(L.length,n);
      const viento=1+.8*Math.max(0,Math.sin(t*.35));g.fillStyle='rgba(245,250,255,.85)';
      for(const f of L){f.x+=(28*viento+Math.sin(t+f.z*9)*8)*f.z*dt;f.y+=38*f.z*dt;if(f.y>H+4){f.y=-4;f.x=Math.random()*W;}if(f.x>W+4)f.x=-4;g.globalAlpha=.35+.5*f.z;g.beginPath();g.arc(f.x,f.y,1+f.z*1.6,0,TAU);g.fill();}
    }},
    lluvia:{nombre:'Lluvia',icono:'🌧️',cuadro(g,t,dt,W,H,e,k){
      const n=Math.round(W*H/4000*k),L=e.lluvia||=[];while(L.length<n)L.push({x:Math.random()*W,y:Math.random()*H,v:600+Math.random()*400,l:10+Math.random()*14});L.length=Math.min(L.length,n);
      g.strokeStyle='rgba(180,200,235,.45)';g.lineWidth=1.1;g.beginPath();
      for(const d of L){d.y+=d.v*dt;d.x+=d.v*.18*dt;if(d.y>H){d.y=-d.l;d.x=Math.random()*W*1.1-W*.1;}g.moveTo(d.x,d.y);g.lineTo(d.x-d.l*.18,d.y-d.l);}g.stroke();
    }},
    relampagos:{nombre:'Relámpagos',icono:'⚡',cuadro(g,t,dt,W,H,e,k){
      e.sigRayo??=3;e.sigRayo-=dt*k;if(e.sigRayo<=0){e.sigRayo=4+Math.random()*7;e.rayo={t:0,x:W*(.15+Math.random()*.7),semilla:Math.random()*999};}
      const r=e.rayo;if(!r)return;r.t+=dt;if(r.t>.5){e.rayo=null;return;}
      const a=(r.t<.08?1:r.t<.14?.3:r.t<.2?.8:1-entre(r.t,.2,.5));g.fillStyle='rgba(220,230,255,'+.22*a+')';g.fillRect(0,0,W,H);
      const q=azar(Math.floor(r.semilla));let x=r.x,y=0;g.strokeStyle='rgba(235,240,255,'+.9*a+')';g.lineWidth=2.4;g.beginPath();g.moveTo(x,y);
      while(y<H*.55){x+=(q()-.5)*40;y+=18+q()*22;g.lineTo(x,y);}g.stroke();
    }},
    luciernagas:{nombre:'Luciérnagas',icono:'🪲',cuadro(g,t,dt,W,H,e,k){
      const n=Math.round(22*k),L=e.luciernagas||=[],luz=sp('luciernaga',[210,255,120],.8,true);
      while(L.length<n)L.push({x:Math.random()*W,y:H*(.2+Math.random()*.75),a:Math.random()*TAU,f:Math.random()*TAU,v:10+Math.random()*16});L.length=Math.min(L.length,n);
      g.globalCompositeOperation='lighter';
      for(const f of L){f.a+=(Math.random()-.5)*dt*2;f.x+=Math.cos(f.a)*f.v*dt;f.y+=Math.sin(f.a)*f.v*dt*.6;f.f+=dt*(1.5+f.v*.05);
        if(f.x<0)f.x+=W;if(f.x>W)f.x-=W;if(f.y<H*.1||f.y>H)f.a+=Math.PI;pintar(g,luz,f.x,f.y,7,Math.max(0,Math.sin(f.f))*.9);}
    }},
    dragon:{nombre:'Sombra de dragón',icono:'🐉',cuadro(g,t,dt,W,H,e,k){
      e.sombra??=6;e.sombra-=dt*k;if(e.sombra<-3.5)e.sombra=9+Math.random()*8;
      if(e.sombra<0){const p=Math.min(1,-e.sombra/3.5);g.fillStyle='rgba(5,10,20,'+(.32*Math.sin(Math.PI*p))+')';g.filter='blur(6px)';dragon(g,-W*.2+p*W*1.4,H*(.75-p*.5),Math.min(W,H)/160,Math.sin(t*6));g.filter='none';}
    }},
    cupula:{nombre:'Cúpula de energía',icono:'🔴',cuadro(g,t,dt,W,H,e,k){
      e.venas||=(()=>{const r=azar(5),v=[];for(let n=0;n<12;n++){let a=Math.PI+r()*Math.PI,d=0;const p=[];for(let i=0;i<14;i++){p.push([a,d]);a+=(r()-.5)*.12;d+=.07;}v.push(p);}return v;})();
      const pulso=(.55+.25*Math.sin(t*1.6)+(e.destello||0))*Math.min(1.6,k),cx=W/2,cy=H*1.02,rx=W*.62,ry=H*1.02;
      const gr=g.createRadialGradient(cx,cy,ry*.6,cx,cy,ry*1.05);gr.addColorStop(0,'rgba(255,40,70,0)');gr.addColorStop(.85,'rgba(255,40,80,'+.1*pulso+')');gr.addColorStop(1,'rgba(255,60,90,'+.3*pulso+')');
      g.fillStyle=gr;g.beginPath();g.ellipse(cx,cy,rx*1.05,ry*1.05,0,Math.PI,TAU);g.fill();
      g.globalCompositeOperation='lighter';g.strokeStyle='rgba(255,70,110,'+.5*pulso+')';g.lineWidth=2.5;g.beginPath();g.ellipse(cx,cy,rx,ry,0,Math.PI,TAU);g.stroke();
      e.venas.forEach((v,n)=>{const fase=(t*.35+n/12)%1;g.strokeStyle='rgba(200,80,255,'+(.25+.5*Math.sin(Math.PI*fase))*pulso+')';g.lineWidth=1.4;g.beginPath();
        v.forEach(([a,d],i)=>{const f=1-d*.55,x=cx+Math.cos(a)*rx*f,y=cy+Math.sin(a)*ry*f;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();});
    }},
    ascuas:{nombre:'Ascuas rojas',icono:'🩸',cuadro(g,t,dt,W,H,e,k){
      const L=e.ascuas||=[],m=sp('motaD',[255,70,110],.8,true);if(Math.random()<dt*6*k)L.push({x:Math.random()*W,y:H,vy:-20-Math.random()*30,t:0,vida:4});
      g.globalCompositeOperation='lighter';
      for(let i=L.length-1;i>=0;i--){const q=L[i];q.t+=dt;if(q.t>q.vida){L.splice(i,1);continue;}q.y+=q.vy*dt;pintar(g,m,q.x+Math.sin(q.t*2+i)*8,q.y,3,Math.sin(Math.PI*q.t/q.vida)*.8);}
    }},
  };
  // Los efectos de serie de cada Lugar.
  const DE_SERIE={tomsage:['humo','brasas','proyectiles'],antro:['velas','polvo'],puente:['niebla','guardianes'],montanas:['nieve','dragon'],domo:['cupula','ascuas']};
  // Orden de dibujo: lo que cubre la mesa entera primero, las partículas encima.
  const ORDEN=['cupula','humo','niebla','velas','guardianes','dragon','relampagos','lluvia','nieve','polvo','luciernagas','brasas','ascuas','proyectiles'];
  function efectosDe(id,f){
    const lista=f?.efectos===false?[]:Array.isArray(f?.efectos)?f.efectos:DE_SERIE[id]||[];
    return ORDEN.filter(k=>lista.includes(k));
  }
  // Un guardián de piedra estilizado (mirando hacia el centro), con su martillo:
  // brazo 0 = martillo en reposo; 1 = cruzado sobre el puente.
  function guardian(g,alto,brazo,t){
    const s=alto/150;g.save();g.scale(s,s);
    const piedra=g.createLinearGradient(-40,-150,40,0);piedra.addColorStop(0,'#7b7f8a');piedra.addColorStop(.5,'#4a4d57');piedra.addColorStop(1,'#1f2128');
    g.fillStyle=piedra;g.strokeStyle='#0c0d12';g.lineWidth=4;g.lineJoin='round';
    // Pedestal, cuerpo con hombros y cabeza cuadrada.
    g.fillRect(-40,-12,80,14);g.strokeRect(-40,-12,80,14);
    g.beginPath();g.moveTo(-26,-12);g.lineTo(-30,-78);g.lineTo(-44,-96);g.lineTo(-30,-112);g.lineTo(30,-112);g.lineTo(44,-96);g.lineTo(30,-78);g.lineTo(26,-12);g.closePath();g.fill();g.stroke();
    g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=2;for(const y of [-40,-64,-88]){g.beginPath();g.moveTo(-26,y);g.lineTo(26,y+3);g.stroke();}
    g.fillStyle=piedra;g.strokeStyle='#0c0d12';g.lineWidth=4;g.beginPath();g.rect(-17,-146,34,32);g.fill();g.stroke();
    g.fillStyle='rgba(120,200,255,'+(.7+.3*Math.sin(t*2))+')';g.fillRect(-10,-134,7,4);g.fillRect(3,-134,7,4);
    // El martillo: en reposo apoyado en el suelo; cruzado, sobre el puente.
    g.save();g.translate(34,-92);g.rotate(-.12+brazo*1.7);g.fillStyle='#4a3726';g.strokeStyle='#0c0d12';g.lineWidth=3;g.fillRect(-4,0,9,88);g.strokeRect(-4,0,9,88);
    g.fillStyle=piedra;g.fillRect(-20,80,42,30);g.strokeRect(-20,80,42,30);g.restore();
    g.restore();
  }
  // El dado de veinte caras: hexágono con facetas y el número en su cara.
  function d20(g,x,y,r,n,rot,estilo){
    g.save();g.translate(x,y);g.rotate(rot);
    const hielo=estilo==='hielo',pts=[...Array(6)].map((_,i)=>[Math.cos(i*Math.PI/3-Math.PI/2)*r,Math.sin(i*Math.PI/3-Math.PI/2)*r]);
    const gr=g.createLinearGradient(-r,-r,r,r);gr.addColorStop(0,hielo?'rgba(230,248,255,.95)':'#b9b3a6');gr.addColorStop(1,hielo?'rgba(110,170,220,.9)':'#4d4840');
    g.fillStyle=gr;g.strokeStyle=hielo?'#e8f8ff':'#221f1a';g.lineWidth=r*.06;g.beginPath();pts.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fill();g.stroke();
    const tri=[[0,-r*.55],[r*.5,r*.32],[-r*.5,r*.32]];g.beginPath();tri.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.stroke();
    for(let i=0;i<6;i++){const [a,b]=pts[i],[c,d]=tri[[0,1,1,2,2,0][i]];g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke();}
    g.rotate(-rot);g.fillStyle=hielo?'#0d3552':'#fff4d6';g.font='900 '+Math.round(r*.46)+'px '+TITULO;g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),0,r*.04);
    g.restore();
  }

  function caja(nodo,host){const a=nodo.getBoundingClientRect(),b=host.getBoundingClientRect(),r={x:a.left-b.left,y:a.top-b.top,w:a.width,h:a.height};r.cx=r.x+r.w/2;r.cy=r.y+r.h/2;return r;}

  /* crear(host,{arte,fondo,linea,reducir}) → {poner(id,{lado}), quitar, fondoCambiado, perderPD, brindis, ataqueAlma, tiradaAidman, muerte, lugar, destruir}
     host: la mesa (position:relative); sus hijos deben ir por encima (z-index ≥ 1).
     arte(id) → url de la ilustración; fondo(id) → lo que el Estudio guardó para ese mapa,
     {url,x,y,z,efectos,intensidad} o null: url y encuadre (0–100, zoom 50–300)
     de un fondo propio; efectos, la lista de EFECTOS que lleva encima (sin ella,
     los de serie del Lugar; [] ninguno) e intensidad (0,25–2). Con fondo propio
     el escenario lo muestra tal cual, más claro y sin el suelo pintado; el
     ambiente y las reglas siguen. linea: el nodo que separa los dos campos
     (el Puente la usa y el borde de cada lado se corta ahí). */
  function crear(host,op={}){
    ponerEstilo();
    const arte=op.arte||(id=>'art/'+id+'.webp');
    let escena=null,raf=0,destruido=false;
    const efectos=document.createElement('canvas');efectos.className='clEfectos';efectos.setAttribute('aria-hidden','true');host.append(efectos);
    const ge=efectos.getContext('2d');
    const medir=()=>{const r=host.getBoundingClientRect();return {W:r.width,H:r.height};};
    const lineaY=()=>{if(!op.linea)return medir().H/2;const r=caja(op.linea,host);return r.cy;};

    function hacerEscena(id,lado){
      const L=LUGARES[id],div=document.createElement('div');div.className='clEscena';div.dataset.escena=id;div.setAttribute('aria-hidden','true');
      const fondo=document.createElement('div');fondo.className='clFondo';const img=document.createElement('div');img.className='clFondoImg';fondo.append(img);
      const velo=document.createElement('div');velo.className='clVelo';
      const suelo=document.createElement('canvas');suelo.className='clSuelo';suelo.style.opacity=String(L.brillo);
      const amb=document.createElement('canvas');amb.className='clAmbiente';
      const ladoDiv=document.createElement('div');ladoDiv.className='clLado';
      div.append(fondo,velo,suelo,amb,ladoDiv);host.prepend(div);
      const e={id,div,fondo,img,velo,suelo,amb,ladoDiv,lado,estado:{},W:0,H:0,t0:performance.now()};
      vestirFondo(e);ajustar(e);return e;
    }
    // La imagen del fondo: la propia del Estudio, con su encuadre, o la ilustración del Lugar.
    function vestirFondo(e){
      let f=null;try{f=op.fondo?.(e.id)||null;}catch(_){f=null;}
      const ok=f&&typeof f.url==='string'&&f.url,x=ok?acotar(+f.x||50,0,100):50,y=ok?acotar(+f.y||50,0,100):50,z=ok?acotar((+f.z||100)/100,.5,3):1;
      e.img.style.backgroundImage='url("'+String(ok?f.url:arte(e.id)).replace(/["\\\n]/g,'')+'")';
      e.img.style.backgroundPosition=x+'% '+y+'%';e.img.style.transformOrigin=x+'% '+y+'%';e.img.style.transform=z===1?'':'scale('+z+')';
      if(ok)e.div.dataset.propio='';else delete e.div.dataset.propio;
      // Cada mapa lleva sus propios efectos (los de serie si no se eligieron) e intensidad.
      e.efectos=efectosDe(e.id,f);e.intensidad=acotar(Number.isFinite(+f?.intensidad)?+f.intensidad:1,.25,2);
e.div.dataset.efectos=e.efectos.join(' ');
      e.amb.style.display=e.efectos.length?'':'none';if(quieto(op)&&e.W)ajustar(e);
      const L=LUGARES[e.id];e.velo.style.background=ok?'radial-gradient(ellipse 55% 50% at 50% 52%,rgba(6,4,10,.32),transparent 80%)':'radial-gradient(ellipse 60% 55% at 50% 52%,rgba(6,4,10,.5),rgba(6,4,10,.15) 75%,transparent),linear-gradient('+L.tinte+','+L.tinte+')';
    }
    // El Estudio cambió el fondo: se repinta la escena en curso sin portal.
    function fondoCambiado(){if(escena)vestirFondo(escena);}
    function ajustar(e){
      const {W,H}=medir(),dpr=dprDe();if(!W||!H)return;e.W=W;e.H=H;
      for(const c of [e.suelo,e.amb]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}
      const gs=e.suelo.getContext('2d');gs.setTransform(dpr,0,0,dpr,0,0);pintarSuelo(e.id,gs,W,H,7);
      e.estado.linea=lineaY();
      const y=e.estado.linea,L=LUGARES[e.id],arriba=e.lado==='arriba';
      Object.assign(e.ladoDiv.style,arriba?{top:'0',height:y+'px',bottom:''}:{top:y+'px',height:(H-y)+'px'});
      e.ladoDiv.style.background='linear-gradient('+(arriba?'180deg':'0deg')+','+L.color+'44,transparent 22%)';
      e.ladoDiv.style.borderTop=arriba?'':'2px solid '+L.color+'aa';e.ladoDiv.style.borderBottom=arriba?'2px solid '+L.color+'aa':'';
      e.ladoDiv.style.display=e.lado?'':'none';
      const de=dprDe();efectos.width=Math.round(W*de);efectos.height=Math.round(H*de);
      // Sin movimiento: un fotograma quieto, tras simular unos segundos de ambiente.
      if(quieto(op))for(let i=0;i<=80;i++)pintarAmbiente(e,i*.05,.05);
    }
    function pintarAmbiente(e,t,dt){
      const g=e.amb.getContext('2d'),dpr=dprDe();g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,e.W,e.H);
      e.estado.linea=e.estado.linea??lineaY();
      for(const k of e.efectos||[]){g.save();EFECTOS[k].cuadro(g,t,dt,e.W,e.H,e.estado,e.intensidad??1);g.restore();g.globalAlpha=1;g.globalCompositeOperation='source-over';}
      if(e.estado.golpe>0){e.fondo.style.translate=(Math.random()-.5)*6*e.estado.golpe+'px '+(Math.random()-.5)*4*e.estado.golpe+'px';e.estado.golpe=0;}else e.fondo.style.translate='';
    }
    let antes=0;
    function bucle(ahora){
      raf=0;if(destruido||!escena)return;
      const dt=antes?Math.min(.05,(ahora-antes)/1000):0;antes=ahora;
      if(!document.hidden&&!quieto(op))for(const e of [escena,escena.saliente].filter(Boolean))pintarAmbiente(e,(ahora-e.t0)/1000,dt);
      raf=requestAnimationFrame(bucle);
    }
    const arrancar=()=>{if(!raf&&!quieto(op)){antes=0;raf=requestAnimationFrame(bucle);}};
    const ro=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(escena)ajustar(escena);}):null;ro?.observe(host);

    // El reloj de un efecto: tt en segundos (o el reloj de revisión).
    function correr(o,cuadro,limite){
      const vel=o.velocidad||1;
      return new Promise(res=>{let t0=0,ant=-1,r=0,fin=false;const acabar=()=>{if(fin)return;fin=true;cancelAnimationFrame(r);clearTimeout(seg);res(true);};
        const seg=setTimeout(acabar,(limite+3)*1000/vel);
        const paso=ahora=>{r=0;if(fin)return;if(!t0)t0=ahora;const tt=typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*vel,dt=ant<0?0:Math.min(.1,Math.max(0,tt-ant));ant=tt;
          let seguir=false;try{seguir=cuadro(tt,dt);}catch(e){console.error(e);}if(seguir===false||tt>limite+2){acabar();return;}r=requestAnimationFrame(paso);};
        r=requestAnimationFrame(paso);});
    }
    // Los efectos dibujan, de uno en uno, en la capa de arriba.
    function efecto(o,dibujo,limite){
      const limpiar=()=>{const {W,H}=medir(),d=dprDe();ge.setTransform(d,0,0,d,0,0);ge.globalAlpha=1;ge.globalCompositeOperation='source-over';ge.clearRect(0,0,W,H);};
      return correr(o,(tt,dt)=>{limpiar();const seguir=dibujo(ge,tt,dt)!==false;ge.globalAlpha=1;ge.globalCompositeOperation='source-over';return seguir;},limite).then(()=>{limpiar();return true;});
    }

    /* poner(id,{lado,desde,velocidad,reloj}): abre el Lugar como un portal
       desde el centro (o desde el nodo desde) sobre el que hubiera. */
    async function poner(id,o={}){
      if(!LUGARES[id])return quitar(o);
      if(escena&&escena.id===id){escena.lado=o.lado;ajustar(escena);return false;}
      const vieja=escena,nueva=hacerEscena(id,o.lado);host.dataset.campoLugar=id;
      if(vieja){host.prepend(vieja.div);vieja.div.after(nueva.div);}
      escena=nueva;nueva.saliente=vieja;arrancar();
      if(quieto(o)||quieto(op)){vieja?.div.remove();nueva.saliente=null;return false;}
      const {W,H}=medir(),D=o.desde?caja(o.desde,host):{cx:W/2,cy:H/2},radio=Math.hypot(Math.max(D.cx,W-D.cx),Math.max(D.cy,H-D.cy)),col=LUGARES[id].color,chispa=sp('chispa'+id,[255,230,190],.9,true);
      nueva.div.style.clipPath='circle(0px at '+D.cx+'px '+D.cy+'px)';
      await efecto(o,(g,tt)=>{
        const p=salida(entre(tt,0,1.1)),r=radio*p;nueva.div.style.clipPath='circle('+r+'px at '+D.cx+'px '+D.cy+'px)';
        if(p<1){g.globalCompositeOperation='lighter';g.strokeStyle=col;g.globalAlpha=.9*(1-p*.6);g.lineWidth=6;g.beginPath();g.arc(D.cx,D.cy,r,0,TAU);g.stroke();
          g.lineWidth=16;g.globalAlpha=.25*(1-p);g.stroke();pintar(g,chispa,D.cx,D.cy,90*(1-p)+20,(1-p));}
        return tt<1.15;
      },2);
      nueva.div.style.clipPath='';vieja?.div.remove();nueva.saliente=null;return true;
    }
    async function quitar(o={}){
      host.dataset.campoLugar='';const e=escena;escena=null;if(!e)return false;
      if(quieto(o)||quieto(op)){e.div.remove();return false;}
      await correr(o,tt=>{e.div.style.opacity=String(1-entre(tt,0,.5));return tt<.5;},1);e.div.remove();return true;
    }

    /* REGLAS VISIBLES */
    // Tomsage: al inicio de turno, un cristal de PD máximo se agrieta y se apaga.
    function perderPD(cristal,o={}){
      if(!cristal||quieto(o)||quieto(op)){try{o.alApagar?.();}catch(_){}return Promise.resolve(false);}
      const R=caja(cristal,host),grietas=Array.from({length:6},(_,i)=>{const a=i/6*TAU+Math.random()*.5;return [a,.4+Math.random()*.6];}),brasa=sp('brasa',[255,120,30],.9,true);let apagado=false;
      return efecto(o,(g,tt)=>{
        const p=entre(tt,.1,.5),s=Math.max(R.w,R.h);
        g.strokeStyle='rgba(255,200,150,'+(1-entre(tt,1,1.4))+')';g.lineWidth=1.6;
        for(const [a,l]of grietas){g.beginPath();g.moveTo(R.cx,R.cy);g.lineTo(R.cx+Math.cos(a)*s*.6*l*p,R.cy+Math.sin(a)*s*.6*l*p);g.stroke();}
        g.globalCompositeOperation='lighter';pintar(g,brasa,R.cx,R.cy,s*1.4,campana(tt,0,.6)*.8);
        if(tt>=.5&&!apagado){apagado=true;try{o.alApagar?.();}catch(_){}cristal.animate?.([{transform:'scale(1)'},{transform:'scale(.8)'},{transform:'scale(1)'}],{duration:300});}
        for(let i=0;i<8;i++){const a=i/8*TAU,d=entre(tt,.5,1.1);pintar(g,brasa,R.cx+Math.cos(a)*s*d,R.cy+Math.sin(a)*s*d+d*d*20,4,(1-d)*.9);}
        return tt<1.4;
      },3);
    }
    // Antro: dos jarras chocan sobre el PD y una carta vuela del mazo a la mano.
    function brindis(desde,hasta,o={}){
      if(!desde||!hasta||quieto(o)||quieto(op)){try{o.alRobar?.();}catch(_){}return Promise.resolve(false);}
      const D=caja(desde,host),A=caja(hasta,host),s=Math.max(28,Math.min(60,D.h*1.2)),espuma=sp('espuma',[255,250,230],.9,true),gotas=[];let robada=false;
      const jarra=(g,x,y,ang,lado)=>{g.save();g.translate(x,y);g.rotate(ang);g.scale(lado,1);g.fillStyle='#c98a2a';g.strokeStyle='#3a2208';g.lineWidth=2;g.beginPath();g.rect(-s*.28,-s*.4,s*.56,s*.8);g.fill();g.stroke();
        g.fillStyle='#fff7e6';g.beginPath();g.ellipse(0,-s*.42,s*.32,s*.12,0,0,TAU);g.fill();g.beginPath();g.arc(s*.34,0,s*.16,-1.3,1.3);g.stroke();g.restore();};
      return efecto(o,(g,tt,dt)=>{
        const p=entre(tt,0,.45),x=D.cx,y=D.y-s*.6,sep=s*.9*(1-suave(p)),ang=.5*(1-p)-(tt>.45?.15*campana(tt,.45,.75):0);
        if(tt<1.1){g.globalAlpha=1-entre(tt,.9,1.1);jarra(g,x-sep-s*.18,y,ang,1);jarra(g,x+sep+s*.18,y,-ang,-1);}
        if(tt>=.45&&!gotas.length)for(let i=0;i<22;i++){const a=-Math.PI/2+(Math.random()-.5)*2.2,v=60+Math.random()*120;gotas.push({x,y:y-s*.4,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0});}
        g.globalAlpha=1;for(const d of gotas){d.t+=dt;d.vy+=380*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;pintar(g,espuma,d.x,d.y,4,1-d.t/1);}
        const c=entre(tt,.7,1.4);
        if(c>0&&c<1){const e=suave(c),cx=D.cx+(A.cx-D.cx)*e,cy=D.cy+(A.cy-D.cy)*e-Math.sin(Math.PI*c)*60,w=s*.8;g.save();g.translate(cx,cy);g.rotate(c*TAU);g.globalAlpha=1;
          g.fillStyle='#3a2458';g.strokeStyle='#e7bb55';g.lineWidth=2;g.fillRect(-w/2,-w*.7,w,w*1.4);g.strokeRect(-w/2,-w*.7,w,w*1.4);g.restore();}
        if(c>=1&&!robada){robada=true;try{o.alRobar?.();}catch(_){}hasta.animate?.([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:350});}
        return tt<1.55;
      },3);
    }
    // Puente: un d20 de piedra rueda hasta el puente. Con 8+ los guardianes
    // se apartan y el ataque pasa; si no, cruzan los martillos. → Promise<exito>
    async function ataqueAlma(atacante,tirada,o={}){
      const exito=tirada>=8;
      if(!atacante||quieto(o)||quieto(op)||escena?.id!=='puente')return exito;
      const A=caja(atacante,host),{W}=medir(),y=lineaY(),r=Math.max(26,Math.min(54,A.w*.34)),chispa=sp('chispaP',[255,230,150],.9,true);
      await efecto(o,(g,tt)=>{
        const p=entre(tt,0,1.1),e=salida(p),x=A.cx+(W/2-A.cx)*e,yy=A.cy+(y-A.cy)*e-Math.abs(Math.sin(p*Math.PI*3))*40*(1-p);
        const n=p<1?1+Math.floor(hash(Math.floor(tt*14),3)*20):tirada;
        g.globalAlpha=1-entre(tt,2.2,2.5);d20(g,x,yy,r,n,(1-e)*TAU*3,'piedra');
        if(escena&&escena.id==='puente'){const q=entre(tt,1.2,1.6);escena.estado.martillos=exito?-.35*campana(tt,1.2,2.4):salida(q)*(1-entre(tt,2.1,2.5));}
        // Si no pasa, dos martillos de piedra caen y se cruzan sobre el puente;
        // si pasa, se abre un camino de luz hacia el campo rival.
        const fuera=1-entre(tt,2.1,2.5);
        if(!exito&&tt>1.1)for(const lado of [-1,1]){const q=entre(tt,1.1,1.42),ang=lado*(.6-1.42*salida(q)+(q>=1?.06*Math.sin((tt-1.42)*30)*Math.exp(-(tt-1.42)*8):0));
          g.save();g.globalAlpha=fuera;g.translate(W/2+lado*r*3.2,y-r*.2);g.rotate(ang);g.fillStyle='#4a3726';g.strokeStyle='#0c0d12';g.lineWidth=3;g.fillRect(-r*.12,-r*3.6,r*.24,r*3.6);g.strokeRect(-r*.12,-r*3.6,r*.24,r*3.6);
          const pg=g.createLinearGradient(-r,-r*4.2,r,-r*3.4);pg.addColorStop(0,'#8a8f9c');pg.addColorStop(1,'#2f323b');g.fillStyle=pg;g.fillRect(-r*.9,-r*4.3,r*1.8,r*1.1);g.strokeRect(-r*.9,-r*4.3,r*1.8,r*1.1);g.restore();}
        if(!exito&&tt>1.42){const d=entre(tt,1.42,2);for(let i=0;i<10;i++){const a=-Math.PI/2+(i/9-.5)*2.6;pintar(g,sp('polvoP',[150,140,130],.6),W/2+Math.cos(a)*r*(1+d*3),y-r*2.2+Math.sin(a)*r*(.5+d*1.5),r*(.4+d*.6),(1-d)*.7*fuera);}}
        if(exito&&tt>1.2){const q=campana(tt,1.2,2.4),top=y-(y-r)*salida(entre(tt,1.2,1.7)),cam=g.createLinearGradient(0,y,0,top);cam.addColorStop(0,'rgba(255,225,140,'+.55*q+')');cam.addColorStop(1,'rgba(255,225,140,0)');
          g.globalCompositeOperation='lighter';g.fillStyle=cam;g.beginPath();g.moveTo(W/2-r*1.2,y);g.lineTo(W/2+r*1.2,y);g.lineTo(W/2+r*.4,top);g.lineTo(W/2-r*.4,top);g.fill();g.globalCompositeOperation='source-over';}
        g.globalAlpha=1;
        const fl=Math.exp(-Math.pow((tt-1.25)*6,2));
        g.globalCompositeOperation='lighter';pintar(g,exito?chispa:sp('rojo',[255,60,40],.8,true),W/2,y,r*4,fl);g.globalCompositeOperation='source-over';
        if(tt>1.2){g.globalAlpha=campana(tt,1.2,2.5);g.font='900 '+Math.round(r*.7)+'px '+TITULO;g.textAlign='center';g.lineWidth=5;g.strokeStyle='#120a04';g.fillStyle=exito?'#ffe08a':'#ff7a6a';
          const txt=exito?'¡Pasa!':'¡No pasa!';g.strokeText(txt,W/2,y+r*1.9);g.fillText(txt,W/2,y+r*1.9);}
        return tt<2.5;
      },4);
      if(escena)escena.estado.martillos=0;return exito;
    }
    // Montañas: un d20 de hielo cae; con 1-3, un alud trae a Aidman al campo rival.
    async function tiradaAidman(tirada,o={}){
      const aparece=tirada<=3;
      if(quieto(o)||quieto(op)){if(aparece)try{o.alAparecer?.();}catch(_){}return aparece;}
      const {W,H}=medir(),y=lineaY(),r=Math.max(24,Math.min(50,W*.035)),D=o.destino?caja(o.destino,host):{cx:W/2,cy:y-H*.25},copos=[];let hecho=false;
      const nieve=sp('nieveA',[240,248,255],.85),blanco=sp('blanco',[235,245,255],.9,true);
      await efecto(o,(g,tt,dt)=>{
        const p=entre(tt,0,1),rebote=Math.abs(Math.sin(p*Math.PI*2.5))*(1-p),yy=-r+(y+r)*salida(Math.min(1,p*1.4))-rebote*60;
        g.globalAlpha=1-entre(tt,aparece?2.6:1.9,aparece?2.9:2.2);d20(g,W/2,yy,r,p<1?1+Math.floor(hash(Math.floor(tt*14),9)*20):tirada,(1-p)*TAU*2.5,'hielo');
        g.globalAlpha=campana(tt,1,2.2);g.font='900 '+Math.round(r*.62)+'px '+TITULO;g.textAlign='center';g.lineWidth=5;g.strokeStyle='#08121c';g.fillStyle=aparece?'#ffffff':'#cfeaff';
        const txt=aparece?'¡Aidman baja de la montaña!':'No aparece nadie';g.strokeText(txt,W/2,y+r*2);g.fillText(txt,W/2,y+r*2);
        if(aparece&&tt>1.1){if(tt<1.9)for(let k=0;k<10;k++)copos.push({x:D.cx+(Math.random()-.5)*W*.5,y:-40-Math.random()*60,vx:(Math.random()-.5)*60,vy:280+Math.random()*260,t:0,r:12+Math.random()*26});
          const w=campana(tt,1.5,2.3);if(w>0){g.globalAlpha=w*.5;g.fillStyle='#eef7ff';g.fillRect(0,0,W,H);}
          if(tt>=1.9&&!hecho){hecho=true;try{o.alAparecer?.();}catch(_){}}}
        for(let i=copos.length-1;i>=0;i--){const c=copos[i];c.t+=dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.vy*=1-.4*dt;if(c.y>D.cy+80||c.t>1.6){copos.splice(i,1);continue;}pintar(g,nieve,c.x,c.y,c.r,.85);}
        if(aparece&&tt>1.85){g.globalCompositeOperation='lighter';pintar(g,blanco,D.cx,D.cy,120,campana(tt,1.85,2.4)*.8);g.globalCompositeOperation='source-over';}
        return tt<(aparece?2.9:2.2)||copos.length>0;
      },4);
      if(aparece&&!hecho)try{o.alAparecer?.();}catch(_){}
      return aparece;
    }
    // Domo: cada muerte hace latir la cúpula; una chispa del muerto le quita 1
    // de Alma a su dueño y sigue hasta el PD del rival.
    function muerte(muerto,alma,pd,o={}){
      const fin=()=>{try{o.alAlma?.();o.alPD?.();}catch(_){}};
      if(!muerto||!alma||!pd||quieto(o)||quieto(op)){fin();return Promise.resolve(false);}
      if(escena?.id==='domo')escena.estado.destello=1;
      const M=caja(muerto,host),A=caja(alma,host),P=caja(pd,host),rojo=sp('rojoD',[255,50,80],.9,true),morado=sp('moradoD',[200,90,255],.9,true),estela=[];let alma1=false,pd1=false;
      const texto=(g,x,y,t,col,a)=>{g.globalAlpha=a;g.font='900 22px '+TITULO;g.textAlign='center';g.lineWidth=4;g.strokeStyle='#120408';g.fillStyle=col;g.strokeText(t,x,y);g.fillText(t,x,y);};
      return efecto(o,(g,tt,dt)=>{
        const a=entre(tt,.15,.85),b=entre(tt,1.05,1.75);let x,y;
        if(a<1){const e=suave(a);x=M.cx+(A.cx-M.cx)*e;y=M.cy+(A.cy-M.cy)*e-Math.sin(Math.PI*a)*80;}else{const e=suave(b);x=A.cx+(P.cx-A.cx)*e;y=A.cy+(P.cy-A.cy)*e-Math.sin(Math.PI*b)*80;}
        g.globalCompositeOperation='lighter';
        pintar(g,rojo,M.cx,M.cy,M.w*.9,campana(tt,0,.4));
        if(tt>.15&&b<1){estela.push({x,y,t:0,m:a>=1});pintar(g,a<1?rojo:morado,x,y,28,1);}
        for(let i=estela.length-1;i>=0;i--){const s=estela[i];s.t+=dt;if(s.t>.4){estela.splice(i,1);continue;}pintar(g,s.m?morado:rojo,s.x,s.y,16*(1-s.t/.4),.8*(1-s.t/.4));}
        g.globalCompositeOperation='source-over';
        if(a>=1&&!alma1){alma1=true;try{o.alAlma?.();}catch(_){}alma.animate?.([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:400});}
        if(b>=1&&!pd1){pd1=true;try{o.alPD?.();}catch(_){}pd.animate?.([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:400});}
        if(alma1)texto(g,A.cx,A.y-8-entre(tt,.85,1.6)*20,'−1',  '#ff6a7a',1-entre(tt,1.3,1.7));
        if(pd1)texto(g,P.cx,P.y-8-entre(tt,1.75,2.4)*20,'+1 PD','#e0a8ff',1-entre(tt,2.1,2.5));
        return tt<2.5||estela.length>0;
      },4);
    }

    function destruir(){destruido=true;cancelAnimationFrame(raf);ro?.disconnect();escena?.div.remove();escena=null;efectos.remove();delete host.dataset.campoLugar;}
    return Object.freeze({poner,quitar,fondoCambiado,perderPD,brindis,ataqueAlma,tiradaAidman,muerte,destruir,get lugar(){return escena?.id||null;},lugares:Object.keys(LUGARES)});
  }

  window.CAOZ_CAMPO_LUGAR=Object.freeze({crear,EFECTOS:Object.freeze(Object.fromEntries(Object.entries(EFECTOS).map(([k,v])=>[k,Object.freeze({nombre:v.nombre,icono:v.icono})]))),DE_SERIE:Object.freeze(Object.fromEntries(Object.entries(DE_SERIE).map(([k,v])=>[k,Object.freeze([...v])]))),LUGARES:Object.freeze(Object.fromEntries(Object.entries(LUGARES).map(([k,v])=>[k,Object.freeze({...v})])))});
})();

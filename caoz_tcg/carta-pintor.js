/* Pinta una carta de la Colección en canvas: color, relieve (altura → normal),
   rugosidad/metal y máscara holográfica. El visor 3D usa las cuatro texturas
   con luz real (visor-3d-gl.js); la Colección usa el color con el relieve ya
   iluminado (hornear). Normal y Foil: diseño clásico. Dorada: full art.
   Todo se dibuja sobre una plantilla de 1024×1434 y se escala al ancho pedido.
   Sin dependencias; la ilustración llega ya resuelta por el proveedor de arte. */
'use strict';
(function(){
  const TW=1024,TH=1434,TAU=Math.PI*2;
  const L={
    marco:{x:16,y:16,w:TW-32,h:TH-32,r:44},cuerpo:{x:44,y:44,w:TW-88,h:TH-88,r:26},
    nombre:{x:62,y:60,w:900,h:96,r:18},coste:{cx:902,cy:108,r:62},
    arte:{x:76,y:176,w:872,h:620,r:10},tipo:{x:62,y:812,w:900,h:74,r:14},
    texto:{x:84,y:902,w:856,h:360,r:14},textoSinStats:{x:84,y:902,w:856,h:404,r:14},
    atq:{cx:146,cy:1316,r:64},vida:{cx:878,cy:1316,r:64},
  };
  const FULL={texto:{x:84,y:912,w:856,h:352,r:16},textoSinStats:{x:84,y:912,w:856,h:396,r:16},tipoY:874};
  // Metal del marco por edición y color del cuerpo por tipo de carta.
  const METALES={
    normal:['#4f3108','#e7bb55','#8a6030','#f3d6b5','#6e4a10','#d6a878'],
    foil:['#262f3b','#e3ecf8','#7f8ea3','#ffffff','#36414f','#b9c6d8'],
    dorado:['#4f3108','#f7d774','#b8862b','#fff4c4','#6e4a10','#e7bb55'],
  };
  const CUERPOS={personaje:'#3b2415',hechizo:'#1d2550',trampa:'#43161c',objeto:'#352c18',lugar:'#16361f'};
  const NOMBRES={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  const TITULO="'Cinzel Domo','Cinzel',Georgia,serif",TEXTO="'Cormorant Domo','Cormorant Garamond',Georgia,serif";
  const COSTE='#7a4fd0',ATQ='#c8801f',VIDA='#b8263c';

  function hexRgb(h){const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
  function tono(h,k){const [r,g,b]=hexRgb(h),t=k<0?0:255,p=Math.abs(k);return `rgb(${Math.round(r+(t-r)*p)},${Math.round(g+(t-g)*p)},${Math.round(b+(t-b)*p)})`;}
  function rgba(h,a){const [r,g,b]=hexRgb(h);return `rgba(${r},${g},${b},${a})`;}
  function lienzo(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  // Lienzo a escala k de la plantilla: se dibuja siempre en coordenadas 1024×1434.
  function plantilla(k){const c=lienzo(Math.round(TW*k),Math.round(TH*k)),g=c.getContext('2d');g.scale(k,k);return [c,g];}
  function rr(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r);}
  function azar(semilla){let a=semilla>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function metal(g,paradas,x0,y0,x1,y1){const d=g.createLinearGradient(x0,y0,x1,y1),n=paradas.length*2;for(let i=0;i<n;i++)d.addColorStop(i/(n-1),paradas[i%paradas.length]);return d;}
  // Reglas del motor: <b>…</b> en negrita; el resto como texto plano.
  function tokens(html){
    const d=document.createElement('div'),partes=[];
    String(html||'').split(/(<b>[\s\S]*?<\/b>)/i).forEach(seg=>{
      if(!seg)return;const neg=/^<b>/i.test(seg);d.innerHTML=neg?seg.slice(3,-4):seg;
      d.textContent.replace(/\s+/g,' ').split(/(\s+)/).forEach(t=>t&&partes.push({t,neg}));
    });
    return partes;
  }
  function textoRico(g,partes,x,y,ancho,tam,linea,color,colorNeg,dibujar){
    let cx=x,cy=y;
    for(const {t,neg}of partes){
      g.font=`${neg?700:500} ${tam}px ${TEXTO}`;const w=g.measureText(t).width;
      if(/^\s+$/.test(t)){if(cx>x)cx+=w;continue;}
      if(cx+w>x+ancho&&cx>x){cx=x;cy+=linea;}
      if(dibujar){g.fillStyle=neg?colorNeg:color;g.fillText(t,cx,cy);}cx+=w;
    }
    return cy;
  }
  function ajustarFuente(g,texto,peso,tam,fam,max){do{g.font=`${peso} ${tam}px ${fam}`;tam-=2;}while(g.measureText(texto).width>max&&tam>18);}
  function datos(id,nombre){
    const c=CARDS[id];if(!c)throw Error('Carta desconocida: '+id);
    const d=document.createElement('div');d.innerHTML=typeof tribeLine==='function'?tribeLine(c):'';
    const tipo=d.textContent.replace(/\s+/g,' ').trim()||({personaje:'Personaje',hechizo:'Hechizo',trampa:'Trampa',objeto:'Objeto',lugar:'Lugar'}[c.t]||c.t);
    return {c,id,nombre:nombre||c.n,tipo,stats:c.t==='personaje'};
  }

  // Ilustración con el encuadre del proveedor: object-fit cover, posición y zoom.
  function ilustrar(g,caja,arte,c,radio){
    g.save();rr(g,caja.x,caja.y,caja.w,caja.h,radio);g.clip();
    const cuerpo=CUERPOS[c.t]||CUERPOS.personaje,f=g.createRadialGradient(caja.x+caja.w/2,caja.y+caja.h*.42,10,caja.x+caja.w/2,caja.y+caja.h/2,caja.h);
    f.addColorStop(0,tono(cuerpo,.35));f.addColorStop(1,tono(cuerpo,-.5));g.fillStyle=f;g.fillRect(caja.x,caja.y,caja.w,caja.h);
    const img=arte?.img;
    if(img&&img.naturalWidth){
      const e=arte.enc||{x:50,y:50,z:100},k=Math.max(caja.w/img.naturalWidth,caja.h/img.naturalHeight),dw=img.naturalWidth*k,dh=img.naturalHeight*k;
      const ox=caja.x+caja.w*e.x/100,oy=caja.y+caja.h*e.y/100,z=(e.z||100)/100;
      g.translate(ox,oy);g.scale(z,z);g.translate(-ox,-oy);
      g.drawImage(img,caja.x+(caja.w-dw)*e.x/100,caja.y+(caja.h-dh)*e.y/100,dw,dh);
    }else if(c.art){
      g.font=`${Math.round(caja.h*.42)}px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif`;g.textAlign='center';g.textBaseline='middle';
      g.fillText(c.art,caja.x+caja.w/2,caja.y+caja.h*.52);g.textAlign='left';
    }
    g.restore();
  }
  function sombraInterior(g,caja,radio,fuerza=.85){
    g.save();rr(g,caja.x,caja.y,caja.w,caja.h,radio);g.clip();
    g.shadowColor=`rgba(0,0,0,${fuerza})`;g.shadowBlur=28;g.lineWidth=40;g.strokeStyle='#000';
    g.strokeRect(caja.x-20,caja.y-20,caja.w+40,caja.h+40);g.restore();
  }
  function placa(g,r,paradas,cuerpo){
    rr(g,r.x,r.y,r.w,r.h,r.r);g.fillStyle=metal(g,paradas,r.x,r.y,r.x+r.w,r.y+r.h);g.fill();
    rr(g,r.x+7,r.y+7,r.w-14,r.h-14,r.r-5);const d=g.createLinearGradient(0,r.y,0,r.y+r.h);
    d.addColorStop(0,tono(cuerpo,.18));d.addColorStop(1,tono(cuerpo,-.55));g.fillStyle=d;g.fill();
    g.save();g.clip();const b=g.createLinearGradient(0,r.y,0,r.y+r.h*.55);b.addColorStop(0,'rgba(255,255,255,.16)');b.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=b;g.fillRect(r.x,r.y,r.w,r.h*.55);g.restore();
  }
  // Gema con la cifra centrada; con etiqueta, la cifra sube y la etiqueta va debajo.
  function gema(g,cx,cy,r,paradas,color,cifra,etiqueta){
    g.save();
    g.shadowColor='rgba(0,0,0,.7)';g.shadowBlur=16;g.shadowOffsetY=4;
    g.fillStyle=metal(g,paradas,cx-r,cy-r,cx+r,cy+r);g.beginPath();g.arc(cx,cy,r+12,0,TAU);g.fill();
    g.shadowColor='transparent';
    const d=g.createRadialGradient(cx-r*.35,cy-r*.4,r*.05,cx,cy,r);d.addColorStop(0,tono(color,.6));d.addColorStop(.45,color);d.addColorStop(1,tono(color,-.65));
    g.fillStyle=d;g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
    g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(cx-r*.25,cy-r*.5,r*.5,r*.22,-.3,0,TAU);g.fill();
    g.textAlign='center';g.textBaseline='middle';
    const tam=etiqueta?r*1.0:r*1.25,y=cy+(etiqueta?-r*.12:r*.04);
    g.font=`900 ${tam}px ${TITULO}`;g.lineWidth=8;g.strokeStyle='rgba(0,0,0,.65)';g.strokeText(cifra,cx,y);
    g.fillStyle='#fff';g.shadowColor=color;g.shadowBlur=18;g.fillText(cifra,cx,y);
    if(etiqueta){g.shadowBlur=0;g.font=`700 ${r*.28}px system-ui,sans-serif`;g.fillStyle='rgba(255,255,255,.88)';g.fillText(etiqueta,cx,cy+r*.55);}
    g.restore();
  }
  function rombo(g,x,y,rara,paradas){
    g.save();g.translate(x,y);g.rotate(Math.PI/4);
    const d=g.createLinearGradient(-16,-16,16,16);
    if(rara){d.addColorStop(0,'#fff1b8');d.addColorStop(.55,'#e0a93b');d.addColorStop(1,'#8a5a12');g.shadowColor='#ffc94d';}
    else{d.addColorStop(0,paradas[3]);d.addColorStop(1,paradas[2]);g.shadowColor='rgba(255,255,255,.4)';}
    g.shadowBlur=16;g.fillStyle=d;g.fillRect(-15,-15,30,30);g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=2;g.strokeRect(-15,-15,30,30);g.restore();
  }
  function reglasEnCaja(g,partes,caja,color,colorNeg){
    // El tamaño más grande que cabe en la caja, sin cortar ni desbordar.
    let tam=44;
    for(;tam>22;tam-=2){const y=textoRico(g,partes,caja.x+32,caja.y+tam*1.35,caja.w-64,tam,tam*1.16,color,colorNeg,false);if(y+tam*.5<=caja.y+caja.h-18)break;}
    textoRico(g,partes,caja.x+32,caja.y+tam*1.35,caja.w-64,tam,tam*1.16,color,colorNeg,true);
  }
  function pie(g,d,acabado,y,claro){
    g.textAlign='center';g.textBaseline='alphabetic';
    g.font=`600 20px system-ui,sans-serif`;g.fillStyle=claro?'rgba(255,255,255,.7)':'rgba(255,255,255,.6)';
    g.fillText(('Caoz Con Todo · Edición '+NOMBRES[acabado]).toUpperCase(),TW/2,y);g.textAlign='left';
  }

  function pintarColor(d,acabado,arte,k=1){
    const {c}=d,P=METALES[acabado]||METALES.normal,cuerpo=CUERPOS[c.t]||CUERPOS.personaje,rnd=azar(hash(d.id)),full=acabado==='dorado';
    const [cv,g]=plantilla(k);
    g.fillStyle='#07060a';g.fillRect(0,0,TW,TH);
    rr(g,L.marco.x,L.marco.y,L.marco.w,L.marco.h,L.marco.r);g.fillStyle=metal(g,P,0,0,TW,TH);g.fill();
    // Micro-rayado del metal.
    g.save();g.clip();g.globalAlpha=.08;for(let i=0;i<260;i++){g.strokeStyle=rnd()>.5?'#fff':'#000';g.lineWidth=1;const y=rnd()*TH;g.beginPath();g.moveTo(0,y);g.lineTo(TW,y+(rnd()-.5)*30);g.stroke();}g.restore();
    const B=L.cuerpo;
    if(full){
      ilustrar(g,B,arte,c,B.r);
      g.save();rr(g,B.x,B.y,B.w,B.h,B.r);g.clip();
      let v=g.createLinearGradient(0,B.y,0,B.y+250);v.addColorStop(0,'rgba(3,6,9,.82)');v.addColorStop(1,'rgba(3,6,9,0)');g.fillStyle=v;g.fillRect(B.x,B.y,B.w,250);
      v=g.createLinearGradient(0,720,0,B.y+B.h);v.addColorStop(0,'rgba(3,6,9,0)');v.addColorStop(.3,'rgba(3,6,9,.72)');v.addColorStop(1,'rgba(3,6,9,.94)');g.fillStyle=v;g.fillRect(B.x,720,B.w,B.y+B.h-720);
      g.restore();
      g.strokeStyle=metal(g,P,0,0,TW,TH);g.lineWidth=3;g.globalAlpha=.7;rr(g,B.x+12,B.y+12,B.w-24,B.h-24,B.r-6);g.stroke();g.globalAlpha=1;
    }else{
      rr(g,B.x,B.y,B.w,B.h,B.r);const f=g.createLinearGradient(0,0,TW,TH);f.addColorStop(0,tono(cuerpo,.12));f.addColorStop(.5,cuerpo);f.addColorStop(1,tono(cuerpo,-.5));g.fillStyle=f;g.fill();
      g.save();g.clip();g.strokeStyle='rgba(255,255,255,.05)';g.lineWidth=2;
      for(let i=-TH;i<TW+TH;i+=46){g.beginPath();g.moveTo(i,0);g.lineTo(i+TH,TH);g.stroke();g.beginPath();g.moveTo(i,TH);g.lineTo(i+TH,0);g.stroke();}
      for(let i=0;i<5000;i++){g.fillStyle=`rgba(${rnd()>.5?'255,255,255':'0,0,0'},${rnd()*.06})`;g.fillRect(rnd()*TW,rnd()*TH,2,2);}
      g.restore();
      const A=L.arte;rr(g,A.x-10,A.y-10,A.w+20,A.h+20,A.r+6);g.fillStyle=metal(g,P,A.x,A.y,A.x+A.w,A.y+A.h);g.fill();
      ilustrar(g,A,arte,c,A.r);
      const vi=g.createRadialGradient(A.x+A.w/2,A.y+A.h/2,A.h*.3,A.x+A.w/2,A.y+A.h/2,A.h*.85);vi.addColorStop(0,'rgba(0,0,0,0)');vi.addColorStop(1,'rgba(0,0,0,.45)');
      g.save();rr(g,A.x,A.y,A.w,A.h,A.r);g.clip();g.fillStyle=vi;g.fillRect(A.x,A.y,A.w,A.h);g.restore();sombraInterior(g,A,A.r);
    }
    const regla=(y,x0,x1)=>{const r=g.createLinearGradient(x0,0,x1,0);r.addColorStop(0,rgba(P[1],0));r.addColorStop(.2,rgba(P[1],.9));r.addColorStop(.8,rgba(P[1],.9));r.addColorStop(1,rgba(P[1],0));g.fillStyle=r;g.fillRect(x0,y,x1-x0,3);};
    // Nombre
    if(!full)placa(g,L.nombre,P,cuerpo);
    g.save();g.textBaseline='middle';ajustarFuente(g,d.nombre,700,full?58:54,TITULO,L.coste.cx-L.coste.r-40-(L.nombre.x+32));
    const ng=g.createLinearGradient(0,L.nombre.y+20,0,L.nombre.y+L.nombre.h-20);ng.addColorStop(0,'#fffaf0');ng.addColorStop(1,tono(P[1],-.05));
    g.shadowColor='rgba(0,0,0,.9)';g.shadowBlur=full?14:8;g.shadowOffsetY=3;g.fillStyle=ng;g.fillText(d.nombre,L.nombre.x+32,L.nombre.y+L.nombre.h/2+3);g.restore();
    if(full)regla(L.nombre.y+L.nombre.h+4,L.nombre.x+10,L.coste.cx-L.coste.r-16);
    gema(g,L.coste.cx,L.coste.cy,L.coste.r,P,COSTE,String(c.c));
    // Tipo
    const T=full?(d.stats?FULL.texto:FULL.textoSinStats):(d.stats?L.texto:L.textoSinStats),ty=full?FULL.tipoY:L.tipo.y+L.tipo.h/2+2;
    if(!full)placa(g,L.tipo,P,cuerpo);
    g.save();g.font=`600 34px ${TITULO}`;g.textBaseline='middle';g.fillStyle='#efe6d2';g.shadowColor='rgba(0,0,0,.85)';g.shadowBlur=full?8:6;
    g.fillText(d.tipo,full?T.x+8:L.tipo.x+30,ty);g.restore();
    rombo(g,full?T.x+T.w-24:L.tipo.x+L.tipo.w-48,ty,c.r===2,P);
    if(full)regla(ty+24,T.x-10,T.x+T.w+10);
    // Reglas
    const partes=tokens(c.x);
    if(full){
      rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle='rgba(6,12,16,.55)';g.fill();g.strokeStyle=rgba(P[1],.45);g.lineWidth=2;g.stroke();
      g.save();g.shadowColor='rgba(0,0,0,.8)';g.shadowBlur=6;reglasEnCaja(g,partes,T,'#f1ebdf','#ffd98a');g.restore();
    }else{
      rr(g,T.x-6,T.y-6,T.w+12,T.h+12,T.r+4);g.fillStyle=metal(g,P,T.x,T.y,T.x+T.w,T.y+T.h);g.fill();
      rr(g,T.x,T.y,T.w,T.h,T.r);const p=g.createLinearGradient(0,T.y,0,T.y+T.h);p.addColorStop(0,'#f1e7d0');p.addColorStop(1,'#d8c7a4');g.fillStyle=p;g.fill();
      g.save();g.clip();for(let i=0;i<2500;i++){g.fillStyle=`rgba(90,60,20,${rnd()*.07})`;g.fillRect(T.x+rnd()*T.w,T.y+rnd()*T.h,2,2);}
      const tv=g.createRadialGradient(T.x+T.w/2,T.y+T.h/2,T.h*.3,T.x+T.w/2,T.y+T.h/2,T.w*.7);tv.addColorStop(0,'rgba(0,0,0,0)');tv.addColorStop(1,'rgba(70,40,10,.25)');g.fillStyle=tv;g.fillRect(T.x,T.y,T.w,T.h);g.restore();
      reglasEnCaja(g,partes,T,'#1d140b','#6b1d0a');
    }
    if(d.stats){gema(g,L.atq.cx,L.atq.cy,L.atq.r,P,ATQ,String(c.a),'ATQ');gema(g,L.vida.cx,L.vida.cy,L.vida.r,P,VIDA,String(c.h),'VIDA');}
    pie(g,d,acabado,d.stats?1330:1352,full);
    return cv;
  }

  // Máscara holo: R = foil, G = destellos, B = patrón grabado.
  function pintarMascara(d,acabado){
    const [cv,g]=plantilla(1),full=acabado==='dorado',B=L.cuerpo;
    g.fillStyle='#000';g.fillRect(0,0,TW,TH);
    rr(g,L.marco.x,L.marco.y,L.marco.w,L.marco.h,L.marco.r);g.fillStyle='rgb(210,150,0)';g.fill();
    if(full){
      rr(g,B.x,B.y,B.w,B.h,B.r);g.fillStyle='rgb(120,210,0)';g.fill();
      const v=g.createLinearGradient(0,760,0,B.y+B.h);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.35,'rgba(0,0,0,.7)');v.addColorStop(1,'rgba(0,0,0,.85)');g.fillStyle=v;g.fillRect(B.x,760,B.w,B.y+B.h-760);
      const T=d.stats?FULL.texto:FULL.textoSinStats;rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle='rgb(10,20,0)';g.fill();
    }else{
      rr(g,B.x,B.y,B.w,B.h,B.r);g.fillStyle='rgb(110,100,0)';g.fill();
      g.save();g.clip();g.globalCompositeOperation='lighter';g.strokeStyle='rgb(0,0,255)';g.lineWidth=6;
      for(let i=-TH;i<TW+TH;i+=46){g.beginPath();g.moveTo(i,0);g.lineTo(i+TH,TH);g.stroke();g.beginPath();g.moveTo(i,TH);g.lineTo(i+TH,0);g.stroke();}g.restore();
      for(const r of [L.nombre,L.tipo]){rr(g,r.x,r.y,r.w,r.h,r.r);g.fillStyle='rgb(220,160,0)';g.fill();rr(g,r.x+7,r.y+7,r.w-14,r.h-14,r.r-5);g.fillStyle='rgb(70,60,90)';g.fill();}
      const A=L.arte;rr(g,A.x-10,A.y-10,A.w+20,A.h+20,A.r+6);g.fillStyle='rgb(220,160,0)';g.fill();rr(g,A.x,A.y,A.w,A.h,A.r);g.fillStyle='rgb(200,230,40)';g.fill();
      const T=d.stats?L.texto:L.textoSinStats;rr(g,T.x-6,T.y-6,T.w+12,T.h+12,T.r+4);g.fillStyle='rgb(200,140,0)';g.fill();rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle='rgb(10,0,0)';g.fill();
    }
    for(const m of gemas(d)){g.fillStyle='rgb(230,255,60)';g.beginPath();g.arc(m.cx,m.cy,m.r+12,0,TAU);g.fill();}
    return cv;
  }
  function gemas(d){return d.stats?[L.coste,L.atq,L.vida]:[L.coste];}
  // ORM: G = rugosidad, B = metalicidad.
  function pintarORM(d,acabado,k=1){
    const [cv,g]=plantilla(k),full=acabado==='dorado',B=L.cuerpo;
    const orm=(r,m)=>`rgb(255,${Math.round(r*255)},${Math.round(m*255)})`,ORO=orm(.26,1);
    g.fillStyle=orm(.6,0);g.fillRect(0,0,TW,TH);
    rr(g,L.marco.x,L.marco.y,L.marco.w,L.marco.h,L.marco.r);g.fillStyle=ORO;g.fill();
    if(full){
      rr(g,B.x,B.y,B.w,B.h,B.r);g.fillStyle=orm(.5,.02);g.fill();
      const T=d.stats?FULL.texto:FULL.textoSinStats;rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle=orm(.3,0);g.fill();
    }else{
      rr(g,B.x,B.y,B.w,B.h,B.r);g.fillStyle=orm(.5,.25);g.fill();
      for(const r of [L.nombre,L.tipo]){rr(g,r.x,r.y,r.w,r.h,r.r);g.fillStyle=ORO;g.fill();rr(g,r.x+7,r.y+7,r.w-14,r.h-14,r.r-5);g.fillStyle=orm(.3,.3);g.fill();}
      const A=L.arte;rr(g,A.x-10,A.y-10,A.w+20,A.h+20,A.r+6);g.fillStyle=ORO;g.fill();rr(g,A.x,A.y,A.w,A.h,A.r);g.fillStyle=orm(.45,.03);g.fill();
      const T=d.stats?L.texto:L.textoSinStats;rr(g,T.x-6,T.y-6,T.w+12,T.h+12,T.r+4);g.fillStyle=ORO;g.fill();rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle=orm(.85,0);g.fill();
    }
    for(const m of gemas(d)){g.fillStyle=ORO;g.beginPath();g.arc(m.cx,m.cy,m.r+12,0,TAU);g.fill();g.fillStyle=orm(.1,.15);g.beginPath();g.arc(m.cx,m.cy,m.r,0,TAU);g.fill();}
    return cv;
  }
  // Altura: marco y placas en relieve, nombre grabado, pergamino con lino.
  function pintarAltura(d,acabado,arte,k=1){
    const [cv,g]=plantilla(k),full=acabado==='dorado',B=L.cuerpo,gris=v=>`rgb(${v},${v},${v})`;
    g.fillStyle=gris(60);g.fillRect(0,0,TW,TH);
    const bisel=(r,alto,bajo)=>{rr(g,r.x,r.y,r.w,r.h,r.r);g.fillStyle=gris(alto);g.fill();g.save();g.clip();g.filter='blur(6px)';g.lineWidth=14;g.strokeStyle=gris(bajo);rr(g,r.x,r.y,r.w,r.h,r.r);g.stroke();g.restore();g.filter='none';};
    bisel(L.marco,200,150);
    rr(g,B.x,B.y,B.w,B.h,B.r);g.fillStyle=gris(128);g.fill();
    if(full){
      const img=arte?.img;
      if(img&&img.naturalWidth){g.save();rr(g,B.x,B.y,B.w,B.h,B.r);g.clip();g.globalAlpha=.3;g.filter='grayscale(1) blur(.6px)';ilustrar(g,B,arte,d.c,B.r);g.restore();g.filter='none';}
    }else{
      g.save();rr(g,B.x,B.y,B.w,B.h,B.r);g.clip();g.strokeStyle=gris(112);g.lineWidth=3;
      for(let i=-TH;i<TW+TH;i+=46){g.beginPath();g.moveTo(i,0);g.lineTo(i+TH,TH);g.stroke();g.beginPath();g.moveTo(i,TH);g.lineTo(i+TH,0);g.stroke();}g.restore();
      for(const r of [L.nombre,L.tipo]){bisel(r,215,170);rr(g,r.x+8,r.y+8,r.w-16,r.h-16,r.r-5);g.fillStyle=gris(150);g.fill();}
      const A=L.arte;bisel({x:A.x-10,y:A.y-10,w:A.w+20,h:A.h+20,r:A.r+6},205,160);rr(g,A.x,A.y,A.w,A.h,A.r);g.fillStyle=gris(118);g.fill();
    }
    g.save();g.textBaseline='middle';ajustarFuente(g,d.nombre,700,full?58:54,TITULO,L.coste.cx-L.coste.r-40-(L.nombre.x+32));
    g.filter='blur(1.5px)';g.fillStyle=gris(215);g.fillText(d.nombre,L.nombre.x+32,L.nombre.y+L.nombre.h/2+3);g.restore();g.filter='none';
    const T=full?(d.stats?FULL.texto:FULL.textoSinStats):(d.stats?L.texto:L.textoSinStats);
    if(full){rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle=gris(140);g.fill();}
    else{
      bisel({x:T.x-6,y:T.y-6,w:T.w+12,h:T.h+12,r:T.r+4},200,160);rr(g,T.x,T.y,T.w,T.h,T.r);g.fillStyle=gris(122);g.fill();
      g.save();g.clip();g.globalAlpha=.5;
      for(let y=T.y;y<T.y+T.h;y+=4){g.fillStyle=gris(y%8?128:116);g.fillRect(T.x,y,T.w,2);}
      for(let x=T.x;x<T.x+T.w;x+=4){g.fillStyle=gris(x%8?128:116);g.fillRect(x,T.y,2,T.h);}
      g.restore();
    }
    for(const m of gemas(d)){
      g.fillStyle=gris(200);g.beginPath();g.arc(m.cx,m.cy,m.r+12,0,TAU);g.fill();
      const dm=g.createRadialGradient(m.cx,m.cy,0,m.cx,m.cy,m.r);dm.addColorStop(0,gris(255));dm.addColorStop(1,gris(170));g.fillStyle=dm;g.beginPath();g.arc(m.cx,m.cy,m.r,0,TAU);g.fill();
    }
    return cv;
  }
  function normales(alto,fuerza,ruido,semilla){
    const w=alto.width,h=alto.height,src=alto.getContext('2d').getImageData(0,0,w,h).data,H=new Float32Array(w*h),rnd=azar(semilla);
    for(let i=0;i<w*h;i++)H[i]=src[i*4]/255+(rnd()-.5)*ruido;
    const cv=lienzo(w,h),g=cv.getContext('2d'),img=g.createImageData(w,h),o=img.data;
    for(let y=0;y<h;y++){const yu=y>0?y-1:y,yd=y<h-1?y+1:y;
      for(let x=0;x<w;x++){const xl=x>0?x-1:x,xr=x<w-1?x+1:x;
        const dx=(H[y*w+xr]-H[y*w+xl])*fuerza,dy=(H[yd*w+x]-H[yu*w+x])*fuerza,inv=1/Math.hypot(dx,dy,1),i=(y*w+x)*4;
        o[i]=(-dx*inv*.5+.5)*255;o[i+1]=(dy*inv*.5+.5)*255;o[i+2]=(inv*.5+.5)*255;o[i+3]=255;}}
    g.putImageData(img,0,0);return cv;
  }

  // Texturas completas para el visor 3D.
  function texturas({id,acabado='normal',nombre,arte}){
    const d=datos(id,nombre);
    const color=pintarColor(d,acabado,arte),altura=pintarAltura(d,acabado,arte);
    return {color,normal:normales(altura,6,.02,hash(id+acabado)),orm:pintarORM(d,acabado),mascara:pintarMascara(d,acabado)};
  }
  // Carta de Colección: el color con el relieve iluminado por una luz fija
  // arriba a la izquierda, brillo en el metal y la laca, a la resolución pedida.
  function hornear({id,acabado='normal',nombre,arte,ancho=360}){
    const d=datos(id,nombre);
    const k=Math.min(1,ancho/TW),color=pintarColor(d,acabado,arte,k),w=color.width,h=color.height;
    const n=normales(pintarAltura(d,acabado,arte,k),6*k*1.6,.01,hash(id)),orm=pintarORM(d,acabado,k);
    const g=color.getContext('2d'),c=g.getImageData(0,0,w,h),N=n.getContext('2d').getImageData(0,0,w,h).data,O=orm.getContext('2d').getImageData(0,0,w,h).data,p=c.data;
    const Lx=-.45,Ly=.55,Lz=.7,ln=Math.hypot(Lx,Ly,Lz),lx=Lx/ln,ly=Ly/ln,lz=Lz/ln,hx=lx,hy=ly,hz=lz+1,hn=Math.hypot(hx,hy,hz);
    for(let i=0;i<w*h;i++){
      const k=i*4,nx=N[k]/127.5-1,ny=N[k+1]/127.5-1,nz=N[k+2]/127.5-1,rug=O[k+1]/255,met=O[k+2]/255;
      const dif=Math.max(0,nx*lx+ny*ly+nz*lz),luz=.62+.46*dif,sp=Math.pow(Math.max(0,(nx*hx+ny*hy+nz*hz)/hn),8+(1-rug)*60)*(.12+met*.7);
      const x=i%w,y=(i/w)|0,banda=met*.18*Math.max(0,1-Math.abs((x/w+y/h)-.62)*4);
      for(let j=0;j<3;j++)p[k+j]=Math.min(255,p[k+j]*luz+255*(sp+banda)*(j===2?.92:1));
    }
    g.putImageData(c,0,0);return color;
  }
  // Dorso con el logo, en color y altura (el logo sobresale).
  function dorso(logo){
    const cv=lienzo(TW,TH),g=cv.getContext('2d'),P=METALES.dorado,rnd=azar(1337),cx=TW/2,cy=TH/2;
    g.fillStyle='#07060a';g.fillRect(0,0,TW,TH);
    rr(g,16,16,TW-32,TH-32,44);g.fillStyle=metal(g,P,0,0,TW,TH);g.fill();
    rr(g,44,44,TW-88,TH-88,26);const f=g.createRadialGradient(cx,cy,0,cx,cy,TH*.7);f.addColorStop(0,'#3b2766');f.addColorStop(.55,'#22163f');f.addColorStop(1,'#0d0818');g.fillStyle=f;g.fill();
    g.save();g.clip();g.strokeStyle='rgba(198,158,255,.12)';g.lineWidth=2;
    for(let i=-TH;i<TW+TH;i+=36){g.beginPath();g.moveTo(i,0);g.lineTo(i+TH,TH);g.stroke();}
    g.globalCompositeOperation='lighter';for(let i=0;i<260;i++){g.fillStyle=`rgba(255,230,190,${rnd()*.5})`;g.beginPath();g.arc(rnd()*TW,rnd()*TH,rnd()*1.8,0,TAU);g.fill();}
    const h=g.createRadialGradient(cx,cy,0,cx,cy,460);h.addColorStop(0,'rgba(170,120,255,.35)');h.addColorStop(1,'rgba(170,120,255,0)');g.fillStyle=h;g.fillRect(0,0,TW,TH);g.restore();
    g.strokeStyle=metal(g,P,0,0,TW,TH);g.lineWidth=6;rr(g,84,84,TW-168,TH-168,20);g.stroke();g.lineWidth=2;rr(g,100,100,TW-200,TH-200,14);g.stroke();
    g.strokeStyle='rgba(233,196,106,.55)';g.lineWidth=2;for(const r of [330,300,200]){g.beginPath();g.arc(cx,cy,r,0,TAU);g.stroke();}
    if(logo&&logo.naturalWidth){const lw=860,lh=lw*logo.naturalHeight/logo.naturalWidth;g.save();g.shadowColor='rgba(0,0,0,.85)';g.shadowBlur=40;g.shadowOffsetY=12;g.drawImage(logo,cx-lw/2,cy-lh/2,lw,lh);g.restore();}
    const alto=lienzo(TW,TH),a=alto.getContext('2d');a.filter='grayscale(1)';a.drawImage(cv,0,0);a.filter='none';
    return {color:cv,normal:normales(alto,2.5,.012,7)};
  }
  // Las tipografías se pintan en canvas: hay que tenerlas cargadas antes.
  let listas=null;
  function fuentes(){
    listas||=Promise.race([Promise.all([`700 50px 'Cinzel Domo'`,`900 50px 'Cinzel Domo'`,`600 30px 'Cinzel Domo'`,`500 30px 'Cormorant Domo'`,`700 30px 'Cormorant Domo'`].map(f=>document.fonts.load(f))),new Promise(r=>setTimeout(r,2500))]).catch(()=>{});
    return listas;
  }

  window.CAOZ_CARTA_PINTOR=Object.freeze({ancho:TW,alto:TH,texturas,hornear,dorso,fuentes});
})();

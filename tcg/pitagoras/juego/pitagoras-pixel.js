/* Las otras realidades comparten la cuadrícula y los materiales del Archivo.
   Atlas dibujados en píxeles, seis cuadros de movimiento y paletas escalonadas.
   Sólo presentación: ni el azar ni las coordenadas del modelo se escriben aquí. */
'use strict';
(function(global){
  if(typeof document==='undefined'||!global.PITAGORAS_PRUEBAS)return;
  const API=global.PITAGORAS_PRUEBAS,TAU=Math.PI*2,lim=(x,a,b)=>Math.max(a,Math.min(b,x)),tipos=['isometrico','laseres','carrera','orbital','duelo'];
  const P={negro:'#080c18',hondo:'#111c28',sombra:'#1e2b38',piedra:'#374850',musgo:'#51685d',borde:'#83917a',hueso:'#d5c3a0',blanco:'#ffeed0',oro:'#b99b65',fuego:'#f78c48',rojo:'#c54848',vino:'#713044',azul:'#62b7c6',hielo:'#b8e7d2'};
  let mosaicos=null,monstruos=null,naves=null,planeta=null;
  const brillos=new Map(),trama=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const lienzo=(w,h)=>{const n=document.createElement('canvas');n.width=w;n.height=h;return n;};
  function bloque(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));}
  function linea(c,x,y,xx,yy,color,g=1){c.strokeStyle=color;c.lineWidth=g;c.beginPath();c.moveTo(Math.round(x)+.5,Math.round(y)+.5);c.lineTo(Math.round(xx)+.5,Math.round(yy)+.5);c.stroke();}
  function figura(c,ps,color,borde){c.beginPath();ps.forEach((p,i)=>i?c.lineTo(Math.round(p[0]),Math.round(p[1])):c.moveTo(Math.round(p[0]),Math.round(p[1])));c.closePath();c.fillStyle=color;c.fill();if(borde){c.strokeStyle=borde;c.lineWidth=1;c.stroke();}}
  function circulo(c,x,y,r,color,g=0){c.beginPath();c.arc(Math.round(x),Math.round(y),Math.max(.1,r),0,TAU);if(g){c.strokeStyle=color;c.lineWidth=g;c.stroke();}else{c.fillStyle=color;c.fill();}}
  function resplandor(c,x,y,r,color){
    let n=brillos.get(color);if(!n){n=lienzo(64,64);const ctx=n.getContext('2d'),im=ctx.createImageData(64,64),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
      for(let yy=0;yy<64;yy++)for(let xx=0;xx<64;xx++){const i=(yy*64+xx)*4,dist=Math.hypot(xx-31.5,yy-31.5)/32,alfa=Math.max(0,1-dist)**2*62,escalon=Math.floor(alfa/7+(trama[(yy%4)*4+xx%4]+.5)/16)*7;im.data[i]=rgb[0];im.data[i+1]=rgb[1];im.data[i+2]=rgb[2];im.data[i+3]=escalon;}
      ctx.putImageData(im,0,0);brillos.set(color,n);
    }c.drawImage(n,Math.round(x-r),Math.round(y-r),Math.round(r*2),Math.round(r*2));
  }
  function normalizar(n){const c=n.getContext('2d'),im=c.getImageData(0,0,n.width,n.height),d=im.data;for(let i=0;i<d.length;i+=4){if(d[i+3]<110)d[i+3]=0;else{for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(d[i+k]/8)*8);d[i+3]=255;}}c.putImageData(im,0,0);return n;}
  function estrellitas(c,w,h,t,color=P.borde,n=40){for(let i=0;i<n;i++){const x=((i*73.193+Math.sin(i*7.1)*57)%w+w)%w,y=((i*31.731-t*(2+i%3))%h+h)%h;c.globalAlpha=.18+(i%5)*.10;bloque(c,x,y,1,1,color);}c.globalAlpha=1;}
  function textura(){
    if(mosaicos)return mosaicos;mosaicos=[];
    for(let v=0;v<8;v++){
      const n=lienzo(32,32),c=n.getContext('2d');bloque(c,0,0,32,32,P.negro);bloque(c,1,1,30,30,v%2?'#344749':'#2e3f43');bloque(c,2,2,28,1,v%2?'#647b67':'#586e63');bloque(c,2,3,1,26,'#4d645c');bloque(c,3,29,27,1,'#192b33');bloque(c,29,3,1,26,'#21323a');
      for(let i=0;i<28;i++){const x=3+(i*19+v*11)%25,y=3+(i*11+v*19)%25;bloque(c,x,y,i%4===0?2:1,1,i%2?'#4b6056':'#263b3e');}
      if(v%3===0){linea(c,7,3,12,12,'#172d33');linea(c,12,12,9,17,'#172d33');linea(c,9,17,15,29,'#172d33');linea(c,12,12,22,16,'#172d33');linea(c,13,12,22,15,'#4d6053');}
      if(v%2===0)for(let j=0;j<6;j++){bloque(c,3+j*2,27-j%3,3,2,j%2?'#667a51':'#465b42');bloque(c,27-j%3,2+j*2,2,3,'#465b42');}
      mosaicos.push(n);
    }return mosaicos;
  }
  function paleta(s){
    if(s.pixelPaleta)return s.pixelPaleta;let color={tela:'#88444e',piel:'#cf9973',pelo:'#3d2a28'};
    try{const p=global.campanaNormalizarPersonaje(s.op?.personaje);color={tela:CAMPANA_ASPECTO.color[p.color][1],piel:CAMPANA_ASPECTO.piel[p.piel][1],pelo:CAMPANA_ASPECTO.cabello[p.cabello][1]};}catch(_){}
    s.pixelPaleta=color;return color;
  }
  function crearCenital(color,enemigo){
    const atlas=[];
    for(let f=0;f<6;f++){
      const n=lienzo(36,40),c=n.getContext('2d'),paso=Math.round(Math.sin(f*TAU/6)*2),b=(x,y,w,h,col)=>bloque(c,x,y,w,h,col);
      if(enemigo){
        // Cables, máscara ósea y seis posiciones de las garras vistos desde arriba.
        figura(c,[[8,13],[13,10],[23,10],[28,14],[27,30],[22,35+paso],[18,31],[12,35-paso],[8,29]],P.negro);
        figura(c,[[12,17],[24,17],[26,28],[21,33+paso],[18,26],[13,33-paso],[10,27]],'#493440');
        for(const lado of [-1,1]){const x=18+lado*11;b(x-2,14+lado*paso,5,10,'#705060');b(x-1,14+lado*paso,2,7,'#ab7c7a');b(x-3,23+lado*paso,7,4,'#242032');for(let j=0;j<3;j++)b(x-3+j*3,26+lado*paso,1,4-j%2,P.hueso);}
        b(12,7,12,16,'#ada58c');b(14,5,8,2,'#d4c6a4');b(13,9,10,6,'#d1c5a2');b(18,15,5,8,'#7d8174');b(12,15,4,3,P.negro);b(20,15,4,3,P.negro);b(13,15,3,1,'#ff7356');b(20,15,3,1,'#ff7356');b(16,22,4,2,P.negro);
        for(let j=0;j<4;j++){const x=12+j*4;linea(c,x,26,x-2+paso,36-j%2*3,'#668074');b(x,27,1,3,'#9aa889');}
        linea(c,12,10,7,4,P.borde);linea(c,7,4,8,1,P.sombra);linea(c,23,10,29,3,P.borde);linea(c,29,3,28,0,P.sombra);
      }else{
        b(11,26+paso,5,9,P.negro);b(21,26-paso,5,9,P.negro);b(12,28+paso,3,5,'#594b43');b(22,28-paso,3,5,'#594b43');
        figura(c,[[10,14],[26,14],[27,22],[29+paso,34],[21,35],[18,32],[14,35],[7+paso,33],[9,24]],P.negro);
        figura(c,[[11,16],[25,16],[25,23],[27+paso,32],[21,33],[18,29],[13,33],[9+paso,31],[11,23]],color.tela);
        linea(c,12,19,11+paso,30,'#cfb483');linea(c,24,20,25+paso,31,'#ad8568');linea(c,18,20,18+paso,28,'#201b2d');
        b(7,12+paso,7,9,P.negro);b(23,12-paso,7,9,P.negro);b(8,13+paso,5,5,'#738282');b(24,13-paso,5,5,'#738282');b(9,13+paso,3,1,'#c0b89a');b(24,13-paso,3,1,'#c0b89a');b(8,19+paso,4,4,color.piel);b(25,19-paso,4,4,color.piel);
        b(12,5,12,13,P.negro);b(13,7,10,9,color.piel);b(14,5,8,3,color.pelo);b(12,8,11,5,color.pelo);b(14,6,6,2,'#9d775655');b(15,15,6,2,color.piel);
        b(27,2,2,19,P.negro);b(27,3,1,16,P.oro);b(25,1,6,5,P.negro);b(26,1,4,4,P.azul);b(27,1,2,2,P.hielo);b(27,7,3,1,P.hueso);
      }atlas.push(normalizar(n));
    }return atlas;
  }
  function crearAndante(color){
    const atlas=[];for(let f=0;f<6;f++){
      const n=lienzo(32,48),c=n.getContext('2d'),paso=Math.round(Math.sin(f*TAU/6)*3),b=(x,y,w,h,col)=>bloque(c,x,y,w,h,col);
      b(8,30,7,13+paso,P.negro);b(18,30,7,13-paso,P.negro);b(9,36,4,7+paso,'#544b4b');b(19,36,4,7-paso,'#544b4b');b(8,43+paso,7,2,P.hueso);b(18,43-paso,7,2,P.hueso);
      b(3,17-paso,6,15,P.negro);b(24,17+paso,6,15,P.negro);b(4,19-paso,3,9,'#778583');b(26,19+paso,3,9,'#778583');b(4,28-paso,4,4,color.piel);b(25,28+paso,4,4,color.piel);
      figura(c,[[8,14],[24,14],[25,24],[28+paso,39],[21,40],[16,37],[10,40],[4+paso,38],[7,25]],P.negro);figura(c,[[9,16],[23,16],[23,25],[25+paso,36],[20,38],[16,34],[11,38],[7+paso,36],[9,25]],color.tela);
      linea(c,10,19,9+paso,34,P.oro);linea(c,22,19,23+paso,34,'#a98463');linea(c,16,21,16+paso,33,'#281e30');b(10,14,12,3,'#d3bd8a');b(8,4,16,12,P.negro);b(9,6,14,8,color.piel);b(10,3,12,3,color.pelo);b(8,5,15,7,color.pelo);b(10,5,8,2,'#8f725655');b(11,13,10,2,'#473b3b');
      atlas.push(normalizar(n));
    }return atlas;
  }
  function sprite(s,c,x,y,tam,enemigo=false,a=-Math.PI/2,tiempo=0,cenital=true){
    let atlas;if(enemigo)atlas=monstruos||(monstruos=crearCenital({},true));else{const llave=cenital?'pixelCenital':'pixelAndante';atlas=s[llave]||(s[llave]=cenital?crearCenital(paleta(s),false):crearAndante(paleta(s)));}
    const f=s.reducido?0:((Math.floor(tiempo*9)%6)+6)%6,n=atlas[f];c.save();if(!enemigo&&s.modelo.invulnerable>0&&Math.floor(s.modelo.t*12)%2)c.globalAlpha=.5;
    if(cenital){c.translate(Math.round(x),Math.round(y));c.rotate(a+Math.PI/2);c.imageSmoothingEnabled=false;c.drawImage(n,Math.round(-tam/2),Math.round(-tam/2),Math.round(tam),Math.round(tam*n.height/n.width));}
    else{c.imageSmoothingEnabled=false;c.drawImage(n,Math.round(x-tam/2),Math.round(y-tam*1.5),Math.round(tam),Math.round(tam*1.5));}c.restore();
  }
  function llama(c,x,y,t,tam=1,color=false){
    const f=Math.floor(t*12)%6;c.save();c.translate(Math.round(x),Math.round(y));c.scale(tam,tam);const b=(x,y,w,h,col)=>bloque(c,x,y,w,h,col);b(-3,-4,6,5,color?P.azul:P.rojo);b(-2,-7-(f%3),4,7,color?P.azul:P.fuego);b(-1,-4,2,4,P.blanco);b(f%2?-2:1,-9-f%3,1,3,color?P.hielo:P.oro);b(-3+f%5,-13-(f%3),1,1,color?P.hielo:P.fuego);c.restore();
  }
  function brasero(c,x,y,t,tam){c.save();c.translate(Math.round(x),Math.round(y));c.scale(tam,tam);bloque(c,-5,0,10,5,P.negro);bloque(c,-4,0,8,2,P.borde);bloque(c,-3,3,6,3,P.oro);llama(c,0,0,t,1);c.restore();}
  function camara(s){const w=s.ancho,h=s.alto,p=s.modelo.jugador,esc=s.tipo==='isometrico'?Math.min(w/11.5,h/12.5):Math.min(w,h)/15.2;return{esc,cx:w/2-(s.tipo==='isometrico'?p.x*esc*.36:0),cy:h/2-(s.tipo==='isometrico'?p.y*esc*.36:0)};}
  function abismo(s,c,q){const w=s.ancho,h=s.alto,t=s.modelo.t;bloque(c,0,0,w,h,P.negro);for(let i=0;i<22;i++){const x=(i*67.37)%w,y=((i*31.4+t*(3+i%4))%h),an=2+i%3;c.globalAlpha=.10+(i%3)*.05;bloque(c,x,y,an,1,i%3?P.azul:P.oro);}c.globalAlpha=1;}
  function suelo(s,c,q,metal=false){
    const {esc,cx,cy}=q,tex=textura(),a=s.modelo.losas||[];abismo(s,c,q);const x0=cx-7*esc,y0=cy-7*esc,an=14*esc;
    bloque(c,x0-4,y0-4,an+8,an+8,metal?'#647778':'#65725e');bloque(c,x0-2,y0-2,an+4,an+4,P.negro);
    for(let yy=-7;yy<7;yy++)for(let xx=-7;xx<7;xx++){c.drawImage(tex[((xx+7)*5+(yy+7)*3)%8],Math.round(cx+xx*esc),Math.round(cy+yy*esc),Math.ceil(esc),Math.ceil(esc));}
    c.save();c.beginPath();c.rect(x0,y0,an,an);c.clip();c.globalAlpha=.40;
    for(const rr of [2.9,3.02,5.7,5.82])circulo(c,cx,cy,rr*esc,metal?P.azul:P.oro,1);
    for(let i=0;i<32;i++){const aa=i*TAU/32,r=5.45*esc,x=cx+Math.cos(aa)*r,y=cy+Math.sin(aa)*r;linea(c,x,y,x+Math.cos(aa)*esc*.22,y+Math.sin(aa)*esc*.22,P.hueso);if(i%4===0)bloque(c,x-1,y-1,3,3,P.oro);}c.globalAlpha=1;
    if(!metal){for(let i=0;i<22;i++){const lado=i%4,bb=-6.7+(i%6)*2.6,x=cx+(lado<2?(lado?-6.8:6.8):bb)*esc,y=cy+(lado<2?bb:lado===2?-6.8:6.8)*esc;bloque(c,x,y,esc*.23,esc*.17,'#60764c');bloque(c,x+2,y-2,2,2,'#91a363');}for(const l of a)losa(s,c,l,q);}
    c.restore();
    for(const [xx,yy] of [[-6.85,-6.85],[6.85,-6.85],[-6.85,6.85],[6.85,6.85]]){const x=cx+xx*esc,y=cy+yy*esc;resplandor(c,x,y,esc*1.8,metal?P.azul:P.fuego);if(metal){bloque(c,x-3,y-3,6,6,P.sombra);bloque(c,x-2,y-1,4,2,P.hielo);}else brasero(c,x,y,s.modelo.t+xx,Math.max(.5,esc*.075));}
  }
  function losa(s,c,l,q){
    const x=q.cx+(l.x-(l.ancho||2)/2)*q.esc,y=q.cy+(l.y-(l.alto||2)/2)*q.esc,an=(l.ancho||2)*q.esc,al=(l.alto||2)*q.esc,t=s.modelo.t,edad=l.edad||0,progreso=lim(edad/(l.aviso||1.25),0,1);
    if(edad<0)return;
    if(progreso<1){const pulso=s.reducido?.65:(Math.sin(TAU*(2*edad+5*edad*progreso*progreso))>0?1:.25);c.save();c.globalAlpha=.16+pulso*.15;bloque(c,x,y,an,al,P.fuego);c.globalAlpha=.5+pulso*.5;c.strokeStyle=P.fuego;c.lineWidth=1;c.strokeRect(Math.round(x)+1,Math.round(y)+1,Math.round(an)-2,Math.round(al)-2);c.globalAlpha=1;
      for(let i=0;i<4;i++){const xx=x+an*(.2+i*.19),yy=y+al*(.2+(i%2)*.16);linea(c,xx,y,xx-3,yy,P.negro,2);linea(c,xx-3,yy,xx+4,y+al*.73,P.negro,2);linea(c,xx+4,y+al*.73,xx,y+al,P.negro,2);linea(c,xx-2,yy,xx+5,y+al*.73,P.fuego);}
      c.restore();return;
    }
    // Los bordes del vacío coinciden con el rectángulo del daño, sin agrandarlo.
    bloque(c,x,y,an,al,'#030510');bloque(c,x,y,an,2,'#192737');bloque(c,x,y,2,al,'#1a2d38');bloque(c,x+an-1,y,1,al,'#685e48');bloque(c,x,y+al-1,an,1,'#8b7050');
    const caida=lim((edad-(l.aviso||1.25))/(l.caida||.45),0,1);
    if(caida<1){c.save();c.beginPath();c.rect(x,y,an,al);c.clip();c.globalAlpha=1-caida*.8;for(let i=0;i<4;i++){const lado=an*.45*(1-caida*.55),xx=x+(i%2)*an*.5+caida*an*.15,yy=y+Math.floor(i/2)*al*.5+caida*caida*al*.65;c.drawImage(textura()[i+2],Math.round(xx),Math.round(yy),Math.round(lado),Math.round(lado));}c.restore();}
    for(let i=0;i<5;i++){const f=(t*.55+i*.173)%1;bloque(c,x+an*(.1+(i*.237)% .8),y+al*f,1,1,i%2?'#284152':'#192d40');}
  }
  function marca(s,c,m,q){
    const x=q.cx+m.x*q.esc,y=q.cy+m.y*q.esc,r=m.r*q.esc,edad=m.edad-m.aviso,t=s.modelo.t;
    if(edad<0){const a=API.modelo.avisoMarca(m),pulso=s.reducido?.7:a.pulso;c.save();c.globalAlpha=.13+pulso*.12;circulo(c,x,y,r,P.rojo);c.globalAlpha=.45+pulso*.55;circulo(c,x,y,r,P.fuego,1);for(let i=0;i<12;i++){const aa=i*TAU/12;bloque(c,x+Math.cos(aa)*r*1.10-1,y+Math.sin(aa)*r*1.10-1,2,2,i/12<a.progreso?P.blanco:P.rojo);}c.restore();return;}
    if(edad<m.activo){const f=edad/m.activo;resplandor(c,x,y,r*1.7,P.fuego);circulo(c,x,y,r,P.rojo);circulo(c,x,y,r*(1-f*.25),P.fuego);circulo(c,x,y,r*(1-f),P.blanco);for(let i=0;i<14;i++){const aa=i*2.4,dist=r*(.3+f);bloque(c,x+Math.cos(aa)*dist,y+Math.sin(aa)*dist,2,2,P.hueso);}return;}
    const vivo=edad<m.activo+(m.fuego||0),anillo=(m.anchoFuego||.18)*q.esc;
    circulo(c,x,y,r,vivo?'#873d33':'#342a2e',Math.max(2,anillo*2));
    if(vivo){circulo(c,x,y,r,P.fuego,Math.max(1,anillo));for(let i=0;i<22;i++){const aa=i*TAU/22,xx=x+Math.cos(aa)*r,yy=y+Math.sin(aa)*r;llama(c,xx,yy,t+i*.073,Math.max(.28,q.esc*.028));}resplandor(c,x,y,r*1.22,P.fuego);}
  }
  function cosecha(s,c){
    const q=camara(s),m=s.modelo,p=m.jugador,t=m.t,{esc,cx,cy}=q;suelo(s,c,q);
    for(const m of s.modelo.marcas)marca(s,c,m,q);
    for(const b of m.balas){const x=cx+b.x*esc,y=cy+b.y*esc;linea(c,x-b.vx*esc*.055,y-b.vy*esc*.055,x,y,P.azul,3);linea(c,x-b.vx*esc*.032,y-b.vy*esc*.032,x,y,P.hielo,1);bloque(c,x-1,y-1,2,2,P.blanco);}
    for(const e of m.enemigos){const x=cx+e.x*esc,y=cy+e.y*esc;c.save();c.globalAlpha=e.aparece>0?lim(1-e.aparece/.65,.12,1):1;circulo(c,x+1,y+3,esc*.4,'#07091499');sprite(s,c,x,y,esc*1.44,true,Math.atan2(p.y-e.y,p.x-e.x),t+(e.fase||0));c.restore();if(e.aparece>0){const r=(.45+e.aparece*.5)*esc;circulo(c,x,y,r,P.vino,1);for(let i=0;i<6;i++){const aa=i*TAU/6+t;bloque(c,x+Math.cos(aa)*r,y+Math.sin(aa)*r,1,2,P.rojo);}}}
    const x=cx+p.x*esc,y=cy+p.y*esc,regreso=lim((m.caidaJugador||0)/.35,0,1);circulo(c,x,y,esc*.51,'#77978680',1);
    // Tras el rescate sobre la cruz firme, la silueta recupera su tamaño.
    // El efecto sigue el estado ya resuelto por el modelo, sin mover al jugador.
    sprite(s,c,x,y,esc*1.52*(1-regreso*.52),false,p.a,t*(s.andando||0));
    if(regreso>0){circulo(c,x,y,esc*(.5+(1-regreso)*.5),P.hielo,1);for(let i=0;i<7;i++){const aa=i*TAU/7,dist=esc*(1-regreso)*.8;bloque(c,x+Math.cos(aa)*dist,y+Math.sin(aa)*dist,1,2,P.hueso);}}
    if(m.fogonazo>0){const xx=x+Math.cos(p.a)*esc*.65,yy=y+Math.sin(p.a)*esc*.65;resplandor(c,xx,yy,esc*.7,P.azul);bloque(c,xx-2,yy-1,5,2,P.hielo);bloque(c,xx,yy-3,1,6,P.blanco);}
    for(const a of m.particulas){c.globalAlpha=lim(a.t*3,0,1);bloque(c,cx+a.x*esc,cy+a.y*esc,2,2,a.color);}c.globalAlpha=1;
    if((m.presionCosecha||0)>.01){const fuerza=m.presionCosecha;c.save();c.globalAlpha=.07+fuerza*.08;bloque(c,0,0,s.ancho,3,P.fuego);bloque(c,0,s.alto-3,s.ancho,3,P.rojo);c.restore();}
  }
  function extremos(r){const ps=[],dx=-r.ny,dy=r.nx,x=r.nx*r.offset,y=r.ny*r.offset;for(const borde of [-7,7]){if(Math.abs(dx)>1e-7){const k=(borde-x)/dx,yy=y+k*dy;if(Math.abs(yy)<=7.0001)ps.push({x:borde,y:yy,k});}if(Math.abs(dy)>1e-7){const k=(borde-y)/dy,xx=x+k*dx;if(Math.abs(xx)<=7.0001)ps.push({x:xx,y:borde,k});}}ps.sort((a,b)=>a.k-b.k);return[ps[0],ps[ps.length-1]];}
  function laseres(s,c){
    const q=camara(s),{esc,cx,cy}=q,m=s.modelo,t=m.t;suelo(s,c,q,true);
    c.save();c.beginPath();c.rect(cx-7*esc,cy-7*esc,14*esc,14*esc);c.clip();
    for(const r of m.rayos){if(r.edad<0)continue;const dx=-r.ny,dy=r.nx,ax=cx+(r.nx*r.offset+dx*15)*esc,ay=cy+(r.ny*r.offset+dy*15)*esc,bx=cx+(r.nx*r.offset-dx*15)*esc,by=cy+(r.ny*r.offset-dy*15)*esc,an=r.ancho*2*esc,aviso=r.edad<r.aviso;
      c.save();if(aviso){const f=lim(r.edad/r.aviso,0,1),pulso=s.reducido?1:.7+.3*Math.sin(r.edad*(10+f*20));c.globalAlpha=.15+f*.18;linea(c,ax,ay,bx,by,P.fuego,an);c.globalAlpha=.55+pulso*.4;c.setLineDash([3,3]);linea(c,ax,ay,bx,by,P.hueso,1);c.setLineDash([]);for(const lado of [-1,1]){c.globalAlpha=.3+f*.5;linea(c,ax+r.nx*r.ancho*esc*lado,ay+r.ny*r.ancho*esc*lado,bx+r.nx*r.ancho*esc*lado,by+r.ny*r.ancho*esc*lado,P.fuego,1);}}
      else{const activo=r.edad<r.aviso+r.activo;c.globalAlpha=activo?1:lim(1-(r.edad-r.aviso-r.activo)/.25,0,1);linea(c,ax,ay,bx,by,P.rojo,an);linea(c,ax,ay,bx,by,P.fuego,Math.max(1,an*.62));linea(c,ax,ay,bx,by,P.blanco,Math.max(1,an*.25));for(let i=0;i<16;i++){const f=(i/16+t*1.3)%1,x=ax+(bx-ax)*f,y=ay+(by-ay)*f;bloque(c,x+r.nx*an*.2,y+r.ny*an*.2,1,1,P.hielo);}}
      c.restore();
    }c.restore();
    for(const r of m.rayos){if(r.edad<0)continue;const aviso=r.edad<r.aviso;for(const e of extremos(r)){if(!e)continue;const x=cx+e.x*esc,y=cy+e.y*esc;resplandor(c,x,y,esc*.9,aviso?P.fuego:P.rojo);bloque(c,x-4,y-4,8,8,P.negro);bloque(c,x-3,y-3,6,6,P.borde);bloque(c,x-2,y-2,4,4,aviso?P.oro:P.rojo);bloque(c,x-1,y-1,2,2,aviso?P.fuego:P.blanco);}}
    const p=m.jugador,x=cx+p.x*esc,y=cy+p.y*esc,a=Math.atan2(m.ultimoMovimiento.y,m.ultimoMovimiento.x);if(m.impulso>0){const u=m.ultimoMovimiento;linea(c,x,y,x-u.x*esc*1.3,y-u.y*esc*1.3,P.azul,esc*.35);circulo(c,x,y,esc*.7,P.hielo,1);}sprite(s,c,x,y,esc*1.8,false,a,t*(s.andando||0));circulo(c,x,y,esc*p.r,P.hielo,1);
    for(const p of m.particulas){c.globalAlpha=lim(p.t*3,0,1);bloque(c,cx+p.x*esc,cy+p.y*esc,1,2,p.color);}c.globalAlpha=1;
  }
  function runP(s,x,z,y=0){const k=1/(1+Math.max(-3,z)*.082);return{x:s.ancho*.5+x*s.ancho*.235*k,y:s.alto*.22+s.alto*.62*k-y*s.alto*.115*k,k};}
  function carrera(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t;bloque(c,0,0,w,h,P.negro);resplandor(c,w*.5,h*.21,w*.65,P.azul);circulo(c,w*.5,h*.17,Math.min(w,h)*.14,'#9baf91');circulo(c,w*.517,h*.158,Math.min(w,h)*.137,P.negro);
    for(let capa=0;capa<3;capa++)for(let i=0;i<18;i++){const x=i*w/17+Math.sin(i*11+capa)*6,al=h*(.08+Math.abs(Math.sin(i*8+capa))* .21),y=h*(.45+capa*.04);figura(c,[[x-9,y],[x-5,y-al*.6],[x-3,y-al],[x+2,y-al-4],[x+5,y-al*.6],[x+9,y]],['#142431','#1d2c38','#23303b'][capa]);}
    for(let z=66;z>-3;z-=2){const zz=z-(m.distancia%2),a=runP(s,-1.72,zz),b=runP(s,1.72,zz),d=runP(s,-1.72,zz+2),e=runP(s,1.72,zz+2),v=Math.floor((zz+m.distancia)/2);figura(c,[[a.x,a.y],[b.x,b.y],[e.x,e.y],[d.x,d.y]],v%2?'#405351':'#344448');linea(c,a.x,a.y,b.x,b.y,'#122832',Math.max(1,a.k));linea(c,a.x,a.y+1,b.x,b.y+1,'#7c8b6d',Math.max(1,a.k));
      for(const xx of [-1.67,-.5,.5,1.67]){const p=runP(s,xx,zz),q=runP(s,xx,zz+2);linea(c,p.x,p.y,q.x,q.y,Math.abs(xx)>1?'#a49364':'#888a6459',Math.max(1,p.k));}
      for(let j=0;j<4;j++){const xx=Math.sin(v*11.3+j*7.2)*1.55,p=runP(s,xx,zz+.1),q=runP(s,xx+.10,zz+.6);linea(c,p.x,p.y,q.x,q.y,'#253a3d');}
    }
    for(let i=10;i>=0;i--){const z=i*7-(m.distancia%7)+1;if(z<0)continue;for(const lado of [-1,1]){const pie=runP(s,lado*1.93,z),alto=runP(s,lado*1.93,z,4.1),an=w*.15*pie.k;figura(c,[[pie.x-an*.4,pie.y],[pie.x-an*.34,alto.y],[pie.x+an*.34,alto.y],[pie.x+an*.48,pie.y]],'#2e4146');bloque(c,pie.x-an*.33,alto.y,Math.max(1,an*.13),pie.y-alto.y,'#71816e');
        for(let j=0;j<9;j++){const y=alto.y+(pie.y-alto.y)*j/9;linea(c,pie.x-an*.34,y,pie.x+an*.34,y,P.negro,Math.max(1,pie.k));linea(c,pie.x-an*.3,y+1,pie.x+an*.3,y+1,'#52685d');}
        bloque(c,pie.x-an*.48,alto.y-an*.12,an*.96,an*.16,P.borde);const ant=runP(s,lado*1.69,z,1.05);resplandor(c,ant.x,ant.y,an,P.fuego);brasero(c,ant.x,ant.y,t+i,Math.max(.2,an*.055));
      }if(i%2===0){const a=runP(s,-1.93,z,4),b=runP(s,1.93,z,4);for(let j=0;j<14;j++){const f=j/13,x=a.x+(b.x-a.x)*f,y=a.y-Math.sin(f*Math.PI)*h*.14*a.k;bloque(c,x,y,Math.max(2,w*.04*a.k),Math.max(2,w*.024*a.k),j%2?'#5d7263':'#344d4a');}}}
    for(const o of m.obstaculos.filter(o=>o.z>-.3).slice().sort((a,b)=>b.z-a.z)){
      const p=runP(s,o.carril,o.z),an=w*.19*p.k;
      if(o.tipo==='sello'){const a=runP(s,-1.55,o.z,.5),b=runP(s,1.55,o.z,.5);linea(c,a.x,a.y,b.x,b.y,P.rojo,Math.max(2,7*p.k));linea(c,a.x,a.y,b.x,b.y,P.blanco,Math.max(1,2*p.k));for(let j=-1;j<=1;j++){const q=runP(s,j,o.z,.5);figura(c,[[q.x,q.y-an*.14],[q.x+an*.13,q.y],[q.x,q.y+an*.14],[q.x-an*.13,q.y]],P.fuego,P.hueso);}}
      else{const q=runP(s,o.carril,o.z,1.8);figura(c,[[p.x-an*.42,p.y],[p.x-an*.34,q.y],[p.x+an*.32,q.y-an*.12],[p.x+an*.46,p.y]],'#1f3038',P.borde);figura(c,[[p.x-an*.34,q.y],[p.x+an*.32,q.y-an*.12],[p.x+an*.25,q.y+an*.05],[p.x-an*.30,q.y+an*.12]],'#7e8b70');for(let j=1;j<5;j++){const y=q.y+(p.y-q.y)*j/5;linea(c,p.x-an*.33,y,p.x+an*.33,y,P.negro);linea(c,p.x-an*.30,y+1,p.x+an*.30,y+1,'#4e685e');}linea(c,p.x,q.y+an*.18,p.x,p.y-an*.13,P.fuego,Math.max(1,an*.055));}
    }
    const p=runP(s,m.carrilVisual,0),tam=Math.min(w*.145,h*.2),salto=m.salto*h*.085+Math.sin((1-m.carrilCambio/.18)*Math.PI)*tam*.1;circulo(c,p.x,p.y,tam*.30,'#07132199');sprite(s,c,p.x,p.y-salto,tam,false,-Math.PI/2,t*1.4,false);
    if(m.salto>0){c.strokeStyle=P.oro;c.lineWidth=1;c.beginPath();c.ellipse(p.x,p.y,tam*.36,tam*.1,0,0,TAU);c.stroke();}estrellitas(c,w,h,-t*4,P.hueso,18);
  }
  function nave(){if(naves)return naves;naves=[];for(let f=0;f<6;f++){const n=lienzo(32,40),c=n.getContext('2d');figura(c,[[16,1],[20,13],[21,17],[29,24],[29,29],[20,27],[17,32],[15,32],[12,27],[3,29],[3,24],[11,17],[12,13]],P.negro);figura(c,[[16,3],[18,17],[26,25],[26,27],[19,24],[17,29],[15,29],[13,24],[6,27],[6,25],[14,17]],'#657f85');figura(c,[[16,4],[18,18],[22,23],[17,22],[16,27],[15,22],[10,23],[14,18]],P.hielo);bloque(c,15,11,2,9,P.oro);bloque(c,15,13,2,4,'#fff0bd');bloque(c,13,27,6,3,'#263d56');bloque(c,14,30,4,4+f%3,P.azul);bloque(c,15,30,2,3+f%2,P.hielo);bloque(c,15,36,2,1+f%3,'#517aa9');naves.push(normalizar(n));}return naves;}
  function mundoMuerto(){
    if(planeta)return planeta;planeta=lienzo(128,128);const c=planeta.getContext('2d'),im=c.createImageData(128,128),crateres=Array.from({length:19},(_,i)=>({x:Math.sin(i*71.33)*.87,y:Math.cos(i*14.61)*.87,r:.025+(i%5)*.035}));
    const colores=[[8,16,32],[16,32,48],[24,48,64],[40,64,72],[64,88,88],[88,112,104],[120,136,112],[152,160,128]];
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){const xx=(x-63.5)/63.5,yy=(y-63.5)/63.5,d=xx*xx+yy*yy;if(d>1)continue;const z=Math.sqrt(1-d);let luz=Math.max(0,(-xx*.54-yy*.42+z*.72));
      for(const q of crateres){const dx=xx-q.x,dy=yy-q.y,dist=Math.hypot(dx,dy);if(dist<q.r)luz+=dist>q.r*.78?.12:-(.15+dx/q.r*.10);}
      luz+=(Math.sin(x*117+y*391)*.5)*.026;const paso=lim(Math.floor(luz*6.4+(trama[(y%4)*4+x%4]+.5)/16),0,7),rgb=colores[paso],i=(y*128+x)*4;im.data[i]=rgb[0];im.data[i+1]=rgb[1];im.data[i+2]=rgb[2];im.data[i+3]=255;
    }c.putImageData(im,0,0);return planeta;
  }
  function orbital(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t,esc=Math.min(w/13,h/17),cx=w*.5,cy=h*.52;bloque(c,0,0,w,h,P.negro);
    // Estratos de nebulosa, luna tramada y estrellas de un píxel: sin sprites suaves.
    for(let i=0;i<13;i++)resplandor(c,w*(.65+Math.sin(i*4.1)*.38),h*(.25+Math.cos(i*3.9)*.24),w*(.3+i%3*.12),i%2?'#61517c':'#315b70');
    const px=w*1.05,py=h*.70,pr=Math.min(w*.4,h*.26);c.drawImage(mundoMuerto(),Math.round(px-pr),Math.round(py-pr),Math.round(pr*2),Math.round(pr*2));
    for(let capa=0;capa<3;capa++)for(let i=0;i<35;i++){const x=(Math.sin(i*57.31+capa*87)*.5+.5)*w,y=((Math.cos(i*17.13+capa)*.5+.5)*h+t*(3+capa*10))%h;bloque(c,x,y,1,capa===2?2:1,capa===2?P.hueso:'#526a7b');}
    const bx=Math.sin(t*.55)*2.4,x=cx+bx*esc,y=cy-7.2*esc,r=esc*.78;resplandor(c,x,y,r*4,P.rojo);for(let i=0;i<12;i++){const a=i*TAU/12+t*.13;figura(c,[[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a+.13)*r*2.4,y+Math.sin(a+.13)*r*2.4],[x+Math.cos(a+.3)*r,y+Math.sin(a+.3)*r]],i%2?'#60465a':'#344052',P.sombra);}circulo(c,x,y,r,'#ba6d75');circulo(c,x,y,r*.84,P.negro);bloque(c,x-r*.3,y-r*.2,2,2,P.fuego);bloque(c,x+r*.25,y-r*.2,2,2,P.fuego);
    for(const q of m.estela){c.globalAlpha=lim(q.t*.65,0,.3);bloque(c,cx+q.x*esc-1,cy+q.y*esc,3,5,P.azul);}c.globalAlpha=1;
    for(const b of m.balas){const xx=cx+b.x*esc,yy=cy+b.y*esc,r=Math.max(1,b.r*esc);linea(c,xx-b.vx*esc*.07,yy-b.vy*esc*.07,xx,yy,P.vino,r*2.5);circulo(c,xx,yy,r+1,P.rojo);circulo(c,xx,yy,r,P.fuego);bloque(c,xx,yy,1,1,P.blanco);}
    const p=m.jugador,xx=cx+p.x*esc,yy=cy+p.y*esc,tam=esc*1.5,n=nave()[s.reducido?0:Math.floor(t*12)%6];c.save();if(m.invulnerable>0&&Math.floor(t*12)%2)c.globalAlpha=.5;c.translate(Math.round(xx),Math.round(yy));c.rotate(lim(m.ultimoMovimiento.x,-1,1)*.13);c.drawImage(n,-tam/2,-tam*.75,tam,tam*1.25);c.restore();
    if(m.escudo>0){resplandor(c,xx,yy,esc*1.3,P.azul);for(let i=0;i<12;i++){const a=i*TAU/12;linea(c,xx+Math.cos(a)*esc*.68,yy+Math.sin(a)*esc*.68,xx+Math.cos(a+.4)*esc*.68,yy+Math.sin(a+.4)*esc*.68,P.hielo,1);}circulo(c,xx,yy,esc*.54,P.azul,1);}
    for(const q of m.particulas){c.globalAlpha=lim(q.t*2,0,1);bloque(c,cx+q.x*esc,cy+q.y*esc,1,2,q.color);}c.globalAlpha=1;
  }
  function memoria(s,c){
    const w=s.ancho,h=s.alto,t=s.modelo.t;bloque(c,0,0,w,h,P.negro);resplandor(c,w*.5,h*.5,w*.6,P.azul);
    // Libreros a los lados dejan limpia la zona central de las cartas oficiales.
    for(const lado of [-1,1]){const x=lado<0?0:w-22;bloque(c,x,0,22,h,'#152330');bloque(c,x+(lado<0?20:0),0,2,h,'#526252');for(let y=15;y<h;y+=35){bloque(c,x,y+25,22,3,'#526252');for(let i=0;i<5;i++){const al=13+(i*7+y)%10;bloque(c,x+2+i*4,y+25-al,3,al,['#5d555a','#4b6560','#807452','#4d596b','#775251'][i]);bloque(c,x+2+i*4,y+29-al,3,1,P.oro);}}}
    for(let y=h*.14;y<h;y+=20){linea(c,22,y,w-22,y,'#243236');for(let i=0;i<6;i++)bloque(c,25+(i*37+y*3)%(w-50),y+7,3,1,'#263940');}
    c.globalAlpha=.18;for(const r of [.24,.27,.44])circulo(c,w*.5,h*.49,Math.min(w,h)*r,P.oro,1);c.globalAlpha=1;
    for(const lado of [-1,1]){const x=w*.5+lado*w*.38,y=h*.16;resplandor(c,x,y,w*.15,P.fuego);bloque(c,x-2,y,4,10,P.hueso);llama(c,x,y,t+lado, .7);}estrellitas(c,w,h,t,P.oro,24);
  }
  API.pintores=Object.assign(API.pintores||{},{isometrico:cosecha,laseres,carrera,orbital,duelo:memoria});
  API.pintarEscena=function(s,c,dibujar){
    if(!tipos.includes(s.tipo)){dibujar(c);return;}
    const w=s.ancho,h=s.alto,factor=Math.min(1,384/w,224/Math.min(w,h),Math.sqrt(95000/(w*h))),ww=Math.max(2,Math.floor(w*factor)),hh=Math.max(2,Math.floor(h*factor));
    let a=s.editorPixel;if(!a){const n=lienzo(ww,hh);a=s.editorPixel={lienzo:n,c:n.getContext('2d',{alpha:false,willReadFrequently:true})};}
    if(a.lienzo.width!==ww||a.lienzo.height!==hh){a.lienzo.width=ww;a.lienzo.height=hh;}
    a.c.setTransform(1,0,0,1,0,0);a.c.globalAlpha=1;a.c.imageSmoothingEnabled=false;a.c.clearRect(0,0,ww,hh);
    s.ancho=ww;s.alto=hh;
    try{dibujar(a.c);}finally{s.ancho=w;s.alto=h;}
    // Cuantizar el lienzo completo evita bordes suaves en los giros de 360°:
    // la rotación sigue siendo continua, nunca se reduce a ocho direcciones.
    const im=a.c.getImageData(0,0,ww,hh),d=im.data;for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,Math.round(d[i]/8)*8);d[i+1]=Math.min(255,Math.round(d[i+1]/8)*8);d[i+2]=Math.min(255,Math.round(d[i+2]/8)*8);}a.c.putImageData(im,0,0);
    c.save();c.imageSmoothingEnabled=false;c.drawImage(a.lienzo,0,0,w,h);c.restore();
  };
  API.pixel={revision:222,pintores:tipos.slice()};
  const css=document.createElement('style');css.id='pitagorasPixelCSS';css.textContent=`
    .pitPrueba.pitPrueba .ppLienzo{image-rendering:pixelated}
    .pitPrueba.pitPrueba .ppCabecera{box-shadow:inset 0 -2px #080c18,inset 0 -3px #57675744,0 5px 0 #080c1830}
    .pitPrueba.pitPrueba .ppControles{box-shadow:inset 0 2px #54665c33,inset 0 4px #080c18}
    .pitPrueba.pitPrueba .ppAvatar{border-radius:2px;box-shadow:0 0 0 1px #080c18,0 0 0 2px #747b6155}
    .pitPrueba.pitPrueba .ppCronoBarra{height:3px}.pitPrueba.pitPrueba .ppCronoBarra i{background:linear-gradient(90deg,#506c68,#b8a77b);box-shadow:none}
    .pitPrueba.pitPrueba .ppTiempo{font-family:ui-monospace,SFMono-Regular,monospace;font-weight:600;font-size:26px;letter-spacing:-2px;text-shadow:2px 2px #080c18}
    @media(max-height:440px){.pitPrueba.pitPrueba .ppTiempo{font-size:22px}}
  `;document.head.appendChild(css);
})(typeof window!=='undefined'?window:globalThis);

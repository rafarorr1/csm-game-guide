/* El archivo del Editor. Presentación por raycasting; no cambia el mundo,
   las colisiones, los disparos ni el reloj del modelo de las pruebas. */
'use strict';
(function(global){
  if(typeof document==='undefined'||!global.PITAGORAS_PRUEBAS)return;
  const API=global.PITAGORAS_PRUEBAS,M=API.modelo,TAU=Math.PI*2,lim=(n,a,b)=>Math.max(a,Math.min(b,n));
  let materiales=null,atlas=null;
  function canvas(w,h){const n=document.createElement('canvas');n.width=w;n.height=h;return n;}
  function linea(c,x,y,xx,yy,color,ancho=1){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=ancho;c.stroke();}
  function figura(c,ps,color,borde){c.beginPath();for(let i=0;i<ps.length;i++)i?c.lineTo(...ps[i]):c.moveTo(...ps[i]);c.closePath();c.fillStyle=color;c.fill();if(borde){c.strokeStyle=borde;c.stroke();}}
  function crearMateriales(){
    if(materiales)return materiales;
    let semilla=218991;const azar=()=>{semilla=(Math.imul(semilla,1664525)+1013904223)>>>0;return semilla/4294967296;};
    const pared=canvas(256,256),c=pared.getContext('2d');
    let g=c.createLinearGradient(0,0,256,0);g.addColorStop(0,'#172126');g.addColorStop(.13,'#596267');g.addColorStop(.23,'#242f35');g.addColorStop(.75,'#323f43');g.addColorStop(.87,'#647175');g.addColorStop(1,'#131d24');c.fillStyle=g;c.fillRect(0,0,256,256);
    for(let i=0;i<7500;i++){const x=azar()*256,y=azar()*256;c.fillStyle=azar()>.5?'#b5babc10':'#02070b14';c.fillRect(x,y,1+azar()*3,1+azar()*2);}
    c.fillStyle='#080f16';c.fillRect(44,21,168,214);c.strokeStyle='#86918d';c.lineWidth=2;c.strokeRect(40,18,176,220);c.strokeStyle='#c4b48a';c.lineWidth=1;c.strokeRect(47,24,162,206);
    for(let i=0;i<5;i++){const y=36+i*35;g=c.createLinearGradient(0,y,0,y+29);g.addColorStop(0,'#425053');g.addColorStop(.15,'#19272d');g.addColorStop(.85,'#17232b');g.addColorStop(1,'#4a5555');c.fillStyle=g;c.fillRect(60,y,136,29);c.strokeStyle='#070d13';c.strokeRect(60,y,136,29);
      for(let j=0;j<9;j++){const x=69+j*14;linea(c,x,y+8,x,y+22,'#050b10',2);linea(c,x+2,y+8,x+2,y+22,'#82918c35',1);}c.fillStyle=i%2?'#829d8b':'#b29b6d';c.fillRect(181,y+5,3,2);}
    for(const x of [24,232]){c.fillStyle='#070e13';c.fillRect(x-5,12,10,235);g=c.createLinearGradient(x-4,0,x+4,0);g.addColorStop(0,'#456560');g.addColorStop(.5,'#9cc0a3');g.addColorStop(1,'#2b4547');c.fillStyle=g;c.fillRect(x-2,29,4,186);for(let y=37;y<220;y+=35)c.fillRect(x-7,y,14,3);}
    for(const y of [0,8,239,248]){c.fillStyle=y%8?'#718078':'#111820';c.fillRect(0,y,256,4);}c.strokeStyle='#a398762e';for(let i=0;i<12;i++){const x=azar()*256,y=azar()*256;c.beginPath();c.moveTo(x,y);c.lineTo(x+azar()*13,y+8);c.lineTo(x-azar()*8,y+15);c.stroke();}
    const suelo=canvas(128,128),s=suelo.getContext('2d');s.fillStyle='#354044';s.fillRect(0,0,128,128);
    for(let i=0;i<6000;i++){s.fillStyle=azar()>.5?'#c6c8ad12':'#070b101b';s.fillRect(azar()*128,azar()*128,1+azar()*3,1+azar()*2);}
    s.fillStyle='#0f1920';s.fillRect(0,0,128,3);s.fillRect(0,0,3,128);s.fillStyle='#667376';s.fillRect(3,3,125,1);s.fillRect(3,3,1,125);s.strokeStyle='#9e956c';s.globalAlpha=.45;s.strokeRect(8.5,8.5,110,110);s.globalAlpha=1;
    for(let i=0;i<5;i++){const x=azar()*128,y=azar()*128;s.strokeStyle='#0b121b80';s.beginPath();s.moveTo(x,y);s.lineTo(x+6,y+11);s.lineTo(x+2,y+21);s.lineTo(x+11,y+27);s.stroke();}
    const techo=canvas(128,128),t=techo.getContext('2d');t.fillStyle='#18252c';t.fillRect(0,0,128,128);t.fillStyle='#090e17';t.fillRect(13,13,102,102);t.strokeStyle='#465558';t.lineWidth=3;t.strokeRect(9,9,110,110);t.strokeStyle='#75877c';t.lineWidth=1;t.strokeRect(12,12,104,104);
    for(let i=0;i<6;i++){const y=32+i*13;linea(t,30,y,98,y,'#26343a',3);}t.strokeStyle='#596459';t.beginPath();t.moveTo(0,0);t.lineTo(128,128);t.moveTo(128,0);t.lineTo(0,128);t.stroke();
    // Paleta escalonada: los materiales y las criaturas comparten píxeles nítidos.
    for(const textura of [pared,suelo,techo]){const ctx=textura.getContext('2d'),im=ctx.getImageData(0,0,textura.width,textura.height),d=im.data;for(let i=0;i<d.length;i+=4){d[i]=Math.round(d[i]/12)*12;d[i+1]=Math.round(d[i+1]/12)*12;d[i+2]=Math.round(d[i+2]/12)*12;}ctx.putImageData(im,0,0);}
    materiales={pared,suelo:s.getImageData(0,0,128,128).data,techo:t.getImageData(0,0,128,128).data};return materiales;
  }
  function crearAtlas(){
    if(atlas)return atlas;
    const pasos=[],heridas=[],muertes=[],blanco=canvas(64,96);
    function dibujar(fase,herido){
      const n=canvas(64,96),c=n.getContext('2d'),z=Math.sin(fase),paso=Math.round(z*4),alza=herido?-3:Math.round(Math.abs(z)*2),torsion=herido?3:Math.round(z),y=alza;
      c.imageSmoothingEnabled=false;
      // La silueta se dibuja a mano sobre 64 × 96: garras, costillas, máscara y cables.
      const bloque=(x,yy,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(yy),Math.round(w),Math.round(h));};
      for(const lado of [-1,1]){
        const x=32+lado*10,dy=lado*paso;
        figura(c,[[x-6,61+y],[x+6,61+y],[x+5,79+dy],[x+lado*4,87+dy],[x+lado*10,89+dy],[x+lado*9,92+dy],[x-5,91+dy],[x-7,78+dy]],'#100f1c');
        bloque(x-3,65+y,5,14,'#665167');bloque(x-2,65+y,2,10,'#a57f85');bloque(x-2,80+dy,4,8,'#33273e');bloque(x-3,89+dy,9,2,'#adada0');
        const hombro=32+lado*13+torsion,codo=32+lado*(23+(herido?2:0)),mano=32+lado*(24-Math.round(z*lado*3)),brazo=lado*paso;
        figura(c,[[hombro-5,31+y],[hombro+5,31+y],[codo+4,49-brazo],[mano+4,64-brazo],[mano-4,67-brazo],[codo-5,50-brazo]],'#121421');
        linea(c,hombro,34+y,codo,48-brazo,'#725467',6);linea(c,hombro-lado,35+y,codo-lado,48-brazo,'#bd8f91',2);linea(c,codo,49-brazo,mano,62-brazo,'#443145',5);
        for(let k=0;k<3;k++){bloque(mano-4+k*3,63-brazo,2,7-k,'#cebaa5');bloque(mano-4+k*3,69-brazo-k,1,4,'#f5dfb2');}
        for(let k=0;k<2;k++){const tx=32+lado*(17+k*3);linea(c,tx,40+y,tx+lado*(8+k),55-k*4,'#273a41',2);linea(c,tx+lado*(8+k),55-k*4,tx+lado*(3+k),73+k*3,'#66877c',1);}
      }
      figura(c,[[19+torsion,28+y],[44+torsion,28+y],[49,44+y],[41,63+y],[45,75+y],[34,72+y],[31,65+y],[27,74+y],[17,74+y],[24,58+y],[16,44+y]],'#151722');
      figura(c,[[21+torsion,31+y],[41+torsion,31+y],[42,51+y],[34,66+y],[29,63+y],[22,47+y]],'#493746');
      figura(c,[[24+torsion,34+y],[32+torsion,37+y],[38+torsion,33+y],[36,56+y],[30,60+y]],'#79616a');
      for(let k=0;k<5;k++){bloque(21+torsion+k*.8,36+y+k*4,9-k,2,'#baa38e');bloque(34+torsion,36+y+k*4,8-k,2,'#9d887b');bloque(29+torsion,35+y+k*4,3,3,'#171b28');}
      bloque(27,61+y,11,5,'#928771');bloque(30,62+y,5,3,'#ddd0a2');
      // Máscara partida y coronación de alambre: los ojos nunca se pierden en la sombra.
      figura(c,[[24+torsion,6+y],[38+torsion,5+y],[45+torsion,14+y],[43+torsion,26+y],[35+torsion,32+y],[26+torsion,28+y],[20+torsion,17+y]],'#101620');
      figura(c,[[24+torsion,9+y],[37+torsion,8+y],[41+torsion,14+y],[38+torsion,25+y],[34+torsion,29+y],[26+torsion,25+y],[23+torsion,17+y]],'#c2b592');
      figura(c,[[36+torsion,9+y],[40+torsion,14+y],[37+torsion,24+y],[33+torsion,27+y],[34+torsion,18+y]],'#7c877c');
      bloque(25+torsion,15+y,6,5,'#39202f');bloque(34+torsion,14+y,6,5,'#39202f');bloque(26+torsion,16+y,4,2,'#ff5f52');bloque(34+torsion,15+y,4,2,'#ff5f52');bloque(27+torsion,16+y,2,1,'#fff1b4');bloque(34+torsion,15+y,2,1,'#fff1b4');
      bloque(29+torsion,23+y,7,3,'#241824');bloque(30+torsion,23+y,1,2,'#e7dcb4');bloque(33+torsion,23+y,1,2,'#e7dcb4');
      for(const lado of [-1,1]){linea(c,32+lado*9+torsion,11+y,32+lado*16+torsion,4+y,'#92afa0',2);linea(c,32+lado*16+torsion,4+y,32+lado*15+torsion,0,'#435d62',1);}
      if(herido){bloque(19,38+y,5,3,'#fdf1be');bloque(42,21+y,3,4,'#ffd79e');}
      // Evita bordes grises de antialias en diagonales: alfa binario en todo el atlas.
      const im=c.getImageData(0,0,64,96),d=im.data;for(let i=0;i<d.length;i+=4){if(d[i+3]<110)d[i+3]=0;else{d[i]=Math.round(d[i]/8)*8;d[i+1]=Math.round(d[i+1]/8)*8;d[i+2]=Math.round(d[i+2]/8)*8;d[i+3]=255;}}c.putImageData(im,0,0);return n;
    }
    for(let i=0;i<6;i++)pasos.push(dibujar(i*TAU/6,false));
    for(let i=0;i<2;i++)heridas.push(dibujar(i*Math.PI,true));
    const bc=blanco.getContext('2d');bc.drawImage(heridas[0],0,0);bc.globalCompositeOperation='source-in';bc.fillStyle='#fff4ce';bc.fillRect(0,0,64,96);
    for(let i=0;i<6;i++){
      const n=canvas(64,96),c=n.getContext('2d'),f=i/5,base=i===0?blanco:heridas[i%2];c.imageSmoothingEnabled=false;
      if(i<3){c.save();c.translate(32,90);c.rotate((i===1?-.09:.15)*i);c.drawImage(base,-32,-90+f*28,64,96*(1-f*.35));c.restore();}
      else{const img=heridas[1].getContext('2d').getImageData(0,0,64,96).data;for(let y=0;y<96;y+=3)for(let x=0;x<64;x+=3){const k=(y*64+x)*4,sem=(x*17+y*23)%29;if(!img[k+3]||sem<(i-3)*8)continue;c.fillStyle=sem%3?'#806879':'#dab6a0';c.fillRect(x+(x-32)*f*.25,Math.min(92,y+(96-y)*f*.67+sem*.25),2+(sem%2),2);}}
      c.fillStyle='#241a29';c.fillRect(13,93,38,2);muertes.push(n);
    }
    atlas={pasos,heridas,muertes,blanco};return atlas;
  }
  function preparar(s,w,h){
    const escala=Math.min(1,440/w,Math.sqrt(150000/(w*h))),ww=Math.max(2,Math.round(w*escala)),hh=Math.max(2,Math.round(h*escala));
    let a=s.archivoFPS;if(!a){const fondo=canvas(ww,hh);a=s.archivoFPS={fondo,c:fondo.getContext('2d',{alpha:false}),w:0,h:0,z:new Float32Array(1)};}
    if(ww!==a.w||hh!==a.h){a.w=ww;a.h=hh;a.fondo.width=ww;a.fondo.height=hh;a.imagen=a.c.createImageData(ww,hh);a.z=new Float32Array(ww);}return a;
  }
  function superficies(s,a,mat,horizonte,focal,plano){
    const m=s.modelo,p=m.jugador,cos=Math.cos(p.a),sin=Math.sin(p.a),w=a.w,h=a.h,datos=a.imagen.data;
    for(let y=0;y<h;y++){
      const abajo=y>horizonte,dy=Math.abs(y-horizonte),altura=abajo?1.15:2.05,dist=Math.min(64,altura*focal/Math.max(.3,dy));
      const luz=(abajo?.85:.56)/(1+dist*.075),tx0=p.x+dist*(cos+sin*plano),ty0=p.y+dist*(sin-cos*plano),pasoX=-sin*2*plano*dist/w,pasoY=cos*2*plano*dist/w,textura=abajo?mat.suelo:mat.techo;
      let wx=tx0,wy=ty0,indice=y*w*4;
      for(let x=0;x<w;x++,indice+=4,wx+=pasoX,wy+=pasoY){
        const tx=(Math.floor(wx*128)&127),ty=(Math.floor(wy*128)&127),i=(ty*128+tx)*4;
        const borde=1-Math.abs(x/w-.5)*.20;let brillo=luz*borde;
        if(abajo){const agua=(((wx*.5)|0)+((wy*.5)|0))%2===0?1:.82;brillo*=agua;}
        datos[indice]=Math.min(255,textura[i]*brillo+3);datos[indice+1]=Math.min(255,textura[i+1]*brillo+5);datos[indice+2]=Math.min(255,textura[i+2]*brillo+9);datos[indice+3]=255;
      }
    }
    a.c.putImageData(a.imagen,0,0);
  }
  function limitarProfundidad(c,a,cx,ancho,z,esc,h,fn){
    const ini=Math.max(0,Math.floor((cx-ancho/2)/esc)),fin=Math.min(a.w,Math.ceil((cx+ancho/2)/esc));
    if(fin<=ini)return;c.save();c.beginPath();let desde=-1,vistas=0;
    for(let x=ini;x<=fin;x++){const visible=x<fin&&z<a.z[x]+.025;if(visible&&desde<0)desde=x;if(!visible&&desde>=0){c.rect(desde*esc,0,(x-desde)*esc+.5,h);desde=-1;vistas++;}}
    if(vistas){c.clip();fn();}c.restore();
  }
  function ambiente(s,c,a,focal,horizonte,esc){
    const w=s.ancho,h=s.alto,p=s.modelo.jugador,t=s.modelo.t,cos=Math.cos(p.a),sin=Math.sin(p.a);
    const luces=[[2.5,2.5],[8,2.5],[13.3,2.5],[2.5,8],[13.3,8],[2.5,13.3],[13.3,13.3]];
    for(let i=0;i<luces.length;i++){
      const [lx,ly]=luces[i],dx=lx-p.x,dy=ly-p.y,z=dx*cos+dy*sin;if(z<.4)continue;const lateral=-dx*sin+dy*cos,cx=w/2+lateral*focal/z,cy=horizonte-(2.35-1.15)*focal/z,r=focal*.085/z,b=focal*.85/z;
      if(cx+b<0||cx-b>w)continue;
      limitarProfundidad(c,a,cx,b*2,z,esc,h,()=>{
        const pie=horizonte+1.15*focal/z,g=c.createLinearGradient(0,cy,0,pie);g.addColorStop(0,'#a5c0b316');g.addColorStop(.6,'#91aeab08');g.addColorStop(1,'#91aeab00');c.fillStyle=g;c.beginPath();c.moveTo(cx-r*1.6,cy);c.lineTo(cx-b,pie);c.lineTo(cx+b,pie);c.lineTo(cx+r*1.6,cy);c.closePath();c.fill();
        const brillo=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(1,b));brillo.addColorStop(0,'#b1d0b56a');brillo.addColorStop(.06,'#a6cdb139');brillo.addColorStop(.3,'#81acaa10');brillo.addColorStop(1,'#81acaa00');c.fillStyle=brillo;c.fillRect(cx-b,cy-b,b*2,b*2);
        c.fillStyle='#10191f';c.fillRect(cx-r*2,cy-r*2,r*4,r*3);c.fillStyle='#d5e1c6';c.fillRect(cx-r*1.5,cy-r*.4,r*3,Math.max(1,r*.7));
        for(let j=0;j<6;j++){const yy=cy+(pie-cy)*((j*.173+t*.021)%1),xx=cx+Math.sin(j*2.3+t*.31)*b*.48;c.fillStyle='#bacbb944';c.fillRect(xx,yy,1,1);}
      });
    }
  }
  function arma(s,c){
    const w=s.ancho,h=s.alto,t=s.modelo.t,tam=Math.min(w*.46,235),rec=s.modelo.fogonazo>0?1:0,bob=s.reducido?0:Math.sin(t*8)*s.andando*2.3;
    const desde=.24-(s.modelo.enfriar||0),retro=s.reducido?0:desde<.17?Math.sin(desde/.17*Math.PI)*13:0;
    c.save();c.translate(w*.56+(s.reducido?0:Math.sin(t*4)*s.andando*2),h+12+bob+retro);c.scale(tam/200,tam/200);c.rotate(s.reducido?0:-retro*.004);c.lineWidth=1;
    // La mano envuelve la culata: cuero, nervaduras y latón separan las capas.
    let g=c.createLinearGradient(-100,-60,70,-30);g.addColorStop(0,'#10121c');g.addColorStop(.25,'#403844');g.addColorStop(.58,'#24212e');g.addColorStop(1,'#090d16');
    figura(c,[[-109,24],[-93,-41],[-68,-64],[-38,-57],[-14,-9],[9,24]],g,'#84756e');
    for(let i=0;i<6;i++){const x=-88+i*7;linea(c,x,-33+i*1.5,x+9,-54+i*2,'#9d8c7266',1.5);}figura(c,[[-102,-1],[-82,-24],[-46,-23],[-30,-1]],'#1e222c','#a8997470');linea(c,-94,-2,-43,-6,'#c8b38a',2);
    g=c.createLinearGradient(-21,-112,36,-64);g.addColorStop(0,'#4f4a45');g.addColorStop(.22,'#131c27');g.addColorStop(.65,'#303941');g.addColorStop(1,'#87938a');
    figura(c,[[-29,7],[-28,-112],[-17,-147],[6,-159],[35,-135],[48,-101],[37,12]],g,'#a3967e');
    g=c.createLinearGradient(-17,0,34,0);g.addColorStop(0,'#32322f');g.addColorStop(.3,'#b6a989');g.addColorStop(.47,'#424b48');g.addColorStop(.6,'#131e27');g.addColorStop(1,'#736c56');
    figura(c,[[-18,-53],[-20,-131],[-11,-151],[6,-157],[22,-141],[32,-70]],g,'#cdc0a2');
    figura(c,[[-11,-68],[-10,-128],[0,-138],[14,-128],[18,-71]],'#080f1b','#799da0');
    const brillo=c.createLinearGradient(-8,-100,16,-100);brillo.addColorStop(0,'#27414b');brillo.addColorStop(.45,'#bddbce');brillo.addColorStop(.7,'#537f83');brillo.addColorStop(1,'#182c3c');c.fillStyle=brillo;c.fillRect(-7,-124,20,49);
    for(let i=0;i<9;i++){const y=-119+i*5;c.strokeStyle='#e4e4bf';c.globalAlpha=.35+Math.sin(t*3+i)*.15;c.beginPath();c.moveTo(-6,y);c.bezierCurveTo(4,y-4,4,y+4,12,y);c.stroke();}c.globalAlpha=1;
    for(const y of [-67,-132]){figura(c,[[-19,y],[-19,y-8],[24,y-6],[27,y+1]],'#998964','#d2bf98');linea(c,-14,y-5,19,y-3,'#282b29',1);}
    for(let i=0;i<5;i++){const y=-48+i*10;linea(c,-17,y,30,y+2,'#050d18',3);linea(c,-16,y-1,30,y+1,'#a59e794f',1);}
    for(const [x,y] of [[-21,-96],[34,-90],[-17,-56],[32,-43]]){c.fillStyle='#b8ac8d';c.beginPath();c.arc(x,y,2.5,0,TAU);c.fill();linea(c,x-1.5,y,x+1.5,y,'#353631',.8);}
    figura(c,[[-17,-145],[-11,-159],[8,-166],[26,-149],[18,-140]],'#3a4a4b','#b5c0a5');figura(c,[[-9,-154],[5,-161],[17,-151],[7,-145]],'#090f17','#a7bbae');
    if(rec){const halo=c.createRadialGradient(4,-158,0,4,-158,72);halo.addColorStop(0,'#f4fff4');halo.addColorStop(.1,'#c7ebdaaa');halo.addColorStop(.32,'#739cb95c');halo.addColorStop(1,'#739cb900');c.fillStyle=halo;c.fillRect(-68,-230,144,144);c.strokeStyle='#e6faee';c.lineWidth=2;c.beginPath();for(let i=0;i<10;i++){const a=i*TAU/10,r=i%2?12:32;i?c.lineTo(4+Math.cos(a)*r,-158+Math.sin(a)*r):c.moveTo(4+Math.cos(a)*r,-158+Math.sin(a)*r);}c.closePath();c.fillStyle='#fff5c4';c.fill();c.stroke();for(let i=0;i<5;i++){const a=t*19+i*1.7,r=34+i*5;c.fillStyle=i%2?'#eda774':'#f5e0a2';c.fillRect(4+Math.cos(a)*r,-158+Math.sin(a)*r,3,3);}}
    c.restore();
  }
  function pintarEscena(s,c){
    const mat=crearMateriales(),w=s.ancho,h=s.alto,a=preparar(s,w,h),p=s.modelo.jugador,t=s.modelo.t,esc=w/a.w,cos=Math.cos(p.a),sin=Math.sin(p.a);
    const horizonte=h*.46+(s.reducido?0:Math.sin(t*8)*s.andando*1.6),focal=Math.max(w/1.4,h*.62),plano=w/(2*focal),hr=horizonte/esc,fr=focal/esc;
    superficies(s,a,mat,hr,fr,plano);c.imageSmoothingEnabled=false;c.drawImage(a.fondo,0,0,w,h);
    for(let i=0;i<a.w;i++){
      const cam=(2*(i+.5)/a.w-1)*plano,dx=cos-sin*cam,dy=sin+cos*cam,r=M.raycast(s.modelo,p.x,p.y,dx,dy),d=Math.max(.07,r.d);a.z[i]=d;
      const alto=3.2*focal/d,top=horizonte-2.05*focal/d,tex=r.lado?r.x:r.y,u=tex-Math.floor(tex),x=i*esc;
      c.drawImage(mat.pared,Math.min(255,Math.floor(u*256)),0,1,256,x,top,esc+.5,alto);
      c.fillStyle=`rgba(1,7,15,${Math.min(.88,.16+d*.049+(r.lado?.12:0))})`;c.fillRect(x,top,esc+.5,alto);
      const base=top+alto;c.fillStyle='#030911b0';c.fillRect(x,base-alto*.025,esc+.5,alto*.025);
      if(s.modelo.fogonazo>0&&d<5){c.fillStyle=`rgba(158,207,214,${.10/(1+d)})`;c.fillRect(x,top,esc+.5,alto);}
    }
    ambiente(s,c,a,focal,horizonte,esc);
    const sprites=crearAtlas(),activos=s.modelo.enemigos.map(e=>({e,caido:false})),caidos=(s.modelo.caidos||[]).map(e=>({e,caido:true}));
    const orden=activos.concat(caidos).map(o=>{const dx=o.e.x-p.x,dy=o.e.y-p.y;return{...o,z:dx*cos+dy*sin,lado:-dx*sin+dy*cos};}).filter(o=>o.z>.12).sort((aa,bb)=>bb.z-aa.z);
    for(const o of orden){
      const e=o.e,alto=1.94*focal/o.z,ancho=alto*2/3,cx=w/2+o.lado*focal/o.z,pie=horizonte+1.15*focal/o.z,top=pie-alto;
      const edad=lim(Number(e.edad)||0,0,.6),herida=e.dolor>0,flash=herida&&e.dolor>.16;
      const cuadro=o.caido?sprites.muertes[Math.min(5,Math.floor(edad*10))]:flash?sprites.blanco:herida?sprites.heridas[Math.floor(Math.max(0,.22-e.dolor)*18)%2]:sprites.pasos[s.reducido?0:Math.floor(t*9+(e.fase||0))%6];
      limitarProfundidad(c,a,cx,ancho*1.3,o.z,esc,h,()=>{
        c.globalAlpha=o.caido?Math.min(1,(.6-edad)*8):e.aparece>0?Math.max(.1,1-e.aparece/.65):1;
        c.fillStyle='#04050cb0';c.beginPath();c.ellipse(cx,pie-1,ancho*.33,Math.max(1,ancho*.075),0,0,TAU);c.fill();
        const retroceso=herida&&!s.reducido?Math.sin(Math.max(0,.22-e.dolor)*42)*ancho*.035:0;
        c.drawImage(cuadro,Math.round(cx-ancho/2+retroceso),Math.round(top),Math.round(ancho),Math.round(alto));
        if(herida||o.caido&&edad<.32){const f=o.caido?edad:Math.max(0,.22-e.dolor),num=o.caido?15:9;for(let i=0;i<num;i++){const ang=i*2.399+(e.id||0),r=ancho*(.1+f*2.1),px=cx+Math.cos(ang)*r,py=top+alto*.43+Math.sin(ang)*r+f*f*alto;c.fillStyle=i%3?'#f8bc87':'#ec534f';const tam=Math.max(1,Math.round(ancho*.022*(1-f)));c.fillRect(Math.round(px),Math.round(py),tam,tam);}}
      });
    }
    for(const q of s.modelo.particulas){const dx=q.x-p.x,dy=q.y-p.y,z=dx*cos+dy*sin;if(z<=.3)continue;const cx=w/2+(-dx*sin+dy*cos)*focal/z,y=horizonte+.5*focal/z,col=Math.floor(cx/esc);if(col<0||col>=a.w||z>a.z[col])continue;c.globalAlpha=Math.min(1,q.t*3);c.fillStyle=q.color||'#eec7a0';c.fillRect(Math.round(cx),Math.round(y),2,2);}c.globalAlpha=1;
    impactoDisparo(s,c,a,horizonte,focal,esc);
    arma(s,c);
    reticula(s,c,w*.5,horizonte);
    let amenaza=null,distancia=4.5;for(const e of s.modelo.enemigos){const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.aparece<=0&&d<distancia){distancia=d;amenaza=e;}}
    if(amenaza){const ang=Math.atan2(amenaza.y-p.y,amenaza.x-p.x)-p.a,rel=Math.atan2(Math.sin(ang),Math.cos(ang));if(Math.abs(rel)>.67){const x=rel<0?15:w-15,dir=rel<0?-1:1;c.fillStyle='#c28e87';figura(c,[[x+dir*5,h*.54],[x-dir*3,h*.54-10],[x-dir*3,h*.54+10]],'#c28e87');}}
  }
  function minimapa(s,c){
    const w=s.ancho,p=s.modelo.jugador,cos=Math.cos(p.a),sin=Math.sin(p.a);
    // La planta conserva orientación y amenazas; su marco ocupa el mismo rincón.
    const mm=Math.min(74,w*.19),ox=12,oy=12,cel=mm/16;c.fillStyle='#050b12cc';c.fillRect(ox-4,oy-4,mm+8,mm+8);c.strokeStyle='#c1ae7c55';c.lineWidth=.7;c.strokeRect(ox-4,oy-4,mm+8,mm+8);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(s.modelo.mapa[y][x]==='1'){c.fillStyle='#66756d';c.fillRect(ox+x*cel,oy+y*cel,Math.max(.5,cel-.5),Math.max(.5,cel-.5));}
    for(const e of s.modelo.enemigos){c.fillStyle='#bb6e78';c.fillRect(ox+e.x*cel-1,oy+e.y*cel-1,2,2);}c.fillStyle='#e3dab3';c.beginPath();c.arc(ox+p.x*cel,oy+p.y*cel,2,0,TAU);c.fill();linea(c,ox+p.x*cel,oy+p.y*cel,ox+(p.x+cos*1.6)*cel,oy+(p.y+sin*1.6)*cel,'#e3dab3',1);
  }
  function impactoDisparo(s,c,a,horizonte,focal,esc){
    const m=s.modelo,q=m.ultimoDisparo;if(!q)return;
    const p=m.jugador,dx=q.x-p.x,dy=q.y-p.y,z=dx*Math.cos(p.a)+dy*Math.sin(p.a);if(z<.1)return;
    const x=s.ancho/2+(-dx*Math.sin(p.a)+dy*Math.cos(p.a))*focal/z,y=horizonte,col=Math.floor(x/esc);if(col<0||col>=a.w||z>a.z[col]+.3)return;
    // Un fallo deja una chispa fría sobre la superficie. Nunca imita el marcador de acierto.
    if(!q.acerto&&m.fallo>0){const f=1-m.fallo/.14;c.globalAlpha=1-f;for(let i=0;i<5;i++){const ang=i*TAU/5;c.fillStyle=i%2?'#899790':'#d9d0a5';c.fillRect(Math.round(x+Math.cos(ang)*f*9),Math.round(y+Math.sin(ang)*f*7),1,1);}c.globalAlpha=1;}
    if(m.fogonazo>0){c.globalAlpha=.26;c.strokeStyle=q.acerto?'#f9d497':'#9fb9b3';c.lineWidth=1;c.beginPath();c.moveTo(s.ancho*.56,s.alto*.8);c.lineTo(x,y);c.stroke();c.globalAlpha=1;}
  }
  function reticula(s,c,x,y){
    const m=s.modelo,letal=m.baja>0,hit=m.acierto>0||letal,rec=(m.fogonazo||0)/.075,abre=rec*2,col=letal?'#f4d394':hit?'#ff7962':'#b9cdc3';
    c.lineWidth=1;
    if(hit){for(const dx of [-1,1])for(const dy of [-1,1])linea(c,x+dx*3,y+dy*3,x+dx*(8+abre),y+dy*(8+abre),col,letal?2:1);}
    else{for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])linea(c,x+dx*(5+abre),y+dy*(5+abre),x+dx*(8+abre),y+dy*(8+abre),col,1);}
    c.fillStyle=hit?'#fff1bd':'#dfebd4';c.fillRect(Math.round(x),Math.round(y),1,1);
  }
  function pintar(s,c){
    // Toda la escena comparte la misma cuadrícula. Escalar sólo el sprite hacía
    // parecer borrosa la criatura sobre un escenario con otra resolución.
    const w=s.ancho,h=s.alto,factor=Math.min(1,384/w,224/Math.min(w,h),Math.sqrt(95000/(w*h))),ww=Math.max(2,Math.round(w*factor)),hh=Math.max(2,Math.round(h*factor));
    let a=s.fpsRetro;if(!a){const n=canvas(ww,hh);a=s.fpsRetro={lienzo:n,c:n.getContext('2d',{alpha:false}),escena:{}};}
    if(a.lienzo.width!==ww||a.lienzo.height!==hh){a.lienzo.width=ww;a.lienzo.height=hh;}
    const escena=a.escena;escena.ancho=ww;escena.alto=hh;escena.modelo=s.modelo;escena.reducido=s.reducido;escena.andando=s.andando||0;
    a.c.save();a.c.imageSmoothingEnabled=false;pintarEscena(escena,a.c);a.c.restore();
    c.save();c.imageSmoothingEnabled=false;c.drawImage(a.lienzo,0,0,w,h);minimapa(s,c);
    // Confirmación de lectura rápida, sin esconder al enemigo detrás de una tarjeta.
    const m=s.modelo,letal=m.baja>0,acierto=m.acierto>0;if(letal||acierto){const vida=letal?m.baja/.5:m.acierto/.2,cx=w*.5,cy=h*.46+Math.min(42,w*.095),tam=Math.max(11,Math.min(17,w*.032));c.globalAlpha=Math.min(1,vida*3);c.textAlign='center';c.textBaseline='middle';c.font='bold '+tam+'px ui-monospace,monospace';c.lineWidth=3;c.strokeStyle='#070913';c.strokeText(letal?'ELIMINADO':'IMPACTO',cx,cy);c.fillStyle=letal?'#f5d797':'#ffab8c';c.fillText(letal?'ELIMINADO':'IMPACTO',cx,cy);}
    c.restore();
  }
  API.pintores=API.pintores||{};API.pintores.fps=pintar;
})(typeof window!=='undefined'?window:globalThis);

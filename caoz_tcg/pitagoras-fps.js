/* El archivo del Editor. Presentación por raycasting; no cambia el mundo,
   las colisiones, los disparos ni el reloj del modelo de las pruebas. */
'use strict';
(function(global){
  if(typeof document==='undefined'||!global.PITAGORAS_PRUEBAS)return;
  const API=global.PITAGORAS_PRUEBAS,M=API.modelo,TAU=Math.PI*2,lim=(n,a,b)=>Math.max(a,Math.min(b,n));
  const enemigo=new Image();enemigo.src=new URL('art/esbirro-editor-v219.webp',document.currentScript.src).href;
  let materiales=null;
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
    const sustituto=canvas(192,280),u=sustituto.getContext('2d');u.strokeStyle='#5f324b';u.lineWidth=8;u.lineCap='round';for(const lado of [-1,1])for(let i=0;i<3;i++){u.beginPath();u.moveTo(96+lado*17,105+i*23);u.bezierCurveTo(96+lado*(45+i*5),80+i*30,96+lado*(56+i*5),155+i*15,96+lado*(75-i*4),232+i*7);u.stroke();}g=u.createLinearGradient(70,70,116,260);g.addColorStop(0,'#9b7d84');g.addColorStop(.32,'#392438');g.addColorStop(1,'#100e1b');figura(u,[[74,70],[115,67],[133,139],[111,205],[125,267],[103,265],[91,201],[79,269],[58,268],[72,179],[61,121]],g,'#a2767855');u.fillStyle='#d5c3b5';u.beginPath();u.ellipse(96,54,19,29,-.15,0,TAU);u.fill();u.fillStyle='#b2374a';u.fillRect(82,48,10,4);u.fillRect(100,46,11,4);u.fillStyle='#21141f';u.fillRect(91,67,12,9);
    materiales={pared,suelo:s.getImageData(0,0,128,128).data,techo:t.getImageData(0,0,128,128).data,sustituto};return materiales;
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
    c.save();c.translate(w*.59+(s.reducido?0:Math.sin(t*4)*s.andando*2),h+18+bob+rec*8);c.scale(tam/200,tam/200);c.lineWidth=1;
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
    if(rec){const halo=c.createRadialGradient(4,-158,0,4,-158,72);halo.addColorStop(0,'#f4fff4');halo.addColorStop(.1,'#c7ebdaaa');halo.addColorStop(.32,'#739cb95c');halo.addColorStop(1,'#739cb900');c.fillStyle=halo;c.fillRect(-68,-230,144,144);c.strokeStyle='#e6faee';c.lineWidth=2;c.beginPath();for(let i=0;i<10;i++){const a=i*TAU/10,r=i%2?12:32;i?c.lineTo(4+Math.cos(a)*r,-158+Math.sin(a)*r):c.moveTo(4+Math.cos(a)*r,-158+Math.sin(a)*r);}c.closePath();c.stroke();}
    c.restore();
  }
  function pintar(s,c){
    const mat=crearMateriales(),w=s.ancho,h=s.alto,a=preparar(s,w,h),p=s.modelo.jugador,t=s.modelo.t,esc=w/a.w,cos=Math.cos(p.a),sin=Math.sin(p.a);
    const horizonte=h*.46+(s.reducido?0:Math.sin(t*8)*s.andando*1.6),focal=Math.max(w/1.4,h*.62),plano=w/(2*focal),hr=horizonte/esc,fr=focal/esc;
    superficies(s,a,mat,hr,fr,plano);c.imageSmoothingEnabled=true;c.drawImage(a.fondo,0,0,w,h);
    for(let i=0;i<a.w;i++){
      const cam=(2*(i+.5)/a.w-1)*plano,dx=cos-sin*cam,dy=sin+cos*cam,r=M.raycast(s.modelo,p.x,p.y,dx,dy),d=Math.max(.07,r.d);a.z[i]=d;
      const alto=3.2*focal/d,top=horizonte-2.05*focal/d,tex=r.lado?r.x:r.y,u=tex-Math.floor(tex),x=i*esc;
      c.drawImage(mat.pared,Math.min(255,Math.floor(u*256)),0,1,256,x,top,esc+.5,alto);
      c.fillStyle=`rgba(1,7,15,${Math.min(.88,.16+d*.049+(r.lado?.12:0))})`;c.fillRect(x,top,esc+.5,alto);
      const base=top+alto;c.fillStyle='#030911b0';c.fillRect(x,base-alto*.025,esc+.5,alto*.025);
      if(s.modelo.fogonazo>0&&d<5){c.fillStyle=`rgba(158,207,214,${.10/(1+d)})`;c.fillRect(x,top,esc+.5,alto);}
    }
    ambiente(s,c,a,focal,horizonte,esc);
    const orden=s.modelo.enemigos.map(e=>{const dx=e.x-p.x,dy=e.y-p.y;return{e,z:dx*cos+dy*sin,lado:-dx*sin+dy*cos};}).filter(o=>o.z>.12).sort((aa,bb)=>bb.z-aa.z);
    const imagen=enemigo.complete&&enemigo.naturalWidth?enemigo:mat.sustituto;
    for(const o of orden){
      const e=o.e,alto=1.94*focal/o.z,ancho=alto*.68,cx=w/2+o.lado*focal/o.z,pie=horizonte+1.15*focal/o.z,top=pie-alto+(s.reducido?0:Math.sin(e.fase+t*7)*Math.min(3,4/o.z));
      limitarProfundidad(c,a,cx,ancho,o.z,esc,h,()=>{c.globalAlpha=e.aparece>0?Math.max(.1,1-e.aparece/.65):1;
        c.save();c.translate(cx,pie-alto*.027);c.scale(1,.19);const sombra=c.createRadialGradient(0,0,0,0,0,Math.max(1,ancho*.44));sombra.addColorStop(0,'#0104079c');sombra.addColorStop(1,'#01040700');c.fillStyle=sombra;c.fillRect(-ancho*.45,-ancho*.45,ancho*.9,ancho*.9);c.restore();
        c.drawImage(imagen,cx-ancho/2,top,ancho,alto);if(e.dolor>0){c.globalCompositeOperation='screen';c.globalAlpha=.22;c.drawImage(imagen,cx-ancho/2,top,ancho,alto);}});
    }
    for(const q of s.modelo.particulas){const dx=q.x-p.x,dy=q.y-p.y,z=dx*cos+dy*sin;if(z<=.3)continue;const cx=w/2+(-dx*sin+dy*cos)*focal/z,y=horizonte+.5*focal/z,col=Math.floor(cx/esc);if(col<0||col>=a.w||z>a.z[col])continue;c.globalAlpha=Math.min(1,q.t*3);c.fillStyle='#c8dfcf';c.fillRect(cx,y,2,2);}c.globalAlpha=1;
    arma(s,c);
    c.strokeStyle='#d6dfcfbb';c.lineWidth=1;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])linea(c,w*.5+dx*6,horizonte+dy*6,w*.5+dx*11,horizonte+dy*11,'#d6dfcfbb',1);c.fillStyle='#f4f0d3';c.fillRect(w*.5-.75,horizonte-.75,1.5,1.5);
    let amenaza=null,distancia=4.5;for(const e of s.modelo.enemigos){const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.aparece<=0&&d<distancia){distancia=d;amenaza=e;}}
    if(amenaza){const ang=Math.atan2(amenaza.y-p.y,amenaza.x-p.x)-p.a,rel=Math.atan2(Math.sin(ang),Math.cos(ang));if(Math.abs(rel)>.67){const x=rel<0?15:w-15,dir=rel<0?-1:1;c.fillStyle='#c28e87';figura(c,[[x+dir*5,h*.54],[x-dir*3,h*.54-10],[x-dir*3,h*.54+10]],'#c28e87');}}
    // La planta conserva orientación y amenazas; su marco ocupa el mismo rincón.
    const mm=Math.min(74,w*.19),ox=12,oy=12,cel=mm/16;c.fillStyle='#050b12cc';c.fillRect(ox-4,oy-4,mm+8,mm+8);c.strokeStyle='#c1ae7c55';c.lineWidth=.7;c.strokeRect(ox-4,oy-4,mm+8,mm+8);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(s.modelo.mapa[y][x]==='1'){c.fillStyle='#66756d';c.fillRect(ox+x*cel,oy+y*cel,Math.max(.5,cel-.5),Math.max(.5,cel-.5));}
    for(const e of s.modelo.enemigos){c.fillStyle='#bb6e78';c.fillRect(ox+e.x*cel-1,oy+e.y*cel-1,2,2);}c.fillStyle='#e3dab3';c.beginPath();c.arc(ox+p.x*cel,oy+p.y*cel,2,0,TAU);c.fill();linea(c,ox+p.x*cel,oy+p.y*cel,ox+(p.x+cos*1.6)*cel,oy+(p.y+sin*1.6)*cel,'#e3dab3',1);
  }
  API.pintores=API.pintores||{};API.pintores.fps=pintar;
})(typeof window!=='undefined'?window:globalThis);

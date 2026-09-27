/* Fuera de cuadro en 3D: la prueba III (primera persona) dentro de su carta
   dorada, sobre el motor común (pitagoras-mundo-3d.js). El archivo del arte:
   estanterías de libros y pergaminos en los muros, las cuatro columnas de
   lapislázuli con enredaderas de oro, losas verdes y marfil con estrellas
   doradas, bóvedas azules, candelas colgadas y, en la pared del fondo, el
   propio cuadro de la carta. Los monstruos son los espectros rojos con
   máscara de calavera y corona de púas; en primer plano, la mano del jugador
   con su manga azul estrellada dispara la estrella de oro.
   La cámara usa la misma geometría que el raycaster (ojos a 1,15, muros de 3,2
   y la misma focal), así que lo que se ve y a lo que se apunta coinciden con
   el modelo. Se conservan el minimapa, la retícula, «IMPACTO/ELIMINADO» y la
   flecha de amenaza. Sólo presentación: lee s.modelo y nunca lo escribe. */
'use strict';
(function(global){
  const W3=global.CAOZ_MUNDO_3D;if(!W3)return;
  const {lim,TAU}=W3,ALTO=3.2,OJOS=1.15;
  const focal=(w,h)=>Math.max(w/1.4,h*.62);
  const FONDO=`vec3 fondo(vec3 d){
  if(d.y<=.001)return vec3(.02,.03,.04);
  // Bóvedas: nervios de oro sobre plementos de lapislázuli con estrellas.
  vec3 P=uCam+d*((${ALTO.toFixed(1)}-uCam.y)/d.y);vec2 q=P.xz/2.;vec2 f=fract(q)-.5,id=floor(q);
  float nervio=min(min(abs(f.x),abs(f.y)),min(abs(f.x-f.y),abs(f.x+f.y))*.7);
  vec3 c=mix(vec3(.07,.13,.33),vec3(.05,.16,.18),h21(id))*(.55+.45*(1.-length(f)*1.3));
  c=mix(c,vec3(.8,.62,.3)*.7,1.-smoothstep(.015,.04,nervio));
  vec2 e=fract(P.xz*1.7)-.5;c+=vec3(1.,.8,.4)*step(.9,h21(floor(P.xz*1.7)))*(1.-smoothstep(.03,.08,length(e)))*.6;
  return c*.8;
}`;
  const SUELO=`void main(){
  vec2 p=vP.xz;
  // Losas en rombo, verdes y marfil, con estrellas de oro en los cruces.
  vec2 g=vec2(p.x+p.y,p.x-p.y)*.72;vec2 id=floor(g),f=fract(g);float par=mod(id.x+id.y,2.);
  vec3 base=par>.5?vec3(.16,.34,.29):vec3(.82,.79,.66);base*=(.85+.25*fbm(p*2.6+id))*(.92+.16*h21(id));
  float junta=min(min(f.x,1.-f.x),min(f.y,1.-f.y));
  vec2 cr=fract(g+.5)-.5;float ang=atan(cr.y,cr.x);
  float estrella=(1.-smoothstep(.0,.03,length(cr)-.05-.12*pow(abs(cos(ang*2.)),8.)))*step(.5,h21(floor(g+.5)+3.));
  vec3 N=normalize(vec3(fbm(p*6.)-.5,10.,fbm(p*6.+3.)-.5)),V=normalize(uCam-vP);
  vec3 c=base*vec3(.3,.33,.42)+base*vec3(1.,.82,.5)*.25*max(dot(N,normalize(CLAVE)),0.)+base*puntuales(vP,N);
  for(int i=0;i<12;i++){if(float(i)>=uNL)break;vec3 L=uLP[i].xyz-vP;float d=length(L);L/=d;float kk=clamp(1.-d/(uLP[i].w*1.6),0.,1.);c+=uLC[i].rgb*pow(max(dot(N,normalize(L+V)),0.),60.)*kk*.8;}
  c=mix(c,c*.55,1.-smoothstep(0.,.03,junta));
  c=mix(c,vec3(1.,.76,.32)*(.6+puntuales(vP,vec3(0.,1.,0.))*.6),estrella);
  c=mix(c,vec3(.02,.03,.04),smoothstep(6.,13.,length(vP-uCam)));
  gl_FragColor=vec4(c,1.);
}`;
  // La mano del jugador con su manga azul estrellada, pintada una vez (apunta hacia arriba y a la izquierda).
  let mano=null;
  function pintarMano(){
    const c=document.createElement('canvas');c.width=c.height=420;const g=c.getContext('2d'),tinta='#1a0f0a';g.lineJoin='round';g.lineCap='round';g.strokeStyle=tinta;g.lineWidth=5;
    // Manga de lapislázuli con estrellas y puño de oro.
    const azul=g.createLinearGradient(420,420,180,260);azul.addColorStop(0,'#16286b');azul.addColorStop(1,'#2f4fb0');
    g.fillStyle=azul;g.beginPath();g.moveTo(420,250);g.quadraticCurveTo(300,250,215,300);g.lineTo(265,420);g.lineTo(420,420);g.closePath();g.fill();g.stroke();
    g.fillStyle='#e6b54c';for(const [x,y,r] of [[340,330,12],[380,290,8],[300,380,9],[390,380,11],[250,340,6]]){g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,q=i%2?r*.4:r;g.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}g.closePath();g.fill();}
    g.fillStyle='#e0ad3e';g.beginPath();g.moveTo(205,292);g.quadraticCurveTo(222,275,262,262);g.lineTo(280,300);g.quadraticCurveTo(245,310,228,330);g.closePath();g.fill();g.stroke();
    // La mano: palma, pulgar y el índice que señala.
    g.fillStyle='#f0c9a0';g.beginPath();g.moveTo(215,300);g.quadraticCurveTo(170,300,150,262);g.quadraticCurveTo(128,222,110,180);g.quadraticCurveTo(102,160,118,158);g.quadraticCurveTo(132,160,146,196);
    g.quadraticCurveTo(160,190,176,196);g.quadraticCurveTo(200,200,214,222);g.quadraticCurveTo(250,240,262,262);g.closePath();g.fill();g.stroke();
    g.beginPath();g.moveTo(176,198);g.quadraticCurveTo(192,215,184,238);g.moveTo(200,212);g.quadraticCurveTo(212,228,205,248);g.stroke();
    return c;
  }
  function estrella(g,x,y,r,rot=0){g.beginPath();for(let i=0;i<16;i++){const a=rot+i*Math.PI/8,q=i%2?r*.18:(i%4?r*.55:r);g.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}g.closePath();g.fill();}
  const lamparas=[[2.5,2.5],[13.5,2.5],[2.5,13.5],[13.5,13.5]];
  global.CAOZ_CUADRO_3D=W3.registrar('fps',{
    nombre:'Fuera de cuadro',arte:W3.arte('editorcuadro-dorado-v1.webp',document.currentScript),
    apagado:()=>!!global.CAOZ_CUADRO_3D_APAGADA,
    presion:m=>lim(m.t/m.duracion,0,1),fondo:FONDO,
    // El cuadro de la carta, colgado en la pared del fondo del archivo.
    telon:()=>({ancho:2.3,corte:.88,marco:true,centro:[8,1.62,1.012],der:[1,0,0],arr:[0,1,0]}),
    camara:{personalizada(s,w,h){
      const m=s.modelo,p=m.jugador,f=focal(w,h),bamb=s.reducido?0:Math.sin(m.t*8)*(s.andando||0)*.02,caida=-(.04*h)/f;
      const ojo=[p.x,OJOS+bamb,p.y];return {ojo,mira:[ojo[0]+Math.cos(p.a),ojo[1]+caida,ojo[2]+Math.sin(p.a)],fov:2*Math.atan(h/2/f)*180/Math.PI,cerca:.05};}},
    suelo:{tam:17,glsl:SUELO,subir(){}},
    // La luz de la mano (siempre la primera), el fogonazo, el impacto y las cuatro candelas.
    luces(s,t,poner){
      const m=s.modelo,p=m.jugador,q=m.ultimoDisparo;
      poner(p.x+Math.cos(p.a)*.35,1.,p.y+Math.sin(p.a)*.35,5,[1,.8,.45],.75+.08*Math.sin(t*5));
      if(m.fogonazo>0){poner(p.x+Math.cos(p.a)*.5,1.1,p.y+Math.sin(p.a)*.5,7,[1,.88,.6],m.fogonazo/.075*2.2);if(q)poner(q.x,1.,q.y,3,q.acerto?[1,.5,.3]:[.6,.75,.8],m.fogonazo/.075*1.8);}
      for(const [x,z] of lamparas)poner(x,2.5,z,7.5,[1,.72,.4],.62+.06*Math.sin(t*7+x));
    },
    // Estanterías en los muros y columnas de lapislázuli con basa y capitel de oro.
    cajas(s,cara,caja){
      const mapa=s.modelo.mapa,muro=(x,y)=>!mapa[y]||mapa[y][x]!=='0',borde=(x,y)=>x===0||y===0||x===15||y===15;
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(!muro(x,y))continue;const mat=borde(x,y)?2:3,col=mat===2?[.3,.2,.1]:[.12,.2,.5];
        if(!muro(x,y+1))cara([x+1,0,y+1],[x,0,y+1],[x,ALTO,y+1],[x+1,ALTO,y+1],[0,0,1],col,mat);
        if(!muro(x,y-1))cara([x,0,y],[x+1,0,y],[x+1,ALTO,y],[x,ALTO,y],[0,0,-1],col,mat);
        if(!muro(x+1,y))cara([x+1,0,y],[x+1,0,y+1],[x+1,ALTO,y+1],[x+1,ALTO,y],[1,0,0],col,mat);
        if(!muro(x-1,y))cara([x,0,y+1],[x,0,y],[x,ALTO,y],[x,ALTO,y+1],[-1,0,0],col,mat);}
      const oro=[.85,.64,.28];
      for(let y=1;y<15;y++)for(let x=1;x<15;x++)if(muro(x,y)&&!muro(x-1,y)&&!muro(x,y-1)){caja(x+1,.18,y+1,2.24,.36,2.24,0,0,oro);caja(x+1,ALTO-.2,y+1,2.24,.4,2.24,0,0,oro);}
    },
    figuras(h){
      const {m,t,fig,de_pie,p}=h,q=m.ultimoDisparo,dir=[Math.cos(p.a),Math.sin(p.a)];
      for(const u of m.enemigos){const sale=lim(1-u.aparece/.65,0,1);h.fantasma(u,{sale,dolor:u.dolor>.12,rojo:true,w:.82,h:2.05});
        if(u.aparece>0)fig(de_pie,u.x,.25,u.y,.9,.9,[.8,.15,.1,.5*u.aparece/.65],3,u.id%5);}
      // Los caídos se deshacen en jirones rojos y brasas de oro.
      for(const u of m.caidos||[]){const k=lim(u.edad/.6,0,1);h.fantasma(u,{sale:1-k*.8,rojo:true,w:.82,h:2.05,alfa:1-k,dolor:k<.15});
        for(let i=0;i<7;i++){const a=i*2.4+(u.id||0);fig(de_pie,u.x+Math.cos(a)*k*.9,.5+k*1.3+Math.sin(i)*.3,u.y+Math.sin(a)*k*.9,.16,.16,[1,i%2?.5:.8,.3,1-k],2);}
        fig(de_pie,u.x,.5+k*.6,u.y,.5+k*.8,.5+k*.8,[.55,.08,.06,.5*(1-k)],3,u.id||0);}
      // El disparo: un rastro de estrellas de la mano al blanco y el estallido donde da.
      if(q&&m.fogonazo>0){const a=m.fogonazo/.075,x0=p.x+dir[0]*.5,y0=p.y+dir[1]*.5;
        for(let i=1;i<=9;i++){const k=i/9;fig(de_pie,x0+(q.x-x0)*k,.95+(1-k)*.05,y0+(q.y-y0)*k,.14+.1*(1-k),.14+.1*(1-k),[1,.85,.5,a*(.4+.6*k)],2);}
        fig(de_pie,q.x-dir[0]*.2,1.,q.y-dir[1]*.2,q.acerto?1.1:.45,q.acerto?1.1:.45,q.acerto?[1,.75,.4,a]:[.7,.85,.9,a*.7],2);}
      h.chispas();
      // Candelas colgadas y el polvo dorado en su luz.
      for(const [x,z] of lamparas){fig(de_pie,x,2.3,z,.16,.36,[1,1,1,.9],4,x);fig(de_pie,x,2.45,z,.9,.9,[1,.7,.35,.35],2);}
      for(let i=0;i<40;i++){const f=(t*.03+i*.618)%1,x=1.5+((i*7.31)%13),z=1.5+((i*3.77)%13);fig(de_pie,x+Math.sin(t*.3+i)*.3,.3+f*2.6,z,.035,.035,[1,.85,.5,Math.sin(f*Math.PI)*.5],2);}
    },
    // Encima: la mano, la retícula, «IMPACTO/ELIMINADO», la flecha de amenaza y el minimapa.
    superponer(c,s,t){
      const w=s.ancho,h=s.alto,m=s.modelo,p=m.jugador,f=focal(w,h),hy=h*.46;mano||=pintarMano();
      c.save();
      // La mano: se balancea al andar y retrocede al disparar; la estrella nace en la punta del índice.
      const rec=(m.fogonazo||0)/.075,and=s.reducido?0:(s.andando||0),tam=Math.min(h*.5,w*.55);
      const mx=w*.58+Math.sin(m.t*4)*and*tam*.03,my=h-tam*.9+Math.abs(Math.cos(m.t*4))*and*tam*.03+rec*tam*.05;
      c.drawImage(mano,mx,my,tam,tam);
      const px=mx+tam*.27,py=my+tam*.37;
      c.globalCompositeOperation='lighter';const g=c.createRadialGradient(px,py,0,px,py,tam*.3);g.addColorStop(0,`rgba(255,240,200,${.35+rec*.6})`);g.addColorStop(1,'rgba(255,190,90,0)');c.fillStyle=g;c.fillRect(px-tam*.3,py-tam*.3,tam*.6,tam*.6);
      c.fillStyle=`rgba(255,226,150,${.55+rec*.45})`;estrella(c,px,py,tam*(.05+rec*.14),t*.8);c.globalCompositeOperation='source-over';
      // Retícula (en el horizonte, como el raycaster): cierra en oro al acertar.
      const letal=m.baja>0,hit=m.acierto>0||letal,abre=rec*3,col=letal?'#f4d394':hit?'#ff7962':'#e8dcb4',cx=w/2;
      c.strokeStyle=col;c.lineWidth=letal?2.4:1.4;c.beginPath();
      if(hit)for(const dx of [-1,1])for(const dy of [-1,1]){c.moveTo(cx+dx*4,hy+dy*4);c.lineTo(cx+dx*(10+abre),hy+dy*(10+abre));}
      else for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){c.moveTo(cx+dx*(6+abre),hy+dy*(6+abre));c.lineTo(cx+dx*(11+abre),hy+dy*(11+abre));}
      c.stroke();c.fillStyle=hit?'#fff1bd':'#f4ecd2';c.fillRect(cx-1,hy-1,2,2);
      if(letal||m.acierto>0){const vida=letal?m.baja/.5:m.acierto/.2,tt=Math.max(12,Math.min(18,w*.033));c.globalAlpha=Math.min(1,vida*3);c.textAlign='center';c.textBaseline='middle';
        c.font='700 '+tt+"px 'Cinzel Domo','Cinzel',Georgia,serif";c.lineWidth=4;c.strokeStyle='#170a08';const txt=letal?'ELIMINADO':'IMPACTO',ty=hy+Math.min(46,w*.1);c.strokeText(txt,cx,ty);c.fillStyle=letal?'#f5d797':'#ffab8c';c.fillText(txt,cx,ty);c.globalAlpha=1;}
      // La flecha de amenaza: un espectro cerca y fuera de la vista.
      let amenaza=null,dist=4.5;for(const e of m.enemigos){const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.aparece<=0&&d<dist){dist=d;amenaza=e;}}
      if(amenaza){const ang=Math.atan2(amenaza.y-p.y,amenaza.x-p.x)-p.a,rel=Math.atan2(Math.sin(ang),Math.cos(ang)),medio=Math.atan(w/2/f);
        if(Math.abs(rel)>medio*.95){const x=rel<0?16:w-16,d=rel<0?-1:1;c.fillStyle='#ff8a70';c.beginPath();c.moveTo(x+d*7,h*.54);c.lineTo(x-d*5,h*.54-13);c.lineTo(x-d*5,h*.54+13);c.closePath();c.fill();}}
      // El minimapa, en un marco de oro.
      const mm=Math.min(78,w*.19),ox=12,oy=12,cel=mm/16;c.fillStyle='#0a0d1cd9';c.fillRect(ox-5,oy-5,mm+10,mm+10);c.strokeStyle='#d8b56699';c.lineWidth=1.2;c.strokeRect(ox-5,oy-5,mm+10,mm+10);
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(m.mapa[y][x]==='1'){c.fillStyle=(x===0||y===0||x===15||y===15)?'#6b4a2a':'#3350a8';c.fillRect(ox+x*cel,oy+y*cel,Math.max(.5,cel-.4),Math.max(.5,cel-.4));}
      for(const e of m.enemigos){c.fillStyle='#e0574a';c.fillRect(ox+e.x*cel-1.5,oy+e.y*cel-1.5,3,3);}
      c.fillStyle='#ffe29a';c.beginPath();c.arc(ox+p.x*cel,oy+p.y*cel,2.2,0,TAU);c.fill();c.strokeStyle='#ffe29a';c.lineWidth=1.2;c.beginPath();c.moveTo(ox+p.x*cel,oy+p.y*cel);c.lineTo(ox+(p.x+Math.cos(p.a)*1.7)*cel,oy+(p.y+Math.sin(p.a)*1.7)*cel);c.stroke();
      c.restore();
    },
  });
})(typeof window!=='undefined'?window:globalThis);

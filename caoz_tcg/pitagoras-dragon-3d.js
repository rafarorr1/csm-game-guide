/* El último asalto en 3D (el guerrero contra el Dragón Celestial Morado de la
   edición dorada), sobre el motor común (pitagoras-mundo-3d.js) y las reglas,
   piezas y poses de pitagoras-dragon.js. Como en Punch-Out, la cámara está
   detrás del guerrero (de espaldas, abajo) y el dragón llena la pantalla:
   alas con estrellas de oro, halo, garras y fauces, montado por partes que
   se mueven según su ataque. La arena es un círculo de piedra con oro; al
   fondo, nubes de manuscrito, el cielo de lapislázuli y, en el horizonte, el
   reino del arte de la carta.
   Sólo presentación: lee s.modelo y nunca lo escribe. */
'use strict';
(function(global){
  const W3=global.CAOZ_MUNDO_3D,DR=global.CAOZ_DRAGON;if(!W3||!DR)return;
  const {lim,TAU}=W3,ZD=-4.6,ZG=1.8;
  // Del espacio del dragón (y del guerrero) al mundo.
  const dragon=(x,y,z)=>[x,y,ZD+z],guerrero=(x,y,z)=>[x,y,ZG+z];
  const FONDO=`vec3 fondo(vec3 d){
  if(d.y<0.)return vec3(.3,.42,.3);
  vec3 c=mix(vec3(.2,.32,.7),vec3(.06,.1,.32),pow(clamp(d.y*1.5,0.,1.),.7));
  vec2 q=vec2(atan(d.x,-d.z),d.y)*12.;vec2 id=floor(q),f=fract(q)-.5;float r=h21(id);vec2 o=(h22(id)-.5)*.5;vec2 e=f-o;
  float est=smoothstep(.1,0.,length(e))+(smoothstep(.02,0.,abs(e.x))*smoothstep(.3,0.,abs(e.y))+smoothstep(.02,0.,abs(e.y))*smoothstep(.3,0.,abs(e.x)))*.9;
  c+=vec3(1.,.8,.4)*step(.83,r)*est*(.7+.3*sin(uT*1.5+r*40.));
  // El banco de nubes de manuscrito sobre el horizonte: cúmulos crema con contorno de oro.
  float a=atan(d.x,-d.z),borde=.05+.07*fbm(vec2(a*3.,1.))+.05*abs(sin(a*9.+fbm(vec2(a*2.,3.))*3.));
  float nube=smoothstep(borde+.005,borde-.005,d.y);vec3 crema=mix(vec3(.96,.9,.74),vec3(.85,.74,.5),smoothstep(borde-.08,borde,d.y));
  c=mix(c,crema,nube);c=mix(c,vec3(.72,.52,.2),(1.-smoothstep(0.,.006,abs(d.y-borde)))*.8);
  return c;
}`;
  const SUELO=`uniform float uFuego;
void main(){
  vec2 p=vP.xz-vec2(0.,${ZD.toFixed(1)}+1.2);float r=length(p),a=atan(p.y,p.x);vec3 c;
  if(r<6.6){
    // La arena: losas en anillos, un anillo de oro y la estrella de ocho puntas en el centro.
    float anillo=floor(r/1.1),lado=floor(a/TAU*(6.+anillo*6.));float id=h21(vec2(anillo,lado));
    vec2 f=vec2(fract(r/1.1),fract(a/TAU*(6.+anillo*6.)));
    c=mix(vec3(.82,.74,.56),vec3(.66,.56,.4),id)*(.85+.25*fbm(p*2.));
    c=mix(c,vec3(.3,.24,.18),(1.-smoothstep(0.,.05,min(f.x,1.-f.x)))*.7+(1.-smoothstep(0.,.03,min(f.y,1.-f.y)*r*.9))*.5);
    float est=r-1.6-.9*pow(abs(cos(a*4.)),6.);c=mix(c,vec3(1.,.78,.35),(1.-smoothstep(0.,.08,abs(est)))*.9+(1.-smoothstep(-.02,.02,est))*.35);
    c=mix(c,vec3(1.,.78,.35),1.-smoothstep(0.,.06,abs(r-6.3)));c=mix(c,vec3(.2,.1,.35),1.-smoothstep(0.,.1,abs(r-6.5)));
  }else{
    // El prado del reino, con flores blancas como en el arte.
    float n=fbm(vP.xz*.12);c=mix(vec3(.17,.38,.2),vec3(.5,.55,.22),smoothstep(.45,.75,n));
    vec2 g=vP.xz*1.4;vec2 id=floor(g),f=fract(g)-.5-(h22(id)-.5)*.6;float flor=step(.8,h21(id))*(1.-smoothstep(.06,.1,length(f)));
    c=mix(c,vec3(.97,.94,.85),flor*smoothstep(-40.,-6.,vP.z));
  }
  vec3 N=vec3(0.,1.,0.);c=c*(vec3(.52,.56,.7)+vec3(1.,.84,.55)*.32)+c*puntuales(vP,N);
  c=mix(c,vec3(.3,.42,.3),smoothstep(-16.,-60.,vP.z));
  gl_FragColor=vec4(c,1.);
}`.replace('TAU','6.2831853').replace(/TAU/g,'6.2831853');
  let ultimaPose=null;
  global.CAOZ_DRAGON_3D=W3.registrar('orbital',{
    nombre:'El último asalto',arte:W3.arte('tok_dragon-dorado-v1.webp',document.currentScript),
    apagado:()=>!!global.CAOZ_DRAGON_3D_APAGADA,atlas:()=>DR.atlas(),
    presion:m=>lim(m.t/m.duracion,0,1),fondo:FONDO,
    // En el horizonte, el reino del arte de la carta (castillos, colinas y flores).
    telon:()=>{const ancho=86,corte=.3,alto=ancho*768/512*corte;return {ancho,corte,desde:.66,centro:[0,alto*.5-2.4,-80]};},
    camara:{personalizada(s,w,h){
      const asp=w/h,fov=Math.max(56,2*Math.atan(.4/asp)*180/Math.PI),m=s.modelo,g=m.impacto>0?m.impacto*.1:0,ancho=lim((1.25-asp)*1.2,0,1.4);
      return {ojo:[Math.sin(m.t*40)*g,2.2,6.4+ancho],mira:[0,4.9+ancho*.4+Math.cos(m.t*47)*g,ZD],fov,cerca:.2,lejos:200};}},
    suelo:{tam:90,glsl:SUELO,subir(gl,u,s){gl.uniform1f(u.uFuego,ultimaPose?.fuego||0);}},
    luces(s,t,poner){
      const m=s.modelo,p=ultimaPose||DR.rig(m,m.t),g=p.guerrero;poner(g.x,2.2,ZG+1.2,4,[1,.86,.62],1);
      const c=dragon(p.cabeza.x,p.cabeza.y,p.cabeza.z);poner(c[0],c[1]+.6,c[2]-1.5,9,[1,.82,.45],.7);
      const brasa=p.efectos.find(e=>e.brasa);if(brasa){const b=dragon(brasa.x,brasa.y,brasa.z+1);poner(b[0],b[1],b[2],7,[1,.45,.12],1.8*brasa.alfa);}
      if(p.fuego>0)for(let i=0;i<3;i++){const k=(i+1)/4,x=c[0]*(1-k),y=c[1]+(2.6-c[1])*k,z=c[2]+(ZG-c[2])*k;poner(x,y,z,6,[1,.5,.15],2.2*p.fuego);}
      for(const x of [-7.4,7.4])poner(x*.9,3,ZD-2.6,5.5,[1,.62,.3],1.2+.1*Math.sin(t*9+x));
    },
    cajas(s,cara,caja){
      // Columnas de piedra con braseros de oro a los lados de la arena.
      const piedra=[1,.95,.82],oscura=[.95,.88,.74],oro=[.9,.68,.3];
      for(const x of [-7.4,7.4]){caja(x,1.3,ZD-4.5,.9,2.6,.9,0,0,piedra,oscura);caja(x,2.7,ZD-4.5,1.2,.2,1.2,0,0,oro);}
    },
    figuras(h){
      const {m,t,fig,de_pie,planas,cam}=h,p=DR.rig(m,m.t);ultimaPose=p;
      const dist=(x,y,z)=>Math.hypot(x-cam.ojo[0],y-cam.ojo[1],z-cam.ojo[2]),base=dist(0,4,ZD);
      // Sombras: la del dragón y la del guerrero.
      fig(planas,0,0,ZD+.4,4.2*(1-p.caida*.2),1.6,[0,0,0,.45],6);fig(planas,p.guerrero.x,0,ZG,1.1,.45,[0,0,0,.55],6);
      // El dragón por partes, de atrás adelante según su profundidad en el rig.
      for(const q of p.piezas){const w=dragon(q.x,q.y,q.z);fig(de_pie,w[0],w[1],w[2],q.w,q.h,q.tinte,18,q.celda,q.giro,1).orden=base-q.z;}
      for(const e of p.efectos){
        if(e.brasa){const w=dragon(e.x,e.y,e.z+.3);fig(de_pie,w[0],w[1],w[2],e.w*1.4,e.w*1.4,[1,.45,.12,.9*e.alfa],15).orden=base-e.z-.4;continue;}
        const w=e.delGuerrero?guerrero(e.x,e.y,e.z):dragon(e.x,e.y,e.z);
        fig(de_pie,w[0],w[1],w[2],e.w,e.h,[0,0,0,e.alfa],18,e.celda,e.giro||0,1).orden=e.delGuerrero?dist(...w)-.1:base-e.z-.5;
      }
      // El fuego: llamas de manuscrito desde las fauces hasta la altura del guerrero de pie.
      if(p.fuego>0){const c=dragon(p.cabeza.x,p.cabeza.y-.5,p.cabeza.z+.8),ola=1-p.fuego;for(let i=0;i<9;i++){const k=lim(i/8*.75+ola*.35,0,1),x=c[0]*(1-k)+Math.sin(t*9+i)*.15,y=c[1]+(3.7-c[1])*k,z=c[2]+(ZG-.4-c[2])*k,tam=.45+k*1.05;
        fig(de_pie,x,y,z,tam*1.4,tam*1.4,[1,.5,.15,.6*p.fuego],15).orden=dist(x,y,z)+.05;fig(de_pie,x,y,z,tam,tam,[0,0,0,p.fuego],18,13,Math.sin(t*20+i)*.3,1).orden=dist(x,y,z);}}
      // El humo del derribo.
      if(p.caida>.6)for(let i=0;i<6;i++){const x=(i-2.5)*1.3,z=ZD+1+Math.sin(i)*.8;fig(de_pie,x,.6,z,1.6,1.6,[.8,.72,.6,.5*(p.caida-.6)/.4],3,i).orden=base+.5;}
      // Las llamas de los braseros.
      for(const x of [-7.4,7.4])fig(de_pie,x,2.8,ZD-4.5,.5,1.1,[1,1,1,1],4,x);
      // Los golpes: chispas de oro en la cabeza.
      if(m.dragon.dolor>0){const c=dragon(p.cabeza.x,p.cabeza.y,p.cabeza.z+1);for(let i=0;i<6;i++){const a=i*TAU/6+t*4;fig(de_pie,c[0]+Math.cos(a)*.9,c[1]+Math.sin(a)*.9,c[2],.5,.5,[1,.85,.5,m.dragon.dolor*4],2).orden=base-2;}}
      // El guerrero, de espaldas y delante de todo.
      const g=p.guerrero,wg=guerrero(g.x,g.y,g.z);fig(de_pie,wg[0],wg[1],wg[2],g.w,g.h,g.tinte,18,g.celda,g.giro,1).orden=dist(...wg);
    },
    superponer(ctx,s){DR.barra(ctx,s.modelo,s.ancho,s.alto);DR.letrero(ctx,s.modelo,s.ancho,s.alto*.34);},
  });
  // Puntos del mundo para la revisión del encuadre: la cima del halo, las puntas de las alas,
  // los pies del dragón y la cabeza y los pies del guerrero.
  global.CAOZ_DRAGON_3D_PUNTOS=Object.freeze({halo:dragon(0,11,-1.6),alaIzq:dragon(-7,9.6,-1.2),alaDer:dragon(7,9.6,-1.2),pies:dragon(0,0,0),guerrero:guerrero(0,2.5,0),guerreroPies:guerrero(0,0,0)});
})(typeof window!=='undefined'?window:globalThis);

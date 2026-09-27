/* Órbita muerta en 3D («Devuelve la luz»), sobre el motor común
   (pitagoras-mundo-3d.js) y las reglas de pitagoras-orbita.js. La pantalla es
   la carta dorada: arriba la estrella muerta con su rostro (roca negra, lava
   en las grietas, ojos que siguen al héroe, la boca que se carga) y su corona
   de fuego; en medio la órbita de oro, inclinada hacia la cámara, con el héroe
   y su burbuja de luz; abajo el reino (campos de oro y verde, el río de oro,
   castillos) y, en el horizonte, el reino del propio arte de la carta. Los
   meteoros son rocas con grietas encendidas que siguen arcos anunciados con
   hilo de oro; lo que cae arde en el reino.
   Sólo presentación: lee s.modelo y nunca lo escribe. */
'use strict';
(function(global){
  const W3=global.CAOZ_MUNDO_3D,O=global.CAOZ_ORBITA;if(!W3||!O)return;
  const {lim,TAU}=W3,{R,RS,INCLINACION,BURBUJA,PERFECTA,sobreReino}=O,MAXF=6;
  const YS=7.6,CI=Math.cos(INCLINACION),SI=Math.sin(INCLINACION);
  // Del plano de la órbita (x, y hacia el reino) al mundo: la mitad baja se acerca a la cámara.
  const plano=(x,y)=>[x,YS-y*CI,y*SI];
  // Donde arde en el reino un meteoro que cae (rx, rz del modelo).
  const tierra=(rx,rz)=>[rx*1.8,0,-11-rz*12];
  const FONDO=`vec3 fondo(vec3 d){
  if(d.y<0.)return mix(vec3(.16,.24,.42),vec3(.1,.16,.36),clamp(-d.y*4.,0.,1.));
  vec3 c=mix(vec3(.16,.25,.58),vec3(.05,.08,.26),pow(clamp(d.y*1.6,0.,1.),.7));
  // Estrellas de oro de ocho puntas, como las de la miniatura.
  vec2 q=vec2(atan(d.x,-d.z),d.y)*13.;vec2 id=floor(q),f=fract(q)-.5;float r=h21(id);vec2 o=(h22(id)-.5)*.5;vec2 e=f-o;
  float est=smoothstep(.1,0.,length(e))+(smoothstep(.02,0.,abs(e.x))*smoothstep(.28,0.,abs(e.y))+smoothstep(.02,0.,abs(e.y))*smoothstep(.28,0.,abs(e.x)))*.9;
  c+=vec3(1.,.8,.4)*step(.84,r)*est*(.6+.4*sin(uT*1.5+r*40.));
  // Motas de pan de oro en la bruma baja.
  c+=vec3(.8,.6,.3)*smoothstep(.2,0.,d.y)*fbm(vec2(atan(d.x,-d.z)*8.,d.y*30.))*.18;
  return c;
}`;
  const SUELO=`uniform vec4 uFuegos[${MAXF}];uniform float uNF;
void main(){
  vec2 p=vP.xz;float n=fbm(p*.1),n2=fbm(p*.45+7.);
  // Campos de verde y oro, bosques oscuros y el río de oro que va hacia el fondo.
  vec3 c=mix(vec3(.14,.34,.2),vec3(.62,.52,.2),smoothstep(.42,.72,n));
  c=mix(c,vec3(.05,.18,.1)*(.7+.5*n2),smoothstep(.56,.63,fbm(p*.3+3.)));
  float surco=abs(fract(p.x*.8+n*3.)-.5);c*=.85+.25*smoothstep(.0,.2,surco);
  float rio=1.-smoothstep(0.,.3,abs(p.x-3.*sin(p.y*.11+1.)-1.)-(.5-p.y*.025));
  c=mix(c,vec3(1.,.78,.36)*(.75+.35*fbm(p*1.5+vec2(0.,uT*.3))),rio);
  vec3 N=vec3(0.,1.,0.);c=c*(vec3(.46,.5,.66)+vec3(1.,.82,.5)*.35)+c*puntuales(vP,N);
  // Los meteoros que cayeron: cráteres negros con brasas.
  for(int i=0;i<${MAXF};i++){if(float(i)>=uNF)break;vec4 f=uFuegos[i];float d=length(p-f.xy),vivo=f.z;
    c=mix(c,vec3(.04,.03,.02),(1.-smoothstep(.7,1.6,d))*.9);c+=vec3(1.,.35,.08)*(1.-smoothstep(.0,1.2,abs(d-.9)))*vivo*(.6+.4*fbm(p*4.+uT*2.));}
  c=mix(c,vec3(.16,.24,.42),smoothstep(-18.,-110.,p.y));
  gl_FragColor=vec4(c,1.);
}`;
  global.CAOZ_ORBITA_PLANO=plano;
  global.CAOZ_ORBITA_3D=W3.registrar('orbital',{
    nombre:'Órbita muerta',arte:W3.arte('editororbita-dorado-v1.webp',document.currentScript),
    apagado:()=>!!global.CAOZ_ORBITA_3D_APAGADA,
    presion:m=>lim(m.t/m.duracion,0,1),fondo:FONDO,
    // En el horizonte, el reino del arte de la carta (su franja baja: colinas, castillos, el mar de oro).
    telon:()=>{const ancho=74,corte=.24,alto=ancho*768/512*corte;return {ancho,corte,desde:.76,centro:[0,alto*.5-3,-125]};},
    camara:{personalizada(s,w,h){
      const asp=w/h,fov=Math.max(52,2*Math.atan(.5/asp)*180/Math.PI),t=Math.tan(fov*Math.PI/360);
      const D=Math.max(4.9/t,4.7/(t*asp)),m=s.modelo,g=m.impacto>0?m.impacto*.12:0,alto=lim(1/asp-1,0,1);
      return {ojo:[Math.sin(m.t*40)*g,5.3,D+1.2],mira:[0,7.1+alto*1.6+Math.cos(m.t*47)*g,0],fov,cerca:.2,lejos:200};}},
    suelo:{tam:150,glsl:SUELO,subir(gl,u,s){
      const m=s.modelo,f=m.fuegos.slice(-MAXF),a=new Float32Array(MAXF*4);
      f.forEach((q,i)=>{const p=tierra(q.x,q.z);a.set([p[0],p[2],lim(1-(m.t-q.t)/7,0,1),0],i*4);});
      gl.uniform4fv(u.uFuegos,a);gl.uniform1f(u.uNF,f.length);}},
    luces(s,t,poner){
      const m=s.modelo,h=plano(m.jugador.x,m.jugador.y);poner(h[0],h[1]+.3,h[2]+.6,3.2,[1,.85,.55],.9+(m.escudo>0?.8:0));
      poner(0,YS,1.6,11,[1,.35,.1],.8+Math.min(m.grietas,12)*.04+m.boca*.6);
      for(const q of m.meteoros.filter(q=>q.estado!=='espera').slice(0,4)){const p=q.estado==='cae'?caida(q):plano(q.x,q.y);poner(p[0],p[1],p[2],2.6,q.estado==='vuelta'?[1,.9,.6]:[1,.45,.15],1);}
      poner(0,9,-4,34,[.95,.85,.65],.85);
      for(const f of m.fuegos.slice(-4)){const p=tierra(f.x,f.z),vivo=lim(1-(m.t-f.t)/7,0,1);if(vivo>0)poner(p[0],1.2,p[2],7,[1,.45,.15],1.6*vivo);}
    },
    cajas(s,cara,caja){
      // Los castillos del reino: torres de marfil con tejados rojos y murallas entre ellas.
      const marfil=[.95,.9,.78],sombra=[.86,.8,.68],rojo=[.72,.16,.08],oro=[.9,.68,.3];
      for(const [x,z,al,an] of [[-9,-13,3.4,1.1],[-7.4,-12,2.3,.9],[-10.8,-15,4.4,1.2],[-6,-16,2.8,.9],[-13,-19,3.6,1.1],[9.5,-14,3.8,1.2],[7.6,-12.5,2.4,.9],[11.4,-17,4.6,1.2],[6.4,-17,2.6,.9],[13.6,-21,3.2,1],[-3,-30,2.4,.8],[2.2,-32,3,.9],[-17,-26,3.4,1],[17,-27,3.2,1]]){
        caja(x,al/2,z,an,al,an,.3*Math.sin(x),0,marfil,sombra);
        for(let k=0;k<3;k++){const f=1-k*.3;caja(x,al+.18+k*.3,z,an*1.25*f,.32,an*1.25*f,.3*Math.sin(x)+k*.4,0,rojo);}
        caja(x,al+1.1,z,.08,.3,.08,0,0,oro);
      }
      for(const [x0,x1,z0,z1] of [[-10.8,-7.4,-15,-12],[-9,-6,-13,-16],[9.5,7.6,-14,-12.5],[11.4,6.4,-17,-17]]){const l=Math.hypot(x1-x0,z1-z0);caja((x0+x1)/2,.7,(z0+z1)/2,l,1.4,.5,-Math.atan2(z1-z0,x1-x0),0,marfil,sombra);}
    },
    figuras(h){
      const {m,t,fig,de_pie,mem}=h,ahora=m.t;
      // La estrella: tiembla al recibir un meteoro devuelto; al final se quiebra.
      if(mem.grietas!==m.grietas){if(m.grietas>(mem.grietas??0))mem.golpe=ahora;mem.grietas=m.grietas;}
      const golpe=Math.exp(-Math.max(0,ahora-(mem.golpe??-9))*7),quiebre=m.vidas>0?lim((ahora-19.25)/.75,0,1):0,temblor=golpe*.08+quiebre*.12;
      const e=plano(Math.sin(t*53)*temblor,Math.cos(t*61)*temblor),th=Math.atan2(m.jugador.y,m.jugador.x);
      fig(de_pie,e[0],e[1],e[2],RS*1.7*(1+golpe*.04),RS*1.7*(1+golpe*.04),[Math.cos(th),-Math.sin(th),golpe,m.boca],12,.37,lim(m.grietas/12,0,1),quiebre);
      if(quiebre>0)for(let i=0;i<22;i++){const a=i*2.39996,v=quiebre*quiebre*(3+(i%5)),p=plano(Math.cos(a)*(RS*.6+v),Math.sin(a)*(RS*.6+v));const z=p[2]+Math.sin(i)*.5,tam=.2+(i%3)*.08;fig(de_pie,p[0],p[1],z-.05,tam*3,tam*3,[1,.62,.25,.8*(1-quiebre*.4)],15);fig(de_pie,p[0],p[1],z,tam,tam,[1,.8,.4,1],13,i*.13,1);}
      // La órbita de oro: la mitad baja, sobre el reino, más cálida; marcas de astrolabio cada 15°.
      const hx=Math.atan2(m.jugador.y,m.jugador.x);
      for(let i=0;i<150;i++){const a=i*TAU/150,p=plano(Math.cos(a)*R,Math.sin(a)*R),cerca=Math.exp(-Math.pow(Math.atan2(Math.sin(a-hx),Math.cos(a-hx))*3,2)),baja=sobreReino(a);
        fig(de_pie,p[0],p[1],p[2],.13+cerca*.08,.13+cerca*.08,baja?[1,.62,.3,.75+cerca*.25]:[1,.82,.42,.62+cerca*.3],15);}
      for(let i=0;i<24;i++){const a=i*TAU/24,p=plano(Math.cos(a)*(R+.16),Math.sin(a)*(R+.16));fig(de_pie,p[0],p[1],p[2],.1,.1,[1,.85,.5,.9],15);}
      // Meteoros: el arco anunciado (hilo de oro), la marca de cruce, la roca y su estela.
      for(const q of m.meteoros){
        if(q.estado==='vuela'||q.estado==='espera'){
          const u0=Math.max(0,(ahora-q.t0)/(q.tc-q.t0)),k=lim((ahora-q.t0+.6)/(q.tc-q.t0+.6),0,1),reino=sobreReino(q.fi);
          for(let i=0;i<18;i++){const u=u0+(1-u0)*i/17,a=q.fi+q.curva*(1-u),r=q.origen+(R-q.origen)*u,p=plano(Math.cos(a)*r,Math.sin(a)*r);fig(de_pie,p[0],p[1],p[2],.07,.07,[1,.85,.45,.2+.45*k],15);}
          const mk=plano(Math.cos(q.fi)*R,Math.sin(q.fi)*R);fig(de_pie,mk[0],mk[1],mk[2]+.02,.62,.62,reino?[1,.5,.2,.5+.5*k]:[1,.85,.45,.45+.5*k],16,0,k);
        }
        if(q.estado==='espera')continue;
        const p=q.estado==='cae'?caida(q):plano(q.x,q.y),vuelta=q.estado==='vuelta',col=vuelta?[1,.92,.6]:[1,.45,.12],alfa=q.estado==='fuga'?lim(1-(ahora-q.desde)/.9,0,1):1;
        // La estela: puntos de fuego hacia atrás en su propio camino.
        for(let i=1;i<=10;i++){const pp=atras(q,ahora,i*.028);if(!pp)break;const f=1-i/11;fig(de_pie,pp[0],pp[1],pp[2],.42*f+.08,.42*f+.08,vuelta?[1,.85,.5,.6*f*alfa]:[1,.3+.3*f,.08,.7*f*alfa],15);}
        fig(de_pie,p[0],p[1],p[2],.52,.52,[...col,alfa],13,(q.id*.29)%1,vuelta?1:.5);
      }
      // El héroe en su órbita, mirando hacia donde avanza, con la estrella de la varita.
      const hp=plano(m.jugador.x,m.jugador.y),vx=-Math.sin(hx)*(m.ultimoMovimiento.x||1);if(Math.abs(vx)>.05)mem.lado=Math.sign(vx);const lado=mem.lado||1;
      h.heroe({flotar:true,mira:false,x:hp[0],y:hp[1]-.95,z:hp[2]+.05,lado,punta:[hp[0]+lado*.62,hp[1]+.7,hp[2]+.1]});
      // La burbuja: brilla fuerte en la ventana justa (el instante de devolver) y se apaga después.
      if(m.escudo>0){const edad=BURBUJA-m.escudo,justa=edad<=PERFECTA?1:0;fig(de_pie,hp[0],hp[1],hp[2]+.3,1.05,1.05,justa?[1,.95,.72,1]:[1,.78,.5,.45+.4*m.escudo/BURBUJA],14,0,0,justa*(1-edad/PERFECTA)*.6);}
      else if(m.recargaImpulso<=0)fig(de_pie,hp[0],hp[1],hp[2]+.3,1.05,1.05,[1,.9,.65,.22],14);
      // Chispas del modelo (en el plano de la órbita).
      for(const q of m.particulas){const p=plano(q.x,q.y),c=W3.hexa(q.color);fig(de_pie,p[0],p[1],p[2]+.2,.14,.14,[c[0],c[1],c[2],lim(q.t*3,0,1)],2);}
      // El reino arde donde cayeron: llamas, humo y brasas.
      for(const f of m.fuegos){const p=tierra(f.x,f.z),vivo=lim(1-(ahora-f.t)/7,0,1),nace=lim((ahora-f.t)/.25,0,1);if(!vivo)continue;
        fig(de_pie,p[0],p[1]+2.2*nace,p[2],1.5*nace,1.5*nace,[.25,.2,.2,.55*vivo],3,f.id);
        for(let i=0;i<3;i++)fig(de_pie,p[0]+(i-1)*.45,0,p[2]+(i%2)*.3,.55,1.5*vivo*nace*(1-.2*i),[1,1,1,vivo],4,f.id+i);
        fig(de_pie,p[0],.6,p[2],2.2*nace,2.2*nace,[1,.5,.2,.35*vivo],15);}
    },
    superponer(ctx,s,t,pantalla){
      const m=s.modelo,w=s.ancho,h=s.alto;
      if(m.juicio>0&&pantalla){const p=plano(m.juicioX,m.juicioY),q=pantalla(p[0],p[1]+1.4,p[2]);if(q){const a=lim(m.juicio*2,0,1),tam=Math.max(13,Math.min(24,w*.035));
        ctx.save();ctx.globalAlpha=a;ctx.font=`700 ${tam}px Georgia,serif`;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#1a0f0a';ctx.strokeText(m.juicioTexto,q.x,q.y-(1-a)*10);ctx.fillStyle=m.juicioTexto==='BLOQUEADA'?'#ffc890':'#fff1c0';ctx.fillText(m.juicioTexto,q.x,q.y-(1-a)*10);ctx.restore();}}
      O.dibujarReino(ctx,m,w,h);
    },
  });
  // Un meteoro que cae: de su cruce con la órbita al punto del reino, acelerando.
  function caida(q){const a=plano(q.x,q.y),b=tierra(q.rx,q.rz),k=q.caida*q.caida;return [a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];}
  // Dónde estaba un meteoro dt segundos antes (para la estela), según su estado.
  function atras(q,ahora,dt){
    const t=ahora-dt;
    if(q.estado==='vuela'||q.estado==='fuga'){if(t<q.t0)return null;const a=O.arco(q,t);return plano(a.x,a.y);}
    if(q.estado==='vuelta'){const k=(t-q.desde)/.32;if(k<0)return null;const r=R+(RS*.7-R)*k;return plano(Math.cos(q.fi)*r,Math.sin(q.fi)*r);}
    if(q.estado==='cae'){const k=(t-q.desde)/.7;if(k<0)return null;return caida({...q,caida:k});}
    return null;
  }
})(typeof window!=='undefined'?window:globalThis);

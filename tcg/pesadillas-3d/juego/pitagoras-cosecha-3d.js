/* La cosecha en 3D: el pintor de la prueba I dentro de su carta dorada, sobre
   el motor común (pitagoras-mundo-3d.js).
   Una cámara isométrica en perspectiva mira la arena de losas verdes (el
   suelo de la ilustración dorada), con grietas de lava, la orla y las runas
   de oro; detrás, el propio arte de la carta (el Segador, el halo y las
   torres del Domo) se alza del abismo y se acerca con la presión de la
   cosecha. Las criaturas son los fantasmas de humo del arte; el héroe lleva
   su halo de oro y dispara estrellas que iluminan lo que tocan.
   Sólo presentación: lee s.modelo y nunca lo escribe. */
'use strict';
(function(global){
  const W3=global.CAOZ_MUNDO_3D;if(!W3)return;
  const {lim,TAU}=W3,ARENA=6.55,MAXLOSAS=10,MAXMARCAS=6;
  const FONDO=`vec3 fondo(vec3 d){
  vec3 c;
  if(d.y<-.02){
    float k=(uCam.y+6.)/(-d.y);vec3 P=uCam+d*k;vec2 q=P.xz;
    // Lava en el fondo del abismo, con humo azul que se enrosca por encima.
    float v=fbm(q*.35+vec2(uT*.03,0.)),vena=pow(1.-abs(fbm(q*.6-uT*.02)*2.-1.),6.);
    c=mix(vec3(.05,.012,.012),vec3(.55,.08,.03),smoothstep(.35,.8,v))+vec3(1.,.35,.08)*vena*(.55+.35*uPresion);
    float humo=fbm(q*.22+vec2(sin(uT*.05),uT*.04)+fbm(q*.4)*1.5);
    c=mix(c,vec3(.2,.24,.34),smoothstep(.45,.8,humo)*.65);
    c=mix(c,vec3(.08,.09,.15),clamp(k/70.,0.,.7));
  }else{
    // Cielo de lapislázuli con estrellas de oro.
    c=mix(vec3(.08,.12,.32),vec3(.03,.05,.16),clamp(d.y*2.,0.,1.));
    vec2 q=vec2(atan(d.x,-d.z),d.y)*18.;vec2 id=floor(q),f=fract(q)-.5;float r=h21(id);
    vec2 o=(h22(id)-.5)*.5;float e=length(f-o);float estrella=step(.86,r)*(smoothstep(.12,0.,e)+smoothstep(.02,0.,abs((f-o).x))*smoothstep(.3,0.,abs((f-o).y))+smoothstep(.02,0.,abs((f-o).y))*smoothstep(.3,0.,abs((f-o).x)));
    c+=vec3(1.,.82,.4)*estrella*.9;
  }
  return c;
}`;
  // El suelo: losas de la ilustración, grietas con lava, orla y runas de oro,
  // losas que se agrietan y huecos, y las marcas rojas del Editor.
  const SUELO=`uniform vec4 uLosa[${MAXLOSAS}];uniform float uNLosas;uniform vec4 uMarca[${MAXMARCAS}];uniform float uNMarcas;
const float ARENA=${ARENA.toFixed(2)};
void losas(vec2 p,out vec2 centro,out float borde,out float id){
  vec2 g=floor(p/1.35),f=p/1.35-g;float d1=9.,d2=9.;vec2 c1=vec2(0.);
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 c=o+.3+.4*h22(g+o);float d=length(f-c);
    if(d<d1){d2=d1;d1=d;c1=g+c;}else if(d<d2)d2=d;}
  centro=c1*1.35;borde=(d2-d1)*1.35;id=h21(floor(c1*7.));
}
void main(){
  vec2 p=vP.xz;float ax=max(abs(p.x),abs(p.y));
  // Fuera de la orla, el suelo se rompe hasta caer al abismo.
  float lejos=ax-ARENA;if(lejos>2.3+fbm(p*.7)*1.6-.6)discard;
  vec2 cen;float borde,id;losas(p,cen,borde,id);
  float hueco=0.,aviso=0.;
  for(int i=0;i<${MAXLOSAS};i++){if(float(i)>=uNLosas)break;vec4 l=uLosa[i];vec2 q=abs(p-l.xy);float dentro=step(max(q.x,q.y),1.);
    if(l.z>.5&&dentro>0.)discard;
    float filo=1.-smoothstep(0.,.07,abs(max(q.x,q.y)-1.));aviso=max(aviso,(dentro*.35+filo)*l.w*(1.-l.z));
    hueco=max(hueco,l.z*(1.-smoothstep(1.,1.6,max(q.x,q.y))));}
  // Color de la losa: verde salvia con pinceladas, como el arte dorado.
  vec3 base=mix(vec3(.4,.49,.37),vec3(.6,.66,.5),id);
  float pincel=fbm(vec2(p.x*2.+p.y*.6,p.y*9.)*.8+id*9.);base*=.82+.3*pincel;base=mix(base,vec3(.36,.44,.52),fbm(p*1.7+id*5.)*.3);
  base=mix(base,vec3(.42,.36,.25),fbm(p*.5)*.25);
  float ruina=smoothstep(0.,1.5,lejos);base*=1.-.45*ruina;
  vec2 hacia=(p-cen);vec3 N=normalize(vec3(hacia.x*.35*smoothstep(.12,0.,borde),1.,hacia.y*.35*smoothstep(.12,0.,borde))+vec3(fbm(p*6.)-.5,0.,fbm(p*6.+3.)-.5)*.25);
  // Iluminación: cielo de lapislázuli, el oro del halo desde el fondo y las luces de la escena.
  vec3 c=base*(vec3(.42,.46,.6)*(.6+.4*N.y));
  c*=.78+.4*smoothstep(0.,.4,borde);
  c+=base*vec3(1.,.82,.5)*.55*max(dot(N,normalize(vec3(-.45,.8,-.68))),0.);
  c+=base*puntuales(vP,N);
  // Tinta entre losas y lava en las grietas (más con la presión y cerca de los huecos).
  float tinta=1.-smoothstep(.025,.06,borde);c=mix(c,vec3(.07,.06,.05),tinta*.95);
  float lava=smoothstep(.66,.74,fbm(p*.3+3.1))+smoothstep(.62,.7,fbm(p*.33+9.4))*uPresion+ruina+hueco*1.5;
  float grieta=(1.-smoothstep(0.,.075,borde))*clamp(lava,0.,1.);
  c+=vec3(1.,.28,.06)*grieta*(1.1+.4*sin(uT*3.+p.x*1.7+p.y));
  c+=vec3(.6,.1,.03)*(1.-smoothstep(0.,.25,borde))*clamp(lava-.5,0.,1.)*.4;
  // Orla de oro en el borde de la arena y dos anillos de runas.
  float orla=1.-smoothstep(0.,.05,abs(ax-(ARENA+.18)));
  float runa=0.;for(int k=0;k<2;k++){float R=k==0?3.1:5.4;float dr=abs(length(p)-R);float ang=atan(p.y,p.x)*(k==0?12.:20.);
    runa+=(1.-smoothstep(.015,.04,dr))+(1.-smoothstep(.0,.03,abs(dr-.18)))*.5+step(.8,fract(ang/6.283*6.))*(1.-smoothstep(0.,.1,abs(dr-.09)))*step(.5,fract(ang))*.5;}
  vec3 oro=vec3(1.,.78,.36);c=mix(c,oro*(.55+.45*max(dot(N,normalize(vec3(.2,.9,-.4))),0.))+oro*puntuales(vP,vec3(0.,1.,0.))*.4,clamp(orla+runa*.55,0.,1.)*(1.-ruina));
  // Losas que se agrietan: borde rojo que late y grietas por dentro.
  c+=vec3(1.,.25,.05)*aviso*(.8+.6*sin(uT*18.))*(.6+.4*(1.-smoothstep(0.,.05,borde)));
  c=mix(c,vec3(.03,.01,.01),hueco*.55);c+=vec3(.9,.2,.05)*hueco*.35;
  // Marcas del Editor: sello que late, estallido, anillo de fuego y ceniza.
  for(int i=0;i<${MAXMARCAS};i++){if(float(i)>=uNMarcas)break;vec4 m=uMarca[i];float e=m.z,R=m.w;float d=length(p-m.xy);
    if(e<1.1){float pr=clamp(e/1.1,0.,1.),pul=(1.+sin(6.2832*(2.*e+10.*e*e*e/(3.*1.21))))*.5;
      float anillo=1.-smoothstep(.02,.07,abs(d-R));float interior=step(d,R)*(.25+.75*step(.8,fract(atan(p.y-m.y,p.x-m.x)*1.2733+uT*.3)))*(1.-smoothstep(.02,.06,abs(d-R*.6)));
      c+=vec3(1.,.12,.08)*(anillo+interior*.7+step(d,R)*.12)*(.35+.65*pul)*(.4+.6*pr);}
    else if(e<1.36){float k=(e-1.1)/.26;c+=vec3(1.,.6,.25)*(1.-smoothstep(R*.6,R*(1.+k*.4),d))*(1.-k)*.9;}
    else if(e<3.06){float k=(e-1.36)/1.7;c+=vec3(1.,.42,.08)*(1.-smoothstep(.0,.2,abs(d-R)))*(1.-k*.5)*(1.1+.5*fbm(vec2(atan(p.y-m.y,p.x-m.x)*4.,uT*4.)));
      c=mix(c,vec3(.05,.03,.02),step(d,R-.2)*.5);}
    else{float k=clamp((e-3.06)/.65,0.,1.);c=mix(c,vec3(.04,.03,.03),(1.-smoothstep(R-.1,R+.2,d))*(1.-k)*.7);}
  }
  // Niebla hacia el borde roto y bruma azul del humo.
  float bruma=clamp(lejos/3.,0.,1.);c=mix(c,vec3(.12,.14,.22),bruma*.6);
  gl_FragColor=vec4(c,1.);
}`;
  global.CAOZ_COSECHA_3D=W3.registrar('isometrico',{
    nombre:'La cosecha',arte:W3.arte('editorcosecha-dorado-v1.webp',document.currentScript),
    apagado:()=>!!global.CAOZ_COSECHA_3D_APAGADA,
    presion:m=>m.presionCosecha||0,fondo:FONDO,
    // El Segador se alza del abismo tras la arena y se acerca con la presión.
    telon:presion=>{const ancho=21,corte=.62,alto=ancho*768/512*corte;return {ancho,corte,centro:[0,alto*.5-12.5+presion*2.2,-ARENA-4.5]};},
    camara:{fov:36,pitch:41,
      // En pantallas anchas la cámara mira algo más al fondo: deja ver al Segador sobre la arena.
      objetivo:(p,asp)=>{const ancha=lim((asp-.9)/.8,0,1);return [p.x*.36,0,p.y*(p.y>0?.52:.36)-.4-1.5*ancha];},
      distancia:(tan,asp,pitch,s)=>Math.max(6.3/(tan*asp),6.4*Math.sin(pitch)/tan+4.5)*(1-.05*(s.modelo.presionCosecha||0))},
    suelo:{tam:ARENA+4.5,glsl:SUELO,subir(gl,u,s){
      const m=s.modelo,losas=new Float32Array(MAXLOSAS*4);m.losas.slice(0,MAXLOSAS).forEach((l,i)=>losas.set([l.x,l.y,l.hueco||l.edad>=l.aviso?1:0,lim(l.edad/l.aviso,0,1)],i*4));
      gl.uniform4fv(u.uLosa,losas);gl.uniform1f(u.uNLosas,Math.min(MAXLOSAS,m.losas.length));
      const marcas=new Float32Array(MAXMARCAS*4);m.marcas.slice(-MAXMARCAS).forEach((q,i)=>marcas.set([q.x,q.y,q.edad,q.r],i*4));
      gl.uniform4fv(u.uMarca,marcas);gl.uniform1f(u.uNMarcas,Math.min(MAXMARCAS,m.marcas.length));}},
    // El halo del héroe (siempre la primera), el fogonazo, los estallidos y el fuego, las estrellas y los pozos.
    luces(s,t,poner){
      const m=s.modelo,p=m.jugador;
      poner(p.x,1.1,p.y,3.6,[1,.78,.4],1.02+.12*Math.sin(t*3));
      if(m.fogonazo>0)poner(p.x+Math.cos(p.a)*.7,1,p.y+Math.sin(p.a)*.7,4.5,[1,.85,.5],m.fogonazo/.075*2.5);
      for(const mc of m.marcas){const e=mc.edad-mc.aviso;if(e>=0&&e<mc.activo)poner(mc.x,1,mc.y,4.5,[1,.55,.2],1.8*(1-e/mc.activo));else if(e>=mc.activo&&e<mc.activo+mc.fuego)poner(mc.x,.8,mc.y,3.2,[1,.4,.1],1.1);}
      for(const b of m.balas.slice(-5))poner(b.x,.9,b.y,2.4,[1,.8,.4],1.2);
      for(const l of m.losas)if(l.hueco||l.edad>l.aviso)poner(l.x,-.3,l.y,2.6,[1,.3,.08],.9);
    },
    // Trozos de losa que caen y paredes de los huecos.
    cajas(s,cara,caja){
      const hondo=6,roca=[.16,.13,.12],losa=[.36,.42,.33];
      for(const l of s.modelo.losas){
        if(l.hueco||l.edad>=l.aviso){const x0=l.x-1,x1=l.x+1,z0=l.y-1,z1=l.y+1;
          cara([x0,0,z0],[x1,0,z0],[x1,-hondo,z0],[x0,-hondo,z0],[0,0,1],roca,1);cara([x1,0,z1],[x0,0,z1],[x0,-hondo,z1],[x1,-hondo,z1],[0,0,-1],roca,1);
          cara([x0,0,z1],[x0,0,z0],[x0,-hondo,z0],[x0,-hondo,z1],[1,0,0],roca,1);cara([x1,0,z0],[x1,0,z1],[x1,-hondo,z1],[x1,-hondo,z0],[-1,0,0],roca,1);}
        if(!l.hueco&&l.edad>=l.aviso){const k=lim((l.edad-l.aviso)/l.caida,0,1);
          for(let i=0;i<4;i++){const ox=(i%2?.5:-.5),oz=(i<2?-.5:.5),sem=(l.id*7+i*13)%17/17;
            caja(l.x+ox*(1+k*.6),-.18-9*k*k*(.8+.4*sem),l.y+oz*(1+k*.6),.96,.36,.96,k*(sem-.5)*3,k*(sem*2-1)*2.2,losa,roca);}}
      }
    },
    figuras(h){
      const {m,t,mem,fig,de_pie}=h;
      // Fantasmas: aparecen desde el suelo, miran al héroe y destellan al recibir.
      const vivos=new Set();
      for(const u of m.enemigos){vivos.add(u.id);mem.vivos.set(u.id,{x:u.x,y:u.y});
        const sale=lim(1-u.aparece/.65,0,1);h.fantasma(u,{sale,dolor:u.dolor>0});
        if(u.aparece>0)fig(de_pie,u.x,.25,u.y,.9,.9,[.9,.2,.1,.5*u.aparece/.65],3,u.id%5);}
      // Los que desaparecen se deshacen en humo y chispas de oro (memoria sólo de dibujo).
      for(const [id,u] of mem.vivos)if(!vivos.has(id)){mem.vivos.delete(id);mem.efectos.push({x:u.x,y:u.y,t0:t,sem:id});}
      mem.efectos=mem.efectos.filter(e=>t-e.t0<.9&&t>=e.t0);
      for(const e of mem.efectos){const k=(t-e.t0)/.9;
        for(let i=0;i<3;i++)fig(de_pie,e.x+Math.cos(i*2.1+e.sem)*.25*k,.4+k*.6,e.y+Math.sin(i*2.1+e.sem)*.25*k,.45+k*.7,.45+k*.7,[.22,.26,.38,.55*(1-k)],3,e.sem+i);
        for(let i=0;i<6;i++){const a=i*TAU/6+e.sem;fig(de_pie,e.x+Math.cos(a)*k*1.1,.6+Math.sin(k*3+i)*.3,e.y+Math.sin(a)*k*1.1,.18,.18,[1,.8,.4,1-k],2);}}
      h.heroe();
      // Estrellas de oro con estela.
      for(const b of m.balas)for(let i=0;i<4;i++)fig(de_pie,b.x-b.vx*.018*i,.9,b.y-b.vy*.018*i,.34-i*.06,.34-i*.06,[1,.82,.45,1-i*.22],2);
      // Fuego en el anillo de las marcas y el fogonazo del estallido.
      for(const mc of m.marcas){const e=mc.edad-mc.aviso;
        if(e>=0&&e<mc.activo)fig(de_pie,mc.x,.6,mc.y,1.4,1.4,[1,.7,.35,.7*(1-e/mc.activo)],2);
        else if(e>=mc.activo&&e<mc.activo+mc.fuego){const k=(e-mc.activo)/mc.fuego;for(let i=0;i<14;i++){const a=i*TAU/14;fig(de_pie,mc.x+Math.cos(a)*mc.r,0,mc.y+Math.sin(a)*mc.r,.32,.75*(1-k*.6)*(.8+.4*Math.sin(t*9+i)),[1,1,1,1-k*.4],4,i*.37);}}}
      h.chispas();
      // Ambiente: humo azul al borde, motas de oro y brasas de las grietas.
      for(let i=0;i<20;i++){const a=i*TAU/20+t*.02*(i%2?1:-1),r=ARENA+2+Math.sin(i*3.1+t*.1)*1.2;fig(de_pie,Math.cos(a)*r,.4+(i%3)*.3,Math.sin(a)*r,2.2,1.6,[.24,.28,.4,.35],3,i);}
      for(let i=0;i<34;i++){const f=(t*.06+i*.618)%1,x=Math.sin(i*12.9)*ARENA,z=Math.cos(i*7.3)*ARENA;fig(de_pie,x+Math.sin(t*.4+i)*.3,f*3,z,.07,.07,i%3?[1,.4,.1,Math.sin(f*Math.PI)*.8]:[1,.85,.45,Math.sin(f*Math.PI)*.6],2);}
    },
  });
})(typeof window!=='undefined'?window:globalThis);

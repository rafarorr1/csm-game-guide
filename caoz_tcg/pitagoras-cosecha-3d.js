/* La cosecha en 3D: el pintor de la prueba I dentro de su carta dorada.
   Sólo presentación: lee s.modelo (el de pitagoras-pruebas.js) y nunca lo
   escribe; la arena, las reglas, el azar y los tiempos no cambian.
   Una cámara isométrica en perspectiva mira la arena de losas verdes (el
   suelo de la ilustración dorada), con grietas de lava, la orla y las runas
   de oro; detrás, el propio arte de la carta (el Segador, el halo y las
   torres del Domo) se alza del abismo y se acerca con la presión de la
   cosecha. Las criaturas son los fantasmas de humo del arte; el héroe lleva
   su halo de oro y dispara estrellas que iluminan lo que tocan.
   WebGL en un lienzo propio que se copia al del juego (como la nube de
   pitagoras-cine.js). Sin WebGL, o con movimiento reducido, sigue el pintor
   anterior. sueloDesdePantalla traduce el puntero al suelo para apuntar. */
'use strict';
(function(global){
  if(typeof document==='undefined'||!global.PITAGORAS_PRUEBAS)return;
  const API=global.PITAGORAS_PRUEBAS,TAU=Math.PI*2,lim=(x,a,b)=>Math.max(a,Math.min(b,x));
  const ARENA=6.55,MAXL=12,MAXLOSAS=10,MAXMARCAS=6;
  const arteUrl=(()=>{try{return new URL('art/editorcosecha-dorado-v1.webp',document.currentScript.src).href;}catch(_){return 'art/editorcosecha-dorado-v1.webp';}})();

  /* ---- Matrices (por columnas, profundidad de −1 a 1) ---------------------- */
  const M={
    mult(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;},
    persp(fov,asp,n,f){const t=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;},
    mirar(ojo,obj){const f=norm3([obj[0]-ojo[0],obj[1]-ojo[1],obj[2]-ojo[2]]),r=norm3(cruz(f,[0,1,0])),u=cruz(r,f);
      return new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,ojo),-dot(u,ojo),dot(f,ojo),1]);},
    invertir(m){const a=m,o=new Float32Array(16);
      const b00=a[0]*a[5]-a[1]*a[4],b01=a[0]*a[6]-a[2]*a[4],b02=a[0]*a[7]-a[3]*a[4],b03=a[1]*a[6]-a[2]*a[5],b04=a[1]*a[7]-a[3]*a[5],b05=a[2]*a[7]-a[3]*a[6];
      const b06=a[8]*a[13]-a[9]*a[12],b07=a[8]*a[14]-a[10]*a[12],b08=a[8]*a[15]-a[11]*a[12],b09=a[9]*a[14]-a[10]*a[13],b10=a[9]*a[15]-a[11]*a[13],b11=a[10]*a[15]-a[11]*a[14];
      const d=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
      o[0]=(a[5]*b11-a[6]*b10+a[7]*b09)*d;o[1]=(a[2]*b10-a[1]*b11-a[3]*b09)*d;o[2]=(a[13]*b05-a[14]*b04+a[15]*b03)*d;o[3]=(a[10]*b04-a[9]*b05-a[11]*b03)*d;
      o[4]=(a[6]*b08-a[4]*b11-a[7]*b07)*d;o[5]=(a[0]*b11-a[2]*b08+a[3]*b07)*d;o[6]=(a[14]*b02-a[12]*b05-a[15]*b01)*d;o[7]=(a[8]*b05-a[10]*b02+a[11]*b01)*d;
      o[8]=(a[4]*b10-a[5]*b08+a[7]*b06)*d;o[9]=(a[1]*b08-a[0]*b10-a[3]*b06)*d;o[10]=(a[12]*b04-a[13]*b02+a[15]*b00)*d;o[11]=(a[9]*b02-a[8]*b04-a[11]*b00)*d;
      o[12]=(a[5]*b07-a[4]*b09-a[6]*b06)*d;o[13]=(a[0]*b09-a[1]*b07+a[2]*b06)*d;o[14]=(a[13]*b01-a[12]*b03-a[14]*b00)*d;o[15]=(a[8]*b03-a[9]*b01+a[10]*b00)*d;return o;},
    aplicar(m,v){const x=v[0],y=v[1],z=v[2],w=v[3]??1;return [m[0]*x+m[4]*y+m[8]*z+m[12]*w,m[1]*x+m[5]*y+m[9]*z+m[13]*w,m[2]*x+m[6]*y+m[10]*z+m[14]*w,m[3]*x+m[7]*y+m[11]*z+m[15]*w];},
  };
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function cruz(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function norm3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}

  /* ---- Shaders ---------------------------------------------------------------- */
  const RUIDO=`
float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.103,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float r2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*r2(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s/.9375;}
`;
  // Luces puntuales: el halo del héroe, las estrellas, los estallidos y el fuego.
  const LUCES=`
uniform vec4 uLP[${MAXL}];uniform vec4 uLC[${MAXL}];uniform float uNL;
vec3 puntuales(vec3 P,vec3 N){vec3 c=vec3(0.);for(int i=0;i<${MAXL};i++){if(float(i)>=uNL)break;
  vec3 L=uLP[i].xyz-P;float d=length(L);float k=clamp(1.-d/uLP[i].w,0.,1.);c+=uLC[i].rgb*k*k*(.35+.65*max(dot(N,L/max(d,1e-3)),0.));}return c;}
`;
  // El fondo: el abismo bajo la arena (lava y humo a 6 unidades de hondo) y el cielo de lapislázuli.
  const FONDO_V=`attribute vec2 aPos;varying vec2 vNdc;void main(){vNdc=aPos;gl_Position=vec4(aPos,.9999,1.);}`;
  const FONDO_F=`precision highp float;varying vec2 vNdc;uniform mat4 uInv;uniform vec3 uCam;uniform float uT,uPresion;${RUIDO}
void main(){
  vec4 a=uInv*vec4(vNdc,-1.,1.),b=uInv*vec4(vNdc,1.,1.);vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);
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
  gl_FragColor=vec4(c,1.);
}`;
  // El telón: el arte de la carta dorada (Segador, halo, torres), de cara a la cámara.
  const TELON_V=`attribute vec2 aPos;uniform mat4 uVP;uniform vec3 uCentro,uDer,uArr;uniform vec2 uTam;varying vec2 vUv;
void main(){vUv=aPos*.5+.5;vec3 P=uCentro+uDer*aPos.x*uTam.x*.5+uArr*aPos.y*uTam.y*.5;gl_Position=uVP*vec4(P,1.);}`;
  const TELON_F=`precision highp float;varying vec2 vUv;uniform sampler2D uArte;uniform float uT,uPresion,uCorte;${RUIDO}
void main(){
  vec2 uv=vec2(vUv.x,(1.-vUv.y)*uCorte);
  uv+=vec2(fbm(vUv*3.+uT*.05)-.5,fbm(vUv*3.+7.-uT*.04)-.5)*.006;
  vec3 c=texture2D(uArte,uv).rgb;
  c*=mix(.72,1.05,uPresion);c=mix(c,c*vec3(1.2,.8,.75),uPresion*.35);
  float borde=smoothstep(0.,.16,vUv.x)*smoothstep(1.,.84,vUv.x)*smoothstep(.1,.4,vUv.y)*smoothstep(1.,.97,vUv.y);
  gl_FragColor=vec4(c*borde,borde);
}`;
  // El suelo: losas de la ilustración, grietas con lava, orla y runas de oro,
  // losas que se agrietan y huecos, y las marcas rojas del Editor.
  const SUELO_V=`attribute vec2 aPos;uniform mat4 uVP;varying vec3 vP;void main(){vP=vec3(aPos.x,0.,aPos.y);gl_Position=uVP*vec4(vP,1.);}`;
  const SUELO_F=`precision highp float;varying vec3 vP;uniform vec3 uCam;uniform float uT,uTm,uPresion;
uniform vec4 uLosa[${MAXLOSAS}];uniform float uNLosas;uniform vec4 uMarca[${MAXMARCAS}];uniform float uNMarcas;${RUIDO}${LUCES}
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
  // Cajas: los trozos de losa que caen al abismo y las paredes de los huecos.
  const CAJA_V=`attribute vec3 aPos;attribute vec3 aNor;attribute float aTono;uniform mat4 uVP;varying vec3 vP;varying vec3 vN;varying float vTono;
void main(){vP=aPos;vN=aNor;vTono=aTono;gl_Position=uVP*vec4(aPos,1.);}`;
  const CAJA_F=`precision highp float;varying vec3 vP;varying vec3 vN;varying float vTono;${LUCES}
void main(){vec3 N=normalize(vN);vec3 base=vTono>.5?vec3(.36,.42,.33):vec3(.16,.13,.12);
  float hondo=clamp(-vP.y/5.,0.,1.);vec3 c=base*(vec3(.2,.24,.36)*(.6+.4*N.y)+vec3(1.,.82,.5)*.5*max(dot(N,normalize(vec3(-.45,.8,-.68))),0.))+base*puntuales(vP,N);
  if(vTono<.5){float veta=.7+.3*sin(vP.y*9.+sin(vP.x*3.+vP.z*2.)*2.);c=mix(vec3(.12,.07,.06)*veta,vec3(1.,.3,.07),.3+.7*hondo)+vec3(1.,.5,.2)*smoothstep(-.15,0.,vP.y)*.35;}gl_FragColor=vec4(c,1.);}`;
  // Figuras: fantasmas, héroe, estrellas, humo, fuego, sombras y oro en el suelo.
  // Alfa premultiplicado: las figuras tapan (alfa) y la luz suma (alfa 0).
  // Figuras: fantasmas, héroe, estrellas, humo, fuego, sombras y oro en el suelo.
  // Alfa premultiplicado: las figuras tapan (alfa) y la luz suma (alfa 0).
  // Las figuras de pie (2,5D) tienen relieve (normales) y proyectan sombras
  // sobre las losas: la del halo del fondo y la que les hace el aura del héroe.
  const FIG_V=`attribute vec3 aCentro;attribute vec2 aEsq;attribute vec2 aTam;attribute vec4 aColor;attribute vec4 aParam;
uniform mat4 uVP;uniform vec3 uDer,uArr;varying vec2 vQ;varying vec4 vColor;varying vec4 vParam;varying vec3 vP;
void main(){vQ=aEsq;vColor=aColor;vParam=aParam;float modo=aParam.x;vec3 P;vec3 derH=normalize(vec3(uDer.x,0.,uDer.z));
  if(modo>9.5){
    // Sombra: la silueta tumbada sobre el suelo, alejándose de la luz.
    vec2 dir=aColor.xy;vec3 perp=normalize(vec3(-dir.y,0.,dir.x));if(dot(perp,derH)<0.)perp=-perp;
    float alto=(aEsq.y*.5+.5)*aTam.y;P=aCentro+perp*aEsq.x*aTam.x+vec3(dir.x,0.,dir.y)*alto*aColor.z;P.y=.02;}
  else if(modo>5.5){float a=aParam.w;vec2 e=vec2(aEsq.x*aTam.x,aEsq.y*aTam.y);vec2 r=vec2(e.x*cos(a)-e.y*sin(a),e.x*sin(a)+e.y*cos(a));P=aCentro+vec3(r.x,.012,r.y);}
  else if(modo<1.5)P=aCentro+derH*aEsq.x*aTam.x+vec3(0.,1.,0.)*(aEsq.y*.5+.5)*aTam.y;
  else P=aCentro+uDer*aEsq.x*aTam.x+uArr*aEsq.y*aTam.y;
  vP=P;gl_Position=uVP*vec4(P,1.);}`;
  const FIG_F=`precision highp float;varying vec2 vQ;varying vec4 vColor;varying vec4 vParam;varying vec3 vP;
uniform sampler2D uHeroe,uHeroeN;uniform float uT;uniform vec3 uDer,uFrente;${RUIDO}${LUCES}
float estrella(vec2 q){float r=length(q);float a=atan(q.y,q.x);float rayos=pow(abs(cos(a*2.)),40.)*1.+pow(abs(cos(a*2.+.785)),40.)*.55;return clamp(exp(-r*r*18.)*1.3+rayos*exp(-r*3.2)*.9,0.,3.);}
vec2 torcer(vec2 p,float sem,float t){return p+vec2(fbm(p*vec2(3.,4.)+vec2(sem,-t*.8))-.5,fbm(p*vec2(3.,4.)+vec2(5.+sem,-t*.7))-.5)*.16;}
// El fantasma de humo como distancia con signo: capucha, cuerpo, brazos y garras.
float sdfFantasma(vec2 s,float t){
  float cabeza=length((s-vec2(0.,.74))*vec2(1.,1.2))-.25;
  float ancho=mix(.08,.34,smoothstep(.02,.62,s.y))-.06*smoothstep(.62,.75,s.y);float cuerpo=max(abs(s.x)-ancho,max(s.y-.76,.04-s.y));
  vec2 b0=vec2(.2,.6),b1=vec2(.78,.34+.04*sin(t*2.));vec2 ba=s-b0,bb=b1-b0;float h=clamp(dot(ba,bb)/dot(bb,bb),0.,1.);float brazo=length(ba-bb*h)-mix(.07,.03,h);
  float garras=9.;for(int i=0;i<3;i++){vec2 g0=b1,g1=b1+vec2(.13,-.16+float(i)*.1);vec2 ga=s-g0,gb=g1-g0;float hh=clamp(dot(ga,gb)/dot(gb,gb),0.,1.);garras=min(garras,length(ga-gb*hh)-.012*(1.-hh));}
  vec2 b2=vec2(-.2,.6),b3=vec2(-.6,.45+.05*sin(t*1.7+1.));vec2 ca=s-b2,cb=b3-b2;float h2=clamp(dot(ca,cb)/dot(cb,cb),0.,1.);float brazo2=length(ca-cb*h2)-mix(.06,.02,h2);
  return min(min(cabeza,cuerpo),min(min(brazo,brazo2),garras));
}
// De la normal de la figura (x a la derecha, y arriba, z hacia la cámara) al mundo.
vec3 mundo(vec3 n){vec3 der=normalize(vec3(uDer.x,0.,uDer.z));return normalize(der*n.x+vec3(0.,1.,0.)*n.y+uFrente*n.z);}
// Luz de una figura: cielo, el oro del halo del fondo y las luces de la escena por su lado.
vec3 luzFigura(vec3 P,vec3 N,float propia){
  vec3 c=vec3(.3,.34,.48)*(.55+.45*max(N.y,0.));c+=vec3(1.,.82,.5)*.75*max(dot(N,normalize(vec3(-.45,.8,-.68))),0.);
  for(int i=0;i<${MAXL};i++){if(float(i)>=uNL)break;if(i==0&&propia>.5)continue;
    vec3 D=uLP[i].xyz-P;float d=length(D);float k=clamp(1.-d/uLP[i].w,0.,1.);c+=uLC[i].rgb*k*k*max(dot(N,D/max(d,1e-3)),0.)*1.6;}
  return c;}
void main(){
  float modo=vParam.x,sem=vParam.y,k=vParam.z;vec2 q=vQ;vec4 o=vec4(0.);
  if(modo>9.5){
    // Sombras: la silueta de la figura, desenfocada y más clara lejos de los pies.
    float a;
    if(modo<10.5){vec2 uv=vec2(q.x*vParam.w*.5+.5,1.-(q.y*.5+.5));a=texture2D(uHeroe,uv,2.5).a;}
    else{float lado=vParam.w;vec2 p=vec2(q.x*lado,q.y*.5+.5);float t=uT*1.3+sem*20.;a=smoothstep(.1,-.06,sdfFantasma(torcer(p,sem,t),t))*step(p.y,k*1.08)*smoothstep(0.,.3,p.y);}
    o=vec4(0.,0.,0.,a*vColor.w*(1.-.55*(q.y*.5+.5)));
  }else if(modo<.5){
    // Fantasma de humo, con relieve de almohada y luz por el lado que la recibe.
    float lado=vParam.w;vec2 p=vec2(q.x*lado,q.y*.5+.5);float t=uT*1.3+sem*20.;
    if(p.y>k*1.08)discard;
    vec2 s=torcer(p,sem,t);float sdf=sdfFantasma(s,t);
    float a=smoothstep(.03,-.03,sdf)*smoothstep(0.,.25,p.y+.05*sin(p.x*9.+t*3.));
    if(a<.003)discard;
    float e=.02,gx=(sdfFantasma(s+vec2(e,0.),t)-sdf)/e,gy=(sdfFantasma(s+vec2(0.,e),t)-sdf)/e;
    float grosor=clamp(-sdf*7.,0.,1.);vec3 N=mundo(normalize(vec3(gx*lado*(1.-grosor),gy*(1.-grosor),.3+grosor)));
    float filo=smoothstep(-.09,0.,sdf);
    vec3 albedo=mix(vec3(.07,.075,.13),vec3(.36,.42,.58),filo*.75);
    vec3 col=albedo*luzFigura(vP,N,0.)*1.3+vec3(.2,.25,.4)*filo*.2;
    col+=vec3(1.,.95,.9)*vColor.r*a;
    vec2 ej=vec2(abs(s.x)-.095,s.y-.755);float ojo=1.-smoothstep(.0,.012,length(ej*vec2(1.,2.3))-.035);
    o=vec4(col*a,a)+vec4(vec3(1.,.8,.25)*(ojo*1.6+exp(-dot(ej,ej)*400.)*.5)*(1.-vColor.r),0.);
    o*=vColor.g;
  }else if(modo<1.5){
    // El héroe (atlas pintado con su mapa de normales): la capa ondea con el paso.
    vec2 uv=vec2(q.x*vParam.w*.5+.5,1.-(q.y*.5+.5));
    uv.x+=sin(uv.y*9.-uT*8.)*.015*k*smoothstep(.35,.9,uv.y)*step(uv.x,.52);
    vec4 tx=texture2D(uHeroe,uv);if(tx.a<.01)discard;
    vec3 nm=texture2D(uHeroeN,uv).xyz*2.-1.;nm.x*=vParam.w;vec3 N=mundo(nm);
    // Relleno cálido desde la cámara: el héroe siempre se lee, con el relieve encima.
    vec3 col=tx.rgb*(luzFigura(vP,N,1.)*1.1+vec3(.42,.38,.34)*(.4+.6*max(nm.z,0.)));
    col+=vec3(1.,.8,.45)*pow(clamp(1.-nm.z,0.,1.),2.)*.3;
    o=vec4(col*tx.a,tx.a)*vColor.a;
  }else if(modo<2.5){
    o=vec4(vColor.rgb*estrella(q)*vColor.a,0.);
  }else if(modo<3.5){
    float r=length(q)+(fbm(q*2.5+sem*9.+uT*.2)-.5)*.6;float a=smoothstep(1.,.2,r)*vColor.a;o=vec4(vColor.rgb*a,a);
  }else if(modo<4.5){
    vec2 p=vec2(q.x,q.y*.5+.5);float n=fbm(vec2(p.x*3.,p.y*2.-uT*3.)+sem*7.);float forma=1.-smoothstep(.0,.55,abs(p.x)*(1.3+p.y*2.)+ (1.-p.y)*.1-n*.35);
    float f=forma*smoothstep(1.,.25,p.y)*smoothstep(0.,.08,p.y);vec3 c=mix(vec3(1.,.25,.05),vec3(1.,.9,.5),f*f);o=vec4(c*f*vColor.a*1.4,0.);
  }else{
    float r=length(q);
    if(modo<6.5){float a=smoothstep(1.,.2,r)*vColor.a;o=vec4(0.,0.,0.,a);}
    else if(modo<7.5){float anillo=(1.-smoothstep(.0,.08,abs(r-.85)))+smoothstep(1.,0.,r)*.35;o=vec4(vColor.rgb*anillo*vColor.a,0.);}
    else{float a=smoothstep(1.,.2,abs(q.y))*smoothstep(1.,.6,q.x)*smoothstep(-1.,-.4,q.x);o=vec4(vColor.rgb*a*vColor.a,0.);}
  }
  gl_FragColor=o;
}`;

  /* ---- El héroe, pintado a mano en un lienzo (mirando a la derecha) --------- */
  function pintarHeroe(){
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.translate(32,0);
    const tinta='#1a0f0a';g.lineJoin='round';g.lineCap='round';g.lineWidth=4;g.strokeStyle=tinta;
    const forma=(pts,fill)=>{g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.quadraticCurveTo(...pts[i]);g.closePath();g.fillStyle=fill;g.fill();g.stroke();};
    // Halo de oro con anillos, como en el manuscrito.
    const halo=g.createRadialGradient(92,62,6,92,62,40);halo.addColorStop(0,'#fff1b0');halo.addColorStop(.7,'#e9b949');halo.addColorStop(1,'#a8741c');
    g.fillStyle=halo;g.beginPath();g.arc(92,62,38,0,TAU);g.fill();g.stroke();g.strokeStyle='#8a5a12';g.lineWidth=2;g.beginPath();g.arc(92,62,31,0,TAU);g.stroke();g.strokeStyle=tinta;g.lineWidth=4;
    // Capa roja que cae hacia atrás, con ribete de oro.
    const capa=g.createLinearGradient(20,80,110,240);capa.addColorStop(0,'#c8321f');capa.addColorStop(1,'#7c160f');
    forma([[78,86],[20,150,14,238],[70,246,118,236],[92,160,104,92]],capa);
    g.strokeStyle='#e7b54a';g.lineWidth=3;g.beginPath();g.moveTo(14,236);g.quadraticCurveTo(66,246,118,236);g.stroke();g.strokeStyle=tinta;g.lineWidth=4;
    // Túnica azul con cinturón de oro y la bolsa.
    const tunica=g.createLinearGradient(80,90,120,200);tunica.addColorStop(0,'#3558b8');tunica.addColorStop(1,'#1d2f73');
    forma([[84,92],[74,150,80,196],[104,204,128,194],[122,140,112,92]],tunica);
    g.fillStyle='#e0ad3e';g.fillRect(80,146,46,8);g.strokeRect(80,146,46,8);
    g.fillStyle='#6e5a2c';g.fillRect(66,152,22,20);g.strokeRect(66,152,22,20);
    // Piernas y botas.
    g.fillStyle='#2a1c14';for(const [x,dx] of [[92,-8],[110,10]]){g.beginPath();g.moveTo(x,196);g.lineTo(x+dx,238);g.lineTo(x+dx+14,240);g.lineTo(x+8,196);g.closePath();g.fill();g.stroke();}
    // Cabeza con capucha roja.
    g.fillStyle='#f0c9a0';g.beginPath();g.arc(98,66,17,0,TAU);g.fill();g.stroke();
    forma([[80,60],[82,38,104,40],[122,48,116,72],[108,56,98,52]],'#b52a1a');
    g.fillStyle=tinta;g.beginPath();g.arc(106,66,2.4,0,TAU);g.fill();
    // Brazo con la varita hacia delante.
    g.strokeStyle='#2d4aa0';g.lineWidth=11;g.beginPath();g.moveTo(112,104);g.quadraticCurveTo(138,110,150,90);g.stroke();
    g.strokeStyle=tinta;g.lineWidth=4;g.beginPath();g.moveTo(148,94);g.lineTo(176,52);g.stroke();g.strokeStyle='#e8c46a';g.lineWidth=2;g.beginPath();g.moveTo(148,94);g.lineTo(176,52);g.stroke();
    return c;
  }
  // Relieve del héroe: la silueta desenfocada como altura (más un poco del dibujo) → normales.
  function mapaNormal(c){
    const w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,alt=new Float32Array(w*h),tmp=new Float32Array(w*h);
    for(let i=0;i<w*h;i++)alt[i]=d[i*4+3]/255;
    const caja=(a,b,r,paso,n,largo)=>{for(let l=0;l<largo;l++){let suma=0;const base=l*(paso===1?w:1);for(let i=-r;i<=r;i++)suma+=a[base+lim(i,0,n-1)*paso];
      for(let i=0;i<n;i++){b[base+i*paso]=suma/(2*r+1);suma+=a[base+lim(i+r+1,0,n-1)*paso]-a[base+lim(i-r,0,n-1)*paso];}}};
    for(let k=0;k<2;k++){caja(alt,tmp,7,1,w,h);caja(tmp,alt,7,w,h,w);}
    for(let i=0;i<w*h;i++)alt[i]=alt[i]*alt[i]*(3-2*alt[i])+(d[i*4]+d[i*4+1]+d[i*4+2])/765*.08*(d[i*4+3]/255);
    const n=document.createElement('canvas');n.width=w;n.height=h;const g=n.getContext('2d'),im=g.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,dx=alt[y*w+Math.min(w-1,x+1)]-alt[y*w+Math.max(0,x-1)],dy=alt[Math.min(h-1,y+1)*w+x]-alt[Math.max(0,y-1)*w+x];
      let nx=-dx*15,ny=dy*15,nz=1;const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;im.data[i*4]=(nx*.5+.5)*255;im.data[i*4+1]=(ny*.5+.5)*255;im.data[i*4+2]=(nz*.5+.5)*255;im.data[i*4+3]=255;}
    g.putImageData(im,0,0);return n;
  }

  /* ---- El motor ------------------------------------------------------------------ */
  function crear(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
    let gl=null;try{gl=canvas.getContext('webgl',{alpha:false,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});}catch(_){gl=null;}
    if(!gl)return null;
    const shader=(tipo,src)=>{const s=gl.createShader(tipo);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const programa=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      const u={},a={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS),na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);
      for(let i=0;i<n;i++){const x=gl.getActiveUniform(p,i),nombre=x.name.replace(/\[0\]$/,'');u[nombre]=gl.getUniformLocation(p,nombre);}
      for(let i=0;i<na;i++){const x=gl.getActiveAttrib(p,i);a[x.name]=gl.getAttribLocation(p,x.name);}return {p,u,a};};
    let P;
    try{P={fondo:programa(FONDO_V,FONDO_F),telon:programa(TELON_V,TELON_F),suelo:programa(SUELO_V,SUELO_F),caja:programa(CAJA_V,CAJA_F),fig:programa(FIG_V,FIG_F)};}
    catch(e){console.warn('La cosecha 3D usa el pintor anterior:',e.message);return null;}
    const buf=d=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
    const bTri=buf(new Float32Array([-1,-1,3,-1,-1,3])),bQuad=buf(new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]));
    const S=ARENA+4.5,bSuelo=buf(new Float32Array([-S,-S,S,-S,S,S,-S,-S,S,S,-S,S]));
    const bCajas=gl.createBuffer(),bFig=gl.createBuffer();
    const textura=(fuente,mip)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,fuente);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      if(mip){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}return t;};
    const lienzoHeroe=pintarHeroe(),tHeroe=textura(lienzoHeroe,true),tHeroeN=textura(mapaNormal(lienzoHeroe),true);
    // El arte dorado llega cuando carga; mientras, un píxel de lapislázuli.
    const tmp=document.createElement('canvas');tmp.width=tmp.height=1;tmp.getContext('2d').fillStyle='#101a40';tmp.getContext('2d').fillRect(0,0,1,1);
    let tArte=textura(tmp),arteListo=false;const img=new Image();img.onload=()=>{tArte=textura(img);arteListo=true;};img.src=arteUrl;
    let ultimaCam=null;const memorias=new WeakMap();

    function camara(s,ahora){
      const w=s.ancho,h=s.alto,asp=w/h,fov=36*Math.PI/180,pitch=41*Math.PI/180,p=s.modelo.jugador,mem=memoria(s);
      // En pantallas anchas la cámara mira algo más al fondo: deja ver al Segador sobre la arena.
      const ancha=lim((asp-.9)/.8,0,1),obj=[p.x*.36,0,p.y*.36-.4-1.5*ancha];
      if(!mem.cam)mem.cam=obj.slice();else for(let i=0;i<3;i++)mem.cam[i]+=(obj[i]-mem.cam[i])*Math.min(1,.12*60*Math.max(1/240,ahora-(mem.antes??ahora)||1/60));
      const tan=Math.tan(fov/2),dist=Math.max(6.3/(tan*asp),6.4*Math.sin(pitch)/tan+4.5)*(1-.05*(s.modelo.presionCosecha||0));
      const ojo=[mem.cam[0],dist*Math.sin(pitch),mem.cam[2]+dist*Math.cos(pitch)];
      const vista=M.mirar(ojo,mem.cam),proy=M.persp(fov,asp,.5,120),vp=M.mult(proy,vista);
      const der=[vista[0],vista[4],vista[8]],arr=[vista[1],vista[5],vista[9]];
      const fr=norm3([ojo[0]-mem.cam[0],0,ojo[2]-mem.cam[2]]);
      return {vp,inv:M.invertir(vp),ojo,der,arr,frente:fr,w,h};
    }
    function memoria(s){let m=memorias.get(s.modelo);if(!m){m={vivos:new Map(),efectos:[],cam:null};memorias.set(s.modelo,m);}return m;}
    function luces(s,t){
      const m=s.modelo,p=m.jugador,L=[];
      const poner=(x,y,z,r,col,i)=>{L.push([x,y,z,r,col[0]*i,col[1]*i,col[2]*i]);};
      poner(p.x,1.1,p.y,3.6,[1,.78,.4],1.02+.12*Math.sin(t*3));
      if(m.fogonazo>0)poner(p.x+Math.cos(p.a)*.7,1,p.y+Math.sin(p.a)*.7,4.5,[1,.85,.5],m.fogonazo/.075*2.5);
      for(const mc of m.marcas){const e=mc.edad-mc.aviso;if(e>=0&&e<mc.activo)poner(mc.x,1,mc.y,4.5,[1,.55,.2],1.8*(1-e/mc.activo));else if(e>=mc.activo&&e<mc.activo+mc.fuego)poner(mc.x,.8,mc.y,3.2,[1,.4,.1],1.1);}
      for(const b of m.balas.slice(-5))poner(b.x,.9,b.y,2.4,[1,.8,.4],1.2);
      for(const l of m.losas)if(l.hueco||l.edad>l.aviso)poner(l.x,-.3,l.y,2.6,[1,.3,.08],.9);
      return L.slice(0,MAXL);
    }
    function subirLuces(pr,L){const a=new Float32Array(MAXL*4),b=new Float32Array(MAXL*4);L.forEach((l,i)=>{a.set(l.slice(0,4),i*4);b.set([l[4],l[5],l[6],0],i*4);});gl.uniform4fv(pr.u.uLP,a);gl.uniform4fv(pr.u.uLC,b);gl.uniform1f(pr.u.uNL,L.length);}
    function atributo(pr,nombre,b,n,stride,off){const loc=pr.a[nombre];if(loc===undefined||loc<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,stride,off);}
    function soltar(pr){for(const loc of Object.values(pr.a))if(loc>=0)gl.disableVertexAttribArray(loc);}

    // Trozos de losa que caen y paredes de los huecos.
    function cajas(s){
      const v=[],m=s.modelo;
      const cara=(a,b,c,d,n,tono)=>{for(const q of [a,b,c,a,c,d])v.push(q[0],q[1],q[2],n[0],n[1],n[2],tono);};
      const caja=(cx,cy,cz,sx,sy,sz,ry,rx,tono)=>{const cr=Math.cos(ry),sr=Math.sin(ry),cq=Math.cos(rx),sq=Math.sin(rx);
        const T=(x,y,z)=>{const y1=y*cq-z*sq,z1=y*sq+z*cq;return [cx+x*cr+z1*sr,cy+y1,cz-x*sr+z1*cr];};
        const N=(x,y,z)=>{const y1=y*cq-z*sq,z1=y*sq+z*cq;return [x*cr+z1*sr,y1,-x*sr+z1*cr];};
        const X=sx/2,Y=sy/2,Z=sz/2;
        cara(T(-X,Y,-Z),T(X,Y,-Z),T(X,Y,Z),T(-X,Y,Z),N(0,1,0),tono);cara(T(-X,-Y,Z),T(X,-Y,Z),T(X,Y,Z),T(-X,Y,Z),N(0,0,1),0);
        cara(T(X,-Y,-Z),T(-X,-Y,-Z),T(-X,Y,-Z),T(X,Y,-Z),N(0,0,-1),0);cara(T(X,-Y,Z),T(X,-Y,-Z),T(X,Y,-Z),T(X,Y,Z),N(1,0,0),0);cara(T(-X,-Y,-Z),T(-X,-Y,Z),T(-X,Y,Z),T(-X,Y,-Z),N(-1,0,0),0);};
      for(const l of m.losas){
        const hondo=6;
        if(l.hueco||l.edad>=l.aviso){
          // Paredes del hueco, de la losa al abismo.
          const x0=l.x-1,x1=l.x+1,z0=l.y-1,z1=l.y+1;
          cara([x0,0,z0],[x1,0,z0],[x1,-hondo,z0],[x0,-hondo,z0],[0,0,1],0);cara([x1,0,z1],[x0,0,z1],[x0,-hondo,z1],[x1,-hondo,z1],[0,0,-1],0);
          cara([x0,0,z1],[x0,0,z0],[x0,-hondo,z0],[x0,-hondo,z1],[1,0,0],0);cara([x1,0,z0],[x1,0,z1],[x1,-hondo,z1],[x1,-hondo,z0],[-1,0,0],0);
        }
        if(!l.hueco&&l.edad>=l.aviso){const k=lim((l.edad-l.aviso)/l.caida,0,1);
          for(let i=0;i<4;i++){const ox=(i%2?.5:-.5),oz=(i<2?-.5:.5),sem=(l.id*7+i*13)%17/17;
            caja(l.x+ox*(1+k*.6),-.18-9*k*k*(.8+.4*sem),l.y+oz*(1+k*.6),.96,.36,.96,k*(sem-.5)*3,k*(sem*2-1)*2.2,1);}}
      }
      return new Float32Array(v);
    }
    // Las figuras de la escena, ya ordenadas de lejos a cerca.
    function figuras(s,t,cam){
      const m=s.modelo,p=m.jugador,mem=memoria(s),planas=[],de_pie=[];
      const fig=(lista,x,y,z,w,h,col,modo,sem=0,k=0,extra=0)=>lista.push({x,y,z,w,h,col,par:[modo,sem,k,extra]});
      // Sombras y oro en el suelo.
      // Sombras proyectadas: la del halo del fondo (larga, hacia la cámara) para
      // todos, y la que el aura del héroe hace girar alrededor de cada fantasma.
      const clave=[.55,.835],sombra=(x,z,w,h,modo,dir,largo,a,sem,k,lado)=>fig(planas,x,0,z,w,h,[dir[0],dir[1],largo,a],modo,sem,k,lado);
      const ladoHeroe=Math.cos(p.a)*cam.der[0]+Math.sin(p.a)*cam.der[2]>=0?1:-1;
      for(const u of m.enemigos){const sale=lim(1-u.aparece/.65,0,1),lado=(u.x-p.x)*cam.der[0]+(u.y-p.y)*cam.der[2]>0?-1:1,sem=(u.id*.137)%1;
        sombra(u.x,u.y,.95,2.3,11,clave,.8,.5*sale,sem,sale,lado);
        const dx=u.x-p.x,dz=u.y-p.y,d=Math.hypot(dx,dz);if(d>.3&&d<4.6)sombra(u.x,u.y,.95,2.3,11,[dx/d,dz/d],lim(.5+d*.22,.5,1.4),.5*(1-d/4.6)*sale,sem,sale,lado);
        fig(planas,u.x,0,u.y,.5,.34,[0,0,0,.6*sale],6);}
      sombra(p.x,p.y,1.04,2.05,10,clave,.85,.8,0,0,ladoHeroe);
      fig(planas,p.x,0,p.y,.42,.28,[0,0,0,.6],6);
      fig(planas,p.x,0,p.y,1.1,1.1,[1,.8,.4,.55+.15*Math.sin(t*3)],7);
      fig(planas,p.x+Math.cos(p.a)*1.05,0,p.y+Math.sin(p.a)*1.05,.55,.12,[1,.85,.45,.7],8,0,0,p.a);
      // Fantasmas: aparecen desde el suelo, miran al héroe y destellan al recibir.
      const vivos=new Set();
      for(const u of m.enemigos){vivos.add(u.id);mem.vivos.set(u.id,{x:u.x,y:u.y,hueco:false});
        const lado=(u.x-p.x)*cam.der[0]+(u.y-p.y)*cam.der[2]>0?-1:1,sale=lim(1-u.aparece/.65,0,1);
        fig(de_pie,u.x,.3,u.y,1.1,.9,[.3,.35,.5,.35*sale],3,u.id);fig(de_pie,u.x,0,u.y,.95,2.3,[u.dolor>0?1:0,1,0,0],0,(u.id*.137)%1,sale,lado);
        if(u.aparece>0)fig(de_pie,u.x,.25,u.y,.9,.9,[.9,.2,.1,.5*u.aparece/.65],3,u.id%5);}
      // Los que desaparecen se deshacen en humo y chispas de oro (memoria sólo de dibujo).
      for(const [id,u] of mem.vivos)if(!vivos.has(id)){mem.vivos.delete(id);mem.efectos.push({tipo:'muerte',x:u.x,y:u.y,t0:t,sem:id});}
      mem.efectos=mem.efectos.filter(e=>t-e.t0<.9&&t>=e.t0);
      for(const e of mem.efectos){const k=(t-e.t0)/.9;
        for(let i=0;i<3;i++)fig(de_pie,e.x+Math.cos(i*2.1+e.sem)*.25*k,.4+k*.6,e.y+Math.sin(i*2.1+e.sem)*.25*k,.45+k*.7,.45+k*.7,[.22,.26,.38,.55*(1-k)],3,e.sem+i);
        for(let i=0;i<6;i++){const a=i*TAU/6+e.sem;fig(de_pie,e.x+Math.cos(a)*k*1.1,.6+Math.sin(k*3+i)*.3,e.y+Math.sin(a)*k*1.1,.18,.18,[1,.8,.4,1-k],2);}}
      // El héroe: parpadea mientras es invulnerable; tras caer, una columna de oro.
      const parpadeo=m.invulnerable>0&&Math.floor(m.invulnerable*14)%2?.35:1,cae=lim((m.caidaJugador||0)/.35,0,1);
      fig(de_pie,p.x,0,p.y,1.04,2.05*(1-cae*.5),[1,1,1,parpadeo],1,0,s.andando||0,ladoHeroe);
      const punta=[p.x+Math.cos(p.a)*.62,1.6,p.y+Math.sin(p.a)*.62];
      fig(de_pie,punta[0],punta[1],punta[2],.28+(m.fogonazo>0?.5:0),.28+(m.fogonazo>0?.5:0),[1,.85,.5,.9],2);
      if(cae>0)fig(de_pie,p.x,1.2,p.y,.5,2.2*cae,[1,.85,.45,cae],2);
      // Estrellas de oro con estela.
      for(const b of m.balas)for(let i=0;i<4;i++)fig(de_pie,b.x-b.vx*.018*i,.9,b.y-b.vy*.018*i,.34-i*.06,.34-i*.06,[1,.82,.45,1-i*.22],2);
      // Fuego en el anillo de las marcas y el fogonazo del estallido.
      for(const mc of m.marcas){const e=mc.edad-mc.aviso;
        if(e>=0&&e<mc.activo)fig(de_pie,mc.x,.6,mc.y,1.4,1.4,[1,.7,.35,.7*(1-e/mc.activo)],2);
        else if(e>=mc.activo&&e<mc.activo+mc.fuego){const k=(e-mc.activo)/mc.fuego;for(let i=0;i<14;i++){const a=i*TAU/14;fig(de_pie,mc.x+Math.cos(a)*mc.r,0,mc.y+Math.sin(a)*mc.r,.32,.75*(1-k*.6)*(.8+.4*Math.sin(t*9+i)),[1,1,1,1-k*.4],4,i*.37);}}}
      // Las chispas del modelo, del color que traen.
      for(const q of m.particulas){const c=hexa(q.color);fig(de_pie,q.x,.4,q.y,.12,.12,[c[0],c[1],c[2],lim(q.t*3,0,1)],2);}
      // Ambiente: humo azul al borde, motas de oro y brasas de las grietas.
      for(let i=0;i<20;i++){const a=i*TAU/20+t*.02*(i%2?1:-1),r=ARENA+2+Math.sin(i*3.1+t*.1)*1.2;fig(de_pie,Math.cos(a)*r,.4+(i%3)*.3,Math.sin(a)*r,2.2,1.6,[.24,.28,.4,.35],3,i);}
      for(let i=0;i<34;i++){const f=(t*.06+i*.618)%1,x=Math.sin(i*12.9)*ARENA,z=Math.cos(i*7.3)*ARENA;fig(de_pie,x+Math.sin(t*.4+i)*.3,f*3,z,.07,.07,i%3?[1,.4,.1,Math.sin(f*Math.PI)*.8]:[1,.85,.45,Math.sin(f*Math.PI)*.6],2);}
      const prof=f=>(f.x-cam.ojo[0])**2+(f.y-cam.ojo[1])**2+(f.z-cam.ojo[2])**2;
      de_pie.sort((a,b)=>prof(b)-prof(a));
      return [...planas,...de_pie];
    }
    const colores=new Map();
    function hexa(c){if(colores.has(c))return colores.get(c);const v=/^#?([0-9a-f]{6})/i.exec(c||''),n=v?parseInt(v[1],16):0xffaa55,r=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];colores.set(c,r);return r;}
    let datosFig=new Float32Array(0);
    function subirFiguras(lista){
      const n=lista.length*6,tam=15;if(datosFig.length<n*tam)datosFig=new Float32Array(n*tam*2);
      const esq=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];let o=0;
      for(const f of lista)for(const e of esq){datosFig.set([f.x,f.y,f.z,e[0],e[1],f.w,f.h,f.col[0],f.col[1],f.col[2],f.col[3],f.par[0],f.par[1],f.par[2],f.par[3]],o);o+=tam;}
      gl.bindBuffer(gl.ARRAY_BUFFER,bFig);gl.bufferData(gl.ARRAY_BUFFER,datosFig.subarray(0,o),gl.DYNAMIC_DRAW);return n;
    }

    function dibujar(s){
      const dpr=Math.min(global.devicePixelRatio||1,1.5),W=Math.max(1,Math.round(s.ancho*dpr)),H=Math.max(1,Math.round(s.alto*dpr));
      if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
      const m=s.modelo,mem=memoria(s),ahora=Number.isFinite(s.ambiente)?s.ambiente:performance.now()/1000,t=ahora;
      const cam=camara(s,ahora);mem.antes=ahora;ultimaCam=cam;
      const presion=m.presionCosecha||0,L=luces(s,t);
      gl.viewport(0,0,W,H);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      // 1 · Abismo y cielo.
      gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);
      let pr=P.fondo;gl.useProgram(pr.p);gl.uniformMatrix4fv(pr.u.uInv,false,cam.inv);gl.uniform3fv(pr.u.uCam,cam.ojo);gl.uniform1f(pr.u.uT,t);gl.uniform1f(pr.u.uPresion,presion);
      atributo(pr,'aPos',bTri,2,0,0);gl.drawArrays(gl.TRIANGLES,0,3);soltar(pr);
      // 2 · El telón: el arte dorado se alza del abismo tras la arena.
      if(arteListo){pr=P.telon;gl.useProgram(pr.p);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
        const ancho=21,corte=.62,alto=ancho*768/512*corte,centro=[0,alto*.5-12.5+presion*2.2,-ARENA-4.5];
        gl.uniformMatrix4fv(pr.u.uVP,false,cam.vp);gl.uniform3fv(pr.u.uCentro,centro);gl.uniform3fv(pr.u.uDer,cam.der);gl.uniform3fv(pr.u.uArr,cam.arr);gl.uniform2f(pr.u.uTam,ancho,alto);
        gl.uniform1f(pr.u.uT,t);gl.uniform1f(pr.u.uPresion,presion);gl.uniform1f(pr.u.uCorte,corte);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tArte);gl.uniform1i(pr.u.uArte,0);
        atributo(pr,'aPos',bQuad,2,0,0);gl.drawArrays(gl.TRIANGLES,0,6);soltar(pr);gl.disable(gl.BLEND);}
      // 3 · El suelo de la arena.
      gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LEQUAL);
      pr=P.suelo;gl.useProgram(pr.p);gl.uniformMatrix4fv(pr.u.uVP,false,cam.vp);gl.uniform3fv(pr.u.uCam,cam.ojo);gl.uniform1f(pr.u.uT,t);gl.uniform1f(pr.u.uTm,m.t);gl.uniform1f(pr.u.uPresion,presion);subirLuces(pr,L);
      const losas=new Float32Array(MAXLOSAS*4);m.losas.slice(0,MAXLOSAS).forEach((l,i)=>losas.set([l.x,l.y,l.hueco||l.edad>=l.aviso?1:0,lim(l.edad/l.aviso,0,1)],i*4));
      gl.uniform4fv(pr.u.uLosa,losas);gl.uniform1f(pr.u.uNLosas,Math.min(MAXLOSAS,m.losas.length));
      const marcas=new Float32Array(MAXMARCAS*4);m.marcas.slice(-MAXMARCAS).forEach((q,i)=>marcas.set([q.x,q.y,q.edad,q.r],i*4));
      gl.uniform4fv(pr.u.uMarca,marcas);gl.uniform1f(pr.u.uNMarcas,Math.min(MAXMARCAS,m.marcas.length));
      atributo(pr,'aPos',bSuelo,2,0,0);gl.drawArrays(gl.TRIANGLES,0,6);soltar(pr);
      // 4 · Trozos que caen y paredes de los huecos.
      const vc=cajas(s);if(vc.length){pr=P.caja;gl.useProgram(pr.p);gl.uniformMatrix4fv(pr.u.uVP,false,cam.vp);subirLuces(pr,L);
        gl.bindBuffer(gl.ARRAY_BUFFER,bCajas);gl.bufferData(gl.ARRAY_BUFFER,vc,gl.DYNAMIC_DRAW);
        atributo(pr,'aPos',bCajas,3,28,0);atributo(pr,'aNor',bCajas,3,28,12);atributo(pr,'aTono',bCajas,1,28,24);gl.drawArrays(gl.TRIANGLES,0,vc.length/7);soltar(pr);}
      // 5 · Figuras, de lejos a cerca, sin escribir profundidad.
      const lista=figuras(s,t,cam),n=subirFiguras(lista);
      pr=P.fig;gl.useProgram(pr.p);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(pr.u.uVP,false,cam.vp);gl.uniform3fv(pr.u.uDer,cam.der);gl.uniform3fv(pr.u.uArr,cam.arr);gl.uniform3fv(pr.u.uFrente,cam.frente);gl.uniform1f(pr.u.uT,t);subirLuces(pr,L);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tHeroe);gl.uniform1i(pr.u.uHeroe,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tHeroeN);gl.uniform1i(pr.u.uHeroeN,1);gl.activeTexture(gl.TEXTURE0);
      const st=60;atributo(pr,'aCentro',bFig,3,st,0);atributo(pr,'aEsq',bFig,2,st,12);atributo(pr,'aTam',bFig,2,st,20);atributo(pr,'aColor',bFig,4,st,28);atributo(pr,'aParam',bFig,4,st,44);
      gl.drawArrays(gl.TRIANGLES,0,n);soltar(pr);gl.depthMask(true);gl.disable(gl.BLEND);
      return true;
    }
    // Del puntero (píxeles del lienzo del juego) al suelo de la arena.
    function sueloDesdePantalla(s,x,y){
      const c=ultimaCam;if(!c||!c.w||!c.h)return null;const nx=x/c.w*2-1,ny=1-y/c.h*2;
      const a=M.aplicar(c.inv,[nx,ny,-1,1]),b=M.aplicar(c.inv,[nx,ny,1,1]);const A=[a[0]/a[3],a[1]/a[3],a[2]/a[3]],B=[b[0]/b[3],b[1]/b[3],b[2]/b[3]];
      const dy=B[1]-A[1];if(Math.abs(dy)<1e-6)return null;const k=-A[1]/dy;if(k<0)return null;return {x:A[0]+(B[0]-A[0])*k,y:A[2]+(B[2]-A[2])*k};
    }
    // Y al revés (revisión): de un punto del suelo a píxeles del lienzo.
    function pantallaDesdeSuelo(x,y){const c=ultimaCam;if(!c)return null;const v=M.aplicar(c.vp,[x,0,y,1]);return {x:(v[0]/v[3]*.5+.5)*c.w,y:(.5-v[1]/v[3]*.5)*c.h};}
    return {canvas,dibujar,sueloDesdePantalla,pantallaDesdeSuelo,get arteListo(){return arteListo;}};
  }

  let motor=null,fallo=false,ultimoAncho=0;
  const anterior=API.pintores?.isometrico;
  const usable=s=>!s.reducido&&!fallo&&!global.CAOZ_COSECHA_3D_APAGADA;
  // La prueba real pasa cada pintor por pintarEscena (pitagoras-pixel.js), que
  // dibuja a ~384 px y lo amplía como pixel art. La cosecha 3D se pinta a
  // resolución completa y sin «pixelated» en el lienzo.
  const escenaPixel=API.pintarEscena;
  if(escenaPixel)API.pintarEscena=function(s,c,dibujar){
    const lienzo=s.ui?.canvas;
    if(s.tipo==='isometrico'&&usable(s)){if(lienzo&&lienzo.style.imageRendering!=='auto')lienzo.style.imageRendering='auto';dibujar(c);return;}
    if(lienzo&&lienzo.style.imageRendering==='auto')lienzo.style.imageRendering='';
    return escenaPixel.call(this,s,c,dibujar);
  };
  function pintar(s,ctx){
    if(!usable(s))return anterior?.(s,ctx);
    if(!motor){try{motor=crear();}catch(e){console.warn('La cosecha 3D no pudo crearse:',e);motor=null;}if(!motor){fallo=true;return anterior?.(s,ctx);}}
    try{motor.dibujar(s);ultimoAncho=motor.canvas.width;ctx.drawImage(motor.canvas,0,0,s.ancho,s.alto);}
    catch(e){console.warn('La cosecha 3D vuelve al pintor anterior:',e);fallo=true;anterior?.(s,ctx);}
  }
  API.pintores=Object.assign(API.pintores||{},{isometrico:pintar});
  API.sueloDesdePantalla=Object.assign(API.sueloDesdePantalla||{},{isometrico:(s,x,y)=>(!fallo&&motor&&!s.reducido&&!global.CAOZ_COSECHA_3D_APAGADA)?motor.sueloDesdePantalla(s,x,y):null});
  global.CAOZ_COSECHA_3D=Object.freeze({get activo(){return !!motor&&!fallo;},get anchoPintado(){return ultimoAncho;},get arteListo(){return !!motor?.arteListo;},anterior,pantallaDesdeSuelo:(x,y)=>motor?.pantallaDesdeSuelo(x,y)??null});
})(typeof window!=='undefined'?window:globalThis);

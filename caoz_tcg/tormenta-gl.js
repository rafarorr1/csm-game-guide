/* Tormenta para la prueba del visor (WebGL): escena de visor-3d-gl.js que
   dibuja detrás de la carta un cielo de nubes, tres cordilleras con niebla y
   el rayo, y delante de ella miles de gotas de lluvia en 3D (las que quedan
   detrás de la carta se esconden con la profundidad). tormenta-gpu.js es la
   misma escena en WGSL: mismo cielo, mismas gotas en el mismo sitio.
   La pose trae e.tormenta (0 = sin escena) y e.cielo:
   {flash, flashCol, rayoX, rayoSem, rayoBri, octavas, gotas, viento, par:[x,y]}. */
'use strict';
(function(){
  const MAXGOTAS=160000;
  const CIELO_V=`attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}`;
  const CIELO_F=`precision highp float;
uniform vec2 uRes,uPar;uniform vec3 uFlashCol;uniform float uT,uFlash,uOct,uRayoX,uRayoSem,uRayoBri;
float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float r1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h11(i),h11(i+1.),f);}
float r2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5,n=0.;for(int i=0;i<8;i++){if(float(i)>=uOct)break;s+=a*r2(p);n+=a;p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s/n;}
float cresta(float x){float s=0.,a=.5,f=1.;for(int i=0;i<5;i++){s+=a*(1.-abs(r1(x*f)*2.-1.));f*=2.1;a*=.48;}return s;}
// El rayo: una línea quebrada (desv) que baja del cielo, con ramas que salen de ella.
float desv(float y,float s){return (r1(y*7.+s)-.5)*.14+(r1(y*17.+s*1.7)-.5)*.06+(r1(y*41.+s*2.3)-.5)*.026+(r1(y*97.+s*3.1)-.5)*.011;}
float trazo(float d,float px){return exp(-d*d/(px*px*2.2))*1.6+exp(-d*55.)*.3;}
float rayo(vec2 p,float x0,float s,float px){
  float y0=.62,y1=-.12;if(p.y>y0||p.y<y1)return 0.;
  float c=trazo(abs(p.x-(x0+desv(p.y,s))),px*1.4)*smoothstep(y1,y1+.03,p.y);
  for(int i=0;i<3;i++){float k=float(i),a=h11(s*3.7+k*1.9),b=h11(s*5.3+k*2.9);
    float ys=y0-(.12+.45*a)*(y0-y1),ye=ys-.1-.22*b,inc=(b-.5)*1.4+(a-.5)*.4;
    if(p.y<=ys&&p.y>=ye){float x=x0+desv(ys,s)+desv(p.y,s+k*7.+3.)-desv(ys,s+k*7.+3.)+(ys-p.y)*inc;
      c+=trazo(abs(p.x-x),px)*.55*smoothstep(ye,ys,p.y);}}
  return c;
}
vec3 monte(vec3 c,vec2 p,float base,float alto,float esc,float sem,float par,vec3 col,float luz,float g0,float px){
  float y=base+cresta(p.x*esc+sem+uPar.x*par)*alto;
  float dentro=1.-smoothstep(y-px,y+px,p.y);
  vec3 m=col+uFlashCol*uFlash*luz*(.25+g0)*smoothstep(y-.35,y,p.y);
  m+=uFlashCol*uFlash*luz*1.2*(g0+.2)*(1.-smoothstep(0.,.012,y-p.y));
  return mix(c,m,dentro);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y,px=1./uRes.y,t=uT;
  vec2 p=vec2((uv.x-.5)*asp,uv.y-.5),q=p+uPar*.015;
  float F=uFlash;float xr=sign(uRayoX)*mix(.34,max(.36,asp*.5-.06),abs(uRayoX));vec2 alto=vec2(xr,.55);
  float g0=exp(-length((p-alto)*vec2(1.,1.5))*2.4);
  vec3 c=mix(vec3(.16,.17,.19),vec3(.025,.029,.04),smoothstep(-.15,.45,p.y));
  c+=uFlashCol*F*(.1+.6*g0);
  // Nubes: fbm estirado que avanza con el viento; el borde se aclara y el relámpago las enciende por dentro.
  vec2 np=q*vec2(1.7,3.3)+vec2(t*.03,0.);
  float n=fbm(np),n2=fbm(np+vec2(.08,.3));
  float dens=smoothstep(.36,.7,n)*smoothstep(-.18,.12,p.y);
  float borde=clamp((n-n2)*3.+.5,0.,1.);
  vec3 nube=mix(vec3(.03,.032,.04),vec3(.12,.125,.14),borde);
  nube+=uFlashCol*F*(.2+1.6*g0)*(.35+.65*borde)*(.5+n);
  c=mix(c,nube,dens);
  // Cortinas de lluvia a lo lejos.
  float cort=r2(vec2(p.x*9.+p.y*1.5,p.y*1.2+t*.7))*r2(vec2(p.x*70.+p.y*10.,p.y*3.+t*6.));
  c+=(vec3(.09,.1,.12)+uFlashCol*F*.3)*cort*.6*(1.-smoothstep(-.3,.45,p.y));
  if(uRayoBri>0.)c+=vec3(.82,.88,1.)*rayo(q,xr,uRayoSem,px)*uRayoBri;
  c=monte(c,p,-.15,.34,1.3,3.,.02,vec3(.06,.066,.08),.9,g0,px);
  c=mix(c,vec3(.09,.1,.12)+uFlashCol*F*.15,fbm(p*vec2(2.,7.)+vec2(t*.04,3.))*.55*(1.-smoothstep(-.32,-.12,p.y)));
  c=monte(c,p,-.3,.3,2.,11.,.05,vec3(.032,.036,.045),.55,g0,px);
  c=monte(c,p,-.46,.26,2.9,23.,.1,vec3(.014,.016,.021),.25,g0,px);
  c+=(vec3(.07,.075,.085)+uFlashCol*F*.08)*fbm(p*vec2(3.,9.)+vec2(t*.06,7.))*(1.-smoothstep(-.5,-.25,p.y));
  vec2 v=uv-.5;c*=1.-.55*dot(v,v);
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;
  // Cada gota es un trazo (dos triángulos) que cae inclinado por el viento y
  // se estira con la velocidad; su sitio sale del número de gota y del tiempo.
  const LLUVIA_V=`attribute vec3 aDato;
uniform mat4 uVista,uProy;uniform float uT,uDist,uTan,uAsp,uAltoPx,uViento;
varying float vLado,vLargo,vBrillo;
float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
void main(){
  float id=aDato.x,a=h11(id*1.31+.17),b=h11(id*2.77+.31),c=h11(id*4.13+.71),d=h11(id*5.91+.93);
  float z=mix(-9.,uDist-1.2,a),prof=uDist-z,hh=prof*uTan*1.15,hw=hh*uAsp*1.1;
  float vel=13.+6.*c,y=hh-mod(uT*vel+d*2.*hh,2.*hh);
  vec3 dir=normalize(vec3(uViento,-1.,0.)),pos=vec3((b*2.-1.)*hw-y*uViento,y,z);
  vec3 lado=normalize(cross(dir,normalize(vec3(0.,0.,uDist)-pos)));
  float ancho=2.*prof*uTan/uAltoPx*.9+.0012;
  pos-=dir*vel*.02*aDato.z;pos+=lado*ancho*aDato.y;
  vLado=aDato.y;vLargo=aDato.z;vBrillo=smoothstep(1.,4.,prof)/(1.+prof*.08);
  gl_Position=uProy*uVista*vec4(pos,1.);
}`;
  const LLUVIA_F=`precision highp float;
uniform vec3 uFlashCol;uniform float uFlash;
varying float vLado,vLargo,vBrillo;
void main(){float a=1.-abs(vLado);a*=a*(1.-.75*vLargo)*vBrillo;
  gl_FragColor=vec4((vec3(.5,.56,.66)*.085+uFlashCol*uFlash*.16)*a,0.);}`;

  function iniciar(gl){
    const shader=(tipo,src)=>{const s=gl.createShader(tipo);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const programa=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
    const pc=programa(CIELO_V,CIELO_F),pl=programa(LLUVIA_V,LLUVIA_F);
    const loc=(p,l)=>Object.fromEntries(l.map(n=>[n,gl.getUniformLocation(p,n)]));
    const uc=loc(pc,['uRes','uPar','uFlashCol','uT','uFlash','uOct','uRayoX','uRayoSem','uRayoBri']);
    const ul=loc(pl,['uVista','uProy','uT','uDist','uTan','uAsp','uAltoPx','uViento','uFlashCol','uFlash']);
    const aC=gl.getAttribLocation(pc,'aPos'),aL=gl.getAttribLocation(pl,'aDato');
    const bc=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bc);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    // Sin gl_VertexID en WebGL 1: cada vértice lleva su número de gota y su esquina.
    const esq=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]],d=new Float32Array(MAXGOTAS*18);
    for(let i=0,o=0;i<MAXGOTAS;i++)for(const [s,l]of esq){d[o++]=i;d[o++]=s;d[o++]=l;}
    const bl=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bl);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
    const cielo=e=>e.cielo||{};
    return {
      fondo(e){
        if(!(e.tormenta>0))return;const c=cielo(e);
        gl.useProgram(pc);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);
        gl.uniform2f(uc.uRes,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.uniform2fv(uc.uPar,c.par||[0,0]);
        gl.uniform3fv(uc.uFlashCol,c.flashCol||[.8,.86,1]);gl.uniform1f(uc.uT,e.tiempo);gl.uniform1f(uc.uFlash,c.flash||0);gl.uniform1f(uc.uOct,c.octavas||6);
        gl.uniform1f(uc.uRayoX,c.rayoX||0);gl.uniform1f(uc.uRayoSem,c.rayoSem||0);gl.uniform1f(uc.uRayoBri,c.rayoBri||0);
        gl.bindBuffer(gl.ARRAY_BUFFER,bc);gl.enableVertexAttribArray(aC);gl.vertexAttribPointer(aC,2,gl.FLOAT,false,0,0);
        gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(aC);
      },
      frente(e,info){
        const c=cielo(e),n=Math.min(MAXGOTAS,Math.max(0,Math.round(c.gotas||0)));
        if(!(e.tormenta>0)||!n)return;
        gl.useProgram(pl);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ZERO,gl.ONE);
        gl.uniformMatrix4fv(ul.uVista,false,info.vista);gl.uniformMatrix4fv(ul.uProy,false,info.proy);
        gl.uniform1f(ul.uT,e.tiempo);gl.uniform1f(ul.uDist,info.dist);gl.uniform1f(ul.uTan,Math.tan(info.fov/2));gl.uniform1f(ul.uAsp,info.w/info.h);
        gl.uniform1f(ul.uAltoPx,gl.drawingBufferHeight);gl.uniform1f(ul.uViento,c.viento??.18);
        gl.uniform3fv(ul.uFlashCol,c.flashCol||[.8,.86,1]);gl.uniform1f(ul.uFlash,c.flash||0);
        gl.bindBuffer(gl.ARRAY_BUFFER,bl);gl.enableVertexAttribArray(aL);gl.vertexAttribPointer(aL,3,gl.FLOAT,false,0,0);
        gl.drawArrays(gl.TRIANGLES,0,n*6);gl.disableVertexAttribArray(aL);
      },
      destruir(){gl.deleteBuffer(bc);gl.deleteBuffer(bl);gl.deleteProgram(pc);gl.deleteProgram(pl);},
    };
  }
  window.CAOZ_TORMENTA_GL=Object.freeze({iniciar,MAXGOTAS});
})();

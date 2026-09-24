/* Carta del visor 3D en WebGL, sin dependencias: grosor real, relieve con normal
   map, metal y rugosidad por zona, laca, reflejos de un estudio procedural, una
   luz que sigue al puntero desde un costado y película holográfica con
   destellos según el ángulo. Las texturas las pinta carta-pintor.js; la pose y
   el tiempo los decide visor-3d.js en cada fotograma. Si WebGL no está
   disponible, crear() devuelve null y el visor sigue con sus capas CSS. */
'use strict';
(function(){
  const ANCHO=2.5,ALTO=3.5,RADIO=.13,GROSOR=.035,FOV=30*Math.PI/180;
  // Holo y destellos por edición (la máscara decide dónde).
  const EDICION={normal:{holo:.12,destellos:.25,laca:.55},foil:{holo:.7,destellos:.8,laca:.7},dorado:{holo:.55,destellos:.9,laca:.75}};

  const VERT=`attribute vec3 aPos;attribute vec3 aNor;attribute vec2 aUv;
uniform mat4 uModel,uVista,uProy;uniform mat3 uRot;
varying vec3 vPos;varying vec3 vNor;varying vec2 vUv;
void main(){vec4 w=uModel*vec4(aPos,1.);vPos=w.xyz;vNor=uRot*aNor;vUv=aUv;gl_Position=uProy*uVista*w;}`;
  const FRAG=`precision highp float;
uniform sampler2D uColor,uNormal,uOrm,uMascara;
uniform float uUsaOrm,uUsaMascara,uCanto,uMetal,uRugosidad,uRelieve,uHolo,uDestellos,uLaca,uTiempo,uPulso;
uniform vec3 uCam,uT,uB,uLuzDir,uLuzCol,uPuntoPos,uPuntoCol,uCantoCol;
varying vec3 vPos;varying vec3 vNor;varying vec2 vUv;
vec3 tono(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
float azar(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 estudio(vec3 r){
  vec3 c=mix(vec3(.09,.075,.1),vec3(.62,.56,.6),smoothstep(-.8,.9,r.y));
  c+=vec3(1.,.93,.8)*3.2*pow(max(0.,dot(r,normalize(vec3(.6,.55,.58)))),18.);
  c+=vec3(.75,.8,1.)*1.1*pow(max(0.,dot(r,normalize(vec3(-.75,.2,.55)))),6.);
  c+=vec3(.9,.72,.5)*.45*pow(max(0.,dot(r,normalize(vec3(0.,-.9,.35)))),3.);
  c+=uPuntoCol*.3*pow(max(0.,dot(r,normalize(uPuntoPos-vPos))),14.);
  return c;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 luz(vec3 N,vec3 V,vec3 L,vec3 col,vec3 albedo,vec3 F0,float rug){
  float d=max(dot(N,L),0.);vec3 H=normalize(L+V);float e=mix(700.,5.,rug);
  float s=pow(max(dot(N,H),0.),e)*(e+8.)/25.13;return col*d*(albedo+F0*s);
}
void main(){
  vec3 Ng=normalize(vNor),N=Ng,base;float rug=uRugosidad,met=uMetal;
  if(uCanto>.5){base=uCantoCol;}
  else{
    base=pow(texture2D(uColor,vUv).rgb,vec3(2.2));
    vec3 nt=texture2D(uNormal,vUv).xyz*2.-1.;nt.xy*=uRelieve;
    N=normalize(uT*nt.x+uB*nt.y+Ng*nt.z);
    if(uUsaOrm>.5){vec3 o=texture2D(uOrm,vUv).rgb;rug=o.g;met=o.b;}
  }
  vec3 V=normalize(uCam-vPos),albedo=base*(1.-met),F0=mix(vec3(.04),base,met);
  vec3 c=albedo*.24;
  c+=luz(N,V,normalize(uLuzDir),uLuzCol,albedo,F0,rug);
  vec3 Lp=uPuntoPos-vPos;float dp=length(Lp);c+=luz(N,V,Lp/dp,uPuntoCol/(1.+dp*dp*.06),albedo,F0,rug);
  float fr=pow(1.-max(dot(N,V),0.),5.);vec3 F=F0+(1.-F0)*fr;
  c+=estudio(reflect(-V,N))*F*mix(1.,.35,rug);
  // Laca: capa lisa sobre lo impreso, con la normal de la cara.
  float fc=.04+.96*pow(1.-max(dot(Ng,V),0.),5.);
  c+=estudio(reflect(-V,Ng))*fc*uLaca*.6*(1.-met);
  if(uUsaMascara>.5){
    vec4 m=texture2D(uMascara,vUv);
    vec2 inc=vec2(dot(V,uT),dot(V,uB));
    float lum=dot(base,vec3(.3,.59,.11));
    float banda=(vUv.x*.9+vUv.y*1.3)*1.5+inc.x*2.8-inc.y*2.2+m.b*.35;
    vec3 arco=mix(vec3(1.),tono(fract(banda)),.8);
    float foil=m.r*mix(1.,.4,sqrt(lum))*(.6+.4*m.b)*clamp(length(inc)*2.4,.2,1.);
    c+=arco*foil*uHolo*.16;
    vec2 g=vUv*vec2(64.,90.),id=floor(g),f=fract(g)-.5;float r=azar(id);
    vec2 off=vec2(azar(id+3.1),azar(id+7.7))-.5;
    float tw=pow(.5+.5*sin(r*90.+inc.x*45.+inc.y*32.+uTiempo*1.3),28.);
    c+=vec3(1.,.96,.88)*smoothstep(.2,0.,length(f-off*.6))*step(.78,r)*tw*m.g*uDestellos*1.2;
    c+=arco*uPulso*.12*m.r;
  }
  c=aces(c*.92);
  gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);
}`;

  // Matrices 4×4 por columnas.
  const mat={
    identidad:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
    mult(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;},
    persp(fov,asp,n,f){const t=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;},
    mover(x,y,z){const o=mat.identidad();o[12]=x;o[13]=y;o[14]=z;return o;},
    escala(s){const o=mat.identidad();o[0]=o[5]=o[10]=s;return o;},
    rx(a){const c=Math.cos(a),s=Math.sin(a),o=mat.identidad();o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o;},
    ry(a){const c=Math.cos(a),s=Math.sin(a),o=mat.identidad();o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o;},
    rz(a){const c=Math.cos(a),s=Math.sin(a),o=mat.identidad();o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o;},
    rot3(m){return new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]);},
    aplicar(m,v){return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]];},
  };

  // Contorno redondeado, caras (abanico) y canto (tira) de la carta.
  function contorno(){
    const p=[],seg=8,x=ANCHO/2-RADIO,y=ALTO/2-RADIO;
    for(const [cx,cy,a0] of [[x,-y,-Math.PI/2],[x,y,0],[-x,y,Math.PI/2],[-x,-y,Math.PI]])
      for(let i=0;i<=seg;i++){const a=a0+i/seg*Math.PI/2;p.push([cx+Math.cos(a)*RADIO,cy+Math.sin(a)*RADIO,Math.cos(a),Math.sin(a)]);}
    return p;
  }
  function geometria(){
    const p=contorno(),cara=(z,nz,espejo)=>{
      const v=[];const uv=(x,y)=>[espejo?1-(x/ANCHO+.5):x/ANCHO+.5,y/ALTO+.5];
      for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],tri=nz>0?[[0,0],a,b]:[[0,0],b,a];for(const q of tri)v.push(q[0],q[1],z,0,0,nz,...uv(q[0],q[1]));}
      return new Float32Array(v);
    };
    const canto=[];
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],z=GROSOR/2;
      for(const [q,zz] of [[a,z],[a,-z],[b,-z],[a,z],[b,-z],[b,z]])canto.push(q[0],q[1],zz,q[2],q[3],0,0,0);}
    return {frente:cara(GROSOR/2,1,false),dorso:cara(-GROSOR/2,-1,true),canto:new Float32Array(canto)};
  }

  function crear(canvas){
    let gl=null,dos=false;
    const op={alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'high-performance'};
    try{gl=canvas.getContext('webgl2',op);dos=!!gl;if(!gl)gl=canvas.getContext('webgl',op);}catch(_){gl=null;}
    if(!gl)return null;
    const shader=(tipo,src)=>{const s=gl.createShader(tipo);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    let prog;
    try{prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VERT));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));}catch(e){console.warn('Visor 3D sin WebGL:',e.message);return null;}
    gl.useProgram(prog);
    const u={};for(const n of ['uModel','uVista','uProy','uRot','uColor','uNormal','uOrm','uMascara','uUsaOrm','uUsaMascara','uCanto','uMetal','uRugosidad','uRelieve','uHolo','uDestellos','uLaca','uTiempo','uPulso','uCam','uT','uB','uLuzDir','uLuzCol','uPuntoPos','uPuntoCol','uCantoCol'])u[n]=gl.getUniformLocation(prog,n);
    const a={pos:gl.getAttribLocation(prog,'aPos'),nor:gl.getAttribLocation(prog,'aNor'),uv:gl.getAttribLocation(prog,'aUv')};
    const geo=geometria(),bufs={};
    for(const [k,d]of Object.entries(geo)){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);bufs[k]={b,n:d.length/8};}
    const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
    function textura(fuente,srgb){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,fuente);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      if(dos){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
      else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return t;
    }
    const liberar=o=>{if(o)for(const t of Object.values(o))if(t)gl.deleteTexture(t);};
    let frente=null,dorso=null,edicion='normal',canto=[.7,.55,.3],w=1,h=1,altoCarta=400;

    function cargarFrente(tex,ed,colorCanto){
      liberar(frente);edicion=ed;frente={color:textura(tex.color),normal:textura(tex.normal),orm:textura(tex.orm),mascara:textura(tex.mascara)};
      if(colorCanto){const n=parseInt(colorCanto.slice(1),16);canto=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(v=>Math.pow(v,2.2));}
    }
    function cargarDorso(tex){liberar(dorso);dorso={color:textura(tex.color),normal:textura(tex.normal)};}
    function medir(anchoPx,altoPx,dpr,cartaPx){w=anchoPx;h=altoPx;altoCarta=cartaPx;canvas.width=Math.round(anchoPx*dpr);canvas.height=Math.round(altoPx*dpr);}
    function atributos(buf){
      gl.bindBuffer(gl.ARRAY_BUFFER,buf.b);const s=32;
      gl.enableVertexAttribArray(a.pos);gl.vertexAttribPointer(a.pos,3,gl.FLOAT,false,s,0);
      gl.enableVertexAttribArray(a.nor);gl.vertexAttribPointer(a.nor,3,gl.FLOAT,false,s,12);
      gl.enableVertexAttribArray(a.uv);gl.vertexAttribPointer(a.uv,2,gl.FLOAT,false,s,24);
    }
    function usar(unidad,tex,nombre){gl.activeTexture(gl.TEXTURE0+unidad);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(u[nombre],unidad);}
    function carta(model,pintarFrente){
      gl.uniformMatrix4fv(u.uModel,false,model);gl.uniformMatrix3fv(u.uRot,false,mat.rot3(model));
      const ed=EDICION[edicion]||EDICION.normal;
      // Canto: metal liso del color de la edición.
      gl.uniform1f(u.uCanto,1);gl.uniform1f(u.uUsaOrm,0);gl.uniform1f(u.uUsaMascara,0);gl.uniform1f(u.uMetal,.9);gl.uniform1f(u.uRugosidad,.32);gl.uniform1f(u.uLaca,0);
      gl.uniform3fv(u.uCantoCol,canto);atributos(bufs.canto);gl.drawArrays(gl.TRIANGLES,0,bufs.canto.n);
      gl.uniform1f(u.uCanto,0);
      // Dorso.
      gl.uniform3fv(u.uT,mat.aplicar(model,[-1,0,0]));gl.uniform3fv(u.uB,mat.aplicar(model,[0,1,0]));
      usar(0,dorso.color,'uColor');usar(1,dorso.normal,'uNormal');gl.uniform1f(u.uRelieve,.6);
      gl.uniform1f(u.uMetal,.3);gl.uniform1f(u.uRugosidad,.42);gl.uniform1f(u.uLaca,.6);
      atributos(bufs.dorso);gl.drawArrays(gl.TRIANGLES,0,bufs.dorso.n);
      // Frente.
      gl.uniform3fv(u.uT,mat.aplicar(model,[1,0,0]));gl.uniform3fv(u.uB,mat.aplicar(model,[0,1,0]));
      usar(0,frente.color,'uColor');usar(1,frente.normal,'uNormal');usar(2,frente.orm,'uOrm');usar(3,frente.mascara,'uMascara');
      gl.uniform1f(u.uUsaOrm,1);gl.uniform1f(u.uRelieve,.9);gl.uniform1f(u.uLaca,ed.laca);
      gl.uniform1f(u.uUsaMascara,pintarFrente?1:0);gl.uniform1f(u.uHolo,ed.holo);gl.uniform1f(u.uDestellos,ed.destellos);
      atributos(bufs.frente);gl.drawArrays(gl.TRIANGLES,0,bufs.frente.n);
    }
    // e: {rx,ry,rz,y,s,tiempo,luzX,luzY,pulso,pila}. Ángulos como en el CSS del visor.
    function dibujar(e){
      if(!frente||!dorso)return false;
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.useProgram(prog);
      // Cámara a la distancia en que la carta mide lo mismo que en el CSS.
      const dist=ALTO*h/(altoCarta*2*Math.tan(FOV/2)),cam=[0,0,dist];
      gl.uniformMatrix4fv(u.uProy,false,mat.persp(FOV,w/h,.1,dist*4));
      gl.uniformMatrix4fv(u.uVista,false,mat.mover(0,0,-dist));
      gl.uniform3fv(u.uCam,cam);
      gl.uniform3fv(u.uLuzDir,[-.35,.55,.75]);gl.uniform3fv(u.uLuzCol,[.95,.9,.84]);
      gl.uniform3fv(u.uPuntoPos,[1.7+e.luzX*2.2,1.7-e.luzY*1.8,2.6]);gl.uniform3fv(u.uPuntoCol,[2.2+e.pulso*4,2.+e.pulso*4,1.75+e.pulso*3]);
      gl.uniform1f(u.uTiempo,e.tiempo);gl.uniform1f(u.uPulso,e.pulso);
      const px=ALTO/altoCarta;
      const base=mat.mult(mat.mult(mat.mult(mat.mult(mat.mover(0,-e.y*px,0),mat.escala(e.s)),mat.rx(-e.rx)),mat.ry(e.ry)),mat.rz(-e.rz));
      for(let i=Math.min(4,e.pila||0);i>=1;i--){
        const m=mat.mult(base,mat.mult(mat.mover(i*.045,-i*.035,-i*(GROSOR+.03)),mat.rz((i%2?1:-1)*(.012+i*.008))));
        carta(m,false);
      }
      carta(base,true);
      return true;
    }
    function destruir(){liberar(frente);liberar(dorso);for(const b of Object.values(bufs))gl.deleteBuffer(b.b);gl.deleteProgram(prog);gl.getExtension('WEBGL_lose_context')?.loseContext();}
    return {cargarFrente,cargarDorso,medir,dibujar,destruir,listo:()=>!!(frente&&dorso)};
  }
  window.CAOZ_VISOR3D_GL=Object.freeze({crear});
})();

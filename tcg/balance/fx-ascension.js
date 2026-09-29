/* Ascensión de Petunia: la carta muere y se queda gris, cae un rayo de luz
   dorada, la carta gira en 3D envuelta en oro y la nueva cara (Petunia
   Sagrada) se va revelando de arriba abajo con el disolvente del quemado al
   revés; detrás se abren alas de luz y caen plumas.
   Prueba aislada (dev/secciones/fuego): recibe el nodo de la carta y las dos
   caras (imagen o lienzo) y sólo dibuja. El rayo y la carta van en WebGL (la
   carta, con textura en perspectiva); las alas, las plumas y las chispas, en
   dos Canvas 2D (detrás y delante). Sin dependencias; reloj propio. */
'use strict';
(function(){
  const TAU=Math.PI*2;
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const suave=t=>{t=acotar(t);return t*t*(3-2*t);};
  const salida=t=>1-Math.pow(1-acotar(t),3);
  const entre=(t,a,b)=>acotar((t-a)/(b-a));
  const vaiven=t=>{t=acotar(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};

  // El mismo ruido en JS y en GLSL: las chispas nacen donde el shader revela.
  function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
  function ruido(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
  function fbm(x,y){let v=0,a=.5;for(let i=0;i<4;i++){v+=a*ruido(x,y);x=x*2.03+1.7;y=y*2.03+9.2;a*=.5;}return v;}
  const ORIGEN=[.5,-.08];
  function frente(u,v){return Math.hypot(u-ORIGEN[0],(v-ORIGEN[1])*1.35)*.85+fbm(u*4.5,v*6)*.42;}

  const VERT=`attribute vec2 aPos;attribute vec3 aUv;uniform vec2 uRes;varying vec3 vUv;varying vec2 vPx;
void main(){vUv=aUv;vPx=aPos;vec2 c=aPos/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);}`;
  const FRAG=`precision highp float;
varying vec3 vUv;varying vec2 vPx;
uniform float uModo,uTiempo,uPotencia,uAvance,uGris,uOro,uUmbral,uFase,uCara;uniform vec3 uRayo;
uniform sampler2D uViejo,uNuevo;
const vec3 ORO=vec3(1.,.74,.3),CLARO=vec3(1.,.96,.84);
float hash(vec2 p){return fract(sin(p.x*127.1+p.y*311.7)*43758.5453);}
float ruido(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*ruido(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  if(uModo<.5){
    // El rayo: una columna de luz que baja desde arriba hasta la carta (uRayo:
    // centro x, fondo y, ancho); rayos verticales que corren hacia abajo y una
    // cabeza brillante donde va el frente (uAvance, 0 arriba → 1 en la carta).
    float s=clamp(vPx.y/uRayo.y,0.,1.2),w=mix(uRayo.z*.42,uRayo.z*.78,clamp(s,0.,1.));
    float d=abs(vPx.x-uRayo.x)/w;if(d>2.2)discard;
    float rayos=pow(fbm(vec2((vPx.x-uRayo.x)/uRayo.z*9.,vPx.y/uRayo.y*1.2-uTiempo*1.6)),1.6)*1.8;
    float perfil=exp(-d*d*1.5),nucleo=exp(-d*d*12.)*.55;
    float encendido=1.-smoothstep(uAvance-.03,uAvance+.02,s),cabeza=exp(-pow((s-uAvance)*12.,2.))*step(uAvance,1.02);
    float f=(perfil*(.18+rayos*.7)+nucleo)*encendido+cabeza*perfil*1.3;
    f*=uPotencia*(1.-smoothstep(1.,1.15,s));
    vec3 col=mix(ORO,CLARO,clamp(nucleo*1.4+cabeza*.8,0.,1.));
    gl_FragColor=vec4(col*f,clamp(f,0.,1.));
  }else{
    // La carta, con textura en perspectiva (vUv.xy/vUv.z). Por delante: la cara
    // vieja gris y dorada (uFase 0) o el oro que va dejando ver la nueva desde
    // arriba (uFase 1, uUmbral); por detrás, sólo oro.
    vec2 uv=vUv.xy/vUv.z;
    vec4 a=texture2D(uViejo,uv),b=texture2D(uNuevo,uv);
    float brillo=fbm(uv*vec2(5.,7.)+vec2(0.,-uTiempo*1.3));
    // El oro conserva el relieve de la carta: su luz sale de la luminancia.
    vec3 oro=mix(ORO,CLARO,.25+brillo*.5)*(.8+.3*brillo);
    float l=dot(a.rgb,vec3(.3,.59,.11));
    vec3 viejo=mix(a.rgb,vec3(l)*vec3(.9,.93,1.),uGris);
    viejo=mix(viejo,ORO*.5+CLARO*l*.75,uOro*.9);
    float fr=length((uv-vec2(.5,-.08))*vec2(1.,1.35))*.85+fbm(vec2(uv.x*4.5,uv.y*6.))*.42;
    float e=uUmbral-fr,borde=1.-smoothstep(0.,.055,abs(e));
    float lb=dot(b.rgb,vec3(.3,.59,.11));
    vec3 nuevo=mix(oro*(.4+.9*lb),b.rgb,smoothstep(0.,.05,e))+CLARO*borde*1.4;
    vec3 col=uCara>.5?mix(viejo,nuevo,uFase):oro*(.45+.8*l);
    float alfa=uCara>.5?mix(a.a,max(a.a,b.a),uFase):a.a;
    gl_FragColor=vec4(col,alfa);
  }
}`;

  function crearGL(canvas){
    const gl=canvas.getContext('webgl',{premultipliedAlpha:false,alpha:true,antialias:true});if(!gl)return null;
    const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(o));return o;};
    const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
    const U={};for(const n of ['uRes','uModo','uTiempo','uPotencia','uAvance','uGris','uOro','uUmbral','uFase','uCara','uRayo','uViejo','uNuevo'])U[n]=gl.getUniformLocation(p,n);
    const buf=gl.createBuffer(),aPos=gl.getAttribLocation(p,'aPos'),aUv=gl.getAttribLocation(p,'aUv');
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(aPos);gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,20,0);gl.vertexAttribPointer(aUv,3,gl.FLOAT,false,20,8);
    const texturas=[0,1].map(i=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);
      for(const [k,v]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t;});
    gl.uniform1i(U.uViejo,0);gl.uniform1i(U.uNuevo,1);
    const dibujar=v=>{gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,6);};
    return {
      texturas(vieja,nueva){for(const [i,img]of [[0,vieja],[1,nueva]]){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texturas[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);}},
      empezar(W,H,tiempo){gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.uniform2f(U.uRes,W,H);gl.uniform1f(U.uTiempo,tiempo);},
      rayo(cx,fondo,ancho,avance,potencia){if(potencia<=.001)return;gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.uniform1f(U.uModo,0);gl.uniform1f(U.uPotencia,potencia);gl.uniform1f(U.uAvance,avance);gl.uniform3f(U.uRayo,cx,fondo,ancho);
        const x0=cx-ancho*1.2,x1=cx+ancho*1.2,y1=fondo*1.15;dibujar([x0,0,0,0,1, x1,0,0,0,1, x0,y1,0,0,1, x1,0,0,0,1, x1,y1,0,0,1, x0,y1,0,0,1]);},
      // Gira sobre su eje vertical (angulo) con perspectiva; w=1/profundidad.
      carta(c,angulo,e){gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1f(U.uModo,1);
        for(const n of ['uGris','uOro','uUmbral','uFase'])gl.uniform1f(U[n],e[n]);
        const co=Math.cos(angulo),si=Math.sin(angulo),f=c.h*3.2;gl.uniform1f(U.uCara,co>=0?1:0);
        const borde=lado=>{const s=f/(f+lado*c.w/2*si);return {x:c.x+lado*c.w/2*co*s,a:c.y-c.h/2*s,b:c.y+c.h/2*s,s};};
        const L=borde(-1),R=borde(1),v=(p,y,u,t)=>[p.x,y,u*p.s,t*p.s,p.s];
        dibujar([...v(L,L.a,0,0),...v(R,R.a,1,0),...v(L,L.b,0,1),...v(R,R.a,1,0),...v(R,R.b,1,1),...v(L,L.b,0,1)]);},
      destruir(){for(const t of texturas)gl.deleteTexture(t);gl.deleteBuffer(buf);gl.deleteProgram(p);gl.getExtension('WEBGL_lose_context')?.loseContext();}
    };
  }

  function sprite(tam=64){const c=document.createElement('canvas');c.width=c.height=tam;const g=c.getContext('2d'),m=tam/2,d=g.createRadialGradient(m,m,0,m,m,m);
    d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.25,'rgba(255,214,120,.8)');d.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=d;g.fillRect(0,0,tam,tam);return c;}

  // Un ala de luz como las de un ángel: un brazo sube desde el hombro hacia
  // fuera y de él cuelgan tres filas de plumas (remeras largas hacia la punta,
  // secundarias y coberteras). lado ±1; abrir 0 (plegada) → 1 (extendida).
  function ala(g,x,y,lado,abrir,alto,t,alfa){
    if(abrir<=.01||alfa<=.01)return;
    const tramo=alto*.62*(.25+.75*abrir),bate=Math.sin(t*3)*.06*abrir;
    const brazo=k=>[x+lado*tramo*.9*k,y-tramo*(.62+bate)*Math.sin(k*Math.PI*.62)];
    const [cx,cy]=brazo(.55),halo=g.createRadialGradient(cx,cy,0,cx,cy,tramo*.9);
    halo.addColorStop(0,'rgba(255,225,150,'+.28*alfa+')');halo.addColorStop(1,'rgba(255,200,100,0)');g.fillStyle=halo;g.fillRect(cx-tramo,cy-tramo,tramo*2,tramo*2);
    for(const [n,largo,ancho,luz,desde]of [[12,1,.2,.4,.05],[9,.62,.26,.5,0],[8,.3,.4,.7,0]]){
      for(let i=n-1;i>=0;i--){
        const k=desde+(1-desde)*i/(n-1),[px,py]=brazo(k);
        // Hacia dentro cuelgan; hacia la punta se abren hacia fuera y arriba.
        const a=(178-k*(largo>.9?118:95))*abrir+176*(1-abrir)+Math.sin(t*3.4+k*3)*3*abrir,r=a*Math.PI/180;
        const L=tramo*largo*(.45+.55*Math.pow(k,.8)),dx=lado*Math.sin(r),dy=-Math.cos(r),nx=-dy,ny=dx,w=L*ancho;
        const tx=px+dx*L,ty=py+dy*L,gr=g.createLinearGradient(px,py,tx,ty);
        gr.addColorStop(0,'rgba(255,248,222,'+luz*alfa+')');gr.addColorStop(.6,'rgba(255,212,120,'+luz*.7*alfa+')');gr.addColorStop(1,'rgba(255,190,80,0)');
        g.fillStyle=gr;g.beginPath();g.moveTo(px-nx*w*.3,py-ny*w*.3);
        g.quadraticCurveTo(px+dx*L*.5+nx*w,py+dy*L*.5+ny*w,tx,ty);
        g.quadraticCurveTo(px+dx*L*.55-nx*w*.6,py+dy*L*.55-ny*w*.6,px-nx*w*.3,py-ny*w*.3);g.fill();
      }
    }
  }
  function pluma(g,p,alfa){
    g.save();g.translate(p.x,p.y);g.rotate(p.rot);g.globalAlpha=alfa;
    const gr=g.createLinearGradient(0,-p.l/2,0,p.l/2);gr.addColorStop(0,'rgba(255,255,245,.95)');gr.addColorStop(1,'rgba(255,200,110,.35)');
    g.fillStyle=gr;g.beginPath();g.moveTo(0,-p.l/2);g.quadraticCurveTo(p.l*.3,-p.l*.1,0,p.l/2);g.quadraticCurveTo(-p.l*.24,-p.l*.05,0,-p.l/2);g.fill();
    g.strokeStyle='rgba(255,236,190,.9)';g.lineWidth=Math.max(.6,p.l*.04);g.beginPath();g.moveTo(0,-p.l*.45);g.lineTo(0,p.l*.62);g.stroke();g.restore();
  }

  /* ASCENSIÓN · ascender(host,{objetivo,imagen,imagenNueva,alRevelar,restaurar,velocidad,reducir,reloj})
     objetivo: el nodo de la carta (se oculta mientras dura); imagen: su cara
     (por defecto, su .cjCara o su lienzo); imagenNueva: la cara de la carta en
     la que renace. alRevelar() se llama en cuanto la nueva cara está entera,
     para que quien llama la ponga en el DOM; al acabar se devuelve la
     visibilidad al objetivo (salvo restaurar:false) y la promesa se cumple con
     true. Sin WebGL, sin caras o con movimiento reducido devuelve false sin
     hacer nada: quien llama cambia la carta directamente. */
  function ascender(host,o){
    const obj=o.objetivo,vel=o.velocidad||1;
    const consulta=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reducir=o.reducir??!!consulta?.matches;
    const cara=o.imagen||obj?.querySelector?.(':scope > .cjCara, :scope > canvas'),nueva=o.imagenNueva;
    const lista=i=>i&&(i.tagName!=='IMG'||(i.complete&&i.naturalWidth));
    if(!obj||reducir||document.hidden||!lista(cara)||!lista(nueva))return Promise.resolve(false);
    const capa=z=>{const c=document.createElement('canvas');c.className='fxAscensionCapa';c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;host.append(c);return c;};
    const detras=capa(19),lienzoGL=capa(20);let gl=null;try{gl=crearGL(lienzoGL);}catch(_){gl=null;}
    if(!gl){detras.remove();lienzoGL.remove();return Promise.resolve(false);}
    try{gl.texturas(cara,nueva);}catch(_){gl.destruir();detras.remove();lienzoGL.remove();return Promise.resolve(false);}
    const delante=capa(21),gd=detras.getContext('2d'),g=delante.getContext('2d'),chispa=sprite();
    const hr=host.getBoundingClientRect(),W=hr.width,H=hr.height,dpr=Math.min(devicePixelRatio||1,2);
    for(const c of [detras,lienzoGL,delante]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}
    const r0=obj.getBoundingClientRect(),C={x:r0.left-hr.left+r0.width/2,y:r0.top-hr.top+r0.height/2,w:r0.width,h:r0.height};
    const puntos=Array.from({length:900},()=>{const u=Math.random(),v=Math.random();return {u,v,f:frente(u,v)};}).sort((a,b)=>a.f-b.f);
    const umbralDe=q=>q<=0?-1:q>=1?9:puntos[Math.min(puntos.length-1,Math.floor(q*puntos.length))].f;
    const plumas=[],chispas=[],escala=C.w/180;let hecha=0,revelada=false,plumasEchadas=0;
    obj.style.visibility='hidden';
    return new Promise(resolve=>{
      let t0=0,antes=-1,raf=0,fin=false;
      const revelar=()=>{if(revelada)return;revelada=true;try{o.alRevelar?.();}catch(_){}};
      const terminar=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);clearTimeout(seguro);revelar();gl.destruir();for(const c of [detras,lienzoGL,delante])c.remove();
        if(o.restaurar!==false)obj.style.visibility='';resolve(true);};
      const seguro=setTimeout(terminar,7000/vel);
      function cuadro(ahora){
        raf=0;if(fin)return;if(!t0)t0=ahora;
        const tt=typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*vel,dt=antes<0?0:Math.min(.1,Math.max(0,tt-antes));antes=tt;
        // Muere y se agrisa (0–0,55 s); cae el rayo (0,35–0,85); se dora (0,8–1,15);
        // gira dos vueltas (1,05–2,05); se revela (2–2,9); alas (1,95–3,7).
        const gris=suave(entre(tt,0,.55)),avance=salida(entre(tt,.35,.85)),rayo=suave(entre(tt,.3,.5))*(1-suave(entre(tt,2.6,3.3)));
        const oro=suave(entre(tt,.8,1.15)),giro=vaiven(entre(tt,1.05,2.05)),revela=entre(tt,2,2.9);
        const sube=Math.sin(Math.PI*entre(tt,1,2.25)),abrir=salida(entre(tt,1.95,2.6)),alas=1-suave(entre(tt,3.1,3.7));
        const hunde=tt<.55?gris*.03:.03*(1-entre(tt,.55,1.05));
        const c={x:C.x,y:C.y-C.h*.1*sube,w:C.w*(1+.08*sube-hunde),h:C.h*(1+.08*sube-hunde)};
        const angulo=giro*TAU*2,fase=giro>=.5?1:0,destello=Math.exp(-Math.pow((tt-.85)*9,2))+Math.exp(-Math.pow((tt-2.02)*8,2))*.8;
        gl.empezar(W,H,tt);
        gl.rayo(C.x,c.y+c.h*.5,C.w*1.25,avance,rayo*(1+destello*.6));
        const umbral=umbralDe(revela);
        gl.carta(c,angulo,{uGris:gris,uOro:oro*(1-fase),uUmbral:fase?umbral:-1,uFase:fase});
        if(revela>=1)revelar();
        // Detrás: halo, el anillo al renacer y las alas.
        gd.setTransform(dpr,0,0,dpr,0,0);gd.clearRect(0,0,W,H);gd.globalCompositeOperation='lighter';
        const halo=(oro*.6+destello*.5+abrir*.5)*alas*(1-fase*.2);
        if(halo>.01){const r=c.h*.85,gr=gd.createRadialGradient(c.x,c.y,r*.25,c.x,c.y,r);gr.addColorStop(0,'rgba(255,220,140,'+.55*halo+')');gr.addColorStop(1,'rgba(255,200,100,0)');gd.fillStyle=gr;gd.fillRect(c.x-r,c.y-r,r*2,r*2);}
        const anillo=entre(tt,2,2.7);
        if(anillo>0&&anillo<1){const rr=c.w*(.4+anillo*1.3);gd.strokeStyle='rgba(255,230,160,'+(1-anillo)*.8+')';gd.lineWidth=(1-anillo)*10*escala+1;gd.beginPath();gd.ellipse(c.x,c.y+c.h*.3,rr,rr*.3,0,0,TAU);gd.stroke();}
        for(const lado of [-1,1])ala(gd,c.x+lado*c.w*.22,c.y-c.h*.18,lado,abrir,c.h,tt,alas);
        gd.globalCompositeOperation='source-over';
        // Delante: chispas donde se revela y plumas que caen.
        g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);g.globalCompositeOperation='lighter';
        if(fase)while(hecha<puntos.length&&puntos[hecha].f<umbral){const q=puntos[hecha++];if(Math.random()<.12)chispas.push({x:c.x+(q.u-.5)*c.w,y:c.y+(q.v-.5)*c.h,vx:(Math.random()-.5)*50,vy:-30-Math.random()*70,t:0,vida:.5+Math.random()*.6,r:(1.6+Math.random()*2.4)*escala});}
        if(oro>.1&&!fase&&Math.random()<.6)chispas.push({x:c.x+(Math.random()-.5)*c.w,y:c.y+(Math.random()-.2)*c.h*.6,vx:(Math.random()-.5)*20,vy:-50-Math.random()*60,t:0,vida:.7+Math.random()*.5,r:(1.4+Math.random()*2)*escala});
        const deben=Math.floor(28*entre(tt,2,3.1));
        while(plumasEchadas<deben){plumasEchadas++;const lado=Math.random()<.5?-1:1;
          plumas.push({x:c.x+lado*c.w*(.3+Math.random()*.9),y:c.y-c.h*(.2+Math.random()*.5),vx:lado*(10+Math.random()*30),vy:10+Math.random()*25,rot:(Math.random()-.5)*2,vr:(Math.random()-.5)*2.4,fase:Math.random()*TAU,t:0,vida:1.4+Math.random()*1.1,l:(9+Math.random()*9)*escala});}
        for(let i=chispas.length-1;i>=0;i--){const p=chispas[i];p.t+=dt;if(p.t>=p.vida){chispas.splice(i,1);continue;}
          p.x+=p.vx*dt;p.y+=p.vy*dt;g.globalAlpha=1-p.t/p.vida;g.drawImage(chispa,p.x-p.r*2,p.y-p.r*2,p.r*4,p.r*4);}
        g.globalAlpha=1;
        for(let i=plumas.length-1;i>=0;i--){const p=plumas[i];p.t+=dt;if(p.t>=p.vida){plumas.splice(i,1);continue;}
          p.vx+=Math.sin(p.t*2.6+p.fase)*40*dt;p.vx*=1-.8*dt;p.vy=Math.min(p.vy+22*dt,48);p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=(p.vr+Math.cos(p.t*2.6+p.fase)*.8)*dt;
          const a=Math.min(1,p.t*4)*(1-entre(p.t,p.vida*.6,p.vida));pluma(g,p,a);}
        g.globalCompositeOperation='source-over';g.globalAlpha=1;
        if(tt>=3.7&&!plumas.length&&!chispas.length){terminar();return;}
        raf=requestAnimationFrame(cuadro);
      }
      raf=requestAnimationFrame(cuadro);
    });
  }

  window.CAOZ_FX_ASCENSION=Object.freeze({ascender,frente});
})();

/* Aliento de fuego: la carta que ataca se envuelve en llamas, escupe un chorro
   hacia su objetivo y el objetivo arde desde el impacto hasta volverse ceniza.
   Prueba aislada (dev/secciones/fuego): recibe dos nodos del DOM con la imagen
   de cada carta y sólo dibuja. Las llamas y el quemado van en WebGL (ruido
   fbm en el shader); el chorro, las brasas y la ceniza, en un Canvas 2D con
   mezcla aditiva. Sin dependencias; su reloj es propio (requestAnimationFrame). */
'use strict';
(function(){
  const TAU=Math.PI*2;
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const suave=t=>{t=acotar(t);return t*t*(3-2*t);};
  const salida=t=>1-Math.pow(1-acotar(t),3);
  const entre=(t,a,b)=>acotar((t-a)/(b-a));
  const PALETAS={
    verde:{nucleo:[.85,1,.7],llama:[.25,1,.35],brasa:[.05,.45,.1],humo:'rgba(20,34,22,',chispa:'#9dff8a'},
    naranja:{nucleo:[1,.95,.7],llama:[1,.55,.12],brasa:[.55,.12,.02],humo:'rgba(34,24,18,',chispa:'#ffb35a'},
  };

  // Ruido de valor con el mismo hash en JS y en GLSL: la ceniza nace donde el
  // shader dibuja el frente de quemado.
  function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
  function ruido(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
  function fbm(x,y){let v=0,a=.5;for(let i=0;i<4;i++){v+=a*ruido(x,y);x=x*2.03+1.7;y=y*2.03+9.2;a*=.5;}return v;}
  // Qué tan lejos está un punto de la carta del impacto, con bordes irregulares.
  function frente(u,v,iu,iv){return Math.hypot(u-iu,(v-iv)*1.35)*.85+fbm(u*4.5,v*6)*.42;}

  const VERT=`attribute vec2 aPos;attribute vec2 aUv;uniform vec2 uRes;varying vec2 vUv;varying vec2 vPx;
void main(){vUv=aUv;vPx=aPos;vec2 c=aPos/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);}`;
  const FRAG=`precision highp float;
varying vec2 vUv;varying vec2 vPx;
uniform float uModo,uTiempo,uPotencia,uUmbral,uAlto,uAvance;uniform vec4 uRect;uniform vec2 uImpacto,uA,uB,uAncho;
uniform vec3 uNucleo,uLlama,uBrasa;uniform sampler2D uTex;
float hash(vec2 p){return fract(sin(p.x*127.1+p.y*311.7)*43758.5453);}
float ruido(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*ruido(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float caja(vec2 p,vec2 c,vec2 m,float r){vec2 q=abs(p-c)-m+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
vec3 rampa(float f){return mix(mix(uBrasa,uLlama,smoothstep(.15,.6,f)),uNucleo,smoothstep(.7,1.,f));}
void main(){
  if(uModo>1.5){
    // El chorro: un cono de fuego de la boca (uA) al impacto (uB) con jirones
    // que corren hacia delante; el frente avanza con uAvance.
    vec2 d=uB-uA;float largo=length(d);vec2 dir=d/largo,nor=vec2(-dir.y,dir.x);
    vec2 r=vPx-uA;float s=dot(r,dir)/largo,p=dot(r,nor);
    if(s<0.||s>uAvance+.08)discard;
    float ancho=mix(uAncho.x,uAncho.y,s)*(1.+.25*sin(s*18.-uTiempo*14.));
    vec2 q=vec2(s*largo/ancho*.35-uTiempo*5.,p/ancho*1.6);
    float n=fbm(q+vec2(fbm(q*1.7+uTiempo),0.)*1.2);
    float perfil=1.-abs(p)/ancho;
    float f=clamp(perfil*(.55+n*.9),0.,1.)*smoothstep(0.,.06,s)*(1.-smoothstep(uAvance-.02,uAvance+.08,s));
    f=pow(f,1.5)*uPotencia*1.5;
    gl_FragColor=vec4(rampa(clamp(f,0.,1.))*f,clamp(f,0.,1.));
  }else if(uModo<.5){
    // Llamas alrededor de una carta: suben desde el contorno, más altas arriba.
    vec2 c=uRect.xy+uRect.zw*.5,m=uRect.zw*.5;float r=uRect.z*.05;
    float d=caja(vPx,c,m,r),alto=uRect.w;
    float arriba=clamp((c.y+m.y-vPx.y)/alto,0.,1.);
    vec2 q=vec2(vPx.x/alto*5.,vPx.y/alto*4.+uTiempo*2.6);
    vec2 w=vec2(fbm(q+vec2(0.,uTiempo*.7)),fbm(q+vec2(5.2,1.3)));
    float n=fbm(q+w*1.8);
    float alcance=alto*(.06+.62*pow(arriba,1.6))*(.25+n*1.25)*uPotencia;
    float f=d>0.?clamp(1.-d/max(alcance,1.),0.,1.):clamp(1.+d/(alto*.05),0.,1.)*.4;
    f*=smoothstep(.2,.55,n+uPotencia*.15)*uPotencia;
    f=pow(f,1.2);
    gl_FragColor=vec4(rampa(f)*f*1.4,f);
  }else{
    // La carta objetivo ardiendo: el frente avanza desde el impacto; delante,
    // un borde incandescente; detrás, carbón; más atrás, nada.
    vec4 t=texture2D(uTex,vUv);
    float frente=length((vUv-uImpacto)*vec2(1.,1.35))*.85+fbm(vec2(vUv.x*4.5,vUv.y*6.))*.42;
    float e=frente-uUmbral;
    if(e<0.)discard;
    float borde=1.-smoothstep(0.,.045,e),carbon=1.-smoothstep(.03,.14,e),chamusca=1.-smoothstep(.08,.38,e);
    vec3 col=mix(t.rgb,t.rgb*vec3(.5,.36,.22),chamusca*.75);
    col=mix(col,vec3(.05,.045,.04)+t.rgb*.06,carbon*.92);
    col=mix(col,col+uLlama*.35,uPotencia*(1.-carbon)*.4);
    col+=rampa(.55+.45*borde)*borde*2.2;
    gl_FragColor=vec4(col,t.a);
  }
}`;

  function crearGL(canvas){
    const gl=canvas.getContext('webgl',{premultipliedAlpha:false,alpha:true,antialias:true});if(!gl)return null;
    const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(o));return o;};
    const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
    const u=n=>gl.getUniformLocation(p,n),U={};for(const n of ['uRes','uModo','uTiempo','uPotencia','uUmbral','uAlto','uAvance','uRect','uImpacto','uA','uB','uAncho','uNucleo','uLlama','uBrasa','uTex'])U[n]=u(n);
    const buf=gl.createBuffer(),aPos=gl.getAttribLocation(p,'aPos'),aUv=gl.getAttribLocation(p,'aUv');
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(aPos);gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(aUv,2,gl.FLOAT,false,16,8);
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    for(const [k,v]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    gl.uniform1i(U.uTex,0);
    function quad(x,y,w,h){gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([x,y,0,0, x+w,y,1,0, x,y+h,0,1, x+w,y,1,0, x+w,y+h,1,1, x,y+h,0,1]),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,6);}
    return {
      textura(img){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);},
      empezar(W,H,dpr,pal,tiempo){gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);
        gl.uniform2f(U.uRes,W,H);gl.uniform1f(U.uTiempo,tiempo);gl.uniform3fv(U.uNucleo,pal.nucleo);gl.uniform3fv(U.uLlama,pal.llama);gl.uniform3fv(U.uBrasa,pal.brasa);},
      llamas(r,potencia){if(potencia<=.001)return;gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.uniform1f(U.uModo,0);gl.uniform1f(U.uPotencia,potencia);gl.uniform4f(U.uRect,r.x,r.y,r.w,r.h);
        const mx=r.w*.45,my=r.h*.85;quad(r.x-mx,r.y-my,r.w+mx*2,r.h+my+r.h*.2);},
      chorro(a,b,avance,potencia,ancho){if(potencia<=.001)return;gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.uniform1f(U.uModo,2);gl.uniform1f(U.uPotencia,potencia);gl.uniform1f(U.uAvance,avance);
        gl.uniform2f(U.uA,a[0],a[1]);gl.uniform2f(U.uB,b[0],b[1]);gl.uniform2f(U.uAncho,ancho[0],ancho[1]);
        const m=ancho[1]*1.4,x0=Math.min(a[0],b[0])-m,y0=Math.min(a[1],b[1])-m;quad(x0,y0,Math.abs(b[0]-a[0])+m*2,Math.abs(b[1]-a[1])+m*2);},
      quemar(r,umbral,impacto,potencia){gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1f(U.uModo,1);gl.uniform1f(U.uUmbral,umbral);gl.uniform2f(U.uImpacto,impacto[0],impacto[1]);gl.uniform1f(U.uPotencia,potencia);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);quad(r.x,r.y,r.w,r.h);},
      destruir(){gl.deleteTexture(tex);gl.deleteBuffer(buf);gl.deleteProgram(p);gl.getExtension('WEBGL_lose_context')?.loseContext();}
    };
  }

  function sprite(color,tam=64){const c=document.createElement('canvas');c.width=c.height=tam;const g=c.getContext('2d'),m=tam/2,d=g.createRadialGradient(m,m,0,m,m,m);
    d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.25,color);d.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=d;g.fillRect(0,0,tam,tam);return c;}

  // Cifra de daño flotante, como las gemas de la carta (tema-domo.css).
  let estiloPuesto=false;
  function ponerEstilo(){
    if(estiloPuesto)return;estiloPuesto=true;const st=document.createElement('style');
    st.textContent=".fxAlientoDano{position:absolute;z-index:23;transform:translate(-50%,-50%);pointer-events:none;font:900 clamp(22px,4.2vw,40px)/1 'Cinzel Domo','Cinzel',Georgia,serif;color:#9dff8a;padding:.12em .42em .16em;border-radius:999px;border:3px solid transparent;"
      +"background:radial-gradient(circle at 50% 30%,#1e4a22,#060a07 72%) padding-box,linear-gradient(135deg,#f4ffe8,#6fe86a 35%,#1d6a22 65%,#d8ffc9) border-box;-webkit-text-stroke:2px rgba(0,0,0,.6);paint-order:stroke fill;"
      +"text-shadow:0 0 16px #6fff6a,0 2px 0 #000;box-shadow:0 0 26px rgba(111,255,106,.5),0 10px 24px rgba(0,0,0,.9)}";
    document.head.append(st);
  }
  function mostrarDano(host,x,y,texto,vel){
    ponerEstilo();const d=document.createElement('div');d.className='fxAlientoDano';d.setAttribute('aria-hidden','true');d.textContent=texto;d.style.left=x+'px';d.style.top=y+'px';host.append(d);
    const ms=1300/vel;d.animate?.([{opacity:0,transform:'translate(-50%,-50%) scale(.4)'},{opacity:1,transform:'translate(-50%,-80%) scale(1.25)',offset:.18},{opacity:1,transform:'translate(-50%,-110%) scale(1)',offset:.7},{opacity:0,transform:'translate(-50%,-150%) scale(.95)'}],{duration:ms,easing:'ease-out',fill:'forwards'});
    setTimeout(()=>d.remove(),ms+60);
  }
  // Halo hueco: rodea la carta sin lavarla de color.
  function aro(color,tam=256){const c=document.createElement('canvas');c.width=c.height=tam;const g=c.getContext('2d'),m=tam/2,d=g.createRadialGradient(m,m,m*.42,m,m,m);
    d.addColorStop(0,'rgba(0,0,0,0)');d.addColorStop(.35,color);d.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=d;g.fillRect(0,0,tam,tam);return c;}
  const rgb=(c,a=1)=>'rgba('+c.map(v=>Math.round(v*255)).join(',')+','+a+')';

  /* ENTRADA · entrada(host,{carta,afectados:[{nodo,dano}],velocidad,reducir})
     Sin fuego: la carta que entra brilla en verde, lanza una onda de ácido por
     la mesa y cada afectada destella en verde al recibirla, con su daño. */
  function entrada(host,o){
    const vel=o.velocidad||1,pal=PALETAS.verde,consulta=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reducir=o.reducir??!!consulta?.matches,carta=o.carta,afectados=(o.afectados||[]).filter(a=>a?.nodo);
    const lienzo=document.createElement('canvas');lienzo.className='fxAlientoCapa';lienzo.setAttribute('aria-hidden','true');lienzo.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:21';host.append(lienzo);
    const g=lienzo.getContext('2d'),mota=sprite(pal.chispa),halo=aro(rgb(pal.llama));
    const hr=host.getBoundingClientRect(),W=hr.width,H=hr.height,dpr=Math.min(devicePixelRatio||1,2);lienzo.width=Math.round(W*dpr);lienzo.height=Math.round(H*dpr);
    const rel=n=>{const a=n.getBoundingClientRect(),h=host.getBoundingClientRect();return {x:a.left-h.left,y:a.top-h.top,w:a.width,h:a.height};};
    const C=rel(carta),cc=[C.x+C.w/2,C.y+C.h/2];
    const lejos=Math.max(1,...afectados.map(a=>{const r=rel(a.nodo);return Math.hypot(r.x+r.w/2-cc[0],r.y+r.h/2-cc[1]);}));
    const golpes=afectados.map(a=>{const r=rel(a.nodo),d=Math.hypot(r.x+r.w/2-cc[0],r.y+r.h/2-cc[1]);return {...a,r,t:.8+.55*d/lejos,hecho:false};});
    for(const n of [carta,...afectados.map(a=>a.nodo)])n.style.transition='none';
    const motas=[],burbujas=[];
    return new Promise(resolve=>{
      let t0=0,raf=0,antes=0,fin=false;
      const limpiar=()=>{for(const n of [carta,...afectados.map(a=>a.nodo)]){n.style.transform='';n.style.filter='';}};
      const terminar=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);clearTimeout(seguro);limpiar();lienzo.remove();resolve();};
      const seguro=typeof o.reloj==='function'?0:setTimeout(terminar,3200/vel+1500);
      if(reducir||document.hidden){for(const a of golpes)if(a.dano!=null)mostrarDano(host,a.r.x+a.r.w/2,a.r.y+a.r.h*.45,'-'+a.dano,4);setTimeout(terminar,300);return;}
      function cuadro(ahora){
        raf=0;if(fin)return;if(!t0)t0=ahora;
        const dt=Math.min(.05,antes?(ahora-antes)/1000:0)*(typeof o.reloj==='function'?.35:vel);antes=ahora;
        const tt=typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*vel;
        // La carta que entra: se enciende, late y suelta la onda.
        const brillo=suave(entre(tt,0,.45))*(1-suave(entre(tt,1.7,2.4))),latido=.75+.25*Math.sin(tt*9);
        carta.style.transform=`translateY(${-brillo*C.h*.04}px) scale(${1+brillo*.05})`;
        carta.style.filter=`drop-shadow(0 0 ${6+brillo*30*latido}px ${rgb(pal.llama,.3+brillo*.6)}) brightness(${1+brillo*.18}) saturate(${1+brillo*.25})`;
        g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);g.globalCompositeOperation='lighter';
        // Resplandor detrás del brillo y motas que suben.
        if(brillo>0){g.globalAlpha=brillo*.6*latido;g.drawImage(halo,cc[0]-C.w*1.25,cc[1]-C.h*1.05,C.w*2.5,C.h*2.1);}
        if(brillo>.2&&Math.random()<brillo)for(let i=0;i<2;i++)motas.push({x:C.x+Math.random()*C.w,y:C.y+C.h*(.3+Math.random()*.7),vx:(Math.random()-.5)*20,vy:-40-Math.random()*70,t:0,vida:.9+Math.random()*.7,r:2+Math.random()*3});
        // La onda de ácido: un anillo que cruza la mesa hasta la última afectada.
        const onda=entre(tt,.7,.7+.65);
        if(onda>0&&onda<1){const r=onda*(lejos+C.h*.6),a=(1-onda)*.9;
          g.globalAlpha=a;g.lineWidth=10+onda*26;const gr=g.createRadialGradient(cc[0],cc[1],Math.max(0,r-30),cc[0],cc[1],r+18);
          gr.addColorStop(0,'rgba(60,255,90,0)');gr.addColorStop(.6,'rgba(150,255,140,.9)');gr.addColorStop(1,'rgba(60,255,90,0)');
          g.strokeStyle=gr;g.beginPath();g.ellipse(cc[0],cc[1],r,r*.82,0,0,TAU);g.stroke();}
        // Cada afectada destella en verde, tiembla y burbujea de ácido.
        for(const a of golpes){
          const k=entre(tt,a.t,a.t+1),pulso=k>0&&k<1?Math.sin(Math.PI*Math.min(1,k*2.2))*(1-k*.5):0;
          const tiembla=k>0&&k<.25?Math.sin(k*120)*4*(1-k*4):0;
          a.nodo.style.transform=`translate(${tiembla}px,${tiembla*.3}px)`;
          a.nodo.style.filter=pulso>0?`drop-shadow(0 0 ${pulso*28}px ${rgb(pal.llama,.9)}) brightness(${1+pulso*.45}) sepia(${pulso*.35}) hue-rotate(${pulso*60}deg) saturate(${1+pulso*.8})`:'';
          if(!a.hecho&&tt>=a.t){a.hecho=true;if(a.dano!=null)mostrarDano(host,a.r.x+a.r.w/2,a.r.y+a.r.h*.45,'-'+a.dano,vel);
            for(let i=0;i<26;i++)burbujas.push({x:a.r.x+a.r.w*(.1+Math.random()*.8),y:a.r.y+a.r.h*(.25+Math.random()*.7),vx:(Math.random()-.5)*16,vy:-20-Math.random()*50,t:-Math.random()*.4,vida:.6+Math.random()*.6,r:(2+Math.random()*5)*a.r.w/180});}
          if(pulso>0){g.globalAlpha=pulso*.7;g.drawImage(halo,a.r.x-a.r.w*.75,a.r.y-a.r.h*.55,a.r.w*2.5,a.r.h*2.1);}
        }
        for(let i=motas.length-1;i>=0;i--){const m=motas[i];m.t+=dt;if(m.t>=m.vida){motas.splice(i,1);continue;}m.x+=m.vx*dt;m.y+=m.vy*dt;g.globalAlpha=(1-m.t/m.vida)*.9;g.drawImage(mota,m.x-m.r*2,m.y-m.r*2,m.r*4,m.r*4);}
        g.globalCompositeOperation='source-over';
        for(let i=burbujas.length-1;i>=0;i--){const b=burbujas[i];b.t+=dt;if(b.t<0)continue;if(b.t>=b.vida){burbujas.splice(i,1);continue;}
          b.x+=b.vx*dt;b.y+=b.vy*dt;const k=b.t/b.vida,r=b.r*(1+k*.6);g.globalAlpha=(1-k)*.85;
          g.strokeStyle='rgba(170,255,150,.95)';g.lineWidth=1.2;g.fillStyle='rgba(60,200,70,.25)';g.beginPath();g.arc(b.x,b.y,r,0,TAU);g.fill();g.stroke();
          g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.arc(b.x-r*.35,b.y-r*.35,r*.25,0,TAU);g.fill();}
        g.globalAlpha=1;
        if(tt>=2.8&&!motas.length&&!burbujas.length){terminar();return;}
        raf=requestAnimationFrame(cuadro);
      }
      raf=requestAnimationFrame(cuadro);
    });
  }

  /* ATAQUE · ataque(host,{atacante,objetivo,imagenObjetivo,letal,dano,color,velocidad,reducir})
     atacante/objetivo: nodos (la carta visible). imagenObjetivo: imagen o
     canvas con la cara del objetivo, para quemarla en WebGL. Devuelve una
     promesa que se cumple al terminar; el objetivo queda oculto (es ceniza). */
  function ataque(host,o){
    const letal=o.letal!==false;
    const pal=PALETAS[o.color]||PALETAS.verde,vel=o.velocidad||1;
    const consulta=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reducir=o.reducir??!!consulta?.matches;
    const capa=(z)=>{const c=document.createElement('canvas');c.className='fxAlientoCapa';c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;host.append(c);return c;};
    const lienzoGL=capa(20),lienzo2D=capa(21);
    let gl=null;try{gl=crearGL(lienzoGL);}catch(e){console.warn('Fuego sin WebGL:',e.message);}
    const g=lienzo2D.getContext('2d');
    const atq=o.atacante,obj=o.objetivo,chispa=sprite(pal.chispa),llama=sprite('rgba('+pal.llama.map(v=>Math.round(v*255)).join(',')+',1)'),humo=sprite(pal.humo+'1)'),blanco=sprite('rgba('+pal.nucleo.map(v=>Math.round(v*255)).join(',')+',1)');
    if(gl&&o.imagenObjetivo)gl.textura(o.imagenObjetivo);
    let W=1,H=1,dpr=1;
    function medir(){const r=host.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);for(const c of [lienzoGL,lienzo2D]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}}
    medir();
    const rel=n=>{const a=n.getBoundingClientRect(),h=host.getBoundingClientRect();return {x:a.left-h.left,y:a.top-h.top,w:a.width,h:a.height};};
    const baseA=rel(atq),baseO=rel(obj);
    // Punto del impacto en la carta objetivo (uv) y boca del atacante.
    const impacto=[.5,.62];
    const particulas=[],ceniza=[];
    // Marcas del golpe cuando no mata: alrededor del impacto.
    const marcas=Array.from({length:6},(_,i)=>({u:impacto[0]+(Math.random()-.5)*.5,v:impacto[1]+(Math.random()-.5)*.35,r:.07+Math.random()*.1}));
    // Puntos de la carta ordenados por cuándo los alcanza el frente.
    const puntos=Array.from({length:1600},()=>{const u=Math.random(),v=Math.random();return {u,v,f:frente(u,v,impacto[0],impacto[1])};}).sort((a,b)=>a.f-b.f);
    // El umbral sale de los cuantiles del frente: a mitad del quemado, arde la mitad.
    const umbralDe=q=>q<=0?-1:q>=1?9:puntos[Math.min(puntos.length-1,Math.floor(q*puntos.length))].f;
    const TOTAL=letal?4.4:3.1,DUR=TOTAL*1000/vel;
    atq.style.transition='none';obj.style.transition='none';
    return new Promise(resolve=>{
      let t0=0,raf=0,antes=0,fin=false,emitido=0,cenizaHecha=0,danoPuesto=false;
      const terminar=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);clearTimeout(seguro);
        atq.style.transform='';atq.style.filter='';obj.style.filter='';obj.style.transform='';
        if(letal){obj.style.visibility='hidden';obj.dataset.fxCeniza='';}else obj.style.visibility='';
        gl?.destruir();lienzoGL.remove();lienzo2D.remove();resolve();};
      const seguro=typeof o.reloj==='function'?0:setTimeout(terminar,DUR+1500);
      if((reducir||document.hidden)&&!letal){const r=rel(obj);if(o.dano!=null)mostrarDano(host,r.x+r.w/2,r.y+r.h*.45,'-'+o.dano,4);setTimeout(terminar,300);return;}
      if(reducir||document.hidden){
        // Sin animación: el objetivo se apaga y desaparece.
        obj.animate?.([{opacity:1,filter:'none'},{opacity:0,filter:'grayscale(1) brightness(.3)'}],{duration:260,fill:'forwards'});
        setTimeout(terminar,280);return;
      }
      function cuadro(ahora){
        raf=0;if(fin)return;if(!t0)t0=ahora;
        const dt=Math.min(.05,antes?(ahora-antes)/1000:0)*(typeof o.reloj==='function'?.35:vel);antes=ahora;
        // o.reloj (sólo revisión) fija el instante; si no, corre con el tiempo real.
        const tt=typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*vel,t=tt/TOTAL;
        // Fases (segundos): carga 0–1.0; aliento 0.95–1.9; quemado 1.4–3.4; ceniza hasta 4.4.
        const carga=suave(entre(tt,0,.7))*(1-suave(entre(tt,1.9,2.4)));
        const soplando=tt>.95&&tt<1.9;
        const quema=letal?entre(tt,1.4,3.5):0;
        // Sin muerte: el golpe enciende al objetivo, lo quema por encima y se apaga.
        const encaja=letal?0:suave(entre(tt,1.1,1.3))*(1-suave(entre(tt,1.95,2.7)));
        // El atacante se levanta, arde y se inclina hacia el objetivo al soplar.
        const ca=[baseA.x+baseA.w/2,baseA.y+baseA.h/2],co=[baseO.x+baseO.w/2,baseO.y+baseO.h/2];
        const ang=Math.atan2(co[1]-ca[1],co[0]-ca[0]),lean=Math.sin(Math.PI*entre(tt,.8,1.9))*.5;
        const dx=Math.cos(ang)*lean*baseA.h*.12,dy=Math.sin(ang)*lean*baseA.h*.12;
        const temblor=soplando?(Math.random()-.5)*3:0;
        atq.style.transform=`translate(${dx+temblor}px,${dy-carga*baseA.h*.05}px) scale(${1+carga*.06})`;
        atq.style.filter=`drop-shadow(0 0 ${8+carga*26}px rgba(${pal.llama.map(v=>Math.round(v*255)).join(',')},${.25+carga*.55})) brightness(${1+carga*.12})`;
        // El objetivo se estremece con el impacto.
        const golpe=soplando?Math.sin(tt*70)*(letal?2.2:3.2)*entre(tt,1.15,1.3):0;
        obj.style.transform=`translate(${golpe}px,${golpe*.4}px)`;
        if(!letal)obj.style.filter=encaja>0?`drop-shadow(0 0 ${encaja*26}px ${rgb(pal.llama,.85)}) brightness(${1+encaja*.3}) sepia(${encaja*.3}) hue-rotate(${encaja*55}deg)`:'';
        if(!letal&&!danoPuesto&&tt>=1.2){danoPuesto=true;const r=rel(obj);if(o.dano!=null)mostrarDano(host,r.x+r.w/2,r.y+r.h*.45,'-'+o.dano,vel);}
        const A=rel(atq),O=rel(obj);
        const boca=[A.x+A.w*.5+Math.cos(ang)*A.h*.18,A.y+A.h*.36+Math.sin(ang)*A.h*.18],destino=[O.x+O.w*impacto[0],O.y+O.h*impacto[1]];
        const avance=salida(entre(tt,.95,1.2)),soplo=suave(entre(tt,.95,1.05))*(1-suave(entre(tt,1.75,1.95)));
        // WebGL: llamas del atacante, carta objetivo quemándose y sus llamas.
        if(gl){
          gl.empezar(W,H,dpr,pal,tt);
          if(quema>0){obj.style.visibility='hidden';gl.quemar(O,umbralDe(quema),impacto,1-quema);}
          gl.llamas(A,carga);
          gl.chorro(boca,destino,avance,soplo,[A.w*.09,A.w*.5]);
          gl.llamas(O,letal?Math.sin(Math.PI*acotar(quema*1.15))*.9+suave(entre(tt,1.2,1.4))*(1-quema)*.4:encaja*.7);
        }else if(quema>0){obj.style.opacity=String(1-quema);}
        // 2D: brasas del atacante, chorro de fuego, ceniza.
        g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
        if(carga>.2&&Math.random()<carga*.9)for(let i=0;i<2;i++)particulas.push({x:A.x+Math.random()*A.w,y:A.y+A.h*(.2+Math.random()*.8),vx:(Math.random()-.5)*30,vy:-60-Math.random()*90,vida:.8+Math.random()*.6,t:0,r:2+Math.random()*3,tipo:'chispa'});
        if(soplando){
          const n=gl?Math.max(2,Math.round(160*dt)):Math.max(4,Math.round(700*dt)),dist=Math.hypot(destino[0]-boca[0],destino[1]-boca[1]),base=Math.atan2(destino[1]-boca[1],destino[0]-boca[0]),escala=A.w/180;
          for(let i=0;i<n;i++){const nucleo=Math.random()<.3;
            particulas.push({camino:true,x:boca[0],y:boca[1],vida:.34+Math.random()*.14,t:0,r:(nucleo?5:9+Math.random()*9)*escala,tipo:nucleo?'nucleo':'llama',crece:nucleo?.8:1.8,fase:Math.random()*TAU,lado:(Math.random()-.5)*2,dist,base});}
          emitido++;
        }
        // Ceniza: cada punto de la carta se deshace cuando lo alcanza el frente.
        if(quema>0){
          const umbral=umbralDe(quema),escala=O.w/180;
          while(cenizaHecha<puntos.length&&puntos[cenizaHecha].f<umbral){
            const q=puntos[cenizaHecha++];
            ceniza.push({x:O.x+q.u*O.w,y:O.y+q.v*O.h,vx:(Math.random()-.5)*50,vy:-15-Math.random()*60,rot:Math.random()*TAU,vr:(Math.random()-.5)*7,vida:1.3+Math.random()*1.5,t:0,l:(2.5+Math.random()*5)*escala,gris:30+Math.random()*70,brasa:Math.random()<.22});
          }
        }
        // Sin muerte: marcas de quemado verde sobre la carta que se van apagando.
        if(!letal&&tt>1.2){const k=1-suave(entre(tt,1.8,3.0));if(k>0){
          for(const m of marcas){const cx=O.x+m.u*O.w,cy=O.y+m.v*O.h,r=m.r*O.w;
            g.globalCompositeOperation='source-over';g.globalAlpha=k*.55;const d=g.createRadialGradient(cx,cy,0,cx,cy,r);d.addColorStop(0,'rgba(12,14,10,.95)');d.addColorStop(.6,'rgba(20,30,16,.6)');d.addColorStop(1,'rgba(20,30,16,0)');g.fillStyle=d;g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
            g.globalCompositeOperation='lighter';g.globalAlpha=k*k*.7;const e=g.createRadialGradient(cx,cy,r*.45,cx,cy,r*1.05);e.addColorStop(0,'rgba(80,255,90,0)');e.addColorStop(.75,rgb(pal.llama,.9));e.addColorStop(1,'rgba(80,255,90,0)');g.fillStyle=e;g.beginPath();g.arc(cx,cy,r*1.05,0,TAU);g.fill();}}
          g.globalAlpha=1;}
        g.globalCompositeOperation='source-over';
        for(let i=ceniza.length-1;i>=0;i--){const c=ceniza[i];c.t+=dt;if(c.t>=c.vida){ceniza.splice(i,1);continue;}
          c.vx+=(Math.sin(c.t*3+c.rot)*18)*dt;c.vy-=12*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;
          const a=1-c.t/c.vida;g.save();g.translate(c.x,c.y);g.rotate(c.rot);g.globalAlpha=a*.9;
          g.fillStyle=c.brasa&&c.t<.5?`rgba(${Math.round(pal.llama[0]*255)},${Math.round(pal.llama[1]*255)},${Math.round(pal.llama[2]*255)},1)`:`rgb(${c.gris},${c.gris},${c.gris*.95})`;
          g.fillRect(-c.l/2,-c.l/3,c.l,c.l*.66);g.restore();}
        g.globalAlpha=1;
        for(let i=particulas.length-1;i>=0;i--){const p=particulas[i];p.t+=dt;if(p.t>=p.vida){particulas.splice(i,1);continue;}
          if(p.camino){
            // Recorre el camino boca → impacto con un vaivén lateral que se abre.
            const s=p.t/p.vida,px=-Math.sin(p.base),py=Math.cos(p.base),ancho=(.06+.22*s)*p.dist*.35;
            const lat=(p.lado*.6+Math.sin(p.t*22+p.fase)*.5)*ancho;
            p.x=boca[0]+Math.cos(p.base)*p.dist*s+px*lat;p.y=boca[1]+Math.sin(p.base)*p.dist*s+py*lat;
            if(s>.9&&!p.salpico&&p.tipo==='llama'&&Math.random()<.35){p.salpico=true;const a=p.base+Math.PI+(Math.random()-.5)*2.4,v=120+Math.random()*220;
              particulas.push({x:p.x,y:p.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vida:.35+Math.random()*.3,t:0,r:p.r*.8,tipo:'llama',crece:1.4,fase:0});}
          }else{p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.tipo!=='chispa'){const fr=Math.exp(-3*dt);p.vx*=fr;p.vy=p.vy*fr-40*dt;}}
          const k=p.t/p.vida,a=1-k,r=p.r*(1+(p.crece||0)*k);
          if(p.tipo==='llama'&&!p.camino&&k>.5){g.globalCompositeOperation='source-over';g.globalAlpha=(1-k)*.12;g.drawImage(humo,p.x-r*1.2,p.y-r*1.2,r*2.4,r*2.4);}
          g.globalCompositeOperation='lighter';g.globalAlpha=(p.camino?Math.min(1,k*6)*(1-k*.6):a)*(p.tipo==='llama'?.26:p.tipo==='nucleo'?.4:.9);
          g.drawImage(p.tipo==='llama'?llama:p.tipo==='nucleo'?blanco:chispa,p.x-r,p.y-r,r*2,r*2);}
        g.globalAlpha=1;g.globalCompositeOperation='source-over';
        if(t>=1&&!particulas.length&&!ceniza.length){terminar();return;}
        raf=requestAnimationFrame(cuadro);
      }
      raf=requestAnimationFrame(cuadro);
    });
  }
  /* QUEMAR · quemar(host,{objetivo,imagen,color,velocidad,reducir}) → Promise<boolean>
     Una carta que muere ardiendo, sin atacante: se prende desde abajo, arde y
     se deshace en ceniza. La promesa se cumple (true) en cuanto la carta se ha
     consumido; la ceniza sigue flotando sola y su lienzo se retira al final.
     Devuelve false, sin hacer nada, si no hay WebGL o no hay cara que quemar:
     quien llama sigue con su animación de siempre. */
  function quemar(host,o){
    const obj=o.objetivo,vel=o.velocidad||1,pal=PALETAS[o.color]||PALETAS.naranja;
    const consulta=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reducir=o.reducir??!!consulta?.matches;
    const cara=o.imagen||obj?.querySelector?.(':scope > .cjCara');
    if(!obj||reducir||document.hidden||!cara||(cara.tagName==='IMG'&&!(cara.complete&&cara.naturalWidth)))return Promise.resolve(false);
    const capa=z=>{const c=document.createElement('canvas');c.className='fxAlientoCapa';c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;host.append(c);return c;};
    const lienzoGL=capa(20);let gl=null;try{gl=crearGL(lienzoGL);}catch(_){gl=null;}
    if(!gl){lienzoGL.remove();return Promise.resolve(false);}
    const lienzo2D=capa(21),g=lienzo2D.getContext('2d'),chispa=sprite(pal.chispa);
    const hr=host.getBoundingClientRect(),W=hr.width,H=hr.height,dpr=Math.min(devicePixelRatio||1,2);
    for(const c of [lienzoGL,lienzo2D]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}
    try{gl.textura(cara);}catch(_){gl.destruir();lienzoGL.remove();lienzo2D.remove();return Promise.resolve(false);}
    const r0=obj.getBoundingClientRect(),O={x:r0.left-hr.left,y:r0.top-hr.top,w:r0.width,h:r0.height};
    const impacto=[.5,.92],puntos=Array.from({length:1200},()=>{const u=Math.random(),v=Math.random();return {u,v,f:frente(u,v,impacto[0],impacto[1])};}).sort((a,b)=>a.f-b.f);
    const umbralDe=q=>q<=0?-1:q>=1?9:puntos[Math.min(puntos.length-1,Math.floor(q*puntos.length))].f;
    const ceniza=[],chispas=[];let hecha=0;
    obj.style.visibility='hidden';
    return new Promise(resolve=>{
      let t0=0,antes=0,raf=0,avisado=false,fin=false;
      const avisar=()=>{if(!avisado){avisado=true;resolve(true);}};
      const terminar=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);clearTimeout(seguro);gl.destruir();lienzoGL.remove();lienzo2D.remove();avisar();};
      const seguro=setTimeout(terminar,4200/vel);
      function cuadro(ahora){
        raf=0;if(fin)return;if(!t0)t0=ahora;const dt=Math.min(.05,antes?(ahora-antes)/1000:0)*vel;antes=ahora;
        const tt=typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*vel;
        // Se prende (0–0,35 s), arde de abajo arriba (0,2–1,7 s); la ceniza sigue hasta ~3,2 s.
        const prende=suave(entre(tt,0,.35)),quema=entre(tt,.2,1.7),llamas=prende*(1-suave(entre(tt,1.4,1.9)));
        const tiembla=tt<.5?Math.sin(tt*90)*1.6*(1-tt*2):0,R={x:O.x+tiembla,y:O.y,w:O.w,h:O.h};
        gl.empezar(W,H,dpr,pal,tt);
        if(quema<1)gl.quemar(R,umbralDe(quema),impacto,prende);
        gl.llamas(R,llamas*.95);
        g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
        const escala=O.w/180,umbral=umbralDe(quema);
        while(hecha<puntos.length&&puntos[hecha].f<umbral){const q=puntos[hecha++];
          ceniza.push({x:O.x+q.u*O.w,y:O.y+q.v*O.h,vx:(Math.random()-.5)*40,vy:-20-Math.random()*55,rot:Math.random()*TAU,vr:(Math.random()-.5)*7,vida:1.1+Math.random()*1.3,t:0,l:(2.2+Math.random()*4.5)*escala,gris:30+Math.random()*70,brasa:Math.random()<.25});}
        if(llamas>.2&&Math.random()<llamas)chispas.push({x:O.x+Math.random()*O.w,y:O.y+O.h*(.2+Math.random()*.8),vx:(Math.random()-.5)*30,vy:-70-Math.random()*90,t:0,vida:.6+Math.random()*.5,r:(2+Math.random()*2.5)*escala});
        for(let i=ceniza.length-1;i>=0;i--){const c=ceniza[i];c.t+=dt;if(c.t>=c.vida){ceniza.splice(i,1);continue;}
          c.vx+=Math.sin(c.t*3+c.rot)*18*dt;c.vy-=12*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;
          g.save();g.translate(c.x,c.y);g.rotate(c.rot);g.globalAlpha=(1-c.t/c.vida)*.9;
          g.fillStyle=c.brasa&&c.t<.5?rgb(pal.llama):`rgb(${c.gris},${c.gris},${c.gris*.95})`;g.fillRect(-c.l/2,-c.l/3,c.l,c.l*.66);g.restore();}
        g.globalCompositeOperation='lighter';
        for(let i=chispas.length-1;i>=0;i--){const c=chispas[i];c.t+=dt;if(c.t>=c.vida){chispas.splice(i,1);continue;}
          c.x+=c.vx*dt;c.y+=c.vy*dt;g.globalAlpha=1-c.t/c.vida;g.drawImage(chispa,c.x-c.r*2,c.y-c.r*2,c.r*4,c.r*4);}
        g.globalCompositeOperation='source-over';g.globalAlpha=1;
        if(quema>=1)avisar();
        if(quema>=1&&!ceniza.length&&!chispas.length){terminar();return;}
        raf=requestAnimationFrame(cuadro);
      }
      raf=requestAnimationFrame(cuadro);
    });
  }

  // reproducir: el ataque letal de la primera prueba.
  window.CAOZ_FX_ALIENTO=Object.freeze({entrada,ataque,quemar,reproducir:(h,o)=>ataque(h,{...o,letal:true}),frente});
})();

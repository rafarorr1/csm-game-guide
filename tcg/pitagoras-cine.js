/* La tinta del Editor: materiales, grabados vivos y una nube que devora la mesa.
   No mantiene su propio reloj ni modifica el juego. La escena propietaria pinta
   cada fotograma y decide cuándo cubrir, revelar y liberar los recursos. */
'use strict';
(function(global){
  if(typeof document==='undefined')return;
  const TAU=Math.PI*2,limitar=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  const PALETAS={isometrico:['#c97d69','#382330',[.44,.20,.19]],laseres:['#e4ae68','#382726',[.49,.28,.12]],fps:['#91b5ad','#1b2931',[.19,.35,.36]],carrera:['#edb37c','#2f2228',[.50,.24,.13]],orbital:['#97b9d9','#232335',[.21,.30,.50]],duelo:['#ce98bb','#2e2031',[.40,.18,.37]]};
  const paleta=t=>PALETAS[t]||PALETAS.isometrico;
  let equipo=null,intentado=false,sello=null;
  const VERTICE='attribute vec2 aPos;varying vec2 vUV;void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}';
  const FRAGMENTO=`
    precision highp float;
    varying vec2 vUV;uniform vec2 uTam;uniform float uTiempo;uniform float uCubierta;uniform vec3 uTinta;
    float azar(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
    float ruido(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(azar(i),azar(i+vec2(1.,0.)),f.x),mix(azar(i+vec2(0.,1.)),azar(i+1.),f.x),f.y);}
    float fbm(vec2 p){float n=0.,a=.55;mat2 m=mat2(.80,-.60,.60,.80);for(int i=0;i<4;i++){n+=a*ruido(p);p=m*p*2.06+vec2(17.3,8.7);a*=.48;}return n;}
    void main(){
      vec2 uv=vec2(vUV.x,1.-vUV.y);float proporcion=uTam.x/uTam.y;
      vec2 p=(uv-vec2(.5,.27))*vec2(proporcion,1.);float radio=length(p);
      float tiempo=uTiempo*.13;float giro=.58*sin(radio*3.3-tiempo*.7);
      p=mat2(cos(giro),-sin(giro),sin(giro),cos(giro))*p;
      vec2 deriva=vec2(tiempo*.21,-tiempo*.34);
      vec2 q=vec2(fbm(p*3.1+deriva),fbm(p*3.1+vec2(4.2,1.8)-deriva*.7));
      float n=fbm(p*4.4+q*2.9+vec2(-tiempo*.32,tiempo*.13));
      float fino=ruido(p*27.+q*3.+tiempo*.16);
      float maximo=length(vec2(proporcion*.5,.73));
      float frente=uCubierta*(maximo+.78)-.31;
      float distancia=radio+(n-.48)*.39+(q.x-.5)*.16;
      float alfa=(1.-smoothstep(frente-.12,frente+.15,distancia))*smoothstep(0.,.12,uCubierta);
      alfa=mix(alfa,1.,smoothstep(.77,.99,uCubierta));
      float borde=pow(clamp(1.-abs(distancia-frente)*5.,0.,1.),3.);
      float cuerpo=pow(n,2.4),filamento=pow(clamp(1.-abs(n-.50)*19.,0.,1.),5.);
      vec3 color=vec3(.008,.010,.018)+cuerpo*vec3(.067,.078,.105);
      color+=borde*(.20+.80*n)*vec3(.036,.045,.061);
      color+=filamento*.026*uTinta+fino*.004;
      color+=pow(q.x,5.)*.028*uTinta;
      gl_FragColor=vec4(color*alfa,alfa);
    }`;
  function compilar(gl,tipo,fuente){
    const s=gl.createShader(tipo);gl.shaderSource(s,fuente);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('La nube usa su alternativa Canvas.');}return s;
  }
  function construirGPU(e){
    const gl=e.gl,v=compilar(gl,gl.VERTEX_SHADER,VERTICE),f=compilar(gl,gl.FRAGMENT_SHADER,FRAGMENTO),p=gl.createProgram();
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){gl.deleteProgram(p);throw new Error('La nube usa su alternativa Canvas.');}
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    e.programa=p;e.buffer=b;e.pos=gl.getAttribLocation(p,'aPos');e.tam=gl.getUniformLocation(p,'uTam');e.tiempo=gl.getUniformLocation(p,'uTiempo');e.cubierta=gl.getUniformLocation(p,'uCubierta');e.tinta=gl.getUniformLocation(p,'uTinta');e.perdido=false;
  }
  function obtenerGPU(){
    if(equipo)return equipo.perdido?null:equipo;if(intentado)return null;intentado=true;
    let c,gl;
    try{
      c=document.createElement('canvas');gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
      if(!gl)return null;
      const e={canvas:c,gl,perdido:false,programa:null,buffer:null};
      construirGPU(e);
      e.perder=ev=>{ev.preventDefault();e.perdido=true;};
      e.recuperar=()=>{try{construirGPU(e);}catch(_){e.perdido=true;}};
      c.addEventListener('webglcontextlost',e.perder);c.addEventListener('webglcontextrestored',e.recuperar);equipo=e;return e;
    }catch(_){if(gl)gl.getExtension('WEBGL_lose_context')?.loseContext();return null;}
  }
  function estampa(){
    if(sello)return sello;sello=document.createElement('canvas');sello.width=sello.height=128;const c=sello.getContext('2d'),g=c.createRadialGradient(61,57,0,64,64,64);
    g.addColorStop(0,'#06070dfa');g.addColorStop(.32,'#0b0d16f2');g.addColorStop(.58,'#1f2535b8');g.addColorStop(.80,'#30374942');g.addColorStop(1,'#1a202f00');c.fillStyle=g;c.fillRect(0,0,128,128);return sello;
  }
  function pintarAlternativa(c,w,h,p,t){
    const textura=estampa(),r=Math.hypot(w*.5,h*.73),salida=p*p*(3-2*p),base=limitar((p-.58)/.42);
    // La base cierra las cuatro esquinas sin confiar en el alfa de las estampas.
    c.fillStyle='#080a11';c.globalAlpha=base;c.fillRect(0,0,w,h);
    for(let i=0;i<38;i++){
      const a=i*2.399963+t*(i%2?.035:-.027),anillo=(i%7+1)/7,dist=salida*r*anillo;
      const x=w*.5+Math.cos(a+Math.sin(t*.12+i)*.16)*dist,y=h*.27+Math.sin(a)*dist;
      const tam=(.32+salida*.62)*r*(.68+(i%5)*.14),giro=Math.sin(i*3.7+t*.09)*.22;
      c.save();c.translate(x,y);c.rotate(giro);c.globalAlpha=limitar(p*2)*(1-base*.3);c.drawImage(textura,-tam/2,-tam/2,tam,tam);c.restore();
    }
    c.globalAlpha=limitar((p-.88)/.12);c.fillStyle='#080a11';c.fillRect(0,0,w,h);c.globalAlpha=1;
  }
  function esporas(c,w,h,p,t,tipo){
    const acento=paleta(tipo)[0],r=Math.hypot(w*.5,h*.73),op=Math.sin(p*Math.PI)*.7;
    if(op<=.002)return;c.globalCompositeOperation='screen';
    for(let i=0;i<35;i++){
      const a=i*2.39996+t*.028,dist=(.17+(i%11)*.075)*r*p,x=w*.5+Math.cos(a)*dist,y=h*.27+Math.sin(a)*dist;
      const brillo=.35+.65*Math.sin(i*7.1+t*.75)**2;
      c.globalAlpha=op*brillo;c.fillStyle=i%4?acento:'#c9cbd0';
      c.beginPath();c.ellipse(x,y,i%6===0?1.3:.65,i%6===0?2.4:1.1,a,0,TAU);c.fill();
      if(i%5===0){c.strokeStyle=acento;c.lineWidth=.55;c.globalAlpha=op*.25;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-8*Math.sin(a),y+7*Math.cos(a),x-19*Math.sin(a),y+22*Math.cos(a));c.stroke();}
    }
  }
  function pintarNube(c,w,h,cobertura,tiempoSeg,reducido,tipo){
    const p=limitar(cobertura),t=(Number(tiempoSeg)||0)%10000;if(!c||!w||!h||p<=0)return;
    c.save();c.globalCompositeOperation='source-over';c.globalAlpha=1;
    if(reducido){c.globalAlpha=p;c.fillStyle='#080a11';c.fillRect(0,0,w,h);c.restore();return;}
    let gpu=obtenerGPU(),dibujado=false;
    if(gpu){
      try{
        const gl=gpu.gl,esc=Math.min(.9,Math.sqrt(190000/(w*h))),cw=Math.max(2,Math.round(w*esc)),ch=Math.max(2,Math.round(h*esc));
        if(gpu.canvas.width!==cw||gpu.canvas.height!==ch){gpu.canvas.width=cw;gpu.canvas.height=ch;}
        gl.viewport(0,0,cw,ch);gl.disable(gl.BLEND);gl.useProgram(gpu.programa);gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);gl.enableVertexAttribArray(gpu.pos);gl.vertexAttribPointer(gpu.pos,2,gl.FLOAT,false,0,0);
        gl.uniform2f(gpu.tam,w,h);gl.uniform1f(gpu.tiempo,t);gl.uniform1f(gpu.cubierta,p);gl.uniform3fv(gpu.tinta,paleta(tipo)[2]);gl.drawArrays(gl.TRIANGLES,0,6);
        // drawImage copia el framebuffer dentro del mismo fotograma; no se conserva.
        if(!gl.isContextLost()){c.drawImage(gpu.canvas,0,0,w,h);dibujado=true;}else gpu.perdido=true;
      }catch(_){gpu.perdido=true;}
    }
    if(!dibujado)pintarAlternativa(c,w,h,p,t);
    esporas(c,w,h,p,t,tipo);c.restore();
  }
  function circulo(c,x,y,r,color,ancho=1){c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);c.strokeStyle=color;c.lineWidth=ancho;c.stroke();}
  function linea(c,x,y,xx,yy,color,ancho=1){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=ancho;c.stroke();}
  function grabado(c,w,h,tipo,t){
    const [acento,fondo]=paleta(tipo),r=Math.min(w,h)*.39,cx=w*.5,cy=h*.48;
    const niebla=c.createRadialGradient(cx,cy,r*.05,cx,cy,r*1.5);niebla.addColorStop(0,fondo);niebla.addColorStop(.64,'#0c1017');niebla.addColorStop(1,'#080b1000');c.fillStyle=niebla;c.fillRect(0,0,w,h);
    c.save();c.translate(cx,cy);c.strokeStyle=acento;c.fillStyle=acento;c.lineCap='round';
    c.save();c.rotate(t*.018);c.globalAlpha=.36;circulo(c,0,0,r,acento);circulo(c,0,0,r*1.11,acento,.5);
    for(let i=0;i<48;i++){const a=i*TAU/48,len=i%4===0?.10:.025;linea(c,Math.cos(a)*r*1.035,Math.sin(a)*r*1.035,Math.cos(a)*r*(1.035+len),Math.sin(a)*r*(1.035+len),acento,.6);}c.restore();
    // Grabados diferentes: cosecha, rejilla de corte, corredor, huida, órbita y memoria.
    if(tipo==='laseres'){
      c.save();c.rotate(-.35);for(let i=-3;i<=3;i++){const x=i*r*.23;linea(c,x,-r*.77,x,r*.77,acento,i===0?3:.65);c.globalAlpha=.15;linea(c,x,-r*.77,x,r*.77,acento,9);c.globalAlpha=1;}c.restore();
      for(let i=0;i<4;i++){const a=i*TAU/4+t*.14,x=Math.cos(a)*r*.7,y=Math.sin(a)*r*.7;circulo(c,x,y,4,'#efe1c8',1.4);}
    }else if(tipo==='fps'){
      for(let i=0;i<5;i++){const q=.20+i*.16;c.strokeStyle=acento;c.globalAlpha=.3+i*.1;c.strokeRect(-r*q,-r*q*.75,r*q*2,r*q*1.5);}
      c.globalAlpha=.7;for(const x of [-1,1])for(const y of [-1,1])linea(c,x*r*.2,y*r*.15,x*r*.96,y*r*.72,acento,.8);
      c.fillStyle='#05070b';c.beginPath();c.ellipse(0,r*.07,r*.10,r*.26,0,0,TAU);c.fill();linea(c,-r*.09,-r*.065,-r*.018,-r*.045,'#eaa898',2);linea(c,r*.018,-r*.045,r*.09,-r*.065,'#eaa898',2);
    }else if(tipo==='carrera'){
      c.save();c.rotate(-.15);for(let i=0;i<9;i++){const y=-r*.7+i*r*.19,x=(i%2?1:-1)*(r*.15+Math.sin(i*2.5)*r*.10);linea(c,x-r*.18,y,x+r*.18,y,acento,3);linea(c,x+r*.18,y,x+r*.18,y+r*.06,acento,1);}
      c.strokeStyle='#e9d3a1';c.lineWidth=1.2;c.setLineDash([3,7]);c.beginPath();c.moveTo(-r*.5,r*.7);c.bezierCurveTo(r*.9,r*.15,-r*.8,-r*.15,r*.42,-r*.74);c.stroke();c.setLineDash([]);c.restore();
      c.beginPath();c.moveTo(-r*.16,r*.14);c.lineTo(r*.17,-r*.07);c.lineTo(0,r*.33);c.closePath();c.fillStyle='#ead2aa';c.fill();
    }else if(tipo==='orbital'){
      for(let i=0;i<3;i++){c.save();c.rotate(i*Math.PI/3+t*.05);c.strokeStyle=acento;c.globalAlpha=.65;c.beginPath();c.ellipse(0,0,r*.9,r*.30,0,0,TAU);c.stroke();c.restore();}
      const g=c.createRadialGradient(-r*.07,-r*.07,0,0,0,r*.23);g.addColorStop(0,'#e0edf5');g.addColorStop(.15,acento);g.addColorStop(.58,'#324359');g.addColorStop(1,'#060a11');c.fillStyle=g;c.beginPath();c.arc(0,0,r*.23,0,TAU);c.fill();
      const a=t*.24;circulo(c,Math.cos(a)*r*.85,Math.sin(a)*r*.29,4,'#dae7f2',2);
    }else if(tipo==='duelo'){
      for(let i=-1;i<=1;i++){c.save();c.translate(i*r*.37,Math.abs(i)*r*.12);c.rotate(i*.20);c.fillStyle='#11121d';c.strokeStyle=i?'#b192aa':'#efc6db';c.lineWidth=1.4;c.fillRect(-r*.31,-r*.62,r*.62,r*1.08);c.strokeRect(-r*.31,-r*.62,r*.62,r*1.08);c.globalAlpha=.45;c.strokeRect(-r*.25,-r*.56,r*.50,r*.96);c.globalAlpha=1;if(i<=0){circulo(c,0,-r*.12,r*.12,'#efc6db',2);linea(c,-r*.17,-r*.12,r*.17,-r*.12,acento,1);linea(c,0,-r*.29,0,r*.05,acento,1);}else{c.save();c.rotate(Math.PI/4);c.strokeRect(-r*.12,-r*.12,r*.24,r*.24);c.restore();}c.restore();}
      c.globalAlpha=.6+.25*Math.sin(t*1.3);linea(c,-r*.37,r*.73,0,r*.57,'#e9c2d9',1);circulo(c,-r*.37,r*.73,r*.035,'#efdbdf',2);circulo(c,0,r*.57,r*.035,'#efdbdf',2);c.globalAlpha=1;
    }else{
      c.save();c.rotate(-.17);c.strokeStyle='#dbbb9e';c.lineWidth=3;c.beginPath();c.moveTo(-r*.45,r*.78);c.bezierCurveTo(-r*.2,r*.04,0,-r*.32,r*.22,-r*.73);c.stroke();
      c.fillStyle=acento;c.beginPath();c.moveTo(r*.21,-r*.72);c.bezierCurveTo(r*.76,-r*.65,r*.74,-r*.18,r*.53,r*.10);c.bezierCurveTo(r*.57,-r*.32,r*.34,-r*.35,r*.05,-r*.40);c.closePath();c.fill();c.restore();
      for(let i=0;i<5;i++){const x=(i-2)*r*.28,y=r*.38+Math.sin(i)*r*.08;linea(c,x,y,x-r*.045,y-r*.04,'#e2a698',2);linea(c,x+r*.055,y,x+r*.1,y-r*.04,'#e2a698',2);}
    }
    c.restore();
    c.fillStyle=acento;for(let i=0;i<24;i++){const a=i*2.4+t*.025,x=cx+Math.cos(a)*r*(.65+(i%7)*.075),y=cy+Math.sin(a)*r*(.65+(i%7)*.075);c.globalAlpha=.18+Math.sin(t*.6+i)**2*.3;c.fillRect(x,y,i%5?1:1.6,i%5?1:1.6);}c.globalAlpha=1;
  }
  function pintarCarta(canvas,tipo,tiempoSeg,reducido){
    if(!canvas?.getContext)return;const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width||220),h=Math.max(1,r.height||200),d=Math.min(global.devicePixelRatio||1,1.5);
    const ww=Math.round(w*d),hh=Math.round(h*d);if(canvas.width!==ww||canvas.height!==hh){canvas.width=ww;canvas.height=hh;}
    const c=canvas.getContext('2d');if(!c)return;c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);c.save();grabado(c,w,h,tipo,reducido?0:(Number(tiempoSeg)||0)%10000);c.restore();
  }
  function destruir(){
    if(equipo){const e=equipo;e.canvas.removeEventListener('webglcontextlost',e.perder);e.canvas.removeEventListener('webglcontextrestored',e.recuperar);if(!e.perdido){e.gl.deleteBuffer(e.buffer);e.gl.deleteProgram(e.programa);}e.canvas.width=e.canvas.height=1;}
    equipo=null;intentado=false;sello=null;
  }
  const estilo=document.createElement('style');estilo.id='pitagorasCineCSS';estilo.textContent=`
    .pitPrueba.pitPrueba{--pp-acento:#c97d69;--pp-acento-rgb:201,125,105;--pp-tinta:#382330}
    .pitPrueba[data-tipo=laseres]{--pp-acento:#e4ae68;--pp-acento-rgb:228,174,104;--pp-tinta:#382726}
    .pitPrueba[data-tipo=fps]{--pp-acento:#91b5ad;--pp-acento-rgb:145,181,173;--pp-tinta:#1b2931}
    .pitPrueba[data-tipo=carrera]{--pp-acento:#edb37c;--pp-acento-rgb:237,179,124;--pp-tinta:#2f2228}
    .pitPrueba[data-tipo=orbital]{--pp-acento:#97b9d9;--pp-acento-rgb:151,185,217;--pp-tinta:#232335}
    .pitPrueba[data-tipo=duelo]{--pp-acento:#ce98bb;--pp-acento-rgb:206,152,187;--pp-tinta:#2e2031}
    .pitPrueba.pitPrueba .ppShell{background:#070a10;border-inline-color:#ffffff0d}
    .pitPrueba.pitPrueba .ppCabecera{background:linear-gradient(105deg,#0f141be8,#090d13f2 62%,#11131af2);border-bottom:1px solid #ffffff12;box-shadow:0 9px 24px #0005;isolation:isolate}
    .pitPrueba.pitPrueba .ppAvatar{border-radius:2px;border-color:#bbad8b66;box-shadow:0 0 0 2px #080b10,0 0 0 3px #c9b88718;filter:saturate(.76) contrast(1.07)}
    .pitPrueba.pitPrueba .ppNombre strong{color:#ede3d5;text-shadow:0 2px 8px #000;font-weight:500;letter-spacing:.4px}
    .pitPrueba.pitPrueba .ppNombre small{color:var(--pp-acento);font-weight:500;line-height:1.45;text-wrap:balance}
    .pitPrueba.pitPrueba .ppTiempo{color:#e9e0d2;font-weight:400;text-shadow:0 0 22px rgba(var(--pp-acento-rgb),.2)}
    .pitPrueba.pitPrueba .ppVida{background:linear-gradient(125deg,#ebc2b7,#b56f72 60%,#5f3849);filter:drop-shadow(0 0 3px #ae686522)}
    .pitPrueba.pitPrueba .ppVida.off{background:#43404b;opacity:.32;filter:none}
    .pitPrueba.pitPrueba .ppCronoBarra{height:1px;background:#ffffff0c}
    .pitPrueba.pitPrueba .ppCronoBarra i{background:linear-gradient(90deg,#302c36,var(--pp-acento));box-shadow:0 0 7px rgba(var(--pp-acento-rgb),.55)}
    .pitPrueba.pitPrueba .ppControles{background:radial-gradient(ellipse at 50% 120%,var(--pp-tinta),transparent 68%),linear-gradient(#080c12,#06080d);border-top:1px solid #e5dbb414;box-shadow:0 -12px 35px #05080d55}
    .pitPrueba.pitPrueba .ppPad{background:repeating-conic-gradient(from 0deg,#c6c8ca10 0deg 1deg,transparent 1deg 15deg),radial-gradient(circle,#080b11 0 55%,#191c2466 56% 67%,#111720 68%);border-color:#b8b5ad40;box-shadow:inset 0 1px 1px #ffffff1a,inset 0 -3px 9px #0008,0 0 0 4px #d7c9b305,0 7px 18px #0005}
    .pitPrueba.pitPrueba .ppPad:before,.pitPrueba.pitPrueba .ppPad:after{background:#bfc4c518}
    .pitPrueba.pitPrueba .ppPulgar{background:radial-gradient(circle at 38% 29%,#51515b,#272a34 44%,#11161f 82%);border:1px solid #c4bdb35c;box-shadow:inset 0 1px 2px #f5e6bf33,0 3px 8px #000b}
    .pitPrueba.pitPrueba .ppPad.ppAtacando{border-color:var(--pp-acento);box-shadow:inset 0 0 14px rgba(var(--pp-acento-rgb),.13),0 0 0 4px rgba(var(--pp-acento-rgb),.035),0 0 20px rgba(var(--pp-acento-rgb),.12)}
    .pitPrueba.pitPrueba .ppPad .ppGlifo{color:#ded6cc;text-shadow:0 1px 2px #000}
    .pitPrueba.pitPrueba .ppGrupoPad>span{font-weight:500;color:#b6b0a8;letter-spacing:1.5px}
    .pitPrueba.pitPrueba .ppCentroControl{color:#84888d;line-height:1.5}
    .pitPrueba.pitPrueba .ppCentroControl b{font-family:Georgia,serif;font-weight:400;color:#d4c7b7;letter-spacing:.2px}
    .pitPrueba.pitPrueba .ppCartaJuego{border-radius:6px;border:1px solid #b7a488;background:repeating-linear-gradient(120deg,#d7b78e05 0 1px,transparent 1px 5px),linear-gradient(155deg,#24222bea,#070b12 37%,#0d1018 80%,#29212a);box-shadow:0 0 0 3px #070a10,0 0 0 4px #a48b6740,inset 0 0 0 4px #11141b,inset 0 0 0 5px #8f78683b,0 34px 100px #000e,0 0 110px rgba(var(--pp-acento-rgb),.13);color:#ead7ba;isolation:isolate}
    .pitPrueba.pitPrueba .ppCartaJuego:before{content:'';position:absolute;inset:10px;pointer-events:none;border:1px solid #bba38426;z-index:-1}
    .pitPrueba.pitPrueba .ppCartaEdicion{font-size:8px;letter-spacing:2.6px;color:#b7a393;border-bottom:1px solid #a6927229;padding-bottom:10px;width:100%;text-align:center}
    .pitPrueba.pitPrueba .ppCartaArte{background:none;margin-top:6px}
    .pitPrueba.pitPrueba .ppCartaArte canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    .pitPrueba.pitPrueba .ppCartaJuego h1{color:#f0dfc3;text-shadow:0 2px 10px #000;letter-spacing:.6px;font-weight:500}
    .pitPrueba.pitPrueba .ppCartaJuego>p{color:var(--pp-acento);font-style:italic;letter-spacing:.15px}
    .pitPrueba.pitPrueba .ppCartaStats{border-top:1px solid #b7986830;border-bottom:1px solid #b7986830;background:linear-gradient(90deg,transparent,#bda08408,transparent)}
    .pitPrueba.pitPrueba .ppCartaStats b{font-weight:400;color:#f0dfc7}
    .pitPrueba.pitPrueba .ppCartaStats small{color:#ac9d8e;font-size:8px;letter-spacing:1.5px}
    .pitPrueba.pitPrueba .ppCartaRegla{color:#c1b2a9;font-style:italic}
    .pitPrueba.pitPrueba .ppDesenlace{background:radial-gradient(ellipse,#070b1133,#030609d6);gap:16px}
    .pitPrueba.pitPrueba .ppDesenlace small{color:var(--pp-acento);font-size:9px;letter-spacing:4px}
    .pitPrueba.pitPrueba .ppDesenlace strong{font-weight:400;letter-spacing:1px;color:#f0e5d5;text-shadow:0 1px 1px #fff3,0 4px 25px #000,0 0 50px rgba(var(--pp-acento-rgb),.22)}
    .pitPrueba.pitPrueba .ppDesenlace span{font-family:Georgia,serif;font-style:italic;color:#c4b8ac}
    @media(max-width:380px){.pitPrueba.pitPrueba .ppNombre small{letter-spacing:.6px}.pitPrueba.pitPrueba .ppGrupoPad>span{letter-spacing:.75px}}
    @media(prefers-reduced-motion:reduce){.pitPrueba.pitPrueba .ppCartaConsumida{animation:none;opacity:0}.pitPrueba.pitPrueba .ppDesenlace{animation:none}}
  `;document.head.appendChild(estilo);
  global.PITAGORAS_CINE={pintarNube,pintarCarta,destruir};
})(typeof window!=='undefined'?window:globalThis);

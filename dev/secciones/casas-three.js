/* Casas de Tomsage para three.js: bonitas y baratas.
   Cómo se ven de juego grande sin gastar polígonos:
     · Interior mapping en las ventanas: cada cristal es un solo cuadro, pero su
       shader calcula por dónde entraría la mirada en una habitación de verdad
       (paredes empapeladas, suelo de tablas, vigas, una chimenea encendida y
       una lámpara) con perspectiva que cambia con la cámara. Cortinas, vidrio
       emplomado en rombos y el reflejo del cielo encima. Todo en un cuadro.
     · El detalle está en las texturas (pintadas en canvas con su relieve):
       yeso con manchas, grietas y desconchones; roble con veta; sillares;
       tejas de barro con musgo; tablas con herrajes. La geometría sólo marca
       la silueta: planta alta que vuela sobre la calle con ménsulas, vigas del
       entramado, aleros con tablas de canto, chimenea, contraventanas,
       jardineras y faroles.
     · Sombreado por vértice (la base de las paredes, más sucia y oscura) y un
       halo cálido en la fachada alrededor de cada ventana encendida, más la luz
       que cae al suelo delante de las de abajo: sin luces reales.
     · fundir(casas) junta todas las casas en una malla por material: una calle
       entera cuesta una docena de llamadas de dibujo.
   Tipos: 'entramada' (dos plantas de entramado, la de arriba volada),
   'taberna' (planta baja de piedra, letrero colgado, toneles) y 'piedra'
   (cabaña de sillares con buhardilla y chimenea exterior). Y casa('pozo'): el pozo
   de la plaza con los mismos materiales (no está en TIPOS: no tiene ventanas).
   CAOZ_CASAS.fabrica(THREE,{renderer}) → {casa(tipo,opc), fundir(casas), materiales, uniformes, TIPOS}. */
'use strict';
(function(){
  const TAU=Math.PI*2;
  const TIPOS=Object.freeze(['entramada','taberna','piedra']);
  function fabrica(THREE,opciones={}){
    const V3=THREE.Vector3;
    let semilla=97;const rnd=()=>(semilla=(semilla*16807)%2147483647)/2147483647;
    const lienzo=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d',{willReadFrequently:true})];};
    const aniso=opciones.renderer?opciones.renderer.capabilities.getMaxAnisotropy():4;
    const tex=(c,srgb)=>{const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=aniso;return t;};
    // Relieve a partir de una altura en gris (Sobel), repitiendo por los bordes.
    function normales(alto,fuerza){const w=alto.width,h=alto.height,d=alto.getContext('2d').getImageData(0,0,w,h).data,[c,g]=lienzo(w,h),im=g.createImageData(w,h),a=(x,y)=>d[(((y+h)%h)*w+((x+w)%w))*4]/255;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(a(x+1,y)-a(x-1,y))*fuerza,dy=(a(x,y+1)-a(x,y-1))*fuerza,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;im.data[i]=(-dx/l*.5+.5)*255;im.data[i+1]=(dy/l*.5+.5)*255;im.data[i+2]=(1/l*.5+.5)*255;im.data[i+3]=255;}
      g.putImageData(im,0,0);return c;}
    const mancha=(g,x,y,r,color,a)=>{const f=g.createRadialGradient(x,y,0,x,y,r);f.addColorStop(0,`rgba(${color},${a})`);f.addColorStop(1,`rgba(${color},0)`);g.fillStyle=f;g.fillRect(x-r,y-r,2*r,2*r);};
    // Para que se repita sin costuras, lo que se dibuja cerca de un borde se dibuja también al otro lado.
    const envuelto=(T,x,y,r,fn)=>{for(const dx of [-T,0,T])for(const dy of [-T,0,T])if(x+dx>-r&&x+dx<T+r&&y+dy>-r&&y+dy<T+r)fn(x+dx,y+dy);};

    /* ---- Texturas ------------------------------------------------------------------- */
    function yeso(){const T=512,[c,g]=lienzo(T,T),[a,ga]=lienzo(T,T);
      g.fillStyle='#cdbd9c';g.fillRect(0,0,T,T);
      for(let i=0;i<320;i++){const x=rnd()*T,y=rnd()*T,r=8+rnd()*60,cl=rnd()<.55?'118,98,70':'255,248,232',al=.04+rnd()*.08;envuelto(T,x,y,r,(X,Y)=>mancha(g,X,Y,r,cl,al));}
      const im=ga.createImageData(T,T);for(let i=0;i<im.data.length;i+=4){const v=128+(rnd()-.5)*34;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}ga.putImageData(im,0,0);
      // Desconchones: asoma el ladrillo, hundido.
      for(let i=0;i<3;i++){const x=rnd()*T,y=rnd()*T,r=14+rnd()*22,pts=[];for(let k=0;k<11;k++){const a=k/11*TAU,rr=r*(.55+rnd()*.7);pts.push([Math.cos(a)*rr*1.5,Math.sin(a)*rr*.8]);}
        envuelto(T,x,y,r*2,(X,Y)=>{const forma=k2=>{k2.beginPath();pts.forEach(([px,py],j)=>j?k2.lineTo(X+px,Y+py):k2.moveTo(X+px,Y+py));k2.closePath();};
          g.fillStyle='rgba(140,92,70,.55)';forma(g);g.fill();g.strokeStyle='rgba(235,225,205,.5)';g.lineWidth=2;forma(g);g.stroke();ga.fillStyle='#565656';forma(ga);ga.fill();});}
      // Grietas finas.
      for(let i=0;i<14;i++){let x=rnd()*T,y=rnd()*T;const p=[[x,y]];for(let k=0;k<9;k++){x+=(rnd()-.5)*26;y+=rnd()*20;p.push([x,y]);}
        for(const [k2,col,w] of [[g,'rgba(70,56,40,.45)',1],[ga,'#3a3a3a',2]]){k2.strokeStyle=col;k2.lineWidth=w;k2.beginPath();p.forEach(([px,py],j)=>j?k2.lineTo(px,py):k2.moveTo(px,py));k2.stroke();}}
      return {map:tex(c,true),normalMap:tex(normales(a,1.4))};}
    function madera(){const T=512,[c,g]=lienzo(T,T),[a,ga]=lienzo(T,T);g.fillStyle='#3c2616';g.fillRect(0,0,T,T);ga.fillStyle='#7a7a7a';ga.fillRect(0,0,T,T);
      for(let i=0;i<420;i++){const y=rnd()*T,o=2+rnd()*6,cl=rnd(),w=.6+rnd()*2.2;g.strokeStyle=`rgba(${cl<.5?28:112},${cl<.5?16:74},${cl<.5?8:44},${.18+rnd()*.35})`;g.lineWidth=w;ga.strokeStyle=cl<.5?'rgba(40,40,40,.6)':'rgba(170,170,170,.5)';ga.lineWidth=w;
        for(const k of [g,ga]){k.beginPath();for(let x=-8;x<=T+8;x+=16){const yy=y+Math.sin(x*.012+i)*o+Math.sin(x*.05+i*2)*2;x<0?k.moveTo(x,yy):k.lineTo(x,yy);}k.stroke();}}
      for(let i=0;i<7;i++){const x=rnd()*T,y=rnd()*T;envuelto(T,x,y,14,(X,Y)=>{mancha(g,X,Y,12,'30,16,8',.8);mancha(ga,X,Y,12,'30,30,30',.9);});}
      return {map:tex(c,true),normalMap:tex(normales(a,2.2))};}
    // Sillares: filas desplazadas (como un aparejo), cada piedra con su tono y bordes gastados.
    function sillares(){const T=512,[c,g]=lienzo(T,T),[a,ga]=lienzo(T,T),filas=8,alto=T/filas;g.fillStyle='#4a4540';g.fillRect(0,0,T,T);ga.fillStyle='#303030';ga.fillRect(0,0,T,T);
      for(let f=0;f<filas;f++){let x=(f%2)*alto*.7;const y=f*alto;while(x<T+alto){const w=alto*(1.1+rnd()*1.2),tono=90+rnd()*50,cal=rnd()*16;
          envuelto(T,x+w/2,y+alto/2,w,(X,Y)=>{const x0=X-w/2+3,y0=Y-alto/2+3,ww=w-6,hh=alto-6;g.fillStyle=`rgb(${tono+cal},${tono+cal*.7-4},${tono-10})`;g.beginPath();g.roundRect(x0,y0,ww,hh,6);g.fill();
            for(let k=0;k<30;k++)mancha(g,x0+rnd()*ww,y0+rnd()*hh,4+rnd()*10,rnd()<.5?'40,36,30':'200,190,170',.08);
            const gr=ga.createLinearGradient(0,y0,0,y0+hh);gr.addColorStop(0,'#b8b8b8');gr.addColorStop(.5,'#d8d8d8');gr.addColorStop(1,'#a0a0a0');ga.fillStyle=gr;ga.beginPath();ga.roundRect(x0,y0,ww,hh,8);ga.fill();});
          x+=w;}}
      const im=ga.getImageData(0,0,T,T);for(let i=0;i<im.data.length;i+=4){const v=(rnd()-.5)*26;im.data[i]+=v;im.data[i+1]+=v;im.data[i+2]+=v;}ga.putImageData(im,0,0);
      return {map:tex(c,true),normalMap:tex(normales(a,2.6))};}
    // Tejas de barro: hileras solapadas con el borde redondeado, tonos distintos y algo de musgo.
    function tejas(){const T=512,[c,g]=lienzo(T,T),[a,ga]=lienzo(T,T),alto=T/10,ancho=T/9;g.fillStyle='#3a1a12';g.fillRect(0,0,T,T);ga.fillStyle='#202020';ga.fillRect(0,0,T,T);
      for(let f=0;f<10;f++)for(let i=-1;i<=9;i++){const x=i*ancho+(f%2)*ancho/2,y=f*alto,t=rnd(),r=150+t*50,gg=62+t*30,b=40+t*18;
        const dib=(k2,col)=>{k2.fillStyle=col;k2.beginPath();k2.moveTo(x+2,y-4);k2.lineTo(x+ancho-2,y-4);k2.lineTo(x+ancho-2,y+alto*.72);k2.quadraticCurveTo(x+ancho/2,y+alto*1.12,x+2,y+alto*.72);k2.closePath();k2.fill();};
        dib(g,`rgb(${r},${gg},${b})`);const gr=ga.createLinearGradient(0,y,0,y+alto);gr.addColorStop(0,'#555');gr.addColorStop(1,'#e8e8e8');dib(ga,gr);
        mancha(g,x+ancho/2,y+alto*.2,ancho*.5,'30,10,5',.35);if(rnd()<.18)for(let k=0;k<5;k++)mancha(g,x+rnd()*ancho,y+rnd()*alto,3+rnd()*6,'70,90,40',.55);}
      return {map:tex(c,true),normalMap:tex(normales(a,2))};}
    // Tablas (puertas y contraventanas): tablones verticales, juntas, bandas de hierro y clavos.
    function tablas(){const T=256,[c,g]=lienzo(T,T),[a,ga]=lienzo(T,T),n=5;
      for(let i=0;i<n;i++){const x=i*T/n,t=rnd();g.fillStyle=`rgb(${88+t*24},${56+t*16},${34+t*10})`;g.fillRect(x,0,T/n,T);ga.fillStyle='#909090';ga.fillRect(x,0,T/n,T);
        for(let k=0;k<30;k++){const xx=x+rnd()*T/n;g.strokeStyle=`rgba(40,24,12,${.2+rnd()*.3})`;g.lineWidth=1;g.beginPath();g.moveTo(xx,0);g.lineTo(xx+(rnd()-.5)*8,T);g.stroke();}
        g.fillStyle='rgba(20,10,4,.9)';g.fillRect(x,0,2,T);ga.fillStyle='#202020';ga.fillRect(x,0,3,T);}
      for(const y of [T*.2,T*.78]){g.fillStyle='#2a2a2c';g.fillRect(0,y,T,14);ga.fillStyle='#e0e0e0';ga.fillRect(0,y,T,14);for(let i=0;i<n;i++){g.fillStyle='#55555a';g.beginPath();g.arc(i*T/n+T/n/2,y+7,3,0,TAU);g.fill();ga.fillStyle='#fff';ga.beginPath();ga.arc(i*T/n+T/n/2,y+7,3,0,TAU);ga.fill();}}
      return {map:tex(c,true),normalMap:tex(normales(a,2))};}
    // El letrero de la taberna: una jarra rebosante pintada sobre la tabla.
    function letrero(){const [c,g]=lienzo(256,160);g.fillStyle='#5a3a22';g.fillRect(0,0,256,160);for(let i=0;i<40;i++){g.strokeStyle=`rgba(30,18,8,${.2+rnd()*.3})`;g.beginPath();const y=rnd()*160;g.moveTo(0,y);g.lineTo(256,y+(rnd()-.5)*6);g.stroke();}
      g.strokeStyle='#c9a45a';g.lineWidth=6;g.strokeRect(8,8,240,144);g.fillStyle='#d9b46a';g.fillRect(96,52,60,76);g.fillStyle='#f4eed8';g.beginPath();g.ellipse(126,50,36,16,0,0,TAU);g.fill();g.beginPath();g.arc(112,40,12,0,TAU);g.arc(138,38,14,0,TAU);g.fill();
      g.strokeStyle='#d9b46a';g.lineWidth=10;g.beginPath();g.arc(160,88,20,-1.2,1.2);g.stroke();g.fillStyle='#8a6a30';for(const x of [104,122,140])g.fillRect(x,60,4,64);
      g.font="700 20px Georgia";g.fillStyle='#e8d098';g.textAlign='center';g.fillText('LA JARRA ROTA',128,150-6);return tex(c,true);}

    /* ---- Materiales -------------------------------------------------------------------- */
    const uniformes={uT:{value:0},uLuz:{value:1}};
    const estandar=(p)=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0,...p});
    const M={
      yeso:estandar({...yeso(),normalScale:new THREE.Vector2(.8,.8),roughness:.95}),
      madera:estandar({...madera(),roughness:.78,color:0xd8c8b8}),
      piedra:estandar({...sillares(),normalScale:new THREE.Vector2(1.3,1.3),roughness:.92}),
      teja:estandar({...tejas(),roughness:.7}),
      tablas:estandar({...tablas(),roughness:.8}),
      hierro:estandar({color:0x9a9aa2,metalness:.75,roughness:.45}),
      planta:estandar({roughness:.85,flatShading:true}),
      letrero:estandar({map:letrero(),roughness:.75}),
      agua:estandar({color:0x1e3c42,emissive:0x061214,roughness:.48,metalness:0,envMapIntensity:.2}),
      farol:new THREE.MeshBasicMaterial({color:new THREE.Color(4,2.4,1.1),vertexColors:false}),
    };
    // Las ventanas: interior mapping. Por cada píxel del cristal se sigue la mirada dentro de una habitación
    // (en unidades de la ventana: x -1..2, y -0.8..1.6, fondo 2.3 m) y se pinta lo que se vería.
    M.ventana=new THREE.ShaderMaterial({uniforms:uniformes,
      vertexShader:`attribute vec3 aT,aN;attribute vec2 aTam;attribute float aSem;varying vec3 vP,vT,vN;varying vec2 vUv,vTam;flat varying float vS;// flat: la semilla no se interpola (el hash amplificaría la diferencia mínima entre píxeles)
        void main(){vUv=uv;vTam=aTam;vS=aSem;vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vT=normalize(mat3(modelMatrix)*aT);vN=normalize(mat3(modelMatrix)*aN);gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:`uniform float uT,uLuz;varying vec3 vP,vT,vN;varying vec2 vUv,vTam;flat varying float vS;
        float h1(float n){return fract(sin(n*127.1+.7)*43758.5453);}
        float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        vec3 papel(vec2 q,float s){vec3 base=mix(vec3(.42,.16,.1),vec3(.2,.3,.2),h1(s*3.1));float raya=.82+.18*step(.5,fract(q.x*5.));
          vec3 c=base*raya;if(q.y<-.15){float t=fract(q.x*2.5);c=vec3(.3,.18,.1)*(.85+.15*step(.08,t)*step(t,.92));}return c;}
        void main(){
          float s=vS,enc=step(.16,h1(s*9.7))*uLuz,parp=.9+.1*sin(uT*7.+s*30.)*sin(uT*3.1+s*11.);
          vec3 U=vec3(0.,1.,0.),T=normalize(vT),N=normalize(vN),d=normalize(vP-cameraPosition);
          vec3 ld=vec3(dot(d,T)/vTam.x,dot(d,U)/vTam.y,dot(d,-N)/2.3)+vec3(1e-5);
          vec3 p=vec3(vUv,0.),lo=vec3(-1.,-.8,0.),hi=vec3(2.,1.6,1.);
          vec3 tp=(mix(lo,hi,step(0.,ld))-p)/ld;float t=min(min(tp.x,tp.y),tp.z);vec3 h=p+ld*t;
          vec3 col;
          if(t==tp.z){col=papel(h.xy,s);
            // La chimenea al fondo: el hueco oscuro y el fuego.
            vec2 cf=vec2(.5+(h1(s*5.)-.5)*.8,-.5);vec2 dq=(h.xy-cf)/vec2(.42,.3);
            if(max(abs(dq.x),abs(dq.y))<1.){col=vec3(.05,.03,.02);float fu=clamp(1.-length(dq*vec2(1.3,1.)+vec2(0.,.35)),0.,1.);col+=vec3(3.,1.3,.35)*fu*fu*parp*(.8+.4*h2(floor(h.xy*30.+uT*6.)));}
            // Un cuadro en la pared.
            vec2 cq=abs(h.xy-vec2(-.35,.85));if(cq.x<.28&&cq.y<.22)col=cq.x>.24||cq.y>.18?vec3(.55,.42,.18):mix(vec3(.12,.16,.22),vec3(.3,.25,.15),h.y);}
          else if(t==tp.y){if(ld.y<0.){float id=floor(h.x*4.),f=fract(h.x*4.);col=mix(vec3(.28,.16,.09),vec3(.4,.24,.13),h2(vec2(id,s)))*(.75+.25*smoothstep(0.,.08,f))*(.9+.1*sin(h.z*30.+id*5.));}
            else{col=vec3(.2,.14,.1)*(.7+.3*step(.2,fract(h.x*1.5)));}}
          else col=papel(vec2(h.z*1.3,h.y),s)*.9;
          // Luz: la lámpara del techo y el fuego del fondo.
          vec3 lampara=vec3(.5,1.3,.45),fuego=vec3(.5,-.55,.95);
          float l=.1+1.5/(1.+5.*dot(h-lampara,h-lampara))*parp;l+=1.2/(1.+7.*dot(h-fuego,h-fuego))*parp;
          col*=mix(vec3(1.,.72,.45),vec3(1.,.62,.36),h1(s*2.3))*l;
          // Cortinas a los lados (en el mismo cristal).
          float ondas=.02*sin(vUv.y*38.+s*7.),cor=step(vUv.x,.14+ondas)+step(.86-ondas,vUv.x);
          col=mix(col,vec3(.42,.05,.04)*(.35+.25*sin(vUv.x*60.))*parp,clamp(cor,0.,1.)*.94);
          // Vidrio emplomado en rombos, un poco verdoso.
          vec2 g=vUv*vTam*6.5;g=vec2(g.x+g.y,g.x-g.y);vec2 f=abs(fract(g)-.5);float fw=max(fwidth(g.x),fwidth(g.y));
          float plomo=smoothstep(.45-fw,.47+fw,max(f.x,f.y))*(1.-smoothstep(.15,.45,fw));
          col=mix(col*vec3(.96,1.,.9),vec3(.015),plomo*.85)*(1.-.12*smoothstep(.15,.45,fw));
          float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));col*=smoothstep(0.,.05,e);
          col*=2.6*enc+.035*(1.-enc);
          // El cielo reflejado en el vidrio (más de canto).
          float fr=pow(clamp(1.-dot(-d,N),0.,1.),4.);col+=vec3(.16,.2,.32)*(fr*.8+.05);
          gl_FragColor=vec4(col,1.);}`});
    // Halo en la fachada y luz en el suelo: cálidos, aditivos, con el mismo parpadeo y encendido que su ventana.
    const brillo=(forma)=>new THREE.ShaderMaterial({uniforms:uniformes,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`attribute float aSem;varying vec2 vUv;flat varying float vS;void main(){vUv=uv;vS=aSem;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uT,uLuz;varying vec2 vUv;flat varying float vS;float h1(float n){return fract(sin(n*127.1+.7)*43758.5453);}
        void main(){float enc=step(.16,h1(vS*9.7))*uLuz,parp=.9+.1*sin(uT*7.+vS*30.)*sin(uT*3.1+vS*11.);
          ${forma==='halo'?'vec2 q=(vUv-.5)*vec2(1.,1.15);float a=1.-smoothstep(.0,.5,length(q));a*=a*.85;':'vec2 q=vec2((vUv.x-.5)*1.6,1.-vUv.y);float a=(1.-smoothstep(0.,1.,length(q)))*(1.-smoothstep(.7,1.,1.-vUv.y));a*=a*.4;'}
          gl_FragColor=vec4(vec3(1.,.62,.3)*a*enc*parp,1.);}`});
    M.halo=brillo('halo');M.derrame=brillo('derrame');
    // Los cristales no deben entrar en la oclusión ambiental (GTAO): pegados al muro, salen moteados.
    M.ventana.userData.sinOclusion=true;
    for(const [k,m] of Object.entries(M))m.name=k;

    /* ---- Construcción --------------------------------------------------------------------
       Cada pieza se transforma a las coordenadas de la casa (el frente mira a +Z) y se guarda por material.
       UV de mundo (según hacia dónde mira cada cara) para que la textura tenga la misma escala en todas. */
    const mat4=(pos,rot=[0,0,0],esc=[1,1,1])=>new THREE.Matrix4().compose(new V3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot,'YXZ')),new V3(...esc));
    function uvMundo(geo,escala){const p=geo.attributes.position,n=geo.attributes.normal,uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));let u,v;
        if(ay>=ax&&ay>=az){u=p.getX(i);v=p.getZ(i);}else if(ax>=az){u=p.getZ(i);v=p.getY(i);}else{u=p.getX(i);v=p.getY(i);}uv[i*2]=u/escala;uv[i*2+1]=v/escala;}
      geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
    function Casa(){
      const piezas=new Map(),ventanas=[];let sem=0;
      // opc: uv ('mundo' o 'propio'), escala de la textura, sucio (oscurece abajo), tinte.
      function pon(mat,geo,m,opc={}){geo=geo.index?geo.toNonIndexed():geo.clone();geo.applyMatrix4(m);
        if(opc.uv!=='propio')uvMundo(geo,opc.escala??(mat==='madera'?.9:1.6));if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
        const p=geo.attributes.position,col=new Float32Array(p.count*3),t=opc.tinte||[1,1,1],var_=.9+rnd()*.2;
        for(let i=0;i<p.count;i++){const y=p.getY(i),ao=opc.sucio===false?1:.5+.5*Math.min(1,Math.max(0,(y-.05)/1.5));for(let k=0;k<3;k++)col[i*3+k]=t[k]*ao*var_;}
        geo.setAttribute('color',new THREE.BufferAttribute(col,3));if(!piezas.has(mat))piezas.set(mat,[]);piezas.get(mat).push(geo);return geo;}
      const caja=(mat,w,h,d,pos,rot,opc)=>pon(mat,new THREE.BoxGeometry(w,h,d),mat4(pos,rot),opc);
      // Un cuadro con atributos de ventana (tangente, normal, tamaño y semilla).
      function cuadro(mat,w,h,F,pos,attrs){const g=new THREE.PlaneGeometry(w,h);const geo=pon(mat,g,F.clone().multiply(mat4(pos)),{uv:'propio',sucio:false});
        const n=geo.attributes.position.count,q=new THREE.Quaternion(),s=new V3(),pp=new V3();F.decompose(pp,q,s);
        const T=new V3(1,0,0).applyQuaternion(q),N=new V3(0,0,1).applyQuaternion(q),A={aT:[T.x,T.y,T.z],aN:[N.x,N.y,N.z],aTam:[w,h],aSem:[attrs.sem]};
        for(const [k,v] of Object.entries(A)){const arr=new Float32Array(n*v.length);for(let i=0;i<n;i++)arr.set(v,i*v.length);geo.setAttribute(k,new THREE.BufferAttribute(arr,v.length));}
        return geo;}
      // Una fachada: F coloca x a lo largo del muro, y arriba, z hacia fuera (en la superficie del muro).
      function fachada(ang,dist,y0=0){const F=new THREE.Matrix4().makeRotationY(ang).multiply(new THREE.Matrix4().makeTranslation(0,y0,dist));
        const en=(pos,rot=[0,0,0])=>F.clone().multiply(mat4(pos,rot));return {F,alto:y0,
          caja:(mat,w,h,d,pos,rot,opc)=>pon(mat,new THREE.BoxGeometry(w,h,d),en(pos,rot),opc),
          geo:(mat,g,pos,rot,opc)=>pon(mat,g,en(pos,rot),opc)};}
      // Ventana: marco de roble, alféizar, el cristal con su habitación, y (si se pide) contraventanas abiertas y jardinera.
      function ventana(fa,x,y,w,h,opc={}){const s=++sem+rnd()*.5,m=.1,pr=.1;
        fa.caja('madera',w+2*m,m,pr+.04,[x,y+h/2+m/2,pr/2]);fa.caja('madera',w+2*m+.1,m*.9,pr+.1,[x,y+h/2+m*1.4,pr/2+.03]);
        fa.caja('madera',m,h,pr,[x-w/2-m/2,y,pr/2]);fa.caja('madera',m,h,pr,[x+w/2+m/2,y,pr/2]);
        fa.caja('madera',w+2*m+.14,.08,.26,[x,y-h/2-.04,.11]);
        // El cristal va delante del muro (que no tiene hueco); el marco, que sobresale, hace de jamba y la habitación pone la profundidad.
        cuadro('ventana',w,h,fa.F,[x,y,.022],{sem:s});ventanas.push({pos:new V3(x,y,.022).applyMatrix4(fa.F),normal:new V3(0,0,1).transformDirection(fa.F),sem:s,ancho:w,alto:h});
        if(opc.halo!==false)cuadro('halo',w*2.6,h*2.3,fa.F,[x,y+.1,.012],{sem:s});
        if(opc.suelo)cuadro('derrame',w*2.8,2.6,fa.F.clone().multiply(mat4([x,-fa.alto+.03,0],[-Math.PI/2,0,0])),[0,-1.3,0],{sem:s});
        if(opc.postigos)for(const lado of [-1,1]){const g=new THREE.BoxGeometry(w/2,h,.05).translate(lado*w/4,0,0);fa.geo('tablas',g,[x+lado*(w/2+m),y,.08],[0,lado*1.95,0],{escala:1.3});}
        if(opc.flores){fa.caja('madera',w+.1,.2,.22,[x,y-h/2-.2,.16]);for(let i=0;i<7;i++){const g=new THREE.IcosahedronGeometry(.09+rnd()*.05,0),v=rnd();
          fa.geo('planta',g,[x-w/2+.1+i*(w-.2)/6,y-h/2-.05+rnd()*.07,.16+(rnd()-.5)*.08],[rnd()*3,rnd()*3,0],{tinte:[.14+v*.1,.3+v*.14,.1],sucio:false});
          if(rnd()<.55)fa.geo('planta',new THREE.IcosahedronGeometry(.045,0),[x-w/2+.1+i*(w-.2)/6+(rnd()-.5)*.1,y-h/2+.05+rnd()*.05,.2],[0,0,0],{tinte:rnd()<.7?[.8,.12,.1]:[.9,.75,.8],sucio:false});}}
        return s;}
      function puerta(fa,x,w,h,alto0,opc={}){const y=alto0+h/2;fa.caja('madera',.14,h+.1,.16,[x-w/2-.07,y,.06]);fa.caja('madera',.14,h+.1,.16,[x+w/2+.07,y,.06]);fa.caja('madera',w+.46,.2,.2,[x,y+h/2+.1,.08]);
        fa.caja('tablas',w,h,.08,[x,y,.035],[0,0,0],{escala:1.1});fa.caja('hierro',.05,.18,.06,[x+w*.32,y,.10]);fa.caja('piedra',w+.5,.18,.5,[x,alto0-.09,.25]);
        if(opc.farol){const fx=x+(w/2+.45)*opc.farol;fa.caja('hierro',.06,.06,.42,[fx,y+.75,.21]);fa.caja('hierro',.22,.05,.22,[fx,y+.62,.4]);fa.caja('farol',.16,.24,.16,[fx,y+.46,.4],[0,0,0],{sucio:false});fa.caja('hierro',.2,.04,.2,[fx,y+.33,.4]);
          cuadro('halo',1.3,1.5,fa.F,[fx,y+.4,.02],{sem:900+sem});cuadro('derrame',2.2,2.4,fa.F.clone().multiply(mat4([fx,-fa.alto+.03,0],[-Math.PI/2,0,0])),[0,-1.2,0],{sem:900+sem});}}
      // Entramado de una planta: pies derechos, travesaño y tornapuntas en los paños sin ventana.
      function entramado(fa,largo,alto,huecos){const b=.16,x0=-largo/2,x1=largo/2,pr=.06;
        const cortes=[x0,...huecos.flatMap(([x,w])=>[x-w/2-.12,x+w/2+.12]),x1].sort((a,b)=>a-b);
        fa.caja('madera',b,alto,b,[x0+b/2,alto/2,pr/2]);fa.caja('madera',b,alto,b,[x1-b/2,alto/2,pr/2]);
        for(let i=0;i<cortes.length-1;i+=2){const a=cortes[i]+(i===0?b:0),c=cortes[i+1]-(i+1===cortes.length-1?b:0),w=c-a;if(w<.35)continue;
          if(i>0)fa.caja('madera',b,alto,b,[a+b/2,alto/2,pr/2]);if(i+1<cortes.length-1)fa.caja('madera',b,alto,b,[c-b/2,alto/2,pr/2]);
          fa.caja('madera',w,b*.8,b,[(a+c)/2,alto*.46,pr/2]);
          if(w>.7){const dir=(i/2)%2?1:-1,l=Math.hypot(w,alto*.46),ang=Math.atan2(alto*.46,w);fa.caja('madera',l,b*.8,b*.9,[(a+c)/2,alto*.23,pr/2+.005],[0,0,dir*ang]);fa.caja('madera',l,b*.8,b*.9,[(a+c)/2,alto*.73,pr/2+.005],[0,0,-dir*ang]);}}}
      // Tejado a dos aguas (cumbrera en X): dos losas de tejas con UV propias (u a lo largo, v pendiente abajo),
      // tablas de canto en los hastiales, cumbrera y los hastiales de yeso con su entramado.
      function tejado(W,D,yb,pend,vuelo,opc={}){const R=D/2*Math.tan(pend),L=(D/2+vuelo)/Math.cos(pend),ancho=W+2*vuelo;
        for(const s of [-1,1]){const g=new THREE.BoxGeometry(ancho,.14,L),p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/1.4,-s*p.getZ(i)/1.2);
          const zc=s*(L/2*Math.cos(pend)-vuelo/2*0),m=mat4([0,yb+R-L/2*Math.sin(pend)+.07,s*(L/2*Math.cos(pend))],[s*pend,0,0]);pon('teja',g,m,{uv:'propio',sucio:false,tinte:opc.tinteTeja});
          for(const x of [-ancho/2,ancho/2])caja('madera',.08,.3,L+.05,[x,yb+R-L/2*Math.sin(pend)-.04,s*(L/2*Math.cos(pend))],[s*pend,0,0],{sucio:false});
          // Tabla de alero: tapa el canto de la losa (sin ella se ve la teja estirada como una raya naranja).
          caja('madera',ancho+.1,.24,.07,[0,yb+R-L*Math.sin(pend)+.02,s*(D/2+vuelo+.03)],[s*pend*.35,0,0],{sucio:false});}
        caja('teja',ancho+.1,.2,.34,[0,yb+R+.12,0],[0,0,0],{escala:1.2,sucio:false,tinte:opc.tinteTeja});
        const tri=new THREE.Shape();tri.moveTo(-D/2,0);tri.lineTo(D/2,0);tri.lineTo(0,R);tri.lineTo(-D/2,0);
        for(const s of [-1,1]){const g=new THREE.ExtrudeGeometry(tri,{depth:.2,bevelEnabled:false});pon(opc.hastial||'yeso',g,mat4([s*W/2-(s>0?.2:0),yb,0],[0,Math.PI/2*(s>0?1:1),0]).multiply(mat4([0,0,0])),{escala:1.6});
          if((opc.hastial||'yeso')==='yeso'){const fa=fachada(s>0?Math.PI/2:-Math.PI/2,W/2+.01,yb);fa.caja('madera',.16,R-.1,.1,[0,(R-.1)/2,.03]);fa.caja('madera',D-.2,.14,.1,[0,.07,.03]);
            for(const k of [-1,1])fa.caja('madera',.12,Math.hypot(D/4,R*.5),.1,[k*D/4,R*.3,.03],[0,0,k*Math.atan2(D/4,R*.5)]);}}
        return R;}
      function chimenea(x,z,yBase,yTop){caja('piedra',.78,yTop-yBase,.78,[x,(yBase+yTop)/2,z],[0,0,0],{escala:1.4});caja('piedra',.96,.14,.96,[x,yTop+.07,z],[0,0,0],{sucio:false});
        pon('piedra',new THREE.CylinderGeometry(.12,.14,.34,8),mat4([x+.14,yTop+.3,z]),{sucio:false});pon('piedra',new THREE.CylinderGeometry(.1,.12,.28,8),mat4([x-.16,yTop+.27,z+.1]),{sucio:false});return new V3(x,yTop+.45,z);}
      return {piezas,ventanas,pon,caja,cuadro,fachada,ventana,puerta,entramado,tejado,chimenea,sem:()=>sem};
    }

    /* ---- Los tres tipos ----------------------------------------------------------------- */
    function entramada(C,o){const W=o.ancho??6,D=o.fondo??5,y0=.55,h1=2.7,h2=2.5,j=.4,D2=D+2*j,yJ=y0+h1,y2=yJ+.26,yT=y2+h2+.18,pend=o.pendiente??.9;
      C.caja('piedra',W+.3,y0,D+.3,[0,y0/2,0],[0,0,0],{escala:1.3});
      C.pon('yeso',new THREE.BoxGeometry(W,h1,D,1,3,1),mat4([0,y0+h1/2,0]),{tinte:o.tinteYeso});
      C.caja('madera',W+.06,.2,D+.06,[0,y0+.1,0]);
      for(const sx of [-1,1])for(const sz of [-1,1])C.caja('madera',.2,h1,.2,[sx*(W/2-.08),y0+h1/2,sz*(D/2-.08)]);
      C.caja('madera',W+.12,.28,D2+.1,[0,yJ+.13,0]);
      // Viguetas asomando bajo la planta volada y ménsulas en las esquinas.
      for(const sz of [-1,1]){for(let x=-W/2+.35;x<=W/2-.3;x+=.6)C.caja('madera',.13,.13,j+.12,[x,yJ-.04,sz*(D/2+j/2)]);
        for(const sx of [-1,1]){const g=new THREE.BoxGeometry(.16,.7,.16);C.pon('madera',g,mat4([sx*(W/2-.1),yJ-.28,sz*(D/2+.16)],[sz*.55,0,0]));}}
      C.pon('yeso',new THREE.BoxGeometry(W,h2,D2,1,2,1),mat4([0,y2+h2/2,0]),{tinte:o.tinteYeso});
      C.caja('madera',W+.08,.18,D2+.08,[0,yT-.09,0]);
      // Frente: planta baja (puerta, ventana con luz al suelo), planta alta (tres ventanas con flores y contraventanas).
      const fb=C.fachada(0,D/2,y0);C.puerta(fb,-W*.26,1.05,2.05,0,{farol:1});C.ventana(fb,W*.2,1.35,1.2,1.05,{suelo:true,postigos:true});C.entramado(fb,W,h1,[[-W*.26,1.05],[W*.2,1.2]]);
      const fa=C.fachada(0,D2/2,y2);const xs=[-W*.3,0,W*.3];xs.forEach((x,i)=>C.ventana(fa,x,1.3,.9,1.05,{flores:i!==1,postigos:i===1}));C.entramado(fa,W,h2,xs.map(x=>[x,.9]));
      const tr=C.fachada(Math.PI,D2/2,y2);C.ventana(tr,-W*.22,1.3,.9,1);C.ventana(tr,W*.22,1.3,.9,1);C.entramado(tr,W,h2,[[-W*.22,.9],[W*.22,.9]]);
      const tb=C.fachada(Math.PI,D/2,y0);C.ventana(tb,0,1.35,1,1,{suelo:true});C.entramado(tb,W,h1,[[0,1]]);
      for(const [a,s] of [[Math.PI/2,1],[-Math.PI/2,-1]]){const f=C.fachada(a,W/2,y2);C.ventana(f,s*.4,1.3,.8,1,{postigos:true});C.entramado(f,D2,h2,[[s*.4,.8]]);const f1=C.fachada(a,W/2,y0);C.entramado(f1,D,h1,[]);}
      const R=C.tejado(W,D2,yT,pend,.45,{tinteTeja:o.tinteTeja});
      const fg=C.fachada(Math.PI/2,W/2+.02,yT);C.ventana(fg,0,R*.38,.55,.6,{halo:true});
      return {alto:yT+R,humo:C.chimenea(W/2-.9,-D2/4,yT-.6,yT+R+.6),huella:[W+.4,D2+.4]};}
    function taberna(C,o){const W=o.ancho??7.6,D=o.fondo??6,y0=.3,h1=3,h2=2.5,j=.3,D2=D+2*j,yJ=y0+h1,y2=yJ+.26,yT=y2+h2+.18;
      C.caja('piedra',W+.2,y0,D+.2,[0,y0/2,0],[0,0,0],{escala:1.3});C.pon('piedra',new THREE.BoxGeometry(W,h1,D,1,3,1),mat4([0,y0+h1/2,0]),{escala:1.3});
      C.caja('madera',W+.12,.28,D2+.1,[0,yJ+.13,0]);for(const sz of [-1,1])for(let x=-W/2+.35;x<=W/2-.3;x+=.6)C.caja('madera',.13,.13,j+.12,[x,yJ-.04,sz*(D/2+j/2)]);
      C.pon('yeso',new THREE.BoxGeometry(W,h2,D2,1,2,1),mat4([0,y2+h2/2,0]),{tinte:o.tinteYeso||[1,.96,.88]});C.caja('madera',W+.08,.18,D2+.08,[0,yT-.09,0]);
      const fb=C.fachada(0,D/2,y0);C.puerta(fb,0,1.5,2.2,0,{farol:-1});for(const x of [-W*.3,W*.3])C.ventana(fb,x,1.5,1.4,1.25,{suelo:true,postigos:true});
      // El letrero colgado de su brazo de hierro.
      fb.caja('hierro',.06,.06,1.25,[1.3,2.75,.62]);fb.caja('hierro',.05,.5,.05,[1.3,2.5,1.2]);fb.caja('letrero',.9,.56,.05,[1.3,2.25,1.2],[0,Math.PI/2,0],{uv:'propio',sucio:false});
      const fa=C.fachada(0,D2/2,y2);const xs=[-W*.36,-W*.12,W*.12,W*.36];xs.forEach((x,i)=>C.ventana(fa,x,1.3,.85,1.05,{flores:i%2===0}));C.entramado(fa,W,h2,xs.map(x=>[x,.85]));
      const tr=C.fachada(Math.PI,D2/2,y2);for(const x of [-W*.25,W*.25])C.ventana(tr,x,1.3,.9,1);C.entramado(tr,W,h2,[[-W*.25,.9],[W*.25,.9]]);
      const tb=C.fachada(Math.PI,D/2,y0);C.ventana(tb,W*.2,1.6,1.1,1,{suelo:true});
      for(const [a,s] of [[Math.PI/2,1],[-Math.PI/2,-1]]){const f=C.fachada(a,W/2,y2);C.ventana(f,0,1.3,.8,1);C.entramado(f,D2,h2,[[0,.8]]);const f1=C.fachada(a,W/2,y0);C.ventana(f1,s*.6,1.6,1,1,{suelo:true,postigos:true});}
      // Toneles junto a la puerta.
      for(const [x,z] of [[-1.55,D/2+.55],[-2.2,D/2+.5],[-1.9,D/2+1.15]]){C.pon('madera',new THREE.CylinderGeometry(.36,.4,.95,10),mat4([x,.475,z]),{escala:.9});for(const y of [.2,.75])C.pon('hierro',new THREE.CylinderGeometry(.41,.41,.05,10,1,true),mat4([x,y,z]));}
      const R=C.tejado(W,D2,yT,.82,.5,{tinteTeja:o.tinteTeja||[.9,.95,1]});
      return {alto:yT+R,humo:C.chimenea(-W/2+1,0,yT-.5,yT+R+.7),huella:[W+.4,D2+.4]};}
    function piedra(C,o){const W=o.ancho??5.2,D=o.fondo??4.6,h1=3.1,yT=h1,pend=1;
      C.pon('piedra',new THREE.BoxGeometry(W,h1,D,1,3,1),mat4([0,h1/2,0]),{escala:1.3});C.caja('madera',W+.1,.2,D+.1,[0,yT-.1,0]);
      const fb=C.fachada(0,D/2,0);C.puerta(fb,-W*.22,1,2,0,{farol:-1});C.ventana(fb,W*.22,1.5,1,1,{suelo:true,postigos:true,flores:true});
      const tb=C.fachada(Math.PI,D/2,0);C.ventana(tb,0,1.5,.9,.9,{suelo:true});
      const fl=C.fachada(-Math.PI/2,W/2,0);C.ventana(fl,.3,1.5,.8,.9,{suelo:true,flores:true});
      const R=C.tejado(W,D,yT,pend,.5,{hastial:'piedra',tinteTeja:o.tinteTeja||[.85,.95,.85]});
      // Buhardilla en el faldón de delante: un pequeño hastial con su ventana y su tejadillo.
      const bz=D*.12,by=yT+R*.3,fd=C.fachada(0,bz+.55,by);C.caja('yeso',1.2,1.1,1.1,[0,by+.55,bz],[0,0,0],{tinte:[1,.97,.9]});C.ventana(fd,0,.55,.6,.6,{halo:true});
      for(const s of [-1,1])C.caja('teja',.9,.1,1.4,[s*.38,by+1.33,bz+.05],[0,0,s*.75],{escala:1.2,sucio:false});
      // Chimenea exterior de sillares, desde el suelo.
      C.caja('piedra',1.1,yT+R*.5,.7,[W/2+.35,(yT+R*.5)/2,-D*.15],[0,0,0],{escala:1.3});
      return {alto:yT+R,humo:C.chimenea(W/2+.35,-D*.15,yT+R*.5,yT+R+.9),huella:[W+1.2,D+.6]};}
    // El pozo de la plaza: brocal de sillares en tres hiladas a soga con remate de losas, el hueco oscuro con el
    // agua al fondo, dos postes de roble sobre zapatas con un tejadillo de tejas, el torno con la cuerda enrollada
    // y su manivela, el cubo colgado y otro sobre el brocal, el abrevadero de piedra y matas al pie.
    function pozo(C,o){const R=o.radio??1.02,hR=.86,anillo=.24,ri=R-anillo,rm=(ri+R)/2,n=14,hil=3,hh=hR/hil,tono=()=>{const v=.8+rnd()*.25;return [v,v*(.96+rnd()*.05),v*(.92+rnd()*.06)];};
      // Losas del pie, en corro.
      for(let i=0;i<16;i++){const a=i/16*TAU+(rnd()-.5)*.03,r=R+.27;C.pon('piedra',new THREE.BoxGeometry(TAU*r/16*.96,.07+rnd()*.02,.5),mat4([Math.sin(a)*r,.04,Math.cos(a)*r],[0,a+(rnd()-.5)*.06,0]),{escala:3,sucio:false,tinte:tono()});}
      // Alma de argamasa (tapa las juntas entre sillares) y los sillares, cada hilada desplazada media piedra.
      C.pon('piedra',new THREE.LatheGeometry([[ri+.03,0],[R-.04,0],[R-.04,hR],[ri+.03,hR],[ri+.03,0]].map(([x,y])=>new THREE.Vector2(x,y)),28),mat4([0,0,0]),{escala:1.3,tinte:[.42,.4,.37]});
      for(let h=0;h<hil;h++)for(let i=0;i<n;i++){const a=(i+(h%2)*.5+(rnd()-.5)*.08)/n*TAU,w=TAU*rm/n*(.9+rnd()*.07);
        C.pon('piedra',new THREE.BoxGeometry(w,hh*.9,anillo*(.95+rnd()*.12)),mat4([Math.sin(a)*(rm+(rnd()-.5)*.016),hh*(h+.5),Math.cos(a)*(rm+(rnd()-.5)*.016)],[0,a,(rnd()-.5)*.02]),{escala:3.2,tinte:tono()});}
      for(let i=0;i<12;i++){const a=(i+.25)/12*TAU,w=TAU*rm/12*.97;C.pon('piedra',new THREE.BoxGeometry(w,.1,anillo+.12),mat4([Math.sin(a)*(rm+.02),hR+.05,Math.cos(a)*(rm+.02)],[0,a,0]),{escala:3,sucio:false,tinte:tono().map(v=>v*1.08)});}
      // El hueco: forro hacia dentro (el perfil baja), más oscuro cuanto más hondo, y el agua.
      C.pon('piedra',new THREE.LatheGeometry([[ri-.005,hR+.02],[ri-.005,.5]].map(([x,y])=>new THREE.Vector2(x,y)),24),mat4([0,0,0]),{escala:1.2,sucio:false,tinte:[.45,.43,.4]});
      C.pon('piedra',new THREE.LatheGeometry([[ri-.005,.5],[ri-.03,.12]].map(([x,y])=>new THREE.Vector2(x,y)),24),mat4([0,0,0]),{escala:1.2,sucio:false,tinte:[.16,.16,.15]});
      C.pon('agua',new THREE.CircleGeometry(ri-.02,24),mat4([0,.14,0],[-Math.PI/2,0,0]),{uv:'propio',sucio:false});
      // Postes de roble sobre zapatas de piedra, la viga y los jabalcones.
      const X=R+.12,yV=2.3;
      for(const s of [-1,1]){C.caja('piedra',.34,.22,.34,[s*X,.11,0],[0,0,0],{escala:2.5,tinte:tono()});C.caja('madera',.17,yV-.2,.17,[s*X,.22+(yV-.2)/2-.1,0]);
        for(const z of [-1,1])C.pon('madera',new THREE.BoxGeometry(.1,.55,.1),mat4([s*X,yV-.3,z*.2],[z*.75,0,0]));}
      C.caja('madera',2*X+.3,.17,.19,[0,yV+.04,0]);
      const Rt=C.tejado(2*X+.2,1.5,yV+.12,.72,.28,{hastial:'madera',tinteTeja:o.tinteTeja});
      // El torno: eje que cruza los postes, la cuerda enrollada en el centro y la manivela de hierro.
      const yT=1.62;C.pon('madera',new THREE.CylinderGeometry(.065,.065,2*X+.34,10),mat4([0,yT,0],[0,0,Math.PI/2]),{escala:.5});
      C.pon('madera',new THREE.CylinderGeometry(.11,.11,.5,14),mat4([0,yT,0],[0,0,Math.PI/2]),{escala:.25,tinte:[1.55,1.25,.85],sucio:false});
      for(let i=0;i<7;i++)C.pon('madera',new THREE.TorusGeometry(.112,.016,5,16),mat4([-.21+i*.07,yT,0],[0,Math.PI/2,0]),{escala:.2,tinte:[1.45,1.15,.78],sucio:false});
      C.caja('hierro',.05,.34,.05,[X+.25,yT-.15,0]);C.pon('hierro',new THREE.CylinderGeometry(.025,.025,.22,8),mat4([X+.35,yT-.3,0],[0,0,Math.PI/2]));
      // La cuerda baja desde el rollo hasta el cubo, que cuelga sobre el hueco.
      const yC=1.2;C.pon('madera',new THREE.CylinderGeometry(.013,.013,yT-yC-.12,6),mat4([0,(yT+yC+.12)/2-.05,.11]),{escala:.2,tinte:[1.45,1.15,.78],sucio:false});
      const cubo=(pos,giro)=>{const F=mat4(pos,[0,giro,0]),en=(p,r=[0,0,0])=>F.clone().multiply(mat4(p,r));
        C.pon('tablas',new THREE.CylinderGeometry(.16,.125,.3,12),en([0,0,0]),{escala:.45,sucio:false});C.pon('tablas',new THREE.CircleGeometry(.15,12),en([0,.152,0],[-Math.PI/2,0,0]),{escala:.4,sucio:false,tinte:[.35,.33,.3]});
        for(const y of [.1,-.1])C.pon('hierro',new THREE.CylinderGeometry(.153+y*.12,.153+y*.12,.03,12,1,true),en([0,y,0]));
        C.pon('hierro',new THREE.TorusGeometry(.16,.01,4,14,Math.PI),en([0,.15,0]));};
      cubo([0,yC,.11],0);cubo([-Math.sin(.9)*rm,hR+.25,Math.cos(.9)*rm],.4);
      // El abrevadero: una pila de piedra con agua, a un lado y de cara a la plaza.
      {const F=mat4([R+.95,0,1.05],[0,-.75,0]),en=(p,r=[0,0,0])=>F.clone().multiply(mat4(p,r)),L=1.5,A=.55,H=.48,g=.09;
        C.pon('piedra',new THREE.BoxGeometry(L,.1,A),en([0,.05,0]),{escala:2.6,tinte:tono()});
        for(const s of [-1,1]){C.pon('piedra',new THREE.BoxGeometry(L,H,g),en([0,H/2,s*(A/2-g/2)]),{escala:2.6,tinte:tono()});C.pon('piedra',new THREE.BoxGeometry(g,H,A-2*g),en([s*(L/2-g/2),H/2,0]),{escala:2.6,tinte:tono()});}
        C.pon('agua',new THREE.PlaneGeometry(L-2*g,A-2*g),en([0,H-.08,0],[-Math.PI/2,0,0]),{uv:'propio',sucio:false});}
      // Matas al pie del brocal.
      for(let i=0;i<12;i++){const a=rnd()*TAU,r=R+.05+rnd()*.12,v=rnd();C.pon('planta',new THREE.IcosahedronGeometry(.07+rnd()*.06,0),mat4([Math.sin(a)*r,.05,Math.cos(a)*r],[rnd()*3,rnd()*3,0],[1,.6,1]),{tinte:[.16+v*.1,.3+v*.15,.1],sucio:false});}
      return {alto:yV+.12+Rt,huella:[2*X+.6,2*R+.6]};}
    const CONSTRUCTORES={entramada,taberna,piedra,pozo};

    // Una casa: un grupo con una malla por material (en coordenadas de la casa; el frente mira a +Z).
    function casa(tipo,o={}){semilla=((o.semilla??1)*48271)%2147483647||1;const C=Casa(),info=CONSTRUCTORES[tipo](C,o),g=new THREE.Group();let tri=0;
      for(const [nombre,lista] of C.piezas){const geo=unir(lista),m=new THREE.Mesh(geo,M[nombre]);const sombra=!['ventana','halo','derrame','farol'].includes(nombre);m.castShadow=sombra;m.receiveShadow=sombra;
        if(['halo','derrame'].includes(nombre))m.renderOrder=2;g.add(m);tri+=geo.attributes.position.count/3;}
      g.userData={tipo,...info,triangulos:Math.round(tri),ventanas:C.ventanas};return g;}
    // Junta geometrías con los mismos atributos.
    function unir(lista){const nombres=Object.keys(lista[0].attributes),r=new THREE.BufferGeometry();
      for(const n of nombres){const tam=lista[0].attributes[n].itemSize,tot=lista.reduce((a,g)=>a+g.attributes[n].count,0),arr=new Float32Array(tot*tam);let o=0;for(const g of lista){arr.set(g.attributes[n].array,o);o+=g.attributes[n].array.length;}r.setAttribute(n,new THREE.BufferAttribute(arr,tam));}
      r.computeBoundingSphere();return r;}
    // Todas las casas en una malla por material (en coordenadas del mundo): pocas llamadas de dibujo.
    function fundir(casas,opciones={}){
      const porMat=new Map(),opacidades=new Float32Array(casas.length).fill(1),cajas=[];
      for(const [indice,c] of casas.entries()){c.updateMatrixWorld(true);cajas.push(new THREE.Box3().setFromObject(c));for(const m of c.children){const g=m.geometry.clone(),mw=m.matrixWorld;g.applyMatrix4(mw);const nm=new THREE.Matrix3().getNormalMatrix(mw);
        if(opciones.ocultables)g.setAttribute('aCasa',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(indice),1));
        for(const k of ['aT','aN'])if(g.attributes[k]){g.attributes[k].applyNormalMatrix(nm);g.attributes[k].needsUpdate=true;}
        if(!porMat.has(m.material))porMat.set(m.material,{lista:[],malla:m});porMat.get(m.material).lista.push(g);}}
      const grupo=new THREE.Group();for(const [mat,{lista,malla}] of porMat){
        const material=opciones.ocultables?mat.clone():mat;
        if(opciones.ocultables){
          if(mat.isShaderMaterial)material.uniforms=mat.uniforms;
          const previo=mat.onBeforeCompile;
          material.onBeforeCompile=function(sh,r){previo.call(this,sh,r);sh.uniforms.uCasas={value:opacidades};
            sh.vertexShader='attribute float aCasa;varying float vCasa;\n'+sh.vertexShader;
            sh.vertexShader=sh.vertexShader.replace(/void main\(\)\s*\{/,'void main(){vCasa=aCasa;');
            sh.fragmentShader='varying float vCasa;uniform float uCasas['+casas.length+'];\n'+sh.fragmentShader;
            sh.fragmentShader=sh.fragmentShader.replace(/void main\(\)\s*\{/,`void main(){
              float muestraCasa=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
              if(muestraCasa>uCasas[int(vCasa+.5)])discard;`);
          };material.customProgramCacheKey=()=> 'casas-ocultables-'+casas.length+'-'+mat.uuid;
        }
        const m=new THREE.Mesh(unir(lista),material);m.castShadow=malla.castShadow;m.receiveShadow=malla.receiveShadow;m.renderOrder=malla.renderOrder;m.frustumCulled=false;grupo.add(m);
      }
      if(opciones.ocultables)grupo.userData.ocultacion={opacidades,cajas};
      return grupo;}
    return {casa,fundir,materiales:M,uniformes,TIPOS};
  }
  window.CAOZ_CASAS=Object.freeze({fabrica,TIPOS});
})();

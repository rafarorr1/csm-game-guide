/* Las cartas del sobre como cartas del visor 3D: salen del sobre boca abajo,
   en bonche, y cada una se voltea con grosor, relieve, metal, laca y holo de su
   edición (visor-3d-gl.js con las texturas de carta-pintor.js). Alrededor, la
   misma atmósfera del visor: motas de luz del color de la colección y chispas
   al romper el sello y al descubrir cada carta. Este módulo sólo dibuja; las
   fases, los botones y el inventario siguen en sobres-apertura.js. Si falta
   WebGL o el pintor, crear() devuelve null y la apertura usa sus capas DOM. */
'use strict';
(function(){
  const PI=Math.PI;
  const TONOS={
    normal:{canto:'#a88f63',chispa:'#f1c27a'},
    foil:{canto:'#e3ecf7',chispa:'#9fd0ff'},
    dorado:{canto:'#ffe7a3',chispa:'#ffd27a'},
  };
  const AURA={trucos:'#7fc1ff',juramentos:'#9fe0b4',caos:'#ffb08a'};
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const salida=t=>1-Math.pow(1-acotar(t),3);
  const vaiven=t=>{t=acotar(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
  const sprites=new Map();
  function sprite(color){
    if(sprites.has(color))return sprites.get(color);
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32);
    d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.18,color);d.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=d;g.fillRect(0,0,64,64);
    sprites.set(color,c);return c;
  }
  function lienzo(clase,z){const c=document.createElement('canvas');c.className=clase;c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:'+z;return c;}

  function crear(host,o={}){
    const GL=window.CAOZ_VISOR3D_GL,pintor=window.CAOZ_CARTA_PINTOR,diseno=window.CAOZ_CARTA_DISENO;
    if(!host||!GL||!pintor||!diseno||!Array.isArray(o.cartas)||!o.cartas.length)return null;
    const consulta=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reducir=()=>o.reducirMovimiento===true||!!consulta?.matches;
    const motas=lienzo('sobresMotas',1),cartas3D=lienzo('sobresCartas3D',4),chispas=lienzo('sobresChispas',6);
    const gl=GL.crear(cartas3D);if(!gl)return null;
    host.prepend(motas);host.append(cartas3D,chispas);
    const aura=AURA[o.grupo]||'#f1c27a';
    let W=1,H=1,dpr=1,alto=300,vivo=true,raf=0,antes=0,reloj=0,listo=false,visible=false,pulso=0;
    const incl={x:0,y:0,ox:0,oy:0};
    // Pose de cada carta del bonche; la primera es la de arriba.
    const poses=o.cartas.map((_,i)=>({x:i*3.2,y:i*2.6,z:-i*.06,rx:0,ry:PI,rz:(i%2?1:-1)*(.012+i*.01),s:1,fuera:false}));
    const tareas=new Set();

    function medir(){
      const r=host.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);
      alto=Math.min(H*.66,W*.6*1.4,640);
      gl.medir(W,H,dpr,alto);
      for(const c of [motas,chispas]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}
      pedir();
    }
    const observador=typeof ResizeObserver==='function'?new ResizeObserver(medir):null;observador?.observe(host);

    // Texturas de las cinco cartas (a media resolución) y del dorso con el logo.
    async function preparar(){
      try{
        await pintor.fuentes();
        const logo=new Image();logo.decoding='async';logo.src=o.logoUrl||'art/logo.webp';await diseno.cargada(logo);if(!vivo)return false;
        gl.cargarDorso(pintor.dorso(logo.naturalWidth?logo:null));
        const ancho=Math.min(W,H)<560?512:704;
        for(const [i,c]of o.cartas.entries()){
          await new Promise(r=>requestAnimationFrame(()=>r()));if(!vivo)return false;
          const nodo=c.nodo,arte=nodo?diseno.arteDe(nodo):{img:null};await diseno.cargada(arte.img);
          const tex=pintor.texturas({id:c.id,acabado:c.acabado||'normal',nombre:c.nombre,arte:{...arte,img:arte.img&&arte.img.naturalWidth?arte.img:null},ancho});
          gl.cargarFrente(tex,c.acabado||'normal',(TONOS[c.acabado]||TONOS.normal).canto,i);
        }
        listo=true;pedir();return true;
      }catch(error){console.warn('Sobres: se usan las cartas planas.',error);return false;}
    }

    function animar(ms,paso){
      return new Promise(resolve=>{
        if(!vivo||reducir()||document.hidden){paso(1);pedir();resolve();return;}
        const t0=performance.now(),tarea={paso,t0,ms,resolve};tareas.add(tarea);pedir();
      });
    }
    function avanzar(ahora){
      for(const t of [...tareas]){const k=acotar((ahora-t.t0)/t.ms);t.paso(k);if(k>=1){tareas.delete(t);t.resolve();}}
    }

    // Chispas: un estallido desde el centro de la carta, del color de su edición.
    const vivas=[];
    function rafaga(n,color,fuerza=1,cx=W/2,cy=H/2){
      if(reducir())return;
      for(let i=0;i<n;i++){
        const a=Math.random()*PI*2,v=(140+Math.random()*320)*fuerza;
        vivas.push({x:cx+(Math.random()-.5)*alto*.5,y:cy+(Math.random()-.5)*alto*.6,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.8-70,vida:.7+Math.random()*.7,t:0,r:2+Math.random()*3.5,color});
      }
      if(vivas.length>320)vivas.splice(0,vivas.length-320);
    }
    const puntos=Array.from({length:110},()=>({x:Math.random(),y:Math.random(),z:.35+Math.random()*.65,v:.018+Math.random()*.03,f:Math.random()*PI*2}));
    function dibujarMotas(dt){
      const g=motas.getContext('2d'),q=chispas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);q.setTransform(dpr,0,0,dpr,0,0);
      g.clearRect(0,0,W,H);q.clearRect(0,0,W,H);if(reducir())return;
      const luz=sprite(aura),n=Math.round(acotar(W*H/9000,30,puntos.length));
      g.globalCompositeOperation='lighter';
      for(let i=0;i<n;i++){
        const p=puntos[i],y=((p.y-reloj*p.v*p.z)%1+1)%1,x=p.x+Math.sin(reloj*.4+p.f)*.02*p.z;
        const a=(.3+.7*Math.pow(.5+.5*Math.sin(reloj*(1+p.z*2)+p.f*9),2))*Math.min(1,y*5,(1-y)*5)*p.z*.85,t=3+p.z*9;
        g.globalAlpha=a;g.drawImage(luz,x*W-t,y*H-t,t*2,t*2);
      }
      g.globalAlpha=1;g.globalCompositeOperation='source-over';
      q.globalCompositeOperation='lighter';
      for(let i=vivas.length-1;i>=0;i--){
        const c=vivas[i];c.t+=dt;if(c.t>=c.vida){vivas.splice(i,1);continue;}
        c.x+=c.vx*dt;c.y+=c.vy*dt;c.vx*=Math.exp(-2.2*dt);c.vy=c.vy*Math.exp(-2.2*dt)-30*dt;
        const a=1-c.t/c.vida,t=c.r*(1+a*1.5);q.globalAlpha=a;q.drawImage(sprite(c.color),c.x-t*2,c.y-t*2,t*4,t*4);
      }
      q.globalAlpha=1;q.globalCompositeOperation='source-over';
    }

    function cuadro(ahora){
      raf=0;if(!vivo)return;
      const dt=Math.min(.05,antes?(ahora-antes)/1000:0);antes=ahora;reloj+=dt;
      avanzar(ahora);
      incl.x+=(incl.ox-incl.x)*Math.min(1,dt*6);incl.y+=(incl.oy-incl.y)*Math.min(1,dt*6);
      dibujarMotas(dt);
      if(listo&&visible){
        const lista=[];
        poses.forEach((p,i)=>{
          if(p.fuera)return;
          // La de arriba ya descubierta flota y se inclina con el puntero.
          const viva=p.ry<.01&&!reducir(),f=viva?Math.sin(reloj*1.3+i)*4:0;
          lista.push({ranura:i,x:p.x,y:p.y+f,z:p.z,rx:p.rx+(viva?incl.y*.22:0),ry:p.ry+(viva?incl.x*.3:0),rz:p.rz,s:p.s});
        });
        gl.dibujarVarias({tiempo:reloj,luzX:incl.x,luzY:incl.y,pulso},lista);
      }
      if(vivo&&!document.hidden&&(tareas.size||vivas.length||!reducir()))raf=requestAnimationFrame(cuadro);
    }
    function pedir(){if(vivo&&!raf&&!document.hidden)raf=requestAnimationFrame(cuadro);}
    const mover=ev=>{const r=host.getBoundingClientRect();incl.ox=acotar((ev.clientX-r.left)/r.width*2-1,-1,1);incl.oy=acotar((ev.clientY-r.top)/r.height*2-1,-1,1);};
    const soltar=()=>{incl.ox=0;incl.oy=0;};
    host.addEventListener('pointermove',mover,{passive:true});host.addEventListener('pointerleave',soltar);
    const visibilidad=()=>{if(document.hidden){for(const t of [...tareas]){t.paso(1);tareas.delete(t);t.resolve();}}else pedir();};
    document.addEventListener('visibilitychange',visibilidad);
    medir();

    return Object.freeze({
      preparar,
      get listo(){return listo;},
      // Al romperse el sello: un estallido del color de la colección.
      romper(){rafaga(46,aura,1.1,W/2,H*.3);pedir();},
      // El bonche sube desde el sobre, boca abajo.
      async mostrar(){
        visible=true;cartas3D.style.opacity='1';
        await animar(700,t=>{const e=salida(t);poses.forEach((p,i)=>{p.y=i*2.6+(1-e)*H*.55;p.s=.86+.14*e;});});
      },
      // Descubre la carta i: la anterior sale por un lado y ésta se levanta y gira.
      async voltear(i){
        const c=o.cartas[i]||{},tono=TONOS[c.acabado]||TONOS.normal,rara=typeof CARDS!=='undefined'&&CARDS[c.id]?.r===2;
        const previa=poses[i-1],p=poses[i],z0=p.z;if(!p)return;
        const lado=i%2?-1:1,sale=previa?{x:previa.x,y:previa.y,rz:previa.rz,s:previa.s}:null;
        let estallo=false;
        await animar(c.acabado==='dorado'||rara?980:820,t=>{
          if(previa){const e=salida(acotar(t/.55));previa.x=sale.x+lado*e*(W*.5+alto);previa.y=sale.y-e*alto*.25;previa.rz=sale.rz+lado*e*.5;previa.s=sale.s*(1-e*.25);if(e>=1)previa.fuera=true;}
          const k=acotar((t-.12)/.88),e=vaiven(k);
          p.ry=PI*(1-e);p.z=z0+Math.sin(k*PI)*.9+e*.3;p.y=-Math.sin(k*PI)*alto*.08;p.x=0;p.rz=p.rz*(1-e);
          p.s=1+Math.sin(k*PI)*.12+e*.04;pulso=Math.max(0,Math.sin(acotar((k-.45)/.55)*PI));
          if(!estallo&&k>.5){estallo=true;rafaga(rara?110:c.acabado==='normal'?44:80,tono.chispa,rara?1.4:1.1);if(c.acabado!=='normal'||rara)rafaga(40,'#ffffff',.8);}
        });
        pulso=0;
      },
      async ocultar(){cartas3D.style.transition='opacity .45s ease';cartas3D.style.opacity='0';await animar(460,()=>{});visible=false;},
      destruir(){
        if(!vivo)return;vivo=false;if(raf)cancelAnimationFrame(raf);raf=0;
        for(const t of [...tareas]){tareas.delete(t);t.resolve();}
        observador?.disconnect();document.removeEventListener('visibilitychange',visibilidad);
        host.removeEventListener('pointermove',mover);host.removeEventListener('pointerleave',soltar);
        gl.destruir();motas.remove();cartas3D.remove();chispas.remove();
      }
    });
  }
  window.CAOZ_SOBRES_REVELACION=Object.freeze({crear});
})();

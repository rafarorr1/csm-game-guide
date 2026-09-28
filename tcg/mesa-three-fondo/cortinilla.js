/* La cortinilla entre la pantalla de carga y el menú principal, hecha con las
   cartas del visor 3D (visor-3d-gl.js y las texturas de carta-pintor.js):
   el logo de la carga se vuelve el dorso de una baraja; la baraja se abre en
   un carrusel que gira en 3D y voltea las cartas (holo y metal de su edición);
   el carrusel se deshace en un torbellino que llena la pantalla con un muro de cartas; una
   ola de luz lo recorre y, desde el centro, las cartas se abren como dos
   hojas de puerta y salen volando para dejar ver el menú.
   Este módulo sólo dibuja: la pantalla de carga y el menú son de quien llama.
   Sin WebGL o sin pintor, crear() devuelve null; con movimiento reducido,
   reproducir() sólo avisa y termina (quien llama funde carga y menú). */
'use strict';
(function(){
  const TAU=Math.PI*2,PI=Math.PI;
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const suave=t=>{t=acotar(t);return t*t*(3-2*t);};
  const salida=t=>1-Math.pow(1-acotar(t),3);
  const entrada=t=>Math.pow(acotar(t),3);
  const vaiven=t=>{t=acotar(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
  const entre=(t,a,b)=>acotar((t-a)/(b-a));
  const mezcla=(a,b,t)=>a+(b-a)*t;
  const CANTO={normal:'#a88f63',foil:'#e3ecf7',dorado:'#ffe7a3'};
  // Los tiempos de la cortinilla (s): baraja, rueda, torbellino, muro, apertura.
  const T={baraja:0,rueda:.55,torbellino:1.75,muro:2.6,apertura:3,fin:4.05};
  // La baraja inicial mide lo que el logo de la carga (una carta de alto A·BARAJA).
  const BARAJA=.72;

  const sprites=new Map();
  function sprite(color){
    if(sprites.has(color))return sprites.get(color);
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32);
    d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.2,color);d.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=d;g.fillRect(0,0,64,64);
    sprites.set(color,c);return c;
  }
  const pintar=(g,s,x,y,r,a)=>{if(a<=0||r<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(s,x-r,y-r,r*2,r*2);};
  function lienzo(clase,z){const c=document.createElement('canvas');c.className=clase;c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:'+z;return c;}
  function azar(semilla){let s=(semilla*2654435761)>>>0||1;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  const cargada=img=>new Promise(r=>{if(!img||img.complete)r(img);else{img.addEventListener('load',()=>r(img),{once:true});img.addEventListener('error',()=>r(img),{once:true});}});

  /* crear(host,{cartas:[{id,acabado,url,enc,nombre}],logoUrl,velocidad,reloj,reducir})
     → {preparar(progreso), reproducir({alCubrir}), saltar(), destruir()} o null. */
  function crear(host,o={}){
    const GL=window.CAOZ_VISOR3D_GL,pintor=window.CAOZ_CARTA_PINTOR;
    if(!host||!GL||!pintor||!Array.isArray(o.cartas)||!o.cartas.length)return null;
    const consulta=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reducir=()=>o.reducir===true||!!consulta?.matches;
    const capa3D=lienzo('cortinillaCartas',2),capa2D=lienzo('cortinillaLuz',3);
    const gl=GL.crear(capa3D);if(!gl)return null;
    host.append(capa3D,capa2D);
    const g=capa2D.getContext('2d');
    let W=1,H=1,dpr=1,A=300,vivo=true,raf=0,t0=0,salto=0,unicas=0,cartas=[],chispas=[],alCubrir=null,alAbrir=null,cubierto=false,abierto=false,terminar=null,terminado=false,jugando=false;

    // El muro que cubre la pantalla: filas × columnas de cartas a tamaño A.
    function medir(){
      const r=host.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);
      const filas=W>=H?3:4;A=H/(filas-.3);
      const ancho=A*5/7,cols=Math.ceil(W/(ancho*.97))+1;
      gl.medir(W,H,dpr,A);capa2D.width=Math.round(W*dpr);capa2D.height=Math.round(H*dpr);
      const rnd=azar(7),n=filas*cols,huecos=[];
      for(let f=0;f<filas;f++)for(let c=0;c<cols;c++){
        const x=(c-(cols-1)/2)*ancho*.97+(f%2?ancho*.25:-ancho*.25),y=(f-(filas-1)/2)*A*.97;
        huecos.push({x,y,rz:(rnd()-.5)*.06,d:Math.hypot(x/W,y/H)});
      }
      // La rueda reparte las cartas por el ángulo de su hueco: cada una sale en
      // línea recta hacia su sitio, sin cruzarse con las demás.
      huecos.sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
      const dmax=Math.max(...huecos.map(h=>h.d));
      cartas=huecos.map((h,i)=>({...h,i,n,ranura:i%Math.max(1,unicas||1),ang:i/n*TAU,orden:h.d/dmax,lado:h.x<0?-1:h.x>0?1:(i%2?1:-1),giro:(rnd()-.5)*.5}));
    }
    // Al cambiar de tamaño se recoloca el muro; sólo se dibuja mientras suena la cortinilla.
    const observador=typeof ResizeObserver==='function'?new ResizeObserver(()=>{medir();if(jugando&&!raf)raf=requestAnimationFrame(cuadro);}):null;

    /* Pinta las texturas de las cartas (una por fotograma, para que la pantalla
       de carga siga viva) y el dorso con el logo. progreso(k) de 0 a 1. */
    async function preparar(progreso=()=>{}){
      try{
        await pintor.fuentes();
        const logo=new Image();logo.decoding='async';logo.src=o.logoUrl||'art/logo.webp';await cargada(logo);if(!vivo)return false;
        gl.cargarDorso(pintor.dorso(logo.naturalWidth?logo:null));
        const r=host.getBoundingClientRect(),movil=Math.min(r.width,r.height)<560,lista=o.cartas.slice(0,movil?8:12);
        const ancho=movil?320:448;unicas=lista.length;
        for(const [i,c]of lista.entries()){
          await new Promise(r=>requestAnimationFrame(()=>r()));if(!vivo)return false;
          const img=new Image();img.decoding='async';if(c.url)img.src=c.url;await cargada(img);
          const tex=pintor.texturas({id:c.id,acabado:c.acabado||'normal',nombre:c.nombre,arte:{img:img.naturalWidth?img:null,enc:c.enc||{x:50,y:50,z:100}},ancho});
          gl.cargarFrente(tex,c.acabado||'normal',CANTO[c.acabado]||CANTO.normal,i);
          progreso((i+1)/lista.length);
        }
        medir();observador?.observe(host);return true;
      }catch(error){console.warn('Cortinilla: se usa el fundido.',error);return false;}
    }

    // La pose de cada carta en el instante t (segundos de la cortinilla).
    const norm=a=>{a=((a+PI)%TAU+TAU)%TAU-PI;return a;};
    function carrusel(c,t){
      // Un carrusel que gira sobre su eje vertical, visto algo desde arriba:
      // las de delante enseñan la cara y las de detrás, el dorso.
      const R=Math.min(W*.4,H*.75),k=3.5/A,d=Math.max(0,t-T.rueda),a=c.ang+.9*d+.55*d*d;
      return {x:Math.sin(a)*R,y:-H*.03+Math.cos(a)*R*.18,z:(Math.cos(a)-1)*R*k,rx:-.14,ry:norm(a),rz:0,s:.74};
    }
    function pose(c,t){
      const n=c.n;
      // 1 · La baraja: todas en el centro, boca abajo, del tamaño del logo.
      const aparece=salida(entre(t,0,.3)),sBaraja=BARAJA*(.9+.1*aparece)*(1+.05*Math.sin(PI*entre(t,.3,.55)));
      const baraja={x:0,y:-c.i*.5,z:-c.i*.04,rx:0,ry:PI,rz:(c.i%2?1:-1)*.01*c.i/n,s:sBaraja};
      // 2 · El carrusel: salen una a una de la baraja, dándose la vuelta.
      const sale=T.rueda+(c.i/n)*.45;if(t<sale)return baraja;
      const cr=carrusel(c,t);
      if(t<T.torbellino){const q=vaiven(entre(t,sale,sale+.55));
        return {x:mezcla(baraja.x,cr.x,q),y:mezcla(baraja.y,cr.y,q)-Math.sin(PI*q)*A*.25,z:mezcla(baraja.z,cr.z,q)+Math.sin(PI*q)*.8,rx:cr.rx*q,ry:mezcla(PI,cr.ry+(cr.ry<0?TAU:0),q),rz:mezcla(baraja.rz,0,q),s:mezcla(baraja.s,cr.s,q)};}
      // 3 · El torbellino: del carrusel a su hueco del muro, en espiral y pasando junto a la cámara.
      const parte=T.torbellino+c.orden*.45,e=vaiven(entre(t,parte,parte+.55)),giro=Math.sin(PI*e);
      const muro={x:mezcla(cr.x,c.x,e),y:mezcla(cr.y,c.y,e),z:mezcla(cr.z,0,e)+giro*5,rx:mezcla(cr.rx,0,e),ry:mezcla(cr.ry,0,e),rz:c.rz+giro*(c.lado*.9),s:mezcla(cr.s,1.03,e)};
      if(t<T.apertura)return muro;
      // 4 · La apertura: desde el centro, cada carta gira como una hoja de puerta y sale volando.
      const vuela=T.apertura+Math.min(1,Math.abs(c.x)/(W/2))*.35+c.orden*.08,v=entre(t,vuela,vuela+.7),ev=entrada(v);
      return {x:c.x+c.lado*W*.75*ev,y:c.y+(c.y/H)*H*.3*ev-40*Math.sin(PI*v),z:4*salida(v),rx:.3*ev,ry:c.lado*PI*.85*salida(v),rz:c.rz+c.lado*.45*ev,s:1.03};
    }

    function dibujar(t,dt){
      const lista=[];for(const c of cartas){const p=pose(c,t);if(Math.abs(p.x)<W*1.6)lista.push({ranura:c.ranura,...p});}
      const ola=entre(t,T.muro-.05,T.apertura+.2),luzX=t<T.muro?.35*Math.sin(t*1.7):mezcla(-1.6,1.6,vaiven(ola));
      const pulso=.25*Math.exp(-Math.pow((t-T.rueda-.05)*6,2))+.35*Math.sin(PI*ola)+.3*Math.exp(-Math.pow((t-T.apertura)*7,2));
      gl.dibujarVarias({tiempo:t,luzX,luzY:-.2+.3*Math.sin(t*.8),pulso,pila:0},lista);
      // La luz: motas, chispas en las estelas, el fogonazo de la baraja y la costura de luz al abrirse.
      g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);g.globalCompositeOperation='lighter';
      const oro=sprite('rgba(255,210,120,.85)'),lila=sprite('rgba(190,150,255,.7)'),cx=W/2,cy=H/2;
      pintar(g,oro,cx,cy,A*1.1,.5*Math.exp(-Math.pow((t-T.rueda)*5,2)));
      if(t>T.rueda&&t<T.muro)for(let k=0;k<3;k++){const c=cartas[Math.floor(Math.random()*cartas.length)],p=pose(c,t);if(Math.abs(p.ry)<PI*.95)chispas.push({x:cx+p.x,y:cy+p.y,vx:(Math.random()-.5)*60,vy:(Math.random()-.5)*60,t:0,vida:.5+Math.random()*.5,r:2+Math.random()*3,c:Math.random()<.3});}
      for(let i=chispas.length-1;i>=0;i--){const s=chispas[i];s.t+=dt;if(s.t>=s.vida){chispas.splice(i,1);continue;}s.x+=s.vx*dt;s.y+=s.vy*dt;pintar(g,s.c?lila:oro,s.x,s.y,s.r*2.2,1-s.t/s.vida);}
      const costura=entre(t,T.apertura-.1,T.apertura+.55);
      if(costura>0&&costura<1){const a=Math.sin(PI*costura),ancho=6+costura*W*.25;
        const gr=g.createLinearGradient(cx-ancho,0,cx+ancho,0);gr.addColorStop(0,'rgba(255,220,150,0)');gr.addColorStop(.5,'rgba(255,240,200,'+.85*a+')');gr.addColorStop(1,'rgba(255,220,150,0)');
        g.globalAlpha=1;g.fillStyle=gr;g.fillRect(cx-ancho,0,ancho*2,H);pintar(g,oro,cx,cy,Math.max(W,H)*.35*(.5+costura),.55*a);}
      g.globalCompositeOperation='source-over';g.globalAlpha=1;
      if(!cubierto&&t>=T.muro){cubierto=true;try{alCubrir?.();}catch(_){}}
      if(!abierto&&t>=T.apertura){abierto=true;try{alAbrir?.();}catch(_){}}
    }
    let previo=-1;
    function cuadro(ahora){
      raf=0;if(!vivo||!jugando)return;
      const t=(typeof o.reloj==='function'?o.reloj():(ahora-t0)/1000*(o.velocidad||1))+salto,dt=previo<0?0:Math.min(.1,Math.max(0,t-previo));previo=t;
      dibujar(t,dt);
      if(t>=T.fin&&(!chispas.length||t>=T.fin+.8)){acabar();return;}
      raf=requestAnimationFrame(cuadro);
    }
    function acabar(){if(terminado)return;terminado=true;jugando=false;cancelAnimationFrame(raf);raf=0;if(!cubierto){cubierto=true;try{alCubrir?.();}catch(_){}}if(!abierto){abierto=true;try{alAbrir?.();}catch(_){}}capa3D.style.opacity='0';capa2D.style.opacity='0';terminar?.();}

    /* reproducir({alCubrir,alAbrir}): alCubrir se llama cuando el muro tapa la
       pantalla (momento de cambiar la carga por el menú detrás) y alAbrir cuando
       empieza a abrirse (el menú hace su entrada). La promesa se
       cumple al terminar (true) o sin animación (false). */
    function reproducir(op={}){
      alCubrir=op.alCubrir||null;alAbrir=op.alAbrir||null;
      if(!vivo||reducir()||document.hidden||!cartas.length){acabar();return Promise.resolve(false);}
      return new Promise(r=>{terminar=()=>r(true);const seguro=setTimeout(acabar,(T.fin+3)*1000/(o.velocidad||1));const fin=terminar;terminar=()=>{clearTimeout(seguro);fin();};
        t0=performance.now();previo=-1;jugando=true;raf=requestAnimationFrame(cuadro);});
    }
    // Saltar: se va directo a la apertura (el menú ya está detrás); si ya se abre, termina.
    function saltar(){
      if(terminado||!raf)return;const t=previo<0?0:previo;
      if(t<T.apertura-.1){salto+=T.apertura-.1-t;}else acabar();
    }
    function destruir(){vivo=false;cancelAnimationFrame(raf);observador?.disconnect();gl.destruir();capa3D.remove();capa2D.remove();}
    return {preparar,reproducir,saltar,destruir,get tiempos(){return {...T};}};
  }
  window.CAOZ_CORTINILLA=Object.freeze({crear,TIEMPOS:Object.freeze({...T}),BARAJA});
})();

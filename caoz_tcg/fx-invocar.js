/* Invocar una carta: sale de la mano como carta 3D del visor (grosor, canto
   de metal, laca y holo de su edición; visor-3d-gl.js), sube hacia la cámara
   dando una vuelta, cae sobre su casilla y golpea la mesa: anillo de polvo,
   onda, chispas del color de su edición y un leve temblor. Las legendarias
   se detienen en lo alto entre rayos de luz y caen con más fuerza. Las fichas
   no vienen de la mano: aparecen del aire, girando.
   La cara es la imagen pintada de la propia carta (su .cjCara o un lienzo):
   no se repinta nada, así que no hay espera. Varias invocaciones a la vez
   comparten un solo lienzo WebGL y uno 2D. Sin WebGL, sin cara, con
   movimiento reducido o con la pestaña oculta, invocar() devuelve false y
   quien llama usa su animación de siempre. */
'use strict';
(function(){
  const TAU=Math.PI*2,PI=Math.PI;
  const acotar=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const salida=t=>1-Math.pow(1-acotar(t),3);
  const entrada=t=>Math.pow(acotar(t),2.2);
  const vaiven=t=>{t=acotar(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
  const entre=(t,a,b)=>acotar((t-a)/(b-a));
  const mezcla=(a,b,t)=>a+(b-a)*t;
  const EDICION={
    normal:{canto:'#a88f63',chispa:[255,205,120],orm:'rgb(255,150,10)',mascara:'rgb(30,50,0)'},
    foil:{canto:'#e3ecf7',chispa:[150,215,255],orm:'rgb(255,95,70)',mascara:'rgb(170,150,0)'},
    dorado:{canto:'#ffe7a3',chispa:[255,220,120],orm:'rgb(255,80,160)',mascara:'rgb(150,210,0)'},
  };
  const plano=(color,w=4,h=4)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,w,h);return c;};
  const sprites=new Map();
  function sprite(rgb,a=.9,centro=true){
    const k=rgb.join()+a+centro;if(sprites.has(k))return sprites.get(k);
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),d=g.createRadialGradient(32,32,0,32,32,32),col=x=>'rgba('+rgb.join(',')+','+x+')';
    if(centro){d.addColorStop(0,'rgba(255,255,255,1)');d.addColorStop(.25,col(a));}else{d.addColorStop(0,col(a));d.addColorStop(.5,col(a*.5));}
    d.addColorStop(1,col(0));g.fillStyle=d;g.fillRect(0,0,64,64);sprites.set(k,c);return c;
  }
  const pintar=(g,s,x,y,r,a)=>{if(a<=0||r<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(s,x-r,y-r,r*2,r*2);};
  const quieto=o=>{const q=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;return !!(o.reducir??q?.matches)||document.hidden;};

  // Un escenario por host: un lienzo WebGL y uno 2D sobre toda la pantalla.
  const escenarios=new WeakMap();
  function escenario(host){
    let e=escenarios.get(host);if(e&&e.vivo)return e;
    const GL=window.CAOZ_VISOR3D_GL;if(!GL)return null;
    const capa=(z,clase)=>{const c=document.createElement('canvas');c.className=clase;c.setAttribute('aria-hidden','true');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;return c;};
    const c3=capa(30,'fxInvocar3D'),c2=capa(31,'fxInvocarLuz'),gl=GL.crear(c3);if(!gl)return null;
    host.append(c3,c2);
    e={vivo:true,host,c3,c2,g:c2.getContext('2d'),gl,vuelos:new Set(),chispas:[],anillos:[],destellos:[],ranuras:[],dorso:false,raf:0,antes:0,W:1,H:1,dpr:1,alto:0};
    escenarios.set(host,e);return e;
  }
  function prepararDorso(e){
    if(e.dorso)return Promise.resolve(true);
    const P=window.CAOZ_CARTA_PINTOR;if(!P)return Promise.resolve(false);
    return new Promise(r=>{const logo=new Image();const fin=()=>{try{e.gl.cargarDorso(P.dorso(logo.naturalWidth?logo:null));e.dorso=true;r(true);}catch(_){r(false);}};
      logo.onload=fin;logo.onerror=fin;logo.src=e.logoUrl||'art/logo.webp';});
  }
  function medir(e,alto){
    const r=e.host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(r.width!==e.W||r.height!==e.H||dpr!==e.dpr||alto!==e.alto){e.W=Math.max(1,r.width);e.H=Math.max(1,r.height);e.dpr=dpr;e.alto=alto;e.gl.medir(e.W,e.H,dpr,alto);e.c2.width=Math.round(e.W*dpr);e.c2.height=Math.round(e.H*dpr);}
  }
  const libre=e=>{for(let i=0;i<8;i++)if(!e.ranuras[i])return i;return -1;};
  // La profundidad que agranda la carta f veces (la cámara del visor está a dist unidades).
  const zoom=(v,f)=>v.dist*(1-1/f);

  // La pose de un vuelo en el instante t (s), en píxeles desde el centro del host.
  function pose(v,t){
    const T=v.T,p=entre(t,0,T.cae);
    if(v.aire){
      // Del aire: baja girando desde arriba de su casilla.
      const q=salida(p);
      return {x:v.fin.x,y:mezcla(v.fin.y-v.alto*1.6,v.fin.y,entrada(p)),z:mezcla(zoom(v,1.5),0,q),rx:mezcla(-.5,0,q),ry:mezcla(TAU*1.5,0,q),rz:0,s:mezcla(.5,1,q)};
    }
    // Sube hacia la cámara dando una vuelta; en lo alto (legendaria) se detiene; después cae.
    const sube=entre(t,0,T.alto),espera=entre(t,T.alto,T.pausa),cae=entre(t,T.pausa,T.cae);
    // La cumbre queda del lado del centro de la mesa (arriba para ti, abajo para el rival); la legendaria, casi en el centro.
    const cumbre=v.legendaria?{x:mezcla(v.fin.x,0,.6),y:mezcla(v.fin.y,0,.7),z:zoom(v,2.1)}:{x:mezcla(v.ini.x,v.fin.x,.8),y:v.fin.y+(v.arriba?1:-1)*v.alto*.5,z:zoom(v,1.55)};
    if(t<T.alto){const q=vaiven(sube);
      return {x:mezcla(v.ini.x,cumbre.x,q),y:mezcla(v.ini.y,cumbre.y,q),z:mezcla(0,cumbre.z,q),rx:mezcla(-.35,-.15,q),ry:q*TAU,rz:mezcla(v.lado*.25,0,q),s:mezcla(v.sIni,1,q)};}
    if(t<T.pausa)return {x:cumbre.x,y:cumbre.y-Math.sin(PI*espera)*v.alto*.05,z:cumbre.z,rx:-.15+.1*Math.sin(espera*PI*2),ry:Math.sin(espera*PI*2)*.25,rz:0,s:1};
    const q=entrada(cae);
    return {x:mezcla(cumbre.x,v.fin.x,q),y:mezcla(cumbre.y,v.fin.y,q),z:mezcla(cumbre.z,0,q),rx:mezcla(-.15,.28,q),ry:0,rz:0,s:1};
  }
  function impacto(e,v){
    const col=EDICION[v.acabado]||EDICION.normal,f=v.legendaria?1.6:1,cx=e.W/2+v.fin.x,cy=e.H/2+v.fin.y,base=cy+v.alto*.42;
    e.anillos.push({x:cx,y:base,t:0,vida:.55*f,r0:v.ancho*.45,r1:v.ancho*(1.6+.6*f),col:col.chispa,grosor:v.ancho*.09*f});
    e.destellos.push({x:cx,y:cy+v.alto*.2,t:0,vida:.35*f,r:v.ancho*1.4*f,col:col.chispa});
    if(v.legendaria)e.anillos.push({x:cx,y:base,t:-.08,vida:.8,r0:v.ancho*.5,r1:v.ancho*3,col:[255,240,200],grosor:4});
    const esc=v.ancho/100;
    // Chispas que salen rasantes a los lados y algunas hacia arriba.
    for(let i=0;i<Math.round(34*f);i++){const a=i%3?(i%2?PI:0)+(i%2?1:-1)*(Math.random()*.7):-PI/2+(Math.random()-.5)*1.4,vel=(160+Math.random()*320)*f*esc;
      e.chispas.push({x:cx+(Math.random()-.5)*v.ancho*.8,y:base,vx:Math.cos(a)*vel,vy:Math.sin(a)*vel*.8-40*esc,t:0,vida:.35+Math.random()*.5,r:(1.8+Math.random()*2.4)*esc,col:col.chispa,g:700*esc});}
    for(let i=0;i<14;i++){const lado=i%2?1:-1;
      e.chispas.push({x:cx+lado*v.ancho*(.25+Math.random()*.3),y:base,vx:lado*(60+Math.random()*160)*esc,vy:-Math.random()*50*esc,t:0,vida:.6+Math.random()*.5,r:v.ancho*(.16+Math.random()*.14),col:[170,150,125],polvo:true,g:-20});}
    // La carta real aparece y encaja el golpe; la mesa tiembla un instante.
    v.carta.style.visibility=v.visibilidad;
    v.carta.animate?.([{transform:'scale(1.07,.93)'},{transform:'scale(.98,1.03)',offset:.45},{transform:'scale(1)'}],{duration:260*f,easing:'ease-out'});
    const m=v.sacudir;if(m){const a=3*f;m.animate?.([{translate:'0 0'},{translate:'0 '+a+'px'},{translate:(-a*.6)+'px '+(-a*.4)+'px'},{translate:(a*.4)+'px 0'},{translate:'0 0'}],{duration:260*f});}
  }
  function cuadro(e,ahora){
    e.raf=0;if(!e.vivo)return;
    // Con el reloj de revisión, las partículas siguen ese mismo reloj.
    const ahoraT=typeof e.reloj==='function'?e.reloj():ahora/1000,dt=e.antes?Math.min(.05,Math.max(0,ahoraT-e.antes)):0;e.antes=ahoraT;
    const lista=[];let pulso=0;
    for(const v of [...e.vuelos]){
      const t=(typeof v.reloj==='function'?v.reloj():(ahora-v.t0)/1000*v.vel);v.t=t;
      if(t>=v.T.cae){if(!v.golpe){v.golpe=true;impacto(e,v);}e.vuelos.delete(v);e.ranuras[v.ranura]=null;v.resolver(true);continue;}
      lista.push({ranura:v.ranura,...pose(v,t)});
      if(v.legendaria)pulso=Math.max(pulso,Math.sin(PI*entre(t,v.T.alto-.1,v.T.pausa+.05)));
    }
    if(lista.length)e.gl.dibujarVarias({tiempo:ahora/1000,luzX:.4*Math.sin(ahora/700),luzY:-.3,pulso:pulso*.6,pila:0},lista);
    else e.gl.dibujarVarias({tiempo:0,luzX:0,luzY:0,pulso:0,pila:0},[]);
    const g=e.g;g.setTransform(e.dpr,0,0,e.dpr,0,0);g.clearRect(0,0,e.W,e.H);g.globalCompositeOperation='lighter';
    // La luz de las legendarias en lo alto: rayos y halo detrás.
    for(const v of e.vuelos){
      if(!v.legendaria)continue;const t=v.t,a=Math.sin(PI*entre(t,v.T.alto-.15,v.T.pausa+.1));if(a<=0)continue;
      const p=pose(v,t),x=e.W/2+p.x,y=e.H/2+p.y,R=v.alto*1.3;
      pintar(g,sprite([255,215,130],.7,false),x,y,R,.8*a);
      g.save();g.translate(x,y);g.rotate(t*.8);for(let i=0;i<12;i++){g.rotate(TAU/12);const gr=g.createLinearGradient(0,0,R*1.6,0);gr.addColorStop(0,'rgba(255,235,180,'+.35*a+')');gr.addColorStop(1,'rgba(255,220,150,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,0);g.lineTo(R*1.6,-R*.07);g.lineTo(R*1.6,R*.07);g.fill();}g.restore();
    }
    for(let i=e.destellos.length-1;i>=0;i--){const d=e.destellos[i];d.t+=dt;if(d.t>=d.vida){e.destellos.splice(i,1);continue;}const p=d.t/d.vida;pintar(g,sprite(d.col,.8),d.x,d.y,d.r*(.6+.6*p),(1-p)*.9);}
    for(let i=e.anillos.length-1;i>=0;i--){const a=e.anillos[i];a.t+=dt;if(a.t>=a.vida){e.anillos.splice(i,1);continue;}if(a.t<0)continue;
      const p=salida(a.t/a.vida),r=mezcla(a.r0,a.r1,p);g.globalAlpha=1-p;g.strokeStyle='rgba('+a.col.join(',')+',.9)';g.lineWidth=a.grosor*(1-p)+1;g.beginPath();g.ellipse(a.x,a.y,r,r*.28,0,0,TAU);g.stroke();}
    for(let i=e.chispas.length-1;i>=0;i--){const s=e.chispas[i];s.t+=dt;if(s.t>=s.vida){e.chispas.splice(i,1);continue;}
      s.vy+=s.g*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=1-(s.polvo?2.5:1)*dt;
      if(s.polvo){g.globalCompositeOperation='source-over';pintar(g,sprite(s.col,.35,false),s.x,s.y,s.r*(1+s.t*1.5),(1-s.t/s.vida)*.7);g.globalCompositeOperation='lighter';}
      else pintar(g,sprite(s.col,.9),s.x,s.y,s.r*2,1-s.t/s.vida);}
    g.globalCompositeOperation='source-over';g.globalAlpha=1;
    if(e.vuelos.size||e.chispas.length||e.anillos.length||e.destellos.length)e.raf=requestAnimationFrame(t=>cuadro(e,t));
    else{e.antes=0;e.c3.style.visibility='hidden';e.c2.style.visibility='hidden';}
  }
  function arrancar(e){e.c3.style.visibility='';e.c2.style.visibility='';if(!e.raf)e.raf=requestAnimationFrame(t=>cuadro(e,t));}

  /* invocar(host,{carta,imagen,desde,lado,acabado,legendaria,aire,sacudir,velocidad,reloj,reducir})
     host: capa fija sobre la pantalla (p. ej. #fx). carta: el nodo ya colocado
     en su casilla (se oculta durante el vuelo). imagen: su cara pintada
     (por defecto, su .cjCara o su primer canvas). desde: nodo o rect de donde
     sale (la carta de la mano); sin él, del borde de su lado (lado 'abajo' o
     'arriba'). aire: aparece del aire (fichas). → Promise<boolean> al caer. */
  async function invocar(host,o){
    const carta=o.carta;if(!host||!carta||quieto(o))return false;
    const cara=o.imagen||carta.querySelector(':scope > .cjCara, :scope > canvas');
    if(!cara||(cara.tagName==='IMG'&&!(cara.complete&&cara.naturalWidth)))return false;
    const e=escenario(host);if(!e)return false;
    if(!await prepararDorso(e))return false;
    const ranura=libre(e);if(ranura<0)return false;
    const hr=host.getBoundingClientRect(),cr=carta.getBoundingClientRect();if(!cr.width)return false;
    const acabado=EDICION[o.acabado]?o.acabado:'normal',ed=EDICION[acabado];
    try{e.gl.cargarFrente({color:cara,normal:plano('rgb(128,128,255)'),orm:plano(ed.orm),mascara:plano(ed.mascara)},acabado,ed.canto,ranura);}catch(_){return false;}
    medir(e,cr.height);
    const centro=r=>({x:r.left+r.width/2-hr.left-e.W/2,y:r.top+r.height/2-hr.top-e.H/2});
    const fin=centro(cr),arriba=o.lado==='arriba';
    let ini,sIni=.8;
    if(o.desde){const d=o.desde.getBoundingClientRect?o.desde.getBoundingClientRect():o.desde;ini=centro(d);sIni=d.height/cr.height||.8;}
    else ini={x:fin.x*.4,y:arriba?-e.H/2-cr.height*.6:e.H/2+cr.height*.6};
    const leg=!!o.legendaria;
    const T=o.aire?{alto:0,pausa:0,cae:.5}:leg?{alto:.42,pausa:.95,cae:1.2}:{alto:.36,pausa:.36,cae:.58};
    const v={carta,ranura,acabado,ini,fin,sIni,dist:3.5*e.H/(cr.height*2*Math.tan(PI/12)),alto:cr.height,ancho:cr.width,legendaria:leg,aire:!!o.aire,arriba,lado:ini.x<fin.x?-1:1,T,
      sacudir:o.sacudir||null,vel:o.velocidad||1,reloj:o.reloj,t0:performance.now(),visibilidad:carta.style.visibility||''};
    e.ranuras[ranura]=v;carta.style.visibility='hidden';e.reloj=o.reloj||null;
    return new Promise(resolver=>{
      v.resolver=resolver;e.vuelos.add(v);arrancar(e);
      // Seguridad: si el bucle se detiene (pestaña oculta), la carta aparece igual.
      setTimeout(()=>{if(e.vuelos.has(v)){e.vuelos.delete(v);e.ranuras[ranura]=null;carta.style.visibility=v.visibilidad;resolver(false);}},(T.cae+2)*1000/v.vel);
    });
  }
  function soltar(host){const e=escenarios.get(host);if(!e)return;e.vivo=false;cancelAnimationFrame(e.raf);for(const v of e.vuelos){v.carta.style.visibility=v.visibilidad;v.resolver(false);}e.gl.destruir();e.c3.remove();e.c2.remove();escenarios.delete(host);}
  window.CAOZ_FX_INVOCAR=Object.freeze({invocar,soltar});
})();

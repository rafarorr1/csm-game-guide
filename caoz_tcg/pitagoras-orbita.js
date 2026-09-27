/* V · Órbita muerta: «Devuelve la luz». Sustituye la prueba orbital de
   pitagoras-mundos.js (sólo donde se carga este módulo, después de él).
   El héroe recorre una órbita de oro alrededor de la estrella muerta. Ella
   lanza meteoros que siguen arcos anunciados con hilo de oro y cruzan la
   órbita en un punto marcado. PARAR abre la burbuja de luz:
     · en el instante justo (≤ 0,2 s antes del cruce) el meteoro vuelve a la
       estrella y le abre una grieta; la burbuja queda lista al momento;
     · antes de tiempo sólo lo bloquea;
     · sin burbuja, si te alcanza, pierdes una vida.
   Lo que cruza la mitad baja de la órbita sin detenerse cae sobre el reino;
   cada tres meteoros que arden en el reino cuestan una vida. En los últimos
   segundos la estrella abre la boca y descarga dos salvas de tres sobre el
   reino. 20 segundos, 3 vidas, como el resto de pruebas.
   Coordenadas del modelo: el plano de la órbita, x a la derecha e y hacia
   abajo (hacia el reino), con la estrella en el origen. Determinista: el azar
   vive en s.azar y los pintores sólo leen. */
'use strict';
(function(global){
  const API=global.PITAGORAS_PRUEBAS;if(!API||!API.tipos?.orbital)return;
  const M=API.modelo,crearPrevio=M.crear,pasoPrevio=M.paso,TAU=Math.PI*2;
  const lim=(x,a,b)=>Math.max(a,Math.min(b,x));
  // R: radio de la órbita; RS: radio de la estrella; ALCANCE: distancia (cuerda) a la que un
  // meteoro toca al héroe o a su burbuja; VEL: velocidad angular del héroe (rad/s).
  const R=3.4,RS=1.45,ALCANCE=.85,VEL=2.35,BURBUJA=.55,PERFECTA=.2,RECARGA=.35,REINO=.25,INCLINACION=.42;
  const envolver=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // Un meteoro cruza sobre el reino si lo hace por la mitad baja de la órbita.
  const sobreReino=fi=>Math.sin(fi)>REINO;
  function azar(s){let t=s.azar+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  function chispas(s,x,y,color,n=10,v=3){for(let i=0;i<n;i++){const a=azar(s)*TAU,r=.6+azar(s)*v;s.particulas.push({x,y,vx:Math.cos(a)*r,vy:Math.sin(a)*r,t:.3+azar(s)*.4,color});}if(s.particulas.length>140)s.particulas.splice(0,s.particulas.length-140);}

  Object.assign(API.tipos.orbital,{
    sub:'Hasta las estrellas quieren borrarte.',
    texto:'Recorre la órbita de oro y devuelve los meteoros a la estrella muerta. Para en el instante justo y el meteoro vuelve y la agrieta. Lo que dejes pasar por la mitad baja cae sobre el reino: cada tres fuegos pierdes una vida. Aguanta 20 segundos.',
    control:'Izquierda: señala el punto de la órbita al que quieres ir. Derecha: PARAR, justo cuando llega el meteoro.',
    teclado:'WASD o flechas: señala el punto de la órbita · Espacio o clic: parar.',
    accion:'PARAR',glifo:'◇',ayuda:'Para justo al llegar: el meteoro vuelve a la estrella.',instruccion:'Devuelve la luz.',movimiento:'ÓRBITA'
  });

  M.crear=function(op={}){
    const s=crearPrevio(op);if(s.tipo!=='orbital')return s;
    Object.assign(s,{angulo:Math.PI/2,angulo0:Math.PI/2,meteoros:[],grietas:0,reino:0,fuegos:[],boca:0,bocaDesde:-9,bocaHasta:-9,salvas:0,
      devueltas:0,bloqueos:0,pulsadoEn:-9,siguiente:.8,oleada:0,balas:[],juicio:0,juicioTexto:'',juicioX:0,juicioY:0});
    s.jugador={x:0,y:R,a:0,r:.3};s.ultimoMovimiento={x:1,y:0};return s;
  };

  // Un meteoro nace en la superficie de la estrella y describe un arco hasta cruzar la órbita en fi a los tc s.
  function lanzar(s,tipo,fi,vuelo,op={}){
    const curva=op.curva??((azar(s)<.5?-1:1)*(.55+azar(s)*.55)),t0=op.t0??s.t;
    s.meteoros.push({id:++s.id,tipo,fi:envolver(fi),curva,t0,tc:t0+vuelo,origen:op.origen??RS,estado:t0>s.t?'espera':'vuela',desde:t0,x:0,y:0,caida:0,rx:0,rz:0});
  }
  function oleada(s){
    const t=s.t,n=s.oleada++,h=s.angulo;
    if(t<6.5){lanzar(s,n%2?'reino':'cazador',n%2?Math.PI/2+(azar(s)-.5)*2:h,1.75);s.siguiente+=1.2;return;}
    if(t<14.3){
      const ciclo=['reino','cazador','tenaza','reino','doble'][n%5];
      if(ciclo==='cazador')lanzar(s,'cazador',h,1.45);
      else if(ciclo==='reino')lanzar(s,'reino',Math.PI/2+(azar(s)-.5)*2.1,1.45);
      else if(ciclo==='tenaza'){const lado=azar(s)<.5?-1:1;lanzar(s,'cazador',h-lado*.6,1.45);lanzar(s,'cazador',h+lado*.6,1.45,{t0:t+.7});}
      else{const a=Math.PI/2+(azar(s)-.5)*1.2,d=(azar(s)<.5?-1:1)*(.8+azar(s)*.4);lanzar(s,'reino',a,1.45);lanzar(s,'reino',a+d,1.45,{t0:t+.65});}
      s.siguiente+=ciclo==='tenaza'||ciclo==='doble'?1.35:.9;return;
    }
    // La boca: la estrella se carga (0,6 s) y escupe tres meteoros seguidos sobre el reino.
    if(s.salvas===0||s.salvas===2){
      s.bocaDesde=t;s.bocaHasta=t+.6+1.2;const base=Math.PI/2+(azar(s)-.5)*.5,pasos=[0,-.35,.35];
      for(let i=0;i<3;i++)lanzar(s,'boca',base+pasos[i]*(s.salvas?1:-1),1,{t0:t+.6+i*.5,curva:(i-1)*.12,origen:RS*.62});
      s.salvas++;s.siguiente=s.salvas===1?t+2:Infinity;return;
    }
    lanzar(s,'cazador',h,1.3);s.salvas=2;s.siguiente=t+.85;
  }
  // Dónde está un meteoro que vuela (arco de la estrella a la órbita, y más allá si escapa).
  function arco(q,t){const u=(t-q.t0)/(q.tc-q.t0),r=q.origen+(R-q.origen)*u,a=q.fi+q.curva*(1-u);return {x:Math.cos(a)*r,y:Math.sin(a)*r};}
  function perderVida(s){s.vidas--;s.impacto=.42;s.eventos.push('dolor');if(s.vidas<=0){s.terminado=true;s.sobrevivio=false;}}
  function juicio(s,texto,x,y){s.juicio=.7;s.juicioTexto=texto;s.juicioX=x;s.juicioY=y;}
  // El cruce de la órbita: burbuja (a tiempo o no), golpe, o sigue su camino.
  function cruzar(s,q){
    const d=Math.abs(envolver(s.angulo-q.fi)),cuerda=2*R*Math.sin(d/2),x=Math.cos(q.fi)*R,y=Math.sin(q.fi)*R;q.x=x;q.y=y;q.desde=s.t;
    if(cuerda<ALCANCE){
      if(s.escudo>0){
        if(BURBUJA-s.escudo<=PERFECTA+1e-9){q.estado='vuelta';s.devueltas++;s.escudo=0;s.recargaImpulso=0;s.fogonazo=.18;juicio(s,'¡DEVUELTA!',x,y);chispas(s,x,y,'#fff1b8',12,3.4);s.eventos.push('impulso');}
        else{q.estado='roto';s.bloqueos++;s.escudo=0;s.recargaImpulso=RECARGA;juicio(s,'BLOQUEADA',x,y);chispas(s,x,y,'#ffb068',14,2.6);s.eventos.push('acierto');}
        return;
      }
      if(M.herir(s)){q.estado='roto';chispas(s,x,y,'#ff7048',16,3);return;}
    }
    if(sobreReino(q.fi)){q.estado='cae';q.rx=lim(x*1.55,-7,7);q.rz=azar(s);}else q.estado='fuga';
  }
  function orbital(s,e,dt){
    // Movimiento: la palanca señala el punto de la órbita; el héroe va hacia él por el camino corto.
    let mx=lim(Number(e.mx)||0,-1,1),my=lim(Number(e.my)||0,-1,1);const n=Math.hypot(mx,my);
    if(n>.3){const objetivo=Math.atan2(my,mx),d=envolver(objetivo-s.angulo),paso=VEL*dt*Math.min(1,n);s.angulo=envolver(s.angulo+lim(d,-paso,paso));s.ultimoMovimiento={x:Math.sign(d)||s.ultimoMovimiento.x,y:0};}
    const p=s.jugador;p.x=Math.cos(s.angulo)*R;p.y=Math.sin(s.angulo)*R;p.a=s.angulo+Math.PI/2*s.ultimoMovimiento.x;
    s.escudo=Math.max(0,s.escudo-dt);s.juicio=Math.max(0,s.juicio-dt);
    if(e.accion&&!s.pulsado&&s.recargaImpulso<=0){s.escudo=BURBUJA;s.recargaImpulso=BURBUJA+RECARGA;s.pulsadoEn=s.t;s.eventos.push('impulso');}
    if(s.t>=s.siguiente)oleada(s);
    const bocaActiva=s.t>=s.bocaDesde&&s.t<=s.bocaHasta;s.boca=lim(s.boca+(bocaActiva?dt/.5:-dt/.4),0,1);
    for(const q of s.meteoros){
      if(q.estado==='espera'){if(s.t>=q.t0){q.estado='vuela';s.eventos.push('disparo');}else continue;}
      if(q.estado==='vuela'){if(s.t>=q.tc)cruzar(s,q);else{const a=arco(q,s.t);q.x=a.x;q.y=a.y;}}
      else if(q.estado==='vuelta'){const k=(s.t-q.desde)/.32;if(k>=1){q.estado='fin';s.grietas++;s.muertes++;s.eventos.push('acierto');chispas(s,0,RS*.4,'#ffd27a',12,2.4);}else{const a=Math.cos(q.fi),b=Math.sin(q.fi),r=R+(RS*.7-R)*k;q.x=a*r;q.y=b*r;}}
      else if(q.estado==='cae'){q.caida=(s.t-q.desde)/.7;if(q.caida>=1){q.estado='fin';s.reino++;s.fuegos.push({id:q.id,x:q.rx,z:q.rz,t:s.t});if(s.fuegos.length>9)s.fuegos.shift();s.eventos.push('explosion');if(s.reino%3===0)perderVida(s);else s.impacto=Math.max(s.impacto,.2);}}
      else if(q.estado==='fuga'){const a=arco(q,s.t);q.x=a.x;q.y=a.y;if(s.t-q.desde>.9)q.estado='fin';}
      else if(q.estado==='roto'&&s.t-q.desde>.05)q.estado='fin';
    }
    s.meteoros=s.meteoros.filter(q=>q.estado!=='fin');
  }
  function paso(s,e,dt){
    if(s.terminado)return;s.t=Math.min(s.duracion,s.t+dt);
    for(const k of ['invulnerable','impacto','fogonazo','recargaImpulso'])s[k]=Math.max(0,s[k]-dt);
    orbital(s,e,dt);s.pulsado=!!e.accion;
    for(const q of s.particulas){q.x+=q.vx*dt;q.y+=q.vy*dt;q.t-=dt;}s.particulas=s.particulas.filter(q=>q.t>0);
    if(!s.terminado&&s.t>=s.duracion-1e-8){s.t=s.duracion;s.terminado=true;s.sobrevivio=true;}
  }
  M.paso=function(s,e={},dt=1/60){if(s.tipo!=='orbital')return pasoPrevio(s,e,dt);dt=lim(Number(dt)||0,0,60);while(dt>1e-8&&!s.terminado){const q=Math.min(dt,1/60,s.duracion-s.t);paso(s,e,q);dt-=q;}return s;};

  // Guía: va al punto de cruce del meteoro más urgente que pueda alcanzar y para justo antes
  // de que llegue (el toque sólo dura un fotograma). Lee sólo lo que se ve: arcos y marcas.
  API.guiasPrueba=API.guiasPrueba||{};
  API.guiasPrueba.orbital=function(s,mem={}){
    const vivos=s.meteoros.filter(q=>q.estado==='vuela'||q.estado==='espera').sort((a,b)=>a.tc-b.tc);let objetivo=null;
    for(const q of vivos){const d=Math.abs(envolver(q.fi-s.angulo));if(d/VEL<=q.tc-s.t+.05){objetivo=q;break;}}
    const destino=objetivo?objetivo.fi:Math.PI/2,dd=Math.abs(envolver(destino-s.angulo));
    let accion=false;
    if(objetivo&&objetivo.estado==='vuela'&&mem.parado!==objetivo.id&&s.recargaImpulso<=0&&objetivo.tc-s.t<=.12&&2*R*Math.sin(dd/2)<ALCANCE*.8){accion=true;mem.parado=objetivo.id;}
    return dd<.01?{mx:0,my:0,accion}:{mx:Math.cos(destino),my:Math.sin(destino),accion};
  };

  /* ---- Pintor clásico (sin WebGL o con movimiento reducido) ------------------ */
  const COS=Math.cos(INCLINACION);
  function pintar(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t,esc=Math.min(w/10.5,h/13),cx=w/2,cy=h*.4,P=(x,y)=>({x:cx+x*esc,y:cy+y*esc*COS});
    // Cielo de lapislázuli con estrellas de oro, como la miniatura.
    let g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0c1745');g.addColorStop(.7,'#1b2f78');g.addColorStop(1,'#20346e');c.fillStyle=g;c.fillRect(0,0,w,h);
    for(let i=0;i<46;i++){const x=(Math.sin(i*57.31)*.5+.5)*w,y=(Math.cos(i*17.13)*.5+.5)*h*.8,r=1.5+(i%4);c.fillStyle='#f0c860';c.globalAlpha=.55+.35*Math.sin(t*2+i);c.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=k%2?r*.35:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.fill();}c.globalAlpha=1;
    // El reino: colinas, castillos y el mar de oro; los fuegos donde cayeron meteoros.
    const suelo=h*.82;g=c.createLinearGradient(0,suelo-h*.1,0,h);g.addColorStop(0,'#2d6b4c');g.addColorStop(1,'#16382a');c.fillStyle=g;c.beginPath();c.moveTo(0,h);for(let x=0;x<=w;x+=8)c.lineTo(x,suelo-Math.sin(x*.012)*h*.03-Math.sin(x*.031+1)*h*.015);c.lineTo(w,h);c.fill();
    c.fillStyle='#d8aa48';c.fillRect(w*.38,suelo+h*.02,w*.24,h*.018);
    for(const [fx,al] of [[.08,.13],[.14,.09],[.2,.11],[.8,.12],[.87,.08],[.93,.1]]){const x=w*fx,y=suelo-h*.01,an=w*.022;c.fillStyle='#ece2c8';c.fillRect(x-an/2,y-h*al,an,h*al);c.fillStyle='#b8321e';c.beginPath();c.moveTo(x-an*.7,y-h*al);c.lineTo(x,y-h*al-an*1.6);c.lineTo(x+an*.7,y-h*al);c.fill();}
    for(const f of m.fuegos){const x=cx+f.x*esc,y=suelo+h*.02+f.z*h*.08,e=Math.max(0,1-(t-f.t)/6);if(!e)continue;const fl=c.createRadialGradient(x,y,0,x,y,w*.06);fl.addColorStop(0,'#ffd27a');fl.addColorStop(.4,'#ff5a1ecc');fl.addColorStop(1,'transparent');c.fillStyle=fl;c.fillRect(x-w*.06,y-w*.06,w*.12,w*.12);}
    // La órbita (la mitad lejana va detrás de la estrella; la baja, sobre el reino, más cálida).
    const aro=(desde,hasta)=>{c.lineWidth=Math.max(1.5,esc*.07);for(let a=desde;a<hasta;a+=.05){const p=P(Math.cos(a)*R,Math.sin(a)*R),q=P(Math.cos(a+.05)*R,Math.sin(a+.05)*R);c.strokeStyle=sobreReino(a+.025)?'#ffb35a':'#e9c065';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}};
    aro(Math.PI,TAU);
    // La estrella muerta: roca negra, grietas de lava, ojos que siguen al héroe y la boca que se carga.
    const e=P(0,0),re=RS*esc,hx=Math.cos(m.angulo),hy=Math.sin(m.angulo);
    for(let i=0;i<14;i++){const a=i*TAU/14+t*.15;c.strokeStyle=i%2?'#c8321e':'#e98a2e';c.lineWidth=esc*.12;c.beginPath();c.moveTo(e.x+Math.cos(a)*re,e.y+Math.sin(a)*re);c.quadraticCurveTo(e.x+Math.cos(a+.3)*re*1.5,e.y+Math.sin(a+.3)*re*1.5,e.x+Math.cos(a+.1)*re*(1.7+.15*Math.sin(t*3+i)),e.y+Math.sin(a+.1)*re*(1.7+.15*Math.sin(t*3+i)));c.stroke();}
    g=c.createRadialGradient(e.x-re*.3,e.y-re*.35,re*.1,e.x,e.y,re);g.addColorStop(0,'#3a2a24');g.addColorStop(1,'#0b0707');c.fillStyle=g;c.beginPath();c.arc(e.x,e.y,re,0,TAU);c.fill();
    c.strokeStyle='#f08a2a';c.lineWidth=1.5;const n=4+Math.min(m.grietas,12);for(let i=0;i<n;i++){const a=i*2.39996,r0=re*(.2+(i%3)*.2);c.beginPath();c.moveTo(e.x+Math.cos(a)*r0,e.y+Math.sin(a)*r0);c.lineTo(e.x+Math.cos(a+.3)*re*.7,e.y+Math.sin(a+.3)*re*.7);c.lineTo(e.x+Math.cos(a+.1)*re*.98,e.y+Math.sin(a+.1)*re*.98);c.stroke();}
    for(const lado of [-1,1]){const ox=e.x+lado*re*.34+hx*re*.06,oy=e.y-re*.12+hy*re*.05;c.fillStyle='#ffd24a';c.beginPath();c.ellipse(ox,oy,re*.17,re*.07,lado*.35,0,TAU);c.fill();}
    c.fillStyle=m.boca>0?'#ff7a2a':'#e0452a';c.beginPath();const bw=re*.55,by=e.y+re*.35,ba=re*(.07+m.boca*.2);c.moveTo(e.x-bw,by);for(let i=0;i<=8;i++)c.lineTo(e.x-bw+i*bw/4,by+(i%2?ba:-ba*.3));for(let i=8;i>=0;i--)c.lineTo(e.x-bw+i*bw/4,by+ba*(1+m.boca)+(i%2?0:ba*.5));c.fill();
    aro(0,Math.PI);
    // Los arcos anunciados, las marcas de cruce y los meteoros.
    for(const q of m.meteoros){
      if(q.estado==='vuela'||q.estado==='espera'){const k=lim((t-q.t0+.6)/(q.tc-q.t0+.6),0,1);c.fillStyle='#ffd27a';for(let i=0;i<14;i++){const u=Math.max(0,(t-q.t0)/(q.tc-q.t0))+(1-Math.max(0,(t-q.t0)/(q.tc-q.t0)))*i/13,a=q.fi+q.curva*(1-u),r=q.origen+(R-q.origen)*u,p=P(Math.cos(a)*r,Math.sin(a)*r);c.globalAlpha=.25+.5*k;c.fillRect(p.x-1,p.y-1,2,2);}
        const mk=P(Math.cos(q.fi)*R,Math.sin(q.fi)*R);c.globalAlpha=.5+.5*k;c.strokeStyle=sobreReino(q.fi)?'#ff8a3a':'#ffe08a';c.lineWidth=2;c.beginPath();c.arc(mk.x,mk.y,esc*(.5-.25*k),0,TAU);c.stroke();c.globalAlpha=1;}
      if(q.estado==='espera')continue;
      let x=q.x,y=q.y,p=P(x,y);if(q.estado==='cae'){const a=P(q.x,q.y),b={x:cx+q.rx*esc,y:suelo+h*.02+q.rz*h*.08},k=q.caida;p={x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k*k};}
      const brillo=q.estado==='vuelta'?'#fff1b8':'#ff6a2a';g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,esc*.6);g.addColorStop(0,brillo);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(p.x-esc*.6,p.y-esc*.6,esc*1.2,esc*1.2);
      c.fillStyle='#1a1210';c.beginPath();c.arc(p.x,p.y,esc*.26,0,TAU);c.fill();c.strokeStyle=brillo;c.lineWidth=1.5;c.stroke();
    }
    // El héroe, su burbuja y la luz de la recarga.
    const p=P(m.jugador.x,m.jugador.y),tam=Math.max(22,esc*1.1);
    if(!(m.invulnerable>0&&Math.floor(m.t*14)%2)){if(s.miniatura)c.drawImage(s.miniatura,p.x-tam*.46,p.y-tam*.7,tam*.92,tam*1.18);else{c.fillStyle='#3558b8';c.fillRect(p.x-tam*.18,p.y-tam*.4,tam*.36,tam*.6);c.fillStyle='#b52a1a';c.beginPath();c.arc(p.x,p.y-tam*.5,tam*.16,0,TAU);c.fill();c.strokeStyle='#e9b949';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y-tam*.5,tam*.24,0,TAU);c.stroke();}}
    if(m.escudo>0){const f=m.escudo/BURBUJA;c.strokeStyle=`rgba(255,240,190,${.5+.5*f})`;c.lineWidth=2.5;c.beginPath();c.arc(p.x,p.y,esc*ALCANCE*.62,0,TAU);c.stroke();c.fillStyle='rgba(255,240,190,.12)';c.fill();}
    else if(m.recargaImpulso<=0){c.strokeStyle='#ffe7a855';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,esc*ALCANCE*.62,0,TAU);c.stroke();}
    for(const q of m.particulas){const pp=P(q.x,q.y);c.fillStyle=q.color;c.globalAlpha=lim(q.t*3,0,1);c.fillRect(pp.x-1.5,pp.y-1.5,3,3);}c.globalAlpha=1;
    if(m.juicio>0){const pj=P(m.juicioX,m.juicioY);c.globalAlpha=lim(m.juicio*2,0,1);c.fillStyle='#fff1c8';c.font=`700 ${Math.max(11,esc*.42)}px Georgia,serif`;c.textAlign='center';c.fillText(m.juicioTexto,pj.x,pj.y-esc*1.2);c.globalAlpha=1;}
    reino(c,m,w,h);
  }
  // El estado del reino: tres torres; cada fuego apaga una y, al tercero, cuesta una vida.
  function reino(c,m,w,h){
    const k=m.reino%3,tam=Math.max(8,Math.min(14,w*.026)),x0=w/2-tam*2.4,y=h-tam*1.1;
    c.font=`600 ${Math.max(9,tam*.8)}px system-ui`;c.textAlign='right';c.fillStyle='#f3e2b8cc';c.fillText('EL REINO',x0-tam*.6,y+tam*.1);
    for(let i=0;i<3;i++){const x=x0+i*tam*1.6,ardiendo=i<k;c.fillStyle=ardiendo?'#ff5a2a':'#f3e2b8';c.fillRect(x,y-tam*.8,tam*.9,tam);c.beginPath();c.moveTo(x-tam*.15,y-tam*.8);c.lineTo(x+tam*.45,y-tam*1.5);c.lineTo(x+tam*1.05,y-tam*.8);c.fill();}
  }
  API.pintores=Object.assign(API.pintores||{},{orbital:pintar});
  global.CAOZ_ORBITA=Object.freeze({R,RS,ALCANCE,INCLINACION,BURBUJA,PERFECTA,sobreReino,arco,dibujarReino:reino});
})(typeof window!=='undefined'?window:globalThis);

/* Tres realidades adicionales del Editor. Las reglas consumen el tiempo en
   subpasos deterministas; los pintores no modifican el azar de la simulación.
   Se carga después de pitagoras-pruebas.js y comparte su ciclo y controles. */
'use strict';
(function(global){
  const API=global.PITAGORAS_PRUEBAS;if(!API)return;
  const M=API.modelo,crearBase=M.crear,pasoBase=M.paso,TAU=Math.PI*2;
  const limite=(x,a,b)=>Math.max(a,Math.min(b,x)),mezcla=(a,b,t)=>a+(b-a)*t;
  let retratoEditor=null;
  if(typeof Image!=='undefined'&&typeof document!=='undefined'){try{retratoEditor=new Image();retratoEditor.src=new URL('art/pitagoras-abismo-v216.webp',document.currentScript?.src||document.baseURI).href;}catch(_){retratoEditor=null;}}
  const NUEVOS={
    carrera:{nombre:'El último puente',numero:'IV',sub:'El mundo se derrumba detrás de ti.',texto:'Corre 20 segundos por el puente del Editor. Cambia de carril y salta los sellos que atraviesan el camino.',control:'Izquierda: cambiar de carril. Derecha: saltar. Los arcos bajos deben saltarse.',teclado:'A/D o flechas: carriles · Espacio: saltar.',accion:'SALTAR',glifo:'↑',ayuda:'Salta los sellos. Evita las columnas.',instruccion:'Que nada te detenga.',movimiento:'CAMBIAR CARRIL'},
    orbital:{nombre:'Órbita muerta',numero:'V',sub:'Hasta las estrellas quieren borrarte.',texto:'Sobrevive 20 segundos a las descargas de una estrella muerta. Esquiva los proyectiles y usa el escudo para atravesar el peligro.',control:'Izquierda: moverte. Derecha: escudo fugaz; se recarga después de usarlo.',teclado:'WASD o flechas: moverte · Espacio: escudo de impulso.',accion:'ESCUDO',glifo:'◇',ayuda:'El escudo te protege un instante.',instruccion:'Baila entre las estrellas.',movimiento:'NAVEGAR'},
    duelo:{nombre:'El filo del Editor',numero:'VI',sub:'Un latido separa la vida del silencio.',texto:'Resiste 20 segundos al filo del Editor. Pulsa Parar cuando el anillo alcance el centro. Moverte evita los golpes estrechos; las ondas exigen una parada.',control:'Izquierda: desplazarte. Derecha: parar el golpe en el instante en que el anillo se cierra.',teclado:'A/D o flechas: desplazarte · Espacio: parar, justo antes del golpe.',accion:'PARAR',glifo:'✧',ayuda:'Pulsa cuando el anillo alcance el centro.',instruccion:'Escucha. Espera. Para.',movimiento:'DESPLAZARTE'}
  };
  Object.assign(API.tipos,NUEVOS);
  function azar(s){let t=s.azar+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  function particulas(s,x,y,color,n=12){for(let i=0;i<n;i++){const a=azar(s)*TAU,v=.8+azar(s)*3;s.particulas.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.3+azar(s)*.4,color});}if(s.particulas.length>120)s.particulas.splice(0,s.particulas.length-120);}
  M.crear=function(op={}){
    if(!NUEVOS[op.tipo])return crearBase(op);
    const s=crearBase({...op,tipo:'laseres'});s.tipo=op.tipo;s.jugador={x:0,y:s.tipo==='orbital'?4:0,a:-Math.PI/2,r:s.tipo==='orbital'?.2:.28};
    Object.assign(s,{salto:0,saltoV:0,obstaculos:[],siguiente:.65,oleada:0,distancia:0,velocidad:9.5,escudo:0,estela:[],ataques:[],parada:0,recargaParada:0,paradas:0,combo:0,juicio:0,juicioTexto:'',ultimoMovimiento:{x:0,y:-1}});return s;
  };
  function carrera(s,e,dt){
    const p=s.jugador;p.x=limite(p.x+limite(Number(e.mx)||0,-1,1)*3.8*dt,-1,1);p.y=0;s.distancia+=s.velocidad*dt;
    if(e.accion&&!s.pulsado&&s.salto<=0){s.saltoV=5.7;s.eventos.push('impulso');}
    s.saltoV-=13.8*dt;s.salto=Math.max(0,s.salto+s.saltoV*dt);if(!s.salto)s.saltoV=0;
    if(s.t>=s.siguiente){
      const onda=s.oleada++,sello=onda%3===0,carril=sello?0:Math.floor(azar(s)*3)-1;
      s.obstaculos.push({id:++s.id,z:27,carril,tipo:sello?'sello':'columna',paso:false});s.siguiente+=1.35;
    }
    for(const o of s.obstaculos){o.z-=s.velocidad*dt;if(!o.paso&&o.z<=.7){o.paso=true;if((o.tipo==='sello'||Math.abs(p.x-o.carril)<.43)&&(o.tipo==='columna'||s.salto<.6))M.herir(s);else{s.muertes++;s.eventos.push('acierto');}}}
    s.obstaculos=s.obstaculos.filter(o=>o.z>-5);
  }
  function bala(s,x,y,a,v,r=.16){s.balas.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r,t:9,edad:0});}
  function orbital(s,e,dt){
    const p=s.jugador;let x=limite(Number(e.mx)||0,-1,1),y=limite(Number(e.my)||0,-1,1),n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}
    if(n>.05)s.ultimoMovimiento={x,y};
    if(e.accion&&!s.pulsado&&s.recargaImpulso<=0){s.escudo=.55;s.recargaImpulso=2;s.eventos.push('impulso');}
    s.escudo=Math.max(0,s.escudo-dt);p.x=limite(p.x+x*4.9*dt,-5.6,5.6);p.y=limite(p.y+y*4.9*dt,-6.9,7);
    if(s.t>=s.siguiente){
      const bx=Math.sin(s.t*.55)*2.4,by=-7.2,a=Math.atan2(p.y-by,p.x-bx),onda=s.oleada++;
      // Dos familias legibles: abanicos dirigidos y una espiral abierta.
      for(let i=-2;i<=2;i++)bala(s,bx,by,a+i*.23,3.25+s.t*.025,.15);
      if(onda%3===2)for(let i=0;i<12;i++)bala(s,bx,by,i*TAU/12+onda*.2,2.15,.12);
      s.siguiente+=1.12;s.eventos.push('disparo');
    }
    for(const b of s.balas){b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;b.edad+=dt;
      if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+b.r){b.t=0;if(s.escudo>0){particulas(s,b.x,b.y,'#abedff',6);s.muertes++;s.eventos.push('acierto');}else M.herir(s);}}
    s.balas=s.balas.filter(b=>b.t>0&&Math.abs(b.x)<8&&b.y>-10&&b.y<10);
    s.estela.push({x:p.x,y:p.y,t:.35});if(s.estela.length>25)s.estela.shift();for(const q of s.estela)q.t-=dt;s.estela=s.estela.filter(q=>q.t>0);
  }
  function duelo(s,e,dt){
    const p=s.jugador;p.x=limite(p.x+limite(Number(e.mx)||0,-1,1)*3*dt,-1.5,1.5);p.y=0;
    s.parada=Math.max(0,s.parada-dt);s.recargaParada=Math.max(0,s.recargaParada-dt);s.juicio=Math.max(0,s.juicio-dt);
    if(e.accion&&!s.pulsado&&s.recargaParada<=0){s.parada=.22;s.recargaParada=.48;s.eventos.push('impulso');}
    if(s.t>=s.siguiente){const onda=s.oleada++,aviso=1.18; s.ataques.push({id:++s.id,edad:0,aviso,objetivo:p.x,lado:onda%2?1:-1,barrido:onda%3===0,resuelto:false});s.siguiente+=1.6;}
    for(const a of s.ataques){a.edad+=dt;if(!a.resuelto&&a.edad>=a.aviso){a.resuelto=true;s.eventos.push('laser');
      if(s.parada>0){s.paradas++;s.combo++;s.juicio=.7;s.juicioTexto='PARADA';s.fogonazo=.3;s.impacto=.14;particulas(s,p.x,0,'#ffd69a',18);s.eventos.push('acierto');}
      else if(a.barrido||Math.abs(p.x-a.objetivo)<.65){s.combo=0;s.juicio=.6;s.juicioTexto='HERIDA';M.herir(s);}else{s.juicio=.5;s.juicioTexto='ESQUIVADO';}}
    }
    s.ataques=s.ataques.filter(a=>a.edad<a.aviso+.65);
  }
  function pasoNuevo(s,e,dt){
    if(s.terminado)return;s.t=Math.min(s.duracion,s.t+dt);
    for(const k of ['invulnerable','impacto','fogonazo','recargaImpulso'])s[k]=Math.max(0,s[k]-dt);
    if(s.tipo==='carrera')carrera(s,e,dt);else if(s.tipo==='orbital')orbital(s,e,dt);else duelo(s,e,dt);
    s.pulsado=!!e.accion;for(const q of s.particulas){q.x+=q.vx*dt;q.y+=q.vy*dt;q.t-=dt;}s.particulas=s.particulas.filter(q=>q.t>0);
    if(!s.terminado&&s.t>=s.duracion-1e-8){s.t=s.duracion;s.terminado=true;s.sobrevivio=true;}
  }
  M.paso=function(s,e={},dt=1/60){if(!NUEVOS[s.tipo])return pasoBase(s,e,dt);dt=limite(Number(dt)||0,0,60);while(dt>1e-8&&!s.terminado){const q=Math.min(dt,1/60,s.duracion-s.t);pasoNuevo(s,e,q);dt-=q;}return s;};

  // Guías de control para reproducir partidas completas en el arnés. Usan las
  // mismas entradas humanas y jamás alteran vida, tiempo, obstáculos ni azar.
  API.guiasPrueba=API.guiasPrueba||{};
  API.guiasPrueba.carrera=function(s){const o=s.obstaculos.filter(o=>!o.paso).sort((a,b)=>a.z-b.z)[0];let destino=0,accion=false;if(o){if(o.tipo==='columna')destino=o.carril===0?-1:0;else accion=o.z<4.3&&o.z>1&&s.salto===0;}return{mx:limite((destino-s.jugador.x)*10,-1,1),my:0,accion};};
  API.guiasPrueba.duelo=function(s){const a=s.ataques.find(a=>!a.resuelto),resta=a?a.aviso-a.edad:10;return{mx:0,my:0,accion:resta<.12&&resta>0};};
  API.guiasPrueba.orbital=function(s){
    const p=s.jugador,acciones=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
    let mejor=acciones[0],valor=-Infinity,riesgo=Infinity;
    for(const [mx,my] of acciones){let minimo=10;for(const b of s.balas){for(const t of [.10,.22,.4]){const x=limite(p.x+mx*4.9*t,-5.6,5.6),y=limite(p.y+my*4.9*t,-6.9,7),d=Math.hypot(x-b.x-b.vx*t,y-b.y-b.vy*t)-b.r;minimo=Math.min(minimo,d);}}const nx=limite(p.x+mx*.8,-5.6,5.6),ny=limite(p.y+my*.8,-6.9,7),v=Math.min(minimo,1.4)-Math.abs(nx)*.012-Math.abs(ny-3)*.017;if(v>valor){valor=v;mejor=[mx,my];riesgo=minimo;}}
    return{mx:mejor[0],my:mejor[1],accion:riesgo<.48&&s.recargaImpulso<=0};
  };

  // Pintura propia: arquitectura proyectada, luminancia aditiva controlada y
  // capas atmosféricas. Sin imágenes remotas, texturas ni estado compartido.
  function pol(c,p,color,borde){c.beginPath();for(let i=0;i<p.length;i++)i?c.lineTo(p[i][0],p[i][1]):c.moveTo(p[i][0],p[i][1]);c.closePath();c.fillStyle=color;c.fill();if(borde){c.strokeStyle=borde;c.stroke();}}
  function halo(c,x,y,r,color){if(r<=0)return;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  function linea(c,x,y,xx,yy,color,grosor=1){c.strokeStyle=color;c.lineWidth=grosor;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
  function elipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.fill();}
  function fondo(c,w,h,arriba,abajo){const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,arriba);g.addColorStop(1,abajo);c.fillStyle=g;c.fillRect(0,0,w,h);}
  function motas(c,w,h,t,color,n=42){c.fillStyle=color;for(let i=0;i<n;i++){const f=i*2.39996,x=((Math.sin(f)*.5+.5)*w+t*(i%3-1)*3+w)%w,y=((Math.cos(f*1.73)*.5+.5)*h-t*(3+i%5)+h*20)%h;c.globalAlpha=.18+(i%5)*.1;c.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);}c.globalAlpha=1;}
  function heroe(s,c,x,y,tam,salto=0){const m=s.modelo;elipse(c,x,y,tam*.42,tam*.13,'#00000088');halo(c,x,y,tam*.9,'#88c6ff22');c.save();c.translate(x,y-salto);if(m.invulnerable>0&&Math.floor(m.t*14)%2)c.globalAlpha=.48;
    if(s.miniatura)c.drawImage(s.miniatura,-tam*.46,-tam*1.22,tam*.92,tam*1.18);
    else{const g=c.createLinearGradient(-tam*.3,0,tam*.3,0);g.addColorStop(0,'#172835');g.addColorStop(.5,'#60768a');g.addColorStop(1,'#111d2b');pol(c,[[-tam*.18,-tam*.8],[tam*.18,-tam*.8],[tam*.37,0],[-tam*.32,0]],g,'#9ea7b144');elipse(c,0,-tam*.99,tam*.15,tam*.18,'#c7bcaa');}
    c.restore();}
  function runP(s,x,z,y=0){const w=s.ancho,h=s.alto,k=1/(1+Math.max(-3,z)*.082);return{x:w*.5+x*w*.235*k,y:h*.22+h*.62*k-y*h*.115*k,k};}
  function dibujarCarrera(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t;fondo(c,w,h,'#090b15','#151115');
    halo(c,w*.5,h*.24,w*.55,'#88869030');halo(c,w*.5,h*.07,w*.24,'#a8ae9b24');
    // Luna eclipsada y bosque de agujas fuera del puente.
    const luna=Math.min(w,h)*.13;elipse(c,w*.5,h*.16,luna,luna,'#94988d');elipse(c,w*.515,h*.147,luna*.98,luna*.98,'#10131b');
    for(let i=0;i<18;i++){const x=w*(i/17),alto=h*(.08+Math.abs(Math.sin(i*4.7))*.2);pol(c,[[x-13,h*.51],[x-4,h*.51-alto],[x,h*.48-alto],[x+5,h*.51-alto],[x+15,h*.51]],i%2?'#0b111b':'#111923');}
    for(let z=64;z>-3;z-=2){const zz=z-(m.distancia%2),a=runP(s,-1.72,zz),b=runP(s,1.72,zz),d=runP(s,-1.72,zz+2),e=runP(s,1.72,zz+2);pol(c,[[a.x,a.y],[b.x,b.y],[e.x,e.y],[d.x,d.y]],Math.floor((zz+m.distancia)/2)%2?'#29303a':'#242a34','#4b4b471c');
      // Grietas y uniones nacen de coordenadas del mundo, sin vibrar entre fotogramas.
      const sem=Math.floor((zz+m.distancia)/2);for(let j=0;j<5;j++){const xx=Math.sin(sem*11.3+j*7.2)*1.6,prof=zz+.2+(j%3)*.4,p0=runP(s,xx,prof),p1=runP(s,xx+.04,prof+.18),p2=runP(s,xx-.06,prof+.42);c.strokeStyle='#070a1077';c.lineWidth=Math.max(.4,p0.k*1.4);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.stroke();}
      for(const x of [-1.67,-.5,.5,1.67]){const p=runP(s,x,zz),q=runP(s,x,zz+2);linea(c,p.x,p.y,q.x,q.y,Math.abs(x)>1?'#99836199':'#a394763d',Math.max(1,p.k*1.5));}
    }
    // Contrafuertes, arcos y braseros: todos comparten la misma perspectiva.
    for(let i=10;i>=0;i--){const z=i*7-(m.distancia%7)+1;if(z<0)continue;for(const lado of [-1,1]){const pie=runP(s,lado*1.93,z),alto=runP(s,lado*1.93,z,4.1),ancho=w*.15*pie.k;
        const piedra=c.createLinearGradient(pie.x-ancho,0,pie.x+ancho,0);piedra.addColorStop(0,'#101620');piedra.addColorStop(.5,'#3e4248');piedra.addColorStop(1,'#171d28');pol(c,[[pie.x-ancho*.4,pie.y],[pie.x-ancho*.34,alto.y],[pie.x+ancho*.34,alto.y],[pie.x+ancho*.48,pie.y]],piedra,'#7e786445');
        for(let j=1;j<9;j++){const yy=mezcla(pie.y,alto.y,j/9);linea(c,pie.x-ancho*.34,yy,pie.x+ancho*.34,yy,'#080c16aa',Math.max(1,pie.k*2));linea(c,pie.x-ancho*.33,yy+2*pie.k,pie.x+ancho*.33,yy+2*pie.k,'#b0a58630',1);linea(c,pie.x+(j%2?.13:-.16)*ancho,yy,pie.x+(j%2?.13:-.16)*ancho,mezcla(pie.y,alto.y,(j+1)/9),'#080c16aa',1);}
        pol(c,[[pie.x-ancho*.55,alto.y+ancho*.06],[pie.x-ancho*.48,alto.y-ancho*.08],[pie.x+ancho*.48,alto.y-ancho*.08],[pie.x+ancho*.55,alto.y+ancho*.06]],'#515153','#8b85734d');
        const ant=runP(s,lado*1.7,z,1.05);halo(c,ant.x,ant.y,ancho*.9,'#ffa56038');elipse(c,ant.x,ant.y,ancho*.025,ancho*.12,'#f7d1a0');
      }if(i%2===0){const a=runP(s,-1.93,z,4),b=runP(s,1.93,z,4);c.strokeStyle='#515053';c.lineWidth=Math.max(2,a.k*w*.024);c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(w*.5,a.y-h*.21*a.k,b.x,b.y);c.stroke();}}
    const objetos=m.obstaculos.filter(o=>o.z>-.3).slice().sort((a,b)=>b.z-a.z);for(const o of objetos){const p=runP(s,o.carril,o.z),an=w*.19*p.k;
      if(o.tipo==='sello'){const a=runP(s,-1.55,o.z,.5),b=runP(s,1.55,o.z,.5);halo(c,w*.5,a.y,w*.42*p.k,'#d83e2b25');linea(c,a.x,a.y,b.x,b.y,'#7d2f28',Math.max(3,9*p.k));linea(c,a.x,a.y,b.x,b.y,'#ffe6af',Math.max(1,2*p.k));for(let i=-1;i<=1;i++){const q=runP(s,i,o.z,.5);pol(c,[[q.x,q.y-an*.12],[q.x+an*.12,q.y],[q.x,q.y+an*.12],[q.x-an*.12,q.y]],'#d59d68','#f8d6a1');}}
      else{elipse(c,p.x,p.y,an*.55,an*.15,'#0009');const q=runP(s,o.carril,o.z,1.8),g=c.createLinearGradient(p.x-an*.4,0,p.x+an*.4,0);g.addColorStop(0,'#6d6762');g.addColorStop(.3,'#343d4a');g.addColorStop(1,'#101823');pol(c,[[p.x-an*.42,p.y],[p.x-an*.34,q.y],[p.x+an*.32,q.y-an*.12],[p.x+an*.46,p.y]],g,'#8b918a');linea(c,p.x,q.y+an*.08,p.x,p.y-an*.12,'#ec715c',Math.max(1,an*.035));halo(c,p.x,q.y+an*.5,an*.6,'#cf493522');}}
    const p=runP(s,m.jugador.x,0),tam=Math.min(w*.145,h*.2);heroe(s,c,p.x,p.y,tam,m.salto*h*.085);
    // Runas de carrera sobre la piedra; la silueta conserva una referencia al suelo.
    if(m.salto>0){c.strokeStyle='#e6c28b';c.lineWidth=1;c.beginPath();c.ellipse(p.x,p.y,tam*.55,tam*.17,0,0,TAU);c.stroke();}
    halo(c,w*.5,h*.3,w*.6,'#7277771c');motas(c,w,h,t,'#cfa47b',32);
  }
  function dibujarOrbital(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t,esc=Math.min(w/13,h/17),cx=w*.5,cy=h*.52,P=(x,y)=>({x:cx+x*esc,y:cy+y*esc});
    fondo(c,w,h,'#030710','#0c1021');halo(c,w*.23,h*.58,w*.85,'#27397c2f');halo(c,w*.9,h*.3,w*.7,'#681e582c');
    // Luna erosionada en el borde del campo; las órbitas pasan frente a ella.
    const planetaX=w*1.06,planetaY=h*.7,planetaR=Math.min(w*.4,h*.26);c.save();c.beginPath();c.arc(planetaX,planetaY,planetaR,0,TAU);c.clip();const pg=c.createRadialGradient(planetaX-planetaR*.6,planetaY-planetaR*.5,0,planetaX,planetaY,planetaR*1.4);pg.addColorStop(0,'#617080');pg.addColorStop(.45,'#263242');pg.addColorStop(1,'#070b16');c.fillStyle=pg;c.fillRect(planetaX-planetaR,planetaY-planetaR,planetaR*2,planetaR*2);for(let i=0;i<45;i++){const xx=planetaX+Math.sin(i*15.73)*planetaR,yy=planetaY+Math.cos(i*8.43)*planetaR,r=3+(i%7)*2;elipse(c,xx,yy,r,r*.6,'#050b1633');elipse(c,xx-1,yy-1,r,r*.57,'#82919b13');}c.restore();
    // Polvo interestelar por tres velocidades y una nebulosa de filamentos.
    for(let capa=0;capa<3;capa++)for(let i=0;i<44;i++){const x=(Math.sin(i*57.31+capa*87)*.5+.5)*w,y=((Math.cos(i*17.13+capa)*.5+.5)*h+t*(3+capa*10))%h;c.fillStyle=capa===2?'#dfd3b998':'#788ba455';c.fillRect(x,y,capa===2?1.6:1,capa===2?2.5:1);}
    c.save();c.translate(cx,cy-esc*5.5);c.rotate(-.22);for(let i=0;i<8;i++){c.strokeStyle=`rgba(97,107,154,${.035+i*.009})`;c.lineWidth=1+i*.45;c.beginPath();c.ellipse(0,0,esc*(3.2+i*.45),esc*(.8+i*.12),0,0,TAU);c.stroke();}c.restore();
    const bx=Math.sin(t*.55)*2.4,b=P(bx,-7.2),radio=esc*.78;halo(c,b.x,b.y,radio*3.6,'#dc3d6128');c.save();c.translate(b.x,b.y);c.rotate(t*.13);for(let i=0;i<16;i++){const a=i*TAU/16;pol(c,[[Math.cos(a)*radio,Math.sin(a)*radio],[Math.cos(a+.09)*radio*2.5,Math.sin(a+.09)*radio*2.5],[Math.cos(a+.2)*radio*1.1,Math.sin(a+.2)*radio*1.1]],i%2?'#56343d':'#272d44','#b076713d');}c.restore();
    const rg=c.createRadialGradient(b.x-radio*.25,b.y-radio*.3,0,b.x,b.y,radio);rg.addColorStop(0,'#5c353d');rg.addColorStop(.4,'#17121e');rg.addColorStop(.88,'#03030a');rg.addColorStop(1,'#e77982');elipse(c,b.x,b.y,radio,radio,rg);halo(c,b.x-radio*.36,b.y-radio*.72,radio*.65,'#ff8c7325');
    for(const q of m.estela){const p=P(q.x,q.y);elipse(c,p.x,p.y,esc*.12,esc*.3,`rgba(110,178,237,${Math.max(0,q.t)*.5})`);}
    c.save();c.globalCompositeOperation='lighter';c.lineCap='round';for(const q of m.balas){const p=P(q.x,q.y),a=Math.atan2(q.vy,q.vx),r=esc*q.r;c.strokeStyle='#a5327255';c.lineWidth=r*2.7;c.beginPath();c.moveTo(p.x-Math.cos(a)*r*4,p.y-Math.sin(a)*r*4);c.lineTo(p.x,p.y);c.stroke();elipse(c,p.x,p.y,r*1.8,r*1.8,'#c539663f');elipse(c,p.x,p.y,r,r,'#fb9a87');elipse(c,p.x,p.y,r*.42,r*.42,'#ffedde');}c.restore();
    const p=P(m.jugador.x,m.jugador.y),r=esc*.48;halo(c,p.x,p.y,r*3,'#558ecc36');c.save();c.translate(p.x,p.y);const tilt=limite(m.ultimoMovimiento.x,-1,1)*.13;c.rotate(tilt);
    // Pequeño navío de metal, velas plegadas y núcleo del viajero.
    const g=c.createLinearGradient(-r,0,r,0);g.addColorStop(0,'#20374f');g.addColorStop(.5,'#b9cbd0');g.addColorStop(1,'#23364c');pol(c,[[0,-r*1.8],[r*.42,-r*.2],[r*1.2,r*.75],[r*.27,r*.48],[0,r],[-r*.27,r*.48],[-r*1.2,r*.75],[-r*.42,-r*.2]],g,'#b2cad07d');linea(c,0,-r*1.5,0,r*.5,'#f0d2a3',1.2);halo(c,0,r,r*1.1,'#64a6ff66');elipse(c,0,r*1.2,r*.12,r*.6,'#abd5ff');elipse(c,0,-r*.25,r*.14,r*.24,'#f4ddb0');c.restore();
    if(m.escudo>0){halo(c,p.x,p.y,esc*.95,'#65d6ff44');c.strokeStyle='#b5eeff';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,esc*.68,0,TAU);c.stroke();}
    if(m.invulnerable>0){c.strokeStyle='#ef9a8a88';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,esc*.9,0,TAU);c.stroke();}
    for(const q of m.particulas){const p=P(q.x,q.y);elipse(c,p.x,p.y,1.2,1.2,q.color);}
    // Límites muy discretos del campo jugable: toda la nave permanece visible.
    const a=P(-5.85,-7.4),d=P(5.85,7.4);c.strokeStyle='#9aa3bc18';c.lineWidth=1;c.strokeRect(a.x,a.y,d.x-a.x,d.y-a.y);
  }
  function dibujarDuelo(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t,cx=w*.5,base=h*.81,esc=Math.min(w*.25,h*.3),a=m.ataques[m.ataques.length-1],fase=a?limite(a.edad/a.aviso,0,1):0;
    fondo(c,w,h,'#09080d','#1b1015');halo(c,cx,h*.32,w*.6,'#783b352d');halo(c,cx,base,esc*1.5,'#4d607023');
    // Columnas de la sala del juicio y pasillos que desaparecen en la niebla.
    for(const lado of [-1,1])for(let i=0;i<4;i++){const x=cx+lado*w*(.22+i*.12),alto=h*(.65-i*.05),an=w*(.03+i*.017);const g=c.createLinearGradient(x-an,0,x+an,0);g.addColorStop(0,'#070910');g.addColorStop(.5,'#3b3337');g.addColorStop(1,'#13131c');c.fillStyle=g;c.fillRect(x-an,h*.68-alto,an*2,alto);c.fillStyle='#8a73632b';c.fillRect(x-an,h*.68-alto,an*.15,alto);}
    for(let i=0;i<8;i++){const z=(i+.4)/8,yy=h*.57+(h*.53)*z*z;c.strokeStyle='#b49b6921';linea(c,0,yy,w,yy,'#b49b6921');}for(let i=-5;i<=5;i++)linea(c,cx+i*w*.018,h*.56,cx+i*w*.22,h,'#b49b6919');
    c.strokeStyle='#a991713d';c.lineWidth=1;for(const r of [1,1.1,1.55]){c.beginPath();c.ellipse(cx,base,esc*r,esc*r*.27,0,0,TAU);c.stroke();}
    // El Editor: cuerpo monumental envuelto en placas y cables tensos.
    const ex=cx,ey=h*.57,tam=Math.min(w*.4,h*.4),carga=a&&!a.resuelto?Math.pow(fase,2):0;
    const conArte=retratoEditor?.complete&&retratoEditor.naturalWidth;
    if(conArte){const ancho=Math.min(w*.98,h*.82),alto=ancho*1.035,yy=h*.065; c.save();c.globalCompositeOperation='screen';const respira=1+Math.sin(t*1.9)*.004;c.translate(cx,yy+alto*.5);c.scale(respira,respira);c.drawImage(retratoEditor,0,0,retratoEditor.naturalWidth,retratoEditor.naturalHeight*.79,-ancho*.5,-alto*.5,ancho,alto);c.restore();const velo=c.createLinearGradient(0,yy+alto*.72,0,yy+alto);velo.addColorStop(0,'transparent');velo.addColorStop(1,'#151118');c.fillStyle=velo;c.fillRect(0,yy+alto*.72,w,alto*.28);}
    c.save();c.translate(ex,ey);c.scale(tam/100,tam/100);c.translate(-carga*3, -carga*2);
    if(!conArte){for(let i=0;i<9;i++){c.strokeStyle=i%2?'#463d4544':'#12121c';c.lineWidth=5-i%3;c.beginPath();c.moveTo((i-4)*8,-65);c.bezierCurveTo((i-4)*17,-45,(i-4)*22,-16,(i-4)*30,6);c.stroke();}
    const capa=c.createLinearGradient(-55,0,55,0);capa.addColorStop(0,'#0a0b12');capa.addColorStop(.5,'#39323c');capa.addColorStop(1,'#0b0a11');pol(c,[[-27,-82],[23,-86],[41,-37],[64,13],[6,6],[-62,13],[-42,-36]],capa,'#64545955');
    for(const lado of [-1,1]){pol(c,[[lado*14,-72],[lado*39,-58],[lado*49,-34],[lado*33,-24],[lado*15,-48]],'#292630','#8e756650');pol(c,[[lado*32,-41],[lado*46,-35],[lado*41,-12],[lado*30,-19]],'#514149','#aa827366');}
    pol(c,[[-19,-76],[0,-94],[21,-76],[13,-43],[-10,-42]],'#11111a','#736568');pol(c,[[-15,-73],[-2,-78],[1,-65],[-10,-66]],'#e78c78');pol(c,[[4,-78],[17,-74],[12,-66],[2,-65]],'#e78c78');halo(c,0,-71,27,'#cf3d492b');}
    const hombroX=(a?a.lado:1)*35,hombroY=-37;let ang=a?(a.lado<0?-.9:.9)*(1-fase*.45):.5;if(a?.resuelto)ang=a.lado*(.45-2.4*limite((a.edad-a.aviso)/.25,0,1));
    c.save();c.translate(hombroX,hombroY);c.rotate(ang);pol(c,[[-4,14],[4,14],[5,-82],[0,-110],[-5,-82]],'#8c8e97','#d6c1a0');linea(c,0,8,0,-97,'#f6dcb0',1);linea(c,-13,2,13,2,'#aa8a65',4);c.restore();c.restore();
    const px=cx+m.jugador.x*w*.19,py=base,tamHero=Math.min(w*.16,h*.23);heroe(s,c,px,py,tamHero);
    // Aviso diegético: un anillo se contrae sobre el escudo, no tapa la acción.
    if(a&&!a.resuelto){const centroY=py-tamHero*.58,r0=tamHero*.29,r=r0+(1-fase)*tamHero*.75,color=fase>.81?'#fff0c4':'#c28d71';halo(c,px,centroY,tamHero*1.2,'#c4774422');c.strokeStyle=color;c.lineWidth=fase>.81?2.5:1.5;c.beginPath();c.arc(px,centroY,r,0,TAU);c.stroke();c.strokeStyle='#e4c18b66';c.lineWidth=1;c.beginPath();c.arc(px,centroY,r0,0,TAU);c.stroke();
      const marcaX=cx+a.objetivo*w*.19;elipse(c,marcaX,py+4,a.barrido?esc*1.6:w*.125,9,`rgba(183,58,52,${.12+fase*.2})`);
      c.fillStyle=color;c.font=`${Math.max(9,Math.min(12,w*.03))}px Georgia`;c.textAlign='center';c.fillText(a.barrido?'ONDA DE CORTE':'GOLPE',cx,h*.13);}
    if(a?.resuelto&&a.edad-a.aviso<.28){const p=limite((a.edad-a.aviso)/.28,0,1);c.save();c.strokeStyle=m.parada>0?'#fff2c6':'#efb38d';c.lineWidth=12*(1-p)+1;c.globalAlpha=1-p;c.beginPath();c.moveTo(cx-a.lado*w*.45,h*.32);c.quadraticCurveTo(cx+a.lado*w*.35,h*.61,px+a.lado*w*.35,py+20);c.stroke();c.strokeStyle='#fff7df';c.lineWidth=2;c.stroke();c.restore();}
    if(m.parada>0){c.save();c.strokeStyle='#f7dca3';c.lineWidth=2.5;c.shadowColor='#efb86c';c.shadowBlur=15;c.beginPath();c.arc(px,py-tamHero*.58,tamHero*.5,Math.PI*1.08,TAU-.08);c.stroke();c.restore();}
    if(m.juicio>0){c.globalAlpha=Math.min(1,m.juicio*3);c.fillStyle=m.juicioTexto==='HERIDA'?'#e39886':'#efdbb1';c.textAlign='center';c.font=`${Math.max(11,Math.min(18,w*.038))}px Georgia`;c.fillText(m.juicioTexto,cx,h*.21);c.globalAlpha=1;}
    for(const q of m.particulas){const xx=px+q.x*12,yy=py-tamHero*.6+q.y*12;linea(c,xx,yy,xx-q.vx*2,yy-q.vy*2,q.color,1.2);}
    motas(c,w,h,t,'#d8b696',36);
  }
  function sueloContencion(s){
    if(s.sueloContencion)return s.sueloContencion;
    const lienzo=document.createElement('canvas');lienzo.width=lienzo.height=672;const c=lienzo.getContext('2d'),n=48;
    c.fillStyle='#0b1019';c.fillRect(0,0,672,672);
    for(let y=0;y<14;y++)for(let x=0;x<14;x++){
      const xx=x*n,yy=y*n,g=c.createLinearGradient(xx,yy,xx+n,yy+n);g.addColorStop(0,(x+y)%2?'#30343b':'#282f38');g.addColorStop(.4,'#202631');g.addColorStop(1,'#121924');c.fillStyle=g;c.fillRect(xx+1,yy+1,n-2,n-2);
      c.strokeStyle='#899ca523';c.lineWidth=1;c.beginPath();c.moveTo(xx+2,yy+n-3);c.lineTo(xx+2,yy+2);c.lineTo(xx+n-3,yy+2);c.stroke();
      c.strokeStyle='#04070ca6';c.beginPath();c.moveTo(xx+n-2,yy+2);c.lineTo(xx+n-2,yy+n-2);c.lineTo(xx+2,yy+n-2);c.stroke();
      for(const dx of [6,n-6])for(const dy of [6,n-6]){elipse(c,xx+dx,yy+dy,1.3,1.3,'#02050a');elipse(c,xx+dx-.4,yy+dy-.4,.6,.6,'#acb2aa66');}
      // Desgaste anclado al metal: exclusivamente decorativo, sin obstáculos.
      for(let i=0;i<3;i++){const fx=((Math.sin(x*53.5+y*14.8+i*23)*4371)%1+1)%1,fy=((Math.sin(x*8.7+y*49.6+i*21)*3865)%1+1)%1;linea(c,xx+fx*n,yy+fy*n,xx+fx*n+4,yy+fy*n+1,'#8996a314',.6);}
    }
    c.save();c.translate(336,336);c.strokeStyle='#75939620';c.lineWidth=2;for(const r of [72,98,208,218,287]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}for(let i=0;i<48;i++){const a=i*TAU/48;linea(c,Math.cos(a)*278,Math.sin(a)*278,Math.cos(a)*(i%4===0?264:272),Math.sin(a)*(i%4===0?264:272),'#b9b59030',2);}
    c.strokeStyle='#abbead20';c.lineWidth=1;c.rotate(Math.PI/4);c.strokeRect(-38,-38,76,76);c.strokeRect(-27,-27,54,54);c.restore();s.sueloContencion=lienzo;return lienzo;
  }
  function extremosRayo(r){
    const puntos=[],dx=-r.ny,dy=r.nx,cx=r.nx*r.offset,cy=r.ny*r.offset;
    for(const borde of [-7,7]){if(Math.abs(dx)>1e-8){const t=(borde-cx)/dx,y=cy+t*dy;if(y>=-7-1e-7&&y<=7+1e-7)puntos.push({x:borde,y,t});}if(Math.abs(dy)>1e-8){const t=(borde-cy)/dy,x=cx+t*dx;if(x>=-7-1e-7&&x<=7+1e-7)puntos.push({x,y:borde,t});}}
    puntos.sort((a,b)=>a.t-b.t);return[puntos[0],puntos[puntos.length-1]];
  }
  function dibujarLaseres(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t,esc=Math.min(w,h)/15.2,cx=w/2,cy=h/2,P=(x,y)=>({x:cx+x*esc,y:cy+y*esc}),x=cx-7*esc,y=cy-7*esc,tam=14*esc;
    fondo(c,w,h,'#050811','#091018');halo(c,cx,cy,tam*.86,'#14303d49');
    // Pozos técnicos fuera del límite jugable, con canalizaciones de cobre.
    c.save();c.translate(cx,cy);c.strokeStyle='#32434b44';c.lineWidth=Math.max(1,esc*.08);for(let i=0;i<4;i++){const r=tam*(.72+i*.12);c.beginPath();c.ellipse(0,0,r,r*.83,0,0,TAU);c.stroke();}
    for(let i=0;i<16;i++){const a=i*TAU/16,r=tam*.79;linea(c,Math.cos(a)*r*.72,Math.sin(a)*r*.72,Math.cos(a)*r,Math.sin(a)*r,'#7f7a5e28',Math.max(1,esc*.045));}c.restore();
    // Marco biselado: el borde interior coincide con ±7 del modelo.
    c.fillStyle='#02040b';c.fillRect(x-esc*.5,y-esc*.5,tam+esc,tam+esc);const marco=c.createLinearGradient(x,y,x+tam,y+tam);marco.addColorStop(0,'#77827a');marco.addColorStop(.07,'#3c454d');marco.addColorStop(.5,'#141f2b');marco.addColorStop(1,'#4d554f');c.fillStyle=marco;c.fillRect(x-esc*.31,y-esc*.31,tam+esc*.62,tam+esc*.62);c.drawImage(sueloContencion(s),x,y,tam,tam);
    c.strokeStyle='#b1b69877';c.lineWidth=1;c.strokeRect(x-esc*.27,y-esc*.27,tam+esc*.54,tam+esc*.54);c.strokeStyle='#050912';c.lineWidth=Math.max(2,esc*.13);c.strokeRect(x,y,tam,tam);
    // Luminarias frías en el exterior; nunca sugieren casillas bloqueadas.
    for(let i=-6;i<=6;i+=3)for(const lado of [-1,1]){for(const p of [P(i,lado*7.18),P(lado*7.18,i)]){halo(c,p.x,p.y,esc*.85,'#6eb8cd25');elipse(c,p.x,p.y,Math.max(1,esc*.07),Math.max(1,esc*.07),'#b4d9dc');}}
    c.save();c.beginPath();c.rect(x,y,tam,tam);c.clip();
    const luz=c.createRadialGradient(cx-tam*.2,cy-tam*.3,tam*.01,cx,cy,tam*.7);luz.addColorStop(0,'#9bcac41a');luz.addColorStop(1,'#00050e77');c.fillStyle=luz;c.fillRect(x,y,tam,tam);
    for(const r of m.rayos){
      const dx=-r.ny,dy=r.nx,aa=P(r.nx*r.offset+dx*15,r.ny*r.offset+dy*15),bb=P(r.nx*r.offset-dx*15,r.ny*r.offset-dy*15),aviso=r.edad<r.aviso,activo=r.edad<r.aviso+r.activo,ancho=r.ancho*2*esc;
      c.save();c.lineCap='butt';
      if(aviso){const z=limite(r.edad/r.aviso,0,1),pulso=.8+.2*Math.sin(t*16);linea(c,aa.x,aa.y,bb.x,bb.y,`rgba(255,143,58,${.08+z*.13})`,(r.ancho*2+.65)*esc);linea(c,aa.x,aa.y,bb.x,bb.y,`rgba(240,139,66,${.12+z*.19})`,ancho);
        c.setLineDash([Math.max(3,esc*.2),Math.max(3,esc*.2)]);c.lineDashOffset=-t*15;linea(c,aa.x,aa.y,bb.x,bb.y,`rgba(255,210,137,${(.45+.5*z)*pulso})`,Math.max(1,esc*.055));c.setLineDash([]);
        // Estas líneas marcan exactamente los dos límites físicos del haz.
        for(const lado of [-1,1])linea(c,aa.x+r.nx*r.ancho*esc*lado,aa.y+r.ny*r.ancho*esc*lado,bb.x+r.nx*r.ancho*esc*lado,bb.y+r.ny*r.ancho*esc*lado,'#e5985555',.75);
      }else{c.globalAlpha=activo?1:Math.max(0,1-(r.edad-r.aviso-r.activo)/.25);linea(c,aa.x,aa.y,bb.x,bb.y,'#f74e4119',ancho+esc*.9);linea(c,aa.x,aa.y,bb.x,bb.y,'#ff65472c',ancho+esc*.42);linea(c,aa.x,aa.y,bb.x,bb.y,'#ea493ee0',ancho);
        const centro=P(r.nx*r.offset,r.ny*r.offset),grad=c.createLinearGradient(centro.x-r.nx*r.ancho*esc,centro.y-r.ny*r.ancho*esc,centro.x+r.nx*r.ancho*esc,centro.y+r.ny*r.ancho*esc);grad.addColorStop(0,'#ff6e5255');grad.addColorStop(.43,'#ffdab8');grad.addColorStop(.5,'#fffbe8');grad.addColorStop(.57,'#ffdab8');grad.addColorStop(1,'#ff6e5255');linea(c,aa.x,aa.y,bb.x,bb.y,grad,ancho);
        for(let i=0;i<9;i++){const q=(i/9+t*.73)%1,xx=mezcla(aa.x,bb.x,q),yy=mezcla(aa.y,bb.y,q);linea(c,xx,yy,xx-r.nx*esc*.3,yy-r.ny*esc*.3,'#ffeac27d',1);}
      }c.restore();
    }
    for(const q of m.particulas){const p=P(q.x,q.y);c.globalAlpha=limite(q.t*3,0,1);linea(c,p.x,p.y,p.x-q.vx*esc*.04,p.y-q.vy*esc*.04,q.color,Math.max(1,esc*.055));}c.globalAlpha=1;c.restore();
    // Cada emisor se sitúa donde su rayo real encuentra el marco del cuadrado.
    for(const r of m.rayos){const aviso=r.edad<r.aviso,z=limite(r.edad/r.aviso,0,1),fin=extremosRayo(r);for(const e of fin){if(!e)continue;const p=P(e.x,e.y),ang=Math.atan2(cy-p.y,cx-p.x);c.save();c.translate(p.x,p.y);c.rotate(ang);const rr=esc*.29;pol(c,[[-rr,-rr],[rr*.6,-rr],[rr,-rr*.5],[rr,rr*.5],[rr*.6,rr],[-rr,rr]],'#1f2d37','#9da69a');linea(c,-rr*.8,-rr*.7,rr*.5,-rr*.7,'#5a767c',1);linea(c,-rr*.8,rr*.7,rr*.5,rr*.7,'#5a767c',1);halo(c,rr*.6,0,esc*(.6+z*.6),aviso?'#f7b25c44':'#fb61467d');elipse(c,rr*.75,0,rr*.2,rr*.52,aviso?'#e8bb74':'#ffe2b3');c.strokeStyle=aviso?'#f5cf93':'#ffe3c9';c.lineWidth=Math.max(1,esc*.055);c.beginPath();c.arc(0,0,rr*1.45,-Math.PI/2,-Math.PI/2+TAU*z);c.stroke();c.restore();}}
    const p=P(m.jugador.x,m.jugador.y);heroe(s,c,p.x,p.y,Math.max(19,esc*.88));
    c.strokeStyle=m.impulso>0?'#d0f4ff':'#d1d6b799';c.lineWidth=1;c.beginPath();c.ellipse(p.x,p.y,esc*m.jugador.r,esc*m.jugador.r,0,0,TAU);c.stroke();
    if(m.impulso>0){const d=m.ultimoMovimiento;linea(c,p.x,p.y,p.x-d.x*esc*1.25,p.y-d.y*esc*1.25,'#bee9fa55',esc*.45);halo(c,p.x,p.y,esc*1.4,'#88d9ff33');}
    const avisa=m.rayos.some(r=>r.edad<r.aviso),activo=m.rayos.some(r=>r.edad>=r.aviso&&r.edad<r.aviso+r.activo);c.textAlign='center';c.font=`600 ${Math.max(9,Math.min(11,w*.026))}px system-ui`;c.fillStyle=activo?'#ffd6b6':avisa?'#e5c492':'#91abb0';const mensaje=activo?'DESCARGA':avisa?'FRANJA ÁMBAR':'CONTENCIÓN';if(y<24&&x>110){c.textAlign='right';c.fillText(mensaje,x-18,cy+4);}else c.fillText(activo?'DESCARGA':avisa?'APÁRTATE DE LA FRANJA ÁMBAR':'CÁMARA DE CONTENCIÓN',cx,Math.max(13,y-esc*.45));
    // Bruma periférica: permanece fuera del área de daño para conservar lectura.
    halo(c,cx,y-tam*.45,tam*.55,'#72a3a21a');motas(c,w,h,t,'#9bb6c2',28);
  }
  API.pintores=Object.assign(API.pintores||{},{carrera:dibujarCarrera,orbital:dibujarOrbital,duelo:dibujarDuelo,laseres:dibujarLaseres});
})(typeof window!=='undefined'?window:globalThis);

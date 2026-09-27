/* V · El último asalto: un guerrero contra el Dragón Celestial, a la manera
   de Punch-Out. Sustituye la prueba del hueco V (tipo «orbital») allí donde
   se carga este módulo, después de pitagoras-mundos.js.
   El dragón avisa cada ataque con su pose y el jugador lo lee:
     · zarpazo por un lado (brazo alzado): esquiva hacia el otro lado;
     · fuego (cabeza atrás, pecho encendido): sólo agacharse; golpearlo
       mientras carga lo interrumpe (contra: doble daño y aturdido);
     · mordisco (cabeza baja, fauces abiertas): esquiva a un lado;
     · aplastar (los dos brazos arriba): esquiva a un lado (agachado te aplasta).
   Tras una esquiva el dragón queda aturdido: es el momento de golpear. Golpear
   su guardia no sirve (bloquea y ataca antes). A 0 de vida cae, se levanta y
   pelea más rápido. 20 segundos y 3 vidas, como el resto de pruebas.
   Aquí viven también las piezas pintadas (atlas), la pose de cada instante
   (rig) y el pintor clásico, que comparten el pintor 3D y el 2D.
   Determinista: el azar vive en s.azar y los pintores sólo leen. */
'use strict';
(function(global){
  const API=global.PITAGORAS_PRUEBAS;if(!API||!API.tipos?.orbital)return;
  const M=API.modelo,crearPrevio=M.crear,pasoPrevio=M.paso,TAU=Math.PI*2;
  const lim=(x,a,b)=>Math.max(a,Math.min(b,x)),mezcla=(a,b,k)=>a+(b-a)*k,suave=k=>{k=lim(k,0,1);return k*k*(3-2*k);};
  // Esquiva activa y su recuperación; el golpe acierta a los 0,07 s y se repite cada 0,26 s.
  const ESQ=.5,ESQ_REC=.2,GOLPE_ACT=.07,GOLPE_REC=.26,IMPACTO=.06,VIDA=10;
  const ATAQUES={
    garra_izq:{aviso:.75,evita:['der'],nombre:'zarpazo'},
    garra_der:{aviso:.75,evita:['izq'],nombre:'zarpazo'},
    fuego:{aviso:1.05,evita:['agacha'],nombre:'fuego'},
    mordisco:{aviso:.72,evita:['izq','der'],nombre:'mordisco'},
    aplastar:{aviso:.9,evita:['izq','der'],nombre:'aplastar'},
    doble:{aviso:.7,evita:['der'],nombre:'doble zarpazo'},
  };
  function azar(s){let t=s.azar+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}

  Object.assign(API.tipos.orbital,{
    nombre:'El último asalto',sub:'Un dragón del tamaño del cielo.',
    texto:'Aguanta 20 segundos frente al Dragón Celestial. Lee su pose: esquiva el zarpazo hacia el otro lado, agáchate ante el fuego y apártate del mordisco y de sus dos garras. Cuando falla queda aturdido: golpéalo. Si lo golpeas mientras carga el fuego, lo interrumpes.',
    control:'Izquierda: esquivar a un lado o agacharse. Derecha: GOLPE, cuando el dragón queda aturdido.',
    teclado:'A/D o flechas: esquivar · S o ↓: agacharse · Espacio o clic: golpe.',
    accion:'GOLPE',glifo:'⚔',ayuda:'Esquiva su ataque y golpea cuando queda aturdido.',instruccion:'Lee al dragón.',movimiento:'ESQUIVAR'
  });

  M.crear=function(op={}){
    const s=crearPrevio(op);if(s.tipo!=='orbital')return s;
    Object.assign(s,{siguiente:.9,oleada:0,dirPrev:null,golpes:0,esquivas:0,contras:0,derribos:0,juicio:0,juicioTexto:'',
      dragon:{estado:'guardia',ataque:null,desde:0,dur:0,fase:0,hp:VIDA,hpMax:VIDA,dolor:0,impactado:false,evadido:false,ritmo:1},
      guerrero:{accion:'quieto',desde:-9,lado:1,pendiente:false,golpeado:-9}});
    s.jugador={x:0,y:0,a:-Math.PI/2,r:.3};return s;
  };
  const libre=(s,g=s.guerrero)=>g.accion==='quieto';
  function juicio(s,texto){s.juicio=.8;s.juicioTexto=texto;}
  function empezar(s,ataque,factor=1){
    const d=s.dragon,a=ATAQUES[ataque];Object.assign(d,{estado:'aviso',ataque,desde:s.t,dur:a.aviso*factor*d.ritmo*(s.t>12?.9:1),fase:0,impactado:false,evadido:false});s.eventos.push('disparo');
  }
  function elegir(s){
    const n=s.oleada++,t=s.t;
    if(t<5)return azar(s)<.5?'garra_izq':'garra_der';
    const lista=t<11?['garra_izq','garra_der','fuego','mordisco']:['garra_izq','garra_der','fuego','mordisco','aplastar','doble'];
    // Nunca el mismo ataque dos veces seguidas: el jugador siempre tiene algo nuevo que leer.
    let a=lista[Math.floor(azar(s)*lista.length)];if(a===s.ultimoAtaque)a=lista[(lista.indexOf(a)+1+n%2)%lista.length];s.ultimoAtaque=a;return a;
  }
  function estado(s,e,dur){const d=s.dragon;d.estado=e;d.desde=s.t;d.dur=dur;}
  // El impacto: ¿la esquiva o el agacharse del guerrero está activo y es el que evita este ataque?
  function impacto(s){
    const d=s.dragon,g=s.guerrero,a=d.ataque==='doble'?(d.fase?'garra_der':'garra_izq'):d.ataque,evita=ATAQUES[a].evita;
    d.impactado=true;
    if(evita.includes(g.accion)&&s.t-g.desde<=ESQ){d.evadido=true;s.esquivas++;juicio(s,'¡ESQUIVA!');s.eventos.push('impulso');return;}
    d.evadido=false;if(M.herir(s)){g.golpeado=s.t;juicio(s,a==='fuego'?'¡QUEMADO!':'¡GOLPE!');}
  }
  // El golpe del guerrero: sólo hace daño si el dragón está aturdido (o si interrumpe el fuego).
  function golpear(s){
    const d=s.dragon,g=s.guerrero;g.pendiente=false;
    if(d.estado==='aturdido'){d.hp--;d.dolor=.2;s.golpes++;s.muertes++;s.fogonazo=.12;s.eventos.push('acierto');juicio(s,d.hp<=0?'¡DERRIBADO!':'¡TOMA!');if(d.hp<=0){estado(s,'derribado',2.1);s.derribos++;}return;}
    if(d.estado==='aviso'&&d.ataque==='fuego'&&(s.t-d.desde)/d.dur<.6){d.hp=Math.max(0,d.hp-2);d.dolor=.3;s.golpes++;s.contras++;s.muertes++;s.fogonazo=.2;s.eventos.push('acierto');juicio(s,'¡CONTRA!');
      if(d.hp<=0){estado(s,'derribado',2.1);s.derribos++;}else estado(s,'aturdido',1.3);return;}
    if(d.estado==='derribado'||d.estado==='levanta'||d.estado==='golpe')return;
    // Golpear la guardia: bloquea y responde antes (machacar el botón no sirve).
    juicio(s,'BLOQUEA');d.dolor=0;if(d.estado==='guardia'){s.siguiente=s.t;s.bloqueoRapido=true;}
  }
  function paso(s,e,dt){
    if(s.terminado)return;s.t=Math.min(s.duracion,s.t+dt);
    for(const k of ['invulnerable','impacto','fogonazo','recargaImpulso'])s[k]=Math.max(0,s[k]-dt);
    s.juicio=Math.max(0,s.juicio-dt);const d=s.dragon,g=s.guerrero;d.dolor=Math.max(0,d.dolor-dt);
    // Entrada: una dirección nueva esquiva en cuanto el guerrero queda libre (se guarda si está
    // ocupado); mantenerla no repite la esquiva. El golpe cuenta al pulsar.
    const mx=lim(Number(e.mx)||0,-1,1),my=lim(Number(e.my)||0,-1,1),dir=my>.5?'agacha':mx<-.5?'izq':mx>.5?'der':null;
    if(g.accion!=='quieto'){const fin=g.accion==='golpe'?GOLPE_REC:ESQ+ESQ_REC;if(s.t-g.desde>=fin)g.accion='quieto';}
    if(dir&&dir!==s.dirPrev&&libre(s)){g.accion=dir;g.desde=s.t;s.dirPrev=dir;}
    if(!dir)s.dirPrev=null;
    if(e.accion&&!s.pulsado&&libre(s)){g.accion='golpe';g.desde=s.t;g.lado=-g.lado;g.pendiente=true;}
    if(g.accion==='golpe'&&g.pendiente&&s.t-g.desde>=GOLPE_ACT)golpear(s);
    // El dragón: guardia → aviso → golpe → (aturdido | recupera) → guardia; a 0, derribado → levanta.
    const k=s.t-d.desde;
    if(d.estado==='guardia'){if(s.t>=s.siguiente){const rapido=s.bloqueoRapido;s.bloqueoRapido=false;empezar(s,rapido?(azar(s)<.5?'garra_izq':'garra_der'):elegir(s),rapido?.7:1);}}
    else if(d.estado==='aviso'){if(k>=d.dur){estado(s,'golpe',.3);d.impactado=false;}}
    else if(d.estado==='golpe'){
      if(!d.impactado&&k>=IMPACTO)impacto(s);
      if(k>=d.dur){
        if(d.evadido&&d.ataque==='doble'&&d.fase===0){d.estado='aviso';d.desde=s.t;d.dur=.42*d.ritmo;d.fase=1;d.impactado=false;d.evadido=false;}
        else if(d.evadido)estado(s,'aturdido',d.ataque==='doble'?1.25:1);
        else estado(s,'recupera',.5);
      }
    }
    else if(d.estado==='aturdido'){if(k>=d.dur){estado(s,'guardia',0);s.siguiente=s.t+.35;}}
    else if(d.estado==='recupera'){if(k>=d.dur){estado(s,'guardia',0);s.siguiente=s.t+.55+azar(s)*.35*d.ritmo;}}
    else if(d.estado==='derribado'){if(k>=d.dur){estado(s,'levanta',.8);}}
    else if(d.estado==='levanta'){if(k>=d.dur){d.hp=d.hpMax;d.ritmo=Math.max(.7,d.ritmo*.86);estado(s,'guardia',0);s.siguiente=s.t+.5;}}
    s.pulsado=!!e.accion;
    for(const q of s.particulas){q.x+=q.vx*dt;q.y+=q.vy*dt;q.t-=dt;}s.particulas=s.particulas.filter(q=>q.t>0);
    if(!s.terminado&&s.t>=s.duracion-1e-8){s.t=s.duracion;s.terminado=true;s.sobrevivio=true;}
  }
  M.paso=function(s,e={},dt=1/60){if(s.tipo!=='orbital')return pasoPrevio(s,e,dt);dt=lim(Number(dt)||0,0,60);while(dt>1e-8&&!s.terminado){const q=Math.min(dt,1/60,s.duracion-s.t);paso(s,e,q);dt-=q;}return s;};

  // Guía: lee la pose (el aviso) y esquiva hacia donde el ataque no llega en el último tercio del
  // aviso; interrumpe el fuego al empezar a cargarlo y golpea mientras el dragón está aturdido.
  API.guiasPrueba=API.guiasPrueba||{};
  API.guiasPrueba.orbital=function(s,mem={}){
    const d=s.dragon,g=s.guerrero,nada={mx:0,my:0,accion:false};
    if(d.estado==='aviso'){
      const a=d.ataque==='doble'?(d.fase?'garra_der':'garra_izq'):d.ataque,resta=d.desde+d.dur-s.t;
      // Se agacha ante un fuego e interrumpe el siguiente, alternando.
      if(a==='fuego'&&mem.visto!==d.desde){mem.visto=d.desde;mem.fuegos=(mem.fuegos||0)+1;}
      if(a==='fuego'&&mem.fuegos%2===0&&(s.t-d.desde)/d.dur<.4&&libre(s)&&mem.contra!==d.desde){mem.contra=d.desde;return{mx:0,my:0,accion:true};}
      if(resta<=.28){const dir=ATAQUES[a].evita[0];return{mx:dir==='izq'?-1:dir==='der'?1:0,my:dir==='agacha'?1:0,accion:false};}
      return nada;
    }
    if(d.estado==='aturdido'&&d.desde+d.dur-s.t>.2){mem.pulso=!mem.pulso;return{mx:0,my:0,accion:mem.pulso&&libre(s)};}
    return nada;
  };

  /* ---- Las piezas pintadas (atlas 4×4 de 256 px) ------------------------------ */
  // 0 torso · 1 cabeza · 2 cabeza con las fauces abiertas · 3 brazo · 4 antebrazo con garra
  // 5 ala · 6 estrellas del aturdido · 7 patas y cola · 8 halo · 9 guerrero de espaldas
  // 10 tajo · 11 guerrero agachado · 12 guerrero golpeando · 13 fuego · 14 cuello · 15 zarpazo
  const TINTA='#1a0f0a',ORO='#e9b949',ORO_C='#fff1b0',ORO_O='#a8741c',MORADO='#7a4fb0',MORADO_C='#b995e2',MORADO_O='#3d2466',CREMA='#f1d9a0';
  let atlasLienzo=null;
  function atlas(){
    if(atlasLienzo)return atlasLienzo;if(typeof document==='undefined')return null;
    const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');g.lineJoin='round';g.lineCap='round';
    const celda=(i,fn)=>{g.save();g.translate((i%4)*256,Math.floor(i/4)*256);g.beginPath();g.rect(4,4,248,248);g.clip();fn();g.restore();};
    const trazo=(w=4,col=TINTA)=>{g.lineWidth=w;g.strokeStyle=col;g.stroke();};
    const relleno=(f)=>{g.fillStyle=f;g.fill();};
    const lineal=(x0,y0,x1,y1,paradas)=>{const q=g.createLinearGradient(x0,y0,x1,y1);paradas.forEach(([k,c])=>q.addColorStop(k,c));return q;};
    const radial=(x,y,r0,r1,paradas,dx=0,dy=0)=>{const q=g.createRadialGradient(x+dx,y+dy,r0,x,y,r1);paradas.forEach(([k,c])=>q.addColorStop(k,c));return q;};
    const escamas=(x0,y0,x1,y1,paso,col)=>{g.save();g.clip();g.strokeStyle=col;g.lineWidth=1.6;for(let y=y0;y<y1;y+=paso*.8)for(let x=x0+((y/paso|0)%2)*paso/2;x<x1;x+=paso){g.beginPath();g.arc(x,y,paso*.5,.15*Math.PI,.85*Math.PI);g.stroke();}g.restore();};
    const estrella=(x,y,r,col=ORO)=>{g.beginPath();for(let k=0;k<16;k++){const a=k*Math.PI/8-Math.PI/2,rr=k%2?r*.28:(k%4?r*.6:r);g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.fillStyle=col;g.fill();g.lineWidth=1;g.strokeStyle=ORO_O;g.stroke();};
    const cuerno=(x,y,lado)=>{g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+lado*34,y-30,x+lado*50,y-78);g.quadraticCurveTo(x+lado*20,y-40,x-lado*14,y-8);g.closePath();relleno(lineal(x,y,x+lado*50,y-78,[[0,ORO_O],[.5,ORO],[1,ORO_C]]));trazo(3);};
    // 0 · Torso: pecho ancho, placas de oro en el vientre, escamas y púas en los hombros.
    celda(0,()=>{
      g.beginPath();g.moveTo(96,14);g.bezierCurveTo(40,40,14,70,22,120);g.bezierCurveTo(28,180,64,236,128,246);g.bezierCurveTo(192,236,228,180,234,120);g.bezierCurveTo(242,70,216,40,160,14);g.closePath();
      relleno(radial(128,110,20,150,[[0,MORADO_C],[.55,MORADO],[1,MORADO_O]],-30,-30));g.save();escamas(10,20,250,250,22,'#2a1648aa');g.restore();trazo(5);
      for(let i=0;i<7;i++){const y=48+i*27,w=46-i*3+(i<3?i*5:0);g.beginPath();g.moveTo(128-w,y);g.quadraticCurveTo(128,y+18,128+w,y);g.lineTo(128+w-4,y+22);g.quadraticCurveTo(128,y+40,128-w+4,y+22);g.closePath();relleno(lineal(0,y,0,y+30,[[0,CREMA],[1,'#c89a4c']]));trazo(2.5);}
      for(const l of [-1,1])for(let i=0;i<3;i++){const x=128+l*(78+i*16),y=30+i*18;g.beginPath();g.moveTo(x-8,y+14);g.lineTo(x+l*10,y-18);g.lineTo(x+8,y+14);g.closePath();relleno(ORO);trazo(2);}
    });
    // 1 y 2 · La cabeza de frente: cuernos de oro, crestas, ojos almendrados amarillos y el hocico.
    const cabeza=abierta=>{
      for(const l of [-1,1]){cuerno(128+l*44,78,l);g.beginPath();g.moveTo(128+l*70,100);g.lineTo(128+l*118,86);g.lineTo(128+l*92,118);g.lineTo(128+l*120,128);g.lineTo(128+l*80,140);g.closePath();relleno(MORADO_O);trazo(2.5);}
      g.beginPath();g.moveTo(128,60);g.bezierCurveTo(70,62,48,100,58,136);g.bezierCurveTo(66,166,86,176,92,196);g.lineTo(92,abierta?186:216);g.quadraticCurveTo(128,abierta?196:238,164,abierta?186:216);g.lineTo(164,196);g.bezierCurveTo(170,176,190,166,198,136);g.bezierCurveTo(208,100,186,62,128,60);g.closePath();
      relleno(radial(128,120,10,110,[[0,MORADO_C],[.6,MORADO],[1,MORADO_O]],-18,-24));trazo(4);
      // Frente de oro en rombos y cejas oscuras.
      g.beginPath();g.moveTo(128,70);g.lineTo(146,96);g.lineTo(128,122);g.lineTo(110,96);g.closePath();relleno(lineal(0,70,0,122,[[0,ORO_C],[1,ORO]]));trazo(2);
      for(const l of [-1,1]){
        g.beginPath();g.moveTo(128+l*22,124);g.quadraticCurveTo(128+l*48,108,128+l*70,114);g.lineTo(128+l*66,122);g.quadraticCurveTo(128+l*46,118,128+l*24,132);g.closePath();relleno(MORADO_O);
        g.save();g.translate(128+l*44,134);g.rotate(l*.35);g.beginPath();g.ellipse(0,0,19,9,0,0,TAU);relleno(radial(0,0,1,19,[[0,'#fffbd0'],[.5,'#ffd24a'],[1,'#e08a1a']]));trazo(2.5);g.beginPath();g.ellipse(0,0,3,8,0,0,TAU);relleno(TINTA);g.restore();
        g.beginPath();g.arc(128+l*14,abierta?180:204,4,0,TAU);relleno(TINTA);
      }
      if(abierta){
        // Las fauces: garganta de brasa, dientes de hueso arriba y abajo, mandíbula caída.
        g.beginPath();g.moveTo(86,186);g.quadraticCurveTo(128,200,170,186);g.lineTo(162,236);g.quadraticCurveTo(128,252,94,236);g.closePath();relleno(radial(128,214,4,44,[[0,'#fff0a0'],[.35,'#ff8a2a'],[.75,'#b8200e'],[1,'#3a0806']]));trazo(3);
        for(let i=0;i<7;i++){const x=92+i*12;g.beginPath();g.moveTo(x,188+Math.abs(i-3)*.8);g.lineTo(x+6,204);g.lineTo(x+12,188+Math.abs(i-3)*.8);g.closePath();relleno('#f4ead0');trazo(1.5);}
        for(let i=0;i<6;i++){const x=98+i*11;g.beginPath();g.moveTo(x,236);g.lineTo(x+5.5,222);g.lineTo(x+11,236);g.closePath();relleno('#f4ead0');trazo(1.5);}
        g.beginPath();g.moveTo(94,236);g.quadraticCurveTo(128,254,162,236);g.lineTo(158,248);g.quadraticCurveTo(128,262,98,248);g.closePath();relleno(MORADO);trazo(3);
      }else{g.beginPath();g.moveTo(98,210);g.quadraticCurveTo(128,224,158,210);trazo(3);}
    };
    celda(1,()=>cabeza(false));celda(2,()=>cabeza(true));
    // 3 · Brazo (del hombro, arriba, al codo, abajo).
    celda(3,()=>{g.beginPath();g.moveTo(92,18);g.bezierCurveTo(70,90,84,180,100,236);g.lineTo(156,236);g.bezierCurveTo(172,180,186,90,164,18);g.closePath();relleno(lineal(70,0,186,0,[[0,MORADO_O],[.4,MORADO_C],[1,MORADO]]));g.save();escamas(60,20,200,240,20,'#2a1648aa');g.restore();trazo(4);
      g.beginPath();g.moveTo(112,222);g.lineTo(128,248);g.lineTo(144,222);g.closePath();relleno(ORO);trazo(2);});
    // 4 · Antebrazo y garra: cuatro garras de marfil y oro abiertas hacia abajo.
    celda(4,()=>{g.beginPath();g.moveTo(100,10);g.bezierCurveTo(90,70,94,120,82,150);g.lineTo(174,150);g.bezierCurveTo(162,120,166,70,156,10);g.closePath();relleno(lineal(80,0,176,0,[[0,MORADO_O],[.4,MORADO_C],[1,MORADO]]));g.save();escamas(80,10,180,150,18,'#2a1648aa');g.restore();trazo(4);
      g.beginPath();g.ellipse(128,160,54,30,0,0,TAU);relleno(MORADO);trazo(4);
      for(let i=0;i<4;i++){const x=86+i*28,a=(i-1.5)*.28;g.save();g.translate(x,176);g.rotate(a);g.beginPath();g.moveTo(-10,0);g.quadraticCurveTo(-8,50,6,74);g.quadraticCurveTo(4,40,10,0);g.closePath();relleno(lineal(0,0,0,74,[[0,'#f4ead0'],[.6,ORO],[1,ORO_O]]));trazo(2.5);g.restore();}});
    // 5 · Ala izquierda (raíz abajo a la derecha): huesos de oro y membrana de lapislázuli y lila con estrellas.
    celda(5,()=>{const raiz=[238,238],puntas=[[18,14],[8,96],[26,178],[92,236]];
      g.beginPath();g.moveTo(...raiz);g.lineTo(150,20);g.quadraticCurveTo(80,0,18,14);for(let i=1;i<puntas.length;i++){const a=puntas[i-1],b=puntas[i];g.quadraticCurveTo((a[0]+b[0])/2+24,(a[1]+b[1])/2+6,b[0],b[1]);}g.closePath();
      relleno(radial(200,200,10,260,[[0,MORADO_C],[.5,'#8c6ac4'],[1,'#3b3a8c']]));trazo(4);
      for(const [x,y,r] of [[70,60,11],[40,130,8],[110,120,13],[150,70,8],[80,190,9],[140,176,7]])estrella(x,y,r);
      g.beginPath();g.arc(170,130,14,.4*Math.PI,1.6*Math.PI);g.arc(164,130,11,1.6*Math.PI,.4*Math.PI,true);relleno(ORO);
      g.beginPath();g.moveTo(...raiz);g.lineTo(150,20);trazo(9,TINTA);g.beginPath();g.moveTo(...raiz);g.lineTo(150,20);trazo(5,ORO);
      for(const p of puntas){g.beginPath();g.moveTo(150,20);g.lineTo(...p);trazo(5,TINTA);g.beginPath();g.moveTo(150,20);g.lineTo(...p);trazo(2.5,ORO);}
      g.beginPath();g.moveTo(150,20);g.lineTo(166,2);g.lineTo(162,26);g.closePath();relleno(ORO);trazo(2);});
    // 6 · Estrellas del aturdido.
    celda(6,()=>{for(const [x,y,r] of [[128,128,90]])estrella(x,y,r,ORO_C);});
    // 7 · Patas traseras y cola con aleta.
    celda(7,()=>{
      g.beginPath();g.moveTo(40,210);g.bezierCurveTo(-10,160,20,90,70,120);g.bezierCurveTo(40,130,40,170,70,196);g.closePath();relleno(MORADO);trazo(3);
      g.beginPath();g.moveTo(26,130);g.quadraticCurveTo(0,100,10,70);g.quadraticCurveTo(30,96,44,110);g.closePath();relleno(MORADO_C);trazo(2.5);
      g.beginPath();g.moveTo(40,20);g.bezierCurveTo(30,80,60,120,80,150);g.lineTo(60,226);g.lineTo(196,226);g.lineTo(176,150);g.bezierCurveTo(196,120,226,80,216,20);g.closePath();
      relleno(radial(128,60,10,160,[[0,MORADO_C],[.6,MORADO],[1,MORADO_O]],-20,-10));g.save();escamas(30,20,230,230,20,'#2a1648aa');g.restore();trazo(4);
      g.beginPath();g.moveTo(120,40);g.quadraticCurveTo(128,140,120,226);g.lineTo(136,226);g.quadraticCurveTo(128,140,136,40);relleno(MORADO_O);
      for(const x of [72,178])for(let i=0;i<3;i++){g.save();g.translate(x+(i-1)*16,224);g.beginPath();g.moveTo(-6,0);g.quadraticCurveTo(-4,18,4,26);g.quadraticCurveTo(2,12,6,0);g.closePath();relleno(ORO);trazo(2);g.restore();}
    });
    // 8 · El halo de oro con sus rayos, como el sol del arte.
    celda(8,()=>{for(let i=0;i<36;i++){const a=i*TAU/36,l=i%2?112:122;g.beginPath();g.moveTo(128+Math.cos(a-.05)*84,128+Math.sin(a-.05)*84);g.lineTo(128+Math.cos(a)*l,128+Math.sin(a)*l);g.lineTo(128+Math.cos(a+.05)*84,128+Math.sin(a+.05)*84);g.closePath();relleno(i%2?ORO:ORO_C);}
      g.beginPath();g.arc(128,128,88,0,TAU);relleno(radial(128,128,10,88,[[0,ORO_C],[.7,ORO],[1,ORO_O]]));g.lineWidth=3;g.strokeStyle=ORO_O;g.stroke();g.beginPath();g.arc(128,128,76,0,TAU);g.lineWidth=2;g.stroke();});
    // 9, 11, 12 · El guerrero de espaldas: halo, capucha y capa rojas, escudo azul y oro, espada.
    const guerrero=(pose)=>{
      const agacha=pose==='agacha',golpe=pose==='golpe',cy=agacha?70:0;
      // La espada (detrás en guardia, alzada hacia el dragón al golpear).
      g.save();if(golpe){g.translate(150,92);g.rotate(-.55);}else g.translate(186,110+cy);
      g.beginPath();g.rect(-6,-110,12,104);relleno(lineal(-6,0,6,0,[[0,'#8a96a8'],[.5,'#f2f6fa'],[1,'#7a8698']]));trazo(2.5);g.beginPath();g.rect(-20,-8,40,9);relleno(ORO);trazo(2);g.beginPath();g.rect(-4,1,8,24);relleno('#6e3a1c');trazo(2);g.restore();
      g.beginPath();g.arc(128,48+cy,36,0,TAU);relleno(radial(128,48+cy,4,36,[[0,ORO_C],[.7,ORO],[1,ORO_O]]));trazo(3);
      g.beginPath();g.moveTo(84,94+cy);g.quadraticCurveTo(128,74+cy,172,94+cy);g.lineTo(agacha?206:194,244);g.quadraticCurveTo(128,254,agacha?50:62,244);g.closePath();relleno(lineal(0,90,0,250,[[0,'#c8321f'],[1,'#7c160f']]));trazo(4);
      g.beginPath();g.moveTo(agacha?50:62,242);g.quadraticCurveTo(128,252,agacha?206:194,242);trazo(4,ORO);
      for(let i=0;i<4;i++){g.beginPath();g.moveTo(104+i*16,100+cy);g.quadraticCurveTo(100+i*18,170+cy*.5,96+i*21,236);trazo(2,'#5e0f0a88');}
      g.beginPath();g.arc(128,62+cy,26,0,TAU);relleno(lineal(0,40,0,90,[[0,'#d63a24'],[1,'#8c1a10']]));trazo(3.5);
      // El brazo de la espada, alzado al golpear.
      if(golpe){g.beginPath();g.moveTo(160,104);g.quadraticCurveTo(170,90,150,92);trazo(16,'#2d4aa0');}
      else{g.beginPath();g.moveTo(170,108+cy);g.quadraticCurveTo(188,130+cy,186,120+cy);trazo(14,'#2d4aa0');}
      // El escudo: redondo, azul con borde y estrella de oro (sobre la cabeza al agacharse).
      const ex=agacha?112:66,ey=agacha?54:150;g.beginPath();g.arc(ex,ey,agacha?48:38,0,TAU);relleno(radial(ex,ey,4,48,[[0,'#4a6ed0'],[1,'#1d2f73']]));trazo(4);g.lineWidth=5;g.strokeStyle=ORO;g.stroke();estrella(ex,ey,agacha?24:19);
    };
    celda(9,()=>guerrero('quieto'));celda(11,()=>guerrero('agacha'));celda(12,()=>guerrero('golpe'));
    // 10 · El tajo de la espada: una media luna de luz.
    celda(10,()=>{g.beginPath();g.arc(128,160,110,1.15*Math.PI,1.85*Math.PI);g.arc(128,190,96,1.8*Math.PI,1.2*Math.PI,true);g.closePath();relleno(lineal(20,0,236,0,[[0,'#fff1b000'],[.5,'#fffbe8'],[1,'#ffd27a00']]));});
    // 13 · Fuego del dragón: rizos de llama de manuscrito (la punta hacia abajo, hacia el guerrero).
    celda(13,()=>{for(const [x,y,r,c] of [[128,110,108,'#b8200e'],[128,120,84,'#ff6a1a'],[128,132,60,'#ffb13a'],[128,146,34,'#fff0a0']]){g.beginPath();for(let i=0;i<=24;i++){const a=i/24*TAU,rr=r*(1+.18*Math.sin(a*6));g.lineTo(x+Math.cos(a)*rr*.8,y+Math.sin(a)*rr*(a>Math.PI*.25&&a<Math.PI*.75?1.15:.9));}g.closePath();relleno(c);if(r>100)trazo(4);}});
    // 14 · Cuello: placas de oro delante, púas a los lados.
    celda(14,()=>{g.beginPath();g.moveTo(84,250);g.bezierCurveTo(90,160,96,80,100,6);g.lineTo(156,6);g.bezierCurveTo(160,80,166,160,172,250);g.closePath();relleno(lineal(80,0,176,0,[[0,MORADO_O],[.45,MORADO_C],[1,MORADO]]));trazo(4);
      for(let i=0;i<8;i++){const y=18+i*29,w=18+i*2;g.beginPath();g.moveTo(128-w,y);g.quadraticCurveTo(128,y+12,128+w,y);g.lineTo(128+w-2,y+16);g.quadraticCurveTo(128,y+28,128-w+2,y+16);g.closePath();relleno(CREMA);trazo(2);}});
    // 15 · Las marcas del zarpazo.
    celda(15,()=>{for(let i=0;i<3;i++){g.beginPath();g.moveTo(40+i*44,24);g.quadraticCurveTo(96+i*40,120,120+i*44,232);g.lineWidth=16-i*2;g.strokeStyle='#ff5a2acc';g.stroke();g.lineWidth=5;g.strokeStyle='#fff1c0';g.stroke();}});
    atlasLienzo=c;return c;
  }

  /* ---- La pose de cada instante (compartida por el pintor 3D y el 2D) -------- */
  // Devuelve las piezas del dragón en su espacio (x a la derecha, y arriba, z hacia el guerrero,
  // el origen bajo el dragón) y las del guerrero. Cada pieza: celda, centro, medio ancho/alto
  // (ancho negativo = espejo), giro y tinte.
  const R=(a,x,y)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  function rig(m,t){
    const d=m.dragon,g=m.guerrero,k=d.dur?lim((m.t-d.desde)/d.dur,0,1):0,ataque=d.ataque==='doble'?(d.fase?'garra_der':'garra_izq'):d.ataque;
    const aviso=d.estado==='aviso',golpe=d.estado==='golpe',aturdido=d.estado==='aturdido';
    const piezas=[],efectos=[];let respira=Math.sin(t*2.2)*.08,cuerpoX=0,cuerpoY=respira,cuerpoZ=0,giro=0,caida=0;
    // Brazos: ángulo del hombro y del codo (el izquierdo de la pantalla; el derecho es su espejo).
    let brazo={izq:[-.35,.9,0],der:[-.35,.9,0]},cabeza={x:0,y:7.75,z:.45,giro:0,abierta:false},alas=.12+Math.sin(t*1.4)*.06,pecho=0;
    const pose=(lado,a1,a2,z=0)=>{brazo[lado]=[a1,a2,z];};
    if(aviso||golpe){
      const e=golpe?suave(k/.35):suave(k);
      if(ataque==='garra_izq'||ataque==='garra_der'){const lado=ataque==='garra_izq'?'izq':'der',s=lado==='izq'?-1:1;
        if(aviso){pose(lado,mezcla(-.35,-2.3,e),mezcla(.9,-.6,e));cuerpoX=s*.35*e;giro=-s*.06*e;cabeza.giro=-s*.12*e;}
        else{pose(lado,mezcla(-2.3,.95,e),mezcla(-.6,.5,e),2.4*Math.sin(e*Math.PI*.9));cuerpoX=mezcla(s*.35,-s*.4,e);cuerpoZ=1*e;giro=s*.08*e;if(e>.2&&e<.95)efectos.push({celda:15,x:0,y:3,z:3,w:1.6*-s,h:1.6,giro:0,alfa:Math.sin(e*Math.PI)});}}
      else if(ataque==='aplastar'){if(aviso){pose('izq',mezcla(-.35,-2.9,e),mezcla(.9,.3,e));pose('der',mezcla(-.35,-2.9,e),mezcla(.9,.3,e));cuerpoY+=.5*e;alas+=.25*e;}
        else{pose('izq',mezcla(-2.9,-.1,e),mezcla(.3,.2,e),2.2*e);pose('der',mezcla(-2.9,-.1,e),mezcla(.3,.2,e),2.2*e);cuerpoY+=mezcla(.5,-.6,e);cuerpoZ=1.2*e;}}
      else if(ataque==='fuego'){pecho=aviso?e:1-e*.6;cabeza.abierta=true;if(aviso){cabeza.y+=.7*e;cabeza.z-=.5*e;cuerpoY+=.2*e;alas+=.18*e;}else{cabeza.y-=.7*e;cabeza.z+=1.4*e;}}
      else if(ataque==='mordisco'){cabeza.abierta=true;if(aviso){cabeza.y-=1.1*e;cabeza.z-=.4*e;}else{cabeza.y-=mezcla(1.1,3.6,e);cabeza.z+=mezcla(-.4,4.2,e);cuerpoZ=.8*e;}}
    }
    if(aturdido){const w=Math.sin(t*5)*.15;cabeza.giro=w;cabeza.x=w*1.2;cabeza.y-=.3;pose('izq',-.1,.35);pose('der',-.1,.35);alas=.02;
      for(let i=0;i<4;i++){const a=t*3+i*TAU/4;efectos.push({celda:6,x:cabeza.x+Math.cos(a)*1.6,y:cabeza.y+1.4+Math.sin(a)*.25,z:cabeza.z+Math.sin(a)*.8,w:.28,h:.28,giro:t*2,alfa:1});}}
    if(d.estado==='recupera'){const e=1-suave(k);cuerpoZ=.4*e;}
    if(d.estado==='derribado'){caida=suave(k/.4);}else if(d.estado==='levanta')caida=1-suave(k);
    const dolor=d.dolor>0?d.dolor/.3:0;cuerpoX+=Math.sin(t*70)*.12*dolor;
    // Derribado: el dragón se hunde de espaldas y queda tendido.
    cuerpoY-=caida*4.8;giro+=caida*.22;cuerpoZ-=caida*1.5;
    const tinte=[Math.min(.5,dolor*.45+(m.fogonazo>0?.1:0)),dolor*.25,caida*.25,1];
    const P=(x,y)=>{const [a,b]=R(giro,x,y-2);return [a+cuerpoX,b+2+cuerpoY];};
    const pieza=(celda,x,y,z,w,h,rot=0,tin=tinte)=>{const [px,py]=P(x,y);piezas.push({celda,x:px,y:py,z:z+cuerpoZ,w,h,giro:rot+giro,tinte:tin});};
    // Alas (detrás), halo, patas y cola, torso, cuello, cabeza, brazos (delante).
    for(const l of [-1,1]){const a=-l*alas,raiz=[l*1.15,6.1],[cx,cy]=R(a,l*3.1,2.9);pieza(5,raiz[0]+cx,raiz[1]+cy,-1.2,-l*3.2,3.1,a);}
    pieza(8,cabeza.x,cabeza.y+.55,cabeza.z-1.6,3.3,3.3,t*.05,[tinte[0],0,tinte[2],1]);
    pieza(7,0,1.7,-.3,2.5,2.4);pieza(0,0,4.3,0,2,2.5);
    const base=[0,6.2],cab=[cabeza.x,cabeza.y-1.1],dx=cab[0]-base[0],dy=cab[1]-base[1],largo=Math.hypot(dx,dy);
    pieza(14,(base[0]+cab[0])/2,(base[1]+cab[1])/2,.15+cabeza.z*.4,.95,largo/2+.35,Math.atan2(dx,dy)*-1);
    pieza(cabeza.abierta?2:1,cabeza.x,cabeza.y,cabeza.z,2.05,2.05,cabeza.giro);
    for(const lado of ['izq','der']){const l=lado==='izq'?-1:1,[a1,a2,z]=brazo[lado],hombro=[l*1.4,5.75];
      const A=-l*a1,B=-l*(a1+a2),[ux,uy]=R(A,0,-1),codo=[hombro[0]+1.85*ux,hombro[1]+1.85*uy],[fx,fy]=R(B,0,-1.3);
      pieza(3,hombro[0]+ux,hombro[1]+uy,.55+z*.5,.78*-l,1.08,A);pieza(4,codo[0]+fx,codo[1]+fy,.75+z,.9*-l,1.42,B);}
    if(pecho>0)efectos.push({celda:-1,brasa:true,x:P(0,5)[0],y:P(0,5)[1],z:.3+cuerpoZ,w:1.3*pecho,h:1.3*pecho,alfa:pecho});
    // El guerrero: esquiva a los lados, agachado o golpeando (alterna el brazo).
    const eg=g.accion==='quieto'?0:suave(Math.min(1,(m.t-g.desde)/.08))*(g.accion==='golpe'?1:1-suave((m.t-g.desde-ESQ+.1)/.2));
    let gx=0,gy=0,gz=0,gr=0,gc=9,gw=1;
    if(g.accion==='izq'){gx=-1.5*eg;gr=.22*eg;}else if(g.accion==='der'){gx=1.5*eg;gr=-.22*eg;}else if(g.accion==='agacha'){gc=eg>.3?11:9;gy=-.35*eg;}
    else if(g.accion==='golpe'){gc=12;gw=g.lado;gz=-.5*eg;gx=g.lado*.15;}
    const herido=m.invulnerable>0&&Math.floor(m.invulnerable*14)%2;
    const guerrero={celda:gc,x:gx,y:1.25+gy+Math.sin(t*3)*.03,z:gz,w:.78*gw,h:1.25,giro:gr,tinte:[0,herido?.6:0,0,herido?.55:1]};
    if(g.accion==='golpe'&&m.t-g.desde<.2)efectos.push({celda:10,x:gx*.5,y:3.2,z:-1,w:1.3*g.lado,h:1,giro:-g.lado*.3,alfa:1-(m.t-g.desde)/.2,delGuerrero:true});
    return {piezas,efectos,guerrero,cabeza:{x:P(cabeza.x,cabeza.y)[0],y:P(cabeza.x,cabeza.y)[1],z:cabeza.z+cuerpoZ,abierta:cabeza.abierta},fuego:ataque==='fuego'&&golpe?1-k:0,caida};
  }

  /* ---- Pintor clásico (sin WebGL o con movimiento reducido) ------------------ */
  function pintar(s,c){
    const w=s.ancho,h=s.alto,m=s.modelo,t=m.t,A=atlas(),r=rig(m,t);
    let q=c.createLinearGradient(0,0,0,h);q.addColorStop(0,'#15245e');q.addColorStop(.62,'#2d4a9a');q.addColorStop(.63,'#e9dcb6');q.addColorStop(.7,'#4b7a4a');q.addColorStop(1,'#2a4a2c');c.fillStyle=q;c.fillRect(0,0,w,h);
    for(let i=0;i<40;i++){const x=(Math.sin(i*57.31)*.5+.5)*w,y=(Math.cos(i*17.13)*.5+.5)*h*.55;c.fillStyle='#f0c860';c.globalAlpha=.6;c.fillRect(x-1.5,y-1.5,3,3);}c.globalAlpha=1;
    const esc=Math.min(w/15,h/12.5),suelo=h*.9,cx=w/2;
    // El dragón, lejos (más pequeño) y el guerrero delante, grande y abajo.
    const dibujar=(p,e,base,ox)=>{if(!A)return;const x=ox+p.x*e,y=base-p.y*e,sx=p.w*e,sy=p.h*e;c.save();c.translate(x,y);c.rotate(-p.giro);c.scale(Math.sign(sx)||1,1);c.globalAlpha=p.tinte?p.tinte[3]:p.alfa??1;
      if(p.celda>=0)c.drawImage(A,(p.celda%4)*256+4,Math.floor(p.celda/4)*256+4,248,248,-Math.abs(sx),-sy,Math.abs(sx)*2,sy*2);c.restore();
      if(p.tinte&&p.tinte[0]>0){c.save();c.globalAlpha=p.tinte[0]*.5;c.globalCompositeOperation='lighter';c.fillStyle='#fff';c.beginPath();c.arc(x,y,Math.abs(sx)*.7,0,TAU);c.fill();c.restore();}};
    const ed=esc*.62,baseD=suelo-h*.12;
    for(const p of [...r.piezas].sort((a,b)=>a.z-b.z))dibujar(p,ed,baseD,cx);
    for(const f of r.efectos)if(f.celda>=0&&!f.delGuerrero)dibujar({...f,tinte:null},ed,baseD,cx);
    if(r.fuego>0){c.save();c.globalAlpha=r.fuego;const fx=cx+r.cabeza.x*ed,fy=baseD-r.cabeza.y*ed;for(let i=0;i<5;i++){const k=i/4,x=fx,y=fy+(suelo-h*.35-fy)*k,s2=ed*(1+k*2.4);c.drawImage(A,1*256+4,3*256+4,248,248,x-s2,y-s2,s2*2,s2*2);}c.restore();}
    const g=r.guerrero;dibujar(g,esc*1.5,suelo,cx);for(const f of r.efectos)if(f.delGuerrero)dibujar({...f,tinte:null},esc,suelo,cx);
    barra(c,m,w,h);letrero(c,m,w,h*.36);
  }
  // La vida del dragón (arriba) y los derribos: como el marcador de Punch-Out.
  function barra(c,m,w,h){
    const d=m.dragon,an=Math.min(260,w*.5),x=(w-an)/2,y=Math.max(10,h*.03),alto=Math.max(8,Math.min(12,w*.02));
    c.save();c.fillStyle='#1a0f0acc';c.fillRect(x-3,y-3,an+6,alto+6);c.fillStyle='#3d2466';c.fillRect(x,y,an,alto);
    const q=c.createLinearGradient(x,0,x+an,0);q.addColorStop(0,'#b995e2');q.addColorStop(1,'#7a4fb0');c.fillStyle=q;c.fillRect(x,y,an*lim(d.hp/d.hpMax,0,1),alto);
    c.strokeStyle='#e9b949';c.lineWidth=2;c.strokeRect(x-3,y-3,an+6,alto+6);c.font=`700 ${Math.max(9,alto)}px Georgia,serif`;c.textAlign='left';c.fillStyle='#fff1c0';c.fillText('DRAGÓN CELESTIAL',x,y+alto+alto*1.3);
    c.textAlign='right';c.fillText('★'.repeat(m.derribos),x+an,y+alto+alto*1.3);c.restore();
  }
  function letrero(c,m,w,y){
    if(m.juicio<=0)return;const a=lim(m.juicio*2.5,0,1),tam=Math.max(18,Math.min(40,w*.06)),texto=m.juicioTexto;
    c.save();c.globalAlpha=a;c.font=`700 ${tam}px Georgia,serif`;c.textAlign='center';c.lineWidth=6;c.strokeStyle='#1a0f0a';const yy=y-(1-a)*14;c.strokeText(texto,w/2,yy);
    c.fillStyle=texto==='BLOQUEA'?'#c8c0d8':texto.startsWith('¡GOLPE')||texto.startsWith('¡QUEMADO')?'#ff8a6a':'#fff1c0';c.fillText(texto,w/2,yy);c.restore();
  }
  API.pintores=Object.assign(API.pintores||{},{orbital:pintar});
  global.CAOZ_DRAGON=Object.freeze({atlas,rig,barra,letrero,ATAQUES,ESQ,VIDA});
})(typeof window!=='undefined'?window:globalThis);

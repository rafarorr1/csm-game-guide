/* El corte final en 3D: la prueba II dentro de su carta dorada, sobre el motor
   común (pitagoras-mundo-3d.js). La arena es la nave de la catedral del arte:
   losas pulidas de lapislázuli y pizarra con franjas bermellón y juntas de
   oro, columnas verdes con capiteles dorados y, al fondo, el espectro
   coronado de la carta. Cada rayo avisa como en el juego (la franja se tiñe y
   late, con sus dos bordes exactos) y después corta: un haz de luz blanca y
   dorada con llamas de oro que nace de las manos del espectro, ilumina la
   nave y deja el suelo quemado. El impulso del héroe deja una estela.
   Sólo presentación: lee s.modelo y nunca lo escribe. */
'use strict';
(function(global){
  const W3=global.CAOZ_MUNDO_3D;if(!W3)return;
  const {lim,TAU}=W3,MARCO=7,MAXR=8;
  const FONDO=`vec3 fondo(vec3 d){
  vec3 c=mix(vec3(.06,.07,.16),vec3(.02,.025,.07),clamp(d.y*2.+.5,0.,1.));
  vec2 q=vec2(atan(d.x,-d.z),d.y)*18.;vec2 id=floor(q),f=fract(q)-.5;float r=h21(id);vec2 o=(h22(id)-.5)*.5;
  c+=vec3(1.,.82,.4)*step(.9,r)*smoothstep(.1,0.,length(f-o))*.7;
  return c;
}`;
  const SUELO=`uniform vec4 uRayo[${MAXR}];uniform vec4 uRayoB[${MAXR}];uniform float uNRayos;
const float MARCO=${MARCO.toFixed(1)};
void main(){
  vec2 p=vP.xz;float ax=max(abs(p.x),abs(p.y));
  // Al norte la nave termina tras las columnas: de la oscuridad se alza el espectro.
  if(p.y<-MARCO-3.)discard;
  // Losas de la catedral: lapislázuli y pizarra, alguna bermellón, con veta de mármol.
  vec2 g=p/1.4,id=floor(g),f=fract(g);float junta=min(min(f.x,1.-f.x),min(f.y,1.-f.y));
  // Sin franjas: en esta prueba una línea en el suelo sólo puede ser un rayo.
  float par=mod(id.x+id.y,2.),franja=step(.88,h21(id+17.));
  vec3 base=par>.5?vec3(.16,.25,.54):vec3(.16,.17,.25);
  base=mix(base,vec3(.5,.13,.1),franja*.75);
  base*=(.82+.32*fbm(p*2.3+id*3.))*(.9+.2*h21(id));
  vec3 N=normalize(vec3(fbm(p*5.)-.5,8.,fbm(p*5.+4.)-.5)),V=normalize(uCam-vP);
  vec3 c=base*vec3(.38,.42,.6)+base*vec3(1.,.82,.5)*.5*max(dot(N,normalize(CLAVE)),0.)+base*puntuales(vP,N);
  // El pulido: cada luz se refleja en las losas.
  for(int i=0;i<${12};i++){if(float(i)>=uNL)break;vec3 L=uLP[i].xyz-vP;float d=length(L);L/=d;float k=clamp(1.-d/(uLP[i].w*1.8),0.,1.);
    c+=uLC[i].rgb*pow(max(dot(N,normalize(L+V)),0.),70.)*k*1.1;}
  c=mix(c,vec3(.9,.68,.32)*(.55+.45*clamp(puntuales(vP,N).r,0.,1.)),(1.-smoothstep(0.,.03,junta))*.9);
  // Fuera del marco el suelo sigue, en penumbra; el marco es de oro.
  c*=1.-.5*smoothstep(MARCO,MARCO+.3,ax);
  c=mix(c,vec3(1.,.78,.36),1.-smoothstep(0.,.07,abs(ax-(MARCO+.12))));
  // Rayos: el aviso (franja ámbar que late, bordes y trazo que corre) y el corte (quemadura blanca y dorada).
  for(int i=0;i<${MAXR};i++){if(float(i)>=uNRayos)break;vec4 r=uRayo[i],b=uRayoB[i];
    float d=abs(dot(p,r.xy)-r.z),w=b.x,largo=dot(p,vec2(-r.y,r.x));
    if(r.w<.5){float z=b.y,franjaR=1.-smoothstep(w-.03,w+.03,d),borde=1.-smoothstep(0.,.05,abs(d-w));
      float guion=step(.5,fract(largo*1.4-uT*3.))*(1.-smoothstep(0.,.045,d)),pul=.8+.2*sin(uT*16.);
      c=mix(c,c*vec3(1.,.72,.45)+vec3(.9,.45,.12)*(.1+.3*z),franjaR*.75);c+=vec3(1.,.6,.25)*borde*(.35+.65*z)+vec3(1.,.86,.55)*guion*(.4+.55*z)*pul;}
    else{float a=b.z;c=mix(c,c*.45+vec3(.3,.1,.03),(1.-smoothstep(w*.4,w*1.15,d))*b.w);
      c+=vec3(1.,.96,.84)*exp(-d*d/(w*w)*2.5)*a*1.6+vec3(1.,.66,.28)*exp(-d/w*1.1)*a*.7;}
  }
  c=mix(c,vec3(.04,.05,.11),smoothstep(MARCO+1.,MARCO+5.5,ax));
  gl_FragColor=vec4(c,1.);
}`;
  // Estado de cada rayo para el dibujo: aviso (0–1), corte (intensidad) y quemadura.
  function estados(m){
    const out=[];
    for(const r of m.rayos){if(r.edad<0)continue;const e=r.edad;
      if(e<r.aviso)out.push({r,fase:0,z:lim(e/r.aviso,0,1),a:0,q:0});
      else{const k=e<r.aviso+r.activo?1:lim(1-(e-r.aviso-r.activo)/.25,0,1);out.push({r,fase:1,z:1,a:k,q:1});}}
    return out.slice(-MAXR);
  }
  // Dónde toca cada rayo el marco: ahí están las manos del espectro.
  function extremos(r){
    const tx=-r.ny,ty=r.nx,cx=r.nx*r.offset,cy=r.ny*r.offset,R=MARCO+.35;let a=-1e9,b=1e9;
    for(const [c,t] of [[cx,tx],[cy,ty]]){if(Math.abs(t)<1e-6){if(Math.abs(c)>R)return [];continue;}const s1=(-R-c)/t,s2=(R-c)/t;a=Math.max(a,Math.min(s1,s2));b=Math.min(b,Math.max(s1,s2));}
    return a>b?[]:[[cx+tx*a,cy+ty*a],[cx+tx*b,cy+ty*b]];
  }
  const COLUMNAS=[];for(const x of [-8.9,-5.2,5.2,8.9])COLUMNAS.push([x,-8.9]);for(const z of [-5.2,-1.6,2])for(const x of [-8.9,8.9])COLUMNAS.push([x,z]);
  global.CAOZ_CORTE_3D=W3.registrar('laseres',{
    nombre:'El corte final',arte:W3.arte('editorcorte-dorado-v1.webp',document.currentScript),
    apagado:()=>!!global.CAOZ_CORTE_3D_APAGADA,
    presion:m=>lim(m.t/m.duracion,0,1),fondo:FONDO,
    // El espectro coronado, entre los arcos de la catedral, tras la arena.
    telon:presion=>{const ancho=22,corte=.6,alto=ancho*768/512*corte;return {ancho,corte,centro:[1.2,-alto*.5+3.2+presion*1.2,-MARCO-5.5]};},
    camara:{fov:38,pitch:37,
      objetivo:(p,asp)=>{const ancha=lim((asp-.9)/.8,0,1);return [p.x*.3,0,p.y*(p.y>0?.72:.3)-.4-2.2*ancha];},
      distancia:(tan,asp,pitch)=>Math.max(6.9/(tan*asp),6.9*Math.sin(pitch)/tan+3.2)},
    suelo:{tam:MARCO+6,glsl:SUELO,subir(gl,u,s){
      const E=estados(s.modelo),a=new Float32Array(MAXR*4),b=new Float32Array(MAXR*4);
      E.forEach((q,i)=>{a.set([q.r.nx,q.r.ny,q.r.offset,q.fase],i*4);b.set([q.r.ancho,q.z,q.a,q.q],i*4);});
      gl.uniform4fv(u.uRayo,a);gl.uniform4fv(u.uRayoB,b);gl.uniform1f(u.uNRayos,E.length);}},
    // El halo del héroe (siempre la primera), la luz de cada corte a lo largo del haz y el ámbar de los avisos.
    luces(s,t,poner){
      const m=s.modelo,p=m.jugador;poner(p.x,1.1,p.y,3.4,[1,.78,.4],.95+.1*Math.sin(t*3));
      const E=estados(m);
      for(const q of E)if(q.fase===1&&q.a>0){const r=q.r,tx=-r.ny,ty=r.nx;for(const k of [0,-4.5,4.5])poner(r.nx*r.offset+tx*k,.9,r.ny*r.offset+ty*k,4.2,[1,.88,.62],1.7*q.a);}
      for(const q of E)if(q.fase===0)for(const [x,y] of extremos(q.r))poner(x,.8,y,2.4,[1,.55,.2],.5+q.z*.9);
    },
    // Columnas verdes con basa y capitel de oro alrededor de la nave (no en el lado de la cámara).
    cajas(s,cara,caja){
      const verde=[.2,.46,.38],oro=[.85,.64,.28],alto=5.2;
      for(const [x,z] of COLUMNAS){
        const R=.55,n=8;for(let i=0;i<n;i++){const a0=i*TAU/n,a1=(i+1)*TAU/n,am=(a0+a1)/2,P=(a,y)=>[x+Math.cos(a)*R,y,z+Math.sin(a)*R];
          cara(P(a0,0),P(a1,0),P(a1,alto),P(a0,alto),[Math.cos(am),0,Math.sin(am)],verde);}
        caja(x,.2,z,1.5,.4,1.5,0,0,oro);caja(x,alto-.1,z,1.6,.5,1.6,0,0,oro);caja(x,alto+.4,z,1.2,.6,1.2,0,0,[.2,.2,.3]);
      }
    },
    figuras(h){
      const {m,t,p,fig,de_pie,planas}=h,E=estados(m);
      // La estela del impulso: el héroe se repite hacia atrás, en oro.
      if(m.impulso>0){const u=m.ultimoMovimiento||{x:0,y:-1},l=Math.hypot(u.x,u.y)||1;
        for(let i=1;i<=3;i++)fig(de_pie,p.x-u.x/l*i*.42,0,p.y-u.y/l*i*.42,1.04,2.05,[1,1,1,.32-i*.08],1,0,1,h.ladoHeroe);
        fig(planas,p.x-u.x/l*.7,0,p.y-u.y/l*.7,.9,.2,[1,.85,.45,.8],8,0,0,Math.atan2(u.y,u.x));}
      h.heroe({mira:false});
      for(const q of E){const r=q.r,ang=Math.atan2(r.nx,-r.ny),cx=r.nx*r.offset,cy=r.ny*r.offset,fin=extremos(r);
        // Las manos del espectro en los extremos: brillan al avisar y estallan al cortar.
        for(const [x,y] of fin){const lado=x*h.cam.der[0]+y*h.cam.der[2]>0?-1:1;
          fig(de_pie,x,.1,y,1.,2.,[q.fase?1:0,1,0,0],0,(r.id*.21)%1,1,lado);
          fig(de_pie,x,1.2,y,q.fase?1.8*q.a:.6+q.z*.8,q.fase?1.8*q.a:.6+q.z*.8,q.fase?[1,.95,.8,q.a]:[1,.6,.25,.5+q.z*.5],2);}
        if(q.fase===1&&q.a>0){
          // El haz: una cortina de luz a lo largo del rayo, con chispas que corren por él.
          fig(de_pie,cx,.05,cy,MARCO+1.5,1.5,[1,1,1,q.a],9,(r.id*.37)%1,0,ang);
          for(let i=0;i<10;i++){const k=((i/10+t*.9)%1)*2-1,tx=-r.ny,ty=r.nx;fig(de_pie,cx+tx*k*MARCO,.75+Math.sin(i*3.1+t*9)*.25,cy+ty*k*MARCO,.22,.22,[1,.9,.6,q.a],2);}}}
      h.chispas();
      // Polvo de oro en la luz de la nave.
      for(let i=0;i<40;i++){const f=(t*.04+i*.618)%1,x=Math.sin(i*12.9)*MARCO,z=Math.cos(i*7.3)*MARCO;fig(de_pie,x+Math.sin(t*.3+i)*.4,.3+f*4,z,.06,.06,[1,.85,.5,Math.sin(f*Math.PI)*.55],2);}
    },
  });
})(typeof window!=='undefined'?window:globalThis);

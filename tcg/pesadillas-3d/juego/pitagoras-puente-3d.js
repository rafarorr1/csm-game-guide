/* El último puente en 3D: la prueba IV (tres carriles) dentro de su carta
   dorada, sobre el motor común (pitagoras-mundo-3d.js). Una cámara detrás del
   héroe mira el puente del arte: tres carriles de colores (lapislázuli con
   estrellas, bermellón y verde con flores de oro) entre bordillos de piedra,
   parapetos y pilares con braseros, y al fondo
   la torre con su halo (el propio arte de la carta). Las columnas son bloques
   de piedra tallada; los sellos, la barrera de ondas de oro que hay que
   saltar. El puente avanza con la velocidad real del modelo y, a los lados,
   el mundo se desmorona en bloques que caen al vacío.
   Sólo presentación: lee s.modelo y nunca lo escribe. */
'use strict';
(function(global){
  const W3=global.CAOZ_MUNDO_3D;if(!W3)return;
  const {lim,TAU}=W3,BORDE=1.72,MAXS=6;
  const FONDO=`vec3 fondo(vec3 d){
  if(d.y<0.){
    // El vacío bajo el puente: acantilados de oro y verde que se pierden en la bruma.
    float k=clamp(-d.y*2.2,0.,1.),a=atan(d.x,-d.z);float veta=fbm(vec2(a*6.,d.y*14.+uT*.02));
    vec3 c=mix(vec3(.55,.42,.15),vec3(.12,.3,.25),smoothstep(.3,.7,veta));c*=.5+.5*fbm(vec2(a*20.,d.y*40.));
    return mix(c*.8,vec3(.03,.04,.1),k*.85);}
  vec3 c=mix(vec3(.1,.16,.42),vec3(.03,.05,.18),clamp(d.y*2.,0.,1.));
  vec2 q=vec2(atan(d.x,-d.z),d.y)*16.;vec2 id=floor(q),f=fract(q)-.5;float r=h21(id);vec2 o=(h22(id)-.5)*.5;
  c+=vec3(1.,.82,.4)*step(.88,r)*(smoothstep(.12,0.,length(f-o))+smoothstep(.02,0.,abs((f-o).x))*smoothstep(.3,0.,abs((f-o).y))+smoothstep(.02,0.,abs((f-o).y))*smoothstep(.3,0.,abs((f-o).x)))*.8;
  return c;
}`;
  const SUELO=`uniform float uDist,uSellos[${MAXS}];uniform float uNSellos;
void main(){
  vec2 p=vP.xz;float ax=abs(p.x);if(ax>1.95)discard;
  float q=p.y-uDist;// coordenada a lo largo del puente, fija sobre la piedra
  vec3 N=vec3(0.,1.,0.);vec3 base;
  if(ax>1.5){
    // Losas de piedra en los bordes del puente.
    vec2 g=vec2(ax*3.,q*1.6);vec2 id=floor(g+vec2(0.,step(1.,mod(floor(g.x),2.))*.5));vec2 f=fract(g+vec2(0.,step(1.,mod(floor(g.x),2.))*.5));
    base=vec3(.66,.63,.56)*(.8+.3*h21(id))*(.85+.2*fbm(p*4.));base=mix(base,vec3(.2,.19,.17),1.-smoothstep(0.,.06,min(min(f.x,1.-f.x),min(f.y,1.-f.y))));
  }else{
    float carril=floor(p.x+.5);vec2 f=vec2(p.x-carril,fract(q/1.6)-.5);
    base=carril<-.5?vec3(.13,.2,.5):carril>.5?vec3(.13,.36,.26):vec3(.55,.12,.09);base*=.82+.3*fbm(vec2(p.x*4.,q*3.));
    // Estrellas de oro (flores en el carril verde), como en el arte.
    float a=atan(f.y,f.x),r=length(f*vec2(1.,1.1));
    float estrella=carril>.5?1.-smoothstep(0.,.02,r-.1-.07*pow(abs(cos(a*2.)),2.)):1.-smoothstep(0.,.02,r-.05-.14*pow(abs(cos(a*4.)),12.));
    base=mix(base,vec3(1.,.78,.35),estrella*.9);
    // Bordillos de piedra entre carriles.
    float bord=1.-smoothstep(.05,.09,abs(abs(p.x)-.5));base=mix(base,vec3(.7,.66,.58)*(.85+.2*fbm(vec2(p.x*9.,q*6.))),bord);
    base=mix(base,vec3(1.,.76,.32),(1.-smoothstep(.0,.025,abs(ax-1.47)))*.9);
  }
  vec3 c=base*vec3(.42,.46,.62)+base*vec3(1.,.82,.5)*.45*max(dot(N,normalize(CLAVE)),0.)+base*puntuales(vP,N);
  // Los sellos brillan en la piedra antes de llegar.
  for(int i=0;i<${MAXS};i++){if(float(i)>=uNSellos)break;float d=abs(p.y-uSellos[i]);c+=vec3(1.,.72,.3)*exp(-d*d*6.)*.5+vec3(1.,.9,.6)*(1.-smoothstep(.0,.06,d))*.6;}
  c=mix(c,vec3(.08,.12,.3),smoothstep(-25.,-60.,p.y));
  gl_FragColor=vec4(c,1.);
}`;
  const z=o=>-o.z;// del modelo (distancia por delante) al mundo (hacia el fondo, −z)
  global.CAOZ_PUENTE_3D=W3.registrar('carrera',{
    nombre:'El último puente',arte:W3.arte('editorcarrera-dorado-v1.webp',document.currentScript),
    apagado:()=>!!global.CAOZ_PUENTE_3D_APAGADA,
    presion:m=>lim(m.t/m.duracion,0,1),fondo:FONDO,
    // La torre con su halo y las cabezas de dragón, al final del puente.
    telon:presion=>{const ancho=34,corte=.5,alto=ancho*768/512*corte;return {ancho,corte,centro:[0,alto*.5-6+presion*2,-58]};},
    camara:{personalizada(s,w,h){
      const m=s.modelo,x=m.carrilVisual||0,asp=w/h,fov=Math.max(50,2*Math.atan(.43/asp)*180/Math.PI);
      return {ojo:[x*.35,3.1,5.4],mira:[x*.5,.55,-8],fov,cerca:.1,lejos:160};}},
    suelo:{tam:70,glsl:SUELO,subir(gl,u,s){
      const m=s.modelo,z0=m.obstaculos.filter(o=>o.tipo==='sello'&&o.z>-2).slice(0,MAXS).map(z);
      gl.uniform1f(u.uDist,m.distancia%3200);gl.uniform1fv(u.uSellos,new Float32Array([...z0,...Array(MAXS-z0.length).fill(0)]));gl.uniform1f(u.uNSellos,z0.length);}},
    // La luz del héroe (siempre la primera), la de los sellos que llegan y los braseros cercanos.
    luces(s,t,poner){
      const m=s.modelo,x=m.carrilVisual||0;poner(x,1.2+(m.salto||0),0,3.4,[1,.8,.45],.95);
      for(const o of m.obstaculos)if(o.tipo==='sello'&&o.z>-1&&o.z<18)poner(0,.6,z(o),3.2,[1,.75,.35],1.1);
      // Las columnas que se acercan, iluminadas por delante para que se lean contra el fondo.
      m.obstaculos.filter(o=>o.tipo==='columna'&&o.z>0&&o.z<16).slice(0,2).forEach(o=>poner(o.carril,1.6,z(o)+1.3,2.6,[1,.78,.5],.9));
      const fase=(m.distancia||0)%7;for(let i=0;i<4;i++){const zz=-i*7+fase-1;if(zz>.3)continue;for(const lado of [-1,1])poner(lado*1.85,1.8,zz,3.4,[1,.6,.25],.8+.1*Math.sin(t*9+i+lado));}
    },
    cajas(s,cara,caja){
      const m=s.modelo,piedra=[.62,.58,.5],oscura=[.36,.34,.3],oro=[.85,.64,.28],d=m.distancia||0,t=m.t;
      // Parapetos por tramos y pilares con brasero cada 7 unidades: avanzan con el puente.
      const tramo=d%2;for(let k=-3;k<32;k++){const zz=-k*2+tramo;for(const lado of [-1,1])caja(lado*1.86,.3,zz,.26,.6,1.9,0,0,piedra,oscura);}
      const fase=d%7;for(let i=0;i<9;i++){const zz=-i*7+fase-1;if(zz>.3)continue;for(const lado of [-1,1]){caja(lado*1.9,1.05,zz,.5,2.1,.5,0,0,piedra,oscura);caja(lado*1.9,2.15,zz,.62,.14,.62,0,0,oro);}}
      // Las columnas del Editor: bloques tallados con un anillo de oro.
      for(const o of m.obstaculos)if(o.tipo==='columna'&&o.z>-.8&&o.z<40){const zz=z(o);caja(o.carril,1.15,zz,.78,2.3,.78,.15*Math.sin(o.id),0,[.95,.88,.74],[.78,.7,.58]);caja(o.carril,1.6,zz,.86,.12,.86,0,0,oro);caja(o.carril,2.4,zz,.9,.2,.9,0,0,piedra);}
      // Detrás, el mundo se derrumba: bloques que se desprenden y caen al vacío.
      for(let i=0;i<10;i++){const f=(t*.55+i*.137)%1,lado=i%2?1:-1;caja(lado*(2.4+(i%3)*.5),-.1-f*f*9,-4-(i%5)*4.5,.5,.4,.5,f*3+i,f*2,piedra,oscura);}
    },
    figuras(h){
      const {m,t,fig,de_pie,planas}=h,x=m.carrilVisual||0,salto=m.salto||0;
      h.heroe({mira:false,x,z:0,y:salto,lado:1});
      for(const o of m.obstaculos){if(o.z<(o.tipo==='columna'?-.8:-3)||o.z>40)continue;const zz=z(o);
        if(o.tipo==='columna')fig(planas,o.carril,0,zz,.7,.5,[0,0,0,.6],6);
        else{
          // El sello: una barrera de ondas de oro de lado a lado, con estrellas en los extremos.
          fig(de_pie,0,.02,zz,BORDE,1.15,[1,1,1,.95],9,(o.id*.31)%1,0,0);
          for(const lado of [-1,1])fig(de_pie,lado*1.55,.8,zz,.5,.5,[1,.88,.55,.9],2);}}
      // Chispas de oro cuando un obstáculo queda atrás (el modelo las cuenta como superadas).
      h.chispas();
      // Estelas de velocidad a los lados, más intensas cuanto más corre el puente.
      const prisa=lim(m.t/m.duracion,0,1);for(let i=0;i<22;i++){const f=(t*(1.2+prisa*2)+i*.618)%1,lado=i%2?1:-1;fig(de_pie,lado*(1.3+(i%4)*.2),.3+(i%5)*.4,-14+f*18,.04,.04+prisa*.2,[1,.85,.55,(.25+prisa*.4)*Math.sin(f*Math.PI)],2);}
      // Llamas de los braseros.
      const fase=(m.distancia||0)%7;for(let i=0;i<9;i++){const zz=-i*7+fase-1;if(zz>.3)continue;for(const lado of [-1,1]){fig(de_pie,lado*1.9,2.2,zz,.18,.42,[1,1,1,.9],4,i+lado);fig(de_pie,lado*1.9,2.45,zz,.6,.6,[1,.6,.25,.4],2);}}
    },
  });
})(typeof window!=='undefined'?window:globalThis);

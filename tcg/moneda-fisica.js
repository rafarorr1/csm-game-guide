/* Moneda física del Domo. Cilindro fino de masa unitaria: gravedad, tensor de
   inercia de disco, momento angular, contactos por impulsos y rozamiento.
   La semilla sólo determina el lanzamiento. Cara/cruz se lee de la orientación
   del sólido después de reposar; no se elige ni se acomoda un resultado.
   Convenciones: Y arriba, suelo y=0, q=[x,y,z,w], cara=+Y local, cruz=-Y local.
   La primera sección es pura y puede ejecutarse sin navegador. */
'use strict';
(function(global){
  const R=.55,H=.0325,N=20,DT=1/240,MAX_PASOS=4800;
  const IAXIAL=.5*R*R,ITRANSVERSAL=(3*R*R+4*H*H)/12;
  const INV_T=1/ITRANSVERSAL,DIF_I=1/IAXIAL-INV_T;
  const suma=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],resta=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const por=(a,k)=>a.length===4?[a[0]*k,a[1]*k,a[2]*k,a[3]*k]:[a[0]*k,a[1]*k,a[2]*k];
  const punto=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const largo=a=>Math.hypot(...a),unidad=a=>por(a,1/(largo(a)||1));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const vertices=[];
  for(const y of [-H,H])for(let i=0;i<N;i++){const a=i*2*Math.PI/N;vertices.push([R*Math.cos(a),y,R*Math.sin(a)]);}
  function girar(v,q){
    const [x,y,z,w]=q,[a,b,c]=v,tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);
    return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx];
  }
  function orientar(q,w,dt){
    const [x,y,z,s]=q,[a,b,c]=w,h=dt/2;
    return unidad([x+h*(a*s+b*z-c*y),y+h*(-a*z+b*s+c*x),z+h*(a*y-b*x+c*s),s-h*(a*x+b*y+c*z)]);
  }
  function azar(semilla){let x=semilla>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function impulsoValido(p){return {x:clamp(Number.isFinite(p?.x)?p.x:0,-1,1),z:clamp(Number.isFinite(p?.z)?p.z:-.6,-1,1),fuerza:clamp(Number.isFinite(p?.fuerza)?p.fuerza:.6,.15,1)};}
  const vectorValido=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
  function leer(q){
    if(!vectorValido(q,4)||largo(q)<1e-8)return null;
    const normal=girar([0,1,0],unidad(q));
    return {valor:normal[1]>=0?0:1,alineacion:Math.abs(normal[1]),normal};
  }
  function simular(semilla,entrada){
    const rng=azar(semilla),impulso=impulsoValido(entrada),u=rng(),a=rng()*2*Math.PI,b=rng()*2*Math.PI;
    // Orientación inicial continua y uniforme, sin escoger una cara discreta.
    let q=[Math.sqrt(1-u)*Math.sin(a),Math.sqrt(1-u)*Math.cos(a),Math.sqrt(u)*Math.sin(b),Math.sqrt(u)*Math.cos(b)];
    let p=[(rng()-.5)*.8,1.3+rng()*.35,.55];
    let vel=[impulso.x*2+(rng()-.5)*.55,1.3+impulso.fuerza*2.6,impulso.z*1.8-.2];
    const eje=rng()*Math.PI*2,giro=16+impulso.fuerza*9+rng()*8;
    let omega=[Math.cos(eje)*giro,(rng()-.5)*7,Math.sin(eje)*giro],normal=girar([0,1,0],q);
    // Mantener L, no sólo omega, conserva la precesión del disco en vuelo.
    let momento=suma(por(omega,ITRANSVERSAL),por(normal,(IAXIAL-ITRANSVERSAL)*punto(normal,omega)));
    let estable=0,asentado=false,impactos=0,pasos=0;
    const frames=[{p:p.slice(),q:q.slice(),t:0}];
    const inversa=v=>{const d=DIF_I*punto(normal,v);return [v[0]*INV_T+normal[0]*d,v[1]*INV_T+normal[1]*d,v[2]*INV_T+normal[2]*d];};
    const aplicar=(j,r)=>{const torque=cruz(r,j),cambio=inversa(torque);for(let i=0;i<3;i++){vel[i]+=j[i];momento[i]+=torque[i];omega[i]+=cambio[i];}};
    for(;pasos<MAX_PASOS;){
      pasos++;
      vel[1]-=9.81*DT;vel=por(vel,Math.exp(-.045*DT));momento=por(momento,Math.exp(-.035*DT));
      normal=girar([0,1,0],q);omega=inversa(momento);
      p=suma(p,por(vel,DT));q=orientar(q,omega,DT);normal=girar([0,1,0],q);omega=inversa(momento);
      const radios=vertices.map(v=>girar(v,q)),contactos=[];
      let penetracion=0,huboImpacto=false;
      for(const r of radios){
        const distancia=p[1]+r[1];if(distancia>.001)continue;
        const vn=vel[1]+cruz(omega,r)[1],rebote=vn<-.65?-.28*vn:0;
        if(vn<-.8)huboImpacto=true;
        contactos.push({r,objetivo:rebote,normal:0,t:[0,0,0]});
        penetracion=Math.max(penetracion,-distancia);
      }
      if(huboImpacto)impactos++;
      // Corregir sólo penetración en posición: no añade velocidad de rebote.
      if(penetracion>0)p[1]+=penetracion*.95;
      for(let iter=0;iter<10;iter++)for(const c of contactos){
        const n=[0,1,0],rn=cruz(c.r,n),masa=1+punto(rn,inversa(rn));
        const vn=vel[1]+cruz(omega,c.r)[1],nuevo=Math.max(0,c.normal+(c.objetivo-vn)/masa);
        const cambio=nuevo-c.normal;c.normal=nuevo;aplicar([0,cambio,0],c.r);
        const vc=suma(vel,cruz(omega,c.r)),tang=[vc[0],0,vc[2]],mod=largo(tang);
        if(mod>1e-9){
          const dir=por(tang,1/mod),rt=cruz(c.r,dir),j=mod/(1+punto(rt,inversa(rt)));
          let t=resta(c.t,por(dir,j));const lim=.45*c.normal,tam=largo(t);
          if(tam>lim)t=por(t,lim/tam);aplicar(resta(t,c.t),c.r);c.t=t;
        }
      }
      // Resistencia de rodadura/contacto; disipa L sin elegir una orientación.
      if(contactos.length){momento=por(momento,Math.exp(-1.25*DT));omega=inversa(momento);}
      const alineacion=Math.abs(normal[1]),apoyos=radios.filter(r=>Math.abs(p[1]+r[1])<.003).length;
      if(largo(vel)<.035&&largo(omega)<.065&&alineacion>.9997&&apoyos>=3)estable+=DT;else estable=0;
      if(pasos%4===0)frames.push({p:p.slice(),q:q.slice(),t:pasos*DT});
      if(estable>=.2){asentado=true;break;}
    }
    const final={p:p.slice(),q:q.slice(),t:pasos*DT};
    if(frames.at(-1).t===final.t)frames[frames.length-1]=final;else frames.push(final);
    const lectura=leer(q);
    return {version:1,tipo:'moneda',semilla:semilla>>>0,impulso,valor:asentado?lectura.valor:null,asentado,alineacion:lectura.alineacion,duracion:final.t,frames,impactos};
  }
  // La física se calcula una sola vez, en el anfitrión. Ambos jugadores muestran
  // este mismo replay compacto, sin volver a simular ni aceptar una cara aislada.
  // RDP conserva los rebotes y el reposo con error <.01 m / .03 rad. Los tiempos
  // siguen la cuadrícula física de 240 Hz; no se redondean a milisegundos.
  const MAX_FRAMES=176,BYTES_FRAME=14,MAX_BYTES=MAX_FRAMES*BYTES_FRAME;
  function poseValida(f){
    return !!f&&Number.isFinite(f.t)&&f.t>=0&&f.t<=20&&vectorValido(f.p,3)&&vectorValido(f.q,4)&&
      Math.abs(f.p[0])<=30&&Math.abs(f.p[2])<=30&&f.p[1]>=-.005&&f.p[1]<=6&&Math.abs(largo(f.q)-1)<.003;
  }
  function finalValido(frames,valor){
    const ultimo=frames.at(-1),lectura=leer(ultimo.q);
    if(!lectura||lectura.valor!==valor||lectura.alineacion<.9995)return false;
    const soporte=H*lectura.alineacion+R*Math.sqrt(Math.max(0,1-lectura.alineacion**2));
    if(Math.abs(ultimo.p[1]-soporte)>.006)return false;
    const antes=frames.findLast(f=>f.t<=ultimo.t-.12);
    if(!antes||largo(resta(ultimo.p,antes.p))>.012)return false;
    const producto=Math.abs(ultimo.q.reduce((s,v,i)=>s+v*antes.q[i],0));
    return producto>.9998&&leer(antes.q).valor===valor;
  }
  function simplificar(frames){
    const ultimo=frames.length-1,antes=frames.findLastIndex(f=>f.t<=frames[ultimo].t-.15);
    if(antes<1)return null;
    // Conservar explícitamente la llegada al reposo y las últimas dos poses.
    const indices=[0,antes,ultimo-1,ultimo],guardar=new Set(indices),pendientes=[];
    for(let i=1;i<indices.length;i++)pendientes.push([indices[i-1],indices[i]]);
    while(pendientes.length){
      const [a,b]=pendientes.pop();if(b-a<2)continue;
      const inicio=frames[a],fin=frames[b],dt=fin.t-inicio.t;
      const signo=inicio.q.reduce((s,v,i)=>s+v*fin.q[i],0)<0?-1:1;
      let mayor=1,corte=-1;
      if(dt>.25)corte=(a+b)>>1;
      else for(let j=a+1;j<b;j++){
        const f=frames[j],u=(f.t-inicio.t)/dt;
        const p=inicio.p.map((v,i)=>v+(fin.p[i]-v)*u);
        const q=unidad(inicio.q.map((v,i)=>v+(fin.q[i]*signo-v)*u));
        const producto=Math.abs(q.reduce((s,v,i)=>s+v*f.q[i],0));
        const error=Math.max(largo(resta(p,f.p))/.009,2*Math.acos(Math.min(1,producto))/.029);
        if(error>mayor){mayor=error;corte=j;}
      }
      if(corte>=0){guardar.add(corte);pendientes.push([a,corte],[corte,b]);}
    }
    return Array.from(guardar).sort((a,b)=>a-b).map(i=>frames[i]);
  }
  function empaquetar(tirada){
    if(!tirada||tirada.asentado!==true||![0,1].includes(tirada.valor)||!Array.isArray(tirada.frames)||tirada.frames.length<2||tirada.frames.length>1202)return null;
    const originales=tirada.frames;
    if(originales[0].t!==0||!originales.every((f,i)=>poseValida(f)&&(!i||f.t>originales[i-1].t))||!finalValido(originales,tirada.valor))return null;
    const fs=simplificar(originales);
    if(!fs||fs.length>MAX_FRAMES||!finalValido(fs,tirada.valor))return null;
    if(!Number.isFinite(tirada.duracion)||Math.abs(tirada.duracion-fs.at(-1).t)>1e-8)return null;
    const datos=new Uint8Array(fs.length*BYTES_FRAME),vista=new DataView(datos.buffer);
    let anterior=-1;
    for(let i=0;i<fs.length;i++){
      const f=fs[i],paso=Math.round(f.t/DT);if(paso<=anterior||Math.abs(paso*DT-f.t)>1e-8)return null;anterior=paso;
      // Quaternion «tres menores»: el componente mayor se reconstruye positivo.
      // q y -q representan la misma orientación; el interpolador toma el arco corto.
      const q=unidad(f.q);let omitido=0;for(let j=1;j<4;j++)if(Math.abs(q[j])>Math.abs(q[omitido]))omitido=j;
      const signo=q[omitido]<0?-1:1;
      let k=i*BYTES_FRAME;vista.setUint16(k,paso|(omitido<<14));k+=2;
      for(const v of f.p){vista.setInt16(k,Math.round(v*1000));k+=2;}
      for(let j=0;j<4;j++)if(j!==omitido){vista.setInt16(k,Math.round(q[j]*signo*32767));k+=2;}
    }
    let bin='';for(const b of datos)bin+=String.fromCharCode(b);
    const trayectoria=typeof btoa==='function'?btoa(bin):Buffer.from(datos).toString('base64');
    const paquete={version:1,tipo:'moneda',semilla:tirada.semilla>>>0,impulso:impulsoValido(tirada.impulso),valor:tirada.valor,asentado:true,
      duracion:anterior*DT,impactos:clamp(Math.floor(tirada.impactos||0),0,MAX_PASOS),trayectoria};
    // Dejar margen para el sobre coin y el transporte con límite de 4096 bytes.
    // Un fallo de codificación se comunica; nunca se cambia la semilla por tamaño.
    return JSON.stringify(paquete).length<=3600?paquete:null;
  }
  function desempaquetar(datos){
    if(!datos||datos.version!==1||datos.tipo!=='moneda'||datos.asentado!==true||![0,1].includes(datos.valor)||
      !Number.isInteger(datos.semilla)||datos.semilla<0||datos.semilla>4294967295||!Number.isFinite(datos.duracion)||datos.duracion<=0||datos.duracion>20||
      !Number.isInteger(datos.impactos)||datos.impactos<0||datos.impactos>MAX_PASOS||typeof datos.trayectoria!=='string'||
      datos.trayectoria.length>Math.ceil(MAX_BYTES/3)*4||datos.trayectoria.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(datos.trayectoria))return null;
    const impulso=impulsoValido(datos.impulso);
    if(!datos.impulso||['x','z','fuerza'].some(k=>datos.impulso[k]!==impulso[k]))return null;
    try{
      const bin=typeof atob==='function'?atob(datos.trayectoria):Buffer.from(datos.trayectoria,'base64').toString('binary');
      if(bin.length<BYTES_FRAME*2||bin.length>MAX_BYTES||bin.length%BYTES_FRAME)return null;
      const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)),v=new DataView(bytes.buffer),frames=[];
      for(let i=0;i<bytes.length;i+=BYTES_FRAME){
        const codigo=v.getUint16(i),omitido=codigo>>>14;let k=i+2;
        const p=[],q=[0,0,0,0];for(let j=0;j<3;j++){p.push(v.getInt16(k)/1000);k+=2;}
        for(let j=0;j<4;j++)if(j!==omitido){q[j]=v.getInt16(k)/32767;k+=2;}
        const cuadrados=q.reduce((s,n)=>s+n*n,0);if(cuadrados>.7501)return null;
        q[omitido]=Math.sqrt(1-cuadrados);
        if(q.some(n=>Math.abs(n)>q[omitido]+.0001))return null;
        const f={t:(codigo&16383)*DT,p,q};if(!poseValida(f))return null;
        if((!i&&f.t!==0)||(i&&(f.t<=frames.at(-1).t||f.t-frames.at(-1).t>.250001)))return null;
        frames.push(f);
      }
      if(Math.abs(frames.at(-1).t-datos.duracion)>.00001||!finalValido(frames,datos.valor))return null;
      return {version:1,tipo:'moneda',semilla:datos.semilla,impulso,valor:datos.valor,asentado:true,duracion:datos.duracion,impactos:datos.impactos,
        alineacion:leer(frames.at(-1).q).alineacion,frames};
    }catch(_){return null;}
  }
  global.CAOZ_MONEDA={simular,leer,girar,empaquetar,desempaquetar,impulsoValido,radio:R,grosor:H*2};
})(typeof window!=='undefined'?window:globalThis);

/* Presentación de la moneda. El lienzo sigue exclusivamente la trayectoria
   física recibida; nunca elige una cara ni corrige su orientación al terminar. */
(function(global){
  'use strict';
  if(typeof document==='undefined'||!global.CAOZ_MONEDA)return;
  const F=global.CAOZ_MONEDA, TAU=Math.PI*2, N=80;
  const suma=(a,b)=>a.map((v,i)=>v+b[i]),resta=(a,b)=>a.map((v,i)=>v-b[i]),por=(a,k)=>a.map(v=>v*k);
  const punto=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unidad=a=>por(a,1/(Math.hypot(...a)||1)),limitar=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lienzos=new WeakMap(),sellos=[];let sesion=null;
  function circulo(c,r){c.beginPath();c.arc(0,0,r,0,TAU);}
  function corona(c){
    c.beginPath();c.moveTo(-100,40);c.lineTo(-119,-72);c.lineTo(-59,-24);c.lineTo(0,-109);c.lineTo(59,-24);c.lineTo(119,-72);c.lineTo(100,40);c.closePath();
    c.moveTo(-102,60);c.lineTo(102,60);c.lineTo(96,83);c.lineTo(-96,83);c.closePath();
    for(const [x,y]of [[-119,-84],[0,-123],[119,-84]]){c.moveTo(x+11,y);c.arc(x,y,11,0,TAU);}
  }
  function espada(c,angulo){
    c.save();c.rotate(angulo);c.beginPath();c.moveTo(0,-140);c.lineTo(18,-112);c.lineTo(13,52);c.lineTo(47,57);c.lineTo(46,73);c.lineTo(12,68);c.lineTo(10,109);c.lineTo(19,118);c.lineTo(0,139);c.lineTo(-19,118);c.lineTo(-10,109);c.lineTo(-12,68);c.lineTo(-46,73);c.lineTo(-47,57);c.lineTo(-13,52);c.lineTo(-18,-112);c.closePath();
    grabar(c);c.beginPath();c.moveTo(0,-109);c.lineTo(0,45);c.strokeStyle='#fce4a0';c.lineWidth=3;c.stroke();c.restore();
  }
  function grabar(c){
    c.fillStyle='#6e420f';c.strokeStyle='#ffe7a3';c.lineWidth=5;c.lineJoin='round';c.shadowColor='#fff2b9';c.shadowOffsetY=3;c.shadowBlur=0;c.fill();c.stroke();c.shadowOffsetY=0;
    c.save();c.clip();const g=c.createLinearGradient(-100,-120,100,120);g.addColorStop(0,'#71410e');g.addColorStop(.4,'#b88331');g.addColorStop(.52,'#e9be65');g.addColorStop(1,'#775019');c.fillStyle=g;c.fillRect(-180,-170,360,340);c.restore();
  }
  function sello(lado){
    if(sellos[lado])return sellos[lado];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.translate(256,256);
    const oro=c.createLinearGradient(-210,-230,200,240);oro.addColorStop(0,'#fff0b1');oro.addColorStop(.18,'#d9ad4f');oro.addColorStop(.38,'#f0ce75');oro.addColorStop(.58,'#b87b25');oro.addColorStop(.78,'#e7bc58');oro.addColorStop(1,'#fff0ac');c.fillStyle=oro;circulo(c,255);c.fill();
    for(const [radio,ancho,color]of [[245,9,'#6e460f'],[237,5,'#fff0b0'],[218,3,'#835815'],[210,2,'#ffdf87'],[190,2,'#ad7c2d']]){circulo(c,radio);c.strokeStyle=color;c.lineWidth=ancho;c.stroke();}
    // Grano tallado fijo: no introduce ruido ni parpadeo entre fotogramas.
    c.save();circulo(c,233);c.clip();for(let i=0;i<140;i++){const y=-250+i*3.7;c.strokeStyle=i%3?'#70430a0b':'#fff4bf1a';c.lineWidth=.8;c.beginPath();c.moveTo(-255,y);c.bezierCurveTo(-90,y-2,70,y+2,255,y-1);c.stroke();}c.restore();
    for(let i=0;i<64;i++){const a=i*TAU/64;c.beginPath();c.arc(Math.cos(a)*227,Math.sin(a)*227,2.3,0,TAU);c.fillStyle='#805114';c.fill();c.beginPath();c.arc(Math.cos(a)*227,Math.sin(a)*227-1.4,1.3,0,TAU);c.fillStyle='#ffebaa';c.fill();}
    // Guirnaldas de laurel alrededor del grabado, con silueta legible en móvil.
    for(const signo of [-1,1]){c.save();c.scale(signo,1);c.strokeStyle='#8e601e';c.lineWidth=3;c.beginPath();c.arc(0,-4,168,.15,1.36);c.stroke();for(let i=0;i<8;i++){const a=.22+i*.145,x=Math.cos(a)*166,y=Math.sin(a)*166-4;c.save();c.translate(x,y);c.rotate(a-.65);c.fillStyle='#997025';c.beginPath();c.ellipse(0,0,5,13,0,0,TAU);c.fill();c.strokeStyle='#f7d780';c.lineWidth=1.4;c.stroke();c.restore();}c.restore();}
    if(lado===0){corona(c);grabar(c);c.beginPath();c.moveTo(-82,19);c.lineTo(82,19);c.strokeStyle='#f9dc8d';c.lineWidth=4;c.stroke();for(const x of [-59,0,59]){c.save();c.translate(x,52);c.rotate(Math.PI/4);c.fillStyle='#654014';c.fillRect(-5,-5,10,10);c.restore();}}
    else{espada(c,-.64);espada(c,.64);}
    sellos[lado]=canvas;return canvas;
  }
  function ruta(c,ps){c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
  function textura(c,img,ps,centro){
    // Abanico proyectado: mantiene el grabado adherido a la cara al girar.
    for(let i=0;i<N;i++){
      const a=i*TAU/N,b=(i+1)*TAU/N,s1=[256+255*Math.cos(a),256+255*Math.sin(a)],s2=[256+255*Math.cos(b),256+255*Math.sin(b)],p1=ps[i],p2=ps[(i+1)%N];
      const u=s1[0]-256,v=s1[1]-256,x=s2[0]-256,y=s2[1]-256,det=u*y-v*x;if(Math.abs(det)<1e-5)continue;
      const A=((p1.x-centro.x)*y-(p2.x-centro.x)*v)/det,B=((p1.y-centro.y)*y-(p2.y-centro.y)*v)/det,C=((p2.x-centro.x)*u-(p1.x-centro.x)*x)/det,D=((p2.y-centro.y)*u-(p1.y-centro.y)*x)/det;
      c.save();ruta(c,[centro,p1,p2]);c.clip();c.transform(A,B,C,D,centro.x-256*(A+C),centro.y-256*(B+D));c.drawImage(img,0,0);c.restore();
    }
  }
  function pintar(canvas,pose){
    if(!canvas||!pose?.p||!pose?.q)return false;
    const rect=canvas.getBoundingClientRect(),W=Math.max(1,rect.width||360),H=Math.max(1,rect.height||238),dpr=Math.min(2,global.devicePixelRatio||1),c=canvas.getContext('2d');if(!c)return false;
    if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
    c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
    const radio=Number(F.radio)||.5,grosor=Number(F.grosor)||.09,alto=Math.max(0,pose.p[1]-grosor/2);
    const aim=[pose.p[0]*.88,alto*.68,pose.p[2]*.88],cam=suma(aim,[.25,7.7+alto*.8,5.4]),frente=unidad(resta(aim,cam)),derecha=unidad(cruz(frente,[0,1,0])),arriba=cruz(derecha,frente),f=Math.min(H*5.75,W*3.65);
    let escala=1,dx=0,dy=0;
    const cruda=v=>{const r=resta(v,cam),z=Math.max(.1,punto(r,frente));return{x:W/2+punto(r,derecha)*f/z,y:H*.60-punto(r,arriba)*f/z,z};};
    const proy=v=>{const p=cruda(v);return{x:W/2+(p.x-W/2)*escala+dx,y:H*.55+(p.y-H*.55)*escala+dy,z:p.z};};
    const puntoLocal=(x,y,z)=>suma(pose.p,F.girar([x,y,z],pose.q));
    const anillos=[-1,1].map(signo=>Array.from({length:N},(_,i)=>puntoLocal(Math.cos(i*TAU/N)*radio,signo*grosor/2,Math.sin(i*TAU/N)*radio)));
    // Encuadre acotado incluso si un lanzamiento llega al borde de la mesa.
    const limites=anillos.flat().map(cruda),minX=Math.min(...limites.map(p=>p.x)),maxX=Math.max(...limites.map(p=>p.x)),minY=Math.min(...limites.map(p=>p.y)),maxY=Math.max(...limites.map(p=>p.y)),m=Math.min(13,H*.05);
    escala=Math.min(1,(W-m*2)/(maxX-minX),(H-m*2)/(maxY-minY));
    const ax=W/2+(minX-W/2)*escala,bx=W/2+(maxX-W/2)*escala,ay=H*.55+(minY-H*.55)*escala,by=H*.55+(maxY-H*.55)*escala;
    dx=ax<m?m-ax:bx>W-m?W-m-bx:0;dy=ay<m?m-ay:by>H-m?H-m-by:0;
    const fondo=c.createRadialGradient(W*.47,H*.51,H*.08,W*.5,H*.51,Math.max(W,H)*.7);fondo.addColorStop(0,'#3b2830');fondo.addColorStop(.48,'#211a22');fondo.addColorStop(1,'#100e17');c.fillStyle=fondo;c.fillRect(0,0,W,H);
    // Incrustación tenue en una mesa de cuero oscuro. Sus líneas permiten leer el desplazamiento.
    c.save();c.lineWidth=.65;
    for(let j=0;j<4;j++){const ps=Array.from({length:128},(_,i)=>proy([Math.cos(i*TAU/128)*(1.10+j*.075),0,Math.sin(i*TAU/128)*(1.10+j*.075)]));ruta(c,ps);c.strokeStyle=j===1?'#c6a16334':'#b18c4919';c.stroke();}
    for(let i=0;i<48;i++){const a=i*TAU/48,ps=[1.15,1.19+(i%4===0?.05:0)].map(r=>proy([Math.cos(a)*r,0,Math.sin(a)*r]));c.beginPath();c.moveTo(ps[0].x,ps[0].y);c.lineTo(ps[1].x,ps[1].y);c.strokeStyle='#d1ad672b';c.stroke();}
    for(let i=0;i<36;i++){const x=(i*83%353)/353*W,y=(i*61%227)/227*H;c.fillStyle='#d8bc9b08';c.fillRect(x,y,1,1);}c.restore();
    const base=proy([pose.p[0],.001,pose.p[2]]),sx=proy([pose.p[0]+radio,.001,pose.p[2]]),sz=proy([pose.p[0],.001,pose.p[2]+radio]);
    c.save();c.translate(base.x,base.y);c.transform(sx.x-base.x,sx.y-base.y,sz.x-base.x,sz.y-base.y,0,0);const sombra=c.createRadialGradient(0,0,.1,0,0,1.75+alto*.35);sombra.addColorStop(0,`rgba(0,0,0,${Math.max(.10,.66-alto*.18)})`);sombra.addColorStop(.55,'#00000025');sombra.addColorStop(1,'#00000000');c.fillStyle=sombra;circulo(c,2.5+alto*.35);c.fill();c.restore();
    const luz=unidad([-.6,1,.65]),poligonos=[];
    for(let i=0;i<N;i++){const j=(i+1)%N,n=F.girar([Math.cos((i+.5)*TAU/N),0,Math.sin((i+.5)*TAU/N)],pose.q),centro=por(suma(suma(anillos[0][i],anillos[0][j]),suma(anillos[1][i],anillos[1][j])),.25);if(punto(n,resta(cam,centro))<=0)continue;poligonos.push({p:[anillos[0][i],anillos[0][j],anillos[1][j],anillos[1][i]],z:proy(centro).z,n,i});}
    for(const signo of [-1,1]){const n=F.girar([0,signo,0],pose.q),centro=puntoLocal(0,signo*grosor/2,0);if(punto(n,resta(cam,centro))>0)poligonos.push({p:anillos[signo>0?1:0],z:proy(centro).z,n,centro,signo});}
    poligonos.sort((a,b)=>b.z-a.z);
    for(const o of poligonos){const ps=o.p.map(proy),l=limitar(punto(o.n,luz),0,1);ruta(c,ps);
      if(!o.signo){const brillo=o.i%2===0?.86:1.13;c.fillStyle=`rgb(${Math.round((100+l*139)*brillo)},${Math.round((61+l*121)*brillo)},${Math.round((19+l*63)*brillo)})`;c.fill();c.lineWidth=.45;c.strokeStyle='#f9d98336';c.stroke();continue;}
      const centro=proy(o.centro);textura(c,sello(o.signo>0?0:1),ps,centro);
      c.save();ruta(c,ps);c.clip();const sombraCara=c.createLinearGradient(centro.x-radio*150,centro.y-radio*150,centro.x+radio*150,centro.y+radio*150);sombraCara.addColorStop(0,`rgba(255,246,196,${.04+l*.14})`);sombraCara.addColorStop(.42,'#fff9dc00');sombraCara.addColorStop(1,`rgba(47,21,2,${.06+(1-l)*.32})`);c.fillStyle=sombraCara;c.fillRect(0,0,W,H);
      const media=unidad(suma(luz,unidad(resta(cam,o.centro)))),especular=Math.pow(Math.max(0,punto(o.n,media)),12);if(especular>.03){const reflejo=c.createLinearGradient(centro.x-95,centro.y-80,centro.x+95,centro.y+70);reflejo.addColorStop(0,'#fff7c900');reflejo.addColorStop(.4,`rgba(255,247,208,${especular*.22})`);reflejo.addColorStop(.56,'#fff7c900');reflejo.addColorStop(1,'#fff7c900');c.fillStyle=reflejo;c.fillRect(0,0,W,H);}c.restore();ruta(c,ps);c.lineWidth=1.25;c.strokeStyle='#ffe8a69e';c.stroke();
    }
    const s=lienzos.get(canvas),ahora=Number(pose.t)||0;
    if(s?.impacto!=null){const edad=ahora-s.impacto;if(edad>=0&&edad<.38){for(let i=0;i<9;i++){const a=i*2.4,r=edad*(36+i*4),x=base.x+Math.cos(a)*r,y=base.y+Math.sin(a)*r*.35-26*edad*(1-edad/.38);c.globalAlpha=(1-edad/.38)*.7;c.fillStyle=i%3?'#dcb55f':'#fff0b3';c.fillRect(x,y,1.5,1.5);}c.globalAlpha=1;}}
    const borde=c.createLinearGradient(0,0,W,H);borde.addColorStop(0,'#cfa4674d');borde.addColorStop(.5,'#55412d10');borde.addColorStop(1,'#cfa46738');c.lineWidth=1;c.strokeStyle=borde;c.strokeRect(.5,.5,W-1,H-1);
    return true;
  }
  function terminar(s,completo){
    if(!s||s.fin)return;s.fin=true;clearTimeout(s.timer);clearInterval(s.vigia);global.cancelAnimationFrame(s.raf);document.removeEventListener('visibilitychange',s.oculta);
    if(completo){pintar(s.canvas,s.ultimo);s.canvas.setAttribute('aria-label','Moneda detenida: '+(F.leer(s.ultimo.q).valor===0?'cara, la corona':'cruz, las espadas'));if(!document.hidden&&!s.silencio)global.CAOZ_AUDIO?.play('coin_land');}
    lienzos.delete(s.canvas);if(sesion===s)sesion=null;s.resolve(completo);
  }
  function mostrar(canvas,tirada,op={}){
    terminar(sesion,false);
    const frames=tirada?.frames;if(!canvas?.isConnected||!Array.isArray(frames)||!frames.length)return Promise.resolve(false);
    const valido=()=>{try{return canvas.isConnected&&(!op.vigente||op.vigente());}catch(_){return false;}};
    if(!valido())return Promise.resolve(false);
    return new Promise(resolve=>{
      const reducido=op.rapido||global.matchMedia?.('(prefers-reduced-motion: reduce)').matches,ultimo=frames[frames.length-1],preparacion=140,duracion=Math.max(0,(Number(ultimo.t)||0)*1000),s={canvas,resolve,ultimo,fin:false,silencio:!!op.rapido,inicio:performance.now(),indice:0,impacto:null,previo:null};sesion=s;lienzos.set(canvas,s);
      s.oculta=()=>{if(document.hidden)terminar(s,valido());};document.addEventListener('visibilitychange',s.oculta);
      s.vigia=setInterval(()=>{if(!valido())terminar(s,false);},100);
      if(document.hidden||reducido){terminar(s,true);return;}
      global.CAOZ_AUDIO?.play('coin_flip');canvas.setAttribute('aria-label','Moneda girando sobre la mesa');
      const dibujar=()=>{
        if(s.fin)return;if(!valido()){terminar(s,false);return;}
        const transcurrido=performance.now()-s.inicio;
        if(transcurrido<preparacion){
          // El gesto de levantar precede al lanzamiento. No forma parte de su
          // física ni cambia ninguna muestra transmitida entre los jugadores.
          const k=limitar(transcurrido/preparacion,0,1),e=k*k*(3-2*k),primero=frames[0],base=[0,(Number(F.grosor)||.065)/2,0],signo=primero.q[3]<0?-1:1;
          pintar(canvas,{p:base.map((v,i)=>v+(primero.p[i]-v)*e),q:unidad([0,0,0,1].map((v,i)=>v+(primero.q[i]*signo-v)*e)),t:(transcurrido-preparacion)/1000});
          s.raf=global.requestAnimationFrame(dibujar);return;
        }
        const t=Math.max(0,(transcurrido-preparacion)/1000);if(t>=duracion/1000){terminar(s,true);return;}
        while(s.indice<frames.length-2&&frames[s.indice+1].t<t)s.indice++;
        const a=frames[s.indice],b=frames[Math.min(s.indice+1,frames.length-1)],k=limitar((t-a.t)/(b.t-a.t||1),0,1),signo=punto(a.q,b.q)<0?-1:1,pose={p:a.p.map((v,i)=>v+(b.p[i]-v)*k),q:unidad(a.q.map((v,i)=>v+(b.q[i]*signo-v)*k)),t};
        const dy=s.previo?pose.p[1]-s.previo.y:0;if(s.previo&&s.previo.dy<-.006&&dy>=0&&pose.p[1]<.65&&(s.impacto==null||t-s.impacto>.22)){s.impacto=t;global.CAOZ_AUDIO?.play('coin_land',{volumen:.32});}s.previo={y:pose.p[1],dy};
        pintar(canvas,pose);s.raf=global.requestAnimationFrame(dibujar);
      };
      // El reloj termina aunque el navegador suspenda los fotogramas del lienzo.
      s.timer=setTimeout(()=>terminar(s,valido()),duracion+preparacion+100);dibujar();
    });
  }
  F.pintar=pintar;F.mostrar=mostrar;F.cancelar=()=>terminar(sesion,false);
})(typeof window!=='undefined'?window:globalThis);

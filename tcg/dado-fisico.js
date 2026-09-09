/* D20 físico del Domo. Un solo sólido, integración de paso fijo, impulsos de
   contacto, restitución y fricción de Coulomb. Sin motor externo ni resultado
   prefijado: el número se lee de la normal de la cara superior al reposar.
   Referencia de método: box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf.
   La simulación es pura; el anfitrión transmite sus condiciones iniciales. */
'use strict';
(function(global){
  const suma=(a,b)=>a.map((v,i)=>v+b[i]), resta=(a,b)=>a.map((v,i)=>v-b[i]), por=(a,k)=>a.map(v=>v*k);
  const punto=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const largo=a=>Math.hypot(...a), unidad=a=>por(a,1/(largo(a)||1)), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const R=.54, PHI=(1+Math.sqrt(5))/2, DT=1/180, INERCIA=1/(.29*R*R);
  const vertices=[];
  for(const a of [-1,1])for(const b of [-1,1])vertices.push([0,a,b*PHI],[a,b*PHI,0],[b*PHI,0,a]);
  vertices.forEach((v,i)=>vertices[i]=por(unidad(v),R));
  const caras=[];
  for(let a=0;a<12;a++)for(let b=a+1;b<12;b++)for(let c=b+1;c<12;c++){
    let ids=[a,b,c], n=unidad(cruz(resta(vertices[b],vertices[a]),resta(vertices[c],vertices[a])));
    const ds=vertices.map(v=>punto(n,resta(v,vertices[a])));
    if(ds.some(d=>d>1e-6)&&ds.some(d=>d< -1e-6))continue;
    if(punto(n,vertices[a])<0){ids=[a,c,b];n=por(n,-1);}
    caras.push({ids,n,valor:0});
  }
  let siguiente=1;
  caras.forEach(c=>{if(c.valor)return;c.valor=siguiente;caras.find(o=>punto(c.n,o.n)<-.999).valor=21-siguiente;siguiente++;});
  function girar(v,q){const u=q.slice(0,3), t=por(cruz(u,v),2);return suma(v,suma(por(t,q[3]),cruz(u,t)));}
  function orientar(q,w,dt){
    const [x,y,z,s]=q,[a,b,c]=w,h=dt/2;
    return unidad([x+h*(a*s+b*z-c*y),y+h*(-a*z+b*s+c*x),z+h*(a*y-b*x+c*s),s+h*(-a*x-b*y-c*z)]);
  }
  function azar(semilla){let x=semilla>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function impulsoValido(p){return {x:clamp(Number.isFinite(p?.x)?p.x:0,-1,1),z:clamp(Number.isFinite(p?.z)?p.z:-.6,-1,1),fuerza:clamp(Number.isFinite(p?.fuerza)?p.fuerza:.6,.15,1)};}
  function leer(q){let cara=caras[0],altura=-2;for(const c of caras){const y=girar(c.n,q)[1];if(y>altura){altura=y;cara=c;}}return {valor:cara.valor,alineacion:altura,indice:caras.indexOf(cara)};}
  function simular(semilla,entrada){
    const rng=azar(semilla), impulso=impulsoValido(entrada), u=rng(),v=rng()*Math.PI*2,w=rng()*Math.PI*2;
    let q=[Math.sqrt(1-u)*Math.sin(v),Math.sqrt(1-u)*Math.cos(v),Math.sqrt(u)*Math.sin(w),Math.sqrt(u)*Math.cos(w)];
    let p=[(rng()-.5)*1.8,1.4+rng()*.55,.9], vel=[impulso.x*2.4+(rng()-.5)*1.4,1.2+impulso.fuerza*2,impulso.z*2.1-.4];
    let omega=por(unidad([rng()-.5,rng()-.5,rng()-.5]),12+rng()*14), estable=0, asentado=false, impactos=0;
    const planos=[{n:[0,1,0],d:0}];
    const frames=[{p:p.slice(),q:q.slice(),t:0}], contactosFinales=[];
    const aplicar=(j,r)=>{vel=suma(vel,j);omega=suma(omega,por(cruz(r,j),INERCIA));};
    let paso=0;
    for(;paso<3600;paso++){
      vel[1]-=9.81*DT;vel=por(vel,Math.exp(-.06*DT));omega=por(omega,Math.exp(-.07*DT));
      p=suma(p,por(vel,DT));q=orientar(q,omega,DT);
      const radios=vertices.map(v=>girar(v,q)), contactos=[];
      for(const plano of planos){
        let penetracion=0;
        for(const r of radios){
          const d=punto(suma(p,r),plano.n)-plano.d;
          if(d>.0025)continue;
          const vn=punto(suma(vel,cruz(omega,r)),plano.n);
          const rebote=vn<-.8?-.32*vn:0;
          if(rebote>.45)impactos++;
          contactos.push({r,n:plano.n,objetivo:rebote,normal:0,t:[0,0,0]});
          penetracion=Math.max(penetracion,-d);
        }
        if(penetracion>0)p=suma(p,por(plano.n,penetracion*.9));
      }
      for(let iter=0;iter<12;iter++)for(const c of contactos){
        const rn=cruz(c.r,c.n), vn=punto(suma(vel,cruz(omega,c.r)),c.n), masa=1+INERCIA*punto(rn,rn);
        const nuevo=Math.max(0,c.normal+(c.objetivo-vn)/masa), cambio=nuevo-c.normal;c.normal=nuevo;aplicar(por(c.n,cambio),c.r);
        const vc=suma(vel,cruz(omega,c.r)), tang=resta(vc,por(c.n,punto(vc,c.n))), mod=largo(tang);
        if(mod>1e-9){
          const dir=por(tang,1/mod), rt=cruz(c.r,dir), j=mod/(1+INERCIA*punto(rt,rt));
          let t=resta(c.t,por(dir,j));const lim=.38*c.normal, tam=largo(t);if(tam>lim)t=por(t,lim/tam);
          aplicar(resta(t,c.t),c.r);c.t=t;
        }
      }
      if(contactos.some(c=>c.n[1]===1))omega=por(omega,Math.exp(-.8*DT));
      const cara=leer(q), apoyo=radios.filter(r=>Math.abs(p[1]+r[1])<.006).length;
      if(largo(vel)<.045&&largo(omega)<.09&&cara.alineacion>.9997&&apoyo>=3)estable+=DT;else estable=0;
      if(paso%3===2)frames.push({p:p.slice(),q:q.slice(),t:(paso+1)*DT});
      if(estable>.18){asentado=true;contactosFinales.push(...radios.filter(r=>Math.abs(p[1]+r[1])<.006).map(r=>suma(p,r)));break;}
    }
    const final={p:p.slice(),q:q.slice(),t:(paso+1)*DT};frames.push(final);
    return {version:1,semilla:semilla>>>0,impulso,valor:leer(q).valor,alineacion:leer(q).alineacion,asentado,apoyos:contactosFinales,impactos,duracion:final.t,frames};
  }
  /* La trayectoria viaja compacta: el invitado no vuelve a calcular física
     flotante. Todos dibujan la misma muestra autoritativa, interpolada a 60 Hz. */
  function empaquetar(tirada){
    const fs=tirada.frames.filter((_,i)=>i%3===0);if(fs.at(-1)!==tirada.frames.at(-1))fs.push(tirada.frames.at(-1));
    const datos=new Uint8Array(fs.length*16),vista=new DataView(datos.buffer);
    fs.forEach((f,i)=>{let k=i*16;vista.setUint16(k,Math.round(f.t*1000));k+=2;for(const v of f.p){vista.setInt16(k,Math.round(v*1000));k+=2;}for(const v of f.q){vista.setInt16(k,Math.round(v*32767));k+=2;}});
    let bin='';for(const b of datos)bin+=String.fromCharCode(b);
    const trayectoria=typeof btoa==='function'?btoa(bin):Buffer.from(datos).toString('base64');
    return {version:1,semilla:tirada.semilla,impulso:tirada.impulso,valor:tirada.valor,asentado:tirada.asentado,duracion:tirada.duracion,trayectoria};
  }
  function desempaquetar(datos){
    if(!datos||datos.version!==1||typeof datos.trayectoria!=='string'||datos.trayectoria.length>20000)return null;
    try{
      const bin=typeof atob==='function'?atob(datos.trayectoria):Buffer.from(datos.trayectoria,'base64').toString('binary');
      if(bin.length<32||bin.length%16)return null;const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)),v=new DataView(bytes.buffer),frames=[];
      for(let i=0;i<bytes.length;i+=16){let k=i+2;const p=[],q=[];for(let j=0;j<3;j++){p.push(v.getInt16(k)/1000);k+=2;}for(let j=0;j<4;j++){q.push(v.getInt16(k)/32767);k+=2;}frames.push({t:v.getUint16(i)/1000,p,q:unidad(q)});}
      if(leer(frames.at(-1).q).valor!==datos.valor||leer(frames.at(-1).q).alineacion<.999||!datos.asentado)return null;
      return {...datos,frames,duracion:frames.at(-1).t};
    }catch(_){return null;}
  }
  global.CAOZ_D20={simular,impulsoValido,leer,girar,vertices,caras,empaquetar,desempaquetar};
})(typeof window!=='undefined'?window:globalThis);

/* Presentación compartida. Canvas sólo dibuja los fotogramas de la simulación;
   no decide números y no necesita WebGL en Safari. */
(function(global){
  if(typeof document==='undefined')return;
  const F=global.CAOZ_D20, resta=(a,b)=>a.map((v,i)=>v-b[i]), suma=(a,b)=>a.map((v,i)=>v+b[i]), por=(a,k)=>a.map(v=>v*k);
  const punto=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unidad=a=>por(a,1/(Math.hypot(...a)||1));
  let sesion=null;
  function css(){
    if(document.getElementById('d20FisicoEstilo'))return;
    const s=document.createElement('style');s.id='d20FisicoEstilo';s.textContent=`
      #dice.fisico{padding:14px;box-sizing:border-box;background:radial-gradient(ellipse at 50% 45%,#16101fde,#050309ed);backdrop-filter:blur(5px)}
      #dice.fisico .dicebox{box-sizing:border-box;width:min(620px,94vw);max-height:calc(100dvh - 28px);padding:20px 20px 16px;gap:9px;overflow:hidden;background:linear-gradient(145deg,#231b2c,#100b16);border:1px solid #a88c50;box-shadow:0 25px 100px #000b,0 0 45px #bd843d16}
      #dice.fisico .dtop{width:100%;font:600 clamp(17px,2.5vw,25px) Georgia,serif;text-align:center;color:#eddda9}
      #dice.fisico .dpide{text-align:center;max-width:100%;font-size:14px}
      .d20Mesa{position:relative;width:100%;height:clamp(190px,38vh,320px);flex-shrink:1;min-height:150px;border:1px solid #81704475;border-radius:14px;overflow:hidden;background:#152222;box-shadow:inset 0 0 25px #0009;touch-action:none;cursor:grab}
      .d20Mesa:active{cursor:grabbing}.d20Mesa canvas{display:block;width:100%;height:100%}
      #dice.fisico .d20Ayuda{color:#bdb3c5;font-size:12px;text-align:center;min-height:17px;margin:0}
      #dice.fisico .d20Resultado{display:flex;align-items:center;justify-content:center;gap:14px;min-height:46px;width:100%;text-align:center}
      #dice.fisico #d20v{font:700 38px Georgia,serif;line-height:1;color:#efdc9c;min-width:40px;text-shadow:0 2px 18px #dfb65844}
      #dice.fisico .dlabel{font-size:17px;min-height:0}#dice.fisico .defecto{text-align:center;max-width:100%;font-size:14px;min-height:20px}
      #dice.fisico .btn{width:min(300px,100%);min-height:44px;flex-shrink:0}#dice.fisico #d20v.pifia{color:#fb9987}
      @media(max-height:570px){#dice.fisico .dicebox{padding:10px;gap:5px}.d20Mesa{height:30vh;min-height:95px}#dice.fisico .d20Ayuda{font-size:11px}#dice.fisico .d20Resultado{min-height:36px}#dice.fisico #d20v{font-size:30px}}
    `;document.head.appendChild(s);
  }
  function pintar(canvas,pose){
    const rect=canvas.getBoundingClientRect(),W=Math.max(200,rect.width),H=Math.max(100,rect.height),dpr=Math.min(2,global.devicePixelRatio||1);
    if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const aim=[pose.p[0]*.88,.25,pose.p[2]*.88],cam=suma(aim,[.25,6,7]),forward=unidad(resta(aim,cam)),right=unidad(cruz(forward,[0,1,0])),up=cruz(right,forward),f=H*2.25;
    const proy=v=>{const p=resta(v,cam),z=punto(p,forward);return {x:W/2+punto(p,right)*f/z,y:H*.64-punto(p,up)*f/z,z};};
    const fondo=ctx.createRadialGradient(W*.5,H*.48,0,W*.5,H*.48,W*.7);fondo.addColorStop(0,'#294846');fondo.addColorStop(.55,'#172e2d');fondo.addColorStop(1,'#101a1d');ctx.fillStyle=fondo;ctx.fillRect(0,0,W,H);
    // Líneas de la mesa en coordenadas del mundo: dejan ver el recorrido real.
    ctx.lineWidth=.55;ctx.strokeStyle='#a8946221';
    for(let k=-16;k<=16;k++)for(let eje=0;eje<2;eje++){
      const a=proy(eje?[k*.6,0,-12]:[-12,0,k*.6]),b=proy(eje?[k*.6,0,12]:[12,0,k*.6]);
      if(a.z<=.2||b.z<=.2)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    const centro=proy([pose.p[0],.001,pose.p[2]]),sx=proy([pose.p[0]+.6,.001,pose.p[2]]),sz=proy([pose.p[0],.001,pose.p[2]+.6]);
    ctx.save();ctx.translate(centro.x,centro.y);ctx.transform(sx.x-centro.x,sx.y-centro.y,sz.x-centro.x,sz.y-centro.y,0,0);
    const sombra=ctx.createRadialGradient(0,0,0,0,0,1.4+pose.p[1]*.2);sombra.addColorStop(0,`rgba(0,0,0,${Math.max(.1,.48-pose.p[1]*.12)})`);sombra.addColorStop(1,'transparent');ctx.fillStyle=sombra;ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();ctx.restore();
    const verts=F.vertices.map(v=>suma(pose.p,F.girar(v,pose.q))),vistos=F.caras.map(c=>{const n=F.girar(c.n,pose.q),centro=por(c.ids.reduce((a,i)=>suma(a,verts[i]),[0,0,0]),1/3);return {c,n,centro,z:proy(centro).z};}).filter(c=>punto(c.n,resta(cam,c.centro))>0).sort((a,b)=>b.z-a.z);
    for(const o of vistos){
      const ps=o.c.ids.map(i=>proy(verts[i])),luz=Math.max(0,punto(o.n,unidad([-.5,1,.6]))),r=Math.round(75+luz*99),g=Math.round(22+luz*26),b=Math.round(35+luz*33);
      ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fill();ctx.lineWidth=1.15;ctx.strokeStyle=`rgba(238,199,116,${.42+luz*.4})`;ctx.stroke();
      const u=unidad(resta(F.vertices[o.c.ids[1]],F.vertices[o.c.ids[0]])),v=cruz(o.c.n,u),base=proy(o.centro),a=proy(suma(o.centro,por(F.girar(u,pose.q),.19))),b2=proy(suma(o.centro,por(F.girar(v,pose.q),-.19)));
      ctx.save();ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();ctx.translate(base.x,base.y);ctx.transform((a.x-base.x)/10,(a.y-base.y)/10,(b2.x-base.x)/10,(b2.y-base.y)/10,0,0);ctx.font='bold 14px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffedba';ctx.shadowColor='#2a0c0c';ctx.shadowOffsetY=1;ctx.fillText(String(o.c.valor),0,1);if(o.c.valor===6||o.c.valor===9){ctx.fillRect(-2,7,4,.7);}ctx.restore();
    }
    const borde=ctx.createLinearGradient(0,0,W,H);borde.addColorStop(0,'#e5c17042');borde.addColorStop(.5,'#61513130');borde.addColorStop(1,'#d1b07142');ctx.strokeStyle=borde;ctx.lineWidth=8;ctx.strokeRect(3,3,W-6,H-6);
  }
  function montar(label,meta){
    css();const ov=document.getElementById('dice'),box=document.getElementById('diceBox');
    box.replaceChildren();delete ov.dataset.d20Valor;delete ov.dataset.d20Asentado;ov.classList.add('on','fisico');
    const nodo=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;box.appendChild(n);return n;};
    nodo('div','dtop',label||'Tirada de d20');if(meta?.necesita)nodo('div','dpide','Necesitas '+meta.necesita);
    const mesa=nodo('div','d20Mesa'),canvas=document.createElement('canvas');mesa.appendChild(canvas);canvas.setAttribute('aria-label','D20 sobre la mesa');
    const ayuda=nodo('p','d20Ayuda'),resultado=nodo('div','d20Resultado'),v=document.createElement('span'),lab=document.createElement('span');v.id='d20v';v.textContent='—';lab.id='dlabel';lab.className='dlabel';resultado.append(v,lab);
    const efecto=nodo('div','defecto');efecto.id='defecto';const btn=nodo('button','btn gold','Tirar el d20');btn.id='dbtn';btn.type='button';
    return {ov,box,mesa,canvas,ayuda,v,lab,efecto,btn};
  }
  function finalizar(s,motivo){
    if(!s||s.fin)return;s.fin=true;clearTimeout(s.timer);clearInterval(s.vigila);cancelAnimationFrame(s.raf);document.removeEventListener('visibilitychange',s.oculta);
    if(sesion===s){sesion=null;s.ui?.ov.classList.remove('on','fisico');}
    s.resolver?.(motivo==='salida'?{cancelada:true}:s.impulso||F.impulsoValido());
  }
  function vigilar(s){
    s.oculta=()=>{if(document.hidden)finalizar(s);};document.addEventListener('visibilitychange',s.oculta);
    s.vigila=setInterval(()=>{if(!s.ui.ov.isConnected||!s.ui.ov.classList.contains('on')||(s.juego&&typeof G!=='undefined'&&(G!==s.juego||G.over))||!document.querySelector('#board.on'))finalizar(s,'salida');},150);
    s.timer=setTimeout(()=>finalizar(s),40000);
  }
  function preparar(label,interactive,meta){
    if(!interactive||document.hidden)return Promise.resolve(F.impulsoValido());
    finalizar(sesion);
    return new Promise(resolve=>{
      const ui=montar(label,meta),s={ui,resolver:resolve,juego:typeof G!=='undefined'?G:null,fin:false};sesion=s;vigilar(s);
      ui.ayuda.textContent='Desliza sobre la mesa para lanzar, o pulsa el botón.';
      const reposo=F.simular(2456).frames.at(-1);pintar(ui.canvas,{...reposo,p:[0,.44,.1]});
      let inicio=null;
      const lanzar=impulso=>{
        if(s.fin)return;s.fin=true;clearTimeout(s.timer);clearInterval(s.vigila);document.removeEventListener('visibilitychange',s.oculta);ui.btn.disabled=true;ui.btn.textContent='Lanzando…';ui.ayuda.textContent='';s.impulso=F.impulsoValido(impulso);sesion=null;resolve(s.impulso);
      };
      ui.btn.onclick=()=>lanzar();
      ui.mesa.onpointerdown=e=>{if(e.button!==0)return;inicio={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId};ui.mesa.setPointerCapture?.(e.pointerId);};
      ui.mesa.onpointerup=e=>{if(!inicio||inicio.id!==e.pointerId)return;const dx=e.clientX-inicio.x,dy=e.clientY-inicio.y,dt=Math.max(60,performance.now()-inicio.t),r=ui.mesa.getBoundingClientRect();inicio=null;lanzar({x:dx/r.width*2,z:dy/r.height*2,fuerza:Math.hypot(dx,dy)/dt});};
      ui.mesa.onpointercancel=()=>{inicio=null;};
    });
  }
  function mostrar(value,label,interactive,meta,datos){
    finalizar(sesion);
    if(document.hidden)return Promise.resolve();
    const tirada=datos.frames?datos:F.desempaquetar(datos);
    if(!tirada)return Promise.resolve();
    return new Promise(resolve=>{
      const ui=montar(label,meta),s={ui,resolver:resolve,juego:typeof G!=='undefined'?G:null,fin:false};sesion=s;vigilar(s);
      ui.btn.disabled=true;ui.btn.textContent='Rodando…';ui.ayuda.textContent='';
      const reducido=matchMedia('(prefers-reduced-motion: reduce)').matches,inicio=performance.now(),duracion=reducido?120:tirada.duracion*1000;
      global.CAOZ_AUDIO?.play('dice_roll');
      const mostrarResultado=()=>{
        if(s.fin||s.aterrizo)return;s.aterrizo=true;cancelAnimationFrame(s.raf);pintar(ui.canvas,tirada.frames.at(-1));global.CAOZ_AUDIO?.play('dice_land');ui.v.textContent=String(value);ui.v.className=value===1?'pifia':'';ui.lab.textContent=value===20||value===1?'¡CRÍTICO!':'';ui.lab.className='dlabel'+(value===1?' pif':'');
        ui.canvas.setAttribute('aria-label','D20 detenido: '+value);ui.ov.dataset.d20Valor=String(value);ui.ov.dataset.d20Asentado=String(tirada.asentado);
        if(meta?.ok){const bien=meta.ok(value);ui.efecto.className='defecto '+(bien?'bien':'mal');ui.efecto.textContent=(bien?'✔ ':'✘ ')+(bien?meta.siOk||'':meta.siMal||'');}
        ui.btn.disabled=false;ui.btn.textContent='Continuar →';ui.btn.onclick=()=>finalizar(s);clearTimeout(s.timer);s.timer=setTimeout(()=>finalizar(s),interactive?30000:meta?2600:1500);
      };
      const dibujar=()=>{if(s.fin)return;const tiempo=performance.now()-inicio;if(tiempo>=duracion){mostrarResultado();return;}
        let indice=0;while(indice<tirada.frames.length-2&&tirada.frames[indice+1].t<tiempo/1000)indice++;
        const a=tirada.frames[indice],b=tirada.frames[Math.min(indice+1,tirada.frames.length-1)],t=Math.max(0,Math.min(1,(tiempo/1000-a.t)/(b.t-a.t||1))),signo=punto(a.q,b.q)<0?-1:1;
        pintar(ui.canvas,{p:a.p.map((v,i)=>v+(b.p[i]-v)*t),q:unidad(a.q.map((v,i)=>v+(b.q[i]*signo-v)*t))});s.raf=requestAnimationFrame(dibujar);
      };
      // El temporizador resuelve incluso si el navegador deja de producir rAF.
      clearTimeout(s.timer);s.timer=setTimeout(mostrarResultado,duracion+50);dibujar();
    });
  }
  F.preparar=preparar;F.mostrar=mostrar;F.cancelar=()=>{finalizar(sesion,'salida');document.getElementById('dice')?.classList.remove('on','fisico');};F.pintar=pintar;
})(typeof window!=='undefined'?window:globalThis);

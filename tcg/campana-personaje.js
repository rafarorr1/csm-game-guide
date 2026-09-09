/* Personaje de campaña. La apariencia es independiente del mazo y comparte
   la misma geometría en el creador, en la mesa y durante el ascenso final. */
'use strict';
const CAMPANA_ASPECTO={
  figura:{viajero:'Viajero',guardian:'Guardián',mago:'Mago'},
  peinado:{corto:'Corto',largo:'Largo',capucha:'Capucha',sombrero:'Sombrero'},
  piel:{marfil:['Marfil','#e9c6a3'],arena:['Arena','#c68e62'],cobre:['Cobre','#97613f'],ebano:['Ébano','#5b382b'],elfica:['Élfica','#ad9cc6']},
  cabello:{oscuro:['Obsidiana','#292331'],castano:['Castaño','#69402c'],dorado:['Dorado','#d6ac57'],plata:['Plata','#d8dbe0'],rojo:['Carmesí','#913935']},
  color:{vino:['Vino','#963e4b'],azul:['Zafiro','#3b6d9d'],verde:['Bosque','#4d7653'],violeta:['Amatista','#78539b'],marfil:['Marfil','#c7b991'],noche:['Medianoche','#34384e']},
  equipo:{espada:'Espada y escudo',baston:'Bastón arcano',libro:'Grimorio'}
};
function campanaNormalizarPersonaje(d={}){
  if(!d||typeof d!=='object')d={};
  const base={version:1,nombre:'Viajero',figura:'viajero',peinado:'corto',piel:'arena',cabello:'oscuro',color:'vino',equipo:'espada'};
  if(typeof d.nombre==='string'&&d.nombre.trim())base.nombre=d.nombre.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24)||base.nombre;
  for(const k of Object.keys(CAMPANA_ASPECTO))if(Object.hasOwn(CAMPANA_ASPECTO[k],d[k]))base[k]=d[k];
  return base;
}
function campanaNombre(p){return p.personaje?campanaNormalizarPersonaje(p.personaje).nombre:LEADERS[p.lider].n;}
let campanaBorrador=null,campanaVistaPersonaje=null,campanaAltoCreador=0;
function campanaLeerBorrador(){
  if(!campanaBorrador){try{campanaBorrador=JSON.parse(localStorage.getItem(CAMPANA_CLAVE+'.creador'));}catch(_){} }
  const p=campanaBorrador||{};return campanaBorrador={personaje:campanaNormalizarPersonaje(p.personaje),lider:LEADERS[p.lider]?p.lider:'mohamed'};
}
function campanaGuardarBorrador(){try{localStorage.setItem(CAMPANA_CLAVE+'.creador',JSON.stringify(campanaBorrador));}catch(_){} }
function campanaLimpiarCreador(){if(campanaVistaPersonaje)campanaVistaPersonaje.destruir();campanaVistaPersonaje=null;}
function campanaLimpiarBorrador(){campanaBorrador=null;try{localStorage.removeItem(CAMPANA_CLAVE+'.creador');}catch(_){} }

/* Malla de resina con normales suaves. Las piezas tienen volumen y el visor
   resuelve la profundidad por píxel: una cara lejana nunca tapa otra cercana. */
function campanaGeometriaPersonaje(dato){
  const p=campanaNormalizarPersonaje(dato),caras=[],TAU=Math.PI*2;
  const piel=CAMPANA_ASPECTO.piel[p.piel][1],pelo=CAMPANA_ASPECTO.cabello[p.cabello][1],tela=CAMPANA_ASPECTO.color[p.color][1],oro='#d5b56d',metal='#aebecf',cuero='#352a2d';
  const normal=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const cruz=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const cara=(v,color,nv)=>caras.push({v,color,nv});
  function superficie(fn,color,n=28,m=12){
    const filas=Array.from({length:m+1},(_,j)=>Array.from({length:n+1},(_,i)=>fn(i/n,j/m)));
    for(let j=0;j<m;j++)for(let i=0;i<n;i++){
      const q=[filas[j][i],filas[j][i+1],filas[j+1][i+1],filas[j+1][i]];
      for(const ids of [[0,1,2],[0,2,3]]){
        const v=ids.map(k=>q[k].v);if(Math.hypot(...cruz(v[1].map((x,k)=>x-v[0][k]),v[2].map((x,k)=>x-v[0][k])))>1e-8)cara(v,color,ids.map(k=>q[k].n));
      }
    }
  }
  function esfera(x,y,z,rx,ry,rz,color,desde=-Math.PI/2,hasta=Math.PI/2){
    superficie((u,v)=>{const a=u*TAU,b=desde+(hasta-desde)*v,c=Math.cos(b),s=Math.sin(b);return{v:[x+rx*c*Math.cos(a),y+ry*s,z+rz*c*Math.sin(a)],n:normal([c*Math.cos(a)/rx,s/ry,c*Math.sin(a)/rz])};},color,Math.max(rx,ry,rz)<.025?8:Math.max(rx,ry,rz)<.095?12:24,Math.max(rx,ry,rz)<.025?4:Math.max(rx,ry,rz)<.095?6:14);
  }
  function perfil(filas,color,n=32){
    superficie((u,v)=>{const j=Math.min(filas.length-2,Math.floor(v*(filas.length-1))),t=v*(filas.length-1)-j,a=filas[j],b=filas[j+1],q=a.map((x,k)=>x+(b[k]-x)*t),ang=u*TAU,c=Math.cos(ang),s=Math.sin(ang),h=b[1]-a[1]||1;return{v:[q[0]+q[3]*c,q[1],q[2]+q[4]*s],n:normal([c/q[3],-((b[3]-a[3])*c*c/q[3]+(b[4]-a[4])*s*s/q[4])/h,s/q[4]])};},color,n,filas.length-1);
    for(const q of [filas[0],filas[filas.length-1]])cara(Array.from({length:n},(_,i)=>[q[0]+q[3]*Math.cos(i*TAU/n),q[1],q[2]+q[4]*Math.sin(i*TAU/n)]),color);
  }
  const anillo=(y,r,h,c,rz=r)=>perfil([[0,y,0,r,rz],[0,y+h,0,r,rz]],c);
  function vara(a,b,r,color,r2=r){
    const eje=normal(b.map((v,i)=>v-a[i])),u=normal(cruz(eje,Math.abs(eje[1])>.9?[1,0,0]:[0,1,0])),v=cruz(eje,u);
    superficie((s,t)=>{const ang=s*TAU,n=u.map((x,i)=>x*Math.cos(ang)+v[i]*Math.sin(ang));return{v:a.map((x,i)=>x+(b[i]-x)*t+n[i]*(r+(r2-r)*t)),n};},color,16,1);
    esfera(...a,r,r,r,color);esfera(...b,r2,r2,r2,color);
  }
  // Peana torneada, botas de cuero, rodillas y faldón con pliegues continuos.
  perfil([[0,.015,0,.44,.44],[0,.04,0,.49,.49],[0,.13,0,.49,.49],[0,.17,0,.455,.455]],'#262735',48);
  anillo(.14,.49,.022,oro);anillo(.18,.44,.035,'#687365');anillo(.205,.425,.018,'#858976');
  for(const s of [-1,1]){
    esfera(s*.145,.30,.08,.108,.095,.19,cuero);
    perfil([[s*.145,.29,.015,.09,.095],[s*.145,.50,-.025,.083,.083]],cuero);
    vara([s*.145,.45,-.025],[s*.115,.68,0],.074,'#645749');
    vara([s*.145-.05,.44,.058],[s*.145+.05,.44,.058],.013,oro);
  }
  perfil([[0,.51,0,p.figura==='mago'?.32:.27,.225],[0,.59,0,.27,.20],[0,.76,0,.23,.175],[0,.96,0,.27,.185],[0,1.10,0,.27,.175],[0,1.17,0,.16,.13]],tela);
  // La capa rodea la espalda; su borde ondulado conserva separación del cuerpo.
  superficie((u,v)=>{const a=(u-.5)*2.9,y=.43+v*.73,r=.43-v*.17,pliegue=Math.cos(u*TAU*5)*.024*(1-v),z=-(r+pliegue)*Math.cos(a)-.06;return{v:[(r+pliegue)*Math.sin(a),y+Math.cos(u*TAU*5)*.025*(1-v),z],n:normal([Math.sin(a),.23,-Math.cos(a)])};},tela,40,12);
  for(const s of [-1,1])vara([s*.43,.43,-.105],[s*.26,1.15,-.1],.016,oro);
  if(p.figura==='guardian'){
    esfera(0,.99,.026,.256,.205,.20,metal);
    esfera(0,1.02,.22,.048,.061,.022,oro);
    for(const s of [-1,1])esfera(s*.275,1.06,0,.15,.11,.185,metal);
  }else{
    for(const s of [-1,1])vara([s*.08,1.16,.10],[s*.14,.84,.162],.018,oro);
    esfera(0,1.145,.15,.038,.038,.02,'#e8cd84');
  }
  anillo(.73,.242,.055,cuero,.19);esfera(0,.757,.194,.047,.035,.018,oro);
  const manos=p.equipo==='libro'?[[-.31,.85,.36],[.31,.85,.36]]:[[-.345,.77,.18],[.37,.81,.15]];
  for(const [i,s] of [-1,1].entries()){
    const codo=[s*.335,.87,.045],mano=manos[i];
    esfera(s*.265,1.075,0,.105,.10,.115,p.figura==='guardian'?metal:tela);
    vara([s*.27,1.06,.015],codo,.081,tela,.067);
    vara(codo,mano,.068,p.figura==='guardian'?metal:tela,.052);
    esfera(...mano,.066,.066,.062,piel);
    for(let j=0;j<3;j++)vara([mano[0]-.035+j*.026,mano[1]-.024,mano[2]+.052],[mano[0]-.035+j*.026,mano[1]+.025,mano[2]+.052],.009,piel);
  }
  // Cabeza y rostro: cráneo suave, orejas, cejas, ojos y boca tallados.
  vara([0,1.12,0],[0,1.28,.012],.082,piel);
  esfera(0,1.43,.015,.235,.283,.218,piel);
  for(const s of [-1,1]){
    esfera(s*.228,1.425,.012,.047,.084,.045,piel);
    esfera(s*.079,1.463,.211,.047,.034,.015,'#ede6d6');
    esfera(s*.079,1.464,.226,.025,.028,.009,'#39434a');
    esfera(s*.077,1.465,.234,.014,.020,.005,'#12171e');
    esfera(s*.07,1.475,.239,.006,.007,.003,'#fff3d9');
    vara([s*.04,1.511,.214],[s*.121,1.513,.193],.012,pelo);
  }
  esfera(0,1.394,.228,.034,.053,.038,piel);
  vara([-.049,1.32,.211],[.049,1.32,.211],.008,'#895b54');
  // Casquete abierto: nunca atraviesa el rostro como la antigua esfera de pelo.
  if(p.peinado!=='capucha'){
    esfera(0,1.46,-.003,.242,.27,.229,pelo,.28,Math.PI/2);
    for(let i=0;i<7;i++){const x=-.175+i*.055;esfera(x,1.637-Math.abs(x)*.24,.126,.062,.065,.052,pelo);}
    if(p.peinado==='largo')for(const s of [-1,1]){
      esfera(s*.21,1.39,-.06,.078,.25,.14,pelo);
      for(let i=0;i<3;i++)vara([s*(.175+i*.024),1.53,-.13],[s*(.17+i*.028),1.16,-.12],.022,pelo);
    }
  }else{
    superficie((u,v)=>{const a=1.05+u*(TAU-2.1),b=-.6+v*2.16,c=Math.cos(b);return{v:[.29*c*Math.sin(a),1.43+.34*Math.sin(b),.03+.28*c*Math.cos(a)],n:normal([c*Math.sin(a),Math.sin(b),c*Math.cos(a)])};},tela,32,18);
    esfera(0,1.46,-.003,.238,.266,.226,pelo,.60,Math.PI/2);
    for(const s of [-1,1])for(let j=0;j<12;j++){
      const borde=b=>[s*.29*Math.cos(b)*Math.sin(1.05),1.43+.34*Math.sin(b),.03+.28*Math.cos(b)*Math.cos(1.05)];
      vara(borde(-.6+j*2.16/12),borde(-.6+(j+1)*2.16/12),.01,oro);
    }
  }
  if(p.peinado==='sombrero'){
    perfil([[0,1.65,0,.36,.30],[0,1.676,0,.37,.31],[0,1.69,0,.245,.215],[.025,1.86,0,.16,.15],[.065,2.05,0,.055,.06],[.12,2.13,.035,.009,.009]],tela);
    perfil([[0,1.70,0,.242,.21],[.01,1.755,0,.218,.195]],oro);
  }
  if(p.equipo==='espada'){
    vara([.37,.70,.15],[.37,.93,.15],.035,cuero);vara([.25,.925,.15],[.49,.925,.15],.025,oro);
    const v=[[.327,.95,.15],[.37,.95,.181],[.413,.95,.15],[.37,.95,.12],[.37,1.60,.15]];
    [[0,1,4],[1,2,4],[2,3,4],[3,0,4]].forEach(ids=>cara(ids.map(i=>v[i]),metal));
    // Escudo convexo con canto real; la estrella queda sobre la superficie.
    const borde=[[-.18,1.08],[-.57,1.08],[-.58,.74],[-.37,.51],[-.17,.74]],centro=[-.375,.85,.32];
    borde.forEach((a,i)=>{const b=borde[(i+1)%borde.length];cara([[a[0],a[1],.235],[b[0],b[1],.235],centro],tela);vara([a[0],a[1],.24],[b[0],b[1],.24],.018,oro);});
    vara([-.375,.69,.326],[-.375,1.02,.287],.015,oro);vara([-.485,.86,.29],[-.26,.86,.29],.015,oro);
  }else if(p.equipo==='baston'){
    vara([.385,.25,.145],[.385,1.76,.145],.025,'#64452f');
    for(const y of [.68,.74,1.56,1.63])esfera(.385,y,.145,.041,.018,.041,oro);
    esfera(.385,1.795,.145,.10,.145,.10,'#91dbdc');
    for(const s of [-1,1])vara([.385,1.65,.145],[.385+s*.105,1.81,.145],.018,oro);
  }else{
    const pagina=(s,y=0)=>[[0,.89+y,.24],[s*.40,1.005+y,.24],[s*.40,.885+y,.65],[0,.77+y,.65]];
    for(const s of [-1,1]){
      const a=pagina(s,-.034),b=pagina(s,0);cara(a,cuero);cara(b,'#f3dfb0');a.forEach((v,i)=>cara([v,a[(i+1)%4],b[(i+1)%4],b[i]],oro));
      for(let j=0;j<5;j++){
        const z=.31+j*.053,yy=.89-(z-.24)*.12/.41;
        vara([s*.07,yy+.025,z],[s*.32,yy+.097,z],.004,'#927247');
      }
    }
    vara([0,.89,.24],[0,.77,.65],.012,'#b8904c');
    vara([.04,.80,.61],[.04,.69,.72],.016,tela);
  }
  return caras;
}

/* Un solo contexto reutilizado para creador, mesa y retratos. Sin dependencias.
   Si WebGL no está disponible (o se pierde), se usa el mismo z-buffer en CPU. */
let campanaRaster=null;
const campanaPigmentos=new Map();
function campanaPintarMalla(destino,caras,proyectar,ancho,alto){
  if(!campanaRaster){
    const lienzo=document.createElement('canvas');let gl=null,programa=null;
    try{
      gl=lienzo.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
      if(gl){
        const shader=(tipo,src)=>{const s=gl.createShader(tipo);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Sombreado');return s;};
        programa=gl.createProgram();gl.attachShader(programa,shader(gl.VERTEX_SHADER,'attribute vec3 posicion;attribute vec3 color;varying lowp vec3 tinta;void main(){gl_Position=vec4(posicion,1.0);tinta=color;}'));
        gl.attachShader(programa,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying lowp vec3 tinta;void main(){gl_FragColor=vec4(tinta,1.0);}'));gl.linkProgram(programa);
        if(!gl.getProgramParameter(programa,gl.LINK_STATUS))throw Error('Material');
      }
    }catch(_){gl=null;}
    campanaRaster={lienzo,gl,programa,buffer:gl?gl.createBuffer():null,cpu:document.createElement('canvas')};
  }
  const r=campanaRaster,datos=[],triangulos=[],proyectados=new Map(),usarGL=r.gl&&!r.gl.isContextLost(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(ancho*dpr)),h=Math.max(1,Math.round(alto*dpr));
  for(const c of caras){
    const a=c.v[0],b=c.v[1],d=c.v[2],u=b.map((x,i)=>x-a[i]),v=d.map((x,i)=>x-a[i]),normal=c.n||[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],rgb=campanaPigmentos.get(c.color)||[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16)/255);campanaPigmentos.set(c.color,rgb);
    const vertices=c.v.map((v,i)=>{
      if(!proyectados.has(v))proyectados.set(v,proyectar(v));const p=proyectados.get(v),n=c.nv?.[i]||normal,l=Math.hypot(...n)||1,dot=(n[0]*-.42+n[1]*.78+n[2]*.47)/l;
      const brillo=.47+.51*(c.nv?Math.max(0,dot):Math.abs(dot)),luz=rgb.map(x=>Math.min(1,x*brillo+.055*Math.pow(Math.max(0,(n[1]*.62+n[2]*.78)/l),18)));
      return {x:p.x,y:p.y,z:1/Math.max(.5,p.d),luz};
    });
    for(let i=1;i<vertices.length-1;i++){
      const tri=[vertices[0],vertices[i],vertices[i+1]];if(!usarGL)triangulos.push(tri);
      for(const p of tri)datos.push(p.x/ancho*2-1,1-p.y/alto*2,1-2*p.z,...p.luz);
    }
  }
  const gl=r.gl;
  if(usarGL){
    if(r.lienzo.width!==w||r.lienzo.height!==h){r.lienzo.width=w;r.lienzo.height=h;}
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(r.programa);
    gl.bindBuffer(gl.ARRAY_BUFFER,r.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(datos),gl.DYNAMIC_DRAW);
    for(const [nombre,offset] of [['posicion',0],['color',12]]){const a=gl.getAttribLocation(r.programa,nombre);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,24,offset);}
    gl.drawArrays(gl.TRIANGLES,0,datos.length/6);destino.drawImage(r.lienzo,0,0,ancho,alto);return;
  }
  // Alternativa sin GPU: interpolar profundidad, no ordenar polígonos enteros.
  const cpu=r.cpu,c=cpu.getContext('2d');cpu.width=w;cpu.height=h;
  const imagen=c.createImageData(w,h),zeta=new Float32Array(w*h),pix=imagen.data;
  for(const tri of triangulos){
    const [a,b,d]=tri.map(p=>({...p,x:p.x*dpr,y:p.y*dpr})),det=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);if(Math.abs(det)<.001)continue;
    const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,d.x))),x1=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,d.x))),y0=Math.max(0,Math.floor(Math.min(a.y,b.y,d.y))),y1=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,d.y)));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const s=((b.y-d.y)*(x+.5-d.x)+(d.x-b.x)*(y+.5-d.y))/det,t=((d.y-a.y)*(x+.5-d.x)+(a.x-d.x)*(y+.5-d.y))/det,q=1-s-t;if(s<0||t<0||q<0)continue;
      const k=y*w+x,z=s*a.z+t*b.z+q*d.z;if(z<=zeta[k])continue;zeta[k]=z;
      for(let i=0;i<3;i++)pix[k*4+i]=Math.round(255*(s*a.luz[i]+t*b.luz[i]+q*d.luz[i]));pix[k*4+3]=255;
    }
  }
  c.putImageData(imagen,0,0);destino.drawImage(cpu,0,0,ancho,alto);
}

function campanaPintarRetrato(ctx,caras,w,h,giro=-.28){
  const co=Math.cos(giro),si=Math.sin(giro),esc=Math.min(w/1.65,h/2.38);
  const girar=v=>[v[0]*co+v[2]*si,v[1],v[2]*co-v[0]*si];
  const malla=caras.map(c=>({...c,v:c.v.map(girar),nv:c.nv?.map(girar)}));
  campanaPintarMalla(ctx,malla,v=>({x:w/2+v[0]*esc,y:h*.91-v[1]*esc+v[2]*.26*esc,d:8-v[2]-v[1]*.26}),w,h);
}
const campanaRetratos=new Map();
function campanaRetrato(personaje){
  const p=campanaNormalizarPersonaje(personaje),clave=JSON.stringify({...p,nombre:''});if(campanaRetratos.has(clave))return campanaRetratos.get(clave);
  const c=document.createElement('canvas');c.width=480;c.height=600;const ctx=c.getContext('2d');
  if(!ctx)return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125"><rect width="100" height="125" fill="#25202b"/><circle cx="50" cy="40" r="18" fill="#d1b072"/><path d="M22 108V86a28 28 0 0 1 56 0v22" fill="#987648"/></svg>');
  const luz=ctx.createRadialGradient(225,250,20,240,280,380);luz.addColorStop(0,'#6b5b48');luz.addColorStop(.55,'#302b31');luz.addColorStop(1,'#111321');ctx.fillStyle=luz;ctx.fillRect(0,0,480,600);
  ctx.strokeStyle='#d5b57444';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(240,292,171,205,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#080a1266';ctx.beginPath();ctx.ellipse(240,548,120,20,0,0,Math.PI*2);ctx.fill();campanaPintarRetrato(ctx,campanaGeometriaPersonaje(p),480,600);
  const url=c.toDataURL('image/png');if(campanaRetratos.size>=12)campanaRetratos.delete(campanaRetratos.keys().next().value);campanaRetratos.set(clave,url);return url;
}
function campanaCartaJugador(personaje,lider,lado=''){
  const p=campanaNormalizarPersonaje(personaje),c=document.createElement('div');c.className='vscard cartaJugador '+lado;
  c.innerHTML='<div class="lface"></div><div class="lname"></div><div class="larch"></div>';
  const foto=document.createElement('img');foto.src=campanaRetrato(p);foto.alt='Miniatura de '+p.nombre;foto.className='retratoJugador';c.prepend(foto);c.querySelector('.lname').textContent=p.nombre;c.querySelector('.larch').textContent='Mazo de '+LEADERS[lider].n;
  return c;
}
function campanaVestirLider(nodo,personaje,lider){
  if(!personaje)return;const p=campanaNormalizarPersonaje(personaje);nodo.classList.add('liderJugador');
  const foto=document.createElement('img');foto.src=campanaRetrato(p);foto.alt='Miniatura de '+p.nombre;
  const nombre=nodo.querySelector('.lcName,.ln');if(nombre)nombre.textContent=p.nombre;
  nodo.querySelector('.marcoDibujo')?.remove();
  const rostro=nodo.querySelector('.lrostro,.lcArt');
  if(nodo.classList.contains('leadercard')){
    // La carta de escritorio usa el mismo fondo completo y velo que los Líderes.
    const marco=document.createElement('div');marco.className='marcoDibujo';foto.className='dibujo';marco.appendChild(foto);nodo.prepend(marco);nodo.classList.add('conarte');
    if(rostro)rostro.style.removeProperty('visibility');
  }else{
    if(rostro){rostro.replaceChildren(foto);rostro.style.visibility='visible';}
    nodo.classList.remove('conarte');
  }
  const ep=nodo.querySelector('.lcEp');if(ep)ep.textContent='Mazo de '+LEADERS[lider].n;
}
function campanaVestirFicha(nodo,side){
  if(side!==ME||!G.campana?.personaje)return;
  const p=campanaNormalizarPersonaje(G.campana.personaje),foto=document.createElement('img');foto.src=campanaRetrato(p);foto.alt='Miniatura de '+p.nombre;
  nodo.classList.add('fichaJugador');nodo.querySelector('.nm').textContent=p.nombre;
  const art=nodo.querySelector('.art');art.replaceChildren(foto);art.classList.remove('conarte');art.removeAttribute('style');
  nodo.querySelector('.tribe').textContent='Mazo de '+P(side).L.n+' · '+P(side).L.arch;
  const historia=nodo.querySelector('.txt[style]');if(historia)historia.textContent='Tu personaje conserva las habilidades del mazo de '+P(side).L.n+'.';
}

function campanaPrevisualizar(contenedor,dato){
  const canvas=document.createElement('canvas');canvas.className='creadorLienzo';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Vista previa de tu miniatura');contenedor.appendChild(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return {actualizar(){},destruir(){canvas.remove();}};
  let caras=campanaGeometriaPersonaje(dato),raf=0,vivo=true,ultimo=0;
  function pintar(t=0){
    const w=contenedor.clientWidth,h=contenedor.clientHeight;if(!w||!h)return;
    const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const giro=matchMedia('(prefers-reduced-motion:reduce)').matches?-.28:-.28+Math.sin(t*.00045)*.18;
    campanaPintarRetrato(ctx,caras,w,h,giro);
  }
  const observador=new ResizeObserver(()=>pintar(performance.now()));observador.observe(contenedor);
  function cuadro(t){if(!vivo)return;if(!document.hidden&&t-ultimo>50&&!matchMedia('(prefers-reduced-motion:reduce)').matches){ultimo=t;pintar(t);}raf=requestAnimationFrame(cuadro);}
  pintar();raf=requestAnimationFrame(cuadro);
  return {actualizar(p){caras=campanaGeometriaPersonaje(p);pintar(performance.now());},destruir(){vivo=false;cancelAnimationFrame(raf);observador.disconnect();canvas.remove();}};
}

function campanaCrear(){
  campanaAltoCreador=window.visualViewport?visualViewport.height:innerHeight;
  const borrador=campanaLeerBorrador(),p=borrador.personaje,d=campanaDialogo();campanaCabecera(d,'Dale vida a tu héroe','Una miniatura propia. Una historia en el Domo.');d.dataset.vista='creador';
  d.querySelector('.campanaSello').textContent='1 / 2 · TU MINIATURA';
  const cuerpo=document.createElement('div');cuerpo.className='creadorCuerpo';
  const vista=document.createElement('div');vista.className='creadorVista';vista.innerHTML='<div class="creadorOrbita" aria-hidden="true"></div><span class="creadorMarca">FORJADO EN EL DOMO</span>';
  const controles=document.createElement('div');controles.className='creadorControles';
  const etiqueta=document.createElement('label');etiqueta.className='creadorNombre';etiqueta.textContent='NOMBRE DE TU HÉROE';
  const nombre=document.createElement('input');nombre.id='creadorNombre';nombre.maxLength=24;nombre.value=p.nombre;nombre.autocomplete='off';nombre.spellcheck=false;etiqueta.appendChild(nombre);
  const guardar=()=>{campanaGuardarBorrador();if(campanaVistaPersonaje)campanaVistaPersonaje.actualizar(p);};
  nombre.addEventListener('input',()=>{p.nombre=nombre.value;campanaGuardarBorrador();nombre.setCustomValidity('');});
  nombre.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nombre.blur();}});
  const tabs=document.createElement('nav');tabs.className='creadorTabs';tabs.setAttribute('aria-label','Personalizar miniatura');
  const opciones=document.createElement('div');opciones.className='creadorOpciones';
  function categoria(k){
    opciones.dataset.grupo=k;
    tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoria===k)));opciones.replaceChildren();
    const grupos=k==='figura'?[['figura','Figura'],['peinado','Peinado']]:k==='colores'?[['piel','Piel'],['cabello','Cabello'],['color','Capa']]:[['equipo','Equipo']];
    for(const [campo,titulo] of grupos){const grupo=document.createElement('fieldset'),leyenda=document.createElement('legend');leyenda.textContent=titulo;grupo.appendChild(leyenda);
      for(const [valor,def] of Object.entries(CAMPANA_ASPECTO[campo])){const color=Array.isArray(def),b=campanaBoton(color?'':def,()=>{p[campo]=valor;guardar();grupo.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});b.className=color?'creadorColor':'creadorOpcion';b.dataset.campo=campo;b.dataset.valor=valor;b.setAttribute('aria-label',titulo+': '+(color?def[0]:def));b.title=color?def[0]:def;b.setAttribute('aria-pressed',String(p[campo]===valor));if(color)b.style.setProperty('--muestra',def[1]);grupo.appendChild(b);}
      opciones.appendChild(grupo);
    }
  }
  for(const [id,titulo] of [['figura','Figura'],['colores','Colores'],['equipo','Equipo']]){const b=campanaBoton(titulo,()=>categoria(id));b.dataset.categoria=id;tabs.appendChild(b);}
  controles.append(etiqueta,tabs,opciones);cuerpo.append(vista,controles);
  const siguiente=campanaBoton('Continuar · Elegir mazo',()=>{if(!nombre.value.trim()){nombre.setCustomValidity('Dale un nombre a tu héroe.');nombre.reportValidity();return;}borrador.personaje=campanaNormalizarPersonaje(p);campanaGuardarBorrador();campanaElegir();campanaAnimarEntrada();},true);siguiente.dataset.creadorContinuar='1';
  d.append(cuerpo,campanaAcciones(siguiente,campanaBoton('Menú principal',campanaVolverAlMenu)));categoria('figura');campanaVistaPersonaje=campanaPrevisualizar(vista,p);
}

{
  const css=document.createElement('style');css.textContent=`
  .cartaJugador{background:linear-gradient(145deg,#776043,#17131d 55%);border-color:#d9bb79}
  .vscard.cartaJugador{isolation:isolate}
  .vscard.cartaJugador>.retratoJugador{position:absolute;inset:0;z-index:0;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 36%;pointer-events:none}
  .vscard.cartaJugador::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,transparent 45%,#100c1866 65%,#100c18ed 100%)}
  .vscard.cartaJugador .lface{position:relative;overflow:hidden;background:none;filter:none}
  .vscard.cartaJugador .lface::after{display:none}
  .vscard.cartaJugador .lname,.vscard.cartaJugador .larch{z-index:2;background:none;text-shadow:0 2px 6px #000}
  .vscard.cartaJugador .larch{position:relative}
  .cartaJugador .lname{overflow-wrap:anywhere;text-align:center}
  .vs .cartaJugador .larch,.fin .cartaJugador .larch,.cartaJugador .larch{color:#e4c98f;text-align:center}
  #campanaPanel .campanaIdentidad{position:absolute;inset:12px 12px auto auto;left:auto;top:12px;translate:none;transform:none;rotate:3deg;width:clamp(68px,12vw,114px);height:auto;display:flex;flex-direction:column;gap:0;z-index:3;overflow:hidden;border:1px solid #cfb778;border-radius:8px;box-shadow:0 5px 15px #0006;pointer-events:none;opacity:1}
  #campanaPanel .campanaIdentidad .lface{width:100%;height:auto;aspect-ratio:4/5;margin:0;border:0;border-radius:0;font-size:0}
  #campanaPanel .campanaIdentidad .lname{position:static;inset:auto;margin:0;padding:4px 3px 2px;font:700 clamp(9px,1.2vw,14px)/1.1 var(--serif);color:#ffdf9e;background:none}
  #campanaPanel .campanaIdentidad .larch{margin:0;padding:2px 2px 5px;font:7px/1.2 var(--sans);letter-spacing:.3px;background:none}
  .leadercard.liderJugador .marcoDibujo img{width:100%;height:100%;object-fit:cover;object-position:50% 36%;transform:none}
  .liderJugador .lrostro img{object-position:50% 24%;transform:scale(1.4);transform-origin:50% 27%}
  .liderJugador .lcName,.liderJugador .ln{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .liderJugador.lider>div:last-child{min-width:0;max-width:108px}
  .fichaJugador .art{position:relative;overflow:hidden;font-size:0!important}
  .fichaJugador .art>img{display:block;width:100%;height:100%;object-fit:contain}
  @media(max-height:500px){#campanaPanel .campanaIdentidad{width:60px;top:8px;right:8px}.campanaIdentidad .larch{display:none}}
  #campanaPanel[data-vista="creador"]{width:min(940px,calc(100vw - 24px));height:min(740px,var(--alto-util))}
  .creadorCuerpo{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1.12fr;gap:24px}
  .creadorVista{position:relative;min-height:0;overflow:hidden;border:1px solid #c59f5550;border-radius:15px;background:radial-gradient(ellipse at 50% 65%,#ba96513b,transparent 58%),linear-gradient(#1d1420,#151416);isolation:isolate}
  .creadorLienzo{position:absolute;inset:0;width:100%;height:100%}.creadorOrbita{position:absolute;width:75%;aspect-ratio:1;left:12.5%;top:15%;border:1px solid #d4b57333;border-radius:50%;box-shadow:0 0 0 18px #c6a65c08,0 0 0 19px #c6a65c19;rotate:-20deg}
  .creadorMarca{position:absolute;top:15px;left:0;right:0;text-align:center;font:8px var(--sans);letter-spacing:3px;color:#c7ab71}
  .creadorControles{display:flex;flex-direction:column;justify-content:center;gap:18px;min-width:0;text-align:left}
  .creadorNombre{display:flex;flex-direction:column;gap:8px;font:700 10px var(--sans);letter-spacing:1.5px;color:#c9aa78}
  .creadorNombre input{box-sizing:border-box;min-width:0;width:100%;height:44px;padding:8px 12px;border:1px solid #bda06d70;border-radius:8px;background:#130f12;color:#f3dfb5;font:18px var(--serif);letter-spacing:.3px}
  .creadorTabs{display:flex;gap:6px}.creadorTabs .btn{flex:1;min-width:0;margin:0;padding:8px 6px;min-height:40px;font:12px var(--sans)}
  #campanaPanel .creadorTabs [aria-pressed="true"]{background:#c9a66a;color:#201710;border-color:#ffe0a1}
  .creadorOpciones{min-height:176px}.creadorOpciones fieldset{margin:0 0 14px;padding:0;border:0;display:flex;flex-wrap:wrap;gap:7px}.creadorOpciones legend{margin-bottom:8px;color:#c9b397;font:11px var(--sans)}
  .creadorOpcion{min-height:40px;padding:7px 12px;border:1px solid #b397634d;border-radius:7px;background:#161114;color:#d2c0a4;font:12px var(--sans);cursor:pointer}
  .creadorOpcion[aria-pressed="true"]{border-color:#ecc989;box-shadow:inset 0 0 0 1px #ecc989;color:#ffe4ac;background:#51402a}
  .creadorColor{position:relative;width:36px;height:36px;min-width:36px;padding:0;border:3px solid #251d1a;border-radius:50%;background:var(--muestra);box-shadow:0 0 0 1px #b4935944;cursor:pointer}
  .creadorColor[aria-pressed="true"]{box-shadow:0 0 0 2px #ffdb92}.creadorColor[aria-pressed="true"]::after{content:'✓';color:white;text-shadow:0 1px 3px #000;position:absolute;inset:0;display:grid;place-items:center;font:700 17px var(--sans)}
  .creadorControles button:hover{scale:1.04}.creadorControles button{transition:scale .15s}.creadorControles :focus-visible{outline:2px solid #ffe0a1;outline-offset:3px}
  @media(max-width:650px){.creadorCuerpo{grid-template-columns:1fr;grid-template-rows:minmax(110px,1fr) auto;gap:12px}.creadorControles{gap:10px}.creadorOpciones{min-height:156px}.creadorOpciones fieldset{margin-bottom:7px}.creadorOpciones legend{margin-bottom:5px}.creadorMarca{top:9px;font-size:7px}.creadorOrbita{width:38%;left:31%;top:9%}.creadorNombre{gap:5px}.creadorOpcion{padding:7px 9px}}
  @media(max-height:650px){.creadorControles{gap:7px}.creadorOpciones{min-height:130px}.creadorOpciones fieldset{margin-bottom:5px;gap:6px}.creadorOpciones legend{margin-bottom:4px}.creadorNombre input{height:36px;font-size:16px}.creadorOpcion{min-height:32px;padding:5px 8px;font-size:11px}.creadorColor{width:30px;height:30px;min-width:30px}.creadorTabs .btn{min-height:32px;padding:5px}.creadorCuerpo{gap:8px}}
  @media(min-aspect-ratio:6/5) and (max-height:650px){#campanaPanel[data-vista="creador"]{display:grid;grid-template-columns:1fr 1.12fr;grid-template-rows:auto minmax(0,1fr) auto;gap:8px 16px}.creadorCuerpo{display:contents}.creadorVista{grid-column:1;grid-row:1/4}.creadorControles{grid-column:2;grid-row:2;gap:5px;justify-content:center}.creadorOpciones{min-height:98px}.creadorNombre input{height:30px}.creadorTabs .btn{min-height:28px}.creadorOpciones legend{font-size:10px}.creadorOpcion{min-height:28px}.creadorColor{width:24px;height:24px;min-width:24px}.creadorMarca{font-size:7px}}
  @media(max-width:650px) and (max-height:650px) and (max-aspect-ratio:6/5){#campanaPanel[data-vista="creador"] .campanaSub{display:none}.creadorCuerpo{grid-template-rows:minmax(76px,1fr) auto}.creadorOpciones{min-height:108px}.creadorOpciones[data-grupo="colores"] fieldset{display:block;height:32px}.creadorOpciones[data-grupo="colores"] legend{float:left;width:44px;line-height:30px;margin:0}.creadorColor{margin-right:5px}#campanaPanel[data-vista="creador"] .campanaAcciones>.btn{grid-column:auto;font-size:12px;line-height:1.2}.creadorMarca{font-size:6px;top:6px}}
  @media(min-aspect-ratio:6/5) and (max-height:420px){#campanaPanel[data-vista="creador"] .campanaSub{display:none}#campanaPanel[data-vista="creador"] h2{font-size:20px}#campanaPanel[data-vista="creador"] .campanaAcciones>.btn{grid-column:auto;font-size:12px;line-height:1.2}.creadorControles{justify-content:flex-start}.creadorNombre{flex-direction:row;align-items:center;gap:8px;font-size:8px;letter-spacing:.8px}.creadorNombre input{width:65%;height:28px;flex:1}.creadorOpciones{min-height:88px}.creadorOpciones fieldset{display:block;min-height:26px;margin-bottom:4px}.creadorOpciones legend{float:left;width:38px;line-height:24px;margin:0}.creadorOpcion{min-height:26px;font-size:10px;padding:4px 5px;margin:0 4px 3px 0}.creadorColor{margin-right:6px}}
  #campanaPanel[data-vista="creador"].creadorTeclado{display:flex}
  #campanaPanel.creadorTeclado .creadorVista,#campanaPanel.creadorTeclado .creadorTabs,#campanaPanel.creadorTeclado .creadorOpciones{display:none}
  #campanaPanel.creadorTeclado .creadorCuerpo{display:flex;flex-direction:column;justify-content:center}
  @media(prefers-reduced-motion:reduce){.creadorControles button{transition:none}}
  `;document.head.appendChild(css);
}
function campanaTecladoCreador(){const d=document.getElementById('campanaPanel');if(d)d.classList.toggle('creadorTeclado',d.dataset.vista==='creador'&&document.activeElement?.id==='creadorNombre'&&(window.visualViewport?visualViewport.height:innerHeight)<Math.min(480,campanaAltoCreador*.78));}
document.addEventListener('focusin',campanaTecladoCreador);document.addEventListener('focusout',()=>setTimeout(campanaTecladoCreador,0));
if(window.visualViewport)visualViewport.addEventListener('resize',campanaTecladoCreador);

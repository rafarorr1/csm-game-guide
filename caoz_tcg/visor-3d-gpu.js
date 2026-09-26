/* Carta del visor 3D en WebGPU (prueba): la misma carta que visor-3d-gl.js —
   grosor real, relieve con normal map, metal y rugosidad por zona, laca,
   reflejos de un estudio procedural, luz que sigue al puntero y película
   holográfica con destellos—, con el shader traducido a WGSL. Añade lo que
   WebGPU da sin esfuerzo: antialiasing MSAA 4×, mipmaps generados en la GPU y
   filtrado anisótropo 16×. Misma interfaz que el de WebGL, pero crear() es
   asíncrono y devuelve null si el navegador no tiene WebGPU. */
'use strict';
(function(){
  const ANCHO=2.5,ALTO=3.5,RADIO=.13,GROSOR=.035,FOV=30*Math.PI/180,MUESTRAS=4;
  const EDICION={normal:{holo:.12,destellos:.25,laca:.55},foil:{holo:.7,destellos:.8,laca:.7},dorado:{holo:.55,destellos:.9,laca:.75}};

  const WGSL=`
struct U{model:mat4x4f,vista:mat4x4f,proy:mat4x4f,rot:mat4x4f,cam:vec4f,T:vec4f,B:vec4f,luzDir:vec4f,luzCol:vec4f,puntoPos:vec4f,puntoCol:vec4f,cantoCol:vec4f,p0:vec4f,p1:vec4f,p2:vec4f};
@group(0) @binding(0) var<uniform> u:U;
@group(1) @binding(0) var sm:sampler;
@group(1) @binding(1) var tColor:texture_2d<f32>;
@group(1) @binding(2) var tNormal:texture_2d<f32>;
@group(1) @binding(3) var tOrm:texture_2d<f32>;
@group(1) @binding(4) var tMascara:texture_2d<f32>;
struct VO{@builtin(position) pos:vec4f,@location(0) wpos:vec3f,@location(1) nor:vec3f,@location(2) uv:vec2f};
@vertex fn vs(@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f)->VO{
  var o:VO;let w=u.model*vec4f(p,1.);o.wpos=w.xyz;o.nor=(u.rot*vec4f(n,0.)).xyz;o.uv=uv;o.pos=u.proy*u.vista*w;return o;}
fn tono(h:f32)->vec3f{return clamp(abs(((h*6.+vec3f(0.,4.,2.))%6.)-3.)-1.,vec3f(0.),vec3f(1.));}
fn azar(q:vec2f)->f32{var p=fract(q*vec2f(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
fn estudio(r:vec3f,wpos:vec3f)->vec3f{
  var c=mix(vec3f(.09,.075,.1),vec3f(.62,.56,.6),smoothstep(-.8,.9,r.y));
  c+=vec3f(1.,.93,.8)*3.2*pow(max(0.,dot(r,normalize(vec3f(.6,.55,.58)))),18.);
  c+=vec3f(.75,.8,1.)*1.1*pow(max(0.,dot(r,normalize(vec3f(-.75,.2,.55)))),6.);
  c+=vec3f(.9,.72,.5)*.45*pow(max(0.,dot(r,normalize(vec3f(0.,-.9,.35)))),3.);
  c+=u.puntoCol.xyz*.3*pow(max(0.,dot(r,normalize(u.puntoPos.xyz-wpos))),14.);
  return c;}
fn aces(x:vec3f)->vec3f{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0.),vec3f(1.));}
fn luz(N:vec3f,V:vec3f,L:vec3f,col:vec3f,albedo:vec3f,F0:vec3f,rug:f32)->vec3f{
  let d=max(dot(N,L),0.);let H=normalize(L+V);let e=mix(700.,5.,rug);
  let s=pow(max(dot(N,H),0.),e)*(e+8.)/25.13;return col*d*(albedo+F0*s);}
@fragment fn fs(i:VO)->@location(0) vec4f{
  // Se muestrea siempre (control uniforme); el canto no usa las texturas.
  let tc=textureSample(tColor,sm,i.uv);let tn=textureSample(tNormal,sm,i.uv);let to=textureSample(tOrm,sm,i.uv);let m=textureSample(tMascara,sm,i.uv);
  let Ng=normalize(i.nor);var N=Ng;var base:vec3f;var rug=u.p1.x;var met=u.p0.w;
  if(u.p0.z>.5){base=u.cantoCol.xyz;}
  else{
    base=pow(tc.rgb,vec3f(2.2));
    var nt=tn.xyz*2.-1.;nt=vec3f(nt.xy*u.p1.y,nt.z);
    N=normalize(u.T.xyz*nt.x+u.B.xyz*nt.y+Ng*nt.z);
    if(u.p0.x>.5){rug=to.g;met=to.b;}
  }
  let V=normalize(u.cam.xyz-i.wpos);let albedo=base*(1.-met);let F0=mix(vec3f(.04),base,met);
  var c=albedo*.24;
  c+=luz(N,V,normalize(u.luzDir.xyz),u.luzCol.xyz,albedo,F0,rug);
  let Lp=u.puntoPos.xyz-i.wpos;let dp=length(Lp);c+=luz(N,V,Lp/dp,u.puntoCol.xyz/(1.+dp*dp*.06),albedo,F0,rug);
  let fr=pow(1.-max(dot(N,V),0.),5.);let F=F0+(1.-F0)*fr;
  c+=estudio(reflect(-V,N),i.wpos)*F*mix(1.,.35,rug);
  let fc=.04+.96*pow(1.-max(dot(Ng,V),0.),5.);
  c+=estudio(reflect(-V,Ng),i.wpos)*fc*u.p2.x*.6*(1.-met);
  if(u.p0.y>.5){
    let inc=vec2f(dot(V,u.T.xyz),dot(V,u.B.xyz));
    let lum=dot(base,vec3f(.3,.59,.11));
    let banda=(i.uv.x*.9+i.uv.y*1.3)*1.5+inc.x*2.8-inc.y*2.2+m.b*.35;
    let arco=mix(vec3f(1.),tono(fract(banda)),.8);
    let foil=m.r*mix(1.,.4,sqrt(lum))*(.6+.4*m.b)*clamp(length(inc)*2.4,.2,1.);
    c+=arco*foil*u.p1.z*.16;
    let g=i.uv*vec2f(64.,90.);let id=floor(g);let f=fract(g)-.5;let r=azar(id);
    let off=vec2f(azar(id+3.1),azar(id+7.7))-.5;
    let tw=pow(.5+.5*sin(r*90.+inc.x*45.+inc.y*32.+u.p2.y*1.3),28.);
    c+=vec3f(1.,.96,.88)*(1.-smoothstep(0.,.2,length(f-off*.6)))*step(.78,r)*tw*m.g*u.p1.w*1.2;
    c+=arco*u.p2.z*.12*m.r;
  }
  c=aces(c*.92);
  return vec4f(pow(c,vec3f(1./2.2)),1.);
}`;
  // Mipmaps: cada nivel se dibuja desde el anterior con un triángulo a pantalla completa.
  const WGSL_MIP=`@group(0) @binding(0) var s:sampler;@group(0) @binding(1) var t:texture_2d<f32>;
struct VO{@builtin(position) p:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->VO{let q=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:VO;o.p=vec4f(q*2.-1.,0.,1.);o.uv=vec2f(q.x,1.-q.y);return o;}
@fragment fn fs(i:VO)->@location(0) vec4f{return textureSample(t,s,i.uv);}`;

  const mat={
    identidad:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
    mult(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;},
    // Profundidad de WebGPU: de 0 a 1 (en WebGL va de −1 a 1).
    persp(fov,asp,n,f){const t=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=f/(n-f);o[11]=-1;o[14]=n*f/(n-f);return o;},
    mover(x,y,z){const o=mat.identidad();o[12]=x;o[13]=y;o[14]=z;return o;},
    escala(s){const o=mat.identidad();o[0]=o[5]=o[10]=s;return o;},
    rx(a){const c=Math.cos(a),s=Math.sin(a),o=mat.identidad();o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o;},
    ry(a){const c=Math.cos(a),s=Math.sin(a),o=mat.identidad();o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o;},
    rz(a){const c=Math.cos(a),s=Math.sin(a),o=mat.identidad();o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o;},
    aplicar(m,v){return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]];},
  };
  function contorno(){
    const p=[],seg=12,x=ANCHO/2-RADIO,y=ALTO/2-RADIO;
    for(const [cx,cy,a0] of [[x,-y,-Math.PI/2],[x,y,0],[-x,y,Math.PI/2],[-x,-y,Math.PI]])
      for(let i=0;i<=seg;i++){const a=a0+i/seg*Math.PI/2;p.push([cx+Math.cos(a)*RADIO,cy+Math.sin(a)*RADIO,Math.cos(a),Math.sin(a)]);}
    return p;
  }
  function geometria(){
    const p=contorno(),cara=(z,nz,espejo)=>{
      const v=[];const uv=(x,y)=>[espejo?1-(x/ANCHO+.5):x/ANCHO+.5,y/ALTO+.5];
      for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],tri=nz>0?[[0,0],a,b]:[[0,0],b,a];for(const q of tri)v.push(q[0],q[1],z,0,0,nz,...uv(q[0],q[1]));}
      return new Float32Array(v);
    };
    const canto=[];
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],z=GROSOR/2;
      for(const [q,zz] of [[a,z],[a,-z],[b,-z],[a,z],[b,-z],[b,z]])canto.push(q[0],q[1],zz,q[2],q[3],0,0,0);}
    return {frente:cara(GROSOR/2,1,false),dorso:cara(-GROSOR/2,-1,true),canto:new Float32Array(canto)};
  }

  async function crear(canvas){
    if(!navigator.gpu)return null;
    let adaptador,dispositivo;
    try{adaptador=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adaptador)return null;dispositivo=await adaptador.requestDevice();}catch(_){return null;}
    const ctx=canvas.getContext('webgpu');if(!ctx)return null;
    const formato=navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({device:dispositivo,format:formato,alphaMode:'premultiplied'});
    const dev=dispositivo,modulo=dev.createShaderModule({code:WGSL}),moduloMip=dev.createShaderModule({code:WGSL_MIP});
    const info=adaptador.info||{};
    const pipelineMip=dev.createRenderPipeline({layout:'auto',vertex:{module:moduloMip,entryPoint:'vs'},fragment:{module:moduloMip,entryPoint:'fs',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'}});
    const muestreo=dev.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear',maxAnisotropy:16,addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
    const muestreoMip=dev.createSampler({magFilter:'linear',minFilter:'linear'});
    const geo=geometria(),bufs={};
    for(const [k,d]of Object.entries(geo)){const b=dev.createBuffer({size:d.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});dev.queue.writeBuffer(b,0,d);bufs[k]={b,n:d.length/8};}
    // Uniformes: una ranura de 512 bytes por dibujo (desplazamiento dinámico).
    const RANURA=512,MAXDIB=18,TAM=108;
    const ubuf=dev.createBuffer({size:RANURA*MAXDIB,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const ulayout=dev.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:TAM*4}}]});
    const pipelineDin=dev.createRenderPipeline({layout:dev.createPipelineLayout({bindGroupLayouts:[ulayout,dev.createBindGroupLayout({entries:[
        {binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{}},...[1,2,3,4].map(b=>({binding:b,visibility:GPUShaderStage.FRAGMENT,texture:{}}))]})]}),
      vertex:{module:modulo,entryPoint:'vs',buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'}]}]},
      fragment:{module:modulo,entryPoint:'fs',targets:[{format:formato}]},
      primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},multisample:{count:MUESTRAS}});
    const ugrupo=dev.createBindGroup({layout:ulayout,entries:[{binding:0,resource:{buffer:ubuf,size:TAM*4}}]});
    const datos=new Float32Array(RANURA/4*MAXDIB);

    function textura(fuente){
      const w=fuente.width,h=fuente.height,niveles=Math.floor(Math.log2(Math.max(w,h)))+1;
      const t=dev.createTexture({size:[w,h],format:'rgba8unorm',mipLevelCount:niveles,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
      // La copia directa del lienzo es la vía rápida; si el navegador no la
      // consigue (algunos adaptadores), se suben los píxeles volteados a mano.
      try{dev.queue.copyExternalImageToTexture({source:fuente,flipY:true},{texture:t},[w,h]);}
      catch(_){
        const g=fuente.getContext?.('2d')||(()=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(fuente,0,0);return x;})();
        const px=g.getImageData(0,0,w,h).data,vuelta=new Uint8Array(px.length),fila=w*4;
        for(let y=0;y<h;y++)vuelta.set(px.subarray((h-1-y)*fila,(h-y)*fila),y*fila);
        dev.queue.writeTexture({texture:t},vuelta,{bytesPerRow:fila},[w,h]);
      }
      const enc=dev.createCommandEncoder();
      for(let n=1;n<niveles;n++){
        const g=dev.createBindGroup({layout:pipelineMip.getBindGroupLayout(0),entries:[{binding:0,resource:muestreoMip},{binding:1,resource:t.createView({baseMipLevel:n-1,mipLevelCount:1})}]});
        const pase=enc.beginRenderPass({colorAttachments:[{view:t.createView({baseMipLevel:n,mipLevelCount:1}),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});
        pase.setPipeline(pipelineMip);pase.setBindGroup(0,g);pase.draw(3);pase.end();
      }
      dev.queue.submit([enc.finish()]);return t;
    }
    const lisa=(()=>{const c=document.createElement('canvas');c.width=c.height=4;const g=c.getContext('2d');g.fillStyle='#8080ff';g.fillRect(0,0,4,4);return c;})();
    const negra=(()=>{const c=document.createElement('canvas');c.width=c.height=4;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,4,4);return c;})();
    let tLisa=null,tNegra=null;
    const grupo=(color,normal,orm,mascara)=>dev.createBindGroup({layout:pipelineDin.getBindGroupLayout(1),entries:[{binding:0,resource:muestreo},{binding:1,resource:color.createView()},{binding:2,resource:normal.createView()},{binding:3,resource:orm.createView()},{binding:4,resource:mascara.createView()}]});
    let frente=null,dorso=null,canto=[.7,.55,.3],edicion='normal',gCanto=null,w=1,h=1,altoCarta=400,objetivos=null,perdido=false;
    dev.lost.then(()=>{perdido=true;});
    const colorLineal=c=>{const n=parseInt(c.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(v=>Math.pow(v,2.2));};
    const liberar=o=>{if(o)for(const t of o.texturas)t.destroy();};
    function base(){tLisa||=textura(lisa);tNegra||=textura(negra);gCanto||=grupo(tNegra,tLisa,tNegra,tNegra);}
    function cargarFrente(tex,ed,colorCanto){
      base();liberar(frente);const t=[textura(tex.color),textura(tex.normal),textura(tex.orm),textura(tex.mascara)];
      frente={texturas:t,grupo:grupo(...t)};edicion=ed;if(colorCanto)canto=colorLineal(colorCanto);
    }
    function cargarDorso(tex){base();liberar(dorso);const t=[textura(tex.color),textura(tex.normal)];dorso={texturas:t,grupo:grupo(t[0],t[1],tNegra,tNegra)};}
    function medir(anchoPx,altoPx,dpr,cartaPx){
      w=anchoPx;h=altoPx;altoCarta=cartaPx;canvas.width=Math.max(1,Math.round(anchoPx*dpr));canvas.height=Math.max(1,Math.round(altoPx*dpr));
      objetivos?.color.destroy();objetivos?.prof.destroy();
      objetivos={color:dev.createTexture({size:[canvas.width,canvas.height],format:formato,sampleCount:MUESTRAS,usage:GPUTextureUsage.RENDER_ATTACHMENT}),
        prof:dev.createTexture({size:[canvas.width,canvas.height],format:'depth24plus',sampleCount:MUESTRAS,usage:GPUTextureUsage.RENDER_ATTACHMENT})};
    }
    // Rellena una ranura de uniformes: la misma lista que usa el shader de WebGL.
    function escribir(i,model,glob,cfg){
      const o=i*RANURA/4,d=datos;
      d.set(model,o);d.set(glob.vista,o+16);d.set(glob.proy,o+32);d.set(model,o+48);
      d.set([...glob.cam,0],o+64);d.set([...cfg.T,0],o+68);d.set([...cfg.B,0],o+72);
      d.set([-.35,.55,.75,0],o+76);d.set([.95,.9,.84,0],o+80);d.set([...glob.puntoPos,0],o+84);d.set([...glob.puntoCol,0],o+88);d.set([...canto,0],o+92);
      d.set([cfg.usaOrm,cfg.usaMascara,cfg.canto,cfg.metal],o+96);d.set([cfg.rugosidad,cfg.relieve,cfg.holo,cfg.destellos],o+100);d.set([cfg.laca,glob.tiempo,glob.pulso,0],o+104);
    }
    function dibujar(e,destino){
      if(!frente||!dorso||!objetivos||perdido)return false;
      const dist=ALTO*h/(altoCarta*2*Math.tan(FOV/2));
      const glob={vista:mat.mover(0,0,-dist),proy:mat.persp(FOV,w/h,.1,dist*4),cam:[0,0,dist],puntoPos:[1.7+e.luzX*2.2,1.7-e.luzY*1.8,2.6],puntoCol:[2.2+e.pulso*4,2.+e.pulso*4,1.75+e.pulso*3],tiempo:e.tiempo,pulso:e.pulso};
      const px=ALTO/altoCarta,ed=EDICION[edicion]||EDICION.normal;
      const baseM=mat.mult(mat.mult(mat.mult(mat.mult(mat.mover(0,-e.y*px,0),mat.escala(e.s)),mat.rx(-e.rx)),mat.ry(e.ry)),mat.rz(-e.rz));
      const cartas=[];for(let i=Math.min(4,e.pila||0);i>=1;i--)cartas.push([mat.mult(baseM,mat.mult(mat.mover(i*.045,-i*.035,-i*(GROSOR+.03)),mat.rz((i%2?1:-1)*(.012+i*.008)))),false]);
      cartas.push([baseM,true]);
      const dibujos=[];let ranura=0;
      for(const [m,conFrente]of cartas){
        escribir(ranura,m,glob,{T:[0,0,0],B:[0,0,0],usaOrm:0,usaMascara:0,canto:1,metal:.9,rugosidad:.32,relieve:0,holo:0,destellos:0,laca:0});dibujos.push([ranura++,gCanto,bufs.canto]);
        escribir(ranura,m,glob,{T:mat.aplicar(m,[-1,0,0]),B:mat.aplicar(m,[0,1,0]),usaOrm:0,usaMascara:0,canto:0,metal:.3,rugosidad:.42,relieve:.6,holo:0,destellos:0,laca:.6});dibujos.push([ranura++,dorso.grupo,bufs.dorso]);
        escribir(ranura,m,glob,{T:mat.aplicar(m,[1,0,0]),B:mat.aplicar(m,[0,1,0]),usaOrm:1,usaMascara:conFrente?1:0,canto:0,metal:0,rugosidad:.5,relieve:.9,holo:ed.holo,destellos:ed.destellos,laca:ed.laca});dibujos.push([ranura++,frente.grupo,bufs.frente]);
      }
      dev.queue.writeBuffer(ubuf,0,datos,0,ranura*RANURA/4);
      const enc=dev.createCommandEncoder();
      const pase=enc.beginRenderPass({colorAttachments:[{view:objetivos.color.createView(),resolveTarget:(destino||ctx.getCurrentTexture()).createView(),loadOp:'clear',storeOp:'discard',clearValue:[0,0,0,0]}],
        depthStencilAttachment:{view:objetivos.prof.createView(),depthLoadOp:'clear',depthStoreOp:'discard',depthClearValue:1}});
      pase.setPipeline(pipelineDin);
      for(const [r,g,b]of dibujos){pase.setBindGroup(0,ugrupo,[r*RANURA]);pase.setBindGroup(1,g);pase.setVertexBuffer(0,b.b);pase.draw(b.n);}
      pase.end();
      if(destino)enc.copyTextureToBuffer({texture:destino},{buffer:destino.lectura,bytesPerRow:destino.fila},[destino.width,destino.height]);
      dev.queue.submit([enc.finish()]);return true;
    }
    /* capturar(e): el mismo fotograma, pero dibujado en una textura propia y
       leído de vuelta (RGBA, de arriba abajo). Sirve para comparar con WebGL
       y para las pruebas, sin depender de cómo se presenta el lienzo. */
    async function capturar(e){
      if(!objetivos)return null;
      const W=canvas.width,H=canvas.height,fila=Math.ceil(W*4/256)*256;
      const t=dev.createTexture({size:[W,H],format:formato,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
      t.lectura=dev.createBuffer({size:fila*H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});t.fila=fila;
      try{
        if(!dibujar(e,t))return null;
        await t.lectura.mapAsync(GPUMapMode.READ);
        const bruto=new Uint8Array(t.lectura.getMappedRange()),datos=new Uint8ClampedArray(W*H*4),bgra=formato.startsWith('bgra');
        for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=y*fila+x*4,d=(y*W+x)*4;datos[d]=bruto[o+(bgra?2:0)];datos[d+1]=bruto[o+1];datos[d+2]=bruto[o+(bgra?0:2)];datos[d+3]=bruto[o+3];}
        t.lectura.unmap();return {ancho:W,alto:H,datos};
      }finally{t.lectura.destroy();t.destroy();}
    }
    function destruir(){liberar(frente);liberar(dorso);tLisa?.destroy();tNegra?.destroy();objetivos?.color.destroy();objetivos?.prof.destroy();for(const b of Object.values(bufs))b.b.destroy();ubuf.destroy();try{ctx.unconfigure();}catch(_){}dev.destroy();}
    return {cargarFrente,cargarDorso,medir,dibujar,capturar,destruir,listo:()=>!!(frente&&dorso),adaptador:[info.vendor,info.architecture,info.description].filter(Boolean).join(' · ')||'WebGPU',muestras:MUESTRAS};
  }
  window.CAOZ_VISOR3D_GPU=Object.freeze({crear});
})();

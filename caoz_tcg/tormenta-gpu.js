/* Tormenta para la prueba del visor (WebGPU): la misma escena que
   tormenta-gl.js —cielo de nubes, tres cordilleras con niebla, rayo y lluvia
   en 3D delante de la carta—, traducida a WGSL y dibujada en el mismo pase
   MSAA que la carta. Aquí las gotas no necesitan búfer de vértices: cada una
   sale del número de vértice (vertex_index). */
'use strict';
(function(){
  const MAXGOTAS=160000;
  const WGSL=`
struct U{vista:mat4x4f,proy:mat4x4f,a:vec4f,b:vec4f,c:vec4f,d:vec4f,e:vec4f,f:vec4f};
// a: res, par · b: flashCol, t · c: flash, octavas, rayoX, rayoSem · d: rayoBri
// e: t, dist, tan, aspecto · f: alto en píxeles, viento
@group(0) @binding(0) var<uniform> u:U;
fn h11(q:f32)->f32{var p=fract(q*.1031);p*=p+33.33;p*=p+p;return fract(p);}
fn h21(p:vec2f)->f32{var q=fract(p.xyx*.1031);q=q+vec3f(dot(q,q.yzx+33.33));return fract((q.x+q.y)*q.z);}
fn r1(x:f32)->f32{let i=floor(x);var f=fract(x);f=f*f*(3.-2.*f);return mix(h11(i),h11(i+1.),f);}
fn r2(p:vec2f)->f32{let i=floor(p);var f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2f(1.,0.)),f.x),mix(h21(i+vec2f(0.,1.)),h21(i+vec2f(1.,1.)),f.x),f.y);}
fn fbm(q:vec2f)->f32{var p=q;var s=0.;var a=.5;var n=0.;
  for(var i=0;i<8;i++){if(f32(i)>=u.c.y){break;}s+=a*r2(p);n+=a;p=mat2x2f(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s/n;}
fn cresta(x:f32)->f32{var s=0.;var a=.5;var f=1.;for(var i=0;i<5;i++){s+=a*(1.-abs(r1(x*f)*2.-1.));f*=2.1;a*=.48;}return s;}
fn desv(y:f32,s:f32)->f32{return (r1(y*7.+s)-.5)*.14+(r1(y*17.+s*1.7)-.5)*.06+(r1(y*41.+s*2.3)-.5)*.026+(r1(y*97.+s*3.1)-.5)*.011;}
fn trazo(d:f32,px:f32)->f32{return exp(-d*d/(px*px*2.2))*1.6+exp(-d*55.)*.3;}
fn rayo(p:vec2f,x0:f32,s:f32,px:f32)->f32{
  let y0=.62;let y1=-.12;if(p.y>y0||p.y<y1){return 0.;}
  var c=trazo(abs(p.x-(x0+desv(p.y,s))),px*1.4)*smoothstep(y1,y1+.03,p.y);
  for(var i=0;i<3;i++){let k=f32(i);let a=h11(s*3.7+k*1.9);let b=h11(s*5.3+k*2.9);
    let ys=y0-(.12+.45*a)*(y0-y1);let ye=ys-.1-.22*b;let inc=(b-.5)*1.4+(a-.5)*.4;
    if(p.y<=ys&&p.y>=ye){let x=x0+desv(ys,s)+desv(p.y,s+k*7.+3.)-desv(ys,s+k*7.+3.)+(ys-p.y)*inc;
      c+=trazo(abs(p.x-x),px)*.55*smoothstep(ye,ys,p.y);}}
  return c;
}
fn monte(c:vec3f,p:vec2f,base:f32,alto:f32,esc:f32,sem:f32,par:f32,col:vec3f,luz:f32,g0:f32,px:f32)->vec3f{
  let y=base+cresta(p.x*esc+sem+u.a.z*par)*alto;
  let dentro=1.-smoothstep(y-px,y+px,p.y);
  let F=u.c.x;let fc=u.b.xyz;
  var m=col+fc*F*luz*(.25+g0)*smoothstep(y-.35,y,p.y);
  m+=fc*F*luz*1.2*(g0+.2)*(1.-smoothstep(0.,.012,y-p.y));
  return mix(c,m,dentro);
}
@vertex fn vsCielo(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{
  var q=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));return vec4f(q[i],0.,1.);}
@fragment fn fsCielo(@builtin(position) fc:vec4f)->@location(0) vec4f{
  // WebGPU cuenta los píxeles desde arriba; WebGL, desde abajo.
  let res=u.a.xy;let uv=vec2f(fc.x/res.x,1.-fc.y/res.y);let asp=res.x/res.y;let px=1./res.y;let t=u.b.w;
  let p=vec2f((uv.x-.5)*asp,uv.y-.5);let q=p+u.a.zw*.015;
  let F=u.c.x;let fcol=u.b.xyz;let xr=sign(u.c.z)*mix(.34,max(.36,asp*.5-.06),abs(u.c.z));let alto=vec2f(xr,.55);
  let g0=exp(-length((p-alto)*vec2f(1.,1.5))*2.4);
  var c=mix(vec3f(.16,.17,.19),vec3f(.025,.029,.04),smoothstep(-.15,.45,p.y));
  c+=fcol*F*(.1+.6*g0);
  let np=q*vec2f(1.7,3.3)+vec2f(t*.03,0.);
  let n=fbm(np);let n2=fbm(np+vec2f(.08,.3));
  let dens=smoothstep(.36,.7,n)*smoothstep(-.18,.12,p.y);
  let borde=clamp((n-n2)*3.+.5,0.,1.);
  var nube=mix(vec3f(.03,.032,.04),vec3f(.12,.125,.14),borde);
  nube+=fcol*F*(.2+1.6*g0)*(.35+.65*borde)*(.5+n);
  c=mix(c,nube,dens);
  let cort=r2(vec2f(p.x*9.+p.y*1.5,p.y*1.2+t*.7))*r2(vec2f(p.x*70.+p.y*10.,p.y*3.+t*6.));
  c+=(vec3f(.09,.1,.12)+fcol*F*.3)*cort*.6*(1.-smoothstep(-.3,.45,p.y));
  if(u.d.x>0.){c+=vec3f(.82,.88,1.)*rayo(q,xr,u.c.w,px)*u.d.x;}
  c=monte(c,p,-.15,.34,1.3,3.,.02,vec3f(.06,.066,.08),.9,g0,px);
  c=mix(c,vec3f(.09,.1,.12)+fcol*F*.15,fbm(p*vec2f(2.,7.)+vec2f(t*.04,3.))*.55*(1.-smoothstep(-.32,-.12,p.y)));
  c=monte(c,p,-.3,.3,2.,11.,.05,vec3f(.032,.036,.045),.55,g0,px);
  c=monte(c,p,-.46,.26,2.9,23.,.1,vec3f(.014,.016,.021),.25,g0,px);
  c+=(vec3f(.07,.075,.085)+fcol*F*.08)*fbm(p*vec2f(3.,9.)+vec2f(t*.06,7.))*(1.-smoothstep(-.5,-.25,p.y));
  let v=uv-.5;c*=1.-.55*dot(v,v);
  return vec4f(clamp(c,vec3f(0.),vec3f(1.)),1.);
}
struct VG{@builtin(position) pos:vec4f,@location(0) lado:f32,@location(1) largo:f32,@location(2) brillo:f32};
@vertex fn vsLluvia(@builtin(vertex_index) vi:u32)->VG{
  var esq=array<vec2f,6>(vec2f(-1.,0.),vec2f(1.,0.),vec2f(1.,1.),vec2f(-1.,0.),vec2f(1.,1.),vec2f(-1.,1.));
  let id=f32(vi/6u);let k=esq[vi%6u];
  let T=u.e.x;let dist=u.e.y;let tn=u.e.z;let asp=u.e.w;let viento=u.f.y;
  let a=h11(id*1.31+.17);let b=h11(id*2.77+.31);let c=h11(id*4.13+.71);let d=h11(id*5.91+.93);
  let z=mix(-9.,dist-1.2,a);let prof=dist-z;let hh=prof*tn*1.15;let hw=hh*asp*1.1;
  let vel=13.+6.*c;let m=T*vel+d*2.*hh;let y=hh-(m-2.*hh*floor(m/(2.*hh)));
  let dir=normalize(vec3f(viento,-1.,0.));var pos=vec3f((b*2.-1.)*hw-y*viento,y,z);
  let lado=normalize(cross(dir,normalize(vec3f(0.,0.,dist)-pos)));
  let ancho=2.*prof*tn/u.f.x*.9+.0012;
  pos-=dir*vel*.02*k.y;pos+=lado*ancho*k.x;
  var o:VG;o.lado=k.x;o.largo=k.y;o.brillo=smoothstep(1.,4.,prof)/(1.+prof*.08);
  o.pos=u.proy*u.vista*vec4f(pos,1.);return o;
}
@fragment fn fsLluvia(i:VG)->@location(0) vec4f{
  var a=1.-abs(i.lado);a*=a*(1.-.75*i.largo)*i.brillo;
  return vec4f((vec3f(.5,.56,.66)*.085+u.b.xyz*u.c.x*.16)*a,0.);
}`;

  function iniciar(dev,{formato,muestras}){
    const modulo=dev.createShaderModule({code:WGSL});
    const layout=dev.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
    const pl=dev.createPipelineLayout({bindGroupLayouts:[layout]}),multisample={count:muestras};
    const cielo=dev.createRenderPipeline({layout:pl,vertex:{module:modulo,entryPoint:'vsCielo'},fragment:{module:modulo,entryPoint:'fsCielo',targets:[{format:formato}]},
      primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'always'},multisample});
    // Suma de luz (como en WebGL): el alfa del lienzo queda como estaba.
    const lluvia=dev.createRenderPipeline({layout:pl,vertex:{module:modulo,entryPoint:'vsLluvia'},
      fragment:{module:modulo,entryPoint:'fsLluvia',targets:[{format:formato,blend:{color:{srcFactor:'one',dstFactor:'one',operation:'add'},alpha:{srcFactor:'zero',dstFactor:'one',operation:'add'}}}]},
      primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less'},multisample});
    const ubuf=dev.createBuffer({size:224,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const grupo=dev.createBindGroup({layout,entries:[{binding:0,resource:{buffer:ubuf}}]});
    const d=new Float32Array(56);
    const activa=e=>e.tormenta>0;
    const gotas=e=>Math.min(MAXGOTAS,Math.max(0,Math.round(e.cielo?.gotas||0)));
    return {
      actualizar(e,info){
        if(!activa(e))return;const c=e.cielo||{},par=c.par||[0,0],fc=c.flashCol||[.8,.86,1];
        d.set(info.vista,0);d.set(info.proy,16);
        d.set([info.anchoPx,info.altoPx,par[0],par[1]],32);d.set([fc[0],fc[1],fc[2],e.tiempo],36);
        d.set([c.flash||0,c.octavas||6,c.rayoX||0,c.rayoSem||0],40);d.set([c.rayoBri||0,0,0,0],44);
        d.set([e.tiempo,info.dist,Math.tan(info.fov/2),info.w/info.h],48);d.set([info.altoPx,c.viento??.18,0,0],52);
        dev.queue.writeBuffer(ubuf,0,d);
      },
      fondo(pase,e){if(!activa(e))return;pase.setPipeline(cielo);pase.setBindGroup(0,grupo);pase.draw(3);},
      frente(pase,e){const n=gotas(e);if(!activa(e)||!n)return;pase.setPipeline(lluvia);pase.setBindGroup(0,grupo);pase.draw(n*6);},
      destruir(){ubuf.destroy();},
    };
  }
  window.CAOZ_TORMENTA_GPU=Object.freeze({iniciar,MAXGOTAS});
})();

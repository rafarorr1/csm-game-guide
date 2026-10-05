/* Epílogo de la casa: mago, persecución en primera persona y meteorito.
   Los recursos se reservan sólo al reproducirlo; no agrega trabajo a las oleadas. */
'use strict';
(function(){
  // El corte conserva el impulso del slide. La incorporación arma el giro;
  // la búsqueda del tejado comienza desde los ojos, después de mirar a los lados.
  const RECORTE_PIES=11/60,DURACION_PIES_ORIGINAL=1.5,DURACION_SLIDE=.90,GOLPE_MAGO=1.36,ESPERA_PARTICULAS=2,VIAJE_PARTICULAS=2.6;
  const DURACIONES=Object.freeze({salida:2.6,descubrir:2.4,vertigo:2.8,pies:DURACION_PIES_ORIGINAL-RECORTE_PIES,carrera:93/60,ataquePOV:.55,desaparece:.35,levantarse:.30,tropezar:.74,buscar:1.20,voltear:ESPERA_PARTICULAS+VIAJE_PARTICULAS,techo:1.4,hechizo:3,cielo:1.7,caida:1.05,impacto:3.35,negro:1.2});
  function fabrica(T,MOD,{escena,camara,casas,entorno=null,impactar,interfaz,piso=()=>null,reducido=false,planoDeFase=f=>f,ambienteLluvia=()=>{}}){
    const V=T.Vector3,TAU=Math.PI*2,lim=x=>Math.max(0,Math.min(1,x)),suave=x=>{x=lim(x);return x*x*(3-2*x);};
    const actuacion=window.CAOZ_ARPG_ADREIDA_CINE.fabrica(T,MOD),POV=['carrera','ataquePOV','voltear','techo','hechizo','cielo'];
    const centro=new V(0,0,0),destino=new V(0,0,3.5),techo=new V(),cielo=new V(),desdeCamara=new V(),giroPaneo=new T.Quaternion(),finPaneo=new T.Quaternion(),objeto=new T.Object3D();
    const camBase={fov:camara.fov,near:camara.near},derrumbe={value:-1},centroOnda={value:new V()},tiempoPiso={value:-1};let s=null,recursos=null,visitadas=[],sombras=[],mallasRuina=[],terminado=false,nodosCine=null;
    const rumbo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),angulo=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
    function material(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.86,metalness:0,...extra});}
    function prepararLosas(grupo){
      const radio=8.4,azar=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);},semillas=[],contorno=[];
      // La misma silueta del recorte del suelo, cubierta por completo antes de ceder.
      // Voronoi se calcula una sola vez: las juntas comparten vértices exactos.
      for(let i=0;i<192;i++){const a=i/192*TAU,r=radio*(1+.055*Math.sin(a*7)+.035*Math.cos(a*11))*1.003;contorno.push([Math.cos(a)*r,Math.sin(a)*r]);}
      for(let z=-7;z<=7;z++)for(let x=-7;x<=7;x++){
        const px=x*1.48+(azar(x,z)-.5)*.74,pz=z*1.48+(azar(z+31,x-8)-.5)*.74;
        if(Math.hypot(px,pz)<radio*1.21)semillas.push([px,pz]);
      }
      function recortar(poly,nx,nz,d){const r=[];for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*nz-d,db=b[0]*nx+b[1]*nz-d;
        if(da<=1e-9)r.push(a);if((da<0)!==(db<0)){const k=da/(da-db);r.push([a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]);}
      }return r;}
      const P=[],N=[],C=[],U=[],A=[],losas=[];
      function cara(a,b,c,color,losa){const u=new V().subVectors(b,a),v=new V().subVectors(c,a),n=u.cross(v).normalize();for(const p of [a,b,c]){P.push(p.x,p.y,p.z);N.push(n.x,n.y,n.z);C.push(color,color,color);U.push(0,0);A.push(losa.centro[0],losa.centro[2],losa.demora,losa.semilla);}}
      for(let i=0;i<semillas.length;i++){
        const q=semillas[i];let poly=contorno;
        for(let j=0;j<semillas.length&&poly.length>=3;j++)if(i!==j){const b=semillas[j];poly=recortar(poly,b[0]-q[0],b[1]-q[1],(b[0]*b[0]+b[1]*b[1]-q[0]*q[0]-q[1]*q[1])/2);}
        if(poly.length<3)continue;
        let area=0,cx=0,cz=0;for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],c=a[0]*b[1]-b[0]*a[1];area+=c;cx+=(a[0]+b[0])*c;cz+=(a[1]+b[1])*c;}
        if(Math.abs(area)<1e-5)continue;cx/=3*area;cz/=3*area;
        const semilla=azar(i+3,i*2-9),distancia=Math.hypot(cx,cz),grosor=.28+semilla*.42;
        const losa={centro:[cx,.028,cz],demora:Math.max(0,distancia-1.15)/radio*.70+semilla*.065,grosor,semilla,area:Math.abs(area/2),contorno:poly};
        losas.push(losa);const alturaInferior=.028-grosor;
        // El borde irregular de la sima puede dejar una celda cóncava: un abanico
        // desde su centroide cruzaría la junta e invertiría algunas tapas.
        const tapas=T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(p[0],p[1])),[]);
        for(const ids of tapas){
          const [a,b,c]=ids.map(i=>new V(poly[i][0],.028,poly[i][1]));
          if(new V().subVectors(b,a).cross(new V().subVectors(c,a)).y<0){const copia=b.clone();b.copy(c);c.copy(copia);}
          cara(a,b,c,1,losa);cara(a.clone().setY(alturaInferior),c.clone().setY(alturaInferior),b.clone().setY(alturaInferior),.35,losa);
        }
        for(let j=0;j<poly.length;j++){
          const a=poly[j],b=poly[(j+1)%poly.length],a0=new V(a[0],.028,a[1]),b0=new V(b[0],.028,b[1]),a1=a0.clone().setY(alturaInferior),b1=b0.clone().setY(alturaInferior);
          cara(a0,b0,a1,.58,losa);cara(b0,b1,a1,.58,losa);
        }
      }
      const g=new T.BufferGeometry();for(const [nombre,datos,tam]of [['position',P,3],['normal',N,3],['color',C,3],['uv',U,2],['aLosa',A,4]])g.setAttribute(nombre,new T.Float32BufferAttribute(datos,tam));
      const mat=piso()?.clone()||material(0x656260);mat.vertexColors=true;mat.side=T.FrontSide;
      // Desplazamiento absoluto, sin acumulación: buscar atrás muestra la misma grieta.
      mat.onBeforeCompile=sh=>{
        sh.uniforms.uTiempoPiso=tiempoPiso;
        sh.vertexShader=`attribute vec4 aLosa;uniform float uTiempoPiso;
          vec3 girarLosa(vec3 p,vec3 eje,float angulo){float c=cos(angulo),s=sin(angulo);return p*c+cross(eje,p)*s+eje*dot(eje,p)*(1.-c);}
          `+sh.vertexShader;
        sh.vertexShader=sh.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
          float edadLosa=max(0.,uTiempoPiso-aLosa.z);
          vec2 radialLosa=normalize(aLosa.xy+vec2(.00001));vec3 ejeLosa=vec3(-radialLosa.y,0.,radialLosa.x);
          float anguloLosa=(1.-exp(-edadLosa*1.7))*(.3+aLosa.w*.9)+edadLosa*(.6+aLosa.w*.7);
          objectNormal=girarLosa(objectNormal,ejeLosa,anguloLosa);`);
        sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          vec3 pivoteLosa=vec3(aLosa.x,.028,aLosa.y),pLosa=transformed-pivoteLosa;
          float fracturaLosa=smoothstep(0.,.24,edadLosa);pLosa.xz*=1.-.045*fracturaLosa;
          transformed=pivoteLosa+girarLosa(pLosa,ejeLosa,anguloLosa);
          transformed.xz-=aLosa.xy*.42*(1.-exp(-edadLosa*.7));
          transformed.y-=.3*edadLosa+4.9*edadLosa*edadLosa;`);
      };
      mat.customProgramCacheKey=()=> 'epilogo-pavimento-fracturado-v1';
      const mesh=new T.Mesh(g,mat);mesh.name='Pavimento que cae hacia la sima';mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
      mesh.userData.losas=losas;mesh.userData.radio=radio;mesh.userData.tiempo=tiempoPiso;mesh.userData.centro=centroOnda;grupo.add(mesh);return mesh;
    }
    function colocarLosas(p){
      const mesh=recursos.losasPiso,g=mesh.geometry,pos=g.attributes.position,uv=g.attributes.uv,a=Math.PI/24,diametro=52/Math.cos(a);
      mesh.position.set(p.x,0,p.z);mesh.visible=true;tiempoPiso.value=0;
      // Conserva la continuidad de adoquines y vegetación al separar cada bloque.
      for(let i=0;i<uv.count;i++){const x=p.x+pos.getX(i),z=p.z+pos.getZ(i);uv.setXY(i,.5+(x*Math.cos(a)-z*Math.sin(a))/diametro,.5+(-x*Math.sin(a)-z*Math.cos(a))/diametro);}uv.needsUpdate=true;
    }
    function muestraLosa(i,t=tiempoPiso.value){
      const losa=recursos?.losasPiso.userData.losas[i];if(!losa)return null;
      const edad=Math.max(0,t-losa.demora),avance=.42*(1-Math.exp(-edad*.7)),giro=(1-Math.exp(-edad*1.7))*(.3+losa.semilla*.9)+edad*(.6+losa.semilla*.7),p=recursos.losasPiso.position;
      return {edad,giro,posicion:[p.x+losa.centro[0]*(1-avance),losa.centro[1]-.3*edad-4.9*edad*edad,p.z+losa.centro[2]*(1-avance)],visible:recursos.losasPiso.visible};
    }
    function preparar(){if(recursos)return;
      const brazosFPS=actuacion.crearFPS();escena.add(brazosFPS.raiz);
      const grupo=new T.Group();grupo.name='Epílogo · El mago';escena.add(grupo);grupo.visible=false;
      const mago=new T.Group();mago.name='Mago encapuchado';grupo.add(mago);
      const tela=material(0x5b506c),borde=material(0x91805d,{metalness:.4}),negro=material(0x08080f),piel=material(0x89908b),magia=new T.MeshBasicMaterial({color:0x63df96,toneMapped:false});
      if(typeof document!=='undefined'){const l=new T.TextureLoader();tela.map=l.load('./texturas-goblin/ropa-color.webp');tela.map.colorSpace=T.SRGBColorSpace;tela.normalMap=l.load('./texturas-goblin/ropa-normal.webp');tela.normalScale.set(.3,.3);}
      const luzMago=new T.PointLight(0x53e68a,5,5,2);luzMago.position.set(0,1.7,.8);mago.add(luzMago);
      const pieza=(g,mat,p,padre=mago)=>{const m=new T.Mesh(g,mat);m.position.set(...p);padre.add(m);m.castShadow=true;return m;};
      // Pliegues de la túnica en la silueta, ribetes y capucha con rostro en sombra.
      const tunica=new T.CylinderGeometry(.27,.58,1.55,24,5,true),pos=tunica.attributes.position;
      for(let i=0;i<pos.count;i++){const a=Math.atan2(pos.getZ(i),pos.getX(i)),f=1+.09*Math.cos(a*12)*(1-(pos.getY(i)+.775)/1.55);pos.setXYZ(i,pos.getX(i)*f,pos.getY(i),pos.getZ(i)*f);}tunica.computeVertexNormals();
      pieza(tunica,tela,[0,.82,0]);pieza(new T.CylinderGeometry(.51,.51,.04,24),negro,[0,.05,0]);pieza(new T.TorusGeometry(.53,.032,5,24),borde,[0,.07,0]).rotation.x=Math.PI/2;
      pieza(new T.SphereGeometry(.35,16,12),tela,[0,1.78,0]).scale.set(1,1.12,.9);
      pieza(new T.SphereGeometry(.245,16,10),negro,[0,1.77,.32]).scale.set(.86,1,.3);
      for(const x of [-.08,.08])pieza(new T.SphereGeometry(.024,6,5),magia,[x,1.79,.404]);
      pieza(new T.TorusGeometry(.235,.042,6,20),borde,[0,1.76,.39]).scale.set(.92,1.18,1);
      pieza(new T.CylinderGeometry(.29,.34,.12,12),borde,[0,1.2,0]);
      const brazos=[];
      for(const lado of [-1,1]){const b=new T.Group();b.position.set(lado*.29,1.44,0);mago.add(b);b.rotation.z=lado*.24;brazos.push(b);pieza(new T.CylinderGeometry(.16,.24,.68,10),tela,[0,-.28,0],b);pieza(new T.TorusGeometry(.23,.027,5,12),borde,[0,-.61,0],b).rotation.x=Math.PI/2;pieza(new T.SphereGeometry(.1,8,6),piel,[0,-.72,.015],b);}
      const baston=new T.Group();baston.position.set(-.63,.02,.08);mago.add(baston);pieza(new T.CylinderGeometry(.033,.055,2.1,8),borde,[0,1.05,0],baston);pieza(new T.TorusGeometry(.16,.028,6,16),borde,[0,2.23,0],baston);pieza(new T.OctahedronGeometry(.115),magia,[0,2.23,0],baston);
      const sello=new T.Mesh(new T.RingGeometry(.62,.69,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x50c67f,transparent:true,opacity:.3,depthWrite:false,side:T.DoubleSide}));sello.position.y=.055;grupo.add(sello);
      const orbita=new T.Mesh(new T.TorusGeometry(.48,.025,5,32),magia);orbita.visible=false;grupo.add(orbita);
      // Dos cintas helicoidales envuelven la silueta sin una esfera que tape al mago.
      const auraMat=new T.MeshBasicMaterial({color:0x42ce82,transparent:true,opacity:.38,depthWrite:false,side:T.DoubleSide}),aura=new T.Group();aura.name='Hechizo verde';mago.add(aura);
      for(let j=0;j<2;j++){
        const p=[],idx=[];
        for(let i=0;i<=72;i++){const k=i/72,a=k*TAU*1.6+j*Math.PI,r=.66+Math.sin(k*Math.PI)*.23,y=.12+k*2.5;for(const d of [-.035,.035])p.push(Math.cos(a)*r,y+d,Math.sin(a)*r);if(i<72){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}}
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);aura.add(new T.Mesh(g,auraMat));
      }
      const motas=new T.InstancedMesh(new T.OctahedronGeometry(.032),magia,28);motas.frustumCulled=false;aura.add(motas);
      const particulasMago=window.CAOZ_ARPG_MAGO_PARTICULAS.fabrica(T,{grupo,mago,reducido});
      const hechizoMago=window.CAOZ_ARPG_MAGO_HECHIZO.fabrica(T,{grupo,escena,mago,reducido});
      const meteorito=new T.Group();meteorito.name='Meteorito';grupo.add(meteorito);
      const rocaGeo=new T.DodecahedronGeometry(2.15,2),rp=rocaGeo.attributes.position;
      for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),r=1+.1*Math.sin(x*3.7+y*2.1)*Math.cos(z*4.3)+.06*Math.sin(y*8+z*2);rp.setXYZ(i,x*r,y*r,z*r);}rocaGeo.computeVertexNormals();
      const rocaMat=material(0x261b16,{emissive:0x441006,emissiveIntensity:.25,flatShading:true});
      rocaMat.onBeforeCompile=sh=>{sh.vertexShader='varying vec3 vRoca;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoca=position;');sh.fragmentShader='varying vec3 vRoca;\n'+sh.fragmentShader;
        sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float veta=abs(sin(vRoca.x*4.7+sin(vRoca.z*5.3))*cos(vRoca.y*5.1+sin(vRoca.x*3.9)));
          float lava=1.-smoothstep(.025,.095,veta);totalEmissiveRadiance+=vec3(2.4,.5,.055)*lava;`);};
      const roca=pieza(rocaGeo,rocaMat,[0,0,0],meteorito);
      const cola=new T.Mesh(new T.ConeGeometry(2.1,11,24,8,true),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{uTiempo:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uTiempo;void main(){float ruido=.5+.25*sin(vUv.x*63.+vUv.y*27.-uTiempo*15.)+.25*sin(vUv.x*103.-vUv.y*48.+uTiempo*19.);float a=pow(1.-vUv.y,1.6)*smoothstep(.25,.8,ruido)*.65;gl_FragColor=vec4(mix(vec3(1.,.12,.01),vec3(1.,.7,.16),1.-vUv.y),a);}'} ));cola.position.y=6;meteorito.add(cola);
      const luz=new T.PointLight(0xf78c43,0,26,2);grupo.add(luz);
      const piedraGeo=new T.DodecahedronGeometry(1,0),piedraMat=piso()?.clone()||material(0x656260);piedraMat.flatShading=true;piedraMat.onBeforeCompile=()=>{};piedraMat.customProgramCacheKey=()=> 'fragmento-meteorito';
      const uv=piedraGeo.attributes.uv,rep=piedraMat.map?.repeat.x||1;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/rep,uv.getY(i)/rep);
      const fragmentos=new T.InstancedMesh(piedraGeo,piedraMat,180);fragmentos.instanceMatrix.setUsage(T.DynamicDrawUsage);fragmentos.frustumCulled=false;fragmentos.count=0;fragmentos.castShadow=false;fragmentos.receiveShadow=true;grupo.add(fragmentos);
      const pix=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=(x-31.5)/31.5,dy=(y-31.5)/31.5,r=dx*dx+dy*dy,o=(y*64+x)*4,a=Math.pow(Math.max(0,1-r),2)*(0.75+.25*Math.sin(x*.55)*Math.sin(y*.41));pix.set([255,255,255,Math.round(a*255)],o);}
      const nubeTex=new T.DataTexture(pix,64,64);nubeTex.needsUpdate=true;const nubeGeo=new T.PlaneGeometry(4,4),nubeMat=new T.MeshBasicMaterial({map:nubeTex,color:0x8d8175,transparent:true,opacity:.28,depthWrite:false}),nubes=28;
      // Instancias opacas de piedra y una nube de polvo de baja densidad, sin luces con sombras.
      const humo=new T.InstancedMesh(nubeGeo,nubeMat,nubes);humo.instanceMatrix.setUsage(T.DynamicDrawUsage);humo.frustumCulled=false;humo.count=0;grupo.add(humo);
      const onda=new T.Mesh(new T.RingGeometry(.93,1,80).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xb8a390,transparent:true,opacity:.45,depthWrite:false,side:T.DoubleSide}));onda.position.y=.04;grupo.add(onda);
      const losasPiso=prepararLosas(grupo);
      // La agrupación por material se conserva: los trozos se desplazan en el shader.
      (entorno||casas).traverse(m=>{if(!m.isMesh||!m.material.isMeshStandardMaterial||m.geometry.index)return;mallasRuina.push(m);
        const g=m.geometry,a=g.attributes.position,n=a.count,datos=new Float32Array(n*4);
        for(let i=0;i<n;i+=3){const x=Math.floor((a.getX(i)+a.getX(i+1)+a.getX(i+2))/3/1.65)*1.65+.825,y=Math.floor((a.getY(i)+a.getY(i+1)+a.getY(i+2))/3/1.35)*1.35+.675,z=Math.floor((a.getZ(i)+a.getZ(i+1)+a.getZ(i+2))/3/1.65)*1.65+.825;const r=Math.abs(Math.sin(x*17.2+y*53.1+z*7.3));for(let j=0;j<3;j++)datos.set([x,y,z,r],(i+j)*4);}
        g.setAttribute('aRuina',new T.BufferAttribute(datos,4));const mat=m.material,anterior=mat.onBeforeCompile,clave=mat.customProgramCacheKey();
        mat.onBeforeCompile=function(sh,r){anterior.call(this,sh,r);sh.uniforms.uDerrumbe=derrumbe;sh.uniforms.uCentroOnda=centroOnda;sh.vertexShader='attribute vec4 aRuina;uniform float uDerrumbe;uniform vec3 uCentroOnda;\n'+sh.vertexShader;
          sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            vec3 centro=(modelMatrix*vec4(aRuina.xyz,1.)).xyz;
            vec2 radial=centro.xz-uCentroOnda.xz;float distancia=length(radial);
            float edad=uDerrumbe-max(0.,distancia-1.)/14.;
            if(uDerrumbe>=0.&&edad>0.&&distancia<36.&&centro.y>.3){
              float fuerza=(1.-smoothstep(6.,36.,distancia))*(.7+aRuina.w*.6);
              vec2 d=normalize(radial+vec2(.0001));vec3 eje=vec3(d.y,0.,-d.x);
              vec3 mundo=(modelMatrix*vec4(transformed,1.)).xyz,p=mundo-centro;
              float giro=(1.-exp(-edad*2.8))*fuerza*(.5+aRuina.w);
              p=p*cos(giro)+cross(eje,p)*sin(giro)+eje*dot(eje,p)*(1.-cos(giro));
              // El frente alcanza cada estructura antes de empujar sus fragmentos.
              // Impulso inicial, frenado por arrastre y caída por gravedad.
              float avance=(1.-exp(-edad*2.6))*fuerza*(6.+aRuina.w*4.);
              vec3 despues=centro+p;despues.xz+=d*avance;
              despues.y=max(.12+aRuina.w*.3+p.y*.18,despues.y+fuerza*3.2*edad-4.9*edad*edad);
              vec3 delta=despues-mundo;
              transformed+=vec3(dot(modelMatrix[0].xyz,delta)/dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,delta)/dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,delta)/dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
            }`);
        };mat.customProgramCacheKey=()=>clave+'-epilogo-onda-radial-v2';mat.needsUpdate=true;m.frustumCulled=false;
      });
      recursos={grupo,brazosFPS,mago,brazos,baston,sello,orbita,aura,motas,luzMago,particulasMago,hechizoMago,meteorito,roca,cola,luz,fragmentos,humo,onda,losasPiso};
    }
    function prepararTecho(salida,avance){
      // Reaparece encima de la casa de salida, detrás de la dirección del ataque.
      const caja=casas.userData.ocultacion?.cajas.filter(b=>b.max.y>4&&b.getCenter(new V()).sub(centro).dot(avance)<-4).sort((a,b)=>a.getCenter(new V()).setY(0).distanceToSquared(salida)-b.getCenter(new V()).setY(0).distanceToSquared(salida))[0];
      if(caja){caja.getCenter(techo);techo.z+=.3;casas.updateMatrixWorld(true);const ray=new T.Raycaster(new V(techo.x,caja.max.y+3,techo.z),new V(0,-1,0));const contacto=ray.intersectObject(casas,true)[0];techo.y=(contacto?.point.y??caja.max.y)+.13;}
      else techo.copy(centro).addScaledVector(avance,-18).setY(7.8);
      cielo.copy(destino).add(new V(techo.x*1.6,54,techo.z*1.6));
    }
    function visibilidad(){const pov=POV.includes(s.fase);s.actor.m.raiz.visible=true;s.actor.m.mallas.forEach((m,i)=>m.visible=!pov&&s.mallas[i]);recursos.brazosFPS.raiz.visible=pov&&!s.impactado;}
    // El visor sólo cambia visibilidad. Los brazos conservan la pose y el anclaje
    // de la cámara programada; editar el encuadre nunca vuelve a animarlos.
    function vistaEditor(externa=false){if(!s)return;visibilidad();if(externa){s.actor.m.mallas.forEach((m,i)=>m.visible=s.mallas[i]);recursos.brazosFPS.raiz.visible=false;}}
    function restaurarCasaDolly(){if(s?.casaDolly>=0){casas.userData.ocultacion.opacidades[s.casaDolly]=s.opacidadCasa;s.casaDolly=-1;}}
    function cambio(fase){actuarRostro();s.inicios[fase]=s.total;const plano=planoDeFase(fase);if(s.plano!==plano){s.plano=plano;s.tPlano=0;}if(s.fase==='vertigo'&&fase!=='vertigo')restaurarCasaDolly();s.fase=fase;s.t=0;s.pose=actuacion.capturar(s.actor.m);s.inicio=s.actor.pos.clone();s.dirInicio=s.actor.dir;visibilidad();interfaz({fase,negro:0});}
    function iniciar(jugadores,{puerta,umbral,normal}={}){if(s)return false;preparar();terminado=false;
      let actor=jugadores.find(h=>h.tipo==='adreida'&&h.vivo),prestado=false;
      if(!actor){const m=MOD.crear('adreida');escena.add(m.raiz);actor={tipo:'adreida',m,pos:new V(),radio:m.radio,dir:0,fase:0,vivo:true};prestado=true;}
      visitadas=jugadores.map(h=>({h,visible:h.m.raiz.visible,mallas:h.m.mallas.map(m=>m.visible),pos:h.pos.clone(),dir:h.dir,raiz:h.m.raiz.position.clone(),giro:h.m.raiz.quaternion.clone(),pose:actuacion.capturar(h.m)}));for(const x of visitadas)x.h.m.raiz.visible=x.h===actor;
      const fuera=normal?.clone()||centro.clone().sub(puerta||new V(10,0,10)).normalize(),salida=puerta?.clone()||new V(10,0,10);
      const avance=centro.clone().sub(salida).setY(0).normalize();destino.copy(centro).addScaledVector(avance,-3.5);prepararTecho(salida,avance);
      actor.pos.copy(umbral||salida.clone().addScaledVector(fuera,-1.8));actor.dir=Math.atan2(fuera.x,fuera.z);actor.giro180=null;actor.alto=0;
      s={actor,prestado,inicios:{},lluviaLiberada:false,golpeMago:null,tLluvia:0,duracionCarreraAnterior:Math.ceil(Math.min(12,salida.distanceTo(destino)/5.8)*60-1e-8)/60,fase:'salida',t:0,total:0,impactado:false,origen:actor.pos.clone(),salida,inicioCarrera:salida.clone(),fuera,avance,remate:centro.clone().addScaledVector(avance,-1.6),tropiezo:centro.clone().addScaledVector(avance,.8),casaDolly:-1,dollyPreparado:false,mallas:actor.m.mallas.map(m=>m.visible)};nodosCine=null;
      recursos.particulasMago.restaurar();recursos.hechizoMago.restaurar();recursos.aura.visible=true;recursos.luzMago.intensity=5;recursos.grupo.visible=true;recursos.mago.visible=recursos.sello.visible=false;recursos.meteorito.visible=recursos.onda.visible=recursos.losasPiso.visible=false;recursos.fragmentos.count=recursos.humo.count=0;recursos.luz.intensity=0;tiempoPiso.value=-1;centroOnda.value.set(0,0,0);
      casas.userData.ocultacion?.opacidades.fill(1);derrumbe.value=-1;posar('quieto',0);cambio('salida');camaraSalida();ambienteLluvia(0,actor.pos);return true;
    }
    function camaraSalida(){const h=s.actor,izquierda=new V(-s.fuera.z,0,s.fuera.x),foco=s.origen.clone().lerp(h.pos,.5).setY(1.1);
      mirar(s.salida.clone().addScaledVector(s.fuera,5.5).addScaledVector(izquierda,3.5).setY(3.5),foco,42);
      desdeCamara.copy(camara.position);giroPaneo.copy(camara.quaternion);
    }
    function posar(anim,dt,k=0,paso=1,extra={}){const h=s.actor;h.m.raiz.position.copy(h.pos);h.m.raiz.rotation.y=h.dir;MOD.posar(h.m,{anim,k,t:s.total,dt,mezclar:true,estado:anim,fase:h.fase,paso:anim==='andar'?paso:0,...extra});h.m.M.u.uDestello.value=h.m.M.u.uBorde.value=0;}
    function actuarRostro(){
      if(!s?.actor.m.rostro||!MOD.rostro)return;
      // La intención pertenece a la actuación. Ni el objetivo de cámara ni sus
      // keyframes intervienen en los ojos, y buscar un cuadro no acumula mezclas.
      const f=s.fase,t=s.t;let de='desconfianza',hacia=de,a=.30,b=.35,k=t/2.6,mirada=[0,0];
      if(f==='descubrir'){hacia='determinacion';a=.35;b=.55;k=t/.65;}
      else if(f==='vertigo'){de='determinacion';hacia='ira';a=.55;b=.35;k=t/2.8;}
      else if(f==='pies'){de=hacia='ira';a=.35;b=.50;k=t/.65;}
      else if(f==='carrera'){de=hacia='ira';a=.50;b=.63;k=t/.9;}
      else if(f==='ataquePOV'){de=hacia='ira';a=.63;b=.76;k=t/DURACIONES.ataquePOV;}
      else if(f==='desaparece'||f==='levantarse'){de=hacia='ira';a=.76;b=.85;k=t/.5;}
      else if(f==='tropezar'){de='ira';hacia='sorpresa';a=.85;b=.65;k=(t-(GOLPE_MAGO-DURACION_SLIDE-.30))/.25;}
      else if(f==='buscar'){de='sorpresa';hacia='desconfianza';a=.65;b=.64;k=t/.4;mirada=[Math.sin(t*3.4)*.34,0];}
      else if(f==='voltear'){de='desconfianza';hacia='sorpresa';a=.64;b=.55;k=(t-.9)/.5;mirada=[0,.20*suave((t-.6)/.8)];}
      else if(f==='techo'||f==='hechizo'){de='sorpresa';hacia='miedo';a=.40;b=.55;k=t/.9;mirada=[0,.35];}
      else if(f==='cielo'){de=hacia='miedo';a=.55;b=.90;k=t/.7;mirada=[0,.65];}
      else if(f==='caida'){de=hacia='miedo';a=b=.90;k=1;mirada=[0,.35*(1-suave(t/.8))];}
      else if(f==='impacto'||f==='negro'){de='dolor';hacia='miedo';a=.85;b=.85;k=(t+(f==='negro'?DURACIONES.impacto:0)-.25)/.8;mirada=[0,.08];}
      const desde=MOD.rostro.expresiones[de],hasta=MOD.rostro.expresiones[hacia],u=suave(k),pesos={};
      for(const nombre of new Set([...Object.keys(desde),...Object.keys(hasta)]))pesos[nombre]=(desde[nombre]||0)*a*(1-u)+(hasta[nombre]||0)*b*u;
      if(f==='caida'){
        const proteger=suave(t/.35);pesos.jawOpen=.19*(1-proteger*.45);pesos.eyeSquintLeft=.36*proteger;pesos.eyeSquintRight=.31*proteger;
        pesos.eyeWideLeft*=1-proteger;pesos.eyeWideRight*=1-proteger;
        pesos.eyeBlinkLeft=pesos.eyeBlinkRight=.85*suave((t-.86)/.15);
      }
      MOD.rostro.posar(s.actor.m,{anim:'quieto',t:s.total,expresion:hacia,rostro:pesos,mirada,parpadeo:!['carrera','ataquePOV','desaparece','caida','impacto','negro'].includes(f)});
    }
    function mirar(pos,objetivo,fov){camara.position.copy(pos);camara.lookAt(objetivo);camara.fov=fov;camara.near=.045;camara.updateProjectionMatrix();camara.updateMatrixWorld(true);}
    function camaraJuego(amplitud=1,fov=32){const h=s.actor,objetivo=h.pos.clone().lerp(centro,.35).setY(.75);const d=22*amplitud;mirar(objetivo.clone().add(new V(0,Math.sin(.92)*d,Math.cos(.92)*d)),objetivo,fov);}
    function camaraPerfil(){const objetivo=s.remate.clone().setY(.85),lateral=new V(-s.avance.z,0,s.avance.x);mirar(objetivo.clone().addScaledVector(lateral,12).add(new V(0,8.4,0)),objetivo,36);}
    function vistaOjos(objetivo,correr=false,fov=68,altura=1.69){const h=s.actor,balanceo=correr&&!reducido?Math.sin(h.fase*2)*.035:0;mirar(h.pos.clone().add(new V(Math.sin(h.dir)*.12,altura+balanceo,Math.cos(h.dir)*.12)),objetivo,fov);}
    function buscarDesdeOjos(t){
      const h=s.actor,inicio=s.miradaInicio??h.dir,altura=1.69;
      const ojos=h.pos.clone().add(new V(Math.sin(h.dir)*.12,altura,Math.cos(h.dir)*.12));
      // La estela ocupa el encuadre antes del giro. La mirada sigue su mismo
      // recorrido espacial hasta ver cómo se reúne sobre el tejado.
      const viaje=Math.max(0,t-ESPERA_PARTICULAS),foco=recursos.particulasMago.focoViaje(viaje,VIAJE_PARTICULAS),direccion=foco.clone().sub(ojos).normalize();
      const arranque=new V(Math.sin(inicio),0,Math.cos(inicio));direccion.lerpVectors(arranque,direccion,suave(viaje/.18)).normalize();
      mirar(ojos,ojos.clone().add(direccion),68-24*suave((t-(DURACIONES.voltear-.65))/.65));
    }
    function rastroMago(){
      const r=recursos,f=s.fase,t=s.t;
      if(s.golpeMago===null)return;
      const edad=s.total-s.golpeMago;
      if(['tropezar','buscar'].includes(f))r.particulasMago.actualizar({fase:'explosion',t:edad,desdeImpacto:edad});
      else if(f==='voltear')r.particulasMago.actualizar(t+1e-8<ESPERA_PARTICULAS?{fase:'explosion',t:edad,desdeImpacto:edad}:{fase:'viaje',t:t-ESPERA_PARTICULAS,duracion:VIAJE_PARTICULAS,desdeImpacto:edad});
      else if(f==='techo')r.particulasMago.actualizar({fase:'reunion',t,duracion:DURACIONES.techo,desdeImpacto:edad});
      else r.particulasMago.restaurar();
      // El foco del hechizo reaparece con su silueta, sin una luz huérfana
      // delatando al mago antes de que las partículas lleguen al tejado.
      const reunido=f==='techo'?suave((t-.45)/.8):['hechizo','cielo','caida'].includes(f)?1:0;
      r.luzMago.intensity=5*reunido;r.aura.visible=reunido>0;r.orbita.visible=reunido>.8;
    }
    function deslizamiento(edad){
      const clip=window.CAOZ_ADREIDA_CINE_CLIPS.deslizarAtaque,duracion=DURACION_SLIDE;
      // Conserva los primeros .90 s del FBX a su velocidad natural. La rodilla
      // baja desemboca en la incorporación y no en otra animación de caída.
      const fin=Math.min(1,.9/clip.duracion),k=lim(edad/duracion)*fin;
      const avance=u=>{const f=u*(clip.muestras-1),i=Math.floor(f),j=Math.min(i+1,clip.muestras-1);return T.MathUtils.lerp(clip.raiz[i*3+2],clip.raiz[j*3+2],f-i);};
      const origen=avance(0),recorrido=avance(fin)-origen;
      return {k,avance:lim((avance(k)-origen)/Math.max(.001,recorrido))};
    }
    function ataqueContinuo(edad){
      const h=s.actor,slide=deslizamiento(edad);
      h.pos.lerpVectors(destino,s.remate,slide.avance);h.dir=Math.atan2(s.avance.x,s.avance.z);h.m.raiz.position.copy(h.pos);h.m.raiz.rotation.y=h.dir;
      if(edad<DURACION_SLIDE)actuacion.deslizar(h.m,slide.k,s.poseAtaque,edad/.12);
      else actuacion.rematarDeslizamiento(h.m,(edad-DURACION_SLIDE)/actuacion.tiemposRemate.duracion);
      // Un solo reloj atraviesa el corte: ni el slide ni el impulso del remate
      // se reinician al entrar en otra acción o cambiar de cámara.
      if(edad>=GOLPE_MAGO&&!s.lluviaLiberada){
        recursos.particulasMago.preparar({origen:recursos.mago.position,techo:techo.clone().add(new V(0,.03,0)),actor:s.remate,rumbo:h.dir});
        s.lluviaLiberada=true;s.golpeMago=s.total;
      }
      const k=suave((edad-GOLPE_MAGO)/.22),r=recursos;
      r.sello.scale.setScalar(1+k*2);r.sello.material.opacity=.5*(1-k);if(k===1)r.sello.visible=false;
    }
    function camaraPies(){
      const foco=s.actor.pos.clone().setY(.3),lateral=new V(-s.avance.z,0,s.avance.x);
      // Travelling bajo de perfil: deja espacio delante de las botas y corta bajo la rodilla.
      foco.addScaledVector(s.avance,.22);mirar(foco.clone().addScaledVector(lateral,2.5).addScaledVector(s.avance,.45).setY(.48),foco,36);
    }
    function iniciarPies(){
      const h=s.actor,d=s.salida.distanceTo(destino),distancia=Math.min(2,d*.2),inicio=distancia*(RECORTE_PIES/DURACION_PIES_ORIGINAL)**2,total=s.total;
      h.dir=Math.atan2(s.avance.x,s.avance.z);cambio('pies');
      // Prepara sólo la actuación hasta el antiguo F011, incluida la mezcla
      // desde reposo. No consume tiempo de montaje ni adelanta lluvia o efectos.
      for(let f=1;f<=11;f++){
        const antes=h.pos.clone();h.pos.copy(s.salida).addScaledVector(s.avance,distancia*(f/90)**2);
        h.fase+=antes.distanceTo(h.pos)/MOD.animacion.longitudZancada(1)*TAU;s.total=total+f/60;posar('andar',1/60);
      }
      s.total=total;
      // Integral de v(t)=v0*exp(a*t/duración). Elige a para entrar al POV
      // con su misma velocidad. La carrera termina exactamente en el F093 del plano 05.
      const velocidadFinal=(d-distancia)/DURACIONES.carrera,objetivo=velocidadFinal*DURACIONES.pies/Math.max(1e-6,distancia-inicio);
      let menor=0,mayor=16;for(let i=0;i<32;i++){const a=(menor+mayor)/2;if(a/(-Math.expm1(-a))<objetivo)menor=a;else mayor=a;}
      s.pies={distancia,inicio,exponente:(menor+mayor)/2};camaraPies();
    }
    // Se aplica después de la cámara editada y se deshace tras dibujar: no se
    // acumula al pausar ni se graba dos veces al convertirla en keyframes.
    function respirarCamara(){
      if(!s||s.fase!=='caida'||reducido)return null;
      const t=s.t,envolvente=suave(t/.12)*(1-suave((t-(DURACIONES.caida-.18))/.18));
      const pos=camara.position.clone(),rot=camara.quaternion.clone(),pulso=Math.sin(t*TAU*.85);
      camara.position.add(new V(Math.sin(t*TAU*.45)*.012,pulso*.035,0).multiplyScalar(envolvente).applyQuaternion(rot));
      camara.rotateX(pulso*.0025*envolvente);camara.rotateZ(Math.sin(t*TAU*.65)*.0018*envolvente);camara.updateMatrixWorld(true);
      return ()=>{camara.position.copy(pos);camara.quaternion.copy(rot);camara.updateMatrixWorld(true);};
    }
    // La posición debe estar lista antes del primer cuadro visible: así la estela
    // nunca aparece en el origen ni conserva la posición de una reproducción anterior.
    function colocarMeteorito(edad){const r=recursos,h=s.actor,k=lim(edad/(DURACIONES.cielo+DURACIONES.caida));
      r.meteorito.position.lerpVectors(cielo,h.pos.clone().setY(1),k*k);r.meteorito.quaternion.setFromUnitVectors(new V(0,1,0),cielo.clone().sub(h.pos).normalize());r.roca.rotation.set(edad*.8,edad*1.2,edad*.5);r.luz.position.copy(r.meteorito.position);r.luz.intensity=250;
    }
    function camaraVertigo(k){
      const foco=new V(0,2.35,0),direccion=new V(0,.09,1).normalize(),distancia=24-17*suave(k);
      // La capucha mira a +Z: el eje de cámara permite ver al mago de frente.
      // d * tan(FOV/2) constante: el mago mantiene tamaño mientras cambia el fondo.
      const fov=T.MathUtils.radToDeg(2*Math.atan(24*Math.tan(T.MathUtils.degToRad(18)/2)/distancia));
      mirar(foco.clone().addScaledVector(direccion,distancia),foco,fov);
      // La casa delante de la primera posición queda translúcida sólo en esta toma.
      // Se usa el índice del lote existente, sin separar mallas ni materiales.
      if(!s.dollyPreparado){s.dollyPreparado=true;const o=casas.userData.ocultacion;
        if(o){const ray=new T.Ray(camara.position.clone(),foco.clone().sub(camara.position).normalize()),p=new V();let cerca=Infinity;
          o.cajas.forEach((b,i)=>{if(b.max.y<3)return;const hit=ray.intersectBox(b,p),d=b.containsPoint(camara.position)?0:hit?camara.position.distanceTo(p):Infinity;if(d<distancia&&d<cerca){cerca=d;s.casaDolly=i;}});
          if(s.casaDolly>=0){s.opacidadCasa=o.opacidades[s.casaDolly];o.opacidades[s.casaDolly]=.06;}
        }
      }
    }
    function explosion(){if(s.impactado)return;actuarRostro();s.impactado=true;s.impacto=s.actor.pos.clone();centroOnda.value.copy(s.impacto);s.poseImpacto=actuacion.capturar(s.actor.m);const r=recursos;impactar(s.impacto);colocarLosas(s.impacto);r.meteorito.visible=false;r.mago.visible=false;r.orbita.visible=false;r.onda.visible=true;r.luz.position.copy(s.impacto).setY(3);r.luz.intensity=900;
      sombras=[];for(const m of mallasRuina){sombras.push([m,m.castShadow]);m.castShadow=false;}
    }
    function escombros(t){const r=recursos,p=s.impacto;derrumbe.value=tiempoPiso.value=t;r.fragmentos.count=180;
      for(let i=0;i<180;i++){const a=i*2.399963,b=(i*17%31)/31,v=4+b*11,d=.8+v*t,altura=Math.max(.06,(5+b*10)*t-7.5*t*t),tam=.12+(i%9)/9*.5;objeto.position.set(p.x+Math.cos(a)*d,altura,p.z+Math.sin(a)*d);objeto.rotation.set(t*(i%5),a+t*2,t*3);objeto.scale.set(tam,tam*.7,tam);objeto.updateMatrix();r.fragmentos.setMatrixAt(i,objeto.matrix);}
      r.fragmentos.instanceMatrix.needsUpdate=true;r.humo.count=28;
      for(let i=0;i<28;i++){const a=i*TAU/28,d=2+t*(2+i%3);objeto.position.set(p.x+Math.cos(a)*d,.3+t*(.6+i%3*.3),p.z+Math.sin(a)*d);objeto.quaternion.copy(camara.quaternion);objeto.scale.setScalar(.35+t*(.5+i%4*.2));objeto.updateMatrix();r.humo.setMatrixAt(i,objeto.matrix);}r.humo.instanceMatrix.needsUpdate=true;r.humo.material.opacity=.28*(1-lim((t-2)/2));
      r.onda.position.set(p.x,.04,p.z);r.onda.scale.setScalar(1+t*14);r.onda.material.opacity=.38*(1-suave((t-1.55)/1.15));r.luz.intensity=650*Math.exp(-t*2.8);
    }
    function caerAbismo(t){
      // Tiempo dilatado para leer primero el derrumbe y luego la caída antes del fondo.
      const h=s.actor,tiempo=t*.5;h.pos.copy(s.impacto);h.pos.y=-.7*t-4.9*tiempo*tiempo;h.pos.x+=.22*t;h.pos.z+=.18*t;
      h.m.raiz.position.copy(h.pos);h.m.raiz.rotation.y=h.dir+.24*suave(t/2);
      actuacion.fbx(h.m,'caerAbismo',t/4.5,s.poseImpacto,t/.22);
    }
    function camaraDestruccion(t){
      const objetivo=centro.clone().lerp(s.impacto,.25).setY(.4),d=22*(2.1+.2*suave(t/1.2));
      mirar(objetivo.clone().add(new V(0,Math.sin(.92)*d,Math.cos(.92)*d)),objetivo,48);
    }
    function paso(dt){if(!s||dt<0)return false;if(terminado||dt===0)return true;const h=s.actor,r=recursos;s.t+=dt;s.total+=dt;s.tPlano+=dt;if(s.lluviaLiberada)s.tLluvia+=dt;const t=s.t,f=s.fase;
      const enTecho=['voltear','techo','hechizo','cielo','caida','impacto','negro'].includes(f);
      r.mago.position.copy(enTecho?techo:centro).add(new V(0,(enTecho?.03:1.05)+Math.sin(s.total*2)*.035,0));r.mago.rotation.y=enTecho?rumbo(r.mago.position,h.pos):0;
      const hechizo=r.mago.visible&&!s.impactado,edadHechizo=s.inicios.hechizo===undefined?-1:s.total-s.inicios.hechizo;
      // Tras reconstruirse, recoge las manos y las eleva al cielo. El gesto
      // culmina con el último rayo y se sostiene al descubrir el meteorito.
      const carga=edadHechizo<0?0:suave(edadHechizo/.5),invocacion=edadHechizo<0?0:suave((edadHechizo-.45)/2.2);
      const reposo=.92+Math.sin(s.total*2.5)*.08,levantados=hechizo?reposo*(1-carga)+(.58+.76*invocacion)*carga:0;
      r.brazos.forEach((b,i)=>{b.rotation.x=-levantados*2.2;b.rotation.z=(i?1:-1)*(.24+levantados*.45-.22*carga*(1-invocacion));});
      r.baston.rotation.z=Math.sin(s.total*1.4)*.035;r.baston.rotation.x=-.14*carga*invocacion;
      r.cola.material.uniforms.uTiempo.value=s.total;r.sello.rotation.y=s.total*.3;r.orbita.visible=hechizo;r.orbita.position.copy(r.mago.position).add(new V(0,2.6,0));r.orbita.rotation.set(s.total*.4,s.total*.7,0);
      r.aura.rotation.y=s.total*.8;for(let i=0;i<28;i++){const k=(i/28+s.total*.19)%1,a=i*2.399+s.total*.7;objeto.position.set(Math.cos(a)*.9,.1+k*2.6,Math.sin(a)*.9);objeto.rotation.set(a,k*5,a*.3);objeto.scale.setScalar(.6+Math.sin(k*Math.PI)*.7);objeto.updateMatrix();r.motas.setMatrixAt(i,objeto.matrix);}r.motas.instanceMatrix.needsUpdate=true;
      visibilidad();
      if(f==='salida'){
        const k=suave(t/2.1),antes=h.pos.clone();h.pos.lerpVectors(s.origen,s.salida,k);h.fase+=antes.distanceTo(h.pos)/MOD.animacion.longitudZancada(.42)*TAU;posar(t<2.1?'andar':'quieto',dt,0,.42);camaraSalida();
        if(t>=DURACIONES.salida){r.mago.visible=r.sello.visible=true;cambio('descubrir');}
      }else if(f==='descubrir'){
        h.dir+=angulo(h.dir,rumbo(h.pos,centro))*Math.min(1,dt*3);posar('quieto',dt);
        // Plano 1: sólo gira la cámara desde Adreida al mago; posición y focal fijas.
        // Sostiene el final del paneo 0,3 s antes del corte al plano de vértigo.
        mirar(desdeCamara,new V(0,2.35,0),42);finPaneo.copy(camara.quaternion);
        camara.quaternion.slerpQuaternions(giroPaneo,finPaneo,suave(t/2.1));camara.updateMatrixWorld(true);
        if(t>=DURACIONES.descubrir){cambio('vertigo');camaraVertigo(0);}
      }else if(f==='pies'){
        const k=lim(t/DURACIONES.pies),antes=h.pos.clone(),p=s.pies,avance=Math.expm1(p.exponente*k)/Math.expm1(p.exponente);
        h.pos.copy(s.salida).addScaledVector(s.avance,p.inicio+(p.distancia-p.inicio)*avance);h.fase+=antes.distanceTo(h.pos)/MOD.animacion.longitudZancada(1)*TAU;
        posar('andar',dt);camaraPies();
        if(t+1e-8>=DURACIONES.pies){s.inicioCarrera.copy(h.pos);cambio('carrera');vistaOjos(r.mago.position.clone().add(new V(0,1.1,0)),true);}
      }else if(f==='vertigo'){
        posar('quieto',dt);camaraVertigo(t/DURACIONES.vertigo);if(t>=DURACIONES.vertigo)iniciarPies();
      }else if(f==='carrera'){
        // F093 del plano 5 (base 60): el momento depende del montaje, no de la
        // distancia hasta la casa. La zancada sigue la distancia real recorrida.
        const antes=h.pos.clone();h.pos.lerpVectors(s.inicioCarrera,destino,lim(t/DURACIONES.carrera));h.dir=Math.atan2(s.avance.x,s.avance.z);
        h.fase+=antes.distanceTo(h.pos)/MOD.animacion.longitudZancada(1)*TAU;posar('andar',dt);vistaOjos(r.mago.position.clone().add(new V(0,1.1,0)),true);
        if(t+1e-8>=DURACIONES.carrera){h.pos.copy(destino);cambio('ataquePOV');s.poseAtaque=s.pose;ataqueContinuo(0);}
      }else if(['ataquePOV','desaparece','levantarse','tropezar'].includes(f)){
        const edad=s.total-s.inicios.ataquePOV;ataqueContinuo(edad);
        if(f==='ataquePOV')vistaOjos(r.mago.position.clone().add(new V(0,1.1,0)),false,68,1.69+h.m.H.cuerpo.position.y*.75);else camaraPerfil();
        if(t+1e-8>=DURACIONES[f]){
          const siguiente={ataquePOV:'desaparece',desaparece:'levantarse',levantarse:'tropezar',tropezar:'buscar'}[f];
          cambio(siguiente);if(f==='ataquePOV')camaraPerfil();
        }
      }else if(f==='buscar'){
        actuacion.buscarDePie(h.m,t);camaraPerfil();
        if(t>=DURACIONES.buscar){s.miradaInicio=h.dir+h.m.H.cabeza.rotation.y+h.m.H.torso.rotation.y;r.mago.position.copy(techo).y+=.03;cambio('voltear');buscarDesdeOjos(0);}
      }else if(f==='voltear'){
        // El giro sucede ya en POV. El cuerpo acompaña después a los ojos.
        const viaje=Math.max(0,t-ESPERA_PARTICULAS),k=suave((viaje-.35)/(VIAJE_PARTICULAS-.35)),delta=angulo(s.dirInicio,rumbo(h.pos,techo));
        h.dir=s.dirInicio+delta*MOD.animacion.avanceGiro(k);posar(viaje>0?'giro180':'quieto',dt,k,0,{sentidoGiro:Math.sign(delta)});
        buscarDesdeOjos(t);
        if(t+1e-8>=DURACIONES.voltear){h.dir=s.dirInicio+delta;h.m.raiz.rotation.y=h.dir;cambio('techo');vistaOjos(r.mago.position.clone().add(new V(0,1.3,0)),false,44);}
      }
      else if(f==='techo'){posar('quieto',dt);vistaOjos(r.mago.position.clone().add(new V(0,1.3,0)),false,44);if(t+1e-8>=DURACIONES.techo)cambio('hechizo');}
      else if(f==='hechizo'){posar('quieto',dt);vistaOjos(r.mago.position.clone().add(new V(0,1.3,0)),false,44);if(t+1e-8>=DURACIONES.hechizo){colocarMeteorito(0);r.meteorito.visible=true;cambio('cielo');}}
      else if(f==='cielo'||f==='caida'){const edad=(f==='caida'?DURACIONES.cielo:0)+t;colocarMeteorito(edad);
        if(f==='cielo'){const objetivo=r.mago.position.clone().add(new V(0,2,0)).lerp(r.meteorito.position,suave(t/.4));vistaOjos(objetivo,false,44-20*suave((t-.12)/.45));if(t>=DURACIONES.cielo){cambio('caida');camaraJuego(.8);}}
        else{h.m.raiz.position.copy(h.pos);actuacion.fbx(h.m,'prepararMeteorito',t/.67,s.pose,t/.22);camaraJuego(.8);if(t>=DURACIONES.caida){explosion();cambio('impacto');camaraDestruccion(0);}}
      }else if(f==='impacto'){
        caerAbismo(t);escombros(t);camaraDestruccion(t);if(!reducido){camara.position.x+=Math.sin(t*53)*.28*Math.exp(-t*2);camara.position.y+=Math.cos(t*67)*.2*Math.exp(-t*2);}if(t>=DURACIONES.impacto)cambio('negro');
      }else if(f==='negro'){
        const edad=DURACIONES.impacto+t;caerAbismo(edad);escombros(edad);camaraDestruccion(edad);interfaz({fase:f,negro:suave(t/.6)});if(t>=DURACIONES.negro)finalizar();
      }
      if(s){rastroMago();actuarRostro();ambienteLluvia(s.tLluvia,h.pos);if(s.inicios.hechizo!==undefined)r.hechizoMago.actualizar(s.total-s.inicios.hechizo,DURACIONES.hechizo);if(POV.includes(s.fase))actuacion.fps(r.brazosFPS,camara,s.fase==='carrera'?h.fase:0,s.total,s.fase==='ataquePOV'?(s.t<DURACION_SLIDE?deslizamiento(s.t).k:(s.t-DURACION_SLIDE)/actuacion.tiemposRemate.duracion):null,s.fase==='ataquePOV'?(s.t<DURACION_SLIDE?'deslizarAtaque':'rematarDeslizamiento'):null);h.m.raiz.updateMatrixWorld(true);r.grupo.updateMatrixWorld(true);camara.updateMatrixWorld(true);}return true;
    }
    function finalizar(){if(!s||terminado)return false;restaurarCasaDolly();terminado=true;interfaz({fase:'fin',negro:1});return true;}
    function cancelar(){ambienteLluvia(null);restaurarCasaDolly();if(recursos){recursos.particulasMago.restaurar();recursos.hechizoMago.restaurar();recursos.grupo.visible=false;recursos.brazosFPS.raiz.visible=false;recursos.losasPiso.visible=false;recursos.sello.scale.setScalar(1);recursos.sello.material.opacity=.3;}derrumbe.value=tiempoPiso.value=-1;centroOnda.value.set(0,0,0);for(const [m,v]of sombras)m.castShadow=v;sombras=[];
      for(const x of visitadas){const h=x.h;h.pos.copy(x.pos);h.dir=x.dir;h.m.raiz.position.copy(x.raiz);h.m.raiz.quaternion.copy(x.giro);actuacion.restaurar(h.m,x.pose);h.m.raiz.visible=x.visible;h.m.mallas.forEach((m,i)=>m.visible=x.mallas[i]);}visitadas=[];if(s?.prestado){escena.remove(s.actor.m.raiz);for(const m of s.actor.m.mallas)m.material.dispose();for(const esqueleto of new Set(s.actor.m.mallas.map(m=>m.skeleton)))esqueleto?.dispose();}s=null;terminado=false;camara.fov=camBase.fov;camara.near=camBase.near;camara.updateProjectionMatrix();interfaz({fase:'inactiva',negro:0});}
    function estado(){return s?{fase:s.fase,t:s.t,plano:s.plano,tPlano:s.tPlano,inicios:{...s.inicios},lluviaLiberada:s.lluviaLiberada,tLluvia:s.tLluvia,golpeMago:s.golpeMago,duracionCarreraAnterior:s.duracionCarreraAnterior,total:s.total,impactado:s.impactado,pov:POV.includes(s.fase),brazosFPS:recursos.brazosFPS.raiz.visible,actor:s.actor.pos.toArray(),mago:recursos.mago.position.toArray(),meteorito:recursos.meteorito.position.toArray(),casaDolly:s.casaDolly,derrumbe:derrumbe.value,pisoRoto:{edad:tiempoPiso.value,centro:centroOnda.value.toArray(),losas:recursos.losasPiso.userData.losas.length},terminado}:null;}
    // Sólo el editor hornea la actuación una vez. Se guardan transformaciones y
    // reservas dinámicas pequeñas; nunca se duplican geometrías ni texturas.
    function capturarCuadro(){
      if(!nodosCine){nodosCine=[];for(const raiz of [s.actor.m.raiz,recursos.grupo,recursos.brazosFPS.raiz])raiz.traverse(n=>nodosCine.push(n));}
      const poses=new Float32Array(nodosCine.length*12),instancias=[],agarres=[];
      nodosCine.forEach((n,i)=>{const j=i*12;n.position.toArray(poses,j);n.quaternion.toArray(poses,j+3);n.scale.toArray(poses,j+7);poses[j+10]=+n.visible;poses[j+11]=n.intensity||0;
        if(n.morphTargetInfluences)agarres.push({n,pesos:n.morphTargetInfluences.slice()});
        if(n.isInstancedMesh)instancias.push({n,i:n.instanceMatrix.array.slice(0,n.count*16),cantidad:n.count});});
      return {estado:estado(),poses,instancias,agarres,particulas:recursos.particulasMago.capturar(),hechizo:recursos.hechizoMago.capturar(),rostros:[MOD.rostro?.capturar(s.actor.m)||null,MOD.rostro?.capturar(recursos.brazosFPS)||null],dir:s.actor.dir,faseActor:s.actor.fase,opacidadCasa:s.opacidadCasa,
        opacidades:casas.userData.ocultacion?.opacidades.slice(),sombras:mallasRuina.map(m=>m.castShadow),
        opacidad:[recursos.sello,recursos.humo,recursos.onda].map(m=>m.material.opacity)};
    }
    function mostrarCuadro(c){
      const e=c.estado;
      for(const k of ['fase','t','plano','tPlano','total','impactado','lluviaLiberada','tLluvia','golpeMago','duracionCarreraAnterior','casaDolly','inicios'])s[k]=e[k];
      s.opacidadCasa=c.opacidadCasa;s.actor.pos.fromArray(e.actor);s.actor.dir=c.dir;s.actor.fase=c.faseActor;terminado=e.terminado;derrumbe.value=e.derrumbe;
      tiempoPiso.value=e.pisoRoto?.edad??(e.impactado?e.derrumbe:-1);centroOnda.value.fromArray(e.pisoRoto?.centro||[0,0,0]);
      if(e.impactado)s.impacto=centroOnda.value.clone();
      nodosCine.forEach((n,i)=>{const j=i*12;n.position.fromArray(c.poses,j);n.quaternion.fromArray(c.poses,j+3).normalize();n.scale.fromArray(c.poses,j+7);n.visible=!!c.poses[j+10];if(n.isLight)n.intensity=c.poses[j+11];});
      for(const x of c.instancias){x.n.count=x.cantidad;x.n.instanceMatrix.array.set(x.i);x.n.instanceMatrix.needsUpdate=true;}
      for(const x of c.agarres||[])x.pesos.forEach((peso,i)=>x.n.morphTargetInfluences[i]=peso);
      if(c.rostros){MOD.rostro?.restaurar(s.actor.m,c.rostros[0]);MOD.rostro?.restaurar(recursos.brazosFPS,c.rostros[1]);}
      [recursos.sello,recursos.humo,recursos.onda].forEach((m,i)=>m.material.opacity=c.opacidad[i]);
      if(c.opacidades)casas.userData.ocultacion.opacidades.set(c.opacidades);mallasRuina.forEach((m,i)=>m.castShadow=c.sombras[i]);
      recursos.particulasMago.mostrar(c.particulas);recursos.cola.material.uniforms.uTiempo.value=s.total;ambienteLluvia(s.tLluvia,s.actor.pos);recursos.hechizoMago.mostrar(c.hechizo);
      actuacion.capaFPS(recursos.brazosFPS,s.fase==='ataquePOV');
      for(const raiz of [s.actor.m.raiz,recursos.grupo,recursos.brazosFPS.raiz])raiz.updateMatrixWorld(true);
      interfaz({fase:terminado?'fin':s.fase,negro:terminado?1:s.fase==='negro'?suave(s.t/.6):0});
    }
    return {iniciar,paso,cancelar,finalizar,estado,vistaEditor,respirarCamara,capturarCuadro,mostrarCuadro,muestraLosa,get activa(){return !!s;},get recursos(){return recursos;}};
  }
  window.CAOZ_ARPG_FINAL_MAGO=Object.freeze({fabrica,DURACIONES});
})();

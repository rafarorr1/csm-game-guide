/* El mago se deshace en su superficie y abre un pliegue de materia al volver.
   Cuatro mallas, sin postproceso ni luces adicionales. */
'use strict';
(function(){
  function fabrica(T,{grupo,mago,materia=null,reducido=false}){
    const V=T.Vector3,TAU=Math.PI*2,N=reducido?144:256,R=reducido?16:28,TRAMOS=8;
    const lim=x=>Math.max(0,Math.min(1,x)),suave=x=>{x=lim(x);return x*x*(3-2*x);};
    const azar=i=>{const x=Math.sin(i*127.1+31.7)*43758.5453;return x-Math.floor(x);};
    const disolucion={value:0},clones=new Map(),superficies=[],muestras=[],sombras=new Map();
    const origen=new V(),tejado=new V(),actor=new V(),frente=new V(),lado=new V(),p0=new V(),p1=new V(),p2=new V(),p3=new V();
    const foco=new V(),a=new V(),b=new V(),c=new V(),d=new V(),desvio=new V(),direccion=new V(),medio=new V();
    const objeto=new T.Object3D(),inversa=new T.Matrix4(),ejeY=new V(0,1,0),mundoMago=new V();
    let estado={fase:'oculto',t:0,duracion:1,desdeImpacto:0},preparado=false,edadSalida=0,duracionViaje=2.6;
    const particulas=new T.InstancedMesh(new T.OctahedronGeometry(.043,0),new T.MeshBasicMaterial({color:0x8bf7b7,toneMapped:false}),N);
    const estelas=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,5,1,true),new T.MeshBasicMaterial({color:0x40cf85,transparent:true,opacity:.34,depthWrite:false,toneMapped:false}),R*TRAMOS);
    particulas.name='Mago · fragmentos verdes de la silueta';estelas.name='Mago · estelas hacia el tejado';
    for(const m of [particulas,estelas]){m.count=0;m.visible=false;m.frustumCulled=false;m.castShadow=m.receiveShadow=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);grupo.add(m);}
    const color=new T.Color();for(let i=0;i<N;i++){color.setHex(i%9===0?0xd1ffe2:i%3===0?0x70e6a1:0x46bd7e);particulas.setColorAt(i,color);}particulas.instanceColor.needsUpdate=true;
    const centroPortal={value:new V()},pliegue={value:0},relojPortal={value:0},brilloPortal={value:0},portalQ=new T.Quaternion(),grupoQ=new T.Quaternion();
    const portal=new T.Mesh(new T.RingGeometry(.68,1,96,8),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
      uniforms:{uPortalTiempo:relojPortal,uPortalBrillo:brilloPortal},
      vertexShader:`varying vec2 vPortal;uniform float uPortalTiempo;
        void main(){vec3 p=position;float a=atan(p.y,p.x),r=length(p.xy);vPortal=p.xy;
          p.xy*=1.+.035*sin(a*7.-uPortalTiempo*19.)+.022*sin(a*13.+uPortalTiempo*11.);
          p.z+=sin(a*4.-uPortalTiempo*14.)*.15*(1.-r);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec2 vPortal;uniform float uPortalTiempo;uniform float uPortalBrillo;
        void main(){float r=length(vPortal),a=atan(vPortal.y,vPortal.x);
          float hilo=pow(.5+.5*sin(a*8.+r*41.-uPortalTiempo*24.),7.);
          float borde=exp(-pow((r-.86)/.025,2.))+.5*exp(-pow((r-.74)/.013,2.));
          float corte=smoothstep(.68,.74,r)*(1.-smoothstep(.94,1.,r));
          float alpha=(borde*.85+hilo*.38)*corte*uPortalBrillo;
          if(alpha<.003)discard;gl_FragColor=vec4(mix(vec3(.025,.65,.26),vec3(.64,1.5,.9),min(1.,borde)),alpha);
          #include <colorspace_fragment>
        }`}));
    portal.name='Mago · umbral de materia';portal.visible=false;portal.frustumCulled=false;portal.castShadow=portal.receiveShadow=false;grupo.add(portal);
    const restosCantidad=reducido?20:42,restos=new T.InstancedMesh(new T.BoxGeometry(1,.24,1,2,1,2),new T.MeshStandardMaterial({color:0x79747a,roughness:.96,metalness:0,emissive:0x073a21,emissiveIntensity:.35,flatShading:true}),restosCantidad);
    restos.name='Mago · tejas en el pliegue';restos.count=0;restos.visible=false;restos.frustumCulled=false;restos.castShadow=restos.receiveShadow=false;restos.instanceMatrix.setUsage(T.DynamicDrawUsage);grupo.add(restos);
    for(let i=0;i<restosCantidad;i++){color.setHex(i%3===0?0x9b8991:i%3===1?0x52655b:0x777181);restos.setColorAt(i,color);}restos.instanceColor.needsUpdate=true;
    // Ocho metros incluyen los tejados vecinos. La caída vertical conserva la
    // base de las casas; junto a los pies del mago no se levanta el apoyo.
    // La casa conserva su geometría y los otros shaders que ya tenga.
    const materialesMateria=new Set();materia?.traverse(m=>{
      if(!m.isMesh)return;for(const mat of Array.isArray(m.material)?m.material:[m.material]){
        if(!mat?.isMeshStandardMaterial||materialesMateria.has(mat))continue;materialesMateria.add(mat);
        const anterior=mat.onBeforeCompile,clave=mat.customProgramCacheKey();
        mat.onBeforeCompile=function(sh,r){anterior.call(this,sh,r);sh.uniforms.uCentroPortal=centroPortal;sh.uniforms.uPlieguePortal=pliegue;
          sh.vertexShader='uniform vec3 uCentroPortal;uniform float uPlieguePortal;\n'+sh.vertexShader;
          sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            if(abs(uPlieguePortal)>0.){
              vec3 mundoPortal=(modelMatrix*vec4(transformed,1.)).xyz,radialPortal=mundoPortal-uCentroPortal;
              float distanciaPortal=length(radialPortal.xz),cercaPortal=(1.-smoothstep(2.,8.,distanciaPortal))*(1.-smoothstep(2.2,8.,abs(radialPortal.y)));
              float fPortal=uPlieguePortal*cercaPortal;
              float levantarPortal=1.25*exp(-pow((distanciaPortal-2.4)/2.5,2.))*smoothstep(.4,1.2,distanciaPortal);
              vec3 deltaPortal=vec3(-radialPortal.z*.13-radialPortal.x*.22,levantarPortal,radialPortal.x*.13-radialPortal.z*.22)*fPortal;
              transformed+=vec3(dot(modelMatrix[0].xyz,deltaPortal)/dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,deltaPortal)/dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,deltaPortal)/dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
            }`);
        };mat.customProgramCacheKey=()=>clave+'-portal-materia-resorte-v2';mat.needsUpdate=true;
      }
    });
    // La magia que ya orbita al mago no forma parte de su cuerpo. Separar los
    // materiales evita que disolver la túnica borre también sus efectos vecinos.
    const excluida=m=>{for(let n=m;n&&n!==mago;n=n.parent)if(n.name==='Hechizo verde')return true;return false;};
    mago.traverse(m=>{
      if(!m.isMesh||m.isInstancedMesh||!m.geometry?.attributes.position||excluida(m))return;
      superficies.push(m);sombras.set(m,m.castShadow);
      const transformar=original=>{
        if(clones.has(original))return clones.get(original);
        const mat=original.clone(),anterior=original.onBeforeCompile,clave=original.customProgramCacheKey();
        mat.onBeforeCompile=function(sh,r){
          anterior.call(this,sh,r);sh.uniforms.uDisolucionMago=disolucion;
          sh.vertexShader='varying vec3 vMateriaMago;\n'+sh.vertexShader;
          sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMateriaMago=transformed;');
          sh.fragmentShader='varying vec3 vMateriaMago;uniform float uDisolucionMago;\n'+sh.fragmentShader;
          sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
            float granoMago=fract(sin(dot(floor(vMateriaMago*18.),vec3(12.9898,78.233,37.719)))*43758.5453);
            if(uDisolucionMago>=.9999||granoMago<uDisolucionMago)discard;
            float bordeMago=(1.-smoothstep(0.,.11,granoMago-uDisolucionMago))*step(.0001,uDisolucionMago);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.88,.43),bordeMago*.85);`);
        };
        mat.customProgramCacheKey=()=>clave+'-disolucion-mago-verde-v1';clones.set(original,mat);return mat;
      };
      m.material=Array.isArray(m.material)?m.material.map(transformar):transformar(m.material);
    });
    function puntoSuperficie(muestra,salida){
      const pos=muestra.m.geometry.attributes.position,[i,j,k]=muestra.indices,w=muestra.pesos;
      salida.fromBufferAttribute(pos,i).multiplyScalar(w[0]);b.fromBufferAttribute(pos,j);salida.addScaledVector(b,w[1]);b.fromBufferAttribute(pos,k);salida.addScaledVector(b,w[2]);
      return salida.applyMatrix4(muestra.m.matrixWorld);
    }
    function preparar({origen:base,techo,actor:posicion,rumbo=0}){
      origen.copy(base);tejado.copy(techo);actor.copy(posicion);frente.set(Math.sin(rumbo),0,Math.cos(rumbo));lado.set(Math.cos(rumbo),0,-Math.sin(rumbo));
      p0.copy(actor).addScaledVector(frente,2.6);p0.y=actor.y+1.8;
      p1.copy(p0).addScaledVector(lado,5.6).addScaledVector(frente,.7);p1.y=actor.y+2.6;
      p2.copy(tejado).addScaledVector(frente,4.1).addScaledVector(lado,3);p2.y=tejado.y+2.2;
      p3.copy(tejado).add(new V(0,1.3,0));
      mago.updateWorldMatrix(true,true);grupo.updateWorldMatrix(true,false);inversa.copy(grupo.matrixWorld).invert();mago.getWorldPosition(mundoMago);
      const triangulos=[];let area=0;
      for(const m of superficies){const pos=m.geometry.attributes.position,idx=m.geometry.index,cuenta=idx?.count||pos.count;
        for(let i=0;i<cuenta;i+=3){const ids=idx?[idx.getX(i),idx.getX(i+1),idx.getX(i+2)]:[i,i+1,i+2];
          a.fromBufferAttribute(pos,ids[0]).applyMatrix4(m.matrixWorld);b.fromBufferAttribute(pos,ids[1]).applyMatrix4(m.matrixWorld);c.fromBufferAttribute(pos,ids[2]).applyMatrix4(m.matrixWorld);
          d.subVectors(b,a);desvio.subVectors(c,a);const tam=d.cross(desvio).length()*.5;if(tam<1e-10)continue;
          area+=tam;triangulos.push({m,indices:ids,area});
        }
      }
      muestras.length=0;
      for(let i=0;i<N&&triangulos.length;i++){
        const buscar=(i+.5)/N*area;let lo=0,hi=triangulos.length-1;while(lo<hi){const mitad=(lo+hi)>>1;if(triangulos[mitad].area<buscar)lo=mitad+1;else hi=mitad;}
        const tri=triangulos[lo],raiz=Math.sqrt(azar(i*3+1)),v=azar(i*3+2),muestra={m:tri.m,indices:tri.indices,pesos:[1-raiz,raiz*(1-v),raiz*v],origen:new V(),velocidad:new V(),semilla:azar(i*3+3),giro:azar(i+991)*TAU};
        puntoSuperficie(muestra,muestra.origen).add(origen).sub(mundoMago);
        const angulo=i*2.39996323,vertical=azar(i+512)*1.6-.35,horizontal=Math.sqrt(Math.max(.12,1-vertical*vertical));
        muestra.velocidad.set(Math.cos(angulo)*horizontal,vertical,Math.sin(angulo)*horizontal).normalize().multiplyScalar(4.4+azar(i+143)*4);
        muestras.push(muestra);
      }
      preparado=true;edadSalida=0;duracionViaje=2.6;restaurar();return muestras.length;
    }
    function focoViaje(t,duracion=2.6){
      const k=suave(t/Math.max(.001,duracion)),u=1-k;
      return foco.copy(p0).multiplyScalar(u*u*u).addScaledVector(p1,3*u*u*k).addScaledVector(p2,3*u*k*k).addScaledVector(p3,k*k*k);
    }
    function estallar(i,t,salida){
      const m=muestras[i],edad=Math.max(0,t),avance=(1-Math.exp(-edad*2))/2,deriva=Math.max(0,edad-.45);
      salida.copy(m.origen).addScaledVector(m.velocidad,avance);
      salida.x+=Math.sin(m.giro+deriva*1.15)*deriva*.11;salida.z+=Math.cos(m.giro+deriva*.85)*deriva*.11;salida.y+=deriva*.10;
      salida.y=Math.max(.12,salida.y);return salida;
    }
    function viajar(i,t,duracion,salida){
      const m=muestras[i],demora=m.semilla*.27,k=lim((t-demora)/Math.max(.1,duracion-demora)),tiempo=k*duracion;
      salida.copy(focoViaje(tiempo,duracion));
      const a=m.giro+k*TAU*1.3,radio=(.12+.4*Math.sin(k*Math.PI))*(.45+m.semilla);
      salida.x+=Math.cos(a)*radio;salida.y+=Math.sin(a*1.3)*radio*.75;salida.z+=Math.sin(a)*radio;
      // El primer cuadro del POV es exactamente la nube dispersa del cuadro
      // anterior. Se reúne durante el arranque, sin teletransportar partículas.
      const union=suave(t/.48);estallar(i,edadSalida+Math.max(0,t),c);return salida.lerp(c,1-union);
    }
    function reunir(i,t,duracion,salida){
      const k=lim(t/Math.max(.001,duracion));viajar(i,duracionViaje,duracionViaje,salida);puntoSuperficie(muestras[i],c);
      const unir=suave(k/.83);salida.lerp(c,unir);
      const m=muestras[i],radio=Math.sin(k*Math.PI)*.72;salida.x+=Math.cos(m.giro+k*9)*radio;salida.z+=Math.sin(m.giro+k*9)*radio;salida.y+=Math.sin(m.giro+k*9)*radio*.42;return salida;
    }
    function posicion(i,desfase,salida){
      if(estado.fase==='explosion')return estallar(i,Math.max(0,estado.desdeImpacto-desfase),salida);
      if(estado.fase==='viaje')return viajar(i,Math.max(0,estado.t-desfase),estado.duracion,salida);
      return reunir(i,Math.max(0,estado.t-desfase),estado.duracion,salida);
    }
    function aplicarSombras(){for(const [m,original]of sombras)m.castShadow=disolucion.value===0&&original;}
    function tensionMateria(t,duracion){
      // La materia resiste al principio y cede progresivamente. Se suelta en
      // el mismo instante en que la disolución deja visible todo el cuerpo.
      const soltar=duracion*.94;
      if(t<=soltar)return Math.pow(suave(t/soltar),1.45);
      // Resorte analítico: velocidad cero al soltar, rebote al lado contrario
      // y reposo exacto .72 s después. No integra deltas ni acumula errores.
      const k=(t-soltar)/.72;if(k>=1)return 0;
      return Math.exp(-4*k)*(Math.cos(TAU*k)+4/TAU*Math.sin(TAU*k))*(1-suave((k-.75)/.25));
    }
    function actualizarPortal(){
      const t=estado.t,activo=estado.fase==='reunion'&&t>0&&t<1,abrir=activo?suave(t/.17)*(1-suave((t-.70)/.30)):0;
      const materiaActiva=estado.fase==='reunion'||estado.fase==='resorte',edadMateria=estado.fase==='resorte'?estado.duracion+t:t;
      relojPortal.value=t;brilloPortal.value=abrir;pliegue.value=materiaActiva?tensionMateria(edadMateria,estado.duracion)*(reducido?.55:1):0;
      mago.getWorldPosition(centroPortal.value);centroPortal.value.y+=1.15;
      portal.visible=restos.visible=activo;restos.count=activo?restosCantidad:0;if(!activo)return;
      mago.getWorldQuaternion(portalQ);grupo.getWorldQuaternion(grupoQ).invert();
      portal.position.copy(centroPortal.value).applyMatrix4(inversa);portal.quaternion.copy(grupoQ).multiply(portalQ);portal.scale.set(1.85*abrir,2.05*abrir,1);
      for(let i=0;i<restosCantidad;i++){
        const semilla=azar(i+181),radio=2.2+semilla*1.05,angulo=i*2.399963+t*TAU*(.75+semilla*.7),levantar=Math.sin(Math.PI*t),r=radio*(1-.45*levantar);
        a.set(Math.cos(angulo)*r,-1.05+levantar*(.75+semilla*1.15),Math.sin(angulo)*r).add(centroPortal.value);
        objeto.position.copy(a).applyMatrix4(inversa);objeto.rotation.set(t*5+semilla*4,angulo,-t*7+semilla*3);
        const tam=(.13+semilla*.17)*Math.sqrt(abrir);objeto.scale.set(tam,tam*(.6+levantar*.3),tam*.65);objeto.updateMatrix();restos.setMatrixAt(i,objeto.matrix);
      }restos.instanceMatrix.needsUpdate=true;
    }
    function restaurar(){estado={fase:'oculto',t:0,duracion:1,desdeImpacto:0};disolucion.value=0;particulas.count=estelas.count=restos.count=0;particulas.visible=estelas.visible=portal.visible=restos.visible=false;pliegue.value=brilloPortal.value=relojPortal.value=0;aplicarSombras();}
    function actualizar({fase='oculto',t=0,duracion,desdeImpacto=t}={}){
      if(!preparado||fase==='oculto'){restaurar();return;}
      estado={fase,t:Math.max(0,t),duracion:Math.max(.001,duracion||(fase==='viaje'?2.6:['reunion','resorte'].includes(fase)?1.4:1)),desdeImpacto:Math.max(0,desdeImpacto)};
      if(fase==='viaje'){edadSalida=Math.max(0,estado.desdeImpacto-estado.t);duracionViaje=estado.duracion;}
      if(fase==='reunion')edadSalida=Math.max(0,estado.desdeImpacto-estado.t-duracionViaje);
      mago.updateWorldMatrix(true,true);grupo.updateWorldMatrix(true,false);inversa.copy(grupo.matrixWorld).invert();
      actualizarPortal();
      if(fase==='resorte'){
        disolucion.value=0;particulas.count=estelas.count=0;particulas.visible=estelas.visible=false;aplicarSombras();return;
      }
      const k=lim(estado.t/estado.duracion),salida=fase==='reunion'?1-suave((k-.56)/.44):fase==='explosion'?suave(estado.desdeImpacto/.13):1;
      disolucion.value=fase==='explosion'?suave(estado.desdeImpacto/.22):fase==='reunion'?1-suave((k-.28)/.66):1;
      // El mapa de sombras no ejecuta el shader de color. Durante la materia
      // dispersa se retira su sombra sólida, que delataría un cuerpo invisible.
      aplicarSombras();
      particulas.visible=estelas.visible=salida>0;particulas.count=salida>0?muestras.length:0;
      for(let i=0;i<particulas.count;i++){
        const m=muestras[i];posicion(i,0,a);objeto.position.copy(a).applyMatrix4(inversa);objeto.rotation.set(m.giro+estado.desdeImpacto,m.giro*.7+estado.desdeImpacto*1.2,m.giro*.3);
        objeto.scale.setScalar((.52+m.semilla*.75)*salida);objeto.updateMatrix();particulas.setMatrixAt(i,objeto.matrix);
      }
      particulas.instanceMatrix.needsUpdate=true;let n=0;
      for(let j=0;j<R&&salida>0;j++){
        const i=Math.floor(j/R*muestras.length);if(!muestras[i])continue;
        for(let paso=0;paso<TRAMOS;paso++){
          const demora=paso*.014;posicion(i,demora,a);posicion(i,demora+.014,d);direccion.subVectors(a,d);const largo=direccion.length();
          medio.copy(a).add(d).multiplyScalar(.5);objeto.position.copy(medio).applyMatrix4(inversa);
          direccion.transformDirection(inversa);objeto.quaternion.setFromUnitVectors(ejeY,direccion.lengthSq()?direccion:ejeY);
          const radio=(.0015+Math.pow(1-paso/TRAMOS,1.6)*.010)*salida;objeto.scale.set(radio,Math.max(.00001,largo),radio);objeto.updateMatrix();estelas.setMatrixAt(n++,objeto.matrix);
        }
      }
      estelas.count=n;estelas.instanceMatrix.needsUpdate=true;
    }
    // Las matrices ya se guardan en el cache de cuadros del editor. Sólo faltan
    // el umbral del material y el reloj usado al inspeccionar la secuencia.
    function capturar(){return {disolucion:disolucion.value,estado:{...estado},edadSalida,duracionViaje,portal:{centro:centroPortal.value.toArray(),pliegue:pliegue.value,t:relojPortal.value,brillo:brilloPortal.value}};}
    function mostrar(cuadro){if(!cuadro)return;disolucion.value=cuadro.disolucion;estado={...cuadro.estado};edadSalida=cuadro.edadSalida;duracionViaje=cuadro.duracionViaje;const p=cuadro.portal;centroPortal.value.fromArray(p?.centro||[0,0,0]);pliegue.value=p?.pliegue||0;relojPortal.value=p?.t||0;brilloPortal.value=p?.brillo||0;aplicarSombras();}
    return {preparar,actualizar,focoViaje,restaurar,capturar,mostrar,particulas,estelas,portal,restos,pliegue,disolucion,get estado(){return {...estado};},get cantidad(){return muestras.length;}};
  }
  window.CAOZ_ARPG_MAGO_PARTICULAS={fabrica};
})();

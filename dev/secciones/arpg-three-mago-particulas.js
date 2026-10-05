/* El mago se deshace en su propia superficie y la reúne sobre el tejado.
   Dos mallas instanciadas; no añade luces ni trabajo fuera de la cinemática. */
'use strict';
(function(){
  function fabrica(T,{grupo,mago,reducido=false}){
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
      const m=muestras[i],radio=Math.sin(k*Math.PI)*.28;salida.x+=Math.cos(m.giro+k*4)*radio;salida.z+=Math.sin(m.giro+k*4)*radio;return salida;
    }
    function posicion(i,desfase,salida){
      if(estado.fase==='explosion')return estallar(i,Math.max(0,estado.desdeImpacto-desfase),salida);
      if(estado.fase==='viaje')return viajar(i,Math.max(0,estado.t-desfase),estado.duracion,salida);
      return reunir(i,Math.max(0,estado.t-desfase),estado.duracion,salida);
    }
    function aplicarSombras(){for(const [m,original]of sombras)m.castShadow=disolucion.value===0&&original;}
    function restaurar(){estado={fase:'oculto',t:0,duracion:1,desdeImpacto:0};disolucion.value=0;particulas.count=estelas.count=0;particulas.visible=estelas.visible=false;aplicarSombras();}
    function actualizar({fase='oculto',t=0,duracion,desdeImpacto=t}={}){
      if(!preparado||fase==='oculto'){restaurar();return;}
      estado={fase,t:Math.max(0,t),duracion:Math.max(.001,duracion||(fase==='viaje'?2.6:fase==='reunion'?1.4:1)),desdeImpacto:Math.max(0,desdeImpacto)};
      if(fase==='viaje'){edadSalida=Math.max(0,estado.desdeImpacto-estado.t);duracionViaje=estado.duracion;}
      if(fase==='reunion')edadSalida=Math.max(0,estado.desdeImpacto-estado.t-duracionViaje);
      mago.updateWorldMatrix(true,true);grupo.updateWorldMatrix(true,false);inversa.copy(grupo.matrixWorld).invert();
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
    function capturar(){return {disolucion:disolucion.value,estado:{...estado},edadSalida,duracionViaje};}
    function mostrar(cuadro){if(!cuadro)return;disolucion.value=cuadro.disolucion;estado={...cuadro.estado};edadSalida=cuadro.edadSalida;duracionViaje=cuadro.duracionViaje;aplicarSombras();}
    return {preparar,actualizar,focoViaje,restaurar,capturar,mostrar,particulas,estelas,disolucion,get estado(){return {...estado};},get cantidad(){return muestras.length;}};
  }
  window.CAOZ_ARPG_MAGO_PARTICULAS={fabrica};
})();

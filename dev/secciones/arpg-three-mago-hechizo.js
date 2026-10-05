/* El hechizo reúne una tormenta verde tras el mago: rayos y ambiente absolutos,
   reversibles al buscar cuadros. No crea luces ni sombras adicionales. */
'use strict';
(function(){
  function fabrica(T,{grupo,escena,mago,reducido=false}){
    const V=T.Vector3,lim=x=>Math.max(0,Math.min(1,x)),suave=x=>{x=lim(x);return x*x*(3-2*x);};
    const azar=i=>{const n=Math.sin(i*127.1+91.7)*43758.5453;return n-Math.floor(n);};
    const luces=[];escena.traverse(n=>{if(n.isAmbientLight||n.isHemisphereLight||n.isDirectionalLight)luces.push(n);});
    const cantidad=reducido?3:4,tramos=reducido?12:18,ramas=reducido?5:7,capacidad=cantidad*(tramos+ramas*2);
    const geometria=new T.CylinderGeometry(1,1,1,5,1,true);
    const nucleo=new T.InstancedMesh(geometria,new T.MeshBasicMaterial({color:0xc9ffe0,toneMapped:false}),capacidad);
    const contorno=new T.InstancedMesh(geometria,new T.MeshBasicMaterial({color:0x27d779,transparent:true,opacity:.30,depthWrite:false,toneMapped:false}),capacidad);
    nucleo.name='Mago · núcleos de rayos verdes';contorno.name='Mago · contorno de rayos verdes';
    for(const m of [contorno,nucleo]){m.count=0;m.visible=false;m.frustumCulled=false;m.castShadow=m.receiveShadow=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);grupo.add(m);}
    const origen=new V(),frente=new V(),lado=new V(),a=new V(),b=new V(),eje=new V(),medio=new V(),ejeY=new V(0,1,0),objeto=new T.Object3D(),inversa=new T.Matrix4(),giro=new T.Quaternion();
    const rayos=[];let base=null,preparado=false,estado={t:-1,duracion:3,progreso:0,pulso:0,oscuridad:0,activo:false};
    function ambiente(){return {fondo:escena.background?.isColor?escena.background.toArray():null,niebla:escena.fog?.color?.toArray()||null,luces:luces.map(l=>l.intensity)};}
    function ponerAmbiente(datos){if(!datos)return;if(datos.fondo&&escena.background?.isColor)escena.background.fromArray(datos.fondo);if(datos.niebla&&escena.fog?.color)escena.fog.color.fromArray(datos.niebla);luces.forEach((l,i)=>{if(Number.isFinite(datos.luces[i]))l.intensity=datos.luces[i];});}
    function preparar(){
      // Captura el ambiente vigente al comenzar, nunca el resultado ya oscurecido
      // de otro cuadro. Repetir preparar mientras está activo no acumula filtros.
      if(preparado)return;
      base=ambiente();mago.updateWorldMatrix(true,false);mago.getWorldPosition(origen);mago.getWorldQuaternion(giro);frente.set(0,0,1).applyQuaternion(giro).setY(0).normalize();lado.set(frente.z,0,-frente.x);
      if(frente.lengthSq()<.1){frente.set(0,0,1);lado.set(1,0,0);}
      rayos.length=0;
      for(let r=0;r<cantidad;r++){
        const lateral=[-4.4,4.8,-1.9,2.5][r],distancia=[3.8,5.4,7,3.3][r],fin=origen.clone().addScaledVector(lado,lateral).addScaledVector(frente,-distancia);fin.y=origen.y+.12;
        const inicio=fin.clone().addScaledVector(lado,(azar(r+70)-.5)*4).addScaledVector(frente,(azar(r+82)-.5)*2);inicio.y+=12+azar(r+23)*4;
        const puntos=[];
        for(let i=0;i<=tramos;i++){const k=i/tramos,p=inicio.clone().lerp(fin,k),amplitud=Math.sin(k*Math.PI)*.95;p.addScaledVector(lado,(azar(r*100+i*3+1)-.5)*amplitud*2);p.addScaledVector(frente,(azar(r*100+i*3+2)-.5)*amplitud*1.1);puntos.push(p);}
        const segmentos=[];for(let i=0;i<tramos;i++)segmentos.push({a:puntos[i],b:puntos[i+1],inicio:i/tramos,fin:(i+1)/tramos,grueso:1});
        for(let rama=0;rama<2;rama++){
          const n=Math.floor(tramos*(rama===0?.34:.63)),de=puntos[n],hasta=de.clone().addScaledVector(lado,(rama?1:-1)*(1.7+azar(r*7+rama+3)*2.2)).addScaledVector(frente,-.7);hasta.y-=2.6+azar(r*9+rama+73)*2.2;
          let anterior=de;
          for(let j=1;j<=ramas;j++){const k=j/ramas,p=de.clone().lerp(hasta,k);p.addScaledVector(lado,(azar(r*23+rama*73+j)-.5)*.8*Math.sin(k*Math.PI));
            const empieza=n/tramos+(j-1)/ramas*.19;segmentos.push({a:anterior,b:p,inicio:empieza,fin:empieza+.19/ramas,grueso:.54});anterior=p;
          }
        }
        rayos.push({cuando:reducido?[.48,1.32,2.3][r]:[.45,1.05,1.72,2.38][r],duracion:.36+r*.022,segmentos});
      }
      preparado=true;
    }
    function pintarAmbiente(){
      if(!base)return;const f=1-estado.oscuridad*.28;
      if(base.fondo&&escena.background?.isColor)escena.background.fromArray(base.fondo).multiplyScalar(f);
      if(base.niebla&&escena.fog?.color)escena.fog.color.fromArray(base.niebla).multiplyScalar(f);
      // El hemisferio conserva detalle en la cara y los brazos, incluso cuando
      // el fondo se oscurece. Los rayos no producen flashes a pantalla completa.
      luces.forEach((l,i)=>l.intensity=base.luces[i]*(1-estado.oscuridad*(l.isDirectionalLight?.22:.18)));
    }
    function actualizar(t,duracion=3){
      if(!Number.isFinite(t)||t<0){restaurar();return {...estado};}preparar();
      const segundos=Math.max(.001,duracion),tiempo=t/segundos*3;
      estado={t,duracion:segundos,progreso:lim(t/segundos),pulso:0,oscuridad:suave(t/Math.min(1.45,segundos*.7)),activo:t<segundos};
      pintarAmbiente();grupo.updateWorldMatrix(true,false);inversa.copy(grupo.matrixWorld).invert();let cuenta=0;
      for(const r of rayos){
        const edad=tiempo-r.cuando;if(edad<0||edad>=r.duracion||t>=segundos)continue;
        const pulso=suave(edad/.025)*(1-suave((edad-.12)/(r.duracion-.12))),descenso=suave(edad/.115);estado.pulso=Math.max(estado.pulso,pulso);
        for(const s of r.segmentos){
          const dibujado=lim((descenso-s.inicio)/(s.fin-s.inicio));if(dibujado<=0||pulso<=0)continue;
          a.copy(s.a).applyMatrix4(inversa);b.copy(s.a).lerp(s.b,dibujado).applyMatrix4(inversa);eje.subVectors(b,a);const largo=eje.length();if(largo<.00001)continue;
          medio.copy(a).add(b).multiplyScalar(.5);objeto.position.copy(medio);objeto.quaternion.setFromUnitVectors(ejeY,eje.divideScalar(largo));
          const radio=(reducido?.023:.027)*s.grueso*pulso;objeto.scale.set(radio,largo,radio);objeto.updateMatrix();nucleo.setMatrixAt(cuenta,objeto.matrix);
          objeto.scale.set(radio*3.9,largo,radio*3.9);objeto.updateMatrix();contorno.setMatrixAt(cuenta++,objeto.matrix);
        }
      }
      for(const m of [nucleo,contorno]){m.count=cuenta;m.visible=cuenta>0;m.instanceMatrix.needsUpdate=true;}
      return {...estado};
    }
    function restaurar(){
      if(preparado)ponerAmbiente(base);preparado=false;base=null;estado={t:-1,duracion:3,progreso:0,pulso:0,oscuridad:0,activo:false};
      for(const m of [nucleo,contorno]){m.count=0;m.visible=false;}
    }
    function capturar(){return {estado:{...estado},preparado,base:base?{fondo:base.fondo?.slice()||null,niebla:base.niebla?.slice()||null,luces:base.luces.slice()}:null,ambiente:ambiente()};}
    function mostrar(cuadro){if(!cuadro)return;estado={...cuadro.estado};preparado=cuadro.preparado;base=cuadro.base?{fondo:cuadro.base.fondo?.slice()||null,niebla:cuadro.base.niebla?.slice()||null,luces:cuadro.base.luces.slice()}:null;ponerAmbiente(cuadro.ambiente);}
    return {preparar,actualizar,restaurar,capturar,mostrar,nucleo,contorno,get estado(){return {...estado};}};
  }
  window.CAOZ_ARPG_MAGO_HECHIZO={fabrica};
})();

/* Tormenta lejana: las descargas revelan bancos de nubes y el meteorito los
   atraviesa. Tres llamadas de dibujo, sin texturas, luces ni sombras nuevas. */
'use strict';
(function(){
  function fabrica(T,{grupo,escena,mago,manos=[],reducido=false}){
    const V=T.Vector3,lim=x=>Math.max(0,Math.min(1,x)),suave=x=>{x=lim(x);return x*x*(3-2*x);};
    const azar=i=>{const n=Math.sin(i*127.1+91.7)*43758.5453;return n-Math.floor(n);};
    const luces=[];escena.traverse(n=>{if(n.isAmbientLight||n.isHemisphereLight||n.isDirectionalLight)luces.push(n);});
    // Un primer canal se reenciende enseguida. Tras el silencio, otros dos
    // sistemas responden a distancias y tiempos distintos; no es un metrónomo.
    const guionCompleto=[
      {cuando:.28,duracion:.09,lateral:-38,distancia:105,canal:0,fuerza:.58,ancho:.11},
      {cuando:.445,duracion:.17,lateral:-38,distancia:105,canal:0,fuerza:1.08,ancho:.15},
      {cuando:1.73,duracion:.255,lateral:65,distancia:162,canal:2,fuerza:.92,ancho:.19},
      {cuando:1.825,duracion:.145,lateral:-185,distancia:231,canal:3,fuerza:.65,ancho:.22},
      {cuando:2.615,duracion:.305,lateral:148,distancia:195,canal:4,fuerza:1.10,ancho:.20},
      {cuando:2.654,duracion:.19,lateral:18,distancia:178,canal:5,fuerza:.90,ancho:.16}
    ];
    const guion=reducido?[guionCompleto[1],guionCompleto[2],guionCompleto[5]]:guionCompleto;
    const cantidad=guion.length,tramos=reducido?12:18,ramas=reducido?5:7,tramosManos=reducido?20:32,capacidad=cantidad*(tramos+ramas*2)+tramosManos*2;
    const geometria=new T.CylinderGeometry(1,1,1,5,1,true);
    const nucleo=new T.InstancedMesh(geometria,new T.MeshBasicMaterial({color:0xc9ffe0,toneMapped:false,fog:false}),capacidad);
    const contorno=new T.InstancedMesh(geometria,new T.MeshBasicMaterial({color:0x27d779,transparent:true,opacity:.30,depthWrite:false,toneMapped:false,fog:false}),capacidad);
    nucleo.name='Mago · núcleos de rayos verdes';contorno.name='Mago · contorno de rayos verdes';
    for(const m of [contorno,nucleo]){m.count=0;m.visible=false;m.frustumCulled=false;m.castShadow=m.receiveShadow=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);grupo.add(m);}
    const nubesCantidad=reducido?24:42,geoNubes=new T.PlaneGeometry(1,1),semillas=new Float32Array(nubesCantidad),densidades=new Float32Array(nubesCantidad);
    for(let i=0;i<nubesCantidad;i++){semillas[i]=azar(i+831)*41;densidades[i]=.57+azar(i+718)*.25;}
    geoNubes.setAttribute('aSemilla',new T.InstancedBufferAttribute(semillas,1));geoNubes.setAttribute('aDensidad',new T.InstancedBufferAttribute(densidades,1));
    const uniformes={uTiempo:{value:0},uPresencia:{value:0},uNoche:{value:0},uCulminacion:{value:0},uResplandor:{value:0},uRayos:{value:Array.from({length:8},()=>new T.Vector4())},uMeteorito:{value:new T.Vector4()},uEdadMeteorito:{value:0}};
    const matNubes=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide,uniforms:uniformes,
      vertexShader:`attribute float aSemilla;attribute float aDensidad;
        varying vec2 vUv;varying vec3 vMundo;varying float vSemilla;varying float vDensidad;
        uniform vec4 uMeteorito;
        void main(){
          vec3 centro=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
          float ancho=length((modelMatrix*instanceMatrix)[0].xyz),alto=length((modelMatrix*instanceMatrix)[1].xyz);
          vec3 derecha=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
          vec3 arriba=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
          vec3 mundo=centro+derecha*position.x*ancho+arriba*position.y*alto;
          vec3 desdeMeteoro=mundo-uMeteorito.xyz;float cerca=exp(-dot(desdeMeteoro,desdeMeteoro)/100.)*uMeteorito.w;
          mundo+=normalize(desdeMeteoro+vec3(.001))*.8*cerca;
          vUv=uv;vMundo=mundo;vSemilla=aSemilla;vDensidad=aDensidad;
          gl_Position=projectionMatrix*viewMatrix*vec4(mundo,1.);
        }`,
      fragmentShader:`varying vec2 vUv;varying vec3 vMundo;varying float vSemilla;varying float vDensidad;
        uniform float uTiempo;uniform float uPresencia;uniform float uNoche;uniform float uCulminacion;uniform float uResplandor;uniform vec4 uRayos[8];uniform vec4 uMeteorito;uniform float uEdadMeteorito;
        float hashNube(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
        float ruidoNube(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashNube(i),hashNube(i+vec2(1.,0.)),f.x),mix(hashNube(i+vec2(0.,1.)),hashNube(i+vec2(1.,1.)),f.x),f.y);}
        float vapor(vec2 p){return ruidoNube(p)*.57+ruidoNube(p*2.07+vec2(13.1,7.7))*.28+ruidoNube(p*4.13+vec2(7.4,17.9))*.15;}
        void main(){
          vec2 q=(vUv-.5)*vec2(4.6,3.3)+vec2(vSemilla,uTiempo*.027);float n=vapor(q*1.45);
          float borde=1.-length((vUv-.5)*vec2(2.05,2.2));
          float forma=smoothstep(.02,.45,borde+(n-.5)*.52)*smoothstep(.19,.67,n);
          float alpha=forma*vDensidad*uPresencia;if(alpha<.004)discard;
          float luz=0.;for(int i=0;i<8;i++){vec3 d=vMundo-uRayos[i].xyz;luz+=exp(-dot(d,d)/(i<6?950.:7200.))*uRayos[i].w;}
          vec3 desdeMeteoro=vMundo-uMeteorito.xyz;float distancia=length(desdeMeteoro);
          float meteoro=exp(-distancia*distancia/105.)*uMeteorito.w;
          float hueco=(1.-smoothstep(1.8,6.8,distancia))*uMeteorito.w;
          vec3 color=mix(vec3(.028,.039,.049),vec3(.017,.024,.033),uNoche)*(0.7+n*.9);
          color+=vec3(.026,.27,.09)*min(3.2,luz)*(.55+n*.75);
          color+=vec3(.03,.13,.058)*max(uCulminacion,uResplandor)*(.5+n);
          color+=vec3(.065,.55,.18)*meteoro*(.75+.25*sin(uEdadMeteorito*7.));
          alpha*=1.-hueco*.86;if(alpha<.003)discard;
          gl_FragColor=vec4(color,alpha);
          #include <colorspace_fragment>
        }`});
    const nubes=new T.InstancedMesh(geoNubes,matNubes,nubesCantidad);nubes.name='Mago · nubes lejanas y paso del meteorito';nubes.count=0;nubes.visible=false;nubes.frustumCulled=false;nubes.castShadow=nubes.receiveShadow=false;nubes.renderOrder=-1;grupo.add(nubes);
    const origen=new V(),frente=new V(),lado=new V(),a=new V(),b=new V(),eje=new V(),medio=new V(),ejeY=new V(0,1,0),objeto=new T.Object3D(),inversa=new T.Matrix4(),giro=new T.Quaternion(),desdeCielo=new V(),impacto=new V(),manoInicio=new V(),manoDestino=new V(),puntoMano=new V(),verdeCielo=new T.Color(.045,.14,.079);
    const rayos=[];let base=null,preparado=false,estado={t:-1,duracion:3,progreso:0,pulso:0,pulsoFinal:0,resplandorFinal:0,oscuridad:0,activo:false};
    function ambiente(){return {fondo:escena.background?.isColor?escena.background.toArray():null,niebla:escena.fog?.color?.toArray()||null,luces:luces.map(l=>l.intensity)};}
    function ponerAmbiente(datos){if(!datos)return;if(datos.fondo&&escena.background?.isColor)escena.background.fromArray(datos.fondo);if(datos.niebla&&escena.fog?.color)escena.fog.color.fromArray(datos.niebla);luces.forEach((l,i)=>{if(Number.isFinite(datos.luces[i]))l.intensity=datos.luces[i];});}
    function preparar(opciones={}){
      // Captura el ambiente vigente al comenzar, nunca el resultado ya oscurecido
      // de otro cuadro. Repetir preparar mientras está activo no acumula filtros.
      if(preparado)return;
      base=ambiente();mago.updateWorldMatrix(true,false);mago.getWorldPosition(origen);mago.getWorldQuaternion(giro);frente.set(0,0,1).applyQuaternion(giro).setY(0).normalize();lado.set(frente.z,0,-frente.x);
      if(frente.lengthSq()<.1){frente.set(0,0,1);lado.set(1,0,0);}
      desdeCielo.copy(opciones.cielo||origen.clone().addScaledVector(frente,-12).setY(54));impacto.copy(opciones.impacto||origen.clone().addScaledVector(frente,18).setY(1));
      rayos.length=0;
      for(let r=0;r<cantidad;r++){
        const meta=guion[r],{lateral,distancia,canal}=meta,fin=origen.clone().addScaledVector(lado,lateral).addScaledVector(frente,-distancia);fin.y=origen.y+10+distancia*.09;
        const inicio=fin.clone().addScaledVector(lado,(azar(canal+70)-.5)*17).addScaledVector(frente,(azar(canal+82)-.5)*11);inicio.y+=39+distancia*.15+azar(canal+23)*19;
        const puntos=[];
        for(let i=0;i<=tramos;i++){const k=i/tramos,p=inicio.clone().lerp(fin,k),amplitud=Math.sin(k*Math.PI)*(2.8+distancia*.01);p.addScaledVector(lado,(azar(canal*100+i*3+1)-.5)*amplitud*2);p.addScaledVector(frente,(azar(canal*100+i*3+2)-.5)*amplitud*1.1);puntos.push(p);}
        const segmentos=[];for(let i=0;i<tramos;i++)segmentos.push({a:puntos[i],b:puntos[i+1],inicio:i/tramos,fin:(i+1)/tramos,grueso:1});
        for(let rama=0;rama<2;rama++){
          const n=Math.floor(tramos*(rama===0?.34:.63)),de=puntos[n],hasta=de.clone().addScaledVector(lado,(rama?1:-1)*(5+azar(canal*7+rama+3)*6)).addScaledVector(frente,-2);hasta.y-=7+azar(canal*9+rama+73)*5;
          let anterior=de;
          for(let j=1;j<=ramas;j++){const k=j/ramas,p=de.clone().lerp(hasta,k);p.addScaledVector(lado,(azar(canal*23+rama*73+j)-.5)*2.3*Math.sin(k*Math.PI));
            const empieza=n/tramos+(j-1)/ramas*.19;segmentos.push({a:anterior,b:p,inicio:empieza,fin:empieza+.19/ramas,grueso:.54});anterior=p;
          }
        }
        rayos.push({...meta,segmentos,foco:inicio.clone().lerp(fin,.27)});
      }
      grupo.updateWorldMatrix(true,false);inversa.copy(grupo.matrixWorld).invert();let nube=0;
      function colocar(p,ancho,alto){objeto.position.copy(p).applyMatrix4(inversa);objeto.quaternion.identity();objeto.scale.set(ancho,alto,1);objeto.updateMatrix();nubes.setMatrixAt(nube++,objeto.matrix);}
      // Los bancos coinciden con las descargas: la luz aparece dentro de las
      // nubes lejanas, no como un lavado verde sobre todo el encuadre.
      for(let r=0;r<rayos.length;r++)for(let j=0;j<3;j++){
        a.copy(rayos[r].foco).addScaledVector(lado,(j-1)*25).addScaledVector(frente,(azar(r*7+j+2)-.5)*32);a.y+=(azar(r*11+j+1)-.5)*26;
        colocar(a,58+azar(r*13+j+9)*35,24+azar(r*9+j+71)*19);
      }
      // Dos capas desbordan los lados y la parte alta del encuadre. Al alzar la
      // mirada no se descubre el borde de una nubecita aislada sobre la plaza.
      const bancos=reducido?10:16,columnas=bancos/2;
      for(let j=0;j<bancos;j++){
        const nivel=Math.floor(j/columnas),columna=j%columnas,lateral=(columna/(columnas-1)-.5)*(nivel?380:510),distancia=115+azar(j+220)*115;
        a.copy(origen).addScaledVector(frente,-distancia).addScaledVector(lado,lateral);a.y=origen.y+(nivel?94:40)+azar(j+190)*(nivel?84:34);
        colocar(a,76+azar(j+339)*54,32+azar(j+290)*29);
      }
      const pasos=reducido?5:8;
      for(let j=0;j<pasos;j++){
        const k=.007+(j/(pasos-1))*.08;a.copy(desdeCielo).lerp(impacto,k).addScaledVector(lado,(j%2?1:-1)*(1.6+azar(j+102)*2.8));a.y+=(azar(j+513)-.5)*2.3;
        colocar(a,11+azar(j+91)*8,5.5+azar(j+27)*3.5);
      }
      nubes.count=nube;nubes.instanceMatrix.needsUpdate=true;
      preparado=true;
    }
    function pintarAmbiente(){
      if(!base)return;const f=1-estado.oscuridad*.64;
      if(base.fondo&&escena.background?.isColor)escena.background.fromArray(base.fondo).multiplyScalar(f);
      if(base.niebla&&escena.fog?.color)escena.fog.color.fromArray(base.niebla).multiplyScalar(f);
      if(estado.resplandorFinal){if(base.fondo&&escena.background?.isColor)escena.background.lerp(verdeCielo,estado.resplandorFinal*.36);if(base.niebla&&escena.fog?.color)escena.fog.color.lerp(verdeCielo,estado.resplandorFinal*.18);}
      // El hemisferio conserva detalle en la cara y los brazos, incluso cuando
      // el fondo se oscurece. Los rayos no producen flashes a pantalla completa.
      luces.forEach((l,i)=>l.intensity=base.luces[i]*(1-estado.oscuridad*(l.isDirectionalLight?.22:.18)+(estado.pulsoFinal||0)*(l.isDirectionalLight?.22:.30)));
    }
    function actualizar(t,duracion=3,{meteorito=null,edadMeteorito=0}={}){
      if(!Number.isFinite(t)||t<0){restaurar();return {...estado};}preparar();
      const segundos=Math.max(.001,duracion),tiempo=t/segundos*3;
      const pulsoFinal=manos.length===2?suave((tiempo-2.55)/.06)*(1-suave((tiempo-2.88)/.12)):0;
      // La luz queda en el cielo después de extinguir las descargas: atraviesa
      // la pausa y el comienzo del paneo sin volver a encender geometría de rayos.
      const resplandorFinal=manos.length===2?suave((tiempo-2.55)/.06)*(1-suave((tiempo-3.65)/1)):0;
      estado={t,duracion:segundos,progreso:lim(t/segundos),pulso:0,pulsoFinal,resplandorFinal,rayosManos:0,primerSegmentoManos:0,oscuridad:suave(t/Math.min(1.45,segundos*.7)),activo:t<segundos};
      pintarAmbiente();grupo.updateWorldMatrix(true,false);inversa.copy(grupo.matrixWorld).invert();let cuenta=0;
      uniformes.uTiempo.value=t;uniformes.uPresencia.value=suave(t/.75);uniformes.uNoche.value=estado.oscuridad;uniformes.uCulminacion.value=pulsoFinal;uniformes.uResplandor.value=resplandorFinal;uniformes.uEdadMeteorito.value=edadMeteorito;
      if(meteorito)uniformes.uMeteorito.value.set(meteorito.x,meteorito.y,meteorito.z,1);else uniformes.uMeteorito.value.set(0,0,0,0);
      nubes.visible=uniformes.uPresencia.value>0;for(const v of uniformes.uRayos.value)v.set(0,0,0,0);
      for(let ir=0;ir<rayos.length;ir++){const r=rayos[ir];
        const edad=tiempo-r.cuando;if(edad<0||edad>=r.duracion||t>=segundos)continue;
        const ataque=Math.min(.016,r.duracion*.18),meseta=r.duracion*.23,pulso=suave(edad/ataque)*(1-suave((edad-meseta)/(r.duracion-meseta))),descenso=suave(edad/Math.min(.105,r.duracion*.42));estado.pulso=Math.max(estado.pulso,pulso);
        uniformes.uRayos.value[ir].set(r.foco.x,r.foco.y,r.foco.z,pulso*r.fuerza);
        for(const s of r.segmentos){
          const dibujado=lim((descenso-s.inicio)/(s.fin-s.inicio));if(dibujado<=0||pulso<=0)continue;
          a.copy(s.a).applyMatrix4(inversa);b.copy(s.a).lerp(s.b,dibujado).applyMatrix4(inversa);eje.subVectors(b,a);const largo=eje.length();if(largo<.00001)continue;
          medio.copy(a).add(b).multiplyScalar(.5);objeto.position.copy(medio);objeto.quaternion.setFromUnitVectors(ejeY,eje.divideScalar(largo));
          const radio=r.ancho*s.grueso*pulso;objeto.scale.set(radio,largo,radio);objeto.updateMatrix();nucleo.setMatrixAt(cuenta,objeto.matrix);
          objeto.scale.set(radio*3.9,largo,radio*3.9);objeto.updateMatrix();contorno.setMatrixAt(cuenta++,objeto.matrix);
        }
      }
      estado.primerSegmentoManos=cuenta;
      if(pulsoFinal>0){
        const semilla=Math.floor(t*30+1e-8),alcance=suave((tiempo-2.55)/.09);estado.pulso=Math.max(estado.pulso,pulsoFinal);
        for(let mano=0;mano<2;mano++){
          manos[mano].updateWorldMatrix(true,false);manos[mano].getWorldPosition(manoInicio);
          manoDestino.copy(origen).addScaledVector(frente,-78).addScaledVector(lado,mano===0?-29:29);manoDestino.y=origen.y+78;
          uniformes.uRayos.value[6+mano].set(manoDestino.x,manoDestino.y,manoDestino.z,pulsoFinal*2.3);a.copy(manoInicio).applyMatrix4(inversa);
          for(let j=1;j<=tramosManos;j++){
            // Más quiebres cerca de las manos: el reparto uniforme dejaba el
            // primer tramo de cuatro metros como una cinta recta en el POV.
            const k=Math.pow(j/tramosManos,1.8)*alcance,ruido=Math.sqrt(Math.sin(Math.PI*k)),desvio=(azar(j+mano*173+semilla*7)-.5)*2.8*ruido;
            puntoMano.copy(manoInicio).lerp(manoDestino,k).addScaledVector(lado,desvio).addScaledVector(frente,(azar(j*3+mano*79+semilla)-.5)*2.1*ruido);
            b.copy(puntoMano).applyMatrix4(inversa);eje.subVectors(b,a);const largo=eje.length();if(largo<1e-8)continue;
            medio.copy(a).add(b).multiplyScalar(.5);objeto.position.copy(medio);objeto.quaternion.setFromUnitVectors(ejeY,eje.divideScalar(largo));
            const radio=(.052+.035*azar(j+mano*29))*(1-k*.3)*pulsoFinal;objeto.scale.set(radio,largo,radio);objeto.updateMatrix();nucleo.setMatrixAt(cuenta,objeto.matrix);
            objeto.scale.set(radio*3.5,largo,radio*3.5);objeto.updateMatrix();contorno.setMatrixAt(cuenta++,objeto.matrix);a.copy(b);
          }estado.rayosManos++;
        }
      }
      for(const m of [nucleo,contorno]){m.count=cuenta;m.visible=cuenta>0;m.instanceMatrix.needsUpdate=true;}
      return {...estado};
    }
    function restaurar(){
      if(preparado)ponerAmbiente(base);preparado=false;base=null;estado={t:-1,duracion:3,progreso:0,pulso:0,pulsoFinal:0,resplandorFinal:0,oscuridad:0,activo:false};
      for(const m of [nucleo,contorno,nubes]){m.count=0;m.visible=false;}
      uniformes.uTiempo.value=uniformes.uPresencia.value=uniformes.uNoche.value=uniformes.uEdadMeteorito.value=uniformes.uCulminacion.value=uniformes.uResplandor.value=0;for(const v of uniformes.uRayos.value)v.set(0,0,0,0);uniformes.uMeteorito.value.set(0,0,0,0);
    }
    function capturar(){return {estado:{...estado},preparado,base:base?{fondo:base.fondo?.slice()||null,niebla:base.niebla?.slice()||null,luces:base.luces.slice()}:null,ambiente:ambiente(),uniformes:{tiempo:uniformes.uTiempo.value,presencia:uniformes.uPresencia.value,noche:uniformes.uNoche.value,culminacion:uniformes.uCulminacion.value,resplandor:uniformes.uResplandor.value,rayos:uniformes.uRayos.value.map(v=>v.toArray()),meteorito:uniformes.uMeteorito.value.toArray(),edadMeteorito:uniformes.uEdadMeteorito.value}};}
    function mostrar(cuadro){if(!cuadro)return;estado={...cuadro.estado};preparado=cuadro.preparado;base=cuadro.base?{fondo:cuadro.base.fondo?.slice()||null,niebla:cuadro.base.niebla?.slice()||null,luces:cuadro.base.luces.slice()}:null;ponerAmbiente(cuadro.ambiente);
      const u=cuadro.uniformes;if(u){uniformes.uTiempo.value=u.tiempo;uniformes.uPresencia.value=u.presencia;uniformes.uNoche.value=u.noche;uniformes.uCulminacion.value=u.culminacion||0;uniformes.uResplandor.value=u.resplandor||0;u.rayos.forEach((v,i)=>uniformes.uRayos.value[i].fromArray(v));uniformes.uMeteorito.value.fromArray(u.meteorito);uniformes.uEdadMeteorito.value=u.edadMeteorito;}
    }
    return {preparar,actualizar,restaurar,capturar,mostrar,nucleo,contorno,nubes,get estado(){return {...estado};}};
  }
  window.CAOZ_ARPG_MAGO_HECHIZO={fabrica};
})();

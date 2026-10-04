/* Lluvia de Tomsage: tres mallas, sin luces ni reflejos con cámaras adicionales.
   El clima tiene su propia semilla y no altera el azar del combate o del botín. */
'use strict';
(function(){
  // Integral del viento: las ráfagas cambian la velocidad sin saltar las posiciones.
  const EXPOSICION=.028;
  function derivaViento(t,salida){salida.x=8*t-1.6/.55*Math.cos(t*.55)-.65/1.43*Math.cos(t*1.43);salida.y=1.7*t-.5/.37*Math.cos(t*.37+.8);return salida;}
  function fabrica(THREE,escena,{obstaculos=[],techos=[],abierto=false,reducido=false,perforar=()=>{}}={}){
    let semilla=731;const azar=()=>((semilla=(semilla*16807)%2147483647)/2147483647);
    const TAU=Math.PI*2,tiempo={value:0},centro={value:new THREE.Vector2()},radio=abierto?108:24;
    const deriva={value:new THREE.Vector2()},cola={value:new THREE.Vector2()},anteriorViento=new THREE.Vector2();
    let activo=true,sonido=true,pausado=false,tiempoCine=null,reloj=0,proximo=14,relampago=-100,trueno=null,totalTruenos=0;
    // Las gotas desaparecen al alcanzar los tejados; el mapa de alturas se calcula una sola vez.
    const lado=256,extension=120,alturas=new Float32Array(lado*lado);
    for(const caja of techos){const minX=Math.max(0,Math.floor((caja.min.x+extension)/(2*extension)*lado)),maxX=Math.min(lado-1,Math.ceil((caja.max.x+extension)/(2*extension)*lado));
      const minZ=Math.max(0,Math.floor((caja.min.z+extension)/(2*extension)*lado)),maxZ=Math.min(lado-1,Math.ceil((caja.max.z+extension)/(2*extension)*lado));
      for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)alturas[z*lado+x]=Math.max(alturas[z*lado+x],caja.max.y);}
    const refugios=new THREE.DataTexture(alturas,lado,lado,THREE.RedFormat,THREE.FloatType);refugios.needsUpdate=true;
    const P=[],S=[],E=[],cantidad=reducido?220:440;
    for(let i=0;i<cantidad;i++){const s=[azar()*44,azar()*16,azar()*44];for(let j=0;j<2;j++){P.push(0,0,0);S.push(...s);E.push(j);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aSemilla',new THREE.Float32BufferAttribute(S,3));g.setAttribute('aExtremo',new THREE.Float32BufferAttribute(E,1));
    const uniformesLluvia={...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uT:tiempo,uCentro:centro,uTechos:{value:refugios},uDeriva:deriva,uCola:cola};
    const funcionesLluvia=`uniform float uT;uniform vec2 uCentro;uniform sampler2D uTechos;uniform vec2 uDeriva;uniform vec2 uCola;
      attribute vec3 aSemilla;
      vec2 envolver(vec2 p){return mod(p-uCentro+22.,44.)-22.+uCentro;}
      float techo(vec2 p){return texture2D(uTechos,(p+120.)/240.).r;}
      float bordeLluvia(vec2 p){return 1.-smoothstep(17.,22.,max(abs(p.x-uCentro.x),abs(p.y-uCentro.y)));}
      float libreHastaCielo(vec2 p,float y,float rapidez){
        // Recorrer hacia arriba evita que reaparezcan gotas que ya atravesaron un tejado.
        float visible=1.;vec2 viento=uCola/${EXPOSICION};
        for(int i=0;i<=8;i++){float altura=y+(16.-y)*float(i)/8.;vec2 antes=p-viento*(altura-y)/rapidez;
          visible*=step(techo(antes)+.012,altura);}
        return visible;
      }`;
    const lluviaMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:uniformesLluvia,
      vertexShader:funcionesLluvia+`
        attribute float aExtremo;varying float vAlpha;varying vec3 vMundo;
        #include <fog_pars_vertex>
        void main(){float rapidez=12.+aSemilla.x*.075;float y=mod(aSemilla.y-uT*rapidez,16.);
          vec2 p=envolver(aSemilla.xz+uDeriva);
          float visible=libreHastaCielo(p,max(.025,y),rapidez);
          // La cola es la posición anterior real: va contra el viento y hacia arriba.
          vec3 pos=vec3(p.x,y,p.y)+vec3(-uCola.x,rapidez*${EXPOSICION},-uCola.y)*aExtremo;
          vAlpha=bordeLluvia(p)*visible*(1.-smoothstep(14.,16.,y))*(1.-aExtremo*.85);
          vMundo=pos;vec4 mvPosition=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform sampler2D uTechos;varying float vAlpha;varying vec3 vMundo;
        #include <fog_pars_fragment>
        void main(){if(vMundo.y<=texture2D(uTechos,(vMundo.xz+120.)/240.).r+.014)discard;
          gl_FragColor=vec4(.4,.49,.59,.34*vAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`});
    const lluvia=new THREE.LineSegments(g,lluviaMat);lluvia.name='Lluvia ligera';lluvia.frustumCulled=false;lluvia.renderOrder=3;escena.add(lluvia);
    // Una reserva de anillos para los impactos de esas mismas gotas, sin partículas de CPU.
    const sp=[],ss=[],su=[],si=[];
    for(let i=0;i<cantidad;i+=2){const k=sp.length/3;for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){sp.push(0,0,0);ss.push(...S.slice(i*6,i*6+3));su.push(u,v);}si.push(k,k+2,k+1,k,k+3,k+2);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));sg.setAttribute('aSemilla',new THREE.Float32BufferAttribute(ss,3));sg.setAttribute('uv',new THREE.Float32BufferAttribute(su,2));sg.setIndex(si);
    const salpicarMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:uniformesLluvia,
      vertexShader:funcionesLluvia+`
        varying vec2 vUv;varying float vAlpha;
        #include <fog_pars_vertex>
        void main(){float rapidez=12.+aSemilla.x*.075,y=mod(aSemilla.y-uT*rapidez,16.),edad=(16.-y)/rapidez,k=clamp(edad/.16,0.,1.);
          vec2 p=envolver(aSemilla.xz+uDeriva-uCola/${EXPOSICION}*edad);
          float visible=step(edad,.16)*step(techo(p),.001)*libreHastaCielo(p,.025,rapidez);
          float radio=.035+k*.13;vec3 pos=vec3(p.x+uv.x*radio,.03,p.y+uv.y*radio*.7);vUv=uv;
          vAlpha=visible*bordeLluvia(p)*(1.-k)*.22;
          vec4 mvPosition=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`varying vec2 vUv;varying float vAlpha;
        #include <fog_pars_fragment>
        void main(){float anillo=1.-smoothstep(.03,.18,abs(length(vUv)-.72));gl_FragColor=vec4(.34,.41,.47,vAlpha*anillo);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`});
    const salpicaduras=new THREE.Mesh(sg,salpicarMat);salpicaduras.name='Salpicaduras de lluvia';salpicaduras.frustumCulled=false;salpicaduras.renderOrder=2;escena.add(salpicaduras);
    // Charcos irregulares en coordenadas del mundo, separados de edificios y utilería.
    const posiciones=[],uvs=[],fases=[],indices=[],charcos=[];
    for(let intento=0;intento<3000&&charcos.length<(abierto?130:28);intento++){
      const a=azar()*TAU,r=Math.sqrt(azar())*radio,x=Math.cos(a)*r,z=Math.sin(a)*r,rx=.55+azar()*1.3,rz=.35+azar()*.65,rot=azar()*TAU,margen=Math.max(rx,rz)+.2;
      if(obstaculos.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+margen)||techos.some(b=>x>b.min.x-margen&&x<b.max.x+margen&&z>b.min.z-margen&&z<b.max.z+margen)||charcos.some(c=>Math.hypot(x-c.x,z-c.z)<margen+c.r))continue;
      // La franja de la muralla permanece seca; fuera sólo aparecen en el mundo abierto.
      if(abierto&&r>23&&r<30)continue;
      const fase=azar()*TAU,k=posiciones.length/3;charcos.push({x,z,r:margen});
      for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){posiciones.push(x+u*rx*Math.cos(rot)-v*rz*Math.sin(rot),.026,z+u*rx*Math.sin(rot)+v*rz*Math.cos(rot));uvs.push(u,v);fases.push(fase);}
      indices.push(k,k+2,k+1,k,k+3,k+2);
    }
    const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(posiciones,3));cg.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));cg.setAttribute('aFase',new THREE.Float32BufferAttribute(fases,1));cg.setIndex(indices);cg.computeBoundingSphere();
    const charcoMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uT:tiempo,uDestello:{value:0}},
      vertexShader:`attribute float aFase;varying vec2 vUv;varying float vFase;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vFase=aFase;
          #include <begin_vertex>
          vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uT;uniform float uDestello;varying vec2 vUv;varying float vFase;
        #include <fog_pars_fragment>
        void main(){
          #include <clipping_planes_fragment>
          float a=atan(vUv.y,vUv.x),r=length(vUv),borde=.72+.1*sin(a*3.+vFase)+.06*sin(a*7.-vFase);
          float mascara=1.-smoothstep(borde-.13,borde,r);if(mascara<.01)discard;
          vec2 centroOnda=vec2(sin(vFase*5.),cos(vFase*3.))*.35;
          float ciclo=fract(uT*(.85+.1*sin(vFase))+vFase),d=length(vUv-centroOnda),onda=(1.-smoothstep(.005,.02,abs(d-ciclo*.32)))*(1.-ciclo)*smoothstep(0.,.12,ciclo);
          float brillo=pow(max(0.,1.-abs(vUv.y+.23+sin(vUv.x*11.+uT*.6)*.018)*4.),5.);
          vec3 color=vec3(.009,.015,.019)+vec3(.013,.017,.02)*brillo+vec3(.035,.048,.055)*onda+uDestello*vec3(.02,.025,.035);
          gl_FragColor=vec4(color,mascara*(.45+.12*brillo));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`});
    perforar(charcoMat);const agua=new THREE.Mesh(cg,charcoMat);agua.name='Charcos de lluvia';agua.renderOrder=1;escena.add(agua);

    // Audio local sintetizado: lluvia filtrada y un retumbo grave, nunca un golpe seco cercano.
    let audio=null,maestro=null,lluviaAudio=null,bufferTrueno=null,reanudando=false;
    const voces=new Set();let intencionAudio=false;
    function ajustarAudio(forzar=false){
      intencionAudio=activo&&sonido&&!pausado&&(tiempoCine===null||tiempoCine>0);
      if(!audio||audio.state==='closed'||reanudando&&!forzar)return;
      const debeSonar=intencionAudio;
      if(debeSonar&&audio.state==='running'||!debeSonar&&audio.state==='suspended')return;
      reanudando=true;
      (debeSonar?audio.resume():audio.suspend()).catch(()=>{}).finally(()=>{
        reanudando=false;
        // Una pausa o cambio de preferencia puede llegar mientras el navegador responde.
        if(intencionAudio!==debeSonar)ajustarAudio();
      });
    }
    function desbloquearAudio(desdeMando=false){
      if(!activo||!sonido||pausado||tiempoCine===0||desdeMando&&audio)return;
      if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
        try{audio=new Audio();maestro=audio.createGain();maestro.gain.value=.48;maestro.connect(audio.destination);
          const ruido=audio.createBuffer(2,audio.sampleRate*4,audio.sampleRate);let s=3191;const ruidoAzar=()=>((s=(s*16807)%2147483647)/2147483647)*2-1;
          for(let canal=0;canal<2;canal++){const datos=ruido.getChannelData(canal);for(let i=0;i<datos.length;i++)datos[i]=ruidoAzar();}
          lluviaAudio=audio.createBufferSource();lluviaAudio.buffer=ruido;lluviaAudio.loop=true;
          const graves=audio.createBiquadFilter(),agudos=audio.createBiquadFilter(),vol=audio.createGain();graves.type='highpass';graves.frequency.value=450;agudos.type='lowpass';agudos.frequency.value=2900;vol.gain.value=.038;
          lluviaAudio.connect(graves);graves.connect(agudos);agudos.connect(vol);vol.connect(maestro);lluviaAudio.start();
          bufferTrueno=audio.createBuffer(1,audio.sampleRate*9,audio.sampleRate);const datos=bufferTrueno.getChannelData(0);let bajo=0;
          for(let i=0;i<datos.length;i++){bajo=(bajo+.035*ruidoAzar())/1.035;datos[i]=bajo*4;}
        }catch{audio?.close().catch(()=>{});audio=null;return;}}
      ajustarAudio(!desdeMando);
    }
    function sonarTrueno(pan){
      if(!audio||audio.state!=='running'||!intencionAudio)return;
      const fuente=audio.createBufferSource(),filtro=audio.createBiquadFilter(),envolvente=audio.createGain(),posicion=audio.createStereoPanner();
      fuente.buffer=bufferTrueno;fuente.playbackRate.value=.86+azar()*.18;filtro.type='lowpass';filtro.frequency.value=340;posicion.pan.value=pan;
      const t=audio.currentTime;envolvente.gain.setValueAtTime(0,t);envolvente.gain.linearRampToValueAtTime(.5,t+1.2);envolvente.gain.linearRampToValueAtTime(.28,t+2.7);envolvente.gain.linearRampToValueAtTime(.38,t+3.5);envolvente.gain.exponentialRampToValueAtTime(.001,t+8.5);
      fuente.connect(filtro);filtro.connect(envolvente);envolvente.connect(posicion);posicion.connect(maestro);voces.add(fuente);
      fuente.onended=()=>{voces.delete(fuente);fuente.disconnect();filtro.disconnect();envolvente.disconnect();posicion.disconnect();};fuente.start();fuente.stop(t+9);
    }
    function situar(t,foco){
      tiempo.value=t;if(foco)centro.value.set(foco.x,foco.z);
      derivaViento(t,deriva.value);derivaViento(t-EXPOSICION,anteriorViento);cola.value.copy(deriva.value).sub(anteriorViento);
    }
    // Tiempo absoluto de la escena: permite retroceder sin depender del reloj real.
    function cinematica(t,foco){
      const antes=tiempoCine;tiempoCine=t===null?null:Math.max(0,t);
      situar(tiempoCine??reloj,foco);charcoMat.uniforms.uDestello.value=0;
      if(antes!==tiempoCine&&(antes===null||tiempoCine===null||antes===0||tiempoCine===0)){
        for(const voz of voces)voz.stop();ajustarAudio();
      }
    }
    function paso(dt,foco){
      if(!activo||pausado||tiempoCine!==null)return 0;reloj+=Math.min(.1,Math.max(0,dt));situar(reloj,foco);
      if(reloj>=proximo){relampago=reloj;trueno={cuando:reloj+3.8+azar()*2.4,pan:(azar()<.5?-1:1)*(.25+azar()*.35)};proximo=reloj+28+azar()*22;}
      if(trueno&&reloj>=trueno.cuando){totalTruenos++;sonarTrueno(trueno.pan);trueno=null;}
      const t=reloj-relampago,destello=!reducido&&t>=0&&t<1.8?Math.sin(t/1.8*Math.PI)**2:0;
      charcoMat.uniforms.uDestello.value=destello;return destello;
    }
    function configurar(opciones){
      if(opciones.activo!==undefined)activo=!!opciones.activo;if(opciones.sonido!==undefined)sonido=!!opciones.sonido;
      lluvia.visible=agua.visible=salpicaduras.visible=activo;
      if(!activo){charcoMat.uniforms.uDestello.value=0;relampago=-100;trueno=null;proximo=reloj+14;}
      if(!activo||!sonido)for(const voz of voces)voz.stop();
      ajustarAudio();
    }
    return {paso,configurar,cinematica,desbloquearAudio,pausar(v){if(pausado!==v){pausado=v;ajustarAudio();}},
      estado:()=>({activo,sonido,pausado,tiempo:reloj,tiempoCine,gotas:cantidad,charcos:charcos.length,mallas:3,truenos:totalTruenos,audio:audio?.state||'pendiente',voces:voces.size}),
      destruir(){for(const voz of voces)voz.stop();lluviaAudio?.stop();audio?.close().catch(()=>{});escena.remove(lluvia,agua,salpicaduras);g.dispose();cg.dispose();sg.dispose();lluviaMat.dispose();charcoMat.dispose();salpicarMat.dispose();refugios.dispose();}};
  }
  window.CAOZ_ARPG_CLIMA=Object.freeze({fabrica,derivaViento});
})();

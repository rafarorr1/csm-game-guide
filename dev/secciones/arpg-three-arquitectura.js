/* Arquitectura de Scenario: atlas locales, geometrías estáticas y materiales compartidos.
   El frente mira a +Z; la puerta practicable conserva el vano y la bisagra del epílogo. */
'use strict';
(function(){
  function fabrica(THREE,opciones={}){
    if(!window.CAOZ_ARQUITECTURA_DATOS)return null;
    const datos={...window.CAOZ_ARQUITECTURA_DATOS,...window.CAOZ_CARRETA_DATOS?{carreta:window.CAOZ_CARRETA_DATOS}:{}};
    const uniformes=opciones.uniformes||{uT:{value:0},uLuz:{value:1}};
    const materiales=new Map(),geometrias=new Map(),cargas=[],ruta=opciones.rutaArquitectura||'./arquitectura-scenario/';
    const decodificar=(s,Tipo)=>new Tipo(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
    function textura(tipo,nombre,indice){
      if(opciones.texturas===false)return null;
      const carpeta=tipo==='carreta'?(opciones.rutaCarreta||'./carreta-scenario/'):ruta;
      let t;const lista=new Promise((resolver,rechazar)=>{t=new THREE.TextureLoader().load(carpeta+tipo+'-'+nombre+'-'+indice+'.webp',resolver,undefined,rechazar);});
      t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;
      t.anisotropy=Math.min(4,opciones.renderer?.capabilities.getMaxAnisotropy()||1);cargas.push(lista);return t;
    }
    for(const [tipo,d] of Object.entries(datos))for(const i of new Set(d.mallas.map(m=>m.material))){
      const superficie=textura(tipo,'superficie',i);
      materiales.set(tipo+':'+i,new THREE.MeshStandardMaterial({name:'Scenario · '+tipo,map:textura(tipo,'color',i),normalMap:textura(tipo,'normal',i),roughnessMap:superficie,metalnessMap:superficie,roughness:1,metalness:1,envMapIntensity:.18,normalScale:new THREE.Vector2(.65,.65),vertexColors:true}));
    }
    // Un atlas y una sola malla para todos los faroles; la llama ocupa geometría real.
    let farol=null,materialFarol=null;
    if(window.CAOZ_FAROL_DATOS){
      const d=window.CAOZ_FAROL_DATOS,g=new THREE.BufferGeometry();
      for(const [nombre,n] of [['position',3],['normal',3],['uv',2]])g.setAttribute(nombre,new THREE.BufferAttribute(decodificar(d[nombre],Float32Array),n));
      const p=g.attributes.position,llama=new Float32Array(p.count);
      for(let i=0;i<p.count;i++)llama[i]=p.getX(i)>.1&&p.getX(i)<.23&&Math.abs(p.getZ(i))<.052&&p.getY(i)>.281&&p.getY(i)<.4?1:0;
      g.setAttribute('aLlama',new THREE.BufferAttribute(llama,1));g.setIndex(new THREE.BufferAttribute(decodificar(d.index,Uint16Array),1));
      farol=g.toNonIndexed();g.dispose();farol.rotateY(-Math.PI/2);farol.translate(0,0,.32941);farol.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(farol.attributes.position.count*3).fill(1),3));
      const mapa=nombre=>{if(opciones.texturas===false)return null;let t;const lista=new Promise((ok,no)=>{t=new THREE.TextureLoader().load((opciones.rutaFarol||'./farol-scenario/')+nombre+'.webp',ok,undefined,no);});t.flipY=false;t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(4,opciones.renderer?.capabilities.getMaxAnisotropy()||1);cargas.push(lista);return t;};
      const superficie=mapa('superficie');materialFarol=new THREE.MeshStandardMaterial({name:'Farol de pared · Scenario',map:mapa('color'),normalMap:mapa('normal'),roughnessMap:superficie,metalnessMap:superficie,roughness:1,metalness:.45,envMapIntensity:.12,vertexColors:true,normalScale:new THREE.Vector2(.5,.5)});
      materialFarol.onBeforeCompile=sh=>{sh.uniforms.uFarolT=uniformes.uT;sh.uniforms.uFarolLuz=uniformes.uLuz;sh.vertexShader='attribute float aLlama;varying float vLlama;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLlama=aLlama;');sh.fragmentShader='varying float vLlama;uniform float uFarolT,uFarolLuz;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(3.2,1.4,.32)*vLlama*uFarolLuz*(.93+.07*sin(uFarolT*6.1));');};
    }
    // Retira sólo los salientes del farol antiguo; conserva la pared detrás.
    function limpiarFarol(g,tipo){
      const p=g.attributes.position,indices=[];
      for(let i=0;i<p.count;i+=3){let x=0,y=0,z=0;for(let j=0;j<3;j++){x+=p.getX(i+j)/3;y+=p.getY(i+j)/3;z+=p.getZ(i+j)/3;}
        const viejo=tipo==='piedra'?x>-.24&&x<.32&&y>1.73&&y<2.81&&z>2.325:tipo==='entramada'?x<-2.73&&y>2.03&&y<2.79&&z>1.38&&z<1.97:false;
        if(!viejo)indices.push(i,i+1,i+2);
      }
      if(indices.length===p.count)return g;const limpio=new THREE.BufferGeometry();
      for(const [nombre,a] of Object.entries(g.attributes)){const v=new Float32Array(indices.length*a.itemSize);indices.forEach((j,i)=>{for(let k=0;k<a.itemSize;k++)v[i*a.itemSize+k]=a.array[j*a.itemSize+k];});limpio.setAttribute(nombre,new THREE.BufferAttribute(v,a.itemSize));}g.dispose();return limpio;
    }
    function ponerFarol(grupo,pos,giro=0,sx=1,sz=1){
      if(!farol)return;const m=new THREE.Mesh(farol,materialFarol);m.name='Farol hueco con vela · Scenario';m.position.fromArray(pos);m.rotation.y=giro;m.scale.set(giro?sz:sx,1,giro?sx:sz);m.castShadow=m.receiveShadow=true;grupo.add(m);
      grupo.userData.triangulos+=farol.attributes.position.count/3;
      grupo.userData.faroles=[new THREE.Vector3(0,.335,.515).applyAxisAngle(new THREE.Vector3(0,1,0),giro).multiply(new THREE.Vector3(sx,1,sz)).add(m.position)];
    }
    function lucesFaroles(casas,escena,fundidas){
      const puntos=[];for(const [indice,c]of casas.entries()){c.updateMatrixWorld(true);for(const p of c.userData.faroles||[])puntos.push({c,indice,pos:c.localToWorld(p.clone())});}
      // Dos luces cercanas sin sombras: coste constante aunque crezca la ciudad.
      const luces=Array.from({length:Math.min(2,puntos.length)},()=>{const l=new THREE.PointLight(0xffb767,0,4.8,2);escena.add(l);return l;});
      return (camara,activa=true)=>{const opciones=puntos.filter(p=>activa&&(!fundidas||fundidas.visible||p.c.parent)&&((fundidas?.userData.ocultacion?.opacidades[p.indice]??1)>.5));opciones.sort((a,b)=>a.pos.distanceToSquared(camara.position)-b.pos.distanceToSquared(camara.position));
        luces.forEach((l,i)=>{const p=opciones[i];l.intensity=p?5*uniformes.uLuz.value*(.94+.06*Math.sin(uniformes.uT.value*6.1)):0;if(p)l.position.copy(p.pos);});
      };
    }
    function geometria(tipo,i,abierta){
      const clave=tipo+':'+i+':'+abierta;if(geometrias.has(clave))return geometrias.get(clave);
      const fuente=datos[tipo].mallas[i],d=abierta&&fuente.abierta?fuente.abierta:fuente;let g=new THREE.BufferGeometry();
      for(const [nombre,n] of [['position',3],['normal',3],['uv',2]])g.setAttribute(nombre,new THREE.BufferAttribute(decodificar(d[nombre],Float32Array),n));
      if(d.index){g.setIndex(new THREE.BufferAttribute(decodificar(d.index,Uint16Array),1));const indexada=g;g=g.toNonIndexed();indexada.dispose();}
      if(farol)g=limpiarFarol(g,tipo);
      g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));g.computeBoundingSphere();geometrias.set(clave,g);return g;
    }
    function casa(tipo,o={}){
      const d=datos[tipo];if(!d)return null;const grupo=new THREE.Group(),anchoBase={entramada:6,piedra:5.2,taberna:7.6,pozo:2.04}[tipo];
      if(tipo==='carreta'){
        d.mallas.forEach((p,i)=>{const m=new THREE.Mesh(geometria(tipo,i,false),materiales.get(tipo+':'+p.material));m.castShadow=m.receiveShadow=true;grupo.add(m);});
        grupo.name='Carreta de madera · Scenario';grupo.userData={tipo,arquitecturaScenario:true,alto:d.tamano[1],huella:[d.tamano[0],d.tamano[2]],triangulos:d.mallas.reduce((n,p,i)=>n+geometria(tipo,i,false).attributes.position.count/3,0),ventanas:[],humo:null,puerta:null};return grupo;
      }
      const sx=tipo==='pozo'?(o.radio??1.02)/1.02:(o.ancho??anchoBase)/anchoBase,sz=tipo==='pozo'?sx:(o.fondo??{entramada:5,piedra:4.6,taberna:6}[tipo])/{entramada:5,piedra:4.6,taberna:6}[tipo];
      let triangulos=0;
      d.mallas.forEach((p,i)=>{let g=geometria(tipo,i,tipo==='piedra'&&!!o.puertaInteractiva);if(sx!==1||sz!==1)g=g.clone().scale(sx,1,sz);
        const m=new THREE.Mesh(g,materiales.get(tipo+':'+p.material));m.castShadow=m.receiveShadow=true;grupo.add(m);triangulos+=g.attributes.position.count/3;});
      const huellas={entramada:[(o.ancho??6)+.4,(o.fondo??5)+1.2],piedra:[(o.ancho??5.2)+1.2,(o.fondo??4.6)+.6],taberna:[(o.ancho??7.6)+.4,(o.fondo??6)+1],pozo:[2*(o.radio??1.02)+.84,2*(o.radio??1.02)+.6]};
      grupo.userData={tipo,arquitecturaScenario:true,alto:d.tamano[1],huella:huellas[tipo],triangulos,ventanas:[],humo:d.humo?new THREE.Vector3(d.humo[0]*sx,d.humo[1],d.humo[2]*sz):null,puerta:tipo==='piedra'&&o.puertaInteractiva?{x:-1.144*sx,z:2.36*sz,ancho:1.62*sx,alto:2.8}:null};
      if(tipo==='piedra')ponerFarol(grupo,[.07*sx,1.81,2.3*sz],0,sx,sz);
      if(tipo==='entramada')ponerFarol(grupo,[-2.69*sx,1.88,1.7*sz],-Math.PI/2,sx,sz);
      if(tipo==='taberna')ponerFarol(grupo,[-1.45*sx,1.86,2.94*sz],0,sx,sz);
      return grupo;
    }
    return {casa,materiales,lucesFaroles,texturasListas:Promise.allSettled(cargas).then(r=>{if(r.some(x=>x.status==='rejected'))console.warn('No se pudo cargar algún mapa de la arquitectura.');return r;})};
  }
  window.CAOZ_ARQUITECTURA=Object.freeze({fabrica});
})();

/* Actuación facial de Adreida: expresiones, párpados y mirada independientes del cuerpo.
   La pose depende del tiempo de la actuación, nunca de la cámara ni del cuadro anterior. */
'use strict';
(function(){
  const EXPRESIONES=Object.freeze({
    neutral:Object.freeze({}),
    determinacion:Object.freeze({browDownLeft:.28,browDownRight:.24,eyeSquintLeft:.14,eyeSquintRight:.12,mouthPressLeft:.22,mouthPressRight:.20}),
    ira:Object.freeze({browDownLeft:.72,browDownRight:.66,eyeSquintLeft:.27,eyeSquintRight:.23,mouthPressLeft:.25,mouthPressRight:.22,mouthSneerLeft:.28,mouthSneerRight:.18,jawOpen:.09}),
    miedo:Object.freeze({browInnerUp:.53,browOuterUpLeft:.15,browOuterUpRight:.12,eyeWideLeft:.46,eyeWideRight:.40,mouthFrownLeft:.16,mouthFrownRight:.18,jawOpen:.24}),
    dolor:Object.freeze({browInnerUp:.28,browDownLeft:.41,browDownRight:.35,eyeSquintLeft:.58,eyeSquintRight:.46,mouthSneerLeft:.20,mouthSneerRight:.16,jawOpen:.20}),
    tristeza:Object.freeze({browInnerUp:.48,browDownLeft:.12,browDownRight:.09,eyeSquintLeft:.13,eyeSquintRight:.10,mouthFrownLeft:.42,mouthFrownRight:.37}),
    desconfianza:Object.freeze({browDownLeft:.35,browOuterUpRight:.27,eyeSquintLeft:.30,eyeSquintRight:.12,mouthPressLeft:.28,mouthPressRight:.18,mouthSneerLeft:.10}),
    alivio:Object.freeze({browInnerUp:.12,eyeSquintLeft:.16,eyeSquintRight:.14,mouthSmileLeft:.26,mouthSmileRight:.22,jawOpen:.035}),
    sorpresa:Object.freeze({browInnerUp:.52,browOuterUpLeft:.40,browOuterUpRight:.36,eyeWideLeft:.53,eyeWideRight:.49,jawOpen:.38})
  });
  const NOMBRES=Object.freeze(['browInnerUp','browDownLeft','browDownRight','browOuterUpLeft','browOuterUpRight','eyeBlinkLeft','eyeBlinkRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','jawOpen','mouthSmileLeft','mouthSmileRight','mouthFrownLeft','mouthFrownRight','mouthPressLeft','mouthPressRight','mouthSneerLeft','mouthSneerRight','eyesLookLeft','eyesLookRight','eyesLookUp','eyesLookDown']);
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL('./adreida-rostro/',document.currentScript.src).href:null;
  const finito=(x,base=0)=>Number.isFinite(x)?x:base,lim=x=>Math.max(0,Math.min(1,finito(x))),suave=x=>{x=lim(x);return x*x*(3-2*x);};
  const leer=(s,T)=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new T(a.buffer);};
  function fabrica(THREE){
    const datos=window.CAOZ_ADREIDA_ROSTRO_DATOS,canales=Object.freeze([...new Set([...NOMBRES,...(datos?.canales||[]),...(datos?.mallas||[]).flatMap(d=>Object.keys(d.morphs||{}))])]);
    let preparadas=null,mapas=null,numero=0;
    function preparar(){
      if(preparadas||!datos)return;
      preparadas=datos.mallas.map((d,i)=>{
        const p=leer(d.posicion,Float32Array),n=leer(d.normal,Float32Array),uv=leer(d.uv,Float32Array),tri=leer(d.triangulos,Uint16Array);
        if(!p.length||p.length%3||n.length!==p.length||uv.length!==p.length/3*2||tri.length%3)throw Error('Atributos incompletos en el rostro de Adreida: '+d.nombre);
        for(const a of [p,n,uv])if(a.some(x=>!Number.isFinite(x)))throw Error('Atributo no finito en el rostro de Adreida: '+d.nombre);
        if(tri.some(x=>x>=p.length/3))throw Error('Índice fuera de la malla facial: '+d.nombre);
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
        g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(p.length).fill(1),3));g.setIndex(new THREE.BufferAttribute(tri,1));
        const nombres=Object.keys(d.morphs||{}),normales=nombres.some(nombre=>d.morphs[nombre].normal);
        if(nombres.length){
          g.morphTargetsRelative=true;g.morphAttributes.position=[];if(normales)g.morphAttributes.normal=[];
          for(const nombre of nombres){
            const de=d.morphs[nombre],delta=leer(de.posicion,Float32Array);
            if(delta.length!==p.length||delta.some(x=>!Number.isFinite(x)))throw Error('Expresión facial inválida: '+nombre);
            const a=new THREE.BufferAttribute(delta,3);a.name=nombre;g.morphAttributes.position.push(a);
            if(normales){const dn=de.normal?leer(de.normal,Float32Array):new Float32Array(p.length);if(dn.length!==p.length||dn.some(x=>!Number.isFinite(x)))throw Error('Normal facial inválida: '+nombre);const an=new THREE.BufferAttribute(dn,3);an.name=nombre;g.morphAttributes.normal.push(an);}
          }
        }
        g.userData.compartida=true;g.userData.rostro=true;g.computeBoundingSphere();
        return {g,nombre:d.nombre||'Rostro '+i,tipo:d.tipo==='ojos'?'ojos':'piel',centro:d.centro,ojo:d.ojo};
      });
      mapas={};if(ruta)for(const nombre of ['color','normal','superficie']){const t=new THREE.TextureLoader().load(ruta+nombre+'.webp');t.flipY=false;t.colorSpace=nombre==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapas[nombre]=t;}
    }
    function montar(H,M,mallas){
      if(!datos)return null;preparar();
      const materiales={},estado={mallas:[],ojos:[],pesos:Object.fromEntries(canales.map(n=>[n,0])),expresion:'neutral',desfase:numero++*1.61803398875};
      for(const d of preparadas){
        if(!materiales[d.tipo])materiales[d.tipo]=M.hacer({map:mapas.color||null,normalMap:mapas.normal||null,roughnessMap:mapas.superficie||null,roughness:d.tipo==='ojos'?.28:1,metalness:0,normalScale:new THREE.Vector2(d.tipo==='ojos'?.12:.55,d.tipo==='ojos'?.12:.55),envMapIntensity:d.tipo==='ojos'?.35:.25,side:THREE.FrontSide});
        const mesh=new THREE.Mesh(d.g,materiales[d.tipo]);mesh.name='Adreida · '+d.nombre;mesh.userData.rostro=true;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
        // Un globo ocular puede girar sobre su centro sin arrastrar párpados ni cabeza.
        if(d.tipo==='ojos'&&d.ojo&&d.centro?.length===3){const pivote=new THREE.Group();pivote.name='Mirada '+d.ojo;pivote.position.fromArray(d.centro);mesh.position.fromArray(d.centro).multiplyScalar(-1);pivote.add(mesh);H.cabeza.add(pivote);estado.ojos.push(pivote);}else H.cabeza.add(mesh);
        estado.mallas.push(mesh);mallas.push(mesh);
      }
      return estado;
    }
    function aplicar(estado){
      for(const mesh of estado.mallas){const dic=mesh.morphTargetDictionary||{};for(const [nombre,i]of Object.entries(dic))mesh.morphTargetInfluences[i]=lim(estado.pesos[nombre]);}
      const p=estado.pesos,y=(p.eyesLookLeft-p.eyesLookRight)*.35,x=(p.eyesLookDown-p.eyesLookUp)*.24;
      for(const ojo of estado.ojos)ojo.rotation.set(x,y,0);
    }
    function automatica(a){
      const k=lim(a.k),pulso=Math.sin(Math.PI*k);
      if(a.anim==='muerte')return ['dolor',(1-suave((k-.3)/.65))*.65];
      if(a.anim==='dolor'||a.anim==='aturdido')return ['dolor',a.anim==='dolor'?1-suave(k):.42];
      if(a.anim==='grito')return ['ira',.65+.35*pulso];
      if(['tajoA','revesA','estocadaA','torbellino'].includes(a.anim))return ['ira',.28+.28*pulso+.18*lim(a.potencia)];
      if(a.anim==='parry')return ['determinacion',.7+.3*pulso];
      if(a.anim==='salto'||a.anim==='rodar')return ['determinacion',.55];
      if(a.anim==='mirarLlave'||a.anim==='recogerLlave')return ['desconfianza',.40];
      return ['determinacion',a.anim==='andar'?.30:.18];
    }
    function parpadeo(t){
      // Cierre rápido y reapertura más suave; el breve segundo parpadeo sólo cada tres ciclos.
      const periodo=4.37,ciclo=Math.floor(t/periodo),fase=((t%periodo)+periodo)%periodo;
      const pulso=x=>x<0||x>.205?0:x<.058?suave(x/.058):x<.078?1:1-suave((x-.078)/.127);
      return Math.max(pulso(fase-3.10),ciclo%3===1?pulso(fase-3.43)*.9:0);
    }
    function posar(m,a={}){
      const e=m.rostro;if(!e)return;
      const manual=a.rostro&&typeof a.rostro==='object',explicita=Object.hasOwn(EXPRESIONES,a.expresion),[expresion,fuerza]=explicita?[a.expresion,1]:manual?['neutral',1]:automatica(a),intensidad=finito(a.intensidadRostro,finito(a.intensidadExpresion,1));
      e.expresion=expresion;for(const n of canales)e.pesos[n]=lim((EXPRESIONES[expresion][n]||0)*fuerza*lim(intensidad));
      const t=finito(a.t)+e.desfase;
      const parpadeoAutomatico=(!manual||a.parpadeo===true)&&a.anim!=='muerte'&&a.parpadeo!==false;
      if(parpadeoAutomatico){const b=parpadeo(t);e.pesos.eyeBlinkLeft=b;e.pesos.eyeBlinkRight=b;}
      // Micromovimientos pequeños alrededor del objetivo. Los planos pueden fijar una mirada absoluta.
      const mirada=a.mirada||(!manual&&a.anim!=='muerte'?[Math.sin(t*.47)*.055+Math.sin(t*1.13)*.018,Math.sin(t*.31)*.035]:[0,0]);
      const horizontal=finito(mirada[0],finito(mirada.x)),vertical=finito(mirada[1],finito(mirada.y));
      e.pesos.eyesLookLeft=lim(horizontal);e.pesos.eyesLookRight=lim(-horizontal);e.pesos.eyesLookUp=lim(vertical);e.pesos.eyesLookDown=lim(-vertical);
      if(a.anim==='muerte'&&!explicita&&!manual)e.pesos.eyeBlinkLeft=e.pesos.eyeBlinkRight=suave((lim(a.k)-.08)/.30);
      if(manual)for(const n of canales)if(Object.hasOwn(a.rostro,n))e.pesos[n]=lim(a.rostro[n]);
      // El cierre tiene prioridad sobre ojos muy abiertos, también en la actuación de cine.
      if(parpadeoAutomatico)for(const lado of ['Left','Right']){const abrir=1-e.pesos['eyeBlink'+lado];e.pesos['eyeWide'+lado]*=abrir;e.pesos['eyeSquint'+lado]*=abrir;}
      aplicar(e);
    }
    function capturar(m){return m.rostro?{pesos:{...m.rostro.pesos},expresion:m.rostro.expresion}:null;}
    function restaurar(m,desde){if(!m.rostro||!desde)return;for(const n of canales)m.rostro.pesos[n]=lim(desde.pesos?.[n]);m.rostro.expresion=Object.hasOwn(EXPRESIONES,desde.expresion)?desde.expresion:'neutral';aplicar(m.rostro);}
    function mezclar(m,desde,k){if(!m.rostro||!desde)return;const f=suave(k);for(const n of canales)m.rostro.pesos[n]=lim(finito(desde.pesos?.[n])*(1-f)+m.rostro.pesos[n]*f);aplicar(m.rostro);}
    return {montar,posar,capturar,restaurar,mezclar,expresiones:EXPRESIONES,canales};
  }
  window.CAOZ_ARPG_ROSTRO_ADREIDA=Object.freeze({fabrica,EXPRESIONES,canales:NOMBRES});
})();

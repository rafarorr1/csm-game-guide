/* Actuación del epílogo: brazos del modelo real para FPS, tropiezo y recuperación.
   No modifica el esqueleto ni las animaciones del combate. */
'use strict';
(function(){
  function fabrica(T,MOD){
    const lim=x=>Math.max(0,Math.min(1,x)),suave=x=>{x=lim(x);return x*x*(3-2*x);};
    const v=new T.Vector3(),q=new T.Quaternion(),contactos=new WeakMap();
    const huesos=m=>Object.entries(m.H).filter(([,b])=>b.isBone);
    const capturar=m=>({rot:Object.fromEntries(huesos(m).map(([k,b])=>[k,b.quaternion.clone()])),pos:m.H.cuerpo.position.clone()});
    function mezclar(m,desde,k){for(const [n,b]of huesos(m))b.quaternion.slerp(desde.rot[n],1-suave(k));m.H.cuerpo.position.lerp(desde.pos,1-suave(k));}
    function crearFPS(){
      const m=MOD.crear('adreida'),mesh=m.mallas[0],g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
      const brazos=new Set(['anteI','manoI','anteD','manoD'].map(n=>mesh.skeleton.bones.indexOf(m.H[n]))),indices=[];
      for(const lado of ['I','D'])m.H['mano'+lado].traverse(b=>{if(b.isBone)brazos.add(mesh.skeleton.bones.indexOf(b));});
      const peso=i=>{let p=0;for(let j=0;j<4;j++)if(brazos.has(si.array[i*4+j]))p+=sw.array[i*4+j];return p;};
      const origen=g.index?.array||Array.from({length:g.attributes.position.count},(_,i)=>i);
      for(let i=0;i<origen.length;i+=3)if([0,1,2].every(j=>peso(origen[i+j])>.15))indices.push(...origen.slice(i,i+3));
      // Se comparten los atributos y mapas; sólo se crea el índice de los dos brazos.
      const parcial=new T.BufferGeometry();for(const [n,a]of Object.entries(g.attributes))parcial.setAttribute(n,a);parcial.morphAttributes=g.morphAttributes;parcial.morphTargetsRelative=g.morphTargetsRelative;parcial.setIndex(indices);mesh.geometry=parcial;
      for(const p of m.mallas){p.castShadow=p.receiveShadow=false;p.frustumCulled=false;}
      m.raiz.name='Adreida · brazos en primera persona';m.raiz.visible=false;
      return m;
    }
    function fps(m,camara,fase,t,ataque=null){
      MOD.posar(m,{anim:'quieto',dt:0,t,sinHacha:true,agarreDerecha:true,mezclar:false});const H=m.H;
      H.cuerpo.position.set(0,0,0);H.cadera.rotation.set(0,0,0);H.torso.rotation.set(0,0,Math.sin(fase)*.018);
      for(const [l,signo]of [['D',-1],['I',1]]){
        const paso=Math.sin(fase+(l==='I'?Math.PI:0));
        H['brazo'+l].rotation.set(-.4+paso*.12,signo*.08,signo*.22);
        H['ante'+l].rotation.set(-1.3-paso*.16,0,0);
        H['mano'+l].rotation.set(0,0,signo*(Math.PI/2-.31));
      }
      // El mismo clip y el mismo progreso continúan después del corte a tercera persona.
      const entradaAtaque=ataque===null?0:suave(ataque/.085);
      if(ataque!==null){const desde=capturar(m);MOD.posar(m,{anim:'tajoA',k:ataque,t,dt:0,mezclar:false});mezclar(m,desde,entradaAtaque);}
      // El agarre de tercera persona arma el golpe detrás del hombro. Adelanta el
      // modelo de vista para mantener manos y filo dentro del encuadre durante ese arco.
      m.raiz.position.set(-.15*entradaAtaque,-1.50-.14*entradaAtaque,-.20-.8*entradaAtaque).applyQuaternion(camara.quaternion).add(camara.position);
      m.raiz.quaternion.copy(camara.quaternion).multiply(q.setFromAxisAngle(v.set(0,1,0),Math.PI));
      m.raiz.updateMatrixWorld(true);
    }
    function fbx(m,nombre,k,desde=null,entrada=1){
      const clip=window.CAOZ_ADREIDA_CINE_CLIPS[nombre],{datos,ancho,huesos,muestras}=clip;
      const f=lim(k)*(muestras-1),i=Math.floor(f),j=Math.min(muestras-1,i+1),u=f-i;
      m.H.cuerpo.position.fromArray(datos,i*ancho).lerp(v.fromArray(datos,j*ancho),u);
      for(let n=0;n<huesos.length;n++)m.H[huesos[n]].quaternion.fromArray(datos,i*ancho+3+n*4).normalize().slerp(q.fromArray(datos,j*ancho+3+n*4).normalize(),u);
      if(desde)mezclar(m,desde,entrada);m.raiz.updateMatrixWorld(true);
    }
    function baseSuelo(m){
      MOD.posar(m,{anim:'quieto',dt:0,t:0,mezclar:false});const H=m.H;
      H.cuerpo.position.set(0,-.61,.14);H.cadera.rotation.set(.68,0,-.06);H.torso.rotation.set(.45,0,.04);H.cabeza.rotation.set(-1.05,0,0);
      H.piernaI.rotation.set(-1.68,0,.1);H.rodillaI.rotation.set(2.48,0,0);H.pieI.rotation.set(-1.48,0,0);
      H.piernaD.rotation.set(-1.60,.1,-.15);H.rodillaD.rotation.set(2.4,0,0);H.pieD.rotation.set(-1.48,0,0);
      H.brazoI.rotation.set(-1.35,0,.20);H.anteI.rotation.set(-.05,0,0);H.manoI.rotation.set(-.25,0,.9);
      H.brazoD.rotation.set(-1.35,0,-.26);H.anteD.rotation.set(-.10,0,0);H.manoD.rotation.set(0,0,-1.1);
    }
    function apoyar(m){
      // Muestras del cuerpo para que manos y rodillas nunca atraviesen el pavimento.
      const mesh=m.mallas[0],g=mesh.geometry;let puntos=contactos.get(g);
      if(!puntos){puntos=[];for(let i=0;i<g.attributes.position.count;i+=11)puntos.push(i);contactos.set(g,puntos);}
      m.raiz.updateMatrixWorld(true);let bajo=Infinity;for(const i of puntos)bajo=Math.min(bajo,mesh.getVertexPosition(i,v).y);
      m.H.cuerpo.position.y+=.025-bajo;m.raiz.updateMatrixWorld(true);
    }
    function caer(m,desde,k){baseSuelo(m);mezclar(m,desde,Math.min(1,k/.83));if(k>.76)apoyar(m);}
    function buscar(m,t){
      baseSuelo(m);const girar=t<.9?-.92*suave(t/.45):t<1.9?-.92+1.85*suave((t-.9)/.48):.93*(1-suave((t-1.9)/.5));
      m.H.cabeza.rotation.y=girar;m.H.torso.rotation.y=girar*.16;m.H.cabeza.rotation.x=-1.03;apoyar(m);
    }
    function levantar(m,desde,k){
      MOD.posar(m,{anim:'quieto',dt:0,t:0,mezclar:false});
      // Primero recoge una rodilla y carga el peso en las manos; luego estira el torso.
      const apoyo=Math.sin(Math.PI*lim(k/.8));m.H.torso.rotation.x+=apoyo*.48;m.H.rodillaI.rotation.x+=apoyo*.45;
      mezclar(m,desde,k);apoyar(m);
    }
    return {crearFPS,fps,fbx,capturar,caer,buscar,levantar};
  }
  window.CAOZ_ARPG_ADREIDA_CINE=Object.freeze({fabrica});
})();

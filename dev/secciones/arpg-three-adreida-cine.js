/* Actuación del epílogo: brazos del modelo real para FPS, tropiezo y recuperación.
   No modifica el esqueleto ni las animaciones del combate. */
'use strict';
(function(){
  function fabrica(T,MOD){
    const lim=x=>Math.max(0,Math.min(1,x)),suave=x=>{x=lim(x);return x*x*(3-2*x);};
    const v=new T.Vector3(),q=new T.Quaternion(),contactos=new WeakMap(),contactosSalida=new WeakMap(),remates=new WeakMap(),hachas=new WeakMap();
    const huesos=m=>Object.entries(m.H).filter(([,b])=>b.isBone);
    const capturar=m=>({rot:Object.fromEntries(huesos(m).map(([k,b])=>[k,b.quaternion.clone()])),pos:m.H.cuerpo.position.clone(),rostro:MOD.rostro?.capturar(m)||null,hacha:capturarHacha(m),agarres:m.mallas.map(mesh=>mesh.morphTargetInfluences?.slice()||null)});
    function mezclar(m,desde,k){for(const [n,b]of huesos(m))b.quaternion.slerp(desde.rot[n],1-suave(k));m.H.cuerpo.position.lerp(desde.pos,1-suave(k));MOD.rostro?.mezclar(m,desde.rostro,k);}
    function restaurar(m,desde){m.H.cuerpo.position.copy(desde.pos);for(const [n,b]of huesos(m))if(desde.rot[n])b.quaternion.copy(desde.rot[n]);MOD.rostro?.restaurar(m,desde.rostro);if(desde.hacha)restaurarHacha(m,desde.hacha);desde.agarres?.forEach((valores,i)=>{if(valores)m.mallas[i].morphTargetInfluences.splice(0,valores.length,...valores);});m.raiz.updateMatrixWorld(true);}
    function prepararHacha(m){
      let e=hachas.get(m);if(e)return e.nodo;
      const original=m.hachaScenario;if(!original)return null;
      const nodo=new T.Group(),malla=new T.Mesh(original.geometry,original.material),indice=original.skeleton.bones.indexOf(m.H.manoD);
      nodo.name='Hacha de Adreida · accesorio de cine';malla.name='Hacha aprobada · estiba';nodo.visible=false;
      // La geometría sigue intacta: la inversa de enlace coloca sus vértices en
      // espacio del mango. El nodo permanece siempre bajo el torso, también al buscar cuadros.
      malla.matrixAutoUpdate=false;malla.matrix.copy(original.skeleton.boneInverses[indice]);malla.frustumCulled=false;malla.castShadow=original.castShadow;malla.receiveShadow=original.receiveShadow;
      nodo.add(malla);m.H.torso.add(nodo);e={nodo,malla,original,modo:'mano',activo:false,visible:original.visible,espalda:null};hachas.set(m,e);
      return nodo;
    }
    function capturarHacha(m){
      const e=hachas.get(m);return {modo:e?.activo?e.modo:null,visible:e?.visible??m.hachaScenario?.visible??true,original:m.hachaScenario?.visible??true,sinHacha:m.sinHacha,
        pos:e?.nodo.position.clone()||null,rot:e?.nodo.quaternion.clone()||null,esc:e?.nodo.scale.clone()||null};
    }
    function restaurarHacha(m,estado){
      if(!estado)return;let e=hachas.get(m);if(estado.modo&&!e){prepararHacha(m);e=hachas.get(m);}
      if(e){e.activo=!!estado.modo;e.modo=estado.modo||'mano';e.visible=estado.visible;if(estado.pos)e.nodo.position.copy(estado.pos);if(estado.rot)e.nodo.quaternion.copy(estado.rot);if(estado.esc)e.nodo.scale.copy(estado.esc);e.nodo.visible=e.activo&&e.visible&&e.modo==='espalda';}
      if(m.hachaScenario)m.hachaScenario.visible=estado.original;if(estado.sinHacha===undefined)delete m.sinHacha;else m.sinHacha=estado.sinHacha;
    }
    function visibilidadHacha(m,visible){
      const e=hachas.get(m);if(e){e.visible=visible;e.nodo.visible=visible&&e.activo&&e.modo==='espalda';}
      if(m.hachaScenario)m.hachaScenario.visible=visible&&(!e?.activo||e.modo==='mano');
    }
    function estibaHacha(m,e){
      if(e.espalda)return;
      const anterior=capturar(m),clip=window.CAOZ_ADREIDA_CINE_CLIPS.equiparHacha;
      MOD.posar(m,{anim:'quieto',dt:0,t:0,sinHacha:true,agarreDerecha:true,mezclar:false});fbx(m,'equiparHacha',clip.transferencia.contacto/clip.duracion);
      // La propia mano del clip determina el agarre de espalda. En el cuadro de
      // contacto, accesorio rígido y arma enlazada coinciden vértice por vértice.
      e.espalda=m.H.torso.matrixWorld.clone().invert().multiply(m.H.manoD.matrixWorld);restaurar(m,anterior);
    }
    function portarHacha(m,modo){
      prepararHacha(m);const e=hachas.get(m);if(!e)return;
      e.activo=true;e.modo=modo==='espalda'?'espalda':'mano';m.sinHacha=e.modo==='espalda';
      if(e.modo==='espalda'){estibaHacha(m,e);e.activo=true;e.modo='espalda';m.sinHacha=true;e.espalda.decompose(e.nodo.position,e.nodo.quaternion,e.nodo.scale);}
      visibilidadHacha(m,e.visible);m.raiz.updateMatrixWorld(true);
    }
    function crearFPS(){
      const m=MOD.crear('adreida'),mesh=m.mallas[0],g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
      const brazos=new Set(['anteI','manoI','anteD','manoD'].map(n=>mesh.skeleton.bones.indexOf(m.H[n]))),indices=[];
      for(const lado of ['I','D'])m.H['mano'+lado].traverse(b=>{if(b.isBone)brazos.add(mesh.skeleton.bones.indexOf(b));});
      const peso=i=>{let p=0;for(let j=0;j<4;j++)if(brazos.has(si.array[i*4+j]))p+=sw.array[i*4+j];return p;};
      const origen=g.index?.array||Array.from({length:g.attributes.position.count},(_,i)=>i);
      for(let i=0;i<origen.length;i+=3)if([0,1,2].every(j=>peso(origen[i+j])>.15))indices.push(...origen.slice(i,i+3));
      // Se comparten los atributos y mapas; sólo se crea el índice de los dos brazos.
      const parcial=new T.BufferGeometry();for(const [n,a]of Object.entries(g.attributes))parcial.setAttribute(n,a);parcial.morphAttributes=g.morphAttributes;parcial.morphTargetsRelative=g.morphTargetsRelative;parcial.setIndex(indices);mesh.geometry=parcial;
      for(const p of m.mallas){p.castShadow=p.receiveShadow=false;p.frustumCulled=false;if(p.userData.rostro)p.visible=false;}
      m.raiz.name='Adreida · brazos en primera persona';m.raiz.visible=false;
      return m;
    }
    function fps(m,camara,fase,t,ataque=null,clipAtaque=null){
      const carreraVista=ataque===null&&clipAtaque==='carreraCine';
      MOD.posar(m,{anim:'quieto',dt:0,t,sinHacha:true,agarreDerecha:true,mezclar:false});const H=m.H;
      H.cuerpo.position.set(0,0,0);H.cadera.rotation.set(0,0,0);H.torso.rotation.set(0,0,Math.sin(fase)*.018);
      for(const [l,signo]of [['D',-1],['I',1]]){
        const paso=Math.sin(fase+(l==='I'?Math.PI:0));
        H['brazo'+l].rotation.set(-.4+paso*.12,signo*.08,signo*.22);
        H['ante'+l].rotation.set(-1.3-paso*.16,0,0);
        H['mano'+l].rotation.set(0,0,signo*(Math.PI/2-.31));
      }
      if(carreraVista)carreraCine(m,((fase/(Math.PI*2))%1+1)%1);
      // El mismo clip y el mismo progreso continúan después del corte a tercera persona.
      const entradaAtaque=ataque===null?0:clipAtaque==='rematarDeslizamiento'?1:suave(ataque/.085);
      if(ataque!==null){const desde=capturar(m);if(clipAtaque==='deslizarAtaque')deslizar(m,ataque);else if(clipAtaque==='rematarDeslizamiento')rematarDeslizamiento(m,ataque);else MOD.posar(m,{anim:'tajoA',k:ataque,t,dt:0,mezclar:false});mezclar(m,desde,entradaAtaque);}
      // El agarre de tercera persona arma el golpe detrás del hombro. Adelanta el
      // modelo de vista para mantener manos y filo dentro del encuadre durante ese arco.
      // La preparación del slide lleva el filo sobre la cabeza: el modelo de
      // vista necesita más separación para que la hoja no atraviese la lente.
      const deslizante=clipAtaque==='deslizarAtaque'||clipAtaque==='rematarDeslizamiento';
      // Como modelo de vista, los antebrazos del slide se dibujan delante del
      // entorno: acercarse al mago no oculta las manos dentro de su túnica.
      capaFPS(m,deslizante);
      m.raiz.position.set(-.15*entradaAtaque,-(carreraVista?1.75:1.50)-.14*entradaAtaque,-(carreraVista?.52:.20)-.8*entradaAtaque).applyQuaternion(camara.quaternion).add(camara.position);
      m.raiz.quaternion.copy(camara.quaternion);if(deslizante)m.raiz.rotateX(-1.05*entradaAtaque);
      m.raiz.quaternion.multiply(q.setFromAxisAngle(v.set(0,1,0),Math.PI));
      if(deslizante){
        // Adaptación de presentación FPS: mantiene el agarre en primer término
        // y orienta la preparación sobre el encuadre, sin tocar al actor real.
        m.raiz.updateMatrixWorld(true);const mano=m.H.manoD.getWorldPosition(new T.Vector3());
        const apoyo=new T.Vector3(.3,-.75,-1.18).applyQuaternion(camara.quaternion).add(camara.position);
        m.raiz.position.addScaledVector(apoyo.sub(mano),entradaAtaque);
      }
      m.raiz.updateMatrixWorld(true);
      if(carreraVista){
        // El mango sigue al lateral derecho y el filo real (+Z del hacha) mira
        // al mago. Girar sobre el mango conserva el puño cerrado y deja leer la palma.
        const y=new T.Vector3(-.72,-.60,.35).normalize(),z=new T.Vector3(0,0,-1);z.addScaledVector(y,-z.dot(y)).normalize();const x=new T.Vector3().crossVectors(y,z);
        const orientacion=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).premultiply(camara.quaternion),padre=H.manoD.parent.getWorldQuaternion(new T.Quaternion()).invert();H.manoD.quaternion.copy(padre).multiply(orientacion);m.raiz.updateMatrixWorld(true);
      }
    }
    function capaFPS(m,deslizante){for(const p of m.mallas){p.material.depthTest=p.material.depthWrite=!deslizante;p.renderOrder=deslizante?40:0;}}
    function fbx(m,nombre,k,desde=null,entrada=1){
      const clip=window.CAOZ_ADREIDA_CINE_CLIPS[nombre],{datos,ancho,huesos,muestras}=clip;
      const f=lim(k)*(muestras-1),i=Math.floor(f),j=Math.min(muestras-1,i+1),u=f-i;
      m.H.cuerpo.position.fromArray(datos,i*ancho).lerp(v.fromArray(datos,j*ancho),u);
      for(let n=0;n<huesos.length;n++)m.H[huesos[n]].quaternion.fromArray(datos,i*ancho+3+n*4).normalize().slerp(q.fromArray(datos,j*ancho+3+n*4).normalize(),u);
      if(desde)mezclar(m,desde,entrada);m.raiz.updateMatrixWorld(true);
    }
    function deslizar(m,k,desde=null,entrada=1){
      // El FBX aporta cuerpo y arco del arma; el rig aprobado mantiene las dos
      // manos cerradas sobre el mango, incluso al venir de la carrera a una mano.
      MOD.posar(m,{anim:'quieto',dt:0,t:0,mezclar:false});
      fbx(m,'deslizarAtaque',k,desde,entrada);
    }
    function carreraCine(m,k,desde=null,entrada=1){
      const espalda=hachas.get(m)?.modo==='espalda';
      MOD.posar(m,{anim:'quieto',dt:0,t:0,sinHacha:true,agarreDerecha:!espalda,mezclar:false});fbx(m,'carreraCine',k,desde,entrada);
    }
    function equiparHacha(m,k,desde=null,entrada=1){
      const clip=window.CAOZ_ADREIDA_CINE_CLIPS.equiparHacha,t=lim(k)*clip.duracion,contacto=clip.transferencia.contacto,tomada=t+1e-8>=contacto;
      prepararHacha(m);estibaHacha(m,hachas.get(m));
      MOD.posar(m,{anim:'quieto',dt:0,t:0,sinHacha:true,agarreDerecha:tomada,mezclar:false});fbx(m,'equiparHacha',k);
      if(clip.giros){const f=lim(k)*(clip.muestras-1),i=Math.floor(f),j=Math.min(clip.muestras-1,i+1),giro=clip.giros[i]+(clip.giros[j]-clip.giros[i])*(f-i);m.H.cadera.quaternion.premultiply(q.setFromAxisAngle(v.set(0,1,0),giro));}
      if(desde)mezclar(m,desde,entrada);apoyarSalida(m);portarHacha(m,tomada?'mano':'espalda');
    }
    function patadaPuerta(m,k,desde=null,entrada=1){
      const clip=window.CAOZ_ADREIDA_CINE_CLIPS.patadaPuerta;
      portarHacha(m,'espalda');MOD.posar(m,{anim:'quieto',dt:0,t:0,sinHacha:true,mezclar:false});fbx(m,'patadaPuerta',k);
      const f=lim(k)*(clip.muestras-1),i=Math.floor(f),j=Math.min(clip.muestras-1,i+1),giro=clip.giroBasePuerta+clip.giros[i]+(clip.giros[j]-clip.giros[i])*(f-i);
      // La guardia empieza de costado: se repone también su ángulo inicial para
      // que la bota izquierda golpee +Z hacia la puerta. La raíz la dirige el guion.
      m.H.cadera.quaternion.premultiply(q.setFromAxisAngle(v.set(0,1,0),giro));
      if(desde)mezclar(m,desde,entrada);apoyarSalida(m);
    }
    function salidaConGiro(m,k,desde=null,entrada=1){
      // Inicializa dedos y correctivos del mango. La pose FBX reemplaza después
      // todos los huesos del cuerpo y ambos brazos, sin resolverles otro gesto.
      MOD.posar(m,{anim:'quieto',dt:0,t:0,sinHacha:true,agarreDerecha:hachas.get(m)?.modo!=='espalda',mezclar:false});
      fbx(m,'salidaConGiro',k,desde,entrada);
      apoyarSalida(m);
    }
    function apoyarSalida(m){
      const mesh=m.mallas[0],g=mesh.geometry,p=g.attributes.position;let puntos=contactosSalida.get(g);
      if(!puntos){
        // Extremos de cada bota en 98 direcciones. Se eligen una vez sobre la
        // geometría compartida; cada cuadro de cine evalúa sólo esos apoyos.
        const botas=[[],[]],seleccion=new Set();for(let i=0;i<p.count;i++)if(p.getY(i)<.24)botas[p.getX(i)<0?0:1].push(i);
        for(const bota of botas)for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++)if(Math.max(Math.abs(x),Math.abs(y),Math.abs(z))===2){
          let minimo=Infinity,indice=-1;for(const i of bota){const d=x*p.getX(i)+y*p.getY(i)+z*p.getZ(i);if(d<minimo){minimo=d;indice=i;}}if(indice>=0)seleccion.add(indice);
        }
        puntos=[...seleccion];contactosSalida.set(g,puntos);
      }
      m.raiz.updateMatrixWorld(true);let minimo=Infinity;
      for(const i of puntos)minimo=Math.min(minimo,mesh.getVertexPosition(i,v).y);
      if(Number.isFinite(minimo))m.H.cuerpo.position.y+=.012-minimo;
      m.raiz.updateMatrixWorld(true);
    }
    function movimientoSalida(k,desplazamiento){
      const clip=window.CAOZ_ADREIDA_CINE_CLIPS.salidaConGiro,f=lim(k)*(clip.muestras-1),i=Math.floor(f),j=Math.min(clip.muestras-1,i+1),u=f-i;
      desplazamiento.fromArray(clip.raiz,i*3).lerp(v.fromArray(clip.raiz,j*3),u);
      return clip.giros[i]+(clip.giros[j]-clip.giros[i])*u;
    }
    const tiemposRemate=Object.freeze({duracion:1.04,subida:.30,giro:.46,freno:.28});
    const ejeY=new T.Vector3(0,1,0),giroRemate=new T.Quaternion(),pivoteRemate=new T.Vector3();
    const puntosIK=Array.from({length:9},()=>new T.Vector3()),giroIK=new T.Quaternion(),padreIK=new T.Quaternion(),manoIK=new T.Quaternion();
    function orientarTramo(hijo,punta,destino){
      const inicio=hijo.getWorldPosition(puntosIK[5]),actual=punta.getWorldPosition(puntosIK[6]).sub(inicio).normalize(),nuevo=puntosIK[7].copy(destino).sub(inicio).normalize();
      giroIK.setFromUnitVectors(actual,nuevo);hijo.parent.getWorldQuaternion(padreIK);giroIK.premultiply(padreIK.clone().invert()).multiply(padreIK);
      hijo.quaternion.premultiply(giroIK).normalize();hijo.updateMatrixWorld(true);
    }
    function brazoHasta(brazo,ante,mano,meta){
      // Conserva el plano del codo de la pose mezclada y corrige sólo el alcance.
      const s=brazo.getWorldPosition(puntosIK[0]),e=ante.getWorldPosition(puntosIK[1]),dir=puntosIK[2].copy(meta).sub(s),a=ante.position.length(),b=mano.position.length();
      const d=Math.min(a+b-1e-5,Math.max(Math.abs(a-b)+1e-5,dir.length()));dir.normalize();
      const polo=puntosIK[3].copy(e).sub(s);polo.addScaledVector(dir,-polo.dot(dir));if(polo.lengthSq()<1e-10)polo.set(0,0,1);polo.normalize();
      const x=(a*a-b*b+d*d)/(2*d),codo=puntosIK[4].copy(s).addScaledVector(dir,x).addScaledVector(polo,Math.sqrt(Math.max(0,a*a-x*x)));
      orientarTramo(brazo,ante,codo);orientarTramo(ante,mano,meta);
    }
    function cerrarAgarre(m){
      // La mezcla de cuaterniones no conserva una restricción de distancia. El
      // ajuste es exclusivo de cine y mantiene el mango aprobado de 30 cm.
      const H=m.H;m.raiz.updateMatrixWorld(true);H.manoI.getWorldQuaternion(manoIK);
      const apoyo=H.manoD.localToWorld(puntosIK[8].set(0,-.3,0));
      brazoHasta(H.brazoI,H.anteI,H.manoI,apoyo);
      H.manoI.parent.getWorldQuaternion(padreIK).invert();H.manoI.quaternion.copy(padreIK).multiply(manoIK);m.raiz.updateMatrixWorld(true);
    }
    function alturaSuelo(m){
      m.raiz.updateMatrixWorld(true);let bajo=Infinity;
      // Incluye el arma para que la incorporación tampoco arrastre el filo.
      for(const mesh of m.mallas){const g=mesh.geometry;let puntos=contactos.get(g);if(!puntos){puntos=[];for(let i=0;i<g.attributes.position.count;i+=11)puntos.push(i);contactos.set(g,puntos);}
        for(const i of puntos)bajo=Math.min(bajo,mesh.getVertexPosition(i,v).y);}
      return bajo;
    }
    function apoyarRemate(m,altura){m.H.cuerpo.position.y+=altura-alturaSuelo(m);m.raiz.updateMatrixWorld(true);}
    const guardiaM=new T.Matrix4(),guardiaQ=new T.Quaternion(),guardiaG=new T.Vector3(),guardiaA=new T.Vector3(),guardiaX=new T.Vector3(),guardiaY=new T.Vector3(),guardiaZ=new T.Vector3();
    function guardiaBaja(m){
      const H=m.H;m.raiz.updateMatrixWorld(true);
      // El mango cruza delante de la cintura: el filo deja libre la cabeza al
      // buscar y ambos brazos siguen dentro del alcance del rig aprobado.
      guardiaG.set(.15,.10,.20).applyMatrix4(H.torso.matrixWorld);guardiaA.set(-1,-.025,.12).normalize().transformDirection(H.torso.matrixWorld);
      brazoHasta(H.brazoD,H.anteD,H.manoD,guardiaG);
      guardiaY.copy(guardiaA).negate();guardiaX.set(0,1,0).transformDirection(H.torso.matrixWorld);guardiaX.addScaledVector(guardiaY,-guardiaY.dot(guardiaX)).normalize();guardiaZ.crossVectors(guardiaX,guardiaY);
      H.manoD.parent.getWorldQuaternion(guardiaQ).invert();H.manoD.quaternion.setFromRotationMatrix(guardiaM.makeBasis(guardiaX,guardiaY,guardiaZ)).premultiply(guardiaQ);H.manoD.updateMatrixWorld(true);
      guardiaG.copy(H.manoD.localToWorld(guardiaG.set(0,-.3,0)));brazoHasta(H.brazoI,H.anteI,H.manoI,guardiaG);
      H.manoD.getWorldQuaternion(guardiaQ);H.manoI.parent.getWorldQuaternion(padreIK).invert();H.manoI.quaternion.copy(padreIK).multiply(guardiaQ);m.raiz.updateMatrixWorld(true);
    }
    function posturaDePie(m,girando){
      MOD.posar(m,{anim:girando?'torbellino':'quieto',dt:0,t:0,mezclar:false});const H=m.H;
      H.cuerpo.position.set(0,0,0);H.cadera.rotation.set(0,0,0);H.torso.rotation.set(girando?.045:.065,0,0);H.cabeza.rotation.set(-.035,0,0);
      H.piernaI.rotation.set(-.15,0,.06);H.rodillaI.rotation.set(.26,0,0);H.pieI.rotation.set(-.11,0,-.06);
      H.piernaD.rotation.set(.08,0,-.06);H.rodillaD.rotation.set(.14,0,0);H.pieD.rotation.set(-.22,0,.06);
      if(girando){
        H.cadera.rotation.set(.055,-.12,-.10);H.torso.rotation.set(.18,.24,.10);H.cabeza.rotation.set(-.12,-.18,0);
        H.piernaI.rotation.set(-.46,.04,.10);H.rodillaI.rotation.set(.83,0,0);H.pieI.rotation.set(-.425,0,0);
        H.piernaD.rotation.set(.12,-.10,-.14);H.rodillaD.rotation.set(.60,0,0);H.pieD.rotation.set(-.72,0,.13);
      }
      // Se reutiliza el agarre del juego después de enderezar el pecho; la tela
      // se fija por pose para que buscar hacia atrás no arrastre su simulación.
      MOD.animacion.resolver(m,{anim:girando?'torbellino':'quieto',dt:0,t:0,mezclar:false});
      if(!girando)guardiaBaja(m);
      for(let i=0;i<7;i++){const ang=(i+.5)/7*Math.PI*2+.08;H['falda'+i].rotation.set(-Math.cos(ang)*.055,0,Math.sin(ang)*.055);}
      m.raiz.updateMatrixWorld(true);
    }
    function posesRemate(m){
      let p=remates.get(m);if(p)return p;
      deslizar(m,.9/window.CAOZ_ADREIDA_CINE_CLIPS.deslizarAtaque.duracion);const inicio=capturar(m),suelo=alturaSuelo(m);
      posturaDePie(m,true);apoyarRemate(m,suelo);const giro=capturar(m),pivote=m.raiz.worldToLocal(m.H.pieI.getWorldPosition(new T.Vector3()));
      posturaDePie(m,false);apoyarRemate(m,suelo);const fin=capturar(m);
      p={inicio,giro,fin,suelo,pivote};remates.set(m,p);return p;
    }
    function rematarDeslizamiento(m,k,desde=null,entrada=1){
      const p=posesRemate(m),{duracion,subida,giro,freno}=tiemposRemate,t=lim(k)*duracion,finGiro=subida+giro,anticipacion=.05,inicioGiro=subida-anticipacion;
      if(t===0)restaurar(m,p.inicio);
      else if(t<subida){restaurar(m,p.giro);mezclar(m,p.inicio,t/subida);}
      else if(t<finGiro)restaurar(m,p.giro);
      else{restaurar(m,p.fin);mezclar(m,p.giro,(t-finGiro)/freno);}
      // Se evalúa el ángulo completo: interpolar sólo el cuaternión inicial y
      // final perdería la vuelta de 360°. La raíz permanece fija en la plaza.
      // El giro empieza durante los últimos 50 ms de incorporación, de modo que
      // al acabar de subir la cadera ya avanza y no aparece una pausa de preparación.
      const u=lim((t-inicioGiro)/(giro+anticipacion)),peso=Math.sin(Math.PI*u)**2,H=m.H;
      if(t>=inicioGiro&&t<=finGiro){
        // Carga sobre la izquierda, recoge la derecha y vuelve a apoyarla.
        // El pecho retrasa el arma respecto a la cadera durante la aceleración.
        H.piernaI.rotation.x-=.16*peso;H.rodillaI.rotation.x+=.26*peso;H.pieI.rotation.x-=.10*peso;
        H.piernaD.rotation.x-=.72*peso;H.rodillaD.rotation.x+=.80*peso;H.pieD.rotation.x+=.18*peso;
        H.cadera.rotation.z-=.09*peso;H.torso.rotation.x+=.10*peso;H.torso.rotation.y-=.36*peso;H.torso.rotation.z+=.07*peso;H.cabeza.rotation.y+=.18*peso;
      }
      const vuelta=Math.PI*2*suave(u);H.cadera.quaternion.premultiply(giroRemate.setFromAxisAngle(ejeY,vuelta));
      if(t>=inicioGiro&&t<=finGiro){
        // La bota izquierda gira sobre el mismo punto. Sólo el cuerpo transfiere
        // su peso alrededor de ese apoyo; la raíz de la plaza queda inmóvil.
        const apoyo=suave((t-inicioGiro)/anticipacion);m.raiz.updateMatrixWorld(true);m.raiz.worldToLocal(H.pieI.getWorldPosition(pivoteRemate));H.cuerpo.position.x+=(p.pivote.x-pivoteRemate.x)*apoyo;H.cuerpo.position.z+=(p.pivote.z-pivoteRemate.z)*apoyo;
      }
      if(desde)mezclar(m,desde,entrada);
      if(t>0&&(!desde||entrada>0)){cerrarAgarre(m);apoyarRemate(m,p.suelo);}
      m.raiz.updateMatrixWorld(true);
    }
    function buscarDePie(m,t,desde=null,entrada=1,duracion=1.2){
      const p=posesRemate(m);restaurar(m,p.fin);const u=lim(t/Math.max(.01,duracion));
      // Comprueba izquierda y derecha; regresa al centro con velocidad cero para
      // entregar la mirada al POV sin cortar un giro de cabeza a medio recorrido.
      const mirada=u<.28?-.95*suave(u/.28):u<.72?-.95+1.98*suave((u-.28)/.44):1.03*(1-suave((u-.72)/.28));
      m.H.torso.rotation.y=mirada*.16;m.H.cabeza.rotation.y=mirada;m.H.cabeza.rotation.x=-.035+Math.sin(u*Math.PI)**2*.045;
      if(desde){mezclar(m,desde,entrada);if(entrada>0){cerrarAgarre(m);apoyarRemate(m,p.suelo);}}
      m.raiz.updateMatrixWorld(true);
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
    return {crearFPS,fps,capaFPS,fbx,deslizar,carreraCine,equiparHacha,patadaPuerta,prepararHacha,portarHacha,visibilidadHacha,capturarHacha,restaurarHacha,salidaConGiro,apoyarSalida,movimientoSalida,tiemposRemate,rematarDeslizamiento,buscarDePie,capturar,restaurar,mezclar,caer,buscar,levantar};
  }
  window.CAOZ_ARPG_ADREIDA_CINE=Object.freeze({fabrica});
})();

/* Animación procedural de Adreida: poses, hacha a dos manos y transiciones.
   No conoce controles, daño, enfriamientos ni enemigos. El combate entrega anim/estado/k/dt.
   La mezcla termina antes del barrido; el instante del impacto pertenece al combate. */
'use strict';
(function(){
  const TAU=Math.PI*2, suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
  const limites=Object.freeze({caminar:[0,.3],carga:[0,.18],regreso:[0,.4],zancada:[.75,1.15]});
  const predeterminados=Object.freeze({caminar:.12,carga:.10,regreso:.18,zancada:1});
  function validar(p){
    if(!p||p.version!==1||p.personaje!=='adreida'||!p.ajustes||typeof p.ajustes!=='object')throw Error('Formato de animación inválido (Adreida, versión 1).');
    if(Object.keys(p.ajustes).some(k=>!Object.hasOwn(limites,k)))throw Error('El archivo contiene ajustes desconocidos.');
    const resultado={};
    for(const [k,[min,max]] of Object.entries(limites)){const v=p.ajustes[k];if(!Number.isFinite(v)||v<min||v>max)throw Error(`Ajuste inválido: ${k} (${min}–${max}).`);resultado[k]=v;}
    return resultado;
  }
  function fabrica(THREE){
    let ajustes={...predeterminados};
    const estados=new WeakMap();
    const configuracion=()=>({version:1,personaje:'adreida',ajustes:{...ajustes}});
    function configurar(p){const nuevos=validar(p);ajustes=nuevos;return configuracion();}
    /* ---- El hacha a dos manos de Adreida ------------------------------------------------------
       Cada pose dice dónde está la empuñadura (G, la mano derecha) y hacia dónde apunta el hacha (A),
       en el espacio del torso; los dos brazos llegan con cinemática inversa de dos huesos: la derecha
       a G, junto al pomo, y la izquierda 30 cm hacia la cabeza del hacha. La mano derecha se orienta para
       que el hacha (su -Y) siga A, con la cara plana hacia «arriba» (en los tajos horizontales, al
       cielo: se ve desde la cámara; en el hachazo vertical, de lado: el filo corta de arriba abajo). */
    const _v=Array.from({length:10},()=>new THREE.Vector3()),_q=new THREE.Quaternion(),_m=new THREE.Matrix4(),ABAJO=new THREE.Vector3(0,-1,0);
    function apuntarHueso(b,dir){b.parent.getWorldQuaternion(_q).invert();b.quaternion.setFromUnitVectors(ABAJO,_v[9].copy(dir).normalize().applyQuaternion(_q));b.updateMatrixWorld(true);}
    function ik(brazo,ante,mano,T,polo){const S=brazo.getWorldPosition(_v[0]),a=ante.position.length(),b=mano.position.length(),D=_v[1].copy(T).sub(S);
      const d=Math.min(a+b-1e-3,Math.max(Math.abs(a-b)+1e-3,D.length())),dir=D.normalize(),x=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));
      const p=_v[2].copy(polo).sub(S);p.addScaledVector(dir,-p.dot(dir));if(p.lengthSq()<1e-8)p.set(0,-1,0);p.normalize();
      const E=_v[3].copy(S).addScaledVector(dir,x).addScaledVector(p,h);apuntarHueso(brazo,_v[4].copy(E).sub(S));apuntarHueso(ante,_v[5].copy(S).addScaledVector(dir,d).sub(E));}
    const dirA=(f,e)=>[Math.sin(f)*Math.cos(e),Math.sin(e),Math.cos(f)*Math.cos(e)];
    const _agarre=Array.from({length:8},()=>new THREE.Vector3()),_orientacion=new THREE.Quaternion();
    function empunar(m,{G,A,arriba}){const H=m.H;H.raiz.updateMatrixWorld(true);const T=H.torso.matrixWorld;
      const g=_v[6].fromArray(G).applyMatrix4(T),a=_v[7].fromArray(A).transformDirection(T),up=_v[8].fromArray(arriba||[0,1,0]).transformDirection(T);
      // Los dos agarres deben quedar al alcance sin estirar los brazos ni soltar el mango.
      const separacion=.3,sd=H.brazoD.getWorldPosition(_agarre[0]),si=H.brazoI.getWorldPosition(_agarre[1]).addScaledVector(a,-separacion);
      const alcance=m.p.brazo+m.p.antebrazo-.015;
      for(let i=0;i<8;i++)for(let j=0;j<2;j++){const centro=j?si:sd,delta=_agarre[2].copy(g).sub(centro);if(delta.length()>alcance)g.copy(centro).add(delta.setLength(alcance));}
      ik(H.brazoD,H.anteD,H.manoD,g,_agarre[3].set(-.7,-.5,-.35).applyMatrix4(T));
      // La mano derecha: -Y por el mango, X (la cara del hacha) lo más cerca posible de «arriba».
      const y=_agarre[4].copy(a).negate(),x=_agarre[5].copy(up).addScaledVector(y,-up.dot(y));if(x.lengthSq()<1e-6)x.set(1,0,0);x.normalize();const z=_agarre[6].crossVectors(x,y);
      H.manoD.parent.getWorldQuaternion(_q).invert();H.manoD.quaternion.setFromRotationMatrix(_m.makeBasis(x,y,z)).premultiply(_q);H.manoD.updateMatrixWorld(true);
      // La izquierda envuelve el mango entre la derecha y la cabeza, nunca fuera del pomo.
      const apoyo=H.manoD.localToWorld(_agarre[7].set(0,-separacion,0));
      ik(H.brazoI,H.anteI,H.manoI,apoyo,_agarre[3].set(.7,-.5,-.35).applyMatrix4(T));
      const orientacion=H.manoD.getWorldQuaternion(_orientacion);
      H.manoI.parent.getWorldQuaternion(_q).invert();H.manoI.quaternion.copy(_q).multiply(orientacion);H.manoI.updateMatrixWorld(true);}
    // Corrige el agarre después de interpolar los huesos para dibujar a más de 60 Hz.
    // Los búferes del render restauran luego la pose física; no avanzamos la animación aquí.
    const visual={G:[0,0,0],A:[0,-1,0],arriba:[1,0,0]},_localVisual=new THREE.Matrix4(),_manoVisual=new THREE.Quaternion(),_pVisual=new THREE.Vector3();
    function ajustarAgarre(m){
      if(m.tipo!=='adreida'||estados.get(m)?.libre)return;
      const H=m.H;H.raiz.updateMatrixWorld(true);_localVisual.copy(H.torso.matrixWorld).invert();H.manoD.getWorldQuaternion(_manoVisual);
      H.manoD.getWorldPosition(_pVisual).applyMatrix4(_localVisual).toArray(visual.G);
      _pVisual.set(0,-1,0).applyQuaternion(_manoVisual).transformDirection(_localVisual).toArray(visual.A);
      _pVisual.set(1,0,0).applyQuaternion(_manoVisual).transformDirection(_localVisual).toArray(visual.arriba);
      empunar(m,visual);
    }
    // Dónde lleva el hacha en cada animación (espacio del torso: +Z delante, +X su izquierda, -X su derecha).
    function agarreAdreida(a){const k=a.k||0,t=a.t||0;
      // El mango descansa sobre el hombro derecho; la cabeza queda detrás y las manos delante del pecho.
      const reposo=()=>{const bob=a.anim==='andar'?Math.sin((a.fase||0)*2)*.008*(a.paso??1):Math.sin(t*2.2)*.004;return {G:[-.11,.35+bob,.36],A:dirA(-2.73,.46),arriba:[0,1,0]};};
      const horizontal=(f,e)=>{const r=.42-.08*Math.abs(Math.sin(f));return {G:[Math.sin(f)*r,.28,Math.cos(f)*r],A:dirA(f,e),arriba:[0,1,0]};};
      const mezcla=(p,q,w)=>({G:p.G.map((v,i)=>v+(q.G[i]-v)*w),A:(()=>{const v=p.A.map((x,i)=>x+(q.A[i]-x)*w),l=Math.hypot(...v)||1;return v.map(x=>x/l);})(),arriba:q.arriba||p.arriba});
      const vertical=al=>({G:[-.04,.35+Math.sin(al)*.38,.05+Math.cos(al)*.38],A:[-.08,Math.sin(al),Math.cos(al)],arriba:[1,0,0]});
      switch(a.anim){
        case 'tajoA':case 'revesA':{const r=a.anim==='revesA',s=r?-1:1,car=tramo(k,0,.4),gol=tramo(k,.4,.62),rec=tramo(k,.66,1);
          const f=(-1.3*car+2.4*gol)*s,e=-.25;return mezcla(mezcla(reposo(),horizontal(f,e),Math.max(car,gol)),reposo(),rec);}
        case 'estocadaA':{const car=tramo(k,0,.38),emp=tramo(k,.38,.48),rec=tramo(k,.66,1);return mezcla(mezcla(reposo(),vertical(-.8+2.8*car-2.3*emp),Math.min(1,car*1.5)),reposo(),rec);}
        case 'torbellino':return horizontal(-1.25,-.12);
        // Parry: el hacha en guardia diagonal delante del pecho (la cabeza sobre el hombro derecho), la cara plana hacia el golpe.
        case 'parry':{const e=tramo(k,0,.15)*(1-tramo(k,.8,1));const A=[-.55,.82,.14],l=Math.hypot(...A);return mezcla(reposo(),{G:[.16,.16,.38],A:A.map(x=>x/l),arriba:[0,0,1]},e);}
        case 'salto':{const arr=tramo(k,.12,.3)*(1-tramo(k,.75,.9)),cae=tramo(k,.75,.9);return mezcla(reposo(),vertical(2.1*arr-.7*cae),Math.max(arr,cae));}
        default:return reposo();}}

    function posar(m,a){
      const H=m.H,k=a.k||0,respira=Math.sin((a.t||0)*2.2);
      switch(a.anim){
        case 'quieto':H.torso.rotation.x=.1+respira*.012;H.rodillaI.rotation.x=H.rodillaD.rotation.x=.12;H.cuerpo.position.y=-.025+respira*.006;break;
        case 'andar':{const fase=a.fase||0,amp=(a.paso??1)*ajustes.zancada,s=Math.sin(fase);
          // Apoyo y balanceo alternos: el talón avanza, la rodilla recoge y el tobillo amortigua.
          for(const [lado,desfase] of [['I',0],['D',Math.PI]]){
            const f=fase+desfase,avance=Math.sin(f),vuelo=Math.max(0,Math.cos(f)),impulso=Math.max(0,-avance);
            const muslo=-avance*.78*amp,rodilla=.12+(vuelo*vuelo*1.05+.1*impulso)*amp;
            H['pierna'+lado].rotation.x=muslo;H['rodilla'+lado].rotation.x=rodilla;
            H['pie'+lado].rotation.x=(-muslo-(rodilla-.12))*.75+.16*impulso*amp;
            H['pierna'+lado].rotation.z=(lado==='I'?-.025:.025)*amp;
          }
          // La cadera carga el peso sobre la pierna de apoyo; el torso compensa el hacha pesada.
          H.cuerpo.position.set(s*.025*amp,-.025+respira*.006+(Math.cos(fase*2)*.022-.008)*amp,0);
          H.cadera.rotation.y=s*.11*amp;H.cadera.rotation.z=-s*.035*amp;
          H.torso.rotation.set(.1+respira*.012+.065*amp,-s*.075*amp,s*.025*amp);
          H.cabeza.rotation.x=-.04-.035*amp;H.cabeza.rotation.y=s*.035*amp;H.cabeza.rotation.z=-s*.02*amp;
          break;
        }
        // Los hachazos de Adreida: el brazo casi horizontal barre un arco delante (el hacha lo prolonga).
        // brazoD.z lo levanta hacia su derecha y brazoD.y lo barre en horizontal: -.5 detrás a la derecha, 1.57 delante, 2.5 a la izquierda.
        case 'tajoA':case 'revesA':{const r=a.anim==='revesA',car=tramo(k,0,.4),gol=tramo(k,.4,.62),rec=tramo(k,.66,1),de=r?2.4:-.55,a2=r?-.45:2.35;
          const barre=de+(a2-de)*gol,alto=1-rec;
          H.brazoD.rotation.z=-.3-.95*Math.max(car,gol)*alto;H.brazoD.rotation.y=(barre*(car>0?1:0))*alto+(r?.2:-.2)*(1-car)*alto;H.brazoD.rotation.x=-.25*rec-.15*(1-car)*alto;
          H.anteD.rotation.x=-.75*(1-car)*alto-.45*car*(1-gol)*alto-.08*gol*alto-.7*rec;
          const giro=(r?.55:-.55)*car*(1-gol)+(r?-.5:.5)*gol*alto;H.torso.rotation.y=giro;H.cadera.rotation.y=giro*.4;H.torso.rotation.x=.08+.1*gol*alto;
          H.brazoI.rotation.z=.18+.5*gol*alto;H.brazoI.rotation.x=(r?-.5:.4)*gol*alto;
          H.piernaI.rotation.x=-.35*gol*alto;H.rodillaI.rotation.x=.35*gol*alto+.05;H.piernaD.rotation.x=.3*gol*alto;H.rodillaD.rotation.x=.15;H.cuerpo.position.y=-.06*gol*alto;break;}
        case 'estocadaA':{const car=tramo(k,0,.42),emp=tramo(k,.42,.56),rec=tramo(k,.68,1),e2=emp*(1-rec),c2=car*(1-emp);
          const alto=1-rec;H.brazoD.rotation.z=-(.3+1.2*car)*alto-.3*rec;H.brazoD.rotation.y=(.5*car+1.07*emp)*alto;H.brazoD.rotation.x=-.3*rec;
          H.anteD.rotation.x=(-.75*(1-car)-1.5*car*(1-emp)-.02*emp)*alto-.75*rec;H.torso.rotation.y=-.6*c2+.35*e2;H.torso.rotation.x=.05+.3*e2;H.cadera.rotation.y=-.25*c2+.15*e2;
          H.brazoI.rotation.x=.6*e2-.3*c2;H.brazoI.rotation.z=.18+.35*e2;
          H.piernaI.rotation.x=-.95*e2-.15*c2;H.rodillaI.rotation.x=.75*e2+.25*c2;H.piernaD.rotation.x=.75*e2+.15*c2;H.rodillaD.rotation.x=.2+.3*e2;H.cuerpo.position.y=-.14*e2-.04*c2;
          // Un paso dentro del hachazo: con las dos manos al alcance de ambos brazos, el cuerpo lleva el hacha hasta el golpe.
          H.cuerpo.position.z=.22*e2;break;}
        default:return false;
      }
      return true;
    }
    // Búferes por personaje, creados una sola vez. No añadimos mallas, esqueletos ni pasadas de dibujo.
    function memoria(m){
      let e=estados.get(m);if(e)return e;
      const huesos=Object.entries(m.H).filter(([k])=>k!=='raiz'&&!/^(brazo|ante|mano|falda)/.test(k)).map(([,b])=>b);
      e={huesos,ultima:huesos.map(()=>new THREE.Quaternion()),desde:huesos.map(()=>new THREE.Quaternion()),pos:new THREE.Vector3(),desdePos:new THREE.Vector3(),
        agarre:{G:[0,0,0],A:[0,0,1],arriba:[0,1,0]},desdeAgarre:{G:[0,0,0],A:[0,0,1],arriba:[0,1,0]},valido:false,libre:false,estado:null,tiempo:0,duracion:0};
      estados.set(m,e);return e;
    }
    function copiarAgarre(dest,src){for(const k of ['G','A','arriba'])for(let i=0;i<3;i++)dest[k][i]=src[k][i];}
    function mezclar(m,a,agarre){
      const e=memoria(m),estado=a.estado||(['tajoA','revesA','estocadaA'].includes(a.anim)?'golpe':a.anim),libre=['grito','muerte'].includes(a.anim),exacta=a.mezclar!==true;
      const nuevo=estado!==e.estado||a.anim!==e.anim;
      if(exacta||!e.valido||libre||e.libre){e.duracion=0;e.tiempo=0;}
      else if(nuevo){
        // La pose final del cargado se mantiene exactamente durante sus 0,3 s de recuperación.
        e.duracion=estado==='carga'?ajustes.carga:estado==='andar'?ajustes.caminar:estado==='quieto'?ajustes.regreso:estado==='golpe'?Math.min(.08,ajustes.carga):estado==='parry'?.035:0;
        e.tiempo=0;e.desdePos.copy(e.pos);e.huesos.forEach((b,i)=>e.desde[i].copy(e.ultima[i]));copiarAgarre(e.desdeAgarre,e.agarre);
      }
      e.tiempo+=Math.max(0,Math.min(.05,a.dt||0));
      let w=e.duracion?suave(e.tiempo/e.duracion):1;
      if(estado==='golpe')w=Math.max(w,tramo(a.k||0,0,.38));
      if(w<1){
        e.huesos.forEach((b,i)=>b.quaternion.slerp(e.desde[i],1-w));
        m.H.cuerpo.position.lerpVectors(e.desdePos,m.H.cuerpo.position,w);
        for(const k of ['G','A','arriba'])for(let i=0;i<3;i++)agarre[k][i]=e.desdeAgarre[k][i]+(agarre[k][i]-e.desdeAgarre[k][i])*w;
        const longitud=Math.hypot(...agarre.A);if(longitud>1e-6)for(let i=0;i<3;i++)agarre.A[i]/=longitud;
      }
      e.huesos.forEach((b,i)=>e.ultima[i].copy(b.quaternion));e.pos.copy(m.H.cuerpo.position);copiarAgarre(e.agarre,agarre);
      e.estado=estado;e.anim=a.anim;e.libre=libre;e.valido=!exacta;
    }
    function resolver(m,a){
      const H=m.H,k=a.k||0,t=a.t||0;
      // Adreida agarra el hacha con las dos manos (salvo al gritar, con los brazos abiertos, y al caer).
      // El hachazo cargado toma impulso con cadera y torso, hundiendo las rodillas antes del barrido.
      if(a.potencia>0&&['tajoA','revesA','estocadaA'].includes(a.anim)){
        const p=a.potencia,pre=tramo(k,0,.38)*(1-tramo(k,.4,.62)),gol=tramo(k,.4,.62)*(1-tramo(k,.66,1));
        H.torso.rotation.y*=1+.65*p;H.cadera.rotation.y*=1+.5*p;
        H.torso.rotation.x+=p*(-.2*pre+.24*gol);H.cuerpo.position.y-=p*(.13*pre+.08*gol);
        H.rodillaI.rotation.x+=p*(.3*pre+.15*gol);H.rodillaD.rotation.x+=p*.28*pre;
      }
      const agarre=agarreAdreida(a);mezclar(m,a,agarre);
      {
        const tela=m.tela||(m.tela={t:t,aperturas:Array(7).fill(0)}),dt=Math.max(0,Math.min(.05,t-tela.t));tela.t=t;
        for(let i=0;i<7;i++){
          const ang=(i+.5)/7*TAU+.08,fr=Math.cos(ang),lado=Math.sin(ang);
          const piernas=[H.piernaI,H.piernaD],empuje=Math.max(...piernas.map(b=>Math.max(0,-b.rotation.x*fr+b.rotation.z*lado)));
          const objetivo=Math.min(1.2,.04+empuje*1.12),anterior=tela.aperturas[i];
          // Se abre enseguida ante la pierna; vuelve con retraso y un leve vaivén de tela.
          const apertura=objetivo>anterior?objetivo:objetivo+(anterior-objetivo)*Math.exp(-dt*9);
          tela.aperturas[i]=apertura;const balanceo=Math.sin(t*5+i)*.018*(a.paso||0);
          H['falda'+i].rotation.set(-fr*(apertura+balanceo),0,lado*(apertura+balanceo));
        }
      }
      if(!['grito','muerte'].includes(a.anim))empunar(m,agarre);
    }
    return {posar,resolver,ajustarAgarre,configuracion,configurar,restablecer:()=>{ajustes={...predeterminados};return configuracion();}};
  }
  window.CAOZ_ARPG_ADREIDA_ANIMACION=Object.freeze({fabrica,validar,predeterminados});
})();

/* Entrada del Recaudador: botín, recogida, sombra, caída y esquiva.
   Todo usa tiempo de simulación: pausa, omisión y reinicio conservan su orden. */
'use strict';
(function(){
  const TIEMPOS=Object.freeze({botin:1.05,recoger:1.8,contacto:.46,sombra:0,caida:.85,roll:1.05,impacto:1.92,fin:3.05});
  function fabrica(THREE,MOD,{escena,caminar,impactar,terminar,rotulo,recoger=()=>{}}){
    const V=THREE.Vector3,centro=new V(),desplazamiento=new V(),foco=new V(),eje=new V(0,1,0),puntoMano=new V(),rotacionSuelo=new THREE.Quaternion(),rotacionMano=new THREE.Quaternion(),angulosMano=new THREE.Euler();let estado=null;
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{opacidad:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform float opacidad;void main(){float r=length(vUv-.5)*2.;float a=(1.-smoothstep(.45,1.,r))*opacidad;gl_FragColor=vec4(.008,.009,.018,a);}'});
    const sombra=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);sombra.rotation.x=-Math.PI/2;sombra.visible=false;sombra.renderOrder=2;escena.add(sombra);
    // Llave de hierro dorado: anilla, vástago y dos dientes. Reutilizada en cada partida.
    const llave=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0xe5bb62,metalness:.5,roughness:.48,emissive:0x92631e,emissiveIntensity:.22});
    function pieza(g,x,y,z){const m=new THREE.Mesh(g,metal);m.position.set(x,y,z);llave.add(m);}
    pieza(new THREE.TorusGeometry(.13,.038,6,16),0,0,0);
    pieza(new THREE.BoxGeometry(.075,.42,.075),0,-.33,0);
    pieza(new THREE.BoxGeometry(.19,.07,.075),.06,-.43,0);pieza(new THREE.BoxGeometry(.19,.07,.075),.06,-.54,0);
    llave.visible=false;escena.add(llave);
    const suave=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    function posar(h,anim,k,dt,t){h.m.raiz.position.copy(h.pos);h.m.raiz.rotation.y=h.dir;
      MOD.posar(h.m,{anim,k,t,dt,estado:anim,mezclar:true,desplazamientoExterno:true,fase:h.fase||0,paso:anim==='andar'?.52:0});
      h.m.M.u.uDestello.value=h.m.M.u.uBorde.value=0;
    }
    function iniciar(jugadores,troll,sitio={}){if(estado)return false;
      const actor=jugadores.find(h=>h.vivo&&h.tipo==='adreida')||jugadores.find(h=>h.vivo);if(!actor)return false;
      centro.copy(sitio.centro||new V());const dir=sitio.dir||0,origen=(sitio.origen||new V(-2.5,0,-1.5)).clone().setY(.9);
      const destino=new V(.32,.085,.58).applyAxisAngle(eje,dir).add(centro);
      const otros=jugadores.filter(h=>h!==actor&&h.vivo).map((h,i)=>({h,destino:sitio.acompanantes?.[i]?.clone()||new V(3+i*1.5,0,4.5).applyAxisAngle(eje,dir).add(centro)}));
      estado={actor,otros,troll,dir,origen,destino,fase:'botin',t:0,total:0,recogida:false,impacto:false,sombras:troll.m.mallas.map(m=>m.castShadow)};
      for(const m of troll.m.mallas)m.castShadow=false;troll.m.raiz.visible=false;troll.pos.copy(centro);troll.m.raiz.position.copy(centro).setY(18);
      sombra.position.copy(centro).setY(.055);sombra.visible=false;material.uniforms.opacidad.value=0;
      llave.visible=true;llave.position.copy(origen);llave.rotation.set(0,0,0);rotacionSuelo.setFromEuler(angulosMano.set(-Math.PI/2,0,dir));rotulo('botin','El último enemigo deja caer una llave');return true;
    }
    function recogerLlave(){if(estado.recogida)return;estado.recogida=true;recoger(estado.actor);}
    function llaveEnMano(peso=1){const h=estado.actor;h.m.raiz.updateMatrixWorld(true);h.m.H.manoI.localToWorld(puntoMano.set(0,-.08,0));llave.position.lerpVectors(estado.destino,puntoMano,peso);rotacionMano.setFromEuler(angulosMano.set(-.7,.22+Math.sin(estado.total*2)*.12,-.35));llave.quaternion.copy(rotacionSuelo).slerp(rotacionMano,peso);}
    function posarTroll(dt){const e=estado.troll,t=estado.t,cae=t>=TIEMPOS.caida,u=Math.max(0,Math.min(1,(t-TIEMPOS.caida)/(TIEMPOS.impacto-TIEMPOS.caida)));
      e.m.raiz.visible=cae;e.m.raiz.position.copy(centro).setY(18*(1-u*u));e.dir=estado.dir;e.m.raiz.rotation.y=e.dir;
      MOD.posar(e.m,{anim:t<TIEMPOS.impacto?'cargaMazazo':'mazazo',k:t<TIEMPOS.impacto?1:Math.min(1,(t-TIEMPOS.impacto)/.75),t,dt,estado:'entrada'});
    }
    function resolverImpacto(){if(estado.impacto)return;estado.impacto=true;estado.troll.m.mallas.forEach((m,i)=>m.castShadow=estado.sombras[i]);impactar(centro);rotulo('impacto','El Recaudador');}
    function paso(dt){if(!estado)return false;if(dt<=0)return true;const s=estado;s.total+=dt;
      if(s.fase==='botin'){
        s.t+=dt;const k=Math.min(1,s.t/.75);llave.position.lerpVectors(s.origen,s.destino,k);llave.position.y+=Math.sin(Math.PI*k)*1.15;
        llave.rotation.set(-Math.PI/2*k,0,k*Math.PI*4+s.dir);posar(s.actor,'quieto',0,dt,s.total);
        if(s.t>=TIEMPOS.botin){s.fase='caminar';s.t=0;rotulo('caminar','Una llave…');}return true;
      }
      if(s.fase==='caminar'){
        const listo=caminar(s.actor,centro,dt);posar(s.actor,listo?'quieto':'andar',0,dt,s.total);
        let todos=listo;for(const o of s.otros){const llego=caminar(o.h,o.destino,dt);posar(o.h,llego?'quieto':'andar',0,dt,s.total);todos=todos&&llego;}
        if(todos){s.fase='recoger';s.t=0;rotulo('recoger','¿Qué abrirá?');}return true;
      }
      if(s.fase==='recoger'){
        s.t+=dt;const k=Math.min(1,s.t/TIEMPOS.recoger);s.actor.dir+=Math.atan2(Math.sin(s.dir-s.actor.dir),Math.cos(s.dir-s.actor.dir))*Math.min(1,dt*12);
        posar(s.actor,'recogerLlave',k,dt,s.total);if(k>=TIEMPOS.contacto){recogerLlave();llaveEnMano(suave((k-TIEMPOS.contacto)/.1));}
        for(const o of s.otros)posar(o.h,'quieto',0,dt,s.total);
        if(k>=1){s.fase='sombra';s.t=0;sombra.visible=true;rotulo('sombra','Algo cae desde el cielo…');}return true;
      }
      s.t+=dt;const t=s.t;
      sombra.scale.setScalar(1.8+1.3*suave(t/TIEMPOS.impacto));material.uniforms.opacidad.value=(.2+.65*suave(t/TIEMPOS.impacto))*(1-suave((t-TIEMPOS.impacto)/.55));
      if(t<TIEMPOS.roll){posar(s.actor,'mirarLlave',1,dt,s.total);llaveEnMano();}
      else{llave.visible=false;const k=Math.min(1,(t-TIEMPOS.roll)/MOD.animacion.roll.duracion);MOD.animacion.desplazamientoRoll(k,desplazamiento).applyAxisAngle(eje,s.dir);s.actor.pos.copy(centro).add(desplazamiento);s.actor.dir=s.dir+(k<1?0:Math.PI*suave((t-TIEMPOS.roll-MOD.animacion.roll.duracion)/.65));
        if(s.fase==='sombra'){s.fase='esquiva';rotulo('esquiva','¡Ahora!');}
        posar(s.actor,k<1?(s.actor.tipo==='adreida'?'rodar':'acrobacia'):'quieto',k,dt,s.total);
      }
      for(const o of s.otros)posar(o.h,'quieto',0,dt,s.total);
      posarTroll(dt);if(t>=TIEMPOS.impacto)resolverImpacto();if(t>=TIEMPOS.fin)finalizar();return true;
    }
    function finalizar(){if(!estado)return false;const s=estado;recogerLlave();
      MOD.animacion.desplazamientoRoll(1,desplazamiento).applyAxisAngle(eje,s.dir);s.actor.pos.copy(centro).add(desplazamiento);s.actor.dir=s.dir+Math.PI;
      for(const o of s.otros)o.h.pos.copy(o.destino);
      s.t=TIEMPOS.fin;posarTroll(0);resolverImpacto();sombra.visible=llave.visible=false;
      for(const h of [s.actor,...s.otros.map(o=>o.h)])posar(h,'quieto',0,.05,s.total);
      estado=null;terminar(s.troll);return true;
    }
    function cancelar(){if(estado)estado.troll.m.mallas.forEach((m,i)=>m.castShadow=estado.sombras[i]);sombra.visible=llave.visible=false;estado=null;}
    function encuadre(){if(!estado)return null;const s=estado;foco.copy(s.actor.pos).add(centro).multiplyScalar(.5);return {foco,distancia:Math.max(18,14+s.actor.pos.distanceTo(centro)*1.4)};}
    return {iniciar,paso,finalizar,cancelar,encuadre,get activa(){return !!estado;},estado:()=>estado?{fase:estado.fase,t:estado.t,impacto:estado.impacto,recogida:estado.recogida,actor:estado.actor.tipo,alturaTroll:estado.troll.m.raiz.position.y,centro:centro.toArray(),llave:llave.position.toArray()}:null};
  }
  window.CAOZ_ARPG_ENTRADA_TROLL=Object.freeze({fabrica,TIEMPOS});
})();

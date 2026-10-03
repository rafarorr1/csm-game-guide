/* Entrada del Recaudador: caminar, sombra, caída y esquiva. Tiempo de simulación,
   sin temporizadores del navegador; la pausa y la pestaña inactiva congelan la escena. */
'use strict';
(function(){
  const TIEMPOS=Object.freeze({sombra:0,caida:.85,roll:1.05,impacto:1.92,fin:3.05});
  function fabrica(THREE,MOD,{escena,caminar,impactar,terminar,rotulo}){
    const V=THREE.Vector3,centro=new V(),desplazamiento=new V(),foco=new V();let estado=null;
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{opacidad:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform float opacidad;void main(){float r=length(vUv-.5)*2.;float a=(1.-smoothstep(.45,1.,r))*opacidad;gl_FragColor=vec4(.008,.009,.018,a);}'});
    const sombra=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);sombra.rotation.x=-Math.PI/2;sombra.position.y=.055;sombra.visible=false;sombra.renderOrder=2;escena.add(sombra);
    const suave=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    function posar(h,anim,k,dt,t){h.m.raiz.position.copy(h.pos);h.m.raiz.rotation.y=h.dir;
      MOD.posar(h.m,{anim,k,t,dt,estado:anim,mezclar:true,desplazamientoExterno:true,fase:h.fase||0,paso:anim==='andar'?.52:0});
      h.m.M.u.uDestello.value=h.m.M.u.uBorde.value=0;
    }
    function iniciar(jugadores,troll){if(estado)return false;
      const actor=jugadores.find(h=>h.vivo&&h.tipo==='adreida')||jugadores.find(h=>h.vivo);if(!actor)return false;
      const otros=jugadores.filter(h=>h!==actor&&h.vivo).map((h,i)=>({h,destino:new V(3+i*1.5,0,4.5)}));
      estado={actor,otros,troll,fase:'caminar',t:0,total:0,impacto:false,sombras:troll.m.mallas.map(m=>m.castShadow)};for(const m of troll.m.mallas)m.castShadow=false;troll.m.raiz.visible=false;troll.pos.copy(centro);troll.m.raiz.position.set(0,18,0);
      sombra.visible=false;material.uniforms.opacidad.value=0;rotulo('caminar','Una sombra sobre Tomsage');return true;
    }
    function posarTroll(dt){const e=estado.troll,t=estado.t,cae=t>=TIEMPOS.caida,u=Math.max(0,Math.min(1,(t-TIEMPOS.caida)/(TIEMPOS.impacto-TIEMPOS.caida)));
      e.m.raiz.visible=cae;e.m.raiz.position.set(0,18*(1-u*u),0);e.dir=0;e.m.raiz.rotation.y=0;
      MOD.posar(e.m,{anim:t<TIEMPOS.impacto?'cargaMazazo':'mazazo',k:t<TIEMPOS.impacto?1:Math.min(1,(t-TIEMPOS.impacto)/.75),t,dt,estado:'entrada'});
    }
    function resolverImpacto(){if(estado.impacto)return;estado.impacto=true;estado.troll.m.mallas.forEach((m,i)=>m.castShadow=estado.sombras[i]);impactar(centro);rotulo('impacto','El Recaudador');}
    function paso(dt){if(!estado)return false;if(dt<=0)return true;const s=estado;s.total+=dt;
      if(s.fase==='caminar'){
        const listo=caminar(s.actor,centro,dt);posar(s.actor,listo?'quieto':'andar',0,dt,s.total);
        let todos=listo;for(const o of s.otros){const llego=caminar(o.h,o.destino,dt);posar(o.h,llego?'quieto':'andar',0,dt,s.total);todos= todos&&llego;}
        if(todos){s.fase='sombra';s.t=0;sombra.visible=true;rotulo('sombra','Algo cae desde el cielo…');}return true;
      }
      s.t+=dt;const t=s.t;
      sombra.scale.setScalar(1.8+1.3*suave(t/TIEMPOS.impacto));material.uniforms.opacidad.value=(.2+.65*suave(t/TIEMPOS.impacto))*(1-suave((t-TIEMPOS.impacto)/.55));
      if(t<TIEMPOS.roll){s.actor.dir+=Math.atan2(Math.sin(-s.actor.dir),Math.cos(-s.actor.dir))*Math.min(1,dt*9);posar(s.actor,'quieto',0,dt,s.total);}
      else{const k=Math.min(1,(t-TIEMPOS.roll)/MOD.animacion.roll.duracion);MOD.animacion.desplazamientoRoll(k,desplazamiento);s.actor.pos.copy(centro).add(desplazamiento);if(k<1)s.actor.dir=0;else s.actor.dir=Math.PI*suave((t-TIEMPOS.roll-MOD.animacion.roll.duracion)/.65);
        if(s.fase==='sombra'){s.fase='esquiva';rotulo('esquiva','¡Ahora!');}
        const rodando=k<1;posar(s.actor,rodando?(s.actor.tipo==='adreida'?'rodar':'acrobacia'):'quieto',k,dt,s.total);
      }
      for(const o of s.otros)posar(o.h,'quieto',0,dt,s.total);
      posarTroll(dt);if(t>=TIEMPOS.impacto)resolverImpacto();if(t>=TIEMPOS.fin)finalizar();return true;
    }
    function finalizar(){if(!estado)return false;const s=estado;
      MOD.animacion.desplazamientoRoll(1,desplazamiento);s.actor.pos.copy(centro).add(desplazamiento);s.actor.dir=Math.PI;
      for(const o of s.otros)o.h.pos.copy(o.destino);
      s.t=TIEMPOS.fin;posarTroll(0);resolverImpacto();sombra.visible=false;
      for(const h of [s.actor,...s.otros.map(o=>o.h)])posar(h,'quieto',0,.05,s.total);
      estado=null;terminar(s.troll);return true;
    }
    function cancelar(){if(estado)estado.troll.m.mallas.forEach((m,i)=>m.castShadow=estado.sombras[i]);sombra.visible=false;estado=null;}
    function encuadre(){if(!estado)return null;const s=estado;foco.copy(s.actor.pos).add(centro).multiplyScalar(.5);return {foco,distancia:20};}
    return {iniciar,paso,finalizar,cancelar,encuadre,get activa(){return !!estado;},estado:()=>estado?{fase:estado.fase,t:estado.t,impacto:estado.impacto,actor:estado.actor.tipo,alturaTroll:estado.troll.m.raiz.position.y}:null};
  }
  window.CAOZ_ARPG_ENTRADA_TROLL=Object.freeze({fabrica,TIEMPOS});
})();

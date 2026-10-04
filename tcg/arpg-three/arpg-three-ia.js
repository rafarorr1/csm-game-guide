/* Decisiones de goblins con Yuka. El combate y la navegación siguen siendo del juego. */
'use strict';
(function(){
  const {Think,Goal,GoalEvaluator}=window.CAOZ_YUKA;
  let modo='yuka';
  const distancia=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  class Intencion extends Goal {
    constructor(owner,nombre){super(owner);this.nombre=nombre;}
    activate(){const c=this.owner;c.accion=this.nombre;c.version++;
      const e=c.enemigo,H=c.heroe,lado=e.rodeo>=0?1:-1;
      c.angulo=Math.atan2(e.pos.x-H.pos.x,e.pos.z-H.pos.z)+lado*(this.nombre==='flanquear'?(c.variante==='cuchillo'?1:.65):.4);
      if(this.nombre==='flanquear'){c.flancoHasta=c.t+.85;c.flancoDesde=c.t+3.2;}
    }
    execute(){}
  }
  class Evaluador extends GoalEvaluator {
    constructor(nombre,puntuar){super();this.nombre=nombre;this.puntuar=puntuar;}
    calculateDesirability(c){return this.puntuar(c);}
    setGoal(c){if(c.accion===this.nombre)return;c.cerebro.clearSubgoals();c.cerebro.addSubgoal(new Intencion(c,this.nombre));}
  }
  // Evaluadores sin estado: se comparten entre todos los goblins.
  const evaluadores=[
    new Evaluador('cubrir',c=>c.entra?-1:2),
    new Evaluador('presionar',c=>!c.entra?-1:c.enemigo.provocado>0?2:c.dist<2.5?1.2:.6+(c.variante==='dosHachas'?.15:0)),
    new Evaluador('flanquear',c=>{
      if(!c.entra||c.enemigo.provocado>0||c.dist<2.5||c.dist>7)return -1;
      if(c.accion==='flanquear'&&c.t<c.flancoHasta)return 1.1;
      if(c.t<c.flancoDesde)return -1;
      // Rodear un bloqueo también puede abrir un tiro; no se lee la entrada del jugador.
      if(!c.libre&&c.puedeLanzar)return .86;
      const frontal=((c.enemigo.pos.x-c.heroe.pos.x)*Math.sin(c.heroe.dir)+(c.enemigo.pos.z-c.heroe.pos.z)*Math.cos(c.heroe.dir))/c.dist;
      if(frontal<-.2)return -1;
      return c.variante==='cuchillo'?.98:c.variante==='antorcha'?.8:c.variante==='clasico'?.7:.4;
    }),
    new Evaluador('lanzar',c=>c.entra&&c.puedeLanzar&&c.libre&&c.dist>=3&&c.dist<=8&&c.enemigo.cd<=0&&c.enemigo.provocado<=0&&c.t>=(c.enemigo.hachaDesde||0)?(c.variante==='clasico'?1:.82):-1)
  ];
  class CerebroGoblin {
    constructor(enemigo){
      this.enemigo=enemigo;this.variante=enemigo.m.varianteGoblin||'clasico';
      this.puedeLanzar=['clasico','dosHachas'].includes(this.variante);
      this.cerebro=new Think(this);for(const e of evaluadores)this.cerebro.addEvaluator(e);
      this.accion=null;this.version=0;this.decisiones=0;this.proxima=0;this.flancoDesde=0;this.flancoHasta=0;
    }
    decidir(heroe,entra,t,lineaLibre){
      const provocado=this.enemigo.provocado>0;
      if(t<this.proxima&&this.heroe===heroe&&this.entra===entra&&this.provocado===provocado)return this;
      // Cambiar de jugador invalida el ángulo anterior; no cambia quién es el objetivo del combate.
      if(this.heroe&&this.heroe!==heroe){this.accion=null;this.flancoDesde=0;}
      this.heroe=heroe;this.entra=entra;this.t=t;this.provocado=provocado;this.dist=distancia(this.enemigo.pos,heroe.pos);
      this.libre=this.puedeLanzar?lineaLibre():false;
      if(this.cerebro.inactive())this.cerebro.activateIfInactive();else this.cerebro.arbitrate();
      this.cerebro.execute();this.decisiones++;this.proxima=t+.27+(this.enemigo.id%4)*.025;return this;
    }
  }
  window.CAOZ_ARPG_IA=Object.freeze({
    modo:()=>modo,
    configurar(valor){if(!['yuka','clasica'].includes(valor))throw Error('Modo de IA desconocido');modo=valor;},
    crear(e){return modo==='yuka'&&['goblin','cobrador'].includes(e.tipo)?new CerebroGoblin(e):null;}
  });
})();

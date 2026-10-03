/* Epílogo del Recaudador. Una casa, dos habitantes y una elección sin recompensas.
   El interior sólo se construye al entrar; reutiliza los modelos y materiales del juego. */
'use strict';
(function(){
  function fabrica(THREE,MOD,{plaza,casa,materiales,caminar,consumirLlave,limpiar,volver,interfaz}){
    const V=THREE.Vector3,suave=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    let fase='cerrada',t=0,total=0,actor=null,interior=null,protagonista=null,habitantes=[],golpeDado=false,botones=[],soltado=false,peticion=false;let decorado=null;
    const datos=casa.userData.puerta,marco=new THREE.Group(),hoja=new THREE.Group(),normal=new V(0,0,1).applyQuaternion(casa.quaternion);
    casa.updateMatrixWorld(true);marco.position.copy(casa.localToWorld(new V(datos.x,0,datos.z)));marco.quaternion.copy(casa.quaternion);plaza.add(marco);
    const aproximacion=marco.position.clone().addScaledVector(normal,2.25),umbral=marco.position.clone().addScaledVector(normal,.45);
    const propia=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...o});
    const roble=materiales.tablas.clone();roble.vertexColors=false;const metal=propia(0x66533c,{metalness:.35});
    function caja(g,w,h,d,p,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(...p);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
    caja(marco,.98,1.98,.025,[0,1,-.045],new THREE.MeshBasicMaterial({color:0x070808}));
    hoja.position.x=-.5;marco.add(hoja);caja(hoja,1,2,.08,[.5,1,0],roble);
    for(const y of [.35,1.55])caja(hoja,.91,.085,.025,[.5,y,.058],metal);
    caja(hoja,.1,.2,.05,[.82,.95,.08],metal);
    const marca=new THREE.Mesh(new THREE.TorusGeometry(.105,.025,5,12),propia(0xd2ab61));marca.position.set(.31,1.24,.065);hoja.add(marca);
    const entrada=new THREE.Mesh(new THREE.PlaneGeometry(1.25,2.3),new THREE.MeshBasicMaterial({visible:false}));entrada.position.set(0,1,.14);marco.add(entrada);
    const halo=new THREE.Mesh(new THREE.RingGeometry(.45,.53,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xc5a166,transparent:true,opacity:.55,depthWrite:false}));halo.position.copy(aproximacion).setY(.035);halo.visible=false;plaza.add(halo);
    const camara=new THREE.PerspectiveCamera(36,1,.1,60);camara.position.set(6.8,8.5,11.5);camara.lookAt(0,.6,-.2);
    function cambiar(f){fase=f;t=0;interfaz(estado());}
    function habilitar(){if(fase!=='cerrada')return false;halo.visible=true;cambiar('plaza');return true;}
    function cerca(jugadores){return jugadores.find(h=>h.vivo&&h.pos.distanceTo(aproximacion)<2.7)||null;}
    function solicitar(h){if(fase!=='plaza'||!h?.vivo)return false;actor=h;peticion=true;cambiar('acercarse');return true;}
    function abrir(){if(!consumirLlave()){peticion=false;cambiar('plaza');return false;}limpiar();halo.visible=false;construirInterior();cambiar('abrir');return true;}
    function posarHeroe(anim,k,dt){const m=protagonista;MOD.posar(m,{anim,k,t:total,dt,mezclar:true,desplazamientoExterno:true,fase:total*6,paso:.5,combo:1});}
    function construirInterior(){
      if(interior)return;
      interior=new THREE.Scene();interior.background=new THREE.Color(0x04070b);interior.environment=plaza.environment;interior.environmentIntensity=.025;
      interior.add(new THREE.HemisphereLight(0x879fbd,0x31261e,.22));
      const relleno=new THREE.DirectionalLight(0xe5c49b,.32);relleno.position.set(-3,6,4);interior.add(relleno);
      // Un único foco con sombra destaca las caras y separa a la familia de la pared.
      const foco=new THREE.SpotLight(0xffdfb4,54,9,.34,.72,2);foco.name='Foco de la familia';foco.position.set(.15,3.8,-1.5);foco.target.position.set(-.15,.65,-2.88);
      foco.castShadow=true;foco.shadow.mapSize.set(1024,1024);foco.shadow.camera.near=.1;foco.shadow.camera.far=10;foco.shadow.bias=-.0004;foco.shadow.normalBias=.025;interior.add(foco,foco.target);
      decorado=window.CAOZ_ARPG_CASA_INTERIOR.crear(THREE,{reducido:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion:reduce)').matches});interior.add(decorado.raiz);
      protagonista=MOD.crear('adreida');protagonista.raiz.position.copy(decorado.entrada);protagonista.raiz.rotation.y=Math.PI;interior.add(protagonista.raiz);
      // Un contraluz frío y tenue perfila sólo a Adreida; no ilumina el piso ni añade sombras.
      protagonista.M.u.uColorB.value.set(0x9faab8);protagonista.M.u.uBorde.value=.028;
      habitantes=[{nombre:'Madre goblin',x:-.58,z:-2.9,escala:1.08},{nombre:'Hijo goblin',x:.23,z:-2.92,escala:.64}].map((d,i)=>{
        const m=MOD.crear('goblin');m.raiz.name=d.nombre;for(const a of m.mallas.slice(1))a.visible=false;
        m.raiz.scale.setScalar(d.escala);m.raiz.position.set(d.x,0,d.z);m.raiz.rotation.y=i?-.12:.15;interior.add(m.raiz);
        if(!i){const falda=new THREE.Mesh(new THREE.CylinderGeometry(.145,.22,.24,12,1,true),propia(0x605352));falda.position.set(0,-.09,0);m.H.cadera.add(falda);}
        return {...d,m,vivo:true,muerte:null,caida:0};
      });
    }
    function posarHabitantes(dt){for(const [i,n] of habitantes.entries()){
      if(!n.vivo){n.caida+=dt;MOD.posar(n.m,{anim:'muerte',k:Math.min(1,n.caida/n.muerte.duracion),t:total,dt,muerte:n.muerte});continue;}
      MOD.posar(n.m,{anim:'quieto',t:total,dt});const H=n.m.H,temblor=Math.sin(total*17+i*2)*.017;
      H.torso.rotation.x=.15;H.torso.rotation.z=(i?-.1:.03)+temblor;H.cabeza.rotation.x=.28;H.cabeza.rotation.y=i?-.28:.13;
      H.brazoI.rotation.set(-1.55,0,.24);H.brazoD.rotation.set(-1.45,0,-.2);H.anteI.rotation.x=-1.25;H.anteD.rotation.x=-1.35;
      H.manoI.rotation.z=.2;H.manoD.rotation.z=-.2;
    }}
    function golpear(){if(fase!=='decision'||golpeDado)return false;cambiar('golpe');return true;}
    function salir(){if(!['decision','despues'].includes(fase))return false;cambiar('salir');return true;}
    function mando(g){const ahora=g?.buttons?.map(b=>b.pressed||b.value>.5)||[];
      if(!soltado){soltado=!ahora.some(Boolean);botones=ahora;return;}
      const nuevo=i=>ahora[i]&&!botones[i];
      if(nuevo(0))salir();else if(nuevo(2)||nuevo(7))golpear();botones=ahora;
    }
    function paso(dt){if(dt<=0||fase==='cerrada'||fase==='plaza')return;total+=dt;t+=dt;
      if(fase==='acercarse'){
        const listo=caminar(actor,aproximacion,dt);actor.m.raiz.position.copy(actor.pos);actor.m.raiz.rotation.y=actor.dir;MOD.posar(actor.m,{anim:listo?'quieto':'andar',t:total,dt,fase:actor.fase,paso:.5,mezclar:true});if(listo)abrir();
      }else if(fase==='abrir'){
        hoja.rotation.y=-1.5*suave(t/.8);actor.dir=Math.atan2(-normal.x,-normal.z);actor.pos.lerp(umbral,Math.min(1,dt*2.3));actor.m.raiz.position.copy(actor.pos);actor.m.raiz.rotation.y=actor.dir;MOD.posar(actor.m,{anim:'andar',t:total,dt,fase:total*6,paso:.5,mezclar:true});
        if(t>=1.1&&decorado.listo){soltado=false;botones=[];cambiar('entrar');}
      }else if(fase==='entrar'){
        const k=suave(t/1.9);protagonista.raiz.position.set(decorado.entrada.x*(1-k),0,3.25-3.9*k);posarHeroe('andar',0,dt);if(t>=1.9)cambiar('decision');
      }else if(fase==='decision'||fase==='despues')posarHeroe('quieto',0,dt);
      else if(fase==='golpe'){
        const k=Math.min(1,t/.85);protagonista.raiz.position.z=-.65-.75*suave(k/.5);posarHeroe('tajoA',k,dt);
        if(k>=.48&&!golpeDado){golpeDado=true;for(const [i,n] of habitantes.entries()){n.vivo=false;n.muerte=MOD.crearMuerteGoblin('tajo',i?2:0);n.muerte.desplazamientoExterno=true;n.caida=0;}interfaz(estado());}
        if(k>=1)cambiar('despues');
      }else if(fase==='salir'){
        protagonista.raiz.rotation.y=0;protagonista.raiz.position.z=Math.min(3.8,protagonista.raiz.position.z+dt*2.4);protagonista.raiz.position.x=decorado.entrada.x*suave((protagonista.raiz.position.z+.65)/3.9);posarHeroe('andar',0,dt);
        if(protagonista.raiz.position.z>=3.75){cambiar('fin');volver();}
      }
      if(enInterior()){posarHabitantes(dt);decorado.paso(dt);}
    }
    function enInterior(){return ['entrar','decision','golpe','despues','salir','fin'].includes(fase);}
    function cancelar(){fase='cerrada';t=total=0;actor=null;peticion=false;golpeDado=false;halo.visible=false;hoja.rotation.y=0;soltado=false;botones=[];
      decorado?.reiniciar();if(protagonista)protagonista.raiz.position.copy(decorado.entrada);if(protagonista)protagonista.raiz.rotation.y=Math.PI;for(const n of habitantes){n.vivo=true;n.muerte=null;n.caida=0;}interfaz(estado());}
    function estado(){return {fase,interior:enInterior(),golpeDado,vivos:habitantes.filter(n=>n.vivo).length,puerta:aproximacion.toArray(),accion:peticion,decorado:decorado?.estadisticas||null,ambiente:decorado?.estado()||null};}
    return {habilitar,solicitar,cerca,paso,golpear,salir,mando,cancelar,estado,contiene:ray=>ray.intersectObject(entrada,false).length>0,
      get activa(){return fase!=='cerrada';},get bloquea(){return !['cerrada','plaza'].includes(fase);},get interior(){return enInterior();},
      get escena(){return interior;},camara(aspecto){camara.aspect=aspecto;camara.fov=aspecto<1?48:36;camara.updateProjectionMatrix();return camara;}};
  }
  window.CAOZ_ARPG_CASA_GOBLIN=Object.freeze({fabrica});
})();

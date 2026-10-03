/* Epílogo del Recaudador. Una casa, dos habitantes y una elección sin recompensas.
   El interior sólo se construye al entrar; reutiliza los modelos y materiales del juego. */
'use strict';
(function(){
  function fabrica(THREE,MOD,{plaza,casa,materiales,caminar,consumirLlave,limpiar,volver,interfaz}){
    const V=THREE.Vector3,suave=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    let fase='cerrada',t=0,total=0,actor=null,interior=null,protagonista=null,habitantes=[],golpeDado=false,botones=[],soltado=false,peticion=false;
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
    function abrir(){if(!consumirLlave()){peticion=false;cambiar('plaza');return false;}limpiar();halo.visible=false;cambiar('abrir');return true;}
    function posarHeroe(anim,k,dt){const m=protagonista;MOD.posar(m,{anim,k,t:total,dt,mezclar:true,desplazamientoExterno:true,fase:total*6,paso:.5,combo:1});}
    function construirInterior(){
      if(interior)return;
      interior=new THREE.Scene();interior.background=new THREE.Color(0x090d12);interior.environment=plaza.environment;interior.environmentIntensity=.22;
      interior.add(new THREE.HemisphereLight(0xaac1da,0x514033,1.1));const luz=new THREE.DirectionalLight(0xffd7a0,3.1);luz.position.set(-3,6,4);interior.add(luz);
      const frio=new THREE.DirectionalLight(0x94b7ef,1.3);frio.position.set(3,5,-4);interior.add(frio);
      const madera=materiales.madera.clone(),piedra=materiales.piedra.clone(),yeso=materiales.yeso.clone();for(const m of [madera,piedra,yeso])m.vertexColors=false;
      piedra.color.setHex(0xa9a49b);yeso.color.setHex(0x948671);madera.color.setHex(0x665142);
      caja(interior,8.5,.24,7.6,[0,-.12,0],piedra);
      for(let i=0;i<17;i++)caja(interior,.485,.045,7.15,[-4+i*.5,.012,0],madera);
      caja(interior,8.5,3.25,.28,[0,1.625,-3.7],yeso);caja(interior,.28,3.25,7.6,[-4.25,1.625,0],yeso);
      // Frente y lateral próximos a la cámara se cortan para leer la habitación.
      caja(interior,.25,.42,7.6,[4.25,.21,0],piedra);
      for(const x of [-2.55,2.55])caja(interior,3.25,.42,.25,[x,.21,3.7],piedra);
      for(const x of [-4,0,4])caja(interior,.18,3.3,.22,[x,1.65,-3.52],madera);
      for(const y of [.2,2.75,3.2])caja(interior,8.3,.18,.24,[0,y,-3.5],madera);
      for(const z of [-3.4,0,3.4])caja(interior,.23,3.3,.18,[-4.06,1.65,z],madera);
      // Ventana cerrada, mesa con dos cuencos, cama y un pequeño juguete de madera.
      caja(interior,1.5,1.25,.08,[2.65,1.9,-3.48],new THREE.MeshBasicMaterial({color:0x293b53}));
      for(const x of [1.85,2.65,3.45])caja(interior,.08,1.4,.13,[x,1.9,-3.4],madera);
      for(const y of [1.2,1.9,2.6])caja(interior,1.7,.07,.13,[2.65,y,-3.4],madera);
      caja(interior,1.55,.12,1,[-2.95,.82,-.5],madera);for(const x of [-3.53,-2.38])for(const z of [-.85,-.15])caja(interior,.11,.8,.11,[x,.4,z],madera);
      const barro=propia(0x9b6346);for(const x of [-3.3,-2.65]){const b=new THREE.Mesh(new THREE.SphereGeometry(.19,12,8,0,Math.PI*2,Math.PI/2,Math.PI/2),barro);b.position.set(x,1.02,-.5);interior.add(b);}
      caja(interior,1.5,.3,2.25,[2.9,.17,.75],madera);caja(interior,1.42,.14,2.14,[2.9,.4,.75],propia(0x77705b));caja(interior,1.38,.06,1.5,[2.9,.5,1],propia(0x5e6b68));
      caja(interior,.26,.13,.46,[1.7,.13,-1.9],propia(0x987345));for(const x of [1.55,1.85])for(const z of [-2,-1.75])caja(interior,.05,.12,.05,[x,.06,z],madera);
      const puerta=new THREE.Group();puerta.position.set(0,0,3.68);interior.add(puerta);
      for(const x of [-.95,.95])caja(puerta,.16,2.6,.3,[x,1.3,0],madera);caja(puerta,2.05,.16,.3,[0,2.63,0],madera);
      const hojaInterior=caja(puerta,.95,2.45,.08,[-.72,1.23,-.48],roble);hojaInterior.rotation.y=1.1;
      const alfombra=caja(interior,2.4,.018,1,[0,.05,2.9],propia(0x554934));alfombra.receiveShadow=false;
      protagonista=MOD.crear('adreida');protagonista.raiz.position.set(0,0,3.25);protagonista.raiz.rotation.y=Math.PI;interior.add(protagonista.raiz);
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
        if(t>=1.1){construirInterior();soltado=false;botones=[];cambiar('entrar');}
      }else if(fase==='entrar'){
        const k=suave(t/1.9);protagonista.raiz.position.z=3.25-3.9*k;posarHeroe('andar',0,dt);if(t>=1.9)cambiar('decision');
      }else if(fase==='decision'||fase==='despues')posarHeroe('quieto',0,dt);
      else if(fase==='golpe'){
        const k=Math.min(1,t/.85);protagonista.raiz.position.z=-.65-.75*suave(k/.5);posarHeroe('tajoA',k,dt);
        if(k>=.48&&!golpeDado){golpeDado=true;for(const [i,n] of habitantes.entries()){n.vivo=false;n.muerte=MOD.crearMuerteGoblin('tajo',i?2:0);n.muerte.desplazamientoExterno=true;n.caida=0;}interfaz(estado());}
        if(k>=1)cambiar('despues');
      }else if(fase==='salir'){
        protagonista.raiz.rotation.y=0;protagonista.raiz.position.z=Math.min(3.8,protagonista.raiz.position.z+dt*2.4);posarHeroe('andar',0,dt);
        if(protagonista.raiz.position.z>=3.75){cambiar('fin');volver();}
      }
      if(enInterior())posarHabitantes(dt);
    }
    function enInterior(){return ['entrar','decision','golpe','despues','salir','fin'].includes(fase);}
    function cancelar(){fase='cerrada';t=total=0;actor=null;peticion=false;golpeDado=false;halo.visible=false;hoja.rotation.y=0;soltado=false;botones=[];
      if(protagonista)protagonista.raiz.position.set(0,0,3.25);if(protagonista)protagonista.raiz.rotation.y=Math.PI;for(const n of habitantes){n.vivo=true;n.muerte=null;n.caida=0;}interfaz(estado());}
    function estado(){return {fase,interior:enInterior(),golpeDado,vivos:habitantes.filter(n=>n.vivo).length,puerta:aproximacion.toArray(),accion:peticion};}
    return {habilitar,solicitar,cerca,paso,golpear,salir,mando,cancelar,estado,contiene:ray=>ray.intersectObject(entrada,false).length>0,
      get activa(){return fase!=='cerrada';},get bloquea(){return !['cerrada','plaza'].includes(fase);},get interior(){return enInterior();},
      get escena(){return interior;},camara(aspecto){camara.aspect=aspecto;camara.fov=aspecto<1?48:36;camara.updateProjectionMatrix();return camara;}};
  }
  window.CAOZ_ARPG_CASA_GOBLIN=Object.freeze({fabrica});
})();

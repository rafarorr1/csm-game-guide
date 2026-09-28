/*
  Revisión aislada: campaña Three.js.

  La escena no sabe iniciar partidas ni escribir avance. El mapa y los controles
  son HTML; Three sólo presenta la mesa narrativa y la miniatura procedimental
  que ya usa la campaña. No hay raycast ni listeners sobre el canvas.
*/
'use strict';
(function(){
  const datos=window.CAOZ_CAMPANA_THREE;
  const THREE=window.CAOZ_THREE?.THREE;
  const host=document.getElementById('campanaThreeEscena');
  const estadoTexto=document.getElementById('campanaThreeAviso');
  function desactivarControles(mensaje){
    host?.setAttribute('data-sin-webgl','true');
    host?.querySelectorAll('button,select').forEach(control=>{
      control.disabled=true;control.setAttribute('aria-disabled','true');
    });
    if(estadoTexto)estadoTexto.textContent=mensaje;
  }
  if(!host||!datos||!THREE||typeof window.campanaGeometriaPersonaje!=='function'){
    desactivarControles('Este navegador no pudo abrir la escena Three.js; la muestra no altera ningún dato.');
    return;
  }

  const $=id=>document.getElementById(id);
  const limitar=(n,min,max)=>Math.max(min,Math.min(max,n));
  const mezcla=(a,b,t)=>a+(b-a)*t;
  const suave=t=>t*t*(3-2*t);
  const reducirSistema=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const paleta={
    mohamed:0x3b7196,fender:0x9a493c,talesin:0xb9b29b,
    rafaela:0x6d8b55,adreida:0x657c98,gero:0x6d426e
  };
  const descripciones={
    mohamed:'El primer guardián de la ruta. Una figura de bastón abre el camino.',
    fender:'Ritmo, presión y una peana que vibra como un acorde.',
    talesin:'Una silueta alada sobre la ruta de ascensión.',
    rafaela:'La vigía del Domo: arco, luz y una decisión precisa.',
    adreida:'La guerrera que protege la mesa antes de atacar.',
    gero:'El DM espera al final, con grimorio abierto y la última palabra.'
  };
  const aspectos={
    guardia:{nombre:'Aventurera del Domo',genero:'femenino',figura:'guardian',estatura:'media',cuerpo:'atletico',rostro:'angular',ojos:'jade',rasgo:'cicatriz',peinado:'yelmo',piel:'arena',cabello:'oscuro',atuendo:'ligero',color:'azul',accesorio:'broche',equipo:'lanza'},
    oraculo:{nombre:'Oráculo del Domo',genero:'no_binario',figura:'mago',estatura:'alta',cuerpo:'esbelto',rostro:'redondo',ojos:'violeta',rasgo:'runas',peinado:'largo',piel:'elfica',cabello:'plata',atuendo:'arcano',color:'violeta',accesorio:'amuleto',equipo:'baston'},
    explorador:{nombre:'Explorador del Domo',genero:'masculino',figura:'explorador',estatura:'alta',cuerpo:'esbelto',rostro:'ovalado',ojos:'avellana',rasgo:'pecas',peinado:'trenzas',piel:'cobre',cabello:'castano',atuendo:'ruta',color:'verde',accesorio:'medallon',equipo:'arco'}
  };

  let renderer,escena,camara,grupoMesa,grupoRuta,grupoHeroe,grupoNiebla;
  let observador=null,animacion=null,raf=0,etapa=0,aspecto='guardia',vista='mesa',sinMovimiento=reducirSistema();
  let objetivoCamara=new THREE.Vector3(0,.12,0),posicionCamara=new THREE.Vector3(0,10.8,14.1);
  const nodos=[],marcadores=[];

  function texturaDibujo(ancho,alto,dibujar,repite=null){
    const lienzo=document.createElement('canvas');lienzo.width=ancho;lienzo.height=alto;
    const ctx=lienzo.getContext('2d');dibujar(ctx,ancho,alto);
    const textura=new THREE.CanvasTexture(lienzo);textura.colorSpace=THREE.SRGBColorSpace;
    if(repite){textura.wrapS=textura.wrapT=THREE.RepeatWrapping;textura.repeat.set(repite[0],repite[1]);}
    return textura;
  }
  function azar(semilla=1){let n=semilla>>>0;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
  function texturaMadera(){
    return texturaDibujo(1024,768,(ctx,w,h)=>{
      const r=azar(834),f=ctx.createLinearGradient(0,0,w,h);f.addColorStop(0,'#120806');f.addColorStop(.22,'#5a2a18');f.addColorStop(.57,'#2a120c');f.addColorStop(1,'#6b321d');ctx.fillStyle=f;ctx.fillRect(0,0,w,h);
      for(let i=0;i<390;i++){const y=r()*h,onda=(r()-.5)*25;ctx.beginPath();ctx.moveTo(-30,y);for(let x=0;x<w+50;x+=28)ctx.lineTo(x,y+Math.sin(x*.018+i*.51)*onda+Math.sin(x*.059+i)*3);ctx.strokeStyle=r()>.5?'rgba(255,179,99,.10)':'rgba(4,1,1,.24)';ctx.lineWidth=.4+r()*2.3;ctx.stroke();}
      for(let i=0;i<18;i++){ctx.fillStyle='rgba(10,2,0,.29)';ctx.beginPath();ctx.ellipse(r()*w,r()*h,5+r()*22,1+r()*4,r()*Math.PI,0,Math.PI*2);ctx.fill();}
    },[1.42,1.16]);
  }
  function texturaMapa(){
    const posiciones=datos.casillas;
    return texturaDibujo(1024,768,(ctx,w,h)=>{
      const r=azar(273),f=ctx.createLinearGradient(0,0,w,h);f.addColorStop(0,'#d2c18d');f.addColorStop(.52,'#9da66f');f.addColorStop(1,'#595a3b');ctx.fillStyle=f;ctx.fillRect(0,0,w,h);
      for(let i=0;i<9500;i++){ctx.fillStyle=r()>.54?'rgba(255,246,205,.045)':'rgba(51,40,19,.05)';ctx.fillRect(r()*w,r()*h,1+r()*3,1+r()*2);}
      ctx.strokeStyle='#5e66476d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(110,0);ctx.bezierCurveTo(330,180,60,330,158,537);ctx.bezierCurveTo(246,680,85,735,120,h);ctx.stroke();
      for(let i=0;i<24;i++){const x=590+r()*260,y=70+r()*285;ctx.strokeStyle='#5f56387d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-16,y+25);ctx.lineTo(x,y-18);ctx.lineTo(x+20,y+25);ctx.moveTo(x,y-18);ctx.lineTo(x+3,y+18);ctx.stroke();}
      for(let i=0;i<55;i++){const x=55+r()*210,y=245+r()*430;ctx.strokeStyle='#49634285';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+11);ctx.lineTo(x,y-12);ctx.moveTo(x-8,y+2);ctx.lineTo(x,y-9);ctx.lineTo(x+8,y+2);ctx.stroke();}
      const punto=p=>[p[0]/100*w,p[1]/100*h];ctx.beginPath();posiciones.forEach((p,i)=>{const [x,y]=punto(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle='#5d3a1f6b';ctx.lineWidth=16;ctx.lineJoin='round';ctx.stroke();ctx.setLineDash([5,17]);ctx.strokeStyle='#f4dda0';ctx.lineWidth=6;ctx.stroke();ctx.setLineDash([]);
      posiciones.forEach((p,i)=>{const [x,y]=punto(p);ctx.fillStyle='#69512f';ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ebd49b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#4a331e';ctx.font='700 17px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y+1);});
      ctx.strokeStyle='#7560409a';ctx.lineWidth=4;ctx.strokeRect(19,19,w-38,h-38);ctx.lineWidth=1;ctx.strokeRect(26,26,w-52,h-52);ctx.fillStyle='#5e4e2fbb';ctx.textAlign='center';ctx.font='700 37px Georgia';ctx.fillText('LA MESA DEL DOMO',w/2,88);ctx.font='italic 16px Georgia';ctx.fillText('Un camino, seis encuentros',w/2,115);
      ctx.save();ctx.translate(w-88,h-100);ctx.strokeStyle='#665234aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-42);ctx.lineTo(10,0);ctx.lineTo(0,42);ctx.lineTo(-10,0);ctx.closePath();ctx.fillStyle='#665234bb';ctx.fill();ctx.font='20px Georgia';ctx.fillText('N',0,-53);ctx.restore();
    });
  }
  function texturaNiebla(){return texturaDibujo(512,512,(ctx,w,h)=>{const r=azar(933);ctx.clearRect(0,0,w,h);for(let i=0;i<34;i++){const x=r()*w,y=r()*h,radio=35+r()*145,g=ctx.createRadialGradient(x,y,0,x,y,radio);g.addColorStop(0,'rgba(221,229,209,.50)');g.addColorStop(1,'rgba(191,204,194,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radio,0,Math.PI*2);ctx.fill();}});}
  function posicionMundo(p){return new THREE.Vector3((p[0]-50)*.102,.18,(p[1]-50)*.072);}
  function liberar(nodo){nodo?.traverse?.(n=>{n.geometry?.dispose?.();const ms=Array.isArray(n.material)?n.material:[n.material];for(const m of ms)if(m){for(const campo of ['map','alphaMap','emissiveMap'])m[campo]?.dispose?.();m.dispose?.();}});}
  function crearMaterial(color,extras={}){return new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.12,...extras});}
  function crearVela(x,z,alto){
    const grupo=new THREE.Group(),base=new THREE.Mesh(new THREE.CylinderGeometry(.37,.5,.11,18),crearMaterial(0xa97631,{metalness:.5,roughness:.34})),cera=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,alto,16),crearMaterial(0xe3d0ac,{roughness:.77})),llama=new THREE.Mesh(new THREE.SphereGeometry(.095,12,8),new THREE.MeshBasicMaterial({color:0xffc76f}));
    base.position.y=.08;cera.position.y=.11+alto/2;llama.position.y=.17+alto;llama.scale.y=1.8;grupo.add(base,cera,llama);grupo.position.set(x,0,z);return grupo;
  }
  function crearDado(x,z,escala,color){const d=new THREE.Mesh(new THREE.DodecahedronGeometry(escala,0),crearMaterial(color,{roughness:.38,metalness:.38}));d.position.set(x,.23,z);d.rotation.set(.32,.63,.1);return d;}
  function figuraRival(id){
    const color=paleta[id]||0x6f5e55,g=new THREE.Group(),m=crearMaterial(color),oscura=crearMaterial(0x2a2330),oro=crearMaterial(0xcaa75c,{metalness:.55,roughness:.33}),piel=crearMaterial(0xc2a481);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,.12,12),oro),cuerpo=new THREE.Mesh(new THREE.CylinderGeometry(.21,.29,.65,12),m),cabeza=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),piel),bota=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.22,10),oscura);
    base.position.y=.06;cuerpo.position.y=.43;cabeza.position.y=.88;bota.position.set(0,.18,.02);g.add(base,cuerpo,cabeza,bota);
    const palo=()=>{const v=new THREE.Mesh(new THREE.CylinderGeometry(.023,.03,.92,8),crearMaterial(0x65442d));v.position.set(.27,.58,.03);v.rotation.z=-.08;g.add(v);};
    if(id==='mohamed'){palo();const cristal=new THREE.Mesh(new THREE.OctahedronGeometry(.1),crearMaterial(0x9cc6be,{emissive:0x315e58,emissiveIntensity:.28}));cristal.position.set(.31,1.1,.03);g.add(cristal);}
    if(id==='fender'){const laud=new THREE.Mesh(new THREE.SphereGeometry(.16,10,7),crearMaterial(0xad8150));laud.scale.set(.78,1.25,.3);laud.position.set(.22,.57,.18);g.add(laud);}
    if(id==='talesin'){for(const lado of [-1,1]){const ala=new THREE.Mesh(new THREE.ConeGeometry(.22,.58,4),crearMaterial(0xd9d1b0));ala.position.set(lado*.28,.69,.04);ala.rotation.z=lado*.72;g.add(ala);}}
    if(id==='rafaela'){const arco=new THREE.Mesh(new THREE.TorusGeometry(.21,.018,6,14,Math.PI),crearMaterial(0xb88e54));arco.position.set(.28,.65,.04);arco.rotation.z=-.4;g.add(arco);}
    if(id==='adreida'){const escudo=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.045,6),crearMaterial(0x8aa3ba,{metalness:.45}));escudo.position.set(-.26,.6,.18);escudo.rotation.x=Math.PI/2;g.add(escudo);}
    if(id==='gero'){const capa=new THREE.Mesh(new THREE.ConeGeometry(.38,.75,12),m);capa.position.y=.44;const libro=new THREE.Mesh(new THREE.BoxGeometry(.28,.04,.38),crearMaterial(0xead5a4));libro.position.set(.15,.66,.26);libro.rotation.x=-.45;g.add(capa,libro);}
    // La figura es una miniatura 3D de lectura rápida; el estandarte conserva
    // la identidad y arte oficiales sin pretender que ya existe un GLB final.
    const marco=new THREE.Group(),metalMarco=crearMaterial(0xa77b3c,{metalness:.52,roughness:.32});[[0,.34,.5,.052],[0,-.34,.5,.052],[-.25,0,.052,.68],[.25,0,.052,.68]].forEach(([x,y,w,h])=>{const barra=new THREE.Mesh(new THREE.BoxGeometry(w,h,.032),metalMarco);barra.position.set(x,y,0);marco.add(barra);});marco.position.set(0,1.23,-.18);g.add(marco);
    const retrato=new THREE.Mesh(new THREE.PlaneGeometry(.41,.59),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));retrato.position.set(0,1.23,-.158);g.add(retrato);
    new THREE.TextureLoader().load('./juego/art/lider_'+id+'.webp',textura=>{textura.colorSpace=THREE.SRGBColorSpace;retrato.material.color.set(0xffffff);retrato.material.map=textura;retrato.material.needsUpdate=true;renderizar();},undefined,()=>{});
    return g;
  }
  function geometriaPersonaje(dato,detalle){
    const caras=window.campanaGeometriaPersonaje(dato,detalle),posiciones=[],normales=[],colores=[],v=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
    for(const cara of caras){
      const color=new THREE.Color(cara.color);
      for(let i=1;i<cara.v.length-1;i++){
        const indices=[0,i,i+1];v.fromArray(cara.v[0]);b.fromArray(cara.v[i]);c.fromArray(cara.v[i+1]);n.crossVectors(b.clone().sub(v),c.clone().sub(v)).normalize();
        for(const indice of indices){const punto=cara.v[indice],normal=cara.nv?.[indice]||n;posiciones.push(...punto);normales.push(...normal);colores.push(color.r,color.g,color.b);}
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(posiciones,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normales,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colores,3));geo.computeBoundingSphere();return geo;
  }
  function crearHeroe(detalle='medio'){
    const g=new THREE.Group(),geo=geometriaPersonaje(aspectos[aspecto],detalle),m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.08,side:THREE.DoubleSide});
    const figura=new THREE.Mesh(geo,m);figura.name='miniatura-protagonista';g.add(figura);return g;
  }
  function escenaBase(){
    escena=new THREE.Scene();escena.background=new THREE.Color(0x08060c);escena.fog=new THREE.Fog(0x08060c,15,29);
    camara=new THREE.PerspectiveCamera(38,1,.1,52);camara.position.copy(posicionCamara);camara.lookAt(objetivoCamara);
    const lienzo=document.createElement('canvas');lienzo.id='campanaThreeLienzo';lienzo.setAttribute('aria-hidden','true');host.prepend(lienzo);
    renderer=new THREE.WebGLRenderer({canvas:lienzo,antialias:false,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.15));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
    escena.add(new THREE.HemisphereLight(0x8799b9,0x170b0a,1.55));const calida=new THREE.DirectionalLight(0xffd2a0,3.1);calida.position.set(-4,10,6);escena.add(calida);const fria=new THREE.DirectionalLight(0x8195d5,.58);fria.position.set(8,5,-9);escena.add(fria);
    grupoMesa=new THREE.Group();escena.add(grupoMesa);
    const mesa=new THREE.Mesh(new THREE.BoxGeometry(14.4,.58,10.3),new THREE.MeshStandardMaterial({map:texturaMadera(),roughness:.48,metalness:.07}));mesa.position.y=-.36;grupoMesa.add(mesa);
    const borde=new THREE.Mesh(new THREE.BoxGeometry(11.3,.16,8.38),crearMaterial(0x9a6b2e,{metalness:.5,roughness:.34}));borde.position.y=-.01;grupoMesa.add(borde);
    const pergamino=new THREE.Mesh(new THREE.BoxGeometry(10.95,.105,8.02),new THREE.MeshPhysicalMaterial({map:texturaMapa(),roughness:.84,clearcoat:.06,clearcoatRoughness:.8}));pergamino.position.y=.1;grupoMesa.add(pergamino);
    const marco=new THREE.Mesh(new THREE.BoxGeometry(10.55,.03,7.62),new THREE.MeshBasicMaterial({color:0xe1ba6c,transparent:true,opacity:.13}));marco.position.y=.16;grupoMesa.add(marco);
    grupoMesa.add(crearVela(-5.9,3.95,.96),crearVela(5.9,3.95,1.15),crearDado(-5.14,-2.72,.52,0x783c42),crearDado(5.05,-1.9,.34,0x487063));
    const diario=new THREE.Mesh(new THREE.BoxGeometry(1.35,.21,1.85),crearMaterial(0x452d31,{roughness:.54,metalness:.1}));diario.position.set(4.65,.22,2.43);diario.rotation.y=-.21;grupoMesa.add(diario);
    const hojas=new THREE.Mesh(new THREE.BoxGeometry(1.18,.12,1.62),crearMaterial(0xd0bd8f,{roughness:.82}));hojas.position.set(4.65,.38,2.43);hojas.rotation.y=-.21;grupoMesa.add(hojas);
    grupoRuta=new THREE.Group();escena.add(grupoRuta);const puntos=datos.casillas.map(posicionMundo);const curva=new THREE.CatmullRomCurve3(puntos,false,'centripetal');const camino=new THREE.Mesh(new THREE.TubeGeometry(curva,64,.034,6,false),new THREE.MeshBasicMaterial({color:0xf0cc82,transparent:true,opacity:.65}));camino.position.y=.2;grupoRuta.add(camino);
    datos.rivales.forEach((r,i)=>{const sitio=posicionMundo(datos.casillas[i]),g=new THREE.Group(),aro=new THREE.Mesh(new THREE.TorusGeometry(.47,.035,7,28),new THREE.MeshBasicMaterial({color:0xe8bf73,transparent:true,opacity:.3})),peana=new THREE.Mesh(new THREE.CylinderGeometry(.47,.57,.13,16),crearMaterial(0x66503b,{metalness:.38,roughness:.43})),figura=figuraRival(r.lider);aro.rotation.x=-Math.PI/2;aro.position.y=.18;peana.position.y=.065;figura.position.y=.15;g.position.copy(sitio);g.add(peana,aro,figura);grupoRuta.add(g);nodos.push({g,aro,figura,sitio,r});});
    grupoNiebla=new THREE.Group();const niebla=new THREE.Mesh(new THREE.PlaneGeometry(10.3,3.1),new THREE.MeshBasicMaterial({map:texturaNiebla(),transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}));niebla.rotation.x=-Math.PI/2;niebla.position.set(.2,.31,-2.2);grupoNiebla.add(niebla);escena.add(grupoNiebla);
    grupoHeroe=crearHeroe('medio');escena.add(grupoHeroe);
  }
  function construirRutaHTML(){
    const lista=$('campanaThreeRuta');lista.replaceChildren();const zona=$('campanaThreeMarcadores');zona.replaceChildren();marcadores.length=0;
    datos.rivales.forEach((r,i)=>{
      const lider=datos.lideres[r.lider],li=document.createElement('li'),boton=document.createElement('button');boton.type='button';boton.dataset.indice=String(i);boton.textContent=String(i+1);boton.title=lider.n;boton.setAttribute('aria-label','Encuentro '+(i+1)+': '+lider.n);boton.addEventListener('click',()=>cambiarEtapa(i,true));li.appendChild(boton);lista.appendChild(li);
      const marcador=document.createElement('button');marcador.type='button';marcador.className='marcadorThree';marcador.dataset.indice=String(i);marcador.innerHTML='<span></span>';marcador.addEventListener('click',()=>cambiarEtapa(i,true));zona.appendChild(marcador);marcadores.push(marcador);
    });
    const tu=document.createElement('button');tu.type='button';tu.className='marcadorThree marcadorHeroe';tu.textContent=aspectos[aspecto].nombre;tu.setAttribute('aria-label','Tu miniatura: '+aspectos[aspecto].nombre);tu.addEventListener('click',()=>mostrarHeroe());zona.appendChild(tu);marcadores.push(tu);
  }
  function estadoDeNodo(i){return i<etapa?'vencido':i===etapa?'actual':'futuro';}
  function actualizarUI(){
    const r=datos.rivales[etapa],l=datos.lideres[r.lider],heroe=aspectos[aspecto];
    $('campanaThreeProgreso').textContent=heroe.nombre+' · '+etapa+' de 6 rivales vencidos';
    $('campanaThreeRivalTitulo').textContent=l.n;$('campanaThreeRivalEp').textContent=l.ep||'Protagonista del Domo';$('campanaThreeAlma').textContent=String(r.alma);$('campanaThreeMazo').textContent=l.arch||'Mazo de campaña';$('campanaThreeDescripcion').textContent=descripciones[r.lider]||'';
    $('campanaThreeHeroeTitulo').textContent=heroe.nombre;$('campanaThreeHeroeDetalle').textContent=[heroe.figura,heroe.estatura,heroe.equipo].join(' · ');
    document.querySelectorAll('#campanaThreeRuta button').forEach((b,i)=>b.dataset.estado=estadoDeNodo(i));
    marcadores.forEach((m,i)=>{if(i<datos.rivales.length){m.dataset.estado=estadoDeNodo(i);m.setAttribute('aria-pressed',String(i===etapa));m.textContent=datos.lideres[datos.rivales[i].lider].n;}else{m.textContent=heroe.nombre;m.setAttribute('aria-pressed',String(vista==='heroe'));}});
    document.querySelectorAll('[data-heroe]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.heroe===aspecto)));
    const movimiento=$('campanaThreeMovimiento'),reducido=sinMovimiento||reducirSistema();
    movimiento.setAttribute('aria-pressed',String(reducido));movimiento.textContent=reducido?'Movimiento: reducido':'Movimiento: activo';
    movimiento.disabled=reducirSistema();movimiento.setAttribute('aria-disabled',String(reducirSistema()));
    movimiento.title=reducirSistema()?'El sistema solicitó reducir movimiento.':'Alternar transiciones de cámara.';
  }
  function actualizarMesa(){
    nodos.forEach((n,i)=>{const actual=i===etapa,anterior=i<etapa;n.aro.material.color.set(actual?0xffd98f:anterior?0x82b184:0x826549);n.aro.material.opacity=actual?.96:anterior?.48:.16;n.figura.traverse(x=>{if(x.isMesh){x.material.emissive?.set(actual?0x40230f:0x000000);x.material.emissiveIntensity=actual?.22:0;}});n.g.scale.setScalar(actual?1.08:anterior?.92:.78);});
    const espera=datos.esperas[Math.min(etapa,datos.esperas.length-1)]||[50,90];grupoHeroe.position.copy(posicionMundo(espera));grupoHeroe.position.y=.17;grupoHeroe.rotation.y=.15;
    grupoNiebla.visible=etapa<5;grupoNiebla.children[0].material.opacity=etapa<5?limitar(.45-etapa*.055,.15,.45):0;
  }
  function reconstruirHeroe(detalle='medio'){
    if(!grupoHeroe)return;const posicion=grupoHeroe.position.clone(),rot=grupoHeroe.rotation.y;liberar(grupoHeroe);escena.remove(grupoHeroe);grupoHeroe=crearHeroe(detalle);grupoHeroe.position.copy(posicion);grupoHeroe.rotation.y=rot;escena.add(grupoHeroe);actualizarMesa();
  }
  function posicionarMarcadores(){
    if(!renderer||vista==='heroe')return;
    const rect=host.getBoundingClientRect();
    nodos.forEach((n,i)=>{const m=marcadores[i],p=n.sitio.clone();p.y+=1.18;p.project(camara);const visible=p.z>-1&&p.z<1;m.style.left=((p.x*.5+.5)*rect.width)+'px';m.style.top=((-p.y*.5+.5)*rect.height)+'px';m.hidden=!visible;});
    const m=marcadores.at(-1),p=grupoHeroe.position.clone();p.y+=1.63;p.project(camara);m.style.left=((p.x*.5+.5)*rect.width)+'px';m.style.top=((-p.y*.5+.5)*rect.height)+'px';m.hidden=!(p.z>-1&&p.z<1);
  }
  function renderizar(){if(!renderer||document.hidden)return;camara.position.copy(posicionCamara);camara.lookAt(objetivoCamara);renderer.render(escena,camara);posicionarMarcadores();}
  function acomodar(){if(!renderer)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camara.aspect=w/h;camara.updateProjectionMatrix();renderizar();}
  function animarCamara(posicion,objetivo,duracion=650){
    const desdePos=posicionCamara.clone(),desdeObj=objetivoCamara.clone(),inicio=performance.now();cancelAnimationFrame(raf);animacion=null;
    if(sinMovimiento||reducirSistema()){posicionCamara.copy(posicion);objetivoCamara.copy(objetivo);renderizar();return;}
    const cuadro=ahora=>{const t=limitar((ahora-inicio)/duracion,0,1),e=suave(t);posicionCamara.set(mezcla(desdePos.x,posicion.x,e),mezcla(desdePos.y,posicion.y,e),mezcla(desdePos.z,posicion.z,e));objetivoCamara.set(mezcla(desdeObj.x,objetivo.x,e),mezcla(desdeObj.y,objetivo.y,e),mezcla(desdeObj.z,objetivo.z,e));renderizar();if(t<1){animacion=cuadro;raf=requestAnimationFrame(cuadro);}else animacion=null;};animacion=cuadro;raf=requestAnimationFrame(cuadro);
  }
  function mostrarMapa(){vista='mesa';host.dataset.vista='mesa';reconstruirHeroe('medio');const objetivo=new THREE.Vector3(0,.1,0),posicion=new THREE.Vector3(0,10.8,14.1);animarCamara(posicion,objetivo);actualizarUI();if(estadoTexto)estadoTexto.textContent='Vista de mapa: '+datos.lideres[datos.rivales[etapa].lider].n+' es el siguiente encuentro.';}
  function mostrarHeroe(){vista='heroe';host.dataset.vista='heroe';reconstruirHeroe('alto');const p=grupoHeroe.position.clone(),objetivo=p.clone().add(new THREE.Vector3(0,1.05,0)),posicion=p.clone().add(new THREE.Vector3(2.55,3.1,5.15));animarCamara(posicion,objetivo,720);actualizarUI();if(estadoTexto)estadoTexto.textContent='Vista de héroe: la misma malla configurable de la campaña se muestra con detalle alto.';}
  function mostrarEncuentro(){vista='encuentro';host.dataset.vista='mesa';reconstruirHeroe('medio');const p=nodos[etapa].sitio.clone(),objetivo=p.clone().add(new THREE.Vector3(0,.72,0)),posicion=p.clone().add(new THREE.Vector3(etapa%2?2.8:-2.8,3.55,5.1));animarCamara(posicion,objetivo,620);actualizarUI();if(estadoTexto)estadoTexto.textContent='Enfoque visual en '+datos.lideres[datos.rivales[etapa].lider].n+'. Esta revisión no inicia un combate.';}
  function cambiarEtapa(n,enfocar){etapa=limitar(Number(n)||0,0,datos.rivales.length-1);$('campanaThreeEstado').value=String(etapa);vista='mesa';host.dataset.vista='mesa';actualizarMesa();actualizarUI();if(enfocar)mostrarEncuentro();else mostrarMapa();}
  function cambiarAspecto(nombre){if(!Object.hasOwn(aspectos,nombre))return;aspecto=nombre;construirRutaHTML();reconstruirHeroe(vista==='heroe'?'alto':'medio');actualizarUI();renderizar();if(estadoTexto)estadoTexto.textContent='Aspecto de prueba actualizado: '+aspectos[aspecto].nombre+'. No se guardó ningún dato.';}
  function eventos(){
    $('campanaThreeEstado').addEventListener('change',e=>cambiarEtapa(e.target.value,false));$('campanaThreeAcercar').addEventListener('click',mostrarEncuentro);$('campanaThreeEntrar').addEventListener('click',mostrarEncuentro);$('campanaThreeMapa').addEventListener('click',mostrarMapa);$('campanaThreeVolverMapa').addEventListener('click',mostrarMapa);$('campanaThreeVerHeroe').addEventListener('click',mostrarHeroe);
    $('campanaThreeGirarIzq').addEventListener('click',()=>{grupoHeroe.rotation.y-=.42;renderizar();});$('campanaThreeGirarDer').addEventListener('click',()=>{grupoHeroe.rotation.y+=.42;renderizar();});document.querySelectorAll('[data-heroe]').forEach(b=>b.addEventListener('click',()=>cambiarAspecto(b.dataset.heroe)));
    $('campanaThreeMovimiento').addEventListener('click',()=>{sinMovimiento=!sinMovimiento;const b=$('campanaThreeMovimiento');b.setAttribute('aria-pressed',String(sinMovimiento));b.textContent=sinMovimiento?'Movimiento: reducido':'Movimiento: activo';if(estadoTexto)estadoTexto.textContent=sinMovimiento?'Las transiciones ahora se muestran de inmediato.':'Las transiciones de cámara están activas.';});
    $('campanaThreeReiniciar').addEventListener('click',()=>{etapa=0;aspecto='guardia';vista='mesa';$('campanaThreeEstado').value='0';construirRutaHTML();reconstruirHeroe('medio');actualizarMesa();mostrarMapa();if(estadoTexto)estadoTexto.textContent='Muestra reiniciada. Ningún avance real fue alterado.';});
  }
  function destruir(){cancelAnimationFrame(raf);observador?.disconnect();liberar(escena);renderer?.renderLists?.dispose?.();renderer?.dispose?.();renderer?.forceContextLoss?.();renderer?.domElement?.remove();}
  try{
    escenaBase();construirRutaHTML();actualizarMesa();actualizarUI();eventos();observador=new ResizeObserver(acomodar);observador.observe(host);window.addEventListener('beforeunload',destruir,{once:true});acomodar();
    window.CAOZ_CAMPANA_THREE_ESCENA=Object.freeze({destruir,mostrarMapa,mostrarHeroe,mostrarEncuentro,cambiarEtapa,inspeccion:()=>Object.freeze({three:true,etapa,aspecto,vista,canvas:renderer?.domElement?.id||''})});
  }catch(error){destruir();desactivarControles('No se pudo preparar la escena Three.js; la muestra no altera ningún dato.');console.warn('Campaña Three: se desactivó la revisión al fallar WebGL.',error);}
})();

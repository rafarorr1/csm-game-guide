/*
 * Atrio de Forja: visor aislado del personaje de campaña en Three.js.
 *
 * Sus perfiles usan los mismos campos del personaje de campaña; esta vitrina
 * los presenta con una silueta adulta independiente. No monta campaña,
 * partida ni persistencia.
 */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const host=$('heroeThreeEscena'),estado=$('heroeThreeEstado'),T=window.CAOZ_THREE?.THREE;
  if(!host||!T||typeof window.campanaGeometriaPersonaje!=='function')return;
  const reducido=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const aspectos=Object.freeze({
    guardiana:{nombre:'Aurelia',clase:'Guardiana del Domo',estatura:'Alta',equipo:'Hoja solar y escudo',paleta:{luz:0xffc17a,acento:0xd7ad64,halo:0xd97a55},dato:{genero:'femenino',figura:'guardian',estatura:'alta',cuerpo:'atletico',rostro:'angular',ojos:'jade',rasgo:'cicatriz',peinado:'largo',piel:'cobre',cabello:'oscuro',atuendo:'ligero',color:'vino',accesorio:'broche',equipo:'espada'}},
    oraculo:{nombre:'Nerys',clase:'Oráculo de las siete brasas',estatura:'Media',equipo:'Bastón de visión',paleta:{luz:0xb8a4ff,acento:0x9d79d5,halo:0x7cced1},dato:{genero:'no_binario',figura:'mago',estatura:'media',cuerpo:'esbelto',rostro:'ovalado',ojos:'violeta',rasgo:'runas',peinado:'diadema',piel:'marfil',cabello:'plata',atuendo:'arcano',color:'violeta',accesorio:'amuleto',equipo:'baston'}},
    explorador:{nombre:'Ilan',clase:'Explorador del umbral',estatura:'Alta',equipo:'Arco de ceniza',paleta:{luz:0xa9dbb5,acento:0x8aa968,halo:0x65b797},dato:{genero:'masculino',figura:'explorador',estatura:'alta',cuerpo:'esbelto',rostro:'ancho',ojos:'avellana',rasgo:'pecas',peinado:'trenzas',piel:'arena',cabello:'castano',atuendo:'ruta',color:'verde',accesorio:'medallon',equipo:'arco'}}
  });
  let arquetipo='guardiana',escena,camara,renderer,grupoHeroe,grupoAura,luzAcento,luzFrontal,raf=0,observador,objetivoGiro=0,giro=0,tiempoInicial=performance.now(),fallo=false;

  function limitar(n,min,max){return Math.min(max,Math.max(min,n));}
  function material(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.48,metalness:.16,...extra});}
  function liberar(objeto){
    objeto?.traverse?.(n=>{
      if(!n.isMesh&&!n.isPoints)return;
      n.geometry?.dispose?.();
      const materiales=Array.isArray(n.material)?n.material:[n.material];
      materiales.forEach(m=>{if(!m)return;for(const campo of ['map','alphaMap','emissiveMap'])m[campo]?.dispose?.();m.dispose?.();});
    });
  }
  function apagar(mensaje){
    fallo=true;cancelAnimationFrame(raf);document.querySelectorAll('button').forEach(b=>{b.disabled=true;b.setAttribute('aria-disabled','true');});
    if(estado)estado.textContent=mensaje;
  }
  function tubo(a,b,radio,color,extra={}){
    const inicio=new T.Vector3(...a),fin=new T.Vector3(...b),eje=fin.clone().sub(inicio),alto=eje.length();
    const m=new T.Mesh(new T.CylinderGeometry(extra.arriba??radio,extra.abajo??radio,alto,extra.lados??12,1,false),material(color,extra.material||{}));
    m.position.copy(inicio.add(fin).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),eje.normalize());return m;
  }
  function esfera(x,y,z,rx,ry,rz,color,extra={}){
    const m=new T.Mesh(new T.SphereGeometry(1,extra.lados??20,extra.anillos??14),material(color,extra.material||{}));
    m.position.set(x,y,z);m.scale.set(rx,ry,rz);return m;
  }
  function aro(r,alto,color,opacidad=.75){
    const m=new T.Mesh(new T.TorusGeometry(r,alto,10,48),new T.MeshBasicMaterial({color,transparent:true,opacity:opacidad,depthWrite:false}));m.rotation.x=Math.PI/2;return m;
  }
  function formaExtrudida(puntos,profundidad,color,extra={}){
    const s=new T.Shape();puntos.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    return new T.Mesh(new T.ExtrudeGeometry(s,{depth:profundidad,bevelEnabled:true,bevelThickness:extra.bisel??.015,bevelSize:extra.bisel??.015,bevelSegments:1,curveSegments:6}),material(color,extra.material||{}));
  }
  function crearPedestal(paleta){
    const g=new T.Group();
    const base=new T.Mesh(new T.CylinderGeometry(1.56,1.72,.22,56),material(0x161722,{metalness:.52,roughness:.27}));base.position.y=.10;g.add(base);
    const borde=new T.Mesh(new T.TorusGeometry(1.47,.055,10,56),material(paleta.acento,{metalness:.72,roughness:.24,emissive:paleta.acento,emissiveIntensity:.12}));borde.rotation.x=Math.PI/2;borde.position.y=.235;g.add(borde);
    const disco=new T.Mesh(new T.CylinderGeometry(1.29,1.32,.09,56),material(0x29303a,{metalness:.36,roughness:.32}));disco.position.y=.255;g.add(disco);
    const sello=aro(.96,.019,paleta.acento,.67);sello.position.y=.312;g.add(sello);
    const selloInterno=aro(.63,.012,paleta.halo,.32);selloInterno.position.y=.315;g.add(selloInterno);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,cristal=new T.Mesh(new T.OctahedronGeometry(.065,0),material(paleta.halo,{emissive:paleta.halo,emissiveIntensity:.8,roughness:.22,metalness:.22}));
      cristal.position.set(Math.sin(a)*.96,.36,Math.cos(a)*.96);cristal.rotation.y=-a;g.add(cristal);
    }
    return g;
  }
  function crearAltar(paleta){
    const g=new T.Group(),arco=new T.Mesh(new T.TorusGeometry(3.22,.028,8,80,Math.PI),new T.MeshBasicMaterial({color:paleta.acento,transparent:true,opacity:.17,depthWrite:false}));
    arco.position.set(0,3.1,-1.03);arco.rotation.z=Math.PI;g.add(arco);
    const aroInterior=new T.Mesh(new T.TorusGeometry(2.64,.014,8,80,Math.PI),new T.MeshBasicMaterial({color:paleta.halo,transparent:true,opacity:.14,depthWrite:false}));aroInterior.position.set(0,3.06,-1.035);aroInterior.rotation.z=Math.PI;g.add(aroInterior);
    for(let i=0;i<7;i++){
      const a=Math.PI*.16+i*Math.PI*.68/6,x=Math.cos(a)*3.22,y=3.1+Math.sin(a)*3.22,marca=new T.Mesh(new T.OctahedronGeometry(.052,0),material(paleta.acento,{emissive:paleta.acento,emissiveIntensity:.45,roughness:.3}));
      marca.position.set(x,y,-1.02);marca.rotation.z=-a;g.add(marca);
    }
    return g;
  }
  function crearBruma(paleta){
    const cantidad=72,posiciones=new Float32Array(cantidad*3),colores=new Float32Array(cantidad*3),c=new T.Color(paleta.halo);
    for(let i=0;i<cantidad;i++){
      const a=(i*2.399963229728653)% (Math.PI*2),r=.68+(i%13)/14*2.8;
      posiciones[i*3]=Math.cos(a)*r;posiciones[i*3+1]=.42+(i*19%100)/100*4.9;posiciones[i*3+2]=-1.25-((i*23)%100)/100*.7;
      colores[i*3]=c.r;colores[i*3+1]=c.g;colores[i*3+2]=c.b;
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(posiciones,3));geo.setAttribute('color',new T.BufferAttribute(colores,3));
    const p=new T.Points(geo,new T.PointsMaterial({size:.028,vertexColors:true,transparent:true,opacity:.58,depthWrite:false,sizeAttenuation:true}));p.name='motas-de-forja';return p;
  }
  function crearRostroAdulto({piel,pelo,iris,paleta}){
    const g=new T.Group(),pielClaro=new T.Color(piel).offsetHSL(0,.02,.09).getHex(),sombraPiel=new T.Color(piel).offsetHSL(0,.04,-.13).getHex(),ojo=0xf2e5d5;
    // Cabeza estrecha y alargada: una proporción adulta en lugar de la esfera
    // grande de una miniatura. El rostro queda siempre orientado a la cámara.
    const cuello=tubo([0,4.18,0],[0,4.44,.01],.125,piel,{lados:16});g.add(cuello);
    const cabeza=esfera(0,4.93,.025,.335,.49,.32,piel,{lados:28,anillos:18,material:{roughness:.58}}),mandibula=esfera(0,4.66,.07,.275,.18,.245,piel,{lados:24,anillos:12,material:{roughness:.62}});g.add(cabeza,mandibula);
    for(const s of [-1,1]){
      g.add(esfera(s*.327,4.91,.01,.042,.095,.05,piel,{lados:12,anillos:8}),esfera(s*.115,5.00,.314,.046,.028,.014,ojo,{lados:16,anillos:10}),esfera(s*.115,5.00,.329,.020,.022,.009,iris,{lados:14,anillos:9,material:{emissive:iris,emissiveIntensity:.08}}),esfera(s*.115,5.00,.338,.009,.012,.004,0x10131a,{lados:12,anillos:8}),tubo([s*.062,5.12,.327],[s*.17,5.11,.302],.012,pelo,{lados:8}));
      const pomulo=esfera(s*.19,4.78,.282,.07,.046,.02,pielClaro,{lados:14,anillos:9,material:{roughness:.7}});g.add(pomulo);
    }
    g.add(esfera(0,4.89,.348,.026,.052,.037,piel,{lados:14,anillos:10}),tubo([-.055,4.66,.306],[.055,4.66,.306],.009,sombraPiel,{lados:8}));
    // Casquete, mechones y un recogido: cabello con volumen sin ocultar ojos.
    const casquete=new T.Mesh(new T.SphereGeometry(.37,28,14,0,Math.PI*2,0,Math.PI*.53),material(pelo,{roughness:.49,metalness:.02}));casquete.scale.set(1,1.08,.91);casquete.position.set(0,5.13,-.002);g.add(casquete);
    for(const s of [-1,1]){
      g.add(tubo([s*.24,5.22,.05],[s*.28,4.50,-.07],.038,pelo,{lados:10,arriba:.031,abajo:.049}),tubo([s*.16,5.28,.19],[s*.09,5.09,.31],.022,pelo,{lados:9,arriba:.016,abajo:.028}));
    }
    const rodete=esfera(0,5.25,-.27,.17,.19,.13,pelo,{lados:18,anillos:12});g.add(rodete);
    const arco=new T.CatmullRomCurve3([new T.Vector3(-.21,5.23,.30),new T.Vector3(0,5.35,.33),new T.Vector3(.21,5.23,.30)]);g.add(new T.Mesh(new T.TubeGeometry(arco,24,.010,6,false),material(paleta.acento,{metalness:.78,roughness:.17,emissive:paleta.acento,emissiveIntensity:.07})),esfera(0,5.32,.335,.025,.038,.012,paleta.halo,{lados:12,anillos:8,material:{emissive:paleta.halo,emissiveIntensity:.9,roughness:.2}}));
    g.position.y=-.21;return g;
  }
  function crearCapaAdulta(paleta,tela){
    const g=new T.Group(),s=new T.Shape();
    s.moveTo(-.42,4.10);s.lineTo(-.68,3.55);s.lineTo(-.78,1.58);s.lineTo(-.31,1.30);s.lineTo(0,1.43);s.lineTo(.31,1.30);s.lineTo(.78,1.58);s.lineTo(.68,3.55);s.lineTo(.42,4.10);s.lineTo(0,4.26);s.closePath();
    const capa=new T.Mesh(new T.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1}),material(tela,{roughness:.67,metalness:.05,side:T.DoubleSide}));capa.position.z=-.41;capa.rotation.y=Math.PI;g.add(capa);
    for(const x of [-.48,-.24,0,.24,.48])g.add(tubo([x,3.82,-.44],[x*.96,1.62,-.46],.010,paleta.luz,{lados:7,material:{emissive:paleta.luz,emissiveIntensity:.09,metalness:.32}}));
    return g;
  }
  function crearEquipoAdulto(tipo,paleta){
    const g=new T.Group(),metal=0xc6ceda,cuero=0x38282a;
    if(tipo==='guardiana'){
      const espada=new T.Group(),hoja=formaExtrudida([[-.08,0],[.08,0],[.055,.88],[0,1.11],[-.055,.88]],.035,metal,{bisel:.008,material:{metalness:.8,roughness:.17}});hoja.position.z=.03;espada.add(hoja,tubo([-.16,.04,.04],[.16,.04,.04],.026,paleta.acento,{lados:8,material:{metalness:.72,roughness:.2}}),tubo([0,-.28,.04],[0,.04,.04],.035,cuero,{lados:9}));espada.position.set(.66,2.63,.27);espada.rotation.z=-.12;g.add(espada);
      const escudo=new T.Mesh(new T.CylinderGeometry(.42,.47,.075,6),material(0x7d3640,{metalness:.45,roughness:.32}));escudo.rotation.x=Math.PI/2;escudo.position.set(-.74,3.00,.31);g.add(escudo);
      g.add(tubo([-.74,2.76,.355],[-.74,3.24,.355],.018,paleta.acento,{lados:8,material:{metalness:.75,roughness:.2}}),tubo([-.94,3.0,.355],[-.54,3.0,.355],.018,paleta.acento,{lados:8,material:{metalness:.75,roughness:.2}}));
    }else if(tipo==='oraculo'){
      g.add(tubo([.61,1.38,.12],[.61,4.42,.12],.034,0x553a37,{lados:10}),esfera(.61,4.57,.12,.15,.19,.15,paleta.halo,{lados:16,anillos:12,material:{emissive:paleta.halo,emissiveIntensity:1.35,roughness:.2,metalness:.25}}));
      const anillo=new T.Mesh(new T.TorusGeometry(.23,.012,8,28),material(paleta.acento,{emissive:paleta.acento,emissiveIntensity:.45,metalness:.65,roughness:.2}));anillo.position.set(.61,4.57,.12);anillo.rotation.x=.55;g.add(anillo);
    }else{
      const arco=new T.CatmullRomCurve3([new T.Vector3(.62,4.18,.06),new T.Vector3(.99,3.30,.08),new T.Vector3(.62,2.33,.06)]);g.add(new T.Mesh(new T.TubeGeometry(arco,30,.025,8,false),material(0x805735,{roughness:.45,metalness:.15})),tubo([.62,4.18,.065],[.62,2.33,.065],.008,0xd8c9ad,{lados:6}));
      const carcaj=new T.Mesh(new T.CylinderGeometry(.16,.20,.76,12),material(0x4c3329,{roughness:.55}));carcaj.position.set(-.57,3.74,-.26);carcaj.rotation.z=-.35;g.add(carcaj);for(let i=0;i<4;i++)g.add(tubo([-.70+i*.07,4.12,-.24],[-.57+i*.05,3.65,-.25],.009,0xc8b295,{lados:6}));
    }
    return g;
  }
  function crearFiguraAdulta(tipo,paleta){
    const g=new T.Group(),dato=aspectos[tipo].dato,piel={cobre:0x965b42,marfil:0xe2bd9e,arena:0xbf845d}[dato.piel]||0xc78b62,pelo={oscuro:0x211b21,plata:0xd3d1d1,castano:0x62422c}[dato.cabello]||0x2a2024,iris={jade:0x3f776c,violeta:0x7662aa,avellana:0x674931}[dato.ojos]||0x534538,tela={guardiana:0x6d263b,oraculo:0x5a3c83,explorador:0x355e49}[tipo],metal=0xbec6d3,cuero=0x33282c;
    // Piernas largas, botas separadas y cintura alta: el gesto clave contra
    // la lectura chibi. La altura final es 5.7 unidades, cabeza ≈ 1/7.
    for(const s of [-1,1]){
      g.add(tubo([s*.20,.44,.03],[s*.18,1.48,.03],.145,cuero,{lados:14,arriba:.12,abajo:.17}),tubo([s*.18,1.44,.02],[s*.20,2.45,.02],.158,tela,{lados:15,arriba:.13,abajo:.18}),esfera(s*.20,.37,.17,.19,.13,.32,0x1a1a20,{lados:16,anillos:10}));
    }
    const falda=new T.Mesh(new T.CylinderGeometry(.48,.62,.72,24,1,false),material(tela,{roughness:.58,metalness:.06}));falda.position.y=2.25;g.add(falda);
    const torso=new T.Mesh(new T.CylinderGeometry(.56,.46,1.36,24,1,false),material(tela,{roughness:.52,metalness:.08}));torso.position.y=3.28;g.add(torso);
    const cinturon=new T.Mesh(new T.TorusGeometry(.475,.034,8,30),material(paleta.acento,{metalness:.63,roughness:.22}));cinturon.rotation.x=Math.PI/2;cinturon.position.y=2.67;g.add(cinturon,esfera(0,2.67,.48,.065,.08,.026,paleta.halo,{lados:12,anillos:8,material:{emissive:paleta.halo,emissiveIntensity:.38,metalness:.3}}));
    if(tipo==='guardiana'){
      const peto=esfera(0,3.40,.31,.54,.62,.16,metal,{lados:24,anillos:16,material:{metalness:.74,roughness:.22}});g.add(peto);for(const s of [-1,1])g.add(esfera(s*.54,3.86,.02,.25,.16,.28,metal,{lados:16,anillos:10,material:{metalness:.72,roughness:.22}}));
    }else if(tipo==='oraculo'){
      g.add(esfera(0,3.38,.315,.46,.60,.09,0x644795,{lados:22,anillos:14,material:{roughness:.46,metalness:.12,emissive:0x24163a,emissiveIntensity:.18}}));for(const s of [-1,1])g.add(esfera(s*.18,3.28,.43,.028,.028,.016,paleta.halo,{lados:10,anillos:7,material:{emissive:paleta.halo,emissiveIntensity:.9}}));
    }else{
      const chaleco=esfera(0,3.35,.31,.51,.60,.13,0x4b342c,{lados:22,anillos:14,material:{roughness:.58,metalness:.1}});g.add(chaleco);for(const s of [-1,1])g.add(tubo([s*.15,3.95,.43],[s*.10,2.84,.43],.014,paleta.acento,{lados:7,material:{metalness:.35,roughness:.3}}));
    }
    for(const s of [-1,1]){
      const hombro=[s*.55,3.86,.02],codo=[s*.68,3.16,.10],mano=[s*.55,2.62,.22];g.add(esfera(...hombro,.165,.14,.18,tipo==='guardiana'?metal:tela,{lados:16,anillos:10,material:{metalness:tipo==='guardiana'?.55:.08,roughness:.35}}),tubo(hombro,codo,.13,tela,{lados:13,arriba:.11,abajo:.15}),tubo(codo,mano,.105,tipo==='guardiana'?metal:tela,{lados:12,arriba:.085,abajo:.12,material:{metalness:tipo==='guardiana'?.55:.08,roughness:.4}}),esfera(...mano,.092,.105,.075,piel,{lados:14,anillos:9}));
    }
    g.add(crearCapaAdulta(paleta,tela),crearRostroAdulto({piel,pelo,iris,paleta}),crearEquipoAdulto(tipo,paleta));return g;
  }
  function crearHeroe(tipo){
    const aspecto=aspectos[tipo],g=new T.Group();g.name='heroe-adulto-'+tipo;
    // Los presets son compatibles con el personaje compartido. El Atrio usa
    // una silueta adulta de presentación independiente, no una miniatura.
    g.userData.carasCampana=window.campanaGeometriaPersonaje(aspecto.dato,'alto').length;
    const figura=crearFiguraAdulta(tipo,aspecto.paleta);figura.name='silueta-adulta-forja';g.add(figura,crearPedestal(aspecto.paleta),crearAltar(aspecto.paleta),crearBruma(aspecto.paleta));
    g.position.y=.27;return g;
  }
  function prepararEscena(){
    escena=new T.Scene();escena.background=new T.Color(0x0b0811);escena.fog=new T.Fog(0x0b0811,12,23);
    camara=new T.PerspectiveCamera(34,1,.1,45);camara.position.set(0,3.15,10.4);camara.lookAt(0,2.9,0);
    renderer=new T.WebGLRenderer({canvas:$('heroeThreeLienzo'),antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.3));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.15;
    const ambiente=new T.HemisphereLight(0x8ea2c5,0x160b10,1.55);escena.add(ambiente);
    luzFrontal=new T.DirectionalLight(0xffd6b1,3.8);luzFrontal.position.set(-4.8,8,6.5);escena.add(luzFrontal);
    const contra=new T.DirectionalLight(0x8292db,1.35);contra.position.set(5.5,5.4,-4.7);escena.add(contra);
    luzAcento=new T.PointLight(0xffaa72,3.2,8.5,2);luzAcento.position.set(-2.3,3.7,2.5);escena.add(luzAcento);
    const luzLateral=new T.PointLight(0x956dd6,1.5,7.5,2);luzLateral.position.set(2.8,2.4,1.3);escena.add(luzLateral);
    const suelo=new T.Mesh(new T.CircleGeometry(5.8,80),new T.MeshStandardMaterial({color:0x0e0d16,roughness:.78,metalness:.15}));suelo.rotation.x=-Math.PI/2;suelo.position.y=-.02;escena.add(suelo);
    const aroSuelo=aro(3.92,.018,0x9f7547,.16);aroSuelo.position.y=.006;escena.add(aroSuelo);
    cambiarArquetipo(arquetipo,false);
  }
  function actualizarFicha(){
    const a=aspectos[arquetipo];$('heroeThreeNombre').textContent=a.nombre;$('heroeThreeClase').textContent=a.clase;$('heroeThreeEstatura').textContent=a.estatura;$('heroeThreeEquipo').textContent=a.equipo;
    document.querySelectorAll('[data-arquetipo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.arquetipo===arquetipo)));
  }
  function cambiarArquetipo(nombre,anunciar=true){
    if(!Object.hasOwn(aspectos,nombre)||fallo)return;arquetipo=nombre;
    if(grupoHeroe){escena.remove(grupoHeroe);liberar(grupoHeroe);}
    grupoHeroe=crearHeroe(nombre);escena.add(grupoHeroe);
    const a=aspectos[nombre];luzAcento.color.set(a.paleta.luz);luzFrontal.color.set(a.paleta.luz);actualizarFicha();renderizar();
    if(anunciar&&estado)estado.textContent=a.nombre+', '+a.clase+'. Perfil compatible con campaña; silueta adulta de presentación.';
  }
  function acomodar(){
    if(!renderer)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight),estrecho=w/h<.86;
    renderer.setSize(w,h,false);camara.aspect=w/h;camara.fov=estrecho?38:34;camara.position.set(0,estrecho?3.35:3.15,estrecho?12.25:10.4);camara.updateProjectionMatrix();renderizar();
  }
  function renderizar(){if(!renderer||document.hidden)return;camara.lookAt(0,2.82,0);renderer.render(escena,camara);}
  function animar(ahora){
    if(fallo)return;const t=(ahora-tiempoInicial)/1000;
    giro+=(objetivoGiro-giro)*.09; if(grupoHeroe){grupoHeroe.rotation.y=giro; if(!reducido)grupoHeroe.position.y=-.03+Math.sin(t*1.25)*.018;}
    if(!reducido&&grupoAura){grupoAura.rotation.y=t*.08;}
    if(!reducido&&luzAcento)luzAcento.intensity=3.1+Math.sin(t*1.6)*.18;
    renderizar();raf=requestAnimationFrame(animar);
  }
  function girar(delta,texto){objetivoGiro+=delta;if(estado)estado.textContent=texto;}
  function eventos(){
    document.querySelectorAll('[data-arquetipo]').forEach(b=>b.addEventListener('click',()=>cambiarArquetipo(b.dataset.arquetipo)));
    $('heroeThreeIzquierda').addEventListener('click',()=>girar(-Math.PI/3,'Vista girada a la izquierda.'));
    $('heroeThreeDerecha').addEventListener('click',()=>girar(Math.PI/3,'Vista girada a la derecha.'));
    $('heroeThreeCentro').addEventListener('click',()=>{objetivoGiro=0;if(estado)estado.textContent='Vista frontal restaurada.';});
  }
  function destruir(){cancelAnimationFrame(raf);observador?.disconnect();liberar(escena);renderer?.renderLists?.dispose?.();renderer?.dispose?.();renderer?.forceContextLoss?.();}
  try{
    prepararEscena();eventos();observador=new ResizeObserver(acomodar);observador.observe(host);window.addEventListener('beforeunload',destruir,{once:true});acomodar();
    window.CAOZ_HEROE_THREE=Object.freeze({cambiar:n=>cambiarArquetipo(n),girarIzquierda:()=>girar(-Math.PI/3,'Vista girada a la izquierda.'),girarDerecha:()=>girar(Math.PI/3,'Vista girada a la derecha.'),destruir,inspeccion:()=>Object.freeze({three:true,arquetipo,origen:'perfil compatible con campaña',persistencia:false})});
    raf=requestAnimationFrame(animar);
  }catch(error){console.warn('Héroe Three: la prueba no pudo iniciar.',error);apagar('No se pudo preparar la vitrina Three.js; esta prueba no alteró ningún dato.');destruir();}
})();

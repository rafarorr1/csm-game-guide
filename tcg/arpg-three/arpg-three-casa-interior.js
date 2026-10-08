/* Interior de Scenario: decorado estático, retratos mates y materiales compartidos.
   La precarga comparte texturas con la casa real. Sin otro renderer ni CDN. */
'use strict';
(function(){
  const ruta=typeof document!=='undefined'&&document.currentScript?.src?new URL('./casa-goblin-scenario/',document.currentScript.src).href:null;
  const reservas=new WeakMap();
  function recursos(THREE){
    if(reservas.has(THREE))return reservas.get(THREE);
    const mapas=new Map(),pendientes=[],r={mapas,pendientes,listo:!ruta,promesa:null};
    r.textura=function(nombre,color=false,flip=false){
      if(!ruta)return null;if(mapas.has(nombre))return mapas.get(nombre);
      let resolver;pendientes.push(new Promise(r=>{resolver=r;}));
      const t=new THREE.TextureLoader().load(ruta+nombre,()=>resolver(),undefined,()=>{console.warn('No se pudo cargar el interior: '+nombre);resolver();});
      t.flipY=flip;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;mapas.set(nombre,t);return t;
    };reservas.set(THREE,r);return r;
  }
  function precargar(THREE){
    const r=recursos(THREE);if(r.promesa)return r.promesa;
    for(const i of new Set(window.CAOZ_CASA_GOBLIN_DATOS.mallas.map(d=>d.material))){r.textura('color-'+i+'.webp',true);r.textura('normal-'+i+'.webp');r.textura('superficie-'+i+'.webp');}
    for(const nombre of ['foto-familia.webp','foto-comida.webp'])r.textura(nombre,true,true);
    r.promesa=Promise.all(r.pendientes).then(()=>{r.listo=true;});return r.promesa;
  }
  function crear(THREE,{reducido=false}={}){
    const datos=window.CAOZ_CASA_GOBLIN_DATOS,raiz=new THREE.Group(),materiales=new Map(),r=recursos(THREE),textura=r.textura,texturasListas=precargar(THREE);
    raiz.name='Interior · Scenario';
    const leer=(s,T)=>new T(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
    for(const d of datos.mallas){
      const g=new THREE.BufferGeometry();
      for(const [nombre,ancho] of [['position',3],['normal',3],['uv',2]])g.setAttribute(nombre,new THREE.BufferAttribute(leer(d[nombre],Float32Array),ancho));
      g.setIndex(new THREE.BufferAttribute(leer(d.index,Uint16Array),1));g.computeBoundingBox();g.computeBoundingSphere();
      let mat=materiales.get(d.material);
      if(!mat){const i=d.material;mat=new THREE.MeshStandardMaterial({map:textura('color-'+i+'.webp',true),
        normalMap:textura('normal-'+i+'.webp'),roughnessMap:textura('superficie-'+i+'.webp'),metalnessMap:textura('superficie-'+i+'.webp'),
        roughness:1,metalness:.18,normalScale:new THREE.Vector2(.4,.4),envMapIntensity:.16,side:THREE.DoubleSide});materiales.set(i,mat);}
      const m=new THREE.Mesh(g,mat);m.name='Decorado de la casa';m.receiveShadow=true;raiz.add(m);
    }
    const marco=new THREE.MeshStandardMaterial({color:0x423024,roughness:.96});
    const borde=new THREE.MeshStandardMaterial({color:0x846746,roughness:.97});
    function caja(w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);raiz.add(m);return m;}
    // Dos recuerdos independientes: nunca se usa la foto del decorado generada dentro del atlas.
    const retratos=[{nombre:'foto-familia.webp',x:-1.35,y:2.16,z:-3.20,ancho:1.12},{nombre:'foto-comida.webp',x:.12,y:2.12,z:-3.20,ancho:1.06}];
    for(const r of retratos){
      const alto=r.ancho*2/3;
      caja(r.ancho+.16,alto+.16,.065,r.x,r.y,r.z,marco);
      caja(r.ancho+.055,alto+.055,.07,r.x,r.y,r.z+.009,borde);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(r.ancho,alto),new THREE.MeshStandardMaterial({map:textura(r.nombre,true,true),color:0xa59b89,roughness:1,envMapIntensity:.08}));
      m.name=r.nombre;m.position.set(r.x,r.y,r.z+.052);raiz.add(m);
    }
    // La ventana conserva un fondo nocturno aunque detrás del diorama no haya ciudad.
    const cielo=new THREE.Mesh(new THREE.PlaneGeometry(1.32,1.14),new THREE.MeshBasicMaterial({color:0x070f1c}));
    cielo.position.set(2.25,1.66,-3.52);raiz.add(cielo);
    const luna=new THREE.Mesh(new THREE.CircleGeometry(.09,16),new THREE.MeshBasicMaterial({color:0xb5c8dd}));
    luna.position.set(2.6,1.95,-3.50);raiz.add(luna);
    // Completa el dintel que la reconstrucción dejó abierto sobre la ventana.
    const yeso=new THREE.MeshStandardMaterial({color:0x80694e,roughness:1});
    caja(2.85,.28,.16,2.60,2.40,-3.58,yeso);
    caja(2.95,.13,.17,2.60,2.55,-3.39,marco);
    for(const x of [1.53,2.97])caja(.13,1.28,.15,x,1.66,-3.37,marco);
    for(const y of [1.05,2.27])caja(1.64,.13,.17,2.25,y,-3.39,marco);
    caja(.065,1.12,.08,2.25,1.66,-3.37,marco);caja(1.36,.065,.08,2.25,1.64,-3.37,marco);
    // Una vela sobre la mesa; iluminación local sin sombras adicionales.
    const cera=new THREE.Mesh(new THREE.CylinderGeometry(.036,.045,.22,8),new THREE.MeshStandardMaterial({color:0xc6ac71,roughness:1}));
    cera.position.set(-2.8,.83,.3);raiz.add(cera);
    const llama=new THREE.Mesh(new THREE.SphereGeometry(.043,8,6),new THREE.MeshBasicMaterial({color:0xffb950}));
    llama.scale.set(.6,1.7,.6);llama.position.set(-2.8,.99,.3);raiz.add(llama);
    const vela=new THREE.PointLight(0xffaa54,.6,3,2);vela.position.set(-2.8,1.04,.3);raiz.add(vela);
    // Relámpagos al otro lado del cristal: sólo una línea y una luz local, sin otra pasada.
    const trazo=new THREE.BufferGeometry().setFromPoints([[2.08,2.19,-3.47],[2.18,1.98,-3.47],[2.10,1.82,-3.47],[2.31,1.63,-3.47],[2.22,1.47,-3.47],[2.42,1.18,-3.47]].map(p=>new THREE.Vector3(...p)));
    const rayo=new THREE.Line(trazo,new THREE.LineBasicMaterial({color:0xc9e1ff,transparent:true,opacity:0,depthWrite:false}));rayo.name='Relámpago exterior';rayo.visible=false;raiz.add(rayo);
    const luzVentana=new THREE.PointLight(0x9bbfe8,0,7,2);luzVentana.name='Luz del relámpago';luzVentana.position.set(2.25,2,-3.05);raiz.add(luzVentana);
    const noche=new THREE.Color(0x070f1c),destelloCielo=new THREE.Color(0x849ebd);
    let reloj=0,siguiente=6,inicio=-100,relampagos=0,destello=0,semilla=73;
    const azar=()=>{semilla=semilla*16807%2147483647;return semilla/2147483647;};
    function paso(dt){if(!Number.isFinite(dt)||dt<=0)return;reloj+=dt;
      if(reloj>=siguiente){inicio=siguiente;relampagos++;siguiente=reloj+14+azar()*12;}
      const t=reloj-inicio,pulso=(centro,ancho)=>Math.max(0,1-Math.abs(t-centro)/ancho);
      destello=reducido?pulso(.85,.85)*.18:Math.max(pulso(.16,.16),pulso(.48,.22)*.65);
      cielo.material.color.copy(noche).lerp(destelloCielo,destello*.85);luzVentana.intensity=destello*8;
      rayo.visible=destello>.025&&!reducido;rayo.material.opacity=destello;
    }
    function reiniciar(){reloj=relampagos=destello=0;siguiente=6;inicio=-100;semilla=73;rayo.visible=false;rayo.material.opacity=0;luzVentana.intensity=0;cielo.material.color.copy(noche);}
    // Decorado inmutable: el motor no recalcula cientos de transformaciones de utilería por cuadro.
    raiz.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});raiz.matrixAutoUpdate=true;
    const estadisticas={triangulos:0,mallas:0,retratos:2};raiz.traverse(o=>{if(o.isMesh){estadisticas.mallas++;estadisticas.triangulos+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
    return {raiz,texturasListas,get listo(){return r.listo;},estadisticas,paso,reiniciar,estado:()=>({tiempo:reloj,relampagos,destello}),
      entrada:new THREE.Vector3(-.6,0,3.25)};
  }
  window.CAOZ_ARPG_CASA_INTERIOR=Object.freeze({crear,precargar});
})();

/* Decoración estática del sendero. X es avance local; Z negativo es el fondo.
   Kiln sólo exporta las seis geometrías: no se ejecuta su SDK durante el juego.
   Sin colisiones, luces o actualizaciones de matrices por fotograma. */
'use strict';
(function(){
  // Una vía abandonada aparece entre la tierra y termina junto a la ciudad.
  // Los centros son deliberados; la aceptación se decide con la huella completa.
  const PAVIMENTOS=[
    [5.6,.55,-.12],[11.7,-.65,.09],[17.2,.35,-.08],
    [21.4,-.55,.05],[25.6,.45,-.07],[29.4,-.45,.04],[32.2,.3,-.04],
    [38.9,-.5,.08],[42.6,.55,-.05],[46.7,-.6,.06],[49.8,.4,-.02],
    [57.9,-.55,.05],[61.7,.55,-.06],[65.4,-.4,.05],[69.0,.45,-.04],
    [71.65,-.65,.03],
    [75.7,-1.08,0],[75.7,1.08,0],[78.5,-1.08,0],[78.5,1.08,0],
    [81.3,-1.08,0],[81.3,1.08,0],
  ];
  const BORDES=[
    [12.8,-4.65,.025],[12.8,4.65,-.025],
    [21,-4.66,-.02],[21,4.66,.02],[23.2,-4.66,.025],[25.5,4.66,-.025],
    [39.5,-4.7,.02],[39.5,4.65,.025],[43.6,-4.65,-.025],[43.6,4.65,.02],
    [58,-4.65,.02],[58,4.65,-.025],[72.2,4.65,-.02],
    [77.8,-4.65,.02],[77.8,4.65,-.02],[80.8,-4.53,0],[80.8,4.53,0],
  ];
  const HITOS=[
    [13.2,-6.25,.08],[27.8,-6.3,-.06],[43,-6.2,.03],[58.8,-6.35,-.04],[80,-5.8,0],
  ];
  const RUINAS=[
    ['remate',9.1,-7.1,-.10,.82],['recto',18.1,-6.9,.02,1.1],
    ['recto',26.8,-7.4,-.03,1],['remate',39.9,-7.1,.07,.85],
    ['esquina',44.1,-7.6,0,1.1],['remate',48.9,-7.3,.15,.8],
    ['esquina',60,-7.9,Math.PI/2,1],['recto',66.6,-7.4,-.06,1.2],
    ['esquina',74.6,-7.7,Math.PI,.9],['recto',80.4,-6.9,.04,.95],
  ];
  const ZONAS=Object.freeze([
    {id:'fuego',minX:33.9,maxX:36.8,minZ:-4.8,maxZ:4.8},
    {id:'salto',minX:51.5,maxX:56,minZ:-6.8,maxZ:6.8},
    {id:'tronco',minX:72.95,maxX:74.15,minZ:-4.4,maxZ:4.4},
    {id:'porton',minX:84.1,maxX:88.4,minZ:-4.8,maxZ:4.8},
  ]);
  const SALIDAS=Object.freeze([[16.2,1],[26.1,-1],[31,-1],[33,1],[62,-1],[64,1],[66,-1]]);
  const BISAGRAS=Object.freeze([19,29,46,49,61,70,76,83]);
  const limitar=(n,a,b)=>Math.max(a,Math.min(b,n));
  const bordeCamino=s=>4-limitar((s-80)/5,0,1);
  const indiceTramo=s=>limitar(Math.floor((s+14)/12),0,7);

  function crear(THREE,{grupo,materialPiedra}={}){
    const raiz=new THREE.Group();raiz.name='Tutorial · vía y ruinas de Kiln';
    const geometria=new Map(),bandas=[],lotes=[],colocadas=[],rechazadas=[],margenes=[];
    let material=null,eliminado=false,culling=true,tramoActual=-1,disponible=false,motivo='',instantanea;
    let totalTriangulos=0,totalInstancias=0,visiblesTriangulos=0,visiblesInstancias=0,visiblesLotes=0;
    let registro=Object.freeze([]),registroRechazos=Object.freeze([]);
    const actualizarEstado=()=>{instantanea=Object.freeze({
      disponible,eliminado,motivo,modulos:geometria.size,materiales:material&&!eliminado?1:0,
      instancias:totalInstancias,triangulos:totalTriangulos,lotes:lotes.length,
      instanciasVisibles:visiblesInstancias,triangulosVisibles:visiblesTriangulos,lotesVisibles:visiblesLotes,
      mapasListos:Boolean(material?.map&&material?.normalMap&&material?.roughnessMap),
      tramo:tramoActual,culling,rechazadas:rechazadas.length,proyectaSombras:false,
    });};
    function eliminar(){
      if(eliminado)return;eliminado=true;disponible=false;
      raiz.removeFromParent();for(const lote of lotes)lote.dispose();
      for(const g of geometria.values())g.geo.dispose();material?.dispose();
      raiz.clear();visiblesTriangulos=visiblesInstancias=visiblesLotes=0;actualizarEstado();
    }
    function actualizarMaterial(){
      if(eliminado||!material||!materialPiedra)return;
      // copy comparte los mapas de M.roca; no duplica ni dispone sus texturas.
      material.copy(materialPiedra);material.name='Kiln · piedra del bosque y color por vértice';
      material.vertexColors=true;material.needsUpdate=true;actualizarEstado();
    }
    function actualizar(s=0){
      if(eliminado||!disponible)return;
      const indice=indiceTramo(Number.isFinite(s)?s:0);
      if(indice===tramoActual)return;
      tramoActual=indice;visiblesTriangulos=visiblesInstancias=visiblesLotes=0;
      const desde=-14+indice*12,hasta=indice===7?92:desde+12;
      // Unión conservadora de las ventanas del tramo: nunca desaparece una
      // pieza antes del umbral -44/+72 usado por el paisaje del tutorial.
      for(const b of bandas){
        const visible=!culling||(b.fin>desde-44&&b.inicio<hasta+72);b.grupo.visible=visible;
        if(visible){visiblesTriangulos+=b.triangulos;visiblesInstancias+=b.instancias;visiblesLotes+=b.lotes;}
      }
      actualizarEstado();
    }
    function activarCulling(valor){
      if(eliminado)return;const nuevo=Boolean(valor);if(nuevo===culling)return;
      const s=tramoActual<0?0:-14+tramoActual*12;culling=nuevo;tramoActual=-1;actualizar(s);
    }
    function reemplazaMargen(s,lado){
      if(!disponible||eliminado||!Number.isFinite(s))return false;
      const signo=lado<0?-1:1;
      for(const intervalo of margenes)if(intervalo.lado===signo&&s>=intervalo.desde&&s<=intervalo.hasta)return true;
      return false;
    }
    const api={actualizar,actualizarMaterial,eliminar,estado:()=>instantanea,
      colocaciones:()=>registro,rechazos:()=>registroRechazos,reemplazaMargen,culling:activarCulling};
    actualizarEstado();
    if(!grupo?.isObject3D||!materialPiedra?.isMaterial){motivo='Falta el grupo del paisaje o su material de piedra.';actualizarEstado();return api;}
    const ruinas=window.CAOZ_RUINAS_KILN,sendero=window.CAOZ_SENDERO_KILN;
    if(ruinas?.version!==1||sendero?.version!==1||!Array.isArray(ruinas.modulos)||!Array.isArray(sendero.modulos)){
      motivo='Los datos locales de Kiln no están preparados.';actualizarEstado();return api;
    }
    const decodificar=(valor,Tipo)=>{
      if(typeof valor!=='string'||!valor.length)throw new Error('Atributo vacío.');
      const datos=Uint8Array.from(atob(valor),c=>c.charCodeAt(0));
      if(datos.byteLength%Tipo.BYTES_PER_ELEMENT)throw new Error('Atributo incompleto.');
      return new Tipo(datos.buffer);
    };
    try{
      for(const m of [...ruinas.modulos,...sendero.modulos]){
        if(!['recto','esquina','remate','pavimento','borde','hito'].includes(m.id)||geometria.has(m.id))throw new Error('Módulo desconocido o duplicado.');
        const p=decodificar(m.position,Float32Array),n=decodificar(m.normal,Float32Array),uv=decodificar(m.uv,Float32Array),c=decodificar(m.color,Float32Array),i=decodificar(m.index,Uint16Array);
        if(p.length%3||n.length!==p.length||c.length!==p.length||uv.length!==p.length/3*2||i.length%3)throw new Error('Atributos incompatibles en '+m.id+'.');
        if(!p.every(Number.isFinite)||!n.every(Number.isFinite)||!uv.every(Number.isFinite)||!c.every(Number.isFinite)||i.some(indice=>indice>=p.length/3))throw new Error('Datos no válidos en '+m.id+'.');
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('normal',new THREE.BufferAttribute(n,3));
        geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setAttribute('color',new THREE.BufferAttribute(c,3));geo.setIndex(new THREE.BufferAttribute(i,1));
        geo.computeBoundingBox();geo.computeBoundingSphere();geometria.set(m.id,{geo,triangulos:i.length/3,nombre:m.nombre});
      }
      if(geometria.size!==6)throw new Error('Se necesitan las seis geometrías exportadas.');
    }catch(error){
      for(const g of geometria.values())g.geo.dispose();geometria.clear();motivo='Datos de Kiln no válidos: '+error.message;actualizarEstado();return api;
    }
    material=materialPiedra.clone();actualizarMaterial();
    for(let indice=0;indice<8;indice++){
      const inicio=-14+indice*12,fin=indice===7?92:inicio+12,tramo=new THREE.Group();
      tramo.name='Kiln · tramo '+(indice+1);tramo.position.x=(inicio+fin)/2;raiz.add(tramo);
      bandas.push({grupo:tramo,inicio,fin,tipos:new Map(),triangulos:0,instancias:0,lotes:0});
    }
    const objeto=new THREE.Object3D(),caja=new THREE.Box3();
    const intersecta=(b,z)=>b.max.x>z.minX&&b.min.x<z.maxX&&b.max.z>z.minZ&&b.min.z<z.maxZ;
    function alturaSuelo(s,z){
      const distancia=Math.abs(z),borde=bordeCamino(s),d=distancia-borde;
      if(d>=0&&d<=2.1){
        const distancias=[0,.38,.93,1.48,2.1],alturas=[.035,.39,.49,.31,-.005];
        let i=0;while(i<3&&d>distancias[i+1])i++;
        const f=(d-distancias[i])/(distancias[i+1]-distancias[i]);
        return (alturas[i]*(1-f)+alturas[i+1]*f)*(1-limitar((s-78)/6,0,1)*.6)*(.84+.15*Math.sin(s*1.57));
      }
      return -.019+(Math.sin(s*.18+z*.27)*.28+Math.cos(z*.39-s*.12)*.2)*limitar((distancia-7)/6,0,1);
    }
    function motivoRechazo(tipo,b){
      for(const zona of ZONAS)if(intersecta(b,zona))return 'Reserva de '+zona.id;
      if(tipo==='pavimento')return b.max.y>.040001?'Pavimento demasiado alto':'';
      const limite=Math.max(4.3,bordeCamino(b.min.x),bordeCamino(b.max.x));
      if(b.min.z<limite&&b.max.z>-limite)return 'Invade el camino';
      if(tipo!=='borde'&&b.max.z>=0)return 'Elemento alto en primer plano';
      // Los actores salen por estas franjas; también se protege el barrido de
      // las barricadas para que no atraviesen decorado al abrirse.
      for(const [s,lado] of SALIDAS){
        const z=lado<0?{minX:s-1.6,maxX:s+1.6,minZ:-6.05,maxZ:-3.1}:{minX:s-1.6,maxX:s+1.6,minZ:3.1,maxZ:6.05};
        if(intersecta(b,z))return 'Salida de emboscada';
      }
      for(const s of BISAGRAS)for(const lado of [-1,1]){
        const z=lado<0?{minX:s-.7,maxX:s+.7,minZ:-5.45,maxZ:-3.7}:{minX:s-.7,maxX:s+.7,minZ:3.7,maxZ:5.45};
        if(intersecta(b,z))return 'Barrido de barricada';
      }
      return '';
    }
    function colocar(tipo,s,z,giro=0,escala=1){
      const datos=geometria.get(tipo),g=datos.geo;
      objeto.position.set(s,0,z);objeto.rotation.set(0,giro,0);objeto.scale.setScalar(escala);objeto.updateMatrix();
      caja.copy(g.boundingBox).applyMatrix4(objeto.matrix);
      if(tipo==='pavimento')objeto.position.y=.035-caja.max.y;
      else{
        const y=Math.min(alturaSuelo(caja.min.x,caja.min.z),alturaSuelo(caja.min.x,caja.max.z),alturaSuelo(caja.max.x,caja.min.z),alturaSuelo(caja.max.x,caja.max.z),alturaSuelo(s,z));
        objeto.position.y=y-caja.min.y+.004;
      }
      objeto.updateMatrix();caja.copy(g.boundingBox).applyMatrix4(objeto.matrix);
      const motivo=motivoRechazo(tipo,caja);
      if(motivo){rechazadas.push(Object.freeze({tipo,s,z,motivo}));return;}
      const indice=indiceTramo(s),banda=bandas[indice];
      const bounds=Object.freeze({min:Object.freeze(caja.min.toArray()),max:Object.freeze(caja.max.toArray())});
      const pieza=Object.freeze({tipo,s,z,y:objeto.position.y,giro,escala,tramo:indice,triangulos:datos.triangulos,bounds});colocadas.push(pieza);
      if(!banda.tipos.has(tipo))banda.tipos.set(tipo,[]);banda.tipos.get(tipo).push(pieza);
      if(tipo==='borde')margenes.push({lado:z<0?-1:1,desde:caja.min.x-.3,hasta:caja.max.x+.3});
      totalTriangulos+=datos.triangulos;totalInstancias++;
    }
    for(let i=0;i<PAVIMENTOS.length;i++){const [s,z,giro]=PAVIMENTOS[i];colocar('pavimento',s,z,giro+(i%2?Math.PI:0));}
    for(const [s,z,giro] of BORDES)colocar('borde',s,z,giro);
    for(const [s,z,giro] of HITOS)colocar('hito',s,z,giro);
    for(const [tipo,s,z,giro,escala] of RUINAS)colocar(tipo,s,z,giro,escala);
    for(const banda of bandas)for(const [tipo,piezas] of banda.tipos){
      const datos=geometria.get(tipo),malla=new THREE.InstancedMesh(datos.geo,material,piezas.length);
      malla.name='Kiln · '+datos.nombre+' · '+banda.inicio+'–'+banda.fin;
      for(let i=0;i<piezas.length;i++){
        const p=piezas[i];objeto.position.set(p.s-banda.grupo.position.x,p.y,p.z);objeto.rotation.set(0,p.giro,0);objeto.scale.setScalar(p.escala);objeto.updateMatrix();malla.setMatrixAt(i,objeto.matrix);
      }
      malla.instanceMatrix.needsUpdate=true;malla.castShadow=false;malla.receiveShadow=true;
      malla.computeBoundingBox();malla.computeBoundingSphere();malla.matrixAutoUpdate=false;
      malla.userData.kiln=Object.freeze({tipo,instancias:piezas.length,triangulos:datos.triangulos*piezas.length});
      banda.grupo.add(malla);lotes.push(malla);banda.lotes++;banda.instancias+=piezas.length;banda.triangulos+=datos.triangulos*piezas.length;
    }
    registro=Object.freeze(colocadas);registroRechazos=Object.freeze(rechazadas);
    disponible=true;grupo.add(raiz);raiz.updateMatrixWorld(true);actualizar(0);
    return api;
  }
  window.CAOZ_TUTORIAL_KILN=Object.freeze({crear});
})();

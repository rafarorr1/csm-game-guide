/* Bosque exterior estático: tres capas con lotes locales y caminos despejados.
   Añadir después de fundirMundo; se mantienen los lotes al ocultar árboles frente a la cámara. */
'use strict';
(function(){
  function fabrica(T,{grupo,radioMuralla=26,calles=[-Math.PI/2,Math.PI/6,Math.PI*5/6],abierto=false,reducido=false,obstaculos=[]}={}){
    let semilla=73191;
    const azar=()=>{semilla=(semilla*16807)%2147483647;return (semilla-1)/2147483646;};
    const fin=abierto?108:82,inicio=radioMuralla+7,capas=[{min:inicio,max:inicio+(fin-inicio)*.26,n:100},{min:inicio+(fin-inicio)*.26,max:inicio+(fin-inicio)*.59,n:160},{min:inicio+(fin-inicio)*.59,max:fin,n:240}];
    const caminos=calles.map(a=>({x:Math.cos(a),z:Math.sin(a)})),claros=abierto?[{x:0,z:-55},{x:52,z:30},{x:-65,z:38}]:[],arboles=[];
    for(const [capa,datos]of capas.entries()){
      const cantidad=Math.round(datos.n*(reducido?.5:1));let puestos=0;
      for(let intento=0;puestos<cantidad&&intento<cantidad*12;intento++){
        const angulo=intento*2.399963229728653+capa*.71+(azar()-.5)*.22,radio=Math.sqrt(datos.min**2+azar()*(datos.max**2-datos.min**2));
        const x=Math.cos(angulo)*radio,z=Math.sin(angulo)*radio,alto=6.5+capa*1.6+azar()*(4.5+capa),ancho=(1.55+azar()*1.1)*(1+capa*.12),conifera=azar()<.61,huella=ancho*(conifera?1:1.18);
        if(radio-huella<radioMuralla+4||radio+huella>fin+3)continue;
        // Se excluye también la copa: ninguna rama atraviesa las calles de 5 m.
        if(caminos.some(n=>x*n.x+z*n.z>0&&Math.abs(x*n.z-z*n.x)<3.2+huella))continue;
        if(claros.some(c=>Math.hypot(x-c.x,z-c.z)<9+huella))continue;
        // La primera capa tiene aire entre troncos; el fondo cierra el horizonte.
        if(arboles.some(a=>Math.hypot(x-a.x,z-a.z)<(a.capa===0&&capa===0?2.8:1.7)))continue;
        arboles.push({x,z,alto,ancho,huella,conifera,capa,giro:azar()*Math.PI*2,tono:azar()});puestos++;
      }
    }
    const raiz=new T.Group();raiz.name='Bosque exterior · tres estratos';grupo?.add(raiz);
    const material=color=>new T.MeshStandardMaterial({color,roughness:1,metalness:0,envMapIntensity:.12});
    const geometriaTronco=new T.CylinderGeometry(.11,.21,1,7),geometriaConifera=new T.ConeGeometry(1,1,9),geometriaCopa=new T.IcosahedronGeometry(1,1);
    for(const geometria of [geometriaTronco,geometriaConifera,geometriaCopa])geometria.computeBoundingBox();
    const materialTronco=material(0x65503b),materialConifera=material(0x365940),materialCopa=material(0x3c6345);
    // Una esfera alrededor del bosque entero toca siempre el encuadre de la plaza.
    // Dividir por estrato y octante permite omitir árboles fuera de cámara, con
    // exactamente las mismas instancias, tres geometrías y tres materiales.
    const zonas=new Map();
    for(const a of arboles){const sector=Math.min(7,Math.floor((Math.atan2(a.z,a.x)+Math.PI)*8/(Math.PI*2))),clave=a.capa+':'+sector;if(!zonas.has(clave))zonas.set(clave,[]);zonas.get(clave).push(a);}
    const objeto=new T.Object3D(),tinte=new T.Color(),cajaInstancia=new T.Box3(),matrizInstancia=new T.Matrix4(),lotes=[];
    for(const a of arboles)Object.defineProperty(a,'occlusion',{value:{caja:new T.Box3(),slots:[],oculto:false}});
    function colocar(a,m,i,x,y,z,sx,sy,sz,giro,tono){
      objeto.position.set(x,y,z);objeto.rotation.set(0,giro,0);objeto.scale.set(sx,sy,sz);objeto.updateMatrix();m.setMatrixAt(i,objeto.matrix);
      tinte.setRGB(.72+tono*.28,.76+tono*.24,.69+tono*.25);m.setColorAt(i,tinte);
      // Guardar los valores ya redondeados del buffer permite restaurarlos exactamente.
      const matriz=m.instanceMatrix.array.slice(i*16,i*16+16);
      a.occlusion.slots.push({malla:m,indice:i,matriz});
      matrizInstancia.fromArray(matriz);cajaInstancia.copy(m.geometry.boundingBox).applyMatrix4(matrizInstancia);a.occlusion.caja.union(cajaInstancia);
    }
    for(const [zona,lista] of zonas){
      const troncos=new T.InstancedMesh(geometriaTronco,materialTronco,lista.length);
      const coniferas=new T.InstancedMesh(geometriaConifera,materialConifera,lista.filter(a=>a.conifera).length*3);
      const copas=new T.InstancedMesh(geometriaCopa,materialCopa,lista.filter(a=>!a.conifera).length*3);
      troncos.name='Bosque · troncos · '+zona;coniferas.name='Bosque · coníferas · '+zona;copas.name='Bosque · copas irregulares · '+zona;
      let nt=0,nc=0,nf=0;
      for(const a of lista){
      colocar(a,troncos,nt++,a.x,a.alto*.34-.025,a.z,1+a.alto*.055,a.alto*.68,1+a.alto*.055,a.giro,a.tono);
      if(a.conifera){
        for(let j=0;j<3;j++)colocar(a,coniferas,nc++,a.x,a.alto*(.43+j*.205),a.z,a.ancho*(1-j*.20),a.alto*(.58-j*.075),a.ancho*(.92-j*.18),a.giro+j*.27,a.tono);
      }else{
        for(let j=0;j<3;j++){const giro=a.giro+j*2.4,desvio=j?a.ancho*.40:0;colocar(a,copas,nf++,a.x+Math.cos(giro)*desvio,a.alto*(j?.71:.78),a.z+Math.sin(giro)*desvio,a.ancho*(j?.70:.92),a.alto*(j?.22:.27),a.ancho*(j?.72:.88),giro,Math.min(1,a.tono+j*.06));}
      }
      }
      for(const m of [troncos,coniferas,copas]){if(!m.count)continue;m.castShadow=m.receiveShadow=false;m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();m.matrixAutoUpdate=false;m.userData.oclusionModificada=false;lotes.push(m);raiz.add(m);}
    }
    // Segmentos cámara → pecho del héroe, en el espacio local del bosque. Se
    // reutilizan los vectores y las cajas; no hay raycasts ni recorridos de caras.
    const inversaRaiz=new T.Matrix4(),origenCamara=new T.Vector3(),segmentos=[],matrizOculta=new T.Matrix4(),escalaCero=new T.Vector3(0,0,0);
    const estadisticasOclusion={ocultos:0,cambiosUltimaActualizacion:0,objetivos:0};
    function intersectaSegmento(caja,s,margen){
      let entrada=0,salida=1;
      let minimo=caja.min.x-margen,maximo=caja.max.x+margen;
      if(s.dx===0){if(origenCamara.x<minimo||origenCamara.x>maximo)return false;}
      else{const a=(minimo-origenCamara.x)*s.ix,b=(maximo-origenCamara.x)*s.ix;entrada=Math.max(entrada,Math.min(a,b));salida=Math.min(salida,Math.max(a,b));if(entrada>salida)return false;}
      minimo=caja.min.y-margen;maximo=caja.max.y+margen;
      if(s.dy===0){if(origenCamara.y<minimo||origenCamara.y>maximo)return false;}
      else{const a=(minimo-origenCamara.y)*s.iy,b=(maximo-origenCamara.y)*s.iy;entrada=Math.max(entrada,Math.min(a,b));salida=Math.min(salida,Math.max(a,b));if(entrada>salida)return false;}
      minimo=caja.min.z-margen;maximo=caja.max.z+margen;
      if(s.dz===0){if(origenCamara.z<minimo||origenCamara.z>maximo)return false;}
      else{const a=(minimo-origenCamara.z)*s.iz,b=(maximo-origenCamara.z)*s.iz;entrada=Math.max(entrada,Math.min(a,b));salida=Math.min(salida,Math.max(a,b));if(entrada>salida)return false;}
      return true;
    }
    function actualizarOclusion(camara,posicionesObjetivo=[]){
      const cantidad=camara?posicionesObjetivo.length:0;
      estadisticasOclusion.objetivos=cantidad;estadisticasOclusion.cambiosUltimaActualizacion=0;
      if(cantidad){
        raiz.updateWorldMatrix(true,false);inversaRaiz.copy(raiz.matrixWorld).invert();
        camara.updateWorldMatrix(true,false);origenCamara.setFromMatrixPosition(camara.matrixWorld).applyMatrix4(inversaRaiz);
        for(let i=0;i<cantidad;i++){
          // El pequeño pool solo crece al aparecer un nuevo objetivo.
          if(!segmentos[i])segmentos[i]={fin:new T.Vector3(),dx:0,dy:0,dz:0,ix:0,iy:0,iz:0};
          const s=segmentos[i];s.fin.copy(posicionesObjetivo[i]);s.fin.y+=.9;s.fin.applyMatrix4(inversaRaiz);
          s.dx=s.fin.x-origenCamara.x;s.dy=s.fin.y-origenCamara.y;s.dz=s.fin.z-origenCamara.z;
          s.ix=s.dx===0?0:1/s.dx;s.iy=s.dy===0?0:1/s.dy;s.iz=s.dz===0?0:1/s.dz;
        }
      }
      for(const a of arboles){
        const o=a.occlusion,margen=o.oculto?1.15:.7;let ocultar=false;
        for(let i=0;i<cantidad&&!ocultar;i++)ocultar=intersectaSegmento(o.caja,segmentos[i],margen);
        if(ocultar===o.oculto)continue;
        o.oculto=ocultar;estadisticasOclusion.ocultos+=ocultar?1:-1;estadisticasOclusion.cambiosUltimaActualizacion++;
        for(const slot of o.slots){
          if(ocultar){matrizOculta.fromArray(slot.matriz).scale(escalaCero);slot.malla.setMatrixAt(slot.indice,matrizOculta);}
          else slot.malla.instanceMatrix.array.set(slot.matriz,slot.indice*16);
          slot.malla.userData.oclusionModificada=true;
        }
      }
      // Conservar los bounds originales del lote, también cuando está oculto.
      for(const m of lotes)if(m.userData.oclusionModificada){m.instanceMatrix.needsUpdate=true;m.userData.oclusionModificada=false;}
      return estadisticasOclusion.ocultos;
    }
    // El orden de las colisiones también permanece independiente de los lotes.
    if(abierto)for(const a of arboles)obstaculos.push({x:a.x,z:a.z,r:.34});
    raiz.updateMatrixWorld(true);
    return {grupo:raiz,arboles,actualizarOclusion,estadisticasOclusion,estadisticas:Object.freeze({arboles:arboles.length,capas:capas.map((_,i)=>arboles.filter(a=>a.capa===i).length),llamadas:raiz.children.length,zonas:zonas.size,radioInterior:inicio,radioExterior:fin})};
  }
  window.CAOZ_ARPG_BOSQUE=Object.freeze({fabrica});
})();

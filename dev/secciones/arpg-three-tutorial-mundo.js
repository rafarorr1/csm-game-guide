/* Camino del tutorial: s avanza hacia Tomsage; z mide el desvío del sendero.
   Encuentros físicos y paisaje determinista, sin luces ni físicas costosas por objeto. */
'use strict';
(function(){
  function crear(THREE,{escena,farol}={}){
    const C=Math.cos(Math.PI/6),S=.5,LARGO=85,BORDE=4,HOJA=3.05;
    const HUECO=Object.freeze({desde:52,hasta:55.5,semiancho:6.3,profundidad:8});
    const LIMITES=Object.freeze({basico:19,cargado:29,dash:39,parry:49,salto:61,torbellino:70,boomerang:76,ulti:83});
    const origen=new THREE.Vector3(-C*26-C*LARGO,0,13+S*LARGO);
    const grupo=new THREE.Group(),grupoPaisaje=new THREE.Group(),porton=new THREE.Group();
    grupo.name='Tutorial · camino del bosque a Tomsage';
    grupoPaisaje.name='Tutorial · paisaje desmontable';porton.name='Tutorial · portón de Tomsage';
    grupo.position.copy(origen);grupo.rotation.y=Math.PI/6;
    grupo.add(grupoPaisaje,porton);escena?.add(grupo);
    let semilla=147731,cierre=0,eliminado=false,activo=true,encuentroActual=null,ultimoTiempo=null;
    let aperturaHoyo=0,objetivoHoyo=0,cargaScenario=null;
    const barreras=[],escondites=[],sueloPartido=[];
    const azar=()=>{semilla=semilla*16807%2147483647;return (semilla-1)/2147483646;};
    const entre=(a,b)=>a+(b-a)*azar(),lim=(v,a,b)=>Math.max(a,Math.min(b,v));
    const bordeCamino=s=>BORDE-lim((s-80)/5,0,1);
    const geometria=new Set(),materiales=new Set(),texturas=new Set(),tramos=[],hojas=[],arboles=[];
    let arbolActual=null;
    const geo=g=>(geometria.add(g),g);
    const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,envMapIntensity:.12,...extra});materiales.add(m);return m;};
    const M={tierra:mat(0x28392d,{vertexColors:true}),camino:mat(0x75624b,{vertexColors:true}),
      madera:mat(0x5e4b37),pino:mat(0x294a3c),hoja:mat(0x3d5e45),roca:mat(0x68716a),
      hierba:mat(0x465c3d),hierro:mat(0x394144,{metalness:.55,roughness:.7}),
      luz:mat(0xc99850,{emissive:0xe9a649,emissiveIntensity:.65}),
      estrato:mat(0x3b3d31,{emissive:0x35402e,emissiveIntensity:.15}),fondo:mat(0x060907),cuerda:mat(0x8d7650),corte:mat(0x947957),anillo:mat(0x68553a)};
    const G={tronco:geo(new THREE.CylinderGeometry(.7,1,1,7)),copa:geo(new THREE.IcosahedronGeometry(1,1)),
      pino:geo(new THREE.ConeGeometry(1,1,9)),roca:geo(new THREE.IcosahedronGeometry(1,0)),
      caja:geo(new THREE.BoxGeometry(1,1,1)),corte:geo(new THREE.CircleGeometry(1,18)),anillo:geo(new THREE.RingGeometry(.72,.78,24))};
    // Los fragmentos comparten el material del camino, que multiplica el color de vértice.
    // Sin blanco explícito, WebGL toma el atributo ausente como negro y simula un hueco al cerrarse.
    G.caja.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(G.caja.attributes.position.count*3).fill(1),3));
    const objeto=new THREE.Object3D(),tinte=new THREE.Color(),ejeY=new THREE.Vector3(0,1,0),cajaPieza=new THREE.Box3();

    // Color pintado localmente: grano de tierra, huellas húmedas y hojarasca sin archivos externos.
    // La semilla de las texturas es independiente: retocar el color no redistribuye los árboles.
    if(typeof document!=='undefined'){
      let semillaTextura=91371;
      const rnd=()=>{semillaTextura=semillaTextura*16807%2147483647;return (semillaTextura-1)/2147483646;};
      function pintarSuelo(sendero){
        const n=sendero?512:256,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
        const ctx=canvas.getContext('2d'),imagen=ctx.createImageData(n,n);
        for(let y=0;y<n;y++)for(let x=0;x<n;x++){
          const u=x/n,v=y/n,onda=Math.sin(v*Math.PI*4)*.018+Math.sin(v*Math.PI*10)*.009;
          const ruido=(rnd()-.5)*21+Math.sin(u*43+Math.sin(v*Math.PI*6)*2)*5+Math.sin(u*113+v*Math.PI*22)*3;
          const mancha=Math.sin(u*19+Math.sin(v*Math.PI*2))*Math.cos(v*Math.PI*4)*9;
          const margen=sendero?lim((Math.abs(u-.5+onda)-.34)/.14,0,1):1;
          const rodadas=sendero?(Math.exp(-Math.pow((u-.31-onda)/.038,2))+Math.exp(-Math.pow((u-.66-onda)/.049,2)))*(.5+.5*Math.sin(v*Math.PI*4+.8))*13:0;
          const tierra=[137,113,82],pasto=[77,91,54],i=(y*n+x)*4;
          for(let k=0;k<3;k++)imagen.data[i+k]=tierra[k]*(1-margen)+pasto[k]*margen+ruido+mancha-rodadas;
          imagen.data[i+3]=255;
        }
        ctx.putImageData(imagen,0,0);
        for(let i=0;i<(sendero?1050:1550);i++){
          let x=rnd()*n,y=rnd()*n;
          if(sendero&&i%3)x=(rnd()<.5?rnd()*.2:.8+rnd()*.2)*n;
          ctx.save();ctx.translate(x,y);ctx.rotate(rnd()*Math.PI*2);
          ctx.fillStyle=(sendero?['#8e794daa','#70683baa','#ad8b55aa','#514c32aa']:['#7d874c80','#485d3980','#a09d6580'])[i%(sendero?4:3)];
          ctx.beginPath();ctx.ellipse(0,0,.65+rnd()*1.05,1.7+rnd()*3.2,0,0,Math.PI*2);ctx.fill();ctx.restore();
        }
        if(sendero)for(let i=0;i<360;i++){
          const x=rnd()*n,y=rnd()*n,r=.5+rnd()*1.6;
          ctx.fillStyle=i%3?'#a3988075':'#5f574880';ctx.beginPath();ctx.ellipse(x,y,r,r*.65,0,0,Math.PI*2);ctx.fill();
        }
        const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
        t.wrapS=sendero?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;
        texturas.add(t);return t;
      }
      M.camino.map=pintarSuelo(true);M.camino.color.setHex(0xffffff);
      M.tierra.map=pintarSuelo(false);M.tierra.color.setHex(0xffffff);
    }

    function punto(s,z=0){return new THREE.Vector3(origen.x+C*s+S*z,0,origen.z-S*s+C*z);}
    function coordenadas(p){const x=p.x-origen.x,z=p.z-origen.z;return {s:C*x-S*z,z:S*x+C*z};}
    function instancia(lista,x,y,z,sx,sy,sz,ry=0,tono=1){lista.push({x,y,z,sx,sy,sz,ry,tono,arbol:arbolActual});}
    function rama(lista,a,b,radio,tono=1){
      const direccion=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),l=direccion.length();
      lista.push({x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2,sx:radio,sy:l,sz:radio,
        q:new THREE.Quaternion().setFromUnitVectors(ejeY,direccion.normalize()),tono,arbol:arbolActual});
    }
    function lote(padre,nombre,g,m,lista){
      if(!lista.length)return null;
      const inst=new THREE.InstancedMesh(g,m,lista.length);inst.name=nombre;
      lista.forEach((a,i)=>{
        objeto.position.set(a.x,a.y,a.z);objeto.scale.set(a.sx,a.sy,a.sz);
        if(a.q)objeto.quaternion.copy(a.q);else objeto.rotation.set(0,a.ry||0,0);
        objeto.updateMatrix();inst.setMatrixAt(i,objeto.matrix);
        tinte.setRGB(a.tono,a.tono,a.tono);inst.setColorAt(i,tinte);
        if(a.arbol){
          if(!g.boundingBox)g.computeBoundingBox();
          cajaPieza.copy(g.boundingBox).applyMatrix4(objeto.matrix).translate(padre.position);
          a.arbol.occlusion.caja.union(cajaPieza);
          a.arbol.occlusion.slots.push({malla:inst,indice:i,matriz:inst.instanceMatrix.array.slice(i*16,i*16+16)});
        }
      });
      inst.instanceMatrix.needsUpdate=true;inst.instanceColor.needsUpdate=true;
      inst.castShadow=false;inst.receiveShadow=true;
      inst.computeBoundingBox();inst.computeBoundingSphere();inst.matrixAutoUpdate=false;
      padre.add(inst);return inst;
    }
    function superficie(nombre,filas,columnas,ubicar,material){
      const p=[],col=[],uv=[],indices=[];
      for(let i=0;i<=filas;i++)for(let j=0;j<=columnas;j++){
        const v=ubicar(i/filas,j/columnas);p.push(v[0],v[1],v[2]);
        uv.push(v[4]??v[0]/8,v[5]??v[2]/8);
        const valor=v[3]??1;col.push(valor,valor,valor);
      }
      for(let i=0;i<filas;i++)for(let j=0;j<columnas;j++){
        const a=i*(columnas+1)+j,b=a+columnas+1;
        indices.push(a,a+1,b,a+1,b+1,b);
      }
      // El talud izquierdo recorre z en sentido inverso; sus caras también deben mirar al cielo.
      if((p[5]-p[2])*(p[(columnas+1)*3]-p[0])<0)for(let i=0;i<indices.length;i+=3){
        const a=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=a;
      }
      const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
      const m=new THREE.Mesh(g,material);m.name=nombre;m.receiveShadow=true;grupoPaisaje.add(m);return m;
    }

    // El suelo se recorta de verdad: ninguna cara cruza el barranco bajo las losas que caen.
    function tierra(desde,hasta,z0=-42,z1=42){
      superficie('Bosque · tierra firme',Math.ceil((hasta-desde)/2),Math.ceil((z1-z0)/3),(u,v)=>{
        const x=desde+u*(hasta-desde),z=z0+v*(z1-z0),bosque=lim((Math.abs(z)-7)/6,0,1);
        const relieve=(Math.sin(x*.18+z*.27)*.28+Math.cos(z*.39-x*.12)*.2)*bosque;
        return [x,-.019+relieve,z,.79+.16*Math.sin(x*.13+z*.25)+azar()*.12];
      },M.tierra);
    }
    tierra(-20,HUECO.desde);tierra(HUECO.hasta,85);
    tierra(HUECO.desde,HUECO.hasta,-42,-HUECO.semiancho);
    tierra(HUECO.desde,HUECO.hasta,HUECO.semiancho,42);
    for(const [desde,hasta] of [[-1,HUECO.desde],[HUECO.hasta,85]]){
      superficie('Bosque · sendero de tierra',Math.ceil((hasta-desde)/1.6),6,(u,v)=>{
        const x=desde+u*(hasta-desde),z=(v-.5)*(bordeCamino(x)*2+1),borde=Math.abs(v-.5)*2;
        return [x,.016+Math.sin(x*.22)*.005,z,.9+.07*Math.sin(x*.24+v*8)-borde*.07+azar()*.07,v,(x+1)/8];
      },M.camino);
      for(const signo of [-1,1])superficie('Bosque · talud visible '+signo,Math.ceil(hasta-desde),4,(u,v)=>{
        const x=desde+u*(hasta-desde),dist=bordeCamino(x)+[0,.38,.93,1.48,2.1][Math.round(v*4)];
        const altura=[.035,.39,.49,.31,-.005][Math.round(v*4)],abertura=1-lim((x-78)/6,0,1)*.6;
        return [x,altura*abertura*(.84+.15*Math.sin(x*1.57)),signo*dist,.84+azar()*.14];
      },M.tierra);
    }
    const barranco=new THREE.Group();barranco.name='Salto · barranco de ocho metros';grupoPaisaje.add(barranco);
    const paredes=[],rocasBorde=[],raicesRotas=[],centroHoyo=(HUECO.desde+HUECO.hasta)/2;
    for(const x of [HUECO.desde-.15,HUECO.hasta+.15])instancia(paredes,x,-4,0,.3,8,HUECO.semiancho*2,0,.76);
    for(const z of [-HUECO.semiancho-.15,HUECO.semiancho+.15])instancia(paredes,centroHoyo,-4,z,HUECO.hasta-HUECO.desde,8,.3,0,.62);
    lote(barranco,'Salto · paredes profundas de roca',G.caja,M.estrato,paredes);
    const fondo=new THREE.Mesh(G.caja,M.fondo);fondo.position.set(centroHoyo,-8.1,0);fondo.scale.set(3.8,.15,12.8);barranco.add(fondo);
    for(const x of [HUECO.desde-.09,HUECO.hasta+.09])for(let z=-6;z<=6;z+=.7)instancia(rocasBorde,x,-.19,z,entre(.16,.32),entre(.23,.4),entre(.32,.52),entre(-.5,.5),entre(.65,.96));
    lote(barranco,'Salto · bordes irregulares de la grieta',G.roca,M.roca,rocasBorde);
    for(const [x,signo] of [[HUECO.desde,1],[HUECO.hasta,-1]])for(let j=0;j<6;j++){
      const z=-5.6+j*2.13;
      rama(raicesRotas,[x-signo*.25,-.12,z],[x+signo*entre(.24,.65),-.48,z+.2],entre(.07,.11),.72);
      rama(raicesRotas,[x,-.22,z],[x+signo*.13,-1.25,z+.35],.065,.66);
    }
    lote(barranco,'Salto · raíces rotas en el borde',G.tronco,M.madera,raicesRotas);
    // Un lote de fragmentos reemplaza el suelo antes de abrirse; caen dentro, no se estiran.
    const losas=[];
    for(let i=0;i<4;i++)for(let j=0;j<10;j++){
      const x=HUECO.desde+(i+.5)*(HUECO.hasta-HUECO.desde)/4,z=-HUECO.semiancho+(j+.5)*HUECO.semiancho/5;
      instancia(losas,x,-.18,z,(HUECO.hasta-HUECO.desde)/4,.4,HUECO.semiancho/5,0,entre(.82,1.03));
      sueloPartido.push({x,z,retardo:entre(0,.16),giro:entre(-1,1)});
    }
    const losasHoyo=lote(barranco,'Salto · fragmentos de sendero',G.caja,M.camino,losas);
    barranco.userData.hoyo=HUECO;

    // Helechos con frondas reales, en una única geometría compartida por todos los tramos.
    {const p=[];
      for(let k=0;k<7;k++){
        const a=k*Math.PI*2/7,dx=Math.cos(a),dz=Math.sin(a),nx=-dz,nz=dx;
        for(let j=0;j<4;j++){
          const t=j/4,tt=(j+1)/4,w=(1-t)*.15,y=.1+Math.sin(t*Math.PI)*.43,yy=.1+Math.sin(tt*Math.PI)*.43;
          p.push(dx*t-nx*w,y,dz*t-nz*w,dx*t+nx*w,y,dz*t+nz*w,dx*tt,yy,dz*tt);
        }
      }
      G.helecho=geo(new THREE.BufferGeometry());G.helecho.setAttribute('position',new THREE.Float32BufferAttribute(p,3));G.helecho.computeVertexNormals();
      M.hierba.side=THREE.DoubleSide;
    }
    let numeroArboles=0;
    for(let indice=0;indice<8;indice++){
      const inicio=-14+indice*12,fin=indice===7?92:inicio+12,centro=(inicio+fin)/2,tramo=new THREE.Group();
      tramo.position.x=centro;tramo.name='Bosque · tramo '+(indice+1);grupoPaisaje.add(tramo);tramos.push({grupo:tramo,inicio,fin});
      const madera=[],pinos=[],copas=[],piedras=[],helechos=[],hierro=[],luces=[];
      // La última aproximación permanece abierta para leer el portón y las murallas.
      const cantidad=fin>70?52:82;
      for(let n=0;n<cantidad;n++){
        const s=entre(inicio,Math.min(fin,79));if(s>75&&azar()<.7)continue;
        const lado=n%2?1:-1,z=lado*entre(s>72?12:7.1,35),x=s-centro;
        const alto=entre(6.8,12.6),ancho=entre(1.45,2.75),radio=entre(.22,.43),giro=entre(0,Math.PI*2),tono=entre(.76,1.17);
        const conifera=azar()<.68;arbolActual={x:s,z,alto,ancho,conifera,giro};
        Object.defineProperty(arbolActual,'occlusion',{value:{caja:new THREE.Box3(),slots:[],oculto:false}});arboles.push(arbolActual);
        instancia(madera,x,alto*.34,z,radio,alto*.68,radio,giro,tono);
        if(conifera){
          for(let j=0;j<3;j++)instancia(pinos,x,alto*(.47+j*.175),z,ancho*(1-j*.22),alto*(.57-j*.08),ancho*(1-j*.22),giro+j*.36,tono);
        }else{
          for(let j=0;j<3;j++){
            const a=giro+j*2.4,d=j?ancho*.45:0;
            instancia(copas,x+Math.cos(a)*d,alto*(j?.78:.88),z+Math.sin(a)*d,ancho*(j?.8:1),alto*.23,ancho*(j?.82:1),a,tono);
          }
          if(Math.abs(z)<12)rama(madera,[x,alto*.48,z],[x+Math.sin(giro)*1.2,alto*.72,z+Math.cos(giro)*1.3],radio*.46,tono);
        }
        if(Math.abs(z)<12)for(let r=0;r<3;r++){
          const a=giro+r*2.1,longitud=entre(.85,1.8);
          rama(madera,[x,.3,z],[x+Math.cos(a)*longitud,.05,z+Math.sin(a)*longitud],radio*.44,tono);
        }
        numeroArboles++;arbolActual=null;
      }
      for(let s=Math.max(.65,inicio+.3);s<Math.min(fin,92);s+=1.1){
        for(const lado of [-1,1]){
          const ancho=entre(.32,.67),x=s-centro,borde=bordeCamino(s);
          const y=entre(.1,.21),sx=entre(.5,.96),sy=entre(.25,.54),giro=entre(-.9,.9),tono=entre(.69,1.08);
          const desvio=Math.sin(s*41.9+lado*2.7)*.25,fuera=.16+.14*Math.sin(s*17.3+lado),escala=.83+.21*Math.sin(s*5.6-lado);
          instancia(piedras,x+desvio,y,lado*(borde+ancho+fuera),sx,sy*escala,ancho,giro,tono);
          if(s<82){
            if(azar()<.55)rama(madera,[x-.7,.16,lado*(borde+.03)],[x+.9,.24,lado*(borde+.65)],.11,entre(.8,1.2));
            instancia(helechos,x+entre(-.4,.4),.05,lado*(borde+entre(.55,2.5)),entre(.65,1.1),entre(.7,1.25),entre(.7,1.15),azar()*6.28,entre(.72,1.12));
            if(azar()<.45)instancia(copas,x,.4,lado*(borde+entre(1.8,3.2)),entre(.6,1),entre(.45,.85),entre(.5,1),azar()*6.28,entre(.6,.9));
          }
        }
      }
      // Una estación discreta cada diez metros; la silueta se reconoce incluso de noche.
      for(let s=10;s<=80;s+=10)if(s>=inicio&&s<fin){
        const lado=(s/10)%2?1:-1,x=s-centro,z=lado*4.85;
        instancia(piedras,x,.38,z,.42,.52,.38,.2,1.04);
        instancia(madera,x,1.03,z,.09,1.55,.09,0,.83);
        instancia(hierro,x,1.9,z,.34,.08,.34);
        instancia(hierro,x,2.32,z,.4,.12,.4);
        instancia(luces,x,2.11,z,.19,.27,.19);
        for(const dx of [-.14,.14])for(const dz of [-.14,.14])instancia(hierro,x+dx,2.1,z+dz,.026,.4,.026);
      }
      lote(tramo,'Bosque · troncos y raíces',G.tronco,M.madera,madera);
      lote(tramo,'Bosque · pinos',G.pino,M.pino,pinos);
      lote(tramo,'Bosque · copas y matorral',G.copa,M.hoja,copas);
      lote(tramo,'Bosque · rocas del margen',G.roca,M.roca,piedras);
      lote(tramo,'Bosque · helechos',G.helecho,M.hierba,helechos);
      lote(tramo,'Bosque · faroles',G.caja,M.hierro,hierro);
      lote(tramo,'Bosque · brasas de los faroles',G.caja,M.luz,luces);
    }
    // La misma pieza de Scenario que ilumina las casas, compartiendo mapas y shader de la vela.
    if(farol?.geometry&&farol?.material){
      const g=geo(farol.geometry.clone());g.computeBoundingBox();
      const caja=g.boundingBox,centro=caja.getCenter(new THREE.Vector3()),escala=.94/(caja.max.y-caja.min.y);
      g.translate(-centro.x,-caja.min.y,-centro.z);g.scale(escala,escala,escala);
      const lista=[];for(let s=10;s<=80;s+=10)instancia(lista,s,1.64,((s/10)%2?1:-1)*4.85,1,1,1,s*.7,1);
      lote(grupoPaisaje,'Bosque · faroles de Scenario con vela',g,farol.material,lista);
      grupoPaisaje.traverse(o=>{if(o.name==='Bosque · faroles'||o.name==='Bosque · brasas de los faroles')o.visible=false;});
    }

    // El borde inicial se ve: árboles caídos y roca cierran el camino por detrás de s=0.
    {const madera=[],piedras=[],cortes=[],anillos=[];
      const a=[-.82,.47,-5.05],b=[-.35,.66,4.73];
      rama(madera,a,b,.58,.93);
      rama(madera,[-1.44,.85,-4.32],[-1.12,1.19,1.46],.24,.79);
      rama(madera,[-.7,.72,-2.35],[-1.96,1.45,-1.52],.21,.88);
      rama(madera,[-1.94,1.44,-1.53],[-2.56,1.54,-.22],.11,.85);
      rama(madera,[-.43,.83,2.76],[-1.27,1.05,3.81],.15,.92);
      // La madera expuesta explica el árbol quebrado; evita extremos planos negros.
      const dir=new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a)).normalize();
      for(const [p,signo,r] of [[a,-1,.58],[b,1,.406]]){
        const normal=dir.clone().multiplyScalar(signo),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
        const pos=new THREE.Vector3().fromArray(p).addScaledVector(normal,.012);
        cortes.push({x:pos.x,y:pos.y,z:pos.z,sx:r,sy:r,sz:1,q,tono:1});
        for(const escala of [.31,.63,.94])anillos.push({x:pos.x+normal.x*.005,y:pos.y+normal.y*.005,z:pos.z+normal.z*.005,sx:r*escala,sy:r*escala,sz:1,q,tono:.86+escala*.1});
      }
      for(const lado of [-1,1]){
        instancia(piedras,-.2,.65,lado*4.2,1.1,.9,1.2,.3,1);
        rama(madera,[-.55,1.1,lado*2],[-1.5,2,lado*3.4],.19,.94);
      }
      lote(grupoPaisaje,'Inicio · troncos caídos',G.tronco,M.madera,madera);
      lote(grupoPaisaje,'Inicio · rocas junto a los troncos',G.roca,M.roca,piedras);
      lote(grupoPaisaje,'Inicio · madera clara quebrada',G.corte,M.corte,cortes);
      lote(grupoPaisaje,'Inicio · anillos de crecimiento',G.anillo,M.anillo,anillos);
    }

    // Los goblins usan refugios reconocibles: raíces, troncos huecos y roca con helechos.
    // Las entradas miran al camino; así puede leerse la procedencia de cada emboscada.
    {const madera=[],piedras=[],matorral=[],helechos=[];
      for(const [id,s,z] of [['dash',31,-4.8],['dash',33,4.8],['torbellino',62,-4.8],['torbellino',64,4.8],['torbellino',66,-4.7]]){
        const lado=Math.sign(z),x=s;
        rama(madera,[x-1.6,.36,z],[x+1.3,.49,z+lado*.3],.44,.87);
        rama(madera,[x-1.1,.22,z-lado*.25],[x-.3,1.24,z+lado*.65],.18,.75);
        instancia(piedras,x+.7,.55,z+lado*.45,.95,.85,.82,.4,.73);
        instancia(matorral,x-.55,.68,z+lado*.45,1.13,.88,1.08,.6,.86);
        instancia(helechos,x+.15,.1,z-lado*.42,1.2,1.3,1.2,-lado*.6,1.03);
        escondites.push(Object.freeze({id,s,z,punto:punto(s,z),salida:punto(s,lado*3.1)}));
      }
      lote(grupoPaisaje,'Emboscadas · troncos de los escondites',G.tronco,M.madera,madera);
      lote(grupoPaisaje,'Emboscadas · rocas de los escondites',G.roca,M.roca,piedras);
      lote(grupoPaisaje,'Emboscadas · matorral de los escondites',G.copa,M.hoja,matorral);
      lote(grupoPaisaje,'Emboscadas · helechos de los escondites',G.helecho,M.hierba,helechos);
    }
    // Barricadas físicas: al resolver el encuentro, sus dos mitades se abren hacia los márgenes.
    // Todas comparten dos lotes; ningún tablón añade una llamada de dibujo individual.
    const maderaBarreras=[],cuerdasBarreras=[];
    for(const [id,s] of Object.entries(LIMITES)){
      const b={id,s,apertura:0,objetivo:0,slots:[]};barreras.push(b);
      for(const lado of [-1,1]){
        const z=lado*2.1;
        const agregar=(lista,crear)=>{const inicio=lista.length;crear();for(let j=inicio;j<lista.length;j++){lista[j].barrera=b;lista[j].lado=lado;}};
        agregar(maderaBarreras,()=>{
          for(const altura of [.43,1.09])rama(maderaBarreras,[s,altura,lado*.06],[s+.08,altura+.12,lado*4.08],.13,.83);
          for(let k=0;k<5;k++){
            const zz=lado*(.38+k*.79),y=1.15+Math.sin(k*2.2)*.14;
            rama(maderaBarreras,[s-.06,.12,zz],[s+.12,y,zz+lado*.08],.105,.89+k*.02);
          }
          rama(maderaBarreras,[s-.12,.18,lado*.18],[s+.05,1.17,lado*4],.075,.68);
        });
        agregar(cuerdasBarreras,()=>{for(const zz of [lado*.4,lado*3.55])instancia(cuerdasBarreras,s-.13,.83,zz,.31,.18,.19,0,.87);});
      }
    }
    const loteBarreraMadera=lote(grupoPaisaje,'Camino · barreras articuladas de los goblins',G.tronco,M.madera,maderaBarreras);
    const loteBarreraCuerdas=lote(grupoPaisaje,'Camino · cuerdas de las barricadas',G.caja,M.cuerda,cuerdasBarreras);
    for(const [malla,lista] of [[loteBarreraMadera,maderaBarreras],[loteBarreraCuerdas,cuerdasBarreras]])lista.forEach((p,i)=>{
      const matriz=new THREE.Matrix4();malla.getMatrixAt(i,matriz);p.barrera.slots.push({malla,indice:i,matriz,lado:p.lado});
    });
    // El hacha pasa por encima; el cuerpo debe quedarse en este lado de las zarzas.
    const zarzas=new THREE.Group();zarzas.name='Búmeran · tronco caído y zarzas';grupoPaisaje.add(zarzas);zarzas.visible=false;
    {const ramas=[],piedras=[],hojas=[];
      rama(ramas,[73.55,.28,-4.2],[73.62,.43,4.2],.36,.86);
      for(let z=-3.9;z<=4;z+=.85){
        rama(ramas,[73.55,.36,z],[73.46,.95,z+.32],.052,.84);
        instancia(hojas,73.55,.44,z,.42,.43,.65,z*.3,.82);
      }
      for(const z of [-4.1,4.1])instancia(piedras,73.55,.23,z,.48,.39,.58,.4,.85);
      lote(zarzas,'Búmeran · tronco atravesado',G.tronco,M.madera,ramas);
      lote(zarzas,'Búmeran · espinos',G.copa,M.hoja,hojas);
      lote(zarzas,'Búmeran · extremos del tronco',G.roca,M.roca,piedras);
    }

    // Dos hojas independientes: abiertas se pliegan hacia la ciudad; cerradas forman una reja sólida.
    {const pilares=[],herrajes=[],lamparas=[];
      for(const lado of [-1,1]){
        instancia(pilares,85,1.9,lado*3.3,.9,3.8,.6,0,.93);
        instancia(pilares,85,.2,lado*3.3,1.08,.4,.6,0,1.06);
        instancia(pilares,85,3.82,lado*3.3,1.02,.22,.72,0,1.03);
        instancia(herrajes,84.47,2.58,lado*3.3,.27,.58,.32);
        instancia(lamparas,84.3,2.6,lado*3.3,.16,.34,.22);
        const hoja=new THREE.Group(),barrotes=[],tablas=[];hoja.position.set(85,0,lado*HOJA);
        hoja.name=lado<0?'Portón · hoja izquierda':'Portón · hoja derecha';porton.add(hoja);
        // z=0 es la bisagra. El extremo libre llega exactamente al centro del vano.
        instancia(tablas,0,.56,-lado*HOJA/2,.2,.98,HOJA,0,.88);
        for(const altura of [.15,1.15,3.36])instancia(barrotes,-.025,altura,-lado*HOJA/2,.26,.15,HOJA);
        for(let j=0;j<=10;j++)instancia(barrotes,0,1.86,-lado*j*HOJA/10,.12,3.45,.085);
        for(let j=0;j<4;j++)instancia(tablas,-.025,.59,-lado*HOJA*(.125+j*.25),.23,.88,.055,0,.7);
        lote(hoja,'Portón · forja',G.caja,M.hierro,barrotes);
        lote(hoja,'Portón · zócalo de roble',G.caja,M.madera,tablas);
        hojas.push({grupo:hoja,lado});
      }
      lote(porton,'Portón · jambas',G.caja,M.roca,pilares);
      lote(porton,'Portón · faroles de entrada',G.caja,M.hierro,herrajes);
      lote(porton,'Portón · velas de entrada',G.caja,M.luz,lamparas);
    }
    function puerta(valor){
      if(eliminado)return cierre;
      cierre=lim(Number.isFinite(valor)?valor:cierre,0,1);
      for(const h of hojas)h.grupo.rotation.y=-h.lado*(1-cierre)*Math.PI/2;
      porton.userData.cierre=cierre;porton.updateMatrixWorld(true);return cierre;
    }
    const giroBarrera=new THREE.Matrix4(),traslacionBarrera=new THREE.Matrix4(),matrizBarrera=new THREE.Matrix4();
    const cargaMateriales={lista:false,cargados:0,errores:[],triangulosFollaje:0,arbolesScenario:0};
    function encuentro(id){
      if(eliminado||encuentroActual===id)return estado();
      const primero=encuentroActual===null&&id==='mover';encuentroActual=id||null;
      objetivoHoyo=id==='salto'?1:0;
      zarzas.visible=id==='boomerang';
      for(const b of barreras){b.objetivo=b.id===id?0:1;if(primero)b.apertura=b.objetivo;}
      animarEncuentro(0,true);return estado();
    }
    function estado(){
      return {encuentro:encuentroActual,limiteS:LIMITES[encuentroActual]??null,
        hoyo:{...HUECO,apertura:aperturaHoyo,abierto:objetivoHoyo===1},
        obstaculoBumeran:zarzas.visible,escenario:{...cargaMateriales,errores:[...cargaMateriales.errores]}};
    }
    function animarEncuentro(dt,forzar=false){
      const anterior=aperturaHoyo;
      aperturaHoyo+=Math.sign(objetivoHoyo-aperturaHoyo)*Math.min(Math.abs(objetivoHoyo-aperturaHoyo),dt/(objetivoHoyo?.6:.65));
      if(anterior!==aperturaHoyo||forzar){
        losasHoyo.visible=aperturaHoyo<.995;
        sueloPartido.forEach((p,i)=>{
          const t=lim((aperturaHoyo-p.retardo)/(1-p.retardo),0,1),caida=t*t;
          objeto.position.set(p.x,-.18-caida*9.4,p.z);objeto.rotation.set(t*p.giro*.55,0,t*p.giro*.8);
          objeto.scale.set((HUECO.hasta-HUECO.desde)/4,.4,HUECO.semiancho/5);objeto.updateMatrix();losasHoyo.setMatrixAt(i,objeto.matrix);
        });
        losasHoyo.instanceMatrix.needsUpdate=true;
      }
      for(const b of barreras){
        const antes=b.apertura;b.apertura+=Math.sign(b.objetivo-b.apertura)*Math.min(Math.abs(b.objetivo-b.apertura),dt*1.7);
        if(antes===b.apertura&&!forzar)continue;
        const abrir=b.apertura*b.apertura*(3-2*b.apertura);
        for(const p of b.slots){
          giroBarrera.makeRotationY(-p.lado*abrir*Math.PI*.49);
          traslacionBarrera.makeTranslation(b.s,0,p.lado*4.12);matrizBarrera.copy(traslacionBarrera).multiply(giroBarrera);
          traslacionBarrera.makeTranslation(-b.s,0,-p.lado*4.12);matrizBarrera.multiply(traslacionBarrera).multiply(p.matriz);
          p.malla.setMatrixAt(p.indice,matrizBarrera);p.malla.instanceMatrix.needsUpdate=true;
        }
      }
    }
    function limitar(p,r=.45,{saltando=false,desde,obstaculos=true}={}){
      if(eliminado||!activo)return p;
      const c=coordenadas(p),radio=lim(Number.isFinite(r)?r:.45,0,2.99),previa=desde?coordenadas(desde):null;
      c.z=lim(c.z,-bordeCamino(c.s)+radio,bordeCamino(c.s)-radio);c.s=Math.max(radio,c.s);
      // La barricada que se ve al fondo delimita el encuentro, también durante un salto.
      const limite=LIMITES[encuentroActual];if(obstaculos&&Number.isFinite(limite))c.s=Math.min(c.s,limite-radio-.22);
      if(obstaculos&&zarzas.visible&&c.s>73.55-radio-.34&&c.s<73.55+radio+.34)c.s=previa?.s>73.55?73.55+radio+.34:73.55-radio-.34;
      if(obstaculos&&!saltando&&objetivoHoyo&&c.s>HUECO.desde-radio&&c.s<HUECO.hasta+radio){
        const lado=previa?previa.s>HUECO.hasta: c.s>(HUECO.desde+HUECO.hasta)/2;
        c.s=lado?HUECO.hasta+radio:HUECO.desde-radio;
      }
      // Colisión contra cada hoja real, también mientras gira. No hay límite de avance oculto.
      for(const h of hojas){
        const a=h.grupo.rotation.y,z0=h.lado*HOJA,dx=-h.lado*HOJA*Math.sin(a),dz=-h.lado*HOJA*Math.cos(a);
        const t=lim(((c.s-85)*dx+(c.z-z0)*dz)/(HOJA*HOJA),0,1),sx=85+t*dx,sz=z0+t*dz;
        let nx=c.s-sx,nz=c.z-sz;const d=Math.hypot(nx,nz),m=radio+.13;
        if(d<m){if(d>1e-6){nx/=d;nz/=d;}else{nx=c.s>=85?1:-1;nz=0;}c.s=sx+nx*m;c.z=sz+nz*m;}
      }
      c.z=lim(c.z,-bordeCamino(c.s)+radio,bordeCamino(c.s)-radio);
      p.x=origen.x+C*c.s+S*c.z;p.z=origen.z-S*c.s+C*c.z;return p;
    }
    function actualizar({s=0,tiempo=0,abierta}={}){
      if(eliminado)return;
      if(typeof abierta==='boolean')puerta(abierta?0:1);
      const avance=Number.isFinite(s)?s:0,ahora=Number.isFinite(tiempo)?tiempo:0;
      const dt=ultimoTiempo===null?0:Math.max(0,Math.min(.1,ahora-ultimoTiempo));ultimoTiempo=ahora;
      animarEncuentro(dt);
      // Además del frustum de cada lote, se retiran tramos ya lejanos por detrás.
      for(const t of tramos)t.grupo.visible=t.fin>avance-44&&t.inicio<avance+72;
      M.luz.emissiveIntensity=.62+Math.sin(ahora*4.1)*.04;
    }
    function follaje(tipo){
      const p=[],uv=[],cx=tipo==='pino'||tipo==='helecho'?0:.5,cy=tipo==='pino'||tipo==='hoja'?.5:0;
      function plano(x,y,z,ancho,alto,giro,inclina=0){
        const dx=Math.cos(giro)*ancho/2,dz=Math.sin(giro)*ancho/2,ix=Math.sin(giro)*inclina,iz=-Math.cos(giro)*inclina;
        p.push(x-dx,y-alto/2,z-dz,x+dx,y-alto/2,z+dz,x+dx+ix,y+alto/2,z+dz+iz,
          x-dx,y-alto/2,z-dz,x+dx+ix,y+alto/2,z+dz+iz,x-dx+ix,y+alto/2,z-dz+iz);
        const m=.007;uv.push(cx+m,cy+m,cx+.5-m,cy+m,cx+.5-m,cy+.5-m,cx+m,cy+m,cx+.5-m,cy+.5-m,cx+m,cy+.5-m);
      }
      if(tipo==='pino')for(let k=0;k<3;k++)for(let j=0;j<5;j++){
        const a=j*Math.PI*2/5+k*.51,r=(1-k*.28)*.5;
        plano(Math.cos(a)*r,-.32+k*.27,Math.sin(a)*r,(1-k*.23)*1.35,.48,a+Math.PI/2,.28);
      }
      else if(tipo==='hoja')for(let k=0;k<3;k++)for(let j=0;j<5;j++){
        const a=j*Math.PI*2/5+k*.55,r=k===1?.67:.41;
        plano(Math.cos(a)*r,-.55+k*.55,Math.sin(a)*r,1.25,1.15,a+Math.PI/2,.18);
      }
      else for(let j=0;j<3;j++)plano(0,.37,0,1.85,.86,j*Math.PI/3,.16);
      const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
      cargaMateriales.triangulosFollaje+=p.length/9;return g;
    }
    function precargar({ruta='./bosque-scenario/'}={}){
      if(cargaScenario)return cargaScenario;
      if(eliminado)return Promise.resolve(estado().escenario);
      const cargar=(archivo,color=false)=>new Promise((resolver,rechazar)=>{
        const t=new THREE.TextureLoader().load(ruta+archivo,()=>{if(eliminado){t.dispose();resolver(null);return;}cargaMateriales.cargados++;resolver(t);},undefined,rechazar);
        t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;texturas.add(t);
        t.wrapS=t.wrapT=archivo.includes('atlas')?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
      });
      const material=(nombre,destinos)=>Promise.all(['color','normal','superficie'].map(k=>cargar(nombre+'-'+k+'.webp',k==='color'))).then(([mapa,normal,superficie])=>{
        if(eliminado||!mapa)return;
        for(const m of destinos){
          m.map=mapa;m.normalMap=normal;m.roughnessMap=superficie;m.metalness=0;m.normalScale.setScalar(m===M.camino?.16:m===M.estrato?.18:.32);
          if(m===M.camino)m.color.setRGB(1.24,1.16,1.04);else m.color.setHex(m===M.estrato?0x787d6a:m===M.tierra?0xbac6b8:0xffffff);
          m.needsUpdate=true;
        }
      });
      const tareas=[material('suelo',[M.tierra,M.camino]),material('corteza',[M.madera]),material('roca',[M.roca,M.estrato])];
      tareas.push(cargar('follaje-atlas.webp',true).then(atlas=>{
        if(eliminado||!atlas)return;
        const gp=follaje('pino'),gh=follaje('hoja'),gf=follaje('helecho');
        for(const m of [M.pino,M.hoja,M.hierba]){m.map=m.emissiveMap=atlas;m.alphaTest=.45;m.side=THREE.DoubleSide;m.transparent=false;m.depthWrite=true;m.color.setHex(0xffffff);m.emissive.setHex(0xaeb9a7);m.emissiveIntensity=.035;m.needsUpdate=true;}
        // Los volúmenes de culling deben incluir también árboles ocultos temporalmente por la cámara.
        for(const a of arboles)if(a.occlusion.oculto)for(const p of a.occlusion.slots)p.malla.instanceMatrix.array.set(p.matriz,p.indice*16);
        grupoPaisaje.traverse(o=>{
          if(!o.isMesh)return;let sustituido=true;
          if(o.geometry===G.pino)o.geometry=gp;else if(o.geometry===G.copa)o.geometry=gh;else if(o.geometry===G.helecho)o.geometry=gf;else sustituido=false;
          if(sustituido&&o.isInstancedMesh){o.computeBoundingBox();o.computeBoundingSphere();}
        });
        for(const a of arboles)if(a.occlusion.oculto)for(const p of a.occlusion.slots){p.malla.instanceMatrix.array.fill(0,p.indice*16,p.indice*16+12);p.malla.instanceMatrix.needsUpdate=true;}
        // Conserva la oclusión exacta después de ampliar las ramas con sus siluetas reales.
        const matriz=new THREE.Matrix4();
        for(const a of arboles){a.occlusion.caja.makeEmpty();for(const p of a.occlusion.slots){
          const g=p.malla.geometry;if(!g.boundingBox)g.computeBoundingBox();matriz.fromArray(p.matriz);
          cajaPieza.copy(g.boundingBox).applyMatrix4(matriz).translate(p.malla.parent.position);a.occlusion.caja.union(cajaPieza);
        }}
      }));
      // Las mallas completas se reservan para seis primeros planos por especie disponible.
      // Las siluetas lejanas siguen siendo tarjetas instanciadas; nunca se clona un material por árbol.
      for(const tipo of ['pino','roble']){
        const datos=window.CAOZ_BOSQUE_ARBOLES_DATOS?.[tipo];if(!datos)continue;
        tareas.push(Promise.all([cargar(tipo+'-color.webp',true),cargar(tipo+'-normal.webp')]).then(([mapa,normal])=>{
          if(eliminado||!mapa)return;
          mapa.flipY=normal.flipY=false;mapa.needsUpdate=normal.needsUpdate=true;
          const decodificar=(s,Tipo)=>new Tipo(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer),g=geo(new THREE.BufferGeometry());
          for(const [nombre,n] of [['position',3],['normal',3],['uv',2]])g.setAttribute(nombre,new THREE.BufferAttribute(decodificar(datos[nombre],Float32Array),n));
          if(datos.index)g.setIndex(new THREE.BufferAttribute(decodificar(datos.index,Uint16Array),1));
          g.computeBoundingBox();g.computeBoundingSphere();
          const material=mat(0xffffff,{map:mapa,normalMap:normal,normalScale:new THREE.Vector2(.4,.4),roughness:.98,envMapIntensity:.06});
          const candidatos=arboles.filter(a=>a.conifera===(tipo==='pino')&&Math.abs(a.z)<14&&a.x>1&&a.x<80),elegidos=[],usados=new Set();
          for(const [i,s] of [6,20,34,48,62,74].entries()){
            const lado=i%2?1:-1,dist=a=>Math.pow(a.x-s,2)+Math.pow(a.z-lado*9,2)*2;
            const a=candidatos.filter(a=>!usados.has(a)).sort((a,b)=>dist(a)-dist(b))[0];if(a){usados.add(a);elegidos.push(a);}
          }
          if(!elegidos.length)return;
          const malla=new THREE.InstancedMesh(g,material,elegidos.length);malla.name='Bosque · '+tipo+'s cercanos de Scenario';
          elegidos.forEach((a,i)=>{
            for(const slot of a.occlusion.slots){const buffer=slot.malla.instanceMatrix;buffer.array.fill(0,slot.indice*16,slot.indice*16+12);buffer.needsUpdate=true;}
            const altura=lim(a.alto*.8,7.4,8.8);
            objeto.position.set(a.x,0,a.z);objeto.scale.setScalar(altura);objeto.rotation.set(0,a.giro,0);objeto.updateMatrix();malla.setMatrixAt(i,objeto.matrix);
            a.occlusion.slots=[{malla,indice:i,matriz:new Float32Array(objeto.matrix.elements)}];a.occlusion.oculto=false;
            a.occlusion.caja.copy(g.boundingBox).applyMatrix4(objeto.matrix);cargaMateriales.arbolesScenario++;
          });
          malla.castShadow=false;malla.receiveShadow=true;malla.computeBoundingBox();malla.computeBoundingSphere();malla.matrixAutoUpdate=false;grupoPaisaje.add(malla);
        }));
      }
      cargaScenario=Promise.allSettled(tareas).then(r=>{cargaMateriales.lista=true;cargaMateriales.errores=r.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason));return estado().escenario;});
      return cargaScenario;
    }
    const inversaOclusion=new THREE.Matrix4(),camaraLocal=new THREE.Vector3(),objetivosLocales=[];
    const oclusion={arboles:arboles.length,ocultos:0,cambios:0};
    // Segmento contra caja, con escalares: no se recorren triángulos ni se crean objetos por árbol.
    function obstruye(caja,p,margen){
      let desde=0,hasta=1,d=p.x-camaraLocal.x,a,b;
      if(Math.abs(d)<1e-8){if(camaraLocal.x<caja.min.x-margen||camaraLocal.x>caja.max.x+margen)return false;}
      else{a=(caja.min.x-margen-camaraLocal.x)/d;b=(caja.max.x+margen-camaraLocal.x)/d;desde=Math.max(desde,Math.min(a,b));hasta=Math.min(hasta,Math.max(a,b));if(desde>hasta)return false;}
      d=p.y-camaraLocal.y;
      if(Math.abs(d)<1e-8){if(camaraLocal.y<caja.min.y-margen||camaraLocal.y>caja.max.y+margen)return false;}
      else{a=(caja.min.y-margen-camaraLocal.y)/d;b=(caja.max.y+margen-camaraLocal.y)/d;desde=Math.max(desde,Math.min(a,b));hasta=Math.min(hasta,Math.max(a,b));if(desde>hasta)return false;}
      d=p.z-camaraLocal.z;
      if(Math.abs(d)<1e-8)return camaraLocal.z>=caja.min.z-margen&&camaraLocal.z<=caja.max.z+margen;
      a=(caja.min.z-margen-camaraLocal.z)/d;b=(caja.max.z+margen-camaraLocal.z)/d;
      return Math.max(desde,Math.min(a,b))<=Math.min(hasta,Math.max(a,b));
    }
    function actualizarOclusion(camara,posicionesObjetivo){
      if(eliminado)return 0;
      let cantidad=0;
      if(camara&&activo&&posicionesObjetivo?.length){
        grupo.updateWorldMatrix(true,false);inversaOclusion.copy(grupo.matrixWorld).invert();
        camara.getWorldPosition(camaraLocal).applyMatrix4(inversaOclusion);
        for(const p of posicionesObjetivo){
          if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z))continue;
          const local=objetivosLocales[cantidad]||(objetivosLocales[cantidad]=new THREE.Vector3());
          local.copy(p);local.y+=.9;local.applyMatrix4(inversaOclusion);cantidad++;
        }
      }
      let ocultos=0,cambios=0;
      for(const a of arboles){
        const o=a.occlusion,margen=o.oculto?1.15:.7;
        // Un primer plano pegado al objetivo de cámara no debe ocupar media pantalla con hojas.
        let ocultar=cantidad>0&&o.caja.distanceToPoint(camaraLocal)<(o.oculto?9:8);
        for(let i=0;i<cantidad&&!ocultar;i++)ocultar=obstruye(o.caja,objetivosLocales[i],margen);
        if(ocultar)ocultos++;
        if(ocultar===o.oculto)continue;
        o.oculto=ocultar;cambios++;
        for(const slot of o.slots){
          const buffer=slot.malla.instanceMatrix,inicio=slot.indice*16;
          if(ocultar)buffer.array.fill(0,inicio,inicio+12);else buffer.array.set(slot.matriz,inicio);
          buffer.needsUpdate=true;
        }
      }
      oclusion.ocultos=ocultos;oclusion.cambios=cambios;return ocultos;
    }
    function activar(v,{conservarPuerta=false}={}){
      if(eliminado)return;
      activo=!!v;grupo.visible=activo||!!conservarPuerta;
      grupoPaisaje.visible=activo;porton.visible=activo||!!conservarPuerta;
      if(!activo)actualizarOclusion(null,null);
    }
    function dispose(){
      if(eliminado)return;eliminado=true;
      grupo.removeFromParent();grupo.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
      for(const g of geometria)g.dispose();for(const m of materiales)m.dispose();for(const t of texturas)t.dispose();grupo.clear();
    }
    puerta(0);grupo.updateMatrixWorld(true);
    return {grupo,grupoPaisaje,porton,punto,coordenadas,limitar,actualizar,actualizarOclusion,oclusion,arboles,puerta,activar,dispose,encuentro,estado,precargar,escondites,
      estaciones:Object.freeze(Array.from({length:8},(_,i)=>({s:(i+1)*10,punto:punto((i+1)*10)}))),
      estadisticas:Object.freeze({arboles:numeroArboles,tramos:tramos.length,anchoCamino:9,borde:BORDE,puertaS:85,semianchoPuerta:HOJA})};
  }
  window.CAOZ_ARPG_TUTORIAL_MUNDO=Object.freeze({crear});
})();

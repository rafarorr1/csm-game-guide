/* Camino del tutorial: s avanza hacia Tomsage; z mide el desvío del sendero.
   Todo el paisaje es local y determinista. No necesita texturas ni luces nuevas. */
'use strict';
(function(){
  function crear(THREE,{escena}={}){
    const C=Math.cos(Math.PI/6),S=.5,LARGO=85,BORDE=4,HOJA=3.05;
    const origen=new THREE.Vector3(-C*26-C*LARGO,0,13+S*LARGO);
    const grupo=new THREE.Group(),grupoPaisaje=new THREE.Group(),porton=new THREE.Group();
    grupo.name='Tutorial · camino del bosque a Tomsage';
    grupoPaisaje.name='Tutorial · paisaje desmontable';porton.name='Tutorial · portón de Tomsage';
    grupo.position.copy(origen);grupo.rotation.y=Math.PI/6;
    grupo.add(grupoPaisaje,porton);escena?.add(grupo);
    let semilla=147731,cierre=0,eliminado=false,activo=true;
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
      luz:mat(0xc99850,{emissive:0xe9a649,emissiveIntensity:.65})};
    const G={tronco:geo(new THREE.CylinderGeometry(.7,1,1,7)),copa:geo(new THREE.IcosahedronGeometry(1,1)),
      pino:geo(new THREE.ConeGeometry(1,1,9)),roca:geo(new THREE.IcosahedronGeometry(1,0)),
      caja:geo(new THREE.BoxGeometry(1,1,1))};
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

    // El inicio está a 111 m del centro: este suelo cubre también el exterior del disco original.
    superficie('Bosque · suelo continuo',54,28,(u,v)=>{
      const x=-20+u*105,z=-42+v*84,bosque=lim((Math.abs(z)-7)/6,0,1);
      const relieve=(Math.sin(x*.18+z*.27)*.28+Math.cos(z*.39-x*.12)*.2)*bosque;
      return [x,-.019+relieve,z,.79+.16*Math.sin(x*.13+z*.25)+azar()*.12];
    },M.tierra);
    // Termina en el umbral: al otro lado quedan siempre visibles los adoquines reales de la ciudad.
    superficie('Bosque · sendero de tierra de nueve metros',54,6,(u,v)=>{
      const x=-1+u*86,z=(v-.5)*(bordeCamino(x)*2+1),borde=Math.abs(v-.5)*2;
      return [x,.016+Math.sin(x*.22)*.005,z,.9+.07*Math.sin(x*.24+v*8)-borde*.07+azar()*.07,v,(x+1)/8];
    },M.camino);
    // El talud acompaña la colisión: z=±4, convergiendo al vano z=±3 entre s80 y s85.
    for(const signo of [-1,1])superficie('Bosque · talud visible '+signo,85,4,(u,v)=>{
      const x=u*85,dist=bordeCamino(x)+[0,.38,.93,1.48,2.1][Math.round(v*4)];
      const altura=[.035,.39,.49,.31,-.005][Math.round(v*4)];
      const abertura=1-lim((x-78)/6,0,1)*.6;
      return [x,altura*abertura*(.84+.15*Math.sin(x*1.57)),signo*dist,.84+azar()*.14];
    },M.tierra);

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
        arbolActual={x:s,z,alto,ancho};
        Object.defineProperty(arbolActual,'occlusion',{value:{caja:new THREE.Box3(),slots:[],oculto:false}});arboles.push(arbolActual);
        instancia(madera,x,alto*.34,z,radio,alto*.68,radio,giro,tono);
        if(azar()<.68){
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

    // El borde inicial se ve: árboles caídos y roca cierran el camino por detrás de s=0.
    {const madera=[],piedras=[];
      rama(madera,[-.51,.43,-4.8],[-.51,.51,4.8],.5,.93);
      rama(madera,[-.9,1.02,-4.55],[-.6,1.19,4.8],.38,.79);
      for(const lado of [-1,1]){
        instancia(piedras,-.2,.65,lado*4.2,1.1,.9,1.2,.3,1);
        rama(madera,[-.55,1.1,lado*2],[-1.5,2,lado*3.4],.19,.94);
      }
      lote(grupoPaisaje,'Inicio · troncos caídos',G.tronco,M.madera,madera);
      lote(grupoPaisaje,'Inicio · rocas junto a los troncos',G.roca,M.roca,piedras);
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
    function limitar(p,r=.45){
      if(eliminado||!activo)return p;
      const c=coordenadas(p),radio=lim(Number.isFinite(r)?r:.45,0,2.99);
      c.z=lim(c.z,-bordeCamino(c.s)+radio,bordeCamino(c.s)-radio);c.s=Math.max(radio,c.s);
      // Colisión contra cada hoja real, también mientras gira. No hay límite de avance oculto.
      for(const h of hojas){
        const a=h.grupo.rotation.y,z0=h.lado*HOJA,dx=-h.lado*HOJA*Math.sin(a),dz=-h.lado*HOJA*Math.cos(a);
        const t=lim(((c.s-85)*dx+(c.z-z0)*dz)/(HOJA*HOJA),0,1),sx=85+t*dx,sz=z0+t*dz;
        let nx=c.s-sx,nz=c.z-sz;const d=Math.hypot(nx,nz),m=radio+.13;
        if(d<m){
          if(d>1e-6){nx/=d;nz/=d;}else{nx=c.s>=85?1:-1;nz=0;}
          c.s=sx+nx*m;c.z=sz+nz*m;
        }
      }
      c.z=lim(c.z,-bordeCamino(c.s)+radio,bordeCamino(c.s)-radio);
      p.x=origen.x+C*c.s+S*c.z;p.z=origen.z-S*c.s+C*c.z;return p;
    }
    function actualizar({s=0,tiempo=0,abierta}={}){
      if(eliminado)return;
      if(typeof abierta==='boolean')puerta(abierta?0:1);
      const avance=Number.isFinite(s)?s:0;
      // Además del frustum de cada lote, se retiran tramos ya lejanos por detrás.
      for(const t of tramos)t.grupo.visible=t.fin>avance-44&&t.inicio<avance+72;
      M.luz.emissiveIntensity=.62+Math.sin((Number.isFinite(tiempo)?tiempo:0)*4.1)*.04;
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
        const o=a.occlusion,margen=o.oculto?1.15:.7;let ocultar=false;
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
    return {grupo,grupoPaisaje,porton,punto,coordenadas,limitar,actualizar,actualizarOclusion,oclusion,arboles,puerta,activar,dispose,
      estaciones:Object.freeze(Array.from({length:8},(_,i)=>({s:(i+1)*10,punto:punto((i+1)*10)}))),
      estadisticas:Object.freeze({arboles:numeroArboles,tramos:tramos.length,anchoCamino:9,borde:BORDE,puertaS:85,semianchoPuerta:HOJA})};
  }
  window.CAOZ_ARPG_TUTORIAL_MUNDO=Object.freeze({crear});
})();

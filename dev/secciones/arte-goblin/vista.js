/* Vista local: utiliza el esqueleto y las poses reales, sin tocar la partida. */
'use strict';
(async()=>{
 const $=id=>document.getElementById(id),THREE=window.CAOZ_THREE.THREE,MOD=window.CAOZ_ARPG_MODELOS.fabrica(THREE),canvas=$('modelo');
 try{
  const atlas=await (await fetch('goblin-uv.json')).json(),escena=new THREE.Scene();escena.background=new THREE.Color(0x192428);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const camara=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);camara.position.set(0,1.05,4);camara.lookAt(0,.58,0);
  escena.add(new THREE.HemisphereLight(0xe7f4ff,0x716253,2.2));const sol=new THREE.DirectionalLight(0xffe3ba,3);sol.position.set(-2,4,4);escena.add(sol);const relleno=new THREE.DirectionalLight(0xaecbed,1.5);relleno.position.set(3,2,-2);escena.add(relleno);
  const piso=new THREE.Mesh(new THREE.CircleGeometry(2.4,64),new THREE.MeshStandardMaterial({color:0x253337,roughness:1}));piso.rotation.x=-Math.PI/2;piso.position.y=-.065;escena.add(piso);
  const modelos=Array.from({length:3},()=>MOD.crear('goblin'));modelos.forEach(m=>escena.add(m.raiz));let textura=null,cargada=0,t=0;
  for(const m of modelos)for(const mesh of m.mallas){
   const mat=Object.keys(m.M).find(k=>m.M[k]===mesh.material),datos=atlas.mallas.find(d=>d.material===mat),a=mesh.geometry.attributes.position.array;
   if(a.length/3!==datos.vertices)throw Error('Esta plantilla corresponde a otra versión del modelo.');
   const huella=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength))),x=>x.toString(16).padStart(2,'0')).join('');
   if(huella!==datos.huella)throw Error('La geometría cambió: usa el modelo incluido con la plantilla.');
   mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(datos.uv,2));mesh.geometry.attributes.color.array.fill(1);mesh.geometry.attributes.color.needsUpdate=true;
   const material=mesh.material,original=material.onBeforeCompile;material.color.setHex(0xffffff);
   material.onBeforeCompile=function(shader,render){original.call(this,shader,render);shader.fragmentShader=shader.fragmentShader.replace('outgoingLight+=vColor.rgb*uBrillo;','outgoingLight+=diffuseColor.rgb*uBrillo;');};
   material.customProgramCacheKey=()=> 'goblin-pintado-v1';mesh.userData.iluminado=material;mesh.userData.plano=new THREE.MeshBasicMaterial();
  }
  async function aplicar(url,nombre){const turno=++cargada,nueva=await new THREE.TextureLoader().loadAsync(url);if(turno!==cargada){nueva.dispose();return;}if(nueva.image.width!==4096||nueva.image.height!==4096){nueva.dispose();throw Error('El PNG debe medir 4096 × 4096 píxeles.');}
   nueva.colorSpace=THREE.SRGBColorSpace;nueva.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());const previa=textura;textura=nueva;
   for(const m of modelos)for(const mesh of m.mallas)for(const k of ['iluminado','plano']){mesh.userData[k].map=nueva;mesh.userData[k].needsUpdate=true;}
   previa?.dispose();$('estado').textContent='Textura aplicada · '+nombre;
  }
  $('archivo').onchange=async()=>{const f=$('archivo').files[0];if(!f)return;const url=URL.createObjectURL(f);try{await aplicar(url,f.name);}catch(e){$('estado').textContent=e.message;}finally{URL.revokeObjectURL(url);}};
  $('restablecer').onclick=()=>{aplicar('goblin-pintar.png','colores originales');$('archivo').value='';};
  for(const b of document.querySelectorAll('[data-giro]'))b.onclick=()=>{$('giro').value=b.dataset.giro;};
  $('plano').onchange=()=>{for(const m of modelos)for(const mesh of m.mallas)mesh.material=mesh.userData[$('plano').checked?'plano':'iluminado'];};
  function medir(){const r=canvas.getBoundingClientRect(),ratio=r.width/r.height,tres=$('referencias').checked,h=tres?Math.max(1.9,3.75/ratio):Math.max(1.75,1.15/ratio);renderer.setSize(r.width,r.height,false);camara.left=-h*ratio/2;camara.right=h*ratio/2;camara.top=h/2;camara.bottom=-h/2;camara.updateProjectionMatrix();}
  new ResizeObserver(medir).observe(canvas);$('referencias').onchange=medir;
  await aplicar('goblin-pintar.png','colores originales');let antes=performance.now();
  renderer.setAnimationLoop(ahora=>{const dt=Math.min(.05,(ahora-antes)/1000);antes=ahora;t+=dt;const pose=$('pose').value,tres=$('referencias').checked;
   for(const [i,m] of modelos.entries()){m.raiz.visible=i===0||tres;if(!m.raiz.visible)continue;
    if(pose==='neutro'){for(const [n,b] of Object.entries(m.H)){b.rotation.set(0,0,0);if(n==='cuerpo')b.position.set(0,0,0);}}else MOD.posar(m,{anim:pose,k:pose==='aviso'?.55:(t%.85)/.85,t,fase:t*6,paso:pose==='andar'?1:0,dt,mezclar:false});
    m.raiz.position.x=tres?(i-1)*1.15:0;m.raiz.rotation.y=tres?[0,Math.PI/2,Math.PI][i]:Number($('giro').value)*Math.PI/180;
   }renderer.render(escena,camara);
  });
 }catch(e){$('estado').textContent='No se pudo abrir el modelo: '+e.message;console.error(e);}
})();

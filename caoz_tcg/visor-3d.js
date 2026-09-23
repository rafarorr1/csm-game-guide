/* Visor 3D de una carta de la Colección: la carta real del juego con canto,
   reflejo que sigue al dedo, película foil que cambia con el ángulo, destellos
   y dorso con el logo. Este módulo sólo dibuja: la carta, sus ediciones y las
   copias las entrega quien lo abre (coleccion-ui.js).
   Sin WebGL ni dependencias. Cada capa lleva su propia perspectiva en el
   transform, así que no hace falta preserve-3d: el canto se forma con láminas
   a distinta profundidad y cada cara se oculta sola con backface-visibility. */
'use strict';
(function(){
  const PI=Math.PI;
  const acotar=(v,a,b)=>Math.max(a,Math.min(b,v));
  const acercar=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
  const reducir=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOMBRES={normal:'Normal',foil:'Foil',dorado:'Dorada'};
  // Color del canto, del halo y de las motas por edición; el de la carta lo
  // sigue poniendo acabados.css con data-acabado.
  const TONOS={
    normal:{canto:'#5d4c35',cantoLuz:'#a88f63',halo:'#5a3d1c',mota:'#f1d7a0',holo:0,destellos:.22},
    foil:{canto:'#7f8ca0',cantoLuz:'#e3ecf7',halo:'#2c4468',mota:'#d4e6ff',holo:.34,destellos:.8},
    dorado:{canto:'#9a6f22',cantoLuz:'#ffe7a3',halo:'#6d4a10',mota:'#ffe0a0',holo:.26,destellos:.9},
  };
  const LAMINAS=7,GROSOR=7,MAX_PILA=4;
  const textoCopias=n=>n+' '+(n===1?'copia':'copias');
  let actual=null,destellos='';

  function nodo(tag,clase,texto){const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;}
  // Una sola textura de destellos por sesión, generada en un canvas: puntos de
  // luz dispersos que la mezcla color-dodge sólo enciende al inclinar.
  function texturaDestellos(){
    if(destellos)return destellos;
    const c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');
    for(let i=0;i<150;i++){
      const x=Math.random()*192,y=Math.random()*192,r=Math.random()<.12?1.6:.7+Math.random()*.6,a=.35+Math.random()*.65;
      const d=g.createRadialGradient(x,y,0,x,y,r*2.2);d.addColorStop(0,'rgba(255,255,255,'+a+')');d.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=d;g.fillRect(x-r*3,y-r*3,r*6,r*6);
    }
    try{destellos='url("'+c.toDataURL('image/png')+'")';}catch(_){destellos='none';}
    return destellos;
  }

  function abrir(o){
    if(actual)actual.cerrar();
    const ediciones=(o.ediciones||[]).filter(e=>NOMBRES[e.id]);
    let edicion=ediciones.some(e=>e.id===o.inicial&&e.tiene)?o.inicial:(ediciones.find(e=>e.tiene)||{id:'normal'}).id;
    const dlg=nodo('dialog','visor3d');dlg.setAttribute('aria-label',(o.titulo||'Carta')+' en 3D');
    dlg.innerHTML='<canvas class="visor3dMotas" aria-hidden="true"></canvas><div class="visor3dHalo" aria-hidden="true"></div>'+
      '<header class="visor3dCabecera"><div class="visor3dTitulos"><span class="visor3dAntetitulo"></span><h2 class="visor3dTitulo"></h2></div><button type="button" class="visor3dCerrar" aria-label="Cerrar el visor 3D"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>'+
      '<div class="visor3dEscena"><div class="visor3dSuelo" aria-hidden="true"></div><div class="visor3dCuerpo"></div></div>'+
      '<footer class="visor3dPie"><div class="visor3dEdiciones" role="group" aria-label="Edición"></div><p class="visor3dCopias" role="status"></p><div class="visor3dAcciones"><button type="button" class="visor3dVoltear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>Voltear</button></div><p class="visor3dAyuda">Arrastra para girar · doble toque para voltear</p></footer>';
    const $=s=>dlg.querySelector(s);
    const escena=$('.visor3dEscena'),cuerpo=$('.visor3dCuerpo'),motas=$('.visor3dMotas');
    $('.visor3dTitulo').textContent=o.titulo||'';
    escena.setAttribute('role','img');escena.setAttribute('aria-label',(o.titulo||'Carta')+'. Arrastra para girarla.');

    // Capas: pila de copias (detrás), láminas del canto, dorso y frente.
    const pila=[];for(let i=0;i<MAX_PILA;i++){const p=nodo('div','visor3dCapa visor3dPila');p.style.setProperty('--z',(-GROSOR/2-6-i*9)+'px');p.style.setProperty('--dx',(i+1)*5+'px');p.style.setProperty('--dy',(i+1)*4+'px');p.style.setProperty('--giro-pila',((i%2?1:-1)*(1+i))*.6+'deg');cuerpo.append(p);pila.push(p);}
    for(let i=0;i<LAMINAS;i++){const l=nodo('div','visor3dCapa visor3dCanto');l.style.setProperty('--z',(-GROSOR/2+GROSOR*i/(LAMINAS-1))+'px');cuerpo.append(l);}
    const dorso=nodo('div','visor3dCapa visor3dCara visor3dDorso');dorso.style.setProperty('--z',GROSOR/2+.5+'px');
    const logo=nodo('img','visor3dLogo');logo.alt='';logo.draggable=false;logo.decoding='async';logo.src=o.logoUrl||'art/logo.webp';
    dorso.append(nodo('span','visor3dSello'),logo);cuerpo.append(dorso);
    const frente=nodo('div','visor3dCapa visor3dCara visor3dFrente');frente.style.setProperty('--z',GROSOR/2+.5+'px');cuerpo.append(frente);
    const capasLuz=['visor3dFoil','visor3dDestellos','visor3dBrillo'].map(c=>nodo('i',c));capasLuz[1].style.backgroundImage=texturaDestellos();

    let carta=null;
    function ponerCarta(){
      carta?.remove();
      carta=o.crearCarta(edicion);carta.classList.add('visor3dCarta');carta.setAttribute('aria-hidden','true');
      frente.replaceChildren(carta,...capasLuz);dlg.dataset.acabado=edicion;
      const t=TONOS[edicion]||TONOS.normal;
      dlg.style.setProperty('--canto',t.canto);dlg.style.setProperty('--canto-luz',t.cantoLuz);dlg.style.setProperty('--halo',t.halo);
      dlg.style.setProperty('--holo',t.holo);dlg.style.setProperty('--destellos',t.destellos);
      const e=ediciones.find(e=>e.id===edicion)||{cantidad:0};
      $('.visor3dAntetitulo').textContent='Edición '+NOMBRES[edicion];
      $('.visor3dCopias').textContent=e.cantidad>0?textoCopias(e.cantidad)+' en tu colección':'Desbloqueada';
      pila.forEach((p,i)=>{p.hidden=i>=Math.min(MAX_PILA,Math.max(0,(e.cantidad||0)-1));});
      botones.forEach(b=>{const activo=b.dataset.edicion===edicion;b.setAttribute('aria-pressed',String(activo));});
      medir();
    }
    const botones=ediciones.map(e=>{
      const b=nodo('button','visor3dEdicion',NOMBRES[e.id]);b.type='button';b.dataset.edicion=e.id;b.disabled=!e.tiene;
      b.setAttribute('aria-label',NOMBRES[e.id]+(e.tiene?'. '+textoCopias(e.cantidad||0)+'.':'. Bloqueada.'));
      if(!e.tiene)b.append(nodo('span','visor3dCandado','Bloqueada'));
      b.addEventListener('click',()=>{if(edicion===e.id)return;edicion=e.id;ponerCarta();impulso(PI*2);o.sonar?.('ui_confirm');});
      $('.visor3dEdiciones').append(b);return b;
    });

    // Tamaño: la carta llena el espacio entre cabecera y pie, sin salirse.
    let ancho=0,alto=0;
    function medir(){
      const v=window.visualViewport,W=v?v.width:innerWidth,H=v?v.height:innerHeight;
      const arriba=$('.visor3dCabecera').getBoundingClientRect().height,abajo=$('.visor3dPie').getBoundingClientRect().height;
      alto=Math.max(160,Math.min(H-arriba-abajo-48,(W-76)*1.4,640));ancho=alto/1.4;
      dlg.style.setProperty('--w',ancho+'px');dlg.style.setProperty('--h',alto+'px');
      dlg.style.setProperty('--p',Math.max(900,alto*2.6)+'px');
      if(!carta)return;
      // La misma medida que usa la Colección: marco, orbes y composición del juego.
      carta.style.width=ancho+'px';carta.style.height=alto+'px';carta.style.setProperty('--cw',ancho+'px');carta.style.setProperty('--ch',alto+'px');carta.style.fontSize=(ancho*.081)+'px';
      const texto=carta.querySelector('.pieCarta .txt');
      if(texto){texto.style.fontSize='';const max=alto*.47;let tam=parseFloat(getComputedStyle(texto).fontSize);for(let i=0;i<8&&texto.scrollHeight>max&&tam>10;i++){tam=Math.max(10,tam*.93);texto.style.fontSize=tam+'px';}}
      const radio=getComputedStyle(carta).borderRadius;dlg.style.setProperty('--radio',radio&&radio!=='0px'?radio:(ancho*.05)+'px');
      motas.width=Math.round(W*Math.min(devicePixelRatio||1,2));motas.height=Math.round(H*Math.min(devicePixelRatio||1,2));
    }

    // Giro: inercia al soltar y encaje en la cara o el dorso más cercanos.
    const e={giro:reducir()?0:-PI*2,vel:0,encaje:0,forzado:!reducir(),arrastrando:false,x:0,y:0,t:0,inclX:0,inclY:0,objX:0,objY:0,arrastreX:0,pulso:0,escala:reducir()?1:.86};
    function impulso(delta){e.encaje=Math.round(e.giro/PI)*PI+delta;e.forzado=true;e.vel=0;e.pulso=1;}
    function voltear(){impulso(PI);o.sonar?.('ui_confirm');}
    let ultimoToque=0,movido=0;
    escena.addEventListener('pointerdown',ev=>{
      e.arrastrando=true;e.forzado=false;e.vel=0;e.x=ev.clientX;e.y=ev.clientY;e.t=performance.now();movido=0;
      escena.setPointerCapture(ev.pointerId);escena.classList.add('arrastrando');
    });
    escena.addEventListener('pointermove',ev=>{
      if(ev.pointerType==='mouse'&&!e.arrastrando){const r=escena.getBoundingClientRect();e.objX=acotar((ev.clientX-r.left)/r.width*2-1,-1,1);e.objY=acotar((ev.clientY-r.top)/r.height*2-1,-1,1);}
      if(!e.arrastrando)return;
      const ahora=performance.now(),dt=Math.max((ahora-e.t)/1000,1/240),dx=ev.clientX-e.x,dy=ev.clientY-e.y;
      movido+=Math.abs(dx)+Math.abs(dy);
      e.giro+=dx*.011;e.vel=e.vel*.5+dx*.011/dt*.5;e.arrastreX=acotar(e.arrastreX+dy*.006,-.6,.6);
      e.x=ev.clientX;e.y=ev.clientY;e.t=ahora;
    });
    const soltar=ev=>{
      if(!e.arrastrando)return;e.arrastrando=false;escena.classList.remove('arrastrando');
      if(ev.pointerType!=='mouse'&&movido<10){const ahora=performance.now();if(ahora-ultimoToque<320){voltear();ultimoToque=0;}else ultimoToque=ahora;}
    };
    escena.addEventListener('pointerup',soltar);escena.addEventListener('pointercancel',soltar);
    escena.addEventListener('pointerleave',ev=>{if(ev.pointerType==='mouse'){e.objX=0;e.objY=0;}});
    escena.addEventListener('dblclick',voltear);
    $('.visor3dVoltear').addEventListener('click',voltear);
    $('.visor3dCerrar').addEventListener('click',()=>dlg.close());
    dlg.addEventListener('keydown',ev=>{if((ev.key==='f'||ev.key==='F')&&!ev.target.closest('button')){ev.preventDefault();voltear();}});

    // Motas de luz: un canvas 2D ligero; se apaga con movimiento reducido.
    const puntos=Array.from({length:46},()=>({x:Math.random(),y:Math.random(),r:.6+Math.random()*1.8,v:.012+Math.random()*.03,f:Math.random()*PI*2}));
    function dibujarMotas(t){
      const g=motas.getContext('2d'),W=motas.width,H=motas.height,k=W/innerWidth;g.clearRect(0,0,W,H);
      if(reducir())return;
      g.fillStyle=(TONOS[edicion]||TONOS.normal).mota;
      for(const p of puntos){
        const y=((p.y-t*p.v)%1+1)%1,x=p.x+Math.sin(t*.4+p.f)*.015,a=(.25+.5*(.5+.5*Math.sin(t*1.3+p.f*7)))*Math.min(1,y*4,(1-y)*4);
        g.globalAlpha=a;g.beginPath();g.arc(x*W,y*H,p.r*k,0,PI*2);g.fill();
      }
      g.globalAlpha=1;
    }

    let raf=0,antes=0,reloj=0,vivo=true;
    function cuadro(ahora){
      raf=0;if(!vivo)return;
      const dt=Math.min(.05,antes?(ahora-antes)/1000:0);antes=ahora;reloj+=dt;
      if(!e.arrastrando){
        if(!e.forzado&&Math.abs(e.vel)>3){e.giro+=e.vel*dt;e.vel*=Math.exp(-1.6*dt);}
        else{
          if(!e.forzado)e.encaje=Math.round(e.giro/PI)*PI;
          const k=70,c=2*Math.sqrt(k)*.85;e.vel+=((e.encaje-e.giro)*k-e.vel*c)*dt;e.giro+=e.vel*dt;
          if(e.forzado&&Math.abs(e.encaje-e.giro)<.002&&Math.abs(e.vel)<.02)e.forzado=false;
        }
        e.arrastreX=acercar(e.arrastreX,0,4,dt);
      }
      const reposo=reducir()?0:1;
      e.inclX=acercar(e.inclX,e.arrastrando?0:e.objX,6,dt);e.inclY=acercar(e.inclY,e.arrastrando?0:e.objY,6,dt);
      e.pulso=acercar(e.pulso,0,3,dt);e.escala=acercar(e.escala,1,5,dt);
      const ry=e.giro+e.inclX*.42+Math.sin(reloj*.6)*.05*reposo,rx=-e.inclY*.32+e.arrastreX+Math.sin(reloj*.8)*.03*reposo;
      const flota=Math.sin(reloj*1.1)*6*reposo;
      // Ángulo visto de frente (−π..π) para ubicar el reflejo y el foil.
      const frenteY=Math.atan2(Math.sin(ry),Math.cos(ry)),inclina=acotar(Math.hypot(frenteY,rx)*2.2,0,1);
      const s=cuerpo.style;
      s.setProperty('--rx',rx+'rad');s.setProperty('--ry',ry+'rad');s.setProperty('--rz',(Math.sin(reloj*.7)*.012*reposo)+'rad');
      s.setProperty('--y',flota+'px');s.setProperty('--s',e.escala*(1+e.pulso*.03));
      // El reflejo descansa a un costado (arriba a la derecha) y cruza al inclinar.
      s.setProperty('--gx',acotar(72-frenteY*120,-30,130)+'%');s.setProperty('--gy',acotar(26+rx*120,-30,130)+'%');
      s.setProperty('--fx',(50+frenteY*160)+'%');s.setProperty('--fy',(50+rx*160)+'%');
      s.setProperty('--inclina',inclina.toFixed(3));
      s.setProperty('--pila',Math.cos(frenteY)>0?1:0);
      dibujarMotas(reloj);
      if(!document.hidden)raf=requestAnimationFrame(cuadro);
    }
    const reanudar=()=>{if(vivo&&!raf&&!document.hidden){antes=0;raf=requestAnimationFrame(cuadro);}};
    document.addEventListener('visibilitychange',reanudar);
    const alMedir=()=>medir();addEventListener('resize',alMedir);window.visualViewport?.addEventListener('resize',alMedir);

    function cerrar(){if(dlg.open)dlg.close();}
    dlg.addEventListener('close',()=>{
      vivo=false;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',reanudar);
      removeEventListener('resize',alMedir);window.visualViewport?.removeEventListener('resize',alMedir);
      dlg.remove();if(actual?.dlg===dlg)actual=null;o.alCerrar?.();
    });
    document.body.append(dlg);
    ponerCarta();
    dlg.showModal();
    medir();reanudar();
    $('.visor3dVoltear').focus({preventScroll:true});
    actual={dlg,cerrar};
    return actual;
  }

  window.CAOZ_VISOR3D=Object.freeze({abrir,cerrar:()=>actual?.cerrar()});
})();

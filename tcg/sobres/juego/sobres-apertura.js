/* Apertura reutilizable de sobres. Recibe cartas y su renderer; nunca cambia
   inventario, recompensas ni almacenamiento. Integración pendiente de revisión. */
(function(){
  'use strict';
  function nodo(tag,clase,texto){const n=document.createElement(tag);n.className=clase||'';if(texto)n.textContent=texto;return n;}
  function crear(host,opciones){
    const cartas=opciones.cartas||[];
    if(!cartas.length||typeof opciones.crearCarta!=='function')throw Error('El sobre necesita cartas y su renderer.');
    const reducido=opciones.reducirMovimiento??matchMedia('(prefers-reduced-motion: reduce)').matches;
    const variante=opciones.variante==='arcano'?'arcano':'reliquia';
    let fase='sellado',reveladas=0,muerto=false,actual=null,yaw=0,pitch=0,puntero=null,caja=null;
    const tareas=new Set(),limpiezas=[];
    const raiz=nodo('section','sobresApertura');raiz.dataset.variante=variante;
    const escena=nodo('div','sobresTeatro'),aura=nodo('div','sobresAura'),suelo=nodo('div','sobresSuelo');
    const pila=nodo('div','sobresPila'),lienzo=nodo('div','sobresLienzo'),brillo=nodo('div','sobresDestello');
    const gesto=nodo('button','sobresGesto');gesto.type='button';
    const etiqueta=nodo('div','sobresIdentidad'),nombre=nodo('strong'),edicion=nodo('span');etiqueta.append(nombre,edicion);
    const reversos=[];
    function reverso(){const n=nodo('div','sobresReverso'),ornamento=nodo('i','sobresOrnamento'),marca=nodo('img','sobresMarca');marca.src=opciones.logoUrl;marca.alt='';marca.draggable=false;n.append(ornamento,marca,nodo('span','sobresReversoPie','EL DOMO'));return n;}
    cartas.forEach((c,i)=>{const n=reverso();n.dataset.indice=i;n.style.zIndex=cartas.length-i;n.style.left=(i*2)+'px';n.style.top=(i*2)+'px';n.style.rotate=((i%2?1:-1)*i*.6)+'deg';pila.append(n);reversos.push(n);});
    const resumen=nodo('div','sobresResumen');resumen.hidden=true;resumen.setAttribute('role','list');resumen.setAttribute('aria-label','Todas las cartas del sobre');
    const premios=[];
    escena.append(aura,suelo,pila,lienzo,brillo,etiqueta,gesto,resumen);
    const pie=nodo('div','sobresPie'),estado=nodo('p','sobresEstado'),accion=nodo('button','sobresAccion');
    estado.setAttribute('role','status');estado.setAttribute('aria-live','polite');accion.type='button';
    pie.append(estado,accion);raiz.append(escena,pie);host.replaceChildren(raiz);
    const render=window.CAOZ_SOBRES_ESCENA.crear(lienzo,{variante,logoUrl:opciones.logoUrl,reducirMovimiento:reducido,alRomper:()=>{if(!muerto)pila.classList.add('visible');}});
    function oir(n,t,f,opts){n.addEventListener(t,f,opts);limpiezas.push(()=>n.removeEventListener(t,f,opts));}
    function animar(ms,pintar){
      if(muerto)return Promise.resolve(false);
      return new Promise(resolve=>{
        let raf=0,temporizador=0,listo=false;const inicio=performance.now();
        const terminar=(ok=true)=>{if(listo)return;listo=true;cancelAnimationFrame(raf);clearTimeout(temporizador);tareas.delete(terminar);if(ok&&!muerto)pintar(1);resolve(ok&&!muerto);};
        tareas.add(terminar);
        const paso=ahora=>{if(muerto){terminar(false);return;}const t=Math.min(1,(ahora-inicio)/ms);pintar(t);if(t===1)terminar();else raf=requestAnimationFrame(paso);};
        if(reducido||document.hidden){terminar();return;}pintar(0);raf=requestAnimationFrame(paso);temporizador=setTimeout(terminar,ms+100);
      });
    }
    function cambiar(f){fase=f;raiz.dataset.fase=f;const bloqueado=['abriendo','volteando','reuniendo','cerrando'].includes(f);accion.setAttribute('aria-disabled',String(bloqueado));gesto.setAttribute('aria-disabled',String(bloqueado||f==='terminado'));gesto.tabIndex=['sellado','pila'].includes(f)?0:-1;
      const textos={sellado:['Arrastra para girar · Toca para abrir','Romper el sello'],abriendo:['Rompiendo el sello…','Abriendo…'],pila:[reveladas+' de '+cartas.length+' cartas descubiertas','Voltear una carta'],volteando:['Descubriendo una carta…','Revelando…'],reuniendo:[cartas.length+' de '+cartas.length+' cartas descubiertas','Reuniendo tus cartas…'],terminado:['Tus '+cartas.length+' cartas Foil','Volver'],cerrando:['Tus '+cartas.length+' cartas Foil','Volviendo…']};
      estado.textContent=textos[f][0];accion.textContent=textos[f][1];gesto.setAttribute('aria-label',f==='sellado'?'Sobre cerrado. Arrastra para girar o pulsa para abrir.':'Voltear la siguiente carta del bonche.');
      opciones.onCambio?.({fase,reveladas,total:cartas.length,variante});
    }
    function medida(){
      render.redimensionar();caja=render.rectangulo();const w=caja.width*.83,h=w*1.4;
      pila.style.width=w+'px';pila.style.height=h+'px';pila.style.left=(caja.x+(caja.width-w)/2)+'px';pila.style.top=(caja.y+(caja.height-h)/2)+'px';
      pila.style.setProperty('--sobre-escala',w/200);etiqueta.style.top=Math.min(escena.clientHeight-44,caja.y+(caja.height+h)/2+19)+'px';
      gesto.style.left=(caja.x-12)+'px';gesto.style.top=(caja.y-12)+'px';gesto.style.width=(caja.width+24)+'px';gesto.style.height=(caja.height+24)+'px';
      medirResumen();
    }
    function frente(i){const c=opciones.crearCarta(cartas[i]);c.classList.add('sobresCarta');c.setAttribute('aria-hidden','true');const marco=nodo('div','sobresFrente');marco.dataset.carta=cartas[i].id;marco.append(c);return marco;}
    function nombrar(i){nombre.textContent=cartas[i].nombre||cartas[i].id;edicion.textContent='EDICIÓN FOIL';etiqueta.classList.add('visible');}
    function medirResumen(){
      if(!premios.length)return;
      const ancho=escena.clientWidth,alto=escena.clientHeight;
      const columnas=ancho>=700&&ancho>alto*1.15?5:3,filas=Math.ceil(cartas.length/columnas),hueco=ancho<380?10:16;
      const w=Math.max(1,Math.min(220,(ancho-32-hueco*(columnas-1))/columnas,(alto-46-hueco*(filas-1))/(filas*1.4))),h=w*1.4;
      const origenY=(alto-(filas*h+(filas-1)*hueco))/2;
      premios.forEach((p,i)=>{const fila=Math.floor(i/columnas),enFila=Math.min(columnas,cartas.length-fila*columnas),x=(ancho-(enFila*w+(enFila-1)*hueco))/2+(i%columnas)*(w+hueco),y=origenY+fila*(h+hueco);
        p.style.left=x+'px';p.style.top=y+'px';p.style.width=w+'px';p.style.height=h+'px';p.style.setProperty('--sobre-escala',w/200);
      });
    }
    async function reunir(){
      cambiar('reuniendo');
      // La quinta carta conserva su momento individual antes de reunir el sobre.
      if(!await animar(900,()=>{})||muerto)return;
      const teniaFoco=document.activeElement===gesto;etiqueta.classList.remove('visible');gesto.hidden=true;
      cartas.forEach((c,i)=>{const p=nodo('div','sobresPremio');p.setAttribute('role','listitem');p.setAttribute('aria-label',(c.nombre||c.id)+' · Foil');p.append(frente(i));premios.push(p);resumen.append(p);});
      medirResumen();resumen.hidden=false;
      if(!await animar(600,t=>{const e=1-Math.pow(1-t,3);pila.style.opacity=String(1-Math.min(1,t*3));premios.forEach((p,i)=>{const local=Math.max(0,Math.min(1,(t-i*.06)/.76)),avance=1-Math.pow(1-local,3);p.style.opacity=String(avance);p.style.transform='translateY('+((1-avance)*32)+'px) scale('+(.88+.12*avance)+')';});suelo.style.opacity=String(.7*(1-e));})||muerto)return;
      actual?.remove();actual=null;pila.hidden=true;premios.forEach(p=>{p.style.transform='';p.style.opacity='';});cambiar('terminado');
      // El botón conserva la navegación por teclado al desaparecer el bonche.
      if(teniaFoco&&document.activeElement===document.body)accion.focus({preventScroll:true});
    }
    async function volver(){
      if(fase!=='terminado'||muerto)return;cambiar('cerrando');
      if(!await animar(240,t=>{raiz.style.opacity=String(1-t);})||muerto)return;
      opciones.onVolver?.();
    }
    async function abrir(){
      if(fase!=='sellado'||muerto)return;cambiar('abriendo');puntero=null;
      try{await render.abrir();if(muerto)return;pila.classList.add('visible');cambiar('pila');}
      catch(e){if(!muerto){estado.textContent='No se pudo abrir el sobre. Vuelve a intentarlo.';opciones.onError?.(e);}}
    }
    async function voltear(){
      if(fase!=='pila'||muerto)return;cambiar('volteando');etiqueta.classList.remove('visible');
      if(actual){const saliente=actual;
        if(!await animar(240,t=>{const e=1-Math.pow(1-t,3);saliente.style.transform='translateY('+(-24*e)+'px) scale('+(1-e*.06)+')';saliente.style.opacity=1-t;})||muerto)return;saliente.remove();actual=null;
      }
      const i=reveladas,dorso=reversos[i];dorso.style.rotate='0deg';
      if(!await animar(variante==='arcano'?230:190,t=>{dorso.style.transform='perspective(850px) translateY('+(-12*t)+'px) rotateY('+(t*90)+'deg)';})||muerto)return;
      dorso.remove();actual=frente(i);pila.append(actual);brillo.classList.add('encendido');
      if(!await animar(variante==='arcano'?480:360,t=>{const e=1-Math.pow(1-t,3);actual.style.transform='perspective(850px) translateY('+(-12*(1-e))+'px) rotateY('+(-90+90*e)+'deg) scale('+(1+Math.sin(t*Math.PI)*.055)+')';brillo.style.opacity=String(Math.sin(t*Math.PI)*.65);})||muerto)return;
      brillo.classList.remove('encendido');brillo.style.opacity='';actual.style.transform='';reveladas++;nombrar(i);
      if(reveladas===cartas.length)await reunir();else cambiar('pila');
    }
    function activar(){if(muerto)return;if(fase==='sellado')abrir();else if(fase==='pila')voltear();else if(fase==='terminado')volver();}
    oir(accion,'click',activar);
    oir(gesto,'click',e=>{if(e.detail===0&&fase!=='terminado')activar();});
    oir(gesto,'pointerdown',e=>{if((e.pointerType==='mouse'&&e.button!==0)||puntero||!['sellado','pila'].includes(fase))return;puntero={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch,movido:false};gesto.setPointerCapture?.(e.pointerId);gesto.classList.add('arrastrando');});
    oir(gesto,'pointermove',e=>{if(!puntero||puntero.id!==e.pointerId)return;const dx=e.clientX-puntero.x,dy=e.clientY-puntero.y;if(Math.hypot(dx,dy)>8)puntero.movido=true;if(fase==='sellado'&&puntero.movido){yaw=puntero.yaw+dx*.012;pitch=Math.max(-.55,Math.min(.55,puntero.pitch-dy*.006));render.orientar(yaw,pitch);}});
    oir(gesto,'pointerup',e=>{if(!puntero||e.pointerId!==puntero.id)return;const tocar=!puntero.movido;puntero=null;gesto.classList.remove('arrastrando');if(gesto.hasPointerCapture?.(e.pointerId))gesto.releasePointerCapture(e.pointerId);if(tocar)activar();});
    const cancelar=e=>{if(e&&typeof e.pointerId==='number'&&puntero&&e.pointerId!==puntero.id)return;puntero=null;gesto.classList.remove('arrastrando');};oir(gesto,'pointercancel',cancelar);oir(gesto,'lostpointercapture',cancelar);
    oir(document,'visibilitychange',()=>{if(document.hidden){cancelar();for(const terminar of [...tareas])terminar();}});
    const observador=new ResizeObserver(medida);observador.observe(escena);medida();cambiar('sellado');
    return Object.freeze({estado:()=>({fase,reveladas,total:cartas.length,variante}),activar,destruir(){if(muerto)return;muerto=true;for(const terminar of [...tareas])terminar(false);observador.disconnect();limpiezas.forEach(f=>f());render.destruir();raiz.remove();}});
  }
  window.CAOZ_SOBRES=Object.freeze({crear});
})();

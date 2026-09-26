/* El arranque del juego: pantalla de carga y, una vez por sesión, la
   cortinilla del Domo (cortinilla.js) hasta el menú principal.
   - La carga aparece en cuanto hay DOM y queda debajo del acceso a la cuenta
     si hay que iniciar sesión.
   - Con la cuenta lista, se eligen doce cartas de la colección del jugador,
     con el acabado que tiene equipado (primero las premium), y se pintan
     mientras avanza la barra; después, la cortinilla abre el menú.
   - Un toque o una tecla la salta. Sin WebGL, con movimiento reducido o si
     algo falla, la carga se funde en el menú.
   No corre en las pruebas (?test) ni en vistas especiales, ni si ya se vio en
   esta sesión; forzar() la reproduce a demanda (pruebas y revisión). */
'use strict';
(function(){
  const CLAVE='caoz_cortinilla_v1';
  const RESERVA=['tal','tok_dragon','petunia','rey','machete','eric','horton','escarcha','tasha','pergamino','tok_petunia','rulchete'];
  const q=new URLSearchParams(location.search);
  const especial=['test','estudioVista','foto','pantalla','biblia'].some(k=>q.has(k));
  const vista=()=>{try{return sessionStorage.getItem(CLAVE)==='1';}catch(_){return false;}};
  const marcarVista=()=>{try{sessionStorage.setItem(CLAVE,'1');}catch(_){}};
  const quieto=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activa=null;

  let estiloPuesto=false;
  function ponerEstilo(){
    if(estiloPuesto)return;estiloPuesto=true;const st=document.createElement('style');
    st.textContent=
      '#cargaDomo{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:transparent}'
      +'#cargaDomo[data-reproduciendo]{cursor:pointer}'
      +'#cargaDomo .cdFondo{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse 55% 50% at 50% 48%,#2a1a4a,#0d0818 60%,#050308);transition:opacity .45s}'
      +'#cargaDomo .cdLogo{width:var(--logo,240px);filter:drop-shadow(0 10px 30px #000) drop-shadow(0 0 30px #a070ff44);animation:cdLatido 2.4s ease-in-out infinite;transition:opacity .3s,transform .3s}'
      +'@keyframes cdLatido{50%{transform:scale(1.03)}}'
      +'#cargaDomo .cdBarra{position:absolute;left:50%;top:calc(50% + var(--logo,240px)*.95);translate:-50% 0;width:min(280px,60vw);height:3px;border-radius:3px;background:#ffffff14;overflow:hidden;transition:opacity .3s}'
      +'#cargaDomo .cdBarra i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8a5d18,#f0d796,#fff3c9);box-shadow:0 0 12px #f0d796;transition:width .25s}'
      +"#cargaDomo .cdTexto{position:absolute;left:0;right:0;text-align:center;top:calc(50% + var(--logo,240px)*.95 + 18px);font:600 12px/1 'Cinzel Domo','Cinzel',Georgia,serif;letter-spacing:.24em;color:#cdb98a;transition:opacity .3s}"
      +'#cargaDomo[data-baraja] .cdLogo,#cargaDomo[data-baraja] .cdBarra,#cargaDomo[data-baraja] .cdTexto{opacity:0}'
      +'#cargaDomo[data-cubierto] .cdFondo{opacity:0}'
      +'#cargaDomo[data-fuera]{opacity:0;transition:opacity .45s;pointer-events:none}'
      +'@media (prefers-reduced-motion:reduce){#cargaDomo .cdLogo{animation:none}}';
    document.head.append(st);
  }
  // El logo mide lo mismo que el dorso de la baraja en que se convierte.
  function medirLogo(nodo){
    const filas=innerWidth>=innerHeight?3:4,A=innerHeight/(filas-.3),baraja=window.CAOZ_CORTINILLA?.BARAJA||.72,tw=window.CAOZ_CARTA_PINTOR?.ancho||1024;
    nodo.style.setProperty('--logo',Math.round(A*baraja*5/7*860/tw)+'px');
  }
  function montarCarga(){
    ponerEstilo();
    const raiz=document.createElement('div');raiz.id='cargaDomo';raiz.setAttribute('role','status');raiz.setAttribute('aria-label','Cargando el Domo');
    raiz.innerHTML='<div class="cdFondo"><img class="cdLogo" src="art/logo.webp" alt=""><div class="cdBarra" aria-hidden="true"><i></i></div><p class="cdTexto">PREPARANDO EL DOMO…</p></div>';
    medirLogo(raiz);document.body.append(raiz);return raiz;
  }
  const progreso=(raiz,k,texto)=>{raiz.querySelector('.cdBarra i').style.width=Math.round(k*100)+'%';raiz.querySelector('.cdTexto').textContent=texto||'PREPARANDO EL DOMO… '+Math.round(k*100)+'%';};

  // Doce cartas de la colección, con el acabado equipado; se barajan cada vez.
  function elegirCartas(){
    const C=window.CAOZ_COLECCION,A=window.CAOZ_ARTE,cartas=typeof CARDS==='object'&&CARDS?CARDS:{};
    const barajar=l=>{for(let i=l.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[l[i],l[j]]=[l[j],l[i]];}return l;};
    const ilustrada=(id,acabado)=>{try{const v=A?.version?.(id,acabado);return v&&v.url?v:null;}catch(_){return null;}};
    const premium=[],normales=[];
    for(const id of Object.keys(cartas)){
      if(cartas[id]?.t==='lugar')continue;
      let elegido='normal';try{elegido=C?.elegido(id)||'normal';if(elegido!=='normal'&&!C?.tiene(id,elegido))elegido='normal';}catch(_){}
      let posee=false;try{posee=!C||C.cantidad(id)>0;}catch(_){posee=false;}
      if(!posee)continue;
      const v=ilustrada(id,elegido);if(!v)continue;
      (elegido==='normal'?normales:premium).push({id,acabado:elegido,url:v.url,enc:v.encuadre||{x:50,y:50,z:100},nombre:window.CAOZ_ARTE?.nombre?.(id,cartas[id].n)||cartas[id].n});
    }
    const lista=[...barajar(premium),...barajar(normales)].slice(0,12);
    for(const id of RESERVA){if(lista.length>=12)break;if(!cartas[id]||lista.some(c=>c.id===id))continue;const v=ilustrada(id,'normal');if(v)lista.push({id,acabado:'normal',url:v.url,enc:v.encuadre||{x:50,y:50,z:100},nombre:cartas[id].n});}
    return lista;
  }
  // La cuenta: si hay que entrar, la carga espera debajo del acceso.
  function cuentaLista(){
    const J=window.CAOZ_CUENTA_JUEGO;
    if(!J||J.puedeJugar())return Promise.resolve();
    return new Promise(r=>{
      let vigia=0;const listo=()=>{clearInterval(vigia);removeEventListener('caoz:cuenta-lista',listo);r();};
      addEventListener('caoz:cuenta-lista',listo);
      // Por si la sesión se restauró sin avisar.
      vigia=setInterval(()=>{if(J.puedeJugar())listo();},400);
    });
  }
  function entradaMenu(){
    const menu=document.getElementById('menu');if(!menu||!menu.classList.contains('on'))return;
    menu.classList.remove('entra');void menu.offsetWidth;menu.classList.add('entra');setTimeout(()=>menu.classList.remove('entra'),900);
  }

  /* arrancar({forzar,velocidad,reloj}) → Promise: la carga, la espera de la
     cuenta y la cortinilla. Devuelve 'cortinilla', 'fundido' u 'omitida'. */
  async function arrancar(o={}){
    if(activa)return activa;
    if(!o.forzar&&(especial||vista()))return 'omitida';
    activa=(async()=>{
      const raiz=montarCarga();let cortinilla=null,modo='fundido';
      const saltar=()=>{if(raiz.dataset.reproduciendo!==undefined)cortinilla?.saltar();};
      raiz.addEventListener('pointerdown',saltar);const tecla=e=>{if(raiz.isConnected)saltar();};addEventListener('keydown',tecla);
      try{
        progreso(raiz,0,'PREPARANDO EL DOMO…');
        if(!o.forzar)await cuentaLista();
        marcarVista();
        const cartas=elegirCartas();
        if(!quieto()&&cartas.length&&window.CAOZ_CORTINILLA)cortinilla=window.CAOZ_CORTINILLA.crear(raiz,{cartas,logoUrl:'art/logo.webp',velocidad:o.velocidad,reloj:o.reloj});
        const lista=cortinilla?await cortinilla.preparar(k=>progreso(raiz,k)):false;
        if(lista){
          progreso(raiz,1);await new Promise(r=>setTimeout(r,200));
          raiz.dataset.reproduciendo='';raiz.dataset.baraja='';
          await cortinilla.reproducir({alCubrir:()=>{raiz.dataset.cubierto='';},alAbrir:entradaMenu});
          modo='cortinilla';
        }else{progreso(raiz,1);entradaMenu();}
      }catch(e){console.warn('Arranque: se omite la cortinilla.',e);}
      finally{
        delete raiz.dataset.reproduciendo;raiz.dataset.fuera='';removeEventListener('keydown',tecla);
        await new Promise(r=>setTimeout(r,480));cortinilla?.destruir();raiz.remove();activa=null;
      }
      return modo;
    })();
    return activa;
  }
  window.CAOZ_CORTINILLA_JUEGO=Object.freeze({arrancar,forzar:o=>arrancar({...o,forzar:true}),elegirCartas,get activa(){return !!activa;}});
  if(!especial&&!vista()){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>arrancar(),{once:true});else arrancar();
  }
})();

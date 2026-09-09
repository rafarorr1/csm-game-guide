/* Marcas de los seis mazos e identidad del vencedor y del Editor. */
'use strict';
(function(){
  // Primer plano independiente del encuadre de las cartas de cuerpo entero.
  const rostros={fender:{x:50,y:18,z:220},adreida:{x:50,y:20,z:215},rafaela:{x:63,y:23,z:230},talesin:{x:48,y:20,z:230}};
  function pruebas(){return typeof campanaLeer==='function'&&!!campanaLeer()?.prueba;}
  function actualizarMarcas(){
    const logros=window.CAMPANA_LOGROS;if(!logros)return;
    const prueba=pruebas();
    document.querySelectorAll('#leaderList [data-lid],.campanaCarta[data-campana-lider]').forEach(carta=>{
      const id=carta.dataset.lid||carta.dataset.campanaLider,tiene=logros.tiene(id,prueba);
      let marca=carta.querySelector('.marcaGero');
      if(!tiene){marca?.remove();return;}
      if(!marca){marca=document.createElement('span');marca.className='marcaGero';carta.appendChild(marca);}
      marca.textContent='✦';marca.title='Gero vencido con este mazo'+(prueba?' · Prueba':'');marca.setAttribute('aria-label',marca.title);
      marca.classList.toggle('simulada',prueba);
    });
  }
  function actualizarRetratos(){
    const boton=document.getElementById('mCampana'),logros=window.CAMPANA_LOGROS;
    if(!boton||!logros)return;
    // El menú muestra los seis logros reales, también durante un ensayo beta.
    // No depende de la campaña activa: empezar otra no borra estos recuerdos.
    const ids=Object.keys(DECKS).filter(id=>LEADERS[id]),mazos=logros.leer(false).mazos;
    const ganados=ids.filter(id=>mazos[id]),total=ganados.length;
    boton.classList.toggle('campanaConSellos',total>0);
    let fila=boton.querySelector('.campanaRetratos'),descripcion=document.getElementById('campanaProgresoDescripcion');
    if(!total){fila?.remove();descripcion?.remove();boton.removeAttribute('aria-describedby');return;}
    if(!fila){fila=document.createElement('span');fila.className='campanaRetratos';fila.setAttribute('aria-hidden','true');boton.appendChild(fila);}
    if(!descripcion){descripcion=document.createElement('span');descripcion.id='campanaProgresoDescripcion';descripcion.className='campanaSoloLectores';boton.appendChild(descripcion);}
    descripcion.textContent=total+' de '+ids.length+' mazos completados. '+ids.map(id=>LEADERS[id].n+': '+(mazos[id]?'completado':'pendiente')).join('. ')+'.';
    boton.setAttribute('aria-describedby',descripcion.id);
    for(const id of ids){
      let retrato=fila.querySelector('[data-mazo="'+id+'"]');
      if(!retrato){
        retrato=document.createElement('span');retrato.className='campanaRetrato';retrato.dataset.mazo=id;
        const suplente=document.createElement('span');suplente.className='campanaRetratoSimbolo';suplente.textContent=LEADERS[id].art;retrato.appendChild(suplente);
        fila.appendChild(retrato);
      }
      retrato.classList.toggle('completado',!!mazos[id]);
      retrato.title=LEADERS[id].n+' · '+(mazos[id]?'Campaña completada':'Pendiente');
      const enc=encuadreDe(ARTE['lider_'+id])&&(rostros[id]||{x:50,y:20,z:220});let img=retrato.querySelector('img');
      if(!enc){img?.remove();continue;}
      if(!img){img=document.createElement('img');img.alt='';img.draggable=false;img.src='art/lider_'+id+'.webp';img.onerror=()=>{img.hidden=true;};retrato.appendChild(img);}
      img.style.width=enc.z+'%';img.style.transform='translate(-'+enc.x+'%,-'+enc.y+'%)';
    }
  }
  function actualizarNombre(){
    const menu=document.getElementById('menu');if(!menu)return;
    // El nombre de una partida simulada sólo aparece durante esa prueba.
    const ganador=window.CAMPANA_LOGROS?.ganador(pruebas()),nombre=ganador?.nombre;
    menu.classList.toggle('campanaCoronado',!!nombre);
    let titulo=document.getElementById('nombreCaoz');
    if(!nombre){titulo?.remove();return;}
    if(!titulo){titulo=document.createElement('div');titulo.id='nombreCaoz';titulo.className='nombreCaoz';titulo.setAttribute('role','heading');titulo.setAttribute('aria-level','1');
      const contenedor=menu.querySelector('.marcaWrap');if(contenedor)contenedor.prepend(titulo);else menu.prepend(titulo);}
    titulo.textContent=nombre;
  }
  window.campanaActualizarHonores=function(){actualizarMarcas();actualizarNombre();actualizarRetratos();};
  window.campanaPrepararRival=function(){
    if(typeof G==='undefined'||!G?.campana?.jefeSecreto)return;
    const p=P(FOE);if(p.L.n==='Pitágoras')return;
    p.L={...p.L,n:'Pitágoras',ep:'El Editor',art:'☠',lore:'El último corte le pertenece al Editor.'};
  };
  window.campanaCartaPitagoras=function(lado){
    const carta=cartaDeLiderVS('adreida',lado);carta.classList.add('cartaPitagoras');
    carta.querySelectorAll('.marcoDibujo,.retratoPitagoras').forEach(n=>n.remove());
    const arte=document.createElement('img');arte.className='retratoPitagoras';arte.alt='Pitágoras, el Editor';
    if(typeof retratoPitagoras==='function')arte.src=retratoPitagoras();carta.prepend(arte);
    const n=carta.querySelector('.lname');if(n)n.textContent='Pitágoras';
    const ar=carta.querySelector('.larch');if(ar)ar.textContent='El Editor';
    const cara=carta.querySelector('.lface');if(cara)cara.textContent='';
    return carta;
  };
  window.campanaVestirPitagoras=function(nodo){
    if(!nodo)return;nodo.classList.add('identidadPitagoras');
    // Cada pantalla conserva su marco, cifras y zonas pulsables.
    nodo.querySelectorAll('.marcoDibujo,.lrostro,.retratoPitagoras').forEach(n=>n.remove());
    const retrato=document.createElement('img');retrato.className='retratoPitagoras';retrato.alt='Pitágoras, el Editor';
    if(typeof retratoPitagoras==='function')retrato.src=retratoPitagoras();nodo.prepend(retrato);
    for(const selector of ['.ln','.lcName','.nm']){const n=nodo.querySelector(selector);if(n)n.textContent='Pitágoras';}
    const arte=nodo.querySelector('.lcArt');if(arte){arte.textContent='☠';arte.style.visibility='hidden';}
  };
  function instalar(){
    const s=document.createElement('style');s.textContent=`
#menu .menucol #mCampana.campanaConSellos{display:flex;align-items:center;justify-content:center;gap:14px;padding-block:8px}
.campanaEtiqueta{flex:0 0 auto}
.campanaRetratos{display:flex;align-items:center;gap:4px;flex:0 0 auto;letter-spacing:0}
.campanaRetrato{position:relative;display:block;width:28px;height:28px;border:1px solid #9a938b;
 border-radius:50%;overflow:hidden;background:radial-gradient(circle at 40% 20%,#473d50,#18141d);
 box-shadow:0 2px 4px #0008;filter:grayscale(1) brightness(.72);opacity:.8}
.campanaRetrato.completado{border-color:#f0cc78;filter:none;opacity:1;box-shadow:0 0 0 1px #a874243d,0 0 9px #dfa24333}
.campanaRetrato.completado::after{content:'✓';position:absolute;right:0;bottom:0;z-index:2;width:10px;height:10px;
 display:grid;place-items:center;border-radius:50%;background:#efd08a;color:#2c1909;font:900 8px/1 var(--sans)}
.campanaRetratoSimbolo{position:absolute;inset:0;display:grid;place-items:center;font:20px/1 system-ui}
.campanaRetrato img{position:absolute;left:50%;top:50%;height:auto;max-width:none}
.campanaRetrato img[hidden]{display:none}
.campanaSoloLectores{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@media(max-width:380px){#menu .menucol #mCampana.campanaConSellos{gap:10px}.campanaRetrato{width:24px;height:24px}.campanaRetratoSimbolo{font-size:18px}}
.marcaGero{position:absolute;right:9px;top:9px;z-index:9;display:grid;place-items:center;
 width:30px;height:30px;border:1px solid #f1d291;border-radius:50%;color:#fff0bf;
 font:800 21px/1 var(--serif);background:radial-gradient(circle at 35% 25%,#a78338,#443010 70%);
 box-shadow:0 2px 8px #0009,inset 0 0 0 3px #e6c37122;pointer-events:none}
.marcaGero.simulada{border-style:dashed;filter:saturate(.5)}
.ltile .marcaGero{right:6px;top:6px;width:22px;height:22px;font-size:15px}
#menu.campanaCoronado #marca,#menu.campanaCoronado #marcaTexto{display:none!important}
.nombreCaoz{width:min(90%,680px);margin:18px auto;text-align:center;overflow-wrap:anywhere;text-wrap:balance;
 font:900 clamp(30px,6vw,74px)/1.08 var(--serif);font-variant:small-caps;letter-spacing:.045em;
 background:linear-gradient(#fff6d7,#efc367 48%,#a96920);color:transparent;background-clip:text;-webkit-background-clip:text;
 filter:drop-shadow(0 3px 1px #321b10) drop-shadow(0 0 23px #e7863140)}
#menu>.nombreCaoz{flex:0 1 auto;max-width:90%;font-size:clamp(28px,8vw,46px)}
.retratoPitagoras{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;border-radius:inherit}
.cartaPitagoras{background:#07120d!important;overflow:hidden;isolation:isolate}
.cartaPitagoras>.retratoPitagoras{z-index:0}
.cartaPitagoras::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(transparent 40%,#06100966 62%,#040b07 100%)}
.cartaPitagoras .lface{background:none;filter:none}
.cartaPitagoras .lface::after{display:none}
.cartaPitagoras .larch{position:relative;color:#c6d3a2!important}
.cartaPitagoras .lname{background:none!important;text-shadow:0 2px 6px #000}
.cartaPitagoras .lname,.cartaPitagoras .larch{z-index:2}
.identidadPitagoras.leadercard{overflow:hidden;background:#07120d}
.identidadPitagoras.leadercard>.retratoPitagoras{position:absolute;inset:0;z-index:0}
.identidadPitagoras.big>.art{display:none}
.identidadPitagoras.leadercard::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 38%,#030906ed);pointer-events:none}
.identidadPitagoras.leadercard .lcName,.identidadPitagoras.leadercard .lcEp,.identidadPitagoras.leadercard .lcAlma,.identidadPitagoras.leadercard .lcHab{z-index:2;position:relative}
.identidadPitagoras.lider>.retratoPitagoras{position:relative;inset:auto;width:34px;height:42px;flex:0 0 auto;object-fit:cover;border-radius:7px}
.identidadPitagoras.big>.retratoPitagoras{position:relative;inset:auto;display:block;width:100%;height:190px;object-fit:contain;background:#050b08}
`;document.head.appendChild(s);
    for(const nombre of ['buildSelect','campanaElegir']){const original=window[nombre];if(typeof original==='function')window[nombre]=function(...args){const r=original.apply(this,args);actualizarMarcas();return r;};}
    const anterior=window.showScreen;if(anterior)window.showScreen=function(...args){const r=anterior.apply(this,args);actualizarNombre();actualizarRetratos();return r;};
    window.addEventListener('caoz:campana-logros',window.campanaActualizarHonores);
    window.addEventListener('storage',window.campanaActualizarHonores);
    window.addEventListener('caoz:arte',actualizarRetratos);
    campanaActualizarHonores();
  }
  if(document.readyState==='complete')instalar();else addEventListener('load',instalar,{once:true});
})();

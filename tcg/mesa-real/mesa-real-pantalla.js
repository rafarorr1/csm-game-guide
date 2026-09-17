
'use strict';
/* ==========================================================================
   LA PANTALLA DEL TELÉFONO — lo que el motor espera de una pantalla, hecho
   para un teléfono de pie. Mismos nombres que en index.html: render, ask,
   pickCard, roll → rollDice, log, toast, los fx*, el tutorial, la red.
   ========================================================================== */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (t,c,h)=>{const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;};
const BUILD = {n:262, fecha:'2026-09-16'};
const nap = ms => ((G&&G.fast)||document.hidden) ? Promise.resolve() : sleep(ms);
const FXON = ()=> G && !G.fast && !G.silent && !document.hidden;
const FX_SUAVE = ()=> matchMedia('(prefers-reduced-motion: reduce)').matches;
const esMovil = () => true;
/* El navegador sólo deja vibrar después de un toque real; antes de eso lo
   anota como error en la consola. Se recuerda el primer toque. */
let TOCO=false; addEventListener('pointerdown',()=>{ TOCO=true; },{once:true,capture:true});
const vibra = ms => { if(TOCO && navigator.vibrate){ try{ navigator.vibrate(ms); }catch(e){} } };

/* ---------- texto que se encoge para caber (igual que en escritorio) ---------- */
function encajarAncho(nodo, minFactor){
  if(!nodo) return;
  nodo.style.fontSize='';
  const ancho=nodo.clientWidth; if(!ancho) return;
  const sobra=nodo.scrollWidth/ancho; if(sobra<=1.001) return;
  const base=parseFloat(getComputedStyle(nodo).fontSize), min=base*(minFactor||0.72);
  nodo.style.fontSize=Math.max(min, base/sobra*0.97).toFixed(2)+'px';
  if(nodo.scrollWidth>nodo.clientWidth+1){ nodo.style.whiteSpace='normal'; nodo.style.lineHeight='1.05'; nodo.style.textOverflow='clip'; }
}
function encajarAlto(nodo, minFactor){
  if(!nodo) return;
  nodo.style.fontSize=''; nodo.style.webkitLineClamp='';
  const hueco=nodo.clientHeight; if(!hueco) return;
  nodo.style.webkitLineClamp='unset';
  if(nodo.scrollHeight<=hueco+1){ nodo.style.webkitLineClamp=''; return; }
  const base=parseFloat(getComputedStyle(nodo).fontSize), min=base*(minFactor||0.70);
  let t=Math.max(min, base*(hueco/nodo.scrollHeight));
  nodo.style.fontSize=t.toFixed(2)+'px';
  for(let i=0;i<6 && nodo.scrollHeight>hueco+1 && t>min+0.01;i++){ t=Math.max(min,t*0.95); nodo.style.fontSize=t.toFixed(2)+'px'; }
  const linea=parseFloat(getComputedStyle(nodo).lineHeight)||t*1.16;
  nodo.style.webkitLineClamp=String(Math.max(1,Math.floor(hueco/linea)));
}
function encajarTextos(raiz){
  const r=raiz||document;
  r.querySelectorAll('.card .tribe').forEach(t=>encajarAncho(t,0.68));
  r.querySelectorAll('#hand .card .txt, .gallery .card .txt, .gcards .card .txt').forEach(t=>encajarAlto(t,0.70));
}

/* ---------- ilustraciones ---------- */
function ponerDibujo(nodo, url, enc){
  enc=window.CAOZ_ARTE?.encuadre(nodo.dataset.arteId,CAOZ_VISTAS.identificar(nodo),nodo)||enc;
  if(nodo.dataset.arteId)url=urlArte(nodo.dataset.arteId,nodo);
  // Reutiliza el marco: una edición remota no debe duplicar ni rehacer cartas.
  const marcos=[...nodo.querySelectorAll(':scope > .marcoDibujo')];
  let caja=marcos.shift();marcos.forEach(n=>n.remove());
  if(!caja){caja=document.createElement('div');caja.className='marcoDibujo';nodo.prepend(caja);}
  let img=caja.querySelector('img');
  if(!img){img=document.createElement('img');img.className='dibujo';img.alt='';caja.appendChild(img);}
  if(img.getAttribute('src')!==url)img.src=url;
  caja.style.setProperty('--url', `url("${url}")`);
  nodo.style.setProperty('--ex', enc.x+'%');nodo.style.setProperty('--ey', enc.y+'%');
  nodo.style.setProperty('--ez', (enc.z/100).toFixed(3));
  return img;
}

function ilustrarLider(d, lid){
  const cara=d.querySelector('.lface');if(!cara)return d;
  cara.dataset.arteId='lider_'+lid;CAOZ_ARTE.acabar(d,'lider_'+lid);
  const enc=CAOZ_ARTE.encuadre('lider_'+lid,CAOZ_VISTAS.identificar(cara),cara);if(!enc)return d;
  cara.classList.add('conarte');ponerDibujo(cara,urlArte('lider_'+lid,cara),enc);
  return d;
}
function ilustrar(d, id){
  d.dataset.arteId=id;CAOZ_ARTE.acabar(d,id);
  const enc=CAOZ_ARTE.encuadre(id,CAOZ_VISTAS.identificar(d),d),hay=enc!=null;
  d.classList.add('acomodo');d.classList.toggle('conarte',hay);d.classList.toggle('sinarte',!hay);
  if(hay)ponerDibujo(d,urlArte(id,d),enc);
  let pie=d.querySelector(':scope > .pieCarta');
  if(!pie){pie=document.createElement('div');pie.className='pieCarta';}
  for(const sel of ['.nm','.tribe','.txt','.stats']){const e=d.querySelector(sel);if(e&&!pie.contains(e))pie.appendChild(e);}
  if(pie.children.length&&!pie.parentNode)d.appendChild(pie);
  return d;
}

/* el retrato del Líder para la barra: la imagen si la hay, si no su emoji */
function rostroLider(lid,side){
  const contexto=document.createElement('span');window.CAOZ_COLECCION_JUEGO?.marcar(contexto,side);
  const enc=CAOZ_ARTE.encuadre('lider_'+lid,'movil_hud',contexto),lado=contexto.hasAttribute('data-lado-arte')?` data-lado-arte="${contexto.dataset.ladoArte}"`:'';
  if(!enc) return `<div class="lrostro"${lado} data-arte-id="lider_${lid}" data-acabado="${acabadoArte('lider_'+lid,contexto)}">${LEADERS[lid].art}</div>`;
  return `<div class="lrostro"${lado} data-arte-id="lider_${lid}" data-acabado="${acabadoArte('lider_'+lid,contexto)}" style="--ex:${enc.x}%;--ey:${enc.y}%;--ez:${(enc.z/100).toFixed(3)}"><img alt="" src="${urlArte('lider_'+lid,contexto)}"></div>`;
}

/* ---------- el reparto del alto: las cartas crecen hasta llenar lo que hay ---------- */
const altoVisible = () => (window.visualViewport ? visualViewport.height : innerHeight);
const anchoVisible = () => Math.min(window.visualViewport ? visualViewport.width : innerWidth, 520);
function ajustarLienzo(){
  const app = navigator.standalone===true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  document.documentElement.classList.toggle('app', !!app);
  // en modo app, de pie, manda la pantalla entera (screen.height no gira en iOS: sólo de pie)
  const dePie = innerHeight > innerWidth;
  const W=anchoVisible(), H=app ? Math.max(altoVisible(), innerHeight, dePie ? (screen.height||0) : 0) : altoVisible();
  const r=document.documentElement.style;
  r.setProperty('--vh', H+'px');
  r.setProperty('--vvt', (window.visualViewport ? Math.round(visualViewport.offsetTop) : 0)+'px');
  // cinco Personajes por fila, con sus huecos, y que las dos filas quepan con
  // todo lo demás (barras, trampas, medio, mano) en el alto que hay
  const porAncho=Math.floor((W-10-6-4*5)/5);
  const fijo= 44+44 + 30+30 + 30 + 8 + (H<720 ? 160 : 176) + 40 + 10 + (app ? 94 : 0);
  const porAlto=Math.floor((H-fijo)/2/1.4);
  const cw=Math.max(58, Math.min(porAncho, porAlto, 96));
  r.setProperty('--cw', cw+'px'); r.setProperty('--ch', Math.round(cw*1.4)+'px');
  // y lo que sobre se lo lleva la mano, que es lo que se lee
  const ch=Math.round(cw*1.4);
  const sobra=H-(46+46+30+30+30+2*ch+40+30);
  const cwm=Math.max(92, Math.min(128, Math.floor((sobra-24)/1.4)));
  r.setProperty('--cwm', cwm+'px'); r.setProperty('--chm', Math.round(cwm*1.4)+'px');
  ajustarCampo();
}
/* El Lugar puede ocupar varias líneas o compartir la franja con Reliquias.
   El cálculo inicial es sólo un máximo: las cartas de mesa se ajustan al alto
   que realmente queda, sin comprimir el terreno ni las filas de Trampas. */
function ajustarCampo(){
  const campo=document.getElementById('field');
  if(!campo.clientHeight)return;
  const filas=['foeField','myField'].map(id=>document.getElementById(id));
  const zonas=filas.map(f=>f.parentElement), estilo=getComputedStyle(campo);
  const fijo=[...campo.children].filter(e=>!zonas.includes(e)).reduce((n,e)=>n+e.getBoundingClientRect().height,0)
    +parseFloat(estilo.rowGap)*(campo.children.length-1);
  const bordes=filas.reduce((n,e)=>{const c=getComputedStyle(e);return n+parseFloat(c.paddingTop)+parseFloat(c.paddingBottom);},0);
  const raiz=getComputedStyle(document.documentElement),mano=document.getElementById('handzone');
  const maximo=parseFloat(raiz.getPropertyValue('--cw'));
  // En un teléfono corto, reducir primero la mano sólo lo necesario para
  // conservar al menos 44 px de ancho tocable en las cartas del campo.
  const disponible=campo.getBoundingClientRect().height-fijo-bordes+parseFloat(getComputedStyle(mano).getPropertyValue('--chm'));
  const chm=Math.max(70,Math.min(parseFloat(raiz.getPropertyValue('--chm')),Math.floor(disponible-2*Math.ceil(Math.min(44,maximo)*1.4))));
  mano.style.setProperty('--chm',chm+'px');mano.style.setProperty('--cwm',Math.round(chm/1.4)+'px');
  const cw=Math.max(1,Math.min(maximo,Math.floor((disponible-chm)/2/1.4)));
  campo.style.setProperty('--cw',cw+'px');campo.style.setProperty('--ch',Math.floor(cw*1.4)+'px');
  encajarTextos(mano);
}
// También cambia el espacio cuando aparece la opción Jugar, una ayuda o una
// acción. Observar sus contenedores evita depender de un modelo de teléfono.
if(window.ResizeObserver){
  const reparto=new ResizeObserver(()=>ajustarCampo());
  ['field','midRow','foeTraps','myTraps'].forEach(id=>reparto.observe(document.getElementById(id)));
}
addEventListener('resize', ajustarLienzo);
addEventListener('orientationchange', ajustarLienzo);
if(window.visualViewport){ visualViewport.addEventListener('resize', ajustarLienzo); visualViewport.addEventListener('scroll', ajustarLienzo); }
addEventListener('pageshow', ajustarLienzo);
addEventListener('load', ajustarLienzo);
// la barra del navegador se asienta después del primer pintado: se vuelve a medir
[150, 600, 1500].forEach(t=>setTimeout(ajustarLienzo, t));
ajustarLienzo();

/* ---------- pulsación larga: el "hover" del teléfono ---------- */
function pulsacionLarga(nodo, fn){
  let t=null, x0=0, y0=0;
  const cancela=()=>{ if(t){ clearTimeout(t); t=null; } };
  nodo.addEventListener('pointerdown', e=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    x0=e.clientX; y0=e.clientY;
    cancela();
    t=setTimeout(()=>{ t=null; nodo.dataset.larga='1'; fn(e); }, 380);
  });
  nodo.addEventListener('pointermove', e=>{ if(t && Math.hypot(e.clientX-x0,e.clientY-y0)>10) cancela(); });
  nodo.addEventListener('pointerup', cancela);
  nodo.addEventListener('pointercancel', cancela);
  nodo.addEventListener('pointerleave', cancela);
  // tras una pulsación larga el toque que la suelta no cuenta como toque
  nodo.addEventListener('click', e=>{ if(nodo.dataset.larga){ delete nodo.dataset.larga; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  nodo.addEventListener('contextmenu', e=>e.preventDefault());
}

/* Suprime el clic sintetizado tras desplazar la mano o la pantalla. */
{
  let origen=null,arrastreHasta=0;
  document.addEventListener('pointerdown',e=>{
    // El sobre distingue su propio giro del toque. No bloquear el siguiente
    // botón durante medio segundo por un arrastre de la funda.
    if(e.target.closest?.('.sobresApertura')){origen=null;arrastreHasta=0;return;}
    origen={x:e.clientX,y:e.clientY};
  },true);
  document.addEventListener('pointermove',e=>{if(origen&&Math.hypot(e.clientX-origen.x,e.clientY-origen.y)>12)arrastreHasta=Date.now()+500;},true);
  document.addEventListener('pointerup',()=>{origen=null;},true);
  document.addEventListener('pointercancel',()=>{origen=null;},true);
  document.addEventListener('click',e=>{if(Date.now()<arrastreHasta){e.preventDefault();e.stopImmediatePropagation();}},true);
}
/* ---------- pantallas ---------- */
function showScreen(id){
  if(id==='select'&&!window.CAOZ_CUENTA_JUEGO?.requerir(()=>showScreen(id)))return;
  if(id!=='board'){campanaCancelarInterferencia();window.PITAGORAS_MESA?.cancelar();}
  const antes=$('.screen.on'),pantalla=$('#'+id),esMenu=pantalla.classList.contains('portada');
  if(antes!==pantalla||!esMenu)limpiarTransicionMenu();
  $$('.screen').forEach(s=>s.classList.remove('on'));
  pantalla.classList.add('on');
  $('#fondoMenus').classList.toggle('on',esMenu);
  if(id!=='board'){document.body.classList.remove('peligro','remate');cerrarHojas();}
  // El tablero entra con su propio VS; las pantallas de menú comparten el oro.
  if(esMenu&&antes!==pantalla)animarTransicionMenu(pantalla);
  window.dispatchEvent(new CustomEvent('caoz:pantalla',{detail:{id}}));
}
function sembrarPortada(){
  const f=$('#fondoMenus');
  const ids=Object.keys(LEADERS);
  /* Siete cartas en cuatro carriles y repartidas en el tiempo: al azar puro
     salían dos o tres encimadas en el mismo sitio. Cada una va en su carril
     (con un poco de juego) y arranca en un punto distinto del recorrido, así
     que nunca coinciden a la misma altura. Las "lejanas" son más chicas,
     más tenues y algo borrosas: profundidad, no montón. */
  const az=(a,b)=>a+Math.random()*(b-a);
  const carriles=[1,25,49,71], N=7;
  for(let i=0;i<N;i++){
    const c=el('div','cartaFondo'), lejos=i%2===0;
    c.style.setProperty('--x', (carriles[i%carriles.length]+az(-5,5)).toFixed(0)+'%');
    c.style.setProperty('--w', (lejos?az(64,84):az(96,118)).toFixed(0)+'px');
    c.style.setProperty('--op', (lejos?az(.12,.18):az(.22,.30)).toFixed(2));
    c.style.setProperty('--gir0', az(-14,14).toFixed(0)+'deg'); c.style.setProperty('--gir1', az(-14,14).toFixed(0)+'deg');
    c.style.setProperty('--dx', az(-30,30).toFixed(0)+'px');
    const dur=lejos?az(36,46):az(26,34);
    c.style.setProperty('--dur', dur.toFixed(1)+'s');
    c.style.setProperty('--esp', (-(i/N)*dur - az(0,2)).toFixed(1)+'s');   // cada una en un punto del recorrido
    if(lejos) c.style.filter='blur(1.2px)';
    const v=el('div','vscard'); v.dataset.lid=ids[i%ids.length];
    v.innerHTML=`<div class="lface">${LEADERS[v.dataset.lid].art}</div>`;
    c.appendChild(v); f.appendChild(c);
  }
  for(let i=0;i<16;i++){
    const b=el('div','brasa');
    b.style.setProperty('--x', (Math.random()*100)+'%'); b.style.setProperty('--dx', (Math.random()*80-40)+'px');
    b.style.setProperty('--dur', (5+Math.random()*7)+'s'); b.style.setProperty('--del', (-Math.random()*12)+'s');
    b.style.width=b.style.height=(3+Math.random()*4)+'px';
    f.appendChild(b);
  }
}
function ilustrarFondo(){ $$('#fondoMenus .cartaFondo .vscard[data-lid]').forEach(n=>{ ilustrarLider(n, n.dataset.lid); }); }

/* ---------- selección de Líder: una lista de pie ---------- */
function buildSelect(){
  const ids=Object.keys(LEADERS), mio=SEL_PASO==='yo';
  if(!SELP) SELP=ids[0];
  if(!mio && !SELF) SELF=ids.find(x=>x!==SELP)||ids[0];
  const elegido=mio?SELP:SELF;
  $('#selTitle').textContent=mio?'ELIGE TU PROTAGONISTA':'ELIGE A TU RIVAL';
  $('#selSub').innerHTML=mio?'Cada Líder trae su mazo de 40 cartas.':`Llevas a <b>${LEADERS[SELP].n}</b>. ¿Contra quién?`;
  $('#selGo').textContent=mio?'Elegir →':'Entrar al Domo →';
  $('#selBack').textContent=mio?'← Volver':'← Cambiar';
  $('#fondoMenus').classList.toggle('rival', !mio);
  const lista=$('#leaderList');
  if(lista.children.length!==ids.length){
    lista.innerHTML='';
    ids.forEach(id=>{ const L=LEADERS[id], D=DECKS[id];
      const d=el('div','ltile',`<div class="lface">${L.art}</div>
        <div><div class="lname">${L.n}</div><div class="larch">${D.d}</div>
          <div class="lhab">${L.habName} · <b>${L.habCost} PD</b> · ${estrellas(GUIAS[id].dif)}</div></div>
        <div class="lmarca">✦</div>`);
      d.dataset.lid=id; ilustrarLider(d,id);
      d.onclick=()=>{ if(SEL_PASO==='yo') SELP=id; else SELF=id; buildSelect(); };
      lista.appendChild(d); });
  }
  [...lista.children].forEach(d=>{
    if(d.dataset.ladoArte!==String(mio?ME:FOE)){
      window.CAOZ_COLECCION_JUEGO?.marcar(d,mio?ME:FOE);ilustrarLider(d,d.dataset.lid);
    }
    d.classList.toggle('sel', d.dataset.lid===elegido);
  });
  const L=LEADERS[elegido], D=DECKS[elegido];
  $('#fichaLider').innerHTML=`<div class="fn">${L.n} <span>— ${L.ep}</span></div>
    <div class="fl">${L.pasiva}</div><div class="fl">${L.hab}</div>
    <div class="fm">Mazo <b>“${D.n}”</b> · 40 cartas · dificultad ${estrellas(GUIAS[elegido].dif)}</div>`;
  const sel=lista.querySelector('.sel'); if(sel) sel.scrollIntoView({block:'nearest'});
}

/* ---------- guías ---------- */
function showGuides(id){
  const origen=$('.screen.on')?.id;
  if(origen!=='guide')$('#guideBack').dataset.regreso=origen==='extras'?'extras':'menu';
  GUIA_SEL=id||GUIA_SEL;
  showScreen('guide');
  const tabs=$('#guideTabs'); tabs.innerHTML='';
  Object.keys(LEADERS).forEach(k=>{ const L=LEADERS[k];
    const t=el('button','gtab'+(k===GUIA_SEL?' on':''),`<span>${L.art}</span> ${L.n}`);
    t.onclick=()=>showGuides(k); tabs.appendChild(t); });
  const on=tabs.querySelector('.on'); if(on) on.scrollIntoView({inline:'center',block:'nearest'});
  const L=LEADERS[GUIA_SEL], D=DECKS[GUIA_SEL], g=GUIAS[GUIA_SEL], c=$('#guideBody');
  c.innerHTML=`
    <div class="ghead"><div class="gart">${L.art}</div><div>
      <h2>${L.n} — “${D.n}”</h2><div class="gsub">${D.d}</div><div class="glema">“${g.lema}”</div>
      <div class="gmeta"><span>Dificultad <b>${estrellas(g.dif)}</b></span>
        <span>En ${GUIA_PARTIDAS} partidas ganó el <b>${GUIA_DATOS[GUIA_SEL]}%</b></span></div></div></div>
    <div class="gsec"><h3>🏆 Cómo ganas</h3><p>${g.ganas}</p></div>
    <div class="gsec"><h3>⚙️ Tu motor</h3><p>${g.motorTxt}</p><div class="gcards" id="gcards"></div></div>
    <div class="gsec"><h3>🕐 Plan por turnos</h3><div class="gturnos">
      ${g.turnos.map(([t,d])=>`<div class="gturno"><span class="gt">${t}</span><p>${d}</p></div>`).join('')}</div></div>
    <div class="gsec destacado"><h3>💥 La jugada</h3><p>${g.combo}</p></div>
    <div class="gsec"><h3>🃏 Qué guardar en la mano inicial</h3><p>${g.mano}</p></div>
    <div class="gsec"><h3>💀 Cómo pierdes</h3><ul>${g.pierdes.map(x=>`<li>${x}</li>`).join('')}</ul></div>
    <div class="gsec"><h3>⚔️ Enfrentamientos</h3><table class="gvs">
      ${Object.keys(g.vs).map(k=>`<tr><td>${LEADERS[k].art} <b>${LEADERS[k].n}</b></td>
        <td class="gv ${g.vs[k][0]==='Favorable'?'bien':g.vs[k][0]==='Difícil'?'mal':''}">${g.vs[k][0]}</td>
        <td>${g.vs[k][1]}</td></tr>`).join('')}</table></div>
    <div class="gsec"><h3>📋 El mazo entero</h3><p class="gplan">${D.plan}</p><div class="gcards" id="gdeck"></div></div>`;
  const strip=$('#gcards'); g.motor.forEach(id=>strip.appendChild(cardEl(id,{})));
  const deck=$('#gdeck');
  D.list.forEach(([cid,n])=>{ const d=cardEl(cid,{}); if(n>1) d.appendChild(el('div','gcount','×'+n)); deck.appendChild(d); });
  c.scrollTop=0;
  requestAnimationFrame(()=>encajarTextos(c));
}

/* ---------- galería, alcantarillas, reglas, salir ---------- */
function openOv(){
  cerrarHojas();
  const ov=$('#ov'),primera=!ov.classList.contains('on');
  ov.classList.toggle('calido',!!document.querySelector('.screen.on.portada'));
  ov.classList.add('on');
  if(primera&&ov.classList.contains('calido'))animarTransicionMenu($('#ovPanel'),ov);
}
function cerrarHojas(){ $('#inspect').classList.remove('on'); $('#panel').classList.remove('on'); $('#velo').classList.remove('on'); }
function abrirHoja(id){ $('#inspect').classList.remove('on'); $('#panel').classList.remove('on'); $('#'+id).classList.add('on'); $('#velo').classList.add('on'); }

function showGallery(){
  const p=$('#ovPanel');
  const types=['todas','personaje','hechizo','trampa','objeto','lugar'];
  let filter='todas', mazo='todos';
  const delMazo=lid=>{ const m={}; (DECKS[lid]?DECKS[lid].list:[]).forEach(([id,n])=>m[id]=n); return m; };
  const draw=()=>{
    const enMazo=(mazo==='todos'||mazo==='cajon')?null:delMazo(mazo), enElCajon=mazo==='cajon';
    const base=Object.keys(CARDS).filter(k=>!CARDS[k].token&&!CARDS[k].set).length;
    const cajon=Object.keys(CARDS).filter(k=>!CARDS[k].token&&CARDS[k].set==='cajon').length;
    p.innerHTML=enElCajon
      ? `<h3>🗄️ El Cajón</h3><p>${cajon} cartas nuevas, todavía fuera de los mazos.</p>`
      : `<h3>🃏 Cartas del set base</h3><p>${base} cartas + ${Object.keys(LEADERS).length} Líderes. Mantén pulsada una carta para verla en grande.</p>`;
    const fm=el('div','filters');
    const bt=el('button','btn sm'+(mazo==='todos'?' on':''),'Todos'); bt.onclick=()=>{mazo='todos';draw();}; fm.appendChild(bt);
    Object.keys(LEADERS).forEach(lid=>{ const b=el('button','btn sm'+(mazo===lid?' on':''),LEADERS[lid].art+' '+LEADERS[lid].n);
      b.onclick=()=>{mazo=lid;draw();}; fm.appendChild(b); });
    if(cajon){ const bc=el('button','btn sm'+(enElCajon?' on':''),'🗄️ Cajón'); bc.onclick=()=>{mazo='cajon';draw();}; fm.appendChild(bc); }
    p.appendChild(fm);
    const f=el('div','filters');
    types.forEach(t=>{ const b=el('button','btn sm'+(filter===t?' on':''),cap(t)); b.onclick=()=>{filter=t;draw();}; f.appendChild(b); });
    p.appendChild(f);
    const lista=Object.keys(CARDS).filter(k=>!CARDS[k].token&&(filter==='todas'||CARDS[k].t===filter)
      &&(enElCajon?CARDS[k].set==='cajon':!CARDS[k].set)&&(!enMazo||enMazo[k])).sort((a,b)=>CARDS[a].c-CARDS[b].c);
    if(enMazo){ const total=lista.reduce((n,k)=>n+enMazo[k],0);
      p.appendChild(el('div','notagal',`<b>${LEADERS[mazo].n}</b> — ${DECKS[mazo].d} · ${lista.length} distintas`+(filter==='todas'?`, ${total} en total`:''))); }
    const g=el('div','gallery');
    lista.forEach(k=>{ const c=cardEl(k,{}); if(enMazo&&enMazo[k]>1) c.appendChild(el('div','copias','×'+enMazo[k])); g.appendChild(c); });
    p.appendChild(g);
    requestAnimationFrame(()=>encajarTextos(g));
    if(!lista.length) p.appendChild(el('div','notagal','No hay cartas con ese filtro.'));
    const c=el('button','btn','Cerrar'); c.style.marginTop='14px'; c.style.width='100%'; c.onclick=cerrarOv; p.appendChild(c);
  };
  draw(); openOv();
}
function showGrave(){
  const p=$('#ovPanel'); p.innerHTML='<h3>🕳️ Las Alcantarillas</h3>';
  [ME,FOE].forEach(s=>{
    p.appendChild(el('div','',`<div style="color:var(--gold);margin:10px 0 4px;font-weight:700">${P(s).L.n} — ${P(s).grave.length} cartas</div>`));
    const g=el('div','gallery');
    [...new Set(P(s).grave)].forEach(id=>{ const c=cardEl(id,{ladoArte:s}); const n=P(s).grave.filter(x=>x===id).length;
      if(n>1) c.appendChild(el('div','copias','×'+n)); g.appendChild(c); });
    if(!P(s).grave.length) g.appendChild(el('div','',`<span style="color:var(--dim)">Vacío.</span>`));
    p.appendChild(g);
  });
  const c=el('button','btn','Cerrar'); c.style.marginTop='14px'; c.style.width='100%'; c.onclick=cerrarOv; p.appendChild(c);
  openOv(); requestAnimationFrame(()=>encajarTextos(p));
}
function showRecords(){
  const p=$('#ovPanel');
  p.innerHTML='<h3>🏆 Tus récords</h3>'+recordsHTML();
  const box=el('div','opts');
  const c=el('button','btn','Cerrar'); c.onclick=()=>{ cerrarOv(); };
  const b=el('button','btn sm','Borrar récords'); b.onclick=()=>{ if(confirm('¿Borrar todos los récords de este navegador?')){ borrarRecords(); showRecords(); } };
  box.appendChild(c); box.appendChild(b); p.appendChild(box); openOv();
}
function showRules(inGame){
  const p=$('#ovPanel'); p.innerHTML='<h3>📜 Reglas del Domo</h3>'+RULES_HTML;
  const c=el('button','btn','Cerrar'); c.style.marginTop='14px'; c.style.width='100%';
  c.onclick=()=>cerrarOv();
  p.appendChild(c); openOv();
}
function salirAlMenu(){
  tutEnd(); clearPrompt(); SEL=null; TGT=null; cerrarOv(); cerrarHojas();
  if(NET.on){ netSend({t:'bye'}); setTimeout(netClose,400); }
  showScreen('menu');
}
function pedirSalirAlMenu(){
  if(!G||G.over) return salirAlMenu();
  const p=$('#ovPanel');
  p.innerHTML=`<h3>¿Salir al menú?</h3><p>La partida en curso <b>se pierde</b>.${NET.on?' Y tu rival se queda sin partida.':''}</p>`;
  const box=el('div','opts');
  const no=el('button','btn gold','Seguir jugando'); no.onclick=()=>{ cerrarOv(); render(); };
  const si=el('button','btn','Sí, salir'); si.onclick=salirAlMenu;
  box.appendChild(no); box.appendChild(si); p.appendChild(box); openOv();
}

/* ---------- el volado, la cortinilla y el arranque ---------- */
async function volado(nombreRival){ return voladoDomo(nombreRival); }
function cartaDeLiderVS(lid, lado, ladoArte){
  const L=LEADERS[lid], D=DECKS[lid];
  const d=el('div','vscard '+lado,`<div class="lface">${L.art}</div><div class="lname">${L.n}</div><div class="larch">${D.d}</div>`);
  window.CAOZ_COLECCION_JUEGO?.marcar(d,ladoArte);
  ilustrarLider(d,lid); return d;
}
async function cortinillaVS(a,b,opts={}){
  if(opts.silent||opts.fast||opts.auto||opts.volado===false||opts.sinCortinilla||document.hidden) return;
  const capa=el('div','vs'); capa.innerHTML='<div class="vsfondo"></div><div class="vschispas"></div>';
  capa.appendChild(opts.campana?.personaje?campanaCartaJugador(opts.campana.personaje,a,'izq'):cartaDeLiderVS(a,'izq',ME)); capa.appendChild(opts.campana?.jefeSecreto?campanaCartaPitagoras('der'):cartaDeLiderVS(b,'der',FOE)); capa.appendChild(el('div','vssello','VS'));
  if(opts.nombres)capa.querySelectorAll('.lname').forEach((n,i)=>n.textContent=opts.nombres[i]);
  document.body.appendChild(capa);
  await nap(60); capa.classList.add('entra'); await nap(620); capa.classList.add('choque'); window.CAOZ_AUDIO?.play('vs'); await nap(2200);
  capa.classList.add('sale'); await nap(760); capa.remove();
}
async function startMatch(a,b,opts={}){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>startMatch(a,b,opts)))return;
  campanaCancelarInterferencia();
  const mia=++PARTIDA_N;
  tutEnd(); clearPrompt(); SEL=null; TGT=null; cerrarHojas();
  $('#log').innerHTML='';
  showScreen('board');
  const conVolado=opts.volado!==false;
  await cortinillaVS(a,b,opts);
  if(mia!==PARTIDA_N) return;
  const first=conVolado ? await volado(opts.nombres?.[1]||LEADERS[b].n) : (opts.first!=null?opts.first:null);
  if(mia!==PARTIDA_N)return;
  if(conVolado&&first==null){showScreen('menu');return;}
  await setupMatch(a,b,{...(first==null?{}:{first}),...(opts.campana?{campana:opts.campana}:{})});
}
function endGame(winner, why){
  if(G.over) return;
  G.over=true; G.winner=winner; G.endWhy=why;
  campanaCancelarInterferencia();
  log(`<b>=== FIN: gana ${P(winner).L.n} ===</b>`);
  if(TUT.on){
    const k=TUT_STEPS.findIndex(x=>x.strat);
    if(k>=0){
      if(TUT.i<k){ if(TUT.pending){ const r=TUT.pending; TUT.pending=null; r(); }
        TUT.i=k; TUT.bubble=0; TUT.data=null; TUT.block=0; TUT.stepTurn=null; TUT.jugadas=null;
        document.body.classList.remove('tutpause'); }
      TUT.endArgs=[winner,why]; tutRender(); return;
    }
  }
  const g0=G; setTimeout(()=>{ if(G===g0&&G.over) showEnd(winner,why); },450);
}
function showEnd(winner,why){
  if(G.campana){campanaFinal(winner,why);return;}
  const g0=G;
  RECORD_ULTIMO=null;
  if(!G.tutorial && !G.auto && !G.fast && !G.silent) anotarRecord(winner===ME, P(ME).leaderId, Math.ceil(G.turnNo/2), NET.on?'online':'ia');
  const acciones={
    revancha:()=>{ if(NET.on){ proponerRevancha(); return; }
      startMatch(P(ME).leaderId,P(FOE).leaderId); },
    menu:()=>{ tutEnd(); clearPrompt(); cerrarHojas(); if(NET.on){ netSend({t:'bye'}); setTimeout(netClose,400); } showScreen('menu'); }
  };
  cinematicaFinal(winner,why,acciones).then(hecho=>{ if(!hecho && G===g0) panelFinal(winner,why); });
}
/* el cartel de siempre, con los números */
function panelFinal(winner,why){
  const win=winner===ME, p=$('#ovPanel');
  p.innerHTML=`<h3 style="font-size:24px">${win?'🏆 ¡VICTORIA!':'💀 DERROTA'}</h3><p style="font-size:14.5px">${why}</p>
    <p>Turnos: ${Math.ceil(G.turnNo/2)} · Tu Alma: ${Math.max(0,P(ME).alma)} · Alma rival: ${Math.max(0,P(FOE).alma)}</p>`;
  const box=el('div','opts');
  const again=el('button','btn gold','↺ Revancha');
  again.onclick=()=>{ cerrarOv(); if(NET.on){ proponerRevancha(); return; } startMatch(P(ME).leaderId,P(FOE).leaderId); };
  const menu=el('button','btn','← Menú principal');
  menu.onclick=()=>{ cerrarOv(); tutEnd(); clearPrompt(); if(NET.on){ netSend({t:'bye'}); setTimeout(netClose,400); } showScreen('menu'); };
  box.appendChild(again); box.appendChild(menu); p.appendChild(box); openOv();
}

/* ---------- registro, avisos, preguntas ---------- */
let TICKER_T=null;
function log(txt,cls,priv){
  if(!G) return;
  G.log.push({txt,cls,priv:!!priv});
  if(G.silent) return;
  const L=$('#log'); if(!L) return;
  const d=el('div',cls||'',txt); L.appendChild(d); L.scrollTop=L.scrollHeight;
  while(L.children.length>140) L.removeChild(L.firstChild);
  // y asoma sobre la mano un momento: el registro va en una hoja cerrada
  const t=$('#ticker'); if(t && !$('#panel').classList.contains('on')){
    t.innerHTML=txt; t.classList.add('on');
    clearTimeout(TICKER_T); TICKER_T=setTimeout(()=>t.classList.remove('on'),2800);
  }
}
function toast(t){
  const w=$('#toast'), d=el('div','tst',t); w.appendChild(d);
  setTimeout(()=>{d.style.opacity=0;d.style.transition='.3s';},1400);
  setTimeout(()=>d.remove(),1800);
}
function d20FisicoDisponible(){
  return !!window.CAOZ_D20 && FXON() && (!new URLSearchParams(location.search).has('test')||window.CAOZ_D20_PRUEBA===true);
}
function prepararTiradaD20(label, interactive, meta){return window.CAOZ_D20?.preparar(label,interactive,meta)||Promise.resolve({x:0,z:-.6,fuerza:.6});}
async function rollDice(value, label, interactive, meta, fisica){
  if(fisica&&window.CAOZ_D20){if(!FXON())return;return window.CAOZ_D20.mostrar(value,label,interactive,meta,fisica);}
  if(!FXON()) return;
  const ov=$('#dice'), box=$('#diceBox');
  return new Promise(resolve=>{
    const pide=meta&&meta.necesita?`<div class="dpide">Necesitas <b>${meta.necesita}</b></div>`:'';
    box.innerHTML=`<div class="dtop">${label||'Tirada de d20'}</div>${pide}
      <div class="d20" id="d20v">🎲</div><div class="dlabel" id="dlabel">&nbsp;</div><div class="defecto" id="defecto"></div>
      <button class="btn gold" id="dbtn">${interactive?'🎲 &nbsp;TIRAR EL D20':'Tirando…'}</button>`;
    ov.classList.add('on');
    const v=$('#d20v'), lab=$('#dlabel'), btn=$('#dbtn');
    let cerrado=false;
    const done=()=>{ if(cerrado) return; cerrado=true; ov.classList.remove('on'); resolve(); };
    const girar=async()=>{
      btn.disabled=true; btn.textContent='Tirando…'; v.classList.add('spin'); window.CAOZ_AUDIO?.play('dice_roll');
      const N=interactive?15:9;
      for(let i=0;i<N;i++){ v.textContent=1+rnd(20); await sleep(42+i*(interactive?7:9)); }
      v.classList.remove('spin'); window.CAOZ_AUDIO?.play('dice_land'); v.textContent=value;
      v.className='d20'+(value===20?' crit':value===1?' pifia':'');
      v.animate([{transform:'scale(1.5) rotate(-14deg)'},{transform:'scale(1) rotate(0)'}],{duration:460,easing:'cubic-bezier(.2,1.5,.4,1)'});
      lab.textContent=value===20?'¡CRÍTICO!':value===1?'¡CRÍTICO!':'';
      lab.className='dlabel'+(value===1?' pif':'');
      if(meta&&meta.ok){ const bien=meta.ok(value), ef=$('#defecto'); ef.className='defecto '+(bien?'bien':'mal'); ef.innerHTML=(bien?'✔ ':'✘ ')+(bien?meta.siOk:meta.siMal); }
      btn.disabled=false; btn.textContent='Continuar →'; btn.onclick=done;
      if(!interactive) setTimeout(done, meta?2600:1500);
    };
    if(interactive) btn.onclick=girar; else setTimeout(girar,320);
  });
}
function setPrompt(msg,btns){
  $('#pmsg').innerHTML=msg;
  const b=$('#pbtns'); b.innerHTML='';
  (btns||[]).forEach(x=>{ const e=el('button','btn sm '+(x.cls||''),x.t); e.onclick=x.fn; b.appendChild(e); });
  $('#prompt').classList.add('on');
}
function clearPrompt(){ $('#prompt').classList.remove('on'); }
function ask(s,title,options,aiFn,opts={}){
  if(NET.host&&s===FOE) return netAsk({kind:'ask',title,options,fallback:0});
  if(s!==ME||G.auto) return Promise.resolve(aiFn?aiFn(G,s):0);
  return new Promise(res=>{
    const p=$('#ovPanel'); p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','opts');
    options.forEach((o,i)=>{ const b=el('button','btn',o); b.onclick=()=>{ cerrarOv(); res(i); }; box.appendChild(b); });
    p.appendChild(box);
    $('#ov').classList.toggle('suave', !!opts.suave);
    if(opts.mirandoMano) $('#hand').classList.add('mirando');
    openOv();
  });
}
function pickCard(s,ids,title,cancellable){
  if(NET.host&&s===FOE) return netAsk({kind:'pick',ids,title,cancellable:!!cancellable,fallback:cancellable?null:ids[0]});
  if(s!==ME||G.auto) return Promise.resolve(cancellable?null:ids[0]);
  return new Promise(res=>{
    const p=$('#ovPanel'); p.innerHTML=`<h3>${title}</h3><p>Toca una carta para elegirla; mantenla pulsada para leerla.</p>`;
    const box=el('div','gallery selectorCartas');
    ids.forEach(id=>{ const c=cardEl(id,{ladoArte:s}); c.onclick=()=>{ cerrarOv(); res(id); }; box.appendChild(c); });
    p.appendChild(box);
    if(cancellable){ const b=el('button','btn','Pasar'); b.style.marginTop='12px'; b.style.width='100%'; b.onclick=()=>{ cerrarOv(); res(null); }; p.appendChild(b); }
    openOv(); requestAnimationFrame(()=>encajarTextos(box));
  });
}
function pickFrom(s,list,title){
  if(NET.host&&s===FOE) return netAsk({kind:'from',title,list:list.map(o=>({id:o.id,en:o.unit?o.unit.card.n:null})),fallback:0}).then(i=>list[i|0]||list[0]);
  if(s!==ME||G.auto) return Promise.resolve(list[0]);
  return new Promise(res=>{
    const p=$('#ovPanel'); p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','opts');
    list.forEach(o=>{ const b=el('button','btn',CARDS[o.id].art+' '+CARDS[o.id].n+(o.unit?` (en ${o.unit.card.n})`:' (Reliquia)'));
      b.onclick=()=>{ cerrarOv(); res(o); }; box.appendChild(b); });
    p.appendChild(box); openOv();
  });
}
function pickIndex(list,title){
  return new Promise(res=>{
    const p=$('#ovPanel'); p.innerHTML=`<h3>${title}</h3>`;
    const box=el('div','opts');
    list.forEach((o,i)=>{ const b=el('button','btn',(CARDS[o.id]?CARDS[o.id].art+' '+CARDS[o.id].n:o.id)+(o.en?' (en '+o.en+')':''));
      b.onclick=()=>{ cerrarOv(); res(i); }; box.appendChild(b); });
    p.appendChild(box); openOv();
  });
}
async function revelarCarta(cardId, aMano, side){
  if(!FXON()||G.auto) return;
  const mio=side===ME, p=$('#ovPanel');
  p.innerHTML=`<h3>👀 ${mio?'Miras':P(side).L.n+' mira'} el mazo rival</h3>
    <div class="revela"><div id="revelaHueco"></div><div class="adonde ${aMano?'mano':'grave'}">
      ${aMano?'➜ '+(mio?'A TU MANO':'A SU MANO'):'➜ A LAS ALCANTARILLAS'}
      <small>${aMano?'Es un Objeto: quien mira se lo queda.':'No es un Objeto: se descarta y se pierde.'}</small></div></div>`;
  const carta=cardEl(cardId,{ladoArte:1-side}); $('#revelaHueco').appendChild(carta); openOv();
  if(mio){ await new Promise(ok=>{ const box=el('div','opts'); const b=el('button','btn gold','Continuar'); b.onclick=ok; box.appendChild(b); p.appendChild(box); }); }
  else await nap(2600);
  carta.animate([{transform:'scale(1)',opacity:1},{transform:`translateY(${aMano?'160px':'-40px'}) scale(.5)`,opacity:0}],{duration:520,easing:'cubic-bezier(.4,0,.7,1)'});
  await nap(540); cerrarOv();
}
/* ---------- cartas ---------- */
function cardEl(id,opt={}){
  const c=CARDS[id], d=el('div','card t-'+c.t);
  window.CAOZ_COLECCION_JUEGO?.marcar(d,opt.ladoArte??opt.side);
  const cost=opt.side!=null&&G ? costOf(id,opt.side) : c.c, disc=cost<c.c;
  d.innerHTML=`<div class="top"><div class="cost${disc?' rebajado':''}">${cost}</div><div class="nm">${c.n}</div></div>
    ${c.r===2?'<div class="rar">★</div><i class="foil" aria-hidden="true"></i>':''}
    <div class="art">${c.art}</div><div class="tribe">${tribeLine(c)}</div><div class="txt">${c.x||''}</div>
    ${c.t==='personaje'?`<div class="stats"><span class="atk">${c.a}</span><span class="hp">${c.h}</span></div>`:''}`;
  d.dataset.card=id;
  ilustrar(d,id);
  pulsacionLarga(d, ()=>abrirFicha(id,null,{origen:d}));
  return d;
}
function unitEl(u){
  const d=el('div','card unit t-personaje'); d.dataset.uid=u.uid;
  unitFill(d,u);
  pulsacionLarga(d, ()=>abrirFicha(u.card.id,u,{origen:d}));
  return d;
}
function unitFill(d,u){
  const c=u.card, kw=[];
  window.CAOZ_COLECCION_JUEGO?.marcar(d,u.side);
  u.keys.forEach(k=>{ const m={prisa:['Prisa','good'],provocar:['Provocar','pro'],vuelo:['Vuelo','vue'],sigilo:['Sigilo','sig'],
    arquero:['Arquero','vue'],regeneracion:['Regen','good'],sinhonor:['Sin honor','']}[k]; if(m) kw.push(`<span class="kw ${m[1]}">${m[0]}</span>`); });
  if(u.stunned>0) kw.push('<span class="kw bad">Aturdido</span>');
  if(u.infected) kw.push('<span class="kw bad">Infectado</span>');
  if(u.possessed) kw.push('<span class="kw bad">Poseído</span>');
  if(u.doomed) kw.push('<span class="kw bad">Condenado</span>');
  const hp=Math.max(0,u.maxHp-u.dmg);
  d.innerHTML=`<div class="top"><div class="cost">${c.c}</div><div class="nm">${c.n}</div></div>
    ${c.r===2?'<div class="rar">★</div><i class="foil" aria-hidden="true"></i>':''}
    <div class="art">${c.art}</div><div class="tribe">${u.tribes.join(' · ')}</div>
    <div class="keys">${kw.join('')}${nombresDeHabilidad(c.id).map(n=>`<span class="kw hab">${n}</span>`).join('')}</div>
    ${u.objs.length?`<div class="eq">${u.objs.map(o=>`<span>${CARDS[o]?CARDS[o].art:'✨'}</span>`).join('')}</div>`:''}
    <div class="stats"><span class="atk">${u.atk}</span><span class="hp">${hp}</span></div>`;
  ilustrar(d,c.id);
}

/* ---------- la ficha: la carta en grande, en una hoja ---------- */
function abrirFicha(id,u,opts={}){
  const box=$('#inspectCard');
  window.CAOZ_COLECCION_JUEGO?.ficha(box,opts.ladoArte??window.CAOZ_COLECCION_JUEGO?.lado(opts.origen)??u?.side,opts.origen);
  box.className='big t-'+(CARDS[id]?CARDS[id].t:'personaje');
  box.innerHTML=inspectHTML(id,u);
  const art=box.querySelector('.art'), enc=CAOZ_ARTE.encuadre(id,'movil_detalle',box);
  if(art){art.dataset.arteId=id;CAOZ_ARTE.acabar(art,id);}
  if(art&&enc){ art.classList.add('conarte'); art.style.setProperty('--ex',enc.x+'%'); art.style.setProperty('--ey',enc.y+'%');
    art.style.setProperty('--ez',(enc.z/100).toFixed(3));
    art.insertAdjacentHTML('afterbegin',`<div class="marcoDibujo"><img alt="" src="${urlArte(id,art)}"></div>`); }
  if(u){
    const mods=modificadoresDe(u);
    if(mods) box.insertAdjacentHTML('beforeend',`<div class="mods">${mods}</div>`);
    if(u.side===ME && G && !canAttack(u)) box.insertAdjacentHTML('beforeend',`<div class="porque">✕ ${porQueNoAtaca(u)}</div>`);
  }
  const btns=$('#inspectBtns'); btns.innerHTML='';
  if(opts.jugar){
    const b=el('button','btn gold','▶ Jugar '+CARDS[id].n);
    b.onclick=()=>{ cerrarHojas(); jugarDeLaMano(id); }; btns.appendChild(b);
  }
  const c=el('button','btn','Cerrar'); c.onclick=cerrarHojas; btns.appendChild(c);
  abrirHoja('inspect');
  $('#inspect .hcuerpo').scrollTop=0;
}
function fichaLider(side){
  const p=P(side), L=p.L, box=$('#inspectCard');
  window.CAOZ_COLECCION_JUEGO?.ficha(box,side);
  box.className='big';
  const enc=CAOZ_ARTE.encuadre('lider_'+p.leaderId,'movil_detalle',box);
  box.innerHTML=`<div class="top"><div class="cost">★</div><div class="nm">${L.n}</div></div>
    <div data-arte-id="lider_${p.leaderId}" class="art${enc?' conarte':''}"${enc?` style="--ex:${enc.x}%;--ey:${enc.y}%;--ez:${(enc.z/100).toFixed(3)}"`:''}>${
      enc?`<div class="marcoDibujo"><img alt="" src="${urlArte('lider_'+p.leaderId,box)}"></div>`:''}${L.art}</div>
    <div class="tribe">${L.ep} · ${L.arch}</div>
    <div class="txt" style="font-style:italic;color:#a99ac6;font-size:12px">${L.lore}</div>
    <div class="bigsep"></div><div class="txt">${L.pasiva}</div><div class="bigsep"></div><div class="txt">${L.hab}</div>
    ${L.hab2?`<div class="txt">${'<b>'+L.hab2.n+':</b> '+L.hab2.d}</div>`:''}
    <div class="bigsep"></div><div class="bigrow">❤️ Alma ${Math.max(0,p.alma)} · 🔷 ${p.pd}/${p.pdMax} · 🗝️ ${keys(side)}</div>`;
  const btns=$('#inspectBtns'); btns.innerHTML='';
  const c=el('button','btn','Cerrar'); c.onclick=cerrarHojas; btns.appendChild(c);
  campanaVestirFicha(box,side);if(side===FOE&&G.campana?.jefeSecreto)campanaVestirPitagoras(box);CAOZ_ARTE.acabar(box,'lider_'+p.leaderId);
  abrirHoja('inspect');
}
/* el motor la llama al seleccionar una unidad; aquí la ficha taparía a los
   objetivos, así que no se abre: el aviso de abajo ya dice qué hacer y la
   pulsación larga enseña la carta cuando se quiera */
function fichaTactil(u){}

/* ---------- jugar de la mano ---------- */
async function jugarDeLaMano(id){
  if(TGT||G.resolving) return;
  if(!tutCan('hand',id)){ tutNope(); return; }
  if(!canPlay(ME,id)){ const w=whyNot(ME,id); toast(w); log(`No puedes jugar <b>${CARDS[id].n}</b> — ${w}.`,'sys',true); return; }
  if(!await confirmarNubeDagas(id)||!canPlay(ME,id)||G.resolving||TGT)return;
  SEL=null; clearPrompt(); manoTocada(null);
  if(NET.guest){ gIntent('play',{id}); return; }
  playFromHand(ME,id);
}
function manoTocada(d){
  $$('#hand .card.tocada').forEach(x=>{ if(x!==d) x.classList.remove('tocada'); });
  const pill=$('#jugarPill');
  if(!d){ pill.classList.remove('on'); pill.innerHTML=''; return; }
  d.classList.add('tocada');
  const id=d.dataset.card, c=CARDS[id], ok=!G.resolving&&canPlay(ME,id)&&tutCan('hand',id);
  pill.innerHTML=`<span><b>${c.n}</b> · ${costOf(id,ME)} PD</span>`;
  const ver=el('button','btn sm','Ver'); ver.onclick=e=>{ e.stopPropagation(); abrirFicha(id,null,{jugar:ok,ladoArte:ME}); };
  pill.appendChild(ver);
  if(ok){ const b=el('button','btn sm gold','▶ Jugar'); b.onclick=e=>{ e.stopPropagation(); jugarDeLaMano(id); }; pill.appendChild(b); }
  else if(G.active===ME){ const w=el('span','porque'); w.textContent=whyNot(ME,id); pill.appendChild(w); }
  const cerrar=el('button','cerrarPill','×');cerrar.type='button';cerrar.setAttribute('aria-label','Cerrar menú de carta');
  cerrar.onclick=e=>{e.preventDefault();e.stopPropagation();manoTocada(null);};pill.appendChild(cerrar);
  pill.classList.add('on');
  d.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
}

/* ---------- el tablero ---------- */
function renderLeaders(){
  { const mia=P(ME).alma, suya=P(FOE).alma, viva=!G.over;
    const peligro=viva&&mia>0&&mia<=5;
    document.body.classList.toggle('peligro',peligro);
    document.documentElement.style.setProperty('--peligro', peligro?((6-mia)/6).toFixed(2):'0');
    document.body.classList.toggle('remate', viva&&suya>0&&suya<=5); }
  [[FOE,'#leaderFoe'],[ME,'#leaderMe']].forEach(([side,sel])=>{
    const host=$(sel); if(!host) return;
    const p=P(side), L=p.L, mine=side===ME;
    const usable=mine&&!TGT&&!G.resolving&&canUseLeader(side)&&tutCan('leader');
    const target=!mine&&((TGT&&isTargetable('face'))||(SEL&&canAttack(SEL)&&legalTargets(SEL).face));
    host.innerHTML=`<div class="lider${usable?' usable':''}${(mine&&p.leaderUsed)?' spent':''}${target?' tgt':''}" id="lead${side}">
      ${rostroLider(p.leaderId,side)}
      <div><div class="ln">${L.n}</div><div class="lh">${mine?L.habName+' · <b>'+(p.leaderUsed?'usada':L.habCost+' PD')+'</b>':L.ep}</div></div></div>`;
    const e=host.firstElementChild;
    if(mine&&G.campana?.personaje)campanaVestirLider(e,G.campana.personaje,p.leaderId);
    if(!mine&&G.campana?.jefeSecreto)campanaVestirPitagoras(e);
    if(e.matches('.liderJugador,.identidadPitagoras'))CAOZ_ARTE.acabar(e,'lider_'+p.leaderId);
    e.onclick=()=>{
      if(TGT){ pickTarget(mine?null:'face'); return; }
      if(!mine){ if(SEL&&canAttack(SEL)){ if(!tutCan('attack','face')){ tutNope(); return; } tryAttack(SEL,'face'); } else fichaLider(side); return; }
      if(G.resolving) return;
      if(!tutCan('leader')){ tutNope(); return; }
      if(usable){ if(NET.guest){ gIntent('leader'); return; } useLeader(ME); }
      else if(G.active===ME) toast(whyNotLeader(ME));
      else fichaLider(side);
    };
    pulsacionLarga(e, ()=>fichaLider(side));
  });
}
function renderField(host, list, mine){
  const seen=new Set();
  list.forEach((u,i)=>{
    seen.add(String(u.uid));
    let d=host.querySelector(':scope > [data-uid="'+u.uid+'"]');
    if(!d){ d=unitEl(u); host.appendChild(d); fxSummon(d); }
    else { const pa=d.dataset.a, ph=d.dataset.h; unitFill(d,u);
      if(pa!==undefined&&FXON()){ const da=u.atk-(+pa), dh=u.maxHp-(+ph);
        if(da>0||dh>0) fxBuff(u,(da>0?'+'+da+' ATQ':'')+(da>0&&dh>0?' ':'')+(dh>0?'+'+dh+' PV':''));
        else if(da<0) fxNumber(u,da+' ATQ','dmg');
        if(da!==0) fxPop(d.querySelector('.atk'), da>0?'#ffd25c':'#ff6b5f'); }
      const pv=d.dataset.pv;
      if(pv!==undefined&&+pv!==u.maxHp-u.dmg) fxPop(d.querySelector('.hp'), (u.maxHp-u.dmg)>(+pv)?'#5cf5a4':'#ff6b5f'); }
    d.dataset.pv=u.maxHp-u.dmg; d.dataset.a=u.atk; d.dataset.h=u.maxHp;
    const rest=(u.sick&&!u.keys.has('prisa'))||u.stunned>0;
    const tgt=(TGT&&isTargetable(u))||(!mine&&SEL&&canAttack(SEL)&&legalTargets(SEL).units.includes(u));
    const gastada=mine&&!canAttack(u)&&!u.card.noAttack&&u.atk>0;
    const acomodo=d.classList.contains('conarte')?' acomodo conarte':d.classList.contains('sinarte')?' acomodo sinarte':'';
    d.className='card unit t-personaje'+acomodo+(rest?' sick':'')+(u.infected?' infectado':'')
      +((mine&&!rest&&canAttack(u))?' ready':'')+(tgt?' tgt':'')+(gastada?' gastada':'')+((mine&&SEL===u)?' selected':'');
    d.onclick=mine
      ? ()=>{ if(TGT){ pickTarget(u); return; }
              if(SEL===u){ SEL=null; clearPrompt(); render(); return; }
              if(!tutCan('select')){ tutNope(); return; }
              if(G.active!==ME){ abrirFicha(u.card.id,u); return; }
              selectUnit(u); }
      : ()=>{ if(TGT){ pickTarget(u); return; }
              if(SEL&&canAttack(SEL)){ if(!tutCan('attack','unit')){ tutNope(); return; } tryAttack(SEL,u); }
              else abrirFicha(u.card.id,u); };
    if(host.children[i]!==d) host.insertBefore(d, host.children[i]||null);
  });
  [...host.children].forEach(d=>{ if(!seen.has(d.dataset.uid)) d.remove(); });
}
function pilasHTML(side){
  const p=P(side), me=side===ME;
  return `<div class="stat pila" id="${me?'myDeckPile':'foeDeckPile'}" title="Mazo">🂠 <i>${p.deck.length}</i></div>`;
}
function render(){
  if(!G||G.silent) return;
  campanaPrepararRival();
  if(NET.host) netPushState();
  $('#barFoe').innerHTML=barHTML(FOE); $('#pilasFoe').innerHTML=pilasHTML(FOE);
  $('#barMe').innerHTML=barHTML(ME);   $('#pilasMe').innerHTML=pilasHTML(ME);
  $('#pilasFoe').appendChild(crearPilaAlcantarillas(FOE));
  $('#pilasMe').appendChild(crearPilaAlcantarillas(ME));
  const ft=$('#foeTraps'); ft.innerHTML='';
  P(FOE).traps.forEach(t=>{ ft.appendChild(el('div','trapback', t.revealed?CARDS[t.id].art:'🪤')); });
  renderLeaders();
  renderField($('#foeField'), P(FOE).field, false);
  renderField($('#myField'),  P(ME).field,  true);
  const mt=$('#myTraps'); mt.innerHTML='';
  P(ME).traps.forEach(t=>{ const c=CARDS[t.id]; const d=el('div','trapback mine',c.art);
    d.onclick=()=>abrirFicha(t.id,null,{ladoArte:ME}); mt.appendChild(d); });
  renderNubesDagas();
  const mid=$('#midRow'); mid.innerHTML='';
  if(G.place){ const c=CARDS[G.place.id];
    const d=el('div','placecard',`<span class="pi">${c.art}</span><div><div class="pn">${c.n} <span style="color:var(--dim);font-weight:400">(${P(G.place.side).L.n})</span></div><div class="pt">${c.x}</div></div>`);
    if(TGT&&isTargetable(G.place)) d.classList.add('tgt');
    d.onclick=()=>{ if(TGT){ pickTarget(G.place); return; } abrirFicha(G.place.id,null,{ladoArte:G.place.side}); };
    mid.appendChild(d);
  } else mid.appendChild(el('div','',`<span style="color:#4c4266;font-size:9px;letter-spacing:2px">— SIN LUGAR ACTIVO —</span>`));
  P(ME).relics.forEach(r=>{ const c=CARDS[r.id]; if(!c.relicAct) return;
    const b=el('button','btn sm',`${c.art} ${c.relicAct.n} (${r.counters||0})`);
    b.disabled=!!TGT||G.resolving||G.active!==ME||G.over||P(ME).pd<c.relicAct.cost;
    b.onclick=()=>{ if(TGT||G.resolving) return; if(NET.guest){ gIntent('relic',{id:r.id}); return; } useRelic(ME,r); }; mid.appendChild(b); });
  // la mano: se reconcilia, no se rehace (la carta tocada sobrevive al repintado)
  const h=$('#hand'), mano=P(ME).hand;
  const viejos=[...h.children]; let j=0;
  mano.forEach((id,iMano)=>{
    let d=null;
    while(j<viejos.length){ const v=viejos[j];
      if(v.dataset.card===id){ d=v; j++; break; }
      if(!mano.slice(iMano).includes(v.dataset.card)){ v.remove(); j++; continue; }
      break; }
    if(!d){ d=cardEl(id,{side:ME}); h.insertBefore(d, viejos[j]||null); }
    else { const cost=costOf(id,ME), ce=d.querySelector('.cost');
      if(ce){ ce.textContent=cost; ce.classList.toggle('rebajado', cost<CARDS[id].c); }
      d.classList.remove('locked','playable','unplayable','hi'); }
    const ok=!G.resolving&&canPlay(ME,id), libre=tutCan('hand',id);
    d.classList.add(!libre?'locked':(ok?'playable':'unplayable'));
    d.onclick=()=>{ if(TGT||G.resolving) return;
      if(d.classList.contains('tocada')){ jugarDeLaMano(id); return; }
      manoTocada(d); };
  });
  for(;j<viejos.length;j++) viejos[j].remove();
  if(!$('#hand .card.tocada')) manoTocada(null);
  renderControls();
  ajustarCampo();
  window.PITAGORAS_MESA?.actualizar(G);
  if(G.tutorial) tutHighlight();
}
function renderControls(){
  const c=$('#controls'); c.innerHTML='';
  const p=P(ME);
  if(SEL&&SEL.card.act){ const a=SEL.card.act;
    const b=el('button','btn sm',`✨ ${a.n} (${a.cost} PD)`); b.disabled=!!TGT||G.resolving||!canUseAct(SEL);
    b.onclick=()=>{ if(TGT||G.resolving||!canUseAct(SEL)) return; if(NET.guest){ gIntent('act',{uid:SEL.uid}); SEL=null; render(); return; } useAct(SEL); }; c.appendChild(b); }
  const e=el('button','btn gold','Terminar turno ⏭');
  e.disabled=!!TGT||G.active!==ME||G.busy||G.resolving||G.over||!tutCan('end'); e.onclick=pedirTerminarTurno; c.appendChild(e);
  const reloj=el('span','','' ); reloj.id='reloj'; reloj.hidden=true; c.appendChild(reloj);
  if(RELOJ.id||(G.online&&!G.over)) relojPinta();
  c.appendChild(el('span','spacer'));
  const reg=el('button','btn sm','🗒'); reg.id='btnRegistro'; reg.title='Registro';
  reg.onclick=()=>{ abrirHoja('panel'); const L=$('#log'); L.scrollTop=L.scrollHeight; CHAT_SIN_LEER=0; marcarChat();
    const ch=$('#chat'); if(ch) ch.scrollTop=ch.scrollHeight; };
  c.appendChild(reg); marcarChat();
  const r=el('button','btn sm','📜'); r.onclick=()=>showRules(true); c.appendChild(r);
  const s=el('button','btn sm','✕'); s.title='Salir al menú'; s.onclick=pedirSalirAlMenu; c.appendChild(s);
  campanaBotonFinalGero(c);
  window.campanaBotonesEditorBeta?.(c);
}
function relojPara(){ if(RELOJ.id){ clearInterval(RELOJ.id); RELOJ.id=null; } const e=$('#reloj'); if(e) e.hidden=true; }
function relojPinta(){
  const e=$('#reloj'); if(!e) return;
  e.hidden=false;
  const m=Math.floor(RELOJ.queda/60), sg=RELOJ.queda%60;
  e.textContent=`⏱️ ${m}:${String(Math.max(0,sg)).padStart(2,'0')}`;
  e.classList.toggle('poco', RELOJ.queda<=15);
}

/* ---------- tutorial ---------- */
function tutNope(){
  const s=TUT_STEPS[TUT.i];
  toast(s&&s.wait?'El tutorial te pide otra cosa':'Lee lo que dice Gero');
  const box=$('#tut .tutbox');
  if(box) box.animate([{translate:'0 0'},{translate:'-8px 0'},{translate:'8px 0'},{translate:'0 0'}],{duration:300});
}
function tutStart(){
  clearInterval(TUT.poll);
  if(TUT.pending) TUT.pending();
  document.body.classList.remove('tutpause');
  TUT={i:0,on:true,pending:null,bubble:0,foeTurn:0,data:null,poll:null,block:0,stepTurn:null,jugadas:null,endArgs:null,lider:TUT.lider};
  document.body.classList.add('tut-on');
  TUT.poll=setInterval(tutCheck,500);
  tutRender();
}
function tutRender(){
  if(!TUT.on){ $('#tut').classList.remove('on'); return; }
  const s=TUT_STEPS[TUT.i];
  if(!s){ tutEnd(); return; }
  $('#tut').classList.add('on');
  $('#tutStep').textContent=`${TUT.i+1}/${TUT_STEPS.length}`;
  const kind=$('#tutKind'), body=$('#tutBody'), wait=$('#tutWait'), next=$('#tutNext');
  const waiting=s.on&&!TUT.pending&&!(G&&G.over);
  const mustEnd=waiting&&G&&!G.over&&G.active===ME;
  TUT.hint=mustEnd;
  $('#tut').classList.toggle('watch', !!s.on);
  $('#tut').classList.toggle('todo', (!!s.wait&&!s.on)||mustEnd);
  if(waiting){
    kind.textContent=mustEnd?'🎯 TE TOCA':'👁 MIRA AL RIVAL';
    body.innerHTML=(s.wait_t||'<i>Observa. Te aviso en cuanto pase algo que merezca explicación.</i>')
      +(mustEnd?'<br><br><b>👉 Sigue tu turno y pulsa «Terminar turno»</b> para que Adreida juegue.':'');
    wait.textContent=mustEnd?'⏳ Te toca a ti':'⏳';
    next.style.display='none';
  } else {
    const texts=tutTexts(s);
    kind.textContent=s.on?'👁 MIRA AL RIVAL':(s.wait?'🎯 TE TOCA':'🎲 GERO EXPLICA');
    body.innerHTML=texts[TUT.bubble]; body.scrollTop=0;
    const more=TUT.bubble<texts.length-1, isTask=!more&&s.wait;
    wait.textContent=isTask?'⏳ Te toca a ti':'';
    next.style.display=isTask?'none':'';
    next.textContent=more?'Sigue →':(s.last?'¡A jugar! →':'Entendido →');
  }
  /* Arriba cuando el paso mira tu mano o tus controles; abajo cuando mira al
     rival. Y si no señala nada, arriba, que es donde menos tapa. */
  const abajo=!mustEnd&&(!!s.on||/foe|Foe|midRow/.test(s.hi||''));
  $('#tut').classList.toggle('abajo', abajo);
  tutHighlight();
  if(G) render();
}
const tutShow=tutRender;
function tutHighlight(){
  $$('.hi').forEach(e=>e.classList.remove('hi'));
  if(!TUT.on) return;
  const s=TUT_STEPS[TUT.i]; if(!s) return;
  if(s.on&&!TUT.pending){ if(TUT.hint){ const c=$('#controls'); if(c) c.classList.add('hi'); } return; }
  if(!s.hi) return;
  const t=$(s.hi); if(t) t.classList.add('hi');
}
function tutNext(){
  if(!TUT.on) return;
  const s=TUT_STEPS[TUT.i]; if(!s){ tutEnd(); return; }
  if(!(s.on&&!TUT.pending)&&TUT.bubble<tutTexts(s).length-1){ TUT.bubble++; tutRender(); return; }
  const resume=TUT.pending;
  TUT.pending=null; TUT.bubble=0; TUT.data=null; TUT.i++; TUT.block=0; TUT.stepTurn=null; TUT.jugadas=null;
  document.body.classList.remove('tutpause');
  if(s.last){ tutEnd(); } else tutRender();
  if(resume) resume();
}
async function tutBeat(kind,data){
  if(!TUT.on||TUT.pending||G.over) return;
  tutFlush();
  if(!TUT.on) return;
  const fits=c=>c&&c.on===kind&&(!c.when||c.when(G,data));
  let s=TUT_STEPS[TUT.i];
  if(!fits(s)){
    let j=-1;
    for(let k=TUT.i+1;k<Math.min(TUT_STEPS.length,TUT.i+4);k++){ const c=TUT_STEPS[k];
      if(c.wait&&!c.on&&!c.wait(G)) break;
      if(fits(c)){ j=k; break; } }
    if(j<0) return;
    TUT.i=j; s=TUT_STEPS[j];
  }
  TUT.data=data; TUT.bubble=0;
  document.body.classList.add('tutpause');
  cerrarHojas(); render();
  await new Promise(res=>{ TUT.pending=res; tutRender(); });
}
function tutEnd(){
  const pend=TUT.endArgs; TUT.endArgs=null;
  TUT.on=false; document.body.classList.remove('tut-on'); TUT.pending&&TUT.pending();
  TUT.pending=null; if(TUT.poll) clearInterval(TUT.poll);
  document.body.classList.remove('tutpause');
  $('#tut').classList.remove('on'); $$('.hi').forEach(e=>e.classList.remove('hi'));
  if(pend){ const g0=G; setTimeout(()=>{ if(G===g0&&G.over) showEnd(pend[0],pend[1]); },400); }
}
function tutPasivaLista(){
  if(!TUT.on) return true;
  const k=TUT_STEPS.findIndex(x=>x&&x.pasiva);
  return k<0||TUT.i>=k;
}
function showTutorialPick(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>showTutorialPick()))return;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>🎓 ¿Con qué mazo quieres aprender?</h3><p>El tutorial usa las cartas de ese Protagonista y termina enseñándote su estrategia. Si es tu primera partida, Fender es el más directo.</p>`;
  const list=el('div','leaders');
  Object.keys(LEADERS).sort((a,b)=>GUIAS[a].dif-GUIAS[b].dif).forEach(id=>{
    const L=LEADERS[id], D=DECKS[id], g=GUIAS[id];
    const d=el('div','ltile',`<div class="lface">${L.art}</div><div><div class="lname">${L.n}</div><div class="larch">${D.d}</div>
      <div class="lhab">${estrellas(g.dif)} · ${g.lema}</div></div>`);
    ilustrarLider(d,id);
    d.onclick=()=>{ cerrarOv(); $('#log').innerHTML=''; startTutorial(id); };
    list.appendChild(d);
  });
  p.appendChild(list);
  const back=el('button','btn sm','Cancelar'); back.style.marginTop='12px'; back.style.width='100%'; back.onclick=cerrarOv; p.appendChild(back);
  openOv();
}
async function startTutorial(lid){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>startTutorial(lid)))return;
  tutEnd(); cerrarOv(); clearPrompt(); SEL=null; TGT=null;
  lid=lid&&TUT_MAZO[lid]?lid:'fender';
  TUT.lider=lid; TUT_STEPS=buildTut(lid);
  const M=TUT_MAZO[lid];
  newGame(lid,'adreida',{tutorial:true});
  G.fast=false; G.second=FOE;
  const give=(s,list)=>{ list.forEach(c=>{ const i=P(s).deck.indexOf(c); if(i>=0) P(s).deck.splice(i,1); }); P(s).hand=[...list]; };
  give(ME,M.mano); give(FOE,['bartolomeo','mazo','augusto','horton','eric']);
  const top=(s,list)=>{ list.slice().reverse().forEach(c=>{ const i=P(s).deck.indexOf(c); if(i>=0){ P(s).deck.splice(i,1); P(s).deck.unshift(c); } }); };
  top(ME,M.top);
  showScreen('board');
  log('<b>Tutorial del Domo</b> — '+LEADERS[lid].n+' contra Adreida.','sys');
  G.turnNo=0; G.active=FOE;
  tutStart();
  await startTurn(ME);
}

/* ---------- partida online: vestíbulo, estado, chat ---------- */
function netVivos(){ return NET.chs.filter(c=>c.ok); }
addEventListener('click', e=>{ if(e.target.classList&&e.target.classList.contains('diariobtn')){ NETDIARIO.bajar(); toast('Diario descargado'); } });
function netStatus(t,cls){
  if(t!=null) NET.status=t;
  const e=$('#netStatus'); if(e){ e.textContent=NET.status; e.className='netstatus '+(cls||(netVivos().length?'ok':'')); }
  const d=$('#netDiag');
  if(d){ const mq=NET.chs.filter(c=>c.tipo==='mqtt'), ht=NET.chs.filter(c=>c.tipo==='http');
    const err=(NET.chs.find(c=>!c.ok&&c.err)||{}).err;
    d.textContent=`vías: MQTT ${mq.filter(c=>c.ok).length}/${mq.length} · HTTP ${ht.filter(c=>c.ok).length}/${ht.length} · enviados ${NET.tx} · recibidos ${NET.rx}`+(err?` · último fallo: ${err}`:''); }
}
function chatVisible(v){ const z=$('#chatzona'); if(!z) return; z.hidden=!v; if(v&&!$('#chat').children.length) chatVacio(); }
function chatVacio(){ const c=$('#chat'); c.innerHTML=''; const d=el('div','vacio'); d.textContent='Aquí podéis hablar durante la partida.'; c.appendChild(d); }
function chatPinta(mio,quien,texto){
  const c=$('#chat'); if(!c) return;
  const hueco=c.querySelector('.vacio'); if(hueco) hueco.remove();
  const d=el('div','msg '+(mio?'mio':'suyo'));
  const n=el('span','de'); n.textContent=quien+': '; d.appendChild(n); d.appendChild(document.createTextNode(texto));
  c.appendChild(d); c.scrollTop=c.scrollHeight;
  while(c.children.length>120) c.firstChild.remove();
}
function chatMio(){
  const i=$('#chatinput'); if(!i) return;
  const t=i.value.trim().slice(0,CHAT_MAX); i.value='';
  if(!t||!NET.on) return;
  const yo=NET.miNombre||(G?P(ME).L.n:'Tú');
  chatPinta(true,yo,t); netSend({t:'chat',de:yo,txt:t});
}
let CHAT_SIN_LEER=0;
function chatRecibe(m){
  const de=String(m.de||NET.suNombre||'Rival').slice(0,24), tx=String(m.txt||'').slice(0,CHAT_MAX);
  if(!tx) return;
  chatVisible(true); chatPinta(false,de,tx);
  /* El aviso flotante se perdía si llegaba con el dado o una pregunta encima
     —el toast iba por debajo—, o si no se estaba mirando. Ahora va por encima
     de todo, la línea sobre la mano también lo cuenta, y el botón del
     registro lleva la cuenta de lo que queda sin leer hasta que se abre. */
  toast('💬 '+de+': '+tx.slice(0,60));
  const t=$('#ticker'); if(t){ t.textContent='💬 '+de+': '+tx.slice(0,70); t.classList.add('on'); clearTimeout(TICKER_T); TICKER_T=setTimeout(()=>t.classList.remove('on'),4000); }
  if(!$('#panel').classList.contains('on')){ CHAT_SIN_LEER++; marcarChat(); }
  vibra(30);
}
function marcarChat(){
  const b=$('#btnRegistro'); if(!b) return;
  b.classList.toggle('aviso', CHAT_SIN_LEER>0); b.dataset.n=CHAT_SIN_LEER;
}
const NETDIARIO={
  filas:[], max:500,
  apunta(dir,tipo,detalle){ const t=new Date().toISOString().slice(11,23); this.filas.push({t,dir,tipo,...detalle}); if(this.filas.length>this.max) this.filas.shift(); },
  texto(){
    const cab=[`Diario de partida en línea — Caoz Con Todo TCG build ${BUILD.n} (teléfono)`,`Generado: ${new Date().toISOString()}`,
      `Papel: ${NET.host?'anfitrión':'invitado'} · sala: ${NET.sala||'?'} · sid: ${NET.sid||'?'}`,`Enviados: ${NET.seq||0} · recibidos: ${NET.rx||0}`,
      G?`Turno ${G.turnNo} · activo ${G.active===ME?'yo':'rival'} · ${G.over?'terminada':'en curso'}`:'sin partida','─'.repeat(70),''].join('\n');
    return cab+this.filas.map(f=>{ const extra=Object.entries(f).filter(([k])=>!['t','dir','tipo'].includes(k))
      .map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join(' '); return `${f.t}  ${f.dir.padEnd(8)} ${String(f.tipo).padEnd(10)} ${extra}`; }).join('\n');
  },
  bajar(){ const b=new Blob([this.texto()],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b);
    a.download=`caoz-online-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
};
function netHostStart(a,b){return iniciarOnlineHost(a,b);}
function netGuestStart(m){return iniciarOnlineGuest(m);}
function showOnline(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>showOnline()))return;
  ONL={lider:null,nombre:nombreGuardado(),sala:ONL.sala||null};
  const p=$('#ovPanel');
  p.innerHTML=`<h3>👥 Jugar con un amigo</h3><p>Crea una sala y comparte el código con tu amigo.</p>
    <p style="font-size:11.5px;color:#7a6d96">Va por un relevo público gratuito: el código es la única llave de la sala. La partida la lleva el teléfono del anfitrión, así que jugad con alguien de confianza.</p>`;
  const box=el('div','opts');
  const b1=el('button','btn gold','🎲 &nbsp;Crear sala — yo invito'), b2=el('button','btn','🔑 &nbsp;Unirme con un código'), b3=el('button','btn sm','Cancelar');
  b1.onclick=()=>onlPickNombre(true); b2.onclick=()=>onlPickNombre(false); b3.onclick=cerrarOv;
  box.appendChild(b1); box.appendChild(b2); box.appendChild(b3); p.appendChild(box); openOv();
}
function onlPickNombre(asHost){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>onlPickNombre(asHost)))return;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>${asHost?'Crear sala':'Unirse'} — ¿cómo te llamas?</h3><p>Así te verá tu rival en el chat y en los avisos.</p>`;
  onlineAyudaInstalada(p);
  const inp=el('input','nombreinput'); inp.type='text'; inp.maxLength=18; inp.placeholder='Tu nombre'; inp.value=nombreGuardado(); inp.autocomplete='off';
  p.appendChild(inp);
  const box=el('div','opts');
  const ok=el('button','btn gold','Continuar →'), no=el('button','btn sm','← Volver');
  const seguir=()=>{ const n=(inp.value||'').trim().slice(0,18)||(asHost?'Anfitrión':'Invitado'); ONL.nombre=n; guardaNombre(n); onlPickLeader(asHost); };
  ok.onclick=seguir; inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); seguir(); } }; no.onclick=()=>showOnline();
  box.appendChild(ok); box.appendChild(no); p.appendChild(box); openOv();
  setTimeout(()=>inp.focus(),50);
}
function onlPickLeader(asHost){
  const p=$('#ovPanel'); p.innerHTML=`<h3>${asHost?'Crear sala':'Unirse'} — elige tu Protagonista</h3>`;
  const list=el('div','leaders');
  Object.keys(LEADERS).forEach(id=>{ const L=LEADERS[id], D=DECKS[id];
    const d=el('div','ltile',`<div class="lface">${L.art}</div><div><div class="lname">${L.n}</div><div class="larch">${D.d}</div>
      <div class="lhab">${L.habName} · <b>${L.habCost} PD</b></div></div><div class="lmarca">✦</div>`);
    ilustrarLider(d,id);
    d.onclick=()=>{ ONL.lider=id; [...list.children].forEach(c=>c.classList.remove('sel')); d.classList.add('sel'); $('#onlGo').disabled=false; };
    list.appendChild(d); });
  p.appendChild(list);
  const row=el('div','opts');
  const go=el('button','btn gold',asHost?'Crear sala →':'Continuar →'); go.id='onlGo'; go.disabled=true;
  go.onclick=()=>asHost?onlHost():onlJoinCode();
  const back=el('button','btn sm','← Volver'); back.onclick=showOnline;
  row.appendChild(go); row.appendChild(back); p.appendChild(row); openOv();
}
async function onlHost(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>onlHost()))return;
  const code=netCode(), p=$('#ovPanel');
  p.innerHTML=`<h3>Sala creada</h3><p>Pásale este código a tu amigo. En cuanto lo escriba, empezamos.</p>
    <div class="roomcode" id="roomCode">${code}</div><p class="netstatus" id="netStatus">conectando…</p><p class="netdiag" id="netDiag"></p>
    <p style="font-size:11.5px;color:#7a6d96">Cualquiera con el código puede entrar. No lo publiques.</p>`;
  const box=el('div','opts');
  const enlace=enlaceDeSala(code);
  const sh=el('button','btn gold', navigator.share ? '🔗 Compartir enlace' : '🔗 Copiar enlace');
  sh.onclick=()=>compartirEnlace(enlace);
  const cp=el('button','btn','📋 Copiar código'); cp.onclick=()=>{ navigator.clipboard&&navigator.clipboard.writeText(code); toast('Código copiado'); };
  const cancel=el('button','btn sm','Cancelar'); cancel.onclick=()=>{ netSend({t:'bye'}); netClose(); cerrarOv(); };
  box.appendChild(sh); box.appendChild(cp); box.appendChild(cancel); p.appendChild(box); openOv();
  await netConnect(code,true);
  netStatus('esperando a tu amigo…','warn');
  NET.onjoin=(suLider)=>{ cerrarOv(); netHostStart(ONL.lider,suLider); };
  if(NET.joinPend){ const l=NET.joinPend; NET.joinPend=null; NET.onjoin(l); }
}
/* la dirección de la sala: la del juego, sin el nombre de archivo, con ?sala= */
function enlaceDeSala(code){return location.origin+location.pathname.replace(/[^/]*$/,'')+'?sala='+encodeURIComponent(code)+'&b='+BUILD.n;}
async function compartirEnlace(enlace){
  if(navigator.share){ try{ await navigator.share({title:'Caoz Con Todo — El Juego de Cartas', text:'Entra a mi sala del Domo:', url:enlace}); return; }catch(e){ if(e && e.name==='AbortError') return; } }
  if(navigator.clipboard){ try{ await navigator.clipboard.writeText(enlace); toast('Enlace copiado'); return; }catch(e){} }
  toast(enlace);
}
function onlJoinCode(){
  if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>onlJoinCode()))return;
  const p=$('#ovPanel');
  p.innerHTML=`<h3>Unirse a una sala</h3><p>Pega el código o el enlace que te pasó tu amigo.</p>
    <input id="joinCode" class="codeinput" maxlength="300" placeholder="Código o enlace de invitación" autocomplete="off" autocapitalize="characters">
    <p class="netstatus" id="netStatus"></p><p class="netdiag" id="netDiag"></p>`;
  const box=el('div','opts');
  const go=el('button','btn gold','Entrar →');
  go.onclick=async()=>{
    if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>go.click()))return;
    const c=codigoInvitacion($('#joinCode').value);
    if(c.length!==5){ netStatus('El código son 5 caracteres','warn'); return; }
    go.disabled=true; netStatus('conectando…','');
    await netConnect(c,false);
    netStatus('buscando la sala…','warn');
    netSend({t:'join',leader:ONL.lider,nombre:ONL.nombre});
    let intentos=0;
    const reintento=setInterval(()=>{ if(NET.peer||!NET.on){ clearInterval(reintento); return; } intentos++;
      if(intentos>24){ clearInterval(reintento); netStatus('nadie responde. ¿Seguro que el código es ese y tu amigo sigue esperando?','warn'); go.disabled=false; }
      else netStatus('buscando la sala… ('+intentos+')','warn');
      netSend({t:'join',leader:ONL.lider,nombre:ONL.nombre}); },2500);
  };
  const back=el('button','btn sm','← Volver'); back.onclick=()=>{netClose();showOnline();};
  box.appendChild(go); box.appendChild(back); p.appendChild(box); openOv();
  if(ONL.sala){ const i=$('#joinCode'); if(i){ i.value=ONL.sala; } ONL.sala=null; setTimeout(()=>go.click(), 120); }
  setTimeout(()=>{ const i=$('#joinCode'); if(i){ i.focus(); i.oninput=()=>{ if(!i.value.includes('://'))i.value=i.value.toUpperCase(); }; } },80);
}

/* ==========================================================================
   EFECTOS — lo mismo que en escritorio, a la escala del teléfono. Todo tras
   FXON(); las duraciones se encadenan con nap(), nunca con Animation.finished.
   ========================================================================== */
function fxEl(u){ return u&&u.uid!=null ? $('#myField [data-uid="'+u.uid+'"]')||$('#foeField [data-uid="'+u.uid+'"]') : null; }
function fxRect(target){
  if(target==='face0'||target==='face1'){ const a=$('#lead'+(target==='face0'?ME:FOE)); return a?a.getBoundingClientRect():null; }
  const e=target instanceof Element?target:fxEl(target);
  return e?e.getBoundingClientRect():null;
}
function fxAdd(cls,x,y,extra){ const d=el('div',cls); d.style.left=x+'px'; d.style.top=y+'px'; if(extra) Object.assign(d.style,extra); $('#fx').appendChild(d); return d; }
function fxClamp(d){
  const m=8, r=d.getBoundingClientRect();
  let x=parseFloat(d.style.left), y=parseFloat(d.style.top);
  if(r.left<m) x+=m-r.left; if(r.right>innerWidth-m) x-=r.right-(innerWidth-m);
  if(r.top<m) y+=m-r.top; if(r.bottom>innerHeight-m) y-=r.bottom-(innerHeight-m);
  d.style.left=x+'px'; d.style.top=y+'px';
}
function fxGone(d,ms){ const t=ms||900; setTimeout(()=>{ d.style.opacity='0'; },t); setTimeout(()=>d.remove(),t+60); }
function fxNumber(target,text,kind,big){
  if(!FXON()) return;
  const c=fxCenter(target); if(!c) return;
  const off=(FXSTACK++%4)*30; setTimeout(()=>{ FXSTACK=Math.max(0,FXSTACK-1); },1900);
  const d=fxAdd('fxnum '+kind+(big?' xl':''),c.x,c.y-10-off); d.textContent=text; fxClamp(d);
  d.animate([{transform:'translate(-50%,-50%) scale(.45)',opacity:0},{transform:'translate(-50%,-50%) scale(1.3)',opacity:1,offset:.16},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.28},{transform:'translate(-50%,-58%) scale(1)',opacity:1,offset:.8},
    {transform:'translate(-50%,-105%) scale(.94)',opacity:0}],{duration:1900,easing:'cubic-bezier(.2,.9,.3,1)'});
  fxGone(d,1900);
}
function fxSacudida(n,letal){
  if(!FXON()||FX_SUAVE()) return;
  const f=Math.min(1.5,.5+n/6)*(letal?1.4:1), b=$('#field'); if(!b) return;
  b.animate([{translate:'0 0'},{translate:`${-3*f}px ${2*f}px`},{translate:`${3*f}px ${-2*f}px`},{translate:'0 0'}],{duration:240});
}
function fxChispas(x,y,{n=8,color='#ffd58a',fuerza=1}={}){
  if(!FXON()||FX_SUAVE()) return;
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, r=(18+Math.random()*30)*fuerza;
    const d=fxAdd('fxburst',x,y,{width:'6px',height:'6px',color});
    d.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*r}px),calc(-50% + ${Math.sin(a)*r}px)) scale(.2)`,opacity:0}],
      {duration:380+Math.random()*200,easing:'ease-out'});
    fxGone(d,560);
  }
}
function fxAnillo(x,y,color,escala=1){
  if(!FXON()) return;
  const r=fxAdd('fxring',x,y,{color});
  r.animate([{transform:`scale(${.3*escala})`,opacity:.9},{transform:`scale(${1.6*escala})`,opacity:0}],{duration:520,easing:'ease-out'}); fxGone(r,520);
}
async function fxHit(u,amount,opt){
  if(!FXON()) return;
  if(typeof opt!=='object') opt={inf:!!opt};
  const {inf=false,fuego=false,letal=false}=opt||{};
  fxNumber(u,'−'+amount,inf?'inf':'dmg',letal||amount>=5);
  const e=fxEl(u), c=fxCenter(u);
  if(e){
    const f=Math.min(1.6,.7+amount/6);
    e.animate([{translate:'0 0'},{translate:`${-6*f}px ${3*f}px`},{translate:`${5*f}px ${-3*f}px`},{translate:`${-3*f}px ${2*f}px`},{translate:'0 0'}],{duration:340,easing:'ease-out'});
    const tinte=fuego?'brightness(2.2) sepia(1) hue-rotate(-18deg) saturate(7)':'brightness(2.4) sepia(1) hue-rotate(-40deg) saturate(6)';
    e.animate([{filter:'brightness(1)'},{filter:tinte,offset:.15},{filter:'brightness(1)'}],{duration:420});
    if(c){ const b=fxAdd('fxburst',c.x,c.y,{color:fuego?'#ff7a3a':'#ff5a4e'});
      b.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:.95},{transform:'translate(-50%,-50%) scale(1.5)',opacity:0}],{duration:380}); fxGone(b,380);
      fxChispas(c.x,c.y,{n:fuego?10:6,color:fuego?'#ff7a3a':'#ffd58a',fuerza:fuego?1.1:.8});
      if(letal) fxAnillo(c.x,c.y,'#fff',1.4); }
  }
  fxSacudida(amount,letal);
  await nap(letal?260:190);
}
function fxHeal(u,amount){
  if(!FXON()) return;
  fxNumber(u,'+'+amount,'heal');
  const e=fxEl(u); if(e) e.animate([{filter:'brightness(1)'},{filter:'brightness(1.8) hue-rotate(60deg)',offset:.3},{filter:'brightness(1)'}],{duration:520});
}
function fxPop(e,color){
  if(!e||!FXON()) return;
  e.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.6)',filter:'brightness(2.2)',offset:.3},{transform:'scale(1)',filter:'brightness(1)'}],{duration:520});
  e.style.boxShadow='0 0 12px '+color; setTimeout(()=>{ e.style.boxShadow=''; },520);
}
function fxBuff(u,text){
  if(!FXON()) return;
  fxNumber(u,text,'buff');
  const e=fxEl(u); if(e) e.animate([{scale:'1'},{scale:'1.1',offset:.35},{scale:'1'}],{duration:420});
}
async function fxLunge(att,target){
  if(!FXON()) return;
  const e=fxEl(att), from=fxCenter(att), to=fxCenter(target==='face'?(att.side===ME?'face1':'face0'):target);
  if(!e||!from||!to){ await nap(120); return; }
  { const destino=target==='face'?(att.side===ME?P(FOE).L.n:P(ME).L.n):target.card.n;
    const et=fxAdd('fxlabel',(from.x+to.x)/2,(from.y+to.y)/2-30,{color:'#ffb36b'});
    et.textContent=att.card.n+' ataca a '+destino;
    et.animate([{opacity:0},{opacity:1,offset:.25},{opacity:1,offset:.75},{opacity:0}],{duration:1000}); fxGone(et,1000);
    if(att.side!==ME){ e.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:620}); await nap(640); } }
  const dx=(to.x-from.x)*.5, dy=(to.y-from.y)*.5;
  e.style.zIndex=60;
  const ida=e.animate([{translate:'0 0'},{translate:`${dx*-0.2}px ${dy*-0.2}px`,offset:.35},{translate:`${dx}px ${dy}px`}],
    {duration:300,easing:'cubic-bezier(.45,-0.3,.6,1)',fill:'forwards'});
  await nap(300);
  const mx=from.x+(to.x-from.x)*.55, my=from.y+(to.y-from.y)*.55, ang=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
  const sl=fxAdd('fxslash',mx,my,{transform:`rotate(${ang}deg)`});
  sl.animate([{opacity:0},{opacity:1,offset:.4},{opacity:0}],{duration:320}); fxGone(sl,320);
  fxChispas(mx,my,{n:10,color:'#ffd58a',fuerza:1}); fxAnillo(mx,my,'#ffd58a',.9);
  await nap(70);
  e.animate([{translate:`${dx}px ${dy}px`},{translate:'0 0'}],{duration:220,easing:'cubic-bezier(.2,.8,.3,1)'});
  ida.cancel();
  setTimeout(()=>{ e.style.zIndex=''; },260);
}
async function fxFace(side,amount){
  if(!FXON()) return;
  const av=$('#lead'+side), fld=$('#field').getBoundingClientRect();
  if(av){ const off=(FXSTACK++%3)*26; setTimeout(()=>{FXSTACK=Math.max(0,FXSTACK-1);},900);
    const d=fxAdd('fxnum dmg xl',fld.left+fld.width/2, side===ME?fld.bottom-40-off:fld.top+40+off);
    d.textContent='−'+amount+' ❤️'; fxClamp(d);
    d.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:0},{transform:'translate(-50%,-50%) scale(1.3)',opacity:1,offset:.16},
      {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.3},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.74},
      {transform:'translate(-50%,-90%) scale(.94)',opacity:0}],{duration:1450,easing:'cubic-bezier(.2,.9,.3,1)'}); fxGone(d,1450);
    av.animate([{translate:'0 0',scale:'1'},{translate:'-5px 0',scale:'1.06'},{translate:'5px 0',scale:'1.04'},{translate:'0 0',scale:'1'}],{duration:460}); }
  fxStat(side,'.stat.alma');
  const v=el('div','fxvig'); v.style.color='rgba(224,40,40,.55)'; document.body.appendChild(v);
  v.animate([{opacity:0},{opacity:1,offset:.25},{opacity:0}],{duration:520}); fxGone(v,520);
  fxSacudida(amount);
  if(side===ME) vibra(40);
  await nap(300);
}
function fxDraw(side){
  if(!FXON()) return;
  const pile=$(side===ME?'#myDeckPile':'#foeDeckPile'); if(!pile) return;
  const r=pile.getBoundingClientRect(), dst=$(side===ME?'#hand':'#barFoe'); if(!dst) return;
  const t=dst.getBoundingClientRect();
  const d=fxAdd('fxfly',r.left+r.width/2,r.top+r.height/2);
  d.animate([{transform:'translate(-50%,-50%) scale(.6) rotate(-8deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.2},
    {transform:`translate(${t.left+t.width/2-(r.left+r.width/2)-15}px,${t.top+t.height/2-(r.top+r.height/2)-20}px) scale(.75)`,opacity:0}],
    {duration:620,easing:'cubic-bezier(.3,.7,.3,1)'}); fxGone(d,620);
  pile.animate([{translate:'0 0'},{translate:'0 3px'},{translate:'0 0'}],{duration:340});
}
function fxObj(target,objId,text){
  if(!FXON()) return;
  const c=fxCenter(target), art=CARDS[objId]?CARDS[objId].art:'✨';
  const x=c?c.x:innerWidth/2, y=c?c.y-40:innerHeight/2;
  const d=fxAdd('fxlabel',x,y,{color:'var(--c-objeto)'}); d.innerHTML=art+' '+(text||CARDS[objId].n); fxClamp(d);
  d.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:0},{transform:'translate(-50%,-50%) scale(1.12)',opacity:1,offset:.2},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.74},{transform:'translate(-50%,-120%) scale(.94)',opacity:0}],{duration:1750}); fxGone(d,1750);
}
function fxRecolocaAvisos(){ FX_AVISOS.forEach((d,i)=>{ d.style.setProperty('--fila',i); }); }
function fxNotice(text,color){
  if(!FXON()) return;
  const b=$('#field'); if(!b) return;
  const r=b.getBoundingClientRect();
  const d=fxAdd('fxlabel apilado',r.left+r.width/2,r.top+r.height/2,{color:color||'var(--gold)'});
  d.innerHTML=text; FX_AVISOS.push(d); fxRecolocaAvisos(); fxClamp(d);
  d.animate([{opacity:0,scale:'.6'},{opacity:1,scale:'1.1',offset:.22},{opacity:1,scale:'1',offset:.72},{opacity:0,scale:'.95'}],{duration:1750}); fxGone(d,1750);
  setTimeout(()=>{ const i=FX_AVISOS.indexOf(d); if(i>=0){ FX_AVISOS.splice(i,1); fxRecolocaAvisos(); } },1750);
}
function fxSummon(e){ if(!FXON()||!e) return; e.animate([{scale:'.5',opacity:0},{scale:'1.06',opacity:1,offset:.7},{scale:'1',opacity:1}],{duration:380,easing:'cubic-bezier(.2,.9,.3,1.3)'}); }
async function fxDeath(u){
  if(!FXON()) return;
  const e=fxEl(u), c=fxCenter(u);
  if(c){ const b=fxAdd('fxnum dmg xl plain',c.x,c.y+24); b.textContent='💀';
    b.animate([{transform:'translate(-50%,-50%) scale(.3) rotate(-20deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1.3) rotate(6deg)',opacity:1,offset:.22},
      {transform:'translate(-50%,-62%) scale(1.1)',opacity:1,offset:.75},{transform:'translate(-50%,-105%) scale(.9)',opacity:0}],{duration:1300}); fxGone(b,1300); }
  if(e){ e.style.pointerEvents='none';
    const pile=$(u.owner===ME?'#myGravePile':'#foeGravePile'), er=e.getBoundingClientRect(), pr=pile?pile.getBoundingClientRect():null;
    const dx=pr?pr.left+pr.width/2-(er.left+er.width/2):0, dy=pr?pr.top+pr.height/2-(er.top+er.height/2):40;
    const ghost=e.cloneNode(true); ghost.classList.remove('ready','tgt','selected','finge-hov');
    ghost.style.cssText=`position:absolute;left:${er.left}px;top:${er.top}px;width:${er.width}px;height:${er.height}px;margin:0;pointer-events:none;z-index:5`;
    ghost.style.fontSize=(parseFloat(getComputedStyle(e).fontSize)*er.width/e.offsetWidth)+'px';
    $('#fx').appendChild(ghost); e.style.visibility='hidden';
    ghost.animate([{transform:'rotate(0) scale(1)',opacity:1,filter:'grayscale(0)'},{transform:'rotate(-10deg) scale(.92)',opacity:1,filter:'grayscale(.6)',offset:.3},
      {transform:`translate(${dx}px,${dy}px) rotate(-28deg) scale(.2)`,opacity:0,filter:'grayscale(1)'}],{duration:820,easing:'cubic-bezier(.45,.05,.6,1)',fill:'forwards'});
    fxGone(ghost,860); await nap(760);
    if(pile) pile.animate([{scale:'1'},{scale:'1.3'},{scale:'1'}],{duration:450});
  } else await nap(160);
}
function fxAterriza(u){
  if(!FXON()) return;
  const e=fxEl(u); if(!e) return;
  e.animate([{translate:'0 -30px',scale:'1.2',opacity:0,filter:'brightness(1.7)'},{translate:'0 3px',scale:'1.03',opacity:1,filter:'brightness(1.22)',offset:.6},
    {translate:'0 0',scale:'1',opacity:1,filter:'brightness(1)'}],{duration:440,easing:'cubic-bezier(.18,.72,.3,1)'});
}
async function fxCartaEnEscena(nodo,side,color,etiqueta,quieta){
  if(!FXON()) return;
  window.CAOZ_COLECCION_JUEGO?.marcar(nodo,side);
  const board=$('#field').getBoundingClientRect();
  const cx=board.left+board.width/2, cy=board.top+board.height/2;
  nodo.classList.add('fxcard'); nodo.style.left=(cx-60)+'px'; nodo.style.top=(cy-84)+'px';
  $('#fx').appendChild(nodo);
  const total=quieta+420;
  if(etiqueta){ const et=fxAdd('fxlabel',cx,cy-108,{color}); et.textContent=etiqueta;
    et.animate([{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.82},{opacity:0}],{duration:total}); fxGone(et,total); }
  const fromY=side===ME?160:-160;
  /* La suavidad va en el tramo de entrada, no en la animación entera: puesta
     en las opciones, la curva se comía la pausa —al 46 % del tiempo la carta
     ya se estaba yendo— y la carta se leía medio segundo en vez de uno. */
  nodo.animate([{transform:`translateY(${fromY}px) scale(.6) rotate(${side===ME?6:-6}deg)`,opacity:0,easing:'cubic-bezier(.2,.8,.3,1)'},
    {transform:'translateY(0) scale(1.1)',opacity:1,offset:.2},
    {transform:'translateY(0) scale(1.1)',opacity:1,offset:.82,easing:'ease-in'},{transform:'translateY(-30px) scale(1.25)',opacity:0}],{duration:total});
  fxAnillo(cx,cy,color,2.2);
  fxGone(nodo,total);
  encajarTextos(nodo);
  await nap(quieta+180);
}
async function fxSpell(cardId,side){
  const c=CARDS[cardId], color=(c.sub&&SUBCOLOR[c.sub[0]])||'#8a5cf0';
  await fxCartaEnEscena(cardEl(cardId,{ladoArte:side}),side,color,P(side).L.n+' lanza '+c.n,fxQuieta(side));
}
async function fxHabilidad(side){
  if(!FXON()) return;
  const L=P(side).L, nodo=el('div','lider'); nodo.innerHTML=rostroLider(P(side).leaderId,side)+`<div><div class="ln">${L.n}</div><div class="lh">${L.habName}</div></div>`;
  nodo.style.padding='6px 12px 6px 6px';
  await fxCartaEnEscena(nodo,side,'var(--gold)','✨ '+L.habName+' — '+L.n,fxQuieta(side));
}
async function fxBanner(side){
  if(!FXON()) return;
  const d=el('div','fxbanner');
  d.innerHTML=(side===ME?'TU TURNO':'TURNO DE '+P(side).L.n.toUpperCase())+'<small>'+(side===ME?'juega tus cartas':'observa su jugada')+'</small>';
  const r=$('#field').getBoundingClientRect(); d.style.top=(r.top+r.height*0.42)+'px';
  $('#fx').appendChild(d);
  d.animate([{transform:'translateX(-60px)',opacity:0,filter:'blur(6px)'},{transform:'translateX(0)',opacity:1,filter:'blur(0)',offset:.25},
    {transform:'translateX(0)',opacity:1,filter:'blur(0)',offset:.68},{transform:'translateX(60px)',opacity:0,filter:'blur(6px)'}],{duration:1150}); fxGone(d,1150);
  if(side===ME) vibra(20);
  await nap(680);
}
function fxStat(side,sel){
  if(!FXON()) return;
  const bar=$(side===ME?'#barMe':'#barFoe'); if(!bar) return;
  const e=bar.querySelector(sel); if(!e) return;
  e.animate([{scale:'1'},{scale:'1.35',offset:.35},{scale:'1'}],{duration:420,easing:'ease-out'});
}

/* ==========================================================================
   ARRANQUE
   ========================================================================== */
$('#mCampana').onclick=abrirCampana;
$('#mBorrarProgreso').onclick=()=>confirmarBorradoProgreso();
$('#mExtras').onclick=()=>{showScreen('extras');$('#extrasBack').focus({preventScroll:true});};
$('#extrasBack').onclick=()=>{showScreen('menu');$('#mExtras').focus({preventScroll:true});};
$('#mTut').onclick=()=>showTutorialPick();
$('#mOnline').onclick=()=>showOnline();
$('#mPlay').onclick=()=>{ if(!window.CAOZ_CUENTA_JUEGO?.requerir(()=>$('#mPlay').click()))return; SELP=null; SELF=null; SEL_PASO='yo'; buildSelect(); showScreen('select'); };
$('#mGuides').onclick=()=>showGuides();
$('#mCards').onclick=()=>showGallery();
$('#mRules').onclick=()=>showRules(false);
$('#mRecords').onclick=()=>showRecords();
$('#selGo').onclick=()=>selAceptar();
$('#selAzar').onclick=()=>{ const ids=Object.keys(LEADERS); const pick=ids[rnd(ids.length)];
  if(SEL_PASO==='yo') SELP=pick; else SELF=(pick===SELP? ids.find(x=>x!==SELP) : pick); buildSelect(); };
$('#selBack').onclick=()=>{ if(SEL_PASO==='rival'){ SEL_PASO='yo'; buildSelect(); } else showScreen('menu'); };
$('#guideBack').onclick=()=>showScreen($('#guideBack').dataset.regreso||'menu');
$('#tutNext').onclick=()=>tutNext();
$('#ov').onclick=e=>{if(e.target.id==='ov'&&document.querySelector('.screen.on.portada'))cerrarOv();};
$('#panelCerrar').onclick=cerrarHojas;
$('#velo').onclick=cerrarHojas;
$('#chatform').onsubmit=e=>{ e.preventDefault(); chatMio(); };
// tocar la mesa fuera de la mano suelta la carta tocada
$('#field').addEventListener('click', e=>{ if(e.target===e.currentTarget || e.target.classList.contains('zona') || e.target.classList.contains('row')) manoTocada(null); });
$$('.build').forEach(e=>e.textContent=buildTxt());
/* EL AVISO DE INSTALAR. iOS no ofrece instalar por su cuenta: hay que
   contarlo. Sale en el menú si no estamos ya en la app, una sola vez hasta
   que se pulse «Ahora no» (se recuerda). En Android, cuando el navegador
   avisa de que se puede instalar, el botón lo hace directamente. */
{
  let pedirInstalar=null;
  const visto=()=>{ try{ return localStorage.getItem('caoz_instalar_visto')==='1'; }catch(e){ return false; } };
  const enApp=navigator.standalone===true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); pedirInstalar=e;
    const b=$('#instalarBtn'); if(b){ b.hidden=false; $('#instalarComo').textContent='Se abre a pantalla completa, con su icono, y funciona sin red.'; }
    if(!enApp && !visto()) $('#instalar').hidden=false; });
  $('#instalarBtn').onclick=async()=>{ if(!pedirInstalar) return; pedirInstalar.prompt(); try{ await pedirInstalar.userChoice; }catch(e){} $('#instalar').hidden=true; };
  $('#instalarNo').onclick=()=>{ $('#instalar').hidden=true; try{ localStorage.setItem('caoz_instalar_visto','1'); }catch(e){} };
  const esIOS=/iPhone|iPad|iPod/.test(navigator.userAgent);
  if(!enApp && !visto() && esIOS) setTimeout(()=>{ $('#instalar').hidden=false; }, 1800);
}
/* Para diagnosticar desde el teléfono sin ordenador: pulsación larga sobre el
   número de build enseña las medidas con las que se está dibujando. */
pulsacionLarga($('#buildMenu'), ()=>{
  const cs=getComputedStyle(document.documentElement);
  const app=$('#app').getBoundingClientRect();
  toast(`app ${document.documentElement.classList.contains('app')?'sí':'no'} · inner ${innerWidth}×${innerHeight} · visor ${Math.round(visualViewport?visualViewport.height:0)}`
    +` · #app ${Math.round(app.top)}→${Math.round(app.bottom)} · arriba ${cs.getPropertyValue('--arriba').trim()||'?'} · abajo ${cs.getPropertyValue('--abajo').trim()||'?'} · pantalla ${screen.width}×${screen.height}`);
});
// el logo va visible desde el principio; el texto sólo si la imagen falla
$('#marca').onerror=()=>{ $('#marca').hidden=true; $('#marcaTexto').hidden=false; };
if($('#marca').complete && !$('#marca').naturalWidth) $('#marca').onerror();
sembrarPortada(); ilustrarFondo();
$('#fondoMenus').classList.add('on');
cargarArte().then(()=>ilustrarFondo());
/* ?foto=lider,rival y ?pantalla=… son atajos de revisión, como en escritorio */
{ const q=new URLSearchParams(location.search);
  const sala=(q.get('sala')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
  if(sala.length>=4)cuentaAbrirInvitacion(sala);
  if(q.has('pantalla')){ const p=q.get('pantalla');
    if(p==='select'){ SELP='mohamed'; SELF='adreida'; SEL_PASO='yo'; buildSelect(); showScreen('select'); }
    else if(p==='guide') showGuides(); else showScreen(p); }
  if(q.has('foto')){ const [a,b]=(q.get('foto')||'fender,adreida').split(','); startMatch(a||'fender',b||'adreida',{volado:false,first:ME}); } }

/* LA APP. El service worker (sw.js) guarda el juego para abrir sin red y
   desde la pantalla de inicio. Sólo en https y fuera de las pruebas, que
   necesitan leer siempre lo último del servidor. */
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')
   && !new URLSearchParams(location.search).has('test') && !new URLSearchParams(location.search).has('estudioVista')){
  addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}

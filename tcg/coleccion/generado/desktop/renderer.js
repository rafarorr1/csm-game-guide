/* Funciones originales extraídas al solicitar la vista. No editar este resultado. */
// el · SHA256 e56e76c380a0a7f1b7d517b91ad2eea03f769a558b78cb06b5a1e97aad08044d

const el = (t,c,h)=>{const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;}
// encuadreDe · SHA256 6eb3ca92621f110c7ca185d3906a0960201b13777379d0435daeb84363111af2

function encuadreDe(v){
  if(v == null) return null;
  if(typeof v === 'number') return {x:50, y:v, z:100};
  return {x: v.x ?? 50, y: v.y ?? 50, z: v.z ?? 100};
}
// cap · SHA256 533c56ca5718f281a5d244c43a50bc07c4fced4bdcc175bc8f2cfd1ce46fc9df

const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
// tribeLine · SHA256 093a941fd24d5ee4e776d689756598060d1b18cd57a767940319bee8aaf87bd2

function tribeLine(c){ return (c.tr&&c.tr.length? c.tr.join(' · ') : (c.t==='hechizo'&&c.sub? c.sub.map(x=>SUBNAME[x]).join(' · '): cap(c.t))); }
// ponerDibujo · SHA256 49d6176090e60831a263230fb4129228b20a69ca07776b487c0dfdd5962af638

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
// ilustrarLider · SHA256 a68c8b11a8bfc7989f91ac813f767d4a7a8137f600eec10fbd69ddadda1669aa

function ilustrarLider(d, lid){
  const cara=d.querySelector('.lface');if(!cara)return d;
  cara.dataset.arteId='lider_'+lid;CAOZ_ARTE.acabar(d,'lider_'+lid);
  const enc=CAOZ_ARTE.encuadre('lider_'+lid,CAOZ_VISTAS.identificar(cara),cara);if(!enc)return d;
  cara.classList.add('conarte');ponerDibujo(cara,urlArte('lider_'+lid,cara),enc);
  return d;
}
// ilustrar · SHA256 86f3808a6c136c18fbab487ee83cc8af54291eceaac2f2a31e694c15e1937551
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
// cardEl · SHA256 7ea8cf09fc81f62ac4432445d5ba315d3de248acb3b0d84b1f8695e6327e087f

function cardEl(id,opt={}){
  const c=CARDS[id];
  const d=el('div','card t-'+c.t);
  window.CAOZ_COLECCION_JUEGO?.marcar(d,opt.ladoArte??opt.side);
  const cost = opt.side!=null&&G ? costOf(id,opt.side) : c.c;
  const disc = cost<c.c;
  d.innerHTML=`
    <div class="top"><div class="cost${disc?' rebajado':''}">${cost}</div>
      <div class="nm">${c.n}</div></div>
    ${c.r===2?'<div class="rar">★</div><i class="foil" aria-hidden="true"></i>':''}
    <div class="art">${c.art}</div>
    <div class="tribe">${tribeLine(c)}</div>
    <div class="txt">${c.x||''}</div>
    ${c.t==='personaje'?`<div class="stats"><span class="atk">${c.a}</span><span class="hp">${c.h}</span></div>`:''}`;
  d.dataset.card=id;
  ilustrar(d, id);
  attachInspect(d,id);
  return d;
}
// cartaDeLiderVS · SHA256 750f30852f38460396485784f49bc82a6e7e295264cd16ab6c46f2cfb1fd921d

function cartaDeLiderVS(lid, lado, ladoArte){
  const L=LEADERS[lid], D=DECKS[lid];
  const d=el('div','vscard '+lado, `
    <div class="lface">${L.art}</div>
    <div class="lname">${L.n}</div>
    <div class="larch">${D.d}</div>`);
  window.CAOZ_COLECCION_JUEGO?.marcar(d,ladoArte);
  ilustrarLider(d, lid);
  return d;
}
function attachInspect(){}
function pulsacionLarga(){}
function cargarArte(){throw Error("El proveedor real de arte aún no está cargado");}

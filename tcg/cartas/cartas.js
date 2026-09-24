/* Estados de prueba para revisar las cartas pintadas; no se crea una partida.
   Las cartas salen de cardEl real. Las de la mesa se marcan como unidades y se
   les cambian las cifras como lo haría el render (unitFill reescribe .stats):
   así se ve cómo quedan las mejoras, las heridas y las chapas de habilidades. */
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const MANO=['magodomo','bolafuego','esporas','espadaluz','domo','lucius'];
  const RIVAL=[['bartolomeo',{}],['discipulo',{acabado:'dorado',chips:[['Fe ciega','hab']]}]];
  const PROPIA=[
    ['tal',{nota:'Mejorado +3 ATQ',atk:12,chips:[['Vuelo','vue'],['Poseer','hab']],clase:'ready'}],
    ['aldrick',{nota:'Herido: 1 de vida',hp:1,chips:[['Recompensa','hab']],clase:'ready'}],
    ['machete',{nota:'Ya atacó',clase:'gastada',chips:[['Mochila','hab']]}],
    ['petunia',{nota:'Edición Foil',acabado:'foil',chips:[['Provocar','pro']]}],
  ];
  // Viste la carta otra vez ya colocada: la edición y el encuadre dependen de
  // dónde está (data-coleccion-acabado, data-vista-arte), igual que en el juego.
  function colocar(hueco,carta,id,acabado){
    const marco=document.createElement('figure');marco.className='cartaHueco';
    if(acabado)marco.dataset.coleccionAcabado=acabado;
    marco.append(carta);hueco.append(marco);ilustrar(carta,id);return marco;
  }
  function unidad(hueco,id,o={}){
    const carta=cardEl(id,{});carta.classList.add('unit');if(o.clase)carta.classList.add(o.clase);
    if(o.chips?.length){const k=document.createElement('div');k.className='keys';k.innerHTML=o.chips.map(([t,c])=>'<span class="kw '+c+'">'+t+'</span>').join('');carta.querySelector('.pieCarta').before(k);}
    if(o.atk!=null)carta.querySelector('.stats .atk').textContent=o.atk;
    if(o.hp!=null)carta.querySelector('.stats .hp').textContent=o.hp;
    const marco=colocar(hueco,carta,id,o.acabado);
    if(o.nota){const n=document.createElement('figcaption');n.textContent=o.nota;marco.append(n);}
    return carta;
  }
  function montar(){
    const rival=$('manoRival');rival.replaceChildren();
    for(let i=0;i<5;i++){const d=document.createElement('div');d.className='dorso';d.style.setProperty('--i',i);rival.append(d);}
    rival.style.setProperty('--n',5);
    $('mesaRival').replaceChildren();for(const [id,o]of RIVAL)unidad($('mesaRival'),id,o);
    $('mesaPropia').replaceChildren();for(const [id,o]of PROPIA)unidad($('mesaPropia'),id,o);
    $('mano').replaceChildren();
    MANO.forEach((id,i)=>{
      const carta=cardEl(id,{});
      // Una rebaja de coste, como la de un Lugar o un Protagonista.
      if(i===1){const c=carta.querySelector('.cost');c.textContent=Math.max(0,CARDS[id].c-2);c.classList.add('rebajado');}
      colocar($('mano'),carta,id);
    });
    $('ediciones').replaceChildren();
    for(const a of ['normal','foil','dorado']){const m=colocar($('ediciones'),cardEl('tal',{}),'tal',a);const n=document.createElement('figcaption');n.textContent={normal:'Normal',foil:'Foil',dorado:'Dorada'}[a];m.append(n);}
    ficha();
  }
  function ficha(){
    const box=$('inspectCard');box.className='big t-personaje';box.innerHTML=inspectHTML('tal',null);
    window.marcarNombreCarta(box.querySelector('.nm'),'tal',CARDS.tal.n);
    const art=box.querySelector('.art'),enc=CAOZ_ARTE.encuadre('tal',CAOZ_VISTAS.identificar(box),box);
    if(art){art.dataset.arteId='tal';CAOZ_ARTE.acabar(art,'tal');if(enc){art.classList.add('conarte');ponerDibujo(art,urlArte('tal',art),enc);}}
    window.CAOZ_CARTA_JUEGO.vestirFicha(box,'tal');
  }
  // Un golpe: Tal pierde vida y el atacante gana ataque. Sólo cambian las cifras.
  let golpes=0;
  function combate(){
    golpes++;
    const [tal,aldrick]=$('mesaPropia').querySelectorAll('.card');
    tal.querySelector('.stats .hp').textContent=Math.max(1,CARDS.tal.h-golpes*2);
    aldrick.querySelector('.stats .atk').textContent=CARDS.aldrick.a+golpes;
    for(const [c,id]of [[tal,'tal'],[aldrick,'aldrick']])window.CAOZ_CARTA_JUEGO.vestir(c,id);
  }
  async function preparar(){
    if(!window.CAOZ_DEV?.aislado)throw Error('La revisión requiere el entorno aislado.');
    await cargarArte();montar();$('combate').onclick=combate;
    window.CAOZ_CARTAS_REVISION=Object.freeze({montar,combate});
  }
  const fallo=e=>{document.body.insertAdjacentHTML('afterbegin','<p class="cartasError">No se pudo preparar la revisión: '+String(e.message).replace(/[<&]/g,'')+'</p>');};
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>preparar().catch(fallo));else preparar().catch(fallo);
})();

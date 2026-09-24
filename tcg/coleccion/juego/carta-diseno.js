/* Diseño de carta de la Colección y del visor 3D. Normal y Foil usan el diseño
   clásico (ilustración enmarcada, placas metálicas, gema de coste, pergamino y
   gemas de ATQ/VIDA); la Dorada es full art, con el texto sobre paneles
   translúcidos. Los datos salen de CARDS; la ilustración la sigue colocando el
   proveedor de arte del juego en .cdArte[data-arte-id] (ponerDibujo), así que
   cada edición conserva su imagen, su encuadre y los reflejos de acabados.css.
   Los Protagonistas no pasan por aquí: conservan su retrato. */
'use strict';
(function(){
  const TIPOS={personaje:'Personaje',hechizo:'Hechizo',trampa:'Trampa',objeto:'Objeto',lugar:'Lugar'};
  const nodo=(tag,clase,texto)=>{const n=document.createElement(tag);if(clase)n.className=clase;if(texto!=null)n.textContent=texto;return n;};
  const limpio=t=>{const d=document.createElement('div');d.innerHTML=t||'';return d.textContent.replace(/\s+/g,' ').trim();};
  // Tamaño del texto de reglas según su largo: el pergamino no crece ni se corta.
  const tamReglas=n=>n<=100?'corto':n<=160?'medio':n<=220?'largo':'extenso';
  const tamNombre=n=>n<=13?'corto':n<=18?'medio':'largo';

  function crear(id,acabado){
    const c=CARDS[id];if(!c)throw Error('Carta desconocida: '+id);
    const d=nodo('div','cdCarta t-'+c.t+(acabado==='dorado'?' cdFullArt':' cdClasica'));
    d.dataset.card=id;
    d.append(nodo('div','cdCuerpo'));
    const marco=nodo('div','cdArteMarco'),arte=nodo('div','cdArte');arte.dataset.arteId=id;
    arte.append(nodo('span','cdEmoji',c.art||''));marco.append(arte);d.append(marco);

    const nombre=nodo('div','cdNombre'),texto=nodo('span','cdNombreTexto');
    if(typeof window.marcarNombreCarta==='function')window.marcarNombreCarta(texto,id,c.n);else texto.textContent=c.n;
    nombre.dataset.largo=tamNombre(texto.textContent.length);nombre.append(texto);d.append(nombre);

    const coste=nodo('div','cdGema cdCoste');coste.append(nodo('b','',String(c.c)));coste.setAttribute('aria-label','Coste '+c.c);d.append(coste);

    const tipo=nodo('div','cdTipo');
    const linea=typeof tribeLine==='function'?limpio(tribeLine(c)):(TIPOS[c.t]||c.t);
    tipo.append(nodo('span','cdTipoTexto',linea||TIPOS[c.t]||''));
    const rareza=nodo('i','cdRareza');rareza.dataset.rara=c.r===2?'1':'0';rareza.setAttribute('aria-hidden','true');tipo.append(rareza);d.append(tipo);

    const caja=nodo('div','cdTexto'),reglas=nodo('p','cdReglas');
    reglas.innerHTML=c.x||'';caja.dataset.largo=tamReglas(limpio(c.x).length);caja.append(reglas);d.append(caja);

    if(c.t==='personaje'){
      const atq=nodo('div','cdGema cdAtq');atq.append(nodo('b','',String(c.a)),nodo('small','','ATQ'));
      const vida=nodo('div','cdGema cdVida');vida.append(nodo('b','',String(c.h)),nodo('small','','VIDA'));
      d.append(atq,vida);
    }
    d.append(nodo('div','cdPie','Caoz Con Todo'));
    return d;
  }

  window.CAOZ_CARTA_DISENO=Object.freeze({crear});
})();

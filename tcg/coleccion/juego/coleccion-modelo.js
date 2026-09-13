/* Colección local: las reglas y los mazos no cambian.
 * Una campaña terminada concede tres sobres; ganar contra el Domo concede uno.
 * Cada sobre nuevo: tres Normales, una Foil y la quinta Normal/Foil al 50 %.
 * El grupo elegido limita el sorteo uniforme; no hay IDs repetidos dentro del
 * sobre si el grupo contiene al menos cinco cartas. Doradas sólo por canje/código.
 * Cinco copias obtenidas de una misma carta mejoran su acabado: Normal → Foil
 * → Dorada. La Normal inicial no se gasta y los acabados desbloqueados siguen
 * disponibles aunque se gasten todas sus copias. Canjear nunca equipa.
 * Inventario, recibos y pendiente se guardan juntos. Los pendientes antiguos
 * conservan sus tres/cinco cartas; una recarga nunca vuelve a concederlas.
 * Sin contadores antiguos sólo se conoce una copia por premium desbloqueada;
 * los ceros explícitos de ediciones canjeadas sí se conservan al recargar.
 */
(function(){
  'use strict';
  const acabados=Object.freeze(['normal','foil','dorado']);
  const premium=['foil','dorado'];
  const prohibidos=new Set(['__proto__','prototype','constructor']);
  const propio=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
  const objeto=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const entero=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  const idSeguro=id=>typeof id==='string'&&id.length>0&&id.length<=100&&/^[a-zA-Z0-9_-]+$/.test(id)&&!prohibidos.has(id);
  const copia=v=>JSON.parse(JSON.stringify(v));
  const maxSobres=100000;
  const maxCopias=Math.floor(Number.MAX_SAFE_INTEGER/acabados.length);

  function ids(){
    const cartas=typeof CARDS!=='undefined'&&objeto(CARDS)?Object.keys(CARDS):[];
    const protagonistas=typeof LEADERS!=='undefined'&&objeto(LEADERS)?Object.keys(LEADERS).filter(idSeguro).map(id=>'lider_'+id):[];
    return [...new Set(cartas.concat(protagonistas).filter(idSeguro))];
  }
  // Tres colecciones: Mohamed/Fender, Adreida/Rafaela y Gero/Talesyn.
  // Conservan las afinidades y las 134 cartas; deduplicar evita dar más
  // probabilidad a una carta presente en ambas colecciones anteriores.
  const gruposBase=[
    ['trucos','Trucos del Domo','lider_mohamed conserje machete brickbrock trol lucy magodomo ilusion tok_ilusion mensaje sangrefria acertijo disipar peaje notario sombrero jabon llavemago pergamino puente bolafuego nubedagas disfrazarse copiajabon lider_fender petunia bartolomeo eric cantaberna burla balada zancada pasoatronador tasha mazo antro escarcha calentarmetal palabracuracion luzhadas puas gatobachatero humobob afterparty propaganda minus rantiago bob'],
    ['juramentos','Juramentos del Domo','lider_adreida augusto lucius ninolanza talia aldrick horton modificar auxilio armadura saeta destello colapso collar tomsage armamagica ballesta lifestealer esporashorton espadaboveda ladrillos fetichemino brazosagua lanzallave lider_rafaela julia adolfo titaus matildus discipulo tok_petunia rulchete leche bendicion manosardientes ceguera espiritus taumaturgia arco tok_rulchete campanafe lecheslact espadaluz lutorafaela petunia juangabriel'],
    ['caos','Caos y Dragones','lider_gero rey aidman juangabriel brujula rulchetebajo ciclope can spiderman hermanotrol rambo coyote correcaminos editorcosecha editorcorte editorcuadro editorcarrera editororbita editorduelo tok_goblincamino ipadkid lentesmachete eclipse viajehongos lider_talesin edbor tal tok_poseido tok_dragon cuerda hongos alientoacido rayoabrasador proyectil contrahechizo gemaconserje esporas talcadaver puntosrobados montanas domo lanzallamas conserje eric rantiago horton pergamino llavemago'],
  ];
  function grupos(){
    const catalogo=ids(),conocidos=new Set(catalogo),cubiertos=new Set();
    const lista=gruposBase.map(([id,nombre,texto])=>{
      const cartas=[...new Set(texto.split(' '))].filter(c=>conocidos.has(c));
      cartas.forEach(c=>cubiertos.add(c));
      return {id,nombre,ids:cartas};
    });
    // Las cartas futuras siguen alcanzables sin crear una cuarta colección.
    // Orden por ID y desempate por orden de grupos: mismo catálogo, mismo reparto.
    const extras=catalogo.filter(id=>!cubiertos.has(id)).sort();
    for(const id of extras){
      const menor=lista.reduce((a,b)=>a.ids.length<=b.ids.length?a:b);
      menor.ids.push(id);
    }
    return lista.filter(g=>g.ids.length);
  }
  function betaDisponible(){
    const host=String(location.hostname||'').toLowerCase();
    return host==='localhost'||host==='127.0.0.1'||host==='beta.caoz-tcg.pages.dev'||
      (host.endsWith('.github.io')&&/(^|\/)tcg-beta(?:\/|$)/.test(location.pathname||'/'));
  }
  function claveActual(){
    const partes=String(location.pathname||'/').split('/').filter(Boolean);
    const indice=partes.findIndex(p=>p==='tcg-beta'||p==='tcg');
    if(indice>=0)partes.length=indice+1;
    else if(partes.length&&(/\.[a-z0-9]+$/i.test(partes[partes.length-1])||['estudio','sonidos'].includes(partes[partes.length-1])))partes.pop();
    const prueba=new URLSearchParams(location.search||'').has('test')?'.prueba':'';
    return 'caoz.coleccion.v1.'+(betaDisponible()?'beta':'produccion')+'.'+encodeURIComponent(partes.join('/')||'raiz')+prueba;
  }
  const clave=claveActual();
  function vacio(){return {version:1,revision:0,desbloqueos:{},cantidades:{},selecciones:{},sobres:0,pendiente:null,campanasPremiadas:[],domosPremiados:[]};}

  function sanear(original){
    const estado=vacio();
    if(!objeto(original)||original.version!==1)return estado;
    const conocidos=new Set(ids());
    estado.revision=entero(original.revision,Number.MAX_SAFE_INTEGER-1)?original.revision:0;
    estado.sobres=entero(original.sobres,maxSobres)?original.sobres:0;
    for(const registro of ['campanasPremiadas','domosPremiados']){
      if(Array.isArray(original[registro]))estado[registro]=[...new Set(original[registro].filter(idSeguro))];
    }
    if(objeto(original.desbloqueos)){
      Object.keys(original.desbloqueos).forEach(id=>{
        if(!conocidos.has(id)||!Array.isArray(original.desbloqueos[id]))return;
        const lista=premium.filter(a=>original.desbloqueos[id].includes(a));
        if(lista.length)estado.desbloqueos[id]=lista;
      });
    }
    // La copia Normal inicial es implícita. Guardamos sus extras y todas las
    // premium poseídas; desbloqueos se conserva para los clientes anteriores.
    const cantidades=objeto(original.cantidades)?original.cantidades:{};
    conocidos.forEach(id=>{
      const anteriores=propio(cantidades,id)&&objeto(cantidades[id])?cantidades[id]:{};
      const lista={};
      acabados.forEach(acabado=>{
        if(!posee(estado,id,acabado))return;
        const numero=propio(anteriores,acabado)?anteriores[acabado]:null;
        const minimo=acabado==='normal'?1:0;
        const n=entero(numero,maxCopias)&&numero>=minimo?numero:1;
        if(acabado!=='normal'||n>1)lista[acabado]=n;
      });
      if(Object.keys(lista).length)estado.cantidades[id]=lista;
    });
    if(objeto(original.selecciones)){
      Object.keys(original.selecciones).forEach(id=>{
        const acabado=original.selecciones[id];
        if(conocidos.has(id)&&premium.includes(acabado)&&posee(estado,id,acabado))estado.selecciones[id]=acabado;
      });
    }
    const p=original.pendiente;
    if(objeto(p)&&idSeguro(p.id)&&entero(p.creado,Number.MAX_SAFE_INTEGER)&&
      Array.isArray(p.cartas)&&[3,5].includes(p.cartas.length)){
      const mixto=p.formato===2;
      const formatoValido=mixto?p.cartas.length===5&&(p.grupo===null||idSeguro(p.grupo)):
        !propio(p,'formato');
      const cartasValidas=p.cartas.every((c,i)=>objeto(c)&&conocidos.has(c.id)&&
        (mixto?(i<3?c.acabado==='normal':i===3?c.acabado==='foil':['normal','foil'].includes(c.acabado)):
          premium.includes(c.acabado)&&(p.cartas.length===3||c.acabado==='foil'))&&
        typeof c.nueva==='boolean'&&posee(estado,c.id,c.acabado));
      if(formatoValido&&cartasValidas){
        estado.pendiente={id:p.id,creado:p.creado,cartas:p.cartas.map(c=>({id:c.id,acabado:c.acabado,nueva:c.nueva}))};
        if(mixto)Object.assign(estado.pendiente,{formato:2,grupo:p.grupo});
      }
    }
    return estado;
  }
  function cargar(){
    let texto;
    try{texto=localStorage.getItem(clave);}catch(_){return null;}
    try{return sanear(JSON.parse(texto||'null'));}catch(_){return vacio();}
  }
  function leer(){return cargar()||vacio();}
  function posee(estado,id,acabado){
    return acabado==='normal'||(propio(estado.desbloqueos,id)&&estado.desbloqueos[id].includes(acabado));
  }
  function valido(id,acabado){return idSeguro(id)&&acabados.includes(acabado)&&ids().includes(id);}
  function tiene(id,acabado){return valido(id,acabado)&&posee(leer(),id,acabado);}
  function cantidadEn(estado,id,acabado){
    const lista=propio(estado.cantidades,id)?estado.cantidades[id]:null;
    return lista&&propio(lista,acabado)?lista[acabado]:posee(estado,id,acabado)?1:0;
  }
  function cantidad(id,acabado){
    if(!idSeguro(id)||!ids().includes(id)||(acabado!==undefined&&!acabados.includes(acabado)))return 0;
    const estado=leer();
    return acabado===undefined?acabados.reduce((total,a)=>total+cantidadEn(estado,id,a),0):cantidadEn(estado,id,acabado);
  }
  function canjeablesEn(estado,id,acabado){
    return Math.max(0,cantidadEn(estado,id,acabado)-(acabado==='normal'?1:0));
  }
  function canjeables(id,acabado){
    return valido(id,acabado)&&acabado!=='dorado'?canjeablesEn(leer(),id,acabado):0;
  }
  function canjear(id,acabado){
    if(!valido(id,acabado)||acabado==='dorado')return false;
    const estado=cargar();
    if(!estado||canjeablesEn(estado,id,acabado)<5)return false;
    const destino=acabado==='normal'?'foil':'dorado';
    if(!sumarCopia(estado,id,destino))return false;
    estado.cantidades[id][acabado]=cantidadEn(estado,id,acabado)-5;
    // El cero premium es explícito: su desbloqueo continúa y no se remigra a uno.
    return guardar(estado,'canje',{id,origen:acabado,acabado:destino,consumidas:5,cantidad:cantidadEn(estado,id,destino)});
  }
  function elegido(id){
    const estado=leer();
    return idSeguro(id)&&propio(estado.selecciones,id)?estado.selecciones[id]:'normal';
  }
  function avisar(tipo,estado,extra){
    try{window.dispatchEvent(new CustomEvent('caoz:coleccion',{detail:Object.assign({tipo,revision:estado.revision},extra||{})}));}catch(_){}
  }
  function guardar(estado,tipo,extra){
    estado.revision=Math.min(estado.revision+1,Number.MAX_SAFE_INTEGER-1);
    try{localStorage.setItem(clave,JSON.stringify(estado));}
    catch(_){return false;}
    avisar(tipo,estado,extra);
    return true;
  }
  function seleccionar(id,acabado){
    if(!valido(id,acabado))return false;
    const estado=cargar();
    if(!estado)return false;
    if(!posee(estado,id,acabado))return false;
    const actual=propio(estado.selecciones,id)?estado.selecciones[id]:'normal';
    if(actual===acabado)return true;
    if(acabado==='normal')delete estado.selecciones[id];
    else estado.selecciones[id]=acabado;
    return guardar(estado,'seleccion',{id,acabado});
  }
  function desbloquear(id,acabado){
    if(!valido(id,acabado))return false;
    const estado=cargar();
    if(!estado)return false;
    if(posee(estado,id,acabado))return true;
    if(!sumarCopia(estado,id,acabado))return false;
    return guardar(estado,'desbloqueo',{id,acabado});
  }
  function sumarCopia(estado,id,acabado){
    const anterior=cantidadEn(estado,id,acabado);
    if(anterior>=maxCopias)return false;
    if(!posee(estado,id,acabado)){
      if(!propio(estado.desbloqueos,id))estado.desbloqueos[id]=[];
      estado.desbloqueos[id].push(acabado);
    }
    if(!propio(estado.cantidades,id))estado.cantidades[id]={};
    estado.cantidades[id][acabado]=anterior+1;
    return true;
  }
  // Concesión explícita de una copia; a diferencia de desbloquear, repetir esta
  // llamada sí suma. Los premios con recibo deben validar éste antes de otorgar.
  function otorgarCopia(id,acabado){
    if(!valido(id,acabado))return false;
    const estado=cargar();
    if(!estado||!sumarCopia(estado,id,acabado))return false;
    return guardar(estado,'copia',{id,acabado,cantidad:cantidadEn(estado,id,acabado)});
  }
  function reiniciar(){
    const anterior=cargar();
    if(!anterior)return false;
    const estado=vacio();estado.revision=anterior.revision;
    return guardar(estado,'reinicio');
  }
  function darSobreBeta(){
    if(!betaDisponible())return false;
    const estado=cargar();
    if(!estado)return false;
    if(estado.sobres>=maxSobres)return false;
    estado.sobres++;
    return guardar(estado,'sobre-beta');
  }
  function concederPremio(id,registro,numero,tipo,extra){
    if(!idSeguro(id))return false;
    const estado=cargar();
    if(!estado)return false;
    if(estado[registro].includes(id))return true;
    if(estado.sobres>maxSobres-numero)return false;
    estado.sobres+=numero;
    estado[registro].push(id);
    return guardar(estado,tipo,Object.assign({sobres:numero},extra));
  }
  function concederSobreCampana(runId){
    return concederPremio(runId,'campanasPremiadas',3,'sobre-campana',{runId});
  }
  function concederSobreDomo(partidaId){
    return concederPremio(partidaId,'domosPremiados',1,'sobre-domo',{partidaId});
  }
  function sobres(){return leer().sobres;}
  function pendiente(){const p=leer().pendiente;return p?copia(p):null;}
  function azar(){
    try{
      const n=new Uint32Array(1);crypto.getRandomValues(n);
      return n[0]/4294967296;
    }catch(_){return Math.max(0,Math.min(.9999999999999999,Math.random()));}
  }
  function abrirSobre(grupoId){
    const estado=cargar();
    if(!estado)return null;
    if(estado.pendiente)return copia(estado.pendiente);
    if(!estado.sobres)return null;
    // La llamada antigua sin argumento mantiene el catálogo completo. La UI
    // nueva siempre pasa un grupo, validado antes de consumir nada.
    const grupo=grupoId===undefined?null:grupos().find(g=>g.id===grupoId);
    if(grupoId!==undefined&&!grupo)return null;
    const catalogo=grupo?grupo.ids:ids();
    if(!catalogo.length)return null;
    const cartas=[],candidatos=catalogo.slice();
    for(let i=0;i<5;i++){
      if(!candidatos.length)candidatos.push(...catalogo);
      const acabado=i<3?'normal':i===3?'foil':azar()<.5?'normal':'foil';
      const indice=Math.floor(azar()*candidatos.length),id=candidatos.splice(indice,1)[0];
      const nueva=!posee(estado,id,acabado);
      if(!sumarCopia(estado,id,acabado))return null;
      cartas.push({id,acabado,nueva});
    }
    const creado=Date.now();
    const sobre={id:'sobre_'+creado.toString(36)+'_'+(estado.revision+1).toString(36)+'_'+Math.floor(azar()*4294967296).toString(36),creado,cartas,formato:2,grupo:grupo?grupo.id:null};
    estado.sobres--;
    estado.pendiente=sobre;
    if(!guardar(estado,'abrir-sobre',{sobre:copia(sobre)}))return null;
    return copia(sobre);
  }
  function cerrarSobre(){
    const estado=cargar();
    if(!estado)return false;
    if(!estado.pendiente)return true;
    estado.pendiente=null;
    return guardar(estado,'cerrar-sobre');
  }
  window.CAOZ_COLECCION=Object.freeze({acabados,clave,ids,grupos,tiene,cantidad,canjeables,canjear,elegido,seleccionar,desbloquear,otorgarCopia,leer,reiniciar,betaDisponible,darSobreBeta,concederSobreCampana,concederSobreDomo,sobres,abrirSobre,pendiente,cerrarSobre});
  window.addEventListener('storage',event=>{
    if(event.key===clave||event.key===null)avisar('externo',leer());
  });
})();

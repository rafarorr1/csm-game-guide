/* Puente entre los efectos visuales de Claude y la mesa real.
   Los módulos dibujan; aquí se les da la partida y el DOM de cada pantalla.
   Nunca decide reglas ni modifica el estado del motor. */
'use strict';
(function(){
  let campo=null,hostCampo=null,pendiente='',cola=Promise.resolve(),activo=false;
  let estiloPuesto=false;
  const $=s=>document.querySelector(s);
  const partida=()=>typeof G!=='undefined'?G:null;
  const quieto=()=>{const g=partida();return !!(g&&(g.fast||g.silent||g.auto))||document.hidden||
    !!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);};
  const hostFx=()=>$('#fx');
  const nodoUnidad=u=>{
    if(!u||u.uid==null)return null;
    const id=String(u.uid).replace(/"/g,'\\"');
    return document.querySelector('[data-uid="'+id+'"]');
  };
  const nodoPD=s=>$('#'+(s===0?'barMe':'barFoe')+' .stat.pd');
  const nodoLlaves=s=>$('#'+(s===0?'barMe':'barFoe')+' .stat.key');
  const lado=s=>s===0?'abajo':'arriba';
  const campoHost=()=>$('#mat')||$('#field');
  const arteLugar=id=>{
    try{if(typeof urlArte==='function')return urlArte(id,hostCampo||campoHost());}catch(_){}
    return 'art/'+id+'.webp';
  };
  const fondoLugar=id=>{
    const todos=window.CAOZ_FONDOS_LUGARES;
    return todos&&todos[id]&&typeof todos[id]==='object'?todos[id]:null;
  };
  // Algunas animaciones avisan al motor desde un callback interno que no
  // espera Promesas. Esta pequeña compuerta evita aplicar la regla dos veces
  // y permite que el motor espere a que el callback haya terminado antes de
  // seguir con el siguiente paso de la partida.
  function aplicarUnaVez(aplicar){
    let lanzada=false,promesa=Promise.resolve();
    return {
      ejecutar(){
        if(!lanzada){
          lanzada=true;
          try{promesa=Promise.resolve(aplicar?.());}catch(_){promesa=Promise.resolve();}
        }
        return promesa;
      },
      esperar(){return promesa;}
    };
  }

  function ponerEstilo(){
    if(estiloPuesto)return;estiloPuesto=true;
    const e=document.createElement('style');
    e.textContent=
      '#mat.campoLugarActivo>:not(.clEscena):not(.clEfectos),#field.campoLugarActivo>:not(.clEscena):not(.clEfectos){position:relative;z-index:1}'
      +'#mat.campoLugarActivo>.clEfectos,#field.campoLugarActivo>.clEfectos{z-index:42}'
      +'#mat.campoLugarActivo>.clEscena,#field.campoLugarActivo>.clEscena{border-radius:inherit}';
    document.head.append(e);
  }
  function destruir(){
    try{campo?.destruir();}catch(_){}
    if(hostCampo)hostCampo.classList.remove('campoLugarActivo');
    campo=null;hostCampo=null;pendiente='';
  }
  function asegurar(){
    const host=campoHost(),motor=window.CAOZ_CAMPO_LUGAR;
    if(!host||!motor?.crear)return null;
    if(campo&&hostCampo===host)return campo;
    destruir();ponerEstilo();host.classList.add('campoLugarActivo');hostCampo=host;
    campo=motor.crear(host,{arte:arteLugar,fondo:fondoLugar,linea:$('#midRow'),reducir:quieto});
    return campo;
  }
  function esMesaVisible(){
    const board=$('#board');
    return activo&&!!board?.classList.contains('on');
  }
  function sincronizar(){
    if(!esMesaVisible()){destruir();return Promise.resolve(false);}
    const g=partida(),l=g?.place,id=l?.id||'',clave=id?String(id)+'|'+String(l.side):'';
    if(clave===pendiente)return cola;
    pendiente=clave;
    cola=cola.catch(()=>false).then(async()=>{
      if(clave!==pendiente)return false;
      const escena=asegurar();if(!escena)return false;
      if(!id)return escena.quitar({reducir:quieto()});
      return escena.poner(id,{lado:lado(l.side),reducir:quieto()});
    });
    return cola;
  }
  function activar(valor){
    activo=!!valor;
    if(!activo)destruir();else sincronizar();
  }
  function marcarEstados(u,nodo){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),objetivo=nodo||nodoUnidad(u);
    if(!fx||!objetivo)return;
    try{
      const puestos=new Set(fx.estados?.(objetivo)||[]);
      // Cada render reemplaza el interior de la carta. Reconciliar en vez de
      // sólo añadir evita que un Disipar o el fin de Aturdido dejen un filtro,
      // una rotación o un lienzo huérfano pegado a la carta.
      if(u?.infected){ if(!puestos.has('infectada'))fx.infectar(objetivo); }
      else if(puestos.has('infectada'))fx.curar?.(objetivo,{reducir:true});
      if(u?.stunned>0){ if(!puestos.has('aturdida'))fx.aturdir(host,{objetivo,reducir:true}); }
      else { if(puestos.has('aturdida'))fx.despertar?.(objetivo,{reducir:true}); objetivo.style.rotate=''; }
      if(u?.possessed&&host){ if(!puestos.has('poseida'))fx.poseer(host,{objetivo,reducir:true}); }
      else { if(puestos.has('poseida'))fx.liberar?.(objetivo,{reducir:true}); objetivo.style.filter=''; }
    }catch(_){}
  }
  async function tomsage(s,aplicar){
    const paso=aplicarUnaVez(aplicar);
    const cristal=nodoPD(s);
    if(!campo||!cristal||quieto()){await paso.ejecutar();return false;}
    try{const r=await campo.perderPD(cristal,{reducir:quieto(),alApagar:paso.ejecutar});await paso.ejecutar();return r;}
    catch(_){await paso.ejecutar();return false;}
  }
  async function antro(s,aplicar){
    const paso=aplicarUnaVez(aplicar);
    const desde=$('#'+(s===0?'myDeckPile':'foeDeckPile')),hasta=s===0?$('#hand'):$('#barFoe');
    if(!campo||!desde||!hasta||quieto()){await paso.ejecutar();return false;}
    try{const r=await campo.brindis(desde,hasta,{reducir:quieto(),alRobar:paso.ejecutar});await paso.ejecutar();return r;}
    catch(_){await paso.ejecutar();return false;}
  }
  async function puente(atacante,tirada){
    const n=nodoUnidad(atacante);
    if(!campo||!n||quieto())return tirada>=8;
    try{return await campo.ataqueAlma(n,tirada,{reducir:quieto()});}
    catch(_){return tirada>=8;}
  }
  async function montanas(rival,tirada,aplicar){
    const paso=aplicarUnaVez(aplicar);
    const destino=$('#'+(rival===0?'myField':'foeField'));
    if(!campo||quieto()){if(tirada<=3)await paso.ejecutar();return tirada<=3;}
    try{const r=await campo.tiradaAidman(tirada,{destino,reducir:quieto(),alAparecer:paso.ejecutar});if(tirada<=3)await paso.ejecutar();return r;}
    catch(_){if(tirada<=3)await paso.ejecutar();return false;}
  }
  async function domoMuerte(muerto,s,aplicar){
    const paso=aplicarUnaVez(aplicar);
    const alma=$('#lead'+s),pd=nodoPD(1-s),n=nodoUnidad(muerto);
    if(!campo||!n||!alma||!pd||quieto()){await paso.ejecutar();return false;}
    try{const r=await campo.muerte(n,alma,pd,{reducir:quieto(),alAlma:paso.ejecutar,alPD:()=>{}});await paso.ejecutar();return r;}
    catch(_){await paso.ejecutar();return false;}
  }
  function imagenCarta(nodo){
    // La mesa actual pinta la ilustración dentro de .marcoDibujo. Conservamos
    // los selectores antiguos para fichas y vistas que todavía usan un lienzo.
    const img=nodo?.querySelector?.(':scope > .marcoDibujo > img, :scope > .art > img, :scope > .cjCara, :scope > canvas');
    return img?.complete&&img.naturalWidth?img:null;
  }
  async function polimorfia(u,aplicar){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),n=nodoUnidad(u),cara=imagenCarta(n);
    const paso=aplicarUnaVez(aplicar);
    if(!fx?.polimorfar||!host||!n||!cara||quieto()){await paso.ejecutar();return false;}
    try{const r=await fx.polimorfar(host,{objetivo:n,imagen:cara,imagenNueva:cara,reducir:quieto(),alCambiar:paso.ejecutar,sacudir:$('#board')||host});await paso.ejecutar();return r;}
    catch(_){await paso.ejecutar();return false;}
  }
  async function escarcha(u,aplicar){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),n=nodoUnidad(u);
    const paso=aplicarUnaVez(aplicar);
    if(!fx?.congelar||!host||!n||quieto()){await paso.ejecutar();return false;}
    try{
      await fx.congelar(host,{objetivo:n,reducir:quieto()});
      // Escarcha es un impacto, no un estado de las reglas: se desvanece antes
      // de que el repintado de daño rehaga la carta.
      await fx.descongelar?.(host,{objetivo:n,reducir:true});
      await paso.ejecutar();return true;
    }
    catch(_){await paso.ejecutar();return false;}
  }
  async function collarAgua(u){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),n=nodoUnidad(u);
    if(!fx?.apagar||!host||!n||quieto())return false;
    try{return await fx.apagar(host,{objetivo:n,reducir:quieto()});}catch(_){return false;}
  }
  async function risa(u){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),n=nodoUnidad(u);
    if(!fx?.risa||!host||!n||quieto())return false;
    try{return await fx.risa(host,{objetivo:n,reducir:quieto()});}catch(_){return false;}
  }
  async function gracia(s,aplicar){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),pip=$('#'+(s===0?'barMe':'barFoe')+' .stat.gr');
    const celestiales=[...document.querySelectorAll('[data-uid]')].filter(n=>{
      const u=partida()?.pl?.flatMap(p=>p.field).find(x=>String(x.uid)===n.dataset.uid);
      return !!u?.tribes?.includes('Celestial');
    });
    const paso=aplicarUnaVez(aplicar);
    if(!fx?.gracia||!host||quieto()){await paso.ejecutar();return false;}
    try{const r=await fx.gracia(host,{pip,celestiales,reducir:quieto(),alLlenar:paso.ejecutar});await paso.ejecutar();return r;}
    catch(_){await paso.ejecutar();return false;}
  }
  async function pergamino(s,turno){
    const fx=window.CAOZ_FX_PODERES,host=hostFx(),obj=$('#midRow')||$('#field');
    if(!fx?.pergamino||!host||!obj||quieto())return false;
    try{return await fx.pergamino(host,{objetivo:obj,turno,total:2,reducir:quieto()});}
    catch(_){return false;}
  }
  async function ascensionPetunia(u){
    const fx=window.CAOZ_FX_ASCENSION,host=hostFx(),n=nodoUnidad(u),cara=imagenCarta(n);
    if(!fx?.ascender||!host||!n||!cara||quieto())return false;
    try{return await fx.ascender(host,{objetivo:n,imagen:cara,imagenNueva:cara,reducir:quieto(),restaurar:false});}
    catch(_){return false;}
  }

  window.CAOZ_EFECTOS_CLAUDE=Object.freeze({activar,sincronizar,destruir,marcarEstados,tomsage,antro,puente,montanas,domoMuerte,polimorfia,escarcha,collarAgua,risa,gracia,pergamino,ascensionPetunia});
  window.fxClaudeCampo=sincronizar;
  window.fxClaudeActivarCampo=activar;
  window.fxClaudeEstado=marcarEstados;
  window.fxClaudeTomsage=tomsage;
  window.fxClaudeAntro=antro;
  window.fxClaudePuente=puente;
  window.fxClaudeMontanas=montanas;
  window.fxClaudeDomoMuerte=domoMuerte;
  window.fxClaudePolimorfia=polimorfia;
  window.fxClaudeEscarcha=escarcha;
  window.fxClaudeCollarAgua=collarAgua;
  window.fxClaudeRisa=risa;
  window.fxClaudeGracia=gracia;
  window.fxClaudePergamino=pergamino;
  window.fxClaudeAscensionPetunia=ascensionPetunia;
})();

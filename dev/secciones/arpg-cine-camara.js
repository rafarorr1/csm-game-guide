/* Tomas de cámara: datos portables y evaluación sin dependencias del editor. */
'use strict';
(function(){
  const CLAVE='caoz.arpg.cine.mago.v1',REVISION='mago-v2';
  const fases=['salida','descubrir','vertigo','carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','voltear','techo','cielo','caida','impacto','negro'];
  const planoDeFase=f=>['carrera','ataquePOV','desaparece'].includes(f)?'carrera':['tropezar','buscar','levantarse','voltear'].includes(f)?'tropezar':f;
  const idsPlanos=Object.freeze([...new Set(fases.map(planoDeFase))]);
  const curvas=['suave','lineal','corte'];
  function validar(d){
    if(!d||![1,2].includes(d.version)||d.escena!=='mago'||d.revision!==REVISION||!d.planos||typeof d.planos!=='object'||Array.isArray(d.planos))throw Error('La toma no pertenece a esta versión de la escena del mago.');
    const numero=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
    const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>numero(x,-10000,10000));
    const planos={};let total=0;
    for(const [fase,p]of Object.entries(d.planos)){
      if(!(d.version===1?fases:idsPlanos).includes(fase)||!p||!['externa','original'].includes(p.vista)||!Array.isArray(p.claves)||p.claves.length>1500)throw Error('Plano o lista de keyframes inválidos.');
      const claves=p.claves.map(k=>{
        if(!k||!numero(k.t,0,60)||!vector(k.pos,3)||!vector(k.rot,4)||!numero(k.fov,8,110)||!numero(k.distancia,.2,300)||!curvas.includes(k.curva))throw Error('Un keyframe contiene una cámara o tiempo inválido.');
        const largo=Math.hypot(...k.rot);if(largo<.5||largo>1.5)throw Error('Orientación de cámara inválida.');
        return {t:k.t,pos:[...k.pos],rot:k.rot.map(n=>n/largo),fov:k.fov,distancia:k.distancia,curva:k.curva};
      }).sort((a,b)=>a.t-b.t);
      if(claves.some((k,i)=>i&&k.t-claves[i-1].t<.001))throw Error('Dos keyframes ocupan el mismo momento.');
      total+=claves.length;if(total>5000)throw Error('La toma supera 5000 keyframes.');planos[fase]={vista:p.vista,claves};
      if(d.version===2&&p.vistas!==undefined){
        if(!p.vistas||typeof p.vistas!=='object'||Array.isArray(p.vistas))throw Error('Vistas de acciones inválidas.');
        planos[fase].vistas={};for(const [accion,vista]of Object.entries(p.vistas)){if(!fases.includes(accion)||planoDeFase(accion)!==fase||!['original','externa'].includes(vista))throw Error('Vista de acción inválida.');planos[fase].vistas[accion]=vista;}
      }
    }
    return {version:d.version,escena:'mago',revision:REVISION,nombre:String(d.nombre||'Mi toma').slice(0,100),planos};
  }
  const nueva=()=>({version:2,escena:'mago',revision:REVISION,nombre:'El mago · Mi toma',planos:{}});
  function crear(T){
    const qa=new T.Quaternion(),qb=new T.Quaternion();
    function muestra(claves,t){
      if(!claves?.length)return null;
      let a=claves[0],b=a;
      for(const k of claves){if(k.t<=t)a=k;if(k.t>t){b=k;break;}b=a;}
      if(t<=claves[0].t)b=a=claves[0];
      let u=a===b?0:Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
      if(a.curva==='corte')u=0;else if(a.curva==='suave')u=u*u*(3-2*u);
      qa.fromArray(a.rot).slerp(qb.fromArray(b.rot),u);
      return {pos:a.pos.map((n,i)=>n+(b.pos[i]-n)*u),rot:qa.toArray(),fov:a.fov+(b.fov-a.fov)*u,distancia:a.distancia+(b.distancia-a.distancia)*u};
    }
    function aplicar(camara,k){if(!k)return false;camara.position.fromArray(k.pos);camara.quaternion.fromArray(k.rot);camara.fov=k.fov;camara.updateProjectionMatrix();camara.updateMatrixWorld(true);return true;}
    function capturar(camara,distancia=12){return {pos:camara.position.toArray(),rot:camara.quaternion.toArray(),fov:camara.fov,distancia};}
    function tomaEn(toma,estado){
      const id=toma.version===1?estado.fase:planoDeFase(estado.fase),p=toma.planos[id];
      return {camara:muestra(p?.claves,toma.version===1?estado.t:estado.tPlano),vista:p?.vistas?.[estado.fase]||p?.vista};
    }
    // Las tomas antiguas usaban una pista por acción. Se conservan sus encuadres
    // y sus cortes al reunirlas, incluyendo las acciones que seguían sin editar.
    function agrupar(toma,frames){
      if(toma.version===2)return toma;
      const salida={...toma,version:2,planos:{}};
      for(const id of idsPlanos){
        const acciones=fases.filter(f=>planoDeFase(f)===id);
        if(acciones.length===1){if(toma.planos[id])salida.planos[id]=JSON.parse(JSON.stringify(toma.planos[id]));continue;}
        if(!acciones.some(f=>toma.planos[f]?.claves.length))continue;
        const cuadros=frames.filter(f=>f.fase===id),vistas=Object.fromEntries(acciones.map(f=>[f,toma.planos[f]?.vista||'original']));
        salida.planos[id]={vista:vistas[acciones[0]],vistas,claves:cuadros.map((f,i)=>({...muestra(toma.planos[f.accion]?.claves,f.tAccion)||f.camara,t:f.t,curva:cuadros[i+1]?.accion!==f.accion?'corte':'lineal'}))};
      }
      return validar(salida);
    }
    return {muestra,aplicar,capturar,tomaEn,agrupar};
  }
  window.CAOZ_ARPG_CINE_CAMARA=Object.freeze({CLAVE,REVISION,fases,planos:idsPlanos,planoDeFase,validar,nueva,crear});
})();

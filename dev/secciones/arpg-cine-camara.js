/* Tomas de cámara: datos portables y evaluación sin dependencias del editor. */
'use strict';
(function(){
  const CLAVE='caoz.arpg.cine.mago.v1',REVISION='mago-v2';
  const fases=['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','levantarse','tropezar','buscar','voltear','techo','cielo','caida','impacto','negro'];
  const fasesAnteriores=['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','voltear','techo','cielo','caida','impacto','negro'];
  const VERSION=7,RECORTE_PIES=11/60,versiones=[1,2,3,4,5,6,7];
  const antes={desaparece:.57,tropezar:.9,buscar:2.8,levantarse:1.75,voltear:1.1,techo:2.3,cielo:1.7};
  const ahora={desaparece:.42,levantarse:.52,tropezar:1,buscar:1.85,voltear:1.6,techo:1.3,cielo:1.7};
  const RETIME_RECUPERACION=(antes.desaparece+antes.tropezar+antes.buscar+antes.levantarse)/(ahora.desaparece+ahora.levantarse+ahora.tropezar+ahora.buscar);
  const planoDeFase=(f,version=VERSION)=>version===1?f:['carrera','ataquePOV',...(version<4?['desaparece']:[])].includes(f)?'carrera':['tropezar','buscar','levantarse',...(version<7?['voltear']:[]),...(version>=4?['desaparece']:[])].includes(f)?'tropezar':version>=3&&['techo','cielo',...(version>=7?['voltear']:[])].includes(f)?'techo':f;
  const accionesDe=(id,v)=> (v<VERSION?fasesAnteriores:fases).filter(f=>planoDeFase(f,v)===id);
  const idsPorVersion=Object.fromEntries(versiones.map(v=>[v,Object.freeze([...new Set((v<VERSION?fasesAnteriores:fases).filter(f=>v>=5||f!=='pies').map(f=>planoDeFase(f,v)))])]));
  const idsPlanos=idsPorVersion[VERSION];
  // Catálogo central: una entrada por secuencia; los planos pertenecen a ella.
  const escenas=Object.freeze([
    Object.freeze({id:'troll',nombre:'La llave y el Recaudador',detalle:'Entrada del jefe · Etapa 2',modo:'reproduccion',entrada:'troll'}),
    Object.freeze({id:'casa',nombre:'La casa goblin',detalle:'Escena interactiva · Etapa 2',modo:'interactiva',entrada:'casa'}),
    Object.freeze({id:'mago',nombre:'El mago y el meteorito',detalle:'Salida de la casa · Epílogo',modo:'edicion',entrada:'mago'})
  ]);
  const curvas=['suave','lineal','corte'];
  function validar(d){
    if(!d||!versiones.includes(d.version)||d.escena!=='mago'||d.revision!==REVISION||!d.planos||typeof d.planos!=='object'||Array.isArray(d.planos))throw Error('La toma no pertenece a esta versión de la escena del mago.');
    const numero=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
    const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>numero(x,-10000,10000));
    const planos={};let total=0;
    for(const [fase,p]of Object.entries(d.planos)){
      if(!idsPorVersion[d.version].includes(fase)||!p||!['externa','original'].includes(p.vista)||!Array.isArray(p.claves)||p.claves.length>1500)throw Error('Plano o lista de keyframes inválidos.');
      const claves=p.claves.map(k=>{
        if(!k||!numero(k.t,0,60)||!vector(k.pos,3)||!vector(k.rot,4)||!numero(k.fov,8,110)||!numero(k.distancia,.2,300)||!curvas.includes(k.curva))throw Error('Un keyframe contiene una cámara o tiempo inválido.');
        const largo=Math.hypot(...k.rot);if(largo<.5||largo>1.5)throw Error('Orientación de cámara inválida.');
        return {t:k.t,pos:[...k.pos],rot:k.rot.map(n=>n/largo),fov:k.fov,distancia:k.distancia,curva:k.curva};
      }).sort((a,b)=>a.t-b.t);
      if(claves.some((k,i)=>i&&k.t-claves[i-1].t<(d.version>=7?1e-6:.001)))throw Error('Dos keyframes ocupan el mismo momento.');
      total+=claves.length;if(total>5000)throw Error('La toma supera 5000 keyframes.');planos[fase]={vista:p.vista,claves};
      if(d.version>=2&&p.vistas!==undefined){
        if(!p.vistas||typeof p.vistas!=='object'||Array.isArray(p.vistas))throw Error('Vistas de acciones inválidas.');
        planos[fase].vistas={};for(const [accion,vista]of Object.entries(p.vistas)){if(!fases.includes(accion)||planoDeFase(accion,d.version)!==fase||!['original','externa'].includes(vista))throw Error('Vista de acción inválida.');planos[fase].vistas[accion]=vista;}
      }
    }
    return {version:d.version,escena:'mago',revision:REVISION,nombre:String(d.nombre||'Mi toma').slice(0,100),planos};
  }
  const nueva=()=>({version:VERSION,escena:'mago',revision:REVISION,nombre:'El mago · Mi toma',planos:{}});
  function crear(T){
    const qa=new T.Quaternion(),qb=new T.Quaternion();
    function muestra(claves,t){
      if(!claves?.length)return null;
      let a=claves[0],b=a;
      // Un reloj acumulado puede quedar unas milmillonésimas antes del cuadro.
      // El corte debe ocurrir en ese cuadro tanto en juego como en el editor.
      for(const k of claves){if(k.t<=t+1e-8)a=k;if(k.t>t+1e-8){b=k;break;}b=a;}
      if(t<=claves[0].t)b=a=claves[0];
      let u=a===b?0:Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
      if(a.curva==='corte')u=0;else if(a.curva==='suave')u=u*u*(3-2*u);
      qa.fromArray(a.rot).slerp(qb.fromArray(b.rot),u);
      return {pos:a.pos.map((n,i)=>n+(b.pos[i]-n)*u),rot:qa.toArray(),fov:a.fov+(b.fov-a.fov)*u,distancia:a.distancia+(b.distancia-a.distancia)*u};
    }
    function aplicar(camara,k){if(!k)return false;camara.position.fromArray(k.pos);camara.quaternion.fromArray(k.rot);camara.fov=k.fov;camara.updateProjectionMatrix();camara.updateMatrixWorld(true);return true;}
    function capturar(camara,distancia=12){return {pos:camara.position.toArray(),rot:camara.quaternion.toArray(),fov:camara.fov,distancia};}
    function tiempoDeToma(toma,estado){
      const f=estado.fase,id=planoDeFase(f,toma.version),inicio=estado.inicios?.[accionesDe(id,toma.version)[0]];
      const local=Number.isFinite(inicio)&&Number.isFinite(estado.total)?estado.total-inicio:toma.version===1||id!==planoDeFase(f)?estado.t:estado.tPlano;
      if(toma.version===VERSION)return local;
      // El recorrido externo ya editado permanece continuo aunque la actuación
      // se incorpore antes. Las claves del viejo giro quedan fuera del plano.
      if(toma.version>=4&&id==='tropezar')return local*RETIME_RECUPERACION;
      const t=antes[f]===undefined?estado.t:estado.t*antes[f]/ahora[f];
      if(toma.version===1)return t;
      if(id==='tropezar'||id==='techo'){
        const acciones=accionesDe(id,toma.version);return acciones.slice(0,acciones.indexOf(f)).reduce((s,a)=>s+antes[a],0)+t;
      }
      if(f==='desaparece')return local-estado.t+t;
      return local+(id==='pies'&&toma.version===5?RECORTE_PIES:0);
    }
    function tomaEn(toma,estado){
      // El nuevo giro empieza después del corte POV. Nunca reutiliza el giro
      // externo de un montaje anterior, aunque comparta su id de acción.
      if(toma.version<VERSION&&estado.fase==='voltear')return {camara:null,vista:'original'};
      const p=toma.planos[planoDeFase(estado.fase,toma.version)];
      return {camara:muestra(p?.claves,tiempoDeToma(toma,estado)),vista:p?.vistas?.[estado.fase]||p?.vista};
    }
    // Las tomas antiguas usaban una pista por acción. Se conservan sus encuadres
    // y sus cortes al reunirlas, incluyendo las acciones que seguían sin editar.
    function agrupar(toma,frames){
      if(toma.version===VERSION)return toma;
      const salida={...toma,version:VERSION,planos:{}},inicios={};
      frames.forEach((f,i)=>{if(inicios[f.accion]===undefined)inicios[f.accion]=i/60-f.tAccion;});
      for(const id of idsPlanos){
        // El antiguo F011 pasa a F000: recorta la pista junto con la actuación.
        // Muestrea la curva previa para conservar incluso interpolaciones suaves.
        if(id==='pies'&&toma.version===5&&toma.planos.pies?.claves.length){
          salida.planos.pies={...JSON.parse(JSON.stringify(toma.planos.pies)),claves:frames.filter(f=>f.fase==='pies').map(f=>({...muestra(toma.planos.pies.claves,f.t+RECORTE_PIES),t:f.t,curva:'lineal'}))};continue;
        }
        const acciones=accionesDe(id,VERSION),origen=f=>planoDeFase(f,toma.version),pistas=[...new Set(acciones.map(origen))];
        if(id==='tropezar'&&toma.version>=4){
          const p=toma.planos.tropezar;if(p){salida.planos[id]=JSON.parse(JSON.stringify(p));salida.planos[id].claves.forEach(k=>k.t/=RETIME_RECUPERACION);if(p.vistas)salida.planos[id].vistas=Object.fromEntries(acciones.filter(a=>p.vistas[a]).map(a=>[a,p.vistas[a]]));}continue;
        }
        if(pistas.length===1&&accionesDe(pistas[0],toma.version).join()===acciones.join()){if(toma.planos[pistas[0]])salida.planos[id]=JSON.parse(JSON.stringify(toma.planos[pistas[0]]));continue;}
        if(!acciones.some(f=>f!=='voltear'&&toma.planos[origen(f)]?.claves.length))continue;
        const cuadros=frames.map((f,i)=>({...f,indice:i})).filter(f=>f.fase===id),vistas=Object.fromEntries(acciones.map(f=>[f,f==='voltear'?'original':toma.planos[origen(f)]?.vistas?.[f]||toma.planos[origen(f)]?.vista||'original']));
        salida.planos[id]={vista:vistas[acciones[0]],vistas,claves:cuadros.map((f,i)=>{
          const estado={fase:f.accion,t:f.tAccion,tPlano:f.t,total:f.indice/60,inicios,...f.estado},camara=tomaEn(toma,estado).camara||f.camara;
          const siguiente=cuadros[i+1]?.accion,corte=origen(siguiente)!==origen(f.accion)||siguiente!==f.accion&&(id==='tropezar'||f.accion==='voltear');
          return {...camara,t:f.t,curva:corte?'corte':'lineal'};
        })};
      }
      return validar(salida);
    }
    return {muestra,aplicar,capturar,tomaEn,agrupar};
  }
  window.CAOZ_ARPG_CINE_CAMARA=Object.freeze({CLAVE,REVISION,VERSION,escenas,fases,planos:idsPlanos,planoDeFase,validar,nueva,crear});
})();

/* Tomas de cámara: datos portables y evaluación sin dependencias del editor. */
'use strict';
(function(){
  const CLAVE='caoz.arpg.cine.mago.v1',REVISION='mago-v2';
  const fases=['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','levantarse','tropezar','buscar','voltear','techo','hechizo','cielo','caida','impacto','negro'];
  const fases7=fases.filter(f=>f!=='hechizo');
  const fasesAnteriores=['salida','descubrir','vertigo','pies','carrera','ataquePOV','desaparece','tropezar','buscar','levantarse','voltear','techo','cielo','caida','impacto','negro'];
  const VERSION=12,INICIO_PAUSA=9,PAUSA_FINAL=.7,ANTICIPO_PUERTA=1,RECORTE_PIES=11/60,PAUSA_PARTICULAS=2,AMPLIACION_PANEO=3.4/2.4,versiones=[1,2,3,4,5,6,7,8,9,10,11,12];
  const antes={ataquePOV:.48,desaparece:.57,tropezar:.9,buscar:2.8,levantarse:1.75,voltear:1.1,techo:2.3,cielo:1.7};
  const montaje7={ataquePOV:.48,desaparece:.42,levantarse:.52,tropezar:1,buscar:1.85,voltear:1.6,techo:1.3,cielo:1.7};
  const montaje8={ataquePOV:.96,desaparece:.08,levantarse:.16,tropezar:.74,buscar:1.2,voltear:2.6,techo:1.4,cielo:1.7};
  const ahora={carrera:93/60,ataquePOV:.55,desaparece:.35,levantarse:.3,tropezar:.74,buscar:1.2,voltear:4.6,techo:1.4,hechizo:3.7,cielo:1.7};
  const tiemposDe=v=>v>=8?montaje8:v===7?montaje7:antes;
  const recuperacion=d=>d.desaparece+d.levantarse+d.tropezar+d.buscar;
  const retimeRecuperacion=v=>recuperacion(tiemposDe(v))/recuperacion(ahora);
  const planoDeFase=(f,version=VERSION)=>version===1?f:['carrera','ataquePOV',...(version<4?['desaparece']:[])].includes(f)?'carrera':['tropezar','buscar','levantarse',...(version<7?['voltear']:[]),...(version>=4?['desaparece']:[])].includes(f)?'tropezar':version>=3&&['techo','cielo',...(version>=7?['voltear']:[]),...(version>=9?['hechizo']:[])].includes(f)?'techo':f;
  const fasesDe=v=>v<7?fasesAnteriores:v<9?fases7:fases;
  const accionesDe=(id,v)=>fasesDe(v).filter(f=>planoDeFase(f,v)===id);
  const idsPorVersion=Object.fromEntries(versiones.map(v=>[v,Object.freeze([...new Set(fasesDe(v).filter(f=>v>=5||f!=='pies').map(f=>planoDeFase(f,v)))])]));
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
      if(!idsPorVersion[d.version].includes(fase)||!p||!['externa','original'].includes(p.vista)||!Array.isArray(p.claves)||p.claves.length>(d.version>=12?1502:1500))throw Error('Plano o lista de keyframes inválidos.');
      const claves=p.claves.map(k=>{
        if(!k||!numero(k.t,0,d.version>=12?240.7:d.version>=11?240:d.version>=10?180:d.version>=9?120:60)||!vector(k.pos,3)||!vector(k.rot,4)||!numero(k.fov,8,110)||!numero(k.distancia,.2,300)||!curvas.includes(k.curva))throw Error('Un keyframe contiene una cámara o tiempo inválido.');
        const largo=Math.hypot(...k.rot);if(largo<.5||largo>1.5)throw Error('Orientación de cámara inválida.');
        if(k.tramoSuave!==undefined&&(d.version<12||!Array.isArray(k.tramoSuave)||k.tramoSuave.length!==2||!k.tramoSuave.every(n=>numero(n,0,1))||k.tramoSuave[0]>=k.tramoSuave[1]))throw Error('Tramo de interpolación suave inválido.');
        return {t:k.t,pos:[...k.pos],rot:k.rot.map(n=>n/largo),fov:k.fov,distancia:k.distancia,curva:k.curva,...(k.tramoSuave?{tramoSuave:[...k.tramoSuave]}:{})};
      }).sort((a,b)=>a.t-b.t);
      if(claves.some((k,i)=>i&&(d.version>=12?k.t<=claves[i-1].t:k.t-claves[i-1].t<(d.version>=8?1e-7:d.version>=7?1e-6:.001))))throw Error('Dos keyframes ocupan el mismo momento.');
      total+=claves.length;if(total>(d.version>=12?5002:5000))throw Error('La toma supera el límite de keyframes.');planos[fase]={vista:p.vista,claves};
      if(d.version>=2&&p.vistas!==undefined){
        if(!p.vistas||typeof p.vistas!=='object'||Array.isArray(p.vistas))throw Error('Vistas de acciones inválidas.');
        planos[fase].vistas={};for(const [accion,vista]of Object.entries(p.vistas)){if(!fases.includes(accion)||planoDeFase(accion,d.version)!==fase||!['original','externa'].includes(vista))throw Error('Vista de acción inválida.');planos[fase].vistas[accion]=vista;}
      }
      if(p.nativas!==undefined){
        if(d.version<8||!Array.isArray(p.nativas)||new Set(p.nativas).size!==p.nativas.length||p.nativas.some(f=>!accionesDe(fase,d.version).includes(f)))throw Error('Acciones con cámara programada inválidas.');
        planos[fase].nativas=[...p.nativas];
      }
      if(p.nativasHasta!==undefined){
        if(d.version<9||!p.nativasHasta||typeof p.nativasHasta!=='object'||Array.isArray(p.nativasHasta))throw Error('Intervalos de cámara programada inválidos.');
        planos[fase].nativasHasta={};for(const [f,t]of Object.entries(p.nativasHasta)){if(!accionesDe(fase,d.version).includes(f)||!numero(t,0,d.version>=12?120.7:d.version>=11?120:d.version>=10?90:60))throw Error('Intervalo de cámara programada inválido.');planos[fase].nativasHasta[f]=t;}
      }
    }
    return {version:d.version,escena:'mago',revision:REVISION,nombre:String(d.nombre||'Mi toma').slice(0,100),planos};
  }
  const nueva=()=>({version:VERSION,escena:'mago',revision:REVISION,nombre:'El mago · Mi toma',planos:{}});
  function crear(T){
    const qa=new T.Quaternion(),qb=new T.Quaternion();
    function muestra(claves,t,antes=false){
      if(!claves?.length)return null;
      let a=claves[0],b=a;
      // Un reloj acumulado puede quedar unas milmillonésimas antes del cuadro.
      // El corte debe ocurrir en ese cuadro tanto en juego como en el editor.
      for(const k of claves){if(antes?k.t<t:k.t<=t+1e-8)a=k;else{b=k;break;}b=a;}
      if(t<=claves[0].t)b=a=claves[0];
      let u=a===b?0:Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
      if(a.curva==='corte')u=0;else if(a.curva==='suave'){
        // Al insertar una pausa, cada mitad recorre su tramo de la curva original.
        // La diferencia factorizada evita cancelación cerca de sus extremos.
        if(a.tramoSuave){const [x,y]=a.tramoSuave,d=y-x,h=6*x*(1-x);u=u*(h+u*d*(3-6*x-2*u*d))/(h+d*(3-6*x-2*d));}
        else u=u*u*(3-2*u);
      }
      qa.fromArray(a.rot).slerp(qb.fromArray(b.rot),u);
      return {pos:a.pos.map((n,i)=>n+(b.pos[i]-n)*u),rot:qa.toArray(),fov:a.fov+(b.fov-a.fov)*u,distancia:a.distancia+(b.distancia-a.distancia)*u};
    }
    function aplicar(camara,k){if(!k)return false;camara.position.fromArray(k.pos);camara.quaternion.fromArray(k.rot);camara.fov=k.fov;camara.updateProjectionMatrix();camara.updateMatrixWorld(true);return true;}
    function capturar(camara,distancia=12){return {pos:camara.position.toArray(),rot:camara.quaternion.toArray(),fov:camara.fov,distancia};}
    function tiempoDeToma(toma,estado){
      const f=estado.fase,id=planoDeFase(f,toma.version),inicio=estado.inicios?.[accionesDe(id,toma.version)[0]];
      const local=Number.isFinite(inicio)&&Number.isFinite(estado.total)?estado.total-inicio:toma.version===1||id!==planoDeFase(f)?estado.t:estado.tPlano;
      if(toma.version===VERSION)return local;
      if(toma.version>=9&&id==='techo')return local<INICIO_PAUSA?local:local<INICIO_PAUSA+PAUSA_FINAL?INICIO_PAUSA:local-PAUSA_FINAL;
      if(toma.version<11&&f==='salida')return Math.max(0,local-ANTICIPO_PUERTA);
      if(toma.version>=10)return local;
      if(f==='descubrir')return local/AMPLIACION_PANEO;
      // v10 alargó el paneo; v11 antepuso la patada; v12 añade la pausa
      // final del hechizo. Cada cambio se aplica sólo a versiones anteriores.
      if(toma.version===9)return local;
      // El recorrido externo ya editado permanece continuo aunque la actuación
      // se incorpore antes. Las claves del viejo giro quedan fuera del plano.
      if(toma.version>=4&&id==='tropezar')return local*retimeRecuperacion(toma.version);
      // Carrera era variable hasta v8. El guion entrega la duración calculada
      // desde el mismo trayecto original; no se deduce del nuevo corte F093.
      const carreraAnterior=Number.isFinite(estado.duracionCarreraAnterior)&&estado.duracionCarreraAnterior>0?estado.duracionCarreraAnterior:ahora.carrera;
      const anteriores=tiemposDe(toma.version),t=f==='carrera'?estado.t*carreraAnterior/ahora.carrera:f==='voltear'?Math.max(0,estado.t-PAUSA_PARTICULAS)*anteriores.voltear/(ahora.voltear-PAUSA_PARTICULAS):anteriores[f]===undefined?estado.t:estado.t*anteriores[f]/ahora[f];
      if(toma.version===1)return t;
      if(f==='carrera')return t;
      if(id==='tropezar'||id==='techo'){
        const acciones=accionesDe(id,toma.version);return acciones.slice(0,acciones.indexOf(f)).reduce((s,a)=>s+anteriores[a],0)+t;
      }
      if(f==='ataquePOV')return carreraAnterior+t;
      if(f==='desaparece')return carreraAnterior+anteriores.ataquePOV+t;
      return local+(id==='pies'&&toma.version===5?RECORTE_PIES:0);
    }
    function tomaEn(toma,estado){
      // El nuevo giro empieza después del corte POV. Nunca reutiliza el giro
      // externo de un montaje anterior, aunque comparta su id de acción.
      if(toma.version<7&&estado.fase==='voltear'||toma.version<9&&estado.fase==='hechizo')return {camara:null,vista:'original'};
      const id=planoDeFase(estado.fase,toma.version),p=toma.planos[id];
      const inicio=estado.inicios?.voltear,local=Number.isFinite(inicio)&&Number.isFinite(estado.total)?estado.total-inicio:estado.tPlano;
      const pausa=toma.version>=9&&toma.version<12&&id==='techo'&&local+1e-8>=INICIO_PAUSA&&local+1e-8<INICIO_PAUSA+PAUSA_FINAL;
      const hasta=toma.version<9&&estado.fase==='voltear'?PAUSA_PARTICULAS:p?.nativasHasta?.[estado.fase],tiempoAccion=toma.version<11&&estado.fase==='salida'?Math.max(0,estado.t-ANTICIPO_PUERTA):toma.version<10&&estado.fase==='descubrir'?estado.t/AMPLIACION_PANEO:toma.version>=9&&toma.version<12&&estado.fase==='hechizo'?Math.min(estado.t,3):estado.t;
      return {camara:p?.nativas?.includes(estado.fase)||tiempoAccion+1e-8<hasta||pausa&&estado.fase==='hechizo'&&hasta>=3?null:muestra(p?.claves,pausa?INICIO_PAUSA:tiempoDeToma(toma,estado),pausa),vista:p?.vistas?.[estado.fase]||p?.vista};
    }
    // Las tomas antiguas usaban una pista por acción. Se conservan sus encuadres
    // y sus cortes al reunirlas, incluyendo las acciones que seguían sin editar.
    function agrupar(toma,frames){
      if(toma.version===VERSION)return toma;
      function ampliarPaneo(p){const copia=JSON.parse(JSON.stringify(p));copia.claves.forEach(k=>k.t*=AMPLIACION_PANEO);if(copia.nativasHasta?.descubrir!==undefined)copia.nativasHasta.descubrir*=AMPLIACION_PANEO;return copia;}
      function anticiparPuerta(p){const copia=JSON.parse(JSON.stringify(p));copia.claves.forEach(k=>k.t+=ANTICIPO_PUERTA);if(copia.nativasHasta?.salida!==undefined)copia.nativasHasta.salida+=ANTICIPO_PUERTA;return copia;}
      function pausarHechizo(p){
        const copia=JSON.parse(JSON.stringify(p)),claves=copia.claves;
        if(copia.nativasHasta?.hechizo>=3)copia.nativasHasta.hechizo+=PAUSA_FINAL;
        const i=claves.findIndex(k=>k.t>=INICIO_PAUSA);
        if(i<0)return copia; // La cola de una pista sin más claves ya es inmóvil.
        const a=claves[i-1],b=claves[i],tFin=b.t;
        const quieta=muestra(claves,INICIO_PAUSA,true);
        claves.slice(i).forEach(k=>k.t+=PAUSA_FINAL);
        if(!a)return copia; // Antes de su primera clave, la cámara ya es constante.
        const pausa={...quieta,t:INICIO_PAUSA,curva:'corte'};
        if(tFin===INICIO_PAUSA)claves.splice(i,0,pausa);
        else{
          const continua={...quieta,t:INICIO_PAUSA+PAUSA_FINAL,curva:a.curva};
          if(a.curva==='suave'){
            const u=(INICIO_PAUSA-a.t)/(tFin-a.t);
            a.tramoSuave=[0,u];continua.tramoSuave=[u,1];
          }
          claves.splice(i,0,pausa,continua);
        }
        return copia;
      }
      if(toma.version>=9){
        const salida=JSON.parse(JSON.stringify(toma));salida.version=VERSION;
        if(toma.version===9&&salida.planos.descubrir)salida.planos.descubrir=ampliarPaneo(salida.planos.descubrir);
        if(toma.version<11&&salida.planos.salida)salida.planos.salida=anticiparPuerta(salida.planos.salida);
        if(salida.planos.techo)salida.planos.techo=pausarHechizo(salida.planos.techo);
        return validar(salida);
      }
      const salida={...toma,version:VERSION,planos:{}},inicios={};
      frames.forEach((f,i)=>{if(inicios[f.accion]===undefined)inicios[f.accion]=i/60-f.tAccion;});
      for(const id of idsPlanos){
        if(id==='salida'){if(toma.planos.salida)salida.planos.salida=anticiparPuerta(toma.planos.salida);continue;}
        if(id==='descubrir'){if(toma.planos.descubrir)salida.planos.descubrir=ampliarPaneo(toma.planos.descubrir);continue;}
        // El antiguo F011 pasa a F000: recorta la pista junto con la actuación.
        // Muestrea la curva previa para conservar incluso interpolaciones suaves.
        if(id==='pies'&&toma.version===5&&toma.planos.pies?.claves.length){
          salida.planos.pies={...JSON.parse(JSON.stringify(toma.planos.pies)),claves:frames.filter(f=>f.fase==='pies').map(f=>({...muestra(toma.planos.pies.claves,f.t+RECORTE_PIES),t:f.t,curva:'lineal'}))};continue;
        }
        const acciones=accionesDe(id,VERSION),origen=f=>planoDeFase(f,toma.version),pistas=[...new Set(acciones.map(origen))];
        if(id==='tropezar'&&toma.version>=4){
          const p=toma.planos.tropezar;if(p){salida.planos[id]=JSON.parse(JSON.stringify(p));salida.planos[id].claves.forEach(k=>k.t/=retimeRecuperacion(toma.version));if(p.vistas)salida.planos[id].vistas=Object.fromEntries(acciones.filter(a=>p.vistas[a]).map(a=>[a,p.vistas[a]]));}continue;
        }
        if(!['carrera','techo'].includes(id)&&pistas.length===1&&accionesDe(pistas[0],toma.version).join()===acciones.join()){if(toma.planos[pistas[0]])salida.planos[id]=JSON.parse(JSON.stringify(toma.planos[pistas[0]]));continue;}
        const nativas=acciones.filter(f=>f==='hechizo'||(f==='voltear'&&toma.version<7)||!toma.planos[origen(f)]?.claves.length||toma.planos[origen(f)]?.nativas?.includes(f));
        if(nativas.length===acciones.length)continue;
        const nativasHasta=id==='techo'&&!nativas.includes('voltear')?{voltear:PAUSA_PARTICULAS}:null;
        const cuadros=frames.map((f,i)=>({...f,indice:i})).filter(f=>f.fase===id&&!nativas.includes(f.accion)&&!(f.tAccion+1e-8<nativasHasta?.[f.accion])),vistas=Object.fromEntries(acciones.map(f=>[f,nativas.includes(f)?'original':toma.planos[origen(f)]?.vistas?.[f]||toma.planos[origen(f)]?.vista||'original']));
        // Desde v8 la cámara programada se evalúa en vivo: no queda congelada
        // en claves al importar una toma que sólo editaba otras acciones.
        salida.planos[id]={vista:vistas[acciones[0]],vistas,...(nativas.length?{nativas}:{}),...(nativasHasta?{nativasHasta}:{}),claves:cuadros.map((f,i)=>{
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

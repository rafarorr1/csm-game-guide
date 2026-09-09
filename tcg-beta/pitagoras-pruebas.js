/* Las pruebas del Editor: base compartida de seis juegos de supervivencia.
   El modelo no consulta el DOM, G, el reloj ni la red. paso() consume tiempo
   activo en subpasos: permite reproducir contactos y resultados con semilla.
   FPS: raycasting y profundidad por columna; referencia de proyección:
   https://lodev.org/cgtutor/raycasting.html (implementación propia, sin librerías). */
'use strict';
(function(global){
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
  const TIPOS={isometrico:{nombre:'La cosecha',numero:'I',sub:'No dejes que te alcancen.',texto:'Sobrevive 20 segundos. Muévete y dispara a las criaturas que te persiguen. Evita las marcas rojas del suelo.',control:'Izquierda: moverte. Derecha: apuntar y disparar. Mantén el centro para apuntar al enemigo cercano.',teclado:'WASD o flechas · Ratón para apuntar · Clic o Espacio para disparar.'},
    laseres:{nombre:'El corte final',numero:'II',sub:'La luz anuncia dónde va a doler.',texto:'Sobrevive 20 segundos. Sal de las franjas que parpadean antes de que se conviertan en rayos.',control:'Izquierda: moverte. Impulso: una escapada rápida cuando lo necesites.',teclado:'WASD o flechas para moverte · Espacio para dar un impulso.'},
    fps:{nombre:'Fuera de cuadro',numero:'III',sub:'No mires atrás. O sí.',texto:'Sobrevive 20 segundos en primera persona. Muévete entre las columnas y dispara a los perseguidores.',control:'Izquierda: caminar. Derecha: girar y disparar. Mantén el centro para disparar de frente.',teclado:'WASD para caminar · Flechas ← → para girar · Mantén clic y arrastra para mirar y disparar.'}};
  function tipoValido(t){return t===1||t==='shooter'||t==='topdown'||t==='iso'?'isometrico':t===2||t==='laser'?'laseres':t===3||t==='primeraPersona'?'fps':TIPOS[t]?t:'isometrico';}
  function azar(s){let t=s.azar+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  const MAPA=['1111111111111111','1000000000000001','1000000000000001','1000110000110001','1000110000110001','1000000000000001','1000000000000001','1000000000000001','1000000000000001','1000000000000001','1000000000000001','1000110000110001','1000110000110001','1000000000000001','1000000000000001','1111111111111111'];
  function crear(op={}){
    const tipo=tipoValido(op.tipo),semilla=Number.isFinite(op.semilla)?op.semilla>>>0:187341,s={tipo,semilla,azar:semilla,t:0,duracion:clamp(Number(op.duracion)||20,10,60),vidas:3,invulnerable:0,terminado:false,sobrevivio:false,
      jugador:tipo==='fps'?{x:8,y:12.8,a:-Math.PI/2,r:.28}:{x:0,y:2.5,a:-Math.PI/2,r:.32},enemigos:[],balas:[],rayos:[],marcas:[],proximaMarca:3.8,particulas:[],eventos:[],muertes:0,disparos:0,siguiente:.8,enfriar:0,impacto:0,fogonazo:0,impulso:0,recargaImpulso:0,ultimoMovimiento:{x:0,y:-1},pulsado:false,id:0,mapa:MAPA.slice(),camino:null,caminoEn:0};
    return s;
  }
  const pared=(s,x,y)=>!s.mapa[Math.floor(y)]||s.mapa[Math.floor(y)][Math.floor(x)]!=='0';
  function raycast(s,x,y,dx,dy,max=25){
    let mx=Math.floor(x),my=Math.floor(y),deltaX=Math.abs(1/(dx||1e-12)),deltaY=Math.abs(1/(dy||1e-12)),sx=dx<0?-1:1,sy=dy<0?-1:1;
    let ladoX=(dx<0?x-mx:mx+1-x)*deltaX,ladoY=(dy<0?y-my:my+1-y)*deltaY,lado=0,dist=0;
    for(let i=0;i<64;i++){if(ladoX<ladoY){dist=ladoX;ladoX+=deltaX;mx+=sx;lado=0;}else{dist=ladoY;ladoY+=deltaY;my+=sy;lado=1;}if(dist>max)return{d:max,lado,x:x+dx*max,y:y+dy*max};if(pared(s,mx+.5,my+.5))return{d:Math.max(.001,dist),lado,x:x+dx*dist,y:y+dy*dist};}
    return{d:max,lado,x:x+dx*max,y:y+dy*max};
  }
  function libre(s,x,y,r){return !pared(s,x-r,y-r)&&!pared(s,x+r,y-r)&&!pared(s,x-r,y+r)&&!pared(s,x+r,y+r);}
  function mover(s,u,dx,dy){if(s.tipo!=='fps'){u.x=clamp(u.x+dx,-6.55,6.55);u.y=clamp(u.y+dy,-6.55,6.55);return;}if(libre(s,u.x+dx,u.y,u.r))u.x+=dx;if(libre(s,u.x,u.y+dy,u.r))u.y+=dy;}
  function polvo(s,x,y,color,n=8){for(let i=0;i<n;i++){const a=azar(s)*TAU,v=.5+azar(s)*2;s.particulas.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.2+azar(s)*.25,color});}if(s.particulas.length>100)s.particulas.splice(0,s.particulas.length-100);}
  function herir(s){if(s.invulnerable>0||s.terminado)return false;s.vidas--;s.invulnerable=1.1;s.impacto=.42;s.eventos.push('dolor');polvo(s,s.jugador.x,s.jugador.y,'#ef3455',14);if(s.vidas<=0){s.terminado=true;s.sobrevivio=false;}return true;}
  function aparecer(s){
    const p=s.jugador;let x,y;
    for(let i=0;i<12;i++){if(s.tipo==='fps'){const sitios=[[2,2],[8,2],[13,2],[2,8],[13,8],[2,13],[13,13]];[x,y]=sitios[Math.floor(azar(s)*sitios.length)];x+=azar(s)*.35;y+=azar(s)*.35;}else{const a=Math.floor(azar(s)*4),d=azar(s)*12-6;x=a<2?(a?-6.3:6.3):d;y=a<2?d:(a===2?-6.3:6.3);}if(Math.hypot(x-p.x,y-p.y)>4)break;}
    s.enemigos.push({id:++s.id,x,y,r:s.tipo==='fps'?.34:.35,hp:s.tipo==='fps'?2:1,vel:(s.tipo==='fps'?1.25:1.65)+s.t*.032,aparece:.65,dolor:0,fase:azar(s)*TAU});
  }
  function prepararRayo(s){
    const angulos=s.t<6?[0,Math.PI/2]:[0,Math.PI/2,Math.PI/4,-Math.PI/4],a=angulos[Math.floor(azar(s)*angulos.length)],nx=Math.cos(a),ny=Math.sin(a);
    let offset=azar(s)<.6?nx*s.jugador.x+ny*s.jugador.y:(azar(s)-.5)*9;
    offset=clamp(offset,-5.6,5.6);s.rayos.push({id:++s.id,nx,ny,offset,edad:0,aviso:1.4,activo:.36,ancho:.37,emitido:false});
    if(s.t>10){s.rayos.push({id:++s.id,nx,ny,offset:clamp(offset+(offset>0?-2.8:2.8),-5.8,5.8),edad:0,aviso:1.4,activo:.36,ancho:.37,emitido:false});}
  }
  function flujo(s){
    const dist=Array.from({length:16},()=>Array(16).fill(999)),x=Math.floor(s.jugador.x),y=Math.floor(s.jugador.y),cola=[[x,y]];dist[y][x]=0;
    for(let i=0;i<cola.length;i++){const [x,y]=cola[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(!pared(s,xx+.5,yy+.5)&&dist[yy][xx]>dist[y][x]+1){dist[yy][xx]=dist[y][x]+1;cola.push([xx,yy]);}}}s.camino=dist;s.caminoEn=s.t;
  }
  function disparar(s,entrada){
    if(s.enfriar>0)return;const p=s.jugador;s.enfriar=s.tipo==='fps'?.24:.17;s.disparos++;s.fogonazo=.075;s.eventos.push('disparo');
    if(s.tipo==='fps'){
      let blanco=null,dist=14;for(const e of s.enemigos){if(e.aparece>0)continue;const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),ang=Math.atan2(dy,dx)-p.a,dif=Math.atan2(Math.sin(ang),Math.cos(ang));
        if(Math.abs(dif)<Math.atan2(e.r,d)+.055&&d<dist&&raycast(s,p.x,p.y,dx/d,dy/d,d).d>=d-.25){blanco=e;dist=d;}}
      if(blanco){blanco.hp--;blanco.dolor=.18;s.eventos.push('acierto');if(blanco.hp<=0){s.muertes++;polvo(s,blanco.x,blanco.y,'#b93252',12);}}
    }else{
      let a=Number.isFinite(entrada.apuntar)?entrada.apuntar:p.a;
      if(!Number.isFinite(entrada.apuntar)){let objetivo=null,d=Infinity;for(const e of s.enemigos){const q=Math.hypot(e.x-p.x,e.y-p.y);if(q<d&&e.aparece<=0){objetivo=e;d=q;}}if(objetivo)a=Math.atan2(objetivo.y-p.y,objetivo.x-p.x);}
      p.a=a;s.balas.push({x:p.x+Math.cos(a)*.4,y:p.y+Math.sin(a)*.4,vx:Math.cos(a)*13,vy:Math.sin(a)*13,t:1.3});
    }
  }
  function subpaso(s,e,dt){
    if(s.terminado)return;s.t=Math.min(s.duracion,s.t+dt);s.invulnerable=Math.max(0,s.invulnerable-dt);s.enfriar=Math.max(0,s.enfriar-dt);s.impacto=Math.max(0,s.impacto-dt);s.fogonazo=Math.max(0,s.fogonazo-dt);s.recargaImpulso=Math.max(0,s.recargaImpulso-dt);s.impulso=Math.max(0,s.impulso-dt);
    const p=s.jugador;let mx=clamp(Number(e.mx)||0,-1,1),my=clamp(Number(e.my)||0,-1,1),m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}if(m>.08)s.ultimoMovimiento={x:mx,y:my};
    if(s.tipo==='fps'){p.a+=clamp(Number(e.giro)||0,-4,4)*dt;const adelante=-my,cos=Math.cos(p.a),sin=Math.sin(p.a),vel=3.4; mover(s,p,(adelante*cos-mx*sin)*vel*dt,(adelante*sin+mx*cos)*vel*dt);}
    else{
      if(s.tipo==='laseres'&&e.accion&&!s.pulsado&&s.recargaImpulso===0){s.impulso=.17;s.recargaImpulso=2.2;s.eventos.push('impulso');}
      if(s.impulso>0){mx=s.ultimoMovimiento.x;my=s.ultimoMovimiento.y;}mover(s,p,mx*(s.impulso>0?13:4.7)*dt,my*(s.impulso>0?13:4.7)*dt);
    }
    s.pulsado=!!e.accion;
    if(s.tipo==='laseres'){
      if(s.t>=s.siguiente){prepararRayo(s);s.siguiente=s.t+(s.t<8?1.8:1.35);}
      for(const r of s.rayos){r.edad+=dt;if(r.edad>=r.aviso&&r.edad<r.aviso+r.activo){if(!r.emitido){s.eventos.push('laser');r.emitido=true;}if(Math.abs(p.x*r.nx+p.y*r.ny-r.offset)<r.ancho+p.r)herir(s);}}
      s.rayos=s.rayos.filter(r=>r.edad<r.aviso+r.activo+.25);
    }else{
      if(s.tipo==='isometrico'){
        if(s.t>=s.proximaMarca){s.marcas.push({x:p.x,y:p.y,edad:0,aviso:1.1,activo:.48,r:1.05,emitido:false});s.proximaMarca+=4;}
        for(const marca of s.marcas){marca.edad+=dt;if(marca.edad>=marca.aviso&&marca.edad<marca.aviso+marca.activo){if(!marca.emitido){marca.emitido=true;s.eventos.push('laser');}if(Math.hypot(p.x-marca.x,p.y-marca.y)<marca.r+p.r)herir(s);}}
        s.marcas=s.marcas.filter(m=>m.edad<m.aviso+m.activo+.2);
      }
      if(s.t>=s.siguiente&&s.enemigos.length<19){aparecer(s);s.siguiente=s.t+Math.max(.52,(s.tipo==='fps'?1.65:1.25)-s.t*.018);}
      if(e.accion)disparar(s,e);
      if(s.tipo==='fps'&&(!s.camino||s.t-s.caminoEn>.4))flujo(s);
      for(const u of s.enemigos){u.aparece=Math.max(0,u.aparece-dt);u.dolor=Math.max(0,u.dolor-dt);if(u.aparece>0||u.hp<=0)continue;
        let tx=p.x,ty=p.y,dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);
        if(s.tipo==='fps'&&d>1.3&&raycast(s,u.x,u.y,dx/d,dy/d,d).d<d-.2){let val=999;const x=Math.floor(u.x),y=Math.floor(u.y);for(const [xx,yy] of [[x,y],[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const v=s.camino[yy]?.[xx]??999;if(v<val){val=v;tx=xx+.5;ty=yy+.5;}}dx=tx-u.x;dy=ty-u.y;d=Math.hypot(dx,dy);}
        const dir=norm(dx,dy);mover(s,u,dir.x*u.vel*dt,dir.y*u.vel*dt);
        if(Math.hypot(u.x-p.x,u.y-p.y)<u.r+p.r+.06&&herir(s)){u.hp=0;s.eventos.push('acierto');}
      }
      for(const b of s.balas){b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;for(const u of s.enemigos){if(u.hp>0&&u.aparece<=0&&b.t>0&&Math.hypot(b.x-u.x,b.y-u.y)<u.r+.11){u.hp--;b.t=0;if(u.hp<=0){s.muertes++;s.eventos.push('acierto');polvo(s,u.x,u.y,'#c23c4c',9);}}}}
      s.balas=s.balas.filter(b=>b.t>0&&Math.abs(b.x)<7&&Math.abs(b.y)<7);s.enemigos=s.enemigos.filter(u=>u.hp>0);
    }
    for(const q of s.particulas){q.x+=q.vx*dt;q.y+=q.vy*dt;q.t-=dt;}s.particulas=s.particulas.filter(q=>q.t>0);
    if(!s.terminado&&s.t>=s.duracion-1e-8){s.t=s.duracion;s.terminado=true;s.sobrevivio=true;}
  }
  function paso(s,entrada={},dt=1/60){if(s.terminado)return s;dt=clamp(Number(dt)||0,0,60);while(dt>1e-8&&!s.terminado){const q=Math.min(dt,1/60,s.duracion-s.t);subpaso(s,entrada,q);dt-=q;}return s;}
  function instantanea(s){return JSON.parse(JSON.stringify(s));}
  global.PITAGORAS_PRUEBAS={modelo:{crear,paso,instantanea,herir,raycast,pared},tipos:TIPOS};
})(typeof window!=='undefined'?window:globalThis);

(function(global){
  if(typeof document==='undefined')return;
  const API=global.PITAGORAS_PRUEBAS,M=API.modelo,TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let actual=null,contador=0;
  const esbirro=new Image();esbirro.src=new URL('art/esbirro-editor-v219.webp',document.currentScript.src).href;
  function instalarCSS(){
    if(document.getElementById('pitPruebasCSS'))return;
    const estilo=document.createElement('style');estilo.id='pitPruebasCSS';estilo.textContent=`
      html.pitPruebaAbierta,body.pitPruebaAbierta{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important;height:100%!important}body.pitPruebaAbierta{position:fixed!important;inset:0!important;width:100%!important}
      .pitPrueba{position:fixed!important;inset:0!important;margin:0!important;box-sizing:border-box;width:100vw!important;height:var(--pp-alto,100dvh)!important;max-width:none!important;max-height:none!important;padding:0!important;border:0!important;border-radius:0!important;background:#080609!important;color:#f5e6df!important;overflow:hidden!important;font-family:system-ui,sans-serif;touch-action:none;overscroll-behavior:none;z-index:99999}
      .pitPrueba::backdrop{background:#050407}.ppShell{position:absolute;inset:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:radial-gradient(ellipse at 50% 35%,#2c0714,#080609 70%);padding:env(safe-area-inset-top) max(10px,env(safe-area-inset-right)) env(safe-area-inset-bottom) max(10px,env(safe-area-inset-left));box-sizing:border-box;overflow:hidden}
      .ppCabecera{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 4px 9px;border-bottom:1px solid #9f34415c;min-width:0;box-sizing:border-box;max-width:100%}.ppIdentidad{display:flex;align-items:center;gap:10px;min-width:0}.ppAvatar{height:46px;width:38px;object-fit:cover;object-position:center 20%;border:1px solid #805657;border-radius:6px;flex-shrink:0;background:#22151d}.ppNombre{max-width:100%;min-width:0}.ppNombre strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:700 16px Georgia,serif;color:#f4e0c1}.ppNombre small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.7px;color:#c79d9e;margin-top:4px}.ppReloj{display:flex;align-items:center;gap:10px}.ppTiempo{font:700 29px Georgia,serif;font-variant-numeric:tabular-nums;min-width:37px;text-align:center;color:#ffe7bc}.ppVidas{display:flex;gap:4px}.ppVida{width:13px;height:18px;background:#e95166;clip-path:polygon(50% 12%,72% 0,95% 13%,100% 42%,50% 100%,0 42%,5% 13%,28% 0);filter:drop-shadow(0 0 5px #b52551)}.ppVida.off{background:#513340;opacity:.45;filter:none}
      .ppBoton{appearance:none;border:1px solid #995359;border-radius:9px;min-height:44px;padding:10px 22px;font:700 14px system-ui,sans-serif;color:#fae6d0;background:linear-gradient(#8c253d,#51162b);box-shadow:inset 0 1px #e8958d44,0 6px 22px #0007;cursor:pointer;touch-action:manipulation}.ppBoton:hover{filter:brightness(1.12)}.ppBoton:focus-visible,.ppPad:focus-visible{outline:2px solid #ffdda9;outline-offset:3px}.ppSecundario{background:#161019;border-color:#644150;color:#d9bdbe}.ppCampo{position:relative;min-height:0;min-width:0;overflow:hidden}.ppLienzo{display:block;width:100%;height:100%;touch-action:none}.ppCronoBarra{position:absolute;left:0;right:0;top:0;height:2px;background:#331d29;pointer-events:none}.ppCronoBarra i{display:block;height:100%;transform-origin:left;background:linear-gradient(90deg,#a51f43,#efaa81);box-shadow:0 0 10px #d14452}
      .ppControles{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 18px 11px;position:relative;min-height:117px;box-sizing:border-box;background:linear-gradient(transparent,#0b080df5 25%);border-top:1px solid #92506526}.ppGrupoPad{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}.ppGrupoPad>span{font-size:9px;letter-spacing:1.1px;color:#c59da3;font-weight:700;text-align:center}.ppPad{position:relative;border:1px solid #b165695e;box-shadow:inset 0 0 25px #140c16,0 0 0 5px #a4656b0b;box-sizing:border-box;border-radius:50%;width:88px;height:88px;background:radial-gradient(circle,#482431,#21131e 62%);touch-action:none;user-select:none;cursor:crosshair}.ppPad:before,.ppPad:after{content:'';position:absolute;pointer-events:none;background:#b66a732f}.ppPad:before{width:1px;height:58%;left:50%;top:21%}.ppPad:after{height:1px;width:58%;top:50%;left:21%}.ppPulgar{position:absolute;pointer-events:none;top:calc(50% - 15px);left:calc(50% - 15px);width:30px;height:30px;border-radius:50%;border:1px solid #dca79b88;background:radial-gradient(circle at 35% 25%,#985b61,#472737);box-shadow:0 3px 10px #0008;box-sizing:border-box;z-index:1}.ppPad.ppAtacando{border-color:#ffc388;box-shadow:0 0 22px #d5414555}.ppPad.ppRecargando{opacity:.58}.ppPad .ppGlifo{position:absolute;inset:0;display:grid;place-items:center;font:24px Georgia,serif;color:#e9baae;pointer-events:none;z-index:2}.ppPad .ppPulgar+.ppGlifo{font-size:18px}.ppCentroControl{font-size:10px;color:#a9868e;text-align:center;line-height:1.5;max-width:180px}.ppCentroControl b{display:block;font-size:13px;color:#d5adb0;font-weight:500}
      .ppCapa{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:radial-gradient(ellipse at 50% 26%,#320917e8,#07050bf5 69%);padding:18px;box-sizing:border-box;overflow:hidden;transition:opacity .35s}.ppCapa[hidden]{display:none}.ppPanel{position:relative;text-align:center;width:min(470px,100%);max-height:100%;box-sizing:border-box;padding:clamp(18px,4vw,36px) clamp(16px,5vw,38px);border:1px solid #85444f;border-radius:17px;background:linear-gradient(150deg,#2b111edd,#0d0a12ee);box-shadow:0 25px 100px #000a,0 0 75px #ae1c3221}.ppOjos{height:42px;display:flex;justify-content:center;align-items:center;gap:35px;margin-bottom:14px;filter:drop-shadow(0 0 13px #eb264e)}.ppOjo{display:block;width:56px;height:14px;background:#fa214c;clip-path:polygon(0 15%,100% 35%,78% 100%,31% 80%);box-shadow:0 0 35px #f12862}.ppOjo+span{transform:scaleX(-1)}.ppAntetitulo{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#d08d95;margin-bottom:10px}.ppTitulo{font:700 clamp(27px,5vw,42px) Georgia,serif;line-height:1.1;letter-spacing:.5px;margin:0 0 12px;color:#ffe5cd}.ppSub{font:italic 14px Georgia,serif;color:#bb878f;margin:0 0 18px}.ppTexto{font-size:14px;line-height:1.55;margin:0 0 17px;color:#e1c9c9}.ppReglas{display:flex;gap:12px;justify-content:center;margin:17px 0;color:#f7ceaf;font-size:12px}.ppReglas span{padding:8px 11px;border:1px solid #89445166;border-radius:6px;background:#ae294315}.ppAyuda{font-size:12px;line-height:1.5;color:#bfa1ae;margin:0 0 19px}.ppTeclado{display:block;font-size:11px;color:#96798e;margin-top:7px}.ppBotones{display:flex;flex-direction:column;align-items:center;gap:9px}.ppBotones .ppBoton{width:100%}.ppSalida{border:0;background:none;min-height:44px;padding:9px 18px;font:12px system-ui,sans-serif;color:#b596a1;cursor:pointer}.ppSalida:hover{color:#fff}.ppCapa.ppDesvanecer{opacity:0;pointer-events:none}.ppResultadoInfo{font-size:14px;line-height:1.5;color:#d7bbc2;margin-bottom:22px}.ppEstadoLectura{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
      @media(min-width:900px){.ppShell{max-width:1300px;margin:auto;border-inline:1px solid #60313d}.ppCabecera{padding-inline:20px}.ppControles{padding-inline:80px}.ppPad{width:98px;height:98px}.ppControles{min-height:133px}.ppNombre strong{font-size:19px}.ppNombre small{font-size:11px}}
      @media(max-width:600px){.ppTeclado{display:none}.ppPanel{padding:21px 18px}.ppCentroControl{font-size:9px;max-width:95px}.ppCentroControl b{font-size:11px}.ppControles{padding-inline:10px}.ppNombre strong{font-size:14px}.ppCabecera{gap:7px}.ppReloj{gap:6px}.ppAvatar{width:31px;height:40px}.ppIdentidad{gap:7px}.ppVida{width:10px;height:14px}.ppVidas{gap:3px}.ppNombre small{letter-spacing:1px;font-size:9px}}
      @media(max-height:640px){.ppPanel{padding:16px}.ppOjos{height:23px;margin-bottom:9px}.ppTitulo{font-size:28px;margin-bottom:9px}.ppSub{margin-bottom:11px;font-size:12px}.ppTexto{font-size:13px;margin-bottom:12px}.ppReglas{margin:10px 0;gap:7px}.ppAyuda{font-size:11px;margin-bottom:12px}.ppCabecera{padding-block:7px}.ppControles{min-height:101px;padding-block:5px 7px}.ppPad{width:73px;height:73px}.ppGrupoPad{gap:5px}}
      @media(max-height:440px){.ppPanel{width:min(700px,100%);display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:16px 23px}.ppOjos{grid-column:1;grid-row:1;height:16px;margin:0}.ppAntetitulo{grid-column:1;grid-row:2;margin:0}.ppTitulo{grid-column:1;grid-row:3;font-size:27px;margin:0}.ppSub{grid-column:1;grid-row:4;margin:0}.ppTexto{grid-column:2;grid-row:1/3;margin:0;font-size:12px}.ppReglas{grid-column:1;grid-row:5;margin:0}.ppAyuda{grid-column:2;grid-row:3/5;margin:0;font-size:11px}.ppBotones{grid-column:2;grid-row:5/7;gap:2px}.ppBotones .ppSalida{padding:4px;min-height:44px}.ppResultadoInfo{grid-column:2;grid-row:2/5;margin:0;font-size:13px}.ppControles{min-height:80px;padding-block:3px}.ppPad{width:57px;height:57px}.ppGrupoPad>span{font-size:8px}.ppCabecera{padding-block:4px}.ppTiempo{font-size:22px}.ppAvatar{height:33px;width:27px}.ppNombre strong{font-size:13px}.ppNombre small{font-size:8px}}
      .ppCinematica.ppMesaVisible,.ppCinematica.ppMesaVisible::backdrop{background:transparent!important}.ppMesaVisible .ppShell{visibility:hidden}
      .ppNube{position:absolute;inset:0;width:100%;height:100%;z-index:12;pointer-events:none}
      .ppCartaJuego{position:absolute;left:50%;top:50%;translate:-50% -50%;width:min(280px,65vw);height:min(420px,74dvh);box-sizing:border-box;padding:18px 20px;z-index:10;overflow:hidden;border:1px solid #b09a69;border-radius:12px;background:linear-gradient(140deg,#222a30,#06080e 60%,#352027);box-shadow:0 0 0 4px #08090b,0 0 0 5px #6b5849,0 28px 100px #000,0 0 100px #79183255;display:flex;flex-direction:column;align-items:center;text-align:center;animation:ppCartaBaja .55s cubic-bezier(.16,1,.3,1) both}
      .ppCartaEdicion{font:9px system-ui;letter-spacing:2px;color:#c8b28d}.ppCartaJuego h1{font:small-caps 700 clamp(24px,4vw,32px) Georgia;margin:auto 0 7px;color:#f2ddaf;text-shadow:0 2px 12px #000}.ppCartaJuego p{font:italic 12px Georgia;color:#ad9eaa;margin:0 0 15px}.ppCartaStats{display:flex;width:100%;justify-content:space-between;gap:12px}.ppCartaStats span{display:grid;place-items:center;gap:6px}.ppCartaStats b{display:grid;place-items:center;width:38px;height:38px;border:1px solid #a28b60;border-radius:50%;background:radial-gradient(at 30% 20%,#4c4240,#101016);font:24px Georgia;color:#f5dfb5;box-shadow:inset 0 0 0 3px #111018}.ppCartaStats small{font:8px system-ui;letter-spacing:1px;color:#ae9c88}.ppCartaRegla{font:11px/1.5 Georgia;color:#bdaeb1;margin-top:16px}.ppCartaArte{position:relative;flex:1;min-height:65px;width:100%;margin-top:16px;background:radial-gradient(ellipse,#91384655,transparent 65%)}.ppCartaArte img{position:absolute;inset:-12% 0 0;width:100%;height:120%;object-fit:contain;z-index:1;filter:drop-shadow(0 0 16px #91384655)}.ppCartaArte:has(img) i{opacity:.12}.ppCartaArte i{position:absolute;left:50%;top:50%;width:85px;height:85px;translate:-50% -50%;border:1px solid #aa735b;rotate:45deg;box-shadow:0 0 24px #b6374020,inset 0 0 18px #b6374020}.ppCartaArte i:nth-child(2){width:63px;height:63px;rotate:65deg}.ppCartaArte i:nth-child(3){width:40px;height:40px;rotate:85deg}.ppCartaArte i:nth-child(4){width:14px;height:14px;background:#f2b18a;box-shadow:0 0 30px #f3454a}.ppCartaArte i:nth-child(5){width:120px;height:120px;border-radius:50%;border-style:dotted;opacity:.5}.ppCartaJuego[data-tipo=laseres] .ppCartaArte i{height:2px;rotate:-35deg;width:120px;background:#b45957}.ppCartaJuego[data-tipo=fps] .ppCartaArte i{rotate:0deg;aspect-ratio:1/1.3;border-color:#637f85}
      .ppCartaConsumida{animation:ppConsumir .85s ease-in both}.ppDesenlace{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:10;background:radial-gradient(ellipse,#03060b44,#03060bb0);text-align:center;pointer-events:none;animation:ppResultado .5s ease-out both}.ppDesenlace small{font:9px system-ui;letter-spacing:3px;color:#c49c8d}.ppDesenlace strong{font:small-caps 700 clamp(28px,6vw,58px) Georgia;color:#f2dfb2;text-shadow:0 5px 25px #000}.ppDesenlace span{font:14px Georgia;color:#bdb5b3}
      .ppShell{background:#06090f}.ppCabecera{background:linear-gradient(#0c1019,#11141bd9);border-bottom-color:#87725344}.ppNombre small{color:#ad9d84}.ppControles{background:linear-gradient(#0a0e14,#06080d);border-top-color:#87725333}.ppPad{background:radial-gradient(at 35% 25%,#2a303a,#0a0e16 72%);border-color:#aa947555;box-shadow:inset 0 1px 1px #ead6aa33,inset 0 0 20px #000,0 0 0 5px #a4957809}.ppPulgar{background:radial-gradient(at 30% 20%,#677078,#1b202b 80%);border-color:#c0aa8066}.ppCentroControl,.ppGrupoPad>span{color:#9b9d9e}.ppCentroControl b{color:#d0c3ab}.ppCronoBarra i{background:linear-gradient(90deg,#635f63,#d2b278);box-shadow:0 0 9px #c6a57655}
      @keyframes ppCartaBaja{from{opacity:0;translate:-50% -95%;scale:.55;rotate:-7deg}to{opacity:1;translate:-50% -50%;scale:1;rotate:0deg}}@keyframes ppConsumir{to{scale:1.12;opacity:0;filter:blur(10px)}}@keyframes ppResultado{from{opacity:0;scale:1.06}to{opacity:1;scale:1}}
      @media(prefers-reduced-motion:reduce){.ppCartaJuego,.ppDesenlace{animation:none}.ppCapa{transition:none}.ppOjos{filter:none}.ppTiempo{transition:none}}
    `;document.head.appendChild(estilo);
  }
  function nodo(tag,clase,texto,padre){const n=document.createElement(tag);n.className=clase;if(texto!=null)n.textContent=texto;padre?.appendChild(n);return n;}
  function escuchar(s,nombre,obj,fn,op){obj.addEventListener(nombre,fn,op);s.limpiar.push(()=>obj.removeEventListener(nombre,fn,op));}
  function programa(s,fn,ms){const id=setTimeout(()=>{s.timers.delete(id);if(!s.cerrada)fn();},ms);s.timers.add(id);return id;}
  function vaciarEntrada(s){for(const [id,tipo] of s.pointers){const el=tipo==='mov'?s.ui?.izquierda:tipo==='aim'?s.ui?.derecha:s.ui?.canvas;try{if(el?.hasPointerCapture?.(id))el.releasePointerCapture(id);}catch(_){}}s.keys.clear();s.mov={x:0,y:0};s.aim={x:0,y:0};s.fire=false;s.mouseFire=false;s.mirada=0;s.apuntar=null;s.pointers.clear();s.ui?.pulgar.style.setProperty('transform','translate(0,0)');s.ui?.pulgarDer.style.setProperty('transform','translate(0,0)');s.ui?.derecha.classList.remove('ppAtacando');}
  function resolver(s,r){
    if(!s||s.cerrada)return;s.cerrada=true;cancelAnimationFrame(s.raf);for(const t of s.timers)clearTimeout(t);s.timers.clear();s.limpiar.forEach(f=>f());vaciarEntrada(s);s.observer?.disconnect();
    s.nube?.remove();if(s.dialog.open)s.dialog.close();s.dialog.remove();s.desbloquear?.();if(actual===s)actual=null;
    try{s.previo?.focus?.({preventScroll:true});}catch(_){}s.resolver(r);if(r.abandonado){try{s.op.onAbandonar?.();}catch(e){console.warn('Salida de la prueba:',e);}}
  }
  // Una sola superficie modal conserva mesa, humo y juego sin un fotograma vacío.
  // El reloj arranca únicamente al despejarse la nube y habilitar controles.
  function crearNube(s){
    const c=nodo('canvas','ppNube',null,s.dialog);c.setAttribute('aria-hidden','true');s.nube=c;s.humo=0;s.humoDesde=0;s.humoHasta=0;s.humoDuracion=1;s.humoInicio=performance.now();
    const textura=document.createElement('canvas');textura.width=textura.height=128;const ctx=textura.getContext('2d');
    const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#08090dfc');g.addColorStop(.48,'#10131bea');g.addColorStop(.76,'#22222e9c');g.addColorStop(1,'#17192300');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);s.humoTextura=textura;
  }
  function pintarNube(s){
    if(!s.nube)return;const w=innerWidth,h=global.visualViewport?.height||innerHeight,d=Math.min(devicePixelRatio||1,1.5),c=s.nube,ctx=c.getContext('2d');
    if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d);}ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    const ahora=performance.now(),p=clamp((ahora-s.humoInicio)/s.humoDuracion,0,1),q=p*p*(3-2*p);s.humo=s.humoDesde+(s.humoHasta-s.humoDesde)*q;
    if(s.humo<=0)return;if(global.PITAGORAS_CINE){global.PITAGORAS_CINE.pintarNube(ctx,w,h,s.humo,ahora/1000,s.reducido,s.tipo);return;}if(s.reducido){ctx.globalAlpha=s.humo;ctx.fillStyle='#06070b';ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;return;}
    // El centro baja desde la carta rival; los bordes se enrollan, no es un fundido plano.
    const radio=Math.max(w,h),t=ahora*.00032;ctx.globalAlpha=s.humo;
    for(let i=0;i<24;i++){const a=i*2.39996+t*(i%2?1:-1),r=radio*(1-s.humo)*(.28+i%5*.07),x=w*.5+Math.cos(a)*r,y=h*.32+Math.sin(a)*r;
      const tam=radio*(.55+s.humo*.7)*(1+(i%3)*.13);ctx.drawImage(s.humoTextura,x-tam/2,y-tam/2,tam,tam);}
    ctx.globalAlpha=clamp((s.humo-.72)/.28,0,1);ctx.fillStyle='#06070b';ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
  }
  function nubeHacia(s,hasta,ms){s.humoDesde=s.humo;s.humoHasta=hasta;s.humoInicio=performance.now();s.humoDuracion=s.reducido?160:ms;}
  function entradaCinematica(s){
    s.fase='carta';s.ui.capa.hidden=true;s.dialog.classList.add('ppCinematica','ppMesaVisible');crearNube(s);
    const carta=nodo('article','ppCartaJuego',null,s.dialog);s.carta=carta;carta.dataset.tipo=s.tipo;carta.setAttribute('aria-label','Pitágoras juega '+s.info.nombre);
    nodo('div','ppCartaEdicion','PITÁGORAS · HECHIZO · 2 PD',carta);
    const arte=nodo('div','ppCartaArte',null,carta);if(global.PITAGORAS_CINE){s.arteCarta=nodo('canvas','ppArteCanvas',null,arte);s.arteCarta.setAttribute('aria-hidden','true');}else if(s.tipo!=='laseres'){const img=nodo('img','',null,arte);img.src=esbirro.src;img.alt='Esbirro del Editor';img.onerror=()=>img.remove();}for(let i=0;i<5;i++)nodo('i','',null,arte);
    nodo('h1','',s.info.nombre,carta);nodo('p','',s.info.sub,carta);
    const stats=nodo('div','ppCartaStats',null,carta);for(const [n,l] of [[s.modelo.duracion,'SEGUNDOS'],[3,'VIDAS'],[2,'ALMA']]){const stat=nodo('span','',null,stats);nodo('b','',String(n),stat);nodo('small','',l,stat);}
    nodo('div','ppCartaRegla','Sobrevive y hiere al Editor. Cae y entrega tu Alma.',carta);
    programa(s,()=>{s.fase='cubriendo';nubeHacia(s,1,850);carta.classList.add('ppCartaConsumida');},s.reducido?250:1150);
    programa(s,()=>{s.humo=1;s.dialog.classList.remove('ppMesaVisible');carta.remove();s.fase='revelando';nubeHacia(s,0,1000);},s.reducido?430:2050);
    programa(s,()=>{s.fase='jugando';s.humo=0;s.ultimo=performance.now();s.dialog.focus({preventScroll:true});s.ui.lectura.textContent=s.info.nombre+'. '+s.info.control;},s.reducido?610:3050);
  }
  function salidaCinematica(s){
    const mensaje=nodo('div','ppDesenlace',null,s.dialog);mensaje.setAttribute('role','status');
    nodo('small','',s.modelo.sobrevivio?'REALIDAD RECUPERADA':'EL EDITOR COBRA SU PRECIO',mensaje);
    nodo('strong','',s.modelo.sobrevivio?'Sobreviviste':'Te encontró',mensaje);
    nodo('span','',s.modelo.sobrevivio?'Pitágoras −2 de Alma':'Tu personaje −2 de Alma',mensaje);
    programa(s,()=>{s.fase='regresando';global.CAOZ_AUDIO?.play('spell_shadow',{volumen:.35});nubeHacia(s,1,750);},s.reducido?350:950);
    programa(s,()=>{s.humo=1;mensaje.remove();s.dialog.classList.add('ppMesaVisible');nubeHacia(s,0,850);},s.reducido?530:1750);
    programa(s,()=>resolver(s,{sobrevivio:s.modelo.sobrevivio,cancelado:false}),s.reducido?720:2650);
  }
  function hacerPanel(s,modo){
    const ui=s.ui,c=ui.capa;c.replaceChildren();c.hidden=false;c.classList.remove('ppDesvanecer');const panel=nodo('section','ppPanel',null,c);panel.setAttribute('aria-labelledby','ppTitulo-'+s.id);
    const ojos=nodo('div','ppOjos',null,panel);ojos.setAttribute('aria-hidden','true');nodo('span','ppOjo',null,ojos);nodo('span','ppOjo',null,ojos);
    nodo('div','ppAntetitulo',modo==='intro'?'Prueba '+s.info.numero+' · Pitágoras':modo==='resultado'?'La prueba ha terminado':'Abandonar la prueba',panel);
    const titulo=nodo('h1','ppTitulo',modo==='intro'?s.info.nombre:modo==='resultado'?(s.modelo.sobrevivio?'Sigues aquí.':'Te encontró.'):'¿Volver al menú?',panel);titulo.id='ppTitulo-'+s.id;
    nodo('p','ppSub',modo==='intro'?s.info.sub:modo==='resultado'?(s.modelo.sobrevivio?'El Editor también puede sangrar.':'No todo queda en la mesa.'):'La partida contra Pitágoras terminará.',panel);
    const texto=modo==='intro'?s.info.texto:modo==='resultado'?(s.modelo.sobrevivio?'Sobreviviste. Pitágoras pierde 2 de Alma.':'Perdiste tus 3 vidas. Tu personaje pierde 2 de Alma.'):'Puedes regresar a la prueba o abandonar y volver al menú principal.';
    nodo('p',modo==='resultado'?'ppResultadoInfo':'ppTexto',texto,panel);
    if(modo==='intro'){const reglas=nodo('div','ppReglas',null,panel);nodo('span','','20 segundos',reglas);nodo('span','','3 vidas',reglas);const ayuda=nodo('p','ppAyuda',s.info.control,panel);nodo('span','ppTeclado',s.info.teclado,ayuda);}
    const botones=nodo('div','ppBotones',null,panel),btn=nodo('button','ppBoton',modo==='intro'?'Entrar a la prueba':modo==='resultado'?'Volver a la mesa':'Volver',botones);btn.type='button';
    btn.onclick=()=>{if(modo==='intro')empezar(s);else if(modo==='resultado')resolver(s,{sobrevivio:s.modelo.sobrevivio,cancelado:false});else{s.fase=s.antesSalir;hacerPanel(s,s.fase);}};
    const salir=nodo('button',modo==='salir'?'ppBoton ppSecundario':'ppSalida',modo==='salir'?'Salir al menú principal':'Salir de la prueba',botones);salir.type='button';salir.onclick=()=>modo==='salir'?resolver(s,{sobrevivio:false,cancelado:true,abandonado:true}):confirmarSalida(s);
    programa(s,()=>btn.focus({preventScroll:true}),30);
  }
  function confirmarSalida(s){if(s.op.cinematica)return;if(s.cerrada||!['intro','resultado','salir'].includes(s.fase))return;s.antesSalir=s.fase==='salir'?s.antesSalir:s.fase;s.fase='salir';vaciarEntrada(s);hacerPanel(s,'salir');}
  function empezar(s){if(s.cerrada||s.fase!=='intro')return;s.fase='entrada';s.ui.capa.classList.add('ppDesvanecer');global.CAOZ_AUDIO?.play('spell_shadow',{volumen:.45});programa(s,()=>{if(s.fase!=='entrada')return;vaciarEntrada(s);s.ui.capa.hidden=true;s.fase='jugando';s.ultimo=performance.now();s.dialog.focus({preventScroll:true});},s.reducido?80:420);}
  function bloquearDesplazamiento(s){
    const x=scrollX,y=scrollY,raiz=document.documentElement,cuerpo=document.body;
    raiz.classList.add('pitPruebaAbierta');cuerpo.classList.add('pitPruebaAbierta');
    // Safari puede arrastrar la página situada debajo de un dialog modal.
    // El bloqueo vive también en la raíz y se retira al volver a la mesa.
    const impedir=e=>{if(e.cancelable)e.preventDefault();};
    escuchar(s,'touchmove',document,impedir,{passive:false,capture:true});
    escuchar(s,'wheel',document,impedir,{passive:false,capture:true});
    s.desbloquear=()=>{raiz.classList.remove('pitPruebaAbierta');cuerpo.classList.remove('pitPruebaAbierta');global.scrollTo(x,y);};
  }
  function crearUI(s){
    instalarCSS();const d=document.createElement('dialog');d.className='pitPrueba';d.dataset.tipo=s.tipo;d.setAttribute('aria-label','Prueba de Pitágoras: '+s.info.nombre);s.dialog=d;
    const shell=nodo('div','ppShell',null,d),cab=nodo('header','ppCabecera',null,shell),identidad=nodo('div','ppIdentidad',null,cab),avatar=nodo('img','ppAvatar',null,identidad);avatar.alt='Tu personaje';
    try{if(typeof campanaRetrato==='function')avatar.src=campanaRetrato(s.op.personaje||{nombre:s.nombre});else avatar.hidden=true;}catch(_){avatar.hidden=true;}
    const nombre=nodo('div','ppNombre',null,identidad);nodo('strong','',s.nombre,nombre);nodo('small','',s.info.numero+' · '+s.info.nombre,nombre);
    const reloj=nodo('div','ppReloj',null,cab),vidas=nodo('div','ppVidas',null,reloj),corazones=[];for(let i=0;i<3;i++)corazones.push(nodo('i','ppVida',null,vidas));vidas.setAttribute('aria-label','3 vidas');const tiempo=nodo('span','ppTiempo','20',reloj);tiempo.setAttribute('aria-label','20 segundos restantes');

    const campo=nodo('main','ppCampo',null,shell),canvas=nodo('canvas','ppLienzo',null,campo);canvas.setAttribute('aria-label',s.info.nombre+'. '+s.info.control);canvas.setAttribute('role','img');const barra=nodo('div','ppCronoBarra',null,campo),progreso=nodo('i','',null,barra);
    const controles=nodo('div','ppControles',null,shell),grupo=nodo('div','ppGrupoPad',null,controles),izquierda=nodo('div','ppPad',null,grupo),pulgar=nodo('i','ppPulgar',null,izquierda);izquierda.tabIndex=0;izquierda.setAttribute('aria-label','Control de movimiento. También puedes usar WASD.');nodo('span','',s.info.movimiento||'MOVER',grupo);
    const centro=nodo('div','ppCentroControl',null,controles);nodo('b','',s.info.instruccion||(s.tipo==='laseres'?'Anticipa. Esquiva.':'Muévete. Dispara.'),centro);nodo('span','',s.info.ayuda||(s.tipo==='laseres'?'Las franjas avisan antes de cortar.':'Mantén el control derecho para disparar.'),centro);
    const grupoDer=nodo('div','ppGrupoPad',null,controles),derecha=nodo('div','ppPad',null,grupoDer),pulgarDer=nodo('i','ppPulgar',null,derecha);derecha.tabIndex=0;derecha.setAttribute('aria-label',s.info.accion|| (s.tipo==='fps'?'Girar y disparar':s.tipo==='laseres'?'Impulso. También Espacio.':'Apuntar y disparar. También ratón y clic.'));nodo('span','ppGlifo',s.info.glifo||(s.tipo==='laseres'?'↯':'⌖'),derecha);nodo('span','',s.info.accion||(s.tipo==='fps'?'GIRAR + DISPARAR':s.tipo==='laseres'?'IMPULSO':'APUNTAR + DISPARAR'),grupoDer);
    const capa=nodo('div','ppCapa',null,d),lectura=nodo('div','ppEstadoLectura','',d);lectura.setAttribute('aria-live','polite');s.ui={shell,cab,avatar,vidas,corazones,tiempo,campo,canvas,progreso,izquierda,derecha,pulgar,pulgarDer,capa,lectura};
    document.body.appendChild(d);bloquearDesplazamiento(s);d.showModal();d.focus({preventScroll:true});if(s.op.cinematica)entradaCinematica(s);else hacerPanel(s,'intro');
    escuchar(s,'cancel',d,e=>{e.preventDefault();confirmarSalida(s);});escuchar(s,'close',d,()=>{if(!s.cerrada)resolver(s,{sobrevivio:false,cancelado:true});});
    const ajustar=()=>{const v=global.visualViewport;d.style.setProperty('--pp-alto',Math.round(v?.height||innerHeight)+'px');};ajustar();escuchar(s,'resize',global,ajustar);if(global.visualViewport){escuchar(s,'resize',global.visualViewport,ajustar);}
    escuchar(s,'visibilitychange',document,()=>{if(document.hidden)vaciarEntrada(s);});escuchar(s,'blur',global,()=>vaciarEntrada(s));
    const teclas=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','Space']);
    escuchar(s,'keydown',global,e=>{if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(s.fase==='salir')s.ui.capa.querySelector('.ppBoton')?.click();else confirmarSalida(s);return;}if(!teclas.has(e.code))return;e.stopImmediatePropagation();if(s.fase==='jugando'){e.preventDefault();s.keys.add(e.code);}else if(e.code!=='Space')e.preventDefault();},true);
    escuchar(s,'keyup',global,e=>{if(teclas.has(e.code)){s.keys.delete(e.code);if(s.fase==='jugando'){e.preventDefault();e.stopImmediatePropagation();}}},true);
    function pad(el,lado){
      const actualizar=e=>{if(s.fase!=='jugando'||s.pointers.get(e.pointerId)!==lado)return;const r=el.getBoundingClientRect(),radio=r.width*.36;let x=(e.clientX-r.left-r.width/2)/radio,y=(e.clientY-r.top-r.height/2)/radio,d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}
        if(lado==='mov'){s.mov={x,y};pulgar.style.transform=`translate(${x*radio*.72}px,${y*radio*.72}px)`;}else{s.aim={x,y};s.fire=true;pulgarDer.style.transform=`translate(${x*radio*.72}px,${y*radio*.72}px)`;derecha.classList.add('ppAtacando');}};
      escuchar(s,'pointerdown',el,e=>{if(s.fase!=='jugando'||e.button>0||[...s.pointers.values()].includes(lado))return;e.preventDefault();s.pointers.set(e.pointerId,lado);el.setPointerCapture?.(e.pointerId);actualizar(e);});escuchar(s,'pointermove',el,actualizar);
    }
    pad(izquierda,'mov');pad(derecha,'aim');
    const soltar=e=>{const lado=s.pointers.get(e.pointerId);s.pointers.delete(e.pointerId);if(lado==='mov'){s.mov={x:0,y:0};pulgar.style.transform='translate(0,0)';}if(lado==='aim'){s.aim={x:0,y:0};s.fire=false;pulgarDer.style.transform='translate(0,0)';derecha.classList.remove('ppAtacando');}if(lado==='raton')s.mouseFire=false;};
    escuchar(s,'pointerup',global,soltar);escuchar(s,'pointercancel',global,soltar);escuchar(s,'lostpointercapture',izquierda,soltar);escuchar(s,'lostpointercapture',derecha,soltar);escuchar(s,'lostpointercapture',canvas,soltar);
    escuchar(s,'pointerdown',canvas,e=>{if(s.fase!=='jugando'||e.button>0||e.pointerType==='touch')return;e.preventDefault();s.mouseFire=true;s.pointers.set(e.pointerId,'raton');s.mouseX=e.clientX;canvas.setPointerCapture?.(e.pointerId);});
    escuchar(s,'pointermove',canvas,e=>{if(s.fase!=='jugando'||e.pointerType==='touch')return;if(s.tipo==='fps'){if(s.mouseFire){s.mirada+=(e.clientX-s.mouseX)*.007;s.mouseX=e.clientX;}}else if(s.tipo==='isometrico'){const r=canvas.getBoundingClientRect(),q=proyeccion(s),x=(e.clientX-r.left-q.cx)/q.esc,y=(e.clientY-r.top-q.cy)/q.esc;s.apuntar=Math.atan2(y-s.modelo.jugador.y,x-s.modelo.jugador.x);}});
    escuchar(s,'contextmenu',canvas,e=>e.preventDefault());
  }
  function proyeccion(s){const w=s.ancho||300,h=s.alto||350;if(s.tipo==='isometrico'){const esc=Math.min(w/11.5,h/12.5),p=s.modelo.jugador;return{cx:w/2-p.x*esc*.36,cy:h/2-p.y*esc*.36,esc};}return{cx:w/2,cy:h/2,esc:Math.min(w,h)/15.2};}
  function proyectar(s,x,y,z=0){const q=proyeccion(s);return{x:q.cx+x*q.esc,y:q.cy+y*q.esc-(s.tipo==='isometrico'?0:z*q.esc)};}
  function poligono(c,ps,color,borde){c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();if(borde){c.strokeStyle=borde;c.stroke();}}
  function sombra(c,x,y,rx,ry){c.fillStyle='#02020788';c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,TAU);c.fill();}
  function criatura(c,x,y,tam,fase,dolor=0){
    if(esbirro.complete&&esbirro.naturalWidth){c.save();c.translate(x,y);c.rotate(Math.sin(fase*.45)*.025);if(dolor>0)c.filter='brightness(1.6)';const h=tam*1.3,w=h*2/3;c.drawImage(esbirro,-w/2,-h+Math.sin(fase)*1.2,w,h);c.restore();return;}
    c.save();c.translate(x,y);c.scale(tam/50,tam/50);const a=Math.sin(fase)*5;
    c.lineCap='round';c.strokeStyle=dolor>0?'#f3c2ac':'#321624';c.lineWidth=8;
    for(const lado of [-1,1]){c.beginPath();c.moveTo(lado*9,-35);c.quadraticCurveTo(lado*(21+a*.35),-28,lado*(25-a*.3),-13);c.lineTo(lado*(21+a*.2),-3);c.stroke();c.strokeStyle='#873045';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(lado*(21+a*.2),-4);c.lineTo(lado*(24+i*2+a*.2),3+i);c.stroke();}c.strokeStyle=dolor>0?'#f3c2ac':'#321624';c.lineWidth=8;}
    const g=c.createLinearGradient(-12,-45,15,0);g.addColorStop(0,dolor>0?'#cf9c9a':'#632334');g.addColorStop(1,'#1b111c');c.fillStyle=g;c.beginPath();c.moveTo(-9,-37);c.bezierCurveTo(-19,-22,-9,-10,-12,0);c.lineTo(-4,-1);c.lineTo(0,-13);c.lineTo(5,-1);c.lineTo(13,0);c.bezierCurveTo(9,-19,18,-25,8,-39);c.fill();
    c.fillStyle=dolor>0?'#f9d8bd':'#654046';c.beginPath();c.ellipse(0,-43,10,11,.1*Math.sin(fase),0,TAU);c.fill();
    c.strokeStyle='#b9646c';c.lineWidth=1.1;c.beginPath();c.moveTo(-5,-28);c.lineTo(6,-26);c.moveTo(-5,-21);c.lineTo(5,-22);c.stroke();
    c.fillStyle='#fa234b';c.shadowColor='#ff1749';c.shadowBlur=7;c.fillRect(-7,-46,5,2.5);c.fillRect(3,-46,5,2.5);c.shadowBlur=0;c.fillStyle='#160e14';c.beginPath();c.ellipse(0,-36,3,4,0,0,TAU);c.fill();
    c.strokeStyle='#7d273c';c.lineWidth=2;for(let i=0;i<3;i++){const lado=i%2?1:-1;c.beginPath();c.moveTo(lado*5,-50);c.quadraticCurveTo(lado*(13+i*2),-60+i*3,lado*(5+a*.5+i*3),-63-i*2);c.stroke();}c.restore();
  }
  function hacerMiniatura(s){
    try{if(typeof campanaGeometriaPersonaje==='function'&&typeof campanaPintarRetrato==='function'){const c=document.createElement('canvas');c.width=120;c.height=154;campanaPintarRetrato(c.getContext('2d'),campanaGeometriaPersonaje(s.op.personaje||{nombre:s.nombre}),120,154,-.22);s.miniatura=c;}}
    catch(_){s.miniatura=null;}
  }
  function jugador(s,c,x,y,esc){
    const p=s.modelo.jugador,parpadeo=s.modelo.invulnerable>0&&Math.floor(s.modelo.t*13)%2===0;c.save();c.globalAlpha=parpadeo?.42:1;sombra(c,x,y,esc*.47,esc*.2);
    c.strokeStyle='#facf877d';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,esc*.55,esc*.3,0,0,TAU);c.stroke();
    if(s.miniatura)c.drawImage(s.miniatura,x-esc*.6,y-esc*1.54,esc*1.2,esc*1.54);
    else{c.fillStyle='#b3a4bf';c.beginPath();c.arc(x,y-esc*.95,esc*.21,0,TAU);c.fill();poligono(c,[{x:x-esc*.23,y:y-esc*.76},{x:x+esc*.22,y:y-esc*.76},{x:x+esc*.38,y},{x:x-esc*.36,y}],'#8c5373');}
    if(s.tipo==='isometrico'){const b=proyectar(s,p.x+Math.cos(p.a)*.62,p.y+Math.sin(p.a)*.62,.55);c.strokeStyle='#e8c5aa';c.lineWidth=Math.max(2,esc*.11);c.beginPath();c.moveTo(x,y-esc*.55);c.lineTo(b.x,b.y);c.stroke();if(s.modelo.fogonazo>0){c.fillStyle='#fff0b0';c.shadowColor='#ffc478';c.shadowBlur=12;c.beginPath();c.arc(b.x,b.y,esc*.2,0,TAU);c.fill();}}
    c.restore();
  }
  // Material estable: detalle generado una sola vez, sin gastar azar del combate.
  function materiales(s){
    if(s.piedra)return;
    const c=document.createElement('canvas');c.width=c.height=192;const x=c.getContext('2d');
    x.fillStyle='#283039';x.fillRect(0,0,192,192);
    for(let i=0;i<700;i++){const a=(Math.sin(i*127.1+3)*43758.5453)%1,b=(Math.sin(i*311.7+9)*96453.12)%1;x.fillStyle=i%2?'#89939b09':'#02070c12';x.fillRect(Math.abs(a)*192,Math.abs(b)*192,1+i%4,1+i%3);}
    for(let y=0;y<192;y+=48){x.fillStyle='#05090e';x.fillRect(0,y,192,2);x.fillStyle='#bdc3c51a';x.fillRect(0,y+2,192,1);for(let k=0;k<3;k++){const a=(k*80+(y%96?40:0))%192;x.fillStyle='#05090e';x.fillRect(a,y,2,48);}}
    s.piedra=c;
  }
  function atmosfera(s,c){
    const w=s.ancho,h=s.alto,t=s.modelo.t;
    // Bruma tenue en los bordes; el centro y las señales de peligro quedan legibles.
    for(let i=0;i<5;i++){const x=w*(i/4)+Math.sin(t*.13+i)*w*.08,y=h*(.72+Math.sin(i*2+t*.09)*.17),r=w*.33;
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#768b9b0b');g.addColorStop(1,'#768b9b00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
    c.fillStyle='#c8bcab';for(let i=0;i<32;i++){c.globalAlpha=.08+(i%4)*.045;const x=((i*127.31+Math.sin(t*.15+i)*14)%w+w)%w,y=((i*79.17-t*(2+i%5))%h+h)%h;c.beginPath();c.arc(x,y,.4+(i%3)*.35,0,TAU);c.fill();}c.globalAlpha=1;
  }
  function fondo(s,c){
    const w=s.ancho,h=s.alto,t=s.modelo.t,g=c.createRadialGradient(w*.5,h*.45,15,w*.5,h*.45,Math.max(w,h)*.67);g.addColorStop(0,'#27343d');g.addColorStop(.62,'#101b25');g.addColorStop(1,'#05090f');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.strokeStyle='#a8314525';c.lineWidth=1;for(let i=0;i<16;i++){const lado=i%2?-1:1,origen=lado<0?0:w,y=(i/16+.06)*h;c.beginPath();c.moveTo(origen,y);for(let j=1;j<=6;j++){const x=origen-lado*j*w*.022;c.lineTo(x,y+Math.sin(i*4+j*2+t*.45)*j*3);}c.stroke();}
  }
  function sueloCenital(s){
    if(s.sueloCenital)return s.sueloCenital;
    const n=896,l=document.createElement('canvas');l.width=l.height=n;const c=l.getContext('2d');
    c.fillStyle='#151c22';c.fillRect(0,0,n,n);
    // Los bloques conservan una textura coherente en coordenadas del mundo.
    for(let y=0;y<14;y++)for(let x=0;x<14;x++){const gris=26+Math.round(Math.sin(x*12.98+y*78.2)*4),px=x*64,py=y*64;c.fillStyle=`rgb(${gris},${gris+7},${gris+10})`;c.fillRect(px+1,py+1,62,62);c.globalAlpha=.36;c.drawImage(s.piedra,px+2,py+2,60,60);c.globalAlpha=1;c.strokeStyle='#a3abb512';c.strokeRect(px+2.5,py+2.5,60,60);
      if((x*7+y*13)%5===0){c.strokeStyle='#070c13aa';c.beginPath();c.moveTo(px+7,py+17);c.lineTo(px+29,py+25);c.lineTo(px+35,py+51);c.moveTo(px+29,py+25);c.lineTo(px+53,py+22);c.stroke();}}
    c.translate(n/2,n/2);c.strokeStyle='#92826355';c.lineWidth=2;for(const r of [178,188,340,348]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}
    for(let i=0;i<32;i++){c.save();c.rotate(i*TAU/32);c.strokeStyle=i%4?'#9a88554a':'#c9ae7188';c.lineWidth=2;c.beginPath();c.moveTo(0,-327);c.lineTo(0,-307);c.lineTo(6,-317);c.moveTo(-6,-321);c.lineTo(6,-321);c.stroke();c.restore();}
    c.strokeStyle='#6973833b';c.lineWidth=2;for(let i=0;i<8;i++){const a=i*TAU/8;c.beginPath();c.moveTo(Math.cos(a)*198,Math.sin(a)*198);c.lineTo(Math.cos(a)*290,Math.sin(a)*290);c.stroke();}
    const g=c.createRadialGradient(0,0,80,0,0,n*.7);g.addColorStop(0,'#72859212');g.addColorStop(1,'#01040b99');c.fillStyle=g;c.fillRect(-n/2,-n/2,n,n);s.sueloCenital=l;return l;
  }
  function cuerpoCenital(s,c,x,y,r,a,enemigo,fase){
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);const mov=Math.sin(fase),tela=enemigo?'#342832':s.coloresCenital?.tela||'#722d46';
    c.fillStyle='#0009';c.beginPath();c.ellipse(3,5,r*.8,r*1.1,.2,0,TAU);c.fill();
    // Capa, hombros, cabeza y arma vistos verticalmente desde arriba.
    const capa=c.createLinearGradient(-r,0,r,0);capa.addColorStop(0,'#0b1019');capa.addColorStop(.45,tela);capa.addColorStop(.65,tela);capa.addColorStop(1,'#0b0d15');c.fillStyle=capa;c.beginPath();c.moveTo(-r*.58,-r*.1);c.bezierCurveTo(-r*.85,r*.6,-r*.62+mov*r*.1,r*1.2,0,r*.98);c.bezierCurveTo(r*.73+mov*r*.1,r*1.25,r*.82,r*.25,r*.58,-r*.1);c.closePath();c.fill();c.strokeStyle=enemigo?'#67515d':'#cfb57b99';c.lineWidth=1;c.stroke();
    c.fillStyle=enemigo?'#514852':'#596574';for(const z of [-1,1]){c.save();c.translate(z*r*.6,-r*.15+mov*z*r*.1);c.rotate(z*.35);c.beginPath();c.ellipse(0,0,r*.29,r*.36,0,0,TAU);c.fill();c.strokeStyle='#adacac55';c.stroke();c.restore();}
    const piel=enemigo?'#a9a498':s.coloresCenital?.piel||'#c88b68',pelo=enemigo?'#252530':s.coloresCenital?.pelo||'#25202a';
    c.fillStyle=piel;c.beginPath();c.ellipse(0,-r*.32,r*.33,r*.43,0,0,TAU);c.fill();const g=c.createRadialGradient(-r*.13,-r*.48,0,0,-r*.32,r*.5);g.addColorStop(0,enemigo?'#bfc2b6':pelo);g.addColorStop(1,'#12141e');c.fillStyle=g;c.beginPath();c.ellipse(0,-r*.22,r*.34,r*.33,0,0,TAU);c.fill();
    if(enemigo){c.strokeStyle='#382d36';c.lineWidth=r*.1;for(let i=0;i<5;i++){c.beginPath();c.moveTo((i-2)*r*.16,0);c.quadraticCurveTo((i-2)*r*.42,r*.5,(i-2)*r*.43+mov*2,r*1.05);c.stroke();}c.fillStyle='#ff4b5c';c.shadowColor='#f21d49';c.shadowBlur=7;c.fillRect(-r*.25,-r*.59,r*.16,r*.09);c.fillRect(r*.09,-r*.59,r*.16,r*.09);}
    else{c.strokeStyle='#b8a57b';c.lineWidth=r*.16;c.lineCap='round';c.beginPath();c.moveTo(r*.44,-r*.03);c.lineTo(r*.25,-r*1.35);c.stroke();c.fillStyle='#c7efff';c.shadowColor='#6ecaff';c.shadowBlur=12;c.beginPath();c.arc(r*.25,-r*1.4,r*.16,0,TAU);c.fill();}
    c.restore();
  }
  function isometrico(s,c){
    const q=proyeccion(s),p=s.modelo.jugador,t=s.modelo.t,r=q.esc,w=s.ancho,h=s.alto,ox=q.cx-7*r,oy=q.cy-7*r;
    c.fillStyle='#030710';c.fillRect(0,0,w,h);c.save();c.globalAlpha=.12;c.fillStyle=c.createPattern(s.piedra,'repeat');c.fillRect(0,0,w,h);c.restore();c.drawImage(sueloCenital(s),ox,oy,14*r,14*r);
    c.strokeStyle='#65543d';c.lineWidth=r*.15;c.strokeRect(ox-r*.09,oy-r*.09,14.18*r,14.18*r);c.strokeStyle='#d0b27a44';c.lineWidth=1;c.strokeRect(ox+2,oy+2,14*r-4,14*r-4);
    for(const [x,y] of [[-6.7,-6.7],[6.7,-6.7],[-6.7,6.7],[6.7,6.7]]){const a=proyectar(s,x,y),l=c.createRadialGradient(a.x,a.y,0,a.x,a.y,r*3.2);l.addColorStop(0,'#e9b46648');l.addColorStop(.35,'#b6772617');l.addColorStop(1,'#e9b46600');c.fillStyle=l;c.fillRect(a.x-r*3.2,a.y-r*3.2,r*6.4,r*6.4);c.fillStyle='#302a27';c.beginPath();c.arc(a.x,a.y,r*.22,0,TAU);c.fill();c.fillStyle='#ffe5a0';c.shadowColor='#ffa750';c.shadowBlur=14;c.beginPath();c.arc(a.x,a.y,r*(.08+.015*Math.sin(t*8+x)),0,TAU);c.fill();c.shadowBlur=0;}
    for(const m of s.modelo.marcas){const a=proyectar(s,m.x,m.y),aviso=m.edad<m.aviso,z=clamp(m.edad/m.aviso,0,1);c.fillStyle=aviso?'#ff243812':'#ff33537b';c.strokeStyle=aviso?'#ff9e74':'#ffe4aa';c.lineWidth=aviso?1.5:3;c.beginPath();c.arc(a.x,a.y,m.r*r,0,TAU);c.fill();c.stroke();c.beginPath();c.arc(a.x,a.y,m.r*r, -Math.PI/2,-Math.PI/2+TAU*z);c.lineWidth=3;c.stroke();c.lineWidth=1;for(let i=0;i<4;i++){const b=i*TAU/4+t*.3;c.beginPath();c.moveTo(a.x+Math.cos(b)*r*.2,a.y+Math.sin(b)*r*.2);c.lineTo(a.x+Math.cos(b)*r*.6,a.y+Math.sin(b)*r*.6);c.stroke();}}
    for(const b of s.modelo.balas){const a=proyectar(s,b.x,b.y),z=proyectar(s,b.x-b.vx*.042,b.y-b.vy*.042);c.strokeStyle='#87dfff';c.shadowColor='#63ccff';c.shadowBlur=10;c.lineWidth=3;c.beginPath();c.moveTo(z.x,z.y);c.lineTo(a.x,a.y);c.stroke();c.strokeStyle='#f2fbff';c.lineWidth=1;c.stroke();}c.shadowBlur=0;
    for(const e of s.modelo.enemigos){const a=proyectar(s,e.x,e.y);c.save();c.globalAlpha=e.aparece>0?Math.max(.08,1-e.aparece/.65):1;cuerpoCenital(s,c,a.x,a.y,r*.47,Math.atan2(p.y-e.y,p.x-e.x),true,e.fase+t*8);c.restore();if(e.aparece>0){c.strokeStyle='#ff487177';c.beginPath();c.arc(a.x,a.y,r*(.5+e.aparece*.6),0,TAU);c.stroke();}}
    if(!s.coloresCenital){try{const pers=campanaNormalizarPersonaje(s.op.personaje);s.coloresCenital={tela:CAMPANA_ASPECTO.color[pers.color][1],piel:CAMPANA_ASPECTO.piel[pers.piel][1],pelo:CAMPANA_ASPECTO.cabello[pers.cabello][1]};}catch(_){s.coloresCenital={};}}
    const a=proyectar(s,p.x,p.y);c.save();c.globalAlpha=s.modelo.invulnerable>0&&Math.floor(t*12)%2?.5:1;c.strokeStyle='#dec496bb';c.lineWidth=1.5;c.beginPath();c.arc(a.x,a.y,r*.55,0,TAU);c.stroke();cuerpoCenital(s,c,a.x,a.y,r*.46,p.a,false,t*8*s.andando);c.restore();
    if(s.modelo.fogonazo>0){const x=a.x+Math.cos(p.a)*r*.68,y=a.y+Math.sin(p.a)*r*.68,g=c.createRadialGradient(x,y,0,x,y,r*1.1);g.addColorStop(0,'#d8faffbb');g.addColorStop(.2,'#7edbff66');g.addColorStop(1,'#63cfff00');c.fillStyle=g;c.fillRect(x-r*1.1,y-r*1.1,r*2.2,r*2.2);}
    particulas(s,c);
  }
  function particulas(s,c){for(const p of s.modelo.particulas){const a=proyectar(s,p.x,p.y,.2);c.globalAlpha=Math.min(1,p.t*3);c.fillStyle=p.color;c.fillRect(a.x-1.5,a.y-1.5,3,3);}c.globalAlpha=1;}
  function laseres(s,c){
    fondo(s,c);const q=proyeccion(s),x=q.cx-7*q.esc,y=q.cy-7*q.esc,tam=q.esc*14,t=s.modelo.t;
    c.fillStyle=c.createPattern(s.piedra,'repeat');c.fillRect(x,y,tam,tam);const luz=c.createRadialGradient(q.cx,q.cy,0,q.cx,q.cy,tam*.7);luz.addColorStop(0,'#61798433');luz.addColorStop(1,'#000710bb');c.fillStyle=luz;c.fillRect(x,y,tam,tam);c.strokeStyle='#ab5962';c.lineWidth=2;c.strokeRect(x,y,tam,tam);
    c.save();c.beginPath();c.rect(x,y,tam,tam);c.clip();
    for(let i=-7;i<=7;i++){c.strokeStyle=i%2?'#74374635':'#aa586728';c.lineWidth=1;const a=proyectar(s,i,-7),b=proyectar(s,i,7),d=proyectar(s,-7,i),e=proyectar(s,7,i);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.moveTo(d.x,d.y);c.lineTo(e.x,e.y);c.stroke();}
    for(const r of s.modelo.rayos){const dx=-r.ny,dy=r.nx,a=proyectar(s,r.nx*r.offset+dx*15,r.ny*r.offset+dy*15),b=proyectar(s,r.nx*r.offset-dx*15,r.ny*r.offset-dy*15),aviso=r.edad<r.aviso,activo=r.edad<r.aviso+r.activo;
      if(aviso){const z=r.edad/r.aviso;c.strokeStyle=`rgba(254,130,83,${.11+z*.14})`;c.lineWidth=(r.ancho*2+.65)*q.esc;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([6,6]);c.lineDashOffset=-t*15;c.strokeStyle=`rgba(255,186,104,${.35+.5*z})`;c.lineWidth=2;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);}
      else{c.globalAlpha=activo?1:Math.max(0,1-(r.edad-r.aviso-r.activo)/.25);c.strokeStyle='#f0345c';c.lineWidth=r.ancho*2*q.esc;c.shadowColor='#ff174c';c.shadowBlur=14;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.strokeStyle='#ffdfa9';c.lineWidth=Math.max(2,q.esc*.11);c.stroke();c.shadowBlur=0;c.globalAlpha=1;}
    }
    particulas(s,c);c.restore();
    for(let i=0;i<8;i++){const a=i*TAU/8,r=6.9,p=proyectar(s,Math.cos(a)*r,Math.sin(a)*r);c.save();c.translate(p.x,p.y);c.rotate(a);c.fillStyle='#211322';c.strokeStyle='#a15363';c.lineWidth=1;c.fillRect(-q.esc*.26,-q.esc*.24,q.esc*.52,q.esc*.48);c.strokeRect(-q.esc*.26,-q.esc*.24,q.esc*.52,q.esc*.48);c.fillStyle='#e73960';c.shadowColor='#f93c6d';c.shadowBlur=8;c.fillRect(-q.esc*.13,-q.esc*.06,q.esc*.26,q.esc*.12);c.restore();}
    const p=proyectar(s,s.modelo.jugador.x,s.modelo.jugador.y);jugador(s,c,p.x,p.y,Math.max(19,q.esc*.88));
    const aviso=s.modelo.rayos.some(r=>r.edad<r.aviso);c.textAlign='center';c.fillStyle=aviso?'#f2c797':'#986b7e';c.font='600 10px system-ui';c.fillText(aviso?'FRANJA ÁMBAR: APÁRTATE':'NO TE QUEDES QUIETO',s.ancho/2,Math.max(15,y-11));
  }
  function fps(s,c){
    const w=s.ancho,h=s.alto,p=s.modelo.jugador,t=s.modelo.t,cos=Math.cos(p.a),sin=Math.sin(p.a),horizonte=h*.45+(s.reducido?0:Math.sin(t*8)*s.andando*1.5);
    let g=c.createLinearGradient(0,0,0,horizonte);g.addColorStop(0,'#08060d');g.addColorStop(1,'#27323d');c.fillStyle=g;c.fillRect(0,0,w,horizonte);
    g=c.createLinearGradient(0,horizonte,0,h);g.addColorStop(0,'#26313a');g.addColorStop(1,'#0b0c12');c.fillStyle=g;c.fillRect(0,horizonte,w,h-horizonte);
    c.strokeStyle='#86344736';c.lineWidth=1;for(let i=1;i<13;i++){const y=horizonte+(h-horizonte)/i;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}for(let i=-5;i<=5;i++){c.beginPath();c.moveTo(w/2+i*8,horizonte);c.lineTo(w/2+i*w*.24,h);c.stroke();}
    const paso=w>900?3:2,zbuf=[],cols=Math.ceil(w/paso),factor=.7;
    for(let i=0;i<cols;i++){const cam=(2*(i+.5)/cols-1)*factor,dx=cos-sin*cam,dy=sin+cos*cam,r=M.raycast(s.modelo,p.x,p.y,dx,dy),d=r.d,alto=Math.min(h*5,h*1.2/d),top=horizonte-alto*.53,tono=Math.max(12,85/(1+d*.16))*(r.lado?.74:1);
      zbuf[i]=d;c.fillStyle=`rgb(${Math.round(tono*.65)},${Math.round(tono*.78)},${Math.round(tono)})`;c.fillRect(i*paso,top,paso+1,alto);const tex=r.lado?r.x:r.y;c.globalAlpha=Math.min(.8,1/(1+d*.07));c.drawImage(s.piedra,Math.floor((tex-Math.floor(tex))*191),0,1,192,i*paso,top,paso+1,alto);c.globalAlpha=1;c.fillStyle=`rgba(1,5,12,${Math.min(.85,d*.035)})`;c.fillRect(i*paso,top,paso+1,alto);
      const textura=r.lado?r.x:r.y,u=textura-Math.floor(textura),costura=u<.028||u>.97;c.fillStyle=costura?'#0d0a1088':'#ca3a4523';if(costura)c.fillRect(i*paso,top,paso+1,alto);
      else{for(let f=1;f<5;f++){const yy=top+alto*f/5;c.fillRect(i*paso,yy,paso+1,Math.max(1,alto*.007));}if(Math.abs(u-.5)<.055){c.fillStyle=`rgba(236,46,79,${Math.max(.04,.35-d*.012)})`;c.fillRect(i*paso,top+alto*.34,paso+1,alto*.065);}}
    }
    if(!s.monstruo){s.monstruo=document.createElement('canvas');s.monstruo.width=128;s.monstruo.height=170;}
    const orden=s.modelo.enemigos.map(e=>{const dx=e.x-p.x,dy=e.y-p.y;return{e,z:dx*cos+dy*sin,lado:-dx*sin+dy*cos};}).filter(o=>o.z>.12).sort((a,b)=>b.z-a.z);
    for(const o of orden){const e=o.e,alto=h*.91/o.z,ancho=alto*.76,cx=w/2+(o.lado/o.z)/factor*w/2,top=horizonte-alto*.58;if(cx+ancho/2<0||cx-ancho/2>w)continue;
      const mc=s.monstruo.getContext('2d');mc.clearRect(0,0,128,170);mc.save();mc.globalAlpha=e.aparece>0?Math.max(.15,1-e.aparece/.65):1;criatura(mc,64,151,112,e.fase+t*8,e.dolor);mc.restore();
      for(let xx=Math.max(0,Math.floor((cx-ancho/2)/paso));xx<Math.min(cols,Math.ceil((cx+ancho/2)/paso));xx++){if(o.z>zbuf[xx]+.2)continue;const u=clamp((xx*paso-(cx-ancho/2))/ancho,0,.999);c.drawImage(s.monstruo,u*128,0,Math.min(128-u*128,paso/ancho*128+1),170,xx*paso,top,paso+1,alto);}
    }
    // Señal del perseguidor más cercano fuera del encuadre.
    let cercano=null,dist=99;for(const e of s.modelo.enemigos){const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.aparece<=0&&d<dist){dist=d;cercano=e;}}
    if(cercano&&dist<4.5){const ang=Math.atan2(cercano.y-p.y,cercano.x-p.x)-p.a,a=Math.atan2(Math.sin(ang),Math.cos(ang));if(Math.abs(a)>.65){c.fillStyle='#e75271';c.font='700 30px system-ui';c.textAlign=a<0?'left':'right';c.fillText(a<0?'‹':'›',a<0?12:w-12,h*.54);c.font='9px system-ui';c.fillText('CERCA',a<0?12:w-12,h*.54+15);}}
    const rec=s.modelo.fogonazo>0?7:0,bob=s.reducido?0:Math.sin(t*8)*s.andando*3,gx=w*.55,gy=h+18+rec+bob,tam=Math.min(w*.33,170);c.save();c.translate(gx,gy);c.scale(tam/120,tam/120);
    poligono(c,[{x:-68,y:12},{x:-55,y:-53},{x:-23,y:-76},{x:-5,y:-50},{x:11,y:0}],'#4b3146','#8e5967');poligono(c,[{x:17,y:0},{x:11,y:-73},{x:36,y:-78},{x:63,y:-31},{x:65,y:0}],'#382539','#7e4e62');
    poligono(c,[{x:-19,y:0},{x:-24,y:-112},{x:5,y:-127},{x:31,y:-106},{x:26,y:0}],'#181d28','#7e6a7e');poligono(c,[{x:-24,y:-112},{x:-11,y:-129},{x:5,y:-127},{x:31,y:-106},{x:14,y:-99}],'#4c344a','#b57580');c.fillStyle='#de4764';c.fillRect(-7,-91,6,59);c.fillStyle='#f8c39a';c.fillRect(-3,-125,9,5);
    if(s.modelo.fogonazo>0){c.fillStyle='#ffdf93';c.shadowColor='#ff385b';c.shadowBlur=28;c.beginPath();c.moveTo(-8,-128);c.lineTo(-22,-146);c.lineTo(-3,-141);c.lineTo(2,-169);c.lineTo(10,-142);c.lineTo(25,-154);c.lineTo(14,-128);c.closePath();c.fill();}c.restore();
    c.strokeStyle='#f2cfb9bb';c.lineWidth=1.5;const yy=horizonte;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){c.beginPath();c.moveTo(w/2+dx*5,yy+dy*5);c.lineTo(w/2+dx*11,yy+dy*11);c.stroke();}
    const mm=Math.min(76,w*.19),ox=10,oy=11,cel=mm/16;c.fillStyle='#09070dbb';c.fillRect(ox-3,oy-3,mm+6,mm+6);for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(s.modelo.mapa[y][x]==='1'){c.fillStyle='#814050';c.fillRect(ox+x*cel,oy+y*cel,cel-.4,cel-.4);}}for(const e of s.modelo.enemigos){c.fillStyle='#df4867';c.fillRect(ox+e.x*cel-1,oy+e.y*cel-1,2,2);}c.fillStyle='#f3d1a5';c.beginPath();c.arc(ox+p.x*cel,oy+p.y*cel,2,0,TAU);c.fill();c.strokeStyle='#f3d1a5';c.beginPath();c.moveTo(ox+p.x*cel,oy+p.y*cel);c.lineTo(ox+(p.x+cos)*cel,oy+(p.y+sin)*cel);c.stroke();
  }
  function pintar(s){
    const canvas=s.ui.canvas,rect=s.ui.campo.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(devicePixelRatio||1,1.5);s.ancho=w;s.alto=h;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const c=canvas.getContext('2d');if(!c)return;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    materiales(s);c.save();if(!s.reducido&&s.modelo.impacto>0){const f=s.modelo.impacto*4;c.translate(Math.sin(s.modelo.t*79)*f,Math.cos(s.modelo.t*97)*f);}if(API.pintores?.[s.tipo])API.pintores[s.tipo](s,c);else if(s.tipo==='isometrico')isometrico(s,c);else if(s.tipo==='laseres')laseres(s,c);else fps(s,c);c.restore();atmosfera(s,c);
    const g=c.createRadialGradient(w*.5,h*.45,Math.min(w,h)*.24,w*.5,h*.45,Math.max(w,h)*.72);g.addColorStop(0,'transparent');g.addColorStop(1,s.modelo.impacto>0?'#a71f47a6':'#030408bb');c.fillStyle=g;c.fillRect(0,0,w,h);

    const restantes=Math.max(0,Math.ceil(s.modelo.duracion-s.modelo.t));if(s.ultimoSegundo!==restantes){s.ultimoSegundo=restantes;s.ui.tiempo.textContent=String(restantes).padStart(2,'0');s.ui.tiempo.setAttribute('aria-label',restantes+' segundos restantes');}
    s.ui.progreso.style.transform=`scaleX(${1-s.modelo.t/s.modelo.duracion})`;s.ui.corazones.forEach((c,i)=>c.classList.toggle('off',i>=s.modelo.vidas));s.ui.vidas.setAttribute('aria-label',s.modelo.vidas+' vidas');if(s.tipo==='laseres'){s.ui.derecha.classList.toggle('ppRecargando',s.modelo.recargaImpulso>0);s.ui.derecha.setAttribute('aria-label',s.modelo.recargaImpulso>0?'Impulso recargando':'Impulso listo');}
  }
  function entrada(s,dt){
    const k=s.keys,tecla=c=>k.has(c)?1:0;let mx=s.mov.x+tecla('KeyD')-tecla('KeyA'),my=s.mov.y+tecla('KeyS')-tecla('KeyW'),giro=0;
    if(s.tipo==='fps'){my+=tecla('ArrowDown')-tecla('ArrowUp');giro=(tecla('ArrowRight')+tecla('KeyE')-tecla('ArrowLeft')-tecla('KeyQ'))*2.3+s.aim.x*2.5+s.mirada/Math.max(.001,dt);s.mirada=0;}else{mx+=tecla('ArrowRight')-tecla('ArrowLeft');my+=tecla('ArrowDown')-tecla('ArrowUp');}
    let apuntar=s.apuntar;if(s.tipo==='isometrico'){if(s.fire&&Math.hypot(s.aim.x,s.aim.y)>.25)apuntar=Math.atan2(s.aim.y,s.aim.x);else if(s.fire||k.has('Space'))apuntar=null;}
    s.andando=Math.min(1,Math.hypot(mx,my));return{mx,my,giro,accion:s.fire||s.mouseFire||k.has('Space'),apuntar:typeof apuntar==='number'?apuntar:undefined};
  }
  function efectos(s){
    const eventos=s.modelo.eventos.splice(0);if(eventos.includes('dolor')){global.CAOZ_AUDIO?.play('leader_hit',{volumen:.55});s.ui.lectura.textContent=s.modelo.vidas+' vidas restantes.';}
    else if(eventos.includes('laser'))global.CAOZ_AUDIO?.play('spell_lightning',{volumen:.35});else if(eventos.includes('acierto'))global.CAOZ_AUDIO?.play('attack_hit',{volumen:.35});else if(eventos.includes('disparo'))global.CAOZ_AUDIO?.play('spell_arcane',{volumen:.18});else if(eventos.includes('impulso'))global.CAOZ_AUDIO?.play('attack_wind',{volumen:.3});
  }
  function bucle(s,ahora){
    if(s.cerrada)return;const dt=Math.max(0,(ahora-s.ultimo)/1000);s.ultimo=ahora;
    if(s.fase==='jugando'){
      // No hay pausa: al recuperar un fotograma se simula todo el tiempo
      // transcurrido, incluidos peligros y daño, sin regalar una victoria.
      M.paso(s.modelo,entrada(s,dt),dt);efectos(s);if(s.modelo.terminado){s.fase='resultado';vaciarEntrada(s);if(s.op.cinematica)salidaCinematica(s);else hacerPanel(s,'resultado');global.CAOZ_AUDIO?.play(s.modelo.sobrevivio?'buff':'defeat',{volumen:.4});}
    }
    pintar(s);pintarNube(s);if(s.arteCarta&&s.carta?.isConnected)global.PITAGORAS_CINE?.pintarCarta(s.arteCarta,s.tipo,ahora/1000,s.reducido);s.raf=requestAnimationFrame(t=>bucle(s,t));
  }
  function iniciar(op={}){
    if(actual)resolver(actual,{sobrevivio:false,cancelado:true});
    return new Promise(resolve=>{
      const bytes=new Uint32Array(1);if(global.crypto?.getRandomValues)global.crypto.getRandomValues(bytes);else bytes[0]=Math.floor(Math.random()*4294967296);
      const modelo=M.crear({...op,semilla:Number.isFinite(op.semilla)?op.semilla:bytes[0]}),s={id:++contador,op,modelo,tipo:modelo.tipo,info:API.tipos[modelo.tipo],nombre:String(op.nombre||op.personaje?.nombre||'Viajero').slice(0,24),resolver:resolve,cerrada:false,fase:'intro',keys:new Set(),mov:{x:0,y:0},aim:{x:0,y:0},fire:false,mouseFire:false,mirada:0,apuntar:null,pointers:new Map(),timers:new Set(),limpiar:[],reducido:matchMedia('(prefers-reduced-motion:reduce)').matches,ultimo:performance.now(),andando:0,previo:document.activeElement};
      actual=s;
      try{hacerMiniatura(s);crearUI(s);s.ultimo=performance.now();s.raf=requestAnimationFrame(t=>bucle(s,t));}
      catch(e){console.warn('No se pudo abrir la prueba de Pitágoras:',e);if(s.dialog)resolver(s,{sobrevivio:false,cancelado:true});else{actual=null;resolve({sobrevivio:false,cancelado:true});}}
    });
  }
  API.iniciar=iniciar;API.cancelar=()=>{if(actual)resolver(actual,{sobrevivio:false,cancelado:true});};
  Object.defineProperties(API,{activa:{get:()=>!!actual&&!actual.cerrada},estado:{get:()=>actual?{fase:actual.fase,...M.instantanea(actual.modelo)}:null}});
})(typeof window!=='undefined'?window:globalThis);

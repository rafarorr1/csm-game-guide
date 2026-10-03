/* Alma y Furia: lente QuickLiquid y líquido animado con sus resortes analíticos.
   Dos lienzos pequeños a 30 FPS, gobernados por el reloj del juego (sin otro bucle). */
'use strict';
(function(){
  const limitar=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
  function crearEstado(inicial=0){
    const {Spring}=window.CAOZ_QUICK_LIQUID;
    const nivel=new Spring(limitar(inicial),{stiffness:220,damping:30,restDisplacementThreshold:.0001,restThreshold:.001});
    const balanceo=new Spring(0,{stiffness:65,damping:7,restDisplacementThreshold:.001,restThreshold:.001});
    let objetivo=limitar(inicial),tiempo=0,energia=0,velocidad=0;
    function paso(dt,valor,vx=0,reducido=false){
      dt=limitar(dt,0,.1);tiempo+=dt;valor=limitar(valor);vx=limitar(vx,-18,18);
      // Sólo se cambia el destino cuando cambia el recurso: no reinicia el resorte cada cuadro.
      const diferencia=valor-objetivo;nivel.tick(tiempo*1000);balanceo.tick(tiempo*1000);
      if(diferencia){objetivo=valor;nivel.setTarget(valor);nivel.tick(tiempo*1000);energia=Math.min(1,energia+Math.abs(diferencia)*3);balanceo.addVelocity(diferencia*22);balanceo.tick(tiempo*1000);}
      const aceleracion=vx-velocidad;velocidad=vx;
      if(!reducido&&Math.abs(aceleracion)>.001){balanceo.addVelocity(-aceleracion*.7);balanceo.tick(tiempo*1000);energia=Math.min(1,energia+Math.abs(aceleracion)*.025);}
      energia*=Math.exp(-dt*2.7);
      if(reducido||valor===0||valor===1){nivel.setValue(valor);nivel.setTarget(valor);nivel.tick(tiempo*1000);}
      if(reducido){balanceo.setValue(0);balanceo.setTarget(0);balanceo.tick(tiempo*1000);energia=0;}
      return estado();
    }
    function estado(){return {nivel:limitar(nivel.value),objetivo,tiempo,energia,inclinacion:limitar(balanceo.value,-5,5)};}
    return {paso,estado};
  }
  function crear(alma,furia){
    const movimiento=matchMedia('(prefers-reduced-motion: reduce)'),orbes=[];
    const paletas=[{profundo:'#350916',medio:'#a41e3f',claro:'#ec6270',superficie:'#ffc0b7',bruma:'#ea8492'},
      {profundo:'#47240a',medio:'#c77a16',claro:'#ffca54',superficie:'#fff1b1',bruma:'#f6d991'}];
    for(const [indice,elemento] of [alma,furia].entries()){
      const medidor=elemento.querySelector('.apMedidor'),canvas=document.createElement('canvas'),cristal=document.createElement('div');
      canvas.className='apLiquido';canvas.width=canvas.height=192;canvas.setAttribute('aria-hidden','true');
      const g=canvas.getContext('2d',{alpha:true});if(!g)continue;
      cristal.className='apCristal';cristal.setAttribute('aria-hidden','true');medidor.append(canvas,cristal);
      const lente=new window.CAOZ_QUICK_LIQUID.LiquidGlassEngine(cristal,{material:'clear',borderRadius:999,quality:'low',appearance:'dark',
        refractionStrength:9,bezelWidth:20,thickness:14,ior:1.46,chromaticAberration:0,blur:0,saturation:1.06,tintOpacity:0,
        edgeHighlight:.68,specularStrength:.3,elevation:0,noiseOpacity:0,dynamicLighting:false,cursorTracking:false,hoverLighting:false,parallax:false});
      medidor.classList.add('apLiquidoListo');g.setTransform(1.92,0,0,1.92,0,0);
      const p=paletas[indice],fondo=g.createRadialGradient(39,27,5,50,50,72);fondo.addColorStop(0,'#243039');fondo.addColorStop(.7,'#111b23');fondo.addColorStop(1,'#05090d');
      const cuerpo=g.createLinearGradient(6,0,94,0);cuerpo.addColorStop(0,p.profundo);cuerpo.addColorStop(.35,p.medio);cuerpo.addColorStop(.62,p.claro);cuerpo.addColorStop(1,p.profundo);
      const profundidad=g.createLinearGradient(0,10,0,100);profundidad.addColorStop(0,'#0000');profundidad.addColorStop(.65,'#0000');profundidad.addColorStop(1,'#100b18b3');
      const borde=g.createRadialGradient(50,50,25,50,50,50);borde.addColorStop(0,'#0000');borde.addColorStop(.78,'#0000');borde.addColorStop(1,'#02060bcc');
      const brillo=g.createRadialGradient(28,20,0,28,20,31);brillo.addColorStop(0,'#fff9df2e');brillo.addColorStop(.65,'#fff9df08');brillo.addColorStop(1,'#ffffff00');
      orbes.push({elemento,medidor,canvas,g,lente,p,fondo,cuerpo,profundidad,borde,brillo,estado:crearEstado(indice?0:1),ultimo:null,numero:null,desdeDibujo:1,dibujos:0});
    }
    function dibujar(o,s){
      const {g,p}=o,t=movimiento.matches?0:s.tiempo,n=s.nivel,amplitud=movimiento.matches?0:(.85+s.energia*2.6)*Math.sin(Math.PI*n),y=100*(1-n);
      const superficie=(x,atras=false)=>y+s.inclinacion*(x-50)/50+amplitud*(Math.sin(x*.073+t*2.5)*.72+Math.sin(x*.145-t*3.1)*.28)+(atras?-2:1)*Math.sin(Math.PI*n);
      const trazar=atras=>{g.beginPath();g.moveTo(-3,superficie(-3,atras));for(let x=0;x<=103;x+=3)g.lineTo(x,superficie(x,atras));};
      g.clearRect(0,0,100,100);g.save();g.beginPath();g.arc(50,50,50,0,Math.PI*2);g.clip();g.fillStyle=o.fondo;g.fillRect(0,0,100,100);
      if(n>.00001){
        trazar(true);g.lineTo(103,103);g.lineTo(-3,103);g.closePath();g.fillStyle=p.claro;g.globalAlpha=.72;g.fill();g.globalAlpha=1;
        trazar(false);g.lineTo(103,103);g.lineTo(-3,103);g.closePath();g.fillStyle=o.cuerpo;g.fill();g.save();g.clip();
        // Corrientes suaves bajo la superficie y burbujas pequeñas; ningún brillo tapa las cifras.
        for(let i=0;i<3;i++){const fase=t*.55+i*2.1;g.beginPath();g.ellipse(50+Math.sin(fase)*20,76+Math.cos(fase*.7)*11,30,6,Math.sin(fase)*.5,0,Math.PI*2);g.strokeStyle=p.bruma;g.globalAlpha=.1;g.lineWidth=1.4;g.stroke();}
        for(let i=0;i<5;i++){const k=(t*(.095+i*.009)+i*.193)%1,x=20+((i*19)%64)+Math.sin(t+i)*1.8,alto=Math.max(2,96-y),by=97-k*alto;
          g.beginPath();g.arc(x,by,.55+(i%3)*.3,0,Math.PI*2);g.strokeStyle=p.superficie;g.lineWidth=.45;g.globalAlpha=.22*Math.sin(k*Math.PI);g.stroke();}
        g.globalAlpha=1;g.fillStyle=o.profundidad;g.fillRect(0,0,100,100);g.restore();
        if(n<.995){trazar(false);g.strokeStyle=p.superficie;g.globalAlpha=.58;g.lineWidth=.8;g.stroke();g.globalAlpha=1;}
      }
      g.fillStyle=o.borde;g.fillRect(0,0,100,100);g.fillStyle=o.brillo;g.fillRect(0,0,100,100);g.restore();o.dibujos++;
    }
    function paso(dt,{alma:vida,almaMax,furia:ira,vx=0,vz=0}){
      for(let i=0;i<orbes.length;i++){
        const o=orbes[i],max=i?100:Math.max(1,almaMax||1),valor=limitar(i?ira:vida,0,max),porcentaje=valor/max;
        const s=o.estado.paso(dt,porcentaje,vx+vz*.28,movimiento.matches);o.desdeDibujo+=dt;
        // Valores exactos para accesibilidad; el líquido interpola sin alterar los números del HUD.
        const numero=String(i?Math.floor(valor):Math.ceil(valor)),clave=numero+'/'+max;
        if(clave!==o.numero){o.numero=clave;o.elemento.setAttribute('role','meter');o.elemento.setAttribute('aria-valuemin','0');o.elemento.setAttribute('aria-valuemax',String(max));o.elemento.setAttribute('aria-valuenow',numero);o.elemento.setAttribute('aria-valuetext',numero+' de '+max);}
        if(o.ultimo===null||o.desdeDibujo>=1/30-1e-6&&(!movimiento.matches||o.ultimo!==porcentaje)){
          dibujar(o,s);o.desdeDibujo=0;o.ultimo=porcentaje;
        }
      }
    }
    return {paso,estado:()=>orbes.map(o=>({...o.estado.estado(),dibujos:o.dibujos,lente:o.lente.getPerformanceMetrics()})),
      destruir(){for(const o of orbes){o.lente.destroy();o.canvas.remove();o.medidor.querySelector('.apCristal')?.remove();o.medidor.classList.remove('apLiquidoListo');}}};
  }
  // Cristal en el panel y las siete habilidades. Los botones nativos y sus rótulos no se envuelven.
  function crearHabilidades(barra){
    const lentes=[],elementos=[];
    const montar=(padre,clase,opciones)=>{
      const cristal=document.createElement('div');cristal.className=clase;cristal.setAttribute('aria-hidden','true');padre.prepend(cristal);
      lentes.push(new window.CAOZ_QUICK_LIQUID.LiquidGlassEngine(cristal,{material:'clear',quality:'low',appearance:'dark',ior:1.46,
        blur:0,chromaticAberration:0,saturation:1.03,tint:'9, 19, 25',tintOpacity:.22,edgeHighlight:.48,specularStrength:.24,
        elevation:0,noiseOpacity:0,dynamicLighting:false,cursorTracking:false,hoverLighting:false,parallax:false,...opciones}));elementos.push(cristal);
    };
    montar(barra,'apCristalBarra',{borderRadius:12,refractionStrength:6,bezelWidth:12,thickness:9,tintOpacity:.3});
    for(const boton of barra.querySelectorAll('button[data-hab]'))montar(boton,'apCristalHabilidad',{borderRadius:8,refractionStrength:5,bezelWidth:10,thickness:8});
    barra.classList.add('apHabilidadesCristal');
    return {estado:()=>lentes.map(l=>l.getPerformanceMetrics()),destruir(){for(const l of lentes)l.destroy();for(const e of elementos)e.remove();barra.classList.remove('apHabilidadesCristal');}};
  }
  window.CAOZ_ARPG_ORBES=Object.freeze({crear,crearEstado,crearHabilidades});
})();

/* Animación procedural de Adreida: poses, hacha a dos manos y transiciones.
   No conoce controles, daño, enfriamientos ni enemigos. El combate entrega anim/estado/k/dt.
   La mezcla termina antes del barrido; el instante del impacto pertenece al combate. */
'use strict';
(function(){
  const TAU=Math.PI*2, suave=k=>k<=0?0:k>=1?1:k*k*(3-2*k),tramo=(k,a,b)=>suave((k-a)/(b-a));
  // INICIO MOVIMIENTO QUATERNIUS — generado por adreida-scenario/preparar-movimiento.mjs; CC0.
  const movimientoCorporal={"muestras":32,"campos":["caderaX","caderaY","caderaZ","pechoX","pechoY","pechoZ","cabezaX","cabezaY","cabezaZ","lateral","vertical"],"caminar":{"nombre":"Walk_Loop","duracion":1.3333333730697632,"inicio":0,"datos":[0.000005,0.034902,-0.043015,-0.024711,0.097204,-0.093419,-0.024787,0.034831,-0.003671,-0.022451,-0.020818,0.000005,0.034241,-0.041945,-0.017855,0.110106,-0.09665,-0.021206,0.03402,-0.004395,-0.016568,-0.025204,0.000005,0.03253,-0.039197,-0.007529,0.114221,-0.095265,-0.013155,0.032188,-0.004905,-0.010163,-0.025591,0.000005,0.029889,-0.034998,0.004396,0.110665,-0.089464,-0.003044,0.029446,-0.005192,-0.003568,-0.02187,0.000006,0.026439,-0.029572,0.016114,0.100885,-0.079525,0.006718,0.025919,-0.005235,0.003045,-0.014988,0.000004,0.022204,-0.023017,0.025235,0.086858,-0.065758,0.012857,0.021621,-0.005041,0.009505,-0.005889,-0.000004,0.017378,-0.015688,0.030138,0.071595,-0.0497,0.014237,0.016746,-0.004687,0.015683,0.003849,0,0.012229,-0.007972,0.029577,0.055816,-0.032268,0.013063,0.011505,-0.004451,0.021439,0.013119,-0.000023,0.006706,-0.000041,0.02411,0.039506,-0.014116,0.010774,0.005878,-0.004231,0.026604,0.020816,-0.000019,0.00109,0.007943,0.014759,0.02284,0.004022,0.007639,0.000218,-0.003861,0.030787,0.025202,-0.000004,-0.004511,0.015659,0.003595,0.005896,0.021479,0.00362,-0.005449,-0.003421,0.033767,0.025587,0,-0.010091,0.022971,-0.008024,-0.011311,0.037803,-0.000688,-0.010997,-0.002778,0.035221,0.021866,0.000006,-0.015448,0.029575,-0.018806,-0.028427,0.052579,-0.005217,-0.016237,-0.001804,0.035201,0.014984,0.000004,-0.020369,0.035001,-0.02692,-0.044915,0.06517,-0.009756,-0.02097,-0.000525,0.033655,0.005887,0.000005,-0.024792,0.0392,-0.031205,-0.060368,0.075663,-0.01406,-0.02519,0.000788,0.030935,-0.003846,0.000005,-0.028595,0.041948,-0.030546,-0.074253,0.083906,-0.017931,-0.02879,0.002073,0.027157,-0.013112,0.000006,-0.031657,0.043018,-0.025081,-0.086094,0.089635,-0.021172,-0.031655,0.003283,0.022437,-0.020806,0.000006,-0.033696,0.041948,-0.015646,-0.094884,0.091911,-0.02341,-0.033507,0.004363,0.016795,-0.025192,0.000006,-0.034719,0.0392,-0.004361,-0.100035,0.09094,-0.02456,-0.034359,0.005288,0.010578,-0.02558,0.000005,-0.034389,0.035001,0.007373,-0.100303,0.08633,-0.022136,-0.033867,0.006049,0.003985,-0.021861,0.000006,-0.032239,0.029575,0.018216,-0.095864,0.078101,-0.012162,-0.031554,0.006622,-0.002786,-0.01498,0.000004,-0.028148,0.023019,0.02629,-0.087495,0.066266,0.003649,-0.027315,0.00678,-0.009487,-0.005882,0.000002,-0.022739,0.015756,0.030529,-0.076719,0.051885,0.02001,-0.021834,0.006364,-0.015887,0.003853,0.000002,-0.016306,0.008008,0.029941,-0.064006,0.03552,0.033029,-0.015475,0.005219,-0.021774,0.013121,-0.000033,-0.008949,0.000044,0.024834,-0.049373,0.017845,0.038774,-0.008444,0.003033,-0.026937,0.020816,-0.000027,-0.001436,-0.00794,0.016117,-0.033234,-0.000307,0.035769,-0.001169,0.0012,-0.030975,0.0252,0.000001,0.006106,-0.015753,0.005714,-0.015789,-0.01832,0.028592,0.006961,0.002675,-0.033804,0.025583,0.000003,0.013498,-0.023017,-0.005105,0.002828,-0.035349,0.018551,0.014492,0.002458,-0.035238,0.02186,0.000006,0.020337,-0.029572,-0.015122,0.022167,-0.051067,0.006993,0.021167,0.001205,-0.035243,0.014976,0.000004,0.026131,-0.034998,-0.022631,0.041772,-0.064859,-0.004576,0.026746,-0.000036,-0.033712,0.005878,0.000004,0.030689,-0.039197,-0.026542,0.06107,-0.076679,-0.014617,0.031137,-0.000997,-0.030994,-0.003857,0.000005,0.033712,-0.041945,-0.026853,0.079642,-0.08631,-0.021798,0.033938,-0.002171,-0.027203,-0.013123]},"correr":{"nombre":"Sprint_Loop","duracion":0.6666666865348816,"inicio":0.85,"datos":[0.000003,0,0.065649,0.005077,0.483362,-0.078133,-0.037909,0.000011,-0.000036,0.012818,0.059206,0.000003,0,0.076141,0.015966,0.499064,-0.086667,-0.037918,0.000011,-0.000042,0.014863,0.05373,0.000003,0,0.084986,0.02507,0.510713,-0.093641,-0.03791,0.000011,-0.000036,0.016587,0.045482,0.000003,0,0.091363,0.031187,0.516353,-0.098003,-0.037909,0.000011,-0.000036,0.017829,0.033077,0.000003,0,0.094359,0.033883,0.518085,-0.099792,-0.037909,0.000011,-0.000036,0.018412,0.013041,0.000003,0,0.094114,0.028125,0.509887,-0.096943,-0.031185,0.000041,-0.000185,0.018364,-0.010402,0.000003,0,0.084286,-0.006896,0.465581,-0.079322,0.002486,0.000052,-0.000295,0.01645,-0.039842,0.000003,0,0.069339,-0.046318,0.380422,-0.062358,0.036215,0.000194,-0.000913,0.013536,-0.061039,0.000003,0,0.05098,-0.086341,0.26786,-0.048807,0.069863,0.000012,-0.000036,0.009956,-0.07674,-0.00002,0,0.036199,-0.078633,0.123854,-0.047185,0.063113,-0.000023,0.000157,0.00707,-0.070182,-0.000025,0,0.020373,-0.057103,-0.016959,-0.039288,0.05204,-0.000079,0.000562,0.00398,-0.057138,-0.000002,0,0.002978,-0.013044,-0.152488,-0.019849,0.035292,-0.000052,0.00031,0.000582,-0.034366,0.000003,0,-0.020952,0.038576,-0.257771,0.012826,0.015816,-0.000083,0.000641,-0.004092,-0.000598,0.000003,0,-0.045085,0.09132,-0.347798,0.050634,-0.003354,-0.000008,0.000101,-0.008804,0.032703,0.000003,0,-0.063493,0.12702,-0.412006,0.083722,-0.020091,-0.000026,0.000196,-0.012396,0.053139,0.000003,0,-0.074549,0.142034,-0.463063,0.106061,-0.030901,0.000004,-0.000008,-0.014553,0.060581,0.000003,0,-0.080702,0.142237,-0.505875,0.120165,-0.037909,0.000012,-0.000036,-0.015752,0.059362,0.000003,0,-0.083862,0.11728,-0.533133,0.115975,-0.037888,0.00002,-0.000072,-0.016368,0.053807,0.000003,0,-0.086223,0.087372,-0.555449,0.107091,-0.0379,0.000015,-0.00005,-0.016828,0.045484,0.000003,0,-0.087387,0.05014,-0.570144,0.09148,-0.037904,0.000013,-0.000044,-0.017055,0.033009,0.000003,0,-0.087753,0.015616,-0.577607,0.07505,-0.037908,0.000012,-0.000037,-0.017126,0.012936,0.000003,0,-0.084222,-0.018272,-0.567617,0.059141,-0.031176,-0.000057,0.000192,-0.016437,-0.010545,0.000003,0,-0.065899,-0.050631,-0.495971,0.048243,0.002509,-0.000095,0.000359,-0.012865,-0.040054,0.000003,0,-0.047938,-0.076045,-0.370298,0.042909,0.036519,-0.000283,0.00098,-0.009361,-0.061239,0.000003,0,-0.030216,-0.096627,-0.208695,0.042818,0.069862,0.000011,-0.000036,-0.005902,-0.076875,-0.000003,0,-0.020336,-0.098132,-0.048525,0.03417,0.063146,0.000056,-0.000249,-0.003972,-0.070259,-0.000004,0,-0.010931,-0.093795,0.091909,0.021899,0.051995,0.000047,-0.000349,-0.002135,-0.05717,0.000002,0,-0.002239,-0.080855,0.202561,0.002624,0.035276,0.000036,-0.000218,-0.000437,-0.034371,-0.000007,0,0.009518,-0.064289,0.287634,-0.015596,0.015945,0.000057,-0.000385,0.00186,-0.000647,-0.000014,0,0.022503,-0.045718,0.360867,-0.033969,-0.003331,0.000022,-0.000122,0.004396,0.032588,-0.000002,0,0.037337,-0.027508,0.412906,-0.050358,-0.02005,0.000031,-0.000183,0.007292,0.052941,0.000003,0,0.051662,-0.010696,0.452339,-0.064894,-0.030927,0.000017,-0.000092,0.010089,0.060379]}};
  // FIN MOVIMIENTO QUATERNIUS
  const limites=Object.freeze({caminar:[0,.3],carga:[0,.18],regreso:[0,.4],zancada:[.75,1.15]});
  const predeterminados=Object.freeze({caminar:.12,carga:.10,regreso:.18,zancada:1});
  function validar(p){
    if(!p||p.version!==1||p.personaje!=='adreida'||!p.ajustes||typeof p.ajustes!=='object')throw Error('Formato de animación inválido (Adreida, versión 1).');
    if(Object.keys(p.ajustes).some(k=>!Object.hasOwn(limites,k)))throw Error('El archivo contiene ajustes desconocidos.');
    const resultado={};
    for(const [k,[min,max]] of Object.entries(limites)){const v=p.ajustes[k];if(!Number.isFinite(v)||v<min||v>max)throw Error(`Ajuste inválido: ${k} (${min}–${max}).`);resultado[k]=v;}
    return resultado;
  }
  function fabrica(THREE){
    let ajustes={...predeterminados};
    const estados=new WeakMap();
    const configuracion=()=>({version:1,personaje:'adreida',ajustes:{...ajustes}});
    function configurar(p){const nuevos=validar(p);ajustes=nuevos;return configuracion();}
    /* ---- El hacha de Adreida: una mano al desplazarse, dos en combate -------------------------
       Cada pose dice dónde está la empuñadura (G, la mano derecha) y hacia dónde apunta el hacha (A),
       en el espacio del torso; los dos brazos llegan con cinemática inversa de dos huesos: la derecha
       a G, junto al pomo, y la izquierda 30 cm hacia la cabeza del hacha. La mano derecha se orienta para
       que el hacha (su -Y) siga A, con la cara plana hacia «arriba» (en los tajos horizontales, al
       cielo: se ve desde la cámara; en el hachazo vertical, de lado: el filo corta de arriba abajo). */
    const _v=Array.from({length:10},()=>new THREE.Vector3()),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
    const normalIK=new THREE.Vector3(),yIK=new THREE.Vector3(),zIK=new THREE.Vector3(),baseIK=new THREE.Matrix4();
    function apuntarHueso(b,dir){
      // Una dirección sola deja indeterminado el giro cuando el antebrazo apunta hacia arriba.
      // El plano del codo fija también la torsión: no hay un salto de 180° al recoger el arma.
      b.parent.getWorldQuaternion(_q).invert();yIK.copy(dir).normalize().negate();zIK.crossVectors(normalIK,yIK).normalize();
      b.quaternion.setFromRotationMatrix(baseIK.makeBasis(normalIK,yIK,zIK)).premultiply(_q);b.updateMatrixWorld(true);
    }
    function ik(brazo,ante,mano,T,polo,signo=1){const S=brazo.getWorldPosition(_v[0]),a=ante.position.length(),b=mano.position.length(),D=_v[1].copy(T).sub(S);
      const d=Math.min(a+b-1e-3,Math.max(Math.abs(a-b)+1e-3,D.length())),dir=D.normalize(),x=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-x*x));
      const p=_v[2].copy(polo).sub(S);p.addScaledVector(dir,-p.dot(dir));if(p.lengthSq()<1e-8)p.set(0,-1,0);p.normalize();normalIK.crossVectors(dir,p).normalize().multiplyScalar(signo);
      const E=_v[3].copy(S).addScaledVector(dir,x).addScaledVector(p,h);apuntarHueso(brazo,_v[4].copy(E).sub(S));apuntarHueso(ante,_v[5].copy(S).addScaledVector(dir,d).sub(E));}
    const dirA=(f,e)=>[Math.sin(f)*Math.cos(e),Math.sin(e),Math.cos(f)*Math.cos(e)];
    // Ciclo por distancia, apoyo lineal y recuperación con tangentes continuas.
    // Referencia de diseño: LimbSolver / SwingTwist de Ossos (véase README).
    // Implementación local: no requiere importar el motor de animación.
    const correr=paso=>suave(((paso??1)-.3)/.6);
    const longitudZancada=paso=>{const p=Math.max(0,Math.min(1,paso??1));return (1.35+1.3*correr(p))*Math.max(.15,suave(p/.24))*ajustes.zancada;};
    const ejePie=new THREE.Vector3(1,0,0),giroPie=new THREE.Quaternion(),orientacionPie=new THREE.Quaternion();
    const cuerpoMuestra=new Float64Array(11),eulerCuerpo=new THREE.Euler(),pechoMundo=new THREE.Quaternion(),cabezaMundo=new THREE.Quaternion();
    function muestrearCuerpo(fase,carrera){
      const n=movimientoCorporal.muestras,f=((fase/TAU)%1+1)%1*n,i=Math.floor(f),u=f-i;
      // Interpolación periódica: la velocidad del torso no salta entre muestras ni al cerrar el ciclo.
      const curva=(datos,c)=>{const a=datos[((i+n-1)%n)*11+c],b=datos[i*11+c],d=datos[((i+1)%n)*11+c],e=datos[((i+2)%n)*11+c];
        return .5*((2*b)+(-a+d)*u+(2*a-5*b+4*d-e)*u*u+(-a+3*b-3*d+e)*u*u*u);};
      for(let c=0;c<11;c++){const lento=curva(movimientoCorporal.caminar.datos,c);cuerpoMuestra[c]=lento+(curva(movimientoCorporal.correr.datos,c)-lento)*carrera;}
      return cuerpoMuestra;
    }
    function marcha(m,a){
      const H=m.H,amp=suave(Math.max(0,Math.min(1,a.paso??1))/.24),run=correr(a.paso),fase=a.fase||0;
      const ciclo=((fase/TAU)%1+1)%1,contacto=.60-.20*run,largo=longitudZancada(a.paso),medio=largo*contacto*.5;
      const giro=a.giroCarrera||0,b=muestrearCuerpo(fase,run);
      // La zancada larga del inspector requiere un poco más de flexión para alcanzar el apoyo.
      H.cuerpo.position.set(b[9]*.60*amp,-.025*(1-amp)+(-.10-.09*run+b[10]*.45-.08*Math.max(0,ajustes.zancada-1))*amp,0);
      H.cadera.rotation.set((.015+b[0]*.5)*amp,(b[1]*.7-b[4]*.25*run)*amp,b[2]*.55*amp-giro*.18);
      // El clip define pecho y cabeza en el espacio del personaje. Convertir al padre
      // evita que el contragiro de cadera anule el movimiento de hombros y torso.
      pechoMundo.setFromEuler(eulerCuerpo.set(.10+(.025+.09*run+b[3]*.6)*amp,b[4]*.65*amp,b[5]*.6*amp+giro*.45));
      H.torso.quaternion.copy(H.cadera.quaternion).invert().multiply(pechoMundo);
      cabezaMundo.setFromEuler(eulerCuerpo.set(.07+(.02*run+b[6]*.45)*amp,(b[7]*.65+b[4]*.08)*amp,b[8]*.5*amp+giro*.2));
      H.cabeza.quaternion.copy(pechoMundo).invert().multiply(cabezaMundo);
      H.raiz.updateMatrixWorld(true);
      for(const [lado,desfase,signo]of [['I',0,1],['D',.5,-1]]){
        const f=(ciclo+desfase)%1,apoyo=f<contacto,u=apoyo?f/contacto:(f-contacto)/(1-contacto);
        // Durante el apoyo, dz/df = -largo: cancela exactamente el avance del cuerpo.
        const tangente=-largo*(1-contacto),z=apoyo?medio-largo*f:-medio+2*medio*suave(u)+tangente*(2*u*u*u-3*u*u+u);
        const levanta=apoyo?0:Math.sin(Math.PI*u)**2*(.13+.15*run)*amp;
        const inclina=apoyo?(-.10*(1-tramo(u,0,.18))+.30*tramo(u,.70,1))*amp:(.10+.20*Math.cos(Math.PI*u))*amp;
        const altura=.086+levanta+.10*Math.max(0,Math.sin(inclina));
        const objetivo=_v[6].set(signo*.115,altura,z).applyMatrix4(H.raiz.matrixWorld);
        const polo=_v[7].set(signo*.115,.5,1).applyMatrix4(H.raiz.matrixWorld);
        ik(H['pierna'+lado],H['rodilla'+lado],H['pie'+lado],objetivo,polo,-1);
        H.raiz.getWorldQuaternion(orientacionPie);H['pie'+lado].parent.getWorldQuaternion(_q).invert();
        H['pie'+lado].quaternion.copy(_q).multiply(orientacionPie).multiply(giroPie.setFromAxisAngle(ejePie,inclina));
        H['pie'+lado].updateMatrixWorld(true);
      }
    }
    const _agarre=Array.from({length:8},()=>new THREE.Vector3()),_orientacion=new THREE.Quaternion(),qLibre=new THREE.Quaternion(),eLibre=new THREE.Euler();
    function empunar(m,{G,A,arriba,soltarIzquierda=0,brazoLibre=[0,0,.18,-.4]}){const H=m.H;H.raiz.updateMatrixWorld(true);const T=H.torso.matrixWorld;
      const g=_v[6].fromArray(G).applyMatrix4(T),a=_v[7].fromArray(A).transformDirection(T),up=_v[8].fromArray(arriba||[0,1,0]).transformDirection(T);
      // Sólo las manos que sujetan el arma limitan su alcance.
      const separacion=.3,sd=H.brazoD.getWorldPosition(_agarre[0]),si=H.brazoI.getWorldPosition(_agarre[1]).addScaledVector(a,-separacion);
      const alcance=m.p.brazo+m.p.antebrazo-.015;
      for(let i=0;i<8;i++)for(let j=0;j<2;j++){const peso=j?1-soltarIzquierda:1;if(!peso)continue;const centro=j?si:sd,delta=_agarre[2].copy(g).sub(centro),d=delta.length();if(d>alcance)g.addScaledVector(delta,(alcance/d-1)*peso);}
      ik(H.brazoD,H.anteD,H.manoD,g,_agarre[3].set(-.7,-.5,-.35).applyMatrix4(T));
      // La mano derecha: -Y por el mango, X (la cara del hacha) lo más cerca posible de «arriba».
      const y=_agarre[4].copy(a).negate(),x=_agarre[5].copy(up).addScaledVector(y,-up.dot(y));if(x.lengthSq()<1e-6)x.set(1,0,0);x.normalize();const z=_agarre[6].crossVectors(x,y);
      H.manoD.parent.getWorldQuaternion(_q).invert();H.manoD.quaternion.setFromRotationMatrix(_m.makeBasis(x,y,z)).premultiply(_q);H.manoD.updateMatrixWorld(true);
      if(soltarIzquierda<1){
        // La izquierda se incorpora al mango para atacar y protegerse.
        const apoyo=H.manoD.localToWorld(_agarre[7].set(0,-separacion,0));
        ik(H.brazoI,H.anteI,H.manoI,apoyo,_agarre[3].set(.7,-.15,.8).applyMatrix4(T));
        const orientacion=H.manoD.getWorldQuaternion(_orientacion);
        H.manoI.parent.getWorldQuaternion(_q).invert();H.manoI.quaternion.copy(_q).multiply(orientacion);
      }
      if(soltarIzquierda>0){
        // El brazo libre contrapesa la pierna izquierda. Mezclar también el codo y
        // la muñeca permite volver al agarre de combate sin un salto de pose.
        H.brazoI.quaternion.slerp(qLibre.setFromEuler(eLibre.set(brazoLibre[0],brazoLibre[1],brazoLibre[2])),soltarIzquierda);
        H.anteI.quaternion.slerp(qLibre.setFromEuler(eLibre.set(brazoLibre[3],0,0)),soltarIzquierda);
        H.manoI.quaternion.slerp(qLibre.setFromEuler(eLibre.set(0,0,m.modeloAdreida==='scenario'?Math.PI/2-.31:0)),soltarIzquierda);
      }
      H.brazoI.updateMatrixWorld(true);
    }
    const ejeDesde=new THREE.Vector3(),ejeHasta=new THREE.Vector3(),giroAgarre=new THREE.Quaternion(),giroParcial=new THREE.Quaternion();
    function mezclarAgarre(dest,p,q,w,arco=0){
      ejeDesde.fromArray(p.A).normalize();ejeHasta.fromArray(q.A).normalize();giroAgarre.setFromUnitVectors(ejeDesde,ejeHasta);
      const amplitud=Math.min(1,giroAgarre.angleTo(giroParcial.identity())/1.4);
      giroParcial.slerp(giroAgarre,w);ejeDesde.applyQuaternion(giroParcial);
      for(const campo of ['G','arriba'])for(let i=0;i<3;i++)dest[campo][i]=p[campo][i]+(q[campo][i]-p[campo][i])*w;
      ejeDesde.toArray(dest.A);
      // El mango rodea el cuerpo por delante; el apoyo izquierdo no cruza el hombro.
      dest.G[2]+=arco*Math.sin(Math.PI*w)*amplitud;
      return dest;
    }
    // Dónde lleva el hacha en cada animación (espacio del torso: +Z delante, +X su izquierda, -X su derecha).
    function agarreAdreida(a){const k=a.k||0,t=a.t||0;
      // El mango descansa sobre el hombro derecho; la cabeza queda detrás y las manos delante del pecho.
      const reposo=()=>({G:[0,.35+Math.sin(t*2.2)*.004,.48],A:dirA(-2.73,.46),arriba:[0,1,0]});
      const horizontal=(f,e)=>{const r=.42-.08*Math.abs(Math.sin(f));return {G:[Math.sin(f)*r,.28,Math.cos(f)*r],A:dirA(f,e),arriba:[0,1,0]};};
      const mezcla=(p,q,w)=>({G:p.G.map((v,i)=>v+(q.G[i]-v)*w),A:(()=>{const v=p.A.map((x,i)=>x+(q.A[i]-x)*w),l=Math.hypot(...v)||1;return v.map(x=>x/l);})(),arriba:q.arriba||p.arriba});
      const vertical=al=>({G:[-.04,.35+Math.sin(al)*.38,.05+Math.cos(al)*.38],A:[-.08,Math.sin(al),Math.cos(al)],arriba:[1,0,0]});
      switch(a.anim){
        case 'andar':{const f=a.fase||0,p=Math.max(0,Math.min(1,a.paso??1)),r=correr(p),balanceo=Math.cos(f-.12);
          // Una mano sujeta el mango delante del hombro derecho; la cabeza del
          // hacha descansa detrás. El brazo izquierdo bombea al lado del cuerpo.
          return {G:[-.29+Math.sin(f-.4)*.012*p,.20+Math.sin(f*2-.9)*.012*p,.34+Math.sin(f-.3)*.02*p],
            A:dirA(-3.03+Math.sin(f-.5)*.035*p,.55+Math.sin(f*2-1.1)*.025*p),arriba:[0,1,0],soltarIzquierda:1,
            brazoLibre:[-.08+balanceo*(.30+.25*r)*p,-.05*Math.sin(f)*p,.22+Math.sin(f)*.025*p,-.35-.65*r-.08*balanceo*p]};}
        case 'tajoA':case 'revesA':{const r=a.anim==='revesA',s=r?-1:1,car=tramo(k,0,.4),gol=tramo(k,.4,.62),rec=tramo(k,.66,1);
          const f=(-1.3*car+2.4*gol)*s,e=-.25;return mezclarAgarre({G:[],A:[],arriba:[]},mezcla(reposo(),horizontal(f,e),Math.max(car,gol)),reposo(),rec,.24);}
        case 'estocadaA':{const car=tramo(k,0,.38),emp=tramo(k,.38,.48),rec=tramo(k,.66,1);return mezcla(mezcla(reposo(),vertical(-.8+2.8*car-2.3*emp),Math.min(1,car*1.5)),reposo(),rec);}
        case 'lanzarHachaA':{const carga=tramo(k,0,.32),suelta=tramo(k,.32,.45);return mezcla(mezcla(reposo(),horizontal(-1.4,.22),carga),horizontal(.12,.12),suelta);}
        case 'recogerHachaA':return mezclarAgarre({G:[],A:[],arriba:[]},{G:[-.15,.25,.4],A:dirA(.12,.12),arriba:[0,1,0]},reposo(),suave(k),.16);
        case 'torbellino':return horizontal(-1.25,-.12);
        // Parry: el hacha en guardia diagonal delante del pecho (la cabeza sobre el hombro derecho), la cara plana hacia el golpe.
        case 'parry':{const e=tramo(k,0,.15)*(1-tramo(k,.8,1));const A=[-.55,.82,.14],l=Math.hypot(...A);return mezcla(reposo(),{G:[.16,.16,.38],A:A.map(x=>x/l),arriba:[0,0,1]},e);}
        case 'salto':{const arr=tramo(k,.12,.3)*(1-tramo(k,.75,.9)),cae=tramo(k,.75,.9);return mezcla(reposo(),vertical(2.1*arr-.7*cae),Math.max(arr,cae));}
        default:return reposo();}}

    function posar(m,a){
      const H=m.H,k=a.k||0,respira=Math.sin((a.t||0)*2.2);
      switch(a.anim){
        case 'quieto':H.torso.rotation.x=.1+respira*.012;H.rodillaI.rotation.x=H.rodillaD.rotation.x=.12;H.cuerpo.position.y=-.025+respira*.006;break;
        case 'andar':marcha(m,a);break;
        // Los hachazos de Adreida: el brazo casi horizontal barre un arco delante (el hacha lo prolonga).
        // brazoD.z lo levanta hacia su derecha y brazoD.y lo barre en horizontal: -.5 detrás a la derecha, 1.57 delante, 2.5 a la izquierda.
        case 'tajoA':case 'revesA':{const r=a.anim==='revesA',car=tramo(k,0,.4),gol=tramo(k,.4,.62),rec=tramo(k,.66,1),de=r?2.4:-.55,a2=r?-.45:2.35;
          const barre=de+(a2-de)*gol,alto=1-rec;
          H.brazoD.rotation.z=-.3-.95*Math.max(car,gol)*alto;H.brazoD.rotation.y=(barre*(car>0?1:0))*alto+(r?.2:-.2)*(1-car)*alto;H.brazoD.rotation.x=-.25*rec-.15*(1-car)*alto;
          H.anteD.rotation.x=-.75*(1-car)*alto-.45*car*(1-gol)*alto-.08*gol*alto-.7*rec;
          const giro=(r?.55:-.55)*car*(1-gol)+(r?-.5:.5)*gol*alto;H.torso.rotation.y=giro;H.cadera.rotation.y=giro*.4;H.torso.rotation.x=.08+.1*gol*alto;
          H.brazoI.rotation.z=.18+.5*gol*alto;H.brazoI.rotation.x=(r?-.5:.4)*gol*alto;
          H.piernaI.rotation.x=-.35*gol*alto;H.rodillaI.rotation.x=.35*gol*alto+.05;H.piernaD.rotation.x=.3*gol*alto;H.rodillaD.rotation.x=.15;H.cuerpo.position.y=-.06*gol*alto;break;}
        case 'lanzarHachaA':{const carga=tramo(k,0,.32),suelta=tramo(k,.32,.55),rec=1-tramo(k,.65,1);H.torso.rotation.y=(-.5*carga+.8*suelta)*rec;H.torso.rotation.x=.1+.18*suelta*rec;H.cadera.rotation.y=H.torso.rotation.y*.4;H.rodillaI.rotation.x=.18+.2*carga*rec;H.rodillaD.rotation.x=.15;break;}
        case 'recogerHachaA':H.torso.rotation.x=.1;H.rodillaI.rotation.x=H.rodillaD.rotation.x=.12;break;
        case 'estocadaA':{const car=tramo(k,0,.42),emp=tramo(k,.42,.56),rec=tramo(k,.68,1),e2=emp*(1-rec),c2=car*(1-emp);
          const alto=1-rec;H.brazoD.rotation.z=-(.3+1.2*car)*alto-.3*rec;H.brazoD.rotation.y=(.5*car+1.07*emp)*alto;H.brazoD.rotation.x=-.3*rec;
          H.anteD.rotation.x=(-.75*(1-car)-1.5*car*(1-emp)-.02*emp)*alto-.75*rec;H.torso.rotation.y=-.6*c2+.35*e2;H.torso.rotation.x=.05+.3*e2;H.cadera.rotation.y=-.25*c2+.15*e2;
          H.brazoI.rotation.x=.6*e2-.3*c2;H.brazoI.rotation.z=.18+.35*e2;
          H.piernaI.rotation.x=-.95*e2-.15*c2;H.rodillaI.rotation.x=.75*e2+.25*c2;H.piernaD.rotation.x=.75*e2+.15*c2;H.rodillaD.rotation.x=.2+.3*e2;H.cuerpo.position.y=-.14*e2-.04*c2;
          // Un paso dentro del hachazo: con las dos manos al alcance de ambos brazos, el cuerpo lleva el hacha hasta el golpe.
          H.cuerpo.position.z=.22*e2;break;}
        default:return false;
      }
      return true;
    }
    // Búferes por personaje, creados una sola vez. No añadimos mallas, esqueletos ni pasadas de dibujo.
    function memoria(m){
      let e=estados.get(m);if(e)return e;
      const huesos=Object.entries(m.H).filter(([k])=>k!=='raiz'&&!/^(brazo|ante|mano|falda)/.test(k)).map(([,b])=>b);
      e={huesos,ultima:huesos.map(()=>new THREE.Quaternion()),desde:huesos.map(()=>new THREE.Quaternion()),pos:new THREE.Vector3(),desdePos:new THREE.Vector3(),
        agarre:{G:[0,0,0],A:[0,0,1],arriba:[0,1,0],soltarIzquierda:0,brazoLibre:[0,0,.18,-.4]},desdeAgarre:{G:[0,0,0],A:[0,0,1],arriba:[0,1,0],soltarIzquierda:0,brazoLibre:[0,0,.18,-.4]},valido:false,libre:false,estado:null,tiempo:0,duracion:0};
      estados.set(m,e);return e;
    }
    function copiarAgarre(dest,src){for(const k of ['G','A','arriba','brazoLibre'])for(let i=0;i<src[k].length;i++)dest[k][i]=src[k][i];dest.soltarIzquierda=src.soltarIzquierda;}
    function mezclar(m,a,agarre){
      const e=memoria(m),estado=a.estado||(['tajoA','revesA','estocadaA'].includes(a.anim)?'golpe':a.anim),libre=['grito','muerte'].includes(a.anim),exacta=a.mezclar!==true;
      const nuevo=estado!==e.estado||a.anim!==e.anim;
      if(exacta||!e.valido||libre||e.libre){e.duracion=0;e.tiempo=0;}
      else if(nuevo){
        // La pose final del cargado se mantiene exactamente durante sus 0,3 s de recuperación.
        e.duracion=estado==='carga'?ajustes.carga:estado==='andar'?ajustes.caminar:estado==='quieto'?ajustes.regreso:estado==='golpe'?Math.min(.08,ajustes.carga):estado==='parry'?.035:0;
        e.tiempo=0;e.desdePos.copy(e.pos);e.huesos.forEach((b,i)=>e.desde[i].copy(e.ultima[i]));copiarAgarre(e.desdeAgarre,e.agarre);
      }
      e.tiempo+=Math.max(0,Math.min(.05,a.dt||0));
      let w=e.duracion?suave(e.tiempo/e.duracion):1;
      if(estado==='golpe')w=Math.max(w,tramo(a.k||0,0,.38));
      if(w<1){
        e.huesos.forEach((b,i)=>b.quaternion.slerp(e.desde[i],1-w));
        m.H.cuerpo.position.lerpVectors(e.desdePos,m.H.cuerpo.position,w);
        mezclarAgarre(agarre,e.desdeAgarre,agarre,w,['quieto','andar'].includes(estado)?.24:0);
        agarre.soltarIzquierda=e.desdeAgarre.soltarIzquierda+(agarre.soltarIzquierda-e.desdeAgarre.soltarIzquierda)*w;
        for(let i=0;i<4;i++)agarre.brazoLibre[i]=e.desdeAgarre.brazoLibre[i]+(agarre.brazoLibre[i]-e.desdeAgarre.brazoLibre[i])*w;
      }
      e.huesos.forEach((b,i)=>e.ultima[i].copy(b.quaternion));e.pos.copy(m.H.cuerpo.position);copiarAgarre(e.agarre,agarre);
      e.estado=estado;e.anim=a.anim;e.libre=libre;e.valido=!exacta;
    }
    function resolver(m,a){
      const H=m.H,k=a.k||0,t=a.t||0;
      // Al desplazarse lleva el hacha con la derecha; vuelve a dos manos en combate.
      // El hachazo cargado toma impulso con cadera y torso, hundiendo las rodillas antes del barrido.
      if(a.potencia>0&&['tajoA','revesA','estocadaA'].includes(a.anim)){
        const p=a.potencia,pre=tramo(k,0,.38)*(1-tramo(k,.4,.62)),gol=tramo(k,.4,.62)*(1-tramo(k,.66,1));
        H.torso.rotation.y*=1+.65*p;H.cadera.rotation.y*=1+.5*p;
        H.torso.rotation.x+=p*(-.2*pre+.24*gol);H.cuerpo.position.y-=p*(.13*pre+.08*gol);
        H.rodillaI.rotation.x+=p*(.3*pre+.15*gol);H.rodillaD.rotation.x+=p*.28*pre;
      }
      const agarre=agarreAdreida(a);agarre.soltarIzquierda??=0;agarre.brazoLibre??=[0,0,.18,-.4];mezclar(m,a,agarre);
      {
        const tela=m.tela||(m.tela={t:t,aperturas:Array(7).fill(0)}),dt=Math.max(0,Math.min(.05,t-tela.t));tela.t=t;
        for(let i=0;i<7;i++){
          const ang=(i+.5)/7*TAU+.08,fr=Math.cos(ang),lado=Math.sin(ang);
          const piernas=[H.piernaI,H.piernaD],empuje=Math.max(...piernas.map(b=>Math.max(0,-b.rotation.x*fr+b.rotation.z*lado)));
          const objetivo=Math.min(1.2,.04+empuje*1.12),anterior=tela.aperturas[i];
          // Se abre enseguida ante la pierna; vuelve con retraso y un leve vaivén de tela.
          const apertura=objetivo>anterior?objetivo:objetivo+(anterior-objetivo)*Math.exp(-dt*9);
          tela.aperturas[i]=apertura;const balanceo=Math.sin(t*5+i)*.018*(a.paso||0);
          H['falda'+i].rotation.set(-fr*(apertura+balanceo),0,lado*(apertura+balanceo));
        }
      }
      if(a.sinHacha&&a.anim!=='muerte'){
        const vuelo=a.anim==='lanzarHachaA'?1-tramo(k,.5,1):0,guardia=a.anim==='parry'?1:0,s=Math.sin(a.fase||0)*(a.paso||0)*.22;
        H.brazoD.rotation.set(-.45-1.05*vuelo-.6*guardia+s,0,-.2);H.anteD.rotation.x=-.65+.45*vuelo-.5*guardia;H.manoD.rotation.set(0,0,0);
        H.brazoI.rotation.set(-.35-.8*guardia-s,0,.2);H.anteI.rotation.x=-.7-.3*guardia;H.manoI.rotation.set(0,0,0);
      }else if(!['grito','muerte'].includes(a.anim))empunar(m,agarre);
    }
    return {posar,resolver,longitudZancada,configuracion,configurar,restablecer:()=>{ajustes={...predeterminados};return configuracion();}};
  }
  window.CAOZ_ARPG_ADREIDA_ANIMACION=Object.freeze({fabrica,validar,predeterminados});
})();

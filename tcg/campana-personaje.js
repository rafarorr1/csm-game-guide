/* Personaje de campaña. La apariencia es independiente del mazo y comparte
   la misma geometría en el creador, en la mesa y durante el ascenso final. */
'use strict';
const CAMPANA_ASPECTO={
  figura:{viajero:'Viajero',guardian:'Guardián',mago:'Mago'},
  peinado:{corto:'Corto',largo:'Largo',capucha:'Capucha',sombrero:'Sombrero'},
  piel:{marfil:['Marfil','#e9c6a3'],arena:['Arena','#c68e62'],cobre:['Cobre','#97613f'],ebano:['Ébano','#5b382b'],elfica:['Élfica','#ad9cc6']},
  cabello:{oscuro:['Obsidiana','#292331'],castano:['Castaño','#69402c'],dorado:['Dorado','#d6ac57'],plata:['Plata','#d8dbe0'],rojo:['Carmesí','#913935']},
  color:{vino:['Vino','#963e4b'],azul:['Zafiro','#3b6d9d'],verde:['Bosque','#4d7653'],violeta:['Amatista','#78539b'],marfil:['Marfil','#c7b991'],noche:['Medianoche','#34384e']},
  equipo:{espada:'Espada y escudo',baston:'Bastón arcano',libro:'Grimorio'}
};
function campanaNormalizarPersonaje(d={}){
  if(!d||typeof d!=='object')d={};
  const base={version:1,nombre:'Viajero',figura:'viajero',peinado:'corto',piel:'arena',cabello:'oscuro',color:'vino',equipo:'espada'};
  if(typeof d.nombre==='string'&&d.nombre.trim())base.nombre=d.nombre.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24)||base.nombre;
  for(const k of Object.keys(CAMPANA_ASPECTO))if(Object.hasOwn(CAMPANA_ASPECTO[k],d[k]))base[k]=d[k];
  return base;
}
function campanaNombre(p){return p.personaje?campanaNormalizarPersonaje(p.personaje).nombre:LEADERS[p.lider].n;}
let campanaBorrador=null,campanaVistaPersonaje=null,campanaAltoCreador=0;
function campanaLeerBorrador(){
  if(!campanaBorrador){try{campanaBorrador=JSON.parse(localStorage.getItem(CAMPANA_CLAVE+'.creador'));}catch(_){} }
  const p=campanaBorrador||{};return campanaBorrador={personaje:campanaNormalizarPersonaje(p.personaje),lider:LEADERS[p.lider]?p.lider:'mohamed'};
}
function campanaGuardarBorrador(){try{localStorage.setItem(CAMPANA_CLAVE+'.creador',JSON.stringify(campanaBorrador));}catch(_){} }
function campanaLimpiarCreador(){if(campanaVistaPersonaje)campanaVistaPersonaje.destruir();campanaVistaPersonaje=null;}
function campanaLimpiarBorrador(){campanaBorrador=null;try{localStorage.removeItem(CAMPANA_CLAVE+'.creador');}catch(_){} }

/* Caras de una figura de resina pintada. El visor y la mesa consumen estas caras. */
function campanaGeometriaPersonaje(dato){
  const p=campanaNormalizarPersonaje(dato),caras=[],T=Math.PI*2;
  const piel=CAMPANA_ASPECTO.piel[p.piel][1],pelo=CAMPANA_ASPECTO.cabello[p.cabello][1],tela=CAMPANA_ASPECTO.color[p.color][1],oro='#c9a45d',metal='#aebdc8';
  const cara=(v,color)=>caras.push({v,color});
  function caja(x,y,z,w,h,d,color){const v=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(a=>[x+a[0]*w/2,y+a[1]*h,z+a[2]*d/2]);[[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].forEach(f=>cara(f.map(i=>v[i]),color));}
  function cilindro(x,y,z,r,h,color,r2=r,n=12){const a=[],b=[];for(let i=0;i<n;i++){const t=i*T/n;a.push([x+Math.cos(t)*r,y,z+Math.sin(t)*r]);b.push([x+Math.cos(t)*r2,y+h,z+Math.sin(t)*r2]);}cara(b.slice().reverse(),color);for(let i=0;i<n;i++)cara([a[i],b[i],b[(i+1)%n],a[(i+1)%n]],color);}
  function esfera(x,y,z,r,color,sy=1){for(let j=0;j<6;j++)for(let i=0;i<10;i++){const v=[];for(const [ii,jj] of [[i,j],[i+1,j],[i+1,j+1],[i,j+1]]){const a=ii*T/10,b=-Math.PI/2+jj*Math.PI/6;v.push([x+r*Math.cos(b)*Math.cos(a),y+r*Math.sin(b)*sy,z+r*Math.cos(b)*Math.sin(a)]);}cara(v,color);}}
  cilindro(0,.02,0,.48,.13,'#242631');cilindro(0,.15,0,.45,.06,oro);cilindro(0,.21,0,.4,.025,'#5d655c');
  for(const s of [-1,1]){caja(s*.14,.23,.04,.18,.21,.3,'#302936');cilindro(s*.13,.4,0,.085,.25,'#625441');}
  const ancho=p.figura==='guardian'?.32:.25;
  cilindro(0,.52,0,p.figura==='mago'?.34:.25,.61,p.figura==='guardian'?metal:tela,ancho);
  // Capa con pliegues, hombros y brazos separados del torso.
  for(const s of [-1,1]){
    cara([[s*.24,1.16,-.12],[s*.44,.4,-.29],[0,.33,-.4],[0,1.2,-.18]],tela);
    esfera(s*(ancho+.015),1.04,0,.145,p.figura==='guardian'?oro:tela,.85);
    cilindro(s*.31,.73,.03,.075,.25,tela,.09,8);esfera(s*.32,.72,.08,.09,piel);
  }
  cilindro(0,.7,0,.275,.055,'#3e2d26',.275);caja(0,.7,.273,.09,.065,.035,oro);
  cilindro(0,1.12,0,.08,.13,piel);esfera(0,1.39,.01,.25,piel,1.12);
  if(p.peinado==='capucha'){esfera(0,1.43,-.08,.3,tela,1.15);esfera(0,1.38,.13,.21,piel,1.12);}
  else{esfera(0,1.56,-.04,.245,pelo,.62);if(p.peinado==='largo'){esfera(-.21,1.31,-.02,.12,pelo,2.1);esfera(.21,1.31,-.02,.12,pelo,2.1);esfera(0,1.31,-.19,.2,pelo,1.5);}}
  if(p.peinado==='sombrero'){cilindro(0,1.61,0,.38,.035,tela);cilindro(0,1.645,0,.25,.52,tela,.015);cilindro(0,1.65,0,.255,.04,oro,.23);}
  // Ojos y nariz: el rostro permanece reconocible bajo pelo y capucha.
  for(const s of [-1,1]){esfera(s*.085,1.41,.227,.036,'#eee6d1',.8);esfera(s*.085,1.41,.255,.021,'#25202b');}
  esfera(0,1.33,.255,.045,piel,.9);
  if(p.equipo==='espada'){
    caja(.4,.62,.1,.075,.8,.05,metal);cilindro(.4,.48,.1,.032,.24,'#3e2d26');caja(.4,.72,.1,.27,.045,.075,oro);
    cara([[-.3,1.05,.14],[-.67,1.05,.14],[-.66,.62,.2],[-.49,.44,.24],[-.29,.64,.2]],oro);
    cara([[-.33,1.01,.155],[-.63,1.01,.155],[-.62,.65,.22],[-.49,.5,.26],[-.33,.67,.22]],tela);
  }else if(p.equipo==='baston'){
    cilindro(.41,.24,.08,.037,1.38,'#644333',.028,9);cilindro(.41,1.57,.08,.09,.07,oro);esfera(.41,1.76,.08,.16,'#9ae0df',1.2);
  }else{
    for(const s of [-1,1]){const v=[[0,.79,.26],[s*.42,.95,.26],[s*.42,.88,.63],[0,.72,.63]];cara(v.map(q=>[q[0],q[1]-.03,q[2]]),oro);cara(v,'#f6e3b5');}
    caja(0,.74,.43,.025,.02,.4,'#78583a');
  }
  return caras;
}

function campanaPrevisualizar(contenedor,dato){
  const canvas=document.createElement('canvas');canvas.className='creadorLienzo';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Vista previa de tu miniatura');contenedor.appendChild(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return {actualizar(){},destruir(){canvas.remove();}};
  let caras=campanaGeometriaPersonaje(dato),raf=0,vivo=true,ultimo=0;
  function pintar(t=0){
    const w=contenedor.clientWidth,h=contenedor.clientHeight;if(!w||!h)return;
    const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const giro=matchMedia('(prefers-reduced-motion:reduce)').matches?-.25:-.25+Math.sin(t*.00045)*.18,co=Math.cos(giro),si=Math.sin(giro),esc=Math.min(w/2.5,h/2.6);
    const vista=v=>{const x=v[0]*co+v[2]*si,z=v[2]*co-v[0]*si;return{x:w/2+x*esc,y:h*.9-v[1]*esc+z*.32*esc,d:z+v[1]*.28};};
    ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(w/2,h*.9,esc*.66,esc*.17,0,0,Math.PI*2);ctx.fill();
    const lista=caras.map(c=>({...c,p:c.v.map(vista)})).sort((a,b)=>a.p.reduce((n,p)=>n+p.d,0)/a.p.length-b.p.reduce((n,p)=>n+p.d,0)/b.p.length);
    for(const c of lista){const a=c.v[0],b=c.v[1],d=c.v[2],u=b.map((v,i)=>v-a[i]),v=d.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1,s=.64+.36*Math.abs((n[0]*-.3+n[1]*.8+n[2]*.5)/l);ctx.fillStyle='rgb('+[1,3,5].map(i=>Math.round(parseInt(c.color.slice(i,i+2),16)*s)).join(',')+')';ctx.beginPath();c.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
  }
  const observador=new ResizeObserver(()=>pintar(performance.now()));observador.observe(contenedor);
  function cuadro(t){if(!vivo)return;if(!document.hidden&&t-ultimo>50&&!matchMedia('(prefers-reduced-motion:reduce)').matches){ultimo=t;pintar(t);}raf=requestAnimationFrame(cuadro);}
  pintar();raf=requestAnimationFrame(cuadro);
  return {actualizar(p){caras=campanaGeometriaPersonaje(p);pintar(performance.now());},destruir(){vivo=false;cancelAnimationFrame(raf);observador.disconnect();canvas.remove();}};
}

function campanaCrear(){
  campanaAltoCreador=window.visualViewport?visualViewport.height:innerHeight;
  const borrador=campanaLeerBorrador(),p=borrador.personaje,d=campanaDialogo();campanaCabecera(d,'Dale vida a tu héroe','Una miniatura propia. Una historia en el Domo.');d.dataset.vista='creador';
  d.querySelector('.campanaSello').textContent='1 / 2 · TU MINIATURA';
  const cuerpo=document.createElement('div');cuerpo.className='creadorCuerpo';
  const vista=document.createElement('div');vista.className='creadorVista';vista.innerHTML='<div class="creadorOrbita" aria-hidden="true"></div><span class="creadorMarca">FORJADO EN EL DOMO</span>';
  const controles=document.createElement('div');controles.className='creadorControles';
  const etiqueta=document.createElement('label');etiqueta.className='creadorNombre';etiqueta.textContent='NOMBRE DE TU HÉROE';
  const nombre=document.createElement('input');nombre.id='creadorNombre';nombre.maxLength=24;nombre.value=p.nombre;nombre.autocomplete='off';nombre.spellcheck=false;etiqueta.appendChild(nombre);
  const guardar=()=>{campanaGuardarBorrador();if(campanaVistaPersonaje)campanaVistaPersonaje.actualizar(p);};
  nombre.addEventListener('input',()=>{p.nombre=nombre.value;campanaGuardarBorrador();nombre.setCustomValidity('');});
  nombre.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nombre.blur();}});
  const tabs=document.createElement('nav');tabs.className='creadorTabs';tabs.setAttribute('aria-label','Personalizar miniatura');
  const opciones=document.createElement('div');opciones.className='creadorOpciones';
  function categoria(k){
    opciones.dataset.grupo=k;
    tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoria===k)));opciones.replaceChildren();
    const grupos=k==='figura'?[['figura','Figura'],['peinado','Peinado']]:k==='colores'?[['piel','Piel'],['cabello','Cabello'],['color','Capa']]:[['equipo','Equipo']];
    for(const [campo,titulo] of grupos){const grupo=document.createElement('fieldset'),leyenda=document.createElement('legend');leyenda.textContent=titulo;grupo.appendChild(leyenda);
      for(const [valor,def] of Object.entries(CAMPANA_ASPECTO[campo])){const color=Array.isArray(def),b=campanaBoton(color?'':def,()=>{p[campo]=valor;guardar();grupo.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});b.className=color?'creadorColor':'creadorOpcion';b.dataset.campo=campo;b.dataset.valor=valor;b.setAttribute('aria-label',titulo+': '+(color?def[0]:def));b.title=color?def[0]:def;b.setAttribute('aria-pressed',String(p[campo]===valor));if(color)b.style.setProperty('--muestra',def[1]);grupo.appendChild(b);}
      opciones.appendChild(grupo);
    }
  }
  for(const [id,titulo] of [['figura','Figura'],['colores','Colores'],['equipo','Equipo']]){const b=campanaBoton(titulo,()=>categoria(id));b.dataset.categoria=id;tabs.appendChild(b);}
  controles.append(etiqueta,tabs,opciones);cuerpo.append(vista,controles);
  const siguiente=campanaBoton('Continuar · Elegir mazo',()=>{if(!nombre.value.trim()){nombre.setCustomValidity('Dale un nombre a tu héroe.');nombre.reportValidity();return;}borrador.personaje=campanaNormalizarPersonaje(p);campanaGuardarBorrador();campanaElegir();campanaAnimarEntrada();},true);siguiente.dataset.creadorContinuar='1';
  d.append(cuerpo,campanaAcciones(siguiente,campanaBoton('Menú principal',campanaVolverAlMenu)));categoria('figura');campanaVistaPersonaje=campanaPrevisualizar(vista,p);
}

{
  const css=document.createElement('style');css.textContent=`
  #campanaPanel[data-vista="creador"]{width:min(940px,calc(100vw - 24px));height:min(740px,var(--alto-util))}
  .creadorCuerpo{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1.12fr;gap:24px}
  .creadorVista{position:relative;min-height:0;overflow:hidden;border:1px solid #c59f5550;border-radius:15px;background:radial-gradient(ellipse at 50% 65%,#ba96513b,transparent 58%),linear-gradient(#1d1420,#151416);isolation:isolate}
  .creadorLienzo{position:absolute;inset:0;width:100%;height:100%}.creadorOrbita{position:absolute;width:75%;aspect-ratio:1;left:12.5%;top:15%;border:1px solid #d4b57333;border-radius:50%;box-shadow:0 0 0 18px #c6a65c08,0 0 0 19px #c6a65c19;rotate:-20deg}
  .creadorMarca{position:absolute;top:15px;left:0;right:0;text-align:center;font:8px var(--sans);letter-spacing:3px;color:#c7ab71}
  .creadorControles{display:flex;flex-direction:column;justify-content:center;gap:18px;min-width:0;text-align:left}
  .creadorNombre{display:flex;flex-direction:column;gap:8px;font:700 10px var(--sans);letter-spacing:1.5px;color:#c9aa78}
  .creadorNombre input{box-sizing:border-box;min-width:0;width:100%;height:44px;padding:8px 12px;border:1px solid #bda06d70;border-radius:8px;background:#130f12;color:#f3dfb5;font:18px var(--serif);letter-spacing:.3px}
  .creadorTabs{display:flex;gap:6px}.creadorTabs .btn{flex:1;min-width:0;margin:0;padding:8px 6px;min-height:40px;font:12px var(--sans)}
  #campanaPanel .creadorTabs [aria-pressed="true"]{background:#c9a66a;color:#201710;border-color:#ffe0a1}
  .creadorOpciones{min-height:176px}.creadorOpciones fieldset{margin:0 0 14px;padding:0;border:0;display:flex;flex-wrap:wrap;gap:7px}.creadorOpciones legend{margin-bottom:8px;color:#c9b397;font:11px var(--sans)}
  .creadorOpcion{min-height:40px;padding:7px 12px;border:1px solid #b397634d;border-radius:7px;background:#161114;color:#d2c0a4;font:12px var(--sans);cursor:pointer}
  .creadorOpcion[aria-pressed="true"]{border-color:#ecc989;box-shadow:inset 0 0 0 1px #ecc989;color:#ffe4ac;background:#51402a}
  .creadorColor{position:relative;width:36px;height:36px;min-width:36px;padding:0;border:3px solid #251d1a;border-radius:50%;background:var(--muestra);box-shadow:0 0 0 1px #b4935944;cursor:pointer}
  .creadorColor[aria-pressed="true"]{box-shadow:0 0 0 2px #ffdb92}.creadorColor[aria-pressed="true"]::after{content:'✓';color:white;text-shadow:0 1px 3px #000;position:absolute;inset:0;display:grid;place-items:center;font:700 17px var(--sans)}
  .creadorControles button:hover{scale:1.04}.creadorControles button{transition:scale .15s}.creadorControles :focus-visible{outline:2px solid #ffe0a1;outline-offset:3px}
  @media(max-width:650px){.creadorCuerpo{grid-template-columns:1fr;grid-template-rows:minmax(110px,1fr) auto;gap:12px}.creadorControles{gap:10px}.creadorOpciones{min-height:156px}.creadorOpciones fieldset{margin-bottom:7px}.creadorOpciones legend{margin-bottom:5px}.creadorMarca{top:9px;font-size:7px}.creadorOrbita{width:38%;left:31%;top:9%}.creadorNombre{gap:5px}.creadorOpcion{padding:7px 9px}}
  @media(max-height:650px){.creadorControles{gap:7px}.creadorOpciones{min-height:130px}.creadorOpciones fieldset{margin-bottom:5px;gap:6px}.creadorOpciones legend{margin-bottom:4px}.creadorNombre input{height:36px;font-size:16px}.creadorOpcion{min-height:32px;padding:5px 8px;font-size:11px}.creadorColor{width:30px;height:30px;min-width:30px}.creadorTabs .btn{min-height:32px;padding:5px}.creadorCuerpo{gap:8px}}
  @media(min-aspect-ratio:6/5) and (max-height:650px){#campanaPanel[data-vista="creador"]{display:grid;grid-template-columns:1fr 1.12fr;grid-template-rows:auto minmax(0,1fr) auto;gap:8px 16px}.creadorCuerpo{display:contents}.creadorVista{grid-column:1;grid-row:1/4}.creadorControles{grid-column:2;grid-row:2;gap:5px;justify-content:center}.creadorOpciones{min-height:98px}.creadorNombre input{height:30px}.creadorTabs .btn{min-height:28px}.creadorOpciones legend{font-size:10px}.creadorOpcion{min-height:28px}.creadorColor{width:24px;height:24px;min-width:24px}.creadorMarca{font-size:7px}}
  @media(max-width:650px) and (max-height:650px) and (max-aspect-ratio:6/5){#campanaPanel[data-vista="creador"] .campanaSub{display:none}.creadorCuerpo{grid-template-rows:minmax(76px,1fr) auto}.creadorOpciones{min-height:108px}.creadorOpciones[data-grupo="colores"] fieldset{display:block;height:32px}.creadorOpciones[data-grupo="colores"] legend{float:left;width:44px;line-height:30px;margin:0}.creadorColor{margin-right:5px}#campanaPanel[data-vista="creador"] .campanaAcciones>.btn{grid-column:auto;font-size:12px;line-height:1.2}.creadorMarca{font-size:6px;top:6px}}
  @media(min-aspect-ratio:6/5) and (max-height:420px){#campanaPanel[data-vista="creador"] .campanaSub{display:none}#campanaPanel[data-vista="creador"] h2{font-size:20px}#campanaPanel[data-vista="creador"] .campanaAcciones>.btn{grid-column:auto;font-size:12px;line-height:1.2}.creadorControles{justify-content:flex-start}.creadorNombre{flex-direction:row;align-items:center;gap:8px;font-size:8px;letter-spacing:.8px}.creadorNombre input{width:65%;height:28px;flex:1}.creadorOpciones{min-height:88px}.creadorOpciones fieldset{display:block;min-height:26px;margin-bottom:4px}.creadorOpciones legend{float:left;width:38px;line-height:24px;margin:0}.creadorOpcion{min-height:26px;font-size:10px;padding:4px 5px;margin:0 4px 3px 0}.creadorColor{margin-right:6px}}
  #campanaPanel[data-vista="creador"].creadorTeclado{display:flex}
  #campanaPanel.creadorTeclado .creadorVista,#campanaPanel.creadorTeclado .creadorTabs,#campanaPanel.creadorTeclado .creadorOpciones{display:none}
  #campanaPanel.creadorTeclado .creadorCuerpo{display:flex;flex-direction:column;justify-content:center}
  @media(prefers-reduced-motion:reduce){.creadorControles button{transition:none}}
  `;document.head.appendChild(css);
}
function campanaTecladoCreador(){const d=document.getElementById('campanaPanel');if(d)d.classList.toggle('creadorTeclado',d.dataset.vista==='creador'&&document.activeElement?.id==='creadorNombre'&&(window.visualViewport?visualViewport.height:innerHeight)<Math.min(480,campanaAltoCreador*.78));}
document.addEventListener('focusin',campanaTecladoCreador);document.addEventListener('focusout',()=>setTimeout(campanaTecladoCreador,0));
if(window.visualViewport)visualViewport.addEventListener('resize',campanaTecladoCreador);

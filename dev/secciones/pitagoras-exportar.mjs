/* Exporta una revisión acotada del final de Pitágoras. El puente y su
   presentación se copian desde los módulos reales; el combate no se monta. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {datosDesdeMotor,extraerDeclaracion,hash,juego,leer} from './fuentes.mjs';

const aqui=path.dirname(fileURLToPath(import.meta.url));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

export const cartasPitagoras=Object.freeze(['editorcosecha','editorcorte','editorcuadro','editorcarrera','editororbita','editorduelo']);
export const componentesPitagoras=Object.freeze(['pitagoras-pruebas.js','pitagoras-mundos.js','pitagoras-cine.js','pitagoras-pixel.js']);
// `pitagoras-pruebas.js` lo resuelve relativo a sí mismo. Conservar esta ruta
// evita que la revisión tenga una carta sin el arte que muestra el juego real.
export const recursosPitagoras=Object.freeze(['art/esbirro-editor-v219.webp']);

function serializar(valor){return JSON.stringify(valor).replace(/</g,'\\u003c');}
function lineaDe(codigo,indice){return codigo.slice(0,indice).split('\n').length;}
function exigir(coincidencia,descripcion){if(!coincidencia)throw Error('No se pudo derivar '+descripcion+' desde motor.js.');return coincidencia;}
// `extraerDeclaracion` cubre las funciones normales. La conducta del jefe
// vive en dos funciones async; se delimitan y validan sin ejecutarlas.
function extraerFuncion(codigo,nombre){
  const patron=new RegExp('^\\s*(?:async\\s+)?function\\s+'+nombre+'\\b','gm'),coincidencias=[...codigo.matchAll(patron)];
  if(coincidencias.length!==1)throw Error('Se esperaba una función única de '+nombre+'.');
  const inicio=coincidencias[0].index;
  for(let fin=inicio;fin<codigo.length;fin++){
    if(codigo[fin]!=='}')continue;
    const texto=codigo.slice(inicio,fin+1);
    try{new vm.Script(texto,{filename:nombre+'.js'});return {nombre,texto,linea:lineaDe(codigo,inicio),sha256:hash(texto)};}catch(error){if(!(error instanceof SyntaxError))throw error;}
  }
  throw Error('La función '+nombre+' no termina o tiene sintaxis inválida.');
}

/* No se crea G ni se llama aiScore: este lector sólo comprueba la forma de
   las reglas del motor y publica el resultado de esa lectura para revisarlo. */
function derivarConductaEditor(motor,cartas){
  const turno=extraerFuncion(motor,'startTurn'),jugar=extraerFuncion(motor,'playFromHand'),ia=extraerFuncion(motor,'aiScore'),puedeJugar=extraerFuncion(motor,'canPlay'),capacidad=extraerFuncion(motor,'limiteCampoPersonajes'),reservado=extraerFuncion(motor,'campoEditorReservado'),entrada=extraerFuncion(motor,'puedeEntrarCampo'),repetida=extraerFuncion(motor,'pesadillaRepetidaEnMesa');
  const declaracionEditor=extraerDeclaracion(motor,'CARTAS_EDITOR','const');
  const idsEditor=new vm.Script(declaracionEditor.texto+'\nCARTAS_EDITOR;',{filename:'cartas-editor.js'}).runInNewContext({},{timeout:1000});
  if(!Array.isArray(idsEditor)||idsEditor.length!==cartasPitagoras.length||idsEditor.some((id,i)=>id!==cartasPitagoras[i]))throw Error('CARTAS_EDITOR dejó de representar exactamente las seis Pesadillas de esta revisión.');
  const ritual=exigir(/if\(G\.campana\?\.jefeSecreto&&s===FOE&&!G\.campana\.editorRitual\)\{\s*p\.pdMax=Math\.max\((\d+),p\.pdMax\);G\.campana\.editorRitual=true;[\s\S]*?\}\s*p\.pdMax=Math\.min\((\d+),p\.pdMax\+(\d+)\);/.exec(turno.texto),'el Ritual del Editor');
  const banderaInicial=exigir(/let\s+([A-Za-z_$][\w$]*)=false;/.exec(turno.texto),'la bandera de la reserva inicial');
  const bonoSegundo=exigir(/if\(G\.turnNo===2\s*&&\s*s===G\.second&&!([A-Za-z_$][\w$]*)\)\s*pd\+=(\d+);/.exec(turno.texto),'la excepción de segundo jugador del Ritual');
  if(banderaInicial[1]!==bonoSegundo[1]||!turno.texto.includes(banderaInicial[1]+'=true;'))throw Error('El Ritual no suprime de forma verificable el bono inicial de segundo jugador.');
  const limite=exigir(/req:\(g,s\)=>!!g\.campana\?\.jefeSecreto&&s===FOE&&!g\.online&&!g\.guest&&!NET\.on&&g\.campana\.([A-Za-z_$][\w$]*)!==g\.([A-Za-z_$][\w$]*)&&\s*!pesadillaRepetidaEnMesa\(s,id\)\}/.exec(motor),'los límites de turno y copia de Pesadilla');
  const marca=exigir(/if\(c\.editorJuego&&s===FOE&&partida\.campana\?\.jefeSecreto\)partida\.campana\.([A-Za-z_$][\w$]*)=partida\.([A-Za-z_$][\w$]*);/.exec(jugar.texto),'el marcado de Pesadilla al jugar');
  const antesDePrueba=marca.index<jugar.texto.indexOf('await pruebaDelEditor(s,id,partida)');
  if(limite[1]!==marca[1]||limite[2]!==marca[2]||!antesDePrueba)throw Error('La restricción de Pesadilla no coincide con su marcado antes de la prueba.');
  const limiteMesa=exigir(/return\s+c\?\.editorJuego&&s===FOE&&G\.campana\?\.jefeSecreto\s*\?\s*CARTAS_EDITOR\.length\s*:\s*(\d+)\s*;/.exec(capacidad.texto),'la capacidad especial de la mesa del Editor');
  const reservaExclusiva=exigir(/return\s+s===FOE&&G\.campana\?\.jefeSecreto&&!c\?\.editorJuego\s*;/.exec(reservado.texto),'la reserva del campo para Pesadillas');
  const entradaReservada=exigir(/return\s+!campoEditorReservado\(s,id\)&&P\(s\)\.field\.length<limiteCampoPersonajes\(s,id\)\s*;/.exec(entrada.texto),'la entrada reservada de Personajes');
  const copiaViva=exigir(/return\s+!!\(\s*c\?\.editorJuego&&s===FOE&&G\.campana\?\.jefeSecreto&&P\(s\)\.field\.some\(u=>u\.alive&&u\.card\.id===id\)\s*\)\s*;/.exec(repetida.texto),'el bloqueo de una copia viva de Pesadilla');
  const bloqueoEnJuego=exigir(/if\(pesadillaRepetidaEnMesa\(s,id\)\)\s*return false;/.exec(puedeJugar.texto),'el bloqueo de la Pesadilla repetida al jugar');
  const capacidadEnJuego=exigir(/if\(c\.t==='personaje'&&!puedeEntrarCampo\(s,id\)\)\s*return false;/.exec(puedeJugar.texto),'la capacidad especial al jugar una Pesadilla');
  if(!limiteMesa||!reservaExclusiva||!entradaReservada||!copiaViva||!bloqueoEnJuego||!capacidadEnJuego)throw Error('La mesa única del Editor no se puede verificar.');
  const base=exigir(/let v=c\.editorPrioridad\|\|(\d+);/.exec(ia.texto),'la prioridad base del Editor');
  const penalizacion=exigir(/return v-Math\.max\(0,cost-p\.pd\)\*(\d+);/.exec(ia.texto),'la penalización de PD del Editor');
  const bonos=[...ia.texto.matchAll(/if\(c\.id==='([^']+)'&&([\s\S]*?)\)v\+=(-?\d+);/g)].map(coincidencia=>({id:coincidencia[1],condicion:coincidencia[2].trim(),valor:Number(coincidencia[3])}));
  if(bonos.some(bono=>!Object.hasOwn(cartas,bono.id)))throw Error('La IA contiene un bono para una carta ajena al ciclo del Editor.');
  const prioridad=cartasPitagoras.map(id=>({id,base:Number(cartas[id].editorPrioridad),bonos:bonos.filter(bono=>bono.id===id)}));
  if(prioridad.some(item=>!Number.isFinite(item.base)))throw Error('Una Pesadilla no tiene editorPrioridad en el catálogo actual.');
  return {
    ritual:{pdInicial:Number(ritual[1])+Number(ritual[3]),pisoAntesDeCurva:Number(ritual[1]),incrementoPorTurno:Number(ritual[3]),tope:Number(ritual[2]),bloqueaBonoSegundo:true,bonoSegundoJugador:Number(bonoSegundo[2])},
    pesadilla:{unaPorTurno:true,marca:limite[1],contador:limite[2],marcaAntesDePrueba:antesDePrueba,copiasActivasPorCarta:1,capacidadMesa:idsEditor.length,totalDistintas:idsEditor.length,capacidadNormal:Number(limiteMesa[1]),reservaExclusiva:true},
    prioridad:{respaldo:Number(base[1]),penalizacionPorPDFaltante:Number(penalizacion[1]),cartas:prioridad},
    procedencia:{
      ritual:{funcion:turno.nombre,linea:turno.linea,sha256:turno.sha256},
      pesadilla:{reglaLinea:lineaDe(motor,limite.index),marcado:{funcion:jugar.nombre,linea:jugar.linea,sha256:jugar.sha256},capacidad:{funcion:capacidad.nombre,linea:capacidad.linea,sha256:capacidad.sha256},reserva:{funcion:reservado.nombre,linea:reservado.linea,sha256:reservado.sha256},entrada:{funcion:entrada.nombre,linea:entrada.linea,sha256:entrada.sha256},repetida:{funcion:repetida.nombre,linea:repetida.linea,sha256:repetida.sha256},validacion:{funcion:puedeJugar.nombre,linea:puedeJugar.linea,sha256:puedeJugar.sha256}},
      prioridad:{funcion:ia.nombre,linea:ia.linea,sha256:ia.sha256}
    }
  };
}

export function derivarPitagoras(){
  const motor=leer('motor.js'),datos=datosDesdeMotor(motor);
  const cartas={};
  for(const id of cartasPitagoras){
    if(!datos.CARDS[id])throw Error('No existe la carta del Editor: '+id);
    cartas[id]=datos.CARDS[id];
  }
  const conducta=derivarConductaEditor(motor,cartas);
  // La semilla da una primera pasada repetible para hablar de la misma oleada
  // durante la revisión. Cambiarla desde la página no escribe ningún progreso.
  const fixture={version:2,puente:{tipo:'carrera',duracion:20,semilla:16461829,nombre:'Talesyn',personaje:{nombre:'Talesyn'}},cartas:cartasPitagoras.slice(),conducta};
  const datosJS='/* Fixture temporal derivado del catálogo actual. No hay motor ni partida. */\n'
    +'const CARDS='+serializar(cartas)+';\nconst LEADERS={};\nconst PITAGORAS_REVISION='+serializar(fixture)+';\n';
  new vm.Script(datosJS,{filename:'pitagoras-fixture.js'});
  const mundo=leer('pitagoras-mundos.js'),regla=extraerDeclaracion(mundo,'carrera');
  return {datosJS,fixture,regla,conducta,metadatos:{cartas:cartasPitagoras.slice(),conducta:conducta.procedencia,fuentes:[
    {archivo:'caoz_tcg/motor.js',sha256:hash(leer('motor.js'))},
    {archivo:'caoz_tcg/pitagoras-mundos.js',sha256:hash(mundo)},
  ]}};
}

export function exportar(destino){
  destino=path.resolve(destino);
  if(fs.existsSync(destino)&&(!fs.statSync(destino).isDirectory()||fs.readdirSync(destino).length))throw Error('El destino debe estar vacío; no se sobrescribe otro sitio.');
  const escribir=(nombre,contenido)=>{const ruta=path.join(destino,nombre);fs.mkdirSync(path.dirname(ruta),{recursive:true});fs.writeFileSync(ruta,contenido);};
  const derivado=derivarPitagoras();
  const html=fs.readFileSync(path.join(aqui,'pitagoras.html'),'utf8').replaceAll('__CSP__',csp).replaceAll('__GENERADO__','./generado');
  escribir('index.html',html);escribir('generado/datos.js',derivado.datosJS);escribir('generado/manifiesto.json',JSON.stringify(derivado.metadatos,null,2));
  const entorno={};
  for(const f of ['pitagoras.js','pitagoras.css','memoria.js']){const b=fs.readFileSync(path.join(aqui,f));escribir(f,b);entorno[f]=hash(b);}
  const componentes={};
  for(const f of componentesPitagoras){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);componentes[f]=hash(b);}
  const recursos={};
  for(const f of recursosPitagoras){const b=fs.readFileSync(path.join(juego,f));escribir('juego/'+f,b);recursos[f]=hash(b);}
  const procedencia={seccion:'pitagoras',almacenamiento:'memoria temporal',partida:false,ia:false,online:false,progresoReal:false,
    proposito:'Revisar El último puente y la conducta/ciclo de las seis cartas del Editor sin montar un combate completo.',
    puente:{archivo:'caoz_tcg/pitagoras-mundos.js',funcion:derivado.regla.nombre,linea:derivado.regla.linea,sha256:derivado.regla.sha256},
    conducta:derivado.conducta.procedencia,cartas:cartasPitagoras.slice(),componentes,recursos,entorno,fixture:derivado.fixture,derivados:{'index.html':hash(html),'generado/datos.js':hash(derivado.datosJS)}};
  escribir('procedencia.json',JSON.stringify(procedencia,null,2));
  escribir('_headers','/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+'\n');
  return procedencia;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('Indica una carpeta de salida nueva.');
  const p=exportar(process.argv[2]);console.log('Exportada la revisión de Pitágoras con '+Object.keys(p.componentes).length+' módulos reales. Sin partida, IA, online ni progreso real.');
}

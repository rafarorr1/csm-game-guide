/* Fondo presentacional derivado del menú real. Sólo se extraen HTML y CSS:
   no se ejecutan motor, arranque, red, almacenamiento ni handlers del juego. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const aqui=path.dirname(fileURLToPath(import.meta.url)),juego=path.resolve(aqui,'../../caoz_tcg');
const hash=b=>createHash('sha256').update(b).digest('hex');
const ids={menu:'cuentaFondoMenu',fondoMenus:'cuentaFondoEscena',marca:'cuentaFondoLogo',marcaTexto:'cuentaFondoTexto',
  mCampana:'cuentaFondoCampana',mPlay:'cuentaFondoDomo',mOnline:'cuentaFondoOnline',mExtras:'cuentaFondoExtras'};
const clases=['portada','disco','dos','ambiente','brasas','marca','marcaWrap','marcaTexto','marcaSub','filete','sub','menucol','btn','campana','campanaEtiqueta','online','extras','screen','on','gold','principal','adorno','taller'];
const clase=n=>clases.includes(n)?'cuentaFondo-'+n:n;
function entre(texto,inicio,fin){
  const a=texto.indexOf(inicio),b=texto.indexOf(fin,a+inicio.length);
  if(a<0||b<0)throw Error('Cambió la sección del menú: '+inicio);
  return texto.slice(a,b);
}
function nombresCSS(texto){
  return texto.replace(/\/\*[\s\S]*?\*\/|([.#])([a-zA-Z_][\w-]*)/g,(completo,tipo,nombre)=>{
    if(!tipo)return completo;
    return tipo+(tipo==='#'?(ids[nombre]||nombre):clase(nombre));
  });
}
export function generarFondoCuenta(){
  const fuentes=Object.fromEntries(['index.html','movil.html','polish-aaa.js'].map(f=>[f,fs.readFileSync(path.join(juego,f),'utf8')]));
  const escritorio=fuentes['index.html'],movil=fuentes['movil.html'],polish=fuentes['polish-aaa.js'];
  const coincidencia=escritorio.match(/<div class="screen on portada" id="menu">[\s\S]*?<div class="menucol">[\s\S]*?<\/div>/);
  if(!coincidencia)throw Error('No se encontró la portada real con sus botones.');
  let menu=(coincidencia[0]+'</div>').replace(/<!--[\s\S]*?-->/g,'')
    .replace(/\bid="([^"]+)"/g,(_,id)=>'id="'+(ids[id]||id)+'"')
    .replace(/\bclass="([^"]+)"/g,(_,lista)=>'class="'+lista.split(/\s+/).map(clase).join(' ')+'"')
    .replace(/\saria-(?:controls|haspopup)="[^"]*"/g,'')
    .replace(/<button\b/g,'<button type="button" tabindex="-1"');
  if(/<script\b|\son[a-z]+\s*=|<iframe\b/i.test(menu))throw Error('La portada aislada debe ser sólo presentación.');
  const brasas=Array.from({length:22},(_,i)=>'<i style="--b:'+(2+i%4)+'px;left:'+((i*47)%101)+'%;--dx:'+((i*19)%140-70)+'px;--alto:'+(480+i*23)+'px;--dur:'+(9+i%10)+'s;--esp:-'+(i%18)+'s"></i>').join('');
  const html='<div id="cuentaFondoEscena" class="cuentaFondo-on"><div class="cuentaFondo-ambiente"><i></i><i></i><i></i></div><div class="cuentaFondo-disco"></div><div class="cuentaFondo-disco cuentaFondo-dos"></div><div class="cuentaFondo-brasas">'+brasas+'</div></div>'+menu;
  const cssPartes=[
    entre(escritorio,'#fondoMenus,.portada{','/* LAS CARTAS DEL FONDO').replace(/#fondoMenus>\.barajaFondo\{[^}]*\}/g,''),
    // Anclar al inicio de la regla: ".brasas{" también existe dentro del
    // selector hijo #fondoMenus>.brasas y arrastraría secciones ajenas.
    entre(escritorio,'\n.brasas{position:absolute;','/* EL LOGO */'),
    entre(escritorio,'\n.marcaWrap{margin-top:0;','\n.foot{')
      .replace(/\.portada \.btn\.gold,\s*/g,'')
      .replace(/\.portada \.btn\.gold:hover,\s*/g,'')
      .replace(/(?:\.portada \.btn\.(?:gold|sm)|\.menucol \.btn\.taller)\{[^}]*\}/g,''),
    entre(escritorio,'\n.ambiente{position:absolute;','/* MOTAS POR DELANTE').replace(/#polvo\{[^}]*\}/g,''),
    entre(movil,'#menu{align-items','/* Botones de la portada').replace(/\.portada \.btn\.gold\{[^}]*\}/g,''),
    entre(movil,'#menu .menucol{display:flex;flex-direction:column}','#extras{align-items'),
    entre(polish,'/* MENU_TABERNA_INICIO','/* MENU_TABERNA_FIN */')+'/* MENU_TABERNA_FIN */'
  ];
  const serif=movil.match(/--serif:[^;]+;/)?.[0],sans=movil.match(/--sans:[^;]+;/)?.[0];
  if(!serif||!sans)throw Error('Faltan las tipografías originales del menú.');
  const css='/* Presentación extraída de los HTML y del bloque de botones real. */\n#cuentaFondo{'+serif+sans+'}\n'+cssPartes.map(nombresCSS).join('\n');
  return {html,css,procedencia:{fuentes:Object.fromEntries(Object.entries(fuentes).map(([f,t])=>['caoz_tcg/'+f,hash(t)])),
    adaptador:hash(fs.readFileSync(fileURLToPath(import.meta.url))),html:hash(html),css:hash(css),
    interacciones:false,partida:false,almacenamiento:false}};
}

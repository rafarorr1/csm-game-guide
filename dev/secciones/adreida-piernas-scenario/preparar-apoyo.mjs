/* Conserva el contacto y los cuadros de vuelo de Fast Run con las botas nuevas.
   Hornea la diferencia de suelas una vez; la partida interpola sólo un número. */
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../',import.meta.url),archivo=new URL('./datos.js',import.meta.url);
function cargar(recurso){
  const c=vm.createContext({console,atob});c.window=c;
  for(const f of ['visor-three-vendor.js','adreida-scenario/combate.js','arpg-three-adreida-animacion.js','adreida-scenario/datos.js',recurso,'arpg-three-adreida.js','arpg-three-modelos.js']){
    let s=fs.readFileSync(new URL(f,base),'utf8');
    if(f==='arpg-three-adreida-animacion.js')s=s.replace('function apoyarBotas(m,contacto=false){','function apoyarBotas(m,contacto=false){return;');
    vm.runInContext(s,c);
  }
  const T=c.CAOZ_THREE.THREE,F=c.CAOZ_ARPG_MODELOS.fabrica(T),m=F.crear('adreida'),mesh=m.mallas[0],p=mesh.geometry.attributes.position,ids=[];
  delete mesh.geometry.userData.apoyoCarrera;
  for(let i=0;i<p.count;i++)if(p.getY(i)<.24)ids.push(i);
  return {c,F,m,mesh,ids,v:new T.Vector3()};
}
const anterior=cargar('adreida-brazos-scenario/datos.js'),actual=cargar('adreida-piernas-scenario/datos.js'),perfil=[];
for(let i=0;i<256;i++){
  const minimos=[];
  for(const x of [anterior,actual]){
    x.F.posar(x.m,{anim:'andar',fase:i/256*Math.PI*2,paso:1,mezclar:false});x.m.raiz.updateMatrixWorld(true);
    let minimo=Infinity;for(const j of x.ids)minimo=Math.min(minimo,x.mesh.getVertexPosition(j,x.v).y);minimos.push(minimo);
  }
  perfil.push(Number((minimos[1]-minimos[0]).toFixed(7)));
}
if(!perfil.every(Number.isFinite)||Math.max(...perfil.map(Math.abs))>.08)throw Error('La diferencia de suelas excede el margen de ajuste');
const d=actual.c.CAOZ_ADREIDA_PIERNAS_DATOS;d.apoyoCarrera=perfil;
fs.writeFileSync(archivo,'/* Generado por preparar.py: Adreida con brazos, piernas y botas modulares. */\nwindow.CAOZ_ADREIDA_PIERNAS_DATOS='+JSON.stringify(d)+';\n');
console.log('Apoyo de botas: '+perfil.length+' muestras; conserva el vuelo de Fast Run.');

/* Distribución del cuaderno. Las zonas de pintura se copian píxel por píxel al atlas UV v2. */
'use strict';
(function(){
 const ANCHO=6000,ALTO=7200,TAM=4096;
 function casillas(){return Array.from({length:39},(_,i)=>{const c=i%5,f=Math.floor(i/5),x=Math.floor(c*TAM/5),fin=Math.floor((c+1)*TAM/5);return {id:String(i+1).padStart(2,'0'),atlas:[x,f*512,fin-x,512],cuaderno:[c*1200+340,f*900+220,fin-x,512]};});}
 function extraer(imagen,crearCanvas){
  if(imagen.width===TAM&&imagen.height===TAM)return imagen;
  if(imagen.width!==ANCHO||imagen.height!==ALTO)throw Error('Usa el PNG del cuaderno (6000 × 7200) o el atlas UV v2 (4096 × 4096).');
  const lienzo=crearCanvas();lienzo.width=lienzo.height=TAM;const ctx=lienzo.getContext('2d');ctx.fillStyle='#253039';ctx.fillRect(0,0,TAM,TAM);ctx.imageSmoothingEnabled=false;
  for(const p of casillas())ctx.drawImage(imagen,...p.cuaderno,...p.atlas);
  return lienzo;
 }
 const api={ANCHO,ALTO,TAM,casillas,extraer};if(typeof module!=='undefined')module.exports=api;else window.CAOZ_GOBLIN_CUADERNO=api;
})();

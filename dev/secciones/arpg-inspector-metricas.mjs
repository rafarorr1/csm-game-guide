/* Resumen de tiempos reales entre cuadros; sin confundir envío CPU con duración de GPU. */
export function resumir(muestras){
  if(!muestras.length)return null;
  const tiempos=muestras.map(m=>m.intervalo).sort((a,b)=>a-b),media=k=>muestras.reduce((s,m)=>s+m[k],0)/muestras.length;
  return {cuadros:muestras.length,fps:1000/media('intervalo'),p50:tiempos[Math.ceil(tiempos.length*.5)-1],p95:tiempos[Math.ceil(tiempos.length*.95)-1],maximo:tiempos.at(-1),sobre33:muestras.filter(m=>m.intervalo>33.34).length,simulacion:media('simulacion'),envio:media('envio'),llamadas:media('llamadas'),triangulos:media('triangulos')};
}

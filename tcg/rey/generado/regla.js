function avanceCorte(campo, anterior=null, inicioTurno=null){
  const vivos=campo.filter(u=>u.alive),reyes=vivos.filter(u=>u.card.id==='rey'&&!u.possessed);
  const rey=reyes.find(u=>u.uid===anterior?.rey)||reyes[0];
  if(!rey||vivos.length<4)return {rey:rey?.uid??null,turnos:0,ultimoTurno:null};
  const misma=rey.uid===anterior?.rey;
  let turnos=misma?Math.max(0,Math.min(2,Number(anterior.turnos)||0)):0;
  let ultimoTurno=misma&&Number.isSafeInteger(anterior.ultimoTurno)?anterior.ultimoTurno:null;
  if(Number.isSafeInteger(inicioTurno)&&(ultimoTurno===null||inicioTurno>ultimoTurno)){
    turnos=Math.min(2,turnos+1);ultimoTurno=inicioTurno;
  }
  return {rey:rey.uid,turnos,ultimoTurno};
}

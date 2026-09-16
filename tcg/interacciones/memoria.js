/* Debe ejecutarse antes de cualquier componente real. Este objeto nunca lee
   ni escribe el Storage del navegador, ni siquiera para inicializarse. */
'use strict';
(function(){
  function almacen(){const valores=new Map();return Object.freeze({get length(){return valores.size;},key:i=>[...valores.keys()][i]??null,getItem:k=>valores.get(String(k))??null,setItem:(k,v)=>{valores.set(String(k),String(v));},removeItem:k=>{valores.delete(String(k));},clear:()=>valores.clear()});}
  const local=almacen(),sesion=almacen();
  Object.defineProperty(window,'localStorage',{value:local,configurable:false});
  Object.defineProperty(window,'sessionStorage',{value:sesion,configurable:false});
  window.CAOZ_DEV=Object.freeze({aislado:true,memoria:local,reset:()=>{local.clear();sesion.clear();}});
})();

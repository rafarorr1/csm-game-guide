
(function(){
  var q=new URLSearchParams(location.search);
  if(q.has('test')||q.has('foto')||q.has('pantalla')||q.has('biblia')||q.has('estudioVista'))return;
  document.documentElement.classList.add('arrancando');
  window.CAOZ_ARRANQUE_INICIO=Date.now();
})();

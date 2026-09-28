
(function(){
  var q=new URLSearchParams(location.search);
  if(q.has('escritorio')||q.has('test')||q.has('biblia')||q.has('foto')||q.has('pantalla')) return;
  var tactil=matchMedia('(pointer:coarse)').matches, corto=Math.min(screen.width,screen.height)<700;
  if(tactil&&corto) location.replace('movil.html'+location.search);
})();

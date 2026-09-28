
(function(){
  var q=new URLSearchParams(location.search);
  if(!('serviceWorker' in navigator)||q.has('test')||q.has('estudioVista')
     ||!(location.protocol==='https:'||location.hostname==='localhost'))return;
  navigator.serviceWorker.register('sw.js?b=302&test=arranque').catch(function(){});
})();

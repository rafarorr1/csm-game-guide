/* ==========================================================================
   CAOZ CON TODO — invitaciones de sala compartidas
   --------------------------------------------------------------------------
   El código de sala puede viajar por enlace o por texto. Mantener esta pieza
   pura permite que escritorio, móvil y la revisión aislada expliquen la misma
   ruta sin mezclar una URL beta con una app instalada de producción.
   ========================================================================== */
(function(global){
  'use strict';

  function codigo(valor,base){
    let texto=String(valor||'').trim();
    if(texto.includes('://')){
      try{ texto=new URL(texto,base||global.location?.href).searchParams.get('sala')||''; }
      catch(_){ return ''; }
    }
    return texto.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
  }

  function enApp(navegador=global.navigator,media=global.matchMedia){
    return navegador?.standalone===true || !!(typeof media==='function'&&media('(display-mode: standalone)').matches);
  }

  function nombreEdicion(href=global.location?.href){
    let host='',ruta='';
    try{ const u=new URL(href,global.location?.href);host=u.hostname.toLowerCase();ruta=u.pathname.toLowerCase(); }catch(_){}
    if(/(?:^|[.-])(beta|aislados)(?:[.-]|$)/.test(host)||/(?:^|\/)tcg-beta(?:\/|$)/.test(ruta))return 'la beta de Caoz TCG';
    if(host==='juego.caozcontodo.com')return 'Caoz TCG';
    return 'esta edición de Caoz TCG';
  }

  function enlace(codigoSala,href=global.location?.href,build){
    const sala=codigo(codigoSala,href); if(!sala)return '';
    let u;
    try{ u=new URL(href,global.location?.href); }catch(_){ return ''; }
    u.pathname=u.pathname.replace(/[^/]*$/,'');u.search='';u.hash='';
    u.searchParams.set('sala',sala);
    if(build!=null&&build!=='')u.searchParams.set('b',String(build));
    return u.href;
  }

  function mensajeCodigo(codigoSala,href=global.location?.href){
    const sala=codigo(codigoSala,href); if(!sala)return '';
    return `Únete a mi sala del Domo. Código: ${sala}. Si ya tienes ${nombreEdicion(href)} instalada, abre Con amigos → Unirme con un código y pega ${sala}.`;
  }

  global.CAOZ_INVITACIONES=Object.freeze({codigo,enApp,nombreEdicion,enlace,mensajeCodigo});
})(window);

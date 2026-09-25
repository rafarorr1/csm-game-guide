/* Sobres: funda de foil con volumen, materiales locales y dos roturas distintas.
   Este módulo sólo dibuja. Las cartas, los gestos y el progreso pertenecen a la
   interfaz que lo monta. orientar usa radianes; rectangulo usa píxeles CSS. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const acotar = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const suave = n => { n = acotar(n); return n * n * (3 - 2 * n); };
  const salida = n => 1 - Math.pow(1 - acotar(n), 3);
  const mezclar = (a, b, n) => a + (b - a) * n;
  const normal = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const diferencia = (a, b) => a.map((v, i) => v - b[i]);
  const paletas = {
    reliquia: { oscuro: '#220b12', medio: '#53212f', claro: '#803542', oro: '#d9b373', luz: '#fff0bd', tinta: '#eed4a0', detalle: '#bc8551' },
    arcano: { oscuro: '#080c13', medio: '#161b28', claro: '#2b2a40', oro: '#a6bace', luz: '#e0edff', tinta: '#d8dce7', detalle: '#788ba9' }
  };
  // El color identifica la colección del sobre, nunca el acabado de las cartas.
  const colecciones = {
    trucos: { nombre: 'TRUCOS DEL DOMO', oscuro: '#071829', medio: '#184777', claro: '#3b82c4', oro: '#b8d9f1', luz: '#e4f4ff', tinta: '#e0edfa', detalle: '#7baacb' },
    juramentos: { nombre: 'JURAMENTOS DEL DOMO', oscuro: '#061f19', medio: '#155540', claro: '#298a69', oro: '#c5dfb6', luz: '#efffde', tinta: '#e7f1d5', detalle: '#88b493' },
    caos: { nombre: 'CAOS Y DRAGONES', oscuro: '#260912', medio: '#6e2235', claro: '#b34152', oro: '#e5bf8b', luz: '#fff0d4', tinta: '#f5d9bd', detalle: '#c9817c' }
  };
  const gruposAnteriores = { mohamed: 'trucos', fender: 'trucos', adreida: 'juramentos', rafaela: 'juramentos', gero: 'caos', talesin: 'caos' };
  const grupoValido = id => Object.prototype.hasOwnProperty.call(colecciones,id)?id:
    Object.prototype.hasOwnProperty.call(gruposAnteriores,id)?gruposAnteriores[id]:null;

  function lienzo(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  function letras(g, texto, x, y, espacio, fuente, color) {
    g.font = fuente; g.fillStyle = color; g.textAlign = 'left';
    const ancho = [...texto].reduce((s, c) => s + g.measureText(c).width, 0) + (texto.length - 1) * espacio;
    let px = x - ancho / 2;
    for (const c of texto) { g.fillText(c, px, y); px += g.measureText(c).width + espacio; }
  }

  function rombo(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .62, y);
    g.lineTo(x, y + r); g.lineTo(x - r * .62, y); g.closePath(); g.stroke();
  }

  function sello(g, x, y, r, arcano) {
    g.save(); g.translate(x, y); g.lineWidth = 1.1;
    for (const rr of [r, r * .92, r * .72]) { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke(); }
    for (let i = 0; i < 48; i++) {
      const a = i * TAU / 48, largo = i % 4 ? .975 : .95;
      g.beginPath(); g.moveTo(Math.cos(a) * r * largo, Math.sin(a) * r * largo);
      g.lineTo(Math.cos(a) * r * .91, Math.sin(a) * r * .91); g.stroke();
    }
    const puntos = [];
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; puntos.push([Math.cos(a) * r * .59, Math.sin(a) * r * .59]); }
    g.lineWidth = 1.7; g.beginPath(); puntos.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(...puntos[0]); g.lineTo(...puntos[2]); g.lineTo(...puntos[4]); g.closePath();
    g.moveTo(...puntos[1]); g.lineTo(...puntos[3]); g.lineTo(...puntos[5]); g.closePath(); g.stroke();
    if (arcano) {
      g.beginPath(); g.ellipse(0, 0, r * .31, r * .11, -.6, 0, TAU); g.stroke();
      rombo(g, 0, 0, r * .22);
    } else {
      g.font = '22px Georgia,serif'; g.textAlign = 'center'; g.fillText('V', 0, 8);
    }
    g.restore();
  }

  // Portada de cada colección: una ilustración del juego bajo el foil.
  const portadas = { trucos: 'magodomo', juramentos: 'discipulo', caos: 'tal' };
  const TITULO = "'Cinzel Domo','Cinzel',Georgia,serif";
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };

  /* Tres lienzos con las dos caras lado a lado (frente | reverso), como el de
     las cartas: color; material (R metal, G rugosidad, B altura del relieve) y
     holo (R película iridiscente, G destellos). Todo se dibuja en coordenadas
     de 512×768 por cara y se escala: la altura de un trazo es la misma en los
     tres lienzos, así el relieve coincide con lo impreso. */
  // Un lienzo que ignora todo: la vista de la biblioteca sólo necesita el color.
  const nulo = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}, set: () => true });
  function material(variante, logo, grupo, arte, ligero = false) {
    const arcano = variante === 'arcano', p = colecciones[grupo] || paletas[variante];
    const w = 512, h = 768, K = 1.5, W = Math.round(w * K), H = Math.round(h * K);
    const atlas = lienzo(ligero ? W : W * 2, H), orm = ligero ? null : lienzo(W * 2, H), holo = ligero ? null : lienzo(W * 2, H);
    const g = atlas.getContext('2d'), o = ligero ? nulo : orm.getContext('2d'), q = ligero ? nulo : holo.getContext('2d');
    let semilla = arcano ? 93 : 47;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    // Material: metal y rugosidad en rojo y verde; la altura en azul, de 0 a 255.
    const mat = (metal, rug, alto) => `rgb(${Math.round(metal * 255)},${Math.round(rug * 255)},${Math.round(alto * 255)})`;
    // En el lienzo de material sólo se escribe un canal a la vez con 'lighter'
    // sobre negro; la altura va aparte y se suma al final.
    const alto = ligero ? null : lienzo(W * 2, H), a = ligero ? nulo : alto.getContext('2d');
    for (let lado = 0; lado < (ligero ? 1 : 2); lado++) {
      for (const c of [g, o, q, a]) { c.save(); c.translate(W * lado, 0); c.scale(K, K); }
      // Base: foil de la colección con un velo metálico diagonal.
      const fondo = g.createLinearGradient(0, 0, w, h);
      fondo.addColorStop(0, p.oscuro); fondo.addColorStop(.32, p.medio);
      fondo.addColorStop(.55, p.claro); fondo.addColorStop(.76, p.medio); fondo.addColorStop(1, p.oscuro);
      g.fillStyle = fondo; g.fillRect(0, 0, w, h);
      o.fillStyle = mat(.55, .34, 0); o.fillRect(0, 0, w, h);
      a.fillStyle = '#6e6e6e'; a.fillRect(0, 0, w, h);
      q.fillStyle = '#000'; q.fillRect(0, 0, w, h);
      // La ilustración de portada, sólo al frente: dentro del marco, fundida en
      // el color de la colección arriba (logo) y abajo (nombre).
      if (!lado && arte && arte.naturalWidth) {
        const x0 = 24, y0 = 60, aw = w - 48, ah = h - 120, k = Math.max(aw / arte.naturalWidth, ah / arte.naturalHeight);
        g.save(); g.beginPath(); g.rect(x0, y0, aw, ah); g.clip();
        g.globalAlpha = .96; g.drawImage(arte, x0 + (aw - arte.naturalWidth * k) / 2, y0 + (ah - arte.naturalHeight * k) * .3, arte.naturalWidth * k, arte.naturalHeight * k);
        g.globalAlpha = 1; g.globalCompositeOperation = 'soft-light';
        const tinte = g.createLinearGradient(0, y0, 0, y0 + ah); tinte.addColorStop(0, p.claro); tinte.addColorStop(1, p.medio);
        g.fillStyle = tinte; g.fillRect(x0, y0, aw, ah); g.globalCompositeOperation = 'source-over';
        const velo = g.createLinearGradient(0, y0, 0, y0 + ah);
        velo.addColorStop(0, rgba(p.oscuro, .96)); velo.addColorStop(.26, rgba(p.oscuro, .55)); velo.addColorStop(.42, rgba(p.oscuro, 0));
        velo.addColorStop(.68, rgba(p.oscuro, 0)); velo.addColorStop(.8, rgba(p.oscuro, .82)); velo.addColorStop(1, rgba(p.oscuro, .97));
        g.fillStyle = velo; g.fillRect(x0, y0, aw, ah);
        const lat = g.createLinearGradient(x0, 0, x0 + aw, 0);
        lat.addColorStop(0, rgba(p.oscuro, .6)); lat.addColorStop(.18, rgba(p.oscuro, 0)); lat.addColorStop(.82, rgba(p.oscuro, 0)); lat.addColorStop(1, rgba(p.oscuro, .6));
        g.fillStyle = lat; g.fillRect(x0, y0, aw, ah); g.restore();
        // La ilustración va impresa: menos metal, más mate y una leve textura.
        // La ilustración va impresa: menos metal, más mate. Sin bordes duros.
        const mate = lienzo(Math.ceil(aw), Math.ceil(ah)), mm = mate.getContext('2d');
        for (const [c, color] of [[o, mat(.1, .55, 0)], [q, 'rgb(34,0,0)']]) {
          mm.globalCompositeOperation = 'source-over'; mm.clearRect(0, 0, aw, ah); mm.fillStyle = color; mm.fillRect(0, 0, aw, ah);
          mm.globalCompositeOperation = 'destination-in'; const z = mm.createLinearGradient(0, ah * .22, 0, ah * .8);
          z.addColorStop(0, '#0000'); z.addColorStop(.3, '#000f'); z.addColorStop(.7, '#000f'); z.addColorStop(1, '#0000'); mm.fillStyle = z; mm.fillRect(0, 0, aw, ah);
          c.drawImage(mate, x0, y0, aw, ah);
        }
        a.save(); a.globalAlpha = .18; a.filter = 'grayscale(1) blur(1px)'; a.beginPath(); a.rect(x0, y0 + ah * .25, aw, ah * .52); a.clip();
        a.drawImage(arte, x0 + (aw - arte.naturalWidth * k) / 2, y0 + (ah - arte.naturalHeight * k) * .3, arte.naturalWidth * k, arte.naturalHeight * k); a.restore(); a.filter = 'none';
      }
      // Pliegues laminados largos en los costados y cepillado del metal.
      for (let i = 0; i < 32; i++) {
        const x = azar() < .5 ? azar() * 70 : w - azar() * 70, curva = (azar() - .5) * 40;
        const trama = g.createLinearGradient(x - 9, 0, x + 9, 0);
        trama.addColorStop(0, '#ffffff00'); trama.addColorStop(.5, '#fff5de16'); trama.addColorStop(.58, '#10081238'); trama.addColorStop(1, '#10081200');
        g.fillStyle = trama; g.beginPath(); g.moveTo(x - 9, 46); g.quadraticCurveTo(x + curva, h / 2, x - 9, h - 44);
        g.lineTo(x + 9, h - 44); g.quadraticCurveTo(x + 12, h / 2, x + 9, 46); g.fill();
        a.strokeStyle = '#7e7e7e'; a.lineWidth = 3; a.beginPath(); a.moveTo(x, 46); a.quadraticCurveTo(x + curva, h / 2, x, h - 44); a.stroke();
      }
      for (let i = 0; i < 9000; i++) {
        const x = azar() * w, y = azar() * h, l = azar() * 1.2 + .4;
        g.fillStyle = azar() > .52 ? '#fff0e00e' : '#0503100e'; g.fillRect(x, y, l, .6);
        a.fillStyle = azar() > .5 ? '#747474' : '#686868'; a.fillRect(x, y, l * 3, .7);
      }
      // Costuras de sellado: crestas en relieve, de metal muy brillante.
      for (const yy of [0, h - 45]) {
        const sellado = g.createLinearGradient(0, yy, 0, yy + 45);
        sellado.addColorStop(0, p.oscuro); sellado.addColorStop(.16, p.detalle);
        sellado.addColorStop(.24, p.oscuro); sellado.addColorStop(.85, p.medio); sellado.addColorStop(1, p.oscuro);
        g.fillStyle = sellado; g.fillRect(0, yy, w, 45);
        o.fillStyle = mat(.95, .22, 0); o.fillRect(0, yy, w, 45);
        a.fillStyle = '#5a5a5a'; a.fillRect(0, yy, w, 45);
        for (let x = 4; x < w; x += 5) {
          g.fillStyle = '#fff4d52a'; g.fillRect(x, yy + 4, 1, 36);
          g.fillStyle = '#0302085c'; g.fillRect(x + 1.5, yy + 4, 1, 36);
          a.fillStyle = '#b4b4b4'; a.fillRect(x, yy + 4, 2, 36);
        }
        q.fillStyle = 'rgb(0,120,0)'; q.fillRect(0, yy, w, 45);
      }
      const tinta = g.createLinearGradient(40, 100, w - 40, h - 100);
      if (grupo) {
        tinta.addColorStop(0, p.detalle); tinta.addColorStop(.32, p.luz);
        tinta.addColorStop(.57, p.oro); tinta.addColorStop(.78, p.tinta); tinta.addColorStop(1, p.detalle);
      } else if (arcano) {
        tinta.addColorStop(0, '#98b8b6'); tinta.addColorStop(.28, '#bfa2c8');
        tinta.addColorStop(.48, '#e1ded9'); tinta.addColorStop(.7, '#7993b9'); tinta.addColorStop(1, '#afa0c5');
      } else {
        tinta.addColorStop(0, '#9f733d'); tinta.addColorStop(.32, '#f9dea0');
        tinta.addColorStop(.57, '#c69d5a'); tinta.addColorStop(.78, '#f5db9c'); tinta.addColorStop(1, '#986934');
      }
      // Estampado: la tinta de foil se imprime en color, es metal pulido en el
      // material, sube en el relieve y lleva la película holográfica.
      function estampado(dibujar, relieve = 1) {
        for (const [c, color] of [[g, tinta], [o, mat(1, .16, 0)], [q, 'rgb(255,200,0)'], [a, `rgb(${Math.round(110 + 120 * relieve)},${Math.round(110 + 120 * relieve)},${Math.round(110 + 120 * relieve)})`]]) {
          c.save(); c.strokeStyle = color; c.fillStyle = color; dibujar(c, color); c.restore();
        }
      }
      estampado((c, color) => {
        c.lineWidth = 1.4; c.strokeRect(24, 60, w - 48, h - 120); c.lineWidth = .9; c.strokeRect(30, 66, w - 60, h - 132);
        for (const x of [37, w - 37]) for (const y of [73, h - 73]) { c.lineWidth = 1.3; rombo(c, x, y, 8); }
        if (arcano) {
          c.globalAlpha = .45;
          for (let i = 0; i < 4; i++) {
            c.beginPath(); c.moveTo(30, 140 + i * 37); c.lineTo(140 + i * 30, 65); c.stroke();
            c.beginPath(); c.moveTo(w - 30, h - 140 - i * 37); c.lineTo(w - 140 - i * 30, h - 65); c.stroke();
          }
        } else if (lado) {
          c.globalAlpha = .45;
          for (const s of [-1, 1]) {
            c.beginPath(); c.moveTo(w / 2 + s * 191, 310); c.bezierCurveTo(w / 2 + s * 65, 250, w / 2 + s * 208, 90, w / 2 + s * 140, 80); c.stroke();
            c.beginPath(); c.moveTo(w / 2 + s * 191, 490); c.bezierCurveTo(w / 2 + s * 80, 540, w / 2 + s * 180, 650, w / 2 + s * 105, 683); c.stroke();
          }
        }
        c.globalAlpha = 1;
        letras(c, lado ? 'CAOZ CON TODO' : 'EL JUEGO DE CARTAS', w / 2, lado ? 112 : 92, 3.6, `600 12px ${TITULO}`, color);
      }, .8);
      if (logo && logo.naturalWidth) {
        const lw = lado ? 210 : 400, lh = lw * logo.naturalHeight / logo.naturalWidth;
        const ly = lado ? 152 : 104;
        g.save(); g.shadowColor = '#000c'; g.shadowBlur = 16; g.shadowOffsetY = 9;
        g.drawImage(logo, (w - lw) / 2, ly, lw, lh); g.restore();
        // La marca sobresale: su silueta sube en el relieve y es laca brillante.
        const silueta = (color, desenfoque) => {
          const m = lienzo(Math.ceil(lw * K), Math.ceil(lh * K)), mc = m.getContext('2d');
          mc.filter = desenfoque ? `blur(${desenfoque}px)` : 'none'; mc.drawImage(logo, 0, 0, lw * K, lh * K); mc.filter = 'none';
          mc.globalCompositeOperation = 'source-in'; mc.fillStyle = color; mc.fillRect(0, 0, lw * K, lh * K); return m;
        };
        if (!ligero) {
        a.save(); a.setTransform(1, 0, 0, 1, W * lado, 0);
        a.drawImage(silueta('#d2d2d2', 3), (w - lw) / 2 * K, ly * K); a.drawImage(silueta('#f0f0f0', 0), (w - lw) / 2 * K, ly * K); a.restore();
        o.save(); o.setTransform(1, 0, 0, 1, W * lado, 0); o.drawImage(silueta(mat(.1, .12, 0), 0), (w - lw) / 2 * K, ly * K); o.restore();
        q.save(); q.setTransform(1, 0, 0, 1, W * lado, 0); q.drawImage(silueta('rgb(0,70,0)', 0), (w - lw) / 2 * K, ly * K); q.restore();
        }
      } else {
        letras(g, 'CAOZ', w / 2, lado ? 235 : 215, 7, `900 72px ${TITULO}`, tinta);
        letras(g, 'CON TODO', w / 2, lado ? 261 : 249, 5, `600 18px ${TITULO}`, p.tinta);
      }
      estampado((c, color) => {
        if (!lado) {
          // Placa del nombre al pie, con su sello a los lados.
          c.lineWidth = 1.2; c.beginPath(); c.moveTo(64, 574); c.lineTo(w - 64, 574); c.stroke();
          c.beginPath(); c.moveTo(96, 694); c.lineTo(w - 96, 694); c.stroke();
          for (const s of [-1, 1]) rombo(c, w / 2 + s * 200, 574, 5);
          letras(c, p.nombre || (arcano ? 'ARCANO' : 'RELIQUIA'), w / 2, 618, grupo ? 2.4 : arcano ? 10 : 7.2, `700 ${grupo ? 25 : 29}px ${TITULO}`, color);
          letras(c, 'C I N C O   C A R T A S', w / 2, 652, .5, `600 11px ${TITULO}`, color);
          letras(c, 'EDICIÓN DEL DOMO', w / 2, 680, 2.8, `600 10px ${TITULO}`, color);
        } else {
          sello(c, w / 2, 349, 48, arcano);
          letras(c, 'EL DOMO TE ESPERA', w / 2, 461, 3.2, `700 17px ${TITULO}`, color);
          letras(c, 'CINCO CARTAS · INFINITAS HISTORIAS', w / 2, 496, 1.05, `600 9px ${TITULO}`, color);
          c.lineWidth = .9; c.beginPath(); c.moveTo(96, 529); c.lineTo(w - 96, 529); c.stroke();
          letras(c, 'CAOZCONTODO.COM', w / 2, 646, 2.9, `600 10px ${TITULO}`, color);
          letras(c, p.nombre || (arcano ? 'ARCANO / 01' : 'RELIQUIA / 01'), w / 2, 671, 2.4, `600 9px ${TITULO}`, color);
        }
      }, 1);
      if (lado) {
        // Soldadura central del reverso con sombra propia y doble ribete.
        const pliegue = g.createLinearGradient(239, 0, 273, 0);
        pliegue.addColorStop(0, '#0000'); pliegue.addColorStop(.45, '#0002'); pliegue.addColorStop(.49, '#fff1'); pliegue.addColorStop(.57, '#0004'); pliegue.addColorStop(1, '#0000');
        g.fillStyle = pliegue; g.fillRect(239, 48, 34, h - 96);
        a.fillStyle = '#8c8c8c'; a.fillRect(250, 48, 12, h - 96);
        g.fillStyle = p.tinta;
        let x = 202;
        for (let i = 0; i < 38; i++) { const ancho = 1 + (i * 7 % 3); if (i % 3) g.fillRect(x, 561, ancho, 33); x += ancho + 1; }
        letras(g, 'C C T   /   0 0 5', w / 2, 610, 1, `600 8px ${TITULO}`, p.tinta);
      }
      for (const c of [g, o, q, a]) c.restore();
    }
    if (ligero) return { atlas };
    // El relieve se suaviza un poco y pasa al canal azul del material.
    const suaveAlto = lienzo(W * 2, H), sa = suaveAlto.getContext('2d'); sa.filter = 'blur(1.6px)'; sa.drawImage(alto, 0, 0);
    const M = o.getImageData(0, 0, W * 2, H), A = sa.getImageData(0, 0, W * 2, H).data;
    for (let i = 0; i < A.length; i += 4) M.data[i + 2] = A[i];
    o.putImageData(M, 0, 0);
    return { atlas, orm, holo };
  }

  const vertex = `
    attribute vec3 aPosicion; attribute vec3 aNormal; attribute vec2 aUV;
    attribute float aTipo; attribute float aAlpha;
    uniform vec2 uAngulo; uniform vec2 uResolucion; uniform float uEscala;
    varying vec3 vNormal; varying vec3 vPosicion; varying vec2 vUV; varying vec3 vT; varying vec3 vB;
    varying float vTipo; varying float vAlpha;
    void main(){
      float cy=cos(uAngulo.x),sy=sin(uAngulo.x),cp=cos(uAngulo.y),sp=sin(uAngulo.y);
      mat3 ry=mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy);
      mat3 rx=mat3(1.,0.,0.,0.,cp,sp,0.,-sp,cp);
      mat3 giro=rx*ry;
      vec3 p=aTipo>1.5?aPosicion:giro*aPosicion;
      // Tangentes del atlas: el reverso está espejado en horizontal.
      vT=giro*vec3(aUV.x<.5?1.:-1.,0.,0.);vB=giro*vec3(0.,1.,0.);
      vPosicion=p;vNormal=giro*aNormal;vUV=aUV;vTipo=aTipo;vAlpha=aAlpha;
      float d=7.-p.z;
      gl_Position=vec4(p.x*uEscala*2./uResolucion.x,-p.y*uEscala*2./uResolucion.y,1.105263*d-2.105263,d);
    }`;
  /* El mismo modelo de luz que la carta del visor (visor-3d-gl.js): estudio
     procedural reflejado, luz de relleno fija y una luz puntual que sigue el
     giro del sobre, relieve desde la altura, metal y laca, película holográfica. */
  const fragment = `
    precision highp float;
    uniform sampler2D uColor; uniform sampler2D uOrm; uniform sampler2D uHolo;
    uniform float uArcano; uniform vec2 uTexel; uniform vec2 uLuz; uniform float uTiempo;
    varying vec3 vNormal; varying vec3 vPosicion; varying vec2 vUV; varying vec3 vT; varying vec3 vB;
    varying float vTipo; varying float vAlpha;
    vec3 tono(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
    vec3 estudio(vec3 r){
      vec3 c=mix(vec3(.08,.07,.1),vec3(.6,.55,.6),smoothstep(-.8,.9,-r.y));
      c+=vec3(1.,.93,.8)*3.*pow(max(0.,dot(r,normalize(vec3(.6,-.55,.58)))),18.);
      c+=vec3(.75,.8,1.)*1.1*pow(max(0.,dot(r,normalize(vec3(-.75,-.2,.55)))),6.);
      c+=vec3(.9,.72,.5)*.45*pow(max(0.,dot(r,normalize(vec3(0.,.9,.35)))),3.);
      return c;
    }
    vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    void main(){
      if(vTipo>1.5){
        vec2 q=(vUV-.5)*2.;float d=dot(q,q);
        gl_FragColor=vec4(.008,.004,.012,exp(-d*4.)*.36*vAlpha);return;
      }
      if(vTipo>.5){gl_FragColor=vec4(.57,.75,.91,vAlpha);return;}
      vec3 Ng=normalize(vNormal),T=normalize(vT),B=normalize(vB);
      vec4 m=texture2D(uOrm,vUV);
      float hx=texture2D(uOrm,vUV+vec2(uTexel.x,0.)).b-texture2D(uOrm,vUV-vec2(uTexel.x,0.)).b;
      float hy=texture2D(uOrm,vUV+vec2(0.,uTexel.y)).b-texture2D(uOrm,vUV-vec2(0.,uTexel.y)).b;
      vec3 N=normalize(Ng-(T*hx+B*hy)*5.);
      vec3 base=pow(texture2D(uColor,vUV).rgb,vec3(2.2));
      float met=m.r,rug=max(.08,m.g);
      vec3 V=normalize(vec3(0.,0.,7.)-vPosicion);
      vec3 albedo=base*(1.-met*.85),F0=mix(vec3(.04),base,met);
      vec3 c=albedo*.3;
      vec3 luces[2];luces[0]=normalize(vec3(-.45,-.6,.9));luces[1]=normalize(vec3(uLuz.x,uLuz.y,1.1));
      for(int i=0;i<2;i++){
        vec3 L=luces[i],H=normalize(L+V);float e=mix(600.,6.,rug);
        float d=max(dot(N,L),0.),s=pow(max(dot(N,H),0.),e)*(e+8.)/25.13;
        c+=(i==0?vec3(.85,.8,.74):vec3(1.5,1.35,1.15))*d*(albedo+F0*s);
      }
      float fr=pow(1.-max(dot(N,V),0.),5.);
      c+=estudio(reflect(-V,N))*(F0+(1.-F0)*fr)*mix(.6,.2,rug);
      // Laca sobre lo impreso, con la normal del plástico.
      c+=estudio(reflect(-V,Ng))*(.04+.96*pow(1.-max(dot(Ng,V),0.),5.))*.4*(1.-met);
      vec4 h=texture2D(uHolo,vUV);
      vec3 r=reflect(-V,Ng);
      float banda=(vUV.x*1.8+vUV.y*1.2)*1.6+r.x*3.2+r.y*2.4+uTiempo*.05;
      vec3 arco=mix(vec3(1.),tono(fract(banda)),.85);
      float ang=pow(max(0.,1.-abs(r.x*.7+r.y*.25-.1)),10.);
      c+=arco*h.r*(.12+ang*.8)*mix(.6,1.,uArcano);
      float chispa=step(.985,fract(sin(dot(floor(vUV*vec2(900.,600.)),vec2(12.9898,78.233)))*43758.5453));
      c+=vec3(1.,.95,.85)*h.g*chispa*ang*3.;
      gl_FragColor=vec4(pow(aces(c*1.05),vec3(1./2.2)),vAlpha);
    }`;

  function pintorGL(canvas, mat) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const objetos = [];
    function shader(tipo, fuente) {
      const s = gl.createShader(tipo); gl.shaderSource(s, fuente); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('No se pudo preparar el material del sobre.'); }
      objetos.push(['shader', s]); return s;
    }
    const programa = gl.createProgram(); objetos.push(['program', programa]);
    gl.attachShader(programa, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(programa, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(programa); if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error('No se pudo preparar la escena del sobre.');
    gl.useProgram(programa);
    const buffer = gl.createBuffer(); objetos.push(['buffer', buffer]); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    let offset = 0;
    for (const [nombre, n] of [['aPosicion', 3], ['aNormal', 3], ['aUV', 2], ['aTipo', 1], ['aAlpha', 1]]) {
      const at = gl.getAttribLocation(programa, nombre); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, n, gl.FLOAT, false, 40, offset * 4); offset += n;
    }
    const uniformes = {};
    for (const n of ['uAngulo', 'uResolucion', 'uEscala', 'uArcano', 'uColor', 'uOrm', 'uHolo', 'uTexel', 'uLuz', 'uTiempo']) uniformes[n] = gl.getUniformLocation(programa, n);
    const texturas = [];
    function subir(m) {
      [m.atlas, m.orm, m.holo].forEach((c, i) => {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texturas[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      });
      gl.uniform2f(uniformes.uTexel, 1.4 / m.atlas.width, 1.4 / m.atlas.height);
    }
    for (let i = 0; i < 3; i++) {
      const t = gl.createTexture(); objetos.push(['texture', t]); texturas.push(t);
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.uniform1i(uniformes.uColor, 0); gl.uniform1i(uniformes.uOrm, 1); gl.uniform1i(uniformes.uHolo, 2);
    subir(mat);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return {
      gl: true,
      actualizar(m) { subir(m); },
      dibujar(datos, op) {
        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(uniformes.uAngulo, op.yaw, op.pitch); gl.uniform2f(uniformes.uResolucion, op.ancho, op.alto);
        gl.uniform1f(uniformes.uEscala, op.escala); gl.uniform1f(uniformes.uArcano, op.arcano ? 1 : 0);
        // La luz puntual acompaña al giro: arrastrar el sobre mueve su brillo.
        gl.uniform2f(uniformes.uLuz, .9 - op.yaw * 2.2, -.7 + op.pitch * 1.6); gl.uniform1f(uniformes.uTiempo, op.tiempo || 0);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, datos.length / 10);
      },
      destruir() {
        for (const [tipo, o] of objetos) {
          if (tipo === 'shader') gl.deleteShader(o); else if (tipo === 'program') gl.deleteProgram(o);
          else if (tipo === 'texture') gl.deleteTexture(o); else gl.deleteBuffer(o);
        }
        const perder = gl.getExtension('WEBGL_lose_context'); if (perder) perder.loseContext();
      }
    };
  }

  // Alternativa con la misma malla y proyección: incluso sin WebGL se ve el
  // reverso y el espesor. Sólo se sustituyen el material y el rasterizador.
  function pintorCanvas(canvas, mat) {
    const g = canvas.getContext('2d'); if (!g) return null;
    return {
      actualizar(m) { mat = m; },
      dibujar(datos, op) {
        const dpr = canvas.width / op.ancho;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, op.ancho, op.alto);
        const cy = Math.cos(op.yaw), sy = Math.sin(op.yaw), cp = Math.cos(op.pitch), sp = Math.sin(op.pitch);
        const proyectar = (a, plano) => {
          let [x, y, z] = a;
          if (!plano) { const xx = x * cy + z * sy; z = -x * sy + z * cy; x = xx; const yy = y * cp - z * sp; z = y * sp + z * cp; y = yy; }
          return [op.ancho / 2 + x * op.escala / (7 - z), op.alto / 2 + y * op.escala / (7 - z), z];
        };
        const tris = [];
        for (let i = 0; i < datos.length; i += 30) {
          const tipo = datos[i + 8];
          if (tipo > 1.5) continue;
          const p = [0, 10, 20].map(j => proyectar(datos.slice(i + j, i + j + 3), false));
          tris.push({ p, i, z: (p[0][2] + p[1][2] + p[2][2]) / 3 });
        }
        tris.sort((a, b) => a.z - b.z);
        for (const { p, i } of tris) {
          const uv = [0, 10, 20].map(j => [datos[i + j + 6] * mat.atlas.width, datos[i + j + 7] * mat.atlas.height]);
          const [s0, s1, s2] = uv, [d0, d1, d2] = p;
          const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
          if (Math.abs(den) < .0001) continue;
          const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
          const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
          const c = ((s1[0] - s0[0]) * (d2[0] - d0[0]) - (s2[0] - s0[0]) * (d1[0] - d0[0])) / den;
          const d = ((s1[0] - s0[0]) * (d2[1] - d0[1]) - (s2[0] - s0[0]) * (d1[1] - d0[1])) / den;
          g.save(); g.globalAlpha = datos[i + 9];
          // Solape subpíxel para que el antialias de cada triángulo no abra costuras.
          const mx = (d0[0] + d1[0] + d2[0]) / 3, my = (d0[1] + d1[1] + d2[1]) / 3;
          g.beginPath(); p.forEach((q, j) => { const dx = q[0] - mx, dy = q[1] - my, n = Math.hypot(dx, dy) || 1; const x = q[0] + dx / n * .35, y = q[1] + dy / n * .35; j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.clip();
          g.transform(a, b, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - d * s0[1]); g.drawImage(mat.atlas, 0, 0); g.restore();
        }
      },
      destruir() { g.clearRect(0, 0, canvas.width, canvas.height); }
    };
  }

  function crear(contenedor, opciones = {}) {
    if (!contenedor || !contenedor.appendChild) throw new TypeError('El sobre necesita un contenedor.');
    const variante = opciones.variante === 'arcano' ? 'arcano' : 'reliquia', arcano = variante === 'arcano';
    const grupo = grupoValido(opciones.grupo);
    const consulta = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reducir = () => opciones.reducirMovimiento === true || !!(consulta && consulta.matches);
    let canvas = lienzo(1, 1), mat = material(variante, null, grupo, null), pintor;
    try { pintor = pintorGL(canvas, mat); } catch (_) { pintor = null; }
    if (!pintor) { canvas = lienzo(1, 1); pintor = pintorCanvas(canvas, mat); }
    if (!pintor) throw new Error('Este navegador no puede dibujar el sobre.');
    function prepararCanvas(c) {
      c.className = 'sobresEscenaLienzo'; c.setAttribute('aria-hidden', 'true');
      if(grupo)c.dataset.grupo=grupo;
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    }
    prepararCanvas(canvas);
    contenedor.appendChild(canvas);
    let ancho = 1, alto = 1, escala = 1, packW = 1, packH = 1;
    let vivo = true, raf = 0, timer = 0, timerRotura = 0, yaw = -.14, pitch = .06, inicio = 0;
    let apertura = null, resolver = null, abierto = false, vista = 'cerrado';
    const tiempoApertura = arcano ? 1540 : 1720;
    const recursos = cargarRecursos(opciones, grupo, variante);
    recursos.listos.then(r => { if (!vivo) return; mat = material(variante, r.logo, grupo, r.arte); pintor.actualizar(mat); solicitar(); });

    function rectangulo() { return { x: (ancho - packW) / 2, y: (alto - packH) / 2, width: packW, height: packH }; }

    function redimensionar() {
      if (!vivo) return;
      ancho = Math.max(1, contenedor.clientWidth); alto = Math.max(1, contenedor.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(ancho * dpr)); canvas.height = Math.max(1, Math.round(alto * dpr));
      packH = Math.min(alto * .74, 600, ancho * .78 * 1.5); packW = packH / 1.5;
      escala = packW / 2 * 6.9; solicitar();
    }

    function fases(ahora) {
      if (!apertura) return { tear: 0, caer: 0, bajar: 0, alpha: abierto ? 0 : 1, yaw, pitch, capAlpha: abierto ? 0 : 1, anticipacion: 0 };
      const ms = ahora - inicio;
      if (apertura.reducida) {
        const alpha = 1 - suave(ms / 180);
        return { tear: 0, caer: 0, bajar: 0, alpha, yaw: 0, pitch: 0, capAlpha: alpha, anticipacion: 0 };
      }
      const centrar = suave(ms / 250), tear = salida((ms - 270) / (arcano ? 430 : 530));
      const caer = acotar((ms - (arcano ? 630 : 740)) / 650);
      const bajar = suave((ms - (arcano ? 790 : 910)) / 620);
      return { tear, caer, bajar, alpha: 1, yaw: apertura.yaw * (1 - centrar), pitch: apertura.pitch * (1 - centrar), capAlpha: 1 - suave((caer - .6) / .4), anticipacion: Math.sin(acotar(ms / 290) * Math.PI) * -.035 };
    }

    function datosMalla(f) {
      const datos = [], col = 18;
      const corte = .104, viaje = alto / (packH / 3) / 2 + 2;
      const zigzag = u => Math.sin(u * 131) * .004 + Math.sin(u * 67 + .6) * .003;
      function superficie(u, v, frente, cap, mitad = 0) {
        const xx = u * 2 - 1, borde = Math.pow(Math.max(0, Math.sin(u * Math.PI)), .55);
        let y = v * 3 - 1.5, x = xx;
        const sellado = suave(v / .077) * suave((1 - v) / .077);
        let z = frente * (.025 + .069 * borde * sellado);
        // El centro queda casi plano; las pequeñas arrugas se concentran en aristas.
        z += frente * Math.sin(v * 47 + u * 8) * .007 * Math.pow(Math.abs(xx), 5) * sellado;
        if (Math.abs(v - corte) < .00001) y += zigzag(u) * f.tear;
        y += f.anticipacion;
        if (cap) {
          if (arcano) {
            const lado = mitad || (u < .5 ? -1 : 1), local = suave(f.tear * 1.45 - Math.abs(u - .5) * .75);
            const centro = lado * .5, dx = x - centro, giro = lado * (local * .24 + f.caer * 1.3);
            x = centro + dx * Math.cos(giro) - (y + 1.34) * Math.sin(giro) + lado * (local * .19 + f.caer * .6);
            y = -1.34 + dx * Math.sin(giro) + (y + 1.34) * Math.cos(giro) - local * .3 + f.caer * f.caer * viaje;
            z += local * .09 + Math.sin(u * 15) * local * .02;
          } else {
            const local = suave((f.tear * 1.32 - u) / .32);
            const curvatura = f.tear * 5.2, angulo = curvatura * (1 - u), radio = 2 / Math.max(.001, curvatura);
            const curvado = 1 - radio * Math.sin(angulo);
            x = mezclar(x, curvado, local) - local * f.tear * .35;
            z += (1 - Math.cos(angulo)) * radio * local * .65;
            y -= local * .18 + Math.sin(angulo * .8) * local * .12;
            const giro = -f.caer * 2.1, dx = x - .4, dy = y + 1.34;
            x = .4 + dx * Math.cos(giro) - dy * Math.sin(giro) - f.caer * .5;
            y = -1.34 + dx * Math.sin(giro) + dy * Math.cos(giro) + f.caer * f.caer * viaje;
          }
        } else { y += f.bajar * viaje; z += Math.sin(f.bajar * Math.PI) * .08; }
        return [x, y, z];
      }
      function triangulo(puntos, uv, tipo, alpha, normales) {
        const n = normal(cruz(diferencia(puntos[1], puntos[0]), diferencia(puntos[2], puntos[0])));
        for (let i = 0; i < 3; i++) datos.push(...puntos[i], ...(normales ? normales[i] : n), ...uv[i], tipo, alpha);
      }
      function quad(p, uv, alpha, ns, tipo = 0) {
        triangulo([p[0], p[1], p[2]], [uv[0], uv[1], uv[2]], tipo, alpha, ns && [ns[0], ns[1], ns[2]]);
        triangulo([p[0], p[2], p[3]], [uv[0], uv[2], uv[3]], tipo, alpha, ns && [ns[0], ns[2], ns[3]]);
      }
      // Sombra suave independiente de la orientación del envoltorio.
      quad([[-1.5, 1.4, -.4], [1.5, 1.4, -.4], [1.5, 2, -.4], [-1.5, 2, -.4]], [[0, 0], [1, 0], [1, 1], [0, 1]], (1 - f.bajar) * f.alpha, null, 2);
      for (const cap of [false, true]) {
        const alpha = cap ? f.capAlpha : f.alpha;
        if (alpha <= .002 || (!cap && f.bajar >= 1)) continue;
        const minV = cap ? 0 : corte, maxV = cap ? corte : 1, filas = cap ? 3 : 20;
        for (const frente of [1, -1]) {
          const offset = frente === 1 ? 0 : .5;
          function vertice(u, v, mitad) {
            const p = superficie(u, v, frente, cap, mitad), e = .0004;
            const dx = diferencia(superficie(u + e, v, frente, cap, mitad), superficie(u - e, v, frente, cap, mitad));
            const dy = diferencia(superficie(u, v + e, frente, cap, mitad), superficie(u, v - e, frente, cap, mitad));
            const n = normal(cruz(dx, dy)).map(a => a * frente);
            return { p, n, uv: [offset + (frente === 1 ? u : 1 - u) * .5, v] };
          }
          const mitades = cap && arcano ? [-1, 1] : [0];
          for (const mitad of mitades) {
            const iMin = mitad === 1 ? col / 2 : 0, iMax = mitad === -1 ? col / 2 : col, tabla = [];
            for (let j = 0; j <= filas; j++) {
              tabla[j] = [];
              for (let i = iMin; i <= iMax; i++) tabla[j][i] = vertice(i / col, mezclar(minV, maxV, j / filas), mitad);
            }
            for (let j = 0; j < filas; j++) for (let i = iMin; i < iMax; i++) {
              const q = [tabla[j][i], tabla[j][i + 1], tabla[j + 1][i + 1], tabla[j + 1][i]];
              quad(q.map(a => a.p), q.map(a => a.uv), alpha, q.map(a => a.n));
            }
          }
        }
        // Las caras estrechas cierran el volumen. La abertura conserva un borde de foil.
        for (const u of [0, 1]) for (let j = 0; j < filas; j++) {
          const v0 = mezclar(minV, maxV, j / filas), v1 = mezclar(minV, maxV, (j + 1) / filas);
          quad([superficie(u, v0, 1, cap), superficie(u, v0, -1, cap), superficie(u, v1, -1, cap), superficie(u, v1, 1, cap)], [[.007, v0], [.015, v0], [.015, v1], [.007, v1]], alpha);
        }
        for (const v of [minV, maxV]) for (let i = 0; i < col; i++) {
          const u0 = i / col, u1 = (i + 1) / col, mitad = cap && arcano ? (i < col / 2 ? -1 : 1) : 0;
          quad([superficie(u0, v, -1, cap, mitad), superficie(u1, v, -1, cap, mitad), superficie(u1, v, 1, cap, mitad), superficie(u0, v, 1, cap, mitad)], [[u0 * .5, .019], [u1 * .5, .019], [u1 * .5, .031], [u0 * .5, .031]], alpha);
        }
      }
      if (arcano && f.tear > 0 && f.caer < .2 && !apertura?.reducida) {
        const energia = Math.sin(f.tear * Math.PI) * .6;
        for (let i = 0; i < col; i++) {
          const u0 = i / col, u1 = (i + 1) / col;
          for (const r of [.017, .003]) {
            const y0 = -1.187 + zigzag(u0), y1 = -1.187 + zigzag(u1);
            quad([[u0 * 2 - 1, y0 - r, .115], [u1 * 2 - 1, y1 - r, .115], [u1 * 2 - 1, y1 + r, .115], [u0 * 2 - 1, y0 + r, .115]], [[0, 0], [1, 0], [1, 1], [0, 1]], energia * (r > .01 ? .13 : 1), null, 1);
          }
        }
      }
      // Fragmentos pequeños de foil: su luz sale del propio material del sello.
      if (f.tear > .07 && f.caer < .95 && !apertura?.reducida) {
        const cant = arcano ? 12 : 8, vida = acotar((f.tear - .1) / .9 + f.caer * .6);
        for (let i = 0; i < cant; i++) {
          const sem = i * 1.618, x0 = Math.sin(sem * 13) * .95;
          const x = x0 + Math.sin(sem * 8) * vida * .45;
          const y = -1.18 - Math.abs(Math.cos(sem * 5)) * vida * .8 + vida * vida * 1.1;
          const z = .15 + Math.cos(sem * 2) * vida * .3, r = (arcano ? .009 : .015) * (1 - vida * .45);
          const a = vida * 8 + sem, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
          triangulo([[x - dx, y - dy, z], [x + dy, y - dx, z + r], [x + dx, y + dy, z]], [[.02, .022], [.025, .026], [.022, .035]], 0, (1 - suave(vida)) * .9);
        }
      }
      return datos;
    }

    // En reposo el sobre flota y se mece despacio, para que el foil y el holo
    // jueguen con la luz sin tocarlo. Sólo con WebGL: en Canvas2D cuesta mucho.
    let vistoYaw = yaw, vistoPitch = pitch;
    function dibujar(ahora) {
      raf = 0; if (!vivo) return;
      const f = fases(ahora), reposo = !apertura && !abierto && !reducir() && pintor.gl;
      let y = f.yaw, p = f.pitch;
      if (reposo) { const t = ahora / 1000; y += Math.sin(t * .55) * .16; p += Math.sin(t * .42 + 1) * .05; }
      vistoYaw = y; vistoPitch = p;
      pintor.dibujar(abierto ? [] : datosMalla(f), { yaw: y, pitch: p, ancho, alto, escala, arcano, tiempo: ahora / 1000 });
      if ((apertura || reposo) && !document.hidden) raf = requestAnimationFrame(dibujar);
    }
    function solicitar() { if (vivo && !raf && !document.hidden) raf = requestAnimationFrame(dibujar); }
    function terminar() {
      if (!apertura) return;
      avisarRotura();
      clearTimeout(timer); clearTimeout(timerRotura); timer = 0; timerRotura = 0; apertura = null; abierto = true; vista = 'abierto';
      if (raf) cancelAnimationFrame(raf); raf = 0;
      if (vivo) pintor.dibujar([], { yaw: 0, pitch: 0, ancho, alto, escala, arcano });
      const fin = resolver; resolver = null; if (fin) fin();
    }
    function avisarRotura() {
      if (!vivo || !apertura || apertura.avisada) return;
      apertura.avisada = true;
      if (typeof opciones.alRomper === 'function') opciones.alRomper();
    }
    function abrir() {
      if (!vivo || abierto) return Promise.resolve();
      if (apertura) return apertura.promesa;
      const promesa = new Promise(r => { resolver = r; });
      apertura = { promesa, yaw: Math.atan2(Math.sin(vistoYaw), Math.cos(vistoYaw)), pitch: vistoPitch, reducida: reducir() };
      vista = 'abriendo'; inicio = performance.now();
      if (apertura.reducida) avisarRotura(); else timerRotura = setTimeout(avisarRotura, 270);
      timer = setTimeout(terminar, apertura.reducida ? 190 : tiempoApertura);
      if (document.hidden) terminar(); else solicitar();
      return promesa;
    }
    function visibilidad() {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; if (apertura) terminar(); }
      else solicitar();
    }
    function movimiento() { if (reducir() && apertura) terminar(); else solicitar(); }
    function perdida(evento) {
      evento.preventDefault(); if (!vivo) return;
      // Al recuperar memoria, Safari puede invalidar WebGL a mitad del gesto.
      // Continuamos con la misma geometría, orientación y reloj sobre Canvas2D.
      const siguiente = lienzo(canvas.width, canvas.height), alternativo = pintorCanvas(siguiente, mat);
      if (!alternativo) { if (apertura) terminar(); return; }
      prepararCanvas(siguiente); canvas.removeEventListener('webglcontextlost', perdida);
      canvas.replaceWith(siguiente); canvas = siguiente;
      const anterior = pintor; pintor = alternativo; anterior.destruir(); solicitar();
    }
    document.addEventListener('visibilitychange', visibilidad);
    if (consulta && consulta.addEventListener) consulta.addEventListener('change', movimiento);
    canvas.addEventListener('webglcontextlost', perdida);
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionar) : null;
    if (observador) observador.observe(contenedor); else window.addEventListener('resize', redimensionar);
    redimensionar();
    return {
      orientar(nuevoYaw, nuevoPitch) {
        if (!vivo || apertura || abierto) return;
        if (Number.isFinite(nuevoYaw)) yaw = nuevoYaw;
        if (Number.isFinite(nuevoPitch)) pitch = acotar(nuevoPitch, -.55, .55);
        solicitar();
      },
      abrir, rectangulo, redimensionar, tiempoApertura,
      get estado() { return vista; },
      destruir() {
        if (!vivo) return; vivo = false;
        if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); clearTimeout(timerRotura); timer = 0; timerRotura = 0;
        document.removeEventListener('visibilitychange', visibilidad);
        if (consulta && consulta.removeEventListener) consulta.removeEventListener('change', movimiento);
        if (observador) observador.disconnect(); else window.removeEventListener('resize', redimensionar);
        canvas.removeEventListener('webglcontextlost', perdida); recursos.cancelar();
        const fin = resolver; resolver = null; apertura = null; if (fin) fin();
        pintor.destruir(); canvas.remove(); mat = null; vista = 'destruido';
      }
    };
  }
  // La biblioteca usa la misma impresión que el objeto 3D. Sólo pinta al
  // montar y al cargar el logo: no abre contextos WebGL ni anima fuera de uso.
  function previsualizar(contenedor, opciones = {}) {
    if (!contenedor || !contenedor.appendChild) throw new TypeError('El sobre necesita un contenedor.');
    const variante = opciones.variante === 'arcano' ? 'arcano' : 'reliquia';
    const grupo = grupoValido(opciones.grupo), canvas = lienzo(512, 768), g = canvas.getContext('2d');
    if (!g) throw new Error('Este navegador no puede dibujar el sobre.');
    canvas.className = 'sobresVistaLienzo'; canvas.setAttribute('aria-hidden', 'true');
    if (grupo) canvas.dataset.grupo = grupo;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    let vivo = true;
    function pintar(logo, arte) {
      if (!vivo) return;
      const mat = material(variante, logo, grupo, arte, true);
      g.drawImage(mat.atlas, 0, 0, mat.atlas.width, mat.atlas.height, 0, 0, 512, 768);
    }
    pintar(null, null); contenedor.appendChild(canvas);
    const recursos = cargarRecursos(opciones, grupo, variante);
    // El repintado con portada y tipografías espera un rato libre: con varios
    // sobres en la biblioteca no debe coincidir con un toque.
    recursos.listos.then(r => (window.requestIdleCallback || setTimeout)(() => pintar(r.logo, r.arte), { timeout: 400 }));
    return { destruir() { vivo = false; recursos.cancelar(); canvas.remove(); } };
  }
  // Logo, ilustración de portada y tipografías: se espera a los tres (o a que
  // fallen) y se pinta una sola vez más. Sin ellos el sobre ya se ve entero.
  function cargarRecursos(opciones, grupo, variante) {
    let vivo = true;
    const imagen = url => new Promise(r => {
      if (!url) { r(null); return; }
      const i = new Image(); i.decoding = 'async';
      i.onload = () => r(i.naturalWidth ? i : null); i.onerror = () => r(null); i.src = url;
    });
    const id = portadas[grupo] || (variante === 'arcano' ? null : 'magodomo');
    const arteUrl = id ? (typeof opciones.arteUrl === 'function' ? opciones.arteUrl(id) : 'art/' + id + '.webp') : null;
    const fuentes = window.CAOZ_CARTA_PINTOR?.fuentes?.() || (document.fonts?.load ? Promise.all([document.fonts.load("700 30px 'Cinzel Domo'"), document.fonts.load("600 12px 'Cinzel Domo'")]).catch(() => {}) : null);
    const listos = Promise.all([imagen(opciones.logoUrl || 'art/logo.webp'), imagen(arteUrl), Promise.resolve(fuentes).catch(() => {})])
      .then(([logo, arte]) => new Promise((r, no) => vivo ? r({ logo, arte }) : no()));
    listos.catch(() => {});
    return { listos: listos.catch(() => new Promise(() => {})), cancelar() { vivo = false; } };
  }
  window.CAOZ_SOBRES_ESCENA = Object.freeze({ crear, previsualizar });
})();

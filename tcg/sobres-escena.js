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

  // Dos caras en un atlas; el segundo atlas indica qué tinta es metal reflectante.
  function material(variante, logo) {
    const arcano = variante === 'arcano', p = paletas[variante];
    const w = 512, h = 768, atlas = lienzo(w * 2, h), metal = lienzo(w * 2, h);
    const g = atlas.getContext('2d'), m = metal.getContext('2d');
    let semilla = arcano ? 93 : 47;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    for (let lado = 0; lado < 2; lado++) {
      g.save(); m.save(); g.translate(w * lado, 0); m.translate(w * lado, 0);
      const fondo = g.createLinearGradient(0, 0, w, h);
      fondo.addColorStop(0, p.oscuro); fondo.addColorStop(.32, p.medio);
      fondo.addColorStop(.55, p.claro); fondo.addColorStop(.76, p.medio); fondo.addColorStop(1, p.oscuro);
      g.fillStyle = fondo; g.fillRect(0, 0, w, h);
      m.fillStyle = arcano ? '#666' : '#484848'; m.fillRect(0, 0, w, h);
      // Pliegues laminados largos, discretos: no atraviesan la marca del centro.
      for (let i = 0; i < 32; i++) {
        const x = azar() < .5 ? azar() * 70 : w - azar() * 70;
        const trama = g.createLinearGradient(x - 9, 0, x + 9, 0);
        trama.addColorStop(0, '#ffffff00'); trama.addColorStop(.5, '#fff5de13'); trama.addColorStop(.58, '#10081232'); trama.addColorStop(1, '#10081200');
        g.fillStyle = trama; g.beginPath(); g.moveTo(x - 9, 46); g.quadraticCurveTo(x + (azar() - .5) * 40, h / 2, x - 9, h - 44);
        g.lineTo(x + 9, h - 44); g.quadraticCurveTo(x + 12, h / 2, x + 9, 46); g.fill();
      }
      // Grano de impresión y leves marcas de cepillado, deterministas por edición.
      for (let i = 0; i < 8500; i++) {
        g.fillStyle = azar() > .52 ? '#fff0e00c' : '#0503100c';
        g.fillRect(azar() * w, azar() * h, azar() * 1.2 + .4, .6);
      }
      g.strokeStyle = arcano ? '#b9bdd90a' : '#f8c1840b'; g.lineWidth = .65;
      for (let y = 98; y < h - 70; y += 28) {
        g.beginPath(); g.moveTo(25, y); g.lineTo(w - 25, y - 120); g.stroke();
      }
      // Costuras de sellado: canales independientes con sus crestas iluminadas.
      for (const yy of [0, h - 45]) {
        const sellado = g.createLinearGradient(0, yy, 0, yy + 45);
        sellado.addColorStop(0, p.oscuro); sellado.addColorStop(.16, p.detalle);
        sellado.addColorStop(.24, p.oscuro); sellado.addColorStop(.85, p.medio); sellado.addColorStop(1, p.oscuro);
        g.fillStyle = sellado; g.fillRect(0, yy, w, 45);
        m.fillStyle = '#ddd'; m.fillRect(0, yy, w, 45);
        for (let x = 4; x < w; x += 5) {
          g.fillStyle = '#fff4d523'; g.fillRect(x, yy + 4, 1, 36);
          g.fillStyle = '#03020855'; g.fillRect(x + 1.5, yy + 4, 1, 36);
        }
      }
      for (const x of [6, 12, w - 13, w - 7]) {
        g.strokeStyle = '#ffedc336'; g.lineWidth = .6; g.beginPath(); g.moveTo(x, 44); g.lineTo(x, h - 44); g.stroke();
      }
      const tinta = g.createLinearGradient(40, 100, w - 40, h - 100);
      if (arcano) {
        tinta.addColorStop(0, '#98b8b6'); tinta.addColorStop(.28, '#bfa2c8');
        tinta.addColorStop(.48, '#e1ded9'); tinta.addColorStop(.7, '#7993b9'); tinta.addColorStop(1, '#afa0c5');
      } else {
        tinta.addColorStop(0, '#9f733d'); tinta.addColorStop(.32, '#f9dea0');
        tinta.addColorStop(.57, '#c69d5a'); tinta.addColorStop(.78, '#f5db9c'); tinta.addColorStop(1, '#986934');
      }
      function estampado(dibujar) {
        g.save(); m.save(); g.strokeStyle = tinta; g.fillStyle = tinta;
        m.strokeStyle = '#fff'; m.fillStyle = '#fff'; dibujar(g, tinta); dibujar(m, '#fff'); g.restore(); m.restore();
      }
      estampado((c, color) => {
        c.lineWidth = .85; c.strokeRect(24, 60, w - 48, h - 120); c.strokeRect(29, 65, w - 58, h - 130);
        for (const x of [37, w - 37]) for (const y of [73, h - 73]) { rombo(c, x, y, 7); }
        if (arcano) {
          c.globalAlpha = .38;
          for (let i = 0; i < 4; i++) {
            c.beginPath(); c.moveTo(30, 140 + i * 37); c.lineTo(140 + i * 30, 65); c.stroke();
            c.beginPath(); c.moveTo(w - 30, h - 140 - i * 37); c.lineTo(w - 140 - i * 30, h - 65); c.stroke();
          }
        } else {
          c.globalAlpha = .36;
          for (const s of [-1, 1]) {
            c.beginPath(); c.moveTo(w / 2 + s * 191, 310); c.bezierCurveTo(w / 2 + s * 65, 250, w / 2 + s * 208, 90, w / 2 + s * 140, 80); c.stroke();
            c.beginPath(); c.moveTo(w / 2 + s * 191, 490); c.bezierCurveTo(w / 2 + s * 80, 540, w / 2 + s * 180, 650, w / 2 + s * 105, 683); c.stroke();
          }
        }
        c.globalAlpha = 1;
        letras(c, lado ? 'CAOZ CON TODO' : 'EL JUEGO DE CARTAS', w / 2, 112, 3.6, '12px Georgia,serif', color);
      });
      if (logo && logo.naturalWidth) {
        const lw = lado ? 210 : 418, lh = lw * logo.naturalHeight / logo.naturalWidth;
        const ly = lado ? 152 : 155;
        g.save(); g.shadowColor = '#000b'; g.shadowBlur = 10; g.shadowOffsetY = 7;
        g.drawImage(logo, (w - lw) / 2, ly, lw, lh); g.restore();
        // La marca conserva su color y no se convierte en un reflejo blanco.
        const mascara = lienzo(Math.ceil(lw), Math.ceil(lh)), mc = mascara.getContext('2d');
        mc.drawImage(logo, 0, 0, lw, lh); mc.globalCompositeOperation = 'source-in'; mc.fillStyle = '#202020'; mc.fillRect(0, 0, lw, lh);
        m.drawImage(mascara, (w - lw) / 2, ly);
      } else {
        letras(g, 'CAOZ', w / 2, lado ? 235 : 285, 7, 'bold 72px Georgia,serif', tinta);
        letras(g, 'CON TODO', w / 2, lado ? 261 : 319, 5, '18px Georgia,serif', p.tinta);
      }
      estampado((c, color) => {
        if (!lado) {
          sello(c, w / 2, 480, 64, arcano);
          c.lineWidth = .8;
          for (const s of [-1, 1]) {
            c.beginPath(); c.moveTo(w / 2 + s * 83, 480); c.lineTo(w / 2 + s * 159, 480); c.stroke();
            rombo(c, w / 2 + s * 173, 480, 4);
          }
          letras(c, arcano ? 'ARCANO' : 'RELIQUIA', w / 2, 605, arcano ? 10 : 7.2, '27px Georgia,serif', color);
          letras(c, 'C I N C O   C A R T A S', w / 2, 642, .5, '10px Arial,sans-serif', color);
          letras(c, 'EDICIÓN DEL DOMO', w / 2, 673, 2.8, '9px Arial,sans-serif', color);
        } else {
          sello(c, w / 2, 349, 48, arcano);
          letras(c, 'EL DOMO TE ESPERA', w / 2, 461, 3.2, '17px Georgia,serif', color);
          letras(c, 'CINCO CARTAS · INFINITAS HISTORIAS', w / 2, 496, 1.05, '9px Arial,sans-serif', color);
          c.lineWidth = .7; c.beginPath(); c.moveTo(96, 529); c.lineTo(w - 96, 529); c.stroke();
          letras(c, 'CAOZCONTODO.COM', w / 2, 646, 2.9, '10px Arial,sans-serif', color);
          letras(c, arcano ? 'ARCANO / 01' : 'RELIQUIA / 01', w / 2, 671, 2.4, '9px Arial,sans-serif', color);
        }
      });
      if (lado) {
        // Soldadura central del reverso con sombra propia y doble ribete.
        const pliegue = g.createLinearGradient(239, 0, 273, 0);
        pliegue.addColorStop(0, '#0000'); pliegue.addColorStop(.45, '#0002'); pliegue.addColorStop(.49, '#fff1'); pliegue.addColorStop(.57, '#0004'); pliegue.addColorStop(1, '#0000');
        g.fillStyle = pliegue; g.fillRect(239, 48, 34, h - 96);
        g.fillStyle = p.tinta;
        let x = 202;
        for (let i = 0; i < 38; i++) { const ancho = 1 + (i * 7 % 3); if (i % 3) g.fillRect(x, 561, ancho, 33); x += ancho + 1; }
        letras(g, 'C C T   /   0 0 5', w / 2, 610, 1, '8px Arial,sans-serif', p.tinta);
      }
      g.restore(); m.restore();
    }
    return { atlas, metal };
  }

  const vertex = `
    attribute vec3 aPosicion; attribute vec3 aNormal; attribute vec2 aUV;
    attribute float aTipo; attribute float aAlpha;
    uniform vec2 uAngulo; uniform vec2 uResolucion; uniform float uEscala;
    varying vec3 vNormal; varying vec3 vPosicion; varying vec2 vUV;
    varying float vTipo; varying float vAlpha;
    void main(){
      float cy=cos(uAngulo.x),sy=sin(uAngulo.x),cp=cos(uAngulo.y),sp=sin(uAngulo.y);
      mat3 ry=mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy);
      mat3 rx=mat3(1.,0.,0.,0.,cp,sp,0.,-sp,cp);
      mat3 giro=rx*ry;
      vec3 p=aTipo>1.5?aPosicion:giro*aPosicion;
      vPosicion=p;vNormal=giro*aNormal;vUV=aUV;vTipo=aTipo;vAlpha=aAlpha;
      float d=7.-p.z;
      gl_Position=vec4(p.x*uEscala*2./uResolucion.x,-p.y*uEscala*2./uResolucion.y,1.105263*d-2.105263,d);
    }`;
  const fragment = `
    precision mediump float;
    uniform sampler2D uColor; uniform sampler2D uMetal; uniform float uArcano;
    varying vec3 vNormal; varying vec3 vPosicion; varying vec2 vUV;
    varying float vTipo; varying float vAlpha;
    void main(){
      if(vTipo>1.5){
        vec2 q=(vUV-.5)*2.;float d=dot(q,q);
        gl_FragColor=vec4(.008,.004,.012,exp(-d*4.)*.36*vAlpha);return;
      }
      if(vTipo>.5){gl_FragColor=vec4(.57,.75,.91,vAlpha);return;}
      vec3 n=normalize(vNormal),view=normalize(vec3(0.,0.,7.)-vPosicion);
      vec3 luz=normalize(vec3(-.5,-.65,1.));
      vec3 base=texture2D(uColor,vUV).rgb;
      float metal=texture2D(uMetal,vUV).r;
      float dif=max(0.,dot(n,luz));
      float espec=pow(max(0.,dot(n,normalize(luz+view))),36.);
      vec3 reflejo=reflect(-view,n);
      float banda=pow(max(0.,1.-abs(reflejo.x*.72+reflejo.y*.19-.13)),24.);
      float filo=pow(1.-max(0.,dot(n,view)),3.);
      vec3 oro=vec3(1.,.81,.47),plata=vec3(.76,.85,1.);
      float fase=reflejo.x*4.2+reflejo.y*2.8;
      vec3 iris=.58+.42*cos(vec3(0.,2.1,4.2)+fase);
      vec3 brillo=mix(oro,mix(plata,iris,.46),uArcano);
      vec3 color=base*(.72+.37*dif)+brillo*(banda*.19+espec*.3)*metal;
      color+=brillo*filo*.13*metal;
      gl_FragColor=vec4(color,vAlpha);
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
    for (const n of ['uAngulo', 'uResolucion', 'uEscala', 'uArcano', 'uColor', 'uMetal']) uniformes[n] = gl.getUniformLocation(programa, n);
    const texturas = [];
    for (const [i, c] of [mat.atlas, mat.metal].entries()) {
      const t = gl.createTexture(); objetos.push(['texture', t]); texturas.push(t);
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    }
    gl.uniform1i(uniformes.uColor, 0); gl.uniform1i(uniformes.uMetal, 1);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return {
      actualizar(m) {
        [m.atlas, m.metal].forEach((c, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texturas[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); });
      },
      dibujar(datos, op) {
        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(uniformes.uAngulo, op.yaw, op.pitch); gl.uniform2f(uniformes.uResolucion, op.ancho, op.alto);
        gl.uniform1f(uniformes.uEscala, op.escala); gl.uniform1f(uniformes.uArcano, op.arcano ? 1 : 0);
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
    const consulta = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reducir = () => opciones.reducirMovimiento === true || !!(consulta && consulta.matches);
    let canvas = lienzo(1, 1), mat = material(variante, null), pintor;
    try { pintor = pintorGL(canvas, mat); } catch (_) { pintor = null; }
    if (!pintor) { canvas = lienzo(1, 1); pintor = pintorCanvas(canvas, mat); }
    if (!pintor) throw new Error('Este navegador no puede dibujar el sobre.');
    function prepararCanvas(c) {
      c.className = 'sobresEscenaLienzo'; c.setAttribute('aria-hidden', 'true');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    }
    prepararCanvas(canvas);
    contenedor.appendChild(canvas);
    let ancho = 1, alto = 1, escala = 1, packW = 1, packH = 1;
    let vivo = true, raf = 0, timer = 0, timerRotura = 0, yaw = -.14, pitch = .06, inicio = 0;
    let apertura = null, resolver = null, abierto = false, vista = 'cerrado';
    const tiempoApertura = arcano ? 1540 : 1720;
    const logo = new Image();
    logo.onload = () => { if (!vivo) return; mat = material(variante, logo); pintor.actualizar(mat); solicitar(); };
    logo.onerror = () => {}; logo.src = opciones.logoUrl || 'art/logo.webp';

    function rectangulo() { return { x: (ancho - packW) / 2, y: (alto - packH) / 2, width: packW, height: packH }; }

    function redimensionar() {
      if (!vivo) return;
      ancho = Math.max(1, contenedor.clientWidth); alto = Math.max(1, contenedor.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(ancho * dpr)); canvas.height = Math.max(1, Math.round(alto * dpr));
      packH = Math.min(alto * .76, 420, ancho * .78 * 1.5); packW = packH / 1.5;
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

    function dibujar(ahora) {
      raf = 0; if (!vivo) return;
      const f = fases(ahora);
      pintor.dibujar(abierto ? [] : datosMalla(f), { yaw: f.yaw, pitch: f.pitch, ancho, alto, escala, arcano });
      if (apertura && !document.hidden) raf = requestAnimationFrame(dibujar);
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
      apertura = { promesa, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), pitch, reducida: reducir() };
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
        canvas.removeEventListener('webglcontextlost', perdida); logo.onload = null; logo.onerror = null;
        const fin = resolver; resolver = null; apertura = null; if (fin) fin();
        pintor.destruir(); canvas.remove(); mat = null; vista = 'destruido';
      }
    };
  }
  window.CAOZ_SOBRES_ESCENA = Object.freeze({ crear });
})();

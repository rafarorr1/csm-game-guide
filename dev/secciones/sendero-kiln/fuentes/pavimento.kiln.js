/* Caoz · camino antiguo de Tomsage. Fuente procedural editable para Kiln 1.1.
 * generar.mjs cambia únicamente MODULO y conserva cada fuente evaluada.
 * Las piedras usan 26 caras biseladas y 44 triángulos; el hito subdivide su frente
 * para tallar los surcos. UV de aproximadamente una repetición por metro.
 * La textura definitiva es la roca local del bosque, aplicada por el visor.
 */
const MODULO = 'pavimento';
const meta = { name: 'Caoz · sendero ' + MODULO, description: 'Piedra antigua irregular, superficie pisable baja y hitos tallados; piezas nombradas.' };

function build() {
  const dimensiones = { pavimento: [2.4, .06, 1.8], borde: [2, .24, .40], hito: [.55, .95, .40] }[MODULO];
  if (!dimensiones) throw new Error('Módulo desconocido: ' + MODULO);
  let estado = { pavimento: 78101, borde: 35113, hito: 92801 }[MODULO];
  function azar() { estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0; return estado / 4294967296; }
  const raiz = createRoot('Caoz_Sendero_' + MODULO);
  const material = gameMaterial(0xffffff, { roughness: .94, metalness: 0, flatShading: false });
  material.name = 'Caoz_Piedra_Compartida';
  material.vertexColors = true;
  let piezas = 0;

  // Geometría cerrada de caja biselada: seis caras, doce cantos y ocho esquinas.
  // Cada esquina comparte una pequeña deformación: no abre grietas en la malla.
  function piedra(nombre, ancho, alto, fondo, x, y, z, giro = 0, surcos = false) {
    const h = [ancho / 2, alto / 2, fondo / 2];
    const bisel = Math.min(alto * .19, fondo * .15, .032 + azar() * .018);
    const puntos = new Map();
    const tintes = [.79 + azar() * .17, .79 + azar() * .15, .74 + azar() * .15];
    const semillasUv = [azar() * 5, azar() * 5];
    const vertices = [], indices = [], uv = [], color = [];
    function clave(s, eje) { return s.join(',') + ':' + eje; }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = [sx, sy, sz];
      const ruido = MODULO === 'pavimento' ? [(azar() - .5) * .065, (azar() - .5) * .002, (azar() - .5) * .052] : [(azar() - .5) * .029, (azar() - .5) * .022, (azar() - .5) * .021];
      if (MODULO === 'pavimento') {
        if (nombre.startsWith('astilla') && sz > 0) {
          ruido[0] -= sx * ancho * .20;
          ruido[2] += sx * fondo * .07;
        } else if (nombre.endsWith('corte') && sx > 0 && sz < 0) {
          ruido[0] -= ancho * .16;
          ruido[2] += fondo * .18;
        }
      }
      if (surcos && sy > 0) ruido[1] -= sx > 0 ? (sz > 0 ? .095 : .03) : (sz > 0 ? 0 : .045);
      for (let eje = 0; eje < 3; eje++) {
        const p = s.map((signo, a) => signo * (h[a] - (a === eje ? 0 : bisel)) + ruido[a]);
        puntos.set(clave(s, eje), p);
      }
    }
    function cara(llaves, normalEsperada) {
      let ps = llaves.map(k => puntos.get(k));
      const centro = new THREE.Vector3();
      for (const p of ps) centro.add(new THREE.Vector3(...p));
      centro.multiplyScalar(1 / ps.length);
      const normal = new THREE.Vector3(...normalEsperada).normalize();
      const u = new THREE.Vector3(Math.abs(normal.y) > .8 ? 1 : 0, Math.abs(normal.y) > .8 ? 0 : 1, 0).cross(normal).normalize();
      const v = normal.clone().cross(u);
      ps.sort((a, b) => {
        const aa = new THREE.Vector3(...a).sub(centro), bb = new THREE.Vector3(...b).sub(centro);
        return Math.atan2(aa.dot(v), aa.dot(u)) - Math.atan2(bb.dot(v), bb.dot(u));
      });
      const orientacion = new THREE.Vector3(...ps[1]).sub(new THREE.Vector3(...ps[0])).cross(new THREE.Vector3(...ps[2]).sub(new THREE.Vector3(...ps[0])));
      if (orientacion.dot(normal) < 0) ps.reverse();
      const inicio = vertices.length / 3;
      const dominante = Math.abs(normal.y) > .6 ? 1 : Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2;
      function vertice(p, corte = 0) {
        const indice = vertices.length / 3;
        vertices.push(...p);
        // Cada cara proyecta a escala métrica. Las juntas disimulan los cambios de plano.
        uv.push((dominante === 0 ? p[2] : p[0]) + semillasUv[0], (dominante === 1 ? p[2] : p[1]) + semillasUv[1]);
        const costra = Math.max(0, normal.y) * (.08 + azar() * .12);
        const musgo = [.50, .65, .37];
        for (let c = 0; c < 3; c++) color.push((tintes[c] * (1 - costra) + musgo[c] * costra) * (1 - corte * .22));
        return indice;
      }
      if (surcos && normal.z > .99) {
        // Un bajorrelieve real: la superficie baja 12 mm en dos marcas y su eje.
        // La banda exterior mantiene sólo sus cuatro esquinas, evitando T-junctions.
        const nx = 12, ny = 16, interior = [];
        const segmentos = [
          [[.5, .20], [.5, .79]],
          [[.24, .49], [.5, .67]], [[.5, .67], [.76, .49]],
          [[.29, .27], [.5, .42]], [[.5, .42], [.71, .27]],
        ];
        function distancia(u, v, a, b) {
          const x = b[0] - a[0], y = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((u - a[0]) * x + (v - a[1]) * y) / (x * x + y * y)));
          return Math.hypot(u - a[0] - x * t, v - a[1] - y * t);
        }
        const esquinas = ps.map(p => vertice(p));
        for (let j = 1; j < ny; j++) {
          interior[j] = [];
          for (let i = 1; i < nx; i++) {
            const u = i / nx, v = j / ny;
            const p = [0, 1, 2].map(c => ps[0][c] * (1-u) * (1-v) + ps[1][c] * u * (1-v) + ps[2][c] * u * v + ps[3][c] * (1-u) * v);
            const d = Math.min(...segmentos.map(s => distancia(u, v, s[0], s[1])));
            const corte = Math.exp(-Math.pow(d / .034, 2));
            p[2] -= .012 * corte;
            interior[j][i] = vertice(p, corte);
          }
        }
        for (let j = 1; j < ny-1; j++) for (let i = 1; i < nx-1; i++) {
          const a = interior[j][i], b = interior[j][i+1], c = interior[j+1][i+1], d = interior[j+1][i];
          indices.push(a, b, c, a, c, d);
        }
        function abanico(ids) { for (let i = 1; i < ids.length-1; i++) indices.push(ids[0], ids[i], ids[i+1]); }
        abanico([esquinas[0], esquinas[1], ...interior[1].slice(1).reverse()]);
        abanico([esquinas[1], esquinas[2], ...Array.from({length: ny-1}, (_, j) => interior[ny-1-j][nx-1])]);
        abanico([esquinas[2], esquinas[3], ...interior[ny-1].slice(1)]);
        abanico([esquinas[3], esquinas[0], ...Array.from({length: ny-1}, (_, j) => interior[j+1][1])]);
        return;
      }
      for (const p of ps) vertice(p);
      for (let i = 1; i < ps.length - 1; i++) indices.push(inicio, inicio + i, inicio + i + 1);
    }
    for (let eje = 0; eje < 3; eje++) for (const signo of [-1, 1]) {
      const otros = [0, 1, 2].filter(a => a !== eje), ks = [];
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const s = [0, 0, 0]; s[eje] = signo; s[otros[0]] = sa; s[otros[1]] = sb;
        ks.push(clave(s, eje));
      }
      const n = [0, 0, 0]; n[eje] = signo; cara(ks, n);
    }
    for (let libre = 0; libre < 3; libre++) {
      const fijos = [0, 1, 2].filter(a => a !== libre);
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const ks = [], n = [0, 0, 0]; n[fijos[0]] = sa; n[fijos[1]] = sb;
        for (const sl of [-1, 1]) for (const eje of fijos) {
          const s = [0, 0, 0]; s[libre] = sl; s[fijos[0]] = sa; s[fijos[1]] = sb;
          ks.push(clave(s, eje));
        }
        cara(ks, n);
      }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = [sx, sy, sz]; cara([0, 1, 2].map(a => clave(s, a)), s);
    }
    const geometria = meshGeo({ positions: vertices, indices, uvs: uv });
    geometria.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    const diagnostico = geometryDiagnostics(geometria);
    for (const dato of ['boundaryEdges', 'nonManifoldEdges', 'orientationConflicts', 'degenerateTriangles', 'invalidIndices', 'nonFiniteVertices']) {
      if (diagnostico[dato] !== 0) throw new Error(nombre + ': ' + dato + '=' + diagnostico[dato]);
    }
    const malla = new THREE.Mesh(geometria, material);
    malla.name = 'Piedra_' + String(++piezas).padStart(2, '0') + '_' + nombre;
    malla.position.set(x, y + alto / 2, z);
    malla.rotation.y = giro + (azar() - .5) * .032;
    raiz.add(malla);
  }
  if (MODULO === 'pavimento') {
    // Fragmento de una calzada: ocho losas en hiladas incompletas y cuatro
    // astillas sueltas. Los extremos se estrechan; ninguna esquina cierra una caja.
    // [nombre, ancho, fondo, x, z, giro, fragmento]
    const losas = [
      ['punta_oeste_corte', .49, .37, -.84, -.06, -.095, false],
      ['eje_oeste', .51, .54, -.29, .025, .035, false],
      ['eje_este_corte', .54, .46, .275, -.035, -.025, false],
      ['punta_este_corte', .45, .31, .79, -.075, .10, false],
      ['hilada_fondo_oeste_corte', .42, .43, -.38, -.50, -.06, false],
      ['hilada_fondo_este', .53, .48, .17, -.555, .045, false],
      ['hilada_frente_oeste', .34, .36, -.43, .485, -.09, false],
      ['hilada_frente_este_corte', .43, .45, .055, .49, .06, false],
      ['astilla_oeste', .17, .20, -1.14, .10, .31, true],
      ['astilla_este', .20, .14, .99, .33, -.27, true],
      ['astilla_fondo', .19, .12, -.095, -.90, -.23, true],
      ['astilla_frente', .15, .18, -.45, .80, .38, true],
    ];
    for (const [nombre, ancho, fondo, x, z, giro, fragmento] of losas) {
      const alto = fragmento ? .0475 + azar() * .0025 : .052 + azar() * .006;
      piedra(nombre, ancho, alto, fondo, x, 0, z, giro);
    }
  } else if (MODULO === 'borde') {
    const anchos = [.28, .33, .265, .305, .36, .32]; let x = -1;
    for (let i = 0; i < anchos.length; i++) {
      const ancho = anchos[i], alto = [.21, .225, .185, .22, .205, .23][i];
      piedra('guardacanto_' + i, ancho, alto, .31 + azar() * .045, x + ancho / 2, 0, (azar() - .5) * .033, (azar() - .5) * .052);
      x += ancho + .018;
    }
    piedra('fragmento_desprendido', .16, .067, .15, .17, 0, .135, -.21);
  } else {
    piedra('peana_desgastada', .54, .155, .39, 0, 0, 0, -.035);
    piedra('monolito_tallado', .435, .82, .305, -.013, .135, -.015, .018, true);
    piedra('laja_al_pie', .20, .075, .145, .13, .015, .128, -.21);
  }
  // Medidas de entrega, base Y=0 y centro XZ=0. Las piezas conservan sus nombres.
  raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(raiz, true), tamano = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
  raiz.scale.set(dimensiones[0] / tamano.x, dimensiones[1] / tamano.y, dimensiones[2] / tamano.z);
  raiz.position.set(-centro.x * raiz.scale.x, -caja.min.y * raiz.scale.y, -centro.z * raiz.scale.z);
  if (countTriangles(raiz) > { pavimento: 700, borde: 500, hito: 650 }[MODULO] || countMaterials(raiz) !== 1) throw new Error('Presupuesto excedido');
  return raiz;
}

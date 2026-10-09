/* Caoz · ruinas de Tomsage. Fuente procedural editable para Kiln 1.1.
 * generar.mjs cambia únicamente MODULO y conserva cada fuente evaluada.
 * La piedra usa 26 caras biseladas, 44 triángulos y UV de aproximadamente 1 m.
 * La textura definitiva es la roca local del bosque, aplicada por el visor.
 */
const MODULO = 'remate';
const meta = { name: 'Caoz · ruina ' + MODULO, description: 'Piedra erosionada, hiladas quebradas y musgo sutil; módulo estático con piezas nombradas.' };

function build() {
  const dimensiones = { recto: [2, .86, .42], esquina: [2, .84, 2], remate: [2, .88, .42] }[MODULO];
  if (!dimensiones) throw new Error('Módulo desconocido: ' + MODULO);
  let estado = { recto: 17921, esquina: 81283, remate: 63809 }[MODULO];
  function azar() { estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0; return estado / 4294967296; }
  const raiz = createRoot('Caoz_Ruina_' + MODULO);
  const material = gameMaterial(0xffffff, { roughness: .94, metalness: 0, flatShading: false });
  material.name = 'Caoz_Piedra_Compartida';
  material.vertexColors = true;
  let piezas = 0;

  // Geometría cerrada de caja biselada: seis caras, doce cantos y ocho esquinas.
  // Cada esquina comparte una pequeña deformación: no abre grietas en la malla.
  function piedra(nombre, ancho, alto, fondo, x, y, z, giro = 0) {
    const h = [ancho / 2, alto / 2, fondo / 2];
    const bisel = Math.min(alto * .19, fondo * .15, .032 + azar() * .018);
    const puntos = new Map();
    const tintes = [.79 + azar() * .17, .79 + azar() * .15, .74 + azar() * .15];
    const semillasUv = [azar() * 5, azar() * 5];
    const vertices = [], indices = [], uv = [], color = [];
    function clave(s, eje) { return s.join(',') + ':' + eje; }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = [sx, sy, sz];
      const ruido = [(azar() - .5) * .028, (azar() - .5) * .022, (azar() - .5) * .018];
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
      for (const p of ps) {
        vertices.push(...p);
        // Cada cara proyecta a escala métrica. Las juntas disimulan los cambios de plano.
        uv.push((dominante === 0 ? p[2] : p[0]) + semillasUv[0], (dominante === 1 ? p[2] : p[1]) + semillasUv[1]);
        const costra = Math.max(0, normal.y) * (.08 + azar() * .12);
        const musgo = [.50, .65, .37];
        for (let c = 0; c < 3; c++) color.push(tintes[c] * (1 - costra) + musgo[c] * costra);
      }
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
  function hilada(nombre, anchuras, y, alto, inicio = -1, z = 0, girada = false) {
    let cursor = inicio;
    for (let i = 0; i < anchuras.length; i++) {
      const ancho = anchuras[i], altura = alto * (.96 + azar() * .07);
      const centro = cursor + ancho / 2;
      piedra(nombre + '_' + (i + 1), ancho, altura, .395 + azar() * .019,
        girada ? z : centro, y, girada ? centro : z, girada ? Math.PI / 2 : 0);
      cursor += ancho + .013;
    }
  }
  if (MODULO === 'recto') {
    hilada('base', [.37, .42, .36, .43, .36], 0, .225);
    hilada('media', [.52, .45, .53, .43], .233, .225);
    hilada('coronacion_izquierda', [.37, .46], .466, .235);
    hilada('coronacion_derecha', [.28, .38], .466, .17, .27);
    piedra('rotura_alta', .27, .16, .33, -.71, .707, -.015, -.10);
    piedra('laja_caida_centro', .32, .075, .31, .04, .46, -.015, .09);
    piedra('laja_coronacion', .16, .055, .28, .73, .64, .015, -.11);
  } else if (MODULO === 'esquina') {
    for (let fila = 0; fila < 3; fila++) {
      const y = fila * .235;
      piedra('esquinero_' + fila, .415, .223, .415, -.795, y, -.795, 0);
      const x = fila === 2 ? [.39, .31] : fila === 1 ? [.52, .46, .56] : [.37, .41, .35, .40];
      const z = fila === 2 ? [.44, .34, .30] : fila === 1 ? [.43, .55, .55] : [.43, .36, .39, .36];
      hilada('brazo_x_' + fila, x, y, fila === 2 ? .19 : .223, -.565, -.795);
      hilada('brazo_z_' + fila, z, y, fila === 2 ? .20 : .223, -.565, -.795, true);
    }
    piedra('remate_esquinero', .34, .135, .33, -.795, .709, -.795, -.06);
    piedra('laja_brazo_x', .31, .058, .32, .82, .466, -.805, -.07);
    piedra('laja_brazo_z', .30, .055, .31, -.78, .468, .83, .08);
  } else {
    hilada('base', [.43, .38, .42, .33, .37], 0, .222);
    hilada('segundo_escalon', [.36, .51, .38, .30], .23, .225);
    hilada('tercer_escalon', [.48, .35, .20], .465, .215);
    piedra('remate_superior', .42, .175, .34, -.76, .69, -.01, -.07);
    piedra('laja_segundo', .24, .058, .34, .46, .463, -.008, .06);
    piedra('laja_ultimo', .28, .055, .33, .82, .232, .015, -.04);
    piedra('fractura_superior', .16, .08, .30, -.36, .68, .02, .13);
  }
  // Medidas de entrega, base Y=0 y centro XZ=0. Las piezas conservan sus nombres.
  raiz.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(raiz, true), tamano = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3());
  raiz.scale.set(dimensiones[0] / tamano.x, dimensiones[1] / tamano.y, dimensiones[2] / tamano.z);
  raiz.position.set(-centro.x * raiz.scale.x, -caja.min.y * raiz.scale.y, -centro.z * raiz.scale.z);
  if (countTriangles(raiz) > 1500 || countMaterials(raiz) !== 1) throw new Error('Presupuesto excedido');
  return raiz;
}

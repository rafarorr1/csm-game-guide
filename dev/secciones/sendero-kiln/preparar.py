"""Convierte los tres GLB reales de Kiln a una malla local por módulo.

Uso: python3 preparar.py [carpeta-de-GLB]
Sólo necesita la biblioteca estándar. No ejecuta la fuente Kiln ni genera formas.
Conserva el color exportado, fija transformaciones y registra rangos por pieza.
"""
import array
import base64
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

SALIDA = Path(__file__).resolve().parent
ENTRADA = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else SALIDA / 'glb'
NOMBRES = {'pavimento': 'Adoquines del camino antiguo', 'borde': 'Guarnición de piedra erosionada', 'hito': 'Hito del sendero antiguo'}
DIMENSIONES = {'pavimento': [2.4, .06, 1.8], 'borde': [2, .24, .40], 'hito': [.55, .95, .40]}
PRESUPUESTOS = {'pavimento': 700, 'borde': 500, 'hito': 650}
identidad = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]


def sha(datos):
    return hashlib.sha256(datos).hexdigest()


def producto(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def transformar(n):
    if 'matrix' in n:
        return [[n['matrix'][j * 4 + i] for j in range(4)] for i in range(4)]
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    t, s = n.get('translation', [0, 0, 0]), n.get('scale', [1, 1, 1])
    r = [[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
         [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
         [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]]
    return [[r[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def matriz_normal(m):
    a, b, c = m[0][:3]
    d, e, f = m[1][:3]
    g, h, i = m[2][:3]
    cof = [[e*i-f*h, f*g-d*i, d*h-e*g], [c*h-b*i, a*i-c*g, b*g-a*h], [b*f-c*e, c*d-a*f, a*e-b*d]]
    det = a*cof[0][0] + b*cof[0][1] + c*cof[0][2]
    assert det > 1e-10, 'Transformación singular o reflejada no admitida por este piloto'
    return [[v / det for v in fila] for fila in cof]


def cruz(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def punto(a, b):
    return sum(x*y for x, y in zip(a, b))


def codificar(valores, tipo):
    a = array.array(tipo, valores)
    if sys.byteorder != 'little':
        a.byteswap()
    return base64.b64encode(a.tobytes()).decode('ascii')


def convertir(modulo):
    ruta = ENTRADA / (modulo + '.glb')
    original = ruta.read_bytes()
    magia, version, longitud = struct.unpack_from('<4sII', original)
    assert magia == b'glTF' and version == 2 and longitud == len(original)
    posicion = 12
    partes_glb = {}
    while posicion < len(original):
        largo, tipo = struct.unpack_from('<II', original, posicion)
        partes_glb[tipo] = original[posicion+8:posicion+8+largo]
        posicion += 8 + largo
    assert posicion == len(original)
    doc, binario = json.loads(partes_glb[0x4E4F534A]), partes_glb[0x004E4942]
    assert not doc.get('animations') and not doc.get('skins'), 'Sólo GLB estático'
    assert len(doc['materials']) == 1, 'Se exige exactamente un material'
    assert not doc.get('textures') and not doc.get('images'), 'Los mapas se reutilizan en el visor'
    assert not set(doc.get('extensionsUsed', [])).intersection({'EXT_mesh_gpu_instancing', 'MSFT_lod', 'KHR_draco_mesh_compression', 'EXT_meshopt_compression'}), 'El conversor no implementa esas extensiones'
    factor = doc['materials'][0].get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])

    def atributo(indice):
        a = doc['accessors'][indice]
        assert not a.get('sparse'), 'Accessors dispersos fuera del contrato'
        vista = doc['bufferViews'][a['bufferView']]
        assert vista.get('buffer', 0) == 0
        ancho = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        formato = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
        tam = struct.calcsize('<' + formato)
        offset = vista.get('byteOffset', 0) + a.get('byteOffset', 0)
        paso = vista.get('byteStride', tam * ancho)
        datos = [list(struct.unpack_from('<' + formato * ancho, binario, offset + i * paso)) for i in range(a['count'])]
        if a.get('normalized'):
            divisor = {5121: 255, 5123: 65535}[a['componentType']]
            datos = [[v / divisor for v in fila] for fila in datos]
        assert all(math.isfinite(v) for fila in datos for v in fila)
        return datos

    vertices, normales, uvs, colores, indices, piezas = [], [], [], [], [], []

    def visitar(indice_nodo, padre):
        nodo = doc['nodes'][indice_nodo]
        matriz = producto(padre, transformar(nodo))
        if 'mesh' in nodo:
            assert nodo.get('name', '').startswith('Piedra_'), 'Cada pieza debe conservar un nombre editable'
            normal = matriz_normal(matriz)
            comienzo = len(indices)
            comienzo_vertices = len(vertices)
            for pr in doc['meshes'][nodo['mesh']]['primitives']:
                assert pr.get('mode', 4) == 4 and pr.get('material', 0) == 0
                assert not pr.get('extensions') and not pr.get('targets')
                at = pr['attributes']
                p, n, uv, color = [atributo(at[clave]) for clave in ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']]
                assert len(p) == len(n) == len(uv) == len(color)
                offset = len(vertices)
                for v, nn, tt, cc in zip(p, n, uv, color):
                    vertices.append([sum(matriz[i][j] * v[j] for j in range(3)) + matriz[i][3] for i in range(3)])
                    nn = [punto(fila, nn) for fila in normal]
                    largo = math.sqrt(punto(nn, nn))
                    assert largo > 1e-8
                    normales.append([v / largo for v in nn])
                    uvs.append(tt)
                    colores.append([cc[c] * factor[c] for c in range(3)])
                ix = [i[0] for i in atributo(pr['indices'])] if 'indices' in pr else list(range(len(p)))
                assert len(ix) % 3 == 0 and all(0 <= i < len(p) and int(i) == i for i in ix)
                indices.extend(int(i) + offset for i in ix)
            volumen = 0
            for i in range(comienzo, len(indices), 3):
                ia, ib, ic = indices[i:i+3]
                a, b, c = vertices[ia], vertices[ib], vertices[ic]
                n = cruz([b[j]-a[j] for j in range(3)], [c[j]-a[j] for j in range(3)])
                assert punto(n, n) > 1e-14, 'Triángulo degenerado'
                assert punto(n, [normales[ia][j]+normales[ib][j]+normales[ic][j] for j in range(3)]) > 0, 'Normal o winding invertido'
                volumen += punto(a, cruz(b, c)) / 6
            assert volumen > 1e-7, 'La orientación de la piedra debe ser exterior'
            piezas.append({'nombre': nodo['name'], 'primerIndice': comienzo, 'cantidadIndices': len(indices)-comienzo, 'primerVertice': comienzo_vertices, 'cantidadVertices': len(vertices)-comienzo_vertices, 'volumenFirmado': round(volumen, 8)})
        for hijo in nodo.get('children', []):
            visitar(hijo, matriz)

    for nodo in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visitar(nodo, identidad)
    assert len(vertices) < 65536 and len(indices) // 3 <= PRESUPUESTOS[modulo]
    assert len(piezas) == len(set(p['nombre'] for p in piezas)), 'Nombres de pieza repetidos'
    minimo = [min(v[c] for v in vertices) for c in range(3)]
    maximo = [max(v[c] for v in vertices) for c in range(3)]
    dimensiones = [maximo[c]-minimo[c] for c in range(3)]
    assert all(abs(a-b) < .0001 for a, b in zip(dimensiones, DIMENSIONES[modulo])), (modulo, dimensiones, DIMENSIONES[modulo])
    centro = [(minimo[0]+maximo[0])/2, minimo[1], (minimo[2]+maximo[2])/2]
    vertices = [[v[c]-centro[c] for c in range(3)] for v in vertices]
    aplanar = lambda datos: [v for fila in datos for v in fila]
    datos = {'id': modulo, 'nombre': NOMBRES[modulo], 'position': codificar(aplanar(vertices), 'f'), 'normal': codificar(aplanar(normales), 'f'), 'uv': codificar(aplanar(uvs), 'f'), 'color': codificar(aplanar(colores), 'f'), 'index': codificar(indices, 'H'), 'triangulos': len(indices)//3, 'dimensiones': DIMENSIONES[modulo]}
    informe = {'id': modulo, 'nombre': NOMBRES[modulo], 'glb': 'glb/'+modulo+'.glb', 'glbSha256': sha(original), 'glbBytes': len(original), 'triangulos': len(indices)//3, 'vertices': len(vertices), 'materiales': len(doc['materials']), 'dimensiones': DIMENSIONES[modulo], 'color': 'COLOR_0 conservado del GLB y multiplicado por baseColorFactor', 'piezas': piezas, 'comprobaciones': ['GLB2 y chunks completos', 'material único', 'sin texturas duplicadas', 'posiciones/UV/colores finitos', 'normales unitarias y orientación exterior', 'triángulos no degenerados e índices válidos', 'transformaciones fijadas', 'base Y=0 y centro XZ=0', 'presupuesto de triángulos por módulo respetado']}
    if modulo == 'pavimento':
        cotas = [v[1] for v, n in zip(vertices, normales) if n[1] > .98]
        assert cotas and max(cotas)-min(cotas) <= .014, 'El pavimento debe permanecer casi plano'
        informe['superficiePisada'] = {'cotaMinima': min(cotas), 'cotaMaxima': max(cotas), 'desnivelMaximo': max(cotas)-min(cotas), 'colocacionSugeridaY': -.025, 'nota': 'Malla decorativa, sin alterar la altura de pies ni colisiones del juego. Hundir la base deja la superficie aproximadamente entre 2,5 y 3,5 cm.'}
    return datos, informe


datos, informes = [], []
for modulo in NOMBRES:
    dato, informe = convertir(modulo)
    datos.append(dato)
    informes.append(informe)
contenido = '/* GLB de Kiln 1.1.0 convertidos por preparar.py; materiales/texturas compartidos en el visor. */\nwindow.CAOZ_SENDERO_KILN=' + json.dumps({'version': 1, 'modulos': datos}, separators=(',', ':')) + ';\n'
generacion = json.loads((SALIDA / 'generacion.json').read_text())
fuentes = {m['id']: m for m in generacion['modulos']}
for informe in informes:
    fuente = fuentes[informe['id']]
    assert fuente['glbSha256'] == informe['glbSha256'], 'El GLB debe corresponder a la ejecución de Kiln registrada'
    informe.update({'fuente': fuente['fuente'], 'fuenteSha256': fuente['fuenteSha256'], 'kilnWarnings': fuente['warnings']})
procedencia = {'version': 1, 'motor': generacion['motor'], 'node': generacion['node'], 'exportador': generacion['exportador'], 'exportadorExperimental': True, 'opcionesKiln': generacion['opciones'], 'contrato': 'GLB estático real de Kiln -> conversor local -> una malla por módulo; sin Kiln ni GLTFLoader durante la partida', 'material': {'nombre': 'Caoz_Piedra_Compartida', 'compartidoEntreModulos': True, 'mapasReutilizados': ['../bosque-scenario/roca-color.webp', '../bosque-scenario/roca-normal.webp', '../bosque-scenario/roca-superficie.webp'], 'nuevasImagenes': 0}, 'preservacionPiezas': 'Los GLB/fuentes conservan nodos por piedra. datos.js concatena para una draw call por módulo. Los rangos de índices de este manifiesto permiten extraer fragmentos, pero no implementan colisiones ni destrucción.', 'runtime': {'archivo': 'datos.js', 'bytes': len(contenido.encode()), 'sha256': sha(contenido.encode())}, 'revisionVisual': 'Pendiente de revisión en la cámara/iluminación real del visor; los checks geométricos no certifican calidad artística ni FPS.', 'modulos': informes}
(SALIDA / 'datos.js').write_text(contenido, encoding='utf8')
(SALIDA / 'procedencia.json').write_text(json.dumps(procedencia, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps([{'id': i['id'], 'triangulos': i['triangulos'], 'vertices': i['vertices'], 'piezas': len(i['piezas']), 'materiales': i['materiales'], 'dimensiones': i['dimensiones']} for i in informes], indent=2))

"""Prepara la llave de Scenario para three.js, sin cargadores GLB en la partida.
Uso: python preparar.py /ruta/llave-recaudador.glb
Requiere numpy y Pillow; conserva el GLB original fuera de los recursos de ejecución.
"""
import base64
import hashlib
import io
import json
import struct
import sys
from pathlib import Path
import numpy as np
from PIL import Image

salida = Path(__file__).resolve().parent
fuente = Path(sys.argv[1]).read_bytes()
sha = hashlib.sha256(fuente).hexdigest()
assert sha == 'f03b403c4e8099fce555461e417309c8d1625cffdeacb3617101752e7baae838', 'Usa el GLB de la llave registrado en procedencia.json.'
assert fuente[:4] == b'glTF', 'La fuente debe ser GLB.'
largo = struct.unpack_from('<I', fuente, 12)[0]
doc = json.loads(fuente[20:20+largo])
binario = fuente[28+largo:]
assert len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == 1
primitiva = doc['meshes'][0]['primitives'][0]

def atributo(indice):
    a = doc['accessors'][indice]
    v = doc['bufferViews'][a['bufferView']]
    ancho = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]
    tipo = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']])
    return np.ndarray((a['count'], ancho), dtype=tipo, buffer=binario,
                      offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                      strides=(v.get('byteStride', ancho*tipo.itemsize), tipo.itemsize)).copy()

p = atributo(primitiva['attributes']['POSITION'])
n = atributo(primitiva['attributes']['NORMAL'])
uv = atributo(primitiva['attributes']['TEXCOORD_0'])
tri = atributo(primitiva['indices']).reshape(-1, 3)
assert len(p) < 65536 and len(tri) <= 2400
# La fuente tiene la cara en YZ. La llevamos a XY, anilla arriba, dientes a +X.
# No se conserva el giro decorativo del nodo: la cinemática controla la orientación.
rotacion = np.array([[0, 0, -1], [0, 1, 0], [1, 0, 0]])
p = p @ rotacion.T
n = n @ rotacion.T
escala = .72 / np.ptp(p[:, 1])
p *= escala
# Origen en el hueco de la anilla, donde se encuentra la mano al recogerla.
p[:, 1] -= .205
assert np.isfinite(p).all() and np.isfinite(n).all()

def codificar(a, tipo):
    return base64.b64encode(a.astype(tipo).tobytes()).decode()

datos = {'position': codificar(p, '<f4'), 'normal': codificar(n, '<f4'),
         'uv': codificar(uv, '<f4'), 'index': codificar(tri, '<u2')}
(salida/'datos.js').write_text('/* Llave de Scenario; generado por preparar.py. */\nwindow.CAOZ_LLAVE_DATOS='+json.dumps(datos, separators=(',', ':'))+';\n')
material = doc['materials'][primitiva['material']]
pbr = material['pbrMetallicRoughness']
mapas = [('color', pbr['baseColorTexture']), ('superficie', pbr['metallicRoughnessTexture']), ('normal', material['normalTexture'])]
for nombre, textura in mapas:
    indice = doc['textures'][textura['index']]['source']
    v = doc['bufferViews'][doc['images'][indice]['bufferView']]
    im = Image.open(io.BytesIO(binario[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
    a = np.array(im)
    if nombre == 'normal':
        normal = a.astype(float)/127.5-1
        normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
        a = np.clip((normal+1)*127.5, 0, 255).astype('uint8')
    elif nombre == 'superficie':
        # Rugosidad mínima alta para que el metal no lance destellos a cámara.
        a[:, :, 1] = np.maximum(a[:, :, 1], 180)
    Image.fromarray(a).save(salida/(nombre+'.webp'), lossless=nombre!='color', quality=87, method=6)
procedencia = {
    'fuente': 'Scenario / GPT Image 2.5 Sunburst + Tripo P1',
    'teamId': 'team_fusHPzE5VJ4KYZ3QPyxC2Eaa', 'projectId': 'proj_yCSENgpggrHw8YbSmZXSuQ4w',
    'conceptoAssetId': 'asset_1DFp956VebcvcfLbTJDisZoc', 'assetId': 'asset_JytbwECJxXCMUEVVefb7wPZt',
    'collectionId': 'col_h8pcvYBdvxuTqpE7pdg7iT8D', 'sha256Glb': sha,
    'triangulos': len(tri), 'vertices': len(p), 'largoMetros': .72, 'mapas': 512,
    'creditosConcepto': 12, 'creditosModelo': 100,
    'modelo': 'model_tripo-p1-image-to-3d',
    'parametros': {'faceLimit': 2400, 'pbr': True, 'delight': True, 'orientation': 'align_image', 'seed': 381706, 'textureSeed': 381706},
    'adaptacion': 'Una malla rígida, origen en la anilla, cara en XY. Mapas PBR 512, rugosidad mínima 0,706 y metalidad reducida en el juego. Sin emisión ni luces adicionales. Recursos locales y reutilizados al reiniciar.'
}
(salida/'procedencia.json').write_text(json.dumps(procedencia, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'triangulos': len(tri), 'vertices': len(p), 'min': p.min(axis=0).tolist(), 'max': p.max(axis=0).tolist(), 'sha': sha}))

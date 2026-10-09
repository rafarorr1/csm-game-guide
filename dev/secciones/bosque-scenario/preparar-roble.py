"""Extrae el roble reducido de Scenario a geometría compartida y atlas pequeño.
Uso: python preparar-roble.py /ruta/roble-horneado.glb
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
largo = struct.unpack_from('<I', fuente, 12)[0]
doc = json.loads(fuente[20:20+largo])
binario = fuente[28+largo:]

def atributo(i):
    a = doc['accessors'][i]
    v = doc['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    t = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']])
    return np.ndarray((a['count'], n), dtype=t, buffer=binario,
        offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
        strides=(v.get('byteStride', n*t.itemsize), t.itemsize)).copy()

# La exportación de Blender aplica la transformación al vértice y conserva Y arriba.
assert len(doc['meshes']) == 1 and all(not any(k in node for k in ('matrix', 'rotation', 'scale', 'translation')) for node in doc['nodes'])
pr = doc['meshes'][0]['primitives'][0]
p = atributo(pr['attributes']['POSITION'])
n = atributo(pr['attributes']['NORMAL'])
uv = atributo(pr['attributes']['TEXCOORD_0'])
idx = atributo(pr['indices'])
assert idx.max() < 65536
p -= np.array([(p[:, 0].min()+p[:, 0].max())/2, p[:, 1].min(), (p[:, 2].min()+p[:, 2].max())/2])
p /= np.ptp(p[:, 1])

def cod(a, t):
    return base64.b64encode(a.astype(t).tobytes()).decode()

datos = {k: cod(a, t) for k, a, t in [
    ('position', p, '<f4'), ('normal', n, '<f4'),
    ('uv', uv, '<f4'), ('index', idx, '<u2')]}
datos.update({'triangulos': int(len(idx)/3), 'altura': 1,
    'limites': [p.min(axis=0).tolist(), p.max(axis=0).tolist()],
    'fuente': 'asset_Pp79W459ukK2MaReiJ74bWfX'})
(salida/'arboles-datos.js').write_text('/* Roble de Scenario, Y arriba y altura normalizada a 1. */\nwindow.CAOZ_BOSQUE_ARBOLES_DATOS='+json.dumps({'roble': datos}, separators=(',', ':'))+';\n')

textura = doc['materials'][pr['material']]['pbrMetallicRoughness']['baseColorTexture']
vista = doc['bufferViews'][doc['images'][doc['textures'][textura['index']]['source']]['bufferView']]
inicio = vista.get('byteOffset', 0)
im = Image.open(io.BytesIO(binario[inicio:inicio+vista['byteLength']])).convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS)
im.save(salida/'roble-color.webp', quality=88, method=6)
# El modelo de Trellis no entrega mapa normal. Se mantiene plano para evitar inventar relieve
# a partir de las sombras de su atlas; los normales de vértice conservan el volumen real.
Image.new('RGB', (512, 512), (128, 128, 255)).save(salida/'roble-normal.webp', lossless=True, method=6)
print(json.dumps({'sha256': hashlib.sha256(fuente).hexdigest(),
    'triangulos': datos['triangulos'], 'limites': datos['limites'],
    'archivos': ['arboles-datos.js', 'roble-color.webp', 'roble-normal.webp']}))

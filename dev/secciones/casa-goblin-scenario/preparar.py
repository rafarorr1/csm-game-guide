"""Adapta el interior GLB de Scenario a recursos locales del ARPG.
Uso: python preparar.py interior.glb [--giro GRADOS]
Requiere numpy y Pillow. No ejecuta código ni conserva dependencias del GLB.
"""
import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('fuente', type=Path)
parser.add_argument('--giro', type=float, default=24.213)
args = parser.parse_args()
salida = Path(__file__).resolve().parent
fuente = args.fuente.read_bytes()
assert fuente[:4] == b'glTF', 'La fuente debe ser GLB.'
largo = struct.unpack_from('<I', fuente, 12)[0]
doc = json.loads(fuente[20:20+largo])
binario = fuente[28+largo:]
assert not doc.get('animations'), 'El decorado debe ser estático.'

def atributo(indice):
    a = doc['accessors'][indice]
    v = doc['bufferViews'][a['bufferView']]
    ancho = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1, 'VEC4': 4}[a['type']]
    tipo = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']])
    return np.ndarray((a['count'], ancho), dtype=tipo, buffer=binario,
                      offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                      strides=(v.get('byteStride', ancho*tipo.itemsize), tipo.itemsize)).copy()

def matriz(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    r = np.array([[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                  [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                  [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]])
    m = np.eye(4); m[:3,:3] = r @ np.diag(n.get('scale', [1, 1, 1]))
    m[:3,3] = n.get('translation', [0, 0, 0])
    return m

piezas = []
def visitar(i, padre):
    n = doc['nodes'][i]; m = padre @ matriz(n)
    if 'mesh' in n:
        for pr in doc['meshes'][n['mesh']]['primitives']:
            assert pr.get('mode', 4) == 4 and 'extensions' not in pr
            p = atributo(pr['attributes']['POSITION'])
            normal = atributo(pr['attributes']['NORMAL'])
            p = p @ m[:3,:3].T + m[:3,3]
            normal = normal @ np.linalg.inv(m[:3,:3])
            normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-8)
            piezas.append(dict(p=p, n=normal, uv=atributo(pr['attributes']['TEXCOORD_0']),
                               tri=atributo(pr['indices']).reshape(-1, 3), material=pr.get('material', 0)))
    for hijo in n.get('children', []): visitar(hijo, m)

for i in doc['scenes'][doc.get('scene', 0)]['nodes']: visitar(i, np.eye(4))
assert piezas
giro = math.radians(args.giro)
r = np.array([[math.cos(giro),0,math.sin(giro)],[0,1,0],[-math.sin(giro),0,math.cos(giro)]])
for pieza in piezas:
    pieza['p'] = pieza['p'] @ r.T; pieza['n'] = pieza['n'] @ r.T
todos = np.concatenate([p['p'] for p in piezas])
mn, mx = todos.min(axis=0), todos.max(axis=0)
# Tamaño de la habitación actual. La altura conserva la proporción del objeto.
escala = np.array([8.5/(mx[0]-mn[0]), 8.5/(mx[0]-mn[0]), 7.6/(mx[2]-mn[2])])
centro = (mn+mx)/2
for p in piezas:
    p['p'] = (p['p']-centro)*escala
    p['n'] /= escala; p['n'] /= np.maximum(np.linalg.norm(p['n'], axis=1, keepdims=True), 1e-8)

# Plano dominante del piso en el centro, sin confundir mesas, camas o la base exterior.
niveles = {}
for p in piezas:
    tris = p['p'][p['tri']]; cruz = np.cross(tris[:,1]-tris[:,0], tris[:,2]-tris[:,0])
    area = np.linalg.norm(cruz, axis=1); c = tris.mean(axis=1)
    mask = (np.abs(cruz[:,1]) > area*.9) & (np.abs(c[:,0]) < 1.4) & (np.abs(c[:,2]) < 2)
    for y, a in zip(c[mask,1], area[mask]):
        k = round(float(y)*100)/100; niveles[k] = niveles.get(k, 0)+float(a)
assert niveles, 'No se encontró un piso horizontal.'
# El GLB tiene caras dobles: la base inferior no es la superficie transitable.
suelo = max(y for y, a in niveles.items() if a > max(niveles.values())*.2)
for p in piezas: p['p'][:,1] -= suelo
# Recorta los extremos sueltos del marco; se completa con un dintel limpio en el juego.
for p in piezas:
    t = p['p'][p['tri']].mean(axis=1)
    p['tri'] = p['tri'][~((t[:,0] > 1.3) & (t[:,1] > 2.6))]
def cod(a, tipo): return base64.b64encode(a.astype(tipo).tobytes()).decode()
mallas = []
for p in piezas:
    assert np.isfinite(p['p']).all() and np.isfinite(p['n']).all()
    assert len(p['p']) < 65536
    mallas.append(dict(position=cod(p['p'], '<f4'), normal=cod(p['n'], '<f4'), uv=cod(p['uv'], '<f4'),
                       index=cod(p['tri'], '<u2'), material=p['material']))
triangulos = sum(len(p['tri']) for p in piezas)
assert triangulos <= 32000, 'Revisar el presupuesto de triángulos.'
datos = {'mallas': mallas, 'triangulos': triangulos, 'giro': args.giro, 'sueloFuente': suelo}
(salida/'datos.js').write_text('/* Interior de Scenario; generado por preparar.py. */\nwindow.CAOZ_CASA_GOBLIN_DATOS='+json.dumps(datos, separators=(',', ':'))+';\n')
for i, material in enumerate(doc['materials']):
    pbr = material.get('pbrMetallicRoughness', {})
    for nombre, textura in [('color', pbr.get('baseColorTexture')), ('normal', material.get('normalTexture')), ('superficie', pbr.get('metallicRoughnessTexture'))]:
        if not textura:
            if nombre == 'normal':
                Image.new('RGB', (4, 4), (128, 128, 255)).save(salida/f'{nombre}-{i}.webp', lossless=True)
            continue
        imagen = doc['textures'][textura['index']]['source']
        v = doc['bufferViews'][doc['images'][imagen]['bufferView']]
        im = Image.open(io.BytesIO(binario[v.get('byteOffset', 0):v.get('byteOffset', 0)+v['byteLength']])).convert('RGB')
        tamano = 2048 if nombre == 'color' else 1024
        im.thumbnail((tamano, tamano), Image.Resampling.LANCZOS); a = np.array(im)
        if nombre == 'normal':
            normal = a.astype(float)/127.5-1
            normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
            a = np.clip((normal+1)*127.5, 0, 255).astype('uint8')
        if nombre == 'superficie':
            a[:,:,0] = 255
            a[:,:,1] = np.maximum(a[:,:,1], 205)//16*16
            a[:,:,2] = np.minimum(a[:,:,2], 35)//16*16
        Image.fromarray(a).save(salida/f'{nombre}-{i}.webp', lossless=nombre!='color', quality=88, method=6)
todos = np.concatenate([p['p'] for p in piezas])
print(json.dumps({'sha256': hashlib.sha256(fuente).hexdigest(), 'triangulos': triangulos,
                  'vertices': sum(len(p['p']) for p in piezas), 'mallas': len(mallas),
                  'materiales': len(doc['materials']), 'min': todos.min(axis=0).tolist(),
                  'max': todos.max(axis=0).tolist(), 'sueloFuente': suelo}))

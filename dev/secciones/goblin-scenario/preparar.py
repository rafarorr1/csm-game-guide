"""Compila el GLB de Scenario a una malla local con pesos y tres mapas compartidos.
Uso: python preparar.py /ruta/goblin-caoz-115cm.glb
Requiere numpy y Pillow. No necesita Blender ni instala dependencias en el juego.
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
assert hashlib.sha256(fuente).hexdigest() == 'b05471f0c602608a122e1af3dc2333cb912b149892625434fe2b2f2e7fafa886', 'Usa el GLB aprobado y normalizado a 1,15 m.'
largo = struct.unpack_from('<I', fuente, 12)[0]
doc = json.loads(fuente[20:20+largo])
binario = fuente[28+largo:]
def atributo(indice):
    a = doc['accessors'][indice]
    v = doc['bufferViews'][a['bufferView']]
    ancho = {'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
    return np.frombuffer(binario, dtype={5126:'<f4',5125:'<u4'}[a['componentType']], count=a['count']*ancho, offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],ancho).copy()

# Las dos transformaciones originales dejan al personaje mirando a +Z.
m = np.array(doc['nodes'][0]['matrix']).reshape(4,4).T
m = np.array([[0,0,-1,0],[0,1,0,0],[1,0,0,0],[0,0,0,1]]) @ m
p = atributo(1) @ m[:3,:3].T * 1.15 + np.array([0,.575,0])
n = atributo(3) @ m[:3,:3].T
uv = atributo(2)
tri = atributo(0).reshape(-1,3)
nombres = ['cadera','torso','cabeza','brazoI','anteI','manoI','piernaI','rodillaI','pieI','brazoD','anteD','manoD','piernaD','rodillaD','pieD']
indices = np.zeros((len(p),4),dtype=np.uint8)
pesos = np.zeros((len(p),4),dtype=np.float32)
def suave(a,b,v):
    t = np.clip((v-a)/(b-a),0,1)
    return t*t*(3-2*t)
def mezcla(a,b,k):
    return {a:1-k,b:k}
for i,(x,y,z) in enumerate(p):
    ax = abs(x)
    lado = 'I' if x>=0 else 'D'
    # La axila divide el brazo del chaleco; la cabeza y el pañuelo no heredan el brazo.
    brazo = .32<y<.845 and (ax > min(.225,.145 + max(0,.78-y)*.30) or (x>.166 and .48<y<.72 and z<-.07))
    if brazo:
        if y>.685:
            w = mezcla('torso','brazo'+lado,suave(.135,.205,ax))
        elif y>.55:
            w = mezcla('ante'+lado,'brazo'+lado,suave(.6,.69,y))
        else:
            w = mezcla('mano'+lado,'ante'+lado,suave(.455,.53,y))
    elif y>.81:
        w = mezcla('torso','cabeza',suave(.825,.9,y))
    elif y>.54:
        w = mezcla('cadera','torso',suave(.54,.67,y))
    elif y>.3:
        # El faldón acompaña al muslo, con cintura fija y una transición amplia.
        w = mezcla('pierna'+lado,'cadera',suave(.365,.53,y))
    elif y>.13:
        w = mezcla('rodilla'+lado,'pierna'+lado,suave(.255,.33,y))
    else:
        w = mezcla('pie'+lado,'rodilla'+lado,suave(.085,.155,y))
    w = sorted(((n,v) for n,v in w.items() if v>1e-6),key=lambda t:-t[1])
    for k,(nombre,valor) in enumerate(w):
        indices[i,k] = nombres.index(nombre)
        pesos[i,k] = valor
    pesos[i] /= pesos[i].sum()
# Datos binarios tipados, sin parsear miles de números en cada aparición.
def codificar(a,t): return base64.b64encode(a.astype(t).tobytes()).decode()
datos = {'huesos':nombres,'posicion':codificar(p,'<f4'),'normal':codificar(n,'<f4'),'uv':codificar(uv,'<f4'),'triangulos':codificar(tri,'<u2'),'hueso':codificar(indices,'u1'),'peso':codificar(pesos,'<f4')}
(salida/'datos.js').write_text('/* Generado por preparar.py; no editar a mano. */\nwindow.CAOZ_GOBLIN_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
for i,nombre in enumerate(['color','superficie','normal']):
    v = doc['bufferViews'][doc['images'][i]['bufferView']]
    im = Image.open(io.BytesIO(binario[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
    if nombre=='normal':
        # Renormalizar después del filtro evita perder fuerza en las normales.
        a = np.asarray(im,dtype=float)/127.5-1
        a /= np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-6)
        im = Image.fromarray(np.clip((a+1)*127.5,0,255).astype('uint8'))
    im.save(salida/(nombre+'.webp'),lossless=nombre=='normal',quality=90,method=6)
(salida/'procedencia.json').write_text(json.dumps({'fuente':'Scenario / Tripo 3.1','assetId':'asset_zNSmSDHeAb7Tu7FDkp3MoiKo','projectId':'proj_yCSENgpggrHw8YbSmZXSuQ4w','sha256Glb':hashlib.sha256(fuente).hexdigest(),'alturaMetros':1.15,'triangulos':len(tri),'vertices':len(p),'mapas':1024,'rig':'Adaptación manual al esqueleto procedural de Caoz ARPG; hasta dos influencias por vértice.','herramienta':'preparar.py; GLB aprobado como entrada. El juego no usa servicios remotos.'},ensure_ascii=False,indent=2)+'\n')
print(f'{len(tri)} triángulos, {len(p)} vértices; pesos normalizados y mapas 1024.')

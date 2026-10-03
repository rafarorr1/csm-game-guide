"""Compila los cuatro GLB de Scenario al esqueleto local y atlas de 1024 px.
Uso: python preparar.py /carpeta/con/rojizo.glb/capucha.glb/acorazado.glb/huesos.glb
Requiere numpy y Pillow únicamente durante la preparación.
"""
import base64
import hashlib
import io
import json
import math
import struct
import sys
from pathlib import Path
import numpy as np
from PIL import Image

salida = Path(__file__).resolve().parent
entrada = Path(sys.argv[1])
variantes = ['rojizo', 'capucha', 'acorazado', 'huesos']
nombres = ['cadera', 'torso', 'cabeza'] + [n+l for l in ['I', 'D'] for n in ['brazo', 'ante', 'mano', 'pierna', 'rodilla', 'pie']] + ['cola', 'cola2']
datos, informe = {}, {}
def suave(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)
def mezcla(a, b, k): return {a:1-k, b:k}
def codificar(a, t): return base64.b64encode(a.astype(t).tobytes()).decode()

for variante in variantes:
    archivo = entrada/(variante+'.glb')
    if not archivo.exists(): raise FileNotFoundError('Falta el GLB de la variante '+variante)
    fuente = archivo.read_bytes()
    magic, version, total = struct.unpack_from('<III', fuente)
    assert magic == 0x46546c67 and version == 2 and total == len(fuente)
    largo = struct.unpack_from('<I', fuente, 12)[0]
    doc = json.loads(fuente[20:20+largo]); binario = fuente[28+largo:]
    prim = doc['meshes'][0]['primitives'][0]
    assert len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == 1
    def atributo(i):
        a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
        ancho = {'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        tipo = np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']])
        return np.ndarray((a['count'], ancho), dtype=tipo, buffer=binario, offset=v.get('byteOffset',0)+a.get('byteOffset',0), strides=(v.get('byteStride',ancho*tipo.itemsize),tipo.itemsize)).copy()
    p = atributo(prim['attributes']['POSITION']); n = atributo(prim['attributes']['NORMAL']); uv = atributo(prim['attributes']['TEXCOORD_0']); tri = atributo(prim['indices']).reshape(-1,3)
    # El nodo de malla conserva la pose frontal. El padre de Tripo gira su visor, no el rig del juego.
    nodo = next(v for v in doc['nodes'] if v.get('mesh') == 0)
    matriz = np.array([[0,0,-1,0],[0,1,0,0],[1,0,0,0],[0,0,0,1]]) @ np.array(nodo.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T
    p = p @ matriz[:3,:3].T + matriz[:3,3]; n = n @ np.linalg.inv(matriz[:3,:3])
    alto = 1.25; factor = alto/np.ptp(p[:,1]); p *= factor; p[:,1] -= p[:,1].min()
    # Centrar el pecho evita que la cola lateral desplace el pivote del personaje.
    pecho = p[(p[:,1]>.73)&(p[:,1]<.86)]
    centro = np.median(pecho,axis=0); p[:,0] -= centro[0]; p[:,2] -= centro[2]
    n /= np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-6)
    ancho = .14 if variante == 'acorazado' else .125
    hombros = .19 if variante == 'acorazado' else .175
    angulo = .48
    proporciones = dict(muslo=.235,pierna=.215,pie=.07,cintura=.07,torso=.31,hombros=hombros,brazo=.215,antebrazo=.205,ancho=ancho,cola=True)
    reposo = {'cadera':[0,.52,0], 'torso':[0,.07,0], 'cabeza':[0,.31,0], 'cola':[0,-.015,-.11], 'cola2':[0,0,-.22]}
    for lado,s in [('I',1),('D',-1)]:
        reposo.update({ 'brazo'+lado:[s*hombros,.255,0], 'ante'+lado:[0,-.215,0], 'mano'+lado:[0,-.205,0], 'pierna'+lado:[s*ancho,0,0], 'rodilla'+lado:[0,-.235,0], 'pie'+lado:[0,-.215,0] })
    # Separar las manos de faldones cercanos por conectividad, no por una línea que corte dedos.
    vecinos = [set() for _ in p]; costuras = {}
    for a,b,c in tri:
        vecinos[a].update([b,c]); vecinos[b].update([a,c]); vecinos[c].update([a,b])
    for i,v in enumerate(p):
        clave = tuple(np.round(v,5)); anterior = costuras.setdefault(clave,i)
        vecinos[i].add(anterior); vecinos[anterior].add(i)
    brazos = set()
    for signo in [-1,1]:
        validos = (p[:,0]*signo>np.where(p[:,1]>.68,.12,.22))&(p[:,1]>.30)&(p[:,1]<.79)&(p[:,2]>-.13)
        candidatos = np.flatnonzero(validos); semilla = candidatos[np.argmin(np.linalg.norm(p[candidatos]-[signo*.33,.44,.02],axis=1))]
        cola = [semilla]; vistos = {semilla}
        while cola:
            v = cola.pop()
            for j in vecinos[v]:
                if validos[j] and j not in vistos: vistos.add(j); cola.append(j)
        brazos.update(vistos)
    indices = np.zeros((len(p),4),dtype=np.uint8); pesos = np.zeros((len(p),4),dtype=np.float32)
    for i,(x,y,z) in enumerate(p):
        ax = abs(x); lado = 'I' if x>=0 else 'D'
        # Cola detrás de cadera; no hereda las piernas aunque pase junto a ellas.
        cola_peso = (1-suave(.57,.67,y))*suave(.13,.25,-z)
        brazo = i in brazos or (.74<y<.93 and ax>.145)
        if brazo:
            if y>.74: w = mezcla('torso','brazo'+lado,suave(.13,.23,ax))
            elif y>.53: w = mezcla('ante'+lado,'brazo'+lado,suave(.61,.73,y))
            else: w = mezcla('mano'+lado,'ante'+lado,suave(.40,.50,y))
        elif y>.86: w = mezcla('torso','cabeza',suave(.86,.96,y))
        elif y>.55: w = mezcla('cadera','torso',suave(.53,.69,y))
        elif y>.29: w = mezcla('pierna'+lado,'cadera',suave(.37,.53,y))
        elif y>.12: w = mezcla('rodilla'+lado,'pierna'+lado,suave(.25,.33,y))
        else: w = mezcla('pie'+lado,'rodilla'+lado,suave(.07,.14,y))
        if .28<y<.53 and not brazo:
            centro = (1-suave(.01,.085,ax))*suave(.28,.35,y)
            w = {h:v*(1-centro) for h,v in w.items()}; w['cadera'] = w.get('cadera',0)+centro
        if cola_peso>0:
            w = {h:v*(1-cola_peso) for h,v in w.items()}
            for h,v in mezcla('cola','cola2',suave(.17,.40,-z)).items(): w[h] = w.get(h,0)+v*cola_peso
        for j,(nombre,valor) in enumerate(sorted(w.items(),key=lambda t:-t[1])[:4]):
            indices[i,j] = nombres.index(nombre); pesos[i,j] = valor
        pesos[i] /= pesos[i].sum()
    # Suavizar las costuras entre articulaciones sin cambiar la geometría ni el atlas.
    densos = np.zeros((len(p),len(nombres)))
    for i in range(len(p)):
        for h,w in zip(indices[i],pesos[i]): densos[i,h] += w
    for _ in range(5):
        densos = np.array([fila*.55+densos[list(vecinos[i])].mean(axis=0)*.45 for i,fila in enumerate(densos)])
    indices = np.argsort(-densos,axis=1)[:,:4].astype(np.uint8)
    pesos = np.take_along_axis(densos,indices,axis=1).astype(np.float32); pesos /= pesos.sum(axis=1,keepdims=True)
    assert len(p)<65536 and len(tri)<11000 and np.isfinite(p).all() and n.shape==p.shape and np.isfinite(n).all()
    datos[variante] = dict(alto=alto,proporciones=proporciones,reposo=reposo,anguloBrazos=angulo,huesos=nombres,posicion=codificar(p,'<f4'),normal=codificar(n,'<f4'),uv=codificar(uv,'<f4'),triangulos=codificar(tri,'<u2'),hueso=codificar(indices,'u1'),peso=codificar(pesos,'<f4'))
    mat = doc['materials'][prim['material']]; pbr = mat['pbrMetallicRoughness']
    for nombre,indice in [('color',pbr['baseColorTexture']['index']),('superficie',pbr['metallicRoughnessTexture']['index']),('normal',mat['normalTexture']['index'])]:
        v = doc['bufferViews'][doc['images'][doc['textures'][indice]['source']]['bufferView']]
        im = Image.open(io.BytesIO(binario[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
        if nombre=='normal':
            a = np.asarray(im,dtype=float)/127.5-1; a /= np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-6)
            im = Image.fromarray(np.clip((a+1)*127.5,0,255).astype('uint8'))
        im.save(salida/(variante+'-'+nombre+'.webp'),lossless=nombre=='normal',quality=90,method=6)
    informe[variante] = dict(sha256=hashlib.sha256(fuente).hexdigest(),triangulos=len(tri),vertices=len(p),alto=alto,limites=[p.min(axis=0).tolist(),p.max(axis=0).tolist()],mapas=1024)
(salida/'datos.js').write_text('/* Generado por preparar.py; mallas de Scenario con pesos locales. */\nwindow.CAOZ_KOBOLD_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
(salida/'geometria.json').write_text(json.dumps(informe,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(informe,ensure_ascii=False))

"""Adapta la Adreida aprobada al esqueleto procedural y prepara sus mapas locales.
Uso: python preparar.py /ruta/adreida-caoz.glb
Requiere numpy y Pillow. La partida no requiere Python ni un servicio remoto.
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
assert sha == '9218f846f012f428b8022a3003e0e8659b0190b473bf37af864bef5fdb40bd30', 'Usa la Adreida aprobada, a escala del juego.'
largo = struct.unpack_from('<I', fuente, 12)[0]
doc = json.loads(fuente[20:20+largo])
binario = fuente[28+largo:]
def atributo(i):
    a = doc['accessors'][i]
    b = doc['bufferViews'][a['bufferView']]
    ancho = {'VEC3':3, 'VEC2':2, 'SCALAR':1}[a['type']]
    return np.frombuffer(binario, dtype={5126:'<f4',5125:'<u4'}[a['componentType']], count=a['count']*ancho, offset=b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,ancho).copy()

# Transformaciones verificadas del GLB: nodo de malla, giro de escena y escala final.
giro = np.array([[0,0,-1],[0,1,0],[1,0,0]])
m = giro @ np.array(doc['nodes'][0]['matrix']).reshape(4,4).T[:3,:3]
ultimo = doc['nodes'][2]
p = (atributo(1) @ m.T) * ultimo['scale'][0] + ultimo['translation']
n = atributo(3) @ m.T
uv = atributo(2)
tri = atributo(0).reshape(-1,3)
# Separar manos/antebrazos de la falda por conectividad, no sólo por coordenadas:
# ambas superficies están muy cerca en la pose A, pero no están unidas.
_,soldado=np.unique(np.round(p,5),axis=0,return_inverse=True)
cantidad=soldado.max()+1
puntos=np.zeros((cantidad,3));puntos[soldado]=p
aristas=np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]])
aristas=np.unique(np.sort(soldado[aristas],axis=1),axis=0)
aristas=aristas[aristas[:,0]!=aristas[:,1]]
zona=(abs(puntos[:,0])>.17)&(puntos[:,1]>.74)&(puntos[:,1]<1.28)
padre=np.arange(cantidad)
def raiz(i):
    while padre[i]!=i:
        padre[i]=padre[padre[i]];i=padre[i]
    return i
for a,b in aristas:
    if zona[a] and zona[b]: padre[raiz(a)]=raiz(b)
semillas={raiz(i) for i in np.where(zona&(abs(puntos[:,0])>.36))[0]}
brazosBajos=np.array([bool(zona[i] and raiz(i) in semillas) for i in range(cantidad)])[soldado]
imagenes = []
for imagen in doc['images']:
    v = doc['bufferViews'][imagen['bufferView']]
    imagenes.append(Image.open(io.BytesIO(binario[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB'))
color = np.asarray(imagenes[0]) / 255.
texeles = color[np.clip((uv[:,1]*color.shape[0]).astype(int),0,color.shape[0]-1), np.clip((uv[:,0]*color.shape[1]).astype(int),0,color.shape[1]-1)]
nombres = ['cadera','torso','cabeza','brazoI','anteI','manoI','piernaI','rodillaI','pieI','brazoD','anteD','manoD','piernaD','rodillaD','pieD'] + ['falda'+str(i) for i in range(7)]
pesos = np.zeros((len(p),len(nombres)))
def suave(a,b,x):
    t = np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)
def mezcla(a,b,k): return {a:1-k,b:k}
for i,(x,y,z) in enumerate(p):
    ax = abs(x)
    lado = 'I' if x>=0 else 'D'
    oscuro = texeles[i].mean()<.29
    # El cabello posterior acompaña a cabeza y espalda; nunca recibe pesos de brazo.
    pelo = y>1.17 and z<-.055 and oscuro and ax<.235
    brazo = (brazosBajos[i] or (1.28<=y<1.57 and ax>.17)) and not pelo
    if brazo:
        if y>1.3: w=mezcla('torso','brazo'+lado,suave(.13+.065*suave(1.28,1.43,y),.27,ax))
        elif y>1.09: w=mezcla('ante'+lado,'brazo'+lado,suave(1.12,1.29,y))
        else: w=mezcla('mano'+lado,'ante'+lado,suave(.96,1.075,y))
    elif pelo: w=mezcla('torso','cabeza',suave(1.17,1.58,y))
    elif y>1.49: w=mezcla('torso','cabeza',suave(1.49,1.62,y))
    elif y>1.00: w=mezcla('cadera','torso',suave(1.00,1.22,y))
    elif .62<y<1.00 and (texeles[i].mean()<.34 or (z>.13 and y>.82)):
        # Paños contiguos con mezcla circular: el borde entre dos paños no se abre.
        a=(np.arctan2(x,z)-.08)%(np.pi*2)/(np.pi*2)*7-.5
        j=int(np.floor(a));f=a-j;k=1-suave(.84,.995,y)
        w={'cadera':1-k,'falda'+str(j%7):k*(1-f),'falda'+str((j+1)%7):k*f}
    elif y>.55: w=mezcla('pierna'+lado,'cadera',suave(.83,.97,y))
    elif y>.24: w=mezcla('rodilla'+lado,'pierna'+lado,suave(.43,.59,y))
    else: w=mezcla('pie'+lado,'rodilla'+lado,suave(.13,.25,y))
    for nombre,valor in w.items(): pesos[i,nombres.index(nombre)] = valor

# Suavizar en la superficie, soldando sólo duplicados UV coincidentes. Evita costuras
# que se separan o caras que saltan entre tela, piel y articulación al atacar.
conteo=np.bincount(soldado)
w=np.zeros((cantidad,len(nombres)))
np.add.at(w,soldado,pesos);w/=conteo[:,None]
for _ in range(2):
    vecinos=w.copy();cuenta=np.ones(cantidad)
    np.add.at(vecinos,aristas[:,0],w[aristas[:,1]]);np.add.at(vecinos,aristas[:,1],w[aristas[:,0]])
    np.add.at(cuenta,aristas[:,0],1);np.add.at(cuenta,aristas[:,1],1)
    w=.5*w+.5*vecinos/cuenta[:,None]
pesos=w[soldado]
indices=np.argsort(-pesos,axis=1)[:,:4]
valores=np.take_along_axis(pesos,indices,axis=1)
valores/=valores.sum(axis=1)[:,None]
# Cerrar los dedos desde los nudillos, conservando la palma y el ancho de la mano.
# En la pose A el mango cruza la palma en X; el enlace de mano gira ese eje a Y.
for i in np.where(brazosBajos & (p[:,1]<1.07))[0]:
    x,y,z=p[i];s=1 if x>=0 else -1
    if y<.91:
        angulo=np.clip((.91-y)/.115,0,1)*np.pi*1.15
        radio=.035+(z-.035)*.3
        p[i,1]=.91-radio*np.sin(angulo)
        p[i,2]=.025+radio*(1-np.cos(angulo))
    k=1-suave(.97,1.07,y)
    p[i]+=k*np.array([s*(.25+.6*np.sin(.31)-.392),1.4972-.6*np.cos(.31)-.91,-.060])
# Recalcular sólo las normales de las manos deformadas, soldando las costuras UV.
normales=np.zeros((cantidad,3))
caras=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
for j in range(3):np.add.at(normales,soldado[tri[:,j]],caras)
normales/=np.maximum(np.linalg.norm(normales,axis=1,keepdims=True),1e-8)
manos=brazosBajos & (puntos[soldado,1]<1.07)
n[manos]=normales[soldado[manos]]
def codificar(a,t): return base64.b64encode(a.astype(t).tobytes()).decode()
datos={'huesos':nombres,'posicion':codificar(p,'<f4'),'normal':codificar(n,'<f4'),'uv':codificar(uv,'<f4'),'triangulos':codificar(tri,'<u2'),'hueso':codificar(indices,'u1'),'peso':codificar(valores,'<f4')}
(salida/'datos.js').write_text('/* Generado por preparar.py; no editar a mano. */\nwindow.CAOZ_ADREIDA_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
for im,nombre in zip(imagenes,['color','superficie','normal']):
    im=im.resize((1024,1024),Image.Resampling.LANCZOS)
    if nombre=='normal':
        a=np.asarray(im,dtype=float)/127.5-1;a/=np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-6)
        im=Image.fromarray(np.clip((a+1)*127.5,0,255).astype('uint8'))
    im.save(salida/(nombre+'.webp'),lossless=nombre=='normal',quality=90,method=6)
(salida/'procedencia.json').write_text(json.dumps({'fuente':'Scenario / Tripo 3.1','assetId':'asset_qoc5bQ5VyS7BjtGaNaXA5Lma','sha256Glb':sha,'alturaLogicaMetros':1.95,'alturaVisualMetros':1.913112,'radioColisionMetros':.42,'triangulos':len(tri),'vertices':len(p),'mapas':1024,'rig':'Esqueleto procedural original, cuatro influencias suaves, falda en siete paños. Hacha independiente.','herramienta':'preparar.py; el juego no usa servicios remotos.'},ensure_ascii=False,indent=2)+'\n')
print(f'{len(tri)} triángulos, {len(p)} vértices; pesos normalizados y mapas 1024.')

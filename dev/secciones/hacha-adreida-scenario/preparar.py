"""Convierte el GLB aprobado en una malla local para el agarre de Adreida.
Uso: python preparar.py /ruta/hacha.glb
Requiere numpy y Pillow; no añade cargadores ni servicios a la partida.
"""
import base64, hashlib, io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
salida=Path(__file__).resolve().parent
fuente=Path(sys.argv[1]).read_bytes()
sha=hashlib.sha256(fuente).hexdigest()
assert sha=='a69bc9a4514ae3c5d9d44aa119a0dc45e76db4015ce223b187c2e1cf8838f0d9'
assert fuente[:4]==b'glTF'
largo=struct.unpack_from('<I',fuente,12)[0];doc=json.loads(fuente[20:20+largo]);binario=fuente[28+largo:]
assert len(doc['meshes'])==1 and len(doc['meshes'][0]['primitives'])==1
pr=doc['meshes'][0]['primitives'][0]
def atributo(i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];t=np.dtype({5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']])
    return np.ndarray((a['count'],n),dtype=t,buffer=binario,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*t.itemsize),t.itemsize)).copy()
p=atributo(pr['attributes']['POSITION']);n=atributo(pr['attributes']['NORMAL']);uv=atributo(pr['attributes']['TEXCOORD_0']);tri=atributo(pr['indices'])
assert len(p)<65536 and len(tri)//3<=4500
# La malla fuente tiene el filo en YZ. Omitimos el giro de presentación del GLB:
# en la palma, la cabeza queda a -Y, el pomo a +Y y los filos a ambos lados de Z.
p*=np.array([1,-1,-1]);n*=np.array([1,-1,-1])
escala=np.array([.13,1.625,.76])/np.ptp(p,axis=0);p*=escala;n/=escala
p[:,1]+=.305-p[:,1].max()
# El mango del generador es grueso: ajustamos sólo el tramo de agarre, con
# transiciones suaves hasta las abrazaderas; no alteramos cabeza ni pomo.
def suave(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)
peso=suave((p[:,1]+.65)/.15)*suave((.23-p[:,1])/.09)
sx=1-.25*peso;sz=1-.35*peso
p[:,0]*=sx;p[:,2]*=sz;n[:,0]/=sx;n[:,2]/=sz
n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
assert np.isfinite(p).all() and np.isfinite(n).all() and np.isfinite(uv).all()
def cod(a,t):return base64.b64encode(a.astype(t).tobytes()).decode()
datos=dict(position=cod(p,'<f4'),normal=cod(n,'<f4'),uv=cod(uv,'<f4'),index=cod(tri,'<u2'))
(salida/'datos.js').write_text('/* Hacha de Scenario; generado por preparar.py. */\nwindow.CAOZ_HACHA_ADREIDA_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
mat=doc['materials'][pr['material']];pbr=mat['pbrMetallicRoughness']
for nombre,t in [('color',pbr['baseColorTexture']),('normal',mat['normalTexture']),('superficie',pbr['metallicRoughnessTexture'])]:
    v=doc['bufferViews'][doc['images'][doc['textures'][t['index']]['source']]['bufferView']]
    im=Image.open(io.BytesIO(binario[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB');tam=512 if nombre=='superficie' else 1024
    a=np.array(im.resize((tam,tam),Image.Resampling.LANCZOS))
    if nombre=='normal':
        ns=a.astype(float)/127.5-1;ns/=np.maximum(np.linalg.norm(ns,axis=2,keepdims=True),1e-8);a=np.clip((ns+1)*127.5,0,255).astype('uint8')
    if nombre=='superficie':a[:,:,0]=255;a[:,:,1]=np.maximum(a[:,:,1],170);a[:,:,2]=np.minimum(a[:,:,2],190)
    Image.fromarray(a).save(salida/(nombre+'.webp'),quality=91,method=6,lossless=nombre=='superficie')
informe=dict(sha256Glb=sha,triangulos=len(tri)//3,vertices=len(p),minimo=p.min(axis=0).tolist(),maximo=p.max(axis=0).tolist(),mapas=dict(color=1024,normal=1024,superficie=512))
(salida/'geometria.json').write_text(json.dumps(informe,indent=2)+'\n');print(json.dumps(informe))

"""Prepara el farol de Scenario: escala real, atlas pequeño y geometría compartida.
Uso: python preparar.py /ruta/farol.glb
"""
import base64,hashlib,io,json,struct,sys
from pathlib import Path
import numpy as np
from PIL import Image
salida=Path(__file__).resolve().parent
fuente=Path(sys.argv[1]).read_bytes();largo=struct.unpack_from('<I',fuente,12)[0];doc=json.loads(fuente[20:20+largo]);binario=fuente[28+largo:]
def atributo(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];t=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]);return np.ndarray((a['count'],n),dtype=t,buffer=binario,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*t.itemsize),t.itemsize)).copy()
pr=doc['meshes'][0]['primitives'][0];p=atributo(pr['attributes']['POSITION']);n=atributo(pr['attributes']['NORMAL']);uv=atributo(pr['attributes']['TEXCOORD_0']);idx=atributo(pr['indices'])
# Normaliza el Y vertical. El ajuste de frente se comprueba contra la placa trasera.
p-=np.array([(p[:,0].min()+p[:,0].max())/2,p[:,1].min(),(p[:,2].min()+p[:,2].max())/2]);p*=.95/np.ptp(p[:,1])
def cod(a,t):return base64.b64encode(a.astype(t).tobytes()).decode()
datos={k:cod(a,t)for k,a,t in [('position',p,'<f4'),('normal',n,'<f4'),('uv',uv,'<f4'),('index',idx,'<u2')]}
(salida/'datos.js').write_text('/* Farol de Scenario; generado por preparar.py. */\nwindow.CAOZ_FAROL_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
mat=doc['materials'][0];pbr=mat['pbrMetallicRoughness']
for nombre,t in [('color',pbr['baseColorTexture']),('normal',mat['normalTexture']),('superficie',pbr['metallicRoughnessTexture'])]:
 v=doc['bufferViews'][doc['images'][doc['textures'][t['index']]['source']]['bufferView']];im=Image.open(io.BytesIO(binario[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB').resize((512,512),Image.Resampling.LANCZOS);a=np.array(im)
 if nombre=='superficie':a[:,:,0]=255;a[:,:,1]=np.maximum(a[:,:,1],185);a[:,:,2]=np.minimum(a[:,:,2],110)
 Image.fromarray(a).save(salida/(nombre+'.webp'),quality=88,method=6)
print(json.dumps({'sha256':hashlib.sha256(fuente).hexdigest(),'triangulos':int(len(idx)/3),'limites':[p.min(axis=0).tolist(),p.max(axis=0).tolist()]}))

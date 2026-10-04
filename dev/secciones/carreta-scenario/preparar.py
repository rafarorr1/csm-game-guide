"""Prepara la carreta de Scenario: python preparar.py /carpeta/con/GLB/originales."""
import base64, hashlib, io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
AQUI=Path(__file__).resolve().parent
FUENTES=Path(sys.argv[1]);BASE=AQUI.parent/'adreida-scenario'
def suave(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def cod(a,t):return base64.b64encode(np.asarray(a,dtype=t).tobytes()).decode()
def leer_datos(p):
    return json.loads(p.read_text().split('=',1)[1].rsplit(';',1)[0])
def dec(d,k,t,n):return np.frombuffer(base64.b64decode(d[k]),dtype=t).reshape(-1,n).copy()
def matriz(n):
    if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
    x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
    m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]))
    m[:3,3]=n.get('translation',[0,0,0]);return m
def glb(nombre):
    raw=(FUENTES/nombre).read_bytes();n=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+n]);b=raw[28+n:]
    def att(i):
        a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];ancho={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];tipo=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']])
        return np.ndarray((a['count'],ancho),dtype=tipo,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',ancho*tipo.itemsize),tipo.itemsize)).copy()
    def visitar(i,m):
        no=d['nodes'][i];m=m@matriz(no)
        if 'mesh' in no:return d['meshes'][no['mesh']]['primitives'][0],m
        for j in no.get('children',[]):
            r=visitar(j,m)
            if r:return r
    pr,m=visitar(d['scenes'][d.get('scene',0)]['nodes'][0],np.eye(4))
    p=att(pr['attributes']['POSITION'])@m[:3,:3].T+m[:3,3];uv=att(pr['attributes']['TEXCOORD_0']);idx=att(pr['indices']).reshape(-1,3)
    ma=d['materials'][pr.get('material',0)];pbr=ma['pbrMetallicRoughness'];mapas={}
    for tipo,entrada in [('color',pbr['baseColorTexture']),('superficie',pbr['metallicRoughnessTexture']),('normal',ma['normalTexture'])]:
        im=d['images'][d['textures'][entrada['index']]['source']];v=d['bufferViews'][im['bufferView']]
        mapas[tipo]=Image.open(io.BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB')
    return p,uv,idx,mapas,hashlib.sha256(raw).hexdigest()
def normales(p,tri):
    _,soldado=np.unique(np.round(p,6),axis=0,return_inverse=True);n=np.zeros((soldado.max()+1,3))
    caras=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
    for i in range(3):np.add.at(n,soldado[tri[:,i]],caras)
    n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10)
    return n[soldado]
p,uv,tri,mapas,sha=glb('carreta-original.glb')
p-=np.array([(p[:,0].min()+p[:,0].max())/2,p[:,1].min(),(p[:,2].min()+p[:,2].max())/2]);p*=1.25/np.ptp(p[:,1])
n=normales(p,tri)
for nombre,im in mapas.items():
    im=im.resize((1024,1024),Image.Resampling.LANCZOS)
    if nombre=='superficie':
        a=np.array(im);a[:,:,1]=np.maximum(a[:,:,1],180);a[:,:,2]=np.minimum(a[:,:,2],90);im=Image.fromarray(a)
    im.save(AQUI/('carreta-'+nombre+'-0.webp'),quality=90,method=6,lossless=nombre=='normal')
d={'tamano':np.ptp(p,axis=0).tolist(),'mallas':[{'material':0,'position':cod(p,'<f4'),'normal':cod(n,'<f4'),'uv':cod(uv,'<f4'),'index':cod(tri,'<u2')}]}
(AQUI/'datos.js').write_text('/* Carreta de Scenario; dimensiones en metros, suelo en Y=0. */\nwindow.CAOZ_CARRETA_DATOS='+json.dumps(d,separators=(',',':'))+';\n')
(AQUI/'procedencia.json').write_text(json.dumps({'fuenteSha256':sha,'asset':'asset_kgWKekrj5WsfL7ejbcvee5sT','triangulos':len(tri),'tamano':d['tamano'],'atlas':1024,'fuenteEscenario':'../propuestas-scenario/carreta-brazos/procedencia.json'},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'triangulos':len(tri),'tamano':d['tamano']}))

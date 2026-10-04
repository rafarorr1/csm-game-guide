"""Convierte fachadas y pozo GLB a mallas locales compartidas.
Uso: python preparar.py /carpeta/GLB
Requiere numpy y Pillow; las transformaciones se fijan en ajustes.json.
"""
import base64, hashlib, io, json, math, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
salida=Path(__file__).resolve().parent
entrada=Path(sys.argv[1])
ajustes=json.loads((salida/'ajustes.json').read_text())
datos={}; informe={}
def cod(a,t): return base64.b64encode(a.astype(t).tobytes()).decode()
def transformar(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
    m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(n.get('scale',[1,1,1]))
    m[:3,3]=n.get('translation',[0,0,0]);return m
# Resta un prisma sin dejar triángulos cruzando el vano; interpola normales y UV.
def recortar(poligono,eje,limite,signo):
    dentro=[]; fuera=[]
    for i,a in enumerate(poligono):
        b=poligono[(i+1)%len(poligono)];da=(a[eje]-limite)*signo;db=(b[eje]-limite)*signo
        (dentro if da>=0 else fuera).append(a)
        if (da>=0)!=(db>=0):
            v=a+(b-a)*(da/(da-db));dentro.append(v);fuera.append(v)
    return dentro,fuera
def abrir_vano(vertices,tri):
    resultado=[]
    for cara in vertices[tri]:
        candidatos=[cara]
        for eje,limite,signo in [(0,-1.974,1),(0,-.314,-1),(1,-.05,1),(1,2.835,-1),(2,1.60,1),(2,3.2,-1)]:
            siguientes=[]
            for p in candidatos:
                dentro,fuera=recortar(p,eje,limite,signo)
                if len(fuera)>=3:
                    for j in range(1,len(fuera)-1):resultado.extend([fuera[0],fuera[j],fuera[j+1]])
                if len(dentro)>=3:siguientes.append(dentro)
            candidatos=siguientes
            if not candidatos:break
    return np.array(resultado)
for tipo,ajuste in ajustes.items():
    archivo=entrada/(tipo+'.glb')
    if not archivo.exists():continue
    fuente=archivo.read_bytes(); assert fuente[:4]==b'glTF'
    largo=struct.unpack_from('<I',fuente,12)[0];doc=json.loads(fuente[20:20+largo]);binario=fuente[28+largo:]
    def atributo(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];ancho={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];t=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']])
        return np.ndarray((a['count'],ancho),dtype=t,buffer=binario,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',ancho*t.itemsize),t.itemsize)).copy()
    piezas=[]
    def visitar(i,padre):
        nodo=doc['nodes'][i];m=padre@transformar(nodo)
        if 'mesh' in nodo:
            for pr in doc['meshes'][nodo['mesh']]['primitives']:
                assert pr.get('mode',4)==4 and not pr.get('extensions')
                p=atributo(pr['attributes']['POSITION'])@m[:3,:3].T+m[:3,3]
                n=atributo(pr['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
                piezas.append(dict(p=p,n=n,uv=atributo(pr['attributes']['TEXCOORD_0']),tri=atributo(pr['indices']).reshape(-1,3),mat=pr.get('material',0)))
        for h in nodo.get('children',[]):visitar(h,m)
    for i in doc['scenes'][doc.get('scene',0)]['nodes']:visitar(i,np.eye(4))
    giro=math.radians(ajuste['giro']);r=np.array([[math.cos(giro),0,math.sin(giro)],[0,1,0],[-math.sin(giro),0,math.cos(giro)]])
    for p in piezas:p['p']=p['p']@r.T;p['n']=p['n']@r.T
    todos=np.concatenate([p['p'] for p in piezas]);mn=todos.min(axis=0);mx=todos.max(axis=0);centro=(mn+mx)/2;centro[1]=mn[1]
    escala=np.array(ajuste['tamano'])/(mx-mn)
    mallas=[]
    for p in piezas:
        p['p']=(p['p']-centro)*escala;p['n']/=escala;p['n']/=np.maximum(np.linalg.norm(p['n'],axis=1,keepdims=True),1e-8)
        assert len(p['p'])==len(p['n'])==len(p['uv'])
        assert np.isfinite(p['uv']).all()
        assert np.isfinite(p['p']).all() and np.isfinite(p['n']).all() and len(p['p'])<65536
        m=dict(position=cod(p['p'],'<f4'),normal=cod(p['n'],'<f4'),uv=cod(p['uv'],'<f4'),index=cod(p['tri'],'<u2'),material=p['mat'])
        if tipo=='piedra':
            v=abrir_vano(np.concatenate([p['p'],p['n'],p['uv']],axis=1),p['tri']);v[:,3:6]/=np.maximum(np.linalg.norm(v[:,3:6],axis=1,keepdims=True),1e-8)
            m['abierta']=dict(position=cod(v[:,:3],'<f4'),normal=cod(v[:,3:6],'<f4'),uv=cod(v[:,6:],'<f4'))
        mallas.append(m)
    for i,mat in enumerate(doc['materials']):
        pbr=mat['pbrMetallicRoughness']
        for nombre,t in [('color',pbr.get('baseColorTexture')),('normal',mat.get('normalTexture')),('superficie',pbr.get('metallicRoughnessTexture'))]:
            if t:
                vista=doc['bufferViews'][doc['images'][doc['textures'][t['index']]['source']]['bufferView']]
                im=Image.open(io.BytesIO(binario[vista.get('byteOffset',0):vista.get('byteOffset',0)+vista['byteLength']])).convert('RGB')
                tam=2048 if nombre=='color' and tipo!='pozo' else 512 if nombre=='superficie' else 1024
                im=im.resize((tam,tam),Image.Resampling.LANCZOS)
            else:im=Image.new('RGB',(4,4),(128,128,255) if nombre=='normal' else (255,230,0))
            a=np.asarray(im).copy()
            if nombre=='normal':
                n=a.astype(float)/127.5-1;n/=np.maximum(np.linalg.norm(n,axis=2,keepdims=True),1e-8);a=np.clip((n+1)*127.5,0,255).astype('uint8')
            if nombre=='superficie':a[:,:,0]=255;a[:,:,1]=np.maximum(a[:,:,1],195);a[:,:,2]=np.minimum(a[:,:,2],45)
            Image.fromarray(a).save(salida/f'{tipo}-{nombre}-{i}.webp',quality=90,method=6,lossless=nombre=='superficie')
    tri=sum(len(p['tri']) for p in piezas);assert tri<18000 if tipo!='pozo' else tri<8000
    datos[tipo]=dict(mallas=mallas,triangulos=tri,tamano=ajuste['tamano'])
    if tipo!='pozo':
        p=np.concatenate([p['p'] for p in piezas]);c=p[p[:,1]>p[:,1].max()-.18].mean(axis=0);c[1]=p[:,1].max()+.1;datos[tipo]['humo']=c.tolist()
    informe[tipo]=dict(sha256=hashlib.sha256(fuente).hexdigest(),triangulos=tri,materiales=len(doc['materials']),tamano=ajuste['tamano'],giro=ajuste['giro'],limitesFuente=[mn.tolist(),mx.tolist()])
(salida/'datos.js').write_text('/* Arquitectura de Scenario; generado por preparar.py. */\nwindow.CAOZ_ARQUITECTURA_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
(salida/'geometria.json').write_text(json.dumps(informe,indent=2)+'\n');print(json.dumps(informe))

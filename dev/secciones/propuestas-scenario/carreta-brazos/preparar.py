"""Prepara copias de revisión de los recursos de Scenario.
No crea un rig ni cambia la topología: conserva UV y texturas PBR incrustadas.
Uso: python preparar.py (requiere numpy). Los originales permanecen intactos.
"""
import copy, hashlib, json, struct
from pathlib import Path
import numpy as np
BASE=Path(__file__).resolve().parent
TIPOS={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
ANCHOS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def leer(ruta):
    b=ruta.read_bytes()
    magic,version,tamano=struct.unpack_from('<III',b)
    assert magic==0x46546c67 and version==2 and tamano==len(b),ruta
    chunks=[];i=12
    while i<len(b):
        n,t=struct.unpack_from('<II',b,i);i+=8;chunks.append((t,b[i:i+n]));i+=n
    d=json.loads(next(v for t,v in chunks if t==0x4e4f534a))
    assert len(d['buffers'])==1 and 'uri' not in d['buffers'][0]
    return d,chunks,next(v for t,v in chunks if t==0x004e4942)
def atributo(d,b,i):
    a=d['accessors'][i];v=d['bufferViews'][a['bufferView']]
    assert 'sparse' not in a
    ancho=ANCHOS[a['type']];tipo=np.dtype(TIPOS[a['componentType']])
    return np.ndarray((a['count'],ancho),dtype=tipo,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',ancho*tipo.itemsize),tipo.itemsize))
def matriz(n):
    if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
    x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
    m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]))
    m[:3,3]=n.get('translation',[0,0,0]);return m
def revisar(d,b):
    puntos=[];triangulos=0;vertices=0
    def visitar(i,padre):
        nonlocal triangulos,vertices
        n=d['nodes'][i];m=padre@matriz(n)
        if 'mesh' in n:
            for pr in d['meshes'][n['mesh']]['primitives']:
                assert pr.get('mode',4)==4
                p=atributo(d,b,pr['attributes']['POSITION'])
                assert np.isfinite(p).all()
                ids=atributo(d,b,pr['indices']).reshape(-1)
                assert len(ids)%3==0 and ids.min()>=0 and ids.max()<len(p)
                for k in ['NORMAL','TEXCOORD_0']:
                    a=atributo(d,b,pr['attributes'][k]);assert len(a)==len(p) and np.isfinite(a).all()
                puntos.append(p@m[:3,:3].T+m[:3,3]);triangulos+=len(ids)//3;vertices+=len(p)
        for j in n.get('children',[]):visitar(j,m)
    for i in d['scenes'][d.get('scene',0)]['nodes']:visitar(i,np.eye(4))
    p=np.concatenate(puntos);return p.min(0),p.max(0),{'triangulos':triangulos,'vertices':vertices,'materiales':len(d.get('materials',[])),'rig':bool(d.get('skins'))}
def escribir(ruta,d,chunks):
    j=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4)
    contenido=b''.join(struct.pack('<II',len(v),t)+v for t,v in [(0x4e4f534a,j)]+[(t,v)for t,v in chunks if t!=0x4e4f534a])
    ruta.write_bytes(struct.pack('<III',0x46546c67,2,12+len(contenido))+contenido)
def preparar(nombre,fuente,alto,anclaje,espejo=False):
    original=BASE/fuente
    if not original.exists():return
    d,chunks,b=leer(original);mi,ma,informe=revisar(d,b);factor=alto/(ma[1]-mi[1])
    centro=(mi+ma)/2;centro[1]=ma[1] if anclaje=='superior' else mi[1] if anclaje=='suelo' else centro[1]
    escala=np.array([-factor if espejo else factor,factor,factor])
    raiz={'name':nombre,'children':d['scenes'][d.get('scene',0)]['nodes'],'scale':escala.tolist(),'translation':(-centro*escala).tolist()}
    d['nodes'].append(raiz);d['scenes'][d.get('scene',0)]['nodes']=[len(d['nodes'])-1]
    d.setdefault('asset',{}).setdefault('extras',{}).update({'proyecto':'Caoz ARPG','estado':'Malla de revisión sin rig','alturaMetros':alto,'espejoX':espejo,'fuente':fuente})
    destino=BASE/(nombre+'.glb');escribir(destino,d,chunks)
    d2,_,b2=leer(destino);mi2,ma2,info=revisar(d2,b2)
    assert abs((ma2[1]-mi2[1])-alto)<1e-6
    return {'archivo':destino.name,'original':fuente,'sha256':hashlib.sha256(destino.read_bytes()).hexdigest(),'sha256Original':hashlib.sha256(original.read_bytes()).hexdigest(),'dimensionesMetros':np.round(ma2-mi2,6).tolist(),'limitesMetros':[mi2.tolist(),ma2.tolist()],'anclaje':anclaje,'espejoX':espejo,**info}
resultados=[]
for nombre,fuente,alto,anclaje,espejo in [
    ('carreta','carreta-original.glb',1.25,'suelo',False),
    ('brazo-izquierdo','brazo-izquierdo-original.glb',.8,'superior',False),
    ('brazo-derecho','brazo-izquierdo-original.glb',.8,'superior',True),
    ('vendas-izquierdas','vendas-original.glb',.25,'centro',False),
    ('vendas-derechas','vendas-original.glb',.25,'centro',True),
    ('hombrera-izquierda','hombrera-original.glb',.34,'centro',False)]:
    r=preparar(nombre,fuente,alto,anclaje,espejo)
    if r:resultados.append(r)
(BASE/'revision-mallas.json').write_text(json.dumps(resultados,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(resultados,ensure_ascii=False))


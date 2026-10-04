"""Monta las piernas y botas de Scenario sobre el cuerpo con brazos aprobado.
Uso: python preparar.py /carpeta/con/pierna-original.glb/y/bota-original.glb
Conserva el rig, los dedos y sus correctivos. Requiere numpy y Pillow.
"""
import base64, hashlib, io, json, struct, sys, subprocess
from pathlib import Path
import numpy as np
from PIL import Image

AQUI=Path(__file__).resolve().parent
BASE=AQUI.parent/'adreida-brazos-scenario'
FUENTES=Path(sys.argv[1])
def cod(a,t):return base64.b64encode(np.asarray(a,dtype=t).tobytes()).decode()
def dec(d,k,t,n):return np.frombuffer(base64.b64decode(d[k]),dtype=t).reshape(-1,n).copy()
def suave(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def rz(a):return np.array([[np.cos(a),-np.sin(a),0],[np.sin(a),np.cos(a),0],[0,0,1]])
def ry(a):return np.array([[np.cos(a),0,np.sin(a)],[0,1,0],[-np.sin(a),0,np.cos(a)]])
def matriz(n):
    if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
    x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
    m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]))
    m[:3,3]=n.get('translation',[0,0,0]);return m
def glb(nombre):
    raw=(FUENTES/nombre).read_bytes();assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
    chunks={};i=12
    while i<len(raw):
        n,t=struct.unpack_from('<II',raw,i);i+=8;chunks[t]=raw[i:i+n];i+=n
    d=json.loads(chunks[0x4e4f534a]);b=chunks[0x004e4942]
    def att(i):
        a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];ancho={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];tipo=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']])
        return np.ndarray((a['count'],ancho),dtype=tipo,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',ancho*tipo.itemsize),tipo.itemsize)).copy()
    mallas=[]
    def visitar(i,m):
        no=d['nodes'][i];m=m@matriz(no)
        if 'mesh' in no:
            for pr in d['meshes'][no['mesh']]['primitives']:mallas.append((pr,m))
        for j in no.get('children',[]):visitar(j,m)
    for i in d['scenes'][d.get('scene',0)]['nodes']:visitar(i,np.eye(4))
    assert len(mallas)==1,'La pieza debe contener una malla PBR'
    pr,m=mallas[0];p=att(pr['attributes']['POSITION'])@m[:3,:3].T+m[:3,3]
    uv=att(pr['attributes']['TEXCOORD_0']);tri=att(pr['indices']).reshape(-1,3)
    ma=d['materials'][pr.get('material',0)];pbr=ma['pbrMetallicRoughness'];mapas={}
    for tipo,entrada in [('color',pbr['baseColorTexture']),('superficie',pbr['metallicRoughnessTexture']),('normal',ma['normalTexture'])]:
        im=d['images'][d['textures'][entrada['index']]['source']];v=d['bufferViews'][im['bufferView']]
        mapas[tipo]=Image.open(io.BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB')
    return p,uv,tri,mapas,hashlib.sha256(raw).hexdigest()
def normales(p,tri):
    _,soldado=np.unique(np.round(p,6),axis=0,return_inverse=True);n=np.zeros((soldado.max()+1,3))
    caras=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
    for i in range(3):np.add.at(n,soldado[tri[:,i]],caras)
    n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10);return n[soldado]
def frontal(p):
    # El extremo del pie respecto al tobillo identifica el frente sin depender del exportador.
    p=p.copy();p[:,1]-=p[:,1].min();alto=np.ptp(p[:,1])
    tobillo=p[(p[:,1]>.14*alto)&(p[:,1]<.22*alto)][:,[0,2]]
    centro=(tobillo.min(0)+tobillo.max(0))/2
    pie=p[p[:,1]<.12*alto][:,[0,2]]-centro
    frente=pie[np.linalg.norm(pie,axis=1)>.9*np.linalg.norm(pie,axis=1).max()].mean(0)
    angulo=-np.arctan2(frente[0],frente[1]);return p@ry(angulo).T

d=json.loads((BASE/'datos.js').read_text().split('=',1)[1].rsplit(';',1)[0]);nombres=d['huesos']
p0=dec(d,'posicion','<f4',3);n0=dec(d,'normal','<f4',3);uv0=dec(d,'uv','<f4',2)
si0=dec(d,'hueso','u1',4);sw0=dec(d,'peso','<f4',4);tri0=dec(d,'triangulos','<u2',3);pieza0=dec(d,'pieza','u1',1)
ids_pierna=[i for i,n in enumerate(nombres)if n.startswith(('pierna','rodilla','pie'))]
w=np.where(np.isin(si0,ids_pierna),sw0,0).sum(1)
# La falda conserva su superficie y sus siete huesos; sólo se retiran las piernas viejas.
quitar=(w[tri0].mean(1)>.25)&(p0[tri0,1].mean(1)<.965)
viejos,tri_base=np.unique(tri0[~quitar],return_inverse=True)
remapa=np.full(len(p0),-1,dtype=int);remapa[viejos]=np.arange(len(viejos))
partes=[]
for parte in d['partes']:
    inicio=parte['inicio'];fin=inicio+parte['vertices'];seleccion=(viejos>=inicio)&(viejos<fin);ids=viejos[seleccion]
    caras=tri0[~quitar];caras=caras[np.all((caras>=inicio)&(caras<fin),axis=1)]
    local=np.full(len(p0),-1,dtype=int);local[ids]=np.arange(len(ids))
    partes.append({'nombre':parte['nombre'],'p':p0[ids],'n':n0[ids],'uv':uv0[ids],'tri':local[caras],'si':si0[ids],'sw':sw0[ids],'pieza':pieza0[ids].ravel()})
# Los brazos conservan exactamente sus índices relativos y los deltas de cierre.
agarre={}
for lado,a in d['agarre'].items():
    ids=dec(a,'indices','<u2',1).ravel();assert np.all(remapa[ids]>=0)
    agarre[lado]={**a,'indices':cod(remapa[ids],'<u2')}

lp,lu,lt,lm,lsha=glb('pierna-original.glb');lp=frontal(lp);lp/=np.ptp(lp[:,1]);altura=lp[:,1].copy()
cortes=np.array([.12,.25,.42,.58,.72,.86,.97]);centros=[]
for y in cortes:
    r=lp[abs(altura-y)<.025];centros.append((r[:,[0,2]].min(0)+r[:,[0,2]].max(0))/2)
centros=np.array(centros)
for eje,col in [(0,0),(2,1)]:lp[:,eje]-=np.interp(altura,cortes,centros[:,col])
lp[:,1]=np.interp(altura,[0,.10,.58,1],[0,.07,.50,1.01])
# Encaja la anatomía en el volumen del personaje aprobado, sin cambiar sus articulaciones.
escala_radial=.79
lp[:,[0,2]]*=escala_radial
lt=lt[np.max(lp[lt,1],axis=1)>.315]
lu_ids,lt=np.unique(lt,return_inverse=True);lp=lp[lu_ids];lu=lu[lu_ids];lt=lt.reshape(-1,3)
bp,bu,bt,bm,bsha=glb('bota-original.glb');bp=frontal(bp);bp*=.415/np.ptp(bp[:,1])
zona=(bp[:,1]>.21)&(bp[:,1]<.32);centro=(bp[zona][:,[0,2]].min(0)+bp[zona][:,[0,2]].max(0))/2
bp[:,[0,2]]-=centro
# Se reserva holgura para la pantorrilla y se conserva el hueco real de la caña.
bp[:,0]*=.165/np.ptp(bp[:,0]);bp[:,2]*=.285/np.ptp(bp[:,2]);bp[:,2]+=.015

for lado,s in [('I',1),('D',-1)]:
    for nombre,p,uv,tri,tile,pieza in [('pierna',lp,lu,lt,(1024,1024,1024),4),('bota',bp,bu,bt,(0,1536,512),5)]:
        pp=p.copy();pp[:,0]*=s;pp[:,1]-=.97;pp=pp@rz(s*.12).T+np.array([s*.11,.97,0])
        if nombre=='bota':pp[:,1]-=pp[:,1].min()
        y=p[:,1];ss=np.zeros((len(p),4),dtype=np.uint8);ww=np.zeros((len(p),4))
        if nombre=='pierna':
            cadera=suave(.89,1.015,y);muslo=suave(.447,.55,y)
            ss[:]=[nombres.index('cadera'),nombres.index('pierna'+lado),nombres.index('rodilla'+lado),0]
            ww[:,0]=cadera;ww[:,1]=(1-cadera)*muslo;ww[:,2]=(1-cadera)*(1-muslo)
        else:
            tobillo=suave(.065,.175,y);ss[:,0]=nombres.index('pie'+lado);ss[:,1]=nombres.index('rodilla'+lado)
            ww[:,0]=1-tobillo;ww[:,1]=tobillo
        tt=tri[:,[0,2,1]] if s<0 else tri.copy();x,z,tam=tile
        u=uv*(tam-8)/2048+np.array([x+4,z+4])/2048
        partes.append({'nombre':nombre+lado,'p':pp,'n':normales(pp,tt),'uv':u,'tri':tt,'si':ss,'sw':ww,'pieza':np.full(len(p),pieza)})

for tipo in ['color','normal','superficie']:
    atlas=Image.open(BASE/(tipo+'.webp')).convert('RGB')
    for mapas,(x,y,tam),nombre in [(lm,(1024,1024,1024),'pierna'),(bm,(0,1536,512),'bota')]:
        im=mapas[tipo].resize((tam-8,tam-8),Image.Resampling.LANCZOS)
        if tipo=='superficie':
            a=np.array(im);a[:,:,0]=255;a[:,:,1]=np.maximum(a[:,:,1],178);a[:,:,2]=0;im=Image.fromarray(a)
        im=Image.fromarray(np.pad(np.asarray(im),((4,4),(4,4),(0,0)),mode='edge'));atlas.paste(im,(x,y))
    atlas.save(AQUI/(tipo+'.webp'),quality=91,method=6,lossless=tipo=='normal')

rangos=[];offset=0;tris=[]
for a in partes:
    rangos.append({'nombre':a['nombre'],'inicio':offset,'vertices':len(a['p']),'triangulos':len(a['tri'])})
    tris.append(a['tri']+offset);offset+=len(a['p'])
p=np.concatenate([a['p']for a in partes]);tt=np.concatenate(tris);sw=np.concatenate([a['sw']for a in partes]);assert offset<65535
assert np.isfinite(p).all() and np.allclose(sw.sum(1),1) and tt.max()<offset
datos={'huesos':nombres,'dedos':d['dedos'],'agarre':agarre,'partes':rangos,'piernas':True,
       'posicion':cod(p,'<f4'),'normal':cod(np.concatenate([a['n']for a in partes]),'<f4'),'uv':cod(np.concatenate([a['uv']for a in partes]),'<f4'),
       'hueso':cod(np.concatenate([a['si']for a in partes]),'u1'),'peso':cod(sw,'<f4'),'triangulos':cod(tt,'<u2'),'pieza':cod(np.concatenate([a['pieza']for a in partes]),'u1')}
(AQUI/'datos.js').write_text('/* Generado por preparar.py: Adreida con brazos, piernas y botas modulares. */\nwindow.CAOZ_ADREIDA_PIERNAS_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
informe={'fuentesSha256':{'pierna':lsha,'bota':bsha,'cuerpoConBrazos':hashlib.sha256((BASE/'datos.js').read_bytes()).hexdigest()},'triangulos':len(tt),'vertices':len(p),'partes':rangos,'atlas':2048,'falanges':20,'correctivosAgarre':2,'rig':'Esqueleto original: cadera, muslos, rodillas y pies; cuatro pesos máximo. Sin huesos adicionales.','retiradosCuerpo':int(quitar.sum()),'fuenteEscenario':'../propuestas-scenario/piernas-adreida/procedencia.json'}
(AQUI/'procedencia.json').write_text(json.dumps(informe,indent=2,ensure_ascii=False)+'\n')
subprocess.run(['node',str(AQUI/'preparar-apoyo.mjs')],check=True)
print(json.dumps(informe))

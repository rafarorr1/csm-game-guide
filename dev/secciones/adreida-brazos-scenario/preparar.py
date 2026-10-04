"""Integra los brazos modulares de Scenario sin cambiar el esqueleto de locomoción.
Uso: python preparar.py /carpeta/con/los/cuatro/GLB/originales
Requiere numpy y Pillow. Genera un atlas y un cuerpo de dos llamadas de dibujo con el hacha.
"""
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
def rz(a):return np.array([[np.cos(a),-np.sin(a),0],[np.sin(a),np.cos(a),0],[0,0,1]])
d=leer_datos(BASE/'datos.js');nombres=list(d['huesos']);dedos=[];partes=[];fuentes={}
p0=dec(d,'posicion','<f4',3);uv0=dec(d,'uv','<f4',2);n0=dec(d,'normal','<f4',3);tri0=dec(d,'triangulos','<u2',3)
si0=dec(d,'hueso','u1',4);sw0=dec(d,'peso','<f4',4)
# Quita brazos, vendas y hombrera integrados en la malla antigua, conservando pelo y torso.
brazo_ids=[i for i,n in enumerate(nombres) if n.startswith(('brazo','ante','mano'))]
wa=np.where(np.isin(si0,brazo_ids),sw0,0).sum(1)
metal=np.asarray(Image.open(BASE/'superficie.webp'))[:,:,2]
color=np.asarray(Image.open(BASE/'color.webp'))
tx=np.clip((uv0[:,0]*1024).astype(int),0,1023);ty=np.clip((uv0[:,1]*1024).astype(int),0,1023)
hombrera=(p0[:,0]>.205)&(p0[:,1]>1.43)&(p0[:,1]<1.79)&(p0[:,2]>-.16)&(p0[:,2]<.20)&(color[ty,tx].mean(1)>45)
quitar=(wa[tri0].mean(1)>.24)|(hombrera[tri0].sum(1)>=2)
tri=tri0[~quitar];usados,inv=np.unique(tri,return_inverse=True)
partes.append({'nombre':'cuerpo','p':p0[usados],'n':n0[usados],'uv':uv0[usados],'tri':inv.reshape(-1,3),'si':si0[usados],'sw':sw0[usados],'atlas':'cuerpo','pieza':0})
atlases={'cuerpo':{k:Image.open(BASE/(k+'.webp')).convert('RGB')for k in ['color','normal','superficie']}}
arm,uv,tri,mapas,sha=glb('brazo-izquierdo-original.glb');fuentes['brazo']=sha;atlases['brazo']=mapas
arm/=np.ptp(arm[:,1]);prof=arm[:,1].max()-arm[:,1]
# Endereza la pose neutra y mantiene el volumen de cada sección del miembro.
cortes=np.array([0,.08,.20,.30,.43,.55,.65,.71,.79,1])
centros=[]
for t in cortes:
    zona=arm[np.abs(prof-min(t,.79))<.022]
    if not len(zona):zona=arm[np.argsort(abs(prof-min(t,.79)))[:50]]
    centros.append((zona[:,[0,2]].min(0)+zona[:,[0,2]].max(0))/2)
centros=np.array(centros);centros[-1]=centros[-2]
def canonico(a):
    t=arm[:,1].max()-a[:,1];p=a.copy()
    p[:,0]=(a[:,0]-np.interp(t,cortes,centros[:,0]))*.64
    p[:,2]=(a[:,2]-np.interp(t,cortes,centros[:,1]))*.64-.035*suave(.59,.77,t)
    p[:,1]=np.interp(t,[0,.08,.43,.70,.79,.875,1],[.058,0,-.31,-.55,-.60,-.65,-.735])
    return p
pa=canonico(arm)
# Falanges independientes: dos bisagras por dedo, sin pesos cruzados con la falda.
centros_x=np.array([.128,.083,.044,.005,-.029])
etiquetas=['Pulgar','Indice','Medio','Anular','Menique']
finales=[.91,.981,1,.974,.948];bases=[.825,.873,.875,.873,.863]
dedo_vert=np.argmin(abs(arm[:,0,None]-centros_x[None,:]),axis=1)
for lado,s in [('I',1),('D',-1)]:
    hombro=np.array([s*.25,1.4972,0]);R=rz(s*.31);Rm=rz(s*np.pi/2);mano=hombro+R@np.array([0,-.6,0])
    pp=pa.copy();pp[:,0]*=s;pp=pp@R.T+hombro
    ss=np.zeros((len(pp),4),dtype=np.uint8);ww=np.zeros((len(pp),4));ww[:,0]=1
    ib,ia,im=[nombres.index(n+lado)for n in ['brazo','ante','mano']]
    codo=suave(-.35,-.27,pa[:,1]);wmano=1-suave(-.59,-.54,pa[:,1])
    ss[:,0]=ia;ss[:,1]=ib;ss[:,2]=im
    ww[:,0]=(1-codo)*(1-wmano);ww[:,1]=codo*(1-wmano);ww[:,2]=wmano
    # El borde superior comparte el torso para que no se abra la axila al elevar el brazo.
    union=suave(.005,.052,pa[:,1]);ss[:,3]=nombres.index('torso');ww*=1-union[:,None];ww[:,3]=union
    for j,nombre in enumerate(etiquetas):
        base=bases[j];medio=(base+finales[j])*.5
        def punto(t):
            zona=(dedo_vert==j)&(abs(prof-t)<.015)
            if not zona.any():zona=(dedo_vert==j)&(abs(prof-t)<.04)
            v=np.median(pa[zona],axis=0);v[1]=np.interp(t,[0,.08,.43,.70,.79,.875,1],[.058,0,-.31,-.55,-.60,-.65,-.735]);v[0]*=s
            return v@R.T+hombro
        b0,b1=punto(base),punto(medio);local0=Rm.T@(b0-mano);local1=Rm.T@(b1-b0)
        ids=[]
        for k,pos in enumerate([local0,local1]):
            nom='dedo'+lado+nombre+str(k);ids.append(len(nombres));nombres.append(nom)
            dedos.append({'nombre':nom,'padre':'mano'+lado if k==0 else 'dedo'+lado+nombre+'0','posicion':pos.tolist(),'lado':lado,'dedo':nombre,'articulacion':k})
        zona=(dedo_vert==j)&(prof>base-.015)
        w=suave(base-.015,base+.027,prof[zona]);distal=suave(medio-.012,medio+.014,prof[zona])
        ss[zona]=np.array([im,ids[0],ids[1],0]);ww[zona]=np.column_stack([1-w,w*(1-distal),w*distal,np.zeros(sum(zona))])
    tt=tri[:,[0,2,1]] if s<0 else tri.copy()
    partes.append({'nombre':'brazo'+lado,'p':pp,'n':normales(pp,tt),'uv':uv.copy(),'tri':tt,'si':ss,'sw':ww,'atlas':'brazo','pieza':1})
# Las vendas quedan fuera de la piel y siguen la misma mezcla de codo y muñeca.
vend,vuv,vtri,vmap,sha=glb('vendas-original.glb');fuentes['vendas']=sha;atlases['vendas']=vmap
vend-=np.array([(vend[:,0].max()+vend[:,0].min())/2,vend[:,1].max(),(vend[:,2].max()+vend[:,2].min())/2])
vend*=.235/np.ptp(vend[:,1]);vend[:,1]-=.338
for s,lado in [(1,'I'),(-1,'D')]:
    pp=vend.copy()
    for i,y in enumerate(pp[:,1]):
        tramo=abs(pa[:,1]-y)<.012;r=pa[tramo]
        if not len(r):continue
        centro=(r[:,[0,2]].max(0)+r[:,[0,2]].min(0))/2;radio=(r[:,[0,2]].max(0)-r[:,[0,2]].min(0))/2+.008
        banda=abs(vend[:,1]-y)<.012;ext=np.max(abs(vend[banda][:,[0,2]]),axis=0)
        pp[i,[0,2]]=centro+vend[i,[0,2]]*radio/np.maximum(ext,.001)
    pp[:,0]*=s;pp=pp@rz(s*.31).T+np.array([s*.25,1.4972,0])
    ss=np.zeros((len(pp),4),dtype=np.uint8);ww=np.zeros((len(pp),4));ss[:,0]=nombres.index('ante'+lado);ww[:,0]=1
    tt=vtri[:,[0,2,1]] if s<0 else vtri
    partes.append({'nombre':'vendas'+lado,'p':pp,'n':normales(pp,tt),'uv':vuv.copy(),'tri':tt,'si':ss,'sw':ww,'atlas':'vendas','pieza':2})
# Hombrera rígida, anclada al brazo, con la abertura orientada hacia el torso.
hp,hu,ht,hm,sha=glb('hombrera-original.glb');fuentes['hombrera']=sha;atlases['hombrera']=hm
hp-=np.array([(hp[:,0].max()+hp[:,0].min())/2,hp[:,1].max(),(hp[:,2].max()+hp[:,2].min())/2]);hp*=.285/np.ptp(hp[:,1]);hp=hp@rz(.31).T+np.array([.277,1.6572,0])
ss=np.zeros((len(hp),4),dtype=np.uint8);ww=np.zeros((len(hp),4));ss[:,0]=nombres.index('brazoI');ww[:,0]=1
partes.append({'nombre':'hombreraI','p':hp,'n':normales(hp,ht),'uv':hu,'tri':ht,'si':ss,'sw':ww,'atlas':'hombrera','pieza':3})
# Un solo atlas 2048: el cuerpo y los brazos conservan 1024; vendas/hombrera 512.
regiones={'cuerpo':(0,0,1024),'brazo':(1024,0,1024),'vendas':(0,1024,512),'hombrera':(512,1024,512)}
for tipo in ['color','normal','superficie']:
    fondo={'color':(70,60,43),'normal':(128,128,255),'superficie':(255,210,0)}[tipo];atlas=Image.new('RGB',(2048,2048),fondo)
    for nombre,mapas in atlases.items():
        x,y,tam=regiones[nombre];im=mapas[tipo].resize((tam-8,tam-8),Image.Resampling.LANCZOS)
        if tipo=='superficie' and nombre!='cuerpo':
            a=np.array(im);a[:,:,0]=255;a[:,:,1]=np.maximum(a[:,:,1],155 if nombre=='hombrera' else 175);a[:,:,2]=np.minimum(a[:,:,2],110) if nombre=='hombrera' else 0;im=Image.fromarray(a)
        tile=Image.fromarray(np.pad(np.array(im),((4,4),(4,4),(0,0)),mode='edge'));atlas.paste(tile,(x,y))
    atlas.save(AQUI/(tipo+'.webp'),quality=91,method=6,lossless=tipo=='normal')
pos=[];nor=[];uvs=[];sis=[];sws=[];tris=[];ids=[];offset=0;rangos=[]
for a in partes:
    x,y,tam=regiones[a['atlas']];u=a['uv']*(tam-8)/2048+np.array([x+4,y+4])/2048
    pos.append(a['p']);nor.append(a['n']);uvs.append(u);sis.append(a['si']);sws.append(a['sw']);tris.append(a['tri']+offset);ids.extend([a['pieza']]*len(a['p']))
    rangos.append({'nombre':a['nombre'],'inicio':offset,'vertices':len(a['p']),'triangulos':len(a['tri'])});offset+=len(a['p'])
p=np.concatenate(pos);tt=np.concatenate(tris);w=np.concatenate(sws);assert offset<65535 and np.allclose(w.sum(1),1)
datos={'huesos':nombres,'dedos':dedos,'partes':rangos,'posicion':cod(p,'<f4'),'normal':cod(np.concatenate(nor),'<f4'),'uv':cod(np.concatenate(uvs),'<f4'),'hueso':cod(np.concatenate(sis),'u1'),'peso':cod(w,'<f4'),'triangulos':cod(tt,'<u2'),'pieza':cod(ids,'u1')}
(AQUI/'datos.js').write_text('/* Generado por preparar.py: cuerpo, brazos, vendas y hombrera con un atlas. */\nwindow.CAOZ_ADREIDA_MODULAR_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
(AQUI/'procedencia.json').write_text(json.dumps({'fuentesSha256':fuentes,'triangulos':len(tt),'vertices':len(p),'partes':rangos,'atlas':2048,'falanges':20,'rig':'Esqueleto original más dos falanges por dedo. Hombrera rígida; cuatro pesos máximo.','fuenteEscenario':'../propuestas-scenario/carreta-brazos/procedencia.json'},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'triangulos':len(tt),'vertices':len(p),'retiradosCuerpo':int(sum(quitar)),'partes':rangos}))


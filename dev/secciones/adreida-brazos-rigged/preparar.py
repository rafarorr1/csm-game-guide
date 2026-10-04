"""Adapta los brazos entregados a las articulaciones y atlas de Adreida.
Uso: python preparar.py fuente.json enlace-juego.json textura.png
No vuelve a generar el cuerpo, la cara, las piernas, las vendas ni la hombrera.
"""
import base64, json, sys, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
AQUI=Path(__file__).resolve().parent
fuente=json.loads(Path(sys.argv[1]).read_text());enlace=json.loads(Path(sys.argv[2]).read_text());textura=Path(sys.argv[3])
def leer(p):return json.loads(p.read_text().split('=',1)[1].rsplit(';',1)[0])
def dec(d,k,t,n):return np.frombuffer(base64.b64decode(d[k]),dtype=t).reshape(-1,n).copy()
def cod(a,t):return base64.b64encode(np.asarray(a,dtype=t).tobytes()).decode()
def unit(a):return a/max(np.linalg.norm(a),1e-12)
def trans(m,p):return np.asarray(p)@m[:3,:3].T+m[:3,3]
def quat(r):
    # Matriz ortonormal → xyzw, sin dependencias del entorno de modelado.
    q=np.empty(4);tr=np.trace(r)
    if tr>0:
        s=np.sqrt(tr+1)*2;q[:]=[(r[2,1]-r[1,2])/s,(r[0,2]-r[2,0])/s,(r[1,0]-r[0,1])/s,s/4]
    else:
        i=int(np.argmax(np.diag(r)));j=(i+1)%3;k=(i+2)%3;s=np.sqrt(1+r[i,i]-r[j,j]-r[k,k])*2
        q[i]=s/4;q[j]=(r[j,i]+r[i,j])/s;q[k]=(r[k,i]+r[i,k])/s;q[3]=(r[k,j]-r[j,k])/s
    return (q/np.linalg.norm(q)).tolist()
def normales(p,t):
    _,w=np.unique(np.round(p,6),axis=0,return_inverse=True);n=np.zeros((w.max()+1,3));f=np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]])
    for j in range(3):np.add.at(n,w[t[:,j]],f)
    return (n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-12))[w]
def suave(a,b,x):t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def rx(a):c,s=np.cos(a),np.sin(a);return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def ry(a):c,s=np.cos(a),np.sin(a);return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def rz(a):c,s=np.cos(a),np.sin(a);return np.array([[c,-s,0],[s,c,0],[0,0,1]])
d=leer(AQUI.parent/'adreida-piernas-scenario/datos.js');cara=leer(AQUI.parent/'adreida-rostro/datos.js')
base={k:dec(d,k,t,n)for k,t,n in [('posicion','<f4',3),('normal','<f4',3),('uv','<f4',2),('hueso','u1',4),('peso','<f4',4),('pieza','u1',1)]}
tri=dec(d,'triangulos','<u2',3);triCara=dec(cara,'indicesCuerpo','<u2',3)
conservar=np.ones(len(base['posicion']),bool)
for parte in d['partes']:
    if parte['nombre'] in ['brazoI','brazoD']:conservar[parte['inicio']:parte['inicio']+parte['vertices']]=False
remap=np.full(len(conservar),-1);remap[conservar]=np.arange(sum(conservar))
tris=[remap[tri[conservar[tri].all(1)]]];caras=[remap[triCara[conservar[triCara].all(1)]]]
partes=[dict(p,inicio=int(remap[p['inicio']]))for p in d['partes']if p['nombre']not in ['brazoI','brazoD']]
# Retira sólo huesos sin geometría: los veinte dedos anteriores ya no intervienen.
nombres=[n for n in d['huesos']if not n.startswith('dedo')]
old2new=np.array([nombres.index(n)if n in nombres else 0 for n in d['huesos']]);base['hueso']=old2new[base['hueso']]
arrays={k:[v[conservar]]for k,v in base.items()};dedos=[]
J={n:np.array(v['matrixWorldFilas'])for n,v in enlace['poses']['enlace']['huesos'].items()}
B=fuente['huesos'];P=np.array([v['p']for v in fuente['vertices']]);UV=np.array([v['uv']for v in fuente['vertices']]);T=np.array(fuente['triangulos']);offset=sum(conservar)
# Sistemas anatómicos, no una rotación arbitraria de la malla: cada codo y muñeca
# se ajusta a la longitud existente, conservando los pesos originales del artista.
for lado,s,suf in [('I',1,'l'),('D',-1,'r')]:
    def bone(n):return B[n+'_'+suf]
    def head(n):return np.array(bone(n)['head'])
    h,e,w=head('upperarm'),head('lowerarm'),head('hand')
    mcps=np.array([head(n+'_01')for n in ['index','middle','ring','pinky']]);f=unit(mcps.mean(0)-w)
    ancho=mcps[0]-mcps[-1];across=unit(ancho-f*np.dot(ancho,f));normal=np.cross(f,across)
    S=np.column_stack([f,across,normal]);D=np.column_stack([[-s,0,0],[0,-1,0],[0,0,s]])
    Rmano=J['mano'+lado][:3,:3];Rm=Rmano@D@S.T;escala=.092
    manoLocal=np.array([s*.064,.012,-.035]);muñeca=trans(J['mano'+lado],manoLocal)
    M=np.eye(4);M[:3,:3]=Rm*escala;M[:3,3]=muñeca-M[:3,:3]@w
    matrices={};destinos={'upperarm':(J['brazo'+lado][:3,3],J['ante'+lado][:3,3]),'lowerarm':(J['ante'+lado][:3,3],muñeca)}
    for nombre,(a,b) in destinos.items():
        origen=head(nombre);fin=np.array(bone(nombre)['tail']);u=unit(fin-origen)
        # La línea radial sigue el pulgar para conservar la pronación del antebrazo.
        radial=unit(across-u*np.dot(across,u));src=np.column_stack([radial,u,np.cross(radial,u)])
        v=unit(b-a);lateral=Rmano@np.array([0,-1,0]);rad=unit(lateral-v*np.dot(lateral,v));dst=np.column_stack([rad,v,np.cross(rad,v)])
        mm=np.eye(4);mm[:3,:3]=dst@np.diag([.117,np.linalg.norm(b-a)/np.linalg.norm(fin-origen),.117])@src.T;mm[:3,3]=a-mm[:3,:3]@origen;matrices[nombre+'_'+suf]=mm
    matrices['clavicle_'+suf]=matrices['upperarm_'+suf];matrices['hand_'+suf]=M
    prefijos={'thumb':'Pulgar','index':'Indice','middle':'Medio','ring':'Anular','pinky':'Menique'}
    mapanombres={'clavicle_'+suf:'brazo'+lado,'upperarm_'+suf:'brazo'+lado,'lowerarm_'+suf:'ante'+lado,'hand_'+suf:'mano'+lado}
    globales={};reposo={}
    for eng,esp in prefijos.items():
        for i in range(3):
            bn=eng+'_'+str(i+1).zfill(2)+'_'+suf;nombre='dedo'+lado+esp+str(i);mapanombres[bn]=nombre;nombres.append(nombre);matrices[bn]=M
            gm=np.eye(4);gm[:3,:3]=Rm@np.array(B[bn]['matrix'])[:3,:3];gm[:3,3]=trans(M,B[bn]['head']);globales[bn]=gm
            padre='mano'+lado if not i else 'dedo'+lado+esp+str(i-1);mp=J['mano'+lado]if not i else globales[eng+'_'+str(i).zfill(2)+'_'+suf]
            local=np.linalg.inv(mp)@gm;reposo[bn]=local
            dedos.append({'nombre':nombre,'padre':padre,'posicion':local[:3,3].tolist(),'rotacion':quat(local[:3,:3]),'abierto':quat(local[:3,:3]),'cerrado':quat(local[:3,:3]),'lado':lado,'dedo':esp,'articulacion':i})
    # Ajusta flexión y oposición de las falanges con una búsqueda determinista.
    # El objetivo se mide en el marco del mango, independiente de la animación.
    cerrado={};datos_por_nombre={f['nombre']:f for f in dedos}
    for eng,esp in prefijos.items():
        bn0=eng+'_01_'+suf;g0=np.linalg.inv(J['mano'+lado])@globales[bn0]
        rests=[reposo[eng+'_'+str(i+1).zfill(2)+'_'+suf] for i in range(3)]
        lens=[np.linalg.norm(np.array(B[eng+'_'+str(i+1).zfill(2)+'_'+suf]['tail'])-np.array(B[eng+'_'+str(i+1).zfill(2)+'_'+suf]['head']))*escala for i in range(3)]
        def fk(params,guardar=False):
            gm=np.eye(4);points=[];mats=[]
            for i in range(3):
                local=rests[i].copy();parent=np.eye(4)if not i else gm
                if not i:local=g0.copy()
                # Flexión en el plano anatómico de la palma, más oposición del pulgar.
                eje=parent[:3,:3].T@np.array([0,1,0]);x,y,z=eje;a=params[i];c=np.cos(a);ss=np.sin(a);V=np.array([[0,-z,y],[z,0,-x],[-y,x,0]])
                giro=np.eye(3)*c+(1-c)*np.outer(eje,eje)+ss*V
                local[:3,:3]=giro@local[:3,:3]
                if i==0 and eng=='thumb':local[:3,:3]=rz(params[3])@local[:3,:3]
                gm=parent@local;mats.append(gm.copy());points.append(gm[:3,3].copy())
            points.append(gm[:3,3]+gm[:3,1]*lens[-1]);return np.array(points),mats
        # Radio óseo que deja el volumen de piel justo por fuera del mango.
        def coste(a):
            pts,_=fk(a);rad=np.linalg.norm(pts[:,[0,2]],axis=1)
            target=np.array([g0[0,3],g0[1,3],g0[2,3]])
            # Falanges abrazando la cara delantera, pulgar en oposición a los otros cuatro.
            fin=np.array([-s*.012,g0[1,3],.030])if eng!='thumb' else np.array([-s*.020,-.034,.018])
            err=np.sum((rad[1:]-.037)**2)*4+np.sum((pts[-1]-fin)**2)*5
            err+=np.sum(np.maximum(0,.033-rad[1:])**2)*40
            if eng!='thumb':err+=np.sum((pts[:,1]-g0[1,3])**2)*3
            err+=sum((np.maximum(0,-s*np.array(a[:3]))*.006)**2)
            return float(err)
        a=np.array([s*.8,s*.8,s*.65,0.]if eng!='thumb'else[s*.25,s*.4,s*.5,s*.25]);best=coste(a)
        for step in [.4,.2,.1,.05,.02,.01,.004]:
            for repeat in range(80):
                improved=False
                for k in range(4 if eng=='thumb'else 3):
                    for sign in [-1,1]:
                        aa=a.copy();aa[k]+=sign*step
                        if abs(aa[k])>1.9:continue
                        cc=coste(aa)
                        if cc<best:best=cc;a=aa;improved=True
                if not improved:break
        pts,mats=fk(a)
        for i,gm in enumerate(mats):
            parent=np.eye(4)if not i else mats[i-1];local=np.linalg.inv(parent)@gm
            dfi=datos_por_nombre['dedo'+lado+esp+str(i)];dfi['cerrado']=quat(local[:3,:3])
        print(lado,esp,'ángulos',a.round(3).tolist(),'radios',np.linalg.norm(pts[:,[0,2]],axis=1).round(3).tolist(),'punta',pts[-1].round(3).tolist())
    # Separa sólo por lado anatómico; ninguna cara cruza entre los dos brazos.
    face=T[(P[T,0].mean(1)*s)>0];usados,inv=np.unique(face,return_inverse=True);tt=inv.reshape(-1,3);p=[];si=[];sw=[]
    for vi in usados:
        v=fuente['vertices'][vi];pesos={k:x for k,x in v['pesos'].items()if k in matrices};total=sum(pesos.values())
        assert total>.5,(vi,pesos,total)
        punto=sum(trans(matrices[k],v['p'])*x/total for k,x in pesos.items());p.append(punto)
        combinados={}
        for k,x in pesos.items():
            nn=mapanombres[k];combinados[nn]=combinados.get(nn,0)+x/total
        # El ancla del juego está en el mango, por delante de la muñeca anatómica.
        # La muñeca acompaña la palma; la mezcla empieza antes en el antebrazo.
        wh=sum(x for k,x in combinados.items()if k=='mano'+lado or k.startswith('dedo'))
        nuevo=max(wh,float(suave(.015,.42,wh)))
        if wh>0 and wh<1:
            combinados={k:x*(nuevo/wh if k=='mano'+lado or k.startswith('dedo')else(1-nuevo)/(1-wh))for k,x in combinados.items()}
        # El borde superior se mezcla con el torso para evitar una abertura de axila.
        local=trans(np.linalg.inv(J['brazo'+lado]),punto);union=float(suave(.003,.052,local[1]))
        if union:
            combinados={k:x*(1-union)for k,x in combinados.items()};combinados['torso']=union
        pares=sorted(combinados.items(),key=lambda a:-a[1])[:4];tot=sum(x for _,x in pares)
        si.append([nombres.index(k)for k,x in pares]+[0]*(4-len(pares)));sw.append([x/tot for k,x in pares]+[0]*(4-len(pares)))
    p=np.array(p)
    # La piel queda bajo las vendas conservadas, no las atraviesa al flexionar.
    venda=next(a for a in d['partes']if a['nombre']=='vendas'+lado)
    marco=np.linalg.inv(J['ante'+lado]);vp=trans(marco,base['posicion'][venda['inicio']:venda['inicio']+venda['vertices']]);pp=trans(marco,p)
    y0,y1=vp[:,1].min(),vp[:,1].max()
    for i,q in enumerate(pp):
        if not y0<q[1]<y1:continue
        anillo=vp[np.abs(vp[:,1]-q[1])<.012]
        if len(anillo)<8:continue
        lo,hi=anillo[:,[0,2]].min(0),anillo[:,[0,2]].max(0);centro=(lo+hi)/2;radio=np.maximum((hi-lo)*.42,.006)
        v=q[[0,2]]-centro;r=np.linalg.norm(v/radio)
        if r>1:
            mezcla=float(suave(y0,y0+.009,q[1])*(1-suave(y1-.009,y1,q[1])))
            pp[i,[0,2]]=q[[0,2]]+(centro+v/r-q[[0,2]])*mezcla
    p=trans(J['ante'+lado],pp);uv=UV[usados].copy();uv[:,1]=1-uv[:,1];uv=uv*(1016/2048)+np.array([1028,4])/2048
    for k,v in {'posicion':p,'normal':normales(p,tt),'uv':uv,'hueso':si,'peso':sw,'pieza':np.ones((len(p),1))}.items():arrays[k].append(np.asarray(v))
    tris.append(tt+offset);caras.append(tt+offset);partes.append({'nombre':'brazo'+lado,'inicio':int(offset),'vertices':len(p),'triangulos':len(tt)});offset+=len(p)
for k,t in [('posicion','<f4'),('normal','<f4'),('uv','<f4'),('hueso','u1'),('peso','<f4'),('pieza','u1')]:d[k]=cod(np.concatenate(arrays[k]),t)
d.update(huesos=nombres,dedos=dedos,partes=partes,triangulos=cod(np.concatenate(tris),'<u2'),indicesConRostro=cod(np.concatenate(caras),'<u2'),brazosRigged=True,agarre={l:{'indices':'','posicion':'','normal':''}for l in ['I','D']})
assert offset<65535
(AQUI/'datos.js').write_text('/* Brazos del archivo del usuario; cuerpo y piernas conservados. */\nwindow.CAOZ_ADREIDA_PIERNAS_DATOS='+json.dumps(d,separators=(',',':'))+';\n')
# Mantiene la distribución y todos los otros texeles del atlas original.
# Tinte oliva acorde al rostro; se conserva la textura y el detalle real de la mano.
skin=Image.open(textura).convert('RGB').resize((1016,1016),Image.Resampling.LANCZOS);c=np.asarray(skin,dtype=float);lum=c.mean(2,keepdims=True)
c=np.clip(lum*np.array([.65,.57,.40])+((c-lum)*.32),0,255).astype(np.uint8)
# Publica exclusivamente los texeles de los brazos: el resto de la plantilla humana no se utiliza.
mascara=Image.new('L',(1016,1016),0);dibujo=ImageDraw.Draw(mascara)
for t in T:dibujo.polygon([(float(UV[i,0]*1015),float((1-UV[i,1])*1015))for i in t],fill=255)
mascara=np.asarray(mascara.filter(ImageFilter.MaxFilter(9)))>0
c[~mascara]=[128,111,79]
for tipo in ['color','normal','superficie']:
    atlas=Image.open(AQUI.parent/'adreida-piernas-scenario'/(tipo+'.webp')).convert('RGB')
    tile=c if tipo=='color'else np.full((1016,1016,3),(128,128,255)if tipo=='normal'else(255,198,0),np.uint8)
    atlas.paste(Image.fromarray(np.pad(tile,((4,4),(4,4),(0,0)),mode='edge')),(1024,0));atlas.save(AQUI/(tipo+'.webp'),lossless=True,method=6)
(AQUI/'fuente.json').write_text(json.dumps({'archivo':fuente['fuente'],'sha256':fuente['sha256'],'textura':textura.name,'texturaSha256':hashlib.sha256(textura.read_bytes()).hexdigest(),'verticesBrazos':len(P),'triangulosBrazos':len(T),'falanges':30,'verticesCuerpo':int(offset),'triangulosCuerpo':sum(len(t)for t in tris),'triangulosConRostroRecortado':sum(len(t)for t in caras),'origen':'Archivo proporcionado por el usuario; el original no se modifica.'},indent=2)+'\n')
print('Resultado',offset,'vértices,',sum(len(t)for t in tris),'triángulos,',len(nombres),'huesos.')

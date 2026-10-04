"""Prepara mapas de relieve aproximado desde el albedo de Scenario; numpy y Pillow.
Uso: python preparar-scenario.py piso-scenario.png
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

fuente=Path(sys.argv[1]); destino=Path(__file__).parent
im=Image.open(fuente).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
c=np.asarray(im,dtype=np.float32)/255
# Emparejar suavemente los bordes opuestos antes de derivar las normales.
for eje in [0,1]:
    c=np.swapaxes(c,0,eje)
    for i in range(12):
        w=(1-i/12)**2*.5;a=c[i].copy();b=c[-1-i].copy()
        c[i]=a*(1-w)+b*w;c[-1-i]=b*(1-w)+a*w
    c=np.swapaxes(c,0,eje)
def desenfoque(a,r):
    t=np.tile(a,(3,3));n=a.shape[0]
    return np.asarray(Image.fromarray(np.uint8(np.clip(t,0,1)*255)).filter(ImageFilter.GaussianBlur(r)),dtype=np.float32)[n:2*n,n:2*n]/255
l=c@np.array([.2126,.7152,.0722]);prom=desenfoque(l,2.3)
bajo,alto=np.percentile(prom,[9,62]);h=np.clip((prom-bajo)/(alto-bajo),0,1)
h=desenfoque(h,1.4)*.87+np.clip(l-prom+.5,0,1)*.13
# Normales OpenGL: la altura crece hacia fuera; las juntas se quedan hundidas.
dx=(np.roll(h,-1,1)-np.roll(h,1,1))*13;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*13
n=np.stack([-dx,dy,np.ones_like(h)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
superficie=np.stack([.7+.3*h,.94-.17*h,h],axis=-1)
for nombre,datos,perdida in [('color',c,True),('normal',n*.5+.5,False),('superficie',superficie,False)]:
    imagen=Image.fromarray(np.uint8(np.clip(datos,0,1)*255))
    if nombre!='color': imagen=imagen.resize((512,512),Image.Resampling.LANCZOS)
    imagen.save(destino/('scenario-'+nombre+'.webp'),quality=90,lossless=not perdida,method=6)
procedencia={'asset':'asset_m5Ap8khG8NvPSPmjBVWCbkW5','modelo':'model_openai-gpt-image-2-5-sunburst','fecha':'2026-10-04','team_id':'team_fusHPzE5VJ4KYZ3QPyxC2Eaa','project_id':'proj_yCSENgpggrHw8YbSmZXSuQ4w','coleccion':'col_GsqEB9NDtoryU5BeFLRWY9jT','costeCU':12,'sha256':hashlib.sha256(fuente.read_bytes()).hexdigest(),'resolucion':{'color':1024,'normal':512,'superficie':512},'escalaMetros':3.8,'color':'sRGB; bordes emparejados para repetición','normal':'OpenGL lineal; relieve aproximado derivado de la luminancia, no medido','superficie':'R: oclusión, G: rugosidad, B: altura aproximada','render':'Parallax de tres muestras sólo en el suelo; una malla, sin teselación ni nuevas luces.'}
(destino/'scenario-procedencia.json').write_text(json.dumps(procedencia,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({p.name:p.stat().st_size for p in destino.glob('scenario-*.webp')}))

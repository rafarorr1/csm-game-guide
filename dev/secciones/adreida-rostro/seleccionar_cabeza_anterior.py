"""Retira la cara anterior del cuerpo sin cambiar vértices, pesos ni morphs de agarre.

Uso: python seleccionar_cabeza_anterior.py /carpeta/de/trabajo
Dependencias: numpy y Pillow. Produce máscara JSON y diagnóstico visual; no escribe datos.js.
La máscara está calibrada para adreida-piernas-scenario/datos.js y su atlas de color.
"""
import json,base64,pathlib,collections,hashlib,math,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont
aqui=pathlib.Path(__file__).resolve().parent
if len(sys.argv)!=2:raise SystemExit('Uso: python seleccionar_cabeza_anterior.py /carpeta/de/trabajo')
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
source=aqui.parent/'adreida-piernas-scenario';raw=(source/'datos.js').read_text();d=json.loads(raw.split('=',1)[1].strip().removesuffix(';'))
def arr(key,typ,n):return np.frombuffer(base64.b64decode(d[key]),typ).reshape(-1,n)
v=arr('posicion','<f4',3);uv=arr('uv','<f4',2);f=arr('triangulos','<u2',3);w=arr('peso','<f4',4);b=arr('hueso','u1',4);tex=np.asarray(Image.open(source/'color.webp').convert('RGB'));alto,ancho=tex.shape[:2];hw=(w*(b==d['huesos'].index('cabeza'))).sum(1);c=v[f].mean(1)
# Islas UV reales: el GLB separa los vértices en las costuras del atlas.
body=(f<8792).all(1);vf=collections.defaultdict(list)
for fi in np.flatnonzero(body):
 for vi in f[fi]:vf[int(vi)].append(int(fi))
components=[];seen=set();compid=np.full(len(f),-1,dtype=np.int32)
for fi in np.flatnonzero(body):
 if int(fi) in seen:continue
 q=[int(fi)];seen.add(int(fi));cc=[]
 while q:
  a=q.pop();cc.append(a)
  for vi in f[a]:
   for fi2 in vf[int(vi)]:
    if fi2 not in seen:seen.add(fi2);q.append(fi2)
 compid[cc]=len(components);components.append(cc)
xy=np.clip((uv*np.array([ancho-1,alto-1])).astype(int),0,[ancho-1,alto-1]);rgbv=tex[xy[:,1],xy[:,0]].astype(float);rgb=rgbv[f].mean(1)
# Muestrear interior UV, no sólo las esquinas: algunas islas llevan piel dentro de un triángulo con borde negro.
bary=np.array([[a/4,b/4,(4-a-b)/4] for a in range(5) for b in range(5-a)],dtype=float)
sampled=np.einsum('sv,tvc->tsc',bary,uv[f]);coords=np.clip((sampled*np.array([ancho-1,alto-1])).astype(int),0,[ancho-1,alto-1]);samples=tex[coords[:,:,1],coords[:,:,0]].astype(float);rgb=samples.mean(1)
skinfrac=((samples[:,:,0]>32)&((samples[:,:,0]-samples[:,:,1])>5)&((samples[:,:,0]-samples[:,:,2])>10)).mean(1)
compstats=[];hair=np.zeros(len(f),bool)
for n,cc in enumerate(components):
 ids=np.unique(f[cc]);color=rgbv[ids].mean(0);stats={'id':n,'triangulos':len(cc),'primerTriangulo':cc[0],'min':v[ids].min(0).tolist(),'max':v[ids].max(0).tolist(),'colorRGB':color.round(2).tolist()}
 stats['peloOscuro']=bool(color[0]<28 or (color[0]-color[1]<3.5 and color[0]<44))
 hair[cc]=stats['peloOscuro'];compstats.append(stats)
# Se preserva el collar por debajo de 1.615 m, el casco capilar superior y las piezas nuevas.
remove=body&(c[:,1]>1.615)&(c[:,1]<1.84)&(hw[f].mean(1)>.92)&~hair
# Una isla de piel puede contener el extremo de un mechón: preservar sus triángulos oscuros.
darktri=(rgb[:,0]<28)|((rgb[:,0]-rgb[:,1]<3.5)&(rgb[:,0]<44))
coreface=(np.abs(c[:,0])<.065)&(c[:,1]>1.65)&(c[:,1]<1.79)&(c[:,2]>.10)
remove&=~(darktri&(skinfrac<.20)&~coreface)
# La ropa cerca de los hombros nunca participa, aunque tenga sombra cálida.
remove&=(np.abs(c[:,0])<.165)
keep=f[~remove];removed=f[remove]
report={'fuente':str(source/'datos.js'),'sha256Fuente':hashlib.sha256(raw.encode()).hexdigest(),'nota':'Sólo se filtran índices; atributos, orden de vértices, pesos, dedos y morphs de agarre permanecen intactos. Pelo identificado por islas UV oscuras y acromáticas; cara/orejas cálidas se retiran a partir de 1.615 m. Revisar montaje con cabeza nueva.','triangulosAntes':len(f),'triangulosDespues':len(keep),'triangulosRetirados':int(remove.sum()),'verticesModificados':0,'indicesCuerpo':base64.b64encode(keep.astype('<u2').tobytes()).decode(),'triangulosRetiradosGlobales':np.flatnonzero(remove).tolist(),'triangulosConservadosPelo':int((hair&body&(c[:,1]>1.5)).sum()),'islas':compstats,'parametros':{'yMinima':1.615,'yMaxima':1.84,'pesoCabezaMinimo':.92,'xMaximo':.165,'clasificacion':'RGB isla: pelo si R<28 o (R-G<3.5 y R<44)'}}
(out/'mascara-cabeza-anterior.json').write_text(json.dumps(report,separators=(',',':')))
# Render ortográfico CPU para revisar textura, retiro y pelo sin tocar Blender.
W,H=500,510;faces=np.flatnonzero(v[f][:,:,1].max(1)>1.43);font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',16)if pathlib.Path('/System/Library/Fonts/Helvetica.ttc').is_file()else ImageFont.load_default();canvas=Image.new('RGB',(W*3,H*3+40),(22,25,28));labels=['Frente','Perfil','Espalda'];modes=['Original','Rojo: retirar','Conservar']
def render(angle,mode):
 co,si=math.cos(angle),math.sin(angle);screen=np.column_stack(((v[:,0]*co-v[:,2]*si+.25)*1000,(1.96-v[:,1])*1000));depth=v[:,0]*si+v[:,2]*co
 pixels=np.full((H,W,3),28.0);zbuf=np.full((H,W),-np.inf)
 for fi in faces:
  if mode==2 and remove[fi]:continue
  ids=f[fi];p=screen[ids];xmin=max(0,int(np.floor(p[:,0].min())));xmax=min(W-1,int(np.ceil(p[:,0].max())));ymin=max(0,int(np.floor(p[:,1].min())));ymax=min(H-1,int(np.ceil(p[:,1].max())))
  if xmin>xmax or ymin>ymax:continue
  den=(p[1,1]-p[2,1])*(p[0,0]-p[2,0])+(p[2,0]-p[1,0])*(p[0,1]-p[2,1])
  if abs(den)<1e-9:continue
  yy,xx=np.mgrid[ymin:ymax+1,xmin:xmax+1];xx=xx+.5;yy=yy+.5
  a=((p[1,1]-p[2,1])*(xx-p[2,0])+(p[2,0]-p[1,0])*(yy-p[2,1]))/den;bb=((p[2,1]-p[0,1])*(xx-p[2,0])+(p[0,0]-p[2,0])*(yy-p[2,1]))/den;cc=1-a-bb;zz=a*depth[ids[0]]+bb*depth[ids[1]]+cc*depth[ids[2]]
  mask=(a>=0)&(bb>=0)&(cc>=0)&(zz>zbuf[ymin:ymax+1,xmin:xmax+1])
  if not mask.any():continue
  tu=a*uv[ids[0],0]+bb*uv[ids[1],0]+cc*uv[ids[2],0];tv=a*uv[ids[0],1]+bb*uv[ids[1],1]+cc*uv[ids[2],1];tx=np.clip((tu*(ancho-1)).astype(int),0,ancho-1);ty=np.clip((tv*(alto-1)).astype(int),0,alto-1);color=tex[ty,tx].astype(float)*1.65
  if mode==1 and remove[fi]:color=color*.35+np.array([210,35,30])*.65
  pix=pixels[ymin:ymax+1,xmin:xmax+1];zb=zbuf[ymin:ymax+1,xmin:xmax+1];pix[mask]=color[mask];zb[mask]=zz[mask]
 return Image.fromarray(np.clip(pixels,0,255).astype('uint8'))
for row in range(3):
 for col,angle in enumerate([0,math.pi/2,math.pi]):
  im=render(angle,row);dr=ImageDraw.Draw(im);dr.text((12,12),modes[row]+' · '+labels[col],font=font,fill='white');canvas.paste(im,(col*W,row*H+40))
ImageDraw.Draw(canvas).text((10,10),'Retiro cabeza antigua · textura aclarada 1.65× para revisar · rojo se elimina, resto conserva',font=font,fill='white');canvas.save(out/'diagnostico-retiro-cabeza.png')
print(json.dumps({k:report[k] for k in ['triangulosAntes','triangulosDespues','triangulosRetirados','triangulosConservadosPelo','verticesModificados']},indent=2))

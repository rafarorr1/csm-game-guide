"""Completa el atlas PBR: iris ámbar, esmalte y mucosa. Sin texturas de luz pintada."""
from pathlib import Path
import sys,numpy as np
from PIL import Image
s=Path(sys.argv[1]);dest=Path(__file__).parent
im=np.array(Image.open(s/'color-bake.png').convert('RGB'));n=np.array(Image.open(s/'normal-bake.png').convert('RGB'));h,w=im.shape[:2];yy,xx=np.mgrid[:h,:w];u=(xx+.5)/w;v=1-(yy+.5)/h
# La zona inferior del atlas nunca contiene piel, para evitar bordes contaminados por el bake.
banda=v<.135;im[banda]=[34,16,14];n[banda]=[128,128,255]
superficie=np.full_like(im,184);superficie[banda]=190
muco=(u>.24)&(u<.30)&(v>.02)&(v<.10);im[muco]=[45,18,19];superficie[muco]=155
marfil=(u>.15)&(u<.23)&(v>.02)&(v<.10);im[marfil]=[177,159,118];superficie[marfil]=145
rx=(u-.064)/.060;ry=(v-.064)/.060;r=np.sqrt(rx*rx+ry*ry);ang=np.arctan2(ry,rx);ojo=(u<.128)&(v<.128)
esclera=np.stack([173-22*np.minimum(r,1),158-26*np.minimum(r,1),123-22*np.minimum(r,1)],axis=-1)
im[ojo]=esclera[ojo];superficie[ojo]=185
iris=ojo&(r<.52);fibra=np.sin(ang*53+r*80)*.5+np.sin(ang*127-r*29)*.2
corona=np.clip((r-.16)/.13,0,1)*np.clip((.52-r)/.08,0,1)
c=np.stack([39+87*corona+fibra*20*corona,28+57*corona+fibra*14*corona,13+13*corona+fibra*5*corona],axis=-1)
im[iris]=np.clip(c[iris],0,255);pupila=ojo&(r<.17);im[pupila]=[6,6,5]
for nombre,data in [('color',im),('normal',n),('superficie',superficie)]:
 image=Image.fromarray(data.astype('uint8'));image.save(s/(nombre+'-atlas.png'))
 # El exportador invierte V para TextureLoader.flipY=false: invertir también la normal tangente Y.
 if nombre=='normal':
  web=data.copy();web[:,:,1]=255-web[:,:,1];image=Image.fromarray(web.astype('uint8'))
 image.save(dest/(nombre+'.webp'),lossless=nombre!='color',quality=94,method=6)
print('Atlas',w,h)

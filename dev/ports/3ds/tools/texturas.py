"""Albedo original a RGB565 y mipmaps Morton 8×8, listos para PICA200."""
import json, struct, sys
from pathlib import Path
from PIL import Image, ImageEnhance
jobs=json.loads(Path(sys.argv[1]).read_text())
def morton(x,y):
    return ((x&1)|((y&1)<<1)|((x&2)<<1)|((y&2)<<2)|((x&4)<<2)|((y&4)<<3))
for job in jobs:
    size=job['size']
    im=Image.open(job['source']).convert('RGB').resize((size,size),Image.Resampling.LANCZOS)
    im=ImageEnhance.Brightness(im).enhance(1.1)
    output=bytearray(struct.pack('<III',0x33584554,size,size))
    level=size
    while level>=8:
        mip=im.resize((level,level),Image.Resampling.LANCZOS);raw=mip.load();out=bytearray(level*level*2)
        for y in range(level):
            for x in range(level):
                r,g,b=raw[x,level-1-y]
                at=((y//8)*(level//8)+(x//8))*64+morton(x%8,y%8)
                struct.pack_into('<H',out,at*2,((r>>3)<<11)|((g>>2)<<5)|(b>>3))
        output.extend(out);level//=2
    Path(job['output']).write_bytes(output)

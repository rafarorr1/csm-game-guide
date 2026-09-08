"""Comprueba que el banco publicado sea íntegro y no tenga clips rotos o recortados."""
import hashlib,json,struct,wave
from pathlib import Path
raiz=Path(__file__).resolve().parent
catalogo=json.loads((raiz/'audio/catalogo.json').read_text())['sonidos']
assert len({s['id'] for s in catalogo})==len(catalogo)==34
for s in catalogo:
    p=raiz/s['archivo'];assert p.parent==raiz/'audio' and p.suffix=='.wav'
    assert hashlib.sha256(p.read_bytes()).hexdigest()[:16]==s['version'],s['id']
    with wave.open(str(p),'rb') as w:
        assert w.getsampwidth()==2 and w.getnchannels()==2 and w.getframerate()==32000
        assert abs(w.getnframes()/w.getframerate()-s['duracion'])<.001
        b=w.readframes(w.getnframes());m=struct.unpack('<'+'h'*(len(b)//2),b)
        assert 10<max(map(abs,m))<30000,'Silencio o saturación en '+s['id']
        assert max(map(abs,m[:2]))==0 and max(map(abs,m[-2:]))==0,'Borde abrupto en '+s['id']
    assert 0<=s['volumen']<=1 and 30<=s['intervalo']<=2000
print('34 WAV originales íntegros, con margen de mezcla y sin recorte digital.')

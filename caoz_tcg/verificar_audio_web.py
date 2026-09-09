"""Verificación byte a byte de estudio, mezclador y WAV, después de publicar."""
import concurrent.futures,hashlib,json,subprocess,sys
from pathlib import Path
raiz=Path(__file__).resolve().parent
archivos=['audio-domo.js','sonidos.html','sonidos.js','sonidos.css','audio/catalogo.json']
archivos += [s['archivo'] for s in json.loads((raiz/'audio/catalogo.json').read_text())['sonidos']]
base=sys.argv[1].rstrip('/')+'/'
def verificar(archivo):
    publicado=subprocess.check_output(['curl','-fsSL','--max-time','25',base+archivo],stderr=subprocess.PIPE)
    if hashlib.sha256(publicado).digest()!=hashlib.sha256((raiz/archivo).read_bytes()).digest():raise ValueError(archivo+' no coincide con el archivo validado.')
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(verificar,archivos))
print('Estudio y 37 sonidos verificados byte a byte en '+base)

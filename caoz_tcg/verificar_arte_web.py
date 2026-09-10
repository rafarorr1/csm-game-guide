"""Verifica el estudio de cartas y su catálogo servido después de publicar."""
import concurrent.futures, hashlib, json, subprocess, sys
from pathlib import Path
raiz = Path(__file__).resolve().parent
base = sys.argv[1].rstrip('/') + '/'
catalogo = json.loads((raiz / 'art/catalogo.json').read_text())
archivos = ['estudio.html', 'estudio.js', 'estudio.css', 'arte-remoto.js', 'art/catalogo.json']
archivos += [c['original']['url'] for c in catalogo['cartas'] if c['original']]
def verificar(archivo):
    remoto = subprocess.check_output(['curl', '-fsSL', '--max-time', '25', base + archivo], stderr=subprocess.PIPE)
    if hashlib.sha256(remoto).digest() != hashlib.sha256((raiz / archivo).read_bytes()).digest():
        raise ValueError(archivo + ' no coincide con la versión validada.')
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    list(pool.map(verificar, archivos))
print('Estudio de cartas, catálogo y originales verificados byte a byte en ' + base)

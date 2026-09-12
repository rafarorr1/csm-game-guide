"""Verifica el estudio de cartas y su catálogo servido después de publicar."""
import concurrent.futures, hashlib, json, subprocess, sys
from pathlib import Path
from urllib.parse import urlparse
raiz = Path(__file__).resolve().parent
base = sys.argv[1].rstrip('/') + '/'
catalogo = json.loads((raiz / 'art/catalogo.json').read_text())
archivos = ['estudio.html', 'estudio.js', 'estudio-publicacion.js', 'estudio-publicacion.css', 'estudio.css', 'arte-remoto.js', 'arte-vistas.js', 'estudio-vista.js', 'acabados.css', 'art/catalogo.json']
archivos += [c['original']['url'] for c in catalogo['cartas'] if c['original']]
def verificar(archivo):
    # El HTML privado de beta pertenece al estudio único: verificar su destino,
    # no comparar el HTML de producción contra una revisión todavía en beta.
    if archivo == 'estudio.html' and urlparse(base).hostname == 'beta.caoz-tcg.pages.dev':
        respuesta = subprocess.check_output(['curl', '-fsS', '--max-time', '25',
            '-o', '/dev/null', '-w', '%{http_code} %{redirect_url}', base + archivo], text=True).strip()
        if respuesta != '302 https://juego.caozcontodo.com/estudio':
            raise ValueError('El estudio beta no redirige al estudio único: ' + respuesta)
        return
    remoto = subprocess.check_output(['curl', '-fsSL', '--max-time', '25', base + archivo], stderr=subprocess.PIPE)
    if hashlib.sha256(remoto).digest() != hashlib.sha256((raiz / archivo).read_bytes()).digest():
        raise ValueError(archivo + ' no coincide con la versión validada.')
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    list(pool.map(verificar, archivos))
print(('Redirección al estudio único validada; dependencias, catálogo y originales verificados byte a byte en ' if urlparse(base).hostname == 'beta.caoz-tcg.pages.dev' else 'Estudio de cartas, catálogo y originales verificados byte a byte en ') + base)

"""Verificación byte a byte de estudio, mezclador y WAV, después de publicar."""
import concurrent.futures,hashlib,json,os,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse
raiz=Path(__file__).resolve().parent
archivos=['audio-domo.js','sonidos.html','sonidos.js','estudio-publicacion.js','estudio-publicacion.css','sonidos.css','audio/catalogo.json']
archivos += [s['archivo'] for s in json.loads((raiz/'audio/catalogo.json').read_text())['sonidos']]
base=sys.argv[1].rstrip('/')+'/'
cookie=os.environ.get('CAOZ_PORTAL_COOKIE_JAR','').strip()
def curl(*args):
    # Sólo se pasa a curl la ruta de un jar temporal, nunca el valor de una
    # cookie ni una contraseña. El publicador comprueba sus permisos antes.
    return ['curl',*args,*(['--cookie',cookie] if cookie else [])]
def verificar(archivo):
    # Sonidos beta, igual que Ilustraciones, lleva al único Estudio que puede
    # guardar y publicar. Seguir ese 302 compararía el HTML de producción con
    # el artefacto beta y convertiría una redirección correcta en falso rojo.
    if archivo == 'sonidos.html' and urlparse(base).hostname == 'beta.caoz-tcg.pages.dev':
        respuesta=subprocess.check_output(curl('-fsS','--max-time','25','-o','/dev/null','-w','%{http_code} %{redirect_url}',base+archivo),text=True).strip()
        if respuesta!='302 https://juego.caozcontodo.com/sonidos':raise ValueError('El estudio de sonidos beta no redirige al estudio único: '+respuesta)
        return
    publicado=subprocess.check_output(curl('-fsSL','--max-time','25',base+archivo),stderr=subprocess.PIPE)
    if hashlib.sha256(publicado).digest()!=hashlib.sha256((raiz/archivo).read_bytes()).digest():raise ValueError(archivo+' no coincide con el archivo validado.')
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(verificar,archivos))
print(('Redirección al estudio único validada; dependencias y 37 sonidos verificados byte a byte en ' if urlparse(base).hostname == 'beta.caoz-tcg.pages.dev' else 'Estudio y 37 sonidos verificados byte a byte en ')+base)

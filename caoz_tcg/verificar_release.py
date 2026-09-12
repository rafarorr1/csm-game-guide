"""Guardas de versiones publicadas. Sólo lee archivos; nunca copia ni publica."""
import argparse
import re
from pathlib import Path


# Es el paquete explícito de publicar.sh, no todo el repositorio. Los commits
# de documentación, pruebas locales y herramientas no cambian una release.
# La prueba de empaquetado compara esta lista con lo que realmente se copia.
ARCHIVOS_PUBLICADOS = tuple("""
index.html motor.js movil.html final.js final-core.js
campana-mesa.js campana-personaje.js campana-deseo.js campana-pitagoras.js
campana-secreto.js campana-honores.js pitagoras-pruebas.js pitagoras-mundos.js
pitagoras-cine.js pitagoras-laboratorio.js pitagoras-fps.js pitagoras-pixel.js
pitagoras-combate.js pitagoras-mesa.js dado-fisico.js moneda-fisica.js polish-aaa.js
sw.js manifest.webmanifest tests.js estudio.html audio-domo.js sonidos.html
sonidos.js sonidos.css estudio.js estudio.css estudio-publicacion.js
estudio-publicacion.css arte-vistas.js estudio-vista.js arte-remoto.js acabados.css
coleccion.css coleccion-modelo.js coleccion-juego.js coleccion-ui.js _worker.js
_routes.json audio/catalogo.json
""".split())


def numero_build(carpeta):
    archivo = Path(carpeta) / 'index.html'
    if not archivo.is_file():
        raise ValueError(f'Falta index.html para identificar la build en {carpeta}.')
    coincidencias = re.findall(r'\bconst\s+BUILD\s*=\s*\{\s*n\s*:\s*([0-9]+)\s*(?=[,}])',
                              archivo.read_text())
    if len(coincidencias) != 1 or int(coincidencias[0]) < 1:
        raise ValueError(f'BUILD inválida o ambigua en {archivo}.')
    return int(coincidencias[0])


def archivos_publicables(fuente):
    """Archivos que el publicador reemplaza; excluye docs y utilidades locales."""
    fuente = Path(fuente)
    archivos = set(ARCHIVOS_PUBLICADOS)
    archivos.update(str(f.relative_to(fuente)) for f in (fuente / 'audio').glob('*.wav')
                    if f.is_file())
    archivos.update(str(f.relative_to(fuente)) for f in (fuente / 'art').glob('*')
                    if f.is_file() and not f.name.startswith('.'))
    faltantes = sorted(f for f in archivos if not (fuente / f).is_file())
    if faltantes:
        raise ValueError('Faltan archivos publicables: ' + ', '.join(faltantes))
    return sorted(archivos)


def verificar_release(fuente, destino):
    """Impide retroceder o servir bytes diferentes bajo una build ya publicada."""
    fuente, destino = Path(fuente), Path(destino)
    nueva = numero_build(fuente)
    archivos = archivos_publicables(fuente)
    if not (destino / 'index.html').exists():
        if destino.exists() and any(destino.iterdir()):
            raise ValueError('El destino tiene archivos pero no una build identificable.')
        return {'build': nueva, 'anterior': None, 'archivos': archivos}
    anterior = numero_build(destino)
    if nueva < anterior:
        raise ValueError(f'No se puede retroceder de build {anterior} a {nueva}.')
    if nueva == anterior:
        distintos = [f for f in archivos if not (destino / f).is_file()
                     or (fuente / f).read_bytes() != (destino / f).read_bytes()]
        # publicar.sh también retira las ilustraciones .webp que ya no existen.
        distintos.extend(str(f.relative_to(destino)) for f in (destino / 'art').glob('*.webp')
                         if not (fuente / 'art' / f.name).exists())
        if distintos:
            muestra = ', '.join(sorted(set(distintos))[:8])
            raise ValueError(f'La build {nueva} ya está publicada con otros bytes ({muestra}). '
                             'Sube la build del juego antes de publicar estos cambios.')
    return {'build': nueva, 'anterior': anterior, 'archivos': archivos}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('fuente', type=Path)
    parser.add_argument('destino', type=Path)
    args = parser.parse_args()
    try:
        resultado = verificar_release(args.fuente, args.destino)
    except (ValueError, OSError, UnicodeError) as error:
        parser.exit(1, f'Release rechazada: {error}\n')
    anterior = resultado['anterior']
    if anterior == resultado['build']:
        print(f"  build {anterior}: mismos archivos publicados; reintento permitido")
    else:
        print(f"  build {resultado['build']}: avance válido desde {anterior or 'primera publicación'}")


if __name__ == '__main__':
    main()

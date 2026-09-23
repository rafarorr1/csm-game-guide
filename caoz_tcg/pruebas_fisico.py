"""Guardas del kit físico: la descarga debe llegar completa y abrirse."""
from pathlib import Path
from zipfile import BadZipFile, ZipFile


RAIZ = Path(__file__).resolve().parent
CARPETA = RAIZ / 'fisico'
HTML = CARPETA / 'index.html'
CSS = CARPETA / 'fisico.css'
KIT = CARPETA / 'Caoz-PnP-Duelo-del-Pergamino.zip'
ARCHIVOS_DEL_KIT = {
    'Caoz-PnP-Duelo-del-Pergamino.pdf',
    'Caoz-PnP-Reversos-Comunes.pdf',
}


def exige(condicion, mensaje):
    if not condicion:
        raise SystemExit('Kit físico inválido: ' + mensaje)


def main():
    exige(HTML.is_file(), 'falta fisico/index.html.')
    exige(CSS.is_file(), 'falta fisico/fisico.css.')
    exige(KIT.is_file() and KIT.stat().st_size > 1_000_000,
          'falta el ZIP descargable o parece incompleto.')
    html = HTML.read_text(encoding='utf-8')
    css = CSS.read_text(encoding='utf-8')
    exige('<html lang="es">' in html, 'la página debe declarar español.')
    exige('href="Caoz-PnP-Duelo-del-Pergamino.zip"' in html,
          'el botón no apunta al kit junto a la página.')
    exige('fisico.css' in html and 'lider_mohamed.webp' in html and 'lider_fender.webp' in html,
          'la mesa física perdió sus recursos visuales.')
    exige('@media(max-width:560px)' in css and 'prefers-reduced-motion' in css,
          'la vista física debe conservar móvil y movimiento reducido.')
    try:
        with ZipFile(KIT) as archivo:
            exige(set(archivo.namelist()) == ARCHIVOS_DEL_KIT,
                  'el ZIP debe contener exactamente las dos hojas imprimibles.')
            exige(archivo.testzip() is None, 'el ZIP contiene un archivo corrupto.')
    except BadZipFile as error:
        raise SystemExit('Kit físico inválido: ZIP ilegible (' + str(error) + ').')
    print('Kit físico: página, descarga y dos PDFs imprimibles verificados.')


if __name__ == '__main__':
    main()

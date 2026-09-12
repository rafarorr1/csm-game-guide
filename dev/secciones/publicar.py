#!/usr/bin/env python3
"""Prepara y publica la Colección aislada, sin modificar las ramas del juego."""
import argparse
import hashlib
import html
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
from urllib.parse import quote, urlsplit


RAMA = 'refs/heads/aislados'
MARCADOR = '.caoz-aislados.json'
FORMATO = 'caoz.secciones.aisladas'
SECCION = 'coleccion'
URL = 'https://aislados.caoz-tcg.pages.dev'
NO_ENCONTRADO = b'<!doctype html><html lang="es"><meta charset="utf-8"><title>No encontrado</title><body><h1>Esta ruta no existe</h1><a href="/">Volver a las secciones</a></body></html>\n'


def git(repo, *args, entrada=None, entorno=None, binario=False):
    respuesta = subprocess.check_output(['git', '-C', str(repo), *args], input=entrada,
        text=not binario, stderr=subprocess.PIPE,
        env={**os.environ, **(entorno or {})})
    return respuesta if binario else respuesta.strip()


def json_bytes(valor):
    return (json.dumps(valor, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def sha(contenido):
    return hashlib.sha256(contenido).hexdigest()


def comprobar_fuente(repo, esperado=None):
    rama = git(repo, 'branch', '--show-current')
    if rama != 'develop' and not re.fullmatch(r'(feature|fix|chore)/[a-z0-9]+(?:-[a-z0-9]+)*', rama):
        raise ValueError('La sección debe salir de develop o de una rama feature/fix/chore; nunca de main o artefactos.')
    if git(repo, 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('La fuente debe estar limpia y guardada en Git antes de preparar/publicar.')
    fuente = {'sha': git(repo, 'rev-parse', 'HEAD'), 'rama': rama}
    if esperado is not None and fuente != esperado:
        raise ValueError('La rama o revisión fuente cambió durante la preparación; hay que validar de nuevo.')
    return fuente


def archivos(carpeta):
    resultado = {}
    for archivo in sorted(Path(carpeta).rglob('*')):
        if archivo.is_symlink():
            raise ValueError('El paquete no admite enlaces simbólicos.')
        if archivo.is_file():
            nombre = archivo.relative_to(carpeta).as_posix()
            if '\n' in nombre or '\t' in nombre:
                raise ValueError('Nombre de archivo inválido en el paquete.')
            resultado[nombre] = archivo.read_bytes()
    return resultado


def landing(secciones):
    enlaces = ''.join(f'<li><a href="./{html.escape(s)}/">{html.escape(s.capitalize())}</a></li>'
                      for s in sorted(secciones))
    return ('<!doctype html><html lang="es"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Secciones de prueba · Caoz</title><body><main>'
        '<h1>Secciones de prueba</h1><p>Vistas aisladas para revisión.</p><ul>'
        + enlaces + '</ul></main></body></html>\n').encode()


def preparar(repo, salida):
    repo, salida = Path(repo).resolve(), Path(salida).resolve()
    fuente = comprobar_fuente(repo)
    for campo in git(repo, 'worktree', 'list', '--porcelain', '-z').split('\0'):
        if campo.startswith('worktree '):
            checkout = Path(campo[len('worktree '):]).resolve()
            if salida == checkout or checkout in salida.parents:
                raise ValueError('La salida debe quedar fuera de todos los checkouts.')
    if salida.exists() and (not salida.is_dir() or any(salida.iterdir())):
        raise ValueError('La salida debe ser una carpeta nueva o vacía.')
    seccion = salida / 'tcg' / SECCION
    seccion.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['node', str(repo / 'dev/secciones/exportar.mjs'), str(seccion)],
                   cwd=repo, check=True)
    for prueba in ['pruebas.mjs', 'pruebas_exportacion.mjs']:
        subprocess.run(['node', str(repo / 'dev/secciones' / prueba)], cwd=repo, check=True)
    comprobar_fuente(repo, fuente)
    contenido = archivos(seccion)
    if not {'index.html', 'movil.html', 'escritorio.html', 'procedencia.json', '_headers'} <= contenido.keys():
        raise ValueError('El exportador no generó las dos vistas y su procedencia.')
    manifiesto = {'formato': FORMATO, 'version': 1, 'seccion': SECCION,
                  'fuente': fuente, 'archivos': {f: sha(b) for f, b in contenido.items()}}
    (seccion / 'publicacion.json').write_bytes(json_bytes(manifiesto))
    registro = {'formato': FORMATO, 'version': 1, 'secciones': {
        SECCION: {'ruta': f'tcg/{SECCION}', 'fuente': fuente['sha']}}}
    (salida / MARCADOR).write_bytes(json_bytes(registro))
    (salida / 'tcg/index.html').write_bytes(landing(registro['secciones']))
    # Evita que Cloudflare responda con el índice ante archivos inexistentes.
    (salida / 'tcg/404.html').write_bytes(NO_ENCONTRADO)
    # Cloudflare interpreta _headers sólo en la raíz de su carpeta de salida.
    # La CSP común del exportador permite únicamente recursos del mismo origen.
    (salida / 'tcg/_headers').write_bytes(contenido['_headers'])
    comprobar_fuente(repo, fuente)
    return {'salida': str(salida), 'fuente': fuente, 'archivos': len(contenido)}


def validar_registro(registro):
    if not isinstance(registro, dict) or registro.get('formato') != FORMATO or registro.get('version') != 1:
        raise ValueError('La rama aislados no tiene nuestro marcador/esquema; no se modifica.')
    secciones = registro.get('secciones')
    if not isinstance(secciones, dict) or not secciones:
        raise ValueError('Registro de secciones vacío o inválido.')
    for nombre, dato in secciones.items():
        if (not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', nombre)
                or not isinstance(dato, dict) or dato.get('ruta') != f'tcg/{nombre}'
                or not re.fullmatch(r'[0-9a-f]{40,64}', str(dato.get('fuente', '')))):
            raise ValueError('Registro de secciones inválido.')
    return registro


def validar_paquete(salida):
    salida = Path(salida)
    registro = validar_registro(json.loads((salida / MARCADOR).read_text()))
    if set(registro['secciones']) != {SECCION}:
        raise ValueError('El paquete nuevo debe contener únicamente la Colección.')
    contenido = archivos(salida)
    permitidos = {MARCADOR, 'tcg/index.html', 'tcg/404.html', 'tcg/_headers'}
    if any(f not in permitidos and not f.startswith(f'tcg/{SECCION}/') for f in contenido):
        raise ValueError('El paquete contiene archivos fuera de la sección.')
    manifiesto = json.loads(contenido[f'tcg/{SECCION}/publicacion.json'])
    fuente = manifiesto.get('fuente', {})
    if (manifiesto.get('formato') != FORMATO or manifiesto.get('version') != 1
            or manifiesto.get('seccion') != SECCION
            or fuente.get('sha') != registro['secciones'][SECCION]['fuente']):
        raise ValueError('El manifiesto de publicación es inválido.')
    prefijo = f'tcg/{SECCION}/'
    hashes = {f[len(prefijo):]: sha(b) for f, b in contenido.items()
              if f.startswith(prefijo) and f != prefijo + 'publicacion.json'}
    if hashes != manifiesto.get('archivos'):
        raise ValueError('El paquete cambió después de prepararlo; los hashes no coinciden.')
    if contenido.get('tcg/_headers') != contenido.get(prefijo + '_headers'):
        raise ValueError('Las cabeceras deben coincidir con las del exportador.')
    if contenido.get('tcg/404.html') != NO_ENCONTRADO:
        raise ValueError('Falta la página 404 que evita el fallback de aplicación completa.')
    return registro, manifiesto, contenido


def revision_remota(repo):
    respuesta = git(repo, 'ls-remote', 'origin', RAMA)
    if not respuesta:
        return None
    filas = respuesta.splitlines()
    if len(filas) != 1 or filas[0].split()[1] != RAMA:
        raise ValueError('Respuesta remota inesperada para aislados.')
    return filas[0].split()[0]


def registro_remoto(repo, revision):
    # No actualizar ni FETCH_HEAD ni las referencias del checkout fuente.
    git(repo, 'fetch', '--quiet', '--no-write-fetch-head', '--refmap=', 'origin', RAMA)
    nombres = set(git(repo, 'ls-tree', '--name-only', revision).splitlines())
    if nombres != {MARCADOR, 'tcg'}:
        raise ValueError('La rama aislados contiene otro proyecto; no se modifica.')
    registro = validar_registro(json.loads(git(repo, 'show', f'{revision}:{MARCADOR}')))
    entradas = git(repo, 'ls-tree', f'{revision}:tcg').splitlines()
    esperadas = set(registro['secciones']) | {'index.html', '404.html', '_headers'}
    if {linea.split('\t', 1)[1] for linea in entradas} != esperadas:
        raise ValueError('El árbol publicado no corresponde al registro de secciones.')
    for linea in entradas:
        modo, tipo, _ = linea.split('\t')[0].split()
        nombre = linea.split('\t')[1]
        if (nombre in registro['secciones'] and (modo != '040000' or tipo != 'tree')) or (
                nombre not in registro['secciones'] and (modo != '100644' or tipo != 'blob')):
            raise ValueError('El árbol de aislados contiene entradas no permitidas.')
    return registro


def publicar(repo, salida):
    repo, salida = Path(repo).resolve(), Path(salida)
    registro, manifiesto, contenido = validar_paquete(salida)
    comprobar_fuente(repo, manifiesto['fuente'])
    anterior = revision_remota(repo)
    if anterior:
        previo = registro_remoto(repo, anterior)
        previo['secciones'][SECCION] = registro['secciones'][SECCION]
        registro = previo
    contenido[MARCADOR] = json_bytes(registro)
    contenido['tcg/index.html'] = landing(registro['secciones'])
    with tempfile.TemporaryDirectory(prefix='caoz-indice-aislados-') as temporal:
        entorno = {'GIT_INDEX_FILE': str(Path(temporal) / 'index')}
        git(repo, 'read-tree', anterior or '--empty', entorno=entorno)
        viejos = git(repo, 'ls-files', '-z', '--', f'tcg/{SECCION}/', entorno=entorno)
        if viejos:
            git(repo, 'update-index', '--force-remove', '-z', '--stdin',
                entrada=viejos + ('\0' if not viejos.endswith('\0') else ''), entorno=entorno)
        for nombre, cuerpo in sorted(contenido.items()):
            objeto = git(repo, 'hash-object', '-w', '--stdin', entrada=cuerpo, binario=True).decode().strip()
            git(repo, 'update-index', '--add', '--cacheinfo', f'100644,{objeto},{nombre}', entorno=entorno)
        arbol = git(repo, 'write-tree', entorno=entorno)
    comprobar_fuente(repo, manifiesto['fuente'])
    if revision_remota(repo) != anterior:
        raise ValueError('Otra publicación cambió aislados; vuelve a preparar/publicar sobre su versión.')
    if anterior and git(repo, 'rev-parse', f'{anterior}^{{tree}}') == arbol:
        return {'commit': anterior, 'nuevo': False, 'url': URL + '/coleccion/', 'verificado_web': False}
    padres = ['-p', anterior] if anterior else []
    commit = git(repo, 'commit-tree', arbol, *padres, entrada=(
        f"Publica Colección aislada de {manifiesto['fuente']['sha'][:12]}\n\n"
        'Sólo revisión de sección; conserva las ramas y los despliegues del juego.\n'))
    comprobar_fuente(repo, manifiesto['fuente'])
    # Nuestro commit siempre desciende del anterior. La condición explícita
    # también protege la creación inicial si otro publicador se adelanta.
    git(repo, 'push', '--quiet', f'--force-with-lease={RAMA}:{anterior or ""}',
        'origin', f'{commit}:{RAMA}')
    return {'commit': commit, 'nuevo': True, 'url': URL + '/coleccion/', 'verificado_web': False}


def verificar_remoto(salida, url_base=URL):
    _, _, contenido = validar_paquete(salida)
    url = urlsplit(url_base)
    if url.scheme not in ('http', 'https') or not url.netloc or url.username or url.password or url.query or url.fragment:
        raise ValueError('Indica una URL HTTP(S) pública, sin credenciales, query ni fragmento.')
    revisados = 0
    # _headers configura Cloudflare y no se sirve como un asset público.
    # El marcador de Git queda fuera de tcg; tampoco es una URL del preview.
    for nombre, esperado in sorted(contenido.items()):
        if not nombre.startswith(f'tcg/{SECCION}/') or PurePosixPath(nombre).name == '_headers':
            continue
        ruta = quote(nombre[len('tcg/'):], safe='/')
        direccion = url_base.rstrip('/') + '/' + ruta + '?revision=' + sha(esperado)[:16]
        recibido = subprocess.check_output(['curl', '--disable', '-fsSL', '--max-time', '30',
                                            '--url', direccion], stderr=subprocess.PIPE)
        if sha(recibido) != sha(esperado):
            raise ValueError(f'Cloudflare todavía sirve otros bytes: {nombre}.')
        revisados += 1
    return {'verificado_web': True, 'archivos': revisados, 'url': url_base.rstrip('/') + '/coleccion/'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modos = parser.add_mutually_exclusive_group(required=True)
    modos.add_argument('--solo-preparar', action='store_true')
    modos.add_argument('--publicar', action='store_true')
    modos.add_argument('--verificar', metavar='URL', help='Compara una salida ya preparada con Cloudflare.')
    parser.add_argument('--salida', type=Path, help='Carpeta nueva/vacía fuera de los checkouts; necesaria para --verificar.')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    try:
        if args.verificar:
            if args.salida is None:
                raise ValueError('--verificar requiere --salida con un paquete ya preparado.')
            resultado = verificar_remoto(args.salida, args.verificar)
        else:
            salida = args.salida or Path(tempfile.mkdtemp(prefix='caoz-seccion-preparada-'))
            resultado = preparar(repo, salida)
            if args.publicar:
                resultado.update(publicar(repo, salida))
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(f'No se completó la publicación de la sección: {error}', file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.decode() if isinstance(error.stderr, bytes) else error.stderr, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

"""Pruebas de publicación con repositorios locales, sin servicios externos."""
import subprocess
import socket
import sys
import time
import json
import http.client
import tempfile
import unittest
import os
import re
import shutil
from pathlib import Path
from beta_cloudflare import publicar
from verificar_release import ARCHIVOS_PUBLICADOS, archivos_publicables, verificar_release


class PublicadorSeguro(unittest.TestCase):
    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args],
                                       text=True, stderr=subprocess.PIPE).strip()

    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporal.cleanup)
        self.repo = Path(self.temporal.name) / 'fuente'
        self.fuente = self.repo / 'caoz_tcg'
        self.fuente.mkdir(parents=True)
        self.destino = Path(self.temporal.name) / 'pages' / 'tcg'
        for nombre in ARCHIVOS_PUBLICADOS:
            archivo = self.fuente / nombre
            archivo.parent.mkdir(parents=True, exist_ok=True)
            archivo.write_text('archivo de prueba: ' + nombre)
        (self.fuente / 'index.html').write_text('const BUILD = {n:249, fecha:"prueba"};')
        for nombre in ['art/carta.webp', 'art/catalogo.json', 'audio/hover.wav']:
            archivo = self.fuente / nombre
            archivo.parent.mkdir(exist_ok=True)
            archivo.write_bytes(b'contenido original')
        # Se ejecuta el prefijo real: no hay una opción pública para saltarse
        # las pruebas ni se arranca Chrome dentro de estas pruebas de guardas.
        script = Path(__file__).with_name('publicar.sh').read_text()
        prefijo = script[:script.index('paso "1/4')]
        self.prefijo = self.fuente / 'publicar.sh'
        self.prefijo.write_text(prefijo + '\nprintf "VALIDADO:%s\\n" "$DESTINO"\n')
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.email', 'prueba@example.invalid')
        self.git('config', 'user.name', 'Pruebas del Domo')
        self.git('add', 'caoz_tcg')
        self.git('commit', '-qm', 'Build249 con un solo commit')

    def ejecutar(self, *args, entrada=None):
        if entrada is None:
            comando = ['bash', str(self.prefijo), *args]
        else:
            comando = ['bash', '-s', '--', *args]
        return subprocess.run(comando, input=entrada, text=True, capture_output=True,
                              cwd=self.fuente, timeout=10)

    def copiar_release(self):
        shutil.copytree(self.fuente, self.destino)

    def test_exige_destino_explicito_y_rechaza_ambiguedad(self):
        for args in [[], ['--visible'], ['--completo'], ['--beta', '--produccion'],
                     ['--produccion', '--beta'], ['--solo-pruebas', '--beta', '--produccion']]:
            with self.subTest(args=args):
                resultado = self.ejecutar(*args)
                self.assertEqual(resultado.returncode, 2, resultado.stdout + resultado.stderr)
                self.assertNotIn('VALIDADO:', resultado.stdout)

    def test_cada_destino_solo_desde_su_rama(self):
        for rama in ['main', 'develop', 'feature/coleccion']:
            if rama != 'main':
                self.git('checkout', '-qb', rama)
            for opcion, permitida in [('--produccion', 'main'), ('--beta', 'develop')]:
                with self.subTest(rama=rama, opcion=opcion):
                    resultado = self.ejecutar(opcion)
                    self.assertEqual(resultado.returncode, 0 if rama == permitida else 1,
                                     resultado.stdout + resultado.stderr)
                    self.assertEqual('VALIDADO:' in resultado.stdout, rama == permitida)
        self.git('checkout', '--detach', '-q')
        for opcion in ['--beta', '--produccion']:
            resultado = self.ejecutar(opcion)
            self.assertEqual(resultado.returncode, 1)
            self.assertIn('HEAD separado', resultado.stdout)

    def test_solo_pruebas_admite_ramas_temporales_y_cambios_locales(self):
        self.git('checkout', '-qb', 'feature/prueba')
        (self.fuente / 'motor.js').write_text('cambio local sin commit')
        for args in [['--solo-pruebas'], ['--solo-pruebas', '--visible'],
                     ['--beta', '--solo-pruebas'], ['--solo-pruebas', '--produccion']]:
            self.assertEqual(self.ejecutar(*args).returncode, 0, args)
        self.git('checkout', 'main')
        resultado = self.ejecutar('--produccion')
        self.assertEqual(resultado.returncode, 1)
        self.assertIn('sin guardar', resultado.stdout)

    def test_revalida_commit_rama_y_archivos_despues_de_las_pruebas(self):
        # Simula lo que puede cambiar durante Chrome sin ejecutar la copia.
        prefijo = self.prefijo.read_text().split('printf "VALIDADO:', 1)[0]
        for mutacion, esperado in [
            ('git -C "$REPO" checkout -qb feature/durante-pruebas', 'Sólo se publica'),
            ('git -C "$REPO" commit --allow-empty -qm "Otro commit"', 'commit cambió'),
            ('echo cambio >> "$AQUI/motor.js"', 'sin guardar')]:
            with self.subTest(mutacion=mutacion):
                script = prefijo + '\n' + mutacion + '\ncomprobar_fuente_publicacion || exit 1\n'
                # El prefijo determina AQUI con BASH_SOURCE: debe vivir junto
                # al juego, ya guardado antes de iniciar las guardas.
                self.prefijo.write_text(script)
                self.git('add', 'caoz_tcg/publicar.sh')
                self.git('commit', '-qm', 'Preparar simulación de concurrencia')
                resultado = self.ejecutar('--produccion')
                self.assertEqual(resultado.returncode, 1)
                self.assertIn(esperado, resultado.stdout)
                self.git('checkout', '--', 'caoz_tcg/motor.js')
                self.git('checkout', '-q', 'main')
        script = Path(__file__).with_name('publicar.sh').read_text()
        self.assertGreaterEqual(script.count('comprobar_fuente_publicacion || exit 1'), 2)

    def test_documentacion_y_merges_no_obligan_subir_build(self):
        self.copiar_release()
        (self.fuente / 'README.md').write_text('Nueva documentación')
        (self.fuente / 'pruebas_locales.py').write_text('Prueba local no publicada')
        self.git('add', 'caoz_tcg/README.md', 'caoz_tcg/pruebas_locales.py')
        self.git('commit', '-qm', 'Documentar sin cambiar el juego')
        self.git('checkout', '-qb', 'feature/documentacion')
        (self.repo / 'flujo.md').write_text('Flujo de desarrollo')
        self.git('add', 'flujo.md')
        self.git('commit', '-qm', 'Documentación del flujo')
        self.git('checkout', '-q', 'main')
        self.git('merge', '--no-ff', '-qm', 'Integrar documentación', 'feature/documentacion')
        self.assertNotEqual(self.git('rev-list', '--count', 'HEAD', '--', 'caoz_tcg/'), '249')
        self.assertEqual(verificar_release(self.fuente, self.destino)['anterior'], 249)
        script = Path(__file__).with_name('publicar.sh').read_text()
        self.assertNotIn('git rev-list --count', script)

    def test_version_monotona_e_inmutable_incluye_arte_audio_y_estudios(self):
        self.copiar_release()
        originales = {f: (self.destino / f).read_bytes() for f in archivos_publicables(self.fuente)}
        for archivo in ['motor.js', 'movil.html', 'sw.js', 'tests.js', 'estudio.js',
                        '_worker.js', 'art/carta.webp', 'art/catalogo.json', 'audio/hover.wav']:
            with self.subTest(archivo=archivo):
                (self.fuente / archivo).write_bytes(b'contenido distinto')
                with self.assertRaisesRegex(ValueError, 'otros bytes'):
                    verificar_release(self.fuente, self.destino)
                (self.fuente / archivo).write_bytes(originales[archivo])
        (self.fuente / 'index.html').write_text('const BUILD = {n:248};')
        with self.assertRaisesRegex(ValueError, 'retroceder'):
            verificar_release(self.fuente, self.destino)
        (self.fuente / 'index.html').write_text('const BUILD = {n:250};')
        self.assertEqual(verificar_release(self.fuente, self.destino)['build'], 250)
        for archivo, contenido in originales.items():
            self.assertEqual((self.destino / archivo).read_bytes(), contenido,
                             'Comprobar nunca debe modificar el destino: ' + archivo)

    def test_misma_build_rechaza_assets_agregados_y_retirados(self):
        self.copiar_release()
        nuevo = self.fuente / 'art/nueva.webp'
        nuevo.write_bytes('nueva ilustración'.encode())
        with self.assertRaisesRegex(ValueError, 'otros bytes'):
            verificar_release(self.fuente, self.destino)
        nuevo.unlink()
        (self.fuente / 'art/carta.webp').unlink()
        with self.assertRaisesRegex(ValueError, 'otros bytes'):
            verificar_release(self.fuente, self.destino)

    def test_no_admite_build_invalida_o_destino_sin_identificar(self):
        self.assertIsNone(verificar_release(self.fuente, self.destino)['anterior'])
        for invalida in ['sin BUILD', 'const BUILD = {n:0};', 'const BUILD = {n:-1};',
                         'const BUILD = {n:249.5};', 'const BUILD = {n:249+1};',
                         'const BUILD = {n:249}; const BUILD = {n:250};']:
            with self.subTest(invalida=invalida):
                (self.fuente / 'index.html').write_text(invalida)
                with self.assertRaises(ValueError):
                    verificar_release(self.fuente, self.destino)
        (self.fuente / 'index.html').write_text('const BUILD = {n:249};')
        self.destino.mkdir(parents=True)
        (self.destino / 'motor.js').write_text('destino incompleto')
        with self.assertRaisesRegex(ValueError, 'no una build identificable'):
            verificar_release(self.fuente, self.destino)
        (self.destino / 'index.html').write_text('sin BUILD')
        with self.assertRaisesRegex(ValueError, 'BUILD inválida'):
            verificar_release(self.fuente, self.destino)

    def test_paquete_incompleto_no_se_publica_ni_con_nueva_build(self):
        self.copiar_release()
        (self.fuente / 'index.html').write_text('const BUILD = {n:250};')
        (self.fuente / 'final.js').unlink()
        with self.assertRaisesRegex(ValueError, 'Faltan archivos publicables: final.js'):
            verificar_release(self.fuente, self.destino)


class BetaCloudflare(unittest.TestCase):
    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args],
                                       text=True, stderr=subprocess.PIPE).strip()

    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporal.cleanup)
        base = Path(self.temporal.name)
        self.repo = base / 'pages'
        self.repo.mkdir()
        self.git('init', '-q', '-b', 'gh-pages')
        self.git('config', 'user.email', 'prueba@example.invalid')
        self.git('config', 'user.name', 'Pruebas del Domo')
        for nombre, texto in [('tcg/index.html', 'producción'),
                              ('tcg-beta/index.html', 'beta'),
                              ('tcg-beta/motor.js', 'motor beta'),
                              ('otra-app.txt', 'otra aplicación')]:
            archivo = self.repo / nombre
            archivo.parent.mkdir(exist_ok=True)
            archivo.write_text(texto)
            self.git('add', nombre)
        self.git('commit', '-qm', 'Publicación de prueba')
        self.git('branch', 'main')
        remoto = base / 'remoto.git'
        subprocess.run(['git', 'init', '-q', '--bare', str(remoto)], check=True)
        self.git('remote', 'add', 'origin', str(remoto))
        self.git('push', '-q', 'origin', 'gh-pages', 'main')

    def test_preview_completo_sin_modificar_produccion(self):
        antes = self.git('ls-remote', 'origin', 'refs/heads/main', 'refs/heads/gh-pages')
        commit = publicar(self.repo)
        self.assertEqual(self.git('ls-tree', '--name-only', commit), 'tcg')
        self.assertEqual(self.git('rev-parse', f'{commit}:tcg'),
                         self.git('rev-parse', 'HEAD:tcg-beta'))
        self.assertEqual(self.git('show', f'{commit}:tcg/index.html'), 'beta')
        self.assertEqual(self.git('show', 'HEAD:tcg/index.html'), 'producción')
        self.assertEqual(self.git('branch', '--show-current'), 'gh-pages')
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(antes, self.git('ls-remote', 'origin', 'refs/heads/main', 'refs/heads/gh-pages'))
        self.assertEqual(publicar(self.repo), commit)  # Reintentar no duplica commits.
        (self.repo / 'tcg-beta/index.html').write_text('beta siguiente')
        self.git('commit', '-qam', 'Siguiente beta validada')
        self.git('push', '-q', 'origin', 'gh-pages')
        siguiente = publicar(self.repo)
        self.assertEqual(self.git('rev-parse', f'{siguiente}^'), commit)
        self.assertEqual(self.git('show', f'{siguiente}:tcg/index.html'), 'beta siguiente')

    def test_rechaza_cambios_sin_publicar(self):
        (self.repo / 'tcg-beta/index.html').write_text('sin validar')
        with self.assertRaises(ValueError):
            publicar(self.repo)
        self.git('commit', '-qam', 'Sin enviar')
        with self.assertRaises(ValueError):
            publicar(self.repo)
        self.assertEqual(self.git('ls-remote', 'origin', 'refs/heads/beta'), '')

    def test_no_sobrescribe_otra_rama_beta(self):
        self.git('push', '-q', 'origin', 'HEAD:refs/heads/beta')
        with self.assertRaises(ValueError):
            publicar(self.repo)
        self.assertEqual(self.git('ls-remote', 'origin', 'refs/heads/beta').split()[0],
                         self.git('rev-parse', 'HEAD'))

    def test_cloudflare_respeta_redireccion_del_estudio_unico(self):
        # /estudio.html redirige a producción en beta. Comparar ese destino
        # contra el HTML de beta produce un falso fallo con el juego publicado.
        fuente = Path(__file__).resolve().parent
        script = (fuente / 'publicar.sh').read_text()
        cloudflare = script.split('comprobar_cloudflare(){', 1)[1].split('paso "4/4', 1)[0]
        archivos = re.search(r'for f in ([^;]+); do', cloudflare).group(1).split()
        self.assertNotIn('estudio.html', archivos)
        for archivo in ['estudio.js', 'arte-remoto.js', 'coleccion-modelo.js',
                        'coleccion-juego.js', 'coleccion-ui.js', 'coleccion.css']:
            self.assertIn(archivo, archivos)
        self.assertIn('verificar_arte_web.py', cloudflare)
        self.assertIn('estudio.html', script.split('paso "4/4', 1)[1])

    def test_estudios_publican_sus_dependencias_en_ambos_destinos(self):
        # Ejecutar la copia y el commit reales contra el remoto local detecta
        # archivos copiados que nunca llegan a git (como ocurrió en build235).
        fuente = Path(__file__).resolve().parent
        script = (fuente / 'publicar.sh').read_text()
        bloque = script[script.index('paso "3/4'):script.index('# CLOUDFLARE PAGES')]
        dependencias = {'estudio.html', 'sonidos.html', 'coleccion-modelo.js',
                         'coleccion-juego.js', 'coleccion-ui.js', 'coleccion.css'}
        for panel in ['estudio.html', 'sonidos.html']:
            dependencias.update(re.findall(r'(?:src|href)="([^"?]+\.(?:js|css))(?:\?[^\"]*)?"',
                                           (fuente / panel).read_text()))
        for destino in ['tcg', 'tcg-beta']:
            (self.repo / destino / 'index.html').write_text('const BUILD = {n:1};')
        self.git('commit', '-qam', 'Destinos anteriores con build identificable')
        self.git('push', '-q', 'origin', 'gh-pages')
        for destino in ['tcg', 'tcg-beta']:
            with self.subTest(destino=destino):
                otro = 'tcg-beta' if destino == 'tcg' else 'tcg'
                intacto = self.git('rev-parse', 'HEAD:' + otro)
                subprocess.run(['bash'], input='set -uo pipefail\npaso(){ :; }; gris(){ :; }; rojo(){ :; }\n' + bloque,
                               text=True, capture_output=True, check=True,
                               env={**os.environ, 'AQUI': str(fuente), 'REPO': str(self.repo),
                                    'PAGES': str(self.repo), 'DESTINO': destino})
                for archivo in sorted(dependencias):
                    publicado = subprocess.check_output(['git', '-C', str(self.repo),
                                                          'show', 'HEAD:' + destino + '/' + archivo],
                                                         stderr=subprocess.PIPE)
                    self.assertEqual(publicado, (fuente / archivo).read_bytes(), archivo)
                # La guarda debe cubrir exactamente todo lo que copia el
                # publicador; añadir un módulo exige incluirlo en la guarda.
                publicados = self.git('ls-tree', '-r', '--name-only', 'HEAD', '--', destino).splitlines()
                self.assertEqual({f.removeprefix(destino + '/') for f in publicados},
                                 set(archivos_publicables(fuente)))
                self.assertEqual(verificar_release(fuente, self.repo / destino)['build'],
                                 verificar_release(fuente, self.repo / destino)['anterior'])
                self.assertEqual(self.git('status', '--porcelain'), '')
                self.assertEqual(self.git('rev-parse', 'HEAD:' + otro), intacto)
                self.assertEqual(self.git('show', 'HEAD:otra-app.txt'), 'otra aplicación')

    def test_version_rechazada_no_llega_a_copiar_commit_ni_push(self):
        fuente = Path(__file__).resolve().parent
        script = (fuente / 'publicar.sh').read_text()
        bloque = script[script.index('paso "3/4'):script.index('# CLOUDFLARE PAGES')]
        (self.repo / 'tcg/index.html').write_text('const BUILD = {n:999999};')
        self.git('commit', '-qam', 'Producción más reciente')
        self.git('push', '-q', 'origin', 'gh-pages')
        antes = self.git('rev-parse', 'HEAD')
        remoto = self.git('ls-remote', 'origin', 'refs/heads/gh-pages')
        resultado = subprocess.run(['bash'],
            input='set -uo pipefail\npaso(){ :; }; gris(){ :; }; rojo(){ :; }\n' + bloque,
            text=True, capture_output=True,
            env={**os.environ, 'AQUI': str(fuente), 'REPO': str(self.repo),
                 'PAGES': str(self.repo), 'DESTINO': 'tcg'})
        self.assertEqual(resultado.returncode, 1)
        self.assertIn('No se puede retroceder', resultado.stderr)
        self.assertEqual(self.git('rev-parse', 'HEAD'), antes)
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(self.git('ls-remote', 'origin', 'refs/heads/gh-pages'), remoto)

    def test_no_arrastra_commits_pendientes_ni_usa_pages_desactualizado(self):
        fuente = Path(__file__).resolve().parent
        script = (fuente / 'publicar.sh').read_text()
        bloque = script[script.index('paso "3/4'):script.index('# CLOUDFLARE PAGES')]
        inicial = self.git('rev-parse', 'HEAD')
        for estado in ['adelantado', 'atrasado']:
            with self.subTest(estado=estado):
                self.git('reset', '--hard', inicial)
                (self.repo / 'tcg/index.html').write_text('Producción distinta, ' + estado)
                self.git('commit', '-qam', 'Otra publicación')
                if estado == 'atrasado':
                    self.git('push', '-q', 'origin', 'gh-pages')
                    self.git('reset', '--hard', inicial)
                antes = self.git('rev-parse', 'HEAD')
                remoto = self.git('ls-remote', 'origin', 'refs/heads/gh-pages')
                resultado = subprocess.run(['bash'],
                    input='set -uo pipefail\npaso(){ :; }; gris(){ :; }; rojo(){ echo "$*"; }\n' + bloque,
                    text=True, capture_output=True,
                    env={**os.environ, 'AQUI': str(fuente), 'REPO': str(self.repo),
                         'PAGES': str(self.repo), 'DESTINO': 'tcg-beta'})
                self.assertEqual(resultado.returncode, 1)
                self.assertIn('gh-pages local no coincide', resultado.stdout)
                self.assertEqual(self.git('rev-parse', 'HEAD'), antes)
                self.assertEqual(self.git('status', '--porcelain'), '')
                self.assertEqual(self.git('ls-remote', 'origin', 'refs/heads/gh-pages'), remoto)


class ServidorPruebas(unittest.TestCase):
    def test_precarga_ociosa_no_bloquea_archivos_ni_resultado(self):
        # Chrome puede abrir un socket antes de enviar el GET. Esa precarga
        # no debe detener los iframes ni la entrega final del arnés.
        with tempfile.TemporaryDirectory() as carpeta:
            salida = Path(carpeta) / 'resultado.json'
            with socket.socket() as reserva:
                reserva.bind(('127.0.0.1', 0))
                puerto = reserva.getsockname()[1]
            proceso = subprocess.Popen([sys.executable,
                str(Path(__file__).with_name('servidor_pruebas.py')),
                str(puerto), str(salida)], stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL)
            ocioso = None
            try:
                for _ in range(100):
                    try:
                        ocioso = socket.create_connection(('127.0.0.1', puerto), timeout=.1)
                        break
                    except OSError:
                        if proceso.poll() is not None:
                            self.fail('No arrancó el servidor de pruebas.')
                        time.sleep(.02)
                self.assertIsNotNone(ocioso, 'El servidor debe arrancar.')
                time.sleep(.1)
                cliente = http.client.HTTPConnection('127.0.0.1', puerto, timeout=2)
                try:
                    cliente.request('GET', '/motor.js')
                    respuesta = cliente.getresponse()
                    self.assertEqual(respuesta.status, 200)
                    self.assertIn(b'CARDS', respuesta.read())
                finally:
                    cliente.close()
                cliente = http.client.HTTPConnection('127.0.0.1', puerto, timeout=2)
                try:
                    cliente.request('POST', '/resultado', body='{"ok":1,"mal":0}',
                                    headers={'Content-Type': 'application/json'})
                    respuesta = cliente.getresponse()
                    self.assertEqual(respuesta.status, 204)
                    respuesta.read()
                finally:
                    cliente.close()
                self.assertEqual(json.loads(salida.read_text()), {'ok': 1, 'mal': 0})
            finally:
                if ocioso:
                    ocioso.close()
                proceso.terminate()
                proceso.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()

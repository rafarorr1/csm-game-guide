"""Pruebas de publicación con repositorios locales, sin servicios externos."""
import subprocess
import socket
import sys
import time
import json
import http.client
import tempfile
import unittest
from pathlib import Path
from beta_cloudflare import publicar


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

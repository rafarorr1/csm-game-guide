"""Pruebas de publicación con repositorios locales, sin servicios externos."""
import subprocess
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


if __name__ == '__main__':
    unittest.main()

"""Pruebas de aislamiento con repositorios temporales, sin red externa."""
from pathlib import Path
import subprocess
import tempfile
import unittest

from nueva_rama import git, preparar


class Ramas(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = Path(self.tmp.name)
        self.repo = self.raiz / 'juego'
        self.remoto = self.raiz / 'remoto.git'
        subprocess.run(['git', 'init', '--bare', '-q', str(self.remoto)], check=True)
        subprocess.run(['git', 'init', '-q', '-b', 'main', str(self.repo)], check=True)
        git(self.repo, 'config', 'user.name', 'Pruebas Caoz')
        git(self.repo, 'config', 'user.email', 'pruebas@example.invalid')
        (self.repo / 'juego.txt').write_text('producción')
        git(self.repo, 'add', 'juego.txt')
        git(self.repo, 'commit', '-qm', 'Producción')
        self.produccion = git(self.repo, 'rev-parse', 'HEAD')
        git(self.repo, 'switch', '-qc', 'develop')
        (self.repo / 'juego.txt').write_text('beta')
        git(self.repo, 'commit', '-qam', 'Beta')
        self.beta = git(self.repo, 'rev-parse', 'HEAD')
        git(self.repo, 'remote', 'add', 'origin', str(self.remoto))
        git(self.repo, 'push', '-q', 'origin', 'main', 'develop')
        git(self.repo, 'switch', '-q', 'main')

    def test_aisla_desde_develop_y_conserva_cambios(self):
        (self.repo / 'juego.txt').write_text('trabajo del usuario sin guardar')
        r = preparar(self.repo, 'coleccion-sobres')
        otro = Path(r['directorio'])
        self.assertEqual(git(otro, 'rev-parse', 'HEAD'), self.beta)
        self.assertEqual(git(otro, 'branch', '--show-current'), 'feature/coleccion-sobres')
        self.assertEqual((otro / 'juego.txt').read_text(), 'beta')
        self.assertEqual(git(self.repo, 'branch', '--show-current'), 'main')
        self.assertEqual((self.repo / 'juego.txt').read_text(), 'trabajo del usuario sin guardar')
        self.assertEqual(git(self.repo, 'rev-parse', 'main'), self.produccion)
        self.assertEqual(git(self.repo, 'ls-remote', '--heads', 'origin', 'refs/heads/feature/coleccion-sobres'), '')

    def test_conflictos_no_sobrescriben(self):
        r = preparar(self.repo, 'coleccion-sobres')
        with self.assertRaises(ValueError):
            preparar(self.repo, 'coleccion-sobres', directorio=self.raiz / 'otro')
        with self.assertRaises(ValueError):
            preparar(self.repo, 'otro', directorio=r['directorio'])
        with self.assertRaises(ValueError):
            preparar(self.repo, 'dentro', directorio=self.repo / 'nueva')

    def test_nombres_invalidos_y_vista_previa(self):
        for nombre in ['../main', 'main;touch archivo', 'Mayúsculas', 'a/b', 'x y', '']:
            with self.assertRaises(ValueError):
                preparar(self.repo, nombre)
        r = preparar(self.repo, 'thal', tipo='fix', solo_ver=True)
        self.assertFalse(Path(r['directorio']).exists())
        self.assertEqual(git(self.repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/fix/thal'), '')

    def test_no_anida_en_otro_worktree_ni_en_su_enlace(self):
        otro = self.raiz / 'otro checkout'
        git(self.repo, 'worktree', 'add', '-qb', 'existente', str(otro), 'main')
        (otro / 'juego.txt').write_text('cambio pendiente en otro checkout')
        (otro / 'sin-guardar.txt').write_text('archivo del usuario')
        estado = git(otro, 'status', '--porcelain')
        enlace = self.raiz / 'acceso-al-otro'
        enlace.symlink_to(otro, target_is_directory=True)
        for carpeta in (otro, enlace):
            with self.subTest(carpeta=str(carpeta)):
                with self.assertRaisesRegex(ValueError, 'todos los checkouts'):
                    preparar(self.repo, 'anidado', directorio=carpeta / 'nuevo')
                self.assertFalse((otro / 'nuevo').exists())
                self.assertEqual(git(otro, 'status', '--porcelain'), estado)
                self.assertEqual((otro / 'juego.txt').read_text(), 'cambio pendiente en otro checkout')
                self.assertEqual((otro / 'sin-guardar.txt').read_text(), 'archivo del usuario')
                self.assertEqual(git(self.repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/feature/anidado'), '')

    def test_sin_develop_no_cae_en_main(self):
        git(self.repo, 'push', '-q', 'origin', '--delete', 'develop')
        git(self.repo, 'update-ref', '-d', 'refs/remotes/origin/develop')
        with self.assertRaises(ValueError):
            preparar(self.repo, 'sin-base', actualizar=False)


if __name__ == '__main__':
    unittest.main()

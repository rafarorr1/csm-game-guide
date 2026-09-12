#!/usr/bin/env python3
"""Abre un cambio aislado desde develop, sin cambiar el checkout actual."""
import argparse
from pathlib import Path
import re
import subprocess
import sys


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], text=True, stderr=subprocess.PIPE).strip()


def preparar(repo, nombre, tipo='feature', directorio=None, actualizar=True, solo_ver=False):
    repo = Path(git(repo, 'rev-parse', '--show-toplevel'))
    if tipo not in ('feature', 'fix', 'chore') or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', nombre):
        raise ValueError('Usa un nombre breve en minúsculas, con palabras separadas por guiones.')
    rama = f'{tipo}/{nombre}'
    git(repo, 'check-ref-format', '--branch', rama)
    if actualizar:
        git(repo, 'fetch', '--quiet', 'origin', 'refs/heads/develop:refs/remotes/origin/develop')
    try:
        base = git(repo, 'rev-parse', '--verify', 'refs/remotes/origin/develop^{commit}')
    except subprocess.CalledProcessError as error:
        raise ValueError('Primero debe existir origin/develop. No se usa main como sustituto.') from error
    existentes = git(repo, 'for-each-ref', '--format=%(refname)', f'refs/heads/{rama}', f'refs/remotes/origin/{rama}').splitlines()
    if existentes:
        raise ValueError(f'La rama {rama} ya existe; abre su carpeta o elige otro nombre.')
    if actualizar and git(repo, 'ls-remote', '--heads', 'origin', f'refs/heads/{rama}'):
        raise ValueError(f'La rama {rama} ya existe en GitHub; no se crea otra historia con ese nombre.')
    destino = (Path(directorio).expanduser() if directorio else repo.parent / (repo.name + '-trabajos') / (tipo + '-' + nombre)).resolve()
    if destino.exists():
        raise ValueError(f'La carpeta de destino ya existe: {destino}')
    # Un cambio anidado también ensucia otros checkouts, incluido el de Pages.
    # -z conserva rutas con espacios o saltos de línea sin el quoting de Git.
    for campo in git(repo, 'worktree', 'list', '--porcelain', '-z').split('\0'):
        if campo.startswith('worktree '):
            checkout = Path(campo[len('worktree '):]).resolve()
            if destino == checkout or checkout in destino.parents:
                raise ValueError(f'La carpeta del cambio debe estar fuera de todos los checkouts: {checkout}')
    if not solo_ver:
        destino.parent.mkdir(parents=True, exist_ok=True)
        git(repo, 'worktree', 'add', '-b', rama, str(destino), base)
    return {'rama': rama, 'base': base, 'directorio': str(destino), 'creada': not solo_ver}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('nombre', help='Ejemplo: coleccion-sobres')
    p.add_argument('--tipo', choices=['feature', 'fix', 'chore'], default='feature')
    p.add_argument('--directorio', type=Path, help='Carpeta nueva fuera de todos los checkouts')
    p.add_argument('--sin-actualizar', action='store_true', help='Sin conexión: usa la última referencia local de origin/develop')
    p.add_argument('--solo-ver', action='store_true', help='Muestra el destino sin crear rama ni carpeta')
    a = p.parse_args()
    try:
        r = preparar(Path(__file__).resolve().parent.parent, a.nombre, a.tipo, a.directorio, not a.sin_actualizar, a.solo_ver)
    except (ValueError, subprocess.CalledProcessError) as error:
        print(str(error) if isinstance(error, ValueError) else error.stderr.strip(), file=sys.stderr)
        return 1
    print(('Creada' if r['creada'] else 'Preparada') + ': ' + r['rama'])
    print('Base: origin/develop · ' + r['base'][:12])
    print('Carpeta: ' + r['directorio'])
    print('El checkout actual y los despliegues permanecen intactos.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

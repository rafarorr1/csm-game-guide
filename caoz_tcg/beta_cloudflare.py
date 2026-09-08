#!/usr/bin/env python3
"""Entrega a Cloudflare sólo los archivos ya publicados en tcg-beta.

La rama beta es un preview del proyecto caoz-tcg, cuya salida es tcg.
Construimos el árbol de Git sin cambiar el checkout ni la carpeta de producción.
Este paso se invoca desde publicar.sh, después de sus pruebas y verificaciones.
"""
import subprocess
import sys


def publicar(pages):
    def git(*args, entrada=None):
        return subprocess.check_output(
            ['git', '-C', str(pages), *args], input=entrada,
            text=True, stderr=subprocess.PIPE).strip()

    if git('branch', '--show-current') != 'gh-pages':
        raise ValueError('La beta debe salir del worktree gh-pages.')
    if git('status', '--porcelain'):
        raise ValueError('El worktree de publicación debe estar limpio.')
    publicado = git('rev-parse', 'HEAD')
    contenido = git('rev-parse', 'HEAD:tcg-beta')
    if git('cat-file', '-t', contenido) != 'tree':
        raise ValueError('No existe la carpeta publicada tcg-beta.')
    # Sin archivos fuente, otras aplicaciones ni configuración de producción.
    arbol = git('mktree', entrada=f'040000 tree {contenido}\ttcg\n')
    remoto = git('ls-remote', '--exit-code', 'origin', 'refs/heads/gh-pages').split()[0]
    if remoto != publicado:
        raise ValueError('gh-pages local y publicado no coinciden; no se envía la beta.')
    anterior = git('ls-remote', 'origin', 'refs/heads/beta')
    padres = []
    if anterior:
        anterior = anterior.split()[0]
        git('fetch', '--quiet', 'origin', 'refs/heads/beta')
        if git('ls-tree', '--name-only', anterior) != 'tcg':
            raise ValueError('La rama beta contiene otro proyecto; no se modifica.')
        if git('rev-parse', f'{anterior}^{{tree}}') == arbol:
            print(f'Cloudflare beta ya apunta a estos archivos ({anterior[:7]}).')
            return anterior
        padres = ['-p', anterior]
    commit = git('commit-tree', arbol, *padres, entrada=(
        f'Publica la beta validada de {publicado[:7]} en Cloudflare\n\n'
        'Preview aislado; conserva gh-pages/tcg y main.\n'))
    # Avance normal: si alguien publica a la vez, Git rechaza el conflicto.
    git('push', '--quiet', 'origin', f'{commit}:refs/heads/beta')
    print(f'Cloudflare beta enviado: {commit[:7]} (preview, rama beta).')
    return commit


if __name__ == '__main__':
    try:
        publicar(sys.argv[1])
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f'No se publicó la beta en Cloudflare: {error}', file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError):
            print(error.stderr, file=sys.stderr)
        sys.exit(1)

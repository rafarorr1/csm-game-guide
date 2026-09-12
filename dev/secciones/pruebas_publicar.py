"""Pruebas del publicador aislado, sólo con repositorios y paquetes temporales."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import unquote, urlsplit

import publicar as p


class PublicacionAislada(unittest.TestCase):
    def git(self, *args, **opciones):
        return p.git(self.repo, *args, **opciones)

    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory(prefix='caoz-prueba-aislados-')
        self.addCleanup(self.temporal.cleanup)
        self.base = Path(self.temporal.name)
        self.repo = self.base / 'fuente'
        secciones = self.repo / 'dev/secciones'
        secciones.mkdir(parents=True)
        (self.repo / 'componente.js').write_text('const saludo = "Colección real";')
        # Exportador mínimo determinista: ejercita el flujo Node/Git real sin
        # duplicar las pruebas de renderer y exportación del proyecto.
        (secciones / 'exportar.mjs').write_text('''
import fs from 'node:fs'; import path from 'node:path';
const destino=process.argv[2]; fs.mkdirSync(destino,{recursive:true});
const datos={'index.html':'entrada','movil.html':'móvil','escritorio.html':'escritorio',
 'procedencia.json':'{"seccion":"coleccion"}','_headers':"/*\\n  Cache-Control: no-store\\n  Content-Security-Policy: default-src 'self'\\n",
 'componente.js':fs.readFileSync('componente.js'),'imagen con espacio.svg':'<svg/>'};
for(const [n,b] of Object.entries(datos))fs.writeFileSync(path.join(destino,n),b);
''')
        (secciones / 'rey-exportar.mjs').write_text('''
import fs from 'node:fs'; import path from 'node:path';
const destino=process.argv[2]; fs.mkdirSync(destino,{recursive:true});
const datos={'index.html':'El Rey: corte y campaña','procedencia.json':'{"seccion":"rey"}',
 '_headers':"/*\\n  Cache-Control: no-store\\n  Content-Security-Policy: default-src 'self'\\n",
 'rey.js':fs.readFileSync('componente.js')};
for(const [n,b] of Object.entries(datos))fs.writeFileSync(path.join(destino,n),b);
''')
        (secciones / 'sobres-exportar.mjs').write_text('''
import fs from 'node:fs'; import path from 'node:path';
const destino=process.argv[2]; fs.mkdirSync(destino,{recursive:true});
const datos={'index.html':'Apertura de cinco cartas','procedencia.json':'{"seccion":"sobres"}',
 '_headers':"/*\\n  Cache-Control: no-store\\n  Content-Security-Policy: default-src 'self'\\n",
 'sobres.js':fs.readFileSync('componente.js')};
for(const [n,b] of Object.entries(datos))fs.writeFileSync(path.join(destino,n),b);
''')
        for nombre in ['pruebas.mjs', 'pruebas_exportacion.mjs', 'pruebas_rey_exportacion.mjs', 'pruebas_sobres_exportacion.mjs', 'pruebas_sobres_apertura.mjs']:
            (secciones / nombre).write_text("import assert from 'node:assert/strict'; assert.equal(2+2,4);\n")
        self.git('init', '-q', '-b', 'develop')
        self.git('config', 'user.name', 'Pruebas de secciones')
        self.git('config', 'user.email', 'prueba@example.invalid')
        self.git('add', 'dev', 'componente.js')
        self.git('commit', '-qm', 'Fuente de una sección')
        for rama in ['main', 'beta', 'gh-pages']:
            self.git('branch', rama)
        remoto = self.base / 'remoto.git'
        subprocess.run(['git', 'init', '-q', '--bare', str(remoto)], check=True)
        self.git('remote', 'add', 'origin', str(remoto))
        self.git('push', '-q', 'origin', 'develop', 'main', 'beta', 'gh-pages')
        self.contador = 0

    def preparar(self, seccion='coleccion'):
        self.contador += 1
        salida = self.base / f'salida-{self.contador}'
        p.preparar(self.repo, salida, seccion)
        return salida

    def referencias_protegidas(self):
        nombres = ['refs/heads/' + n for n in ['main', 'develop', 'beta', 'gh-pages']]
        return (self.git('rev-parse', 'HEAD'), self.git('show-ref', *nombres),
                self.git('ls-remote', 'origin', *nombres))

    def siguiente_fuente(self):
        (self.repo / 'componente.js').write_text('const saludo = "Nueva Colección";')
        self.git('commit', '-qam', 'Revisar componente')

    def cambiar_artefacto(self, cambios):
        anterior = p.revision_remota(self.repo)
        with tempfile.TemporaryDirectory() as carpeta:
            entorno = {'GIT_INDEX_FILE': str(Path(carpeta) / 'index')}
            self.git('read-tree', anterior, entorno=entorno)
            for nombre, contenido in cambios.items():
                objeto = self.git('hash-object', '-w', '--stdin', entrada=contenido,
                                  binario=True).decode().strip()
                self.git('update-index', '--add', '--cacheinfo', f'100644,{objeto},{nombre}', entorno=entorno)
            arbol = self.git('write-tree', entorno=entorno)
        commit = self.git('commit-tree', arbol, '-p', anterior, entrada='Otra sección o publicación\n')
        self.git('push', '-q', 'origin', commit + ':' + p.RAMA)
        return commit

    def test_solo_ramas_de_trabajo_fuente_limpia(self):
        for rama in ['develop', 'feature/cartas', 'fix/encuadre', 'chore/flujo']:
            if rama != 'develop':
                self.git('checkout', '-qb', rama)
            self.assertEqual(p.comprobar_fuente(self.repo)['rama'], rama)
        for rama in ['main', 'gh-pages', 'beta']:
            self.git('checkout', '-q', rama)
            with self.assertRaisesRegex(ValueError, 'nunca de main o artefactos'):
                p.comprobar_fuente(self.repo)
        self.git('checkout', '--detach', '-q')
        with self.assertRaises(ValueError):
            p.comprobar_fuente(self.repo)
        self.git('checkout', '-q', 'develop')
        (self.repo / 'sin-guardar.txt').write_text('pendiente')
        with self.assertRaisesRegex(ValueError, 'limpia'):
            self.preparar()

    def test_preparacion_determinista_procedencia_y_cabeceras(self):
        protegido = self.referencias_protegidas()
        original_run = subprocess.run
        llamadas = []
        def registrar(args, **opciones):
            if args[0] == 'node':
                llamadas.append(Path(args[1]).name)
            return original_run(args, **opciones)
        with patch.object(p.subprocess, 'run', side_effect=registrar):
            salida = self.preparar()
        self.assertEqual(llamadas, ['exportar.mjs', 'pruebas.mjs', 'pruebas_exportacion.mjs'])
        segundo = self.preparar()
        self.assertEqual(p.archivos(salida), p.archivos(segundo))
        registro, manifiesto, contenido = p.validar_paquete(salida)
        self.assertEqual(manifiesto['fuente']['sha'], self.git('rev-parse', 'HEAD'))
        self.assertEqual(registro['secciones']['coleccion']['ruta'], 'tcg/coleccion')
        self.assertEqual(contenido['tcg/_headers'], contenido['tcg/coleccion/_headers'])
        self.assertIn(b'no-store', contenido['tcg/_headers'])
        self.assertIn(b'Content-Security-Policy', contenido['tcg/_headers'])
        self.assertEqual(contenido['tcg/404.html'], p.NO_ENCONTRADO)
        self.assertIn(b'href="./coleccion/"', contenido['tcg/index.html'])
        self.assertEqual(self.referencias_protegidas(), protegido)
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertIsNone(p.revision_remota(self.repo))

    def test_salida_vacia_y_fuera_de_cualquier_checkout(self):
        salida = self.base / 'ocupada'
        salida.mkdir()
        (salida / 'ajeno.txt').write_text('no tocar')
        with self.assertRaisesRegex(ValueError, 'vacía'):
            p.preparar(self.repo, salida)
        with self.assertRaisesRegex(ValueError, 'fuera de todos los checkouts'):
            p.preparar(self.repo, self.repo / 'generado')
        otro = self.base / 'otro-checkout'
        self.git('worktree', 'add', '-q', str(otro), 'main')
        with self.assertRaisesRegex(ValueError, 'fuera de todos los checkouts'):
            p.preparar(self.repo, otro / 'generado')
        self.assertEqual((salida / 'ajeno.txt').read_text(), 'no tocar')

    def test_prueba_roja_o_fuente_modificada_aborta_preparacion(self):
        prueba = self.repo / 'dev/secciones/pruebas_exportacion.mjs'
        prueba.write_text('process.exit(1);')
        self.git('commit', '-qam', 'Fixture con prueba roja')
        with self.assertRaises(subprocess.CalledProcessError):
            self.preparar()
        self.assertIsNone(p.revision_remota(self.repo))
        prueba.write_text('process.exit(0);')
        self.git('commit', '-qam', 'Fixture corregido')
        original_run = subprocess.run
        def cambiar(args, **opciones):
            resultado = original_run(args, **opciones)
            if args[0] == 'node' and Path(args[1]).name == 'pruebas_exportacion.mjs':
                (self.repo / 'componente.js').write_text('cambio durante pruebas')
            return resultado
        with patch.object(p.subprocess, 'run', side_effect=cambiar):
            with self.assertRaisesRegex(ValueError, 'limpia'):
                self.preparar()
        self.assertIsNone(p.revision_remota(self.repo))

    def test_publica_solo_aislados_y_reintento_no_crea_commit(self):
        salida = self.preparar()
        protegido = self.referencias_protegidas()
        resultado = p.publicar(self.repo, salida)
        self.assertTrue(resultado['nuevo'])
        self.assertFalse(resultado['verificado_web'])
        self.assertEqual(p.revision_remota(self.repo), resultado['commit'])
        self.assertEqual(set(self.git('ls-tree', '--name-only', resultado['commit']).splitlines()),
                         {p.MARCADOR, 'tcg'})
        segundo = p.publicar(self.repo, self.preparar())
        self.assertFalse(segundo['nuevo'])
        self.assertEqual(segundo['commit'], resultado['commit'])
        self.assertEqual(self.referencias_protegidas(), protegido)
        self.assertEqual(self.git('branch', '--show-current'), 'develop')
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(self.git('branch', '--list', 'aislados'), '')

    def test_actualiza_seccion_y_conserva_hermanas(self):
        primero = p.publicar(self.repo, self.preparar())['commit']
        registro = json.loads(self.git('show', f'{primero}:{p.MARCADOR}'))
        registro['secciones']['dados'] = {'ruta': 'tcg/dados', 'fuente': self.git('rev-parse', 'HEAD')}
        con_hermana = self.cambiar_artefacto({p.MARCADOR: p.json_bytes(registro),
                                             'tcg/dados/index.html': b'Otra seccion revisada'})
        arbol_hermana = self.git('rev-parse', f'{con_hermana}:tcg/dados')
        self.siguiente_fuente()
        nuevo = p.publicar(self.repo, self.preparar())['commit']
        self.assertEqual(self.git('rev-parse', nuevo + '^'), con_hermana)
        self.assertEqual(self.git('rev-parse', f'{nuevo}:tcg/dados'), arbol_hermana)
        self.assertIn('href="./dados/"', self.git('show', f'{nuevo}:tcg/index.html'))
        self.assertIn('Nueva Colección', self.git('show', f'{nuevo}:tcg/coleccion/componente.js'))
        self.assertFalse(p.publicar(self.repo, self.preparar())['nuevo'])

    def test_rey_exportador_y_prueba_propios_sin_exigir_vistas_coleccion(self):
        original_run = subprocess.run
        llamadas = []
        def registrar(args, **opciones):
            if args[0] == 'node':
                llamadas.append(Path(args[1]).name)
            return original_run(args, **opciones)
        with patch.object(p.subprocess, 'run', side_effect=registrar):
            salida = self.preparar('rey')
        self.assertEqual(llamadas, ['rey-exportar.mjs', 'pruebas_rey_exportacion.mjs'])
        registro, manifiesto, contenido = p.validar_paquete(salida)
        self.assertEqual(set(registro['secciones']), {'rey'})
        self.assertEqual(manifiesto['seccion'], 'rey')
        self.assertIn('tcg/rey/index.html', contenido)
        self.assertNotIn('tcg/rey/movil.html', contenido)
        self.assertNotIn('tcg/rey/escritorio.html', contenido)
        with self.assertRaisesRegex(ValueError, 'sección elegida'):
            p.validar_paquete(salida, 'coleccion')
        for desconocida in ['../rey', 'main', 'dados', '/tmp/rey']:
            with self.assertRaisesRegex(ValueError, 'Sección no admitida'):
                self.preparar(desconocida)
        # Una exportación válida por hashes sigue necesitando su procedencia.
        (salida / 'tcg/rey/procedencia.json').unlink()
        del manifiesto['archivos']['procedencia.json']
        (salida / 'tcg/rey/publicacion.json').write_bytes(p.json_bytes(manifiesto))
        with self.assertRaisesRegex(ValueError, 'Faltan archivos requeridos de rey: procedencia.json'):
            p.validar_paquete(salida)

    def test_publicar_rey_conserva_coleccion_y_ramas_del_juego(self):
        primero = p.publicar(self.repo, self.preparar())['commit']
        coleccion = self.git('rev-parse', f'{primero}:tcg/coleccion')
        cabeceras = self.git('show', f'{primero}:tcg/_headers', binario=True)
        protegido = self.referencias_protegidas()
        salida_rey = self.preparar('rey')
        segundo = p.publicar(self.repo, salida_rey)
        self.assertTrue(segundo['nuevo'])
        self.assertEqual(segundo['url'], p.URL + '/rey/')
        self.assertEqual(self.git('rev-parse', segundo['commit'] + '^'), primero)
        self.assertEqual(self.git('rev-parse', f"{segundo['commit']}:tcg/coleccion"), coleccion)
        self.assertEqual(self.git('show', f"{segundo['commit']}:tcg/_headers", binario=True), cabeceras)
        indice = self.git('show', f"{segundo['commit']}:tcg/index.html")
        self.assertIn('href="./coleccion/"', indice)
        self.assertIn('href="./rey/"', indice)
        self.assertEqual(self.referencias_protegidas(), protegido)
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertFalse(p.publicar(self.repo, salida_rey)['nuevo'])
        # Actualizar Colección después tampoco toca la vista de El Rey.
        rey = self.git('rev-parse', f"{segundo['commit']}:tcg/rey")
        self.siguiente_fuente()
        protegido = self.referencias_protegidas()
        tercero = p.publicar(self.repo, self.preparar())['commit']
        self.assertEqual(self.git('rev-parse', f'{tercero}:tcg/rey'), rey)
        self.assertEqual(self.referencias_protegidas(), protegido)

    def test_rey_no_cambia_cabeceras_de_coleccion_ya_publicada(self):
        primero = p.publicar(self.repo, self.preparar())['commit']
        exportador = self.repo / 'dev/secciones/rey-exportar.mjs'
        exportador.write_text(exportador.read_text().replace('no-store', 'public, max-age=3600'))
        self.git('commit', '-qam', 'Fixture Rey con política diferente')
        salida = self.preparar('rey')
        protegido = self.referencias_protegidas()
        with self.assertRaisesRegex(ValueError, 'cabeceras compartidas'):
            p.publicar(self.repo, salida)
        self.assertEqual(p.revision_remota(self.repo), primero)
        self.assertEqual(self.referencias_protegidas(), protegido)

    def test_sobres_exportador_propio_y_registro_explicito(self):
        self.assertEqual(set(p.SECCIONES), {'coleccion', 'rey', 'sobres'})
        original_run = subprocess.run
        llamadas = []
        def registrar(args, **opciones):
            if args[0] == 'node':
                llamadas.append(Path(args[1]).name)
            return original_run(args, **opciones)
        with patch.object(p.subprocess, 'run', side_effect=registrar):
            salida = self.preparar('sobres')
        self.assertEqual(llamadas, ['sobres-exportar.mjs', 'pruebas_sobres_exportacion.mjs', 'pruebas_sobres_apertura.mjs'])
        registro, manifiesto, contenido = p.validar_paquete(salida, 'sobres')
        self.assertEqual(set(registro['secciones']), {'sobres'})
        self.assertEqual(manifiesto['seccion'], 'sobres')
        self.assertIn('tcg/sobres/index.html', contenido)
        self.assertNotIn('tcg/sobres/movil.html', contenido)
        for desconocida in ['../sobres', 'sobres/../rey', 'main', 'dados', '/tmp/sobres', '', None]:
            with self.subTest(seccion=desconocida):
                with self.assertRaisesRegex(ValueError, 'Sección no admitida'):
                    self.preparar(desconocida)
        with self.assertRaisesRegex(ValueError, 'sección elegida'):
            p.validar_paquete(salida, 'rey')
        (salida / 'tcg/sobres/procedencia.json').unlink()
        del manifiesto['archivos']['procedencia.json']
        (salida / 'tcg/sobres/publicacion.json').write_bytes(p.json_bytes(manifiesto))
        with self.assertRaisesRegex(ValueError, 'Faltan archivos requeridos de sobres: procedencia.json'):
            p.validar_paquete(salida, 'sobres')

    def test_tres_secciones_conservan_hermanas_byte_a_byte(self):
        protegidas = self.referencias_protegidas()
        ultimo = None
        esperados = {}
        for seccion in ['coleccion', 'rey', 'sobres']:
            salida = self.preparar(seccion)
            resultado = p.publicar(self.repo, salida, seccion)
            revision = resultado['commit']
            self.assertEqual(resultado['url'], p.URL + f'/{seccion}/')
            if ultimo:
                self.assertEqual(self.git('rev-parse', revision + '^'), ultimo)
            for hermana, arbol in esperados.items():
                self.assertEqual(self.git('rev-parse', f'{revision}:tcg/{hermana}'), arbol,
                                 f'Publicar {seccion} conserva todos los bytes de {hermana}')
            esperados[seccion] = self.git('rev-parse', f'{revision}:tcg/{seccion}')
            self.assertEqual(self.referencias_protegidas(), protegidas)
            ultimo = revision
        cabeceras = self.git('show', f'{ultimo}:tcg/_headers', binario=True)
        for seccion in ['sobres', 'coleccion', 'rey']:
            (self.repo / 'componente.js').write_text(f'const revision = "Nueva {seccion}";')
            self.git('commit', '-qam', f'Revisar {seccion}')
            protegidas = self.referencias_protegidas()
            salida = self.preparar(seccion)
            revision = p.publicar(self.repo, salida, seccion)['commit']
            for hermana, arbol in esperados.items():
                if hermana != seccion:
                    self.assertEqual(self.git('rev-parse', f'{revision}:tcg/{hermana}'), arbol,
                                     f'Actualizar {seccion} conserva todos los bytes de {hermana}')
            esperados[seccion] = self.git('rev-parse', f'{revision}:tcg/{seccion}')
            self.assertEqual(self.git('show', f'{revision}:tcg/_headers', binario=True), cabeceras)
            self.assertEqual(self.referencias_protegidas(), protegidas)
            self.assertFalse(p.publicar(self.repo, salida, seccion)['nuevo'])
            registro = json.loads(self.git('show', f'{revision}:{p.MARCADOR}'))
            self.assertEqual(set(registro['secciones']), {'coleccion', 'rey', 'sobres'})
            indice = self.git('show', f'{revision}:tcg/index.html')
            for hermana in esperados:
                self.assertIn(f'href="./{hermana}/"', indice)
        self.assertEqual(self.git('status', '--porcelain'), '')

    def test_sobres_no_cambia_cabeceras_de_las_dos_secciones(self):
        p.publicar(self.repo, self.preparar('coleccion'))
        anterior = p.publicar(self.repo, self.preparar('rey'))['commit']
        exportador = self.repo / 'dev/secciones/sobres-exportar.mjs'
        exportador.write_text(exportador.read_text().replace('no-store', 'public, max-age=3600'))
        self.git('commit', '-qam', 'Fixture Sobres con política distinta')
        salida = self.preparar('sobres')
        protegidas = self.referencias_protegidas()
        with self.assertRaisesRegex(ValueError, 'cabeceras compartidas'):
            p.publicar(self.repo, salida, 'sobres')
        self.assertEqual(p.revision_remota(self.repo), anterior)
        self.assertEqual(self.referencias_protegidas(), protegidas)

    def test_no_toma_rama_ajena_o_marcador_invalido(self):
        salida = self.preparar()
        self.git('push', '-q', 'origin', 'HEAD:' + p.RAMA)
        with self.assertRaisesRegex(ValueError, 'otro proyecto'):
            p.publicar(self.repo, salida)
        self.assertEqual(p.revision_remota(self.repo), self.git('rev-parse', 'HEAD'))
        self.git('push', '-q', 'origin', ':' + p.RAMA)
        primero = p.publicar(self.repo, salida)['commit']
        invalido = self.cambiar_artefacto({p.MARCADOR: b'{"formato":"ajeno","version":1}'})
        with self.assertRaisesRegex(ValueError, 'marcador/esquema'):
            p.publicar(self.repo, salida)
        self.assertEqual(p.revision_remota(self.repo), invalido)
        self.assertNotEqual(invalido, primero)

    def test_paquete_alterado_o_fuente_antigua_no_se_envian(self):
        salida = self.preparar()
        original = (salida / 'tcg/coleccion/componente.js').read_bytes()
        (salida / 'tcg/coleccion/componente.js').write_bytes(b'alterado')
        with self.assertRaisesRegex(ValueError, 'hashes'):
            p.publicar(self.repo, salida)
        (salida / 'tcg/coleccion/componente.js').write_bytes(original)
        (salida / 'tcg/motor.js').write_text('no es un paquete aislado')
        with self.assertRaisesRegex(ValueError, 'fuera de la sección'):
            p.publicar(self.repo, salida)
        (salida / 'tcg/motor.js').unlink()
        self.siguiente_fuente()
        with self.assertRaisesRegex(ValueError, 'revisión fuente cambió'):
            p.publicar(self.repo, salida)
        self.assertIsNone(p.revision_remota(self.repo))

    def test_carrera_entre_lecturas_remotas_se_rechaza(self):
        anterior = p.publicar(self.repo, self.preparar())['commit']
        self.siguiente_fuente()
        salida = self.preparar()
        leer = p.revision_remota
        llamadas = 0
        competidor = None
        def carrera(repo):
            nonlocal llamadas, competidor
            llamadas += 1
            if llamadas == 2:
                arbol = self.git('rev-parse', anterior + '^{tree}')
                competidor = self.git('commit-tree', arbol, '-p', anterior, entrada='Publicador concurrente\n')
                self.git('push', '-q', 'origin', competidor + ':' + p.RAMA)
            return leer(repo)
        with patch.object(p, 'revision_remota', side_effect=carrera):
            with self.assertRaisesRegex(ValueError, 'Otra publicación'):
                p.publicar(self.repo, salida)
        self.assertEqual(leer(self.repo), competidor)

    def test_carrera_justo_antes_de_push_no_sobrescribe(self):
        for existente in [False, True]:
            with self.subTest(existente=existente):
                if p.revision_remota(self.repo):
                    self.git('push', '-q', 'origin', ':' + p.RAMA)
                anterior = p.publicar(self.repo, self.preparar())['commit'] if existente else None
                if existente:
                    self.siguiente_fuente()
                salida = self.preparar()
                git_real = p.git
                competidor = None
                def carrera(repo, *args, **opciones):
                    nonlocal competidor
                    if args[0] == 'push' and any(a.startswith('--force-with-lease=') for a in args):
                        if anterior:
                            arbol = git_real(repo, 'rev-parse', anterior + '^{tree}')
                            competidor = git_real(repo, 'commit-tree', arbol, '-p', anterior, entrada='Otra revisión\n')
                        else:
                            competidor = git_real(repo, 'rev-parse', 'HEAD')
                        git_real(repo, 'push', '-q', 'origin', competidor + ':' + p.RAMA)
                    return git_real(repo, *args, **opciones)
                protegido = self.referencias_protegidas()
                with patch.object(p, 'git', side_effect=carrera):
                    with self.assertRaises(subprocess.CalledProcessError):
                        p.publicar(self.repo, salida)
                self.assertEqual(p.revision_remota(self.repo), competidor)
                self.assertEqual(self.referencias_protegidas(), protegido)
                self.assertEqual(self.git('status', '--porcelain'), '')

    def test_verificacion_curl_hashes_rutas_y_errores(self):
        salida = self.preparar()
        contenido = p.archivos(salida / 'tcg')
        llamadas = []
        def curl(args, **opciones):
            self.assertEqual(args[:3], ['curl', '--disable', '-fsSL'])
            url = args[-1]
            llamadas.append(url)
            return contenido[unquote(urlsplit(url).path).lstrip('/')]
        with patch.object(p.subprocess, 'check_output', side_effect=curl):
            resultado = p.verificar_remoto(salida, 'https://revision.example')
        self.assertTrue(resultado['verificado_web'])
        self.assertTrue(any('/coleccion/movil.html?' in u for u in llamadas))
        self.assertTrue(any('imagen%20con%20espacio.svg?' in u for u in llamadas))
        self.assertFalse(any('_headers' in u or p.MARCADOR in u for u in llamadas))
        with patch.object(p.subprocess, 'check_output', return_value=b'version anterior'):
            with self.assertRaisesRegex(ValueError, 'otros bytes'):
                p.verificar_remoto(salida, 'https://revision.example')
        for url in ['file:///tmp/sitio', 'https://clave:secreta@revision.example', 'https://revision.example/?token=1']:
            with self.assertRaises(ValueError):
                p.verificar_remoto(salida, url)

    def test_modo_explicito_y_rama_destino_no_configurable(self):
        programa = Path(p.__file__)
        for args in [[], ['--publicar', '--solo-preparar'], ['--publicar', '--rama', 'main'],
                     ['--solo-preparar', '--seccion', '../rey'], ['--solo-preparar', '--seccion', 'dados']]:
            resultado = subprocess.run([sys.executable, str(programa), *args], capture_output=True, text=True)
            self.assertEqual(resultado.returncode, 2)
        self.assertIsNone(p.revision_remota(self.repo))

    def test_verificar_rey_solo_compara_su_paquete_y_url(self):
        salida = self.preparar('rey')
        contenido = p.archivos(salida / 'tcg')
        llamadas = []
        def curl(args, **opciones):
            self.assertEqual(args[:3], ['curl', '--disable', '-fsSL'])
            ruta = unquote(urlsplit(args[-1]).path).lstrip('/')
            llamadas.append(ruta)
            return contenido[ruta]
        with patch.object(p.subprocess, 'check_output', side_effect=curl):
            resultado = p.verificar_remoto(salida, 'https://revision.example')
        self.assertTrue(resultado['verificado_web'])
        self.assertEqual(resultado['url'], 'https://revision.example/rey/')
        self.assertEqual(set(llamadas), {'rey/index.html', 'rey/procedencia.json', 'rey/publicacion.json', 'rey/rey.js'})
        with patch.object(p.subprocess, 'check_output', return_value=b'otro Rey'):
            with self.assertRaisesRegex(ValueError, 'otros bytes'):
                p.verificar_remoto(salida, 'https://revision.example', 'rey')

    def test_verificar_sobres_solo_compara_su_paquete_y_url(self):
        salida = self.preparar('sobres')
        contenido = p.archivos(salida / 'tcg')
        llamadas = []
        def curl(args, **opciones):
            self.assertEqual(args[:3], ['curl', '--disable', '-fsSL'])
            ruta = unquote(urlsplit(args[-1]).path).lstrip('/')
            llamadas.append(ruta)
            return contenido[ruta]
        with patch.object(p.subprocess, 'check_output', side_effect=curl):
            resultado = p.verificar_remoto(salida, 'https://revision.example', 'sobres')
        self.assertTrue(resultado['verificado_web'])
        self.assertEqual(resultado['url'], 'https://revision.example/sobres/')
        self.assertEqual(set(llamadas), {'sobres/index.html', 'sobres/procedencia.json', 'sobres/publicacion.json', 'sobres/sobres.js'})


if __name__ == '__main__':
    unittest.main()

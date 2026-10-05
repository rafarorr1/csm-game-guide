"""Arranca Azahar con perfil Old 3DS aislado, registro y captura opcional de vídeo/TAS."""
import argparse
import hashlib
import json
import os
import pathlib
import shlex
import subprocess

raiz = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('rom', nargs='?', type=pathlib.Path, default=raiz / 'CaozARPG.3dsx')
parser.add_argument('--azahar', type=pathlib.Path, default=os.environ.get('AZAHAR_BIN'))
parser.add_argument('--salida', type=pathlib.Path, default=raiz.parents[4] / 'outputs' / '3ds' / 'azahar')
parser.add_argument('--video', action='store_true', help='Graba ambas pantallas en partida.mkv; cerrar Azahar de forma normal.')
parser.add_argument('--ffmpeg-lib', type=pathlib.Path, default=os.environ.get('AZAHAR_FFMPEG_LIB'), help='Directorio de bibliotecas FFmpeg compatibles con esta versión de Azahar.')
parser.add_argument('--grabar-tas', action='store_true', help='Registra entradas en partida.ctm.')
parser.add_argument('--reproducir-tas', type=pathlib.Path)
parser.add_argument('--preparar', action='store_true', help='Sólo crea el perfil y muestra el comando; no abre una ventana.')
args = parser.parse_args()
if args.grabar_tas and args.reproducir_tas:
    parser.error('No se puede grabar y reproducir TAS al mismo tiempo.')
if args.azahar is None:
    candidatos = sorted((raiz.parents[3] / 'herramientas' / 'azahar').glob('*/Azahar.app/Contents/MacOS/azahar'))
    if not candidatos:
        parser.error('Indica --azahar o AZAHAR_BIN con el ejecutable del emulador.')
    args.azahar = candidatos[-1]
ejecutable = args.azahar.expanduser().resolve()
rom = args.rom.expanduser().resolve()
if not ejecutable.is_file() or not rom.is_file() or rom.read_bytes()[:4] != b'3DSX':
    parser.error('Falta Azahar o el archivo no es un contenedor 3DSX.')
salida = args.salida.expanduser().resolve()
# Azahar cambia CWD al arrancar en macOS; XDG explícito evita tocar el perfil personal.
# Los directorios deben existir o Azahar vuelve a Application Support.
entorno = os.environ.copy()
for variable, carpeta in [('XDG_DATA_HOME', 'datos'), ('XDG_CONFIG_HOME', 'config'), ('XDG_CACHE_HOME', 'cache')]:
    ruta = salida / carpeta
    (ruta / 'azahar-emu').mkdir(parents=True, exist_ok=True)
    entorno[variable] = str(ruta)
perfil = salida / 'config' / 'azahar-emu'
if args.ffmpeg_lib is None:
    ffmpeg_local = raiz.parents[3] / 'herramientas' / 'ffmpeg6' / 'lib'
    if (ffmpeg_local / 'libavutil.58.dylib').is_file():
        args.ffmpeg_lib = ffmpeg_local
if args.ffmpeg_lib is not None:
    entorno['DYLD_LIBRARY_PATH'] = str(args.ffmpeg_lib.expanduser().resolve())
# La escala interna 1x conserva la resolución real de ambas pantallas de 3DS.
configuracion = {
    'Core': {'cpu_clock_percentage': '100'},
    'System': {'is_new_3ds': 'false'},
    'Renderer': {'graphics_api': '2', 'resolution_factor': '1', 'simulate_3ds_gpu_timings': 'true'},
    'Layout': {'layout_option': '0'},
    'Miscellaneous': {'check_for_update_on_start': 'false', 'log_filter': '*:Info'},
    'UI': {'firstStart': 'false', 'confirmClose': 'false', 'saveStateWarning': 'false', 'singleWindowMode': 'true', 'pauseWhenInBackground': 'false', 'enable_discord_presence': 'false', r'Paths\screenshotPath': str(salida)},
    'WebService': {'enable_telemetry': 'false'},
    'VideoDumping': {'output_format': 'matroska', 'video_encoder': 'ffv1', 'video_bitrate': '4000000', 'audio_encoder': 'pcm_s16le'},
}
texto = ''
for seccion, valores in configuracion.items():
    texto += '[' + seccion + ']\n'
    for clave, valor in valores.items():
        texto += clave + '=' + valor + '\n' + clave + '\\default=false\n'
    texto += '\n'
(perfil / 'qt-config.ini').write_text(texto)
comando = [str(ejecutable), '-w']
if args.video:
    comando += ['-d', str(salida / 'partida.mkv')]
if args.grabar_tas:
    comando += ['-r', str(salida / 'partida.ctm'), '-a', 'Caoz ARPG - revision Old 3DS']
if args.reproducir_tas:
    comando += ['-p', str(args.reproducir_tas.resolve())]
comando.append(str(rom))
manifiesto = {'rom': str(rom), 'sha256': hashlib.sha256(rom.read_bytes()).hexdigest(), 'perfil': 'Old 3DS; CPU 100%; resolución 1x; Vulkan', 'comando': comando, 'directorio': str(salida), 'entorno': {k: entorno[k] for k in ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME'] + (['DYLD_LIBRARY_PATH'] if args.ffmpeg_lib else [])}, 'hardware_fisico': False}
(salida / 'sesion.json').write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2) + '\n')
print('Directorio portable: ' + str(salida), flush=True)
print(shlex.join(comando), flush=True)
print('Controles de Azahar: A/S = A/B, Z/X = X/Y, Q/W = L/R, M/N = START/SELECT, flechas = Circle Pad, T/F/G/H = cruceta arriba/izquierda/abajo/derecha.', flush=True)
print('Cierra con el menú Salir de Azahar para finalizar vídeo y TAS; no mates el proceso.', flush=True)
if not args.preparar:
    with (salida / 'azahar-consola.log').open('w') as registro:
        resultado = subprocess.run(comando, cwd=salida, env=entorno, stdout=registro, stderr=subprocess.STDOUT)
    raise SystemExit(resultado.returncode)

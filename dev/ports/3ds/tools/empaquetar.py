"""Valida el contenedor y prepara una SD y ZIP con el nombre actual del juego."""
import argparse
import hashlib
import json
import pathlib
import shutil
import struct
import zipfile

raiz = pathlib.Path(__file__).resolve().parents[1]
argumentos = argparse.ArgumentParser(description=__doc__)
argumentos.add_argument('--salida', type=pathlib.Path, default=raiz / 'build' / 'entrega')
opciones = argumentos.parse_args()
nombre = 'CaozARPG'
rom = (raiz / (nombre + '.3dsx')).read_bytes()
icono = (raiz / (nombre + '.smdh')).read_bytes()
if len(rom) < 44 or rom[:4] != b'3DSX' or icono[:4] != b'SMDH':
    raise SystemExit('Los archivos no tienen cabeceras 3DSX/SMDH válidas.')
cabecera, reloc = struct.unpack_from('<HH', rom, 4)
offset, tamano, romfs = struct.unpack_from('<III', rom, 32)
if cabecera != 44 or reloc != 8 or rom[offset:offset + tamano] != icono or not (offset + tamano <= romfs < len(rom)):
    raise SystemExit('El contenedor no incluye el icono o RomFS esperados.')
if nombre not in icono[8:8 + 128].decode('utf-16-le').replace(' ', ''):
    raise SystemExit('El icono conserva otro nombre de aplicación.')
salida = opciones.salida.resolve()
sd = salida / nombre / '3ds' / nombre
sd.mkdir(parents=True, exist_ok=True)
for extension in ['3dsx', 'smdh']:
    shutil.copy2(raiz / (nombre + '.' + extension), sd)
shutil.copy2(raiz / 'LEEME.txt', sd.parents[1])
archivos = sorted(p for p in sd.parents[1].rglob('*') if p.is_file())
manifiesto = {str(p.relative_to(sd.parents[1])): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in archivos}
(sd.parents[1] / 'SHA256.json').write_text(json.dumps(manifiesto, indent=2) + '\n')
zip_destino = salida / (nombre + '-Old3DS.zip')
with zipfile.ZipFile(zip_destino, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as paquete:
    for archivo in sorted(p for p in sd.parents[1].rglob('*') if p.is_file()):
        paquete.write(archivo, archivo.relative_to(sd.parents[1]))
print(json.dumps({'zip': str(zip_destino), 'carpeta_sd': str(sd.parents[1]), 'archivos': manifiesto}, indent=2))

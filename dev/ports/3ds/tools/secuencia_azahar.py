"""Genera entradas CTM para la interfaz TAS de Azahar 2126.1.2, sin controlar el escritorio."""
import argparse
import pathlib
import struct

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('salida', type=pathlib.Path)
parser.add_argument('--escena', choices=['menu', 'combate', 'nivel2', 'mohamed'], default='combate')
parser.add_argument('--segundos', type=int, default=30)
parser.add_argument('--capturas', action='store_true', help='Activa SELECT + START del juego para guardar sus framebuffers en la SD.')
args = parser.parse_args()
if not 10 <= args.segundos <= 600:
    parser.error('La revisión debe durar entre 10 y 600 segundos.')
# Formato documentado por el código oficial src/core/movie.cpp en este mismo tag.
# Old 3DS, sin acelerómetro/giroscopio: cada ciclo HID produce PadAndCircle y Touch.
# src/core/hle/service/hid/hid.h fija la frecuencia en BASE_CLOCK_RATE_ARM11 / 234.
revision = bytes.fromhex('9e6f523a57fac9564ac0bf8286db3c3702d301ec')
frecuencia = 234
muestras = args.segundos * frecuencia
cabecera = struct.pack('<4sQ20sQQ32sIQq156s', b'CTM\x1b', 0, revision,
                        1577836800, 1, b'Caoz ARPG revision nativa', 1, muestras, 0, b'')
assert len(cabecera) == 256
A, B, START, DERECHA, R, L, X, Y, SELECT = 1, 2, 8, 16, 256, 512, 1024, 2048, 4
datos = bytearray(cabecera)
for i in range(muestras):
    t = i / frecuencia
    botones, cx, cy = 0, 0, 0
    if args.escena == 'mohamed' and 3 <= t < 3.15:
        botones = DERECHA
    if args.escena != 'menu':
        if 4 <= t < 4.15:
            botones = Y if args.escena == 'nivel2' else A
        elif 5 <= t < args.segundos - 2:
            ciclo = (t - 5) % 8
            botones = A if (t - 5) % 1.4 < .3 else 0
            if ciclo < 1.7:
                cy = 140
            elif ciclo < 2.0:
                botones |= X
            elif ciclo < 3.2:
                cx = 140
            elif ciclo < 3.4:
                botones |= B
            elif ciclo < 4.5:
                botones |= L
            elif ciclo < 5:
                botones |= Y
            elif ciclo < 5.2:
                botones |= R
            if 5 <= t < 5.15:
                botones |= SELECT
    if args.capturas and any(inicio <= t < inicio + .12 for inicio in [3.5, 8, 18]):
        botones, cx, cy = SELECT | START, 0, 0
    # Salida implementada por el juego: deja al emulador cerrar el volcado normalmente.
    if args.segundos - 1 <= t < args.segundos - .6:
        botones = L | R | START
    datos.extend(struct.pack('<BHhh', 0, botones, cx, cy))
    datos.extend(struct.pack('<BHHBB', 1, 0, 0, 0, 0))
args.salida.parent.mkdir(parents=True, exist_ok=True)
args.salida.write_bytes(datos)
print(f'{args.salida}: {muestras} ciclos HID, {args.segundos}s, escena {args.escena}')

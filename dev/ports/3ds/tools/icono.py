"""Icono de Homebrew Launcher: dibujo de 48 px, sin dependencias externas."""
import pathlib
import struct
import sys
import zlib

TAM = 48
imagen = [[(13, 25, 31) for _ in range(TAM)] for _ in range(TAM)]
oro = (218, 185, 114)
claro = (242, 229, 197)


def rectangulo(x, y, ancho, alto, color):
    for fila in range(max(0, y), min(TAM, y + alto)):
        for col in range(max(0, x), min(TAM, x + ancho)):
            imagen[fila][col] = color


def poligono(puntos, color):
    for y in range(TAM):
        for x in range(TAM):
            dentro = False
            for i, (ax, ay) in enumerate(puntos):
                bx, by = puntos[i - 1]
                if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                    dentro = not dentro
            if dentro:
                imagen[y][x] = color


fuente = {
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
}
for n, letra in enumerate('CAOZ'):
    for y, fila in enumerate(fuente[letra]):
        for x, pixel in enumerate(fila):
            if pixel == '1':
                rectangulo(12 + n * 6 + x, 6 + y, 1, 1, claro)
for x, y, ancho, alto in [(1, 1, 46, 1), (1, 46, 46, 1), (1, 1, 1, 46), (46, 1, 1, 46)]:
    rectangulo(x, y, ancho, alto, (98, 87, 63))
# Hacha de Adreida: mango diagonal, filo ancho y contrapeso sobre una grieta.
poligono([(14, 38), (17, 41), (34, 22), (31, 19)], oro)
poligono([(16, 18), (23, 16), (33, 22), (29, 29), (23, 25)], claro)
poligono([(32, 20), (38, 22), (36, 27), (30, 24)], oro)
poligono([(8, 39), (19, 34), (22, 37), (38, 32), (25, 40), (21, 38)], (54, 90, 97))


def bloque(tipo, datos):
    return struct.pack('>I', len(datos)) + tipo + datos + struct.pack('>I', zlib.crc32(tipo + datos))


pixeles = b''.join(b'\0' + bytes(v for pixel in fila for v in pixel) for fila in imagen)
png = b'\x89PNG\r\n\x1a\n' + bloque(b'IHDR', struct.pack('>IIBBBBB', TAM, TAM, 8, 2, 0, 0, 0))
png += bloque(b'IDAT', zlib.compress(pixeles, 9)) + bloque(b'IEND', b'')
destino = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'build/icono.png')
destino.parent.mkdir(parents=True, exist_ok=True)
destino.write_bytes(png)

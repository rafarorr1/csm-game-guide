"""Prepara materiales de Scenario para el bosque, con relieve aproximado moderado.
Uso: python preparar-texturas.py /ruta/fuentes
Requiere Pillow y numpy. No modifica los originales descargados de Scenario.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

fuentes = Path(sys.argv[1])
salida = Path(__file__).resolve().parent
resultados = []

def suavizar_periodico(a, radio):
    n = a.shape[0]
    mosaico = Image.fromarray(np.uint8(np.tile(a, (3, 3)) * 255))
    return np.asarray(mosaico.filter(ImageFilter.GaussianBlur(radio)), dtype=np.float32)[n:n*2, n:n*2] / 255

for nombre in ('suelo', 'corteza', 'roca'):
    archivo = fuentes / (nombre + '.png')
    if not archivo.exists():
        continue
    color = np.asarray(Image.open(archivo).convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS), dtype=np.float32) / 255
    # El generador borra las costuras; emparejar sólo cuatro píxeles evita una línea al repetir.
    for eje in (0, 1):
        color = np.swapaxes(color, 0, eje)
        for i in range(4):
            peso = .5 * (1-i/4)**2
            a, b = color[i].copy(), color[-1-i].copy()
            color[i] = a*(1-peso)+b*peso
            color[-1-i] = b*(1-peso)+a*peso
        color = np.swapaxes(color, 0, eje)
    gris = color @ np.array([.2126, .7152, .0722])
    altura = suavizar_periodico(gris, 1.8)
    lo, hi = np.percentile(altura, [8, 92])
    altura = np.clip((altura-lo)/max(.12, hi-lo), 0, 1)
    fuerza = {'suelo': 2.5, 'corteza': 4, 'roca': 3}[nombre]
    dx = (np.roll(altura, -1, 1)-np.roll(altura, 1, 1))*fuerza
    dy = (np.roll(altura, -1, 0)-np.roll(altura, 1, 0))*fuerza
    normal = np.stack((-dx, dy, np.ones_like(altura)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    # R no añade oclusión; G contiene rugosidad; B es altura, jamás metalicidad.
    superficie = np.stack((np.ones_like(altura), .96-.10*altura, altura), axis=-1)
    for tipo, datos in [('color', color), ('normal', normal*.5+.5), ('superficie', superficie)]:
        im = Image.fromarray(np.uint8(np.clip(datos, 0, 1)*255))
        if tipo != 'color':
            im = im.resize((512, 512), Image.Resampling.LANCZOS)
        im.save(salida / f'{nombre}-{tipo}.webp', quality=85 if tipo=='color' else 82, method=6)
    costuras = []
    for eje in (0, 1):
        c = np.swapaxes(color, 0, eje)
        costuras.append(float(np.abs(c[0]-c[-1]).mean()))
    resultados.append({'nombre': nombre, 'fuente_sha256': hashlib.sha256(archivo.read_bytes()).hexdigest(), 'diferencia_bordes': costuras})

atlas = fuentes / 'follaje.png'
if atlas.exists():
    im = Image.open(atlas).convert('RGBA').resize((1024, 1024), Image.Resampling.LANCZOS)
    im.save(salida / 'follaje-atlas.webp', quality=88, method=6, exact=True)
    alfa = np.asarray(im)[:, :, 3]
    resultados.append({'nombre': 'follaje', 'fuente_sha256': hashlib.sha256(atlas.read_bytes()).hexdigest(), 'pixeles_transparentes': float((alfa<128).mean())})
print(json.dumps(resultados, ensure_ascii=False, indent=2))

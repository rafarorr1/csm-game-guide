"""Extrae las muertes FBX en Y arriba, sin importar sus texturas al juego.

Blender --background --factory-startup --python-exit-code 1 --python este.py -- entrada.fbx salida.json
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix
from bpy_extras import image_utils

entrada, salida = map(Path, sys.argv[sys.argv.index('--') + 1:])
cargar = image_utils.load_image
image_utils.load_image = lambda *args, **kwargs: bpy.data.images.new('SinTextura', 1, 1)
try:
    bpy.ops.import_scene.fbx(filepath=str(entrada.resolve()), use_image_search=False)
finally:
    image_utils.load_image = cargar
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
escena = bpy.context.scene
accion = arm.animation_data.action
inicio, fin = map(float, accion.frame_range)
fps = escena.render.fps / escena.render.fps_base
duracion = (fin - inicio) / fps
intervalos = math.ceil(duracion * 30)
ejes = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
nombres = ['Hips', 'Spine2', 'Head'] + [lado + parte for lado in ['Left', 'Right'] for parte in ['Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End']]


def datos(m):
    q = m.to_quaternion()
    return {'p': list(m.translation), 'q': [q.x, q.y, q.z, q.w]}


reposo = {n: datos(ejes @ arm.matrix_world @ arm.data.bones['mixamorig:' + n].matrix_local) for n in nombres}
filas = []
for i in range(intervalos + 1):
    f = inicio + (fin - inicio) * i / intervalos
    escena.frame_set(int(f), subframe=f - int(f))
    bpy.context.view_layer.update()
    filas.append({n: datos(ejes @ arm.matrix_world @ arm.pose.bones['mixamorig:' + n].matrix) for n in nombres})
resultado = {'fuente': entrada.name, 'sha256': hashlib.sha256(entrada.read_bytes()).hexdigest(), 'accion': accion.name, 'fps': fps, 'duracion': duracion, 'muestras': len(filas), 'reposo': reposo, 'poses': filas}
salida.write_text(json.dumps(resultado, separators=(',', ':')))
print('RESULT ' + json.dumps({k: resultado[k] for k in ['fuente', 'sha256', 'accion', 'fps', 'duracion', 'muestras']}))

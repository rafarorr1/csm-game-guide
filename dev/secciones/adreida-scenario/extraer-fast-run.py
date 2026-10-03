"""Extrae sólo el movimiento del FBX aportado por el usuario; no importa su aspecto.
Blender --background --factory-startup --python-exit-code 1 --python este.py -- entrada.fbx salida.json
"""
import bpy, json, sys, hashlib
from pathlib import Path
from mathutils import Matrix
from bpy_extras import image_utils

def main():
    entrada, salida = map(Path, sys.argv[sys.argv.index('--') + 1:])
    # Las texturas del maniquí no se usan. Evita buscar rutas externas guardadas en el FBX.
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
    ejes = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
    nombres = ['Hips','Spine2','Head'] + [lado + parte for lado in ['Left','Right'] for parte in ['Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase','Toe_End']]
    reposo = {n:ejes @ arm.matrix_world @ arm.data.bones['mixamorig:'+n].matrix_local for n in nombres}
    def datos(m):
        q=m.to_quaternion();return {'p':list(m.translation),'q':[q.x,q.y,q.z,q.w]}
    filas=[]
    for i in range(65):
        f=inicio+(fin-inicio)*i/64
        escena.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
        filas.append({n:datos(ejes @ arm.matrix_world @ arm.pose.bones['mixamorig:'+n].matrix) for n in nombres})
    resultado={'fuente':entrada.name,'sha256':hashlib.sha256(entrada.read_bytes()).hexdigest(),'accion':accion.name,'fps':escena.render.fps,'duracion':(fin-inicio)/escena.render.fps,'muestras':64,'reposo':{n:datos(m) for n,m in reposo.items()},'poses':filas}
    salida.write_text(json.dumps(resultado,separators=(',',':')))
    print('RESULT '+json.dumps({'duracion':resultado['duracion'],'muestras':64,'salida':str(salida)}))
main()

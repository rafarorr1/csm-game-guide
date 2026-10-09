"""Reduce el roble estático de Scenario conservando UV y revisa su silueta.
Blender --background --factory-startup --python-exit-code 1 --python optimizar-roble.py -- entrada.glb salida.glb directorio_revision
"""
import bpy
import json
import sys
from pathlib import Path

entrada, salida, revision = sys.argv[sys.argv.index('--')+1:]
print('VERSION_BLENDER', bpy.app.version_string)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(entrada).resolve()))
objetos = [o for o in bpy.context.scene.objects if o.type == 'MESH']
original = sum(len(o.data.polygons) for o in objetos)
for o in objetos:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    md = o.modifiers.new('Presupuesto de bosque', 'DECIMATE')
    md.ratio = min(1, 1950 / max(1, original))
    md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=md.name)
    o.data.update()
    o.select_set(False)
final = sum(len(o.data.polygons) for o in objetos)
sys.path.append(str(Path.home()/'.codex/skills/scenario-blender-expert/scripts'))
import bx_review
sheet = bx_review.review(objetos, str(Path(revision).resolve()), views=('front','right','threequarter'), modes=('silhouette','matcap','wire'))
bpy.ops.export_scene.gltf(filepath=str(Path(salida).resolve()), export_format='GLB', export_yup=True)
print(json.dumps({'original': original, 'final': final, 'revision': str(sheet), 'salida': salida}))

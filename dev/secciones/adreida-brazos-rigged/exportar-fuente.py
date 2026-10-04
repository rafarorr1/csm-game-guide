"""Lee los brazos entregados por el usuario, sin ejecutar scripts del .blend.
Blender --background --factory-startup --disable-autoexec --python exportar-fuente.py -- fuente.blend salida.json
"""
import bpy, json, sys, hashlib
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; fuente=Path(args[0]); salida=Path(args[1])
bpy.ops.wm.open_mainfile(filepath=str(fuente),use_scripts=False)
rig=bpy.data.objects['Basiccharacter'];rig.data.pose_position='REST'
obj=bpy.data.objects['Basiccharacter:Body'];mesh=obj.data;mesh.calc_loop_triangles()
uv=mesh.uv_layers.active.data;grupos={g.index:g.name for g in obj.vertex_groups}
# La piel conserva todos sus pesos y costuras UV; se normaliza después de ajustarla al juego.
vertices=[];caras=[];ids={}
for tri in mesh.loop_triangles:
    cara=[]
    for li in tri.loops:
        vi=mesh.loops[li].vertex_index;tex=tuple(uv[li].uv);clave=(vi,tex)
        if clave not in ids:
            v=mesh.vertices[vi];ids[clave]=len(vertices)
            vertices.append({'fuente':vi,'p':list(v.co),'uv':list(tex),'pesos':{grupos[g.group]:g.weight for g in v.groups if g.weight>1e-6}})
        cara.append(ids[clave])
    caras.append(cara)
datos={'fuente':fuente.name,'sha256':hashlib.sha256(fuente.read_bytes()).hexdigest(),'vertices':vertices,'triangulos':caras,
    'huesos':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(r)for r in b.matrix_local],'padre':b.parent.name if b.parent else None}for b in rig.data.bones}}
salida.parent.mkdir(parents=True,exist_ok=True);salida.write_text(json.dumps(datos,separators=(',',':')))
print('Exportados',len(vertices),'vértices UV,',len(caras),'triángulos y',len(datos['huesos']),'huesos.')

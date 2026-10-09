"""Reconstruye UV del roble reducido y hornea color desde la fuente de Scenario.
Blender --background --factory-startup --python-exit-code 1 --python hornear-roble.py -- fuente.glb salida.glb carpeta_revision
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

entrada,salida,carpeta=sys.argv[sys.argv.index('--')+1:]
carpeta=Path(carpeta).resolve();carpeta.mkdir(parents=True,exist_ok=True)
print('VERSION_BLENDER',bpy.app.version_string)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(entrada).resolve()))
alto=next(o for o in bpy.context.scene.objects if o.type=='MESH');alto.name='Roble_fuente'
bajo=alto.copy();bajo.data=alto.data.copy();bajo.name='Roble_runtime';bpy.context.collection.objects.link(bajo)
bpy.ops.object.select_all(action='DESELECT');bajo.select_set(True);bpy.context.view_layer.objects.active=bajo
md=bajo.modifiers.new('Presupuesto','DECIMATE');md.ratio=5900/len(bajo.data.polygons);md.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=md.name)
for uv in list(bajo.data.uv_layers):bajo.data.uv_layers.remove(uv)
bajo.data.uv_layers.new(name='UV_horneado')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.0015)
bpy.ops.object.mode_set(mode='OBJECT')
for p in bajo.data.polygons:p.use_smooth=True
mat=bpy.data.materials.new('Roble_mate');mat.use_nodes=True;bajo.data.materials.clear();bajo.data.materials.append(mat)
# Emisión copia albedo sin hornear iluminación, AO ni reflejos del estudio.
fuente=alto.data.materials[0];ns=fuente.node_tree.nodes;ls=fuente.node_tree.links
principio=next(n for n in ns if n.type=='BSDF_PRINCIPLED');color=principio.inputs['Base Color'].links[0].from_socket
# Trellis dejó las hojas gris claras incluso en la fuente: corrección artística
# explícita a madera marrón y follaje oliva, conservando la variación del albedo.
luma=ns.new('ShaderNodeRGBToBW');ls.new(color,luma.inputs[0])
verde=ns.new('ShaderNodeValToRGB');verde.color_ramp.elements[0].position=.08;verde.color_ramp.elements[0].color=(.022,.033,.012,1)
verde.color_ramp.elements[1].position=.8;verde.color_ramp.elements[1].color=(.115,.17,.045,1);ls.new(luma.outputs[0],verde.inputs[0])
madera=ns.new('ShaderNodeMixRGB');madera.blend_type='MULTIPLY';madera.inputs[0].default_value=1;madera.inputs[2].default_value=(.35,.23,.12,1);ls.new(color,madera.inputs[1])
umbral=ns.new('ShaderNodeMapRange');umbral.inputs['From Min'].default_value=.09;umbral.inputs['From Max'].default_value=.24;ls.new(luma.outputs[0],umbral.inputs['Value'])
coordenadas=ns.new('ShaderNodeTexCoord');separar=ns.new('ShaderNodeSeparateXYZ');ls.new(coordenadas.outputs['Generated'],separar.inputs[0])
altura=ns.new('ShaderNodeMapRange');altura.inputs['From Min'].default_value=.26;altura.inputs['From Max'].default_value=.4;ls.new(separar.outputs['Z'],altura.inputs['Value'])
factor=ns.new('ShaderNodeMath');factor.operation='MULTIPLY';ls.new(umbral.outputs[0],factor.inputs[0]);ls.new(altura.outputs[0],factor.inputs[1])
mezcla=ns.new('ShaderNodeMixRGB');ls.new(factor.outputs[0],mezcla.inputs[0]);ls.new(madera.outputs[0],mezcla.inputs[1]);ls.new(verde.outputs[0],mezcla.inputs[2])
emision=ns.new('ShaderNodeEmission');ls.new(mezcla.outputs[0],emision.inputs['Color']);ls.new(emision.outputs[0],next(n for n in ns if n.type=='OUTPUT_MATERIAL').inputs['Surface'])
sys.path.append(str(Path.home()/'.codex/skills/scenario-blender-uv-baking/scripts'))
import bx_uvbake as ub
# En headless macOS la enumeración de dispositivos Metal puede bloquearse.
# Este horneado pequeño usa CPU y deja la GPU disponible para el juego.
def usar_cpu(escena):
    escena.cycles.device='CPU'
    return 'CPU'
ub._use_gpu=usar_cpu
qa=ub.uv_qa(bajo,1024);print('UV_QA',json.dumps(qa,default=str)[:1500])
ub.uv_layout_image(bajo,str(carpeta/'uv.png'))
reporte=ub.bake_high_to_low(bajo,[alto],str(carpeta),res=1024,maps=('EMIT',),samples=16,adaptive=True,prefix='roble',margin_px=4)
(carpeta/'horneado.json').write_text(json.dumps(reporte,indent=2,default=str))
mapa=bpy.data.images.load(reporte['paths']['EMIT']);mapa.colorspace_settings.name='sRGB'
n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=mapa
p=mat.node_tree.nodes.get('Principled BSDF');mat.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.98;p.inputs['Metallic'].default_value=0
bpy.ops.object.select_all(action='DESELECT');bajo.select_set(True);bpy.context.view_layer.objects.active=bajo
bpy.ops.export_scene.gltf(filepath=str(Path(salida).resolve()),export_format='GLB',export_yup=True,use_selection=True)
alto.hide_render=True
esc=bpy.context.scene;esc.render.engine='CYCLES';esc.cycles.samples=24;esc.render.resolution_x=800;esc.render.resolution_y=1000;esc.render.resolution_percentage=100
esc.world.color=(.25,.25,.25)
camera=bpy.data.cameras.new('Revision');obj=bpy.data.objects.new('Revision',camera);esc.collection.objects.link(obj);esc.camera=obj
objetivo=sum((alto.matrix_world@Vector(v) for v in alto.bound_box),Vector())/8
obj.location=objetivo+Vector((1.4,-1.6,.5));obj.rotation_euler=(objetivo-obj.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=1.28
bpy.ops.object.light_add(type='AREA',location=(1,-2,3));l=bpy.context.object;l.data.energy=180;l.data.shape='DISK';l.data.size=3;l.rotation_euler=(objetivo-l.location).to_track_quat('-Z','Y').to_euler()
esc.render.filepath=str(carpeta/'roble-color-revision.png');bpy.ops.render.render(write_still=True)
print(json.dumps({'salida':salida,'triangulos':len(bajo.data.polygons),'proyeccion':reporte['projection'],'advertencias':reporte.get('warnings')}))

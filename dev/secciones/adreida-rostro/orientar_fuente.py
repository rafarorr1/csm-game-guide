import bpy,numpy as np,json,sys,math
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1])
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(out/'cabeza-original.glb'))
objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
rows=[]
for ob in objs:
 p=np.array([ob.matrix_world@v.co for v in ob.data.vertices]);rows.append((ob,np.c_[p[:,0],p[:,2],-p[:,1]]))
p=np.concatenate([p for _,p in rows]);low=p.min(0);high=p.max(0);scale=.416/(high[1]-low[1]);center=(low+high)/2
for ob,p in rows:
 p=(p-center)*scale;p[:,1]+=1.708
 # El cuello queda detrás del pecho, los ojos cerca del plano original de la cara.
 p[:,2]+=-.055
 ob.matrix_world.identity()
 for v,co in zip(ob.data.vertices,p):v.co=(co[0],-co[2],co[1])
 for poly in ob.data.polygons:poly.use_smooth=True
 ob['fuente_adreida']=True
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1024;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.world.color=(.05,.05,.05);scene.view_settings.view_transform='AgX'
for name,loc,power,size in [('Principal',(-1,-2,3),180,2),('Relleno',(1,-.6,1.8),80,1.5),('Borde',(0,1,2.7),120,1)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,1.72))-ob.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Camara',bpy.data.cameras.new('Camara'));scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=.49
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fuente-orientada.blend'))
for name,loc in [('frente',(0,-2,1.715)),('perfil',(2,0,1.715)),('tres-cuartos',(1,-2,1.715))]:
 camera.location=loc;camera.rotation_euler=(Vector((0,0,1.715))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/('fuente-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('RESULT',json.dumps({'inputBounds':[low.tolist(),high.tolist()],'scale':float(scale),'meshes':len(rows),'vertices':sum(len(p)for _,p in rows)}))

"""Retopología facial de Adreida en Blender 5.2; conserva loops y transporta los targets.
Ejecutar Blender --background --factory-startup --python-exit-code 1 --python preparar.py -- /carpeta/fuentes ajustar|hornear|exportar
La carpeta de fuentes contiene fuente-orientada.blend y anclas-adreida.json.
"""
import bpy, numpy as np, json, sys, math, base64, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
AQUI=Path(__file__).resolve().parent
ARGS=sys.argv[sys.argv.index('--')+1:];SALIDA=Path(ARGS[0]);FASE=ARGS[1] if len(ARGS)>1 else 'ajustar'
def obj_mesh(nombre,p,f,uv=None,fuv=None):
    me=bpy.data.meshes.new(nombre);me.from_pydata([(x,-z,y)for x,y,z in p],[],f);me.update();ob=bpy.data.objects.new(nombre,me);bpy.context.scene.collection.objects.link(ob)
    for q in me.polygons:q.use_smooth=True
    if uv is not None:
        u=me.uv_layers.new(name='UVMap')
        for face,ids in zip(me.polygons,fuv):
            for loop,i in zip(face.loop_indices,ids):u.data[loop].uv=uv[i]
    ob['tarea_caoz']='rostro_adreida';return ob

def matriz_puntos(ob):
    return np.array([(v.co.x,v.co.z,-v.co.y)for v in ob.data.vertices],dtype=float)
def cod(a,t='<f4'):return base64.b64encode(np.asarray(a,dtype=t).tobytes()).decode()
def cabeza_datos():return json.loads((AQUI/'fuentes/cabeza-mpfb-con-targets.json').read_text())
def material(nombre,color):
    m=bpy.data.materials.new(nombre);b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=.72;return m

def ajustar():
    bpy.ops.wm.open_mainfile(filepath=str(SALIDA/'fuente-orientada.blend'))
    fuentes=[o for o in bpy.data.objects if o.type=='MESH' and o.get('fuente_adreida')]
    for o in fuentes:
        matriz=o.matrix_world.copy();o.parent=None;o.matrix_world=matriz
        o.location.z-=.020;o.location.y-=.035
    bpy.context.view_layer.update()
    p=[];f=[]
    for o in fuentes:
        offset=len(p);p.extend([(v.x,v.z,-v.y)for v in (o.matrix_world@v.co for v in o.data.vertices)]);f.extend([[i+offset for i in q.vertices]for q in o.data.polygons])
    bvh=BVHTree.FromPolygons(p,f);d=cabeza_datos();s=np.array(d['posiciones'],dtype=float);land=json.loads((AQUI/'fuentes/landmarks.json').read_text());anclas=json.loads((SALIDA/'anclas-adreida.json').read_text())
    # RBF biharmónica en tres dimensiones con término afín: base y targets comparten exactamente el mismo mapa.
    pares={n:v for n,v in anclas['anclas'].items()if n not in ['centroCabeza','centroCraneo']};origen=np.array([land['landmarks'][n]['posicion']for n in pares]);destino=np.array([pares[n]['destinoJuegoFinal']for n in pares])+[0,0,.035]
    r=np.linalg.norm(origen[:,None]-origen[None,:],axis=2);af=np.c_[np.ones(len(origen)),origen];mat=np.block([[r-np.eye(len(r))*0.01,af],[af.T,np.zeros((4,4))]])
    coef=np.linalg.solve(mat,np.r_[destino,np.zeros((4,3))])
    def W(points):return np.c_[np.linalg.norm(points[:,None]-origen[None,:],axis=2),np.ones(len(points)),points]@coef
    base=W(s);correccion=np.zeros_like(base);protegidos=set(land['mascaras']['noShrinkwrap']['vertices'])
    for i,co in enumerate(base):
        if i in protegidos:continue
        hit=bvh.find_nearest(Vector(co))
        if hit[0] is not None and hit[3]<.035:correccion[i]=(np.array(hit[0])-co)*min(1,.008/max(hit[3],1e-8))
    ady=[set()for _ in s]
    for cara in d['caras']:
        for a,b in zip(cara,cara[1:]+cara[:1]):ady[a].add(b);ady[b].add(a)
    for _ in range(12):
        c=correccion.copy()
        for i,v in enumerate(ady):
            if i in protegidos:c[i]=0
            elif v:c[i]=correccion[i]*.25+correccion[list(v)].mean(0)*.75
        correccion=c
    base+=correccion
    excluir=set(land['mascaras']['interiorCavidadOjoI']['caras']+land['mascaras']['interiorCavidadOjoD']['caras'])
    originales=[i for i in range(len(d['caras']))if i not in excluir];caras=[d['caras'][i]for i in originales];uvfaces=[v for i,v in enumerate(d['carasUV'])if i not in excluir]
    # Las caras bajo el collar no deben sobresalir del cuerpo al girar la cabeza.
    keep=[i for i,face in enumerate(caras)if np.max(base[face,1])>1.535]
    caras=[caras[i]for i in keep];uvfaces=[uvfaces[i]for i in keep];originales=[originales[i]for i in keep]
    ob=obj_mesh('Rostro',base,caras,d['uv'],uvfaces);ob.data.materials.append(material('Piel de Adreida',(.34,.29,.18)));ob.shape_key_add(name='Basis').value=0
    mapping={'eyeBlinkLeft':'eye-left-closure','eyeBlinkRight':'eye-right-closure','eyeSquintLeft':'eye-left-slit','eyeSquintRight':'eye-right-slit','eyeWideLeft':'eye-left-opened-up','eyeWideRight':'eye-right-opened-up','browDownLeft':'eyebrows-left-down','browDownRight':'eyebrows-right-down','browOuterUpLeft':'eyebrows-left-extern-up','browOuterUpRight':'eyebrows-right-extern-up','jawOpen':'mouth-open'}
    for tipo,source in [('mouthSmile','mouth-corner-puller'),('mouthFrown','mouth-depression'),('mouthPress','mouth-compression'),('mouthSneer','nose-left-elevation')]:
        for lado in ['Left','Right']:mapping[tipo+lado]=source if tipo!='mouthSneer' else 'nose-'+lado.lower()+'-elevation'
    deltas={}
    for name,source in mapping.items():
        v=s.copy()
        for i,x,y,z in d['targets'][source]:v[i]+=(x,y,z)
        delta=W(v)+correccion-base
        if name.startswith(('mouthSmile','mouthFrown','mouthPress')):
            side=np.clip(s[:,0]/.06*.5+.5,0,1);delta*= (side if name.endswith('Left')else 1-side)[:,None]
        deltas[name]=delta
    v=s.copy()
    for source in ['eyebrows-left-inner-up','eyebrows-right-inner-up']:
        for i,x,y,z in d['targets'][source]:v[i]+=(x,y,z)
    deltas['browInnerUp']=W(v)+correccion-base
    for name,delta in deltas.items():
        key=ob.shape_key_add(name=name);key.value=0;key.slider_min=0;key.slider_max=1
        for vert,co in zip(key.data,base+delta):vert.co=(co[0],-co[2],co[1])
    # UV anatómicas continuas: empaquetado sin solapes para conservar calidad al deformar.
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(rotate=False,scale=True,margin_method='FRACTION',margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
    # Guardar la correspondencia para auditar cierre y exportar el mismo modelo a Three.js.
    ob['fuente_indices']=json.dumps(d['indicesFuente']);ob['landmarks']=json.dumps({n:W(np.array([x['posicion']]))[0].tolist()for n,x in land['landmarks'].items()});ob['sin_proyeccion']=len(protegidos)
    interior=set(land['mascaras']['interiorBoca']['caras']);ob['interior_boca']=json.dumps([j for j,i in enumerate(originales)if i in interior])
    # Globos independientes; sus superficies y centros pasan por el mismo ajuste que los párpados.
    for lado in ['I','D']:
        centro=np.array(land['landmarks']['centroOjo'+lado]['posicion']);p_ojo=[];uv_ojo=[];f_ojo=[]
        filas=20;columnas=32
        for i in range(filas+1):
            theta=math.pi*i/filas
            for j in range(columnas+1):
                phi=2*math.pi*j/columnas;n=np.array([math.sin(theta)*math.cos(phi),math.sin(theta)*math.sin(phi),math.cos(theta)])
                p_ojo.append(centro+n*.159);uv_ojo.append([.064+n[0]*.060,.064+n[1]*.060])
        for i in range(filas):
            for j in range(columnas):
                a=i*(columnas+1)+j;b=a+columnas+1
                if i==0:f_ojo.append([a,b,b+1])
                elif i==filas-1:f_ojo.append([a,b,a+1])
                else:f_ojo.append([a,b,b+1,a+1])
        ojo=obj_mesh('Ojo '+lado,W(np.array(p_ojo)),f_ojo,uv_ojo,f_ojo);ojo['tipo_rostro']='ojos';ojo['lado']=lado;ojo['centro']=W(centro[None])[0].tolist();ojo.data.materials.append(material('Esclerotica '+lado,(.48,.43,.32)))
        # La forma del globo permanece rígida: el runtime lo rota sobre su centro, no deforma el iris.
    ob['tipo_rostro']='piel'
    # Banda reservada para iris, dientes y mucosa: nunca se proyecta el ojo pintado del sculpt.
    for u in ob.data.uv_layers.active.data:u.uv.y=u.uv.y*.855+.14
    for i in json.loads(ob['interior_boca']):
        for loop in ob.data.polygons[i].loop_indices:ob.data.uv_layers.active.data[loop].uv=(.27,.06)
    # Dentadura en dos arcos; los colmillos inferiores acompañan la mandíbula.
    for inferior in [False,True]:
        piezas=[]
        for j in range(10):
            ang=(j-4.5)*.205;x=math.sin(ang)*.038;z=.063+math.cos(ang)*.037;y=1.672 if inferior else 1.681
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=6,location=(x,-z,y));t=bpy.context.object;t.scale=(.0043,.0036,.0047);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);piezas.append(t)
        if inferior:
            for lado in [-1,1]:
                bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.0044,radius2=.0008,depth=.017,location=(lado*.033,-.096,1.677));t=bpy.context.object;t.rotation_euler[1]=lado*.15;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);piezas.append(t)
        bpy.ops.object.select_all(action='DESELECT')
        for t in piezas:t.select_set(True)
        bpy.context.view_layer.objects.active=piezas[0];bpy.ops.object.join();dent=piezas[0];dent.name='Dientes inferiores'if inferior else 'Dientes superiores';bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        dent['tipo_rostro']='piel';dent.data.materials.clear();dent.data.materials.append(material('Marfil envejecido',(.63,.53,.32)))
        if not dent.data.uv_layers:dent.data.uv_layers.new()
        for u in dent.data.uv_layers.active.data:u.uv=(.19,.06)
        for f in dent.data.polygons:f.use_smooth=True
        if inferior:
            dent.shape_key_add(name='Basis');key=dent.shape_key_add(name='jawOpen')
            # Bisagra posterior de la mandíbula: 15 grados con descenso, sin separar dientes de la encía.
            pivot=np.array([0,1.699,.022]);ca=math.cos(.27);sa=math.sin(.27)
            for v in key.data:
                p=np.array([v.co.x,v.co.z,-v.co.y]);q=p-pivot;q[1],q[2]=q[1]*ca-q[2]*sa,q[1]*sa+q[2]*ca;p=q+pivot;v.co=(p[0],-p[2],p[1])

    for o in fuentes:o.hide_render=True;o.hide_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SALIDA/'adreida-rostro-ajuste.blend'))
    print('RESULT',json.dumps({'fase':'ajustar','vertices':len(base),'caras':len(caras),'shapes':len(deltas),'RBFerrorMax':float(np.max(np.linalg.norm(W(origen)-destino,axis=1)))}))

def hornear():
    bpy.ops.wm.open_mainfile(filepath=str(SALIDA/'adreida-rostro-ajuste.blend'))
    sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=32;sc.cycles.device='CPU'
    ob=bpy.data.objects['Rostro'];fuentes=[o for o in bpy.data.objects if o.type=='MESH'and o.get('fuente_adreida')]
    bpy.ops.object.select_all(action='DESELECT')
    for o in fuentes:o.hide_set(False);o.hide_render=False;o.select_set(True)
    ob.select_set(True);bpy.context.view_layer.objects.active=ob
    sc.render.bake.use_selected_to_active=True;sc.render.bake.cage_extrusion=.024;sc.render.bake.max_ray_distance=.065;sc.render.bake.margin=12
    size=int(ARGS[2])if len(ARGS)>2 else 2048
    for nombre,tipo in [('color','DIFFUSE'),('normal','NORMAL')]:
        im=bpy.data.images.new('Adreida '+nombre,width=size,height=size,alpha=False);im.colorspace_settings.name='sRGB'if nombre=='color'else'Non-Color';im.generated_color=(.18,.15,.10,1)if nombre=='color'else(.5,.5,1,1)
        for m in ob.data.materials:
            tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.nodes.active=tex
        bpy.ops.object.bake(type=tipo,pass_filter={'COLOR'}if tipo=='DIFFUSE'else{'DIRECT'},use_clear=True)
        im.filepath_raw=str(SALIDA/(nombre+'-bake.png'));im.file_format='PNG';im.save()
    for o in fuentes:o.hide_render=True;o.hide_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SALIDA/'adreida-rostro-bake.blend'))
    print('RESULT',json.dumps({'fase':'hornear','resolucion':size}))

def exportar():
    bpy.ops.wm.open_mainfile(filepath=str(SALIDA/'adreida-rostro-ajuste.blend'))
    objs=[o for o in bpy.data.objects if o.type=='MESH'and o.get('tipo_rostro')];canales=list(bpy.data.objects['Rostro'].data.shape_keys.key_blocks.keys())[1:]
    # Materiales reconstruidos exclusivamente con mapas horneados; el .blend queda autosuficiente.
    mapas={n:bpy.data.images.load(str(SALIDA/(n+'-atlas.png')),check_existing=True)for n in ['color','normal','superficie']}
    for n,im in mapas.items():im.colorspace_settings.name='sRGB'if n=='color'else'Non-Color';im.pack()
    for ob in objs:
        mat=material('Adreida · '+ob.name,(.3,.26,.18));nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
        for n,im in mapas.items():
            tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im
            if n=='color':nt.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
            elif n=='superficie':nt.links.new(tex.outputs['Color'],bs.inputs['Roughness'])
            else:
                normal=nt.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55 if ob.get('tipo_rostro')=='piel'else .08;nt.links.new(tex.outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
        if ob.get('tipo_rostro')=='ojos':bs.inputs['Roughness'].default_value=.24
        ob.data.materials.clear();ob.data.materials.append(mat)
    def extraer(ob):
        me=ob.data;me.calc_loop_triangles();uv=me.uv_layers.active;claves={};vertices=[];indices=[];fuentes=[]
        for tri in me.loop_triangles:
            for loop in tri.loops:
                vid=me.loops[loop].vertex_index;u=uv.data[loop].uv;k=(vid,round(u.x,7),round(u.y,7))
                if k not in claves:claves[k]=len(vertices);vertices.append((vid,u.x,1-u.y));fuentes.append(vid)
                indices.append(claves[k])
        def pose():
            ev=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();p=[];n=[]
            for vid,u,v in vertices:
                co=mesh.vertices[vid].co;no=mesh.vertices[vid].normal;p.append([co.x,co.z-1.57,-co.y]);n.append([no.x,no.z,-no.y])
            ev.to_mesh_clear();return np.array(p),np.array(n)
        p,n=pose();morph={};keys=me.shape_keys.key_blocks if me.shape_keys else None
        if keys:
            for name in canales:
                if name not in keys:continue
                keys[name].value=1;bpy.context.view_layer.update();pp,nn=pose();keys[name].value=0;bpy.context.view_layer.update();morph[name]=(pp-p,nn-n)
        return {'p':p,'n':n,'uv':np.array([[u,v]for _,u,v in vertices]),'tri':np.array(indices),'morph':morph,'fuentes':fuentes}
    mallas=[];skin=[o for o in objs if o.get('tipo_rostro')=='piel'];grupos=[('Rostro',skin)]+[(o.name,[o])for o in objs if o.get('tipo_rostro')=='ojos']
    mapa_export=None
    for nombre,grupo in grupos:
        piezas=[];offset=0
        for ob in grupo:
            data=extraer(ob);data['tri']+=offset
            if ob.name=='Rostro':mapa_export={vid:offset+i for i,vid in enumerate(data['fuentes'])}
            offset+=len(data['p']);piezas.append(data)
        if offset>65535:raise ValueError('Rostro fuera del presupuesto Uint16')
        d={'nombre':nombre,'tipo':grupo[0]['tipo_rostro'],'posicion':cod(np.concatenate([x['p']for x in piezas])),'normal':cod(np.concatenate([x['n']for x in piezas])),'uv':cod(np.concatenate([x['uv']for x in piezas])),'triangulos':cod(np.concatenate([x['tri']for x in piezas]),'<u2'),'morphs':{}}
        if d['tipo']=='piel':
            for name in canales:d['morphs'][name]={attr:cod(np.concatenate([x['morph'].get(name,(np.zeros_like(x['p']),np.zeros_like(x['n'])))[i]for x in piezas]))for i,attr in enumerate(['posicion','normal'])}
        else:d.update(ojo=grupo[0]['lado'],centro=(np.array(grupo[0]['centro'])-[0,1.57,0]).tolist())
        mallas.append(d)
    mask=json.loads((SALIDA/'mascara-cabeza-anterior.json').read_text());datos={'version':1,'canales':canales,'mallas':mallas,'indicesCuerpo':mask['indicesCuerpo'],'auditoria':{'parpados':{lado:{'malla':'Rostro','superior':[mapa_export[a]],'inferior':[mapa_export[b]]}for lado,a,b in [('I',2234,2277),('D',1,44)]}}}
    (AQUI/'datos.js').write_text('/* Rostro de Adreida: Scenario + topología y unidades faciales CC0 MPFB. */\nwindow.CAOZ_ADREIDA_ROSTRO_DATOS='+json.dumps(datos,separators=(',',':'))+';\n')
    fuentes=[o for o in bpy.data.objects if o.get('fuente_adreida')]
    for o in fuentes:bpy.data.objects.remove(o,do_unlink=True)
    # Pivotes anatómicos también en el archivo editable, no sólo en el juego.
    for ob in objs:
        if ob.get('tipo_rostro')=='ojos':
            x,y,z=ob['centro'];pivote=Vector((x,-z,y))
            for vert in ob.data.vertices:vert.co-=pivote
            ob.location=pivote
    dent=bpy.data.objects.get('Dientes inferiores');rostro=bpy.data.objects['Rostro']
    if dent and dent.data.shape_keys:
        drv=dent.data.shape_keys.key_blocks['jawOpen'].driver_add('value').driver;drv.type='SCRIPTED';var=drv.variables.new();var.name='apertura';var.type='SINGLE_PROP';var.targets[0].id_type='KEY';var.targets[0].id=rostro.data.shape_keys;var.targets[0].data_path='key_blocks["jawOpen"].value';drv.expression='apertura'
    cam=bpy.context.scene.camera;cam.location=(0,-1.3,1.724);cam.rotation_euler=(Vector((0,0,1.724))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.45
    for pantalla in bpy.data.screens:
        for area in pantalla.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.clip_start=.001;vista=area.spaces.active.region_3d;vista.view_location=(0,0,1.724);vista.view_distance=.62;vista.view_rotation=cam.rotation_euler.to_quaternion();vista.view_perspective='ORTHO'
            elif area.type=='PROPERTIES':area.spaces.active.context='DATA'
    bpy.ops.object.select_all(action='DESELECT');rostro.select_set(True);bpy.context.view_layer.objects.active=rostro
    bpy.ops.wm.save_as_mainfile(filepath=str(SALIDA/'Adreida-rostro-editable.blend'))
    for ob in objs:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(SALIDA/'Adreida-rostro.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True)
    stats={'mallas':len(mallas),'canales':len(canales),'triangulos':sum(len(base64.b64decode(d['triangulos']))//6 for d in mallas),'bytesDatos':(AQUI/'datos.js').stat().st_size}
    (AQUI/'auditoria.json').write_text(json.dumps(stats,indent=2));print('RESULT',json.dumps(stats))

if FASE=='ajustar':ajustar()
elif FASE=='hornear':hornear()
elif FASE=='exportar':exportar()

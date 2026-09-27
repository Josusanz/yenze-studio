"""Optimize Tabbuso's CC BY 4.0 shirt without changing the source download.
Run: blender --background --factory-startup --python scripts/prepare-shirt.py -- SOURCE OUTPUT
"""
import bpy, sys, json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,output=args
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
    world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
points=[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
print('WORLD_BOUNDS',list(lo),list(hi),'size',list(hi-lo),flush=True)
# Blender Z is vertical, exported as glTF +Y. Normalize to a 70 cm display garment.
size=hi-lo
if not(size.z>size.y*1.5):raise RuntimeError('Unexpected garment orientation; inspect before export')
center=(hi+lo)/2;scale=.70/size.z
for o in meshes:
    for v in o.data.vertices:v.co=(v.co-center)*scale
    bpy.context.view_layer.objects.active=o
    before=len(o.data.polygons)
    if before>12000:
        mod=o.modifiers.new('Web optimization','DECIMATE');mod.ratio=.23;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    o.name='shirt_'+str(meshes.index(o));o.data.name=o.name
mat=meshes[0].data.materials[0];mat.name='Cotton'
mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value=(.88,.865,.835,1)
bsdf.inputs['Metallic'].default_value=0
bsdf.inputs['Roughness'].default_value=.86
for o in list(bpy.context.scene.objects):
    if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
for o in meshes:
    o['author']='Tabbuso';o['license']='CC-BY-4.0';o['source']='https://sketchfab.com/3d-models/tshirt-5a21282b2e454d1696547148f617d3d0'
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,export_extras=True,export_copyright='Tshirt by Tabbuso, CC BY 4.0. Yenze: scale normalization, mesh reduction, cloth material.')
print(json.dumps({'output':output,'triangles':sum(len(o.data.polygons) for o in meshes),'scale':scale}),flush=True)

"""Run through installed Blender, leaving Unity source files unchanged."""
import bpy, json, re, sys
from pathlib import Path
manifest = json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())
out = Path(manifest['output']); textures = manifest['textures']; prepared = Path(manifest['prepared'])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
report = {'sourceVersion': manifest['sourceVersion'], 'missingSceneReferences': manifest['missingSceneReferences'], 'textureResizes':manifest['textureResizes'], 'models': [], 'materials': []}
images = {}
def image(file, color=False):
    key = (file,color)
    if key not in images:
        im = bpy.data.images.load(file, check_existing=False)
        im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'; images[key] = im
    return images[key]
def material(old):
    name = re.sub(r'\.\d{3}$','',old.name)
    slots = manifest['materials'].get(name,{})
    stem = name.removeprefix('M_')
    base = slots.get('_BaseMap') or slots.get('_MainTex') or textures.get('T_'+stem+'_BaseColor.png')
    normal = slots.get('_BumpMap') or slots.get('_NormalMap') or textures.get('T_'+stem+'_Normal.png')
    orm = slots.get('_MaskMap') or textures.get('T_'+stem+'_OcclusionRoughnessMetallic.png')
    mr = prepared / ('T_'+stem+'_MetallicRoughness.png')
    if not mr.exists(): mr = None
    ao = slots.get('_OcclusionMap') or textures.get('T_'+stem+'_Occlusion.png')
    # Factory source materials also use generic wood/brick/paint families.
    if stem in ['Brick','Wood','WoodGrain']:
        family = 'WoodGrain' if stem in ['Wood','WoodGrain'] else 'Brick'
        base = base or textures.get('T_'+family+'_BaseColor.png')
        normal = normal or textures.get('T_'+family+'_Normal.png')
        orm = orm or textures.get('T_'+family+'_OcclusionRoughnessMetallic.png')
    cloth = re.search(r'(?:Pile|Piles|Cloth)[_ ]*(\d)', name, re.I)
    if cloth:
        prefix = 'Folded_Cloth_Piles_'+cloth[1]
        base = textures.get(prefix+'_BaseColor.png'); normal = textures.get(prefix+'_Normal.png')
    if name == 'Folded_Cloth_Piles':
        base = textures.get('Folded_Cloth_Piles_4_BaseColor.png')
        normal = textures.get('Folded_Cloth_Piles_1_Normal.png')
    mat = bpy.data.materials.new(name+'_Runtime'); mat.use_nodes=True
    nodes = mat.node_tree.nodes; links = mat.node_tree.links; p = nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*old.diffuse_color[:3],1)
    p.inputs['Roughness'].default_value = .8
    def tex(file, color=False):
        n = nodes.new('ShaderNodeTexImage'); n.image = image(str(file),color); return n
    if base: links.new(tex(base,True).outputs['Color'],p.inputs['Base Color'])
    if normal:
        n = nodes.new('ShaderNodeNormalMap'); links.new(tex(normal).outputs['Color'],n.inputs['Color']); links.new(n.outputs['Normal'],p.inputs['Normal'])
    packed = str(mr) if mr else orm
    if packed:
        t=tex(packed); separate=nodes.new('ShaderNodeSeparateColor'); links.new(t.outputs['Color'],separate.inputs['Color'])
        links.new(separate.outputs['Green'],p.inputs['Roughness']); links.new(separate.outputs['Blue'],p.inputs['Metallic'])
    if ao or orm:
        group = bpy.data.node_groups.get('glTF Material Output')
        if not group:
            group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree'); group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
        settings=nodes.new('ShaderNodeGroup'); settings.node_tree=group
        links.new(tex(ao or orm).outputs['Color'],settings.inputs['Occlusion'])
    report['materials'].append({'name':name,'baseColor':base,'normal':normal,'metallicRoughness':packed,'occlusion':ao or orm,'fallback':not bool(base)})
    return mat
cache = {}
for file in manifest['models']:
    before=set(bpy.context.scene.objects); bpy.ops.import_scene.fbx(filepath=file)
    objects=set(bpy.context.scene.objects)-before
    parent=bpy.data.objects.new('asset_'+Path(file).stem,None); bpy.context.collection.objects.link(parent)
    for obj in objects:
        if not obj.parent: obj.parent=parent
        if obj.type=='MESH':
            for i,old in enumerate(obj.data.materials):
                if old not in cache: cache[old]=material(old)
                obj.data.materials[i]=cache[old]
    report['models'].append({'name':parent.name,'source':str(Path(file).relative_to(Path.cwd())),'meshes':sum(o.type=='MESH' for o in objects)})
bpy.ops.export_scene.gltf(filepath=str(out/'factory.glb'),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
(out/'import-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('FACTORY_CATALOG',json.dumps(report['models']))

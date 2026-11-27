"""Audit the supplied Unity project and prepare a separate browser FBX/PBR catalog."""
from pathlib import Path
from PIL import Image
import hashlib, json, os, re, shutil, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/models/scene1/Assets'
OUT = ROOT / 'public/models/factory'
OUT.mkdir(parents=True, exist_ok=True)
maps = OUT / 'prepared-textures'
maps.mkdir(exist_ok=True)
metadata = {}
reuse = '--reuse-audit' in sys.argv
cached = json.loads((OUT/'conversion-manifest.json').read_text()) if reuse else None
for p in ([] if reuse else ASSETS.rglob('*.meta')):
    m = re.search(r'^guid: (\w+)', p.read_text(errors='ignore'), re.M)
    if m: metadata[m[1]] = p.with_suffix('')
scene = (ASSETS / 'Scenes/SampleScene.unity').read_text()
missing_refs = cached['missingSceneReferences'] if reuse else []
for guid in ([] if reuse else sorted(set(re.findall(r'guid: ([0-9a-f]{32})', scene)))):
    if guid.startswith('0000000000000000'): continue
    p = metadata.get(guid)
    if not p or not p.exists(): missing_refs.append({'guid': guid, 'path': str(p.relative_to(ROOT)) if p else None})
models = ['SM_Desk_Metal', 'SM_Chair_Metal', 'SM_Workbench', 'SM_Wall_Brick_1m',
          'SM_Wall_Plaster_2m', 'SM_Floor_Wood_4m', 'SM_Floor_Concrete_Broken_4m',
          'SM_Column_Concrete_5m', 'SM_Beam_IBeam_4m', 'SM_Pipe_Run_4m_Small',
          'SM_Door_Metal_Single', 'SM_Window_Steel_C', 'SM_Clock_Wall',
          'SM_Lamp_Fluorescent', 'SM_Fuse_Box', 'SM_Shelf_Rack_B',
          'SM_Crate_Wood_Small', 'SM_Hand_Truck', 'SM_Bucket_Metal', 'SM_Duct_4m']
mesh_dir = ASSETS / 'Dzendor/StylizedFactory/Meshes'
files = [mesh_dir / (n + '.fbx') for n in models]
files += [ASSETS / ('Folded_Cloth_Piles_' + size + '_FBX.fbx') for size in ['Short', 'Tall']]
textures = {p.name: p for p in ASSETS.rglob('*.png')}
material_data = cached['materials'] if reuse else {}
for p in ([] if reuse else (mesh_dir.parent / 'Materials').glob('*.mat')):
    data = p.read_text()
    slots = {}
    for slot, guid in re.findall(r'- (_\w+):\n\s+m_Texture: \{fileID: \d+, guid: (\w+)', data):
        q = metadata.get(guid)
        if q and q.exists(): slots[slot] = str(q)
    material_data[p.stem] = slots
fingerprint = hashlib.sha256()
for p in ([] if reuse else files):
    if p.exists(): fingerprint.update(p.read_bytes())
for p in ([] if reuse else sorted(textures.values())):
    fingerprint.update(p.name.encode()); fingerprint.update(p.read_bytes())
manifest = {'models': [str(p) for p in files if p.exists()], 'textures': {k: str(v) for k,v in textures.items()},
            'materials': material_data, 'output': str(OUT), 'prepared': str(maps),
            'missingSceneReferences': missing_refs, 'sourceVersion': fingerprint.hexdigest()[:16]}
if reuse: manifest['sourceVersion'] = cached.get('sourceFingerprint',cached['sourceVersion'])
manifest['sourceFingerprint'] = manifest['sourceVersion']
manifest['sourceVersion'] = hashlib.sha256((manifest['sourceVersion']+'factory-pbr-vertex-colors-cloth-2k-v2').encode()).hexdigest()[:16]
# These cloth maps cover small tabletop props; 2K keeps their detail while avoiding
# several unnecessary 4K allocations in the shared WebXR environment.
manifest['textureResizes'] = []
for name in ['Folded_Cloth_Piles_4_BaseColor.png','Folded_Cloth_Piles_1_Normal.png']:
    if name in textures:
        im = Image.open(textures[name]); im.thumbnail((2048,2048), Image.Resampling.LANCZOS)
        target = maps / name; im.save(target)
        manifest['textures'][name] = str(target)
        manifest['textureResizes'].append({'name':name,'size':im.size})
# Unity metallic/smoothness is R/alpha; glTF is roughness/metallic in G/B.
for name,p in textures.items():
    if name.endswith('_MetallicSmoothness.png'):
        target = maps / name.replace('_MetallicSmoothness', '_MetallicRoughness')
        if reuse and target.exists(): continue
        im = Image.open(p).convert('RGBA'); r,g,b,a = im.split()
        rough = a.point(lambda value: 255-value)
        Image.merge('RGB', (Image.new('L',im.size,255),rough,r)).save(target)
manifest_file = OUT / 'conversion-manifest.json'
manifest_file.write_text(json.dumps(manifest, indent=2)+'\n')
blender = os.environ.get('BLENDER_BIN') or shutil.which('blender') or '/Applications/Blender.app/Contents/MacOS/Blender'
subprocess.run([blender, '--background', '--factory-startup', '--python', str(ROOT/'tools/export-factory.py'), '--', str(manifest_file)], check=True)

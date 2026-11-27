# Scene 1 material and wage-table correction

The wage-table pile is corrected. Exact restoration of all factory textures remains
incomplete because several original texture/material files were not supplied.
Unity sources were inspected but not rewritten, and no invented albedo or arbitrary
replacement colors were applied to conceal these gaps.

## Changes

Recovered `_Tint` from the actual Unity materials for dark steel, teal paint,
yellow paint and galvanized metal. The previous FBX-to-glTF export discarded these
shader properties and optimization consequently merged distinct grey materials.
Recovery runs on the unoptimized catalog before deduplication, preserving separate
material assignments, normal maps, UVs and authored numeric color values. The
factory GLB was re-optimized with Draco and embedded textures; other GLBs were not
regenerated. This restores material variation, not the unavailable paint albedo,
chip, grime or custom Unity shader effects.

Removed the eight old box-shaped wage fabrics. The replacement uses the shared
imported connected folded-cloth mesh with eight existing source texture variants.
It is 0.32 by 0.22 m and 0.20 m tall, at the left rear corner from the child's aisle
approach. Every vertex remains inside the tabletop with an edge margin. The bottom
is 2 mm above a raycast-confirmed support surface; adjacent layers touch. Ledger,
cash tin, receipt spike, wage-giver, table anchor, player and interaction target
stay in place. Baked-in source desk accessories above the working surface were
omitted to prevent intersections with the pile and existing gameplay desk props.

The scene-wide fabric review also found a low-poly sphere used as the walking
worker's cloth bundle. It now uses three shared imported folded pieces within
the previous bundle envelope; its parent, carrying pose, route and animation remain.

## Source/material audit

`factory-material-audit.json` records each original material, retained maps,
source material availability, GUID-resolved texture paths and missing files.
The browser suite additionally inspects every visible factory mesh material,
checks decoded map dimensions and UV presence, and writes a runtime inventory
for each edition in the temporary `tlwh-tests/` directory.

The corner rack, including its baked-in boxes/cans, uses one authored atlas.
`M_Shelf_Rack_B.mat` and `T_Shelf_Rack_B_BaseColor.png` are absent; only their
metadata files remain. Its normal and metallic/smoothness maps exist and remain
assigned, but cannot reconstruct the lost base colors. The available
`T_Shelf_Rack_BaseColor.png` belongs to the other rack variant: comparison of both
normal atlases shows different UV island arrangements. Assigning it directly to
Rack B would create incorrect mapping and was deliberately avoided. The rack's
white/grey appearance remains an unresolved source dependency.

Other missing source dependencies affecting visible surfaces include:

- `M_Desk_Metal.mat`, `T_Desk_Metal_BaseColor.png` and its metallic/smoothness map.
  The available normal and occlusion maps remain assigned to the wage desk.
- `M_Plaster.mat`, `M_Wood_Dark.mat`, the concrete base/normal maps, and
  `T_PaintedMetal_BaseColor.png`. Some missing texture GUIDs have no filename in
  the upload. The concrete ORM and available wood/painted-metal maps are retained.
- Rust chip ORM, grunge and custom factory-shader inputs are incomplete. The
  shader graph references missing custom HLSL; exact shader wear cannot be claimed.

The catalog also has missing window/dirty-glass and bucket materials/maps, even
though those source models are not newly added by this correction. See the JSON
for all material entries, including unused catalog entries.

Pale receipt paper, the ledger pages, fluorescent light surfaces and light cloth
texture variants are intentional. Their authored/rendered surfaces are distinct
from the rack and desk's missing albedo. A white Unity tint alone does not prove
an object was intended to be white when its base map is absent.

## Verification

Factory runtime checks cover both editions, decoded textures, source UVs, material
separation/tints, whole-pile containment/support/clearance, shader compilation,
pick/feed/fold/reset, bag/wages/door callbacks, navigation routes, player height
and loaded audio buffers. Camera views cover sewing, cloth, the aisle, wage desk,
corner storage, rolls, overhead structure and the exit. Tracked sewing is checked
in the focused IWER Quest suite; this is emulation, not physical headset testing.

Run `node tools/recover-factory-materials.mjs`, then
`node tools/optimize-models.mjs --only=public/models/scene1/factory.glb` to reproduce
material recovery. Recovery archives its input under the ignored
`_raw_assets/prior/factory-material-recovery/` before updating the working source
catalog. Original Unity files are never changed. The optimizer's `--only` option
retains the reports and version hashes for the other models.

Run `node tools/test.mjs factory physical`, `npm run test:models`,
`npm run audit:models`, and `npm run build`. Runtime logs for this correction are
in `/tmp/tlwh-factory-corrections.log` and `/tmp/tlwh-factory-final-visual.log`.
Both editions passed the final factory suite, including the worker bundle check.
The focused emulated Quest sewing/begging suite passed with no runtime errors.
Build, all six model validations, model audit, text audit and whitespace checks
passed. Source-geometry ray checks also confirmed support under all four corners
of the wage pile. Rendered views were inspected, including the remaining white
rack; passing tests do not mean its missing albedo has been restored.
Hardware comfort and device-specific
rendering still require an actual Quest.

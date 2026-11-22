# Runtime model assets

The browser loads six self-contained GLBs: factory, market, chase, Home, the Home
door/frame catalog, and the food plate. `tools/model-assets.mjs` lists these entry
points; `src/world/gltf-assets.js` supplies the local Draco decoder and versions
requests using generated content hashes. Home and market no longer fetch external
geometry or texture files. The normal application build needs only `src/`, `public/`
and installed dependencies; it does not read `_raw_assets/`.

The initial inventory contained 23,903 files / 3,754.4 MiB under `public/models/`.
After packaging and cleanup, the folder contains 14 files / approximately 58.4 MiB.
Active scene transfer size falls from 428.9 MiB to approximately 58.3 MiB (86.4%).
The original scene contents, including the unused `scene2/Scene2_Plaza.glb`, original
`scene3/Scene 3.glb`, Unity projects/caches, standalone Home donor models, source
`.gltf` files and recovered Brick Wall OBJ/MTL, remain in `_raw_assets/public/models/`.
Nothing was permanently discarded. Identical duplicate files were removed from
`public` only after their archive copy was verified by SHA-256.

The runtime models are approximately 2.7 MiB factory, 38.2 MiB market, 8.9 MiB chase,
7.6 MiB Home, 0.2 MiB door catalog and 0.6 MiB plate. Exact sizes, triangle counts,
texture budgets and geometry comparisons are in `model-optimization.json`.
`model-assets-audit-before.json` records the initial directory sizes and every file
over 5 MiB; `model-assets-audit-before-cleanup.json` lists all 3,957 non-runtime
model/texture candidates before archival. `model-assets-cleanup.json` records the
archive operation. `npm run audit:models` writes a separate current inventory.

## Optimization and verification

- `npm run optimize:models` rebuilds from the archived originals, not from previously
  compressed GLBs. It saves an original and all external dependencies before writing
  an active file. Every replacement is decoded and compared before atomic rename.
- `npm run optimize:models -- --max-texture-size=2048` raises the architecture/sign
  limit when extra detail is needed; the default is 1024. Small props and data maps
  use 512. Shared materials use the largest physical use to choose their budget.
- `npm run test:models` compares the decoded files against compact tracked source
  fixtures in `dev/fixtures/models/`. Tests need no ignored source projects.
- `npm test` additionally runs the UI, factory, Home, market, chase and atmosphere
  browser checks. `npm run test:vr` uses an emulated headset.
- `npm run audit:models -- --archive` audits and moves any newly unreferenced files
  into the ignored archive. Inspect its report when introducing new asset paths.

Deduplication/pruning removes redundant resources while retaining named nodes,
metadata, scene hierarchy and animation. Draco uses 16-bit position/UV quantization
and 12-bit normals. No geometry simplification, scene flattening or mesh joining is
performed, so interaction selectors and relative transforms remain intact. Rendered
primitive bounds and triangle counts are checked after decoding; maximum reported
local extent differences are 0.35 mm factory, 6.4 mm market/chase and 1.8 mm Home.

Color textures use WebP quality 90 with alpha retained. Data maps use high-quality
JPEG with full chroma resolution, retaining alpha-bearing textures in WebP. The
largest texture dimension defaults to 1024 for architecture/readable textures and
512 for small props and data maps. Estimated total decoded RGBA texture allocation
with mipmaps is about 869 MiB; this is a conservative catalog estimate, not a device
measurement. WebP/JPEG reduce downloads; resizing reduces decoded memory. They do
not provide GPU block compression. Physical standalone-headset performance still
needs an on-device check.

## Updating source environments

`node tools/audit-models.mjs --restore` copies absent archived source files back to
their original locations without replacing existing runtime models. Before running
`recover-home.mjs`, use `--restore --include-runtime-originals` instead: its byte-based
reader needs the original uncompressed donor GLBs. That option preserves the current
optimized copies under `_raw_assets/optimized-checkpoints/` and temporarily restores
uncompressed runtime donors. Existing `prepare-scene*.mjs`, `prepare-scene1.py` and
`recover-home.mjs` tools can then use their original source paths. After regenerating
a source runtime, refresh only its baseline, for example:

```sh
npm run optimize:models -- --refresh-source=public/models/factory/factory.glb
npm run optimize:models -- --refresh-source=public/models/market/market.gltf
npm run optimize:models -- --refresh-source=public/models/home/unity-home.gltf
```

Repeat `--refresh-source` for multiple inputs. Earlier backups are moved to
`_raw_assets/prior/` rather than overwritten. The script refuses to refresh an
in-place GLB baseline from the last optimized output. Then run tests and archive
sources again. The archive is local and gitignored; retain a separate backup when
moving to another computer. Git LFS and Git history rewriting were not configured.

## Scene 1 visual corrections

All 13 imported chairs now face their seated occupants' working direction. Fabric
keeps the supplied folded-cloth geometry and weave detail, with six color variants
sharing one neutralized base-color texture and the original normal map. Static
stock uses instance colors; picking/sewing/folding retains the selected color.
Only sewing progress uses a conventional accessible bar, including its VR
equivalent. The loading overlay and stamina retain their red thread indicators.

Verification completed: production build, `npm test` (all six model comparisons,
UI, factory, Home, market, chase and both-edition atmosphere checks), final factory
color/alignment checks in both editions, repeated emulated VR exit/re-entry and
desktop return, and focused Home XR rendering passed. No missing runtime resources,
shader compilation errors or XR framebuffer warnings were reported. Fabric, chair,
room, door and loading-bar screenshots were inspected. Physical-device performance
remains unmeasured. Re-stage optimized assets and archived-file removals before
committing; the pre-existing Git index was left intact.

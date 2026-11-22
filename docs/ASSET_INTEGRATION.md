# Scene asset integration

## Current implementation

The playable game is Three.js/WebXR. The supplied Unity-exported
`public/models/scene4/home space.gltf` is identical to the preserved
`public/models/home/home-space.gltf` and is the authoritative house layout for this
pass. Original Unity projects, scenes, GLBs, OBJ and `.meta` files were not edited.

The runtime now reconstructs the export's actual node hierarchy and raw mesh
geometry rather than fitting props into the old procedural room. Its 53 house
instances include the brick walls and ceiling panels, 20 tiled floor sections,
source furniture/storage, two bedding sets, two fans, window/blinds/glass, lamps,
water pots, cookware, clock and the edited entrance door. Offstage catalog doors,
cameras, post-processing volumes and the stencil helper quad are excluded. The
existing WebXR light pool continues to own lighting.

`tools/recover-home.mjs` generates `public/models/home/unity-home.gltf` and its
manifest. It references the embedded buffers/images of 20 existing GLBs, avoiding
copies of the original textures or the need for the missing `home space.bin` and
78 external PNGs. Source mesh geometry is matched within each asset by mesh name;
the live geometry bounds are compared with the original export in the Home test.
Regenerate with `node tools/recover-home.mjs` after updating source references.

## Scale, alignment and exterior

`src/config/home-layout.js` defines one uniform scale of 1.4 and a 180-degree Y
rotation. The source's right-hand entrance lands at approximately (82, 0, 12.7),
connecting it to the existing chase lane. House wall-center dimensions are
approximately 7.97 × 7.92 m, with a 2.67 m roof height. Native source proportions
and authored instance scales are preserved; props are no longer independently
squashed to the old room footprint.

Source transform corrections are limited to grounding and keeping protruding prop
packs inside the wall surfaces. Sixteen adjustments are reported in
`window.__homeGltf.corrections`: the largest horizontal correction is approximately
0.86 m for the plastic chair/bin pack, which originally protruded through the
source wall. The broom needed approximately 0.26 m of upward correction. The cup
rests on the imported stool. These are alignment fixes rather than unreported
changes to asset scale. A continuous backing below the source tiles fills the
small gap at the floor perimeter without overlaying a second visible floor.

The mother sits beside and faces the imported stove, turning toward the table
when food is shared. The brother and player's sleep target follow the two source
bedding sets. The player's desktop lying direction follows the source bedding
orientation. Family characters retain their working procedural poses because no
verified equivalent sitting/lying child animation was supplied.

The old procedural room, stretched brick overlays, tin roof, shelf, trunk,
clothesline and plywood facade/door are removed. The imported table and real
bedding own the interaction locations. Invisible raycast proxies are explicitly
marked as such; they do not render alongside the imported models. The notebook
remains an intentional story prop.

One source Door 007 assembly is shared by the chase exterior and Home interior.
Knocking, opening and closed-door collisions use its source-aligned opening;
there is no separate visible chase door. Wall geometry is the same on both sides.
Neighboring city blocks are set back to clear the larger house and its original
roof overhang. The source tile apron outside the house is retained.

## Brick Wall material and missing dependencies

The newer Unity `Home Space/Assets/Scenes/2.unity` references an unresolved
`Brick Wall` prefab GUID `b1db46c777efba241a0bb224d2fc38b0`. The loose
`Assets/Building and props/Brick Wall.obj` refers to a missing `Brick Wall.mtl`.
The original GUID cannot be restored reliably without the original `.meta` file.

The intended four `M_Bricks_Var_*` material names and base colors are present in the
supplied glTF. The OBJ geometry corresponds to the supplied brick wall/STL shape
in different axes/units. The recovery script restores those material groups into
`public/models/home/recovered/brick-wall.glb`, using the reference wall transform.
It also writes a separate `recovered/Brick Wall.mtl` and unmodified OBJ copy for
inspection. The recovered MTL derives its colors from the glTF; no absent bitmap
textures were invented. This recovers the runtime visual material, not the lost
original Unity GUID or original MTL file bytes.

The recovered front wall has geometric doorway and window openings matched to
the source door/window bounds. This corrects the reference's solid wall occupying
the opening locations, allowing the door to open and preserving window visibility
from both sides. Source files remain untouched. Unity light attachments are
omitted from the generated file so they cannot conflict with the WebXR light pool.
URP shader components are not imported into the browser; the supplied GLB PBR
materials/maps are used instead.

The imported `Dirty_glass` material originally used transmission 0.85. Its
refraction pass produced a zero-width stereo render target with this renderer. The
runtime now retains its authored alpha, color/roughness/normal maps and PBR shading
while disabling screen-space transmission and depth writes. This alpha-blended
glass adaptation is recorded in `referenceData.materialCompatibility` and leaves
the source material definition unchanged. No engine/XR architecture was replaced.

## Gameplay and validation

The story beats, bag/hands, player/XR controller, captions and audio systems remain
in place. Changed scene coordinates now follow table/bedding anchors, and source
mesh bounds drive furniture collision boxes. Walls and the door have simple AABBs;
room-scale physics or Unity mesh colliders are not introduced. The standing eye
height remains 1.52 m and the Extra wake-up height remains 0.82 m. The wake-up spawn
was moved to the clear doorway center to avoid the source cookware near the old
spawn. Arrival waits for Home's imported assets to be ready.

Checks:

- `npm run build`: production bundle.
- `npm run test:home`: source-instance geometry/proportions; uniform scale; decoded
  material maps and shaders; clear arrival; routes to food/sleep; closed/reset door
  collision; outside ray access to the shared door; open-door wall clearance;
  food/sleep/notebook callbacks; decoded audio buffers and original audio loops.
- `node tools/test.mjs home-vr`: early XR entry, imported Home rendering and exit,
  with explicit framebuffer-warning checks for the glass compatibility fix.
- `node tools/test.mjs ui atmosphere vr`: UI and brother alignment, every scene in
  both editions, emulated VR story progression, child heights, controller use,
  ending/exit, repeated VR re-entry, and desktop controls after VR.
- `git diff --check` and JavaScript syntax checks.

Screenshots of the interior, furniture, exterior, window and roof are stored in
the system temporary `tlwh-tests` directory. Automated checks and screenshots do
not replace Unity Editor or physical-headset testing. VR walkthroughs use the
existing phase-skip hook for later story beats; they are not a manual controller
ray test at every story interaction.

The house's 20 shared asset buffers total about 119 MiB before the separate thali.
Textures/geometry were preserved for fidelity. Actual headset frame rate, memory,
comfort and final lighting still require a device pass. Original Unity source
folders are inside `public`; deployment packaging should exclude raw projects and
caches while retaining an archival copy. This work was not deployed.

## Remaining environments

Scenes 2 and 3 are now integrated as described below. Replacement assets for
Scene 1 are not yet supplied. Drop each source project into `public/models/scene1/`, `scene2/` or `scene3/`, keeping `.meta` files,
materials and textures together. Include the intended Unity scene plus either a
self-contained GLB or a complete glTF/binary/texture export.

For each environment, follow the same sequence:

1. Inventory the authored scene hierarchy, mesh units/pivots, dependencies and
   gameplay objects before editing. Preserve the original files and take a local
   checkpoint; this pass's checkpoint is in `backups/home-before-reference-layout/`.
2. Select one scene-to-world transform using its entrance/exit and consistent VR
   scale. Preserve source relative transforms and proportions; document grounding
   and intersection corrections separately.
3. Replace the placeholder visual hierarchy, including external surfaces. Retain
   interaction ownership and story state, then move targets/audio/collision bounds
   to the imported anchors. Do not leave duplicate visible placeholder geometry.
4. Compare geometry bounds/material maps to the source, inspect inside/outside
   views, test routes/trigger reachability, then run the existing story/WebXR tests
   before starting the next environment.

The factory needs sewing-machine/workstation/exit mappings before replacing its
environment. Market and chase adapters are implemented below.

## Verified results

Production build, syntax/whitespace checks and deterministic recovery passed.
The final Home reference checks passed in Normal and Extra editions, including
all 53 instances, 366 decoded texture bindings, original child heights, source
bounds/proportions with documented corrections, walking routes, food/sleep/notebook
callbacks, real audio buffers, and closed/open door ray clearance. Interior,
furniture, window, roof, exterior and focused VR screenshots were inspected.

The UI and all-scene atmosphere suites passed. An initial full VR run completed
the story but reported stereo framebuffer warnings from the imported refractive
glass. After the material adaptation, the focused XR test passed with zero such
warnings, and a fresh full `npm run test:vr` passed both editions plus repeated
entry/exit and the desktop-return checks with no console errors or warnings.

Unity Editor and physical-headset testing were not performed. The original Unity
prefab GUID remains unresolved in the preserved source; the browser wall geometry
and recovered material groups are supplied and verified independently.


## Follow-up: Home door and exterior intersections

The wall opening previously included the protruding handle when measuring door
width. It now follows the actual leaf edge and height, eliminating that extra gap.
The matching Wooden Doorframe 003 from the supplied door pack is fitted using the
source Door 007 transform and shares the door material. It stays fixed while the
existing shared door hinge opens. The source wall cut and collision opening agree.
Neighboring tin shack widths are capped before the Home wall; they no longer extend
through the interior. Both-edition Home tests assert that the frame encloses the
leaf and test visible chase triangles against the room interior, in addition to
the existing door, floor, height, route, material and interaction checks.
The checkpoint before this pass is `backups/before-scene2/`.

## Scene 2: supplied market

The reference is `public/models/scene2/Scene2_Plaza.glb`, together with
`Scene 2/Assets/Scenes/Scene2_Day.unity`, `Scene2_Dusk.unity`, their prefabs,
source model GLBs and the loose Realistic Assets glTF directories. The complete
plaza contains 145 meshes and 339 nodes. Its buffers and images are embedded.
Loose glTF binary/texture dependencies resolve. Prefab references in both Unity
scenes resolve to supplied metadata. Thirty-five source Unity mesh `.asset` files
have a non-hexadecimal trailing `y` in `m_IndexBuffer`; these source files were
left untouched. The browser uses the valid GLB geometry instead. Unity Editor
repair and validation of those YAML meshes remains a separate task.

`tools/prepare-scene2.mjs` generates `public/models/market/market.gltf`, its geometry
buffer, deduplicated textures and `import-report.json`. The master plaza incorrectly
uses normal or packed metallic/roughness images as base color for several props.
The runtime copy restores 73 material texture bindings from the original model
GLBs, including table, stove and cookware maps, while retaining the plaza's scalar
material factors. All original source files remain unchanged. Architectural,
sign and cloth materials retain their authored assignments. The resulting 285
unique texture images preserve source quality; the runtime directory occupies
approximately 171 MiB on disk. No Unity shader code is executed in the browser.
The GLB PBR maps use the existing Three.js renderer.

`src/world/street-reference.js` rotates the plaza 180 degrees and translates it to
(31, 0, 3.8). Its architecture is uniformly scaled by 1.2 around the plaza center to
meet the existing market boundary while props retain their authored metre scale.
This keeps food, scrap, tailor, begging and chase targets close to their established
positions. Four native building variants also replace the four lane building lots;
their width/depth fit each existing lot and their façade height follows width.
The ground is lowered 8 mm to avoid overlapping the connecting lane floor.
The alley rear boundary and neighboring chase facades are adjusted to meet the
native buildings without covering them. The main lane walking corridor is unchanged.

The native stalls, counters, cookware, fruit cart/crates, cloth, sacks, boxes, signs,
plaza buildings and ground replace the market placeholder hierarchy. Original
market visuals and lane houses are hidden after the import succeeds. The old
interaction owners are retained as invisible proxies or groups; they do not show
a second table, stall, cloth heap or carton. The native parcel is attached to the
existing theft/reset logic. Only the source cloth triangles at the scrap target
are attached to its original interaction, leaving the remaining scattered litter
in its authored positions. The carton is aligned to the existing begging anchor.
Original animated characters, coin animation, audio, story state, player controls,
transition code and lane details without a corresponding source asset are retained.

Collisions come from the native building and solid counter/cart bounds rather than
canopy extents. Existing lane collisions remain in place. Automated route searches
use the production player radius and collision map to confirm paths from the
factory exit to all five story locations and the chase exit. Standing player height
remains 1.52 m. `npm run test:street` checks both editions, decoded texture maps,
shader compilation, all five original interaction callbacks, parcel removal/reset,
source cloth attachment, hidden placeholders, native lane houses and decoded audio.
Screenshots cover the lane, entrance, food stall, tailor and overview. Visual review
confirmed the corrected wood/metal materials and source building/stall placement.

Unity Editor and physical-headset performance testing have not been performed.
The large source textures need a real-device memory/frame-rate check before release.
Raw Unity projects should be excluded from deployment packaging while preserved
separately. No deployment was performed.


## Latest validation: November 21, 2026

After the door/frame and clipping fixes and Scene 2 material recovery:

- `node tools/test.mjs street home` passed in Normal and Extra editions: 145 market
  meshes, 1,019 market texture bindings, four native lane houses, all five original
  market callbacks, reachable routes, parcel reset, Home source bounds/proportions,
  frame fit, no chase triangles inside the Home interior, 366 Home texture bindings,
  original child heights, door clearance, food/sleep/notebook callbacks and audio.
- `node tools/test.mjs ui atmosphere vr` passed: responsive captions/UI, brother
  alignment, every scene in both editions, full emulated VR story progression in
  both editions, repeated VR entry/exit and desktop controls after VR. No console
  errors or warnings were reported by either full VR run or the re-entry test.
- Production build, changed JavaScript syntax checks and `git diff --check` passed.

The later-story VR phase-skip limitation described above still applies; focused
asset tests separately exercise the market and Home callbacks and collision maps.
Original Unity files remain unchanged. Physical-headset and Unity Editor checks
remain outstanding, including the malformed source Unity mesh buffers and runtime
texture-memory/performance review.


## Scene 2 reupload verification

The reuploaded `Scene2_Plaza.glb` has SHA-256
`48493f1c4f1fee790576e1ba4d6bf326f3601c7787d0a5ad1257dfc5ef7719dd`.
Regeneration initially produced byte-identical runtime geometry and scene JSON,
confirming that the earlier market import already used this actual Scene 2 export.
The reference layout, 145 meshes and 339-node hierarchy remain the same. The import
was regenerated from the reuploaded originals, retaining the 73 PBR material repairs.
Both Unity scenes still resolve all 96 prefab references. All 47 loose glTF exports
have their referenced binary/texture files. The same 35 malformed Unity index buffers
remain in the preserved source and are bypassed using the valid exported geometry.

The page had a fixed November 5 bundle version. Builds and development rebuilds now
set its app.js URL from the actual bundle hash. The market generator fingerprints
the plaza and original model GLBs; both its glTF and geometry-buffer requests carry
that version. Texture filenames already use content hashes. This prevents stale
cached bundle/model responses after scene updates without changing gameplay systems.
The generated version lives in `src/config/market-assets.js` and `import-report.json`.

The updated `npm run test:street` independently compares every source accessor's
geometry bytes, mesh definitions and node placements against the runtime export,
and checks every runtime texture dependency before running the browser tests.
Both editions passed the refreshed source/material/shader, five interaction callback,
walking route, collision, native lane replacement and theft/reset checks. The build
and whitespace checks passed. Full VR tests passed immediately before this reupload;
they were not repeated for the identical environment and cache-version changes.
The user's localhost game address was confirmed as `http://127.0.0.1:8080/` and the
tab was hard-refreshed. Use the current `public/index.html`, not historical
`public/play.html` or `site-public/`, to load the supported build.


## Scene 2 prop alignment and cohesive dressing

`src/world/market-dressing.js` now fits the scene dressing to the actual expanded
architecture instead of retaining unsupported original export positions. Original
source files and generated source geometry remain unchanged.

- The selling mat is widened uniformly by 25%. Bananas, pomegranates and onions
  are enlarged uniformly by 60%; potatoes by 15%. All ten produce groups and the
  basket are placed entirely within the mat and rest on its surface.
- Perimeter storage follows the expanded building rows. Floor props rest on the
  actual raised pavement where present, otherwise on the street floor. Existing
  stacked crates and countertop props retain their elevated placement.
- Three electrical cabinets and the floor utility enclosure are aligned against
  real vertical building faces. Window glass and decals are excluded as supports.
- The broom is grounded and its existing lean is turned toward its supporting
  west wall. The tire is grounded beside the utility/storage area against the wall.
- Nineteen supplied cloth panels are separated from the source material batches,
  retaining their UVs/materials and dimensions. Their orientation follows new
  sagging ropes between actual wall surfaces. Supplied bunting is similarly reused
  on two supported cable spans. Original unsupported overhead batches are hidden.
- The approach lane's original floating cloth panels now hang on three connecting
  ropes whose endpoints meet the native lane buildings. Their existing gentle
  animation remains active. The obsolete lane wire batch is hidden.

Collision bounds are collected after dressing adjustments. Story owners, callbacks,
player dimensions, navigation, transitions, audio and gameplay architecture are
unchanged. The market regression suite checks full produce containment and mat
contact, fixture-wall contact, grounding on pavement, broom lean, supported rope
endpoints, hidden placeholder visuals, all five interactions, theft/reset and routes
in both editions. Screenshots add close views of produce, fixtures, broom and
hangings to the existing market/approach views. The checkpoint before this pass is
`backups/market-before-dressing/`.


Validation after the dressing pass: `node tools/test.mjs street` passed all placement,
material, gameplay and route checks in Normal and Extra editions, with no browser
runtime errors. Close-up produce, fixture, broom, overhead and approach-lane images
were reviewed. Production build, changed JavaScript syntax and whitespace checks
passed. Full VR was not rerun for this static dressing change; the earlier full VR
results remain recorded above.


## Scene 3: chase source integration

The supplied `public/models/scene3/Scene 3.glb` and matching `Scene 3.gltf` share
1,104 nodes, 87 mesh definitions, 60 materials and 86 images. No editable `.unity`
scene, prefab project or metadata is included. The GLB embeds its buffers and all
86 textures. The loose glTF's image URIs point beside the file, although all images
are actually in its `Assets/` subdirectory. The complete GLB is used directly, so
that path mismatch does not cause missing runtime textures. All 86 embedded image
payloads were hash-checked against the loose supplied textures and are identical.
Camera and directional
light objects are not attached to the game; the current WebXR lighting remains.
`tools/prepare-scene3.mjs` records the source hash and dependency inventory in
`public/models/chase/import-report.json` and generates `src/config/chase-assets.js`.

Seventeen nodes explicitly identify the same missing dirt-ground prefab GUID
`8bf31b7205ff840ac8b005c229876d27`. They have no geometry to recover. The existing
continuous chase floor meshes therefore remain, using the supplied floor material's
base color, normal and metallic/roughness maps. Their placement, intersections and
collapse behavior stay unchanged. A continuous apron using those same maps fills
the spaces beneath imported foundations; it follows the original floor collapse
and resets 6 mm below the playable floor. Some industrial catalog nodes, including
`BarrelWater`, have names but no geometry. The available `PropaneTank` geometry
replaces the small edge cylinders instead. Source files are left untouched.

The authored source spans a much larger street system than the five playable
corridors. `src/world/chase-reference.js` adapts its asset families to the existing
route instead of moving story events into that incompatible source footprint.
Fifty original building animation owners retain their positions, collision lots,
periodic lane dimensions, warp/reset and collapse behavior. Their procedural
surfaces/decorations are hidden. Actual slum houses, balcony towers, wooden
shanties, concrete apartments and enterable shanty meshes replace them as children.
The model footprint fits the original lot; façade height follows source width with
a minimum 2.8 m building height and the existing lot-height ceiling. This includes
local depth/height adjustments rather than a single scale for the entire source
scene. Catalog rotations/parts/materials are retained before the corridor-facing
rotation is applied. Repeating-lane variants repeat with the existing four-lot cycle.

The former static obstacle/shack batch is hidden. Source boxes and sacks occupy the
same twelve obstacle bounds; source tanks replace three edge cylinders. Alternating
source slum/container homes line the final corridor outside its walking boundary.
Ten source electric poles and five connecting sagging cables replace unsupported
procedural overhead wires. Existing animated laundry gains ropes and supporting
posts. Native concrete material backs the intentionally retained animated doors,
wall hands and watcher windows, keeping those story surfaces supported without
restoring the obsolete building boxes. Source unlit-poster materials are adapted to
PBR when cloned so they can follow night lighting. No Unity shader scripts execute
in the browser.

Existing pursuit, police/monster actors, bag, stamina, route checkpoints, catching,
Normal door/hand/sky/window/knock events, Extra loops/hiding/collapse, audio and
transitions remain in their original systems. Imported buildings follow the same
animation owners, and imported static dressing follows the original collapse/reset
batch owner. The shared Home door and source house are untouched. The checkpoint
before this pass is `backups/before-scene3/`.

`npm run test:chase` checks both editions: native architecture within original
collision footprints, source props grounded, hidden original surfaces, texture and
shader loading, all route checkpoints to the Home approach using the production
collision map/player radius, standing child height, knock interaction, collapse and
reset, and chase audio. Screenshots cover entry, hands lane, corner, loop/window
corridor and Home approach. Home's regression separately tests actual visible chase
triangles against the room interior and checks door/frame access.


Scene 3 final validation passed with `node tools/test.mjs chase home ui atmosphere vr`:

- Normal and Extra: 50 native building replacements, 33 additional props/poles/homes,
  1,432 texture bindings in the chase hierarchy, all route checkpoints, grounded
  source models, hidden legacy facades/static surfaces, knock callback, collapse,
  replay reset, child height, audio buffers and shader compilation.
- Home: source geometry/texture checks and no visible chase triangles intersecting
  the room interior, including exterior door/frame access and food/sleep callbacks.
- UI and all-scene rendering in both editions; complete emulated VR story runs in
  both editions; two VR re-entry/exit rounds and desktop controls afterward.
  The VR runs/re-entry checks reported no console errors or warnings.
- Production build, JavaScript syntax checks and whitespace checks passed. Entry,
  corner, hands, loop/window and final-lane screenshots were inspected after the
  foundation-ground gap repair.

The existing phase-skip limitations of the VR walkthroughs still apply. The focused
chase suite separately exercises knock and collapse/reset callbacks and checks the
production collision map. Unity Editor and physical-headset validation were not
performed. The approximately 79 MiB source GLB preserves its supplied textures;
headset memory/frame-rate review remains a device task. The original missing
prefab and empty barrel geometry cannot be restored from this export; the supplied
floor maps and available tank geometry provide the documented runtime substitutes.
No original source assets were modified and no deployment was performed.

# Food and fabric continuity

## Persistent narrative meal

The old market `FoodParcel`, the small bag parcel, and the separately spawned Home
meal have been replaced with one `CarriedFood` instance in `ctx.foodItem`.
`SHARED_ASSETS.food` points to the existing textured `models/scene4/thali.glb`.
The complete plate and food are fitted once to a 0.36 m horizontal span. Geometry,
embedded textures, materials, and scale are retained when the same object changes
parents. No model files or Unity source files are modified.

The state is `stock` -> `carried` -> `placed`. In the market it belongs to the
original theft target, resting on the imported counter's actual upper surface.
The existing theft animation calls `bagCtl.setContents({food:true})`; this now
hands ownership to the persistent item rather than showing the legacy bag mesh.
The original bag food geometry is cleared. The theft highlight is applied to the
shared food's materials and restored on placement/restart.

While carried, the plate is attached to the left tracked controller grip in XR.
Its world up axis stays vertical as the wrist turns. Tracking loss hides the item
until tracking returns. On desktop the camera-relative plate is visibly supported
by the left virtual hand. The existing right-hand bag, chase systems, light/hiding
state, audio and narrative callbacks remain available. Scene changes do not reset
food state; a full journey restart does.

Home creates an empty placement anchor on the imported table, not another meal.
In VR, bring the plate within 32 cm horizontally of that anchor, with its bottom
within the vertical placement band, then release a previously held left grip.
A table trigger confirmation also works while the tracked plate is in that zone.
Remote button presses/releases cannot place it. Physical VR placement does not run
the desktop automatic approach: the tracked player rig stays where the player
placed the meal. Placement reparents the same
instance to the table and clears its hand ownership. Desktop retains the existing
click, approach and serving animation, transferring the same instance at its
established handoff event. The eating fade hides the placed meal as before.

## Shared fabric library

`src/world/fabric-library.js` loads the existing cached factory and market GLBs.
A connected factory folded-cloth component is extracted with its original UVs and
normals. A connected imported market laundry panel supplies the hanging geometry,
including its authored folds and UVs. These shared meshes replace active cloth
placeholders in sewing, work piles, carried scraps, lane/chase laundry, factory
drying lines and the dream's drifting cloth. Home's already imported textured
bedding remains intact.

The factory exporter resolves its shared `Folded_Cloth_Piles` material to the
single available variant-4 brown albedo and variant-1 normal map. This explains
why separate cloth pieces inherited the same brown appearance.

The eight authored market `M_Fabric0` through `M_Fabric7` albedo/normal textures
supply distinct cloth variants. White material tint, disabled Unity vertex mask
colors, rough cloth surfaces and double-sided rendering avoid the previous brown
material override. Sewn pieces keep the selected material as they move from the
waiting pile through the machine to the finished pile. The animated decorative
folding surface owns a geometry copy so its deformation cannot change other
cloth instances. Factory stock is instanced
in eight material batches, sharing geometry and existing textures.

Six grounded, gently leaning cloth rolls now occupy the former factory bolt area,
inside its existing wall-storage collision boundary. No usable roll mesh exists
in the supplied library: these rolls use a wound UV-mapped cloth surface and a
cardboard core with the same imported fabric maps. Some alternate factory base-
color textures have only `.meta` references in the supplied source, so those exact
missing variants cannot be recovered. The original files are untouched; available
market fabric textures provide the color variations instead.

## Seller booth

The imported booth, counters, canopy and seller keep their existing positions.
The obstructing original cloth panels and their old mid-booth rod are hidden.
A side line terminates inside the booth's actual corner-post bounds. Three
imported hanging cloth panels occupy this side, leaving the seller and central
approach visible. Eight realistic folded pieces sit on the measured upper
surfaces of the two counters. No unsupported line is attached to an estimated
building boundary.

## Verification

- `npm run test:continuity`: both editions, actual theft/serving callbacks, scene
  changes and chase movement, object/geometry/material identity, fixed scale,
  empty Home anchor, no bag/table duplicates, restored rolls, cloth variants and
  booth post support checks.
- `node tools/test.mjs continuity-vr`: IWER Meta Quest session, tracked left-hand
  attachment, level plate under wrist roll, chase/Home persistence, rejected
  remote table inputs, grip-release placement and one table instance.
- Existing factory, street, Home, chase and physical-interaction suites verify
  navigation, source alignment, shaders/textures, sewing, audio and callbacks.

Actual headset testing remains necessary for subjective hand offset, reach comfort,
plate size and fabric appearance under the device's display and lighting.

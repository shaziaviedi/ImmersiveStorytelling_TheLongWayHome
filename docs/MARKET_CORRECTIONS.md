# Scene 2 placement, materials and pedestrian corrections

The existing plaza, story anchors, five interaction owners, controller bindings,
player scale and scene transitions are retained. Original Unity files and texture
images are unchanged. No new player collision reservations were introduced.

## Fixtures and chair

The east-side electricity box at the medical frontage (`Clutter_61_utility_box_01`)
was mounted against the garage shutter. It now moves approximately 0.75 m left
(-Z when viewing that building from the plaza), onto `M_Plaster2`. Nine surface
samples across the box footprint require an actual solid wall rather than a
shutter, window or sign. Its center height remains 1.65 m and its scale is unchanged;
its back has 6 mm mounting clearance. Existing fixture checks verify contact.

The three imported white plastic chairs, including the medical-side chair
(`Clutter_46_plastic_monobloc_chair_01`), now rest above the pavement sampled across
their footprints. Their lowest vertices are about 0.090 m, above the 0.084 m paving
rather than inside it. The floor probe also starts above the pavement instead of
below raised surfaces. Chair footprint colliders are rebuilt from the corrected
models. The chairs are intentionally white: their original diffuse atlas, normal,
packed material maps and authored UVs are present and retained.

## Roti sign

The supplied `PriceBoard.jpg` itself cuts off letters at both horizontal edges.
The original mesh also has a 2:1 face despite the image being 512:352. UV changes
cannot recover pixels that are absent from the source JPG.

A runtime canvas retains the source image, its wooden background and `Rs 10`
price. Only the damaged heading band is repainted using a clean wood strip from
the same image and the original sampled red ink, with the full `ROTI - SABZI`
heading fitted inside margins. The input image is never overwritten. The sign
keeps its original height/top edge and now matches the image's aspect ratio,
without stretching or cropping the lettering or hiding the vendor behind a taller
panel. This is a derived repair of the damaged heading, not recovery of an intact
original heading image.

## Scrap pile

The original generated box pile is removed from scene construction. The flat
source scrap patch at the pickup location is removed from its material batches,
while unrelated street litter remains. The same pickup owner now holds ten
connected folded-cloth pieces from the shared factory library, in three grounded
stacks with varied existing cloth textures. No old visible geometry remains under
the pile. The pickup callback, bag content state and progression to the tailor are
preserved.

## Pedestrian routing

The existing walkers used straight-line waypoint movement and a radial player
push, neither of which checked stalls. Their existing patrol loops are now routed
through a cached 0.25 m walkway grid, with 0.32 m body clearance around building,
counter, stall and major prop footprints. Route search and smoothing both test
segments, including diagonal corner clearance. Initial positions are projected
onto the connected walkways; idle pedestrians are also placed outside obstacles.

Seller, food, scrap, begging and produce approaches have pedestrian-only keep-clear
areas. NPC movement checks each proposed step against the same obstacle map and
yields when too close to the player, instead of being pushed into a stall. Walk
animation/stride advances only when an NPC moves. These changes modify the current
custom walker system; no Unity NavMesh or second locomotion system is introduced.
The player collision map continues to use the existing solid structures and story
routes. The reservations never block player movement.

Pedestrians remain scripted patrol actors, not a full crowd simulation. They can
pause if the player stands in their route; their reserved interaction approaches
remain empty. NPC-to-NPC separation is not introduced in this fix.

## Validation

The focused suite checks each fixture, chair texture/UV/collider, sign aspect,
source scrap geometry, pickup/bag state and every NPC patrol segment. Each edition
also simulates 240 seconds of movement and requires moving pedestrians to continue
circulating, with no solid or reserved-area crossings. Rendered views cover the
medical frontage, full roti sign, scrap pile and seller approach.

The existing street suite checks source textures/shaders, supported props and
hangings, all five interaction callbacks, theft/reset, ambience and flood-filled
player routes to food, scraps, tailor, begging and chase exit. Story and emulated
Quest physical interaction suites cover progression and posture/controller
regressions. Actual Quest hardware behavior and performance still need testing.
Story checks accelerate narrative waits and use debug traversal helpers; they are
not uninterrupted manual playthroughs. The focused navigation simulation checks
the production NPC step logic, and posture tests use tracked controller inputs.

Commands: `node tools/test.mjs market-fixes street`,
`node tools/test.mjs story physical`, `npm run build`, `npm run audit:text`.
Final run logs: `/tmp/tlwh-market-fixes-final.log` and
`/tmp/tlwh-market-progression-vr.log`. PNGs are in the system temporary
`tlwh-tests/` directory. Explore-mode labels are enabled by the inspection harness.

Final results: both editions passed the focused corrections and full street
suites, including the 240-second NPC simulations, all five interactions, source
material/shader checks and player routes. Both accelerated desktop stories reached
their endings. The emulated Quest suite passed tracked sewing, physical seated
begging, both-hand confirmation, upright return, accessible alternatives and state
cleanup with no runtime errors. Build, text audit and whitespace checks passed.

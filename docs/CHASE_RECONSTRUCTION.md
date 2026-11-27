# Nightmare chase reconstruction and direct scene loading

## Recovered layout

The authoritative reference is `ec81574:src/scenes/nightmare.js`, before realistic
Scene 3 assets were integrated. `src/config/chase-layout.mjs` contains its five
corridors and nine city block envelopes. An independent extracted fixture at
`dev/fixtures/chase-layout-original.json` records those coordinates, all twelve
obstacles, the menu/checkpoint spawn and the destination.

The route remains:

1. East from `(41, 8.3)` to `(52.7, 8.3)`.
2. North to `(52.7, -4.7)`.
3. East to `(66.7, -4.7)`.
4. South through the repeating lane to `(66.7, 12.7)`.
5. East to the house door at approximately `(82, 12.7)`.

The original checkpoint entrance is `(41.2, 8.3)`; the original direct scene-start
trail ends at `(41, 8.3)`. Both definitions were recovered. Checkpoints, explicit
obstacle coordinates, loops, hiding beats, pursuit, monsters and collapse cues
retain their original positions and logic. No Unity source gameplay systems or
Unity scene building arrangement are used.

Original block envelopes now reach the original chase entrance at x=40 instead
of x=46.7. The current imported Home is larger than the old placeholder house:
only portions of neighboring solid plots that intersect its footprint/roof
clearance are subtracted, including the narrow shared boundary at x=82. The
playable corridor coordinates and destination do not move. This deterministic
clearance prevents exterior architecture from clipping through the house.

All required navigation data was recovered. The old facades were procedurally
subdivided boxes, rather than a saved parcel/model layout. Their generator is in
history; the reconstruction preserves the block envelopes instead of trying to
force a whole realistic house into each 2 m facade slice. Detailed facade modules
occupy those original blocks, so the visual subdivision differs while the chase's
spatial/navigation structure remains the recovered one.

## Models, surfaces and collisions

`loadChaseReference` uses the supplied catalog as a model/material library. Catalog
positions are discarded. Every asset family has one uniform scale, reused in
every instance. The named source slum door is calibrated to 2.05 m; multi-storey
families use a common 2.65 m storey scale, consistent with the existing house's
roughly 2.67 m height. Source pivots are normalized in a detached parent. Models
that do not fit a plot at their calibrated dimensions are omitted there; buildings
are never stretched independently across X/Y/Z to fill arbitrary parcels.

Imported concrete foundations mark the exact solid plot footprint. Models sit
on their 0.42 m upper surface. Source-material boundary infill closes residual
facade gaps. Detailed buildings fit entirely inside the recovered plots. The old
box facades are hidden, not drawn beside the realistic buildings. The original
floor strips retain their geometry and use supplied floor maps. A flat backing
apron closes gaps left by the source catalog's missing ground prefabs. Every
corridor remains supported at the existing locomotion floor.

The previous implementation combined collision boxes from all five worlds,
including market buildings that crossed the chase entrance. Collision collection
now uses the active scene only. The chase additionally includes the real Home
boundary, including the closed door in Extra before its collapse cue.
Dynamic gate/door boxes refresh each movement frame. The market's
unrelated Unity geometry is hidden after entering the chase; its preceding audio
lifecycle is preserved. Source obstacles match the existing collision footprints.
Architecture remains stationary against its collision footprints during normal
chasing; the existing scripted collapse still lifts and rotates its owners.
Laundry, atmosphere, monster animations and other narrative effects remain.

The planar player system has no gravity/falling solver: locomotion stays on its
existing floor, and XR height calibration is unchanged. No new physics engine,
NavMesh, Unity controllers or replacement chase architecture were introduced.

## Completion and scene selection

The normal route still ends with three knocks. Door interaction, opening and
completion now use a shared destination region around the actual house entrance,
measured from the tracked head's world X/Z. Height/tracking-origin differences do
not prevent arrival detection. The camera/controller ray can reach the original
knock proxy from the open approach. Completion fires once, stops pursuit and
enters Home. Extra retains its established collapse/void interlude before Home.

Knock timers are cancelled on reset and carry a generation guard. Scene end
callbacks are accepted only from the active world. Asynchronous transition
versions prevent cancelled loads from winning a later scene selection.

Menu numbers are explicitly mapped to scene names, independently of the internal
Extra-only void slot:

- 1: workshop, seated at the sewing workstation with fresh shift state.
- 2: market at `(21.5, 3.9)`, carrying the bag and three coins.
- 3: chase at its original trail entrance, carrying the stolen meal.
- 4: Home, inside the actual entrance with the meal still carried. Normal uses its
  arrival beat; Extra uses its existing wake-up beat.

Direct selection skips the prologue, waits for required assets/audio, clears old
scene state and input, seeds only the needed story items, and starts the chosen
world. It does not start the factory and race a later market/chase teleport.
Begin retains the full introduction and normal story progression. The persistent
food instance and existing Home interactions are preserved.

## Verification

`npm run test:chase:route` runs:

- The independently recovered layout fixture comparison, continuous ground ray
  checks, real desktop collision-motor traversal through all turns, uniform scales
  and original block footprint checks. Extra is checked against the closed door,
  then verified to enter its original collapse after hiding is complete.
- Actual main-menu selection of all four scenes in both editions, including Home
  after other scenes, delayed stability, inventory/posture reset and stale timer
  rejection. A collision-enabled walk and actual camera-ray mouse presses complete
  all three knocks and transition to Home.
- An IWER Quest session with a shifted/rotated tracking origin. All four XR spawns
  are checked. Genuine emulated thumbstick input follows every corridor with
  collisions enabled, then actual controller-trigger rays knock and enter Home.
  Navigation does not teleport between turns or disable collision.

The chase asset, Home, UI and intro suites additionally cover material/shader
loading, navigation, callbacks, collapse/reset and presentation. Actual Quest
hardware remains necessary for subjective comfort, visual scale and room-scale
wall behavior; automated XR checks use browser emulation.

The supplied Scene 3 catalog still contains 17 missing ground-prefab references.
Those are not recoverable mesh resources in the supplied catalog. Runtime ground
uses the recovered continuous floor geometry and supplied real floor material,
so those missing source objects do not create holes or block progression.

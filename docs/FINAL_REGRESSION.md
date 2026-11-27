# Full-game consistency and regression validation

Date: 2026-11-26. Platform: local Chromium with software WebGL; WebXR checks use
IWER's simulated Meta Quest 3. No physical Meta Quest headset was used.

Status: all available desktop and emulated WebXR regression checks passed,
including both story endings and XR exit/re-entry. Physical headset validation
remains outstanding.

## 1. Completed changes by scene

Scene 1, Sweatshop: no environment or gameplay edits were needed in this pass.
Verified the realistic folded cloth and eight material variants, six grounded
rolls, workstation/furniture support heights, pick/feed/fold callbacks, navigation,
bag/wages/door interactions and existing audio buffers. The focused WebXR suite
rejects remote buttons and stationary grip-only sewing, then completes sewing
through tracked grab, carry, forward feed, release and re-grab.

Scene 2, Market: no environment or gameplay edits were needed. Verified imported
market geometry, supported laundry/booth cloth, grounded produce and fixtures,
clear seller approach, five interaction bindings, walking routes and source maps.
Seated begging checks cover head/controller lowering, both-hand extension,
confirmation timing, posture loss, upright return and deliberate accessibility
alternatives. Theft transfers the persistent food to the carrying hand.

Scene 3, Nightmare Chase: corrected a small laundry support mismatch. The cloth
still used the old shorter span after the support ropes were lengthened. Cloth
attachment points now come directly from each existing rope curve. Road/building
layout, collisions, obstacles, monsters and progression are unchanged. Added
assertions for all three supported laundry rows in both editions.

Scene 4, Home: corrected two interaction inconsistencies. Physical food placement
in VR no longer runs the desktop approach animation that moved the player rig.
The original mouse-driven approach remains on desktop. VR close-eyes state now
clears on reset/exit and cannot act as desktop input. Added regressions for stable
rig position after physical placement and for stale grip-state cleanup.

No building/road layouts, player-height constants, controller bindings, model
binaries, dialogue copy or narrative rules were redesigned during this pass.

## 2. VR interactions retained and checked

Trigger pointing/use, grip-based fabric manipulation, motion-based sewing,
calibrated seated begging, both-hand extension, carried food attachment, physical
plate placement, door knocking, stick locomotion, snap turning and height
recalibration retain their existing mappings. The accessible begging alternative
and desktop controls remain available. Tracking-loss and posture-lock cleanup
are covered by the logic/focused WebXR suites.

Physical cloth is a constrained rigid mesh, not a soft-body simulation. Seating
is inferred from head/controller posture; these sensors cannot verify contact
with a chair or distinguish every deep crouch from sitting.

## 3. UI consistency

Exact introduction copy/title and the body-first fade passed. The title remains
for 2.5 seconds after the body disappears, then fades. Desktop layouts at 1280,
800 and 390 px passed. Intro/outro XR boards remain camera-centered over shifted
origins, yaw and tracked heights, without changing player height to move text.

Instructions remain separate, upper-view, unboxed text. Dialogue uses its lower,
compact speaker-labelled style; thoughts remain unboxed. Phase/interaction
cleanup and learned walking-hint cleanup passed. Sewing retains the regular bar;
loading/stamina retain red threads. The source/bundle audit found no player-facing
em dashes in 66 checked files. No UI redesign was needed in this pass.

## 4. Shared assets and visual review

The stolen meal remains the same thali/plate object, geometry, materials and scale
through theft, chase, Home arrival and placement. Its existing narrative glow and
scene lighting can change; its underlying model/textures are not swapped. No
second meal is spawned in the hand, bag or on the table.

Fabric shares extracted imported folded/hanging geometry and eight source texture
variants. The decorative folding animation owns a geometry copy, leaving shared
stock geometry intact. Factory rolls, market supports and booth piles passed
support/grounding checks. Rendered factory, market, chase and Home views were
inspected for composition, material variation and obvious placement problems.
No additional misplaced environment objects were identified in the inspected
views. Intentional dream/collapse effects are not treated as floating-prop defects.

All six runtime GLBs passed Draco decode, self-contained texture/dependency,
source topology/transform and bounded position-error checks. Texture dimensions
remain within the 2048 limit. The model audit reports 15 runtime files totaling
58.4 MiB, three files over 5 MiB and zero unused model/texture files. No new model
files or source-texture edits were introduced.

## 5. Scene 3 navigation and progression

The independent fixture from `ec81574` matches the recovered five corridors,
blocks and explicit obstacles. Collision-enabled desktop traversal reaches every
turn and the Home approach. Buildings remain uniformly scaled within their plots;
visible foundations match the solid boundaries and every route sample has floor
coverage. Adjacent imported-house clearance remains intact.

The focused Quest driver follows all five corridors with genuine emulated stick
input, without teleporting along the route or disabling collisions. Controller
rays and three trigger presses reach/open the door and enter Home with the food
retained. All four tracked scene spawns passed. Extra's closed door and its
post-hiding collapse cue passed; its existing void interlude remains part of the
narrative before Home.

One initial automated navigation attempt stalled because the driver's centering
input fell below the game's 15% stick dead zone. The driver now supplies effective
centering corrections. No game controls, collision tolerances or layout were
softened to make that test pass.

The broader story driver's debug skip also needed a guard against repeatedly
resetting the chase door's opening timer. The full WebXR walkthrough uses a 0.1 s
debug timing cap, below the sewing tracking-discontinuity guard; focused physical
tests retain the production 0.05 s cap. These are test-driver corrections only.

## 6. Desktop results

`npm test` passed: physical-action logic; six optimized-model validations; UI,
intro presentation, food/fabric continuity, recovered chase route, menu selection,
factory, Home, street, chase and atmosphere suites; final text audit. Scene asset,
menu and atmosphere checks cover both Normal and Extra.

The added accelerated story suite reached the ending in both editions using
production interaction callbacks and scene completion events. Both sewed all four
pieces and served the same food UUID that was stolen, with standing child eye
height 1.52 at the table. Normal traversed workshop, market, chase and Home; Extra
also traversed the preserved collapse/void sequence. Targeted Home and chase
reruns passed after the corrections above.

## 7. WebXR results and scope

Focused physical sewing/begging, intro/outro alignment/timing, persistent food and
physical placement, all scene spawns, collision-enabled chase navigation, actual
controller door triggers, and reconstructed Home stereo rendering passed in IWER.
Home rendered with zero framebuffer warnings. The physical food test also asserts
that serving does not move the rig after placement.

Full-story Normal and Extra walkthroughs both reached their endings, physically
placed the same food on the Home table and passed the end-card trigger-to-exit
check. Standing eye height at the table was 1.52 m (Normal) and 1.51 m (Extra,
within the 0.05 m tolerance during its standing transition). Both recorded no
unexpected browser runtime warnings/errors. Two mid-story exit/re-entry rounds
returned to a clean title and restored the calibrated machine view on re-entry.
The subsequent desktop session restored matching camera/movement orientation
and seated eye height, with cleared XR rig offsets.

The walkthroughs accelerate narrative waits and use explicit debug positioning/
skip helpers in parts of traversal; accelerated desktop and WebXR story integration disables
random catches. Focused tests separately exercise controller tracking, grip
movement, posture, collision-enabled navigation and real interaction events.
These are progression/regression checks, not uninterrupted manual playthroughs
or difficulty-balancing validation. Log messages saying “actual XR” mean WebXR
API sessions with simulated inputs, not a physical headset.

## 8. Remaining limitations and source gaps

No blocking desktop or emulated WebXR runtime defect remains in the completed
checks. This does not establish physical-headset comfort or performance.

Physical headset behavior, optical readability/contrast, palm offsets, reach
comfort, room-scale wall behavior, haptics, actual audio balance, sustained frame
rate, memory pressure and thermal stability are unverified by these browser runs.

Known source gaps remain: the factory's referenced `28.fbx`, `table_01_SM.FBX`,
`chair_02_SM.FBX`, related maps and alternate cloth color textures are missing.
Compatible available furniture and the working animated sewing assembly remain.
No fabric-roll mesh was supplied, so rolls use textured wound-cloth geometry.
The Scene 3 catalog contains 17 missing ground-prefab references; recovered floor
geometry with supplied materials provides continuous runtime ground.

Some characters, animated gameplay props and narrative apparitions intentionally
retain procedural geometry where suitable supplied replacements/animations are
unavailable. The entire experience is not uniformly photorealistic. Original Unity
sources and their unresolved metadata have not been rewritten to hide these gaps.

A Node module-format warning appears in some test tools. It is not a browser
runtime or shader error and was left outside this gameplay consistency pass.

## 9. Recommended final validation

Run one continuous Normal and Extra session on the actual target Quest. Check
comfortable sewing reach/feed stroke, release/re-grab and tracking recovery;
short/tall and seated-user begging thresholds and accessible controls; carried
plate/palm alignment; the complete collision-enabled chase and door knocks;
stationary Home placement; text readability through both eyes; and exit/re-entry.
Use a stable seat for the seated action and exercise the accessible alternative.

Profile headset frame time, draw calls, memory, asset decode and thermal behavior
before making further visual/performance changes. Supply the missing original
assets if exact source replacements are still desired. No additional layout or
architecture redesign is recommended from the completed checks.

## Reproduce and inspect

- `npm run build`, `npm run audit:models`, `npm run audit:text`
- `npm test`
- `npm run test:story`
- `npm run test:regression:vr`
- `node tools/test.mjs home chase` for the corrections in this pass

Run logs are in `/tmp/tlwh-final-desktop.log`,
`/tmp/tlwh-final-story-targeted.log`, `/tmp/tlwh-final-vr.log` and
`/tmp/tlwh-final-vr-resume.log` and `/tmp/tlwh-final-vr-stories.log`. The first VR
log contains the initial driver failure; the resume log records the corrected
navigation and Home render checks. The stories log records the final complete
Normal/Extra walkthroughs and XR exit/re-entry suite.
Screenshots/native XR canvas exports are in the system temporary `tlwh-tests/`
directory. Explore-mode banners in diagnostic screenshots are intentionally enabled
for inspection, not evidence of debugging text in normal play.

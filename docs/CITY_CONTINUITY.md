# Scene 3 city continuity and boundary validation

The market-to-chase join now retains a real 3D view of the market behind the
player. The original five chase corridors, block layout, obstacles, player height,
movement, monsters, narrative events and Home destination remain unchanged.

## Market continuity

The full Scene 2 root was deliberately hidden at chase entry because its expanded
architecture intruded into the restored chase. Removing that safeguard would
reintroduce the old spatial problem. Instead, a static subset of the existing
market buildings, stalls, ground and nearby approach facades is attached to Scene
3. It contains no copied NPCs, lights, interactions, stolen meal or active story
systems. Distant high-poly clutter is omitted.

The retained geometry uses the existing loaded models and materials. It stops at
world X 39.96, outside the first chase corridor beginning at X 40. Only one retained
mesh crosses that plane and needs geometric clipping; the other source shapes
remain intact. Opaque meshes are consolidated by material while transparent and
mirrored meshes retain their original sorting/culling behavior. UVs, normals,
tangents and material references are preserved. No new model download occurs at
the transition, and no billboard or flat panorama is used.

The original market and its static continuation never draw simultaneously during
normal play. The continuation remains visible in the entry corridor, including
when turning back, then stops drawing after the first turn puts it behind the
existing architecture. Direct Scene 3 selection and caught/checkpoint returns
also restore the appropriate view.

## Boundary gaps corrected

- The empty market/hallway lookback is replaced by retained market architecture
  and ground at the same world positions.
- Low end-of-row infill that exposed empty space above it now uses taller native
  material walls, with district-dependent heights.
- Ten rear party walls sit behind the original lots and their realistic facades,
  closing views through open model interiors or gaps between structures.
- Four distant northern, southern, eastern and western city walls close the outer
  horizon beyond the original blocks. These are outside the chase route and Home
  clearance.
- Eight calibrated source buildings (four balcony towers and four concrete
  apartment blocks) form a varied skyline behind those walls. Their existing
  family scale calibration is retained, without stretching them to fill gaps.
- The ground apron extends from X -14 to 126 and Z -40 to 52, at Y -0.025 beneath
  the existing street/route surfaces. This covers the join, spaces behind the
  facades and the new skyline instead of ending at the original narrow strips.

Natural sky remains visible above roofs. The target is to eliminate exposed map
edges and empty world boundaries, not to roof over the city. Extra's intentional
collapse and void interlude remain part of its narrative.

## Atmosphere

Sun, fog, sky tint, exposure, ambient light and the existing world-air grading blend
spatially from the market's final flee atmosphere into the chase over X 40.4 to
51.2. The existing eased temporal interpolation remains, so crossing the scene
trigger does not snap the lighting. Existing nightmare shadows, flashes, monsters
and dream effects continue unchanged. No new post-processing pass, light pool,
rapid flash effect or camera-height adjustment is added.

## Collision and progression

The recovered layout fixture from `ec81574` still matches all five corridors,
blocks and explicit obstacles. No primary route collider or Home trigger was
moved. The static market retains only collision footprints corresponding to its
visible solid scenery behind the join. The four distant perimeter walls have
matching visible wall colliders. Rear party walls sit inside existing solid lots;
they add no invisible barriers to the route.

Desktop collision-motor traversal reaches every turn and the Home approach.
Tracked Quest simulation walks all five corridors with actual emulated thumbstick
input and collisions enabled, then uses three controller trigger presses on the
Home door to enter Scene 4 with the same carried food. Both accelerated desktop
story editions reach their endings; Extra retains its collapse/void sequence.
Those story tests accelerate waits and use debug traversal helpers. The focused
route tests separately exercise the production movement/collision motor.

## Rendering cost and validation

The retained market contains 53,288 triangles. Batching reduces its tested lookback
contribution from 187 to 87 draw calls, with about 6.9 MiB of additional static
geometry buffers and shared source textures/materials. In the measured desktop
lookback, total scene calls fell from 236 to 136; batching trades some fine-grained
frustum culling for fewer calls. These are scene-render statistics, not actual
Quest performance measurements. The continuation is culled after the entry bend.

The eight skyline buildings use three instanced geometry/material batches and
45,824 triangles. No new GLBs, textures or original Unity source edits are needed.
No new render passes or shadow-casting background lights are introduced.

Both editions pass the continuity suite: walking across the native Scene 2 trigger
without a teleport, retained 3D geometry, seam clipping, continuous visible floor,
175 horizontal sightline samples across seven route positions, boundary/route
separation, background budgets and no added model requests. Backward, side, upward
and Home-approach screenshots were inspected. Emulated Quest captures also cover
a tracked 180-degree lookback and upward view in a two-eye XR session, without
moving the player rig or resetting height. Small tracked-eye shifts during head
rotation are allowed; the rig and calibrated eye height remain stable.

Actual Meta Quest hardware is still needed for sustained frame rate, memory and
thermal profiling, subjective reading/contrast, room-scale leaning and wide-FOV
edge cases. No physical headset test is claimed, and sampled ray coverage is not
a proof for every possible viewpoint or intentional collapse state.

Commands:

- `node tools/test.mjs city-boundaries chase-route chase`
- `node tools/test.mjs story chase-navigation-vr`
- `npm run build`, `npm run audit:text`, `git diff --check`

Final batching/route log: `/tmp/tlwh-city-batched-final.log`.
Story and chase-asset logs: `/tmp/tlwh-city-story-vr.log` and
`/tmp/tlwh-city-navigation-final.log`. The earlier story/VR log also records an
initial test assertion that incorrectly demanded 3 mm eye-position
stability during a tracked head rotation. The corrected rig/height and full
controller-navigation results are in `/tmp/tlwh-city-quest-final.log`.
Rendered PNGs are in the system temporary `tlwh-tests/` directory.

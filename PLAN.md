# The Long Way Home V2 — Improvements & Production Plan

## 0. Current state

**V1 (v0.4.5)** is fully playable, about 6–8 minutes: Space 1 factory → Space 2 street/market → Space 3★ nightmare chase → ending · home. Existing systems: red-thread guide, bag, police pursuit, explore mode (P), F for controls, settings, VR subtitle board, WebXR entry, and 15 audio clips (~3.9 MB).

**V2 (HD preview)** only finished Space 1 so far. Done: sun shadows, volumetric light, dust, GTAO, Bloom, colour grade, procedural brick/plaster textures, low-poly people with joints, sewing-machine detail, schoolyard outside the window, static mesh batching (`Batcher`), and auto quality drop by frame rate.

**V2 issues** (from reading the code and running it in the browser):

1. **Player hands:** Each arm is a thin cylinder from shoulder to wrist (~3.4–4.4 cm diameter) with no elbow; the palm is a flat box and the fingers are five small bars, so they look like puppets.
2. **Doorway layout differs from V1:** V2 turned the desk lengthwise, put the supervisor at the side, and moved the hooks to the back wall. V1 had a long counter across the room, the supervisor behind it facing the shop floor, and hooks on the right wall by the door.
3. **Flicker and cheats:** Door-gap light is an emissive plane that reads as a white vertical line; wall-stain tiling is obvious; when seated, the machine head sits right in the centre of the view.
4. **No WebXR in V2:** There is no XR code in main/player. The look also depends on post-processing (`EffectComposer`: GTAO, outline, Bloom), which **barely runs in VR**. Without a change now, the image will collapse when we move to VR later.
5. **Payload:** `app.js` is ~940 KB; all textures generate at load. If the next three spaces stack the same way, load time and VRAM will blow up.
6. **Lost V1 features:** Run/stamina, explore mode, FOV settings, and the bag/guide/pursuit modules were not brought into V2.

---

## 1. Art direction: How to Fish methods, serious tone

Borrow How to Fish’s **production methods** (low poly, big shapes, clean silhouettes, simple painted-looking textures, strong mood lighting and fog) — **not** its exaggerated comedy.

| Item            | How to Fish              | The Long Way Home V2                                                                 |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| Body proportions | Exaggerated, big head, chibi | Near-real: adults ~7 heads, 11-year-old ~5.5–6; thin child, not a stick figure     |
| Face            | Big expressions          | Small, restrained features: brow, sockets, bridge, mouth as blocks; tired / neutral  |
| Shading         | Smooth + cartoon         | Big smooth masses; small faces keep a light faceted “low-poly” signature; cloth folds |
| Textures       | Flat colour blocks       | Flat colour + low-frequency painted noise (dirt, fade, patches); not photo textures  |
| Motion          | Physics gags             | Weight: breathing, tired shoulders, eye follow, secondary motion (cloth, braid, bag) |

**Colour script** (one key mood per space):

- Space 1 factory: amber tungsten + cold cyan tubes; mixed colour temperature; the schoolyard outside is the only bright, saturated place.
- Space 2 street: dusk, dust, warm gold backlight, medium saturation, greyer crowds.
- Space 3★ nightmare: desaturated blue-black; the only bright colours are the **glowing food** and the **red thread**.
- Ending · home: a small warm pool from one oil lamp; darkness around it.

I could not find reliable How to Fish art-breakdown writeups online, so **please send 3–5 favourite screenshots** (people, lighting, environment) so we can match mass and light against those references.

---

## 2. Characters & player hands redo

### 2.1 New character system `makeHuman()`

- One **skinned mesh + ~16 bones** per person, instead of stacked cylinders. No gaps at joints; one shadow caster; cheaper.
- Body params: height, build, shoulder width, gender, age (adult/child). Modular clothes: kurta, sari + scarf, shirt + trousers, vest, hat, sandals — so crowds don’t look copy-pasted.
- Shared procedural animation on the same skeleton: sewing, walk, standing breath, talk, hand money, pick up, floor-sit, sleep, run (police), morph (nightmare).
- **LOD:** full mesh near camera; distant crowds as low meshes with simple vertex motion or `InstancedMesh` so the market doesn’t tank frame rate.

### 2.2 Player hands (priority)

- **Size:** Forearm taper ~5 cm at the elbow to ~4 cm at the wrist (thin 11-year-old), palm ~7×6 cm, fingers ~1.3 cm thick. Still lean, not puppet-thin.
- **Structure:** shoulder → upper arm (in sleeve) → **elbow (two-bone IK)** → forearm → wrist → rounded palm → thumb + four two-segment fingers (capsules). Loose, folded cuff.
- **Gestures:** rest, grip cloth, pinch coin, cup (beg), guard bag, push door, reach for food. Each interaction switches gesture with a smooth blend.
- **Detail:** slightly darker knuckles, lighter nails, light dust on the back of the hand. Looking down should show legs and sandals (cross-legged / pedal pose when seated).
- Hands and body should map to VR later by swapping IK targets to controller poses.

---

## 3. Image quality & stability (no flicker, no hitches, no logic bugs)

### 3.1 Lighting: “bake first, post second”

VR can’t rely on post, so lighting must look good without it:

- **Baked vertex AO / indirect light:** once at scene build, hemisphere occlusion into vertex colours. Corners, under desks, and wall bases go dark — GTAO-like, near-zero runtime cost, works in VR.
- **Static shadows:** one shadow-casting light per space (sun in the factory). Static shadow maps render once (`shadowMap.autoUpdate = false`); update only when characters move.
- **Volumetrics & fog:** keep additive light shafts and dust (VR-safe), plus height fog tuned per space.
- **Desktop-only “high” post:** Bloom, light chromatic aberration, grain, dream look — merged into **one** fullscreen pass. GTAO optional, off by default.

### 3.2 Anti-flicker checklist (before each space ships)

- **Z-fighting:** any coplanar overlay offset ≥ 3 mm, or use `polygonOffset`; tighten camera near/far (0.05–60).
- **Shadow acne:** tune `shadow.bias` / `normalBias`; fit the shadow camera to the room.
- **Thin-line shimmer:** wires, needles, threads thicker than 1 px or fade with distance; enable MSAA.
- **Texture shimmer / moiré:** mipmaps everywhere, anisotropic filtering; less high-frequency noise.
- **Light-leak white line:** remove the emissive door plane; use a strong exterior light + a soft gradient strip in the gap.
- **Flickering lamps:** smooth noise only — never per-frame random.
- **Pop-in / pop-out:** fade opacity or scale; all space transitions go through a black fade.
- **Camera clipping:** player collision radius + near plane in sync; hands never push through the desk (IK targets clamped above the surface).

### 3.3 Logic stability

- Replace scattered `setTimeout` + phase strings with one **state machine / timeline**: enter / update / exit per beat; all timers owned by the machine. Pause, restart, and skip clear cleanly (no “machine keeps sewing after pause” races).
- Each space exposes `build / start / update / stop / dispose` and fully releases on switch.
- Encode the 28 known bugs fixed in V1 v0.2.1 as automated tests; run them on every build.

---

## 4. Performance & loading (VR-ready)

**Budgets** (every space must hit these):

| Metric           | Desktop target                 | VR (Quest 3) target      |
| ---------------- | ------------------------------ | ------------------------ |
| Frame rate       | iGPU 60 fps (medium)           | 72 fps                   |
| Draw calls       | < 150                          | < 100                    |
| Visible tris     | < 500k                         | < 250k                   |
| Texture size     | ≤ 1024                         | ≤ 1024, shared atlases   |
| Shadows          | 1 × 2048                       | 1 × 1024                 |

**Loading:**

- **Stream per space:** first paint loads Space 1 only. While the player is in Space 1, build Space 2 on idle frames; free Space 1 after leaving the factory. VRAM holds 1–2 spaces.
- **JS bundle:** tree-shake three.js; target < 250 KB gzipped (today ~940 KB uncompressed).
- **Texture gen:** Web Worker + OffscreenCanvas so the main thread stays free; generate per space, not all at boot.
- **Audio:** mono Opus/OGG at 64–96 kbps (~⅓ current size); lazy-load per space. First-screen download target < 2 MB; title visible in < 3 s.
- **Auto quality:** keep frame-rate detection; add “still bad after one step → keep dropping” and recovery.

---

## 5. Space 1 factory polish & doorway layout restore

**Restore the V1 doorway layout at V2 quality:**

- Supervisor counter: **long counter parallel to the back wall** (~1.9 m × 0.85 m, height 1.15 m), centre near (5.0, 5.1). Drawer, ledger, cash tin, chai, abacus, cool-white desk lamp (V1 `deskLight`).
- Supervisor **stands behind the counter (z≈5.8), facing the shop floor**. Pay beat: looks at you → flips ledger → counts coins → drops 3 coins into your bag (fall + clink) → “Here. Same time tomorrow.”
- Hooks: **right wall by the door** (x = wall, z 1.25–2.75), 4 hooks. Your bag nearest the door; three other bags beside it.
- Door: same place (right wall z 3.2–4.6); fix the white light-leak; opening reveals overexposed alley light.

**Other polish:**

- Seated view: shift the machine head ~15 cm left, or raise the viewpoint slightly, so the centre of frame is needle and cloth — not the back of the head.
- Sewing: while held, the hand feeds cloth and stitch lines “grow” live; on release the machine coasts to a stop.
- Walls: break up stain tiling with irregular patches and a damp skirting gradient.
- Keep what V1 did well: 4-piece quota, daydream after piece 2 (blackboard + notebook), school bell after piece 3, louder kids when looking at the window, quitting bell, red-thread guide, bag auto-opens once, F for controls.

---

## 6. Later spaces (keep every V1 story beat, add interaction)

### Space 2 · Street & market

**Keep:** narrow lane → dusk market; three failed tries (Rs 6 can’t buy Rs 10 food; scrap cloth refused by tailor; E to beg, pedestrians pass) → vendor turns → steal → whistle → Shift to run.

**Add:**

- **Count coins:** tip coins from the bag into the palm one by one (hand close-up) next to the Rs 10 price board.
- **Hunger:** steam and scent particles pull the eye; longer wait → louder stomach, darker frame edges.
- **Mirror:** school-uniform kids pass you — echo of the factory window schoolyard.
- **Market life:** truck dust, a stray dog that follows a stretch, overhead wires and laundry in the wind.

### Space 3★ · Nightmare chase

**Keep:** warped lanes, buildings that “breathe,” eyes in windows, lightning, police → monsters, glowing food that lights the path and grows heavier, stamina, catch → checkpoint, ghost sewing machines, wall text (400 PCS / Rs 6 / Rs 10 / TOMORROW 7 AM / CHOR), ghost supervisor “Same time tomorrow.”, final tin-shed stretch.

**Add:**

- **Hide:** duck into a doorway, hold Space to hold breath, monster brushes past (tension, not combat).
- **Bag weight as feel:** the longer you run, the more the camera lists; bag-against-leg hits get louder.
- **Path “remembers” the day:** sewing-machine noise becomes a heartbeat rhythm in one alley.
- Monsters morph on the new character skeleton (elongated body/arms) — not a separate model.

### Ending · Home

**Keep:** glowing door pulls you back to reality, tin roof, oil lamp, mother by the clay stove, brother asleep, police run past outside, food on the table, hold C to close eyes, machines return, ILO/UNICEF stats, “Maybe tomorrow will be better.”

**Add:**

- You **yourself** take food from the bag and set it by your brother. He turns; mother’s hand rests lightly on your head (visible in first person).
- The page “When I grow up I will be a teacher.” is pinned on the wall; you can walk up and read it.
- Before eyes close, only a pencil stub is left in the bag.

Target length stays the board’s **~6 minutes**; new interactions stay short and don’t stretch the main line.

---

## 7. VR-first design

- Put WebXR entry and a shared “interactable” abstraction into V2 now: the same object supports mouse reticle click, controller ray, and grab.
- Comfort: no head bob in VR; smooth loco + edge vignette while moving; 30° snap turn; all text on world-space subtitle boards.
- Scale: keep V1’s child POV (adults ~1.35× taller).
- Image depends on **baked light + fog + emissive materials** only — not post — so VR won’t collapse the look.

---

## 8. Build order (each step playable and reversible)

| Phase                     | Work                                                                                                                                                                      | Deliverable                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **M0 Foundation**         | State machine, space lifecycle + streaming, Worker textures, Opus audio, perf panel, automated smoke tests, anti-flicker fixes, restore V1 features (run/stamina, explore P, FOV, WebXR entry) | Same Space 1, stabler and lighter                |
| **M1 Characters & hands** | `makeHuman` skinned people, clothing modules, animation library, new first-person hands and body                                                                          | Everyone in the factory + your hands replaced    |
| **M2 Space 1 complete**   | V1 doorway layout, pay animation, baked AO, walls, seated view, sewing feel                                                                                               | Factory locked                                   |
| **M3 Space 2**            | Lane, market, three tries + new interactions, crowd LOD                                                                                                                   | Playable from factory through the theft          |
| **M4 Space 3★**           | Nightmare chase + hide, monster morph                                                                                                                                     | Playable to the front door                       |
| **M5 Ending**             | Home, eyes close, stats, credits                                                                                                                                          | **Full playthrough**                             |
| **M6 Overall polish**     | Full-run perf budgets, mix, subtitles, bug sweep                                                                                                                          | Submittable PC web build                         |
| **M7 VR prep**            | Headset test and tuning                                                                                                                                                   | VR build                                         |

At the end of each phase: auto-playthrough in the browser with screenshots, record fps and draw calls, update DEVLOG, zip a backup. Keep author credit and copyright marks (title, end card, code banner, desk carving) everywhere.

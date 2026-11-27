# Scene assets

All four scenes have separate runtime folders:

- `scene1/factory.glb` — factory/workshop.
- `scene2/market.glb` — market and lane.
- `scene3/Scene 3.glb` — chase environment.
- `scene4/unity-home.glb` — Home, with `front_doors_pack.glb` and `thali.glb`.

Models include their materials and textures. JSON files beside each model record
imports, layout or source conversion details. Runtime paths are defined once in
`src/config/scene-assets.mjs`.

Original Unity projects, source models, textures and redundant exports are preserved
locally under `_raw_assets/public/models/scene1/` through `scene4/`. That archive is
gitignored and is not served to the browser. Add new source projects there.

From the repository root, `npm run audit:models` checks paths and dependencies;
`npm run test:models` verifies decoded geometry. See `docs/MODEL_ASSETS.md` for the
complete conversion/optimization workflow and source restoration instructions.

Scene code is kept separately from assets:

- Scene 1: `src/scenes/sweatshop.js` and `src/world/factory-reference.js`.
- Scene 2: `src/scenes/street.js` and `src/world/street-reference.js`.
- Scene 3: `src/scenes/nightmare.js` and `src/world/chase-reference.js`.
- Scene 4: `src/scenes/home.js` and `src/world/home-reference.js`.

`src/world/gltf-assets.js` handles shared loading/Draco decoding;
`src/config/optimized-assets.js` contains generated content versions.

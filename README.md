# The Long Way Home — V3

Immersive Storytelling · Parsons School of Design (reference build).

A first-person experience: one day in the life of a child worker in India, about 7 minutes.
Space 1 the sweatshop → Space 2 the lane and the market → Space 3 ★ the nightmare chase → home.

Two editions, chosen in the bottom-left corner of the title screen (Normal by default):

- **Normal** — the V1 story, refined.
- **Extra** — the last stage has extra content: the looping lane, the hide, the street rising into the light, the void with food out of reach, waking at home at night, eating, lying down, and the morning that will be the same.
  Runs in a desktop browser (mouse + keyboard) and in a VR headset browser (WebXR).

## Develop locally

Run `npm install` once, then `npm run dev` and open `http://localhost:8080/?debug`.
Changes to `src/` rebuild automatically; refresh the browser to see JavaScript, HTML, or CSS changes.
Use the Scenes menu to preview later scenes. Stop the server with Ctrl+C.

## Play it

- **Online:** the published link (claude.ai artifact) runs the desktop version.
- **On this computer:** double-click **`Start The Long Way Home.bat`**. It serves the `public` folder at
  `http://localhost:8080` and opens it in your browser (close the black window to stop). Any other local
  web server works too, e.g. `python -m http.server 8080` inside `public`.

## Play it in VR

There is no app to install: the headset opens the game as a web page and **Enter VR** (on the title, under
Scenes; it only appears where VR is available) takes it into the headset. It needs **controllers** (not hand tracking). WebXR only works over
`https://` or on `localhost`, so there are two ways in:

1. **Standalone headset (Meta Quest 2/3/Pro, Pico):** put the `public` folder online over https (GitHub Pages
   — see below — or Netlify Drop: drag the `public` folder onto app.netlify.com/drop). Open the link in the
   headset's own browser → **Enter VR**.
2. **Headset tethered to a Windows PC (Quest Link / Air Link, SteamVR, Windows Mixed Reality):** start the
   headset's PC link first, then double-click `Start The Long Way Home.bat`, open the page in **Chrome or Edge**
   on the PC → **Enter VR**. (A Quest on USB can also use the PC's server: `adb reverse tcp:8080 tcp:8080`, then
   `http://localhost:8080` in the Quest browser.)

The Edition picker applies to VR too. In VR the story starts from Scene 1.

## Put it on GitHub (and GitHub Pages for VR)

The folder is ready to be a repository as it is: `.gitignore` leaves out `node_modules/` and `backups/`,
all paths in `public/` are relative, and `public/.nojekyll` stops Pages from touching the files.

1. `git init`, `git add .`, `git commit -m "V3"`, then push to a new GitHub repository (branch `main`).
2. Move `docs/github-pages-workflow.yml` to `.github/workflows/pages.yml` (create the two folders), then
   Repository → Settings → Pages → Source: **GitHub Actions**. The workflow publishes the `public/` folder on every push.
3. Open the `https://<user>.github.io/<repo>/` link on desktop or in the headset browser → **Enter VR**.

`public/app.js` is already built, so nothing has to be compiled on GitHub. After changing `src/`, run
`npm install` once and `npm run build`.

## Publish on Vercel

Import this repository into Vercel with the repository root as the Root Directory.
The root `vercel.json` configures the framework preset as **Other**, runs `npm run build`,
and publishes `public/` as the Output Directory. The HTML, styles, fonts, and audio already
live in that folder; the build generates `public/app.js` alongside them.

Commit and push these files, then redeploy. If you previously set the Output Directory
to `site` in the dashboard, change it to `public` or disable that override.

## Scenes

The title menu's **Scenes** loads each environment directly: 1 The Workshop · 2 The Market · 3 The Run · 4 Home. Direct selection seeds the required story items and skips the opening prologue. **Begin** retains the full introduction.

Scene 3 uses the recovered placeholder navigation layout with uniformly scaled realistic models. See [chase reconstruction notes](docs/CHASE_RECONSTRUCTION.md) and run `npm run test:chase:route` for route, scene selection, and Quest navigation checks.

## Scene assets

All four runtime asset folders are present under `public/models/`:

- `scene1/` — factory (`factory.glb`).
- `scene2/` — market (`market.glb`).
- `scene3/` — chase (`Scene 3.glb`).
- `scene4/` — Home (`unity-home.glb`, door/frame catalog and food plate).

Textures and materials are embedded in these six optimized Draco GLBs (about
58 MiB total). Each folder also contains its import/preparation reports. The shared
path registry is `src/config/scene-assets.mjs`; scene loaders and optimization tools
use it instead of maintaining separate runtime paths.

Original Unity projects and source exports are preserved in gitignored
`_raw_assets/public/models/scene1/` through `scene4/`. Keep newly supplied raw
projects there rather than mixing them into the runtime folders. Unity scenes,
prefabs, shaders and C# components require conversion for this Three.js/WebXR app.
Dropping a source folder does not automatically place objects in the game.

Use `npm run audit:models`, `npm run optimize:models` and `npm run test:models`.
See [model asset workflow](docs/MODEL_ASSETS.md) for restoration and conversion
commands, and [asset integration notes](docs/ASSET_INTEGRATION.md) for scene mappings
and missing source dependencies. The older conversion tools retain their original
intermediate paths; the optimizer writes their results into the scene folders above.

## Controls

| Desktop                                                                             | Headset                                                                                                  |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mouse: look · Left click: use · hold on the machine to sew                          | Point + trigger for ordinary actions; reach, hold grip, carry and physically feed fabric to sew |
| Click again and again: pull free when a hand grabs the bag · Click the door: knock  | Pull the trigger again and again · point at the door and pull the trigger                                |
| W A S D: walk · Shift: run                                                          | Left stick: walk (push it all the way to run) · Right stick: turn 30°                                    |
| Q (hold): look inside the bag · R (hold, Extra): hug the bag and hold still to hide | Squeeze a grip (or lift the bag and look in) · squeeze a grip and hold still                             |
| E (hold): hold out your hands (when sitting) · E (the light): grab                  | Lower onto a stable seat and extend both hands to beg; trigger grabs the light                                                                      |
| C (hold): close your eyes (at the end)                                              | Squeeze both grips                                                                                       |
| F: controls list · Esc: pause (Esc again to resume)                                 | Headset menu button: the story waits while the menu is open                                              |
| —                                                                                   | Press a thumbstick: reset your height (after sitting down or standing up)                                |
| P: explore mode (walk through walls, 1–4 jump to a space)                           | —                                                                                                        |

In a headset, hints are worded for the controllers, the controllers give a small tap when you use something,
and the edge of sight darkens a little while the stick moves you (comfort). At the end the statistics appear in
the dark in front of you; pull the trigger to leave VR (the end card stays on the page).

Add `?debug` to the address for the story phase and frame rate; N skips a beat.

## Code organization

`src/main.js` coordinates the game. Source modules are grouped into `scenes/`, `systems/`,
`rendering/`, `characters/`, `world/`, `ui/`, and `config/`. The current page is `public/index.html`;
`public/app.js` is generated. Styles are in `public/styles/`, imported by `public/style.css`.

See [the code guide](docs/CODE_GUIDE.md) for the source map, scene lifecycle, VR conventions,
formatting, and tests. Older `public/js/`, `public/css/`, `public/play.html`, and `site-public/` files are
retained references; the current game builds from `src/`.

Format source files using the Prettier extension in VS Code.
Run `npm test` for UI and scene checks. `npm run test:vr` checks both editions with an emulated headset.
Install the test browser once with `npx playwright install chromium`.

## Typography and atmosphere

The playable `public/` build serves Spectral titles and Gowun Batang body text locally, including the
caption and ending boards in VR. Font licenses are in `public/fonts/`.

`src/rendering/atmosphere.js` adds slowly drifting, height-dependent haze to world materials in both eyes,
without a post-processing pass. The factory keeps its window shafts and floating dust at every
quality level, with dim, independently fading lamps. The market uses amber sunlight, suspended pollution, and a procedural sky with a sun disk and
slowly moving clouds (`src/rendering/sky.js`); the run uses dense cold fog, thinning and warming toward the door. At home, the warm lamp contrasts with
a small cold light at the barred window. Atmosphere transitions are eased between spaces.

Run `npm run test:atmosphere` for scene-render and font checks in both editions. The runner
builds and serves the site, and writes preview PNGs to the system temporary directory under
`tlwh-tests/`.
A real headset is still needed to judge comfort, readability, and performance on the target device.

## Physical VR actions

Scene 1 sewing uses the tracked controller grip: reach to the cloth, squeeze and
hold, carry it to the needle, and slowly push forward. Keeping the controller still
adds no stitches. Release to leave the cloth on the workstation, then reach and grip
again to resume. The original mouse click/hold sequence remains available on desktop.

Scene 2 asks for a comfortable seated height and both hands extended forward.
Lowering only the controllers while standing does not count. A subtle ring confirms
the posture after a short hold. Use a stable seat; no rapid movement is needed.
For an alternative, enable **VR begging: use trigger instead of seated posture**
in Settings before entering VR, or deliberately hold both triggers for 1.2 seconds
at this section. Then either trigger works without lowering or extending both arms.
Afterward, rise when comfortable or choose to continue seated. Other scenes do not
require real-world sitting. Normal thumbstick height reset returns outside this section.

Run `npm run test:physical-logic` for input/threshold tests and `npm run test:physical`
for the focused emulated Quest checks. See [physical interaction notes](docs/PHYSICAL_VR.md).

## Intro, ending and guidance UI

The introduction uses the corrected four-paragraph copy and the title **The Long Way
Home**. The title starts as a red phrase inside the third paragraph. On continuing,
surrounding text fades, the phrase moves and grows into a centered title, holds
for 2.5 seconds, then fades before gameplay. XR intro/ending cards stay centered on the camera without
changing player height. Gameplay instructions occupy a separate upper, unboxed
region; thoughts and speaker-labelled dialogue stay below. Stale guidance clears
on action/phase changes, while essential navigation prompts remain available.

Run `npm run audit:text`, `npm run test:presentation`, and
`npm run test:presentation:vr`. See [UI presentation notes](docs/UI_PRESENTATION.md)
for timing, placement and verification details.

See the [full-game regression report](docs/FINAL_REGRESSION.md) for scene-by-scene
results, test scope, known source gaps and remaining physical Quest checks.

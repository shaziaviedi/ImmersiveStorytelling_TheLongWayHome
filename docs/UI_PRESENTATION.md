# Desktop and XR text presentation

The active introduction uses the supplied four paragraphs verbatim. There is no separate heading. The red phrase `the long way home` stays inline
in the third paragraph until dismissal. Story lines retain the existing staggered reading window, with frame-driven
opacity shared by desktop and XR;
the continue cue appears after 12.8 seconds. The redundant headphones line is removed.
Continue still uses a desktop click or XR trigger, without asking the real player
to sit during the introduction.

On continuing, surrounding copy fades over 900 ms while the red phrase remains.
The same phrase moves from its sentence position to the view center and grows
into `The Long Way Home` over 1000 ms, holds for 2.5 seconds, then fades over
900 ms. Desktop lifts the existing span while reserving its original footprint;
XR draws its corresponding marked token on the same fixed-depth board. Neither
renderer adds a second title. Both use `INTRO_TIMING` in
`src/ui/presentation.mjs` / `src/ui/interface.js`, independent of scene time.
Gameplay starts after the complete 5.3-second sequence. Repeated starts are
ignored; pending timers and dismissal promises are canceled on restart or VR exit.

XR intro and ending boards are children of the XR camera, centered at local
`(0, 0, -1.9)` metres, with a 1.45 m square viewing surface. No player-eye height,
dolly height or calibration changes were introduced for UI placement. Rich DOM
text, emphasis and colors are shared with desktop. The measured layout wraps the
complete card inside its bounds, scales only when necessary, and reserves its
continue/exit cue space so later cues do not move earlier text. HTML indentation
is collapsed like ordinary HTML, while non-breaking word groups remain together.

Gameplay guidance has its own transparent XR canvas at camera-relative
`(0, 0.38, -1.65)`, separate from lower narrative at `(0, -0.35, -1.65)`.
Instructions are plain text with a light shadow and no rectangle. Dialogue uses a
single compact, translucent pane with a small speaker label and warm left border;
thoughts remain italic and unboxed. Fonts and colors match the desktop design.
Short VR dialogue panes fit their content instead of spanning the whole board.
Sewing and stamina retain their established distinct progress indicators.

Desktop hints likewise sit at the top without a box. The lower caption stack now
contains only thought and dialogue. Guidance clears when actions change phase,
when an interaction is used, when walking instructions are understood, or when
leaving a scene. Successful physical feeding hides its instruction after the
initial movement, while idle reminders remain available. Repeated current hints
do not restart their lifetime. Hover labels are suppressed while instructions or
an active press already explain the action. On-screen debug counters are removed;
explicit developer console/debug controls remain available.

`npm run audit:text` checks compiled active/legacy UI sources, HTML/CSS, procedural
text-rendering code and the rebuilt browser bundle for em dashes, excluding source
comments and the defensive text sanitizer. Captions, hints, prompts and errors also
pass through that sanitizer. Existing punctuation was rewritten without changing
story meaning. The generated workshop ledger label was corrected too.

Verification commands:

- `npm run test:presentation`: exact copy/title, complete desktop layouts at 1280,
  800 and 390 px, body-first fade/title hold, title centering, scene transition,
  bounded XR canvas layouts, distinct guidance/narrative layers and hint cleanup.
- `npm run test:presentation:vr`: actual IWER Quest session, initial origin/yaw
  offset, tracked heights from 0.9 to 2.1 m, unchanged player eye height, intro fade
  order, gameplay transition, separate upper guidance/lower narrative, complete
  ending layout and session exit.
- UI, scene asset/interaction and VR re-entry suites cover the existing gameplay.

Rendered desktop and XR canvas PNGs are written to the system temporary
`tlwh-tests/` directory for visual inspection. Actual Meta Quest hardware is still
needed to confirm subjective reading comfort, optical scale and contrast in both
eyes. The alignment and timing checks above use browser/Quest emulation.

The inline-title revision is checked with rendered desktop screenshots and native
XR canvas captures before, during and after title movement. Tests require visible
paragraphs and the red inline phrase before continuing, intermediate title growth,
a centered hold, a final fade before play and ignored repeated desktop starts.
The XR board remains at the same camera-local depth throughout.

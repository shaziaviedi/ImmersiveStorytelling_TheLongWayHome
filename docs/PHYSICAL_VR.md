# Physical VR sewing and begging

Scene/state ownership, desktop interactions, animation, audio and story callbacks
remain in the existing scene modules. Shared tracking is sampled by `XRRig` before
scene updates and published as `ctx.xrInput`. Head and grip poses must be tracked;
visibility loss suspends manipulation. Hands are mapped using WebXR handedness,
not assumed device indices. Bag squeeze actions are suppressed only during these
two physical tasks. These stationary actions disable stick snap-turns until the
stick returns to neutral, so a stick cannot create artificial feed movement or
rotate the calibrated begging posture. Normal turning returns afterward.

`src/systems/physical/sewing.mjs` owns the controller-driven cloth state. An open-to-
closed squeeze edge within 18 cm grabs the visible cloth; remote or pre-held grips
do not. The same realistic mesh and selected material stay owned by the original
moving piece and completion pile. The cloth follows a grip-relative positional and
rotational offset within the workstation. Table support and a front-approach barrier
keep it outside the raised machine body. Alignment within roughly 7.5 cm horizontally
and 6.5 cm vertically introduces the guided presser-foot path. Forward displacement
feeds 34 cm of cloth; time, stationary grips, reverse movement and repeated jitter do
not add progress. The feed path stays level beneath the arm; pulling substantially
aside/above it pauses progress. Tracking jumps or releases leave the cloth on its
support, requiring a fresh nearby grip. Completion uses the existing fold animation,
quota, dreams, bell, standing, wages and exit sequence. The desktop timer is gated
out of XR, and XR ray targets cannot pick/sew.

`src/systems/physical/begging.mjs` detects the requested posture. It uses the standing
tracked head reference captured during normal VR height calibration, together with
both controllers' height and extension relative to the current head position and
the forward axis captured at the beginning of the section. Looking around does
not cancel an otherwise valid pose.
Required head lowering scales with body height (22–34 cm); forward extension scales
roughly 20–29 cm. Both hands must be tracked, separated, lower than the standing
reference and in front of the player. The head drop corroborates controller lowering,
preventing ordinary standing users from triggering by dropping their hands. The pose
must remain valid for 0.8 seconds. Lost posture/tracking clears confirmation and
pauses begging time; the old automatic XR timeout cannot bypass the action. Dialogue
and the 13-second begging narrative still use the accumulated valid hold time.

A faint ring near the carton indicates confirmation. VR does not translate the
player into a canned sitting pose or lower the virtual eye setting. Height reset is
blocked only while this posture is active. After begging, the player can rise at
their own pace or hold both triggers to continue seated. That deliberate alternative
recalibrates the normal child eye height for subsequent play. Stop/reset/session exit
clear posture locks and confirmation state. No other scene requires real sitting.

Accessibility is explicit: a persisted Settings option allows either tracked trigger
without requiring the default posture, including one-controller users. During this
section, a deliberate 1.2-second two-trigger hold also chooses that alternative;
it is then confirmed briefly before begging begins. The desktop E equivalent remains.
Sitting can use a stable chair; floor sitting and fast movements are unnecessary.

Tests include pure logic (stationary buttons, distant/pre-held grip, placement,
reverse/jitter, release/re-grab, machine bounds, tracking loss, short/tall users and
shifted tracking origins, confirmation and accessible input), focused actual IWER
Quest tracking, and existing desktop factory/market regressions. Full VR walkthrough
helpers now physically feed cloth; their later story traversal uses the explicit
begging alternative, while the focused suite tests actual seated posture.

Physical-headset validation remains necessary: controller/virtual-palm offset,
comfortable reach to the pile and full feed stroke, presser-foot clearance from both
eyes, short/tall and seated users, posture thresholds, tracking/recenter recovery,
and frame rate on the target Quest. Head/controller tracking infers a seated posture;
it cannot distinguish contact with a chair from a similarly lowered crouch. These
are constrained rigid-cloth interactions, not a deformable fabric simulation.

Verification completed locally: physical-action logic tests; focused IWER Quest
sewing/begging with standing-height calibration, release/re-grab, posture pause,
upright return, persisted accessibility setting and the deliberate trigger chord;
Normal/Extra desktop factory and market tests; repeated VR exit/re-entry and desktop
return; Home XR render/exit; responsive UI/caption checks; production build and
syntax/whitespace checks. No runtime errors or XR framebuffer warnings were reported
by those runs. Actual Meta Quest hardware was not available for validation.

Home interaction consistency: serving after a physical plate placement keeps the XR
rig stationary; the automatic table approach remains desktop-only. Close-eyes grip
state is cleared on scene reset/exit and is ignored by desktop input. Focused food
continuity tests assert the stable rig, while Home asset tests assert input cleanup.

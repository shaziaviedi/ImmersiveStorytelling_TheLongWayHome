import { readCompleteFile } from '../../tools/read-complete-file.mjs';

// Some local file providers briefly return an empty read while hydrating a file.
// Never silently install an empty XR runtime and misreport WebXR as unavailable.
export async function readXRRuntime() {
  const file = new URL('../../node_modules/iwer/build/iwer.min.js', import.meta.url);
  return (await readCompleteFile(file)).toString('utf8');
}

// Continue through the same prologue and trigger gesture used by a headset player.
export async function continueVRPrologue(page) {
  await page.waitForFunction(() => {
    const rig = window.__tlwh?.xrRig;
    return rig?.endKind === 'prologue' && rig.endReady;
  }, null, { timeout: 120000 });
  await page.evaluate(() => window.__xrdev.controllers.right.updateButtonValue('trigger', 1));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__xrdev.controllers.right.updateButtonValue('trigger', 0));
}

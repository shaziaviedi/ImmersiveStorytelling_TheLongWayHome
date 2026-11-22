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

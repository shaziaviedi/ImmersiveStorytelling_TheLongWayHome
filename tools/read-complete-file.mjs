import fs from 'node:fs';
import { setTimeout } from 'node:timers/promises';

// Local file-provider hydration can temporarily return zero bytes for a nonempty
// file. Verify reads before executing test scripts or injecting their XR runtime.
export async function readCompleteFile(file) {
  for (let attempt=0; attempt<60; attempt++) {
    const expected=fs.statSync(file).size, data=fs.readFileSync(file);
    if (expected>0 && data.length===expected) return data;
    await setTimeout(500);
  }
  throw new Error(`Incomplete local file read: ${file}`);
}

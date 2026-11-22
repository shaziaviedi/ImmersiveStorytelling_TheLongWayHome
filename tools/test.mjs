import { spawn } from 'node:child_process';
import { context } from 'esbuild';
import { buildOptions } from './build-options.mjs';
import { readCompleteFile } from './read-complete-file.mjs';

const suites = {
  ui: [['dev/ui-test.mjs']],
  factory: [['dev/factory-assets-test.mjs']],
  home: [['dev/home-assets-test.mjs']],
  street: [['dev/street-assets-test.mjs']],
  chase: [['dev/chase-assets-test.mjs']],
  'home-vr': [['dev/home-vr-test.mjs']],
  atmosphere: [['dev/atmosphere-test.mjs']],
  'vr-extra': [['dev/vr-test.mjs', 'extra']],
  'vr-quit': [['dev/vr-quit-test.mjs']],
  vr: [['dev/vr-test.mjs', 'normal'], ['dev/vr-test.mjs', 'extra'], ['dev/vr-quit-test.mjs']],
};
const selected = process.argv.slice(2);
if (!selected.length || selected.some((name) => !suites[name])) {
  throw new Error('Choose a test suite: ' + Object.keys(suites).join(', ') + '.');
}

// Tests share a freshly built site on an isolated local port; no manually started server is needed.
const ctx = await context(buildOptions);
try {
  const { port } = await ctx.serve({ servedir: 'public', host: '127.0.0.1', port: 0 });
  const env = { ...process.env, TLWH_TEST_URL: `http://127.0.0.1:${port}` };
  for (const suite of selected) {
    for (const args of suites[suite]) {
      await readCompleteFile(new URL('../'+args[0],import.meta.url));
      const code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(signal ? 1 : code));
      });
      if (code !== 0) {
        process.exitCode = code || 1;
        break;
      }
    }
    if (process.exitCode) break;
  }
} finally {
  await ctx.dispose();
}

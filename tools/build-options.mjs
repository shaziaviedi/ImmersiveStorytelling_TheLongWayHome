import fs from 'node:fs';
import { createHash } from 'node:crypto';

// Both build commands use the same settings so a dev rebuild cannot change the shipped artifact.
export const buildOptions = {
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  banner: { js: '/*! The Long Way Home V3. Includes three.js (MIT License). */' },
  outfile: 'public/app.js',
  logLevel: 'info',
  plugins: [{
    name: 'version-browser-bundle',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length) return;
        const version = createHash('sha256').update(fs.readFileSync('public/app.js')).digest('hex').slice(0,16);
        const file = 'public/index.html', html = fs.readFileSync(file,'utf8');
        const updated = html.replace(/src="app\.js(?:\?v=[^"]*)?"/, `src="app.js?v=${version}"`);
        if (updated !== html) fs.writeFileSync(file,updated);
      });
    },
  }],
};

const esbuild = require('esbuild');
const path = require('path');

const outfile = path.join(__dirname, '..', 'xb.cjs');

esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'cli.cjs')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile,
  minify: true,
  format: 'cjs',
});

console.log(`Built: ${outfile}`);

import { build } from 'esbuild';

await build({
  entryPoints: ['src/entrypoint.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/entrypoint.js',
  external: ['better-sqlite3', '@sandbank.dev/db9'],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});

console.log('Build complete: dist/entrypoint.js');

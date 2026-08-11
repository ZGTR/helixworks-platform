import { build } from 'esbuild';
import process from 'node:process';

const [entryPoint, outputFile = '/workspace/app.mjs'] = process.argv.slice(2);
if (entryPoint === undefined || entryPoint.length === 0) {
  throw new Error('usage: node deploy/build-runtime.mjs <entrypoint>');
}

await build({
  entryPoints: [entryPoint],
  outfile: outputFile,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';const require=__createRequire(import.meta.url);",
  },
  external: ['@nestjs/*', 'reflect-metadata', 'rxjs', 'zod'],
});

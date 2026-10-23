const { build } = require('esbuild');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

async function main()
{
  const file = join(__dirname, '../node_modules/.cache/bilibili-dm/videoToolkit.test.cjs');
  await build({ entryPoints: [join(__dirname, 'videoToolkit.test.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: file });
  const result = spawnSync(process.execPath, ['--test', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
main().catch(err => { console.error(err); process.exitCode = 1; });

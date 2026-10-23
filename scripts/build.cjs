const { build } = require('esbuild');
const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['koishi', '@koishijs/plugin-console', '@koishijs/plugin-notifier', '@koishijs/plugin-server'],
  sourcemap: true,
  metafile: true,
}).then(result =>
{
  const roots = new Set(Object.keys(result.metafile.inputs)
    .map(file => file.replaceAll('\\', '/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)/)?.[1])
    .filter(Boolean));
  const notices = [];
  for (const root of [...roots].sort())
  {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const files = readdirSync(root).filter(file => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file));
    notices.push(`${pkg.name}@${pkg.version}\nLicense: ${JSON.stringify(pkg.license || pkg.licenses || 'See source notices')}`);
    for (const file of files) notices.push(`${file}\n${readFileSync(join(root, file), 'utf8')}`);
  }
  writeFileSync('lib/THIRD_PARTY_NOTICES.txt', notices.join('\n\n--------------------\n\n'), 'utf8');
}).catch(err => { console.error(err); process.exitCode = 1; });

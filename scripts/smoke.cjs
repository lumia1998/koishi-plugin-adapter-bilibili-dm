const { mkdtempSync, realpathSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const pkg = require('../package.json');

const root = realpathSync(tmpdir());
const dir = realpathSync(mkdtempSync(join(root, 'bilibili-adapter-check-')));
const archive = resolve(__dirname, '..', `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`);
const run = (args, cwd) => {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command exited ${result.status}`);
};
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'adapter-production-check', private: true }));
  run([process.env.npm_execpath, 'install', archive, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], dir);
  run(['-e', `
    const fs = require('node:fs'), path = require('node:path');
    const entry = require.resolve('${pkg.name}');
    const api = require(entry);
    const methods = ['getVideoSubtitle','getVideoComments','getUserVideos','getRelatedVideos','createVideoComment','getFavoriteFolders','addVideoToFavorite','getCommentVisibility'];
    if (api.name !== 'adapter-bilibili' || methods.some(key => typeof api.Internal.prototype[key] !== 'function')) throw new Error('Incomplete runtime API');
    const client = path.resolve(path.dirname(entry), '../dist/index.js');
    if (!fs.readFileSync(client, 'utf8').includes('${pkg.name}')) throw new Error('Missing login client');
    process.stdout.write('Production-only package installation passed\\n');
  `], dir);
  const { readdirSync, readFileSync, existsSync } = require('node:fs');
  const lib = join(dir, 'node_modules', ...pkg.name.split('/'), 'lib');
  const pending = [lib];
  let count = 0;
  while (pending.length) {
    const folder = pending.pop();
    for (const file of readdirSync(folder, { withFileTypes: true })) {
      const target = join(folder, file.name);
      if (file.isDirectory()) { pending.push(target); continue; }
      if (!file.name.endsWith('.d.ts')) continue;
      count++;
      for (const ref of ts.preProcessFile(readFileSync(target, 'utf8')).importedFiles) {
        if (!ref.fileName.startsWith('.')) continue;
        const base = resolve(folder, ref.fileName).replace(/\.js$/, '');
        if (![base + '.d.ts', join(base, 'index.d.ts')].some(existsSync)) throw new Error(`Missing declaration ${ref.fileName} from ${target}`);
      }
    }
  }
  process.stdout.write(`Verified all relative imports in ${count} declaration files\n`);
} finally {
  if (dirname(dir) !== root || !basename(dir).startsWith('bilibili-adapter-check-')) throw new Error('Unexpected temporary directory');
  rmSync(dir, { recursive: true, force: true });
}

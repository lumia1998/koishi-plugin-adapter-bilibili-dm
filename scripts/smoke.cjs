const { mkdtempSync, realpathSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const { spawnSync } = require('node:child_process');
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
} finally {
  if (dirname(dir) !== root || !basename(dir).startsWith('bilibili-adapter-check-')) throw new Error('Unexpected temporary directory');
  rmSync(dir, { recursive: true, force: true });
}

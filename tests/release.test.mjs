import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, publicFiles } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('release allowlist includes every runtime import and supports project subdirectory hosting', async () => {
  const files = await publicFiles(root), set = new Set(files.map(file => file.replaceAll('\\', '/')));
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (url.startsWith('#') || /^https?:/.test(url)) continue;
    assert.ok(url.startsWith('./'), `relative resource required: ${url}`);
    assert.ok(set.has(url.slice(2)), `missing resource: ${url}`);
  }
  for (const file of files.filter(file => file.endsWith('.js'))) {
    const js = await readFile(path.join(root, file), 'utf8');
    for (const [, module] of js.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file.replaceAll('\\', '/')), module));
      assert.ok(set.has(target), `${file} imports unpublished ${target}`);
    }
  }
  assert.doesNotMatch(html, /<audio\b[^>]*\bsrc=/);
  assert.doesNotMatch(html, /朋友的酒|本地服务器|项目目录|固定曲目/);
  assert.ok(files.includes('LICENSE') && files.includes('NOTICE.md'));
  assert.ok(files.every(file => !/\.(m4a|mp3|wav|ogg|aac|flac|opus)$/i.test(file)));
  assert.ok(files.every(file => !/^(local-media|artifacts|tests|scripts)[\\/]/.test(file)));
});

test('rebuilding the release removes stale private audio and copies only public files', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'buffalo-release-'));
  try {
    for (const name of ['src', 'assets', 'local-media', 'artifacts', 'dist']) await mkdir(path.join(fixture, name));
    for (const name of ['index.html', 'LICENSE', 'NOTICE.md', 'src/app.js', 'src/style.css', 'assets/icon.svg', 'local-media/private.m4a', 'assets/private.mp3', 'dist/old-song.mp3', 'artifacts/private.png', '.env', 'server.mjs']) await writeFile(path.join(fixture, name), name);
    const result = await build(fixture);
    assert.equal(result.count, 7);
    assert.ok(result.bytes > 0);
    const contents = await readdir(result.output, { recursive: true });
    assert.ok(contents.includes('index.html'));
    assert.ok(contents.includes('.nojekyll'));
    assert.ok(contents.includes('LICENSE'));
    assert.ok(contents.every(file => !/private|old-song|server|\.env/.test(file)));
    assert.equal(await readFile(path.join(fixture, 'local-media/private.m4a'), 'utf8'), 'local-media/private.m4a', 'source music stays private and intact');
  } finally {
    const parent = path.resolve(os.tmpdir()), resolved = path.resolve(fixture);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith('buffalo-release-'));
    await rm(resolved, { recursive: true, force: true });
  }
});

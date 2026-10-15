import { copyFile, lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const rootFiles = ['index.html', 'LICENSE', 'NOTICE.md'];
const extensions = { src: new Set(['.js', '.css']), assets: new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2']) };

export async function publicFiles(root = sourceRoot) {
  const files = [...rootFiles];
  for (const folder of ['src', 'assets']) {
    const walk = async relative => {
      for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const name = path.join(relative, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`发布文件不能是符号链接：${name}`);
        if (entry.isDirectory()) await walk(name);
        else if (entry.isFile() && extensions[folder].has(path.extname(entry.name).toLowerCase())) files.push(name);
      }
    };
    await walk(folder);
  }
  return files.sort();
}

export async function build(root = sourceRoot) {
  const resolvedRoot = path.resolve(root), output = path.resolve(resolvedRoot, 'dist');
  const rootInfo = await lstat(resolvedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('项目根目录必须是普通目录。');
  // Deletion is restricted to the checked absolute dist path; junctions and
  // symbolic links at either directory boundary are never traversed.
  if (path.relative(resolvedRoot, output) !== 'dist') throw new Error('发布目录必须位于项目内的 dist。');
  const existing = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error('dist 不是项目内的普通目录，停止构建。');
  const files = await publicFiles(resolvedRoot);
  for (const relative of files) {
    const info = await lstat(path.join(resolvedRoot, relative));
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`发布文件必须是普通文件：${relative}`);
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output);
  let bytes = 0;
  for (const relative of files) {
    const target = path.join(output, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(resolvedRoot, relative), target);
    bytes += (await lstat(target)).size;
  }
  await writeFile(path.join(output, '.nojekyll'), '');
  return { output, count: files.length + 1, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await build();
  console.log(`发布版已生成：${result.output}\n${result.count} 个文件，${(result.bytes / 1024).toFixed(1)} KiB。`);
}

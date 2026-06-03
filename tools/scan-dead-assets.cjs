#!/usr/bin/env node
/**
 * 扫描死文件：把根目录 + assets/ 下所有 png/jpg/glb/mp3/mp4/woff2/ttf/css/js
 * 跟代码里实际引用的字符串比对，列出 0 引用的死文件。
 *
 * 比对源（代码文件）:
 *   - index.html
 *   - app.js
 *   - directory_v2.js
 *   - style_v5.css
 *   - bgm.js / share.js / share-html.js / report.js（这些是 index.html script 标签引入的，也扫一下）
 *
 * 用法：node tools/scan-dead-assets.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ---------- 1. 收集所有候选资源文件（带相对路径 + 大小） ----------
const RESOURCE_EXT = /\.(png|jpg|jpeg|webp|glb|mp3|mp4|woff2?|ttf|css|js)$/i;

function walk(dir, baseDir = ROOT, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tools' || e.name === 'draco' || e.name === 'videos') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // _pano_backup 直接列为死目录，不递归
      if (e.name === '_pano_backup') {
        results.push({ rel: path.relative(baseDir, full).replace(/\\/g, '/') + '/', size: dirSize(full), isDir: true });
        continue;
      }
      walk(full, baseDir, results);
    } else if (RESOURCE_EXT.test(e.name)) {
      const stat = fs.statSync(full);
      results.push({
        rel: path.relative(baseDir, full).replace(/\\/g, '/'),
        size: stat.size,
        isDir: false,
      });
    }
  }
  return results;
}

function dirSize(dir) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) total += dirSize(full);
      else total += fs.statSync(full).size;
    }
  } catch (_) {}
  return total;
}

// ---------- 2. 收集代码文件里所有可能的引用字符串 ----------
const SOURCE_FILES = [
  'index.html',
  'app.js',
  'directory_v2.js',
  'style_v5.css',
  'bgm.js',
  'share.js',
  'share-html.js',
  'report.js',
];

let codeBlob = '';
for (const f of SOURCE_FILES) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) {
    codeBlob += '\n/* === ' + f + ' === */\n' + fs.readFileSync(full, 'utf8');
  } else {
    console.warn('  [warn] 源文件不存在:', f);
  }
}

// ---------- 3. 比对：用文件 basename 在 codeBlob 里搜索 ----------
function isReferenced(rel) {
  const basename = path.basename(rel);
  // 直接搜文件名（含扩展名）就够了；同名风险对当前项目可忽略
  return codeBlob.includes(basename);
}

// ---------- 4. 跑扫描 ----------
const all = walk(ROOT);
const dead = [];
const alive = [];

for (const item of all) {
  if (item.isDir) {
    // 目录：默认是死的（_pano_backup 这种），单独标记
    dead.push(item);
    continue;
  }
  // 跳过本身就是源代码的几个 .js / .css / .html
  const basename = path.basename(item.rel);
  if (SOURCE_FILES.includes(basename) || basename === 'three.min.js') {
    alive.push(item);
    continue;
  }
  // three.js 配套（CopyShader/Bloom 等）也都被 index.html script 引入了
  // 但我们的 codeBlob 里有 index.html 内容，能搜到就是 alive，搜不到就是 dead
  if (isReferenced(item.rel)) {
    alive.push(item);
  } else {
    dead.push(item);
  }
}

// ---------- 5. 格式化输出 ----------
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

dead.sort((a, b) => b.size - a.size);
alive.sort((a, b) => b.size - a.size);

console.log('\n========================================');
console.log('  死文件扫描结果（0 引用，可安全删除）');
console.log('========================================\n');
let totalDead = 0;
for (const d of dead) {
  console.log(`  [${fmtSize(d.size).padStart(9)}]  ${d.rel}${d.isDir ? '  (目录)' : ''}`);
  totalDead += d.size;
}
console.log(`\n  合计可释放：${fmtSize(totalDead)}（${dead.length} 项）\n`);

console.log('========================================');
console.log('  存活文件（被代码引用，前 30 大）');
console.log('========================================\n');
for (const a of alive.slice(0, 30)) {
  console.log(`  [${fmtSize(a.size).padStart(9)}]  ${a.rel}`);
}
const totalAlive = alive.reduce((s, a) => s + a.size, 0);
console.log(`\n  存活合计：${fmtSize(totalAlive)}（${alive.length} 项）`);
console.log(`  全部资源：${fmtSize(totalAlive + totalDead)}（${alive.length + dead.length} 项）\n`);

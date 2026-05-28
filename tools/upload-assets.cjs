const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const secrets = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.codebuddy/secrets.json'), 'utf8'));
const token = secrets.TUPLOAD_TOKEN;
const tupload = path.resolve(__dirname, '../.codebuddy/skills/page-deploy/node_modules/.bin/tupload2');
const baseUrl = '/qqcdn/redian/sand_test';

const files = [
  'chandelier_compressed.glb',
  'broken_wine_glass_compressed.glb',
  'start.mp4',
  'carpet.mp4',
  // 旧的 4 段巴扎视频（保留兼容）
  'videos/tarbizV1.mp4',
  'videos/tarbizV2.mp4',
  'videos/tarbizV3.mp4',
  'videos/tarbizV4.mp4',
  // 拼接视频（已废弃但保留兼容）
  'videos/tabriz_full.mp4',
  // 新架构：5 段独立视频（每段头尾各砍 0.1s 去 AI 静帧+假推镜）
  'videos/tabrizV1_seg.mp4',
  'videos/tabrizV2_seg.mp4',
  'videos/tabrizV3_seg.mp4',
  // V3 3× 加速版（换文件名是为了破 mat1.gtimg.com 边缘缓存，原 tabrizV3_seg.mp4 缓存被锁死）
  'videos/tabrizV3_seg_3x.mp4',
  'videos/tabrizV4_seg.mp4',
  'videos/tabrizV5_seg.mp4',
  'draco/draco_decoder.js',
  'draco/draco_decoder.wasm',
  'draco/draco_wasm_wrapper.js',
];

const projectRoot = path.resolve(__dirname, '..');

for(const f of files){
  const fullPath = path.join(projectRoot, f);
  if(!fs.existsSync(fullPath)){ console.log('SKIP:', f); continue; }
  
  // tupload2 需要在文件所在目录执行，只传文件名
  const dir = path.dirname(fullPath);
  const fileName = path.basename(fullPath);
  // 远程路径的子目录
  const remoteSubdir = path.dirname(f).replace('.', '');
  const remotePath = remoteSubdir ? baseUrl + '/' + remoteSubdir + '/' : baseUrl + '/';
  
  const cmd = `"${tupload}" "${fileName}" -b "${remotePath}" --token "${token}" -y -f`;
  console.log('上传:', f, '→ mat1.gtimg.com' + remotePath + fileName);
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 60000, cwd: dir });
    console.log(out.trim());
  } catch(e) {
    console.log('ERROR:', (e.stdout || '') + (e.stderr || e.message));
  }
  console.log('---');
}

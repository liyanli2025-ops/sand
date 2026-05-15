// 分析 GLB 模型结构
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, '..', 'broken_wine_glass.glb');
const buf = fs.readFileSync(filePath);

// 解析 GLB header
const magic = buf.readUInt32LE(0);
if(magic !== 0x46546C67) { console.log('不是 GLB 文件'); process.exit(1); }
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);
console.log(`GLB v${version}, 总大小: ${(length/1024/1024).toFixed(2)} MB`);

// chunk 0: JSON
const chunk0Len = buf.readUInt32LE(12);
const chunk0Type = buf.readUInt32LE(16);
const jsonStr = buf.toString('utf8', 20, 20 + chunk0Len);
const gltf = JSON.parse(jsonStr);

console.log('\n=== 场景结构 ===');
console.log('scenes:', gltf.scenes?.length);
console.log('nodes:', gltf.nodes?.length);
console.log('meshes:', gltf.meshes?.length);
console.log('materials:', gltf.materials?.length);
console.log('accessors:', gltf.accessors?.length);

if(gltf.meshes){
  console.log('\n=== Mesh 列表 ===');
  gltf.meshes.forEach((m, i) => {
    const prims = m.primitives?.length || 0;
    let vertCount = 0;
    if(m.primitives){
      m.primitives.forEach(p => {
        if(p.attributes?.POSITION !== undefined && gltf.accessors){
          vertCount += gltf.accessors[p.attributes.POSITION]?.count || 0;
        }
      });
    }
    console.log(`  [${i}] "${m.name || '(unnamed)'}" primitives:${prims} verts:${vertCount}`);
  });
}

if(gltf.nodes){
  console.log('\n=== Node 列表 (前30个) ===');
  gltf.nodes.slice(0, 30).forEach((n, i) => {
    const hasMesh = n.mesh !== undefined ? ` → mesh[${n.mesh}]` : '';
    const children = n.children ? ` children:[${n.children.join(',')}]` : '';
    console.log(`  [${i}] "${n.name || '(unnamed)'}"${hasMesh}${children}`);
  });
  if(gltf.nodes.length > 30) console.log(`  ... 共 ${gltf.nodes.length} 个 nodes`);
}

if(gltf.materials){
  console.log('\n=== 材质列表 ===');
  gltf.materials.forEach((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const alpha = m.alphaMode || 'OPAQUE';
    console.log(`  [${i}] "${m.name || '(unnamed)'}" alpha:${alpha} doubleSided:${m.doubleSided || false}`);
  });
}

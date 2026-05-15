# GLTF 模型 BBox 居中经验指南

## 问题背景

在 Three.js 中加载 GLTF/GLB 模型后，通常需要用 `Box3.setFromObject()` 计算包围盒（bbox），然后用 bbox 中心做反向偏移来居中模型。但实际操作中经常出现 **模型视觉中心偏移** 的问题。

## 常见陷阱

### 1. 模型内含非主体物体

建模师导出的 GLTF 可能包含 **不属于主体的附加物体**：

| 类型 | 示例 | 影响 |
|------|------|------|
| 场景背景面板/地面 | `Plane417_Metal_Satin_0`（658×1725×658） | bbox 被撑到数千单位，center 严重偏移 |
| 放错位置的零件 | `Crystal_yzor3_081`（center.x = 2254） | 离群点把 center 拉偏到远处 |
| 掉落到远处的小零件 | `Crystal_Sphere_small_003`（center.y = -860） | 同上 |

**这些物体 `visible=true`，名字看起来也正常**，所以 `setFromObject` 会把它们全部算进去。

### 2. `Box3.setFromObject` 会把灯光 position 也算进去

如果 Group 里除了 mesh 还添加了 Light，`setFromObject` 会把 Light 的 position 计入 bbox。

```javascript
// ❌ 错误：container 里有 DirectionalLight(30, 80, 40)，会拉偏 bbox
const bbox = new THREE.Box3().setFromObject(container);

// ✅ 正确：只遍历 mesh
container.traverse(o => {
  if(o.isMesh && o.visible && o.geometry){
    const b = new THREE.Box3().setFromObject(o);
    if(!b.isEmpty()) bbox.union(b);
  }
});
```

### 3. 排除离群点时阈值不能太激进

吊灯的金属臂（Line016, maxDim=447）是合法的吊灯部件，不能因为 >200 就排除掉。

## 推荐方案：中位数 + 距离阈值排除离群点

```javascript
// 第一遍：收集所有 mesh 的 bbox center
const meshInfos = [];
gltfScene.traverse(o => {
  if(o.isMesh && o.geometry){
    const b = new THREE.Box3().setFromObject(o);
    if(!b.isEmpty()){
      const c = new THREE.Vector3(); b.getCenter(c);
      meshInfos.push({ mesh: o, bbox: b, center: c });
    }
  }
});

// 第二遍：算中位数，排除距中位数过远的离群点
const xs = meshInfos.map(m => m.center.x).sort((a,b) => a - b);
const ys = meshInfos.map(m => m.center.y).sort((a,b) => a - b);
const zs = meshInfos.map(m => m.center.z).sort((a,b) => a - b);
const mid = Math.floor(meshInfos.length / 2);
const medX = xs[mid], medY = ys[mid], medZ = zs[mid];

const OUTLIER_DIST = 500; // 根据模型实际尺度调整
const bbox = new THREE.Box3();
for(const m of meshInfos){
  const dx = Math.abs(m.center.x - medX);
  const dy = Math.abs(m.center.y - medY);
  const dz = Math.abs(m.center.z - medZ);
  if(dx > OUTLIER_DIST || dy > OUTLIER_DIST || dz > OUTLIER_DIST){
    console.warn('排除离群零件:', m.mesh.name);
  } else {
    bbox.union(m.bbox);
  }
}

const center = new THREE.Vector3(); bbox.getCenter(center);
// 用 -center 偏移 gltfScene，再缩放到目标尺寸
```

## 为什么用中位数而不是均值？

均值容易被极端值拉偏（比如 x=2254 的零件直接把均值拉到上千），而**中位数天然抗离群值**。

## 调试技巧

加载模型后，先打印所有 mesh 的名称、center、size：

```javascript
gltfScene.traverse(o => {
  if(!o.isMesh || !o.geometry) return;
  const b = new THREE.Box3().setFromObject(o);
  const c = new THREE.Vector3(); b.getCenter(c);
  const s = new THREE.Vector3(); b.getSize(s);
  console.log(o.name, 'center:', c.x.toFixed(1), c.y.toFixed(1), c.z.toFixed(1),
              'size:', s.x.toFixed(1), s.y.toFixed(1), s.z.toFixed(1));
});
```

快速发现：
- **center 离其他 mesh 很远的** → 放错位置的零件
- **size 远大于其他 mesh 的** → 场景背景/地面面板
- **visible=false 但 setFromObject 仍计入的** → 隐藏辅助物体

## 检查清单

- [ ] 打印所有 mesh 的 center 和 size，确认没有离群点
- [ ] bbox 计算排除灯光（只遍历 mesh）
- [ ] 排除离群零件后，center 接近 (0,0,0) 或合理值
- [ ] 不同模型（如吊灯 vs 碎片）的居中逻辑保持一致
- [ ] 碎片/替换模型出现时，位置对齐到主体模型的世界空间位置

## 碎片材质：复用主体模型材质

碎片模型（如 broken_wine_glass.glb）自带的材质通常是灰色不透明的，和水晶吊灯的质感完全不同。

**错误做法**：手动设置 opacity、roughness、color 等参数去模拟玻璃 → 会覆盖原始反光效果，结果看起来像磨砂塑料。

**正确做法**：直接从主体模型的水晶 mesh 上克隆材质：

```javascript
// 从吊灯水晶 mesh 克隆材质
const crystalRef = mdlG.crystalMeshes[0];
if(crystalRef && crystalRef.material){
  const crystalMat = crystalRef.material.clone();
  crystalMat.side = THREE.DoubleSide; // 碎片很薄，需要双面渲染
  crystalMat.needsUpdate = true;
  // 赋给所有碎片
  shardScene.traverse(o => {
    if(o.isMesh) o.material = crystalMat;
  });
}
```

**优点**：
- 反光、颜色、粗糙度、金属度、环境贴图全部和主体一致
- 不需要猜参数

## 微尘粒子：避免方块

`THREE.PointsMaterial` 默认渲染 **方形点**（GL_POINTS）。在粒子较大时会出现明显的方块。

**解决方法**：使用高斯径向衰减纹理（圆形模糊光斑）：

```javascript
// 高斯衰减纹理
function makeGaussianTexture(){
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const half = size / 2;
  const grd = g.createRadialGradient(half, half, 0, half, half, half);
  grd.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// 用在 PointsMaterial 里
const mat = new THREE.PointsMaterial({
  map: gaussianTex,  // 关键：用模糊纹理
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
```

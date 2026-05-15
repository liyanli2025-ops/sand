# 粒子化 3D 模型制作指南

> 本文档是 sand-main 项目中"塞塔尔琴粒子化"全过程的经验沉淀，
> 用于后续把其它 GLB/GLTF 模型转成"粒子沙雕"时快速套用，避免踩同样的坑。
>
> 适用场景：把任意 3D 模型（乐器、雕塑、器物）渲染成 5 万~10 万颗粒子组成的"沙雕"，
> 支持飘动 → 聚合 → 沙雕态 → 散落 的全流程动画。

---

## 目录

1. [整体管线](#整体管线)
2. [模型采样：MeshSurfaceSampler 不够，要加权](#模型采样)
3. [区域识别：自适应阈值是关键](#区域识别)
4. [颗粒尺寸 vs 数量：两个不同维度](#颗粒尺寸-vs-数量)
5. [颜色：让纹路真正可见](#颜色让纹路真正可见)
6. [Shader 光照：沙雕质感的核心](#shader-光照)
7. [前后区分：解决"空心"问题](#前后区分)
8. [Blending 切换：Additive vs Normal](#blending-切换)
9. [旋转动画：避免对称错觉](#旋转动画)
10. [常见踩坑清单](#常见踩坑清单)
11. [新模型上手 checklist](#新模型上手-checklist)
12. [调参速查表](#调参速查表)

---

## 整体管线

```
GLB 文件
   │
   ├─ ① 加载 + 合并多 mesh   →   单个 BufferGeometry
   │
   ├─ ② 倾斜 / 归一化         →   摆正姿态、统一尺度
   │
   ├─ ③ MeshSurfaceSampler   →   按表面积均匀撒点（基础采样）
   │     + 高度加权          →   关键焦点区（琴头）密度提升
   │
   ├─ ④ 区域识别             →   每个粒子分到 琴箱/琴颈/琴头/装饰带 等
   │
   ├─ ⑤ 颜色 / 大小 / 法线   →   写入 BufferAttribute
   │
   └─ ⑥ Shader 渲染          →   Lambert + 高光 + Rim + 前后区分
```

**核心思想**：
- **CPU 端**决定"哪个粒子代表什么部位、用什么色"——细节
- **GPU 端**决定"光照、明暗、轮廓"——质感

---

## 模型采样

### 基础采样：MeshSurfaceSampler

```js
const sampler = new THREE.MeshSurfaceSampler(mesh).build();
sampler.sample(_tmpP, _tmpN);  // 表面积加权，自动均匀
```

但**直接均匀采样会出问题**：
- **小部件丢失**：表面积小的部位（琴头、装饰旋钮）只分到几粒
- **重要焦点稀疏**：用户的视觉焦点（人脸、琴头）反而粒子最少

### 解决方案：4× 超采样 + 区域加权

```js
const SAMPLE_N = COUNT;
const OVER_N = SAMPLE_N * 4;        // 先采 4 倍候选

// 第一遍：按表面积均匀采 OVER_N 个候选
for(let i=0; i<OVER_N; i++){
  sampler.sample(_tmpP, _tmpN);
  candP[i*3]   = _tmpP.x;
  ...

  // 关键：根据位置计算权重
  const yRel = (_tmpP.y + by) / (2*by);  // 0~1
  let weight = 1.0;
  if(yRel < 0.38)      weight = 4.5;   // 琴箱（主体重量）
  else if(yRel < 0.55) weight = 1.8;   // 过渡区
  else if(yRel < 0.78) weight = 1.0;   // 琴颈
  else if(yRel < 0.90) weight = 6.0;   // 弦轴过渡
  else                 weight = 9.0;   // 琴头（焦点）
  candWeight[i] = weight;
}

// 第二遍：按权重做带概率重采，最终拿到 SAMPLE_N 个粒子
const cumW = ... // 前缀和
for(let i=0; i<SAMPLE_N; i++){
  const r = Math.random() * totalW;
  // 二分找位置
  ...
}
```

### 经验值

| 模型类型 | 焦点区权重建议 |
|---|---|
| 乐器：琴头/弦轴 | **×6 ~ ×9** |
| 雕像：人脸/手部 | **×8 ~ ×12** |
| 容器：把手/壶嘴 | **×4 ~ ×6** |
| 主体（琴箱/躯干/瓶身） | **×3 ~ ×5** |
| 一般部位 | **×1**（基准） |

**经验法则**：**视面积（屏幕投影）越小的焦点，权重要越大**——给 ×9 才能让琴头看起来"有形"。

---

## 区域识别

### 核心问题：硬编码阈值会失效

```js
// ❌ 错误做法：写死除数
const yNorm = py / 65;           // 假设模型高度是 ±65
if(yNorm > 0.7) // 琴头判定
```

如果模型实际高度是 ±30，`py/65` 永远在 ±0.46，**琴头判定永不成立**！
你写的所有"琴头放大、染金"逻辑全部静默失效。

### 正解：自适应归一化

```js
// 第一遍扫描：求真实 Y 范围 + 最大半径
let minPY = Infinity, maxPY = -Infinity, maxR = 0;
for(let i=0; i<N; i++){
  const py = points[i*3+1];
  const dx = points[i*3], dz = points[i*3+2];
  if(py < minPY) minPY = py;
  if(py > maxPY) maxPY = py;
  const r = Math.hypot(dx, dz);
  if(r > maxR) maxR = r;
}

// 自适应基准
const halfH = Math.max(1, (maxPY - minPY) * 0.5);
const midY  = (maxPY + minPY) * 0.5;

// 第二遍：归一化到 -1~+1，阈值跟模型尺寸无关
for(let i=0; i<N; i++){
  const yNorm   = (py - midY) / halfH;       // 高度位置
  const radialN = Math.hypot(px, pz) / maxR; // 离中轴的相对距离
  ...
}
```

### 阈值约定（以塞塔尔为例）

| 区域 | yNorm | radialN | 含义 |
|---|---|---|---|
| 琴箱 | < -0.30 | — | 模型下 35% |
| 琴箱赤道装饰带 | < -0.30 | > 0.78 | 离中轴最远的环带 |
| 琴箱底部 | < -0.30 | — + ny<-0.25 | 法线朝下 |
| 琴颈 | -0.30 ~ 0.55 | > 0.35 | 杆身 |
| 弦区 | -0.10 ~ 0.55 | < 0.35 | 中央细圆柱（4 根弦） |
| 琴头 | > 0.55 | — | 模型上 22% |

**通用原则**：
- 用 `yNorm` 划分**主结构层级**
- 用 `radialN` 划分**装饰区域**（赤道、中轴）
- 用 **`ny`（法线 y 分量）** 区分**底面/顶面**（法线朝下/朝上）
- 用 **`Math.atan2(pz, px)`** 做**周向纹路**（花瓣、镶嵌）

### 诊断日志（调参必备）

```js
let cntHead=0, cntBody=0, cntNeck=0, cntString=0;
// ... 在每个分支末尾 cntXxx++

console.log('[模型 区域分布]',
  'py范围:', minPY.toFixed(1), '~', maxPY.toFixed(1),
  ' 琴头:', cntHead, ' 琴颈:', cntNeck,
  ' 琴箱:', cntBody, ' 弦区:', cntString,
  ' 总:', N);
```

**判断标准**：每个区粒子数应该和你"想看到的视觉权重"成正比。
如果某区是 0 或几百 → 阈值错了，必须改。

---

## 颗粒尺寸 vs 数量

这是两个**完全不同**的维度，调一个不会替代另一个：

| 调整 | 效果 | 代价 |
|---|---|---|
| **颗粒尺寸 ↑** | 单粒变大，能"补"密度不足 | 远看像"补丁"、细节糊 |
| **粒子数量 ↑** | 真正提升分辨率，细节清晰 | GPU 负担大 |

### 经验比例

| 部位 | 推荐尺寸 |
|---|---|
| 琴箱普通面 | 0.18~0.32 |
| 琴箱装饰亮花瓣（凸起感） | **0.40~0.58** |
| 琴箱装饰暗花瓣（凹陷感） | 0.22~0.32 |
| 琴颈杆身 | 0.26~0.58 |
| 品格亮带（金属凸条） | 0.34~0.48 |
| 琴头 | **0.55~1.14** |
| 琴头顶端弦轴帽 | **0.80~1.77** |
| 弦本身（细丝） | 0.20~0.30 |

**关键原则**：
- 焦点区域（琴头）= 数量 ×9 + 尺寸 ×3 → **双重保障**
- 尺寸差是"浮雕感"的来源（亮处大、暗处小）

---

## 颜色：让纹路真正可见

### 核心陷阱

**仅靠 `vColor` 的色差是不够的**，因为：
1. Sprite 内部明暗会乘到所有粒子上 → 颗粒中心变暗
2. Lambert 光照会进一步压扁色差
3. **高光（hotSpot）如果不乘 vColor，会把色差洗掉**

### 让色差跳出来的 3 个原则

#### ① 拉到 2~3 倍亮度差

| ❌ 不够 | ✅ 够 |
|---|---|
| 亮处 ×1.20 / 暗处 ×0.78 | 亮处 ×1.45 / 暗处 ×0.72（**接近 2 倍**）|
| 装饰带 R=0.74 vs 0.48 | 装饰带 R=**1.05 vs 0.42**（**2.5 倍**）|

#### ② 同时让"颗粒大小"参与表达

```js
if(motif > 0.3){
  // 亮花瓣：金色 + 大颗粒（浮雕凸起）
  colors[i*3] = 1.05 * base;
  sizes[i] = 0.40 + Math.random()*0.18;
} else {
  // 暗花瓣：深棕 + 小颗粒（凹陷嵌缝）
  colors[i*3] = 0.42 * base;
  sizes[i] = 0.22 + Math.random()*0.10;
}
```

亮 + 大、暗 + 小 → **不靠光照也能看见纹路**。

#### ③ 高光必须乘 vColor

```glsl
// ❌ 错：纯暖白覆盖，深色花纹被洗白
sculptCol += uLightColor * hotSpot * 0.85;

// ✅ 对：保留花纹色差
sculptCol += vColor * uLightColor * hotSpot * 1.4;
```

### 周期性纹路的生成模式

| 纹路类型 | 公式 |
|---|---|
| 横向条纹（品格） | `Math.sin(py * 5.2)` |
| 周向花瓣（n 瓣） | `Math.sin(Math.atan2(pz, px) * n)` |
| 螺旋纹 | `Math.sin(py * a + Math.atan2(pz, px) * b)` |
| 不规则颗粒抖动 | `0.88 + Math.random() * 0.20` |

**经验**：取 `> 0.3` 或 `> 0.4` 作为阈值，让亮纹只占 1/3 比例（避免亮带太密）。

---

## Shader 光照

### 整体框架：Half-Lambert + 强对比

```glsl
// 1. 把模型法线转到世界空间（这样旋转模型时光方向不跟着转）
vec3 worldNrm = normalize(mat3(modelMatrix) * nrm);
vNDotL = dot(worldNrm, normalize(uLightDir));

// 2. Half-Lambert：避免背面纯黑，保留细节
float lambert = vNDotL * 0.5 + 0.5;  // 0~1

// 3. smoothstep 强化对比（雕塑感）
float lit = smoothstep(0.15, 0.85, lambert);

// 4. 暗面、亮面分别上色
vec3 sandShadow = vColor * uShadowColor * 5.0;
vec3 sandLit    = vColor * uLightColor * (uAmbient + lit * 2.6);
vec3 sculptCol  = mix(sandShadow, sandLit, lit);

// 5. 高光双层：宽幅亮 + 峰值超亮
float hotSpotBroad = smoothstep(0.55, 1.0, lambert);
float hotSpotPeak  = pow(smoothstep(0.78, 1.0, lambert), 2.0);
sculptCol += vColor * uLightColor * hotSpotBroad * 1.1;
sculptCol += vColor * uLightColor * hotSpotPeak  * 1.4;
```

### Uniform 调参参考

| Uniform | 推荐值 | 含义 |
|---|---|---|
| `uLightDir` | (0.78, 0.62, 0.15) | 右上侧光，z 小=更"侧"，旋转感强 |
| `uLightColor` | (1.0, 0.92, 0.75) | 暖白光（夕阳/室内灯）|
| `uShadowColor` | (0.18, 0.13, 0.09) | 暗面色（深暖棕）|
| `uAmbient` | 0.32 | 环境光（< 0.4 才有阴影感）|

**调整方向**：
- 想更"硬朗雕塑感" → smoothstep 区间更窄 `(0.25, 0.75)`
- 想更"柔和绘画感" → smoothstep 区间更宽 `(0.0, 1.0)`
- 想阴影更深 → `uAmbient` 降到 0.20，`uShadowColor` × 系数从 5.0 降到 3.5
- 想高光更耀眼 → `hotSpotPeak * 1.4` → `* 2.0`

### Sprite 自带 3D 球体明暗

每颗粒子的 sprite 贴图有 3D 球体的明暗梯度，乘到颜色上做"颗粒立体感"：

```glsl
float spriteShade = (tc.r + tc.g + tc.b) / 3.0;
float shadeFactor = mix(0.5 + 0.5 * spriteShade,  // 飘动态：保留 50% 亮度
                        0.4 + 1.0 * spriteShade,  // 沙雕态：完全用 shade
                        uSculpt);
col *= shadeFactor;
```

---

## 前后区分

### 问题：粒子云是空心的

模型本身有"前面"和"后面"（球壳的两层），粒子全部渲染会导致**前面的颜色和透过去的后面的颜色叠在一起**——旋转时分不清朝向。

### 解决：vNDotV（法线 vs 视线）

```glsl
// vertex shader 里算（注意：GLSL ES 1.00 没有 inverse()，必须用视图空间）
vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
vec3 viewNrm = normalize(normalMatrix * nrm);
vec3 viewDir = normalize(-mvPos.xyz);   // 粒子→相机
vNDotV = dot(viewNrm, viewDir);          // >0 正面, <0 背面
```

### Fragment shader 三层处理

```glsl
float facing = vNDotV;                              // -1 ~ +1
float backFade = smoothstep(-0.2, 0.5, facing);     // 0=后面, 1=前面

// 1. 背面降饱和（往灰色靠）+ 适度压暗，但不能压没（避免细颈消失）
float gray = (sculptCol.r + sculptCol.g + sculptCol.b) / 3.0;
sculptCol = mix(vec3(gray) * 0.50, sculptCol, 0.45 + 0.55 * backFade);

// 2. 轮廓 rim：n·v ≈ 0 的位置（侧面）打暖色边光
float rim = pow(1.0 - abs(facing), 3.0);
sculptCol += uLightColor * rim * 0.45;
```

**调参指南**：

| 现象 | 调参 |
|---|---|
| 背面太暗、细处消失 | `vec3(gray) * 0.50` 提高到 `0.65` |
| 背面区分不够明显 | 改成 `vec3(gray) * 0.30` |
| rim 边光太亮 | `* 0.45` → `* 0.25` |
| rim 边光太细 | `pow(..., 3.0)` → `pow(..., 2.0)` |

---

## Blending 切换

**关键**：粒子飘动态用 Additive，沙雕态用 Normal。

```js
// 在 animate 循环里
const sculptVal = particleMaterial.uniforms.uSculpt.value;
const wantBlend = sculptVal > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
if(particleMaterial.blending !== wantBlend){
  particleMaterial.blending = wantBlend;
  particleMaterial.depthWrite = (wantBlend === THREE.NormalBlending);
  particleMaterial.needsUpdate = true;
}
```

### 为什么必须切

- **Additive**：颜色相加。多个粒子重叠时**深色被亮色吃掉** → 深色花纹消失！
- **Normal + depthWrite**：颜色覆盖。正常前后遮挡 → 花纹保留。

**症状对照**：
- 沙雕态花纹再怎么深都看不见 → 一定是 Additive 没切走
- 飘动态显得"硬"、没有云雾感 → 一定是 Normal 没切回去

---

## 旋转动画

### 速度

```js
// 60fps 下，dt ≈ 1
points.rotation.y += 0.0070 * dt;
// = 0.42 rad/秒 = 15 秒一圈
```

| 速度 | 一圈用时 | 适用 |
|---|---|---|
| 0.0035 | 30 秒 | 太慢，常被误认为"不在转" |
| **0.0070** | **15 秒** | 推荐（清晰可感）|
| 0.0105 | 10 秒 | 较快，适合短停留场景 |

### 对称性陷阱

很多模型（瓶子、琴、杯子）**前后对称**，转 180° 看起来和 0° 一样 → 用户以为"只转了半圈又回去了"。

**破解办法**（任选一种或组合）：

1. **侧光**：让光从右上方打来（z 分量 0.15 而不是 0.30），正面/背面亮暗差大
2. **前后区分**：背面降饱和（见上一节）
3. **加快速度**：让用户能持续追踪方向
4. **打破对称**：模型本身就不对称（人物、动物）

### 状态机回弹

```js
const rotating = (mode === MODE.SCENE) &&
                 (sceneState === SCENE_STATE.HELD || sceneState === SCENE_STATE.FORMED);
if(rotating){
  points.rotation.y += 0.0070 * dt;
} else {
  // 非沙雕态：插值回 0，避免散落时姿态混乱
  points.rotation.y += (0 - points.rotation.y) * 0.03;
}
```

---

## 常见踩坑清单

### 🚨 坑 1：写死的归一化常数

**症状**：辛苦写了"琴头染金"代码，但完全看不到效果。
**原因**：`yNorm = py / 65` 但模型实际高度只有 ±30，琴头判定永不成立。
**修复**：用真实 bbox 算 `yNorm = (py - midY) / halfH`。

### 🚨 坑 2：高光把色差洗掉

**症状**：装饰带亮/暗对比拉到 3 倍仍然看不见花纹。
**原因**：`sculptCol += uLightColor * hotSpot * 0.85` 是纯暖白覆盖，色差被抹平。
**修复**：高光乘 vColor → `sculptCol += vColor * uLightColor * hotSpot * 1.4`。

### 🚨 坑 3：Additive Blending 吃掉深色

**症状**：沙雕态深色花纹完全看不见，越渲染越白。
**原因**：Additive 混合下颜色相加，深色被旁边亮色加进去消失。
**修复**：进入沙雕态时切到 NormalBlending + depthWrite=true。

### 🚨 坑 4：inverse() 不可用

**症状**：加了视线方向计算后，琴突然消失或全黑。
**原因**：GLSL ES 1.00（Three.js ShaderMaterial 默认）没有 `inverse()`。
**修复**：在视图空间算 `vNDotV`，用 `normalMatrix * nrm` 和 `-mvPos.xyz`。

### 🚨 坑 5：动画动效干扰主体

**症状**：琴颈中央总有一缕飘动的"沙流"破坏形态。
**原因**：旧代码里有 `roles=1~4 → 加 sin/cos 偏移` 的"弦振动"动效。
**修复**：删掉或注释掉弦振动代码，让弦区粒子静止。

### 🚨 坑 6：焦点区颗粒太细

**症状**：弦做得很细很美，但整个琴颈中央都变成虚线，不像实体。
**原因**：弦区粒子尺寸 < 0.15 → 远看就是烟。
**修复**：最小尺寸不低于 0.20，焦点区不低于 0.40。

### 🚨 坑 7：背面压得太狠

**症状**：细长部位（琴颈、塔尖）旋转到背面就完全消失。
**原因**：`vec3(gray) * 0.18` 把背面压到 18% → 细处直接看不见。
**修复**：保留 50% 亮度 `vec3(gray) * 0.50`，区分靠的是"色相变灰"而不是"亮度归零"。

### 🚨 坑 8：颗粒数量瓶颈

**症状**：单纯加大颗粒后焦点区还是稀疏。
**原因**：表面积小的部位采样阶段就没分到几粒。
**修复**：在 candWeight 阶段把焦点区权重 ×6 ~ ×9。

---

## 新模型上手 checklist

按这个顺序做，能避开 90% 的坑。

### Step 1：模型加载 + 摆正

- [ ] 加载 GLB，合并多 mesh 到一个 BufferGeometry
- [ ] 计算 bbox，找最长轴 → 必要时旋转模型让"高度方向"对齐 Y 轴
- [ ] 居中：让 bbox.center 落在 (0, 0, 0)
- [ ] 缩放到合适尺度（建议高度 30~80 单位）

### Step 2：基础采样

- [ ] 用 `MeshSurfaceSampler.build()` + 4× 超采样池
- [ ] 第一遍只算位置和法线，**先不加权**
- [ ] 用 `console.log` 输出几个采样点，确认坐标范围合理

### Step 3：识别区域

- [ ] **第一遍扫描**：求 `minPY/maxPY/maxR`，算 `halfH/midY`
- [ ] 划分区域：用 `yNorm/radialN/法线方向/方位角` 组合
- [ ] **加诊断日志**：每个区计数，确认每区都有合理数量的粒子

### Step 4：加权重采

- [ ] 按"想要的视觉权重"在 candWeight 里给焦点区 ×6~×9
- [ ] 主体区 ×3~×5，普通区 ×1
- [ ] 重新跑一遍，看日志数字是否符合预期

### Step 5：颜色 + 大小

- [ ] 主体米黄沙土底色（R 0.85, G 0.70, B 0.50 附近）
- [ ] 装饰区拉到 2~3 倍色差，**配合大小差**做浮雕
- [ ] 焦点区颗粒大幅放大（×2~×3 普通区）
- [ ] 弦/细线类不要小于 0.20

### Step 6：Shader 光照

- [ ] 引入 `uLightDir`（右上侧 0.78, 0.62, 0.15）
- [ ] Half-Lambert + smoothstep(0.15, 0.85)
- [ ] 暗面 ×5、亮面 ×2.6
- [ ] **高光乘 vColor**（必须！）

### Step 7：前后区分

- [ ] 在 vertex 算 `vNDotV` 传给 fragment
- [ ] 背面降饱和到 50% 亮度的灰
- [ ] 轮廓 rim light 0.45 强度

### Step 8：Blending 切换

- [ ] 飘动态 Additive，沙雕态 Normal + depthWrite
- [ ] 在 animate 里检测 `uSculpt > 0.5` 自动切换

### Step 9：旋转

- [ ] 速度 0.0070 * dt（15 秒一圈）
- [ ] 仅在沙雕态启用，其它状态插值回 0
- [ ] 检查模型是否前后对称，如对称 → 加强侧光

### Step 10：删掉残留动效

- [ ] 搜索 `roles[i]>=1` `roles[i]<=4` 等老动效代码
- [ ] 不需要的振动/脉动 → 直接删，避免干扰主体

---

## 调参速查表

### 想让 X 更明显，调 Y

| 想要的效果 | 调什么 |
|---|---|
| 琴头看不清 | 采样权重 `weight=9` + 颗粒尺寸 ×1.5 |
| 装饰花纹不明显 | 色差拉到 2.5 倍 + **高光乘 vColor** |
| 旋转方向感弱 | 速度 0.0070 + 侧光 z=0.15 |
| 前后分不清 | 背面降饱和 + rim light |
| 整体太亮发糊 | `uAmbient` ↓ + `uShadowColor` ×系数 ↓ |
| 整体太暗看不清 | `uAmbient` ↑ 0.45 + `hotSpotBroad` ↑ |
| 沙雕"硬度"不够 | smoothstep 区间窄 (0.25, 0.75) |
| 沙雕过于硬朗 | smoothstep 区间宽 (0.0, 1.0) |

### 一组开箱即用的"沙雕黄金参数"

```js
// Material uniforms
uLightDir:    new THREE.Vector3(0.78, 0.62, 0.15).normalize(),
uLightColor:  new THREE.Color(1.0, 0.92, 0.75),
uShadowColor: new THREE.Color(0.18, 0.13, 0.09),
uAmbient:     0.32,

// Shader 内
sandShadow = vColor * uShadowColor * 5.0;
sandLit    = vColor * uLightColor * (uAmbient + lit * 2.6);
hotSpotBroad: smoothstep(0.55, 1.0, lambert) → × 1.1
hotSpotPeak:  pow(smoothstep(0.78, 1.0, lambert), 2.0) → × 1.4
backFade:     mix(gray*0.50, color, 0.45 + 0.55*backFade)
rim:          pow(1.0 - abs(facing), 3.0) × 0.45

// 旋转
points.rotation.y += 0.0070 * dt;  // 15 秒一圈
```

---

## 文件位置参考（sand-main 项目）

| 功能 | 文件位置 |
|---|---|
| 模型加载 + 采样 + 加权 | `app.js` 第 28~290 行 |
| Shader 定义（particleMaterial） | `app.js` 第 476~590 行 |
| 区域识别 + 颜色/大小分配 | `app.js` `buildKamanchehFromModel()` 第 790~950 行 |
| Blending 切换 | `app.js` 第 1505~1511 行 |
| 旋转动画 | `app.js` 第 1781~1795 行 |

---

## 改名 / 复用建议

把这套管线套用到新模型时：

1. 复制 `loadKamanchehModel` → `loadXxxModel`，改 GLB 路径
2. 复制 `buildKamanchehFromModel` → `buildXxxFromModel`，改区域识别阈值
3. 区域颜色全部用 `vColor` 编码，**不要写在 shader 里**（保证 shader 通用）
4. shader 不用动（除非新模型有特殊材质需求）
5. 加诊断日志（必做！）

---

> **最后的箴言**：
>
> 调粒子模型的本质是"**让用户的眼睛能识别到形态和细节**"。
> CPU 端控形（区域、颜色、大小），GPU 端控质（光照、明暗、轮廓）。
> 任何看不清的问题都先问三件事：
> 1. **粒子数量**够不够？（看诊断日志）
> 2. **颗粒尺寸**对不对？（焦点不能 < 0.4，细线不能 < 0.2）
> 3. **色差**够不够？（亮/暗 < 2 倍 = 不够）
>
> 解决了这三件事，剩下的都是细节微调。

---

## 13. GLB 模型压缩与 CDN 部署

### 问题

原始 GLB 模型文件通常很大（本项目的 setar 模型为 **144.9 MB**），无法直接上传到 CDN（tupload 有 `maxBodyLength` 限制），用户加载也极慢。

### 解决方案：Draco 压缩

使用 Google 的 [Draco](https://google.github.io/draco/) 几何压缩，通过 `gltf-transform` CLI 工具一键完成：

```bash
# 安装（一次性）
npm install -g @gltf-transform/cli

# 压缩（输入 → 输出）
npx @gltf-transform/cli draco input.glb output_compressed.glb
```

**本项目实测**：151.93 MB → **3.87 MB**（压缩 97.5%）

### 运行时解码

Draco 压缩的 GLB 需要浏览器端的 **DRACOLoader** 配合 GLTFLoader 解码：

#### 1. 准备文件

| 文件 | 用途 | 来源 |
|------|------|------|
| `DRACOLoader.js` | Three.js 的 Draco 加载器 | `three/examples/js/loaders/DRACOLoader.js`（需匹配 three.js 版本） |
| `draco/draco_decoder.wasm` | WASM 解码器（约 280KB） | `three/examples/jsm/libs/draco/` |
| `draco/draco_wasm_wrapper.js` | WASM 胶水代码 | 同上 |
| `draco/draco_decoder.js` | 纯 JS 回退解码器 | 同上 |

#### 2. HTML 引入

```html
<script src="./three.min.js"></script>
<script src="./DRACOLoader.js"></script>  <!-- 必须在 GLTFLoader 之前 -->
<script src="./GLTFLoader.js"></script>
```

#### 3. JS 初始化

```js
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('./draco/');  // 指向 draco 解码器目录
const loader = new THREE.GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load('model_compressed.glb', (gltf) => { /* ... */ });
```

### CDN 部署注意事项

deploy 脚本会给 JS 文件加哈希后缀（如 `draco_wasm_wrapper.5900efae.js`），但 **DRACOLoader 内部按原始文件名请求**（`draco_wasm_wrapper.js`）。因此必须**同时上传未哈希化的原始文件**：

```bash
# deploy 脚本自动上传（带哈希）：
#   draco/draco_wasm_wrapper.5900efae.js  ← HTML 引用的版本
#   draco/draco_decoder.69b56a1d.js

# 还需手动上传（原始文件名）：
#   draco/draco_wasm_wrapper.js  ← DRACOLoader 运行时请求的版本
#   draco/draco_decoder.js
#   draco/draco_decoder.wasm
```

手动上传可用 `@tencent/tupload2` 包：

```js
const tupload = require('@tencent/tupload2');
await tupload.upload(localPath, cdnPath, { site, baseUrl, token });
```

### 压缩后的 GLB 也需要单独上传

`.glb` 不在 deploy 脚本的图片/JS/CSS 识别范围内，不会被自动上传。需要用同样方式手动上传到 CDN，然后在 `app.js` 中使用绝对 CDN 路径：

```js
const MODEL_URL = 'https://mat1.gtimg.com/qqcdn/redian/sand_test/model_compressed.glb';
```

### Checklist

- [ ] `gltf-transform draco` 压缩 GLB
- [ ] 准备 DRACOLoader.js + draco/ 解码器文件
- [ ] index.html 引入 DRACOLoader.js（在 GLTFLoader 之前）
- [ ] app.js 中注册 `dracoLoader.setDecoderPath()` 和 `loader.setDRACOLoader()`
- [ ] deploy 脚本部署 HTML/JS/CSS
- [ ] 手动上传：压缩 GLB + draco 原始文件名版本
- [ ] app.js 中 GLB URL 改为绝对 CDN 路径

---

## 14. CSS Bloom 辉光效果

### 背景

参考花朵粒子效果图，分析出拟真感的核心视觉层次：
1. 核心实体粒子（已有）
2. 高亮轮廓光 / rim light
3. 粒子发散云
4. **氛围辉光（bloom）**
5. 深黑背景反差

### 方案选择

#### ❌ Three.js EffectComposer + UnrealBloomPass（已放弃）

尝试过从 three@0.146.0（与项目 three.min.js 版本匹配）提取以下文件：
- `CopyShader.js`、`LuminosityHighPassShader.js`
- `ShaderPass.js`、`RenderPass.js`
- `EffectComposer.js`、`UnrealBloomPass.js`

**放弃原因**：`EffectComposer` 渲染到内部 renderTarget 时会覆盖 canvas 的 alpha 通道，导致 CSS 背景图（`.scene-bg`）被黑色遮挡。项目的视觉架构依赖 `alpha:true` 的透明 canvas 叠在 CSS 背景上，与 EffectComposer 的设计冲突。

#### ✅ CSS filter 模拟 bloom（当前方案）

在主 canvas 上方叠加一个辅助 canvas，用 CSS `mix-blend-mode:screen` + `filter:blur(8px) brightness(1.5)` 模拟辉光扩散。

**优点**：
- 零侵入 Three.js 渲染管线
- 不影响 canvas alpha 透明
- CSS 背景正常显示
- 性能可控（每 2 帧刷新一次）

**缺点**：
- 不是真正的高通过滤（无法只对亮部做 bloom）
- 效果不如 UnrealBloomPass 精确

### 实现

```js
// app.js — initBloom()
const bloomLayer = document.createElement('canvas');
bloomLayer.style.cssText = `
  position:fixed; inset:0; z-index:2;
  pointer-events:none; opacity:0;
  mix-blend-mode:screen;
  filter:blur(8px) brightness(1.5);
`;
document.body.appendChild(bloomLayer);

// 每 2 帧把主 canvas 内容复制到 bloom 层
function renderBloom(){
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(canvas, 0, 0);
}

// 渲染循环中根据 sculptVal 控制 bloom 层 opacity
// sculptVal > 0.5（沙雕态）→ opacity 渐变到 0.55
// 其他态 → opacity 渐变到 0
```

### 后续优化方向

如果需要更强的辉光效果，可以尝试：
1. **选择性 bloom**：用 `OffscreenCanvas` + WebGL 单独渲染亮部粒子，再叠加
2. **双 canvas 架构**：一个 canvas 专门渲染不透明的沙雕态（可以用 EffectComposer），另一个 canvas 渲染透明的地面/地图态
3. **shader 内 bloom 近似**：在 fragment shader 中对邻近 UV 采样模拟高斯模糊（性能开销大）

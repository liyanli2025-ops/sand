# 场景"美 → 崩坏"叙事制作指南

> 本文档是《聚不起的沙》项目里**玫瑰宫（场景 1）**完整制作流程的经验沉淀。
> 用于后续 5 个场景（塞塔尔、地毯、藏红花、细密画、穹顶）复用同一套"美 → 崩坏"叙事框架时快速对照。
> 主题：**进场展现"美" → 触发交互引发"破坏" → 视觉与文案双线推进遗憾感**。
>
> 更新日期：2026-05-16

---

## 目录

1. [整体设计哲学](#整体设计哲学)
2. [场景的五层结构](#场景的五层结构)
3. [视角：自动旋转引导](#视角自动旋转引导)
4. [全景烧灼层（核心视觉）](#全景烧灼层)
5. [文案叙事：双段制](#文案叙事双段制)
6. [完整时间线（玫瑰宫范本）](#完整时间线玫瑰宫范本)
7. [新场景接入 checklist](#新场景接入-checklist)
8. [踩坑清单](#踩坑清单)
9. [调参速查表](#调参速查表)

---

## 整体设计哲学

每个场景遵循 **"展示美 → 用户触发 → 见证破坏 → 留下遗憾"** 四步走。

核心原则：

- **美与破坏要分离**：进场文案只讲"美"，破坏文案只讲"遗憾"。两段文字侧重要鲜明对立，不要在进场就剧透破坏。
- **环境一起崩坏**：破坏不只是"主体物品（吊灯/琴/地毯）碎了"，全景图（整个空间）也要同步焦化、消融、归于黑暗——这样叙事张力才能从"一个物件被打坏"升级为"一段文明被擦掉"。
- **不可逆**：所有视觉变化都是单向推进的，不要做"焦化又恢复"的循环。最终定格在**全黑+文案+continue 提示**，让用户必须主动点击才进入下一场景。
- **冷调收尾**：避免使用鲜艳橙红（火焰色），与全景图整体暗调一致。烧灼是"消失"，不是"燃烧表演"。

---

## 场景的五层结构

每个场景由 5 层视觉元素组成，按渲染顺序由远到近：

| 层 | 半径 | renderOrder | 作用 | Three.js 对象 |
|---|---|---|---|---|
| 1. 全景图 skybox | — | (Three.js 内置最早) | 360° 环境贴图 | `scene.background = panoTex` |
| 2. 暗化蒙层 | r=1200 | -10 | 让全景图整体压暗 0.15~0.55 | `panoDimSphere`（BackSide MeshBasic） |
| 3. **烧灼层** | r=1190 | -9 | 崩坏时的焦化扩散覆盖 | `panoBurnSphere`（BackSide ShaderMaterial）|
| 4. 反光光点 | r=900 | -5 | 水晶/玻璃反光的随机闪烁 | `sparkleGroup`（Points + Shader）|
| 5. 主体模型 | 几十单位 | 默认 0 | 吊灯/琴/地毯等被破坏的主物 | GLTF 实体模型 |

**关键点**：

- 烧灼层比 dimSphere 略小（1190 vs 1200），保证它在 dimSphere 内侧渲染。
- 主体模型在原点附近，**永远在烧灼球壳内部**——所以烧灼只覆盖远处壁面，前景碎片不受影响。
- `scene.background` 是 Three.js 在所有 mesh 之前画的（不参与 renderOrder），所以烧灼层永远画在 background 之上 ✅。

---

## 视角：自动旋转引导

### 设计意图

进入场景的瞬间，用户面对一张静止的 360° 图片，不知道"还能转视角"。**自动慢速旋转**起到无声的提示作用：让画面持续在动，暗示"空间是 3D 的、可以拖动"。

### 实现要点

```js
// 全局状态
let autoRotateActive = false;
let autoRotateYaw = 0;
const AUTO_ROTATE_SPEED = 0.06;  // 弧度/秒（约 3.4°/s，绕一圈 ~105s）

// 进入 golestan 场景时启用
autoRotateActive = true;
autoRotateYaw = 0;

// 每帧累加（叠加在 targetYaw 上）
if(autoRotateActive && !dragging){
  autoRotateYaw += AUTO_ROTATE_SPEED * dt / 60;
}
const targetYaw = camYaw + PANO_YAW_OFFSET + autoRotateYaw;
```

### 关停时机（任一触发即停）

| 触发 | 处理 |
|---|---|
| 用户拖拽产生 > 4px 真实位移 | `pointermove` 里检测，关停 |
| 用户点击主体（触发崩坏） | `triggerCollapse` 入口关停 |
| 退出场景返回地图 | `cleanup` 函数关停 |

### 易错点

- **不要在 `pointerdown` 里关**：因为 tap（单击）也会触发 pointerdown，会让"用户单击吊灯"提前停掉自动旋转，造成"我还没看完空间就被切了"的体验。要在 `pointermove` 里检测 dx/dy > 4px 才关。
- **方向恒定**：始终 += SPEED，不要做来回摆动，否则像电脑死机。
- **每个场景都要重新启用**：在 `cleanup` 里复位为 false，下次 `enterScene` 重新启用。

---

## 全景烧灼层

### 整体方案

新建一个 `BackSide` 球壳 mesh，挂自定义 ShaderMaterial。**核心是 3D fbm 噪声**，按球面方向 `vDir`（normalize 后的顶点位置）采样，通过单参数 `uProgress` 控制焦化前线的扩散。

### 关键 shader 代码（伪）

```glsl
varying vec3 vDir;
uniform float uProgress;  // 0.05（起点，少量焦斑）→ 1.10（全黑）
uniform float uTime;

void main(){
  // 1. 用 3D 方向向量采样 fbm（避免 equirect uv 在两极/接缝处失真）
  vec3 p = vDir * 2.4;
  float n = fbm3(p + vec3(0.0, uTime * 0.03, uTime * 0.02));
  n += 0.22 * fbm3(p * 4.5 - vec3(uTime * 0.05, 0.0, uTime * 0.04));

  // 2. 让烧灼从穹顶（高处）向下蔓延：vDir.y > 0 的像素提前满足条件
  float topBias = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  float n2 = n - topBias * 0.30;

  // 3. burn=0 透明（露出原全景），burn=1 完全焦黑
  float burn = 1.0 - smoothstep(uProgress - 0.06, uProgress + 0.20, n2);

  // 4. 焦色：与全景图整体暗调一致（冷暗褐，无鲜艳橙红）
  vec3 charredCore = vec3(0.015, 0.012, 0.010);  // 近全黑冷褐
  vec3 charredEdge = vec3(0.085, 0.055, 0.040);  // 焦痕暗褐过渡
  vec3 col = mix(charredEdge, charredCore, burn);

  gl_FragColor = vec4(col, burn * 0.97);
}
```

### 几个关键设计决策（重要）

#### 决策 1：用 3D vDir 而不是 equirect uv 采样

❌ 错误：`vec2 uv = vec2(atan(vDir.z, vDir.x)/2π + 0.5, acos(vDir.y)/π); fbm2(uv);`

这会在两极看到明显的"墙纸感"（噪声在球面被拉伸成横向带状），毫无空间感。

✅ 正确：`vec3 p = vDir * 2.4; fbm3(p);`

3D 噪声在球面上每一点都是各向同性的，焦斑天然分布在球面、无接缝、有立体腐蚀感。

#### 决策 2：smoothstep 方向（最容易写反）

我们要的是：`uProgress` 增大 → 被覆盖（burn=1）的像素增多。

```glsl
// 正确写法（验证：uProgress=0 时 n2 ∈ [-0.3,1] 几乎都 > 0.20，smoothstep≈1，burn≈0 透明）
float burn = 1.0 - smoothstep(uProgress - 0.06, uProgress + 0.20, n2);
```

**踩坑**：第一版我写成 `smoothstep(uProgress - 0.18, uProgress + 0.04, n)`，结果 `uProgress=-0.2` 时几乎所有 n 都 > -0.16 → burn=1（全黑）开场，反向了。

### 决策 3：起点要 > 0

❌ `uProgress` 从 -0.2 开始 → 前 2 秒看不见任何焦斑（用户以为没触发）。

✅ `uProgress` 从 0.05 开始 → 一开始就有零星深褐色斑点，让用户立刻看出"烧起来了"。

### 决策 4：从穹顶向下蔓延

加 `vDir.y * 0.30` 的 topBias，让 vDir.y > 0 的像素 n2 偏小（提前满足条件）。物理上对应"穹顶被导弹打中、从上往下塌"。

### 决策 5：去掉橙红余烬

⚠️ 早期版本有一层 ember 橙红描边（`vec3(1.0, 0.40, 0.08)`）模拟"烧灼前线"，但视觉太鲜艳，与项目沉郁基调不符。**去掉**，让前线只是"颜色更暗的过渡带"。

### 进度推进曲线（time-based easing）

```js
const T = 7.0;  // 总时长 7s（比碎片动画 4~5s 稍长，碎片落定后空间继续焦化）
const burnElapsed = (performance.now() - _burnStartTime) / 1000;
const raw = Math.min(1, burnElapsed / T);
// 前 2/3 时间慢推（看清焦化过程），后 1/3 加速吞没（戏剧性收尾）
const eased = raw < 0.66
  ? raw * (0.56 / 0.66)
  : 0.56 + (raw - 0.66) * (1.0 - 0.56) / 0.34;
panoBurnSphere.material.uniforms.uProgress.value = 0.05 + eased * 1.05;
panoBurnSphere.material.uniforms.uTime.value = time * 0.001;
```

### 配套 dimSphere & sparkle 的让位

烧灼推进到一定程度时：

- **dimSphere**：`eased > 0.5` 后 opacity 从 0.15 → 0（避免两层透明叠加产生灰雾）
- **sparkle**：`eased ∈ [0.15, 0.40]` 同步淡出（水晶都碎了，反光自然消失）

```js
if(eased > 0.5){
  const t2 = (eased - 0.5) / 0.5;
  panoDimSphere.material.opacity = 0.15 * (1 - t2);
}
if(eased > 0.15){
  const sparkleFade = Math.max(0, 1 - (eased - 0.15) / 0.25);
  sparkleMat.uniforms.uOpacity.value = Math.min(
    sparkleMat.uniforms.uOpacity.value, sparkleFade
  );
}
```

---

## 文案叙事：双段制

每个场景需要**两段**完全不同语气的文字：

### 进场文案（突出"美"）

- **3~4 行**短句，全部围绕"这个东西多美/多有价值"展开
- **不剧透破坏**：不要出现"如今"、"曾经"、"已不再"等带遗憾色彩的词
- 给"美"一个**具体的感官**（光、声音、气味、触感），不要空喊"很美"
- 结尾留一个**安静的张力点**（用时间维度，比如"两百年来一直叫做镜厅"），为后续破坏铺垫

**玫瑰宫范例**：
```
卡扎尔王朝用十万面镜片铺满这座厅堂。
光从穹顶落下，被切成千万道，
让每一位来客都能从四面八方，看见自己。
两百年来，这里一直叫做——镜厅。
```

### 崩坏文案（突出"不可修复的遗憾"）

- **5 行**短句，烧灼期间逐行浮现
- 第 1 行：**确切时间锚点**（`day X` 或具体日期），让"美"变成"过去式"
- 第 2 行：**直接点破破坏来源**（导弹/火/水）
- 第 3 行：**用细节量化破坏**（呼应进场提到的具体数字/感官）
- 第 4 行：写一句**民间安慰**（"碎了可以再拼"），下一句用来打破它
- 第 5 行：**核心遗憾**——把"美"和"不可修复"绑死，最有力的一句留最后

**玫瑰宫范例**：
```
2026 年 3 月 20 日，诺鲁孜节。       ← 时间锚点（quiet）
一枚导弹穿过穹顶。                   ← 破坏来源
十万面镜片，一面接一面，碎在地上。   ← 量化（呼应进场"十万面"）
他们说，镜子碎了可以重拼。           ← 民间安慰（quiet，引子）
但有些光，碎了就再也照不回来了。     ← 核心遗憾（绑死"美"=光与"不可修复"）
```

### 数据结构

```js
{
  id: 'golestan',
  // ...
  story: {                    // 进场文案
    coord: 'TEHRAN · 35.68°N / 51.42°E',
    day: 'day 1',
    lines: [
      { text: '...', quiet:false },
      // ...
    ]
  },
  collapseStory: {            // 崩坏文案（NEW）
    coord: 'TEHRAN · 35.68°N / 51.42°E',
    day: 'day 1',
    lines: [
      { text: '2026 年 3 月 20 日，诺鲁孜节。', quiet:true },
      { text: '一枚导弹穿过穹顶。', quiet:false },
      // ...
    ]
  }
}
```

`quiet:true` 走 `.story-card p.quiet` 的暗灰斜体样式，用于时间锚点和铺垫句；`quiet:false` 是正常段落，用于实质内容。

### 切换时机

| 阶段 | 操作 |
|---|---|
| `enterScene` 进场 | 注入 `story` 内容 + `storyEl.classList.add('show')` 立即显示 |
| `triggerCollapse` 触发后 0.4s | **直接替换 innerHTML 为 collapseStory + 加 `.collapse-story` class**（不要 remove 容器 `.show`，否则容器淡出/淡入打架，文案完全显不出来） |
| `_collapseStorySwitchTime` 起每 1.2s | 给一个 `<p>` 加 `.show`，5 行约 6s 内逐行浮现 |
| 烧灼结束 + 0.5s | `nextHint.classList.add('show')`，等用户点击进下一场景 |

### CSS 关键规则

崩坏态下 `.story-card.collapse-story.show p` **默认 opacity:0**，必须 `<p>` 自己有 `.show` 才显示——这是让 JS 能精确控制每行节拍的关键。

```css
.story-card.collapse-story.show p{
  opacity:0;transform:translateY(10px);
  transition:opacity 1.4s ease, transform 1.4s ease;
}
.story-card.collapse-story.show p.show{
  opacity:.92;transform:translateY(0);
}
/* 取消原 nth-child 全局延迟，让 JS 控制节奏 */
.story-card.collapse-story.show p:nth-child(N){ transition-delay:0s; }
```

### 易错点

- ❌ **切换时 remove 再 add `.show`**：容器淡出 transition 0.6s 还在跑，innerHTML 已替换，但容器透明度还在变，结果文字看似"完全没出现"。
- ✅ **直接替换 innerHTML，容器 `.show` 一直保留**，淡入完全靠 `<p>` 自己的 `.show` class 触发。
- ❌ 用同一个 timer（`_burnStartTime`）作为文案节拍基准：受烧灼起点偏移影响。
- ✅ 用独立的 `_collapseStorySwitchTime`（story 切换那一刻）作为基准。

---

## 完整时间线（玫瑰宫范本）

```
t=0       enterScene
            ├ 注入 story → storyEl.show（进场 4 行立即可见）
            ├ autoRotateActive = true（视角开始慢速旋转）
            └ 1.2s 后 pressHint "tap to shatter" 显示

t≈?       用户拖拽 → autoRotateActive=false（仍可继续旋转）
          OR
t≈?       用户点击吊灯 → triggerCollapse
            ├ collapseState = 'collapsing'
            ├ autoRotateActive = false（视角锁定）
            ├ 启动碎片动画（4~5s）
            ├ 启动 panoBurnSphere（_burnStartTime = now，T=7s）
            └ 0.4s 后切换 storyEl 内容到 collapseStory + 加 .collapse-story

烧灼期间（_burnStartTime + ...）:
  0.0s    uProgress=0.05，零星焦斑可见
  0.4s    storyEl 内容已切换为 collapseStory（5 行全部 opacity:0）
  0.6s    第 1 行淡入（"2026 年 3 月 20 日"）
  1.8s    第 2 行淡入（"一枚导弹穿过穹顶"）
  3.0s    第 3 行淡入（"十万面镜片"）
  3.5s    eased ≈ 0.45，焦黑约 40%（前线带暗褐过渡）
  4.2s    第 4 行淡入（"他们说"）
  4.6s    eased > 0.5，dimSphere 开始让位
  5.4s    第 5 行淡入（"但有些光"，最终遗憾）
  7.0s    eased=1.0，全空间焦黑
  7.5s    nextHint "continue →" 显示

  等待用户点击 → returnToMap → cleanupChandelierScene → 进下一场景
```

---

## 新场景接入 checklist

把同一套结构套到剩余 5 个场景，按以下步骤：

### 1. 数据层

在 `COORDINATES` 配置里给场景加 `collapseStory` 字段：

```js
{
  id: 'isfahan-setar',
  // ...
  story: { coord, day, lines: [/* 进场 3~4 行，只讲美 */] },
  collapseStory: { coord, day, lines: [/* 崩坏 5 行，只讲遗憾 */] },
}
```

### 2. 视觉层

烧灼层 `panoBurnSphere` 是**全场景共用的全局 mesh**，不需要每个场景重建。但每个场景的"美的视觉细节"不同，烧灼方向应该呼应破坏来源：

| 场景 | 主体 | 破坏来源 | topBias 方向 |
|---|---|---|---|
| 玫瑰宫 | 吊灯 | 穹顶导弹 | `vDir.y > 0` 优先（从上往下） |
| 塞塔尔 | 琴 | 屋顶塌（见原文案） | `vDir.y > 0` 优先（从上往下） |
| 地毯 | 波斯猫 | 火焰从地面 | `vDir.y < 0` 优先（从下往上）|
| 藏红花 | 花田 | 干旱/野火 | 全方位 `topBias = 0`（均匀蔓延） |
| 细密画 | 古书 | 水浸/虫蛀 | 中部环带优先（带 noise 控制） |
| 穹顶 | 穆克纳斯 | 直接打击 | `vDir.y > 0` 优先 |

如果要每个场景定制烧灼方向，可以让 `panoBurnSphere.material.uniforms` 多加一个 `uBurnDir` 向量，由 `enterScene` 时根据当前场景设置。

### 3. 交互层

新管线（实体 GLTF + 点击触发崩坏）走 `golestanReady` 那一套。**旧管线（粒子聚合）的场景**不能直接用：粒子场景没有"实体可点击"，需要等长按聚合完成后再触发。这部分需要后续单独设计。

### 4. 文案节奏验收

部署后实测 5 行文案的节奏：

- 第 1 行出现 → 用户能看完（约 1s）
- 节拍 1.2s/行 是经验值，可微调到 1.0~1.5s 区间
- 5 行总时长（约 6s）应 < 烧灼总时长（7s），让文案先于全黑落定，最后 1s 留给"全黑+定格"

### 5. 视角自动旋转

**所有场景都启用**——这是引导用户"知道空间可转"的通用提示。每个场景在 `enterScene` 末尾都设：

```js
autoRotateActive = true;
autoRotateYaw = 0;
```

---

## 踩坑清单

按踩坑频率从高到低：

### 1. ⚠️ shader smoothstep 写反

**症状**：进场就全黑，烧灼推进反而恢复原貌。

**原因**：`smoothstep(a, b, x)` 在 `x>b` 时返回 1。要让 `uProgress` 增大时 burn 增大，正确写法是 `1.0 - smoothstep(uProgress - δ1, uProgress + δ2, n)`。

### 2. ⚠️ equirect uv + 2D fbm = 平面感

**症状**：烧灼像在贴墙纸，无空间感。

**原因**：2D 噪声在球面被拉伸，两极接缝明显。

**修法**：直接用 `vDir * scale` 在 3D 噪声里采样。

### 3. ⚠️ story-card 切换时 remove .show

**症状**：触发崩坏后文案完全显不出来。

**原因**：`storyEl.classList.remove('show')` → 容器淡出 transition 1.5s，期间 innerHTML 已被替换、`.show` 又被加回，但 transition 已经在错误的方向上跑。

**修法**：**不要 remove 容器 `.show`**，直接替换 innerHTML 并加 `.collapse-story` class。靠 `<p>` 自己的 `.show` 控制淡入。

### 4. ⚠️ 自动旋转在 pointerdown 关闭

**症状**：用户单击吊灯瞬间，自动旋转停了。

**原因**：tap 也触发 pointerdown。

**修法**：在 `pointermove` 里检测真实位移 > 4px 才关。

### 5. ⚠️ 烧灼起点 < 0

**症状**：触发崩坏后前 2 秒看似没反应。

**原因**：`uProgress = -0.2` 时所有 n ∈ [0,1] 都 > 阈值上界，burn 全为 0。

**修法**：起点设 0.05，让一开始就有零星焦斑。

### 6. ⚠️ 进场 storyEl 不显示

**症状**：进入场景看不到进场文案。

**原因**：原代码假设"长按聚合"流程才显示文案，但新管线（点击实体）没有这一步。

**修法**：在 `enterScene` 的 `golestanReady` 分支里直接 `storyEl.classList.add('show')`。

### 7. ⚠️ 鲜艳火焰色破坏氛围

**症状**：橙红余烬看起来像"3A 游戏特效"，与项目沉郁基调不符。

**修法**：去掉所有 `vec3(1.0, 0.4, 0.0)` 类的暖色项，焦色用 `#0e0a08` 到 `#161310` 的冷暗褐。

### 8. ⚠️ cleanup 不彻底导致下次进场异常

**症状**：返回地图再次进入同一场景，story-card 依然是崩坏态、烧灼层闪一下。

**修法**：`cleanupChandelierScene` 必须复位：
- `panoBurnSphere.visible = false` + `uProgress = -0.2`（或 0.05）
- `storyEl.classList.remove('collapse-story')`
- `autoRotateActive = false` + `autoRotateYaw = 0`
- 所有 `_burnStartTime / _collapseStorySwitchTime / _collapseLinesShown` 置空

并在 `enterScene` 顶部加防御性清理（双保险）。

---

## 调参速查表

### 烧灼层

| 参数 | 推荐值 | 说明 |
|---|---|---|
| 球壳半径 | 1190 | 比 dimSphere(1200) 略小 |
| 球面分段 | 64 × 32 | 太低噪声会有锯齿，太高浪费 |
| `renderOrder` | -9 | 介于 dimSphere(-10) 和 sparkle(-5) 之间 |
| `uProgress` 起点 | 0.05 | < 0 会前段无变化 |
| `uProgress` 终点 | 1.10 | 略 > 1 让全部像素都进焦黑 |
| 总时长 T | 7.0s | 比碎片动画(4~5s) 长 2s，让"碎片落定后空间继续焦化" |
| topBias 强度 | 0.30 | 0 = 均匀蔓延，0.5 = 强烈从顶部下落 |
| 噪声主频 | `vDir * 2.4` | 数字越小斑块越大 |
| 高频纹路 | `* 4.5`，权重 0.22 | 增加焦痕的不规则边缘 |
| 焦色（核心） | `#0e0a08` (vec3(0.015,0.012,0.010)) | 接近黑的冷暗褐 |
| 焦色（边缘） | `#161310` (vec3(0.085,0.055,0.040)) | 暗褐过渡 |
| 最终 alpha | `burn * 0.97` | 留 0.03 缝隙避免锯齿 |

### 文案节拍

| 参数 | 推荐值 | 说明 |
|---|---|---|
| 切换延迟 | 400ms | 触发崩坏后多久切换 storyEl |
| 行间距 | 1.2s | 5 行共 ~6s |
| 第 1 行延迟 | 0.2s | 切换后留一点点时间让 DOM 稳定 |
| `<p>` transition | 1.4s | CSS 里 ease |

### 视角自动旋转

| 参数 | 推荐值 | 说明 |
|---|---|---|
| 速度 | 0.06 弧度/秒 | 约 3.4°/s，绕一圈 ~105s |
| 拖拽阈值 | 4px | 大于此值才认定为"用户主动操作"，关闭自动旋转 |

### 时间线锚点

| 事件 | 时刻（相对 trigger） | 备注 |
|---|---|---|
| 触发崩坏 | 0 | 用户点击 |
| 切换 story 内容 | 0.4s | 同时开始烧灼 |
| 第 1 行文案出现 | 0.6s | story 切换后 0.2s |
| sparkle 开始淡出 | 1.0s（eased=0.15 处） | |
| dimSphere 开始让位 | 3.5s（eased=0.50 处） | |
| 第 5 行文案出现 | 5.4s | 最后一句 |
| 烧灼定格全黑 | 7.0s | uProgress=1.10 |
| nextHint 显示 | 7.5s | 留 0.5s 让全黑生效 |

---

## 维护建议

- 每次新增场景，先复制玫瑰宫的 `story` + `collapseStory` 字段结构。
- 文案先用本文档"双段制"原则起草，再请文案/导演 review。
- 部署前先在测试环境跑一遍**完整流程**：进场（看美） → 等 5s（感受自动旋转） → 拖拽（确认能停） → 点击主体（崩坏） → 看完 5 行文案（节拍是否舒服） → 点 continue（清理是否彻底）。
- 任何"看似不响应"的 bug，**99% 是 shader 方向、CSS .show 时序、或 cleanup 不彻底**——按踩坑清单顺序排查即可。

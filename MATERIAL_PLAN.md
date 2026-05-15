# 《聚不起的沙》· 伊朗 100 天 · 完整物料规划

> **THE SAND THAT CANNOT BE GATHERED**
> 项目类型：沉浸式 3D 全景 H5
> 更新日期：2026-05-15

---

## 一、项目概述与交互流程

### 整体架构

```
开屏页（视频背景 + 标题引导语）
  ↓ 用户触碰进入
场景 1：玫瑰宫镜厅（德黑兰 · Day 1）    → 3D 模型：吊灯
  ↓ 点击模型 → 碎裂 + 全景碎裂 → 故事浮层 → 点击空白
场景 2：塞塔尔琴（伊斯法罕 · Day 23）    → 3D 模型：塞塔尔 ✅ 已有
  ↓ 同上
场景 3：波斯地毯（大不里士 · Day 47）    → 3D 模型：波斯猫
  ↓ 同上
场景 4：藏红花（马什哈德 · Day 68）      → 3D 模型：藏红花
  ↓ 同上
场景 5：细密画（设拉子 · Day 89）        → 3D 模型：翻开的古书
  ↓ 同上
场景 6：蓝色穹顶（伊斯法罕 · Day 100）  → 3D 模型：穆克纳斯装饰单元
  ↓ 碎裂后 → 终幕主旨页
```

### 单场景交互流程

1. 进入场景 → 全景图加载为 360° 球壳背景
2. 3D 模型悬浮在视野中央，粒子缓慢聚合成型
3. 引导用户旋转观察（陀螺仪 / 拖拽）
4. 用户点击模型 →
   - 模型粒子碎裂，向四面飞散
   - 全景背景如镜片碎裂（三角面分离 + 下坠）
   - 0.5s 后出现故事文字浮层
5. 用户点击空白处 → 淡出 → 进入下一场景

---

## 二、开屏页

### 物料清单

| 物料 | 规格 | 来源 | 状态 |
|------|------|------|------|
| 第一视角参观视频 | 15–20s，1080p，H.264，< 5MB | YouTube 搜 "Golestan Palace Mirror Hall walk through POV"；或 AI 视频生成（Runway / Pika） | ❌ 待获取 |

### 文案

```
聚不起的沙

THE SAND THAT CANNOT BE GATHERED

100 天，伊朗在消失。
6 个瞬间，每一个都触手可及，每一个都留不住。

[ 触碰进入 ]
```

---

## 三、场景 1 · 玫瑰宫镜厅

| 字段 | 内容 |
|------|------|
| **地点** | 德黑兰 · 格列斯坦宫 |
| **时间** | Day 1 / 100 |
| **主题色** | 金色 · 暖白 |

### 全景图

| 规格 | 来源建议 | 搜索关键词 | 状态 |
|------|----------|------------|------|
| 2048×1024 等距柱状投影 JPEG，< 500KB | Google Arts & Culture；Flickr CC0；Blockade Labs AI 生成 | `Golestan Palace Mirror Hall 360 panorama` | ❌ 待获取 |

**Blockade Labs 提示词**：`Inside the Mirror Hall of Golestan Palace Tehran, thousands of tiny mirrors covering walls and ceiling, warm golden light, ornate Persian architecture, crystal chandeliers, first person view looking forward`

### 3D 模型：波斯宫殿吊灯（Chandelier）

| 规格 | 来源 | 搜索关键词 | 备选 |
|------|------|------------|------|
| GLB，Draco 压缩后 < 1.5MB，面数 < 50k | **Sketchfab** | `persian chandelier`, `crystal chandelier ornate`, `palace chandelier` | CGTrader 搜 `antique chandelier`；TurboSquid 搜 `crystal chandelier` |

**为什么选吊灯**：镜厅的核心视觉元素就是水晶吊灯——它与十万面镜片互相映射，是整座厅堂的灵魂。悬浮在用户头顶偏前方，用户仰视 + 环绕，有置身厅堂中央的沉浸感。

**碎裂效果**：吊灯粒子从中心向外炸裂，同时释放大量亮金色碎片粒子（配合 Bloom 产生光芒四射效果）。全景背景的镜片同步碎裂——形成"灯碎 → 镜碎"的连锁视觉。

### 故事文案

```
GOLESTAN PALACE · MIRROR HALL
格列斯坦宫 · 镜厅

TEHRAN · DAY 1 / 100

卡扎尔王朝用十万面镜片铺满这座厅堂，
让每一位来客都能从四面八方看见自己。
如今镜片仍在，但映出的已是另一个国家。

2026 年 3 月 20 日，诺鲁孜节。
伊朗人在镜厅外的广场上放下七色桌，等待春分的那一秒。
他们说：镜子碎了可以重拼，节日过了可以再来。

但这一年的春天，没有如期而至。
```

---

## 四、场景 2 · 塞塔尔琴

| 字段 | 内容 |
|------|------|
| **地点** | 伊斯法罕 · 第七工坊 |
| **时间** | Day 23 / 100 |
| **主题色** | 沙金 · 琥珀 |

### 全景图

| 规格 | 来源建议 | 搜索关键词 | 状态 |
|------|----------|------------|------|
| 2048×1024 等距柱状投影 JPEG，< 500KB | Flickr；Google 搜索；Blockade Labs AI 生成 | `Isfahan bazaar 360 panorama`, `persian workshop interior` | ❌ 待获取 |

**Blockade Labs 提示词**：`Inside an old Persian musical instrument workshop in Isfahan bazaar, wooden shelves with half-finished stringed instruments, warm amber light through small windows, sawdust in the air, traditional Iranian architecture`

### 3D 模型：塞塔尔（Setar）

| 规格 | 来源 | 状态 |
|------|------|------|
| GLB，Draco 压缩，已上传 CDN | `https://mat1.gtimg.com/qqcdn/redian/sand_test/setar__persian_musical_instrument_compressed.glb` | ✅ 已完成 |

**碎裂效果**：琴弦先断裂（弦的粒子最先飞散），然后琴颈从中间折断，最后琴箱爆散成沙。音效配合弦断声。

### 故事文案

```
WORKSHOP NO.07 · SETAR
第七工坊 · 塞塔尔

ISFAHAN · DAY 23 / 100

塞塔尔，波斯语"三根弦"。
但它有四根——第四根是十七世纪一位苏菲乐师偷偷加上的，
说那是"给神听的弦"。
从此这琴既世俗又神圣，
街巷里的手艺人弹它，清真寺里的学者也弹它。

做一把塞塔尔需要三个月。
桑葚木做面板，核桃木做琴颈。
老师傅说：木头会记住你的手温。

工坊的门牌还在，但里面已经很安静了。
```

---

## 五、场景 3 · 波斯地毯

| 字段 | 内容 |
|------|------|
| **地点** | 大不里士 · 巴扎 |
| **时间** | Day 47 / 100 |
| **主题色** | 藏红 · 靛蓝 · 米白 |

### 全景图

| 规格 | 来源建议 | 搜索关键词 | 状态 |
|------|----------|------------|------|
| 2048×1024 等距柱状投影 JPEG，< 500KB | Flickr；360Cities；Blockade Labs AI 生成 | `Tabriz bazaar 360 panorama`, `persian carpet market interior` | ❌ 待获取 |

**Blockade Labs 提示词**：`Inside the Grand Bazaar of Tabriz Iran, colorful Persian carpets hanging from walls and ceiling, warm light filtering through ancient brick arches, merchants and rolled carpets everywhere, traditional Iranian market atmosphere`

### 3D 模型：波斯猫（Persian Cat）

| 规格 | 来源 | 搜索关键词 | 备选 |
|------|------|------------|------|
| GLB，Draco 压缩后 < 1.5MB，面数 < 50k | **Sketchfab** | `persian cat`, `cat sitting`, `fluffy cat` | CGTrader 搜 `persian cat 3d model`；AI 建模（Meshy.ai / Tripo3D）文字输入 `a fluffy white Persian cat sitting elegantly` |

**为什么选波斯猫**：波斯猫起源于伊朗高原，是大不里士的文化符号之一。它安静、优雅、慵懒地蜷缩在地毯堆中——这个画面本身就是波斯巴扎最典型的日常。悬浮在空中的波斯猫，像一个正在打盹的守护者。

**碎裂效果**：猫的粒子从尾巴尖开始消散，像被风吹散的绒毛，缓慢地、轻柔地——不是爆裂，而是一根一根地飘走。全景背景的地毯花纹同步碎裂脱落。

### 故事文案

```
TABRIZ BAZAAR · CARPET
大不里士巴扎 · 地毯

TABRIZ · DAY 47 / 100

一块大不里士地毯，350 个结每平方英寸，
一个织工每天只能织一排。
一块 3×5 米的毯子，要织两年。

巴扎的猫比商人还早到。
它们从不踩地毯的花纹——
老人说猫通灵，知道哪些图案里藏着祷告。

这条巴扎是世界最大的室内市场，
联合国说它有 800 年历史。
波斯猫在毯堆上蜷了八百年，
它不在意朝代更迭，只在意今天的阳光够不够暖。

现在巴扎还在，猫也还在。
只是来摸它的手，越来越少了。
```

---

## 六、场景 4 · 藏红花

| 字段 | 内容 |
|------|------|
| **地点** | 马什哈德 · 呼罗珊 |
| **时间** | Day 68 / 100 |
| **主题色** | 藏红 · 深紫 · 橙 |

### 全景图

| 规格 | 来源建议 | 搜索关键词 | 状态 |
|------|----------|------------|------|
| 2048×1024 等距柱状投影 JPEG，< 500KB | Flickr；Google 搜索；Blockade Labs AI 生成 | `Mashhad saffron field 360`, `saffron crocus field panorama`, `Khorasan landscape` | ❌ 待获取 |

**Blockade Labs 提示词**：`A vast purple saffron crocus field at dawn in Khorasan Iran, mountains in the background, golden sunrise light, rows of delicate purple flowers stretching to the horizon, a few women in colorful clothes harvesting in the distance`

### 3D 模型：藏红花（Saffron Crocus）

| 规格 | 来源 | 搜索关键词 | 备选 |
|------|------|------------|------|
| GLB，Draco 压缩后 < 1MB，面数 < 30k | **Sketchfab** | `saffron crocus`, `crocus flower`, `saffron flower` | CGTrader 搜 `crocus 3d`；AI 建模（Meshy.ai）输入 `a single saffron crocus flower with purple petals and red stigma`；或程序化生成（6 片紫色花瓣 + 3 根红色雌蕊） |

**为什么选藏红花本身**：没有什么比这朵花本身更直接。紫色花瓣 + 三根猩红色雌蕊，造型辨识度极高。悬浮在紫色花田的全景中央，一朵放大的花，用户凑近能看到花蕊上的纹理。

**碎裂效果**：先是三根红色雌蕊脱落（像被摘走），然后紫色花瓣一片一片剥落、碎成粉尘。红色粒子在空中停留最久，最后才散去——藏红花的颜色是最不易消逝的。

### 故事文案

```
KHORASAN · SAFFRON
呼罗珊 · 藏红花

MASHHAD · DAY 68 / 100

全世界 90% 的藏红花来自伊朗。
每朵番红花只有三根雌蕊，
要在凌晨花开的两小时内手工摘下——
过了那个窗口，香气就散了。

150,000 朵花，才能得到 1 公斤藏红花。

呼罗珊的女人们天不亮就下地，指尖染得通红。
她们说这颜色洗不掉，
但不是每一年都还有花可以摘。
```

---

## 七、场景 5 · 细密画

| 字段 | 内容 |
|------|------|
| **地点** | 设拉子 · 莫克清真寺 |
| **时间** | Day 89 / 100 |
| **主题色** | 粉红 · 钴蓝 · 米黄 |

### 全景图

| 规格 | 来源建议 | 搜索关键词 | 状态 |
|------|----------|------------|------|
| 2048×1024 等距柱状投影 JPEG，< 500KB | Flickr CC0（极多高质量素材）；360Cities；Blockade Labs AI 生成 | `Nasir al-Mulk Mosque 360 panorama`, `Pink Mosque Shiraz interior` | ❌ 待获取 |

**Blockade Labs 提示词**：`Inside Nasir al-Mulk Mosque in Shiraz Iran, morning light streaming through stained glass windows creating rainbow patterns on the floor, intricate pink and blue tilework, Persian carpets on the ground, ethereal atmosphere`

### 3D 模型：翻开的古书（Open Book）

| 规格 | 来源 | 搜索关键词 | 备选 |
|------|------|------------|------|
| GLB，Draco 压缩后 < 1MB，面数 < 30k | **Sketchfab** | `open book`, `ancient book open`, `old manuscript open`, `quran open book` | CGTrader 搜 `open book 3d model`；TurboSquid 搜 `antique book`；AI 建模输入 `an open ancient Persian manuscript book with ornate pages and miniature paintings` |

**为什么选翻开的古书**：设拉子是哈菲兹和萨迪的故乡，波斯文学的圣城。细密画从来不是独立存在的——它画在书页上，是文字的延伸。一本翻开的古书悬浮在粉红清真寺的彩色光线中，书页上隐约可见细密画的图案，是诗歌与绘画的合体。

**碎裂效果**：书页从中缝开始撕裂，两半向两侧翻卷后碎散。页面上的"文字粒子"（小点阵）最后飘散，像字迹被风吹走。配合粉红清真寺背景的彩色玻璃碎裂——五彩的光碎了。

### 故事文案

```
NASIR AL-MULK · MINIATURE
莫克清真寺 · 细密画

SHIRAZ · DAY 89 / 100

波斯细密画用松鼠毛笔画，笔尖只有三四根毛。
画师从十二岁开始学，
到能独立完成一幅 A4 大小的作品，至少要十五年。

最难的部分不是画，是调色。
矿物颜料要在玛瑙板上研磨三天，
加蛋清和牛胆汁定色。
每一种蓝都有名字：设拉子蓝、伊斯法罕蓝、呼罗珊蓝。

粉红清真寺的晨光透过彩色玻璃，
把地面染成一幅巨大的细密画。
画师说：光是最好的颜料，但你留不住它。

哈菲兹在这座城市写下六百年前的诗——
"即使全世界的墨水都用尽，
哈菲兹的故事也写不完。"

现在墨水还在。只是没有人再蘸笔了。
```

---

## 八、场景 6 · 蓝色穹顶

| 字段 | 内容 |
|------|------|
| **地点** | 伊斯法罕 · 伊玛目清真寺 |
| **时间** | Day 100 / 100 |
| **主题色** | 钴蓝 · 青绿 · 金 |

### 全景图

| 规格 | 来源建议 | 搜索关键词 | 状态 |
|------|----------|------------|------|
| 2048×1024 等距柱状投影 JPEG，< 500KB | Flickr；360Cities；Blockade Labs AI 生成 | `Shah Mosque Isfahan 360 panorama`, `Imam Mosque dome interior` | ❌ 待获取 |

**Blockade Labs 提示词**：`Looking up at the interior of the blue tiled dome of Shah Mosque in Isfahan Iran, intricate Islamic geometric patterns in cobalt blue and turquoise, muqarnas honeycomb vaulting, golden calligraphy bands, divine light from above`

### 3D 模型：穆克纳斯装饰单元（Muqarnas）

| 规格 | 来源 | 搜索关键词 | 备选 |
|------|------|------------|------|
| GLB，Draco 压缩后 < 1.5MB，面数 < 50k | **Sketchfab** | `muqarnas`, `islamic muqarnas`, `stalactite vault`, `honeycomb vault islamic` | CGTrader 搜 `muqarnas 3d`；Thingiverse 搜 `muqarnas`（有不少参数化模型）；程序化生成（参数化几何算法） |

**为什么选穆克纳斯**：穆克纳斯（蜂巢状钟乳石装饰）是伊斯兰建筑最复杂、最令人叹为观止的结构之一，是穹顶内部从圆形过渡到方形的关键构件。一个穆克纳斯单元悬浮在用户头顶——仰望时，它就像从穹顶上脱落的一小块，触手可及却不属于你。

**碎裂效果**：穆克纳斯单元从外层开始一层一层剥落（像蜂巢一格一格崩塌），蓝色瓷砖碎片向上飘散——像要飞回穹顶。这是唯一一幕碎片"向上"飞的场景，与其他幕的向下坠落形成对比，暗示"最后的挣扎"。

### 故事文案

```
IMAM MOSQUE · DOME
伊玛目清真寺 · 穹顶

ISFAHAN · DAY 100 / 100

伊玛目清真寺的穹顶用了 47 万块蓝色瓷砖，
每一块手工切割、手工釉烧、手工镶嵌。
从阿巴斯大帝下令到完工，花了 26 年。

站在穹顶正下方拍手，回声会反弹七次。
伊朗人说这是真主在回应。

穆克纳斯是穹顶的骨架——
几千个蜂巢般的小龛层层叠叠，
把一个方形的房间托举成一个圆形的天穹。
数学家说这是几何学的奇迹，
工匠说这只是耐心。

最后一天，广场上一个老人指着穹顶对孙子说：
记住这个蓝色。

但蓝色不需要被记住——它一直在那里。
只是看它的人，换了。
```

---

## 九、终幕

场景 6 碎裂后，不进入下一场景，而是进入纯黑底的终幕页。

### 文案

```
100 天。6 个瞬间。
每一个都触手可及，每一个都留不住。

这些沙，本就不属于任何人的手。

THE SAND THAT CANNOT BE GATHERED
100 / 100
```

### 视觉效果

6 幕所有飘散的粒子从屏幕四周缓缓汇聚到中央，但始终无法凝聚成形——它们在中央持续流动、翻涌，形成一个呼吸般的沙团，然后缓慢散去，露出文字。

---

## 十、3D 模型获取方案汇总

### 模型规格要求

| 项目 | 要求 |
|------|------|
| 格式 | **GLB / GLTF**（避免 FBX / OBJ） |
| 压缩 | **Draco 压缩**（Blender 导出时勾选 Draco） |
| 压缩后体积 | 单个 **< 1.5MB** |
| 面数 | **< 50k 面**（超过的用 Blender Decimate 修改器降面） |
| 材质 | PBR 材质优先；纯色 / 简单贴图即可（粒子化后贴图不重要） |
| 朝向 | Y-up（Three.js 默认），模型居中 |

### 6 个模型一览

| # | 场景 | 模型 | 首选来源 | Sketchfab 搜索关键词 | 备选来源 | 状态 |
|---|------|------|----------|---------------------|----------|------|
| 1 | 镜厅 | 波斯宫殿吊灯 | Sketchfab | `persian chandelier`, `crystal chandelier ornate`, `palace chandelier` | CGTrader, TurboSquid | ❌ 待获取 |
| 2 | 塞塔尔 | 塞塔尔琴 | — | — | — | ✅ 已完成 |
| 3 | 地毯 | 波斯猫 | Sketchfab | `persian cat`, `cat sitting`, `fluffy cat` | CGTrader, AI 建模 | ❌ 待获取 |
| 4 | 藏红花 | 藏红花 | Sketchfab | `saffron crocus`, `crocus flower`, `saffron flower` | AI 建模, 程序化生成 | ❌ 待获取 |
| 5 | 细密画 | 翻开的古书 | Sketchfab | `open book`, `ancient book open`, `old manuscript open` | CGTrader, TurboSquid | ❌ 待获取 |
| 6 | 穹顶 | 穆克纳斯 | Sketchfab | `muqarnas`, `islamic muqarnas`, `stalactite vault` | Thingiverse, 程序化生成 | ❌ 待获取 |

### Sketchfab 下载注意事项

1. 筛选许可证：**CC BY** 或 **CC0** 可免费商用
2. 下载格式选 **GLB** 或 **GLTF**
3. 下载后在 Blender 中检查面数，超过 50k 用 Decimate 修改器降面
4. 导出时勾选 **Draco 压缩**（Compression Level 6，Quantization: Position 14, Normal 10）
5. 确认导出后文件 < 1.5MB

### AI 建模备选方案

如果在 Sketchfab / CGTrader 找不到满意的模型，可使用以下 AI 建模工具：

| 工具 | 网址 | 输入方式 | 输出格式 | 适合模型 |
|------|------|----------|----------|----------|
| **Meshy.ai** | meshy.ai | 文字描述 / 图片 | GLB | 所有 6 个 |
| **Tripo3D** | tripo3d.ai | 文字描述 / 图片 | GLB | 所有 6 个 |
| **Luma Genie** | lumalabs.ai/genie | 文字描述 | GLB | 简单造型 |
| **CSM (Common Sense Machines)** | csm.ai | 图片 | GLB | 照片转模型 |

**AI 建模提示词参考**：

| 模型 | 提示词 |
|------|--------|
| 吊灯 | `An ornate Persian palace crystal chandelier with gold frame and hanging crystal drops, baroque style` |
| 波斯猫 | `A fluffy white Persian cat sitting elegantly, long fur, detailed face, calm expression` |
| 藏红花 | `A single saffron crocus flower with six purple petals and three vivid red stigma threads, botanical accurate` |
| 古书 | `An open ancient Persian manuscript book with yellowed pages, ornate border decorations, miniature paintings visible` |
| 穆克纳斯 | `A section of Islamic muqarnas honeycomb vault decoration, blue and turquoise ceramic tiles, geometric pattern` |

---

## 十一、全景图获取方案

### 规格要求

| 项目 | 要求 |
|------|------|
| 分辨率 | **2048×1024**（等距柱状投影 Equirectangular） |
| 格式 | **JPEG**（质量 85%） |
| 文件大小 | **< 500KB** |
| 内容 | 与对应场景主题匹配的 360° 全景 |

### 来源优先级

| 优先级 | 来源 | 适用场景 | 质量 | 费用 |
|--------|------|----------|------|------|
| ⭐⭐⭐ | **Blockade Labs** (skybox.blockadelabs.com) | 所有 6 个场景 | 中-高 | 免费额度 |
| ⭐⭐⭐ | **360Cities.net** | 镜厅、清真寺 | 极高 | 免费预览 / 付费高清 |
| ⭐⭐ | **Flickr** (CC0/CC BY) | 巴扎、田野 | 中-高 | 免费 |
| ⭐⭐ | **Google Arts & Culture** | 镜厅、清真寺 | 高 | 免费（需截屏拼接） |
| ⭐ | **Polyhaven.com** | 通用场景 | 高 | 免费 CC0 |

### 推荐方案

**首选 Blockade Labs AI 生成**——速度最快、风格统一、可控性强。上方每个场景已附 Blockade Labs 提示词。

### 6 张全景图搜索关键词汇总

| # | 场景 | 搜索关键词 | Blockade Labs 提示词 |
|---|------|------------|---------------------|
| 1 | 镜厅 | `Golestan Palace Mirror Hall 360` | 见场景 1 |
| 2 | 塞塔尔 | `Isfahan bazaar workshop 360` | 见场景 2 |
| 3 | 地毯 | `Tabriz bazaar carpet market 360` | 见场景 3 |
| 4 | 藏红花 | `Khorasan saffron field 360` | 见场景 4 |
| 5 | 细密画 | `Nasir al-Mulk Mosque Shiraz 360` | 见场景 5 |
| 6 | 穹顶 | `Shah Mosque Isfahan dome 360` | 见场景 6 |

---

## 十二、技术规格汇总

### 资源部署

所有重资源走腾讯 CDN 按需加载，主包永远 < 500KB。

| 资源类型 | CDN 域名 | 加载时机 |
|----------|----------|----------|
| GLB 模型 | `mat1.gtimg.com/qqcdn/redian/sand_test/` | 进入场景时预加载 |
| 全景图 | `mat1.gtimg.com/qqcdn/redian/sand_test/` | 场景过渡期间预加载 |
| 开屏视频 | `mat1.gtimg.com/qqcdn/redian/sand_test/` | 页面首屏加载 |
| 音频（可选） | `mat1.gtimg.com/qqcdn/redian/sand_test/` | 进入场景时按需加载 |

### 性能预算

| 场景 | 粒子数（移动端） | 粒子数（桌面） | GPU 负担 |
|------|-----------------|----------------|----------|
| 1 镜厅/吊灯 | 80k–100k | 300k | 中 |
| 2 塞塔尔 | 100k–150k | 400k | 中 |
| 3 地毯/波斯猫 | 80k–120k | 350k | 中 |
| 4 藏红花 | 60k–80k | 250k | 低 |
| 5 细密画/古书 | 80k–100k | 300k | 低-中 |
| 6 穹顶/穆克纳斯 | 100k–120k | 350k | 中 |

---

## 十三、完整物料状态总表

| # | 物料 | 类型 | 对应场景 | 负责 | 状态 |
|---|------|------|----------|------|------|
| 1 | 开屏视频（15–20s） | 视频 | 开屏页 | 人工获取/AI 生成 | ❌ 待获取 |
| 2 | 镜厅全景图 | 图片 | 场景 1 | 人工获取/AI 生成 | ❌ 待获取 |
| 3 | 工坊全景图 | 图片 | 场景 2 | 人工获取/AI 生成 | ❌ 待获取 |
| 4 | 巴扎全景图 | 图片 | 场景 3 | 人工获取/AI 生成 | ❌ 待获取 |
| 5 | 花田全景图 | 图片 | 场景 4 | 人工获取/AI 生成 | ❌ 待获取 |
| 6 | 粉红清真寺全景图 | 图片 | 场景 5 | 人工获取/AI 生成 | ❌ 待获取 |
| 7 | 穹顶全景图 | 图片 | 场景 6 | 人工获取/AI 生成 | ❌ 待获取 |
| 8 | 吊灯 GLB | 3D 模型 | 场景 1 | 人工获取/AI 建模 | ❌ 待获取 |
| 9 | 塞塔尔 GLB | 3D 模型 | 场景 2 | — | ✅ 已完成 |
| 10 | 波斯猫 GLB | 3D 模型 | 场景 3 | 人工获取/AI 建模 | ❌ 待获取 |
| 11 | 藏红花 GLB | 3D 模型 | 场景 4 | 人工获取/AI 建模 | ❌ 待获取 |
| 12 | 翻开的古书 GLB | 3D 模型 | 场景 5 | 人工获取/AI 建模 | ❌ 待获取 |
| 13 | 穆克纳斯 GLB | 3D 模型 | 场景 6 | 人工获取/AI 建模 | ❌ 待获取 |
| 14 | 开屏文案 | 文案 | 开屏页 | AI 已写 | ✅ 已完成 |
| 15 | 场景 1 故事文案 | 文案 | 场景 1 | AI 已写 | ✅ 已完成 |
| 16 | 场景 2 故事文案 | 文案 | 场景 2 | AI 已写 | ✅ 已完成 |
| 17 | 场景 3 故事文案 | 文案 | 场景 3 | AI 已写 | ✅ 已完成 |
| 18 | 场景 4 故事文案 | 文案 | 场景 4 | AI 已写 | ✅ 已完成 |
| 19 | 场景 5 故事文案 | 文案 | 场景 5 | AI 已写 | ✅ 已完成 |
| 20 | 场景 6 故事文案 | 文案 | 场景 6 | AI 已写 | ✅ 已完成 |
| 21 | 终幕文案 | 文案 | 终幕 | AI 已写 | ✅ 已完成 |
| 22 | 开屏页 + 6 幕 + 终幕代码 | 代码 | 全局 | AI 开发 | ❌ 待开发 |
| 23 | 碎裂效果 + 全景碎裂 | 代码 | 全局 | AI 开发 | ❌ 待开发 |
| 24 | 场景间过渡动画 | 代码 | 全局 | AI 开发 | ❌ 待开发 |
| 25 | 背景音乐 ×6（可选） | 音频 | 各场景 | 待定 | ⏸ 可选 |

---

## 附录：碎裂效果对比

| 场景 | 模型碎裂方式 | 粒子飞散方向 | 全景碎裂特色 | 情绪 |
|------|-------------|-------------|-------------|------|
| 1 镜厅/吊灯 | 从中心爆裂，水晶碎片四溅 | 向外 + 向下 | 镜片碎裂，金色光芒 | 华丽的破碎 |
| 2 塞塔尔 | 弦断 → 颈折 → 箱散 | 向下坠落 | 工坊墙壁裂开 | 沉默的断裂 |
| 3 波斯猫 | 从尾到头，绒毛飘散 | 缓慢飘散 | 地毯花纹脱落 | 温柔的消失 |
| 4 藏红花 | 雌蕊脱落 → 花瓣剥落 → 粉尘 | 向四周飘 | 花田褪色 | 芬芳的凋零 |
| 5 古书 | 书页撕裂 → 文字粒子飘散 | 随风飘走 | 彩色玻璃碎裂 | 文明的消逝 |
| 6 穆克纳斯 | 外层剥落 → 逐层崩塌 | **向上飘**（唯一） | 蓝色瓷砖碎裂 | 最后的仰望 |

---

> **下一步**：素材到位后，切换到 craft 模式开始代码开发。

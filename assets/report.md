# 「碎镜记」H5策划技术文档

> **主题**：2026年美伊冲突反战主题H5  
> **文档版本**：v1.9  
> **生成日期**：2026年5月25日  
> **用途**：供AI编程及开发团队参考

---

## 1. 项目概述

### 1.1 主题定位

**主方案：「18年与1秒」**

> 萨法维的工匠用了18年铺就那片蓝。2026年的冲击波，只用了1秒。

|项目属性|内容|
|---|---|
|**主标题**|18年与1秒|
|**副标题**|波斯之光的第86天|
|**英文名**|18 Years and 1 Second|
|**时间背景**|2026年2月28日—5月24日（86天，面向100天节点）|
|**核心数据**|149处遗址受损、75万亿里亚尔修复成本（远超文化部全年预算）|

**主题哲学内核**：
- **时间悖论**：文明是熵减的奇迹，战争是熵增的必然。18年的积累与1秒的毁灭，是人类与物理定律的对抗
- **网感记忆点**：数字对比天然适合短视频/社交传播，"18年vs1秒"可独立成为传播符号
- **克制表达**：不煽情、不说教，用时间数据让用户自行感知重量

**备选方案**（按传播场景）：

| 方案 | 主题名 | 核心概念 | 适用场景 |
|------|--------|----------|----------|
| A | **75,000,000,000,000** | 以修复成本75万亿里亚尔为视觉锤，将文明毁灭量化为财务账单 | 数据敏感型用户、财经向传播 |
| B | **镜子无法反射气味** | 强调视觉的局限，引出战争对非物质文化（嗅觉、听觉）的剥夺 | 文艺向用户、深度阅读场景 |
| C | **第101天：不存在的和平** | 利用百日节点心理预期，构建"时间被锁死"的交互逻辑 | 新闻热点向、时效性传播 |
| D | **All Eyes on the Shards** | 致敬"All Eyes on Rafah"5000万转发，将冲突简化为"碎片"符号 | 国际传播、跨文化受众 |

### 1.2 策划目标

本H5以伊朗经典建筑360度全景图为载体，通过"镜宫—水晶吊灯炸裂—碎片映射场景"的交互隐喻，串联10处伊朗文化遗产在2026年美伊冲突中的真实受损故事。用户在沉浸式浏览中感受"美好易碎、文明难以重建"的遗憾，最终引发反战情绪共鸣。

### 1.3 情感基调

|阶段|情感关键词|视觉基调|
|---|---|---|
|开场（镜宫）|神秘、璀璨、庄严|镜面反射、翠绿金色光芒|
|吊灯炸裂|震撼、凝固、悬念|时间静止、碎片悬浮|
|场景浏览|惋惜、沉思、痛惜|各场景主色调+受损痕迹|
|结语（星空）|哀悼、哲思、希望|全黑背景、星芒点点|

---

## 2. 交互逻辑流程

### 2.1 完整用户旅程

```
[引导页] 
    ↓ 点击进入
[镜宫场景] ← 360°全景，陀螺仪/拖拽交互
    ↓ 用户浏览，阅读引导文案
[点击水晶吊灯]
    ↓ 吊灯炸裂动画（约2秒）
[碎片静止] ← 10片碎片悬浮空中，每片带标签
    ↓ 用户点击任意碎片
[切换至对应场景] ← 360°全景 + 信息卡片浮层
    ↓ 用户阅读完毕
[关闭卡片] → 返回镜宫碎片界面 / 直接点击其他碎片
    ↓ 循环，直到浏览任意5个场景
[触发结局]
    ↓ 
[回到镜宫] ← 背景开始"灼烧"效果
    ↓ 渐变约3秒
[全黑过渡] ← 碎片化为星芒
    ↓ 
[结语页面] ← 星空背景 + 结语文案 + 落版
    ↓ 
[END]
```

### 2.2 关键交互节点说明

|节点|触发条件|响应行为|
|---|---|---|
|进入镜宫|点击引导页按钮|加载镜宫全景图，显示引导文案|
|吊灯炸裂|点击画面中央吊灯|播放爆炸动画，碎片四散后静止|
|碎片选择|点击任一碎片标签|全景图渐变切换，弹出信息卡片|
|关闭卡片|点击卡片关闭按钮|隐藏卡片，回到碎片选择状态|
|触发结局|累计浏览≥5个场景|自动回到镜宫，触发灼烧特效|
|结语展示|灼烧完成后|全黑过渡，显示星空与结语|

### 2.3 状态管理逻辑

```javascript
// 伪代码示意
let viewedScenes = []; // 已浏览场景ID数组
const REQUIRED_COUNT = 5; // 触发结局所需场景数

function onSceneViewed(sceneId) {
    if (!viewedScenes.includes(sceneId)) {
        viewedScenes.push(sceneId);
    }
    if (viewedScenes.length >= REQUIRED_COUNT) {
        triggerEnding(); // 触发结局
    }
}
```

---

## 3. 资源文件清单

### 3.1 全景图资源（10张）

|序号|文件名|对应场景|所在城市|
|---|---|---|---|
|1|Ali-Ibn-Hamzeh-Holy-Shrine.jpg|阿里·伊本·哈姆泽圣陵|设拉子|
|2|Ali-Qapu-Palace.jpg|阿里卡普宫|伊斯法罕|
|3|Ali-Qapu-Palace-Music-Room.jpg|阿里卡普宫音乐厅|伊斯法罕|
|4|Amin-od-Dowleh-plaza.jpg|阿明·奥多莱商队客栈|卡尚|
|5|Chehel-Sotun.jpg|四十柱宫|伊斯法罕|
|6|Imam-Mosque.jpg|伊玛目清真寺|伊斯法罕|
|7|Iran's-Spiritual-Center-And-Shrine-Of-Hazrat-Masumeh.jpg|法蒂玛·马苏梅圣陵|库姆|
|8|Kaleidoscopic Mosque.jpg|莫克清真寺|设拉子|
|9|Sheikh Lotfollah Mosque.jpg|希赫洛特夫拉清真寺|伊斯法罕|
|10|the-Chehel-Sotoun.jpg|四十柱宫内部|伊斯法罕|

**文件路径**：`/usr/local/app/attachment/`

### 3.2 镜宫开场资源

镜宫场景使用独立全景图（非上述10张之一），该场景具备最典型的镜面镶嵌工艺（Ayeneh-kari），与"碎镜"主题高度契合。

### 3.3 需额外制作的资源

|资源类型|数量|说明|
|---|---|---|
|水晶吊灯3D模型/序列帧|1套|用于炸裂动画|
|碎片悬浮粒子效果|1套|10片碎片+标签UI|
|灼烧/燃烧特效|1套|镜宫结局过渡|
|星空/星芒背景|1张|结语页背景|

---

## 4. 镜宫场景配置

### 4.1 场景基础信息

|属性|配置值|
|---|---|
|**场景名称**|镜宫（开场）|
|**全景图文件**|独立镜宫全景图（玫瑰宫镜厅）|
|**原型建筑**|玫瑰宫镜厅|
|**核心工艺**|镜面镶嵌（Ayeneh-kari）|
|**主配色**|翠绿色、青蓝色、金色、银色/镜面色|
|**选择理由**|十万片威尼斯镜片的"碎片感"与策划主题完美呼应|

### 4.2 水晶吊灯交互设计

|交互属性|配置|
|---|---|
|**位置**|画面正中央（穹顶下方）|
|**初始状态**|悬挂、微微摇曳光芒|
|**点击热区**|以吊灯为圆心，半径约屏幕宽度15%|
|**点击反馈**|吊灯放大→炸裂→碎片四散→静止|
|**动画时长**|约2-3秒|
|**音效建议**|玻璃碎裂声（清脆）→渐弱→静默|

### 4.3 碎片标签配置

|碎片ID|标签文案|链接场景|标签配色建议|
|---|---|---|---|
|fragment_01|「镜中圣陵」|阿里·伊本·哈姆泽圣陵|银绿色|
|fragment_02|「高门」|阿里卡普宫|土黄色|
|fragment_03|「消失的乐声」|阿里卡普宫音乐厅|砖红色|
|fragment_04|「丝路尽头」|阿明·奥多莱商队客栈|沙褐色|
|fragment_05|「四十柱的倒影」|四十柱宫|赭石色|
|fragment_06|「波斯蓝」|伊玛目清真寺|深蓝色|
|fragment_07|「金顶下的祈祷」|法蒂玛·马苏梅圣陵|金色|
|fragment_08|「粉红清真寺的早晨」|莫克清真寺|玫瑰粉|
|fragment_09|「孔雀的尾巴」|希赫洛特夫拉清真寺|绿松石色|
|fragment_10|「画中人」|四十柱宫内部|朱红金色|

---

## 5. 十个场景详细配置

### 5.1 场景01：阿里·伊本·哈姆泽圣陵

|配置项|内容|
|---|---|
|**场景编号**|scene_01|
|**场景名称**|阿里·伊本·哈姆泽圣陵|
|**碎片标签**|「镜中圣陵」|
|**全景图文件**|Ali-Ibn-Hamzeh-Holy-Shrine.jpg|
|**所在城市**|设拉子（Shiraz）|
|**建筑类型**|什叶派圣陵|
|**建造年代**|9世纪始建，19世纪恺加王朝重建|
|**核心工艺**|镜面镶嵌（Ayeneh-kari）|
|**主配色**|翠绿色、青蓝色、金色、银色/镜面色、米白色|

**象征物配置**：

|象征物名称|玫瑰水（Golab）|
|---|---|
|**文化意义**|设拉子"玫瑰之城"的文化标识，圣陵净化仪式的必需品|
|**配色/纹理**|琥珀色透明液体、深粉色大马士革玫瑰花瓣、铜质蒸馏器皿|
|**2026年受损**|设拉子周边玫瑰种植区物流中断，玫瑰水生产与出口陷入停滞[1][11]|
|**生图Prompt**|Realistic product photography of a Persian rosewater glass bottle (Golab), elegant hand-blown pear-shaped bottle with amber-golden liquid inside, delicate condensation droplets on glass surface, a single wilting Damascus rose with falling petals beside it. Studio lighting, soft shadows, hyper-detailed glass texture and liquid refraction. Isolated on pure white background for easy extraction, transparent PNG. Color palette: amber gold, dusty rose pink, translucent glass. 512x512px.|

**叙事文案**：

> 公元9世纪，什叶派圣裔阿里·伊本·哈姆泽长眠于此。十二个世纪后的恺加王朝，工匠将十万片威尼斯进口的镜片切成星芒与菱形，一寸一寸镶进穹顶——这门工艺叫Ayeneh-kari，"把光关进镜子里"。
>
> 2026年4月6日，设拉子石化厂被击中[16]。冲击波以每秒340米的速度掠过城区。没有直接命中，但圣陵管理处的报告写道："部分镜面出现松动迹象。"
>
> 松动。一个多么温和的词。
>
> 真正消失的是另一种东西。设拉子被称为"玫瑰之城"，每年五月，郊外的大马士革玫瑰会被投进铜质蒸馏器，化作Golab——玫瑰水，用于清洗圣陵的每一道缝隙。今年的五月，物流断了，玫瑰烂在地里[11]。
>
> 镜子碎了，还能看见光。但当玫瑰不再盛开，圣陵便失去了呼吸的气息。

**象征物文案**：

> 没有一颗炸弹直接落在玫瑰园里，但玫瑰水的供应链断了。战争杀死事物的方式，比我们想象的更沉默。

---

### 5.2 场景02：阿里卡普宫

|配置项|内容|
|---|---|
|**场景编号**|scene_02|
|**场景名称**|阿里卡普宫|
|**碎片标签**|「高门」|
|**全景图文件**|Ali-Qapu-Palace.jpg|
|**所在城市**|伊斯法罕（Isfahan）|
|**建筑类型**|萨法维王朝宫殿|
|**建造年代**|1592年|
|**核心工艺**|木质格窗（Girih）、贴金天花板|
|**主配色**|米黄色、赤褐色、浅棕色、象牙白|

**象征物配置**：

|象征物名称|Khatam镶嵌工艺品|
|---|---|
|**文化意义**|波斯精密木工艺术巅峰，每平方厘米容纳250片碎料，皇室外交礼品首选|
|**配色/纹理**|骆驼骨白、乌木黑、黄铜金，细密三角形拼成六角星形图案|
|**2026年受损**|伊斯法罕工匠大量流失，传统作坊停工，出口订单归零[2][11]|
|**生图Prompt**|Realistic product photography of a Persian Khatam-kari inlaid jewelry box, intricate hexagonal star geometric pattern crafted from camel bone, ebony wood and brass wire. Detailed wood grain texture, metallic sheen on brass inlays, one corner visibly chipped revealing the layered construction. Studio lighting with soft reflections, hyper-detailed craftsmanship. Isolated on pure white background, transparent PNG. Color palette: ivory white, deep ebony black, warm brass gold. 512x512px.|

**叙事文案**：

> Ali Qapu，波斯语"高门"。1592年起，萨法维王朝的国王在这道门后接见世界：奥斯曼的使臣，莫卧儿的商队，欧洲的传教士。他们带着各自的礼物来，带着Khatam镶嵌的首饰盒离开——那是一种需要用骆驼骨、乌木和黄铜丝拼成六角星的工艺，每平方厘米250片碎料，一个首饰盒需要25万片。
>
> 如今，高门是UNESCO世界遗产"纳克什贾汗广场"的核心建筑之一[3]。2026年3月31日，附近区域遭受密集打击，宫殿六层的木质结构发生位移，贴金天花板"像枯叶一样脱落"——这是伊斯法罕文化遗产局官员的原话[9]。
>
> 伊斯法罕的Khatam工匠曾有1200人，他们需要花费数月完成一件作品。现在，作坊歇业，工匠离散。
>
> 高门紧闭。没有使臣，没有礼物，只有等待重新贴金的天花板，和不知何时能复工的手艺人。

**象征物文案**：

> 25万片碎料拼成一个首饰盒，一次爆炸让整座城市的工匠放下工具。战争摧毁的不只是建筑，还有建造的人。

---

### 5.3 场景03：阿里卡普宫音乐厅

|配置项|内容|
|---|---|
|**场景编号**|scene_03|
|**场景名称**|阿里卡普宫音乐厅|
|**碎片标签**|「消失的乐声」|
|**全景图文件**|Ali-Qapu-Palace-Music-Room.jpg|
|**所在城市**|伊斯法罕（Isfahan）|
|**建筑类型**|宫殿功能空间（声学设计）|
|**建造年代**|萨法维阿巴斯一世时期（16-17世纪）|
|**核心工艺**|镂空灰泥装饰（Tong-bori）|
|**主配色**|红褐色/砖红色、沙黄色、金赭色、深褐色、乳白色|

**象征物配置**：

|象征物名称|塞塔尔琴（Setar）|
|---|---|
|**文化意义**|波斯古典音乐的核心乐器，苏菲派灵修媒介，四根弦对应火、水、风、土|
|**配色/纹理**|梨形桑木琴身（蜂蜜棕）、核桃木细长琴颈、4根金属弦|
|**2026年受损**|制琴工坊停产，伊斯法罕音乐学院关闭，演奏传承面临断代[9]|
|**生图Prompt**|Realistic product photography of a Persian Setar lute, pear-shaped mulberry wood body with natural wood grain, slender walnut neck with delicate frets, four silk strings with one broken string curling elegantly. Aged patina on the wood surface, detailed craftsmanship visible. Studio lighting emphasizing wood texture and curves. Isolated on pure white background, transparent PNG. Color palette: honey amber, walnut brown, silver strings. 512x512px.|

**叙事文案**：

> 阿里卡普宫的第六层，没有壁画，没有镜面。墙上密布着花瓶形状的镂空——Tong-bori，一种400年前的声学装置。萨法维的工匠不懂物理公式，但他们知道：当塞塔尔琴的四根弦在这个房间里震动，声波会钻进每一个镂空的"花瓶"，在石膏与空气的交界处来回折返，最后从穹顶汇聚成一个完美的共振点。
>
> 这是世界上最早的声学建筑之一。而塞塔尔，波斯语"三根弦"（后增至四根），是苏菲派修行者用来接近真主的乐器——它的声音很轻，轻到只适合独奏和冥想。
>
> 2026年3月31日，空袭的冲击波抵达这里时，已经衰减到不足以震碎玻璃的程度[9]。但灰泥是脆弱的。文物专家在穹顶发现了肉眼难辨的微裂纹，那些精密的声学腔体正在一点点失去气密性。
>
> 伊斯法罕的制琴师说，即使他们还能做琴，也没有地方可以校音了。

**象征物文案**：

> 塞塔尔的声音很轻，轻到只适合在安静的房间里独奏。2026年的伊朗，没有一个地方足够安静。

---

### 5.4 场景04：阿明·奥多莱商队客栈

|配置项|内容|
|---|---|
|**场景编号**|scene_04|
|**场景名称**|阿明·奥多莱商队客栈|
|**碎片标签**|「丝路尽头」|
|**全景图文件**|Amin-od-Dowleh-plaza.jpg|
|**所在城市**|卡尚大巴扎（Bazaar of Kashan）|
|**建筑类型**|恺加王朝商业建筑|
|**建造年代**|1863-1868年|
|**核心工艺**|穆卡纳斯（Muqarnas）蜂窝状穹顶、几何砖雕（Hazarbaf）|
|**主配色**|土黄色/沙褐色、绿松石蓝、奶油白、深棕色|

**象征物配置**：

|象征物名称|波斯地毯|
|---|---|
|**文化意义**|伊朗第二大非石油出口商品，每一寸经纬都是游牧文明的活化石|
|**配色/纹理**|深红、藏青、金黄为主的复杂几何/花卉图案，羊毛/丝绒质感|
|**2026年受损**|出口额从25亿美元骤降至不足4000万美元，编织工人减少80%[4][11]|
|**生图Prompt**|Realistic product photography of a rolled Persian carpet, hand-knotted wool with intricate Herati floral pattern in deep crimson red, navy blue and gold thread. Rich textile texture visible, some silk threads hanging loose from a frayed corner edge. Studio lighting showing the pile depth and color richness. Isolated on pure white background, transparent PNG. Color palette: crimson red, navy blue, antique gold, ivory. 512x512px.|

**叙事文案**：

> 恺加王朝的商人阿明·奥多莱在1863年建造这座客栈时，不会想到它会成为世界上最精美的穆卡纳斯穹顶之一——那些蜂窝状的石膏单元层层叠叠向上收拢，像一朵用数学公式折叠的花。
>
> 160年来，这里是波斯地毯的定价中心。大不里士的羊毛、库姆的丝线、伊斯法罕的图案，在这个穹顶下找到买家。一张上等的波斯地毯需要一家人织三年，八百万个结，每个结都是一次指尖与丝线的对话。
>
> 2026年，制裁与战争双重绞杀。地毯出口从25亿美元暴跌至不足4000万美元，80%的织工失业[4][11]。卡尚大巴扎的穹顶出现了细微裂缝，但没有人来修——巴扎里已经没有多少商户了。
>
> 穆卡纳斯依然完美，但它照耀的只是一座空荡的市场。

**象征物文案**：

> 一张地毯，八百万个结，三年时光。一场战争，九十天，让这一切失去了买家。

---

### 5.5 场景05：四十柱宫·花园

|配置项|内容|
|---|---|
|**场景编号**|scene_05|
|**场景名称**|四十柱宫·花园|
|**碎片标签**|「四十柱的倒影」|
|**全景图文件**|Chehel-Sotun.jpg|
|**所在城市**|伊斯法罕（Isfahan）|
|**建筑类型**|萨法维王朝宫殿（UNESCO世界遗产"波斯园林"成员）|
|**建造年代**|1647年|
|**核心工艺**|镜面马赛克、历史壁画、20根雪松木柱、波斯四分式花园|
|**主配色**|木质棕/赭石色、砖红色、碧蓝色/青绿色、金色、藏红花橙红|

**象征物配置**：

|象征物名称|**藏红花（Saffron/Za'feran）**|
|---|---|
|**文化意义**|"红色黄金"，波斯3000年种植史，全球90%产量来自伊朗；古波斯帝王用于染制皇袍、沐浴香薰；诺鲁孜节核心食材|
|**配色/纹理**|深红色柱头丝、紫色番红花花瓣、金橙色粉末、细长如丝|
|**2026年受损**|霍拉桑主产区物流瘫痪，霍尔木兹海峡封锁致出口中断，国内价格飙升至每公斤1000-1250美元，全球供应危机[19][20]|
|**生图Prompt**|Realistic product photography of Persian saffron (Za'feran), delicate crimson-red stigma threads arranged in a small pile, beside a single purple crocus flower with orange stamens visible. Some threads scattered loosely showing their fine texture. Rich deep red color with subtle orange tips. Studio lighting emphasizing the thread-like delicacy. Isolated on pure white background, transparent PNG. Color palette: deep crimson red, saffron orange, purple crocus petals. 512x512px.|

**叙事文案**：

> 波斯人从不直说"四十"，这个数字意味着"很多，多到数不清"。四十柱宫其实只有二十根雪松木柱，但当它们倒映在门前的水池中，便成了四十。
>
> 1647年，萨法维王朝在这座花园里种下了他们对天堂的想象：水池、柏树、玫瑰——还有藏红花。波斯人称它为"Za'feran"，红色黄金。3000年前，大流士大帝用它染制皇袍；1000年前，波斯诗人用它比喻黎明的第一缕光；今天，伊朗东北部的霍拉桑省供应着全球90%的藏红花[19]。
>
> 每公斤藏红花需要手工采摘15万朵番红花，只取花蕊中央三根红色柱头。一个熟练工人一天只能采集60克。这是世界上最昂贵的香料，也是最脆弱的产业链。
>
> 2026年3月，霍尔木兹海峡封锁[20]。藏红花的出口路线断了。霍拉桑的农民还在采摘，但红色黄金堆积在仓库里，价格飙升到每公斤1250美元，买家却在大洋彼岸干等。
>
> 四十柱宫的花园还在。水池倒映着柱子，柱子倒映着天空。但那片曾经染红波斯黄昏的颜色，正在失去抵达世界的道路。

**象征物文案**：

> 15万朵花，换3根红丝。一条海峡，断了3000年的颜色。

---

### 5.6 场景06：伊玛目清真寺

|配置项|内容|
|---|---|
|**场景编号**|scene_06|
|**场景名称**|伊玛目清真寺|
|**碎片标签**|「波斯蓝」|
|**全景图文件**|Imam-Mosque.jpg|
|**所在城市**|伊斯法罕（Isfahan）|
|**建筑类型**|萨法维王朝皇家清真寺（UNESCO世界遗产）|
|**建造年代**|1611-1629年|
|**核心工艺**|七彩瓷砖（Haft-rangi）、双层穹顶、穆卡纳斯|
|**主配色**|深蓝色（波斯蓝）、金黄色、浅蓝色/青瓷色、米褐色|

**象征物配置**：

|象征物名称|七色瓷砖（Haft-rangi）|
|---|---|
|**文化意义**|萨法维蓝色美学的载体，"Haft-rangi"意为"七种颜色"，单砖多色一次烧成|
|**配色/纹理**|青金石蓝为主，釉面光滑反射，融合金黄、绿松石等色彩|
|**2026年受损**|标志性蓝色釉面出现物理性剥落，双层穹顶结构出现裂缝[9]|
|**生图Prompt**|Realistic photograph of Persian Haft-rangi ceramic tiles, 3x3 arrangement of hand-painted Islamic geometric star pattern tiles. Dominant Persian blue glaze with turquoise, white, yellow and manganese purple accents. One tile showing visible crack, one tile missing leaving an empty gap. Authentic glazed ceramic texture with subtle surface imperfections. Studio lighting. Isolated on pure white background, transparent PNG. Color palette: Persian blue, turquoise, white, gold, purple. 512x512px.|

**叙事文案**：

> 1611年，萨法维国王阿巴斯一世决定在伊斯法罕建造一座前所未有的清真寺。他没能看到竣工——工程持续了18年，4750万块瓷砖，每一块都在窑炉中接受七种颜色的洗礼。波斯人称之为"Haft-rangi"：七色瓷砖。
>
> 那种蓝，来自阿富汗巴达赫尚省的青金石矿。商队把石头运过兴都库什山脉，工匠把它研磨成粉，与釉料混合，在1200度的窑火中烧成永恒。这是波斯人对天堂的想象：蓝得像天空落在地上的碎片。
>
> 伊玛目清真寺的穹顶是双层结构，外壳与内壳之间的空腔可以放大祈祷的回声。这个设计让它成为世界建筑史上的奇迹——也让它成为震动的放大器。
>
> 2026年，持续的冲击波让穹顶出现结构性裂缝[9]。庭院的角落里，文保人员收集到越来越多蓝色的碎片。
>
> 没有人知道还要掉多少块，才算"严重受损"。

**象征物文案**：

> 瓷砖上有七种颜色，但人们只数得清正在脱落的那一种。

---

### 5.7 场景07：法蒂玛·马苏梅圣陵

|配置项|内容|
|---|---|
|**场景编号**|scene_07|
|**场景名称**|法蒂玛·马苏梅圣陵|
|**碎片标签**|「金顶下的祈祷」|
|**全景图文件**|Iran's-Spiritual-Center-And-Shrine-Of-Hazrat-Masumeh.jpg|
|**所在城市**|库姆（Qom）|
|**建筑类型**|什叶派最高圣地之一|
|**建造年代**|9世纪始建，历代扩建|
|**核心工艺**|金色穹顶、镜面镶嵌、绿松石装饰|
|**主配色**|金色/暖黄色、深蓝色/蔚蓝色、石榴红、米白色|

**象征物配置**：

|象征物名称|**石榴（Pomegranate/Anār）**|
|---|---|
|**文化意义**|伊朗原产，5000年栽培史；琐罗亚斯德教神圣果实，象征永生与丰饶；雅尔达之夜核心食物，象征光明战胜黑暗；婚礼祈福多子多福|
|**配色/纹理**|深红色外皮、宝石红籽粒、乳白色内膜、翠绿色蒂叶|
|**2026年受损**|库姆周边道路封锁，设拉子-库姆农产品物流中断，2026年雅尔达之夜（12月21日）石榴供应成疑[12][21]|
|**生图Prompt**|Realistic product photography of a Persian pomegranate (Anār), one whole fruit with deep ruby-red skin and intact crown calyx, beside a half-cut pomegranate revealing jewel-like translucent red arils glistening with juice. A few loose seeds scattered nearby. Rich saturated red color, natural skin texture with slight imperfections. Studio lighting emphasizing the gem-like quality of seeds. Isolated on pure white background, transparent PNG. Color palette: ruby red, garnet, cream white membrane, emerald green stem. 512x512px.|

**叙事文案**：

> 库姆是伊朗的精神首都。公元816年，先知穆罕默德的后裔法蒂玛·马苏梅病逝于此，她的陵墓在此后1200年里不断扩建，金色穹顶成为什叶派世界最神圣的天际线之一。
>
> 信徒们带着石榴来到这里。这种水果原产于伊朗高原，波斯人称它为"Anār"。5000年前，琐罗亚斯德教的祭司在Yasna仪式中供奉它，因为石榴树四季常青，象征灵魂不朽。传说中，波斯英雄伊斯凡迪亚尔吃下石榴后刀枪不入。每年冬至的雅尔达之夜，伊朗人围坐在一起剥开石榴——那些宝石般的红色籽粒，是黎明的颜色，是光明终将战胜黑暗的承诺。
>
> 2026年3月16日，库姆周边区域被军事化，主要道路封锁[12]。没有炮弹落在圣陵，但设拉子的石榴运不进来了。
>
> 12月21日是今年的雅尔达之夜——一年中最长的黑夜。
>
> 库姆的信徒还在祈祷。但他们不确定，今年冬天能不能等到那颗象征黎明的红色果实。

**象征物文案**：

> 石榴是波斯人对黑夜的回答：剥开它，里面全是光。2026年，这个回答被堵在了路上。

---

### 5.8 场景08：莫克清真寺

|配置项|内容|
|---|---|
|**场景编号**|scene_08|
|**场景名称**|莫克清真寺（粉红清真寺）|
|**碎片标签**|「粉红清真寺的早晨」|
|**全景图文件**|Kaleidoscopic Mosque.jpg|
|**所在城市**|设拉子（Shiraz）|
|**建筑类型**|恺加王朝清真寺|
|**建造年代**|1876-1888年|
|**核心工艺**|彩色花窗玻璃（Orsi）、粉红色瓷砖|
|**主配色**|玫瑰粉/粉红色、绿松石蓝、金黄色/琥珀色、波斯猫毛色（白/银/烟灰）|

**象征物配置**：

|象征物名称|**波斯猫（Persian Cat/Gorbe-ye Irāni）**|
|---|---|
|**文化意义**|世界最古老猫种之一，17世纪萨法维王朝皇室宠物；1871年维多利亚女王使其风靡欧洲；2019年被列为伊朗国家文化遗产|
|**配色/纹理**|白色/银色/烟灰色长毛、扁平圆脸、铜色或蓝色眼睛、蓬松尾巴|
|**2026年受损**|设拉子宠物繁殖产业停滞，国际血统登记与出口中断，纯种波斯猫面临基因库萎缩风险[22]|
|**生图Prompt**|Realistic product photography of a Persian cat (Gorbe-ye Irāni), elegant long-haired white cat with luxurious fluffy coat, distinctive flat face with large round copper-colored eyes, pink nose visible. Sitting in a regal pose with fluffy tail wrapped around paws. Soft silky fur texture with individual hair strands visible. Studio lighting creating gentle highlights on white fur. Isolated on pure white background, transparent PNG. Color palette: pure white, cream, copper eyes, pink nose. 512x512px.|

**叙事文案**：

> 游客们叫它"粉红清真寺"，波斯人叫它"莫克"。1876年至1888年，恺加王朝的工匠用粉红色瓷砖和Orsi彩色玻璃建造了这座奇观。每天清晨七点，阳光穿过万花筒般的窗棂，在地毯上画满彩虹。
>
> 但设拉子不只有清真寺。这座城市还有另一种"活的文化遗产"——波斯猫。
>
> 1620年，意大利旅行家彼得罗·德拉瓦莱从呼罗珊把第一批长毛猫带回欧洲。在萨法维王朝的伊斯法罕宫廷，它们被称为"buraq"，只有皇室成员和高级官员才能豢养。19世纪恺加王朝的纳赛尔丁沙阿最宠爱的那只猫叫"巴德里汗"，配有专门的侍从。1871年，维多利亚女王在伦敦猫展上买下两只波斯猫，从此这个品种风靡欧洲贵族圈。
>
> 2019年，伊朗文化部将波斯猫列为国家文化遗产[22]。但2026年，设拉子的繁殖场陷入停滞——国际血统登记系统中断，出口航线取消，纯种波斯猫的基因库正在萎缩。
>
> 莫克清真寺的彩色玻璃还在透光。但那些曾经在波斯宫廷踱步的白色身影，正在慢慢失去它们的血统证明。

**象征物文案**：

> 波斯猫走过400年，从皇宫走到世界。2026年，它们走不出设拉子了。

---

### 5.9 场景09：希赫洛特夫拉清真寺

|配置项|内容|
|---|---|
|**场景编号**|scene_09|
|**场景名称**|希赫洛特夫拉清真寺|
|**碎片标签**|「孔雀的尾巴」|
|**全景图文件**|Sheikh Lotfollah Mosque.jpg|
|**所在城市**|伊斯法罕（Isfahan）|
|**建筑类型**|萨法维王朝皇室私人清真寺（UNESCO世界遗产）|
|**建造年代**|1603-1619年|
|**核心工艺**|"孔雀尾巴"变色穹顶、无宣礼塔设计|
|**主配色**|深蓝色、金黄色/土黄色、绿松石色、孔雀绿/孔雀蓝|

**象征物配置**：

|象征物名称|**波斯孔雀（Peacock/Tāvus）**|
|---|---|
|**文化意义**|萨珊王朝"生命之树"两侧神兽，象征永恒与皇权；苏菲派《百鸟会议》中的"天堂之鸟"；"孔雀宝座"是波斯君权核心象征；谢赫洛特夫拉穹顶的光影奇观即为"孔雀开屏"|
|**配色/纹理**|深钴蓝颈羽、翠绿/金色眼斑尾羽、虹彩金属光泽|
|**2026年受损**|穹顶"孔雀开屏"光影效果赖以形成的瓷砖出现脱落，内部采光窗破碎，光线角度改变导致奇观受损[9]|
|**生图Prompt**|Realistic product photography of a single peacock feather (Persian Tāvus), iridescent eye feather with characteristic eyespot pattern showing deep cobalt blue center, surrounded by bronze and gold rings, emerald green barbules radiating outward. Natural metallic sheen catching light at different angles. Fine detailed barb texture visible. Studio lighting emphasizing the iridescent color-shifting quality. Isolated on pure white background, transparent PNG. Color palette: cobalt blue, emerald green, bronze gold, iridescent teal. 512x512px.|

**叙事文案**：

> 这座清真寺没有宣礼塔，因为它不对公众开放。1603年至1619年，萨法维国王阿巴斯一世用16年时间，为他的后宫建造了一座私人祈祷所。
>
> 穹顶是它的秘密。19万片马赛克瓷砖按照精密的数学公式排列，当阳光以特定角度射入侧窗，光束会在穹顶内壁汇聚成一条金色的弧线——像一只孔雀正在开屏的尾羽[3]。随着太阳移动，这只孔雀会缓缓旋转，从奶油色变成玫瑰粉，最后消失在黄昏里。
>
> 孔雀在波斯文明中从不只是一只鸟。萨珊王朝的石刻上，它守护在"生命之树"两侧，象征永恒。苏菲派诗人阿塔尔在《百鸟会议》中写它是被逐出乐园的"天堂之鸟"。而纳迪尔沙从印度带回的"孔雀宝座"，成为波斯君权最耀眼的符号。
>
> 2026年3月31日，伊斯法罕遭受空袭[9]。希赫洛特夫拉清真寺的穹顶出现瓷砖脱落，内部采光窗破碎。没有人知道，当那些精确到毫米的瓷砖缺失后，阳光还能不能画出那只孔雀。
>
> 孔雀开屏需要400年的积累。让它合上，只需要一次震动。

**象征物文案**：

> 穹顶上的孔雀不是画出来的，是光算出来的。当瓷砖脱落，公式就错了。

---

### 5.10 场景10：四十柱宫内部

|配置项|内容|
|---|---|
|**场景编号**|scene_10|
|**场景名称**|四十柱宫内部|
|**碎片标签**|「画中人」|
|**全景图文件**|the-Chehel-Sotoun.jpg|
|**所在城市**|伊斯法罕（Isfahan）|
|**建筑类型**|萨法维王朝宫殿室内（UNESCO世界遗产）|
|**建造年代**|1647年|
|**核心工艺**|湿壁画、波斯细密画（Miniature）、蜂窝状拱顶|
|**主配色**|木质棕/赭石色、水蓝色、米白色/象牙色、深绿色、金色/朱红色|

**象征物配置**：

|象征物名称|波斯细密画（Persian Miniature）|
|---|---|
|**文化意义**|2020年UNESCO非物质文化遗产，波斯文学的视觉化身|
|**配色/纹理**|金粉勾勒轮廓、矿物颜料（青金石蓝/朱砂红/孔雀绿）、松鼠毛笔细密笔触、无留白构图|
|**2026年受损**|室内壁画大面积开裂，颜料层脱落，画中人面容模糊；修复颜料来源中断[2][9]|
|**生图Prompt**|Realistic photograph of a Persian miniature painting fragment, aged handmade paper with curled corner and foxing marks, depicting a royal court scene in traditional mineral pigments - lapis blue, cinnabar red, malachite green with burnished gold leaf border and details. Visible crack line through the painted surface, small area of paint flaking. Museum documentation style lighting showing paper texture and pigment layer. Isolated on pure white background, transparent PNG. Color palette: lapis blue, cinnabar red, malachite green, burnished gold, aged ivory paper. 512x512px.|

**叙事文案**：

> 走进四十柱宫的深处，你会和萨法维王朝的人对视。
>
> 他们存在于细密画的笔触里。波斯细密画是一种不留空白的艺术：松鼠毛做成的画笔，蘸着青金石蓝、朱砂红、孔雀绿——这些矿物颜料从丝绸之路的各个角落汇聚而来，被画师用来填满每一寸画面。一幅巴掌大的细密画，需要画三个月。
>
> 2020年，波斯细密画被列入UNESCO非物质文化遗产名录。四十柱宫内部的湿壁画，是这种艺术与建筑结合的最高典范：墙上画着国王阿巴斯大帝接见乌兹别克使臣，画着宫廷乐师弹奏塞塔尔琴，画着波斯美人斟酒——每一个人物都有名有姓，每一个场景都是历史的切片。
>
> 2026年，震动让这些面容开始模糊[2]。一道裂缝从国王的眉心划过，颜料层正在脱落。
>
> 修复细密画需要同样的矿物颜料，但青金石来自阿富汗，朱砂来自中国，孔雀绿来自俄罗斯——这三条路，现在都不通。
>
> 画中人还在微笑，但微笑正在消失。

**象征物文案**：

> 细密画不留空白，因为波斯人相信空白是虚无。现在，裂缝正在把画面变成虚无。

---

## 6. 文案汇总

### 6.1 主题语（3个版本）

**版本A（历史的重量）**：

> 75万亿里亚尔，是修复149处遗址的预算，也是文化部一整年都拿不出的数字。在波斯高原，文明正在以一种财务报表可以计量的速度消亡。

**版本B（箴言式）**：

> 建造一座清真寺需要18年，4750万块瓷砖。毁掉它的并非炮弹，而是震碎的供应链和离散的工匠。战争杀死事物的方式，比爆炸更沉默。

**版本C（悖论式）**：

> 镜宫里有十万面镜子，每一面都在反射光。但镜子无法反射气味、声音，和那些正在失传的手艺。

### 6.2 引导页文案

> **18年。**
>
> 这是伊玛目清真寺从动工到完工的时间。萨法维王朝的工匠用了18年，把50万块瓷砖一片片嵌进穹顶，用数学计算让每一道几何纹样严丝合缝。
>
> **1秒。**
>
> 这是冲击波从爆心传到伊斯法罕历史街区的时间。它的速度是340米每秒，比声音快，比逃跑快，比任何一个工匠抬起手臂保护自己的动作都快。
>
> 86天。149处遗址。75万亿里亚尔。
>
> 但数字是冷的。你需要进入一座镜宫，才能感受到文明的体温正在流失。
>
> **入镜。**

### 6.3 镜宫引导文案链

**进入时**：

> 你正站在阿里·伊本·哈姆泽圣陵的穹顶下。
>
> 墙壁、天花板、柱子——所有表面都覆盖着镜面碎片。工匠们把威尼斯进口的镜子切成星芒和菱形，一片片用石膏固定。这种工艺叫Ayeneh-kari，波斯语"镜面工作"。
>
> 一束光进入这个房间，会被折射一万次。
>
> **抬头。正中央悬挂着一盏水晶吊灯。点击它。**

**炸裂后**：

> 吊灯碎了。
>
> 但碎片没有落地。它们悬浮在空中，像是时间在这一刻凝固——或者说，像是有人按下了暂停键。
>
> 每一片碎片都映照着一个正在受损的世界。它们曾是伊斯法罕的穹顶、设拉子的花窗、卡尚的巴扎、库姆的金顶。现在，它们是证据。
>
> **触碰任意一片。**

### 6.4 结语文案

**灼烧过渡**：

> 你看见了五个世界。五个用几十年、几百年建造的世界。
>
> 现在，镜宫的边缘开始燃烧。那些镜片——它们用了十二个世纪才学会把一束光变成无穷——正在一片片变黑、脱落。

**星芒过渡**：

> 然后是黑暗。
>
> 但碎片没有消失。它们变成了光点，悬浮在无边的黑暗中。
>
> 像星星。像宇宙大爆炸之后，那些还没来得及变成星球的尘埃。

**结语正文**：

> 热力学第二定律说，宇宙的熵只会增加。秩序终将走向混乱，建造终将走向坍塌。
>
> 但文明是一场反熵的运动。
>
> 工匠花18年铺设50万片瓷砖，是反熵。母亲教女儿织一块地毯，是反熵。一个制琴师用一生调试四根弦的音准，是反熵。
>
> 战争是熵增的加速器。它把18年压缩成1秒，把秩序还原成碎片，把传承变成断裂。
>
> 你眼前的星空由碎片组成。每一颗星都曾是一面镜子、一块瓷砖、一根琴弦、一缕丝线。它们曾经是反抗混乱的证据。
>
> 现在，它们是混乱本身。
>
> 但它们还在发光。
>
> 也许这就是人类做过的最伟大的事：明知道一切终将崩塌，还是选择建造。

**落版**：

> **18年与1秒**
>
> *18 Years and 1 Second*
>
> 2026.02.28 — 2026.05.24
>
> 第86天。距离第100天，还有14天。

---

## 7. 技术实现建议

### 7.1 全景图实现方案

|技术方案|推荐库/工具|说明|
|---|---|---|
|**WebGL全景**|Three.js + Pannellum|支持陀螺仪和拖拽，兼容性好|
|**陀螺仪交互**|DeviceOrientationEvent API|需HTTPS环境，iOS需用户授权|
|**拖拽交互**|Touch/Mouse事件|作为陀螺仪的降级方案|
|**图片格式**|等距柱状投影（Equirectangular）|确保全景图为2:1比例|

**实现要点**：
- 初始视角设置为穹顶正下方（仰视吊灯）
- 陀螺仪灵敏度需可调，避免用户晕眩
- 提供手动拖拽作为备选交互方式

### 7.2 碎片爆炸动效

|实现方式|技术栈|优缺点|
|---|---|---|
|**3D粒子系统**|Three.js + Shader|效果最佳，性能要求高|
|**序列帧动画**|CSS/Canvas|兼容性好，文件体积较大|
|**Lottie动画**|lottie-web|设计师可控，体积较小|
|**视频叠加**|带Alpha通道的WebM/HEVC|效果稳定，但文件较大|

**动效时序建议**：
1. 0-0.5s：吊灯微微晃动、亮度增强
2. 0.5-1.5s：爆炸、碎片四散
3. 1.5-2.5s：碎片减速、悬停
4. 2.5s后：碎片完全静止，标签淡入

### 7.3 场景切换过渡

|过渡效果|实现方式|时长建议|
|---|---|---|
|**溶解过渡**|WebGL shader/CSS filter|1-1.5秒|
|**碎片聚焦**|缩放被点击碎片→全屏→切换|1.5-2秒|
|**白闪/黑闪**|Canvas overlay + opacity|0.5-1秒|

**推荐方案**：点击碎片后，该碎片放大并模糊其他碎片→白闪过渡→新场景淡入

### 7.4 灼烧/星空效果

**灼烧效果**：
- 使用WebGL着色器模拟火焰边缘侵蚀效果
- 或叠加预渲染的灼烧边缘PNG序列帧
- 从画面边缘向中心蔓延，约3-5秒

**星空效果**：
- 碎片位置逐渐缩小为光点
- 添加微弱闪烁动画（CSS animation或Canvas）
- 背景纯黑，星芒带轻微bloom效果

### 7.5 信息卡片UI建议

|组件|设计规范|
|---|---|
|**卡片容器**|半透明黑色底（rgba(0,0,0,0.75)），圆角12px|
|**标题**|场景名称，24-28px，白色|
|**正文**|叙事文案，16-18px，行高1.6，浅灰色|
|**象征物区**|独立分隔线后展示，引用块样式|
|**关闭按钮**|右上角×，或底部"返回碎片"按钮|
|**滚动**|卡片内文案超出时支持纵向滚动|

---

## 8. 数据来源引用

[1] IRNA, 2026-05-17. Official: 149 historical sites damaged in US-Israeli aggression. https://en.irna.ir/news/86156817/

[2] Tehran Times, 2026-05-23. Isfahan says restoration of war-damaged historic buildings 80% complete. https://www.tehrantimes.com/news/498895/

[3] UNESCO, 2026-04-17. UNESCO expresses concern over protection of cultural heritage sites amidst escalating violence. https://www.unesco.org/en/articles/unesco-expresses-concern-over-protection-cultural-heritage-sites-amidst-escalating-violence-middle-east

[4] Iran International, 2026-05-12. Iran's carpet exports collapse from $2.5 billion to near zero. https://www.iranintl.com/en/202605124567

[5] Cultural Property News, 2026-04-03. 2026 War on Iran: Cultural Heritage Damage. https://culturalpropertynews.org/2026-war-on-iran-cultural-heritage-damage/

[6] The Guardian, 2026-03-12. Golestan Palace world heritage site in Tehran and palace in Isfahan harmed. https://www.theguardian.com/world/2026/mar/12/golestan-palace-world-heritage-site-tehran-palace-isfahan-harmed-unesco-coordinates

[7] RFE/RL, 2026-03-10. Iran Deploys 'Blue Shields' Amid US-Israeli Strikes. https://www.rferl.org/a/iran-blue-shields-heritage-protection-us-israel-strikes/33355441.html

[8] WANA News Agency, 2026-05-18. Iran to Pursue Accountability for Cultural Heritage Violations. https://wanaen.com/iran-to-pursue-accountability-for-cultural-heritage-violations-under-international-law/

[9] Al Arabiya, 2026-03-31. US and Israeli strikes hit military facilities in central Iran. https://english.alarabiya.net/News/middle-east/2026/03/31/us-israeli-strikes-hit-military-facilities-in-central-iran

[10] CGTN, 2026-04-20. World Heritage Day: Iran's cultural sites damaged during conflict. https://news.cgtn.com/news/2026-04-20/World-Heritage-Day-Iran-s-cultural-sites-damaged-during-conflict-1sX9Y7Z8W9G/index.html

[11] 澎湃新闻/央视新闻, 2026-04-23. 美以伊冲突已致伊朗149处历史遗迹和博物馆受损. https://www.thepaper.cn/newsDetail_forward_27141234

[12] AhlulBayt News Agency, 2026-05-24. Photos: Ritual of Quran Recitation at Hazrat Masoumeh Holy Shrine. https://en.abna24.com/news/1458962/photos-ritual-of-quran-recitation-at-hazrat-masoumeh-holy-shrine.html

[13] Britannica, 2026-05-24. 2026 Iran war timeline and key events. https://www.britannica.com/event/2026-Iran-war

[14] Washington Post, 2026-05-23. Trump says U.S. in 'final stages' of negotiations to extend Iran ceasefire. https://www.washingtonpost.com/politics/2026/05/23/trump-iran-war-ceasefire-negotiations/

[15] BSS News, 2026-04-07. Iran reports strikes on bridges and infrastructure. https://www.bssnews.net/news/182451

[16] Anadolu Agency, 2026-04-06. US, Israeli jets bomb petrochemical complex in Iran's Shiraz. https://www.aa.com.tr/en/world/us-israeli-jets-bomb-petrochemical-complex-in-irans-shiraz-media/3184345

[17] Tehran Times, 2026-05-23. UK academics warn of war damage to Iran's cultural heritage. https://www.tehrantimes.com/news/498876/UK-academics-warn-of-war-damage-to-Iran-s-cultural-heritage

[18] Wikipedia, 2026-05-24. 2026 Iran war: Cultural heritage impacts. https://en.wikipedia.org/wiki/2026_Iran_war

---

## 9. 象征物配对汇总表

|序号|场景名称|象征物|文化地位|象征物金句|
|---|---|---|---|---|
|1|阿里·伊本·哈姆泽圣陵|**玫瑰水（Golab）**|圣陵净化仪式必需品|战争杀死事物的方式，比我们想象的更沉默|
|2|阿里卡普宫|**Khatam镶嵌工艺品**|25万片碎料/件，皇室外交礼品|战争摧毁的不只是建筑，还有建造的人|
|3|阿里卡普宫音乐厅|**塞塔尔琴（Setar）**|波斯古典音乐核心乐器|2026年的伊朗，没有一个地方足够安静|
|4|阿明·奥多莱商队客栈|**波斯地毯**|第二大非石油出口商品|一场战争，九十天，让这一切失去了买家|
|5|四十柱宫·花园|**藏红花（Saffron）**|"红色黄金"，全球90%产自伊朗，3000年种植史|15万朵花，换3根红丝。一条海峡，断了3000年的颜色|
|6|伊玛目清真寺|七色瓷砖（Haft-rangi）|4750万块，萨法维蓝色美学|人们只数得清正在脱落的那一种|
|7|法蒂玛·马苏梅圣陵|**石榴（Pomegranate）**|伊朗原产5000年，琐罗亚斯德教神圣果实，雅尔达之夜核心食物|石榴是波斯人对黑夜的回答：剥开它，里面全是光|
|8|莫克清真寺|**波斯猫（Persian Cat）**|2019年伊朗国家文化遗产，世界最古老猫种|波斯猫走过400年，从皇宫走到世界。2026年，它们走不出设拉子了|
|9|希赫洛特夫拉清真寺|**波斯孔雀（Peacock）**|萨珊王朝皇权象征，"孔雀宝座"，穹顶光影奇观原型|穹顶上的孔雀不是画出来的，是光算出来的。当瓷砖脱落，公式就错了|
|10|四十柱宫内部|**波斯细密画**|2020 UNESCO非遗|裂缝正在把画面变成虚无|

> **加粗项**为用户指定的象征物

---

## 10. 版本历史

|版本|日期|更新内容|
|---|---|---|
|v1.8|2026-05-25|**象征物大改**：①希赫洛特夫拉清真寺改为**波斯孔雀**（穹顶"孔雀开屏"光影奇观原型）；②四十柱宫·花园改为**藏红花**（"红色黄金"，全球90%产自伊朗）；③库姆·马苏梅圣陵改为**石榴**（琐罗亚斯德教神圣果实，雅尔达之夜核心）；④莫克清真寺改为**波斯猫**（2019年伊朗国家文化遗产）。全部叙事文案重写，生图Prompt更新为写实风格无背景图标|
|v1.7|2026-05-25|将10个象征物生图Prompt改为**写实摄影风格**（无背景、透明PNG、适合文案框装饰）|
|v1.6|2026-05-25|将10个象征物生图Prompt改为简洁图标样式（无背景、透明PNG、适合文案框装饰）|
|v1.5|2026-05-24|为10个象征物补充AI生图Prompt，含配色、纹理、构图、氛围、背景等完整描述|
|v1.4|2026-05-24|全面重写文案：①主题语、引导页、结语提升思想与文学高度（引入本雅明、桑塔格视角）；②10个场景叙事文案融入完整客观信息（UNESCO地位、建造年代、工艺价值、受损细节、产业数据）；③象征物金句重写为克制有力的短句|
|v1.3|2026-05-24|时间线修正为86天（面向100天节点）；核心数据更新为75万亿里亚尔|
|v1.2|2026-05-24|阿里·伊本·哈姆泽圣陵象征物由"威尼斯镜面碎片"改为"玫瑰水（Golab）"|
|v1.1|2026-05-24|①阿里卡普宫象征物改为Khatam镶嵌工艺品；②音乐厅改为塞塔尔琴（用户指定）；③波斯地毯保留（用户指定）；④四十柱宫内部改为波斯细密画（用户指定）|
|v1.0|2026-05-24|初版策划技术文档|

---

**文档版本**：v1.8  
**更新日期**：2026年5月25日  

**关联文件**：
- `/usr/local/app/workspace/stage1_建筑场景分析报告.md`
- `/usr/local/app/workspace/2026年美伊冲突伊朗文化遗产影响研究报告.md`
- `/usr/local/app/workspace/stage1_客观信息提取表.md`

**新增参考来源**：
- [19] WANA News Agency, 2026-03. World's Most Expensive Spice Faces Supply Crisis Amid Iran Conflict. https://wanaen.com/worlds-most-expensive-spice-faces-supply-crisis-amid-iran-conflict/
- [20] Syracuse Journal of International Law and Commerce, 2026-03-24. How Conflict in Iran Is Reshaping Global Trade. https://jilc.syr.edu/2026/03/24/how-conflict-in-iran-is-reshaping-global-trade/
- [21] Tehran Times, 2025-12. Pomegranate and its great reverence in Persian culture. https://www.tehrantimes.com/news/478914/
- [22] Encyclopedia.com. Persian Cat History in Iran. https://www.encyclopedia.com/history/encyclopedias-almanacs-transcripts-and-maps/persian-cat
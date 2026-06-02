# 字号规范 / Font Size Spec

## 全项目字号下限（FLOOR）

| 端 | 最小字号 | 备注 |
|---|---|---|
| 桌面（默认） | **15px** | 等于 `.card-title`（"德黑兰·古列斯坦宫"标题） |
| 移动（@media max-width: 480/600px） | **18px** | 等于 `.card-title` 移动版 |

**规则**：
- 整个项目所有可读文字 `font-size` **必须 ≥ 上述值**。
- 装饰性英文小字（坐标、副标题、徽章数字）也一并抬到下限——不再允许"装饰例外"。
- 若新增 UI 文字，CSS `font-size` **不允许**写 `9px / 10px / 10.5px / 11px / 11.5px / 12px / 12.5px / 13px / 14px / 14.5px`。
- 大字（≥16px）按视觉层级正常使用，不受影响。

## 验证方法

每次改完 CSS 后跑：

```bash
grep -nE 'font-size:\s*(1[0-4](\.\d+)?|9(\.\d+)?|[1-8])px' style.css
# 应该返回空。如有匹配 → 违规，必须抬到 15px（桌面）或 18px（移动 @media 内）
```

## 历史背景

2026-06-02 用户明确要求："整个策划的所有文字都放大，最小的文字就是这个字号"
（这个字号 = `.dir-cue-text` 提示文字 = `.card-title` = **15px / 18px**）

之前散落在 style.css 各处的 9~14.5px 字号已统一抬到下限：
- `.splash-*`（开屏小字） 9~12 → 15
- `.map-title .sub`（地图副标题） 10 → 15
- `.coord-label .name / .day / .day-badge`（坐标标签） 8~11 → 15
- `.story-card .card-subtitle`（坐标副标题） 10 → 15
- `.story-card p` / `.story-card p.quiet`（叙事正文/低语） 11.5~13 → 15
- `.story-card.collapse-story p.quiet` 11.5 → 15
- `.next-hint`（移动端继续按钮） 12 → 18
- `.placeholder .en / .note` 10/11 → 15
- `.fragment-deck .deck-bar-text / .deck-slot-q` 12~14 → 15 / 18
- `.dir-mini-label / .dir-mini-short / .dir-mini-expand` 10~13 → 15 / 18
- `.dir-overlay-en / .dir-overlay-coord / .dir-overlay-lines` 10.5~14 → 15 / 18
- `.dir-overlay-symbol-name / .dir-overlay-symbol-quote` 11~12.5 → 15 / 18
- `.finale-block` 系列 11~14.5 → 15 / 18

## 相关代码点

- 字号下限实现：`style.css`（无外部变量 token，直接写死 15/18）
- 提示文字 `dir-cue-text`：CSS 在 `style.css` ~942 行，DOM 在 `directory.js` `setupDirectoryFragments` 末尾
- `card-title / card-subtitle`：`style.css` ~533 行；HTML 由 `app.js` `buildStoryHTML(s, coord, includeHeader)` 输出

## ⚠️ "德黑兰·古列斯坦宫" 单独裸奔禁令

`buildStoryHTML(s, coord, includeHeader)` 第 3 参数：
- **`true`（默认）**：输出完整三件套 = `card-title` + `card-subtitle` + 多行 `<p>`
  - 仅在镜厅 idle 进场（`enterScene`）时使用
- **`false`**：只输出 `<p>` lines，不输出 title/subtitle
  - **崩坏阶段（`triggerChandelierCollapse`）必须传 false**，否则击碎过程中"德黑兰·古列斯坦宫"会以单独一行的形式裸奔在画面顶部

任何场景调用 `buildStoryHTML` 时若**不需要展示完整故事卡 header**，必须显式传 `false`。

---
name: txnews-share
description: 多平台H5分享功能集成 - 支持微信、QQ、腾讯新闻等平台
version: 3.0.0
author: 腾讯新闻设计中心
---

# 多平台分享功能

为 H5 项目提供多平台分享功能，自动识别当前环境（微信、QQ、腾讯新闻），配置分享标题、描述、封面图片。

## 支持平台

| 平台 | 分享方式 | 说明 |
|------|---------|------|
| **腾讯新闻App** | 右上角分享按钮 | 使用 QNJSAPI SDK |
| **微信** | 右上角 "..." 菜单 | 使用 WeixinJSBridge（无需后端签名） |
| **QQ/QQ空间** | 右上角分享按钮 | Meta 标签 + 腾讯开放平台 SDK |
| **普通浏览器** | 浏览器分享功能 | 通过 Meta 标签展示信息 |

---

## 使用场景

- 活动页面分享到微信朋友圈、QQ空间
- 文章详情页多平台传播
- H5页面推广分享
- 用户邀请分享功能

---

## 功能特性

✅ **自动环境识别** - 自动判断微信/QQ/腾讯新闻，调用对应分享方式  
✅ **纯前端实现** - 微信分享使用 WeixinJSBridge，无需后端签名  
✅ **统一参数格式** - 所有平台使用相同的配置  
✅ **Meta 标签支持** - 自动设置 og:* 标签，支持浏览器和 QQ 分享  
✅ **一行代码搞定** - 简单易用，无需关心平台差异

---

## 集成方式

### React / Vue 项目

1. 在 `package.json` 中添加依赖：
   ```json
   {
     "dependencies": {
       "@tencent/qqnews-jsapi": "^1.3.8",
       "@tencent/qn-utils": "latest"
     }
   }
   ```

2. 复制 `assets/share-react.js` 到项目中（比如 `src/utils/share.js`）

3. 在需要的地方导入并调用分享功能

### HTML 项目（原生网页）

1. 在页面中引入腾讯新闻 SDK（仅在腾讯新闻App内使用时需要）：
   ```html
   <script src="https://mat1.gtimg.com/qqcdn/tnewsh5/jsapi/1.3.8/qqnews-jsapi.min.js"></script>
   ```

2. 复制 `assets/share-html.js` 到项目中并引入：
   ```html
   <script src="./share.js"></script>
   ```

3. 调用 `window.setShare()` 方法配置分享信息

---

## 使用方法

```javascript
// 页面加载完成后调用，自动适配所有平台
window.setShare({
  title: '分享标题',
  desc: '分享描述',
  imgUrl: 'https://example.com/cover.jpg',
  link: window.location.href  // 可选，默认当前页面
});
```

**就这么简单！** 代码会自动识别当前环境，选择正确的分享方式。

---

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | String | ✅ | 分享标题 |
| `desc` | String | ✅ | 分享描述（也支持 `content` 字段） |
| `imgUrl` | String | ✅ | 分享封面图（必须 HTTPS） |
| `link` | String | ⭕ | 分享链接（默认当前页面地址） |
| `longTitle` | String | ⭕ | 朋友圈长标题（仅腾讯新闻） |

---

## 代码文件

| 文件 | 适用项目 | 说明 |
|------|----------|------|
| [assets/share-react.js](assets/share-react.js) | React / Vue | 使用 npm 包的方式 |
| [assets/share-html.js](assets/share-html.js) | HTML（原生网页） | 使用 CDN 引入的方式 |

---

## 注意事项

1. **封面图必须使用 HTTPS** - 确保所有平台都能正常显示
2. **在页面加载后调用** - 建议在 `DOMContentLoaded` 事件中配置
3. **多平台测试** - 在微信、QQ、腾讯新闻App中分别测试
4. **SDK版本** - React/Vue 项目使用 npm 包 `@tencent/qqnews-jsapi@^1.3.8`，HTML 项目使用 CDN 版本 `1.3.8`

---

## 辅助功能

如果需要隐藏腾讯新闻的分享按钮：

```javascript
window.hideShareButton();  // 仅在腾讯新闻App中生效
```

---

## 完整示例

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>活动页面</title>
  
  <!-- 引入分享功能 -->
  <script src="./share.js"></script>
</head>
<body>
  <h1>我的活动页面</h1>
  
  <script>
    // 页面加载完成后配置分享
    window.addEventListener('DOMContentLoaded', function() {
      window.setShare({
        title: '稀土用在哪儿？——适合所有人的稀土科普',
        desc: '从手机屏幕到新能源汽车，稀土元素是支撑现代科技的关键材料',
        imgUrl: 'https://inews.gtimg.com/newsapp_bt/0/12171640208_3778/0',
        link: window.location.href
      });
    });
  </script>
</body>
</html>
```

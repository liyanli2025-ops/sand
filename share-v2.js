/**
 * sand v6.0 分享配置 — 微信 / 腾讯新闻 / QQ 多平台分享（纯前端实现）
 * v6 2026-06-03 15:50 关键修复：删除 menu:share:* 自定义埋点监听
 *   原因：WeixinJSBridge.on('menu:share:timeline', ...) 全局只允许一个 handler，
 *        后绑覆盖前绑。本文件在 share-html.js 之后加载，会把 share-html.js 里
 *        负责"触发分享"的 handler 覆盖成"只埋点"的 handler，导致点分享按钮无反应。
 *   方案：埋点改走 QNJSAPI.onShareSuccess + 不监听微信菜单事件，让 share-html.js
 *        的 invoke 路径独占。
 * 依赖：./share-html-v2.js（暴露 window.setShare）+ qqnews-jsapi（CDN）
 * 调用时机：DOMContentLoaded 后自动 setShare()
 */

(function(){
  // 分享方图：相对路径写入，部署脚本会自动按环境（test/production）替换为对应 CDN 哈希 URL
  // 测试 → https://mat1.gtimg.com/qqcdn/redian/sand_test/share_v2.<hash>.png
  // 正式 → https://mat1.gtimg.com/qqcdn/redian/sand/share_v2.<hash>.png
  // 用 v2 后缀避开微信对原 share.png URL 的"无图"缓存（key 是 URL，必须换 URL 才能破）
  var SHARE_IMG_URL = './share_v2.png';

  // 分享落地页：取当前页面地址（兼容测试/正式两套环境，无需写死）
  var SHARE_LINK = window.location.href.split('#')[0];

  // —— 分享文案（AI 拟定，体现项目核心意象：文明的脆弱、记忆的微光） ——
  var SHARE_CONFIG = {
    // 主标题：朋友圈/会话卡片标题（短，有冲击）
    title: '脆弱的文明 · 美伊冲突延宕百日',
    // 长标题：腾讯新闻 longTitle 字段（可稍长，留余韵）
    longTitle: '镜厅的吊灯被击碎了。文明的光，分作十万颗星，落进沙里。',
    // desc：朋友圈摘要 / og:description / 微信会话内文
    desc: '两百年前，工匠把十万面镜片一寸一寸贴上穹顶。如今镜厅在空袭中受损——拾起 5 处微光，让文明的光，在黯淡之前再璀璨一次。',
    imgUrl: SHARE_IMG_URL,
    link: SHARE_LINK
  };

  // 同步 og:* meta 标签（QQ 内 / 浏览器抓取兜底）
  function setMeta(p, c){
    if(!c) return;
    var m = document.querySelector('meta[property="'+p+'"]');
    if(!m){ m = document.createElement('meta'); m.setAttribute('property', p); document.head.appendChild(m); }
    m.content = c;
  }
  setMeta('og:title', SHARE_CONFIG.title);
  setMeta('og:description', SHARE_CONFIG.desc);
  setMeta('og:image', SHARE_CONFIG.imgUrl);
  setMeta('og:url', SHARE_CONFIG.link);

  function doShare(){
    // —— 调试日志：定位"分享拉不起"问题，方便在端内 vConsole / inspect 查看 ——
    var __ua_share = navigator.userAgent;
    console.log('[share] doShare ua=', __ua_share);
    console.log('[share] doShare cfg=', SHARE_CONFIG);
    console.log('[share] window.setShare =', typeof window.setShare,
      ' window.QNJSAPI =', typeof window.QNJSAPI,
      ' window.WeixinJSBridge =', typeof window.WeixinJSBridge);

    if(typeof window.setShare === 'function'){
      try{ window.setShare(SHARE_CONFIG); console.log('[share] setShare OK'); }
      catch(e){ console.warn('[share] setShare error:', e && e.message); }
    }else{
      console.warn('[share] window.setShare not ready, retry 800ms');
      // share-html.js 尚未就位时，稍后重试一次
      setTimeout(function(){
        if(typeof window.setShare === 'function'){
          try{ window.setShare(SHARE_CONFIG); console.log('[share] setShare OK (retry)'); }
          catch(e){ console.warn('[share] setShare retry error:', e && e.message); }
        }else{
          console.error('[share] window.setShare still not defined after retry');
        }
      }, 800);
    }
    // —— 微信渠道埋点：⚠️ 不再监听 menu:share:* 事件 ——
    //   微信的 WeixinJSBridge.on(eventName, handler) 全局只允许一个 handler，
    //   后绑会覆盖前绑。share-html.js 已经绑了 menu:share:timeline / appmessage 用于
    //   invoke 分享，如果这里再绑一次会把分享触发逻辑覆盖掉，导致点分享按钮无反应。
    //   所以微信侧的"分享点击"埋点暂时舍弃；腾讯新闻侧的分享成功回调保留。

    // —— 腾讯新闻分享回调埋点：QNJSAPI 分享成功后触发（参数 channel 表示分享渠道） ——
    try{
      if(window.QNJSAPI && typeof window.QNJSAPI.onShareSuccess === 'function'){
        window.QNJSAPI.onShareSuccess(function(data){
          try{
            if(typeof window.__report === 'function'){
              window.__report('share_click', {
                channel: 'qqnews_' + ((data && data.channel) || 'unknown')
              });
            }
          }catch(e){}
        });
      }
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', doShare, { once:true });
  }else{
    doShare();
  }
})();

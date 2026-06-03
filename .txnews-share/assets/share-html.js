/**
 * 多平台分享功能模块（纯前端实现，无需后端支持）
 * 
 * 两种使用方式：
 * 1. 自动判断环境：window.setShare(config)
 * 2. 手动指定平台：window.initShare() / initWxShare() / initQQShare()
 * 
 * 参数格式：
 * {
 *   title: '分享标题',
 *   desc: '分享描述',
 *   imgUrl: 'https://xxx.jpg',
 *   link: '分享链接'（可选，默认当前页面地址）
 * }
 */

// ============================================
// 环境判断工具函数
// ============================================
const ua = function(toLowerCase) {
  const userAgent = navigator.userAgent;
  return toLowerCase ? userAgent.toLowerCase() : userAgent;
};

const isWorkWeixin = function() {
  return /wxwork/gi.test(ua());
};

const isWeixin = function() {
  return /MicroMessenger/i.test(ua(true)) && !isWorkWeixin();
};

const isQQ = function() {
  return /QQ\//i.test(ua()) && !/MicroMessenger/i.test(ua());
};

const isQQNews = function() {
  return /qqnews/i.test(ua(true));
};

// ============================================
// 腾讯新闻分享
// ============================================
window.initShare = async function(config) {
  const desc = config.desc || config.content;
  
  await window.QNJSAPI.ensureJsBridgeReady();
  await window.QNJSAPI.setActionBtnStyle({ type: 1 });
  await window.QNJSAPI.setShareInfo({
    title: config.title,
    longTitle: config.longTitle || config.title,
    content: desc,
    url: config.link || config.url || window.location.href,
    imgUrl: config.imgUrl
  });
};

window.hideShareButton = async function() {
  await window.QNJSAPI.ensureJsBridgeReady();
  await window.QNJSAPI.setActionBtnStyle({ type: 0 });
};

// ============================================
// 微信分享（使用 WeixinJSBridge，无需后端签名）
// ============================================
window.initWxShare = function(config) {
  const shareData = {
    title: config.title,
    desc: config.desc || config.content || '',
    link: config.link || config.url || window.location.href,
    imgUrl: config.imgUrl
  };

  const onBridgeReady = function() {
    window.WeixinJSBridge.on('menu:share:timeline', function() {
      window.WeixinJSBridge.invoke('shareTimeline', {
        img_url: shareData.imgUrl,
        img_width: '160',
        img_height: '160',
        link: shareData.link,
        desc: shareData.desc,
        title: shareData.title
      });
    });

    window.WeixinJSBridge.on('menu:share:appmessage', function() {
      window.WeixinJSBridge.invoke('sendAppMessage', {
        img_url: shareData.imgUrl,
        link: shareData.link,
        desc: shareData.desc,
        title: shareData.title
      });
    });
  };

  if (window.WeixinJSBridge) {
    onBridgeReady();
  } else {
    document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
  }
};

// ============================================
// QQ分享（Meta 标签 + 腾讯开放平台 SDK）
// ============================================
const setMetaTag = function(property, content) {
  if (!content) return;
  let meta = document.querySelector('meta[property="' + property + '"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const loadScript = function(url, callback) {
  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
};

window.initQQShare = function(config) {
  const shareData = {
    title: config.title,
    desc: config.desc || config.content || '',
    link: config.link || config.url || window.location.href,
    imgUrl: config.imgUrl
  };

  setMetaTag('og:title', shareData.title);
  setMetaTag('og:description', shareData.desc);
  setMetaTag('og:image', shareData.imgUrl);
  setMetaTag('og:url', shareData.link);

  const doSetShareInfo = function() {
    if (window.setShareInfo) {
      window.setShareInfo({
        title: shareData.title,
        summary: shareData.desc,
        pic: shareData.imgUrl,
        url: shareData.link
      });
    }
  };

  if (window.setShareInfo) {
    doSetShareInfo();
  } else {
    loadScript('https://qzonestyle.gtimg.cn/qzone/qzact/common/share/share.js', doSetShareInfo);
  }
};

// ============================================
// 统一分享入口（自动判断环境）
// ============================================
window.setShare = function(config) {
  if (isQQNews()) {
    window.initShare(config);
  } else if (isWeixin()) {
    window.initWxShare(config);
  } else {
    window.initQQShare(config);
  }
};

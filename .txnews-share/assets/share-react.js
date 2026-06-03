/**
 * 多平台分享功能 - React / Vue 项目
 * 支持微信分享、腾讯新闻App分享、QQ分享
 * 
 * 使用方式：
 * import { setShare } from './share-react.js';
 * 
 * setShare(defaultShare, params);
 */

import { isQQNews, isWeixin } from '@tencent/qn-utils';
import { setShareInfo, setActionBtnStyle } from '@tencent/qqnews-jsapi';

// ============ 微信分享 ============

export const wxShare = (params) => {
  const onBridgeReady = () => {
    // 分享到朋友圈
    window.WeixinJSBridge.on('menu:share:timeline', () => {
      window.WeixinJSBridge.invoke('shareTimeline', {
        img_url: params.imgUrl,
        img_width: '160',
        img_height: '160',
        link: params.url,
        desc: params.content,
        title: params.title,
      });
    });
    // 分享到消息
    window.WeixinJSBridge.on('menu:share:appmessage', () => {
      window.WeixinJSBridge.invoke('sendAppMessage', {
        img_url: params.imgUrl,
        link: params.url,
        desc: params.content,
        title: params.title,
      });
    });
  };

  if (window.WeixinJSBridge) {
    onBridgeReady();
  } else {
    document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
  }
};

// ============ 设置 Meta 标签（QQ分享）============

const setMetaAttr = (selector, content) => {
  const meta = document.querySelector(selector);
  if (meta && content) {
    meta.content = content;
  }
};

export const setMetaContent = (params) => {
  setMetaAttr('meta[property="og:image"]', params.imgUrl);
  setMetaAttr('meta[property="og:title"]', params.title);
  setMetaAttr('meta[property="og:description"]', params.content);
  setMetaAttr('meta[property="og:url"]', params.url);
};

// ============ 加载外部 JS ============

const loadjs = (url, callback) => {
  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
};

// ============ 通用设置分享 ============

export const setShare = (defaultShare, params) => {
  const shareParam = { ...defaultShare, ...params };

  // 腾讯新闻App分享
  if (isQQNews()) {
    // 1. 显示分享按钮 (type: 1 显示, 0 隐藏)
    setActionBtnStyle({ type: 1 }).catch(err => {
      console.error('显示分享按钮失败:', err);
    });
    
    // 2. 设置分享内容
    setShareInfo({
      title: shareParam.title || '',
      longTitle: shareParam.longTitle,
      content: shareParam.content || '',
      url: shareParam.url || '',
      imgUrl: shareParam.imgUrl,
    });
  }

  // 微信分享
  if (isWeixin()) {
    wxShare(shareParam);
  }

  // QQ分享（通过 meta 标签）
  setMetaContent(shareParam);

  // QQ分享（通过 setShareInfo）
  const doShareInfo = () => {
    window.setShareInfo?.({
      title: shareParam.title,
      summary: shareParam.content,
      pic: shareParam.imgUrl,
      url: shareParam.url,
    });
  };

  if (window.setShareInfo) {
    doShareInfo();
  } else {
    loadjs('https://qzonestyle.gtimg.cn/qzone/qzact/common/share/share.js', doShareInfo);
  }
};

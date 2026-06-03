/**
 * sand v5.1 灯塔上报
 * 活动 ID：sand_h5（聚不起的沙 / 脆弱的文明 · 美伊冲突 100 天）
 *
 * 上报点位：
 *   - 自动：page_view（页面曝光 PV）
 *   - 自动：click_uv（v5.2 新增：首次任意点击/触屏，全页面去重一次，统计点击 UV）
 *   - 自动：stay_duration（用户离开/切后台时上报停留时长，秒）
 *   - 手动：window.__report(eventCode, params)
 *       - enter_btn          点击「回到现场」
 *       - chandelier_break   点击吊灯/吊灯文字（碎裂触发）
 *       - fragment_open      点击碎片（带 fragmentKey）
 *       - fragment_expand    点击「查看碎片故事」长文案展开（带 fragmentKey）
 *       - finale_reach       到达尾声页（5 个碎片全部点完后触发）
 *       - share_intent       点击分享提示/logo 唤起分享菜单
 */
(function () {
  var ACTIVITY_ID = 'sand_h5';
  var APPKEY = 'JS03W1ML3L0KIW';
  var SDK_URL = 'https://beaconcdn.qq.com/sdk/3.3.1/beacon_web.min.js';

  var _beacon = null;
  var _ready = false;
  var _pendingQueue = [];
  var _pageStartTime = Date.now();
  var _stayReported = false; // 防止 beforeunload + visibilitychange 双触发

  // —— 工具函数 ——
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }
  function getUrlParam(name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
    var search = window.location.search.substr(1);
    var match = search.match(reg);
    return match ? decodeURIComponent(match[2]) : '';
  }
  function getOpenEnv() {
    var ua = navigator.userAgent;
    if (/qqnews/i.test(ua)) return 'news';
    if (/\sQQ\//i.test(ua)) return 'qq';
    if (/MicroMessenger/i.test(ua)) return 'wx';
    if (/MQQBrowser/i.test(ua)) return 'qqBrowser';
    return 'browser';
  }
  function getBaseParams(extra) {
    var params = {
      activityId: ACTIVITY_ID,
      openEnv: getOpenEnv(),
      openFrom: getUrlParam('ADTAG') || 'unknown',
      pageUrl: window.location.href,
      referrer: document.referrer || '',
      timestamp: Date.now()
    };
    var openid = getCookie('openid') || getCookie('open_openid');
    if (openid) params.openid = openid;
    var uin = getCookie('uin');
    if (uin) params.qquin = uin;
    if (extra) {
      for (var k in extra) {
        if (extra.hasOwnProperty(k)) params[k] = extra[k];
      }
    }
    return params;
  }

  // —— 实际发送 ——
  function send(EventCode, Params) {
    if (!_beacon) {
      _pendingQueue.push({ EventCode: EventCode, Params: Params });
      return;
    }
    try {
      _beacon.onUserAction(EventCode, Params);
    } catch (e) {
      // 静默：上报失败绝不影响业务
    }
  }

  // —— 暴露给业务代码调用 ——
  // window.__report('chandelier_break', { extra: 'xxx' })
  window.__report = function (eventCode, extra) {
    var params = getBaseParams(extra || {});
    params.eventCode = eventCode;
    send('news_h5_common_click', params);
  };

  // —— 页面曝光 PV ——
  function reportView() {
    var params = getBaseParams({ eventCode: 'page_view' });
    send('news_h5_common_view', params);
  }

  // —— 点击 UV（v5.2 新增）——
  // 用户首次在页面上发生任意点击/触屏时上报一次，同一会话内不重复
  // UV 去重由灯塔后台按 openid/qimei 完成，这里只保证「同会话只发一次」
  // 监听 capture 阶段，确保被业务 stopPropagation 的点击也能捕获到
  var _clickReported = false;
  function reportClickUV(e) {
    if (_clickReported) return;
    _clickReported = true;
    // 标记 sessionStorage：刷新页面同会话也不重复上报（会话级 UV）
    try {
      if (window.sessionStorage && sessionStorage.getItem('sand_click_uv')) {
        return;
      }
      if (window.sessionStorage) sessionStorage.setItem('sand_click_uv', '1');
    } catch (_) {}
    var extra = { eventCode: 'click_uv' };
    // 记录首次点击的目标类型（粗粒度，便于看用户从哪个交互启动）
    try {
      if (e && e.type) extra.firstEvent = e.type;
      var t = e && (e.target || e.srcElement);
      if (t && t.tagName) extra.firstTag = String(t.tagName).toLowerCase();
      if (t && t.id) extra.firstId = String(t.id).slice(0, 40);
    } catch (_) {}
    var params = getBaseParams(extra);
    send('news_h5_common_click', params);
    // 上报后即解绑（节省后续监听开销）
    unbindClickUV();
  }
  function bindClickUV() {
    // 同会话已报过就不再绑
    try {
      if (window.sessionStorage && sessionStorage.getItem('sand_click_uv')) {
        _clickReported = true;
        return;
      }
    } catch (_) {}
    // capture 阶段 + passive，避免被业务 stopPropagation 拦掉，且不影响滚动性能
    document.addEventListener('click', reportClickUV, true);
    document.addEventListener('touchstart', reportClickUV, { capture: true, passive: true });
    document.addEventListener('pointerdown', reportClickUV, true);
  }
  function unbindClickUV() {
    try {
      document.removeEventListener('click', reportClickUV, true);
      document.removeEventListener('touchstart', reportClickUV, { capture: true, passive: true });
      document.removeEventListener('pointerdown', reportClickUV, true);
    } catch (_) {}
  }

  // —— 停留时长（页面隐藏/卸载时上报，秒为单位） ——
  function reportStay() {
    if (_stayReported) return;
    _stayReported = true;
    var stayMs = Date.now() - _pageStartTime;
    var stay = Math.round(stayMs / 1000);
    var params = getBaseParams({
      eventCode: 'stay_duration',
      stay: stay,           // 秒
      stayMs: stayMs        // 毫秒（原始值，方便看分布）
    });
    // 用 sendBeacon 兜底（页面卸载时确保发出）
    try {
      if (navigator.sendBeacon && _beacon && _beacon.onUserAction) {
        _beacon.onUserAction('news_h5_common_click', params);
      } else {
        send('news_h5_common_click', params);
      }
    } catch (e) {}
  }

  function bindStayReport() {
    // 切到后台 / 锁屏 / 切应用：visibilitychange hidden
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') reportStay();
      else if (document.visibilityState === 'visible') {
        // 用户回来了，重置开始时间 + 重置 reported 标志（下次离开再发）
        _pageStartTime = Date.now();
        _stayReported = false;
      }
    });
    // 关闭页面 / 跳转
    window.addEventListener('pagehide', reportStay);
    window.addEventListener('beforeunload', reportStay);
  }

  // —— 初始化 ——
  function doInit() {
    try {
      _beacon = new window.BeaconAction({
        appkey: APPKEY,
        versionCode: '1.0.0',
        channelID: 'h5',
        strictMode: false,
        delay: 1000
      });
      _ready = true;
      // 处理之前被加入队列的事件
      while (_pendingQueue.length) {
        var item = _pendingQueue.shift();
        try { _beacon.onUserAction(item.EventCode, item.Params); } catch (e) {}
      }
      reportView();
      bindStayReport();
      bindClickUV();
    } catch (e) {
      // 上报初始化失败不影响业务
    }
  }

  function loadSDK() {
    if (window.BeaconAction) { doInit(); return; }
    var s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = doInit;
    s.onerror = function () { /* 静默 */ };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSDK);
  } else {
    loadSDK();
  }
})();

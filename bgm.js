/**
 * 背景音乐管理模块（sand · 聚不起的沙）
 * - 循环播放背景音乐
 * - 提供右下角控制按钮，切换播放/暂停
 * - 页面首次用户交互（点击/触摸）时尝试播放，绕过浏览器自动播放限制
 *
 * 暴露全局对象 window.BGM:
 *   BGM.play()    主动播放（需在用户手势回调中调用）
 *   BGM.pause()   主动暂停
 *   BGM.toggle()  切换播放/暂停
 *   BGM.fadeTo(targetVolume, durationMs)  音量渐变（finale 时可缓降）
 *   BGM.isPlaying 当前是否在播放
 */
(function () {
  'use strict';

  // 跟 app.js 里的 GLB 模型保持一致：本地用相对路径，线上用 CDN 完整 URL
  // （部署脚本不识别 .mp3 后缀，mp3 文件已手动 tupload 到 CDN）
  var _isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var _CDN_BASE = location.hostname === 'testqqnews.qq.com'
    ? 'https://mat1.gtimg.com/qqcdn/redian/sand_test/'
    : 'https://mat1.gtimg.com/qqcdn/redian/sand/';
  var AUDIO_URL = _isLocal
    ? './leberch-meditative-ambient_v2.mp3'
    : _CDN_BASE + 'leberch-meditative-ambient_v2.mp3';
  var DEFAULT_VOLUME = 0.4;

  // 优先复用 HTML 里的 <audio id="bgm-audio">；找不到时回退 new Audio()
  var audio = document.getElementById('bgm-audio');
  if (audio) {
    audio.src = AUDIO_URL;
  } else {
    audio = new Audio(AUDIO_URL);
  }
  audio.loop = true;
  audio.volume = DEFAULT_VOLUME;
  audio.preload = 'auto';
  // iOS Safari 需要这几个属性才能内联播放
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  audio.setAttribute('x5-playsinline', '');

  var btn = null;
  var isPlaying = false;
  // 用户是否主动暂停过（主动暂停后不应被自动恢复）
  var userPaused = false;

  function updateBtn() {
    if (!btn) return;
    if (isPlaying) {
      btn.classList.add('playing');
      btn.classList.remove('paused');
      btn.setAttribute('aria-label', '暂停背景音乐');
      btn.setAttribute('title', '暂停背景音乐');
    } else {
      btn.classList.add('paused');
      btn.classList.remove('playing');
      btn.setAttribute('aria-label', '播放背景音乐');
      btn.setAttribute('title', '播放背景音乐');
    }
  }

  function doPlay() {
    var p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(function () {
        isPlaying = true;
        userPaused = false;
        updateBtn();
      }).catch(function () {
        // 自动播放被浏览器拦截；保持暂停状态，等下一次用户交互
        isPlaying = false;
        updateBtn();
      });
    } else {
      isPlaying = true;
      userPaused = false;
      updateBtn();
    }
  }

  function doPause() {
    try { audio.pause(); } catch (e) {}
    isPlaying = false;
    updateBtn();
  }

  function toggle() {
    if (isPlaying) {
      userPaused = true;
      doPause();
    } else {
      userPaused = false;
      doPlay();
    }
  }

  // 音量渐变（finale 缓降可用）
  var fadeTimer = null;
  function fadeTo(targetVolume, durationMs) {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    targetVolume = Math.max(0, Math.min(1, targetVolume));
    durationMs = Math.max(50, durationMs || 800);
    var startVolume = audio.volume;
    var startTime = performance.now();
    fadeTimer = setInterval(function () {
      var t = (performance.now() - startTime) / durationMs;
      if (t >= 1) {
        audio.volume = targetVolume;
        clearInterval(fadeTimer);
        fadeTimer = null;
        return;
      }
      audio.volume = startVolume + (targetVolume - startVolume) * t;
    }, 30);
  }

  // audio 事件同步内部状态
  audio.addEventListener('play', function () { isPlaying = true; updateBtn(); });
  audio.addEventListener('pause', function () { isPlaying = false; updateBtn(); });
  audio.addEventListener('ended', function () { isPlaying = false; updateBtn(); });

  // 注入右下角控制按钮
  function injectButton() {
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'bgm-toggle-btn';
    btn.className = 'bgm-toggle-btn paused';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', '播放背景音乐');
    btn.setAttribute('title', '播放背景音乐');
    btn.innerHTML =
      '<span class="bgm-icon bgm-icon-playing" aria-hidden="true">' +
      '<span class="bgm-bar"></span><span class="bgm-bar"></span><span class="bgm-bar"></span>' +
      '</span>' +
      '<span class="bgm-icon bgm-icon-paused" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 9v6h4l5 5V4L7 9H3z"></path>' +
      '<line x1="16" y1="8" x2="22" y2="14"></line>' +
      '<line x1="22" y1="8" x2="16" y2="14"></line>' +
      '</svg>' +
      '</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    document.body.appendChild(btn);
    updateBtn();
  }

  // 首次用户交互时尝试播放（默认即播：用户点开始/任意交互瞬间）
  function tryAutoplayOnFirstInteraction() {
    // 先尝试一次直接播放（部分浏览器/WebView 允许）
    doPlay();

    var fired = false;
    function handler() {
      if (fired) return;
      fired = true;
      ['click', 'touchend', 'pointerup', 'keydown'].forEach(function (ev) {
        document.removeEventListener(ev, handler, true);
      });
      if (!userPaused && !isPlaying) doPlay();
    }
    ['click', 'touchend', 'pointerup', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, handler, true);
    });
  }

  function init() {
    injectButton();
    tryAutoplayOnFirstInteraction();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BGM = {
    play: doPlay,
    pause: doPause,
    toggle: toggle,
    fadeTo: fadeTo,
    get isPlaying() { return isPlaying; },
    get volume() { return audio.volume; },
    set volume(v) { audio.volume = Math.max(0, Math.min(1, v)); }
  };
})();

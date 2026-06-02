/* ================================================================
 *  《聚不起的沙》· 伊朗 100 天 · 沉浸式星图（AR-like）
 * ================================================================ */

/* ======== 开屏页逻辑 ======== */
const splashEl = document.getElementById('splash');
const splashVideo = document.getElementById('splashVideo');
const splashEnterBtn = document.getElementById('splashEnter');
let splashDismissed = false;

// 视频就绪后渐入
if(splashVideo){
  const showVideo = () => { splashVideo.classList.add('ready'); };
  if(splashVideo.readyState >= 3) showVideo();
  else splashVideo.addEventListener('canplaythrough', showVideo, { once: true });
  // 兜底：2 秒后无论如何都显示（低端机可能不触发 canplaythrough）
  setTimeout(showVideo, 2000);
}

function dismissSplash(){
  if(splashDismissed) return;
  splashDismissed = true;

  // ★★★ 在用户手势栈最顶层、同步调 iOS 陀螺仪权限请求 ★★★
  //    这是 iOS Safari 唯一稳定接受的时机：用户点击的同一个 tick 内、未脱离手势栈、未 await
  //    即使后续 splash 淡出/场景加载都在异步进行也不影响
  if(typeof DeviceOrientationEvent !== 'undefined' &&
     typeof DeviceOrientationEvent.requestPermission === 'function'){
    try{
      DeviceOrientationEvent.requestPermission().then(state => {
        console.log('[gyro] iOS permission state =', state);
        if(state === 'granted'){
          window.__gyroPermissionGranted = true;
          // 通知 setupGyro 已经授权，可以挂监听了
          if(typeof window.__gyroAttachListeners === 'function'){
            window.__gyroAttachListeners('splash-granted');
          }
        }
      }).catch(err => {
        console.warn('[gyro] iOS requestPermission rejected:', err && err.message);
      });
    }catch(e){
      console.warn('[gyro] iOS requestPermission threw:', e && e.message);
    }
  }

  splashEl.classList.add('fade-out');
  document.body.classList.remove('splash-mode');
  // 不进地图，直接进场景 1
  document.body.classList.add('scene-mode');
  // 立即隐藏 scene-bg（CSS 背景图是工作室的，不要显示）
  const sceneBgEl = document.querySelector('.scene-bg');
  if(sceneBgEl) sceneBgEl.style.display = 'none';

  // —— 让 #stage 在 splash 淡出阶段就开始渐入，避免中间黑场 ——
  //    splash 0.7s 淡出 + #stage 1.0s 渐入，时间重叠形成"叠化转场"
  const stageEl = document.getElementById('stage');
  if(stageEl){
    // 立即触发 1.0s 透明度渐入（CSS transition: opacity 1.0s ease）
    requestAnimationFrame(() => { stageEl.classList.add('scene-fade-in'); });
  }

  // 立即启动场景加载逻辑（不等 splash 完全消失）
  // splash 此刻还在淡出，但底下镜宫已经开始构建 + 渐入，用户视觉上是"叠化"而非"黑场"
  autoEnterGolestan();

  // 800ms 后清理 splash DOM（此时 fade-out 0.7s 已完成）
  setTimeout(() => {
    if(splashEl && splashEl.parentNode){
      splashVideo.pause();
      splashVideo.removeAttribute('src');
      splashVideo.load();
      splashEl.parentNode.removeChild(splashEl);
    }
  }, 800);
}

if(splashEnterBtn){
  splashEnterBtn.addEventListener('click', dismissSplash);
  splashEnterBtn.addEventListener('touchend', (e) => { e.preventDefault(); dismissSplash(); });
}
// 点击开屏页任意位置也可进入（延迟 3 秒，等动画播完）
if(splashEl){
  setTimeout(() => {
    splashEl.addEventListener('click', dismissSplash);
  }, 3000);
}

const canvas = document.getElementById('stage');
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// —— 自适应粒子数：根据设备能力分级 ——
// 桌面：400k（好机器丝滑），移动：150k（中端 30fps、旗舰 60fps）
// 检测到内存/CPU 紧张时降级
function pickParticleCount(){
  if(!isMobile) return 400000;
  // 移动端：根据 hardwareConcurrency / deviceMemory 降级
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // 单位 GB，部分浏览器不支持
  // 旗舰（8 核 + 8GB+）→ 150k；中端 → 100k；低端 → 60k
  if(cores >= 8 && mem >= 6) return 150000;
  if(cores >= 6 && mem >= 4) return 110000;
  return 70000;
}
const COUNT = pickParticleCount();
console.log('[perf] 粒子数 COUNT =', COUNT, ' isMobile =', isMobile,
            ' cores =', navigator.hardwareConcurrency, ' mem =', navigator.deviceMemory);
const AMBIENT_COUNT = isMobile ? 300 : 600;

/* ---------- 通用模型管理：按场景 ID 加载不同 GLB ---------- */
const _isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const _CDN = 'https://mat1.gtimg.com/qqcdn/redian/sand/';
const MODELS = {
  golestan: {
    url: _isLocal ? './chandelier_compressed.glb' : _CDN + 'chandelier_compressed.glb',
    sampledPoints: null, loading: false, loadFailed: false,
    targetHeight: 170,
    tiltZ: 0, tiltX: 0,
    yOffset: 75,
    gltfScene: null,
    envMap: null,
    metalMeshes: [],
    crystalMeshes: [],
    shardMesh: null,
    shardData: null,
    frameGroup: null,
    collapseState: 'idle',
  },
  tehran: {
    url: _isLocal ? './setar__persian_musical_instrument_compressed.glb' : _CDN + 'setar__persian_musical_instrument_compressed.glb',
    sampledPoints: null, loading: false, loadFailed: false,
    targetHeight: 95,
    tiltZ: 12, tiltX: -15,
    yOffset: 50,
  },
};
// 兼容旧变量名（大量旧代码引用）
let kamanchehSampledPoints = null;
let kamanchehLoading = false;
let kamanchehLoadFailed = false;

/* ---------- 通用模型加载 + 表面采样 ---------- */
function loadModelForScene(sceneId){
  const mdl = MODELS[sceneId];
  if(!mdl) return;
  if(mdl.sampledPoints || mdl.loading || mdl.loadFailed) return;
  if(typeof THREE.GLTFLoader === 'undefined' || typeof THREE.MeshSurfaceSampler === 'undefined'){
    console.warn('[model] GLTFLoader 或 MeshSurfaceSampler 未加载');
    mdl.loadFailed = true;
    return;
  }
  mdl.loading = true;
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath(_isLocal ? './draco/' : _CDN + 'draco/');
  const loader = new THREE.GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  console.log('[model] 开始加载:', sceneId, mdl.url);
  loader.load(mdl.url, (gltf) => {
    try{
      /* ====== 场景 1 新管线：保存原始 gltf.scene + 分类 mesh ====== */
      if(sceneId === 'golestan'){
        const mdlG = MODELS.golestan;
        // 保存原始场景图
        mdlG.gltfScene = gltf.scene;
        gltf.scene.updateMatrixWorld(true);

        // 分类 mesh：按名称区分金属框架 vs 水晶坠子
        gltf.scene.traverse((o) => {
          if(!o.isMesh) return;
          const nm = (o.name || '').toLowerCase();
          const isCrystal = nm.includes('crystal') || nm.includes('glass');
          if(isCrystal){
            mdlG.crystalMeshes.push(o);
          } else {
            mdlG.metalMeshes.push(o);
          }
        });
        console.log('[golestan] 分类完成 —— 金属:', mdlG.metalMeshes.length, '水晶:', mdlG.crystalMeshes.length);

        // 生成 envMap
        const panoTex = panoTextures['golestan'];
        if(panoTex && panoTex !== 'loading'){
          const pmrem = new THREE.PMREMGenerator(renderer);
          pmrem.compileEquirectangularShader();
          mdlG.envMap = pmrem.fromEquirectangular(panoTex).texture;
          pmrem.dispose();
          console.log('[golestan] PMREM envMap 生成完成');
        } else {
          // 全景图还没加载完，稍后在 enterScene 时再尝试
          console.log('[golestan] envMap 延迟生成（全景图未就绪）');
        }

        // 预生成八面体碎片（用于崩塌时替代水晶坠子）
        initChandelierShards(mdlG);
      }
      /* ====== END 新管线 ====== */

      const meshes = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if(o.isMesh && o.geometry){
          const g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          if(!g.attributes.normal) g.computeVertexNormals();
          meshes.push({ geometry: g, areaWeight: 1 });
        }
      });
      if(meshes.length === 0) throw new Error('no mesh found');

      const merged = mergeMeshGeometries(meshes);
      merged.computeBoundingBox();

      const origSize = new THREE.Vector3();
      const origCenter = new THREE.Vector3();
      merged.boundingBox.getSize(origSize);
      merged.boundingBox.getCenter(origCenter);
      console.log('[model]', sceneId, '原始 bbox.size:', origSize.x.toFixed(3), origSize.y.toFixed(3), origSize.z.toFixed(3));

      const maxAxisLen = Math.max(origSize.x, origSize.y, origSize.z);
      const TARGET_HEIGHT = mdl.targetHeight;
      const scale = TARGET_HEIGHT / Math.max(maxAxisLen, 0.0001);

      merged.applyMatrix4(new THREE.Matrix4().makeTranslation(-origCenter.x, -origCenter.y, -origCenter.z));
      merged.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));

      if(origSize.x === maxAxisLen){
        merged.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2));
      } else if(origSize.z === maxAxisLen){
        merged.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2));
      }
      merged.computeBoundingBox();
      merged.computeVertexNormals();

      const tmpMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
      const sampler = new THREE.MeshSurfaceSampler(tmpMesh).build();
      const SAMPLE_N = COUNT;
      const OVER_N = Math.floor(SAMPLE_N * 4);
      const candP = new Float32Array(OVER_N * 3);
      const candN = new Float32Array(OVER_N * 3);
      const candWeight = new Float32Array(OVER_N);
      const _tmpP = new THREE.Vector3();
      const _tmpN = new THREE.Vector3();

      const fSize = new THREE.Vector3();
      merged.boundingBox.getSize(fSize);
      const bx = fSize.x*0.5, by = fSize.y*0.5;

      for(let i=0; i<OVER_N; i++){
        sampler.sample(_tmpP, _tmpN);
        candP[i*3]   = _tmpP.x;
        candP[i*3+1] = _tmpP.y;
        candP[i*3+2] = _tmpP.z;
        candN[i*3]   = _tmpN.x;
        candN[i*3+1] = _tmpN.y;
        candN[i*3+2] = _tmpN.z;
        // 均匀权重（场景特化的加权由 build 函数处理）
        candWeight[i] = 1.0;
      }

      // 按权重抽样
      const totalW = candWeight.reduce((a,b)=>a+b, 0);
      const pts = new Float32Array(SAMPLE_N * 3);
      const nrms = new Float32Array(SAMPLE_N * 3);
      const cumW = new Float32Array(OVER_N);
      let acc = 0;
      for(let i=0; i<OVER_N; i++){ acc += candWeight[i]; cumW[i] = acc; }
      for(let i=0; i<SAMPLE_N; i++){
        const r = Math.random() * totalW;
        let lo = 0, hi = OVER_N - 1;
        while(lo < hi){ const mid = (lo+hi)>>1; if(cumW[mid]<r) lo=mid+1; else hi=mid; }
        pts[i*3]   = candP[lo*3];
        pts[i*3+1] = candP[lo*3+1];
        pts[i*3+2] = candP[lo*3+2];
        nrms[i*3]   = candN[lo*3];
        nrms[i*3+1] = candN[lo*3+1];
        nrms[i*3+2] = candN[lo*3+2];
      }

      // 倾斜
      if(mdl.tiltZ){
        const rad = mdl.tiltZ * Math.PI/180;
        const c = Math.cos(rad), s = Math.sin(rad);
        for(let i=0; i<SAMPLE_N; i++){
          const x=pts[i*3], y=pts[i*3+1];
          pts[i*3]=x*c-y*s; pts[i*3+1]=x*s+y*c;
          const nx=nrms[i*3], ny=nrms[i*3+1];
          nrms[i*3]=nx*c-ny*s; nrms[i*3+1]=nx*s+ny*c;
        }
      }
      if(mdl.tiltX){
        const rad = mdl.tiltX * Math.PI/180;
        const c = Math.cos(rad), s = Math.sin(rad);
        for(let i=0; i<SAMPLE_N; i++){
          const y=pts[i*3+1], z=pts[i*3+2];
          pts[i*3+1]=y*c-z*s; pts[i*3+2]=y*s+z*c;
          const ny=nrms[i*3+1], nz=nrms[i*3+2];
          nrms[i*3+1]=ny*c-nz*s; nrms[i*3+2]=ny*s+nz*c;
        }
      }

      mdl.sampledPoints = { points: pts, normals: nrms, bbox: merged.boundingBox.clone() };
      mdl.loading = false;

      // 重新计算实际 bbox
      {
        let mnX=Infinity, mxX=-Infinity, mnY=Infinity, mxY=-Infinity, mnZ=Infinity, mxZ=-Infinity;
        for(let i=0; i<SAMPLE_N; i++){
          const x=pts[i*3], y=pts[i*3+1], z=pts[i*3+2];
          if(x<mnX)mnX=x; if(x>mxX)mxX=x;
          if(y<mnY)mnY=y; if(y>mxY)mxY=y;
          if(z<mnZ)mnZ=z; if(z>mxZ)mxZ=z;
        }
        mdl.sampledPoints.bbox = new THREE.Box3(
          new THREE.Vector3(mnX,mnY,mnZ), new THREE.Vector3(mxX,mxY,mxZ)
        );
      }

      console.log('[model]', sceneId, '采样完成，点数:', SAMPLE_N);

      // 同步旧兼容变量
      if(sceneId === 'tehran'){
        kamanchehSampledPoints = mdl.sampledPoints;
        kamanchehLoading = false;
      }

      // 隐藏加载提示
      const _loadingEl = document.getElementById('modelLoading');
      if(_loadingEl) _loadingEl.classList.remove('show');

      // 如果当前正在该场景，立即重建 targets（仅非新管线场景）
      const coord = COORDINATES[currentSceneIdx];
      if(coord && coord.modelId === sceneId && (mode === MODE.SCENE || mode === MODE.TRANSITION)){
        // golestan 走新管线，不用重建粒子 targets
        if(sceneId === 'golestan' && mdl.gltfScene){
          console.log('[model] golestan 已走新管线，跳过粒子 targets 重建');
        } else {
          console.log('[model]', sceneId, '当前正在该场景，用真模型重建 targets');
          buildSceneTargets(sceneId);
          geometry.getAttribute('aSize').needsUpdate = true;
          geometry.getAttribute('aColor').needsUpdate = true;
        }
      }
    }catch(err){
      console.error('[model]', sceneId, '处理失败', err);
      mdl.loadFailed = true;
      mdl.loading = false;
      if(sceneId === 'tehran'){
        kamanchehLoadFailed = true;
        kamanchehLoading = false;
      }
    }
  }, (xhr) => {
    if(xhr.lengthComputable){
      const pct = Math.round(xhr.loaded / xhr.total * 100);
      if(pct % 20 === 0) console.log('[model]', sceneId, '下载中', pct+'%');
    }
  }, (err) => {
    console.error('[model]', sceneId, '加载失败', err);
    mdl.loadFailed = true;
    mdl.loading = false;
    if(sceneId === 'tehran'){
      kamanchehLoadFailed = true;
      kamanchehLoading = false;
    }
  });
}

// 兼容旧函数名
function loadKamanchehModel(){ loadModelForScene('tehran'); }

// 合并多个 mesh 的几何到一个 BufferGeometry（只取 position + normal）
function mergeMeshGeometries(meshes){
  let totalCount = 0;
  for(const m of meshes){
    const pos = m.geometry.getAttribute('position');
    const idx = m.geometry.getIndex();
    totalCount += idx ? idx.count : pos.count;
  }
  const positions = new Float32Array(totalCount * 3);
  const normals = new Float32Array(totalCount * 3);
  let off = 0;
  for(const m of meshes){
    const g = m.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const idx = g.getIndex();
    if(idx){
      for(let i=0; i<idx.count; i++){
        const v = idx.getX(i);
        positions[(off+i)*3]   = pos.getX(v);
        positions[(off+i)*3+1] = pos.getY(v);
        positions[(off+i)*3+2] = pos.getZ(v);
        if(nor){
          normals[(off+i)*3]   = nor.getX(v);
          normals[(off+i)*3+1] = nor.getY(v);
          normals[(off+i)*3+2] = nor.getZ(v);
        }
      }
      off += idx.count;
    } else {
      for(let i=0; i<pos.count; i++){
        positions[(off+i)*3]   = pos.getX(i);
        positions[(off+i)*3+1] = pos.getY(i);
        positions[(off+i)*3+2] = pos.getZ(i);
        if(nor){
          normals[(off+i)*3]   = nor.getX(i);
          normals[(off+i)*3+1] = nor.getY(i);
          normals[(off+i)*3+2] = nor.getZ(i);
        }
      }
      off += pos.count;
    }
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

// 启动模型预加载（首屏就开始下，进场景前大概率已就绪）
loadModelForScene('golestan');

/* ---------- 渲染器 ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

/* ---------- 后处理：Bloom 辉光（CSS filter 方案） ---------- */
function initBloom(){
  // 使用 CSS filter 方案模拟 bloom：在 canvas 上方叠加一层模糊副本
  // 这比 EffectComposer 方案更稳定（不影响 renderer 的透明 alpha 输出）
  const bloomLayer = document.createElement('canvas');
  bloomLayer.id = 'bloom-layer';
  bloomLayer.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity 0.8s;mix-blend-mode:screen;filter:blur(8px) brightness(1.5);';
  bloomLayer.width = canvas.width;
  bloomLayer.height = canvas.height;
  document.body.appendChild(bloomLayer);
  window._bloomLayer = bloomLayer;
  window._bloomCtx = bloomLayer.getContext('2d');
  console.log('[bloom] CSS filter 方案初始化完成');
}

// Bloom 渲染：每 2 帧把主 canvas 亮部绘制到 bloom 层上
let _bloomFrame = 0;
function renderBloom(){
  if(!window._bloomLayer) return;
  _bloomFrame++;
  if(_bloomFrame % 2 !== 0) return; // 每 2 帧刷新一次（性能优化）
  const ctx = window._bloomCtx;
  const bl = window._bloomLayer;
  if(bl.width !== canvas.width || bl.height !== canvas.height){
    bl.width = canvas.width; bl.height = canvas.height;
  }
  ctx.clearRect(0, 0, bl.width, bl.height);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(canvas, 0, 0);
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070d, 0.0035);

/* ---------- 全景图 Skybox（360° 环绕背景）· 按场景管理 ---------- */
const panoTextures = {};  // { sceneId: THREE.Texture }
let currentPanoId = null;

function loadPanoForScene(sceneId, url){
  if(panoTextures[sceneId]) return;
  panoTextures[sceneId] = 'loading';
  const texLoader = new THREE.TextureLoader();
  texLoader.load(url, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if(typeof THREE.SRGBColorSpace !== 'undefined'){
      tex.colorSpace = THREE.SRGBColorSpace;
    } else if(typeof THREE.sRGBEncoding !== 'undefined'){
      tex.encoding = THREE.sRGBEncoding;
    }
    panoTextures[sceneId] = tex;
    console.log('[pano] 全景图加载完成:', sceneId, tex.image.width, '×', tex.image.height);
    // 如果当前正在该场景，立即应用
    if(currentPanoId === sceneId && (mode === MODE.SCENE || mode === MODE.TRANSITION)){
      scene.background = tex;
      _currentDisplayTex = tex;
      const sceneBgEl = document.querySelector('.scene-bg');
      if(sceneBgEl) sceneBgEl.style.display = 'none';
    }
  }, undefined, (err) => {
    console.warn('[pano] 全景图加载失败:', sceneId, err);
    panoTextures[sceneId] = null;
  });
}
// 兼容旧代码引用
let panoTexture = null;

// 预加载场景 1 的全景图（首屏就开始下）
loadPanoForScene('golestan', './golestan_360.jpg');
// 场景 2 全景图按需加载（不再预加载 tehran）

/* ---------- 全景图暗化蒙层（半透明黑色球壳，在 skybox 和粒子之间） ---------- */
const panoDimSphere = new THREE.Mesh(
  new THREE.SphereGeometry(1200, 32, 16),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.55,      // 暗化程度：0=全透明(不暗)，1=全黑
    side: THREE.BackSide,  // 渲染内壁
    depthWrite: false,
    fog: false
  })
);
panoDimSphere.renderOrder = -10;  // 确保在粒子之前渲染
panoDimSphere.visible = false;    // 默认隐藏，进场景时显示
scene.add(panoDimSphere);

/* ---------- 全景图烧灼层（吊灯崩塌时触发；BackSide 球壳 + fbm 焦化 shader） ---------- */
const panoBurnSphere = new THREE.Mesh(
  new THREE.SphereGeometry(1190, 64, 32),
  new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: -0.2 },   // -0.2 完全未燃烧；1.2 完全焦黑
      uTime:     { value: 0 },
      // 烧灼方向 uniform（场景定制）：默认 (0,1,0) 表示从穹顶（上方）开始向下蔓延
      // 玫瑰宫：(0, 1, 0)；地毯/巴扎作坊：(0, -1, 0) 从地面向上吞没
      uBurnDir:  { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform float uTime;
      uniform vec3  uBurnDir;
      varying vec3 vDir;
      // 3D hash + value noise（直接用方向向量采样，避免 equirect 接缝/平面感）
      float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise3(vec3 p){
        vec3 i = floor(p), f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        float n000 = hash3(i + vec3(0,0,0));
        float n100 = hash3(i + vec3(1,0,0));
        float n010 = hash3(i + vec3(0,1,0));
        float n110 = hash3(i + vec3(1,1,0));
        float n001 = hash3(i + vec3(0,0,1));
        float n101 = hash3(i + vec3(1,0,1));
        float n011 = hash3(i + vec3(0,1,1));
        float n111 = hash3(i + vec3(1,1,1));
        return mix(
          mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
          mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
          u.z
        );
      }
      float fbm3(vec3 p){
        float v = 0.0, a = 0.5;
        for(int i = 0; i < 5; i++){
          v += a * vnoise3(p);
          p *= 2.0; a *= 0.5;
        }
        return v;
      }
      void main(){
        // 用方向向量在 3D 空间采样：焦斑天然分布在球面、有"立体腐蚀"感、无接缝
        vec3 p = vDir * 2.4;
        // 缓慢的体积流动（让焦斑像在"呼吸"）
        float n = fbm3(p + vec3(0.0, uTime * 0.03, uTime * 0.02));
        // 加一层细密的高频纹路，模拟焦痕/裂纹的不规则边缘
        n += 0.22 * fbm3(p * 4.5 - vec3(uTime * 0.05, 0.0, uTime * 0.04));
        n = clamp(n, 0.0, 1.0);

        // —— 关键：让烧灼从指定方向（uBurnDir）开始向反方向蔓延 ——
        // vDir 是球面上某点指向方向，uBurnDir 是"火源方向"
        // dot(vDir, uBurnDir) ∈ [-1, 1]：1=朝着火源、-1=背对
        // 玫瑰宫 uBurnDir=(0,1,0)：穹顶先烧（向下蔓延）
        // 地毯/作坊 uBurnDir=(0,-1,0)：地面先烧（向上吞没）
        float topBias = clamp(dot(vDir, uBurnDir) * 0.5 + 0.5, 0.0, 1.0);
        float n2 = n - topBias * 0.30;

        // burn=0 透明（露出原全景），burn=1 完全覆盖
        float burn = 1.0 - smoothstep(uProgress - 0.06, uProgress + 0.20, n2);

        // —— 焦色：与全景图整体暗调一致（深褐+冷灰），无鲜艳橙色 ——
        // 边缘略带焦痕暖褐（远低于之前的橙红），核心是近黑的冷褐
        vec3 charredCore = vec3(0.015, 0.012, 0.010);    // 接近全黑的冷褐
        vec3 charredEdge = vec3(0.085, 0.055, 0.040);    // 焦痕的暗褐过渡
        vec3 col = mix(charredEdge, charredCore, burn);

        // 透明度：burn 决定覆盖强度
        float a = burn * 0.97;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  })
);
panoBurnSphere.renderOrder = -9;  // 介于 dimSphere(-10) 与 sparkleGroup(-5) 之间
panoBurnSphere.visible = false;
scene.add(panoBurnSphere);

/* ---------- 全景图溶解切换层（双贴图 + 火焰 mask） ----------
 *  独立于爆炸用的 panoBurnSphere：这一层在两张全景图之间做 "火焰烧穿露出后景" 的电影效果
 *  - BackSide 球壳，半径 1185（在 panoBurnSphere 1190 之内、sparkleGroup 之外）
 *  - uTexFrom / uTexTo 同时采样，uProgress 0→1 沿 fbm 噪声前线推进
 *  - 火焰前线宽度 ~0.18，前沿是亮焦褐色（不到纯黑），紧跟后面就露出新贴图
 *  - 既能在两张全景之间溶解，也能透出"焦灼正在腐蚀"的视觉语言（呼应主题）
 * ----------------------------------------------------------------- */
const panoCrossfadeSphere = new THREE.Mesh(
  new THREE.SphereGeometry(1185, 64, 32),
  new THREE.ShaderMaterial({
    uniforms: {
      uTexFrom: { value: null },
      uTexTo:   { value: null },
      uProgress:{ value: 0.0 },   // 0=全部显示 from；1=全部显示 to
      uTime:    { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      varying vec2 vUv;
      void main(){
        vDir = normalize(position);
        // 球面 → equirect uv（和 EquirectangularReflectionMapping 一致）
        vUv = vec2(
          atan(vDir.z, vDir.x) / 6.2831853 + 0.5,
          asin(clamp(vDir.y, -1.0, 1.0)) / 3.1415927 + 0.5
        );
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexFrom;
      uniform sampler2D uTexTo;
      uniform float uProgress;
      uniform float uTime;
      varying vec3 vDir;
      varying vec2 vUv;

      float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise3(vec3 p){
        vec3 i = floor(p), f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        float n000 = hash3(i + vec3(0,0,0));
        float n100 = hash3(i + vec3(1,0,0));
        float n010 = hash3(i + vec3(0,1,0));
        float n110 = hash3(i + vec3(1,1,0));
        float n001 = hash3(i + vec3(0,0,1));
        float n101 = hash3(i + vec3(1,0,1));
        float n011 = hash3(i + vec3(0,1,1));
        float n111 = hash3(i + vec3(1,1,1));
        return mix(
          mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
          mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
          u.z
        );
      }
      float fbm3(vec3 p){
        float v = 0.0, a = 0.5;
        for(int i = 0; i < 5; i++){
          v += a * vnoise3(p);
          p *= 2.0; a *= 0.5;
        }
        return v;
      }

      void main(){
        vec3 p = vDir * 2.4;
        float n = fbm3(p + vec3(0.0, uTime * 0.03, uTime * 0.02));
        n += 0.22 * fbm3(p * 4.5 - vec3(uTime * 0.05, 0.0, uTime * 0.04));
        n = clamp(n, 0.0, 1.0);

        // 顶部偏置：dot(vDir, up) ∈ [-1,1] → 归一化到 [0,1]
        // n2 = n + topBias*0.2 后 clamp → 顶部像素 n2 偏大 → (1-n2) 偏小 → 阈值更低 → 更早烧
        float topBias = clamp(dot(vDir, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0, 1.0);
        float n2 = clamp(n + topBias * 0.2, 0.0, 1.0);

        // ★ 严格保证边界：
        //   uProgress=0 → threshold=-0.2，对全屏像素都 < (1-n2 - 0.18) ∈ [-0.18, 0.82]，burnTo=0 ✓
        //   uProgress=1 → threshold= 1.2，对全屏像素都 > (1-n2 + 0.06) ∈ [0.06, 1.06]，burnTo=1 ✓
        float threshold = uProgress * 1.4 - 0.2;
        float oneMinusN = 1.0 - n2;
        float burnTo = smoothstep(oneMinusN - 0.18, oneMinusN + 0.06, threshold);

        vec4 colFrom = texture2D(uTexFrom, vUv);
        vec4 colTo   = texture2D(uTexTo,   vUv);

        // 基础混合：burnTo 0→1 即 colFrom→colTo
        vec3 base = mix(colFrom.rgb, colTo.rgb, burnTo);

        // 火焰前线焦痕窄带
        float edge = smoothstep(0.38, 0.48, burnTo) * (1.0 - smoothstep(0.52, 0.62, burnTo));
        vec3 charredEdge = vec3(0.32, 0.16, 0.06);
        base = mix(base, base * 0.55 + charredEdge, edge * 0.80);

        // 极细高光火星
        float spark = smoothstep(0.46, 0.50, burnTo) * (1.0 - smoothstep(0.50, 0.54, burnTo));
        base += vec3(0.95, 0.45, 0.12) * spark * 0.85;

        gl_FragColor = vec4(base, 1.0);
      }
    `,
    transparent: false,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  })
);
panoCrossfadeSphere.renderOrder = -9.5;  // 比 panoBurnSphere 略前（更内），但仍在 sparkleGroup(-5) 之后
panoCrossfadeSphere.visible = false;
scene.add(panoCrossfadeSphere);

/* ---------- 主场景全景图切换工具：用 panoBurnSphere 做"焦化→显形"过渡 ----------
 *  transitionMainPanoTo(url, durationSec, onComplete)
 *    - 把当前 scene.background 烧成焦黑 → 静默切贴图 → 烧回露出新贴图
 *    - 总时长 ≈ durationSec * 2（一来一回各 durationSec）
 *  transitionMainPanoBackToBlack(durationSec, onComplete)
 *    - 单向：从当前透明态烧到全屏焦黑（用于"全部读完后再烧到黑")
 *  transitionMainPanoFromBlack(url, durationSec, onComplete)
 *    - 单向：从焦黑态加载贴图并烧出
 *
 *  关键：使用 window._panoTransitionActive 标志，让主循环跳过抢 uniform。
 *  使用 panoBurnSphere.userData._dirOwn=true 临时托管，避免和爆炸烧灼冲突。
 * ----------------------------------------------------------------- */
function _ensurePanoLoaded(url, sceneId){
  return new Promise((resolve, reject) => {
    if(!url){ resolve(null); return; }
    // 已加载完成：直接 resolve
    if(panoTextures[sceneId] && panoTextures[sceneId] !== 'loading'){
      resolve(panoTextures[sceneId]); return;
    }
    // 正在加载（被预加载循环或其他调用先占住）：注册回调队列等待
    if(panoTextures[sceneId] === 'loading'){
      panoTextures._waiters = panoTextures._waiters || {};
      const arr = (panoTextures._waiters[sceneId] = panoTextures._waiters[sceneId] || []);
      arr.push({ resolve, reject });
      return;
    }
    // 首次加载
    panoTextures[sceneId] = 'loading';
    panoTextures._waiters = panoTextures._waiters || {};
    panoTextures._waiters[sceneId] = panoTextures._waiters[sceneId] || [];
    const tex = new THREE.TextureLoader().load(url, (loaded) => {
      loaded.mapping = THREE.EquirectangularReflectionMapping;
      if(typeof THREE.SRGBColorSpace !== 'undefined') loaded.colorSpace = THREE.SRGBColorSpace;
      else if(typeof THREE.sRGBEncoding !== 'undefined') loaded.encoding = THREE.sRGBEncoding;
      panoTextures[sceneId] = loaded;
      // 唤醒所有等待者
      const waiters = panoTextures._waiters[sceneId] || [];
      panoTextures._waiters[sceneId] = [];
      resolve(loaded);
      waiters.forEach(w => { try { w.resolve(loaded); } catch(_){} });
    }, undefined, (err) => {
      // 出错也要清理等待者，避免后续点击 hang
      panoTextures[sceneId] = null;
      const waiters = panoTextures._waiters[sceneId] || [];
      panoTextures._waiters[sceneId] = [];
      reject(err);
      waiters.forEach(w => { try { w.reject(err); } catch(_){} });
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
  });
}

// 通用单向烧灼：从 fromProgress 缓动到 toProgress
function _runBurnTween(fromProgress, toProgress, durationMs, onComplete){
  window._panoTransitionActive = true;
  panoBurnSphere.visible = true;
  panoBurnSphere.material.uniforms.uProgress.value = fromProgress;
  const startTime = performance.now();
  const tick = () => {
    const now = performance.now();
    const t = Math.min(1, (now - startTime) / durationMs);
    const eased = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
    const cur = fromProgress + (toProgress - fromProgress) * eased;
    panoBurnSphere.material.uniforms.uProgress.value = cur;
    panoBurnSphere.material.uniforms.uTime.value = now * 0.001;
    if(t < 1){
      requestAnimationFrame(tick);
    } else {
      // 完全透明（toProgress 接近 -0.2）则隐藏球壳，给主场景让位
      if(toProgress <= -0.15){
        panoBurnSphere.visible = false;
        panoBurnSphere.material.uniforms.uProgress.value = -0.2;
      }
      window._panoTransitionActive = false;
      if(onComplete) onComplete();
    }
  };
  requestAnimationFrame(tick);
}

/**
 * 把主场景的 scene.background 切到一张新全景图，过渡用 panoBurnSphere 烧灼。
 * @param {string} url 新全景图 URL（等距柱状投影 jpg/png；尺寸建议 4096x2048 或 2048x1024）
 * @param {string} cacheKey 用于 panoTextures 缓存的 key（如 'dir_setar'）
 * @param {number} burnInSec 烧入时长（默认 1.6s）
 * @param {number} burnOutSec 烧出时长（默认 1.8s）
 * @param {function} onComplete 全部完成回调
 */
function transitionMainPanoTo(url, cacheKey, burnInSec, burnOutSec, onComplete){
  burnInSec = burnInSec || 1.6;
  burnOutSec = burnOutSec || 1.8;
  // 烧灼方向：默认从穹顶向下
  panoBurnSphere.material.uniforms.uBurnDir.value.set(0, 1, 0);
  // 1) 当前态（透明 -0.2）→ 焦黑 1.10
  _runBurnTween(-0.2, 1.10, burnInSec * 1000, () => {
    // 2) 屏幕已焦黑：静默加载并切换贴图
    _ensurePanoLoaded(url, cacheKey).then((tex) => {
      if(tex){ scene.background = tex; _currentDisplayTex = tex; }
      // 3) 焦黑 1.10 → 透明 -0.2，露出新背景
      _runBurnTween(1.10, -0.2, burnOutSec * 1000, onComplete);
    }).catch((err) => {
      console.warn('[pano-transition] 加载失败:', url, err);
      // 加载失败也要烧回，避免锁死焦黑
      _runBurnTween(1.10, -0.2, burnOutSec * 1000, onComplete);
    });
  });
}

/**
 * 全景图溶解切换：从当前 scene.background 直接火焰溶解到新贴图（不经过焦黑）
 * - 用 panoCrossfadeSphere 同时采样两张贴图，沿 fbm 噪声前线扫描
 * - 中途看不到纯黑，只有一条火焰前线扫过屏幕
 * - 用于场景间穿梭（碎片标签互相点击切换）
 *
 * @param {string} url 新全景图 URL
 * @param {string} cacheKey panoTextures 缓存 key
 * @param {number} durationSec 总时长（默认 1.6s）
 * @param {function} onComplete 完成回调
 */
/* ------------------------------------------------------------------
 *  全景图切换 —— panoCrossfadeSphere 火焰前线直接 a→b 烧穿
 *  ------------------------------------------------------------------
 *  视觉：火焰前线扫过的地方，从 a 直接露出 b（不经过黑场，不经过焦化全屏）
 *
 *  ★ 多轮迭代后的根因总结 ★
 *  之前所有失败修复的盲点是 fromTex 的来源：
 *  - 一直用 _currentDisplayTex（上一次动画完成时的快照）作 fromTex
 *  - 但用户在动画进行中再次触发切换时，他屏幕上看到的不是这张快照，
 *    而是 shader 实时合成的中间帧 —— 用它当 fromTex 就出现"a→b→烧到a→a→b"
 *
 *  ★ 方案 B：球壳是唯一真相源 ★
 *  - 新调用进来时，先把旧动画的目标贴图（uTexTo）强制落地到 scene.background
 *    并隐藏球壳 —— 这样无论旧动画跑到哪一帧，"用户即将看到的画面"就是 scene.background
 *  - 然后 fromTex = scene.background，球壳从完全干净的状态启动新动画
 *  - 视觉代价：连点切换时旧动画会"瞬间快进到结束"，但绝不会出现错乱的烧灼方向
 *
 *  其它防御：
 *  - callId 每帧检查 —— 旧 tick 检测到失效立即停止，不会写球壳 uniform
 *  - 先加载完 toTex 再启动 tween —— 决不在动画跑到一半换 uTexTo
 * ------------------------------------------------------------------ */
function transitionMainPanoCrossfade(url, cacheKey, durationSec, onComplete, fovOptions, onStart){
  /* onStart（可选）：在贴图加载完毕、球壳真正可见、火焰开始那一刻同步触发。
   * 用途：把"相机视角 tween"等需要与火焰同步的副作用挂在这里，
   * 避免相机 tween 已经开始但贴图还没加载好导致"先转视角才灼烧"的视觉跳变。 */
  durationSec = durationSec || 1.6;
  const durMs = durationSec * 1000;

  const mat = panoCrossfadeSphere.material;

  /* FOV 同步渐变：消除"灼烧前后两次瞬时放大"的视觉突变。
   * fovOptions = { fromFov: <number>, toFov: <number> } —— 都可选。
   * 若只传 toFov，fromFov 取 camera.fov 当前值。
   * 整个 FOV 插值与 progress 同步：与灼烧融为一体，看起来就是"画面一边灼烧一边慢慢拉广/收窄"，没有突变。 */
  const fovOpt = fovOptions || null;
  let fovFrom = null, fovTo = null;
  if(fovOpt && typeof camera !== 'undefined' && camera){
    fovFrom = (typeof fovOpt.fromFov === 'number') ? fovOpt.fromFov : camera.fov;
    fovTo   = (typeof fovOpt.toFov   === 'number') ? fovOpt.toFov   : camera.fov;
  }

  /* ★ 关键一步：把旧动画的目标贴图立刻落地到 scene.background ★
   * 无论旧动画跑到 progress=0.3 还是 0.9，新调用一进来就强制"快进到结束"：
   * scene.background = 旧 uTexTo（即旧动画想去的地方），球壳隐藏。
   * 这样 fromTex 永远 = 用户即将看到的画面（=scene.background），不会再错位。 */
  if(panoCrossfadeSphere.visible){
    const oldTo = mat.uniforms.uTexTo.value;
    if(oldTo) scene.background = oldTo;
    panoCrossfadeSphere.visible = false;
  }

  // 抢占 ID：旧 tick 在下一帧检测到 callId 失效会立即停止
  const callId = (window._panoCallSeq = (window._panoCallSeq || 0) + 1);

  // fromTex 就是 scene.background —— 唯一真相源
  const fromTex = scene.background;

  // 先加载完目标贴图，再启动动画
  _ensurePanoLoaded(url, cacheKey).then((toTex) => {
    if(callId !== window._panoCallSeq) return;

    if(!toTex){
      console.warn('[pano-crossfade] 加载失败:', url);
      if(onComplete) onComplete();
      return;
    }

    // 同一张贴图：无需烧灼，直接收工
    if(fromTex === toTex){
      scene.background = toTex;
      if(onComplete) onComplete();
      return;
    }

    // 设置双纹理 + 初始进度，启动球壳
    mat.uniforms.uTexFrom.value = fromTex;
    mat.uniforms.uTexTo.value   = toTex;
    mat.uniforms.uProgress.value = 0.0;
    panoCrossfadeSphere.visible = true;

    // 启动前把 FOV 锁到 fovFrom（一般 = 当前 fov），后续随 eased 插值到 fovTo
    if(fovFrom !== null && fovTo !== null && typeof camera !== 'undefined' && camera){
      if(camera.fov !== fovFrom){
        camera.fov = fovFrom;
        camera.updateProjectionMatrix();
      }
    }

    // ★ 同步钩子：贴图就绪、球壳已可见的同一帧触发，调用方可在此启动相机 tween 等副作用
    if(typeof onStart === 'function'){
      try { onStart(); } catch(err){ console.warn('[pano-crossfade] onStart err:', err); }
    }

    const startTime = performance.now();
    const tick = () => {
      // 被新调用接管：旧 tick 立即放弃（新调用已经把 oldTo 落地到 background）
      if(callId !== window._panoCallSeq) return;

      const now = performance.now();
      const t = Math.min(1, (now - startTime) / durMs);
      // ease-in-out cubic（火焰起势→匀速→收尾）
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      mat.uniforms.uProgress.value = eased;
      mat.uniforms.uTime.value = now * 0.001;

      // FOV 同步插值
      if(fovFrom !== null && fovTo !== null && typeof camera !== 'undefined' && camera){
        const newFov = fovFrom + (fovTo - fovFrom) * eased;
        if(Math.abs(camera.fov - newFov) > 0.01){
          camera.fov = newFov;
          camera.updateProjectionMatrix();
        }
      }

      if(t < 1){
        requestAnimationFrame(tick);
      } else {
        if(callId !== window._panoCallSeq) return;
        // 动画收尾：落地到 toTex，球壳退场
        scene.background = toTex;
        panoCrossfadeSphere.visible = false;
        mat.uniforms.uProgress.value = 0.0;
        // 收尾时强制把 fov 精确落到 fovTo（避免插值残差）
        if(fovFrom !== null && fovTo !== null && typeof camera !== 'undefined' && camera){
          if(camera.fov !== fovTo){
            camera.fov = fovTo;
            camera.updateProjectionMatrix();
          }
        }
        if(onComplete) onComplete();
      }
    };
    requestAnimationFrame(tick);
  }).catch((err) => {
    console.warn('[pano-crossfade] 加载失败:', url, err);
    if(onComplete) onComplete();
  });
}

// 保留此变量是为了不破坏其他代码（enterScene / exit 等会赋值），
// 但 transitionMainPanoCrossfade 内部完全不读它 —— 真相源永远是 scene.background
let _currentDisplayTex = null;

/* ---------- 全景图水晶反光光点（随视角切换闪烁） ---------- */
const sparkleGroup = new THREE.Group();
sparkleGroup.visible = false;
sparkleGroup.renderOrder = -5;
scene.add(sparkleGroup);

// —— A. 密集小光点（球面分布，让镜宫更富丽堂皇）
//    480 颗"原始组合"（大/中/小都有，奠定富丽堂皇的层次感）
//    + 5000 颗小颗加密（让画面更细腻闪烁，不增加大颗）
//    总计 5480 颗：单 drawcall, 不增加 fill rate（小颗 size≈5~12，屏幕 1.6~4px）
const SPARKLE_BASE = 5000;         // 玫瑰宫水晶反光（十字星芒大量铺满，有大有小）
const SPARKLE_DENSE = 5000;        // 小颗加密层（满天繁星·适中版）
const SPARKLE_COUNT = SPARKLE_BASE + SPARKLE_DENSE;
const SPARKLE_RADIUS = 900;
const sparkleGeo = new THREE.BufferGeometry();
const sparklePos = new Float32Array(SPARKLE_COUNT * 3);
const sparkleDir = new Float32Array(SPARKLE_COUNT * 3);
const sparkleSeed = new Float32Array(SPARKLE_COUNT);
const sparkleSize = new Float32Array(SPARKLE_COUNT);
const sparkleIsBase = new Float32Array(SPARKLE_COUNT);  // 1=BASE 层（含星芒大颗），0=DENSE 加密层（仅细小点）

for(let i = 0; i < SPARKLE_COUNT; i++){
  const u = Math.random(), v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  const dx = sinPhi * Math.cos(theta);
  const dy = Math.cos(phi);
  const dz = sinPhi * Math.sin(theta);
  const yBias = dy < 0 ? dy * 0.3 : dy;
  const len = Math.sqrt(dx*dx + yBias*yBias + dz*dz);
  const nx = dx/len, ny = yBias/len, nz = dz/len;

  // === 全部粒子放在远场（300~900）球壳上 ===
  // 之前 30% 近场（30~150）让 sparkle 粒子"飘"在镜头附近，转动相机时 facing
  // 大幅变化 + 闪烁动画 → 视觉上就是"飘动闪烁的尘埃"，而不是用户想要的
  //"贴在全景图上的固定闪光点"。
  // 现在所有粒子都贴在远球壳上，跟着 360° 全景一起转，呈现"全景图反光点"质感。
  let r;
  const isNear = false;  // 不再生成近场粒子
  r = 300 + Math.random() * (SPARKLE_RADIUS - 300);
  sparklePos[i*3]   = nx * r;
  sparklePos[i*3+1] = ny * r;
  sparklePos[i*3+2] = nz * r;
  // aDir 统一朝相机：近远场都保持稳定 facing，避免 facing=0 导致的闪烁不稳
  sparkleDir[i*3]   = -nx;
  sparkleDir[i*3+1] = -ny;
  sparkleDir[i*3+2] = -nz;
  sparkleSeed[i] = Math.random() * 100;

  if(i < SPARKLE_BASE){
    sparkleIsBase[i] = 1.0;  // BASE 层
    // 玫瑰宫水晶反光：尺寸大幅拉开层次（小到大跨度大），让画面有"远近水晶"层次感
    // 大颗（5% / 14~22）：少数几颗特别醒目的"主反光点"
    // 中颗（25% / 8~14）：中等大小的层次填充
    // 小颗（40% / 4~8）：常规水晶反光
    // 极小（30% / 2~4）：最远处的小亮点，呈"星河"质感
    const rr = Math.random();
    if(rr < 0.05)      sparkleSize[i] = 14 + Math.random() * 8;   // 大颗（5%）
    else if(rr < 0.30) sparkleSize[i] = 8  + Math.random() * 6;   // 中颗（25%）
    else if(rr < 0.70) sparkleSize[i] = 4  + Math.random() * 4;   // 小颗（40%）
    else               sparkleSize[i] = 2  + Math.random() * 2;   // 极小（30%）
    // 全部远场（300~900）后不再需要近场倍率，留逻辑兼容
    if(isNear) sparkleSize[i] *= 0.25;
  } else {
    sparkleIsBase[i] = 0.0;  // DENSE 加密层（细小点）
    if(isNear){
      // 近场 DENSE：基础尺寸大幅压低（1~3），靠透视(300/r)放大到 6~30 屏幕像素
      // 这样近处呈现出"飘飞经过镜头的尘屑"质感，而不是糊脸大白盘
      sparkleSize[i] = 1 + Math.random() * 2;
    } else {
      // 远场 DENSE：原配方 5~12，配合 (300/900)≈0.33 → 屏幕 1.6~4px
      sparkleSize[i] = 5 + Math.random() * 7;
    }
  }
}
sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
sparkleGeo.setAttribute('aDir',     new THREE.BufferAttribute(sparkleDir, 3));
sparkleGeo.setAttribute('aSeed',    new THREE.BufferAttribute(sparkleSeed, 1));
sparkleGeo.setAttribute('aSize',    new THREE.BufferAttribute(sparkleSize, 1));
sparkleGeo.setAttribute('aIsBase',  new THREE.BufferAttribute(sparkleIsBase, 1));

const sparkleMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:       { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uOpacity:    { value: 0 },
    uMotion:     { value: 0 },  // 0=静止, 1=快速转动
    uDenseOnly:  { value: 0 },  // 1=只显示 DENSE 5000 颗细小点（镜中圣陵）
    uBaseOnly:   { value: 0 },  // 1=只显示 BASE 200 颗十字星芒（玫瑰宫）—— 屏蔽 5000 颗 DENSE 圆点
  },
  vertexShader: `
    attribute vec3 aDir;
    attribute float aSeed;
    attribute float aSize;
    attribute float aIsBase;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uMotion;
    uniform float uDenseOnly;
    uniform float uBaseOnly;
    varying float vAlpha;
    varying float vFlash;
    varying float vIsBase;
    void main(){
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vec3 dirView = normalize((modelViewMatrix * vec4(aDir, 0.0)).xyz);
      vec3 toCamView = normalize(-mvPos.xyz);
      float facing = clamp(dot(dirView, toCamView) * 0.5 + 0.5, 0.0, 1.0);
      facing = pow(facing, 1.4);

      vIsBase = aIsBase;

      // DenseOnly 模式：BASE 层（含大颗星芒）整体隐藏 → size=0 顶点被裁剪
      // BaseOnly 模式：DENSE 层（5000 颗小圆点）整体隐藏 → 玫瑰宫只剩 200 颗十字星芒
      float visibleScale = mix(1.0, 1.0 - aIsBase, uDenseOnly);
      visibleScale *= mix(1.0, aIsBase, uBaseOnly);

      // 慢速基础闪烁（每颗节奏不同）—— 频率更快 + 振幅更大
      float twinkle = 0.45 + 0.55 * sin(uTime * 2.6 + aSeed * 6.2831);
      // 第一组：中频尖脉冲
      float fast = sin(uTime * 5.8 + aSeed * 12.57);
      float flash = pow(max(fast, 0.0), 5.0);
      // 第二组：高频细密脉冲（每颗节奏完全不同，形成"星空闪烁"层）
      float fast2 = sin(uTime * 8.7 + aSeed * 19.83);
      float flash2 = pow(max(fast2, 0.0), 7.0);
      // 双频叠加
      float combined = flash + flash2 * 0.85;
      vFlash = combined * uMotion;

      // 总亮度 = facing * twinkle * 运动强度
      // 静止时给一个微弱基底（0.08），让光点"任何时候都在闪"
      float intensity = 0.08 + 0.92 * uMotion;
      vAlpha = facing * twinkle * intensity * visibleScale;

      // 闪光瞬间放大颗粒（仅运动时）
      // - DENSE（镜中圣陵）保留 ×0.7 的活泼放大幅度
      // - BASE（玫瑰宫）只放大 ×0.15，几乎不爆开，避免"转快时变白盘"
      float boostAmp = mix(0.7, 0.15, aIsBase);
      float sizeBoost = 1.0 + vFlash * boostAmp;
      // DENSE 层（aIsBase=0）整体尺寸 ×0.7：比 BASE 小但留足 halo 展开空间
      float layerSizeScale = mix(0.7, 1.0, aIsBase);
      gl_PointSize = aSize * uPixelRatio * sizeBoost * (300.0 / max(-mvPos.z, 1.0)) * visibleScale * layerSizeScale;
      // 上限分层：DENSE 30px / BASE 24px —— BASE 需要足够屏幕像素来呈现"十字星芒"形态
      // 之前 8px 上限太死，星芒在 8x8 网格里只能糊成圆点
      float maxPx = mix(30.0, 24.0, aIsBase);
      gl_PointSize = clamp(gl_PointSize, 0.0, maxPx * uPixelRatio);
      // visibleScale=0 时不应用最小值，让被屏蔽的颗粒彻底消失
      gl_PointSize = mix(0.0, max(gl_PointSize, 1.5), step(0.5, visibleScale));
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying float vAlpha;
    varying float vFlash;
    varying float vIsBase;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float r = length(uv);
      if(r > 0.5) discard;

      // 根据是否 BASE 层选择不同的边缘衰减强度
      // mix(a, b, t)：vIsBase=1（玫瑰宫 BASE）取 b，vIsBase=0（镜中圣陵 DENSE）取 a
      // - BASE（玫瑰宫水晶）：针点核心 + 双层 halo（近 + 远）+ 短刺星芒，整体高度羽化
      // - DENSE（镜中圣陵小颗）：核心适中（80）+ halo 显著，呈"小光球"
      float coreCoef = mix(80.0, 260.0, vIsBase);  // BASE 260 让核心更针点，留更多空间给 halo
      float haloCoef = mix(6.0,  22.0, vIsBase);   // 近 halo
      float haloAmp  = mix(0.45, 0.40, vIsBase);   // 近 halo 强度↑
      float haloFar  = mix(2.0,   5.0, vIsBase);   // 远 halo（大羽化）—— 新增
      float haloFarAmp = mix(0.0, 0.22, vIsBase);  // BASE 才有远 halo

      // 1) 针点核心
      float core = exp(-r * r * coreCoef);
      // 2) 近 halo —— 主要的"光晕模糊"感
      float halo = exp(-r * r * haloCoef) * haloAmp;
      // 3) 远 halo —— 羽化外缘，让边界平滑融入背景，消除"贴纸感"
      float haloOuter = exp(-r * r * haloFar) * haloFarAmp;

      // 4) 短刺星芒（BASE 主形态）—— 不再是"十字"
      //    关键调整：横向衰减 0.8 → 4.5，臂长大幅缩短（只在中心附近 20% 范围有亮度）
      //    指数 18 → 12 让臂更粗更柔（粗+短 = 像光斑伸出的小刺，而不是十字线）
      //    再叠一个 r² 包络（指数 9.0）保证臂尖快速淡出
      float crossH = exp(-pow(uv.y * 12.0, 2.0)) * exp(-pow(uv.x * 4.5, 2.0));
      float crossV = exp(-pow(uv.x * 12.0, 2.0)) * exp(-pow(uv.y * 4.5, 2.0));
      float crossLine = max(crossH, crossV);
      // r 包络（9.0）让星芒只在核心附近呈现"星形微凸"，整体仍是圆光斑
      float starEnv = exp(-r * r * 9.0);
      // DENSE 层完全去掉星芒（vIsBase=0），只有 BASE 大颗才有
      float star = crossLine * starEnv * vIsBase;

      // 组合：核心 + 近 halo（模糊） + 远 halo（羽化外缘） + 短刺星芒
      // 星芒强度降到 0.35（之前 0.55），flash 时 +0.25 → 视觉上更"是一个柔和发光点"
      float shape = core + halo + haloOuter + star * (0.35 + vFlash * 0.25);

      vec3 warm = vec3(1.0, 0.94, 0.78);
      vec3 cool = vec3(1.0, 1.0, 1.0);
      vec3 col = mix(warm, cool, clamp(vFlash, 0.0, 1.0));
      // flash 瞬间亮度爆发（×1.0 → ×0.65 更克制）
      col *= 1.0 + vFlash * 0.65;

      float a = shape * vAlpha * uOpacity;
      // discard 阈值 0.004：保留 halo 外圈但切掉极弱噪声
      if(a < 0.004) discard;
      gl_FragColor = vec4(col, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  fog: false,
});
const sparklePoints = new THREE.Points(sparkleGeo, sparkleMat);
sparklePoints.frustumCulled = false;
sparkleGroup.add(sparklePoints);

// —— B. 大颗星芒（Sprite，约 8 颗，烫金颗给镜宫加奢华感）——
//   再压：14 颗 40~80 仍然在转快时显得像大花，
//   改为 8 颗 20~40 让它更含蓄，纯粹是远处的水晶反光暗示
const flareCount = 8;
const flareSprites = [];
for(let i = 0; i < flareCount; i++){
  const u = Math.random(), v = 0.20 + Math.random() * 0.65;
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  const x = sinPhi * Math.cos(theta) * 850;
  const y = Math.cos(phi) * 850;
  const z = sinPhi * Math.sin(theta) * 850;
  const sprMat = new THREE.SpriteMaterial({
    map: null, // 延迟赋值（用专用十字星芒贴图）
    color: 0xfff4d0,
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  const spr = new THREE.Sprite(sprMat);
  spr.position.set(x, y, z);
  // 尺寸再压一档：20~40（之前 40~80）
  spr.scale.setScalar(20 + Math.random() * 20);
  spr.userData = {
    dir: new THREE.Vector3(-x, -y, -z).normalize(),
    seed: Math.random() * 100,
    baseScale: spr.scale.x,
    fastSeed: Math.random() * 100,
  };
  flareSprites.push(spr);
  sparkleGroup.add(spr);
}

// sparkle 运动状态（模块级，供 animate 循环跨帧记忆）
let sparkleLastYaw = 0;
let sparkleLastPitch = 0;
let sparkleMotion = 0;
let sparkleInited = false;


const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 3000);
// 地图模式：相机在上方偏前，俯视朝向地图中心
const MAP_CAM_DEFAULT = { x:0, y:70, z:180 };
camera.position.set(MAP_CAM_DEFAULT.x, MAP_CAM_DEFAULT.y, MAP_CAM_DEFAULT.z);
camera.lookAt(0, 0, 0);
initBloom(); // 在 scene + camera 就绪后初始化后处理

/* ---------- 贴图 ---------- */
/* ---------- 贴图（沙粒：每颗自带 3D 球体明暗，营造体积感） ---------- */
function makeSpriteTexture(){
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  // —— 关键：每颗粒子画成"被左上光照射的小球"——
  // 这样即使没有重叠，每颗粒子单看就是个 3D 沙粒，整体自带光影
  const cx = size * 0.40;  // 高光中心略偏左上
  const cy = size * 0.40;
  const grd = g.createRadialGradient(cx, cy, 0, size/2, size/2, size/2);
  grd.addColorStop(0.00, 'rgba(255,255,255,1.0)');   // 高光（亮）
  grd.addColorStop(0.30, 'rgba(220,220,220,0.95)');  // 中亮
  grd.addColorStop(0.55, 'rgba(140,140,140,0.85)');  // 中暗（关键：粒子本身就有暗部）
  grd.addColorStop(0.78, 'rgba(70,70,70,0.55)');     // 暗面
  grd.addColorStop(0.95, 'rgba(30,30,30,0.20)');     // 边缘极暗
  grd.addColorStop(1.0,  'rgba(20,20,20,0)');        // 透明
  g.fillStyle = grd;
  g.fillRect(0,0,size,size);
  // 圆形 alpha 蒙版（裁掉方形边角）
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  mask.addColorStop(0.0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.85,'rgba(0,0,0,1)');
  mask.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0,0,size,size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const spriteTex = makeSpriteTexture();

/* ---------- 高斯泼溅风格贴图（用于崩塌碎片） ---------- */
function makeCrystalTexture(){
  const size = 256; // 更大分辨率让边缘更柔和
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const half = size / 2;

  // 纯高斯衰减（Gaussian Splatting 的核心视觉）
  // σ ≈ size/4，这样 2σ 处 alpha ≈ 13%，3σ 处 ≈ 1%
  const grd = g.createRadialGradient(half, half, 0, half, half, half);
  grd.addColorStop(0.00, 'rgba(255,255,255,1.0)');   // 中心满亮
  grd.addColorStop(0.15, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.30, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.50, 'rgba(255,255,255,0.25)');   // 半径处 25%
  grd.addColorStop(0.70, 'rgba(255,255,255,0.08)');
  grd.addColorStop(0.85, 'rgba(255,255,255,0.02)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0.0)');    // 边缘完全透明
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const crystalTex = makeCrystalTexture();
// sparklePoints 的小光点 shader 内部已自绘形态，不再需要 uMap

/* ---------- 十字星芒贴图（用于 B 层大颗 flare） ---------- */
function makeStarFlareTexture(){
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  // 1) 中心圆形光晕（更柔的高斯衰减 —— 边缘几乎无可见硬边）
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  halo.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  halo.addColorStop(0.04, 'rgba(255,250,230,0.85)');
  halo.addColorStop(0.10, 'rgba(255,240,200,0.45)');
  halo.addColorStop(0.22, 'rgba(255,225,170,0.18)');
  halo.addColorStop(0.45, 'rgba(255,225,170,0.04)');
  halo.addColorStop(1.00, 'rgba(255,225,170,0.0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);

  // 2) 主十字（变细：3.5 → 1.5 像素；并且用 blur 模糊）
  g.globalCompositeOperation = 'lighter';
  function drawRay(angleDeg, length, thick, alpha){
    g.save();
    g.translate(cx, cy);
    g.rotate(angleDeg * Math.PI / 180);
    const grad = g.createLinearGradient(-length, 0, length, 0);
    grad.addColorStop(0.00, 'rgba(255,250,220,0)');
    grad.addColorStop(0.35, `rgba(255,250,230,${alpha * 0.2})`);
    grad.addColorStop(0.48, `rgba(255,250,230,${alpha * 0.7})`);
    grad.addColorStop(0.50, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.52, `rgba(255,250,230,${alpha * 0.7})`);
    grad.addColorStop(0.65, `rgba(255,250,230,${alpha * 0.2})`);
    grad.addColorStop(1.00, 'rgba(255,250,220,0)');
    g.fillStyle = grad;
    g.fillRect(-length, -thick / 2, length * 2, thick);
    g.restore();
  }
  // 主十字（变细、稍降亮度）
  drawRay(0,   size * 0.48, 1.6, 0.85);
  drawRay(90,  size * 0.48, 1.6, 0.85);

  // 3) 中心针尖（更小、更柔）
  g.globalCompositeOperation = 'lighter';
  const peak = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.06);
  peak.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  peak.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  peak.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = peak;
  g.fillRect(0, 0, size, size);

  // 4) 整图轻微模糊（destination-in 一个柔和的圆形 alpha 蒙版 + 模糊）
  //    Canvas2D 没有原生 blur，用多次 destination-in 平滑边缘
  g.globalCompositeOperation = 'destination-in';
  const softMask = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  softMask.addColorStop(0.0, 'rgba(0,0,0,1)');
  softMask.addColorStop(0.6, 'rgba(0,0,0,0.85)');
  softMask.addColorStop(0.9, 'rgba(0,0,0,0.2)');
  softMask.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = softMask;
  g.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const starFlareTex = makeStarFlareTexture();
for(const _fs of flareSprites) _fs.material.map = starFlareTex;


/* ================================================================
 *  坐标数据
 *  地图在 XZ 平面（Y=0），向南(lat 小) = +Z，向北 = -Z
 *  向东(lon 大) = +X，向西 = -X
 * ================================================================ */
const IRAN_LON = [44, 63];
const IRAN_LAT = [25, 40];
function geoToXZ(lon, lat){
  const x = ((lon - IRAN_LON[0]) / (IRAN_LON[1] - IRAN_LON[0]) - 0.5) * 240;
  // 纬度高的在画面远处（-Z），低的在近处（+Z）
  const z = -((lat - IRAN_LAT[0]) / (IRAN_LAT[1] - IRAN_LAT[0]) - 0.5) * 180;
  return { x, z };
}

const COORDINATES = [
  {
    id: 'golestan', name: 'TEHRAN', zh:'德黑兰 · 古列斯坦宫',
    lon: 51.42, lat: 35.76, day: 1,
    modelId: 'golestan',
    panoUrl: './golestan_360.jpg',
    subtitle: 'GOLESTAN PALACE',
    subtitleRight: 'MIRROR HALL',
    subtitleRight2: 'تالار آینه',
    sceneReady: true,
    story: {
      coord: 'TEHRAN · 35.68°N / 51.42°E',
      day: 'day 1',
      lines: [
        { text: '两百多年来，这里一直被叫做"镜宫"。', quiet:false },
        { text: '直到<strong class="cue">吊灯被击碎</strong>的那一天——', quiet:false },
      ]
    },
    // 灼烧阶段的文案：突出战争带来的、不可修复的遗憾
    collapseStory: {
      coord: 'TEHRAN · 35.68°N / 51.42°E',
      day: 'day 1',
      lines: [
        { text: '2026 年 3 月 20 日，诺鲁孜节。', quiet:true },
        { text: '一枚导弹穿过穹顶。', quiet:false },
        { text: '十万面镜片，一面接一面，碎在地上。', quiet:false },
        { text: '他们说，镜子碎了可以重拼。', quiet:true },
        { text: '但有些光，碎了就再也照不回来了。', quiet:false },
      ]
    }
  },
];
COORDINATES.forEach(c=>{
  const p = geoToXZ(c.lon, c.lat);
  // anchor 是光标中心的世界坐标（在地面上）
  c.anchor = { x:p.x, y:0, z:p.z };
  // 标签悬浮在光标上方约 12 单位
  c.labelAnchor = { x:p.x, y:12, z:p.z };
});

/* 伊朗国境简化轮廓 */
const IRAN_OUTLINE = [
  [44.5,39.5],[45,38.5],[46,38.8],[46.5,39],[47.8,39.5],
  [48.3,38.4],[48.5,37.5],[49.5,37.4],[50.5,37],[52,37],
  [53.5,37],[54.3,37.4],[55.8,38.1],[57.5,38.2],[59,37.8],
  [60.3,36.6],[61.2,35.6],[61,34.5],[60.7,33.5],[60.5,32],
  [60.8,30.5],[61.5,29.7],[62.5,28.3],[62.7,26.8],[61.5,26],
  [59.5,25.5],[57.8,25.3],[56,26.5],[54.5,26.5],[53,27],
  [51.5,27.8],[50,29],[48.5,30],[48,31.5],[47.3,32.8],
  [46,33.5],[45.5,34.5],[45,36],[44.5,37.5],[44.5,39.5]
];

/* ================================================================
 *  粒子数组
 * ================================================================ */
const positions   = new Float32Array(COUNT * 3);
const velocities  = new Float32Array(COUNT * 3);
const targets     = new Float32Array(COUNT * 3);
const sizes       = new Float32Array(COUNT);
const colors      = new Float32Array(COUNT * 3);
const seeds       = new Float32Array(COUNT);
const roles       = new Float32Array(COUNT);
const releaseLife = new Float32Array(COUNT);
const scatteredPos= new Float32Array(COUNT * 3);
const partNormals = new Float32Array(COUNT * 3); // 每颗粒子的真实表面法线（来自 GLB）

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
geometry.setAttribute('aNormal',  new THREE.BufferAttribute(partNormals, 3));

/* ---------- Shader（沙雕质感：真法线 + Lambert + 可切换 blending） ---------- */
const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTex:{value:spriteTex}, uPixelRatio:{value:renderer.getPixelRatio()},
    uTime:{value:0}, uSizeMul:{value:1.0}, uBrightness:{value:1.0},
    // 强方向光：从【右上侧】打来（z 分量缩小到 0.15，更"侧"，让前后朝向亮暗差更明显）
    // 这样琴自转时正面/背面会有清晰的明暗交替，方便观察旋转方向
    uLightDir:{value:new THREE.Vector3(0.78, 0.62, 0.15).normalize()},
    uLightColor:{value:new THREE.Color(1.0, 0.92, 0.75)}, // 暖白光
    uShadowColor:{value:new THREE.Color(0.18, 0.13, 0.09)}, // 暗面：更深的暗暖棕，加强对比
    uAmbient:{value:0.32},   // 环境光降低（让背光面更暗，凸显旋转）
    uLightMix:{value:0.0},   // 0=地图均匀光、1=场景方向光（沙雕态）
    uWobble:{value:1.0},
    uSculpt:{value:0.0},     // 0=粒子飘动态、1=沙雕态（影响混合模式行为）
    uGroundMode:{value:0.0}, // 0=用真法线（琴体）、1=地面沙堆（统一朝上法线 + 微噪声）
  },
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aSeed;
    attribute vec3 aNormal;
    uniform float uPixelRatio, uTime, uSizeMul, uWobble, uGroundMode;
    uniform vec3 uLightDir;
    varying vec3 vColor;
    varying float vLight;
    varying float vNDotL;
    varying float vNDotV;
    varying float vSeed;
    void main(){
      vColor = aColor;
      vSeed = aSeed;
      vec3 pos = position;
      float wob = 0.35 * uWobble;
      pos.x += sin(uTime*0.7 + aSeed*30.0) * wob;
      pos.y += cos(uTime*0.6 + aSeed*20.0) * wob * 0.7;
      pos.z += sin(uTime*0.8 + aSeed*40.0) * wob;
      // —— 法线 ——
      // 琴态：用 GLB 真法线
      // 地面沙堆态：用"朝上 + 噪声扰动"法线，让沙堆有微起伏阴影
      vec3 nrm;
      if(uGroundMode > 0.5){
        // 沙堆：基础朝上 (0,1,0) + 用 seed 做伪噪声扰动
        float n1 = sin(aSeed * 137.0) * 0.6;
        float n2 = cos(aSeed * 71.0) * 0.6;
        nrm = normalize(vec3(n1, 1.0, n2));
      } else {
        nrm = aNormal;
        if(length(nrm) < 0.1){
          nrm = normalize(pos - vec3(0.0, -10.0, 0.0));
        }
      }
      // 关键：把本地法线转到世界空间，这样琴旋转时光方向不跟着转
      // （Three.js 提供的 normalMatrix 是 modelViewMatrix 的法线矩阵）
      vec3 worldNrm = normalize(mat3(modelMatrix) * nrm);
      vNDotL = dot(worldNrm, normalize(uLightDir));
      vLight = vNDotL * 0.5 + 0.5;
      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      // —— vNDotV：判定粒子朝向相机还是背向相机 ——
      // 在【视图空间】里算：法线用 normalMatrix 转到视图空间，
      // 视线方向就是从粒子指向相机原点 = normalize(-mvPos.xyz)
      // 这样就能避免 inverse(viewMatrix)（GLSL ES 1.00 没有 inverse）
      vec3 viewNrm = normalize(normalMatrix * nrm);
      vec3 viewDir = normalize(-mvPos.xyz);
      vNDotV = dot(viewNrm, viewDir);  // >0 朝向相机（正面）, <0 背向（背面）
      gl_PointSize = aSize * uSizeMul * 220.0 / -mvPos.z * uPixelRatio;
      gl_Position = projectionMatrix * mvPos;
    }`,
  fragmentShader: `
    uniform sampler2D uTex;
    uniform float uBrightness, uAmbient, uLightMix, uSculpt, uGroundMode;
    uniform vec3 uLightColor, uShadowColor;
    varying vec3 vColor;
    varying float vLight;
    varying float vNDotL;
    varying float vNDotV;
    varying float vSeed;
    void main(){
      vec4 tc = texture2D(uTex, gl_PointCoord);
      if(tc.a < 0.01) discard;

      // —— Lambert 光照：强对比 + 保留细节 ——
      // 用 half-lambert (ndotl*0.5+0.5) 做基础，smoothstep 强化对比
      float lambert = vNDotL * 0.5 + 0.5;  // 0~1
      // 单段 smoothstep 有锐利的明暗分界，比 3 段混合更"硬朗雕塑感"
      float lit = smoothstep(0.15, 0.85, lambert);

      // 沙雕态（uSculpt=1）：
      // 暗面 ≈ 颜色×阴影色×5（更深的暗暖棕，强化侧光对比）
      // 亮面 ≈ 颜色×暖光×(0.9 + lit×2.6)（高光显著更强）
      vec3 sandShadow = vColor * uShadowColor * 5.0;
      vec3 sandLit    = vColor * uLightColor * (uAmbient + lit * 2.6);
      vec3 sculptCol  = mix(sandShadow, sandLit, lit);

      // 额外的高光强化：迎光面打一个更宽更亮的暖色 "rim"，让旋转时"扫光"格外明显
      // 关键：高光必须乘 vColor，否则深色花纹会被纯暖白洗掉，纹路消失！
      float hotSpotBroad = smoothstep(0.55, 1.0, lambert);
      float hotSpotPeak  = pow(smoothstep(0.78, 1.0, lambert), 2.0);
      sculptCol += vColor * uLightColor * hotSpotBroad * 1.1;
      sculptCol += vColor * uLightColor * hotSpotPeak  * 1.4;

      // —— 前后区分：解决空心琴前后粒子叠在一起、分不清朝向的问题 ——
      // 1) 背面适度压暗 + 降饱和：让"透过去的后面"沉下去，但不能压没（否则细颈消失）
      // 2) 轮廓边（n·v ≈ 0）打 rim light：勾勒琴的外形剪影
      // 3) 正面（n·v > 0）保持原色
      float facing = vNDotV;                            // -1 ~ +1
      float backFade = smoothstep(-0.2, 0.5, facing);   // 0=后面, 1=前面
      // 背面降饱和到灰，但保留 50% 亮度（避免琴颈/琴头这种细处直接消失）
      float gray = (sculptCol.r + sculptCol.g + sculptCol.b) / 3.0;
      sculptCol = mix(vec3(gray) * 0.50, sculptCol, 0.45 + 0.55 * backFade);
      // 轮廓 rim：n·v 接近 0 的位置（侧面），打一道暖色边光勾轮廓
      float rim = pow(1.0 - abs(facing), 3.0);
      sculptCol += uLightColor * rim * 0.45;

      // 地面沙堆态额外处理：整体降亮 + 颗粒色调随机（增加层次）
      if(uGroundMode > 0.5){
        // 颗粒级随机变暗（沙子是暗哑的，不全亮）
        float darken = 0.4 + fract(vSeed * 91.7) * 0.5; // 0.4~0.9 的随机暗度
        sculptCol *= darken * 0.55; // 整体压暗到 22%~50%
      }

      // 地图态（uSculpt=0）：保留原来的亮粒子风格
      vec3 mapCol = vColor * (0.5 + lit * 0.8) * uBrightness;
      mapCol = mix(mapCol, mapCol * uLightColor * 1.2, lit * 0.4);

      vec3 col = mix(mapCol, sculptCol, uSculpt);

      // —— 关键：把 sprite 自带的 3D 球体明暗（tc.rgb）乘到颜色上 ——
      // tc.rgb 是 0~1 的灰度，代表每颗粒子内部的"立体感"
      // 沙雕态完全使用 sprite 明暗（×1.5 增强对比），地图态保留一半
      float spriteShade = (tc.r + tc.g + tc.b) / 3.0;
      // sculpt=0 时只乘 0.5+0.5*shade（保留原亮度），sculpt=1 时全用 shade（强 3D 感）
      float shadeFactor = mix(0.5 + 0.5 * spriteShade, 0.4 + 1.0 * spriteShade, uSculpt);
      col *= shadeFactor;

      // alpha：沙雕态满 alpha；飘动态半透明
      float alpha = mix(tc.a * 0.85, tc.a, uSculpt);
      gl_FragColor = vec4(col * uBrightness, alpha);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const points = new THREE.Points(geometry, particleMaterial);
scene.add(points);

/* ---------- 氛围粒子 ----------
 * 分布策略（V3.2，2026-05-30）：sun/cosmos 模式各用一套独立 geometry，避免互相干扰
 *  • SUN 几何（粉红清真寺早晨）：相机在原点附近 → 球壳多层分布
 *    - 近层 30%（r=4~18）/ 中层 45%（r=18~55）/ 远层 25%（r=55~140）
 *    - y 略向上抬 8，营造"晨光柱里浮尘"层次
 *  • COSMOS 几何（终幕"爆炸变黑"）：相机在 (0,−35,100) 玫瑰宫轨道相机 → 大盒子均匀分布
 *    - xz∈[−180,180]，y∈[−60,180]
 *    - aSeed 整体偏小（粒子统一小巧，像满天星点）
 *  → ambient.geometry 在 sun/cosmos 切换时被替换
 */
function _makeSunGeo(){
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(AMBIENT_COUNT*3);
  const seed = new Float32Array(AMBIENT_COUNT);
  for(let i=0;i<AMBIENT_COUNT;i++){
    let rMin, rMax, seedBase;
    const layerRand = Math.random();
    if(layerRand < 0.30){
      rMin = 4;   rMax = 18;   seedBase = 0.55;
    } else if(layerRand < 0.75){
      rMin = 18;  rMax = 55;   seedBase = 0.30;
    } else {
      rMin = 55;  rMax = 140;  seedBase = 0.05;
    }
    const r = Math.pow(Math.random(), 1/3) * (rMax - rMin) + rMin;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * (Math.random() * 0.7 + 0.15));
    const sinPhi = Math.sin(phi);
    pos[i*3]   = r * sinPhi * Math.cos(theta);
    pos[i*3+1] = r * Math.cos(phi) + 8;
    pos[i*3+2] = r * sinPhi * Math.sin(theta);
    seed[i] = Math.max(0.05, Math.min(1.0, seedBase + (Math.random() - 0.5) * 0.4));
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}
function _makeCosmosGeo(){
  // cosmos 模式专用：粒子数翻倍（1200 颗），黑底空旷需要更多星点撑视觉密度
  const COSMOS_COUNT = AMBIENT_COUNT * 2;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(COSMOS_COUNT*3);
  const seed = new Float32Array(COSMOS_COUNT);
  for(let i=0;i<COSMOS_COUNT;i++){
    // 终幕相机在 (0,-35,100) 圆轨道朝向 (0,0,0) → 距相机 50~150
    // 球壳分布以原点为中心，r ∈ [40, 130]
    const r = 40 + Math.pow(Math.random(), 0.5) * 90;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const sinPhi = Math.sin(phi);
    pos[i*3]   = r * sinPhi * Math.cos(theta);
    pos[i*3+1] = r * Math.cos(phi) - 10;
    pos[i*3+2] = r * sinPhi * Math.sin(theta);
    // aSeed 偏大（0.4~1.0），让粒子尺寸有保证
    seed[i] = 0.4 + Math.random() * 0.6;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
}
const _ambGeoSun = _makeSunGeo();
const _ambGeoCosmos = _makeCosmosGeo();
const ambGeo = _ambGeoSun;  // 默认（玫瑰宫常态用不到，但 ShaderMaterial 需要有 geometry）
const ambMat = new THREE.ShaderMaterial({
  uniforms:{uTex:{value:spriteTex},uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},
    uLightDir:{value:new THREE.Vector3(0.55,0.75,0.35).normalize()},uLightMix:{value:0},
    // 新增：可在 directory.js 里按场景切换的尘埃模式
    uOpacityScale:{value:1.0}, // 整体不透明度倍数（用于淡入淡出）
    uSunMode:{value:0.0},      // 1.0 = 阳光下尘埃模式（粉红清真寺早晨）：偏暖、稍大、有光柱感
    uCosmosMode:{value:0.0},   // 1.0 = 宇宙尘埃模式（终幕变黑）：偏冷蓝白、稍亮、点状
  },
  vertexShader:`
    attribute float aSeed;
    uniform float uTime, uPixelRatio;
    uniform vec3 uLightDir;
    uniform float uSunMode, uCosmosMode;
    varying float vLight;
    void main(){
      vec3 p = position;
      // 飘动幅度：基础 0.8/0.5/0.7
      //   sun 模式 ×2.5（晨光浮尘真的"飘"起来）
      //   cosmos 模式 ×0.15（宇宙星尘极慢漂移，肉眼几乎完全静止，只剩呼吸感）
      float driftAmp = mix(1.0, 2.5, uSunMode);
      driftAmp *= mix(1.0, 0.15, uCosmosMode);
      // 时间频率：cosmos 模式压到 0.08×（约 12× 慢于普通模式）
      float driftSpeed = mix(1.0, 0.08, uCosmosMode);
      float t = uTime * driftSpeed;
      p.x += sin(t*0.15 + aSeed*50.0) * 0.8 * driftAmp;
      p.y += cos(t*0.12 + aSeed*40.0) * 0.5 * driftAmp;
      p.z += sin(t*0.10 + aSeed*30.0) * 0.7 * driftAmp;
      vLight = smoothstep(-0.2, 0.9, dot(normalize(p), uLightDir));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      // 之前 (0.6 + aSeed*1.1) * 130 / -mv.z 在近距离爆开成 20+ px 大白盘，
      // 系数砍到 1/4：(0.4 + aSeed*0.4) * 32 / -mv.z；
      // V3.1：max 下限 4.0（既保持近大远小层次，又不会让最近的爆成大白盘）
      float sz = (0.4 + aSeed*0.4) * 32.0 / max(-mv.z, 4.0) * uPixelRatio;
      // 阳光模式：适度放大（光柱中飘的浮尘有体积感）
      // 宇宙模式：大幅放大（黑底 + Additive，远粒子必须 >= 3px 才不被 GPU 丢）
      sz *= mix(1.0, 2.00, uSunMode);
      sz *= mix(1.0, 3.00, uCosmosMode);   // V3.3：cosmos 放大系数 1.8 → 3.0，确保远粒子可见
      gl_PointSize = clamp(sz, 0.0, 16.0 * uPixelRatio);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader:`
    uniform sampler2D uTex;
    uniform float uLightMix;
    uniform float uOpacityScale, uSunMode, uCosmosMode;
    varying float vLight;
    void main(){
      vec4 tc = texture2D(uTex, gl_PointCoord);
      // —— 浮尘 alpha 形状（sun/cosmos 模式用纯净高斯 falloff，避免 spriteTex 内部硬色阶）——
      // 原 spriteTex 是带"立体球暗部"的 5 段渐变，边缘过渡硬，看起来像小白盘
      // 这里改用从中心到边缘的纯指数衰减：中心 a=1，0.4 半径 a≈0.4，边缘 a≈0
      float d = distance(gl_PointCoord, vec2(0.5));
      // pow(1-2d, k) 形 + 高斯 exp(-k*d^2) 混合，得到柔软的"晕"
      float halo = exp(-d * d * 14.0);                     // 高斯主体
      halo *= smoothstep(0.5, 0.30, d);                    // 边缘平滑收口（0.5 处归零）
      if(halo < 0.005 && tc.a < 0.01) discard;
      // 哑光浮尘：取消"光照方向变化导致的闪烁"，固定低亮度灰白
      float lit = mix(0.45, 0.30 + vLight * 0.10, uLightMix);
      vec3 colScene = mix(vec3(0.60,0.58,0.62), vec3(0.78,0.72,0.62), vLight);
      vec3 col = mix(vec3(0.65,0.60,0.50), colScene, uLightMix);
      float a = mix(0.14, 0.10 + vLight * 0.05, uLightMix);

      // —— 阳光下尘埃模式（粉红清真寺早晨）——
      //   颜色：暖白；混合：Additive；alpha 形状：高斯 halo（边缘极朦胧）
      if(uSunMode > 0.5){
        vec3 sunHot  = vec3(1.00, 0.98, 0.92);
        vec3 sunWarm = vec3(1.00, 0.92, 0.78);
        col = mix(sunWarm, sunHot, vLight);
        lit = 1.00;
        a   = 0.85;          // 中心强度（halo 自带衰减，不需要再乘 spriteTex）
      }
      // —— 宇宙尘埃模式（终幕"爆炸变黑"）——
      //   黑底 + Additive：alpha 提高到 0.85 让星尘在黑底上像真实星点一样亮
      if(uCosmosMode > 0.5){
        vec3 cosmosCol = vec3(0.92, 0.94, 1.00);  // 略提冷蓝白亮度
        col = cosmosCol;
        lit = 1.00;
        a   = 0.85;
      }

      // sun/cosmos 用高斯 halo 代替 spriteTex.a；普通模式仍用 spriteTex.a 保留原立体感
      float useHalo = max(uSunMode, uCosmosMode);
      float finalA = mix(tc.a, halo, useHalo);
      gl_FragColor = vec4(col * lit, finalA * a * uOpacityScale);
    }`,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,  // sun/宇宙都靠 Additive 提亮可见性
});
const ambient = new THREE.Points(ambGeo, ambMat);
/* 暴露给 directory.js：按尘埃模式切换粒子分布几何
 * sun → 球壳多层（近大远小有层次，配合原点附近相机）
 * cosmos → 大盒子均匀（满天星点，配合终幕轨道相机）
 * 普通 → 默认球壳（玫瑰宫常态本来就不显示 ambient） */
window._setAmbientLayout = function(mode){
  if(mode === 'cosmos' && ambient.geometry !== _ambGeoCosmos){
    ambient.geometry = _ambGeoCosmos;
  } else if(mode === 'sun' && ambient.geometry !== _ambGeoSun){
    ambient.geometry = _ambGeoSun;
  }
};
scene.add(ambient);

/* ================================================================
 *  形态生成器
 * ================================================================ */
function insidePolygon(x, y, poly){
  let inside = false;
  for(let i=0, j=poly.length-1; i<poly.length; j=i++){
    const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
    if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi)) inside = !inside;
  }
  return inside;
}

/* 地图形态：XZ 水平面 + 光柱 */
function buildMapTargets(){
  const PILLAR_EACH = Math.floor(COUNT * 0.035);   // 每光柱 3.5%（5 个点分配更均匀）
  const PILLAR_TOTAL = PILLAR_EACH * COORDINATES.length;
  const OUTLINE_N = Math.floor(COUNT * 0.22);
  const INTERIOR_N = COUNT - PILLAR_TOTAL - OUTLINE_N;
  let i = 0;

  // ===== 轮廓线（Y=0） =====
  for(let k=0; k<OUTLINE_N; k++, i++){
    const seg = IRAN_OUTLINE.length - 1;
    const t = Math.random() * seg;
    const idx = Math.floor(t), frac = t - idx;
    const [lon1, lat1] = IRAN_OUTLINE[idx];
    const [lon2, lat2] = IRAN_OUTLINE[idx+1];
    const p = geoToXZ(lon1 + (lon2-lon1)*frac, lat1 + (lat2-lat1)*frac);
    targets[i*3]   = p.x + (Math.random()-0.5)*1.5;
    targets[i*3+1] = (Math.random()-0.5)*2; // 略浮起
    targets[i*3+2] = p.z + (Math.random()-0.5)*1.5;
    sizes[i] = 0.7 + Math.random()*0.5;
    colors[i*3]=0.75; colors[i*3+1]=0.62; colors[i*3+2]=0.45;
    roles[i] = 10;
  }

  // ===== 内部填充（国土"沙地"） =====
  let filled = 0, tries = 0;
  while(filled < INTERIOR_N && tries < INTERIOR_N * 8){
    tries++;
    const lon = IRAN_LON[0] + Math.random() * (IRAN_LON[1] - IRAN_LON[0]);
    const lat = IRAN_LAT[0] + Math.random() * (IRAN_LAT[1] - IRAN_LAT[0]);
    if(!insidePolygon(lon, lat, IRAN_OUTLINE)) continue;
    const p = geoToXZ(lon, lat);
    targets[i*3]   = p.x + (Math.random()-0.5)*2;
    targets[i*3+1] = (Math.random()-0.5)*1.5;
    targets[i*3+2] = p.z + (Math.random()-0.5)*2;
    sizes[i] = 0.4 + Math.random()*0.35;
    const shade = 0.45 + Math.random()*0.25;
    colors[i*3]=0.55*shade; colors[i*3+1]=0.45*shade; colors[i*3+2]=0.32*shade;
    roles[i] = 11;
    i++; filled++;
  }
  while(filled < INTERIOR_N){
    targets[i*3]=0;targets[i*3+1]=0;targets[i*3+2]=0;
    sizes[i]=0.4;colors[i*3]=0.3;colors[i*3+1]=0.25;colors[i*3+2]=0.18;
    roles[i]=11;i++;filled++;
  }

  // ===== 地表光标（贴地的脉动光点，替代光柱） =====
  for(let c=0; c<COORDINATES.length; c++){
    const coord = COORDINATES[c];
    for(let k=0; k<PILLAR_EACH; k++, i++){
      // 圆盘状：半径集中（高斯分布），Y 几乎贴地
      const r = Math.pow(Math.random(), 0.8) * 5.5;
      const ang = Math.random() * Math.PI * 2;
      targets[i*3]   = coord.anchor.x + Math.cos(ang) * r;
      targets[i*3+1] = Math.random() * 1.2;  // 贴地，最多浮起 1.2 单位
      targets[i*3+2] = coord.anchor.z + Math.sin(ang) * r;
      sizes[i] = 0.9 + Math.random()*0.7;
      // 明亮暖金
      colors[i*3]   = 0.98;
      colors[i*3+1] = 0.82;
      colors[i*3+2] = 0.52;
      roles[i] = 20 + c;
    }
  }

  while(i<COUNT){
    targets[i*3]=0;targets[i*3+1]=0;targets[i*3+2]=0;
    sizes[i]=0.4;colors[i*3]=0.3;colors[i*3+1]=0.25;colors[i*3+2]=0.18;
    roles[i]=11;i++;
  }
}

/* ================================================================
 *  通用场景 targets 分发器
 * ================================================================ */
function buildSceneTargets(sceneId){
  if(sceneId === 'golestan'){
    buildChandelierTargets();
  } else if(sceneId === 'tehran'){
    buildKamanchehTargets();
  } else {
    buildPlaceholderTargets();
  }
}

/* ----------------------------------------------------------------
 *  场景 1 · 吊灯粒子化（金色发光态）
 * ---------------------------------------------------------------- */
function buildChandelierTargets(){
  const mdl = MODELS.golestan;
  if(mdl.sampledPoints){
    return buildChandelierFromModel();
  }
  if(!mdl.loadFailed) loadModelForScene('golestan');
  buildWaitingTargets();
}

function buildChandelierFromModel(){
  window.__targetsFromModel = true;
  const mdl = MODELS.golestan;
  const { points: pts, normals: nrms } = mdl.sampledPoints;
  const Y_OFFSET = mdl.yOffset;
  const N = Math.min(COUNT, pts.length / 3);

  for(let i=0; i<N; i++){
    targets[i*3]   = pts[i*3];
    targets[i*3+1] = pts[i*3+1] + Y_OFFSET;
    targets[i*3+2] = pts[i*3+2];

    partNormals[i*3]   = nrms[i*3];
    partNormals[i*3+1] = nrms[i*3+1];
    partNormals[i*3+2] = nrms[i*3+2];

    const py = pts[i*3+1];
    const px = pts[i*3], pz = pts[i*3+2];
    const r = Math.sqrt(px*px + pz*pz);

    // 金色发光态配色：金框架 + 亮白水晶坠子 + 暖光环境
    const grainNoise = 0.90 + Math.random() * 0.18;
    const isCoarse = Math.random() < 0.12;

    // 简单分区（吊灯从上到下：顶部吊链 → 中部框架 → 底部水晶坠子）
    const yRange = mdl.sampledPoints.bbox.max.y - mdl.sampledPoints.bbox.min.y;
    const yNorm = (py - mdl.sampledPoints.bbox.min.y) / Math.max(yRange, 1); // 0=底 1=顶

    if(yNorm > 0.75){
      // 顶部：吊链/顶饰 — 暗金
      const base = grainNoise * 0.85;
      colors[i*3]   = 0.72 * base;
      colors[i*3+1] = 0.55 * base;
      colors[i*3+2] = 0.30 * base;
      sizes[i] = isCoarse ? 0.55+Math.random()*0.20 : 0.38+Math.random()*0.15;
      roles[i] = 0;
    } else if(yNorm > 0.35){
      // 中部：主体框架 — 亮金色，大颗粒
      const base = grainNoise * 1.10;
      colors[i*3]   = 1.15 * base;
      colors[i*3+1] = 0.90 * base;
      colors[i*3+2] = 0.45 * base;
      sizes[i] = isCoarse ? 0.65+Math.random()*0.25 : 0.45+Math.random()*0.18;
      roles[i] = 0;
    } else if(yNorm > 0.12){
      // 下部：水晶坠子区 — 亮白/浅金，有闪烁感
      const sparkle = Math.random() < 0.25;
      if(sparkle){
        // 闪亮水晶：近白色
        const base = grainNoise * 1.30;
        colors[i*3]   = 1.35 * base;
        colors[i*3+1] = 1.25 * base;
        colors[i*3+2] = 1.05 * base;
        sizes[i] = 0.30+Math.random()*0.12;
      } else {
        // 普通水晶：淡金
        const base = grainNoise * 1.05;
        colors[i*3]   = 1.08 * base;
        colors[i*3+1] = 0.95 * base;
        colors[i*3+2] = 0.70 * base;
        sizes[i] = 0.35+Math.random()*0.15;
      }
      roles[i] = 0;
    } else {
      // 底部尖端 — 暗影过渡
      const base = grainNoise * 0.75;
      colors[i*3]   = 0.60 * base;
      colors[i*3+1] = 0.48 * base;
      colors[i*3+2] = 0.28 * base;
      sizes[i] = 0.28+Math.random()*0.12;
      roles[i] = 0;
    }
  }
  // 兜底
  for(let i=N; i<COUNT; i++){
    targets[i*3] = (Math.random()-0.5)*30;
    targets[i*3+1] = (Math.random()-0.5)*40 + Y_OFFSET;
    targets[i*3+2] = (Math.random()-0.5)*30;
    partNormals[i*3]=0; partNormals[i*3+1]=1; partNormals[i*3+2]=0;
    roles[i] = 0;
    sizes[i] = 0.15;
    colors[i*3]=0.45; colors[i*3+1]=0.38; colors[i*3+2]=0.22;
  }
  geometry.getAttribute('aNormal').needsUpdate = true;
  console.log('[chandelier] 金色吊灯 targets 构建完成，粒子数:', N);
}

function buildKamanchehTargets(){
  // === 真模型采样路径（唯一路径） ===
  if(kamanchehSampledPoints){
    return buildKamanchehFromModel();
  }
  // === 模型未就绪：触发加载，并把 targets 设为"地面待命"状态（避免黑屏/错误模型） ===
  if(!kamanchehLoadFailed) loadKamanchehModel();
  buildWaitingTargets();
}

/* 模型未就绪时的占位 targets：粒子在场景中央贴地散开等待 */
function buildWaitingTargets(){
  window.__targetsFromModel = false;
  for(let i=0; i<COUNT; i++){
    // 在地面附近散开（不让粒子聚成任何形态）
    targets[i*3]   = (Math.random()-0.5) * 80;
    targets[i*3+1] = -45 + (Math.random()-0.5) * 6;
    targets[i*3+2] = (Math.random()-0.5) * 50 - 10;
    roles[i] = 0;
    sizes[i] = 0.25 + Math.random() * 0.25;
    const t = 0.55 + Math.random() * 0.20;
    colors[i*3]   = 0.85 * t;
    colors[i*3+1] = 0.65 * t;
    colors[i*3+2] = 0.38 * t;
  }
}

/* ----------------------------------------------------------------
 *  真模型采样版本（30 行 vs 460 行）
 * ---------------------------------------------------------------- */
function buildKamanchehFromModel(){
  window.__targetsFromModel = true;
  const { points, normals } = kamanchehSampledPoints;
  // 整体上移 50 单位，确保琴箱完全显示在故事卡片上方
  const Y_OFFSET = 50;
  const N = Math.min(COUNT, points.length / 3);

  // —— 估算琴箱最大半径（用于识别"赤道"装饰带）——
  let maxR = 0;
  // —— 同时统计 Y 范围，用于诊断 yNorm 阈值是否合理 ——
  let minPY = Infinity, maxPY = -Infinity;
  for(let i=0; i<N; i++){
    const dx = points[i*3], dz = points[i*3+2];
    const r = Math.sqrt(dx*dx + dz*dz);
    if(r > maxR) maxR = r;
    const py = points[i*3+1];
    if(py < minPY) minPY = py;
    if(py > maxPY) maxPY = py;
  }
  if(!isFinite(maxR) || maxR < 1) maxR = 8;

  // —— 自适应：用真实 Y 范围算 yNorm，让琴头/琴箱阈值真正生效 ——
  // （之前写死 py/65，但模型实际 Y 范围可能不是 ±65，导致 isHead 永远不命中）
  const halfH = Math.max(1, (maxPY - minPY) * 0.5);
  const midY  = (maxPY + minPY) * 0.5;
  // 计数器：诊断每个区被分到的粒子数
  let cntHead=0, cntString=0, cntBody=0, cntNeck=0;

  for(let i=0; i<N; i++){
    targets[i*3]   = points[i*3];
    targets[i*3+1] = points[i*3+1] + Y_OFFSET;
    targets[i*3+2] = points[i*3+2];

    const px = points[i*3], py = points[i*3+1], pz = points[i*3+2];
    const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2];
    const yNorm = (py - midY) / halfH; // -1 ~ +1，按真实模型高度划分

    // —— 把真实表面法线写入粒子 attribute（让 shader 做精确 Lambert 光照） ——
    partNormals[i*3]   = nx;
    partNormals[i*3+1] = ny;
    partNormals[i*3+2] = nz;

    // —— 角色分配（沿用原叙事钩子：roles[i]=1~4 是四根弦） ——
    const r2 = px*px + pz*pz;
    const radial = Math.sqrt(r2);
    const radialN = radial / maxR;             // 0~1：离中轴的归一化半径
    // 阈值改成基于自适应 yNorm：
    //   琴箱：y < -0.30（下 35%）
    //   弦区：-0.10 < y < 0.55 且离中轴近
    //   琴头：y > 0.55（上 22%，把弦轴+琴头一起算琴头，放大视觉权重）
    //   琴颈：其他
    const isStringRegion = (yNorm > -0.10 && yNorm < 0.55 && radialN < 0.35);
    if(isStringRegion){
      const sIdx = Math.max(0, Math.min(3, Math.floor((px + 2) / 1)));
      roles[i] = sIdx + 1;
      cntString++;
    } else if(yNorm > 0.55){
      roles[i] = 5; // 琴头/弦轴区
      cntHead++;
    } else if(yNorm < -0.30){
      roles[i] = 0; // 琴箱
      cntBody++;
    } else {
      roles[i] = 0; // 琴颈
      cntNeck++;
    }

    // —— 颜色：以米黄沙土为底，按"细节区"做差异化，强化品格/装饰/琴箱体积 ——
    const isCoarseGrain = Math.random() < 0.18;
    const grainNoise = 0.88 + Math.random() * 0.20;       // 颗粒间微差异
    const heightTint = 0.92 + (yNorm + 1) * 0.04;          // 越高越亮

    const isHead = (roles[i] === 5);  // 琴头
    const isBody = (yNorm < -0.30);   // 琴箱（与上面的阈值对齐）

    // ========== 程序化弦线 & 品格线（让琴面板和琴颈有明显细节） ==========
    // 弦线：4 根弦沿 X 方向分布在 [-1.2, -0.4, 0.4, 1.2] 附近
    // 它们从琴颈（yNorm≈0.5）延伸到琴箱中部（yNorm≈-0.5）
    // 仅限面板朝前（nz > 0.3）且离中轴较近（radialN < 0.5）的粒子
    const onFrontFace = (nz > 0.3 || (Math.abs(ny) < 0.4 && Math.abs(nz) > 0.15));
    const inStringYRange = (yNorm > -0.50 && yNorm < 0.55);
    let isOnString = false;
    if(onFrontFace && inStringYRange && radialN < 0.55){
      const STRING_X = [-1.0, -0.35, 0.35, 1.0]; // 4 根弦的 X 坐标
      const STRING_WIDTH = 0.25; // 弦宽度容差
      for(let s=0; s<4; s++){
        if(Math.abs(px - STRING_X[s]) < STRING_WIDTH){
          isOnString = true;
          break;
        }
      }
    }

    // 品格线：琴颈上每隔一段 Y 距离的横向暗条
    // yNorm 在 -0.10 ~ 0.55 范围，约每 0.06 间距一条品格线
    let isOnFret = false;
    if(!isBody && !isHead && yNorm > -0.10 && yNorm < 0.55){
      const fretSpacing = 0.055;
      const fretFrac = ((yNorm + 0.10) / fretSpacing) % 1.0;
      // 品格线占 15% 宽度
      if(fretFrac < 0.15 || fretFrac > 0.85){
        isOnFret = true;
      }
    }

    if(isHead){
      // 琴头/弦轴：视觉焦点。已在采样阶段加密 ×9，这里再用大颗粒撑视觉
      const base = grainNoise * 1.25;
      colors[i*3]   = 1.15 * base;
      colors[i*3+1] = 0.92 * base;
      colors[i*3+2] = 0.62 * base;
      // 顶端（弦轴/琴头帽）再放大，做出明确的"形状"
      const headBoost = (yNorm > 0.85) ? 1.55 : 1.20;
      sizes[i] = (isCoarseGrain ? 0.80 + Math.random()*0.34
                                : 0.55 + Math.random()*0.24) * headBoost;
    } else if(isStringRegion){
      // 弦区（琴颈中心）
      const base = grainNoise * heightTint;
      if(isOnString){
        // 弦线上的粒子：深色细线 + 小颗粒
        colors[i*3]   = 0.35 * base;
        colors[i*3+1] = 0.28 * base;
        colors[i*3+2] = 0.18 * base;
        sizes[i] = 0.28 + Math.random()*0.10;
      } else if(isOnFret){
        // 品格线：浅金属色
        colors[i*3]   = 0.75 * base;
        colors[i*3+1] = 0.72 * base;
        colors[i*3+2] = 0.60 * base;
        sizes[i] = 0.35 + Math.random()*0.12;
      } else {
        colors[i*3]   = 0.90 * base;
        colors[i*3+1] = 0.76 * base;
        colors[i*3+2] = 0.55 * base;
        sizes[i] = isCoarseGrain ? 0.65 + Math.random()*0.20
                                 : 0.45 + Math.random()*0.18;
      }
    } else if(isBody){
      // 琴箱：分层做出立体装饰感 + 弦线
      const isEquator = (radialN > 0.78);
      const isBottom  = (ny < -0.25);
      const base = grainNoise * heightTint;

      if(isOnString && onFrontFace){
        // 琴箱面板上的弦线：深色细线，像真实弦一样可见
        colors[i*3]   = 0.32 * base;
        colors[i*3+1] = 0.25 * base;
        colors[i*3+2] = 0.15 * base;
        sizes[i] = 0.22 + Math.random()*0.08;
      } else if(isEquator){
        // 装饰带：8 瓣花式，亮处极亮（金）/ 暗处极暗（深棕），拉到 3x 对比
        const ang = Math.atan2(pz, px);
        const motif = Math.sin(ang * 8.0);
        if(motif > 0.3){
          // 亮花瓣：金亮色，颗粒大像浮雕凸起
          colors[i*3]   = 1.05 * base;
          colors[i*3+1] = 0.85 * base;
          colors[i*3+2] = 0.50 * base;
          sizes[i] = 0.40 + Math.random()*0.18;
        } else {
          // 暗花瓣：深棕嵌花
          colors[i*3]   = 0.42 * base;
          colors[i*3+1] = 0.28 * base;
          colors[i*3+2] = 0.18 * base;
          sizes[i] = 0.22 + Math.random()*0.10;
        }
      } else if(isBottom){
        colors[i*3]   = 0.70 * base;
        colors[i*3+1] = 0.55 * base;
        colors[i*3+2] = 0.38 * base;
        sizes[i] = isCoarseGrain ? 0.34 + Math.random()*0.16
                                 : 0.20 + Math.random()*0.12;
      } else {
        colors[i*3]   = 0.86 * base;
        colors[i*3+1] = 0.72 * base;
        colors[i*3+2] = 0.52 * base;
        sizes[i] = isCoarseGrain ? 0.34 + Math.random()*0.18
                                 : 0.18 + Math.random()*0.14;
      }
    } else {
      // 琴颈（非弦区、非琴箱、非琴头）
      const base = grainNoise * heightTint;
      if(isOnFret){
        // 品格线：横向暗条（金属品格）
        colors[i*3]   = 0.72 * base;
        colors[i*3+1] = 0.68 * base;
        colors[i*3+2] = 0.55 * base;
        sizes[i] = 0.55 + Math.random()*0.15;
      } else if(isOnString){
        // 弦线穿过琴颈：深色
        colors[i*3]   = 0.38 * base;
        colors[i*3+1] = 0.30 * base;
        colors[i*3+2] = 0.20 * base;
        sizes[i] = 0.35 + Math.random()*0.12;
      } else {
        colors[i*3]   = 0.92 * base;
        colors[i*3+1] = 0.78 * base;
        colors[i*3+2] = 0.55 * base;
        sizes[i] = isCoarseGrain ? 0.75 + Math.random()*0.25
                                 : 0.50 + Math.random()*0.20;
      }
    }
  }
  // 兜底剩余粒子
  for(let i=N; i<COUNT; i++){
    targets[i*3] = (Math.random()-0.5)*30;
    targets[i*3+1] = (Math.random()-0.5)*60;
    targets[i*3+2] = (Math.random()-0.5)*8;
    partNormals[i*3] = 0; partNormals[i*3+1] = 1; partNormals[i*3+2] = 0;
    roles[i] = 0;
    sizes[i] = 0.18;
    colors[i*3]=0.55; colors[i*3+1]=0.45; colors[i*3+2]=0.32;
  }
  // 通知 GPU 法线已变（颜色/大小由调用者标记 needsUpdate）
  geometry.getAttribute('aNormal').needsUpdate = true;

  // —— 诊断日志：让我们看到每个区到底有多少粒子 ——
  console.log('[setar 区域分布] py范围:', minPY.toFixed(1), '~', maxPY.toFixed(1),
              ' midY:', midY.toFixed(1), ' halfH:', halfH.toFixed(1),
              ' maxR:', maxR.toFixed(1));
  console.log('[setar 区域分布] 琴头:', cntHead,
              ' 弦区:', cntString,
              ' 琴箱:', cntBody,
              ' 琴颈:', cntNeck,
              ' 总:', N);
}


function buildPlaceholderTargets(){
  for(let i=0; i<COUNT; i++){
    const r = Math.pow(Math.random(), 0.6) * 55;
    const th = Math.random()*Math.PI*2;
    const ph = Math.acos(2*Math.random()-1);
    targets[i*3] = r * Math.sin(ph)*Math.cos(th);
    targets[i*3+1] = r * Math.cos(ph)*0.7 - 10;
    targets[i*3+2] = r * Math.sin(ph)*Math.sin(th);
    roles[i] = 0; sizes[i] = 0.5 + Math.random()*0.5;
    const t = 0.6 + Math.random()*0.3;
    colors[i*3]=0.75*t; colors[i*3+1]=0.60*t; colors[i*3+2]=0.42*t;
  }
}

function buildScatteredPositions(){
  for(let i=0; i<COUNT; i++){
    scatteredPos[i*3] = (Math.random()-0.5) * 280;
    const yr = Math.pow(Math.random(), 1.8);
    scatteredPos[i*3+1] = -10 - yr * 80 + (Math.random()-0.5)*20;
    scatteredPos[i*3+2] = (Math.random()-0.5)*140 - 20;
  }
}

/* ================================================================
 *  场景 1 新管线：完整吊灯 → 点击崩塌
 *  使用真实碎玻璃 3D 模型（broken_wine_glass.glb，257 块独立碎片 mesh）
 * ================================================================ */
const SHARD_COUNT = isMobile ? 120 : 250;
const DUST_COUNT  = isMobile ? 200 : 500;

// 碎片模型缓存
let shardModelMeshes = null; // 加载后的碎片 mesh 数组
let shardModelLoading = false;

/* 预加载碎片模型 */
function loadShardModel(){
  if(shardModelMeshes || shardModelLoading) return;
  shardModelLoading = true;
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath(_isLocal ? './draco/' : _CDN + 'draco/');
  const loader = new THREE.GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  const url = _isLocal ? './broken_wine_glass_compressed.glb' : _CDN + 'broken_wine_glass_compressed.glb';
  console.log('[shard] 开始加载碎片模型:', url);
  loader.load(url, (gltf) => {
    // 保存完整场景 + 动画
    shardModelMeshes = {
      scene: gltf.scene,
      animations: gltf.animations, // AnimationClip 数组
    };
    // 隐藏地面 / 超大平板 mesh
    // 思路：先按名字过滤；再按"扁平 + 超大面积"过滤（地面通常是大而扁的 Plane）
    gltf.scene.updateMatrixWorld(true);
    const meshList = [];
    gltf.scene.traverse(o => { if(o.isMesh) meshList.push(o); });
    // 计算每个 mesh 的世界空间 bbox
    const meshInfo = meshList.map(o => {
      const b = new THREE.Box3().setFromObject(o);
      const s = new THREE.Vector3(); b.getSize(s);
      // 用横向面积（x*z 平面投影）+ 厚度比来判断是否地面
      const horizArea = s.x * s.z;
      const thinAxis = Math.min(s.x, s.y, s.z);
      const longAxis = Math.max(s.x, s.y, s.z);
      const flatness = longAxis / Math.max(thinAxis, 0.0001);
      return { o, horizArea, flatness, size: s, vCount: o.geometry?.getAttribute('position')?.count || 0 };
    });
    // 按 horizArea 排序，看最大的一个是不是异常大
    meshInfo.sort((a,b) => b.horizArea - a.horizArea);
    const avgArea = meshInfo.slice(1).reduce((s,m) => s + m.horizArea, 0) / Math.max(meshInfo.length - 1, 1);
    meshList.forEach(o => {
      const nm = (o.name || '').toLowerCase();
      if(nm.includes('plane') || nm.includes('ground') || nm.includes('floor')){
        o.visible = false;
        o._isShardGround = true;
        return;
      }
      const info = meshInfo.find(m => m.o === o);
      // 启发式：横向面积 > 平均面积 * 8，且扁平度 > 8（很大很扁）→ 地面
      if(info && info.horizArea > avgArea * 8 && info.flatness > 8){
        o.visible = false;
        o._isShardGround = true;
        console.log('[shard] 识别为地面/平板并隐藏:', o.name, '面积:', info.horizArea.toFixed(1), '扁平度:', info.flatness.toFixed(1));
      }
      const vCount = o.geometry?.getAttribute('position')?.count || 0;
      if(vCount < 10){
        o.visible = false;
        o._isShardGround = true;
      }
    });
    // 算包围盒
    gltf.scene.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(gltf.scene);
    const center = new THREE.Vector3(); bbox.getCenter(center);
    const size = new THREE.Vector3(); bbox.getSize(size);
    shardModelMeshes.center = center;
    shardModelMeshes.maxDim = Math.max(size.x, size.y, size.z);
    shardModelLoading = false;
    console.log('[shard] 碎片模型加载完成，动画数:', gltf.animations.length,
      'channels:', gltf.animations[0]?.tracks?.length,
      'size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
  }, undefined, (err) => {
    console.warn('[shard] 碎片模型加载失败:', err);
    shardModelLoading = false;
  });
}

/* 初始化（模型加载后调用） */
function initChandelierShards(mdlG){
  mdlG.shardMesh = null;
  mdlG.shardData = { active: false, time: 0 };
  // 预加载碎片模型
  loadShardModel();
  console.log('[golestan] shards placeholder ready');
}

/* 进入场景 1：显示完整吊灯实体模型 */
function enterChandelierScene(){
  const mdlG = MODELS.golestan;
  if(!mdlG.gltfScene){
    console.warn('[golestan] gltfScene 未就绪，降级到粒子管线');
    return false;
  }

  // 如果之前已经创建过 container，直接复用（避免重复 add/remove 导致丢失）
  if(mdlG.frameGroup){
    // 确保在 scene 中
    if(!mdlG.frameGroup.parent) scene.add(mdlG.frameGroup);
    mdlG.gltfScene.visible = true;
    mdlG.gltfScene.traverse(o => { if(o.isMesh) o.visible = true; });
    mdlG.collapseState = 'idle';
    scene.fog = null;
    points.visible = false;
    ambient.visible = false;
    for(let i = 0; i < COUNT; i++){
      positions[i*3] = 0; positions[i*3+1] = -9999; positions[i*3+2] = 0;
    }
    posAttr.needsUpdate = true;
    console.log('[golestan] 复用已有 container');
    return true;
  }

  // 计算缩放：用统计方法排除离群零件，只保留吊灯本体
  mdlG.gltfScene.updateMatrixWorld(true);
  // 第一遍：收集所有 mesh 的 bbox center
  const _meshInfos = [];
  mdlG.gltfScene.traverse(o => {
    if(o.isMesh && o.geometry){
      const b = new THREE.Box3().setFromObject(o);
      if(!b.isEmpty()){
        const c = new THREE.Vector3(); b.getCenter(c);
        _meshInfos.push({ mesh: o, bbox: b, center: c });
      }
    }
  });
  // 第二遍：用中位数 + 距离阈值排除离群点
  const xs = _meshInfos.map(m => m.center.x).sort((a,b) => a - b);
  const ys = _meshInfos.map(m => m.center.y).sort((a,b) => a - b);
  const zs = _meshInfos.map(m => m.center.z).sort((a,b) => a - b);
  const mid = Math.floor(_meshInfos.length / 2);
  const medX = xs[mid], medY = ys[mid], medZ = zs[mid];
  // 阈值：距中位数超过 500 的视为离群
  const OUTLIER_DIST = 500;
  const bbox = new THREE.Box3();
  const outliers = [];
  for(const m of _meshInfos){
    const dx = Math.abs(m.center.x - medX);
    const dy = Math.abs(m.center.y - medY);
    const dz = Math.abs(m.center.z - medZ);
    if(dx > OUTLIER_DIST || dy > OUTLIER_DIST || dz > OUTLIER_DIST){
      outliers.push(m.mesh.name + ' ('+m.center.x.toFixed(0)+','+m.center.y.toFixed(0)+','+m.center.z.toFixed(0)+')');
    } else {
      bbox.union(m.bbox);
    }
  }
  if(outliers.length) console.warn('[golestan] 排除离群零件:', outliers.join(', '));
  const size = new THREE.Vector3(); bbox.getSize(size);
  const center = new THREE.Vector3(); bbox.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetScale = mdlG.targetHeight / Math.max(maxDim, 0.001);
  console.log('[golestan] 最终 center:', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2), 'maxDim:', maxDim.toFixed(1), 'targetScale:', targetScale.toFixed(4));

  // 创建容器 Group
  const container = new THREE.Group();
  container.name = 'chandelierContainer';
  container.add(mdlG.gltfScene);
  // 居中 + 缩放，吊灯在世界原点（相机围绕它转）
  mdlG.gltfScene.position.set(-center.x, -center.y, -center.z);
  container.scale.setScalar(targetScale);
  container.position.set(0, mdlG.yOffset || 0, 0); // 吊灯上移，让吊绳在视角外

  // 只给材质加 envMap（环境反射），不改其他任何属性
  if(!mdlG.envMap){
    const panoTex = panoTextures['golestan'];
    if(panoTex && panoTex !== 'loading'){
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      mdlG.envMap = pmrem.fromEquirectangular(panoTex).texture;
      pmrem.dispose();
    }
  }
  if(mdlG.envMap){
    mdlG.gltfScene.traverse(o => {
      if(o.isMesh && o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const nm = (o.name || '').toLowerCase();
        const isCrystal = nm.includes('crystal') || nm.includes('glass');
        mats.forEach(m => {
          m.envMap = mdlG.envMap;
          m.envMapIntensity = isCrystal ? 3.0 : 1.5;
          // 水晶部件：提高不透明度，让吊坠更清晰可见
          if(isCrystal && m.transparent){
            m.opacity = Math.max(m.opacity, 0.7);
          }
          m.needsUpdate = true;
        });
      }
    });
  }

  // 灯光（PBR 必须有足够灯光）
  const dirLight = new THREE.DirectionalLight(0xfff0e0, 3.0);
  dirLight.name = 'chandelierDirLight';
  dirLight.position.set(30, 80, 40);
  container.add(dirLight);
  const dirLight2 = new THREE.DirectionalLight(0xe0e8ff, 1.5);
  dirLight2.name = 'chandelierDirLight2';
  dirLight2.position.set(-20, 60, -30);
  container.add(dirLight2);
  const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
  ambLight.name = 'chandelierAmbLight';
  container.add(ambLight);
  // 下方点光源（模拟地面反光，让吊灯底部也亮）
  const bottomLight = new THREE.PointLight(0xffeedd, 1.5, 200);
  bottomLight.name = 'chandelierBottomLight';
  bottomLight.position.set(0, -30, 0);
  container.add(bottomLight);

  /* —— 引导用：吊灯整体呼吸（亮度起伏 ±8%，2.5s 周期） ——
   *  在 tick() 里每帧根据 _idlePulseStartTime + _idlePulseActive 调制 4 个灯的 intensity。
   *  状态由 _idlePulseActive 控制：
   *    - true：进吊灯 idle，呼吸召唤
   *    - false：用户首次交互 / 开始崩塌 → 恢复基准亮度并停止
   *  保存 base intensity 用于一键还原。
   */
  mdlG._idleLights = [
    { light: dirLight,    base: dirLight.intensity },
    { light: dirLight2,   base: dirLight2.intensity },
    { light: ambLight,    base: ambLight.intensity },
    { light: bottomLight, base: bottomLight.intensity },
  ];
  mdlG._idlePulseActive = true;
  mdlG._idlePulseStartTime = performance.now();

  // 碎片也放进容器（初始隐藏）
  if(mdlG.shardMesh){
    // 碎片需要反向缩放（因为 container 已经 scale 了，碎片位置是世界空间的）
    // 不对——碎片位置是在原始模型空间的，放进 container 后会被 container 缩放
    container.add(mdlG.shardMesh);
  }

  scene.add(container);
  mdlG.frameGroup = container;
  mdlG.collapseState = 'idle';

  // 禁用场景雾（否则模型会被雾吃掉）
  scene.fog = null;

  // 设置所有材质不受雾影响（备用）
  mdlG.gltfScene.traverse(o => {
    if(o.isMesh && o.material){
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { m.fog = false; });
    }
  });

  // 隐藏粒子系统（彻底——移到画面外防止残影）
  points.visible = false;
  ambient.visible = false;
  for(let i = 0; i < COUNT; i++){
    positions[i*3] = 0;
    positions[i*3+1] = -9999;
    positions[i*3+2] = 0;
  }
  posAttr.needsUpdate = true;

  console.log('[golestan] 实体吊灯已添加到 scene, scale:', targetScale.toFixed(4));
  return true;
}

/* ================================================================
 *  崩塌系统 Plan B：InstancedMesh 预制立体碎片 + 径向爆炸
 *  - 200~400 个碎片仅需 2 个 drawcall（玻璃+金属各一个 InstancedMesh）
 * ================================================================ */
let crystalCollapseActive = false;
let shardObjects = [];           // 每个实例的物理状态
let shardInstMeshes = [];        // [{inst, mat}] InstancedMesh 列表
let collapseStartTime = 0;       // 崩塌开始时间戳
let collapseGravity = 1.0;       // 局部空间重力
const MAX_SHARDS = isMobile ? 200 : 400;

// 碎片几何体现在来自 broken_wine_glass 模型，不再程序化生成

/* ---------- 微尘粒子系统（碎裂时的闪烁微粒） ---------- */
let dustPoints = null;
let dustData = [];

function createDustSystem(container, samplePool, localModelSize, containerInv){
  // 保留旧函数签名兼容，但不再使用
}

function createDustSystemWorld(samplePool, worldSize, modelCenter){
  const count = DUST_COUNT;
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  const sizeArr = new Float32Array(count);  // per-particle 基础尺寸（让粒子有大小层次）
  dustData = [];

  const range = Math.max(worldSize.x, worldSize.y, worldSize.z);

  // —— 以相机为中心做球壳均匀分布 ——
  // 球壳半径：内半径 R_IN（相机近距离也有微尘）、外半径 R_OUT（包围整个观察范围）
  // 这样无论相机朝哪个方向看，视野里始终有微尘飘动
  const camPos = (typeof camera !== 'undefined' && camera) ? camera.position : new THREE.Vector3(0, 0, 0);
  // 相机到模型中心距离 → 决定 dust 球半径（保证模型本身也被笼罩在内）
  const camToCenter = modelCenter ? camPos.distanceTo(modelCenter) : 100;
  const R_IN = Math.max(range * 0.30, 50);                                // 至少 50 单位远，避免糊在镜头上
  const R_OUT = Math.max(camToCenter + range * 0.8, range * 1.8, 300);   // 远端：包围相机+模型整体
  // 给每颗微尘预存它相对相机的"球壳位置"，更新时用绝对世界坐标
  for(let i = 0; i < count; i++){
    // 球面方向：用 acos 反变换均匀采样（避免两极聚集）
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;             // 经度
    const phi = Math.acos(2 * v - 1);          // 纬度（均匀）
    const sinPhi = Math.sin(phi);
    const dx = sinPhi * Math.cos(theta);
    const dy = Math.cos(phi);
    const dz = sinPhi * Math.sin(theta);
    // 半径：在 [R_IN, R_OUT] 上用 r³ 反变换（让远端有更多颗，体积均匀）
    const rRand = R_IN + (R_OUT - R_IN) * Math.cbrt(Math.random());
    const px = camPos.x + dx * rRand;
    const py = camPos.y + dy * rRand;
    const pz = camPos.z + dz * rRand;
    posArr[i*3] = px; posArr[i*3+1] = py; posArr[i*3+2] = pz;

    // —— 每颗粒子基础尺寸分层 —— 营造大小差异的层次感
    //   55% 小（0.6~1.2）：远景细密星尘的主体
    //   30% 中（1.4~2.2）：中景，构成画面骨架
    //   15% 大（2.6~4.0）：少数几颗"焦点"亮点，强化前后景对比
    const sizeR = Math.random();
    let baseSize;
    if(sizeR < 0.55){
      baseSize = 0.6 + Math.random() * 0.6;
    } else if(sizeR < 0.85){
      baseSize = 1.4 + Math.random() * 0.8;
    } else {
      baseSize = 2.6 + Math.random() * 1.4;
    }
    sizeArr[i] = baseSize;
    dustData.push({
      x: px, y: py, z: pz,
      // 微弱的随机漂浮速度（不再带"-range*0.002"的整体下沉，否则上半球会变空）
      vx: (Math.random()-0.5) * range * 0.01,
      vy: (Math.random()-0.5) * range * 0.006,
      vz: (Math.random()-0.5) * range * 0.01,
      twinkleSpeed: 2 + Math.random() * 5,
      twinklePhase: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.3,
      // 记录球壳半径范围，更新时用于回卷
      _rIn: R_IN,
      _rOut: R_OUT,
    });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1));

  /* —— per-particle 尺寸 + 距离衰减的 ShaderMaterial ——
   * PointsMaterial 只能全局统一 size，无法体现层次。
   * 用 aSize attribute 让每颗粒子有自己的基础尺寸（55% 小 / 30% 中 / 15% 大），
   * 再叠加距离衰减 (300 / -mv.z)，自然形成"近大远小"的纵深感。
   * uOpacity 取代 material.opacity，外部仍可通过下方 set opacity 代理写入。
   */
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: crystalTex },
      uColor: { value: new THREE.Color(0xc8d0e0) },  // 冷蓝白星尘
      uOpacity: { value: 0.0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float aSize;
      uniform float uPixelRatio;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // aSize 基础尺寸 × 距离衰减；clamp 防止近距离爆开
        // 300 是衰减系数（aSize=1 在距离 300 时 ≈1px，距离 30 时 ≈10px）
        float sz = aSize * 300.0 / max(-mv.z, 30.0) * uPixelRatio;
        gl_PointSize = clamp(sz, 0.5, 18.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main(){
        vec4 tc = texture2D(uTex, gl_PointCoord);
        if(tc.a < 0.01) discard;
        gl_FragColor = vec4(uColor, tc.a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  // 兼容旧代码 `dustPoints.material.opacity = x`：定义 setter 转写到 uniform
  Object.defineProperty(mat, 'opacity', {
    get(){ return this.uniforms.uOpacity.value; },
    set(v){ this.uniforms.uOpacity.value = v; },
    configurable: true,
  });

  dustPoints = new THREE.Points(geo, mat);
  dustPoints.frustumCulled = false;
  scene.add(dustPoints); // 世界空间
  return dustPoints;
}

// 碎片动画 mixer
let shardMixer = null;

function _stopChandelierIdlePulse(){
  const mdlG = MODELS.golestan;
  if(!mdlG || !mdlG._idlePulseActive) return;
  mdlG._idlePulseActive = false;
  // 还原 4 个灯到 base intensity（避免停在某个非整周期点导致暗一下）
  if(mdlG._idleLights){
    for(const it of mdlG._idleLights){
      if(it.light) it.light.intensity = it.base;
    }
  }
}

function updateChandelierIdlePulse(now){
  const mdlG = MODELS.golestan;
  if(!mdlG || !mdlG._idlePulseActive) return;
  if(!mdlG._idleLights || !mdlG._idleLights.length) return;
  // 仅吊灯 idle 状态下生效（碎裂中/已碎裂不再呼吸）
  if(mdlG.collapseState && mdlG.collapseState !== 'idle') return;

  const t = (now - (mdlG._idlePulseStartTime || now)) / 1000;
  // 2.5s 周期 ↔ ω = 2π/2.5
  // 起手 0.6s 渐入（避免进场瞬间灯光抖动），用 (1 - cos(πt/0.6))/2 做柔启
  const fadeIn = t < 0.6 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.6) : 1.0;
  const omega = 2 * Math.PI / 2.5;
  const breathe = 1.0 + Math.sin(t * omega) * 0.08 * fadeIn;
  for(const it of mdlG._idleLights){
    if(it.light) it.light.intensity = it.base * breathe;
  }
}

function triggerChandelierCollapse(){
  const mdlG = MODELS.golestan;
  if(mdlG.collapseState !== 'idle') return;
  if(!shardModelMeshes || !shardModelMeshes.scene){ console.warn('[shard] 碎片模型未加载'); return; }

  // 停止"召唤"呼吸 + 还原灯光基准强度
  _stopChandelierIdlePulse();

  // —— 目录模式参数 ——
  // 碎片动画播到 _collapsePauseT 秒时定格（碎片刚爆开还未落地，悬停在空中），
  // 转入"目录态"：5 块大碎片亮起、可点击。用户读完所有 5 个故事后自动 resume。
  mdlG._collapsePauseT = 0.9;            // 动画时间轴上的暂停时刻（秒）
  mdlG._collapsePaused = false;
  mdlG._collapseDirectoryReady = false;
  mdlG._pauseSpinDiagPrinted = false;     // 重置诊断打印标志
  // 崩塌起爆时重新启用自动旋转：用户操作过的 yaw 累积值清零，旋转从当前视角"接续"开始
  // —— 让画面在碎片飞散时再次缓慢转起来，呼应进场时的"空间感"
  // 启动加速过冲：1.2s 内从 PEAK(0.6) 缓动到 SETTLE(0.18)，呼应爆炸冲击波
  autoRotateActive = true;
  autoRotateYaw = 0;
  autoRotateSpeed = AUTO_ROTATE_BOOST_PEAK;
  _autoRotateBoostStart = performance.now();
  mdlG.collapseState = 'collapsing';
  crystalCollapseActive = true;

  const container = mdlG.frameGroup;
  if(!container) return;
  shardObjects = []; shardInstMeshes = [];

  // CSS 闪光 + 光柱（已禁用：白雾覆盖太抢戏）
  // const flashEl = document.getElementById('shatterFlash');
  // if(flashEl){ flashEl.classList.remove('active'); void flashEl.offsetWidth; flashEl.classList.add('active'); }
  // const beamEl = document.getElementById('shatterBeam');
  // if(beamEl){ setTimeout(()=>{ beamEl.classList.remove('active'); void beamEl.offsetWidth; beamEl.classList.add('active'); }, 300); }
  // 不暗化背景（去掉蒙灰蒙版）

  // 吊灯世界空间——排除 Plane417（宫殿场景面板，不属于吊灯本体）
  container.updateMatrixWorld(true);
  const bbox = new THREE.Box3();
  container.traverse(o => {
    if(o.isMesh && o.visible && o.geometry && !o.name.startsWith('Plane417')){
      const b = new THREE.Box3().setFromObject(o);
      if(!b.isEmpty()) bbox.union(b);
    }
  });
  const cCenter = new THREE.Vector3(); bbox.getCenter(cCenter);
  const cSize = new THREE.Vector3(); bbox.getSize(cSize);
  const maxDim = Math.max(cSize.x, cSize.y, cSize.z);
  console.log('[shard] cCenter (no Plane417):', cCenter.x.toFixed(1), cCenter.y.toFixed(1), cCenter.z.toFixed(1), 'maxDim:', maxDim.toFixed(1));

  // 碎片模型 → 缩放到吊灯大小，居中到吊灯位置
  const shardScene = shardModelMeshes.scene;
  const mCenter = shardModelMeshes.center;
  const mMaxDim = shardModelMeshes.maxDim;
  const shardScale = (maxDim * 0.8) / Math.max(mMaxDim, 0.001);

  // 创建一个容器 Group，把碎片场景放进去
  const shardGroup = new THREE.Group();
  shardGroup.name = 'shardGroup';
  shardGroup.add(shardScene);
  // 居中：碎片模型的 bbox 中心对齐到吊灯中心
  // mCenter 是模型整体 bbox 中心（包含地面），我们需要只看碎片的中心
  // 先更新一下获取动画第0帧的实际位置
  shardScene.updateMatrixWorld(true);
  const shardBbox = new THREE.Box3();
  shardScene.traverse(o => {
    if(o.isMesh && o.visible){
      const b = new THREE.Box3().setFromObject(o);
      shardBbox.union(b);
    }
  });
  const shardCenter = new THREE.Vector3();
  if(!shardBbox.isEmpty()) shardBbox.getCenter(shardCenter);
  else shardCenter.copy(mCenter);

  shardScene.position.set(-shardCenter.x, -shardCenter.y, -shardCenter.z);
  shardGroup.scale.setScalar(shardScale);
  shardGroup.position.set(0, mdlG.yOffset || 0, 0); // 同步吊灯高度
  // 关键：让碎片在烧灼层之上渲染（panoBurnSphere.renderOrder = -9）
  // —— 烧灼是给全景背景做的"焦化"效果，碎片是前景实体，不应被覆盖成黑色
  // 给碎片 group 设大的 renderOrder，所有子 mesh 在 traverse 替换材质时也跟随设置
  shardGroup.renderOrder = 10;
  console.log('[shard] shardCenter:', shardCenter.x.toFixed(1), shardCenter.y.toFixed(1), shardCenter.z.toFixed(1), 'shardScale:', shardScale.toFixed(3));
  scene.add(shardGroup);

  // 灯光（让 PBR 材质正确渲染）
  const shardDirLight = new THREE.DirectionalLight(0xffffff, 3.0);
  shardDirLight.position.set(30, 60, 40);
  scene.add(shardDirLight);
  const shardDirLight2 = new THREE.DirectionalLight(0xe8e0ff, 1.5);
  shardDirLight2.position.set(-20, 40, -30);
  scene.add(shardDirLight2);
  const shardAmbLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(shardAmbLight);

  // 用吊灯水晶的材质替换碎片材质
  const mdlG2 = MODELS.golestan;
  const crystalRef = mdlG2.crystalMeshes[0];
  if(crystalRef && crystalRef.material){
    const crystalMat = crystalRef.material.clone();
    // 确保有环境贴图
    if(mdlG2.envMap && !crystalMat.envMap){
      crystalMat.envMap = mdlG2.envMap;
      crystalMat.envMapIntensity = 1.5;
    }
    crystalMat.side = THREE.DoubleSide;
    crystalMat.transparent = true;
    crystalMat.opacity = 0; // 初始全透明，由 update 淡入
    crystalMat._origOpacityTarget = 1.0; // 目标值
    // 关键：开启 depthWrite，让碎片在 transparent 队列里写深度，
    //       烧灼层 panoBurnSphere（renderOrder=-9）先画 → 碎片后画 → 完全覆盖烧灼色
    crystalMat.depthWrite = true;
    crystalMat.needsUpdate = true;
    shardScene.traverse(o => {
      if(!o.isMesh) return;
      // 双保险：识别为地面的 mesh 一定保持隐藏，不参与材质替换
      if(o._isShardGround){
        o.visible = false;
        return;
      }
      o.material = crystalMat;
      o.visible = true;
      // 每个子 mesh 显式置高 renderOrder，确保排在 panoBurnSphere(-9) 之后
      o.renderOrder = 10;
    });
  }

  // 播放原始碎裂动画（延后 0.18s 起播，让前期保持原形 → 营造"吊灯分裂"的连续感）
  shardMixer = new THREE.AnimationMixer(shardScene);
  if(shardModelMeshes.animations && shardModelMeshes.animations.length > 0){
    const clip = shardModelMeshes.animations[0];

    // ★ 关键：mixer 驱动的是 GLTF 节点（Cube_cell_xxx 这种 Object3D），不是 mesh 自身
    //   所以暂停态做角速度反推时，必须遍历这些被驱动的节点，而不是 isMesh 的子节点
    //   这里一次性扫描 tracks，把所有有 quaternion 通道的 target 节点收集起来
    const _spinTargets = [];
    const _seen = new Set();
    clip.tracks.forEach(t => {
      const dotIdx = t.name.lastIndexOf('.');
      if(dotIdx < 0) return;
      const prop = t.name.substring(dotIdx + 1);
      if(prop !== 'quaternion') return;
      const targetName = t.name.substring(0, dotIdx);
      if(_seen.has(targetName)) return;
      _seen.add(targetName);
      const node = shardScene.getObjectByName(targetName);
      if(node) _spinTargets.push(node);
    });
    mdlG._spinTargets = _spinTargets;
    console.log('[shard-clip] 收集到', _spinTargets.length, '个被 quaternion 驱动的节点（用于暂停态自转）');

    const action = shardMixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
    // 先 update(0) 一次，让骨架/位置应用到动画第 0 帧（碎片处于聚拢形态）
    shardMixer.update(0);
    console.log('[shard] 动画准备就绪，时长:', clip.duration.toFixed(2), 's（延迟 0.34s 起爆）');
  }

  shardInstMeshes.push({inst: shardGroup, mat: null});
  mdlG._shardDirLight = shardDirLight;
  mdlG._shardDirLight2 = shardDirLight2;
  mdlG._shardAmbLight = shardAmbLight;

  // 微尘粒子（碎裂时的闪烁微粒）
  const dustSamples = [{pos: cCenter.clone()}];
  for(let i = 0; i < 20; i++){
    dustSamples.push({pos: new THREE.Vector3(
      cCenter.x + (Math.random()-0.5)*maxDim*0.5,
      cCenter.y + (Math.random()-0.5)*maxDim*0.5,
      cCenter.z + (Math.random()-0.5)*maxDim*0.5
    )});
  }
  createDustSystemWorld(dustSamples, cSize, cCenter);



  collapseStartTime = performance.now();

  // 不再瞬间隐藏原吊灯！改为：吊灯所有材质快速淡出（让碎片"分裂"出来）
  // 收集所有原吊灯材质，记录原 opacity，并把 transparent 打开
  mdlG._fadeOutMats = [];
  const seenMats = new Set();
  mdlG.gltfScene.traverse(o => {
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if(!m || seenMats.has(m)) return;
      seenMats.add(m);
      // 保险：保存原 opacity / transparent / depthWrite
      m._collapseOrigOpacity = (m.opacity !== undefined) ? m.opacity : 1.0;
      m._collapseOrigTransparent = m.transparent;
      m._collapseOrigDepthWrite = m.depthWrite;
      m.transparent = true;
      // 半透明阶段关闭 depthWrite，避免穿模闪烁
      m.depthWrite = false;
      mdlG._fadeOutMats.push(m);
    });
  });
  console.log('[shard] 进入淡出，材质数:', mdlG._fadeOutMats.length);

  // 隐藏地图粒子
  points.visible = false;

  const blastLight = new THREE.PointLight(0xaaddff, 10, maxDim*3);
  blastLight.position.copy(cCenter); scene.add(blastLight);
  mdlG._blastLight = blastLight;

  if(COORDINATES[currentSceneIdx]?.sceneReady) storyEl.classList.add('show');

  // —— 注意：碎片爆炸时镜宫保持完整，不启动烧灼层。
  //    只有在用户读完 5 个碎片、resumeCollapseFromDirectory 进入终幕阶段时，
  //    才让 panoBurnSphere 接管把镜宫烧成全黑（变成结语星空底）。
  mdlG._burnStartTime = null;
  mdlG._burnTotal = 11.0;            // 总时长 11s（resume 时启用，更慢更绵长）
  mdlG._collapseLinesShown = 0;     // 已展示的崩坏文案行数
  mdlG._collapseStoryActive = false;

  // 在烧灼开始约 0.4s 后，把 story 卡切换为崩坏版（直接替换内容，容器保持可见）
  const collapseStoryData = COORDINATES[currentSceneIdx]?.collapseStory;
  if(collapseStoryData && storyEl){
    setTimeout(()=>{
      if(mdlG.collapseState !== 'collapsing') return;
      // 直接替换内部 HTML（容器 .show 保留），然后切到崩坏样式
      // 第三参 false：崩坏阶段绝对不输出 card-title / card-subtitle，
      //   只渲染纯叙事 5 行 p（避免"德黑兰·古列斯坦宫"单独裸奔在画面上）
      storyEl.querySelector('.story-card-inner').innerHTML =
        buildStoryHTML(collapseStoryData, COORDINATES[currentSceneIdx], false);
      storyEl.classList.add('collapse-story');
      // 确保容器仍可见（从浏览器视角"内容刷新"，淡入靠 p 自己的 .show 触发）
      if(!storyEl.classList.contains('show')) storyEl.classList.add('show');
      mdlG._collapseStoryActive = true;
      mdlG._collapseStorySwitchTime = performance.now();  // story 切换的时刻，用作文案节拍基准
    }, 400);
  }

  // 动画播完后清理（给足时间）
  // 注意：当目录暂停存在时，这两个 timeout 在 pauseCollapseForDirectory 里被清掉，
  //       由 resumeCollapseFromDirectory 重新基于剩余时间安排。
  const clipDuration = shardModelMeshes.animations[0]?.duration || 5;
  mdlG._collapseTotalSec = (clipDuration + 2);          // 总清理时长（用于 resume 时计算剩余）
  mdlG._burnTotal = 11.0;                                  // 烧灼总时长（同步前面赋值）
  mdlG._nextHintDelaySec = (mdlG._burnTotal + 0.5);       // nextHint 出现的相对时间
  mdlG._collapseTimeout = setTimeout(()=>{
    // 目录暂停期间不结束（resume 后会重新安排）
    if(mdlG._collapsePaused){ mdlG._collapseTimeout = null; return; }
    if(mdlG.collapseState==='collapsing'){
      mdlG.collapseState='done'; crystalCollapseActive=false;
      if(shardGroup.parent){ shardGroup.remove(shardScene); shardGroup.parent.remove(shardGroup); }
      shardMixer = null; shardExtraFall = {};
      shardObjects=[]; shardInstMeshes=[];
      if(dustPoints&&dustPoints.parent) dustPoints.parent.remove(dustPoints);
      if(dustPoints){dustPoints.geometry.dispose();dustPoints.material.dispose();}
      dustPoints=null; dustData=[];
      if(mdlG._blastLight&&mdlG._blastLight.parent) mdlG._blastLight.parent.remove(mdlG._blastLight);
      if(mdlG._shardDirLight&&mdlG._shardDirLight.parent) mdlG._shardDirLight.parent.remove(mdlG._shardDirLight);
      if(mdlG._shardDirLight2&&mdlG._shardDirLight2.parent) mdlG._shardDirLight2.parent.remove(mdlG._shardDirLight2);
      if(mdlG._shardAmbLight&&mdlG._shardAmbLight.parent) mdlG._shardAmbLight.parent.remove(mdlG._shardAmbLight);
      // 注意：碎片清理后 panoDimSphere 不再回弹（烧灼接管暗化），保留 0
      // nextHint 不在这里 add('show')，等烧灼结束（~7.5s）再显示
    }
  }, (clipDuration + 2) * 1000);

  // 烧灼结束后（总时长 + 0.5s 缓冲）显示 nextHint，等待用户点击进下一场景
  mdlG._nextHintTimeout = setTimeout(()=>{
    if(mdlG._collapsePaused){ mdlG._nextHintTimeout = null; return; }
    if(mdlG.collapseState === 'collapsing' || mdlG.collapseState === 'done'){
      nextHint.classList.add('show');
    }
  }, (mdlG._burnTotal + 0.5) * 1000);

  console.log('[golestan] 碎裂！播放原始动画 shardScale:', shardScale.toFixed(3), 'maxDim:', maxDim.toFixed(1));
}

/* 每帧更新：播放碎片原始动画 + 给停在地面的碎片加重力 + 微尘 */
let shardExtraFall = {}; // 碎片额外下落速度 { meshId: velocity }

// 暂停态自转复用对象（避免每帧 new 产生 GC）
const pauseSpinShared = {
  qDelta: new THREE.Quaternion(),
  qPrevInv: new THREE.Quaternion(),
  qStep: new THREE.Quaternion(),
  vAxis: new THREE.Vector3()
};

function updateChandelierCollapse(dt, time){
  const mdlG = MODELS.golestan;
  if(mdlG.collapseState !== 'collapsing') return;
  const dtSec = dt / 60;

  // ========== 目录暂停机制 ==========
  // 当 mdlG._collapsePaused === true 时，整个崩塌的"主观时间"冻结：
  // - shardMixer 不再 update（碎片悬停在空中）
  // - 烧灼层 / story 节拍 / 重力补偿 / 整体淡出 全部不再推进
  // 实现方式：每帧把 collapseStartTime / _burnStartTime / _collapseStorySwitchTime
  // 都"往后推" dt 秒，让所有基于 (now - startTime) 的计算保持原值。
  if(mdlG._collapsePaused){
    const dtMs = dt * 16.67;
    collapseStartTime += dtMs;
    if(mdlG._burnStartTime) mdlG._burnStartTime += dtMs;
    if(mdlG._collapseStorySwitchTime) mdlG._collapseStorySwitchTime += dtMs;
    // 暂停期间唯一要做的事：让大碎片标签跟随屏幕位置 + 呼吸高亮
    if(typeof updateDirectoryFragments === 'function') updateDirectoryFragments(time);

    // ★ 暂停态：每个被驱动的节点维持"爆炸最后一帧"的真实角速度，5 秒内逐渐减速到 0
    // 数据来源：mixer.update 之前每帧已经把节点 quaternion 拍到了 userData._prevQuat
    //           暂停首帧进入此分支时：_prevQuat = 暂停前一帧的姿态，
    //                                 o.quaternion = mixer 最后一次 update 后的姿态
    //           两者差分 → 真实角速度（轴 + omega0 rad/s）
    // 减速曲线：factor = 1 - (t/T)²   ease-out（先快后慢），T=5s 时 factor=0 完全停下
    const spinTargets = mdlG._spinTargets;
    if(spinTargets && spinTargets.length){
      const _qDelta = pauseSpinShared.qDelta;
      const _qPrevInv = pauseSpinShared.qPrevInv;
      const _qStep = pauseSpinShared.qStep;
      const _vAxis = pauseSpinShared.vAxis;
      const SPIN_DECAY_SEC = 5.0; // 减速到完全停下的总时长

      // 暂停态自身的"经过秒数"——首帧初始化为 0，之后每帧 +dtSec
      if(mdlG._pauseSpinElapsed === undefined) mdlG._pauseSpinElapsed = 0;
      const tNorm = Math.min(mdlG._pauseSpinElapsed / SPIN_DECAY_SEC, 1.0);
      const factor = (1 - tNorm) * (1 - tNorm); // ease-out 平方衰减
      mdlG._pauseSpinElapsed += dtSec;

      for(let i = 0; i < spinTargets.length; i++){
        const o = spinTargets[i];
        const ud = o.userData;

        if(!ud._spinAxis){
          // 暂停首帧：从 _prevQuat → 当前 quaternion 反推初始角速度
          if(!ud._prevQuat){
            ud._spinAxis = new THREE.Vector3(
              Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5
            ).normalize();
            ud._spinOmega0 = 0.4;
            continue;
          }
          _qPrevInv.copy(ud._prevQuat).invert();
          _qDelta.copy(o.quaternion).multiply(_qPrevInv);
          const w = Math.max(-1, Math.min(1, _qDelta.w));
          const angle = 2 * Math.acos(w);
          const s = Math.sqrt(1 - w * w);
          const lastDt = ud._prevDt || dtSec;
          if(s > 1e-4 && angle > 1e-4){
            _vAxis.set(_qDelta.x / s, _qDelta.y / s, _qDelta.z / s).normalize();
            const omega = Math.min(angle / lastDt, 6.0);
            ud._spinAxis = _vAxis.clone();
            ud._spinOmega0 = omega; // 保存初始角速度，每帧都按 factor 缩放使用
          } else {
            ud._spinAxis = new THREE.Vector3(
              Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5
            ).normalize();
            ud._spinOmega0 = 0.4;
          }
          continue;
        }

        // 之后每帧：当前角速度 = 初始角速度 × ease-out factor
        if(factor > 0){
          const curOmega = ud._spinOmega0 * factor;
          if(curOmega > 0.001){
            _qStep.setFromAxisAngle(ud._spinAxis, curOmega * dtSec);
            o.quaternion.multiply(_qStep);
          }
        }
      }
    }
    return;
  }

  const elapsed = (performance.now() - collapseStartTime) / 1000;

  // ========== 目录定格检测（带减速过渡） ==========
  // 当 mixer 时间达到 mdlG._collapsePauseT 时，进入"减速窗口"——
  // mixer 速度从 1.0 → 0 在 PAUSE_DECAY_SEC 秒内平滑衰减（先快后慢的 ease-out），
  // 减速期间碎片继续向外飞但越来越慢；速度归 0 后再调 pauseCollapseForDirectory()
  // 进入完全暂停态。这样避免"位移瞬间冻结"的突兀感。
  const PAUSE_DECAY_SEC = 1.5;
  if(!mdlG._collapseDirectoryReady && mdlG._collapsePauseT && shardMixer){
    if(shardMixer.time >= mdlG._collapsePauseT && !mdlG._collapseDecayStartTime){
      // 进入减速窗口
      mdlG._collapseDecayStartTime = performance.now();
      console.log('[shard] 进入减速窗口，', PAUSE_DECAY_SEC, 's 内 mixer 速度从 1→0');
    }
    if(mdlG._collapseDecayStartTime){
      const decayElapsed = (performance.now() - mdlG._collapseDecayStartTime) / 1000;
      const tNorm = Math.min(decayElapsed / PAUSE_DECAY_SEC, 1.0);
      // ease-out 平方衰减：先快后慢，最后温柔停下
      mdlG._collapseDecayFactor = (1 - tNorm) * (1 - tNorm);
      if(tNorm >= 1.0){
        // 减速完成：正式进入暂停态
        mdlG._collapseDecayFactor = 0;
        if(typeof pauseCollapseForDirectory !== 'function'){
          console.error('[app] pauseCollapseForDirectory 未定义，directory.js 可能加载失败');
          mdlG._collapseDirectoryReady = true;
          mdlG._collapsePauseT = null;
          return;
        }
        try { pauseCollapseForDirectory(); }
        catch(e){
          console.error('[app] pauseCollapseForDirectory 抛错:', e && e.message);
          mdlG._collapseDirectoryReady = true;
          mdlG._collapsePauseT = null;
        }
        return;
      }
    }
  }


  // ========== 衔接过渡：吊灯淡出 + 碎片淡入 ==========
  // 0 ~ 0.22s：吊灯保持完整（被点中的"停顿"，留更多实体停留时间）
  // 0.22 ~ 0.52s：吊灯 1→0，碎片 0→1（交叉淡入淡出）
  // 0.52s 后：吊灯彻底隐藏，碎片完全显形
  if(!mdlG._gltfHiddenAfterFade){
    const fadeDelay = 0.22;
    const fadeDuration = 0.30;
    const localT = Math.max(0, elapsed - fadeDelay);
    const t = Math.min(1, localT / fadeDuration);
    const tSmooth = t * t * (3 - 2 * t); // smoothstep
    const fadeOut = 1 - tSmooth;
    // 吊灯淡出
    if(mdlG._fadeOutMats){
      for(let i = 0; i < mdlG._fadeOutMats.length; i++){
        const m = mdlG._fadeOutMats[i];
        const base = (m._collapseOrigOpacity !== undefined) ? m._collapseOrigOpacity : 1.0;
        m.opacity = base * fadeOut;
      }
    }
    // 碎片淡入
    const group = shardInstMeshes[0]?.inst;
    if(group){
      group.traverse(o => {
        if(!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if(m._origOpacityTarget !== undefined){
            m.opacity = m._origOpacityTarget * tSmooth;
          }
        });
      });
    }
    // 过渡完成：把吊灯彻底隐藏（一次性）
    if(elapsed >= fadeDelay + fadeDuration){
      mdlG.gltfScene.visible = false;
      mdlG._gltfHiddenAfterFade = true;
      console.log('[shard] 淡出完成，吊灯已隐藏');
    }
  }
  // ==================================================

  // 驱动碎片动画（在淡出中段附近起播，碎片有"先粘在原位再爆开"的感觉）
  if(shardMixer && elapsed >= 0.34){
    // ★ 每帧 mixer.update 之前，把被 quaternion 驱动的节点的当前姿态拍到 _prevQuat
    //   这样下一帧切到暂停态时，可以立刻反推真实角速度
    const spinTargets = mdlG._spinTargets;
    if(spinTargets && spinTargets.length){
      for(let i = 0; i < spinTargets.length; i++){
        const o = spinTargets[i];
        if(!o.userData._prevQuat) o.userData._prevQuat = o.quaternion.clone();
        else o.userData._prevQuat.copy(o.quaternion);
        o.userData._prevDt = dtSec;
      }
    }
    // 减速窗口期：mixer 步进按 decayFactor 缩放（1.0 → 0），形成位移平滑减速
    const mixerDt = (mdlG._collapseDecayFactor !== undefined)
      ? dtSec * mdlG._collapseDecayFactor
      : dtSec;
    if(mixerDt > 0) shardMixer.update(mixerDt);
  }

  // 每帧确保地面 mesh 始终隐藏（防止动画轨道把 visibility 改回 true）
  const groupRoot = shardInstMeshes[0]?.inst;
  if(groupRoot){
    groupRoot.traverse(o => {
      if(o.isMesh && o._isShardGround) o.visible = false;
    });
  }

  // 与动画同步：检测停在"地面"附近的碎片，给它们加额外重力
  // 在 shardGroup 局部空间中，地面高度大约是模型底部
  const group = shardInstMeshes[0]?.inst;
  if(group && elapsed > 0.5){
    group.traverse(o => {
      if(!o.isMesh || !o.visible) return;
      const worldPos = new THREE.Vector3();
      o.getWorldPosition(worldPos);
      // 如果碎片世界 Y 坐标低于某个阈值（接近"地面"），且速度很低（停住了）
      // 给它额外向下的位移
      const id = o.id;
      if(!shardExtraFall[id]) shardExtraFall[id] = { vy: 0, active: false };
      const ef = shardExtraFall[id];

      // 检测：碎片在低位且不再快速移动（动画让它停在那里）
      // 用 shardGroup 局部空间 y 来判断
      const localY = o.position.y;
      const groundThreshold = -0.3; // 模型局部空间中"地面"附近的 y 值
      if(localY < groundThreshold && !ef.active && elapsed > 1.0){
        ef.active = true;
        ef.vy = 0;
      }
      if(ef.active){
        ef.vy += 0.008; // 加速度
        o.position.y -= ef.vy;
      }
    });
  }

  // 整体淡出（动画后期）
  const clipDuration = shardModelMeshes?.animations?.[0]?.duration || 5;
  if(elapsed > clipDuration * 0.8 && group){
    const fadeT = Math.min(1, (elapsed - clipDuration * 0.8) / 3.0);
    group.traverse(o => {
      if(o.isMesh && o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if(!m._origOpacitySaved){ m._origOpacitySaved = m.opacity; m.transparent = true; }
          m.opacity = m._origOpacitySaved * (1 - fadeT);
        });
      }
    });
  }

  // 爆炸光衰减
  if(mdlG._blastLight){
    if(elapsed < 0.3) mdlG._blastLight.intensity = 10 * (elapsed / 0.3);
    else mdlG._blastLight.intensity = Math.max(0, 10 * Math.exp(-(elapsed - 0.3) * 0.6));
  }

  // 微尘更新（球壳分布：以相机为中心包围观察者，飘出外壳就回卷到对侧球壳）
  if(dustPoints && dustData.length > 0){
    const dPos = dustPoints.geometry.getAttribute('position');
    // —— 终幕烧灼到全黑后这是唯一的"星辰余烬"层，opacity 拉到 0.55 让黑底上清晰可见
    //    渐入 0.6s（同步烧灼起步）→ 保持 0.55（绵长悬浮）
    let dustOpacity;
    if(elapsed < 0.6){
      dustOpacity = elapsed / 0.6 * 0.55;
    } else {
      dustOpacity = 0.55;
    }
    dustPoints.material.opacity = dustOpacity;

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;
    for(let i = 0; i < dustData.length; i++){
      const d = dustData[i];
      if(elapsed < d.delay) continue;
      d.x += d.vx * dtSec; d.y += d.vy * dtSec; d.z += d.vz * dtSec;
      // 关掉每帧 sin/cos 位置抖动 —— 之前抖动让粒子互相穿越，视觉上形成"闪烁"
      // 尘埃就是匀速飘，不要每帧颠

      // —— 回卷：超出外球壳的微尘从对侧（相对相机）以略大于内半径处重新出现 ——
      // 保证视野任何方向都始终有微尘填充，不会"飘走变空"
      const ox = d.x - camX, oy = d.y - camY, oz = d.z - camZ;
      const r2 = ox*ox + oy*oy + oz*oz;
      const rOut2 = d._rOut * d._rOut;
      if(r2 > rOut2){
        // 已飘出外壳：把它放到相对相机的随机方向、内半径附近的新位置
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const sinPhi = Math.sin(phi);
        const nx = sinPhi * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = sinPhi * Math.sin(theta);
        const newR = d._rIn * (1.0 + Math.random() * 0.3); // 内半径 + 0~30% 的随机
        d.x = camX + nx * newR;
        d.y = camY + ny * newR;
        d.z = camZ + nz * newR;
        // 重置随机速度（不重置 twinkle 以避免视觉同步）
        d.vx = (Math.random()-0.5) * 0.5;
        d.vy = (Math.random()-0.5) * 0.3;
        d.vz = (Math.random()-0.5) * 0.5;
      }

      dPos.setXYZ(i, d.x, d.y, d.z);
    }
    dPos.needsUpdate = true;
  }

  // ========== 全景烧灼层推进 + sparkle 淡出 + 崩坏文案逐行展示 ==========
  // 注意：目录态切换全景图时（_panoTransitionActive=true），由 transitionMainPanoTo 自己控制 uProgress/uTime，
  //       这里跳过，避免主循环把 uniform 抢回去
  if(panoBurnSphere.visible && mdlG._burnStartTime && !window._panoTransitionActive){
    const T = mdlG._burnTotal || 7.0;
    const burnElapsed = (performance.now() - mdlG._burnStartTime) / 1000;
    const raw = Math.min(1, burnElapsed / T);
    // 进度曲线：前 2/3 缓慢（看清焦化过程），后 1/3 加速吞没
    const eased = raw < 0.66
      ? raw * (0.56 / 0.66)
      : 0.56 + (raw - 0.66) * (1.0 - 0.56) / 0.34;
    // 映射到 shader 的 0.05 → 1.10（起点已有少量焦斑，终点完全焦黑）
    panoBurnSphere.material.uniforms.uProgress.value = 0.05 + eased * 1.05;
    panoBurnSphere.material.uniforms.uTime.value = time * 0.001;

    // dimSphere 在后半段让位（避免两层透明叠加产生灰雾）
    if(eased > 0.5){
      const t2 = Math.min(1, (eased - 0.5) / 0.5);
      panoDimSphere.material.opacity = 0.15 * (1 - t2);
    }

    // sparkle 在烧灼早期（eased 0.15~0.40）同步淡出（水晶都碎了，反光自然消失）
    if(eased > 0.15 && sparkleGroup.visible){
      const sparkleFade = Math.max(0, 1 - (eased - 0.15) / 0.25);
      // 此处直接覆写 uOpacity；主循环里的平滑 lerp 也会朝 0 收敛，互不冲突
      sparkleMat.uniforms.uOpacity.value = Math.min(sparkleMat.uniforms.uOpacity.value, sparkleFade);
    }

    // 崩坏文案逐行展示：从 story 切换那一刻起，每 1.2s 出现一行（5 行约 6s 内全显）
    if(mdlG._collapseStoryActive && mdlG._collapseStorySwitchTime){
      const storyElapsed = (performance.now() - mdlG._collapseStorySwitchTime) / 1000;
      // 第 i 行（i=0..4）在 storyElapsed = 0.2 + i * 1.2s 时出现
      const targetShown = Math.min(5, Math.max(0, Math.floor((storyElapsed - 0.2) / 1.2) + 1));
      if(targetShown > (mdlG._collapseLinesShown || 0)){
        const ps = storyEl.querySelectorAll('.story-card-inner p');
        for(let i = mdlG._collapseLinesShown; i < targetShown && i < ps.length; i++){
          ps[i].classList.add('show');
        }
        mdlG._collapseLinesShown = targetShown;
      }
    }
  }
}

/* 退出场景 1：清理实体模型 */
function cleanupChandelierScene(){
  const mdlG = MODELS.golestan;

  // 清理碎片（独立 Mesh 方案）
  shardInstMeshes.forEach(({inst, mat}) => {
    if(inst && inst.parent) inst.parent.remove(inst);
    if(inst) inst.traverse(o => { if(o.geometry) o.geometry.dispose(); });
    if(mat) mat.dispose();
  });
  shardInstMeshes = [];
  shardObjects = [];

  // 清理微尘粒子
  if(dustPoints && dustPoints.parent) dustPoints.parent.remove(dustPoints);
  if(dustPoints){ dustPoints.geometry.dispose(); dustPoints.material.dispose(); }
  dustPoints = null; dustData = [];

  // 重置 CSS 特效
  const flashEl = document.getElementById('shatterFlash');
  if(flashEl) flashEl.classList.remove('active');
  const beamEl = document.getElementById('shatterBeam');
  if(beamEl) beamEl.classList.remove('active');

  // 从 scene 中移除 container（但保留 mdlG.frameGroup 引用，下次复用）
  if(mdlG.frameGroup && mdlG.frameGroup.parent){
    scene.remove(mdlG.frameGroup);
  }

  // 恢复所有原始 mesh 可见性和材质
  if(mdlG.gltfScene){
    mdlG.gltfScene.visible = true;
    mdlG.gltfScene.traverse(o => {
      if(!o.isMesh) return;
      o.visible = true;
      o.scale.set(1,1,1);
      o.rotation.set(0,0,0);
    });
  }
  // 恢复淡出阶段记录的材质 opacity/transparent/depthWrite
  if(mdlG._fadeOutMats){
    mdlG._fadeOutMats.forEach(m => {
      if(m._collapseOrigOpacity !== undefined){
        m.opacity = m._collapseOrigOpacity;
        delete m._collapseOrigOpacity;
      }
      if(m._collapseOrigTransparent !== undefined){
        m.transparent = m._collapseOrigTransparent;
        delete m._collapseOrigTransparent;
      }
      if(m._collapseOrigDepthWrite !== undefined){
        m.depthWrite = m._collapseOrigDepthWrite;
        delete m._collapseOrigDepthWrite;
      }
      m.needsUpdate = true;
    });
    mdlG._fadeOutMats = null;
  }
  mdlG._gltfHiddenAfterFade = false;

  if(mdlG.shardMesh) mdlG.shardMesh.visible = false;
  mdlG.collapseState = 'idle';
  if(mdlG.shardData) mdlG.shardData.active = false;
  crystalCollapseActive = false;

  // —— 目录态清理 ——
  if(typeof teardownDirectoryFragments === 'function') teardownDirectoryFragments();
  mdlG._collapsePaused = false;
  mdlG._collapseDirectoryReady = false;
  mdlG._collapsePauseT = null;
  mdlG._directoryDoneCount = 0;
  mdlG._directoryVisitedOrder = [];
  if(mdlG._collapseTimeout) clearTimeout(mdlG._collapseTimeout);
  if(mdlG._nextHintTimeout) clearTimeout(mdlG._nextHintTimeout);
  mdlG._collapseTimeout = null;
  mdlG._nextHintTimeout = null;
  if(mdlG._blastLight && mdlG._blastLight.parent) mdlG._blastLight.parent.remove(mdlG._blastLight);
  if(mdlG._shardDirLight && mdlG._shardDirLight.parent) mdlG._shardDirLight.parent.remove(mdlG._shardDirLight);
  if(mdlG._shardDirLight2 && mdlG._shardDirLight2.parent) mdlG._shardDirLight2.parent.remove(mdlG._shardDirLight2);
  if(mdlG._shardAmbLight && mdlG._shardAmbLight.parent) mdlG._shardAmbLight.parent.remove(mdlG._shardAmbLight);
  shardMixer = null;
  shardExtraFall = {};

  // 全景烧灼层重置
  if(panoBurnSphere){
    panoBurnSphere.visible = false;
    panoBurnSphere.material.uniforms.uProgress.value = -0.2;
    panoBurnSphere.material.uniforms.uTime.value = 0;
  }
  mdlG._burnStartTime = null;
  mdlG._collapseStoryActive = false;
  mdlG._collapseLinesShown = 0;
  mdlG._collapseStorySwitchTime = null;
  // 关闭自动旋转（防御：返回地图后下次再进 golestan 会在 enterScene 重新启用）
  autoRotateActive = false;
  autoRotateYaw = 0;
  autoRotateSpeed = AUTO_ROTATE_SPEED_BASE;
  _autoRotateBoostStart = 0;

  // 还原 story-card 状态（去掉崩坏 modifier，避免污染下次进场）
  if(storyEl){
    storyEl.classList.remove('collapse-story');
  }

  // 恢复粒子系统
  points.visible = true;
  ambient.visible = true;
  particleMaterial.uniforms.uTex.value = spriteTex;
  scene.fog = new THREE.FogExp2(0x05070d, 0.0035);
  console.log('[golestan] 场景清理完成');
}



/* ---------- 初始化 ---------- */
for(let i=0; i<COUNT; i++){
  seeds[i] = Math.random();
  // 初始化粒子到画面外（避免进场景时残留地图粒子）
  positions[i*3] = 0;
  positions[i*3+1] = -9999;
  positions[i*3+2] = 0;
}
buildScatteredPositions();
// 不再 buildMapTargets()——直接进场景 1，地图粒子不需要了

/* ================================================================
 *  状态管理
 * ================================================================ */
const MODE = { MAP:'map', TRANSITION:'transition', SCENE:'scene' };
let mode = MODE.MAP;
let currentSceneIdx = -1;
let unlockedIdx = 0;
const progress = COORDINATES.map(()=>false);

const SCENE_STATE = { IDLE:0, GATHERING:1, HELD:2, RELEASING:3, FORMED:4 };
let sceneState = SCENE_STATE.IDLE;
let pressStart = 0, pressProgress = 0;
const PRESS_REQUIRED = 3000; // 聚合需要 3 秒
let sceneFormed = false; // 琴是否已成形（成形后不再散开）

/* DOM */
const body = document.body;
const coordLabelsEl = document.getElementById('coordLabels');
const mapHintEl = document.getElementById('mapHint');
const backBtn = document.getElementById('backBtn');
const sceneArchiveL = document.getElementById('sceneArchiveL');
const sceneArchiveR = document.getElementById('sceneArchiveR');
const pressHintEl = document.getElementById('pressHint');
const storyEl = document.getElementById('story');
const placeholderEl = document.getElementById('placeholder');
const phTitle = document.getElementById('phTitle');
const phEn = document.getElementById('phEn');
const pressFill = document.getElementById('pressFill');
const nextHint = document.getElementById('nextHint');
const miniSandboxCanvas = document.getElementById('miniSandboxCanvas');
const miniSandboxCtx = miniSandboxCanvas ? miniSandboxCanvas.getContext('2d') : null;
const gyroAsk = document.getElementById('gyroAsk');
const gyroAllowBtn = document.getElementById('gyroAllowBtn');
const gyroDenyBtn = document.getElementById('gyroDenyBtn');
const modelLoadingEl = document.getElementById('modelLoading');

/* ================================================================
 *  坐标标签（跟随 3D 光柱顶部，投影到屏幕）
 * ================================================================ */
function createCoordLabels(){
  coordLabelsEl.innerHTML = '';
  COORDINATES.forEach((c, idx) => {
    const el = document.createElement('div');
    el.className = 'coord-label';
    el.dataset.idx = idx;
    el.innerHTML = `<div class="dot"></div><div class="name">${c.name}</div>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); onCoordClick(idx); });
    coordLabelsEl.appendChild(el);
    c.labelEl = el;
  });
  updateCoordLabelState();
}
function updateCoordLabelState(){
  COORDINATES.forEach((c, idx)=>{
    const el = c.labelEl;
    if(!el) return;
    el.classList.remove('locked','done','active');
    if(progress[idx]) el.classList.add('done');
    else if(idx === unlockedIdx) el.classList.add('active');
    else if(idx > unlockedIdx) el.classList.add('locked');
  });
  if(progress.every(p=>p)){
    mapHintEl.textContent = 'all coordinates reached · sand cannot be gathered';
  } else if(mode === MODE.MAP){
    const nextName = COORDINATES[unlockedIdx].name.toLowerCase();
    mapHintEl.textContent = `探索下一个 · ${nextName}`;
  }
}

const _tmpVec = new THREE.Vector3();
const reticleEl = document.getElementById('reticle');
let aimedIdx = -1;  // 当前准星瞄准的坐标

function updateLabelPositions(){
  if(mode !== MODE.MAP){
    COORDINATES.forEach(c=>{ if(c.labelEl) c.labelEl.style.display='none'; });
    if(reticleEl) reticleEl.classList.remove('aimed');
    aimedIdx = -1;
    return;
  }
  // 屏幕中心
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let bestIdx = -1, bestDist = 80;  // 80px 内才算瞄准

  COORDINATES.forEach((c, idx)=>{
    _tmpVec.set(c.labelAnchor.x, c.labelAnchor.y, c.labelAnchor.z);
    _tmpVec.project(camera);
    const x = (_tmpVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_tmpVec.y * 0.5 + 0.5) * window.innerHeight;
    if(_tmpVec.z < 1 && c.labelEl){
      c.labelEl.style.left = x + 'px';
      c.labelEl.style.top = y + 'px';
      c.labelEl.style.display = 'block';
      // 判断是否被准星瞄准（且可点击：unlockedIdx 或已完成）
      const canClick = (idx === unlockedIdx) || progress[idx];
      if(canClick){
        const d = Math.hypot(x - cx, y - cy);
        if(d < bestDist){
          bestDist = d;
          bestIdx = idx;
        }
      }
    } else if(c.labelEl){
      c.labelEl.style.display = 'none';
    }
  });

  // 更新准星状态
  if(bestIdx !== aimedIdx){
    aimedIdx = bestIdx;
    if(reticleEl){
      if(bestIdx >= 0) reticleEl.classList.add('aimed');
      else reticleEl.classList.remove('aimed');
    }
  }
}

/* ================================================================
 *  切换场景
 * ================================================================ */
function onCoordClick(idx){
  if(mode !== MODE.MAP) return;
  if(idx > unlockedIdx && !progress[idx]) return;
  enterScene(idx);
}

let enteringScene = false; // 标记正在进入场景（过渡期间粒子应朝地面散落）

/* 根据屏幕宽高比计算"能看见整把琴"的相机距离
 * 琴的高度约 95 单位，宽度约 50 单位
 * 用 fov 反算：z = h/2 / tan(fov/2)，加 1.5x 安全系数
 */
function computeSceneCamera(){
  const aspect = window.innerWidth / window.innerHeight;
  const fovRad = camera.fov * Math.PI / 180;

  let objH = 100, objW = 40;
  let yCenter = 50;
  const coord = COORDINATES[currentSceneIdx];
  const mdl = coord && coord.modelId ? MODELS[coord.modelId] : null;
  if(mdl && mdl.sampledPoints && mdl.sampledPoints.bbox){
    const b = mdl.sampledPoints.bbox;
    const s = new THREE.Vector3();
    b.getSize(s);
    objH = s.y;
    objW = Math.max(s.x, s.z);
    yCenter = mdl.yOffset;
  } else if(kamanchehSampledPoints){
    const b = kamanchehSampledPoints.bbox;
    const s = new THREE.Vector3();
    b.getSize(s);
    objH = s.y;
    objW = Math.max(s.x, s.z);
  }

  const safetyMul = 1.35;
  const distH = (objH * 0.5) / Math.tan(fovRad / 2);
  const distW = (objW * 0.5) / Math.tan(fovRad / 2) / Math.max(aspect, 0.01);
  const z = Math.max(distH, distW) * safetyMul;
  const finalZ = Math.max(120, Math.min(400, z));
  return { y: yCenter, z: finalZ, lookY: yCenter };
}

function enterScene(idx){
  mode = MODE.TRANSITION;
  enteringScene = true;
  currentSceneIdx = idx;
  const coord = COORDINATES[idx];
  sceneFormed = false;
  gyroYawOffset = null;
  gyroPitchOffset = null;
  // 重置陀螺仪累积状态：清掉静默期标记 + 累积 yaw 归零（新场景从前方开始）
  if(typeof window.__resetGyroCalibration === 'function'){
    window.__resetGyroCalibration();
  }
  arBlend = 0;
  camYaw = 0;
  smoothYaw = PANO_YAW_OFFSET;
  smoothPitch = 0;
  dragPitch = 0; // 重置拖拽累计 pitch

  // === 判断是否走新管线（场景 1 golestan 实体模型） ===
  const isGolestan = (coord.modelId === 'golestan');
  const golestanReady = isGolestan && MODELS.golestan.gltfScene;

  // 防御：进入新场景前，清理上一场景的"实体"残留（吊灯不应跨场景共存）
  if(!isGolestan && MODELS.golestan && MODELS.golestan.frameGroup && MODELS.golestan.frameGroup.parent){
    cleanupChandelierScene();
  }

  // 新管线统一标记：进入新管线场景（隐藏粒子系统、启用 sceneGroup）
  const newPipelineReady = golestanReady;

  if(golestanReady){
    // 场景 1：吊灯实体
    const ok = enterChandelierScene();
    if(!ok){
      if(coord.modelId && coord.sceneReady) buildSceneTargets(coord.modelId);
      else buildPlaceholderTargets();
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aColor').needsUpdate = true;
    }
  } else {
    // 旧管线（其他粒子场景）
    if(coord.modelId && coord.sceneReady) buildSceneTargets(coord.modelId);
    else buildPlaceholderTargets();
    geometry.getAttribute('aSize').needsUpdate = true;
    geometry.getAttribute('aColor').needsUpdate = true;
  }

  // 显示加载状态
  if(modelLoadingEl){
    const mdl = coord.modelId ? MODELS[coord.modelId] : null;
    if(mdl && !mdl.sampledPoints && !mdl.loadFailed && !newPipelineReady){
      modelLoadingEl.classList.add('show');
    } else {
      modelLoadingEl.classList.remove('show');
    }
  }

  // 非新管线场景：生成地面散落位置
  if(!newPipelineReady){
    buildSceneGroundPositions();
    for(let i=0; i<COUNT; i++){
      positions[i*3]   = scatteredPos[i*3];
      positions[i*3+1] = scatteredPos[i*3+1];
      positions[i*3+2] = scatteredPos[i*3+2];
      velocities[i*3] = velocities[i*3+1] = velocities[i*3+2] = 0;
    }
    posAttr.needsUpdate = true;
  }

  sceneArchiveL.innerHTML = `FIELD · <b>${coord.name}</b><br>${coord.subtitle}<br>DAY <b>${String(coord.day).padStart(3,'0')}</b> / 100`;
  sceneArchiveR.innerHTML = `<em>${coord.subtitleRight}</em><br>${coord.subtitleRight2}<br>coord · ${coord.lat.toFixed(2)}°N`;

  body.classList.remove('map-mode');
  body.classList.add('scene-mode');
  nextHint.classList.remove('show');
  storyEl.classList.remove('show');
  storyEl.classList.remove('collapse-story');  // 防御：确保进场不残留崩坏样式
  // 防御：烧灼层 / dimSphere 状态归零（万一上次没清干净）
  if(panoBurnSphere){
    panoBurnSphere.visible = false;
    panoBurnSphere.material.uniforms.uProgress.value = -0.2;
    // 烧灼方向：从穹顶向下
    panoBurnSphere.material.uniforms.uBurnDir.value.set(0, 1, 0);
  }

  // 全景图 skybox
  const sceneIdForPano = coord.modelId || coord.id;
  currentPanoId = sceneIdForPano;
  if(coord.panoUrl) loadPanoForScene(sceneIdForPano, coord.panoUrl);
  const panoTex = panoTextures[sceneIdForPano];
  if(coord.panoUrl && panoTex && panoTex !== 'loading'){
    scene.background = panoTex;
    _currentDisplayTex = panoTex;
    panoDimSphere.visible = true;
    // 新管线场景降低暗化（让全景更亮）
    panoDimSphere.material.opacity = newPipelineReady ? 0.18 : 0.55;
    const sceneBgEl = document.querySelector('.scene-bg');
    if(sceneBgEl) sceneBgEl.style.display = 'none';
    renderer.setClearColor(0x000000, 1);
  } else {
    // 无 panoUrl 的场景：纯黑背景
    scene.background = null;
    _currentDisplayTex = null;
    panoDimSphere.visible = !coord.modelId;
    panoDimSphere.material.opacity = newPipelineReady ? 0.18 : 0.55;
    renderer.setClearColor(0x000000, 1);
  }
  // 启用反光光点（仅 golestan 场景）
  sparkleGroup.visible = (sceneIdForPano === 'golestan');
  // 镜宫全景球壳的"贴在球面上的固定闪光点"由 sparkleGroup 提供，
  // ambient（空间漂浮粒子）在镜宫里默认隐藏，避免干扰碎片亮点。
  // 但终幕"宇宙尘埃"模式下 directory.js 会显式 _ambTargetOpacity=1 → 不要在此覆盖
  if(sceneIdForPano === 'golestan'){
    const ambExplicit = (typeof window._ambTargetOpacity === 'number' && window._ambTargetOpacity > 0.01);
    if(!ambExplicit){
      ambient.visible = false;
      window._ambTargetOpacity = 0.0;
    }
    // 玫瑰宫只显示 200 颗 BASE 十字星芒，屏蔽 5000 颗 DENSE 小圆点
    // （DENSE 是镜中圣陵专用，玫瑰宫开它会满屏白点）
    if(sparkleMat.uniforms.uBaseOnly) sparkleMat.uniforms.uBaseOnly.value = 1;
    if(sparkleMat.uniforms.uDenseOnly) sparkleMat.uniforms.uDenseOnly.value = 0;
  }
  // 根据屏幕宽高比动态调整 FOV
  if(newPipelineReady){
    const aspect = window.innerWidth / window.innerHeight;
    const baseFov = 65;
    const fov = Math.round(baseFov / Math.max(aspect, 0.4));
    camera.fov = THREE.MathUtils.clamp(fov, 45, 100);
  } else {
    camera.fov = 100;
  }
  camera.updateProjectionMatrix();

  // 相机
  if(golestanReady){
    // 吊灯在世界原点(0,0,0)；相机在水平圆轨道上、稍低于吊灯仰视
    const orbitRadius = 100;
    const orbitY = -35;
    camera.position.set(0, orbitY, orbitRadius);
    cameraTarget.set(0, 0, 0);
    camera.lookAt(cameraTarget);
  } else {
    const sceneCamSetup = computeSceneCamera();
    const targetX = -Math.sin(PANO_YAW_OFFSET) * sceneCamSetup.z;
    const targetZ = -Math.cos(PANO_YAW_OFFSET) * sceneCamSetup.z;
    camera.position.set(targetX, sceneCamSetup.y, targetZ);
    cameraTarget.set(0, sceneCamSetup.lookY, 0);
    camera.lookAt(cameraTarget);
  }

  mode = MODE.SCENE;
  enteringScene = false;
  sceneState = SCENE_STATE.IDLE;

  if(coord.sceneReady){
    storyEl.querySelector('.story-card-inner').innerHTML = buildStoryHTML(coord.story, coord);
    placeholderEl.classList.remove('show');
    if(newPipelineReady){
      // 新管线（吊灯/地毯）：进场立即显示介绍文案
      storyEl.classList.add('show');
      autoRotateActive = true;
      autoRotateYaw = 0;
      autoRotateSpeed = AUTO_ROTATE_SPEED_BASE;
      _autoRotateBoostStart = 0;
      // press-hint 在故事卡场景统一不展示（"吊灯被击碎"高亮自带引导）
      pressHintEl.innerHTML = '';
    } else {
      setTimeout(()=>{
        if(mode===MODE.SCENE && sceneState===SCENE_STATE.IDLE) pressHintEl.classList.add('show');
      }, 1200);
    }
  } else {
    phTitle.textContent = coord.zh;
    phEn.textContent = `${coord.name.toLowerCase()} · coming soon`;
    placeholderEl.classList.add('show');
    pressHintEl.classList.remove('show');
    setTimeout(()=>{ if(mode===MODE.SCENE) nextHint.classList.add('show'); }, 2800);
  }
}

/* 为场景生成地面散落位置（扁平、贴地的沙粒分布） */
function buildSceneGroundPositions(){
  for(let i=0; i<COUNT; i++){
    // 大范围散布在地面，避免高密度堆积导致"亮光斑"
    // X: -200 ~ +200（覆盖整个画面宽度），Z: -120 ~ +80（覆盖远近）
    // Y: 紧贴地面，但加更大的高度抖动让堆有起伏感
    scatteredPos[i*3]   = (Math.random()-0.5) * 400;
    // 让粒子在地面以下也有一些（"埋"在沙里），形成堆叠层次
    scatteredPos[i*3+1] = -50 - Math.pow(Math.random(), 2) * 8 + (Math.random()-0.5) * 3;
    scatteredPos[i*3+2] = (Math.random()-0.5) * 200 - 30;
  }
}

function buildStoryHTML(s, coord, includeHeader){
  // includeHeader: 是否输出 card-title("德黑兰·古列斯坦宫") + card-subtitle(经纬度)
  //   默认 true（idle 进场展示完整三件套）
  //   collapse 阶段必须传 false —— 否则击碎过程中 card-title 会以"单独一行"的形式
  //   裸奔在画面顶部（用户明确禁止此现象，避免再次在任何场合出现）
  if(typeof includeHeader === 'undefined') includeHeader = true;
  let html = '';
  if(includeHeader){
    html += `<div class="card-title">${coord.zh}</div>`;
    html += `<div class="card-subtitle">${s.coord}</div>`;
  }
  s.lines.forEach(l => { html += `<p class="${l.quiet?'quiet':''}">${l.text}</p>`; });
  return html;
}

/* 场景 nextHint（continue →）点击：
 * 跳过"回地图再点 TAP TO ARRIVE"的环节，直接进入下一个已解锁场景。
 * 如果当前已经是最后一个场景 / 下一个还没解锁 / 不在场景模式，则回退为 returnToMap。 */
function chainToNextScene(){
  if(mode !== MODE.SCENE) return;
  // 推进解锁进度（和 returnToMap 同一套逻辑）
  if(currentSceneIdx >= 0 && !progress[currentSceneIdx]){
    progress[currentSceneIdx] = true;
    if(unlockedIdx === currentSceneIdx && unlockedIdx < COORDINATES.length - 1){
      unlockedIdx++;
    }
  }
  // 下一个场景：currentSceneIdx + 1（必须存在且已解锁）
  const nextIdx = currentSceneIdx + 1;
  if(nextIdx >= COORDINATES.length || nextIdx > unlockedIdx){
    // 没有下一个 / 未解锁 → 走回地图流程（兜底）
    returnToMap();
    return;
  }

  // 清理当前场景的"实体"残留
  const wasGolestan = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
  if(wasGolestan) cleanupChandelierScene();

  // 隐藏当前 UI 残留
  nextHint.classList.remove('show');
  storyEl.classList.remove('show');
  storyEl.classList.remove('collapse-story');
  placeholderEl.classList.remove('show');
  pressHintEl.classList.remove('show');

  // 直接进入下一个场景（沿用 enterScene 的完整入口）
  // 注意：enterScene 内部已处理 mode/body class/sceneState/相机 等所有状态
  enterScene(nextIdx);
  console.log('[chain] 链式进场 →', COORDINATES[nextIdx]?.name);
}

function returnToMap(){
  if(mode !== MODE.SCENE) return;
  if(currentSceneIdx >= 0 && !progress[currentSceneIdx]){
    progress[currentSceneIdx] = true;
    if(unlockedIdx === currentSceneIdx && unlockedIdx < COORDINATES.length - 1){
      unlockedIdx++;
    }
  }

  // 清理场景 1 新管线（如果活跃）
  const wasGolestan = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
  if(wasGolestan) cleanupChandelierScene();


  mode = MODE.TRANSITION;
  sceneState = SCENE_STATE.IDLE;
  sceneFormed = false;
  enteringScene = false;
  pressHintEl.classList.remove('show');
  pressHintEl.innerHTML = 'press &amp; hold <span class="dot"></span><span class="dot"></span><span class="dot"></span>'; // 恢复默认提示
  storyEl.classList.remove('show');
  placeholderEl.classList.remove('show');
  nextHint.classList.remove('show');
  if(modelLoadingEl) modelLoadingEl.classList.remove('show');

  buildMapTargets();
  geometry.getAttribute('aSize').needsUpdate = true;
  geometry.getAttribute('aColor').needsUpdate = true;

  // 平滑重置粒子速度，避免突然跳动
  for(let i=0; i<COUNT; i++){
    velocities[i*3] *= 0.3;
    velocities[i*3+1] *= 0.3;
    velocities[i*3+2] *= 0.3;
  }

  body.classList.remove('scene-mode');
  body.classList.add('map-mode');

  // 退出场景：移除全景图 skybox，恢复 FOV
  scene.background = null;
  _currentDisplayTex = null;
  currentPanoId = null;
  panoDimSphere.visible = false;  // 隐藏暗化蒙层
  // 隐藏反光光点
  sparkleGroup.visible = false;
  sparkleMat.uniforms.uOpacity.value = 0;
  for(const spr of flareSprites) spr.material.opacity = 0;
  renderer.setClearColor(0x000000, 0);
  camera.fov = 60;
  camera.updateProjectionMatrix();
  const sceneBgEl = document.querySelector('.scene-bg');
  if(sceneBgEl) sceneBgEl.style.display = '';

  // 重置探索位置，飞回初始相机
  exploreOffset.x = 0; exploreOffset.y = 0; exploreOffset.z = 0;
  camYaw = 0;

  tweenCamera(
    { x:camera.position.x, y:camera.position.y, z:camera.position.z,
      tx:cameraTarget.x, ty:cameraTarget.y, tz:cameraTarget.z },
    { x:MAP_CAM_DEFAULT.x, y:MAP_CAM_DEFAULT.y, z:MAP_CAM_DEFAULT.z,
      tx:0, ty:0, tz:0 },
    1200, easeInOutCubic,
    () => {
      mode = MODE.MAP;
      updateCoordLabelState();
    }
  );
}

/* ================================================================
 *  相机 Tween（支持 position + lookAt target）
 * ================================================================ */
let tween = null;
const cameraTarget = new THREE.Vector3(0, 0, 0);
function tweenCamera(from, to, duration, ease, onDone){
  tween = { from, to, duration, ease, start: performance.now(), onDone };
}
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function updateTween(now){
  if(!tween) return;
  const p = Math.min(1, (now - tween.start) / tween.duration);
  const e = tween.ease(p);
  camera.position.x = tween.from.x + (tween.to.x - tween.from.x) * e;
  camera.position.y = tween.from.y + (tween.to.y - tween.from.y) * e;
  camera.position.z = tween.from.z + (tween.to.z - tween.from.z) * e;
  cameraTarget.x = tween.from.tx + (tween.to.tx - tween.from.tx) * e;
  cameraTarget.y = tween.from.ty + (tween.to.ty - tween.from.ty) * e;
  cameraTarget.z = tween.from.tz + (tween.to.tz - tween.from.tz) * e;
  camera.lookAt(cameraTarget);
  if(p >= 1){
    const done = tween.onDone;
    tween = null;
    if(done) done();
  }
}

/* ================================================================
 *  相机控制：地图模式（仅左右转 + 前后左右移动）+ 场景模式
 * ================================================================ */
let camYaw = 0;
const FIXED_PITCH = -0.32;  // 固定俯角（约 18°），不允许用户改
const exploreOffset = { x:0, y:0, z:0 };

// 拖拽
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragStartYaw = 0;
let dragStartPitch = 0;
let dragPitch = 0; // 累计拖拽 pitch（不被陀螺仪覆盖）
let pointerActive = false;
let pressPointerStartX = 0, pressPointerStartY = 0;

// 进入场景后的"自动慢速旋转"：让用户一进来就感知空间可旋转，用户首次操作即停止
let autoRotateActive = false;
let autoRotateYaw = 0;            // 累计的自动旋转角度（弧度），叠加到 camYaw 上
const AUTO_ROTATE_SPEED_BASE = 0.06;  // 进场默认速度（弧度/秒，约 3.4°/秒）
let autoRotateSpeed = AUTO_ROTATE_SPEED_BASE;
// 用户最后一次主动操作（拖拽/陀螺仪转动）的时间戳，用于"3 秒静止恢复自动旋转"
let _lastUserInteractTime = 0;
const AUTO_ROTATE_RESUME_AFTER = 3000;  // 3 秒
// 碎裂加速过冲：起爆瞬间从 base 飙到 peak，1.2s 内回落到 settle
let _autoRotateBoostStart = 0;     // 0 表示无 boost；>0 表示 boost 起始 performance.now()
const AUTO_ROTATE_BOOST_PEAK   = 0.6;  // 峰值（弧度/秒，约 34°/秒，3 倍冲击感）
const AUTO_ROTATE_BOOST_SETTLE = 0.18; // 稳态（弧度/秒，约 10°/秒，3 倍 base）
const AUTO_ROTATE_BOOST_DUR    = 1200; // 过冲持续时间（ms）


// 平滑旋转：camYaw 是目标值（拖拽/陀螺仪即时更新），smoothYaw 做插值跟随
let smoothYaw = 0;
let smoothPitch = 0;

// 全景图初始 yaw 偏移（弧度）：调整到图中作坊光束位置
// equirectangular 中心 = yaw 0（相机从 -Z 看向 +Z = 全景图中心）
const PANO_YAW_OFFSET = 0;

// 陀螺仪
let useGyro = false;
let gyroYaw = 0;
let gyroPitch = 0;    // beta 轴：手机前后倾斜
let gyroYawOffset = null;
let gyroPitchOffset = null;

// AR 锚定混合权重：0=轨道模式，1=AR 锚定模式
let arBlend = 0;
const AR_ANGLE_LIMIT = Math.PI / 4; // ±45° 软拉回阈值

// 软性拉回：tanh 平滑收敛，超过 limit 后渐进停止
function softClampAngle(angle, limit){
  return limit * Math.tanh(angle / limit);
}

/* ---------- 场景内交互 ---------- */
function sceneStartPress(){
  if(!COORDINATES[currentSceneIdx]?.sceneReady) return;
  // 只有空闲状态（粒子已经散落地面）才能重新开始长按
  if(sceneState !== SCENE_STATE.IDLE) return;

  // 关键：开始聚合前，如果模型已就绪但当前 targets 还是占位版，重建
  const _coord = COORDINATES[currentSceneIdx];
  const _mdl = _coord && _coord.modelId ? MODELS[_coord.modelId] : null;
  if(_mdl && _mdl.sampledPoints && !window.__targetsFromModel){
    console.log('[scene] sceneStartPress 触发 targets 升级到真模型:', _coord.modelId);
    buildSceneTargets(_coord.modelId);
    geometry.getAttribute('aSize').needsUpdate = true;
    geometry.getAttribute('aColor').needsUpdate = true;
  }

  // —— 关键：每次重新长按前，把粒子归位到固定散落位置 ——
  // 否则上一轮 RELEASING 风场把粒子吹得到处都是，下一次聚合起点不一致
  // 会让琴的轮廓越来越模糊（粒子从远处飘过来时容易卡在半路）
  for(let i=0; i<COUNT; i++){
    const i3 = i*3;
    positions[i3]   = scatteredPos[i3];
    positions[i3+1] = scatteredPos[i3+1];
    positions[i3+2] = scatteredPos[i3+2];
    velocities[i3]   = 0;
    velocities[i3+1] = 0;
    velocities[i3+2] = 0;
    releaseLife[i] = 0; // 清掉上一轮残留的崩解倒计时
  }
  geometry.attributes.position.needsUpdate = true;

  sceneState = SCENE_STATE.GATHERING;
  sceneFormed = false;
  pressStart = performance.now();
  pressHintEl.classList.remove('show');
  nextHint.classList.remove('show');
  // 开始聚合时就显示文字弹窗（渐入）
  if(COORDINATES[currentSceneIdx].sceneReady){
    storyEl.classList.add('show');
  }
}
function sceneEndPress(){
  // 任何状态下松手都触发"重力散落"
  if(sceneState === SCENE_STATE.GATHERING ||
     sceneState === SCENE_STATE.HELD ||
     sceneState === SCENE_STATE.FORMED ||
     sceneFormed){
    sceneState = SCENE_STATE.RELEASING;
    sceneFormed = false;  // 解除成形锁定
    storyEl.classList.remove('show');
    nextHint.classList.remove('show');
    pressProgress = 0; // 进度条清零

    // —— 流沙崩解：给每颗粒子一个"开始下落"的延迟时间 ——
    // 高位粒子先开始（琴头先碎、琴箱后塌），同高度有随机相位让分层不规则
    // releaseLife[i] 当倒计时（>0 = 还没开始下落）
    let minY = Infinity, maxY = -Infinity;
    for(let i=0; i<COUNT; i++){
      const y = positions[i*3+1];
      if(y < minY) minY = y;
      if(y > maxY) maxY = y;
    }
    const spanY = Math.max(1, maxY - minY);
    for(let i=0; i<COUNT; i++){
      const yRel = (positions[i*3+1] - minY) / spanY;  // 0=底部、1=顶部
      // 顶部立即崩（延迟=0），底部延迟 0.6s，同高度随机 0~0.15s
      const heightDelay = (1 - yRel) * 0.6;            // 0.0~0.6
      const randomPhase = Math.random() * 0.15;
      releaseLife[i] = heightDelay + randomPhase;       // 单位：秒
    }
    releaseStartTime = performance.now();

    // 5.5 秒后回到散落静止态（给流沙更长时间完整下落）
    setTimeout(()=>{
      if(sceneState === SCENE_STATE.RELEASING){
        sceneState = SCENE_STATE.IDLE;
        if(mode === MODE.SCENE){
          pressHintEl.classList.add('show');
        }
      }
    }, 5500);
  }
}
let releaseStartTime = 0;

/* ---------- 指针事件（地图 & 场景都用拖拽转视角） ---------- */
canvas.addEventListener('pointerdown', (e)=>{
  if(tween) return;
  try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
  e.preventDefault();
  dragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragStartYaw = camYaw;
  dragStartPitch = dragPitch;

  if(mode === MODE.SCENE){
    // 新管线（吊灯）：不需要长按聚合粒子
    const isGolestanNew = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
    if(!isGolestanNew){
      pointerActive = true;
      pressPointerStartX = e.clientX; pressPointerStartY = e.clientY;
      sceneStartPress();
    }
  }
});
window.addEventListener('pointermove', (e)=>{
  if(!dragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  // 用户产生真实拖拽位移即关闭自动旋转（单击 tap 不会触发，因为 tap 几乎无位移）
  if(autoRotateActive && (Math.abs(dx) > 4 || Math.abs(dy) > 4)){
    autoRotateActive = false;
  }
  // 记录用户操作时间戳（拖拽中持续刷新），3 秒静止后会自动恢复旋转
  if(Math.abs(dx) > 2 || Math.abs(dy) > 2){
    _lastUserInteractTime = performance.now();
    // 用户开始主动探索 → 停止吊灯召唤呼吸（说明用户已经在意识到场景）
    if(typeof _stopChandelierIdlePulse === 'function') _stopChandelierIdlePulse();
    // 用户首次拖动 → 隐藏「轻触吊灯」提示
    if(typeof pressHintEl !== 'undefined' && pressHintEl){
      pressHintEl.classList.remove('show');
    }
  }

  if(mode === MODE.SCENE && sceneState === SCENE_STATE.GATHERING){
    const moved = Math.hypot(e.clientX - pressPointerStartX, e.clientY - pressPointerStartY);
    if(moved > 30){
      sceneState = SCENE_STATE.IDLE;
      pressProgress = 0;
      pressFill.style.transform = 'translateX(-100%)';
    }
  }

  // 水平旋转 + 垂直俯仰
  const yawSens = (mode === MODE.SCENE) ? 0.012 : 0.004;
  // 子全景模式下也允许垂直拖拽，灵敏度和水平相当
  const pitchSens = (mode === MODE.SCENE) ? 0.008 : 0.004;
  camYaw = dragStartYaw + dx * yawSens;
  // 垂直方向：累加到 dragPitch，避免被陀螺仪逻辑覆盖
  // 子全景允许 ±60°（看天花板/地面），主场景保持 ±0.5
  const pitchDelta = -dy * pitchSens; // 向上拖 = 向上看
  if(mode === MODE.SCENE){
    dragPitch = Math.max(-0.5, Math.min(0.5, dragStartPitch + pitchDelta));
  } else {
    // 子全景模式
    const PANO_PITCH_LIMIT = Math.PI / 180 * 60;
    dragPitch = Math.max(-PANO_PITCH_LIMIT, Math.min(PANO_PITCH_LIMIT, dragStartPitch + pitchDelta));
  }
});
window.addEventListener('pointerup', (e)=>{
  const wasDragging = dragging;
  const totalMove = wasDragging ? Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) : 0;
  dragging = false;

  // 场景 1 新管线：点击吊灯本身才触发崩塌（Raycaster 检测）
  const isGolestanNew = (mode === MODE.SCENE) &&
    COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
  if(isGolestanNew && totalMove < 12){
    const mdlG = MODELS.golestan;
    if(mdlG.collapseState === 'idle'){
      // Raycaster 检测是否点击到了吊灯
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      // 收集所有吊灯 mesh 做检测
      const allChandelierMeshes = [];
      mdlG.frameGroup.traverse(o => { if(o.isMesh) allChandelierMeshes.push(o); });
      const hits = raycaster.intersectObjects(allChandelierMeshes, false);
      if(hits.length > 0){
        pressHintEl.classList.remove('show');
        triggerChandelierCollapse();
      }
    }
  }

  if(pointerActive){
    pointerActive = false;
    if(sceneState === SCENE_STATE.GATHERING || sceneState === SCENE_STATE.HELD || sceneState === SCENE_STATE.FORMED){
      sceneEndPress();
    }
  }
  // 地图模式：若是"点击"（无显著拖动）且准星瞄准了坐标 → 进入
  if(mode === MODE.MAP && totalMove < 8 && aimedIdx >= 0){
    onCoordClick(aimedIdx);
  }
});
window.addEventListener('pointercancel', ()=>{
  dragging = false;
  if(pointerActive){ pointerActive = false; sceneEndPress(); }
});
window.addEventListener('blur', ()=>{
  dragging = false;
  if(pointerActive){ pointerActive = false; sceneEndPress(); }
});
canvas.addEventListener('dragstart', e=>e.preventDefault());
canvas.addEventListener('contextmenu', e=>e.preventDefault());

/* ---------- 前后推进 ---------- */
// 桌面滚轮：地图模式下控制前后推进
window.addEventListener('wheel', (e)=>{
  if(mode !== MODE.MAP || tween) return;
  e.preventDefault();
  const speed = 0.3;
  // 沿当前视线方向前进
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  exploreOffset.x += dir.x * e.deltaY * speed * 0.1;
  exploreOffset.z += dir.z * e.deltaY * speed * 0.1;
  // 限制范围
  exploreOffset.x = Math.max(-120, Math.min(120, exploreOffset.x));
  exploreOffset.z = Math.max(-100, Math.min(150, exploreOffset.z));
}, { passive:false });

// 键盘 WASD
const keys = {};
window.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  // 调试：按 1/2/3 绕 X/Y/Z 轴旋转 90°
  const _dbgCoord = COORDINATES[currentSceneIdx];
  const _dbgMdl = _dbgCoord && _dbgCoord.modelId ? MODELS[_dbgCoord.modelId] : null;
  if(_dbgMdl && _dbgMdl.sampledPoints && (e.code==='Digit1' || e.code==='Digit2' || e.code==='Digit3')){
    const pts = _dbgMdl.sampledPoints.points;
    const nrm = _dbgMdl.sampledPoints.normals;
    const N = pts.length / 3;
    for(let i=0; i<N; i++){
      let x=pts[i*3], y=pts[i*3+1], z=pts[i*3+2];
      let nx=nrm[i*3], ny=nrm[i*3+1], nz=nrm[i*3+2];
      if(e.code==='Digit1'){
        pts[i*3+1] = -z; pts[i*3+2] = y;
        nrm[i*3+1] = -nz; nrm[i*3+2] = ny;
      } else if(e.code==='Digit2'){
        pts[i*3] = z; pts[i*3+2] = -x;
        nrm[i*3] = nz; nrm[i*3+2] = -nx;
      } else if(e.code==='Digit3'){
        pts[i*3] = -y; pts[i*3+1] = x;
        nrm[i*3] = -ny; nrm[i*3+1] = nx;
      }
    }
    console.log('[debug] 已旋转 90°（轴='+e.code+'），重新 build');
    if(mode === MODE.SCENE && _dbgCoord.modelId){
      buildSceneTargets(_dbgCoord.modelId);
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aColor').needsUpdate = true;
    }
  }
});
window.addEventListener('keyup', (e)=>{ keys[e.code] = false; });

// 移动端：双指捏合前后推进（简化为单指向上/向下滑动同时触发时）
// 保留简单方案：移动端提供屏幕下方"前进/后退"按钮（可选）
// 这里暂时在移动端使用"前倾/后仰"的陀螺仪 beta 角加速前进

backBtn.addEventListener('click', returnToMap);
// 场景 nextHint（continue →）：直接链式进入下一个已解锁场景，跳过"回地图再点 TAP TO ARRIVE"
nextHint.addEventListener('click', chainToNextScene);

/* ================================================================
 *  陀螺仪
 * ================================================================ */
function setupGyro(){
  if(!('DeviceOrientationEvent' in window)){
    console.warn('[gyro] DeviceOrientationEvent 不存在，跳过陀螺仪');
    return;
  }
  const needPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
  // 详细环境探测，方便定位"有 DeviceOrientationEvent 但收不到事件"的真凶
  const ua = navigator.userAgent;
  const inWeChat   = /MicroMessenger/i.test(ua);
  const inQQ       = /\bQQ\//i.test(ua) && !inWeChat;
  const inWeibo    = /Weibo/i.test(ua);
  const isStandaloneSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|MicroMessenger|QQ\/|Weibo|UCBrowser/i.test(ua);
  console.log('[gyro] setup:',
    'needPermission=', needPermission,
    'isMobile=', isMobile,
    'inWeChat=', inWeChat,
    'inQQ=', inQQ,
    'inWeibo=', inWeibo,
    'isStandaloneSafari=', isStandaloneSafari,
    'isSecure=', window.isSecureContext,
    'protocol=', location.protocol);
  console.log('[gyro] UA:', ua);

  // —— 监听器：优先 deviceorientationabsolute（Android Chrome 上 alpha 是绝对方位，更稳）
  //         备用 deviceorientation（iOS、老 Android）
  let _firstEventLogged = false;
  function attachListeners(label){
    let absoluteFired = false;
    const onAbs = (e)=>{
      absoluteFired = true;
      if(!_firstEventLogged){
        _firstEventLogged = true;
        console.log('[gyro] FIRST EVENT (absolute):',
          'alpha=', e.alpha, 'beta=', e.beta, 'gamma=', e.gamma);
      }
      onDeviceOrientation(e);
    };
    const onRel = (e)=>{
      if(absoluteFired) return;
      if(!_firstEventLogged){
        _firstEventLogged = true;
        console.log('[gyro] FIRST EVENT (relative):',
          'alpha=', e.alpha, 'beta=', e.beta, 'gamma=', e.gamma);
      }
      onDeviceOrientation(e);
    };
    window.addEventListener('deviceorientationabsolute', onAbs);
    window.addEventListener('deviceorientation', onRel);
    useGyro = true;
    console.log('[gyro] listeners attached via', label, ', useGyro=true');
    setTimeout(()=>{
      console.log('[gyro] 5s check:',
        'firstEvent=', _firstEventLogged,
        'gyroYaw=', gyroYaw.toFixed(3),
        'gyroYawOffset=', gyroYawOffset,
        'useGyro=', useGyro);
      if(!_firstEventLogged){
        console.error('[gyro] ❌ 5 秒内没有收到任何 deviceorientation 事件 ——',
          '通常是 ① iOS 未授权 ② WebView 屏蔽 sensor ③ 桌面/无传感器设备');
      }
    }, 5000);
  }

  // 通用授权请求函数（有些 WebView 即使 needPermission=false 也能调用）
  function tryAskPermissionThenAttach(){
    if(typeof DeviceOrientationEvent.requestPermission === 'function'){
      try{
        DeviceOrientationEvent.requestPermission().then(state => {
          console.log('[gyro] iOS permission state =', state);
          if(state === 'granted'){
            window.__gyroPermissionGranted = true;
            attachListeners('iOS-granted');
          } else {
            console.warn('[gyro] iOS permission not granted:', state);
          }
        }).catch(err => {
          console.warn('[gyro] iOS requestPermission rejected:', err && err.message,
            '— 可能此时不在用户手势栈里，将在下次手势重试');
          // ❌ 不再无脑 fallback 挂监听：iOS 没授权就是收不到事件，挂了也白挂
          // 重新挂手势钩子，等下次真用户点击再试
          const retryGesture = () => {
            tryAskPermissionThenAttach();
            window.removeEventListener('touchstart', retryGesture);
            window.removeEventListener('click', retryGesture);
          };
          window.addEventListener('touchstart', retryGesture, { once: true, passive: true });
          window.addEventListener('click', retryGesture, { once: true });
        });
      }catch(e){
        console.warn('[gyro] iOS requestPermission threw:', e && e.message);
      }
    } else {
      attachListeners('no-permission-API');
    }
  }

  if(needPermission){
    // iOS Safari：授权请求由 dismissSplash 负责（在用户点击 splash 进入按钮的手势栈里调用）
    // 这里只暴露 attachListeners 给那边，让它在权限通过后回调挂事件
    window.__gyroAttachListeners = attachListeners;
    // 兜底：如果 dismissSplash 那条路径异常没跑（比如绕过了 splash），
    // 在这里也挂一次手势钩子，再尝试请求权限
    const tryRequest = () => {
      // 如果 dismissSplash 已经请求过且被 granted，attachListeners 已被调用，跳过
      if(window.__gyroPermissionGranted){
        window.removeEventListener('touchstart', tryRequest);
        window.removeEventListener('click', tryRequest);
        return;
      }
      tryAskPermissionThenAttach();
      window.removeEventListener('touchstart', tryRequest);
      window.removeEventListener('click', tryRequest);
    };
    window.addEventListener('touchstart', tryRequest, { once: true, passive: true });
    window.addEventListener('click', tryRequest, { once: true });
    if(typeof gyroAsk !== 'undefined' && gyroAsk) gyroAsk.style.display = 'none';
  } else {
    // 没有 requestPermission API 的环境（Android、桌面、某些 WebView）
    // 先直接绑，同时也挂一个用户手势钩子尝试再次激活（针对 iOS WebView 异常情况）
    attachListeners('direct-no-permission');
    // 兜底：万一这个 WebView 之后才注入 requestPermission，第一次手势再试一次
    const retryOnGesture = () => {
      if(typeof DeviceOrientationEvent.requestPermission === 'function' && !_firstEventLogged){
        console.log('[gyro] requestPermission 在用户手势后变得可用，重试');
        tryAskPermissionThenAttach();
      }
      window.removeEventListener('touchstart', retryOnGesture);
      window.removeEventListener('click', retryOnGesture);
    };
    window.addEventListener('touchstart', retryOnGesture, { once: true, passive: true });
    window.addEventListener('click', retryOnGesture, { once: true });
  }
}
/* ================================================================
 *  陀螺仪：增量累积模式（支持 360° 全景旋转）+ 单帧角速度钳制（防猛转）
 *  - Yaw：累积每一帧 delta_alpha，画面可无限转一圈到背后
 *  - Yaw 灵敏度 1.0×（1:1 跟随，足够灵敏但不眩晕，靠钳制兜底）
 *  - 单帧最大角速度 8°（一帧 16ms 转超过 8° 就钳制 → 永不猛转）
 *  - Pitch：绝对偏移模式（保留 ±25° 限位，防天旋地转）
 *  - 进场 200ms 静默期（让 alpha 序列稳下来才开始累积，治进场跳变）
 *  - alpha 跨 0/360 边界自动取最短路径
 * ================================================================ */
const GYRO_YAW_SENSITIVITY    = 1.0;                // yaw 1:1 增量
const GYRO_PITCH_SENSITIVITY  = 1.0;                // pitch 1:1（让全景上下都能看到）
const GYRO_PITCH_LIMIT        = Math.PI / 180 * 50; // pitch ±50°（够看天花板/地面）
const GYRO_MAX_DELTA_PER_FRAME= Math.PI / 180 * 8;  // 单帧最多转 8° → 钳制猛转
const GYRO_DEADZONE           = Math.PI / 180 * 0.3;// 0.3° 死区，治静止抖动
const GYRO_SETTLE_MS          = 200;                // 进场静默期：丢弃前 200ms 事件

// 累积状态
let _gyroLastAlpha    = null;   // 上一帧 alpha（度），用于算 delta
let _gyroSettleStart  = 0;      // 静默期起点
let _gyroSettled      = false;  // 静默期是否结束

function onDeviceOrientation(e){
  // alpha 可能为 null（某些 Android 浏览器或 iframe 嵌入场景）
  let alphaSource = e.alpha;
  if(alphaSource === null || alphaSource === undefined){
    if(e.gamma === null || e.gamma === undefined) return;
    alphaSource = e.gamma * 2;
  }
  const a = alphaSource;
  const b = e.beta || 0;

  // —— 进场静默期：前 200ms 丢弃所有事件，只记录最后一个 alpha 作为基准 ——
  if(!_gyroSettled){
    if(_gyroSettleStart === 0) _gyroSettleStart = performance.now();
    _gyroLastAlpha = a;          // 持续刷新，最后一次的值就是基准
    if(performance.now() - _gyroSettleStart >= GYRO_SETTLE_MS){
      _gyroSettled = true;
      gyroPitchOffset = b;       // pitch 用 settle 结束时的 beta 作零点
      console.log('[gyro] settle 完成, alpha 基准=', a.toFixed(2),
                  ' pitch 基准=', b.toFixed(2));
    }
    return;  // 静默期画面完全不动
  }

  // —— Yaw：增量累积 + 跨边界最短路径 + 单帧角速度钳制 ——
  let dAlphaDeg = a - _gyroLastAlpha;
  // 跨 0/360 边界取最短路径（359 → 1 应当是 +2 而不是 -358）
  if(dAlphaDeg > 180)  dAlphaDeg -= 360;
  if(dAlphaDeg < -180) dAlphaDeg += 360;
  _gyroLastAlpha = a;

  let dYaw = dAlphaDeg * Math.PI / 180 * GYRO_YAW_SENSITIVITY;
  // 死区：极微小抖动直接吃掉
  if(Math.abs(dYaw) < GYRO_DEADZONE) dYaw = 0;
  // ★ 关键：单帧角速度钳制，无论原因（事件队列堆积/jolt/异常跳变）都治
  if(dYaw >  GYRO_MAX_DELTA_PER_FRAME) dYaw =  GYRO_MAX_DELTA_PER_FRAME;
  if(dYaw < -GYRO_MAX_DELTA_PER_FRAME) dYaw = -GYRO_MAX_DELTA_PER_FRAME;

  // 累加到 gyroYaw（手机转向左 → 画面也向左转，所以是 -dYaw）
  const newGyroYaw = gyroYaw - dYaw;

  // 检测显著变化 → 视为用户主动操作
  if(Math.abs(dYaw) > 0.005){
    if(autoRotateActive) autoRotateActive = false;
    _lastUserInteractTime = performance.now();
  }
  gyroYaw = newGyroYaw;

  // —— Pitch（beta）：绝对偏移 + 限位 + 死区（pitch 不需要累积，物理上本来就有限位）——
  let pitchRaw = (b - gyroPitchOffset) * Math.PI / 180 * GYRO_PITCH_SENSITIVITY;
  if(Math.abs(pitchRaw) < GYRO_DEADZONE) pitchRaw = 0;
  pitchRaw = Math.max(-GYRO_PITCH_LIMIT, Math.min(GYRO_PITCH_LIMIT, pitchRaw));
  // 经实测：lookY = sin(smoothPitch)*100，pitch 正→看上方
  // 用户仰头看天花板 → 期望 lookY 正 → pitchRaw 直接传入（不取负）
  gyroPitch = pitchRaw;
}

// 校准状态重置：每次 enterScene 都要清掉，否则跨场景会带着旧状态进场
window.__resetGyroCalibration = function(){
  _gyroLastAlpha   = null;
  _gyroSettleStart = 0;
  _gyroSettled     = false;
  gyroYaw          = 0;     // 画面 yaw 归零（新场景从前方开始）
  gyroPitch        = 0;
  gyroPitchOffset  = null;
};
setupGyro();

createCoordLabels();

/* ================================================================
 *  自动进入场景 1（跳过地图引导页）
 * ================================================================ */
function autoEnterGolestan(){
  // 如果 GLB 已就绪，直接进
  if(MODELS.golestan.gltfScene){
    enterScene(0);
    return;
  }
  // 否则轮询等待（模型可能还在加载中）
  console.log('[auto] 等待吊灯模型加载...');
  const poll = setInterval(()=>{
    if(MODELS.golestan.gltfScene){
      clearInterval(poll);
      enterScene(0);
    } else if(MODELS.golestan.loadFailed){
      clearInterval(poll);
      console.warn('[auto] 吊灯模型加载失败，降级进入');
      enterScene(0);
    }
  }, 200);
}

// 如果没有开屏页（或已被移除），直接自动进入
if(!splashEl){
  document.body.classList.add('scene-mode');
  const _sbg = document.querySelector('.scene-bg');
  if(_sbg) _sbg.style.display = 'none';
  autoEnterGolestan();
}

/* ================================================================
 *  主循环
 * ================================================================ */
let t0 = performance.now();
const posAttr = geometry.getAttribute('position');

function tick(){
  // 性能优化：tab 不可见时彻底暂停渲染（节省 CPU/GPU/电池）
  // 浏览器虽然会自动把后台 tab 的 RAF 降到 1Hz，但仍然会跑——
  // 我们直接 return 阻断整个帧，等 visibilitychange 重新拉起。
  if(document.hidden){
    // 不再 requestAnimationFrame 自我递归，由 visibilitychange 监听器恢复
    return;
  }
  const now = performance.now();
  const dt = Math.min((now - t0)/16.67, 2.5);
  t0 = now;
  const time = now * 0.001;

  particleMaterial.uniforms.uTime.value = time;
  ambMat.uniforms.uTime.value = time;

  /* —— ambient 尘埃整体透明度平滑插值（由 directory.js 设置 _ambTargetOpacity 控制）——
   * 进入 pink 场景：_ambTargetOpacity = 1 → 0.045/帧 平滑拉到 1（约 1.5s 内浮现，与火焰过渡同步）
   * 离开 pink / 玫瑰宫：_ambTargetOpacity = 0 → 平滑淡出，淡到 < 0.01 后隐藏 ambient.visible = false 省 draw call
   * 终幕：_ambTargetOpacity = 1 → 与火焰一起浮起宇宙星尘 */
  {
    const target = (typeof window._ambTargetOpacity === 'number') ? window._ambTargetOpacity : (ambient.visible ? 1.0 : 0.0);
    const cur = ambMat.uniforms.uOpacityScale.value;
    if(Math.abs(target - cur) > 0.001){
      ambMat.uniforms.uOpacityScale.value = cur + (target - cur) * 0.045;
    } else {
      ambMat.uniforms.uOpacityScale.value = target;
    }
    // 完全淡出：彻底隐藏（省 draw call）；起步淡入：先 visible=true 再让 opacity 拉上去
    if(target > 0.01 && !ambient.visible) ambient.visible = true;
    if(ambMat.uniforms.uOpacityScale.value < 0.005 && target < 0.01 && ambient.visible) ambient.visible = false;
  }

  /* —— 调试 HUD（仅 window._dustHudEnabled === true 时显式启用）—— */
  if(typeof window !== 'undefined' && window._dustHudEnabled === true){
    let hud = document.getElementById('_dustHud');
    if(!hud){
      hud = document.createElement('div');
      hud.id = '_dustHud';
      hud.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;font:11px/1.4 monospace;color:#fff;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:4px;pointer-events:none;white-space:pre;';
      document.body.appendChild(hud);
    }
    hud.textContent =
      'ambient.visible = ' + ambient.visible +
      '\nuOpacityScale = ' + ambMat.uniforms.uOpacityScale.value.toFixed(3) +
      '\nuSunMode = ' + ambMat.uniforms.uSunMode.value.toFixed(2) +
      '\nuCosmosMode = ' + ambMat.uniforms.uCosmosMode.value.toFixed(2) +
      '\n_ambTargetOpacity = ' + (typeof window._ambTargetOpacity === 'number' ? window._ambTargetOpacity.toFixed(2) : 'undef') +
      '\nparticle count = ' + (ambient.geometry && ambient.geometry.attributes.position ? ambient.geometry.attributes.position.count : '?') +
      '\nblending = Additive';
  }

  // 全景反光光点更新
  if(sparkleGroup.visible){
    sparkleMat.uniforms.uTime.value = time;

    // 相机角速度（基于 smoothYaw + smoothPitch 帧间变化）
    if(!sparkleInited){
      sparkleLastYaw = smoothYaw;
      sparkleLastPitch = smoothPitch;
      sparkleInited = true;
    }
    const dYaw   = Math.abs(smoothYaw   - sparkleLastYaw);
    const dPitch = Math.abs(smoothPitch - sparkleLastPitch);
    sparkleLastYaw = smoothYaw;
    sparkleLastPitch = smoothPitch;
    // 灵敏度更高：×120（之前 ×40），轻微拖拽就能触发
    const rawSpeed = (dYaw + dPitch) * 120;
    const target = Math.min(rawSpeed, 1.6);
    // 上升快、下降慢
    if(target > sparkleMotion){
      sparkleMotion += (target - sparkleMotion) * 0.4;
    } else {
      sparkleMotion += (target - sparkleMotion) * 0.04;
    }
    // 静止时给一点 idle baseline（0.08），让用户偶尔能瞥到光点
    // —— 自动旋转期间帧间 dYaw 太小（0.001 rad/帧），需要给一个固定加成才有明显闪烁
    let motionLevel = Math.max(sparkleMotion, 0.08);
    if(autoRotateActive){
      motionLevel = Math.max(motionLevel, 0.55);  // 自动旋转时拉到 0.55，闪烁明显
    }

    const targetOp = (mode === MODE.SCENE) ? 1.0 : 0;
    sparkleMat.uniforms.uOpacity.value += (targetOp - sparkleMat.uniforms.uOpacity.value) * 0.06;
    sparkleMat.uniforms.uMotion.value = motionLevel;

    // B 层大颗星芒：opacity 主要由运动驱动 + 视角朝向
    //   运动越快越闪、闪光时尺寸放大幅度收敛（避免拖动时一堆十字大花，显假）
    const camDir = new THREE.Vector3();
    for(const spr of flareSprites){
      camDir.copy(spr.position).sub(camera.position).normalize();
      const facing = THREE.MathUtils.clamp(camDir.dot(spr.userData.dir) * 0.5 + 0.5, 0, 1);
      const sharp = Math.pow(facing, 2.0);
      const twinkle = 0.55 + 0.45 * Math.sin(time * 1.4 + spr.userData.seed * 6.28);
      const fast = Math.sin(time * 4.2 + spr.userData.fastSeed * 12.57);
      const flash = Math.pow(Math.max(fast, 0), 6) * motionLevel;
      spr.material.opacity = sharp * (twinkle * 0.6 + flash * 0.8) * motionLevel * targetOp;
      // 闪光时尺寸放大幅度从 ×1.45 收敛到 ×1.18，避免运动瞬间"爆开"成大十字花
      const s = spr.userData.baseScale * (0.92 + sharp * 0.10 + flash * 0.16);
      spr.scale.setScalar(s);
    }
  }

  updateTween(now);

  // 吊灯 idle 呼吸（引导用户点击）
  updateChandelierIdlePulse(now);

  // 方向光混合
  const targetLightMix = (mode === MODE.SCENE || mode === MODE.TRANSITION) ? 1 : 0.4;
  particleMaterial.uniforms.uLightMix.value += (targetLightMix - particleMaterial.uniforms.uLightMix.value) * 0.04;
  ambMat.uniforms.uLightMix.value += (targetLightMix - ambMat.uniforms.uLightMix.value) * 0.04;

  // —— 沙雕模式切换：成形态 + 散落到地面态 都启用 Lambert + Normal Blending ——
  // 飘动/聚合/进入过渡：保持 Additive Blending（云雾发光感）
  // 已成形 / 已散落到地面（IDLE） / 正在散落（RELEASING） → 实体感
  const wantSculpt = (mode === MODE.SCENE) &&
                     (sceneState === SCENE_STATE.HELD ||
                      sceneState === SCENE_STATE.FORMED ||
                      sceneState === SCENE_STATE.IDLE ||
                      sceneState === SCENE_STATE.RELEASING);
  const targetSculpt = wantSculpt ? 1.0 : 0.0;
  particleMaterial.uniforms.uSculpt.value += (targetSculpt - particleMaterial.uniforms.uSculpt.value) * 0.06;

  // —— 地面沙堆模式：未成形（IDLE/RELEASING）时启用，让粒子用"朝上+噪声法线"暗哑下来 ——
  const wantGround = (mode === MODE.SCENE) &&
                     (sceneState === SCENE_STATE.IDLE ||
                      sceneState === SCENE_STATE.RELEASING);
  const targetGround = wantGround ? 1.0 : 0.0;
  particleMaterial.uniforms.uGroundMode.value += (targetGround - particleMaterial.uniforms.uGroundMode.value) * 0.08;

  // 当 uSculpt 越过 0.5，切换混合模式（避免每帧切，加滞回）
  const sculptVal = particleMaterial.uniforms.uSculpt.value;
  const wantBlend = sculptVal > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
  if(particleMaterial.blending !== wantBlend){
    particleMaterial.blending = wantBlend;
    particleMaterial.depthWrite = (wantBlend === THREE.NormalBlending);
    particleMaterial.needsUpdate = true;
  }

  /* ---------- 相机控制 ---------- */
  if(!tween){
    if(mode === MODE.MAP){
      // 键盘前后左右
      if(keys['KeyW'] || keys['ArrowUp']){
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        exploreOffset.x += dir.x * 0.8; exploreOffset.z += dir.z * 0.8;
      }
      if(keys['KeyS'] || keys['ArrowDown']){
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        exploreOffset.x -= dir.x * 0.8; exploreOffset.z -= dir.z * 0.8;
      }
      if(keys['KeyA'] || keys['ArrowLeft']){
        exploreOffset.x += Math.cos(camYaw - Math.PI/2) * 0.8;
        exploreOffset.z += Math.sin(camYaw - Math.PI/2) * 0.8;
      }
      if(keys['KeyD'] || keys['ArrowRight']){
        exploreOffset.x += Math.cos(camYaw + Math.PI/2) * 0.8;
        exploreOffset.z += Math.sin(camYaw + Math.PI/2) * 0.8;
      }
      // 范围限制
      exploreOffset.x = Math.max(-120, Math.min(120, exploreOffset.x));
      exploreOffset.z = Math.max(-100, Math.min(150, exploreOffset.z));

      // 地图模式不使用陀螺仪 AR 效果，只用拖拽
      const yaw = camYaw;
      const pitch = FIXED_PITCH;

      // 相机位置 = 基准位 + 探索偏移
      camera.position.x = MAP_CAM_DEFAULT.x + exploreOffset.x;
      camera.position.y = MAP_CAM_DEFAULT.y + exploreOffset.y;
      camera.position.z = MAP_CAM_DEFAULT.z + exploreOffset.z;

      // 朝向：yaw 左右（pitch 固定略向下看）
      const fwd = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      );
      const lookTarget = new THREE.Vector3(
        camera.position.x + fwd.x * 100,
        camera.position.y + fwd.y * 100,
        camera.position.z + fwd.z * 100
      );
      camera.lookAt(lookTarget);

    } else if(mode === MODE.SCENE){
      // —— 静止 3 秒后自动恢复旋转（仅 SCENE 模式 + 不在拖拽中 + 不在终幕烧灼中）——
      if(!autoRotateActive && !dragging && _lastUserInteractTime > 0
         && !document.body.classList.contains('finale-on')){
        const idleMs = performance.now() - _lastUserInteractTime;
        if(idleMs > AUTO_ROTATE_RESUME_AFTER){
          autoRotateActive = true;
          autoRotateSpeed = AUTO_ROTATE_SPEED_BASE;
          _autoRotateBoostStart = 0;  // 不走 boost 曲线，直接平稳速度恢复
          _lastUserInteractTime = 0;  // 防重复触发
        }
      }
      // 自动慢速旋转：进场时启用，用户首次拖拽时关闭
      if(autoRotateActive && !dragging){
        // 检查是否处于碎裂 boost 期间
        if(_autoRotateBoostStart > 0){
          const elapsed = performance.now() - _autoRotateBoostStart;
          if(elapsed < AUTO_ROTATE_BOOST_DUR){
            // ease-out：从 PEAK 衰减到 SETTLE（指数缓动，前期冲击强、后期平滑）
            const t = elapsed / AUTO_ROTATE_BOOST_DUR;
            const ease = 1 - Math.pow(1 - t, 2);
            autoRotateSpeed = AUTO_ROTATE_BOOST_PEAK + (AUTO_ROTATE_BOOST_SETTLE - AUTO_ROTATE_BOOST_PEAK) * ease;
          } else {
            autoRotateSpeed = AUTO_ROTATE_BOOST_SETTLE;
          }
        }
        autoRotateYaw += autoRotateSpeed * dt / 60;
      }
      // 目标 yaw/pitch：陀螺仪 + 拖动叠加（手机上也能手指左右滑动切换视角） + 自动旋转
      const targetYaw   = (useGyro ? gyroYaw + camYaw : camYaw) + PANO_YAW_OFFSET + autoRotateYaw;
      // pitch：陀螺仪角度 + 拖拽累计角度都生效（让用户即使开着陀螺仪也能用手指补充上下视角）
      const targetPitch = (useGyro ? gyroPitch : 0) + dragPitch;

      const lerpSpeed = 0.08;
      smoothYaw   += (targetYaw   - smoothYaw)   * lerpSpeed;
      smoothPitch += (targetPitch - smoothPitch) * lerpSpeed;

      // 判断是否是吊灯新管线场景
      const isGolestanCam = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
      // 子场景全景图模式：进入子场景的瞬间立即切到"球心平视"（B 公式），
      // 同时由 directory.js 用 _dirCamTween 把 dragPitch/camYaw/autoRotateYaw 朝 0 收敛，
      // 让用户在 3.0s 火焰过渡内丝滑收敛到新场景的"正前方·平视"。
      // —— 不再引入 A 公式（吊灯仰视），避免点击瞬间画面"猛地转到仰视吊灯"。
      const _dirIdx = (typeof _dirCurrentSceneIdx !== 'undefined') ? _dirCurrentSceneIdx : -1;
      const _isDirPanoMode = (_dirIdx >= 0);
      /* —— 子场景→玫瑰宫"相机模式过渡 lerp"：window._dirHomeCamLerp 是 directory.js
       *    在 closeDirectoryOverlay 时启动的状态对象 { startTime, durMs }。
       *    在过渡期内，把"球心模式"和"玫瑰宫圆轨道模式"按 ease-in-out cubic 插值，
       *    让相机位置/朝向与火焰过渡同步演变，避免"火焰结束才瞬切相机"的视觉跳变。 */
      let _dirHomeLerpK = -1; // -1 表示无插值
      if(window._dirHomeCamLerp && typeof window._dirHomeCamLerp.startTime === 'number'){
        const _lerp = window._dirHomeCamLerp;
        const _kRaw = (now - _lerp.startTime) / _lerp.durMs;
        if(_kRaw >= 0 && _kRaw <= 1){
          _dirHomeLerpK = _kRaw < 0.5 ? 4*_kRaw*_kRaw*_kRaw : 1 - Math.pow(-2*_kRaw + 2, 3) / 2;
        } else if(_kRaw > 1){
          /* —— 修复 2026-05-30：不主动清 lerp，避免与 directory.js onComplete 错位 ——
           * 旧版：k>1 立即 _dirHomeCamLerp=null → 那一帧若 _dirCurrentSceneIdx 还 >= 0
           *       会瞬间走子场景全景分支（camera.set(0,0,0)），造成画面闪一下
           * 新版：k>1 时把 K 锁到 1（保持 lerp 终点 transform），由 directory.js
           *       的 crossfade onComplete 同步清 _dirHomeCamLerp + _dirCurrentSceneIdx，
           *       两者在同一帧切换 → 无错位、无闪烁 */
          _dirHomeLerpK = 1;
        }
      }

      if(isGolestanCam && _dirHomeLerpK >= 0){
        /* 过渡 lerp 进行中：从"相机当前真实视角"渐变到"玫瑰宫圆轨道视角"。
         * 起点（k=0）：position = lerp 启动时的 camera.position 快照
         *              lookAt   = lerp 启动时的 camera 看向的点（沿视线 100 单位的点）
         * 终点（k=1）：position = (-sin(yaw)·100, -35, -cos(yaw)·100)
         *              lookAt   = (0, 0, 0)
         * 线性插值 position 和 lookAt 两个端点 → 走最短路径，不绕路、不仰视顶部。 */
        const k = _dirHomeLerpK;
        const orbitR = 100;
        const orbitY = -35;
        const _lerpSt = window._dirHomeCamLerp || {};
        // 起点：直接用启动时快照的相机位置 + 看向点
        const fromPx = (typeof _lerpSt.startPosX === 'number') ? _lerpSt.startPosX : 0;
        const fromPy = (typeof _lerpSt.startPosY === 'number') ? _lerpSt.startPosY : 0;
        const fromPz = (typeof _lerpSt.startPosZ === 'number') ? _lerpSt.startPosZ : 0;
        const fromLx = (typeof _lerpSt.startLookX === 'number') ? _lerpSt.startLookX : -Math.sin(smoothYaw) * 100;
        const fromLy = (typeof _lerpSt.startLookY === 'number') ? _lerpSt.startLookY : 0;
        const fromLz = (typeof _lerpSt.startLookZ === 'number') ? _lerpSt.startLookZ : -Math.cos(smoothYaw) * 100;
        // 终点：玫瑰宫圆轨道（与下面 isGolestanCam && !_isDirPanoMode 分支保持完全一致）
        const _yaw = smoothYaw;
        const toPx = -Math.sin(_yaw) * orbitR;
        const toPy = orbitY;
        const toPz = -Math.cos(_yaw) * orbitR;
        const toLx = 0, toLy = 0, toLz = 0;
        camera.position.x = fromPx + (toPx - fromPx) * k;
        camera.position.y = fromPy + (toPy - fromPy) * k;
        camera.position.z = fromPz + (toPz - fromPz) * k;
        camera.lookAt(
          fromLx + (toLx - fromLx) * k,
          fromLy + (toLy - fromLy) * k,
          fromLz + (toLz - fromLz) * k
        );
      } else if(isGolestanCam && !_isDirPanoMode){
        // 吊灯在原点，相机在水平圆轨道上微仰视
        const orbitR = 100;
        const orbitY = -35;
        camera.position.x = -Math.sin(smoothYaw) * orbitR;
        camera.position.y = orbitY + smoothPitch * 15;
        camera.position.z = -Math.cos(smoothYaw) * orbitR;
        camera.lookAt(0, 0, 0);
      } else if(_isDirPanoMode){
        // 子场景全景图：相机在球心，朝着 yaw+pitch 方向看 —— 真正的 360° 全景
        // pitch 影响 lookAt 目标点的 Y（仰角），不再硬编码为 0
        const lookDist = 100;
        const lookY = Math.sin(smoothPitch) * lookDist;
        const horiz = Math.cos(smoothPitch) * lookDist;
        camera.position.set(0, 0, 0);
        camera.lookAt(
          -Math.sin(smoothYaw) * horiz,
          lookY,
          -Math.cos(smoothYaw) * horiz
        );
      } else {
        // 主场景（玫瑰宫等实体模型轨道）：保持原逻辑
        const sc = computeSceneCamera();
        const orbitR = sc.z;
        camera.position.x = -Math.sin(smoothYaw) * orbitR;
        camera.position.y = sc.y + smoothPitch * 30;
        camera.position.z = -Math.cos(smoothYaw) * orbitR;
        camera.lookAt(0, sc.lookY, 0);
      }
    }
  }

  // —— 状态推进（按压进度条） ——
  if(mode === MODE.SCENE && sceneState === SCENE_STATE.GATHERING){
    pressProgress = Math.min(1, (now - pressStart) / PRESS_REQUIRED);
    pressFill.style.transform = `translateX(${-100 + pressProgress*100}%)`;
    if(pressProgress >= 1){
      sceneState = SCENE_STATE.HELD;
      sceneFormed = true;
      // 文字弹窗在聚合过程中已显示（sceneStartPress 时添加了 show）
      // 此刻确保显示完整
      if(COORDINATES[currentSceneIdx].sceneReady) storyEl.classList.add('show');
      nextHint.classList.add('show');
    }
  } else if(mode === MODE.SCENE && sceneState === SCENE_STATE.RELEASING){
    // 松手但未成形：进度条回退
    pressProgress = Math.max(0, pressProgress - 0.015);
    pressFill.style.transform = `translateX(${-100 + pressProgress*100}%)`;
  } else if(mode === MODE.SCENE && (sceneState === SCENE_STATE.HELD || sceneState === SCENE_STATE.FORMED)){
    // 已成形，进度条满
    pressFill.style.transform = `translateX(0%)`;
  } else {
    pressProgress = Math.max(0, pressProgress - 0.02);
    pressFill.style.transform = `translateX(${-100 + pressProgress*100}%)`;
  }

  // —— 粒子力 ——
  let gathering, gatherForce, scatterForce, damping;
  if(enteringScene){
    // 正在进入场景过渡：粒子在地面做轻微呼吸运动（自由散沙感），不施加聚合力
    gathering = false;
    gatherForce = 0;
    scatterForce = 0;
    damping = 0.92; // 温和阻尼（非死停）
  } else if(mode === MODE.MAP || mode === MODE.TRANSITION){
    gathering = true;
    gatherForce = 0.018;
    scatterForce = 0;
    damping = 0.9;
  } else if(mode === MODE.SCENE){
    const holding = sceneState===SCENE_STATE.GATHERING || sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED;
    const isIdle = sceneState===SCENE_STATE.IDLE;
    const isReleasing = sceneState===SCENE_STATE.RELEASING;

    if(holding){
      // 聚合中或已成形 → 粒子向目标聚集（流沙力学：前期极弱让粒子飘，后期渐强定型）
      gathering = true;
      gatherForce = sceneFormed ? 0.050 : (0.0015 + Math.pow(pressProgress, 2.2) * 0.055);
      scatterForce = 0;
      damping = sceneFormed ? 0.86 : 0.92;
    } else if(isIdle){
      // 静止在地面，不施加力
      gathering = false;
      gatherForce = 0;
      scatterForce = 0;
      damping = 0.95;
    } else {
      // RELEASING
      gathering = false;
      gatherForce = 0;
      scatterForce = 0;
      damping = crystalCollapseActive ? 0.996 : 0.985; // 水晶碎片极高阻尼（飘得很慢）
    }
  }

  // 亮度：成形态拉高（让暗面也能看到结构）、聚合中渐亮、地面散落态压暗
  const isOnGround = mode===MODE.SCENE && (sceneState===SCENE_STATE.IDLE || sceneState===SCENE_STATE.RELEASING);
  const targetBrightness = (mode === MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED)) ? 1.65 :
                           isOnGround ? 0.55 :
                           (gathering ? 0.70 + pressProgress*0.30 : 0.65);
  particleMaterial.uniforms.uBrightness.value += (targetBrightness - particleMaterial.uniforms.uBrightness.value) * 0.08;

  // 粒子大小：成形态紧凑、地面散落态最小（细沙感）、其他略大
  // 粒子大小：成形态加大让相邻粒子重叠（实体感）、地面散落态最小、其他略大
  const targetSize = (mode===MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED)) ? 0.65 :
                     isOnGround ? 0.20 :
                     (mode===MODE.MAP ? 0.55 : 0.55);
  particleMaterial.uniforms.uSizeMul.value += (targetSize - particleMaterial.uniforms.uSizeMul.value) * 0.06;

  // 抖动控制：成形态时极弱（显细节），其他时候保持流沙飘动
  const targetWobble = (mode===MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED)) ? 0.05 : 1.0;
  particleMaterial.uniforms.uWobble.value += (targetWobble - particleMaterial.uniforms.uWobble.value) * 0.05;

  // —— 粒子积分 ——
  // 性能优化：主粒子系统（COUNT=15万颗）不可见时整个跳过——
  // 之前每帧空转 15 万次循环（CPU 满负荷），即使 GPU 不渲染。
  // 玫瑰宫场景全程 points.visible = false，可以省 15 万次/帧。
  if(!points.visible){
    // 跳过粒子积分。posAttr.needsUpdate 也不需要置 true（顶点不更新）
  } else {
  for(let i=0; i<COUNT; i++){
    const i3 = i*3;
    // —— 流沙崩解：等待中的粒子仅微微颤动，不参与后续积分 ——
    if(mode===MODE.SCENE && sceneState===SCENE_STATE.RELEASING && releaseLife[i] > 0){
      releaseLife[i] -= dt / 60;  // dt 是 60fps 倍数，转秒数
      const tremor = 0.04;
      velocities[i3]   += (Math.random()-0.5) * tremor;
      velocities[i3+1] += (Math.random()-0.5) * tremor * 0.3;
      velocities[i3+2] += (Math.random()-0.5) * tremor;
      velocities[i3]   *= 0.85;
      velocities[i3+1] *= 0.85;
      velocities[i3+2] *= 0.85;
      positions[i3]   += velocities[i3] * dt;
      positions[i3+1] += velocities[i3+1] * dt;
      positions[i3+2] += velocities[i3+2] * dt;
      continue;
    }

    // 进入场景过渡中：粒子做轻微呼吸运动（地面散沙微动）
    if(enteringScene){
      const breathe = Math.sin(time * 0.4 + seeds[i] * 12) * 0.015;
      velocities[i3]   += (Math.random()-0.5) * 0.008;
      velocities[i3+1] += breathe * 0.08;
      velocities[i3+2] += (Math.random()-0.5) * 0.008;
      velocities[i3]   *= 0.90;
      velocities[i3+1] *= 0.90;
      velocities[i3+2] *= 0.90;
      positions[i3]   += velocities[i3] * dt;
      positions[i3+1] += velocities[i3+1] * dt;
      positions[i3+2] += velocities[i3+2] * dt;
      continue;
    }

    // 场景 IDLE：粒子静止在地面，几乎不动
    if(mode === MODE.SCENE && sceneState === SCENE_STATE.IDLE && !sceneFormed){
      // 微弱的地面呼吸感
      const breathe = Math.sin(time * 0.3 + seeds[i] * 10) * 0.02;
      positions[i3+1] += breathe * 0.1;
      velocities[i3] *= 0.5;
      velocities[i3+1] *= 0.5;
      velocities[i3+2] *= 0.5;
      continue;
    }

    let tx_, ty_, tz_;
    if(gathering){
      tx_ = targets[i3]; ty_ = targets[i3+1]; tz_ = targets[i3+2];
      // 地表光标：脉动向外扩散（涟漪式）
      if(mode === MODE.MAP && roles[i] >= 20 && roles[i] <= 23){
        const ci = roles[i] - 20;
        const coord = COORDINATES[ci];
        const rx = tx_ - coord.anchor.x;
        const rz = tz_ - coord.anchor.z;
        const rr = Math.hypot(rx, rz);
        // 每 2 秒一次脉冲，粒子随脉冲向外推一下
        const phase = (time * 0.6 + seeds[i]) % 1.0;
        const pulse = Math.sin(phase * Math.PI) * 0.5; // 0~0.5 正弦
        tx_ = coord.anchor.x + rx * (1 + pulse * 0.6);
        tz_ = coord.anchor.z + rz * (1 + pulse * 0.6);
        ty_ += pulse * 2.0; // 脉动时微微浮起
      }
      // 注：原来此处有"HELD/FORMED 态弦振动"，让 roles=1~4 的弦区粒子按 sin/cos 抖动，
      // 视觉上像 4 根波动的琴弦。但它会在琴颈中心形成一缕飘动的"沙流"，破坏主体形态，
      // 所以已移除——弦区粒子现在静止地作为琴颈的一部分。
    } else {
      // RELEASING 或散落状态 → 回到地面散落位置
      tx_ = scatteredPos[i3]; ty_ = scatteredPos[i3+1]; tz_ = scatteredPos[i3+2];
    }

    const dx = tx_ - positions[i3];
    const dy = ty_ - positions[i3+1];
    const dz = tz_ - positions[i3+2];

    /* ============================================================
     * 流沙物理：每个粒子有自己的"个性速度"
     *   slowness ∈ [0.20, 1.00]：80% 慢沙、20% 快粒
     *   慢者飘得慢、迟到；快者先到位
     * ============================================================ */
    const sd = seeds[i];
    // 0.20 ~ 1.00 之间的速度因子，sd 越接近 0.5 越慢（中间值多）
    const slowness = 0.22 + Math.pow(Math.abs(sd - 0.5) * 2, 0.7) * 0.78;
    const f = (gathering ? gatherForce : scatterForce) * slowness;

    if(gathering && mode===MODE.SCENE && sceneState===SCENE_STATE.GATHERING){
      /* —— 聚合阶段：Curl Noise 风场让轨迹出曲线 —— */
      // 伪 curl noise（用三个不同频率的 sin/cos 组合，开销极低）
      const px = positions[i3], py = positions[i3+1], pz = positions[i3+2];
      const t = time * 0.4;
      const curlX = Math.sin(py*0.04 + t + sd*20) - Math.cos(pz*0.05 + t*0.7 + sd*15);
      const curlY = Math.sin(pz*0.04 + t*1.1 + sd*25) - Math.cos(px*0.05 + t*0.8 + sd*30);
      const curlZ = Math.sin(px*0.04 + t*0.9 + sd*35) - Math.cos(py*0.05 + t*1.2 + sd*10);
      // 风强度：聚合早期强（让粒子飘）→ 后期弱（让粒子定型）
      const windAmp = (1 - pressProgress * 0.85) * 0.18 * slowness;
      velocities[i3]   += curlX * windAmp;
      velocities[i3+1] += curlY * windAmp * 0.4 + Math.sin(t*0.6 + sd*50) * 0.04 * slowness; // Y 方向轻一些，加慢漂
      velocities[i3+2] += curlZ * windAmp;

      // 距离远的粒子有"惰性延迟"：刚开始几乎不动
      const distRemain = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const lazyFactor = Math.min(1, pressProgress * 1.3 + (1-distRemain/100));
      velocities[i3]   += dx * f * lazyFactor;
      velocities[i3+1] += dy * f * lazyFactor;
      velocities[i3+2] += dz * f * lazyFactor;
    } else {
      // 非聚合阶段：标准 target 跟随
      velocities[i3]   += dx * f;
      velocities[i3+1] += dy * f;
      velocities[i3+2] += dz * f;
    }

    /* —— 阻尼：慢沙粒空气阻力大、快沙粒阻力小 —— */
    const indDamping = gathering ? (0.85 + slowness * 0.10) : (0.92 + slowness * 0.06);
    velocities[i3]   *= indDamping;
    velocities[i3+1] *= indDamping;
    velocities[i3+2] *= indDamping;

    /* —— 噪声扰动 —— */
    const isRel = (mode===MODE.SCENE && sceneState===SCENE_STATE.RELEASING);
    const n = gathering ? 0.03 : (isRel ? 0.02 : 0.08);
    velocities[i3]   += (Math.random()-0.5)*n;
    velocities[i3+1] += (Math.random()-0.5)*n;
    velocities[i3+2] += (Math.random()-0.5)*n;

    if(mode===MODE.SCENE && !gathering && sceneState===SCENE_STATE.RELEASING){
      if(releaseLife[i] <= 0){
        const grain = sizes[i] || 0.4;

        if(crystalCollapseActive){
          // ===== 水晶碎片：缓慢垂直下落为主 =====
          // 重力轻但明确向下（梦境慢镜感）
          const grav = 0.03 + grain * 0.01;
          velocities[i3+1] -= grav * slowness;

          // 极微弱横向飘动（碎片不是被风吹的，只是空气微扰）
          velocities[i3]   += (Math.random()-0.5) * 0.004;
          velocities[i3+2] += (Math.random()-0.5) * 0.004;

          // 偶尔翻转闪光（随机改大小 → 模拟碎片旋转时光线角度变化）
          if(Math.random() < 0.015){
            sizes[i] = (1.5 + Math.random() * 3.5) * (0.5 + Math.random() * 1.0);
            geometry.getAttribute('aSize').needsUpdate = true;
          }
        } else {
          // ===== 原沙粒模式 =====
          const grav = 0.12 + grain * 0.25;
          velocities[i3+1] -= grav * slowness;

          const windFactor = (1.2 - grain) * 0.4;
          const windX = Math.sin(time*0.35 + sd*8) * 0.04
                      + Math.sin(time*1.7 + sd*30) * 0.015;
          const windZ = Math.cos(time*0.30 + sd*9) * 0.03
                      + Math.cos(time*1.5 + sd*28) * 0.01;
          velocities[i3]   += windX * windFactor + (Math.random()-0.5)*0.012;
          velocities[i3+2] += windZ * windFactor + (Math.random()-0.5)*0.012;

          if(grain < 0.25 && Math.random() < 0.02){
            velocities[i3+1] += 0.03;
          }
        }
      }
    }

    positions[i3]   += velocities[i3] * dt;
    positions[i3+1] += velocities[i3+1] * dt;
    positions[i3+2] += velocities[i3+2] * dt;

    /* —— 落地处理：颗粒分级反弹 + 扬尘 —— */
    if(mode===MODE.SCENE && sceneState===SCENE_STATE.RELEASING){
      const groundY = scatteredPos[i3+1];
      if(positions[i3+1] < groundY){
        const impactSpeed = -velocities[i3+1];
        const grain = sizes[i] || 0.4;
        positions[i3+1] = groundY + (Math.random()-0.5)*0.5;

        if(grain > 0.55 && impactSpeed > 0.5){
          // 粗沙重击：高几率反弹起一阵尘（尘会被横向风带走）
          if(Math.random() < 0.18){
            velocities[i3+1] = impactSpeed * 0.45;
            velocities[i3]   += (Math.random()-0.5) * 0.8;
            velocities[i3+2] += (Math.random()-0.5) * 0.8;
          } else {
            velocities[i3+1] *= -0.10;
            velocities[i3]   *= 0.55;     // 沿地面滑一下
            velocities[i3+2] *= 0.55;
          }
        } else if(grain < 0.30){
          // 细沙：完全停下（飘到哪里就停哪里），不反弹
          velocities[i3+1] = 0;
          velocities[i3]   *= 0.20;
          velocities[i3+2] *= 0.20;
        } else {
          // 中等颗粒：温和反弹
          velocities[i3+1] *= -0.08;
          velocities[i3]   *= 0.40;
          velocities[i3+2] *= 0.40;
        }
      }
    }
  }

  posAttr.needsUpdate = true;
  } // end if(points.visible) — 主粒子积分块

  // —— 琴的 Y 轴慢速旋转：仅在沙雕态（HELD/FORMED）启用 ——
  // RELEASING：冻结旋转角度（松手瞬间朝向不变，粒子原地崩散）
  // 其他非旋转态：缓慢归零，为下次聚合准备
  const rotating = (mode === MODE.SCENE) &&
                   (sceneState === SCENE_STATE.HELD || sceneState === SCENE_STATE.FORMED);
  const releasing = (mode === MODE.SCENE) && (sceneState === SCENE_STATE.RELEASING);
  if(mode !== MODE.MAP){
    if(rotating){
      points.rotation.y += 0.0070 * dt;
    } else if(releasing){
      // 冻结：什么都不做，保持松手瞬间的角度
    } else {
      // 聚合中/IDLE：缓慢归零
      points.rotation.y += (0 - points.rotation.y) * 0.03;
    }
  } else {
    points.rotation.y = 0;
  }

  updateLabelPositions();
  if(mode === MODE.SCENE || enteringScene) drawMiniSandbox();

  // 场景 1 新管线：更新崩塌动画
  if(MODELS.golestan.collapseState === 'collapsing'){
    updateChandelierCollapse(dt, time);
  }

  // 始终用标准渲染（保持 canvas alpha 透明，CSS 背景可见）
  renderer.render(scene, camera);

  // CSS bloom 层：沙雕态时叠加辉光
  if(window._bloomLayer){
    const wantBloomOpacity = sculptVal > 0.5 ? 0.55 : 0;
    const bl = window._bloomLayer;
    const cur = parseFloat(bl.style.opacity) || 0;
    bl.style.opacity = (cur + (wantBloomOpacity - cur) * 0.06).toFixed(3);
    if(sculptVal > 0.5) renderBloom();
  }

  requestAnimationFrame(tick);
}

function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  // 如果在 golestan 新管线场景，动态调整 FOV
  // 但子场景全景模式下（directory.js 接管 FOV），不要覆盖
  const isGolestan = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
  const isDirSubScene = (typeof _dirCurrentSceneIdx !== 'undefined') && _dirCurrentSceneIdx >= 0;
  if(mode === MODE.SCENE && isGolestan && !isDirSubScene){
    const aspect = camera.aspect;
    const baseFov = 65;
    const fov = Math.round(baseFov / Math.max(aspect, 0.4));
    camera.fov = THREE.MathUtils.clamp(fov, 45, 100);
  } else if(isDirSubScene && typeof DIR_PANO_FOV !== 'undefined'){
    camera.fov = DIR_PANO_FOV;
  }
  camera.updateProjectionMatrix();
  // bloom 层同步尺寸
  if(window._bloomLayer){
    window._bloomLayer.width = canvas.width;
    window._bloomLayer.height = canvas.height;
  }
}
window.addEventListener('resize', onResize);

/* ================================================================
 *  微型沙盘绘制（右上角鸟瞰缩略图，展示解锁进度）
 * ================================================================ */
let miniSandboxFrame = 0;
function drawMiniSandbox(){
  if(!miniSandboxCtx) return;
  miniSandboxFrame++;
  if(miniSandboxFrame % 3 !== 0) return; // 每 3 帧绘一次

  const ctx = miniSandboxCtx;
  const W = 140, H = 140;
  ctx.clearRect(0, 0, W, H);

  // 背景
  ctx.fillStyle = 'rgba(8,6,4,0.9)';
  ctx.fillRect(0, 0, W, H);

  // 绘制地形纹理线（等高线风格）
  ctx.strokeStyle = 'rgba(80,60,30,0.2)';
  ctx.lineWidth = 0.5;
  for(let y = 15; y < H; y += 18){
    ctx.beginPath();
    for(let x = 0; x <= W; x += 5){
      const ny = y + Math.sin(x * 0.08 + y * 0.05) * 4;
      if(x === 0) ctx.moveTo(x, ny);
      else ctx.lineTo(x, ny);
    }
    ctx.stroke();
  }

  // 坐标转换：world XZ → mini canvas
  function worldToMini(wx, wz){
    const mx = (wx / 260 + 0.5) * W;
    const my = (wz / 200 + 0.6) * H;
    return [mx, my];
  }

  // 绘制伊朗轮廓（简化）
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(212,165,116,0.15)';
  ctx.lineWidth = 0.8;
  IRAN_OUTLINE.forEach((pt, idx) => {
    const pos = geoToXZ(pt[0], pt[1]);
    const [mx, my] = worldToMini(pos.x, pos.z);
    if(idx === 0) ctx.moveTo(mx, my);
    else ctx.lineTo(mx, my);
  });
  ctx.closePath();
  ctx.stroke();

  // 绘制城市之间的连接路线（按顺序连线）
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(100,85,55,0.25)';
  ctx.lineWidth = 0.6;
  ctx.setLineDash([2, 3]);
  COORDINATES.forEach((coord, idx) => {
    const [mx, my] = worldToMini(coord.anchor.x, coord.anchor.z);
    if(idx === 0) ctx.moveTo(mx, my);
    else ctx.lineTo(mx, my);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // 已解锁路线高亮
  if(unlockedIdx > 0 || progress[0]){
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(212,165,116,0.4)';
    ctx.lineWidth = 0.8;
    const litEnd = Math.min(unlockedIdx + 1, COORDINATES.length);
    for(let idx = 0; idx < litEnd; idx++){
      const [mx, my] = worldToMini(COORDINATES[idx].anchor.x, COORDINATES[idx].anchor.z);
      if(idx === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.stroke();
  }

  // 绘制所有坐标点
  COORDINATES.forEach((coord, idx) => {
    const [mx, my] = worldToMini(coord.anchor.x, coord.anchor.z);
    const isUnlocked = progress[idx] || idx <= unlockedIdx;
    const isCurrent = idx === currentSceneIdx;
    const isDone = progress[idx];

    if(isCurrent){
      // 当前场景：大亮点 + 脉冲光晕
      const pulse = Math.sin(miniSandboxFrame * 0.05) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,201,138,${0.08 * pulse})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,201,138,${0.2 * pulse})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c98a';
      ctx.fill();
    } else if(isDone){
      // 已完成：明亮金色点
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,165,116,0.8)';
      ctx.fill();
      // 已完成光晕
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,165,116,0.1)';
      ctx.fill();
    } else if(isUnlocked){
      // 已解锁未完成：金色发光点
      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,165,116,0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,165,116,0.12)';
      ctx.fill();
    } else {
      // 未解锁：灰色但可见（黑灰色锁定状态）
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(80,70,55,0.6)';
      ctx.fill();
      // 未解锁外圈
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(60,55,40,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // 标注所有城市名称
    ctx.textAlign = 'center';
    if(isCurrent){
      ctx.fillStyle = 'rgba(240,201,138,0.9)';
      ctx.font = 'bold 7.5px sans-serif';
      ctx.fillText(coord.name, mx, my + 12);
    } else if(isUnlocked){
      ctx.fillStyle = isDone ? 'rgba(180,150,100,0.6)' : 'rgba(212,165,116,0.75)';
      ctx.font = '7px sans-serif';
      ctx.fillText(coord.name, mx, my + 10);
    } else {
      // 未解锁也显示名称，但暗灰色
      ctx.fillStyle = 'rgba(80,70,55,0.45)';
      ctx.font = '6.5px sans-serif';
      ctx.fillText(coord.name, mx, my + 9);
    }
  });

  // 绘制琴的简化图示（如果当前场景有琴且已成形）
  if(sceneFormed && COORDINATES[currentSceneIdx]?.sceneReady){
    const [cx, cy] = worldToMini(0, 0);
    ctx.save();
    ctx.translate(cx, cy - 5);
    ctx.strokeStyle = 'rgba(240,201,138,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 简化琴体轮廓
    ctx.moveTo(-3, -8);
    ctx.quadraticCurveTo(-4, 0, -3, 8);
    ctx.quadraticCurveTo(0, 10, 3, 8);
    ctx.quadraticCurveTo(4, 0, 3, -8);
    ctx.quadraticCurveTo(0, -10, -3, -8);
    ctx.stroke();
    // 弦
    ctx.strokeStyle = 'rgba(240,201,138,0.4)';
    ctx.lineWidth = 0.5;
    for(let s = -1.5; s <= 1.5; s += 1){
      ctx.beginPath();
      ctx.moveTo(s, -7);
      ctx.lineTo(s, 7);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 边框微光
  ctx.strokeStyle = 'rgba(212,165,116,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W-1, H-1);
}

tick();

// 性能优化：tab 隐藏时 tick 已自我停止；变可见时重新启动
// （同时重置 t0 避免恢复后 dt 暴涨导致粒子瞬移/动画跳变）
document.addEventListener('visibilitychange', () => {
  if(!document.hidden){
    t0 = performance.now();   // 重置时间锚，避免大 dt
    tick();                   // 拉起主循环
    console.log('[perf] tab 可见，恢复渲染');
  } else {
    console.log('[perf] tab 隐藏，暂停渲染');
  }
});

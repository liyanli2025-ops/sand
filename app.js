/* ================================================================
 *  《聚不起的沙》· 伊朗 100 天 · 沉浸式星图（AR-like）
 * ================================================================ */

console.log('%c[app-v2.js] 已加载 新文件名版本', 'color:#d4a574;font-weight:bold;font-size:14px');

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
  splashEl.classList.add('fade-out');
  document.body.classList.remove('splash-mode');
  // 不进地图，直接进场景 1
  document.body.classList.add('scene-mode');
  // 立即隐藏 scene-bg（CSS 背景图是工作室的，不要显示）
  const sceneBgEl = document.querySelector('.scene-bg');
  if(sceneBgEl) sceneBgEl.style.display = 'none';
  // 淡出完成后彻底移除 DOM（释放视频内存），然后自动进入吊灯场景
  setTimeout(() => {
    if(splashEl && splashEl.parentNode){
      splashVideo.pause();
      splashVideo.removeAttribute('src');
      splashVideo.load();
      splashEl.parentNode.removeChild(splashEl);
    }
    // 自动进入场景 1
    autoEnterGolestan();
  }, 1500);
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
const AMBIENT_COUNT = isMobile ? 1000 : 1800;

/* ---------- 通用模型管理：按场景 ID 加载不同 GLB ---------- */
const _isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const _CDN = 'https://mat1.gtimg.com/qqcdn/redian/sand_test/';
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
  }
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
loadModelForScene('tehran');

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

/* ---------- 全景图水晶反光光点（随视角切换闪烁） ---------- */
const sparkleGroup = new THREE.Group();
sparkleGroup.visible = false;
sparkleGroup.renderOrder = -5;
scene.add(sparkleGroup);

// —— A. 密集小光点（球面分布，约 120 颗）——
const SPARKLE_COUNT = 120;
const SPARKLE_RADIUS = 900;
const sparkleGeo = new THREE.BufferGeometry();
const sparklePos = new Float32Array(SPARKLE_COUNT * 3);
const sparkleDir = new Float32Array(SPARKLE_COUNT * 3);
const sparkleSeed = new Float32Array(SPARKLE_COUNT);
const sparkleSize = new Float32Array(SPARKLE_COUNT);

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
  sparklePos[i*3]   = nx * SPARKLE_RADIUS;
  sparklePos[i*3+1] = ny * SPARKLE_RADIUS;
  sparklePos[i*3+2] = nz * SPARKLE_RADIUS;
  sparkleDir[i*3]   = -nx;
  sparkleDir[i*3+1] = -ny;
  sparkleDir[i*3+2] = -nz;
  sparkleSeed[i] = Math.random() * 100;
  sparkleSize[i] = 8 + Math.random() * 18;
}
sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
sparkleGeo.setAttribute('aDir',     new THREE.BufferAttribute(sparkleDir, 3));
sparkleGeo.setAttribute('aSeed',    new THREE.BufferAttribute(sparkleSeed, 1));
sparkleGeo.setAttribute('aSize',    new THREE.BufferAttribute(sparkleSize, 1));

const sparkleMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:       { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uMap:        { value: null }, // 延迟赋值，crystalTex 还未创建
    uOpacity:    { value: 0 },
  },
  vertexShader: `
    attribute vec3 aDir;
    attribute float aSeed;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main(){
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vec3 viewDir = normalize(position - cameraPosition);
      float facing = clamp(dot(viewDir, normalize(aDir)) * 0.5 + 0.5, 0.0, 1.0);
      facing = pow(facing, 3.0);
      float twinkle = 0.55 + 0.45 * sin(uTime * 1.6 + aSeed * 6.2831);
      vAlpha = facing * twinkle;
      gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform sampler2D uMap;
    uniform float uOpacity;
    varying float vAlpha;
    void main(){
      vec4 tex = texture2D(uMap, gl_PointCoord);
      vec3 col = mix(vec3(1.0, 0.92, 0.78), vec3(1.0, 1.0, 1.0), vAlpha);
      gl_FragColor = vec4(col, tex.a * vAlpha * uOpacity);
      if(gl_FragColor.a < 0.01) discard;
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
});
const sparklePoints = new THREE.Points(sparkleGeo, sparkleMat);
sparklePoints.frustumCulled = false;
sparkleGroup.add(sparklePoints);

// —— B. 大颗星芒（Sprite，约 8 颗）——
const flareCount = 8;
const flareSprites = [];
for(let i = 0; i < flareCount; i++){
  const u = Math.random(), v = 0.25 + Math.random() * 0.6;
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);
  const x = sinPhi * Math.cos(theta) * 850;
  const y = Math.cos(phi) * 850;
  const z = sinPhi * Math.sin(theta) * 850;
  const sprMat = new THREE.SpriteMaterial({
    map: null, // 延迟赋值
    color: 0xfff4d0,
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  const spr = new THREE.Sprite(sprMat);
  spr.position.set(x, y, z);
  spr.scale.setScalar(80 + Math.random() * 60);
  spr.userData = {
    dir: new THREE.Vector3(-x, -y, -z).normalize(),
    seed: Math.random() * 100,
    baseScale: spr.scale.x,
  };
  flareSprites.push(spr);
  sparkleGroup.add(spr);
}

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
// 延迟赋值：将 crystalTex 给反光光点使用
sparkleMat.uniforms.uMap.value = crystalTex;
for(const _fs of flareSprites) _fs.material.map = crystalTex;


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
    id: 'golestan', name: 'TEHRAN', zh:'德黑兰 · 格列斯坦宫',
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
        { text: '卡扎尔王朝用十万面镜片铺满这座厅堂，', quiet:false },
        { text: '让每一位来客都能从四面八方看见自己。', quiet:false },
        { text: '如今镜片仍在，但映出的已是另一个国家。', quiet:false },
        { text: '2026 年 3 月 20 日，诺鲁孜节。', quiet:true },
        { text: '他们说：镜子碎了可以重拼，节日过了可以再来。', quiet:true },
        { text: '但这一年的春天，没有如期而至。', quiet:true },
      ]
    }
  },
  {
    id: 'tehran', name: 'TEHRAN', zh:'德黑兰',
    lon: 51.40, lat: 35.70, day: 23,
    modelId: 'tehran',
    panoUrl: './bg01.png',
    subtitle: 'WORKSHOP NO.07',
    subtitleRight: 'SETAR',
    subtitleRight2: 'سه‌تار',
    sceneReady: true,
    story: {
      coord: 'TEHRAN · 35.70°N / 51.40°E',
      day: 'day 23',
      lines: [
        { text: '德黑兰城南一间不到十平米的作坊里，', quiet:false },
        { text: '有一把塞塔尔琴，制作到第 80%。', quiet:false },
        { text: '匠人做了三十年这件事，他的父亲也是。', quiet:false },
        { text: '第 23 天，屋顶塌了。琴颈还在木架上。', quiet:true },
        { text: '四根弦，从细到粗，依次崩断。', quiet:true },
      ]
    }
  },
  { id:'isfahan', name:'ISFAHAN', zh:'伊斯法罕', lon:51.67, lat:32.65, day:47,
    subtitle:'SHEIKH LOTFOLLAH', subtitleRight:'THE DOME', subtitleRight2:'گنبد', sceneReady:false },
  { id:'shiraz', name:'SHIRAZ', zh:'设拉子', lon:52.58, lat:29.61, day:68,
    subtitle:'NASIR AL-MULK', subtitleRight:'THE WINDOWS', subtitleRight2:'پنجره', sceneReady:false },
  { id:'mashhad', name:'MASHHAD', zh:'马什哈德', lon:59.61, lat:36.30, day:89,
    subtitle:'HAFT-SIN · NEW YEAR', subtitleRight:'THE TABLE', subtitleRight2:'سفره', sceneReady:false },
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

/* ---------- 氛围粒子 ---------- */
const ambGeo = new THREE.BufferGeometry();
const ambPos = new Float32Array(AMBIENT_COUNT*3);
const ambSeed = new Float32Array(AMBIENT_COUNT);
for(let i=0;i<AMBIENT_COUNT;i++){
  ambPos[i*3]=(Math.random()-0.5)*500;
  ambPos[i*3+1]=Math.random()*200 - 30;  // 主要在上方
  ambPos[i*3+2]=(Math.random()-0.5)*500;
  ambSeed[i]=Math.random();
}
ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
ambGeo.setAttribute('aSeed', new THREE.BufferAttribute(ambSeed, 1));
const ambMat = new THREE.ShaderMaterial({
  uniforms:{uTex:{value:spriteTex},uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},
    uLightDir:{value:new THREE.Vector3(0.55,0.75,0.35).normalize()},uLightMix:{value:0}},
  vertexShader:`
    attribute float aSeed;
    uniform float uTime, uPixelRatio;
    uniform vec3 uLightDir;
    varying float vLight;
    void main(){
      vec3 p = position;
      p.x += sin(uTime*0.15 + aSeed*50.0) * 6.0;
      p.y += cos(uTime*0.12 + aSeed*40.0) * 4.0;
      p.z += sin(uTime*0.1 + aSeed*30.0) * 5.0;
      vLight = smoothstep(-0.2, 0.9, dot(normalize(p), uLightDir));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = (0.6 + aSeed*1.1) * 130.0 / -mv.z * uPixelRatio;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader:`
    uniform sampler2D uTex;
    uniform float uLightMix;
    varying float vLight;
    void main(){
      vec4 tc = texture2D(uTex, gl_PointCoord);
      if(tc.a<0.01) discard;
      float litScene = 0.15 + vLight * 1.2;
      float lit = mix(0.6, litScene, uLightMix);
      vec3 colScene = mix(vec3(0.55,0.55,0.65), vec3(1.0,0.85,0.60), vLight);
      vec3 col = mix(vec3(0.70,0.62,0.50), colScene, uLightMix);
      float a = mix(0.18, 0.12 + vLight * 0.28, uLightMix);
      gl_FragColor = vec4(col * lit, tc.a * a);
    }`,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
});
const ambient = new THREE.Points(ambGeo, ambMat);
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
const DUST_COUNT  = isMobile ? 300 : 800;

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
    // 隐藏地面
    gltf.scene.traverse(o => {
      if(!o.isMesh) return;
      const nm = (o.name || '').toLowerCase();
      if(nm.includes('plane') || nm.includes('ground') || nm.includes('floor')){
        o.visible = false;
      }
      const vCount = o.geometry?.getAttribute('position')?.count || 0;
      if(vCount < 10) o.visible = false;
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
  dustData = [];

  const range = Math.max(worldSize.x, worldSize.y, worldSize.z);
  for(let i = 0; i < count; i++){
    const src = samplePool[Math.floor(Math.random() * samplePool.length)];
    const px = src.pos.x + (Math.random()-0.5) * range * 0.3;
    const py = src.pos.y + (Math.random()-0.5) * range * 0.3;
    const pz = src.pos.z + (Math.random()-0.5) * range * 0.3;
    posArr[i*3] = px; posArr[i*3+1] = py; posArr[i*3+2] = pz;
    dustData.push({
      x: px, y: py, z: pz,
      vx: (Math.random()-0.5) * range * 0.01,
      vy: (Math.random()-0.5) * range * 0.008 - range * 0.002,
      vz: (Math.random()-0.5) * range * 0.01,
      twinkleSpeed: 2 + Math.random() * 5,
      twinklePhase: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.3,
    });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xddeeff,
    size: Math.min(range * 0.005, 4),
    map: crystalTex,
    transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });

  dustPoints = new THREE.Points(geo, mat);
  dustPoints.frustumCulled = false;
  scene.add(dustPoints); // 世界空间
  return dustPoints;
}

// 碎片动画 mixer
let shardMixer = null;

function triggerChandelierCollapse(){
  const mdlG = MODELS.golestan;
  if(mdlG.collapseState !== 'idle') return;
  if(!shardModelMeshes || !shardModelMeshes.scene){ console.warn('[shard] 碎片模型未加载'); return; }
  mdlG.collapseState = 'collapsing';
  crystalCollapseActive = true;

  const container = mdlG.frameGroup;
  if(!container) return;
  shardObjects = []; shardInstMeshes = [];

  // CSS 闪光 + 光柱
  const flashEl = document.getElementById('shatterFlash');
  if(flashEl){ flashEl.classList.remove('active'); void flashEl.offsetWidth; flashEl.classList.add('active'); }
  const beamEl = document.getElementById('shatterBeam');
  if(beamEl){ setTimeout(()=>{ beamEl.classList.remove('active'); void beamEl.offsetWidth; beamEl.classList.add('active'); }, 300); }
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
    crystalMat.needsUpdate = true;
    shardScene.traverse(o => {
      if(o.isMesh) o.material = crystalMat;
    });
  }

  // 播放原始碎裂动画！
  shardMixer = new THREE.AnimationMixer(shardScene);
  if(shardModelMeshes.animations && shardModelMeshes.animations.length > 0){
    const clip = shardModelMeshes.animations[0];
    const action = shardMixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
    console.log('[shard] 播放原始动画，时长:', clip.duration.toFixed(2), 's');
  }

  shardInstMeshes.push({inst: shardGroup, mat: null});
  mdlG._shardDirLight = shardDirLight;
  mdlG._shardDirLight2 = shardDirLight2;
  mdlG._shardAmbLight = shardAmbLight;

  // 微尘
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

  // 隐藏原吊灯
  mdlG.gltfScene.visible = false;
  mdlG.gltfScene.traverse(o => { if(o.isMesh) o.visible = false; });
  points.visible = false;

  const blastLight = new THREE.PointLight(0xaaddff, 10, maxDim*3);
  blastLight.position.copy(cCenter); scene.add(blastLight);
  mdlG._blastLight = blastLight;

  if(COORDINATES[currentSceneIdx]?.sceneReady) storyEl.classList.add('show');

  // 动画播完后清理（给足时间）
  const clipDuration = shardModelMeshes.animations[0]?.duration || 5;
  mdlG._collapseTimeout = setTimeout(()=>{
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
      panoDimSphere.material.opacity=0.15;
      nextHint.classList.add('show');
    }
  }, (clipDuration + 2) * 1000);

  console.log('[golestan] 碎裂！播放原始动画 shardScale:', shardScale.toFixed(3), 'maxDim:', maxDim.toFixed(1));
}

/* 每帧更新：播放碎片原始动画 + 给停在地面的碎片加重力 + 微尘 */
let shardExtraFall = {}; // 碎片额外下落速度 { meshId: velocity }

function updateChandelierCollapse(dt, time){
  const mdlG = MODELS.golestan;
  if(mdlG.collapseState !== 'collapsing') return;
  const dtSec = dt / 60;
  const elapsed = (performance.now() - collapseStartTime) / 1000;

  // 驱动碎片动画
  if(shardMixer){
    shardMixer.update(dtSec);
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

  // 微尘更新
  if(dustPoints && dustData.length > 0){
    const dPos = dustPoints.geometry.getAttribute('position');
    const dustOpacity = elapsed < 0.5 ? elapsed / 0.5 * 0.7 : (elapsed < 5 ? 0.7 : 0.7 * Math.max(0, 1 - (elapsed - 5) / 3));
    dustPoints.material.opacity = dustOpacity;
    for(let i = 0; i < dustData.length; i++){
      const d = dustData[i];
      if(elapsed < d.delay) continue;
      d.x += d.vx * dtSec; d.y += d.vy * dtSec; d.z += d.vz * dtSec;
      d.x += Math.sin(time * 0.001 * d.twinkleSpeed + d.twinklePhase) * 0.01;
      d.y += Math.cos(time * 0.001 * d.twinkleSpeed * 0.7 + d.twinklePhase) * 0.005;
      dPos.setXYZ(i, d.x, d.y, d.z);
    }
    dPos.needsUpdate = true;
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
      if(o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mat => {
          if(mat._origOpacity !== undefined) mat.opacity = mat._origOpacity;
          mat.needsUpdate = true;
        });
      }
      o.scale.set(1,1,1);
      o.rotation.set(0,0,0);
    });
  }

  if(mdlG.shardMesh) mdlG.shardMesh.visible = false;
  mdlG.collapseState = 'idle';
  if(mdlG.shardData) mdlG.shardData.active = false;
  crystalCollapseActive = false;
  if(mdlG._collapseTimeout) clearTimeout(mdlG._collapseTimeout);
  if(mdlG._blastLight && mdlG._blastLight.parent) mdlG._blastLight.parent.remove(mdlG._blastLight);
  if(mdlG._shardDirLight && mdlG._shardDirLight.parent) mdlG._shardDirLight.parent.remove(mdlG._shardDirLight);
  if(mdlG._shardDirLight2 && mdlG._shardDirLight2.parent) mdlG._shardDirLight2.parent.remove(mdlG._shardDirLight2);
  if(mdlG._shardAmbLight && mdlG._shardAmbLight.parent) mdlG._shardAmbLight.parent.remove(mdlG._shardAmbLight);
  shardMixer = null;
  shardExtraFall = {};

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
    el.innerHTML = `<div class="dot"></div><div class="name">${c.name}</div><div class="day">day ${String(c.day).padStart(3,'0')}</div>`;
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
  if(mdl && mdl.sampledPoints){
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
  arBlend = 0;
  camYaw = 0;
  smoothYaw = PANO_YAW_OFFSET;
  smoothPitch = 0;

  // === 判断是否走新管线（场景 1 golestan 实体模型） ===
  const isGolestan = (coord.modelId === 'golestan');
  const golestanReady = isGolestan && MODELS.golestan.gltfScene;

  if(golestanReady){
    // 新管线：显示完整 3D 实体模型
    const ok = enterChandelierScene();
    if(!ok){
      // 降级：走旧粒子管线
      if(coord.modelId && coord.sceneReady) buildSceneTargets(coord.modelId);
      else buildPlaceholderTargets();
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aColor').needsUpdate = true;
    }
  } else {
    // 旧管线（场景 2 及其他）
    if(coord.modelId && coord.sceneReady) buildSceneTargets(coord.modelId);
    else buildPlaceholderTargets();
    geometry.getAttribute('aSize').needsUpdate = true;
    geometry.getAttribute('aColor').needsUpdate = true;
  }

  // 显示加载状态
  if(modelLoadingEl){
    const mdl = coord.modelId ? MODELS[coord.modelId] : null;
    if(mdl && !mdl.sampledPoints && !mdl.loadFailed && !golestanReady){
      modelLoadingEl.classList.add('show');
    } else {
      modelLoadingEl.classList.remove('show');
    }
  }

  // 非新管线场景：生成地面散落位置
  if(!golestanReady){
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

  // 全景图 skybox
  const sceneIdForPano = coord.modelId || coord.id;
  currentPanoId = sceneIdForPano;
  if(coord.panoUrl) loadPanoForScene(sceneIdForPano, coord.panoUrl);
  const panoTex = panoTextures[sceneIdForPano];
  if(panoTex && panoTex !== 'loading'){
    scene.background = panoTex;
    panoDimSphere.visible = true;
    // golestan 场景降低暗化（让宫殿全景更亮）
    panoDimSphere.material.opacity = golestanReady ? 0.15 : 0.55;
    const sceneBgEl = document.querySelector('.scene-bg');
    if(sceneBgEl) sceneBgEl.style.display = 'none';
    renderer.setClearColor(0x000000, 1);
  } else {
    panoDimSphere.visible = true;
    panoDimSphere.material.opacity = golestanReady ? 0.15 : 0.55;
    renderer.setClearColor(0x000000, 1);
  }
  // 启用反光光点（仅 golestan 场景）
  sparkleGroup.visible = (sceneIdForPano === 'golestan');
  // 根据屏幕宽高比动态调整 FOV
  // 竖屏手机 aspect≈0.46 → 需要更大 FOV 才能看到足够的全景范围
  // 桌面 aspect≈1.78 → 较小 FOV 即可
  if(golestanReady){
    const aspect = window.innerWidth / window.innerHeight;
    // 基准：aspect=1.0 时 FOV=65；越窄(竖屏) FOV 越大，越宽(横屏) FOV 越小
    // 手机竖屏 aspect≈0.46 → FOV≈90；桌面 aspect≈1.78 → FOV≈50
    const baseFov = 65;
    const fov = Math.round(baseFov / Math.max(aspect, 0.4));
    camera.fov = THREE.MathUtils.clamp(fov, 45, 100);
  } else {
    camera.fov = 100;
  }
  camera.updateProjectionMatrix();

  // 相机
  if(golestanReady){
    // 吊灯在世界原点(0,0,0)
    // 相机在水平圆轨道上，稍低于吊灯，仰视
    // 初始位置：Z轴正方向，距离 orbitRadius
    const orbitRadius = 100;
    const orbitY = -35; // 相机更低，仰视更明显
    camera.position.set(0, orbitY, orbitRadius);
    cameraTarget.set(0, 0, 0); // 始终看向原点
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
    if(golestanReady){
      // 新管线：提示"点击屏幕"触发崩塌
      pressHintEl.innerHTML = 'tap to shatter <span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      setTimeout(()=>{
        if(mode===MODE.SCENE) pressHintEl.classList.add('show');
      }, 1200);
    } else {
      setTimeout(()=>{
        if(mode===MODE.SCENE && sceneState===SCENE_STATE.IDLE) pressHintEl.classList.add('show');
      }, 1200);
    }
  } else {
    phTitle.textContent = coord.zh;
    phEn.textContent = `${coord.name.toLowerCase()} · day ${coord.day} · coming soon`;
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

function buildStoryHTML(s, coord){
  let html = '';
  html += `<div class="card-title">${coord.zh}</div>`;
  html += `<div class="card-subtitle">${s.coord} <em>${s.day}</em></div>`;
  s.lines.forEach(l => { html += `<p class="${l.quiet?'quiet':''}">${l.text}</p>`; });
  html += `<div class="card-icon"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>`;
  return html;
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
let pointerActive = false;
let pressPointerStartX = 0, pressPointerStartY = 0;

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

  if(mode === MODE.SCENE){
    // 场景 1 新管线：不需要长按
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
  const pitchSens = (mode === MODE.SCENE) ? 0.008 : 0;
  camYaw = dragStartYaw + dx * yawSens;
  // 垂直方向：直接更新 smoothPitch 目标（场景模式下有效）
  if(mode === MODE.SCENE){
    const pitchDelta = -dy * pitchSens; // 向上拖 = 向上看
    smoothPitch = Math.max(-0.5, Math.min(0.5, pitchDelta));
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
nextHint.addEventListener('click', returnToMap);

/* ================================================================
 *  陀螺仪
 * ================================================================ */
function setupGyro(){
  if(!('DeviceOrientationEvent' in window)) return;
  if(typeof DeviceOrientationEvent.requestPermission === 'function'){
    gyroAsk.classList.add('show');
    gyroAllowBtn.addEventListener('click', async ()=>{
      try{
        const state = await DeviceOrientationEvent.requestPermission();
        if(state === 'granted'){
          window.addEventListener('deviceorientation', onDeviceOrientation);
          useGyro = true;
        }
      }catch(e){}
      gyroAsk.classList.remove('show');
    });
    gyroDenyBtn.addEventListener('click', ()=>{
      gyroAsk.classList.remove('show');
    });
  } else if(isMobile){
    window.addEventListener('deviceorientation', onDeviceOrientation);
    useGyro = true;
  }
}
function onDeviceOrientation(e){
  if(e.alpha === null) return;
  // —— Yaw（alpha）：左右转动 ——
  const a = e.alpha;
  if(gyroYawOffset === null) gyroYawOffset = a;
  let yaw = (a - gyroYawOffset) * Math.PI / 180;
  while(yaw > Math.PI) yaw -= 2*Math.PI;
  while(yaw < -Math.PI) yaw += 2*Math.PI;
  gyroYaw = -yaw;

  // —— Pitch（beta）：前后倾斜 ——
  // beta: 0=平放, 90=竖直, 负值=向后仰
  // 基准：手机自然手持约 60~70°，偏移后得到 ±30° 的俯仰范围
  const b = e.beta || 0;
  if(gyroPitchOffset === null) gyroPitchOffset = b;
  let pitch = (b - gyroPitchOffset) * Math.PI / 180;
  pitch = Math.max(-0.5, Math.min(0.5, pitch)); // 限制 ±0.5 rad（约 ±28°）
  gyroPitch = -pitch;
}
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
  const now = performance.now();
  const dt = Math.min((now - t0)/16.67, 2.5);
  t0 = now;
  const time = now * 0.001;

  particleMaterial.uniforms.uTime.value = time;
  ambMat.uniforms.uTime.value = time;

  // 全景反光光点更新
  if(sparkleGroup.visible){
    sparkleMat.uniforms.uTime.value = time;
    const targetOp = (mode === MODE.SCENE) ? 0.85 : 0;
    sparkleMat.uniforms.uOpacity.value += (targetOp - sparkleMat.uniforms.uOpacity.value) * 0.05;
    const camDir = new THREE.Vector3();
    for(const spr of flareSprites){
      camDir.copy(spr.position).sub(camera.position).normalize();
      const facing = THREE.MathUtils.clamp(camDir.dot(spr.userData.dir) * 0.5 + 0.5, 0, 1);
      const sharp = Math.pow(facing, 4);
      const twinkle = 0.6 + 0.4 * Math.sin(time * 1.2 + spr.userData.seed * 6.28);
      spr.material.opacity = sharp * twinkle * 0.9;
      const s = spr.userData.baseScale * (0.85 + sharp * 0.35);
      spr.scale.setScalar(s);
    }
  }

  updateTween(now);

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
      // 目标 yaw/pitch：陀螺仪 + 拖动叠加（手机上也能手指左右滑动切换视角）
      const targetYaw   = (useGyro ? gyroYaw + camYaw : camYaw) + PANO_YAW_OFFSET;
      const targetPitch = useGyro ? gyroPitch : 0;

      const lerpSpeed = 0.10;
      smoothYaw   += (targetYaw   - smoothYaw)   * lerpSpeed;
      smoothPitch += (targetPitch - smoothPitch) * lerpSpeed;

      // 判断是否是吊灯场景
      const isGolestanCam = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
      if(isGolestanCam){
        // 吊灯在原点，相机在水平圆轨道上微仰视
        const orbitR = 100;
        const orbitY = -35;
        camera.position.x = -Math.sin(smoothYaw) * orbitR;
        camera.position.y = orbitY + smoothPitch * 15;
        camera.position.z = -Math.cos(smoothYaw) * orbitR;
        camera.lookAt(0, 0, 0);
      } else {
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
  // 如果在 golestan 吊灯场景，动态调整 FOV
  const isGolestan = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
  if(mode === MODE.SCENE && isGolestan){
    const aspect = camera.aspect;
    const baseFov = 65;
    const fov = Math.round(baseFov / Math.max(aspect, 0.4));
    camera.fov = THREE.MathUtils.clamp(fov, 45, 100);
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

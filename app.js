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
  // 场景 2 · 大不里士地毯作坊（纯视频驱动，无 3D 几何）
  tabriz: {
    url: null,                 // 标记为程序化场景，不需要加载 GLB
    sampledPoints: null, loading: false, loadFailed: false,
    targetHeight: 0,
    tiltZ: 0, tiltX: 0,
    yOffset: 0,
    procedural: true,          // 程序化场景标记（兼容旧入口判断）
    videoReady: false,         // 视频 DOM 是否已初始化
    active: false,             // 是否当前正在演出（用于 cleanup 判断，等价旧的 sceneGroup 非空）
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
  // 程序化场景（如 tabriz 地毯作坊）不需要加载 GLB，标记 sampledPoints 为占位以阻止重复尝试
  if(mdl.procedural){
    mdl.sampledPoints = []; // 占位：表示"已就绪"，不会再走 loader
    return;
  }
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
loadModelForScene('tabriz');  // 程序化场景，loadModelForScene 内部跳过 GLB 加载

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

/* ---------- 全景图水晶反光光点（随视角切换闪烁） ---------- */
const sparkleGroup = new THREE.Group();
sparkleGroup.visible = false;
sparkleGroup.renderOrder = -5;
scene.add(sparkleGroup);

// —— A. 密集小光点（球面分布，约 260 颗）——
const SPARKLE_COUNT = 260;
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
  // 缩小：三档尺寸混合（之前 12~60，现在 6~24，且偏小）
  const r = Math.random();
  if(r < 0.15)      sparkleSize[i] = 16 + Math.random() * 8;    // 大颗（15%）
  else if(r < 0.55) sparkleSize[i] = 10 + Math.random() * 6;    // 中颗（40%）
  else              sparkleSize[i] = 5 + Math.random() * 5;     // 小颗（45%）
}
sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
sparkleGeo.setAttribute('aDir',     new THREE.BufferAttribute(sparkleDir, 3));
sparkleGeo.setAttribute('aSeed',    new THREE.BufferAttribute(sparkleSeed, 1));
sparkleGeo.setAttribute('aSize',    new THREE.BufferAttribute(sparkleSize, 1));

const sparkleMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:       { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uOpacity:    { value: 0 },
    uMotion:     { value: 0 },  // 0=静止, 1=快速转动
  },
  vertexShader: `
    attribute vec3 aDir;
    attribute float aSeed;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uMotion;
    varying float vAlpha;
    varying float vFlash;
    void main(){
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vec3 dirView = normalize((modelViewMatrix * vec4(aDir, 0.0)).xyz);
      vec3 toCamView = normalize(-mvPos.xyz);
      float facing = clamp(dot(dirView, toCamView) * 0.5 + 0.5, 0.0, 1.0);
      facing = pow(facing, 1.4);

      // 慢速基础闪烁（每颗节奏不同）
      float twinkle = 0.55 + 0.45 * sin(uTime * 1.8 + aSeed * 6.2831);
      // 快速尖脉冲
      float fast = sin(uTime * 5.2 + aSeed * 12.57);
      float flash = pow(max(fast, 0.0), 6.0);
      vFlash = flash * uMotion; // 尖闪也只在运动时出现

      // 总亮度 = facing * twinkle * 运动强度
      // 静止时 uMotion≈0 → vAlpha≈0 → 几乎不可见
      vAlpha = facing * twinkle * uMotion;

      // 闪光瞬间放大颗粒（仅运动时）
      float sizeBoost = 1.0 + vFlash * 0.8;
      gl_PointSize = aSize * uPixelRatio * sizeBoost * (300.0 / max(-mvPos.z, 1.0));
      gl_PointSize = max(gl_PointSize, 4.0);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying float vAlpha;
    varying float vFlash;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float r = length(uv);
      if(r > 0.5) discard;

      // 1) 圆形核心 —— 强高斯衰减让边缘柔和
      //    系数 60：在 r=0.18 处衰减到约 14%，r=0.3 时约 0.5% → 几乎只剩中心一点
      float core = exp(-r * r * 60.0);
      // 2) 柔光晕（更广但更弱的高斯）
      float halo = exp(-r * r * 12.0) * 0.35;

      // 3) 十字星芒：变细、变软（仅在 flash 时显形，平时几乎看不见）
      //    使用更软的衰减；并且不在边缘硬切，靠 r 包络让芒尖柔化
      float crossH = exp(-pow(uv.y * 50.0, 2.0)) * exp(-abs(uv.x) * 3.0);
      float crossV = exp(-pow(uv.x * 50.0, 2.0)) * exp(-abs(uv.y) * 3.0);
      float crossLine = max(crossH, crossV);
      // r 包络：靠近中心强，远端柔和淡出
      float starEnv = exp(-r * r * 8.0);
      float star = crossLine * starEnv;

      // 组合：核心 + 柔晕 始终存在，星芒只在 flash 瞬间显著
      float shape = core + halo + star * (0.25 + vFlash * 1.4);

      vec3 warm = vec3(1.0, 0.94, 0.78);
      vec3 cool = vec3(1.0, 1.0, 1.0);
      vec3 col = mix(warm, cool, clamp(vFlash, 0.0, 1.0));
      col *= 1.0 + vFlash * 0.6;

      float a = shape * vAlpha * uOpacity;
      if(a < 0.005) discard;
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

// —— B. 大颗星芒（Sprite，约 18 颗）——
const flareCount = 18;
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
  // 缩小：从 130~230 → 60~110（约 ½）
  spr.scale.setScalar(60 + Math.random() * 50);
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
        { text: '卡扎尔王朝用十万面镜片铺满这座厅堂。', quiet:false },
        { text: '光从穹顶落下，被切成千万道，', quiet:false },
        { text: '让每一位来客都能从四面八方，看见自己。', quiet:false },
        { text: '两百年来，这里一直叫做——镜厅。', quiet:false },
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
  {
    id: 'tabriz', name: 'TABRIZ', zh:'大不里士 · 巴扎作坊',
    lon: 46.30, lat: 38.08, day: 23,
    modelId: 'tabriz',
    panoUrl: null,  // 关闭天空盒：纪录片定镜，靠暗角+暖光晕营造氛围
    subtitle: 'BAZAAR WORKSHOP',
    subtitleRight: 'PERSIAN CARPET',
    subtitleRight2: 'فرش ایرانی',
    sceneReady: true,
    story: {
      coord: 'TABRIZ · 38.08°N / 46.30°E',
      day: 'day 23',
      lines: [
        { text: '一块大不里士地毯，350 个结每平方英寸。', quiet:false },
        { text: '一个织工每天只能织一排，', quiet:false },
        { text: '一块 3 × 5 米的毯子，要织整整两年。', quiet:false },
        { text: '这一块，已经织了一年零四个月。', quiet:false },
      ]
    },
    collapseStory: {
      coord: 'TABRIZ · 38.08°N / 46.30°E',
      day: 'day 23',
      lines: [
        { text: '2026 年 4 月 12 日。', quiet:true },
        { text: '导弹擦过 Tabriz 巴扎的屋顶。', quiet:false },
        { text: '一根丝线、一根丝线，倒着退了回去。', quiet:false },
        { text: '他们说，毯子烧了可以再织一块。', quiet:true },
        { text: '但织进去的一年零四个月，回不来了。', quiet:false },
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

  // —— 启动全景烧灼层（7s 缓慢焦化，最终全黑） ——
  panoBurnSphere.visible = true;
  panoBurnSphere.material.uniforms.uProgress.value = 0.05;  // 起点抬高，让一开始就有零星焦斑
  mdlG._burnStartTime = performance.now();
  mdlG._burnTotal = 7.0;            // 总时长 7s
  mdlG._collapseLinesShown = 0;     // 已展示的崩坏文案行数
  mdlG._collapseStoryActive = false;

  // 在烧灼开始约 0.4s 后，把 story 卡切换为崩坏版（直接替换内容，容器保持可见）
  const collapseStoryData = COORDINATES[currentSceneIdx]?.collapseStory;
  if(collapseStoryData && storyEl){
    setTimeout(()=>{
      if(mdlG.collapseState !== 'collapsing') return;
      // 直接替换内部 HTML（容器 .show 保留），然后切到崩坏样式
      storyEl.querySelector('.story-card-inner').innerHTML =
        buildStoryHTML(collapseStoryData, COORDINATES[currentSceneIdx]);
      storyEl.classList.add('collapse-story');
      // 确保容器仍可见（从浏览器视角"内容刷新"，淡入靠 p 自己的 .show 触发）
      if(!storyEl.classList.contains('show')) storyEl.classList.add('show');
      mdlG._collapseStoryActive = true;
      mdlG._collapseStorySwitchTime = performance.now();  // story 切换的时刻，用作文案节拍基准
    }, 400);
  }

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
      // 注意：碎片清理后 panoDimSphere 不再回弹（烧灼接管暗化），保留 0
      // nextHint 不在这里 add('show')，等烧灼结束（~7.5s）再显示
    }
  }, (clipDuration + 2) * 1000);

  // 烧灼结束后（总时长 + 0.5s 缓冲）显示 nextHint，等待用户点击进下一场景
  mdlG._nextHintTimeout = setTimeout(()=>{
    if(mdlG.collapseState === 'collapsing' || mdlG.collapseState === 'done'){
      nextHint.classList.add('show');
    }
  }, (mdlG._burnTotal + 0.5) * 1000);

  console.log('[golestan] 碎裂！播放原始动画 shardScale:', shardScale.toFixed(3), 'maxDim:', maxDim.toFixed(1));
}

/* 每帧更新：播放碎片原始动画 + 给停在地面的碎片加重力 + 微尘 */
let shardExtraFall = {}; // 碎片额外下落速度 { meshId: velocity }

function updateChandelierCollapse(dt, time){
  const mdlG = MODELS.golestan;
  if(mdlG.collapseState !== 'collapsing') return;
  const dtSec = dt / 60;
  const elapsed = (performance.now() - collapseStartTime) / 1000;

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
    shardMixer.update(dtSec);
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

  // ========== 全景烧灼层推进 + sparkle 淡出 + 崩坏文案逐行展示 ==========
  if(panoBurnSphere.visible && mdlG._burnStartTime){
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


/* ================================================================
 *  场景 2 · 大不里士地毯作坊（4 段视频驱动 · 猫拆地毯）
 *  叙事：用户进入大不里士巴扎织毯作坊，看到一只白色波斯猫
 *       盯着地上的红色毛线球。点击猫爪，猫一脚踢飞毛线球，
 *       毛线被扯出织机，整张地毯散开消失，画面渐黑。
 *  技术：零 3D——4 段竖屏 9:16 视频组成完整剧情：
 *       V1 推进：特写梭子织地毯 → 拉远到全景（一次性 ~6s）
 *       V2 待机：猫爪对毛线球跃跃欲试（loop，首尾帧一致）
 *       V3 触发：猫踢飞毛线球，毛线被拉扯（一次性 ~5s）
 *       V4 崩坏：地毯散开 → 织机倾倒 → 渐黑（一次性 ~7s）
 *  交互：V2 期间右下角猫爪热区可点击；30 秒无操作自动触发 V3。
 * ================================================================ */

// 视频资源 URL：5 段独立 video 模式
// 每段一个 mp4，单独编码（720×1280, h264, 24fps），头尾各砍 0.1s 去除 AI 生成的静帧+假推镜
// V3 用 video.loop=true 循环（猫看毛线球），等用户点击猫爪或超时进 V4
// 部署时 mp4 不打包入 H5，必须走 CDN
// 视频版本号：内容更新时递增，强制浏览器/CDN 重新请求
const _TABRIZ_V = '?v=10';
const TABRIZ_VIDEO_URLS = {
  v1: (_isLocal ? './videos/tabrizV1_seg.mp4' : _CDN + 'videos/tabrizV1_seg.mp4') + _TABRIZ_V,
  v2: (_isLocal ? './videos/tabrizV2_seg.mp4' : _CDN + 'videos/tabrizV2_seg.mp4') + _TABRIZ_V,
  // V3 单独换文件名是为了绕过 mat1.gtimg.com 的 CDN 边缘缓存
  // —— 之前 1.5×/2×/3× 三次源站上传都被 CDN Cache Hit 拦截，URL 不变就不重新拉源
  v3: (_isLocal ? './videos/tabrizV3_seg_3x.mp4' : _CDN + 'videos/tabrizV3_seg_3x.mp4') + _TABRIZ_V,
  v4: (_isLocal ? './videos/tabrizV4_seg.mp4' : _CDN + 'videos/tabrizV4_seg.mp4') + _TABRIZ_V,
  v5: (_isLocal ? './videos/tabrizV5_seg.mp4' : _CDN + 'videos/tabrizV5_seg.mp4') + _TABRIZ_V,
};
// V3 无操作多久自动触发 V4（毫秒）
const TABRIZ_V3_AUTO_TIMEOUT = 30000;
// 视频段状态枚举
const TABRIZ_VIDEO_STATE = {
  IDLE: 'idle',
  V1: 'v1',
  V2: 'v2',
  V3: 'v3',
  V4: 'v4',
  V5: 'v5',
  DONE: 'done',
};

// DOM 引用
let _tabrizRoot = null;
let _tabrizV1 = null, _tabrizV2 = null, _tabrizV3 = null, _tabrizV4 = null, _tabrizV5 = null;
let _tabrizCap1 = null, _tabrizCap2 = null;
let _tabrizSubtitle = null;             // 字幕容器
let _tabrizSubLines = {};               // { key: <span> }
let _tabrizPawHint = null;
let _tabrizFadeout = null;
let _tabrizFadein = null;        // 入场黑场遮罩（V1 在它后面已经开始播）
let _tabrizFadeinStarted = false; // 是否已开始 fade-out（避免 playing 重复触发）

// 状态
let _tabrizCurState = TABRIZ_VIDEO_STATE.IDLE;
let _tabrizV3Timer = null;
let _tabrizCaptionTimers = [];
let _tabrizActiveVideo = null;  // 当前正在播放的 video 元素引用

/* 入口：进入 Tabriz 场景。函数名保留以兼容外部调用 */
function enterCarpetScene(){
  const mdlT = MODELS.tabriz;
  _initTabrizVideoDom();
  if(!_tabrizRoot){
    console.warn('[tabriz] DOM 初始化失败');
    return false;
  }
  // 隐藏 3D 粒子系统（Tabriz 期间用纯 DOM 视频）
  scene.fog = null;
  points.visible = false;
  ambient.visible = false;
  for(let i = 0; i < COUNT; i++){
    positions[i*3] = 0; positions[i*3+1] = -9999; positions[i*3+2] = 0;
  }
  posAttr.needsUpdate = true;

  mdlT.active = true;
  // 进入根容器
  _tabrizRoot.classList.remove('fade-out');
  _tabrizRoot.classList.add('show');
  _tabrizFadeout.classList.remove('show');
  // Tabriz 不使用全局 story-card（改用专用底部字幕条）：主动隐藏 storyEl
  if(typeof storyEl !== 'undefined' && storyEl){
    storyEl.classList.remove('show');
    storyEl.classList.remove('collapse-story');
  }
  // 入场黑场：确保黑屏遮罩处于 show 状态，V1 在它后面开始播
  _tabrizFadeinStarted = false;
  if(_tabrizFadein) _tabrizFadein.classList.add('show');

  // 启动 V1 段
  _tabrizPlayV1();
  console.log('[tabriz] 视频场景启动');
  return true;
}

/* 退出：清理 DOM + 视频，函数名保留以兼容外部调用 */
function cleanupCarpetScene(){
  const mdlT = MODELS.tabriz;
  if(!mdlT.active) return;
  mdlT.active = false;
  _tabrizClearTimers();
  _tabrizClearCaptionTimers();
  // 暂停所有 video
  [_tabrizV1, _tabrizV2, _tabrizV3, _tabrizV4, _tabrizV5].forEach(v => {
    if(!v) return;
    try { v.pause(); v.loop = false; } catch(_e){}
  });
  _tabrizActiveVideo = null;
  // 隐藏 UI
  if(_tabrizPawHint) _tabrizPawHint.classList.remove('show');
  if(_tabrizCap1) _tabrizCap1.classList.remove('show');
  if(_tabrizCap2) _tabrizCap2.classList.remove('show');
  // 清掉所有字幕行的 .show
  if(_tabrizSubLines){
    Object.values(_tabrizSubLines).forEach(el => el && el.classList.remove('show'));
  }
  if(_tabrizFadeout) _tabrizFadeout.classList.remove('show');
  if(_tabrizFadein) _tabrizFadein.classList.remove('show');
  _tabrizFadeinStarted = false;
  // 清掉 V5 模糊（防止下次进场残留）
  [_tabrizV1, _tabrizV2, _tabrizV3, _tabrizV4, _tabrizV5].forEach(v => {
    if(v) v.classList.remove('v5-blur');
  });
  // 隐藏根容器
  if(_tabrizRoot){
    _tabrizRoot.classList.remove('show', 'fade-out');
  }
  _tabrizCurState = TABRIZ_VIDEO_STATE.IDLE;
  // 恢复粒子系统
  points.visible = true;
  ambient.visible = true;
  scene.fog = new THREE.FogExp2(0x05070d, 0.0035);
  console.log('[tabriz] 视频场景清理完成');
}

/* DOM 初始化（仅一次）
 * 【5 段独立 video 模式】每段视频一个 <video> 元素，分别加载各自的 src：
 *   - V1: tabrizV1_seg.mp4（intro 工艺特写→拉远）
 *   - V2: tabrizV2_seg.mp4（push-in 推近到猫）
 *   - V3: tabrizV3_seg.mp4（paw 猫看毛线球，loop=true 循环）
 *   - V4: tabrizV4_seg.mp4（chase 猫追线 + 织机被扯）
 *   - V5: tabrizV5_seg.mp4（unravel 地毯解构收尾）
 *   段切换时：暂停旧 video + display:none，新 video display:'' + play()
 *   头尾各砍 0.1s 已在素材层面处理（_hc_*.mp4），消除 AI 生成的静帧+假推镜 */
function _initTabrizVideoDom(){
  if(_tabrizRoot) return;
  _tabrizRoot     = document.getElementById('tabrizSceneRoot');
  _tabrizV1       = document.getElementById('tabrizV1');
  _tabrizV2       = document.getElementById('tabrizV2');
  _tabrizV3       = document.getElementById('tabrizV3');
  _tabrizV4       = document.getElementById('tabrizV4');
  _tabrizV5       = document.getElementById('tabrizV5');
  _tabrizCap1     = document.getElementById('tabrizCap1');
  _tabrizCap2     = document.getElementById('tabrizCap2');
  _tabrizSubtitle = document.getElementById('tabrizSubtitle');
  if(_tabrizSubtitle){
    _tabrizSubLines = {};
    _tabrizSubtitle.querySelectorAll('.tabriz-subtitle-line').forEach(el => {
      const k = el.getAttribute('data-key');
      if(k) _tabrizSubLines[k] = el;
    });
  }
  _tabrizPawHint  = document.getElementById('tabrizPawHint');
  _tabrizFadeout  = document.getElementById('tabrizFadeout');
  _tabrizFadein   = document.getElementById('tabrizFadein');
  if(!_tabrizRoot || !_tabrizV1) return;

  // 给每段 video 设 src + preload，全部先隐藏
  const segs = [
    [_tabrizV1, TABRIZ_VIDEO_URLS.v1],
    [_tabrizV2, TABRIZ_VIDEO_URLS.v2],
    [_tabrizV3, TABRIZ_VIDEO_URLS.v3],
    [_tabrizV4, TABRIZ_VIDEO_URLS.v4],
    [_tabrizV5, TABRIZ_VIDEO_URLS.v5],
  ];
  segs.forEach(([v, url]) => {
    if(!v) return;
    v.muted = true;
    v.loop = false;
    v.style.display = 'none';
    v.classList.remove('active');
    if(v.src !== url && v.currentSrc !== url){
      v.src = url;
      try { v.load(); } catch(_){}
    }
  });

  // 每个 video 都绑 ended 事件：自动切到下一段
  if(_tabrizV1) _tabrizV1.addEventListener('ended', _tabrizOnV1Ended);
  if(_tabrizV2) _tabrizV2.addEventListener('ended', _tabrizOnV2Ended);
  // V3 是 loop=true，不会触发 ended（由猫爪点击或超时切到 V4）
  if(_tabrizV4) _tabrizV4.addEventListener('ended', _tabrizOnV4Ended);
  if(_tabrizV5) _tabrizV5.addEventListener('ended', _tabrizOnV5Ended);
  // V1 首次开播 → 触发入场黑场 fade-out（视频已经在动了再显示）
  if(_tabrizV1) _tabrizV1.addEventListener('playing', _tabrizOnV1Playing);
  // error 兜底
  [_tabrizV1, _tabrizV2, _tabrizV3, _tabrizV4, _tabrizV5].forEach(v => {
    if(v) v.addEventListener('error', _tabrizOnVideoError);
  });

  // 猫爪热区点击 → 触发 V4（V3 期间）
  if(_tabrizPawHint){
    _tabrizPawHint.addEventListener('click', _tabrizOnPawClick);
    _tabrizPawHint.addEventListener('touchend', _tabrizOnPawClick);
  }
}

/* 切换显示的 video：旧的暂停隐藏，新的显示并播放 */
function _tabrizSwitchToVideo(newVideo){
  if(!newVideo) return;
  // 暂停并隐藏其他段
  [_tabrizV1, _tabrizV2, _tabrizV3, _tabrizV4, _tabrizV5].forEach(v => {
    if(!v || v === newVideo) return;
    try { v.pause(); } catch(_){}
    v.classList.remove('active');
    v.style.display = 'none';
  });
  // 显示并播放新段
  newVideo.style.display = '';
  newVideo.classList.add('active');
  try { newVideo.currentTime = 0; } catch(_){}
  _tabrizActiveVideo = newVideo;
  _tabrizSafePlay(newVideo, _tabrizFinishScene);
}

function _tabrizOnVideoError(e){
  console.warn('[tabriz] 视频错误', e && e.target && e.target.error);
  _tabrizFinishScene();
}

/* V1 首次 playing 事件 → 启动入场黑场 fade-out。
   关键：playing 事件在视频真正开始解码并产生新帧时才触发，此时移除遮罩
   能保证用户看到的"渐显"内容是已经在动的画面，而不是冻结的首帧。
   只触发一次（_tabrizFadeinStarted 标记），后续 V1 重播不再淡入。 */
function _tabrizOnV1Playing(){
  if(_tabrizFadeinStarted) return;
  _tabrizFadeinStarted = true;
  // 延 80ms 再淡出：给视频几帧的缓冲，避免有些设备 playing 事件早于真正出帧
  setTimeout(()=>{
    if(_tabrizFadein) _tabrizFadein.classList.remove('show');
  }, 80);
}

/* 工具：尝试播放视频，失败兜底 */
function _tabrizSafePlay(video, onFail){
  if(!video) { if(onFail) onFail(); return; }
  try {
    const p = video.play();
    if(p && typeof p.catch === 'function'){
      p.catch(err => {
        console.warn('[tabriz] 视频播放失败:', err && err.message);
        if(onFail) onFail();
      });
    }
  } catch(e){
    console.warn('[tabriz] play 异常:', e);
    if(onFail) onFail();
  }
}

/* === V1：intro（工艺特写→拉远全景，约 7.7s） ===
   V1 期间字幕：1.0s 起出第 1 句"350 个结"，停 4.5s 淡出。
   后续 s2/s3 在 V2 进入时再排（V1 ended 触发 V2）。 */
function _tabrizPlayV1(){
  _tabrizCurState = TABRIZ_VIDEO_STATE.V1;
  _tabrizSwitchToVideo(_tabrizV1);
  _tabrizClearCaptionTimers();
  _tabrizSubHideAll();
  // 旧 caption 占位 DOM（已 display:none，再清防御）
  if(_tabrizCap1) _tabrizCap1.classList.remove('show');
  if(_tabrizCap2) _tabrizCap2.classList.remove('show');
  // 字幕：s1（350 个结）—— 1.0s 起，停 4.5s
  _tabrizSubShow('s1', 1000, [TABRIZ_VIDEO_STATE.V1, TABRIZ_VIDEO_STATE.V2]);
  _tabrizSubHide('s1', 5500);
}

/* V1 自然结束 → 进 V2 */
function _tabrizOnV1Ended(){
  if(_tabrizCurState !== TABRIZ_VIDEO_STATE.V1) return;
  _tabrizEnterV2State();
}

/* V1 → V2：push-in 推近到猫，一次性（约 7.7s）
   V2 期间字幕节奏：
   +0.8s  s2 "一个织工每天只能织一排，"  停 2.8s
   +4.0s  s3 "一块 3×5 米的毯子，要织整整两年。"  停 2.8s
   +6.9s（V2 末，约 15s 整）s4 "这一块，已经织了一年零四个月。"
          这是金句，故意不淡出 —— 一直停到 V3 开始约 0.5s 后才悄悄消失，
          让用户带着这句话看猫盯着毛线球的镜头。 */
function _tabrizEnterV2State(){
  if(_tabrizCurState === TABRIZ_VIDEO_STATE.V2) return;
  _tabrizCurState = TABRIZ_VIDEO_STATE.V2;
  _tabrizSwitchToVideo(_tabrizV2);
  _tabrizClearCaptionTimers();
  _tabrizSubHideAll();
  // s2：织工每天只能织一排
  _tabrizSubShow('s2', 800, [TABRIZ_VIDEO_STATE.V2]);
  _tabrizSubHide('s2', 3600);
  // s3：3×5 米要织两年
  _tabrizSubShow('s3', 4000, [TABRIZ_VIDEO_STATE.V2]);
  _tabrizSubHide('s3', 6800);
  // s4：金句，撑到 V3 中段（V3 是 loop，可能 ~3s 后被点击 → V4，
  //     V4 进入会 clear caption timers + hideAll，因此最坏 ~3s 后被强制清空，
  //     最好情况 s4 显示约 6s + V3 整段 ~3s ≈ 9s 沉浸）
  _tabrizSubShow('s4', 6900, [TABRIZ_VIDEO_STATE.V2, TABRIZ_VIDEO_STATE.V3]);
  console.log('[tabriz] V1 结束，进入 V2');
}

/* V2 自然结束 → 进 V3 */
function _tabrizOnV2Ended(){
  if(_tabrizCurState !== TABRIZ_VIDEO_STATE.V2) return;
  _tabrizEnterV3State();
}

/* V2 → V3：paw 猫看毛线球，loop=true 循环，等用户点击 */
function _tabrizEnterV3State(){
  if(_tabrizCurState === TABRIZ_VIDEO_STATE.V3) return;
  _tabrizCurState = TABRIZ_VIDEO_STATE.V3;
  if(_tabrizV3) _tabrizV3.loop = true;
  _tabrizSwitchToVideo(_tabrizV3);
  console.log('[tabriz] V2 结束，进入 V3（loop=true）');
  // 显示猫爪点击热区（600ms 后浮现）
  if(_tabrizPawHint){
    setTimeout(()=>{
      if(_tabrizCurState === TABRIZ_VIDEO_STATE.V3) _tabrizPawHint.classList.add('show');
    }, 600);
  }
  // 30 秒无操作 → 自动触发 V4
  _tabrizClearTimers();
  _tabrizV3Timer = setTimeout(()=>{
    if(_tabrizCurState === TABRIZ_VIDEO_STATE.V3){
      console.log('[tabriz] V3 超时，自动触发 V4');
      _tabrizEnterV4State();
    }
  }, TABRIZ_V3_AUTO_TIMEOUT);
}

/* 猫爪点击 → 触发 V4 */
function _tabrizOnPawClick(e){
  if(_tabrizCurState !== TABRIZ_VIDEO_STATE.V3) return;
  if(e && e.preventDefault) e.preventDefault();
  _tabrizEnterV4State();
}

/* V3 → V4：chase 猫追线 + 织机被扯（约 10.5s）
   V4 期间字幕节奏（第二段：战争破坏了什么）：
   +0.6s  c1 "2026 年 4 月 12 日。"（quiet）  停 3.4s
   +3.0s  c2 "导弹擦过 Tabriz 巴扎的屋顶。"   停 4s
   +7.5s  c3 "一根丝线、一根丝线，倒着退了回去。"
          —— 关键：撞上 V4 末段织机被扯断、第一根线被拉走的画面（约第 7~9s）
          c3 不在 V4 内淡出，让它跨段一直持续到 V5 中段，与"地毯解构"+"逐渐模糊"叠加情绪 */
function _tabrizEnterV4State(){
  if(_tabrizCurState === TABRIZ_VIDEO_STATE.V4) return;
  _tabrizCurState = TABRIZ_VIDEO_STATE.V4;
  _tabrizClearTimers();
  _tabrizClearCaptionTimers();
  _tabrizSubHideAll();
  // 隐藏热区
  if(_tabrizPawHint) _tabrizPawHint.classList.remove('show');
  // 关闭 V3 的 loop（防止重新进入场景时残留状态）
  if(_tabrizV3) _tabrizV3.loop = false;
  _tabrizSwitchToVideo(_tabrizV4);
  // 第二段叙事：3 句铺陈
  _tabrizSubShow('c1', 600,  [TABRIZ_VIDEO_STATE.V4]);
  _tabrizSubHide('c1', 4000);
  _tabrizSubShow('c2', 3000, [TABRIZ_VIDEO_STATE.V4]);
  _tabrizSubHide('c2', 7000);
  // c3 金句：对齐 V4 第 7.5s 的"线头被拉"画面，跨到 V5 才淡出
  _tabrizSubShow('c3', 7500, [TABRIZ_VIDEO_STATE.V4, TABRIZ_VIDEO_STATE.V5]);
  console.log('[tabriz] 进入 V4，启动第二段字幕');
}

/* V4 自然结束 → 进 V5 */
function _tabrizOnV4Ended(){
  if(_tabrizCurState !== TABRIZ_VIDEO_STATE.V4) return;
  _tabrizEnterV5State();
}

/* V4 → V5：unravel 地毯解构收尾（约 14.9s）
   同步：给 V5 video 加 .v5-blur，触发 14s 的 filter 渐变。
   V5 期间字幕节奏（接续 V4 c3 金句）：
   +3s  c3 淡出（让"丝线退回"在 V5 前 3s 持续覆盖解构画面 → 共显约 6s）
   +4s  c4 "他们说，毯子烧了可以再织一块。"（quiet）  停 4s
   +9s  c5 "但织进去的一年零四个月，回不来了。"
        —— 不淡出，跟随视频模糊到黑，最后情绪落点 */
function _tabrizEnterV5State(){
  if(_tabrizCurState === TABRIZ_VIDEO_STATE.V5) return;
  _tabrizCurState = TABRIZ_VIDEO_STATE.V5;
  _tabrizSwitchToVideo(_tabrizV5);
  // 触发逐渐模糊：延 100ms 加 class，确保 transition 起点是清晰帧
  if(_tabrizV5){
    setTimeout(()=>{
      if(_tabrizCurState === TABRIZ_VIDEO_STATE.V5 && _tabrizV5){
        _tabrizV5.classList.add('v5-blur');
      }
    }, 100);
  }
  // 注意：不清空 V4 排的 c3 timer —— c3 设计为跨段持续到 V5 中段
  // 但要清掉 c1/c2 的残余（防御）
  if(_tabrizSubLines){
    if(_tabrizSubLines.c1) _tabrizSubLines.c1.classList.remove('show');
    if(_tabrizSubLines.c2) _tabrizSubLines.c2.classList.remove('show');
  }
  // c3 金句：进入 V5 后再持续 3s，然后淡出
  _tabrizSubHide('c3', 3000);
  // c4：转折 quiet
  _tabrizSubShow('c4', 4000, [TABRIZ_VIDEO_STATE.V5]);
  _tabrizSubHide('c4', 8000);
  // c5：最终落点 —— 不主动 hide，让它和模糊画面一起渐黑
  _tabrizSubShow('c5', 9000, [TABRIZ_VIDEO_STATE.V5]);
  console.log('[tabriz] V4 结束，进入 V5（启动逐渐模糊 + 第二段尾声字幕）');
}

/* V5 自然结束 → 收尾 */
function _tabrizOnV5Ended(){
  if(_tabrizCurState !== TABRIZ_VIDEO_STATE.V5) return;
  _tabrizFinishScene();
}

/* 收尾：黑屏过渡 → 自动回地图 */
function _tabrizFinishScene(){
  if(_tabrizCurState === TABRIZ_VIDEO_STATE.DONE) return;
  _tabrizCurState = TABRIZ_VIDEO_STATE.DONE;
  if(_tabrizFadeout){
    _tabrizFadeout.classList.add('show');
  }
  setTimeout(()=>{
    if(typeof returnToMap === 'function' && _tabrizCurState === TABRIZ_VIDEO_STATE.DONE){
      returnToMap();
    }
  }, 1500);
}

/* 工具：清理定时器 */
function _tabrizClearTimers(){
  if(_tabrizV3Timer){ clearTimeout(_tabrizV3Timer); _tabrizV3Timer = null; }
}
function _tabrizClearCaptionTimers(){
  _tabrizCaptionTimers.forEach(t => clearTimeout(t));
  _tabrizCaptionTimers = [];
}

/* === 字幕调度 ===
   _tabrizSubShow(key, atMs)：在 atMs 毫秒后显示字幕
   _tabrizSubHide(key, atMs)：在 atMs 毫秒后隐藏字幕
   guardState：可选，仅当切换时仍处于该状态/状态数组时才执行（防跨段串台） */
function _tabrizSubShow(key, atMs, guardStates){
  if(!_tabrizSubLines || !_tabrizSubLines[key]) return;
  _tabrizCaptionTimers.push(setTimeout(()=>{
    if(guardStates){
      const arr = Array.isArray(guardStates) ? guardStates : [guardStates];
      if(!arr.includes(_tabrizCurState)) return;
    }
    _tabrizSubLines[key].classList.add('show');
  }, atMs));
}
function _tabrizSubHide(key, atMs){
  if(!_tabrizSubLines || !_tabrizSubLines[key]) return;
  _tabrizCaptionTimers.push(setTimeout(()=>{
    _tabrizSubLines[key].classList.remove('show');
  }, atMs));
}
/* 清空所有字幕（不清 timer，仅立即隐藏） */
function _tabrizSubHideAll(){
  if(!_tabrizSubLines) return;
  Object.values(_tabrizSubLines).forEach(el => el && el.classList.remove('show'));
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
  arBlend = 0;
  camYaw = 0;
  smoothYaw = PANO_YAW_OFFSET;
  smoothPitch = 0;

  // === 判断是否走新管线（场景 1 golestan 实体模型 / 场景 2 tabriz 程序化作坊） ===
  const isGolestan = (coord.modelId === 'golestan');
  const golestanReady = isGolestan && MODELS.golestan.gltfScene;
  const isTabriz = (coord.modelId === 'tabriz');

  // 防御：进入新场景前，清理上一场景的"实体"残留（吊灯/作坊不应跨场景共存）
  if(!isGolestan && MODELS.golestan && MODELS.golestan.frameGroup && MODELS.golestan.frameGroup.parent){
    cleanupChandelierScene();
  }
  if(!isTabriz && MODELS.tabriz && MODELS.tabriz.active){
    cleanupCarpetScene();
  }

  // 新管线统一标记：进入新管线场景（隐藏粒子系统、启用 sceneGroup）
  const newPipelineReady = golestanReady || isTabriz;

  if(golestanReady){
    // 场景 1：吊灯实体
    const ok = enterChandelierScene();
    if(!ok){
      if(coord.modelId && coord.sceneReady) buildSceneTargets(coord.modelId);
      else buildPlaceholderTargets();
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aColor').needsUpdate = true;
    }
  } else if(isTabriz){
    // 场景 2：地毯作坊程序化场景
    enterCarpetScene();
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
    // 根据当前场景设置烧灼方向：tabriz 从地面向上、其他默认从穹顶向下
    if(coord.modelId === 'tabriz'){
      panoBurnSphere.material.uniforms.uBurnDir.value.set(0, -1, 0);
    } else {
      panoBurnSphere.material.uniforms.uBurnDir.value.set(0, 1, 0);
    }
  }

  // 全景图 skybox
  const sceneIdForPano = coord.modelId || coord.id;
  currentPanoId = sceneIdForPano;
  if(coord.panoUrl) loadPanoForScene(sceneIdForPano, coord.panoUrl);
  const panoTex = panoTextures[sceneIdForPano];
  if(coord.panoUrl && panoTex && panoTex !== 'loading'){
    scene.background = panoTex;
    panoDimSphere.visible = true;
    // 新管线场景降低暗化（让全景更亮）
    panoDimSphere.material.opacity = newPipelineReady ? 0.18 : 0.55;
    const sceneBgEl = document.querySelector('.scene-bg');
    if(sceneBgEl) sceneBgEl.style.display = 'none';
    renderer.setClearColor(0x000000, 1);
  } else {
    // 无 panoUrl（如 Tabriz）：靠 DOM 海报图层 .tabriz-bg-layer 充当远景
    scene.background = null;
    panoDimSphere.visible = !coord.modelId;  // Tabriz 不要 dim sphere
    panoDimSphere.material.opacity = newPipelineReady ? 0.18 : 0.55;
    // Tabriz 特别处理：用透明清屏，让底下 DOM 海报背景层透上来
    if(sceneIdForPano === 'tabriz'){
      renderer.setClearColor(0x000000, 0);
    } else {
      renderer.setClearColor(0x000000, 1);
    }
  }
  // 启用反光光点（仅 golestan 场景）
  sparkleGroup.visible = (sceneIdForPano === 'golestan');
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
  } else if(isTabriz){
    // 织机在世界原点附近、用户站在它正前方稍偏低，平视
    // 织机高度 LOOM_H=160，相机距 ~140，正中央平视即可看到织机全貌
    const orbitRadius = 145;
    const orbitY = -10;  // 略低于织机中心，仰视感
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
      // 启用自动慢速旋转
      autoRotateActive = true;
      autoRotateYaw = 0;
      autoRotateSpeed = AUTO_ROTATE_SPEED_BASE;
      _autoRotateBoostStart = 0;
      // 触发提示文案：吊灯="tap to shatter"，地毯="tap to interrupt"
      const hintWord = isTabriz ? 'interrupt' : 'shatter';
      pressHintEl.innerHTML = `tap to ${hintWord} <span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
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
  const wasTabriz = COORDINATES[currentSceneIdx]?.modelId === 'tabriz' && MODELS.tabriz.active;
  if(wasTabriz) cleanupCarpetScene();

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
  // 清理场景 2 地毯作坊（如果活跃）
  const wasTabriz = COORDINATES[currentSceneIdx]?.modelId === 'tabriz' && MODELS.tabriz.active;
  if(wasTabriz) cleanupCarpetScene();


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

// 进入场景后的"自动慢速旋转"：让用户一进来就感知空间可旋转，用户首次操作即停止
let autoRotateActive = false;
let autoRotateYaw = 0;            // 累计的自动旋转角度（弧度），叠加到 camYaw 上
const AUTO_ROTATE_SPEED_BASE = 0.06;  // 进场默认速度（弧度/秒，约 3.4°/秒）
let autoRotateSpeed = AUTO_ROTATE_SPEED_BASE;
// 碎裂加速过冲：起爆瞬间从 base 飙到 peak，1.2s 内回落到 settle
let _autoRotateBoostStart = 0;     // 0 表示无 boost；>0 表示 boost 起始 performance.now()
const AUTO_ROTATE_BOOST_PEAK   = 0.6;  // 峰值（弧度/秒，约 34°/秒，3 倍冲击感）
const AUTO_ROTATE_BOOST_SETTLE = 0.18; // 稳态（弧度/秒，约 10°/秒，3 倍 base）
const AUTO_ROTATE_BOOST_DUR    = 1200; // 过冲持续时间（ms）

/* ===================================================================
 * Tabriz：旧 3D 相机管线已废弃（改为 DOM 视频驱动，无相机控制）
 * =================================================================== */


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
    // 新管线（吊灯/地毯）：不需要长按聚合粒子
    const isGolestanNew = COORDINATES[currentSceneIdx]?.modelId === 'golestan' && MODELS.golestan.frameGroup;
    const isTabrizNew = COORDINATES[currentSceneIdx]?.modelId === 'tabriz' && MODELS.tabriz.active;
    if(!isGolestanNew && !isTabrizNew){
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

  // 场景 2（Tabriz 视频版）：点击不通过 raycaster，直接由 DOM 热区 .tabriz-paw-hint 监听


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
    const motionLevel = Math.max(sparkleMotion, 0.08);

    const targetOp = (mode === MODE.SCENE) ? 1.0 : 0;
    sparkleMat.uniforms.uOpacity.value += (targetOp - sparkleMat.uniforms.uOpacity.value) * 0.06;
    sparkleMat.uniforms.uMotion.value = motionLevel;

    // B 层大颗星芒：opacity 主要由运动驱动 + 视角朝向
    const camDir = new THREE.Vector3();
    for(const spr of flareSprites){
      camDir.copy(spr.position).sub(camera.position).normalize();
      const facing = THREE.MathUtils.clamp(camDir.dot(spr.userData.dir) * 0.5 + 0.5, 0, 1);
      const sharp = Math.pow(facing, 2.0);
      const twinkle = 0.55 + 0.45 * Math.sin(time * 1.4 + spr.userData.seed * 6.28);
      const fast = Math.sin(time * 4.2 + spr.userData.fastSeed * 12.57);
      const flash = Math.pow(Math.max(fast, 0), 6) * motionLevel;
      spr.material.opacity = sharp * (twinkle * 0.6 + flash * 0.8) * motionLevel * targetOp;
      const s = spr.userData.baseScale * (0.9 + sharp * 0.15 + flash * 0.4);
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
      const targetPitch = useGyro ? gyroPitch : 0;

      const lerpSpeed = 0.10;
      smoothYaw   += (targetYaw   - smoothYaw)   * lerpSpeed;
      smoothPitch += (targetPitch - smoothPitch) * lerpSpeed;

      // 判断是否是新管线（吊灯）场景；Tabriz 视频版无 3D 相机
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

  // 场景 2 Tabriz 视频版：每帧无需推进（视频自己播）

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
  // 如果在 golestan 新管线场景，动态调整 FOV（Tabriz 视频版无 3D 相机）
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

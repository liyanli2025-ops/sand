/* ================================================================
 *  《聚不起的沙》· 伊朗 100 天 · 沉浸式星图（AR-like）
 * ================================================================ */

console.log('%c[app-v2.js] 已加载 新文件名版本', 'color:#d4a574;font-weight:bold;font-size:14px');

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

/* ---------- 真实3D模型采样：塞塔尔（Setar，波斯弹拨乐器） ---------- */
const KAMANCHEH_MODEL_URL = './setar__persian_musical_instrument.glb';
let kamanchehSampledPoints = null;  // 采样得到的 [{x,y,z,nx,ny,nz}, ...]
let kamanchehLoading = false;
let kamanchehLoadFailed = false;

function loadKamanchehModel(){
  if(kamanchehSampledPoints || kamanchehLoading || kamanchehLoadFailed) return;
  if(typeof THREE.GLTFLoader === 'undefined' || typeof THREE.MeshSurfaceSampler === 'undefined'){
    console.warn('[setar] GLTFLoader 或 MeshSurfaceSampler 未加载');
    kamanchehLoadFailed = true;
    return;
  }
  kamanchehLoading = true;
  const loader = new THREE.GLTFLoader();
  loader.load(KAMANCHEH_MODEL_URL, (gltf) => {
    try{
      // 1. 收集所有可采样的 mesh（先把世界变换烘焙到 geometry）
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

      // 2. 合并 geometry
      const merged = mergeMeshGeometries(meshes);
      merged.computeBoundingBox();

      // 3. 计算原始 bbox，按"最长边"作为高度归一化（自动适配 X-up / Y-up / Z-up 模型）
      const origSize = new THREE.Vector3();
      const origCenter = new THREE.Vector3();
      merged.boundingBox.getSize(origSize);
      merged.boundingBox.getCenter(origCenter);
      console.log('[setar] 原始模型 bbox.size:', origSize.x.toFixed(3), origSize.y.toFixed(3), origSize.z.toFixed(3));

      // 找最长轴
      const maxAxisLen = Math.max(origSize.x, origSize.y, origSize.z);

      const TARGET_HEIGHT = 95;
      const scale = TARGET_HEIGHT / Math.max(maxAxisLen, 0.0001);

      // 居中 + 缩放
      merged.applyMatrix4(new THREE.Matrix4().makeTranslation(-origCenter.x, -origCenter.y, -origCenter.z));
      merged.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));

      // 如果最长轴不是 Y，旋转把它对齐到 Y 轴
      if(origSize.x === maxAxisLen){
        // X 最长 → 绕 Z 转 90°，让 X 变 Y
        merged.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI/2));
        console.log('[setar] X 是最长轴，旋转使其立起');
      } else if(origSize.z === maxAxisLen){
        // Z 最长 → 绕 X 转 +90°，让 Z 变 Y（琴头朝上、琴箱朝下）
        merged.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2));
        console.log('[setar] Z 是最长轴，旋转使其立起');
      } else {
        console.log('[setar] Y 是最长轴，无需旋转');
      }
      merged.computeBoundingBox();
      merged.computeVertexNormals();

      const finalSize = new THREE.Vector3();
      const finalCenter = new THREE.Vector3();
      merged.boundingBox.getSize(finalSize);
      merged.boundingBox.getCenter(finalCenter);
      console.log('[setar] 归一化后 size:', finalSize.x.toFixed(2), finalSize.y.toFixed(2), finalSize.z.toFixed(2));
      console.log('[setar] 归一化后 center:', finalCenter.x.toFixed(2), finalCenter.y.toFixed(2), finalCenter.z.toFixed(2));

      const size = finalSize;

      // 4. 用 MeshSurfaceSampler 表面采样
      const tmpMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
      const sampler = new THREE.MeshSurfaceSampler(tmpMesh).build();
      const SAMPLE_N = COUNT;

      // 4 倍超采样 + 智能加权（让琴箱明显加密、琴颈清爽）
      // 池越大，权重分布越准确，琴箱粒子更丰富不重复
      const OVER_N = Math.floor(SAMPLE_N * 4);
      const candP = new Float32Array(OVER_N * 3);
      const candN = new Float32Array(OVER_N * 3);
      const candWeight = new Float32Array(OVER_N);
      const _tmpP = new THREE.Vector3();
      const _tmpN = new THREE.Vector3();

      // 计算模型 bbox 用于判断"细节区"
      merged.boundingBox.getSize(size);
      const bx = size.x * 0.5, by = size.y * 0.5, bz = size.z * 0.5;

      for(let i=0; i<OVER_N; i++){
        sampler.sample(_tmpP, _tmpN);
        candP[i*3]   = _tmpP.x;
        candP[i*3+1] = _tmpP.y;
        candP[i*3+2] = _tmpP.z;
        candN[i*3]   = _tmpN.x;
        candN[i*3+1] = _tmpN.y;
        candN[i*3+2] = _tmpN.z;

        // —— 按高度划分区域：琴箱明显加密，琴颈适度稀疏 —— 
        // 塞塔尔结构：琴箱下 35%、琴颈中 50%、琴头上 15%
        // 琴箱表面积大、是视觉主体；琴颈细长，粒子少一点反而更清爽
        const yRel = (_tmpP.y + by) / (2*by);  // 0~1
        let weight = 1.0;
        if(yRel < 0.35){
          // 琴箱：重点加密 ×3.0
          weight = 3.0;
        } else if(yRel < 0.85){
          // 琴颈：减少粒子，让琴颈线条更细更清爽
          weight = 0.7;
        } else {
          // 琴头：略加密
          weight = 1.4;
        }
        candWeight[i] = weight;
      }

      // 按权重抽样
      const totalW = candWeight.reduce((a,b)=>a+b, 0);
      const points = new Float32Array(SAMPLE_N * 3);
      const normals = new Float32Array(SAMPLE_N * 3);
      const cumW = new Float32Array(OVER_N);
      let acc = 0;
      for(let i=0; i<OVER_N; i++){ acc += candWeight[i]; cumW[i] = acc; }
      for(let i=0; i<SAMPLE_N; i++){
        const r = Math.random() * totalW;
        let lo = 0, hi = OVER_N - 1;
        while(lo < hi){
          const mid = (lo + hi) >> 1;
          if(cumW[mid] < r) lo = mid + 1;
          else hi = mid;
        }
        points[i*3]   = candP[lo*3];
        points[i*3+1] = candP[lo*3+1];
        points[i*3+2] = candP[lo*3+2];
        normals[i*3]   = candN[lo*3];
        normals[i*3+1] = candN[lo*3+1];
        normals[i*3+2] = candN[lo*3+2];
      }

      // —— 让琴整体倾斜：绕 Z 轴 +12°（适度倾斜，靠在木架上） ——
      const TILT_RAD = 12 * Math.PI / 180;
      const cosT = Math.cos(TILT_RAD);
      const sinT = Math.sin(TILT_RAD);
      for(let i=0; i<SAMPLE_N; i++){
        const x = points[i*3], y = points[i*3+1];
        points[i*3]   = x * cosT - y * sinT;
        points[i*3+1] = x * sinT + y * cosT;
        const nx = normals[i*3], ny = normals[i*3+1];
        normals[i*3]   = nx * cosT - ny * sinT;
        normals[i*3+1] = nx * sinT + ny * cosT;
      }

      kamanchehSampledPoints = { points, normals, bbox: merged.boundingBox.clone() };
      kamanchehLoading = false;

      // 重新根据采样点的实际范围更新 bbox（已倾斜）
      {
        let mnX=Infinity, mxX=-Infinity, mnY=Infinity, mxY=-Infinity, mnZ=Infinity, mxZ=-Infinity;
        for(let _i=0; _i<SAMPLE_N; _i++){
          const x = points[_i*3], y = points[_i*3+1], z = points[_i*3+2];
          if(x<mnX) mnX=x; if(x>mxX) mxX=x;
          if(y<mnY) mnY=y; if(y>mxY) mxY=y;
          if(z<mnZ) mnZ=z; if(z>mxZ) mxZ=z;
        }
        kamanchehSampledPoints.bbox = new THREE.Box3(
          new THREE.Vector3(mnX, mnY, mnZ),
          new THREE.Vector3(mxX, mxY, mxZ)
        );
      }

      // 关键诊断：打印归一化后的 bbox 和首批采样点位置
      const _bb = merged.boundingBox;
      console.log('[setar] 模型加载成功');
      console.log('  bbox.min:', _bb.min.x.toFixed(2), _bb.min.y.toFixed(2), _bb.min.z.toFixed(2));
      console.log('  bbox.max:', _bb.max.x.toFixed(2), _bb.max.y.toFixed(2), _bb.max.z.toFixed(2));
      console.log('  采样点数:', SAMPLE_N);
      console.log('  前3个采样点：');
      for(let _i=0; _i<3; _i++){
        console.log('    p['+_i+']:', points[_i*3].toFixed(2), points[_i*3+1].toFixed(2), points[_i*3+2].toFixed(2));
      }
      // 计算所有采样点的实际 bbox 验证
      let _minX=Infinity, _maxX=-Infinity, _minY=Infinity, _maxY=-Infinity, _minZ=Infinity, _maxZ=-Infinity;
      for(let _i=0; _i<SAMPLE_N; _i++){
        if(points[_i*3] < _minX) _minX = points[_i*3];
        if(points[_i*3] > _maxX) _maxX = points[_i*3];
        if(points[_i*3+1] < _minY) _minY = points[_i*3+1];
        if(points[_i*3+1] > _maxY) _maxY = points[_i*3+1];
        if(points[_i*3+2] < _minZ) _minZ = points[_i*3+2];
        if(points[_i*3+2] > _maxZ) _maxZ = points[_i*3+2];
      }
      console.log('  采样点实际范围 X:', _minX.toFixed(2), '~', _maxX.toFixed(2),
                  'Y:', _minY.toFixed(2), '~', _maxY.toFixed(2),
                  'Z:', _minZ.toFixed(2), '~', _maxZ.toFixed(2));

      // 隐藏加载提示
      const _loadingEl = document.getElementById('modelLoading');
      if(_loadingEl) _loadingEl.classList.remove('show');

      // 如果当前正在德黑兰场景，立即重建 targets + 调整相机距离
      // 如果当前正在德黑兰场景（含进入过渡中），立即重建 targets + 调整相机距离
      const _inTehran = (typeof mode !== 'undefined') &&
                        (mode === MODE.SCENE || mode === MODE.TRANSITION) &&
                        COORDINATES[currentSceneIdx] && COORDINATES[currentSceneIdx].id === 'tehran';
      if(_inTehran){
        console.log('[setar] 当前正在德黑兰场景，用真模型重建 targets');
        buildKamanchehTargets();
        geometry.getAttribute('aSize').needsUpdate = true;
        geometry.getAttribute('aColor').needsUpdate = true;
        // 模型真实尺寸现在已知，重新 tween 到最佳相机距离
        if(!tween){
          const newCam = computeSceneCamera();
          tweenCamera(
            { x:camera.position.x, y:camera.position.y, z:camera.position.z,
              tx:cameraTarget.x, ty:cameraTarget.y, tz:cameraTarget.z },
            { x:0, y:newCam.y, z:newCam.z, tx:0, ty:0, tz:0 },
            1200, easeInOutCubic, null
          );
          console.log('[setar] 已根据真实模型尺寸调整相机距离到 z='+newCam.z.toFixed(1));
        }
      }
    }catch(err){
      console.error('[setar] 模型处理失败，回退手写几何', err);
      kamanchehLoadFailed = true;
      kamanchehLoading = false;
    }
  }, (xhr) => {
    // 下载进度（GLTFLoader 第二参数）
    if(xhr.lengthComputable){
      const pct = Math.round(xhr.loaded / xhr.total * 100);
      // 限速：每 10% 打一次，避免日志洪水
      if(pct % 10 === 0 && pct !== window.__setarLastPct){
        window.__setarLastPct = pct;
        console.log('[setar] 下载中 '+pct+'% ('+(xhr.loaded/1024/1024).toFixed(1)+'MB / '+(xhr.total/1024/1024).toFixed(1)+'MB)');
      }
    }
  }, (err) => {
    console.error('[setar] 模型加载失败，回退手写几何', err);
    kamanchehLoadFailed = true;
    kamanchehLoading = false;
  });
}

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
loadKamanchehModel();

/* ---------- 渲染器 ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070d, 0.0035);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 3000);
// 地图模式：相机在上方偏前，俯视朝向地图中心
const MAP_CAM_DEFAULT = { x:0, y:70, z:180 };
camera.position.set(MAP_CAM_DEFAULT.x, MAP_CAM_DEFAULT.y, MAP_CAM_DEFAULT.z);
camera.lookAt(0, 0, 0);

/* ---------- 贴图 ---------- */
/* ---------- 贴图（沙粒：暗中心 + 软边，不再是发光圆点） ---------- */
function makeSpriteTexture(){
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  // 软圆 alpha 蒙版（白色 = 用本色，alpha 衰减到边缘）
  // 这样片段着色器里 col = vColor * lighting * tc.a，能保留暗面
  const grd = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grd.addColorStop(0.35,'rgba(255,255,255,0.85)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.30)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const spriteTex = makeSpriteTexture();

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
    id: 'tehran', name: 'TEHRAN', zh:'德黑兰',
    lon: 51.40, lat: 35.70, day: 58,
    subtitle: 'WORKSHOP NO.07',
    subtitleRight: 'SETAR',
    subtitleRight2: 'سه‌تار',
    sceneReady: true,
    story: {
      coord: 'TEHRAN · 35.70°N / 51.40°E',
      day: 'day 58',
      lines: [
        { text: '德黑兰城南一间不到十平米的作坊里，', quiet:false },
        { text: '有一把塞塔尔琴，制作到第 80%。', quiet:false },
        { text: '匠人做了三十年这件事，他的父亲也是。', quiet:false },
        { text: '第 58 天，屋顶塌了。琴颈还在木架上。', quiet:true },
        { text: '四根弦，从细到粗，依次崩断。', quiet:true },
      ]
    }
  },
  { id:'isfahan', name:'ISFAHAN', zh:'伊斯法罕', lon:51.67, lat:32.65, day:8,
    subtitle:'SHEIKH LOTFOLLAH', subtitleRight:'THE DOME', subtitleRight2:'گنبد', sceneReady:false },
  { id:'shiraz', name:'SHIRAZ', zh:'设拉子', lon:52.58, lat:29.61, day:34,
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
const shatterLife = new Float32Array(COUNT);
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
    // 强方向光：从左上 45° 打来（与参考图一致）
    uLightDir:{value:new THREE.Vector3(-0.55, 0.78, 0.30).normalize()},
    uLightColor:{value:new THREE.Color(1.0, 0.92, 0.78)}, // 暖白光
    uShadowColor:{value:new THREE.Color(0.05, 0.04, 0.03)}, // 暗面接近黑
    uAmbient:{value:0.08},   // 环境光极弱（让背光面真黑）
    uLightMix:{value:0.0},   // 0=地图均匀光、1=场景方向光（沙雕态）
    uWobble:{value:1.0},
    uSculpt:{value:0.0},     // 0=粒子飘动态、1=沙雕态（影响混合模式行为）
  },
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aSeed;
    attribute vec3 aNormal;
    uniform float uPixelRatio, uTime, uSizeMul, uWobble;
    uniform vec3 uLightDir;
    varying vec3 vColor;
    varying float vLight;
    varying float vNDotL;
    void main(){
      vColor = aColor;
      vec3 pos = position;
      float wob = 0.35 * uWobble;
      pos.x += sin(uTime*0.7 + aSeed*30.0) * wob;
      pos.y += cos(uTime*0.6 + aSeed*20.0) * wob * 0.7;
      pos.z += sin(uTime*0.8 + aSeed*40.0) * wob;
      // —— 用真法线（aNormal）做 Lambert，比"位置-原点"准确百倍 ——
      // 没有法线（length<0.01，比如氛围粒子）时降级用位置法线
      vec3 nrm = aNormal;
      if(length(nrm) < 0.1){
        nrm = normalize(pos - vec3(0.0, -10.0, 0.0));
      }
      vNDotL = dot(normalize(nrm), normalize(uLightDir));
      vLight = vNDotL * 0.5 + 0.5;
      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * uSizeMul * 140.0 / -mvPos.z * uPixelRatio;
      gl_Position = projectionMatrix * mvPos;
    }`,
  fragmentShader: `
    uniform sampler2D uTex;
    uniform float uBrightness, uAmbient, uLightMix, uSculpt;
    uniform vec3 uLightColor, uShadowColor;
    varying vec3 vColor;
    varying float vLight;
    varying float vNDotL;
    void main(){
      vec4 tc = texture2D(uTex, gl_PointCoord);
      if(tc.a < 0.01) discard;

      // —— Lambert：背光面真的是黑（不是只是变暗） ——
      // ndotl 范围 -1~+1：负值代表背光，钳到 0 = 完全黑
      float lambert = max(vNDotL, 0.0);
      // 用 smoothstep 让明暗过渡更"硬"（沙雕的强对比感）
      float lit = smoothstep(0.0, 0.6, lambert);

      // 沙雕态（uSculpt=1）：暗面 = 阴影色（极暗），亮面 = 暖光照射的本色
      vec3 sandShadow = vColor * uShadowColor * 6.0; // 阴影区颜色（保留一点本色）
      vec3 sandLit    = vColor * uLightColor * (uAmbient + lit * 1.3);
      vec3 sculptCol  = mix(sandShadow, sandLit, lit);

      // 地图态（uSculpt=0）：保留原来的亮粒子风格
      vec3 mapCol = vColor * (0.5 + lit * 0.8) * uBrightness;
      // 给地图态加一点暖光晕，保持原氛围
      mapCol = mix(mapCol, mapCol * uLightColor * 1.2, lit * 0.4);

      vec3 col = mix(mapCol, sculptCol, uSculpt);

      // alpha：沙雕态满 alpha（实体感）；飘动态半透明（云雾感）
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
  const PILLAR_EACH = Math.floor(COUNT * 0.045);   // 每光柱 4.5%
  const PILLAR_TOTAL = PILLAR_EACH * 4;
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
  for(let c=0; c<4; c++){
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
  const Y_OFFSET = 0;
  const N = Math.min(COUNT, points.length / 3);

  for(let i=0; i<N; i++){
    targets[i*3]   = points[i*3];
    targets[i*3+1] = points[i*3+1] + Y_OFFSET;
    targets[i*3+2] = points[i*3+2];

    const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2];
    const yNorm = (points[i*3+1] - 0) / 65; // -1 ~ +1，按高度划分区域

    // —— 把真实表面法线写入粒子 attribute（让 shader 做精确 Lambert 光照） ——
    partNormals[i*3]   = nx;
    partNormals[i*3+1] = ny;
    partNormals[i*3+2] = nz;

    // —— 角色分配（沿用原叙事钩子：roles[i]=1~4 是四根弦） ——
    const r2 = points[i*3]*points[i*3] + points[i*3+2]*points[i*3+2];
    const isStringRegion = (yNorm > -0.1 && yNorm < 0.7 && r2 < 6);
    if(isStringRegion){
      const sIdx = Math.max(0, Math.min(3, Math.floor((points[i*3] + 2) / 1)));
      roles[i] = sIdx + 1;
    } else if(yNorm > 0.7){
      roles[i] = 5; // 琴头/弦轴区
    } else {
      roles[i] = 0; // 琴体
    }

    // —— 颜色：统一的米黄沙土底色（不在 CPU 端做光照，光照交给 shader） ——
    // 参考：沙雕用湿沙，颜色范围 #b89968 ~ #d4b388
    // 加入轻微的颗粒色彩抖动 + 高度色温变化（底部偏深，顶部偏亮）
    const isCoarseGrain = Math.random() < 0.18;
    const grainNoise = 0.88 + Math.random() * 0.20;       // 颗粒间微差异
    const heightTint = 0.92 + (yNorm + 1) * 0.04;          // 越高越亮一点（被光照射更多）

    const isMetal = isStringRegion || roles[i] === 5;
    if(isMetal){
      // 弦/琴头：略浅一点的沙土色，融入整体
      const base = grainNoise * heightTint;
      colors[i*3]   = 0.86 * base;  // R
      colors[i*3+1] = 0.74 * base;  // G
      colors[i*3+2] = 0.55 * base;  // B
      sizes[i] = isCoarseGrain ? 0.20 + Math.random() * 0.10 : 0.10 + Math.random() * 0.08;
    } else {
      // 琴体：暖沙色（米黄 #c9a978 偏移）
      const base = grainNoise * heightTint;
      colors[i*3]   = 0.82 * base;  // R
      colors[i*3+1] = 0.68 * base;  // G
      colors[i*3+2] = 0.48 * base;  // B
      sizes[i] = isCoarseGrain ? 0.28 + Math.random() * 0.16 : 0.13 + Math.random() * 0.14;
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

/* ---------- 初始化 ---------- */
for(let i=0; i<COUNT; i++){
  seeds[i] = Math.random();
  positions[i*3] = (Math.random()-0.5) * 500;
  positions[i*3+1] = (Math.random()-0.5) * 400;
  positions[i*3+2] = (Math.random()-0.5) * 300 - 30;
}
buildScatteredPositions();
buildMapTargets();

/* ================================================================
 *  状态管理
 * ================================================================ */
const MODE = { MAP:'map', TRANSITION:'transition', SCENE:'scene' };
let mode = MODE.MAP;
let currentSceneIdx = -1;
let unlockedIdx = 0;
const progress = [false,false,false,false];

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
  let src = '默认';
  if(kamanchehSampledPoints){
    const b = kamanchehSampledPoints.bbox;
    const s = new THREE.Vector3();
    b.getSize(s);
    objH = s.y;
    objW = Math.max(s.x, s.z);
    src = '真模型';
  }

  const safetyMul = 2.0;  // 合理距离，让琴占画面约一半高度
  const distH = (objH * 0.5) / Math.tan(fovRad / 2);
  const distW = (objW * 0.5) / Math.tan(fovRad / 2) / Math.max(aspect, 0.01);
  const z = Math.max(distH, distW) * safetyMul;
  const finalZ = Math.max(180, Math.min(500, z));
  return { y: 0, z: finalZ };
}

function enterScene(idx){
  mode = MODE.TRANSITION;
  enteringScene = true; // 进入场景过渡中
  currentSceneIdx = idx;
  const coord = COORDINATES[idx];
  sceneFormed = false; // 重置琴的成形状态

  if(coord.id === 'tehran') buildKamanchehTargets();
  else buildPlaceholderTargets();
  geometry.getAttribute('aSize').needsUpdate = true;
  geometry.getAttribute('aColor').needsUpdate = true;

  // 显示加载状态（仅当进入德黑兰且模型还没就绪时）
  if(modelLoadingEl){
    if(coord.id === 'tehran' && !kamanchehSampledPoints && !kamanchehLoadFailed){
      modelLoadingEl.classList.add('show');
    } else {
      modelLoadingEl.classList.remove('show');
    }
  }

  // 生成地面散落位置（沙粒落在地上的初始态）
  buildSceneGroundPositions();

  // 【关键修复】立即把粒子位置设为地面散落态，避免过渡期间闪现琴的形态
  for(let i=0; i<COUNT; i++){
    positions[i*3]   = scatteredPos[i*3];
    positions[i*3+1] = scatteredPos[i*3+1];
    positions[i*3+2] = scatteredPos[i*3+2];
    velocities[i*3] = 0;
    velocities[i*3+1] = 0;
    velocities[i*3+2] = 0;
  }
  posAttr.needsUpdate = true;

  sceneArchiveL.innerHTML = `FIELD · <b>${coord.name}</b><br>${coord.subtitle}<br>DAY <b>${String(coord.day).padStart(3,'0')}</b> / 100`;
  sceneArchiveR.innerHTML = `<em>${coord.subtitleRight}</em><br>${coord.subtitleRight2}<br>coord · ${coord.lat.toFixed(2)}°N`;

  body.classList.remove('map-mode');
  body.classList.add('scene-mode');
  nextHint.classList.remove('show');
  storyEl.classList.remove('show');

  // 场景里相机居中朝琴体
  // 根据屏幕宽高比动态计算相机距离，确保整把琴（高度~130）始终入镜
  // 加上 1.4x 安全边距防止边缘被切
  const sceneCamSetup = computeSceneCamera();
  tweenCamera(
    { x:camera.position.x, y:camera.position.y, z:camera.position.z,
      tx:cameraTarget.x, ty:cameraTarget.y, tz:cameraTarget.z },
    { x:0, y:sceneCamSetup.y, z:sceneCamSetup.z,
      tx:0, ty:0, tz:0 },
    1800, easeInOutCubic,
    () => {
      mode = MODE.SCENE;
      enteringScene = false;
      sceneState = SCENE_STATE.IDLE;

      if(coord.sceneReady){
        storyEl.querySelector('.story-card-inner').innerHTML = buildStoryHTML(coord.story, coord);
        placeholderEl.classList.remove('show');
        setTimeout(()=>{
          if(mode===MODE.SCENE && sceneState===SCENE_STATE.IDLE) pressHintEl.classList.add('show');
        }, 1200);
      } else {
        phTitle.textContent = coord.zh;
        phEn.textContent = `${coord.name.toLowerCase()} · day ${coord.day} · coming soon`;
        placeholderEl.classList.add('show');
        pressHintEl.classList.remove('show');
        setTimeout(()=>{ if(mode===MODE.SCENE) nextHint.classList.add('show'); }, 2800);
      }
    }
  );
}

/* 为场景生成地面散落位置（扁平、贴地的沙粒分布） */
function buildSceneGroundPositions(){
  for(let i=0; i<COUNT; i++){
    // 扁平散布在地面（Y 在 -55 ~ -45 之间，XZ 范围较大）
    scatteredPos[i*3]   = (Math.random()-0.5) * 160;
    scatteredPos[i*3+1] = -50 + (Math.random()-0.5) * 6;
    scatteredPos[i*3+2] = (Math.random()-0.5) * 100 - 20;
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
  mode = MODE.TRANSITION;
  sceneState = SCENE_STATE.IDLE;
  sceneFormed = false;
  enteringScene = false;
  pressHintEl.classList.remove('show');
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

// 陀螺仪
let useGyro = false;
let gyroYaw = 0;
let gyroYawOffset = null;

/* ---------- 场景内交互 ---------- */
function sceneStartPress(){
  if(!COORDINATES[currentSceneIdx]?.sceneReady) return;
  // 只有空闲状态（粒子已经散落地面）才能重新开始长按
  if(sceneState !== SCENE_STATE.IDLE) return;

  // 关键：开始聚合前，如果是德黑兰场景且 GLB 已就绪、但当前 targets 还是程序化版，重建
  if(COORDINATES[currentSceneIdx]?.id === 'tehran' && kamanchehSampledPoints && !window.__targetsFromModel){
    console.log('[setar] sceneStartPress 触发 targets 升级到真模型');
    buildKamanchehTargets();
    geometry.getAttribute('aSize').needsUpdate = true;
    geometry.getAttribute('aColor').needsUpdate = true;
  }

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

    // 3.5 秒后回到散落静止态，重新提示长按（给粒子充足时间慢慢落下）
    setTimeout(()=>{
      if(sceneState === SCENE_STATE.RELEASING){
        sceneState = SCENE_STATE.IDLE;
        if(mode === MODE.SCENE){
          pressHintEl.classList.add('show');
        }
      }
    }, 3500);
  }
}

/* ---------- 指针事件（地图 & 场景都用拖拽转视角） ---------- */
canvas.addEventListener('pointerdown', (e)=>{
  if(tween) return;
  try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
  e.preventDefault();
  dragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragStartYaw = camYaw;

  if(mode === MODE.SCENE){
    pointerActive = true;
    pressPointerStartX = e.clientX; pressPointerStartY = e.clientY;
    sceneStartPress();
  }
});
window.addEventListener('pointermove', (e)=>{
  if(!dragging) return;
  const dx = e.clientX - dragStartX;

  if(mode === MODE.SCENE && sceneState === SCENE_STATE.GATHERING){
    const moved = Math.hypot(e.clientX - pressPointerStartX, e.clientY - pressPointerStartY);
    if(moved > 10){
      sceneState = SCENE_STATE.IDLE;
      pressProgress = 0;
      pressFill.style.transform = 'translateX(-100%)';
    }
  }

  // 仅水平旋转（去掉 pitch）
  camYaw = dragStartYaw + dx * 0.004;
});
window.addEventListener('pointerup', (e)=>{
  const wasDragging = dragging;
  const totalMove = wasDragging ? Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) : 0;
  dragging = false;
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
  // 调试：按 1/2/3 绕 X/Y/Z 轴旋转 90°，观察哪个方向才是"琴站立"
  if(kamanchehSampledPoints && (e.code==='Digit1' || e.code==='Digit2' || e.code==='Digit3')){
    const pts = kamanchehSampledPoints.points;
    const nrm = kamanchehSampledPoints.normals;
    const N = pts.length / 3;
    for(let i=0; i<N; i++){
      let x=pts[i*3], y=pts[i*3+1], z=pts[i*3+2];
      let nx=nrm[i*3], ny=nrm[i*3+1], nz=nrm[i*3+2];
      if(e.code==='Digit1'){ // 绕 X 轴 90°
        pts[i*3+1] = -z; pts[i*3+2] = y;
        nrm[i*3+1] = -nz; nrm[i*3+2] = ny;
      } else if(e.code==='Digit2'){ // 绕 Y 轴 90°
        pts[i*3] = z; pts[i*3+2] = -x;
        nrm[i*3] = nz; nrm[i*3+2] = -nx;
      } else if(e.code==='Digit3'){ // 绕 Z 轴 90°
        pts[i*3] = -y; pts[i*3+1] = x;
        nrm[i*3] = -ny; nrm[i*3+1] = nx;
      }
    }
    console.log('[debug] 已旋转 90°（轴='+e.code+'），重新 build');
    if(mode === MODE.SCENE && COORDINATES[currentSceneIdx]?.id === 'tehran'){
      buildKamanchehTargets();
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
  const a = e.alpha;
  if(gyroYawOffset === null) gyroYawOffset = a;
  let yaw = (a - gyroYawOffset) * Math.PI / 180;
  while(yaw > Math.PI) yaw -= 2*Math.PI;
  while(yaw < -Math.PI) yaw += 2*Math.PI;
  gyroYaw = -yaw;
}
setupGyro();

createCoordLabels();

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

  updateTween(now);

  // 方向光混合
  const targetLightMix = (mode === MODE.SCENE || mode === MODE.TRANSITION) ? 1 : 0.4;
  particleMaterial.uniforms.uLightMix.value += (targetLightMix - particleMaterial.uniforms.uLightMix.value) * 0.04;
  ambMat.uniforms.uLightMix.value += (targetLightMix - ambMat.uniforms.uLightMix.value) * 0.04;

  // —— 沙雕模式切换：成形态启用 Lambert 阴影 + Normal Blending（粒子互相遮挡，做出实体感） ——
  // 飘动/聚合/散落态：保持 Additive Blending（云雾发光感）
  const wantSculpt = (mode === MODE.SCENE) &&
                     (sceneState === SCENE_STATE.HELD || sceneState === SCENE_STATE.FORMED);
  const targetSculpt = wantSculpt ? 1.0 : 0.0;
  particleMaterial.uniforms.uSculpt.value += (targetSculpt - particleMaterial.uniforms.uSculpt.value) * 0.06;
  // 当 uSculpt 越过 0.5，切换混合模式（避免每帧切，加滞回）
  const sculptVal = particleMaterial.uniforms.uSculpt.value;
  const wantBlend = sculptVal > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
  if(particleMaterial.blending !== wantBlend){
    particleMaterial.blending = wantBlend;
    particleMaterial.depthWrite = (wantBlend === THREE.NormalBlending); // 沙雕态开 depthWrite，让前后粒子真遮挡
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

      // 使用陀螺仪 or 拖拽的 yaw（pitch 固定）
      const yaw = useGyro ? gyroYaw : camYaw;
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
      // 场景模式下：相机绕物体做小幅轨道（动态计算距离以适配各屏幕）
      const sc = computeSceneCamera();
      const yaw = useGyro ? gyroYaw * 0.6 : camYaw * 0.6;
      const rad = isMobile ? 35 : 25;
      camera.position.x = 0 + Math.sin(yaw) * rad;
      camera.position.y = sc.y;
      camera.position.z = sc.z + (Math.cos(yaw)-1) * rad;
      camera.lookAt(0, 0, 0);
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
    // 正在进入场景过渡：粒子保持静止在地面，不施加任何力
    gathering = false;
    gatherForce = 0;
    scatterForce = 0;
    damping = 0.5; // 强阻尼让粒子快速静止
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
      // RELEASING：粒子真重力下落（不再被 target 拉回，纯自由落体 + 风阻）
      gathering = false;
      gatherForce = 0;
      scatterForce = 0;  // 不再用力把粒子拉到 scatteredPos，让它们自由下落
      damping = 0.985;   // 高阻尼模拟空气阻力
    }
  }

  const targetBrightness = (mode === MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED)) ? 1.05 :
                           (gathering ? 0.70 + pressProgress*0.30 : 0.65);
  particleMaterial.uniforms.uBrightness.value += (targetBrightness - particleMaterial.uniforms.uBrightness.value) * 0.08;

  const targetSize = (mode===MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED)) ? 0.40 :
                     (mode===MODE.MAP ? 0.7 : 0.75);
  particleMaterial.uniforms.uSizeMul.value += (targetSize - particleMaterial.uniforms.uSizeMul.value) * 0.06;

  // 抖动控制：成形态时极弱（显细节），其他时候保持流沙飘动
  const targetWobble = (mode===MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED)) ? 0.05 : 1.0;
  particleMaterial.uniforms.uWobble.value += (targetWobble - particleMaterial.uniforms.uWobble.value) * 0.05;

  // —— 粒子积分 ——
  for(let i=0; i<COUNT; i++){
    const i3 = i*3;
    if(shatterLife[i] > 0){
      velocities[i3] *= 0.985;
      velocities[i3+1] *= 0.99;
      velocities[i3+1] -= 0.035;
      velocities[i3+2] *= 0.985;
      positions[i3] += velocities[i3] * dt;
      positions[i3+1] += velocities[i3+1] * dt;
      positions[i3+2] += velocities[i3+2] * dt;
      shatterLife[i] -= 0.0045 * dt;
      const groundY = scatteredPos[i3+1];
      if(positions[i3+1] < groundY){
        positions[i3+1] = groundY;
        velocities[i3+1] *= -0.15;
        velocities[i3] *= 0.6; velocities[i3+2] *= 0.6;
      }
      if(shatterLife[i] <= 0){
        shatterLife[i] = 0;
        scatteredPos[i3] = (Math.random()-0.5)*280;
        scatteredPos[i3+1] = -10 - Math.pow(Math.random(),1.8)*80 + (Math.random()-0.5)*20;
        scatteredPos[i3+2] = (Math.random()-0.5)*140 - 20;
        velocities[i3]=0; velocities[i3+1]=0; velocities[i3+2]=0;
      }
      continue;
    }

    // 进入场景过渡中：粒子保持静止，不做任何积分
    if(enteringScene){
      velocities[i3] = 0;
      velocities[i3+1] = 0;
      velocities[i3+2] = 0;
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
      // HELD / FORMED 态弦振动
      if(mode===MODE.SCENE && (sceneState===SCENE_STATE.HELD || sceneState===SCENE_STATE.FORMED) && roles[i]>=1 && roles[i]<=4){
        const r = roles[i];
        const amp = 0.4 + r*0.15;
        tx_ += Math.sin(time*8 + r*1.3 + ty_*0.08) * amp;
        tz_ += Math.cos(time*8 + r*1.3 + ty_*0.08) * amp * 0.6;
      }
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

    /* —— 噪声扰动（已不需要这么强） —— */
    const n = gathering ? 0.03 : 0.08;
    velocities[i3]   += (Math.random()-0.5)*n;
    velocities[i3+1] += (Math.random()-0.5)*n;
    velocities[i3+2] += (Math.random()-0.5)*n;

    if(mode===MODE.SCENE && !gathering && sceneState===SCENE_STATE.RELEASING){
      /* —— 散落阶段：每个粒子有自己的下落速度（细沙慢，粗沙快） —— */
      // sizes[i] 范围大约 0.18~1.10，用它作为重力系数
      const grav = 0.06 + (sizes[i] || 0.4) * 0.18;  // 细沙 0.09 ~ 粗沙 0.26
      velocities[i3+1] -= grav * slowness;
      // 横向飘移：慢沙粒飘得多
      const driftStr = (1 - slowness*0.6) * 0.06;
      velocities[i3]   += Math.sin(time*0.5 + sd*40) * driftStr + (Math.random()-0.5)*0.03;
      velocities[i3+2] += Math.cos(time*0.4 + sd*45) * driftStr + (Math.random()-0.5)*0.03;
    }

    positions[i3]   += velocities[i3] * dt;
    positions[i3+1] += velocities[i3+1] * dt;
    positions[i3+2] += velocities[i3+2] * dt;

    /* —— 落地处理：扬起尘埃 —— */
    if(mode===MODE.SCENE && sceneState===SCENE_STATE.RELEASING){
      const groundY = scatteredPos[i3+1];
      if(positions[i3+1] < groundY){
        const impactSpeed = -velocities[i3+1];  // 落地前的下落速度
        positions[i3+1] = groundY + (Math.random()-0.5)*0.5;

        // 高速撞击 → 反弹起一阵尘（少量粒子向上飞）
        if(impactSpeed > 0.6 && Math.random() < 0.10){
          velocities[i3+1] = impactSpeed * 0.55;  // 反向弹起
          velocities[i3]   += (Math.random()-0.5) * 0.6;
          velocities[i3+2] += (Math.random()-0.5) * 0.6;
        } else {
          // 普通落地：吸收能量
          velocities[i3+1] *= -0.08;
          velocities[i3]   *= 0.4;
          velocities[i3+2] *= 0.4;
        }
      }
    }
  }

  posAttr.needsUpdate = true;

  if(mode !== MODE.MAP){
    points.rotation.y += (0 - points.rotation.y) * 0.03;
  } else {
    points.rotation.y = 0;
  }

  updateLabelPositions();
  if(mode === MODE.SCENE || enteringScene) drawMiniSandbox();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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
  if(sceneFormed && COORDINATES[currentSceneIdx]?.id === 'tehran'){
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

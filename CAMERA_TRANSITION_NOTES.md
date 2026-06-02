# 子场景 → 玫瑰宫 相机过渡修复笔记

> 2026-05-30
> 涉及文件：`app.js`（lerp 主循环分支）、`directory.js`（lerp 启动 / onComplete）

## 一、需求

用户点子场景关闭按钮 → 火焰灼烧 3s → 回到玫瑰宫。

**期望**：从子场景**当前视角**直接灼烧到玫瑰宫**常态视角**，中间不要有任何额外的视角切换或绕路。

**不要**：
- 不要在过渡前后瞬间跳一下视角（"猛一仰头/低头/转向"）
- 不要在过渡过程中绕去仰视球壳顶部再绕下来
- 不要先把 pitch 强制归零再开始过渡

## 二、踩过的所有坑（按时序）

### 坑 1：用 yaw/pitch **重新构造**lerp 起点

**做法**：lerp 起点 = `(球心 0,0,0)`，看 `(-sin(smoothYaw)·100·cos(smoothPitch), sin(smoothPitch)·100, -cos(smoothYaw)·100·cos(smoothPitch))`。

**问题**：
- 子场景里相机的真实朝向受多个变量耦合：`smoothYaw + PANO_YAW_OFFSET + autoRotateYaw + gyroYaw + dragPitch ...`
- 我用 `smoothYaw / smoothPitch` 重构出来的"起点"和相机**此刻真实朝向**有偏差
- k=0 那一帧画面"撩"一下，加上插值动画，**视觉上像绕了顶部一圈**

### 坑 2：用 `pitch * (1-k)` 衰减仰角

**做法**：lerp 过程中独立把 pitch 从 startPitch 渐变到 0。

**问题**：
- 用户原本看天花板（pitch≈70°），lerp 中间帧 pitch 还是大值 → 相机仍指向全景图北极极点 → 看到**圆环涟漪畸变**（等距柱状投影的奇点）
- 即使 pitch 衰减到 0，过程中也是"先仰着扯一下再低下来"的画面

### 坑 3：强制 lerp 期间 `pitch = 0`，但 lookAt 终点 ≠ 圆轨道分支的 lookAt

**做法**：lerp lookAt 终点用了 "y=camera.y" 强制平视。

**问题**：
- lerp 末尾 lookAt 是平视，但 `else if(isGolestanCam && !_isDirPanoMode)` 圆轨道分支接管时立即 `lookAt(0,0,0)`
- 相机 y=-35、lookAt y=0 → 那一帧瞬间多产生 ~19° 的仰角
- 用户感受到 lerp 结束的瞬间"猛一仰头"

### 坑 4：让 lookAt.y 与 camera.y 同步插值

**做法**：lerp 起点 lookAt y=0、终点 lookAt y=-35（与 camera 同高 → 全程水平视线）。

**问题**：
- lerp 末尾的水平视线和圆轨道分支的 `lookAt(0,0,0)` 还是不一致
- 末尾还是会"咔嚓"再仰起来

### 坑 5：把 `smoothPitch` 强制归零

**做法**：onComplete 时 `smoothPitch = 0`。

**问题**：
- 用户在子场景如果是仰头看天花板，关闭瞬间 lerp 起点和实际视角对不上 → 第一帧画面 "撩"一下
- 用户根本没要求保留仰视，但也不希望"瞬切"——要求是从**当前真实视角**自然过渡

## 三、最终方案（真修复）

### 核心思想

**不重构起点，直接快照相机的真实状态。**

lerp 起点不再用 `smoothYaw/smoothPitch + 一堆三角函数`重新算，而是直接拍照：
- `camera.position` 当前值 → `(startPosX, startPosY, startPosZ)`
- `camera.getWorldDirection(v)` 当前看的方向 → `startLook = startPos + v · 100`

lerp 终点 = 玫瑰宫圆轨道常态值（与圆轨道分支完全一致）：
- position = `(-sin(yaw)·100, -35, -cos(yaw)·100)`
- lookAt = `(0, 0, 0)`

中间 ease-in-out cubic 线性插值 position 和 lookAt 两个端点。

### 数学保证

- **k=0 那一帧** = 相机此刻真实位置 + 此刻真实朝向 → 与子场景常态完全衔接，**第一帧画面零变化**
- **k=1 那一帧** = 圆轨道常态 → 与 `else if(isGolestanCam && !_isDirPanoMode)` 分支完全一致，**接管那一帧画面零变化**
- **中间走 3D 空间最短路径** → 不绕路、不仰视顶部、不绕去任何方向

### 代码骨架

`directory.js` 启动 lerp（两处都改）：

```js
const _camStartPos = camera.position.clone();
const _camDirTmp = new THREE.Vector3();
camera.getWorldDirection(_camDirTmp);
const _camStartLook = _camStartPos.clone().add(_camDirTmp.multiplyScalar(100));
window._dirHomeCamLerp = {
  startTime: performance.now(),
  durMs: 3000,
  startPosX: _camStartPos.x, startPosY: _camStartPos.y, startPosZ: _camStartPos.z,
  startLookX: _camStartLook.x, startLookY: _camStartLook.y, startLookZ: _camStartLook.z,
};
```

`app.js` lerp 分支（每帧）：

```js
if(isGolestanCam && _dirHomeLerpK >= 0){
  const k = _dirHomeLerpK;
  const _lerpSt = window._dirHomeCamLerp || {};
  // 起点 = 启动时快照
  const fromPx = _lerpSt.startPosX, fromPy = _lerpSt.startPosY, fromPz = _lerpSt.startPosZ;
  const fromLx = _lerpSt.startLookX, fromLy = _lerpSt.startLookY, fromLz = _lerpSt.startLookZ;
  // 终点 = 圆轨道常态（与下面分支保持一致！）
  const toPx = -Math.sin(smoothYaw) * 100;
  const toPy = -35;
  const toPz = -Math.cos(smoothYaw) * 100;
  const toLx = 0, toLy = 0, toLz = 0;
  camera.position.set(
    fromPx + (toPx - fromPx) * k,
    fromPy + (toPy - fromPy) * k,
    fromPz + (toPz - fromPz) * k
  );
  camera.lookAt(
    fromLx + (toLx - fromLx) * k,
    fromLy + (toLy - fromLy) * k,
    fromLz + (toLz - fromLz) * k
  );
}
```

### 全景图北极奇点（涟漪圆环）这次怎么处理的？

不用专门处理。因为：
- 起点 = 用户当前真实视角，**用户自己原本就没在看极顶**（看了的话他自己感受得到，但画面没畸变）
- 终点 = 玫瑰宫圆轨道常态，相机 y=-35 看 (0,0,0) = 微仰视吊灯 ~19°，**远低于触发奇点的 ~80°**
- 中间是两点之间的线性插值，**不会"绕远"经过北极极点**

换句话说，只要起点和终点都不在奇点附近，最短路径插值就不会撞上奇点。这比之前所有"夹角度/衰减/强制平视"的方案都更优雅。

## 四、迁移到其他类似过渡的通用原则

如果以后还要做"A 视角 → B 视角"的相机过渡，无论场景：

1. **不要用 yaw/pitch 等抽象参数重新算起点**——多变量耦合，容易和真实状态对不上
2. **拍照式快照** `camera.position` + `camera.getWorldDirection()` 作为起点
3. **终点直接复用接管分支的同一个公式**，确保 k=1 那一帧无缝衔接
4. **画面跳变 99% 是因为起点/终点和前后帧实际值有偏差**，对齐这两端就完事了
5. lerp 路径用直接的位置/lookAt 线性插值就行，不要画蛇添足搞 yaw/pitch 二级插值

## 五、可调参数

如果未来需要调整：

| 参数 | 位置 | 说明 |
|------|------|------|
| `durMs: 3000` | `directory.js` 两处 `_dirHomeCamLerp` | 过渡时长，要与火焰 crossfade `3.0` 秒同步 |
| ease 公式 | `app.js` `_dirHomeLerpK` 计算处 | 当前 ease-in-out cubic，可改 ease-out 让前段更快 |
| `· 100`（lookAt 距离） | `directory.js` 两处 `multiplyScalar(100)` | lookAt 点距相机的距离，对最终视觉无影响（只要 > 0） |

## 六、关键经验

> **能拍照就别重构。** 相机的"真实朝向"是十几个变量层层计算的最终结果，逆向拼回去几乎不可能精确，但 Three.js 给了 `getWorldDirection()` 直接抓现成的——为什么不用？

> 这次反复迭代了 5 版才找到这个方案，根因是一直在试图"用数学构造对的起点"，没意识到**相机的真实状态本身就是答案**。

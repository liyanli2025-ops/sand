# =============================================================
#  《聚不起的沙》场景 1 物料压缩脚本
#  - chandelier.glb   55MB  →  < 1.5MB   (Draco + 简化)
#  - Golestan 360.png 42MB  →  < 500KB   (转 JPEG + 缩放 2048x1024)
# =============================================================
#
#  用法：在 PowerShell 中 cd 到项目根目录，然后：
#    powershell -ExecutionPolicy Bypass -File .\tools\compress-assets.ps1
#
#  依赖：node + npx（已确认你机器有 v20.20.1，足够）
#  首次运行会自动下载 @gltf-transform/cli 和 sharp-cli，不需要手动 npm install
# =============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " 《聚不起的沙》场景 1 物料压缩" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------
# Step 1 · 压缩水晶吊灯 GLB（Draco + 几何简化 + 纹理压缩）
# ---------------------------------------------------------------
$glbIn  = Join-Path $root "chandelier.glb"
$glbOut = Join-Path $root "chandelier_compressed.glb"

Write-Host "[1/2] 压缩 chandelier.glb ..." -ForegroundColor Yellow
$beforeSize = (Get-Item $glbIn).Length / 1MB
Write-Host "    原始大小: $([math]::Round($beforeSize, 2)) MB"

# 用 gltf-transform：Draco 压缩 + 简化到 30k 三角面（粒子化够用）+ webp 纹理
# --ratio 0.3 表示保留 30% 的三角面（足够粒子采样）
Write-Host "    运行 gltf-transform（首次会下载约 50MB）..."
npx --yes @gltf-transform/cli optimize $glbIn $glbOut `
    --texture-compress webp `
    --texture-size 512 `
    --simplify true `
    --simplify-ratio 0.3 `
    --simplify-error 0.01 `
    --compress draco

if(Test-Path $glbOut){
    $afterSize = (Get-Item $glbOut).Length / 1MB
    Write-Host "    压缩后:   $([math]::Round($afterSize, 2)) MB" -ForegroundColor Green
    Write-Host "    压缩率:   $([math]::Round((1 - $afterSize / $beforeSize) * 100, 1))%" -ForegroundColor Green
} else {
    Write-Host "    [失败] 未生成输出文件" -ForegroundColor Red
}

Write-Host ""

# ---------------------------------------------------------------
# Step 2 · 压缩全景图 PNG → JPEG
# ---------------------------------------------------------------
$pngIn  = Join-Path $root "Golestan Palace 360.png"
$jpgOut = Join-Path $root "golestan_360.jpg"

Write-Host "[2/2] 压缩 Golestan Palace 360.png ..." -ForegroundColor Yellow
$beforeSize = (Get-Item $pngIn).Length / 1MB
Write-Host "    原始大小: $([math]::Round($beforeSize, 2)) MB"

# 用 sharp-cli：缩放到 2048x1024（等距柱状投影标准尺寸）+ JPEG quality 78
Write-Host "    运行 sharp-cli（首次会下载约 30MB）..."
npx --yes sharp-cli `
    -i $pngIn `
    -o $jpgOut `
    --format jpeg `
    -- resize 2048 1024 --fit fill `
    -- jpeg --quality 78 --mozjpeg

if(Test-Path $jpgOut){
    $afterSize = (Get-Item $jpgOut).Length / 1KB
    Write-Host "    压缩后:   $([math]::Round($afterSize, 1)) KB" -ForegroundColor Green
    Write-Host "    压缩率:   $([math]::Round((1 - $afterSize / 1024 / $beforeSize) * 100, 1))%" -ForegroundColor Green
} else {
    Write-Host "    [失败] 未生成输出文件" -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " 完成！生成文件：" -ForegroundColor Cyan
Write-Host "   - chandelier_compressed.glb" -ForegroundColor White
Write-Host "   - golestan_360.jpg" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步：把这两个文件名告诉我（或确认无误），我开始接入代码。" -ForegroundColor Yellow
Write-Host ""

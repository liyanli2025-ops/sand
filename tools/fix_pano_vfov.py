#!/usr/bin/env python3
"""
修复部分全景图的 vfov 不足导致的畸变问题

输入：等距柱状投影格式但实际只覆盖部分垂直视场角的全景图（4096×2048）
输出：把图像缩到对应的真实 vfov 高度，居中放到 4096×2048 画布，
      上下填充区域用图像顶/底行的平均色，渐变到深色（避免死黑突兀）

数学：
  - 标准 equirectangular vfov = 180°（画面高 = 2048px）
  - 实测这 4 张图实际有效 vfov ≈ 130°
  - 缩后图像高度 = 2048 * 130/180 ≈ 1480px
  - 上下各填充 (2048-1480)/2 = 284px
"""
from PIL import Image, ImageFilter
import os, sys

# 实际 vfov 估计（度）
EFFECTIVE_VFOV = 130.0
FULL_VFOV = 180.0
TARGET_W = 4096
TARGET_H = 2048

INPUT_DIR  = '/Users/yanli/Downloads/sand/assets/_pano_backup'
OUTPUT_DIR = '/Users/yanli/Downloads/sand/assets'
FILES = ['pano-shrine.jpg', 'pano-music.jpg', 'pano-imam.jpg', 'pano-lotfollah.jpg']

def fix_pano(in_path, out_path):
    img = Image.open(in_path).convert('RGB')
    w, h = img.size
    print(f'  原图: {w}x{h}')

    # 1) 计算缩放后的图像高度
    scaled_h = int(TARGET_H * EFFECTIVE_VFOV / FULL_VFOV)
    # 缩放图像高度到 scaled_h，宽度按比例 → 实际宽度
    scaled_w = int(w * scaled_h / h)
    img_scaled = img.resize((scaled_w, scaled_h), Image.LANCZOS)

    # 2) 如果宽度 != TARGET_W，再做 horizontal scale 到 4096（保持等距柱状条件）
    if scaled_w != TARGET_W:
        img_scaled = img_scaled.resize((TARGET_W, scaled_h), Image.LANCZOS)
    print(f'  缩到: {TARGET_W}x{scaled_h}')

    # 3) 创建 4096x2048 画布，居中放置
    pad_top = (TARGET_H - scaled_h) // 2
    pad_bottom = TARGET_H - scaled_h - pad_top

    # 4) 取顶/底行的平均色（按列采样，得到一行 4096 像素的颜色）
    top_row = img_scaled.crop((0, 0, TARGET_W, 8))         # 顶部 8 行
    bot_row = img_scaled.crop((0, scaled_h-8, TARGET_W, scaled_h))  # 底部 8 行

    # 把这 8 行平均成 1 行
    top_strip = top_row.resize((TARGET_W, 1), Image.LANCZOS)
    bot_strip = bot_row.resize((TARGET_W, 1), Image.LANCZOS)

    # 5) 顶部填充：从图像顶色 → 暗色（70% 黑）渐变
    canvas = Image.new('RGB', (TARGET_W, TARGET_H), (0, 0, 0))

    # 顶部填充区
    if pad_top > 0:
        top_fill = Image.new('RGB', (TARGET_W, pad_top), (0, 0, 0))
        # 渐变：顶部行平均色 → 远离图像处变暗
        for y in range(pad_top):
            # alpha 越远离图像（y 越小）越暗，用 0.3 兜底，保留 30% 颜色
            t = y / max(1, pad_top - 1)  # 0 在最顶，1 紧贴图像
            alpha = 0.3 + 0.7 * t  # 顶端保留 30% 色，紧贴图像处 100%
            row = top_strip.point(lambda v: int(v * alpha))
            top_fill.paste(row, (0, y))
        # 加一点模糊柔化
        top_fill = top_fill.filter(ImageFilter.GaussianBlur(radius=2))
        canvas.paste(top_fill, (0, 0))

    # 底部填充区
    if pad_bottom > 0:
        bot_fill = Image.new('RGB', (TARGET_W, pad_bottom), (0, 0, 0))
        for y in range(pad_bottom):
            t = 1 - y / max(1, pad_bottom - 1)  # 0 在最底，1 紧贴图像
            alpha = 0.3 + 0.7 * t
            row = bot_strip.point(lambda v: int(v * alpha))
            bot_fill.paste(row, (0, y))
        bot_fill = bot_fill.filter(ImageFilter.GaussianBlur(radius=2))
        canvas.paste(bot_fill, (0, pad_top + scaled_h))

    # 把缩放后的图像粘到中间
    canvas.paste(img_scaled, (0, pad_top))

    # 保存
    canvas.save(out_path, 'JPEG', quality=88, optimize=True)
    out_size = os.path.getsize(out_path) / 1024 / 1024
    print(f'  ✓ 输出: {out_path}  ({out_size:.2f} MB)')

if __name__ == '__main__':
    for fn in FILES:
        in_path = os.path.join(INPUT_DIR, fn)
        out_path = os.path.join(OUTPUT_DIR, fn)
        if not os.path.exists(in_path):
            print(f'✗ 找不到: {in_path}')
            continue
        print(f'\n处理: {fn}')
        fix_pano(in_path, out_path)
    print('\n全部完成')

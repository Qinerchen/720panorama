# -*- coding: utf-8 -*-
"""
把 全景图/ 里的原始全景图压缩成适合网页浏览的版本：
  panoramas/  4096×2048 JPG（网页实际加载的图，手机也能流畅加载）
  thumbnails/ 384×192  JPG（编辑器场景列表缩略图）

用法：把原始 2:1 全景图放进 全景图/ 文件夹，然后运行：
    python tools/图片优化.py
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "全景图")
PANO_DIR = os.path.join(ROOT, "panoramas")
THUMB_DIR = os.path.join(ROOT, "thumbnails")

PANO_WIDTH = 4096
THUMB_WIDTH = 384
PANO_QUALITY = 87
THUMB_QUALITY = 75


def process(path, name):
    im = Image.open(path)
    if im.mode != "RGB":
        im = im.convert("RGB")
    w, h = im.size
    if w < h * 2 - 4:
        print(f"  警告: {name} 不是 2:1 的等距圆柱全景图 (当前 {w}x{h})，仍会继续处理")

    pano = im.resize((PANO_WIDTH, PANO_WIDTH // 2), Image.LANCZOS)
    pano_path = os.path.join(PANO_DIR, name)
    pano.save(pano_path, "JPEG", quality=PANO_QUALITY, optimize=True)

    thumb = im.resize((THUMB_WIDTH, THUMB_WIDTH // 2), Image.LANCZOS)
    thumb_path = os.path.join(THUMB_DIR, name)
    thumb.save(thumb_path, "JPEG", quality=THUMB_QUALITY, optimize=True)

    print(f"  {name}: {w}x{h} ({os.path.getsize(path)//1024//1024}MB) -> "
          f"panoramas ({os.path.getsize(pano_path)//1024}KB) + thumbnails ({os.path.getsize(thumb_path)//1024}KB)")


def main():
    os.makedirs(PANO_DIR, exist_ok=True)
    os.makedirs(THUMB_DIR, exist_ok=True)

    exts = (".jpg", ".jpeg", ".png", ".webp")
    files = sorted(f for f in os.listdir(SRC_DIR) if f.lower().endswith(exts)) if os.path.isdir(SRC_DIR) else []
    if not files:
        print(f"在 {SRC_DIR} 中没有找到图片。请先把 2:1 的全景图放进去再运行。")
        sys.exit(1)

    print(f"共 {len(files)} 张图片，开始处理...")
    for f in files:
        process(os.path.join(SRC_DIR, f), f)
    print("完成。别忘了把新图片加进 project.json（在编辑器里添加场景即可）。")


if __name__ == "__main__":
    main()

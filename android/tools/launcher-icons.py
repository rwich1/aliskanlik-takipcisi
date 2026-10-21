"""Android launcher icons from assets/ (run from the project root, after @capacitor/assets).

@capacitor/assets 3.x writes adaptive layers at 48dp and wraps them in a 16.7% inset,
which makes the icon small and blurry. This script replaces them with full 108dp layers,
writes legacy/round PNGs, a monochrome layer (Android 13 themed icons) and the XMLs.
"""
import glob
import os
from PIL import Image, ImageChops, ImageDraw

ROOT = os.getcwd()
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
ASSETS = os.path.join(ROOT, "assets")
DENSITIES = {"ldpi": 0.75, "mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
INK = (78, 70, 63)  # check-mark colour in the foreground art

icon_only = Image.open(os.path.join(ASSETS, "icon-only.png")).convert("RGBA")
foreground = Image.open(os.path.join(ASSETS, "icon-foreground.png")).convert("RGBA")


def monochrome(fg):
    """Alpha-only glyph: cells stay opaque, dark check marks become holes."""
    rgb = fg.convert("RGB")
    ink = Image.new("RGB", fg.size, INK)
    diff = ImageChops.difference(rgb, ink).convert("L")  # 0 on check marks
    mask = diff.point(lambda v: min(255, v * 3))
    alpha = ImageChops.multiply(fg.getchannel("A"), mask)
    white = Image.new("RGBA", fg.size, (255, 255, 255, 255))
    white.putalpha(alpha)
    return white


def masked(src, size, shape):
    """Legacy icon: 2dp margin on a 48dp canvas, rounded square or circle, 4x supersampled."""
    S = size * 4
    pad = round(S * 2 / 48)
    inner = S - 2 * pad
    art = src.resize((inner, inner), Image.LANCZOS)
    mask = Image.new("L", (inner, inner), 0)
    d = ImageDraw.Draw(mask)
    if shape == "circle":
        d.ellipse([0, 0, inner - 1, inner - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, inner - 1, inner - 1], radius=round(inner * 0.18), fill=255)
    art.putalpha(ImageChops.multiply(art.getchannel("A"), mask))
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.alpha_composite(art, (pad, pad))
    return canvas.resize((size, size), Image.LANCZOS)


mono = monochrome(foreground)
for name, scale in DENSITIES.items():
    d = os.path.join(RES, f"mipmap-{name}")
    os.makedirs(d, exist_ok=True)
    legacy, layer = round(48 * scale), round(108 * scale)
    masked(icon_only, legacy, "square").save(os.path.join(d, "ic_launcher.png"), optimize=True)
    masked(icon_only, legacy, "circle").save(os.path.join(d, "ic_launcher_round.png"), optimize=True)
    foreground.resize((layer, layer), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"), optimize=True)
    mono.resize((layer, layer), Image.LANCZOS).save(os.path.join(d, "ic_launcher_monochrome.png"), optimize=True)

# Background is a flat colour resource (values/ + values-night/), so drop the PNG copies.
for f in glob.glob(os.path.join(RES, "mipmap-*", "ic_launcher_background.png")):
    os.remove(f)

ADAPTIVE = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
"""
anydpi = os.path.join(RES, "mipmap-anydpi-v26")
os.makedirs(anydpi, exist_ok=True)
for n in ("ic_launcher.xml", "ic_launcher_round.xml"):
    with open(os.path.join(anydpi, n), "w", encoding="utf-8") as fh:
        fh.write(ADAPTIVE)
print("launcher icons written to", RES)

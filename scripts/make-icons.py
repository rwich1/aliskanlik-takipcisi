"""Draws the app icon (taupe tile, 3x3 check grid, today's cell in amber) at every size the PWA, Electron and Android need."""
import sys
from PIL import Image, ImageDraw

BG = (115, 103, 93)      # --band
CELL = (250, 248, 245)   # --surface
INK = (78, 70, 63)       # --check
AMBER = (184, 105, 46)   # --mood
CHECKED = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 2), (2, 0)]
TODAY = (1, 1)

def draw(size, safe=0.62, radius=0.22, full_bleed=False, transparent_bg=False):
    S = size * 4  # supersample
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if not transparent_bg:
        if full_bleed:
            d.rectangle([0, 0, S, S], fill=BG)
        else:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=BG)
    grid = S * safe
    off = (S - grid) / 2
    gap = grid * 0.08
    cell = (grid - 2 * gap) / 3
    for r in range(3):
        for c in range(3):
            x0 = off + c * (cell + gap)
            y0 = off + r * (cell + gap)
            box = [x0, y0, x0 + cell, y0 + cell]
            rr = int(cell * 0.22)
            if (r, c) == TODAY:
                d.rounded_rectangle(box, radius=rr, fill=AMBER)
            elif (r, c) in CHECKED:
                d.rounded_rectangle(box, radius=rr, fill=CELL)
                w = max(2, int(cell * 0.13))
                pts = [(x0 + cell * 0.26, y0 + cell * 0.52), (x0 + cell * 0.43, y0 + cell * 0.69), (x0 + cell * 0.75, y0 + cell * 0.33)]
                d.line(pts, fill=INK, width=w, joint="curve")
                for p in (pts[0], pts[2]):
                    d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=INK)
            else:
                d.rounded_rectangle(box, radius=rr, outline=CELL, width=max(2, int(cell * 0.09)))
    return im.resize((size, size), Image.LANCZOS)

out = sys.argv[1] if len(sys.argv) > 1 else "www/icons"
draw(192).save(f"{out}/icon-192.png")
draw(512).save(f"{out}/icon-512.png")
draw(512, safe=0.5, full_bleed=True).save(f"{out}/maskable-512.png")
draw(180, safe=0.58, full_bleed=True).save(f"{out}/apple-touch-icon.png")
draw(64).save(f"{out}/favicon-64.png")
# Desktop (Electron / electron-builder) and Android source images
draw(1024).save("build/icon.png")
draw(256).save("build/icon-256.png")
draw(1024, safe=0.62, full_bleed=True).save("assets/icon-only.png")
draw(1024, safe=0.42, transparent_bg=True).save("assets/icon-foreground.png")
Image.new("RGBA", (1024, 1024), BG + (255,)).save("assets/icon-background.png")
# splash: tile centred on page colour
for name, bg in (("splash.png", (233, 229, 223)), ("splash-dark.png", (23, 21, 19))):
    sp = Image.new("RGBA", (2732, 2732), bg + (255,))
    t = draw(560)
    sp.alpha_composite(t, ((2732 - 560) // 2, (2732 - 560) // 2))
    sp.save(f"assets/{name}")
# multi-size .ico for Windows
draw(256).save("build/icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ok")

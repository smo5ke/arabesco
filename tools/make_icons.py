# -*- coding: utf-8 -*-
"""Arabesco — icon generator (PIL, no external assets).

Brand icon: emerald full-bleed square (maskable-safe), faint zellige star field,
golden horseshoe arch, bold white Arabic ع, crescent + sparkle accent.
Outputs icons/icon-512.png (any + maskable) and icons/icon-192.png.

Layers are composited with Image.alpha_composite so alpha blending is real
(ImageDraw alone replaces pixels instead of blending).
"""
import math
from PIL import Image, ImageDraw, ImageFont

S = 1024
OUT = "icons"

EMERALD_TOP = (16, 106, 78)
EMERALD_BOT = (7, 51, 38)
GOLD = (201, 162, 39)
GOLD_SOFT = (222, 189, 90)
WHITE = (246, 241, 229)

FONT_AY = r"C:\Windows\Fonts\DTNASKH2.TTF"  # bold naskh — probe winner


def star8(d, cx, cy, r, fill):
    """Eight-pointed star (khatam): two squares, one rotated 45°."""
    for rot in (0, 45):
        pts = [(cx + r * math.cos(math.radians(rot + i * 90)),
                cy + r * math.sin(math.radians(rot + i * 90))) for i in range(4)]
        d.polygon(pts, fill=fill)


def sparkle(d, cx, cy, r, fill):
    pts = [(cx, cy - r), (cx + r * 0.26, cy - r * 0.26), (cx + r, cy),
           (cx + r * 0.26, cy + r * 0.26), (cx, cy + r),
           (cx - r * 0.26, cy + r * 0.26), (cx - r, cy),
           (cx - r * 0.26, cy - r * 0.26)]
    d.polygon(pts, fill=fill)


def crescent(d, cx, cy, r, fill, cut):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    d.ellipse([cx - r * 0.45, cy - r * 1.22, cx + r * 1.30, cy + r * 0.62], fill=cut)


def gradient_layer():
    layer = Image.new("RGBA", (S, S))
    grad = Image.new("RGBA", (1, S))
    for y in range(S):
        t = y / (S - 1)
        c = tuple(int(a + (b - a) * t) for a, b in zip(EMERALD_TOP, EMERALD_BOT)) + (255,)
        grad.putpixel((0, y), c)
    layer.paste(grad.resize((S, S)), (0, 0))
    return layer


def make_icon():
    # ── layer 1: emerald gradient ──
    img = gradient_layer()

    # ── layer 2: zellige star field (real alpha blending via composite) ──
    pat = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pat)
    step, sr = 172, 40
    for gx in range(step // 2, S + step, step):
        for gy in range(step // 2, S + step, step):
            star8(pd, gx, gy, sr, fill=GOLD + (26,))
    for gx, gy in [(70, 70), (S - 70, 70), (70, S - 70), (S - 70, S - 70)]:
        star8(pd, gx, gy, 56, fill=GOLD + (36,))
    img = Image.alpha_composite(img, pat)

    # ── layer 3: golden horseshoe arch ──
    arch = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(arch)
    cx, cy = S / 2, 532
    r, stroke = 252, 56
    d.arc([cx - r, cy - r, cx + r, cy + r], start=155, end=385, fill=GOLD, width=stroke)
    r2 = r - 48
    d.arc([cx - r2, cy - r2, cx + r2, cy + r2], start=155, end=385,
          fill=GOLD_SOFT + (110,), width=7)
    leg_x = r * math.cos(math.radians(25))
    leg_y0 = cy + r * math.sin(math.radians(25))
    y_base = 858
    for sx in (-1, 1):
        x = cx + sx * leg_x
        d.rectangle([x - stroke / 2, leg_y0, x + stroke / 2, y_base], fill=GOLD)
    half = leg_x + stroke / 2 + 30
    d.rectangle([cx - half, y_base, cx + half, y_base + 14], fill=GOLD + (235,))
    img = Image.alpha_composite(img, arch)

    # ── layer 4: the hero glyph ع ──
    glyph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glyph)
    f = ImageFont.truetype(FONT_AY, 400)
    gd.text((cx, cy + 28), "\u0639", font=f, fill=WHITE + (255,),
            anchor="mm", stroke_width=9, stroke_fill=WHITE + (255,))
    img = Image.alpha_composite(img, glyph)

    # ── layer 5: crescent + sparkle ──
    acc = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ad = ImageDraw.Draw(acc)
    crescent(ad, cx + 4, cy - r - 108, 45, fill=GOLD, cut=EMERALD_BOT + (255,))
    sparkle(ad, cx + 86, cy - r - 118, 28, fill=GOLD)
    img = Image.alpha_composite(img, acc)

    return img


if __name__ == "__main__":
    icon = make_icon()
    icon.resize((512, 512), Image.LANCZOS).save(f"{OUT}/icon-512.png", optimize=True)
    icon.resize((192, 192), Image.LANCZOS).save(f"{OUT}/icon-192.png", optimize=True)
    icon.save(f"{OUT}/icon-master.png", optimize=True)
    print("icons written: 512, 192 (+ master 1024)")

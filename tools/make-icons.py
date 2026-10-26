from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path("assets")
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 1024


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


top = (20, 29, 53)
bottom = (7, 10, 18)
img = Image.new("RGB", (SIZE, SIZE), bottom)
pixels = img.load()
for y in range(SIZE):
    color = lerp(top, bottom, y / (SIZE - 1))
    for x in range(SIZE):
        pixels[x, y] = color

# soft moon glow behind the crescent
glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
gdraw = ImageDraw.Draw(glow)
for radius, alpha in ((390, 24), (330, 32), (275, 38), (230, 44)):
    gdraw.ellipse(
        (SIZE // 2 - radius, SIZE // 2 - radius, SIZE // 2 + radius, SIZE // 2 + radius),
        fill=(243, 203, 147, alpha),
    )
glow = glow.filter(ImageFilter.GaussianBlur(70))
img = Image.alpha_composite(img.convert("RGBA"), glow)

draw = ImageDraw.Draw(img, "RGBA")

# orbit ring
ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
rdraw = ImageDraw.Draw(ring)
rdraw.ellipse((142, 142, 882, 882), outline=(243, 203, 147, 38), width=3)
rdraw.ellipse((205, 205, 819, 819), outline=(255, 255, 255, 16), width=2)
img = Image.alpha_composite(img, ring)
draw = ImageDraw.Draw(img, "RGBA")

# stars
stars = [
    (226, 236, 5, 120),
    (300, 160, 3, 90),
    (760, 238, 4, 110),
    (820, 332, 3, 80),
    (255, 728, 3, 75),
    (690, 782, 4, 85),
    (168, 520, 3, 65),
    (866, 606, 3, 70),
]
for x, y, r, a in stars:
    draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 246, 226, a))

# crescent
moon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
mdraw = ImageDraw.Draw(moon)
mdraw.ellipse((262, 262, 762, 762), fill=(247, 224, 181, 255))
# cutout in the background color, slightly offset to form a crescent
cut = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
cdraw = ImageDraw.Draw(cut)
cdraw.ellipse((356, 232, 838, 714), fill=(10, 14, 25, 255))
moon = Image.alpha_composite(moon, cut)
# warm rim
draw = ImageDraw.Draw(img, "RGBA")
img = Image.alpha_composite(img, moon)
draw = ImageDraw.Draw(img, "RGBA")
draw.arc((262, 262, 762, 762), 92, 212, fill=(255, 242, 212, 120), width=3)

# tiny sparkle at the crescent's tip
draw.ellipse((704, 290, 716, 302), fill=(255, 247, 231, 200))

img = img.convert("RGB")
img.resize((512, 512), Image.LANCZOS).save(
    OUT / "icon-512.png", "PNG", optimize=True
)
img.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png", "PNG", optimize=True)

# maskable icon: same artwork with extra safe padding
maskable = Image.new("RGB", (SIZE, SIZE), (7, 10, 18))
art = img.resize((760, 760), Image.LANCZOS)
maskable.paste(art, ((SIZE - 760) // 2, (SIZE - 760) // 2))
maskable.resize((512, 512), Image.LANCZOS).save(
    OUT / "icon-maskable-512.png", "PNG", optimize=True
)

print("icons created", [str(p) for p in sorted(OUT.iterdir())])

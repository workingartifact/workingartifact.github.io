from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 627
OUT = Path("assets/how-strong-is-the-entity-linkedin.jpg")
OUT.parent.mkdir(parents=True, exist_ok=True)

# EXAPTER ENDAPTER / Working Artifact palette
left = (8, 47, 91)
right = (24, 91, 157)
img = Image.new("RGB", (W, H), left)
px = img.load()
for x in range(W):
    t = x / (W - 1)
    r = round(left[0] * (1 - t) + right[0] * t)
    g = round(left[1] * (1 - t) + right[1] * t)
    b = round(left[2] * (1 - t) + right[2] * t)
    for y in range(H):
        # Slight vertical darkening toward the bottom for depth.
        v = 1 - (y / H) * 0.10
        px[x, y] = (round(r * v), round(g * v), round(b * v))

draw = ImageDraw.Draw(img)

font_candidates = {
    "bold": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ],
    "regular": [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ],
}

def font(kind, size):
    for path in font_candidates[kind]:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()

label_font = font("bold", 24)
title_font = font("bold", 82)
subtitle_font = font("regular", 35)

# Right-side key watermark.
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
key = (86, 155, 223, 105)
od.ellipse((820, 145, 1040, 365), fill=key)
od.ellipse((878, 203, 982, 307), fill=(8, 47, 91, 235))
od.polygon([(974, 268), (1162, 356), (1130, 426), (1075, 401),
            (1058, 445), (1005, 420), (1024, 372), (941, 333)], fill=key)
img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
draw = ImageDraw.Draw(img)

label = "EXAPTER ENDAPTER · WORKING ARTIFACT"
draw.text((72, 82), label, font=label_font, fill=(200, 219, 241))

# Main title, wrapped deliberately for thumbnail readability.
draw.text((68, 158), "How Strong is", font=title_font, fill=(255, 255, 255))
draw.text((68, 250), "the Entity?", font=title_font, fill=(255, 255, 255))

subtitle = [
    "Judge the entity by its identity. Read the business",
    "rule and the identifier before choosing strong or weak.",
]
draw.text((72, 408), subtitle[0], font=subtitle_font, fill=(245, 248, 252))
draw.text((72, 456), subtitle[1], font=subtitle_font, fill=(245, 248, 252))

img.save(OUT, "JPEG", quality=90, optimize=True, progressive=False, subsampling=0)
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")

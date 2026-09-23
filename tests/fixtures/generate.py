"""Regenerates the GIF fixtures and their expected frames.

Expected frames are rendered by Pillow, an independent GIF implementation,
so the tests check the plugin's decoder against a reference rather than itself.

    python3 tests/fixtures/generate.py
"""
import hashlib
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageSequence

HERE = Path(__file__).parent
SIZE = 96
random.seed(1)


def scene(i, noise=False):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([i * 5, i * 3, i * 5 + 40, i * 3 + 40], fill=(255, 50 * i % 255, 0, 255))
    d.rectangle([60 - i * 2, 10, 90 - i * 2, 50 + i], fill=(0, 120, 255, 255))
    if noise:  # many colours -> full palettes and 12-bit LZW codes
        for _ in range(300):
            im.putpixel((random.randrange(SIZE), random.randrange(SIZE)),
                        (random.randrange(256), random.randrange(256), random.randrange(256), 255))
    return im


def save(name, frames, **kw):
    frames[0].save(HERE / name, save_all=True, append_images=frames[1:], loop=0, **kw)


save("opaque.gif", [scene(i, True).convert("RGB") for i in range(8)],
     duration=[20, 40, 0, 10, 50, 70, 80, 90], optimize=False)
save("dispose-background.gif", [scene(i) for i in range(6)], duration=60, disposal=2)
save("dispose-none.gif", [scene(i) for i in range(6)], duration=60, disposal=1)
save("interlaced.gif", [scene(i, True).convert("RGB") for i in range(4)], duration=100, interlace=True)

prev = []
for i in range(5):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, SIZE - 1, 20], fill=(200, 200, 200, 255))
    d.ellipse([i * 15, 30, i * 15 + 30, 60], fill=(255, 0, i * 50, 255))
    prev.append(im)
save("dispose-previous.gif", prev, duration=80, disposal=[1, 3, 3, 2, 3])

expected = {}
for gif in sorted(HERE.glob("*.gif")):
    frames = []
    for fr in ImageSequence.Iterator(Image.open(gif)):
        rgba = bytearray(fr.convert("RGBA").tobytes())
        for p in range(0, len(rgba), 4):  # transparent pixels compare as 0,0,0,0
            if rgba[p + 3] == 0:
                rgba[p:p + 3] = b"\0\0\0"
        frames.append(hashlib.sha256(rgba).hexdigest())
    expected[gif.name] = frames
(HERE / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")
print(f"Wrote {len(expected)} fixtures")

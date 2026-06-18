#!/usr/bin/env python3
"""Generate a soft kawaii mochi pet GIF.

Design:
- 96x96 transparent canvas
- Round cream-colored body with soft shadow ring
- Top-left shine highlight
- Pink blush cheeks, small black eyes (with one blink frame)
- Small smile mouth
- Animation: 10 frames, breathing scale (1.0 -> 1.04) + vertical bounce,
  ground shadow pulses with the bounce.
"""
from PIL import Image, ImageDraw
import math
import os

W, H = 96, 96
FRAMES = 10
FRAME_MS = 80  # ~12.5 fps, 800ms loop

# Mochi geometry (rest pose)
BODY_CX = 48
BODY_CY = 54
BODY_W = 74
BODY_H = 64

# Colors (R, G, B, A)
BODY_COLOR = (255, 246, 235, 255)      # warm cream
BODY_SHADOW = (238, 222, 205, 90)      # very soft underside tint
HIGHLIGHT = (255, 255, 255, 235)       # shine on top-left
HIGHLIGHT_BIG = (255, 252, 245, 180)   # broader top sheen
EYE_COLOR = (74, 74, 74, 255)          # soft dark gray (not pure black)
EYE_SHINE = (255, 255, 255, 255)
CHEEK_COLOR = (255, 165, 178, 215)     # soft pink blush
MOUTH_COLOR = (175, 110, 90, 255)      # warm brown


def make_frame(t):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, 'RGBA')

    phase = t / FRAMES
    # Smooth sine breathing
    s = math.sin(phase * 2 * math.pi)
    scale = 1.0 + 0.04 * s
    # Subtle vertical lift when "inhaled" (bigger)
    bounce = -2.5 * s

    bw = BODY_W * scale
    bh = BODY_H * scale
    cy = BODY_CY + bounce

    # Ground shadow: smaller and lighter when mochi is lifted
    shadow_w = 52 * (1.0 - 0.10 * s)
    shadow_alpha = int(40 * (1.0 - 0.40 * s))
    draw.ellipse(
        [BODY_CX - shadow_w / 2, H - 10 - 3,
         BODY_CX + shadow_w / 2, H - 10 + 3],
        fill=(0, 0, 0, shadow_alpha),
    )

    # Body shadow (very soft underside tint, slight offset)
    draw.ellipse(
        [BODY_CX - bw / 2, cy - bh / 2 + 2,
         BODY_CX + bw / 2, cy + bh / 2 + 2],
        fill=BODY_SHADOW,
    )

    # Main body
    draw.ellipse(
        [BODY_CX - bw / 2, cy - bh / 2,
         BODY_CX + bw / 2, cy + bh / 2],
        fill=BODY_COLOR,
    )

    # Broad top sheen (subtle gradient feel)
    sheen_w = bw * 0.70
    sheen_h = bh * 0.45
    sheen_x = BODY_CX - sheen_w / 2
    sheen_y = cy - bh / 2 - 2
    draw.ellipse(
        [sheen_x, sheen_y, sheen_x + sheen_w, sheen_y + sheen_h],
        fill=HIGHLIGHT_BIG,
    )

    # Top-left shine highlight
    hl_w = bw * 0.32
    hl_h = bh * 0.14
    hl_x = BODY_CX - bw / 2 + bw * 0.18
    hl_y = cy - bh / 2 + 3
    draw.ellipse(
        [hl_x, hl_y, hl_x + hl_w, hl_y + hl_h],
        fill=HIGHLIGHT,
    )

    # Cheeks (soft pink blush, slightly bigger and lower)
    cheek_r = 6
    for ex in [BODY_CX - 20, BODY_CX + 20]:
        draw.ellipse(
            [ex - cheek_r, cy + 2 - cheek_r * 0.9,
             ex + cheek_r, cy + 2 + cheek_r * 0.9],
            fill=CHEEK_COLOR,
        )

    # Eyes (blink on frame 5)
    blink = (t == 5)
    eye_y = cy - 5
    for ex in [BODY_CX - 12, BODY_CX + 12]:
        if blink:
            # Closed eye: small upward curve (^^)
            draw.arc(
                [ex - 4, eye_y - 2, ex + 4, eye_y + 3],
                start=200, end=340, fill=EYE_COLOR, width=2,
            )
        else:
            # Open eye (slightly bigger oval) + white shine
            draw.ellipse(
                [ex - 3, eye_y - 3.5, ex + 3, eye_y + 3.5],
                fill=EYE_COLOR,
            )
            draw.ellipse(
                [ex - 1.8, eye_y - 2.2, ex - 0.5, eye_y - 0.8],
                fill=EYE_SHINE,
            )

    # Mouth: small downward smile (slightly bigger, more visible)
    mouth_y = cy + 6
    draw.arc(
        [BODY_CX - 4, mouth_y, BODY_CX + 4, mouth_y + 5],
        start=180, end=360, fill=MOUTH_COLOR, width=2,
    )

    return img


def main():
    frames = [make_frame(t) for t in range(FRAMES)]
    output_path = 'assets/pet-default.gif'

    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_MS,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=True,
    )
    size = os.path.getsize(output_path)
    print(f'Saved {output_path} ({size} bytes, {FRAMES} frames @ {FRAME_MS}ms)')


if __name__ == '__main__':
    main()

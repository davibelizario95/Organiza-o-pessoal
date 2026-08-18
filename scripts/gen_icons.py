#!/usr/bin/env python3
"""Gera ícones PNG do app sem dependências externas (stdlib only)."""
import struct
import zlib
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

BG = (108, 92, 231)  # roxo (--accent)
BG2 = (162, 155, 254)
FG = (255, 255, 255)


def lerp(a, b, t):
    return a + (b - a) * t


def pixel(x, y, size):
    # fundo em degradê diagonal
    t = (x + y) / (2 * size)
    r = int(lerp(BG[0], BG2[0], t))
    g = int(lerp(BG[1], BG2[1], t))
    b = int(lerp(BG[2], BG2[2], t))

    cx, cy = size / 2, size / 2
    s = size

    # "check" estilizado: uma lista com 3 barras + checkmark simples
    def in_bar(y0, h):
        margin = s * 0.30
        return margin <= x <= s - margin * 1.55 and y0 <= y <= y0 + h

    bar_h = s * 0.075
    bars_y = [s * 0.34, s * 0.34 + bar_h * 2.1, s * 0.34 + bar_h * 4.2]
    is_bar = any(in_bar(by, bar_h) for by in bars_y)

    # bolinha check na direita de cada barra
    def near_dot(cx0, cy0, r):
        return (x - cx0) ** 2 + (y - cy0) ** 2 <= r * r

    dot_r = s * 0.045
    dot_x = s * 0.755
    is_dot = any(near_dot(dot_x, by + bar_h / 2, dot_r) for by in bars_y)

    if is_bar or is_dot:
        return FG
    return (r, g, b)


def rounded_mask(x, y, size, radius_ratio=0.22):
    r = size * radius_ratio
    cxs = [(r, r), (size - r, r), (r, size - r), (size - r, size - r)]
    for cx, cy in cxs:
        in_corner_x = (x < r and (cx == r)) or (x > size - r and (cx == size - r))
        in_corner_y = (y < r and (cy == r)) or (y > size - r and (cy == size - r))
        if in_corner_x and in_corner_y:
            if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                return False
    return True


def make_png(path, size, rounded=True):
    rows = []
    for y in range(size):
        row = bytearray()
        row.append(0)  # sem filtro
        for x in range(size):
            if rounded and not rounded_mask(x, y, size):
                row.extend((0, 0, 0, 0))
            else:
                r, g, b = pixel(x, y, size)
                row.extend((r, g, b, 255))
        rows.append(bytes(row))
    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return (
            struct.pack("!I", len(data))
            + tag
            + data
            + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack("!IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


make_png(os.path.join(OUT_DIR, "icon-192.png"), 192)
make_png(os.path.join(OUT_DIR, "icon-512.png"), 512)
make_png(os.path.join(OUT_DIR, "icon-maskable-512.png"), 512, rounded=False)
make_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), 180)
make_png(os.path.join(OUT_DIR, "favicon-32.png"), 32)

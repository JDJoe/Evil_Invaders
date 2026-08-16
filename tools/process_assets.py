#!/usr/bin/env python3
"""Chromakey sprites, crop, force-tile textures, write assets/."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

SESS = Path(
    "/home/mart/.grok/sessions/%2Fhome%2Fmart%2FAISTUFF%2FEvil_Invaders"
    "/01a00a57-cbcf-7180-8de4-9808de5d635d/images"
)
WALK = ROOT / "assets" / "_walk"


def contract_alpha(im: Image.Image, px: int = 1) -> Image.Image:
    """Eat a thin rim of leftover screen fringe."""
    if px <= 0:
        return im
    a = im.getchannel("A")
    a = a.filter(ImageFilter.MinFilter(px * 2 + 1))
    im = im.copy()
    im.putalpha(a)
    return im


def chromakey(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pix = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            mx = max(r, b)
            greenness = g - mx
            if g > 55 and greenness > 10:
                if greenness > 32 or (g > 150 and b < 110):
                    op[x, y] = (0, 0, 0, 0)
                else:
                    t = max(0.0, min(1.0, (greenness - 10) / 32))
                    g2 = min(g, mx + 6)
                    op[x, y] = (r, g2, b, int(a * (1 - t)))
            else:
                if g > mx + 8:
                    g = (g + mx) // 2
                op[x, y] = (r, g, b, a)
    return contract_alpha(out, 1)


def crop_alpha(im: Image.Image, pad: int = 8) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def save_sprite(src: Path, dest: Path, max_side: int = 640) -> None:
    im = chromakey(Image.open(src))
    im = crop_alpha(im)
    im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG", optimize=True)
    print(f"sprite {dest.name} {im.size}")


def make_seamless(src: Path, dest: Path, size: int = 512) -> None:
    im = Image.open(src).convert("RGB")
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    half = size // 2
    rolled = ImageChops.offset(im, half, half)
    # Soft-cross the now-centered seams
    mask_h = Image.new("L", (size, size), 0)
    mask_v = Image.new("L", (size, size), 0)
    band = 40
    for i in range(band):
        v = int(255 * (1 - abs(i - band / 2) / (band / 2)))
        for y in range(size):
            mask_h.putpixel((half - band // 2 + i, y), v)
        for x in range(size):
            mask_v.putpixel((x, half - band // 2 + i), v)
    mask_h = mask_h.filter(ImageFilter.GaussianBlur(6))
    mask_v = mask_v.filter(ImageFilter.GaussianBlur(6))
    # Blend rolled (which has continuous edges after we offset back) — actually
    # we want the original with its opposite-edge pixels painted over the seams
    # of the rolled image, then offset back.
    mixed = Image.composite(im, rolled, mask_h)
    mixed = Image.composite(im, mixed, mask_v)
    final = ImageChops.offset(mixed, half, half)
    # Slight contrast so it reads as painted grass/dirt
    final = ImageEnhance.Contrast(final).enhance(1.05)
    dest.parent.mkdir(parents=True, exist_ok=True)
    final.save(dest, "PNG", optimize=True)
    print(f"tile  {dest.name} {final.size}")


def save_plain(src: Path, dest: Path, size: tuple[int, int] | None = None) -> None:
    im = Image.open(src).convert("RGB")
    if size:
        im = im.resize(size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG", optimize=True)
    print(f"tex   {dest.name} {im.size}")


def main() -> None:
    # Terrain / surfaces
    make_seamless(SESS / "1.jpg", ASSETS / "tex_grass.png", 512)
    make_seamless(SESS / "6.jpg", ASSETS / "tex_dirt.png", 512)
    make_seamless(SESS / "8.jpg", ASSETS / "tex_roof.png", 512)
    make_seamless(SESS / "17.jpg", ASSETS / "tex_plaster.png", 512)
    save_plain(SESS / "4.jpg", ASSETS / "tex_sky.png", (1280, 720))
    save_plain(SESS / "11.jpg", ASSETS / "tex_house.png", (768, 768))
    save_plain(SESS / "20.jpg", ASSETS / "tex_house_gold.png", (768, 768))
    save_plain(SESS / "18.jpg", ASSETS / "win.png", (1280, 720))

    # Characters
    save_sprite(SESS / "3.jpg", ASSETS / "spr_ei.png")
    save_sprite(SESS / "14.jpg", ASSETS / "spr_ei_sprinty.png")
    save_sprite(SESS / "13.jpg", ASSETS / "spr_ei_tanky.png")
    save_sprite(SESS / "12.jpg", ASSETS / "spr_ei_boss.png")
    save_sprite(SESS / "5.jpg", ASSETS / "spr_soldier.png")

    # Props
    save_sprite(SESS / "2.jpg", ASSETS / "spr_tree.png", 768)
    save_sprite(SESS / "16.jpg", ASSETS / "spr_bush.png")
    save_sprite(SESS / "10.jpg", ASSETS / "spr_rock.png")
    save_sprite(SESS / "9.jpg", ASSETS / "spr_crate.png")
    save_sprite(SESS / "15.jpg", ASSETS / "spr_hay.png")
    save_sprite(SESS / "19.jpg", ASSETS / "spr_cottage.png", 768)

    # Walk cycle — keep a shared canvas so the sprite does not jump
    walk_dir = ASSETS / "walk"
    walk_dir.mkdir(exist_ok=True)
    picks = [5, 6, 7, 8, 9, 10, 11, 12]
    for i, n in enumerate(picks, 1):
        im = chromakey(Image.open(WALK / f"f{n:03d}.png"))
        canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        im.thumbnail((512, 512), Image.Resampling.LANCZOS)
        canvas.paste(im, ((512 - im.width) // 2, (512 - im.height) // 2), im)
        dest = walk_dir / f"ei_{i:02d}.png"
        canvas.save(dest, "PNG", optimize=True)
        print(f"walk  {dest.name} {canvas.size}")

    # Optional rifle overlay
    rifle = SESS / "21.jpg"
    if rifle.exists():
        save_sprite(rifle, ASSETS / "spr_rifle.png", 1280)

    print("done")


if __name__ == "__main__":
    main()

from PIL import Image
import numpy as np


def apply_colours(qr, fg_hex: str, bg_hex: str) -> Image.Image:
    fg = _hex_to_rgb(fg_hex)
    bg = _hex_to_rgb(bg_hex)
    img = qr.make_image(fill_color=fg, back_color=bg).convert('RGB')
    return img


def embed_logo(qr_img: Image.Image, logo_file) -> Image.Image:
    logo = Image.open(logo_file).convert('RGBA')

    qr_w, qr_h = qr_img.size
    max_logo_size = int(min(qr_w, qr_h) * 0.28)

    logo_w, logo_h = logo.size
    ratio = min(max_logo_size / logo_w, max_logo_size / logo_h)
    new_w = max(1, int(logo_w * ratio))
    new_h = max(1, int(logo_h * ratio))
    logo = logo.resize((new_w, new_h), Image.LANCZOS)

    pos_x = (qr_w - new_w) // 2
    pos_y = (qr_h - new_h) // 2

    result = qr_img.convert('RGBA')

    # White padding behind logo for contrast
    pad = 6
    pad_box = Image.new('RGBA', (new_w + pad * 2, new_h + pad * 2), (255, 255, 255, 255))
    result.paste(pad_box, (pos_x - pad, pos_y - pad), pad_box)

    result.paste(logo, (pos_x, pos_y), logo)
    return result.convert('RGB')


def resize_image(img: Image.Image, size_px: int) -> Image.Image:
    return img.resize((size_px, size_px), Image.NEAREST)


def _hex_to_rgb(hex_colour: str):
    hex_colour = hex_colour.lstrip('#')
    if len(hex_colour) == 3:
        hex_colour = ''.join(c * 2 for c in hex_colour)
    return tuple(int(hex_colour[i:i+2], 16) for i in (0, 2, 4))

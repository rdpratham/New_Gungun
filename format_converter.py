import base64
import io
import qrcode
import qrcode.image.svg
from PIL import Image


def to_png_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def to_svg_b64(data: str, ecc_level: str, fg_hex: str, bg_hex: str, border: int = 4) -> str:
    from qr_generator import ECC_MAP
    from qrcode.constants import ERROR_CORRECT_H

    ecc = ECC_MAP.get(ecc_level.upper(), ERROR_CORRECT_H)

    fg = fg_hex if fg_hex.startswith('#') else f'#{fg_hex}'
    bg = bg_hex if bg_hex.startswith('#') else f'#{bg_hex}'

    factory = qrcode.image.svg.SvgPathFillImage
    qr = qrcode.QRCode(
        error_correction=ecc,
        box_size=10,
        border=border,
        image_factory=factory,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(
        attrib={'fill': fg, 'style': f'background:{bg}'}
    )
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return buf.read()

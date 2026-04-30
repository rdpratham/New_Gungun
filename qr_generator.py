import qrcode
from qrcode.constants import (
    ERROR_CORRECT_L,
    ERROR_CORRECT_M,
    ERROR_CORRECT_Q,
    ERROR_CORRECT_H,
)

ECC_MAP = {
    'L': ERROR_CORRECT_L,
    'M': ERROR_CORRECT_M,
    'Q': ERROR_CORRECT_Q,
    'H': ERROR_CORRECT_H,
}

def generate_matrix(data: str, ecc_level: str, box_size: int = 10, border: int = 4):
    ecc = ECC_MAP.get(ecc_level.upper(), ERROR_CORRECT_H)
    qr = qrcode.QRCode(
        error_correction=ecc,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    return qr

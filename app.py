import io
import os
import base64

from flask import Flask, render_template, request, jsonify, send_file, session

from qr_generator import generate_matrix
from image_processor import apply_colours, embed_logo, resize_image
from format_converter import to_png_b64, to_svg_b64, png_bytes

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'qr-generator-secret-2026')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MB logo upload limit


@app.route('/')
def index():
    last = session.get('last_params', {})
    return render_template('index.html', last=last)


@app.route('/generate', methods=['POST'])
def generate():
    try:
        data = request.form.get('data', '').strip()
        if not data:
            return jsonify({'error': 'QR data cannot be empty.'}), 400

        fg_hex = request.form.get('fg_colour', '#000000').strip() or '#000000'
        bg_hex = request.form.get('bg_colour', '#ffffff').strip() or '#ffffff'
        ecc_level = request.form.get('ecc_level', 'H').strip().upper()
        if ecc_level not in ('L', 'M', 'Q', 'H'):
            ecc_level = 'H'

        try:
            size_px = int(request.form.get('size', 300))
            size_px = max(100, min(1000, size_px))
        except ValueError:
            size_px = 300

        try:
            border = int(request.form.get('border', 4))
            border = max(0, min(10, border))
        except ValueError:
            border = 4

        fmt = request.form.get('format', 'png').strip().lower()
        if fmt not in ('png', 'svg', 'both'):
            fmt = 'png'

        logo_file = request.files.get('logo')
        has_logo = logo_file and logo_file.filename and ecc_level == 'H'

        # Generate QR matrix
        qr = generate_matrix(data, ecc_level, box_size=10, border=border)

        # Apply colours
        img = apply_colours(qr, fg_hex, bg_hex)

        # Embed logo if provided (only when ECC = H)
        if has_logo:
            img = embed_logo(img, logo_file)

        # Resize to requested size
        img = resize_image(img, size_px)

        response = {}

        if fmt in ('png', 'both'):
            response['png'] = to_png_b64(img)

        if fmt in ('svg', 'both'):
            response['svg'] = to_svg_b64(data, ecc_level, fg_hex, bg_hex, border)

        # Always include PNG for preview
        if 'png' not in response:
            response['png'] = to_png_b64(img)

        # Save last params to session
        session['last_params'] = {
            'data': data,
            'fg_colour': fg_hex,
            'bg_colour': bg_hex,
            'ecc_level': ecc_level,
            'size': size_px,
            'border': border,
            'format': fmt,
            'has_logo': bool(has_logo),
        }

        return jsonify(response)

    except Exception as exc:
        return jsonify({'error': f'Generation failed: {str(exc)}'}), 500


@app.route('/download/png', methods=['POST'])
def download_png():
    try:
        data = request.form.get('data', '').strip()
        if not data:
            return jsonify({'error': 'No data provided.'}), 400

        fg_hex = request.form.get('fg_colour', '#000000').strip()
        bg_hex = request.form.get('bg_colour', '#ffffff').strip()
        ecc_level = request.form.get('ecc_level', 'H').strip().upper()
        size_px = max(100, min(1000, int(request.form.get('size', 300))))
        border = max(0, min(10, int(request.form.get('border', 4))))

        logo_file = request.files.get('logo')
        has_logo = logo_file and logo_file.filename and ecc_level == 'H'

        qr = generate_matrix(data, ecc_level, box_size=10, border=border)
        img = apply_colours(qr, fg_hex, bg_hex)
        if has_logo:
            img = embed_logo(img, logo_file)
        img = resize_image(img, size_px)

        data_bytes = png_bytes(img)
        return send_file(
            io.BytesIO(data_bytes),
            mimetype='image/png',
            as_attachment=True,
            download_name='qrcode.png',
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/download/svg', methods=['POST'])
def download_svg():
    try:
        data = request.form.get('data', '').strip()
        if not data:
            return jsonify({'error': 'No data provided.'}), 400

        fg_hex = request.form.get('fg_colour', '#000000').strip()
        bg_hex = request.form.get('bg_colour', '#ffffff').strip()
        ecc_level = request.form.get('ecc_level', 'H').strip().upper()
        border = max(0, min(10, int(request.form.get('border', 4))))

        svg_b64 = to_svg_b64(data, ecc_level, fg_hex, bg_hex, border)
        svg_bytes = base64.b64decode(svg_b64)

        return send_file(
            io.BytesIO(svg_bytes),
            mimetype='image/svg+xml',
            as_attachment=True,
            download_name='qrcode.svg',
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form        = document.getElementById('qr-form');
const dataInput   = document.getElementById('data-input');
const fgPicker    = document.getElementById('fg-colour-picker');
const fgHex       = document.getElementById('fg-colour');
const bgPicker    = document.getElementById('bg-colour-picker');
const bgHex       = document.getElementById('bg-colour');
const sizeRange   = document.getElementById('size-range');
const sizeLabel   = document.getElementById('size-label');
const borderRange = document.getElementById('border-range');
const borderLabel = document.getElementById('border-label');
const eccSelect   = document.getElementById('ecc-level');
const logoInput   = document.getElementById('logo-upload');
const dropZone    = document.getElementById('drop-zone');
const logoPreviewWrap = document.getElementById('logo-preview-wrap');
const logoPreviewImg  = document.getElementById('logo-preview-img');
const removeLogo  = document.getElementById('remove-logo');
const logoEccWarn = document.getElementById('logo-ecc-warn');
const contrastWarn = document.getElementById('contrast-warn');
const btnGenerate = document.getElementById('btn-generate');
const qrImg       = document.getElementById('qr-img');
const qrPlaceholder = document.getElementById('qr-placeholder');
const qrSpinner   = document.getElementById('qr-spinner');
const genError    = document.getElementById('gen-error');
const btnDlPng    = document.getElementById('btn-dl-png');
const btnDlSvg    = document.getElementById('btn-dl-svg');
const badgeEcc    = document.getElementById('badge-ecc');
const badgeSize   = document.getElementById('badge-size');
const statsRow    = document.getElementById('stats-row');
const statChars   = document.getElementById('stat-chars');
const statEcc     = document.getElementById('stat-ecc');
const statSize    = document.getElementById('stat-size');
const statLogo    = document.getElementById('stat-logo');

// Store last successful generation data for download
let lastFormData = null;
let lastPngB64   = null;
let lastSvgB64   = null;

// ── Colour picker sync ────────────────────────────────────────────────────────
function syncPickers(picker, hex) {
  picker.addEventListener('input', () => {
    hex.value = picker.value;
    checkContrast();
  });
  hex.addEventListener('input', () => {
    const v = hex.value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      picker.value = v;
      checkContrast();
    }
  });
}
syncPickers(fgPicker, fgHex);
syncPickers(bgPicker, bgHex);

// ── Contrast check (WCAG relative luminance) ──────────────────────────────────
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  const srgb = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrast() {
  try {
    const ratio = contrastRatio(fgHex.value, bgHex.value);
    if (ratio < 3) {
      contrastWarn.classList.remove('hidden');
    } else {
      contrastWarn.classList.add('hidden');
    }
  } catch (_) { /* ignore bad hex */ }
}

// ── Size + border slider labels ───────────────────────────────────────────────
sizeRange.addEventListener('input', () => {
  sizeLabel.textContent = sizeRange.value + 'px';
  badgeSize.textContent = sizeRange.value + ' px';
});
borderRange.addEventListener('input', () => {
  borderLabel.textContent = borderRange.value;
});

// ── ECC badge update ──────────────────────────────────────────────────────────
eccSelect.addEventListener('change', () => {
  badgeEcc.textContent = eccSelect.value + ' ECC';
  updateLogoState();
});

// ── Logo handling ─────────────────────────────────────────────────────────────
function updateLogoState() {
  const hasFile = logoInput.files && logoInput.files.length > 0;
  if (hasFile && eccSelect.value !== 'H') {
    logoEccWarn.classList.remove('hidden');
    eccSelect.value = 'H';
    badgeEcc.textContent = 'H ECC';
  } else {
    logoEccWarn.classList.add('hidden');
  }
}

logoInput.addEventListener('change', () => {
  const file = logoInput.files[0];
  if (!file) return;
  showLogoPreview(file);
  updateLogoState();
});

function showLogoPreview(file) {
  const reader = new FileReader();
  reader.onload = e => {
    logoPreviewImg.src = e.target.result;
    logoPreviewWrap.classList.remove('hidden');
    dropZone.querySelector('.drop-hint').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

removeLogo.addEventListener('click', e => {
  e.stopPropagation();
  logoInput.value = '';
  logoPreviewWrap.classList.add('hidden');
  dropZone.querySelector('.drop-hint').classList.remove('hidden');
  logoEccWarn.classList.add('hidden');
});

// Drag and drop
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    logoInput.files = dt.files;
    showLogoPreview(file);
    updateLogoState();
  }
});

// ── Quick fill chips ──────────────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const tpl = chip.dataset.tpl.replace(/&#10;/g, '\n');
    dataInput.value = tpl;
    dataInput.focus();
  });
});

// ── Form submission / generate ────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  await doGenerate();
});

async function doGenerate() {
  const data = dataInput.value.trim();
  if (!data) {
    showError('Please enter some text or a URL to encode.');
    return;
  }

  setLoading(true);

  const fd = new FormData(form);
  // Ensure we always generate PNG for preview regardless of selected format
  lastFormData = fd;

  try {
    const resp = await fetch('/generate', { method: 'POST', body: fd });
    const json = await resp.json();

    if (!resp.ok || json.error) {
      showError(json.error || 'Generation failed. Please try again.');
      return;
    }

    lastPngB64 = json.png || null;
    lastSvgB64 = json.svg || null;

    // Show preview
    qrImg.src = `data:image/png;base64,${lastPngB64}`;
    qrImg.classList.remove('hidden');
    qrPlaceholder.classList.add('hidden');
    genError.classList.add('hidden');

    // Enable download buttons
    btnDlPng.disabled = !lastPngB64;
    btnDlSvg.disabled = !lastSvgB64;

    // Update stats
    statChars.textContent = data.length;
    statEcc.textContent   = eccSelect.value;
    statSize.textContent  = sizeRange.value + ' px';
    statLogo.textContent  = logoInput.files && logoInput.files.length ? '✓' : 'None';
    statsRow.classList.remove('hidden');

  } catch (err) {
    showError('Network error — please check your connection and try again.');
  } finally {
    setLoading(false);
  }
}

// ── Download PNG ──────────────────────────────────────────────────────────────
btnDlPng.addEventListener('click', async () => {
  if (!lastFormData) return;
  try {
    const fd = buildDownloadForm();
    const resp = await fetch('/download/png', { method: 'POST', body: fd });
    if (!resp.ok) { showError('PNG download failed.'); return; }
    const blob = await resp.blob();
    triggerDownload(blob, 'qrcode.png');
  } catch (_) {
    // Fallback: decode base64 directly
    if (lastPngB64) {
      const blob = b64ToBlob(lastPngB64, 'image/png');
      triggerDownload(blob, 'qrcode.png');
    }
  }
});

// ── Download SVG ──────────────────────────────────────────────────────────────
btnDlSvg.addEventListener('click', async () => {
  if (!lastSvgB64) {
    // Generate SVG on demand
    const fd = buildDownloadForm();
    try {
      const resp = await fetch('/download/svg', { method: 'POST', body: fd });
      if (!resp.ok) { showError('SVG download failed.'); return; }
      const blob = await resp.blob();
      triggerDownload(blob, 'qrcode.svg');
    } catch (_) {
      showError('SVG download failed.');
    }
    return;
  }
  const blob = b64ToBlob(lastSvgB64, 'image/svg+xml');
  triggerDownload(blob, 'qrcode.svg');
});

function buildDownloadForm() {
  const fd = new FormData(form);
  return fd;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(on) {
  if (on) {
    qrSpinner.classList.remove('hidden');
    qrImg.classList.add('hidden');
    qrPlaceholder.classList.add('hidden');
    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Generating…';
  } else {
    qrSpinner.classList.add('hidden');
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="20 9 23 12 20 15"/><polyline points="15 19 12 22 9 19"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg> Generate QR Code`;
  }
}

function showError(msg) {
  genError.textContent = msg;
  genError.classList.remove('hidden');
  qrPlaceholder.classList.remove('hidden');
  qrImg.classList.add('hidden');
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function b64ToBlob(b64, mime) {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ── Init: check contrast on load ──────────────────────────────────────────────
checkContrast();
badgeEcc.textContent = eccSelect.value + ' ECC';
badgeSize.textContent = sizeRange.value + ' px';

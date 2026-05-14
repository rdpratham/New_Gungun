/* Shorthills AI Attendance – Frontend JS */

// ── Live clock in navbar ──────────────────────────────────────────────────────
(function () {
  const el = document.getElementById('live-time');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
})();

// ── Auto-dismiss flash alerts ─────────────────────────────────────────────────
document.querySelectorAll('.alert.fade.show').forEach(alert => {
  setTimeout(() => {
    bootstrap.Alert.getOrCreateInstance(alert)?.close();
  }, 5000);
});

// ── Password toggle helper ─────────────────────────────────────────────────────
document.querySelectorAll('.toggle-pwd').forEach(btn => {
  btn.addEventListener('click', () => {
    const f    = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector('i');
    if (!f) return;
    f.type     = f.type === 'password' ? 'text' : 'password';
    icon.className = f.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
  });
});

// ── Confirm destructive actions ───────────────────────────────────────────────
document.querySelectorAll('[data-confirm]').forEach(el => {
  el.addEventListener('click', e => {
    if (!confirm(el.dataset.confirm)) e.preventDefault();
  });
});

// ── Leave form: auto-calc duration hint ──────────────────────────────────────
const startInput = document.querySelector('[name="start_date"]');
const endInput   = document.querySelector('[name="end_date"]');
if (startInput && endInput) {
  const updateHint = () => {
    const s = new Date(startInput.value);
    const e = new Date(endInput.value);
    if (!startInput.value || !endInput.value || e < s) return;
    let days = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
    let hint = document.getElementById('duration-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'duration-hint';
      hint.className = 'form-text text-primary mt-1';
      endInput.parentNode.after(hint);
    }
    hint.textContent = `${days} working day${days !== 1 ? 's' : ''} (excluding weekends)`;
  };
  startInput.addEventListener('change', updateHint);
  endInput.addEventListener('change', updateHint);
}

// ── Enforce end_date >= start_date on leave form ──────────────────────────────
if (startInput) {
  startInput.addEventListener('change', () => {
    if (endInput && endInput.value < startInput.value) {
      endInput.value = startInput.value;
    }
    if (endInput) endInput.min = startInput.value;
  });
}

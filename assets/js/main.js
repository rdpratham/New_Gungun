/* Online Voting System – Frontend JS */

// ── OTP Countdown Timer ─────────────────────────────────────────────────────
function startOtpTimer(seconds, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let remaining = seconds;
  const tick = () => {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    if (remaining <= 0) {
      el.textContent = '00:00';
      el.closest('.otp-timer-wrap')?.classList.add('text-danger');
      document.getElementById('resend-btn')?.removeAttribute('disabled');
      return;
    }
    remaining--;
    setTimeout(tick, 1000);
  };
  tick();
}

// ── Candidate Card Selection ─────────────────────────────────────────────────
document.querySelectorAll('.candidate-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    const btn = document.getElementById('cast-vote-btn');
    if (btn) btn.removeAttribute('disabled');
  });
});

// ── Vote Confirmation Dialog ─────────────────────────────────────────────────
const castForm = document.getElementById('cast-vote-form');
if (castForm) {
  castForm.addEventListener('submit', e => {
    e.preventDefault();
    const selected = document.querySelector('.candidate-card.selected');
    const name = selected?.querySelector('.candidate-name')?.textContent?.trim() || 'the selected candidate';
    if (confirm(`Confirm your vote for "${name}"?\n\nThis action cannot be undone.`)) {
      castForm.submit();
    }
  });
}

// ── Auto-dismiss flash alerts ────────────────────────────────────────────────
document.querySelectorAll('.alert.fade.show').forEach(alert => {
  setTimeout(() => {
    const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
    bsAlert?.close();
  }, 5000);
});

// ── Results: animate bars on page load ──────────────────────────────────────
document.querySelectorAll('.result-bar').forEach(bar => {
  const target = bar.dataset.width || '0';
  bar.style.width = '0%';
  requestAnimationFrame(() => {
    bar.style.width = target + '%';
  });
});

// ── Session timer warning ────────────────────────────────────────────────────
(function () {
  const timeout = parseInt(document.body.dataset.sessionTimeout || '0', 10);
  if (!timeout) return;
  const warn = timeout - 120; // 2 minutes before timeout
  if (warn > 0) {
    setTimeout(() => {
      const t = document.createElement('div');
      t.className = 'toast align-items-center text-bg-warning border-0 position-fixed bottom-0 end-0 m-3';
      t.setAttribute('role', 'alert');
      t.innerHTML = `<div class="d-flex"><div class="toast-body fw-semibold">
        <i class="bi bi-clock me-1"></i>Your session will expire in 2 minutes. Please save your work.
      </div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
      document.body.appendChild(t);
      new bootstrap.Toast(t, { delay: 10000 }).show();
    }, warn * 1000);
  }
})();

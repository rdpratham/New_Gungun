// ── State ── //
let currentMOM = '';
let currentSummary = '';
let uploadedFile = null;

// ── DOM helpers ── //
const $ = id => document.getElementById(id);

function show(id)  { $(id).classList.remove('hidden'); }
function hide(id)  { $(id).classList.add('hidden'); }
function showError(msg) {
  $('errorText').textContent = msg;
  show('errorAlert');
  setTimeout(() => hide('errorAlert'), 10000);
}
function hideError() { hide('errorAlert'); }

// ── Year ── //
document.getElementById('year').textContent = new Date().getFullYear();

// ── File Upload ── //
const uploadZone = $('uploadZone');
const fileInput  = $('fileInput');

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
uploadZone.addEventListener('click', e => {
  if (e.target.closest('.btn-clear') || e.target.closest('.btn')) return;
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});
$('clearFile').addEventListener('click', e => {
  e.stopPropagation();
  uploadedFile = null;
  fileInput.value = '';
  hide('fileSelected');
});

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['txt', 'docx'].includes(ext)) {
    showError('Unsupported file type. Please upload a .txt or .docx file.');
    return;
  }
  uploadedFile = file;
  $('fileName').textContent = file.name;
  show('fileSelected');
  $('transcript').value = '';
}

// ── Stream helper ── //
// Reads a Server-Sent Events response and calls onChunk(text) for each chunk,
// then onDone(fullText) when [DONE] arrives, and onError(msg) on [ERROR].
async function readSSEStream(response, onChunk, onDone, onError) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') { onDone(full); return; }
      if (data.startsWith('[ERROR]')) { onError(data.slice(8)); return; }
      full += data;
      onChunk(data);
    }
  }
  onDone(full);
}

// ── Generate MOM ── //
async function generateMOM() {
  hideError();

  const date    = $('date').value.trim();
  const time    = $('time').value.trim();
  const subject = $('subject').value.trim();
  const mode    = $('mode').value.trim();
  const paste   = $('transcript').value.trim();

  if (!date)    { showError('Please enter the date of the call.'); return; }
  if (!subject) { showError('Please enter the subject/topic of the meeting.'); return; }
  if (!uploadedFile && !paste) {
    showError('Please upload a transcript file or paste the transcript text.');
    return;
  }

  const formData = new FormData();
  formData.append('date', formatDate(date));
  formData.append('time', formatTime(time));
  formData.append('subject', subject);
  formData.append('mode', mode);
  if (uploadedFile) {
    formData.append('file', uploadedFile);
  } else {
    formData.append('transcript', paste);
  }

  // Reset UI
  hide('momSection');
  hide('summarySection');
  hide('summaryLoading');
  currentMOM = '';
  currentSummary = '';
  show('loading');
  $('generateBtn').disabled = true;

  try {
    const res = await fetch('/generate-mom', { method: 'POST', body: formData });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed.' }));
      showError(err.error || 'Generation failed.');
      return;
    }

    // Show output panel and start streaming into it
    $('momOutput').textContent = '';
    show('momSection');

    await readSSEStream(
      res,
      chunk => {
        currentMOM += chunk;
        $('momOutput').textContent = currentMOM;
      },
      full => {
        currentMOM = full;
        $('momOutput').textContent = full;
        $('momSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      errMsg => showError(errMsg || 'Generation failed.')
    );

  } catch (err) {
    showError('Network error. Please check your connection and try again.');
  } finally {
    hide('loading');
    $('generateBtn').disabled = false;
  }
}

// ── Generate Summary ── //
async function generateSummary() {
  if (!currentMOM) { showError('Generate MOM first.'); return; }

  hide('summarySection');
  show('summaryLoading');
  currentSummary = '';
  $('summaryBtn').disabled = true;

  try {
    const res = await fetch('/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mom: currentMOM })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed.' }));
      showError(err.error || 'Summary generation failed.');
      return;
    }

    $('summaryOutput').textContent = '';
    show('summarySection');

    await readSSEStream(
      res,
      chunk => {
        currentSummary += chunk;
        $('summaryOutput').textContent = currentSummary;
      },
      full => {
        currentSummary = full;
        $('summaryOutput').textContent = full;
        $('summarySection').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      errMsg => showError(errMsg || 'Summary failed.')
    );

  } catch (err) {
    showError('Network error. Please check your connection.');
  } finally {
    hide('summaryLoading');
    $('summaryBtn').disabled = false;
  }
}

// ── Download ── //
async function downloadDoc(type, format) {
  const content = type === 'mom' ? currentMOM : currentSummary;
  if (!content) { showError('No content to download.'); return; }

  const endpoint = format === 'pdf' ? '/download-pdf' : '/download-docx';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showError(err.error || 'Download failed.');
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = res.headers.get('Content-Disposition')
                   ?.split('filename=')[1]?.replace(/"/g, '')
                 || `${type === 'mom' ? 'MOM' : 'Summary'}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    showError('Download error. Please try again.');
  }
}

// ── Helpers ── //
function formatDate(val) {
  if (!val) return '';
  const [y, m, d] = val.split('-');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function formatTime(val) {
  if (!val) return '';
  const [h, min] = val.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

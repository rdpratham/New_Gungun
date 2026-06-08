import React, { useState, useCallback, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ============================================================================
// Global Claude API helper
// ============================================================================
const callClaude = async (userPrompt, systemPrompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  const data = await res.json();
  return data.content.find(b => b.type === "text")?.text || "";
};

// ============================================================================
// Helpers
// ============================================================================
const EMPTY_CONTACT = { name: "", email: "", company: "", role: "", linkedin_url: "" };

// Try to parse JSON out of a Claude response, with a regex fallback.
const safeParseJson = (raw) => {
  if (!raw) throw new Error("Empty response");
  // strip code fences / backticks if present
  let cleaned = raw.trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // fallback: grab the first {...} or [...] block
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw e;
  }
};

// Normalise an arbitrary object into our contact shape.
const normalizeContact = (obj) => {
  const lower = {};
  Object.keys(obj || {}).forEach(k => { lower[k.trim().toLowerCase()] = obj[k]; });
  const pick = (...keys) => {
    for (const k of keys) {
      if (lower[k] != null && String(lower[k]).trim() !== "") return String(lower[k]).trim();
    }
    return "";
  };
  return {
    name: pick("name", "full name", "fullname", "contact", "first name"),
    email: pick("email", "email address", "e-mail", "mail"),
    company: pick("company", "organization", "organisation", "org", "employer"),
    role: pick("role", "title", "job title", "position", "designation"),
    linkedin_url: pick("linkedin_url", "linkedin", "linkedin url", "profile", "linkedin profile")
  };
};

// Does parsed structured data look like it has the fields we need?
const looksStructured = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const first = rows[0];
  if (typeof first !== "object" || first === null) return false;
  const keys = Object.keys(first).map(k => k.toLowerCase());
  return keys.some(k => k.includes("name") || k.includes("email"));
};

const initials = (name) => {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "?";
};

const mergeVars = (template, contact) => {
  if (!template) return "";
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, contact.name || "")
    .replace(/\{\{\s*company\s*\}\}/gi, contact.company || "")
    .replace(/\{\{\s*role\s*\}\}/gi, contact.role || "");
};

const SAMPLE_CONTACTS = [
  { name: "Sarah Chen", email: "sarah@techcorp.com", company: "TechCorp", role: "VP of Engineering", linkedin_url: "https://linkedin.com/in/sarahchen" },
  { name: "Marcus Williams", email: "marcus@growthco.io", company: "GrowthCo", role: "Head of Marketing", linkedin_url: "https://linkedin.com/in/marcuswilliams" },
  { name: "Priya Patel", email: "priya@startupxyz.com", company: "StartupXYZ", role: "CEO", linkedin_url: "" }
];

const SAMPLE_SUBJECT = "Quick idea for {{company}}, {{name}}";
const SAMPLE_EMAIL_BODY = `Hi {{name}},

I came across {{company}} and was really impressed by what you're building.

As {{role}}, I imagine you're always looking for ways to [relevant benefit].

I'd love to show you how we've helped similar companies achieve [result].

Would you be open to a 15-minute call this week?

Best,`;
const SAMPLE_LINKEDIN = `Hi {{name}}, loved what {{company}} is doing in the space.
As {{role}}, thought this might be relevant to you — would love to connect!`;

const TONES = ["Professional", "Friendly", "Direct", "Creative"];
const STEPS = ["Import contacts", "Message templates", "AI personalize", "Send"];

// ============================================================================
// Styles (injected once) — uses CSS variables, light/dark compatible.
// ============================================================================
const STYLE_ID = "outreach-agent-styles";
const CSS = `
:root {
  --color-background-primary: #ffffff;
  --color-background-secondary: #f6f7f8;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #6b7280;
  --color-border-tertiary: #e5e7eb;
  --color-border-secondary: #d1d5db;
  --color-background-success: #e6f4ea;
  --color-text-success: #1e7e34;
  --color-background-warning: #fdf3e2;
  --color-text-warning: #b06b00;
  --color-background-danger: #fdeaea;
  --color-text-danger: #c0392b;
  --color-accent: #1a1a1a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #1e1f22;
    --color-background-secondary: #161718;
    --color-text-primary: #e8e8e8;
    --color-text-secondary: #9aa0a6;
    --color-border-tertiary: #34363a;
    --color-border-secondary: #45474c;
    --color-background-success: #15301f;
    --color-text-success: #6cc28a;
    --color-background-warning: #3a2c12;
    --color-text-warning: #e0a64b;
    --color-background-danger: #3a1c1c;
    --color-text-danger: #e07a72;
    --color-accent: #e8e8e8;
  }
}
.oa-root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  min-height: 100vh;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.7;
  padding: 1.5rem;
  box-sizing: border-box;
}
.oa-root *, .oa-root *::before, .oa-root *::after { box-sizing: border-box; }
.oa-container { max-width: 900px; margin: 0 auto; }
.oa-root h1 { font-size: 22px; font-weight: 500; margin: 0 0 0.25rem; }
.oa-root h2 { font-size: 18px; font-weight: 500; margin: 0 0 0.75rem; }
.oa-root p { margin: 0 0 0.75rem; }
.oa-small { font-size: 13px; color: var(--color-text-secondary); }
.oa-label { font-size: 13px; color: var(--color-text-secondary); display: block; margin-bottom: 0.35rem; }

.oa-card {
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.oa-btn {
  background: transparent;
  border: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-primary);
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  line-height: 1.4;
  transition: background 0.12s ease, transform 0.05s ease;
  font-family: inherit;
}
.oa-btn:hover:not(:disabled) { background: var(--color-background-secondary); }
.oa-btn:active:not(:disabled) { transform: scale(0.98); }
.oa-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.oa-btn-primary {
  background: var(--color-accent);
  color: var(--color-background-primary);
  border-color: var(--color-accent);
}
.oa-btn-primary:hover:not(:disabled) { opacity: 0.9; background: var(--color-accent); }
.oa-btn-icon { padding: 0.45rem 0.55rem; }

.oa-input, .oa-textarea {
  width: 100%;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-primary);
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
}
.oa-input:focus, .oa-textarea:focus { outline: none; border-color: var(--color-border-secondary); }
.oa-textarea { resize: vertical; }

/* Step bar */
.oa-steps { display: flex; align-items: center; margin-bottom: 1.75rem; }
.oa-step { display: flex; align-items: center; flex: 1; }
.oa-step:last-child { flex: 0; }
.oa-step-node { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.oa-step-circle {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 0.5px solid var(--color-border-secondary);
  font-size: 14px; flex-shrink: 0;
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
}
.oa-step-circle.active { background: var(--color-accent); color: var(--color-background-primary); border-color: var(--color-accent); }
.oa-step-circle.done { background: var(--color-background-success); color: var(--color-text-success); border-color: var(--color-background-success); }
.oa-step-label { font-size: 13px; color: var(--color-text-secondary); white-space: nowrap; }
.oa-step-label.active { color: var(--color-text-primary); font-weight: 500; }
.oa-step-line { flex: 1; height: 0.5px; background: var(--color-border-tertiary); margin: 0 0.5rem; margin-bottom: 1.4rem; }

/* Upload zone */
.oa-dropzone {
  border: 1px dashed var(--color-border-secondary);
  border-radius: 12px;
  padding: 2rem 1rem;
  text-align: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.12s ease;
}
.oa-dropzone:hover, .oa-dropzone.drag { background: var(--color-background-secondary); }
.oa-dropzone i { font-size: 28px; }

/* Table */
.oa-table-wrap { overflow-x: auto; }
.oa-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.oa-table th {
  text-align: left; font-size: 13px; font-weight: 500; color: var(--color-text-secondary);
  padding: 0.5rem 0.6rem; border-bottom: 0.5px solid var(--color-border-tertiary);
}
.oa-table td { padding: 0.2rem 0.4rem; border-bottom: 0.5px solid var(--color-border-tertiary); }
.oa-cell {
  width: 100%; border: 0.5px solid transparent; background: transparent;
  color: var(--color-text-primary); border-radius: 6px; padding: 0.4rem 0.5rem;
  font-size: 14px; font-family: inherit;
}
.oa-cell:hover { border-color: var(--color-border-tertiary); }
.oa-cell:focus { outline: none; border-color: var(--color-border-secondary); background: var(--color-background-secondary); }

/* Badges */
.oa-badge {
  font-size: 13px; padding: 0.15rem 0.55rem; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 0.3rem;
}
.oa-badge-pending { background: var(--color-background-secondary); color: var(--color-text-secondary); }
.oa-badge-sent { background: var(--color-background-success); color: var(--color-text-success); }
.oa-badge-skipped { background: var(--color-background-warning); color: var(--color-text-warning); }

/* Avatar */
.oa-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; border: 0.5px solid var(--color-border-tertiary);
}

/* Tabs */
.oa-tabs { display: flex; gap: 0.25rem; margin-bottom: 0.75rem; }
.oa-tab {
  background: transparent; border: none; border-bottom: 1.5px solid transparent;
  color: var(--color-text-secondary); padding: 0.35rem 0.5rem; cursor: pointer;
  font-size: 14px; font-family: inherit; display: inline-flex; gap: 0.35rem; align-items: center;
}
.oa-tab.active { color: var(--color-text-primary); border-bottom-color: var(--color-accent); }

/* Misc */
.oa-row { display: flex; align-items: center; gap: 0.75rem; }
.oa-between { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.oa-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.oa-progress-track { width: 100%; height: 6px; background: var(--color-background-secondary); border-radius: 999px; overflow: hidden; }
.oa-progress-fill { height: 100%; background: var(--color-accent); transition: width 0.2s ease; }
.oa-error { background: var(--color-background-danger); color: var(--color-text-danger); padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 14px; margin-bottom: 0.75rem; }
.oa-warn { background: var(--color-background-warning); color: var(--color-text-warning); padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 13px; margin-bottom: 0.75rem; }
.oa-spinner {
  width: 14px; height: 14px; border: 2px solid var(--color-border-secondary);
  border-top-color: var(--color-text-primary); border-radius: 50%;
  display: inline-block; animation: oa-spin 0.7s linear infinite;
}
@keyframes oa-spin { to { transform: rotate(360deg); } }
.oa-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
.oa-metric { text-align: center; padding: 0.75rem; }
.oa-metric-num { font-size: 22px; font-weight: 500; }
.oa-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
.oa-text-danger { color: var(--color-text-danger); }
.oa-text-success { color: var(--color-text-success); }
.oa-divider { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 1.25rem 0; }
.oa-send-row { display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex-wrap: wrap; }
.oa-send-row.skipped { opacity: 0.5; }
.oa-tooltip { position: relative; }
.oa-tooltip-text {
  position: absolute; bottom: 120%; right: 0; background: var(--color-text-primary);
  color: var(--color-background-primary); font-size: 12px; padding: 0.3rem 0.5rem;
  border-radius: 6px; white-space: nowrap; z-index: 5;
}
@media (max-width: 640px) {
  .oa-metrics { grid-template-columns: repeat(2, 1fr); }
  .oa-step-label { display: none; }
  .oa-root { padding: 1rem; }
}
`;

function useInjectStyles() {
  useEffect(() => {
    // Tabler icons
    if (!document.getElementById("oa-tabler-icons")) {
      const link = document.createElement("link");
      link.id = "oa-tabler-icons";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";
      document.head.appendChild(link);
    }
    // component styles
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
  }, []);
}

// ============================================================================
// Step progress bar
// ============================================================================
function StepBar({ step, onGoto }) {
  return (
    <div className="oa-steps">
      {STEPS.map((label, i) => {
        const isActive = i === step;
        const isDone = i < step;
        return (
          <React.Fragment key={label}>
            <div className="oa-step">
              <div
                className="oa-step-node"
                style={{ cursor: i < step ? "pointer" : "default" }}
                onClick={() => { if (i < step) onGoto(i); }}
              >
                <div className={`oa-step-circle ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
                  {isDone ? <i className="ti ti-check" aria-hidden="true"></i> : i + 1}
                </div>
                <span className={`oa-step-label ${isActive ? "active" : ""}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="oa-step-line" />}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
// STEP 1 — Import contacts
// ============================================================================
function StepImport({ contacts, setContacts, onContinue }) {
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const readFileAsText = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(f);
  });
  const readFileAsArrayBuffer = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(f);
  });

  const extractViaClaude = async (rawContent) => {
    const system = `You are a contact data parser. Extract all contacts from the input no matter what format it is in — CSV, JSON, plain text, copied tables, business card text, email signatures, or anything else. Return ONLY a raw JSON array with no explanation, no markdown, no backticks, no preamble. Each object must have exactly these keys: name, email, company, role, linkedin_url. Use empty string for any missing field. Example output: [{"name":"John Smith","email":"john@acme.com","company":"Acme","role":"CTO","linkedin_url":""}]`;
    const raw = await callClaude(rawContent, system);
    const parsed = safeParseJson(raw);
    if (!Array.isArray(parsed)) throw new Error("Expected array");
    return parsed.map(normalizeContact);
  };

  const handleParse = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      let structuredRows = null;   // parsed array of objects, if we got one
      let textContent = null;      // raw text to fall back on

      if (file) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".csv")) {
          const text = await readFileAsText(file);
          const result = Papa.parse(text, { header: true, skipEmptyLines: true });
          structuredRows = result.data;
          textContent = text;
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          const buf = await readFileAsArrayBuffer(file);
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          structuredRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          textContent = XLSX.utils.sheet_to_csv(sheet);
        } else if (name.endsWith(".json")) {
          const text = await readFileAsText(file);
          try {
            const parsed = JSON.parse(text);
            structuredRows = Array.isArray(parsed) ? parsed : (parsed.contacts || [parsed]);
          } catch {
            structuredRows = null;
          }
          textContent = text;
        } else {
          // .txt, .pdf, or anything else — read as text, let Claude handle it
          try {
            textContent = await readFileAsText(file);
          } catch {
            textContent = "";
          }
        }
      } else if (pasted.trim()) {
        textContent = pasted;
        // try structured detection on pasted content (CSV / JSON)
        const t = pasted.trim();
        if (t.startsWith("[") || t.startsWith("{")) {
          try {
            const parsed = JSON.parse(t);
            structuredRows = Array.isArray(parsed) ? parsed : (parsed.contacts || [parsed]);
          } catch { /* ignore */ }
        }
        if (!structuredRows) {
          const result = Papa.parse(t, { header: true, skipEmptyLines: true });
          if (result.data && result.data.length && looksStructured(result.data)) {
            structuredRows = result.data;
          }
        }
      } else {
        throw new Error("No input");
      }

      let finalContacts;
      if (structuredRows && looksStructured(structuredRows)) {
        finalContacts = structuredRows.map(normalizeContact).filter(c =>
          c.name || c.email || c.company || c.role
        );
        // if mapping produced mostly empty rows, fall back to Claude
        const usable = finalContacts.filter(c => c.name || c.email);
        if (usable.length === 0) {
          finalContacts = await extractViaClaude(textContent || JSON.stringify(structuredRows));
        }
      } else {
        finalContacts = await extractViaClaude(textContent || "");
      }

      if (!finalContacts || finalContacts.length === 0) {
        throw new Error("No contacts found");
      }
      setContacts(finalContacts);
    } catch (e) {
      setError("Could not parse contacts. Try a different format or paste the data manually.");
    } finally {
      setLoading(false);
    }
  }, [file, pasted, setContacts]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setPasted("");
    }
  };

  const updateCell = (idx, key, value) => {
    setContacts(prev => prev.map((c, i) => i === idx ? { ...c, [key]: value } : c));
  };
  const addRow = () => setContacts(prev => [...prev, { ...EMPTY_CONTACT }]);
  const deleteRow = (idx) => setContacts(prev => prev.filter((_, i) => i !== idx));

  const missingEmail = contacts.filter(c => !c.email.trim()).length;

  return (
    <div>
      <h1>Import contacts</h1>
      <p className="oa-small">Upload a file or paste anything — Claude will read it.</p>

      <div className="oa-card">
        <h2>Upload a file</h2>
        <div
          className={`oa-dropzone ${dragging ? "drag" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div><i className="ti ti-upload" aria-hidden="true"></i></div>
          {file
            ? <div><i className="ti ti-file" aria-hidden="true"></i> {file.name}</div>
            : <div>Drag and drop a file here, or click to browse</div>}
          <div className="oa-small">.csv, .xlsx, .xls, .json, .txt, .pdf — any format</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json,.txt,.pdf,*/*"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) { setFile(e.target.files[0]); setPasted(""); } }}
        />
      </div>

      <div className="oa-card">
        <h2>Or paste contacts</h2>
        <textarea
          className="oa-textarea"
          style={{ minHeight: "140px" }}
          value={pasted}
          onChange={(e) => { setPasted(e.target.value); if (e.target.value) setFile(null); }}
          placeholder="Paste anything here — copied table from Excel, list of names and emails, JSON, unstructured text like 'John Smith CTO at Acme john@acme.com linkedin.com/in/john'..."
        />
      </div>

      {error && <div className="oa-error">{error}</div>}

      <div className="oa-actions" style={{ marginBottom: "1.5rem" }}>
        <button className="oa-btn oa-btn-primary" onClick={handleParse} disabled={loading || (!file && !pasted.trim())}>
          {loading ? <><span className="oa-spinner" /> Claude is reading your data...</> : <><i className="ti ti-table" aria-hidden="true"></i> Parse contacts</>}
        </button>
        <button className="oa-btn" onClick={() => { setContacts(SAMPLE_CONTACTS.map(c => ({ ...c }))); setError(""); }} disabled={loading}>
          <i className="ti ti-user" aria-hidden="true"></i> Load sample data
        </button>
      </div>

      {contacts.length > 0 && (
        <div className="oa-card">
          <div className="oa-between" style={{ marginBottom: "0.75rem" }}>
            <h2 style={{ margin: 0 }}>{contacts.length} contact{contacts.length !== 1 ? "s" : ""} loaded</h2>
            <button className="oa-btn" onClick={addRow}><i className="ti ti-user" aria-hidden="true"></i> Add row</button>
          </div>

          {missingEmail > 0 && (
            <div className="oa-warn">
              <i className="ti ti-mail" aria-hidden="true"></i> {missingEmail} contact{missingEmail !== 1 ? "s are" : " is"} missing an email address.
            </div>
          )}

          <div className="oa-table-wrap">
            <table className="oa-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>LinkedIn URL</th><th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, idx) => (
                  <tr key={idx}>
                    {["name", "email", "company", "role", "linkedin_url"].map(key => (
                      <td key={key}>
                        <input
                          className="oa-cell"
                          value={c[key]}
                          onChange={(e) => updateCell(idx, key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button className="oa-btn oa-btn-icon" onClick={() => deleteRow(idx)} aria-label="Delete row">
                        <i className="ti ti-trash" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button className="oa-btn oa-btn-primary" onClick={onContinue} disabled={contacts.length === 0}>
              Continue to templates <i className="ti ti-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP 2 — Message templates
// ============================================================================
function StepTemplates({ contacts, templates, setTemplates, onContinue, onBack }) {
  const first = contacts[0] || EMPTY_CONTACT;
  const set = (patch) => setTemplates(prev => ({ ...prev, ...patch }));

  const previewSubject = mergeVars(templates.subject, first);
  const previewBody = mergeVars(templates.body, first);
  const previewLinkedin = mergeVars(templates.linkedin, first);

  const liLen = previewLinkedin.length;
  const canContinue = templates.body.trim() && templates.subject.trim();

  return (
    <div>
      <h1>Message templates</h1>
      <p className="oa-small">Use {"{{name}}"}, {"{{company}}"}, {"{{role}}"} as variables.</p>

      {/* EMAIL */}
      <div className="oa-card">
        <h2><i className="ti ti-mail" aria-hidden="true"></i> Email template</h2>

        <label className="oa-label">Subject</label>
        <input
          className="oa-input"
          value={templates.subject}
          onChange={(e) => set({ subject: e.target.value })}
          placeholder="e.g. Quick intro — {{company}}"
          style={{ marginBottom: "0.9rem" }}
        />

        <label className="oa-label">Body</label>
        <textarea
          className="oa-textarea"
          style={{ minHeight: "150px" }}
          value={templates.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder={"Hi {{name}},\n\nI came across {{company}} and was impressed by what you're building. As {{role}}, I thought..."}
        />
        <div className="oa-small" style={{ marginTop: "0.3rem" }}>{templates.body.length} characters</div>

        <label className="oa-label" style={{ marginTop: "0.9rem" }}>Tone</label>
        <div className="oa-actions">
          {TONES.map(t => (
            <button key={t} className={`oa-btn ${templates.tone === t ? "oa-btn-primary" : ""}`} onClick={() => set({ tone: t })}>{t}</button>
          ))}
        </div>

        <hr className="oa-divider" />
        <label className="oa-label">Preview — {first.name || "first contact"}</label>
        <div className="oa-card" style={{ marginBottom: 0, background: "var(--color-background-secondary)" }}>
          <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>{previewSubject || "(no subject)"}</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{previewBody || "(no body)"}</div>
        </div>
      </div>

      {/* LINKEDIN */}
      <div className="oa-card">
        <h2><i className="ti ti-brand-linkedin" aria-hidden="true"></i> LinkedIn InMail template</h2>

        <label className="oa-label">Body</label>
        <textarea
          className="oa-textarea"
          style={{ minHeight: "120px" }}
          value={templates.linkedin}
          onChange={(e) => set({ linkedin: e.target.value })}
          placeholder={"Hi {{name}}, loved what {{company}} is doing. As {{role}}, thought this might be relevant — would love to connect!"}
        />
        <div className="oa-small" style={{ marginTop: "0.3rem", color: templates.linkedin.length > 300 ? "var(--color-text-danger)" : undefined }}>
          {templates.linkedin.length}/300
        </div>

        <label className="oa-label" style={{ marginTop: "0.9rem" }}>Tone</label>
        <div className="oa-actions">
          {TONES.map(t => (
            <button key={t} className={`oa-btn ${templates.tone === t ? "oa-btn-primary" : ""}`} onClick={() => set({ tone: t })}>{t}</button>
          ))}
        </div>

        <hr className="oa-divider" />
        <label className="oa-label">Preview — {first.name || "first contact"}</label>
        <div className="oa-card" style={{ marginBottom: 0, background: "var(--color-background-secondary)" }}>
          <div style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{previewLinkedin || "(no message)"}</div>
          <div className="oa-small" style={{ marginTop: "0.4rem", color: liLen > 300 ? "var(--color-text-danger)" : undefined }}>{liLen}/300</div>
        </div>
      </div>

      <div className="oa-actions" style={{ marginBottom: "1.5rem" }}>
        <button className="oa-btn" onClick={onBack}><i className="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
        <button className="oa-btn oa-btn-primary" onClick={onContinue} disabled={!canContinue}>
          Continue to personalize <i className="ti ti-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3 — AI personalize
// ============================================================================
function StepPersonalize({ contacts, templates, results, setResults, onContinue, onBack }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [activeTabs, setActiveTabs] = useState({}); // idx -> "email" | "linkedin"
  const [retrying, setRetrying] = useState({});

  const personalizeOne = async (contact) => {
    const system = `You are an expert outreach copywriter. Your job is to personalize outreach messages for specific contacts. Make the message feel genuinely personal and relevant — reference their role and company naturally. Keep the core message and call to action intact. Return ONLY a raw JSON object with no explanation, no markdown, no backticks. Keys: email_subject, email_body, linkedin_message.`;
    const user = `Personalize these templates for this contact.
Contact: {name: '${contact.name}', company: '${contact.company}', role: '${contact.role}'}
Email subject template: ${templates.subject}
Email body template: ${templates.body}
LinkedIn template: ${templates.linkedin}
Tone: ${templates.tone}
Make it personal, relevant, and natural. Keep similar length.`;
    const raw = await callClaude(user, system);
    const parsed = safeParseJson(raw);
    return {
      email_subject: parsed.email_subject || mergeVars(templates.subject, contact),
      email_body: parsed.email_body || mergeVars(templates.body, contact),
      linkedin_message: parsed.linkedin_message || mergeVars(templates.linkedin, contact),
      edited: false,
      error: false
    };
  };

  const personalizeAll = async () => {
    setError("");
    setRunning(true);
    setProgress(0);
    const out = [];
    for (let i = 0; i < contacts.length; i++) {
      setProgress(i + 1);
      try {
        out.push(await personalizeOne(contacts[i]));
      } catch (e) {
        out.push({
          email_subject: mergeVars(templates.subject, contacts[i]),
          email_body: mergeVars(templates.body, contacts[i]),
          linkedin_message: mergeVars(templates.linkedin, contacts[i]),
          edited: false,
          error: true
        });
      }
      setResults([...out]);
    }
    setRunning(false);
  };

  const retryOne = async (idx) => {
    setRetrying(prev => ({ ...prev, [idx]: true }));
    try {
      const r = await personalizeOne(contacts[idx]);
      setResults(prev => prev.map((x, i) => i === idx ? r : x));
    } catch (e) {
      setResults(prev => prev.map((x, i) => i === idx ? { ...x, error: true } : x));
    } finally {
      setRetrying(prev => ({ ...prev, [idx]: false }));
    }
  };

  const updateResult = (idx, key, value) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value, edited: true } : r));
  };

  const hasResults = results.length > 0;
  const allDone = hasResults && results.length === contacts.length && !running;

  return (
    <div>
      <h1>AI personalize</h1>
      <p className="oa-small">Ready to personalize for {contacts.length} contact{contacts.length !== 1 ? "s" : ""}.</p>

      {error && <div className="oa-error">{error}</div>}

      <div className="oa-card">
        <div className="oa-between">
          <div>
            {running
              ? <span><span className="oa-spinner" /> Personalizing contact {progress} of {contacts.length}...</span>
              : hasResults
                ? <span className="oa-text-success"><i className="ti ti-check" aria-hidden="true"></i> Personalized {results.length} contact{results.length !== 1 ? "s" : ""}</span>
                : <span>Generate personalized messages for every contact.</span>}
          </div>
          <button className="oa-btn oa-btn-primary" onClick={personalizeAll} disabled={running}>
            {running ? <><span className="oa-spinner" /> Working...</> : <><i className="ti ti-refresh" aria-hidden="true"></i> {hasResults ? "Re-personalize all" : "Personalize all"}</>}
          </button>
        </div>
        {running && (
          <div className="oa-progress-track" style={{ marginTop: "0.75rem" }}>
            <div className="oa-progress-fill" style={{ width: `${(progress / Math.max(contacts.length, 1)) * 100}%` }} />
          </div>
        )}
      </div>

      {results.map((r, idx) => {
        const c = contacts[idx];
        if (!c) return null;
        const tab = activeTabs[idx] || "email";
        const liLen = (r.linkedin_message || "").length;
        return (
          <div className="oa-card" key={idx} style={{ borderColor: r.edited ? "var(--color-text-success)" : undefined }}>
            <div className="oa-row" style={{ marginBottom: "0.75rem" }}>
              <div className="oa-avatar">{initials(c.name)}</div>
              <div>
                <div style={{ fontWeight: 500 }}>{c.name || "(no name)"}</div>
                <div className="oa-small">{c.role || "—"} @ {c.company || "—"}</div>
              </div>
              {r.error && (
                <button className="oa-btn" style={{ marginLeft: "auto" }} onClick={() => retryOne(idx)} disabled={retrying[idx]}>
                  {retrying[idx] ? <span className="oa-spinner" /> : <i className="ti ti-refresh" aria-hidden="true"></i>} Retry
                </button>
              )}
            </div>

            {r.error && <div className="oa-error">Could not personalize this contact. Showing the merged template — retry above.</div>}

            <div className="oa-tabs">
              <button className={`oa-tab ${tab === "email" ? "active" : ""}`} onClick={() => setActiveTabs(p => ({ ...p, [idx]: "email" }))}>
                <i className="ti ti-mail" aria-hidden="true"></i> Email
              </button>
              <button className={`oa-tab ${tab === "linkedin" ? "active" : ""}`} onClick={() => setActiveTabs(p => ({ ...p, [idx]: "linkedin" }))}>
                <i className="ti ti-brand-linkedin" aria-hidden="true"></i> LinkedIn
              </button>
            </div>

            {tab === "email" ? (
              <div>
                <label className="oa-label">Subject</label>
                <input className="oa-input" value={r.email_subject} onChange={(e) => updateResult(idx, "email_subject", e.target.value)} style={{ marginBottom: "0.75rem" }} />
                <label className="oa-label">Body</label>
                <textarea className="oa-textarea" style={{ minHeight: "160px" }} value={r.email_body} onChange={(e) => updateResult(idx, "email_body", e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="oa-label">Message</label>
                <textarea className="oa-textarea" style={{ minHeight: "120px" }} value={r.linkedin_message} onChange={(e) => updateResult(idx, "linkedin_message", e.target.value)} />
                <div className="oa-small" style={{ marginTop: "0.3rem", color: liLen > 300 ? "var(--color-text-danger)" : undefined }}>{liLen}/300</div>
              </div>
            )}
          </div>
        );
      })}

      <div className="oa-actions" style={{ marginBottom: "1.5rem" }}>
        <button className="oa-btn" onClick={onBack}><i className="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
        <button className="oa-btn oa-btn-primary" onClick={onContinue} disabled={!allDone}>
          Continue to send <i className="ti ti-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4 — Send
// ============================================================================
function StepSend({ contacts, results, statuses, setStatuses, onBack }) {
  const [copied, setCopied] = useState({});
  const [tooltip, setTooltip] = useState({});

  const setStatus = (idx, status) => setStatuses(prev => ({ ...prev, [idx]: status }));

  const total = contacts.length;
  const sent = Object.values(statuses).filter(s => s === "Sent").length;
  const skipped = Object.values(statuses).filter(s => s === "Skipped").length;
  const pending = total - sent - skipped;

  const openInOutlook = (idx) => {
    const c = contacts[idx];
    const r = results[idx] || {};
    const url = `mailto:${c.email}?subject=${encodeURIComponent(r.email_subject || "")}&body=${encodeURIComponent(r.email_body || "")}`;
    window.location.href = url;
    setStatus(idx, "Sent");
  };

  const copyLinkedin = (idx) => {
    const r = results[idx] || {};
    navigator.clipboard?.writeText(r.linkedin_message || "");
    setCopied(prev => ({ ...prev, [idx]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [idx]: false })), 2000);
  };

  const openProfile = (idx) => {
    const c = contacts[idx];
    if (c.linkedin_url) {
      window.open(c.linkedin_url, "_blank");
    } else {
      setTooltip(prev => ({ ...prev, [idx]: true }));
      setTimeout(() => setTooltip(prev => ({ ...prev, [idx]: false })), 2000);
    }
  };

  const sendAll = async () => {
    for (let idx = 0; idx < contacts.length; idx++) {
      if ((statuses[idx] || "Pending") === "Pending") {
        const c = contacts[idx];
        const r = results[idx] || {};
        const url = `mailto:${c.email}?subject=${encodeURIComponent(r.email_subject || "")}&body=${encodeURIComponent(r.email_body || "")}`;
        window.location.href = url;
        setStatus(idx, "Sent");
        await new Promise(res => setTimeout(res, 500));
      }
    }
  };

  const exportResults = () => {
    const header = ["name", "email", "company", "role", "status", "email_subject", "linkedin_message"];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = contacts.map((c, idx) => {
      const r = results[idx] || {};
      return [c.name, c.email, c.company, c.role, statuses[idx] || "Pending", r.email_subject || "", r.linkedin_message || ""].map(escape).join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outreach-results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const badgeClass = (status) => status === "Sent" ? "oa-badge-sent" : status === "Skipped" ? "oa-badge-skipped" : "oa-badge-pending";

  return (
    <div>
      <h1>Send</h1>

      <div className="oa-card">
        <div className="oa-metrics">
          <div className="oa-metric"><div className="oa-metric-num">{total}</div><div className="oa-small">Total contacts</div></div>
          <div className="oa-metric"><div className="oa-metric-num oa-text-success">{sent}</div><div className="oa-small">Sent</div></div>
          <div className="oa-metric"><div className="oa-metric-num" style={{ color: "var(--color-text-secondary)" }}>{pending}</div><div className="oa-small">Pending</div></div>
          <div className="oa-metric"><div className="oa-metric-num" style={{ color: "var(--color-text-warning)" }}>{skipped}</div><div className="oa-small">Skipped</div></div>
        </div>
        <hr className="oa-divider" />
        <div className="oa-actions">
          <button className="oa-btn oa-btn-primary" onClick={sendAll} disabled={pending === 0}>
            <i className="ti ti-mail" aria-hidden="true"></i> Send all emails
          </button>
          <button className="oa-btn" onClick={exportResults}>
            <i className="ti ti-download" aria-hidden="true"></i> Export results
          </button>
        </div>
      </div>

      {contacts.map((c, idx) => {
        const status = statuses[idx] || "Pending";
        const r = results[idx] || {};
        return (
          <div className={`oa-card oa-send-row ${status === "Skipped" ? "skipped" : ""}`} key={idx}>
            <div className="oa-row">
              <div className="oa-avatar">{initials(c.name)}</div>
              <div>
                <div style={{ fontWeight: 500 }}>{c.name || "(no name)"}</div>
                <div className="oa-small">{c.role || "—"} @ {c.company || "—"}</div>
                <span className={`oa-badge ${badgeClass(status)}`} style={{ marginTop: "0.3rem" }}>{status}</span>
              </div>
            </div>

            <div className="oa-actions">
              <button className="oa-btn" onClick={() => openInOutlook(idx)}>
                {status === "Sent"
                  ? <><i className="ti ti-check" aria-hidden="true"></i> Opened</>
                  : <><i className="ti ti-mail" aria-hidden="true"></i> Open in Outlook</>}
              </button>
              <button className="oa-btn" onClick={() => copyLinkedin(idx)}>
                {copied[idx]
                  ? <><i className="ti ti-check" aria-hidden="true"></i> Copied!</>
                  : <><i className="ti ti-copy" aria-hidden="true"></i> Copy LinkedIn</>}
              </button>
              <div className="oa-tooltip">
                <button className="oa-btn oa-btn-icon" onClick={() => openProfile(idx)} aria-label="Open profile">
                  <i className="ti ti-external-link" aria-hidden="true"></i>
                </button>
                {tooltip[idx] && <span className="oa-tooltip-text">No LinkedIn URL for this contact</span>}
              </div>
              <button className="oa-btn oa-btn-icon" onClick={() => setStatus(idx, "Skipped")} aria-label="Skip">
                <i className="ti ti-x" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        );
      })}

      <div className="oa-actions" style={{ marginBottom: "1.5rem" }}>
        <button className="oa-btn" onClick={onBack}><i className="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
      </div>
    </div>
  );
}

// ============================================================================
// Root component
// ============================================================================
export default function OutreachAgent() {
  useInjectStyles();

  const [step, setStep] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState({
    subject: SAMPLE_SUBJECT,
    body: SAMPLE_EMAIL_BODY,
    linkedin: SAMPLE_LINKEDIN,
    tone: "Professional"
  });
  const [results, setResults] = useState([]);
  const [statuses, setStatuses] = useState({});

  return (
    <div className="oa-root">
      <div className="oa-container">
        <StepBar step={step} onGoto={setStep} />

        {step === 0 && (
          <StepImport
            contacts={contacts}
            setContacts={setContacts}
            onContinue={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepTemplates
            contacts={contacts}
            templates={templates}
            setTemplates={setTemplates}
            onContinue={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepPersonalize
            contacts={contacts}
            templates={templates}
            results={results}
            setResults={setResults}
            onContinue={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepSend
            contacts={contacts}
            results={results}
            statuses={statuses}
            setStatuses={setStatuses}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}

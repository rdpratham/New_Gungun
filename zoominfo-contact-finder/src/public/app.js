const linkedinInput = document.getElementById("linkedinUrl");
const companyHintInput = document.getElementById("companyHint");
const findBtn = document.getElementById("findBtn");
const clearBtn = document.getElementById("clearBtn");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const resultCard = document.getElementById("resultCard");
const candidatesCard = document.getElementById("candidatesCard");
const candidatesList = document.getElementById("candidatesList");
const confidenceBadge = document.getElementById("confidenceBadge");

const fields = {
  name: document.getElementById("fieldName"),
  title: document.getElementById("fieldTitle"),
  company: document.getElementById("fieldCompany"),
  email: document.getElementById("fieldEmail"),
  phone: document.getElementById("fieldPhone"),
  mobile: document.getElementById("fieldMobile"),
  location: document.getElementById("fieldLocation"),
  linkedin: document.getElementById("fieldLinkedin"),
  zoominfo: document.getElementById("fieldZoominfo"),
};

let currentContact = null;

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function resetUI() {
  hide(errorBox);
  hide(resultCard);
  hide(candidatesCard);
  errorBox.textContent = "";
}

function renderContact(contact, confidence) {
  fields.name.textContent = contact.name || "Not available";
  fields.title.textContent = contact.title || "Not available";
  fields.company.textContent = contact.company || "Not available";
  fields.email.textContent = contact.email || "Email unavailable";
  fields.phone.textContent = contact.phone || contact.companyPhone || "Phone unavailable";
  fields.mobile.textContent = contact.mobile || "Not available";
  fields.location.textContent = contact.location || "Not available";

  fields.linkedin.innerHTML = contact.linkedinUrl
    ? `<a href="${contact.linkedinUrl}" target="_blank" rel="noopener">${contact.linkedinUrl}</a>`
    : "Not available";
  fields.zoominfo.innerHTML = contact.zoominfoUrl
    ? `<a href="${contact.zoominfoUrl}" target="_blank" rel="noopener">${contact.zoominfoUrl}</a>`
    : "Not available";

  confidenceBadge.textContent = `${Math.round(confidence)}% confidence`;
  currentContact = contact;
  show(resultCard);
}

function renderCandidates(candidates) {
  candidatesList.innerHTML = "";
  candidates.forEach((candidate) => {
    const li = document.createElement("li");
    li.className = "candidate-item";
    li.innerHTML = `
      <div class="candidate-info">
        <strong>${candidate.contact.name || "Unknown name"}</strong>
        <span>${candidate.contact.title || ""} ${candidate.contact.company ? "at " + candidate.contact.company : ""}</span>
        <span>${Math.round(candidate.confidence)}% confidence — ${candidate.matchReasons.join(", ")}</span>
      </div>
      <button class="btn primary select-candidate">Select</button>
    `;
    li.querySelector(".select-candidate").addEventListener("click", () => {
      hide(candidatesCard);
      renderContact(candidate.contact, candidate.confidence);
    });
    candidatesList.appendChild(li);
  });
  show(candidatesCard);
}

function showError(message) {
  errorBox.textContent = message;
  show(errorBox);
}

async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    const tbody = document.getElementById("historyBody");
    const empty = document.getElementById("historyEmpty");
    tbody.innerHTML = "";
    if (!data.entries || data.entries.length === 0) {
      show(empty);
      return;
    }
    hide(empty);
    data.entries.forEach((entry) => {
      const tr = document.createElement("tr");
      const date = new Date(entry.searchDate).toLocaleString();
      tr.innerHTML = `
        <td>${date}</td>
        <td>${entry.name || "—"}</td>
        <td>${entry.company || "—"}</td>
        <td>${entry.email || "—"}</td>
        <td>${entry.phone || "—"}</td>
        <td>${Math.round(entry.matchConfidence)}%</td>
      `;
      tbody.appendChild(tr);
    });
  } catch {
    // History is a convenience feature; silently skip if it can't load.
  }
}

findBtn.addEventListener("click", async () => {
  resetUI();
  const linkedinUrl = linkedinInput.value.trim();
  const companyHint = companyHintInput.value.trim();

  if (!linkedinUrl) {
    showError("Please paste a LinkedIn profile URL first.");
    return;
  }

  show(loading);
  findBtn.disabled = true;

  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl, companyHint }),
    });
    const data = await res.json();

    if (data.success) {
      renderContact(data.contact, data.confidence);
      loadHistory();
      return;
    }

    if (data.error?.code === "multiple_matches" && data.error.candidates) {
      renderCandidates(data.error.candidates);
      return;
    }

    showError(data.error?.message || "Something went wrong. Please try again.");
  } catch {
    showError("Network error: could not reach the local server. Is it running?");
  } finally {
    hide(loading);
    findBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  linkedinInput.value = "";
  companyHintInput.value = "";
  currentContact = null;
  resetUI();
  linkedinInput.focus();
});

document.getElementById("clearHistoryBtn").addEventListener("click", async () => {
  await fetch("/api/history", { method: "DELETE" });
  loadHistory();
});

async function copyToClipboard(text, label) {
  if (!text) {
    showError(`${label} is not available to copy.`);
    return;
  }
  await navigator.clipboard.writeText(text);
}

document.getElementById("copyEmailBtn").addEventListener("click", () => {
  if (currentContact) copyToClipboard(currentContact.email, "Email");
});
document.getElementById("copyPhoneBtn").addEventListener("click", () => {
  if (currentContact) copyToClipboard(currentContact.phone || currentContact.companyPhone, "Phone");
});
document.getElementById("copyAllBtn").addEventListener("click", () => {
  if (!currentContact) return;
  const c = currentContact;
  const text = [
    `Name: ${c.name || ""}`,
    `Title: ${c.title || ""}`,
    `Company: ${c.company || ""}`,
    `Email: ${c.email || ""}`,
    `Phone: ${c.phone || ""}`,
    `Mobile: ${c.mobile || ""}`,
    `Location: ${c.location || ""}`,
    `LinkedIn: ${c.linkedinUrl || ""}`,
    `ZoomInfo: ${c.zoominfoUrl || ""}`,
  ].join("\n");
  copyToClipboard(text, "Contact details");
});

loadHistory();

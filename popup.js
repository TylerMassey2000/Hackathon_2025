// popup.js — Minimal context + Top 5 egregious data violations (AGGRESSIVE mode with color-coded severity)

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const crawlBtn = document.getElementById("crawlBtn");

crawlBtn.addEventListener("click", onCrawl);

async function onCrawl() {
  setStatus("Scanning…");
  clearResults();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.url) { setStatus("No active tab."); return; }

  const res = await sendToBG("CRAWL_CURRENT_SITE", { tabId: tab.id, url: tab.url });
  if (!res?.ok) { setStatus("Error: " + (res?.error || "Unknown")); return; }

  renderResult(res);
}

function renderResult(res) {
  const card = document.createElement("div");
  card.className = "card";

  const h = document.createElement("h3");
  h.textContent = "Most Egregious User-Data Violations";
  card.appendChild(h);

  // Minimal context (sections)
  const sec = document.createElement("div");
  sec.className = "small";
  if (res.sections?.length) {
    sec.innerHTML = "Sections detected:<br/>" + res.sections
      .map(s => `• [${s.cat}] ${s.title} (${s.wc.toLocaleString()} words)`)
      .join("<br/>");
  } else {
    sec.textContent = "No distinct legal sections detected.";
  }
  card.appendChild(sec);

  // Top 5 list
  const list = document.createElement("ol");
  list.className = "violations";
  if (res.top5?.length) {
    res.top5.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML =
        `<div class="vio-title">${escapeHtml(item.title || "Violation")}</div>` +
        (item.clause ? `<div class="vio-field"><span>Clause:</span> ${escapeHtml(item.clause)}</div>` : "") +
        (item.harm ? `<div class="vio-field"><span>Harm:</span> ${escapeHtml(item.harm)}</div>` : "") +
        (item.severity ? `<div class="vio-field"><span>Severity:</span> ` +
          `<span class="sev-badge ${sevClass(item.severity)}">${escapeHtml(String(item.severity))}/10</span></div>` : "");
      list.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No clear data-related violations found.";
    list.appendChild(li);
  }
  card.appendChild(list);

  // Actions (exports)
  const actions = document.createElement("div");
  actions.className = "actions";
  const btnTxt = document.createElement("button");
  btnTxt.textContent = "Export TXT";
  btnTxt.addEventListener("click", () => downloadTxt(res));
  const btnJson = document.createElement("button");
  btnJson.textContent = "Export JSON";
  btnJson.addEventListener("click", () => downloadJson(res));
  actions.appendChild(btnTxt);
  actions.appendChild(btnJson);
  card.appendChild(actions);

  resultsEl.appendChild(card);

  const wc = res.combined?.wc ? `${res.combined.wc.toLocaleString()} words total` : "no combined text";
  const count = res.top5?.length || 0;
  setStatus(`Found ${res.sections?.length || 0} section(s), returned ${count} violation(s); ${wc}.`);
}

// severity badge color logic
function sevClass(s) {
  const n = Number(s) || 0;
  if (n >= 9) return "sev-red";
  if (n >= 7) return "sev-orange";
  if (n >= 5) return "sev-yellow";
  return "sev-green";
}

// export (TXT)
function downloadTxt(res) {
  const lines = [];
  lines.push("Top 5 Egregious User-Data Violations");
  lines.push(res.combined?.url || "");
  lines.push("");

  if (res.sections?.length) {
    lines.push("== Sections ==");
    for (const s of res.sections) lines.push(`- [${s.cat}] ${s.title} (${s.wc} words)`);
    lines.push("");
  }

  if (res.top5?.length) {
    lines.push("== Top 5 ==");
    res.top5.forEach((v, i) => {
      lines.push(`${i+1}) ${v.title}`);
      if (v.clause) lines.push(`   Clause: ${v.clause}`);
      if (v.harm)   lines.push(`   Harm: ${v.harm}`);
      if (v.severity != null) lines.push(`   Severity: ${v.severity}/10`);
    });
  } else {
    lines.push("No clear data-related violations found.");
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  download(url, "eula-scout-top5.txt");
}

// export (JSON)
function downloadJson(res) {
  const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, "eula-scout-top5.json");
}

function download(href, filename) {
  const a = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

function setStatus(msg) { statusEl.textContent = msg; }
function clearResults() { resultsEl.innerHTML = ""; }

async function sendToBG(type, payload) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...payload }, resolve));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/* AI settings UI (unchanged) */
const aiProviderEl = document.getElementById("aiProvider");
const openaiKeyEl = document.getElementById("openaiKey");
const geminiKeyEl = document.getElementById("geminiKey");
const saveAI = document.getElementById("saveAI");

(async () => {
  const st = await chrome.storage.local.get(["aiProvider", "openaiKey", "geminiKey"]);
  if (st.aiProvider) aiProviderEl.value = st.aiProvider;
  if (st.openaiKey) openaiKeyEl.value = st.openaiKey;
  if (st.geminiKey) geminiKeyEl.value = st.geminiKey;
})();

saveAI.addEventListener("click", async () => {
  const aiProvider = aiProviderEl.value || "";
  const openaiKey = openaiKeyEl.value || "";
  const geminiKey = geminiKeyEl.value || "";
  await chrome.storage.local.set({ aiProvider, openaiKey, geminiKey });
  alert("AI settings saved.");
});

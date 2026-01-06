"use strict";

let bank = null;
let bankFileName = "question_bank.json";
let sectionIdx = 0;
let qIdx = 0;

const DEFAULT_BANK_URL = "./Question_Bank_Sikhi_quiz.bilingual.en-pa.json";
const DEFAULT_BANK_URL_FAMILY_TREE = "./Question_Bank_Sikh_Gurus_Family_Tree.en.json";

function applyLoadedBank(json, fileName) {
  validateBankShape(json);

  bank = json;
  bankFileName = fileName || "question_bank.json";
  sectionIdx = 0;
  qIdx = 0;

  ensureSectionUpdates(bank);
  writeBankToWindowName(bank, bankFileName);

  syncIndexWithBank(bankFileName, bank);

  const counts = computeBankCounts(bank);
  writeStatus({
    fileName: bankFileName,
    lastLoadedAt: nowISO(),
    editsCount: Array.isArray(bank.section_updates) ? bank.section_updates.length : 0,
    sectionsCount: counts.sectionsCount,
    questionsCount: counts.questionsCount
  });

  setBankStatus(true, `Question bank: loaded (${bank.sections.length} sections)`);
  renderSectionSelect();
  setControlsEnabled(true);
  renderQuestion();
  refreshStatus();
  renderIndex();
}

async function loadDefaultBank(url = "") {
  // On file://, fetch() is typically blocked or behaves inconsistently.
  if (location.protocol === "file:") {
    toast("Default load needs a web server (GitHub Pages / Live Server). Use file picker for local.");
    return;
  }

  try {
    url = (typeof url === "string" && url.trim()) ? url.trim() : DEFAULT_BANK_URL;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    applyLoadedBank(json, url.split("/").pop() || "question_bank.json");
    toast("Default question bank loaded.");
  } catch (err) {
    console.error(err);
    setBankStatus(false, "Question bank: failed to load");
    toast("Failed to load default bank (see DevTools console)." );
  }
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  const read = document.getElementById("tab-read");
  const index = document.getElementById("tab-index");
  if (read) read.classList.toggle("hidden", tabName !== "read");
  if (index) index.classList.toggle("hidden", tabName !== "index");
  if (tabName === "index") renderIndex();
}

function setupTabs() {
  document.querySelectorAll(".tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function refreshStatus() {
  const st = readStatus();
  const file = st?.fileName ? ` • ${st.fileName}` : "";
  const loaded = st?.lastLoadedAt ? ` • loaded ${st.lastLoadedAt}` : "";
  const edited = st?.lastEditedAt ? ` • edited ${st.lastEditedAt}` : "";
  $("#storageStatus").textContent = `Local: status/index${file}${loaded}${edited}`;
}

function getFileIndexForLoadedFile() {
  const idx = readIndex();
  const fn = safeText(bankFileName || "question_bank.json") || "question_bank.json";
  return idx?.files?.[fn] || { sections: {}, deleted: [] };
}

function renderIndex() {
  const box = document.getElementById("indexBox");
  if (!box) return;
  if (!bank) {
    box.innerHTML = '<div class="hint">Load a JSON file to see the index.</div>';
    return;
  }

  const fileIndex = getFileIndexForLoadedFile();
  const sections = fileIndex.sections || {};

  const parts = [];

  bank.sections.forEach((sec, i) => {
    const title = getSectionTitleDisplay(sec.title);
    const sid = makeSectionId(sec.title);
    const entry = sections?.[sid] || {};
    const qs = entry.questions || {};
    const count = Array.isArray(sec.questions) ? sec.questions.length : 0;

    let readCount = 0;
    let editedCount = 0;
    sec.questions.forEach((q, qi) => {
      const qid = makeQuestionId(q, qi);
      const qe = qs[qid] || {};
      if (qe.readAt) readCount++;
      if (qe.editedAt) editedCount++;
    });

    const secPills = [];
    if (entry.addedAt) secPills.push('<span class="pill ok">Added</span>');
    if (entry.deletedAt) secPills.push('<span class="pill bad">Deleted</span>');

    const openAttr = i === sectionIdx ? " open" : "";
    const summaryRight = [
      editedCount ? `<span class="pill warn">Edited ${editedCount}/${count}</span>` : "",
      readCount ? `<span class="pill">Read ${readCount}/${count}</span>` : "",
      ...secPills
    ].filter(Boolean).join(" ");

    const qRows = sec.questions.map((q, qi) => {
      const qid = makeQuestionId(q, qi);
      const qe = qs[qid] || {};
      const qp = [];
      if (qe.editedAt) qp.push('<span class="pill warn">Edited</span>');
      if (qe.readAt) qp.push('<span class="pill">Read</span>');

      const n = safeText(q?.number).trim();
      const label = n ? `Q${escapeHtml(n)}` : `Q${qi + 1}`;
      const qt = normalizeBilingual(q?.question);
      const snippet = escapeHtml((qt.en || qt.pa || "").trim().slice(0, 70));
      return `<div class="row indexRow" role="button" tabindex="0" data-sec="${i}" data-q="${qi}" style="padding:6px 0">
        <div class="grow"><span class="k">${label}</span> <span class="hint">${snippet}</span></div>
        <div class="right">${qp.join(" ")}</div>
      </div>`;
    }).join("");

    parts.push(
      `<details class="card" style="padding:12px"${openAttr}>
        <summary class="row" style="cursor:pointer; list-style:none">
          <div class="grow"><strong>${i + 1}.</strong> ${escapeHtml(title)} <span class="hint">(${count})</span></div>
          <div class="right">${summaryRight}</div>
        </summary>
        <div style="margin-top:10px">${qRows || '<div class="hint">No questions.</div>'}</div>
      </details>`
    );
  });

  const deleted = Array.isArray(fileIndex.deleted) ? fileIndex.deleted : [];
  const deletedHtml = deleted.length
    ? `<div class="sep"></div><div class="hint">Deleted sections</div>` +
      deleted
        .slice(-50)
        .reverse()
        .map((d) => `<div class="row"><div class="grow">${escapeHtml(safeText(d.title || "(untitled)"))}</div><div class="right"><span class="pill bad">Deleted</span></div></div>`)
        .join("")
    : "";

  box.innerHTML = parts.join("") + deletedHtml;
}

function setupIndexClicks() {
  const box = document.getElementById("indexBox");
  if (!box) return;

  const activate = (target) => {
    const row = target?.closest?.("[data-sec][data-q]");
    if (!row || !bank) return;
    const s = parseInt(row.dataset.sec, 10);
    const q = parseInt(row.dataset.q, 10);
    if (!Number.isFinite(s) || !Number.isFinite(q)) return;
    sectionIdx = Math.max(0, Math.min(s, Math.max(0, bank.sections.length - 1)));
    const sec = bank.sections[sectionIdx];
    const maxQ = Math.max(0, (sec?.questions?.length || 0) - 1);
    qIdx = Math.max(0, Math.min(q, maxQ));
    renderSectionSelect();
    renderQuestion();
    refreshStatus();
    setActiveTab("read");
  };

  box.addEventListener("click", (e) => activate(e.target));
  box.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target?.closest?.("[data-sec][data-q]");
    if (!row) return;
    e.preventDefault();
    activate(row);
  });
}

function renderSectionSelect() {
  const sel = $("#sectionSelect");
  sel.innerHTML = "";

  bank.sections.forEach((sec, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i + 1}) ${getSectionTitleDisplay(sec.title)} (${sec.questions.length})`;
    sel.appendChild(opt);
  });

  sel.disabled = bank.sections.length === 0;
  sel.value = String(sectionIdx);
}

function setControlsEnabled(enabled) {
  for (const id of ["sectionSelect", "questionJump", "btnJump", "btnPrev", "btnNext"]) {
    const el = $("#" + id);
    if (el) el.disabled = !enabled;
  }
}

function renderQuestion() {
  const sec = bank.sections[sectionIdx];
  if (!sec) return;

  const count = sec.questions.length;
  qIdx = Math.max(0, Math.min(qIdx, Math.max(0, count - 1)));

  const q = sec.questions[qIdx];

  // Question-level status (read and edit are tracked independently)
  markQuestionStatus(bankFileName, sec.title, q, qIdx, { readAt: nowISO() });

  $("#sectionMeta").textContent = `Section ${sectionIdx + 1} • ${count} questions`;
  $("#qPos").textContent = count ? `Q ${qIdx + 1} / ${count}` : "—";

  const jump = $("#questionJump");
  jump.min = 1;
  jump.max = Math.max(1, count);
  jump.value = count ? String(qIdx + 1) : "1";

  const box = $("#readBox");
  box.innerHTML = "";

  if (!q) {
    box.innerHTML = `<div class="hint">No questions in this section.</div>`;
    return;
  }

  const qText = normalizeBilingual(q.question);
  const aText = normalizeBilingual(q.answer_text);
  const eText = normalizeBilingual(q.explanation);

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="qTop">
      <div class="qMeta">#${safeText(q.number)}</div>
    </div>

    <div class="qText">
      ${qText.en ? `<span class="lang en">${escapeHtml(qText.en)}</span>` : ""}
      ${qText.pa ? `<span class="lang pa">${escapeHtml(qText.pa)}</span>` : ""}
    </div>
  `;

  const answer = document.createElement("div");
  answer.className = "answer";
  answer.style.display = "block";
  answer.innerHTML = `
    <div class="sep"></div>
    <div class="muted small">Answer</div>
    <div class="qText" style="margin-top:6px">
      ${aText.en ? `<span class="lang en">${escapeHtml(aText.en)}</span>` : ""}
      ${aText.pa ? `<span class="lang pa">${escapeHtml(aText.pa)}</span>` : ""}
    </div>
    ${eText.en || eText.pa ? `
      <div class="muted small" style="margin-top:10px">Explanation</div>
      <div class="hint" style="white-space:pre-wrap">
        ${eText.en ? `<div>${escapeHtml(eText.en)}</div>` : ""}
        ${eText.pa ? `<div style="margin-top:8px">${escapeHtml(eText.pa)}</div>` : ""}
      </div>
    ` : ""}
  `;

  box.appendChild(wrap);
  box.appendChild(answer);

  // Keep index view fresh
  renderIndex();
}

function onSectionChange() {
  sectionIdx = parseInt($("#sectionSelect").value, 10) || 0;
  qIdx = 0;
  renderQuestion();
  writeBankToWindowName(bank, bankFileName);
  refreshStatus();
}

async function loadBankFromFilePicker() {
  const file = $("#bankFile").files?.[0];
  if (!file) {
    toast("Choose a JSON file first.");
    return;
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    applyLoadedBank(json, file.name || "question_bank.json");
    toast("Question bank loaded.");
  } catch (err) {
    console.error(err);
    setBankStatus(false, "Question bank: failed to load");
    toast("Failed to load JSON (see DevTools console)." );
  }
}

function init() {
  setupTabs();
  setupIndexClicks();
  $("#btnLoadBank").addEventListener("click", loadBankFromFilePicker);
  document.querySelectorAll(".defaultBankOption").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url || "";
      const menu = btn.closest && btn.closest("details.defaultBankMenu");
      if (menu) menu.open = false;
      loadDefaultBank(url);
    });
  });

  $("#sectionSelect").addEventListener("change", onSectionChange);

  $("#btnPrev").addEventListener("click", () => {
    qIdx = Math.max(0, qIdx - 1);
    renderQuestion();
  });

  $("#btnNext").addEventListener("click", () => {
    const sec = bank.sections[sectionIdx];
    qIdx = Math.min(sec.questions.length - 1, qIdx + 1);
    renderQuestion();
  });

  $("#btnJump").addEventListener("click", () => {
    const v = parseInt($("#questionJump").value, 10);
    if (!Number.isFinite(v)) return;
    const sec = bank.sections[sectionIdx];
    const found = findQuestionIndexByNumber(sec, v);
    qIdx = found >= 0 ? found : Math.max(0, v - 1);
    renderQuestion();
  });

  $("#btnGoEdit").addEventListener("click", () => {
    // Always allow opening Edit page; it can load its own file.
    // If we do have a bank loaded in this tab, keep the per-tab payload for convenience.
    if (bank) writeBankToWindowName(bank, bankFileName);
    const s = bank ? sectionIdx : 0;
    const q = bank ? qIdx : 0;
    const url = `./bank_edit.html?section=${encodeURIComponent(s)}&q=${encodeURIComponent(q)}`;
    window.open(url, "_blank", "noopener");
  });

  $("#btnClearLocal").addEventListener("click", () => {
    if (!confirm("Clear local status/index? (Does not remove the loaded bank in this tab.)")) return;
    clearLocalInfo();
    refreshStatus();
    renderIndex();
    toast("Cleared local status.");
  });

  // Start disabled
  setControlsEnabled(false);
  // But Edit bank should always be usable.
  const goEdit = $("#btnGoEdit");
  if (goEdit) goEdit.disabled = false;

  refreshStatus();
  renderIndex();
}

init();

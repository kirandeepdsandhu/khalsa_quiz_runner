"use strict";

let bank = null;
let bankFileName = "question_bank.json";
let sectionIdx = 0;
let qIdx = 0;

let isDirty = false;

let gkTarget = null;

// Optional: smart IME support (jQuery.ime). If available, we prefer it over the simple fallback mapping.
let smartImeActive = false;

const DEFAULT_BANK_URL = "./Question_Bank_Sikhi_quiz.bilingual.en-pa.json";

function applyLoadedBank(json, fileName) {
  validateBankShape(json);

  bank = json;
  bankFileName = fileName || "question_bank.json";
  ensureSectionUpdates(bank);

  // Apply any persisted edits from localStorage
  applyPersistedEditsToBank(bankFileName, bank);

  syncIndexWithBank(bankFileName, bank);

  writeBankToWindowName(bank, bankFileName);
  const counts = computeBankCounts(bank);
  writeStatus({
    fileName: bankFileName,
    lastLoadedAt: nowISO(),
    editsCount: Array.isArray(bank.section_updates) ? bank.section_updates.length : 0,
    sectionsCount: counts.sectionsCount,
    questionsCount: counts.questionsCount
  });
  setBankStatus(true, `Question bank: loaded (${bank.sections.length} sections)`);

  sectionIdx = 0;
  qIdx = 0;

  renderSectionSelect();
  setControlsEnabled(true);
  renderEditForm();
  refreshStatus();
  renderIndex();
}

async function loadDefaultBank() {
  if (location.protocol === "file:") {
    toast("Default load needs a web server (GitHub Pages / Live Server). Use file picker for local.");
    return;
  }

  try {
    const res = await fetch(DEFAULT_BANK_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    applyLoadedBank(json, DEFAULT_BANK_URL.split("/").pop() || "question_bank.json");
    toast("Default question bank loaded.");
  } catch (err) {
    console.error(err);
    setBankStatus(false, "Question bank: failed to load");
    toast("Failed to load default bank (see DevTools console)." );
  }
}

function isPunjabiEditable(el) {
  if (!el) return false;
  const id = safeText(el.id || "");
  if (!id) return false;
  return id.endsWith("_pa") || id === "q_pa" || id === "exp_pa";
}

function hasSmartIme() {
  const jq = window.jQuery;
  if (!(jq && jq.fn && typeof jq.fn.ime === "function")) return false;
  // Prefer true only if Punjabi phonetic is actually present (rules loaded).
  try {
    const im = jq.ime && jq.ime.inputmethods;
    if (im && (im["pa-phonetic"] || im["pa-transliteration"])) return true;
  } catch {}
  // Still allow if plugin exists (it may lazy-load rules), but we will verify at bind time.
  return true;
}

function applyPunjabiFieldAttributes(root = document) {
  const els = root.querySelectorAll("input, textarea");
  for (const el of els) {
    if (!isPunjabiEditable(el)) continue;
    // Helps OS/browser input + spellcheck. Does not provide transliteration by itself.
    el.setAttribute("lang", "pa-Guru");
    el.setAttribute("spellcheck", "true");
  }
}

function ensureSmartImeBoundAndSetState(enabled) {
  if (!hasSmartIme()) return false;
  const jq = window.jQuery;

  const inputmethods = (() => {
    try { return jq.ime && jq.ime.inputmethods ? jq.ime.inputmethods : null; } catch { return null; }
  })();
  const preferredImId = inputmethods?.["pa-phonetic"]
    ? "pa-phonetic"
    : (inputmethods?.["pa-transliteration"] ? "pa-transliteration" : "pa-phonetic");

  // Bind IME to all Punjabi fields currently in DOM.
  const els = document.querySelectorAll("input, textarea");
  for (const el of els) {
    if (!isPunjabiEditable(el)) continue;

    if (!el.dataset.qbImeBound) {
      try {
        jq(el).ime();
        el.dataset.qbImeBound = "1";
      } catch {
        // If init fails for any reason, keep fallback behavior.
        continue;
      }
    }

    const ime = jq(el).data("ime");
    if (!ime) continue;
    try {
      // Prefer Punjabi phonetic (or transliteration if phonetic is unavailable).
      ime.setIM(preferredImId);
    } catch {}

    try {
      if (enabled) ime.enable();
      else ime.disable();
    } catch {}
  }

  return true;
}

function insertAtCaret(el, text) {
  if (!el) return;
  const t = safeText(text);
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  el.value = before + t + after;
  const nextPos = start + t.length;
  try {
    el.setSelectionRange(nextPos, nextPos);
  } catch {}
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function backspaceAtCaret(el) {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (start !== end) {
    insertAtCaret(el, "");
    return;
  }
  if (start <= 0) return;
  const before = el.value.slice(0, start - 1);
  const after = el.value.slice(end);
  el.value = before + after;
  const nextPos = start - 1;
  try {
    el.setSelectionRange(nextPos, nextPos);
  } catch {}
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function isTextarea(el) {
  return el && el.tagName && String(el.tagName).toLowerCase() === "textarea";
}

function readGkPrefs() {
  const st = readStatus();
  return {
    keyboardOpen: !!st?.gkKeyboardOpen,
    phoneticOn: !!st?.gkPhoneticOn
  };
}

function setGkKeyboardOpen(open) {
  const panel = document.getElementById("gkPanel");
  if (panel) panel.classList.toggle("hidden", !open);
  writeStatus({ gkKeyboardOpen: !!open });
}

function setGkPhoneticOn(on) {
  const btn = document.getElementById("btnGkPhonetic");
  if (btn) btn.classList.toggle("primary", !!on);
  writeStatus({ gkPhoneticOn: !!on });

  // If smart IME is available, use it to provide real transliteration suggestions.
  // Otherwise, keep using our fallback phonetic key mapping.
  if (hasSmartIme() && ensureSmartImeBoundAndSetState(!!on)) {
    smartImeActive = !!on;
    if (on) toast("Punjabi phonetic IME enabled (smart suggestions).")
    else toast("Punjabi phonetic IME disabled.");
    return;
  }

  // Fallback
  smartImeActive = false;
  if (on) toast("Phonetic mode enabled (offline basic mapping). (Smart IME not loaded)");
  else toast("Phonetic mode disabled.");
}

function buildGurmukhiKeyboard() {
  const keysEl = document.getElementById("gkKeys");
  if (!keysEl) return;
  keysEl.innerHTML = "";

  const rows = [
    ["ੳ","ਅ","ਆ","ਇ","ਈ","ਉ","ਊ","ਏ","ਐ","ਓ","ਔ","ੴ"],
    ["ਕ","ਖ","ਗ","ਘ","ਙ","ਚ","ਛ","ਜ","ਝ","ਞ","ਟ","ਠ"],
    ["ਡ","ਢ","ਣ","ਤ","ਥ","ਦ","ਧ","ਨ","ਪ","ਫ","ਬ","ਭ"],
    ["ਮ","ਯ","ਰ","ਲ","ਵ","ਸ਼","ਸ","ਹ","ਖ਼","ਗ਼","ਜ਼","ੜ"],
    ["ਫ਼","ਾ","ਿ","ੀ","ੁ","ੂ","ੇ","ੈ","ੋ","ੌ","ਂ","ੱ"],
    ["ੰ","ੲ","੍","਼","।","॥","?",",",".","(",")","'"],
  ];

  for (const row of rows) {
    for (const ch of row) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gkKey";
      b.textContent = ch;
      b.addEventListener("click", () => {
        if (!gkTarget) {
          toast("Click a Punjabi field first.");
          return;
        }
        gkTarget.focus();
        insertAtCaret(gkTarget, ch);
      });
      keysEl.appendChild(b);
    }
  }
}

// Simple physical-keyboard phonetic mapping (minimal but useful)
const _gkPending = new WeakMap(); // element -> last latin char for digraphs

function mapLatinToGurmukhi(prevLatin, key) {
  const k = key.toLowerCase();
  // Digraphs
  const dig = (prevLatin || "") + k;
  const digMap = {
    kh: "ਖ",
    gh: "ਘ",
    ch: "ਚ",
    "ch": "ਚ",
    jh: "ਝ",
    th: "ਥ",
    dh: "ਧ",
    ph: "ਫ",
    bh: "ਭ",
    sh: "ਸ਼",
    aa: "ਆ",
    ii: "ਈ",
    uu: "ਊ",
  };
  if (digMap[dig]) return { kind: "replacePrev", text: digMap[dig] };

  const single = {
    a: "ਅ",
    i: "ਇ",
    u: "ਉ",
    e: "ਏ",
    o: "ਓ",
    k: "ਕ",
    g: "ਗ",
    c: "ਚ",
    j: "ਜ",
    t: "ਤ",
    d: "ਦ",
    n: "ਨ",
    p: "ਪ",
    f: "ਫ",
    b: "ਬ",
    m: "ਮ",
    y: "ਯ",
    r: "ਰ",
    l: "ਲ",
    v: "ਵ",
    w: "ਵ",
    s: "ਸ",
    h: "ਹ",
  };
  if (single[k]) return { kind: "insert", text: single[k] };
  return null;
}

function replacePrevChar(el, newChar) {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (start !== end) return;
  if (start <= 0) {
    insertAtCaret(el, newChar);
    return;
  }
  const before = el.value.slice(0, start - 1);
  const after = el.value.slice(start);
  el.value = before + newChar + after;
  const nextPos = start;
  try { el.setSelectionRange(nextPos, nextPos); } catch {}
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function setupPhoneticTyping() {
  document.addEventListener("keydown", (e) => {
    const prefs = readGkPrefs();
    if (!prefs.phoneticOn) return;
    // If smart IME is active, do not interfere.
    if (smartImeActive) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    if (!isPunjabiEditable(el)) return;

    const key = e.key;
    if (!key || key.length !== 1) return;
    if (!/[a-zA-Z]/.test(key)) {
      _gkPending.set(el, "");
      return;
    }

    e.preventDefault();
    const prev = _gkPending.get(el) || "";
    const mapped = mapLatinToGurmukhi(prev, key);
    if (!mapped) {
      _gkPending.set(el, "");
      return;
    }

    if (mapped.kind === "replacePrev") {
      replacePrevChar(el, mapped.text);
      _gkPending.set(el, "");
      return;
    }

    insertAtCaret(el, mapped.text);
    _gkPending.set(el, key.toLowerCase());
  }, true);
}

function getEditTextSizePx() {
  const st = readStatus();
  const v = Number(st?.editTextSizePx);
  if (Number.isFinite(v) && v >= 12 && v <= 26) return v;
  return 16;
}

function applyEditTextSizePx(px) {
  const v = Math.max(12, Math.min(26, Number(px) || 16));
  const tab = document.getElementById("tab-edit");
  if (tab) tab.style.setProperty("--editTextSize", `${v}px`);
  const badge = document.getElementById("fontSizeBadge");
  if (badge) badge.textContent = `Text ${v}px`;
  writeStatus({ editTextSizePx: v });
}

function bumpEditTextSize(delta) {
  applyEditTextSizePx(getEditTextSizePx() + delta);
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  const edit = document.getElementById("tab-edit");
  const index = document.getElementById("tab-index");
  if (edit) edit.classList.toggle("hidden", tabName !== "edit");
  if (index) index.classList.toggle("hidden", tabName !== "index");
  if (tabName === "index") renderIndex();
}

function setupTabs() {
  document.querySelectorAll(".tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function setDirty(v) {
  isDirty = !!v;
  const badge = $("#dirtyBadge");
  if (badge) badge.textContent = isDirty ? "Unsaved" : "Saved";
}

function refreshStatus(lastWriteResult) {
  const st = readStatus();
  const file = st?.fileName ? ` • ${st.fileName}` : "";
  const loaded = st?.lastLoadedAt ? ` • loaded ${st.lastLoadedAt}` : "";
  const edited = st?.lastEditedAt ? ` • edited ${st.lastEditedAt}` : "";
  $("#storageStatus").textContent = `Local: status/index${file}${loaded}${edited}`;

  const edits = Array.isArray(bank?.section_updates) ? bank.section_updates.length : (st?.editsCount || 0);
  $("#editStatus").textContent = `Edits: ${edits}`;

  // localStorage write result is no longer relevant for full bank (we don't store it there)
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
    const clearSectionBtn = editedCount > 0 ? `<button class="btn small bad" data-clear-sec="${i}" type="button" style="margin-left:8px">Clear Section Edits</button>` : "";
    const summaryRight = [
      editedCount ? `<span class="pill warn">Edited ${editedCount}/${count}</span>` : "",
      readCount ? `<span class="pill">Read ${readCount}/${count}</span>` : "",
      ...secPills,
      clearSectionBtn
    ].filter(Boolean).join(" ");

    const qRows = sec.questions.map((q, qi) => {
      const qid = makeQuestionId(q, qi);
      const qe = qs[qid] || {};
      const qp = [];
      if (qe.editedAt) {
        qp.push('<span class="pill warn">Edited</span>');
        qp.push(`<button class="btn small bad" data-clear-q="${i},${qi}" type="button" style="margin-left:6px">Clear Edit</button>`);
      }
      if (qe.readAt) qp.push('<span class="pill">Read</span>');

      const n = safeText(q?.number).trim();
      const label = n ? `Q${escapeHtml(n)}` : `Q${qi + 1}`;
      const qt = normalizeBilingual(q?.question);
      const snippet = escapeHtml((qt.en || qt.pa || "").trim().slice(0, 70));
      return `<div class="row indexRow" style="padding:6px 0; align-items:center">
        <div class="grow" data-sec="${i}" data-q="${qi}" style="cursor:pointer; padding:8px 0"><span class="k">${label}</span> <span class="hint">${snippet}</span></div>
        <div class="right" style="display:flex; gap:6px; align-items:center; flex-shrink:0">${qp.join(" ")}</div>
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
    renderEditForm();
    refreshStatus();
    setActiveTab("edit");
  };

  box.addEventListener("click", (e) => {
    // Handle Clear Edit button for questions
    const clearQBtn = e.target?.closest?.("[data-clear-q]");
    if (clearQBtn) {
      e.stopPropagation();
      e.preventDefault();
      const [s, q] = clearQBtn.dataset.clearQ.split(",").map(v => parseInt(v, 10));
      if (!Number.isFinite(s) || !Number.isFinite(q)) return;
      clearQuestionEditHandler(s, q);
      return;
    }

    // Handle Clear Section Edits button
    const clearSecBtn = e.target?.closest?.("[data-clear-sec]");
    if (clearSecBtn) {
      e.stopPropagation();
      e.preventDefault();
      const s = parseInt(clearSecBtn.dataset.clearSec, 10);
      if (!Number.isFinite(s)) return;
      clearSectionEditsHandler(s);
      return;
    }

    // Handle navigation to question - check if we clicked on a button first
    if (e.target.closest("button")) return;

    // Handle navigation to question
    const navTarget = e.target?.closest?.("[data-sec][data-q]");
    if (navTarget) {
      e.preventDefault();
      const s = parseInt(navTarget.dataset.sec, 10);
      const q = parseInt(navTarget.dataset.q, 10);
      if (!Number.isFinite(s) || !Number.isFinite(q) || !bank) return;
      sectionIdx = Math.max(0, Math.min(s, Math.max(0, bank.sections.length - 1)));
      const sec = bank.sections[sectionIdx];
      const maxQ = Math.max(0, (sec?.questions?.length || 0) - 1);
      qIdx = Math.max(0, Math.min(q, maxQ));
      renderSectionSelect();
      renderEditForm();
      refreshStatus();
      setActiveTab("edit");
    }
  });

  box.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target?.closest?.("[data-sec][data-q]");
    if (!row) return;
    e.preventDefault();
    activate(row);
  });
}

function setControlsEnabled(enabled) {
  for (const id of [
    "sectionSelect",
    "questionJump",
    "btnJump",
    "btnPrev",
    "btnNext",
    "btnDownload",
    "btnAddSection",
    "btnDeleteSection"
  ]) {
    const el = $("#" + id);
    if (el) el.disabled = !enabled;
  }
}

function getEditorNameRequired() {
  const name = safeText($("#editorName").value).trim();
  if (!name) {
    toast("Enter your name to save edits.");
    return null;
  }
  writeStatus({ lastEditorName: name });
  return name;
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
  sectionIdx = Math.max(0, Math.min(sectionIdx, Math.max(0, bank.sections.length - 1)));
  sel.value = String(sectionIdx);
}

// Updates/audit log UI removed. We still write section_updates into the JSON for download.

function renderEditForm() {
  const box = $("#editBox");
  box.innerHTML = "";

  const sec = bank.sections[sectionIdx];
  if (!sec) {
    box.innerHTML = `<div class="hint">No section selected.</div>`;
    return;
  }

  const count = sec.questions.length;
  qIdx = Math.max(0, Math.min(qIdx, Math.max(0, count - 1)));

  const q = sec.questions[qIdx];
  if (!q) {
    box.innerHTML = `<div class="hint">No questions in this section.</div>`;
    $("#qPos").textContent = "—";
    return;
  }

  $("#qPos").textContent = `Q ${qIdx + 1} / ${count}`;

  const qText = normalizeBilingual(q.question);
  const eText = normalizeBilingual(q.explanation);

  const optKeys = ["a", "b", "c", "d"];
  const opts = {};
  for (const k of optKeys) {
    opts[k] = normalizeBilingual(q.options?.[k]);
  }

  const correct = safeText(q.correct_option).toLowerCase();

  const form = document.createElement("div");
  form.innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div class="muted small">Question number: <span class="k">${escapeHtml(safeText(q.number))}</span></div>
      <div class="muted small">Section: <span class="k">${escapeHtml(getSectionTitleDisplay(sec.title))}</span></div>
    </div>

    <div class="sep"></div>

    <h2 style="margin:0 0 10px; font-size:18px">Question text</h2>
    <div class="row">
      <div class="grow" style="min-width:260px">
        <label for="q_en">English</label>
        <textarea id="q_en">${escapeHtml(qText.en)}</textarea>
      </div>
      <div class="grow" style="min-width:260px">
        <label for="q_pa">Punjabi</label>
        <textarea id="q_pa">${escapeHtml(qText.pa)}</textarea>
      </div>
    </div>

    <div class="sep"></div>

    <h2 style="margin:0 0 10px; font-size:18px">Options</h2>

    ${optKeys.map((k) => `
      <div class="card" style="padding:12px; margin:10px 0">
        <div class="row" style="justify-content:space-between">
          <div class="name">Option ${k.toUpperCase()}</div>
          <div class="row">
            <label style="margin-right:6px">Correct</label>
            <input type="radio" name="correct" value="${k}" ${correct === k ? "checked" : ""} />
          </div>
        </div>
        <div class="row" style="margin-top:8px">
          <div class="grow" style="min-width:260px">
            <label for="opt_${k}_en">English</label>
            <input id="opt_${k}_en" type="text" value="${escapeHtml(opts[k].en)}" />
          </div>
          <div class="grow" style="min-width:260px">
            <label for="opt_${k}_pa">Punjabi</label>
            <input id="opt_${k}_pa" type="text" value="${escapeHtml(opts[k].pa)}" />
          </div>
        </div>
      </div>
    `).join("")}

    <div class="sep"></div>

    <h2 style="margin:0 0 10px; font-size:18px">Explanation</h2>
    <div class="row">
      <div class="grow" style="min-width:260px">
        <label for="exp_en">English</label>
        <textarea id="exp_en">${escapeHtml(eText.en)}</textarea>
      </div>
      <div class="grow" style="min-width:260px">
        <label for="exp_pa">Punjabi</label>
        <textarea id="exp_pa">${escapeHtml(eText.pa)}</textarea>
      </div>
    </div>

    <div class="row" style="margin-top:14px">
      <button class="btn good" id="btnSaveQuestion" type="button">Save this question</button>
      <button class="btn" id="btnLoadOriginal" type="button">Reset</button>
    </div>

    <div class="row" style="margin-top:10px">
      <button class="btn" id="btnPrevInForm" type="button">Prev</button>
      <button class="btn" id="btnNextInForm" type="button">Next</button>
      <div style="min-width:80px">
        <input id="questionJumpInForm" type="number" min="1" value="1" style="width:60px" />
      </div>
      <button class="btn" id="btnJumpInForm" type="button">Go</button>
      <span class="badge" id="qPosInForm">Q ${qIdx + 1} / ${count}</span>
      <span class="muted small" id="dirtyHint"></span>
    </div>
  `;

  box.appendChild(form);

  $("#btnSaveQuestion").addEventListener("click", () => saveQuestionEdits());
  $("#btnLoadOriginal").addEventListener("click", () => loadOriginalQuestion());

  // Navigation buttons in form
  $("#btnPrevInForm").addEventListener("click", () => {
    qIdx = Math.max(0, qIdx - 1);
    renderEditForm();
  });
  $("#btnNextInForm").addEventListener("click", () => {
    const sec = bank.sections[sectionIdx];
    qIdx = Math.min(sec.questions.length - 1, qIdx + 1);
    renderEditForm();
  });
  $("#btnJumpInForm").addEventListener("click", () => {
    const v = parseInt($("#questionJumpInForm").value, 10);
    if (!Number.isFinite(v)) return;
    const sec = bank.sections[sectionIdx];
    const found = findQuestionIndexByNumber(sec, v);
    qIdx = found >= 0 ? found : Math.max(0, v - 1);
    renderEditForm();
  });

  // Sync the main question jump input
  const jump = $("#questionJump");
  jump.min = 1;
  jump.max = Math.max(1, count);
  jump.value = String(qIdx + 1);
  $("#questionJumpInForm").min = 1;
  $("#questionJumpInForm").max = Math.max(1, count);
  $("#questionJumpInForm").value = String(qIdx + 1);

  // Dirty tracking
  const dirtyEls = [
    "q_en","q_pa","exp_en","exp_pa",
    "opt_a_en","opt_a_pa","opt_b_en","opt_b_pa","opt_c_en","opt_c_pa","opt_d_en","opt_d_pa"
  ];
  for (const id of dirtyEls) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", () => setDirty(true));
  }
  for (const radio of Array.from(document.querySelectorAll('input[name="correct"]'))) {
    radio.addEventListener("change", () => setDirty(true));
  }

  setDirty(false);

  // Improve Punjabi input experience (attributes + optional smart IME binding for newly-rendered fields).
  applyPunjabiFieldAttributes(box);
  if (readGkPrefs().phoneticOn && hasSmartIme()) {
    smartImeActive = true;
    ensureSmartImeBoundAndSetState(true);
  }
}

function saveQuestionEdits() {
  const editor = getEditorNameRequired();
  if (!editor) return;

  const sec = bank.sections[sectionIdx];
  const q = sec?.questions?.[qIdx];
  if (!q) return;

  const before = cloneDeep(q);

  const q_en = $("#q_en").value;
  const q_pa = $("#q_pa").value;

  const exp_en = $("#exp_en").value;
  const exp_pa = $("#exp_pa").value;

  q.question = toBilingualShape(before.question, q_en, q_pa);

  if (!q.options || typeof q.options !== "object") q.options = {};
  for (const k of ["a", "b", "c", "d"]) {
    const oen = $("#opt_" + k + "_en").value;
    const opa = $("#opt_" + k + "_pa").value;
    q.options[k] = toBilingualShape(before.options?.[k], oen, opa);
  }

  const checked = document.querySelector('input[name="correct"]:checked');
  q.correct_option = checked ? safeText(checked.value).toLowerCase() : safeText(before.correct_option).toLowerCase();

  // Derive answer_text from the correct option (answer is picked from correct option).
  const ck = safeText(q.correct_option).toLowerCase();
  const correctOpt = q.options?.[ck];
  const ct = normalizeBilingual(correctOpt);
  q.answer_text = toBilingualShape(before.answer_text, ct.en, ct.pa);
  q.explanation = toBilingualShape(before.explanation, exp_en, exp_pa);

  const diff = computeQuestionDiff(before, q);
  const changed = Object.keys(diff).length > 0;

  if (!changed) {
    toast("No changes to save.");
    return;
  }

  ensureSectionUpdates(bank);
  const sectionTitle = getSectionTitleDisplay(sec.title);
  const updateEntry = {
    at: nowISO(),
    editor,
    action: "edit_question",
    section: sectionTitle,
    section_index: sectionIdx,
    question_number: q.number,
    question_index: qIdx,
    summary: summarizeQuestion(q),
    changes: diff
  };
  bank.section_updates.push(updateEntry);

  // Save original before first edit, persist edited question to localStorage
  const sid = makeSectionId(sec.title);
  const qid = makeQuestionId(q, qIdx);
  saveOriginalQuestion(bankFileName, sid, qid, before);
  saveQuestionEdit(bankFileName, sid, qid, q);

  // Keep the latest full bank only in this tab, not localStorage.
  writeBankToWindowName(bank, bankFileName);

  // Persist lightweight status + delta log.
  writeStatus({
    fileName: bankFileName,
    lastEditedAt: updateEntry.at,
    editsCount: bank.section_updates.length
  });

  // Question-level status (read and edit are tracked independently)
  markQuestionStatus(bankFileName, sec.title, q, qIdx, { editedAt: updateEntry.at });
  renderIndex();
  setDirty(false);
  refreshStatus();
  toast("Saved.");
}

function loadOriginalQuestion() {
  const sec = bank.sections[sectionIdx];
  const q = sec?.questions?.[qIdx];
  if (!q) return;

  const sid = makeSectionId(sec.title);
  const qid = makeQuestionId(q, qIdx);
  const original = getOriginalQuestion(bankFileName, sid, qid);

  if (!original) {
    toast("No original version found for this question.");
    return;
  }

  if (!confirm("Load the original version of this question? Current unsaved changes will be lost.")) {
    return;
  }

  // Restore original to the bank
  Object.assign(q, cloneDeep(original));

  // Clear the persisted edit
  clearQuestionEdit(bankFileName, sid, qid);

  // Update the index to remove edited status
  markQuestionStatus(bankFileName, sec.title, q, qIdx, { editedAt: null });

  // Update in-memory bank
  writeBankToWindowName(bank, bankFileName);

  // Re-render
  renderEditForm();
  renderIndex();
  refreshStatus();
  toast("Original question loaded.");
}

function clearQuestionEditHandler(secIdx, qiIdx) {
  if (!bank) return;

  const sec = bank.sections[secIdx];
  if (!sec) return;

  const q = sec.questions[qiIdx];
  if (!q) return;

  const sid = makeSectionId(sec.title);
  const qid = makeQuestionId(q, qiIdx);
  const original = getOriginalQuestion(bankFileName, sid, qid);

  if (!original) {
    toast("No original version found for this question.");
    return;
  }

  if (!confirm("Clear edits and restore original for this question?")) {
    return;
  }

  // Restore original to the bank
  Object.assign(q, cloneDeep(original));

  // Clear the persisted edit
  clearQuestionEdit(bankFileName, sid, qid);

  // Update the index to remove edited status
  markQuestionStatus(bankFileName, sec.title, q, qiIdx, { editedAt: null });

  // Update in-memory bank
  writeBankToWindowName(bank, bankFileName);

  // Re-render if we're on this question
  if (secIdx === sectionIdx && qiIdx === qIdx) {
    renderEditForm();
  }

  renderIndex();
  refreshStatus();
  toast("Question edits cleared.");
}

function clearSectionEditsHandler(secIdx) {
  if (!bank) return;

  const sec = bank.sections[secIdx];
  if (!sec) return;

  const sid = makeSectionId(sec.title);
  const title = getSectionTitleDisplay(sec.title);

  if (!confirm(`Clear all edits for section "${title}"? This will restore all questions in this section to their original versions.`)) {
    return;
  }

  let clearedCount = 0;
  sec.questions.forEach((q, qi) => {
    const qid = makeQuestionId(q, qi);
    const original = getOriginalQuestion(bankFileName, sid, qid);
    if (original) {
      // Restore original to the bank
      Object.assign(q, cloneDeep(original));
      // Clear the persisted edit
      clearQuestionEdit(bankFileName, sid, qid);
      // Update the index to remove edited status
      markQuestionStatus(bankFileName, sec.title, q, qi, { editedAt: null });
      clearedCount++;
    }
  });

  // Clear section-level edits too
  clearSectionEdits(bankFileName, sid);

  // Update in-memory bank
  writeBankToWindowName(bank, bankFileName);

  // Re-render if we're in this section
  if (secIdx === sectionIdx) {
    renderEditForm();
  }

  renderIndex();
  refreshStatus();
  toast(`Cleared ${clearedCount} question edits in section.`);
}

function onSectionChange() {
  sectionIdx = parseInt($("#sectionSelect").value, 10) || 0;
  qIdx = 0;
  renderEditForm();
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

function addSection() {
  const editor = getEditorNameRequired();
  if (!editor) return;

  const en = prompt("New section title (English):", "");
  if (en === null) return;
  const pa = prompt("New section title (Punjabi, optional):", "");
  if (pa === null) return;

  const title = toBilingualShape(null, en, pa);
  const sec = { title, questions: [] };

  bank.sections.push(sec);
  sectionIdx = bank.sections.length - 1;
  qIdx = 0;

  ensureSectionUpdates(bank);
  const updateEntry = {
    at: nowISO(),
    editor,
    action: "add_section",
    section: getSectionTitleDisplay(title),
    section_index: sectionIdx
  };
  bank.section_updates.push(updateEntry);

  markSectionStatus(bankFileName, title, { addedAt: updateEntry.at });

  writeBankToWindowName(bank, bankFileName);
  writeStatus({ fileName: bankFileName, lastEditedAt: updateEntry.at, editsCount: bank.section_updates.length });

  renderSectionSelect();
  renderEditForm();
  refreshStatus();
  renderIndex();
  toast("Section added.");
}

function deleteSection() {
  const editor = getEditorNameRequired();
  if (!editor) return;

  const sec = bank.sections[sectionIdx];
  if (!sec) return;

  const title = getSectionTitleDisplay(sec.title);
  if (!confirm(`Delete section "${title}"? This cannot be undone.`)) return;

  bank.sections.splice(sectionIdx, 1);
  sectionIdx = Math.max(0, Math.min(sectionIdx, Math.max(0, bank.sections.length - 1)));
  qIdx = 0;

  ensureSectionUpdates(bank);
  const updateEntry = {
    at: nowISO(),
    editor,
    action: "delete_section",
    section: title
  };
  bank.section_updates.push(updateEntry);

  markDeletedSection(bankFileName, sec.title);

  writeBankToWindowName(bank, bankFileName);
  writeStatus({ fileName: bankFileName, lastEditedAt: updateEntry.at, editsCount: bank.section_updates.length });

  renderSectionSelect();
  renderEditForm();
  refreshStatus();
  renderIndex();
  toast("Section deleted.");
}

function init() {
  setupTabs();
  setupIndexClicks();

  // Editor text size
  applyEditTextSizePx(getEditTextSizePx());
  const minus = document.getElementById("btnFontMinus");
  const plus = document.getElementById("btnFontPlus");
  if (minus) minus.addEventListener("click", () => bumpEditTextSize(-1));
  if (plus) plus.addEventListener("click", () => bumpEditTextSize(+1));

  // Gurmukhi input helpers
  buildGurmukhiKeyboard();
  setupPhoneticTyping();
  const prefs = readGkPrefs();
  setGkKeyboardOpen(prefs.keyboardOpen);
  setGkPhoneticOn(prefs.phoneticOn);

  // Apply Punjabi field attributes for any initial DOM content.
  applyPunjabiFieldAttributes(document);

  const btnKb = document.getElementById("btnGkKeyboard");
  if (btnKb) {
    btnKb.addEventListener("click", () => {
      const cur = readGkPrefs().keyboardOpen;
      setGkKeyboardOpen(!cur);
    });
  }
  const btnPho = document.getElementById("btnGkPhonetic");
  if (btnPho) {
    btnPho.addEventListener("click", () => {
      const cur = readGkPrefs().phoneticOn;
      setGkPhoneticOn(!cur);
    });
  }
  const btnClose = document.getElementById("btnGkClose");
  if (btnClose) btnClose.addEventListener("click", () => setGkKeyboardOpen(false));
  const btnBs = document.getElementById("btnGkBackspace");
  if (btnBs) btnBs.addEventListener("click", () => {
    if (!gkTarget) return toast("Click a Punjabi field first.");
    gkTarget.focus();
    backspaceAtCaret(gkTarget);
  });
  const btnSpace = document.getElementById("btnGkSpace");
  if (btnSpace) btnSpace.addEventListener("click", () => {
    if (!gkTarget) return toast("Click a Punjabi field first.");
    gkTarget.focus();
    insertAtCaret(gkTarget, " ");
  });
  const btnEnter = document.getElementById("btnGkEnter");
  if (btnEnter) btnEnter.addEventListener("click", () => {
    if (!gkTarget) return toast("Click a Punjabi field first.");
    gkTarget.focus();
    insertAtCaret(gkTarget, isTextarea(gkTarget) ? "\n" : " ");
  });

  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (isPunjabiEditable(el)) gkTarget = el;
  });

  $("#btnLoadBank").addEventListener("click", loadBankFromFilePicker);
  const btnDef = document.getElementById("btnLoadDefaultBank");
  if (btnDef) btnDef.addEventListener("click", loadDefaultBank);
  $("#btnGoRead").addEventListener("click", () => {
    window.open("./bank_read.html", "_blank", "noopener");
  });

  $("#sectionSelect").addEventListener("change", onSectionChange);

  $("#btnPrev").addEventListener("click", () => {
    qIdx = Math.max(0, qIdx - 1);
    renderEditForm();
  });

  $("#btnNext").addEventListener("click", () => {
    const sec = bank.sections[sectionIdx];
    qIdx = Math.min(sec.questions.length - 1, qIdx + 1);
    renderEditForm();
  });

  $("#btnJump").addEventListener("click", () => {
    const v = parseInt($("#questionJump").value, 10);
    if (!Number.isFinite(v)) return;
    const sec = bank.sections[sectionIdx];
    const found = findQuestionIndexByNumber(sec, v);
    qIdx = found >= 0 ? found : Math.max(0, v - 1);
    renderEditForm();
  });

  $("#btnDownload").addEventListener("click", () => {
    if (!bank) return;
    const base = stripJsonExt(bankFileName);
    const out = base + ".edited.json";
    downloadJson(out, bank);
    toast("Downloaded.");
  });

  $("#btnClearLocal").addEventListener("click", () => {
    if (!confirm("Clear local status/index? (Does not remove the loaded bank in this tab.)")) return;
    clearLocalInfo();
    refreshStatus();
    renderIndex();
    toast("Cleared local status.");
  });

  $("#btnAddSection").addEventListener("click", addSection);
  $("#btnDeleteSection").addEventListener("click", deleteSection);

  // Start disabled
  setControlsEnabled(false);

  const st = readStatus();
  if (st?.lastEditorName && !safeText($("#editorName").value).trim()) {
    $("#editorName").value = st.lastEditorName;
  }

  refreshStatus();
  renderIndex();
}

init();

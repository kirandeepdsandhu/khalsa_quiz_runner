"use strict";

// Shared utilities for Question Bank read/edit pages.
// Intentionally standalone (does not depend on the quiz runner app scripts).

// NOTE: Per user requirement: do NOT store the full JSON in localStorage.
// - Full bank lives in memory and is transferred between pages via window.name (per-tab).
// - localStorage stores only small status + section index (read/edited/added/deleted).

const QB_STATUS_KEY = "qb_status_v1"; // {fileName,lastLoadedAt,lastEditedAt,editsCount,sectionsCount,questionsCount}
const QB_INDEX_KEY = "qb_index_v1"; // { files: { [fileName]: { sections: { [sectionId]: {title, addedAt?, deletedAt?, questions: { [questionId]: { number?, readAt?, editedAt? } } } }, deleted: [{id,title,at}] } } }
const QB_WINDOW_NAME_PREFIX = "qb_bank_payload_v1:";

const $ = (sel) => document.querySelector(sel);

function safeText(v) {
  return v === null || v === undefined ? "" : String(v);
}

function escapeHtml(s) {
  return safeText(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[m]);
}

function nowISO() {
  return new Date().toISOString();
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.display = "none"), 1700);
}

function setBankStatus(ok, text) {
  const dot = $("#bankDot");
  const status = $("#bankStatus");
  if (dot) dot.className = "dot " + (ok ? "ok" : "no");
  if (status) status.textContent = text;
}

function normalizeBilingual(v) {
  if (v && typeof v === "object") {
    return {
      en: safeText(v.en),
      pa: safeText(v.pa)
    };
  }
  return { en: safeText(v), pa: "" };
}

function toBilingualShape(original, enText, paText) {
  const en = safeText(enText).trim();
  const pa = safeText(paText).trim();

  const originalWasObject = original && typeof original === "object";
  if (originalWasObject || pa) return { en, pa };
  return en;
}

function validateBankShape(json) {
  if (!json || !Array.isArray(json.sections)) {
    throw new Error("Invalid bank: missing sections[]");
  }
  for (const sec of json.sections) {
    if (!Array.isArray(sec.questions)) {
      throw new Error("Invalid bank: section missing questions[]");
    }
  }
}

function getSectionTitleDisplay(title) {
  const t = normalizeBilingual(title);
  const en = t.en.trim();
  const pa = t.pa.trim();
  if (en && pa) return `${en} / ${pa}`;
  return en || pa || "(Untitled section)";
}

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function downloadJson(filename, obj) {
  const text = JSON.stringify(obj, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function writeBankToWindowName(json, fileName) {
  // Keep payload per-tab only.
  try {
    window.name = QB_WINDOW_NAME_PREFIX + JSON.stringify({
      fileName: fileName || "question_bank.json",
      json
    });
    return true;
  } catch (err) {
    console.warn("Failed to write bank to window.name", err);
    return false;
  }
}

function readBankFromWindowName() {
  const raw = safeText(window.name || "");
  if (!raw.startsWith(QB_WINDOW_NAME_PREFIX)) return null;
  try {
    const payload = JSON.parse(raw.slice(QB_WINDOW_NAME_PREFIX.length));
    validateBankShape(payload?.json);
    return {
      json: payload.json,
      fileName: payload.fileName || "question_bank.json"
    };
  } catch {
    return null;
  }
}

function computeBankCounts(json) {
  const sectionsCount = Array.isArray(json?.sections) ? json.sections.length : 0;
  let questionsCount = 0;
  if (Array.isArray(json?.sections)) {
    for (const s of json.sections) questionsCount += Array.isArray(s?.questions) ? s.questions.length : 0;
  }
  return { sectionsCount, questionsCount };
}

function readStatus() {
  try {
    const raw = localStorage.getItem(QB_STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStatus(patch) {
  const cur = readStatus() || {};
  const next = { ...cur, ...(patch || {}) };
  try {
    localStorage.setItem(QB_STATUS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors for status
  }
  return next;
}

function readEditLog() {
  // Deprecated: audit log UI removed.
  return [];
}

function appendEditLog(entry, maxItems = 200) {
  // Deprecated: audit log UI removed.
  return [];
}

function clearLocalInfo() {
  try { localStorage.removeItem(QB_STATUS_KEY); } catch {}
  try { localStorage.removeItem(QB_INDEX_KEY); } catch {}
}

function normalizeKey(s) {
  return safeText(s).trim().toLowerCase().replace(/\s+/g, " ");
}

function makeSectionId(title) {
  const t = normalizeBilingual(title);
  const key = `${normalizeKey(t.en)}|${normalizeKey(t.pa)}`;
  // Simple hash to keep key small
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return "sec_" + Math.abs(h).toString(36);
}

function makeQuestionId(question, questionIndex) {
  const n = safeText(question?.number).trim();
  if (n) return "q_" + n;
  const qi = Number.isFinite(questionIndex) ? questionIndex : 0;
  return "qi_" + String(qi);
}

function readIndex() {
  try {
    const raw = localStorage.getItem(QB_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { files: {} };
    if (!parsed.files || typeof parsed.files !== "object") parsed.files = {};
    return parsed;
  } catch {
    return { files: {} };
  }
}

function writeIndex(indexObj) {
  try {
    localStorage.setItem(QB_INDEX_KEY, JSON.stringify(indexObj));
  } catch {
    // ignore
  }
}

function getFileIndex(fileName) {
  const idx = readIndex();
  const fn = safeText(fileName || "question_bank.json") || "question_bank.json";
  if (!idx.files[fn]) idx.files[fn] = { sections: {}, deleted: [] };
  if (!idx.files[fn].sections) idx.files[fn].sections = {};
  if (!Array.isArray(idx.files[fn].deleted)) idx.files[fn].deleted = [];
  return { idx, fn, file: idx.files[fn] };
}

function syncIndexWithBank(fileName, bankJson) {
  const { idx, fn, file } = getFileIndex(fileName);
  if (Array.isArray(bankJson?.sections)) {
    for (const sec of bankJson.sections) {
      const id = makeSectionId(sec?.title);
      const title = getSectionTitleDisplay(sec?.title);
      if (!file.sections[id]) file.sections[id] = { title, questions: {} };
      if (!file.sections[id].title) file.sections[id].title = title;
      if (!file.sections[id].questions || typeof file.sections[id].questions !== "object") file.sections[id].questions = {};

      if (Array.isArray(sec?.questions)) {
        sec.questions.forEach((q, qi) => {
          const qid = makeQuestionId(q, qi);
          if (!file.sections[id].questions[qid]) file.sections[id].questions[qid] = {};
          if (q?.number != null && file.sections[id].questions[qid].number == null) {
            file.sections[id].questions[qid].number = q.number;
          }
        });
      }
    }
  }
  idx.files[fn] = file;
  writeIndex(idx);
  return file;
}

function markSectionStatus(fileName, sectionTitle, patch) {
  const { idx, fn, file } = getFileIndex(fileName);
  const id = makeSectionId(sectionTitle);
  if (!file.sections[id]) file.sections[id] = { title: getSectionTitleDisplay(sectionTitle), questions: {} };
  if (!file.sections[id].questions || typeof file.sections[id].questions !== "object") file.sections[id].questions = {};
  file.sections[id] = { ...file.sections[id], ...(patch || {}) };
  idx.files[fn] = file;
  writeIndex(idx);
  return file.sections[id];
}

function markQuestionStatus(fileName, sectionTitle, question, questionIndex, patch) {
  const { idx, fn, file } = getFileIndex(fileName);
  const sid = makeSectionId(sectionTitle);
  if (!file.sections[sid]) file.sections[sid] = { title: getSectionTitleDisplay(sectionTitle), questions: {} };
  if (!file.sections[sid].questions || typeof file.sections[sid].questions !== "object") file.sections[sid].questions = {};

  const qid = makeQuestionId(question, questionIndex);
  if (!file.sections[sid].questions[qid]) file.sections[sid].questions[qid] = {};
  if (question?.number != null && file.sections[sid].questions[qid].number == null) {
    file.sections[sid].questions[qid].number = question.number;
  }
  file.sections[sid].questions[qid] = { ...file.sections[sid].questions[qid], ...(patch || {}) };

  idx.files[fn] = file;
  writeIndex(idx);
  return file.sections[sid].questions[qid];
}

function markDeletedSection(fileName, sectionTitle) {
  const { idx, fn, file } = getFileIndex(fileName);
  const id = makeSectionId(sectionTitle);
  const title = getSectionTitleDisplay(sectionTitle);
  const at = nowISO();
  file.deleted.push({ id, title, at });
  // Keep a tombstone so it still shows as deleted in the index.
  if (!file.sections[id]) file.sections[id] = { title, questions: {} };
  file.sections[id].deletedAt = at;
  idx.files[fn] = file;
  writeIndex(idx);
}

function stripJsonExt(name) {
  const s = safeText(name);
  return s.toLowerCase().endsWith(".json") ? s.slice(0, -5) : s;
}

function ensureSectionUpdates(json) {
  if (!json.section_updates || !Array.isArray(json.section_updates)) {
    json.section_updates = [];
  }
}

function findQuestionIndexByNumber(section, number) {
  const n = parseInt(number, 10);
  if (!Number.isFinite(n) || !section || !Array.isArray(section.questions)) return -1;
  return section.questions.findIndex((q) => parseInt(q?.number, 10) === n);
}

function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
}

function summarizeQuestion(q) {
  const qt = normalizeBilingual(q.question);
  const en = qt.en.trim();
  const pa = qt.pa.trim();
  return en || pa || "(empty question)";
}

function computeQuestionDiff(beforeQ, afterQ) {
  const diff = {};

  const fields = ["question", "options", "correct_option", "answer_text", "explanation"];
  for (const f of fields) {
    const a = beforeQ?.[f];
    const b = afterQ?.[f];
    const sa = JSON.stringify(a ?? null);
    const sb = JSON.stringify(b ?? null);
    if (sa !== sb) {
      diff[f] = { from: a ?? null, to: b ?? null };
    }
  }
  return diff;
}

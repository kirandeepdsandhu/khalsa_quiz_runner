// NOTE: This file is auto-split from app.full.js for maintainability.
// Part: app.02_setup_rounds.js

  // Question bank caching (IndexedDB)
  // =========================
  // Goal: make the app resilient to accidental reloads/navigation by restoring
  // the last loaded bank from browser storage.
  const BANK_CACHE_DB = "sikhQuizRunner_bank_cache_v1";
  const BANK_CACHE_STORE = "kv";
  const BANK_CACHE_KEY = "latestBankText";

  function openBankCacheDb() {
    return new Promise((resolve, reject) => {
      try {
        if (!("indexedDB" in window)) return resolve(null);
        const req = indexedDB.open(BANK_CACHE_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(BANK_CACHE_STORE)) {
            db.createObjectStore(BANK_CACHE_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function bankCachePutText(text) {
    const db = await openBankCacheDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(BANK_CACHE_STORE, "readwrite");
        tx.objectStore(BANK_CACHE_STORE).put(String(text || ""), BANK_CACHE_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function bankCacheGetText() {
    const db = await openBankCacheDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(BANK_CACHE_STORE, "readonly");
        const req = tx.objectStore(BANK_CACHE_STORE).get(BANK_CACHE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function clearBankCache() {
    const db = await openBankCacheDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(BANK_CACHE_STORE, "readwrite");
        tx.objectStore(BANK_CACHE_STORE).delete(BANK_CACHE_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function maybeRestoreBankFromCache() {
    // If a bank is already loaded, do nothing.
    if (bank) return true;

    const text = await bankCacheGetText();
    if (!text) return false;

    try {
      const json = JSON.parse(text);
      validateBank(json);
      loadBank(json);
      setBankStatus(true, `Question bank: loaded (${sectionsIndex.length} sections)`);
      renderSections();
      return true;
    } catch (err) {
      // Cache is corrupt or from a different schema; clear to avoid repeated failures.
      try { await clearBankCache(); } catch { /* ignore */ }
      return false;
    }
  }

  // Bank loading
  // =========================
  const DEFAULT_BANK_URL = "./Question_Bank_Sikhi_quiz.bilingual.en-pa.json";
  const DEFAULT_BANK_URL_FAMILY_TREE = "./Question_Bank_Sikh_Gurus_Family_Tree.en.json";

  function getSelectedDefaultBankUrl() {
    const sel = document.getElementById("defaultBankSelect");
    const v = sel && typeof sel.value === "string" ? sel.value.trim() : "";
    return v || DEFAULT_BANK_URL;
  }

  async function loadBankFromPicker() {
    const file = $("#bankFile").files?.[0];
    if (!file) {
      toast("Choose the JSON question bank first.");
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      validateBank(json);
      loadBank(json);

      // Persist the last successfully loaded bank for resilience across reloads.
      // Best-effort: ignore failures (quota, permissions, old browsers).
      bankCachePutText(text).catch(() => {});

      setBankStatus(true, `Question bank: loaded (${sectionsIndex.length} sections)`);
      toast("Question bank loaded.");
      renderSections();
      saveState();
    } catch (err) {
      console.error(err);
      setBankStatus(false, "Question bank: failed to load");
      toast("Failed to load JSON (see DevTools console).");
    }
  }

  async function loadBankFromDefault() {
    if (location.protocol === "file:") {
      toast("Default load needs a web server (GitHub Pages / Live Server). Use file picker for local.");
      return;
    }

    try {
      const url = getSelectedDefaultBankUrl();
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text);
      validateBank(json);
      loadBank(json);

      // Persist the last successfully loaded bank for resilience across reloads.
      bankCachePutText(text).catch(() => {});

      setBankStatus(true, `Question bank: loaded (${sectionsIndex.length} sections)`);
      toast("Default question bank loaded.");
      renderSections();
      saveState();
    } catch (err) {
      console.error(err);
      setBankStatus(false, "Question bank: failed to load");
      toast("Failed to load default bank (see DevTools console).");
    }
  }

  function validateBank(json) {
    if (!json || !Array.isArray(json.sections)) {
      throw new Error("Invalid bank: missing sections[]");
    }
    for (const s of json.sections) {
      if (typeof s.title !== "string" && (typeof s.title !== "object" || !s.title)) {
        throw new Error("Invalid bank: section missing title");
      }
      if (!Array.isArray(s.questions)) throw new Error(`Invalid bank: section '${s.title}' missing questions[]`);
    }
  }

  function loadBank(json) {
    bank = json;
    bankById = new Map();
    sectionsIndex = [];

    bank.sections.forEach((sec, idx) => {
      const t = normalizeBilingual(sec.title);
      const key = `${(t.en || t.pa || "Section").trim()}|${idx}`;
      sectionsIndex.push({
        key,
        titleEn: t.en || "",
        titlePa: t.pa || "",
        totalCount: Array.isArray(sec.questions) ? sec.questions.length : 0
      });

      for (const q of sec.questions) {
        const qid = makeQid(key, q);
        bankById.set(qid, {
          sectionKey: key,
          sectionTitleEn: t.en || "",
          sectionTitlePa: t.pa || "",
          q
        });
      }
    });

    // Initialize selected sections (default all on first load)
    if (!state.settings.selectedSections || Object.keys(state.settings.selectedSections).length === 0) {
      const sel = {};
      for (const s of sectionsIndex) sel[s.key] = true;
      state.settings.selectedSections = sel;
    } else {
      // Ensure new titles exist
      for (const s of sectionsIndex) {
        if (state.settings.selectedSections[s.key] === undefined) state.settings.selectedSections[s.key] = true;
      }
    }
  }

  // =========================
  // Teams
  // =========================
  function addTeam() {
    const name = $("#teamName").value.trim();
    const membersRaw = $("#teamMembers")?.value || "";
    if (!name) {
      toast("Enter a team name.");
      return;
    }

    state.teams.push({
      id: uid("team"),
      name,
      members: parseMembersCsv(membersRaw),
      score: 0,
      color: pickNextTeamColor()
    });
    $("#teamName").value = "";
    if ($("#teamMembers")) $("#teamMembers").value = "";
    saveState();
    renderAll();
    toast("Team added.");
  }

  function resetTeams() {
    if (!confirm("Reset teams (keeps rounds + asked history)?")) return;
    state.teams = [];
    saveState();
    renderAll();
    toast("Teams reset.");
  }

  function renderTeams() {
    const el = $("#teamList");
    el.innerHTML = "";

    if (state.teams.length === 0) {
      el.innerHTML = `<div class="hint">No teams yet. Add teams on the fly.</div>`;
      return;
    }

    for (const t of state.teams) {
      const row = document.createElement("div");
      row.className = "item";
        const members = Array.isArray(t.members) && t.members.length ? t.members.join(", ") : "";
        row.innerHTML = `
          <div style="min-width:240px">
            <div class="name"><span class="teamPill small" style="--teamColor:${escapeHtml(t.color || "#6aa9ff")}">${escapeHtml(t.name)}</span></div>
            ${members ? `<div class="muted small">Members: ${escapeHtml(members)}</div>` : ""}
            <div class="muted small">id: <span class="k">${escapeHtml(t.id)}</span></div>
          </div>
          <div class="row" style="justify-content:flex-end">
            <span class="score" title="Total score">${t.score}</span>
            <button class="btn small" data-act="rename" type="button">Rename</button>
            <button class="btn small bad" data-act="remove" type="button">Remove</button>
          </div>
        `;

      row.querySelector('[data-act="rename"]').addEventListener("click", () => {
        const nn = prompt("New team name:", t.name);
        if (!nn) return;
        const trimmed = nn.trim();
        if (trimmed) t.name = trimmed;
        saveState();
        renderAll();
      });

      row.querySelector('[data-act="remove"]').addEventListener("click", () => {
        if (!confirm(`Remove team "${t.name}"?`)) return;
        state.teams = state.teams.filter((x) => x.id !== t.id);

        // Also remove from any round results.
        for (const r of state.rounds) {
          if (r.resultsByTeamId && r.resultsByTeamId[t.id] !== undefined) {
            delete r.resultsByTeamId[t.id];
          }
        }

        saveState();
        renderAll();
      });

      el.appendChild(row);
    }
  }

  function applyPresetToSettings(p) {
    state.settings.roundName = p.name || "";
    state.settings.roundType = p.type || "normal";
    state.settings.pointsPerCorrect = clampInt(p.pointsPerCorrect, 1, 1000, 10);
    state.settings.pointsPerWrong = clampIntAllowNegative(p.pointsPerWrong, -1000, 0, 0);
    state.settings.questionsPerTeam = clampInt(p.questionsPerTeam ?? p.questionsPerRound ?? 1, 1, 1000, 1);
    state.settings.questionTimeSec = clampInt(p.questionTimeSec, 1, 3600, 30);
    state.settings.quickFireCount = clampInt(p.quickFireCount ?? 5, 2, 20, 5);
    state.settings.qfAllOrNone = (p.qfAllOrNone !== undefined) ? !!p.qfAllOrNone : false;
    state.settings.offlinePrompt = safeText(p.offlinePrompt || "");
    state.settings.allowSkip = (p.allowSkip !== undefined) ? !!p.allowSkip : true;
    state.settings.allowPass = (p.allowPass !== undefined) ? !!p.allowPass : true;

    const wanted = new Set(Array.isArray(p.sections) ? p.sections : []);
    const sel = state.settings.selectedSections || (state.settings.selectedSections = {});
    // If bank is loaded, sync selected sections. Offline rounds may have no bank.
    if (sectionsIndex && sectionsIndex.length) {
      // Default all off, then enable wanted.
      for (const s of sectionsIndex) sel[s.key] = false;
      for (const key of wanted) sel[key] = true;
    }

    // Sync form controls (if present)
    if ($("#roundName")) $("#roundName").value = state.settings.roundName;
    if ($("#roundType")) $("#roundType").value = state.settings.roundType;
    if ($("#pointsPerCorrect")) $("#pointsPerCorrect").value = state.settings.pointsPerCorrect;
    if ($("#pointsPerWrong")) $("#pointsPerWrong").value = state.settings.pointsPerWrong;
    if ($("#questionsPerRound")) $("#questionsPerRound").value = state.settings.questionsPerTeam;
    if ($("#questionTimeSec")) $("#questionTimeSec").value = state.settings.questionTimeSec;
    if ($("#quickFireCount")) $("#quickFireCount").value = state.settings.quickFireCount;
    if ($("#qfAllOrNone")) $("#qfAllOrNone").value = state.settings.qfAllOrNone ? "yes" : "no";
    if ($("#offlinePrompt")) $("#offlinePrompt").value = state.settings.offlinePrompt || "";
    if ($("#allowSkip")) $("#allowSkip").value = state.settings.allowSkip ? "yes" : "no";
    if ($("#allowPass")) $("#allowPass").value = state.settings.allowPass ? "yes" : "no";

    updateRoundTypeUI();
  }

  function updateRoundTypeUI() {
    const t = state.settings.roundType || "normal";
    const box = $("#offlinePromptBox");
    if (box) box.classList.toggle("hidden", t !== "offline");

    if (typeof refreshBankDependentUI === "function") refreshBankDependentUI();
  }

  function renderRoundPresets() {
    const el = $("#savedRoundsList");
    if (!el) return;
    el.innerHTML = "";

    const presets = Array.isArray(state.roundPresets) ? state.roundPresets : [];
    if (presets.length === 0) {
      el.innerHTML = `<div class="hint">No saved rounds yet. Configure settings + sections, then click <span class="k">Save round</span>.</div>`;
      return;
    }

    for (const p of presets) {
      const row = document.createElement("div");
      row.className = "item";

      const typeLabel = (p.type === "quickfire") ? "Quick Fire" : (p.type === "offline" ? "Offline" : "Normal");
      const secCount = Array.isArray(p.sections) ? p.sections.length : 0;
      const secLabel = (p.type === "offline") ? "—" : String(secCount);
      const qpt = (p.type === "offline") ? state.teams.length : (p.questionsPerTeam ?? p.questionsPerRound ?? 1);
      const unit = (p.type === "quickfire") ? "sets/team" : (p.type === "offline" ? "teams" : "q/team");
      const qfMode = (p.type === "quickfire" && (p.qfAllOrNone !== undefined ? !!p.qfAllOrNone : false)) ? " • All-or-none" : (p.type === "quickfire" ? " • Per-question" : "");
      const meta = `${typeLabel} • ${qpt} ${unit}${qfMode} • +${p.pointsPerCorrect}/${p.pointsPerWrong ?? 0} • ${p.questionTimeSec}s • Sections:${secLabel}`;

      row.innerHTML = `
        <div style="min-width:240px">
          <div class="name">${escapeHtml(p.name || "(unnamed round)")}</div>
          <div class="muted small">${escapeHtml(meta)}</div>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn small" data-act="up" type="button">↑</button>
          <button class="btn small" data-act="down" type="button">↓</button>
          <button class="btn primary" data-act="start" type="button">Start</button>
          <button class="btn small bad" data-act="delete" type="button">Delete</button>
        </div>
      `;

      row.querySelector('[data-act="up"]').addEventListener("click", () => {
        const i = state.roundPresets.findIndex((x) => x.id === p.id);
        if (i <= 0) return;
        const arr = state.roundPresets.slice();
        const tmp = arr[i - 1];
        arr[i - 1] = arr[i];
        arr[i] = tmp;
        state.roundPresets = arr;
        saveState();
        renderRoundPresets();
      });

      row.querySelector('[data-act="down"]').addEventListener("click", () => {
        const i = state.roundPresets.findIndex((x) => x.id === p.id);
        if (i < 0 || i >= state.roundPresets.length - 1) return;
        const arr = state.roundPresets.slice();
        const tmp = arr[i + 1];
        arr[i + 1] = arr[i];
        arr[i] = tmp;
        state.roundPresets = arr;
        saveState();
        renderRoundPresets();
      });

      {
        const startBtn = row.querySelector('[data-act="start"]');
        const needsBank = p.type !== "offline";
        const hasSections = Array.isArray(p.sections) && p.sections.length > 0;
        const noTeams = !Array.isArray(state.teams) || state.teams.length < 1;
        const disabled = needsBank && !bank;

        // A non-offline preset must include sections; older/corrupt presets might not.
        const disabledNoSections = needsBank && !hasSections;

        startBtn.disabled = noTeams || disabled || disabledNoSections;
        startBtn.title = noTeams
          ? "Add at least 1 team first."
          : (disabled
            ? "Load the question bank first."
            : (disabledNoSections ? "This saved round has no sections. Re-save it after selecting sections." : ""));

        startBtn.addEventListener("click", () => {
          if (!Array.isArray(state.teams) || state.teams.length < 1) {
            toast("Add at least 1 team.");
            return;
          }
          if (needsBank && !bank) {
            toast("Load the question bank first.");
            return;
          }
          if (needsBank && (!Array.isArray(p.sections) || p.sections.length === 0)) {
            toast("This saved round has no sections. Select sections and save it again.");
            return;
          }
          applyPresetToSettings(p);
          saveState();
          renderSections();
          startRound({ presetId: p.id });
        });
      }

      row.querySelector('[data-act="delete"]').addEventListener("click", () => {
        if (!confirm(`Delete saved round "${p.name || "(unnamed)"}"?`)) return;
        state.roundPresets = state.roundPresets.filter((x) => x.id !== p.id);
        saveState();
        renderRoundPresets();
      });

      el.appendChild(row);
    }
  }

  function saveCurrentRoundPreset() {
    const roundType = state.settings.roundType || "normal";
    if (roundType !== "offline" && !bank) {
      toast("Load the question bank first.");
      return;
    }

    const selected = (roundType === "offline")
      ? []
      : sectionsIndex.map((s) => s.key).filter((k) => !!state.settings.selectedSections?.[k]);
    if (roundType !== "offline" && selected.length === 0) {
      toast("Select at least one section to save.");
      return;
    }

    const name = (state.settings.roundName || "").trim() || prompt("Saved round name:", `Round ${state.roundPresets.length + 1}`) || "";
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Round name required.");
      return;
    }

    const preset = {
      id: uid("preset"),
      name: trimmed,
      type: roundType,
      pointsPerCorrect: state.settings.pointsPerCorrect,
      pointsPerWrong: state.settings.pointsPerWrong,
      questionsPerTeam: state.settings.questionsPerTeam,
      questionTimeSec: state.settings.questionTimeSec,
      quickFireCount: state.settings.quickFireCount ?? 5,
      qfAllOrNone: (state.settings.qfAllOrNone !== undefined) ? !!state.settings.qfAllOrNone : false,
      offlinePrompt: safeText(state.settings.offlinePrompt || ""),
      allowSkip: !!state.settings.allowSkip,
      allowPass: !!state.settings.allowPass,
      sections: selected
    };

    state.roundPresets.unshift(preset);
    saveState();
    renderRoundPresets();
    toast("Round saved.");
  }

  function getNextPresetToStart() {
    const presets = Array.isArray(state.roundPresets) ? state.roundPresets : [];
    if (presets.length === 0) return null;

    const rounds = Array.isArray(state.rounds) ? state.rounds : [];
    // Follow the current preset list order, but only treat a preset as “done”
    // if it has a completed round instance that has NOT been cleared.
    // This allows quiz-level resets (which mark rounds as cleared) to restart the sequence.
    const completedPresetIds = new Set(
      rounds
        .filter((r) => r && r.presetId && r.completedAt && !r.clearedAt)
        .map((r) => r.presetId)
    );

    // Always follow the current preset list order.
    for (const p of presets) {
      if (!p || !p.id) continue;
      if (!completedPresetIds.has(p.id)) return p;
    }
    return null;
  }

  // =========================
  // Settings
  // =========================
  function initSettingsBindings() {
    const pointsEl = $("#pointsPerCorrect");
    const wrongEl = $("#pointsPerWrong");
    const qprEl = $("#questionsPerRound");
    const timeEl = $("#questionTimeSec");
    const avoidEl = $("#avoidRepeats");
    const roundNameEl = $("#roundName");
    const roundTypeEl = $("#roundType");
    const qfCountEl = $("#quickFireCount");
    const qfAllOrNoneEl = $("#qfAllOrNone");
    const offlinePromptEl = $("#offlinePrompt");
    const allowSkipEl = $("#allowSkip");
    const allowPassEl = $("#allowPass");

    pointsEl.value = state.settings.pointsPerCorrect;
    wrongEl.value = state.settings.pointsPerWrong;
    qprEl.value = state.settings.questionsPerTeam;
    timeEl.value = state.settings.questionTimeSec;
    avoidEl.value = state.settings.avoidRepeats;
    if (roundNameEl) roundNameEl.value = state.settings.roundName || "";
    if (roundTypeEl) roundTypeEl.value = state.settings.roundType || "normal";
    if (qfCountEl) qfCountEl.value = state.settings.quickFireCount ?? 5;
    if (qfAllOrNoneEl) qfAllOrNoneEl.value = (state.settings.qfAllOrNone !== undefined ? !!state.settings.qfAllOrNone : false) ? "yes" : "no";
    if (offlinePromptEl) offlinePromptEl.value = state.settings.offlinePrompt || "";
    if (allowSkipEl) allowSkipEl.value = state.settings.allowSkip ? "yes" : "no";
    if (allowPassEl) allowPassEl.value = state.settings.allowPass ? "yes" : "no";

    updateRoundTypeUI();

    pointsEl.addEventListener("change", () => {
      state.settings.pointsPerCorrect = clampInt(pointsEl.value, 1, 1000, 10);
      pointsEl.value = state.settings.pointsPerCorrect;
      saveState();
      renderRoundMeta();
    });

    qprEl.addEventListener("change", () => {
      state.settings.questionsPerTeam = clampInt(qprEl.value, 1, 1000, 1);
      qprEl.value = state.settings.questionsPerTeam;
      saveState();
    });

    wrongEl.addEventListener("change", () => {
      // allow negative marking down to -1000
      state.settings.pointsPerWrong = clampIntAllowNegative(wrongEl.value, -1000, 0, 0);
      wrongEl.value = state.settings.pointsPerWrong;
      saveState();
      renderRoundMeta();
    });

    timeEl.addEventListener("change", () => {
      state.settings.questionTimeSec = clampInt(timeEl.value, 1, 3600, 30);
      timeEl.value = state.settings.questionTimeSec;
      saveState();
    });

    avoidEl.addEventListener("change", () => {
      state.settings.avoidRepeats = avoidEl.value;
      saveState();
    });

    if (roundNameEl) {
      roundNameEl.addEventListener("input", () => {
        state.settings.roundName = roundNameEl.value;
        saveState();
      });
    }

    if (roundTypeEl) {
      roundTypeEl.addEventListener("change", () => {
        state.settings.roundType = roundTypeEl.value;
        saveState();
        updateRoundTypeUI();
        renderRoundMeta();
      });
    }

    if (offlinePromptEl) {
      offlinePromptEl.addEventListener("input", () => {
        state.settings.offlinePrompt = offlinePromptEl.value;
        saveState();
      });
    }

    if (qfCountEl) {
      qfCountEl.addEventListener("change", () => {
        state.settings.quickFireCount = clampInt(qfCountEl.value, 2, 20, 5);
        qfCountEl.value = state.settings.quickFireCount;
        saveState();
      });
    }

    if (qfAllOrNoneEl) {
      qfAllOrNoneEl.addEventListener("change", () => {
        state.settings.qfAllOrNone = qfAllOrNoneEl.value === "yes";
        saveState();
        renderRoundMeta();
      });
    }

    if (allowSkipEl) {
      allowSkipEl.addEventListener("change", () => {
        state.settings.allowSkip = allowSkipEl.value === "yes";
        saveState();
      });
    }

    if (allowPassEl) {
      allowPassEl.addEventListener("change", () => {
        state.settings.allowPass = allowPassEl.value === "yes";
        saveState();
      });
    }
  }

  function renderSections() {
    const box = $("#sectionsBox");
    if (!bank) {
      box.className = "hint";
      box.textContent = "Load the question bank to choose sections.";
      return;
    }

    const sel = state.settings.selectedSections || {};

    box.className = "";
    box.innerHTML = `
      <div class="row" style="margin-bottom:10px">
        <button class="btn small" id="secAll" type="button">Select all</button>
        <button class="btn small" id="secNone" type="button">Select none</button>
        <span class="muted small">Selected: <span id="secCount"></span></span>
      </div>
      <div class="list" id="secList" style="margin-top:0"></div>
    `;

    const list = box.querySelector("#secList");

    for (const s of sectionsIndex) {
      const row = document.createElement("div");
      row.className = "item";

      const available = computeSectionAvailableCount(s.key);
      const total = s.totalCount;

      row.innerHTML = `
        <div>
          <div class="name">
            <span class="lang en small">${escapeHtml(s.titleEn || "")}</span>
            <span class="lang pa small">${escapeHtml(s.titlePa || "")}</span>
          </div>
          <div class="muted small">Questions: <span class="k">${total}</span> • Available: <span class="k">${available}</span></div>
        </div>
        <div class="row">
          <label class="muted small">
            <input type="checkbox" ${sel[s.key] ? "checked" : ""} />
            selected
          </label>
        </div>
      `;

      const cb = row.querySelector("input[type=checkbox]");
      cb.addEventListener("change", () => {
        state.settings.selectedSections[s.key] = cb.checked;
        saveState();
        updateCount();
      });

      list.appendChild(row);
    }

    box.querySelector("#secAll").addEventListener("click", () => {
      for (const s of sectionsIndex) state.settings.selectedSections[s.key] = true;
      saveState();
      renderSections();
    });

    box.querySelector("#secNone").addEventListener("click", () => {
      for (const s of sectionsIndex) state.settings.selectedSections[s.key] = false;
      saveState();
      renderSections();
    });

    function updateCount() {
      const c = sectionsIndex.filter((s) => !!state.settings.selectedSections[s.key]).length;
      box.querySelector("#secCount").textContent = `${c}/${sectionsIndex.length}`;
    }

    updateCount();
  }

  function computeSectionAvailableCount(sectionKey) {
    if (!bank) return 0;
    const sec = sectionsIndex.find((s) => s.key === sectionKey);
    if (!sec) return 0;

    // Walk all questions for this section and subtract asked.
    // Uses qid = sectionKey::number
    const idx = sectionsIndex.findIndex((s) => s.key === sectionKey);
    const bankSection = bank.sections[idx];
    if (!bankSection || !Array.isArray(bankSection.questions)) return 0;

    let available = 0;
    for (const q of bankSection.questions) {
      const qid = makeQid(sectionKey, q);
      if (!state.asked[qid]) available++;
    }
    return available;
  }

  // =========================
  // Rounds
  // =========================
  function getActiveRoundRecord() {
    if (!state.activeRound) return null;
    return state.rounds.find((x) => x.id === state.activeRound.roundId) || null;
  }

  function startRound(opts = {}) {
    const presetId = opts && typeof opts === "object" ? (opts.presetId || null) : null;
    // Ensure latest settings are captured even if user didn't blur the field.
    const wrongEl = $("#pointsPerWrong");
    if (wrongEl) {
      let n = parseInt(wrongEl.value, 10);
      if (!Number.isNaN(n)) {
        // If user types 5, treat it as -5 (negative marking)
        if (n > 0) n = -n;
        state.settings.pointsPerWrong = clampIntAllowNegative(n, -1000, 0, 0);
        wrongEl.value = state.settings.pointsPerWrong;
        saveState();
      }
    }

    if (state.activeRound) {
      if (!confirm("A round is already active. End it and start a new round?")) return;
      const prev = getActiveRoundRecord();
      if (prev && !prev.completedAt) prev.completedAt = nowISO();
      state.activeRound = null;
      stopTimer();
    }

    if (state.teams.length < 1) {
      toast("Add at least 1 team.");
      return;
    }
    const selected = sectionsIndex.map((s) => s.key).filter((k) => !!state.settings.selectedSections[k]);

    const points = state.settings.pointsPerCorrect;
    const pointsWrong = state.settings.pointsPerWrong;
    const avoid = true;
    const roundType = state.settings.roundType || "normal";
    const roundId = uid("round");
    const roundName = (state.settings.roundName || "").trim() || `Round ${state.rounds.length + 1}`;

    const questionsPerTeam = clampInt(state.settings.questionsPerTeam ?? 1, 1, 1000, 1);
    const allowSkip = !!state.settings.allowSkip;
    const allowPass = !!state.settings.allowPass;

    if (roundType === "offline") {
      const prompt = (state.settings.offlinePrompt || "").trim();
      if (!prompt) {
        toast("Enter an Offline prompt/statement.");
        return;
      }

      const teamIds = state.teams.map((t) => t.id);

      const round = {
        id: roundId,
        presetId,
        name: roundName,
        type: "offline",
        createdAt: nowISO(),
        pointsPerCorrect: points,
        pointsPerWrong: pointsWrong,
        questionTimeSec: state.settings.questionTimeSec,
        offlinePrompt: prompt,
        allowSkip: false,
        allowPass: false,
        sections: [],
        questionsCount: teamIds.length,
        resultsByTeamId: Object.fromEntries(teamIds.map((tid) => [tid, 0]))
      };

      state.rounds.unshift(round);
      state.activeRound = {
        roundId,
        questions: teamIds, // each "question" = one team entry
        questionTeams: teamIds,
        idx: 0,
        stage: "ready",
        revealed: false,
        answered: {},
        selectedKey: null,
        timerEndsAt: null,
        timerUnitKey: null,
        offlineOutcomesByTeamId: {}, // {teamId:{outcome, delta}}
        offlineSubmitted: false,
        offlineGoTimerId: null
      };

      stopTimer();
      setScoreboardSnapshotFromCurrent(roundId);
      saveState();
      selectTab("quiz");
      renderAll();
      toast("Offline round started.");
      return;
    }

    if (!bank) {
      toast("Load the question bank first.");
      return;
    }

    if (selected.length === 0) {
      toast("Select at least one section.");
      return;
    }

    if (roundType === "quickfire") {
      // Each "question" is a set of quick yes/no items.
      const setsCountDesired = questionsPerTeam * Math.max(1, state.teams.length);
      const perSet = clampInt(state.settings.quickFireCount ?? 5, 2, 20, 5);
      const totalNeeded = setsCountDesired * perSet;

      const chosenAll = buildEvenSectionQuestionList({ selectedSectionKeys: selected, desiredCount: totalNeeded, avoidRepeats: avoid });
      if (chosenAll.length < perSet) {
        toast("Not enough questions available for Quick Fire.");
        return;
      }

      const setsCount = Math.max(1, Math.floor(chosenAll.length / perSet));
      const used = chosenAll.slice(0, setsCount * perSet);

      // Reserve underlying questions immediately.
      if (avoid) {
        for (const qid of used) state.asked[qid] = true;
      }

      const setIds = Array.from({ length: setsCount }, (_, i) => `QFSET::${roundId}::${i + 1}`);
      const turnOrder = state.teams.map((t) => t.id);
      const questionTeams = setIds.map((_, i) => turnOrder[i % turnOrder.length]);

      const quickFireSets = setIds.map((setId, i) => {
        const slice = used.slice(i * perSet, (i + 1) * perSet);
        const items = slice.map((sourceQid) => {
          const entry = bankById.get(sourceQid);
          const q = entry?.q;
          const opts = q?.options || {};
          const keys = ["a", "b", "c", "d", "e", "f"].filter((k) => opts[k] !== undefined);
          const correctKey = safeText(q?.correct_option).toLowerCase();

          let statementKey = correctKey;
          if (keys.length > 0) {
            const wrongKeys = keys.filter((k) => k !== correctKey);
            const pickCorrect = Math.random() < 0.5 || wrongKeys.length === 0;
            statementKey = pickCorrect ? correctKey : wrongKeys[Math.floor(Math.random() * wrongKeys.length)];
          }

          return {
            sourceQid,
            statementKey,
            selection: null, // 'yes'|'no'|null
            locked: false,
            isCorrect: null
          };
        });

        return { setId, items, perSet, done: false, correctCount: 0, wrongCount: 0 };
      });

      const round = {
        id: roundId,
        presetId,
        name: roundName,
        type: "quickfire",
        createdAt: nowISO(),
        pointsPerCorrect: points,
        pointsPerWrong: pointsWrong,
        questionTimeSec: state.settings.questionTimeSec,
        quickFireCount: perSet,
        qfAllOrNone: (state.settings.qfAllOrNone !== undefined) ? !!state.settings.qfAllOrNone : false,
        allowSkip: false,
        allowPass: false,
        sections: selected,
        questionsCount: setIds.length,
        resultsByTeamId: Object.fromEntries(state.teams.map((t) => [t.id, 0]))
      };

      state.rounds.unshift(round);
      state.activeRound = {
        roundId,
        questions: setIds,
        questionTeams,
        idx: 0,
        stage: "ready",
        revealed: false,
        answered: {},
        selectedKey: null,
        timerEndsAt: null,
        timerUnitKey: null,
        quickFireSets
      };

      stopTimer();

      // Freeze scoreboard during the round (presenter can manually update from Scoreboard tab).
      setScoreboardSnapshotFromCurrent(roundId);

      saveState();
      selectTab("quiz");
      renderAll();
      toast(`Quick Fire started (${setIds.length} turns, ${perSet} questions each).`);
      return;
    }

    const desiredCount = questionsPerTeam * Math.max(1, state.teams.length);
    const chosen = buildEvenSectionQuestionList({ selectedSectionKeys: selected, desiredCount, avoidRepeats: avoid });
    if (chosen.length === 0) {
      toast("No questions available (maybe all already asked). Clear asked history or allow repeats.");
      return;
    }

    // Reserve questions immediately to prevent repeats across rounds.
    if (avoid) {
      for (const qid of chosen) state.asked[qid] = true;
    }

    const turnOrder = state.teams.map((t) => t.id);
    const questionTeams = chosen.map((_, i) => turnOrder[i % turnOrder.length]);

    const round = {
      id: roundId,
      presetId,
      name: roundName,
      type: "normal",
      createdAt: nowISO(),
      pointsPerCorrect: points,
      pointsPerWrong: pointsWrong,
      questionTimeSec: state.settings.questionTimeSec,
      allowSkip,
      allowPass,
      sections: selected,
      questionsCount: chosen.length,
      resultsByTeamId: Object.fromEntries(state.teams.map((t) => [t.id, 0]))
    };

    state.rounds.unshift(round);
    state.activeRound = {
      roundId,
      questions: chosen,
      questionTeams,
      idx: 0,
      stage: "ready",
      revealed: false,
      answered: {},
      selectedKey: null,
      timerEndsAt: null,
      timerUnitKey: null
    };

    stopTimer();

    // Freeze scoreboard during the round (presenter can manually update from Scoreboard tab).
    setScoreboardSnapshotFromCurrent(roundId);

    saveState();
    selectTab("quiz");
    renderAll();
    toast(`Round started (${chosen.length} questions).`);
  }

  function clearAsked() {
    if (!confirm("Clear asked-question history? (Allows repeats across rounds)")) return;
    state.asked = {};
    saveState();
    renderSections();
    renderAll();
    toast("Asked history cleared.");
  }

  function setScoreboardSnapshotFromCurrent(roundId) {
    state.ui = state.ui || {};
    const orderTeamIds = [...state.teams]
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((t) => t.id);
    const scoresByTeamId = Object.fromEntries(state.teams.map((t) => [t.id, t.score ?? 0]));

    state.ui.scoreboardSnapshot = {
      roundId: roundId || null,
      updatedAt: nowISO(),
      orderTeamIds,
      scoresByTeamId
    };
  }

  function getScoreboardSnapshotStatus() {
    const isRoundActive = !!state.activeRound;
    const snap = state.ui?.scoreboardSnapshot || null;
    if (!isRoundActive) return { isRoundActive, snap, isOutdated: false, changedTeams: 0, deltaSum: 0 };
    if (!snap || snap.roundId !== state.activeRound.roundId) return { isRoundActive, snap, isOutdated: true, changedTeams: 0, deltaSum: 0 };

    let changedTeams = 0;
    let deltaSum = 0;
    for (const t of state.teams) {
      const before = snap.scoresByTeamId?.[t.id] ?? (t.score ?? 0);
      const now = t.score ?? 0;
      if (before !== now) {
        changedTeams++;
        deltaSum += (now - before);
      }
    }
    return { isRoundActive, snap, isOutdated: changedTeams > 0, changedTeams, deltaSum };
  }

  // =========================
  // Reset scores (round / quiz)
  // =========================
  function recomputeTeamScoresFromRounds() {
    const teamById = Object.fromEntries(state.teams.map((t) => [t.id, t]));
    for (const t of state.teams) t.score = 0;

    for (const r of state.rounds) {
      if (r?.clearedAt) continue;
      const res = r?.resultsByTeamId || {};
      for (const [tid, ptsRaw] of Object.entries(res)) {
        const team = teamById[tid];
        if (!team) continue;
        const pts = Number(ptsRaw) || 0;
        team.score = (team.score ?? 0) + pts;
      }
    }
  }

  function clearRoundScores(roundId) {
    const r = state.rounds.find((x) => x.id === roundId) || null;
    if (!r) {
      toast("Round not found.");
      return;
    }
    const label = r.name || `Round ${r.id.slice(0, 8)}`;
    if (r.clearedAt) {
      toast("That round is already cleared.");
      return;
    }

    const isActiveThisRound = state.activeRound?.roundId === r.id;
    if (isActiveThisRound) {
      if (!confirm(`"${label}" is currently active. End it and clear its scores?`)) return;
      stopTimer();
      state.activeRound = null;
    } else {
      if (!confirm(`Clear scores for "${label}"?`)) return;
    }

    r.clearedAt = nowISO();
    r.clearedResultsByTeamId = { ...(r.resultsByTeamId || {}) };
    r.resultsByTeamId = {};

    // Clear any freeze/suspense UI that depends on round deltas.
    if (state.ui?.scoreboardSnapshot) delete state.ui.scoreboardSnapshot;
    scoreboardReveal = null;
    scoreboardSequence = null;

    recomputeTeamScoresFromRounds();
    saveState();
    renderAll();
    toast("Round scores cleared.");
  }

  function clearAllRoundScores() {
    if (state.activeRound) {
      if (!confirm("An active round is running. End it and clear scores for ALL rounds?")) return;
      stopTimer();
      state.activeRound = null;
    }

    if (!confirm("Clear scores for ALL rounds?")) return;

    // Quiz-level reset: remove rounds from the list entirely.
    // (Round-level reset keeps the round record with a "cleared" badge.)
    state.rounds = [];

    if (state.ui?.scoreboardSnapshot) delete state.ui.scoreboardSnapshot;
    scoreboardReveal = null;
    scoreboardSequence = null;

    recomputeTeamScoresFromRounds();
    saveState();
    renderAll();
    toast("All rounds cleared.");
  }

  function endRound() {
    const r = getActiveRoundRecord();
    if (!r) {
      toast("No active round.");
      return;
    }
    if (!confirm("End current round?")) return;

    endRoundCore(r);
  }

  function endRoundCore(r) {
    // guard: avoid double-ending
    if (!r || r.completedAt) return;

    // Prepare suspense reveal on Scoreboard tab using this round's deltas.
    const deltasByTeamId = { ...(r.resultsByTeamId || {}) };
    const baseScoresByTeamId = {};
    for (const t of state.teams) {
      const d = deltasByTeamId[t.id] ?? 0;
      baseScoresByTeamId[t.id] = (t.score ?? 0) - d;
    }

    const orderTeamIds = [...state.teams]
      .slice()
      .sort((a, b) => (baseScoresByTeamId[b.id] ?? 0) - (baseScoresByTeamId[a.id] ?? 0))
      .map((t) => t.id);

    // Force Scoreboard list to start from the base order.
    renderScoreboards._order = orderTeamIds.slice();

    r.completedAt = nowISO();
    state.activeRound = null;
    stopTimer();

    // Round ended: scoreboard should no longer be frozen.
    if (state.ui?.scoreboardSnapshot) {
      delete state.ui.scoreboardSnapshot;
    }
    saveState();

    selectTab("scoreboard");
    renderAll();
    toast("Round ended.");

    // Suspenseful: show scoreboard first, then begin reveal after a short pause.
    scoreboardReveal = null;
    window.setTimeout(() => {
      // If another reveal already started, don't stomp it.
      if (scoreboardSequence) return;
      startEndRoundScoreboardSequence({
        roundId: r.id,
        baseScoresByTeamId,
        deltasByTeamId,
        orderTeamIds
      });
    }, 2000);
  }

  function renderRoundMeta() {
    const badge = $("#roundBadge");
    const meta = $("#roundMeta");

    const r = getActiveRoundRecord();
    if (!r || !state.activeRound) {
      badge.textContent = "No active round";
      meta.textContent = "";
      return;
    }

    const idx = state.activeRound.idx + 1;
    const teamId = state.activeRound.questionTeams?.[state.activeRound.idx];
    const team = teamId ? getTeamById(teamId) : null;
    const teamLabel = team ? ` • Turn: ${team.name}` : "";

    const roundLabel = r.name ? r.name : `Round ${r.id.slice(0, 8)}`;
    const typeLabel = r.type === "quickfire" ? "Quick Fire" : (r.type === "offline" ? "Offline" : "Normal");
    const qLabel = r.type === "quickfire" ? "Turn" : (r.type === "offline" ? "Team" : "Q");

    badge.textContent = `${roundLabel} • ${typeLabel} • ${qLabel} ${idx}/${r.questionsCount}${teamLabel}`;
    const secs = (r.type === "offline") ? "—" : String(r.sections.length);
    meta.textContent = `Correct: +${r.pointsPerCorrect} • Wrong: ${r.pointsPerWrong ?? 0} • Timer: ${r.questionTimeSec ?? state.settings.questionTimeSec}s • Sections: ${secs}`;
  }

  function buildEvenSectionQuestionList({ selectedSectionKeys, desiredCount, avoidRepeats }) {
    // Buckets by section, each shuffled.
    const buckets = new Map();
    for (let i = 0; i < bank.sections.length; i++) {
      const secMeta = sectionsIndex[i];
      const sec = bank.sections[i];
      if (!secMeta || !selectedSectionKeys.includes(secMeta.key)) continue;

      const arr = [];
      for (const q of sec.questions || []) {
        const qid = makeQid(secMeta.key, q);
        if (avoidRepeats && state.asked[qid]) continue;
        arr.push(qid);
      }
      shuffle(arr);
      buckets.set(secMeta.key, arr);
    }

    const keys = selectedSectionKeys.slice();
    shuffle(keys);

    const chosen = [];
    while (chosen.length < desiredCount) {
      let progressed = false;
      for (const key of keys) {
        if (chosen.length >= desiredCount) break;
        const bucket = buckets.get(key) || [];
        if (bucket.length === 0) continue;
        chosen.push(bucket.pop());
        progressed = true;
      }
      if (!progressed) break; // all buckets empty
    }

    // Ensure unique
    return Array.from(new Set(chosen));
  }

  // =========================

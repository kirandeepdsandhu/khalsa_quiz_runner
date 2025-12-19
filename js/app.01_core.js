// NOTE: This file is auto-split from app.full.js for maintainability.
// Part: app.01_core.js

  "use strict";

  // =========================
  // State model
  // =========================
  const STORAGE_KEY = "sikhQuizRunner_state_v1";

  const RESULT_OVERLAY_MS = 2000;

  let rankHoldUntil = 0;
  let rankHoldLiveOrder = null;
  let rankHoldBoardOrder = null;
  let rankHoldTimerId = null;

  // End-of-round suspense reveal on Scoreboard tab (ephemeral, not persisted)
  let scoreboardReveal = null; // {roundId, startAt, durationMs, orderTeamIds, baseScoresByTeamId, deltasByTeamId}
  let scoreboardSequence = null; // {token, roundId, orderTeamIds, scoresByTeamId, baseScoresByTeamId, deltasByTeamId, phase, currentTeamId}
  let nextScoreboardFlipOpts = null; // {mode, perStepMs}

  const defaultState = () => ({
    teams: [], // {id, name, members?: string[], score, color}
    rounds: [], // {id, name, type, createdAt, pointsPerCorrect, sections, questionsCount, resultsByTeamId, completedAt?}
    roundPresets: [], // {id, name, type, pointsPerCorrect, pointsPerWrong, questionsPerTeam, questionTimeSec, quickFireCount, allowSkip, allowPass, sections:[sectionKey]}
    activeRound: null, // {roundId, questions:[qid], questionTeams:[teamId], idx, revealed, answered:{ [qid]: {teamId, selectedKey, outcome, delta, detail?} }, selectedKey?, timerEndsAt?, timerUnitKey?, quickFireSets? }
    asked: {}, // { [qid]: true }
    ui: {
      quizShowLiveScore: true,
      ribbonHidden: false
    },
    settings: {
      pointsPerCorrect: 10,
      pointsPerWrong: 0,
      questionsPerTeam: 1,
      questionTimeSec: 30,
      avoidRepeats: "yes",
      selectedSections: {},
      roundName: "",
      roundType: "normal",
      quickFireCount: 5,
      qfAllOrNone: false,
      offlinePrompt: "",
      allowSkip: true,
      allowPass: true
    },
    undoStack: [] // not persisted
  });

  let state = loadState();

  // Bank is not persisted; it is loaded from file picker.
  let bank = null;
  let bankById = new Map(); // qid -> {sectionKey, sectionTitleEn, sectionTitlePa, q}
  let sectionsIndex = []; // [{key, titleEn, titlePa, totalCount}]

  const TEAM_COLOR_PALETTE = [
    "#6aa9ff",
    "#38d17a",
    "#ffd166",
    "#ff5c7a",
    "#b389ff",
    "#4ad7d1",
    "#ff9f68",
    "#8be9fd",
    "#f78fb3",
    "#7bed9f"
  ];

  let timerIntervalId = null;

  // Timer “ticking bomb” beep (ephemeral)
  let lastTickBeepSec = null;

  // =========================
  // DOM helpers
  // =========================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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

  function uid(prefix = "id") {
    return prefix + "_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function clampIntAllowNegative(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
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

  function parseMembersCsv(s) {
    return safeText(s)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  // qid is stable across reloads if you load the same bank.
  function makeQid(sectionKey, q) {
    return `${sectionKey}::${q.number}`;
  }

  // =========================
  // Persistence
  // =========================
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const d = defaultState();
      const s = {
        ...d,
        ...parsed,
        ui: { ...d.ui, ...(parsed.ui || {}) },
        settings: { ...d.settings, ...(parsed.settings || {}) },
        asked: parsed.asked || {},
        rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
        roundPresets: Array.isArray(parsed.roundPresets) ? parsed.roundPresets : [],
        teams: Array.isArray(parsed.teams) ? parsed.teams : [],
        activeRound: parsed.activeRound || null,
        undoStack: []
      };

      // Back-compat: older saved states used questionsPerRound.
      // Convert to questionsPerTeam with a reasonable default.
      if (s.settings.questionsPerTeam === undefined) {
        const old = s.settings.questionsPerRound;
        if (old !== undefined) {
          const teamCount = Array.isArray(s.teams) && s.teams.length ? s.teams.length : 1;
          s.settings.questionsPerTeam = clampInt(Math.round(Number(old) / Math.max(1, teamCount)), 1, 1000, 1);
        } else {
          s.settings.questionsPerTeam = 1;
        }
      }

      if (s.settings.allowSkip === undefined) s.settings.allowSkip = true;
      if (s.settings.allowPass === undefined) s.settings.allowPass = true;
      if (s.settings.qfAllOrNone === undefined) s.settings.qfAllOrNone = false;
      if (s.settings.offlinePrompt === undefined) s.settings.offlinePrompt = "";

      return s;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      undoStack: []
    }));
    refreshStatePreview();
  }

  // =========================
  // Toast + status
  // =========================
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.display = "none"), 1700);
  }

  function setBankStatus(ok, text) {
    const dot = $("#bankDot");
    dot.className = "dot " + (ok ? "ok" : "no");

    const pill = $("#bankStatusPill");
    if (pill) {
      pill.classList.toggle("bankOk", !!ok);
      pill.classList.toggle("bankNo", !ok);
    }

    // Make the message explicit and actionable.
    let msg = safeText(text || "").trim();
    if (!msg) msg = ok ? "Question bank: LOADED" : "Question bank: NOT LOADED — load in Setup";
    if (!ok && /not\s+loaded/i.test(msg) && !/load\s+in\s+setup/i.test(msg)) {
      msg = "Question bank: NOT LOADED — load in Setup";
    }
    if (!ok && /failed/i.test(msg) && !/try\s+again/i.test(msg)) {
      msg = "Question bank: FAILED TO LOAD — pick the JSON file and press Load";
    }

    const statusEl = $("#bankStatus");
    if (statusEl) statusEl.textContent = msg;

    refreshBankDependentUI();
  }

  function refreshBankDependentUI() {
    // Bank is intentionally kept in memory only.
    const loaded = !!bank;
    const roundType = state?.settings?.roundType || "normal";

    // Setup: saving presets requires bank for Normal/Quick Fire.
    const btnSavePreset = $("#btnSaveRoundPreset");
    if (btnSavePreset) {
      const needsBank = roundType !== "offline";
      btnSavePreset.disabled = needsBank && !loaded;
      btnSavePreset.title = btnSavePreset.disabled ? "Load the question bank first." : "";
    }

    // Quiz: starting next preset requires bank for Normal/Quick Fire.
    const nextBtn = $("#btnStartNextRound");
    if (nextBtn && typeof getNextPresetToStart === "function") {
      const p = getNextPresetToStart();
      const needsBank = !!p && p.type !== "offline";
      nextBtn.disabled = !!p && needsBank && !loaded;
      nextBtn.title = nextBtn.disabled ? "Load the question bank first (Setup tab)." : "";
    }

    // Setup list: Start buttons are created dynamically.
    if (typeof renderRoundPresets === "function") {
      try { renderRoundPresets(); } catch { /* ignore */ }
    }
  }

  // =========================
  // Result overlay + SFX
  // =========================
  function showResultOverlay({ outcome, delta, text, sub }) {
    const el = $("#resultOverlay");
    if (!el) return;

    const good = outcome === "correct";
    const isTimeout = outcome === "timeout";
    const bad = outcome === "wrong";
    const neutral = outcome === "neutral";

    const icon = good ? "🚀" : (isTimeout ? "⏰" : (bad ? "💥" : (neutral ? "➖" : "💠")));

    const sign = delta > 0 ? "+" : "";
    const label = text || (good ? "Correct" : (isTimeout ? "Time up" : (bad ? "Wrong" : (neutral ? "Neutral" : "Result"))));
    const subtitle = sub || "";

    el.className = "resultOverlay show";
    el.innerHTML = `
      <div class="resultPanel ${good ? "good" : (isTimeout ? "timeout" : (bad ? "bad" : (neutral ? "neutral" : "")))}">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:14px">
          <div class="resultLeft">
            <div class="resultIcon" aria-hidden="true"><span style="font-size:34px; line-height:1">${icon}</span></div>
            <div>
              <div class="resultText">${escapeHtml(label)}</div>
              ${subtitle ? `<div class="resultSub">${escapeHtml(subtitle)}</div>` : ""}
            </div>
          </div>
          <div class="resultDelta">${escapeHtml(`${sign}${delta} pts`)}</div>
        </div>
      </div>
    `;

    clearTimeout(showResultOverlay._t);
    showResultOverlay._t = setTimeout(() => {
      el.className = "resultOverlay";
      el.innerHTML = "";
    }, RESULT_OVERLAY_MS);
  }

  function playSfx(outcome) {
    try {
      // Prefer real audio files (if present) for higher-quality SFX.
      // Drop files in sfx/ (relative to index.html).
      // - correct: sfx/correct.mp3
      // If the file can't be loaded/played (missing/autoplay), fall back to WebAudio.
      const tryPlayFileSfx = (key) => {
        if (key !== "correct") return Promise.resolve(false);
        const candidates = [
          "sfx/correct.mp3",
          "sfx/correct.wav",
          "sfx/correct.mp3.wav",
        ];
        const tryOne = (i) => {
          if (i >= candidates.length) return Promise.resolve(false);
          try {
            const a = new Audio(candidates[i]);
            a.preload = "auto";
            a.volume = 1.0;
            return a.play().then(() => true).catch(() => tryOne(i + 1));
          } catch {
            return tryOne(i + 1);
          }
        };
        return tryOne(0);
      };

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = playSfx._ctx || (playSfx._ctx = new AudioCtx());
      const doPlay = () => {
        const t0 = ctx.currentTime + 0.02;

        if (outcome === "correct") {
          // Original-style: clean rising arpeggio (no claps / crowd / noise).
          const master = ctx.createGain();
          master.gain.setValueAtTime(0.0001, t0);
          master.gain.exponentialRampToValueAtTime(0.20, t0 + 0.015);
          master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.70);
          master.connect(ctx.destination);

          const tone = (freq, at, dur, gain = 0.20) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle";
            o.frequency.setValueAtTime(freq, at);

            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

            o.connect(g);
            g.connect(master);
            o.start(at);
            o.stop(at + dur + 0.02);
          };

          // C major up (pleasant “win” blip)
          const C5 = 523.25;
          const E5 = 659.25;
          const G5 = 783.99;
          const C6 = 1046.50;
          tone(C5, t0 + 0.00, 0.16, 0.22);
          tone(E5, t0 + 0.12, 0.16, 0.20);
          tone(G5, t0 + 0.24, 0.18, 0.19);
          tone(C6, t0 + 0.38, 0.22, 0.17);
        } else if (outcome === "wrong" || outcome === "timeout") {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(190, t0);
        o.frequency.exponentialRampToValueAtTime(95, t0 + 0.55);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.90);
        }
      };

      // Try file SFX first (especially for "correct"). If it plays, skip WebAudio.
      // Note: this still requires a user gesture at least once in most browsers.
      tryPlayFileSfx(outcome).then((played) => {
        if (played) return;

        if (ctx.state === "suspended") {
          ctx.resume().then(doPlay).catch(() => {});
        } else {
          doPlay();
        }
      });
    } catch {
      // ignore
    }
  }

  function playTickBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = playSfx._ctx || (playSfx._ctx = new AudioCtx());
      if (ctx.state === "suspended") ctx.resume();

      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(880, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.12);
    } catch {
      // ignore
    }
  }

  function buzzScreen() {
    const box = $("#quizBox");
    if (box) {
      box.classList.remove("buzz");
      // force reflow
      void box.offsetWidth;
      box.classList.add("buzz");
    }

    try {
      if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 80]);
    } catch {
      // ignore
    }
  }

  // =========================
  // Tabs
  // =========================
  function initTabs() {
    $$(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".tab").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");

        const name = btn.dataset.tab;
        ["setup", "quiz", "scoreboard", "backup"].forEach((sec) => {
          $("#tab-" + sec).classList.toggle("hidden", sec !== name);
        });

        renderAll();
      });
    });
  }

  function selectTab(name) {
    const btn = $(`.tab[data-tab="${name}"]`);
    if (btn) btn.click();
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  function pickNextTeamColor() {
    const used = new Set(state.teams.map((t) => t.color).filter(Boolean));
    const next = TEAM_COLOR_PALETTE.find((c) => !used.has(c));
    if (next) return next;
    // fallback: cycle (still unique-ish for small team counts)
    return TEAM_COLOR_PALETTE[state.teams.length % TEAM_COLOR_PALETTE.length];
  }

  function ensureTeamColors() {
    for (const t of state.teams) {
      if (!t.color) t.color = pickNextTeamColor();
    }
  }

  function getTeamById(teamId) {
    return state.teams.find((t) => t.id === teamId) || null;
  }

  function formatTimeMMSS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function hexToRgba(hex, alpha) {
    const h = safeText(hex).replace("#", "").trim();
    if (h.length !== 6) return `rgba(106,169,255,${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function bubbleMoveTeamUntilSettled(teamId, stepMs) {
    if (!scoreboardSequence) return 0;
    const token = scoreboardSequence.token;
    let movedSteps = 0;

    for (let guard = 0; guard < 50; guard++) {
      if (!scoreboardSequence || scoreboardSequence.token !== token) return movedSteps;

      const order = scoreboardSequence.orderTeamIds;
      const scores = scoreboardSequence.scoresByTeamId;

      const idx = order.indexOf(teamId);
      if (idx < 0) return movedSteps;

      const myScore = scores[teamId] ?? 0;
      const aboveId = idx > 0 ? order[idx - 1] : null;
      const belowId = idx < order.length - 1 ? order[idx + 1] : null;

      // Decide direction based on current shown scores.
      let dir = null;
      if (aboveId && myScore > (scores[aboveId] ?? 0)) dir = "up";
      else if (belowId && myScore < (scores[belowId] ?? 0)) dir = "down";
      else break;

      if (dir === "up") {
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      } else {
        [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
      }

      movedSteps++;

      // Animate one swap step.
      nextScoreboardFlipOpts = { mode: "smooth", perStepMs: stepMs, playSfx: false };
      renderScoreboards();
      playRankMoveSfx(dir, 1);
      await delay(stepMs + 140);
    }

    return movedSteps;
  }

  function startEndRoundScoreboardSequence({ roundId, baseScoresByTeamId, deltasByTeamId, orderTeamIds, keepFinalMs = 0 }) {
    const token = uid("seq");
    scoreboardSequence = {
      token,
      roundId,
      orderTeamIds: orderTeamIds.slice(),
      baseScoresByTeamId: { ...baseScoresByTeamId },
      deltasByTeamId: { ...deltasByTeamId },
      scoresByTeamId: { ...baseScoresByTeamId },
      phase: "idle", // 'delta'|'move'|'idle'
      currentTeamId: null
    };

    // Process one team at a time. Bottom-to-top is more suspenseful.
    const queue = orderTeamIds.slice().reverse();

    (async () => {
      for (const teamId of queue) {
        if (!scoreboardSequence || scoreboardSequence.token !== token) return;

        const delta = deltasByTeamId?.[teamId] ?? 0;
        if (!delta) continue;

        scoreboardSequence.currentTeamId = teamId;
        scoreboardSequence.phase = "delta";
        scoreboardSequence.scoresByTeamId[teamId] = (baseScoresByTeamId?.[teamId] ?? 0) + delta;
        renderScoreboards();

        // 1) Show delta (2s)
        await delay(2000);
        if (!scoreboardSequence || scoreboardSequence.token !== token) return;

        // 2) Move team step-by-step (slower per-step) with sounds
        scoreboardSequence.phase = "move";
        renderScoreboards();
        const movedSteps = await bubbleMoveTeamUntilSettled(teamId, 1100);
        if (movedSteps === 0) playRankNeutralSfx();
        if (!scoreboardSequence || scoreboardSequence.token !== token) return;

        scoreboardSequence.phase = "idle";
        scoreboardSequence.currentTeamId = null;
        renderScoreboards();
        await delay(180);
      }

      if (!scoreboardSequence || scoreboardSequence.token !== token) return;

      // Keep final ordering/scores visible briefly (useful for TEST so it doesn't snap back immediately).
      scoreboardSequence.phase = "final";
      scoreboardSequence.currentTeamId = null;
      renderScoreboards();
      flashFinalRanking();

      const hold = clampInt(keepFinalMs ?? 0, 0, 30000, 0);
      if (hold > 0) {
        await delay(hold);
        if (!scoreboardSequence || scoreboardSequence.token !== token) return;
      }

      scoreboardSequence = null;
      renderScoreboards();
    })();
  }

  function startTestScoreboardSequence() {
    if (state.teams.length < 2) {
      toast("Add at least 2 teams to test re-ranking.");
      return;
    }

    // Cancel any existing sequence.
    scoreboardSequence = null;
    scoreboardReveal = null;

    const baseScoresByTeamId = Object.fromEntries(state.teams.map((t) => [t.id, t.score ?? 0]));

    // Use current displayed order if available; otherwise sort by real totals.
    const baseOrder = (renderScoreboards._order && renderScoreboards._order.length)
      ? renderScoreboards._order.slice()
      : [...state.teams].slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((t) => t.id);

    const deltasByTeamId = {};
    let nonZero = 0;
    for (const t of state.teams) {
      // multiples of 5 between -20..+20
      let d = (Math.floor(Math.random() * 9) - 4) * 5;
      // avoid too many zeros
      if (d === 0 && Math.random() < 0.75) d = (Math.random() < 0.5 ? -1 : 1) * 5;
      deltasByTeamId[t.id] = d;
      if (d !== 0) nonZero++;
    }

    // Ensure at least one change.
    if (nonZero === 0) {
      const pick = state.teams[Math.floor(Math.random() * state.teams.length)];
      deltasByTeamId[pick.id] = 10;
    }

    // Ensure there is at least one positive and one negative (more interesting).
    const hasPos = Object.values(deltasByTeamId).some((d) => d > 0);
    const hasNeg = Object.values(deltasByTeamId).some((d) => d < 0);
    if (!hasPos) {
      const pick = state.teams[Math.floor(Math.random() * state.teams.length)];
      deltasByTeamId[pick.id] = Math.abs(deltasByTeamId[pick.id]) || 10;
    }
    if (!hasNeg) {
      const pick = state.teams[Math.floor(Math.random() * state.teams.length)];
      deltasByTeamId[pick.id] = -Math.max(5, Math.abs(deltasByTeamId[pick.id]));
    }

    selectTab("scoreboard");
    renderAll();
    toast("Testing scoreboard animation…");
    startEndRoundScoreboardSequence({
      roundId: "TEST",
      baseScoresByTeamId,
      deltasByTeamId,
      orderTeamIds: baseOrder,
      keepFinalMs: 5000
    });
  }

  function playRankMoveSfx(direction, steps) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = playSfx._ctx || (playSfx._ctx = new AudioCtx());
      if (ctx.state === "suspended") ctx.resume();

      const count = clampInt(steps, 1, 8, 1);
      const t0 = ctx.currentTime + 0.01;

      const makeNoiseBuffer = (durSec) => {
        const len = Math.max(1, Math.floor(ctx.sampleRate * durSec));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const env = Math.exp(-t * 10);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        return buf;
      };

      const blipUp = (at) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = "triangle";
        o.frequency.setValueAtTime(520, at);
        o.frequency.exponentialRampToValueAtTime(980, at + 0.18);

        f.type = "lowpass";
        f.frequency.setValueAtTime(2400, at);
        f.frequency.exponentialRampToValueAtTime(1600, at + 0.22);
        f.Q.setValueAtTime(0.7, at);

        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.34, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);

        o.connect(f);
        f.connect(g);
        g.connect(ctx.destination);
        o.start(at);
        o.stop(at + 0.25);

        // little sparkle
        const s = ctx.createOscillator();
        const sg = ctx.createGain();
        s.type = "sine";
        s.frequency.setValueAtTime(1400, at + 0.02);
        sg.gain.setValueAtTime(0.0001, at + 0.02);
        sg.gain.exponentialRampToValueAtTime(0.12, at + 0.04);
        sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.10);
        s.connect(sg);
        sg.connect(ctx.destination);
        s.start(at + 0.02);
        s.stop(at + 0.12);
      };

      const blipDown = (at) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(260, at);
        o.frequency.exponentialRampToValueAtTime(120, at + 0.20);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.30, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(at);
        o.stop(at + 0.24);

        // soft thump (noise)
        const n = ctx.createBufferSource();
        n.buffer = makeNoiseBuffer(0.10);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(260, at);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, at);
        ng.gain.exponentialRampToValueAtTime(0.26, at + 0.01);
        ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        n.connect(lp);
        lp.connect(ng);
        ng.connect(ctx.destination);
        n.start(at);
        n.stop(at + 0.12);
      };

      for (let i = 0; i < count; i++) {
        const at = t0 + i * 0.14;
        if (direction === "up") blipUp(at);
        else blipDown(at);
      }
    } catch {
      // ignore
    }
  }

  function playRankNeutralSfx() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = playSfx._ctx || (playSfx._ctx = new AudioCtx());
      if (ctx.state === "suspended") ctx.resume();

      const t0 = ctx.currentTime + 0.01;

      // Distinct neutral cue: short "click/tok" (band-passed noise + tiny low knock)
      const makeNoiseBuffer = (durSec) => {
        const len = Math.max(1, Math.floor(ctx.sampleRate * durSec));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const env = Math.exp(-t * 22);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        return buf;
      };

      const n = ctx.createBufferSource();
      n.buffer = makeNoiseBuffer(0.075);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(950, t0);
      bp.Q.setValueAtTime(7, t0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.70, t0 + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(ctx.destination);
      n.start(t0);
      n.stop(t0 + 0.12);

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(170, t0);
      o.frequency.exponentialRampToValueAtTime(120, t0 + 0.08);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.48, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.15);
    } catch {
      // ignore
    }
  }

  function playFinalRankingSfx() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = playSfx._ctx || (playSfx._ctx = new AudioCtx());
      if (ctx.state === "suspended") ctx.resume();

      const t0 = ctx.currentTime + 0.01;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      master.connect(ctx.destination);

      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      for (const f0 of notes) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f0, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + 0.50);
      }

      // small sparkle
      const s = ctx.createOscillator();
      const sg = ctx.createGain();
      s.type = "triangle";
      s.frequency.setValueAtTime(1400, t0 + 0.02);
      s.frequency.exponentialRampToValueAtTime(2200, t0 + 0.12);
      sg.gain.setValueAtTime(0.0001, t0 + 0.02);
      sg.gain.exponentialRampToValueAtTime(0.08, t0 + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.20);
      s.connect(sg);
      sg.connect(master);
      s.start(t0 + 0.02);
      s.stop(t0 + 0.22);
    } catch {
      // ignore
    }
  }

  function flashFinalRanking() {
    const el = $("#scoreboardList");
    if (!el) return;
    el.classList.remove("finalBlink");
    // Force reflow so the animation reliably re-triggers.
    void el.offsetWidth;
    el.classList.add("finalBlink");
    playFinalRankingSfx();
    if (flashFinalRanking._t) window.clearTimeout(flashFinalRanking._t);
    flashFinalRanking._t = window.setTimeout(() => {
      try { el.classList.remove("finalBlink"); } catch { /* ignore */ }
    }, 1800);
  }

  function captureRectsByTeam(containerEl) {
    const m = new Map();
    if (!containerEl) return m;
    containerEl.querySelectorAll("[data-team-id]").forEach((node) => {
      const id = node.getAttribute("data-team-id");
      if (id) m.set(id, node.getBoundingClientRect());
    });
    return m;
  }

  function finishListAnimations(containerEl) {
    if (!containerEl) return;
    try {
      containerEl.querySelectorAll("[data-team-id]").forEach((node) => {
        if (!node.getAnimations) return;
        for (const a of node.getAnimations()) {
          try { a.finish(); } catch { /* ignore */ }
        }
      });
    } catch {
      // ignore
    }
  }

  function flipAnimateTeamList(containerEl, oldRects, oldOrder, newOrder, opts = {}) {
    if (!containerEl) return;
    if (!oldRects || oldRects.size === 0) return;

    const oldIndex = new Map((oldOrder || []).map((id, i) => [id, i]));
    const newIndex = new Map((newOrder || []).map((id, i) => [id, i]));

    let maxMove = { id: null, steps: 0, dir: null };

    containerEl.querySelectorAll("[data-team-id]").forEach((node) => {
      const id = node.getAttribute("data-team-id");
      if (!id) return;
      const a = oldRects.get(id);
      if (!a) return;
      const b = node.getBoundingClientRect();
      const dy = a.top - b.top;
      if (!dy) return;

      const oi = oldIndex.get(id);
      const ni = newIndex.get(id);
      const steps = (oi === undefined || ni === undefined) ? 1 : Math.abs(oi - ni);
      const dir = (oi !== undefined && ni !== undefined && ni < oi) ? "up" : "down";
      if (steps > maxMove.steps) maxMove = { id, steps, dir };

      const s = Math.max(1, Math.min(8, steps));

      const mode = opts.mode === "smooth" ? "smooth" : "steps";
      const perStepMs = clampInt(opts.perStepMs ?? 420, 120, 2000, 420);
      const duration = perStepMs * s;
      // For a 1-step move, steps(1,end) looks like a teleport; force smooth.
      const useSmooth = mode === "smooth" || s <= 1;
      const easing = useSmooth ? "cubic-bezier(0.12, 0.88, 0.18, 1.0)" : `steps(${s}, end)`;

      // Make the movement feel like floating/sinking (scale + overshoot) and keep it above others.
      const overshoot = dy > 0 ? -10 : 10;
      node.classList.add("rankMoving");
      node.style.zIndex = "6";
      const anim = node.animate(
        [
          { transform: `translateY(${dy}px) scale(1.03)`, filter: "brightness(1.03)" },
          { offset: 0.82, transform: `translateY(${overshoot}px) scale(1.02)`, filter: "brightness(1.06)" },
          { transform: "translateY(0) scale(1)", filter: "brightness(1)" }
        ],
        { duration, easing }
      );
      anim.onfinish = () => {
        node.classList.remove("rankMoving");
        node.style.zIndex = "";
      };
    });

    if (opts.playSfx === false) return;
    if (maxMove.id && maxMove.steps > 0) {
      const now = Date.now();
      if (!flipAnimateTeamList._lastSfxAt || now - flipAnimateTeamList._lastSfxAt > 600) {
        flipAnimateTeamList._lastSfxAt = now;
        playRankMoveSfx(maxMove.dir, maxMove.steps);
      }
    }
  }

  // =========================

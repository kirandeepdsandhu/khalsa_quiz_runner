// NOTE: This file is auto-split from app.full.js for maintainability.
// Part: app.04_scoreboard_backup_boot.js

  // Scoreboards
  // =========================
  function renderLiveScore() {
    const el = $("#liveScore");
    const scoreBody = $("#quizScoreBody");
    const scoreCard = $(".quizScoreCard");
    if (!state.ui?.quizShowLiveScore) {
      if (scoreBody) scoreBody.classList.add("hidden");
      if (scoreCard) scoreCard.classList.add("collapsed");
      el.classList.add("hidden");
      el.innerHTML = "";
      renderLiveScore._order = [];
      return;
    }
    if (scoreBody) scoreBody.classList.remove("hidden");
    if (scoreCard) scoreCard.classList.remove("collapsed");
    el.classList.remove("hidden");
    const oldOrder = renderLiveScore._order || [];
    finishListAnimations(el);
    const oldRects = captureRectsByTeam(el);
    el.innerHTML = "";

    const currentTeamId = state.activeRound?.questionTeams?.[state.activeRound.idx] || null;

    const isHolding = Date.now() < rankHoldUntil;
    const sorted = [...state.teams].sort((a, b) => b.score - a.score);
    const teams = isHolding && Array.isArray(rankHoldLiveOrder)
      ? [
          ...rankHoldLiveOrder
            .map((id) => state.teams.find((t) => t.id === id))
            .filter(Boolean),
          ...sorted.filter((t) => !rankHoldLiveOrder.includes(t.id))
        ]
      : sorted;
    if (teams.length === 0) {
      el.innerHTML = `<div class="hint">No teams yet.</div>`;
      return;
    }

    for (const t of teams) {
      const row = document.createElement("div");
      row.className = "item";
      row.setAttribute("data-team-id", t.id);
      row.innerHTML = `<div class="name"><span class="teamPill small" style="--teamColor:${escapeHtml(t.color || "#6aa9ff")}">${escapeHtml(t.name)}</span></div><div class="score">${t.score}</div>`;

      const c = t.color || "#6aa9ff";
      row.style.background = hexToRgba(c, 0.10);
      row.style.borderColor = hexToRgba(c, 0.38);

      if (currentTeamId && t.id === currentTeamId) {
        row.style.borderColor = hexToRgba(c, 0.62);
        row.style.background = hexToRgba(c, 0.14);
      }
      el.appendChild(row);
    }

    const newOrder = teams.map((t) => t.id);
    if (!isHolding) flipAnimateTeamList(el, oldRects, oldOrder, newOrder);
    renderLiveScore._order = newOrder;
  }

  function renderScoreboards() {
    // Scoreboard freshness banner
    const staleBar = $("#scoreboardStaleBar");
    const staleText = $("#scoreboardStaleText");
    const btnRefresh = $("#btnScoreboardRefresh");
    const btnTest = $("#btnTestScoreAnim");

    const hasSequence = !!scoreboardSequence;
    const snapStatus = getScoreboardSnapshotStatus();
    const isRoundActive = snapStatus.isRoundActive;
    const snap = snapStatus.snap;
    const isOutdated = snapStatus.isOutdated;

    if (staleBar) staleBar.classList.remove("hidden");
    if (btnRefresh) {
      const enable = isRoundActive && isOutdated && !hasSequence;
      btnRefresh.disabled = !enable;
      btnRefresh.classList.toggle("primary", enable);
      btnRefresh.classList.toggle("warn", !enable);
    }
    if (btnTest) {
      btnTest.disabled = hasSequence;
    }
    if (staleText) {
      if (hasSequence) {
        staleText.textContent = scoreboardSequence?.roundId === "TEST"
          ? "Test animation running…"
          : "Round completed — revealing rankings…";
      } else if (!isRoundActive) {
        staleText.textContent = "No active round — scoreboard is live.";
      } else if (!snap || snap.roundId !== state.activeRound.roundId) {
        staleText.textContent = "Round in progress — scoreboard snapshot not captured yet. Press Update scoreboard.";
      } else if (!isOutdated) {
        const when = snap?.updatedAt ? new Date(snap.updatedAt).toLocaleTimeString() : "";
        staleText.textContent = `Scoreboard is up to date.${when ? ` Last updated: ${when}` : ""}`;
      } else {
        const when = snap?.updatedAt ? new Date(snap.updatedAt).toLocaleTimeString() : "";
        const changed = snapStatus.changedTeams;
        staleText.textContent = `Outdated — ${changed} team${changed === 1 ? "" : "s"} changed. Press Update scoreboard.${when ? ` Last updated: ${when}` : ""}`;
      }
    }

    // Teams
    const el = $("#scoreboardList");
    const oldOrder = renderScoreboards._order || [];
    finishListAnimations(el);
    const oldRects = captureRectsByTeam(el);
    el.innerHTML = "";

    const isHolding = Date.now() < rankHoldUntil;
    const hasReveal = !!scoreboardReveal;

    const sorted = [...state.teams].sort((a, b) => b.score - a.score);

    // During an active round, keep the Scoreboard tab frozen until manually refreshed.
    // This keeps suspense while still allowing the presenter to update on demand.
    const useSnapshot = !hasReveal && !hasSequence && isRoundActive && snap?.roundId && snap.roundId === state.activeRound?.roundId;

    let teams;
    if (hasReveal) {
      const order = scoreboardReveal.orderTeamIds || [];
      teams = [
        ...order.map((id) => state.teams.find((t) => t.id === id)).filter(Boolean),
        ...sorted.filter((t) => !order.includes(t.id))
      ];
    } else if (useSnapshot) {
      const order = snap.orderTeamIds || [];
      teams = [
        ...order.map((id) => state.teams.find((t) => t.id === id)).filter(Boolean),
        ...sorted.filter((t) => !order.includes(t.id))
      ];
    } else if (isHolding && Array.isArray(rankHoldBoardOrder)) {
      teams = [
        ...rankHoldBoardOrder.map((id) => state.teams.find((t) => t.id === id)).filter(Boolean),
        ...sorted.filter((t) => !rankHoldBoardOrder.includes(t.id))
      ];
    } else {
      if (hasSequence) {
        const order = scoreboardSequence.orderTeamIds || [];
        teams = [
          ...order.map((id) => state.teams.find((t) => t.id === id)).filter(Boolean),
          ...sorted.filter((t) => !order.includes(t.id))
        ];
      } else {
        teams = sorted;
      }
    }

    if (teams.length === 0) {
      el.innerHTML = `<div class="hint">No teams yet.</div>`;
    } else {
      teams.forEach((t, i) => {
        const isSeq = !!scoreboardSequence;
        const seqTeamId = scoreboardSequence?.currentTeamId || null;
        const seqPhase = scoreboardSequence?.phase || "idle";
        const seqDelta = isSeq ? (scoreboardSequence.deltasByTeamId?.[t.id] ?? 0) : 0;

        const snapScore = useSnapshot ? (snap.scoresByTeamId?.[t.id] ?? t.score) : t.score;
        const shownScore = isSeq
          ? (scoreboardSequence.scoresByTeamId?.[t.id] ?? t.score)
          : snapScore;

        const showDelta = isSeq && seqPhase === "delta" && t.id === seqTeamId && seqDelta !== 0;
        const sign = seqDelta > 0 ? "+" : "";

        const row = document.createElement("div");
        row.className = "item";
        row.setAttribute("data-team-id", t.id);

        const c = t.color || "#6aa9ff";
        row.style.background = hexToRgba(c, 0.10);
        row.style.borderColor = hexToRgba(c, 0.38);

        row.innerHTML = `
          <div>
            <div class="name">#${i + 1} — <span class="teamPill small" style="--teamColor:${escapeHtml(t.color || "#6aa9ff")}">${escapeHtml(t.name)}</span></div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; justify-content:flex-end">
            ${showDelta ? `<span class="scoreDelta ${seqDelta > 0 ? "up" : "down"} long">${escapeHtml(`${sign}${seqDelta}`)}</span>` : ""}
            <div class="score">${shownScore}</div>
          </div>
        `;
        el.appendChild(row);
      });
    }

    const newOrder = teams.map((t) => t.id);
    if (!isHolding && !hasReveal) {
      const opts = nextScoreboardFlipOpts || undefined;
      nextScoreboardFlipOpts = null;
      flipAnimateTeamList(el, oldRects, oldOrder, newOrder, opts);
    }
    renderScoreboards._order = newOrder;

    // Rounds
    const rl = $("#roundsList");
    rl.innerHTML = "";

    if (state.rounds.length === 0) {
      rl.innerHTML = `<div class="hint">No rounds yet.</div>`;
      return;
    }

    for (const r of state.rounds) {
      const topEntries = Object.entries(r.resultsByTeamId || {})
        .map(([tid, pts]) => ({ tid, pts }))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 3);

      const topHtml = topEntries
        .map((x, idx) => {
          const team = state.teams.find((t) => t.id === x.tid);
          const name = team ? team.name : x.tid.slice(0, 8);
          const color = team?.color || "#6aa9ff";
          const pts = Number(x.pts) || 0;
          const sign = pts > 0 ? "+" : "";
          const cls = pts > 0 ? "up" : (pts < 0 ? "down" : "zero");

          const pillBg = hexToRgba(color, 0.14);
          const pillBorder = hexToRgba(color, 0.32);
          const showPairPipe = idx < topEntries.length - 1;
          return `
            <span class="roundTopChip" style="--teamColor:${escapeHtml(color)}">
              <span class="teamPill small" style="background:${escapeHtml(pillBg)}; border:1px solid ${escapeHtml(pillBorder)}; color:var(--text)">${escapeHtml(name)}</span>
              <span class="roundDelta ${cls}">${escapeHtml(`${sign}${pts}`)}</span>
              ${showPairPipe ? `<span class="roundPairPipe" aria-hidden="true"></span>` : ""}
            </span>
          `.trim();
        })
        .join(" ");

      const isCleared = !!r.clearedAt;
      const isCompleted = !!r.completedAt;
      const statusText = isCleared ? "cleared" : (isCompleted ? "completed" : "in progress");
      const statusClass = isCleared ? "warn" : (isCompleted ? "good" : "warn");

      const row = document.createElement("div");
      row.className = "item";

      const typeLabel = (r.type === "quickfire") ? "Quick Fire" : (r.type === "offline" ? "Offline" : "Normal");
      row.innerHTML = `
        <div style="min-width:240px">
          <div class="name">${escapeHtml(r.name || `Round ${r.id.slice(0, 8)}`)}</div>
          <div class="muted small">${new Date(r.createdAt).toLocaleString()} • ${escapeHtml(typeLabel)} • Q: ${r.questionsCount} • Pts/correct: ${r.pointsPerCorrect}</div>
          ${topEntries.length ? `<div class="roundTopRow">${topHtml}</div>` : `<div class="muted small">No scores</div>`}
        </div>
        <div class="row" style="justify-content:flex-end">
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
      `;
      rl.appendChild(row);
    }
  }

  // =========================
  // Backup: export / import
  // =========================
  function exportState() {
    return {
      version: 1,
      exportedAt: nowISO(),
      state: {
        ...state,
        undoStack: []
      }
    };
  }

  function refreshStatePreview() {
    const ta = $("#statePreview");
    if (!ta) return;
    ta.value = JSON.stringify(exportState(), null, 2);
  }

  function refreshResetUI() {
    const sel = $("#resetRoundSelect");
    const btnRound = $("#btnResetRoundScores");
    if (!sel || !btnRound) return;

    const current = sel.value || "";
    sel.innerHTML = "";

    const rounds = [...state.rounds]
      .filter(Boolean)
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });

    if (rounds.length === 0) {
      sel.disabled = true;
      btnRound.disabled = true;
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No rounds";
      sel.appendChild(opt);
      return;
    }

    sel.disabled = false;
    for (const r of rounds) {
      const opt = document.createElement("option");
      opt.value = r.id;
      const name = r.name || `Round ${String(r.id || "").slice(0, 8)}`;
      const status = r.clearedAt ? "cleared" : (r.completedAt ? "completed" : "in progress");
      opt.textContent = `${name} — ${status}`;
      sel.appendChild(opt);
    }

    if (current && rounds.some((r) => r.id === current)) sel.value = current;
    btnRound.disabled = !sel.value;
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function doExport() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(`sikh-quiz-state_${stamp}.json`, exportState());
    toast("Exported.");
  }

  async function doCopyState() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportState(), null, 2));
      toast("Copied state JSON.");
    } catch {
      toast("Copy failed (browser blocked). Try export instead.");
    }
  }

  async function doImport() {
    const file = $("#importFile").files?.[0];
    if (!file) {
      toast("Choose a state JSON file first.");
      return;
    }
    if (!confirm("Import will overwrite current state. Continue?")) return;

    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      applyImportedState(obj);
      saveState();
      renderAll();
      toast("Imported. Reload question bank if needed.");
    } catch (err) {
      console.error(err);
      toast("Import failed (see DevTools console).");
    }
  }

  function applyImportedState(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Invalid import");
    const s = obj.state;
    if (!s) throw new Error("Invalid import: missing state");

    const d = defaultState();
    state = {
      ...d,
      ...s,
      settings: { ...d.settings, ...(s.settings || {}) },
      asked: s.asked || {},
      rounds: Array.isArray(s.rounds) ? s.rounds : [],
      teams: Array.isArray(s.teams) ? s.teams : [],
      activeRound: s.activeRound || null,
      undoStack: []
    };

    // Sync UI inputs
    $("#pointsPerCorrect").value = state.settings.pointsPerCorrect;
    $("#pointsPerWrong").value = state.settings.pointsPerWrong ?? 0;
    $("#questionsPerRound").value = state.settings.questionsPerTeam ?? 1;
    $("#questionTimeSec").value = state.settings.questionTimeSec ?? 30;
    $("#avoidRepeats").value = state.settings.avoidRepeats;
    if ($("#roundName")) $("#roundName").value = state.settings.roundName || "";
    if ($("#roundType")) $("#roundType").value = state.settings.roundType || "normal";
    if ($("#quickFireCount")) $("#quickFireCount").value = state.settings.quickFireCount ?? 5;
    if ($("#qfAllOrNone")) $("#qfAllOrNone").value = (state.settings.qfAllOrNone ? "yes" : "no");
    if ($("#offlinePrompt")) $("#offlinePrompt").value = state.settings.offlinePrompt || "";
    if ($("#allowSkip")) $("#allowSkip").value = (state.settings.allowSkip === false) ? "no" : "yes";
    if ($("#allowPass")) $("#allowPass").value = (state.settings.allowPass === false) ? "no" : "yes";
  }

  // =========================
  // Reset all
  // =========================
  function resetAll() {
    if (!confirm("Reset EVERYTHING? This cannot be undone.")) return;

    stopTimer();
    state = defaultState();
    bank = null;
    bankById = new Map();
    sectionsIndex = [];

    // Clear cached bank (best-effort).
    try {
      if (typeof clearBankCache === "function") clearBankCache();
    } catch {
      // ignore
    }

    localStorage.removeItem(STORAGE_KEY);

    // Reset UI
    $("#pointsPerCorrect").value = state.settings.pointsPerCorrect;
    $("#pointsPerWrong").value = state.settings.pointsPerWrong;
    $("#questionsPerRound").value = state.settings.questionsPerTeam;
    $("#questionTimeSec").value = state.settings.questionTimeSec;
    $("#avoidRepeats").value = state.settings.avoidRepeats;
    if ($("#roundName")) $("#roundName").value = state.settings.roundName;
    if ($("#roundType")) $("#roundType").value = state.settings.roundType;
    if ($("#quickFireCount")) $("#quickFireCount").value = state.settings.quickFireCount;
    if ($("#qfAllOrNone")) $("#qfAllOrNone").value = state.settings.qfAllOrNone ? "yes" : "no";
    if ($("#offlinePrompt")) $("#offlinePrompt").value = state.settings.offlinePrompt;
    if ($("#allowSkip")) $("#allowSkip").value = state.settings.allowSkip ? "yes" : "no";
    if ($("#allowPass")) $("#allowPass").value = state.settings.allowPass ? "yes" : "no";

    setBankStatus(false, "Question bank: not loaded");

    saveState();
    renderAll();
    toast("Reset done.");
  }

  // =========================
  // Timer
  // =========================
  function startTimerForCurrentQuestion(forceRestart = false) {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    const idx = state.activeRound.idx;
    const qid = state.activeRound.questions[idx];

    let unitKey = qid;
    let unitAnswered = false;

    if (r.type === "quickfire") {
      const set = state.activeRound.quickFireSets?.[idx];
      const itemIdx = set ? set.items.findIndex((it) => !it.locked) : -1;
      unitKey = `${qid}::${itemIdx}`;
      unitAnswered = itemIdx < 0 || !!state.activeRound.answered?.[qid];
    } else {
      unitAnswered = !!state.activeRound.answered[qid];
    }

    if (unitAnswered) {
      stopTimer();
      renderTimerUI();
      return;
    }

    if (state.activeRound.timerUnitKey !== unitKey) {
      state.activeRound.timerUnitKey = unitKey;
      state.activeRound.timerEndsAt = null;
      forceRestart = true;
    }

    if (state.activeRound.timerEndsAt && !forceRestart) {
      // timer already running
    } else {
      const durationSec = r.questionTimeSec ?? state.settings.questionTimeSec;
      state.activeRound.timerEndsAt = Date.now() + durationSec * 1000;
      saveState();
    }

    if (timerIntervalId) return;
    timerIntervalId = window.setInterval(() => {
      tickTimer();
    }, 200);
  }

  function stopTimer() {
    if (timerIntervalId) {
      window.clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function tickTimer() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) {
      stopTimer();
      return;
    }

    const idx = state.activeRound.idx;
    const qid = state.activeRound.questions[idx];

    if (r.type === "quickfire") {
      const set = state.activeRound.quickFireSets?.[idx];
      const itemIdx = set ? set.items.findIndex((it) => !it.locked) : -1;
      if (itemIdx < 0 || !!state.activeRound.answered?.[qid]) {
        stopTimer();
        renderTimerUI();
        return;
      }
    } else {
      if (state.activeRound.answered[qid]) {
        stopTimer();
        renderTimerUI();
        return;
      }
    }

    const endsAt = state.activeRound.timerEndsAt;
    if (!endsAt) {
      startTimerForCurrentQuestion(true);
      return;
    }

    const remainingMs = endsAt - Date.now();
    if (remainingMs <= 0) {
      timeoutAutoLock();
      return;
    }

    renderTimerUI();
  }

  function renderTimerUI() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    const endsAt = state.activeRound.timerEndsAt;
    const durationSec = r.questionTimeSec ?? state.settings.questionTimeSec;
    const remainingSec = endsAt ? Math.ceil((endsAt - Date.now()) / 1000) : durationSec;

    const textEl = $("#timerText");
    const fillEl = $("#timerFill");
    if (!textEl || !fillEl) return;

    const timerEl = textEl.closest(".timer");
    if (timerEl) {
      const shouldBlink = remainingSec > 0 && remainingSec <= 5 && (state.activeRound.stage || "shown") === "shown";
      timerEl.classList.toggle("blink", shouldBlink);

      // Beep once per second during the last 5 seconds (only while question is running)
      if (shouldBlink) {
        if (lastTickBeepSec !== remainingSec) {
          lastTickBeepSec = remainingSec;
          playTickBeep();
        }
      } else {
        lastTickBeepSec = null;
      }
    }

    textEl.textContent = formatTimeMMSS(remainingSec);

    const pct = Math.max(0, Math.min(1, remainingSec / Math.max(1, durationSec)));
    fillEl.style.transform = `scaleX(${pct})`;
    fillEl.classList.toggle("warn", pct < 0.25);
  }

  // =========================
  // Render all
  // =========================
  function renderAll() {
    renderTeams();
    renderRoundPresets();
    renderSections();
    renderRoundMeta();
    renderQuiz();
    renderLiveScore();
    const btnToggleLiveScore = $("#btnToggleLiveScore");
    if (btnToggleLiveScore) {
      btnToggleLiveScore.textContent = state.ui?.quizShowLiveScore ? "Hide scoreboard" : "Show scoreboard";
    }
    const btnToggleRibbon = $("#btnToggleRibbon");
    document.body.classList.toggle("ribbonHidden", !!state.ui?.ribbonHidden);
    if (btnToggleRibbon) {
      btnToggleRibbon.textContent = state.ui?.ribbonHidden ? "Show top" : "Hide top";
    }
    renderScoreboards();
    refreshStatePreview();
    refreshResetUI();
  }

  // =========================
  // Init
  // =========================
  function bindEvents() {
    const btnToggleRibbon = $("#btnToggleRibbon");
    if (btnToggleRibbon) {
      btnToggleRibbon.addEventListener("click", () => {
        state.ui = state.ui || {};
        state.ui.ribbonHidden = !state.ui.ribbonHidden;
        saveState();
        renderAll();
      });
    }

    const btnQuickQuiz = $("#btnQuickQuiz");
    if (btnQuickQuiz) {
      btnQuickQuiz.addEventListener("click", () => {
        selectTab("quiz");
      });
    }

    const btnQuickScoreboard = $("#btnQuickScoreboard");
    if (btnQuickScoreboard) {
      btnQuickScoreboard.addEventListener("click", () => {
        selectTab("scoreboard");
      });
    }

    const btnGoQuiz = $("#btnGoQuiz");
    if (btnGoQuiz) {
      btnGoQuiz.addEventListener("click", () => {
        selectTab("quiz");
      });
    }

        const btnToggleLiveScore = $("#btnToggleLiveScore");
        if (btnToggleLiveScore) {
          const refreshLabel = () => {
            btnToggleLiveScore.textContent = state.ui?.quizShowLiveScore ? "Hide scoreboard" : "Show scoreboard";
          };
          refreshLabel();
          btnToggleLiveScore.addEventListener("click", () => {
            state.ui = state.ui || {};
            state.ui.quizShowLiveScore = !state.ui.quizShowLiveScore;
            saveState();
            refreshLabel();
        renderLiveScore();
          });
        }
    $("#btnLoadBank").addEventListener("click", loadBankFromPicker);
        document.querySelectorAll(".defaultBankOption").forEach((btn) => {
          btn.addEventListener("click", () => {
            const url = btn.dataset.url || "";
            const menu = btn.closest && btn.closest("details.defaultBankMenu");
            if (menu) menu.open = false;
            loadBankFromDefault(url);
          });
        });

    $("#btnAddTeam").addEventListener("click", addTeam);
    $("#teamName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTeam();
    });
    $("#btnResetTeams").addEventListener("click", resetTeams);

    const btnStartRound = $("#btnStartRound");
    if (btnStartRound) btnStartRound.addEventListener("click", startRound);
    const btnSavePreset = $("#btnSaveRoundPreset");
    if (btnSavePreset) btnSavePreset.addEventListener("click", saveCurrentRoundPreset);
    // no repeats enforced

    const btnStartNextRound = $("#btnStartNextRound");
    if (btnStartNextRound) {
      btnStartNextRound.addEventListener("click", () => {
        if (!Array.isArray(state.teams) || state.teams.length < 1) {
          toast("Add at least 1 team.");
          selectTab("setup");
          return;
        }
        const p = getNextPresetToStart();
        if (!p) {
          toast("No next round found.");
          return;
        }
        if (p.type !== "offline" && !bank) {
          toast("Load the question bank first.");
          selectTab("setup");
          return;
        }
        if (p.type !== "offline" && (!Array.isArray(p.sections) || p.sections.length === 0)) {
          toast("That saved round has no sections. Select sections and save it again.");
          selectTab("setup");
          return;
        }
        applyPresetToSettings(p);
        saveState();
        renderSections();
        startRound({ presetId: p.id });
      });
    }

    $("#btnReveal").addEventListener("click", revealNowNoScore);
    $("#btnNext").addEventListener("click", advanceQuestion);
    $("#btnSkip").addEventListener("click", skipQuestion);
    const btnPass = $("#btnPass");
    if (btnPass) btnPass.addEventListener("click", passQuestion);
    $("#btnLock").addEventListener("click", lockAnswer);

    // Undo is now in the quiz action row
    $("#btnUndo").addEventListener("click", undoLast);
    $("#btnEndRound").addEventListener("click", endRound);

    const btnScoreboardRefresh = $("#btnScoreboardRefresh");
    if (btnScoreboardRefresh) {
      btnScoreboardRefresh.addEventListener("click", () => {
        const roundId = state.activeRound?.roundId || null;
        if (!roundId) {
          selectTab("scoreboard");
          toast("No active round — scoreboard is live.");
          return;
        }

        const status = getScoreboardSnapshotStatus();
        if (!status.isOutdated && status.snap && status.snap.roundId === roundId) {
          selectTab("scoreboard");
          toast("Scoreboard is already up to date.");
          return;
        }

        setScoreboardSnapshotFromCurrent(roundId);
        saveState();
        nextScoreboardFlipOpts = { mode: "smooth", perStepMs: 850 };
        selectTab("scoreboard");
        flashFinalRanking();
        toast("Scoreboard updated.");
      });
    }

    const btnTestScoreAnim = $("#btnTestScoreAnim");
    if (btnTestScoreAnim) {
      btnTestScoreAnim.addEventListener("click", startTestScoreboardSequence);
    }

    $("#btnCopyQ").addEventListener("click", copyQuestion);

    const btnShow = $("#btnShow");
    if (btnShow) {
      btnShow.addEventListener("click", () => {
        const r = getActiveRoundRecord();
        if (!state.activeRound || !r) return;

        if ((state.activeRound.stage || "shown") === "shown") return;
        state.activeRound.stage = "shown";
        state.activeRound.timerEndsAt = null;
        state.activeRound.timerUnitKey = null;

        saveState();
        renderQuiz();
      });
    }

    $("#btnExport").addEventListener("click", doExport);
    $("#btnCopyState").addEventListener("click", doCopyState);
    $("#btnImport").addEventListener("click", doImport);

    const resetRoundSelect = $("#resetRoundSelect");
    if (resetRoundSelect) {
      resetRoundSelect.addEventListener("change", () => {
        refreshResetUI();
      });
    }

    const btnResetRoundScores = $("#btnResetRoundScores");
    if (btnResetRoundScores) {
      btnResetRoundScores.addEventListener("click", () => {
        const rid = $("#resetRoundSelect")?.value || "";
        if (!rid) {
          toast("Select a round first.");
          return;
        }
        clearRoundScores(rid);
      });
    }

    const btnResetQuizScores = $("#btnResetQuizScores");
    if (btnResetQuizScores) {
      btnResetQuizScores.addEventListener("click", clearAllRoundScores);
    }

    const btnResetAskedHistory = $("#btnResetAskedHistory");
    if (btnResetAskedHistory) {
      btnResetAskedHistory.addEventListener("click", clearAsked);
    }

    const btnResetAllBackup = $("#btnResetAllBackup");
    if (btnResetAllBackup) {
      btnResetAllBackup.addEventListener("click", resetAll);
    }

    const btnResetAll = $("#btnResetAll");
    if (btnResetAll) btnResetAll.addEventListener("click", resetAll);
  }

  async function boot() {
    initTabs();
    initSettingsBindings();
    bindEvents();

    ensureTeamColors();

    // Initial status: attempt to restore cached bank first.
    let restored = false;
    try {
      if (typeof maybeRestoreBankFromCache === "function") {
        restored = await maybeRestoreBankFromCache();
      }
    } catch {
      restored = false;
    }
    if (!restored) setBankStatus(false, "Question bank: not loaded");

    saveState();
    renderAll();
  }

  // Start
  boot();

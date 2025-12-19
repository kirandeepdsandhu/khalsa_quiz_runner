// NOTE: This file is auto-split from app.full.js for maintainability.
// Part: app.03_quiz.js

  // Quiz rendering + scoring
  // =========================
  function setQuizRoundHeader(title, sub) {
    const titleEl = $("#quizRoundTitle");
    const subEl = $("#quizRoundSub");
    if (titleEl) titleEl.textContent = title || "";
    if (subEl) subEl.textContent = sub || "";
  }

  function renderQuiz() {
    const empty = $("#quizEmpty");
    const box = $("#quizBox");

    const nextBox = $("#quizNextRoundBox");
    const nextLabel = $("#quizNextRoundLabel");
    const nextBtn = $("#btnStartNextRound");

    const preShow = $("#preShow");
    const preTeamEl = $("#preTeam");
    const questionContent = $("#questionContent");

    if (!state.activeRound) {
      setQuizRoundHeader("", "");
      const selectedInfoEl = $("#selectedInfo");
      if (selectedInfoEl) {
        selectedInfoEl.classList.remove("show");
        selectedInfoEl.innerHTML = "";
      }
      // Ensure we don't leak the previous state's "Reload bank" message.
      if (empty) empty.textContent = "No round in progress.";
      empty.classList.remove("hidden");
      box.classList.add("hidden");

      if (nextBox && nextLabel && nextBtn) {
        // Always show the box (even if disabled) so users know what to do next.
        nextBox.classList.remove("hidden");

        const p = getNextPresetToStart();
        const hasPresets = Array.isArray(state.roundPresets) && state.roundPresets.length > 0;
        if (!p) {
          nextLabel.textContent = hasPresets
            ? "No next round (all saved rounds completed). Start one from Setup → Round Sequence, or clear rounds in Backup/Reset."
            : "No saved rounds yet. Save a round in Setup → Round Sequence.";
          nextBtn.disabled = true;
        } else {
          const needsBank = p.type !== "offline";
          const missingBank = needsBank && !bank;
          const missingSections = needsBank && (!Array.isArray(p.sections) || p.sections.length === 0);
          const missingTeams = !Array.isArray(state.teams) || state.teams.length < 1;
          const blocked = missingTeams || missingBank || missingSections;
          const reason = missingTeams
            ? " (add at least 1 team in Setup)"
            : (missingBank
              ? " (load question bank in Setup)"
              : (missingSections ? " (no sections selected — re-save this round in Setup)" : ""));
          nextLabel.textContent = `Next: ${p.name || "(unnamed round)"}${reason}`;
          nextBtn.disabled = blocked;
        }
      }

      if (preShow) preShow.classList.add("hidden");
      if (questionContent) questionContent.classList.remove("hidden");

      // Reset mode-specific UI so the next round starts cleanly.
      const optsEl = $("#qOptions");
      if (optsEl) optsEl.classList.remove("qfList");
      const answerBox = $("#qAnswer");
      if (answerBox) answerBox.style.display = "none";
      if (box) box.classList.remove("revealed");

      const btnLock = $("#btnLock");
      const btnSkip = $("#btnSkip");
      const btnPass = $("#btnPass");
      const btnReveal = $("#btnReveal");
      const btnNext = $("#btnNext");
      if (btnLock) {
        btnLock.style.display = "";
        btnLock.disabled = true;
      }
      if (btnSkip) btnSkip.style.display = "none";
      if (btnPass) btnPass.style.display = "none";
      if (btnReveal) btnReveal.style.display = "none";
      if (btnNext) btnNext.disabled = true;
      return;
    }

    if (nextBox) nextBox.classList.add("hidden");

    const r = getActiveRoundRecord();
    if (!r) {
      setQuizRoundHeader("", "");
      const selectedInfoEl = $("#selectedInfo");
      if (selectedInfoEl) {
        selectedInfoEl.classList.remove("show");
        selectedInfoEl.innerHTML = "";
      }
      empty.classList.remove("hidden");
      empty.textContent = "Active round record missing. (Try resetting state.)";
      box.classList.add("hidden");
      return;
    }

    if (r.type === "offline") {
      renderOffline(r);
      return;
    }

    if (!bank) {
      setQuizRoundHeader(r.name || "Round", "Reload the question bank in Setup to display questions.");
      const selectedInfoEl = $("#selectedInfo");
      if (selectedInfoEl) {
        selectedInfoEl.classList.remove("show");
        selectedInfoEl.innerHTML = "";
      }
      empty.classList.remove("hidden");
      empty.textContent = "Reload the question bank in Setup to display questions.";
      box.classList.add("hidden");
      return;
    }

    if (r.type === "quickfire") {
      renderQuickFire(r);
      return;
    }

    const infoEl = $("#quizRoundInfo");
    if (infoEl) infoEl.textContent = "";

    {
      const typeLabel = r.type === "quickfire" ? "Quick Fire" : (r.type === "offline" ? "Offline" : "Normal");
      const timerSec = r.questionTimeSec ?? state.settings.questionTimeSec;
      setQuizRoundHeader(r.name || "Round", `${typeLabel} • Correct +${r.pointsPerCorrect} • Wrong ${r.pointsPerWrong ?? 0} • Timer ${timerSec}s`);
    }

    const idx = state.activeRound.idx;
    const qid = state.activeRound.questions[idx];
    const entry = bankById.get(qid);

    if (!entry) {
      empty.classList.remove("hidden");
      empty.textContent = "Question not found in loaded bank. Reload the same bank used for this round.";
      box.classList.add("hidden");
      return;
    }

    empty.classList.add("hidden");
    box.classList.remove("hidden");

    const { sectionTitleEn, sectionTitlePa, q } = entry;

    const teamId = state.activeRound.questionTeams?.[idx] || null;
    const team = teamId ? getTeamById(teamId) : null;

    const stage = state.activeRound.stage || "shown";
    if (preTeamEl) {
      preTeamEl.textContent = team?.name || "";
      preTeamEl.style.setProperty("--teamColor", team?.color || "#6aa9ff");
    }
    if (preShow && questionContent) {
      const isReady = stage === "ready";
      preShow.classList.toggle("hidden", !isReady);
      questionContent.classList.toggle("hidden", isReady);
      if (isReady) stopTimer();
    }

    const teamEl = $("#turnTeam");
    if (teamEl) {
      const color = team?.color || "#6aa9ff";
      teamEl.style.setProperty("--teamColor", color);
      teamEl.textContent = team?.name || "(unknown team)";
    }

    const qMetaEl = $("#qMeta");
    qMetaEl.innerHTML = `
      <span class="lang pa small">${escapeHtml(sectionTitlePa)} • Q#${escapeHtml(q.number)}</span>
      <span class="lang en small">${escapeHtml(sectionTitleEn)} • Q#${escapeHtml(q.number)}</span>
    `;
    $("#qIndexBadge").textContent = `Q ${idx + 1}/${state.activeRound.questions.length}`;

    const qq = normalizeBilingual(q.question);
    $("#qText").innerHTML = `
      <span class="lang pa">${escapeHtml(qq.pa)}</span>
      <span class="lang en">${escapeHtml(qq.en)}</span>
    `;

    // Strong current-team color highlight: tint the question box + turn bar
    const quizBox = $("#quizBox");
    if (quizBox) {
      const c = team?.color || "#2b6cff";
      quizBox.style.borderColor = hexToRgba(c, 0.55);
      quizBox.style.boxShadow = `0 10px 26px ${hexToRgba(c, 0.14)}`;
    }
    const turnBar = $("#turnBar");
    if (turnBar) {
      const c = team?.color || "#2b6cff";
      turnBar.style.borderColor = hexToRgba(c, 0.35);
      turnBar.style.background = hexToRgba(c, 0.08);
    }

    const optsEl = $("#qOptions");
    // Coming from Quick Fire, remove its layout styling.
    optsEl.classList.remove("qfList");
    optsEl.innerHTML = "";

    const opts = q.options || {};
    const keys = ["a", "b", "c", "d", "e", "f"].filter((k) => opts[k] !== undefined);
    const correctKey = safeText(q.correct_option).toLowerCase();

    const answered = state.activeRound.answered?.[qid] || null;
    const locked = !!answered;
    const selectedKey = locked ? answered.selectedKey : state.activeRound.selectedKey;

    const selectedInfoEl = $("#selectedInfo");
    if (selectedInfoEl) {
      if (selectedKey) {
        const labelEn = locked ? "Submitted" : "Selected";
        const labelPa = locked ? "ਚੁਣਿਆ (ਜਮ੍ਹਾਂ)" : "ਚੁਣਿਆ";
        const ovSel = (opts && opts[selectedKey] !== undefined) ? normalizeBilingual(opts[selectedKey]) : { en: "", pa: "" };
        selectedInfoEl.classList.remove("good", "bad", "neutral");
        if (locked) {
          const outcome = answered?.outcome || (selectedKey === correctKey ? "correct" : "wrong");
          selectedInfoEl.classList.add(outcome === "correct" ? "good" : "bad");
        } else {
          selectedInfoEl.classList.add("neutral");
        }
        selectedInfoEl.classList.add("show");
        selectedInfoEl.innerHTML = `
          <span class="lang pa small">${escapeHtml(labelPa)}: ${escapeHtml(selectedKey.toUpperCase())}${ovSel.pa ? ` — ${escapeHtml(ovSel.pa)}` : ""}</span>
          <span class="lang en small">${escapeHtml(labelEn)}: ${escapeHtml(selectedKey.toUpperCase())}${ovSel.en ? ` — ${escapeHtml(ovSel.en)}` : ""}</span>
        `;
      } else {
        selectedInfoEl.classList.remove("good", "bad", "neutral");
        selectedInfoEl.classList.remove("show");
        selectedInfoEl.innerHTML = "";
      }
    }

    if (keys.length === 0) {
      const div = document.createElement("div");
      div.className = "hint";
      div.textContent = "No options found for this question.";
      optsEl.appendChild(div);
    } else {
      for (const k of keys) {
        const wrap = document.createElement("div");
        wrap.className = "opt";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "optBtn";
        btn.dataset.key = k;

        const ov = normalizeBilingual(opts[k]);
        btn.innerHTML = `
          <div class="optKey">${k}</div>
          <div>
            <span class="lang pa small">${escapeHtml(ov.pa)}</span>
            <span class="lang en small">${escapeHtml(ov.en)}</span>
          </div>
        `;

        if (selectedKey === k) btn.classList.add("selected");
        if (locked) {
          btn.classList.add("locked");
          btn.disabled = true;
          if (k === correctKey) btn.classList.add("correct");
          else if (selectedKey === k && selectedKey !== correctKey) btn.classList.add("wrong");
        } else {
          btn.addEventListener("click", () => {
            state.activeRound.selectedKey = k;
            saveState();
            renderQuiz();
          });
        }

        wrap.appendChild(btn);
        optsEl.appendChild(wrap);
      }
    }

    const answerBox = $("#qAnswer");
    const show = !!state.activeRound.revealed;

    const ans = normalizeBilingual(q.answer_text);
    const exp = normalizeBilingual(q.explanation);
    const corrOpt = (opts && correctKey && opts[correctKey]) ? normalizeBilingual(opts[correctKey]) : ans;

    $("#aLine").innerHTML = `
      <span class="lang pa small">ਸਹੀ: ${escapeHtml(correctKey ? correctKey.toUpperCase() : "?")} — ${escapeHtml(corrOpt.pa || ans.pa || "")}</span>
      <span class="lang en small">Correct: ${escapeHtml(correctKey ? correctKey.toUpperCase() : "?")} — ${escapeHtml(corrOpt.en || ans.en || "")}</span>
    `;

    $("#aExp").innerHTML = `
      ${exp.pa ? `<span class="lang pa small">${escapeHtml(exp.pa)}</span>` : ""}
      ${exp.en ? `<span class="lang en small">${escapeHtml(exp.en)}</span>` : ""}
    `;

    // reveal state + animations
    box.classList.toggle("revealed", show);
    if (answerBox) answerBox.style.display = show ? "block" : "none";

    renderLiveScore();

    // Controls
    const btnLock = $("#btnLock");
    const btnSkip = $("#btnSkip");
    const btnPass = $("#btnPass");
    const btnReveal = $("#btnReveal");
    const btnNext = $("#btnNext");

    // If coming back from Quick Fire, restore controls.
    const allowSkip = r.allowSkip !== false;
    const allowPass = r.allowPass !== false;

    if (btnSkip) btnSkip.style.display = allowSkip ? "" : "none";
    if (btnPass) btnPass.style.display = allowPass ? "" : "none";
    if (btnReveal) btnReveal.style.display = allowSkip ? "" : "none";
    if (btnLock) {
      btnLock.textContent = "Submit";
      // Quick Fire hides Submit; Normal must always show it.
      btnLock.style.display = "";
    }

    if (btnLock) btnLock.disabled = locked || !state.activeRound.selectedKey;
    if (btnSkip) btnSkip.disabled = locked || !allowSkip;
    if (btnPass) btnPass.disabled = locked || !allowPass;
    if (btnReveal) btnReveal.disabled = locked || !allowSkip;
    if (btnNext) btnNext.disabled = !locked;

    renderPointsToast(answered);
    renderTimerUI();

    if (locked || (state.activeRound.stage || "shown") !== "shown") stopTimer();
    else startTimerForCurrentQuestion();
  }

  function renderOffline(r) {
    const empty = $("#quizEmpty");
    const box = $("#quizBox");
    if (!state.activeRound) return;

    const infoEl = $("#quizRoundInfo");
    if (infoEl) infoEl.textContent = "";

    empty.classList.add("hidden");
    box.classList.remove("hidden");

    const timerSec = r.questionTimeSec ?? state.settings.questionTimeSec;
    setQuizRoundHeader(r.name || "Round", `Offline • Correct +${r.pointsPerCorrect} • Wrong ${r.pointsPerWrong ?? 0} • Timer ${timerSec}s`);

    const idx = state.activeRound.idx;
    const teamId = state.activeRound.questionTeams?.[idx] || state.activeRound.questions?.[idx] || null;
    const team = teamId ? getTeamById(teamId) : null;

    const stage = state.activeRound.stage || "shown";
    const preShow = $("#preShow");
    const preTeamEl = $("#preTeam");
    const questionContent = $("#questionContent");
    if (preTeamEl) {
      preTeamEl.textContent = team?.name || "";
      preTeamEl.style.setProperty("--teamColor", team?.color || "#6aa9ff");
    }
    if (preShow && questionContent) {
      const isReady = stage === "ready";
      preShow.classList.toggle("hidden", !isReady);
      questionContent.classList.toggle("hidden", isReady);
      if (isReady) stopTimer();
    }

    const teamEl = $("#turnTeam");
    if (teamEl) {
      const color = team?.color || "#6aa9ff";
      teamEl.style.setProperty("--teamColor", color);
      teamEl.textContent = team?.name || "(unknown team)";
    }

    const quizBox = $("#quizBox");
    if (quizBox) {
      const c = team?.color || "#2b6cff";
      quizBox.style.borderColor = hexToRgba(c, 0.55);
      quizBox.style.boxShadow = `0 10px 26px ${hexToRgba(c, 0.14)}`;
    }
    const turnBar = $("#turnBar");
    if (turnBar) {
      const c = team?.color || "#2b6cff";
      turnBar.style.borderColor = hexToRgba(c, 0.35);
      turnBar.style.background = hexToRgba(c, 0.08);
    }

    $("#qIndexBadge").textContent = `Team ${idx + 1}/${state.activeRound.questions.length}`;
    const qMetaEl = $("#qMeta");
    qMetaEl.innerHTML = `
      <span class="lang pa small">ਆਫਲਾਈਨ • ${escapeHtml(r.name || "Round")}</span>
      <span class="lang en small">Offline • ${escapeHtml(r.name || "Round")}</span>
    `;

    const prompt = safeText(r.offlinePrompt || state.settings.offlinePrompt || "").trim();
    $("#qText").innerHTML = `
      <span class="lang pa" style="white-space:pre-wrap">${escapeHtml(prompt)}</span>
      <span class="lang en" style="white-space:pre-wrap">${escapeHtml(prompt)}</span>
    `;

    const qid = state.activeRound.questions[idx];
    const answered = state.activeRound.answered?.[qid] || null;
    const locked = !!answered;
    const selectedKey = locked ? answered.selectedKey : state.activeRound.selectedKey;

    const selectedInfoEl = $("#selectedInfo");
    if (selectedInfoEl) {
      selectedInfoEl.classList.remove("good", "bad", "neutral", "show");
      selectedInfoEl.innerHTML = "";
    }

    const optsEl = $("#qOptions");
    optsEl.classList.remove("qfList");
    optsEl.innerHTML = "";

    const options = [
      { key: "correct", badge: "✓", labelEn: `Correct (+${r.pointsPerCorrect})`, labelPa: `ਸਹੀ (+${r.pointsPerCorrect})` },
      { key: "wrong", badge: "✗", labelEn: `Wrong (${r.pointsPerWrong ?? 0})`, labelPa: `ਗਲਤ (${r.pointsPerWrong ?? 0})` },
      { key: "skip", badge: "—", labelEn: "Skip (0)", labelPa: "ਛੱਡੋ (0)" },
    ];

    for (const o of options) {
      const wrap = document.createElement("div");
      wrap.className = "opt";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "optBtn";
      btn.dataset.key = o.key;
      btn.innerHTML = `
        <div class="optKey">${escapeHtml(o.badge)}</div>
        <div>
          <span class="lang pa small">${escapeHtml(o.labelPa)}</span>
          <span class="lang en small">${escapeHtml(o.labelEn)}</span>
        </div>
      `;

      if (selectedKey === o.key) btn.classList.add("selected");
      if (locked) {
        btn.classList.add("locked");
        btn.disabled = true;
        if (selectedKey === "correct") btn.classList.add("correct");
        else if (selectedKey === "wrong") btn.classList.add("wrong");
        else if (selectedKey === "skip") btn.classList.add("neutral");
      } else {
        btn.addEventListener("click", () => {
          state.activeRound.selectedKey = o.key;
          saveState();
          renderQuiz();
        });
      }

      wrap.appendChild(btn);
      optsEl.appendChild(wrap);
    }

    // Offline doesn't use answer panel.
    const answerBox = $("#qAnswer");
    box.classList.remove("revealed");
    if (answerBox) answerBox.style.display = "none";

    // Controls: submit/next only.
    const btnLock = $("#btnLock");
    const btnSkip = $("#btnSkip");
    const btnPass = $("#btnPass");
    const btnReveal = $("#btnReveal");
    const btnNext = $("#btnNext");

    btnSkip.style.display = "none";
    if (btnPass) btnPass.style.display = "none";
    btnReveal.style.display = "none";

    btnLock.textContent = "Submit";
    btnLock.style.display = "";
    btnLock.disabled = locked || !state.activeRound.selectedKey;
    btnNext.disabled = !locked;

    renderPointsToast(answered);
    renderTimerUI();
    if (locked || (state.activeRound.stage || "shown") !== "shown") stopTimer();
    else startTimerForCurrentQuestion();
    renderLiveScore();
  }

  function renderQuickFire(r) {
    const empty = $("#quizEmpty");
    const box = $("#quizBox");
    if (!state.activeRound) return;

    const selectedInfoEl = $("#selectedInfo");
    if (selectedInfoEl) {
      selectedInfoEl.classList.remove("show");
      selectedInfoEl.innerHTML = "";
    }

    const idx = state.activeRound.idx;
    const setId = state.activeRound.questions[idx];
    const set = state.activeRound.quickFireSets?.[idx];
    if (!set) {
      empty.classList.remove("hidden");
      empty.textContent = "Quick Fire set missing. Try restarting the round.";
      box.classList.add("hidden");
      return;
    }

    empty.classList.add("hidden");
    box.classList.remove("hidden");

    const infoEl = $("#quizRoundInfo");
    if (infoEl) infoEl.textContent = "";

    {
      const timerSec = r.questionTimeSec ?? 5;
      setQuizRoundHeader(
        r.name || "Round",
        `Quick Fire • Correct +${r.pointsPerCorrect} • Wrong ${r.pointsPerWrong ?? 0} • ${r.quickFireCount || set.perSet} per turn • ${timerSec}s each`
      );
    }

    const teamId = state.activeRound.questionTeams?.[idx] || null;
    const team = teamId ? getTeamById(teamId) : null;
    const color = team?.color || "#2b6cff";

    const stage = state.activeRound.stage || "shown";
    const preShow = $("#preShow");
    const preTeamEl = $("#preTeam");
    const questionContent = $("#questionContent");
    if (preTeamEl) preTeamEl.textContent = team?.name || "";
    if (preTeamEl) preTeamEl.style.setProperty("--teamColor", color);
    if (preShow && questionContent) {
      const isReady = stage === "ready";
      preShow.classList.toggle("hidden", !isReady);
      questionContent.classList.toggle("hidden", isReady);
      if (isReady) {
        stopTimer();
      }
    }

    const teamEl = $("#turnTeam");
    if (teamEl) {
      teamEl.style.setProperty("--teamColor", color);
      teamEl.textContent = team?.name || "(unknown team)";
    }

    const quizBox = $("#quizBox");
    if (quizBox) {
      quizBox.style.borderColor = hexToRgba(color, 0.55);
      quizBox.style.boxShadow = `0 10px 26px ${hexToRgba(color, 0.14)}`;
    }
    const turnBar = $("#turnBar");
    if (turnBar) {
      turnBar.style.borderColor = hexToRgba(color, 0.35);
      turnBar.style.background = hexToRgba(color, 0.08);
    }

    $("#qIndexBadge").textContent = `Turn ${idx + 1}/${state.activeRound.questions.length}`;
    const qMetaEl = $("#qMeta");
    qMetaEl.innerHTML = `
      <span class="lang pa small">ਕੁਇੱਕ ਫਾਇਰ • ${escapeHtml(r.name || "Round")} • ${escapeHtml(String(set.perSet))} ਹਾਂ/ਨਾ ਸਵਾਲ</span>
      <span class="lang en small">Quick Fire • ${escapeHtml(r.name || "Round")} • ${escapeHtml(String(set.perSet))} yes/no questions</span>
    `;

    const answeredSet = state.activeRound.answered?.[setId] || null;
    const setDone = !!answeredSet;

    let currentItemIdx = set.items.findIndex((it) => !it.locked);
    if (currentItemIdx < 0) currentItemIdx = set.items.length - 1;
    const revealCount = setDone ? set.items.length : Math.min(set.items.length, currentItemIdx + 1);

    const timerSec = r.questionTimeSec ?? 5;
    $("#qText").innerHTML = `
      <span class="lang pa">ਤੇਜ਼ੀ ਨਾਲ ਜਵਾਬ ਦਿਓ: ਹਾਂ / ਨਾ। ਹਰ ਸਵਾਲ ${escapeHtml(String(timerSec))} ਸਕਿੰਟ ਵਿੱਚ ਲਾਕ ਹੋਵੇਗਾ।</span>
      <span class="lang en">Answer quickly: YES / NO. Each locks in ${escapeHtml(String(timerSec))} seconds.</span>
    `;

    const optsEl = $("#qOptions");
    optsEl.classList.add("qfList");
    optsEl.innerHTML = "";

    for (let i = 0; i < revealCount; i++) {
      const it = set.items[i];
      const entry = bankById.get(it.sourceQid);
      const q = entry?.q;
      const qq = normalizeBilingual(q?.question);
      const opts = q?.options || {};
      const correctKey = safeText(q?.correct_option).toLowerCase();
      const statementOpt = (it.statementKey && opts[it.statementKey] !== undefined) ? normalizeBilingual(opts[it.statementKey]) : normalizeBilingual(q?.answer_text);
      const candidateIsCorrect = safeText(it.statementKey).toLowerCase() === correctKey;
      const correctYes = candidateIsCorrect;

      const card = document.createElement("div");
      card.className = "item";
      card.style.alignItems = "flex-start";
      card.style.flexDirection = "column";

      const isActive = !setDone && i === currentItemIdx;
      const locked = !!it.locked;

      if (locked && it.isCorrect === null) {
        it.isCorrect = (it.selection === (correctYes ? "yes" : "no"));
        if (!it.selection) it.isCorrect = false;
      }

      const resultMark = locked ? (it.isCorrect ? "✅" : "❌") : "";

      card.innerHTML = `
        <div style="width:100%">
          <div class="qMeta">
            <span class="badge">${escapeHtml(String(i + 1))}/${escapeHtml(String(set.items.length))}</span>
            <span class="muted small" style="margin-left:8px">${escapeHtml(resultMark)}</span>
          </div>
          <div style="margin-top:10px">
            <span class="lang pa">${escapeHtml(qq.pa)}</span>
            <span class="lang en">${escapeHtml(qq.en)}</span>
          </div>
          <div style="margin-top:14px" class="muted">
            <span class="lang pa small">ਬਿਆਨ: ਸਹੀ ਉੱਤਰ ਹੈ “${escapeHtml(statementOpt.pa)}”</span>
            <span class="lang en small">Statement: The correct answer is “${escapeHtml(statementOpt.en)}”</span>
          </div>
        </div>
        <div class="row" style="width:100%; justify-content:flex-start; margin-top:12px">
          <button class="btn qfBtn" data-qf="yes" type="button">YES</button>
          <button class="btn qfBtn" data-qf="no" type="button">NO</button>
        </div>
      `;

      const yesBtn = card.querySelector('[data-qf="yes"]');
      const noBtn = card.querySelector('[data-qf="no"]');

      if (it.selection === "yes") {
        yesBtn.classList.add("primary", "selected");
        yesBtn.textContent = "✓ YES";
      }
      if (it.selection === "no") {
        noBtn.classList.add("primary", "selected");
        noBtn.textContent = "✓ NO";
      }

      const enable = isActive && !locked;
      yesBtn.disabled = !enable;
      noBtn.disabled = !enable;
      yesBtn.addEventListener("click", () => {
        it.selection = "yes";
        saveState();
        renderQuiz();
      });
      noBtn.addEventListener("click", () => {
        it.selection = "no";
        saveState();
        renderQuiz();
      });

      if (isActive) {
        card.style.borderColor = hexToRgba(color, 0.55);
        card.style.background = hexToRgba(color, 0.06);
      }

      optsEl.appendChild(card);
    }

    // Answer box is not used for quick fire
    const answerBox = $("#qAnswer");
    box.classList.remove("revealed");
    answerBox.style.display = "none";

    // Controls
    const btnLock = $("#btnLock");
    const btnSkip = $("#btnSkip");
    const btnPass = $("#btnPass");
    const btnReveal = $("#btnReveal");
    const btnNext = $("#btnNext");

    btnSkip.style.display = "none";
    if (btnPass) btnPass.style.display = "none";
    btnReveal.style.display = "none";

    // Quick Fire locking is timer-driven (auto-submit). Do not allow manual Submit.
    btnLock.disabled = true;
    btnLock.style.display = "none";

    if (setDone) {
      btnNext.disabled = false;
      renderPointsToast(answeredSet);
      stopTimer();
      renderTimerUI();
    } else {
      const it = set.items[currentItemIdx];
      btnNext.disabled = true;
      renderPointsToast(null);
      renderTimerUI();
      if ((state.activeRound.stage || "shown") === "shown") startTimerForCurrentQuestion();
      else stopTimer();
    }

    renderLiveScore();
  }

  function renderPointsToast(answered) {
    const el = $("#pointsToast");
    if (!el) return;
    if (!answered) {
      el.className = "pointsToast";
      el.textContent = "";
      return;
    }

    el.className = "pointsToast show";
    if (answered.delta > 0) el.classList.add("good");
    else if (answered.delta < 0) el.classList.add("bad");
    else el.classList.add("neutral");

    const sign = answered.delta > 0 ? "+" : "";
    const label = answered.outcome === "timeout" ? "Time up" : (answered.outcome === "skip" ? "Skipped" : (answered.outcome === "correct" ? "Correct" : "Wrong"));
    el.textContent = `${label}: ${sign}${answered.delta} points`;
  }

  function triggerResultAnimation(outcome) {
    const box = $("#quizBox");
    if (!box) return;
    box.classList.remove("correctAnim", "wrongAnim", "neutralAnim");
    // force reflow
    void box.offsetWidth;
    if (outcome === "correct") box.classList.add("correctAnim");
    else if (outcome === "wrong") box.classList.add("wrongAnim");
    else if (outcome === "timeout") box.classList.add("neutralAnim");
    else if (outcome === "skip") box.classList.add("neutralAnim");
  }

  async function copyQuestion() {
    const meta = $("#qMeta").textContent.trim();
    const qText = $("#qText").textContent.trim();
    const opts = $$("#qOptions .opt").map((x) => x.textContent.trim()).join("\n\n");
    const all = `${meta}\n\n${qText}\n\n${opts}`.trim();

    try {
      await navigator.clipboard.writeText(all);
      toast("Question copied.");
    } catch {
      toast("Copy failed (browser blocked). Try Ctrl+C from the page.");
    }
  }

  function lockAnswer() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    if (r.type === "quickfire") {
      toast("Quick Fire auto-submits on timer.");
      return;
    }

    if (r.type === "offline") {
      const idx = state.activeRound.idx;
      const qid = state.activeRound.questions[idx];
      if (state.activeRound.answered[qid]) {
        toast("Already locked.");
        return;
      }

      const selectedKey = state.activeRound.selectedKey;
      if (!selectedKey) {
        toast("Select an option first.");
        return;
      }

      const teamId = state.activeRound.questionTeams?.[idx] || null;
      const outcome = (selectedKey === "correct") ? "correct" : (selectedKey === "wrong") ? "wrong" : "skip";
      const delta = (outcome === "correct") ? r.pointsPerCorrect : (outcome === "wrong") ? (r.pointsPerWrong ?? 0) : 0;
      const team = teamId ? getTeamById(teamId) : null;
      const detail = {
        label: (outcome === "correct") ? "Correct" : (outcome === "wrong") ? "Wrong" : "Skipped",
        sub: team ? team.name : ""
      };
      applyAnswer({ qid, teamId, selectedKey, outcome, delta, detail });
      return;
    }

    const idx = state.activeRound.idx;
    const qid = state.activeRound.questions[idx];
    const entry = bankById.get(qid);
    if (!entry) return;

    if (state.activeRound.answered[qid]) {
      toast("Already locked.");
      return;
    }

    const teamId = state.activeRound.questionTeams?.[idx] || null;
    if (!teamId) {
      toast("Team turn not found.");
      return;
    }

    const selectedKey = state.activeRound.selectedKey;
    if (!selectedKey) {
      toast("Select an option first.");
      return;
    }

    const { q } = entry;
    const correctKey = safeText(q.correct_option).toLowerCase();

    const outcome = selectedKey === correctKey ? "correct" : "wrong";
    const delta = outcome === "correct" ? r.pointsPerCorrect : (r.pointsPerWrong ?? 0);

    const team = getTeamById(teamId);
    const detail = {
      label: outcome === "correct" ? "Correct" : "Wrong",
      sub: team ? team.name : ""
    };
    applyAnswer({ qid, teamId, selectedKey, outcome, delta, detail });
  }

  function skipQuestion() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    if (r.type === "offline") {
      toast("In Offline round, select Skip and press Submit.");
      return;
    }

    if (r.allowSkip === false) {
      toast("Skip is disabled for this round.");
      return;
    }

    if (r.type === "quickfire") {
      toast("Quick Fire does not support skip.");
      return;
    }

    const idx = state.activeRound.idx;
    const qid = state.activeRound.questions[idx];
    if (state.activeRound.answered[qid]) return;

    const teamId = state.activeRound.questionTeams?.[idx] || null;
    applyAnswer({ qid, teamId, selectedKey: null, outcome: "skip", delta: 0 });
  }

  function passQuestion() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    if (r.type === "offline") {
      toast("Offline rounds do not support Pass.");
      return;
    }

    if (r.allowPass === false) {
      toast("Pass is disabled for this round.");
      return;
    }

    // Pass behaves like skip (0 points).
    skipQuestion();
  }

  function revealNowNoScore() {
    const r = getActiveRoundRecord();
    if (r?.type === "offline") {
      toast("Offline rounds do not support Reveal.");
      return;
    }
    // Revealing gives away the answer; treat as skip.
    skipQuestion();
  }

  function timeoutAutoLock() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    if (r.type === "offline") {
      // Offline: timer is convenience only; do not auto-lock.
      stopTimer();
      renderTimerUI();
      triggerResultAnimation("timeout");
      toast("Time up (offline) — submit when ready.");
      return;
    }

    if (r.type === "quickfire") {
      quickFireLockCurrentItem("timeout");
      return;
    }

    const idx = state.activeRound.idx;
    const qid = state.activeRound.questions[idx];
    if (state.activeRound.answered[qid]) return;

    const teamId = state.activeRound.questionTeams?.[idx] || null;
    const team = teamId ? getTeamById(teamId) : null;
    const detail = {
      label: "Time up",
      sub: team ? team.name : ""
    };
    applyAnswer({ qid, teamId, selectedKey: state.activeRound.selectedKey, outcome: "timeout", delta: 0, detail });
  }

  function quickFireLockCurrentItem(source) {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r || r.type !== "quickfire") return;

    const idx = state.activeRound.idx;
    const setId = state.activeRound.questions[idx];
    const set = state.activeRound.quickFireSets?.[idx];
    if (!set) return;
    if (state.activeRound.answered?.[setId]) return;

    const itemIdx = set.items.findIndex((it) => !it.locked);
    if (itemIdx < 0) {
      quickFireFinalizeSetIfDone();
      return;
    }

    const it = set.items[itemIdx];
    const entry = bankById.get(it.sourceQid);
    const q = entry?.q;
    const correctKey = safeText(q?.correct_option).toLowerCase();
    const candidateIsCorrect = safeText(it.statementKey).toLowerCase() === correctKey;
    const correctYes = candidateIsCorrect;

    it.locked = true;
    it.isCorrect = (it.selection === (correctYes ? "yes" : "no"));
    if (!it.selection) it.isCorrect = false;

    // Reveal next item below by re-rendering; timer restarts per item.
    state.activeRound.timerEndsAt = null;
    state.activeRound.timerUnitKey = null;
    saveState();

    if (set.items.some((x) => !x.locked)) {
      renderQuiz();
      startTimerForCurrentQuestion(true);
      return;
    }

    quickFireFinalizeSetIfDone();
  }

  function quickFireFinalizeSetIfDone() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r || r.type !== "quickfire") return;

    const idx = state.activeRound.idx;
    const setId = state.activeRound.questions[idx];
    const set = state.activeRound.quickFireSets?.[idx];
    if (!set) return;
    if (state.activeRound.answered?.[setId]) return;

    if (set.items.some((x) => !x.locked)) return;

    const correctCount = set.items.filter((x) => x.isCorrect).length;
    const wrongCount = set.items.length - correctCount;
    set.correctCount = correctCount;
    set.wrongCount = wrongCount;
    set.done = true;

    const allCorrect = wrongCount === 0;
    const modeAllOrNone = (r.qfAllOrNone !== undefined) ? !!r.qfAllOrNone : true;

    let outcome;
    let delta;
    let label;
    if (modeAllOrNone) {
      // Set-based scoring: only a perfect set earns the “correct” points.
      outcome = allCorrect ? "correct" : "wrong";
      delta = allCorrect ? r.pointsPerCorrect : (r.pointsPerWrong ?? 0);
      label = allCorrect ? "Quick Fire: Perfect!" : "Quick Fire: Not perfect";
    } else {
      // Per-question scoring within the set.
      const perWrong = (r.pointsPerWrong ?? 0);
      delta = (correctCount * r.pointsPerCorrect) + (wrongCount * perWrong);
      outcome = delta > 0 ? "correct" : "wrong";
      label = allCorrect ? "Quick Fire: Perfect!" : "Quick Fire: Set scored";
    }

    const teamId = state.activeRound.questionTeams?.[idx] || null;
    const detail = {
      label,
      sub: `${correctCount} correct • ${wrongCount} wrong`
    };

    applyAnswer({ qid: setId, teamId, selectedKey: null, outcome, delta, detail });
  }

  function applyAnswer({ qid, teamId, selectedKey, outcome, delta, detail }) {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    stopTimer();

    if (teamId) {
      const team = getTeamById(teamId);
      if (team) team.score += delta;

      if (r.resultsByTeamId[teamId] === undefined) r.resultsByTeamId[teamId] = 0;
      r.resultsByTeamId[teamId] += delta;
    }

    state.activeRound.answered[qid] = { teamId, selectedKey, outcome, delta, detail };
    state.activeRound.revealed = true;

    state.undoStack.push({ type: "answer", qid, teamId, delta, outcome, roundId: r.id });

    saveState();
    renderAll();
    triggerResultAnimation(outcome);

    // For end-of-round automation, treat Skip as a terminal answered state too.
    // (Previously, skipping the last question would never auto-end.)
    if (outcome === "correct" || outcome === "wrong" || outcome === "timeout" || outcome === "skip") {
      if (outcome !== "skip") playSfx(outcome);
      showResultOverlay({ outcome, delta, text: detail?.label, sub: detail?.sub });

      // Delay ranking reorder + its move animation/sound until popup ends.
      rankHoldUntil = Date.now() + RESULT_OVERLAY_MS;
      rankHoldLiveOrder = (renderLiveScore._order && renderLiveScore._order.length)
        ? renderLiveScore._order.slice()
        : state.teams.map((t) => t.id);
      rankHoldBoardOrder = (renderScoreboards._order && renderScoreboards._order.length)
        ? renderScoreboards._order.slice()
        : state.teams.map((t) => t.id);

      if (rankHoldTimerId) window.clearTimeout(rankHoldTimerId);
      rankHoldTimerId = window.setTimeout(() => {
        rankHoldUntil = 0;
        rankHoldLiveOrder = null;
        rankHoldBoardOrder = null;
        rankHoldTimerId = null;
        renderLiveScore();
        renderScoreboards();
      }, RESULT_OVERLAY_MS + 120);

      // If this was the last question/turn in the round, automatically end the round
      // AFTER the on-screen result overlay finishes.
      const isLast = state.activeRound && state.activeRound.idx >= state.activeRound.questions.length - 1;
      if (isLast && !lockAnswer._autoEndScheduled) {
        lockAnswer._autoEndScheduled = true;
        window.setTimeout(() => {
          lockAnswer._autoEndScheduled = false;
          const rr = getActiveRoundRecord();
          if (!state.activeRound || !rr) return;

          // Only auto-end if the final question/turn has actually been answered.
          const qidNow = state.activeRound.questions[state.activeRound.idx];
          if (!state.activeRound.answered?.[qidNow]) return;

          endRoundCore(rr);
        }, RESULT_OVERLAY_MS + 180);
      }

      if (outcome === "wrong" || outcome === "timeout") {
        buzzScreen();
      }
    }
  }

  function advanceQuestion() {
    const r = getActiveRoundRecord();
    if (!state.activeRound || !r) return;

    const qid = state.activeRound.questions[state.activeRound.idx];
    if (!state.activeRound.answered[qid]) {
      toast("Submit (or finish this turn) before Next.");
      return;
    }

    if (state.activeRound.idx >= state.activeRound.questions.length - 1) {
      // End immediately when user presses Next on the final question.
      endRoundCore(r);
      return;
    }

    state.activeRound.idx++;
    state.activeRound.stage = "ready";
    state.activeRound.revealed = false;
    state.activeRound.selectedKey = null;
    state.activeRound.timerEndsAt = null;
    state.activeRound.timerUnitKey = null;
    saveState();
    stopTimer();
    renderQuiz();
    renderRoundMeta();
    toast("Next question.");
  }

  function undoLast() {
    const action = state.undoStack.pop();
    if (!action) {
      toast("Nothing to undo.");
      return;
    }

    if (action.type === "answer") {
      const r = state.rounds.find((x) => x.id === action.roundId);
      if (!r) {
        toast("Undo failed (round not found).");
        return;
      }

      if (action.teamId) {
        const team = state.teams.find((t) => t.id === action.teamId);
        if (team) team.score -= action.delta;
        if (r.resultsByTeamId[action.teamId] !== undefined) r.resultsByTeamId[action.teamId] -= action.delta;
      }

      if (state.activeRound && state.activeRound.roundId === action.roundId) {
        delete state.activeRound.answered[action.qid];
        // If undoing current question, reset UI state.
        const currentQid = state.activeRound.questions[state.activeRound.idx];
        if (currentQid === action.qid) {
          state.activeRound.revealed = false;
          state.activeRound.selectedKey = null;
          if ((state.activeRound.stage || "shown") === "shown") startTimerForCurrentQuestion(true);
          else stopTimer();
        }
      }

      // Keep asked-history conservative (prevents accidental repeats). If you want strict undo, remove this comment:
      // delete state.asked[action.qid];

      saveState();
      renderAll();
      toast("Undone last action.");
    }
  }

  // =========================

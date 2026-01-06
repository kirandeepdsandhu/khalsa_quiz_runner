(() => {
  const FACT_ORDER = ['parents', 'birth', 'birthPlace', 'gurgaddi', 'death', 'siblings', 'spouse', 'children'];

  const state = {
    dataset: null,
    peopleById: new Map(),
    gurus: [],
    visibleGurus: 0,
    renderedNodeIds: new Set(),
    factStepByGuruId: new Map(),
    layoutCacheKey: null,
    groupTopByGuruId: new Map(),
    viewMode: 'tree',
    timelineYear: 1460,
    timelineTime: 1460,
    timelinePlaying: false,
    timelineRafId: null,
    timelineLastTs: null,
    timelineHoldUntilTs: null,
    timelinePlaced: [],
    timelineStackedIds: new Set(),
    timelineStackYearOrder: [],
    timelineStackByYear: new Map(),
    timelineConfig: { baseYear: 1460, endYear: 1720, mmPerYear: 6 },
    pendingAutoScroll: false,
    toggles: {
      birth: true,
      birthPlace: true,
      gurgaddi: true,
      death: true,
      parents: true,
      siblings: true,
      spouse: true,
      children: true,
    },
  };

  const els = {
    stepLabel: document.getElementById('stepLabel'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    prevFactBtn: document.getElementById('prevFactBtn'),
    nextFactBtn: document.getElementById('nextFactBtn'),
    resetBtn: document.getElementById('resetBtn'),
    toggles: document.getElementById('toggles'),
    tabTree: document.getElementById('tabTree'),
    tabAll: document.getElementById('tabAll'),
    tabTimeline: document.getElementById('tabTimeline'),
    viewTree: document.getElementById('viewTree'),
    viewAll: document.getElementById('viewAll'),
    viewTimeline: document.getElementById('viewTimeline'),
    allCards: document.getElementById('allCards'),
    timelineCanvas: document.getElementById('timelineCanvas'),
    timelineAxis: document.getElementById('timelineAxis'),
    timelineEvents: document.getElementById('timelineEvents'),
    timelineLinks: document.getElementById('timelineLinks'),
    timelineNow: document.getElementById('timelineNow'),
    timelineStack: document.getElementById('timelineStack'),
    timelineOverlay: document.getElementById('timelineOverlay'),
    header: document.querySelector('.header'),
    timelineControls: document.getElementById('timelineControls'),
    timelineYear: document.getElementById('timelineYear'),
    timelineYearLabel: document.getElementById('timelineYearLabel'),
    timelinePrevYear: document.getElementById('timelinePrevYear'),
    timelineNextYear: document.getElementById('timelineNextYear'),
    timelinePlayPause: document.getElementById('timelinePlayPause'),
    treeControls: document.getElementById('treeControls'),
    canvas: document.getElementById('treeCanvas'),
    edges: document.getElementById('edges'),
    notice: document.getElementById('notice'),
  };

  function updateTimelineOverlayTop() {
    if (!els.timelineOverlay) return;
    const h = els.header?.getBoundingClientRect?.();
    const top = h ? Math.max(0, Math.floor(h.bottom)) : 0;
    els.timelineOverlay.style.top = `${top}px`;
  }

  function getYearFromISO(iso) {
    if (!iso || typeof iso !== 'string') return '—';
    const m = /^(\d{4})/.exec(iso.trim());
    return m ? m[1] : '—';
  }

  function formatISODateToDMonthYYYY(iso) {
    if (!iso || typeof iso !== 'string') return '—';
    // Supports YYYY-MM-DD or YYYY-MM or YYYY
    const parts = iso.split('-').map(p => p.trim());
    if (parts.length === 1) return parts[0] || '—';

    const year = parts[0];
    const month = parts[1] ? Number(parts[1]) : NaN;
    const day = parts[2] ? Number(parts[2]) : NaN;

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const monthName = Number.isFinite(month) && month >= 1 && month <= 12 ? months[month - 1] : null;

    if (parts.length === 2) {
      // YYYY-MM
      if (!monthName) return year || '—';
      return `${monthName} ${year}`;
    }

    // YYYY-MM-DD
    if (!monthName || !Number.isFinite(day)) {
      return `${monthName ?? ''} ${year}`.trim() || '—';
    }
    return `${day} ${monthName} ${year}`;
  }

  function clamp(n, min, max){
    return Math.max(min, Math.min(max, n));
  }

  function scrollToTreeBottom() {
    // Smoothly scroll the page so the bottom of the tree canvas is visible.
    // (The tree itself uses absolute-positioned nodes; the page scrolls.)
    if (!els.canvas) return;
    const rect = els.canvas.getBoundingClientRect();
    const bottomY = window.scrollY + rect.bottom;
    const target = Math.max(0, Math.floor(bottomY - window.innerHeight + 24));
    try {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, target);
    }
  }

  function getLastGuruId(visibleOrderedGurus) {
    if (!visibleOrderedGurus || visibleOrderedGurus.length === 0) return null;
    return visibleOrderedGurus[visibleOrderedGurus.length - 1].id;
  }

  function getActiveFactKeysForGuru(guru) {
    // Checkboxes filter what facts are eligible.
    // Some categories are omitted when empty.
    const keys = [];
    for (const k of FACT_ORDER) {
      if (!state.toggles[k]) continue;

      if (k === 'birthPlace') {
        // Birth Place is attached to the DOB node, so it only makes sense when
        // DOB is enabled and present.
        if (!state.toggles.birth) continue;
        const place = (guru?.events?.birth?.place ?? '').toString().trim();
        if (!place) continue;
      }

      if (k === 'siblings') {
        const sibs = (guru?.family?.siblings ?? []).filter(Boolean);
        if (!sibs.length) continue;
      }
      if (k === 'spouse') {
        const spouses = (guru?.family?.spouses ?? []).filter(Boolean);
        if (!spouses.length) continue;
      }
      if (k === 'children') {
        const kids = (guru?.family?.children ?? []).filter(Boolean);
        if (!kids.length) continue;
      }
      keys.push(k);
    }
    return keys;
  }

  function getLastGuruFactMax(guru) {
    return getActiveFactKeysForGuru(guru).length;
  }

  function getLastGuruFactCountToShow(guru) {
    const max = getLastGuruFactMax(guru);
    const current = state.factStepByGuruId.get(guru.id) ?? 0;
    return clamp(current, 0, max);
  }

  function getPersonName(id) {
    if (!id) return '—';
    const p = state.peopleById.get(id);
    return p?.name ?? id;
  }

  function getNames(ids) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return '—';
    return ids.map(getPersonName).join(', ');
  }

  function dateValueForSort(iso) {
    if (!iso) return null;
    return iso; // ISO strings sort lexicographically
  }

  function buildSuccessionOrder(gurus) {
    const byId = new Map(gurus.map(g => [g.id, g]));
    const successorOf = new Map();
    const predecessorOf = new Map();
    for (const g of gurus) {
      const pred = g?.succession?.predecessor ?? null;
      const succ = g?.succession?.successor ?? null;
      predecessorOf.set(g.id, pred);
      successorOf.set(g.id, succ);
    }

    // Start: predecessor null
    let start = gurus.find(g => (g?.succession?.predecessor ?? null) === null) || null;
    if (!start) return [...gurus];

    const ordered = [];
    const seen = new Set();
    let current = start;
    while (current && !seen.has(current.id)) {
      ordered.push(current);
      seen.add(current.id);
      const nextId = successorOf.get(current.id);
      current = nextId ? byId.get(nextId) : null;
    }

    // Append any gurus not in chain (safety)
    for (const g of gurus) {
      if (!seen.has(g.id)) ordered.push(g);
    }
    return ordered;
  }

  function sortGurus() {
    // Succession-only ordering (UI sort options removed).
    return buildSuccessionOrder([...state.gurus]);
  }

  function shouldShow(stepKey) {
    if (stepKey in state.toggles) return !!state.toggles[stepKey];
    return true;
  }

  function isLikelyFemaleName(name) {
    if (!name || typeof name !== 'string') return false;
    const n = name.trim();
    if (!n) return false;

    // Simple, explainable heuristics (works well for this dataset).
    return (
      /\b(Kaur|Bibi|Mata|Mai|Bebe)\b/i.test(n) ||
      /\bDevi\b/i.test(n) ||
      /\bKumari\b/i.test(n)
    );
  }

  function renderNamesWithGenderHints(containerEl, namesText) {
    // Expects a comma-separated list. Renders spans safely (no innerHTML).
    const raw = (namesText || '').trim();
    if (!raw || raw === '—') {
      containerEl.textContent = raw || '—';
      return;
    }

    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const span = document.createElement('span');
      span.textContent = name;
      if (isLikelyFemaleName(name)) span.className = 'femaleName';
      containerEl.appendChild(span);
      if (i !== parts.length - 1) containerEl.appendChild(document.createTextNode(', '));
    }
  }

  function renderAllCards() {
    if (!els.allCards) return;
    const orderedAll = sortGurus();
    const guruNumberById = new Map(orderedAll.map((g, idx) => [g.id, idx + 1]));

    els.allCards.innerHTML = '';
    for (const g of orderedAll) {
      const card = document.createElement('div');
      card.className = 'guruCard';

      const head = document.createElement('div');
      head.className = 'head';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = g.name;
      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = `Guru Sahib #${guruNumberById.get(g.id) ?? 0}`;
      head.appendChild(name);
      head.appendChild(num);
      card.appendChild(head);

      const rows = [
        ['Father', getPersonName(g?.family?.father ?? null), true],
        ['Mother', getPersonName(g?.family?.mother ?? null), true],
        ['Birth / Prakash', formatISODateToDMonthYYYY(g?.events?.birth?.date ?? null), false],
        ['Birth Place', g?.events?.birth?.place ?? '—', false],
        ['Gurta Gaddi', formatISODateToDMonthYYYY(g?.events?.gurgaddi?.date ?? null), false],
        ['Joti Jot', formatISODateToDMonthYYYY(g?.events?.death?.date ?? null), false],
        ['Siblings', getNames((g?.family?.siblings ?? []).filter(Boolean)), true],
        ['Spouse', getNames((g?.family?.spouses ?? []).filter(Boolean)), true],
        ['Children', getNames((g?.family?.children ?? []).filter(Boolean)), true],
      ];

      for (const [kText, vText, genderHint] of rows) {
        const row = document.createElement('div');
        row.className = 'row';
        const k = document.createElement('div');
        k.className = 'k';
        k.textContent = kText;
        const v = document.createElement('div');
        v.className = 'v';
        if (genderHint) {
          renderNamesWithGenderHints(v, String(vText ?? '—'));
        } else {
          v.textContent = String(vText ?? '—');
        }
        row.appendChild(k);
        row.appendChild(v);
        card.appendChild(row);
      }

      els.allCards.appendChild(card);
    }
  }

  function setView(mode) {
    state.viewMode = mode;

    if (els.tabTree) els.tabTree.setAttribute('aria-selected', mode === 'tree' ? 'true' : 'false');
    if (els.tabAll) els.tabAll.setAttribute('aria-selected', mode === 'all' ? 'true' : 'false');
    if (els.tabTimeline) els.tabTimeline.setAttribute('aria-selected', mode === 'timeline' ? 'true' : 'false');
    if (els.viewTree) els.viewTree.classList.toggle('hidden', mode !== 'tree');
    if (els.viewAll) els.viewAll.classList.toggle('hidden', mode !== 'all');
    if (els.viewTimeline) els.viewTimeline.classList.toggle('hidden', mode !== 'timeline');
    if (els.treeControls) els.treeControls.classList.toggle('hidden', mode !== 'tree');
    if (els.timelineControls) els.timelineControls.classList.toggle('hidden', mode !== 'timeline');

    if (mode === 'all') {
      renderAllCards();
    } else if (mode === 'timeline') {
      renderTimeline();
    } else {
      render();
    }

    // Keep ceiling overlay in sync for both autoplay and manual viewing.
    scheduleCeilingSync();
  }

  function makeNode({ id, kind, label, title, subtitle, x, y, shape }) {
    const el = document.createElement('div');
    el.className = `node ${kind}`;
    el.dataset.nodeId = id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const badge = document.createElement('div');
    badge.className = 'nodeBadge';
    const s = document.createElement('span');
    s.className = `shape ${shape}`;
    badge.appendChild(s);
    const l = document.createElement('span');
    l.className = 'nodeSub';
    l.textContent = label;
    badge.appendChild(l);
    el.appendChild(badge);

    const t = document.createElement('div');
    t.className = 'nodeTitle';

    // Highlight female names within list nodes (siblings/children/spouse).
    if (/\bfamily\b/.test(kind) && /\b(siblings|children|spouse)\b/.test(kind)) {
      renderNamesWithGenderHints(t, title);
    } else {
      t.textContent = title;
    }

    el.appendChild(t);

    if (subtitle) {
      const sub = document.createElement('div');
      sub.className = 'nodeSub mono';
      sub.textContent = subtitle;
      el.appendChild(sub);
    }

    return el;
  }

  function makeTimelineNode({ id, kind, label, title, subtitle, shape }) {
    const el = document.createElement('div');
    el.className = `node ${kind} timelineNode`;
    el.dataset.nodeId = id;

    const badge = document.createElement('div');
    badge.className = 'nodeBadge';
    const s = document.createElement('span');
    s.className = `shape ${shape}`;
    badge.appendChild(s);
    const l = document.createElement('span');
    l.className = 'nodeSub';
    l.textContent = label;
    badge.appendChild(l);
    el.appendChild(badge);

    const t = document.createElement('div');
    t.className = 'nodeTitle';
    t.textContent = title;
    el.appendChild(t);

    if (subtitle) {
      const sub = document.createElement('div');
      sub.className = 'nodeSub mono';
      sub.textContent = subtitle;
      el.appendChild(sub);
    }

    return el;
  }

  function fractionalYearFromISO(iso) {
    if (!iso || typeof iso !== 'string') return null;
    const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(iso.trim());
    if (!m) return null;
    const year = Number.parseInt(m[1], 10);
    if (!Number.isFinite(year)) return null;
    const month = m[2] ? Number.parseInt(m[2], 10) : null;
    const day = m[3] ? Number.parseInt(m[3], 10) : null;
    if (!month || month < 1 || month > 12) return year;
    const monthFrac = (month - 1) / 12;
    const dayFrac = day && day >= 1 && day <= 31 ? (day - 1) / 365 : 0;
    return year + monthFrac + dayFrac;
  }

  function normalizeEventEntries(eventValue) {
    // Returns [{ date, label, place, note }]
    if (!eventValue) return [];

    // Common: { date, label?, place?, note?, date_variants? }
    if (typeof eventValue === 'object' && !Array.isArray(eventValue)) {
      const date = eventValue.date ?? null;
      if (date) {
        return [{
          date,
          label: eventValue.label ?? null,
          place: eventValue.place ?? null,
          note: eventValue.note ?? null,
        }];
      }

      // Some future schemas might provide dates: []
      if (Array.isArray(eventValue.dates)) {
        return eventValue.dates
          .filter(Boolean)
          .map((d) => (typeof d === 'string' ? { date: d, label: eventValue.label ?? null, place: eventValue.place ?? null, note: eventValue.note ?? null } : {
            date: d?.date ?? null,
            label: d?.label ?? eventValue.label ?? null,
            place: d?.place ?? eventValue.place ?? null,
            note: d?.note ?? eventValue.note ?? null,
          }))
          .filter(x => !!x.date);
      }
    }

    // Array of strings or objects
    if (Array.isArray(eventValue)) {
      return eventValue
        .filter(Boolean)
        .map((d) => (typeof d === 'string' ? { date: d, label: null, place: null, note: null } : {
          date: d?.date ?? null,
          label: d?.label ?? null,
          place: d?.place ?? null,
          note: d?.note ?? null,
        }))
        .filter(x => !!x.date);
    }

    // String date
    if (typeof eventValue === 'string') {
      return [{ date: eventValue, label: null, place: null, note: null }];
    }
    return [];
  }

  function getTimelineEventPresentation(eventKey, eventLabelOverride) {
    const key = (eventKey || '').toString().trim();
    const labelOverride = (eventLabelOverride || '').toString().trim();

    if (key === 'birth') {
      return {
        kind: 'date birth',
        shape: 'circle',
        titleLabel: labelOverride ? `Birth / ${labelOverride}` : 'Birth / Prakash',
        sortOrder: 10,
      };
    }
    if (key === 'gurgaddi') {
      return {
        kind: 'date gurgaddi',
        shape: 'square',
        titleLabel: labelOverride || 'Gurta Gaddi',
        sortOrder: 20,
      };
    }
    if (key === 'death') {
      return {
        kind: 'date death',
        shape: 'diamond',
        titleLabel: labelOverride || 'Joti Jot',
        sortOrder: 40,
      };
    }
    if (key === 'marriage') {
      return {
        kind: 'date marriage',
        shape: 'square',
        titleLabel: labelOverride || 'Marriage',
        sortOrder: 30,
      };
    }

    // Default: treat as a generic date event.
    const pretty = key ? (key.charAt(0).toUpperCase() + key.slice(1)) : 'Event';
    return {
      kind: 'date',
      shape: 'circle',
      titleLabel: labelOverride || pretty,
      sortOrder: 50,
    };
  }

  function buildTimelineEvents() {
    const events = [];
    const ordered = sortGurus();
    const guruIndexById = new Map(ordered.map((g, idx) => [g.id, idx + 1]));

    for (const g of ordered) {
      const guruIdx = guruIndexById.get(g.id) ?? 0;
      const evs = g?.events && typeof g.events === 'object' ? g.events : {};
      for (const [eventKey, eventValue] of Object.entries(evs)) {
        const entries = normalizeEventEntries(eventValue);
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const iso = (e?.date ?? '').toString().trim();
          if (!iso) continue;

          const presentation = getTimelineEventPresentation(eventKey, e?.label ?? null);
          const year = getYearFromISO(iso);
          const yearNum = Number.parseInt(year, 10);
          const yearFrac = fractionalYearFromISO(iso);
          const dateText = formatISODateToDMonthYYYY(iso);
          const place = (e?.place ?? '').toString().trim();
          const note = (e?.note ?? '').toString().trim();
          const subtitleParts = [dateText];
          if (place) subtitleParts.push(place);
          if (note) subtitleParts.push(note);

          events.push({
            id: `t:${g.id}:${eventKey}:${i}`,
            sortDate: dateValueForSort(iso) ?? '9999-99-99',
            sortOrder: presentation.sortOrder,
            guruIdx,
            kind: presentation.kind,
            shape: presentation.shape,
            badge: year,
            yearNum: Number.isFinite(yearNum) ? yearNum : null,
            yearFrac: (typeof yearFrac === 'number' && Number.isFinite(yearFrac)) ? yearFrac : (Number.isFinite(yearNum) ? yearNum : null),
            title: `${presentation.titleLabel} — ${g.name}`,
            subtitle: subtitleParts.filter(Boolean).join(' • '),
          });
        }
      }
    }

    events.sort((a, b) => {
      const d = String(a.sortDate).localeCompare(String(b.sortDate));
      if (d !== 0) return d;
      const o = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (o !== 0) return o;
      return (a.guruIdx ?? 0) - (b.guruIdx ?? 0);
    });

    return events;
  }

  function updateTimelineYearUI() {
    const y = Number.isFinite(state.timelineYear) ? state.timelineYear : 1460;
    if (els.timelineYearLabel) els.timelineYearLabel.textContent = String(y);
    if (els.timelineYear) els.timelineYear.value = String(y);
  }

  function clampTimelineYear(y) {
    const n = Number.parseInt(String(y), 10);
    if (!Number.isFinite(n)) return 1460;
    return clamp(n, 1460, 1720);
  }

  function setTimelinePlaying(isPlaying) {
    state.timelinePlaying = !!isPlaying;
    if (els.timelinePlayPause) els.timelinePlayPause.textContent = state.timelinePlaying ? 'Pause' : 'Play';

    if (!state.timelinePlaying) {
      state.timelineLastTs = null;
      state.timelineHoldUntilTs = null;
      if (state.timelineRafId) cancelAnimationFrame(state.timelineRafId);
      state.timelineRafId = null;
      // Keep timelineNow in layout (opacity handled in updateTimelineNowLine)

      // Keep the stack visible after pause/end if it has items.
      renderTimelineStack();
      return;
    }

    if (els.timelineNow) els.timelineNow.classList.remove('hidden');

    // Ensure any previous playback timers are cleared before starting.
    state.timelineLastTs = null;
    state.timelineHoldUntilTs = null;
    if (state.timelineRafId) cancelAnimationFrame(state.timelineRafId);
    state.timelineRafId = null;

    // If already at end, restart from beginning.
    if ((state.timelineTime ?? 0) >= 1720) {
      state.timelineTime = 1460;
      state.timelineYear = 1460;
      updateTimelineYearUI();
      if (state.viewMode === 'timeline') applyTimelineTime(true);
    }

    // Clear stack on new play session.
    if (els.timelineStack) {
      state.timelineStackedIds = new Set();
      state.timelineStackYearOrder = [];
      state.timelineStackByYear = new Map();
      els.timelineStack.innerHTML = '';
    }

    updateTimelineOverlayTop();

    // Smooth playback with per-event holds.
    // The playhead moves continuously, but pauses 2s whenever a new event/card is revealed.
    const HOLD_MS_PER_EVENT = 2000;
    const EPS = 1e-6;
    const YEARS_PER_SEC = 4; // movie speed

    const findNextRevealTimeAfter = (t) => {
      const placed = state.timelinePlaced || [];
      for (const p of placed) {
        const rt = (typeof p?.revealTime === 'number' && Number.isFinite(p.revealTime)) ? p.revealTime : p?.yearFrac;
        if (typeof rt !== 'number' || !Number.isFinite(rt)) continue;
        if (rt > t + EPS) return rt;
      }
      return null;
    };

    // Warm start: when starting at the very beginning, move faster (but smoothly)
    // until the first event is reached so the user doesn't wait too long.
    const baseYear = state.timelineConfig?.baseYear ?? 1460;
    let warmStartTarget = null;
    {
      const t0 = (typeof state.timelineTime === 'number' && Number.isFinite(state.timelineTime)) ? state.timelineTime : baseYear;
      const isAtStart = t0 <= baseYear + 0.01;
      if (isAtStart) {
        const first = findNextRevealTimeAfter(baseYear - 1);
        if (typeof first === 'number' && Number.isFinite(first) && first >= baseYear) {
          warmStartTarget = first;
        }
      }
    }

    const step = (ts) => {
      if (!state.timelinePlaying) return;
      if (typeof ts !== 'number') ts = performance.now();

      const last = state.timelineLastTs;
      state.timelineLastTs = ts;
      if (last == null) {
        state.timelineRafId = requestAnimationFrame(step);
        return;
      }

      // During a hold, keep the playhead steady but continue to auto-center.
      if (typeof state.timelineHoldUntilTs === 'number' && ts < state.timelineHoldUntilTs) {
        updateTimelineNowLine();
        if (state.viewMode === 'timeline') {
          centerTimelineOnNowLine({ behavior: 'auto' });
          maybeStackEventsAtCeiling();
        }
        state.timelineRafId = requestAnimationFrame(step);
        return;
      }

      state.timelineHoldUntilTs = null;

      const dt = Math.max(0, Math.min(0.25, (ts - last) / 1000));
      const currentT = (typeof state.timelineTime === 'number' && Number.isFinite(state.timelineTime)) ? state.timelineTime : 1460;
      let speed = YEARS_PER_SEC;
      if (typeof warmStartTarget === 'number' && currentT < warmStartTarget - 0.02) {
        // Warm-start is only slightly faster than normal, and eases down as we approach
        // the first event so it doesn't feel like a sudden jump.
        const WARM_MAX_YPS = 8;
        const span = Math.max(0.5, warmStartTarget - baseYear);
        const remaining = Math.max(0, warmStartTarget - currentT);
        const factor = clamp(remaining / span, 0, 1);
        speed = YEARS_PER_SEC + (WARM_MAX_YPS - YEARS_PER_SEC) * factor;
      }
      const proposedT = currentT + dt * speed;

      const endYear = state.timelineConfig?.endYear ?? 1720;
      const nextRevealT = findNextRevealTimeAfter(currentT);
      if (nextRevealT == null) {
        // No more events: keep moving smoothly to the end year, then stop.
        state.timelineTime = Math.min(endYear, proposedT);
        state.timelineYear = clampTimelineYear(Math.floor(state.timelineTime));
        updateTimelineYearUI();
        if (state.viewMode === 'timeline') applyTimelineTime(false);
        if (state.viewMode === 'timeline') maybeStackEventsAtCeiling();

        if (state.timelineTime >= endYear - EPS) {
          state.timelineTime = endYear;
          state.timelineYear = clampTimelineYear(Math.floor(endYear));
          updateTimelineYearUI();
          if (state.viewMode === 'timeline') applyTimelineTime(true);
          setTimelinePlaying(false);
          return;
        }

        state.timelineRafId = requestAnimationFrame(step);
        return;
      }

      if (proposedT + EPS >= nextRevealT) {
        // Land exactly on the next event and hold.
        state.timelineTime = nextRevealT;
        state.timelineYear = clampTimelineYear(Math.floor(state.timelineTime));
        updateTimelineYearUI();
        if (state.viewMode === 'timeline') applyTimelineTime(true);
        state.timelineHoldUntilTs = ts + HOLD_MS_PER_EVENT;
        if (typeof warmStartTarget === 'number' && nextRevealT >= warmStartTarget - EPS) warmStartTarget = null;
        if (state.viewMode === 'timeline') maybeStackEventsAtCeiling();
        state.timelineRafId = requestAnimationFrame(step);
        return;
      }

      // Normal smooth advance.
      state.timelineTime = proposedT;
      if (state.timelineTime >= 1720) {
        state.timelineTime = 1720;
        state.timelineYear = 1720;
        updateTimelineYearUI();
        if (state.viewMode === 'timeline') applyTimelineTime(true);
        setTimelinePlaying(false);
        return;
      }

      state.timelineYear = clampTimelineYear(Math.floor(state.timelineTime));
      updateTimelineYearUI();
      if (state.viewMode === 'timeline') applyTimelineTime(false);
      if (state.viewMode === 'timeline') maybeStackEventsAtCeiling();

      state.timelineRafId = requestAnimationFrame(step);
    };

    state.timelineRafId = requestAnimationFrame(step);
  }

  function renderTimelineStack() {
    if (!els.timelineStack || !els.timelineOverlay) return;
    const hasItems = (state.timelineStackYearOrder?.length ?? 0) > 0;
    const shouldShow = state.viewMode === 'timeline' && (state.timelinePlaying || hasItems);
    els.timelineOverlay.classList.toggle('hidden', !shouldShow);
    els.timelineOverlay.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    if (!shouldShow) {
      els.timelineStack.innerHTML = '';
      return;
    }

    updateTimelineOverlayTop();

    const frag = document.createDocumentFragment();

    const years = state.timelineStackYearOrder || [];
    for (const year of years) {
      const row = document.createElement('div');
      row.className = 'timelineStackRow';

      const yearEl = document.createElement('div');
      yearEl.className = 'timelineStackYear';
      yearEl.textContent = String(year);
      row.appendChild(yearEl);

      const eventsWrap = document.createElement('div');
      eventsWrap.className = 'timelineStackEvents';

      const items = state.timelineStackByYear.get(year) || [];
      for (const item of items) {
        const chip = document.createElement('div');
        chip.className = 'timelineStackChip';
        chip.dataset.eventId = String(item.id);
        chip.style.background = timelineColorForKind(item.kind);
        chip.textContent = item.text || '—';
        eventsWrap.appendChild(chip);
      }

      row.appendChild(eventsWrap);
      frag.appendChild(row);
    }

    els.timelineStack.innerHTML = '';
    els.timelineStack.appendChild(frag);
  }

  let pendingCeilingSync = false;
  function scheduleCeilingSync() {
    if (pendingCeilingSync) return;
    pendingCeilingSync = true;
    requestAnimationFrame(() => {
      pendingCeilingSync = false;
      maybeStackEventsAtCeiling();
    });
  }

  function maybeStackEventsAtCeiling() {
    if (!els.timelineCanvas || !els.timelineStack || !els.timelineOverlay) return;

    if (state.viewMode !== 'timeline') {
      state.timelineStackYearOrder = [];
      state.timelineStackByYear = new Map();
      renderTimelineStack();
      return;
    }

    // "Ceiling" = bottom edge of the fixed overlay.
    // (Reverted from overlay-top behavior.)
    updateTimelineOverlayTop();
    const overlayRect = els.timelineOverlay?.getBoundingClientRect?.();
    const ceilingY = (overlayRect ? overlayRect.bottom : 0) + 2;

    const visiblePlaced = (state.timelinePlaced || []).filter(p => p?.visible && p?.node);
    if (!visiblePlaced.length) {
      state.timelineStackYearOrder = [];
      state.timelineStackByYear = new Map();
      renderTimelineStack();
      return;
    }

    // Dynamic: compute what is currently above the ceiling.
    const above = [];
    for (const p of visiblePlaced) {
      const r = p.node.getBoundingClientRect();
      if (r.top <= ceilingY) {
        above.push(p);
      }
    }

    if (!above.length) {
      state.timelineStackYearOrder = [];
      state.timelineStackByYear = new Map();
      renderTimelineStack();
      return;
    }

    above.sort((a, b) => {
      const ay = (typeof a.yearFrac === 'number' && Number.isFinite(a.yearFrac)) ? a.yearFrac : 0;
      const by = (typeof b.yearFrac === 'number' && Number.isFinite(b.yearFrac)) ? b.yearFrac : 0;
      if (ay !== by) return ay - by;
      const d = String(a.e?.sortDate ?? '').localeCompare(String(b.e?.sortDate ?? ''));
      if (d !== 0) return d;
      return (a.e?.sortOrder ?? 0) - (b.e?.sortOrder ?? 0);
    });

    const yearOrder = [];
    const byYear = new Map();
    for (const p of above) {
      const e = p.e;
      const year = (e?.badge ?? e?.yearNum ?? '—').toString().trim() || '—';

      const title = (e?.title ?? '').toString().trim();
      const parts = title.split('—').map(s => s.trim()).filter(Boolean);
      const compact = parts.length >= 2 ? `${parts[0]} — ${parts[1]}` : title;
      const text = compact || '—';
      const id = e?.id ?? `${year}:${text}`;

      if (!byYear.has(year)) {
        byYear.set(year, []);
        yearOrder.push(year);
      }
      byYear.get(year).push({ id, kind: e?.kind, text });
    }

    state.timelineStackYearOrder = yearOrder;
    state.timelineStackByYear = byYear;
    renderTimelineStack();
  }

  function centerTimelineOnNode(node) {
    if (!els.timelineCanvas || !els.timelineEvents || !node) return;
    const canvas = els.timelineCanvas;

    // node.offsetTop is relative to timelineEvents.
    const targetTop = (els.timelineEvents.offsetTop + node.offsetTop) - Math.floor(canvas.clientHeight / 2) + 80;
    const next = Math.max(0, Math.floor(targetTop));
    try {
      canvas.scrollTo({ top: next, behavior: 'smooth' });
    } catch {
      canvas.scrollTop = next;
    }
  }

  function updateTimelineNowLine() {
    if (!els.timelineCanvas || !els.timelineNow) return;
    const { baseYear, endYear, mmPerYear } = state.timelineConfig || { baseYear: 1460, endYear: 1720, mmPerYear: 6 };
    const t = (typeof state.timelineTime === 'number' && Number.isFinite(state.timelineTime)) ? state.timelineTime : baseYear;
    const tt = Math.max(baseYear, Math.min(endYear, t));
    const yMm = (tt - baseYear) * mmPerYear;
    els.timelineNow.style.top = `${yMm}mm`;
    // Never display:none the playhead; we need offsetTop for centering even when paused.
    els.timelineNow.classList.remove('hidden');
    els.timelineNow.style.opacity = (state.viewMode === 'timeline' && state.timelinePlaying) ? '1' : '0';
  }

  function centerTimelineOnNowLine({ behavior }) {
    if (!els.timelineCanvas || !els.timelineNow) return;
    const canvas = els.timelineCanvas;

    const canScrollCanvas = canvas.scrollHeight > canvas.clientHeight + 2;
    const b = behavior === 'smooth' ? 'smooth' : 'auto';

    if (canScrollCanvas) {
      // timelineNow is positioned relative to timelineCanvas.
      const y = els.timelineNow.offsetTop;
      const target = Math.max(0, Math.floor(y - canvas.clientHeight / 2));
      try {
        canvas.scrollTo({ top: target, behavior: b });
      } catch {
        canvas.scrollTop = target;
      }
      return;
    }

    // If the canvas isn't a scroll container (common), scroll the PAGE so the
    // playhead stays centered in the viewport.
    const r = els.timelineNow.getBoundingClientRect();
    const desiredTop = (window.innerHeight / 2);
    const delta = r.top - desiredTop;
    const targetY = Math.max(0, Math.floor(window.scrollY + delta));
    try {
      window.scrollTo({ top: targetY, behavior: b });
    } catch {
      window.scrollTo(0, targetY);
    }
  }

  function applyTimelineTime(forceCenter) {
    // Show cards whose date is <= timelineTime; hide future cards.
    const t = (typeof state.timelineTime === 'number' && Number.isFinite(state.timelineTime)) ? state.timelineTime : 1460;
    const newlyShown = [];

    for (const p of state.timelinePlaced) {
      const yRaw = (typeof p.yearFrac === 'number' && Number.isFinite(p.yearFrac)) ? p.yearFrac : null;
      const yPlay = (typeof p.revealTime === 'number' && Number.isFinite(p.revealTime)) ? p.revealTime : yRaw;
      const y = state.timelinePlaying ? yPlay : yRaw;
      if (y == null) continue;
      const shouldShow = y <= t;
      if (shouldShow && !p.visible) {
        p.visible = true;
        newlyShown.push(p);
      } else if (!shouldShow && p.visible) {
        p.visible = false;
      }

      if (p.node) p.node.classList.toggle('timelineHidden', !shouldShow);
    }

    updateTimelineNowLine();

    // Redraw links/axis-year labels only for visible nodes.
    const visiblePlaced = state.timelinePlaced.filter(p => p.visible);
    requestAnimationFrame(() => {
      drawTimelineLinksAndYears(visiblePlaced, state.timelineConfig.baseYear, state.timelineConfig.mmPerYear);
      // While playing, keep the playhead centered. When scrubbing (forceCenter), center too.
      if ((state.timelinePlaying && state.viewMode === 'timeline') || forceCenter) {
        centerTimelineOnNowLine({ behavior: state.timelinePlaying ? 'auto' : 'smooth' });
      } else {
        const latest = newlyShown.length ? newlyShown[newlyShown.length - 1] : null;
        if (latest?.node && newlyShown.length) centerTimelineOnNode(latest.node);
      }

      // After any scrolling/centering, update the ceiling stack.
      if (state.viewMode === 'timeline') scheduleCeilingSync();
    });

    return newlyShown;
  }

  function timelineColorForKind(kind) {
    const k = String(kind || '');
    if (/\bbirth\b/.test(k)) return 'rgba(43,108,255,.55)';
    if (/\bgurgaddi\b/.test(k)) return 'rgba(18,161,80,.55)';
    if (/\bdeath\b/.test(k)) return 'rgba(216,52,79,.55)';
    if (/\bmarriage\b/.test(k)) return 'rgba(18,161,80,.45)';
    return 'rgba(75,88,122,.55)';
  }

  function setTimelineNodeX(node, dxPx) {
    const dx = Number.isFinite(dxPx) ? Math.round(dxPx) : 0;
    node.dataset.dx = String(dx);
    const op = dx < 0 ? '-' : '+';
    const abs = Math.abs(dx);
    node.style.left = `calc(50% ${op} ${abs}px)`;
  }

  function drawTimelineLinksAndYears(placed, baseYear, mmPerYear) {
    if (!els.timelineAxis || !els.timelineLinks) return;
    els.timelineLinks.innerHTML = '';

    const axisRect = els.timelineAxis.getBoundingClientRect();
    // Axis line X: timelineAxis::before is at left 44px with width 2px
    const axisLineX = axisRect.left + 44 + 1;
    const minCardLeft = axisRect.right + 16;

    // Clear and re-add event year labels (separate from generic tick labels)
    const existing = Array.from(els.timelineAxis.querySelectorAll('.timelineEventYear'));
    for (const el of existing) el.remove();

    // Add one year label per event (ok if repeated in same year)
    for (const p of placed) {
      if (!p?.node) continue;

      // Ensure card is not overlapping axis (nudge right if needed)
      const nodeRect0 = p.node.getBoundingClientRect();
      if (nodeRect0.left < minCardLeft) {
        const delta = Math.ceil(minCardLeft - nodeRect0.left);
        const currentDx = Number.parseInt(p.node.dataset.dx || '0', 10);
        const nextDx = (Number.isFinite(currentDx) ? currentDx : 0) + delta;
        setTimelineNodeX(p.node, nextDx);
      }

      const nodeRect = p.node.getBoundingClientRect();
      // Use the event's timeline position (yearFrac) so label + line align with the card.
      const yMm = (typeof p.yearFrac === 'number' && Number.isFinite(p.yearFrac)) ? (p.yearFrac - baseYear) * mmPerYear : null;
      const yPx = (yMm == null) ? Math.round(nodeRect.top + Math.min(28, nodeRect.height * 0.32)) : null;
      const yLocalPx = (yPx == null) ? null : (yPx - axisRect.top);
      const color = timelineColorForKind(p.e?.kind);

      // Bold event year label on the axis
      if (p.e?.yearNum) {
        const yearLabel = document.createElement('div');
        yearLabel.className = 'timelineEventYear';
        // Position label at the event card's exact timeline location.
        if (typeof yMm === 'number' && Number.isFinite(yMm)) yearLabel.style.top = `${Math.max(0, yMm)}mm`;
        else yearLabel.style.top = `${Math.max(0, Math.round(yLocalPx ?? 0) - 8)}px`;
        yearLabel.style.color = color;
        yearLabel.textContent = String(p.e.yearNum);
        els.timelineAxis.appendChild(yearLabel);
      }

      // Horizontal connector line from axis to card
      const left = axisLineX;
      const right = nodeRect.left - 10;
      if (right <= left) continue;

      const line = document.createElement('div');
      line.className = 'timelineLink';
      line.style.background = color;
      line.style.left = `${Math.round(left - els.timelineLinks.getBoundingClientRect().left)}px`;
      if (typeof yMm === 'number' && Number.isFinite(yMm)) {
        line.style.top = `${Math.max(0, yMm)}mm`;
      } else {
        line.style.top = `${Math.round((yPx ?? 0) - els.timelineLinks.getBoundingClientRect().top)}px`;
      }
      line.style.width = `${Math.max(0, Math.round(right - left))}px`;
      els.timelineLinks.appendChild(line);
    }
  }

  function scrollTimelineToYear(year) {
    if (!els.timelineCanvas) return;
    const y = Number.parseInt(String(year), 10);
    if (!Number.isFinite(y)) return;

    const nodes = Array.from(els.timelineCanvas.querySelectorAll('[data-year]'));
    if (!nodes.length) return;

    let target = null;
    for (const n of nodes) {
      const ry = Number.parseInt(n.getAttribute('data-year') || '', 10);
      if (!Number.isFinite(ry)) continue;
      if (ry >= y) { target = n; break; }
    }
    target = target || nodes[nodes.length - 1];
    try {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      target.scrollIntoView(true);
    }
  }

  function renderTimeline() {
    if (state.viewMode !== 'timeline') return;
    if (!els.timelineCanvas || !els.timelineAxis || !els.timelineEvents || !els.timelineLinks) return;
    els.timelineAxis.innerHTML = '';
    els.timelineEvents.innerHTML = '';
    els.timelineLinks.innerHTML = '';

    const events = buildTimelineEvents();

    // Proportional axis, but elongated to reduce congestion.
    // (User request: elongate timeline + avoid overlaps)
    const baseYear = 1460;
    const endYear = 1720;
    const MM_PER_YEAR = 6; // elongate further
    state.timelineConfig = { baseYear, endYear, mmPerYear: MM_PER_YEAR };
    const OVERLAP_BUCKET_MM = 28; // slightly larger band due to smaller fonts but dense years
    const X_OFFSET_PX = 220; // keep within events gutter
    const maxYear = Math.max(
      baseYear,
      endYear,
      ...events.map(e => (e.yearFrac ?? e.yearNum ?? null)).filter(v => typeof v === 'number')
    );

    // Set canvas height so absolute-positioned nodes have space.
    // Add padding space at end.
    const heightMm = Math.ceil((Math.min(maxYear, endYear) - baseYear) * MM_PER_YEAR + 120);
    els.timelineAxis.style.height = `${heightMm}mm`;
    els.timelineEvents.style.height = `${heightMm}mm`;

    // Year ticks: minor every year, major every 10 years with label.
    for (let y = baseYear; y <= endYear; y++) {
      const tick = document.createElement('div');
      const isMajor = (y % 10 === 0);
      tick.className = `timelineTick ${isMajor ? 'major' : 'minor'}`;
      tick.style.top = `${(y - baseYear) * MM_PER_YEAR}mm`;

      const mark = document.createElement('div');
      mark.className = 'mark';
      tick.appendChild(mark);

      if (isMajor) {
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = String(y);
        tick.appendChild(label);
      }

      els.timelineAxis.appendChild(tick);
    }

    // Events: absolute-positioned; same-Y (or close-Y) events stagger left/right.
    const placed = [];
    let lastRevealTime = -Infinity;
    const REVEAL_EPS = 1e-4;
    for (const e of events) {
      const yFrac = (typeof e.yearFrac === 'number' && Number.isFinite(e.yearFrac)) ? e.yearFrac : e.yearNum;
      if (typeof yFrac !== 'number' || !Number.isFinite(yFrac)) continue;
      if (yFrac < baseYear || yFrac > endYear) continue;
      const yMm = (yFrac - baseYear) * MM_PER_YEAR;

      const node = makeTimelineNode({
        id: e.id,
        kind: e.kind,
        label: e.badge,
        title: e.title,
        subtitle: e.subtitle,
        shape: e.shape,
      });
      node.classList.add('timelineNode');
      if (e.yearNum) node.setAttribute('data-year', String(e.yearNum));
      node.style.top = `${yMm}mm`;
      // default center; dx is applied via setTimelineNodeX
      setTimelineNodeX(node, 0);
      els.timelineEvents.appendChild(node);

      const bucket = Math.round(yMm / OVERLAP_BUCKET_MM);
      // revealTime is ONLY used during autoplay to allow per-card pausing even when
      // multiple events share the same year/position. Manual scrubbing still uses yearFrac.
      let revealTime = yFrac;
      if (revealTime <= lastRevealTime) revealTime = lastRevealTime + REVEAL_EPS;
      lastRevealTime = revealTime;

      placed.push({ e, node, yMm, bucket, yearFrac: yFrac, revealTime, visible: true });
    }

    // Group by bucket; within bucket, oldest left, newer right.
    const byBucket = new Map();
    for (const p of placed) {
      if (!byBucket.has(p.bucket)) byBucket.set(p.bucket, []);
      byBucket.get(p.bucket).push(p);
    }

    for (const [, group] of byBucket) {
      if (group.length <= 1) continue;

      // Keep chronological order (already sorted globally), just ensure stable.
      group.sort((a, b) => String(a.e.sortDate).localeCompare(String(b.e.sortDate)) || (a.e.sortOrder - b.e.sortOrder));

      // offsets: oldest left, next right, then further left/right
      const offsets = [];
      for (let i = 0; i < group.length; i++) {
        const layer = Math.floor(i / 2) + 1;
        const sign = (i % 2 === 0) ? -1 : 1;
        offsets.push(sign * layer * X_OFFSET_PX);
      }

      // Clamp left shift so cards don't cross into the axis gutter.
      const minDx = -120;
      for (let i = 0; i < group.length; i++) {
        const dx = Math.max(minDx, offsets[i]);
        setTimelineNodeX(group[i].node, dx);
      }
    }

    updateTimelineYearUI();
    // Store for movie playback and apply current time visibility.
    state.timelinePlaced = placed;
    // Ensure time is in sync with year slider.
    state.timelineYear = clampTimelineYear(state.timelineYear);
    state.timelineTime = Math.max(baseYear, Math.min(endYear, (typeof state.timelineTime === 'number' ? state.timelineTime : baseYear)));
    updateTimelineNowLine();
    applyTimelineTime(true);
  }

  function getNodeCenter(el) {
    const r = el.getBoundingClientRect();
    const pr = els.canvas.getBoundingClientRect();
    return {
      x: r.left - pr.left + r.width / 2,
      y: r.top - pr.top + r.height / 2,
      top: r.top - pr.top,
      left: r.left - pr.left,
      width: r.width,
      height: r.height,
    };
  }

  function setSvgSize() {
    const r = els.canvas.getBoundingClientRect();
    els.edges.setAttribute('viewBox', `0 0 ${Math.max(1, Math.floor(r.width))} ${Math.max(1, Math.floor(r.height))}`);
    els.edges.setAttribute('width', String(Math.max(1, Math.floor(r.width))));
    els.edges.setAttribute('height', String(Math.max(1, Math.floor(r.height))));
  }

  function drawEdges(edges) {
    setSvgSize();
    els.edges.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    for (const e of edges) {
      const a = els.canvas.querySelector(`[data-node-id="${e.from}"]`);
      const b = els.canvas.querySelector(`[data-node-id="${e.to}"]`);
      if (!a || !b) continue;
      const ca = getNodeCenter(a);
      const cb = getNodeCenter(b);

      // Path: gentle curve downwards (default)
      const path = document.createElementNS(ns, 'path');

      let d;
      if (e.mode === 'h') {
        // Horizontal connector (used for Birth -> Birth Place)
        const leftToRight = cb.x >= ca.x;
        const x1 = leftToRight ? (ca.left + ca.width) : ca.left;
        const y1 = ca.top + ca.height / 2;
        const x2 = leftToRight ? cb.left : (cb.left + cb.width);
        const y2 = cb.top + cb.height / 2;
        const midX = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
      } else {
        const x1 = ca.x;
        const y1 = ca.top + ca.height;
        const x2 = cb.x;
        const y2 = cb.top;
        const midY = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
      }

      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', e.stroke);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', '0.85');
      els.edges.appendChild(path);
    }
  }

  function estimateTextWidth(el) {
    // after element is in DOM
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function measureNodes(nodeSpecs) {
    // First pass: render invisible nodes at (0,0) to measure sizes.
    els.canvas.innerHTML = '';
    const rendered = [];
    for (const spec of nodeSpecs) {
      const el = makeNode({ ...spec, x: 0, y: 0 });
      el.style.visibility = 'hidden';
      els.canvas.appendChild(el);
      rendered.push({ spec, el });
    }

    const sizes = new Map();
    for (const { spec, el } of rendered) {
      const { w, h } = estimateTextWidth(el);
      sizes.set(spec.id, { w, h });
    }
    return sizes;
  }

  function render() {
    if (state.viewMode !== 'tree') return;
    const orderedAll = sortGurus();
    const ordered = orderedAll.slice(0, clamp(state.visibleGurus, 0, orderedAll.length));

    const guruNumberById = new Map(orderedAll.map((g, idx) => [g.id, idx + 1]));

    const lastGuruId = getLastGuruId(ordered);
    const lastGuru = lastGuruId ? state.peopleById.get(lastGuruId) : null;

    // If Gurus were removed, allow their nodes to animate again when re-added.
    // Keep rendered-node memory only for currently visible Gurus.
    const allowedGuruIds = new Set(ordered.map(g => g.id));
    state.renderedNodeIds = new Set(
      [...state.renderedNodeIds].filter((nodeId) => {
        const m = /^n:([^:]+):/.exec(nodeId);
        if (!m) return false;
        return allowedGuruIds.has(m[1]);
      })
    );

    // Header step/status UI was removed to save height.
    if (els.stepLabel) els.stepLabel.textContent = '';
    els.prevBtn.disabled = ordered.length <= 0;
    els.nextBtn.disabled = ordered.length >= orderedAll.length;

    if (els.prevFactBtn) els.prevFactBtn.disabled = !lastGuru || getLastGuruFactCountToShow(lastGuru) <= 0;
    if (els.nextFactBtn) {
      const max = lastGuru ? getLastGuruFactMax(lastGuru) : 0;
      const shown = lastGuru ? getLastGuruFactCountToShow(lastGuru) : 0;
      els.nextFactBtn.disabled = !lastGuru || shown >= max;
    }

    // Node specs without positions first
    const nodeSpecs = [];
    const edgeSpecs = [];

    // Prepare specs for measurement.
    // Important for stability: measure against ALL Gurus so adding a new Guru
    // doesn't change global horizontal offsets (side/date columns) for older groups.
    for (const g of orderedAll) {
      const gid = g.id;
      const n = guruNumberById.get(gid) ?? 0;
      nodeSpecs.push({ id: `n:${gid}:guru`, kind: 'guru', label: `Guru Sahib #${n}`, title: g.name, subtitle: '', x: 0, y: 0, shape: 'circle' });

      // Measurement ignores last-guru stepping: we measure all eligible fact nodes
      // so offsets remain stable while facts are revealed.
      const shownKeys = new Set(getActiveFactKeysForGuru(g));

      if (shownKeys.has('parents')) {
        nodeSpecs.push({ id: `n:${gid}:father`, kind: 'family parents father', label: 'Father', title: getPersonName(g?.family?.father ?? null), subtitle: '', x: 0, y: 0, shape: 'link' });
        nodeSpecs.push({ id: `n:${gid}:mother`, kind: 'family parents mother female', label: 'Mother', title: getPersonName(g?.family?.mother ?? null), subtitle: '', x: 0, y: 0, shape: 'link' });
      }

      if (shownKeys.has('birth')) {
        nodeSpecs.push({
          id: `n:${gid}:birth`,
          kind: 'date birth',
          label: 'Birth / Prakash',
          title: formatISODateToDMonthYYYY(g?.events?.birth?.date ?? null),
          subtitle: '',
          x: 0,
          y: 0,
          shape: 'circle'
        });
      }

      if (shownKeys.has('birthPlace')) {
        const birthPlace = (g?.events?.birth?.place ?? '').toString().trim();
        if (birthPlace) {
          nodeSpecs.push({
            id: `n:${gid}:birth_place`,
            kind: 'date birthPlace',
            label: 'Birth Place',
            title: birthPlace,
            subtitle: '',
            x: 0,
            y: 0,
            shape: 'circle'
          });
        }
      }
      if (shownKeys.has('gurgaddi')) nodeSpecs.push({ id: `n:${gid}:gurgaddi`, kind: 'date gurgaddi', label: 'Gurta Gaddi', title: formatISODateToDMonthYYYY(g?.events?.gurgaddi?.date ?? null), subtitle: '', x: 0, y: 0, shape: 'square' });
      if (shownKeys.has('death')) nodeSpecs.push({ id: `n:${gid}:death`, kind: 'date death', label: 'Joti Jot', title: formatISODateToDMonthYYYY(g?.events?.death?.date ?? null), subtitle: '', x: 0, y: 0, shape: 'diamond' });

      if (shownKeys.has('siblings')) {
        const sibs = (g?.family?.siblings ?? []).filter(Boolean);
        if (sibs.length) nodeSpecs.push({ id: `n:${gid}:siblings`, kind: 'family siblings', label: 'Siblings', title: getNames(sibs), subtitle: '', x: 0, y: 0, shape: 'link' });
      }

      if (shownKeys.has('spouse')) {
        const spouses = (g?.family?.spouses ?? []).filter(Boolean);
        if (spouses.length) nodeSpecs.push({ id: `n:${gid}:spouse`, kind: 'family spouse', label: 'Spouse', title: getNames(spouses), subtitle: '', x: 0, y: 0, shape: 'link' });
      }

      if (shownKeys.has('children')) {
        const kids = (g?.family?.children ?? []).filter(Boolean);
        if (kids.length) nodeSpecs.push({ id: `n:${gid}:children`, kind: 'family children', label: 'Children', title: getNames(kids), subtitle: '', x: 0, y: 0, shape: 'link' });
      }
    }

    // Measure
    const sizes = measureNodes(nodeSpecs);

    // Now compute positions with dynamic spacing (no overlaps)
    const canvasRect = els.canvas.getBoundingClientRect();
    const w = Math.max(360, canvasRect.width || 1200);
    const centerX = w / 2;
    const isNarrow = w < 760;

    // Keep previous groups from shifting when adding/removing Gurus.
    // If layout-affecting settings change, drop the cached vertical positions.
    const layoutKey = JSON.stringify({ isNarrow, toggles: state.toggles });
    if (state.layoutCacheKey !== layoutKey) {
      state.layoutCacheKey = layoutKey;
      state.groupTopByGuruId = new Map();
    }
    const gapX = isNarrow ? 14 : 18;
    const gapY = isNarrow ? 18 : 22;
    // Extra spacing between Guru groups (around the divider line)
    const groupPadY = (isNarrow ? 22 : 26) * 2;

    function size(id) {
      return sizes.get(id) || { w: 260, h: 56 };
    }

    function widthIfPresent(id) {
      const s = sizes.get(id);
      return s ? s.w : 0;
    }

    function heightIfPresent(id) {
      const s = sizes.get(id);
      return s ? s.h : 0;
    }

    // Determine global horizontal offsets based on measured widths
    const guruW = Math.max(240, ...ordered.map(g => widthIfPresent(`n:${g.id}:guru`) || 240));
    const spouseW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:spouse`)));
    const sibW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:siblings`)));
    const sideX = Math.ceil(((guruW + Math.max(spouseW, sibW, 0)) / 2) + 28);

    const birthW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:birth`)));
    const birthPlaceW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:birth_place`)));
    const ggdW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:gurgaddi`)));
    const deathW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:death`)));

    // Dates row (left→right): Birth/Prakash (DOB), Birth Place, Gurta Gaddi, Joti Jot.
    // Keep Gurta Gaddi centered to minimize shifting.
    const xGap = gapX + 8;
    const dBirthToGgd = Math.ceil((birthW + ggdW) / 2 + xGap);
    const dBirthPlaceToGgd = Math.ceil((birthPlaceW + ggdW) / 2 + xGap);
    const dBirthToBirthPlace = Math.ceil((birthW + birthPlaceW) / 2 + xGap);
    const dGgdToDeath = Math.ceil((deathW + ggdW) / 2 + xGap);

    const fatherW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:father`)));
    const motherW = Math.max(0, ...ordered.map(g => widthIfPresent(`n:${g.id}:mother`)));
    const parentSep = Math.ceil(Math.max((fatherW + motherW) / 2 + 30, 240));

    // Build positioned specs per guru, stacked vertically.
    // Important: do not move already-rendered groups when adding a new Guru.
    let yCursor = groupPadY;
    const positioned = [];
    const edges = [];
    const dividers = [];

    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i];
      const gid = g.id;

      const guruId = `n:${gid}:guru`;

      // Row heights depend on which nodes exist
      const isLast = lastGuruId === gid;
      const eligible = getActiveFactKeysForGuru(g);
      const count = isLast ? getLastGuruFactCountToShow(g) : eligible.length;
      const shownKeys = new Set(isLast ? eligible.slice(0, count) : eligible);

      const hasParents = shownKeys.has('parents');
      const hasDates = shownKeys.has('birth') || shownKeys.has('birthPlace') || shownKeys.has('gurgaddi') || shownKeys.has('death');
      const hasChildren = shownKeys.has('children') && ((g?.family?.children ?? []).filter(Boolean).length > 0);
      const hasSpouse = shownKeys.has('spouse') && ((g?.family?.spouses ?? []).filter(Boolean).length > 0);
      const hasSiblings = shownKeys.has('siblings') && ((g?.family?.siblings ?? []).filter(Boolean).length > 0);

      // Reserve space for parents above the Guru even before parents are revealed,
      // so the Guru node doesn't move downward when parents appear.
      const eligibleParents = !!state.toggles.parents && !!((g?.family?.father ?? null) || (g?.family?.mother ?? null));
      const parentH = eligibleParents ? Math.max(heightIfPresent(`n:${gid}:father`), heightIfPresent(`n:${gid}:mother`)) : 0;
      const datesH = hasDates ? Math.max(heightIfPresent(`n:${gid}:birth`), heightIfPresent(`n:${gid}:birth_place`), heightIfPresent(`n:${gid}:gurgaddi`), heightIfPresent(`n:${gid}:death`)) : 0;
      const childrenH = hasChildren ? heightIfPresent(`n:${gid}:children`) : 0;
      const spouseH = hasSpouse ? heightIfPresent(`n:${gid}:spouse`) : 0;
      const sibH = hasSiblings ? heightIfPresent(`n:${gid}:siblings`) : 0;
      const guruH = Math.max(size(guruId).h, spouseH, sibH);

      // Layout (parents above guru; dates below guru left→right; children below)
      const parentReserve = eligibleParents ? (parentH + gapY) : 0;

      const cachedTop = state.groupTopByGuruId.get(gid);
      const guruTop = (cachedTop !== undefined) ? cachedTop : (yCursor + parentReserve);
      if (cachedTop === undefined) state.groupTopByGuruId.set(gid, guruTop);

      const parentTop = guruTop - parentReserve;
      const datesTop = guruTop + guruH + (hasDates ? gapY : 0);
      const childrenTop = datesTop + (hasDates ? (datesH + gapY) : 0);

      // Place parents
      if (hasParents) {
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:father`), x: centerX - parentSep/2, y: parentTop });
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:mother`), x: centerX + parentSep/2, y: parentTop });
        edges.push({ from: `n:${gid}:father`, to: guruId, stroke: 'rgba(75,88,122,.55)' });
        edges.push({ from: `n:${gid}:mother`, to: guruId, stroke: 'rgba(75,88,122,.55)' });
      }

      // Place guru
      positioned.push({ ...nodeSpecs.find(n => n.id === guruId), x: centerX, y: guruTop });

      // Place spouse (right) and siblings (left)
      if (hasSpouse) {
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:spouse`), x: centerX + sideX, y: guruTop });
        edges.push({ from: guruId, to: `n:${gid}:spouse`, stroke: 'rgba(197,138,0,.55)' });
      }
      if (hasSiblings) {
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:siblings`), x: centerX - sideX, y: guruTop });
        edges.push({ from: guruId, to: `n:${gid}:siblings`, stroke: 'rgba(197,138,0,.55)' });
      }

      // Dates left→right: Birth Place, Birth/Prakash (DOB), Gurta Gaddi, Joti Jot
      if (shownKeys.has('birth')) {
        const showBirthPlace = shownKeys.has('birthPlace') && !!nodeSpecs.find(n => n.id === `n:${gid}:birth_place`);

        const birthX = (centerX - dBirthToGgd);
        const birthPlaceX = showBirthPlace ? (birthX - dBirthToBirthPlace) : null;

        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:birth`), x: birthX, y: datesTop });
        edges.push({ from: guruId, to: `n:${gid}:birth`, stroke: 'rgba(43,108,255,.55)' });

        if (showBirthPlace) {
          positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:birth_place`), x: birthPlaceX, y: datesTop });
          // Attach Birth Place to the DOB node (not to the Guru)
          edges.push({ from: `n:${gid}:birth`, to: `n:${gid}:birth_place`, stroke: 'rgba(43,108,255,.55)', mode: 'h' });
        }
      }

      if (shownKeys.has('gurgaddi')) {
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:gurgaddi`), x: centerX, y: datesTop });
        edges.push({ from: guruId, to: `n:${gid}:gurgaddi`, stroke: 'rgba(18,161,80,.55)' });
      }

      if (shownKeys.has('death')) {
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:death`), x: centerX + dGgdToDeath, y: datesTop });
        edges.push({ from: guruId, to: `n:${gid}:death`, stroke: 'rgba(216,52,79,.55)' });
      }

      // Children below
      if (hasChildren) {
        positioned.push({ ...nodeSpecs.find(n => n.id === `n:${gid}:children`), x: centerX, y: childrenTop });
        edges.push({ from: guruId, to: `n:${gid}:children`, stroke: 'rgba(18,161,80,.55)' });
      }

      // Succession line to next visible Guru (always on).
      const succId = g?.succession?.successor ?? null;
      if (succId && ordered.some(x => x.id === succId)) {
        edges.push({ from: guruId, to: `n:${succId}:guru`, stroke: 'rgba(43,108,255,.55)' });
      }

      // Advance cursor (dynamic height)
      const groupBottom = Math.max(
        guruTop + guruH,
        hasDates ? (datesTop + datesH) : (guruTop + guruH),
        hasChildren ? (childrenTop + childrenH) : 0
      );

      // Divider line between guru groups (not after last)
      if (i !== ordered.length - 1) {
        dividers.push({ y: Math.ceil(groupBottom + Math.floor(groupPadY / 2)) });
      }

      // Always keep cursor at least below the bottom of the groups we rendered.
      // This ensures new Gurus append below without shifting earlier ones.
      yCursor = Math.max(yCursor, groupBottom + groupPadY);
    }

    els.canvas.style.minHeight = `${Math.max(760, Math.ceil(yCursor + groupPadY))}px`;

    // Final render pass
    els.canvas.innerHTML = '';

    for (const d of dividers) {
      const line = document.createElement('div');
      line.className = 'groupDivider';
      line.style.top = `${d.y}px`;
      els.canvas.appendChild(line);
    }

    for (const n of positioned) {
      if (!n) continue;
      const el = makeNode(n);
      const isNew = !state.renderedNodeIds.has(n.id);
      if (isNew) {
        el.classList.add('emerge');
        state.renderedNodeIds.add(n.id);
      }
      els.canvas.appendChild(el);
    }

    requestAnimationFrame(() => {
      drawEdges(edges);
      if (state.pendingAutoScroll) {
        state.pendingAutoScroll = false;
        // Wait one more frame for layout/paint.
        requestAnimationFrame(() => scrollToTreeBottom());
      }
    });
  }

  function wireControls() {
    if (els.tabTree) els.tabTree.addEventListener('click', () => setView('tree'));
    if (els.tabAll) els.tabAll.addEventListener('click', () => setView('all'));
    if (els.tabTimeline) els.tabTimeline.addEventListener('click', () => setView('timeline'));

    if (els.timelineYear) {
      els.timelineYear.addEventListener('input', () => {
        const y = Number.parseInt(els.timelineYear.value, 10);
        if (!Number.isFinite(y)) return;
        state.timelineYear = clampTimelineYear(y);
        state.timelineTime = state.timelineYear;
        updateTimelineYearUI();
        if (state.viewMode === 'timeline') applyTimelineTime(true);
        scheduleCeilingSync();
      });
    }
    if (els.timelinePrevYear) {
      els.timelinePrevYear.addEventListener('click', () => {
        const current = Number.isFinite(state.timelineYear) ? state.timelineYear : 1460;
        state.timelineYear = Math.max(1460, current - 1);
        state.timelineTime = state.timelineYear;
        updateTimelineYearUI();
        if (state.viewMode === 'timeline') applyTimelineTime(true);
        scheduleCeilingSync();
      });
    }
    if (els.timelineNextYear) {
      els.timelineNextYear.addEventListener('click', () => {
        const current = Number.isFinite(state.timelineYear) ? state.timelineYear : 1460;
        state.timelineYear = Math.min(1720, current + 1);
        state.timelineTime = state.timelineYear;
        updateTimelineYearUI();
        if (state.viewMode === 'timeline') applyTimelineTime(true);
        scheduleCeilingSync();
      });
    }

    // Keep ceiling overlay responsive when manually scrolling.
    if (els.timelineCanvas) {
      els.timelineCanvas.addEventListener('scroll', () => scheduleCeilingSync(), { passive: true });
    }
    window.addEventListener('scroll', () => scheduleCeilingSync(), { passive: true });

    if (els.timelinePlayPause) {
      els.timelinePlayPause.addEventListener('click', () => {
        // Toggle play state. Playing only affects Timeline view.
        setTimelinePlaying(!state.timelinePlaying);
      });
    }

    els.prevBtn.addEventListener('click', () => {
      state.pendingAutoScroll = true;
      // Clear the removed Guru's fact-step state so re-adding starts from 0 facts.
      const total = sortGurus().length;
      const currentlyVisible = sortGurus().slice(0, clamp(state.visibleGurus, 0, total));
      const removedId = getLastGuruId(currentlyVisible);
      if (removedId) state.factStepByGuruId.delete(removedId);

      state.visibleGurus = Math.max(0, state.visibleGurus - 1);
      if (state.viewMode === 'all') renderAllCards();
      else render();
    });

    els.nextBtn.addEventListener('click', () => {
      state.pendingAutoScroll = true;
      const total = sortGurus().length;
      state.visibleGurus = Math.min(total, state.visibleGurus + 1);

      // New last guru starts with 0 fact steps (reveal using Fact >>)
      const visible = sortGurus().slice(0, clamp(state.visibleGurus, 0, total));
      const lastId = getLastGuruId(visible);
      if (lastId && !state.factStepByGuruId.has(lastId)) state.factStepByGuruId.set(lastId, 0);
      if (state.viewMode === 'all') renderAllCards();
      else render();
    });

    if (els.prevFactBtn) {
      els.prevFactBtn.addEventListener('click', () => {
        state.pendingAutoScroll = true;
        const total = sortGurus().length;
        const visible = sortGurus().slice(0, clamp(state.visibleGurus, 0, total));
        const lastId = getLastGuruId(visible);
        if (!lastId) return;
        const current = state.factStepByGuruId.get(lastId) ?? 0;
        state.factStepByGuruId.set(lastId, Math.max(0, current - 1));
        if (state.viewMode === 'all') renderAllCards();
        else render();
      });
    }

    if (els.nextFactBtn) {
      els.nextFactBtn.addEventListener('click', () => {
        state.pendingAutoScroll = true;
        const total = sortGurus().length;
        const visible = sortGurus().slice(0, clamp(state.visibleGurus, 0, total));
        const lastId = getLastGuruId(visible);
        if (!lastId) return;
        const guru = state.peopleById.get(lastId);
        const max = guru ? getLastGuruFactMax(guru) : 0;
        const current = state.factStepByGuruId.get(lastId) ?? 0;
        state.factStepByGuruId.set(lastId, Math.min(max, current + 1));
        if (state.viewMode === 'all') renderAllCards();
        else render();
      });
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', () => {
        state.pendingAutoScroll = true;
        state.visibleGurus = 0;
        state.renderedNodeIds = new Set();
        state.factStepByGuruId = new Map();
        state.groupTopByGuruId = new Map();
        if (state.viewMode === 'all') renderAllCards();
        else render();
      });
    }

    els.toggles.addEventListener('change', (e) => {
      // In non-tree views, controls don't apply.
      if (state.viewMode !== 'tree') return;

      state.pendingAutoScroll = true;
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      const key = target.getAttribute('data-key');
      if (!key) return;
      state.toggles[key] = target.checked;
      state.groupTopByGuruId = new Map();
      if (state.viewMode === 'all') renderAllCards();
      else render();
    });

    // Initialize toggle checkboxes
    for (const [key, val] of Object.entries(state.toggles)) {
      const input = els.toggles.querySelector(`input[data-key="${key}"]`);
      if (input) input.checked = !!val;
    }

    updateTimelineYearUI();
  }

  window.addEventListener('resize', () => updateTimelineOverlayTop());

  async function loadDataset() {
    // Dataset should be pre-loaded by the HTML page via script tag
    if (window.SIKH_GURUS_DATASET) {
      return window.SIKH_GURUS_DATASET;
    }

    // Fallback: try fetching if running on a server
    try {
      const res = await fetch('./data/sikh_gurus_family_tree.v1.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (err) {
      console.error('Failed to load dataset:', err);
      return null;
    }
  }

  async function init() {
    const data = await loadDataset();
    if (!data) {
      els.notice.classList.remove('hidden');
      return;
    }

    state.dataset = data;
    state.peopleById = new Map((data.people || []).map(p => [p.id, p]));
    state.gurus = (data.people || []).filter(p => p.type === 'guru');

    els.notice.classList.add('hidden');

    wireControls();
    // Start with no Guru nodes; user reveals with button.
    state.visibleGurus = 0;
    setView('tree');

    // Keep edges aligned if window size changes
    window.addEventListener('resize', () => {
      if (state.viewMode === 'all') renderAllCards();
      else if (state.viewMode === 'timeline') renderTimeline();
      else render();
    });
  }

  init();
})();

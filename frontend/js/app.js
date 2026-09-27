// InternDesk bootstrap — wires everything together.
// Boot loads health + directory in parallel (independent requests -> Promise.all).
import { api } from './apiClient.js';
import { store } from './store.js';
import { rail } from './rail.js';
import { toast, toastForError } from './toast.js';
import { icons } from './icons.js';
import { el, initials } from './dom.js';
import { renderSkeletons, renderDirectory } from './views/directory.js';
import { openDrawer } from './views/drawer.js';
import { openInternForm } from './views/internForm.js';

// Chaos toggle state — read by apiClient on every request.
window.__chaos = { latency: false, error: false };

function setHealth(ok, text) {
  const dot = document.getElementById('apiDot');
  const label = document.getElementById('apiHealthText');
  dot.className = `dot ${ok ? 'dot--ok' : 'dot--bad'}`;
  label.textContent = text;
  document.getElementById('footStatus').textContent = ok
    ? `API ok · ${text.replace('API ', '')}`
    : 'API unreachable';
}

// Stats strip — always computed from the UNFILTERED list so the numbers
// stay truthful while search/filters change the grid.
function countUp(elm, target) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elm.textContent = target;
    return;
  }
  const dur = 650;
  const t0 = performance.now();
  function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    elm.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateStats(list) {
  const counts = { total: list.length, active: 0, alumni: 0, pending: 0 };
  for (const intern of list) {
    if (counts[intern.status] !== undefined) counts[intern.status] += 1;
  }
  countUp(document.getElementById('statTotal'), counts.total);
  countUp(document.getElementById('statActive'), counts.active);
  countUp(document.getElementById('statAlumni'), counts.alumni);
  countUp(document.getElementById('statPending'), counts.pending);
  // Distribution strip — animated proportion segments (CSS transitions width).
  const pct = (n) => (counts.total ? `${Math.max(2, (n / counts.total) * 100)}%` : '0%');
  document.getElementById('distActive').style.width = pct(counts.active);
  document.getElementById('distAlumni').style.width = pct(counts.alumni);
  document.getElementById('distPending').style.width = pct(counts.pending);
}

async function refreshStats() {
  try {
    const res = await api.list({});
    updateStats(res.data);
  } catch {
    // Stats go stale quietly — the rail + toast already reported the failure.
  }
}

// After any mutation: reload the grid AND refresh the stats strip.
function handleChanged() {
  loadDirectory();
  refreshStats().catch(() => {});
}

async function loadDirectory() {
  const { status, q } = store.state;
  renderSkeletons();
  store.set({ loading: true });
  try {
    const params = {};
    if (status !== 'all') params.status = status;
    if (q.trim()) params.q = q.trim();
    const res = await api.list(params);
    store.set({ interns: res.data, total: res.meta.count });
    renderDirectory((id) => openDrawer(id, handleChanged));
  } catch (err) {
    // Graceful degradation: the grid keeps its last good state, user gets
    // a specific message, and the rail already flashed red/amber.
    toastForError(err);
    renderDirectory((id) => openDrawer(id, handleChanged));
  } finally {
    store.set({ loading: false }); // ALWAYS clears — success or failure
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function wireToolbar() {
  const search = document.getElementById('searchInput');
  search.addEventListener(
    'input',
    debounce(() => {
      store.set({ q: search.value });
      loadDirectory();
    }, 250)
  );

  const filters = document.getElementById('statusFilters');
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    for (const c of filters.querySelectorAll('.chip')) c.classList.remove('chip--on');
    btn.classList.add('chip--on');
    store.set({ status: btn.dataset.status });
    loadDirectory();
  });

  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    search.value = '';
    store.set({ q: '', status: 'all' });
    for (const c of filters.querySelectorAll('.chip')) {
      c.classList.toggle('chip--on', c.dataset.status === 'all');
    }
    loadDirectory();
  });

  document.getElementById('newInternBtn').querySelector('.btn-icon').innerHTML = icons.plus;
  document.getElementById('newInternBtn').addEventListener('click', () => openInternForm(handleChanged));
  document.querySelector('.search-icon').innerHTML = icons.search;

  // Card spotlight — cursor-tracked radial highlight via CSS vars.
  document.getElementById('directory').addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}

// ---------------------------------------------------------------------------
// Command palette — ⌘K / Ctrl+K. Fuzzy-find interns + run actions.
// ---------------------------------------------------------------------------
const paletteState = { items: [], active: 0 };

function paletteEntries() {
  const interns = store.state.interns || [];
  const actions = [
    { kind: 'action', label: 'New intern', sub: 'Open the create form', tag: 'Action', run: () => openInternForm(handleChanged) },
    { kind: 'action', label: 'Toggle chaos: server errors', sub: 'simulateError on every request', tag: 'Chaos', run: () => toggleChaos('chaosError') },
    { kind: 'action', label: 'Toggle chaos: 1.5s latency', sub: 'simulateLatency on every request', tag: 'Chaos', run: () => toggleChaos('chaosLatency') },
    { kind: 'filter', label: 'Show: All interns', sub: 'Reset the status filter', tag: 'Filter', run: () => setFilter('all') },
    { kind: 'filter', label: 'Show: Active only', sub: 'Filter the grid', tag: 'Filter', run: () => setFilter('active') },
    { kind: 'filter', label: 'Show: Alumni only', sub: 'Filter the grid', tag: 'Filter', run: () => setFilter('alumni') },
    { kind: 'filter', label: 'Show: Pending only', sub: 'Filter the grid', tag: 'Filter', run: () => setFilter('pending') },
  ];
  const people = interns.map((i) => ({
    kind: 'person', label: i.name, sub: `${i.role} · ${i.cohort}`, tag: i.status,
    run: () => openDrawer(i.id, handleChanged),
  }));
  return [...actions, ...people];
}

function toggleChaos(id) {
  const box = document.getElementById(id);
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change'));
}

function setFilter(status) {
  const btn = document.getElementById('statusFilters').querySelector(`[data-status="${status}"]`);
  if (btn) btn.click();
}

function renderPalette(q) {
  const list = document.getElementById('paletteList');
  list.replaceChildren();
  const needle = q.trim().toLowerCase();
  const matches = paletteEntries().filter((e) =>
    !needle || `${e.label} ${e.sub}`.toLowerCase().includes(needle)
  ).slice(0, 9);
  paletteState.items = matches;
  paletteState.active = 0;
  if (!matches.length) {
    list.appendChild(el('p', { class: 'palette-empty' }, 'Nothing found. Try a name, role, or “chaos”.'));
    return;
  }
  matches.forEach((entry, i) => {
    const item = el('button', `palette-item${i === 0 ? ' palette-item--active' : ''}`);
    item.setAttribute('role', 'option');
    if (entry.kind === 'person') item.appendChild(el('span', 'avatar', initials(entry.label)));
    const main = el('span', 'palette-item-main');
    main.appendChild(el('span', 'palette-item-name', entry.label));
    main.appendChild(el('span', 'palette-item-sub', entry.sub));
    item.appendChild(main);
    item.appendChild(el('span', 'palette-item-tag', entry.tag));
    item.addEventListener('click', () => { closePalette(); entry.run(); });
    item.addEventListener('mousemove', () => setPaletteActive(i));
    list.appendChild(item);
  });
}

function setPaletteActive(i) {
  paletteState.active = i;
  const items = document.getElementById('paletteList').querySelectorAll('.palette-item');
  items.forEach((elm, j) => elm.classList.toggle('palette-item--active', j === i));
}

function openPalette() {
  const overlay = document.getElementById('paletteOverlay');
  const input = document.getElementById('paletteInput');
  overlay.classList.remove('hidden');
  input.value = '';
  renderPalette('');
  input.focus();
}

function closePalette() {
  document.getElementById('paletteOverlay').classList.add('hidden');
}

function wirePalette() {
  const overlay = document.getElementById('paletteOverlay');
  const input = document.getElementById('paletteInput');

  // ⌘K / Ctrl+K opens the palette — the kbd hints across the UI are real.
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay.classList.contains('hidden') ? openPalette() : closePalette();
    }
    if (e.key === 'Escape') closePalette();
  });
  document.getElementById('paletteCta').addEventListener('click', openPalette);
  document.querySelector('.search-kbd').addEventListener('click', openPalette);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePalette(); });

  input.addEventListener('input', () => renderPalette(input.value));
  input.addEventListener('keydown', (e) => {
    const n = paletteState.items.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); setPaletteActive((paletteState.active + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); setPaletteActive((paletteState.active - 1 + n) % n); }
    else if (e.key === 'Enter' && n) {
      e.preventDefault();
      const entry = paletteState.items[paletteState.active];
      closePalette();
      entry.run();
    }
  });
}

function wireChaos() {
  const btn = document.getElementById('chaosBtn');
  const panel = document.getElementById('chaosPanel');
  btn.innerHTML = icons.sliders; // static trusted icon

  btn.addEventListener('click', () => {
    const open = panel.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('chaosLatency').addEventListener('change', (e) => {
    window.__chaos.latency = e.target.checked;
    toast(
      e.target.checked
        ? 'Chaos on: every request now takes ~1.5s. Watch the skeletons and the rail.'
        : 'Latency simulation off.',
      'info'
    );
  });
  document.getElementById('chaosError').addEventListener('change', (e) => {
    window.__chaos.error = e.target.checked;
    toast(
      e.target.checked
        ? 'Chaos on: every request will now fail with a simulated 500.'
        : 'Error simulation off.',
      e.target.checked ? 'warn' : 'info'
    );
  });
}

// Hero typewriter — the headline's verb types in, holds, deletes out,
// then cycles: building -> shipping -> designing -> launching.
const TYPED_WORDS = ['building', 'shipping', 'designing', 'launching'];
function startTyper() {
  const elm = document.getElementById('typedWord');
  if (!elm) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elm.textContent = TYPED_WORDS[0];
    return;
  }
  let wi = 0;
  let ci = TYPED_WORDS[0].length;
  let deleting = true;
  elm.textContent = TYPED_WORDS[0];
  (function tick() {
    const word = TYPED_WORDS[wi];
    if (!deleting) {
      ci += 1;
      elm.textContent = word.slice(0, ci);
      if (ci === word.length) {
        deleting = true;
        setTimeout(tick, 1900); // hold the full word before wiping
        return;
      }
      setTimeout(tick, 80);
      return;
    }
    ci -= 1;
    elm.textContent = word.slice(0, ci);
    if (ci === 0) {
      deleting = false;
      wi = (wi + 1) % TYPED_WORDS.length;
      setTimeout(tick, 380); // beat before the next word starts
      return;
    }
    setTimeout(tick, 42);
  })();
}

async function boot() {
  startTyper();
  wireToolbar();
  wireChaos();
  wirePalette();
  rail.signal('start');
  try {
    // Two independent requests — fetched in parallel, never awaited in a loop.
    const [health, list] = await Promise.all([api.health(), api.list({})]);
    setHealth(true, `API ok · ${health.interns} interns`);
    store.set({ interns: list.data, total: list.meta.count });
    updateStats(list.data);
    renderDirectory((id) => openDrawer(id, handleChanged));
    toast('Connected to the InternDesk API.', 'success', 2600);
  } catch (err) {
    setHealth(false);
    renderDirectory(() => {});
    document.getElementById('resultMeta').textContent = 'offline';
    toastForError(err);
  }
}

boot();

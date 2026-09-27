// Directory view — searchable/filterable intern grid with skeleton loading
// and a designed empty state. All user data rendered via textContent.
import { el, initials, avatarStyle } from '../dom.js';
import { store } from '../store.js';

function statusPill(status) {
  const pill = el('span', `pill pill--${status}`);
  pill.appendChild(el('span', 'dot'));
  pill.appendChild(el('span', null, status));
  return pill;
}

function internCard(intern, onOpen) {
  const card = el('button', 'card');
  card.type = 'button';
  card.setAttribute('aria-label', `Open ${intern.name}`);

  const top = el('div', 'card-top');
  const avatar = el('div', 'avatar', initials(intern.name));
  avatar.setAttribute('style', avatarStyle(intern.avatarSeed));
  const idcol = el('div');
  idcol.appendChild(el('div', 'card-name', intern.name));
  idcol.appendChild(el('div', 'card-role', intern.role));
  top.appendChild(avatar);
  top.appendChild(idcol);

  card.appendChild(top);
  card.appendChild(el('div', 'card-email', intern.email));

  const foot = el('div', 'card-foot');
  foot.appendChild(el('span', 'card-cohort', intern.cohort));
  foot.appendChild(statusPill(intern.status));
  card.appendChild(foot);

  card.addEventListener('click', () => onOpen(intern.id));
  return card;
}

export function renderSkeletons(count = 8) {
  const grid = document.getElementById('directory');
  grid.replaceChildren();
  for (let i = 0; i < count; i++) {
    const sk = el('div', 'sk-card');
    const top = el('div', 'card-top');
    top.appendChild(el('div', 'sk sk-avatar'));
    const col = el('div');
    col.style.flex = '1';
    col.appendChild(el('div', 'sk sk-line'));
    col.appendChild(el('div', 'sk sk-line short'));
    top.appendChild(col);
    sk.appendChild(top);
    sk.appendChild(el('div', 'sk sk-line'));
    sk.appendChild(el('div', 'sk sk-line short'));
    grid.appendChild(sk);
  }
  document.getElementById('emptyState').classList.add('hidden');
}

export function renderDirectory(onOpen) {
  const { interns } = store.state;
  const grid = document.getElementById('directory');
  const empty = document.getElementById('emptyState');
  grid.replaceChildren();

  const meta = document.getElementById('resultMeta');
  meta.textContent = `${interns.length} intern${interns.length === 1 ? '' : 's'}`;

  if (interns.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  // Scroll reveal — cards rise in as they enter the viewport, staggered.
  interns.forEach((intern, i) => {
    const card = internCard(intern, onOpen);
    card.style.transitionDelay = `${Math.min(i * 35, 420)}ms`;
    grid.appendChild(card);
    revealIO.observe(card);
  });
}

// Cards start hidden; the observer adds .in-view when each scrolls into sight.
// Fires once per card, then unobserves — no re-trigger cost.
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      revealIO.unobserve(e.target);
    }
  }
}, { threshold: 0.05, rootMargin: '0px 0px -32px 0px' });

// Tiny DOM helpers. Every user-generated string in the app flows through
// textContent (via el()) — never innerHTML of untrusted content.
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Deterministic avatar tint from the intern's avatarSeed.
export function avatarHue(seed) {
  return Number(seed || 0) % 360;
}

export function avatarStyle(seed) {
  return `background: hsl(${avatarHue(seed)}, 45%, 90%); border-color: hsl(${avatarHue(seed)}, 30%, 75%);`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

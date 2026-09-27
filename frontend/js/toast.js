// Toast system — every network failure surfaces as a real, specific,
// human-readable message. 4xx ("check what you entered") and 5xx
// ("something's wrong on our end, retry") are deliberately worded apart.
// Never a raw stack trace, never silently swallowed.
import { ApiError } from './apiClient.js';
import { icons } from './icons.js';
import { el } from './dom.js';

const KIND_ICON = { success: 'check', info: 'info', warn: 'alert', error: 'alert' };

export function toast(message, kind = 'info', ms = 5200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const node = el('div', `toast toast--${kind}`);
  node.setAttribute('role', kind === 'error' || kind === 'warn' ? 'alert' : 'status');

  const icon = el('span', 'toast-icon');
  // icons.* are static trusted constants (see icons.js) — message stays textContent.
  icon.innerHTML = icons[KIND_ICON[kind] || 'info'];
  node.appendChild(icon);
  node.appendChild(el('span', null, message));

  const close = el('button', null, '×');
  close.setAttribute('aria-label', 'Dismiss');
  close.addEventListener('click', () => node.remove());
  node.appendChild(close);

  root.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

// Translate an ApiError into the right human sentence + severity.
export function toastForError(err) {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.status >= 500) {
      toast(`Something's wrong on our end (${err.code}). Retry in a moment.`, 'error');
    } else if (err.status === 404) {
      toast(err.message, 'warn');
    } else if (err.status === 400 || err.status === 422) {
      toast(`Check what you entered — ${err.message}`, 'warn');
    } else {
      toast(err.message, 'warn');
    }
    return;
  }
  toast('Something unexpected happened. Please retry.', 'error');
}

// Network rail driver. apiClient calls rail.signal() on every real fetch:
//   'start'       -> indigo pulse while the request is in flight
//   'ok'          -> green flash on 2xx
//   'clientError' -> amber flash on 4xx
//   'serverError' -> red flash on 5xx / network failure
// Terminal states auto-clear back to idle after ~1.1s.
let resetTimer = null;

function node() {
  return document.getElementById('rail');
}

export const rail = {
  signal(kind) {
    const n = node();
    if (!n) return;
    n.className = 'rail'; // reset, so the pulse animation restarts
    void n.offsetWidth;
    if (kind === 'start') n.classList.add('rail--active');
    else if (kind === 'ok') n.classList.add('rail--ok');
    else if (kind === 'clientError') n.classList.add('rail--warn');
    else if (kind === 'serverError') n.classList.add('rail--err');
    clearTimeout(resetTimer);
    if (kind !== 'start') {
      resetTimer = setTimeout(() => {
        const m = node();
        if (m) m.className = 'rail';
      }, 1100);
    }
  },
};

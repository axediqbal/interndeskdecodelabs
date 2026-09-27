// Minimal pub/sub store for directory state. Views subscribe; actions set().
const listeners = new Set();

export const store = {
  state: {
    interns: [],
    status: 'all', // 'all' | 'active' | 'alumni' | 'pending'
    q: '',
    loading: false,
    total: 0,
  },
  set(patch) {
    Object.assign(this.state, patch);
    for (const fn of listeners) fn(this.state);
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Custom-drawn line icons (stroke = currentColor). These are static, trusted
// constants — user data is never interpolated into them.
const wrap = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons = {
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  x: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  pencil: wrap('<path d="M4 20l4-1 11-11a2.4 2.4 0 0 0-3.4-3.4L4 16l0 4z"/><path d="M13.5 6.5l3.4 3.4"/>'),
  trash: wrap('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13"/>'),
  check: wrap('<path d="M4 12.5l5 5L20 6.5"/>'),
  alert: wrap('<path d="M12 3l10 17H2L12 3z"/><path d="M12 10v4M12 17.5v.5"/>'),
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>'),
  sliders: wrap('<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>'),
  refresh: wrap('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/>'),
};

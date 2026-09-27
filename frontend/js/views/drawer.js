// Intern detail drawer — view + inline PATCH edit + full PUT edit + DELETE.
// Every action carries its own micro-loading state on just that control:
// try/catch/finally, and finally ALWAYS clears the busy state.
import { api, ApiError } from '../apiClient.js';
import { el, fmtDate } from '../dom.js';
import { icons } from '../icons.js';
import { toast, toastForError } from '../toast.js';

const STATUSES = ['active', 'alumni', 'pending'];

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));
}

function busyBtn(label, kind = 'btn-ghost') {
  const btn = el('button', `btn ${kind}`);
  btn.type = 'button';
  const spin = el('span', 'mini-spin');
  spin.innerHTML = icons.refresh; // static trusted icon
  const text = el('span', 'btn-label', label);
  btn.appendChild(spin);
  btn.appendChild(text);
  return btn;
}

function kvRow(term, value) {
  const dt = el('dt', null, term);
  const dd = el('dd', null, value ?? '—');
  return [dt, dd];
}

function closeDrawer() {
  document.getElementById('drawerRoot').replaceChildren();
}

// onChanged: callback to refresh the directory after a mutation
export async function openDrawer(id, onChanged) {
  const root = document.getElementById('drawerRoot');
  root.replaceChildren();

  const overlay = el('div', 'overlay');
  const drawer = el('div', 'drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'Intern details');

  const head = el('div', 'drawer-head');
  head.appendChild(el('h2', null, 'Intern'));
  const closeBtn = el('button', 'icon-btn');
  closeBtn.setAttribute('aria-label', 'Close panel');
  closeBtn.innerHTML = icons.x; // static trusted icon
  closeBtn.addEventListener('click', closeDrawer);
  head.appendChild(closeBtn);
  drawer.appendChild(head);

  const body = el('div', 'drawer-body');
  const foot = el('div', 'drawer-foot');
  drawer.appendChild(body);
  drawer.appendChild(foot);
  root.appendChild(overlay);
  root.appendChild(drawer);
  overlay.addEventListener('click', closeDrawer);

  // Loading state inside the drawer while the record loads.
  const loadingNote = el('p', 'mono', 'Loading intern…');
  loadingNote.style.color = 'var(--muted)';
  body.appendChild(loadingNote);

  let intern;
  try {
    const res = await api.get(id);
    intern = res.data;
  } catch (err) {
    body.replaceChildren();
    body.appendChild(el('p', null, 'Could not load this intern.'));
    toastForError(err);
    return;
  } finally {
    loadingNote.remove();
  }

  renderView();

  function renderView() {
    body.replaceChildren();
    foot.replaceChildren();

    const title = el('h2', null, intern.name);
    title.style.fontSize = '26px';
    body.appendChild(title);
    body.appendChild(el('p', 'mono', `#${intern.id} · ${intern.role} · ${intern.cohort}`)).style.color =
      'var(--muted)';

    const dl = el('dl', 'kv');
    for (const [t, v] of [
      kvRow('email', intern.email),
      kvRow('phone', intern.phone),
      kvRow('status', intern.status),
      kvRow('started', fmtDate(intern.startDate)),
    ]) {
      dl.appendChild(t);
      dl.appendChild(v);
    }
    body.appendChild(dl);

    // Inline edit: PATCH just the status (the most common mutation).
    body.appendChild(el('div', 'section-title', 'Quick update — status'));
    const inline = el('div', 'inline-edit');
    const select = el('select');
    select.setAttribute('aria-label', 'Status');
    for (const s of STATUSES) {
      const opt = el('option', null, s);
      opt.value = s;
      if (s === intern.status) opt.selected = true;
      select.appendChild(opt);
    }
    const saveBtn = busyBtn('Save', 'btn-ghost');
    saveBtn.addEventListener('click', async () => {
      setBusy(saveBtn, true);
      try {
        const res = await api.update(intern.id, { status: select.value });
        intern = res.data;
        toast(`Status updated to ${intern.status}.`, 'success');
        onChanged();
        renderView();
      } catch (err) {
        toastForError(err);
      } finally {
        setBusy(saveBtn, false); // always clears, success or failure
      }
    });
    inline.appendChild(select);
    inline.appendChild(saveBtn);
    const wrap = el('div', 'field');
    wrap.appendChild(inline);
    body.appendChild(wrap);

    const editBtn = busyBtn('Edit all fields', 'btn-ghost');
    editBtn.addEventListener('click', () => renderEdit());
    const delBtn = busyBtn('Delete', 'btn-ghost');
    delBtn.addEventListener('click', () => renderConfirmDelete());
    foot.appendChild(editBtn);
    foot.appendChild(delBtn);
  }

  function renderEdit() {
    body.replaceChildren();
    foot.replaceChildren();
    body.appendChild(el('div', 'section-title', 'Full edit — replaces the record (PUT)'));

    const grid = el('div', 'form-grid');
    const fields = {};
    const defs = [
      ['name', 'Name', 'text', true],
      ['email', 'Email', 'email', true],
      ['cohort', 'Cohort', 'text', true],
      ['role', 'Role', 'text', true],
      ['phone', 'Phone', 'text', false],
      ['startDate', 'Start date', 'date', false],
    ];
    for (const [key, label, type] of defs) {
      const f = el('div', 'field');
      f.appendChild(el('label', null, label));
      const input = el('input');
      input.type = type;
      input.value = intern[key] ?? '';
      f.appendChild(input);
      f.appendChild(el('div', 'field-error'));
      fields[key] = { input, error: f.querySelector('.field-error') };
      grid.appendChild(f);
    }
    const statusField = el('div', 'field');
    statusField.appendChild(el('label', null, 'Status'));
    const statusSel = el('select');
    for (const s of STATUSES) {
      const opt = el('option', null, s);
      opt.value = s;
      if (s === intern.status) opt.selected = true;
      statusSel.appendChild(opt);
    }
    statusField.appendChild(statusSel);
    statusField.appendChild(el('div', 'field-error'));
    grid.appendChild(statusField);
    fields.status = { input: statusSel, error: statusField.querySelector('.field-error') };
    body.appendChild(grid);

    const saveBtn = busyBtn('Save changes', 'btn-primary');
    const backBtn = busyBtn('Back', 'btn-ghost');
    backBtn.addEventListener('click', renderView);
    foot.appendChild(backBtn);
    foot.appendChild(saveBtn);

    saveBtn.addEventListener('click', async () => {
      // Clear previous server errors first.
      for (const k of Object.keys(fields)) {
        fields[k].error.textContent = '';
        fields[k].input.classList.remove('invalid');
      }
      const payload = {
        name: fields.name.input.value,
        email: fields.email.input.value,
        cohort: fields.cohort.input.value,
        role: fields.role.input.value,
        phone: fields.phone.input.value,
        startDate: fields.startDate.input.value,
        status: fields.status.input.value,
      };
      setBusy(saveBtn, true);
      try {
        const res = await api.replace(intern.id, payload);
        intern = res.data;
        toast('Intern updated.', 'success');
        onChanged();
        renderView();
      } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.fields) {
          // Map 422 per-field errors back onto the form — not a generic toast.
          for (const [field, msg] of Object.entries(err.fields)) {
            if (fields[field]) {
              fields[field].error.textContent = msg;
              fields[field].input.classList.add('invalid');
            }
          }
          toast('Check what you entered — some fields need attention.', 'warn');
        } else {
          toastForError(err);
        }
      } finally {
        setBusy(saveBtn, false);
      }
    });
  }

  function renderConfirmDelete() {
    foot.replaceChildren();
    const strip = el('div', 'confirm-strip');
    strip.appendChild(el('p', null, `Delete ${intern.name}? This cannot be undone.`));
    const yes = busyBtn('Yes, delete', 'btn-danger');
    const no = busyBtn('Keep', 'btn-ghost');
    no.addEventListener('click', renderView);
    yes.addEventListener('click', async () => {
      setBusy(yes, true);
      try {
        await api.remove(intern.id); // 204 — no body
        toast(`${intern.name} deleted.`, 'success');
        closeDrawer();
        onChanged();
      } catch (err) {
        toastForError(err);
      } finally {
        setBusy(yes, false);
      }
    });
    strip.appendChild(no);
    strip.appendChild(yes);
    foot.appendChild(strip);
  }
}

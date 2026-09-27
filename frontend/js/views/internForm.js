// New-intern modal — POST with client-side validation first, then server
// validation errors mapped back per-field from the 422 envelope.
import { api, ApiError } from '../apiClient.js';
import { el } from '../dom.js';
import { icons } from '../icons.js';
import { toast, toastForError } from '../toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = ['Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'UI/UX Designer', 'QA Engineer', 'DevOps Intern'];
const STATUSES = ['pending', 'active', 'alumni'];

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));
}

// onCreated: callback so the directory refreshes after a 201
export function openInternForm(onCreated) {
  const root = document.getElementById('modalRoot');
  root.replaceChildren();

  const overlay = el('div', 'overlay');
  const wrap = el('div', 'modal-wrap');
  const modal = el('div', 'modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'New intern');

  const head = el('div', 'modal-head');
  head.appendChild(el('h2', null, 'New intern'));
  const closeBtn = el('button', 'icon-btn');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icons.x; // static trusted icon
  const close = () => root.replaceChildren();
  closeBtn.addEventListener('click', close);
  head.appendChild(closeBtn);

  const body = el('div', 'modal-body');
  const grid = el('div', 'form-grid');
  const fields = {};

  function addField(key, label, { type = 'text', options = null, full = false } = {}) {
    const f = el('div', full ? 'field field--full' : 'field');
    const lab = el('label', null, label);
    f.appendChild(lab);
    let input;
    if (options) {
      input = el('select');
      for (const o of options) {
        const opt = el('option', null, o);
        opt.value = o;
        input.appendChild(opt);
      }
    } else {
      input = el('input');
      input.type = type;
      if (type === 'date') input.value = new Date().toISOString().slice(0, 10);
    }
    lab.htmlFor = `ni-${key}`;
    input.id = `ni-${key}`;
    f.appendChild(input);
    const err = el('div', 'field-error');
    f.appendChild(err);
    fields[key] = { input, error: err };
    grid.appendChild(f);
  }

  addField('name', 'Name *');
  addField('email', 'Email *', { type: 'email' });
  addField('cohort', 'Cohort *', { full: false });
  addField('role', 'Role *', { options: ROLES });
  addField('phone', 'Phone');
  addField('startDate', 'Start date', { type: 'date' });
  addField('status', 'Status', { options: STATUSES });
  fields.cohort.input.placeholder = 'e.g. Batch 2026';

  body.appendChild(grid);

  const foot = el('div', 'modal-foot');
  const cancel = el('button', 'btn btn-ghost', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', close);
  const submit = el('button', 'btn btn-primary');
  submit.type = 'button';
  const spin = el('span', 'mini-spin');
  spin.innerHTML = icons.refresh; // static trusted icon
  submit.appendChild(spin);
  submit.appendChild(el('span', 'btn-label', 'Create intern'));
  foot.appendChild(cancel);
  foot.appendChild(submit);

  modal.appendChild(head);
  modal.appendChild(body);
  modal.appendChild(foot);
  wrap.appendChild(modal);
  root.appendChild(overlay);
  root.appendChild(wrap);
  overlay.addEventListener('click', close);
  fields.name.input.focus();

  function clientValidate(values) {
    const errors = {};
    if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
    if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Enter a valid email address.';
    if (!values.cohort.trim()) errors.cohort = 'Cohort is required.';
    if (!values.role.trim()) errors.role = 'Role is required.';
    return errors;
  }

  submit.addEventListener('click', async () => {
    for (const k of Object.keys(fields)) {
      fields[k].error.textContent = '';
      fields[k].input.classList.remove('invalid');
    }
    const values = {
      name: fields.name.input.value,
      email: fields.email.input.value,
      cohort: fields.cohort.input.value,
      role: fields.role.input.value,
      phone: fields.phone.input.value,
      startDate: fields.startDate.input.value,
      status: fields.status.input.value,
    };

    // Client-side validation BEFORE the request is ever sent.
    const clientErrors = clientValidate(values);
    if (Object.keys(clientErrors).length) {
      for (const [field, msg] of Object.entries(clientErrors)) {
        fields[field].error.textContent = msg;
        fields[field].input.classList.add('invalid');
      }
      return;
    }

    setBusy(submit, true);
    try {
      const res = await api.create(values); // 201
      toast(`${res.data.name} added to the directory.`, 'success');
      close();
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.fields) {
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
      setBusy(submit, false); // always clears, success or failure
    }
  });
}

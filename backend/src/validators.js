// Input validation — shared by POST (full), PUT (full) and PATCH (partial).
// Returns a { field: message } map; empty object means valid.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['active', 'alumni', 'pending'];

export function validateIntern(body, { partial = false } = {}) {
  const errors = {};
  const src = body && typeof body === 'object' ? body : {};

  // For PATCH, only validate fields the client actually sent.
  const need = (field) => !partial || src[field] !== undefined;

  if (need('name')) {
    if (typeof src.name !== 'string' || src.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }
  }
  if (need('email')) {
    if (typeof src.email !== 'string' || !EMAIL_RE.test(src.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
  }
  if (need('cohort')) {
    if (typeof src.cohort !== 'string' || src.cohort.trim().length === 0) {
      errors.cohort = 'Cohort is required.';
    }
  }
  if (need('role')) {
    if (typeof src.role !== 'string' || src.role.trim().length === 0) {
      errors.role = 'Role is required.';
    }
  }
  if (src.status !== undefined && !STATUSES.includes(src.status)) {
    errors.status = 'Status must be active, alumni, or pending.';
  }
  if (src.startDate !== undefined && src.startDate !== null && src.startDate !== '') {
    if (!DATE_RE.test(src.startDate) || Number.isNaN(Date.parse(src.startDate))) {
      errors.startDate = 'Start date must be YYYY-MM-DD.';
    }
  }
  if (src.phone !== undefined && src.phone !== null && src.phone !== '') {
    if (typeof src.phone !== 'string' || src.phone.trim().length < 7) {
      errors.phone = 'Phone number looks too short.';
    }
  }
  if (partial && Object.keys(src).length === 0) {
    errors._ = 'Nothing to update — send at least one field.';
  }
  return errors;
}

export const INTERN_STATUSES = STATUSES;

// apiClient — the ONLY place in the codebase that calls fetch().
// Centralizes: base URL, JSON headers, error-envelope parsing, the custom
// ApiError, chaos query params, and network-rail signalling.
//
// Engineering rules honored here:
//  - async/await only (no .then chains)
//  - response.ok is checked BEFORE response.json()
//  - failures throw ApiError carrying the server's error envelope
import { rail } from './rail.js';

const API_BASE = ''; // same origin (Express serves the frontend)

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = network failure (no HTTP status at all)
    this.code = code;     // e.g. NOT_FOUND, VALIDATION_FAILED, SIMULATED_FAILURE
    this.fields = fields || null; // per-field map on 422
  }
}

// Chaos toggle state lives on window so any module can read it.
function chaosParams(into) {
  const chaos = window.__chaos || {};
  if (chaos.latency) into.set('simulateLatency', '1500');
  if (chaos.error) into.set('simulateError', 'true');
}

async function readEnvelope(res) {
  try {
    const json = await res.json();
    if (json && json.error) return json.error;
  } catch {
    // non-JSON error body — fall through to the generic message
  }
  return null;
}

export async function request(method, path, { query = {}, body } = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  chaosParams(qs);
  const url = `${API_BASE}/api${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  rail.signal('start');
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkErr) {
    // The request never got an HTTP response (server down, offline, CORS…).
    rail.signal('serverError');
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and retry.'
    );
  }

  if (!res.ok) {
    const env = await readEnvelope(res);
    rail.signal(res.status >= 500 ? 'serverError' : 'clientError');
    throw new ApiError(
      res.status,
      (env && env.code) || 'REQUEST_FAILED',
      (env && env.message) || `Request failed with status ${res.status}.`,
      env && env.fields
    );
  }

  rail.signal('ok');
  if (res.status === 204) return null; // DELETE — no body by design
  return res.json();
}

export const api = {
  health: () => request('GET', '/health'),
  list: (params) => request('GET', '/interns', { query: params || {} }),
  get: (id) => request('GET', `/interns/${encodeURIComponent(id)}`),
  create: (data) => request('POST', '/interns', { body: data }),
  replace: (id, data) => request('PUT', `/interns/${encodeURIComponent(id)}`, { body: data }),
  update: (id, data) => request('PATCH', `/interns/${encodeURIComponent(id)}`, { body: data }),
  remove: (id) => request('DELETE', `/interns/${encodeURIComponent(id)}`),
};

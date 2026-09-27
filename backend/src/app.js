import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, rowToIntern } from './db.js';
import { seedIfEmpty } from './seed.js';
import { validateIntern } from './validators.js';

await seedIfEmpty();

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Explicit CORS — the brief demands Access-Control-Allow-Origin set correctly.
// Same-origin in production use; override with FRONTEND_ORIGIN (comma-sep).
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '64kb' }));

// Tiny request log — every real status code visible in the terminal.
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t}ms)`);
  });
  next();
});

// ---------------------------------------------------------------------------
// Chaos simulator — deliberately slow / deliberately failing variants.
// Documented demo hooks (see README), not hidden behaviour.
//   GET /api/interns?simulateLatency=1500   -> waits 1500ms before responding
//   GET /api/interns?simulateError=true     -> responds 500 with error envelope
// Applies to every /api/interns route so the Chaos toggle demos any action.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5000)));

app.use('/api/interns', async (req, res, next) => {
  try {
    if (req.query.simulateError === 'true') {
      return res.status(500).json({
        error: {
          code: 'SIMULATED_FAILURE',
          message: 'Simulated server failure (chaos toggle). Nothing is actually broken.',
        },
      });
    }
    if (req.query.simulateLatency !== undefined) {
      const ms = Math.max(0, parseInt(req.query.simulateLatency, 10) || 0);
      if (ms > 0) await sleep(ms);
    }
    next();
  } catch (e) {
    next(e);
  }
});

const api = express.Router();

const notFound = (id) => ({
  error: { code: 'NOT_FOUND', message: `Intern #${id} does not exist.` },
});
const invalid = (fields) => ({
  error: { code: 'VALIDATION_FAILED', message: 'Some fields need attention.', fields },
});

// Health — used by the frontend's API-health dot on boot.
api.get('/health', async (req, res, next) => {
  try {
    const { rows } = await db.execute('SELECT COUNT(*) AS c FROM interns');
    res.json({ status: 'ok', interns: rows[0].c, time: new Date().toISOString() });
  } catch (e) {
    next(e);
  }
});

// GET /api/interns?status=&q= — list with filter + search
api.get('/interns', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const clauses = [];
    const params = [];
    if (status !== undefined && status !== '') {
      if (!['active', 'alumni', 'pending'].includes(status)) {
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: `Unknown status filter: "${status}".` } });
      }
      clauses.push('status = ?');
      params.push(status);
    }
    if (q !== undefined && q !== '') {
      clauses.push('(name LIKE ? OR email LIKE ? OR role LIKE ? OR cohort LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await db.execute({
      sql: `SELECT * FROM interns ${where} ORDER BY id ASC`,
      args: params,
    });
    res.json({ data: rows.map(rowToIntern), meta: { count: rows.length } });
  } catch (e) {
    next(e);
  }
});

// GET /api/interns/:id — single record
api.get('/interns/:id', async (req, res, next) => {
  try {
    const { rows } = await db.execute({
      sql: 'SELECT * FROM interns WHERE id = ?',
      args: [req.params.id],
    });
    const row = rows[0];
    if (!row) return res.status(404).json(notFound(req.params.id));
    res.json({ data: rowToIntern(row) });
  } catch (e) {
    next(e);
  }
});

// POST /api/interns — create (201 / 422)
api.post('/interns', async (req, res, next) => {
  try {
    const errors = validateIntern(req.body);
    if (Object.keys(errors).length) return res.status(422).json(invalid(errors));
    const b = req.body;
    let id;
    try {
      const r = await db.execute({
        sql: `INSERT INTO interns (name, email, cohort, role, status, startDate, phone, avatarSeed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          b.name.trim(),
          b.email.trim().toLowerCase(),
          b.cohort.trim(),
          b.role.trim(),
          b.status || 'pending',
          b.startDate || new Date().toISOString().slice(0, 10),
          b.phone && b.phone.trim() ? b.phone.trim() : null,
          Math.floor(Math.random() * 1_000_000),
        ],
      });
      id = Number(r.lastInsertRowid);
    } catch (e) {
      if (String(e.message).includes('UNIQUE constraint failed')) {
        return res.status(422).json(invalid({ email: 'This email is already in the directory.' }));
      }
      throw e;
    }
    const { rows } = await db.execute({
      sql: 'SELECT * FROM interns WHERE id = ?',
      args: [id],
    });
    res.status(201).json({ data: rowToIntern(rows[0]) });
  } catch (e) {
    next(e);
  }
});

// PUT /api/interns/:id — full replace (200 / 404 / 422)
api.put('/interns/:id', async (req, res, next) => {
  try {
    const errors = validateIntern(req.body);
    if (Object.keys(errors).length) return res.status(422).json(invalid(errors));
    const { rows: found } = await db.execute({
      sql: 'SELECT * FROM interns WHERE id = ?',
      args: [req.params.id],
    });
    const existing = found[0];
    if (!existing) return res.status(404).json(notFound(req.params.id));
    const b = req.body;
    try {
      await db.execute({
        sql: `UPDATE interns
              SET name = ?, email = ?, cohort = ?, role = ?, status = ?, startDate = ?, phone = ?
              WHERE id = ?`,
        args: [
          b.name.trim(),
          b.email.trim().toLowerCase(),
          b.cohort.trim(),
          b.role.trim(),
          b.status || 'pending',
          b.startDate || existing.startDate,
          b.phone && b.phone.trim() ? b.phone.trim() : null,
          req.params.id,
        ],
      });
    } catch (e) {
      if (String(e.message).includes('UNIQUE constraint failed')) {
        return res.status(422).json(invalid({ email: 'This email is already in the directory.' }));
      }
      throw e;
    }
    const { rows } = await db.execute({
      sql: 'SELECT * FROM interns WHERE id = ?',
      args: [req.params.id],
    });
    res.json({ data: rowToIntern(rows[0]) });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/interns/:id — partial update (200 / 404 / 422)
api.patch('/interns/:id', async (req, res, next) => {
  try {
    const errors = validateIntern(req.body, { partial: true });
    if (Object.keys(errors).length) return res.status(422).json(invalid(errors));
    const { rows: found } = await db.execute({
      sql: 'SELECT * FROM interns WHERE id = ?',
      args: [req.params.id],
    });
    const existing = found[0];
    if (!existing) return res.status(404).json(notFound(req.params.id));

    const allowed = ['name', 'email', 'cohort', 'role', 'status', 'startDate', 'phone'];
    const sets = [];
    const params = [];
    for (const f of allowed) {
      if (req.body[f] === undefined) continue;
      let v = req.body[f];
      if (typeof v === 'string') v = v.trim();
      if (f === 'email' && v) v = v.toLowerCase();
      if ((f === 'phone' || f === 'startDate') && v === '') v = null;
      sets.push(`${f} = ?`);
      params.push(v);
    }
    try {
      await db.execute({
        sql: `UPDATE interns SET ${sets.join(', ')} WHERE id = ?`,
        args: [...params, req.params.id],
      });
    } catch (e) {
      if (String(e.message).includes('UNIQUE constraint failed')) {
        return res.status(422).json(invalid({ email: 'This email is already in the directory.' }));
      }
      throw e;
    }
    const { rows } = await db.execute({
      sql: 'SELECT * FROM interns WHERE id = ?',
      args: [req.params.id],
    });
    res.json({ data: rowToIntern(rows[0]) });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/interns/:id — remove (204 / 404)
api.delete('/interns/:id', async (req, res, next) => {
  try {
    const r = await db.execute({
      sql: 'DELETE FROM interns WHERE id = ?',
      args: [req.params.id],
    });
    if (r.rowsAffected === 0) return res.status(404).json(notFound(req.params.id));
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

app.use('/api', api);

// Unknown API routes still speak the envelope — never an HTML 404.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Unknown API route: ${req.method} ${req.path}` },
  });
});

// ---------------------------------------------------------------------------
// Frontend — served statically by the same process. One command runs everything.
// ---------------------------------------------------------------------------
const FRONTEND_DIR = path.join(here, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// Central error handler: malformed JSON -> 400, everything else -> 500 envelope.
// Stack traces are logged server-side only — never sent to the client.
app.use((err, req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON.' } });
  }
  console.error('[InternDesk]', err);
  if (res.headersSent) return;
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: "Something's wrong on our end. Please retry." },
  });
});

export default app;

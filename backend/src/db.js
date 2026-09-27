// DB layer — libsql, the SQLite-compatible client.
//
// Local dev (no env vars): a plain file DB in backend/data — zero config,
// zero accounts, exactly like before.
// Vercel: set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) and every query
// transparently hits the hosted Turso database instead, because Vercel's
// filesystem is read-only and a local SQLite file can't take writes there.
import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function localFile() {
  // Normal case: backend/data next to the source (local dev, persistent).
  // Vercel's filesystem is read-only, so fall back to /tmp (ephemeral per
  // instance) with a loud warning — setting TURSO_DATABASE_URL removes this.
  const primary = path.join(here, '..', 'data');
  try {
    fs.mkdirSync(primary, { recursive: true });
    fs.accessSync(primary, fs.constants.W_OK);
    return path.join(primary, 'interndesk.sqlite');
  } catch {
    const tmp = path.join('/tmp', 'interndesk-data');
    fs.mkdirSync(tmp, { recursive: true });
    console.log('[InternDesk] WARNING: read-only filesystem — using ephemeral /tmp database. Set TURSO_DATABASE_URL for persistence.');
    return path.join(tmp, 'interndesk.sqlite');
  }
}

function connect() {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) {
    console.log('[InternDesk] using Turso database');
    return createClient({ url: remote, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const fileUrl = pathToFileURL(localFile()).href;
  return createClient({ url: fileUrl });
}

export const db = connect();

await db.execute(`
  CREATE TABLE IF NOT EXISTS interns (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    cohort     TEXT NOT NULL,
    role       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('active', 'alumni', 'pending')),
    startDate  TEXT NOT NULL,
    phone      TEXT,
    avatarSeed INTEGER NOT NULL
  )
`);

// DB row -> public Intern shape. Single place so the API never leaks internals.
export function rowToIntern(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    cohort: row.cohort,
    role: row.role,
    status: row.status,
    startDate: row.startDate,
    phone: row.phone ?? null,
    avatarSeed: row.avatarSeed,
  };
}

// Seed data — 18 fictional DecodeLabs interns. Inserted once, only when the
// table is empty, so user-created interns are never wiped on restart.
import { db, rowToIntern } from './db.js';

// [name, email, cohort, role, status, startDate, phone]
const SEED = [
  ['Areeba Khan',    'areeba.khan@decodelabs.io',    'Batch 2026', 'Frontend Developer',  'active',  '2026-01-12', '+92 333 1234567'],
  ['Bilal Ahmed',    'bilal.ahmed@decodelabs.io',    'Batch 2026', 'Backend Developer',   'active',  '2026-01-12', '+92 300 2345678'],
  ['Sana Malik',     'sana.malik@decodelabs.io',     'Batch 2026', 'UI/UX Designer',      'active',  '2026-01-19', null],
  ['Usman Tariq',    'usman.tariq@decodelabs.io',    'Batch 2026', 'Full-Stack Developer','pending', '2026-02-02', '+92 321 3456789'],
  ['Hira Shahid',    'hira.shahid@decodelabs.io',    'Batch 2025', 'QA Engineer',         'active',  '2025-09-08', '+92 302 4567890'],
  ['Danish Ali',     'danish.ali@decodelabs.io',     'Batch 2025', 'DevOps Intern',       'active',  '2025-09-08', null],
  ['Mahnoor Fatima', 'mahnoor.fatima@decodelabs.io', 'Batch 2025', 'Frontend Developer',  'alumni',  '2025-03-10', '+92 334 5678901'],
  ['Fahad Raza',     'fahad.raza@decodelabs.io',     'Batch 2026', 'Backend Developer',   'pending', '2026-02-16', null],
  ['Zainab Qureshi', 'zainab.qureshi@decodelabs.io', 'Batch 2026', 'UI/UX Designer',      'active',  '2026-01-19', '+92 345 6789012'],
  ['Hamza Sheikh',   'hamza.sheikh@decodelabs.io',   'Batch 2025', 'Full-Stack Developer','alumni',  '2025-03-10', '+92 311 7890123'],
  ['Iqra Nawaz',     'iqra.nawaz@decodelabs.io',     'Batch 2025', 'QA Engineer',         'alumni',  '2025-09-08', null],
  ['Owais Farooq',   'owais.farooq@decodelabs.io',   'Batch 2026', 'Frontend Developer',  'active',  '2026-03-02', '+92 322 8901234'],
  ['Sadia Anwar',    'sadia.anwar@decodelabs.io',    'Batch 2026', 'Backend Developer',   'pending', '2026-03-02', null],
  ['Taha Mehmood',   'taha.mehmood@decodelabs.io',   'Batch 2025', 'DevOps Intern',       'active',  '2025-09-15', '+92 303 9012345'],
  ['Ayesha Siddiqui','ayesha.siddiqui@decodelabs.io','Batch 2025', 'Full-Stack Developer','alumni',  '2025-03-10', '+92 313 0123456'],
  ['Rehan Javed',    'rehan.javed@decodelabs.io',    'Batch 2026', 'QA Engineer',         'active',  '2026-02-16', null],
  ['Nimra Tariq',    'nimra.tariq@decodelabs.io',    'Batch 2026', 'UI/UX Designer',      'pending', '2026-03-09', '+92 324 1234509'],
  ['Shahzaib Alam',  'shahzaib.alam@decodelabs.io',  'Batch 2026', 'Backend Developer',   'active',  '2026-01-12', '+92 335 2345610'],
];

export async function seedIfEmpty() {
  const { rows } = await db.execute('SELECT COUNT(*) AS c FROM interns');
  if (rows[0].c > 0) return;

  for (let i = 0; i < SEED.length; i++) {
    const [name, email, cohort, role, status, startDate, phone] = SEED[i];
    await db.execute({
      sql: `INSERT INTO interns (name, email, cohort, role, status, startDate, phone, avatarSeed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [name, email, cohort, role, status, startDate, phone, 1000 + i * 137],
    });
  }
  console.log(`[InternDesk] seeded ${SEED.length} interns`);
}

export { rowToIntern };

// Creates or updates the unit accounts listed in accounts.json (gitignored).
// Only PBKDF2 hashes are written to D1; plaintext passwords never leave this machine.
//
//   node scripts/seed-users.mjs --local    # wrangler dev database
//   node scripts/seed-users.mjs --remote   # deployed Cloudflare database
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.argv[2];
if (target !== '--local' && target !== '--remote') {
  console.error('Usage: node scripts/seed-users.mjs --local|--remote');
  process.exit(1);
}

// Must match worker/auth.ts
const ITERATIONS = 100_000;
const hash = (password) => {
  const salt = randomBytes(16);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${key.toString('base64')}`;
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const accounts = JSON.parse(readFileSync(new URL('../accounts.json', import.meta.url), 'utf8'));
const sql = accounts.map((a, i) =>
  `INSERT INTO users (email, unit_name, color, password_hash, is_admin, sort_order)
   VALUES (${q(a.email.toLowerCase())}, ${q(a.unit)}, ${q(a.color)}, ${q(hash(a.password))}, ${a.admin ? 1 : 0}, ${i})
   ON CONFLICT(email) DO UPDATE SET unit_name = excluded.unit_name, color = excluded.color,
     password_hash = excluded.password_hash, is_admin = excluded.is_admin, sort_order = excluded.sort_order;`,
).join('\n');

const dir = mkdtempSync(join(tmpdir(), 'scout-seed-'));
const file = join(dir, 'seed.sql');
writeFileSync(file, sql);
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'scout-calendar', target, '--file', file], {
    stdio: 'inherit',
  });
  console.log(`Seeded ${accounts.length} accounts (${target.slice(2)}).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

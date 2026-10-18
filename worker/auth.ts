// Password hashes are stored as "pbkdf2$<iterations>$<salt b64>$<hash b64>".
// scripts/seed-users.mjs produces the same format with node:crypto.
const ITERATIONS = 100_000; // Workers caps PBKDF2 at 100k iterations
const SESSION_DAYS = 30;

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !expected) return false;
  const actual = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const want = unb64(expected);
  if (actual.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ want[i];
  return diff === 0;
}

export async function createSession(db: D1Database, userId: number) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, Date.now() + maxAge * 1000).run();
  return { token, maxAge };
}

export type User = {
  id: number;
  email: string;
  unit_name: string;
  color: string;
  is_admin: number;
};

export async function getSessionUser(db: D1Database, token: string): Promise<User | null> {
  return db.prepare(
    `SELECT u.id, u.email, u.unit_name, u.color, u.is_admin
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
  ).bind(token, Date.now()).first<User>();
}

export async function deleteSession(db: D1Database, token: string) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  createSession, deleteSession, getSessionUser, verifyPassword, type User,
} from './auth';

type Env = { DB: D1Database; ASSETS: Fetcher };
const COOKIE = 'session';

const app = new Hono<{ Bindings: Env; Variables: { user: User } }>().basePath('/api');

const publicUser = (u: User) => ({
  id: u.id, email: u.email, unitName: u.unit_name, color: u.color, isAdmin: !!u.is_admin,
});

app.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(String(email ?? '').trim().toLowerCase())
    .first<User & { password_hash: string }>();
  if (!row || !(await verifyPassword(String(password ?? ''), row.password_hash))) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }
  const { token, maxAge } = await createSession(c.env.DB, row.id);
  setCookie(c, COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge,
  });
  return c.json(publicUser(row));
});

// Everything below requires a valid session.
app.use('*', async (c, next) => {
  const token = getCookie(c, COOKIE);
  const user = token ? await getSessionUser(c.env.DB, token) : null;
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  c.set('user', user);
  await next();
});

app.post('/logout', async (c) => {
  await deleteSession(c.env.DB, getCookie(c, COOKIE)!);
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

app.get('/me', (c) => c.json(publicUser(c.get('user'))));

type EventRow = {
  id: number; user_id: number; title: string; start: string; end: string | null;
  all_day: number; location: string; description: string; unit_name: string; color: string;
};

const toEvent = (e: EventRow) => ({
  id: e.id, userId: e.user_id, title: e.title, start: e.start, end: e.end,
  allDay: !!e.all_day, location: e.location, description: e.description,
  unitName: e.unit_name, color: e.color,
});

const EVENT_SELECT = `SELECT e.*, u.unit_name, u.color FROM events e JOIN users u ON u.id = e.user_id`;

app.get('/events', async (c) => {
  // Dates are stored as local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" strings, so plain
  // string comparison is enough for an overlap check.
  const start = c.req.query('start') ?? '0000';
  const end = c.req.query('end') ?? '9999';
  const { results } = await c.env.DB.prepare(
    `${EVENT_SELECT} WHERE e.start < ? AND COALESCE(e.end, e.start) >= ? ORDER BY e.start`,
  ).bind(end, start).all<EventRow>();
  return c.json(results.map(toEvent));
});

type EventInput = {
  title?: string; start?: string; end?: string | null; allDay?: boolean;
  location?: string; description?: string;
};

function validate(body: EventInput) {
  const title = String(body.title ?? '').trim();
  const start = String(body.start ?? '');
  const end = body.end ? String(body.end) : null;
  if (!title) return { error: 'Title is required' };
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(start)) return { error: 'Invalid start date' };
  if (end && end < start) return { error: 'End must be after start' };
  return {
    value: {
      title: title.slice(0, 200), start, end, allDay: body.allDay ? 1 : 0,
      location: String(body.location ?? '').slice(0, 300),
      description: String(body.description ?? '').slice(0, 10_000),
    },
  };
}

async function loadEvent(db: D1Database, id: string) {
  return db.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(Number(id)).first<EventRow>();
}

app.post('/events', async (c) => {
  const v = validate(await c.req.json<EventInput>());
  if (!v.value) return c.json({ error: v.error }, 400);
  const e = v.value;
  const res = await c.env.DB.prepare(
    `INSERT INTO events (user_id, title, start, end, all_day, location, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(c.get('user').id, e.title, e.start, e.end, e.allDay, e.location, e.description).run();
  return c.json(toEvent((await loadEvent(c.env.DB, String(res.meta.last_row_id)))!), 201);
});

app.put('/events/:id', async (c) => {
  const user = c.get('user');
  const existing = await loadEvent(c.env.DB, c.req.param('id'));
  if (!existing) return c.json({ error: 'Not found' }, 404);
  if (existing.user_id !== user.id && !user.is_admin) return c.json({ error: 'Forbidden' }, 403);
  const v = validate(await c.req.json<EventInput>());
  if (!v.value) return c.json({ error: v.error }, 400);
  const e = v.value;
  await c.env.DB.prepare(
    `UPDATE events SET title = ?, start = ?, end = ?, all_day = ?, location = ?, description = ?,
            updated_at = datetime('now') WHERE id = ?`,
  ).bind(e.title, e.start, e.end, e.allDay, e.location, e.description, existing.id).run();
  return c.json(toEvent((await loadEvent(c.env.DB, String(existing.id)))!));
});

app.delete('/events/:id', async (c) => {
  const user = c.get('user');
  const existing = await loadEvent(c.env.DB, c.req.param('id'));
  if (!existing) return c.json({ error: 'Not found' }, 404);
  if (existing.user_id !== user.id && !user.is_admin) return c.json({ error: 'Forbidden' }, 403);
  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(existing.id).run();
  return c.json({ ok: true });
});

export default app;

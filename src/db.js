export const PLANS = {
  free: { name: 'Free', dailyLimit: 10, monthlyLimit: null },
  pro: { name: 'Pro', dailyLimit: null, monthlyLimit: 1000 },
  team: { name: 'Team', dailyLimit: null, monthlyLimit: 10000 },
};

export function nowIso() {
  return new Date().toISOString();
}

export function startOfUtcDay() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export function startOfUtcMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first();
}

export async function getUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

export async function getUserByStripeCustomer(db, customerId) {
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').bind(customerId).first();
}

export async function getUserByStripeSubscription(db, subscriptionId) {
  return db.prepare('SELECT * FROM users WHERE stripe_subscription_id = ?').bind(subscriptionId).first();
}

export async function createUser(db, { id, email, plan = 'free', status = 'active' }) {
  const ts = nowIso();
  await db.prepare(
    `INSERT INTO users (id, email, plan, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, email.toLowerCase(), plan, status, ts, ts).run();
  return getUserById(db, id);
}

export async function updateUser(db, id, fields) {
  const allowed = ['stripe_customer_id', 'stripe_subscription_id', 'plan', 'status'];
  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return getUserById(db, id);

  updates.push('updated_at = ?');
  values.push(nowIso());
  values.push(id);

  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  return getUserById(db, id);
}

export async function getApiKeyByHash(db, keyHash) {
  return db.prepare(
    `SELECT api_keys.*, users.email, users.plan, users.status
     FROM api_keys
     JOIN users ON users.id = api_keys.user_id
     WHERE api_keys.key_hash = ?`
  ).bind(keyHash).first();
}

export async function getApiKeysForUser(db, userId) {
  const { results } = await db.prepare(
    'SELECT id, key_prefix, name, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return results || [];
}

export async function createApiKey(db, { id, userId, keyHash, keyPrefix, name = 'default' }) {
  await db.prepare(
    `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, keyHash, keyPrefix, name, nowIso()).run();
}

export async function touchApiKey(db, keyHash) {
  await db.prepare('UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?')
    .bind(nowIso(), keyHash).run();
}

export async function recordUsage(db, { userId = null, ipHash = null, endpoint }) {
  await db.prepare(
    'INSERT INTO usage_events (user_id, ip_hash, endpoint, created_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, ipHash, endpoint, nowIso()).run();
}

export async function countUsage(db, { userId = null, ipHash = null, since }) {
  if (userId) {
    const row = await db.prepare(
      'SELECT COUNT(*) as count FROM usage_events WHERE user_id = ? AND created_at >= ?'
    ).bind(userId, since).first();
    return row?.count || 0;
  }

  const row = await db.prepare(
    'SELECT COUNT(*) as count FROM usage_events WHERE ip_hash = ? AND created_at >= ?'
  ).bind(ipHash, since).first();
  return row?.count || 0;
}

export async function getUsageSummary(db, user) {
  if (!user) return null;

  const plan = PLANS[user.plan] || PLANS.free;
  const since = plan.monthlyLimit ? startOfUtcMonth() : startOfUtcDay();
  const used = await countUsage(db, { userId: user.id, since });
  const limit = plan.monthlyLimit || plan.dailyLimit || 0;
  const period = plan.monthlyLimit ? 'month' : 'day';

  return { plan: user.plan, used, limit, period, remaining: Math.max(0, limit - used) };
}

// Simple timing-safe comparison for signature verification
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

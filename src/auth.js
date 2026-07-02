import {
  PLANS,
  countUsage,
  getApiKeyByHash,
  getUsageSummary,
  recordUsage,
  startOfUtcDay,
  startOfUtcMonth,
  touchApiKey,
} from './db.js';

const API_KEY_PREFIX = 'vd_live_';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // Max requests per window for anonymous users

export function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${API_KEY_PREFIX}${token}`;
}

export async function hashApiKey(apiKey) {
  const data = new TextEncoder().encode(apiKey);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getApiKeyPrefix(apiKey) {
  return apiKey.slice(0, 12);
}

export async function hashIp(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return hashApiKey(`ip:${ip}`);
}

export function extractApiKey(request) {
  const header = request.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return request.headers.get('X-API-Key');
}

export async function authenticateRequest(db, request) {
  const apiKey = extractApiKey(request);

  if (apiKey) {
    const keyHash = await hashApiKey(apiKey);
    const record = await getApiKeyByHash(db, keyHash);
    if (!record) {
      return { ok: false, status: 401, error: 'Invalid API key' };
    }
    if (record.status !== 'active') {
      return { ok: false, status: 403, error: 'Account is not active' };
    }
    return {
      ok: true,
      type: 'api_key',
      user: {
        id: record.user_id,
        email: record.email,
        plan: record.plan,
        status: record.status,
      },
      keyHash,
    };
  }

  return { ok: true, type: 'anonymous', user: null, ipHash: await hashIp(request) };
}

export async function enforceUsageLimit(db, auth) {
  if (auth.type === 'api_key') {
    const plan = PLANS[auth.user.plan] || PLANS.free;
    if (plan.monthlyLimit) {
      const used = await countUsage(db, { userId: auth.user.id, since: startOfUtcMonth() });
      if (used >= plan.monthlyLimit) {
        return {
          ok: false,
          status: 429,
          error: `Monthly limit reached (${plan.monthlyLimit} scans). Upgrade or wait until next month.`,
        };
      }
    }
    return { ok: true };
  }

  // Rate limiting for anonymous users (10 requests per minute)
  const ipHash = auth.ipHash;
  if (ipHash && ipHash !== 'unknown') {
    const now = Date.now();
    const windowStart = now - (RATE_LIMIT_WINDOW * 1000);
    
    try {
      // Check for existing rate limit entries in the last window
      const records = await db.prepare(
        'SELECT COUNT(*) as count FROM rate_limit_entries WHERE ip_hash = ? AND timestamp >= ?'
      ).bind(ipHash, new Date(windowStart).toISOString()).first();
      
      if (records && records.count >= RATE_LIMIT_MAX_REQUESTS) {
        return {
          ok: false,
          status: 429,
          error: `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW} seconds). Try again later.`,
        };
      }
      
      // Record this request
      await db.prepare(
        'INSERT INTO rate_limit_entries (ip_hash, timestamp) VALUES (?, ?)'
      ).bind(ipHash, new Date(now).toISOString()).run();
      
      // Clean up old entries to keep DB size small
      await db.prepare(
        'DELETE FROM rate_limit_entries WHERE timestamp < ?'
      ).bind(new Date(windowStart).toISOString()).run();
    } catch (error) {
      // If rate limiting fails for any reason, allow the request but log it
      console.error('Rate limiting error:', error);
    }
  }

  const used = await countUsage(db, { ipHash: auth.ipHash, since: startOfUtcDay() });
  const limit = PLANS.free.dailyLimit;
  if (used >= limit) {
    return {
      ok: false,
      status: 429,
      error: `Free daily limit reached (${limit} scans). Upgrade to Pro for API access and higher limits.`,
      upgradeUrl: '/pricing',
    };
  }

  return { ok: true };
}

export async function trackUsage(db, auth, endpoint) {
  await recordUsage(db, {
    userId: auth.user?.id || null,
    ipHash: auth.type === 'anonymous' ? auth.ipHash : null,
    endpoint,
  });

  if (auth.keyHash) {
    await touchApiKey(db, auth.keyHash);
  }
}

export async function getAccountUsage(db, user) {
  return getUsageSummary(db, user);
}

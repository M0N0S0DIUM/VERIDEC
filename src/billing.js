import {
  createApiKey,
  createUser,
  getApiKeysForUser,
  getUsageSummary,
  getUserByEmail,
  getUserByStripeCustomer,
  getUserByStripeSubscription,
  updateUser,
} from './db.js';
import { generateApiKey, getApiKeyPrefix, hashApiKey } from './auth.js';

async function stripeRequest(env, path, body) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe request failed');
  }
  return data;
}

async function stripeGet(env, path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe request failed');
  }
  return data;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function redirect(url) {
  return Response.redirect(url, 302);
}

function requireStripe(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in Cloudflare secrets.');
  }
}

export async function handleCreateCheckout(request, env, db) {
  requireStripe(env);

  const body = await request.json().catch(() => ({}));
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  if (!env.STRIPE_PRICE_PRO) {
    return jsonResponse({ error: 'Stripe price is not configured' }, 500);
  }

  const appUrl = env.APP_URL || 'https://veridecai.com';
  const existing = await getUserByEmail(db, email);

  const params = {
    mode: 'subscription',
    'line_items[0][price]': env.STRIPE_PRICE_PRO,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=canceled`,
    customer_email: email,
    'metadata[veridec_email]': email,
    allow_promotion_codes: 'true',
  };

  if (existing?.stripe_customer_id) {
    delete params.customer_email;
    params.customer = existing.stripe_customer_id;
  }

  const session = await stripeRequest(env, '/checkout/sessions', params);
  return jsonResponse({ url: session.url });
}

export async function handleCreatePortal(request, env, db) {
  requireStripe(env);

  const body = await request.json().catch(() => ({}));
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  const user = await getUserByEmail(db, email);
  if (!user?.stripe_customer_id) {
    return jsonResponse({ error: 'No billing account found for that email' }, 404);
  }

  const appUrl = env.APP_URL || 'https://veridecai.com';
  const session = await stripeRequest(env, '/billing_portal/sessions', {
    customer: user.stripe_customer_id,
    return_url: `${appUrl}/account`,
  });

  return jsonResponse({ url: session.url });
}

export async function handleAccount(request, env, db, url) {
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId || !env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'Missing session_id' }, 400);
  }

  const session = await stripeGet(env, `/checkout/sessions/${sessionId}`);
  const email = session.customer_details?.email || session.metadata?.veridec_email;
  if (!email) {
    return jsonResponse({ error: 'Unable to resolve account from checkout session' }, 404);
  }

  const user = await getUserByEmail(db, email.toLowerCase());
  if (!user) {
    return jsonResponse({ error: 'Account not found yet. Wait a moment and refresh.' }, 404);
  }

  const usage = getUsageSummary(db, user);
  let keys = await getApiKeysForUser(db, user.id);
  let apiKey = null;
  const checkoutSuccess = url.searchParams.get('checkout') === 'success';

  if (user.plan === 'pro') {
    if (keys.length === 0 || checkoutSuccess) {
      if (keys.length > 0) {
        await db.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(user.id).run();
      }
      apiKey = await provisionApiKey(db, user.id);
      keys = await getApiKeysForUser(db, user.id);
    }
  }

  return jsonResponse({
    email: user.email,
    plan: user.plan,
    status: user.status,
    usage,
    apiKeys: keys,
    apiKey,
    portalAvailable: Boolean(user.stripe_customer_id),
  });
}

async function provisionApiKey(db, userId) {
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);
  const keyPrefix = getApiKeyPrefix(apiKey);
  const keyId = crypto.randomUUID();

  await createApiKey(db, {
    id: keyId,
    userId,
    keyHash,
    keyPrefix,
    name: 'default',
  });

  return apiKey;
}

export async function handleRegenerateApiKey(request, env, db) {
  const body = await request.json().catch(() => ({}));
  const sessionId = body.session_id;

  if (!sessionId || !env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: 'session_id is required' }, 400);
  }

  const session = await stripeGet(env, `/checkout/sessions/${sessionId}`);
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return jsonResponse({ error: 'Checkout session is not complete' }, 400);
  }

  const email = (session.customer_details?.email || session.metadata?.veridec_email || '').toLowerCase();
  const user = await getUserByEmail(db, email);
  if (!user) {
    return jsonResponse({ error: 'Account not found' }, 404);
  }

  await db.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(user.id).run();
  const apiKey = await provisionApiKey(db, user.id);
  const keys = await getApiKeysForUser(db, user.id);

  return jsonResponse({
    email: user.email,
    plan: user.plan,
    status: user.status,
    apiKey,
    apiKeys: keys,
  });
}

async function upsertPaidUser(db, { email, customerId, subscriptionId }) {
  let user = await getUserByEmail(db, email);

  if (!user) {
    user = await createUser(db, {
      id: crypto.randomUUID(),
      email,
      plan: 'pro',
      status: 'active',
    });
  }

  user = await updateUser(db, user.id, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan: 'pro',
    status: 'active',
  });

  const keys = await getApiKeysForUser(db, user.id);
  return { user };
}

export async function handleStripeWebhook(request, env, db) {
  requireStripe(env);

  const signature = request.headers.get('Stripe-Signature');
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response('Webhook not configured', { status: 400 });
  }

  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = (session.customer_details?.email || session.metadata?.veridec_email || '').toLowerCase();
      if (email) {
        await upsertPaidUser(db, {
          email,
          customerId: session.customer,
          subscriptionId: session.subscription,
        });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const user = await getUserByStripeSubscription(db, sub.id)
        || await getUserByStripeCustomer(db, sub.customer);
      if (user) {
        const active = sub.status === 'active' || sub.status === 'trialing';
        await updateUser(db, user.id, {
          plan: active ? 'pro' : 'free',
          status: active ? 'active' : sub.status,
          stripe_subscription_id: sub.id,
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = await getUserByStripeSubscription(db, sub.id);
      if (user) {
        await updateUser(db, user.id, {
          plan: 'free',
          status: 'canceled',
          stripe_subscription_id: null,
        });
      }
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [k, v] = piece.split('=');
      return [k, v];
    })
  );

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(expected), (b) => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqual(expectedHex, signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

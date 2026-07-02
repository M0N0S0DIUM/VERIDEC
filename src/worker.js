// VERIDEC Worker - dashboard, analysis API, and billing

import { analyzeCode } from './workers-friendly-analyzer.js';
import DASHBOARD_HTML from '../index.html';
import PRICING_HTML from '../pricing.html';
import ACCOUNT_HTML from '../account.html';
import {
  authenticateRequest,
  enforceUsageLimit,
  trackUsage,
} from './auth.js';
import {
  handleAccount,
  handleCreateCheckout,
  handleCreatePortal,
  handleRegenerateApiKey,
  handleStripeWebhook,
} from './billing.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// Security headers
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=()',
};

// Add security headers to responses
function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

// Code size limit (50KB)
const MAX_CODE_SIZE = 50000;

function htmlResponse(html) {
  return addSecurityHeaders(new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  }));
}

const healthEndpoint = async () => {
  return addSecurityHeaders(new Response(JSON.stringify({ status: 'healthy' }), { headers: jsonHeaders }));
};

const analyzeEndpoint = async (request, env) => {
  const db = env.veridec_billing;
  const auth = await authenticateRequest(db, request);
  if (!auth.ok) {
    return addSecurityHeaders(new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: jsonHeaders,
    }));
  }

  const limit = await enforceUsageLimit(db, auth);
  if (!limit.ok) {
    return addSecurityHeaders(new Response(JSON.stringify({
      error: limit.error,
      upgradeUrl: limit.upgradeUrl || '/pricing',
    }), {
      status: limit.status,
      headers: jsonHeaders,
    }));
  }

  try {
    const body = await request.json();
    if (!body.code) {
      return addSecurityHeaders(new Response(JSON.stringify({ error: 'No code provided in request body' }), {
        status: 400,
        headers: jsonHeaders,
      }));
    }

    // Code size validation to prevent resource exhaustion
    if (body.code.length > MAX_CODE_SIZE) {
      return addSecurityHeaders(new Response(JSON.stringify({ 
        error: `Code too large. Maximum size is ${MAX_CODE_SIZE} bytes.` 
      }), {
        status: 413,
        headers: jsonHeaders,
      }));
    }

    const result = await analyzeCode(body.code, body.filePath || 'worker-analyzed-file.js');
    await trackUsage(db, auth, '/analyze');

    return addSecurityHeaders(new Response(JSON.stringify({
      ...result,
      usage: auth.user ? {
        plan: auth.user.plan,
      } : { plan: 'free' },
    }), { headers: jsonHeaders }));
  } catch (error) {
    return addSecurityHeaders(new Response(JSON.stringify({ error: 'Analysis failed', message: error.message }), {
      status: 500,
      headers: jsonHeaders,
    }));
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
      });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return healthEndpoint();
    }

    if (url.pathname === '/analyze' && request.method === 'POST') {
      return analyzeEndpoint(request, env);
    }

    if (url.pathname === '/billing/checkout' && request.method === 'POST') {
      try {
        return await handleCreateCheckout(request, env, env.veridec_billing);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    if (url.pathname === '/billing/portal' && request.method === 'POST') {
      try {
        return await handleCreatePortal(request, env, env.veridec_billing);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    if (url.pathname === '/webhooks/stripe' && request.method === 'POST') {
      return handleStripeWebhook(request, env, env.veridec_billing);
    }

    if (url.pathname === '/api/account' && request.method === 'GET') {
      try {
        return await handleAccount(request, env, env.veridec_billing, url);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    if (url.pathname === '/api/account/regenerate-key' && request.method === 'POST') {
      try {
        return await handleRegenerateApiKey(request, env, env.veridec_billing);
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    if (request.method === 'GET') {
      if (url.pathname === '/pricing') return htmlResponse(PRICING_HTML);
      if (url.pathname === '/account') return htmlResponse(ACCOUNT_HTML);
      return htmlResponse(DASHBOARD_HTML);
    }

    return new Response('VERIDEC - CI/CD Pre-Flight Check & Impact Predictor', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

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

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

const healthEndpoint = async () => {
  return new Response(JSON.stringify({ status: 'healthy' }), { headers: jsonHeaders });
};

const analyzeEndpoint = async (request, env) => {
  const db = env.veridec_billing;
  const auth = await authenticateRequest(db, request);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: jsonHeaders,
    });
  }

  const limit = await enforceUsageLimit(db, auth);
  if (!limit.ok) {
    return new Response(JSON.stringify({
      error: limit.error,
      upgradeUrl: limit.upgradeUrl || '/pricing',
    }), {
      status: limit.status,
      headers: jsonHeaders,
    });
  }

  try {
    const body = await request.json();
    if (!body.code) {
      return new Response(JSON.stringify({ error: 'No code provided in request body' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const result = await analyzeCode(body.code, body.filePath || 'worker-analyzed-file.js');
    await trackUsage(db, auth, '/analyze');

    return new Response(JSON.stringify({
      ...result,
      usage: auth.user ? {
        plan: auth.user.plan,
      } : { plan: 'free' },
    }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Analysis failed', message: error.message }), {
      status: 500,
      headers: jsonHeaders,
    });
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

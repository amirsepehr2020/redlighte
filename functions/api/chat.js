const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/free';
const MAX_MESSAGE_LENGTH = 12000;
const MAX_MESSAGES = 20;
const SITE_URL = 'https://redlighte.ir';
const SITE_NAME = 'Redlighte';

const json = (data, status = 200, extra = {}) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extra,
    },
  });

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: 'Origin not allowed.' }, 403, corsHeaders(request));
  }

  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'AI service is not configured.' }, 503, corsHeaders(request));
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400, corsHeaders(request));
  }

  const input = typeof body.message === 'string' ? body.message.trim() : '';
  if (!input) return json({ error: 'Message is required.' }, 400, corsHeaders(request));
  if (input.length > MAX_MESSAGE_LENGTH) {
    return json({ error: 'Message is too long.' }, 413, corsHeaders(request));
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  if (!messages.length || messages[messages.length - 1]?.content !== input) {
    messages.push({ role: 'user', content: input });
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });

  const raw = await upstream.text();
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    result = null;
  }

  if (!upstream.ok) {
    const detail = result?.error?.message || 'Upstream AI service error.';
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 502;
    return json({ error: detail }, status, corsHeaders(request));
  }

  const answer = result?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) {
    return json({ error: 'The AI service returned an empty response.' }, 502, corsHeaders(request));
  }

  return json({
    message: answer,
    model: result.model || MODEL,
  }, 200, corsHeaders(request));
}

export function onRequestGet({ request }) {
  return json({ service: 'Redlighte AI', status: 'ok' }, 200, corsHeaders(request));
}

function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.origin === 'https://redlighte.ir' || url.origin === 'https://www.redlighte.ir' || url.hostname.endsWith('.pages.dev') || url.hostname.endsWith('.workers.dev');
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowed = origin && isAllowedOrigin(origin) ? origin : 'https://redlighte.ir';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

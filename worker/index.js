const MODEL = '@cf/meta/llama-3.2-1b-instruct';
const MAX_MESSAGE_LENGTH = 12000;
const MAX_MESSAGES = 20;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/chat' || url.pathname.startsWith('/api/chat/')) return handleChat(request, env);
    return env.ASSETS.fetch(request);
  },
};

async function handleChat(request, env) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET') {
    return json({
      service: 'Redlighte AI',
      status: env.AI ? 'ready' : 'not_configured',
      provider: 'cloudflare-workers-ai',
      model: MODEL,
    }, 200, cors);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { ...cors, Allow: 'GET,POST,OPTIONS' });

  const origin = request.headers.get('Origin');
  if (origin && !isAllowedOrigin(origin)) return json({ error: 'Origin not allowed.' }, 403, cors);
  if (!env.AI) return json({ error: 'AI service is not configured.' }, 503, cors);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, 400, cors); }

  const input = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!input) return json({ error: 'Message is required.' }, 400, cors);
  if (input.length > MAX_MESSAGE_LENGTH) return json({ error: 'Message is too long.' }, 413, cors);

  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const messages = incoming
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  if (!messages.length || messages[messages.length - 1]?.content !== input) messages.push({ role: 'user', content: input });

  try {
    const result = await env.AI.run(MODEL, {
      messages,
      max_tokens: 512,
      temperature: 0.7,
    });

    const answer = result?.response || result?.result?.response;
    if (typeof answer !== 'string' || !answer.trim()) {
      return json({ error: 'The AI service returned an empty response.' }, 502, cors);
    }

    return json({ message: answer, model: MODEL }, 200, cors);
  } catch (error) {
    return json({
      error: 'AI service error.',
      code: 'WORKERS_AI_ERROR',
      detail: error?.message || 'Workers AI request failed.',
    }, 502, cors);
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.origin === 'https://redlighte.ir' || url.origin === 'https://www.redlighte.ir' || url.hostname.endsWith('.workers.dev');
  } catch { return false; }
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

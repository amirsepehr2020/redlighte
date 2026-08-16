const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'dots-studio/dots-3-note-preview:free';
const MAX_MESSAGE_LENGTH = 12000;
const MAX_MESSAGES = 20;
const SITE_URL = 'https://redlighte.ir';
const SITE_NAME = 'Redlighte';

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
  if (request.method === 'GET') return json({ service: 'Redlighte AI', status: env.OPENROUTER_API_KEY ? 'ready' : 'not_configured', provider: 'openrouter', model: MODEL }, 200, cors);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { ...cors, Allow: 'GET,POST,OPTIONS' });

  const origin = request.headers.get('Origin');
  if (origin && !isAllowedOrigin(origin)) return json({ error: 'Origin not allowed.' }, 403, cors);
  if (!env.OPENROUTER_API_KEY) return json({ error: 'AI service is not configured.' }, 503, cors);

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

  let upstream;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_NAME,
        'User-Agent': 'Redlighte/1.0 (https://redlighte.ir)',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });
  } catch (error) {
    return json({ error: 'Could not reach the AI provider.', code: 'UPSTREAM_NETWORK_ERROR', detail: error?.message || 'fetch failed' }, 502, cors);
  }

  const raw = await upstream.text();
  let result = null;
  try { result = JSON.parse(raw); } catch {}

  if (!upstream.ok) {
    const detail = result?.error?.message || result?.error?.code || result?.error || raw.slice(0, 500) || 'Unknown upstream error.';
    const code = result?.error?.code || `HTTP_${upstream.status}`;
    const status = upstream.status === 429 ? 429 : upstream.status === 401 ? 502 : upstream.status === 402 ? 502 : 502;
    return json({ error: 'Upstream AI service error.', upstream_status: upstream.status, upstream_code: code, detail }, status, cors);
  }

  const answer = result?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) return json({ error: 'The AI service returned an empty response.', upstream_status: upstream.status }, 502, cors);
  return json({ message: answer, model: result.model || MODEL }, 200, cors);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
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
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}

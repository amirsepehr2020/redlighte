import worker from './index.js';

const LEGACY = 'redlighte_session_v3';
const HOST = '__Host-redlighte_session';

function cookieValue(header, name) {
  return String(header || '')
    .split(';')
    .map(x => x.trim())
    .find(x => x.startsWith(name + '='))
    ?.slice(name.length + 1) || '';
}

function requestWithCanonicalSession(request) {
  const header = request.headers.get('Cookie') || '';
  const hostValue = cookieValue(header, HOST);
  if (!hostValue) return request;

  const cookies = header
    .split(';')
    .map(x => x.trim())
    .filter(Boolean)
    .filter(x => !x.startsWith(LEGACY + '=') && !x.startsWith(HOST + '='));

  cookies.push(`${LEGACY}=${hostValue}`);

  const headers = new Headers(request.headers);
  headers.set('Cookie', cookies.join('; '));
  return new Request(request, { headers });
}

function normalizeResponse(response, pathname) {
  const headers = new Headers(response.headers);
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (typeof response.headers.getAll === 'function' ? response.headers.getAll('Set-Cookie') : []);

  if (!cookies.length) return response;

  const updated = [];
  for (const cookie of cookies) {
    if (!cookie.startsWith(LEGACY + '=')) {
      updated.push(cookie);
      continue;
    }

    const valuePart = cookie.slice((LEGACY + '=').length).split(';', 1)[0];
    const attributes = cookie.slice((LEGACY + '=').length + valuePart.length)
      .replace(/;\s*Domain=redlighte\.ir/ig, '');

    updated.push(`${HOST}=${valuePart}${attributes}`);
  }

  if (pathname === '/api/auth/logout') {
    updated.push(`${HOST}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
  } else if (pathname === '/api/auth/login' || pathname === '/api/auth/signup') {
    updated.push(`${LEGACY}=; Max-Age=0; Path=/; Domain=redlighte.ir; HttpOnly; Secure; SameSite=Lax`);
    updated.push(`${LEGACY}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
  }

  headers.delete('Set-Cookie');
  for (const cookie of updated) headers.append('Set-Cookie', cookie);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const normalizedRequest = requestWithCanonicalSession(request);
    const response = await worker.fetch(normalizedRequest, env, ctx);
    return normalizeResponse(response, url.pathname);
  },
};

export async function getPulseSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)redlighte_session=([^;]+)/);
  if (!match) return null;
  const raw = match[1];
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  try {
    const expected = await sign(payload, env.GITHUB_TOKEN);
    if (!timingSafeEqual(signature, expected)) return null;
    const data = JSON.parse(fromBase64(payload));
    if (!data?.exp || data.exp < Date.now() || !data?.username) return null;
    return data;
  } catch { return null; }
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
function fromBase64(value) { const binary = atob(value.replace(/\s/g, '')); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return new TextDecoder().decode(bytes); }

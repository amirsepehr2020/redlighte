import core from './index-core.js';

export default {
  async fetch(request, env, ctx) {
    const response = await core.fetch(request, env, ctx);
    const url = new URL(request.url);
    if (url.pathname !== '/api/chat' || request.method !== 'POST' || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      if (payload?.memory && typeof payload.message === 'string') {
        const marker = /\n\n🧠\s+(?:Saved to Memory|Memory updated)\s+—\s+(.+)$/s;
        const match = payload.message.match(marker);
        if (match) {
          const title = payload.memory.action === 'updated' ? 'MEMORY UPDATED' : 'SAVED TO MEMORY';
          const type = String(payload.memory.type || 'memory').toUpperCase();
          const content = match[1].trim();
          payload.message = payload.message.replace(marker,
`\n\n╭────────────────────────────────────╮\n│  🧠  ${title.padEnd(29, ' ')}│\n│  ${type.padEnd(32, ' ')}│\n│  ✦ ${content.slice(0, 28).padEnd(28, ' ')} │\n╰────────────────────────────────────╯`);
        }
      }

      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  }
};

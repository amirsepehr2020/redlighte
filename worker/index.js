import core from './index-core.js';
import googleAuth from './google-auth.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth/google')) {
      return googleAuth.fetch(request, env, ctx);
    }

    const response = await core.fetch(request, env, ctx);
    if (url.pathname !== '/api/chat' || request.method !== 'POST' || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      if (payload?.memory && typeof payload.message === 'string') {
        const marker = /\n\n🧠\s+(?:Saved to Memory|Memory updated)\s+—\s+(.+)$/s;
        const match = payload.message.match(marker);
        if (match) {
          const updated = payload.memory.action === 'updated';
          const title = updated ? 'MEMORY UPDATED' : 'SAVED TO MEMORY';
          const type = String(payload.memory.type || 'memory').toUpperCase();
          const content = match[1].trim().replace(/[\r\n]+/g, ' ');
          const compact = content.length > 140 ? `${content.slice(0, 137)}…` : content;
          const notice = updated
            ? `✦  MEMORY UPDATED\n   ${type}\n   ${compact}`
            : `✦  SAVED TO MEMORY\n   ${type}\n   ${compact}`;
          payload.message = payload.message.replace(marker, `\n\n${notice}`);
          payload.memory.notification = {
            title,
            type,
            content: compact
          };
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

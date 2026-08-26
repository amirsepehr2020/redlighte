import core from './index-core.js';

const ROOM_TTL = 60 * 60 * 1000;
const INACTIVITY_TTL = 15 * 60 * 1000;
const MAX_MEMBERS = 8;
const MAX_CHAT = 100;
const DATA_REPO = 'amirsepehr2020/redlighte-data';

export async function handleRoom(request, env, ctx, url) {
  const auth = await authenticate(request, env);
  if (!auth) return roomJson({ error: 'Unauthorized.' }, 401, roomCors(request));
  const path = url.pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: roomCors(request) });

  try {
    if (path === '/api/room/me' && request.method === 'GET') return roomJson({ user: auth.user }, 200, roomCors(request));
    if (path === '/api/room/users' && request.method === 'GET') return listUsers(request, env, auth.user, url.searchParams.get('q') || '');
    if (path === '/api/room/create' && request.method === 'POST') return createRoom(request, env, auth.user);
    const match = path.match(/^\/api\/room\/([A-Za-z0-9_-]+)(\/.*)?$/);
    if (!match) return roomJson({ error: 'Not found.' }, 404, roomCors(request));
    const roomId = match[1];
    const sub = match[2] || '';
    if (sub === '/ws') return roomWebSocket(request, env, auth.user, roomId);
    if (sub === '/invite' && request.method === 'POST') return roomInvite(request, env, auth.user, roomId);
    if (sub === '/join' && request.method === 'POST') return roomJoin(request, env, auth.user, roomId);
    if (sub === '/close' && request.method === 'POST') return roomClose(request, env, auth.user, roomId);
    if (sub === '' && request.method === 'GET') return roomInfo(env, auth.user, roomId);
    return roomJson({ error: 'Not found.' }, 404, roomCors(request));
  } catch (error) {
    console.error('ROOM_API_ERROR', error);
    return roomJson({ error: 'Room service error.' }, 500, roomCors(request));
  }
}

async function authenticate(request, env) {
  try {
    const headers = new Headers();
    const cookie = request.headers.get('Cookie');
    if (cookie) headers.set('Cookie', cookie);
    const probe = new Request(new URL('/api/auth/me', request.url), { method: 'GET', headers });
    const response = await core.fetch(probe, env, {});
    if (!response.ok) return null;
    const body = await response.json();
    return body?.authenticated ? { user: body.user } : null;
  } catch { return null; }
}

async function createRoom(request, env, user) {
  const id = randomRoomId();
  const stub = roomStub(env, id);
  await stub.fetch('https://room.internal/init', { method: 'POST', body: JSON.stringify({ owner: user }) });
  return roomJson({ room: { id, url: `/room/${id}` } }, 201, roomCors(request));
}

async function roomInfo(env, user, roomId) {
  const response = await roomStub(env, roomId).fetch('https://room.internal/info', { method: 'POST', body: JSON.stringify({ user }) });
  return response;
}

async function roomJoin(request, env, user, roomId) {
  return roomStub(env, roomId).fetch('https://room.internal/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) });
}

async function roomClose(request, env, user, roomId) {
  return roomStub(env, roomId).fetch('https://room.internal/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) });
}

async function roomInvite(request, env, user, roomId) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)) return roomJson({ error: 'Invalid username.' }, 400, roomCors(request));
  if (username === user.username) return roomJson({ error: 'You are already the owner.' }, 400, roomCors(request));
  const target = await getUser(env, username);
  if (!target) return roomJson({ error: 'User not found.' }, 404, roomCors(request));
  return roomStub(env, roomId).fetch('https://room.internal/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: user, target }) });
}

async function roomWebSocket(request, env, user, roomId) {
  if (request.headers.get('Upgrade') !== 'websocket') return roomJson({ error: 'WebSocket upgrade required.' }, 426, roomCors(request));
  return roomStub(env, roomId).fetch(new Request('https://room.internal/ws', { method: 'GET', headers: { Upgrade: 'websocket', 'X-Room-User': JSON.stringify(user) } }));
}

async function listUsers(request, env, currentUser, query) {
  const q = query.trim().toLowerCase();
  try {
    const users = [];
    for (let page = 1; page <= 3 && users.length < 50; page++) {
      const r = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/users?ref=main&per_page=100&page=${page}`, { headers: githubHeaders(env) });
      if (!r.ok) break;
      const entries = await r.json();
      if (!Array.isArray(entries) || !entries.length) break;
      for (const entry of entries) {
        if (entry.type !== 'dir') continue;
        const username = entry.name.toLowerCase();
        if (username === currentUser.username) continue;
        if (!q || username.includes(q)) users.push({ username, name: username, status: 'offline' });
        if (users.length >= 50) break;
      }
      if (entries.length < 100) break;
    }
    return roomJson({ users }, 200, roomCors(request));
  } catch {
    return roomJson({ users: [] }, 200, roomCors(request));
  }
}

async function getUser(env, username) {
  const r = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/users/${encodeURIComponent(username)}/data.json?ref=main`, { headers: githubHeaders(env) });
  if (!r.ok) return null;
  try {
    const x = await r.json();
    const bytes = Uint8Array.from(atob(x.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data?.user ? { id: data.user.id, name: data.user.name, username: data.user.username } : null;
  } catch { return null; }
}

function roomStub(env, id) {
  return env.ROOMS.get(env.ROOMS.idFromName(id));
}

export class RoomDurableObject {
  constructor(state) {
    this.state = state;
    this.sessions = new Map();
    this.invites = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const stored = await this.state.storage.get('room');
    if (url.pathname === '/init' && request.method === 'POST') {
      if (stored) return json({ room: publicRoom(stored) });
      const body = await request.json();
      const room = { id: this.state.id.toString(), owner: body.owner, members: [body.owner], createdAt: Date.now(), lastActivityAt: Date.now(), content: null, playback: { playing: false, position: 0, updatedAt: Date.now() }, chat: [], closed: false };
      await this.state.storage.put('room', room);
      return json({ room: publicRoom(room) }, 201);
    }
    if (!stored || stored.closed) return json({ error: 'Room expired or closed.' }, 410);
    if (url.pathname === '/info') return this.info(await request.json(), stored);
    if (url.pathname === '/join') return this.join(await request.json(), stored);
    if (url.pathname === '/invite') return this.invite(await request.json(), stored);
    if (url.pathname === '/close') return this.close(await request.json(), stored);
    if (url.pathname === '/ws') return this.ws(request, stored);
    return json({ error: 'Not found.' }, 404);
  }

  async info(body, room) {
    if (!isMember(room, body.user.username) && room.owner.username !== body.user.username) return json({ error: 'You are not a member.' }, 403);
    await this.touch(room);
    return json({ room: publicRoom(room) });
  }

  async join(body, room) {
    if (room.members.some(x => x.username === body.user.username)) return json({ ok: true, room: publicRoom(room) });
    if (room.members.length >= MAX_MEMBERS) return json({ error: 'Room is full.' }, 409);
    room.members.push(body.user);
    await this.touch(room);
    await this.state.storage.put('room', room);
    this.broadcast({ type: 'MEMBER_JOINED', user: body.user, members: room.members });
    return json({ ok: true, room: publicRoom(room) });
  }

  async invite(body, room) {
    if (room.owner.username !== body.from.username && !isMember(room, body.from.username)) return json({ error: 'Not a member.' }, 403);
    if (room.members.length >= MAX_MEMBERS) return json({ error: 'Room is full.' }, 409);
    const invitation = { roomId: room.id, from: body.from, target: body.target, createdAt: Date.now(), expiresAt: Date.now() + 5 * 60 * 1000 };
    this.invites.set(body.target.username, invitation);
    this.broadcast({ type: 'INVITATION', invitation }, body.target.username);
    return json({ ok: true });
  }

  async close(body, room) {
    if (room.owner.username !== body.user.username) return json({ error: 'Only the host can close the room.' }, 403);
    room.closed = true;
    await this.state.storage.put('room', room);
    this.broadcast({ type: 'ROOM_CLOSED' });
    for (const ws of this.sessions.values()) try { ws.close(1000, 'Room closed'); } catch {}
    this.sessions.clear();
    return json({ ok: true });
  }

  async ws(request, room) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const rawUser = request.headers.get('X-Room-User');
    let user;
    try { user = JSON.parse(rawUser); } catch { server.close(1008, 'Invalid user'); return new Response(null, { status: 400 }); }
    if (!isMember(room, user.username) && room.owner.username !== user.username) { server.close(1008, 'Not a member'); return new Response(null, { status: 403 }); }
    server.accept();
    this.sessions.set(user.username, server);
    server.addEventListener('message', e => this.message(server, user, String(e.data), room));
    server.addEventListener('close', () => this.sessions.delete(user.username));
    server.send(JSON.stringify({ type: 'ROOM_STATE', room: publicRoom(room) }));
    this.broadcast({ type: 'PRESENCE', username: user.username, online: true });
    return new Response(null, { status: 101, webSocket: client });
  }

  async message(server, user, raw, room) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    await this.touch(room);
    if (msg.type === 'SYNC_REQUEST') return server.send(JSON.stringify({ type: 'ROOM_STATE', room: publicRoom(room) }));
    if (msg.type === 'PLAY' || msg.type === 'PAUSE' || msg.type === 'SEEK') {
      if (room.owner.username !== user.username && msg.hostOnly !== false) return;
      const position = Number.isFinite(Number(msg.position)) ? Math.max(0, Number(msg.position)) : room.playback.position;
      room.playback = { playing: msg.type === 'PLAY', position, updatedAt: Date.now() };
      await this.state.storage.put('room', room);
      this.broadcast({ type: msg.type, position, serverTime: Date.now(), actor: user.username });
      return;
    }
    if (msg.type === 'CONTENT_CHANGE') {
      if (room.owner.username !== user.username) return;
      room.content = { url: String(msg.url || '').slice(0, 2048), title: String(msg.title || '').slice(0, 200), provider: String(msg.provider || 'website').slice(0, 32) };
      room.playback = { playing: false, position: 0, updatedAt: Date.now() };
      await this.state.storage.put('room', room);
      this.broadcast({ type: 'CONTENT_CHANGE', content: room.content });
      return;
    }
    if (msg.type === 'REACTION') return this.broadcast({ type: 'REACTION', emoji: String(msg.emoji || '').slice(0, 8), actor: user.username });
    if (msg.type === 'CHAT') {
      const text = String(msg.text || '').trim().slice(0, 500);
      if (!text) return;
      room.chat.push({ id: crypto.randomUUID(), user: { name: user.name, username: user.username }, text, at: Date.now() });
      room.chat = room.chat.slice(-MAX_CHAT);
      await this.state.storage.put('room', room);
      this.broadcast({ type: 'CHAT', message: room.chat.at(-1) });
    }
  }

  async touch(room) {
    room.lastActivityAt = Date.now();
    if (Date.now() - room.createdAt > ROOM_TTL || Date.now() - room.lastActivityAt > INACTIVITY_TTL) room.closed = true;
    await this.state.storage.put('room', room);
  }

  broadcast(message, onlyUser = null) {
    const raw = JSON.stringify(message);
    for (const [username, ws] of this.sessions) {
      if (onlyUser && username !== onlyUser) continue;
      try { ws.send(raw); } catch { this.sessions.delete(username); }
    }
  }
}

function isMember(room, username) { return room.members.some(x => x.username === username); }
function publicRoom(room) { return { id: room.id, owner: room.owner, members: room.members, createdAt: room.createdAt, lastActivityAt: room.lastActivityAt, content: room.content, playback: room.playback, chat: room.chat.slice(-50), closed: room.closed }; }
function randomRoomId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(); }
function githubHeaders(env) { return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Redlighte-Room' }; }
function roomCors(request) { const origin = request.headers.get('Origin'); const allowed = origin && /^https:\/\/(?:www\.)?redlighte\.ir$/.test(origin) ? origin : 'https://redlighte.ir'; return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', Vary: 'Origin' }; }
function roomJson(data, status, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }

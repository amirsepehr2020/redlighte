const MEMORY_VERSION = 1;
const MEMORY_MAX = 200;
const MEMORY_CONTEXT_MAX = 8;
const MEMORY_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const MEMORY_TYPES = new Set(['profile','preference','skill','goal','project','communication','fact']);

export async function getMemory(env, username) {
  const file = await githubFile(env, `users/${username}/memory.json`);
  if (!file) return { file: null, data: { version: MEMORY_VERSION, enabled: true, memories: [] } };
  try { return { file, data: normalizeMemory(JSON.parse(file.content)) }; }
  catch { return { file, data: { version: MEMORY_VERSION, enabled: true, memories: [] } }; }
}

export async function saveMemory(env, username, data, file, message = 'Update user memory') {
  const clean = normalizeMemory(data);
  clean.memories = clean.memories.slice(0, MEMORY_MAX);
  await githubWrite(env, `users/${username}/memory.json`, clean, file?.sha || null, message);
  return clean;
}

export function retrieveMemories(data, query, limit = MEMORY_CONTEXT_MAX) {
  if (!data?.enabled || !Array.isArray(data.memories)) return [];
  const q = tokenize(query);
  if (!q.length) return [];
  return data.memories.filter(m => m.status === 'active')
    .map(m => ({ memory: m, score: retrievalScore(m, q) }))
    .filter(x => x.score >= 0.08)
    .sort((a,b) => b.score - a.score)
    .slice(0, Math.min(limit, MEMORY_CONTEXT_MAX))
    .map(x => ({ ...x.memory, retrievalScore: Number(x.score.toFixed(4)), lastUsedAt: new Date().toISOString() }));
}

export function buildMemoryContext(memories) {
  if (!memories?.length) return '';
  return `[RELEVANT USER MEMORY]\n${memories.map(m => `- ${m.content}`).join('\n')}\n[END USER MEMORY]`;
}

export async function extractAndMergeMemory(env, username, userMessage, recentMessages = [], conversationId = null) {
  if (!env.AI || !username || !userMessage || userMessage.length < 3) return null;
  if (!looksLikeMemoryCandidate(userMessage)) return null;
  const { file, data } = await getMemory(env, username);
  if (!data.enabled) return null;

  const deterministic = detectExplicitMemory(userMessage);
  if (deterministic) {
    return persistCandidate(env, username, data, file, deterministic, conversationId);
  }

  if (userMessage.length < 8) return null;
  const context = data.memories.slice(0, 40).map(m => ({ id: m.id, type: m.type, content: m.content }));
  const prompt = `You are Redlighte Memory Extractor. Extract only durable, user-specific information explicitly stated by the user in the latest message that would improve future conversations. Do not store temporary events, one-off requests, secrets, passwords, API keys, tokens, exact IP addresses, device identifiers, medical information, financial information, political/religious identity, sexual information, or other highly sensitive personal data. Do not infer facts that the user did not state. If nothing should be remembered, return {"remember":false}. If an existing memory is contradicted, return an update for that memory.\n\nAllowed types: profile, preference, skill, goal, project, communication, fact.\n\nExisting memories:\n${JSON.stringify(context)}\n\nLatest user message:\n${userMessage}\n\nRecent conversation:\n${JSON.stringify(recentMessages.slice(-4))}\n\nReturn JSON only:\n{"remember":true,"action":"create|update","existingId":null,"type":"preference","content":"short durable statement","confidence":0.0,"importance":0.0}`;

  try {
    const result = await env.AI.run(MEMORY_MODEL, { messages: [{ role: 'system', content: prompt }], max_tokens: 300, temperature: 0.1 });
    const raw = result?.response || result?.result?.response || '';
    const candidate = parseJsonObject(raw);
    if (!candidate?.remember || typeof candidate.content !== 'string') return null;
    const content = candidate.content.trim().slice(0, 500);
    if (!content || isSensitiveCandidate(content)) return null;
    const type = MEMORY_TYPES.has(candidate.type) ? candidate.type : 'fact';
    const confidence = clamp(Number(candidate.confidence), 0.5, 1);
    const importance = clamp(Number(candidate.importance), 0.5, 1);
    return persistCandidate(env, username, data, file, { content, type, confidence, importance }, conversationId, candidate.existingId || null);
  } catch (error) {
    console.error('MEMORY_EXTRACTION_ERROR', error);
    return null;
  }
}

function detectExplicitMemory(text) {
  const value = String(text || '').trim();
  if (isSensitiveCandidate(value)) return null;

  let m = value.match(/^(?:اسمم|اسم من|منو|من رو)\s*(?:این(?:ه|ه که)|:)?\s*([\p{L}][\p{L}\u200c .'-]{1,48})[.!؟]?$/u);
  if (m) return { type: 'profile', content: `User's name is ${cleanCaptured(m[1])}.`, confidence: 1, importance: 1 };

  m = value.match(/^(?:من|منم)\s+(?:دانش[‌ ]?آموز|دانشجو|برنامه[‌ ]?نویس|طراح|توسعه[‌ ]?دهنده)(?:\s+هستم|م)?[.!؟]?$/u);
  if (m) return { type: 'profile', content: `User is ${cleanCaptured(m[0].replace(/^(?:من|منم)\s+/u,'').replace(/[.!؟]?$/u,'').trim())}.`, confidence: 1, importance: .9 };

  m = value.match(/^(?:من\s+)?(?:عاشق|علاقه[‌ ]?مند به|علاقه دارم به|دوست دارم)\s+(.{2,120})[.!؟]?$/u);
  if (m) return { type: 'preference', content: `User likes ${cleanCaptured(m[1])}.`, confidence: .96, importance: .82 };

  m = value.match(/^(?:من\s+)?(?:ترجیح میدم|ترجیح می‌دم|ترجیح میدهم|ترجیح می‌دهم)\s+(.{2,160})[.!؟]?$/u);
  if (m) return { type: 'preference', content: `User prefers ${cleanCaptured(m[1])}.`, confidence: .98, importance: .9 };

  m = value.match(/^(?:از این به بعد|لطفاً از این به بعد)\s+(.{2,180})[.!؟]?$/u);
  if (m) return { type: 'communication', content: `User wants ${cleanCaptured(m[1])} from now on.`, confidence: .98, importance: .92 };

  m = value.match(/^(?:من\s+)?(?:بلدم|مسلطم به|با)\s+(.{2,120})(?:\s+کار می‌کنم|\s+کار میکنم)?[.!؟]?$/u);
  if (m && /(python|javascript|typescript|html|css|java|kotlin|swift|php|sql|react|vue|node|برنامه|کدنویسی|فتوشاپ|پریمیر)/iu.test(m[1])) {
    return { type: 'skill', content: `User has experience with ${cleanCaptured(m[1])}.`, confidence: .96, importance: .82 };
  }

  m = value.match(/^(?:هدفم(?: اینه که| اینه)?|هدف من(?: اینه که| اینه)?)\s+(.{3,180})[.!؟]?$/u);
  if (m) return { type: 'goal', content: `User's goal is ${cleanCaptured(m[1])}.`, confidence: .97, importance: .92 };

  m = value.match(/^(?:پروژه[‌ ]?م|پروژه من)\s*(?:این(?:ه|ه که)|:)?\s*(.{3,180})[.!؟]?$/u);
  if (m) return { type: 'project', content: `User's project is ${cleanCaptured(m[1])}.`, confidence: .97, importance: .9 };

  const english = value.match(/^my\s+(name|goal|project|favorite|preference)\s+(?:is|are)\s+(.{2,160})[.!]?$/i);
  if (english) {
    const map = { name:'profile', goal:'goal', project:'project', favorite:'preference', preference:'preference' };
    return { type: map[english[1].toLowerCase()] || 'fact', content: `User's ${english[1].toLowerCase()} is ${cleanCaptured(english[2])}.`, confidence: .98, importance: .9 };
  }
  return null;
}

function cleanCaptured(value) { return String(value || '').trim().replace(/[.!؟]+$/u,'').slice(0, 220); }

async function persistCandidate(env, username, data, file, candidate, conversationId = null, existingId = null) {
  const content = String(candidate.content || '').trim().slice(0, 500);
  if (!content || isSensitiveCandidate(content)) return null;
  const type = MEMORY_TYPES.has(candidate.type) ? candidate.type : 'fact';
  const confidence = clamp(Number(candidate.confidence), 0.5, 1);
  const importance = clamp(Number(candidate.importance), 0.5, 1);
  const now = new Date().toISOString();
  const existing = existingId ? data.memories.find(m => m.id === existingId) : findSimilar(data.memories, content);
  const sourcePatch = conversationId ? { chatId: String(conversationId).slice(0, 128) } : { chat: true };
  let memory;
  let action;
  if (existing) {
    existing.content = content;
    existing.type = type;
    existing.confidence = Math.max(existing.confidence || 0, confidence);
    existing.importance = Math.max(existing.importance || 0, importance);
    existing.status = 'active';
    existing.updatedAt = now;
    existing.source = { ...existing.source, ...sourcePatch };
    memory = existing;
    action = 'updated';
  } else {
    memory = { id: crypto.randomUUID(), type, content, confidence, importance, status: 'active', source: sourcePatch, createdAt: now, updatedAt: now, lastUsedAt: null };
    data.memories.unshift(memory);
    action = 'created';
  }
  data.memories = dedupeAndPrune(data.memories);
  await saveMemory(env, username, data, file, action === 'updated' ? 'Update user memory' : 'Create user memory');
  return { memory, action };
}

export async function addManualMemory(env, username, input) {
  const { file, data } = await getMemory(env, username);
  const content = String(input?.content || '').trim().slice(0, 500);
  if (!content) throw new Error('Memory content is required.');
  if (isSensitiveCandidate(content)) throw new Error('This type of information cannot be stored in Memory.');
  const existing = findSimilar(data.memories, content);
  if (existing) {
    existing.content = content;
    existing.type = MEMORY_TYPES.has(input?.type) ? input.type : existing.type;
    existing.confidence = 1;
    existing.importance = 1;
    existing.status = 'active';
    existing.updatedAt = new Date().toISOString();
    await saveMemory(env, username, data, file, 'Update memory');
    return existing;
  }
  const now = new Date().toISOString();
  const memory = { id: crypto.randomUUID(), type: MEMORY_TYPES.has(input?.type) ? input.type : 'fact', content, confidence: 1, importance: 1, status: 'active', source: { manual: true }, createdAt: now, updatedAt: now, lastUsedAt: null };
  data.memories.unshift(memory);
  data.memories = dedupeAndPrune(data.memories);
  await saveMemory(env, username, data, file, 'Add memory');
  return memory;
}

export async function updateManualMemory(env, username, id, patch) {
  const { file, data } = await getMemory(env, username);
  const memory = data.memories.find(m => m.id === id);
  if (!memory) return null;
  if (typeof patch?.content === 'string' && patch.content.trim()) {
    const content = patch.content.trim().slice(0, 500);
    if (isSensitiveCandidate(content)) throw new Error('This type of information cannot be stored in Memory.');
    memory.content = content;
  }
  if (MEMORY_TYPES.has(patch?.type)) memory.type = patch.type;
  memory.updatedAt = new Date().toISOString();
  await saveMemory(env, username, data, file, 'Update memory');
  return memory;
}

export async function deleteMemory(env, username, id) {
  const { file, data } = await getMemory(env, username);
  const before = data.memories.length;
  data.memories = data.memories.filter(m => m.id !== id);
  if (data.memories.length === before) return false;
  await saveMemory(env, username, data, file, 'Delete memory');
  return true;
}

export async function clearMemories(env, username) {
  const { file, data } = await getMemory(env, username);
  data.memories = [];
  await saveMemory(env, username, data, file, 'Clear all memories');
  return data;
}

export async function setMemoryEnabled(env, username, enabled) {
  const { file, data } = await getMemory(env, username);
  data.enabled = Boolean(enabled);
  await saveMemory(env, username, data, file, 'Update memory settings');
  return data;
}

function normalizeMemory(value) {
  const memories = Array.isArray(value?.memories) ? value.memories.filter(Boolean).map(m => ({
    id: typeof m.id === 'string' ? m.id : crypto.randomUUID(),
    type: MEMORY_TYPES.has(m.type) ? m.type : 'fact',
    content: String(m.content || '').trim().slice(0, 500),
    confidence: clamp(Number(m.confidence), 0, 1),
    importance: clamp(Number(m.importance), 0, 1),
    status: m.status === 'archived' ? 'archived' : 'active',
    source: m.source || {},
    createdAt: m.createdAt || new Date().toISOString(),
    updatedAt: m.updatedAt || new Date().toISOString(),
    lastUsedAt: m.lastUsedAt || null
  })).filter(m => m.content) : [];
  return { version: MEMORY_VERSION, enabled: value?.enabled !== false, memories };
}

function retrievalScore(memory, queryTokens) {
  const tokens = tokenize(`${memory.content} ${memory.type}`);
  if (!tokens.length) return 0;
  const overlap = queryTokens.reduce((n, t) => n + (tokens.includes(t) ? 1 : 0), 0) / queryTokens.length;
  const importance = Number(memory.importance) || 0;
  const confidence = Number(memory.confidence) || 0;
  const ageDays = Math.max(0, (Date.now() - Date.parse(memory.updatedAt || memory.createdAt)) / 86400000);
  const recency = 1 / (1 + ageDays / 30);
  return overlap * 0.55 + importance * 0.2 + confidence * 0.2 + recency * 0.05;
}

function tokenize(value) {
  return String(value || '').toLowerCase().replace(/[\u200c]/g, ' ').replace(/[^\p{L}\p{N}_+#.-]+/gu, ' ').split(/\s+/).filter(x => x.length > 1).slice(0, 80);
}

function looksLikeMemoryCandidate(text) {
  return /(من |منم |من رو |منو |من به |من از |علاقه دارم|دوست دارم|ترجیح میدم|ترجیح می‌دم|از این به بعد|یادت باشه|اسمم|اسم من|کارم|پروژه[‌ ]?م|هدفم|بلدم|میدونم|می‌دونم|my name|my goal|my project|my preference|I am |I’m |I like |I prefer |I work |remember that)/i.test(text);
}

function isSensitiveCandidate(text) {
  return /(password|passcode|api[_ -]?key|token|secret|کلمه عبور|رمز عبور|رمز ورود|شماره کارت|cvv|debit|credit card|ip address|آدرس آی ?پی|medical|diagnos|درمان|بیماری|دارو|مذهب|دین|سیاسی|سیاست|sexual|جنسی)/i.test(text);
}

function findSimilar(memories, content) {
  const q = tokenize(content);
  let best = null, bestScore = 0;
  for (const m of memories.filter(x => x.status === 'active')) {
    const score = retrievalScore(m, q);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return bestScore >= 0.48 ? best : null;
}

function dedupeAndPrune(memories) {
  const out = [], seen = new Set();
  for (const m of memories.sort((a,b) => (b.importance||0) - (a.importance||0))) {
    const key = tokenize(m.content).sort().join('|');
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(m);
  }
  return out.slice(0, MEMORY_MAX);
}

function parseJsonObject(raw) {
  try { return JSON.parse(raw); } catch {}
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function githubFile(env, path) {
  const r = await fetch(`https://api.github.com/repos/amirsepehr2020/redlighte-data/contents/${path}?ref=main`, { headers: githubHeaders(env) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${r.status}`);
  const x = await r.json();
  const bytes = Uint8Array.from(atob(x.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  return { sha: x.sha, content: new TextDecoder().decode(bytes) };
}

async function githubWrite(env, path, data, sha, message) {
  const content = toBase64(JSON.stringify(data, null, 2));
  const r = await fetch(`https://api.github.com/repos/amirsepehr2020/redlighte-data/contents/${path}`, { method: 'PUT', headers: { ...githubHeaders(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content, branch: 'main', ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
}

function githubHeaders(env) {
  return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Redlighte' };
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

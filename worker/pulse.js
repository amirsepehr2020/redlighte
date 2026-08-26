const PULSE_VERSION = 1;
const MAX_ACTIVE_ITEMS = 12;
const MAX_PROJECTS = 8;
const MAX_CONTEXT_MEMORIES = 8;
const CONTEXT_MAX_CHARS = 3600;

export async function getPulse(env, username) {
  const file = await githubFile(env, `users/${username}/pulse.json`);
  if (!file) return { file: null, data: emptyPulse() };
  try { return { file, data: normalizePulse(JSON.parse(file.content)) }; }
  catch { return { file, data: emptyPulse() }; }
}

export async function savePulse(env, username, data, file, message = 'Update user Pulse') {
  const clean = normalizePulse(data);
  await githubWrite(env, `users/${username}/pulse.json`, clean, file?.sha || null, message);
  return clean;
}

export async function resolvePulseContext(env, username, input, recentMessages = []) {
  if (!username || typeof input !== 'string') return { data: emptyPulse(), context: '', selectedMemories: [] };
  const snapshot = await getPulse(env, username);
  const data = snapshot.data;
  if (!data.enabled) return { data, context: '', selectedMemories: [] };

  const current = normalizeText(input);
  const recentText = recentMessages.slice(-8).map(m => typeof m?.content === 'string' ? m.content : '').join(' ');
  const topic = detectTopic(current, recentText, data.activeContext);
  const intent = detectIntent(current);
  const project = detectProject(data, current);
  const selectedMemories = scoreMemories(data, current, MAX_CONTEXT_MEMORIES);
  const activeItems = buildActiveItems(current, topic, intent, project, selectedMemories);

  data.activeContext = {
    topic,
    intent,
    summary: summarizeContext(current, topic, intent, project),
    confidence: topicConfidence(current, topic),
    updatedAt: new Date().toISOString()
  };
  data.projectContext = project ? {
    projectId: project.id,
    projectName: project.name,
    active: true,
    updatedAt: new Date().toISOString()
  } : { projectId: null, projectName: null, active: false, updatedAt: new Date().toISOString() };
  data.signals = {
    conversationDepth: Math.max(0, recentMessages.length),
    topicStability: topic === data._previousTopic ? Math.min(1, Number(data.signals.topicStability || 0.5) + 0.08) : 0.42,
    memoryDemand: selectedMemories.length ? Math.min(1, selectedMemories[0].score) : 0
  };
  data._previousTopic = topic;
  data.activeItems = activeItems;
  data.updatedAt = new Date().toISOString();

  const context = buildPulseContext(data, selectedMemories);
  return { data, file: snapshot.file, context, selectedMemories };
}

export async function commitPulseAfterChat(env, username, pulseData, file, input, assistantAnswer = '') {
  if (!username || !pulseData?.enabled) return null;
  const data = normalizePulse(pulseData);
  const topic = data.activeContext?.topic || detectTopic(input, '', data.activeContext);
  const now = new Date().toISOString();
  data.history = Array.isArray(data.history) ? data.history : [];
  data.history.push({ topic, intent: data.activeContext?.intent || 'general', timestamp: now });
  data.history = data.history.slice(-20);
  data.activeContext.updatedAt = now;
  data.updatedAt = now;
  data.metrics = {
    messagesProcessed: Number(data.metrics?.messagesProcessed || 0) + 1,
    contextResolutions: Number(data.metrics?.contextResolutions || 0) + 1,
    lastProcessedAt: now
  };
  data.lastAnswerSignal = answerSignal(assistantAnswer);
  delete data._previousTopic;
  return savePulse(env, username, data, file, 'Update Pulse context');
}

export async function updatePulseSettings(env, username, enabled) {
  const snapshot = await getPulse(env, username);
  snapshot.data.enabled = Boolean(enabled);
  snapshot.data.updatedAt = new Date().toISOString();
  return savePulse(env, username, snapshot.data, snapshot.file, 'Update Pulse settings');
}

export function publicPulse(data) {
  const clean = normalizePulse(data);
  return {
    version: clean.version,
    enabled: clean.enabled,
    activeContext: clean.activeContext,
    projectContext: clean.projectContext,
    signals: clean.signals,
    activeItems: clean.activeItems,
    metrics: clean.metrics,
    updatedAt: clean.updatedAt
  };
}

function emptyPulse() {
  return {
    version: PULSE_VERSION,
    enabled: true,
    activeContext: { topic: 'General conversation', intent: 'general', summary: '', confidence: 0, updatedAt: null },
    projectContext: { projectId: null, projectName: null, active: false, updatedAt: null },
    signals: { conversationDepth: 0, topicStability: 0, memoryDemand: 0 },
    activeItems: [],
    projects: [],
    history: [],
    metrics: { messagesProcessed: 0, contextResolutions: 0, lastProcessedAt: null },
    updatedAt: null
  };
}

function normalizePulse(value) {
  const base = emptyPulse();
  const data = value && typeof value === 'object' ? value : {};
  return {
    ...base,
    ...data,
    version: PULSE_VERSION,
    enabled: data.enabled !== false,
    activeContext: { ...base.activeContext, ...(data.activeContext || {}) },
    projectContext: { ...base.projectContext, ...(data.projectContext || {}) },
    signals: { ...base.signals, ...(data.signals || {}) },
    activeItems: Array.isArray(data.activeItems) ? data.activeItems.slice(-MAX_ACTIVE_ITEMS) : [],
    projects: Array.isArray(data.projects) ? data.projects.slice(-MAX_PROJECTS) : [],
    history: Array.isArray(data.history) ? data.history.slice(-20) : [],
    metrics: { ...base.metrics, ...(data.metrics || {}) }
  };
}

function detectTopic(input, recentText, previous) {
  const text = `${input} ${recentText}`.trim();
  const groups = [
    ['authentication', ['login','signup','sign in','sign up','session','cookie','password','auth','ورود','ثبت نام','لاگین','رمز','سشن']],
    ['memory', ['memory','memories','یادآوری','مموری','حافظه']],
    ['cloudflare', ['cloudflare','worker','workers','کلادفلر','ورکر']],
    ['github', ['github','repo','repository','گیتهاب','ریپو']],
    ['android', ['android','apk','اندروید','اپلیکیشن']],
    ['design', ['ui','ux','design','ظاهر','طراحی','رابط']],
    ['coding', ['code','coding','javascript','python','html','css','کدنویسی','کد']],
    ['travel', ['travel','trip','سفر','ایتالیا','دانشگاه']],
    ['minecraft', ['minecraft','ماینکرفت','سرور']],
    ['content creation', ['instagram','youtube','video','reel','اینستاگرام','ویدیو','ریلز']],
  ];
  let best = { topic: previous?.topic || 'General conversation', score: 0 };
  for (const [name, words] of groups) {
    let score = 0;
    for (const word of words) if (text.toLowerCase().includes(word.toLowerCase())) score += word.length > 4 ? 2 : 1;
    if (score > best.score) best = { topic: name, score };
  }
  if (best.score === 0 && previous?.topic && previous.topic !== 'General conversation' && input.length < 90) return previous.topic;
  return best.topic;
}

function detectIntent(input) {
  const t = input.toLowerCase();
  if (/\b(debug|fix|error|bug|issue|broken|خطا|مشکل|درست کن|دیباگ)\b/i.test(t)) return 'debugging';
  if (/\b(build|create|make|implement|add|بساز|اضافه کن|پیاده سازی|پیاده‌سازی)\b/i.test(t)) return 'building';
  if (/\b(explain|what is|how|چیه|چیست|چطور|چجوری|توضیح)\b/i.test(t)) return 'learning';
  if (/\b(compare|vs|مقایسه|فرق)\b/i.test(t)) return 'comparison';
  if (/\b(plan|roadmap|برنامه|طراحی معماری)\b/i.test(t)) return 'planning';
  return 'general';
}

function detectProject(data, input) {
  const candidates = Array.isArray(data.projects) ? data.projects : [];
  const tokens = tokenize(input);
  let best = null;
  let bestScore = 0;
  for (const project of candidates) {
    const score = overlap(tokens, tokenize(`${project.name || ''} ${project.keywords || ''}`));
    if (score > bestScore) { bestScore = score; best = project; }
  }
  if (best) return best;
  const projectWords = input.match(/(?:روی|on|project|پروژه)\s+([\p{L}\p{N}._-]{2,60})/iu);
  if (projectWords) return { id: slug(projectWords[1]), name: projectWords[1], keywords: projectWords[1] };
  return null;
}

function scoreMemories(data, input, limit) {
  const memories = Array.isArray(data?.memorySnapshot) ? data.memorySnapshot : [];
  if (!memories.length) return [];
  const q = tokenize(input);
  return memories.map(memory => {
    const relevance = overlap(q, tokenize(`${memory.content || ''} ${memory.key || ''} ${memory.type || ''}`));
    const importance = Number(memory.importance || 0.5);
    const confidence = Number(memory.confidence || 0.5);
    const recency = recencyScore(memory.updatedAt || memory.lastUsedAt || memory.createdAt);
    const score = relevance * 0.4 + importance * 0.25 + confidence * 0.2 + recency * 0.15;
    return { ...memory, score };
  }).filter(x => x.score >= 0.08).sort((a,b) => b.score - a.score).slice(0, limit);
}

function buildActiveItems(input, topic, intent, project, memories) {
  const items = [
    { type: 'topic', value: topic, score: 1 },
    { type: 'intent', value: intent, score: 0.95 }
  ];
  if (project) items.push({ type: 'project', value: project.name, score: 0.9 });
  for (const memory of memories.slice(0, 5)) items.push({ type: 'memory', value: memory.content, score: Number(memory.score.toFixed(3)) });
  return items.slice(0, MAX_ACTIVE_ITEMS);
}

function buildPulseContext(data, selectedMemories) {
  const lines = [
    '[REDLIGHTE PULSE]',
    `Current topic: ${data.activeContext.topic}`,
    `Intent: ${data.activeContext.intent}`,
    data.projectContext?.active ? `Active project: ${data.projectContext.projectName}` : '',
    data.activeContext.summary ? `Context summary: ${data.activeContext.summary}` : ''
  ].filter(Boolean);
  if (selectedMemories.length) {
    lines.push('High-relevance memory:');
    for (const memory of selectedMemories) lines.push(`- ${memory.content}`);
  }
  lines.push('[END REDLIGHTE PULSE]');
  return lines.join('\n').slice(0, CONTEXT_MAX_CHARS);
}

function summarizeContext(input, topic, intent, project) {
  const clean = normalizeText(input).slice(0, 180);
  return `${intent} request about ${topic}${project ? ` in ${project.name}` : ''}: ${clean}`.slice(0, 360);
}

function topicConfidence(input, topic) {
  if (topic === 'General conversation') return 0.35;
  const strong = ['authentication','memory','cloudflare','github','android','minecraft'].includes(topic);
  return strong && input.length > 8 ? 0.9 : 0.72;
}

function answerSignal(answer) {
  const text = normalizeText(answer);
  return { length: text.length, hasCode: /```/.test(answer), hasList: /(^|\n)\s*[-*]\s/.test(answer) };
}

function tokenize(value) {
  return normalizeText(value).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(x => x.length >= 2).slice(0, 120);
}
function overlap(a, b) { if (!a.length || !b.length) return 0; const set = new Set(b); let hit = 0; for (const x of a) if (set.has(x)) hit++; return Math.min(1, hit / Math.max(3, Math.min(a.length, 12))); }
function recencyScore(value) { if (!value) return 0.4; const age = Math.max(0, Date.now() - new Date(value).getTime()); return Math.max(0.05, Math.exp(-age / 1000 / 60 / 60 / 24 / 30)); }
function normalizeText(value) { return String(value || '').trim().replace(/[يى]/g,'ی').replace(/[ك]/g,'ک').replace(/\s+/g,' '); }
function slug(value) { return normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,80) || crypto.randomUUID(); }

async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/amirsepehr2020/redlighte-data/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(String(x.content||'').replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)}}
async function githubWrite(env,path,data,sha,message){const content=toBase64(JSON.stringify(data,null,2));const r=await fetch(`https://api.github.com/repos/amirsepehr2020/redlighte-data/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`)}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Redlighte'}}
function toBase64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}

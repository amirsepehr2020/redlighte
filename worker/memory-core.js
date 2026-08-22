const MEMORY_VERSION = 3;
const MEMORY_MAX = 200;
const MEMORY_CONTEXT_MAX = 8;
const MEMORY_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const MEMORY_TYPES = new Set(['profile','preference','skill','goal','project','communication','fact']);

const SENSITIVE_PATTERNS = [
  /password|passcode|api[_ -]?key|token|secret|private key/i,
  /کلمه عبور|رمز عبور|رمز ورود|رمز اکانت|کلید api|توکن|سکرت/i,
  /credit card|debit card|cvv|cvc|شماره کارت|شماره شبا/i,
  /ip address|آدرس آی ?پی/i,
  /medical|diagnos|treatment|medication|بیماری|تشخیص پزشکی|درمان|دارو/i,
  /sexual|sex life|جنسی/i
];

export async function getMemory(env, username) {
  const file = await githubFile(env, `users/${username}/memory.json`);
  if (!file) return { file: null, data: emptyMemory() };
  try { return { file, data: normalizeMemory(JSON.parse(file.content)) }; }
  catch { return { file, data: emptyMemory() }; }
}

export async function saveMemory(env, username, data, file, message = 'Update user memory') {
  const clean = normalizeMemory(data);
  clean.memories = dedupeAndPrune(clean.memories);
  await githubWrite(env, `users/${username}/memory.json`, clean, file?.sha || null, message);
  return clean;
}

export function retrieveMemories(data, query, limit = MEMORY_CONTEXT_MAX) {
  if (!data?.enabled || !Array.isArray(data.memories)) return [];
  const q = tokenize(query);
  if (!q.length) return [];
  return data.memories.filter(m => m.status === 'active')
    .map(memory => ({ memory, score: retrievalScore(memory, q) }))
    .filter(x => x.score >= 0.06)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, MEMORY_CONTEXT_MAX))
    .map(x => ({ ...x.memory, retrievalScore: Number(x.score.toFixed(4)) }));
}

export function buildMemoryContext(memories) {
  if (!memories?.length) return '';
  return `[RELEVANT USER MEMORY]\n${memories.map(m => `- ${m.content}`).join('\n')}\n[END USER MEMORY]`;
}

export async function extractAndMergeMemory(env, username, userMessage, recentMessages = [], conversationId = null) {
  if (!env.AI || !username || typeof userMessage !== 'string') return null;
  const value = normalizeText(userMessage);
  if (value.length < 3 || isSensitiveCandidate(value)) return null;

  const { file, data } = await getMemory(env, username);
  if (!data.enabled) return null;

  // High-confidence local extraction: no model dependency for obvious user facts/preferences.
  const deterministic = detectExplicitMemory(value);
  if (deterministic) return persistCandidate(env, username, data, file, deterministic, conversationId);

  // Every other meaningful message is analyzed. There is deliberately no regex gate.
  const context = data.memories.filter(m => m.status === 'active')
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 80)
    .map(m => ({ id: m.id, key: m.key, type: m.type, content: m.content, importance: m.importance, confidence: m.confidence }));

  const prompt = `You are Redlighte's long-term memory decision engine.
Analyze EVERY latest user message and decide whether it contains durable user-specific information that would make future conversations more useful.

REMEMBER when the user explicitly states or clearly expresses:
- identity/background (name, family name, age if appropriate, occupation/student status, stable background)
- likes, dislikes, favorite things, tastes and recurring preferences (favorite color, food, music, games, subjects, places, etc.)
- communication preferences (tone, language, length, style, formatting, how Redlighte should talk)
- skills, technologies, knowledge and experience
- long-term goals and plans
- ongoing projects and recurring work
- other stable facts that will help future conversations

Examples that MUST be remembered:
"اسمم سپهره" -> profile
"اسم و فامیلیم سپهر احمدیه" -> profile
"رنگ مورد علاقه‌م سبزه" -> preference
"ریاضی رو دوست دارم" -> preference
"غذای مورد علاقه‌م قیمه‌ست" -> preference
"با من خودمونی حرف بزن" -> communication
"من Python بلدم" -> skill
"هدفم انتشار Redlighte است" -> goal
"دارم روی Redlighte کار می‌کنم" -> project

Do NOT remember greetings, questions, one-off requests, transient events, temporary states, jokes, or information useful only for the current turn.
Do not infer facts not stated by the user.
Never store passwords, API keys, tokens, private keys, financial credentials, exact IP addresses, device identifiers, medical information, sexual information, or similarly sensitive data.

Allowed types: profile, preference, skill, goal, project, communication, fact.

Existing memory rules:
- Update an existing memory when the user corrects, changes, or supersedes it.
- Do not duplicate the same fact/preference/project/goal.
- If a new statement is genuinely different, create a separate memory.
- Prefer the latest explicit user statement when it conflicts with an older one.

Return ONLY JSON, with no markdown:
{"remember":false}
OR
{"remember":true,"action":"create|update","existingId":null,"key":"stable key","type":"preference","content":"short durable statement","confidence":0.98,"importance":0.9}

Existing memories:
${JSON.stringify(context)}

LATEST USER MESSAGE:
${value}

RECENT CONVERSATION:
${JSON.stringify(recentMessages.slice(-8))}`;

  try {
    const result = await env.AI.run(MEMORY_MODEL, {
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 420,
      temperature: 0
    });
    const raw = result?.response || result?.result?.response || '';
    const candidate = parseJsonObject(raw);
    if (!candidate?.remember || typeof candidate.content !== 'string') return null;

    const content = cleanCaptured(candidate.content);
    if (!content || isSensitiveCandidate(content)) return null;
    const confidence = clamp(Number(candidate.confidence), 0.65, 1);
    const importance = clamp(Number(candidate.importance), 0.65, 1);
    if (confidence < 0.65 || importance < 0.65) return null;

    const type = MEMORY_TYPES.has(candidate.type) ? candidate.type : 'fact';
    return persistCandidate(env, username, data, file, {
      key: normalizeKey(candidate.key || inferKey(content, type)),
      type, content, confidence, importance
    }, conversationId, typeof candidate.existingId === 'string' ? candidate.existingId : null);
  } catch (error) {
    console.error('MEMORY_EXTRACTION_ERROR', error);
    return null;
  }
}

function detectExplicitMemory(text) {
  const value = normalizeText(text);
  let m;

  m = value.match(/^(?:اسمم|اسم من|نامم|نام من)\s*(?:این(?:ه|ه که)|:)?\s*([\p{L}][\p{L}\u200c .'-]{1,80})[.!؟]?$/u);
  if (m) return { key: 'profile.name', type: 'profile', content: `User's name is ${cleanCaptured(m[1])}.`, confidence: 1, importance: 1 };
  m = value.match(/^(?:اسم و فامیلیم|اسم و نام خانوادگیم|نام و نام خانوادگی(?:م)?|نام کامل(?:م)?)\s*(?:این(?:ه|ه که)|:)?\s*([\p{L}][\p{L}\u200c .'-]{2,100})[.!؟]?$/u);
  if (m) return { key: 'profile.full_name', type: 'profile', content: `User's full name is ${cleanCaptured(m[1])}.`, confidence: 1, importance: 1 };
  m = value.match(/^(?:فامیلیم|نام خانوادگی(?:م)?)\s*(?:این(?:ه|ه که)|:)?\s*([\p{L}][\p{L}\u200c .'-]{1,60})[.!؟]?$/u);
  if (m) return { key: 'profile.family_name', type: 'profile', content: `User's family name is ${cleanCaptured(m[1])}.`, confidence: 1, importance: 1 };

  m = value.match(/^(?:رنگ(?:ِ| )?مورد علاقه(?:‌م| ام)?|رنگ مورد علاقم)\s*(?:این(?:ه|ه که)|:)?\s*(.{2,100})[.!؟]?$/u);
  if (m) return preference('favorite_color', `User's favorite color is ${cleanCaptured(m[1])}.`, .98, .9);
  m = value.match(/^(?:غذای مورد علاقه(?:‌م| ام)?|غذای مورد علاقم)\s*(?:این(?:ه|ه که)|:)?\s*(.{2,120})[.!؟]?$/u);
  if (m) return preference('favorite_food', `User's favorite food is ${cleanCaptured(m[1])}.`, .98, .88);
  m = value.match(/^(?:موسیقی|خواننده|سریال|فیلم|بازی|درس|ورزش|کشور|شهر)\s*(?:مورد علاقه(?:‌م| ام)?|مورد علاقم)\s*(?:این(?:ه|ه که)|:)?\s*(.{2,140})[.!؟]?$/u);
  if (m) return preference(`favorite.${normalizeKey(value.split(/\s+/)[0])}`, `User's favorite ${cleanCaptured(value.split(/\s+/)[0])} is ${cleanCaptured(m[1])}.`, .98, .86);
  m = value.match(/^(?:من\s+)?(?:عاشق|علاقه[‌ ]?مند به|علاقه دارم به|دوست دارم|خیلی دوست دارم)\s+(.{2,160})[.!؟]?$/u);
  if (m) return preference(`likes.${normalizeKey(m[1]).slice(0,100)}`, `User likes ${cleanCaptured(m[1])}.`, .98, .84);
  m = value.match(/^(?:من\s+)?(?:از)\s+(.{2,160})\s+(?:خوشم نمیاد|بدم میاد|متنفرم)[.!؟]?$/u);
  if (m) return preference(`dislikes.${normalizeKey(m[1]).slice(0,100)}`, `User dislikes ${cleanCaptured(m[1])}.`, .98, .84);
  m = value.match(/^(?:من\s+)?(?:از)\s+(.{2,160})\s+(?:خیلی خوشم میاد|خوشم میاد)[.!؟]?$/u);
  if (m) return preference(`likes.${normalizeKey(m[1]).slice(0,100)}`, `User likes ${cleanCaptured(m[1])}.`, .98, .84);
  m = value.match(/^(?:من\s+)?(?:ترجیح میدم|ترجیح می‌دم|ترجیح میدهم|ترجیح می‌دهم)\s+(.{2,180})[.!؟]?$/u);
  if (m) return preference(`prefers.${normalizeKey(m[1]).slice(0,100)}`, `User prefers ${cleanCaptured(m[1])}.`, .98, .9);

  m = value.match(/^(?:با من|لطفاً با من|از این به بعد با من)\s+(.{2,200})[.!؟]?$/u);
  if (m && /(حرف|صحبت|جواب|پاسخ|رفتار|لحن|بگو|بنویس|صدا|فارسی|انگلیسی|کوتاه|مختصر|طولانی|خودمونی|رسمی|دوستانه)/iu.test(value)) {
    return { key: 'communication.style', type: 'communication', content: `User wants ${cleanCaptured(m[1])} when communicating.`, confidence: .99, importance: .94 };
  }
  m = value.match(/^(?:از این به بعد|لطفاً از این به بعد)\s+(.{2,200})[.!؟]?$/u);
  if (m && /(جواب|پاسخ|حرف|لحن|بنویس|بگو|فارسی|انگلیسی|کوتاه|مختصر|طولانی|خودمونی|رسمی|دوستانه)/iu.test(value)) {
    return { key: 'communication.preference', type: 'communication', content: `User wants ${cleanCaptured(m[1])} from now on.`, confidence: .99, importance: .94 };
  }

  m = value.match(/^(?:من\s+)?(?:بلدم|مسلطم به)\s+(.{2,160})[.!؟]?$/u);
  if (m) return { key: `skill.${normalizeKey(m[1]).slice(0,100)}`, type: 'skill', content: `User knows ${cleanCaptured(m[1])}.`, confidence: .98, importance: .84 };
  m = value.match(/^(?:من\s+)?با\s+(.{2,160})\s+(?:کار می‌کنم|کار میکنم|کار کردم)[.!؟]?$/u);
  if (m) return { key: `skill.${normalizeKey(m[1]).slice(0,100)}`, type: 'skill', content: `User has experience with ${cleanCaptured(m[1])}.`, confidence: .95, importance: .82 };
  m = value.match(/^(?:هدفم(?: اینه(?: که)?)?|هدف من(?: اینه(?: که)?)?)\s+(.{3,200})[.!؟]?$/u);
  if (m) return { key: `goal.${normalizeKey(m[1]).slice(0,100)}`, type: 'goal', content: `User's goal is ${cleanCaptured(m[1])}.`, confidence: .99, importance: .94 };
  m = value.match(/^(?:دارم روی|روی)\s+(.{2,180})\s+(?:کار می‌کنم|کار میکنم)[.!؟]?$/u);
  if (m) return { key: `project.${normalizeKey(m[1]).slice(0,100)}`, type: 'project', content: `User is working on ${cleanCaptured(m[1])}.`, confidence: .98, importance: .9 };

  m = value.match(/^my\s+(full\s+name|name|last\s+name|family\s+name)\s+(?:is|are)\s+(.{2,120})[.!]?$/i);
  if (m) return { key: m[1].toLowerCase().includes('last') || m[1].toLowerCase().includes('family') ? 'profile.family_name' : m[1].toLowerCase().includes('full') ? 'profile.full_name' : 'profile.name', type: 'profile', content: `User's ${m[1].toLowerCase()} is ${cleanCaptured(m[2])}.`, confidence: 1, importance: 1 };
  m = value.match(/^my\s+(favorite\s+\w+|favorite|preference)\s+(?:is|are)\s+(.{2,160})[.!]?$/i);
  if (m) return preference(`favorite.${normalizeKey(m[1])}`, `User's ${m[1].toLowerCase()} is ${cleanCaptured(m[2])}.`, .99, .9);
  m = value.match(/^(?:I|I’m|I'm)\s+(?:really\s+)?(like|love|prefer|hate|dislike)\s+(.{2,180})[.!]?$/i);
  if (m) return preference(`${/hate|dislike/i.test(m[1]) ? 'dislikes' : 'likes'}.${normalizeKey(m[2]).slice(0,100)}`, `User ${/hate|dislike/i.test(m[1]) ? 'dislikes' : 'likes'} ${cleanCaptured(m[2])}.`, .98, .84);
  m = value.match(/^(?:from now on|please)\s+(.{2,200})[.!]?$/i);
  if (m && /(talk|speak|answer|respond|reply|write|tone|style|short|brief|detailed)/i.test(value)) return { key: 'communication.style', type: 'communication', content: `User wants ${cleanCaptured(m[1])} when communicating.`, confidence: .99, importance: .94 };

  return null;
}

function preference(key, content, confidence, importance) {
  return { key: `preference.${key}`, type: 'preference', content, confidence, importance };
}

async function persistCandidate(env, username, data, file, candidate, conversationId = null, existingId = null) {
  const content = cleanCaptured(candidate.content);
  if (!content || isSensitiveCandidate(content)) return null;
  const type = MEMORY_TYPES.has(candidate.type) ? candidate.type : 'fact';
  const confidence = clamp(Number(candidate.confidence), .5, 1);
  const importance = clamp(Number(candidate.importance), .5, 1);
  const key = normalizeKey(candidate.key || inferKey(content, type));
  const now = new Date().toISOString();

  let existing = existingId ? data.memories.find(m => m.id === existingId && m.status === 'active') : null;
  if (!existing) existing = findExistingMemory(data.memories, key, type, content);
  const sourcePatch = conversationId ? { chat: true, chatId: String(conversationId).slice(0,128) } : { chat: true };
  let memory, action;

  if (existing) {
    const nextConfidence = Math.max(Number(existing.confidence)||0, confidence);
    const nextImportance = Math.max(Number(existing.importance)||0, importance);
    const changed = existing.content !== content || existing.type !== type || existing.key !== key || Number(existing.confidence) !== nextConfidence || Number(existing.importance) !== nextImportance;
    if (!changed) return null;
    existing.content = content; existing.type = type; existing.key = key || existing.key || null;
    existing.confidence = nextConfidence; existing.importance = nextImportance; existing.status = 'active'; existing.updatedAt = now; existing.source = { ...existing.source, ...sourcePatch };
    memory = existing; action = 'updated';
  } else {
    memory = { id: crypto.randomUUID(), key: key || null, type, content, confidence, importance, status: 'active', source: sourcePatch, createdAt: now, updatedAt: now, lastUsedAt: null };
    data.memories.unshift(memory); action = 'created';
  }
  data.memories = dedupeAndPrune(data.memories);
  await saveMemory(env, username, data, file, action === 'created' ? 'Create user memory' : 'Update user memory');
  return { memory, action };
}

export async function addManualMemory(env, username, input) {
  const { file, data } = await getMemory(env, username); const content = cleanCaptured(input?.content);
  if (!content) throw new Error('Memory content is required.'); if (isSensitiveCandidate(content)) throw new Error('This type of information cannot be stored in Memory.');
  const type = MEMORY_TYPES.has(input?.type) ? input.type : 'fact'; const key = normalizeKey(input?.key || inferKey(content, type)); const existing = findExistingMemory(data.memories, key, type, content);
  if (existing) { existing.content=content; existing.type=type; existing.key=key||existing.key||null; existing.confidence=1; existing.importance=1; existing.status='active'; existing.updatedAt=new Date().toISOString(); await saveMemory(env,username,data,file,'Update memory'); return existing; }
  const now=new Date().toISOString(); const memory={id:crypto.randomUUID(),key:key||null,type,content,confidence:1,importance:1,status:'active',source:{manual:true},createdAt:now,updatedAt:now,lastUsedAt:null};
  data.memories.unshift(memory); data.memories=dedupeAndPrune(data.memories); await saveMemory(env,username,data,file,'Add memory'); return memory;
}

export async function updateManualMemory(env, username, id, patch) {
  const { file, data } = await getMemory(env, username); const memory=data.memories.find(m=>m.id===id); if(!memory)return null;
  if(typeof patch?.content==='string'&&patch.content.trim()){const content=cleanCaptured(patch.content);if(isSensitiveCandidate(content))throw new Error('This type of information cannot be stored in Memory.');memory.content=content;}
  if(MEMORY_TYPES.has(patch?.type))memory.type=patch.type; if(typeof patch?.key==='string')memory.key=normalizeKey(patch.key); memory.updatedAt=new Date().toISOString(); await saveMemory(env,username,data,file,'Update memory'); return memory;
}
export async function deleteMemory(env, username, id){const {file,data}=await getMemory(env,username);const before=data.memories.length;data.memories=data.memories.filter(m=>m.id!==id);if(data.memories.length===before)return false;await saveMemory(env,username,data,file,'Delete memory');return true;}
export async function clearMemories(env, username){const {file,data}=await getMemory(env,username);data.memories=[];await saveMemory(env,username,data,file,'Clear all memories');return data;}
export async function setMemoryEnabled(env, username, enabled){const {file,data}=await getMemory(env,username);data.enabled=Boolean(enabled);await saveMemory(env,username,data,file,'Update memory settings');return data;}

function emptyMemory(){return{version:MEMORY_VERSION,enabled:true,memories:[]};}
function normalizeMemory(value){const memories=Array.isArray(value?.memories)?value.memories.filter(Boolean).map(m=>({id:typeof m.id==='string'?m.id:crypto.randomUUID(),key:typeof m.key==='string'?normalizeKey(m.key):null,type:MEMORY_TYPES.has(m.type)?m.type:'fact',content:cleanCaptured(m.content),confidence:clamp(Number(m.confidence),0,1),importance:clamp(Number(m.importance),0,1),status:m.status==='archived'?'archived':'active',source:m.source&&typeof m.source==='object'?m.source:{},createdAt:m.createdAt||new Date().toISOString(),updatedAt:m.updatedAt||new Date().toISOString(),lastUsedAt:m.lastUsedAt||null})).filter(m=>m.content&&!isSensitiveCandidate(m.content)):[];return{version:MEMORY_VERSION,enabled:value?.enabled!==false,memories:dedupeAndPrune(memories)};}
function retrievalScore(memory,queryTokens){const tokens=tokenize(`${memory.content} ${memory.key||''} ${memory.type}`);if(!tokens.length)return 0;const overlap=queryTokens.reduce((n,t)=>n+(tokens.includes(t)?1:0),0)/queryTokens.length;const importance=Number(memory.importance)||0,confidence=Number(memory.confidence)||0;const ageDays=Math.max(0,(Date.now()-Date.parse(memory.updatedAt||memory.createdAt))/86400000),recency=1/(1+ageDays/30);return overlap*.55+importance*.2+confidence*.2+recency*.05;}
function tokenize(value){return String(value||'').toLowerCase().replace(/[\u200c]/g,' ').replace(/[يى]/g,'ی').replace(/[ك]/g,'ک').replace(/[^\p{L}\p{N}_+#.-]+/gu,' ').split(/\s+/).filter(x=>x.length>1).slice(0,100);}
function findExistingMemory(memories,key,type,content){const active=memories.filter(m=>m.status==='active');if(key){const keyed=active.find(m=>m.key&&m.key===key);if(keyed)return keyed;}const qt=tokenize(content);let best=null,bestScore=0;for(const memory of active){if(memory.type!==type)continue;const score=semanticOverlap(memory.content,qt);if(score>bestScore){bestScore=score;best=memory;}}return bestScore>=.82?best:null;}
function semanticOverlap(content,queryTokens){const tokens=new Set(tokenize(content));if(!tokens.size||!queryTokens.length)return 0;return queryTokens.filter(t=>tokens.has(t)).length/Math.max(tokens.size,queryTokens.length);}
function dedupeAndPrune(memories){const out=[],seenKeys=new Set(),seenContent=new Set();const ordered=memories.filter(Boolean).sort((a,b)=>{const i=(Number(b.importance)||0)-(Number(a.importance)||0);return i||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));});for(const memory of ordered){if(!memory.content)continue;const key=memory.key?normalizeKey(memory.key):'',ck=tokenize(memory.content).sort().join('|');if((key&&seenKeys.has(key))||(ck&&seenContent.has(ck)))continue;if(key)seenKeys.add(key);if(ck)seenContent.add(ck);out.push(memory);if(out.length>=MEMORY_MAX)break;}return out;}
function inferKey(content,type){const tokens=tokenize(content).slice(0,8).join('.');return tokens?`${type}.${tokens}`:type;}
function normalizeKey(value){return String(value||'').trim().toLowerCase().replace(/[\u200c\s]+/g,'.').replace(/[^\p{L}\p{N}._-]+/gu,'').slice(0,180);}
function normalizeText(value){return String(value||'').trim().replace(/[يى]/g,'ی').replace(/[ك]/g,'ک').replace(/\s+/g,' ');}
function cleanCaptured(value){return String(value||'').trim().replace(/^[`"'«]+|[`"'»]+$/g,'').replace(/[.!؟]+$/u,'').trim().slice(0,500);}
function isSensitiveCandidate(text){return SENSITIVE_PATTERNS.some(pattern=>pattern.test(String(text||'')));}
function parseJsonObject(raw){try{return JSON.parse(raw);}catch{}const match=String(raw).match(/\{[\s\S]*\}/);if(!match)return null;try{return JSON.parse(match[0]);}catch{return null;}}
function clamp(value,min,max){if(!Number.isFinite(value))return min;return Math.min(max,Math.max(min,value));}
async function githubFile(env,path){const r=await fetch(`https://api.github.com/repos/amirsepehr2020/redlighte-data/contents/${path}?ref=main`,{headers:githubHeaders(env)});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${r.status}`);const x=await r.json();const bytes=Uint8Array.from(atob(x.content.replace(/\n/g,'')),c=>c.charCodeAt(0));return{sha:x.sha,content:new TextDecoder().decode(bytes)};}
async function githubWrite(env,path,data,sha,message){const content=toBase64(JSON.stringify(data,null,2));const r=await fetch(`https://api.github.com/repos/amirsepehr2020/redlighte-data/contents/${path}`,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content,branch:'main',...(sha?{sha}:{})})});if(!r.ok)throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);}
function githubHeaders(env){return{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Redlighte'};}
function toBase64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}

import * as core from './memory-core.js';

const MEMORY_ANALYZER_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const MEMORY_TYPES = new Set(['profile','preference','skill','goal','project','communication','fact']);

export const getMemory = core.getMemory;
export const saveMemory = core.saveMemory;
export const retrieveMemories = core.retrieveMemories;
export const buildMemoryContext = core.buildMemoryContext;
export const addManualMemory = core.addManualMemory;
export const updateManualMemory = core.updateManualMemory;
export const deleteMemory = core.deleteMemory;
export const clearMemories = core.clearMemories;
export const setMemoryEnabled = core.setMemoryEnabled;

export async function extractAndMergeMemory(env, username, userMessage, recentMessages = [], conversationId = null) {
  if (!env?.AI || !username || typeof userMessage !== 'string') return null;
  const input = userMessage.trim();
  if (input.length < 3) return null;

  const { data } = await core.getMemory(env, username);
  if (!data.enabled) return null;

  const existing = data.memories.filter(m => m.status === 'active')
    .sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0))
    .slice(0, 100)
    .map(m => ({ id: m.id, key: m.key, type: m.type, content: m.content, confidence: m.confidence, importance: m.importance }));

  const prompt = `You are Redlighte's dedicated LONG-TERM MEMORY ANALYZER.
This is a SECOND, independent analysis pass after another AI has already generated the user's answer.
Your only job is to inspect the latest user input and decide whether anything should become durable memory.

Analyze EVERY input. Never skip the analysis because the message does not match a keyword or fixed phrase.
Understand Persian naturally, including colloquial Persian, slang, typos, نیم‌فاصله variations, and Persian-English mixed text.

STORE durable user-specific information such as:
- profile: name, family name, stable background explicitly stated by the user
- preference: favorite color, foods, music, games, subjects, places, likes, dislikes, recurring preferences
- communication: how Redlighte should talk, tone, language, length, formatting, style
- skill: programming languages, software, technologies, knowledge, experience
- goal: long-term goals, plans, ambitions
- project: ongoing projects or recurring work
- fact: another stable user-specific fact useful in future conversations

Examples that MUST be remembered:
"اسمم سپهره" => profile
"اسم و فامیلیم سپهر احمدیه" => profile
"رنگ مورد علاقه‌م سبزه" => preference
"ریاضی رو دوست دارم" => preference
"غذای مورد علاقه‌م قیمه‌ست" => preference
"با من خودمونی حرف بزن" => communication
"جواب‌هات رو کوتاه بده" => communication
"من Python بلدم" => skill
"هدفم انتشار Redlighte است" => goal
"دارم روی Redlighte کار می‌کنم" => project

Do NOT store greetings, questions, one-off requests, temporary states, transient events, jokes, or facts useful only for this turn.
Do not infer anything that the user did not state or clearly express.
Never store passwords, API keys, tokens, private keys, financial credentials, exact IP addresses, device identifiers, medical information, sexual information, or other highly sensitive secrets.

IMPORTANT UPDATE RULES:
- If the user corrects or changes an existing memory, use action "update" and the matching existingId.
- If the same durable fact already exists, do not create a duplicate.
- If the user gives a genuinely new durable fact, create it separately.
- Prefer the newest explicit user statement when it supersedes an older memory.
- Preserve the user's actual meaning; do not rewrite it into an invented fact.

TYPE RULES:
profile = identity/background
preference = likes/dislikes/favorites/preferences
communication = response/tone/style preferences
skill = abilities/knowledge/experience
goal = long-term objective
project = ongoing work
fact = other durable user-specific information

CONFIDENCE: 0..1. Explicit statements should be near 1.
IMPORTANCE: 0..1. Long-term identity/preferences/communication/goals are high; minor durable facts are lower.
Only remember when BOTH confidence and importance are at least 0.65.

Return ONLY one JSON object. No markdown.
If nothing is worth saving:
{"remember":false}
If saving:
{"remember":true,"action":"create|update","existingId":null,"key":"stable.semantic.key","type":"profile|preference|skill|goal|project|communication|fact","content":"short durable memory statement","confidence":0.98,"importance":0.90}

EXISTING MEMORIES:
${JSON.stringify(existing)}

LATEST USER INPUT:
${input}

RECENT CONVERSATION CONTEXT:
${JSON.stringify(recentMessages.slice(-8))}`;

  try {
    const result = await env.AI.run(MEMORY_ANALYZER_MODEL, {
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 450,
      temperature: 0
    });
    const raw = result?.response || result?.result?.response || '';
    const candidate = parseObject(raw);
    if (!candidate?.remember || typeof candidate.content !== 'string') return null;

    const type = MEMORY_TYPES.has(candidate.type) ? candidate.type : 'fact';
    const content = String(candidate.content).trim().replace(/[.!؟]+$/u, '').slice(0, 500);
    if (!content) return null;
    const confidence = clamp(candidate.confidence, 0, 1);
    const importance = clamp(candidate.importance, 0, 1);
    if (confidence < 0.65 || importance < 0.65) return null;

    const key = normalizeKey(candidate.key || `${type}.${content}`);
    const targetId = typeof candidate.existingId === 'string' ? candidate.existingId : (existing.find(m => m.key === key)?.id || null);
    const memory = await core.addManualMemory(env, username, { key, type, content });
    return { memory, action: targetId ? 'updated' : 'created' };
  } catch (error) {
    console.error('MEMORY_SECOND_PASS_ERROR', error);
    return null;
  }
}

function parseObject(raw) {
  try { return JSON.parse(raw); } catch {}
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\u200c\s]+/g, '.').replace(/[^\p{L}\p{N}._-]+/gu, '').slice(0, 180);
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

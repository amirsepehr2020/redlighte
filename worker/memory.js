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

// Second-pass memory engine. It always analyzes the user input independently from the answer pass.
export async function extractAndMergeMemory(env, username, userMessage, recentMessages = [], conversationId = null) {
  if (!env?.AI || !username || typeof userMessage !== 'string') return null;
  const input = normalizeText(userMessage);
  if (input.length < 3 || isSensitive(input)) return null;

  const snapshot = await core.getMemory(env, username);
  const data = snapshot.data;
  if (!data.enabled) return null;

  const existing = data.memories.filter(m => m.status === 'active').slice(0, 120).map(m => ({
    id: m.id, key: m.key, type: m.type, content: m.content,
    confidence: m.confidence, importance: m.importance
  }));

  const prompt = `You are Redlighte's dedicated long-term MEMORY ANALYZER.\n\nThis is PASS 2. Another AI already answered the user. Your job is completely separate: inspect EVERY latest user input and decide whether it contains durable user-specific information worth remembering for future conversations.\n\nRemember explicit or clearly expressed: name, family name, stable background; favorites, likes, dislikes and preferences; communication/tone/language/format preferences; skills and experience; long-term goals; ongoing projects; other durable user-specific facts.\n\nExamples that MUST be remembered:\n- اسمم سپهره -> profile\n- اسم و فامیلیم سپهر احمدیه -> profile\n- رنگ مورد علاقه‌م سبزه -> preference\n- ریاضی رو دوست دارم -> preference\n- غذای مورد علاقه‌م قیمه‌ست -> preference\n- با من خودمونی حرف بزن -> communication\n- جواب‌هات رو کوتاه بده -> communication\n- من Python بلدم -> skill\n- هدفم انتشار Redlighte است -> goal\n- دارم روی Redlighte کار می‌کنم -> project\n\nDo NOT remember greetings, questions, one-off requests, temporary states, jokes, or current-turn-only information. Never infer a fact the user did not state. Never store passwords, API keys, tokens, private keys, financial credentials, exact IP addresses, device identifiers, medical or sexual information.\n\nTypes: profile, preference, communication, skill, goal, project, fact.\nIf a previous memory is corrected or superseded, use update and its exact existingId. If it is genuinely new, use create. Never duplicate an unchanged memory.\n\nReturn ONLY JSON. Confidence and importance are required numeric fields. Explicit user statements normally deserve confidence >= 0.95. Long-term identity, preferences, communication preferences, goals and projects normally deserve importance >= 0.85.\nIf nothing is worth saving: {"remember":false}\nIf worth saving: {"remember":true,"action":"create|update","existingId":null,"key":"stable.semantic.key","type":"preference","content":"short durable statement","confidence":0.98,"importance":0.90}\n\nEXISTING MEMORIES:\n${JSON.stringify(existing)}\n\nLATEST USER INPUT:\n${input}\n\nRECENT CONTEXT:\n${JSON.stringify(recentMessages.slice(-8))}`;

  let candidate = null;
  try {
    const result = await env.AI.run(MEMORY_ANALYZER_MODEL, {
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 600,
      temperature: 0
    });
    candidate = parseObject(result?.response || result?.result?.response || '');
  } catch (error) {
    console.error('MEMORY_SECOND_PASS_AI_ERROR', error);
  }

  // If the model fails to format its JSON, explicit durable statements still get a safe fallback.
  if (!candidate || candidate.remember !== true) {
    candidate = deterministicFallback(input);
  }
  if (!candidate?.remember || typeof candidate.content !== 'string') return null;

  const type = MEMORY_TYPES.has(candidate.type) ? candidate.type : 'fact';
  const content = clean(candidate.content);
  if (!content || isSensitive(content)) return null;

  // Missing model scores must never silently turn a valid explicit memory into a rejection.
  const confidence = clamp(candidate.confidence, explicitStatement(input) ? 0.96 : 0.70, 1);
  const importance = clamp(candidate.importance, defaultImportance(type), 1);
  if (confidence < 0.65 || importance < 0.65) return null;

  const key = normalizeKey(candidate.key || inferKey(type, content));
  let targetId = typeof candidate.existingId === 'string' ? candidate.existingId : null;
  if (!targetId) {
    const sameKey = existing.find(m => m.key === key);
    if (sameKey) targetId = sameKey.id;
  }

  try {
    let memory;
    if (targetId) {
      memory = await core.updateManualMemory(env, username, targetId, { key, type, content });
      if (!memory) {
        // Stale/malformed model ID: safely create/update through the normal dedupe path.
        memory = await core.addManualMemory(env, username, { key, type, content });
        return memory ? { memory, action: 'created' } : null;
      }
      return { memory, action: 'updated' };
    }
    memory = await core.addManualMemory(env, username, { key, type, content });
    return memory ? { memory, action: 'created' } : null;
  } catch (error) {
    console.error('MEMORY_SECOND_PASS_SAVE_ERROR', error);
    return null;
  }
}

function deterministicFallback(text) {
  let m;
  m = text.match(/^(?:اسمم|اسم من|نامم|نام من)\s*(?:این(?:ه|ه که)|:)?\s*(.+)$/u);
  if (m) return make('profile.name', 'profile', `User's name is ${clean(m[1])}.`);
  m = text.match(/^(?:فامیلیم|نام خانوادگی(?:م)?)\s*(?:این(?:ه|ه که)|:)?\s*(.+)$/u);
  if (m) return make('profile.family_name', 'profile', `User's family name is ${clean(m[1])}.`);
  m = text.match(/^(?:اسم و فامیلیم|اسم و نام خانوادگی(?:م)?|نام کامل(?:م)?)\s*(?:این(?:ه|ه که)|:)?\s*(.+)$/u);
  if (m) return make('profile.full_name', 'profile', `User's full name is ${clean(m[1])}.`);
  m = text.match(/^رنگ(?:ِ| )?مورد علاقه(?:‌م| ام)?\s*(?:این(?:ه|ه که)|:)?\s*(.+)$/u);
  if (m) return make('preference.favorite_color', 'preference', `User's favorite color is ${clean(m[1])}.`);
  m = text.match(/^غذای مورد علاقه(?:‌م| ام)?\s*(?:این(?:ه|ه که)|:)?\s*(.+)$/u);
  if (m) return make('preference.favorite_food', 'preference', `User's favorite food is ${clean(m[1])}.`);
  m = text.match(/^(?:من\s+)?(?:دوست دارم|خیلی دوست دارم|عاشقم|علاقه دارم به)\s+(.+)$/u);
  if (m) return make(`preference.likes.${normalizeKey(m[1]).slice(0,80)}`, 'preference', `User likes ${clean(m[1])}.`);
  m = text.match(/^(?:من\s+)?(?:از)\s+(.+)\s+(?:خوشم نمیاد|بدم میاد|متنفرم)$/u);
  if (m) return make(`preference.dislikes.${normalizeKey(m[1]).slice(0,80)}`, 'preference', `User dislikes ${clean(m[1])}.`);
  m = text.match(/^(?:با من|لطفاً با من|از این به بعد با من)\s+(.+)$/u);
  if (m && /(حرف|صحبت|جواب|پاسخ|لحن|کوتاه|مختصر|طولانی|خودمونی|رسمی|دوستانه|فارسی|انگلیسی|بنویس|بگو)/iu.test(text)) return make('communication.style', 'communication', `User wants ${clean(m[1])} when communicating.`);
  m = text.match(/^(?:من\s+)?(?:بلدم|مسلطم به)\s+(.+)$/u);
  if (m) return make(`skill.${normalizeKey(m[1]).slice(0,80)}`, 'skill', `User knows ${clean(m[1])}.`);
  m = text.match(/^(?:هدفم|هدف من)(?: اینه(?: که)?)?\s+(.+)$/u);
  if (m) return make(`goal.${normalizeKey(m[1]).slice(0,80)}`, 'goal', `User's goal is ${clean(m[1])}.`);
  m = text.match(/^(?:دارم روی|روی)\s+(.+)\s+(?:کار می‌کنم|کار میکنم)$/u);
  if (m) return make(`project.${normalizeKey(m[1]).slice(0,80)}`, 'project', `User is working on ${clean(m[1])}.`);
  return null;
}

function make(key, type, content) { return { remember: true, action: 'create', existingId: null, key, type, content, confidence: 0.99, importance: defaultImportance(type) }; }
function explicitStatement(text) { return !!deterministicFallback(text); }
function defaultImportance(type) { return ({ profile: 0.98, communication: 0.95, preference: 0.90, goal: 0.94, project: 0.90, skill: 0.84, fact: 0.78 }[type] || 0.78); }
function parseObject(raw) { const text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); try { return JSON.parse(text); } catch {} const match = text.match(/\{[\s\S]*\}/); if (!match) return null; try { return JSON.parse(match[0]); } catch { return null; } }
function normalizeText(value) { return String(value || '').trim().replace(/[يى]/g, 'ی').replace(/[ك]/g, 'ک').replace(/\s+/g, ' '); }
function clean(value) { return String(value || '').trim().replace(/^[`"'«]+|[`"'»]+$/g, '').replace(/[.!؟]+$/u, '').slice(0, 500); }
function normalizeKey(value) { return String(value || '').trim().toLowerCase().replace(/[\u200c\s]+/g, '.').replace(/[^\p{L}\p{N}._-]+/gu, '').slice(0, 180); }
function inferKey(type, content) { return `${type}.${normalizeKey(content).slice(0, 100)}`; }
function clamp(value, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; }
function isSensitive(text) { return /password|passcode|api[_ -]?key|token|secret|private key|کلمه عبور|رمز عبور|رمز ورود|کلید api|توکن|شماره کارت|شماره شبا|cvv|medical|diagnos|treatment|medication|بیماری|تشخیص پزشکی|درمان|دارو|sexual|sex life|جنسی/i.test(String(text || '')); }

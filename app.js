const API_CONFIG = Object.freeze({
  baseURL: '',
  chatEndpoint: '/api/chat',
  timeoutMs: 30000
});

const state = { messages: [], isGenerating: false };

const $ = (selector) => document.querySelector(selector);
const welcomeView = $('#welcomeView');
const chatView = $('#chatView');
const messagesEl = $('#messages');
const appFooter = $('#appFooter');
const bottomComposer = $('#bottomComposer');
const homeComposer = $('#homeComposer');
const chatComposer = $('#chatComposer');
const homeInput = $('#homeInput');
const chatInput = $('#chatInput');
const sidePanel = $('#sidePanel');
const toast = $('#toast');

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function updateSendState(form) {
  const input = form.querySelector('textarea');
  const button = form.querySelector('.send-button');
  button.disabled = !input.value.trim() || state.isGenerating;
}

function resetComposer(textarea) {
  textarea.value = '';
  textarea.style.height = 'auto';
}

function showChat() {
  welcomeView.hidden = true;
  appFooter.hidden = true;
  chatView.hidden = false;
  bottomComposer.hidden = false;
}

function showHome() {
  state.messages = [];
  messagesEl.replaceChildren();
  chatView.hidden = true;
  bottomComposer.hidden = true;
  appFooter.hidden = false;
  welcomeView.hidden = false;
  homeInput.focus({ preventScroll: true });
}

function addMessage(role, content, pending = false) {
  const wrapper = document.createElement('article');
  wrapper.className = `message message-${role}`;

  if (role === 'ai') {
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'REDLIGHTE';
    wrapper.append(label);
  }

  if (pending) {
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    wrapper.append(typing);
  } else {
    const body = document.createElement('div');
    body.className = 'message-body';
    body.textContent = content;
    wrapper.append(body);
  }

  messagesEl.append(wrapper);
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return wrapper;
}

function addActions(wrapper) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  const copy = document.createElement('button');
  copy.className = 'message-action';
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    const body = wrapper.querySelector('.message-body');
    if (!body) return;
    await navigator.clipboard?.writeText(body.textContent || '');
    showToast('Copied');
  });
  actions.append(copy);
  wrapper.append(actions);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function openMenu() {
  sidePanel.classList.add('open');
  sidePanel.setAttribute('aria-hidden', 'false');
}
function closeMenu() {
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden', 'true');
}

async function requestChat(payload, signal) {
  // Single API boundary: replace only this adapter when the Cloudflare Worker is ready.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  const combinedSignal = signal || controller.signal;
  try {
    const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.chatEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: combinedSignal
    });
    if (!response.ok) throw new Error(`API_ERROR_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  if (!message || state.isGenerating) return;

  showChat();
  state.isGenerating = true;
  updateSendState(homeComposer);
  updateSendState(chatComposer);

  state.messages.push({ role: 'user', content: message });
  addMessage('user', message);
  resetComposer(homeInput);
  resetComposer(chatInput);

  const pending = addMessage('ai', '', true);

  try {
    const result = await requestChat({
      message,
      conversation_id: null,
      messages: state.messages
    });

    const answer = result.message ?? result.content ?? result.answer ?? 'No response received.';
    pending.replaceChildren();
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'REDLIGHTE';
    const body = document.createElement('div');
    body.className = 'message-body';
    body.textContent = answer;
    pending.append(label, body);
    addActions(pending);
    state.messages.push({ role: 'assistant', content: answer });
  } catch (error) {
    pending.remove();
    const errorMessage = error.name === 'AbortError'
      ? 'The request took too long. Please try again.'
      : 'Something went wrong. Please try again.';
    const errorEl = addMessage('ai', errorMessage);
    addActions(errorEl);
    showToast('Unable to reach Redlighte');
  } finally {
    state.isGenerating = false;
    updateSendState(homeComposer);
    updateSendState(chatComposer);
    chatInput.focus({ preventScroll: true });
  }
}

function bindComposer(form, input) {
  input.addEventListener('input', () => {
    autoResize(input);
    updateSendState(form);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
}

bindComposer(homeComposer, homeInput);
bindComposer(chatComposer, chatInput);

$('#brandButton').addEventListener('click', showHome);
$('#newChatButton').addEventListener('click', showHome);
$('#panelNewChat').addEventListener('click', () => { closeMenu(); showHome(); });
$('#menuButton').addEventListener('click', openMenu);
$('#closeMenuButton').addEventListener('click', closeMenu);
$('#panelBackdrop').addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    showHome();
  }
});

document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => {
    homeInput.value = button.dataset.prompt || '';
    autoResize(homeInput);
    updateSendState(homeComposer);
    homeInput.focus();
  });
});

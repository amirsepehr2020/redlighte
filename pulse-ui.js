(() => {
  const injectStyle = () => {
    if (document.getElementById('pulse-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'pulse-ui-style';
    style.textContent = `
      .pulse-panel-card{display:grid;gap:14px}.pulse-toggle{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 13px;border:1px solid var(--line);border-radius:14px;background:var(--surface2)}
      .pulse-toggle-copy b{display:block;font-size:13px}.pulse-toggle-copy small{display:block;margin-top:3px;color:var(--dim);font-size:10px}.pulse-switch{width:42px;height:24px;border:0;border-radius:999px;background:var(--line2);position:relative;cursor:pointer}.pulse-switch:after{content:'';position:absolute;width:18px;height:18px;top:3px;left:3px;border-radius:50%;background:#fff;transition:.2s}.pulse-switch.on{background:var(--red)}.pulse-switch.on:after{left:21px}
      .pulse-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pulse-stat{padding:11px;border:1px solid var(--line);border-radius:13px;background:var(--surface2)}.pulse-stat span{display:block;color:var(--dim);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.pulse-stat b{display:block;margin-top:5px;font-size:12px}.pulse-meter{height:6px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:8px}.pulse-meter i{display:block;height:100%;width:0;background:var(--red);border-radius:inherit;transition:width .3s}.pulse-item{padding:9px 10px;border-radius:11px;background:var(--surface2);border:1px solid var(--line);font-size:11px}.pulse-item+.pulse-item{margin-top:7px}.pulse-topic{display:flex;align-items:center;gap:8px}.pulse-dot{width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 12px var(--red)}
      .pulse-badge{margin-left:auto;font-size:9px;color:var(--red2);padding:3px 7px;border-radius:99px;background:var(--redSoft)}
    `;
    document.head.append(style);
  };

  const api = async (url, options) => {
    const response = await fetch(url, { credentials: 'include', ...options });
    if (!response.ok) throw new Error(`PULSE_${response.status}`);
    return response.json();
  };

  const render = pulse => {
    const body = document.getElementById('modalBody');
    if (!body) return;
    const p = pulse || {};
    const active = p.enabled !== false;
    const context = p.activeContext || {};
    const project = p.projectContext || {};
    const signals = p.signals || {};
    const items = Array.isArray(p.activeItems) ? p.activeItems.filter(x => x.type !== 'memory') : [];
    body.innerHTML = `<div class="pulse-panel-card">
      <div class="pulse-toggle"><div class="pulse-toggle-copy"><b>Pulse Context</b><small>Let Redlighte keep the right context active for this conversation.</small></div><button id="pulseSwitch" class="pulse-switch ${active ? 'on' : ''}" type="button" aria-label="Toggle Pulse"></button></div>
      <div class="pulse-grid"><div class="pulse-stat"><span>Topic</span><b>${escapeHtml(context.topic || 'General conversation')}</b></div><div class="pulse-stat"><span>Intent</span><b>${escapeHtml(context.intent || 'general')}</b></div></div>
      <div class="pulse-stat"><span>Context confidence</span><b>${Math.round(Number(context.confidence || 0) * 100)}%</b><div class="pulse-meter"><i style="width:${Math.max(0,Math.min(100,Number(context.confidence || 0)*100))}%"></i></div></div>
      <div class="pulse-stat"><span>Context stability</span><b>${Math.round(Number(signals.topicStability || 0) * 100)}%</b><div class="pulse-meter"><i style="width:${Math.max(0,Math.min(100,Number(signals.topicStability || 0)*100))}%"></i></div></div>
      ${project.active ? `<div class="pulse-item"><b>Project</b><br>${escapeHtml(project.projectName || '')}</div>` : ''}
      ${context.summary ? `<div class="pulse-item"><b>Active context</b><br>${escapeHtml(context.summary)}</div>` : ''}
      ${items.length ? `<div>${items.map(x=>`<div class="pulse-item pulse-topic"><span class="pulse-dot"></span><span>${escapeHtml(x.type)}: ${escapeHtml(x.value)}</span></div>`).join('')}</div>` : ''}
      <div class="pulse-item"><span>Messages processed: <b>${Number(p.metrics?.messagesProcessed || 0)}</b></span></div>
    </div>`;
    const sw = document.getElementById('pulseSwitch');
    if (sw) sw.onclick = async () => {
      sw.disabled = true;
      try { const result = await api('/api/pulse/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({enabled:!active}) }); render(result.pulse); }
      catch { window.dispatchEvent(new CustomEvent('redlighte:pulse-error')); }
    };
  };

  const open = async () => {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    if (!modal || !title) return;
    title.textContent = 'Redlighte Pulse';
    document.getElementById('modalBody').innerHTML = '<div class="panel-copy">Loading Pulse…</div>';
    modal.hidden = false;
    try { const result = await api('/api/pulse'); render(result.pulse); } catch { document.getElementById('modalBody').innerHTML = '<div class="panel-copy">Pulse is available after signing in.</div>'; }
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const init = () => {
    injectStyle();
    const memory = document.getElementById('memoryButton');
    const panel = memory?.parentElement;
    if (memory && panel && !document.getElementById('pulseButton')) {
      const button = document.createElement('button');
      button.className = 'panel-action';
      button.id = 'pulseButton';
      button.type = 'button';
      button.innerHTML = '<span class="nav-leading"><span class="nav-icon">◉</span><span>Pulse</span><span class="pulse-badge">LIVE</span></span><span class="nav-arrow">›</span>';
      memory.insertAdjacentElement('afterend', button);
      button.onclick = () => { document.getElementById('sidePanel')?.classList.remove('open'); document.getElementById('sidePanel')?.setAttribute('aria-hidden','true'); open(); };
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        if (requestUrl.includes('/api/chat') && response.ok) {
          const data = await response.clone().json();
          if (data?.pulse) window.__redlightePulse = data.pulse;
        }
      } catch {}
      return response;
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();

(() => {
  if (document.getElementById('redlighte-inc-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'redlighte-inc-badge';
  badge.textContent = 'Part of Redlighte Inc.';
  Object.assign(badge.style, {
    position: 'fixed',
    right: '10px',
    bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
    zIndex: '2147483647',
    padding: '3px 7px',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '999px',
    background: 'rgba(0,0,0,.28)',
    color: 'rgba(255,255,255,.58)',
    font: '600 9px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    letterSpacing: '.15px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  });
  document.body.appendChild(badge);
})();

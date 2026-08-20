(() => {
  if (!('ontouchstart' in window) || !document.getElementById('sidePanel')) return;

  const panel = document.getElementById('sidePanel');
  let startX = 0;
  let startY = 0;
  let tracking = false;

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }

    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!tracking || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Only track a clear horizontal swipe. Keep normal vertical scrolling intact.
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 12) return;

    if (Math.abs(dx) > 45) {
      tracking = false;

      // Swipe left anywhere on the page opens the navigation drawer.
      if (dx < 0 && !panel.classList.contains('open')) {
        document.getElementById('menuButton')?.click();
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    tracking = false;
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    tracking = false;
  }, { passive: true });
})();

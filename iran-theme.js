(() => {
  const KEY = 'redlighte_accent';
  const root = document.documentElement;

  function applyIranTheme() {
    root.classList.add('iran-theme');
  }

  function removeIranTheme() {
    root.classList.remove('iran-theme');
  }

  function updateIranChoice() {
    const grid = document.querySelector('.accent-grid');
    if (!grid) return;

    const iranChoice = grid.querySelector('[data-iran-theme]');
    if (!iranChoice) return;

    const isIran = localStorage.getItem(KEY) === 'iran';
    iranChoice.classList.toggle('active', isIran);

    if (isIran) {
      grid.querySelectorAll('.accent-choice:not([data-iran-theme])').forEach(choice => {
        choice.classList.remove('active');
      });
    }
  }

  function addIranChoice() {
    const grid = document.querySelector('.accent-grid');
    if (!grid || grid.querySelector('[data-iran-theme]')) return;

    const choice = document.createElement('button');
    choice.className = 'accent-choice iran-accent-choice';
    choice.dataset.iranTheme = 'true';
    choice.type = 'button';
    choice.title = 'Iran';
    choice.setAttribute('aria-label', 'Iran');
    choice.innerHTML = '<span></span><b>Iran</b><i>✓</i>';

    choice.addEventListener('click', () => {
      localStorage.setItem(KEY, 'iran');
      applyIranTheme();
      updateIranChoice();
    });

    grid.appendChild(choice);
    updateIranChoice();
  }

  function syncTheme() {
    if (localStorage.getItem(KEY) === 'iran') applyIranTheme();
    else removeIranTheme();
    addIranChoice();
    updateIranChoice();
  }

  const observer = new MutationObserver(() => {
    syncTheme();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    const choice = event.target.closest('.accent-choice');
    if (!choice || choice.dataset.iranTheme) return;

    setTimeout(syncTheme, 0);
  });

  syncTheme();
})();

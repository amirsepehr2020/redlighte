(() => {
  const PENDING_KEY = 'redlighte_google_link_mode';

  function textFor(key) {
    const fa = localStorage.getItem('redlighte_language') === 'fa';
    const ar = localStorage.getItem('redlighte_language') === 'ar';
    const values = {
      google: fa ? 'ادامه با Google' : ar ? 'المتابعة باستخدام Google' : 'Continue with Google',
      divider: fa ? 'یا' : ar ? 'أو' : 'or',
      pendingTitle: fa ? 'حساب Google تأیید شد' : ar ? 'تم التحقق من حساب Google' : 'Google account verified',
      pendingBody: fa ? 'برای جلوگیری از اتصال اشتباه حساب‌ها، انتخاب کن این حساب Google به یک حساب جدید وصل شود یا به حساب فعلی Redlighte متصل شود.' : ar ? 'لمنع ربط الحسابات بشكل غير صحيح، اختر إنشاء حساب Redlighte جديد أو ربط Google بحسابك الحالي.' : 'To prevent accidental account merging, choose whether to create a new Redlighte account or link Google to an existing account.',
      create: fa ? 'ساخت حساب جدید' : ar ? 'إنشاء حساب جديد' : 'Create new account',
      link: fa ? 'اتصال به حساب موجود' : ar ? 'ربط بحساب موجود' : 'Link existing account',
      linkHint: fa ? 'بعد از انتخاب، با نام کاربری و رمز حساب فعلی وارد شو.' : ar ? 'بعد الاختيار، سجّل الدخول باسم المستخدم وكلمة المرور لحسابك الحالي.' : 'After choosing this option, sign in with your existing username and password.',
      wait: fa ? 'لطفاً صبر کن…' : ar ? 'يرجى الانتظار…' : 'Please wait…',
      error: fa ? 'اتصال Google انجام نشد.' : ar ? 'تعذر إكمال تسجيل الدخول باستخدام Google.' : 'Google authentication could not be completed.'
    };
    return values[key] || values.google;
  }

  function styles() {
    if (document.getElementById('redlighteGoogleStyles')) return;
    const s = document.createElement('style');
    s.id = 'redlighteGoogleStyles';
    s.textContent = `.ra-google-wrap{display:grid;gap:9px;margin-top:2px}.ra-divider{display:flex;align-items:center;gap:10px;color:#666a73;font-size:10px;font-weight:700;text-transform:lowercase}.ra-divider:before,.ra-divider:after{content:"";height:1px;flex:1;background:rgba(255,255,255,.07)}.ra-google{height:50px;border:1px solid rgba(255,255,255,.11);border-radius:15px;background:rgba(255,255,255,.045);color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;font:800 13px/1 inherit;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}.ra-google:hover{background:rgba(255,255,255,.075);border-color:rgba(255,255,255,.18);transform:translateY(-1px)}.ra-google svg{width:18px;height:18px}.ra-google:disabled{opacity:.55;cursor:wait;transform:none}.ra-google-pending{margin-bottom:18px;padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.035)}.ra-google-pending h3{margin:0 0 7px;font-size:14px;color:#fff}.ra-google-pending p{margin:0 0 13px;color:#8f929a;font-size:11px;line-height:1.65}.ra-google-pending-actions{display:grid;gap:8px}.ra-google-pending button{height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);color:#fff;font:750 11px inherit;cursor:pointer}.ra-google-pending button.primary{background:linear-gradient(135deg,#ff3045,#df1730);border-color:transparent}.ra-google-pending button:disabled{opacity:.55;cursor:wait}`;
    document.head.appendChild(s);
  }

  function googleIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.7-.06-1.37-.18-2H12v3.79h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.7 2.93-4.2 2.93-7.15Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.5A9.74 9.74 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.54 13.85A5.85 5.85 0 0 1 6.24 12c0-.64.11-1.27.3-1.85v-2.5H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.35l3.25-2.5Z"/><path fill="#EA4335" d="M12 6.12c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.22 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.71 5.4l3.25 2.5C7.31 7.84 9.46 6.12 12 6.12Z"/></svg>`;
  }

  function injectGoogleButton() {
    const form = document.querySelector('#raForm');
    if (!form || form.querySelector('.ra-google-wrap')) return;
    const submit = form.querySelector('.ra-button');
    if (!submit) return;
    const wrap = document.createElement('div');
    wrap.className = 'ra-google-wrap';
    wrap.innerHTML = `<div class="ra-divider">${textFor('divider')}</div><button class="ra-google" type="button">${googleIcon()}<span>${textFor('google')}</span></button>`;
    submit.insertAdjacentElement('afterend', wrap);
    wrap.querySelector('.ra-google').onclick = () => { window.location.href = '/api/auth/google'; };
  }

  async function complete(mode) {
    const buttons = document.querySelectorAll('.ra-google-pending button');
    buttons.forEach(b => b.disabled = true);
    try {
      const r = await fetch('/api/auth/google/complete', {
        method: 'POST', credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({mode})
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || textFor('error'));
      localStorage.removeItem(PENDING_KEY);
      location.reload();
    } catch (error) {
      buttons.forEach(b => b.disabled = false);
      alert(error.message || textFor('error'));
    }
  }

  function injectPendingChoice() {
    const params = new URLSearchParams(location.search);
    if (params.get('google_pending') !== '1') return;
    const card = document.querySelector('.ra-card');
    if (!card || card.querySelector('.ra-google-pending')) return;
    const panel = document.createElement('div');
    panel.className = 'ra-google-pending';
    panel.innerHTML = `<h3>${textFor('pendingTitle')}</h3><p>${textFor('pendingBody')}</p><div class="ra-google-pending-actions"><button class="primary" type="button">${textFor('create')}</button><button type="button">${textFor('link')}</button></div>`;
    card.querySelector('.ra-top')?.insertAdjacentElement('afterend', panel);
    const [create, link] = panel.querySelectorAll('button');
    create.onclick = () => complete('create');
    link.onclick = () => {
      localStorage.setItem(PENDING_KEY, '1');
      panel.remove();
      const username = document.querySelector('#raForm input[name="username"]');
      username?.focus();
    };
  }

  async function watchForLinkedLogin() {
    if (localStorage.getItem(PENDING_KEY) !== '1') return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > 120000) return clearInterval(timer);
      const me = await fetch('/api/auth/me', {credentials:'include'}).catch(() => null);
      if (!me?.ok) return;
      const d = await me.json().catch(() => ({}));
      if (!d.authenticated) return;
      clearInterval(timer);
      try {
        const r = await fetch('/api/auth/google/complete', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'link'})});
        if (r.ok) { localStorage.removeItem(PENDING_KEY); location.reload(); }
      } catch {}
    }, 700);
  }

  styles();
  const observer = new MutationObserver(() => { injectGoogleButton(); injectPendingChoice(); });
  observer.observe(document.documentElement, {subtree:true, childList:true});
  setTimeout(() => { injectGoogleButton(); injectPendingChoice(); watchForLinkedLogin(); }, 300);
})();

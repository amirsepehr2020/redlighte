(()=>{
  const settingsButton=document.getElementById('settingsButton');
  const modal=document.getElementById('modal');
  const modalTitle=document.getElementById('modalTitle');
  const modalBody=document.getElementById('modalBody');
  const modalClose=document.getElementById('modalClose');
  const drawer=document.getElementById('sidePanel');
  if(!settingsButton||!modal||!modalTitle||!modalBody)return;

  const colors=[['Ruby','#e11d48'],['Crimson','#dc2626'],['Scarlet','#ef233c'],['Classic Red','#ff3045'],['Vermilion','#ff3b30'],['Cherry','#ff1744'],['Rose','#f43f5e'],['Deep Red','#b91c1c']];
  const languageNames={en:'English',fa:'فارسی',ko:'한국어',zh:'中文',tr:'Türkçe',fr:'Français',es:'Español',hi:'हिन्दी'};
  const languageFlags={en:'🇬🇧',fa:'🇮🇷',ko:'🇰🇷',zh:'🇨🇳',tr:'🇹🇷',fr:'🇫🇷',es:'🇪🇸',hi:'🇮🇳'};

  const getTheme=()=>document.documentElement.classList.contains('light')?'light':'dark';
  const getAccent=()=>localStorage.getItem('redlighte_accent')||'#ff3045';
  const getAccentName=hex=>colors.find(([,c])=>c.toLowerCase()===String(hex).toLowerCase())?.[0]||String(hex).toUpperCase();
  const getLanguage=()=>String(document.documentElement.lang||'en').toLowerCase().split('-')[0];
  const getHistoryCount=()=>{try{const h=JSON.parse(localStorage.getItem('redlighte_history')||'[]');return Array.isArray(h)?h.length:0}catch{return 0}};
  const getMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'Reduced motion':'Full motion';

  const style=document.createElement('style');
  style.textContent=`
    .settings-shell{display:grid;gap:16px}
    .settings-hero{position:relative;overflow:hidden;padding:20px;border:1px solid var(--line2);border-radius:22px;background:radial-gradient(circle at 100% 0%,var(--redSoft),transparent 45%),linear-gradient(145deg,var(--surface2),rgba(255,255,255,.025));box-shadow:0 18px 50px rgba(0,0,0,.16)}
    .settings-hero:after{content:"";position:absolute;width:120px;height:120px;right:-50px;top:-55px;border-radius:50%;border:1px solid var(--redSoft);box-shadow:0 0 60px var(--redSoft)}
    .settings-hero-main{position:relative;z-index:1;display:flex;align-items:center;gap:14px}
    .settings-hero-icon{width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:15px;background:var(--redSoft);border:1px solid var(--red);color:var(--red2);font-size:22px;box-shadow:0 10px 28px var(--redSoft)}
    .settings-hero h3{margin:0;font-size:18px;font-weight:850;letter-spacing:-.03em;color:var(--text)}
    .settings-hero p{margin:4px 0 0;color:var(--dim);font-size:11px;line-height:1.5}
    .settings-section{display:grid;gap:8px}
    .settings-section-title{margin:2px 2px 4px;color:var(--dim);font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
    .settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .settings-card{min-width:0;padding:13px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025);transition:.2s var(--ease)}
    .settings-card:hover{border-color:var(--line2);background:var(--surface3);transform:translateY(-1px)}
    .settings-card-head{display:flex;align-items:center;gap:8px;color:var(--dim);font-size:10px;font-weight:800}
    .settings-card-icon{width:27px;height:27px;display:grid;place-items:center;border-radius:9px;background:var(--redSoft);color:var(--red2);font-size:13px}
    .settings-card-value{display:block;margin-top:9px;color:var(--text);font-size:13px;font-weight:800;overflow-wrap:anywhere}
    .settings-card-sub{display:block;margin-top:3px;color:var(--dim);font-size:9px;line-height:1.4}
    .settings-status{display:flex;align-items:center;gap:9px;padding:12px 13px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}
    .settings-status-dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:var(--red);box-shadow:0 0 14px var(--redSoft)}
    .settings-status-copy{min-width:0;flex:1}.settings-status-label{display:block;color:var(--dim);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.settings-status-value{display:block;margin-top:3px;color:var(--text);font-size:12px;font-weight:750;overflow-wrap:anywhere}
    .settings-badge{margin-left:auto;padding:5px 8px;border:1px solid var(--line);border-radius:999px;background:var(--surface2);color:var(--dim);font-size:9px;font-weight:800;white-space:nowrap}
    @media(max-width:520px){.settings-grid{grid-template-columns:1fr}.settings-hero{padding:17px}.settings-card{padding:12px}}
  `;
  document.head.appendChild(style);

  async function getSession(){
    try{
      const r=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});
      if(!r.ok)return null;
      const d=await r.json();
      return d&&d.authenticated?d.user||{}:null;
    }catch{return null}
  }

  const card=(icon,label,value,sub='')=>`<div class="settings-card"><div class="settings-card-head"><span class="settings-card-icon">${icon}</span><span>${label}</span></div><strong class="settings-card-value">${value}</strong>${sub?`<small class="settings-card-sub">${sub}</small>`:''}</div>`;

  async function openSettings(){
    if(drawer){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');}
    modalTitle.textContent='Settings';
    const theme=getTheme(),accent=getAccent(),lang=getLanguage(),motion=getMotion(),historyCount=getHistoryCount();
    const user=await getSession();
    const sessionValue=user?(String(user.name||user.username||'Signed in')):'Signed out';
    const sessionSub=user&&user.username?`@${String(user.username).replace(/^@/,'')}`:'No active Redlighte account';
    const langName=languageNames[lang]||lang.toUpperCase();
    const flag=languageFlags[lang]||'🌐';
    modalBody.innerHTML=`
      <div class="settings-shell">
        <div class="settings-hero">
          <div class="settings-hero-main"><span class="settings-hero-icon">⚙</span><div><h3>Your Redlighte setup</h3><p>Live values from the settings and account state currently applied in this browser.</p></div></div>
        </div>
        <section class="settings-section"><p class="settings-section-title">Interface</p><div class="settings-grid">
          ${card(theme==='light'?'☀':'☾','Appearance',theme==='light'?'Light':'Dark','Currently applied theme')}
          ${card('◉','Accent',getAccentName(accent),String(accent).toUpperCase())}
          ${card(flag,'Language',langName,`document.lang = ${lang}`)}
          ${card('✦','Animations',motion,'Based on your system preference')}
        </div></section>
        <section class="settings-section"><p class="settings-section-title">Data & account</p>
          <div class="settings-status"><span class="settings-status-dot"></span><div class="settings-status-copy"><span class="settings-status-label">Account</span><strong class="settings-status-value">${sessionValue}</strong>${sessionSub?`<small class="settings-card-sub">${sessionSub}</small>`:''}</div><span class="settings-badge">LIVE</span></div>
          <div class="settings-grid">
            ${card('◷','Chat history',`${historyCount} ${historyCount===1?'chat':'chats'}`,historyCount?'Stored in this browser':'No saved chats yet')}
            ${card('▣','Browser storage',(()=>{try{localStorage.setItem('__redlighte_settings_probe','1');localStorage.removeItem('__redlighte_settings_probe');return'Available'}catch{return'Unavailable'}})(),'Used for local preferences & history')}
          </div>
        </section>
      </div>`;
    modal.hidden=false;
    modalClose.focus();
  }

  settingsButton.onclick=openSettings;
})();
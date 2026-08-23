(()=>{
  const sw=()=>{
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
  };

  const ready=()=>{
    const $=s=>document.querySelector(s);
    const drawer=$('#sidePanel'),modal=$('#modal'),chat=$('#chatView'),home=$('#welcomeView'),messages=$('#messages'),bottom=$('#bottomComposer');
    if(!drawer||!modal||!chat||!home)return;

    // 1) Android-style Back behavior: close overlays first, then leave the chat.
    let chatHistoryPushed=false;
    const syncChatHistory=()=>{
      if(!chat.hidden&&!chatHistoryPushed){
        history.pushState({redlighteChat:true},'',location.href);
        chatHistoryPushed=true;
      }
      if(chat.hidden)chatHistoryPushed=false;
    };
    new MutationObserver(syncChatHistory).observe(chat,{attributes:true,attributeFilter:['hidden']});
    syncChatHistory();
    addEventListener('popstate',()=>{
      if(drawer.classList.contains('open')){ $('#closeMenuButton')?.click(); return; }
      if(!modal.hidden){ $('#modalClose')?.click(); return; }
      if(!chat.hidden){ $('#brandButton')?.click(); chatHistoryPushed=false; return; }
    });

    // 2) Keyboard-aware mobile composer using Visual Viewport when available.
    const updateKeyboardInset=()=>{
      if(!window.visualViewport)return;
      const inset=Math.max(0,innerHeight-visualViewport.height-visualViewport.offsetTop);
      document.documentElement.style.setProperty('--redlighte-keyboard-inset',`${inset}px`);
      if(bottom&&!bottom.hidden){
        bottom.style.paddingBottom=`calc(8px + env(safe-area-inset-bottom, 0px) + ${inset}px)`;
        if(inset>24)setTimeout(()=>$('#chatInput')?.scrollIntoView({block:'nearest',behavior:'smooth'}),0);
      }
    };
    visualViewport?.addEventListener('resize',updateKeyboardInset,{passive:true});
    visualViewport?.addEventListener('scroll',updateKeyboardInset,{passive:true});
    addEventListener('resize',updateKeyboardInset,{passive:true});
    updateKeyboardInset();

    // 3 + 4) Long-press message actions + Android native Web Share when available.
    let pressTimer=null,pressTarget=null;
    const getText=el=>el?.querySelector('.message-body')?.textContent?.trim()||'';
    const closePressMenu=()=>document.querySelector('.redlighte-press-menu')?.remove();
    const shareText=async text=>{
      if(!text)return;
      if(navigator.share){
        try{await navigator.share({title:'Redlighte',text});return;}catch(e){if(e?.name==='AbortError')return;}
      }
      try{await navigator.clipboard.writeText(text);toast?.('Copied');}catch{}
    };
    const showPressMenu=el=>{
      closePressMenu();
      const text=getText(el);if(!text)return;
      const menu=document.createElement('div');menu.className='redlighte-press-menu';
      const add=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{closePressMenu();fn()};menu.append(b)};
      add('Copy',async()=>{try{await navigator.clipboard.writeText(text)}catch{} });
      add('Share',()=>shareText(text));
      if(el.classList.contains('message-user')){
        const edit=el.querySelector('.message-action[title="Edit message"]');
        if(edit)add('Edit',()=>edit.click());
      }
      document.body.append(menu);
      const r=el.getBoundingClientRect();
      menu.style.left=`${Math.max(8,Math.min(innerWidth-180,r.left))}px`;
      menu.style.top=`${Math.max(8,r.top-8-menu.offsetHeight)}px`;
    };
    const startPress=e=>{
      if(e.target.closest('button,a,input,textarea'))return;
      const el=e.target.closest('.message');if(!el)return;
      pressTarget=el;
      pressTimer=setTimeout(()=>{if(pressTarget===el)showPressMenu(el);pressTimer=null},520);
    };
    const cancelPress=()=>{clearTimeout(pressTimer);pressTimer=null;pressTarget=null};
    messages.addEventListener('touchstart',startPress,{passive:true});
    messages.addEventListener('touchend',cancelPress,{passive:true});
    messages.addEventListener('touchcancel',cancelPress,{passive:true});
    messages.addEventListener('touchmove',cancelPress,{passive:true});
    messages.addEventListener('contextmenu',e=>{const el=e.target.closest('.message');if(el){e.preventDefault();showPressMenu(el)}});
    document.addEventListener('click',e=>{if(!e.target.closest('.redlighte-press-menu'))closePressMenu()});

    // URL deep links: /?chat=<local-history-id> or /#chat=<id> open the saved chat.
    const openDeepLink=()=>{
      const params=new URLSearchParams(location.search);
      const hash=new URLSearchParams(location.hash.replace(/^#/,'').replace(/^\?/,'')).get('chat');
      const id=params.get('chat')||hash;
      if(!id)return;
      let historyItems=[];
      try{historyItems=JSON.parse(localStorage.getItem('redlighte_history')||'[]')}catch{}
      const item=historyItems.find(x=>x.id===id);
      if(!item)return;
      const tryOpen=()=>{
        const rows=[...document.querySelectorAll('.history-row')];
        const row=rows.find(r=>r.querySelector('.history-title')?.textContent===item.title);
        if(row){row.querySelector('.history-title')?.click();return true}
        $('#menuButton')?.click();return false;
      };
      setTimeout(()=>{if(!tryOpen())setTimeout(tryOpen,150)},100);
    };

    // 5) Clear offline state: persistent lightweight banner, without changing chat behavior.
    let networkBanner;
    const setNetwork=online=>{
      if(!networkBanner){
        networkBanner=document.createElement('div');networkBanner.className='redlighte-network-banner';
        networkBanner.setAttribute('role','status');document.body.append(networkBanner);
      }
      networkBanner.textContent=online?'Connection restored':'You are offline';
      networkBanner.classList.toggle('offline',!online);
      networkBanner.classList.add('visible');
      clearTimeout(setNetwork.timer);setNetwork.timer=setTimeout(()=>networkBanner.classList.remove('visible'),online?1800:0);
    };
    addEventListener('offline',()=>setNetwork(false));
    addEventListener('online',()=>setNetwork(true));
    if(!navigator.onLine)setNetwork(false);

    // Small, isolated mobile-only styles for the new interactions.
    const style=document.createElement('style');style.textContent=`
      .redlighte-press-menu{position:fixed;z-index:10000;min-width:150px;padding:6px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(18,18,20,.96);backdrop-filter:blur(18px);box-shadow:0 14px 40px rgba(0,0,0,.35);display:grid;gap:3px}
      .redlighte-press-menu button{border:0;border-radius:10px;background:transparent;color:inherit;padding:10px 12px;text-align:left;font:inherit;cursor:pointer}
      .redlighte-press-menu button:active,.redlighte-press-menu button:hover{background:rgba(255,255,255,.08)}
      .redlighte-network-banner{position:fixed;z-index:9999;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;pointer-events:none;padding:9px 14px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(18,18,20,.94);backdrop-filter:blur(18px);box-shadow:0 10px 30px rgba(0,0,0,.28);font-size:12px;transition:opacity .22s ease,transform .22s ease}
      .redlighte-network-banner.visible{opacity:1;transform:translate(-50%,0)}
      .redlighte-network-banner.offline{border-color:rgba(255,48,69,.35)}
      @media (max-width:600px){.redlighte-press-menu{max-width:calc(100vw - 16px)}body{overscroll-behavior-y:none}}
    `;document.head.append(style);
    openDeepLink();
  };

  if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>{sw();ready()},{once:true});
  else{sw();ready()}
})();

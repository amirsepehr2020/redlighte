(()=>{
  const phrases={
    en:['What can I help you with?','What are you curious about?','What should we create today?','What would you like to explore?','How can Redlighte help?'],
    fa:['چطور می‌تونم کمکت کنم؟','امروز درباره چی کنجکاوی؟','امروز چی بسازیم؟','دوست داری چی رو کشف کنیم؟','Redlighte چطور می‌تونه کمکت کنه؟'],
    ko:['무엇을 도와드릴까요?','무엇이 궁금하신가요?','오늘 무엇을 만들어 볼까요?','무엇을 함께 탐색해 볼까요?','Redlighte가 어떻게 도와드릴까요?'],
    zh:['我可以帮你做什么？','你对什么感到好奇？','今天想创造什么？','想一起探索什么？','Redlighte可以怎样帮助你？'],
    tr:['Size nasıl yardımcı olabilirim?','Bugün neyi merak ediyorsunuz?','Bugün ne oluşturalım?','Neyi birlikte keşfedelim?','Redlighte size nasıl yardımcı olabilir?'],
    fr:['Comment puis-je vous aider ?','Qu’est-ce qui vous intrigue ?','Que voulez-vous créer aujourd’hui ?','Qu’aimeriez-vous explorer ?','Comment Redlighte peut-il vous aider ?'],
    es:['¿En qué puedo ayudarte?','¿Qué te causa curiosidad?','¿Qué creamos hoy?','¿Qué te gustaría explorar?','¿Cómo puede ayudarte Redlighte?'],
    hi:['मैं आपकी किस तरह मदद कर सकता हूँ?','आप किस बारे में जानने के लिए उत्सुक हैं?','आज क्या बनाएँ?','आप क्या जानना चाहेंगे?','Redlighte आपकी कैसे मदद कर सकता है?']
  };

  const style=document.createElement('style');
  style.textContent=`
    .welcome-content h1.hero-title-animated{will-change:opacity,transform;transform-origin:center}
    .welcome-content h1.hero-title-animated.hero-title-out{animation:heroTitleOut .34s cubic-bezier(.22,1,.36,1) both}
    .welcome-content h1.hero-title-animated.hero-title-in{animation:heroTitleIn .55s cubic-bezier(.22,1,.36,1) both}
    @keyframes heroTitleOut{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(-18px) scale(.985);filter:blur(4px)}}
    @keyframes heroTitleIn{from{opacity:0;transform:translateY(22px) scale(.985);filter:blur(4px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
    @media(prefers-reduced-motion:reduce){.welcome-content h1.hero-title-animated.hero-title-out,.welcome-content h1.hero-title-animated.hero-title-in{animation:none!important}}
  `;
  document.head.appendChild(style);

  let index=0;
  let currentLang=localStorage.getItem('redlighte_language')||'en';
  let timer=null;
  let changing=false;

  const getTitle=()=>document.querySelector('#welcomeView h1');
  const getPhrases=()=>phrases[localStorage.getItem('redlighte_language')||'en']||phrases.en;

  function animateTo(text){
    const title=getTitle();
    if(!title||changing||title.textContent===text)return;
    changing=true;
    title.classList.remove('hero-title-in');
    title.classList.add('hero-title-animated','hero-title-out');
    setTimeout(()=>{
      title.textContent=text;
      title.classList.remove('hero-title-out');
      void title.offsetWidth;
      title.classList.add('hero-title-in');
      changing=false;
    },340);
  }

  function syncLanguage(){
    const next=localStorage.getItem('redlighte_language')||'en';
    if(next===currentLang)return;
    currentLang=next;
    index=0;
    const list=getPhrases();
    const title=getTitle();
    if(title&&!changing)title.textContent=list[0];
  }

  function start(){
    const title=getTitle();
    if(!title)return;
    title.classList.add('hero-title-animated','hero-title-in');
    const initial=getPhrases();
    const initialText=title.textContent.trim();
    const initialIndex=initial.indexOf(initialText);
    index=initialIndex>=0?initialIndex:0;
    timer=setInterval(()=>{
      syncLanguage();
      const list=getPhrases();
      index=(index+1)%list.length;
      animateTo(list[index]);
    },3600);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();

(()=>{
  const phrases={
    en:['What can I help you with?','What are you curious about?','What should we create today?','What would you like to explore?','How can Redlighte help?','What would you like to learn?','What idea is on your mind?','What can we discover together?','Ready to bring an idea to life?','What do you want to make today?'],
    fa:['چطور می‌تونم کمکت کنم؟','امروز درباره چی کنجکاوی؟','امروز چی بسازیم؟','دوست داری چی رو کشف کنیم؟','Redlighte چطور می‌تونه کمکت کنه؟','دوست داری امروز چی یاد بگیری؟','چه ایده‌ای توی ذهنت داری؟','با هم چی رو کشف کنیم؟','آماده‌ای یه ایده رو به واقعیت تبدیل کنیم؟','امروز دوست داری چی بسازی؟'],
    ko:['무엇을 도와드릴까요?','무엇이 궁금하신가요?','오늘 무엇을 만들어 볼까요?','무엇을 함께 탐색해 볼까요?','Redlighte가 어떻게 도와드릴까요?','오늘 무엇을 배워볼까요?','어떤 아이디어가 떠오르셨나요?','무엇을 함께 발견해 볼까요?','아이디어를 현실로 만들어 볼까요?','오늘 무엇을 만들어 보고 싶으신가요?'],
    zh:['我可以帮你做什么？','你对什么感到好奇？','今天想创造什么？','想一起探索什么？','Redlighte可以怎样帮助你？','今天想学点什么？','你脑海里有什么想法？','想和我一起发现什么？','准备好把想法变成现实了吗？','今天想创造什么？'],
    tr:['Size nasıl yardımcı olabilirim?','Bugün neyi merak ediyorsunuz?','Bugün ne oluşturalım?','Neyi birlikte keşfedelim?','Redlighte size nasıl yardımcı olabilir?','Bugün ne öğrenmek istersiniz?','Aklınızda hangi fikir var?','Birlikte ne keşfedelim?','Bir fikri gerçeğe dönüştürmeye hazır mısınız?','Bugün ne oluşturmak istersiniz?'],
    fr:['Comment puis-je vous aider ?','Qu’est-ce qui vous intrigue ?','Que voulez-vous créer aujourd’hui ?','Qu’aimeriez-vous explorer ?','Comment Redlighte peut-il vous aider ?','Qu’aimeriez-vous apprendre aujourd’hui ?','Quelle idée avez-vous en tête ?','Que pouvons-nous découvrir ensemble ?','Prêt à donner vie à une idée ?','Qu’aimeriez-vous créer aujourd’hui ?'],
    es:['¿En qué puedo ayudarte?','¿Qué te causa curiosidad?','¿Qué creamos hoy?','¿Qué te gustaría explorar?','¿Cómo puede ayudarte Redlighte?','¿Qué te gustaría aprender hoy?','¿Qué idea tienes en mente?','¿Qué podemos descubrir juntos?','¿Listo para convertir una idea en realidad?','¿Qué te gustaría crear hoy?'],
    hi:['मैं आपकी किस तरह मदद कर सकता हूँ?','आप किस बारे में जानने के लिए उत्सुक हैं?','आज क्या बनाएँ?','आप क्या जानना चाहेंगे?','Redlighte आपकी कैसे मदद कर सकता है?','आज आप क्या सीखना चाहेंगे?','आपके मन में कौन सा विचार है?','हम साथ में क्या खोज सकते हैं?','क्या आप किसी विचार को हकीकत में बदलने के लिए तैयार हैं?','आज आप क्या बनाना चाहेंगे?']
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
  let started=false;

  const getTitle=()=>document.querySelector('#welcomeView h1');
  const getPhrases=()=>phrases[localStorage.getItem('redlighte_language')||'en']||phrases.en;

  function animateTo(text){
    const title=getTitle();
    if(!title||changing)return;
    changing=true;
    title.classList.remove('hero-title-in');
    title.classList.add('hero-title-animated','hero-title-out');
    setTimeout(()=>{
      if(title.firstChild) title.firstChild.nodeValue=text;
      else title.appendChild(document.createTextNode(text));
      title.classList.remove('hero-title-out');
      void title.offsetWidth;
      title.classList.add('hero-title-in');
      changing=false;
    },340);
  }

  function syncLanguage(){
    const next=localStorage.getItem('redlighte_language')||'en';
    if(next===currentLang)return false;
    currentLang=next;
    index=0;
    const list=getPhrases();
    const title=getTitle();
    if(title&&!changing){
      if(title.firstChild) title.firstChild.nodeValue=list[0];
      else title.appendChild(document.createTextNode(list[0]));
    }
    return true;
  }

  function start(){
    if(started)return;
    const title=getTitle();
    if(!title)return false;
    started=true;
    title.classList.add('hero-title-animated','hero-title-in');
    const initial=getPhrases();
    const initialText=title.textContent.trim();
    const initialIndex=initial.indexOf(initialText);
    index=initialIndex>=0?initialIndex:0;
    timer=setInterval(()=>{
      const languageChanged=syncLanguage();
      if(languageChanged)return;
      const list=getPhrases();
      index=(index+1)%list.length;
      animateTo(list[index]);
    },2500);
    return true;
  }

  function waitForTitle(){
    if(start())return;
    const observer=new MutationObserver(()=>{
      if(start())observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForTitle,{once:true});
  else waitForTitle();
})();

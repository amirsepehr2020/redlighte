(()=>{
 const API='https://api.github.com/repos/amirsepehr2020/redlighte/contents/game?ref=main';
 const META={
  '2048':{name:'2048',cat:'Puzzle',icon:'🔢',desc:'Merge matching numbers and chase your best score.'},
  'red-dash':{name:'Red Dash',cat:'Reaction',icon:'⚡',desc:'Catch the red pulse, build your combo and survive.'}
 };
 let lastSignature='';
 const prettify=id=>id.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');
 const getGames=async()=>{
  const res=await fetch(API,{headers:{Accept:'application/vnd.github+json'}});
  if(!res.ok)throw new Error('game discovery failed');
  const items=await res.json();
  return items.filter(x=>x.type==='dir'&&x.name!=='assets').map(x=>{
   const m=META[x.name]||{};
   return {id:x.name,name:m.name||prettify(x.name),cat:m.cat||'GAME',icon:m.icon||'🎮',desc:m.desc||'Play this Redlighte game.',url:`/game/${encodeURIComponent(x.name)}/`};
  });
 };
 const render=games=>{
  const grid=document.querySelector('#gameLibraryGrid');
  if(!grid)return;
  const signature=games.map(g=>g.id).sort().join('|');
  if(signature===lastSignature)return;
  lastSignature=signature;
  grid.innerHTML=games.map((g,i)=>`<article class="library-card library-original" data-library-game="${g.id}" style="--i:${i}"><div class="library-art"><span>${g.icon}</span><b class="library-badge">${g.cat}</b></div><div class="library-body"><h3>${g.name}</h3><p>${g.desc}</p><button class="library-play" type="button">Play ${g.name} →</button></div></article>`).join('');
  const count=document.querySelector('.game-library-count');
  if(count)count.textContent=`${games.length} GAME${games.length===1?'':'S'}`;
 };
 const cleanLegacy=()=>{
  document.querySelectorAll('#challengeGame option[value="2048"],#challengeGame option[value="red-dash"]').forEach(x=>x.remove());
 };
 const updateChallenge=games=>{
  const s=document.querySelector('#challengeGame');
  if(!s)return;
  [...s.options].filter(o=>o.dataset.autoGame==='1').forEach(o=>o.remove());
  games.forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;o.dataset.autoGame='1';s.appendChild(o)});
 };
 const sync=async()=>{
  try{const games=await getGames();render(games);updateChallenge(games)}catch{if(!lastSignature)render([{...META['2048'],id:'2048',url:'/game/2048/'},{...META['red-dash'],id:'red-dash',url:'/game/red-dash/'}]);}
 };
 const init=()=>{
  sync();
  document.addEventListener('click',e=>{
   const card=e.target.closest('[data-library-game]');
   if(!card)return;
   e.preventDefault();e.stopImmediatePropagation();
   location.href=`/game/${encodeURIComponent(card.dataset.libraryGame)}/`;
  },true);
  setInterval(sync,60000);
  window.addEventListener('focus',sync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
  cleanLegacy();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
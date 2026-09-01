const $=s=>document.querySelector(s);
const modal=$('#gameModal'),mount=$('#gameMount'),toast=$('#toast');
let player=null;
let data={gamesPlayed:0,wins:0,streak:0,xp:0,coins:0,achievements:[],playedOriginals:[]};
let activeChallenge=null;
function notify(t){if(!toast)return;toast.textContent=t;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
function level(){return Math.floor(Math.max(0,Number(data.xp)||0)/100)+1}
function render(){
 $('#gamesPlayed').textContent=data.gamesPlayed||0;$('#wins').textContent=data.wins||0;$('#streak').textContent=data.streak||0;$('#achievements').textContent=data.achievements.length;
 const l=level(),into=(Number(data.xp)||0)%100;$('#level').textContent=l;$('#xp').textContent=100-into;$('#xpBar').style.width=`${into}%`;
 $('#boardName').textContent=player?.name||player?.username||'You';$('#boardLevel').textContent=l;$('#boardXp').textContent=data.xp||0;
 const defs=[['🎮','First Game','Play your first game'],['🏆','First Win','Win a game'],['🔥','On Fire','Reach a 3 day streak'],['⭐','Level 5','Reach level 5'],['👑','Legend','Reach level 10'],['🎯','Quest Hunter','Claim a quest reward']];
 $('#achievementList').innerHTML=defs.map(([i,n,d])=>`<div class="achievement ${data.achievements.includes(n)?'':'locked'}"><span class="icon">${i}</span><b>${n}</b><small>${d}</small></div>`).join('');
 const coins=document.querySelector('#coinsValue');if(coins)coins.textContent=data.coins||0;
}
function unlock(n){if(!data.achievements.includes(n)){data.achievements.push(n);notify(`Achievement unlocked: ${n} 🏆`)}}
async function saveGame(){if(!player)return false;try{const r=await fetch('/api/account/data',{method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({settings:{game:data}})});if(!r.ok)throw new Error('save failed');return true}catch{notify('Could not sync game progress');return false}}
async function questEvent(action,amount=1){try{const r=await fetch('/api/game/quests/progress',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action,amount})});if(!r.ok)throw new Error('quest sync failed');return true}catch{notify('Quest progress could not sync');return false}}
async function loadGameData(){const r=await fetch('/api/account/data',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-store'}});if(!r.ok)throw new Error('account data unavailable');const j=await r.json(),remote=j.settings?.game;if(remote&&typeof remote==='object')data={...data,...remote,achievements:Array.isArray(remote.achievements)?remote.achievements:[],playedOriginals:Array.isArray(remote.playedOriginals)?remote.playedOriginals:[],coins:Math.max(0,Number(remote.coins)||0)};render()}
async function getAccount(){
 const opts={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-store'}};
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch('/api/auth/me',opts);if(r.ok){const j=await r.json();if(j.authenticated&&j.user)return j.user}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
 }
 try{const r=await fetch('/api/account/data',opts);if(r.ok){const j=await r.json();if(j.user)return j.user}}catch{}
 return null;
}
async function connectAccount(){
 const user=await getAccount();
 if(user){try{player=user;await loadGameData();$('#accountName').textContent=player.name||player.username||'Redlighte Account';$('#avatar').textContent=(player.name||player.username||'?').trim().charAt(0).toUpperCase();$('#accountPill').href='/';$('#accountPill').title=`Connected as ${player.name||player.username}`;document.body.classList.add('account-connected');window.dispatchEvent(new CustomEvent('redlighte-account-connected',{detail:player}));render();return}catch{player=null}}
 player=null;$('#accountName').textContent='Sign in to Redlighte';$('#avatar').textContent='→';$('#accountPill').href='/?account=login';document.body.classList.remove('account-connected');render();notify('Sign in to connect your Redlighte Account');
}
async function finishGame(game,score,win=false){
 if(!player){notify('Sign in to Redlighte first');return;}
 data.gamesPlayed++;data.xp+=10+Math.max(0,Math.min(30,score));data.coins+=(win?15:5);
 if(win){data.wins++;data.xp+=20;unlock('First Win')}
 if(score>0)unlock('First Game');
 await questEvent('play',1);if(win)await questEvent('win',1);
 if(activeChallenge){try{await fetch('/api/game/challenges/score',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({id:activeChallenge,score})})}catch{notify('Challenge score could not sync')}activeChallenge=null}
 await saveGame();render();window.dispatchEvent(new CustomEvent('redlighte-game-refresh'));notify(`Game finished: ${score}`)
}
function close(){modal.hidden=true;mount.innerHTML='';activeChallenge=null}
document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',close));
window.RedlighteGame={play(game,challengeId=null){
 if(!player){notify('Connect your Redlighte Account first');connectAccount();return}
 activeChallenge=challengeId||null;
 if(game==='2048'&&window.Redlighte2048)window.Redlighte2048.start().catch(()=>{});
}};
document.querySelectorAll('.play-button').forEach(b=>b.addEventListener('click',()=>window.RedlighteGame.play(b.dataset.game)));
connectAccount();

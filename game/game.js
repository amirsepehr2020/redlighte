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
 const defs=[['🎮','First Game','Play your first game'],['🏆','First Win','Win a game'],['⚡','Speed Player','Score 20+ in Red Rush'],['🔥','On Fire','Reach a 3 day streak'],['⭐','Level 5','Reach level 5'],['🧠','Sharp Mind','Score 10 in Grid'],['🔴','Red Ready','Play all originals'],['👑','Legend','Reach level 10'],['🎯','Quest Hunter','Claim a quest reward']];
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
 if(score>0)unlock('First Game');if(!data.playedOriginals.includes(game))data.playedOriginals.push(game);if(data.playedOriginals.length>=3)unlock('Red Ready');if(level()>=5)unlock('Level 5');if(level()>=10)unlock('Legend');
 if(game==='redrush'&&score>=20)unlock('Speed Player');if(game==='grid'&&score>=10)unlock('Sharp Mind');
 await questEvent('play',1);if(win)await questEvent('win',1);if(game==='redrush'&&score>=20)await questEvent('score20',1);
 if(activeChallenge){try{await fetch('/api/game/challenges/score',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({id:activeChallenge,score})})}catch{notify('Challenge score could not sync')}activeChallenge=null}
 await saveGame();render();window.dispatchEvent(new CustomEvent('redlighte-game-refresh'));notify(`${game==='grid'?'Grid':game==='redrush'?'Red Rush':'Redlight'} finished: ${score}`)
}
function close(){modal.hidden=true;mount.innerHTML='';activeChallenge=null}
function open(title,html){modal.hidden=false;mount.innerHTML=`<div class="mini-game"><p class="eyebrow">REDLIGHTE ORIGINAL</p><h2>${title}</h2>${html}</div>`}
document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',close));
function redRush(){let score=0,time=15,active=false,timer;open('Red Rush',`<p>Tap the target as many times as possible in 15 seconds.</p><div class="mini-score">Score: <b id="rgScore">0</b> · Time: <b id="rgTime">15</b></div><div class="tap-area" id="rgArea"><button class="target" id="rgTarget" aria-label="target"></button></div><button class="big-button" id="rgStart">Start</button>`);const area=$('#rgArea'),target=$('#rgTarget');target.style.display='none';function place(){target.style.left=`${Math.random()*Math.max(0,area.clientWidth-54)}px`;target.style.top=`${Math.random()*Math.max(0,area.clientHeight-54)}px`}$('#rgStart').onclick=()=>{if(active)return;active=true;score=0;time=15;target.style.display='block';place();$('#rgStart').disabled=true;timer=setInterval(async()=>{time--;$('#rgTime').textContent=time;if(time<=0){clearInterval(timer);active=false;target.style.display='none';await finishGame('redrush',score,score>=10)}},1000)};target.onclick=()=>{if(active){score++;$('#rgScore').textContent=score;place()}}}
function redLight(){let active=false,red=false,score=0,roundTimer;open('Redlight',`<p>Tap only while the signal is red. Green means wait.</p><div class="mini-score">Score: <b id="rlScore">0</b></div><div class="signal" id="signal"></div><button class="big-button" id="rlStart">Start</button>`);const signal=$('#signal');$('#rlStart').onclick=()=>{if(active)return;active=true;score=0;$('#rlStart').disabled=true;next()};signal.onclick=async()=>{if(!active)return;if(red){score++;$('#rlScore').textContent=score;next()}else finish()};function next(){clearTimeout(roundTimer);red=false;signal.className='signal green';roundTimer=setTimeout(()=>{red=true;signal.className='signal red';roundTimer=setTimeout(next,900)},700+Math.random()*1500)}async function finish(){clearTimeout(roundTimer);active=false;await finishGame('redlight',score,score>=3);signal.className='signal'}}
function gridGame(){let score=0,round=0,active=-1,timer;open('Grid',`<p>Find the glowing tile. Ten rounds.</p><div class="mini-score">Round: <b id="grRound">0</b>/10 · Score: <b id="grScore">0</b></div><div class="grid-board" id="gridBoard"></div><button class="big-button" id="grStart">Start</button>`);const board=$('#gridBoard');for(let i=0;i<16;i++){const b=document.createElement('button');b.className='grid-cell';b.dataset.i=i;b.onclick=()=>{if(round===0)return;if(+b.dataset.i===active){score++;$('#grScore').textContent=score;next()}else finish()};board.appendChild(b)}function next(){board.querySelectorAll('.grid-cell').forEach(x=>x.classList.remove('active'));round++;$('#grRound').textContent=round;if(round>10)return finish();active=Math.floor(Math.random()*16);board.children[active].classList.add('active');clearTimeout(timer);timer=setTimeout(finish,1700)}async function finish(){clearTimeout(timer);if(round===0)return;const final=score;round=0;await finishGame('grid',final,final>=7)}$('#grStart').onclick=()=>{if(round===0){score=0;next();$('#grStart').disabled=true}}}
window.RedlighteGame={play(game,challengeId=null){if(!player){notify('Connect your Redlighte Account first');connectAccount();return}activeChallenge=challengeId||null;if(game==='redrush')redRush();else if(game==='redlight')redLight();else if(game==='grid')gridGame()}};
document.querySelectorAll('.play-button').forEach(b=>b.addEventListener('click',()=>window.RedlighteGame.play(b.dataset.game)));
connectAccount();

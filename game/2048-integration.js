(()=>{
const files=[
  '/game/2048/js/keyboard_input_manager.js',
  '/game/2048/js/html_actuator.js',
  '/game/2048/js/grid.js',
  '/game/2048/js/tile.js',
  '/game/2048/js/redlighte_storage_manager.js',
  '/game/2048/js/game_manager.js'
];
let managerReady=null;
function fail(message){
  const toast=document.querySelector('#toast');
  if(toast){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
}
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src+'?v=20260901-4';s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+src));document.head.appendChild(s)})}
async function ensureEngine(){
  if(managerReady)return managerReady;
  managerReady=(async()=>{for(const file of files)await load(file);return true})().catch(err=>{managerReady=null;throw err});
  return managerReady;
}
async function start(){
  const mount=document.querySelector('#gameMount'),modal=document.querySelector('#gameModal');
  if(!mount||!modal){fail('2048 could not open');return}
  try{
    const r=await fetch('/api/account/data',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-store'}});
    if(!r.ok){fail('Please sign in to Redlighte first');return}
    const j=await r.json();
    const remote=j.settings?.game?.game2048||{};
    window.__REDLIGHTE_2048_STATE__={bestScore:Number(remote.bestScore)||0,gameState:remote.state||null};
    mount.innerHTML=`<div class="r2048"><div class="heading"><h1 class="title">2048</h1><div class="scores-container"><div class="score-container">0</div><div class="best-container">0</div></div></div><div class="above-game"><p>Join the numbers and reach <strong>2048</strong>.</p><a class="restart-button">New Game</a></div><div class="game-container"><div class="game-message"><p></p><div class="lower"><a class="keep-playing-button">Keep going</a><a class="retry-button">Try again</a></div></div><div class="grid-container"><div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div><div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div><div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div><div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div></div><div class="tile-container"></div></div><p class="game-explanation"><strong>How to play:</strong> Swipe or use arrow keys to merge matching tiles. Your progress is synced to your Redlighte Account.</p></div>`;
    await ensureEngine();
    window.__REDLIGHTE_2048_MANAGER__=new GameManager(4,KeyboardInputManager,HTMLActuator,RedlighteStorageManager);
  }catch(err){console.error('Redlighte 2048:',err);mount.innerHTML='';fail('2048 failed to load — please try again');}
}
window.Redlighte2048={start};
function bind(){
  document.querySelectorAll('.play-button[data-game="2048"]').forEach(button=>{
    button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();start();},true);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

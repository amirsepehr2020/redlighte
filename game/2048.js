(()=>{
  const SIZE=4;
  const TARGET=2048;
  let board=[],score=0,best=0,won=false,keepPlaying=false,locked=false,startedAt=0;
  const key='game2048';
  const $=s=>document.querySelector(s);
  const clone=b=>b.map(r=>r.slice());
  const empty=()=>Array.from({length:SIZE},()=>Array(SIZE).fill(0));
  const randomTile=()=>Math.random()<.9?2:4;
  const addTile=()=>{
    const cells=[]; for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(!board[r][c])cells.push([r,c]);
    if(!cells.length)return; const [r,c]=cells[Math.floor(Math.random()*cells.length)]; board[r][c]=randomTile();
  };
  const compress=line=>{const a=line.filter(Boolean); while(a.length<SIZE)a.push(0); return a};
  const merge=line=>{
    const a=line.filter(Boolean),out=[]; let gained=0;
    for(let i=0;i<a.length;i++){
      if(a[i]===a[i+1]){const v=a[i]*2;out.push(v);gained+=v;i++;} else out.push(a[i]);
    }
    while(out.length<SIZE)out.push(0); return [out,gained];
  };
  const moveLeft=b=>{
    let gained=0,n=[]; for(const row of b){const [m,g]=merge(row);n.push(m);gained+=g} return [n,gained]
  };
  const rotate=b=>b[0].map((_,i)=>b.map(row=>row[i]).reverse());
  const move=dir=>{
    let b=clone(board),turns={left:0,up:1,right:2,down:3}[dir];
    for(let i=0;i<turns;i++)b=rotate(b);
    let [m,g]=moveLeft(b);
    for(let i=0;i<(4-turns)%4;i++)m=rotate(m);
    const changed=JSON.stringify(m)!==JSON.stringify(board); if(changed){board=m;score+=g;addTile();checkWin();render();save();}
    return changed;
  };
  const canMove=()=>{for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){if(!board[r][c])return true;if(c<3&&board[r][c]===board[r][c+1])return true;if(r<3&&board[r][c]===board[r+1][c])return true}return false};
  const checkWin=()=>{if(!won&&board.some(row=>row.includes(TARGET))){won=true;showMessage('2048 reached!','You cracked the core. Keep going for a higher score.');}}
  const showMessage=(title,sub)=>{const m=$('#r2048Message');if(!m)return;m.hidden=false;m.querySelector('strong').textContent=title;m.querySelector('span').textContent=sub};
  const hideMessage=()=>{const m=$('#r2048Message');if(m)m.hidden=true};
  const render=()=>{
    const grid=$('#r2048Grid'); if(!grid)return; grid.innerHTML='';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const v=board[r][c],cell=document.createElement('div');cell.className='r2048-cell';
      if(v){cell.dataset.value=v;cell.innerHTML=`<span>${v}</span>`;cell.animate([{transform:'scale(.82)',opacity:.5},{transform:'scale(1)',opacity:1}],{duration:150,easing:'cubic-bezier(.2,.8,.2,1)'});}
      grid.appendChild(cell);
    }
    $('#r2048Score').textContent=score;$('#r2048Best').textContent=Math.max(best,score);$('#r2048Moves').textContent=Math.max(0,Math.floor((Date.now()-startedAt)/1000));
    if(!canMove()&&!won)showMessage('Run complete','No moves left. Start a new run and beat your best.');
  };
  const save=async()=>{
    try{
      best=Math.max(best,score);
      const r=await fetch('/api/account/data',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-store'}}); if(!r.ok)return;
      const j=await r.json(); const settings={...(j.settings||{}),game:{...(j.settings?.game||{}),game2048:{bestScore:best,state:{board,score,won,keepPlaying}}}};
      await fetch('/api/account/data',{method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({settings})});
    }catch{}
  };
  const finish=async()=>{if(window.RedlighteGame?.finish)await window.RedlighteGame.finish('2048',score,won);};
  const newGame=async()=>{board=empty();score=0;won=false;keepPlaying=false;startedAt=Date.now();hideMessage();addTile();addTile();render();await save()};
  const start=async()=>{
    const mount=$('#gameMount'); if(!mount)return;
    mount.innerHTML=`<div class="r2048-wrap"><div class="r2048-top"><div><div class="r2048-kicker">REDLIGHTE ORIGINAL</div><h1>2048 <span>∞</span></h1><p>Merge. Multiply. Break your record.</p></div><div class="r2048-scores"><div><small>SCORE</small><b id="r2048Score">0</b></div><div><small>BEST</small><b id="r2048Best">0</b></div></div></div><div class="r2048-tools"><button id="r2048New">New run</button><span>Move with <b>← ↑ ↓ →</b> or swipe</span><span>TIME <b id="r2048Moves">0</b></span></div><div class="r2048-board"><div class="r2048-grid" id="r2048Grid"></div><div class="r2048-message" id="r2048Message" hidden><strong></strong><span></span><div><button id="r2048Continue">Keep going</button><button id="r2048Retry">New run</button></div></div></div><div class="r2048-footer"><span>Reach 2048 to win</span><button id="r2048Done">Save & exit</button></div></div>`;
    $('#r2048New').onclick=newGame;$('#r2048Retry').onclick=newGame;$('#r2048Continue').onclick=()=>{keepPlaying=true;hideMessage()};$('#r2048Done').onclick=async()=>{await finish();if(window.RedlighteGameClose)window.RedlighteGameClose()};
    let sx=0,sy=0; mount.ontouchstart=e=>{const t=e.changedTouches[0];sx=t.clientX;sy=t.clientY};mount.ontouchend=e=>{const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;if(Math.abs(dx)>Math.abs(dy))move(dx>0?'right':'left');else move(dy>0?'down':'up')};
    if(!board.length){board=empty();score=0;won=false;startedAt=Date.now();addTile();addTile()} render();
    document.onkeydown=e=>{if(!$('#r2048Grid'))return;const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(map[e.key]){e.preventDefault();move(map[e.key])}};
  };
  window.Redlighte2048={start,newGame};
})();
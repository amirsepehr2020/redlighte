const form=document.querySelector('#searchForm');
const input=document.querySelector('#q');
const grid=document.querySelector('#grid');
const status=document.querySelector('#status');
const player=document.querySelector('#player');
const audio=document.querySelector('#audio');
const playerCover=document.querySelector('#playerCover');
const playerTitle=document.querySelector('#playerTitle');
const playerArtist=document.querySelector('#playerArtist');
const typeFa={song:'آهنگ',artist:'خواننده',album:'آلبوم'};
const API='/api/music';
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function coverUrl(r){return r.coverUrl?`${API}/cover?url=${encodeURIComponent(r.coverUrl)}`:'';}
function render(results){if(!results.length){grid.innerHTML='<div class="empty">نتیجه‌ای پیدا نشد 😕<br><small>نام خواننده یا آهنگ را کمی متفاوت امتحان کن.</small></div>';return;}grid.innerHTML=results.map((r,i)=>{const c=coverUrl(r);return `<article class="card" data-index="${i}">${c?`<img class="cover" loading="lazy" src="${c}" alt="" onerror="this.closest('.card').classList.add('no-cover');this.remove()">`:'<div class="cover"></div>'}<div class="type">${typeFa[r.type]||'موسیقی'}</div><h3>${esc(r.title)}</h3><p>${esc(r.artist||r.album||'')}</p></article>`}).join('');grid.querySelectorAll('.card').forEach((el,i)=>el.addEventListener('click',()=>openResult(results[i])));}
async function openResult(r){if(r.type==='song'&&r.audioUrl){player.classList.remove('hidden');playerTitle.textContent=r.title;playerArtist.textContent=r.artist||'';const c=coverUrl(r);if(c)playerCover.src=c;audio.src=r.audioUrl;await audio.play().catch(()=>{});return;}if(r.type==='song'){player.classList.remove('hidden');playerTitle.textContent=r.title;playerArtist.textContent='پخش مستقیم برای این آهنگ ثبت نشده است.';audio.removeAttribute('src');audio.load();}}
async function search(q){q=q.trim();if(q.length<2)return;status.textContent='در حال جستجو…';grid.innerHTML='<div class="empty">داریم می‌گردیم 🔎</div>';try{const res=await fetch(`${API}/search?q=${encodeURIComponent(q)}`,{headers:{Accept:'application/json'}});const data=await res.json();if(!res.ok)throw new Error(data.error||'خطا');render(Array.isArray(data.results)?data.results:[]);status.textContent=`${Array.isArray(data.results)?data.results.length:0} نتیجه`;history.replaceState(null,'',`/music/?q=${encodeURIComponent(q)}`);}catch(e){console.error(e);grid.innerHTML='<div class="empty">ارتباط با سرویس موسیقی برقرار نشد. دوباره امتحان کن.</div>';status.textContent='خطا';}}
form.addEventListener('submit',e=>{e.preventDefault();search(input.value)});document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.q;search(b.dataset.q)}));
const initial=new URLSearchParams(location.search).get('q');if(initial){input.value=initial;search(initial);}

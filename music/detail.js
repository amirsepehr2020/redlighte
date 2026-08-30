const root=document.getElementById('music-detail');
const path=location.pathname.split('/').filter(Boolean);
const type=path[1]||'';
const slug=decodeURIComponent(path[2]||'');
const endpoint=type&&slug?`/api/music/${type}/${encodeURIComponent(slug)}`:'';
const esc=v=>{const d=document.createElement('div');d.textContent=v??'';return d.innerHTML};
async function load(){
  if(!endpoint){root.innerHTML='<p class="empty">Music item not found.</p>';return;}
  try{
    const r=await fetch(endpoint,{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('not found');
    const data=await r.json();
    const item=data.song||data.artist||data.album||data;
    if(!item||(!item.title&&!item.name)){throw new Error('not found');}
    const title=item.title||item.name;
    const image=item.cover_url||item.image_url||'';
    root.innerHTML=`<a class="detail-back" href="/music">← Music</a><div class="detail-card">${image?`<img class="detail-cover" src="${esc(image)}" alt="">`:''}<div class="detail-info"><p class="eyebrow">REDLIGHTE MUSIC</p><h1>${esc(title)}</h1><p class="detail-sub">${esc(item.artist||item.artist_name||'')}</p><div class="detail-actions">${item.audio_url?`<audio controls preload="none" src="${esc(item.audio_url)}"></audio>`:''}</div><p class="detail-description">${esc(item.description||item.bio||'')}</p></div></div>`;
  }catch{root.innerHTML='<div class="empty">This music item is not available yet.</div>';}
}
load();

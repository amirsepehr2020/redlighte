const DATA_URL='/articles/data/articles.json';
let allArticles=[];let category='all';
const $=s=>document.querySelector(s);
function esc(v=''){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){const q=$('#search').value.trim().toLowerCase();const list=allArticles.filter(a=>(category==='all'||a.category===category)&&(!q||`${a.title} ${a.description} ${a.category} ${(a.tags||[]).join(' ')}`.toLowerCase().includes(q)));$('#empty').hidden=list.length>0;$('#articles').innerHTML=list.map((a,i)=>`<a class="card fade" style="animation-delay:${Math.min(i*45,300)}ms" href="${esc(a.url)}"><div class="card-top"><span class="category">${esc(a.category)}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><div class="meta"><span>${esc(a.readingTime)} min read</span><span>${esc(a.publishedAt)}</span></div></a>`).join('')}
fetch(DATA_URL).then(r=>r.json()).then(d=>{allArticles=d.articles||[];render()}).catch(()=>{$('#empty').hidden=false});
$('#filters').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;category=b.dataset.category;document.querySelectorAll('#filters button').forEach(x=>x.classList.toggle('active',x===b));render()});
$('#search').addEventListener('input',render);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus()}});
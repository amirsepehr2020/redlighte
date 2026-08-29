const DATA_URL='/articles/data/articles.json';const EXTRA_URL='/articles/data/articles-extra.json';
let allArticles=[];let category='all';
const $=s=>document.querySelector(s);
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function faDate(value){try{return new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value+'T00:00:00'))}catch{return value}}
function categoryName(value){return ({ai:'هوش مصنوعی',technology:'تکنولوژی',tutorials:'آموزش‌ها',redlighte:'ردلایت'})[value]||value}
function render(){const q=$('#search').value.trim().toLowerCase();const list=allArticles.filter(a=>(category==='all'||a.category===category)&&(!q||`${a.title} ${a.description} ${a.category} ${(a.tags||[]).join(' ')} ${(a.keywords||[]).join(' ')}`.toLowerCase().includes(q)));$('#empty').hidden=list.length>0;$('#articles').innerHTML=list.map((a,i)=>`<a class="card fade" style="animation-delay:${Math.min(i*45,300)}ms" href="${esc(a.url)}"><div class="card-top"><span class="category">${esc(categoryName(a.category))}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><div class="meta"><span>${esc(a.readingTime)} دقیقه مطالعه</span><span>${esc(faDate(a.publishedAt))}</span></div></a>`).join('')}
Promise.all([fetch(DATA_URL).then(r=>r.json()),fetch(EXTRA_URL).then(r=>r.json())]).then(([base,extra])=>{allArticles=[...(base.articles||[]),...(extra.articles||[])];render()}).catch(()=>{$('#empty').hidden=false});
$('#filters').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;category=b.dataset.category;document.querySelectorAll('#filters button').forEach(x=>x.classList.toggle('active',x===b));render()});
$('#search').addEventListener('input',render);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus()}});
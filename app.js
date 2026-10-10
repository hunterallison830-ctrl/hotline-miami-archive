const $=s=>document.querySelector(s);let D,tab='characters',game='all',sub='all',q='';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// wavy color-cycling title
const t=$('#title');if(t)t.innerHTML=[...t.textContent].map((c,i)=>c===' '?'<span>&nbsp;</span>':`<span style="animation-delay:${i*-.09}s,${i*-.18}s">${c}</span>`).join('');
let t0=Date.now();setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);$('#clock')&&($('#clock').textContent=`SP ${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`)},1000);
const slug=x=>x.id||x.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const SUBS={characters:['all','Playable','Masked Figure','Boss','NPC'],masks:['all','HM1 Jacket','HM2'],weapons:['all','Melee','Firearm','Thrown','Cut/Beta']};
const stCls=s=>s.startsWith('DEAD')?'dead':s==='ALIVE'?'alive':'unk';
const stTxt=s=>s==='DEAD?'?'DEAD?':s;
const face=(img,name)=>img?`<img src="${img}" alt="${esc(name)}" loading="lazy">`:`<span class="fallback">${esc(name.split(/\s+/).map(w=>w[0]).join('').slice(0,3))}</span>`;
function items(){
  let L=D[tab];
  return L.filter(x=>{
    const g=tab==='masks'?x.entries.map(e=>e.game):x.games;
    if(game!=='all'&&!g.includes(game))return false;
    if(sub!=='all'){
      if(tab==='characters'&&x.role!==sub)return false;
      if(tab==='weapons'&&(sub==='Cut/Beta'?!x.cut:x.type!==sub))return false;
      if(tab==='masks'&&!(sub==='HM2'?g.includes('HM2'):x.entries.some(e=>e.game==='HM1')))return false;}
    if(q&&!JSON.stringify(x).toLowerCase().includes(q))return false;return true;});
}
function render(){
  if(!$('#grid'))return;
  $('#subf').innerHTML=SUBS[tab].map(s=>`<button data-s="${s}" class="${s===sub?'on':''}">${s.toUpperCase()}</button>`).join('');
  const L=items();$('#count').textContent=`${L.length} / ${D[tab].length} ${tab.toUpperCase()} ON TAPE`;
  $('#grid').innerHTML=L.map((x,i)=>{
    let tags='';
    if(tab==='characters')tags=`<span class="tag ${stCls(x.status)}">${stTxt(x.status)}</span>`+x.games.map(g=>`<span class="tag">${g}</span>`).join('');
    if(tab==='weapons')tags=`<span class="tag">${x.type.toUpperCase()}</span>`+x.games.map(g=>`<span class="tag">${g}</span>`).join('')+(x.cut?'<span class="tag unk">CUT</span>':'');
    if(tab==='masks')tags=`<span class="tag">${esc(x.animal.toUpperCase())}</span>`;
    return `<button class="card" data-id="${esc(slug(x))}" data-i="${D[tab].indexOf(x)}"><div class="face">${face(x.img,x.name)}</div><div class="cname">${esc(x.name)}</div>${tags}</button>`}).join('')||'<p class="count">NO SIGNAL. TRY ANOTHER SEARCH.</p>';
}
const maskBox=m=>`<div class="mask">${m.img?`<img src="${m.img}" alt="${esc(m.name)} mask" loading="lazy">`:'<span class="fallback">?</span>'}<div><b>${esc(m.name)}</b> <small>(${esc(m.animal)})</small>${m.entries.map(e=>`<small><span style="color:var(--pink)">${e.game} · ${esc(e.owner)}:</span> <b style="font-size:8px">${esc(e.ability)}</b> — ${esc(e.detail)}</small>`).join('')}</div></div>`;
const storyHtml=s=>s.map(x=>`<h4>${esc(x.h)}</h4>`+x.p.map(p=>`<p>${esc(p)}</p>`).join('')).join('');
function open(i){
  const x=D[tab][i];let h='';
  if(tab==='characters'){
    const ms=x.masks.map(n=>D.masks.find(m=>m.name===n)).filter(Boolean);
    h=`<div class="dhead"><div class="dimg">${face(x.img,x.name)}</div><div class="dinfo"><h2 class="dname">${esc(x.name)}</h2>
    <span class="tag">${x.role.toUpperCase()}</span>${x.games.map(g=>`<span class="tag">${g}</span>`).join('')}
    <div class="death"><b>STATUS:</b> ${stTxt(x.status)}${x.status==='DEAD?'?' (presumed, not confirmed)':''}<br><b>FATE:</b> ${esc(x.death)}</div></div>
    <div class="stamp ${stCls(x.status)}">${x.status==='DEAD?'?'DEAD?':x.status==='UNKNOWN'?'???':x.status}</div></div>
    <h3>// FILE</h3><p>${esc(x.desc)}</p>
    <h3>// MASKS</h3>${ms.length?`<div class="masks">${ms.map(maskBox).join('')}</div>`:'<p>No animal mask worn.</p>'}
    <h3>// STORY</h3>${x.story.length?storyHtml(x.story):'<p>No further story details on record.</p>'}`;
  }else if(tab==='masks'){
    const who=D.characters.filter(c=>c.masks.includes(x.name)).map(c=>c.name);
    h=`<div class="dhead"><div class="dimg">${face(x.img,x.name)}</div><div class="dinfo"><h2 class="dname">${esc(x.name)} MASK</h2><span class="tag">${esc(x.animal.toUpperCase())}</span>
    <p>Worn by: ${esc(who.join(', ')||'—')}</p></div></div><h3>// ABILITIES</h3>${x.entries.map(e=>`<div class="death"><b>${e.game} · ${esc(e.owner)} — ${esc(e.ability)}</b><br>${esc(e.detail)}</div>`).join('')}`;
  }else{
    h=`<div class="dhead"><div class="dimg">${face(x.img,x.name)}</div><div class="dinfo"><h2 class="dname">${esc(x.name)}</h2><span class="tag">${x.type.toUpperCase()}</span>${x.games.map(g=>`<span class="tag">${g}</span>`).join('')}${x.cut?'<span class="tag unk">CUT / BETA / UNUSABLE</span>':''}
    ${x.aka.length?`<p>Also known as: ${esc(x.aka.join(', '))}</p>`:''}<p>${esc(x.desc)}</p></div></div>
    <h3>// STATS</h3><table class="stats">${Object.entries(x.stats).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')||'<tr><td>No stats on record</td></tr>'}</table>
    <h3>// NOTES</h3>${x.notes.length?storyHtml(x.notes):'<p>No further notes.</p>'}`;
  }
  $('#mbody').innerHTML=h+`<a class="wikilink" href="${x.wiki}" target="_blank" rel="noopener">▸ FULL ENTRY ON THE WIKI</a>`;
  if($('#modal').hidden)lastFocus=document.activeElement;
  $('#modal').hidden=false;$('#modal').scrollTop=0;document.body.style.overflow='hidden';$('.x').focus({preventScroll:true});
}
let lastFocus=null;
function close(){if($('#modal').hidden)return;$('#modal').hidden=true;document.body.style.overflow='';const f=lastFocus;lastFocus=null;if(f&&f.isConnected&&f!==document.body)f.focus({preventScroll:true});}
// keep Tab inside the open dossier
addEventListener('keydown',e=>{if(e.key!=='Tab'||$('#modal').hidden)return;const fs=[...$('#modal').querySelectorAll('button,a[href],input,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(!fs.length)return;
  const first=fs[0],last=fs[fs.length-1];if(!$('#modal').contains(document.activeElement)){e.preventDefault();first.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal'||e.target.closest('.x'))close()});
addEventListener('keydown',e=>{if(e.key==='Escape')close()});
$('#grid')?.addEventListener('click',e=>{const c=e.target.closest('.card');if(c){gridAt=c.dataset.id;sync3d();open(+c.dataset.i)}});
function setTab(k){tab=k;sub='all';document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab===k));render();sync3d()}
$('#menu')?.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab)});
// grid -> 3D link carries the current deck and last opened/focused item
let gridAt='';function sync3d(){const l=$('#to3d');if(l)l.href=`index.html?3d=1&deck=${tab}`+(gridAt?`&at=${encodeURIComponent(gridAt)}`:'');}
$('#grid')?.addEventListener('focusin',e=>{const c=e.target.closest('.card');if(c){gridAt=c.dataset.id;sync3d()}});
$('#gamef')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;game=b.dataset.g;document.querySelectorAll('#gamef button').forEach(x=>x.classList.toggle('on',x===b));render()});
$('#subf')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;sub=b.dataset.s;render()});
$('#q')?.addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();render()});
// optional synth music (generated, no files)
let ac,timer;if($('#music'))$('#music').onclick=function(){
  if(timer){clearInterval(timer);timer=null;this.textContent='MUSIC: OFF';this.setAttribute('aria-pressed','false');return}
  ac=ac||new AudioContext();const notes=[57,60,64,67,69,67,64,60,53,57,60,64,55,59,62,67];let n=0;
  timer=setInterval(()=>{const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';o.frequency.value=440*2**((notes[n%16]-69)/12);f.type='lowpass';f.frequency.value=900+600*Math.sin(n/8);
    g.gain.setValueAtTime(.06,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.22);o.connect(f).connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.25);n++},180);
  this.textContent='MUSIC: ON';this.setAttribute('aria-pressed','true')};
window.HM={open:(k,i)=>{tab=k;open(i)},close,isOpen:()=>!$('#modal').hidden,slug,find:h=>{h=decodeURIComponent(h||'').toLowerCase();if(!h||!D)return null;for(const k of['characters','masks','weapons']){const i=D[k].findIndex(x=>slug(x)===h||x.name.toLowerCase()===h);if(i>=0)return{k,i}}return null}};
fetch('data.json').then(r=>r.json()).then(d=>{D=d;window.HM.D=d;window.dispatchEvent(new Event('hmdata'));if(!$('#grid'))return;
  const P=new URLSearchParams(location.search),hit=window.HM.find(location.hash.slice(1));
  if(hit){setTab(hit.k);gridAt=slug(d[hit.k][hit.i]);sync3d();open(hit.i);return}
  // arriving from 3D: restore deck and scroll to the card without opening it
  const dk=P.get('deck');setTab(['characters','masks','weapons'].includes(dk)?dk:dk==='dead'?'characters':'characters');
  const at=window.HM.find(P.get('at'));if(at){gridAt=slug(d[at.k][at.i]);sync3d();const c=document.querySelector(`.card[data-id="${CSS.escape(gridAt)}"]`);if(c){c.scrollIntoView({block:'center'});c.focus({preventScroll:true});c.classList.add('here')}}
});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

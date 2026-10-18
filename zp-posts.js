/* LIFEISGAMETZ — feed ya machapisho (Sports News / Content): kadi, filter, search, detail yenye video/picha, share.
   ZP.posts.mount(element, { section:'sports'|'content', empty:'...' }) */
(function(){
  var ZP = window.ZP = window.ZP || {};
  function esc(x){ var d=document.createElement('div'); d.textContent = x==null ? '' : String(x); return d.innerHTML; }
  function ago(iso){
    var s = (Date.now() - new Date(iso).getTime())/1000;
    if (s < 60) return 'sasa hivi'; if (s < 3600) return 'dakika '+Math.floor(s/60)+' zilizopita';
    if (s < 86400) return 'saa '+Math.floor(s/3600)+' zilizopita'; if (s < 172800) return 'jana';
    return new Date(iso).toLocaleDateString('sw-TZ',{day:'numeric',month:'short',year:'numeric'});
  }
  function rich(t){ // escape -> linkify -> **bold** -> aya
    var h = esc(t).replace(/(https?:\/\/[^\s<]+)/g, function(u){ return '<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+u+'</a>'; }).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    return h.split(/\n{2,}/).map(function(p){ return '<p>'+p.replace(/\n/g,'<br>')+'</p>'; }).join('');
  }
  function css(){
    if (document.getElementById('zpPostsCss')) return;
    var s = document.createElement('style'); s.id = 'zpPostsCss';
    s.textContent =
'.pp-bar{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}'+
'.pp-search{display:flex;align-items:center;gap:8px;height:44px;border-radius:12px;border:1px solid #1d3570;background:#08122c;padding:0 12px;margin:10px 0}'+
'.pp-search input{flex:1;min-width:0;background:none;border:0;color:#f4f7ff;font:500 14px var(--font-b,system-ui);outline:0}'+
'.pp-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}'+
'.pp-card{background:linear-gradient(180deg,#0e1a3f,#0a1330);border:1px solid var(--line2,#233f88);border-radius:16px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;text-align:left;color:inherit;padding:0;font:inherit}'+
'.pp-card:hover,.pp-card:focus-visible{border-color:#7c3aff;outline:0;transform:translateY(-2px)}'+
'.pp-media{position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#27106b,#0b3b66);display:grid;place-items:center;font-size:44px;overflow:hidden}'+
'.pp-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'+
'.pp-badge{position:absolute;left:10px;top:10px;padding:4px 10px;border-radius:99px;background:rgba(5,10,30,.8);font:700 11px var(--font-b,system-ui);letter-spacing:.4px}'+
'.pp-play{position:absolute;inset:auto 10px 10px auto;width:40px;height:40px;border-radius:50%;background:rgba(124,58,255,.9);display:grid;place-items:center;font-size:16px}'+
'.pp-body{padding:12px 14px 14px;display:grid;gap:6px}.pp-body h3{margin:0;font:700 17px/1.3 var(--font-d,system-ui)}'+
'.pp-body p{margin:0;color:var(--muted,#93a3c7);font-size:13.5px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'+
'.pp-meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--dim,#6b7aa0);font-size:12px}'+
'.pp-hero{grid-column:1/-1}.pp-hero .pp-card{flex-direction:row}.pp-hero .pp-media{flex:1 1 55%;aspect-ratio:auto;min-height:240px}.pp-hero .pp-body{flex:1 1 45%;align-content:center;padding:20px}.pp-hero h3{font-size:26px}.pp-hero p{-webkit-line-clamp:4;font-size:15px}'+
'@media(max-width:700px){.pp-hero .pp-card{flex-direction:column}.pp-hero .pp-media{min-height:0;aspect-ratio:16/9}.pp-hero h3{font-size:21px}}'+
'.pp-more{display:block;margin:18px auto 0}'+
'.pp-modal{position:fixed;inset:0;z-index:300;background:rgba(2,5,18,.86);display:grid;place-items:start center;overflow:auto;padding:16px}'+
'.pp-sheet{width:min(820px,100%);background:#0a1330;border:1px solid var(--line2,#233f88);border-radius:18px;padding:18px;margin:20px 0 80px}'+
'.pp-sheet h2{margin:10px 0 6px;font:700 26px/1.25 var(--font-d,system-ui)}'+
'.pp-text{font-size:16px;line-height:1.75;color:#dbe6ff}.pp-text a{color:#19d8ff;word-break:break-all}.pp-text p{margin:0 0 14px}'+
'.pp-img{width:100%;border-radius:14px;display:block;margin:6px 0 14px}'+
'.pp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}'+
'.pp-x{float:right;background:#16224d;border:1px solid #2a3a7a;color:#fff;width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer}';
    document.head.appendChild(s);
  }
  var ICON = { text:'📝', image:'🖼️', video:'🎬' };

  ZP.posts = {
    mount: function(el, opts){
      opts = opts || {}; css();
      var section = opts.section === 'content' ? 'content' : 'sports';
      var state = { cat:'', q:'', offset:0, items:[], total:0, cats:[], busy:false }, player = null, lastFocus = null;
      el.innerHTML = '<div class="pp-bar" id="ppCats" role="tablist" aria-label="Category"></div>'+
        '<label class="pp-search"><span aria-hidden="true">🔎</span><input type="search" id="ppQ" placeholder="Tafuta…" aria-label="Tafuta" autocomplete="off"></label>'+
        '<div class="pp-grid" id="ppGrid" aria-live="polite"><div class="zp-empty" style="grid-column:1/-1"><p>Inapakia…</p></div></div>'+
        '<button class="zp-btn pp-more" id="ppMore" hidden>Pakia zaidi</button>';
      var grid = el.querySelector('#ppGrid'), more = el.querySelector('#ppMore');

      function card(p, hero){
        var thumb = p.imageUrl ? '<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy" onerror="this.remove()">' : '';
        var play = p.type === 'video' ? '<span class="pp-play" aria-hidden="true">▶</span>' : '';
        return '<'+(hero?'div class="pp-hero"':'div')+'><button type="button" class="pp-card" data-id="'+esc(p.id)+'">'+
          '<span class="pp-media" style="display:grid">'+thumb+(p.imageUrl?'':'<span aria-hidden="true">'+ICON[p.type]+'</span>')+
          '<span class="pp-badge">'+(p.pinned?'📌 ':'')+ICON[p.type]+' '+esc(p.category)+'</span>'+play+'</span>'+
          '<span class="pp-body"><h3>'+esc(p.title)+'</h3><p>'+esc(p.summary)+'</p>'+
          '<span class="pp-meta"><span>🕒 '+esc(ago(p.createdAt))+'</span><span>👁️ '+(p.views||0)+'</span></span></span></button></div>';
      }
      function render(){
        if (!state.items.length){
          grid.innerHTML = '<div class="zp-empty" style="grid-column:1/-1"><h3>'+(state.q||state.cat?'Hakuna kilichopatikana':'Bado hakuna machapisho')+'</h3><p>'+esc(state.q||state.cat?'Jaribu neno au category nyingine.':(opts.empty||'Machapisho mapya yataonekana hapa hivi karibuni.'))+'</p></div>';
        } else {
          var first = !state.cat && !state.q && state.items[0] && state.items[0].pinned;
          grid.innerHTML = state.items.map(function(p,i){ return card(p, first && i===0); }).join('');
        }
        more.hidden = state.items.length >= state.total;
        el.querySelector('#ppCats').innerHTML = '<button type="button" class="zp-chip'+(state.cat?'':' active')+'" data-cat="">Zote</button>'+
          state.cats.map(function(c){ return '<button type="button" class="zp-chip'+(state.cat===c.name?' active':'')+'" data-cat="'+esc(c.name)+'">'+esc(c.name)+' <i>'+c.count+'</i></button>'; }).join('');
      }
      function load(reset){
        if (state.busy) return; state.busy = true;
        if (reset){ state.offset = 0; state.items = []; }
        var u = '/api/news?section='+section+'&limit=12&offset='+state.offset+(state.cat?'&cat='+encodeURIComponent(state.cat):'')+(state.q?'&q='+encodeURIComponent(state.q):'');
        fetch(u).then(function(r){ return r.json(); }).then(function(d){
          state.items = state.items.concat(d.items||[]); state.total = d.total||0; state.cats = d.categories||[]; state.offset = state.items.length; render();
        }).catch(function(){ grid.innerHTML = '<div class="zp-empty" style="grid-column:1/-1"><h3>Hitilafu ya mtandao</h3><p>Jaribu tena baadaye.</p></div>'; })
        .then(function(){ state.busy = false; });
      }

      function close(){
        var m = document.getElementById('ppModal'); if (m) m.remove();
        if (player){ player.destroy(); player = null; }
        document.body.style.overflow = '';
        if (/^#p=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      function open(id, push){
        lastFocus = document.activeElement;
        fetch('/api/news/'+encodeURIComponent(id)).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); }).then(function(x){
          if (!x.ok){ alert('Chapisho halipatikani tena.'); return; }
          var p = x.d.post; close(); lastFocus = document.activeElement;
          var m = document.createElement('div'); m.id = 'ppModal'; m.className = 'pp-modal'; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); m.setAttribute('aria-label', p.title);
          var url = location.origin + location.pathname + '#p=' + p.id, wa = 'https://wa.me/?text=' + encodeURIComponent(p.title + ' — ' + url);
          m.innerHTML = '<div class="pp-sheet"><button type="button" class="pp-x" aria-label="Funga">✕</button>'+
            '<div class="pp-meta"><span class="pp-badge" style="position:static">'+ICON[p.type]+' '+esc(p.category)+'</span><span>🕒 '+esc(ago(p.createdAt))+'</span><span>👁️ '+(p.views||0)+'</span>'+(p.author?'<span>✍️ '+esc(p.author)+'</span>':'')+'</div>'+
            '<h2>'+esc(p.title)+'</h2><div id="ppMedia"></div>'+
            (p.type==='image'&&p.imageUrl?'<img class="pp-img" src="'+esc(p.imageUrl)+'" alt="'+esc(p.title)+'">':'')+
            '<div class="pp-text">'+rich(p.body||p.summary||'')+'</div>'+
            (p.tags&&p.tags.length?'<div class="pp-meta">'+p.tags.map(function(t){ return '<span>#'+esc(t)+'</span>'; }).join('')+'</div>':'')+
            '<div class="pp-actions"><a class="zp-btn" href="'+wa+'" target="_blank" rel="noopener noreferrer">Share WhatsApp</a><button type="button" class="zp-btn ghost" id="ppCopy">🔗 Nakili link</button></div></div>';
          document.body.appendChild(m); document.body.style.overflow = 'hidden';
          if (p.type === 'video' && p.video) player = ZP.player.mount(m.querySelector('#ppMedia'), p.video, { poster: p.imageUrl || '', title: p.title });
          else if (p.type === 'text' && p.imageUrl) m.querySelector('#ppMedia').innerHTML = '<img class="pp-img" src="'+esc(p.imageUrl)+'" alt="">';
          m.querySelector('.pp-x').addEventListener('click', close); m.querySelector('.pp-x').focus();
          m.addEventListener('click', function(e){ if (e.target === m) close(); });
          m.querySelector('#ppCopy').addEventListener('click', function(e){ var b = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){ b.textContent = '✅ Imenakiliwa'; }).catch(function(){ prompt('Nakili link:', url); }); });
          if (push) history.replaceState(null, '', '#p=' + p.id);
        }).catch(function(){ alert('Hitilafu ya mtandao.'); });
      }
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && document.getElementById('ppModal')) close(); });
      window.addEventListener('hashchange', function(){ var m = /^#p=(.+)$/.exec(location.hash); if (m) open(m[1], false); });

      el.addEventListener('click', function(e){
        var cat = e.target.closest('[data-cat]'); if (cat){ state.cat = cat.dataset.cat; load(true); return; }
        var c = e.target.closest('.pp-card'); if (c) open(c.dataset.id, true);
      });
      more.addEventListener('click', function(){ load(false); });
      var t = null; el.querySelector('#ppQ').addEventListener('input', function(e){ clearTimeout(t); t = setTimeout(function(){ state.q = e.target.value.trim(); load(true); }, 350); });
      load(true);
      var h = /^#p=(.+)$/.exec(location.hash); if (h) open(h[1], false);
    }
  };
})();

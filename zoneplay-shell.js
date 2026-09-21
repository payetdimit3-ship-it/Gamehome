(function(){
  const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const isAdmin=path==='admin.html';
  const links=[
    ['index.html','⌂','Home'],['shop.html','🎮','Store'],['categories.html','▦','Games'],
    ['shop.html?category=PSP','🎮','PSP Gaming'],['shop.html?category=PS2','🎮','PS2 Gaming'],['shop.html?category=PS3','🎮','PS3 Gaming'],
    ['shop.html?category=Nintendo Switch','🎮','Nintendo Switch'],['shop.html?category=Android','▣','Android Gaming'],['shop.html?category=PC','▤','PC Gaming'],
    ['movies.html','▣','Movies'],['live.html','▣','Live TV / Sports'],['livescores.html','●','Live Scores'],['academy.html','▰','Academy / Courses'],
    ['cloudgaming.html','☁','Cloud Gaming'],['efootball.html','◉','eFootball & Top Up'],['giftcards.html','🎁','Gift Cards'],['chat.html','◌','Community / Chat'],
    ['health.html','♥','Health Assistant'],['courses.html','◉','AI Assistant'],['marketplace.html','▰','Marketplace'],
    ['wishlist.html','♡','Wishlist'],['cart.html','🛒','Cart'],['mygames.html','▣','My Games / Library'],['profile.html','♙','Profile']
  ];
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function makeSidebar(){
    const nav=links.map(([href,ico,label])=>{const base=href.split('?')[0];const active=base===path?' active':'';return `<a class="zp-link${active}" href="${href}"><span class="ico">${ico}</span><span class="label">${label}</span>${base==='cart.html'?'<span class="badge" id="cartCount">0</span>':''}</a>`}).join('');
    return `<aside class="zp-sidebar"><div class="zp-brand"><div class="zp-brand-mark">✦</div><div><div class="zp-brand-name">LIFEIS<span>GAME</span><i>TZ</i></div><div class="zp-brand-sub">PLAY • LEARN • EARN</div></div></div><nav class="zp-nav"><div class="zp-nav-section">Main</div>${nav}</nav><div class="zp-sidebar-bottom"><a class="zp-link" href="contact.html"><span class="ico">☎</span><span class="label">Contact</span></a></div></aside>`;
  }
  function makeTop(){return `<div class="zp-topbar"><input id="searchBox" class="zp-search" placeholder="Tafuta game, filamu, kozi, bidhaa..." autocomplete="off"><div class="zp-top-actions"><a class="zp-icon-btn" href="chat.html">♧</a><a class="zp-icon-btn" href="wishlist.html">♡</a><a class="zp-wallet" href="topup.html">💼 <strong>TSh 12,500</strong> →</a><a id="topLoginBtn" class="zp-profile" href="login.html"><span class="zp-avatar">K</span><span><b>Kelvin Fred</b><small>Premium User</small></span>⌄</a></div></div>`}
  function genericTitle(){const t=document.title.replace(/\s*[—|-].*$/,'').trim();return t||'LIFEISGAMETZ';}
  function buildHome(oldNodes){
    const hero=oldNodes.hero; const featured=oldNodes.featured; const dynamic=oldNodes.dynamic;
    const page=document.createElement('div');page.className='zp-page';
    page.innerHTML=`<div class="zp-home-hero"><div class="zp-hero-card"></div><div class="zp-side-promos"><div class="zp-promo"><h3>🎮 PlayStation</h3><p>PS5 Games • Latest releases</p><a href="shop.html?category=PS5">Explore Now →</a></div><div class="zp-promo"><h3>🎮 Nintendo Switch</h3><p>Switch Games • Digital collection</p><a href="shop.html?category=Nintendo%20Switch">Explore Now →</a></div><div class="zp-promo"><h3>🖥️ PC Games</h3><p>High Performance Gaming</p><a href="shop.html?category=PC">Explore Now →</a></div></div></div><section class="zp-section"><div class="zp-section-head"><h2>🔥 Trending Games</h2><a href="shop.html">Explore All →</a></div><div class="zp-game-grid" id="zpTrending"></div></section><div class="zp-bottom-grid"><section class="zp-section"><div class="zp-section-head"><h2>▦ Browse By Categories</h2><a href="categories.html">Explore All →</a></div><div class="zp-cats"><a class="zp-cat" href="shop.html?category=Action"><span>⚔ Action & Adventure</span></a><a class="zp-cat" href="shop.html?category=Racing"><span>🏎 Racing</span></a><a class="zp-cat" href="shop.html?category=Sports"><span>⚽ Sports</span></a><a class="zp-cat" href="shop.html?category=RPG"><span>🧙 RPG</span></a><a class="zp-cat" href="shop.html?category=Strategy"><span>♟ Strategy</span></a><a class="zp-cat" href="shop.html?category=Shooting"><span>🎯 Shooting</span></a></div></section><section class="zp-section"><div class="zp-section-head"><h2>💜 Special Offers</h2><a href="shop.html">View Deals →</a></div><div class="zp-promo"><h3>Marvel's Spider-Man 2</h3><p style="font-size:16px;color:#29d7ff;font-weight:800">TSh 52,999</p><a href="shop.html">View Deal →</a></div><div class="zp-section" style="margin-top:10px"><div class="zp-section-head"><h2>🕹 My Games</h2><a href="mygames.html">Explore All →</a></div><div class="zp-mini-list"><div class="zp-mini"><div class="zp-avatar">G</div><div><b>GTA V</b><small>Played: 24.5 hrs</small></div></div><div class="zp-mini"><div class="zp-avatar">P</div><div><b>Paladins</b><small>Played: 18.2 hrs</small></div></div></div></div></section></div><section class="zp-section"><div class="zp-section-head"><h2>⚽ Live Football</h2><a href="live.html">View All Matches →</a></div><div class="zp-live-row"><div class="zp-match"><span class="live">LIVE</span><div>Man City <strong>2 - 1</strong> Arsenal</div><small>72:34</small></div><div class="zp-match">Real Madrid <strong>vs</strong> Barcelona</div><div class="zp-match">Bayern Munich <strong>vs</strong> BVB</div></div></section><section class="zp-section"><div class="zp-section-head"><h2>🎓 Popular Courses</h2><a href="courses.html">Explore All →</a></div><div class="zp-mini"><div class="zp-avatar">💻</div><div><b>Web Development</b><small>Learn HTML, CSS, JavaScript</small></div><a class="zp-buy" style="margin-left:auto;width:auto;padding:8px 16px" href="courses.html">View Course</a></div></section>`;
    page.querySelector('.zp-hero-card').appendChild(hero);
    const trend=page.querySelector('#zpTrending'); if(featured){featured.className='zp-game-grid';featured.id='featuredGames';trend.replaceWith(featured)}
    if(dynamic) dynamic.style.display='none';
    return page;
  }
  function run(){
    if(document.body.dataset.zpReady)return;document.body.dataset.zpReady='1';
    const oldSidebar=document.querySelector('.sidebar'); const oldNav=document.querySelector('.navbar');
    const oldMain=document.querySelector('.main');
    const oldTop=oldMain&&oldMain.querySelector('.topbar');
    const scripts=[...document.body.querySelectorAll('script')];
    const styles=[...document.body.querySelectorAll('style')];
    const bodyNodes=[...document.body.children].filter(n=>!scripts.includes(n)&&!styles.includes(n));
    const oldNodes={};
    if(path==='index.html'){
      oldNodes.hero=document.getElementById('heroTrailerStage');oldNodes.featured=document.getElementById('featuredGames');oldNodes.dynamic=document.getElementById('dynamicBanners');
    }
    document.querySelectorAll('.sidebar,.navbar').forEach(n=>n.classList.add('zp-old-hide'));
    const shell=document.createElement('div');shell.className='zp-shell'+(isAdmin?' zp-admin':'');shell.innerHTML=makeSidebar()+`<main class="zp-main"><div class="zp-content"></div></main><nav class="zp-mobile-nav"><a href="index.html"><b>⌂</b>Home</a><a href="shop.html"><b>🎮</b>Store</a><a href="cart.html"><b>🛒</b>Cart</a><a href="mygames.html"><b>▣</b>Library</a><a href="profile.html"><b>♙</b>Profile</a></nav>`;
    const content=shell.querySelector('.zp-content');document.body.appendChild(shell);
    if(path==='index.html' && oldNodes.hero){
      // Replace the old Home layout completely; keep only the existing JS-driven feature nodes.
      const home=buildHome(oldNodes);content.appendChild(home);
      if(oldMain) oldMain.remove();
    }else{
      const wrap=document.createElement('div');wrap.className='zp-generic';
      const header=document.createElement('section');header.className='zp-section';header.style.marginTop='14px';header.innerHTML=`<div class="zp-section-head"><h2>${esc(genericTitle())}</h2><a href="index.html">← Home</a></div>`;wrap.appendChild(header);
      const source=oldMain||document.createDocumentFragment();
      if(oldMain){
        const clone=oldMain; clone.classList.remove('main'); clone.classList.add('zp-page-content'); clone.querySelectorAll('.topbar').forEach(n=>n.remove()); wrap.appendChild(clone);
      }else{
        const holder=document.createElement('div');holder.className='zp-section';
        bodyNodes.filter(n=>n!==oldSidebar&&n!==oldNav).forEach(n=>holder.appendChild(n));wrap.appendChild(holder);
      }
      content.appendChild(wrap);
    }
    // make sure old topbar is not visually present
    if(oldTop)oldTop.remove();
    // Remove orphaned old sidebar/navbar from layout entirely
    if(oldSidebar)oldSidebar.remove();if(oldNav)oldNav.remove();
    if(typeof window.updateCartBadge==='function') window.updateCartBadge();
    if(typeof window.checkUserLoginState==='function') window.checkUserLoginState();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();

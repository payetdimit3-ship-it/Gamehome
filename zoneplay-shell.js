(function(){
  const navMain=[
    ['index.html','⌂','Home'],['shop.html','🎮','Store'],['categories.html','▦','Games'],
    ['shop.html?category=PSP','◈','PSP Gaming'],['shop.html?category=PS2','◈','PS2 Gaming'],['shop.html?category=PS3','◈','PS3 Gaming'],
    ['shop.html?category=Nintendo Switch','◈','Nintendo Switch'],['shop.html?category=Android','▣','Android Gaming'],['shop.html?category=PC','▣','PC Gaming'],
  ];
  const navService=[['movies.html','▣','Movies'],['live.html','▣','Live TV / Sports'],['livescores.html','⚽','Live Scores'],['academy.html','🎓','Academy / Courses'],['cloudgaming.html','☁','Cloud Gaming'],['efootball.html','⚽','eFootball & Top Up'],['giftcards.html','🎁','Gift Cards'],['community.html','◉','Community / Chat'],['health.html','♥','Health Assistant'],['chat.html','✦','AI Assistant'],['marketplace.html','▤','Marketplace']];
  const navUser=[['wishlist.html','♡','Wishlist'],['cart.html','🛒','Cart'],['mygames.html','▤','My Games / Library'],['profile.html','♙','Profile']];
  function link(row){return `<a href="${row[0]}"><span class="zp-ico">${row[1]}</span><span class="zp-label">${row[2]}</span>${row[2]==='Cart'?'<span class="badge" id="cartCount">0</span>':''}</a>`}
  function shell(isAdmin){
    const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    const side=isAdmin?`<div class="zp-brand"><div class="zp-brand-mark">⚡</div><div class="zp-brand-text">LIFEIS<i>GAME</i><b>TZ</b><small>ADMIN • CONTROL CENTER</small></div></div>
      <div class="zp-nav-title">COMMAND</div><nav class="zp-nav">${link(['admin.html','▣','Dashboard'])}${link(['index.html','⌂','View Website'])}</nav>
      <div class="zp-nav-title">MANAGE</div><nav class="zp-nav">${['Products','Orders','Customers','Media & Live','Hero Studio','AI','Security','Settings'].map((x,i)=>`<a href="#" data-admin-jump="${x}"><span class="zp-ico">${['🎮','🧾','♙','▣','✦','✧','🛡','⚙'][i]}</span><span class="zp-label">${x}</span></a>`).join('')}</nav>`:
      `<div class="zp-brand"><div class="zp-brand-mark">✦</div><div class="zp-brand-text">LIFEIS<i>GAME</i><b>TZ</b><small>PLAY • LEARN • EARN</small></div></div>
      <div class="zp-nav-title">GAMING</div><nav class="zp-nav">${navMain.map(link).join('')}</nav>
      <div class="zp-nav-title">EXPLORE</div><nav class="zp-nav">${navService.map(link).join('')}</nav>
      <div class="zp-nav-title">YOUR SPACE</div><nav class="zp-nav">${navUser.map(link).join('')}</nav>`;
    const top=`<header class="zp-topbar"><a class="zp-icon-btn" href="index.html" title="Home">⌂</a><label class="zp-search">⌕<input id="searchBox" placeholder="Tafuta game, filamu, kozi, bidhaa..." autocomplete="off"></label><div class="zp-spacer"></div><div class="zp-top-actions"><a class="zp-icon-btn" href="chat.html">♧<span class="dot">3</span></a><a class="zp-icon-btn" href="cart.html">🛒<span class="dot" id="zpCartDot">0</span></a><a class="zp-wallet" href="topup.html">▣ TSh 12,500 →</a><a class="zp-profile" id="topLoginBtn" href="login.html"><span class="zp-avatar">K</span><span><b>Kelvin Fred</b><small>Premium User</small></span><b>⌄</b></a></div></header>`;
    const mobile=`<nav class="zp-mobile-nav"><a href="index.html"><span>⌂</span>Home</a><a href="shop.html"><span>🎮</span>Store</a><a href="cart.html"><span>🛒</span>Cart</a><a href="mygames.html"><span>▤</span>Library</a><a href="profile.html"><span>♙</span>Profile</a></nav>`;
    const el=document.createElement('div');el.className='zp-shell';el.innerHTML=`<aside class="zp-sidebar">${side}</aside><section class="zp-main">${top}<main class="zp-content" id="zpContent"></main></section>${mobile}`;return el;
  }
  function run(){
    if(document.body.classList.contains('zp-ready')) return;
    const isAdmin=location.pathname.toLowerCase().endsWith('/admin.html')||location.pathname.toLowerCase().endsWith('admin.html');
    const oldMain=document.querySelector('.main');
    const adminPage=document.querySelector('.admin-page');
    const oldFooter=document.querySelector('body>.footer');
    const target=oldMain||adminPage;
    if(!target) return;
    const ui=shell(isAdmin);document.body.classList.add('zp-ready');document.body.prepend(ui);
    const content=ui.querySelector('#zpContent');
    // Move the existing functional page into the new universal content area.
    if(oldMain){oldMain.querySelector(':scope > .topbar')?.remove();content.appendChild(oldMain)}
    else if(adminPage){content.appendChild(adminPage)}
    if(oldFooter) content.appendChild(oldFooter);
    document.querySelectorAll('body>.sidebar,body>.navbar').forEach(x=>x.remove());
    document.querySelectorAll('.zp-nav a').forEach(a=>{const h=(a.getAttribute('href')||'').split('?')[0].toLowerCase();if(h===currentFile())a.classList.add('active')});
    const search=document.getElementById('zpGlobalSearch');if(search){search.addEventListener('keydown',e=>{if(e.key==='Enter'&&search.value.trim()){location.href='shop.html?search='+encodeURIComponent(search.value.trim())}})}
    if(window.updateCartBadge) window.updateCartBadge();
    document.querySelectorAll('[data-admin-jump]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const name=a.dataset.adminJump;const btn=[...document.querySelectorAll('.tab-btn')].find(b=>(b.textContent||'').toLowerCase().includes(name.toLowerCase()));if(btn)btn.click();else document.querySelector('.admin-page')?.scrollIntoView({behavior:'smooth'})}));
  }
  function currentFile(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();

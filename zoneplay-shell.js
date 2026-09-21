(function(){
  const file=()=>((location.pathname.split('/').pop()||'index.html').toLowerCase());
  const nav=[
    ['index.html','⌂','Home'],['shop.html','🎮','Store'],['categories.html','▦','Games'],
    ['shop.html?category=PSP','◈','PSP Gaming'],['shop.html?category=PS2','◈','PS2 Gaming'],['shop.html?category=PS3','◈','PS3 Gaming'],
    ['shop.html?category=Nintendo%20Switch','◈','Nintendo Switch'],['shop.html?category=Android','▣','Android Gaming'],['shop.html?category=PC','▣','PC Gaming'],
    ['movies.html','▣','Movies'],['live.html','▣','Live TV / Sports'],['livescores.html','⚽','Live Scores'],['academy.html','🎓','Academy / Courses'],['cloudgaming.html','☁','Cloud Gaming'],['efootball.html','⚽','eFootball & Top Up'],['giftcards.html','🎁','Gift Cards'],['community.html','◉','Community / Chat'],['health.html','♥','Health Assistant'],['chat.html','✦','AI Assistant'],['marketplace.html','▤','Marketplace'],
    ['wishlist.html','♡','Wishlist'],['cart.html','🛒','Cart'],['mygames.html','▤','My Games / Library'],['profile.html','♙','Profile']
  ];
  const groups=[
    ['GAMING',nav.slice(0,9)],['EXPLORE',nav.slice(9,20)],['YOUR SPACE',nav.slice(20)]
  ];
  function a(r){return `<a href="${r[0]}" data-zp-link="${r[0]}"><span class="zp-ico">${r[1]}</span><span class="zp-label">${r[2]}</span>${r[2]==='Cart'?'<span class="zp-badge" id="zpCartBadge">0</span>':''}</a>`}
  function brand(admin){return `<div class="zp-brand"><div class="zp-mark">✦</div><div><div class="zp-logo">LIFEIS<span>GAME</span><b>TZ</b></div><small>${admin?'ADMIN • CONTROL CENTER':'PLAY • LEARN • EARN'}</small></div></div>`}
  function makeShell(admin){
    const side=admin?`${brand(true)}<div class="zp-nav-title">COMMAND</div><nav class="zp-nav">${a(['admin.html','▣','Dashboard'])}${a(['index.html','⌂','View Website'])}</nav><div class="zp-nav-title">MANAGE</div><nav class="zp-nav">${[['Products','🎮'],['Orders','🧾'],['Customers','♙'],['Media & Live','▣'],['Hero Studio','✦'],['AI','✧'],['Security','🛡'],['Settings','⚙']].map(x=>`<a href="#" data-admin-jump="${x[0]}"><span class="zp-ico">${x[1]}</span><span class="zp-label">${x[0]}</span></a>`).join('')}</nav>`:brand(false)+groups.map(g=>`<div class="zp-nav-title">${g[0]}</div><nav class="zp-nav">${g[1].map(a).join('')}</nav>`).join('');
    const top=`<header class="zp-topbar"><a class="zp-home-btn" href="index.html">⌂</a><label class="zp-search"><span>⌕</span><input id="zpGlobalSearch" placeholder="Tafuta game, filamu, kozi, bidhaa..." autocomplete="off"></label><div class="zp-top-spacer"></div><div class="zp-top-actions"><a class="zp-icon-btn" href="chat.html">♧<i>3</i></a><a class="zp-icon-btn" href="cart.html">🛒<i id="zpCartDot">0</i></a><a class="zp-wallet" href="topup.html">▣ TSh 12,500&nbsp; →</a><a class="zp-profile" href="profile.html"><span class="zp-avatar">K</span><span><b>Kelvin Fred</b><small>Premium User</small></span><em>⌄</em></a></div></header>`;
    const mobile=`<nav class="zp-mobile"><a href="index.html"><span>⌂</span>Home</a><a href="shop.html"><span>🎮</span>Store</a><a href="cart.html"><span>🛒</span>Cart</a><a href="mygames.html"><span>▤</span>Library</a><a href="profile.html"><span>♙</span>Profile</a></nav>`;
    const el=document.createElement('div');el.className='zp-shell';el.innerHTML=`<aside class="zp-sidebar">${side}</aside><section class="zp-main"><div class="zp-top-wrap">${top}</div><main class="zp-content" id="zpContent"></main></section>${mobile}`;return el;
  }
  function run(){
    if(document.body.dataset.zp==='1') return;
    document.body.dataset.zp='1';
    const isAdmin=file()==='admin.html';
    const shell=makeShell(isAdmin); document.body.prepend(shell);
    const content=shell.querySelector('#zpContent');
    let target=document.querySelector('.main');
    if(isAdmin) target=document.querySelector('.admin-page')||target;
    if(target){
      content.appendChild(target);
      target.classList.add('zp-page-root');
    } else {
      // Pages such as product, wishlist and chat had different DOM roots. Move all visible content into the same shell.
      [...document.body.children].forEach(node=>{
        if(node===shell || node.tagName==='SCRIPT' || node.tagName==='STYLE' || node.tagName==='LINK') return;
        content.appendChild(node);
      });
    }
    // Hide legacy navigation/footer now sitting inside the content area; their links and functional controls remain available elsewhere.
    content.querySelectorAll(':scope > .sidebar,:scope > .navbar,:scope > header.navbar').forEach(x=>x.classList.add('zp-legacy-hidden'));
    content.querySelectorAll(':scope > .footer').forEach(x=>x.classList.add('zp-legacy-hidden'));
    document.querySelectorAll('.zp-nav a').forEach(x=>{
      const href=(x.getAttribute('href')||'').split('?')[0].toLowerCase();
      if(href===file()) x.classList.add('active');
    });
    const s=document.getElementById('zpGlobalSearch');
    if(s) s.addEventListener('keydown',e=>{if(e.key==='Enter'&&s.value.trim()) location.href='shop.html?search='+encodeURIComponent(s.value.trim())});
    document.querySelectorAll('[data-admin-jump]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();const n=x.dataset.adminJump.toLowerCase();const b=[...document.querySelectorAll('.tab-btn')].find(b=>(b.textContent||'').toLowerCase().includes(n));if(b)b.click();else document.querySelector('.admin-page')?.scrollIntoView({behavior:'smooth'})}));
    try{window.updateCartBadge&&window.updateCartBadge()}catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();

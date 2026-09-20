(function(){
  if(document.documentElement.dataset.zoneplay==='1') return;
  document.documentElement.dataset.zoneplay='1';
  const path=location.pathname.split('/').pop()||'index.html';
  const isAdmin=path==='admin.html';
  const nav=[
    ['index.html','⌂','Home'],['shop.html','🎮','Store'],['categories.html','▦','Games'],['shop.html?category=psp','🎮','PSP Gaming'],['shop.html?category=ps2','🎮','PS2 Gaming'],['shop.html?category=ps3','🎮','PS3 Gaming'],['shop.html?category=switch','🎮','Nintendo Switch'],['shop.html?category=android','▣','Android Gaming'],['shop.html?category=pc','▣','PC Gaming'],
    ['movies.html','▣','Movies'],['live.html','◉','Live TV / Sports'],['livescores.html','⚽','Live Scores'],['academy.html','◇','Academy / Courses'],['cloudgaming.html','☁','Cloud Gaming'],['efootball.html','⚽','eFootball & Top Up'],['giftcards.html','🎁','Gift Cards'],['chat.html','◌','Community / Chat'],['health.html','♡','Health Assistant'],['courses.html','🤖','AI Assistant'],['marketplace.html','▣','Marketplace'],
    ['wishlist.html','♡','Wishlist'],['cart.html','🛒','Cart'],['mygames.html','▤','My Games / Library'],['profile.html','♙','Profile']
  ];
  function active(h){return h.split('?')[0]===path}
  function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
  function shell(){
    const oldSide=document.querySelector('.sidebar'); if(oldSide) oldSide.style.display='none';
    const oldNav=document.querySelector('.navbar'); if(oldNav) oldNav.style.display='none';
    const oldTop=document.querySelector('body > .topbar'); if(oldTop) oldTop.style.display='none';
    let main=document.querySelector('main.main');
    if(!main){
      main=document.createElement('main'); main.className='main z-page';
      const nodes=[...document.body.children].filter(el=>!['SCRIPT','STYLE','LINK'].includes(el.tagName) && !el.classList.contains('sidebar') && !el.classList.contains('topbar') && !el.classList.contains('navbar'));
      nodes.forEach(n=>main.appendChild(n));
      document.body.appendChild(main);
    }
    main.classList.add('z-page');
    const navHtml=nav.map(([href,ico,label])=>`<a class="${active(href)?'active':''}" href="${href}"><span class="z-ico">${ico}</span><span class="z-label">${label}</span>${label==='Cart'?'<span class="z-badge" id="zCartCount">0</span>':''}</a>`).join('');
    const user=(()=>{try{return JSON.parse(localStorage.getItem('gamehubUser')||'null')}catch(e){return null}})();
    const name=esc(user?.name||'Guest User');
    const role=esc(user?(user.isAdmin||user.role==='admin'?'Admin':'Premium User'):'Guest');
    const navExtra=isAdmin?`<a class="active" href="admin.html"><span class="z-ico">⚙</span><span class="z-label">Admin Command Center</span></a>`:'';
    const wrap=document.createElement('div');wrap.className='z-shell'+(isAdmin?' z-admin':'');
    wrap.innerHTML=`<aside class="z-sidebar"><div class="z-brand"><div class="z-brand-mark">✦</div><div><b>LIFEIS<span>GAME</span>TZ</b><small>PLAY · LEARN · EARN</small></div></div><nav class="z-nav"><div class="z-nav-group">Gaming</div>${navHtml}<div class="z-nav-group">Support</div>${navExtra}<a href="requests.html"><span class="z-ico">⌕</span><span class="z-label">Requests</span></a><a href="contact.html"><span class="z-ico">☎</span><span class="z-label">Contact</span></a></nav><div class="z-side-bottom"><div class="z-mini-user"><div class="z-avatar">👤</div><span>${name}<small style="display:block;color:#6f809e;font-size:8px">${role}</small></span></div></div></aside><div class="z-main"><header class="z-topbar"><div class="z-search"><input id="zGlobalSearch" placeholder="Tafuta game, filamu, kozi, bidhaa..." autocomplete="off"></div><div class="z-top-actions"><a class="z-top-btn" href="chat.html" title="Notifications">♧</a><a class="z-top-btn z-top-wallet" href="topup.html">▣ <b>TSh 0</b> →</a><a class="z-top-btn" href="cart.html">🛒</a><a class="z-user" href="profile.html"><div class="z-avatar">👤</div><div><div class="z-user-name">${name}</div><div class="z-user-role">${role}</div></div></a></div></header></div><div class="z-mobile-bottom"><a class="${path==='index.html'?'active':''}" href="index.html"><b>⌂</b>Home</a><a class="${['shop.html','categories.html'].includes(path)?'active':''}" href="shop.html"><b>🎮</b>Store</a><a class="${path==='cart.html'?'active':''}" href="cart.html"><b>🛒</b>Cart</a><a class="${path==='mygames.html'?'active':''}" href="mygames.html"><b>▤</b>Library</a><a class="${path==='profile.html'?'active':''}" href="profile.html"><b>♙</b>Profile</a></div>`;
    document.body.appendChild(wrap); wrap.querySelector('.z-main').appendChild(main);
    // Move leftover page-level content (for example footer) inside the new page area without touching scripts.
    [...document.body.children].forEach(el=>{
      if(el===wrap || ['SCRIPT','STYLE','LINK'].includes(el.tagName)) return;
      if(el.classList.contains('sidebar') || el.classList.contains('navbar') || el.classList.contains('topbar')) return;
      if(el.parentElement===document.body) main.appendChild(el);
    });
    const inp=document.getElementById('zGlobalSearch');inp?.addEventListener('keydown',e=>{if(e.key==='Enter'&&inp.value.trim())location.href='shop.html?search='+encodeURIComponent(inp.value.trim())});
    setTimeout(()=>{try{const cart=JSON.parse(localStorage.getItem('gamehubCart')||'[]');const n=Array.isArray(cart)?cart.reduce((a,x)=>a+Number(x.qty||x.quantity||1),0):Object.values(cart||{}).reduce((a,x)=>a+Number(x.qty||1),0);document.querySelectorAll('#zCartCount').forEach(x=>x.textContent=n)}catch(e){}},50);
  }
  // index has its own shell; every other page is wrapped here.
  if(path!=='index.html') shell();
})();

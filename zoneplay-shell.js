(function(){
  const NAV = [
    ['Home','index.html','⌂'],['Store','shop.html','🎮'],['Games','categories.html','▣'],
    ['PSP Gaming','shop.html?cat=psp','🎮'],['PS2 Gaming','shop.html?cat=ps2','🎮'],['PS3 Gaming','shop.html?cat=ps3','🎮'],
    ['Nintendo Switch','shop.html?cat=switch','🎮'],['Android Gaming','shop.html?cat=android','▣'],['PC Gaming','shop.html?cat=pc','▣'],
    ['Movies','movies.html','▣'],['Live TV / Sports','live.html','◉'],['Live Scores','livescores.html','⚽'],
    ['Academy / Courses','academy.html','🎓'],['Cloud Gaming','cloudgaming.html','☁'],['eFootball & Top Up','efootball.html','⚽'],
    ['Gift Cards','giftcards.html','🎁'],['Community / Chat','chat.html','💬'],['Health Assistant','health.html','♥'],
    ['AI Assistant','index.html#ai','🤖'],['Marketplace','marketplace.html','▤'],['Wishlist','wishlist.html','♡'],
    ['Cart','cart.html','🛒'],['My Games / Library','mygames.html','▤'],['Profile','profile.html','◉']
  ];
  const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  function linkHref(h){return h.split('?')[0].split('#')[0];}
  function active(h){return linkHref(h)===path ? ' active':'';}
  function shell(){
    if(document.getElementById('zp-shell')) return;
    const oldSidebar=document.querySelector('body > .sidebar');
    if(oldSidebar) oldSidebar.remove();
    document.querySelectorAll('body > .navbar, body > .topbar').forEach(e=>e.remove());

    const contentHost=document.querySelector('body > .main') || document.querySelector('body > .admin-page') || null;
    const shell=document.createElement('div'); shell.id='zp-shell'; shell.className='zp-shell';
    const side=document.createElement('aside'); side.className='zp-sidebar';
    side.innerHTML=`<a class="zp-brand" href="index.html"><span class="zp-brand-mark">◈</span><span><b>LIFEIS<span>GAME</span>TZ</b><small>PLAY • LEARN • EARN</small></span></a><nav class="zp-nav">${NAV.map(([n,h,i])=>`<a href="${h}" class="zp-nav-item${active(h)}"><i>${i}</i><span>${n}</span>${n==='Cart'?'<em id="zpCartBadge">0</em>':''}</a>`).join('')}</nav><div class="zp-side-foot"><a href="admin.html">⚙ Admin</a><a href="contact.html">◉ Support</a></div>`;
    const main=document.createElement('div'); main.className='zp-main';
    const header=document.createElement('header'); header.className='zp-header';
    header.innerHTML=`<button class="zp-mobile-menu" id="zpMobileMenu">☰</button><a class="zp-mobile-brand" href="index.html">LIFEIS<span>GAME</span>TZ</a><div class="zp-search"><span>⌕</span><input id="zpGlobalSearch" placeholder="Tafuta game, filamu, kozi, bidhaa..." autocomplete="off"></div><div class="zp-head-actions"><button>♧<b>3</b></button><a href="cart.html">🛒<b id="zpCartBadgeTop">0</b></a><button class="zp-wallet">▣ <strong>TSh 12,500</strong> →</button><a class="zp-profile" href="profile.html"><span>👤</span><span><strong>Kelvin Fred</strong><small>Premium User</small></span>⌄</a></div></header>`;
    main.appendChild(header);
    const area=document.createElement('main'); area.className='zp-content';
    if(contentHost){
      // Remove old page-specific topbars but keep the original content/IDs/scripts intact.
      contentHost.querySelectorAll(':scope > .topbar').forEach(e=>e.remove());
      area.appendChild(contentHost);
    } else {
      const nodes=[...document.body.children].filter(e=>e.tagName!=='SCRIPT' && e.id!=='zp-shell');
      nodes.forEach(e=>area.appendChild(e));
    }
    main.appendChild(area); shell.appendChild(side); shell.appendChild(main);
    document.body.prepend(shell);
    document.body.classList.add('zp-body');

    const menu=document.getElementById('zpMobileMenu'); menu&&menu.addEventListener('click',()=>shell.classList.toggle('open'));
    const search=document.getElementById('zpGlobalSearch');
    search&&search.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=search.value.trim(); if(q) location.href='shop.html?search='+encodeURIComponent(q);}});
    try{
      const cart=JSON.parse(localStorage.getItem('cart')||localStorage.getItem('gamehub_cart')||'[]');
      const n=Array.isArray(cart)?cart.reduce((s,x)=>s+(Number(x.qty)||1),0):0;
      document.querySelectorAll('#zpCartBadge,#zpCartBadgeTop').forEach(x=>x.textContent=n||'0');
    }catch(e){}
    // Mobile bottom navigation.
    const bottom=document.createElement('nav'); bottom.className='zp-bottom-nav';
    [['Home','index.html','⌂'],['Store','shop.html','🎮'],['Cart','cart.html','🛒'],['Library','mygames.html','▤'],['Profile','profile.html','◉']].forEach(([n,h,i])=>{const a=document.createElement('a');a.href=h;a.className=active(h).trim();a.innerHTML=`<i>${i}</i><span>${n}</span>`;bottom.appendChild(a);});
    document.body.appendChild(bottom);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',shell); else shell();
})();

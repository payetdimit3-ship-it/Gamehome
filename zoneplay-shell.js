/* LIFEISGAMETZ — ZonePlay shell: sidebar + topbar + bottom navigation for every page. */
(function(){
  var ZP = window.ZP = window.ZP || {};

  /* ---------- Icons (24px line icons) ---------- */
  var P = {
    home:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    bag:'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
    gamepad:'M6 12h4 M8 10v4 M15 13h.01 M18 11h.01 M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4a2 2 0 0 1 1.4-.6h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3A4 4 0 0 0 17.32 5z',
    phone:'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M12 18h.01',
    monitor:'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8 21h8 M12 17v4',
    film:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M7 3v18 M17 3v18 M3 8h4 M3 12h18 M3 16h4 M17 8h4 M17 16h4',
    tv:'M3 7h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M17 2l-5 5-5-5',
    trophy:'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22 M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8 M18 2H6v7a6 6 0 0 0 12 0z',
    cap:'M22 10 12 5 2 10l10 5z M6 12v5c3 3 9 3 12 0v-5',
    cloud:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z',
    ball:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 7l4 3-1.5 5h-5L8 10z M12 2v5 M16 10l5-1.5 M14.5 15l3 4 M9.5 15l-3 4 M8 10 3 8.5',
    gift:'M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
    chat:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    heart:'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
    pulse:'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z M3.2 12h4l1.5-3 3 6 1.5-3h4',
    bot:'M12 8V4H8 M4 8h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z M2 14h2 M20 14h2 M15 13v2 M9 13v2',
    shop:'M3 9l1.5-5h15L21 9 M3 9v11h18V9 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M9 20v-6h6v6',
    cart:'M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 7H5.1',
    book:'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
    user:'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
    menu:'M4 6h16 M4 12h16 M4 18h16',
    wallet:'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2 M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
    bolt:'M13 2 3 14h9l-1 8 10-12h-9z',
    shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    headset:'M3 14v-2a9 9 0 0 1 18 0v2 M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z M3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z M21 17v1a3 3 0 0 1-3 3h-4',
    download:'M12 3v12 M7 10l5 5 5-5 M4 21h16',
    settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
    box:'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
    life:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.9 4.9l4.3 4.3 M14.8 14.8l4.3 4.3 M14.8 9.2l4.3-4.3 M9.2 14.8l-4.3 4.3',
    users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
    briefcase:'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M8 7V4h8v3 M3 13h18',
    mail:'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M22 6l-10 7L2 6',
    file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
    help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01',
    wifi:'M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01',
    check:'M20 6 9 17l-5-5',
    alert:'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
    chevr:'M9 6l6 6-6 6', chevl:'M15 6l-6 6 6 6', arrow:'M5 12h14 M13 6l6 6-6 6', play:'M7 4l13 8-13 8z',
    x:'M18 6 6 18 M6 6l12 12', star:'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'
  };
  ZP.icon = function(n, cls){
    var d = P[n] || P.grid;
    return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+d.split(' M').map(function(s,i){return '<path d="'+(i?'M':'')+s+'"/>';}).join('')+'</svg>';
  };
  ZP.esc = function(x){ var d=document.createElement('div'); d.textContent = x==null?'':String(x); return d.innerHTML; };

  /* ---------- Navigation ---------- */
  var NAV = [
    ['Home','index.html','home'], ['Store','shop.html','bag'], ['Games','categories.html','grid'],
    ['PSP Gaming','shop.html?cat=psp','gamepad'], ['PS2 Gaming','shop.html?cat=ps2','gamepad'], ['PS3 Gaming','shop.html?cat=ps3','gamepad'],
    ['Nintendo Switch','shop.html?cat=switch','gamepad'], ['Android Gaming','shop.html?cat=android','phone'], ['PC Gaming','shop.html?cat=pc','monitor'],
    ['Movies','movies.html','film'], ['Live TV / Sports','live.html','tv'], ['Live Scores','livescores.html','trophy'],
    ['Academy / Courses','academy.html','cap'], ['Cloud Gaming','cloudgaming.html','cloud'], ['eFootball / Top Up','efootball.html','ball'],
    ['Gift Cards','giftcards.html','gift'], ['Community / Chat','chat.html','chat'], ['Health Assistant','health.html','pulse'],
    ['AI Assistant','ai.html','bot'], ['Marketplace','marketplace.html','shop'], ['Wishlist','wishlist.html','heart'],
    ['Cart','cart.html','cart'], ['My Games / Library','mygames.html','book'], ['Profile','profile.html','user']
  ];
  var MORE = [
    ['Steam Accounts','steamaccounts.html','user'], ['eFootball Coins','topup.html','ball'], ['Tournaments','tournaments.html','trophy'],
    ['Cloud Rental','rental.html','cloud'], ['Youth Opportunities','opportunities.html','briefcase'], ['Community Help','community.html','users'],
    ['Community Fund','community-fund.html','heart'], ['Recovery Support','recovery.html','life'], ['Health Network','professionals.html','pulse'],
    ['My Orders','myorders.html','box'], ['Game Requests','requests.html','file'], ['Recommendations','recommendations.html','star'],
    ['Contact','contact.html','mail'], ['FAQ','faq.html','help'], ['Terms & Refund','terms.html','file']
  ];
  /* Pages that belong to a sidebar item without being one */
  var ALIAS = {'product.html':'shop.html','checkout.html':'cart.html','success.html':'mygames.html','myorders.html':'mygames.html',
    'courses.html':'academy.html','topup.html':'efootball.html','rental.html':'cloudgaming.html','community.html':'chat.html','tournaments.html':'efootball.html',
    'steamaccounts.html':'shop.html','recommendations.html':'shop.html'};
  var here = (location.pathname.split('/').pop()||'index.html').toLowerCase();
  var qs = new URLSearchParams(location.search);
  function isActive(href, strict){
    var parts = href.split('#')[0].split('?'), file = parts[0], q = new URLSearchParams(parts[1]||'');
    if (href.indexOf('#')>-1) return false;
    var cur = strict ? here : (ALIAS[here] || here);
    if (file !== cur) return false;
    if (q.has('cat')) return qs.get('cat') === q.get('cat');
    if (file === 'shop.html') return !qs.get('cat');
    return true;
  }
  function item(n,h,i,badge){
    return '<a class="zp-nav-item'+(isActive(h,false)?' active':'')+'" href="'+h+'">'+ZP.icon(i)+'<span>'+n+'</span>'+(badge?'<em data-zpcart data-n="0">0</em>':'')+'</a>';
  }

  function getUser(){ try{ return JSON.parse(localStorage.getItem('gamehubUser')||'null'); }catch(e){ return null; } }
  function cartCount(){
    try{
      var raw = JSON.parse(localStorage.getItem('gamehubCart')||'{}');
      var list = Array.isArray(raw) ? raw : Object.values(raw||{});
      return list.reduce(function(s,x){ return s + (Number(x.qty||x.quantity)||1); },0);
    }catch(e){ return 0; }
  }
  ZP.updateCart = function(){
    var n = cartCount();
    document.querySelectorAll('[data-zpcart]').forEach(function(el){ el.textContent = n; el.dataset.n = n; });
  };

  function logoSvg(){
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="zpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19d8ff"/><stop offset="1" stop-color="#7c3aff"/></linearGradient></defs>'+
      '<path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" fill="#0a1236" stroke="url(#zpg)" stroke-width="2.4"/>'+
      '<path d="M24 12 34 18v12l-10 6-10-6V18z" fill="none" stroke="url(#zpg)" stroke-width="2"/>'+
      '<path d="M24 12v24 M14 18l20 12 M34 18 14 30" stroke="url(#zpg)" stroke-width="1.3" opacity=".7"/></svg>';
  }

  function build(){
    if (document.getElementById('zp-shell')) return;

    /* fonts */
    if (!document.getElementById('zpFonts')){
      var l = document.createElement('link'); l.id='zpFonts'; l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Rajdhani:wght@500;600;700&display=swap';
      document.head.appendChild(l);
    }
    var tc = document.querySelector('meta[name=theme-color]');
    if (!tc){ tc=document.createElement('meta'); tc.name='theme-color'; document.head.appendChild(tc); }
    tc.content = '#040816';

    /* remove the old per-page chrome */
    document.querySelectorAll('body > .sidebar, body > .navbar, body > .topbar, body > header.navbar').forEach(function(e){ e.remove(); });
    var host = document.querySelector('body > .main') || document.querySelector('body > .admin-page');

    var user = getUser();
    var isAdmin = !!(user && (user.isAdmin || user.role==='admin'));
    var name = user ? (user.name || (user.email||'').split('@')[0] || 'Mteja') : '';

    var shell = document.createElement('div'); shell.id='zp-shell'; shell.className='zp-shell';
    var side = document.createElement('aside'); side.className='zp-sidebar'; side.setAttribute('aria-label','Menu kuu');
    side.innerHTML =
      '<a class="zp-brand" href="index.html">'+logoSvg()+'<span><b>LIFEIS<span>GAME</span>TZ</b><small>PLAY • LEARN • EARN</small></span></a>'+
      '<nav class="zp-nav">'+NAV.map(function(x){ return item(x[0],x[1],x[2], x[0]==='Cart'); }).join('')+
      '<details class="zp-more"'+(MORE.some(function(m){return isActive(m[1],true);})?' open':'')+'><summary>ZAIDI</summary>'+MORE.map(function(x){ return item(x[0],x[1],x[2]); }).join('')+'</details></nav>'+
      '<div class="zp-side-foot">'+(isAdmin?'<a href="admin.html">'+ZP.icon('settings')+'Admin Dashboard</a>':'')+'<a href="contact.html">'+ZP.icon('headset')+'Msaada</a></div>';

    var main = document.createElement('div'); main.className='zp-main';
    var header = document.createElement('header'); header.className='zp-header';
    header.innerHTML =
      '<button class="zp-ibtn zp-mobile-menu" id="zpMenuBtn" aria-label="Fungua menu">'+ZP.icon('menu')+'</button>'+
      '<a class="zp-mobile-brand" href="index.html">LIFEIS<span>GAME</span>TZ</a>'+
      '<label class="zp-search">'+ZP.icon('search')+'<input id="zpGlobalSearch" type="search" placeholder="Tafuta game, gift card, top-up..." autocomplete="off" aria-label="Tafuta"></label>'+
      '<div class="zp-head-actions">'+
        '<button class="zp-ibtn zp-mobile-search" id="zpSearchBtn" aria-label="Tafuta" style="display:none">'+ZP.icon('search')+'</button>'+
        '<button class="zp-ibtn hide-m" id="zpAiBtn" title="Uliza AI">'+ZP.icon('bot')+'<span>AI</span></button>'+
        '<a class="zp-ibtn" href="cart.html" aria-label="Kikapu">'+ZP.icon('cart')+'<b data-zpcart data-n="0">0</b></a>'+
        (user && user.wallet!=null ? '<a class="zp-ibtn zp-wallet hide-m" href="profile.html">'+ZP.icon('wallet')+'<strong>TSh '+Number(user.wallet).toLocaleString()+'</strong></a>' : '')+
        (user
          ? '<div class="zp-acct" id="zpAcct"><button class="zp-ibtn zp-acct-btn" id="zpAcctBtn" aria-haspopup="true"><span class="zp-avatar">'+ZP.esc(name.charAt(0).toUpperCase())+'</span><span class="who"><strong>'+ZP.esc(name)+'</strong><small>'+(isAdmin?'Admin':'Mteja')+'</small></span></button>'+
            '<div class="zp-menu" role="menu"><a href="profile.html">'+ZP.icon('user')+'Profile</a><a href="myorders.html">'+ZP.icon('box')+'My Orders</a><a href="mygames.html">'+ZP.icon('book')+'My Games</a><a href="wishlist.html">'+ZP.icon('heart')+'Wishlist</a>'+
            (isAdmin?'<a href="admin.html">'+ZP.icon('settings')+'Admin Dashboard</a>':'')+'<button id="zpLogout">'+ZP.icon('logout')+'Toka</button></div></div>'
          : '<a class="zp-btn sm" href="login.html" aria-label="Ingia">'+ZP.icon('user')+'<span class="lbl">Ingia</span></a>')+
      '</div>';
    main.appendChild(header);

    var area = document.createElement('main'); area.className='zp-content'; area.id='zpContent';
    if (host){ host.querySelectorAll(':scope > .topbar').forEach(function(e){ e.remove(); }); area.appendChild(host); }
    else {
      Array.prototype.slice.call(document.body.children).forEach(function(e){
        if (e.tagName!=='SCRIPT' && e.id!=='zp-shell' && e.id!=='ghChatBtn' && e.id!=='ghChatBox' && e.tagName!=='STYLE' && e.tagName!=='LINK') area.appendChild(e);
      });
    }
    main.appendChild(area);
    var scrim = document.createElement('div'); scrim.className='zp-scrim';
    shell.appendChild(side); shell.appendChild(scrim); shell.appendChild(main);
    document.body.prepend(shell);
    document.body.classList.add('zp-body');

    /* bottom nav (phones) */
    var bottom = document.createElement('nav'); bottom.className='zp-bottom-nav'; bottom.setAttribute('aria-label','Menu ya chini');
    [['Home','index.html','home'],['Store','shop.html','bag'],['Cart','cart.html','cart'],['Library','mygames.html','book'],['Profile','profile.html','user']].forEach(function(x){
      var a=document.createElement('a'); a.href=x[1]; if(isActive(x[1],false) && (x[1]!=='shop.html'||true)) a.className='active';
      a.innerHTML = ZP.icon(x[2])+'<span>'+x[0]+'</span>'+(x[0]==='Cart'?'<b data-zpcart data-n="0">0</b>':'');
      bottom.appendChild(a);
    });
    document.body.appendChild(bottom);

    /* interactions */
    function closeMenu(){ shell.classList.remove('open'); }
    document.getElementById('zpMenuBtn').addEventListener('click', function(){ shell.classList.toggle('open'); });
    scrim.addEventListener('click', closeMenu);
    side.addEventListener('click', function(e){ if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeMenu(); var a=document.getElementById('zpAcct'); a&&a.classList.remove('open'); header.classList.remove('search-open'); } });

    var search = document.getElementById('zpGlobalSearch');
    search.addEventListener('keydown', function(e){ if(e.key==='Enter'){ var q=search.value.trim(); if(q) location.href='shop.html?search='+encodeURIComponent(q); } });
    if (window.matchMedia('(max-width:820px)').matches){
      var sb=document.getElementById('zpSearchBtn'); sb.style.display='inline-flex';
      sb.addEventListener('click', function(){ header.classList.toggle('search-open'); if(header.classList.contains('search-open')) search.focus(); });
    }
    var ai = document.getElementById('zpAiBtn');
    ai && ai.addEventListener('click', function(){ var f=document.getElementById('aiInput'); if(f){ f.focus(); return; } var b=document.getElementById('ghChatBtn'); if(b) b.click(); });

    var acct = document.getElementById('zpAcctBtn');
    if (acct){
      acct.addEventListener('click', function(e){ e.stopPropagation(); document.getElementById('zpAcct').classList.toggle('open'); });
      document.addEventListener('click', function(){ document.getElementById('zpAcct').classList.remove('open'); });
      document.getElementById('zpLogout').addEventListener('click', function(){
        var t = localStorage.getItem('gamehubToken');
        try{ fetch('/api/auth/logout',{method:'POST',headers:{'Authorization':t||''}}); }catch(e){}
        localStorage.removeItem('gamehubToken'); localStorage.removeItem('gamehubUser');
        location.href='login.html';
      });
    }

    ZP.updateCart();
    window.addEventListener('storage', ZP.updateCart);
    /* keep in sync when app.js saves the cart */
    if (typeof window.updateCartBadge === 'function'){
      var orig = window.updateCartBadge;
      window.updateCartBadge = function(){ var r = orig.apply(this, arguments); ZP.updateCart(); return r; };
    }
    var active = side.querySelector('.zp-nav-item.active');
    if (active && active.scrollIntoView) active.scrollIntoView({block:'nearest'});
    document.dispatchEvent(new CustomEvent('zp:ready'));
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

/* LIFEISGAMETZ — shared catalogue helpers (products, platforms, poster cards, wishlist). */
(function(){
  var ZP = window.ZP = window.ZP || {};
  var esc = function(x){ var d=document.createElement('div'); d.textContent = x==null?'':String(x); return d.innerHTML; };
  ZP.esc = ZP.esc || esc;

  /* Gradient palette for posters without an uploaded image */
  var PAL = [['#5a1fe6','#1a3fd0'],['#e5484d','#6b1fa2'],['#0ea5a4','#1b3fa8'],['#f59e0b','#c2255c'],['#7c3aff','#19a8d8'],['#16a34a','#0b5a8a'],['#d946ef','#3b1d8f'],['#2563eb','#0b1a4a']];
  ZP.art = function(seed){
    var h=0, s=String(seed||''); for (var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    var p=PAL[h%PAL.length]; return 'linear-gradient(150deg,'+p[0]+','+p[1]+')';
  };

  ZP.PLATFORMS = [
    {key:'psp',   label:'PSP',             title:'PSP Gaming',       sub:'Games za PSP / PPSSPP',              icon:'gamepad', emoji:'🎮', art:'linear-gradient(140deg,#2b2fd8,#0f1a6e)', re:/\bpsp\b|ppsspp/},
    {key:'ps2',   label:'PS2',             title:'PS2 Gaming',       sub:'Classics za PlayStation 2',          icon:'gamepad', emoji:'🕹️', art:'linear-gradient(140deg,#6d28d9,#1e1b4b)', re:/\bps2\b|playstation ?2/},
    {key:'ps3',   label:'PS3',             title:'PS3 Gaming',       sub:'Titles za PlayStation 3',            icon:'gamepad', emoji:'🎮', art:'linear-gradient(140deg,#0e7490,#1e1b4b)', re:/\bps3\b|playstation ?3/},
    {key:'switch',label:'Nintendo Switch', title:'Nintendo Switch',  sub:'Games za Switch',                    icon:'gamepad', emoji:'🔴', art:'linear-gradient(140deg,#dc2626,#7f1d1d)', re:/switch|nintendo/},
    {key:'android',label:'Android',        title:'Android Gaming',   sub:'Games na top-up za simu',            icon:'phone',   emoji:'📱', art:'linear-gradient(140deg,#16a34a,#14532d)', re:/android|mobile|simu/},
    {key:'pc',    label:'PC',              title:'PC Gaming',        sub:'Game keys na Steam accounts',        icon:'monitor', emoji:'💻', art:'linear-gradient(140deg,#0284c7,#1e3a8a)', re:/\bpc\b|steam|windows/}
  ];
  ZP.KINDS = [
    {key:'all',label:'Zote'},{key:'key',label:'Game Keys'},{key:'topup',label:'Top-Up'},{key:'gift',label:'Gift Cards'},{key:'account',label:'Steam Accounts'}
  ];
  var KIND_TAG = {topup:'TOP-UP', gift:'GIFT CARD', account:'ACCOUNT', squad:'KIKOSI'};

  /* Seeded products (used when the API is empty or unreachable) */
  var D = function(id,name,type,price,emoji,kind){ return {id:id,name:name,type:type,price:price,emoji:emoji,kind:kind,platform:(kind==='key'||kind==='account')?'pc':''}; };
  ZP.DEFAULTS = [
    D('fifa25','FIFA 25','Game Key • PC',45000,'⚽','key'),
    D('gta5','GTA V','Game Key • PC',35000,'🚗','key'),
    D('minecraft','Minecraft','Game Key • PC',30000,'🧱','key'),
    D('codmw3','Call of Duty: MW3','Game Key • PC',55000,'💥','key'),
    D('codpoints','COD Points 1100','Top-Up • Call of Duty',40000,'🪙','topup'),
    D('gtamoney','GTA V — GTA$ 8M','Top-Up • GTA Online',25000,'💰','topup'),
    D('futpoints','FIFA Ultimate Team 12K','Top-Up • FUT Points',50000,'⚡','topup'),
    D('steam10','Steam Gift Card $10','Gift Card • Steam',30000,'🎁','gift'),
    D('steam20','Steam Gift Card $20','Gift Card • Steam',58000,'🎁','gift'),
    D('psn10','PlayStation Card $10','Gift Card • PSN',32000,'🎁','gift'),
    D('accountfifa','Steam Account (FIFA 25)','Account • Full Access',60000,'👤','account'),
    D('accountgta','Steam Account (GTA V)','Account • Full Access',50000,'👤','account')
  ];

  function detectKind(p){
    var t=[p.category,p.type,p.name].join(' ').toLowerCase();
    if (/gift/.test(t)) return 'gift';
    if (/top-?up|coins|points|gta\$|currency|fut /.test(t)) return 'topup';
    if (/account|akaunti/.test(t)) return 'account';
    return 'key';
  }
  function detectPlatform(p){
    if (p.platform){ var k=String(p.platform).toLowerCase(); if (ZP.PLATFORMS.some(function(x){return x.key===k;})) return k; }
    var t=[p.category,p.type,p.name,p.platform].join(' ').toLowerCase();
    for (var i=0;i<ZP.PLATFORMS.length;i++) if (ZP.PLATFORMS[i].re.test(t)) return ZP.PLATFORMS[i].key;
    return '';
  }
  function norm(p){
    return {id:p.id, name:p.name||'Bidhaa', type:p.type||'Bidhaa', price:Number(p.price)||0, emoji:p.emoji||'🎮', imageUrl:p.imageUrl||'',
      trailerUrl:p.trailerUrl||'', desc:p.desc||'', kind:detectKind(p), platform:detectPlatform(p), admin:true};
  }

  /* Products of one admin section (e.g. 'efootball' squads). Resolves to null when the request fails. */
  ZP.loadSection = function(section){
    return fetch('/api/products').then(function(r){ return r.json(); }).then(function(d){
      var list=(d&&d.success&&Array.isArray(d.products)?d.products:[]).filter(function(p){ return section==='*' || p.section===section; }).map(function(p){
        var n=norm(p); if(section==='efootball'){ n.kind='squad'; n.platform=''; if(!p.emoji) n.emoji='⚽'; } return n;
      });
      ZP._extra=(ZP._extra||[]).concat(list);
      return list;
    }).catch(function(){ return null; });
  };

  /* Load products: admin products first, seeded ones after (no duplicates). Never throws. */
  var pending;
  ZP.loadProducts = function(){
    if (pending) return pending;
    pending = new Promise(function(resolve){
      var done=false, finish=function(list){ if(done) return; done=true; ZP.products=list; resolve(list); };
      var t=setTimeout(function(){ finish(ZP.DEFAULTS.slice()); }, 4500);
      fetch('/api/products').then(function(r){ return r.json(); }).then(function(d){
        clearTimeout(t);
        var api=(d&&d.success&&Array.isArray(d.products)?d.products:[]).filter(function(p){ return !p.section || p.section==='shop'; }).map(norm);
        var ids={}; api.forEach(function(p){ ids[p.id]=1; });
        finish(api.concat(ZP.DEFAULTS.filter(function(p){ return !ids[p.id]; })));
      }).catch(function(){ clearTimeout(t); finish(ZP.DEFAULTS.slice()); });
    });
    return pending;
  };


  /* ---------- Match helpers (Live TV + Live Scores) ---------- */
  ZP.match = {
    status: function(m){
      var s=String(m.status||'').toUpperCase();
      if (/LIVE|PLAY|INAENDELEA/.test(s)) return 'live';
      if (/END|FT|FINISH|IMEISHA|KWISHA/.test(s)) return 'ended';
      return 'upcoming';
    },
    teams: function(m){
      var h=(m.homeTeam||'').trim(), a=(m.awayTeam||'').trim();
      if (!h && !a){
        var p=String(m.title||'').split(/\s+(?:vs\.?|v|-|–)\s+/i);
        if (p.length===2){ h=p[0].trim(); a=p[1].trim(); } else h=String(m.title||'Mechi');
      }
      return [h,a];
    },
    initials: function(n){ var w=String(n||'?').trim().split(/\s+/); return ((w[0]||'?').charAt(0)+(w.length>1?w[1].charAt(0):'')).toUpperCase(); },
    badge: function(n){ return n ? '<i class="ls-badge" style="--art:'+ZP.art(n)+'">'+esc(ZP.match.initials(n))+'</i>' : ''; },
    hasScore: function(m){ return m.homeScore!=null && m.homeScore!=='' && m.awayScore!=null && m.awayScore!==''; }
  };

  /* Rental packages (same values as rental.html) */
  ZP.RENTAL = [
    {min:20,  price:300,  label:'Dakika 20'},
    {min:50,  price:500,  label:'Dakika 50'},
    {min:120, price:1000, label:'Masaa 2', popular:true}
  ];

  /* Custom rental price: the cheaper per minute the longer the time (same rule as before, rounded to 100 TZS) */
  ZP.rentalPrice = function(minutes){
    minutes = parseInt(minutes, 10);
    if (!minutes || minutes < 1) return 0;
    var rate = minutes <= 20 ? 15 : minutes <= 50 ? 10 : 8;
    return Math.round(minutes * rate / 100) * 100;
  };
  ZP.rentalLabel = function(minutes){
    if (minutes < 60) return 'Dakika ' + minutes;
    var h = Math.floor(minutes / 60), m = minutes % 60;
    return m ? h + ' Masaa ' + m + ' Dakika' : 'Masaa ' + h;
  };

  /* Site contact details (single place to change them) */
  ZP.CONTACT = { phone:'0786 095 758', wa:'255786095758', email:'lifeisgametz@gmail.com' };
  ZP.waLink = function(text){ return 'https://wa.me/'+ZP.CONTACT.wa+(text?'?text='+encodeURIComponent(text):''); };


  /* ---------- Device-only preferences (Settings page) ---------- */
  ZP.pref = function(key, fallback){
    try{ var v=localStorage.getItem('zp_'+key); return v==null ? fallback : JSON.parse(v); }catch(e){ return fallback; }
  };
  ZP.setPref = function(key, val){ try{ localStorage.setItem('zp_'+key, JSON.stringify(val)); }catch(e){} };
  ZP.aiLang = function(){ return ZP.pref('aiLang','sw'); };
  ZP.dataSaver = function(){ return !!ZP.pref('dataSaver', false); };
  ZP.soundOn = function(){ return ZP.pref('soundOn', true) !== false; };
  /* Prefix a message to the AI with a language instruction when the device prefers English. Swahili is the default, so nothing changes for it. */
  ZP.aiMessage = function(text){ return ZP.aiLang()==='en' ? 'Please reply in English. '+text : text; };
  /* Short two-tone notification beep (Web Audio, no file, works offline). Silently does nothing if sound is off or unsupported. */
  ZP.beep = function(){
    if (!ZP.soundOn()) return;
    try{
      var Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
      var ctx=new Ctx(), t=ctx.currentTime;
      [[880,t],[660,t+0.09]].forEach(function(f){
        var o=ctx.createOscillator(), g=ctx.createGain();
        o.type='sine'; o.frequency.value=f[0]; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001,f[1]); g.gain.exponentialRampToValueAtTime(0.12,f[1]+0.01); g.gain.exponentialRampToValueAtTime(0.0001,f[1]+0.14);
        o.start(f[1]); o.stop(f[1]+0.16);
      });
      setTimeout(function(){ ctx.close(); },400);
    }catch(e){}
  };

  ZP.money = function(n){ return Number(n||0).toLocaleString('en-US'); };
  ZP.href = function(p){ return 'product.html?id='+encodeURIComponent(p.id)+(p.admin?'&admin=1':''); };
  ZP.platformOf = function(key){ return ZP.PLATFORMS.filter(function(x){return x.key===key;})[0]; };

  function wish(){ try{ return JSON.parse(localStorage.getItem('gamehubWishlist')||'{}')||{}; }catch(e){ return {}; } }
  ZP.card = function(p){
    var plat = ZP.platformOf(p.platform);
    var tag = KIND_TAG[p.kind] || (plat ? plat.label.toUpperCase() : 'GAME');
    var w = wish()[p.id];
    var img = p.imageUrl ? '<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy" onerror="this.remove()">' : '';
    var href = ZP.href(p);
    return '<article class="zp-poster">'+
      '<a class="zp-art" href="'+href+'" style="--art:'+ZP.art(p.name)+'" aria-label="'+esc(p.name)+'">'+img+(p.imageUrl?'':'<span class="zp-emoji">'+esc(p.emoji)+'</span>')+'<span class="zp-tag">'+esc(tag)+'</span></a>'+
      '<button class="zp-fav'+(w?' on':'')+'" data-fav="'+esc(p.id)+'" aria-pressed="'+(w?'true':'false')+'" aria-label="Wishlist">'+ZP.icon('heart')+'</button>'+
      '<div class="zp-info"><h3>'+esc(p.name)+'</h3><small>'+esc(p.type)+'</small>'+
      '<div class="zp-buyrow"><span class="zp-price">'+ZP.money(p.price)+'<small>TZS</small></span><a class="zp-btn" href="'+href+'">Nunua</a></div></div></article>';
  };

  /* Wishlist hearts (same storage as product.html / wishlist.html) */
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.zp-fav'); if(!b) return;
    var id=b.dataset.fav, list=(ZP.products||[]).concat(ZP._extra||[]), p=list.filter(function(x){return String(x.id)===String(id);})[0]; if(!p) return;
    var w=wish();
    if (w[id]) delete w[id]; else w[id]={id:p.id,name:p.name,emoji:p.emoji,imageUrl:p.imageUrl||'',price:p.price,admin:!!p.admin};
    try{ localStorage.setItem('gamehubWishlist', JSON.stringify(w)); }catch(err){}
    var on=!!w[id]; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
})();

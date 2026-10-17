/* LIFEISGAMETZ — Game Advisor (AI): angalia uwezo wa simu/PC kabla ya kununua + chat na AI ya kila category.
   Matumizi:  ZP.advisor.mount(element, { category:'psp', game:'GTA Vice City', compact:true })
   Bila `category` → inaonyesha chips za categories zote. */
(function(){
  var ZP = window.ZP = window.ZP || {};
  var esc = ZP.esc || function(x){ var d=document.createElement('div'); d.textContent=x==null?'':String(x); return d.innerHTML; };

  var CATS = [
    {key:'psp',     label:'PSP',             hint:'PPSSPP',                phone:true,  pc:true},
    {key:'ps2',     label:'PS2',             hint:'NetherSX2 / PCSX2',     phone:true,  pc:true},
    {key:'ps3',     label:'PS3',             hint:'RPCS3 (PC)',            phone:true,  pc:true},
    {key:'switch',  label:'Nintendo Switch', hint:'Emulator',              phone:true,  pc:true},
    {key:'android', label:'Android',         hint:'Native games',          phone:true,  pc:false},
    {key:'pc',      label:'PC',              hint:'Windows games',         phone:false, pc:true},
    {key:'winlator',label:'Winlator',        hint:'Windows kwenye simu',   phone:true,  pc:false}
  ];
  var CAT = function(k){ return CATS.filter(function(c){return c.key===k;})[0]; };

  var CPU_PHONE = [['0','Dhaifu — Snapdragon 4xx/6xx, Helio G35–G85, Unisoc'],['1','Kati — Snapdragon 7xx/695/680, Dimensity 700–900, Helio G95+'],['2','Nguvu — Snapdragon 8xx/8 Gen, Dimensity 1000+/9000']];
  var CPU_PC = [['0','Dhaifu — dual-core / Celeron / Pentium / zamani sana'],['1','Kati — Core i3/i5 (gen 4–9), Ryzen 3'],['2','Nguvu — Core i5/i7 gen 10+, Ryzen 5 3600+'],['3','Juu sana — Core i7/i9 gen 12+, Ryzen 7/9']];
  var GPU_PC = [['0','Hakuna / Intel UHD / Vega iGPU'],['1','GTX 1050–1650 / RX 560–580'],['2','GTX 1660 / RTX 2060–3060'],['3','RTX 3070 au zaidi / RX 6700+']];
  var RAM_PHONE = [2,3,4,6,8,12];
  var RAM_PC = [4,8,12,16,32];

  /* ---------- Hukumu ya haraka (bila AI) ---------- */
  function verdict(cat, d){
    var phone = d.kind==='phone', r=+d.ram||0, c=+d.cpu||0, g=+d.gpu||0;
    function V(level, text){ return {level:level, text:text}; }
    if (phone){
      switch(cat){
        case 'psp':     return r<2 ? V('bad','RAM ni ndogo mno (chini ya 2GB) — michezo mingi ya PSP itasuasua.') : (r>=3&&c>=1 ? V('good','Simu yako inatosha PSP vizuri (resolution 2x inawezekana).') : V('ok','PSP itacheza, hasa michezo myepesi; tumia resolution 1x na frameskip.'));
        case 'ps2':     return (c===0||r<4) ? V('bad','Chipset/RAM ni dhaifu kwa PS2 — michezo mingi itakuwa na kasi ndogo sana.') : (c===2&&r>=6 ? V('good','PS2 itacheza vizuri kwenye simu hii (michezo mingi).') : V('ok','PS2 itacheza michezo myepesi; tarajia kasi isiyokuwa thabiti kwenye michezo mizito.'));
        case 'ps3':     return V('bad','PS3 (RPCS3) haichezi vizuri kwenye simu. Tumia PC yenye nguvu au Cloud Gaming.');
        case 'switch':  return (c===2&&r>=8) ? V('ok','Ni simu ya flagship — michezo myepesi tu ya Switch ndiyo inaweza kucheza; mingi ni mizito.') : V('bad','Emulation ya Switch inahitaji simu ya flagship (Snapdragon 8 Gen 1+, RAM 8GB+). Simu hii haitatosha.');
        case 'android': return r<2 ? V('bad','RAM ni ndogo mno kwa games nyingi za kisasa.') : (c>=1&&r>=4 ? V('good','Games nyingi za Android zitacheza vizuri (graphics Medium–High'+(c===2&&r>=6?', hata Ultra kwa nyingi':'')+').') : V('ok','Games zitacheza kwa graphics Low/Smooth; michezo mizito (Genshin n.k.) itasuasua.'));
        case 'winlator':return (c<2||r<6) ? V('bad','Winlator inahitaji simu yenye Snapdragon 8 Gen 1+ na RAM 6–8GB+. Simu hii itasuasua sana.') : (r>=8 ? V('ok','Itacheza michezo ya Windows ya zamani/myepesi; michezo mipya ya AAA haitacheza vizuri.') : V('ok','Michezo myepesi sana tu; RAM 8GB+ inapendekezwa.'));
        default: return V('ok','Uliza AI kwa uchambuzi wa kina.');
      }
    }
    switch(cat){
      case 'psp':  return r<4 ? V('ok','PSP itacheza; RAM ndogo inaweza kupunguza kasi ya Windows.') : V('good','PC yako inatosha PSP vizuri (resolution ya juu inawezekana).');
      case 'ps2':  return (c===0||r<4) ? V('bad','CPU/RAM ni dhaifu kwa PCSX2.') : ((c>=2&&r>=8&&g>=1) ? V('good','PS2 (PCSX2) itacheza vizuri, hata resolution 2x–3x.') : V('ok','PS2 itacheza kwa native resolution; michezo mizito inaweza kushuka.'));
      case 'ps3':  return (c<2||r<8||g<1) ? V('bad','RPCS3 inahitaji CPU yenye nguvu (6+ cores, AVX2), RAM 16GB inapendekezwa na GPU yenye Vulkan. PC hii haitatosha michezo mingi.') : ((c>=2&&r>=16&&g>=2) ? V('good','Inatosha michezo mingi ya PS3 — hata hivyo compatibility inatofautiana kwa kila game.') : V('ok','Michezo mingine itacheza; mingine mizito itashuka FPS. Angalia game moja baada ya nyingine.'));
      case 'switch':return (c<2||r<8||g<1) ? V('bad','Emulation ya Switch inahitaji CPU yenye nguvu, RAM 16GB na GPU ya GTX 1650+. PC hii haitatosha.') : ((c>=2&&r>=16&&g>=2) ? V('good','Inatosha michezo mingi ya Switch kwa 1080p.') : V('ok','Michezo myepesi itacheza; mizito itashuka.'));
      case 'pc':
      default:     return r<4 ? V('bad','RAM ni ndogo mno kwa games za kisasa.') : ((g>=2&&r>=16) ? V('good','Games nyingi za kisasa zitacheza 1080p High.') : ((g>=1&&r>=8) ? V('ok','Games nyingi zitacheza 1080p Low–Medium; AAA mpya zinaweza kuhitaji kupunguza settings.') : V('bad','Bila GPU ya maana, games za kisasa zitasuasua — michezo ya zamani/indie tu.')));
    }
  }

  /* ---------- Styles ---------- */
  function css(){
    if (document.getElementById('gaCss')) return;
    var s=document.createElement('style'); s.id='gaCss';
    s.textContent =
'.ga{display:grid;gap:14px}.ga *{box-sizing:border-box}'+
'.ga-card{background:linear-gradient(180deg,#0e1a3f,#0a1330);border:1px solid var(--line2,#233f88);border-radius:16px;padding:16px}'+
'.ga-card h3{margin:0 0 4px;font:700 18px var(--font-d,system-ui);letter-spacing:.3px;display:flex;align-items:center;gap:8px}'+
'.ga-card p.sub{margin:0 0 12px;color:var(--muted,#93a3c7);font-size:13px}'+
'.ga-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}'+
'.ga-seg{display:flex;gap:8px;margin-bottom:12px}.ga-seg button{flex:1}'+
'.ga-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}'+
'.ga-form label{display:grid;gap:5px;font-size:12px;color:var(--muted,#93a3c7);font-weight:600}'+
'.ga-form .wide{grid-column:1/-1}'+
'.ga-form select,.ga-form input{width:100%;height:42px;border-radius:10px;border:1px solid #1d3570;background:#08122c;color:#f4f7ff;padding:0 12px;font:500 14px var(--font-b,system-ui)}'+
'.ga-form select:focus,.ga-form input:focus,.ga-in:focus{outline:2px solid #7c3aff;outline-offset:1px}'+
'.ga-verdict{margin-top:12px;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.5;border:1px solid}'+
'.ga-verdict b{display:block;font:700 16px var(--font-d,system-ui);margin-bottom:2px}'+
'.ga-verdict.good{background:#0b2a1b;border-color:#1f7a47;color:#b9f6d3}.ga-verdict.ok{background:#2a2209;border-color:#8a6a12;color:#ffe9a8}.ga-verdict.bad{background:#2a0c14;border-color:#8a1f3a;color:#ffc2cf}'+
'.ga-log{display:grid;gap:10px;max-height:420px;overflow-y:auto;padding:4px 2px;margin-bottom:10px;scroll-behavior:smooth}'+
'.ga-msg{max-width:92%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.55;word-wrap:break-word}'+
'.ga-msg.me{justify-self:end;background:linear-gradient(90deg,#6a2cff,#4c1bd6);color:#fff;border-bottom-right-radius:4px}'+
'.ga-msg.ai{justify-self:start;background:#0b1636;border:1px solid #1d3570;border-bottom-left-radius:4px}'+
'.ga-msg.ai b{color:#fff}.ga-msg .ga-who{display:block;font-size:11px;font-weight:700;color:#19d8ff;margin-bottom:3px;letter-spacing:.4px}'+
'.ga-quick{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}'+
'.ga-row{display:flex;gap:8px}.ga-in{flex:1;min-width:0;height:44px;border-radius:10px;border:1px solid #1d3570;background:#08122c;color:#f4f7ff;padding:0 12px;font:500 14px var(--font-b,system-ui)}'+
'.ga-note{font-size:12px;color:var(--dim,#6b7aa0);margin:8px 0 0}'+
'.ga-typing{display:inline-flex;gap:4px}.ga-typing i{width:6px;height:6px;border-radius:50%;background:#19d8ff;animation:gab 1s infinite}.ga-typing i:nth-child(2){animation-delay:.15s}.ga-typing i:nth-child(3){animation-delay:.3s}'+
'@keyframes gab{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'+
'@media(min-width:900px){.ga.two{grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:start}}';
    document.head.appendChild(s);
  }

  function fmt(t){
    var h=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
    return h;
  }
  function loadDev(){ try{ return JSON.parse(localStorage.getItem('zp_device')||'{}')||{}; }catch(e){ return {}; } }
  function saveDev(d){ try{ localStorage.setItem('zp_device', JSON.stringify(d)); }catch(e){} }

  ZP.advisor = {
    CATS: CATS, verdict: verdict,
    mount: function(el, opts){
      opts = opts || {}; css();
      var cat = opts.category && CAT(opts.category) ? opts.category : 'psp';
      var fixed = !!(opts.category && CAT(opts.category)) && !opts.selectable;
      var game = opts.game || '';
      var dev = Object.assign({kind:'phone',ram:'4',cpu:'1',gpu:'1',model:'',cpuName:'',gpuName:'',storage:''}, loadDev());
      var history = [];

      el.innerHTML = '<div class="ga'+(opts.compact?'':' two')+'">'+
        (fixed?'':'<div class="ga-chips" id="gaCats" role="tablist" aria-label="Category"></div>')+
        '<section class="ga-card" id="gaDevice"></section>'+
        '<section class="ga-card" id="gaChat"></section></div>';

      var wrap = el.querySelector('.ga');
      if (!fixed) wrap.insertAdjacentHTML('afterbegin',''); // chips are first child already

      function allowedKinds(){ var c=CAT(cat); var k=[]; if(c.phone) k.push('phone'); if(c.pc) k.push('pc'); return k; }
      function ensureKind(){ var k=allowedKinds(); if (k.indexOf(dev.kind)<0) dev.kind=k[0]; }

      function renderCats(){
        var box = el.querySelector('#gaCats'); if(!box) return;
        box.innerHTML = CATS.map(function(c){ return '<button type="button" class="zp-chip'+(c.key===cat?' active':'')+'" data-cat="'+c.key+'" role="tab" aria-selected="'+(c.key===cat)+'">'+esc(c.label)+'</button>'; }).join('');
      }
      function opt(list, val, fmtFn){ return list.map(function(o){ var v=Array.isArray(o)?o[0]:o, l=Array.isArray(o)?o[1]:fmtFn(o); return '<option value="'+v+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l)+'</option>'; }).join(''); }

      function renderDevice(){
        ensureKind();
        var kinds=allowedKinds(), phone=dev.kind==='phone', c=CAT(cat);
        var seg = kinds.length>1 ? '<div class="ga-seg" role="group" aria-label="Aina ya kifaa"><button type="button" class="zp-chip'+(phone?' active':'')+'" data-kind="phone">📱 Simu</button><button type="button" class="zp-chip'+(!phone?' active':'')+'" data-kind="pc">🖥️ PC</button></div>' : '';
        el.querySelector('#gaDevice').innerHTML =
          '<h3>🔍 Angalia kifaa chako</h3><p class="sub">'+esc(c.label)+' • '+esc(c.hint)+' — jaza uwezo wa '+(phone?'simu':'PC')+' yako ujue kama game itacheza.</p>'+seg+
          '<div class="ga-form">'+
            '<label>RAM'+'<select id="gaRam">'+opt(phone?RAM_PHONE:RAM_PC, dev.ram, function(n){return n+' GB';})+'</select></label>'+
            '<label>Storage bure (GB)<input id="gaStorage" inputmode="numeric" placeholder="mf. 32" value="'+esc(dev.storage)+'"></label>'+
            '<label class="wide">'+(phone?'Chipset / Processor':'CPU')+' (kundi)<select id="gaCpu">'+opt(phone?CPU_PHONE:CPU_PC, dev.cpu)+'</select></label>'+
            (phone?'':'<label class="wide">GPU (kadi ya michoro)<select id="gaGpu">'+opt(GPU_PC, dev.gpu)+'</select></label>')+
            '<label class="wide">'+(phone?'Model ya simu / jina la chipset (hiari — AI itatumia)':'Jina la CPU/GPU (hiari — AI itatumia)')+'<input id="gaModel" placeholder="'+(phone?'mf. Tecno Spark 10 Pro, Helio G88':'mf. i5-8250U, GTX 1050')+'" value="'+esc(dev.model)+'"></label>'+
          '</div><div id="gaVerdict"></div>'+
          '<button type="button" class="zp-btn" id="gaCheck" style="margin-top:12px;width:100%">Kagua sasa</button>'+
          '<p class="ga-note">Hukumu ya haraka ni makadirio. Uliza AI upande wa chat kwa game maalum na settings.</p>';
        showVerdict(false);
      }
      function showVerdict(){
        var v = verdict(cat, dev), box = el.querySelector('#gaVerdict'); if(!box) return;
        var head = v.level==='good' ? '✅ Itacheza vizuri' : v.level==='ok' ? '⚠️ Itacheza kwa tahadhari' : '❌ Haitatosha';
        box.innerHTML = '<div class="ga-verdict '+v.level+'" role="status"><b>'+head+(game?' — '+esc(game):'')+'</b>'+esc(v.text)+'</div>';
      }

      function renderChat(){
        var c=CAT(cat);
        el.querySelector('#gaChat').innerHTML =
          '<h3>🤖 Game Advisor — '+esc(c.label)+'</h3><p class="sub">Uliza chochote kuhusu '+esc(c.label)+': itacheza kwenye kifaa changu? settings gani? nunue au la?</p>'+
          '<div class="ga-log" id="gaLog" role="log" aria-live="polite"></div>'+
          '<div class="ga-quick" id="gaQuick"></div>'+
          '<div class="ga-row"><input class="ga-in" id="gaIn" maxlength="600" placeholder="'+(game?'Uliza kuhusu '+esc(game)+'…':'Andika swali lako…')+'" aria-label="Swali kwa AI"><button type="button" class="zp-btn" id="gaSend" aria-label="Tuma">Tuma</button></div>';
        var q = el.querySelector('#gaQuick');
        var quick = game ? ['Itacheza kwenye kifaa changu?','Settings bora za '+game+'?','Nunue au nijaribu kwanza?'] : ['Game gani zinafaa kifaa changu?','Settings bora za '+c.label+'?','Naanzaje kucheza '+c.label+'?'];
        q.innerHTML = quick.map(function(t){ return '<button type="button" class="zp-chip" data-q="'+esc(t)+'">'+esc(t)+'</button>'; }).join('');
        say('ai','Karibu! Mimi ni Game Advisor wa **'+c.label+'**. Jaza kifaa chako hapo juu kisha niulize — nitakuambia kama game itacheza, settings bora, na kama inafaa kununua.');
      }

      function say(who, text, raw){
        var log = el.querySelector('#gaLog'); if(!log) return null;
        var d=document.createElement('div'); d.className='ga-msg '+who;
        d.innerHTML = (who==='ai'?'<span class="ga-who">GAME ADVISOR</span>':'') + (raw?text:fmt(text));
        log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
      }

      function deviceForAI(){
        var phone = dev.kind==='phone';
        var cpuL = (phone?CPU_PHONE:CPU_PC).filter(function(o){return o[0]===String(dev.cpu);})[0];
        return { kind: dev.kind, ram: dev.ram+' GB', storage: dev.storage? dev.storage+' GB':'', model: dev.model,
                 cpu: cpuL?cpuL[1]:'', gpu: phone?'':((GPU_PC.filter(function(o){return o[0]===String(dev.gpu);})[0]||[])[1]||'') };
      }

      var busy=false;
      function ask(text){
        text=(text||'').trim(); if(!text||busy) return;
        busy=true; say('me', text);
        var inp=el.querySelector('#gaIn'); inp.value='';
        var wait = say('ai','<span class="ga-typing"><i></i><i></i><i></i></span>', true);
        var btn=el.querySelector('#gaSend'); btn.disabled=true;
        fetch('/api/ai/game-advisor',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({category:cat, message:ZP.aiMessage?ZP.aiMessage(text):text, device:deviceForAI(), game:game, history:history})})
        .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
        .then(function(x){
          var reply = x.ok && x.d && x.d.reply ? x.d.reply : ((x.d&&x.d.error)||'AI haikupatikana kwa sasa. Jaribu tena.');
          wait.innerHTML='<span class="ga-who">GAME ADVISOR</span>'+fmt(reply);
          if (x.ok){ history.push({role:'user',text:text},{role:'ai',text:reply}); history=history.slice(-8); }
        })
        .catch(function(){ wait.innerHTML='<span class="ga-who">GAME ADVISOR</span>Hitilafu ya mtandao. Jaribu tena.'; })
        .then(function(){ busy=false; btn.disabled=false; var l=el.querySelector('#gaLog'); l.scrollTop=l.scrollHeight; });
      }

      function readDevice(){
        var g=function(id){ var n=el.querySelector(id); return n?n.value:''; };
        dev.ram=g('#gaRam')||dev.ram; dev.cpu=g('#gaCpu'); if(el.querySelector('#gaGpu')) dev.gpu=g('#gaGpu');
        dev.storage=g('#gaStorage').replace(/[^\d.]/g,''); dev.model=g('#gaModel').trim(); saveDev(dev);
      }

      el.addEventListener('click', function(e){
        var t=e.target.closest('button'); if(!t) return;
        if (t.dataset.cat){ cat=t.dataset.cat; history=[]; renderCats(); renderDevice(); renderChat(); }
        else if (t.dataset.kind){ readDevice(); dev.kind=t.dataset.kind; dev.ram = dev.kind==='phone'?'4':'8'; dev.cpu = dev.kind==='phone'?'1':'1'; saveDev(dev); renderDevice(); }
        else if (t.id==='gaCheck'){ readDevice(); showVerdict(); }
        else if (t.id==='gaSend'){ readDevice(); ask(el.querySelector('#gaIn').value); }
        else if (t.dataset.q){ readDevice(); ask(t.dataset.q); }
      });
      el.addEventListener('change', function(e){ if (e.target.closest('#gaDevice')){ readDevice(); showVerdict(); } });
      el.addEventListener('keydown', function(e){ if (e.target.id==='gaIn' && e.key==='Enter'){ e.preventDefault(); readDevice(); ask(e.target.value); } });

      renderCats(); renderDevice(); renderChat();
    }
  };
})();

/* LIFEISGAMETZ — player ya pamoja: YouTube/Vimeo/Dailymotion (embed salama), HLS (.m3u8), mp4/webm, na link za nje.
   ZP.player.mount(element, {type,url,embedUrl}, {poster, autoplay, onError}) -> { destroy() } */
(function(){
  var ZP = window.ZP = window.ZP || {};
  var HLS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js', hlsP = null;
  function loadHls(){
    if (window.Hls) return Promise.resolve();
    if (!hlsP) hlsP = new Promise(function(res, rej){
      var s = document.createElement('script'); s.src = HLS_SRC; s.onload = res;
      s.onerror = function(){ hlsP = null; rej(new Error('hls')); }; document.head.appendChild(s);
    });
    return hlsP;
  }
  function msg(el, html){ el.innerHTML = '<div style="display:grid;place-items:center;text-align:center;gap:10px;padding:24px;min-height:200px;color:#c4d0ee;font:500 14px/1.5 Inter,system-ui,sans-serif">'+html+'</div>'; }
  function esc(x){ var d=document.createElement('div'); d.textContent = x==null ? '' : String(x); return d.innerHTML; }
  function withParam(u, k, v){ return u + (u.indexOf('?')>-1 ? '&' : '?') + k + '=' + v; }

  ZP.player = {
    mount: function(el, s, opts){
      opts = opts || {}; var hls = null, dead = false;
      el.innerHTML = '';
      el.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden';
      function fail(){ if (dead) return; msg(el, '⚠️ Stream haipatikani kwa sasa.<br><small>Jaribu channel nyingine au jaribu tena baadaye.</small>'); if (opts.onError) opts.onError(); }
      if (!s || !s.url){ fail(); return { destroy: function(){} }; }
      if (s.type === 'youtube' || s.type === 'embed'){
        var f = document.createElement('iframe');
        f.src = opts.autoplay ? withParam(s.embedUrl, 'autoplay', '1') : s.embedUrl;
        f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin'; f.title = opts.title || 'Video';
        f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0'; el.appendChild(f);
      } else if (s.type === 'file' || s.type === 'hls'){
        var v = document.createElement('video'); v.controls = true; v.playsInline = true; v.preload = 'metadata';
        if (opts.poster) v.poster = opts.poster;
        v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#000'; el.appendChild(v);
        v.addEventListener('error', function(){ if (s.type === 'file') fail(); });
        if (s.type === 'file'){ v.src = s.url; if (opts.autoplay) v.play().catch(function(){}); }
        else if (v.canPlayType('application/vnd.apple.mpegurl')){ v.src = s.url; if (opts.autoplay) v.play().catch(function(){}); }
        else loadHls().then(function(){
          if (dead) return;
          if (!window.Hls || !window.Hls.isSupported()) return fail();
          hls = new window.Hls({ lowLatencyMode: true });
          hls.on(window.Hls.Events.ERROR, function(e, d){ if (d && d.fatal) fail(); });
          hls.loadSource(s.url); hls.attachMedia(v);
          if (opts.autoplay) v.play().catch(function(){});
        }).catch(fail);
      } else {
        msg(el, '🔗 Video hii iko kwenye tovuti nyingine.<br><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;padding:10px 18px;border-radius:10px;background:linear-gradient(90deg,#6a2cff,#4c1bd6);color:#fff;font-weight:700;text-decoration:none">▶ Fungua</a>');
      }
      return { destroy: function(){ dead = true; if (hls){ try { hls.destroy(); } catch(e){} } el.innerHTML = ''; } };
    }
  };
})();

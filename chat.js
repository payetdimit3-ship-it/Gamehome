// ═══════════ 🤖 GAMEHUB AI CHAT — Amina ═══════════
(function () {
  if (window.__aminaLoaded) return;
  window.__aminaLoaded = true;

  document.body.insertAdjacentHTML('beforeend', `
    <style>
      /* ═══ AI CHAT — Modern Look ═══ */
      #ghChatBtn {
        position: fixed; bottom: 18px; right: 18px; z-index: 9999;
        background: linear-gradient(135deg, #7c3aed, #4c1d95);
        color: #fff; border: none; border-radius: 50px;
        padding: 14px 22px; font-size: 15px; font-weight: 700;
        cursor: pointer; box-shadow: 0 6px 25px rgba(124,58,237,.55);
        display: flex; align-items: center; gap: 8px;
        transition: transform .2s;
      }
      #ghChatBtn:hover { transform: translateY(-2px); }
      #ghChatBtn .pulse {
        width: 10px; height: 10px; border-radius: 50%;
        background: #86efac; box-shadow: 0 0 10px #86efac;
        animation: ghPulse 1.5s infinite;
      }
      @keyframes ghPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .4; }
      }

      #ghChatBox {
        position: fixed; bottom: 80px; right: 18px; z-index: 9999;
        width: 360px; max-width: calc(100vw - 36px);
        height: 540px; max-height: calc(100vh - 120px);
        background: #0d1020; border: 1px solid rgba(124,58,237,.35);
        border-radius: 18px; display: none; overflow: hidden;
        box-shadow: 0 12px 50px rgba(0,0,0,.7);
        font-family: system-ui, -apple-system, sans-serif;
        flex-direction: column;
      }
      #ghChatBox.on { display: flex; }

      #ghChatHead {
        background: linear-gradient(135deg, #7c3aed, #4c1d95);
        color: #fff; padding: 14px 16px;
        display: flex; justify-content: space-between; align-items: center;
      }
      #ghChatHead .info { display: flex; align-items: center; gap: 10px; }
      #ghChatHead .ava {
        width: 40px; height: 40px; border-radius: 50%;
        background: rgba(255,255,255,.2);
        display: grid; place-items: center; font-size: 22px;
      }
      #ghChatHead b { font-size: 14.5px; display: block; }
      #ghChatHead small { font-size: 11px; opacity: .85; }
      #ghChatClose {
        background: none; border: none; color: #fff;
        font-size: 20px; cursor: pointer; padding: 4px 8px;
      }

      #ghChatMsgs {
        flex: 1; overflow-y: auto; padding: 14px;
        display: flex; flex-direction: column; gap: 10px;
        background: #0a0d1a;
      }
      #ghChatMsgs::-webkit-scrollbar { width: 6px; }
      #ghChatMsgs::-webkit-scrollbar-thumb { background: rgba(124,58,237,.3); border-radius: 3px; }

      .ghMsg {
        max-width: 85%; padding: 10px 14px; border-radius: 14px;
        font-size: 13.5px; line-height: 1.55; word-wrap: break-word;
        animation: ghFadeIn .3s ease;
      }
      @keyframes ghFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ghBot {
        background: rgba(255,255,255,.06); color: #e8eaff;
        align-self: flex-start; border-bottom-left-radius: 4px;
      }
      .ghUser {
        background: #7c3aed; color: #fff;
        align-self: flex-end; border-bottom-right-radius: 4px;
      }
      .ghTyping {
        background: rgba(255,255,255,.06); color: #969dbb;
        align-self: flex-start; font-style: italic; font-size: 13px;
      }
      .ghTyping::after {
        content: '...'; animation: ghDots 1.4s infinite;
      }
      @keyframes ghDots {
        0% { content: '.'; } 33% { content: '..'; } 66% { content: '...'; }
      }

      #ghChatInputRow {
        display: flex; border-top: 1px solid rgba(255,255,255,.08);
        background: #0d1020;
      }
      #ghChatInput {
        flex: 1; background: transparent; border: none;
        color: #fff; padding: 14px 16px;
        font-size: 13.5px; outline: none; font-family: inherit;
      }
      #ghChatInput::placeholder { color: #6b7290; }
      #ghChatMic, #ghChatSend {
        background: transparent; border: none; color: #fff;
        padding: 0 14px; font-size: 17px; cursor: pointer;
        transition: .15s;
      }
      #ghChatSend { color: #7c3aed; }
      #ghChatSend:hover { color: #a78bfa; }
      #ghChatMic:hover { color: #a78bfa; }
      #ghChatMic.recording { color: #ff3d71; animation: ghPulse 1s infinite; }
      #ghChatSend:disabled { opacity: .3; cursor: wait; }

      @media (max-width: 500px) {
        #ghChatBtn { padding: 12px 18px; font-size: 14px; }
        #ghChatBox { width: calc(100vw - 24px); right: 12px; bottom: 76px; height: 500px; }
      }
    </style>

    <button id="ghChatBtn">
      <span class="pulse"></span>
      🤖 Msaidizi AI
    </button>

    <div id="ghChatBox">
      <div id="ghChatHead">
        <div class="info">
          <div class="ava">🤖</div>
          <div>
            <b>Amina</b>
            <small>🟢 AI Agent • Online</small>
          </div>
        </div>
        <button id="ghChatClose">✕</button>
      </div>
      <div id="ghChatMsgs">
        <div class="ghMsg ghBot">Habari! Mimi ni <b>Amina</b>, msaidizi wako wa GameHub! 🎮

Naweza kukusaidia na:
• Kutafuta games 🔍
• Bei na malipo 💰
• Msaada wa kununua 🛒

Uliza chochote! 😊</div>
      </div>
      <div id="ghChatInputRow">
        <input id="ghChatInput" type="text" placeholder="Andika ujumbe wako..." autocomplete="off">
        <button id="ghChatMic" title="Ongea">🎙️</button>
        <button id="ghChatSend" title="Tuma">➤</button>
      </div>
    </div>
  `);

  // ═══════════ Elements ═══════════
  const btn = document.getElementById('ghChatBtn');
  const box = document.getElementById('ghChatBox');
  const closeBtn = document.getElementById('ghChatClose');
  const msgs = document.getElementById('ghChatMsgs');
  const input = document.getElementById('ghChatInput');
  const sendBtn = document.getElementById('ghChatSend');
  const micBtn = document.getElementById('ghChatMic');

  let history = [];
  let isSending = false;
  let isOpen = false;

  // ═══════════ Toggle ═══════════
  btn.addEventListener('click', () => {
    isOpen = !isOpen;
    box.classList.toggle('on', isOpen);
    if (isOpen) {
      setTimeout(() => input.focus(), 100);
    }
  });
  closeBtn.addEventListener('click', () => {
    isOpen = false;
    box.classList.remove('on');
  });

  // ═══════════ Add message ═══════════
  function addMsg(text, who) {
    const div = document.createElement('div');
    if (who === 'typing') {
      div.className = 'ghMsg ghTyping';
      div.textContent = 'Amina anaandika';
    } else {
      div.className = 'ghMsg ' + (who === 'user' ? 'ghUser' : 'ghBot');
      div.innerHTML = String(text || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
      }[c])).replace(/\n/g, '<br>');
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  // ═══════════ Send message ═══════════
  async function sendMsg() {
    const text = input.value.trim();
    if (!text || isSending) return;

    isSending = true;
    sendBtn.disabled = true;

    addMsg(text, 'user');
    input.value = '';

    const typing = addMsg('', 'typing');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-10)
        })
      });
      const data = await res.json();
      typing.remove();

      const reply = data.reply || 'Samahani, jaribu tena.';
      addMsg(reply, 'bot');

      history.push({ role: 'user', text });
      history.push({ role: 'assistant', text: reply });
      if (history.length > 20) history = history.slice(-20);

      // Text-to-speech (hiari)
      if ('speechSynthesis' in window && isOpen) {
        try {
          const utter = new SpeechSynthesisUtterance(reply);
          utter.lang = 'sw-TZ';
          utter.rate = 1.05;
          speechSynthesis.cancel();
          speechSynthesis.speak(utter);
        } catch (e) {}
      }
    } catch (e) {
      typing.remove();
      addMsg('❌ Hitilafu ya mtandao. Jaribu tena.', 'bot');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', sendMsg);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });

  // ═══════════ Voice Input (Speech Recognition) ═══════════
  micBtn.addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Browser yako haiungi mkono voice input. Tumia Chrome au Edge.');
      return;
    }
    const r = new SR();
    r.lang = 'sw-TZ';
    r.interimResults = false;
    r.continuous = false;

    micBtn.classList.add('recording');
    micBtn.textContent = '🔴';

    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      input.value = transcript;
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎙️';
      sendMsg();
    };

    r.onerror = () => {
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎙️';
    };

    r.onend = () => {
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎙️';
    };

    r.start();
  });
})();

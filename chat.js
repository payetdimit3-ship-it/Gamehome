// ═══════════ GAMEHUB AI CHAT — Kona ya chini ═══════════
(function () {
  document.body.insertAdjacentHTML('beforeend', `
    <style>
      #ghChatBtn { position: fixed; bottom: 18px; right: 18px; z-index: 9999; background:#7b2ff7; color:#fff; border:none; border-radius:50px; padding:14px 22px; font-size:15px; font-weight:bold; cursor:pointer; box-shadow:0 4px 14px rgba(123,47,247,.5); }
      #ghChatBox { position: fixed; bottom: 80px; right: 18px; z-index: 9999; width: 300px; max-width: 90vw; background:#15152a; border:1px solid #2a2a4a; border-radius:16px; display:none; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.6); }
      #ghChatHead { background:#7b2ff7; color:#fff; padding:12px 14px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; }
      #ghChatClose { background:none; border:none; color:#fff; font-size:18px; cursor:pointer; }
      #ghChatMsgs { height: 260px; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
      .ghMsg { max-width:85%; padding:8px 11px; border-radius:12px; font-size:13px; line-height:1.4; white-space:pre-wrap; }
      .ghBot { background:#0a0a14; color:#e8e8f5; align-self:flex-start; }
      .ghUser { background:#7b2ff7; color:#fff; align-self:flex-end; }
      #ghChatInputRow { display:flex; border-top:1px solid #2a2a4a; }
      #ghChatInput { flex:1; background:#0a0a14; border:none; color:#fff; padding:12px; font-size:13px; outline:none; }
      #ghChatSend { background:#7b2ff7; border:none; color:#fff; padding:0 16px; font-size:16px; cursor:pointer; }
    </style>
    <button id="ghChatBtn">🤖 Msaidizi AI</button>
    <div id="ghChatBox">
      <div id="ghChatHead">🤖 Msaidizi wa GameHub <button id="ghChatClose">✖</button></div>
      <div id="ghChatMsgs"><div class="ghMsg ghBot">Habari! Mimi ni AI wa GameHub. Naweza kukusaidia na bidhaa, bei, malipo na zaidi. Uliza chochote! 😊</div></div>
      <div id="ghChatInputRow">
        <input id="ghChatInput" type="text" placeholder="Andika ujumbe...">
        <button id="ghChatSend">➤</button>
      </div>
    </div>
  `);

  const btn = document.getElementById('ghChatBtn');
  const box = document.getElementById('ghChatBox');
  const closeBtn = document.getElementById('ghChatClose');
  const msgs = document.getElementById('ghChatMsgs');
  const input = document.getElementById('ghChatInput');
  const send = document.getElementById('ghChatSend');

  let history = []; // {role: 'user'|'assistant', text: string}

  btn.addEventListener('click', () => { box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none'; });
  closeBtn.addEventListener('click', () => { box.style.display = 'none'; });

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'ghMsg ' + (who === 'user' ? 'ghUser' : 'ghBot');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function sendMsg() {
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, 'user');
    input.value = '';
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(-10) })
      });
      const data = await res.json();
      const reply = data.reply || 'Samahani, jaribu tena.';
      addMsg(reply, 'bot');
      history.push({ role: 'user', text });
      history.push({ role: 'assistant', text: reply });
    } catch (e) {
      addMsg('Hitilafu ya mtandao. Jaribu tena.', 'bot');
    }
  }

  send.addEventListener('click', sendMsg);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
})();

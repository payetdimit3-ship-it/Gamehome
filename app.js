// ============ GAMEHUB APP.JS (AZAMPAY + ADMIN STATE) ============

// 1. KUSIMAMIA CART (KIKAPU)
function getCart() {
  return JSON.parse(localStorage.getItem('gamehubCart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('gamehubCart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const cart = getCart();
  const badge = document.getElementById('cartCount');
  if (badge) {
    badge.textContent = cart.reduce((total, item) => total + (item.quantity || 1), 0);
  }
}

// 2. KUSIMAMIA ADMIN & USER LOGIN STATE (LUDISHA SEHEMU YA ADMIN)
function checkUserLoginState() {
  const user = JSON.parse(localStorage.getItem('gamehubUser') || 'null');
  const loginBtn = document.getElementById('topLoginBtn');

  if (loginBtn) {
    if (user) {
      if (user.isAdmin || user.role === 'admin' || user.email === 'payetdimit3@gmail.com') {
        loginBtn.textContent = '⚙️ Admin Panel (' + (user.name || 'Kelvin') + ')';
        loginBtn.href = 'admin.html';
        loginBtn.style.borderColor = '#ff3eb5';
        loginBtn.style.color = '#ff3eb5';
      } else {
        loginBtn.textContent = '👤 ' + user.name;
        loginBtn.href = 'mygames.html';
      }
    } else {
      loginBtn.textContent = '👤 Login / Sign Up';
      loginBtn.href = 'login.html';
    }
  }
}

// 3. KUTAMBUA MTANDAO WENYE NAMBA YA SIMU
function detectNetwork(phone) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  let prefix = '';
  
  if (cleanPhone.startsWith('255')) {
    prefix = cleanPhone.substring(3, 5);
  } else if (cleanPhone.startsWith('0')) {
    prefix = cleanPhone.substring(1, 3);
  } else {
    prefix = cleanPhone.substring(0, 2);
  }

  if (['65', '67', '71', '68'].includes(prefix)) return 'tigo';
  if (['74', '75', '76', '79'].includes(prefix)) return 'vodacom';
  if (['78', '69'].includes(prefix)) return 'airtel';
  if (['62'].includes(prefix)) return 'halotel';

  return 'airtel';
}

// 4. AZAMPAY CHECKOUT FUNCTION
async function processAzamPayCheckout(event) {
  if (event) event.preventDefault();

  const phoneInput = document.getElementById('checkoutPhone');
  const nameInput = document.getElementById('checkoutName');
  const emailInput = document.getElementById('checkoutEmail');
  const errorBox = document.getElementById('checkoutError') || document.querySelector('.error-msg');
  const payBtn = document.getElementById('payBtn') || document.querySelector('.buy-btn');

  if (!phoneInput || !phoneInput.value.trim()) {
    showError("Tafadhali weka namba ya simu.", errorBox);
    return;
  }

  let phone = phoneInput.value.trim().replace(/\s+/g, '');
  if (phone.startsWith('0')) {
    phone = '255' + phone.substring(1);
  } else if (!phone.startsWith('255') && phone.length === 9) {
    phone = '255' + phone;
  }

  const cart = getCart();
  let amount = 0;
  let items = [];

  if (cart.length > 0) {
    amount = cart.reduce((sum, item) => sum + (Number(item.price) * (item.quantity || 1)), 0);
    items = cart;
  } else {
    amount = window.currentProductPrice || 1000; 
    items = [{ name: window.currentProductName || 'GameHub Purchase', price: amount }];
  }

  const provider = detectNetwork(phone);

  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = '⏳ Inatuma ombi la PIN...';
  }
  if (errorBox) errorBox.style.display = 'none';

  try {
    const response = await fetch('/api/azampay/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        phone: phone,
        provider: provider,
        items: items,
        name: nameInput ? nameInput.value : 'Kelvin',
        email: emailInput ? emailInput.value : 'payetdimit3@gmail.com'
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert("📲 Ombi la malipo limetumwa kwenye simu yako (" + phone + ")!\n\nWeka PIN yako kwenye simu kukamilisha muamala.");
      localStorage.removeItem('gamehubCart');
      updateCartBadge();
      window.location.href = 'myorders.html';
    } else {
      showError(data.error || "Hitilafu imetokea kwenye server.", errorBox);
    }
  } catch (err) {
    console.error("Payment Error:", err);
    showError("Hitilafu ya mtandao. Hakikisha backend server ina /api/azampay/pay route.", errorBox);
  } finally {
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = '💳 Lipa Hapa';
    }
  }
}

function showError(msg, element) {
  if (element) {
    element.textContent = "❌ " + msg;
    element.style.display = 'block';
  } else {
    alert("❌ " + msg);
  }
}

// 5. INITIALIZE ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  checkUserLoginState();

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', processAzamPayCheckout);
  }

  const checkoutBtn = document.getElementById('payBtn');
  if (checkoutBtn && !checkoutForm) {
    checkoutBtn.addEventListener('click', processAzamPayCheckout);
  }
});

window.DH_APP_BUILD = '2026-11-02-a';
// ═══════════════════════════════════════
// DELIVERY HUB - app.js
// Firebase + All App Logic
// ═══════════════════════════════════════

// Show auth after 2s max - no waiting for Firebase
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var l = document.getElementById('loading');
    var a = document.getElementById('auth');
    var ap = document.getElementById('app');
    if (l) l.classList.add('hidden');
    if (a && ap && ap.classList.contains('hidden')) a.classList.remove('hidden');
  }, 2000);
});

// FIREBASE CONFIG
var firebaseConfig = {
  apiKey: "AIzaSyA0qyvTbbcDSh2MW6C2rufm28W9t3hQdlE",
  authDomain: "delivery-hub-69ab6.firebaseapp.com",
  projectId: "delivery-hub-69ab6",
  storageBucket: "delivery-hub-69ab6.firebasestorage.app",
  messagingSenderId: "17211064702",
  appId: "1:17211064702:web:732d6299bec4a5c098b32f"
};
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

// STATE
var S = {
  user: null, profile: null, view: null,
  unsubs: [], mapInst: null, trackTimer: null,
  bData: {}, selPay: 'cod', bStep: 1,
  selStar: 0, appliedPromo: null, chatUnsub: null
};

// AUTH STATE
auth.onAuthStateChanged(function(user) {
  document.getElementById('loading').classList.add('hidden');
  if (user) {
    S.user = user;
    loadProfile(user);
  } else {
    S.user = null;
    S.profile = null;
    showAuth();
  }
});

function loadProfile(user) {
  return db.collection('users').doc(user.uid).get().then(function(doc) {
    if (doc.exists) {
      S.profile = Object.assign({ id: doc.id }, doc.data());
      showApp();
      return;
    }
    var viaGoogle = (user.providerData || []).some(function(p) { return p.providerId === 'google.com'; });
    if (viaGoogle) { showProfileSetup(user); return; }
    if (S.signingUp) return; // email signup is still saving the profile
    auth.signOut();
    showAuth();
  }).catch(function() { showAuth(); });
}

// GOOGLE SIGN-IN
function googleSignIn() {
  var btn = document.getElementById('google-btn');
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (btn) btn.disabled = true;
  auth.signInWithPopup(provider).then(function() {
    if (btn) btn.disabled = false;
  }).catch(function(e) {
    if (btn) btn.disabled = false;
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/popup-blocked') { auth.signInWithRedirect(provider); return; }
    showErr(googleErrMsg(e));
  });
}

function googleErrMsg(e) {
  var msgs = {
    'auth/unauthorized-domain': 'This website is not allowed for Google sign-in yet. Add it in Firebase > Authentication > Settings > Authorized domains.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled yet. Enable it in Firebase > Authentication > Sign-in method.',
    'auth/account-exists-with-different-credential': 'An account with this email already exists. Log in with your email and password.',
    'auth/network-request-failed': 'Network error. Check your internet and try again.'
  };
  return msgs[e.code] || e.message;
}

// Show errors from a redirect-based sign-in (only used if popup was blocked)
auth.getRedirectResult().catch(function(e) { showErr(googleErrMsg(e)); });

// FIRST-TIME GOOGLE USERS: choose role
function showProfileSetup(user) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
  document.getElementById('login-box').classList.add('hidden');
  document.getElementById('profile-setup').classList.remove('hidden');
  document.getElementById('ps-name').value = user.displayName || '';
  document.getElementById('ps-email').textContent = user.email || '';
}

function psErr(m) {
  var e = document.getElementById('ps-err');
  e.textContent = m;
  e.classList.remove('hidden');
}

function finishGoogleProfile() {
  var user = auth.currentUser;
  if (!user) { showAuth(); return; }
  var name = document.getElementById('ps-name').value.trim();
  var phone = document.getElementById('ps-phone').value.trim();
  var role = document.getElementById('ps-role').value;
  if (!name) { psErr('Please enter your name.'); return; }
  if (role !== 'customer' && role !== 'driver') role = 'customer';
  var btn = document.getElementById('ps-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  var avatar = name.split(' ').map(function(x) { return x[0]; }).join('').substring(0, 2).toUpperCase();
  var data = {
    name: name, email: user.email || '', phone: phone, role: role, avatar: avatar, provider: 'google',
    joined: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (role === 'driver') Object.assign(data, { online: false, rating: 5.0, deliveries: 0, earnings: 0 });
  db.collection('users').doc(user.uid).set(data).then(function() {
    btn.disabled = false; btn.textContent = 'Continue';
    return loadProfile(user);
  }).catch(function(e) {
    psErr(e.message);
    btn.disabled = false; btn.textContent = 'Continue';
  });
}

function cancelGoogleProfile() {
  auth.signOut();
  showAuth();
}

function showApp() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('av-btn').textContent = S.profile.avatar || S.profile.name.charAt(0);
  buildNav();
  seedPromoCodes();
  var first = { customer: 'home', driver: 'available', admin: 'adash' }[S.profile.role] || 'home';
  showView(first);
}

function showAuth() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
  var lb = document.getElementById('login-box');
  var ps = document.getElementById('profile-setup');
  if (lb) lb.classList.remove('hidden');
  if (ps) ps.classList.add('hidden');
}

// SEED PROMO CODES
function seedPromoCodes() {
  var codes = [
    { id: 'FIRST20', discount: 20, type: 'percent', desc: '20% off first order', minOrder: 100, maxUses: 1000, used: 0 },
    { id: 'SAVE50', discount: 50, type: 'fixed', desc: 'Flat Rs.50 off', minOrder: 200, maxUses: 5000, used: 0 },
    { id: 'SPEED10', discount: 10, type: 'percent', desc: '10% off all deliveries', minOrder: 0, maxUses: 9999, used: 0 },
    { id: 'NEW100', discount: 100, type: 'fixed', desc: 'Rs.100 off on orders above Rs.500', minOrder: 500, maxUses: 500, used: 0 }
  ];
  codes.forEach(function(code) {
    var ref = db.collection('promoCodes').doc(code.id);
    ref.get().then(function(doc) { if (!doc.exists) ref.set(code); }).catch(function() {});
  });
}

// AUTH FUNCTIONS
function switchTab(t) {
  document.querySelectorAll('.auth-tab').forEach(function(el, i) { el.classList.toggle('active', i === (t === 'login' ? 0 : 1)); });
  document.getElementById('login-form').classList.toggle('hidden', t !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', t !== 'signup');
  document.getElementById('auth-err').classList.add('hidden');
}

function showErr(m) {
  var e = document.getElementById('auth-err');
  e.textContent = m;
  e.classList.remove('hidden');
}

function doLogin() {
  var email = document.getElementById('l-email').value.trim();
  var pass = document.getElementById('l-pass').value;
  if (!email || !pass) { showErr('Please fill all fields.'); return; }
  var btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Logging in...';
  auth.signInWithEmailAndPassword(email, pass).catch(function(e) {
    var msgs = { 'auth/user-not-found': 'No account found.', 'auth/wrong-password': 'Wrong password.', 'auth/invalid-credential': 'Invalid email or password.' };
    showErr(msgs[e.code] || e.message);
    btn.disabled = false; btn.textContent = 'Login';
  });
}

function doSignup() {
  var name = document.getElementById('s-name').value.trim();
  var email = document.getElementById('s-email').value.trim();
  var phone = document.getElementById('s-phone').value.trim();
  var pass = document.getElementById('s-pass').value;
  var role = document.getElementById('s-role').value;
  if (!name || !email || !pass) { showErr('Please fill all fields.'); return; }
  if (pass.length < 6) { showErr('Password must be 6+ characters.'); return; }
  if (role !== 'customer' && role !== 'driver') role = 'customer';
  var btn = document.getElementById('signup-btn');
  btn.disabled = true; btn.textContent = 'Creating...';
  S.signingUp = true;
  auth.createUserWithEmailAndPassword(email, pass).then(function(cred) {
    var avatar = name.split(' ').map(function(x) { return x[0]; }).join('').substring(0, 2).toUpperCase();
    var data = { name: name, email: email, phone: phone, role: role, avatar: avatar, joined: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (role === 'driver') Object.assign(data, { online: false, rating: 5.0, deliveries: 0, earnings: 0 });
    return db.collection('users').doc(cred.user.uid).set(data).then(function() {
      S.signingUp = false;
      return loadProfile(cred.user);
    });
  }).catch(function(e) {
    S.signingUp = false;
    var msgs = { 'auth/email-already-in-use': 'Email already registered.', 'auth/weak-password': 'Password too weak.' };
    showErr(msgs[e.code] || e.message);
    btn.disabled = false; btn.textContent = 'Create Account';
  });
}

function doLogout() {
  cleanupAll();
  auth.signOut();
  closeModal();
  toast('Logged out');
}

// NAV & VIEWS
function buildNav() {
  var navs = {
    customer: [{ id: 'home', icon: '🏠', label: 'Home' }, { id: 'track', icon: '📍', label: 'Track' }, { id: 'orders', icon: '📦', label: 'Orders' }, { id: 'profile', icon: '👤', label: 'Profile' }],
    driver: [{ id: 'available', icon: '🔔', label: 'Available' }, { id: 'myruns', icon: '🚗', label: 'My Runs' }, { id: 'earnings', icon: '💰', label: 'Earnings' }, { id: 'dprofile', icon: '👤', label: 'Profile' }],
    admin: [{ id: 'adash', icon: '📊', label: 'Dashboard' }, { id: 'aorders', icon: '📦', label: 'Orders' }, { id: 'adrivers', icon: '🚗', label: 'Drivers' }, { id: 'ausers', icon: '👥', label: 'Users' }, { id: 'asettings', icon: '⚙️', label: 'Settings' }]
  };
  document.getElementById('bnav').innerHTML = (navs[S.profile.role] || []).map(function(n) {
    return '<button class="nav-item" id="ni-' + n.id + '" onclick="showView(\'' + n.id + '\')"><div class="nav-icon">' + n.icon + '</div><div class="nav-label">' + n.label + '</div></button>';
  }).join('');
}

function cleanupAll() {
  S.unsubs.forEach(function(u) { try { u(); } catch (e) { } });
  S.unsubs = [];
  if (S.trackTimer) { clearInterval(S.trackTimer); S.trackTimer = null; }
  if (S.mapInst) { try { S.mapInst.remove(); } catch (e) { } S.mapInst = null; }
  if (S.chatUnsub) { try { S.chatUnsub(); } catch (e) { } S.chatUnsub = null; }
}

function showView(v) {
  cleanupAll();
  document.querySelectorAll('.view').forEach(function(el) { el.classList.add('hidden'); });
  document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
  S.view = v;
  var el = document.getElementById('v-' + v);
  if (el) { el.classList.remove('hidden'); el.scrollTop = 0; }
  var nb = document.getElementById('ni-' + v);
  if (nb) nb.classList.add('active');
  var renders = { home: renderHome, track: renderTrack, orders: renderOrders, profile: renderProfile, available: renderAvailable, myruns: renderMyRuns, earnings: renderEarnings, dprofile: renderDProfile, adash: renderAdash, aorders: renderAorders, adrivers: renderAdrivers, ausers: renderAusers, asettings: renderAsettings };
  if (renders[v]) renders[v]();
}

// ═══ ACCENT COLOR PICKER ═══
function themeRow() {
  var t = DH_THEMES[getAccentKey()];
  return '<div class="info-row" style="cursor:pointer" onclick="openThemePicker()"><span class="info-key">Accent Color</span>'
    + '<span style="display:flex;align-items:center;gap:0.5rem;color:var(--mu);font-size:0.8rem">'
    + '<span style="width:14px;height:14px;border-radius:50%;display:inline-block;background:' + t.main + '"></span>' + t.name + ' →</span></div>';
}

function openThemePicker() {
  var cur = getAccentKey();
  openModal('<div class="modal-title">🎨 Accent Color</div>'
    + '<div style="font-size:0.78rem;color:var(--mu);margin-bottom:1rem">Choose the color used for buttons, highlights and glows across the app.</div>'
    + '<div class="swatch-grid">'
    + Object.keys(DH_THEMES).map(function(k) {
      var t = DH_THEMES[k];
      return '<div class="swatch' + (k === cur ? ' sel' : '') + '" onclick="setAccent(\'' + k + '\')">'
        + '<div class="swatch-dot" style="background:linear-gradient(135deg,' + t.main + ',' + t.dark + ')"></div>'
        + '<div class="swatch-name">' + t.name + (k === cur ? ' ✓' : '') + '</div></div>';
    }).join('')
    + '</div>');
}

function setAccent(key) {
  applyAccent(key);
  toast('🎨 ' + DH_THEMES[key].name + ' theme applied');
  openThemePicker();
}

function accentColor() {
  return (getComputedStyle(document.documentElement).getPropertyValue('--or') || '').trim() || '#FF4D00';
}

function goHome() {
  if (!S.profile) return;
  closeModal();
  showView({ customer: 'home', driver: 'available', admin: 'adash' }[S.profile.role] || 'home');
}

function goProfile() {
  showView(S.profile.role === 'driver' ? 'dprofile' : S.profile.role === 'admin' ? 'asettings' : 'profile');
}

// HELPERS
function fmtStatus(s) { return { pending: 'Pending', accepted: 'Accepted', picked_up: 'Picked Up', in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled' }[s] || s; }
function badgeCls(s) { return { pending: 'b-pending', accepted: 'b-accepted', picked_up: 'b-picked', in_transit: 'b-transit', delivered: 'b-delivered', cancelled: 'b-cancelled' }[s] || ''; }
function payLabel(p) { return { gpay: 'Google Pay', phonepe: 'PhonePe', paytm: 'Paytm', upi: 'UPI', card: 'Card', netbanking: 'Net Banking', cod: 'Cash on Delivery' }[p] || 'Cash'; }
function fmtTime(ts) { if (!ts) return ''; try { var d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function genId() { return 'ORD' + Math.random().toString(36).substring(2, 7).toUpperCase(); }
function toast(msg, dur) { dur = dur || 2500; var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(function() { t.classList.remove('show'); }, dur); }
function closeModal() { document.getElementById('modal-bg').classList.add('hidden'); if (S.chatUnsub) { try { S.chatUnsub(); } catch (e) { } S.chatUnsub = null; } }
function openModal(html) { document.getElementById('mc').innerHTML = html; document.getElementById('modal-bg').classList.remove('hidden'); }
function closeModalBg(e) { if (e.target === document.getElementById('modal-bg')) closeModal(); }
function reqNotif() { if (!('Notification' in window)) { toast('Not supported'); return; } Notification.requestPermission().then(function(p) { if (p === 'granted') { toast('Notifications enabled!'); } else toast('Notifications blocked'); }); }
function pushNotif(title, body) { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification(title, { body: body }); } catch (e) { } } }

function orderCard(o, fn) {
  return '<div class="order-card" onclick="' + fn + '">'
    + '<div class="oc-top"><div class="oc-id">#' + (o.orderId || o.id.substring(0, 8).toUpperCase()) + '</div><span class="badge ' + badgeCls(o.status) + '">' + fmtStatus(o.status) + '</span></div>'
    + '<div class="oc-route"><div style="display:flex;flex-direction:column;align-items:center"><div class="rd rd-from"></div><div class="rl"></div><div class="rd rd-to"></div></div>'
    + '<div><div class="ra">' + o.pickup + '</div><div class="ra" style="color:var(--mu);font-size:0.76rem;margin-top:3px">' + o.drop + '</div></div></div>'
    + '<div style="font-size:0.75rem;color:var(--mu);margin-bottom:0.3rem">' + (o.item || '') + '</div>'
    + '<div class="oc-bot"><div class="oc-price">Rs.' + o.price + '</div><div style="font-size:0.7rem;color:var(--mu)">' + fmtTime(o.createdAt) + '</div></div></div>';
}

// ═══ CUSTOMER - HOME ═══
function renderHome() {
  var el = document.getElementById('v-home');
  var hr = new Date().getHours();
  var greet = hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  el.innerHTML = '<div style="margin-bottom:1.2rem">'
    + '<div style="font-size:0.78rem;color:var(--mu)">' + greet + ',</div>'
    + '<div class="bb-xl">' + S.profile.name.split(' ')[0] + ' 👋</div></div>'
    + (Notification.permission !== 'granted' ? '<div class="notif-banner">🔔<div style="font-size:0.78rem;margin-left:0.3rem"><strong>Enable Notifications</strong><br><span style="color:var(--mu)">Get real-time updates</span></div><button onclick="reqNotif()">Allow</button></div>' : '')
    + '<div id="home-active"></div>'
    + '<div class="quick-actions">'
    + '<div class="qa-btn" onclick="openBooking()"><div class="qa-icon">📦</div><div class="qa-label">Book</div></div>'
    + '<div class="qa-btn" onclick="showView(\'track\')"><div class="qa-icon">📍</div><div class="qa-label">Track</div></div>'
    + '<div class="qa-btn" onclick="showView(\'orders\')"><div class="qa-icon">🧾</div><div class="qa-label">History</div></div>'
    + '<div class="qa-btn" onclick="showOffersModal()"><div class="qa-icon">🏷️</div><div class="qa-label">Offers</div></div></div>'
    + '<div class="promo-banner"><div style="font-size:1.8rem">🎉</div><div><div style="font-size:0.82rem;font-weight:700;color:var(--ye)">First order 20% OFF!</div><div style="font-size:0.7rem;color:var(--mu);margin-top:0.1rem">Use code <strong style="color:var(--ye)">FIRST20</strong></div></div></div>'
    + '<div class="stats-row"><div class="stat-card"><div class="stat-n" id="hs-total">0</div><div class="stat-l">Total Orders</div></div><div class="stat-card"><div class="stat-n" id="hs-done">0</div><div class="stat-l">Delivered</div></div></div>'
    + '<div class="sec-divider"><div class="sec-line"></div><div class="sec-txt">Recent Orders</div><div class="sec-line"></div></div>'
    + '<div id="home-orders"><div class="skel-wrap"><div class="skel skel-card"></div><div class="skel skel-card"></div></div></div>';

  var unsub = db.collection('orders').where('customerId', '==', S.user.uid).onSnapshot(function(snap) {
    var orders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }).sort(function(a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
    document.getElementById('hs-total').textContent = orders.length;
    document.getElementById('hs-done').textContent = orders.filter(function(o) { return o.status === 'delivered'; }).length;
    var active = orders.find(function(o) { return ['pending', 'accepted', 'picked_up', 'in_transit'].indexOf(o.status) > -1; });
    document.getElementById('home-active').innerHTML = active
      ? '<div class="card" style="border-color:rgba(var(--or-rgb),0.3);background:linear-gradient(135deg,rgba(var(--or-rgb),0.08),rgba(var(--or-rgb),0.02));cursor:pointer;margin-bottom:1rem" onclick="showView(\'track\')">'
      + '<div class="row" style="margin-bottom:0.5rem"><div style="display:flex;align-items:center;gap:0.4rem"><div class="pulse"></div><span style="font-size:0.7rem;font-weight:600;color:var(--or);text-transform:uppercase">Active Delivery</span></div><span class="badge ' + badgeCls(active.status) + '">' + fmtStatus(active.status) + '</span></div>'
      
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
    db.collection('users').doc(user.uid).get().then(function(doc) {
      if (doc.exists) {
        S.profile = Object.assign({ id: doc.id }, doc.data());
        showApp();
      } else {
        auth.signOut();
        showAuth();
      }
    }).catch(function() { showAuth(); });
  } else {
    S.user = null;
    S.profile = null;
    showAuth();
  }
});

function showApp() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('av-btn').textContent = S.profile.avatar || S.profile.name.charAt(0);
  buildNav();
  seedDemoUsers();
  seedPromoCodes();
  var first = { customer: 'home', driver: 'available', admin: 'adash' }[S.profile.role] || 'home';
  showView(first);
}

function showAuth() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
}

// SEED DEMO USERS (background, silent)
function seedDemoUsers() {
  var demos = [
    { email: 'customer@demo.com', pass: 'demo123', data: { name: 'Demo Customer', role: 'customer', avatar: 'DC', phone: '+91 98765 43210', joined: 'Jan 2026' } },
    { email: 'driver@demo.com', pass: 'demo123', data: { name: 'Marcus Driver', role: 'driver', avatar: 'MD', phone: '+91 87654 32109', joined: 'Dec 2025', online: true, rating: 4.9, deliveries: 128, earnings: 24500 } },
    { email: 'admin@demo.com', pass: 'admin123', data: { name: 'Admin User', role: 'admin', avatar: 'AU', phone: '+91 99999 00000', joined: 'Jan 2025' } }
  ];
  demos.forEach(function(d) {
    auth.createUserWithEmailAndPassword(d.email, d.pass).then(function(cred) {
      return db.collection('users').doc(cred.user.uid).set(Object.assign({}, d.data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
    }).catch(function() {});
  });
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
  var btn = document.getElementById('signup-btn');
  btn.disabled = true; btn.textContent = 'Creating...';
  auth.createUserWithEmailAndPassword(email, pass).then(function(cred) {
    var avatar = name.split(' ').map(function(x) { return x[0]; }).join('').substring(0, 2).toUpperCase();
    var data = { name: name, email: email, phone: phone, role: role, avatar: avatar, joined: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (role === 'driver') Object.assign(data, { online: false, rating: 5.0, deliveries: 0, earnings: 0 });
    return db.collection('users').doc(cred.user.uid).set(data);
  }).catch(function(e) {
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
    admin: [{ id: 'adash', icon: '📊', label: 'Dashboard' }, { id: 'aorders', icon: '📦', label: 'Orders' }, { id: 'adrivers', icon: '🚗', label: 'Drivers' }, { id: 'ausers', icon: '👥', label: 'Users' }]
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
  var renders = { home: renderHome, track: renderTrack, orders: renderOrders, profile: renderProfile, available: renderAvailable, myruns: renderMyRuns, earnings: renderEarnings, dprofile: renderDProfile, adash: renderAdash, aorders: renderAorders, adrivers: renderAdrivers, ausers: renderAusers };
  if (renders[v]) renders[v]();
}

function goProfile() {
  showView(S.profile.role === 'driver' ? 'dprofile' : S.profile.role === 'admin' ? 'adash' : 'profile');
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
    + '<div id="home-orders"><div style="text-align:center;padding:1.5rem;color:var(--mu)">Loading...</div></div>';

  var unsub = db.collection('orders').where('customerId', '==', S.user.uid).onSnapshot(function(snap) {
    var orders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }).sort(function(a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
    document.getElementById('hs-total').textContent = orders.length;
    document.getElementById('hs-done').textContent = orders.filter(function(o) { return o.status === 'delivered'; }).length;
    var active = orders.find(function(o) { return ['pending', 'accepted', 'picked_up', 'in_transit'].indexOf(o.status) > -1; });
    document.getElementById('home-active').innerHTML = active
      ? '<div class="card" style="border-color:rgba(255,77,0,0.3);background:linear-gradient(135deg,rgba(255,77,0,0.08),rgba(255,77,0,0.02));cursor:pointer;margin-bottom:1rem" onclick="showView(\'track\')">'
      + '<div class="row" style="margin-bottom:0.5rem"><div style="display:flex;align-items:center;gap:0.4rem"><div class="pulse"></div><span style="font-size:0.7rem;font-weight:600;color:var(--or);text-transform:uppercase">Active Delivery</span></div><span class="badge ' + badgeCls(active.status) + '">' + fmtStatus(active.status) + '</span></div>'
      + '<div style="font-size:0.9rem;font-weight:600;margin-bottom:0.3rem">' + active.item + '</div>'
      + '<div style="font-size:0.76rem;color:var(--mu)">' + active.pickup + ' → ' + active.drop + '</div>'
      + '<div style="margin-top:0.7rem;display:flex;align-items:center;gap:0.5rem"><span style="font-size:0.74rem;color:var(--mu)">ETA:</span><span style="font-weight:700;color:var(--or)">' + (active.eta || 'Calculating...') + '</span><span style="margin-left:auto;font-size:0.74rem;color:var(--bl);font-weight:600">Track Live →</span></div></div>' : '';
    document.getElementById('home-orders').innerHTML = orders.length
      ? orders.slice(0, 3).map(function(o) { return orderCard(o, "openOrderDetail('" + o.id + "')"); }).join('') + '<div style="height:1rem"></div>'
      : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders yet</div><button class="btn-full" style="max-width:200px;margin:1rem auto" onclick="openBooking()">Book Now</button></div>';
  });
  S.unsubs.push(unsub);
}

// ═══ CUSTOMER - TRACK ═══
function renderTrack() {
  var el = document.getElementById('v-track');
  el.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--mu)">Loading...</div>';
  var unsub = db.collection('orders').where('customerId', '==', S.user.uid).onSnapshot(function(snap) {
    var orders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    var active = orders.find(function(o) { return ['pending', 'accepted', 'picked_up', 'in_transit'].indexOf(o.status) > -1; });
    if (!active) {
      el.innerHTML = '<div style="padding-top:4rem"><div class="empty-state"><div class="empty-icon">📍</div><div class="empty-text" style="margin-bottom:1.2rem">No active deliveries</div><button class="btn-full" style="max-width:220px;margin:0 auto" onclick="openBooking()">Book a Delivery</button></div></div>';
      return;
    }
    var steps = ['pending', 'accepted', 'picked_up', 'in_transit', 'delivered'];
    var si = steps.indexOf(active.status);
    var labels = ['Placed', 'Assigned', 'Picked Up', 'In Transit', 'Delivered'];
    el.innerHTML = '<div class="bb-lg" style="margin-bottom:0.5rem">LIVE TRACKING</div>'
      + '<div style="display:inline-flex;align-items:center;padding:0.25rem 0.7rem;background:rgba(255,77,0,0.1);border:1px solid rgba(255,77,0,0.25);border-radius:100px;font-size:0.7rem;color:var(--or2);margin-bottom:1rem">Order #' + (active.orderId || active.id.substring(0, 8).toUpperCase()) + '</div>'
      + '<div id="live-map"></div>'
      + '<div class="card"><div class="row" style="margin-bottom:0.5rem"><span class="badge ' + badgeCls(active.status) + '">' + fmtStatus(active.status) + '</span><div class="bb" style="font-size:1.5rem;color:var(--or)">ETA ' + (active.eta || '--') + '</div></div>'
      + '<div class="progress-steps">' + steps.map(function(s, i) { return '<div class="prog-step ' + (i < si ? 'done' : i === si ? 'active' : '') + '"><div class="prog-dot">' + (i < si ? '✓' : i + 1) + '</div><div class="prog-lbl">' + labels[i] + '</div></div>'; }).join('') + '</div></div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:0.8rem">Package Details</div>'
      + '<div class="info-row"><span class="info-key">Item</span><span class="info-val">' + active.item + '</span></div>'
      + '<div class="info-row"><span class="info-key">From</span><span class="info-val">' + active.pickup + '</span></div>'
      + '<div class="info-row"><span class="info-key">To</span><span class="info-val">' + active.drop + '</span></div>'
      + '<div class="info-row"><span class="info-key">Price</span><span class="info-val" style="color:var(--or);font-weight:600">Rs.' + active.price + '</span></div>'
      + '<div class="info-row"><span class="info-key">Payment</span><span class="info-val">' + payLabel(active.payment) + '</span></div>'
      + (active.driverName ? '<div class="info-row"><span class="info-key">Driver</span><span class="info-val">' + active.driverName + ' ⭐ ' + (active.driverRating || 4.9) + '</span></div>' : '') + '</div>';
    setTimeout(function() { initMap(active); }, 150);
  });
  S.unsubs.push(unsub);
}

function initMap(order) {
  if (S.mapInst) { try { S.mapInst.remove(); } catch (e) { } S.mapInst = null; }
  var mapEl = document.getElementById('live-map');
  if (!mapEl) return;
  var from = order.pickupCoords || [28.6315, 77.2167];
  var to = order.dropCoords || [28.5672, 77.2352];
  var mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  var map = L.map('live-map', { zoomControl: true, attributionControl: false }).setView(mid, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
  S.mapInst = map;
  var fIcon = L.divIcon({ html: '<div style="background:#FF4D00;width:13px;height:13px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>', iconSize: [13, 13], className: '' });
  var tIcon = L.divIcon({ html: '<div style="background:#FFD000;width:13px;height:13px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>', iconSize: [13, 13], className: '' });
  var dIcon = L.divIcon({ html: '<div style="background:#0A0A0A;border:2px solid #FF4D00;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 2px 12px rgba(255,77,0,0.5)">🚗</div>', iconSize: [32, 32], iconAnchor: [16, 16], className: '' });
  L.marker(from, { icon: fIcon }).addTo(map);
  L.marker(to, { icon: tIcon }).addTo(map);
  L.polyline([from, to], { color: '#FF4D00', weight: 3, dashArray: '6 4', opacity: 0.5 }).addTo(map);
  var dM = L.marker(from, { icon: dIcon }).addTo(map);
  var prog = 0;
  S.trackTimer = setInterval(function() {
    prog = Math.min(prog + 1.5, 100);
    dM.setLatLng([from[0] + (to[0] - from[0]) * prog / 100, from[1] + (to[1] - from[1]) * prog / 100]);
  }, 500);
}

// ═══ CUSTOMER - ORDERS ═══
function renderOrders() {
  var el = document.getElementById('v-orders');
  el.innerHTML = '<div class="bb-lg" style="margin-bottom:1rem">MY ORDERS</div><div id="orders-list"><div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div></div>';
  var unsub = db.collection('orders').where('customerId', '==', S.user.uid).onSnapshot(function(snap) {
    var orders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }).sort(function(a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
    document.getElementById('orders-list').innerHTML = orders.length
      ? orders.map(function(o) { return orderCard(o, "openOrderDetail('" + o.id + "')"); }).join('') + '<div style="height:1rem"></div>'
      : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders yet</div></div>';
  });
  S.unsubs.push(unsub);
}

// ═══ ORDER DETAIL ═══
function openOrderDetail(id) {
  db.collection('orders').doc(id).get().then(function(doc) {
    if (!doc.exists) return;
    var o = Object.assign({ id: doc.id }, doc.data());
    var canRate = o.status === 'delivered' && !o.rated && o.customerId === S.user.uid;
    var canChat = ['accepted', 'picked_up', 'in_transit'].indexOf(o.status) > -1 && o.driverName;
    var html = '<div class="modal-title">Order #' + (o.orderId || o.id.substring(0, 8).toUpperCase()) + '</div>'
      + '<div class="row" style="margin-bottom:1rem"><span class="badge ' + badgeCls(o.status) + '">' + fmtStatus(o.status) + '</span><div class="bb" style="font-size:1.5rem;color:var(--or)">Rs.' + o.price + '</div></div>'
      + (canChat ? '<div style="background:rgba(255,77,0,0.06);border:1px solid rgba(255,77,0,0.2);border-radius:12px;padding:1rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.8rem;cursor:pointer" onclick="openChat(\'' + o.id + '\',\'' + (o.driverName || '') + '\')">'
        + '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--or),#c43200);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">🚗</div>'
        + '<div><div style="font-weight:600">' + o.driverName + '</div><div style="font-size:0.72rem;color:var(--mu)">⭐ ' + (o.driverRating || 4.9) + ' · Tap to Chat</div></div>'
        + '<div style="margin-left:auto;background:var(--or);border-radius:8px;padding:0.4rem 0.7rem;font-size:0.72rem;font-weight:600;color:white">💬 Chat</div></div>' : '')
      + '<div class="info-row"><span class="info-key">Item</span><span class="info-val">' + o.item + '</span></div>'
      + '<div class="info-row"><span class="info-key">From</span><span class="info-val">' + o.pickup + '</span></div>'
      + '<div class="info-row"><span class="info-key">To</span><span class="info-val">' + o.drop + '</span></div>'
      + '<div class="info-row"><span class="info-key">Weight</span><span class="info-val">' + o.weight + '</span></div>'
      + '<div class="info-row"><span class="info-key">Payment</span><span class="info-val">' + payLabel(o.payment) + '</span></div>'
      + '<div class="info-row"><span class="info-key">Booked</span><span class="info-val">' + fmtTime(o.createdAt) + '</span></div>'
      + (o.discount ? '<div class="info-row"><span class="info-key" style="color:var(--su)">Discount</span><span class="info-val" style="color:var(--su)">-Rs.' + o.discount + '</span></div>' : '')
      + (o.promoCode ? '<div class="info-row"><span class="info-key">Promo</span><span class="info-val" style="color:var(--ye)">' + o.promoCode + '</span></div>' : '')
      + (o.rated ? '<div class="info-row"><span class="info-key">Rating</span><span class="info-val">' + '⭐'.repeat(o.rating) + '</span></div>' : '')
      + (canRate ? '<div style="margin-top:1rem"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.6rem">Rate this delivery:</div><div class="stars">' + [1, 2, 3, 4, 5].map(function(i) { return '<span class="star" onclick="rateStar(' + i + ',\'' + id + '\')" onmouseover="hoverStar(' + i + ')" onmouseout="unhoverStar()">★</span>'; }).join('') + '</div></div>' : '')
      + '<div style="display:flex;gap:0.6rem;margin-top:1rem">'
      + (o.status === 'delivered' ? '<button class="btn-sm btn-blue" style="flex:1" onclick="openInvoice(\'' + o.id + '\')">🧾 Invoice</button>' : '')
      + (canChat ? '<button class="btn-sm btn-or" style="flex:1" onclick="openChat(\'' + o.id + '\',\'' + (o.driverName || '') + '\')">💬 Chat</button>' : '')
      + (o.status === 'pending' ? '<button class="btn-sm btn-red" style="flex:1" onclick="cancelOrder(\'' + id + '\')">Cancel</button>' : '')
      + '</div>';
    openModal(html);
  });
}

function hoverStar(n) { document.querySelectorAll('.star').forEach(function(s, i) { s.classList.toggle('lit', i < n); }); }
function unhoverStar() { document.querySelectorAll('.star').forEach(function(s, i) { s.classList.toggle('lit', i < S.selStar); }); }
function rateStar(n, id) {
  S.selStar = n;
  db.collection('orders').doc(id).update({ rated: true, rating: n }).then(function() { toast('Thanks for rating!'); closeModal(); });
}
function cancelOrder(id) {
  if (!confirm('Cancel this order?')) return;
  db.collection('orders').doc(id).update({ status: 'cancelled' }).then(function() { toast('Order cancelled'); closeModal(); });
}

// ═══ CHAT ═══
function openChat(orderId, otherName) {
  if (S.chatUnsub) { try { S.chatUnsub(); } catch (e) { } S.chatUnsub = null; }
  openModal('<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem">'
    + '<span style="font-size:1.4rem">💬</span>'
    + '<div><div style="font-size:1.1rem;font-weight:700">Chat with Driver</div><div style="font-size:0.72rem;color:var(--mu)">' + (otherName || 'Driver') + '</div></div></div>'
    + '<div class="chat-wrap"><div class="chat-msgs" id="chat-msgs"><div style="text-align:center;color:var(--mu);font-size:0.78rem;padding:1rem">Loading...</div></div>'
    + '<div class="chat-inp-row"><input id="chat-inp" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\')sendChat(\'' + orderId + '\')">'
    + '<button class="chat-send" onclick="sendChat(\'' + orderId + '\')">➤</button></div></div>');
  S.chatUnsub = db.collection('chats').doc(orderId).collection('messages').orderBy('createdAt', 'asc').onSnapshot(function(snap) {
    var msgs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    var c = document.getElementById('chat-msgs');
    if (!c) return;
    if (!msgs.length) { c.innerHTML = '<div style="text-align:center;color:var(--mu);font-size:0.78rem;padding:2rem">No messages yet. Say hello! 👋</div>'; return; }
    c.innerHTML = msgs.map(function(m) {
      var isMe = m.senderId === S.user.uid;
      var time = m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return '<div style="display:flex;flex-direction:column;align-items:' + (isMe ? 'flex-end' : 'flex-start') + '"><div class="bubble ' + (isMe ? 'bbl-me' : 'bbl-them') + '">' + m.text + '<span class="bbl-time">' + time + '</span></div></div>';
    }).join('');
    c.scrollTop = c.scrollHeight;
  });
}

function sendChat(orderId) {
  var inp = document.getElementById('chat-inp');
  if (!inp) return;
  var text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  db.collection('chats').doc(orderId).collection('messages').add({ text: text, senderId: S.user.uid, senderName: S.profile.name, senderRole: S.profile.role, createdAt: firebase.firestore.FieldValue.serverTimestamp(), read: false });
  db.collection('chats').doc(orderId).set({ lastMessage: text, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

// ═══ INVOICE ═══
function openInvoice(id) {
  db.collection('orders').doc(id).get().then(function(doc) {
    if (!doc.exists) return;
    var o = Object.assign({ id: doc.id }, doc.data());
    var invNo = 'INV-' + (o.orderId || o.id.substring(0, 8).toUpperCase());
    var date = o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    var tax = Math.round(o.price * 0.05);
    var base = o.price - tax;
    var disc = o.discount || 0;
    openModal('<div class="modal-title">🧾 Invoice</div>'
      + '<div class="inv-wrap">'
      + '<div class="inv-header"><div><div class="inv-logo">DELIVERY HUB</div><div style="font-size:0.65rem;color:#888;text-transform:uppercase;letter-spacing:0.1em">Tax Invoice</div><div style="font-size:0.7rem;color:#aaa;margin-top:0.2rem">' + invNo + '</div></div><div style="font-size:2rem">📦</div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem;font-size:0.75rem"><div><div style="color:#888;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em">Customer</div><div style="font-weight:600;margin-top:0.15rem">' + o.customerName + '</div></div><div><div style="color:#888;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em">Date</div><div style="font-weight:600;margin-top:0.15rem">' + date + '</div></div></div>'
      + '<div class="inv-row"><span style="color:#555">Item</span><span>' + o.item + '</span></div>'
      + '<div class="inv-row"><span style="color:#555">From</span><span style="text-align:right;max-width:55%;font-size:0.75rem">' + o.pickup + '</span></div>'
      + '<div class="inv-row"><span style="color:#555">To</span><span style="text-align:right;max-width:55%;font-size:0.75rem">' + o.drop + '</span></div>'
      + '<div class="inv-row"><span style="color:#555">Base Price</span><span>Rs.' + base + '</span></div>'
      + '<div class="inv-row"><span style="color:#555">GST (5%)</span><span>Rs.' + tax + '</span></div>'
      + (disc > 0 ? '<div class="inv-row" style="color:green"><span>Discount (' + (o.promoCode || '') + ')</span><span>-Rs.' + disc + '</span></div>' : '')
      + '<div class="inv-row"><span style="color:#555">Payment</span><span>' + payLabel(o.payment) + '</span></div>'
      + (o.driverName ? '<div class="inv-row"><span style="color:#555">Driver</span><span>' + o.driverName + '</span></div>' : '')
      + '<div class="inv-total"><span>Total Paid</span><span>Rs.' + o.price + '</span></div>'
      + '<div style="text-align:center;margin-top:0.8rem;font-size:0.65rem;color:#aaa">Thank you for choosing Delivery Hub!</div></div>'
      + '<button class="btn-full" onclick="window.print()">🖨️ Print Invoice</button>');
  });
}

// ═══ OFFERS MODAL ═══
function showOffersModal() {
  openModal('<div class="modal-title">🏷️ Available Offers</div>'
    + [{ code: 'FIRST20', title: '20% OFF', desc: 'First order discount - min Rs.100', color: '#FFD000' },
    { code: 'SAVE50', title: 'Rs.50 OFF', desc: 'Flat discount - min order Rs.200', color: '#22c55e' },
    { code: 'SPEED10', title: '10% OFF', desc: 'All deliveries, no minimum', color: '#3b82f6' },
    { code: 'NEW100', title: 'Rs.100 OFF', desc: 'Orders above Rs.500 only', color: '#8b5cf6' }
    ].map(function(p) {
      return '<div class="card" style="display:flex;align-items:center;gap:0.8rem;cursor:pointer;margin-bottom:0.6rem" onclick="copyPromo(\'' + p.code + '\')">'
        + '<div class="bb" style="width:56px;height:56px;border-radius:12px;background:rgba(255,77,0,0.08);display:flex;align-items:center;justify-content:center;font-size:0.85rem;color:' + p.color + ';text-align:center;line-height:1.2;flex-shrink:0">' + p.title + '</div>'
        + '<div style="flex:1"><div style="font-weight:600;font-size:0.88rem">' + p.code + '</div><div style="font-size:0.74rem;color:var(--mu);margin-top:0.15rem">' + p.desc + '</div></div>'
        + '<div style="font-size:0.72rem;color:var(--or);font-weight:600">Copy</div></div>';
    }).join('')
    + '<div style="font-size:0.72rem;color:var(--mu);text-align:center;margin-top:0.5rem">Apply codes during booking checkout</div>');
}
function copyPromo(code) { navigator.clipboard && navigator.clipboard.writeText(code).then(function() { toast('Copied: ' + code); }).catch(function() { toast('Code: ' + code); }); }

// ═══ PROMO VALIDATION ═══
function validatePromo(code, price, callback) {
  if (!code) { callback(null); return; }
  db.collection('promoCodes').doc(code.toUpperCase()).get().then(function(doc) {
    if (!doc.exists) { toast('Invalid promo code'); callback(null); return; }
    var p = doc.data();
    if (p.used >= p.maxUses) { toast('Promo code expired'); callback(null); return; }
    if (price < p.minOrder) { toast('Min order Rs.' + p.minOrder + ' required'); callback(null); return; }
    var disc = p.type === 'percent' ? Math.round(price * p.discount / 100) : p.discount;
    var final = Math.max(0, price - disc);
    toast('Saved Rs.' + disc + '!');
    callback({ code: code.toUpperCase(), discount: disc, finalPrice: final, desc: p.desc });
  }).catch(function() { toast('Error validating code'); callback(null); });
}

// ═══ BOOKING ═══
function openBooking() { S.bStep = 1; S.bData = {}; S.selPay = 'cod'; S.appliedPromo = null; renderBookingStep(); document.getElementById('modal-bg').classList.remove('hidden'); }

function renderBookingStep() {
  var mc = document.getElementById('mc');
  var steps = ['Package', 'Details', 'Payment'];
  var top = '<div class="modal-handle"></div><div class="modal-title">📦 BOOK DELIVERY</div>'
    + '<div class="step-dots">' + steps.map(function(_, i) { return '<div class="sdot ' + (i < S.bStep ? 'done' : '') + '"></div>'; }).join('') + '</div>'
    + '<div style="font-size:0.7rem;color:var(--mu);margin-bottom:1rem">Step ' + S.bStep + ' of 3 - ' + steps[S.bStep - 1] + '</div>';

  if (S.bStep === 1) {
    mc.innerHTML = top
      + '<div class="form-group"><label class="form-label">📍 Pickup Address</label><input class="form-input" id="b-from" placeholder="Where to pick up?" value="' + (S.bData.from || '') + '"></div>'
      + '<div class="form-group"><label class="form-label">🎯 Drop Address</label><input class="form-input" id="b-to" placeholder="Where to deliver?" value="' + (S.bData.to || '') + '"></div>'
      + '<div class="form-group"><label class="form-label">📦 Package Details</label><input class="form-input" id="b-item" placeholder="e.g. Documents, Electronics" value="' + (S.bData.item || '') + '"></div>'
      + '<button class="btn-full" onclick="bookStep1()">Next: Details →</button>';
  } else if (S.bStep === 2) {
    mc.innerHTML = top
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">'
      + '<div class="form-group"><label class="form-label">Weight</label><select class="form-select" id="b-weight" onchange="updatePrice()">' + ['< 1 kg', '1-3 kg', '3-5 kg', '5-10 kg'].map(function(w) { return '<option ' + (S.bData.weight === w ? 'selected' : '') + '>' + w + '</option>'; }).join('') + '</select></div>'
      + '<div class="form-group"><label class="form-label">Type</label><select class="form-select" id="b-type" onchange="updatePrice()">' + ['Standard', 'Express', 'Fragile'].map(function(t) { return '<option ' + (S.bData.type === t ? 'selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div></div>'
      + '<div class="card" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,77,0,0.06);border-color:rgba(255,77,0,0.2);margin-bottom:1rem">'
      + '<div><div style="font-size:0.72rem;color:var(--mu)">Estimated Price</div><div style="font-size:0.65rem;color:var(--mu)">Incl. 5% GST</div></div>'
      + '<div class="bb" style="font-size:2rem;color:var(--or)" id="b-price">Rs.' + (S.bData.price || 220) + '</div></div>'
      + '<div style="display:flex;gap:0.6rem"><button class="btn-outline" style="flex:1;margin-top:0" onclick="S.bStep=1;renderBookingStep()">← Back</button>'
      + '<button class="btn-full" style="flex:2;margin-top:0" onclick="bookStep2()">Next: Payment →</button></div>';
  } else if (S.bStep === 3) {
    S.appliedPromo = null;
    var pays = [{ id: 'gpay', icon: '🟢', name: 'Google Pay', sub: 'Instant UPI' }, { id: 'phonepe', icon: '💜', name: 'PhonePe', sub: 'PhonePe UPI' }, { id: 'paytm', icon: '💙', name: 'Paytm', sub: 'Paytm Wallet or UPI' }, { id: 'upi', icon: '⚡', name: 'Other UPI', sub: 'Any UPI app' }, { id: 'card', icon: '💳', name: 'Card', sub: 'Visa, Mastercard, RuPay' }, { id: 'cod', icon: '💵', name: 'Cash on Delivery', sub: 'Pay on arrival' }];
    mc.innerHTML = top
      + '<div style="font-size:0.8rem;font-weight:600;margin-bottom:0.8rem">Choose Payment</div>'
      + pays.map(function(p) {
        return '<div class="pay-opt ' + (S.selPay === p.id ? 'sel' : '') + '" onclick="selPay(\'' + p.id + '\')">'
          + '<div class="pay-logo">' + p.icon + '</div>'
          + '<div><div style="font-weight:600;font-size:0.85rem">' + p.name + '</div><div style="font-size:0.7rem;color:var(--mu)">' + p.sub + '</div></div>'
          + '<div class="pay-radio"></div></div>';
      }).join('')
      + '<div class="sec-divider"><div class="sec-line"></div><div class="sec-txt">Promo Code</div><div class="sec-line"></div></div>'
      + '<div class="promo-chips"><div class="promo-chip" onclick="chipPromo(\'FIRST20\')">FIRST20</div><div class="promo-chip" onclick="chipPromo(\'SAVE50\')">SAVE50</div><div class="promo-chip" onclick="chipPromo(\'SPEED10\')">SPEED10</div></div>'
      + '<div class="promo-inp-wrap"><input id="promo-inp" placeholder="ENTER CODE" maxlength="10"><button onclick="applyPromo()">Apply</button></div>'
      + '<div id="promo-res"></div>'
      + '<div class="card" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,77,0,0.06);border-color:rgba(255,77,0,0.2);margin:0.8rem 0">'
      + '<span style="color:var(--mu)">Total to Pay</span><div class="bb" style="font-size:1.8rem;color:var(--or)" id="final-price">Rs.' + S.bData.price + '</div></div>'
      + '<div style="display:flex;gap:0.6rem"><button class="btn-outline" style="flex:1;margin-top:0" onclick="S.bStep=2;renderBookingStep()">← Back</button>'
      + '<button class="btn-full" style="flex:2;margin-top:0" id="confirm-btn" onclick="confirmBooking()">✅ Confirm and Pay →</button></div>';
  }
}

function updatePrice() {
  var w = { '< 1 kg': 1, '1-3 kg': 2, '3-5 kg': 3, '5-10 kg': 5 }[document.getElementById('b-weight') && document.getElementById('b-weight').value] || 1;
  var t = { Standard: 0, Express: 100, Fragile: 50 }[document.getElementById('b-type') && document.getElementById('b-type').value] || 0;
  var el = document.getElementById('b-price');
  if (el) el.textContent = 'Rs.' + (100 + w * 60 + t);
}

function selPay(id) {
  S.selPay = id;
  document.querySelectorAll('.pay-opt').forEach(function(el) { el.classList.toggle('sel', el.getAttribute('onclick') === "selPay('" + id + "')"); });
}

function bookStep1() {
  var from = document.getElementById('b-from') && document.getElementById('b-from').value.trim();
  var to = document.getElementById('b-to') && document.getElementById('b-to').value.trim();
  var item = document.getElementById('b-item') && document.getElementById('b-item').value.trim();
  if (!from || !to || !item) { toast('Fill all fields'); return; }
  S.bData = Object.assign({}, S.bData, { from: from, to: to, item: item });
  S.bStep = 2; renderBookingStep();
}

function bookStep2() {
  var weight = document.getElementById('b-weight') && document.getElementById('b-weight').value || '< 1 kg';
  var type = document.getElementById('b-type') && document.getElementById('b-type').value || 'Standard';
  var priceEl = document.getElementById('b-price');
  var price = priceEl ? parseInt(priceEl.textContent.replace('Rs.', '')) : 220;
  S.bData = Object.assign({}, S.bData, { weight: weight, type: type, price: price });
  S.bStep = 3; renderBookingStep();
}

function chipPromo(code) { var inp = document.getElementById('promo-inp'); if (inp) inp.value = code; applyPromo(); }

function applyPromo() {
  var code = document.getElementById('promo-inp') && document.getElementById('promo-inp').value.trim() || '';
  if (!code) { toast('Enter a promo code'); return; }
  validatePromo(code, S.bData.price, function(result) {
    if (result) {
      S.appliedPromo = result;
      var res = document.getElementById('promo-res');
      if (res) res.innerHTML = '<div class="promo-ok">✅ Saved Rs.' + result.discount + '! ' + result.desc + '</div>';
      var fp = document.getElementById('final-price');
      if (fp) fp.textContent = 'Rs.' + result.finalPrice;
    }
  });
}

function confirmBooking() {
  var btn = document.getElementById('confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Booking...'; }
  var orderId = genId();
  var finalPrice = S.appliedPromo ? S.appliedPromo.finalPrice : S.bData.price;
  db.collection('orders').add({
    orderId: orderId, customerId: S.user.uid, customerName: S.profile.name, customerPhone: S.profile.phone || '',
    driverId: null, driverName: null, pickup: S.bData.from, drop: S.bData.to,
    pickupCoords: [28.6315, 77.2167], dropCoords: [28.5672, 77.2352],
    item: S.bData.item, weight: S.bData.weight, type: S.bData.type,
    price: finalPrice, originalPrice: S.bData.price,
    discount: S.appliedPromo ? S.appliedPromo.discount : 0,
    promoCode: S.appliedPromo ? S.appliedPromo.code : '',
    payment: S.selPay, status: 'pending', eta: 'Waiting for driver',
    rated: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    if (S.appliedPromo) db.collection('promoCodes').doc(S.appliedPromo.code).update({ used: firebase.firestore.FieldValue.increment(1) });
    closeModal(); toast('🎉 Order placed!' + (S.appliedPromo ? ' Saved Rs.' + S.appliedPromo.discount + '!' : ''));
    pushNotif('Order Placed!', 'Your order ' + orderId + ' is waiting for a driver.');
    S.appliedPromo = null;
    setTimeout(function() { showView('home'); }, 200);
  }).catch(function(e) {
    toast('Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm and Pay'; }
  });
}

// ═══ CUSTOMER - PROFILE ═══
function renderProfile() {
  var el = document.getElementById('v-profile');
  el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div>';
  db.collection('orders').where('customerId', '==', S.user.uid).get().then(function(snap) {
    var orders = snap.docs.map(function(d) { return d.data(); });
    var spent = orders.filter(function(o) { return o.status === 'delivered'; }).reduce(function(a, o) { return a + (o.price || 0); }, 0);
    el.innerHTML = '<div class="card" style="text-align:center"><div class="p-avatar">' + (S.profile.avatar || S.profile.name.charAt(0)) + '</div>'
      + '<div class="bb" style="font-size:1.6rem">' + S.profile.name + '</div>'
      + '<div style="font-size:0.78rem;color:var(--mu)">Customer · Joined ' + S.profile.joined + '</div></div>'
      + '<div class="stats-row"><div class="stat-card"><div class="stat-n">' + orders.length + '</div><div class="stat-l">Orders</div></div><div class="stat-card"><div class="stat-n">Rs.' + spent + '</div><div class="stat-l">Total Spent</div></div></div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:0.8rem">Account Info</div>'
      + '<div class="info-row"><span class="info-key">Email</span><span class="info-val">' + S.profile.email + '</span></div>'
      + '<div class="info-row"><span class="info-key">Phone</span><span class="info-val">' + (S.profile.phone || '--') + '</span></div>'
      + '<div class="info-row"><span class="info-key">Joined</span><span class="info-val">' + S.profile.joined + '</span></div></div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:0.8rem">Notifications</div>'
      + '<div class="toggle-row"><span>Push Notifications</span><button class="btn-sm btn-blue" onclick="reqNotif()">Enable</button></div>'
      + '<div class="toggle-row"><span>SMS Alerts</span><div class="toggle on" onclick="this.classList.toggle(\'on\')"></div></div></div>'
      + '<button class="btn-outline" onclick="doLogout()">Log Out</button>';
  });
}

// ═══ DRIVER - AVAILABLE ═══
function renderAvailable() {
  var el = document.getElementById('v-available');
  el.innerHTML = '<div class="row" style="margin-bottom:1rem"><div class="bb-lg" style="margin-bottom:0">AVAILABLE</div><div class="row-gap"><div style="font-size:0.75rem;color:var(--mu)">Online</div><div class="toggle ' + (S.profile.online ? 'on' : '') + '" id="online-tog" onclick="toggleOnline()"></div></div></div>'
    + '<div class="stats-row"><div class="stat-card"><div class="stat-n" id="as-pending">0</div><div class="stat-l">Pending</div></div><div class="stat-card"><div class="stat-n" id="as-done">0</div><div class="stat-l">Completed</div></div></div>'
    + '<div id="avail-list"><div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div></div>';

  var u1 = db.collection('orders').where('status', '==', 'pending').onSnapshot(function(snap) {
    var orders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }).sort(function(a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
    document.getElementById('as-pending').textContent = orders.length;
    document.getElementById('avail-list').innerHTML = orders.length
      ? orders.map(function(o) {
        return '<div class="order-card">'
          + '<div class="oc-top"><div class="oc-id">#' + (o.orderId || o.id.substring(0, 8).toUpperCase()) + ' · ' + (o.customerName || '') + '</div><span class="badge b-pending">Pending</span></div>'
          + '<div class="oc-route"><div style="display:flex;flex-direction:column;align-items:center"><div class="rd rd-from"></div><div class="rl"></div><div class="rd rd-to"></div></div>'
          + '<div><div class="ra">' + o.pickup + '</div><div class="ra" style="color:var(--mu);font-size:0.76rem;margin-top:3px">' + o.drop + '</div></div></div>'
          + '<div style="font-size:0.74rem;color:var(--mu);margin-bottom:0.8rem">' + (o.item || '') + ' · ' + (o.weight || '') + ' · ' + payLabel(o.payment) + '</div>'
          + '<div class="row"><div class="bb" style="font-size:1.6rem;color:var(--or)">Rs.' + o.price + '</div>'
          + '<div style="display:flex;gap:0.5rem"><button class="btn-sm btn-red" onclick="toast(\'Declined\')">Decline</button><button class="btn-sm btn-green" onclick="acceptOrder(\'' + o.id + '\')">Accept</button></div></div></div>';
      }).join('')
      : '<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-text">No pending orders right now</div></div>';
  });
  var u2 = db.collection('orders').where('driverId', '==', S.user.uid).where('status', '==', 'delivered').onSnapshot(function(snap) { document.getElementById('as-done').textContent = snap.size; });
  S.unsubs.push(u1, u2);
}

function toggleOnline() {
  var nv = !S.profile.online;
  S.profile.online = nv;
  db.collection('users').doc(S.user.uid).update({ online: nv });
  var t = document.getElementById('online-tog');
  if (t) t.classList.toggle('on', nv);
  toast(nv ? '🟢 You are now Online' : '⭕ You are now Offline');
}

function acceptOrder(id) {
  db.collection('orders').doc(id).update({ driverId: S.user.uid, driverName: S.profile.name, driverRating: S.profile.rating || 5.0, status: 'accepted', eta: 'Approx 18 mins' }).then(function() {
    toast('✅ Order accepted!');
    pushNotif('New Delivery!', 'You accepted an order!');
    showView('myruns');
  }).catch(function(e) { toast('Error: ' + e.message); });
}

// ═══ DRIVER - MY RUNS ═══
function renderMyRuns() {
  var el = document.getElementById('v-myruns');
  el.innerHTML = '<div class="bb-lg" style="margin-bottom:1rem">MY DELIVERIES</div><div id="runs-list"><div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div></div>';
  var unsub = db.collection('orders').where('driverId', '==', S.user.uid).onSnapshot(function(snap) {
    var orders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }).sort(function(a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
    var active = orders.filter(function(o) { return ['delivered', 'cancelled'].indexOf(o.status) === -1; });
    var done = orders.filter(function(o) { return o.status === 'delivered'; });
    var html = '';
    if (active.length) {
      html += '<div class="eyebrow" style="margin-bottom:0.6rem">ACTIVE (' + active.length + ')</div>';
      html += active.map(function(o) {
        return '<div class="order-card">'
          + '<div class="oc-top"><div class="oc-id">#' + (o.orderId || o.id.substring(0, 8).toUpperCase()) + '</div><span class="badge ' + badgeCls(o.status) + '">' + fmtStatus(o.status) + '</span></div>'
          + '<div class="oc-route"><div style="display:flex;flex-direction:column;align-items:center"><div class="rd rd-from"></div><div class="rl"></div><div class="rd rd-to"></div></div>'
          + '<div><div class="ra">' + o.pickup + '</div><div class="ra" style="color:var(--mu);font-size:0.76rem;margin-top:3px">' + o.drop + '</div></div></div>'
          + '<div style="font-size:0.74rem;color:var(--mu);margin-bottom:0.8rem">' + (o.item || '') + '</div>'
          + '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">'
          + (o.status === 'accepted' ? '<button class="btn-sm btn-blue" onclick="updateStatus(\'' + o.id + '\',\'picked_up\',0)">📦 Picked Up</button>' : '')
          + (o.status === 'picked_up' ? '<button class="btn-sm btn-or" onclick="updateStatus(\'' + o.id + '\',\'in_transit\',0)">🚗 In Transit</button>' : '')
          + (o.status === 'in_transit' ? '<button class="btn-sm btn-green" onclick="updateStatus(\'' + o.id + '\',\'delivered\',' + o.price + ')">✅ Delivered</button>' : '')
          + '<button class="btn-sm btn-blue" onclick="openChat(\'' + o.id + '\',\'' + (o.customerName || 'Customer') + '\')">💬 Chat</button>'
          + '</div></div>';
      }).join('');
    }
    if (done.length) {
      html += '<div class="eyebrow" style="margin:1rem 0 0.6rem">COMPLETED (' + done.length + ')</div>';
      html += done.slice(0, 10).map(function(o) {
        return '<div class="order-card" style="opacity:0.75"><div class="oc-top"><div class="oc-id">#' + (o.orderId || o.id.substring(0, 8).toUpperCase()) + '</div><span class="badge b-delivered">Delivered</span></div>'
          + '<div style="font-size:0.82rem;font-weight:500">' + (o.item || '') + '</div>'
          + '<div class="oc-bot"><div class="oc-price">Rs.' + o.price + '</div><div style="font-size:0.7rem;color:var(--mu)">' + fmtTime(o.createdAt) + '</div></div></div>';
      }).join('');
    }
    if (!orders.length) html = '<div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-text">No deliveries yet. Accept an order!</div></div>';
    document.getElementById('runs-list').innerHTML = html;
  });
  S.unsubs.push(unsub);
}

function updateStatus(id, status, price) {
  var updates = { status: status };
  if (status === 'picked_up') updates.eta = 'Approx 12 mins';
  if (status === 'in_transit') updates.eta = 'Approx 8 mins';
  if (status === 'delivered') { updates.eta = 'Delivered'; updates.deliveredAt = firebase.firestore.FieldValue.serverTimestamp(); }
  db.collection('orders').doc(id).update(updates).then(function() {
    if (status === 'delivered' && price) {
      db.collection('users').doc(S.user.uid).update({ deliveries: firebase.firestore.FieldValue.increment(1), earnings: firebase.firestore.FieldValue.increment(price) });
      S.profile.earnings = (S.profile.earnings || 0) + price;
      toast('✅ Delivered! Rs.' + price + ' earned!');
      pushNotif('Delivered!', 'Rs.' + price + ' added to earnings');
    } else {
      toast({ picked_up: '📦 Marked as Picked Up', in_transit: '🚗 Transit started' }[status] || 'Updated');
    }
  });
}

// ═══ DRIVER - EARNINGS ═══
function renderEarnings() {
  var el = document.getElementById('v-earnings');
  el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div>';
  db.collection('users').doc(S.user.uid).get().then(function(doc) {
    var me = Object.assign({}, S.profile, doc.data());
    el.innerHTML = '<div class="bb-lg" style="margin-bottom:1rem">EARNINGS</div>'
      + '<div class="card" style="background:linear-gradient(135deg,rgba(255,77,0,0.15),rgba(255,77,0,0.04));border-color:rgba(255,77,0,0.3);text-align:center;padding:2rem">'
      + '<div style="font-size:0.7rem;color:var(--mu);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:0.4rem">Total Earned</div>'
      + '<div class="bb" style="font-size:4rem;color:var(--or);line-height:1">Rs.' + (me.earnings || 0) + '</div>'
      + '<div style="font-size:0.78rem;color:var(--mu);margin-top:0.3rem">' + (me.deliveries || 0) + ' deliveries completed</div></div>'
      + '<div class="stats-row c3">'
      + '<div class="stat-card"><div class="stat-n" style="font-size:1.5rem">' + (me.deliveries || 0) + '</div><div class="stat-l">Trips</div></div>'
      + '<div class="stat-card"><div class="stat-n" style="font-size:1.5rem">' + (me.rating || 5.0) + '</div><div class="stat-l">Rating</div></div>'
      + '<div class="stat-card"><div class="stat-n" style="font-size:1.5rem">' + (me.online ? '🟢' : '⭕') + '</div><div class="stat-l">Status</div></div></div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:0.8rem">Payout Info</div>'
      + '<div class="info-row"><span class="info-key">Total Earned</span><span class="info-val" style="color:var(--or);font-weight:600">Rs.' + (me.earnings || 0) + '</span></div>'
      + '<div class="info-row"><span class="info-key">Total Trips</span><span class="info-val">' + (me.deliveries || 0) + '</span></div>'
      + '<div class="info-row"><span class="info-key">Rating</span><span class="info-val">' + (me.rating || 5.0) + ' ⭐</span></div>'
      + '<div class="info-row"><span class="info-key">Next Payout</span><span class="info-val" style="color:var(--su)">Every Monday</span></div></div>';
  });
}

// ═══ DRIVER - PROFILE ═══
function renderDProfile() {
  var el = document.getElementById('v-dprofile');
  db.collection('users').doc(S.user.uid).get().then(function(doc) {
    var me = Object.assign({}, S.profile, doc.data());
    el.innerHTML = '<div class="card" style="text-align:center"><div class="p-avatar">' + (me.avatar || me.name.charAt(0)) + '</div>'
      + '<div class="bb" style="font-size:1.6rem">' + me.name + '</div>'
      + '<div style="font-size:0.78rem;color:var(--mu)">Driver · ⭐ ' + (me.rating || 5.0) + '</div>'
      + '<div style="margin-top:0.5rem;display:flex;align-items:center;justify-content:center;gap:0.5rem"><div class="' + (me.online ? 'online' : 'offline') + '-dot"></div><span style="font-size:0.74rem;color:var(--mu)">' + (me.online ? 'Online' : 'Offline') + '</span></div></div>'
      + '<div class="stats-row c3"><div class="stat-card"><div class="stat-n" style="font-size:1.5rem">' + (me.deliveries || 0) + '</div><div class="stat-l">Trips</div></div>'
      + '<div class="stat-card"><div class="stat-n" style="font-size:1.5rem">' + (me.rating || 5.0) + '</div><div class="stat-l">Rating</div></div>'
      + '<div class="stat-card"><div class="stat-n" style="font-size:1.5rem">Rs.' + (me.earnings || 0) + '</div><div class="stat-l">Earned</div></div></div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:0.8rem">Account Info</div>'
      + '<div class="info-row"><span class="info-key">Email</span><span class="info-val">' + me.email + '</span></div>'
      + '<div class="info-row"><span class="info-key">Phone</span><span class="info-val">' + (me.phone || '--') + '</span></div>'
      + '<div class="info-row"><span class="info-key">Joined</span><span class="info-val">' + me.joined + '</span></div></div>'
      + '<button class="btn-outline" onclick="doLogout()">Log Out</button>';
  });
}

// ═══ ADMIN - DASHBOARD ═══
function renderAdash() {
  var el = document.getElementById('v-adash');
  el.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--mu)">Loading...</div>';
  Promise.all([db.collection('orders').get(), db.collection('users').get()]).then(function(results) {
    var orders = results[0].docs.map(function(d) { return d.data(); });
    var users = results[1].docs.map(function(d) { return d.data(); });
    var rev = orders.filter(function(o) { return o.status === 'delivered'; }).reduce(function(a, o) { return a + (o.price || 0); }, 0);
    el.innerHTML = '<div class="admin-header"><div><div class="bb" style="font-size:2rem;color:white">ADMIN PANEL</div><div style="font-size:0.74rem;opacity:0.7;color:white">Delivery Hub Control Center</div></div><div style="font-size:2rem">🛡️</div></div>'
      + '<div class="stats-row c3"><div class="stat-card"><div class="stat-n">' + orders.length + '</div><div class="stat-l">Orders</div></div>'
      + '<div class="stat-card"><div class="stat-n">' + users.filter(function(u) { return u.role === 'driver'; }).length + '</div><div class="stat-l">Drivers</div></div>'
      + '<div class="stat-card"><div class="stat-n">' + users.filter(function(u) { return u.role === 'customer'; }).length + '</div><div class="stat-l">Users</div></div></div>'
      + '<div class="stats-row"><div class="stat-card"><div class="stat-n">Rs.' + rev + '</div><div class="stat-l">Revenue</div></div>'
      + '<div class="stat-card"><div class="stat-n">' + orders.filter(function(o) { return o.status === 'pending'; }).length + '</div><div class="stat-l">Pending</div></div></div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:1rem">Order Breakdown</div>'
      + ['pending', 'accepted', 'in_transit', 'delivered', 'cancelled'].map(function(s) {
        var cnt = orders.filter(function(o) { return o.status === s; }).length;
        var pct = orders.length ? cnt / orders.length * 100 : 0;
        return '<div style="margin-bottom:0.8rem"><div class="row" style="margin-bottom:0.3rem"><span class="badge ' + badgeCls(s) + '">' + fmtStatus(s) + '</span><span style="font-size:0.78rem;color:var(--mu)">' + cnt + '</span></div><div class="earn-bar"><div class="earn-fill" style="width:' + pct + '%"></div></div></div>';
      }).join('') + '</div>'
      + '<div class="card"><div class="eyebrow" style="margin-bottom:0.8rem">Driver Status</div>'
      + users.filter(function(u) { return u.role === 'driver'; }).map(function(d) {
        return '<div class="row" style="padding:0.6rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
          + '<div class="row-gap"><div class="av-btn" style="border:none;width:32px;height:32px;font-size:0.75rem">' + (d.avatar || 'D') + '</div>'
          + '<div><div style="font-size:0.85rem;font-weight:500">' + d.name + '</div><div style="font-size:0.7rem;color:var(--mu)">' + (d.deliveries || 0) + ' trips · ⭐' + (d.rating || 5.0) + '</div></div></div>'
          + '<div style="display:flex;align-items:center;gap:0.4rem"><div class="' + (d.online ? 'online' : 'offline') + '-dot"></div><span style="font-size:0.7rem;color:var(--mu)">' + (d.online ? 'Online' : 'Offline') + '</span></div></div>';
      }).join('') + '</div>';
  });
}

// ═══ ADMIN - ALL ORDERS ═══
function renderAorders() {
  var el = document.getElementById('v-aorders');
  el.innerHTML = '<div class="bb-lg" style="margin-bottom:0.8rem">ALL ORDERS</div>'
    + '<div class="tab-row">' + ['all', 'pending', 'in_transit', 'delivered', 'cancelled'].map(function(s, i) {
      return '<button class="tab-btn ' + (i === 0 ? 'active' : '') + '" onclick="filterAO(\'' + s + '\',this)">' + (s === 'all' ? 'All' : fmtStatus(s)) + '</button>';
    }).join('') + '</div>'
    + '<div id="ao-list"><div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div></div>';
  var unsub = db.collection('orders').onSnapshot(function(snap) {
    window._aOrders = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }).sort(function(a, b) { return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0); });
    renderAOList('all');
  });
  S.unsubs.push(unsub);
}

function filterAO(s, btn) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderAOList(s);
}

function renderAOList(s) {
  var orders = window._aOrders || [];
  var filtered = s === 'all' ? orders : orders.filter(function(o) { return o.status === s; });
  document.getElementById('ao-list').innerHTML = filtered.length
    ? filtered.map(function(o) {
      var oid = o.id;
      return '<div class="order-card" onclick="adminDetail(\'' + oid + '\')">'
        + '<div class="oc-top"><div class="oc-id">#' + (o.orderId || oid.substring(0, 8).toUpperCase()) + ' · ' + (o.customerName || '') + '</div><span class="badge ' + badgeCls(o.status) + '">' + fmtStatus(o.status) + '</span></div>'
        + '<div style="font-size:0.82rem;font-weight:500;margin-bottom:0.3rem">' + (o.item || '') + '</div>'
        + '<div style="font-size:0.74rem;color:var(--mu);margin-bottom:0.5rem">' + (o.pickup || '') + ' → ' + (o.drop || '') + '</div>'
        + '<div class="oc-bot"><div class="oc-price">Rs.' + o.price + '</div><div style="font-size:0.7rem;color:var(--mu)">' + (o.driverName ? '🚗 ' + o.driverName : 'No driver') + '</div></div></div>';
    }).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders</div></div>';
}

function adminDetail(id) {
  var order = (window._aOrders || []).find(function(o) { return o.id === id; });
  if (!order) return;
  db.collection('users').where('role', '==', 'driver').get().then(function(snap) {
    var drivers = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    openModal('<div class="modal-title">Manage Order</div>'
      + '<div class="row" style="margin-bottom:1rem"><span class="badge ' + badgeCls(order.status) + '">' + fmtStatus(order.status) + '</span><div class="bb" style="font-size:1.5rem;color:var(--or)">Rs.' + order.price + '</div></div>'
      + '<div class="info-row"><span class="info-key">Customer</span><span class="info-val">' + (order.customerName || '') + '</span></div>'
      + '<div class="info-row"><span class="info-key">Item</span><span class="info-val">' + (order.item || '') + '</span></div>'
      + '<div class="info-row"><span class="info-key">From</span><span class="info-val">' + (order.pickup || '') + '</span></div>'
      + '<div class="info-row"><span class="info-key">To</span><span class="info-val">' + (order.drop || '') + '</span></div>'
      + '<div class="info-row"><span class="info-key">Payment</span><span class="info-val">' + payLabel(order.payment) + '</span></div>'
      + '<div class="info-row"><span class="info-key">Driver</span><span class="info-val">' + (order.driverName || 'Unassigned') + '</span></div>'
      + (order.status === 'pending' ? '<div style="margin-top:1rem"><label class="form-label">Assign Driver</label>'
        + '<select class="form-select" id="sel-dr"><option value="">-- Select --</option>' + drivers.map(function(d) { return '<option value="' + d.id + '">' + d.name + (d.online ? ' (Online)' : '') + '</option>'; }).join('') + '</select>'
        + '<button class="btn-full" style="margin-top:0.6rem" onclick="assignDr(\'' + id + '\')">Assign Driver</button></div>' : '')
      + (!['delivered', 'cancelled'].includes(order.status) ? '<div style="display:flex;gap:0.6rem;margin-top:0.8rem">'
        + '<button class="btn-sm btn-green" style="flex:1" onclick="adminUpd(\'' + id + '\',\'delivered\',' + (order.price || 0) + ',\'' + (order.driverId || '') + '\')">Mark Delivered</button>'
        + '<button class="btn-sm btn-red" style="flex:1" onclick="adminUpd(\'' + id + '\',\'cancelled\',0,\'\')">Cancel</button></div>' : ''));
  });
}

function assignDr(orderId) {
  var dId = document.getElementById('sel-dr') && document.getElementById('sel-dr').value;
  if (!dId) { toast('Select a driver'); return; }
  db.collection('users').doc(dId).get().then(function(doc) {
    var driver = doc.data();
    db.collection('orders').doc(orderId).update({ driverId: dId, driverName: driver.name, driverRating: driver.rating || 5.0, status: 'accepted', eta: 'Approx 20 mins' }).then(function() { closeModal(); toast('Driver assigned!'); });
  });
}

function adminUpd(id, status, price, dId) {
  db.collection('orders').doc(id).update({ status: status }).then(function() {
    if (status === 'delivered' && price && dId) {
      db.collection('users').doc(dId).update({ deliveries: firebase.firestore.FieldValue.increment(1), earnings: firebase.firestore.FieldValue.increment(price) });
    }
    closeModal(); toast('Status updated');
  });
}

// ═══ ADMIN - DRIVERS ═══
function renderAdrivers() {
  var el = document.getElementById('v-adrivers');
  el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div>';
  Promise.all([db.collection('users').where('role', '==', 'driver').get(), db.collection('orders').get()]).then(function(results) {
    var drivers = results[0].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    var orders = results[1].docs.map(function(d) { return d.data(); });
    el.innerHTML = '<div class="bb-lg" style="margin-bottom:1rem">DRIVERS (' + drivers.length + ')</div>'
      + (drivers.length ? drivers.map(function(d) {
        var cnt = orders.filter(function(o) { return o.driverId === d.id && o.status === 'delivered'; }).length;
        return '<div class="card"><div class="row" style="margin-bottom:0.8rem">'
          + '<div class="row-gap"><div class="av-btn" style="border:none">' + (d.avatar || 'D') + '</div><div><div style="font-weight:600">' + d.name + '</div><div style="font-size:0.72rem;color:var(--mu)">' + d.email + '</div></div></div>'
          + '<div style="display:flex;align-items:center;gap:0.4rem"><div class="' + (d.online ? 'online' : 'offline') + '-dot"></div><span style="font-size:0.7rem;color:var(--mu)">' + (d.online ? 'Online' : 'Offline') + '</span></div></div>'
          + '<div class="stats-row c3" style="margin-bottom:0">'
          + '<div class="card-sm" style="text-align:center"><div style="font-size:1.2rem;font-weight:700;color:var(--or)">' + cnt + '</div><div style="font-size:0.62rem;color:var(--mu)">Trips</div></div>'
          + '<div class="card-sm" style="text-align:center"><div style="font-size:1.2rem;font-weight:700;color:var(--ye)">' + (d.rating || 5.0) + '⭐</div><div style="font-size:0.62rem;color:var(--mu)">Rating</div></div>'
          + '<div class="card-sm" style="text-align:center"><div style="font-size:1.2rem;font-weight:700;color:var(--su)">Rs.' + (d.earnings || 0) + '</div><div style="font-size:0.62rem;color:var(--mu)">Earned</div></div></div></div>';
      }).join('') : '<div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-text">No drivers yet</div></div>');
  });
}

// ═══ ADMIN - USERS ═══
function renderAusers() {
  var el = document.getElementById('v-ausers');
  el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--mu)">Loading...</div>';
  Promise.all([db.collection('users').where('role', '==', 'customer').get(), db.collection('orders').get()]).then(function(results) {
    var customers = results[0].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    var orders = results[1].docs.map(function(d) { return d.data(); });
    el.innerHTML = '<div class="bb-lg" style="margin-bottom:1rem">CUSTOMERS (' + customers.length + ')</div>'
      + (customers.length ? customers.map(function(c) {
        var co = orders.filter(function(o) { return o.customerId === c.id; });
        var spent = co.filter(function(o) { return o.status === 'delivered'; }).reduce(function(a, o) { return a + (o.price || 0); }, 0);
        return '<div class="card"><div class="row">'
          + '<div class="row-gap"><div class="av-btn" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:none">' + (c.avatar || 'C') + '</div>'
          + '<div><div style="font-weight:600">' + c.name + '</div><div style="font-size:0.72rem;color:var(--mu)">' + c.email + '</div></div></div>'
          + '<div style="text-align:right"><div class="bb" style="font-size:1.3rem;color:var(--or)">Rs.' + spent + '</div><div style="font-size:0.65rem;color:var(--mu)">' + co.length + ' orders</div></div></div></div>';
      }).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No customers yet</div></div>');
  });
}

// ═══ NOTIFICATIONS ═══
function showNotifs() {
  document.getElementById('nb').textContent = '0';
  openModal('<div class="modal-title">🔔 Notifications</div>'
    + [{ icon: '📦', msg: 'Your order is In Transit - driver on the way', time: 'Just now' },
    { icon: '🏷️', msg: 'New offer! Use SAVE50 for Rs.50 off', time: '1 hour ago' },
    { icon: '✅', msg: 'Order delivered successfully', time: 'Yesterday' },
    { icon: '💰', msg: 'Payout of Rs.3,200 is processing', time: '2 days ago' }
    ].map(function(n) {
      return '<div class="row-gap" style="padding:0.8rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
        + '<div style="font-size:1.5rem;flex-shrink:0">' + n.icon + '</div>'
        + '<div><div style="font-size:0.84rem;font-weight:500">' + n.msg + '</div><div style="font-size:0.7rem;color:var(--mu);margin-top:0.2rem">' + n.time + '</div></div></div>';
    }).join(''));
}

// ═══ PWA ═══
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(function() { console.log('SW ready'); }).catch(function(e) { console.log('SW error:', e); });
}
var deferredPrompt;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault(); deferredPrompt = e;
  setTimeout(function() {
    if (document.getElementById('ib')) return;
    var b = document.createElement('div');
    b.id = 'ib';
    b.style.cssText = 'position:fixed;bottom:5.5rem;left:1rem;right:1rem;background:linear-gradient(145deg,#1c1c1c,#141414);border:1px solid rgba(255,77,0,0.3);border-radius:12px;padding:1rem;display:flex;align-items:center;gap:0.8rem;z-index:50;box-shadow:0 4px 24px rgba(0,0,0,0.4)';
    b.innerHTML = '<span style="font-size:1.8rem">📦</span><div style="flex:1"><div style="font-weight:600;font-size:0.88rem">Install Delivery Hub</div><div style="font-size:0.72rem;color:var(--mu)">Add to home screen</div></div><button onclick="installPWA()" style="background:var(--or);color:white;border:none;border-radius:8px;padding:0.5rem 1rem;font-weight:700;font-size:0.78rem;cursor:pointer">Install</button><button onclick="document.getElementById(\'ib\').remove()" style="background:transparent;border:none;color:var(--mu);font-size:1.2rem;cursor:pointer;padding:0.2rem">✕</button>';
    document.body.appendChild(b);
  }, 3000);
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(r) { deferredPrompt = null; document.getElementById('ib') && document.getElementById('ib').remove(); if (r.outcome === 'accepted') toast('App installed!'); });
}

// iOS hint
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) {
  setTimeout(function() {
    var h = document.createElement('div');
    h.style.cssText = 'position:fixed;bottom:5.5rem;left:1rem;right:1rem;background:linear-gradient(145deg,#1c1c1c,#141414);border:1px solid rgba(255,77,0,0.25);border-radius:12px;padding:1rem;z-index:50;text-align:center';
    h.innerHTML = '<div style="font-size:0.85rem;font-weight:600;margin-bottom:0.4rem">📱 Install on iPhone</div><div style="font-size:0.75rem;color:var(--mu)">Tap <strong style="color:white">Share</strong> then <strong style="color:white">Add to Home Screen</strong></div><button onclick="this.parentElement.remove()" style="margin-top:0.7rem;background:transparent;border:1px solid var(--mi);color:var(--mu);border-radius:6px;padding:0.3rem 1rem;font-size:0.75rem;cursor:pointer">Got it</button>';
    document.body.appendChild(h);
  }, 4000);
}

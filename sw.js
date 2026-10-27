const CACHE = 'dh-v1';
const FILES = ['/', '/index.html', '/app.js', '/manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if(e.request.method!=='GET') return; e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));return r;}).catch(()=>caches.match(e.request))); });
self.addEventListener('push', e => { const d=e.data?e.data.json():{title:'Delivery Hub',body:'Update!'}; e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/icon-192.png',vibrate:[200,100,200]})); });

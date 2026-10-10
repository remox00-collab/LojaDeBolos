// Service worker: recebe os avisos de novo pedido mesmo com o site fechado ou a tela bloqueada
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAih-EMMVt2W0zFLihFrxqMaPWCSXaYq1I",
  authDomain: "lojadebolos-a2b26.firebaseapp.com",
  projectId: "lojadebolos-a2b26",
  storageBucket: "lojadebolos-a2b26.firebasestorage.app",
  messagingSenderId: "666861439044",
  appId: "1:666861439044:web:6151ad78f75247d4869411"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Novo pedido — Doces & Cia', {
    body: d.body || 'Chegou um pedido novo.',
    icon: '/icon-192.png',
    tag: 'novo-pedido',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: { url: '/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow('/');
    })
  );
});

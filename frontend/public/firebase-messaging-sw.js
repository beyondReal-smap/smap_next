// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

// .env.local 파일과 동일한 값을 사용해야 합니다.
const firebaseConfig = {
  apiKey: "AIzaSyBKq515AfyN-oizndPdXBebBkcjTlI56qw",
  authDomain: "com-dmonster-smap.firebaseapp.com",
  projectId: "com-dmonster-smap",
  storageBucket: "com-dmonster-smap.firebasestorage.app",
  messagingSenderId: "283271180972",
  appId: "1:283271180972:web:6c8d4104b83f419403e509"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드에서 메시지를 처리하는 핸들러
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload,
  );
  
  // 알림 UI를 커스터마이징
  const notificationTitle = payload.notification?.title || '새로운 메시지';
  const notificationOptions = {
    body: payload.notification?.body || '중요한 알림이 도착했습니다.',
    icon: '/images/logo.png',
    badge: '/images/badge.png',
    tag: 'smap-notification',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: '열기'
      },
      {
        action: 'close',
        title: '닫기'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 알림 클릭됨:', event);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    // 메인 앱으로 이동
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

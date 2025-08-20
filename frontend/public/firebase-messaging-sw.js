// Firebase 서비스 워커 (백그라운드 메시지 처리용)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase 설정 (환경변수는 서비스워커에서 접근 불가하므로 하드코딩 필요)
const firebaseConfig = {
  apiKey: "AIzaSyBKq515AfyN-oizndPdXBebBkcjTlI56qw",
  authDomain: "com-dmonster-smap.firebaseapp.com", 
  projectId: "com-dmonster-smap",
  storageBucket: "com-dmonster-smap.firebasestorage.app",
  messagingSenderId: "283271180972",
  appId: "1:283271180972:web:6c8d4104b83f419403e509",
  measurementId: "G-1B733FGCQ5"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firebase Messaging 인스턴스 가져오기
const messaging = firebase.messaging();

// 백그라운드 메시지 처리
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'SMAP 알림';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '새로운 알림이 도착했습니다.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'smap-notification',
    requireInteraction: false,
    data: payload.data
  };

  // 브라우저 알림 표시
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 이벤트 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 알림 클릭:', event);
  
  event.notification.close();
  
  // 앱으로 이동
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 탭 열기
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

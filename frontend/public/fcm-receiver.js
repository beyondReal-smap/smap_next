// iOS에서 전달받은 FCM 토큰과 백그라운드 푸시 데이터를 처리하는 글로벌 함수
(function() {
  'use strict';

  // iOS에서 호출할 수 있는 글로벌 함수 정의
  window.receiveFCMToken = function(token) {
    console.log('[FCM Receiver] iOS로부터 FCM 토큰 수신:', token.substring(0, 50) + '...');

    // 토큰을 전역 변수에 저장
    window.nativeFCMToken = token;

    // FCM 토큰 서비스가 로드되어 있으면 즉시 처리
    if (window.fcmTokenService && typeof window.fcmTokenService.handleNativeToken === 'function') {
      window.fcmTokenService.handleNativeToken(token);
    }

    // 커스텀 이벤트 발생으로 다른 모듈에서 감지 가능
    window.dispatchEvent(new CustomEvent('nativeFCMTokenReceived', {
      detail: { token: token }
    }));

    console.log('[FCM Receiver] ✅ FCM 토큰 처리 완료');
  };

  // 백그라운드 푸시 데이터 수신 이벤트 리스너
  window.addEventListener('backgroundPushData', function(event) {
    console.log('[FCM Receiver] 🔄 백그라운드 푸시 데이터 수신:', event.detail);

    const { pushData, timestamp } = event.detail;

    // 백그라운드 푸시 데이터를 처리
    handleBackgroundPushData(pushData, timestamp);
  });

  // 큐에 저장된 FCM 메시지 수신 이벤트 리스너
  window.addEventListener('queuedFCMMessage', function(event) {
    console.log('[FCM Receiver] 📨 큐 FCM 메시지 수신:', event.detail);

    const { userInfo, timestamp } = event.detail;

    // 큐 메시지를 처리
    handleQueuedFCMMessage(userInfo, timestamp);
  });

  // 백그라운드 푸시 데이터 처리 함수
  function handleBackgroundPushData(pushData, timestamp) {
    console.log('[FCM Receiver] 🔄 백그라운드 푸시 데이터 처리 시작');

    try {
      const userInfo = pushData.userInfo || {};

      // 백그라운드 푸시 데이터를 애플리케이션에 알림
      if (window.fcmTokenService && typeof window.fcmTokenService.handleBackgroundPush === 'function') {
        window.fcmTokenService.handleBackgroundPush(userInfo, timestamp);
      } else {
        // 기본 처리 로직
        console.log('[FCM Receiver] 📨 백그라운드 푸시 데이터:', {
          title: userInfo.title,
          body: userInfo.body,
          eventUrl: userInfo.event_url,
          scheduleId: userInfo.schedule_id,
          timestamp: new Date(timestamp * 1000).toLocaleString()
        });

        // 사용자에게 알림 표시 (필요시)
        showBackgroundPushNotification(userInfo);
      }

      console.log('[FCM Receiver] ✅ 백그라운드 푸시 데이터 처리 완료');
    } catch (error) {
      console.error('[FCM Receiver] ❌ 백그라운드 푸시 데이터 처리 실패:', error);
    }
  }

  // 큐에 저장된 FCM 메시지 처리 함수
  function handleQueuedFCMMessage(userInfo, timestamp) {
    console.log('[FCM Receiver] 📨 큐 FCM 메시지 처리 시작');

    try {
      // 큐 메시지를 애플리케이션에 알림
      if (window.fcmTokenService && typeof window.fcmTokenService.handleQueuedMessage === 'function') {
        window.fcmTokenService.handleQueuedMessage(userInfo, timestamp);
      } else {
        // 기본 처리 로직
        console.log('[FCM Receiver] 📨 큐 FCM 메시지:', {
          title: userInfo.title || userInfo['title'],
          body: userInfo.body || userInfo['body'],
          timestamp: new Date(timestamp * 1000).toLocaleString()
        });
      }

      console.log('[FCM Receiver] ✅ 큐 FCM 메시지 처리 완료');
    } catch (error) {
      console.error('[FCM Receiver] ❌ 큐 FCM 메시지 처리 실패:', error);
    }
  }

  // 백그라운드 푸시 알림 표시 함수
  function showBackgroundPushNotification(userInfo) {
    console.log('[FCM Receiver] 📢 백그라운드 푸시 알림 표시');

    // 브라우저 알림 API를 사용하여 알림 표시 (선택적)
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = userInfo.title || '백그라운드 알림';
      const options = {
        body: userInfo.body || '',
        icon: '/favicon.ico',
        tag: 'background-push',
        data: userInfo
      };

      new Notification(title, options);
    }
  }

  // 페이지 로드 시 이미 토큰이 있는지 확인
  if (window.nativeFCMToken) {
    console.log('[FCM Receiver] 페이지 로드 시 기존 FCM 토큰 발견:', window.nativeFCMToken.substring(0, 50) + '...');
  }

  console.log('[FCM Receiver] 🔔 글로벌 FCM 수신기 초기화 완료');
  console.log('  ✅ FCM 토큰 수신 지원');
  console.log('  ✅ 백그라운드 푸시 데이터 처리 지원');
  console.log('  ✅ 큐 FCM 메시지 처리 지원');
})();

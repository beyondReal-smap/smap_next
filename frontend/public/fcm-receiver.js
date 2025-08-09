// iOS에서 전달받은 FCM 토큰을 처리하는 글로벌 함수
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

  // 페이지 로드 시 이미 토큰이 있는지 확인
  if (window.nativeFCMToken) {
    console.log('[FCM Receiver] 페이지 로드 시 기존 FCM 토큰 발견:', window.nativeFCMToken.substring(0, 50) + '...');
  }

  console.log('[FCM Receiver] 🔔 글로벌 FCM 토큰 수신기 초기화 완료');
})();

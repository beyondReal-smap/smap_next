                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        // iOS 네이티브 카카오 로그인 핸들러
export const handleKakaoLogin = async () => {
  console.log('💬 [KAKAO LOGIN] 카카오 로그인 시도');
  
  // 🚨 강력한 디버깅: 현재 환경 상태 확인
  const debugInfo = {
    hasWindow: typeof window !== 'undefined',
    hasWebkit: typeof window !== 'undefined' && !!window.webkit,
    hasMessageHandlers: typeof window !== 'undefined' && !!window.webkit?.messageHandlers,
    hasSmapIos: typeof window !== 'undefined' && !!window.webkit?.messageHandlers?.smapIos,
    availableHandlers: typeof window !== 'undefined' && window.webkit?.messageHandlers ? 
      Object.keys(window.webkit.messageHandlers) : [],
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timestamp: new Date().toISOString()
  };
  
  console.log('🔍 [KAKAO LOGIN DEBUG] 현재 환경 상태:', debugInfo);
  
  // 🚨 디버깅을 위한 alert (iOS WebView에서 확인 가능)
  if (typeof window !== 'undefined' && window.webkit?.messageHandlers) {
    const handlersCount = Object.keys(window.webkit.messageHandlers).length;
    const hasSmapIos = !!window.webkit.messageHandlers.smapIos;
    console.log(`🔍 [KAKAO LOGIN DEBUG] MessageHandlers 발견: ${handlersCount}개, smapIos: ${hasSmapIos ? '있음' : '없음'}`);
    
    // iOS WebView에서 확인하기 위한 alert
    console.log(`🔍 [KAKAO LOGIN DEBUG] MessageHandlers 발견: ${handlersCount}개, smapIos: ${hasSmapIos ? '있음' : '없음'}`);
    console.log(`🔍 [KAKAO LOGIN DEBUG] 핸들러 목록:`, Object.keys(window.webkit.messageHandlers));
    
    // 임시 alert (테스트용)
    alert(`카카오 로그인 디버그:\nHandlers: ${handlersCount}개\nsmapIos: ${hasSmapIos ? '있음' : '없음'}\n핸들러목록: ${Object.keys(window.webkit.messageHandlers).join(', ')}`);
  } else {
    console.log('🔍 [KAKAO LOGIN DEBUG] WebKit MessageHandlers 없음 - 웹 브라우저 환경');
    // 임시 alert (테스트용)
    alert('카카오 로그인: 웹 브라우저 환경 감지');
  }
  
  // iOS 네이티브 환경 확인
  if (typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
    console.log('💬 [KAKAO LOGIN] iOS 네이티브 환경 감지, 네이티브 카카오 로그인 호출');
    
    try {
      // iOS 네이티브 카카오 로그인 호출
      const message = {
        type: 'kakaoLogin',
        timestamp: Date.now(),
        source: 'kakao-login-handler'
      };
      
      console.log('📤 [KAKAO LOGIN] iOS로 메시지 전송 시도:', message);
      window.webkit.messageHandlers.smapIos.postMessage(message);
      console.log('✅ [KAKAO LOGIN] iOS 네이티브 카카오 로그인 요청 전송 완료');
      
      // 메시지 전송 확인 alert
      alert('카카오 로그인 메시지를 iOS로 전송했습니다!');
      
      // 🚨 테스트: 햅틱 피드백도 함께 전송해보기
      try {
        console.log('🧪 [TEST] 햅틱 피드백 테스트 전송');
        window.webkit.messageHandlers.smapIos.postMessage({
          type: 'haptic',
          param: 'success',
          timestamp: Date.now(),
          source: 'kakao-login-test'
        });
        console.log('✅ [TEST] 햅틱 피드백 테스트 전송 완료');
      } catch (error) {
        console.error('❌ [TEST] 햅틱 피드백 테스트 실패:', error);
      }
      
      // 네이티브 카카오 로그인 성공 콜백 등록
      (window as any).onNativeKakaoLoginSuccess = async (userInfo: any) => {
        console.log('💬 [KAKAO LOGIN] iOS 네이티브 카카오 로그인 성공:', userInfo);
        
        try {
          // 백엔드 API로 카카오 로그인 정보 전송
          const response = await fetch('/api/kakao-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: userInfo.accessToken,
              userInfo: userInfo
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            console.log('💬 [KAKAO LOGIN] 백엔드 인증 성공:', data);
            
            // 성공 햅틱 피드백
            if ((window as any).triggerHapticFeedback) {
              (window as any).triggerHapticFeedback('success');
            }
            
            // 신규회원/기존회원에 따른 분기 처리
            if (data.isNewUser) {
              console.log('💬 [KAKAO LOGIN] 신규회원 - 회원가입 페이지로 이동');
              
              // 소셜 로그인 데이터를 sessionStorage에 저장
              if (data.socialLoginData) {
                sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
              }
              
              // 회원가입 페이지로 이동
              window.location.href = '/register?social=kakao';
            } else {
              console.log('💬 [KAKAO LOGIN] 기존회원 - 홈으로 이동');
              
              // 홈으로 리다이렉트
              window.location.href = '/home';
            }
          } else {
            throw new Error(data.error || '카카오 로그인 실패');
          }
        } catch (error) {
          console.error('💬 [KAKAO LOGIN] 백엔드 인증 실패:', error);
          
          // 에러 햅틱 피드백
          if ((window as any).triggerHapticFeedback) {
            (window as any).triggerHapticFeedback('error');
          }
          
          // 에러 처리
          if ((window as any).showError) {
            (window as any).showError('카카오 로그인 처리 중 오류가 발생했습니다.');
          } else {
            alert('카카오 로그인 처리 중 오류가 발생했습니다: ' + (error as Error).message);
          }
        }
      };
      
      // 네이티브 카카오 로그인 에러 콜백 등록
      (window as any).onNativeKakaoLoginError = (error: any) => {
        console.error('💬 [KAKAO LOGIN] iOS 네이티브 카카오 로그인 실패:', error);
        
        // 에러 햅틱 피드백
        if ((window as any).triggerHapticFeedback) {
          (window as any).triggerHapticFeedback('error');
        }
        
        // 에러 처리
        if ((window as any).showError) {
          (window as any).showError('카카오 로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
        } else {
          alert('카카오 로그인에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
        }
      };
      
    } catch (error) {
      console.error('💬 [KAKAO LOGIN] iOS 네이티브 카카오 로그인 호출 실패:', error);
      
      // 네이티브 호출 실패 시 웹 SDK로 폴백
      console.log('💬 [KAKAO LOGIN] 웹 SDK로 폴백 시도');
      handleKakaoWebSDKLogin();
    }
  } else {
    console.log('💬 [KAKAO LOGIN] 웹 환경 감지, 웹 SDK 카카오 로그인 시도');
    handleKakaoWebSDKLogin();
  }
};

// 웹 SDK 카카오 로그인 (폴백)
const handleKakaoWebSDKLogin = async () => {
  console.log('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 시작');
  
  if (!(window as any).Kakao || !(window as any).Kakao.isInitialized()) {
    console.error('💬 [KAKAO LOGIN] 카카오 SDK가 초기화되지 않았습니다.');
    
    // 에러 햅틱 피드백
    if ((window as any).triggerHapticFeedback) {
      (window as any).triggerHapticFeedback('error');
    }
    
    if ((window as any).showError) {
      (window as any).showError('카카오 SDK가 로드되지 않았습니다.');
    } else {
      alert('카카오 SDK가 로드되지 않았습니다.');
    }
    return;
  }
  
  try {
    (window as any).Kakao.Auth.login({
      success: async (authObj: any) => {
        console.log('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 성공:', authObj);
        
        try {
          // 백엔드 API로 액세스 토큰 전송
          const response = await fetch('/api/kakao-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: authObj.access_token,
            }),
          });

          const data = await response.json();

          if (data.success) {
            console.log('💬 [KAKAO LOGIN] 백엔드 인증 성공:', data);
            
            // 성공 햅틱 피드백
            if ((window as any).triggerHapticFeedback) {
              (window as any).triggerHapticFeedback('success');
            }
            
            // 신규회원/기존회원에 따른 분기 처리
            if (data.isNewUser) {
              console.log('💬 [KAKAO LOGIN] 신규회원 - 회원가입 페이지로 이동');
              
              // 소셜 로그인 데이터를 sessionStorage에 저장
              if (data.socialLoginData) {
                sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
              }
              
              // 회원가입 페이지로 이동
              window.location.href = '/register?social=kakao';
            } else {
              console.log('💬 [KAKAO LOGIN] 기존회원 - 홈으로 이동');
              
              // 홈으로 리다이렉트
              window.location.href = '/home';
            }
          } else {
            throw new Error(data.error || '카카오 로그인 실패');
          }
        } catch (error) {
          console.error('💬 [KAKAO LOGIN] 백엔드 인증 실패:', error);
          
          // 에러 햅틱 피드백
          if ((window as any).triggerHapticFeedback) {
            (window as any).triggerHapticFeedback('error');
          }
          
          if ((window as any).showError) {
            (window as any).showError('카카오 로그인 처리 중 오류가 발생했습니다.');
          } else {
            alert('카카오 로그인 처리 중 오류가 발생했습니다: ' + (error as Error).message);
          }
        }
      },
      fail: (error: any) => {
        console.error('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 실패:', error);
        
        // 에러 햅틱 피드백
        if ((window as any).triggerHapticFeedback) {
          (window as any).triggerHapticFeedback('error');
        }
        
        if ((window as any).showError) {
          (window as any).showError('카카오 로그인에 실패했습니다.');
        } else {
          alert('카카오 로그인에 실패했습니다.');
        }
      },
    });
  } catch (error) {
    console.error('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 오류:', error);
    
    // 에러 햅틱 피드백
    if ((window as any).triggerHapticFeedback) {
      (window as any).triggerHapticFeedback('error');
    }
    
    if ((window as any).showError) {
      (window as any).showError('카카오 로그인 중 오류가 발생했습니다.');
    } else {
      alert('카카오 로그인 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  }
}; 
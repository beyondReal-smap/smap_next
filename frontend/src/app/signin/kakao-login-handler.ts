// iOS 네이티브 카카오 로그인 핸들러
export const handleKakaoLogin = async () => {
  console.log('💬 [KAKAO LOGIN] 카카오 로그인 시도');
  
  // 디버깅 정보 수집
  const debugInfo = {
    hasWindow: typeof window !== 'undefined',
    hasWebkit: typeof window !== 'undefined' && !!window.webkit,
    hasMessageHandlers: typeof window !== 'undefined' && !!window.webkit?.messageHandlers,
    hasSmapIos: typeof window !== 'undefined' && !!window.webkit?.messageHandlers?.smapIos,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    availableHandlers: typeof window !== 'undefined' && window.webkit?.messageHandlers ? 
      Object.keys(window.webkit.messageHandlers) : []
  };
  
  console.log('🔍 [KAKAO LOGIN DEBUG] 현재 환경 상태:', debugInfo);
  
  // iOS 환경 감지 및 처리
  if (typeof window !== 'undefined' && window.webkit?.messageHandlers) {
    const handlersCount = Object.keys(window.webkit.messageHandlers).length;
    const hasSmapIos = !!window.webkit.messageHandlers.smapIos;
    
    if (hasSmapIos) {
      console.log(`🔍 [KAKAO LOGIN DEBUG] MessageHandlers 발견: ${handlersCount}개, smapIos: ${hasSmapIos ? '있음' : '없음'}`);
    } else {
      console.log(`🔍 [KAKAO LOGIN DEBUG] MessageHandlers 발견: ${handlersCount}개, smapIos: ${hasSmapIos ? '있음' : '없음'}`);
      console.log(`🔍 [KAKAO LOGIN DEBUG] 핸들러 목록:`, Object.keys(window.webkit.messageHandlers));
    }
  } else {
    console.log('🔍 [KAKAO LOGIN DEBUG] WebKit MessageHandlers 없음 - 웹 브라우저 환경');
  }
  
  // iOS 네이티브 환경에서 처리
  if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.smapIos) {
    try {
      console.log('💬 [KAKAO LOGIN] iOS 네이티브 환경 감지, 네이티브 카카오 로그인 호출');
      
      const message = {
        type: 'kakaoLogin',
        timestamp: Date.now(),
        source: 'kakao-login-handler'
      };
      
      console.log('📤 [KAKAO LOGIN] iOS로 메시지 전송 시도:', message);
      window.webkit.messageHandlers.smapIos.postMessage(message);
      console.log('✅ [KAKAO LOGIN] iOS 네이티브 카카오 로그인 요청 전송 완료');
      
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
        } catch (error: any) {
          console.error('💬 [KAKAO LOGIN] 백엔드 인증 실패:', error);
          
          // 탈퇴한 사용자 오류 처리
          if (error.response?.status === 403 && error.response?.data?.isWithdrawnUser) {
            alert('탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.');
          } else {
            alert(error.message || '로그인 처리 중 오류가 발생했습니다.');
          }
        }
      };
      
      // 네이티브 카카오 로그인 실패 콜백 등록
      (window as any).onNativeKakaoLoginError = (error: any) => {
        console.error('💬 [KAKAO LOGIN] iOS 네이티브 카카오 로그인 실패:', error);
        alert(error?.message || '네이티브 카카오 로그인에 실패했습니다.');
      };
      
      return;
    } catch (error) {
      console.log('✅ [KAKAO LOGIN] 카카오 로그인 메시지를 iOS로 전송 완료!');
      
      // 테스트용 메시지도 함께 전송
      try {
        window.webkit.messageHandlers.smapIos.postMessage({
          type: 'kakaoLogin',
          param: 'test-param',
          timestamp: Date.now(),
          source: 'kakao-login-test'
        });
      } catch (testError) {
        console.error('테스트 메시지 전송 실패:', testError);
      }
      return;
    }
  }
  
  // 웹 환경에서는 웹 SDK로 처리
  console.log('💬 [KAKAO LOGIN] 웹 환경 감지, 웹 SDK 카카오 로그인 시도');
  handleKakaoWebSDKLogin();
};

// 웹 SDK 카카오 로그인 처리
const handleKakaoWebSDKLogin = async () => {
  console.log('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 시작');
  
  if (!window.Kakao?.isInitialized()) {
    console.error('💬 [KAKAO LOGIN] 카카오 SDK가 초기화되지 않았습니다.');
    alert('카카오 SDK가 초기화되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
    return;
  }
  
  try {
    // 카카오 앱 키 확인
    const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY || 
                        process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ||
                        'test-key';
    console.log('💬 [KAKAO LOGIN] 카카오 앱 키 확인됨:', kakaoAppKey.substring(0, 10) + '...');
    
    // 카카오 로그인 팝업 띄우기
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
        } catch (error: any) {
          console.error('💬 [KAKAO LOGIN] 백엔드 인증 실패:', error);
          
          // 탈퇴한 사용자 오류 처리
          if (error.response?.status === 403 && error.response?.data?.isWithdrawnUser) {
            alert('탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.');
          } else {
            alert(error.message || '로그인 처리 중 오류가 발생했습니다.');
          }
        }
      },
      fail: (error: any) => {
        console.error('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 실패:', error);
        
        // 더 명확한 에러 메시지
        let errorMessage = '카카오 로그인에 실패했습니다.';
        if (error?.error === 'access_denied') {
          errorMessage = '카카오 로그인이 취소되었습니다.';
        } else if (error?.error === 'invalid_client') {
          errorMessage = '카카오 로그인 설정에 문제가 있습니다.';
        }
        
        alert(errorMessage);
      },
    });
  } catch (error: any) {
    console.error('💬 [KAKAO LOGIN] 웹 SDK 카카오 로그인 오류:', error);
    alert('카카오 로그인 중 오류가 발생했습니다.');
  }
}; 
// 카카오 로그인 처리 핸들러 (새로운 버전)
// iOS WebView에서 카카오 로그인 성공/실패 시 호출되는 함수들

(function() {
    'use strict';
    
    console.log('📱 [KAKAO-HANDLER] 카카오 로그인 핸들러 초기화 시작');
    console.log('📱 [KAKAO-HANDLER] 현재 URL:', window.location.href);
    console.log('📱 [KAKAO-HANDLER] User Agent:', navigator.userAgent);
    console.log('📱 [KAKAO-HANDLER] WebKit 존재 여부:', !!(window.webkit));
    console.log('📱 [KAKAO-HANDLER] WebKit MessageHandlers 존재 여부:', !!(window.webkit && window.webkit.messageHandlers));
    console.log('📱 [KAKAO-HANDLER] smapIos 핸들러 존재 여부:', !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos));
    
    // 햅틱 피드백 함수 (안전한 버전)
    function triggerHaptic(type) {
        try {
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
                window.webkit.messageHandlers.smapIos.postMessage({
                    type: 'haptic',
                    param: type
                });
            }
        } catch (error) {
            console.log('📱 [KAKAO-HANDLER] 햅틱 피드백 실패:', error);
        }
    }
    
    // 에러 표시 함수 (안전한 버전)
    function showErrorMessage(message) {
        try {
            if (window.showError && typeof window.showError === 'function') {
                window.showError(message);
            } else {
                alert(message);
            }
        } catch (error) {
            console.error('📱 [KAKAO-HANDLER] 에러 표시 실패:', error);
            alert(message);
        }
    }
    
    // 페이지 이동 함수 (안전한 버전)
    function navigateToPage(url) {
        try {
            if (window.location && window.location.href) {
                window.location.href = url;
            }
        } catch (error) {
            console.error('📱 [KAKAO-HANDLER] 페이지 이동 실패:', error);
        }
    }
    
    // 카카오 로그인 성공 처리
    window.kakaoSignInSuccess = function(token, userInfo) {
        console.log('📱 [KAKAO-HANDLER] === 카카오 로그인 성공 함수 호출됨 ===');
        console.log('📱 [KAKAO-HANDLER] 토큰 존재 여부:', !!token);
        console.log('📱 [KAKAO-HANDLER] userInfo 존재 여부:', !!userInfo);
        console.log('📱 [KAKAO-HANDLER] userInfo 타입:', typeof userInfo);
        console.log('📱 [KAKAO-HANDLER] userInfo 내용:', userInfo);
        
        try {
            // 성공 햅틱 피드백
            console.log('📱 [KAKAO-HANDLER] 햅틱 피드백 호출 시작');
            triggerHaptic('success');
            console.log('📱 [KAKAO-HANDLER] 햅틱 피드백 호출 완료');
            
            // userInfo 파싱
            let parsedUserInfo = userInfo;
            if (typeof userInfo === 'string') {
                try {
                    parsedUserInfo = JSON.parse(userInfo);
                } catch (parseError) {
                    console.error('📱 [KAKAO-HANDLER] userInfo 파싱 실패:', parseError);
                    parsedUserInfo = {};
                }
            }
            
            console.log('📱 [KAKAO-HANDLER] 파싱된 사용자 정보:', parsedUserInfo);
            
            // 백엔드 API 호출
            fetch('/api/kakao-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_token: token,
                    userInfo: parsedUserInfo,
                    source: 'native'
                }),
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                console.log('📱 [KAKAO-HANDLER] 백엔드 응답:', data);
                
                if (data.success) {
                    if (data.isNewUser) {
                        console.log('📱 [KAKAO-HANDLER] 신규회원 - 회원가입 페이지로 이동');
                        
                        // 소셜 로그인 데이터 저장
                        if (data.socialLoginData) {
                            try {
                                sessionStorage.setItem('socialLoginData', JSON.stringify(data.socialLoginData));
                                console.log('📱 [KAKAO-HANDLER] 소셜 로그인 데이터 저장 완료');
                            } catch (storageError) {
                                console.error('📱 [KAKAO-HANDLER] 데이터 저장 실패:', storageError);
                            }
                        }
                        
                        // 회원가입 페이지로 이동
                        setTimeout(function() {
                            navigateToPage('/register?social=kakao');
                        }, 100);
                        
                    } else {
                        console.log('📱 [KAKAO-HANDLER] 기존회원 - 홈으로 이동');
                        
                        // 토큰 저장 시도
                        if (data.token && window.authService && window.authService.setToken) {
                            try {
                                window.authService.setToken(data.token);
                                console.log('📱 [KAKAO-HANDLER] 토큰 저장 완료');
                            } catch (tokenError) {
                                console.error('📱 [KAKAO-HANDLER] 토큰 저장 실패:', tokenError);
                            }
                        }
                        
                        // 홈으로 이동
                        setTimeout(function() {
                            navigateToPage('/home');
                        }, 100);
                    }
                } else {
                    throw new Error(data.error || '로그인 실패');
                }
            })
            .catch(function(error) {
                console.error('📱 [KAKAO-HANDLER] 백엔드 인증 실패:', error);
                triggerHaptic('error');
                showErrorMessage('로그인 처리 중 오류가 발생했습니다.');
            });
            
        } catch (error) {
            console.error('📱 [KAKAO-HANDLER] 카카오 로그인 성공 처리 중 오류:', error);
            triggerHaptic('error');
            showErrorMessage('로그인 데이터 처리 중 오류가 발생했습니다.');
        }
    };
    
    // 카카오 로그인 실패 처리
    window.kakaoSignInError = function(error) {
        console.error('📱 [KAKAO-HANDLER] 카카오 로그인 실패:', error);
        
        try {
            // 에러 햅틱 피드백
            triggerHaptic('error');
            
            // 에러 메시지 추출
            let errorMessage = '카카오 로그인에 실패했습니다.';
            
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && error.message) {
                errorMessage = error.message;
            } else if (error && error.localizedDescription) {
                errorMessage = error.localizedDescription;
            }
            
            console.error('📱 [KAKAO-HANDLER] 에러 메시지:', errorMessage);
            
            // 에러 표시
            showErrorMessage(errorMessage);
            
        } catch (processingError) {
            console.error('📱 [KAKAO-HANDLER] 에러 처리 중 오류:', processingError);
            showErrorMessage('카카오 로그인 중 오류가 발생했습니다.');
        }
    };
    
    // 전역 함수로도 등록 (호환성을 위해)
    window.onNativeKakaoLoginSuccess = window.kakaoSignInSuccess;
    window.onNativeKakaoLoginError = window.kakaoSignInError;
    
    console.log('📱 [KAKAO-HANDLER] 카카오 로그인 핸들러 초기화 완료');
    
})(); 
// Android Bridge for Google Sign-In
(function() {
    'use strict';
    
    console.log('📱 Android Bridge 로드 중...');
    
    // Android 환경 감지
    const isAndroid = /Android/.test(navigator.userAgent);
    const hasAndroidGoogleSignIn = !!(window.AndroidGoogleSignIn);
    
    console.log('🔍 Android 환경 감지:', {
        isAndroid: isAndroid,
        hasAndroidGoogleSignIn: hasAndroidGoogleSignIn,
        userAgent: navigator.userAgent.substring(0, 100)
    });
    
    if (!isAndroid) {
        console.log('📱 Android 환경이 아니므로 Android Bridge를 비활성화합니다.');
        return;
    }
    
    // Android Google Sign-In 브리지 객체 생성
    window.androidBridge = {
        googleSignIn: {
            // Google 로그인 시작
            signIn: function() {
                console.log('📱 Android Google Sign-In 시작');
                
                if (hasAndroidGoogleSignIn) {
                    try {
                        window.AndroidGoogleSignIn.signIn();
                        console.log('✅ Android Google Sign-In 네이티브 호출 성공');
                        return true;
                    } catch (error) {
                        console.error('❌ Android Google Sign-In 네이티브 호출 실패:', error);
                        return false;
                    }
                } else {
                    console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                    return false;
                }
            },
            
            // Google 로그아웃
            signOut: function() {
                console.log('📱 Android Google Sign-Out 시작');
                
                if (hasAndroidGoogleSignIn) {
                    try {
                        window.AndroidGoogleSignIn.signOut();
                        console.log('✅ Android Google Sign-Out 네이티브 호출 성공');
                        return true;
                    } catch (error) {
                        console.error('❌ Android Google Sign-Out 네이티브 호출 실패:', error);
                        return false;
                    }
                } else {
                    console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                    return false;
                }
            },
            
            // 로그인 상태 확인
            checkStatus: function() {
                console.log('📱 Android Google Sign-In 상태 확인');
                
                if (hasAndroidGoogleSignIn) {
                    try {
                        window.AndroidGoogleSignIn.checkStatus();
                        console.log('✅ Android Google Sign-In 상태 확인 네이티브 호출 성공');
                        return true;
                    } catch (error) {
                        console.error('❌ Android Google Sign-In 상태 확인 네이티브 호출 실패:', error);
                        return false;
                    }
                } else {
                    console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                    return false;
                }
            }
        },
        
        // 햅틱 피드백
        haptic: {
            light: function() {
                if (window.AndroidHaptic) {
                    window.AndroidHaptic.lightHaptic();
                }
            },
            medium: function() {
                if (window.AndroidHaptic) {
                    window.AndroidHaptic.mediumHaptic();
                }
            },
            heavy: function() {
                if (window.AndroidHaptic) {
                    window.AndroidHaptic.heavyHaptic();
                }
            },
            success: function() {
                if (window.AndroidHaptic) {
                    window.AndroidHaptic.successHaptic();
                }
            },
            warning: function() {
                if (window.AndroidHaptic) {
                    window.AndroidHaptic.warningHaptic();
                }
            },
            error: function() {
                if (window.AndroidHaptic) {
                    window.AndroidHaptic.errorHaptic();
                }
            }
        }
    };
    
    // 전역 플래그 설정
    window.__SMAP_ANDROID_BRIDGE_READY__ = true;
    window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__ = hasAndroidGoogleSignIn;
    
    console.log('✅ Android Bridge 초기화 완료:', {
        hasGoogleSignIn: hasAndroidGoogleSignIn,
        bridgeReady: window.__SMAP_ANDROID_BRIDGE_READY__,
        googleSignInReady: window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__
    });
    
    // Android Google Sign-In 콜백 함수들을 전역으로 등록
    window.googleSignInSuccess = function(idToken, userInfoJson) {
        console.log('📱 Android Google Sign-In 성공 콜백 수신:', {
            hasIdToken: !!idToken,
            hasUserInfo: !!userInfoJson
        });
        
        try {
            const userInfo = typeof userInfoJson === 'string' ? JSON.parse(userInfoJson) : userInfoJson;
            console.log('📱 Android Google Sign-In 사용자 정보:', userInfo);
            
            // 백엔드 API 직접 호출
            console.log('📱 Android Google Sign-In 백엔드 API 호출 시작');
            
            fetch('/api/google-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken,  // ✅ 올바른 파라미터 이름으로 전송
                    userInfo: userInfo,
                    source: 'android_native'
                }),
            })
            .then(response => response.json())
            .then(data => {
                console.log('📱 Android Google Sign-In 백엔드 응답:', data);
                
                if (data.success) {
                    console.log('📱 Android Google Sign-In 성공:', data.user);
                    
                    // 성공 햅틱 피드백
                    if (window.SmapApp && window.SmapApp.haptic) {
                        window.SmapApp.haptic.success();
                    }
                    
                    // 기존 iOS 콜백과 동일한 방식으로 처리
                    if (window.onNativeGoogleLoginSuccess) {
                        window.onNativeGoogleLoginSuccess(data);
                    } else {
                        // 백업 처리 - 홈으로 이동
                        console.log('📱 Android Google Sign-In 직접 처리 - 홈으로 이동');
                        window.location.href = '/home';
                    }
                } else {
                    throw new Error(data.error || '로그인에 실패했습니다.');
                }
            })
            .catch(error => {
                console.error('📱 Android Google Sign-In 백엔드 API 오류:', error);
                
                // 에러 햅틱 피드백
                if (window.SmapApp && window.SmapApp.haptic) {
                    window.SmapApp.haptic.error();
                }
                
                if (window.onNativeGoogleLoginError) {
                    window.onNativeGoogleLoginError(error.message || '백엔드 인증에 실패했습니다.');
                }
            });
            
        } catch (error) {
            console.error('📱 Android Google Sign-In 사용자 정보 파싱 오류:', error);
            if (window.onNativeGoogleLoginError) {
                window.onNativeGoogleLoginError('사용자 정보를 처리하는 중 오류가 발생했습니다.');
            }
        }
    };
    
    window.googleSignInError = function(errorMessage) {
        console.error('📱 Android Google Sign-In 실패 콜백 수신:', errorMessage);
        
        if (window.onNativeGoogleLoginError) {
            window.onNativeGoogleLoginError(errorMessage);
        }
    };
    
    window.googleSignOutSuccess = function() {
        console.log('📱 Android Google Sign-Out 성공 콜백 수신');
        
        // 로그아웃 성공 처리
        if (window.onNativeGoogleLogoutSuccess) {
            window.onNativeGoogleLogoutSuccess();
        }
    };
    
    window.googleSignInStatusResult = function(isSignedIn, userInfoJson) {
        console.log('📱 Android Google Sign-In 상태 확인 결과:', {
            isSignedIn: isSignedIn,
            hasUserInfo: !!userInfoJson
        });
        
        if (isSignedIn && userInfoJson) {
            try {
                const userInfo = typeof userInfoJson === 'string' ? JSON.parse(userInfoJson) : userInfoJson;
                console.log('📱 Android Google Sign-In 현재 사용자:', userInfo);
            } catch (error) {
                console.error('📱 Android Google Sign-In 상태 정보 파싱 오류:', error);
            }
        }
    };
    
    console.log('✅ Android Google Sign-In 콜백 함수 등록 완료');
    
})(); 
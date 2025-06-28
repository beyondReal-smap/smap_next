// Android Bridge for Google Sign-In
(function() {
    'use strict';
    
    console.log('📱 Android Bridge 로드 중...');
    
    // Android 환경 감지
    const isAndroid = /Android/.test(navigator.userAgent);
    
    console.log('🔍 Android 환경 감지:', {
        isAndroid: isAndroid,
        userAgent: navigator.userAgent.substring(0, 100)
    });
    
    if (!isAndroid) {
        console.log('📱 Android 환경이 아니므로 Android Bridge를 비활성화합니다.');
        return;
    }
    
    // 🔥 Android Google Sign-In 인터페이스 찾기 함수
    function findAndroidGoogleSignInInterface() {
        const interfaces = [
            window.AndroidGoogleSignIn,
            window.androidGoogleSignIn,
            window.__SMAP_ANDROID_GOOGLE_SIGNIN__,
            window.androidBridge?.googleSignIn
        ];
        
        for (const iface of interfaces) {
            if (iface && typeof iface.signIn === 'function') {
                console.log('✅ Android Google Sign-In 인터페이스 발견:', iface);
                return iface;
            }
        }
        
        console.warn('⚠️ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
        console.log('🔍 사용 가능한 인터페이스들:', {
            AndroidGoogleSignIn: !!window.AndroidGoogleSignIn,
            androidGoogleSignIn: !!window.androidGoogleSignIn,
            __SMAP_ANDROID_GOOGLE_SIGNIN__: !!window.__SMAP_ANDROID_GOOGLE_SIGNIN__,
            androidBridge: !!window.androidBridge,
            androidBridgeGoogleSignIn: !!(window.androidBridge && window.androidBridge.googleSignIn)
        });
        
        return null;
    }
    
    // 🔥 Android Google Sign-In 인터페이스 대기 함수
    function waitForAndroidGoogleSignInInterface(maxWait = 3000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            function checkInterface() {
                const iface = findAndroidGoogleSignInInterface();
                if (iface) {
                    resolve(iface);
                    return;
                }
                
                if (Date.now() - startTime < maxWait) {
                    setTimeout(checkInterface, 100);
                } else {
                    console.error('❌ Android Google Sign-In 인터페이스 대기 시간 초과');
                    resolve(null);
                }
            }
            
            checkInterface();
        });
    }
    
    // Android Google Sign-In 브리지 객체 생성
    window.androidBridge = {
        googleSignIn: {
            // 중복 호출 방지 플래그
            _isSigningIn: false,
            
            // Google 로그인 시작
            signIn: async function() {
                console.log('📱 Android Google Sign-In 시작');
                
                // 중복 호출 방지
                if (this._isSigningIn) {
                    console.log('📱 Android Google Sign-In 이미 진행 중, 중복 호출 무시');
                    return false;
                }
                
                this._isSigningIn = true;
                console.log('📱 Android Google Sign-In 진행 중 플래그 설정');
                
                // 🔥 인터페이스 찾기 (대기 포함)
                let foundInterface = findAndroidGoogleSignInInterface();
                
                if (!foundInterface) {
                    console.log('⏳ Android Google Sign-In 인터페이스 대기 중...');
                    foundInterface = await waitForAndroidGoogleSignInInterface();
                }
                
                if (foundInterface) {
                    try {
                        foundInterface.signIn();
                        console.log('✅ Android Google Sign-In 네이티브 호출 성공');
                        
                        // 10초 후 플래그 자동 해제 (타임아웃)
                        setTimeout(() => {
                            if (this._isSigningIn) {
                                console.log('📱 Android Google Sign-In 타임아웃, 플래그 해제');
                                this._isSigningIn = false;
                            }
                        }, 10000);
                        
                        return true;
                    } catch (error) {
                        console.error('❌ Android Google Sign-In 네이티브 호출 실패:', error);
                        this._isSigningIn = false;
                        return false;
                    }
                } else {
                    console.error('❌ Android Google Sign-In 인터페이스를 찾을 수 없습니다.');
                    this._isSigningIn = false;
                    return false;
                }
            },
            
            // Google 로그아웃
            signOut: function() {
                console.log('📱 Android Google Sign-Out 시작');
                
                const foundInterface = findAndroidGoogleSignInInterface();
                
                if (foundInterface) {
                    try {
                        foundInterface.signOut();
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
                
                const foundInterface = findAndroidGoogleSignInInterface();
                
                if (foundInterface) {
                    try {
                        foundInterface.checkStatus();
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
            },
            
            // 진행 중 플래그 해제 (콜백에서 호출)
            _clearSigningInFlag: function() {
                console.log('📱 Android Google Sign-In 진행 중 플래그 해제');
                this._isSigningIn = false;
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
    
    // 🔥 인터페이스 준비 상태 확인
    const hasAndroidGoogleSignIn = !!findAndroidGoogleSignInInterface();
    
    // 전역 플래그 설정
    window.__SMAP_ANDROID_BRIDGE_READY__ = true;
    window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__ = hasAndroidGoogleSignIn;
    
    console.log('✅ Android Bridge 초기화 완료:', {
        hasAndroidGoogleSignIn: hasAndroidGoogleSignIn,
        androidBridge: !!window.androidBridge,
        __SMAP_ANDROID_BRIDGE_READY__: window.__SMAP_ANDROID_BRIDGE_READY__,
        __SMAP_ANDROID_GOOGLE_SIGNIN_READY__: window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__
    });
    
    // 🔥 인터페이스가 나중에 로드될 경우를 대비한 모니터링
    if (!hasAndroidGoogleSignIn) {
        console.log('⏳ Android Google Sign-In 인터페이스 모니터링 시작...');
        
        let checkCount = 0;
        const maxChecks = 30; // 3초 (100ms * 30)
        
        const checkInterval = setInterval(() => {
            checkCount++;
            const iface = findAndroidGoogleSignInInterface();
            
            if (iface) {
                console.log('✅ Android Google Sign-In 인터페이스 발견! (모니터링)', checkCount);
                window.__SMAP_ANDROID_GOOGLE_SIGNIN_READY__ = true;
                clearInterval(checkInterval);
            } else if (checkCount >= maxChecks) {
                console.error('❌ Android Google Sign-In 인터페이스 모니터링 시간 초과');
                clearInterval(checkInterval);
            }
        }, 100);
    }
    
    // Android Google Sign-In 콜백 함수들을 전역으로 등록
    window.googleSignInSuccess = function(idToken, userInfoJson) {
        console.log('📱 Android Google Sign-In 성공 콜백 수신:', {
            hasIdToken: !!idToken,
            hasUserInfo: !!userInfoJson,
            idTokenLength: idToken ? idToken.length : 0
        });
        
        // 진행 중 플래그 해제
        if (window.androidBridge?.googleSignIn?._clearSigningInFlag) {
            window.androidBridge.googleSignIn._clearSigningInFlag();
        }
        
        try {
            const userInfo = typeof userInfoJson === 'string' ? JSON.parse(userInfoJson) : userInfoJson;
            console.log('📱 Android Google Sign-In 사용자 정보:', userInfo);
            
            // 🚨 기존 iOS 콜백을 완전히 우회하고 직접 백엔드 API 호출
            console.log('📱 Android Google Sign-In 백엔드 API 직접 호출 시작');
            
            // 성공 햅틱 피드백
            if (window.SmapApp && window.SmapApp.haptic) {
                window.SmapApp.haptic.success();
            }
            
            // 🚨 기존 iOS 콜백 호출 방지
            console.log('📱 Android Google Sign-In - 기존 iOS 콜백 호출 방지');
            
            // 요청 본문 구성
            const requestBody = {
                idToken: idToken,  // ✅ 올바른 파라미터 이름으로 전송
                userInfo: userInfo,
                source: 'android_native'
            };
            
            console.log('📱 Android Google Sign-In 요청 본문:', {
                hasIdToken: !!requestBody.idToken,
                idTokenLength: requestBody.idToken ? requestBody.idToken.length : 0,
                idTokenPrefix: requestBody.idToken ? requestBody.idToken.substring(0, 50) + '...' : 'N/A',
                hasUserInfo: !!requestBody.userInfo,
                userInfoKeys: requestBody.userInfo ? Object.keys(requestBody.userInfo) : [],
                source: requestBody.source
            });
            
            fetch('/api/google-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })
            .then(response => {
                console.log('📱 Android Google Sign-In 백엔드 응답 상태:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('📱 Android Google Sign-In 백엔드 응답 데이터:', data);
                
                if (data.success) {
                    console.log('📱 Android Google Sign-In 성공:', data.user);
                    
                    // 성공 햅틱 피드백
                    if (window.SmapApp && window.SmapApp.haptic) {
                        window.SmapApp.haptic.success();
                    }
                    
                    // 🚨 직접 홈 페이지로 이동 (기존 콜백 우회)
                    console.log('📱 Android Google Sign-In 직접 처리 - 홈으로 이동');
                    window.location.href = '/home';
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
                
                // 에러 표시
                if (window.showError) {
                    window.showError(error.message || '백엔드 인증에 실패했습니다.');
                } else {
                    alert(error.message || '백엔드 인증에 실패했습니다.');
                }
            });
            
        } catch (error) {
            console.error('📱 Android Google Sign-In 사용자 정보 파싱 오류:', error);
            
            // 에러 햅틱 피드백
            if (window.SmapApp && window.SmapApp.haptic) {
                window.SmapApp.haptic.error();
            }
            
            // 에러 표시
            if (window.showError) {
                window.showError('사용자 정보를 처리하는 중 오류가 발생했습니다.');
            } else {
                alert('사용자 정보를 처리하는 중 오류가 발생했습니다.');
            }
        }
    };
    
    window.googleSignInError = function(errorMessage) {
        console.error('📱 Android Google Sign-In 실패 콜백 수신:', errorMessage);
        
        // 진행 중 플래그 해제
        if (window.androidBridge?.googleSignIn?._clearSigningInFlag) {
            window.androidBridge.googleSignIn._clearSigningInFlag();
        }
        
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
    
    // 플랫폼 감지 함수
    function isIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    // Android 환경이면 iOS 콜백을 덮어쓰기
    if (isAndroid()) {
        window.onNativeGoogleLoginSuccess = function(idToken, userInfo) {
            console.log('📱 Android - 기존 iOS 콜백 덮어쓰기됨');
            // 아무것도 하지 않음
        };
        window.handleNativeGoogleLoginSuccess = function(idToken, userInfo) {
            console.log('📱 Android - 기존 iOS 콜백 덮어쓰기됨');
            // 아무것도 하지 않음
        };
    }

    // iOS 환경이면 Android 콜백을 덮어쓰기(필요시)
    if (isIOS()) {
        window.googleSignInSuccess = function() {
            // 아무것도 하지 않음
        };
    }
    
})(); 
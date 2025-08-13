'use client';

import { useState, useEffect, useCallback } from 'react';

export interface LocationPermissionState {
  status: 'granted' | 'denied' | 'prompt' | 'unknown';
  isLoading: boolean;
  error: string | null;
}

export const useLocationPermission = () => {
  const [permissionState, setPermissionState] = useState<LocationPermissionState>({
    status: 'unknown',
    isLoading: true,
    error: null
  });

  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // 권한 상태 확인
  const checkPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setPermissionState({
        status: 'denied',
        isLoading: false,
        error: '이 브라우저는 위치 서비스를 지원하지 않습니다.'
      });
      return;
    }

    try {
      // 권한 API가 지원되는 경우
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        
        setPermissionState({
          status: permission.state as 'granted' | 'denied' | 'prompt',
          isLoading: false,
          error: null
        });

        // 권한 상태 변경 감지
        permission.onchange = () => {
          setPermissionState(prev => ({
            ...prev,
            status: permission.state as 'granted' | 'denied' | 'prompt'
          }));
        };
      } else {
        // 권한 API가 지원되지 않는 경우, 실제 위치 요청으로 확인
        setPermissionState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('위치 권한 확인 실패:', error);
      setPermissionState({
        status: 'unknown',
        isLoading: false,
        error: '위치 권한을 확인할 수 없습니다.'
      });
    }
  }, []);

  // 위치 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[useLocationPermission] 위치 권한 요청 시작');
    
    // 안드로이드 환경 감지
    const isAndroid = /Android/.test(navigator.userAgent);
    console.log('[useLocationPermission] 안드로이드 환경:', isAndroid);
    
    if (!navigator.geolocation) {
      console.log('[useLocationPermission] geolocation API 지원 안됨');
      setPermissionState({
        status: 'denied',
        isLoading: false,
        error: '이 브라우저는 위치 서비스를 지원하지 않습니다.'
      });
      return false;
    }

    console.log('[useLocationPermission] geolocation API 사용 가능');
    setPermissionState(prev => ({ ...prev, isLoading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('위치 권한 요청 성공:', position.coords);
          setPermissionState({
            status: 'granted',
            isLoading: false,
            error: null
          });
          setShowPermissionModal(false);
          resolve(true);
        },
        (error) => {
          console.error('위치 권한 요청 실패:', error);
          console.log('[useLocationPermission] 에러 상세 정보:', {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT,
            userAgent: navigator.userAgent,
            isAndroid: /Android/.test(navigator.userAgent)
          });
          
          let errorMessage = '';
          let status: 'granted' | 'denied' | 'prompt' = 'denied';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = '위치 권한이 거부되었습니다.';
              status = 'denied';
              console.log('[useLocationPermission] 권한 거부됨 (PERMISSION_DENIED)');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = '위치 정보를 사용할 수 없습니다.';
              status = 'denied';
              console.log('[useLocationPermission] 위치 정보 사용 불가 (POSITION_UNAVAILABLE)');
              break;
            case error.TIMEOUT:
              errorMessage = '위치 정보 요청이 시간 초과되었습니다.';
              status = 'prompt';
              console.log('[useLocationPermission] 시간 초과 (TIMEOUT)');
              break;
            default:
              errorMessage = '위치 정보를 가져오는 중 오류가 발생했습니다.';
              status = 'denied';
              console.log('[useLocationPermission] 기타 오류 (code:', error.code, ')');
              break;
          }
          
          setPermissionState({
            status,
            isLoading: false,
            error: errorMessage
          });
          
          // 권한이 거부된 경우 모달 표시
          console.log('[useLocationPermission] 권한 상태:', status, '모달 표시:', status === 'denied');
          if (status === 'denied') {
            console.log('[useLocationPermission] 권한 거부됨 - 모달 표시');
            console.log('[useLocationPermission] 🚨 모달 상태 변경: false -> true');
            setShowPermissionModal(true);
            
            // 🚨 강제 로그 (항상 표시)
            setTimeout(() => {
              console.log('🚨 [useLocationPermission] 강제 로그 - 권한 모달이 표시되어야 합니다!');
              console.log('🚨 [useLocationPermission] showPermissionModal 상태:', showPermissionModal);
            }, 100);
          }
          
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  }, []);

  // 설정으로 이동 (iOS/Android WebView)
  const openSettings = useCallback(() => {
    console.log('[useLocationPermission] 설정으로 이동 시도');
    
    // iOS WebView
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.smapIos) {
      console.log('[useLocationPermission] iOS 네이티브 설정 열기');
      window.webkit.messageHandlers.smapIos.postMessage({
        type: 'openSettings',
        param: ''
      });
      setShowPermissionModal(false);
      return;
    }
    // Android WebView
    if (typeof window !== 'undefined' && (window as any).SmapApp?.openAppSettings) {
      console.log('[useLocationPermission] Android 네이티브 설정 열기');
      (window as any).SmapApp.openAppSettings();
      setShowPermissionModal(false);
      return;
    }
    // Android Google Sign-In 인터페이스
    if (typeof window !== 'undefined' && (window as any).AndroidGoogleSignIn?.openSettings) {
      console.log('[useLocationPermission] Android Google Sign-In 설정 열기');
      (window as any).AndroidGoogleSignIn.openSettings();
      setShowPermissionModal(false);
      return;
    }
    // 일반 브라우저
    if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      alert('설정 > Safari > 위치 서비스에서 이 웹사이트의 위치 권한을 허용해주세요.');
    } else if (navigator.userAgent.toLowerCase().includes('android')) {
      alert('설정 > 애플리케이션 > 해당 앱 > 권한에서 위치 권한을 허용해주세요.');
    } else {
      alert('브라우저 설정에서 위치 권한을 허용해주세요.');
    }
    setShowPermissionModal(false);
  }, []);

  // 모달 닫기
  const closePermissionModal = useCallback(() => {
    setShowPermissionModal(false);
  }, []);

  // 🚨 자동 권한 체크 차단: signin 전에는 권한 체크하지 않음
  // 권한 체크는 로그인 후 home 화면에서 수동으로 호출하도록 변경됨
  // useEffect(() => {
  //   checkPermission();
  // }, [checkPermission]);

  return {
    permissionState,
    showPermissionModal,
    requestPermission,
    openSettings,
    closePermissionModal,
    checkPermission
  };
}; 